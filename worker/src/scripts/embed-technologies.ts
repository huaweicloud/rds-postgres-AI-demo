// Fills in name_embedding for every technology that doesn't have one yet. Run after the
// seed migration, and again after switching EMBEDDINGS_MODEL (with --all).
import { Embeddings, toVector } from "../clients/embeddings.js";
import { loadConfig } from "../config.js";
import { createDb, must } from "../db.js";

const all = process.argv.includes("--all");
const config = loadConfig();
const db = createDb(config);
const embeddings = new Embeddings(config.EMBEDDINGS_URL, config.EMBEDDINGS_MODEL);

let query = db.from("technologies").select("id, name, category").order("id");
if (!all) query = query.is("name_embedding", null);
const rows = must(await query) as { id: number; name: string; category: string }[];

const vectors = await embeddings.embed(rows.map((r) => `${r.name} (${r.category})`));
for (const [i, row] of rows.entries()) {
  must(
    await db
      .from("technologies")
      .update({ name_embedding: toVector(vectors[i]!) })
      .eq("id", row.id),
  );
}
console.log(`embedded ${rows.length} technologies`);
