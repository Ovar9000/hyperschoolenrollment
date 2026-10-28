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
// Hashed build files and static assets never change under the same URL: safe to serve cache-first.
const STATIC = new Set([...immutable, ...assets].map((f) => toPath(f.path)));
// Prerendered HTML keeps its URL across deploys, so it is network-first (cache = offline fallback).
const PAGES = new Set(prerendered.map((f) => toPath(f.path)));
const PRECACHE = [...STATIC, ...PAGES];

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

	if (STATIC.has(url.pathname)) {
		event.respondWith(caches.match(url.pathname).then((hit) => hit ?? fetch(request)));
		return;
	}

	// Pages: always try the network. Offline, fall back to the cached copy of a public page,
	// then to the offline page. Pages with personal data are never in the cache.
	if (request.mode === 'navigate' || PAGES.has(url.pathname)) {
		event.respondWith(
			fetch(request).catch(
				async () =>
					(await caches.match(url.pathname)) ?? (await caches.match(OFFLINE)) ?? Response.error()
			)
		);
	}
});
