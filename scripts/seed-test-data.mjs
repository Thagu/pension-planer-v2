/**
 * Seeds master data + 3a accounts + TEST scenarios for manual QA.
 *
 * Requires in .env.local (one of):
 *   SUPABASE_SERVICE_ROLE_KEY + NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_DB_URL (PostgreSQL URI)
 *
 * Optional:
 *   TEST_USER_EMAIL=user@example.com  (default: first auth user)
 *
 * Usage: npm run seed:test
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  buildMasterProfile,
  buildPillar3aAccounts,
  buildTestScenarios,
} from "../lib/seed/test-fixtures.mjs";

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

const TEST_PREFIX = "TEST:";

async function resolveUserIdPg(client, email) {
  if (email) {
    const res = await client.query(
      `select id from auth.users where email = $1 limit 1`,
      [email],
    );
    if (res.rows[0]?.id) return res.rows[0].id;
    throw new Error(`No auth user for TEST_USER_EMAIL=${email}`);
  }
  const res = await client.query(
    `select id, email from auth.users order by created_at asc limit 1`,
  );
  if (!res.rows[0]?.id) {
    throw new Error(
      "No users in auth.users — register once in the app, then re-run seed.",
    );
  }
  console.log(`Using user: ${res.rows[0].email} (${res.rows[0].id})`);
  return res.rows[0].id;
}

async function ensureInflationColumn(client) {
  await client.query(`
    alter table public.profiles
      add column if not exists inflation_rate numeric(8, 6);
  `);
}

async function seedViaPostgres() {
  const dbUrl = process.env.SUPABASE_DB_URL ?? process.env.DATABASE_URL;
  if (!dbUrl) return null;

  const { default: pg } = await import("pg");
  const client = new pg.Client({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();
  try {
    const email = process.env.TEST_USER_EMAIL?.trim() || null;
    const uid = await resolveUserIdPg(client, email);

    await ensureInflationColumn(client);

    const profile = buildMasterProfile(uid);
    const columns = Object.keys(profile);
    const values = Object.values(profile);
    const placeholders = columns.map((_, i) => `$${i + 1}`).join(", ");
    const updates = columns
      .filter((c) => c !== "id")
      .map((c) => `${c} = excluded.${c}`)
      .join(", ");

    await client.query(
      `insert into public.profiles (${columns.join(", ")})
       values (${placeholders})
       on conflict (id) do update set ${updates}, updated_at = timezone('utc', now())`,
      values,
    );
    console.log("✓ Master profile upserted (couple mode, round numbers)");

    await client.query(
      `delete from public.pillar3a_accounts where user_id = $1`,
      [uid],
    );

    for (const account of buildPillar3aAccounts(uid)) {
      await client.query(
        `insert into public.pillar3a_accounts (
          id, user_id, person, name, provider, current_value, annual_contribution,
          return_rate, withdrawal_year_offset, sort_order
        ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [
          account.id,
          account.user_id,
          account.person,
          account.name,
          account.provider,
          account.current_value,
          account.annual_contribution,
          account.return_rate,
          account.withdrawal_year_offset,
          account.sort_order,
        ],
      );
    }
    console.log("✓ 3 pillar 3a accounts inserted (2 primary, 1 partner)");

    const del = await client.query(
      `delete from public.scenarios where user_id = $1 and name like $2`,
      [uid, `${TEST_PREFIX}%`],
    );
    console.log(`✓ Removed ${del.rowCount} old TEST scenarios`);

    const scenarios = buildTestScenarios(uid);
    for (const scenario of scenarios) {
      await client.query(
        `insert into public.scenarios (user_id, name, data) values ($1, $2, $3::jsonb)`,
        [scenario.user_id, scenario.name, JSON.stringify(scenario.data)],
      );
    }
    console.log(`✓ Inserted ${scenarios.length} TEST scenarios`);

    return uid;
  } finally {
    await client.end();
  }
}

async function seedViaServiceRole() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;

  const { createClient } = await import("@supabase/supabase-js");
  const admin = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const email = process.env.TEST_USER_EMAIL?.trim();
  let userId = null;

  if (email) {
    const { data, error } = await admin.auth.admin.listUsers({ perPage: 1000 });
    if (error) throw error;
    const user = data.users.find(
      (u) => u.email?.toLowerCase() === email.toLowerCase(),
    );
    if (!user) throw new Error(`No user for TEST_USER_EMAIL=${email}`);
    userId = user.id;
    console.log(`Using user: ${user.email} (${userId})`);
  } else {
    const { data, error } = await admin.auth.admin.listUsers({ perPage: 1 });
    if (error) throw error;
    if (!data.users.length) {
      throw new Error("No auth users — register in the app first.");
    }
    userId = data.users[0].id;
    console.log(`Using user: ${data.users[0].email} (${userId})`);
  }

  const profile = buildMasterProfile(userId);
  const { error: profileError } = await admin.from("profiles").upsert(profile);
  if (profileError) throw profileError;
  console.log("✓ Master profile upserted");

  await admin.from("pillar3a_accounts").delete().eq("user_id", userId);

  const { error: p3aError } = await admin
    .from("pillar3a_accounts")
    .insert(buildPillar3aAccounts(userId));
  if (p3aError) throw p3aError;
  console.log("✓ 3a accounts inserted");

  await admin
    .from("scenarios")
    .delete()
    .eq("user_id", userId)
    .like("name", `${TEST_PREFIX}%`);

  const scenarios = buildTestScenarios(userId);
  const { error: scenError } = await admin.from("scenarios").insert(scenarios);
  if (scenError) throw scenError;
  console.log(`✓ Inserted ${scenarios.length} TEST scenarios`);

  return userId;
}

async function main() {
  console.log("Pension Planner — test data seed\n");

  try {
    let userId = await seedViaServiceRole();
    if (!userId) {
      userId = await seedViaPostgres();
    }
    if (!userId) {
      console.error(`
Could not seed: add one of these to .env.local:

  SUPABASE_SERVICE_ROLE_KEY=...   (Supabase → Settings → API → service_role)
  NEXT_PUBLIC_SUPABASE_URL=...    (already set)

  — or —

  SUPABASE_DB_URL=postgresql://postgres.[ref]:[PASSWORD]@...

Optional: TEST_USER_EMAIL=your@login.email

Then run: npm run seed:test
`);
      process.exit(1);
    }

    console.log(`
Done. Log in and open:
  /master-data   — couple profile, inflation 2%, 3× 3a
  /scenarios     — ${buildTestScenarios(userId).length} scenarios named "${TEST_PREFIX} …"
`);
  } catch (err) {
    console.error("Seed failed:", err.message ?? err);
    process.exit(1);
  }
}

main();
