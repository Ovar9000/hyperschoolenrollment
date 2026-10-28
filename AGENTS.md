# AGENTS.md — rules for AI coding agents (and humans)

Read this whole file before writing code. These are **hard rules**: a change that breaks one is wrong even if it works.
`npm run verify` enforces most of them mechanically (svelte-check, `scripts/guard-svelte5.mjs`, build, JS budget).

## Project

Mobile-first college enrollment system for Philippine campuses. Students enroll on ₱3,500–₱6,000 Android phones
over congested mobile data; the server is one N100 mini PC. **Every byte sent to a phone must justify itself.**

- Stack: **SvelteKit 3** + **Svelte 5 (runes only)** + **SQLite (WAL)** via **Drizzle ORM** + `better-sqlite3`, `adapter-node`.
- Toolchain floor: Node ≥ 22.17, TypeScript 6, Vite 8. Package manager: npm. Versions are pinned exactly — do not bump casually.
- Architecture and the "open system" contract: [docs/architecture.md](docs/architecture.md). Read it before touching the schema or `/api`.

## 0. Your training data is probably stale — check the docs

SvelteKit 3 shipped on 2026-10-01. Most models were trained on Svelte 4 / SvelteKit 1–2 code and will regress to it.
**Do not write Svelte or SvelteKit code from memory.** Look it up first:

- Svelte MCP server (configured in `.mcp.json`; tools below), or the CLI: `npx @sveltejs/mcp get-documentation "<section>"`
- Plain-text docs: https://svelte.dev/docs/svelte/llms.txt and https://svelte.dev/docs/kit/llms.txt
- SvelteKit 3 migration guide (what changed from v2): https://svelte.dev/docs/kit/migrating-to-sveltekit-3

## 1. Svelte 5 — forbidden → required

Runes mode is forced in `vite.config.ts`; legacy syntax will not compile. Never "fix" an error by turning runes off.

