/**
 * Führt Migration 016 (Vorname pro Person) aus.
 *
 * Fügt die Spalte profiles.first_name hinzu (idempotent). Partner-Vornamen
 * liegen als JSON-Key in partner_profile und benötigen keine Schemaänderung.
 *
 * In .env.local eintragen (Supabase → Project Settings → Database → URI):
 *   SUPABASE_DB_URL=postgresql://postgres.[ref]:[PASSWORD]@...
 *
 * Dann: npm run db:migrate-016
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
  resolve(root, "supabase/migrations/016_first_name.sql"),
  "utf8",
);

const { default: pg } = await import("pg");
const client = new pg.Client({
  connectionString: dbUrl,
  ssl: { rejectUnauthorized: false },
});

try {
  await client.connect();
  await client.query(sql);

  const { rows } = await client.query(`
    SELECT COUNT(*)::int AS present
    FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'first_name'
  `);

  console.log("Migration 016 erfolgreich angewendet.");
  console.log(
    `  ✓ Spalte profiles.first_name vorhanden: ${rows[0]?.present === 1 ? "ja" : "nein"}`,
  );
} catch (err) {
  console.error("Migration fehlgeschlagen:", err.message ?? err);
  process.exit(1);
} finally {
  await client.end();
}
