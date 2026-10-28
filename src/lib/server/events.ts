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
