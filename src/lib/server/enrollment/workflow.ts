/**
 * Enrollment processing: every staff action on an application. Each function runs inside the
 * caller's transaction, guards its status transition with a conditional UPDATE (two staff clicking
 * at once can't both succeed), and writes an event + audit row in the same transaction.
 *
 *   SUBMITTED ──accept──▶ PROVISIONAL ──assess──▶ ASSESSED ──makeOfficial──▶ OFFICIAL
 *        │                     │   ◀──revertAssessment──┘
 *        └──────────── cancel ─┴────────────────────────▶ CANCELLED
 */
import { and, asc, eq, inArray, isNull, or, sum } from 'drizzle-orm';
import type { Tx } from '../db/index.ts';
import {
	APPLICATION_STATUSES,
	REQUIREMENT_KINDS,
	application,
	assessment,
	assessmentLine,
	classEnrollment,
	fee,
	klass,
	payment,
	program,
	requirement,
	section,
	subject
} from '../db/schema/index.ts';
import { audit, emitEvent } from '../events.ts';
import { admitStudent } from '../records/student.ts';
import { releaseSeats, tryEnrollInSection } from './reserve-seat.ts';
import { WorkflowError } from './workflow-error.ts';

export { WorkflowError };

type Status = (typeof APPLICATION_STATUSES)[number];
type RequirementKind = (typeof REQUIREMENT_KINDS)[number];
export type FheStatus = 'FHE_COVERED' | 'PAYING_OPT_OUT' | 'NOT_APPLICABLE';
export interface Actor {
	userId: string;
	ip: string;
}

const STALE =
	'This application changed while you were looking at it. Reload the page and try again.';

function getApplication(tx: Tx, id: string) {
	const app = tx.select().from(application).where(eq(application.id, id)).get();
	if (!app) throw new WorkflowError('Application not found.');
	return app;
}

/** Moves status only if it is still one of `from` (single statement, race-safe). */
function transition(tx: Tx, id: string, from: Status[], to: Status, extra: object = {}) {
	const result = tx
		.update(application)
		.set({ status: to, ...extra })
		.where(and(eq(application.id, id), inArray(application.status, from)))
		.run();
	if (result.changes !== 1) throw new WorkflowError(STALE);
}

function log(tx: Tx, actor: Actor, entityId: string) {
	audit(tx, {
		actor: actor.userId,
		action: 'UPDATE',
		entity: 'enr_application',
		entityId,
		ip: actor.ip
	});
}

export function accept(tx: Tx, applicationId: string, actor: Actor) {
	transition(tx, applicationId, ['SUBMITTED'], 'PROVISIONAL');
	emitEvent(tx, 'enrollment.application.accepted.v1', applicationId, {
		applicationId,
		by: actor.userId
	});
	log(tx, actor, applicationId);
}

/** Places (or moves) a student into a block section with all its classes. Only before assessment. */
export function assignSection(tx: Tx, applicationId: string, sectionId: string, actor: Actor) {
	const app = getApplication(tx, applicationId);
	if (app.status !== 'SUBMITTED' && app.status !== 'PROVISIONAL') {
		throw new WorkflowError(
			app.status === 'ASSESSED'
				? 'Undo the assessment first; fees depend on the section.'
				: 'Sections can only be changed before assessment.'
		);
	}
	if (app.sectionId === sectionId) return;
	const target = tx.select().from(section).where(eq(section.id, sectionId)).get();
	if (!target || target.termId !== app.termId || target.programCode !== app.programCode) {
		throw new WorkflowError('Choose a section from the same term and program.');
	}
	// Claim the row first so a concurrent change to this application fails instead of interleaving.
	transition(tx, applicationId, [app.status], app.status);

	releaseSeats(tx, applicationId, app.sectionId);
	if (!tryEnrollInSection(tx, applicationId, sectionId)) {
		throw new WorkflowError(`${target.code} or one of its classes is full.`);
	}
	tx.update(application).set({ sectionId }).where(eq(application.id, applicationId)).run();
	emitEvent(tx, 'enrollment.section.assigned.v1', applicationId, {
		applicationId,
		sectionId,
		previousSectionId: app.sectionId,
		by: actor.userId
	});
	log(tx, actor, applicationId);
}