| ❌ Never write (Svelte 4 / legacy)                    | ✅ Write instead (Svelte 5)                                                      |
| ----------------------------------------------------- | -------------------------------------------------------------------------------- |
| `export let name;`                                    | `let { name }: { name: string } = $props();`                                     |
| `export let value` + `bind:value` from parent         | `let { value = $bindable() } = $props();`                                        |
| `$props<{ cap: number }>()` (generic form, invalid)   | `let { cap }: { cap: number } = $props();`                                       |
| `$$props`, `$$restProps`                              | `let { a, ...rest } = $props();`                                                 |
| `let count = 0;` relied on as reactive                | `let count = $state(0);`                                                         |
| `$: doubled = count * 2;`                             | `let doubled = $derived(count * 2);` / `$derived.by(() => { ... })`              |
| `$: { sideEffect(); }`                                | event handler first; `$effect(() => { ... })` only for external sync             |
| `$effect(() => { total = a + b; })` (state in effect) | `let total = $derived(a + b);`                                                   |
| `on:click={fn}`, `on:submit\|preventDefault`          | `onclick={fn}`; call `event.preventDefault()` inside the handler                 |
| `createEventDispatcher()` / `dispatch('select', x)`   | callback prop: `let { onselect } = $props(); onselect?.(x);`                     |
| `<slot />`, `<slot name="x" />`, `$$slots`            | `let { children }: { children: Snippet } = $props(); {@render children()}`       |
| `<svelte:fragment slot="x">`                          | `{#snippet x()}...{/snippet}` passed as a prop                                   |
| `<svelte:component this={C} />`                       | `<C />` (components are dynamic by default)                                      |
| `<svelte:self>`                                       | `import Self from './ThisFile.svelte'`                                           |
| `beforeUpdate` / `afterUpdate`                        | `$effect.pre` / `$effect`                                                        |
| `new Component({ target })`                           | `mount(Component, { target })`                                                   |
| `writable()` stores for component/shared state        | `$state` in a class or object inside a `.svelte.ts` module, or `createContext`   |
| `use:myAction`                                        | `{@attach myAttachment}` (exception: SvelteKit's `use:enhance` is still correct) |
| `class:active={on}`                                   | `class={{ active: on }}`                                                         |

More rules:

- `$state.raw` for large arrays or objects that are replaced, not mutated (API results, section lists). Deep proxies cost CPU on cheap phones.
- `$effect` is an escape hatch, used only to sync with something outside Svelte (canvas, a third-party widget). Never to copy
  state into state. If the trigger is user input, use an event handler instead (see the draft saving in `/enroll`).
  Never wrap an effect body in `if (browser)`; effects don't run on the server.
- Treat props as changing: anything computed from a prop is `$derived`.
- Keyed each blocks always: `{#each sections as s (s.id)}`. Never key by index.
- Shared state lives in a `.svelte.ts` file. You can't export a reassigned `$state` binding; export an object or class instead.
- Run the Svelte autofixer on every component you write or edit until it reports nothing.

## 2. SvelteKit 3 — forbidden → required

| ❌ Never (SvelteKit 1/2)                              | ✅ SvelteKit 3                                                     |
| ----------------------------------------------------- | ------------------------------------------------------------------ |
| `svelte.config.js`                                    | options go in `sveltekit({ ... })` in `vite.config.ts`             |
| `import x from '$lib/foo'`                            | `import x from '#lib/foo.ts'` (extension required)                 |
| `$app/stores`, `$page`, `$navigating`                 | `import { page, navigating } from '$app/state'` → `page.url`       |
| `$app/environment`                                    | `$app/env` (`browser`, `dev`, `building`, `version`)               |
| `$env/static/private`, `$env/dynamic/*`               | declare in `src/env.ts`, import from `$app/env/private` / `public` |
| `$service-worker`                                     | `$app/service-worker`, `$app/manifest`, `$app/env`, `$app/paths`   |
| `invalidateAll()`, `goto(u, { invalidateAll: true })` | `refreshAll()`, `goto(u, { refreshAll: true })`                    |
| `pushState` / `replaceState` from `$app/navigation`   | `goto(url, { shallow: true, state })`                              |
| `base`, `assets`, `resolveRoute` from `$app/paths`    | `resolve('route')`, `asset('file.png')` (no leading `/`)           |
| `json(data)`, `text(s)` helpers                       | `Response.json(data)`, `new Response(s)`                           |
| `error(400, { message, code })`                       | `error(400, 'message', { code })`                                  |
| `redirect(303, 'https://external')`                   | `redirect(303, url, { external: true })`                           |
| `ORIGIN` env var for adapter-node                     | `paths.origin` in `vite.config.ts`                                 |
| `data-sveltekit-preload-data="off"`                   | `data-sveltekit-preload-data="false"`                              |
| files in `src/params/`                                | one `src/params.ts` with `defineParams`                            |
| `import type { Handle } from '@sveltejs/kit'`         | `import type { Handle } from '@sveltejs/kit/hooks'`                |

- Server-only code goes in any `server/` directory or a `*.server.ts` file. DB access happens **only** in `+page.server.ts`,
  `+server.ts`, hooks and `src/lib/server/**`. Never import `#lib/server/...` from a component.
- Mutations use **form actions + `use:enhance`** with `method="POST"`. Every form must work with JavaScript disabled.
- Remote functions are **experimental — do not use them** until they're stable.
- Type props with the generated types: `let { data, form }: PageProps = $props();` (`import type { PageProps } from './$types'`).

## 3. Lightweight / low-data rules (performance budget)

- **Budget per route:** ≤ 50 KB gzipped JS and ≤ 15 KB gzipped CSS. `npm run budget` fails the build if a route goes over.
- **Default to zero JS.** A page with no interactivity exports `export const csr = false;` from `+page.ts`.
  A static page also exports `prerender = true`.
- **No new runtime dependency in client code without a written reason in the PR.** Banned on the client: UI kits, icon fonts,
  CSS frameworks, date libraries (use `Intl` and ISO strings), lodash, axios (use `fetch`), state libraries, analytics SDKs.
- **No web fonts.** Use the system font stack in `src/app.css`. Icons are inline SVG.
- **Design system lives in `src/app.css`** (one cached file for all pages): brand tokens sampled from the
  college seal (`--brand` green, `--gold`, `--teal`), light + dark mode, mobile-first breakpoints at
  `40rem` and `64rem`. Reuse its classes (`.card`, `.btn`, `.form-section`, `.field-grid`, `.choice`)
  before adding new CSS. Never hard-code colours in components; use the tokens.
- **No inline `style="..."` in markup.** The CSP blocks `<style>`/script injection; keep styling in
  CSS classes (use `class={{ ... }}` for state, `<progress>` for bars).
- **Images:** import from `src/lib/assets/` (Vite hashes them for year-long caching; inlining is
  disabled), WebP, with explicit `width`/`height` and a `1x, 2x` `srcset`. Keep each under ~25 KB.
- **Native controls only:** `<input inputmode="numeric" pattern="[0-9]{12}">` for LRN (never `type="number"`), `<input type="date">`,
  `<select>`, `<input type="file" accept="image/*">`. Don't add `capture=`; it blocks picking an existing photo.
- **Images are compressed on the phone before upload** with `#lib/compress-image.ts` (it falls back to JPEG on Safari, which can't
  encode WebP). The server never re-encodes images.
- **Lazy-load heavy, rarely used code** (e.g. a jsQR fallback for PhilSys scanning): `await import(...)`, only after feature
  detection fails.
- **No polling, websockets or SSE for students.** Check seat capacity on submit.
- **Never ship big reference data to the phone** (DepEd school list, PSGC codes). Filter on the server and send what the screen needs.
- **PDFs** (Certificate of Registration, COR) are print-CSS HTML pages, or pdf-lib on the server. **Never Puppeteer/Chromium**: it alone
  is bigger than the whole server's RAM budget.
- Pages that show personal data send `cache-control: private, no-store` (set in `hooks.server.ts`); the service worker must never cache them.

## 4. Data & open-system rules

Full rationale is in [docs/architecture.md](docs/architecture.md).

- **Domain prefixes are module boundaries:** `core_` (person identity: students, faculty and staff, shared by every
  system), `ref_` (programs, terms, subjects, curricula), `rec_` (the student record: student number, status),
  `enr_` (applications, sections, class offerings, class seats), `sys_` (staff accounts, sessions, event log, audit log).
  A future system adds its own prefix (`grd_`, `fin_`, `lib_`...). Scope is fixed in [docs/scope.md](docs/scope.md).
  A module writes **only its own tables**. It reads others' tables, or better, listens to their events.
- **Primary keys are UUIDv7 text** (`#lib/server/id.ts`). Never use LRN, student number or names as keys. External IDs go in
  `core_person_identifier (scheme, value)`.
- **Every state change that another system might care about emits an event** via `emitEvent(tx, ...)` **inside the same transaction**
  as the change. Event types are versioned (`enrollment.application.submitted.v1`). Never change the meaning of a published version;
  add `.v2`.
- **Event payloads are thin:** IDs and status, never names, birthdates, grades or documents. Consumers fetch details through the
  authenticated API.
- **`sys_audit_log` and `sys_event` are append-only**, enforced by SQLite triggers. Log every staff read or write of sensitive personal data with `audit(...)`.
- Seat reservation uses the conditional `UPDATE ... WHERE enrolled < capacity` in `#lib/server/enrollment/reserve-seat.ts`. Never use read-then-write.
- Names follow PSA format: `last_name`, `first_name`, `middle_name`, `suffix`, all separate. Dates are ISO `YYYY-MM-DD`. Timestamps are UTC
  milliseconds. Money is integer centavos. Addresses use PSGC codes.
- Schema changes: edit `src/lib/server/db/schema/*.ts` → `npm run db:generate` → commit the SQL in `drizzle/`. Never edit an applied
  migration. Migrations run automatically at server start, or with `npm run db:migrate`.
- **Never use `drizzle-kit migrate` or `drizzle-kit push`.** Drizzle runs migrations in a transaction where SQLite ignores
  `PRAGMA foreign_keys`, so any table rebuild (changing a column) fails on a database that has rows. Our runner
  (`runMigrations()` / `scripts/migrate.mjs`) switches FKs off around it and runs `foreign_key_check` after.
- **Test every migration against a copy of real data** (`new Database(src).backup(copy)` then migrate the copy) before it
  reaches the campus server. An empty test database hides exactly the failures that matter.

## 4b. Staff area (`/staff`) rules

- Public pages live in `src/routes/(public)/` (student header/footer, mobile-first, `app.css` only). Staff pages live in
  `src/routes/staff/` with their own PC-first layout and `staff.css`, which students never download.
- `hooks.server.ts` already redirects signed-out requests and forces temporary-password changes. **Every staff `load` and
  action must still call `requireStaff(locals, ...roles)` first.** Hooks are not an authorization check for data.
- Roles: `ADMIN` (everything), `REGISTRAR`, `CASHIER`, `DEAN`, `FACULTY`. Grant the smallest set that does the job.
- **Any staff page that shows one student's personal data writes an `audit(tx, { action: 'READ', … })` row.**
- Staff accounts are created from the server console with `npm run staff -- add …`; passwords use scrypt
  (`#lib/server/auth/password.ts`). Never log, store or display a plaintext password.

## 5. Privacy (RA 10173) — non-negotiable

- Collect the minimum. **Never store the PhilSys Card Number (PCN)** or the PhilSys QR image. Use the decoded fields only to pre-fill the form.
- Consent (with notice version) is recorded in `core_consent` before any personal data is stored. A guardian attestation is required if the student is under 18.
- Drafts stored on the phone hold personal data: clear them on successful submit and expire them after 3 days (see `/enroll`).
- Never put personal data in URLs, logs, event payloads or error messages.

## 6. Before you say "done"

Run `npm run verify` (svelte-check + Svelte 5 guard + build + JS budget). It must pass. Report actual output, not assumptions.

---

## Svelte MCP tools

You are able to use the Svelte MCP server, where you have access to comprehensive Svelte 5 and SvelteKit documentation. Here's how to use the available tools effectively:

### 1. list-sections

Use this FIRST to discover all available documentation sections. Returns a structured list with titles, use_cases, and paths.
When asked about Svelte or SvelteKit topics, ALWAYS use this tool at the start of the chat to find relevant sections.

### 2. get-documentation

Retrieves full documentation content for specific sections. Accepts single or multiple sections.
After calling the list-sections tool, you MUST analyze the returned documentation sections (especially the use_cases field) and then use the get-documentation tool to fetch ALL documentation sections that are relevant for the user's task.

### 3. svelte-autofixer

Analyzes Svelte code and returns issues and suggestions.
You MUST use this tool whenever writing Svelte code before sending it to the user. Keep calling it until no issues or suggestions are returned.

### 4. playground-link

Generates a Svelte Playground link with the provided code.
After completing the code, ask the user if they want a playground link. Only call this tool after user confirmation and NEVER if code was written to files in their project.
