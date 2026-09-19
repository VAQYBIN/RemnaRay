import Fastify, { type FastifyInstance } from 'fastify';

import type { CreateUserInput, PanelUser, UpdateUserInput } from '@remnaray/remnawave-sdk';

export type RemnawaveMock = FastifyInstance & {
  users: Map<string, PanelUser>;
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
  app.get('/api/internal-squads', () => ({
    response: [
      { uuid: '01a0b9f0-e699-7032-9841-6d516d4591ad', name: 'Default', info: { membersCount: 0 } },
    ],
  }));
  app.post<{ Body: CreateUserInput }>('/api/users', (request, reply) => {
    const now = new Date().toISOString();
    const user: PanelUser = {
      uuid: crypto.randomUUID(),
      shortUuid: crypto.randomUUID().slice(0, 8),
      username: request.body.username,
      status: 'ACTIVE',
      usedTrafficBytes: 0,
      lifetimeUsedTrafficBytes: 0,
      trafficLimitBytes: request.body.trafficLimitBytes ?? 0,
      trafficLimitStrategy: request.body.trafficLimitStrategy ?? 'NO_RESET',
      expireAt: request.body.expireAt,
      telegramId: request.body.telegramId ?? null,
      email: request.body.email ?? null,
      description: request.body.description ?? null,
      tag: request.body.tag ?? null,
      hwidDeviceLimit: request.body.hwidDeviceLimit ?? null,
      subscriptionUrl: `https://mock.test/sub/${crypto.randomUUID()}`,
      activeInternalSquads: request.body.activeInternalSquads ?? [],
      onlineAt: null,
      firstConnectedAt: null,
      createdAt: now,
      updatedAt: now,
    };
    app.users.set(user.uuid, user);
    return reply.code(201).send({ response: user });
  });
  app.patch<{ Body: UpdateUserInput }>('/api/users', (request, reply) =>
    updateUser(app, request.body, reply),
  );
  app.get<{ Params: { uuid: string } }>('/api/users/:uuid', (request, reply) => {
    const user = app.users.get(request.params.uuid);
    return user
      ? reply.send({ response: user })
      : reply.code(404).send({ message: 'not found', errorCode: 'NOT_FOUND' });
  });
  app.get<{ Params: { telegramId: string } }>(
    '/api/users/by-telegram-id/:telegramId',
    (request) => ({
      response: [...app.users.values()].filter(
        (user) => String(user.telegramId) === request.params.telegramId,
      ),
    }),
  );
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
        user.usedTrafficBytes = 0;
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
    app.post<{ Params: { uuid: string } }>(
      `/api/users/:uuid/actions/${action}`,
      (request, reply) => {
        const user = app.users.get(request.params.uuid);
        if (!user) return reply.code(404).send({ message: 'not found', errorCode: 'NOT_FOUND' });
        mutate(user);
        user.updatedAt = new Date().toISOString();
        return reply.send({ response: user });
      },
    );
  }
  app.delete<{ Params: { uuid: string } }>('/api/users/:uuid', (request, reply) => {
    app.users.delete(request.params.uuid);
    return reply.code(204).send();
  });
  app.get('/api/hwid/devices/:userUuid', () => ({ response: [] }));
  app.post('/api/hwid/devices/delete', (_request, reply) => reply.code(204).send());
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
  const user = app.users.get(input.uuid);
  if (!user) return reply.code(404).send({ message: 'not found', errorCode: 'NOT_FOUND' });
  Object.assign(user, input, { updatedAt: new Date().toISOString() });
  return reply.send({ response: user });
}
