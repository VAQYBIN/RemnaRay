import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';

import { afterEach, describe, expect, it } from 'vitest';

import { createRemnawaveClient, PanelError } from './index.js';

type Answer = { status: number; body?: string };

let server: Server | undefined;
let lastPath: string | undefined;
let lastContentType: string | undefined;

/** A panel that answers every request the same way, on a free port. */
async function panel(answer: Answer): Promise<string> {
  server = createServer((request, response) => {
    lastPath = request.url;
    lastContentType = request.headers['content-type'];
    response.writeHead(answer.status, { 'content-type': 'application/json' });
    response.end(answer.body ?? '');
  });
  await new Promise<void>((resolve) => server?.listen(0, '127.0.0.1', resolve));
  return `http://127.0.0.1:${String((server.address() as AddressInfo).port)}`;
}

afterEach(async () => {
  await new Promise<void>((resolve) => {
    if (!server) {
      resolve();
      return;
    }
    server.close(() => {
      resolve();
    });
  });
  server = undefined;
  lastPath = undefined;
});

describe('RemnawaveClient', () => {
  it('declares a JSON body only when it sends one', async () => {
    // The action routes take no body; a Fastify server, the panel mock among
    // them, refuses `application/json` with an empty body.
    const baseUrl = await panel({ status: 200, body: JSON.stringify({ response: {} }) });
    const client = createRemnawaveClient({ baseUrl, apiToken: 'token' });

    await client.users.resetTraffic(42);
    expect(lastPath).toBe('/api/users/42/actions/reset-traffic');
    expect(lastContentType).toBeUndefined();
    await client.users.disable(42);
    expect(lastContentType).toBeUndefined();
    await client.users.revokeSubscription(42);
    expect(lastContentType).toBe('application/json');
    await client.close();
  });

  it('uses a bounded client and exposes panel errors', async () => {
    const client = createRemnawaveClient({
      baseUrl: 'http://127.0.0.1:1',
      apiToken: 'token',
      timeoutMs: 10,
    });
    await expect(client.system.stats()).rejects.toThrow();
    expect(new PanelError('BAD', 400, 'bad').code).toBe('BAD');
    await client.close();
  });

  it('uses the numeric user id and documented Telegram stream filter', async () => {
    const baseUrl = await panel({ status: 200, body: JSON.stringify({ response: { users: [] } }) });
    const client = createRemnawaveClient({ baseUrl, apiToken: 'token' });

    await client.users.getById(42);
    expect(lastPath).toBe('/api/users/42');
    await expect(client.users.getByTelegramId(123)).resolves.toEqual([]);
    expect(lastPath).toBe('/api/users/stream?size=1000&telegramId=123');
    await client.close();
  });

  // Remnawave v3.4.4 answers `GET /api/internal-squads` with
  // `{response:{total,internalSquads:[…]}}`. Reading it as a list is what made
  // the setup wizard report `squads.map is not a function`.
  it('takes the squads out of the page the panel returns', async () => {
    const baseUrl = await panel({
      status: 200,
      body: JSON.stringify({
        response: { total: 1, internalSquads: [{ uuid: 'u-1', name: 'Default' }] },
      }),
    });
    const client = createRemnawaveClient({ baseUrl, apiToken: 'token' });

    await expect(client.squads.list()).resolves.toEqual([{ uuid: 'u-1', name: 'Default' }]);
    await client.close();
  });

  it('takes the devices out of the page the panel returns', async () => {
    const baseUrl = await panel({
      status: 200,
      body: JSON.stringify({ response: { total: 1, devices: [{ hwid: 'h-1' }] } }),
    });
    const client = createRemnawaveClient({ baseUrl, apiToken: 'token' });

    await expect(client.hwid.list(1)).resolves.toEqual([{ hwid: 'h-1' }]);
    await client.close();
  });

  // An empty list and a changed contract are not the same thing, and an owner
  // reads "0 squads" as the first one.
  it('refuses a collection the panel no longer returns', async () => {
    const baseUrl = await panel({ status: 200, body: JSON.stringify({ response: { total: 0 } }) });
    const client = createRemnawaveClient({ baseUrl, apiToken: 'token' });

    await expect(client.squads.list()).rejects.toThrow(/internalSquads/u);
    await client.close();
  });

  // `DELETE /api/users/{id}` answers 204 with nothing at all.
  it('accepts an answer with no body', async () => {
    const baseUrl = await panel({ status: 204 });
    const client = createRemnawaveClient({ baseUrl, apiToken: 'token' });

    await expect(client.users.delete(1)).resolves.toBeUndefined();
    await client.close();
  });

  // A proxy in front of the panel answers with HTML; the message has to say so
  // rather than come out as a JSON parse error.
  it('reports a non-JSON error body as the panel error message', async () => {
    const baseUrl = await panel({ status: 502, body: '<html>Bad gateway</html>' });
    const client = createRemnawaveClient({ baseUrl, apiToken: 'token', timeoutMs: 500 });

    await expect(client.system.stats()).rejects.toThrow(/Bad gateway/u);
    await client.close();
  });
});
