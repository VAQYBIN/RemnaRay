import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';

export type MockUpdate = { update_id: number; [key: string]: unknown };
export type TelegramMockOptions = {
  token?: string;
  user?: { id: number; first_name: string; username: string };
};

export class TelegramMock {
  readonly token: string;
  readonly calls: Array<{ method: string; payload: Record<string, unknown> }> = [];
  readonly sentMessages: Array<{ chatId: number; text: string }> = [];
  private readonly user: { id: number; first_name: string; username: string };
  private readonly updates: MockUpdate[] = [];
  private nextUpdate = 0;
  private nextMessage = 1;
  private server: Server | undefined;
  private port = 0;
  private webhookUrl: string | undefined;
  private failure: { code: 403 | 429; retryAfter?: number } | undefined;

  constructor(options: TelegramMockOptions = {}) {
    this.token = options.token ?? '123456:telegram-mock';
    this.user = options.user ?? { id: 999, first_name: 'Mock Bot', username: 'remnaray_mock_bot' };
  }

  async start(): Promise<string> {
    this.server = createServer((request, response) => {
      void this.handle(request, response);
    });
    const server = this.server;
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    this.port = typeof address === 'object' && address ? address.port : 0;
    return this.apiRoot;
  }

  get apiRoot(): string {
    return `http://127.0.0.1:${String(this.port)}`;
  }

  async stop(): Promise<void> {
    if (!this.server) return;
    const server = this.server;
    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) reject(error);
        else resolve();
      });
    });
    this.server = undefined;
  }

  push(update: Omit<MockUpdate, 'update_id'> & { update_id?: number }): MockUpdate {
    const value = { ...update, update_id: update.update_id ?? this.nextUpdate++ };
    this.updates.push(value);
    return value;
  }

  failNext(code: 403 | 429, retryAfter?: number): void {
    this.failure = { code, ...(retryAfter === undefined ? {} : { retryAfter }) };
  }

  deliver(update: MockUpdate, secretToken?: string): Promise<Response> {
    if (!this.webhookUrl) throw new Error('Webhook is not configured');
    return fetch(this.webhookUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(secretToken ? { 'x-telegram-bot-api-secret-token': secretToken } : {}),
      },
      body: JSON.stringify(update),
    });
  }

  private async handle(request: IncomingMessage, response: ServerResponse): Promise<void> {
    const method = request.url?.split('/').pop() ?? '';
    const payload = await readJson(request);
    this.calls.push({ method, payload });
    if (this.failure) {
      const failure = this.failure;
      this.failure = undefined;
      response.writeHead(failure.code, { 'content-type': 'application/json' });
      response.end(
        JSON.stringify({
          ok: false,
          error_code: failure.code,
          description: 'mock failure',
          parameters: failure.retryAfter ? { retry_after: failure.retryAfter } : {},
        }),
      );
      return;
    }
    if (method === 'getMe') {
      this.ok(response, this.user);
      return;
    }
    if (method === 'setWebhook') {
      this.webhookUrl = typeof payload.url === 'string' ? payload.url : undefined;
      this.ok(response, true);
      return;
    }
    if (method === 'deleteWebhook') {
      this.webhookUrl = undefined;
      this.ok(response, true);
      return;
    }
    if (method === 'getUpdates') {
      const offset = typeof payload.offset === 'number' ? payload.offset : 0;
      this.ok(response, this.updates.filter((update) => update.update_id >= offset).slice(0, 100));
      return;
    }
    if (method === 'sendMessage') {
      const chatId = Number(payload.chat_id);
      const text = typeof payload.text === 'string' ? payload.text : '';
      this.sentMessages.push({ chatId, text });
      this.ok(response, { message_id: this.nextMessage++, chat: { id: chatId }, text });
      return;
    }
    if (
      method === 'answerCallbackQuery' ||
      method === 'answerPreCheckoutQuery' ||
      method === 'setMyCommands'
    ) {
      this.ok(response, true);
      return;
    }
    // Bot API 10.3: `createInvoiceLink` returns the link as a string.
    if (method === 'createInvoiceLink') {
      this.ok(response, `https://t.me/$mock_invoice_${String(this.nextMessage++)}`);
      return;
    }
    if (method === 'sendInvoice') {
      const chatId = Number(payload.chat_id);
      this.ok(response, {
        message_id: this.nextMessage++,
        date: Math.floor(Date.now() / 1000),
        chat: { id: chatId, type: 'private' },
        invoice: {
          title: payload.title,
          description: payload.description,
          start_parameter: payload.start_parameter ?? '',
          currency: payload.currency,
          total_amount: Array.isArray(payload.prices)
            ? (payload.prices as Array<{ amount: number }>).reduce(
                (sum, price) => sum + price.amount,
                0,
              )
            : 0,
        },
      });
      return;
    }
    this.ok(response, {
      message_id: this.nextMessage++,
      date: Math.floor(Date.now() / 1000),
      chat: { id: Number(payload.chat_id), type: 'private' },
    });
  }

  private ok(response: ServerResponse, result: unknown): void {
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ ok: true, result }));
  }
}

async function readJson(request: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    if (typeof chunk === 'string') chunks.push(Buffer.from(chunk));
    else if (chunk instanceof Uint8Array) chunks.push(Buffer.from(chunk));
  }
  if (chunks.length === 0) return {};
  const parsed = JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
  return typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>) : {};
}
