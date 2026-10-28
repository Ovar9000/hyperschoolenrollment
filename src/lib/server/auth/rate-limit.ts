// In-memory login throttle (one Node process, so no shared store needed).
const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES = 5;

const failures = new Map<string, { count: number; resetAt: number }>();

export function isLockedOut(key: string): boolean {
	const entry = failures.get(key);
	if (!entry) return false;
	if (entry.resetAt < Date.now()) {
		failures.delete(key);
		return false;
	}
	return entry.count >= MAX_FAILURES;
}

export function recordFailure(key: string) {
	const entry = failures.get(key);
	if (!entry || entry.resetAt < Date.now()) {
		failures.set(key, { count: 1, resetAt: Date.now() + WINDOW_MS });
	} else {
		entry.count++;
	}
}

export function clearFailures(key: string) {
	failures.delete(key);
}
