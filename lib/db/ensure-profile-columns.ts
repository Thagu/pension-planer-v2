import { readFileSync } from "node:fs";
import { resolve } from "node:path";

let ensured = false;

/** Wendet Migration 003 an, wenn SUPABASE_DB_URL gesetzt ist (einmal pro Prozess). */
export async function ensureProfileExtensionColumns(): Promise<void> {
  if (ensured) return;

  const dbUrl = process.env.SUPABASE_DB_URL ?? process.env.DATABASE_URL;
  if (!dbUrl) return;

  try {
    const { default: pg } = await import("pg");
    const sql = readFileSync(
      resolve(process.cwd(), "supabase/migrations/003_profile_coordinated_salary_and_savings.sql"),
      "utf8",
    );
    const client = new pg.Client({
      connectionString: dbUrl,
      ssl: { rejectUnauthorized: false },
    });
    await client.connect();
    await client.query(sql);
    await client.end();
    ensured = true;
  } catch (err) {
    console.error("[ensureProfileExtensionColumns]", err);
  }
}
