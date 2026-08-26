import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { Env } from '../config/env.validation';

export async function createAnalyticsReadSource(
  config: ConfigService<Env, true>,
  primary: DataSource,
): Promise<DataSource> {
  const host = config.get('ANALYTICS_DB_HOST', { infer: true });
  if (!host) {
    return primary;
  }
  const replica = new DataSource({
    type: 'postgres',
    name: 'analytics',
    host,
    port:
      config.get('ANALYTICS_DB_PORT', { infer: true }) ??
      config.get('DB_PORT', { infer: true }),
    username:
      config.get('ANALYTICS_DB_USERNAME', { infer: true }) ??
      config.get('DB_USERNAME', { infer: true }),
    password:
      config.get('ANALYTICS_DB_PASSWORD', { infer: true }) ??
      config.get('DB_PASSWORD', { infer: true }),
    database:
      config.get('ANALYTICS_DB_DATABASE', { infer: true }) ??
      config.get('DB_DATABASE', { infer: true }),
    ssl: config.get('DB_SSL', { infer: true })
      ? { rejectUnauthorized: true }
      : false,
  });
  await replica.initialize();
  return replica;
}
