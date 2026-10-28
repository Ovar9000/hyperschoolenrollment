import { and, asc, count, desc, eq, isNull } from 'drizzle-orm';
import { db } from '#lib/server/db/index.ts';
import { APPLICATION_STATUSES, application, person, section } from '#lib/server/db/schema/index.ts';
import { requireStaff } from '#lib/server/auth/guard.ts';
import { pickTerm } from '#lib/server/terms.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals }) => {
	requireStaff(locals);
	const t = pickTerm(null);
	if (!t) return { term: null };

	const byStatus = Object.fromEntries(APPLICATION_STATUSES.map((s) => [s, 0])) as Record<
		(typeof APPLICATION_STATUSES)[number],
		number
	>;
	for (const row of db
		.select({ status: application.status, n: count() })
		.from(application)
		.where(eq(application.termId, t.id))
		.groupBy(application.status)
		.all()) {
		byStatus[row.status] = row.n;
	}

	const needsSection =
		db
			.select({ n: count() })
			.from(application)
			.where(and(eq(application.termId, t.id), isNull(application.sectionId)))
			.get()?.n ?? 0;

	return {
		term: { id: t.id, label: t.label, open: t.enrollmentOpen },
		byStatus,
		total: Object.values(byStatus).reduce((a, b) => a + b, 0),
		needsSection,
		sections: db
			.select({
				id: section.id,
				code: section.code,
				enrolled: section.enrolled,
				capacity: section.capacity
			})
			.from(section)
			.where(eq(section.termId, t.id))
			.orderBy(asc(section.code))
			.all(),
		recent: db
			.select({
				id: application.id,
				refCode: application.refCode,
				status: application.status,
				programCode: application.programCode,
				submittedAt: application.submittedAt,
				lastName: person.lastName,
				firstName: person.firstName
			})
			.from(application)
			.innerJoin(person, eq(person.id, application.personId))
			.where(eq(application.termId, t.id))
			.orderBy(desc(application.submittedAt))
			.limit(8)
			.all()
	};
};
