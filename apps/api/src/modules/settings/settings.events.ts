import Redis from 'ioredis';

export const SETTINGS_CHANGED_CHANNEL = 'rr:settings.changed';

export type SettingsChangedEvent = {
  keys: string[];
  version: number;
};

export interface SettingsEventBusPort {
  publish(event: SettingsChangedEvent): Promise<void>;
  subscribe(handler: (event: SettingsChangedEvent) => void): Promise<void>;
  close(): Promise<void>;
}

export class RedisSettingsEventBus implements SettingsEventBusPort {
  private readonly publisher: Redis;
  private readonly subscriber: Redis;

  constructor(redisUrl = process.env.VALKEY_URL ?? 'redis://valkey:6379/0') {
    const options = { lazyConnect: true, maxRetriesPerRequest: null };
    this.publisher = new Redis(redisUrl, options);
    this.subscriber = new Redis(redisUrl, options);
  }

  async publish(event: SettingsChangedEvent): Promise<void> {
    await this.publisher.publish(SETTINGS_CHANGED_CHANNEL, JSON.stringify(event));
  }

  async subscribe(handler: (event: SettingsChangedEvent) => void): Promise<void> {
    await this.subscriber.subscribe(SETTINGS_CHANGED_CHANNEL);
    this.subscriber.on('message', (channel, message) => {
      if (channel !== SETTINGS_CHANGED_CHANNEL) return;
      try {
        const event = JSON.parse(message) as SettingsChangedEvent;
        if (Array.isArray(event.keys) && typeof event.version === 'number') handler(event);
      } catch {
        // Invalid pubsub messages are ignored and never invalidate a process-wide cache.
      }
    });
  }

  async close(): Promise<void> {
    await Promise.all([this.publisher.quit(), this.subscriber.quit()]);
  }
}
