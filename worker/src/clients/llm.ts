import { z } from "zod";
import { HttpError, withRetry } from "../net.js";

// Any OpenAI-compatible chat completions API with JSON output. DeepSeek is the default.

export interface LlmOptions {
  baseUrl: string;
  apiKey: string | undefined;
  model: string;
}

export interface JsonCall<T> {
  system: string;
  user: string;
  schema: z.ZodType<T>;
  maxTokens?: number;
  signal?: AbortSignal;
}

export class LlmUnavailable extends Error {
  constructor() {
    super("LLM_API_KEY is not set");
  }
}

const completionSchema = z.object({
  choices: z.array(z.object({ message: z.object({ content: z.string().nullable() }) })).min(1),
});

export class Llm {
  constructor(private readonly opts: LlmOptions) {}

  get available(): boolean {
    return Boolean(this.opts.apiKey);
  }

  private async complete(
    messages: { role: string; content: string }[],
    maxTokens: number,
    signal?: AbortSignal,
  ) {
    const url = `${this.opts.baseUrl.replace(/\/$/, "")}/chat/completions`;
    return withRetry(async () => {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${this.opts.apiKey}`,
        },
        body: JSON.stringify({
          model: this.opts.model,
          messages,
          response_format: { type: "json_object" },
          temperature: 0,
          max_tokens: maxTokens,
        }),
        signal: AbortSignal.any([AbortSignal.timeout(45_000), ...(signal ? [signal] : [])]),
      });
      if (!res.ok) throw new HttpError(res.status, url);
      return completionSchema.parse(await res.json()).choices[0]!.message.content ?? "";
    });
  }

  // A malformed or empty response is retried once with the parse error included, which also
  // covers DeepSeek's occasional empty JSON-mode reply. onAttempt runs before every request,
  // so callers can charge each one to the agent's LLM budget.
  async json<T>(call: JsonCall<T>, onAttempt: () => void = () => {}): Promise<T> {
    if (!this.available) throw new LlmUnavailable();
    const messages = [
      { role: "system", content: call.system },
      { role: "user", content: call.user },
    ];
    let lastError = "";
    for (let attempt = 0; attempt < 2; attempt++) {
      onAttempt();
      const content = await this.complete(messages, call.maxTokens ?? 2_000, call.signal);
      try {
        if (!content.trim()) throw new Error("empty response");
        return call.schema.parse(JSON.parse(content));
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err);
        messages.push(
          { role: "assistant", content: content || "(empty)" },
          {
            role: "user",
            content: `That was not valid json for the schema: ${lastError.slice(0, 500)}. Reply with corrected json only.`,
          },
        );
      }
    }
    throw new Error(`LLM returned invalid json twice: ${lastError.slice(0, 200)}`);
  }
}
