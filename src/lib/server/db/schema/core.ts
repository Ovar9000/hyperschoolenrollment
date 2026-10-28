// core_* — person identity shared by every current and future school system.
// Enrollment is the *intake* for these tables; other modules (grades, finance, library, LMS sync)
// reference core_person.id and must never duplicate these columns.
import { index, integer, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { uuidv7 } from '../../id.ts';

const timestamps = {
	createdAt: integer('created_at', { mode: 'timestamp_ms' })
		.notNull()
		.$defaultFn(() => new Date()),
	updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
		.notNull()
		.$defaultFn(() => new Date())
		.$onUpdateFn(() => new Date())
};

export const person = sqliteTable('core_person', {
	id: text('id').primaryKey().$defaultFn(uuidv7),
	// PSA-format name parts, stored exactly as on the birth certificate / PhilSys
	lastName: text('last_name').notNull(),
	firstName: text('first_name').notNull(),
	middleName: text('middle_name'),
	suffix: text('suffix'),
	// Required by the student intake form; optional at DB level because faculty and staff are
	// people too and we don't collect these for them.
	sexAtBirth: text('sex_at_birth', { enum: ['M', 'F'] }),
	birthdate: text('birthdate'), // ISO YYYY-MM-DD
	mobile: text('mobile'),
	email: text('email'),
	...timestamps
});

/**
 * External identifiers, one row per (scheme, value). This is the join point for other systems:
 * DepEd LRN today; student number, CHED HEMIS ID, LMS/SSO subject IDs later. Add schemes, never columns.
 */
export const IDENTIFIER_SCHEMES = ['LRN', 'STUDENT_NO', 'HEMIS', 'SSO_SUBJECT'] as const;

export const personIdentifier = sqliteTable(
	'core_person_identifier',
	{
		scheme: text('scheme', { enum: IDENTIFIER_SCHEMES }).notNull(),
		value: text('value').notNull(),
		personId: text('person_id')
			.notNull()
			.references(() => person.id),
		createdAt: timestamps.createdAt
	},
	(t) => [
		primaryKey({ columns: [t.scheme, t.value] }),
		index('core_person_identifier_person_idx').on(t.personId)
	]
);

export const address = sqliteTable(
	'core_address',
	{
		personId: text('person_id')
			.notNull()
			.references(() => person.id),
		kind: text('kind', { enum: ['PERMANENT', 'CURRENT'] }).notNull(),
		// PSGC codes (PSA Philippine Standard Geographic Code), required by CHED HEMIS
		psgcBarangay: text('psgc_barangay'),
		psgcCityMun: text('psgc_city_mun'),
		psgcProvince: text('psgc_province'),
		line: text('line'), // house no. / street / purok
		...timestamps
	},
	(t) => [primaryKey({ columns: [t.personId, t.kind] })]
);

/** RA 10173 consent record. Stored before (in the same transaction as) any other personal data. */
export const consent = sqliteTable(
	'core_consent',
	{
		id: text('id').primaryKey().$defaultFn(uuidv7),
		personId: text('person_id')
			.notNull()
			.references(() => person.id),
		purpose: text('purpose', { enum: ['ENROLLMENT_PROCESSING'] }).notNull(),
		noticeVersion: text('notice_version').notNull(),
		guardianName: text('guardian_name'), // required when the student is under 18
		grantedAt: integer('granted_at', { mode: 'timestamp_ms' })
			.notNull()
			.$defaultFn(() => new Date()),
		revokedAt: integer('revoked_at', { mode: 'timestamp_ms' })
	},
	(t) => [index('core_consent_person_idx').on(t.personId)]
);
