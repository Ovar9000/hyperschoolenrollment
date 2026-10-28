// Client-safe enrollment constants shared by staff screens, the student status page and the schema.

export const REQUIREMENTS = [
	{ kind: 'SF9', label: 'SF9 / Form 138 (Report Card)', note: 'Original' },
	{ kind: 'PSA_BIRTH_CERT', label: 'PSA Birth Certificate', note: 'Original or certified copy' },
	{ kind: 'GOOD_MORAL', label: 'Certificate of Good Moral Character', note: 'Original' },
	{ kind: 'ID_PHOTO', label: '2×2 ID photos', note: '2 copies' },
	{ kind: 'SF10', label: 'SF10 / Form 137', note: 'Sent school-to-school by your SHS' }
] as const;

export type RequirementKind = (typeof REQUIREMENTS)[number]['kind'];

export const FHE_OPTIONS = [
	{ value: 'FHE_COVERED', label: 'Free Higher Education (RA 10931)' },
	{ value: 'PAYING_OPT_OUT', label: 'Paying: signed the FHE opt-out form' },
	{
		value: 'NOT_APPLICABLE',
		label: 'Not eligible (prior degree, over residency, or program not covered)'
	}
] as const;

export const PAYMENT_METHODS = [
	{ value: 'CASH', label: 'Cash' },
	{ value: 'GCASH', label: 'GCash' },
	{ value: 'LANDBANK', label: 'LandBank / Link.BizPortal' },
	{ value: 'OTHER', label: 'Other' }
] as const;
