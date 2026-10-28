import adapter from '@sveltejs/adapter-node';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [
		sveltekit({
			compilerOptions: {
				// HARD RULE: runes mode is forced for all app code. Svelte 4 syntax
				// (`export let`, `$:`, `on:click`, `<slot>`) is a compile error.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},
			// precompress: emits .br/.gz next to every client asset at build time,
			// so the LAN path (no Cloudflare in front) still gets brotli.
			adapter: adapter({ precompress: true }),
			// The header/event-based new-version checks still run; this only stops
			// the hourly background poll so idle phones spend zero data.
			version: { pollInterval: 0 },
			csp: {
				mode: 'auto',
				directives: {
					'default-src': ['self'],
					'script-src': ['self'],
					'style-src': ['self'],
					'img-src': ['self', 'data:', 'blob:'],
					'connect-src': ['self'],
					'object-src': ['none'],
					'base-uri': ['self'],
					'form-action': ['self'],
					'frame-ancestors': ['none']
				}
			}
		})
	]
});
