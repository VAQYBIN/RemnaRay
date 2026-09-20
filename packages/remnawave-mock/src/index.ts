import Fastify, { type FastifyInstance } from 'fastify';

import type { CreateUserInput, PanelUser, UpdateUserInput } from '@remnaray/remnawave-sdk';

export type RemnawaveMock = FastifyInstance & {
  users: Map<number, PanelUser>;
  mode: 'up' | 'down' | 'slow' | '401';
};

export function createRemnawaveMock(): RemnawaveMock {
  const app = Fastify({ logger: false }) as unknown as RemnawaveMock;
  app.users = new Map();
  app.mode = 'up';
  app.addHook('onRequest', async (_request, reply) => {
    if (app.mode === 'down')
      return reply.code(503).send({ message: 'mock down', errorCode: 'MOCK_DOWN' });
    if (app.mode === '401')
      return reply.code(401).send({ message: 'mock unauthorized', errorCode: 'MOCK_401' });
    if (app.mode === 'slow') await new Promise((resolve) => setTimeout(resolve, 100));
  });
  app.get('/api/system/stats', () => ({
    response: { version: 'mock-1', users: app.users.size },
  }));
  // A page, exactly as the panel's own document describes it: the mock exists
  // to catch a client that assumes otherwise, and a bare array here hid a
  // `squads.map is not a function` until a real panel answered.
  app.get('/api/internal-squads', () => ({
    response: {
      total: 1,
      internalSquads: [
        {
          uuid: '01a0b9f0-e699-7032-9841-6d516d4591ad',
          name: 'Default',
          info: { membersCount: 0 },
        },
      ],
    },
  }));
  app.post<{ Body: CreateUserInput }>('/api/users', (request, reply) => {
    const now = new Date().toISOString();
    const user: PanelUser = {
      id: app.users.size + 1,
      shortUuid: crypto.randomUUID().slice(0, 8),
      username: request.body.username,
      status: 'ACTIVE',
      trafficLimitBytes: request.body.trafficLimitBytes ?? 0,
      trafficLimitStrategy: request.body.trafficLimitStrategy ?? 'NO_RESET',
      expireAt: request.body.expireAt,
      telegramId: request.body.telegramId ?? null,
      email: request.body.email ?? null,
      description: request.body.description ?? null,
      tag: request.body.tag ?? null,
      hwidDeviceLimit: request.body.hwidDeviceLimit ?? null,
      vlessUuid: crypto.randomUUID(),
      subscriptionUrl: `https://mock.test/sub/${crypto.randomUUID()}`,
      activeInternalSquads: (request.body.activeInternalSquads ?? []).map((uuid) => ({
        uuid,
        name: uuid,
      })),
      userTraffic: {
        usedTrafficBytes: 0,
        lifetimeUsedTrafficBytes: 0,
        onlineAt: null,
        firstConnectedAt: null,
        lastConnectedNodeUuid: null,
      },
      createdAt: now,
      updatedAt: now,
    };
    app.users.set(user.id, user);
    return reply.code(201).send({ response: user });
  });
  app.patch<{ Body: UpdateUserInput }>('/api/users', (request, reply) =>
    updateUser(app, request.body, reply),
  );
  app.get<{ Params: { id: string } }>('/api/users/:id', (request, reply) => {
    const user = app.users.get(Number(request.params.id));
    return user
      ? reply.send({ response: user })
      : reply.code(404).send({ message: 'not found', errorCode: 'NOT_FOUND' });
  });
  app.get<{ Querystring: { telegramId?: string } }>('/api/users/stream', (request) => ({
    response: {
      users: [...app.users.values()].filter(
        (user) => String(user.telegramId) === String(request.query.telegramId),
      ),
    },
  }));
  app.get<{ Params: { username: string } }>(
    '/api/users/by-username/:username',
    (request, reply) => {
      const user = [...app.users.values()].find(
        (item) => item.username === request.params.username,
      );
      return user
        ? reply.send({ response: user })
        : reply.code(404).send({ message: 'not found', errorCode: 'NOT_FOUND' });
    },
  );
  for (const [action, mutate] of [
    [
      'enable',
      (user: PanelUser) => {
        user.status = 'ACTIVE';
      },
    ],
    [
      'disable',
      (user: PanelUser) => {
        user.status = 'DISABLED';
      },
    ],
    [
      'reset-traffic',
      (user: PanelUser) => {
        user.userTraffic.usedTrafficBytes = 0;
      },
    ],
    [
      'revoke',
      (user: PanelUser) => {
        user.status = 'DISABLED';
        user.shortUuid = crypto.randomUUID().slice(0, 8);
      },
    ],
  ] as const) {
    app.post<{ Params: { id: string } }>(`/api/users/:id/actions/${action}`, (request, reply) => {
      const user = app.users.get(Number(request.params.id));
      if (!user) return reply.code(404).send({ message: 'not found', errorCode: 'NOT_FOUND' });
      mutate(user);
      user.updatedAt = new Date().toISOString();
      return reply.send({ response: user });
    });
  }
  app.delete<{ Params: { id: string } }>('/api/users/:id', (request, reply) => {
    app.users.delete(Number(request.params.id));
    return reply.code(204).send();
  });
  app.get('/api/hwid/devices/:userId', () => ({ response: { total: 0, devices: [] } }));
  app.post('/api/hwid/devices/delete', () => ({ response: { total: 0, devices: [] } }));
  return app;
}

function updateUser(
  app: RemnawaveMock,
  input: UpdateUserInput,
  reply: {
    send: (value: unknown) => unknown;
    code: (status: number) => { send: (value: unknown) => unknown };
  },
) {
  const user = app.users.get(input.id);
  if (!user) return reply.code(404).send({ message: 'not found', errorCode: 'NOT_FOUND' });
  const { activeInternalSquads } = input;
  const fields = Object.fromEntries(
    Object.entries(input).filter(([key]) => key !== 'id' && key !== 'activeInternalSquads'),
  );
  Object.assign(user, fields, {
    ...(activeInternalSquads
      ? { activeInternalSquads: activeInternalSquads.map((uuid) => ({ uuid, name: uuid })) }
      : {}),
    updatedAt: new Date().toISOString(),
  });
  return reply.send({ response: user });
}
