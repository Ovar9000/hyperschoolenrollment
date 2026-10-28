import { error } from '@sveltejs/kit';
import { and, asc, desc, eq, inArray, or } from 'drizzle-orm';
import { db } from '#lib/server/db/index.ts';
import {
	application,
	classEnrollment,
	consent,
	event,
	klass,
	person,
	personIdentifier,
	program,
	section,
	term
} from '#lib/server/db/schema/index.ts';
import { requireStaff } from '#lib/server/auth/guard.ts';
import { listClasses } from '#lib/server/classes.ts';
import { audit } from '#lib/server/events.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals, params, getClientAddress }) => {
	const me = requireStaff(locals, 'REGISTRAR', 'DEAN');

	const app = db
		.select({
			id: application.id,
			refCode: application.refCode,
			status: application.status,
			fheStatus: application.fheStatus,
			mode: application.mode,
			yearLevel: application.yearLevel,
			submittedAt: application.submittedAt,
			personId: application.personId,
			termLabel: term.label,
			programCode: program.code,
			programName: program.name,
			sectionCode: section.code
		})
		.from(application)
		.innerJoin(term, eq(term.id, application.termId))
		.innerJoin(program, eq(program.code, application.programCode))
		.leftJoin(section, eq(section.id, application.sectionId))
		.where(eq(application.id, params.id))
		.get();
	if (!app) error(404, 'Application not found');

	const student = db.select().from(person).where(eq(person.id, app.personId)).get()!;
	const identifiers = db
		.select({ scheme: personIdentifier.scheme, value: personIdentifier.value })
		.from(personIdentifier)
		.where(eq(personIdentifier.personId, app.personId))
		.all();
	const consents = db
		.select()
		.from(consent)
		.where(eq(consent.personId, app.personId))
		.orderBy(desc(consent.grantedAt))
		.all();

	const classIds = db
		.select({ id: classEnrollment.classId })
		.from(classEnrollment)
		.where(and(eq(classEnrollment.applicationId, app.id), eq(classEnrollment.status, 'ENROLLED')))
		.all()
		.map((r) => r.id);
	const classes = classIds.length > 0 ? listClasses(inArray(klass.id, classIds)) : [];

	const timeline = db
		.select({ seq: event.seq, type: event.type, time: event.time })
		.from(event)
		.where(or(eq(event.subject, app.id), eq(event.subject, app.personId)))
		.orderBy(asc(event.seq))
		.all();

	// RA 10173: every staff view of a student's personal data is logged.
	db.transaction((tx) =>
		audit(tx, {
			actor: me.id,
			action: 'READ',
			entity: 'enr_application',
			entityId: app.id,
			ip: getClientAddress()
		})
	);

	return { app, student, identifiers, consents, classes, timeline };
};
