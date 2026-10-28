import { error } from '@sveltejs/kit';
import { db } from '#lib/server/db/index.ts';
import { requireStaff } from '#lib/server/auth/guard.ts';
import { loadRegistration } from '#lib/server/enrollment/cor.ts';
import { audit } from '#lib/server/events.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals, params, getClientAddress }) => {
	const me = requireStaff(locals, 'REGISTRAR', 'CASHIER', 'DEAN');
	const reg = loadRegistration(params.id);
	if (!reg) error(404, 'Application not found');
	if (reg.app.status !== 'ASSESSED' && reg.app.status !== 'OFFICIAL') {
		error(409, 'Only assessed or officially enrolled students have a printable form.');
	}
	db.transaction((tx) =>
		audit(tx, {
			actor: me.id,
			action: 'EXPORT',
			entity: 'enr_application',
			entityId: reg.app.id,
			ip: getClientAddress()
		})
	);
	return { reg, printedAt: new Date() };
};
