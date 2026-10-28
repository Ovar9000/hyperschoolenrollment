import { self } from '$app/service-worker';
import { version } from '$app/env';
import { assets, immutable, prerendered } from '$app/manifest';

// Caches ONLY build output, static files and prerendered public pages, so repeat visits cost
// near-zero data. Dynamic HTML (forms, anything with personal data) is never cached.
const CACHE = `cache-${version}`;

// Manifest paths are relative to the base path, which is the service worker's scope.
// (`resolve()` from $app/paths only accepts route paths, not build-file paths.)
const toPath = (p: string) => new URL(p, self.registration.scope).pathname;
const OFFLINE = toPath('offline');
const PRECACHE = [...immutable, ...assets, ...prerendered].map((f) => toPath(f.path));
const PRECACHED = new Set(PRECACHE);

self.addEventListener('install', (event) => {
	event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)));
});

self.addEventListener('activate', (event) => {
	event.waitUntil(
		caches
			.keys()
			.then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
	);
});

self.addEventListener('fetch', (event) => {
	const { request } = event;
	if (request.method !== 'GET') return;
	const url = new URL(request.url);
	if (url.origin !== self.location.origin) return;

	if (PRECACHED.has(url.pathname)) {
		event.respondWith(caches.match(url.pathname).then((hit) => hit ?? fetch(request)));
		return;
	}

	// Network only for everything else; show the offline page if a navigation fails.
	if (request.mode === 'navigate') {
		event.respondWith(
			fetch(request).catch(async () => (await caches.match(OFFLINE)) ?? Response.error())
		);
	}
});
