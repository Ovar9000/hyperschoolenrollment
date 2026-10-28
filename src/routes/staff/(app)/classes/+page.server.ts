import { and, asc, eq, like, or, type SQL } from 'drizzle-orm';
import { db } from '#lib/server/db/index.ts';
import { klass, section, subject } from '#lib/server/db/schema/index.ts';
import { requireStaff } from '#lib/server/auth/guard.ts';
import { listClasses } from '#lib/server/classes.ts';
import { allTerms, pickTerm } from '#lib/server/terms.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals, url }) => {
	requireStaff(locals);
	const t = pickTerm(url.searchParams.get('term'));
	const filters = {
		term: t?.id ?? '',
		section: url.searchParams.get('section') ?? '',
		q: (url.searchParams.get('q') ?? '').trim()
	};
	if (!t) return { terms: allTerms(), filters, sections: [], classes: [] };

	const where: SQL[] = [eq(klass.termId, t.id)];
	if (filters.section) where.push(eq(klass.sectionId, filters.section));
	if (filters.q) {
		const q = `%${filters.q.replace(/[%_]/g, '')}%`;
		where.push(or(like(subject.code, q), like(subject.title, q), like(klass.code, q))!);
	}

	return {
		terms: allTerms(),
		filters,
		sections: db
			.select({ id: section.id, code: section.code })
			.from(section)
			.where(eq(section.termId, t.id))
			.orderBy(asc(section.code))
			.all(),
		classes: listClasses(and(...where))
	};
};
