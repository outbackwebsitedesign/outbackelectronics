# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## ⚠️ CRITICAL — DATA SAFETY — READ THIS FIRST

**The `.db` files are the entire business database.** They are not in the repo (gitignored) but live alongside the code on the production server. They contain every order, customer, product, service, forum post, repair job, and financial record.

**NEVER, under any circumstances:**
- Use `git reset --hard` — it deletes all untracked files, including every `.db` file
- Use `git clean -f` or `git clean -fd` — same result
- Suggest or write any script, command, or deploy step that could wipe untracked files

**For deployment, always use `git pull`** — it only updates tracked files and leaves `.db` files and `.env` alone.

This mistake was made once and wiped the entire live database. Do not let it happen again.

## Git workflow

**Always commit and push directly to `main`.** Do not open pull requests. The owner merges nothing — changes go straight to production via `git pull` on the server.

When running inside a Claude Code web session, the environment pre-creates a feature branch (e.g. `claude/next-todo-issue-*`). In that case: commit on the session branch, then fast-forward merge to `main` and push `main`. That is the accepted flow — the feature branch is just session scaffolding, not a real branch to review or merge via PR.

**NEVER push feature branches to the remote.** Only push `main`. Do not run `git push -u origin claude/...` or push any branch other than `main`.

**If the merge fails, DO NOT cherry-pick.** Fix the reason the merge failed (e.g. pull/rebase `main` so the histories are compatible, resolve conflicts), then merge again.

## Commands

```bash
npm run dev      # Vite dev server (frontend hot-reload only, no backend)
npm run build    # Vite production build → dist/
npm start        # Run the Node.js server (serves all 5 ports)
```

There is no linter or test runner configured. Playwright is installed (`npx playwright test`) but scripts live in the repo root — check for `*.spec.js` / `*.test.js` files before running.

To develop with a live backend, run `npm start` (requires `ADMIN_PASSWORD` env var). For frontend-only work, `npm run dev` suffices.

## Architecture

### Multi-service, single process

`server.js` is a single Node.js process that runs **5 HTTP servers** simultaneously using only Node's built-in `http`/`https` modules (no Express):

| Port | Env var | Service | Entry HTML |
|------|---------|---------|------------|
| 8080 | `MAIN_PORT` | Public shop + info site | `index.html` |
| 8081 | `FORUM_PORT` | Community forum | `forum.html` |
| 8082 | `ADMIN_PORT` | Staff admin dashboard | `admin-login.html` |
| 8083 | `PORTAL_PORT` | Customer portal | `portal.html` |
| 8084 | `GAMES_PORT` | Games | `games.html` |
| 8085 | `TOOLS_PORT` | Tools | `tools.html` |

Each server parses requests with hand-written routing (string matching on `req.url`) — there is no router library. All API routes are defined inline in `server.js`.

In production, subdomains map to ports: `forum.outbackelectronics.com.au` → 8081, `admin.*` → 8082, `portal.*` → 8083, `games.*` → 8084, `tools.*` → 8085, etc. Locally all services share `localhost` with different port numbers.

### Frontend

React 18 + Vite. The build produces a single `dist/` folder with multiple HTML entry points (configured in `vite.config.js` as a multi-page app). **`dist/` must NEVER be committed or tracked** — it is gitignored and rebuilt from source every time `./deploy.sh` runs.

JSX source files at the repo root map to services:

- `app.jsx` + `pages-shop.jsx` + `pages-info.jsx` + `pages-community.jsx` → main site
- `pages-admin.jsx` + `admin-standalone.jsx` → admin
- `forum-page.jsx` + `forum-standalone.jsx` → forum
- `portal-page.jsx` → portal
- `games.jsx` → games
- `tools.jsx` → tools

Each entry point in `src/` (e.g. `src/main.jsx`) imports the relevant page JSX and mounts to a DOM element.

`app.jsx` sets up `ShopContext` (React context) and exposes global helpers (`window.useReveal`, `window.observeReveal`) used by page components.

### Data storage

No database server. All data is stored as flat JSON files in the repo root with `.db` extension (e.g. `products.db`, `orders.db`, `forum.db`). Writes use an atomic rename pattern (write to `.tmp`, then `fs.rename`). `settings.db` is the single source of truth for all settings — `readSettings()` uses inline code fallbacks for missing keys; there is no `settings.defaults.json` file.

Key data files: `products.db`, `orders.db`, `customers.db`, `repairs.db`, `quotes.db`, `services.db`, `forum.db`, `staff.db`, `sellers.db`, `memberships.db`, `gift-cards.db`, `software.db`, `tutorials.db`, `carts.db`.

Session stores are also flat JSON: `sessions.db` (admin), `forum-sessions.db`, `portal-sessions.db`.

### Auth & security

- **Admin**: cookie-based sessions (8h TTL), bcrypt-hashed password from `ADMIN_PASSWORD` env var. IP allowlist via `ADMIN_IP_ALLOWLIST`. Rate-limited login with 15-min lockout after 5 attempts.
- **Forum / Portal**: separate session stores with 30-day TTL.
- **CSRF**: token issued via `GET /api/csrf-token`, stored in `_csrf` cookie, required on all mutating API requests. Frontend reads it via `getCsrf()` in `app.jsx`.
- **Public API rate limits**: defined per-endpoint in `PUBLIC_RATE_LIMITS` at the top of `server.js`.

### External integrations

All configured via environment variables:

| Integration | Env vars |
|-------------|----------|
| Stripe | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PUBLISHABLE_KEY` |
| Australia Post | `AUSPOST_API_KEY` |
| SMTP (email) | `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `NOTIFY_EMAIL` |

Missing keys degrade gracefully (features disabled, no crash).

### Key env vars for local development

```
ADMIN_PASSWORD=yourpassword   # required to log into admin
SITE_URL=http://localhost:8080 # controls cross-service URL generation
```