export function setRequirement(
	tx: Tx,
	applicationId: string,
	kind: RequirementKind,
	received: boolean,
	actor: Actor
) {
	const app = getApplication(tx, applicationId);
	if (app.status === 'CANCELLED') throw new WorkflowError('This application is cancelled.');
	if (received) {
		tx.insert(requirement)
			.values({ applicationId, kind, receivedAt: new Date(), receivedBy: actor.userId })
			.onConflictDoNothing()
			.run();
	} else {
		tx.delete(requirement)
			.where(and(eq(requirement.applicationId, applicationId), eq(requirement.kind, kind)))
			.run();
	}
	emitEvent(tx, 'enrollment.requirement.updated.v1', applicationId, {
		applicationId,
		kind,
		received,
		by: actor.userId
	});
	log(tx, actor, applicationId);
}

/** Fee lines for an application from the term's schedule and the units of its enrolled classes. */
export function computeAssessment(tx: Tx, applicationId: string, fheStatus: FheStatus) {
	const app = getApplication(tx, applicationId);
	const units = Number(
		tx
			.select({ units: sum(subject.creditUnits) })
			.from(classEnrollment)
			.innerJoin(klass, eq(klass.id, classEnrollment.classId))
			.innerJoin(subject, eq(subject.code, klass.subjectCode))
			.where(
				and(
					eq(classEnrollment.applicationId, applicationId),
					eq(classEnrollment.status, 'ENROLLED')
				)
			)
			.get()?.units ?? 0
	);
	const schedule = tx
		.select()
		.from(fee)
		.where(
			and(
				eq(fee.termId, app.termId),
				or(isNull(fee.programCode), eq(fee.programCode, app.programCode))
			)
		)
		.orderBy(asc(fee.sort), asc(fee.code))
		.all();

	const lines = schedule.map((f) => ({
		code: f.code,
		label: f.basis === 'PER_UNIT' ? `${f.label} (${units} units)` : f.label,
		amountCentavos: f.basis === 'PER_UNIT' ? f.amountCentavos * units : f.amountCentavos,
		fheCovered: f.fheCovered,
		sort: f.sort
	}));
	const totalCentavos = lines.reduce((t, l) => t + l.amountCentavos, 0);
	const fheCoveredCentavos =
		fheStatus === 'FHE_COVERED'
			? lines.filter((l) => l.fheCovered).reduce((t, l) => t + l.amountCentavos, 0)
			: 0;
	return {
		units,
		lines,
		totalCentavos,
		fheCoveredCentavos,
		netDueCentavos: totalCentavos - fheCoveredCentavos
	};
}

export function assess(tx: Tx, applicationId: string, fheStatus: FheStatus, actor: Actor) {
	const app = getApplication(tx, applicationId);
	if (!app.sectionId) throw new WorkflowError('Assign a section before assessing.');
	if (fheStatus === 'FHE_COVERED') {
		const prog = tx
			.select({ fheEligible: program.fheEligible })
			.from(program)
			.where(eq(program.code, app.programCode))
			.get();
		if (!prog?.fheEligible) {
			throw new WorkflowError(`${app.programCode} is not covered by Free Higher Education.`);
		}
	}
	const a = computeAssessment(tx, applicationId, fheStatus);
	if (a.units === 0) throw new WorkflowError('The student has no classes yet.');
	if (a.lines.length === 0) throw new WorkflowError('No fee schedule for this term yet.');

	transition(tx, applicationId, ['PROVISIONAL'], 'ASSESSED', { fheStatus });
	tx.insert(assessment)
		.values({
			applicationId,
			units: a.units,
			totalCentavos: a.totalCentavos,
			fheCoveredCentavos: a.fheCoveredCentavos,
			netDueCentavos: a.netDueCentavos,
			issuedAt: new Date(),
			issuedBy: actor.userId
		})
		.run();
	tx.insert(assessmentLine)
		.values(a.lines.map((l) => ({ applicationId, ...l })))
		.run();
	emitEvent(tx, 'enrollment.application.assessed.v1', applicationId, {
		applicationId,
		fheStatus,
		netDueCentavos: a.netDueCentavos,
		by: actor.userId
	});
	log(tx, actor, applicationId);
}

