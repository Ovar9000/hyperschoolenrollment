import { fail, redirect } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { db } from '#lib/server/db/index.ts';
import { user } from '#lib/server/db/schema/index.ts';
import { verifyAgainstDummy, verifyPassword } from '#lib/server/auth/password.ts';
import { clearFailures, isLockedOut, recordFailure } from '#lib/server/auth/rate-limit.ts';
import { createSession, setSessionCookie } from '#lib/server/auth/session.ts';
import { audit } from '#lib/server/events.ts';
import type { Actions, PageServerLoad } from './$types';

/** Only same-app staff paths; anything else (//evil.com, https://…) falls back to the dashboard. */
function safeNext(next: string | null): string {
	return next && /^\/staff(\/[\w\-/]*)?$/.test(next) ? next : '/staff';
}

export const load: PageServerLoad = ({ locals, url }) => {
	if (locals.user) redirect(303, safeNext(url.searchParams.get('next')));
};

export const actions = {
	default: async ({ request, cookies, url, getClientAddress }) => {
		const form = await request.formData();
		const username = String(form.get('username') ?? '')
			.trim()
			.toLowerCase();
		const password = String(form.get('password') ?? '');
		const ip = getClientAddress();
		const throttleKey = `${ip}|${username}`;

		if (isLockedOut(throttleKey)) {
			return fail(429, { username, error: 'Too many attempts. Wait 15 minutes and try again.' });
		}

		const account = username
			? db.select().from(user).where(eq(user.username, username)).get()
			: undefined;
		const ok =
			account && account.active
				? await verifyPassword(password, account.passwordHash)
				: await verifyAgainstDummy(password);

		if (!ok || !account) {
			recordFailure(throttleKey);
			return fail(400, { username, error: 'Wrong username or password.' });
		}

		clearFailures(throttleKey);
		const { token, expiresAt } = createSession(account.id);
		setSessionCookie(cookies, token, expiresAt);
		db.transaction((tx) => {
			tx.update(user).set({ lastLoginAt: new Date() }).where(eq(user.id, account.id)).run();
			audit(tx, {
				actor: account.id,
				action: 'LOGIN',
				entity: 'sys_user',
				entityId: account.id,
				ip
			});
		});

		redirect(303, safeNext(url.searchParams.get('next')));
	}
} satisfies Actions;
