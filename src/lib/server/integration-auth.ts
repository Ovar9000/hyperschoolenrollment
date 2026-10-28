import { timingSafeEqual } from 'node:crypto';
import { error } from '@sveltejs/kit';
import { INTEGRATION_TOKENS } from '$app/env/private';

const tokens = INTEGRATION_TOKENS.split(',')
	.map((t) => t.trim())
	.filter((t) => t.length >= 32)
	.map((t) => Buffer.from(t));

/**
 * Guards /api/v1/*: the read API for other school systems (LMS sync, library, finance, CHED tools).
 * Tokens are machine credentials set in INTEGRATION_TOKENS; replace with OAuth2 client
 * credentials once a school-wide identity provider exists.
 */
export function requireIntegration(request: Request): void {
	if (tokens.length === 0) error(404, 'Not found');

	const header = request.headers.get('authorization') ?? '';
	const presented = Buffer.from(header.startsWith('Bearer ') ? header.slice(7) : '');
	const ok = tokens.some((t) => t.length === presented.length && timingSafeEqual(t, presented));
	if (!ok) error(401, 'Unauthorized');
}
