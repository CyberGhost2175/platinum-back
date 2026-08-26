import { z } from 'zod';

const emptyToUndefined = (value: unknown) =>
  value === '' || value === undefined ? undefined : value;

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(8080),
  API_PREFIX: z.string().default('api'),

  DB_HOST: z.string().min(1),
  DB_PORT: z.coerce.number().int().positive().default(5432),
  DB_USERNAME: z.string().min(1),
  DB_PASSWORD: z.string().min(1),
  DB_DATABASE: z.string().min(1),
  DB_SYNCHRONIZE: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
  DB_LOGGING: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
  DB_SSL: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),

  REDIS_HOST: z.string().min(1),
  REDIS_PORT: z.coerce.number().int().positive().default(6379),
  REDIS_PASSWORD: z.preprocess(emptyToUndefined, z.string().optional()),
  REDIS_DB: z.coerce.number().int().min(0).default(0),

  SESSION_SECRET: z.string().min(16),
  SESSION_NAME: z.string().default('platinum.sid'),
  SESSION_TTL_SECONDS: z.coerce.number().int().positive().default(86400),

  CORS_ORIGINS: z.string().min(1),

  THROTTLE_TTL_MS: z.coerce.number().int().positive().default(60_000),
  THROTTLE_LIMIT: z.coerce.number().int().positive().default(100),

  JWT_ACCESS_SECRET: z.string().min(16),
  JWT_REFRESH_SECRET: z.string().min(16),
  JWT_ACCESS_TTL_SECONDS: z.coerce.number().int().positive().default(900),
  JWT_REFRESH_TTL_SECONDS: z.coerce
    .number()
    .int()
    .positive()
    .default(60 * 60 * 24 * 7),
  PASSWORD_RESET_TTL_SECONDS: z.coerce.number().int().positive().default(900),
  TOTP_ISSUER: z.string().default('Platinum CRM'),
  AUTH_2FA_ENABLED: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),

  STALE_ITEM_DAYS: z.coerce.number().int().positive().default(180),
  LOW_STOCK_THRESHOLD: z.coerce.number().int().positive().default(2),
  CATALOG_SEARCH_DRIVER: z.enum(['postgres', 'elasticsearch']).default('postgres'),
  ELASTICSEARCH_NODE: z.preprocess(emptyToUndefined, z.string().url().optional()),
  ANALYTICS_CACHE_TTL_SECONDS: z.coerce.number().int().positive().default(90),
  ANALYTICS_MV_STALE_SECONDS: z.coerce.number().int().positive().default(60),
  ANALYTICS_DB_HOST: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
  ANALYTICS_DB_PORT: z.coerce.number().int().positive().optional(),
  ANALYTICS_DB_USERNAME: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
  ANALYTICS_DB_PASSWORD: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
  ANALYTICS_DB_DATABASE: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
  DEFAULT_WAREHOUSE_LOCATION_ID: z.preprocess(
    emptyToUndefined,
    z.string().uuid().optional(),
  ),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): Env {
  const parsed = envSchema.safeParse(config);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`Invalid environment variables: ${details}`);
  }
  return parsed.data;
}
