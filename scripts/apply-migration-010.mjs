/**
 * Führt Migration 010 (workload_reductions) gegen die Supabase-Datenbank aus.
 *
 * In .env.local eintragen (Supabase → Project Settings → Database → URI):
 *   SUPABASE_DB_URL=postgresql://postgres.[ref]:[PASSWORD]@...
 *
 * Dann: npm run db:migrate-010
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL(".", import.meta.url)), "..");

function loadEnvLocal() {
  try {
    const raw = readFileSync(resolve(root, ".env.local"), "utf8");
    for (const line of raw.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      let val = trimmed.slice(eq + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = val;
    }
  } catch {
    // optional
  }
}

loadEnvLocal();

const dbUrl = process.env.SUPABASE_DB_URL ?? process.env.DATABASE_URL;
if (!dbUrl) {
  console.error(
    "Fehlt SUPABASE_DB_URL in .env.local (PostgreSQL Connection String aus Supabase Dashboard).",
  );
  process.exit(1);
}

const sql = readFileSync(
  resolve(root, "supabase/migrations/010_workload_reductions.sql"),
  "utf8",
);

const { default: pg } = await import("pg");
const client = new pg.Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });

try {
  await client.connect();
  await client.query(sql);
  console.log("Migration 010 erfolgreich angewendet (workload_reductions).");
} catch (err) {
  console.error("Migration fehlgeschlagen:", err.message ?? err);
  process.exit(1);
} finally {
  await client.end();
}
