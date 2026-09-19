import type { Locale } from '@remnaray/i18n-core';

export class ApiClientError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    readonly details?: unknown,
  ) {
    super(code);
    this.name = 'ApiClientError';
  }
}

export type UserSummary = {
  id: string;
  telegramId: string;
  username: string | null;
  firstName: string | null;
  language: Locale;
  referralCode: string;
  isBanned: boolean;
};

export type UpsertUserResult = {
  user: UserSummary;
  created: boolean;
  attributed: boolean;
  promoReserved: boolean;
  planSlug?: string;
};

export type ApiClientOptions = {
  baseUrl?: string;
  internalToken?: string;
  fetchImpl?: typeof fetch;
};

export class ApiClient {
  private readonly baseUrl: string;
  private readonly internalToken: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: ApiClientOptions = {}) {
    this.baseUrl = (options.baseUrl ?? process.env.RR_API_URL ?? 'http://api:3000').replace(
      /\/$/u,
      '',
    );
    this.internalToken = options.internalToken ?? process.env.RR_INTERNAL_TOKEN ?? '';
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async request<T>(
    path: string,
    options: {
      method?: string;
      userId?: string | number | bigint;
      body?: unknown;
      idempotencyKey?: string;
    } = {},
  ): Promise<T> {
    const headers: Record<string, string> = {
      accept: 'application/json',
      'x-internal-token': this.internalToken,
    };
    if (options.body !== undefined) headers['content-type'] = 'application/json';
    if (options.userId !== undefined) headers['x-acting-user'] = String(options.userId);
    if (options.idempotencyKey) headers['idempotency-key'] = options.idempotencyKey;
    const request: RequestInit = {
      method: options.method ?? 'GET',
      headers,
      ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
    };
    const response = await this.fetchImpl(`${this.baseUrl}${path}`, request);
    const text = await response.text();
    let payload: unknown = undefined;
    if (text) {
      try {
        payload = JSON.parse(text) as unknown;
      } catch {
        payload = text;
      }
    }
    if (!response.ok) {
      const code =
        typeof payload === 'object' &&
        payload !== null &&
        'code' in payload &&
        typeof payload.code === 'string'
          ? payload.code
          : `HTTP_${String(response.status)}`;
      throw new ApiClientError(response.status, code, payload);
    }
    return payload as T;
  }

  upsertUser(user: {
    telegramId: number;
    username?: string;
    firstName?: string;
    languageCode?: string;
    startPayload?: string;
  }): Promise<UpsertUserResult> {
    return this.request('/api/internal/v1/users/upsert', {
      method: 'POST',
      body: user,
    });
  }

  getConfig() {
    return this.request<import('./types.js').BotConfig>('/api/internal/v1/bot/config');
  }

  getMessages(lang: Locale) {
    return this.request<{ lang: Locale; messages: Record<string, string> }>(
      `/api/internal/v1/i18n/${lang}`,
    );
  }

  issueToken(telegramId: number) {
    return this.request<{ token: string; user: UserSummary }>('/api/internal/v1/auth/issue-token', {
      method: 'POST',
      body: { telegramId },
    });
  }

  markBlocked(telegramId: number): Promise<unknown> {
    return this.request<unknown>(`/api/internal/v1/users/${String(telegramId)}/bot-blocked`, {
      method: 'POST',
    });
  }

  markUnblocked(telegramId: number): Promise<unknown> {
    return this.request<unknown>(`/api/internal/v1/users/${String(telegramId)}/bot-unblocked`, {
      method: 'POST',
    });
  }
}
