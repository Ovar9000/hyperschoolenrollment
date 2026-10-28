#!/usr/bin/env node
// Performance budget: boots the production build, loads each route like a phone would, and sums
// the gzipped JS/CSS the HTML actually references (modulepreload + entry imports + stylesheets).
// Lazy `import()` chunks are not counted, which is the point of lazy-loading them.
// Run after `npm run build`. See AGENTS.md §3.
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const BUDGET = { js: 50 * 1024, css: 15 * 1024 };
const ROUTES = ['/', '/privacy', '/offline', '/enroll', '/enroll/done?ref=ABCD2345'];
const PORT = 4179;
const ORIGIN = `http://127.0.0.1:${PORT}`;
const ROOT = fileURLToPath(new URL('..', import.meta.url));

const dataDir = mkdtempSync(join(tmpdir(), 'budget-'));
const server = spawn(process.execPath, ['build'], {
	cwd: ROOT,
	env: {
		...process.env,
		PORT: String(PORT),
		HOST: '127.0.0.1',
		DATABASE_URL: join(dataDir, 'budget.db'),
		INTEGRATION_TOKENS: ''
	},
	stdio: ['ignore', 'ignore', 'inherit']
});

const kb = (n) => `${(n / 1024).toFixed(1)} KB`;
const gz = (buf) => gzipSync(buf, { level: 9 }).length;

async function waitForServer() {
	for (let i = 0; i < 50; i++) {
		try {
			if ((await fetch(`${ORIGIN}/healthz`)).ok) return;
		} catch {}
		await new Promise((r) => setTimeout(r, 200));
	}
	throw new Error('server did not start (did you run `npm run build`?)');
}

function assetUrls(html, pageUrl) {
	const js = new Set();
	const css = new Set();
	for (const m of html.matchAll(/<link\b[^>]*>/g)) {
		const tag = m[0];
		const href = tag.match(/href="([^"]+)"/)?.[1];
		if (!href) continue;
		if (/rel="modulepreload"/.test(tag)) js.add(new URL(href, pageUrl).href);
		if (/rel="stylesheet"/.test(tag)) css.add(new URL(href, pageUrl).href);
	}
	for (const m of html.matchAll(/<script\b[^>]*\bsrc="([^"]+)"/g))
		js.add(new URL(m[1], pageUrl).href);
	for (const m of html.matchAll(/import\(\s*"([^"]+\.js)"\s*\)/g))
		js.add(new URL(m[1], pageUrl).href);
	return { js, css };
}

async function sizeOf(urls) {
	let total = 0;
	for (const u of urls) total += gz(Buffer.from(await (await fetch(u)).arrayBuffer()));
	return total;
}

let failed = false;
try {
	await waitForServer();
	console.log(`Budget per route: JS ≤ ${kb(BUDGET.js)} gz, CSS ≤ ${kb(BUDGET.css)} gz\n`);
	console.log('route'.padEnd(28) + 'html'.padStart(10) + 'js'.padStart(10) + 'css'.padStart(10));

	for (const route of ROUTES) {
		const pageUrl = ORIGIN + route;
		const res = await fetch(pageUrl);
		if (!res.ok) throw new Error(`${route} → HTTP ${res.status}`);
		const html = await res.text();
		const { js, css } = assetUrls(html, pageUrl);
		const sizes = { html: gz(Buffer.from(html)), js: await sizeOf(js), css: await sizeOf(css) };
		const over = sizes.js > BUDGET.js || sizes.css > BUDGET.css;
		failed ||= over;
		console.log(
			route.padEnd(28) +
				kb(sizes.html).padStart(10) +
				kb(sizes.js).padStart(10) +
				kb(sizes.css).padStart(10) +
				(over ? '  ✖ OVER BUDGET' : '')
		);
	}

	const sw = await fetch(`${ORIGIN}/service-worker.js`);
	if (sw.ok)
		console.log(
			`\nservice-worker.js: ${kb(gz(Buffer.from(await sw.arrayBuffer())))} (once, then cached)`
		);
} catch (e) {
	console.error(e.message);
	failed = true;
} finally {
	server.kill();
	await new Promise((r) => server.once('exit', r));
	rmSync(dataDir, { recursive: true, force: true });
}

console.log(failed ? '\n✖ budget check failed' : '\n✓ all routes within budget');
process.exit(failed ? 1 : 0);
