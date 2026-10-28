import { asc, gt } from 'drizzle-orm';
import { db } from '#lib/server/db/index.ts';
import { event } from '#lib/server/db/schema/index.ts';
import { requireIntegration } from '#lib/server/integration-auth.ts';
import type { RequestHandler } from './$types';

/**
 * Event feed for other school systems. Consumers keep the last `seq` they processed and poll
 * GET /api/v1/events?after=<seq>. Each item is a CloudEvents 1.0 JSON envelope.
 */
export const GET: RequestHandler = ({ request, url }) => {
	requireIntegration(request);

	const after = Math.max(0, Number(url.searchParams.get('after')) || 0);
	const limit = Math.min(500, Math.max(1, Number(url.searchParams.get('limit')) || 100));

	const rows = db
		.select()
		.from(event)
		.where(gt(event.seq, after))
		.orderBy(asc(event.seq))
		.limit(limit)
		.all();

	return Response.json({
		events: rows.map((e) => ({
			specversion: '1.0',
			id: e.id,
			source: '/enrollment',
			type: e.type,
			subject: e.subject,
			time: e.time.toISOString(),
			datacontenttype: 'application/json',
			data: e.data,
			seq: e.seq
		})),
		next: rows.at(-1)?.seq ?? after
	});
};
