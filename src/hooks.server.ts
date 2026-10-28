import type { Handle, ServerInit } from '@sveltejs/kit/hooks';
import { building } from '$app/env';
import { closeDb, runMigrations } from '#lib/server/db/index.ts';

export const init: ServerInit = () => {
	if (building) return;
	runMigrations();
	process.on('sveltekit:shutdown', () => closeDb());
};

// Routes whose HTML contains personal data: never cached by browsers, proxies or the service worker.
const PRIVATE_PREFIXES = ['/enroll', '/api/'];

export const handle: Handle = async ({ event, resolve }) => {
	const response = await resolve(event);
	const h = response.headers;

	h.set('x-content-type-options', 'nosniff');
	h.set('referrer-policy', 'strict-origin-when-cross-origin');
	h.set('permissions-policy', 'camera=(self), geolocation=(), microphone=(), interest-cohort=()');

	if (PRIVATE_PREFIXES.some((p) => event.url.pathname.startsWith(p))) {
		h.set('cache-control', 'private, no-store');
	}
	return response;
};
