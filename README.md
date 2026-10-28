# hyperschoolenrollment

Lightweight, mobile-first college enrollment for Philippine campuses. It's built for ₱4k Android
phones on congested mobile data and one ₱8k mini PC in the server room.

**Stack:** SvelteKit 3 · Svelte 5 (runes) · SQLite (WAL) · Drizzle ORM · adapter-node · Caddy · Cloudflare Tunnel

| Measured (production build, gzipped) | JS      | CSS    | HTML    |
| ------------------------------------ | ------- | ------ | ------- |
| `/` landing, `/privacy`, `/offline`  | 0 KB    | 0.6 KB | ~0.8 KB |
| `/enroll` (the form)                 | 39.6 KB | 0.7 KB | 1.1 KB  |
| `/enroll/done`                       | 0 KB    | 0.7 KB | 0.7 KB  |

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

Open http://localhost:5173/enroll.

## Scripts

| Script                | What it does                                                              |
| --------------------- | ------------------------------------------------------------------------- |
| `npm run verify`      | **Run before every commit:** type-check + Svelte 5 guard + build + budget |
| `npm run check`       | `svelte-check` + `scripts/guard-svelte5.mjs` (bans Svelte 4 / Kit 2 code) |
| `npm run budget`      | Boots the build and measures real per-route JS/CSS                        |
| `npm run db:generate` | Create a migration after editing `src/lib/server/db/schema/*.ts`          |
| `npm run db:seed`     | Demo term, programs and block sections                                    |
| `npm start`           | Run the production build (`node build`)                                   |

## Read these first

- **[AGENTS.md](AGENTS.md):** hard rules for humans and AI agents (Svelte 5 runes only, SvelteKit 3
  APIs, performance budget, data rules). Claude Code loads it automatically via `.claude/CLAUDE.md`;
  the official Svelte MCP server and skills are preconfigured in `.mcp.json` and `.claude/`.
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

**Done:** the mobile intake form (consent + guardian attestation, LRN, PSA name, one-tap block
seat), seat locking (tested: 12 concurrent submits for 2 seats → exactly 2 seated), event feed and
person API, append-only audit/event logs, service worker (offline page + asset precache).

**Next (Phase 1 per research):** student login for returning students and status lookup, document
upload (use `#lib/compress-image.ts`), PhilSys QR pre-fill, Registrar/Cashier screens (document
hold, OR encoding, FHE tagging), COR print page, CHED EL / UniFAST exports.

**Known limits:** client IPs in the audit log show `127.0.0.1` for Cloudflare Tunnel traffic until
Caddy is configured to trust `CF-Connecting-IP`. Dev-only tooling (drizzle-kit) has `npm audit`
advisories that don't ship to production.
