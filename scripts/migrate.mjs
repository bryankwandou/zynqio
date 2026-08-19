#!/usr/bin/env node
/**
 * scripts/migrate.mjs — penerap migrasi Postgres.
 *
 * Menjalankan berkas .sql di db/migrations secara berurutan, satu kali
 * masing-masing, dan mencatat yang sudah terpakai di tabel schema_migrations.
 * Tiap berkas dibungkus satu transaksi: gagal di tengah berarti tidak ada
 * yang tersisa setengah jadi.
 *
 * Pakai:
 *   node scripts/migrate.mjs           menerapkan yang belum terpakai
 *   node scripts/migrate.mjs --status  hanya menampilkan keadaan
 */

import { readdir, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const HERE = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(HERE, '..', 'db', 'migrations');

// Migrasi DDL menuntut sambungan langsung. Lewat pgbouncer, pernyataan
// seperti CREATE EXTENSION dan blok transaksi panjang bisa bermasalah.
const connectionString =
  process.env.DATABASE_URL_UNPOOLED ||
  process.env.POSTGRES_URL_NON_POOLING ||
  process.env.DATABASE_URL;

if (!connectionString) {
  console.error('DATABASE_URL_UNPOOLED atau DATABASE_URL belum diisi.');
  process.exit(1);
}

const statusOnly = process.argv.includes('--status');

const client = new pg.Client({
  connectionString,
  ssl: { rejectUnauthorized: false },
  // Neon menidurkan compute saat menganggur; sambungan pertama perlu waktu.
  connectionTimeoutMillis: 30_000,
  statement_timeout: 120_000,
});

function sha256(text) {
  return createHash('sha256').update(text).digest('hex').slice(0, 16);
}

async function main() {
  await client.connect();

  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename    text PRIMARY KEY,
      checksum    text NOT NULL,
      applied_at  timestamptz NOT NULL DEFAULT now()
    )
  `);

  const files = (await readdir(MIGRATIONS_DIR))
    .filter((f) => f.endsWith('.sql'))
    .sort();

  const { rows } = await client.query('SELECT filename, checksum FROM schema_migrations');
  const applied = new Map(rows.map((r) => [r.filename, r.checksum]));

  let ran = 0;

  for (const file of files) {
    const sql = await readFile(join(MIGRATIONS_DIR, file), 'utf8');
    const checksum = sha256(sql);
    const previous = applied.get(file);

    if (previous) {
      // Migrasi yang sudah terpakai lalu diedit adalah tanda bahaya:
      // basis data lain sudah menjalankan versi yang berbeda.
      const mark = previous === checksum ? 'ok' : 'BERUBAH SETELAH DIPAKAI';
      console.log(`  [lewati] ${file} — ${mark}`);
      if (previous !== checksum) process.exitCode = 1;
      continue;
    }

    if (statusOnly) {
      console.log(`  [menunggu] ${file}`);
      continue;
    }

    process.stdout.write(`  [jalan]  ${file} ... `);
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query(
        'INSERT INTO schema_migrations (filename, checksum) VALUES ($1, $2)',
        [file, checksum]
      );
      await client.query('COMMIT');
      console.log('selesai');
      ran++;
    } catch (err) {
      await client.query('ROLLBACK');
      console.log('gagal');
      console.error(`\n${file} ditolak:\n  ${err.message}\n`);
      throw err;
    }
  }

  if (!statusOnly) {
    console.log(ran === 0 ? '\nTidak ada migrasi baru.' : `\n${ran} migrasi diterapkan.`);
  }

  const summary = await client.query(`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    ORDER BY table_name
  `);
  console.log(`Tabel sekarang (${summary.rowCount}): ${summary.rows.map((r) => r.table_name).join(', ')}`);
}

main()
  .catch((err) => {
    console.error(err.message);
    process.exitCode = 1;
  })
  .finally(() => client.end());
