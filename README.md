# hyperschoolenrollment

Lightweight, mobile-first college enrollment for Philippine campuses. It's built for ₱4k Android
phones on congested mobile data and one ₱8k mini PC in the server room.

**Stack:** SvelteKit 3 · Svelte 5 (runes) · SQLite (WAL) · Drizzle ORM · adapter-node · Caddy · Cloudflare Tunnel

| Measured (production build, gzipped) | JS      | CSS    | HTML    |
| ------------------------------------ | ------- | ------ | ------- |
| `/` landing, `/privacy`, `/offline`  | 0 KB    | 2.8 KB | ~1.3 KB |
| `/enroll` (the form)                 | 42.8 KB | 2.8 KB | 1.5 KB  |
| `/enroll/done`                       | 0 KB    | 2.8 KB | 1.1 KB  |

The CSS is one shared file, downloaded once and cached. The college seal is 1.8 KB in the header
(5.5 KB on high-DPI screens) and 7.6–20 KB on the landing page.

`npm run budget` re-measures these and fails above 50 KB JS / 15 KB CSS per route.
The form works with JavaScript disabled; JS only adds draft saving and no-reload submits.

## Quick start

Requires **Node ≥ 22.17**.

```bash
npm install
```

```bash
cp .env.example .env
```

```bash
npm run dev
```

The first request runs migrations (creates `data/enrollment.db`). Then seed demo data:

```bash
npm run db:seed
```

Open http://localhost:5173/enroll for the student side.

For the staff side, create the first admin account from the server console. A one-time temporary
password is printed; it must be changed at first sign-in:

```bash
npm run staff -- add --username admin --name "Your Name" --roles ADMIN
```

Then sign in at http://localhost:5173/staff.

## Scripts

| Script                | What it does                                                              |
| --------------------- | ------------------------------------------------------------------------- |
| `npm run verify`      | **Run before every commit:** type-check + Svelte 5 guard + build + budget |
| `npm run check`       | `svelte-check` + `scripts/guard-svelte5.mjs` (bans Svelte 4 / Kit 2 code) |
| `npm run budget`      | Boots the build and measures real per-route JS/CSS                        |
| `npm run test:e2e`    | Full enrollment lifecycle over HTTP on a throwaway database (30 checks)   |
| `npm run db:generate` | Create a migration after editing `src/lib/server/db/schema/*.ts`          |
| `npm run db:migrate`  | Apply migrations without starting the server (FK-safe runner)             |
| `npm run db:seed`     | Demo term, subjects, curricula, sections, classes (idempotent)            |
| `npm run staff -- …`  | Staff accounts: `add`, `reset`, `disable`, `list`                         |
| `npm start`           | Run the production build (`node build`)                                   |

## Read these first

- **[AGENTS.md](AGENTS.md):** hard rules for humans and AI agents (Svelte 5 runes only, SvelteKit 3
  APIs, performance budget, data rules). Claude Code loads it automatically via `.claude/CLAUDE.md`;
  the official Svelte MCP server and skills are preconfigured in `.mcp.json` and `.claude/`.
- **[docs/scope.md](docs/scope.md):** what the Student Records System is, the phases, and the
  explicit "won't build" list. Check feature requests against it.
- **[docs/architecture.md](docs/architecture.md):** how enrollment becomes the identity intake for
  future school-wide systems (domains, identifiers, event feed, API).

## Deploy (campus mini PC, Linux)

1. `npm ci && npm run build`, copy the repo to `/opt/enrollment`, then `npm ci --omit dev` there.
2. `.env` from `.env.example`; set `INTEGRATION_TOKENS` only when another system needs the API.
3. [deploy/enrollment.service](deploy/enrollment.service) (systemd) runs `node build` on `127.0.0.1:3000`.
4. [deploy/Caddyfile](deploy/Caddyfile) terminates TLS with a real Let's Encrypt cert (DNS-01, so no
   public IP needed) for **both** paths:
   - off-campus: Cloudflare Tunnel → Caddy
   - on-campus Wi-Fi: router split-DNS `enroll.college.edu.ph → 192.168.x.x` → Caddy
5. Back up `data/` off-site with **restic** (encrypted by default) or Litestream to R2.

`node build` expects HTTPS in front (form CSRF checks compare against an `https://` origin). For
plain-HTTP testing on your laptop, use `npm run dev` or `npm run preview`.

## Status

See [docs/scope.md](docs/scope.md) for the full phase plan.

**Done (Phases 0, 1a, 1b):**

- Student intake (mobile form, consent, LRN dedupe, one-tap block enrollment into the section and
  all its classes) and student status lookup with printable Assessment Slip / COR.
- Records backbone: subjects, curricula, class offerings with schedule, room, professor and seats,
  student record + student numbers, staff accounts with roles.
- Enrollment processing: Registrar accepts, places students in sections, checks off original
  documents, issues the assessment (RA 10931 FHE rules); Cashier records the OR (or confirms ₱0)
  → OFFICIAL with a student number; cancel releases seats. Every step is race-safe, evented and
  audit-logged.
- `npm run test:e2e`: 30 lifecycle checks over real HTTP, including a 3-way payment race.

**Next (Phase 2):** class offerings management screens (sections, schedules, rooms, faculty load,
fee schedule), irregular students picking subjects with clash/prerequisite/unit checks, CHED
Enrollment List export, Admin screens for staff accounts.

**Known limits:** client IPs in the audit log show `127.0.0.1` for Cloudflare Tunnel traffic until
Caddy is configured to trust `CF-Connecting-IP`. Dev-only tooling (drizzle-kit) has `npm audit`
advisories that don't ship to production. Staff management is console-only until the Admin screens.
