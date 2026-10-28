// sys_* — cross-cutting infrastructure. sys_event and sys_audit_log are append-only (SQLite triggers).
import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { uuidv7 } from '../../id.ts';
import { person } from './core.ts';

/**
 * Transactional outbox / event log. Rows are written in the same transaction as the change they
 * describe, so an event exists if and only if the change committed. Other school systems read it
 * through GET /api/v1/events?after=<seq> (CloudEvents 1.0 envelope); no message broker needed.
 */
export const event = sqliteTable(
	'sys_event',
	{
		seq: integer('seq').primaryKey({ autoIncrement: true }), // consumer cursor; never reused
		id: text('id').notNull().unique(),
		type: text('type').notNull(), // '<module>.<entity>.<verb>.v<N>'
		subject: text('subject').notNull(), // ID of the entity the event is about
		data: text('data', { mode: 'json' }).notNull(), // thin payload: IDs and status only
		time: integer('time', { mode: 'timestamp_ms' }).notNull()
	},
	(t) => [index('sys_event_type_idx').on(t.type, t.seq)]
);

/** RA 10173 accountability: who viewed or changed personal data, and when. */
export const auditLog = sqliteTable(
	'sys_audit_log',
	{
		seq: integer('seq').primaryKey({ autoIncrement: true }),
		at: integer('at', { mode: 'timestamp_ms' })
			.notNull()
			.$defaultFn(() => new Date()),
		actor: text('actor').notNull(), // staff user ID, 'student:<personId>', or 'integration:<name>'
		action: text('action', {
			enum: ['CREATE', 'READ', 'UPDATE', 'EXPORT', 'LOGIN', 'LOGOUT']
		}).notNull(),
		entity: text('entity').notNull(), // table name
		entityId: text('entity_id').notNull(),
		ip: text('ip')
	},
	(t) => [index('sys_audit_log_entity_idx').on(t.entity, t.entityId)]
);

export const ROLES = ['ADMIN', 'REGISTRAR', 'CASHIER', 'DEAN', 'FACULTY'] as const;
export type Role = (typeof ROLES)[number];

/** Staff login account. The human is a core_person, so a professor's account and class loads match. */
export const user = sqliteTable('sys_user', {
	id: text('id').primaryKey().$defaultFn(uuidv7),
	personId: text('person_id')
		.notNull()
		.unique()
		.references(() => person.id),
	username: text('username').notNull().unique(),
	passwordHash: text('password_hash').notNull(), // scrypt, see auth/password.ts
	roles: text('roles', { mode: 'json' }).$type<Role[]>().notNull(),
	active: integer('active', { mode: 'boolean' }).notNull().default(true),
	mustChangePassword: integer('must_change_password', { mode: 'boolean' }).notNull().default(true),
	lastLoginAt: integer('last_login_at', { mode: 'timestamp_ms' }),
	createdAt: integer('created_at', { mode: 'timestamp_ms' })
		.notNull()
		.$defaultFn(() => new Date())
});

/** Server-side sessions. The cookie holds a random token; only its SHA-256 is stored here. */
export const session = sqliteTable(
	'sys_session',
	{
		idHash: text('id_hash').primaryKey(),
		userId: text('user_id')
			.notNull()
			.references(() => user.id),
		expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
		createdAt: integer('created_at', { mode: 'timestamp_ms' })
			.notNull()
			.$defaultFn(() => new Date())
	},
	(t) => [index('sys_session_user_idx').on(t.userId)]
);
