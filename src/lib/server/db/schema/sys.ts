// sys_* — cross-cutting infrastructure. Both tables are append-only (SQLite triggers in drizzle/).
import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

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
		action: text('action', { enum: ['CREATE', 'READ', 'UPDATE', 'EXPORT'] }).notNull(),
		entity: text('entity').notNull(), // table name
		entityId: text('entity_id').notNull(),
		ip: text('ip')
	},
	(t) => [index('sys_audit_log_entity_idx').on(t.entity, t.entityId)]
);
