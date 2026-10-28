import { and, desc, eq, lte, sql } from 'drizzle-orm';
import type { Tx } from '../db/index.ts';
import { curriculum, personIdentifier, student, studentNoCounter } from '../db/schema/index.ts';
import { emitEvent } from '../events.ts';
import { WorkflowError } from '../enrollment/workflow-error.ts';

/**
 * Makes a person a student (once): issues the next student number for the admission year,
 * pins them to the program's current curriculum, and records STUDENT_NO as an identifier.
 * Returning students keep their existing number.
 */
export function admitStudent(
	tx: Tx,
	{ personId, programCode, termId }: { personId: string; programCode: string; termId: string }
): string {
	const existing = tx
		.select({ studentNo: student.studentNo })
		.from(student)
		.where(eq(student.personId, personId))
		.get();
	if (existing) return existing.studentNo;

	const year = Number(termId.slice(0, 4));
	const cur = tx
		.select({ id: curriculum.id })
		.from(curriculum)
		.where(
			and(
				eq(curriculum.programCode, programCode),
				eq(curriculum.active, true),
				lte(curriculum.effectiveAy, year)
			)
		)
		.orderBy(desc(curriculum.effectiveAy))
		.get();
	if (!cur) {
		throw new WorkflowError(
			`No active curriculum for ${programCode} (AY ${year}). Add one before enrolling students.`
		);
	}

	// Atomic per-year counter: concurrent cashiers can never issue the same number.
	const { last } = tx
		.insert(studentNoCounter)
		.values({ year, last: 1 })
		.onConflictDoUpdate({
			target: studentNoCounter.year,
			set: { last: sql`${studentNoCounter.last} + 1` }
		})
		.returning({ last: studentNoCounter.last })
		.get();
	const studentNo = `${year}-${String(last).padStart(5, '0')}`;

	tx.insert(student)
		.values({ personId, studentNo, programCode, curriculumId: cur.id, admitTermId: termId })
		.run();
	tx.insert(personIdentifier).values({ scheme: 'STUDENT_NO', value: studentNo, personId }).run();
	emitEvent(tx, 'records.student.admitted.v1', personId, { personId, studentNo, programCode });
	return studentNo;
}
