import { fail } from '@sveltejs/kit';
import { and, asc, eq, like, or, type SQL } from 'drizzle-orm';
import { db } from '#lib/server/db/index.ts';
import { application, assessment, person, personIdentifier } from '#lib/server/db/schema/index.ts';
import { requireStaff } from '#lib/server/auth/guard.ts';
import { loadRegistration } from '#lib/server/enrollment/cor.ts';
import { runStep } from '#lib/server/enrollment/run.ts';
import { makeOfficial, type PaymentInput } from '#lib/server/enrollment/workflow.ts';
import { audit } from '#lib/server/events.ts';
import { pickTerm } from '#lib/server/terms.ts';
import { PAYMENT_METHODS } from '#lib/enrollment.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals, url, getClientAddress }) => {
	const me = requireStaff(locals, 'CASHIER');
	const t = pickTerm(null);
	const q = (url.searchParams.get('q') ?? '').trim().toUpperCase();
	const selectedId = url.searchParams.get('id');

	const where: SQL[] = [eq(application.status, 'ASSESSED')];
	if (t) where.push(eq(application.termId, t.id));
	if (q) {
		const name = `%${q.replace(/[%_]/g, '')}%`;
		where.push(
			or(
				eq(application.refCode, q),
				eq(personIdentifier.value, q),
				like(person.lastName, name),
				like(person.firstName, name)
			)!
		);
	}

	const queue = db
		.select({
			id: application.id,
			refCode: application.refCode,
			programCode: application.programCode,
			lastName: person.lastName,
			firstName: person.firstName,
			netDueCentavos: assessment.netDueCentavos,
			issuedAt: assessment.issuedAt
		})
		.from(application)
		.innerJoin(person, eq(person.id, application.personId))
		.innerJoin(assessment, eq(assessment.applicationId, application.id))
		.leftJoin(
			personIdentifier,
			and(eq(personIdentifier.personId, person.id), eq(personIdentifier.scheme, 'LRN'))
		)
		.where(and(...where))
		.orderBy(asc(assessment.issuedAt))
		.limit(100)
		.all();

	const selected = selectedId ? loadRegistration(selectedId) : null;
	if (selected) {
		db.transaction((tx) =>
			audit(tx, {
				actor: me.id,
				action: 'READ',
				entity: 'enr_application',
				entityId: selected.app.id,
				ip: getClientAddress()
			})
		);
	}
	return { q, queue, selected, termLabel: t?.label ?? null };
};

/** "1,234.50" or "1234.5" → 123450 centavos; null if not a positive amount. */
function toCentavos(input: string): number | null {
	const clean = input.replace(/[₱,\s]/g, '');
	if (!/^\d+(\.\d{1,2})?$/.test(clean)) return null;
	const [whole, frac = ''] = clean.split('.');
	return Number(whole) * 100 + Number(frac.padEnd(2, '0'));
}

export const actions = {
	pay: async ({ locals, request, getClientAddress }) => {
		const me = requireStaff(locals, 'CASHIER');
		const form = await request.formData();
		const id = String(form.get('id') ?? '');
		const zeroDue = form.get('zeroDue') === 'yes';
		let pay: PaymentInput | null = null;

		if (!zeroDue) {
			const orNumber = String(form.get('orNumber') ?? '')
				.trim()
				.toUpperCase();
			const amount = toCentavos(String(form.get('amount') ?? ''));
			const method = String(form.get('method') ?? '') as PaymentInput['method'];
			if (!/^[A-Z0-9-]{3,20}$/.test(orNumber)) {
				return fail(400, { error: 'Enter the OR number exactly as printed on the receipt.' });
			}
			if (amount === null || amount <= 0) return fail(400, { error: 'Enter the amount received.' });
			if (!PAYMENT_METHODS.some((m) => m.value === method)) {
				return fail(400, { error: 'Choose how the student paid.' });
			}
			pay = { orNumber, amountCentavos: amount, method };
		}

		return runStep(
			(tx) => makeOfficial(tx, id, pay, { userId: me.id, ip: getClientAddress() }),
			(studentNo) => `Officially enrolled. Student number ${studentNo}.`
		);
	}
} satisfies Actions;
