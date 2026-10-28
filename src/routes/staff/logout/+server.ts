import { redirect } from '@sveltejs/kit';
import { db } from '#lib/server/db/index.ts';
import { SESSION_COOKIE, clearSessionCookie, deleteSession } from '#lib/server/auth/session.ts';
import { audit } from '#lib/server/events.ts';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = ({ cookies, locals, getClientAddress }) => {
	const token = cookies.get(SESSION_COOKIE);
	if (token) deleteSession(token);
	if (locals.user) {
		const id = locals.user.id;
		db.transaction((tx) =>
			audit(tx, {
				actor: id,
				action: 'LOGOUT',
				entity: 'sys_user',
				entityId: id,
				ip: getClientAddress()
			})
		);
	}
	clearSessionCookie(cookies);
	redirect(303, '/staff/login');
};
