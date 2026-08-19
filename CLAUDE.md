# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## ⚠️ CRITICAL - DATA SAFETY - READ THIS FIRST

**The `.db` files are the entire business database.** They are not in the repo (gitignored) but live alongside the code on the production server. They contain every order, customer, product, service, repair job, and financial record.

**NEVER, under any circumstances:**
- Use `git reset --hard`, it deletes all untracked files, including every `.db` file
- Use `git clean -f` or `git clean -fd`, same result
- Suggest or write any script, command, or deploy step that could wipe untracked files

The same applies to the other gitignored live-data directories: `drive-files/`, `photos-files/`, `swap-files/`, `radio-media/`, `assets/part-images/`, and `.env`.

**For deployment, always use `git pull`**, it only updates tracked files and leaves `.db` files and `.env` alone.

This mistake was made once and wiped the entire live database. Do not let it happen again.

## Writing style

**Never use em dashes (—).** Not in UI copy, not in code comments, not in commit
messages, not in chat replies. Use a hyphen, a comma, a colon, a full stop, or
brackets instead. This applies to every string that ships and every word written about
the code.

## Git workflow

**Always commit and push directly to `main`.** Do not open pull requests. The owner merges nothing, changes go straight to production via `git pull` on the server.

When running inside a Claude Code web session, the environment pre-creates a feature branch (e.g. `claude/next-todo-issue-*`). In that case: commit on the session branch, then fast-forward merge to `main` and push `main`. That is the accepted flow, the feature branch is just session scaffolding, not a real branch to review or merge via PR.

**NEVER push feature branches to the remote.** Only push `main`. Do not run `git push -u origin claude/...` or push any branch other than `main`.

**If the merge fails, DO NOT cherry-pick.** Fix the reason the merge failed (e.g. pull/rebase `main` so the histories are compatible, resolve conflicts), then merge again.

## Commands

```bash
npm run dev      # Vite dev server (frontend hot-reload only, no backend)
npm run build    # Vite production build → dist/
npm start        # Run the Node.js server (all services, one process)
./deploy.sh      # Production deploy: git pull, npm install, build, restart systemd units
```

There is no linter and no test runner configured, and there are no test files in the repo. Playwright is a dependency (used by ad-hoc audit scripts), so `npx playwright test` will find nothing unless spec files are added first. Verify changes by reading the code and, where it matters, by running the server.

To develop with a live backend, run `npm start` (requires `ADMIN_PASSWORD`). The server serves built assets out of `dist/`, so run `npm run build` first, or after any JSX change. For frontend-only work, `npm run dev` suffices.

One-off maintenance scripts live in `scripts/` (`build-cpu-catalog.js`, `migrate-skus.js`, `migrate-price-field.js`, `seed-membership-tiers.js`) plus `migrate-giftcards-to-denominations.js` in the root. They are run by hand with `node`, not wired into any npm script.

## Architecture

### One process, many HTTP servers

`server.js` (~740k, the bulk of the backend) is a single Node process that starts **19 HTTP servers** using only Node's built-in `http` module. No Express, no router library: every route is hand-matched on `req.url` inline. Ports come from env vars with the defaults below.

| Port | Env var | Service | HTML entry |
|------|---------|---------|-----------|
| 8080 | `MAIN_PORT` | Public shop + info site | `index.html` |
| 8081 | `DISCOURSE_REDIRECT_PORT` | Redirect to the hosted Discourse forum | (redirect only) |
| 8082 | `ADMIN_PORT` | Staff admin dashboard | `admin-login.html` |
| 8083 | `PORTAL_PORT` | Customer portal | `portal.html` |
| 8084 | `GAMES_PORT` | Games | `games.html` |
| 8085 | `TOOLS_PORT` | Tools | `tools.html` |
| 8089 | `WEATHER_PORT` | Weather station site | `weather.html` |
| 8091 | `AI_GATEWAY_PORT` | AI gateway (Ollama proxy + RAG) | `ai.html` |
| 8101 | `HUB_PORT` | Service-suite launcher | `hub.html` |
| 8102 | `DRIVE_PORT` | File drive | `drive.html` |
| 8103 | `PHOTOS_PORT` | Photos | `photos.html` |
| 8104 | `SKY_PORT` | Sky / satellite tracker | `sky.html` |
| 8105 | `COVERAGE_PORT` | Mobile coverage | `coverage.html` |
| 8106 | `MAPS_PORT` | Maps | `maps.html` |
| 8107 | `SOLAR_PORT` | Solar | `solar.html` |
| 8108 | `BEACON_PORT` | Beacon | `beacon.html` |
| 8109 | `FIRE_PORT` | Fire watch | `fire.html` |
| 8110 | `RADIO_PORT` | Radio (MP3 stream) | `radio.html` |
| 8111 | `SWAP_PORT` | Swap / classifieds | `swap.html` |