/** Undo an assessment that hasn't been paid (wrong FHE status, section change needed). */
export function revertAssessment(tx: Tx, applicationId: string, actor: Actor) {
	transition(tx, applicationId, ['ASSESSED'], 'PROVISIONAL', { fheStatus: 'PENDING' });
	tx.delete(assessmentLine).where(eq(assessmentLine.applicationId, applicationId)).run();
	tx.delete(assessment).where(eq(assessment.applicationId, applicationId)).run();
	emitEvent(tx, 'enrollment.assessment.reverted.v1', applicationId, {
		applicationId,
		by: actor.userId
	});
	log(tx, actor, applicationId);
}

export interface PaymentInput {
	orNumber: string;
	amountCentavos: number;
	method: 'CASH' | 'GCASH' | 'LANDBANK' | 'OTHER';
}

/**
 * Cashier: records the official receipt (or confirms ₱0 due), issues the student number and
 * marks the student OFFICIALLY ENROLLED. Returns the student number.
 */
export function makeOfficial(
	tx: Tx,
	applicationId: string,
	pay: PaymentInput | null,
	actor: Actor
): string {
	const app = getApplication(tx, applicationId);
	const a = tx.select().from(assessment).where(eq(assessment.applicationId, applicationId)).get();
	if (app.status !== 'ASSESSED' || !a) throw new WorkflowError(STALE);

	if (a.netDueCentavos > 0) {
		if (!pay) throw new WorkflowError('Enter the OR number and amount received.');
		if (pay.amountCentavos < a.netDueCentavos) {
			throw new WorkflowError('The amount received is less than the amount due.');
		}
		const duplicate = tx
			.select({ id: payment.id })
			.from(payment)
			.where(eq(payment.orNumber, pay.orNumber))
			.get();
		if (duplicate) throw new WorkflowError(`OR ${pay.orNumber} is already recorded.`);
	}

	transition(tx, applicationId, ['ASSESSED'], 'OFFICIAL');
	if (a.netDueCentavos > 0 && pay) {
		tx.insert(payment)
			.values({ applicationId, ...pay, paidAt: new Date(), receivedBy: actor.userId })
			.run();
	}
	const studentNo = admitStudent(tx, {
		personId: app.personId,
		programCode: app.programCode,
		termId: app.termId
	});
	emitEvent(tx, 'enrollment.application.officially_enrolled.v1', applicationId, {
		applicationId,
		personId: app.personId,
		termId: app.termId,
		studentNo,
		orNumber: a.netDueCentavos > 0 && pay ? pay.orNumber : null,
		by: actor.userId
	});
	log(tx, actor, applicationId);
	return studentNo;
}

export function cancel(tx: Tx, applicationId: string, reason: string, actor: Actor) {
	const app = getApplication(tx, applicationId);
	if (!reason.trim()) throw new WorkflowError('Give a reason for cancelling.');
	transition(tx, applicationId, ['SUBMITTED', 'PROVISIONAL', 'ASSESSED'], 'CANCELLED', {
		cancelReason: reason.trim(),
		sectionId: null
	});
	releaseSeats(tx, applicationId, app.sectionId);
	tx.delete(assessmentLine).where(eq(assessmentLine.applicationId, applicationId)).run();
	tx.delete(assessment).where(eq(assessment.applicationId, applicationId)).run();
	emitEvent(tx, 'enrollment.application.cancelled.v1', applicationId, {
		applicationId,
		by: actor.userId
	});
	log(tx, actor, applicationId);
}
