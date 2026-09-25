import { panelRequestDuration, panelRequestsTotal } from '@remnaray/metrics';
import { Agent, request, type Dispatcher } from 'undici';

export type PanelConfig = {
  baseUrl: string;
  apiToken: string;
  timeoutMs?: number;
  extraHeaders?: Record<string, string>;
};

export type PanelStats = Record<string, unknown>;
export type InternalSquad = { uuid: string; name: string; info?: { membersCount?: number } };
export type HwidDevice = Record<string, unknown>;
export type PanelUser = {
  id: number;
  shortUuid: string;
  username: string;
  status: 'ACTIVE' | 'DISABLED' | 'LIMITED' | 'EXPIRED';
  trafficLimitBytes: number;
  trafficLimitStrategy: 'NO_RESET' | 'DAY' | 'WEEK' | 'MONTH' | 'MONTH_ROLLING';
  expireAt: string;
  telegramId: number | null;
  email: string | null;
  description: string | null;
  tag: string | null;
  hwidDeviceLimit: number | null;
  vlessUuid: string;
  subscriptionUrl: string;
  activeInternalSquads: Array<{ uuid: string; name: string }>;
  userTraffic: {
    usedTrafficBytes: number;
    lifetimeUsedTrafficBytes: number;
    onlineAt: string | null;
    firstConnectedAt: string | null;
    lastConnectedNodeUuid: string | null;
  };
  createdAt: string;
  updatedAt: string;
};

export type CreateUserInput = {
  username: string;
  expireAt: string;
  telegramId?: number | null;
  email?: string | null;
  description?: string | null;
  tag?: string | null;
  trafficLimitBytes?: number;
  trafficLimitStrategy?: PanelUser['trafficLimitStrategy'];
  hwidDeviceLimit?: number | null;
  activeInternalSquads?: string[];
};
export type UpdateUserInput = Omit<CreateUserInput, 'username' | 'expireAt'> & { id: number };

export class PanelError extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export interface RemnawaveClient {
  close(): Promise<void>;
  system: { stats(): Promise<PanelStats>; health(): Promise<{ ok: boolean; version?: string }> };
  users: {
    create(input: CreateUserInput): Promise<PanelUser>;
    update(input: UpdateUserInput): Promise<PanelUser>;
    getById(id: number): Promise<PanelUser | null>;
    getByTelegramId(telegramId: number): Promise<PanelUser[]>;
    getByUsername(username: string): Promise<PanelUser | null>;
    enable(id: number): Promise<PanelUser>;
    disable(id: number): Promise<PanelUser>;
    resetTraffic(id: number): Promise<PanelUser>;
    revokeSubscription(id: number): Promise<PanelUser>;
    delete(id: number): Promise<void>;
  };
  squads: { list(): Promise<InternalSquad[]> };
  hwid: {
    list(userId: number): Promise<HwidDevice[]>;
    remove(userId: number, hwid: string): Promise<void>;
  };
}

export class RemnawaveClientImpl implements RemnawaveClient {
  // Every call names its operation: section 10.1 labels the metrics with the
  // client method, and a label taken from the path would carry a uuid per
  // series.
  readonly system = {
    stats: () => this.call<PanelStats>('system.stats', 'GET', '/api/system/stats'),
    health: () => this.health(),
  };
  readonly users = {
    create: (input: CreateUserInput) =>
      this.call<PanelUser>('users.create', 'POST', '/api/users', input),
    update: (input: UpdateUserInput) =>
      this.call<PanelUser>('users.update', 'PATCH', '/api/users', input),
    getById: (id: number) => this.optional<PanelUser>('users.getById', `/api/users/${String(id)}`),
    getByTelegramId: async (telegramId: number) =>
      collection<PanelUser>(
        'users.getByTelegramId',
        'users',
        await this.call(
          'users.getByTelegramId',
          'GET',
          `/api/users/stream?size=1000&telegramId=${encodeURIComponent(String(telegramId))}`,
        ),
      ),
    getByUsername: (username: string) =>
      this.optional<PanelUser>(
        'users.getByUsername',
        `/api/users/by-username/${encodeURIComponent(username)}`,
      ),
    enable: (id: number) =>
      this.call<PanelUser>('users.enable', 'POST', `/api/users/${String(id)}/actions/enable`),
    disable: (id: number) =>
      this.call<PanelUser>('users.disable', 'POST', `/api/users/${String(id)}/actions/disable`),
    resetTraffic: (id: number) =>
      this.call<PanelUser>(
        'users.resetTraffic',
        'POST',
        `/api/users/${String(id)}/actions/reset-traffic`,
      ),
    revokeSubscription: (id: number) =>
      this.call<PanelUser>(
        'users.revokeSubscription',
        'POST',
        `/api/users/${String(id)}/actions/revoke`,
        { revokeOnlyPasswords: false },
      ),
    delete: async (id: number) => {
      await this.call<unknown>('users.delete', 'DELETE', `/api/users/${String(id)}`);
    },
  };
  readonly squads = {
    // The panel answers with a page, not a list — `{response:{total,
    // internalSquads:[…]}}` — and `unwrap` removes only the envelope.
    list: async () =>
      collection<InternalSquad>(
        'squads.list',
        'internalSquads',
        await this.call('squads.list', 'GET', '/api/internal-squads'),
      ),
  };
  readonly hwid = {
    list: async (userId: number) =>
      collection<HwidDevice>(
        'hwid.list',
        'devices',
        await this.call('hwid.list', 'GET', `/api/hwid/devices/${String(userId)}`),
      ),
    remove: async (userId: number, hwid: string) => {
      await this.call('hwid.remove', 'POST', '/api/hwid/devices/delete', { userId, hwid });
    },
  };