In production each maps to a subdomain (`admin.outbackelectronics.com.au` → 8082, `hub.*` → 8101, and so on). Locally they are all `localhost` on different ports.

**The forum is no longer self-hosted.** It runs on hosted Discourse; port 8081 only redirects, and SSO is via DiscourseConnect (`DISCOURSE_CONNECT_SECRET`). There is no `forum.html`, `forum-page.jsx`, `forum.db`, or `forum-sessions.db`. Forum moderation still appears in the admin UI for the Discourse-backed data.

### Adding a service to the suite

`createServiceServer({ htmlEntry, spaRoutes, routes })` near the bottom of `server.js` is the shared factory for the customer-facing suite (hub, solar, sky, fire, maps, coverage, drive, photos, swap, beacon, radio). It supplies the common preamble: maintenance gate, CSRF, `/api/shop-info`, announcements, unified-account auth, analytics, and the static SPA fallback. A new service supplies only its own `routes(req, res, url)` callback, returning `true` when it handled the request. The main, admin, portal, games, tools, weather, and AI servers predate the factory and build their own handlers.

**Never hard-code cross-service URLs.** `serviceUrls()` in `server.js` returns every service URL (env override, else subdomain in production, else localhost port), and it is included in the `/api/shop-info` payload every service serves. `app-shell.jsx` reads them at runtime, which is what lets the same build work on localhost and in production.

### Frontend

React 18 + Vite, built as a multi-page app. Each HTML file in the repo root is a Vite input (see `vite.config.js`); each `src/*-entry.jsx` imports its page JSX and mounts it. An inline-CSS Vite plugin folds the built stylesheet into each HTML file to avoid a render-blocking request.

**`dist/` must NEVER be committed or tracked.** It is gitignored and rebuilt by `./deploy.sh` on every deploy.

Source files at the root map to services: `app.jsx` plus `pages-shop.jsx` / `pages-info.jsx` / `pages-community.jsx` / `pages-cart.jsx` for the main site, `pages-admin.jsx` (~830k, the whole admin UI) for admin, `portal-page.jsx` for the portal, then one file per suite app (`games.jsx`, `tools.jsx`, `weather.jsx`, `sky.jsx`, `fire.jsx`, and so on).

Shared frontend modules worth knowing before writing new code:

- `app-shell.jsx` + `app-shell.css`: the nav, launcher, and account state every suite app renders.
- `src/lib/api.js`: `getCsrf()` and the fetch helpers. All mutating calls go through it.
- `src/lib/cart.js`, `src/lib/pricing.js` (bulk-price rules), `src/lib/conditions.js` (canonical product-condition list).
- `markdown.jsx`: the hand-rolled markdown subset shared by the public tutorials page and the admin editor preview, so the preview matches what ships.
- `pc-compat.js`: pure PC-builder part schema and compatibility rules, no React and no Node APIs, so server and UI share one rule set.

`app.jsx` owns `ShopContext` and exposes `window.useReveal` / `window.observeReveal` for page components.

### Data storage

No database server. Every store is a flat JSON file in the repo root with a `.db` extension, all gitignored. Reads go through `cachedReadFile()` (in-process cache), writes through `atomicWriteFile()` (write `.tmp`, then `fs.rename`, and update the cache). Concurrent read-modify-write sequences must be wrapped in `withFileLock(key, fn)`; all checkout and webhook financial writes share the single `CHECKOUT_LOCK` key, deliberately, because per-file locks would risk deadlock.

Roughly 45 stores exist. The ones that come up most: `settings.db`, `products.db`, `orders.db`, `customers.db`, `users.db`, `repairs.db`, `quotes.db`, `services.db`, `staff.db`, `sellers.db`, `memberships.db`, `gift-cards.db`, `software.db`, `tutorials.db`, `carts.db`, `pc-builder.db`, `policies.db`, `reviews.db`, `analytics.db`. Sessions are files too: `sessions.db` (admin) and `portal-sessions.db` (customer).

`settings.db` is the single source of truth for all settings. `readSettings()` fills missing keys from inline code fallbacks. **There is no `settings.defaults.json`, and one must never be created.**

**Seed-in-code pattern.** Because `.db` files are gitignored, a fresh deploy starts empty, so content that must exist on day one ships as JS instead: `policy-defaults.js` (public policy text, overridden per row by `policies.db`) and `pc-parts-seed.js` (built-in PC component catalog). Editing through the admin UI writes an override row, it never edits these files.

