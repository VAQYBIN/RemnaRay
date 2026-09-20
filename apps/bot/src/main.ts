import { createServer } from 'node:http';
import Redis from 'ioredis';
import { metricsContentType, metricsText } from '@remnaray/metrics';
import { ApiClient } from './api-client.js';
import { createBot, registerCommands, type BotRuntime } from './bot.js';
import { BotIngress } from './ingress.js';

const redisUrl = process.env.VALKEY_URL ?? 'redis://valkey:6379/0';
const api = new ApiClient();
const subscriber = new Redis(redisUrl, { lazyConnect: true, maxRetriesPerRequest: 1 });
let runtime: BotRuntime | undefined;
let ingress: BotIngress | undefined;
let activeToken: string | undefined;
let stopping = false;
let configuring = Promise.resolve();
let ready = false;
// Section 20.2: `/metrics` on `:3002` beside the health check. The port is
// `expose`, never published, so the compose network is the only client.
const server = createServer((request, response) => {
  if (request.url?.split('?')[0] === '/metrics') {
    void metricsText().then(
      (text) => {
        response.writeHead(200, { 'content-type': metricsContentType });
        response.end(text);
      },
      () => {
        response.writeHead(500, { 'content-type': 'text/plain' });
        response.end('metrics unavailable\n');
      },
    );
    return;
  }
  response.writeHead(200, { 'content-type': 'application/json' });
  response.end(JSON.stringify({ status: 'ok', service: 'bot', ready }));
});
server.listen(Number(process.env.PORT ?? 3002), '0.0.0.0');

function configure(): Promise<void> {
  configuring = configuring
    .then(async () => {
      if (stopping) return;
      const config = await api.getConfig();
      if (config.token !== activeToken) {
        await ingress?.stop();
        runtime?.redis.disconnect();
        ingress = undefined;
        runtime = undefined;
        activeToken = undefined;
      }
      if (!config.token) {
        ready = false;
        return;
      }
      runtime ??= createBot({ token: config.token, api });
      ingress ??= new BotIngress(runtime.bot, runtime.redis);
      await registerCommands(runtime.bot, config);
      await ingress.start(config);
      activeToken = config.token;
      ready = true;
    })
    .catch(() => {
      ready = false;
      console.error('Bot configuration unavailable; retrying');
    });
  return configuring;
}
subscriber.on('error', () => {
  ready = false;
});
subscriber.on('message', (channel: string) => {
  if (channel === 'rr:i18n.changed') {
    runtime?.i18n.invalidate();
    return;
  }
  void configure();
});
void subscriber
  .subscribe('rr:bot.reconfigure', 'rr:settings.changed', 'rr:i18n.changed')
  .catch(() => {
    console.error('Bot settings subscription unavailable');
  });
void configure();
// Reconcile after missed Pub/Sub messages or an initial API outage.
const timer = setInterval(() => {
  if (!ready) void configure();
}, 2000);

async function shutdown() {
  stopping = true;
  clearInterval(timer);
  await configuring;
  await ingress?.stop();
  runtime?.redis.disconnect();
  subscriber.disconnect();
  server.close();
}
process.once('SIGINT', () => {
  void shutdown();
});
process.once('SIGTERM', () => {
  void shutdown();
});
