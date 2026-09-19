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
  uuid: string;
  shortUuid: string;
  username: string;
  status: 'ACTIVE' | 'DISABLED' | 'LIMITED' | 'EXPIRED';
  usedTrafficBytes: number;
  lifetimeUsedTrafficBytes: number;
  trafficLimitBytes: number;
  trafficLimitStrategy: 'NO_RESET' | 'DAY' | 'WEEK' | 'MONTH';
  expireAt: string;
  telegramId: number | null;
  email: string | null;
  description: string | null;
  tag: string | null;
  hwidDeviceLimit: number | null;
  subscriptionUrl: string;
  activeInternalSquads: Array<{ uuid: string; name: string }>;
  onlineAt: string | null;
  firstConnectedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CreateUserInput = Partial<PanelUser> & { username: string; expireAt: string };
export type UpdateUserInput = Partial<PanelUser> & { uuid: string };

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
    getByUuid(uuid: string): Promise<PanelUser | null>;
    getByTelegramId(telegramId: number): Promise<PanelUser[]>;
    getByUsername(username: string): Promise<PanelUser | null>;
    enable(uuid: string): Promise<PanelUser>;
    disable(uuid: string): Promise<PanelUser>;
    resetTraffic(uuid: string): Promise<PanelUser>;
    revokeSubscription(uuid: string): Promise<PanelUser>;
    delete(uuid: string): Promise<void>;
  };
  squads: { list(): Promise<InternalSquad[]> };
  hwid: {
    list(userUuid: string): Promise<HwidDevice[]>;
    remove(userUuid: string, hwid: string): Promise<void>;
  };
}

export class RemnawaveClientImpl implements RemnawaveClient {
  readonly system = {
    stats: () => this.call<PanelStats>('GET', '/api/system/stats'),
    health: () => this.health(),
  };
  readonly users = {
    create: (input: CreateUserInput) => this.call<PanelUser>('POST', '/api/users', input),
    update: (input: UpdateUserInput) => this.call<PanelUser>('PATCH', '/api/users', input),
    getByUuid: (uuid: string) => this.optional<PanelUser>(`/api/users/${encodeURIComponent(uuid)}`),
    getByTelegramId: (telegramId: number) =>
      this.call<PanelUser[]>('GET', `/api/users/by-telegram-id/${String(telegramId)}`),
    getByUsername: (username: string) =>
      this.optional<PanelUser>(`/api/users/by-username/${encodeURIComponent(username)}`),
    enable: (uuid: string) =>
      this.call<PanelUser>('POST', `/api/users/${encodeURIComponent(uuid)}/actions/enable`),
    disable: (uuid: string) =>
      this.call<PanelUser>('POST', `/api/users/${encodeURIComponent(uuid)}/actions/disable`),
    resetTraffic: (uuid: string) =>
      this.call<PanelUser>('POST', `/api/users/${encodeURIComponent(uuid)}/actions/reset-traffic`),
    revokeSubscription: (uuid: string) =>
      this.call<PanelUser>('POST', `/api/users/${encodeURIComponent(uuid)}/actions/revoke`),
    delete: async (uuid: string) => {
      await this.call<unknown>('DELETE', `/api/users/${encodeURIComponent(uuid)}`);
    },
  };
  readonly squads = { list: () => this.call<InternalSquad[]>('GET', '/api/internal-squads') };
  readonly hwid = {
    list: (userUuid: string) =>
      this.call<HwidDevice[]>('GET', `/api/hwid/devices/${encodeURIComponent(userUuid)}`),
    remove: async (userUuid: string, hwid: string) => {
      await this.call('POST', '/api/hwid/devices/delete', { userUuid, hwid });
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
      const stats = await this.call<{ version?: string }>('GET', '/api/system/stats');
      return { ok: true, ...(stats.version ? { version: stats.version } : {}) };
    } catch {
      return { ok: false };
    }
  }

  private async optional<T>(path: string): Promise<T | null> {
    try {
      return await this.call<T>('GET', path);
    } catch (error) {
      if (error instanceof PanelError && error.status === 404) return null;
      throw error;
    }
  }

  private async call<T>(method: string, path: string, body?: unknown): Promise<T> {
    let lastError: unknown;
    for (let attempt = 0; attempt < (method === 'GET' ? 3 : 1); attempt += 1) {
      try {
        const response = await request(`${this.baseUrl}${path}`, {
          method,
          dispatcher: this.pool,
          headers: {
            authorization: `Bearer ${this.config.apiToken}`,
            'content-type': 'application/json',
            'x-forwarded-for': '127.0.0.1',
            'x-forwarded-proto': 'https',
            ...this.config.extraHeaders,
          },
          ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        });
        const raw = await response.body.json();
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
