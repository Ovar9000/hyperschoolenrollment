import { error, redirect } from '@sveltejs/kit';
import type { Role } from '../db/schema/index.ts';
import type { StaffUser } from './session.ts';

/**
 * Call at the top of every staff load/action. ADMIN passes every check.
 * With no roles listed, any signed-in staff member passes.
 */
export function requireStaff(locals: App.Locals, ...roles: Role[]): StaffUser {
	const user = locals.user;
	if (!user) redirect(303, '/staff/login');
	if (roles.length > 0 && !user.roles.some((r) => r === 'ADMIN' || roles.includes(r))) {
		error(403, 'Your account does not have access to this page.');
	}
	return user;
}

export function hasRole(user: StaffUser, ...roles: Role[]): boolean {
	return user.roles.some((r) => r === 'ADMIN' || roles.includes(r));
}
