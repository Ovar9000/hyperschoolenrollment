import { and, asc, eq, gt, lt, sql } from 'drizzle-orm';
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
 * Seats an application in a section and every class of that section, all or nothing (savepoint).
 * Re-seating after a drop reactivates the old class-seat row. Returns false if anything is full.
 */
export function tryEnrollInSection(tx: Tx, applicationId: string, sectionId: string): boolean {
	try {
		tx.transaction((sp) => {
			if (!reserveSeat(sp, sectionId)) throw new SeatTaken();
			const classes = sp
				.select({ id: klass.id })
				.from(klass)
				.where(eq(klass.sectionId, sectionId))
				.all();
			for (const c of classes) {
				if (!reserveClassSeat(sp, c.id)) throw new SeatTaken();
				sp.insert(classEnrollment)
					.values({ applicationId, classId: c.id })
					.onConflictDoUpdate({
						target: [classEnrollment.applicationId, classEnrollment.classId],
						set: { status: 'ENROLLED', enrolledAt: new Date() }
					})
					.run();
			}
		});
		return true;
	} catch (e) {
		if (e instanceof SeatTaken) return false;
		throw e;
	}
}

/** Gives back the application's section seat and every class seat it holds. */
export function releaseSeats(tx: Tx, applicationId: string, sectionId: string | null) {
	if (sectionId) {
		tx.update(section)
			.set({ enrolled: sql`${section.enrolled} - 1` })
			.where(and(eq(section.id, sectionId), gt(section.enrolled, 0)))
			.run();
	}
	const held = tx
		.select({ classId: classEnrollment.classId })
		.from(classEnrollment)
		.where(
			and(eq(classEnrollment.applicationId, applicationId), eq(classEnrollment.status, 'ENROLLED'))
		)
		.all();
	for (const { classId } of held) {
		tx.update(klass)
			.set({ enrolled: sql`${klass.enrolled} - 1` })
			.where(and(eq(klass.id, classId), gt(klass.enrolled, 0)))
			.run();
	}
	tx.update(classEnrollment)
		.set({ status: 'DROPPED' })
		.where(
			and(eq(classEnrollment.applicationId, applicationId), eq(classEnrollment.status, 'ENROLLED'))
		)
		.run();
}

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
		if (tryEnrollInSection(tx, applicationId, id)) return id;
	}
	return null;
}
