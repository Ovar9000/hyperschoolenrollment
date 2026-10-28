// ref_* — reference data maintained by the Registrar, read by every module.
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const program = sqliteTable('ref_program', {
	code: text('code').primaryKey(), // e.g. 'BSIT'
	name: text('name').notNull(),
	copcNo: text('copc_no'), // CHED Certificate of Program Compliance
	normalYears: integer('normal_years').notNull(), // RA 10931 Maximum Residency = normalYears + 1
	active: integer('active', { mode: 'boolean' }).notNull().default(true)
});

export const term = sqliteTable('ref_term', {
	id: text('id').primaryKey(), // e.g. '2026-1' (AY 2026–2027, 1st semester)
	label: text('label').notNull(),
	startsOn: text('starts_on').notNull(),
	endsOn: text('ends_on').notNull(),
	enrollmentOpen: integer('enrollment_open', { mode: 'boolean' }).notNull().default(false)
});
