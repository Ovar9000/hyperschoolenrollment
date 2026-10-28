import { fail } from '@sveltejs/kit';
import { db, type Tx } from '../db/index.ts';
import { WorkflowError } from './workflow-error.ts';

/**
 * Runs a workflow step in a BEGIN IMMEDIATE transaction (write lock taken up front, so staff
 * actions queue instead of failing). Rule violations become a 400 with the message for the form;
 * anything else is a real bug and propagates.
 */
export function runStep<T>(step: (tx: Tx) => T, success: string | ((value: T) => string)) {
	try {
		const value = db.transaction(step, { behavior: 'immediate' });
		return { success: typeof success === 'string' ? success : success(value) };
	} catch (e) {
		if (e instanceof WorkflowError) return fail(400, { error: e.message });
		throw e;
	}
}
