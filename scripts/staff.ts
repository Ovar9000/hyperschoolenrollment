#!/usr/bin/env node
// Staff account management from the server console (until the Admin screens exist).
//
//   npm run staff -- add --username registrar1 --name "Ana Cruz" --roles REGISTRAR
//   npm run staff -- reset --username registrar1
//   npm run staff -- disable --username registrar1
//   npm run staff -- list
//
// New and reset accounts get a one-time temporary password, printed once, which must be changed
// at first sign-in.
import { randomInt } from 'node:crypto';
import { parseArgs } from 'node:util';
import Database from 'better-sqlite3';
import { hashPassword } from '../src/lib/server/auth/password.ts';
import { uuidv7 } from '../src/lib/server/id.ts';

const ROLES = ['ADMIN', 'REGISTRAR', 'CASHIER', 'DEAN', 'FACULTY'];

const { positionals, values } = parseArgs({
	allowPositionals: true,
	options: {
		username: { type: 'string' },
		name: { type: 'string' },
		roles: { type: 'string' }
	}
});

const db = new Database(process.env.DATABASE_URL ?? 'data/enrollment.db');
db.pragma('foreign_keys = ON');
const now = Date.now();

function tempPassword(): string {
	const alphabet = 'abcdefghjkmnpqrstuvwxyz23456789';
	const chars = Array.from({ length: 16 }, () => alphabet[randomInt(alphabet.length)]);
	return [0, 4, 8, 12].map((i) => chars.slice(i, i + 4).join('')).join('-');
}

function audit(userId: string) {
	db.prepare(
		`INSERT INTO sys_audit_log (at, actor, action, entity, entity_id, ip) VALUES (?, 'console', 'UPDATE', 'sys_user', ?, NULL)`
	).run(now, userId);
}

function fail(message: string): never {
	console.error(`✖ ${message}`);
	process.exit(1);
}

const username = values.username?.trim().toLowerCase();

switch (positionals[0]) {
	case 'add': {
		if (!username || !/^[a-z0-9._-]{3,32}$/.test(username))
			fail('--username: 3–32 of a-z 0-9 . _ -');
		const name = values.name?.trim();
		if (!name || !name.includes(' ')) fail('--name "First Last" is required');
		const roles = (values.roles ?? '').toUpperCase().split(',').filter(Boolean);
		if (roles.length === 0 || roles.some((r) => !ROLES.includes(r))) {
			fail(`--roles must be a comma list of ${ROLES.join(', ')}`);
		}
		if (db.prepare('SELECT 1 FROM sys_user WHERE username = ?').get(username)) {
			fail(`username "${username}" already exists`);
		}
		const parts = name.toUpperCase().split(/\s+/);
		const last = parts.pop()!;
		const password = tempPassword();
		const hash = await hashPassword(password);
		const personId = uuidv7();
		const userId = uuidv7();
		db.transaction(() => {
			db.prepare(
				`INSERT INTO core_person (id, last_name, first_name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`
			).run(personId, last, parts.join(' '), now, now);
			db.prepare(
				`INSERT INTO sys_user (id, person_id, username, password_hash, roles, active, must_change_password, created_at)
				 VALUES (?, ?, ?, ?, ?, 1, 1, ?)`
			).run(userId, personId, username, hash, JSON.stringify(roles), now);
			audit(userId);
		})();
		console.log(`✓ created ${username} (${roles.join(', ')})`);
		console.log(`  temporary password: ${password}`);
		console.log('  It is shown only once and must be changed at first sign-in.');
		break;
	}
	case 'reset': {
		const row = db.prepare('SELECT id FROM sys_user WHERE username = ?').get(username) as
			{ id: string } | undefined;
		if (!row) fail(`no user "${username}"`);
		const password = tempPassword();
		const hash = await hashPassword(password);
		db.transaction(() => {
			db.prepare(
				'UPDATE sys_user SET password_hash = ?, must_change_password = 1, active = 1 WHERE id = ?'
			).run(hash, row.id);
			db.prepare('DELETE FROM sys_session WHERE user_id = ?').run(row.id);
			audit(row.id);
		})();
		console.log(`✓ reset ${username}; temporary password: ${password}`);
		break;
	}
	case 'disable': {
		const row = db.prepare('SELECT id FROM sys_user WHERE username = ?').get(username) as
			{ id: string } | undefined;
		if (!row) fail(`no user "${username}"`);
		db.transaction(() => {
			db.prepare('UPDATE sys_user SET active = 0 WHERE id = ?').run(row.id);
			db.prepare('DELETE FROM sys_session WHERE user_id = ?').run(row.id);
			audit(row.id);
		})();
		console.log(`✓ disabled ${username} and signed out all their sessions`);
		break;
	}
	case 'list': {
		const rows = db
			.prepare(
				`SELECT u.username, u.roles, u.active, u.last_login_at, p.first_name, p.last_name
				 FROM sys_user u JOIN core_person p ON p.id = u.person_id ORDER BY u.username`
			)
			.all() as {
			username: string;
			roles: string;
			active: number;
			last_login_at: number | null;
			first_name: string;
			last_name: string;
		}[];
		for (const r of rows) {
			const last = r.last_login_at ? new Date(r.last_login_at).toISOString().slice(0, 16) : 'never';
			console.log(
				`${r.active ? ' ' : '✖'} ${r.username.padEnd(20)} ${JSON.parse(r.roles).join(',').padEnd(22)} ${r.first_name} ${r.last_name} · last sign-in ${last}`
			);
		}
		if (rows.length === 0) console.log('No staff accounts yet.');
		break;
	}
	default:
		console.log(
			'Usage: npm run staff -- <add|reset|disable|list> [--username u] [--name "First Last"] [--roles REGISTRAR,CASHIER]'
		);
}
db.close();
