/** The documented single source of truth for the worker's Valkey connection. */
export function workerValkeyUrl(environment: NodeJS.ProcessEnv = process.env): string {
  return environment.VALKEY_URL ?? 'redis://valkey:6379/0';
}
