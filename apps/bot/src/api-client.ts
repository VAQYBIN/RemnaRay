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

/** `UserMe` from section 9.4. */
export type HomeState = {
  id: string;
  telegramId: number;
  username: string | null;
  firstName: string | null;
  language: Locale;
  email: string | null;
  balance: { amountMinor: number; currency: string };
  referralCode: string;
  referralLink: string;
  botReferralLink: string;
  marketingOptOut: boolean;
  trialAvailable: boolean;
  createdAt: string;
};

export type PublicPlan = {
  id: string;
  slug: string;
  name: Record<string, string>;
  durationDays: number;
  trafficLimitBytes: number;
  deviceLimit: number;
  price: { amountMinor: number; currency: string };
};

export type SubscriptionState = {
  subscription: {
    status: string;
    expiresAt: string;
    daysLeft: number;
    canChangePlan: boolean;
    canRevoke: boolean;
  } | null;
  panel: {
    subscriptionUrl: string;
    usedTrafficBytes: number;
    trafficLimitBytes: number;
  } | null;
  clients: { id: string; name: string; platforms: string[]; deepLink: string | null }[];
};

export type InvoiceView = {
  id: string;
  kind: string;
  status: string;
  provider: string;
  amount: { amountMinor: number; currency: string };
  paymentUrl?: string;
  starsInvoiceLink?: string;
  expiresAt: string;
  createdAt: string;
};

export type ReferralState = {
  code: string;
  link: string;
  invited: number;
  converted: number;
  earned: { amountMinor: number; currency: string };
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
      signal: AbortSignal.timeout(10_000),
      redirect: 'error',
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

  getMe(telegramId: number) {
    return this.request<HomeState>('/api/internal/v1/me', { userId: telegramId });
  }

  patchMe(
    telegramId: number,
    body: { language?: Locale; marketingOptOut?: boolean; email?: string | null },
  ) {
    return this.request<{ language: Locale; email: string | null; marketingOptOut: boolean }>(
      '/api/internal/v1/me',
      { method: 'PATCH', userId: telegramId, body },
    );
  }

  redeemPromo(telegramId: number, code: string) {
    return this.request<{ reservedForNextPurchase: boolean }>(
      '/api/internal/v1/me/promocodes/redeem',
      {
        method: 'POST',
        userId: telegramId,
        body: { code },
      },
    );
  }

  forwardSupport(telegramId: number, messageId: number, message: string) {
    return this.request<unknown>('/api/internal/v1/support/forward', {
      method: 'POST',
      userId: telegramId,
      body: { telegramId, messageId, text: message },
    });
  }

  getAdminRole(telegramId: number) {
    return this.request<{ role: string }>(
      `/api/internal/v1/admins/by-telegram/${String(telegramId)}`,
    );
  }

  adminStats(telegramId: number) {
    return this.request<{ users: number; activeSubscriptions: number; transactionsToday: number }>(
      '/api/internal/v1/admins/stats',
      { userId: telegramId },
    );
  }

  adminUser(telegramId: number, query: string) {
    return this.request<{ telegramId: string; username: string | null; firstName: string | null }>(
      `/api/internal/v1/admins/users/${encodeURIComponent(query)}`,
      { userId: telegramId },
    );
  }

  adminExtend(telegramId: number, targetTelegramId: string, days: number) {
    return this.request<{ expiresAt: string; days: number }>('/api/internal/v1/admins/extend', {
      method: 'POST',
      userId: telegramId,
      body: { telegramId: targetTelegramId, days },
    });
  }

  adminBroadcastStatus(telegramId: number) {
    return this.request<{ id: string; status: string; sent: number; total: number } | null>(
      '/api/internal/v1/admins/broadcast-status',
      { userId: telegramId },
    );
  }

  getPlans() {
    return this.request<{ items: PublicPlan[] }>('/api/internal/v1/me/plans');
  }

  getSubscription(telegramId: number) {
    return this.request<SubscriptionState>('/api/internal/v1/me/subscription', {
      userId: telegramId,
    });
  }

  getTransactions(telegramId: number) {
    return this.request<{
      items: Array<{
        amount: { amountMinor: number; currency: string };
        description: string | null;
        createdAt: string;
      }>;
      nextCursor: string | null;
    }>('/api/internal/v1/me/transactions', { userId: telegramId });
  }

  getReferrals(telegramId: number) {
    return this.request<ReferralState>('/api/internal/v1/me/referrals', { userId: telegramId });
  }

  startTrial(telegramId: number) {
    return this.request<{ subscription: unknown }>('/api/internal/v1/me/trial', {
      method: 'POST',
      userId: telegramId,
    });
  }

  revokeSubscription(telegramId: number) {
    return this.request<{ subscriptionUrl: string }>('/api/internal/v1/me/subscription/revoke', {
      method: 'POST',
      userId: telegramId,
    });
  }

  getPaymentMethods() {
    return this.request<{
      items: Array<{
        code: string;
        displayName: Record<string, string>;
        kind: string;
        available: boolean;
      }>;
    }>('/api/internal/v1/me/payment-methods');
  }

  getTopupConfig() {
    return this.request<{ presetsMinor: number[]; minMinor: number; maxMinor: number }>(
      '/api/internal/v1/me/topup-config',
    );
  }

  createInvoice(
    telegramId: number,
    body: {
      kind: 'purchase' | 'topup' | 'plan_change';
      planId?: string;
      provider: string;
      amountMinor?: number;
    },
    idempotencyKey: string,
  ) {
    return this.request<InvoiceView>('/api/internal/v1/me/invoices', {
      method: 'POST',
      userId: telegramId,
      body,
      idempotencyKey,
    });
  }

  checkInvoice(telegramId: number, invoiceId: string) {
    return this.request<InvoiceView>(`/api/internal/v1/me/invoices/${invoiceId}/check`, {
      method: 'POST',
      userId: telegramId,
    });
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
