import { fail } from '@sveltejs/kit';
import { and, eq } from 'drizzle-orm';
import { db } from '#lib/server/db/index.ts';
import { application, person, personIdentifier } from '#lib/server/db/schema/index.ts';
import { clearFailures, isLockedOut, recordFailure } from '#lib/server/auth/rate-limit.ts';
import { loadRegistration } from '#lib/server/enrollment/cor.ts';
import { audit } from '#lib/server/events.ts';
import { isLrn } from '#lib/validation.ts';
import { REQUIREMENTS } from '#lib/enrollment.ts';
import type { Actions } from './$types';

/**
 * Student self-service lookup. Three facts only the student should know together (reference no.,
 * LRN, birthdate); a wrong combination gets one generic message, and an IP is throttled after 5
 * misses. A POST so nothing personal ever lands in a URL, browser history or server log.
 */
export const actions = {
	default: async ({ request, getClientAddress }) => {
		const form = await request.formData();
		const ref = String(form.get('ref') ?? '')
			.trim()
			.toUpperCase();
		const lrn = String(form.get('lrn') ?? '').trim();
		const birthdate = String(form.get('birthdate') ?? '');
		const values = { ref, lrn, birthdate };
		const ip = getClientAddress();
		const key = `status|${ip}`;

		if (isLockedOut(key)) {
			return fail(429, { values, error: 'Too many tries. Wait 15 minutes and try again.' });
		}
		if (!/^[0-9A-Z]{8}$/.test(ref) || !isLrn(lrn) || !/^\d{4}-\d{2}-\d{2}$/.test(birthdate)) {
			return fail(400, { values, error: 'Check the reference number, LRN and birthdate.' });
		}

		const match = db
			.select({ id: application.id, personId: application.personId })
			.from(application)
			.innerJoin(person, eq(person.id, application.personId))
			.innerJoin(
				personIdentifier,
				and(
					eq(personIdentifier.personId, person.id),
					eq(personIdentifier.scheme, 'LRN'),
					eq(personIdentifier.value, lrn)
				)
			)
			.where(and(eq(application.refCode, ref), eq(person.birthdate, birthdate)))
			.get();

		if (!match) {
			recordFailure(key);
			return fail(404, {
				values,
				error: "We couldn't find an application with those details. Check them and try again."
			});
		}
		clearFailures(key);

		const reg = loadRegistration(match.id)!;
		db.transaction((tx) =>
			audit(tx, {
				actor: `student:${match.personId}`,
				action: 'READ',
				entity: 'enr_application',
				entityId: match.id,
				ip
			})
		);
		const received = new Set(reg.received.map((r) => r.kind));
		return {
			reg,
			printedAt: new Date(),
			missing: REQUIREMENTS.filter((r) => !received.has(r.kind)).map((r) => ({
				label: r.label,
				note: r.note
			}))
		};
	}
} satisfies Actions;
