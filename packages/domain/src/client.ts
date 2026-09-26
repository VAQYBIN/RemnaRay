import type { z } from 'zod';

import { errorEnvelopeSchema } from './contracts/common.js';

export class ApiError extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
    message: string,
    readonly requestId?: string,
    readonly details?: unknown,
    /** Section 9.3: a 5xx carries the id its failure was logged under. */
    readonly incidentId?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export type ApiRequestInit = Omit<RequestInit, 'body' | 'method'> & {
  query?: Record<string, string | number | undefined>;
  next?: { revalidate?: number; tags?: string[] };
};

export type ApiClient = {
  get<TSchema extends z.ZodType>(
    path: string,
    schema: TSchema,
    init?: ApiRequestInit,
  ): Promise<z.output<TSchema>>;
  send<TSchema extends z.ZodType>(
    method: 'POST' | 'PATCH' | 'DELETE' | 'PUT',
    path: string,
    schema: TSchema,
    body?: unknown,
    init?: ApiRequestInit,
  ): Promise<z.output<TSchema>>;
};

export type ApiClientOptions = {
  baseUrl: string;
  /** Static headers, e.g. the internal token or a forwarded cookie. */
  headers?: Record<string, string>;
  fetchImpl?: typeof fetch;
};

/**
 * The single typed client required by section 13.1: `fetch` plus Zod parsing of
 * every response, and the section 9.3 error envelope mapped onto `ApiError`.
 */
export function createApiClient({
  baseUrl,
  headers = {},
  fetchImpl = fetch,
}: ApiClientOptions): ApiClient {
  async function call<TSchema extends z.ZodType>(
    method: string,
    path: string,
    schema: TSchema,
    body: unknown,
    init: ApiRequestInit = {},
  ): Promise<z.output<TSchema>> {
    const { query, ...rest } = init;
    const url = new URL(path.replace(/^\//, ''), `${baseUrl.replace(/\/$/, '')}/`);
    for (const [key, value] of Object.entries(query ?? {}))
      if (value !== undefined) url.searchParams.set(key, String(value));

    const response = await fetchImpl(url, {
      ...rest,
      method,
      headers: {
        accept: 'application/json',
        ...(body === undefined ? {} : { 'content-type': 'application/json' }),
        ...(method === 'GET' ? {} : { 'x-requested-with': 'RemnaRay' }),
        ...headers,
        ...(rest.headers as Record<string, string> | undefined),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });

    if (!response.ok) {
      const payload: unknown = await response.json().catch(() => null);
      const parsed = errorEnvelopeSchema.safeParse(payload);
      const error = parsed.success ? parsed.data.error : undefined;
      throw new ApiError(
        error?.code ?? 'INTERNAL_ERROR',
        response.status,
        error?.message ?? `Request failed with status ${response.status.toString()}`,
        error?.requestId ?? response.headers.get('x-request-id') ?? undefined,
        error?.details,
        error?.incidentId,
      );
    }

    const payload: unknown = response.status === 204 ? undefined : await response.json();
    const parsed = schema.safeParse(payload);
    if (parsed.success) return parsed.data;
    // An answer the page cannot read would otherwise surface as a bare
    // INTERNAL_ERROR with nothing to report. The request id finds the call in
    // the proxy and API logs; the paths say which field broke the contract.
    const requestId = response.headers.get('x-request-id') ?? undefined;
    const fields = parsed.error.issues.map((issue) => issue.path.map(String).join('.'));
    console.error('API answer does not match its contract', {
      path: url.pathname,
      requestId,
      fields,
    });
    throw new ApiError(
      'CONTRACT_MISMATCH',
      response.status,
      `Unexpected answer from ${url.pathname}`,
      requestId,
      fields,
    );
  }

  return {
    get: (path, schema, init) => call('GET', path, schema, undefined, init),
    send: (method, path, schema, body, init) => call(method, path, schema, body, init),
  };
}
