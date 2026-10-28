// Shared by client (instant feedback) and server (the authority). Plain functions, zero dependencies.

export const LRN_PATTERN = '[0-9]{12}';

export function isLrn(value: string): boolean {
	return /^\d{12}$/.test(value);
}

/** Trims, collapses whitespace, and uppercases, matching PSA civil-registry style. */
export function normalizeName(value: string): string {
	return value.trim().replace(/\s+/g, ' ').toUpperCase();
}

/** Accepts 09XXXXXXXXX or +639XXXXXXXXX; returns the 09 form. */
export function normalizeMobile(value: string): string | null {
	const digits = value.replace(/[\s-]/g, '');
	if (/^09\d{9}$/.test(digits)) return digits;
	if (/^\+639\d{9}$/.test(digits)) return '0' + digits.slice(3);
	return null;
}

/** Age in whole years on `on` (both ISO YYYY-MM-DD). */
export function ageOn(birthdate: string, on: string): number {
	const [by, bm, bd] = birthdate.split('-').map(Number) as [number, number, number];
	const [y, m, d] = on.split('-').map(Number) as [number, number, number];
	return y - by - (m < bm || (m === bm && d < bd) ? 1 : 0);
}

/** Today's date in Asia/Manila as ISO YYYY-MM-DD (the server may run in UTC). */
export function todayInManila(): string {
	return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(new Date());
}
