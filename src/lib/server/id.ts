/**
 * UUIDv7 (RFC 9562): 48-bit Unix-ms timestamp + randomness.
 * Time-ordered, so inserts stay at the end of SQLite's B-tree and IDs sort by creation,
 * yet they are globally unique, so any future school system can adopt them without remapping.
 */
export function uuidv7(): string {
	const b = crypto.getRandomValues(new Uint8Array(16));
	let ms = Date.now();
	for (let i = 5; i >= 0; i--) {
		b[i] = ms % 256;
		ms = Math.floor(ms / 256);
	}
	b[6] = (b[6]! & 0x0f) | 0x70;
	b[8] = (b[8]! & 0x3f) | 0x80;
	const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
	return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/** Human-friendly reference code (Crockford base32, no 0/O/1/I/L confusion), e.g. "7KX3QF9M". */
export function refCode(length = 8): string {
	const alphabet = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
	const bytes = crypto.getRandomValues(new Uint8Array(length));
	return Array.from(bytes, (x) => alphabet[x % 32]).join('');
}
