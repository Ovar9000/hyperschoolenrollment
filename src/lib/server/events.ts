import type { Tx } from './db/index.ts';
import { auditLog, event } from './db/schema/index.ts';
import { uuidv7 } from './id.ts';

/**
 * Catalog of published event types and their payloads. This is a public contract with other
 * school systems: never change a published version's shape, add a new `.vN` instead.
 * Payloads are thin (IDs + status). No names, birthdates, grades or documents.
 */
export interface EventCatalog {
	'core.person.registered.v1': { personId: string };
	'enrollment.application.submitted.v1': {
		applicationId: string;
		personId: string;
		termId: string;
		programCode: string;
		mode: 'BLOCK' | 'IRREGULAR';
		sectionId: string | null;
	};
	// `by` is the staff sys_user.id that made the change (an internal ID, not personal data).
	'enrollment.application.accepted.v1': { applicationId: string; by: string };
	'enrollment.section.assigned.v1': {
		applicationId: string;
		sectionId: string;
		previousSectionId: string | null;
		by: string;
	};
	'enrollment.requirement.updated.v1': {
		applicationId: string;
		kind: string;
		received: boolean;
		by: string;
	};
	'enrollment.application.assessed.v1': {
		applicationId: string;
		fheStatus: string;
		netDueCentavos: number;
		by: string;
	};
	'enrollment.assessment.reverted.v1': { applicationId: string; by: string };
	'enrollment.application.officially_enrolled.v1': {
		applicationId: string;
		personId: string;
		termId: string;
		studentNo: string;
		orNumber: string | null;
		by: string;
	};
	'enrollment.application.cancelled.v1': { applicationId: string; by: string };
	'records.student.admitted.v1': { personId: string; studentNo: string; programCode: string };
}

/** Must be called with the transaction that performs the change, so both commit or neither does. */
export function emitEvent<T extends keyof EventCatalog>(
	tx: Tx,
	type: T,
	subject: string,
	data: EventCatalog[T]
) {
	tx.insert(event).values({ id: uuidv7(), type, subject, data, time: new Date() }).run();
}

export function audit(tx: Tx, entry: Omit<typeof auditLog.$inferInsert, 'seq' | 'at'>) {
	tx.insert(auditLog).values(entry).run();
}
