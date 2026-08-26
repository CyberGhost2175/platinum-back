import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TerminusModule } from '@nestjs/terminus';
import Redis from 'ioredis';
import { Env } from '../../config/env.validation';
import { REDIS_CLIENT } from './redis.constants';
import { RedisCacheService } from './redis-cache.service';
import { RedisHealthIndicator } from './redis.health';

@Global()
@Module({
  imports: [TerminusModule],
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => {
        const password = config.get('REDIS_PASSWORD', { infer: true });
        return new Redis({
          host: config.get('REDIS_HOST', { infer: true }),
          port: config.get('REDIS_PORT', { infer: true }),
          password: password || undefined,
          db: config.get('REDIS_DB', { infer: true }),
          maxRetriesPerRequest: 3,
          enableReadyCheck: true,
        });
      },
    },
    RedisCacheService,
    RedisHealthIndicator,
  ],
  exports: [REDIS_CLIENT, RedisCacheService, RedisHealthIndicator],
})
export class RedisModule {}
