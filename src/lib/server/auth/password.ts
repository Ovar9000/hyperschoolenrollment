// Self-contained (node:crypto only) so scripts/staff.ts can import it outside SvelteKit.
import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from 'node:crypto';

// OWASP Password Storage Cheat Sheet minimum for scrypt: N=2^17, r=8, p=1 (~128 MiB, ~0.3 s).
// Runs on libuv's thread pool, so it doesn't block other requests.
const PARAMS = { N: 2 ** 17, r: 8, p: 1 };
const KEY_LENGTH = 32;
const MAXMEM = 256 * 1024 * 1024;

export const MIN_PASSWORD_LENGTH = 12;

function derive(password: string, salt: Buffer, length: number, opts: ScryptOptions) {
	return new Promise<Buffer>((resolve, reject) =>
		scrypt(password.normalize('NFKC'), salt, length, { ...opts, maxmem: MAXMEM }, (err, key) =>
			err ? reject(err) : resolve(key)
		)
	);
}

/** Format: scrypt$N$r$p$salt$key (base64url), so parameters can be raised later. */
export async function hashPassword(password: string): Promise<string> {
	const salt = randomBytes(16);
	const key = await derive(password, salt, KEY_LENGTH, PARAMS);
	const { N, r, p } = PARAMS;
	return `scrypt$${N}$${r}$${p}$${salt.toString('base64url')}$${key.toString('base64url')}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
	const [alg, n, r, p, salt, key] = stored.split('$');
	if (alg !== 'scrypt' || !n || !r || !p || !salt || !key) return false;
	const expected = Buffer.from(key, 'base64url');
	const actual = await derive(password, Buffer.from(salt, 'base64url'), expected.length, {
		N: Number(n),
		r: Number(r),
		p: Number(p)
	});
	return timingSafeEqual(actual, expected);
}

let dummy: Promise<string> | undefined;

/** Burns the same time as a real check, so "no such user" and "wrong password" look identical. */
export async function verifyAgainstDummy(password: string): Promise<false> {
	dummy ??= hashPassword(randomBytes(16).toString('hex'));
	await verifyPassword(password, await dummy);
	return false;
}
