import { createHash, randomBytes } from 'node:crypto';
import type { Cookies } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.ts';
import { person, session, user, type Role } from '../db/schema/index.ts';

export const SESSION_COOKIE = 'spc_staff';
const TTL_MS = 10 * 60 * 60 * 1000; // one working day

export interface StaffUser {
	id: string;
	personId: string;
	username: string;
	displayName: string;
	roles: Role[];
	mustChangePassword: boolean;
}

const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

export function createSession(userId: string) {
	const token = randomBytes(32).toString('base64url');
	const expiresAt = new Date(Date.now() + TTL_MS);
	db.insert(session)
		.values({ idHash: hashToken(token), userId, expiresAt })
		.run();
	return { token, expiresAt };
}

/** Returns the user, sliding the expiry forward once half the session has passed. */
export function validateSession(token: string): { user: StaffUser; expiresAt: Date } | null {
	const idHash = hashToken(token);
	const row = db
		.select({
			expiresAt: session.expiresAt,
			id: user.id,
			personId: user.personId,
			username: user.username,
			roles: user.roles,
			active: user.active,
			mustChangePassword: user.mustChangePassword,
			firstName: person.firstName,
			lastName: person.lastName
		})
		.from(session)
		.innerJoin(user, eq(user.id, session.userId))
		.innerJoin(person, eq(person.id, user.personId))
		.where(eq(session.idHash, idHash))
		.get();

	if (!row) return null;
	if (!row.active || row.expiresAt.getTime() < Date.now()) {
		db.delete(session).where(eq(session.idHash, idHash)).run();
		return null;
	}

	let expiresAt = row.expiresAt;
	if (expiresAt.getTime() - Date.now() < TTL_MS / 2) {
		expiresAt = new Date(Date.now() + TTL_MS);
		db.update(session).set({ expiresAt }).where(eq(session.idHash, idHash)).run();
	}

	return {
		expiresAt,
		user: {
			id: row.id,
			personId: row.personId,
			username: row.username,
			displayName: `${row.firstName} ${row.lastName}`,
			roles: row.roles,
			mustChangePassword: row.mustChangePassword
		}
	};
}

export function deleteSession(token: string) {
	db.delete(session)
		.where(eq(session.idHash, hashToken(token)))
		.run();
}

export function deleteOtherSessions(userId: string, keepToken: string) {
	const keep = hashToken(keepToken);
	const rows = db
		.select({ idHash: session.idHash })
		.from(session)
		.where(eq(session.userId, userId))
		.all();
	for (const r of rows) {
		if (r.idHash !== keep) db.delete(session).where(eq(session.idHash, r.idHash)).run();
	}
}

/** Scoped to /staff: student pages never receive the staff cookie. */
export function setSessionCookie(cookies: Cookies, token: string, expiresAt: Date) {
	cookies.set(SESSION_COOKIE, token, {
		path: '/staff',
		httpOnly: true,
		sameSite: 'strict',
		expires: expiresAt
	});
}

export function clearSessionCookie(cookies: Cookies) {
	cookies.delete(SESSION_COOKIE, { path: '/staff' });
}
