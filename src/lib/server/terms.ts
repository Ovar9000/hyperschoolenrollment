import { desc, eq } from 'drizzle-orm';
import { db } from './db/index.ts';
import { term } from './db/schema/index.ts';

export function allTerms() {
	return db
		.select({ id: term.id, label: term.label })
		.from(term)
		.orderBy(desc(term.startsOn))
		.all();
}

/** The requested term if it exists, else the open term, else the most recent one. */
export function pickTerm(requested: string | null) {
	if (requested) {
		const t = db.select().from(term).where(eq(term.id, requested)).get();
		if (t) return t;
	}
	return (
		db.select().from(term).where(eq(term.enrollmentOpen, true)).get() ??
		db.select().from(term).orderBy(desc(term.startsOn)).get() ??
		null
	);
}