  private readonly pool: Dispatcher;
  private readonly baseUrl: string;
  private readonly config: Required<Pick<PanelConfig, 'apiToken' | 'timeoutMs'>> &
    Pick<PanelConfig, 'extraHeaders'>;

  constructor(config: PanelConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/u, '');
    this.config = {
      apiToken: config.apiToken,
      timeoutMs: config.timeoutMs ?? 10_000,
      extraHeaders: config.extraHeaders ?? {},
    };
    this.pool = new Agent({
      connections: 4,
      headersTimeout: this.config.timeoutMs,
      bodyTimeout: this.config.timeoutMs,
    });
  }

  async close(): Promise<void> {
    await this.pool.close();
  }

  private async health() {
    try {
      const stats = await this.call<{ version?: string }>(
        'system.health',
        'GET',
        '/api/system/stats',
      );
      return { ok: true, ...(stats.version ? { version: stats.version } : {}) };
    } catch {
      return { ok: false };
    }
  }

  private async optional<T>(op: string, path: string): Promise<T | null> {
    try {
      return await this.call<T>(op, 'GET', path);
    } catch (error) {
      if (error instanceof PanelError && error.status === 404) return null;
      throw error;
    }
  }

  /**
   * Section 10.1: `rr_panel_requests_total{op,status}` and
   * `rr_panel_request_duration_seconds{op}`. One observation per call, not per
   * attempt: the retries are an implementation detail of a single operation,
   * and the status recorded is the one the caller was given — `error` when the
   * panel never answered at all.
   */
  private async call<T>(op: string, method: string, path: string, body?: unknown): Promise<T> {
    const startedAt = process.hrtime.bigint();
    const done = (status: string) => {
      panelRequestsTotal.inc({ op, status });
      panelRequestDuration.observe({ op }, Number(process.hrtime.bigint() - startedAt) / 1e9);
    };
    try {
      const value = await this.attempt<T>(method, path, body);
      done('200');
      return value;
    } catch (error) {
      done(error instanceof PanelError ? String(error.status) : 'error');
      throw error;
    }
  }

  private async attempt<T>(method: string, path: string, body?: unknown): Promise<T> {
    let lastError: unknown;
    for (let attempt = 0; attempt < (method === 'GET' ? 3 : 1); attempt += 1) {
      try {
        const response = await request(`${this.baseUrl}${path}`, {
          method,
          dispatcher: this.pool,
          headers: {
            authorization: `Bearer ${this.config.apiToken}`,
            // Only with a body: the action routes take none, and a JSON
            // content type with an empty body is refused by a Fastify server
            // (FST_ERR_CTP_EMPTY_JSON_BODY), the panel mock among them.
            ...(body === undefined ? {} : { 'content-type': 'application/json' }),
            'x-forwarded-for': '127.0.0.1',
            'x-forwarded-proto': 'https',
            ...this.config.extraHeaders,
          },
          ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        });
        // `users.delete` answers 204 with no body at all, and a proxy in front
        // of the panel may answer an error with HTML. `body.json()` throws on
        // both, which turns "done" into a failure and hides what went wrong.
        const text = await response.body.text();
        let raw: unknown = null;
        if (text.length > 0) {
          try {
            raw = JSON.parse(text);
          } catch {
            raw = { message: text.slice(0, 200) };
          }
        }
        if (response.statusCode < 200 || response.statusCode >= 300)
          throw panelError(response.statusCode, raw);
        return unwrap(raw) as T;
      } catch (error) {
        lastError = error;
        if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 500));
        else throw error;
      }
    }
    throw lastError;
  }
}

export function createRemnawaveClient(config: PanelConfig): RemnawaveClientImpl {
  return new RemnawaveClientImpl(config);
}

/**
 * The collections of section 10.1 arrive as a page — `{response:{total,
 * <key>:[…]}}` — so `unwrap` leaves the page, not the list. A panel that
 * answers with anything else has changed its contract, and saying so beats an
 * empty array, which an owner reads as "the panel has no squads".
 */
function collection<T>(op: string, key: string, page: unknown): T[] {
  const value =
    typeof page === 'object' && page !== null ? (page as Record<string, unknown>)[key] : undefined;
  if (!Array.isArray(value))
    throw new PanelError('PANEL_CONTRACT', 502, `${op}: the panel returned no \`${key}\` array`);
  return value as T[];
}

function unwrap(value: unknown): unknown {
  return typeof value === 'object' && value !== null && 'response' in value
    ? value.response
    : value;
}

function panelError(status: number, body: unknown): PanelError {
  const value = typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : {};
  const code = typeof value.errorCode === 'string' ? value.errorCode : `HTTP_${String(status)}`;
  const message = typeof value.message === 'string' ? value.message : 'Remnawave request failed';
  return new PanelError(code, status, message);
}
