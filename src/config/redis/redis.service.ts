import { Inject, Injectable } from '@nestjs/common';
import { RedisClientType } from 'redis';

@Injectable()
export class RedisService {
  constructor(
    @Inject('REDIS_CLIENT')
    private readonly client: RedisClientType,
  ) {}

  /** Get raw Redis client */
  getClient(): RedisClientType {
    return this.client;
  }

  /** Set a value */
  async set(key: string, value: string, ttlSeconds?: number): Promise<string | null> {
    if (ttlSeconds) {
      return this.client.set(key, value, {
        EX: ttlSeconds,
      });
    }

    return this.client.set(key, value);
  }

  /** Get value */
  async get(key: string): Promise<string | null> {
    return this.client.get(key);
  }

  /** Delete key(s) */
  async del(...keys: string[]): Promise<number> {
    if (!keys.length) return 0;

    return this.client.del(keys);
  }

  /** Acquire lock */
  async acquireLock(key: string, ttlMs = 5000): Promise<boolean> {
    const result = await this.client.set(key, '1', {
      PX: ttlMs,
      NX: true,
    });

    return result === 'OK';
  }

  /** Release lock */
  async releaseLock(key: string): Promise<void> {
    await this.client.del(key);
  }

  /** Get all keys matching pattern */
  async getKeysByPattern(pattern: string): Promise<string[]> {
    const keys: string[] = [];
    let cursor = '0';

    do {
      const result = await this.client.scan(cursor, {
        MATCH: pattern,
        COUNT: 100,
      });

      cursor = result.cursor;
      keys.push(...result.keys);
    } while (cursor !== '0');

    return keys;
  }

  /** Delete keys by pattern */
  async deleteByPattern(pattern: string): Promise<number> {
    const keys = await this.getKeysByPattern(pattern);

    if (keys.length > 0) {
      await this.client.del(keys);
    }

    return keys.length;
  }

  /** Clear all keys */
  async flushAll(): Promise<void> {
    await this.client.flushDb();
  }
}
