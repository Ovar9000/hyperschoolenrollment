import { defineEnvVars } from '@sveltejs/kit/env';

const optional = (fallback: string) => (value: string | undefined) => value || fallback;

export const variables = defineEnvVars({
	DATABASE_URL: {
		description: 'Path to the SQLite file. The directory must exist and be writable.',
		schema: optional('data/enrollment.db')
	},
	UPLOAD_DIR: {
		description: 'Directory for compressed document uploads (never stored in SQLite).',
		schema: optional('data/uploads')
	},
	INTEGRATION_TOKENS: {
		description:
			'Comma-separated bearer tokens for school-wide systems reading /api/v1. Empty = API disabled.',
		schema: optional('')
	},
	PUBLIC_SCHOOL_NAME: {
		description: 'Display name of the college.',
		public: true,
		static: true,
		schema: optional('San Pascual Polytechnic College')
	}
});
