import { z } from "zod";
import { HttpError, withRetry } from "../net.js";

export const EMBEDDING_DIMENSIONS = 1024;

const responseSchema = z.object({
  data: z.array(z.object({ embedding: z.array(z.number()), index: z.number() })),
});

// Matryoshka models (Qwen3-Embedding-4B/8B) can be truncated to the schema's 1024 dimensions;
// re-normalize afterwards so cosine distances stay comparable.
export function fitDimensions(v: number[], dims = EMBEDDING_DIMENSIONS): number[] {
  if (v.length === dims) return v;
  if (v.length < dims) throw new Error(`embedding has ${v.length} dimensions, need ${dims}`);
  const cut = v.slice(0, dims);
  const norm = Math.hypot(...cut) || 1;
  return cut.map((x) => x / norm);
}

export class Embeddings {
  constructor(
    private readonly baseUrl: string | undefined,
    private readonly model: string,
  ) {}

  get available(): boolean {
    return Boolean(this.baseUrl);
  }

  async embed(inputs: string[]): Promise<number[][]> {
    if (!this.baseUrl) throw new Error("EMBEDDINGS_URL is not set");
    if (!inputs.length) return [];
    const url = `${this.baseUrl.replace(/\/$/, "")}/v1/embeddings`;
    const out: number[][] = [];
    // TEI's default batch limit is 32 inputs per request.
    for (let i = 0; i < inputs.length; i += 32) {
      const batch = inputs.slice(i, i + 32);
      const data = await withRetry(async () => {
        const res = await fetch(url, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ model: this.model, input: batch }),
          signal: AbortSignal.timeout(60_000),
        });
        if (!res.ok) throw new HttpError(res.status, url);
        return responseSchema.parse(await res.json()).data;
      });
      for (const row of [...data].sort((a, b) => a.index - b.index))
        out.push(fitDimensions(row.embedding));
    }
    return out;
  }
}

// pgvector's text input format.
export function toVector(v: number[]): string {
  return `[${v.join(",")}]`;
}
