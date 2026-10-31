import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { createClient } from 'redis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private readonly client;

  constructor(config: ConfigService) {
    this.client = createClient({
      socket: {
        host: config.getOrThrow<string>('REDIS_HOST'),
        port: config.getOrThrow<number>('REDIS_PORT'),
        connectTimeout: 5000,
        reconnectStrategy: (retries) =>
          retries >= 5
            ? new Error('Redis connection retries exhausted')
            : Math.min(100 * 2 ** retries, 2000),
      },
      username: config.get<string>('REDIS_USERNAME') || undefined,
      password: config.get<string>('REDIS_PASSWORD') || undefined,
      disableOfflineQueue: true,
    });
    this.client.on('error', (error: Error) => this.logger.error(error.message));
  }

  async onModuleInit() {
    await this.client.connect();
  }
  onModuleDestroy() {
    if (this.client.isOpen) this.client.destroy();
  }
  getClient() {
    return this.client;
  }
  ping() {
    return this.client.ping();
  }
  get(key: string) {
    return this.client.get(key);
  }
  set(key: string, value: string, ttlSeconds?: number) {
    return this.client.set(key, value, ttlSeconds === undefined ? {} : { EX: ttlSeconds });
  }
  async del(...keys: string[]) {
    return keys.length ? this.client.del(keys) : 0;
  }

  async consumeRateLimit(key: string, windowSeconds: number) {
    const result = (await this.client.eval(
      "local count = redis.call('incr', KEYS[1]); if count == 1 then redis.call('expire', KEYS[1], ARGV[1]) end; return {count, redis.call('ttl', KEYS[1])}",
      { keys: [key], arguments: [String(windowSeconds)] },
    )) as [number, number];
    return { count: result[0], ttl: result[1] };
  }

  /** Return an ownership token. Release must present the same token. */
  async acquireLock(key: string, ttlMs = 5000): Promise<string | null> {
    const token = randomUUID();
    const acquired = await this.client.set(key, token, { PX: ttlMs, NX: true });
    return acquired ? token : null;
  }
  async releaseLock(key: string, token: string): Promise<boolean> {
    const result = await this.client.eval(
      "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end",
      { keys: [key], arguments: [token] },
    );
    return result === 1;
  }
}
