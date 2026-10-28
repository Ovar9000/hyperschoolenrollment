import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const csr = false;

// Shows only the reference code (not personal data). Status lookup needs student login (TODO).
export const load: PageServerLoad = ({ url }) => {
	const ref = url.searchParams.get('ref') ?? '';
	if (!/^[0-9A-HJKMNP-TV-Z]{8}$/.test(ref)) error(404, 'Not found');
	return { ref };
};
