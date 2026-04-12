/** PostgREST / Postgres: thiếu cột hoặc schema cache chưa khớp migration. */
export function isSupabaseSchemaDriftError(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes("does not exist") ||
    m.includes("schema cache") ||
    m.includes("could not find") ||
    m.includes("42703") ||
    m.includes("pgrst204")
  );
}
