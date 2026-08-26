import 'reflect-metadata';
import 'dotenv/config';
import { DataSource } from 'typeorm';
import { validateEnv } from '../config/env.validation';
import { typeOrmDataSourceOptions } from './typeorm.config';

const env = validateEnv(process.env);

export default new DataSource(
  typeOrmDataSourceOptions({
    host: env.DB_HOST,
    port: env.DB_PORT,
    username: env.DB_USERNAME,
    password: env.DB_PASSWORD,
    database: env.DB_DATABASE,
    ssl: env.DB_SSL,
    logging: env.DB_LOGGING,
  }),
);
