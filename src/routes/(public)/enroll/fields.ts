// Shared by the form (+page.svelte) and the action (+page.server.ts).
export const FIELDS = [
	'last_name',
	'first_name',
	'middle_name',
	'suffix',
	'sex',
	'birthdate',
	'lrn',
	'mobile',
	'email',
	'program',
	'mode',
	'guardian_name'
] as const;

export type Field = (typeof FIELDS)[number];
export type FormErrors = Partial<Record<Field | 'consent' | 'form', string>>;

/** Bump when the privacy notice text changes; stored with every consent record. */
export const NOTICE_VERSION = '2026-10-v1';
