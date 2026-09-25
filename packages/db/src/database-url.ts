/**
 * The connection string the application uses. An explicit `DATABASE_URL`
 * wins; otherwise it is built from the `POSTGRES_*` variables compose passes
 * from `.env`. The owner types the password into `init-env.sh` (26.4 A1),
 * so `@`, `:`, `/`, `#`, `?` or `%` in it are expected: node-postgres and
 * Prisma both read the user and password of a URL percent-decoded, and a
 * password pasted in raw ends the user info early or starts the path.
 */
export function resolveDatabaseUrl(
  source: Record<string, string | undefined> = process.env,
): string | undefined {
  if (source.DATABASE_URL) return source.DATABASE_URL;
  if (!source.POSTGRES_PASSWORD) return undefined;
  const user = encodeURIComponent(source.POSTGRES_USER || 'remnaray');
  const password = encodeURIComponent(source.POSTGRES_PASSWORD);
  const host = source.POSTGRES_HOST || 'postgres';
  const port = source.POSTGRES_PORT || '5432';
  const database = encodeURIComponent(source.POSTGRES_DB || 'remnaray');
  return `postgresql://${user}:${password}@${host}:${port}/${database}`;
}
