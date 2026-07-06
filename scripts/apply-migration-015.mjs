/**
 * Führt Migration 015 (freies Vermögen als Haushaltswert) aus.
 *
 * Summiert bestehende Partner-Startkapitalien in profiles.free_assets und
 * setzt den Partner-Wert auf 0. Idempotent (No-op nach dem ersten Lauf).
 *
 * In .env.local eintragen (Supabase → Project Settings → Database → URI):
 *   SUPABASE_DB_URL=postgresql://postgres.[ref]:[PASSWORD]@...
 *
 * Dann: npm run db:migrate-015
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
  resolve(root, "supabase/migrations/015_household_free_assets.sql"),
  "utf8",
);

const { default: pg } = await import("pg");
const client = new pg.Client({
  connectionString: dbUrl,
  ssl: { rejectUnauthorized: false },
});

try {
  await client.connect();
  const result = await client.query(sql);

  const { rows } = await client.query(`
    SELECT COUNT(*)::int AS remaining
    FROM profiles
    WHERE planning_mode = 'couple'
      AND partner_profile IS NOT NULL
      AND COALESCE((partner_profile->>'free_assets')::numeric, 0) <> 0
  `);

  console.log(
    `Migration 015 erfolgreich angewendet (${result.rowCount ?? 0} Profil(e) migriert).`,
  );
  console.log(
    `  ✓ Verbleibende Partner-free_assets <> 0: ${rows[0]?.remaining ?? 0} (sollte 0 sein)`,
  );
} catch (err) {
  console.error("Migration fehlgeschlagen:", err.message ?? err);
  process.exit(1);
} finally {
  await client.end();
}
