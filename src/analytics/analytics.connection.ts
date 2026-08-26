import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ANALYTICS_DATA_SOURCE } from './analytics.tokens';

@Injectable()
export class AnalyticsConnection implements OnModuleDestroy {
  constructor(
    @InjectDataSource()
    readonly write: DataSource,
    @Inject(ANALYTICS_DATA_SOURCE)
    readonly read: DataSource,
  ) {}

  async onModuleDestroy(): Promise<void> {
    if (this.read !== this.write && this.read.isInitialized) {
      await this.read.destroy();
    }
  }
}
