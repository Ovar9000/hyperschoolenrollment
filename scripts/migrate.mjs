#!/usr/bin/env node
// Apply pending migrations without starting the server (the server also does this at startup).
// Same procedure as runMigrations() in src/lib/server/db/index.ts: SQLite ignores
// PRAGMA foreign_keys inside the migration transaction, so switch it off around it and verify.
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';

const file = process.env.DATABASE_URL ?? 'data/enrollment.db';
const client = new Database(file);
client.pragma('journal_mode = WAL');
client.pragma('foreign_keys = OFF');
try {
	migrate(drizzle(client), { migrationsFolder: 'drizzle' });
	const violations = client.pragma('foreign_key_check');
	if (violations.length > 0) {
		console.error('✖ foreign key violations after migration:', violations);
		process.exitCode = 1;
	} else {
		console.log(`✓ ${file} is up to date`);
	}
} finally {
	client.pragma('foreign_keys = ON');
	client.close();
}
