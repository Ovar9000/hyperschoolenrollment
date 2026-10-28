// enr_* — the enrollment module. Owns these tables only; identity lives in core_*.
import { sql } from 'drizzle-orm';
import { check, index, integer, sqliteTable, text, unique } from 'drizzle-orm/sqlite-core';
import { uuidv7 } from '../../id.ts';
import { person } from './core.ts';
import { program, term } from './ref.ts';

export const section = sqliteTable(
	'enr_section',
	{
		id: text('id').primaryKey().$defaultFn(uuidv7),
		termId: text('term_id')
			.notNull()
			.references(() => term.id),
		programCode: text('program_code')
			.notNull()
			.references(() => program.code),
		yearLevel: integer('year_level').notNull(),
		code: text('code').notNull(), // e.g. 'BSIT 1-A'
		units: integer('units').notNull(),
		capacity: integer('capacity').notNull(),
		enrolled: integer('enrolled').notNull().default(0)
	},
	(t) => [
		unique('enr_section_term_code_uq').on(t.termId, t.code),
		index('enr_section_lookup_idx').on(t.termId, t.programCode, t.yearLevel),
		// Defense in depth behind reserveSeat(): the DB itself refuses overbooking.
		check('enr_section_capacity_ck', sql`${t.enrolled} >= 0 AND ${t.enrolled} <= ${t.capacity}`)
	]
);

export const APPLICATION_STATUSES = [
	'SUBMITTED', // mobile intake received
	'PROVISIONAL', // documents uploaded, hardcopies pending (CHED)
	'ASSESSED', // assessment slip issued
	'OFFICIAL', // cashier encoded OR number / FHE tagged
	'CANCELLED'
] as const;

export const application = sqliteTable(
	'enr_application',
	{
		id: text('id').primaryKey().$defaultFn(uuidv7),
		refCode: text('ref_code').notNull().unique(),
		personId: text('person_id')
			.notNull()
			.references(() => person.id),
		termId: text('term_id')
			.notNull()
			.references(() => term.id),
		programCode: text('program_code')
			.notNull()
			.references(() => program.code),
		yearLevel: integer('year_level').notNull(),
		mode: text('mode', { enum: ['BLOCK', 'IRREGULAR'] }).notNull(),
		sectionId: text('section_id').references(() => section.id),
		status: text('status', { enum: APPLICATION_STATUSES }).notNull().default('SUBMITTED'),
		fheStatus: text('fhe_status', {
			enum: ['PENDING', 'FHE_COVERED', 'PAYING_OPT_OUT', 'NOT_APPLICABLE']
		})
			.notNull()
			.default('PENDING'),
		submittedAt: integer('submitted_at', { mode: 'timestamp_ms' })
			.notNull()
			.$defaultFn(() => new Date()),
		updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
			.notNull()
			.$defaultFn(() => new Date())
			.$onUpdateFn(() => new Date())
	},
	(t) => [
		unique('enr_application_person_term_uq').on(t.personId, t.termId),
		index('enr_application_status_idx').on(t.termId, t.status)
	]
);

/** Uploaded document metadata. Files live on disk (UPLOAD_DIR), never as SQLite blobs. */
export const document = sqliteTable(
	'enr_document',
	{
		id: text('id').primaryKey().$defaultFn(uuidv7),
		applicationId: text('application_id')
			.notNull()
			.references(() => application.id),
		kind: text('kind', {
			enum: ['SF9', 'SF10', 'PSA_BIRTH_CERT', 'GOOD_MORAL', 'ID_PHOTO']
		}).notNull(),
		storagePath: text('storage_path').notNull(),
		mime: text('mime').notNull(),
		bytes: integer('bytes').notNull(),
		sha256: text('sha256').notNull(),
		uploadedAt: integer('uploaded_at', { mode: 'timestamp_ms' })
			.notNull()
			.$defaultFn(() => new Date()),
		// CHED: provisional until the Registrar sees the original hardcopy
		hardcopyVerifiedAt: integer('hardcopy_verified_at', { mode: 'timestamp_ms' }),
		hardcopyVerifiedBy: text('hardcopy_verified_by')
	},
	(t) => [index('enr_document_application_idx').on(t.applicationId)]
);
