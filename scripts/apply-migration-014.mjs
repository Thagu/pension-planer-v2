/**
 * Führt Migration 014 (onboarding_completed_at / onboarding_skipped_at) aus.
 *
 * In .env.local eintragen (Supabase → Project Settings → Database → URI):
 *   SUPABASE_DB_URL=postgresql://postgres.[ref]:[PASSWORD]@...
 *
 * Dann: npm run db:migrate-014
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
  resolve(root, "supabase/migrations/014_onboarding_completed.sql"),
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
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
      AND column_name IN ('onboarding_completed_at', 'onboarding_skipped_at')
    ORDER BY column_name
  `);

  console.log("Migration 014 erfolgreich angewendet.");
  for (const row of rows) {
    console.log(`  ✓ profiles.${row.column_name} (${row.data_type})`);
  }
  if (rows.length < 2) {
    console.warn("Warnung: nicht alle Spalten in information_schema sichtbar.");
  }
} catch (err) {
  console.error("Migration fehlgeschlagen:", err.message ?? err);
  process.exit(1);
} finally {
  await client.end();
}
