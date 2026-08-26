import { Inject, Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';
import { REDIS_CLIENT } from './redis.constants';

@Injectable()
export class RedisCacheService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisCacheService.name);

  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async get<T>(key: string): Promise<T | null> {
    const raw = await this.redis.get(key);
    if (raw === null) {
      return null;
    }
    return JSON.parse(raw) as T;
  }

  async getRaw(key: string): Promise<string | null> {
    return this.redis.get(key);
  }

  async incr(key: string): Promise<number> {
    return this.redis.incr(key);
  }

  async setNx(key: string, value: string, ttlSeconds: number): Promise<boolean> {
    const result = await this.redis.set(key, value, 'EX', ttlSeconds, 'NX');
    return result === 'OK';
  }

  async setRaw(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (ttlSeconds && ttlSeconds > 0) {
      await this.redis.set(key, value, 'EX', ttlSeconds);
      return;
    }
    await this.redis.set(key, value);
  }

  async set(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
    const payload = JSON.stringify(value);
    if (ttlSeconds && ttlSeconds > 0) {
      await this.redis.set(key, payload, 'EX', ttlSeconds);
      return;
    }
    await this.redis.set(key, payload);
  }

  async del(key: string): Promise<void> {
    await this.redis.del(key);
  }

  async ping(): Promise<string> {
    return this.redis.ping();
  }

  async onModuleDestroy(): Promise<void> {
    this.logger.log('Disconnecting Redis');
    await this.redis.quit();
  }
}
