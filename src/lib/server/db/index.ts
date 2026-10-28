import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { DATABASE_URL } from '$app/env/private';
import * as schema from './schema/index.ts';

mkdirSync(dirname(DATABASE_URL), { recursive: true });

const client = new Database(DATABASE_URL);
client.pragma('journal_mode = WAL'); // readers never block the writer
client.pragma('synchronous = NORMAL'); // safe with WAL, much faster commits
client.pragma('busy_timeout = 5000');
client.pragma('foreign_keys = ON');

export const db = drizzle(client, { schema });
export type DB = typeof db;
export type Tx = Parameters<Parameters<DB['transaction']>[0]>[0];

/**
 * Drizzle runs migrations inside a transaction, where SQLite ignores `PRAGMA foreign_keys`, so a
 * table rebuild (how SQLite alters a column) fails on any database that already has rows.
 * SQLite's documented procedure: switch FKs off outside the transaction, migrate, verify, re-enable.
 */
export function runMigrations() {
	client.pragma('foreign_keys = OFF');
	try {
		migrate(db, { migrationsFolder: 'drizzle' });
		const violations = client.pragma('foreign_key_check') as unknown[];
		if (violations.length > 0) {
			throw new Error(`Migration left ${violations.length} foreign key violation(s); not starting`);
		}
	} finally {
		client.pragma('foreign_keys = ON');
	}
}

export function closeDb() {
	client.pragma('wal_checkpoint(TRUNCATE)');
	client.close();
}
