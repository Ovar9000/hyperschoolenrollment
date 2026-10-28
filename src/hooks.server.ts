import { redirect } from '@sveltejs/kit';
import type { Handle, ServerInit } from '@sveltejs/kit/hooks';
import { building } from '$app/env';
import { closeDb, runMigrations } from '#lib/server/db/index.ts';
import {
	SESSION_COOKIE,
	clearSessionCookie,
	setSessionCookie,
	validateSession
} from '#lib/server/auth/session.ts';

export const init: ServerInit = () => {
	if (building) return;
	runMigrations();
	process.on('sveltekit:shutdown', () => closeDb());
};

// Routes whose HTML contains personal data: never cached by browsers, proxies or the service worker.
const PRIVATE_PREFIXES = ['/enroll', '/status', '/api/', '/staff'];
// Staff pages reachable without a session.
const PUBLIC_STAFF_PATHS = ['/staff/login'];
const PASSWORD_PATH = '/staff/account/password';

export const handle: Handle = async ({ event, resolve }) => {
	const path = event.url.pathname;

	if (path === '/staff' || path.startsWith('/staff/')) {
		const token = event.cookies.get(SESSION_COOKIE);
		const result = token ? validateSession(token) : null;
		if (token && !result) clearSessionCookie(event.cookies);
		if (token && result) setSessionCookie(event.cookies, token, result.expiresAt);
		event.locals.user = result?.user ?? null;

		if (!event.locals.user && !PUBLIC_STAFF_PATHS.includes(path)) {
			const next = path === '/staff' ? '' : `?next=${encodeURIComponent(path)}`;
			redirect(303, `/staff/login${next}`);
		}
		if (
			event.locals.user?.mustChangePassword &&
			path !== PASSWORD_PATH &&
			path !== '/staff/logout'
		) {
			redirect(303, PASSWORD_PATH);
		}
	} else {
		event.locals.user = null;
	}

	const response = await resolve(event);
	const h = response.headers;

	h.set('x-content-type-options', 'nosniff');
	h.set('referrer-policy', 'strict-origin-when-cross-origin');
	h.set('permissions-policy', 'camera=(self), geolocation=(), microphone=(), interest-cohort=()');

	if (PRIVATE_PREFIXES.some((p) => path.startsWith(p))) {
		h.set('cache-control', 'private, no-store');
	}
	if (path.startsWith('/staff')) h.set('x-robots-tag', 'noindex, nofollow');
	return response;
};
