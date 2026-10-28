// ref_* — reference data maintained by the Registrar, read by every module.
import { index, integer, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { uuidv7 } from '../../id.ts';

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
	semester: integer('semester').notNull().default(1), // 1, 2, or 3 (summer)
	startsOn: text('starts_on').notNull(),
	endsOn: text('ends_on').notNull(),
	enrollmentOpen: integer('enrollment_open', { mode: 'boolean' }).notNull().default(false)
});

export const subject = sqliteTable('ref_subject', {
	code: text('code').primaryKey(), // e.g. 'IT 102'
	title: text('title').notNull(),
	lecUnits: integer('lec_units').notNull().default(0),
	labUnits: integer('lab_units').notNull().default(0),
	// Units that count toward the load cap; NSTP/PE may differ from lec+lab.
	creditUnits: integer('credit_units').notNull(),
	active: integer('active', { mode: 'boolean' }).notNull().default(true)
});

export const subjectPrerequisite = sqliteTable(
	'ref_subject_prerequisite',
	{
		subjectCode: text('subject_code')
			.notNull()
			.references(() => subject.code),
		requiresCode: text('requires_code')
			.notNull()
			.references(() => subject.code)
	},
	(t) => [primaryKey({ columns: [t.subjectCode, t.requiresCode] })]
);

/** A program's curriculum version (CHED revises them; old students stay on their version). */
export const curriculum = sqliteTable('ref_curriculum', {
	id: text('id').primaryKey().$defaultFn(uuidv7),
	programCode: text('program_code')
		.notNull()
		.references(() => program.code),
	label: text('label').notNull(), // e.g. 'BSIT 2024 (CMO 25 s. 2015)'
	effectiveAy: integer('effective_ay').notNull(), // first academic year using it, e.g. 2024
	active: integer('active', { mode: 'boolean' }).notNull().default(true)
});

export const curriculumSubject = sqliteTable(
	'ref_curriculum_subject',
	{
		curriculumId: text('curriculum_id')
			.notNull()
			.references(() => curriculum.id),
		subjectCode: text('subject_code')
			.notNull()
			.references(() => subject.code),
		yearLevel: integer('year_level').notNull(),
		semester: integer('semester').notNull()
	},
	(t) => [
		primaryKey({ columns: [t.curriculumId, t.subjectCode] }),
		index('ref_curriculum_subject_slot_idx').on(t.curriculumId, t.yearLevel, t.semester)
	]
);
