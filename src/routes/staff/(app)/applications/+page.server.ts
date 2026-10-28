import { and, asc, count, desc, eq, isNull, like, or, type SQL } from 'drizzle-orm';
import { db } from '#lib/server/db/index.ts';
import {
	APPLICATION_STATUSES,
	application,
	person,
	personIdentifier,
	section
} from '#lib/server/db/schema/index.ts';
import { requireStaff } from '#lib/server/auth/guard.ts';
import { allTerms, pickTerm } from '#lib/server/terms.ts';
import type { PageServerLoad } from './$types';

const PAGE_SIZE = 50;
type Status = (typeof APPLICATION_STATUSES)[number];

export const load: PageServerLoad = ({ locals, url }) => {
	requireStaff(locals, 'REGISTRAR', 'DEAN', 'CASHIER');
	const t = pickTerm(url.searchParams.get('term'));
	const terms = allTerms();
	const filters = {
		term: t?.id ?? '',
		status: url.searchParams.get('status') ?? '',
		section: url.searchParams.get('section') ?? '',
		q: (url.searchParams.get('q') ?? '').trim()
	};
	const page = Math.max(1, Number(url.searchParams.get('page')) || 1);
	if (!t) return { terms, filters, sections: [], rows: [], total: 0, page, pageSize: PAGE_SIZE };

	const lrn = and(eq(personIdentifier.personId, person.id), eq(personIdentifier.scheme, 'LRN'));
	const where: SQL[] = [eq(application.termId, t.id)];
	if ((APPLICATION_STATUSES as readonly string[]).includes(filters.status)) {
		where.push(eq(application.status, filters.status as Status));
	}
	if (filters.section === 'none') where.push(isNull(application.sectionId));
	else if (filters.section) where.push(eq(application.sectionId, filters.section));
	if (filters.q) {
		const q = filters.q.toUpperCase();
		if (/^\d{12}$/.test(q)) {
			where.push(eq(personIdentifier.value, q));
		} else {
			const name = `%${q.replace(/[%_]/g, '')}%`;
			const byName = [like(person.lastName, name), like(person.firstName, name)];
			// An 8-character code could be a reference number or part of a name: match either.
			where.push(
				/^[0-9A-Z]{8}$/.test(q) ? or(eq(application.refCode, q), ...byName)! : or(...byName)!
			);
		}
	}

	const base = () =>
		db
			.select({
				id: application.id,
				refCode: application.refCode,
				status: application.status,
				mode: application.mode,
				programCode: application.programCode,
				submittedAt: application.submittedAt,
				lastName: person.lastName,
				firstName: person.firstName,
				middleName: person.middleName,
				lrn: personIdentifier.value,
				sectionCode: section.code
			})
			.from(application)
			.innerJoin(person, eq(person.id, application.personId))
			.leftJoin(personIdentifier, lrn)
			.leftJoin(section, eq(section.id, application.sectionId))
			.where(and(...where));

	const total =
		db
			.select({ n: count() })
			.from(application)
			.innerJoin(person, eq(person.id, application.personId))
			.leftJoin(personIdentifier, lrn)
			.where(and(...where))
			.get()?.n ?? 0;

	return {
		terms,
		filters,
		page,
		pageSize: PAGE_SIZE,
		total,
		sections: db
			.select({ id: section.id, code: section.code })
			.from(section)
			.where(eq(section.termId, t.id))
			.orderBy(asc(section.code))
			.all(),
		rows: base()
			.orderBy(desc(application.submittedAt))
			.limit(PAGE_SIZE)
			.offset((page - 1) * PAGE_SIZE)
			.all()
	};
};
