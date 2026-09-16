import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import * as schema from './schema.ts';

dotenv.config();

declare global {
  var _postgresPool: Pool | undefined;
}

// Function to create or retrieve the connection pool using the Object Method.
export const createPool = () => {
  if (!global._postgresPool) {
    const connectionString = process.env.DATABASE_URL;
    const host = process.env.POSTGRES_HOST || process.env.SQL_HOST || 'localhost';
    const port = Number(process.env.POSTGRES_PORT || process.env.SQL_PORT) || 5432;
    const user = process.env.POSTGRES_USER || process.env.SQL_USER || 'postgres';
    const password = process.env.POSTGRES_PASSWORD || process.env.SQL_PASSWORD || 'postgres';
    const database = process.env.POSTGRES_DB || process.env.SQL_DB_NAME || 'collabpulse_dev';

    const isRemote = host !== 'localhost' && host !== '127.0.0.1' && host !== 'host.docker.internal';
    const useSsl = process.env.POSTGRES_SSL === 'true' || 
                   connectionString?.includes('sslmode=require') || 
                   (process.env.NODE_ENV === 'production' && isRemote);

    const sslConfig = useSsl ? { rejectUnauthorized: false } : undefined;

    const poolConfig = connectionString
      ? {
          connectionString,
          ssl: sslConfig,
          max: Number(process.env.POSTGRES_POOL_MAX) || 15,
          connectionTimeoutMillis: 10000,
        }
      : {
          host,
          port,
          user,
          password,
          database,
          ssl: sslConfig,
          max: Number(process.env.POSTGRES_POOL_MAX) || 15,
          connectionTimeoutMillis: 10000,
        };

    global._postgresPool = new Pool(poolConfig);

    // Prevent unhandled pool-level errors from crashing the application
    global._postgresPool.on('error', (err) => {
      console.error('Unexpected error on idle SQL pool client:', err);
    });
  }
  return global._postgresPool;
};

// Create or retrieve the pool instance.
export const pool = createPool();

// Initialize Drizzle with the pool and schema.
export const db = drizzle(pool, { schema });

