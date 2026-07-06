import { readFileSync } from "node:fs";
import { resolve } from "node:path";

let ensured = false;

/** Profile-related migrations applied automatically when SUPABASE_DB_URL is set. */
const PROFILE_MIGRATION_FILES = [
  "003_profile_coordinated_salary_and_savings.sql",
  "005_profile_planning_and_3a_auto_split.sql",
  "006_tax_settings.sql",
  "009_tax_postal_code.sql",
  "010_workload_reductions.sql",
  "011_household_partner.sql",
  "012_inflation_rate.sql",
  "013_annual_survivor_expenses.sql",
  "014_onboarding_completed.sql",
  "015_household_free_assets.sql",
  "016_first_name.sql",
] as const;

/**
 * Applies idempotent profile schema migrations when a direct DB URL is configured.
 * Safe to call before save; no-op without SUPABASE_DB_URL / DATABASE_URL.
 */
export async function ensureProfileExtensionColumns(force = false): Promise<void> {
  if (ensured && !force) return;

  const dbUrl = process.env.SUPABASE_DB_URL ?? process.env.DATABASE_URL;
  if (!dbUrl) return;

  try {
    const { default: pg } = await import("pg");
    const client = new pg.Client({
      connectionString: dbUrl,
      ssl: { rejectUnauthorized: false },
    });
    await client.connect();

    for (const file of PROFILE_MIGRATION_FILES) {
      const sql = readFileSync(
        resolve(process.cwd(), "supabase/migrations", file),
        "utf8",
      );
      await client.query(sql);
    }

    await client.end();
    ensured = true;
  } catch (err) {
    console.error("[ensureProfileExtensionColumns]", err);
  }
}