### Auth and security

- **Unified customer account**: one login across the portal, main site, and every suite subdomain, via a shared-domain cookie. Users live in `users.db`, sessions in `portal-sessions.db` (30-day TTL). Every service exposes `/api/auth/login|register|logout|me`.
- **Admin**: separate cookie session store (8h TTL), bcrypt-hashed password from `ADMIN_PASSWORD` or admin Settings → Security, IP allowlist via `ADMIN_IP_ALLOWLIST`, rate-limited login with a 15-minute lockout after 5 attempts. Roles are ranked by `ROLE_LEVELS`: owner 4, manager 3, technician 2, staff 1, seller 1, pending 0.
- **CSRF**: `GET /api/csrf-token` sets the `_csrf` cookie; every POST/PATCH/DELETE under `/api/` requires the matching `X-CSRF-Token` header (analytics events are the one exemption).
- **Public rate limits**: per-endpoint buckets in `PUBLIC_RATE_LIMITS` at the top of `server.js`.
- **Secrets at rest**: secrets are never copied from env into `settings.db`. The getters (`getStripeKey`, `getSmtpConfig`, `getAuspostKey`) fall back to env when the stored value is empty, so a secret only lands on disk if it was typed into the dashboard, and it is encrypted there when `SETTINGS_ENCRYPTION_KEY` is set.

### AI gateway

Port 8091 proxies a local Ollama instance and adds retrieval: `buildRagIndex()` embeds published products and tutorials 5 seconds after startup, caching embeddings in `rag-cache.db`, and `ragSearch()` injects the top matches into the chat prompt. Requests are queued rather than run concurrently. Without Ollama reachable, the endpoints return 503 and nothing else breaks.

### PC builder data pipeline

The parts library is enriched from several sources, in this order of preference: `pc-datasources.js` (public datasets), `pc-icecat.js` (Open Icecat, falling back to a conservative PCPartPicker detail lookup), `pc-vendor.js` (manufacturer product pages, which are the only source for case clearances, cooler heights, and PSU depth, and also supply product photos), `pc-images.js` (writes thumbnails into the gitignored `assets/part-images/`), and `pc-parts-seed.js` for the rest. **`pc-partpicker.js` is deliberately not wired to anything**: automated PCPartPicker access got the shop's IP blocked once and must not be re-enabled.

### Hardware and ops components

Not part of the Node app, but deployed alongside it by `./deploy.sh` as systemd units:

- `weather-station/weather_station.py` plus `weather-station/arduino/OutbackWeatherStation.ino`, serial protocol documented in `weather-station/PROTOCOL.md`. Feeds `weather.db`.
- `watchdog.py`, tracks crash frequency of the app and weather services and emails an alert (2 crashes in 10 minutes, or 5 in an hour). Reads SMTP config from the same `.env`.
- `arduino/gas-sensor-monitor/`, standalone sketch.
- `pcpartpicker_bridge.py`, JSON-lines bridge to `pypartpicker`, installed via `npm run setup:pcpartpicker`. Only used by the reference-only path above.

`deploy.sh` also creates the `outbackelectronics` service user and `outback-app` group, and sets the setgid bit on the app directory so `.db` files created by the service stay group-writable.

### External integrations

All optional, and all degrade gracefully when unset (feature disabled, no crash).

| Integration | Env vars |
|-------------|----------|
| Stripe | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PUBLISHABLE_KEY` |
| Australia Post | `AUSPOST_API_KEY` |
| SMTP | `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `NOTIFY_EMAIL` |
| Discourse SSO | `DISCOURSE_CONNECT_SECRET`, `FORUM_PUBLIC_URL` |
| Icecat | Settings → Integrations (env fallback: `ICECAT_USERNAME`, `ICECAT_APP_KEY`) |
| Maps / routing | `ORS_API_KEY` |
| Traffic and incident feeds | `QLDTRAFFIC_API_KEY`, `VIC_OPENDATA_KEY` |
| Weather | `WEATHER_API_KEY` |
| UPS monitoring | `UPS_NAME`, `UPS_POLL_INTERVAL_MS` |
| Radio | `RADIO_MEDIA_DIR`, `RADIO_BITRATE_KBPS` |

### Key env vars for local development

```
ADMIN_PASSWORD=yourpassword     # required to log into admin
SITE_URL=http://localhost:8080  # drives cross-service URL generation
```

Any `*_URL` variable (`PORTAL_URL`, `HUB_URL`, `SKY_URL`, and so on) overrides the derived URL for that service.
