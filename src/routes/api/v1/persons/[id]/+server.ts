import { error } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { db } from '#lib/server/db/index.ts';
import { person, personIdentifier } from '#lib/server/db/schema/index.ts';
import { audit } from '#lib/server/events.ts';
import { requireIntegration } from '#lib/server/integration-auth.ts';
import type { RequestHandler } from './$types';

/** Person details for an ID received in an event. Every read is audit-logged (RA 10173). */
export const GET: RequestHandler = ({ request, params, getClientAddress }) => {
	requireIntegration(request);

	const p = db.select().from(person).where(eq(person.id, params.id)).get();
	if (!p) error(404, 'Not found');

	const identifiers = db
		.select({ scheme: personIdentifier.scheme, value: personIdentifier.value })
		.from(personIdentifier)
		.where(eq(personIdentifier.personId, p.id))
		.all();

	db.transaction((tx) =>
		audit(tx, {
			actor: 'integration',
			action: 'READ',
			entity: 'core_person',
			entityId: p.id,
			ip: getClientAddress()
		})
	);

	return Response.json({
		id: p.id,
		lastName: p.lastName,
		firstName: p.firstName,
		middleName: p.middleName,
		suffix: p.suffix,
		sexAtBirth: p.sexAtBirth,
		birthdate: p.birthdate,
		mobile: p.mobile,
		email: p.email,
		identifiers,
		updatedAt: p.updatedAt.toISOString()
	});
};
