#!/usr/bin/env node
// Fails on Svelte 4 / SvelteKit 1–2 patterns that LLMs (and old tutorials) keep reintroducing.
// Runes mode already makes some of these compile errors; this catches the rest and explains the fix.
// See AGENTS.md §1–§2.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SRC = join(ROOT, 'src');

/** [regex, applies-to (svelte|ts|all), message] */
const RULES = [
	[/^\s*export\s+let\s/m, 'svelte', '`export let` → `let { x } = $props()`'],
	[/^\s*\$:\s/m, 'svelte', '`$:` → `$derived(...)` or `$effect(...)`'],
	[
		/\son:[a-z]+(\|[a-z|]+)?\s*=/,
		'svelte',
		'`on:event=` → `onevent=` (call preventDefault() in the handler)'
	],
	[/\bcreateEventDispatcher\b/, 'all', '`createEventDispatcher` → callback props (`onselect`)'],
	[/<slot[\s/>]/, 'svelte', '`<slot>` → `{@render children()}` with Snippet props'],
	[
		/\$\$(props|restProps|slots)\b/,
		'svelte',
		'`$$props/$$restProps/$$slots` → `$props()` destructuring'
	],
	[/<svelte:component\b/, 'svelte', '`<svelte:component this={C}>` → `<C />`'],
	[/<svelte:self\b/, 'svelte', '`<svelte:self>` → import the component itself'],
	[/<svelte:fragment\b/, 'svelte', '`<svelte:fragment>` → `{#snippet}`'],
	[
		/\b(beforeUpdate|afterUpdate)\b/,
		'all',
		'`beforeUpdate/afterUpdate` → `$effect.pre` / `$effect`'
	],
	[/\$props\s*</, 'all', '`$props<T>()` is invalid → `let { a }: { a: T } = $props()`'],
	[
		/new\s+[A-Z]\w*\(\s*\{\s*target\s*:/,
		'all',
		'`new Component({ target })` → `mount(Component, { target })`'
	],
	[
		/from\s+['"]svelte\/store['"]/,
		'all',
		'`svelte/store` → `$state` in a .svelte.ts module or createContext'
	],
	[/\bclass:[\w-]+=/, 'svelte', '`class:name={x}` → `class={{ name: x }}`'],
	[
		/from\s+['"]\$app\/stores['"]/,
		'all',
		'`$app/stores` was removed in SvelteKit 3 → `$app/state`'
	],
	[/from\s+['"]\$app\/environment['"]/, 'all', '`$app/environment` → `$app/env`'],
	[
		/from\s+['"]\$env\//,
		'all',
		'`$env/*` is deprecated → declare in src/env.ts, import `$app/env/private|public`'
	],
	[
		/from\s+['"]\$service-worker['"]/,
		'all',
		'`$service-worker` was removed → `$app/manifest`, `$app/env`'
	],
	[/from\s+['"]\$lib\//, 'all', '`$lib/` → `#lib/` with a file extension'],
	[/\binvalidateAll\b/, 'all', '`invalidateAll` → `refreshAll`'],
	[
		/\b(pushState|replaceState)\s*\(/,
		'all',
		'`pushState/replaceState` → `goto(url, { shallow: true, state })`'
	],
	[
		/\bresolveRoute\b|import\s*\{[^}]*\bbase\b[^}]*\}\s*from\s*['"]\$app\/paths['"]/,
		'all',
		'`base`/`resolveRoute` removed → `resolve()` / `asset()`'
	],
	[
		/(?<![.\w$])(json|text)\s*\(/,
		'server',
		'`json()/text()` helpers are deprecated → `Response.json()` / `new Response()`'
	],
	[/data-sveltekit-[a-z-]+="off"/, 'svelte', '`="off"` → `="false"`'],
	[
		/\sstyle(:[\w-]+)?=/,
		'svelte',
		'inline `style=` / `style:` → a CSS class in app.css or staff.css (AGENTS.md §3)'
	],
	[
		/\scapture=/,
		'svelte',
		'`capture=` blocks gallery picking on Android; remove it (AGENTS.md §3)'
	],
	[
		/type=["']number["'][^>]*name=["']lrn|name=["']lrn["'][^>]*type=["']number["']/,
		'svelte',
		'LRN must not be type="number" (drops leading zeros) → inputmode="numeric"'
	]
];

function* walk(dir) {
	for (const name of readdirSync(dir)) {
		const p = join(dir, name);
		if (statSync(p).isDirectory()) yield* walk(p);
		else if (/\.(svelte|ts|js)$/.test(name)) yield p;
	}
}

const stripComments = (s) =>
	s
		.replace(/<!--[\s\S]*?-->/g, '')
		.replace(/\/\*[\s\S]*?\*\//g, '')
		.replace(/^\s*\/\/.*$/gm, '');

let failures = 0;
for (const file of walk(SRC)) {
	const rel = relative(ROOT, file).replaceAll('\\', '/');
	const kind = file.endsWith('.svelte') ? 'svelte' : 'ts';
	const isServer = /\+server\.ts$/.test(file);
	const lines = stripComments(readFileSync(file, 'utf8')).split('\n');

	for (const [re, scope, msg] of RULES) {
		if (scope === 'svelte' && kind !== 'svelte') continue;
		if (scope === 'server' && !isServer) continue;
		const line = lines.findIndex((l) => re.test(l));
		if (line !== -1) {
			console.error(`✖ ${rel}:${line + 1}  ${msg}`);
			failures++;
		}
	}
}

if (failures) {
	console.error(`\n${failures} legacy pattern(s) found. Fix them; see AGENTS.md.`);
	process.exit(1);
}
console.log('✓ guard-svelte5: no Svelte 4 / SvelteKit 2 patterns');
