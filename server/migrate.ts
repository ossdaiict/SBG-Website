import crypto from 'crypto';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { Client } from 'pg';

dotenv.config();

function sha256(content: string): string {
  const normalized = content.replace(/\r\n/g, '\n');
  return crypto.createHash('sha256').update(normalized, 'utf8').digest('hex');
}

// ── Resync checksums (e.g. after line-ending normalization) ──────────
async function resyncChecksums() {
  const client = createClient();
  await client.connect();
  try {
    await ensureMigrationsTable(client);
    const { rows } = await client.query('SELECT version FROM schema_migrations');
    const appliedVersions = new Set(rows.map((r: any) => r.version));
    const migrationsDir = path.join(__dirname, 'migrations');
    const files = fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort();
    let updated = 0;
    for (const file of files) {
      if (!appliedVersions.has(file)) continue;
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      const checksum = sha256(sql);
      await client.query('UPDATE schema_migrations SET checksum = $1 WHERE version = $2', [checksum, file]);
      console.log(`  ✓ Resynced: ${file}`);
      updated++;
    }
    console.log(`\nResynced ${updated} checksum(s). Run migrations normally now.`);
  } finally {
    await client.end();
  }
}

function createClient(): Client {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('DATABASE_URL is required');
    process.exit(1);
  }
  const databaseUrl = connectionString.replace(/([?&])sslmode=[^&]*&?/g, '$1').replace(/[?&]$/, '');

  return new Client({
    connectionString: databaseUrl,
    ssl: databaseUrl.includes('localhost') ? false : { rejectUnauthorized: false },
  });
}
// ── Schema bootstrap ────────────────────────────────────────────────

async function ensureMigrationsTable(client: Client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version VARCHAR(255) PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  // Add the checksum column if it doesn't exist (upgrade path for existing DBs)
  const colCheck = await client.query(`
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'schema_migrations' AND column_name = 'checksum'
  `);
  if (colCheck.rows.length === 0) {
    await client.query(`ALTER TABLE schema_migrations ADD COLUMN checksum VARCHAR(64)`);
    console.log('  Added checksum column to schema_migrations');
  }
}

// ── Migration ───────────────────────────────────────────────────────
async function migrate() {
  const client = createClient();
  await client.connect();

  try {
    await ensureMigrationsTable(client);

    const { rows } = await client.query('SELECT version, checksum FROM schema_migrations');
    const appliedMigrations = new Map<string, string | null>(
      rows.map((r: any) => [r.version, r.checksum])
    );

    const migrationsDir = path.join(__dirname, 'migrations');
    const files = fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort();

    // ── Phase 1: Verify checksums of all applied migrations BEFORE running anything ──
    const tamperedFiles: string[] = [];

    for (const file of files) {
      if (!appliedMigrations.has(file)) continue;

      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      const checksum = sha256(sql);
      const storedChecksum = appliedMigrations.get(file);

      if (storedChecksum && storedChecksum !== checksum) {
        console.error(`  ✗ CHECKSUM MISMATCH: ${file}`);
        console.error(`    stored:  ${storedChecksum}`);
        console.error(`    current: ${checksum}`);
        tamperedFiles.push(file);
      } else if (!storedChecksum) {
        // Backfill checksum for migrations applied before checksums were added
        await client.query(
          'UPDATE schema_migrations SET checksum = $1 WHERE version = $2',
          [checksum, file]
        );
        console.log(`  Backfilled checksum: ${file}`);
      }
    }

    if (tamperedFiles.length > 0) {
      console.error(
        `\nABORTING: ${tamperedFiles.length} applied migration(s) have been modified on disk.\n` +
        `   This may indicate tampering, accidental edits, or an incomplete merge.\n` +
        `   Affected: ${tamperedFiles.join(', ')}\n` +
        `   If the change is intentional (e.g. line-ending normalization), run:\n` +
        `     docker compose -f docker-compose/docker-compose.yml --profile migrate run --rm migrate node migrate.js --resync-checksums\n` +
        `   Then re-run migrations normally.`
      );
      process.exit(1);
    }

    // ── Phase 2: Apply pending migrations ────────────────────────────
    for (const file of files) {
      if (appliedMigrations.has(file)) {
        console.log(`Skipping applied migration: ${file}`);
        continue;
      }

      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      const checksum = sha256(sql);
      console.log(`Running migration: ${file}`);
      
      try {
        await client.query('BEGIN');
        await client.query(sql);
        await client.query(
          'INSERT INTO schema_migrations (version, checksum) VALUES ($1, $2)',
          [file, checksum]
        );
        await client.query('COMMIT');
        console.log(`  ✓ ${file}`);
      } catch (err) {
        await client.query('ROLLBACK');
        console.error(`  ✗ Failed ${file}:`, err);
        throw err;
      }
    }

    console.log('All migrations complete.');
  } finally {
    await client.end();
  }
}

// ── Entrypoint ──────────────────────────────────────────────────────
const args = process.argv.slice(2);
if (args.includes('--resync-checksums')) {
  resyncChecksums().catch((err) => {
    console.error('Resync failed:', err);
    process.exit(1);
  });
} else {
  migrate().catch((err) => {
    console.error('Migration failed:', err);
    process.exit(1);
  });
}