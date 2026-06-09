/** Supabase/Postgres numeric → JS number (handles string decimals). */
export function parseDbAmount(value: unknown): number {
  if (value == null || value === "") return 0;
  const parsed =
    typeof value === "number" ? value : parseFloat(String(value).replace(/'/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}
