import { sql } from 'drizzle-orm';
import { db } from '#lib/server/db/index.ts';

// For uptime checks / the UPS shutdown script. Touches the DB so a locked or missing file shows up.
export const GET = () => {
	db.get(sql`select 1`);
	return new Response('ok', { headers: { 'cache-control': 'no-store' } });
};
