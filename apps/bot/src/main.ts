import { createServer } from 'node:http';
import Redis from 'ioredis';

import { createBot, registerCommands } from './bot.js';
import { BotIngress } from './ingress.js';
import type { BotConfig } from './types.js';

const port = Number(process.env.PORT ?? 3002);
const token = process.env.TELEGRAM_BOT_TOKEN;
const runtime = createBot({ ...(token ? { token } : {}) });
const ingress = new BotIngress(runtime.bot, runtime.redis);
const settingsSubscriber = new Redis(process.env.VALKEY_URL ?? 'redis://valkey:6379/0', {
  lazyConnect: true,
  maxRetriesPerRequest: null,
});

const healthServer = createServer((_request, response) => {
  response.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify({ status: 'ok', service: 'bot' }));
});

healthServer.listen(port, '0.0.0.0');

if (token) {
  void runtime.api
    .getConfig()
    .then(async (config: BotConfig) => {
      await registerCommands(runtime.bot, config);
      await ingress.start(config);
      await settingsSubscriber.subscribe('rr:settings.changed');
      settingsSubscriber.on('message', (channel, message) => {
        if (channel !== 'rr:settings.changed') return;
        const event = JSON.parse(message) as { keys?: string[] };
        if (!event.keys?.some((key) => key.startsWith('bot.') || key.startsWith('domain.'))) return;
        void runtime.api
          .getConfig()
          .then(async (nextConfig) => {
            await registerCommands(runtime.bot, nextConfig);
            await ingress.start(nextConfig);
          })
          .catch((error: unknown) => {
            console.error('Telegram reconfigure failed', error);
          });
      });
    })
    .catch((error: unknown) => {
      console.error('Telegram ingress failed', error);
    });
}

const shutdown = () => {
  void ingress.stop();
  void runtime.redis.quit();
  void settingsSubscriber.quit();
  healthServer.close();
};

process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
