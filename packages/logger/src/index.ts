import pino, { type DestinationStream, type Logger, type LoggerOptions } from 'pino';

export const REDACT_PATHS = [
  'authorization',
  'cookie',
  'set-cookie',
  'hash',
  'initData',
  'token',
  'secret',
  'secretKey',
  'apiToken',
  'api_key',
  'password',
  'totp',
  'totpCode',
  'secret_path',
  'idempotency-key',
  'headers.authorization',
  'headers.cookie',
  'headers.set-cookie',
  'req.headers.authorization',
  'req.headers.cookie',
  'req.headers.set-cookie',
  'request.headers.authorization',
  'request.headers.cookie',
  'request.headers.set-cookie',
  'body.token',
  'body.secret',
  'body.password',
  'body.hash',
  'body.initData',
  'body.secret_path',
  'body.idempotency-key',
  '*.token',
  '*.secret',
  '*.password',
  '*.secretKey',
  '*.apiToken',
  '*.hash',
  '*.initData',
  '*.secret_path',
  '*.totpCode',
  '*.idempotency-key',
  'email',
  '*.email',
];

export function maskEmail(value: unknown): string {
  const email = String(value);
  const at = email.indexOf('@');
  if (at <= 0 || at === email.length - 1) {
    return '[Redacted]';
  }
  return `${email.charAt(0)}***${email.slice(at)}`;
}

function censor(value: unknown, path: string[]): string {
  return path[path.length - 1] === 'email' ? maskEmail(value) : '[Redacted]';
}

export function createLogger(
  options: Omit<LoggerOptions, 'redact'> & { destination?: DestinationStream } = {},
): Logger {
  const { destination, ...loggerOptions } = options;
  return pino(
    {
      ...loggerOptions,
      redact: { paths: REDACT_PATHS, censor },
    },
    destination,
  );
}
