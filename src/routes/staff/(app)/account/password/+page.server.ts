import { fail, redirect } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { db } from '#lib/server/db/index.ts';
import { user } from '#lib/server/db/schema/index.ts';
import { requireStaff } from '#lib/server/auth/guard.ts';
import { MIN_PASSWORD_LENGTH, hashPassword, verifyPassword } from '#lib/server/auth/password.ts';
import { SESSION_COOKIE, deleteOtherSessions } from '#lib/server/auth/session.ts';
import { audit } from '#lib/server/events.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals }) => {
	const me = requireStaff(locals);
	return { mustChange: me.mustChangePassword, minLength: MIN_PASSWORD_LENGTH };
};

export const actions = {
	default: async ({ request, locals, cookies, getClientAddress }) => {
		const me = requireStaff(locals);
		const form = await request.formData();
		const current = String(form.get('current') ?? '');
		const next = String(form.get('next') ?? '');
		const confirm = String(form.get('confirm') ?? '');

		const account = db.select().from(user).where(eq(user.id, me.id)).get();
		if (!account || !(await verifyPassword(current, account.passwordHash))) {
			return fail(400, { error: 'Your current password is wrong.' });
		}
		if (next.length < MIN_PASSWORD_LENGTH) {
			return fail(400, { error: `Use at least ${MIN_PASSWORD_LENGTH} characters.` });
		}
		if (next !== confirm) return fail(400, { error: "The new passwords don't match." });
		if (next === current) return fail(400, { error: 'Choose a password you have not used here.' });

		const passwordHash = await hashPassword(next);
		db.transaction((tx) => {
			tx.update(user)
				.set({ passwordHash, mustChangePassword: false })
				.where(eq(user.id, me.id))
				.run();
			audit(tx, {
				actor: me.id,
				action: 'UPDATE',
				entity: 'sys_user',
				entityId: me.id,
				ip: getClientAddress()
			});
		});
		// Sign out every other device that knew the old password.
		const token = cookies.get(SESSION_COOKIE);
		if (token) deleteOtherSessions(me.id, token);

		redirect(303, '/staff');
	}
} satisfies Actions;
