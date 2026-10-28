import { and, asc, eq, inArray } from 'drizzle-orm';
import { db } from '../db/index.ts';
import {
	application,
	assessment,
	assessmentLine,
	classEnrollment,
	klass,
	payment,
	person,
	personIdentifier,
	program,
	requirement,
	section,
	term
} from '../db/schema/index.ts';
import { listClasses } from '../classes.ts';

/**
 * Everything printed on a Certificate of Registration (OFFICIAL) or an Assessment Slip (ASSESSED),
 * and shown on the student's status page. One loader so staff and students see the same numbers.
 */
export function loadRegistration(applicationId: string) {
	const app = db
		.select({
			id: application.id,
			refCode: application.refCode,
			status: application.status,
			fheStatus: application.fheStatus,
			mode: application.mode,
			yearLevel: application.yearLevel,
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
		.where(eq(application.id, applicationId))
		.get();
	if (!app) return null;

	const who = db
		.select({
			lastName: person.lastName,
			firstName: person.firstName,
			middleName: person.middleName,
			suffix: person.suffix
		})
		.from(person)
		.where(eq(person.id, app.personId))
		.get()!;
	const ids = db
		.select({ scheme: personIdentifier.scheme, value: personIdentifier.value })
		.from(personIdentifier)
		.where(eq(personIdentifier.personId, app.personId))
		.all();

	const classIds = db
		.select({ id: classEnrollment.classId })
		.from(classEnrollment)
		.where(and(eq(classEnrollment.applicationId, app.id), eq(classEnrollment.status, 'ENROLLED')))
		.all()
		.map((r) => r.id);

	return {
		app,
		student: who,
		lrn: ids.find((i) => i.scheme === 'LRN')?.value ?? null,
		studentNo: ids.find((i) => i.scheme === 'STUDENT_NO')?.value ?? null,
		classes: classIds.length > 0 ? listClasses(inArray(klass.id, classIds)) : [],
		assessment:
			db.select().from(assessment).where(eq(assessment.applicationId, app.id)).get() ?? null,
		lines: db
			.select()
			.from(assessmentLine)
			.where(eq(assessmentLine.applicationId, app.id))
			.orderBy(asc(assessmentLine.sort), asc(assessmentLine.code))
			.all(),
		payments: db
			.select({
				orNumber: payment.orNumber,
				amountCentavos: payment.amountCentavos,
				method: payment.method,
				paidAt: payment.paidAt
			})
			.from(payment)
			.where(eq(payment.applicationId, app.id))
			.all(),
		received: db
			.select({ kind: requirement.kind, receivedAt: requirement.receivedAt })
			.from(requirement)
			.where(eq(requirement.applicationId, app.id))
			.all()
	};
}

export type Registration = NonNullable<ReturnType<typeof loadRegistration>>;
