import { error, fail } from '@sveltejs/kit';
import { and, asc, desc, eq, inArray, or } from 'drizzle-orm';
import { db } from '#lib/server/db/index.ts';
import {
	application,
	consent,
	event,
	person,
	personIdentifier,
	program,
	section,
	user
} from '#lib/server/db/schema/index.ts';
import { hasRole, requireStaff } from '#lib/server/auth/guard.ts';
import { loadRegistration } from '#lib/server/enrollment/cor.ts';
import { runStep } from '#lib/server/enrollment/run.ts';
import {
	accept,
	assess,
	assignSection,
	cancel,
	computeAssessment,
	revertAssessment,
	setRequirement,
	type FheStatus
} from '#lib/server/enrollment/workflow.ts';
import { audit } from '#lib/server/events.ts';
import { FHE_OPTIONS, REQUIREMENTS, type RequirementKind } from '#lib/enrollment.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals, params, getClientAddress }) => {
	const me = requireStaff(locals, 'REGISTRAR', 'DEAN');
	const reg = loadRegistration(params.id);
	if (!reg) error(404, 'Application not found');
	const { app } = reg;

	const raw = db
		.select({ termId: application.termId, sectionId: application.sectionId })
		.from(application)
		.where(eq(application.id, app.id))
		.get()!;
	const student = db.select().from(person).where(eq(person.id, app.personId)).get()!;
	const identifiers = db
		.select({ scheme: personIdentifier.scheme, value: personIdentifier.value })
		.from(personIdentifier)
		.where(eq(personIdentifier.personId, app.personId))
		.all();
	const consents = db
		.select()
		.from(consent)
		.where(eq(consent.personId, app.personId))
		.orderBy(desc(consent.grantedAt))
		.all();

	const sections = db
		.select({
			id: section.id,
			code: section.code,
			enrolled: section.enrolled,
			capacity: section.capacity
		})
		.from(section)
		.where(and(eq(section.termId, raw.termId), eq(section.programCode, app.programCode)))
		.orderBy(asc(section.code))
		.all();

	// Fee preview for each FHE choice, so the Registrar sees the effect before issuing.
	const fheEligible =
		db
			.select({ e: program.fheEligible })
			.from(program)
			.where(eq(program.code, app.programCode))
			.get()?.e ?? false;
	const preview =
		app.status === 'PROVISIONAL' && raw.sectionId
			? db.transaction((tx) =>
					FHE_OPTIONS.filter((o) => fheEligible || o.value !== 'FHE_COVERED').map((o) => ({
						...o,
						...computeAssessment(tx, app.id, o.value)
					}))
				)
			: [];

	const events = db
		.select({ seq: event.seq, type: event.type, time: event.time, data: event.data })
		.from(event)
		.where(or(eq(event.subject, app.id), eq(event.subject, app.personId)))
		.orderBy(asc(event.seq))
		.all();
	const actorIds = [
		...new Set(
			events
				.map((e) => (e.data as { by?: string }).by)
				.filter((id): id is string => typeof id === 'string')
		)
	];
	const actors = new Map(
		actorIds.length
			? db
					.select({ id: user.id, first: person.firstName, last: person.lastName })
					.from(user)
					.innerJoin(person, eq(person.id, user.personId))
					.where(inArray(user.id, actorIds))
					.all()
					.map((a) => [a.id, `${a.first} ${a.last}`])
			: []
	);

	// RA 10173: every staff view of a student's personal data is logged.
	db.transaction((tx) =>
		audit(tx, {
			actor: me.id,
			action: 'READ',
			entity: 'enr_application',
			entityId: app.id,
			ip: getClientAddress()
		})
	);

	const received = new Map(reg.received.map((r) => [r.kind, r.receivedAt]));
	return {
		...reg,
		student,
		identifiers,
		consents,
		sections,
		currentSectionId: raw.sectionId,
		fheEligible,
		preview,
		canEdit: hasRole(me, 'REGISTRAR'),
		requirements: REQUIREMENTS.map((r) => ({ ...r, receivedAt: received.get(r.kind) ?? null })),
		timeline: events.map((e) => {
			const d = e.data as Record<string, unknown>;
			return {
				seq: e.seq,
				type: e.type,
				time: e.time,
				by: typeof d.by === 'string' ? (actors.get(d.by) ?? 'Staff') : null,
				detail: d
			};
		})
	};
};

function actorOf(locals: App.Locals, ip: string) {
	const me = requireStaff(locals, 'REGISTRAR');
	return { userId: me.id, ip };
}

export const actions = {
	accept: ({ locals, params, getClientAddress }) => {
		const actor = actorOf(locals, getClientAddress());
		return runStep(
			(tx) => accept(tx, params.id, actor),
			'Accepted. The student is now provisional.'
		);
	},

	section: async ({ locals, params, request, getClientAddress }) => {
		const actor = actorOf(locals, getClientAddress());
		const sectionId = String((await request.formData()).get('sectionId') ?? '');
		if (!sectionId) return fail(400, { error: 'Choose a section.' });
		return runStep(
			(tx) => assignSection(tx, params.id, sectionId, actor),
			'Section saved. The student is enrolled in all its classes.'
		);
	},

	requirement: async ({ locals, params, request, getClientAddress }) => {
		const actor = actorOf(locals, getClientAddress());
		const form = await request.formData();
		const kind = String(form.get('kind')) as RequirementKind;
		if (!REQUIREMENTS.some((r) => r.kind === kind))
			return fail(400, { error: 'Unknown requirement.' });
		const received = form.get('received') === 'yes';
		return runStep(
			(tx) => setRequirement(tx, params.id, kind, received, actor),
			received ? 'Marked as received.' : 'Marked as not received.'
		);
	},

	assess: async ({ locals, params, request, getClientAddress }) => {
		const actor = actorOf(locals, getClientAddress());
		const fhe = String((await request.formData()).get('fheStatus') ?? '') as FheStatus;
		if (!FHE_OPTIONS.some((o) => o.value === fhe))
			return fail(400, { error: 'Choose the FHE status.' });
		return runStep(
			(tx) => assess(tx, params.id, fhe, actor),
			'Assessment issued. The student can now pay at the Cashier.'
		);
	},

	revert: ({ locals, params, getClientAddress }) => {
		const actor = actorOf(locals, getClientAddress());
		return runStep((tx) => revertAssessment(tx, params.id, actor), 'Assessment undone.');
	},

	cancel: async ({ locals, params, request, getClientAddress }) => {
		const actor = actorOf(locals, getClientAddress());
		const reason = String((await request.formData()).get('reason') ?? '');
		return runStep(
			(tx) => cancel(tx, params.id, reason, actor),
			'Application cancelled and seats released.'
		);
	}
} satisfies Actions;
