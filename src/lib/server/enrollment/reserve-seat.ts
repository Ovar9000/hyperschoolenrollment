import { and, asc, eq, lt, sql } from 'drizzle-orm';
import type { Tx } from '../db/index.ts';
import { section } from '../db/schema/index.ts';

/**
 * Atomically takes one seat. The capacity check and the increment are ONE statement, so two
 * students racing for the 40th seat can never both win, with no Redis and no locks.
 * Returns false when the section is full.
 */
export function reserveSeat(tx: Tx, sectionId: string): boolean {
	const result = tx
		.update(section)
		.set({ enrolled: sql`${section.enrolled} + 1` })
		.where(and(eq(section.id, sectionId), lt(section.enrolled, section.capacity)))
		.run();
	return result.changes === 1;
}

/** One-tap block enrollment: first block section of the program/year that still has a seat. */
export function reserveFirstOpenBlock(
	tx: Tx,
	termId: string,
	programCode: string,
	yearLevel: number
): string | null {
	const candidates = tx
		.select({ id: section.id })
		.from(section)
		.where(
			and(
				eq(section.termId, termId),
				eq(section.programCode, programCode),
				eq(section.yearLevel, yearLevel),
				lt(section.enrolled, section.capacity)
			)
		)
		.orderBy(asc(section.code))
		.all();

	for (const { id } of candidates) {
		if (reserveSeat(tx, id)) return id;
	}
	return null;
}
