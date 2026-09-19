import { createServer } from 'node:http';

import { Bot } from 'grammy';

const port = Number(process.env.PORT ?? 3002);
const token = process.env.TELEGRAM_BOT_TOKEN;

const healthServer = createServer((_request, response) => {
  response.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify({ status: 'ok', service: 'bot' }));
});

healthServer.listen(port, '0.0.0.0');

let bot: Bot | undefined;
if (token) {
  bot = new Bot(token);
  bot.catch((error: unknown) => {
    console.error('Telegram update failed', error);
  });
  void bot.start().catch((error: unknown) => {
    console.error('Telegram polling failed', error);
  });
}

const shutdown = () => {
  void bot?.stop();
  healthServer.close();
};

process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
