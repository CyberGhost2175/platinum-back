import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { Env } from '../config/env.validation';
import { LocationsModule } from '../locations/locations.module';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { AnalyticsQueryService } from './analytics-query.service';
import { AnalyticsExportService } from './analytics-export.service';
import { AnalyticsConnection } from './analytics.connection';
import { createAnalyticsReadSource } from './analytics-read.source';
import { ANALYTICS_DATA_SOURCE } from './analytics.tokens';

@Module({
  imports: [LocationsModule],
  controllers: [AnalyticsController],
  providers: [
    {
      provide: ANALYTICS_DATA_SOURCE,
      inject: [ConfigService, DataSource],
      useFactory: (config: ConfigService<Env, true>, primary: DataSource) =>
        createAnalyticsReadSource(config, primary),
    },
    AnalyticsConnection,
    AnalyticsQueryService,
    AnalyticsService,
    AnalyticsExportService,
  ],
})
export class AnalyticsModule {}
