import { fail, redirect } from '@sveltejs/kit';
import { and, asc, eq } from 'drizzle-orm';
import { db } from '#lib/server/db/index.ts';
import {
	application,
	consent,
	person,
	personIdentifier,
	program,
	term
} from '#lib/server/db/schema/index.ts';
import { reserveFirstOpenBlock } from '#lib/server/enrollment/reserve-seat.ts';
import { audit, emitEvent } from '#lib/server/events.ts';
import { refCode, uuidv7 } from '#lib/server/id.ts';
import { ageOn, isLrn, normalizeMobile, normalizeName, todayInManila } from '#lib/validation.ts';
import { FIELDS, NOTICE_VERSION, type Field, type FormErrors } from './fields.ts';
import type { Actions, PageServerLoad } from './$types';

function openTerm() {
	return db.select().from(term).where(eq(term.enrollmentOpen, true)).get();
}

export const load: PageServerLoad = () => {
	const t = openTerm();
	return {
		term: t ? { id: t.id, label: t.label } : null,
		programs: db
			.select({ code: program.code, name: program.name })
			.from(program)
			.where(eq(program.active, true))
			.orderBy(asc(program.code))
			.all(),
		today: todayInManila()
	};
};

class LrnTaken extends Error {}

export const actions = {
	default: async ({ request, getClientAddress }) => {
		const formData = await request.formData();
		const values = Object.fromEntries(
			FIELDS.map((k) => [k, String(formData.get(k) ?? '').trim()])
		) as Record<Field, string>;
		const errors: FormErrors = {};

		const today = todayInManila();
		const minor = /^\d{4}-\d{2}-\d{2}$/.test(values.birthdate)
			? ageOn(values.birthdate, today) < 18
			: false;
		const mobile = normalizeMobile(values.mobile);

		if (formData.get('consent') !== 'yes') errors.consent = 'You must agree to the privacy notice.';
		if (!values.last_name) errors.last_name = 'Required';
		if (!values.first_name) errors.first_name = 'Required';
		if (values.sex !== 'M' && values.sex !== 'F') errors.sex = 'Required';
		if (!/^\d{4}-\d{2}-\d{2}$/.test(values.birthdate) || values.birthdate >= today)
			errors.birthdate = 'Enter a valid birthdate';
		if (minor && !values.guardian_name) errors.guardian_name = 'Required for students under 18';
		if (!isLrn(values.lrn)) errors.lrn = 'LRN must be exactly 12 digits';
		if (!mobile) errors.mobile = 'Use 09XXXXXXXXX';
		if (values.mode !== 'BLOCK' && values.mode !== 'IRREGULAR') errors.mode = 'Required';

		const t = openTerm();
		if (!t) errors.form = 'Enrollment is closed.';
		const prog = db.select().from(program).where(eq(program.code, values.program)).get();
		if (!prog?.active) errors.program = 'Choose a program';

		if (Object.keys(errors).length > 0 || !t || !mobile) {
			return fail(400, { values, errors });
		}

		const mode = values.mode as 'BLOCK' | 'IRREGULAR';
		let ref: string;
		try {
			// BEGIN IMMEDIATE: take the write lock up front so concurrent submits queue instead of failing.
			ref = db.transaction(
				(tx) => {
					const taken = tx
						.select({ personId: personIdentifier.personId })
						.from(personIdentifier)
						.where(and(eq(personIdentifier.scheme, 'LRN'), eq(personIdentifier.value, values.lrn)))
						.get();
					if (taken) throw new LrnTaken();

					const personId = uuidv7();
					tx.insert(person)
						.values({
							id: personId,
							lastName: normalizeName(values.last_name),
							firstName: normalizeName(values.first_name),
							middleName: values.middle_name ? normalizeName(values.middle_name) : null,
							suffix: values.suffix ? normalizeName(values.suffix) : null,
							sexAtBirth: values.sex as 'M' | 'F',
							birthdate: values.birthdate,
							mobile,
							email: values.email || null
						})
						.run();
					tx.insert(consent)
						.values({
							personId,
							purpose: 'ENROLLMENT_PROCESSING',
							noticeVersion: NOTICE_VERSION,
							guardianName: minor ? values.guardian_name : null
						})
						.run();
					tx.insert(personIdentifier).values({ scheme: 'LRN', value: values.lrn, personId }).run();

					// Freshman intake: year level 1. Block students get a seat now (one tap);
					// if every block is full they are queued for the Registrar (sectionId null).
					const sectionId =
						mode === 'BLOCK' ? reserveFirstOpenBlock(tx, t.id, prog!.code, 1) : null;

					const applicationId = uuidv7();
					const code = refCode();
					tx.insert(application)
						.values({
							id: applicationId,
							refCode: code,
							personId,
							termId: t.id,
							programCode: prog!.code,
							yearLevel: 1,
							mode,
							sectionId
						})
						.run();

					audit(tx, {
						actor: `student:${personId}`,
						action: 'CREATE',
						entity: 'core_person',
						entityId: personId,
						ip: getClientAddress()
					});
					emitEvent(tx, 'core.person.registered.v1', personId, { personId });
					emitEvent(tx, 'enrollment.application.submitted.v1', applicationId, {
						applicationId,
						personId,
						termId: t.id,
						programCode: prog!.code,
						mode,
						sectionId
					});
					return code;
				},
				{ behavior: 'immediate' }
			);
		} catch (e) {
			if (e instanceof LrnTaken) {
				const errors: FormErrors = {
					lrn: 'This LRN already has a record. Please visit the Registrar.'
				};
				return fail(409, { values, errors });
			}
			throw e;
		}

		redirect(303, `/enroll/done?ref=${ref}`);
	}
} satisfies Actions;
