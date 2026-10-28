import { and, asc, eq, lt, sql } from 'drizzle-orm';
import type { Tx } from '../db/index.ts';
import { classEnrollment, klass, section } from '../db/schema/index.ts';

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

/** Same guarantee as reserveSeat, for one class offering. */
export function reserveClassSeat(tx: Tx, classId: string): boolean {
	const result = tx
		.update(klass)
		.set({ enrolled: sql`${klass.enrolled} + 1` })
		.where(and(eq(klass.id, classId), lt(klass.enrolled, klass.capacity)))
		.run();
	return result.changes === 1;
}

class SeatTaken extends Error {}

/**
 * One-tap block enrollment: the first block section of the program/year that has a seat in the
 * section AND in every one of its classes. Each attempt runs in a savepoint, so a block that turns
 * out to be full in one class leaves no half-taken seats behind. Returns the section id, or null
 * when every block is full (the Registrar then places the student).
 */
export function enrollInFirstOpenBlock(
	tx: Tx,
	applicationId: string,
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
		try {
			tx.transaction((sp) => {
				if (!reserveSeat(sp, id)) throw new SeatTaken();
				const classes = sp
					.select({ id: klass.id })
					.from(klass)
					.where(eq(klass.sectionId, id))
					.all();
				for (const c of classes) {
					if (!reserveClassSeat(sp, c.id)) throw new SeatTaken();
					sp.insert(classEnrollment).values({ applicationId, classId: c.id }).run();
				}
			});
			return id;
		} catch (e) {
			if (e instanceof SeatTaken) continue;
			throw e;
		}
	}
	return null;
}
