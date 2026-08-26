import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { HealthCheck, HealthCheckService, TypeOrmHealthIndicator } from '@nestjs/terminus';
import { SkipThrottle } from '@nestjs/throttler';
import { Public } from '../common/decorators/public.decorator';
import { RedisHealthIndicator } from '../common/redis/redis.health';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly db: TypeOrmHealthIndicator,
    private readonly redis: RedisHealthIndicator,
  ) {}

  @Get()
  @Public()
  @SkipThrottle()
  @HealthCheck()
  @ApiOperation({ summary: 'Проверка Postgres и Redis' })
  @ApiOkResponse({ description: 'Сервисы доступны' })
  check() {
    return this.health.check([
      () => this.db.pingCheck('postgres'),
      () => this.redis.isHealthy('redis'),
    ]);
  }
}
