// fin_* — student fees only: the fee schedule, each student's assessment, and the official receipts
// the Cashier issues. Not accounting: the LGU Treasurer's books stay the source of truth (docs/scope.md).
// Money is always integer centavos.
import { index, integer, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { uuidv7 } from '../../id.ts';
import { user } from './sys.ts';
import { application } from './enr.ts';
import { program, term } from './ref.ts';

/** One line of the fee schedule for a term. program_code null = applies to every program. */
export const fee = sqliteTable(
	'fin_fee',
	{
		id: text('id').primaryKey().$defaultFn(uuidv7),
		termId: text('term_id')
			.notNull()
			.references(() => term.id),
		programCode: text('program_code').references(() => program.code),
		code: text('code').notNull(), // e.g. 'TUITION', 'LIB'
		label: text('label').notNull(),
		basis: text('basis', { enum: ['PER_UNIT', 'FIXED'] }).notNull(),
		amountCentavos: integer('amount_centavos').notNull(),
		// RA 10931: tuition and listed other school fees are paid by the government for FHE students.
		fheCovered: integer('fhe_covered', { mode: 'boolean' }).notNull(),
		sort: integer('sort').notNull().default(0)
	},
	(t) => [index('fin_fee_term_idx').on(t.termId)]
);

/** Snapshot of what a student owes for one application. Fee changes later never alter it. */
export const assessment = sqliteTable('fin_assessment', {
	applicationId: text('application_id')
		.primaryKey()
		.references(() => application.id),
	units: integer('units').notNull(),
	totalCentavos: integer('total_centavos').notNull(),
	fheCoveredCentavos: integer('fhe_covered_centavos').notNull(),
	netDueCentavos: integer('net_due_centavos').notNull(),
	issuedAt: integer('issued_at', { mode: 'timestamp_ms' }).notNull(),
	issuedBy: text('issued_by')
		.notNull()
		.references(() => user.id)
});

export const assessmentLine = sqliteTable(
	'fin_assessment_line',
	{
		applicationId: text('application_id')
			.notNull()
			.references(() => assessment.applicationId),
		code: text('code').notNull(),
		label: text('label').notNull(),
		amountCentavos: integer('amount_centavos').notNull(),
		fheCovered: integer('fhe_covered', { mode: 'boolean' }).notNull(),
		sort: integer('sort').notNull()
	},
	(t) => [primaryKey({ columns: [t.applicationId, t.code] })]
);

/** A payment the Cashier received, identified by the Treasurer's official receipt (OR) number. */
export const payment = sqliteTable(
	'fin_payment',
	{
		id: text('id').primaryKey().$defaultFn(uuidv7),
		applicationId: text('application_id')
			.notNull()
			.references(() => application.id),
		orNumber: text('or_number').notNull().unique(),
		amountCentavos: integer('amount_centavos').notNull(),
		method: text('method', { enum: ['CASH', 'GCASH', 'LANDBANK', 'OTHER'] }).notNull(),
		paidAt: integer('paid_at', { mode: 'timestamp_ms' }).notNull(),
		receivedBy: text('received_by')
			.notNull()
			.references(() => user.id)
	},
	(t) => [index('fin_payment_application_idx').on(t.applicationId)]
);
