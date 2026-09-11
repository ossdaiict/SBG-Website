import dotenv from 'dotenv';
import path from 'path';
import { Pool, type PoolClient } from 'pg';

dotenv.config({ path: path.join(__dirname, '../.env') });

const databaseUrlRaw = process.env.DATABASE_URL;

if (!databaseUrlRaw) {
  console.error('DATABASE_URL is missing from server/.env');
}

const databaseUrl = databaseUrlRaw?.replace(/([?&])sslmode=[^&]*&?/g, '$1').replace(/[?&]$/, '') || '';

if (!process.env.JWT_SECRET) {
  console.error('JWT_SECRET is missing from server/.env');
}

export const db = new Pool({
  connectionString: databaseUrl,
  ssl: databaseUrl?.includes('localhost') ? false : { rejectUnauthorized: false },
  max: 15,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 30000, // 30s to handle Neon/Cloud PostgreSQL cold-start wakeups
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000,
});

// Catch idle client errors so they don't crash the Node.js process
// The pg Pool will automatically remove and replace the faulty client on the next query
db.on('error', (err, _client) => {
  console.error('Unexpected error on idle database client', err);
});

export async function withTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // The original error is more useful than a rollback failure.
    }
    throw err;
  } finally {
    client.release();
  }
}
