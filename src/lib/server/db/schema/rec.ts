// rec_* — the student record (Registrar's system of record). A person becomes a student here;
// grades (Phase 3) and transcripts (Phase 4) attach to this table, not to enrollment applications.
import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { person } from './core.ts';
import { curriculum, program, term } from './ref.ts';

export const student = sqliteTable(
	'rec_student',
	{
		personId: text('person_id')
			.primaryKey()
			.references(() => person.id),
		studentNo: text('student_no').notNull().unique(), // e.g. '2026-00123', issued when OFFICIAL
		programCode: text('program_code')
			.notNull()
			.references(() => program.code),
		curriculumId: text('curriculum_id')
			.notNull()
			.references(() => curriculum.id),
		admitTermId: text('admit_term_id')
			.notNull()
			.references(() => term.id),
		status: text('status', { enum: ['ACTIVE', 'LOA', 'GRADUATED', 'WITHDRAWN', 'DISMISSED'] })
			.notNull()
			.default('ACTIVE'),
		createdAt: integer('created_at', { mode: 'timestamp_ms' })
			.notNull()
			.$defaultFn(() => new Date())
	},
	(t) => [index('rec_student_program_idx').on(t.programCode, t.status)]
);

/** Per-year counter for student numbers; incremented atomically with UPDATE … RETURNING. */
export const studentNoCounter = sqliteTable('rec_student_no_counter', {
	year: integer('year').primaryKey(),
	last: integer('last').notNull().default(0)
});
