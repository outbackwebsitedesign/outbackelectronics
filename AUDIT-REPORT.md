# Outback Electronics — Full End‑to‑End Audit

**Date:** 2026‑06‑05
**Scope:** Entire repository (`server.js` ~5,200 lines; ~17,000 lines of React/JSX across 9 files; HTML entry points; build/deploy config; data layer).
**Method:** Manual code review of the backend core plus four parallel deep‑dive investigations (backend security/API, frontend code quality/UX, secrets/config/infra, SEO/metadata/performance). The headline file‑disclosure bug was independently verified by replicating the server's path‑resolution logic.
**Nature:** Read‑only audit. No code was changed. Findings include `file:line` references for verification.

---

## 1. Executive Summary

Outback Electronics is a genuinely impressive single‑process Node.js application: five HTTP services (shop, forum, admin, portal, games) on one event loop, no framework, flat‑JSON storage, and a committed Vite build. The engineering shows real security awareness — scrypt password hashing with `timingSafeEqual`, cryptographically‑random session/CSRF tokens, double‑submit CSRF, server‑side price resolution, `sharp` re‑encoding of uploads, ~105 role‑gated admin routes, and properly‑scoped CORS. The deploy script is even hardened against the `git reset --hard` mistake that previously wiped the database.

**However, there is one catastrophic vulnerability that overrides everything else:** the static‑file handler will serve **any file in the application root**, including the entire business database (`customers.db`, `orders.db`, `forum.db`), the **active admin session store** (`sessions.db`), and the **`.env` secrets file** — all **unauthenticated**, to anyone on the internet. `GET /sessions.db` yields a live admin session token (instant full admin takeover); `GET /.env` yields the Stripe secret key and plaintext admin password. This is a complete compromise of the business and **must be fixed before anything else**.

Beyond that, the second existential risk is operational: **there is no backup of the `.db` files** — the entire business lives on one server's disk, in a system that has already been wiped to zero once.

The remaining issues — privilege escalation, rate‑limit bypass, gift‑card double‑spend, price tampering, site‑wide DoS via one unhandled exception, and silent admin save failures — are serious but ordinary, and fixable in days.

**Risk posture:** 🔴 **Critical — do not consider the production data or admin panel safe until C1 is fixed.**

| Severity | Count | Examples |
|---|---|---|
| 🔴 Critical | 2 | Unauthenticated DB/secret/session exposure; no DB backups |
| 🟠 High | 6 | Priv‑esc, rate‑limit bypass, double‑spend, price tampering, site‑wide DoS, silent data loss |
| 🟡 Medium | 11 | CSRF gaps, stored XSS, order enumeration, webhook replay, blocking I/O, code duplication |
| 🟢 Low | 14 | gitignore gaps, weak audit log, a11y, dead code, placeholders |

---

## 2. Critical Issues

### ✅ C1 — Unauthenticated disclosure of the entire database, all secrets, and live admin sessions — **FIXED** (`server.js` commit `c108367`)
**Where:** `server.js:737‑797` (`serveStatic`), reached via the catch‑all `serveStatic(req, res, url.pathname, '/dist/index.html', …)` on every server (`server.js:2761`, `3012`, `4451`, `4969`, `4997`).
**What:** `serveStatic` resolves the request path against the app root and serves the file if it exists. The **only** guard is `filePath.startsWith(__dirname)` (`server.js:764`). There is **no allowlist of servable directories or extensions and no dotfile/`.db`/`.env` blocklist.** Because all data files live in `__dirname`, requests for them resolve *inside* `__dirname`, pass the guard, and are returned with `Content-Type: application/octet-stream` (served inline — `Content-Disposition: attachment` is only set for `/assets/uploads/software/` and `.pdf`).

I verified the resolution mechanic directly:
```
req "/orders.db"   → candidate /home/user/outbackelectronics/orders.db   guardPass=true → served
req "/.env"        → candidate /home/user/outbackelectronics/.env         guardPass=true → served
req "/sessions.db" → candidate /home/user/outbackelectronics/sessions.db  guardPass=true → served
```
**Exploitable, unauthenticated, from any of the 5 subdomains:**
- `GET /sessions.db` → every active **admin session id** → set `oe_admin_session` cookie → **full admin takeover, no password needed.**
- `GET /.env` → `ADMIN_PASSWORD` (plaintext), `STRIPE_SECRET_KEY`, `SMTP_PASS`.
- `GET /customers.db` → all customer PII; `GET /orders.db` → all orders/financials; `GET /forum.db` → all user emails + password hashes; `GET /portal-sessions.db` / `/forum-sessions.db` → hijack any customer; `GET /password-reset-tokens.db` → account takeover; `GET /settings.db` → admin password hash + any Stripe/SMTP secrets stored via the admin UI (see M5); `GET /staff.db` → staff PIN hashes; `GET /server.js`, `/admin-audit.log`.

Note: path traversal *out* of `__dirname` is correctly blocked (Node's `new URL` normalizes `..`); the bug is serving files that are legitimately *inside* the root but must never be web‑exposed. Cloudflare will not save you — these are ordinary‑looking paths with no traversal.

**Impact:** Critical — total confidentiality breach + admin/account takeover + secret theft.
**Effort:** S–M. **Fix applied:** replaced `filePath.startsWith(__dirname)` guard with an explicit `ALLOWED_SERVE_ROOTS` allowlist (`dist/`, `public/`, `assets/`). Any request resolving outside those three directories now returns `403 Forbidden`. Remaining defense-in-depth steps (move `.db` files to `../data/`, Cloudflare WAF rule) are still recommended but the web-exposure vector is closed.

### ✅ C2 — No backup or recovery strategy for the business database — **FIXED** (`deploy.sh` commit `b77782b`)
**Where:** `deploy.sh` (no backup step), `.gitignore` (`*.db` excluded), README/CLAUDE.md (describe none).
**What:** The flat‑JSON `.db` files *are* the entire business (orders, customers, repairs, financials, forum). They live only on the production disk, gitignored, with **no cron/snapshot/off‑box copy anywhere**. The repo itself records that this data was **wiped to zero once already** (`deploy.sh:11‑12`). A single disk failure, bad migration, ransomware, or one errant command = total, unrecoverable loss.
**Impact:** Critical — existential business risk.
**Effort:** S. **Fix:** automated periodic copy of all `.db` files to off‑server object storage (e.g. hourly `rsync`/S3 with versioning + daily retention). This is a few hours of work and the single highest ROI item after C1.

---

## 3. High‑Priority Issues

### 🟠 H1 — Privilege escalation: a `seller` (lowest role) can make themselves `owner`
**Where:** `server.js:4288‑4302` (`POST /api/admin/staff/members/save`).
**What:** The route requires only `seller` (`:4289`). A seller is restricted to editing their own record (`body.id !== session.staffId → 403`, `:4292`), but the record is then merged with the **raw request body**: `data.members[idx] = { ...data.members[idx], ...body }` (`:4300`). Only `pin` is specially handled; `role`, `status`, `email` are never validated or stripped. A seller POSTs `{"id":"<their staffId>","name":"x","role":"owner"}` and is promoted to owner → full admin.
**Impact:** High — full admin compromise from the lowest privileged account.
**Effort:** S. **Fix:** whitelist editable fields; never let a non‑owner set `role`/`status`.

### ✅ H2 — Rate limiting, lockout, and IP allowlist are trivially bypassable (IP spoofing) — **FIXED**
**Where:** `getIp()` `server.js:549‑556`; dead anti‑spoof code `isPrivateIp()` `server.js:541‑548`.
**What:** `getIp` blindly trusts `CF‑Connecting‑IP` then `X‑Forwarded‑For`. The comment (`:539‑540`) claims XFF is only trusted from private proxies, and `isPrivateIp` implements exactly that — **but `isPrivateIp` is never called.** If the origin is reachable directly (origin IPs are routinely discovered), an attacker rotates `CF‑Connecting‑IP:` per request to defeat the admin 5‑attempt/15‑min lockout (`:677‑684`), the customer‑login lockout, the admin IP allowlist (`isIpAllowed`), and every public bucket (checkout, register, forgot/reset‑password, quote, contact). Enables unthrottled credential brute‑force and form spam.
**Impact:** High. **Effort:** S. **Fix applied:** Added `isCloudflareIp()` (Cloudflare's published v4 egress CIDRs) and `isTrustedProxy()` combining private + Cloudflare ranges. `getIp()` now only trusts `CF‑Connecting‑IP`/`X‑Forwarded‑For` when `req.socket.remoteAddress` is a trusted proxy; direct connections from arbitrary public IPs use the socket address. Cloudflare‑proxied visitors (including Starlink/VPN users) are unaffected — Cloudflare's egress IP on the socket triggers the header trust, and their real IP is correctly read from `CF‑Connecting‑IP`. Locking origin ingress to Cloudflare IP ranges at the firewall is still recommended as defence‑in‑depth.

### 🟠 H3 — Read‑modify‑write races → gift‑card / rewards double‑spend, lost updates
**Where:** `atomicWriteFile` `server.js:143‑147` + every `read*()/…await…/write*()` handler (e.g. gift‑card redemption `server.js:2161‑2234`, webhook balance decrement `:2502‑2511`, rewards redemption, order‑id `OE-${max+1}`).
**What:** Writes are atomic individually, but handlers `await` between read and write with no locking, so concurrent requests interleave and the later write clobbers the earlier (lost update). Two concurrent checkouts with the same gift‑card code each read the same balance and both succeed → **spend the balance twice**. Order IDs can collide.
**Impact:** High — financial loss / data corruption. **Effort:** M. **Fix:** per‑file in‑process async mutex/queue; re‑validate balances inside the critical section.

### 🟠 H4 — Client‑controlled price for zero/variant‑priced products
**Where:** `server.js:2049‑2080` (`lookupCatalogPrice`).
**What:** Prices are resolved server‑side from the catalog (good), **except** the fallback `const price = Number(prod.priceAud) || Number(clientPrice)` (`:2055`). For any published product whose top‑level `priceAud` is `0`/`null` (the documented variant case, and any misconfigured product), the client‑supplied `priceAud` is trusted. The only downstream check is `resolvedPrice > 0` (`:2078‑2079`), so an attacker checks out a real product for `$1`. Same fallback for services (`:2059`) and tiers (`:2061`).
**Impact:** High (conditional on such products existing — variants do). **Effort:** M. **Fix:** require a resolved server‑side price per purchasable SKU/variant; reject if missing rather than trusting the client.

### 🟠 H5 — Single unhandled exception takes down all five services (site‑wide DoS)
**Where:** `forumServer` (`server.js:2770`) and `portalServer` (`:4466`) have **no `try/catch`**; there is **no `process.on('uncaughtException'|'unhandledRejection')`** anywhere. One process serves all 5 ports.
**What:** Any unhandled throw/rejection in a forum or portal request crashes the whole process → shop + forum + admin + portal + games all go down together. systemd restarts in ~5s, but it's a trivial, repeatable DoS and also wipes in‑memory rate‑limit state on each restart.
**Impact:** High — availability of the entire business. **Effort:** S. **Fix:** wrap both handlers in `try/catch` (as main/admin/games already are); add top‑level `uncaughtException`/`unhandledRejection` handlers that log and keep the process alive.

### 🟠 H6 — Admin saves fail silently with optimistic UI → staff lose business data
**Where:** ~50 sites in `pages-admin.jsx` (e.g. `saveNow` `:551`; expenses `:574`/`:584`; quotes `:1481`/`:1590`).
**What:** The dominant admin write pattern is `await fetch(...).catch(()=>null)` immediately followed by an optimistic local‑state update regardless of outcome. If the POST fails (network/500/expired CSRF), the row shows the new value, **nothing is persisted, no error is shown**, and the change is lost on reload. This is the entire order/quote/expense editing surface failing invisibly.
**Impact:** High — silent business‑data loss + staff trust. **Effort:** M. **Fix:** check `res.ok`, surface failures, and don't mutate state on error (ideally a shared `apiSave` helper — see M8).

---

## 4. Medium‑Priority Issues

### 🟡 M1 — CSRF not enforced on `DELETE`/`PUT` for forum/admin/portal servers
**Where:** `server.js:2780`, `:3026`, `:4490` check only `POST`/`PATCH`; the main server (`:1792`) correctly includes `DELETE`. `SameSite=Strict` mitigates in modern browsers, but the double‑submit check should cover all mutating verbs. **Fix:** include `DELETE`/`PUT` in all four handlers. **Impact:** Med. **Effort:** S.

### 🟡 M2 — Stored XSS via tutorial content + unvalidated iframe
**Where:** `pages-community.jsx:191‑192` renders `dangerouslySetInnerHTML={{__html: activeTutorial.content}}` (the only such sink in the app); adjacent `<iframe src={activeTutorial.videoUrl}>` (`:182`) has no URL allowlist. Tutorial content is saved by the admin endpoint with **no sanitization**, then injected raw on the public site. A malicious/compromised manager — or any seller via H1 — can plant persistent JS for every visitor. **Fix:** sanitize HTML server‑side (allowlist) or render markdown as React; validate the iframe URL host. **Impact:** Med. **Effort:** S–M.

### 🟡 M3 — Unauthenticated order enumeration / info disclosure
**Where:** `server.js:2656‑2668` (`GET /api/warranty/order-lookup?id=`). No auth, **no rate limit** (unlike the adjacent `warranty/register`). Order IDs are sequential (`OE‑1001`, `OE‑1002`…), so anyone can enumerate existing orders and read their date + expense/part line items. **Fix:** require ownership (logged‑in email match) or a non‑guessable token; rate‑limit. **Impact:** Med. **Effort:** S.

### 🟡 M4 — Stripe webhook: no body‑size cap, no replay/timestamp check
**Where:** `server.js:1679‑1696`, `:2375`. `readRawBody` buffers the full request with no cap (unauthenticated memory‑exhaustion DoS); `verifyStripeSignature` checks the HMAC but ignores the timestamp `t`, so a captured signed body can be replayed indefinitely (duplicate orders / re‑fulfilment). **Fix:** cap raw body size; reject signatures outside a tolerance window. **Impact:** Med. **Effort:** S.

### 🟡 M5 — Live secrets persisted in plaintext to `settings.db`
**Where:** `server.js:5019‑5052` (`migrateEnvToSettings`), `:4161‑4178` (settings save). `STRIPE_SECRET_KEY`, webhook secret, SMTP pass, and admin password hash are copied from env into `settings.db`. Combined with **C1** (`/settings.db` is web‑served), this directly leaks the Stripe secret key. **Fix:** keep live secrets in env/secret store; never persist to a flat file. **Impact:** Med (High in combination with C1). **Effort:** M.

### 🟡 M6 — Missing/inconsistent security headers
**Where:** `server.js:776‑783`. Present: `X‑Content‑Type‑Options`, `X‑Frame‑Options`, `Referrer‑Policy`, CSP (HTML only). **Missing:** `Strict‑Transport‑Security` (HSTS), `Permissions‑Policy`; headers aren't applied to JSON/API responses. **CSP inconsistency:** `script-src` has no `'unsafe-inline'`/nonce/hash, yet `dist/index.html` ships 3 inline `<script>` blocks (SW registration, Tawk.to) — as written the CSP **blocks them**, so either the CSP is stripped upstream (not actually enforced) or those features silently break with console CSP errors. **Fix:** add HSTS + `Permissions‑Policy`; add nonces/hashes for the legitimate inline scripts (or externalize them); confirm the effective CSP at the proxy. **Impact:** Med. **Effort:** S–M.

### 🟡 M7 — Synchronous, blocking file I/O on the shared event loop
**Where:** all `read*/write*` helpers (`server.js:149‑280`) use `readFileSync`/`writeFileSync`/`appendFileSync`; `readSettings` deep‑merges defaults on **every** call; no read caching. **What:** Every API call re‑reads and re‑parses whole `.db` files synchronously on the single event loop shared by all 5 services. As `orders.db`/`forum.db` grow, each parse blocks *every* service. `scryptSync` on login also blocks. **Fix:** cache parsed files in memory with write‑through; move to async I/O or a worker; longer term consider SQLite. **Impact:** Med (grows with data). **Effort:** M–L.

### 🟡 M8 — Pervasive frontend duplication (security fixes must land in 6+ places)
**Where:** `getCsrf()` is byte‑identical in 6 files (`app.jsx:3`, `pages-shop.jsx:6`, `pages-info.jsx:5`, `pages-admin.jsx:28`, `forum-page.jsx:108`, `portal-page.jsx:5`); `ensureCsrf()` in 3; the cross‑origin `portalApi`/`usePortalUser` stack duplicated between `app.jsx:185‑213` and `games.jsx:43‑71`. No shared utils module. **Fix:** extract one `src/lib/api.js`. **Impact:** Med (maintainability/security‑consistency). **Effort:** M.

### 🟡 M9 — God‑components
**Where:** `AdminOrders` (`pages-admin.jsx:527`, 531 lines, 11 `useState`), `AdminSettingsFull` (`:4868`, 475 lines, 23 `useState`), plus several 250–310‑line components. They mix fetching, form state, and sub‑forms; re‑render wholesale on every keystroke; hard to test. (Portal, by contrast, is well‑decomposed with reusable `LoadingSection`/`EmptyState`.) **Fix:** split by concern; memoize heavy lists. **Impact:** Med. **Effort:** L.

### 🟡 M10 — Contradictory build strategy (committed `dist/` *and* rebuild on deploy)
**Where:** `dist/` is committed (CLAUDE.md says intentionally), but `deploy.sh:26‑30` also runs `npm install` + `npm run build` on the prod box every deploy. The committed bundles can drift from source (a dev edits JSX, forgets to rebuild), and `npm start` without building serves stale assets. **Fix:** pick one — either build in CI and commit, or build on deploy and gitignore `dist/`. **Impact:** Med. **Effort:** S.

### 🟡 M11 — Unhandled promise rejections in portal fetches
**Where:** `portal-page.jsx:611, 686, 744, 755, 767` use bare `.then()` with no `.catch`; the `api()` wrapper (`:21`) only catches `r.json()`, not network errors. On offline/server‑down the tab throws uncaught and can stick on its loading state. **Fix:** add `.catch` / use the wrapper consistently. **Impact:** Med. **Effort:** S.

---

## 5. Low‑Priority Issues

| ID | Issue | Where | Fix |
|---|---|---|---|
| L1 | `.gitignore` gaps: `*.tmp` (atomic‑write orphans contain **live data**), `.env*` variants, generic `*.log` | `.gitignore` | add `*.tmp`, `.env*`, `*.log` |
| L2 | Audit log barely used — `auditAdminAction` called for only 2 actions; no trail for order edits, deletes, gift‑card issue/void, role/settings changes | `server.js:499‑510` | log all privileged mutations |
| L3 | Unbounded in‑memory maps (`loginAttempts`, `publicRateCounts`) never swept | `server.js:46‑47` | add to the periodic sweep (`:127`) |
| L4 | `readJson` overflow calls `req.destroy()` but never resolves/rejects the promise | `server.js:512‑519` | reject on overflow |
| L5 | `forum/users/save` matches by `u.name` and overwrites the whole object → can wipe `passwordHash`/`email` by omission | `server.js:3366‑3374` | merge, match by id |
| L6 | 8‑char hex gift‑card codes & cart‑share ids (`crypto.randomBytes(4)`) | `server.js:2605` | 16+ hex |
| L7 | No `engines` field; Node 18+ assumed but unenforced | `package.json` | add `"engines":{"node":">=18"}` |
| L8 | Migration script mutates `products.db` with no backup + broad substring match | `migrate-giftcards-to-denominations.js` | snapshot before run |
| L9 | systemd runs as `$(whoami)` (possibly root), not a dedicated low‑priv account | `deploy.sh:35‑53` | dedicated service user |
| L10 | Accessibility: 41 `onClick` on non‑interactive elements (no `role`/`tabIndex`/`onKeyDown`), missing `alt` (`pages-admin.jsx:1920`), tutorial modal has no focus trap/Esc, color‑only status pills | various | add roles/labels/keyboard handlers |
| L11 | Broken admin "View public site" link → `#home` on admin origin | `pages-admin.jsx:5705` | point to `SITE_URL` |
| L12 | Placeholder "coming soon" copy shipping (gift cards, groups) | `pages-shop.jsx:1304`, `pages-community.jsx:235` | finish or hide |
| L13 | Hardcoded `http://localhost:8083` in games portal call (race before `/api/config` resolves) | `games.jsx:44` | derive synchronously like `app.jsx` |
| L14 | `target="_blank"` without `rel="noopener"` (2 admin receipt links) | `pages-admin.jsx:4338,4389` | add `rel="noopener"` |

---

## 6. Security Risks (consolidated)

- **Total data/secret/session exposure — C1** (the dominant risk; fix first).
- **Privilege escalation — H1**, **rate‑limit/lockout bypass — H2**, **price tampering — H4**, **double‑spend — H3**.
- **Stored XSS — M2**, **CSRF gaps on DELETE — M1**, **order enumeration — M3**, **webhook replay/DoS — M4**, **secrets in `settings.db` — M5**.
- **Missing HSTS/Permissions‑Policy, possibly‑unenforced CSP — M6**; weak audit trail (**L2**); plaintext secrets persisted (**M5**).
- **Done well (keep):** scrypt + `timingSafeEqual`, random tokens, `HttpOnly; SameSite=Strict; Secure` cookies, double‑submit CSRF, scoped CORS (no `*`+credentials), upload re‑encode via `sharp` with MIME/size checks, portal IDOR correctly scoped by session, Stripe signature verification, **no committed secrets and clean git history**, no `eval`/`child_process`/dynamic `require`.

## 7. Performance & Reliability Risks

- **Synchronous blocking I/O on a shared event loop — M7** (worsens as data grows).
- **Single‑process SPOF + no crash guard — H5**; in‑memory rate‑limit state lost on every restart.
- **No read caching**; `readSettings` deep‑merges on every call.
- **Public images not lazy‑loaded**, no `width`/`height`, no LCP preload (`pages-shop.jsx:111,302,933`); ~350 KB uncompressed JS before first paint; no route‑level lazy loading within a bundle.
- **Render‑blocking Google Fonts** on every non‑index page (`portal.html:10`, `games.html:10`, `admin-login.html:10`, error pages); third‑party font fetch (privacy + latency). Only `index.html` uses the non‑blocking preload pattern.
- **Unused 344 KB `assets/logo.png`** (8 KB `.webp` is used everywhere).
- **No monitoring/alerting** of crashes, error rates, or disk usage; no `ETag`/`Last‑Modified` (minor).
- **Done well:** per‑entry‑point code splitting works (admin/portal/games bundles are *not* loaded on the public site); content‑hashed assets cached `immutable`; HTML `no‑cache`; uploads optimized to WebP@82 via `sharp`.

## 8. UX / Design Recommendations

- **Surface failures (H6, M11):** replace `catch(()=>null)` + optimistic update with real success/error states; add toast/inline error feedback. This is the biggest UX‑integrity gap.
- **Replace native `confirm()`/`alert()`** (12 + 6 sites in admin) with consistent themed dialogs.
- **Accessibility (L10):** add `role="button"`/`tabIndex`/`onKeyDown` to clickable divs, `alt` text, modal focus traps + Esc (forum/main modals already do this — mirror them), and a non‑color status indicator on order/payment pills.
- **Finish or hide unfinished UI (L12):** gift cards, memberships, rewards, wallet are shown but not wired (see `todo.md`) — gate them clearly so customers don't hit dead ends.
- **Fix the broken admin "View public site" link (L11)** and the `localhost:8083` race (L13).

## 9. SEO Recommendations

- **Create `assets/og-image.webp`** — it's referenced by *every* share preview (`server.js:802` + all `STATIC_OG`) but **does not exist** → every link preview shows a 404 image. (Quick win, high visibility.)
- **Add `robots.txt` and `sitemap.xml`** and serve them in `server.js` (neither exists; no route serves them).
- **Set `document.title`/meta on client‑side navigation** in the route effect (`app.jsx:1408`) — today `document.title` is *never* set in JS, so the tab title never updates during a session. Add the uncovered routes (`/`, `/about`, `/repairs`, `/policies`, `/sellers`, `/gift-cards`, `/memberships`) to `STATIC_OG` (`server.js:804`) so crawlers get unique titles.
- **Add JSON‑LD structured data:** `LocalBusiness` on home (address/hours/geo already known) and `Product` on product pages (price/SKU already available at `server.js:832`). None exists today.
- **Add `twitter:card`, `og:site_name`, `og:locale`, `rel="canonical"`**; add a meta description + OG tags to `forum.html`/`portal.html`/`games.html` (currently none).
- **Wire analytics:** Cloudflare Web Analytics is whitelisted in CSP but no beacon is injected; add it (privacy‑friendly, no cookie banner needed).
- **Finish the PWA:** add `apple-touch-icon`, `theme-color`, and a `manifest.json` (a service worker + `offline.html` already exist but only `index.html` registers the SW, and it's an offline shim, not a true precaching PWA).

## 10. Backend / Database Recommendations

- **C1 fix is also a backend fix:** move data files **out of the web root** (`../data/`) and serve static only from allowlisted dirs.
- **Concurrency (H3):** introduce a per‑file write queue/mutex; validate balances inside the lock.
- **Validation:** validation is per‑handler and inconsistent (whole‑object spreads like H1/L5). Add a thin schema/validator per entity and a field allowlist on every `save`.
- **Caching (M7):** in‑memory cache of parsed `.db` files with write‑through invalidation; this alone removes most synchronous parse cost.
- **Scalability/maintainability:** the flat‑file model rewrites the whole file on every change and scans O(n) for every lookup. It's fine at current scale but plan a migration to **SQLite** (still single‑file, but indexed, transactional, and solves H3 for free) before `orders.db`/`forum.db` grow large.
- **Audit logging (L2):** log every privileged mutation (who/what/when/before‑after) — essential forensics, especially after a C1‑class incident.
- **Webhook hardening (M4):** size cap + replay window.

## 11. Cloudflare / Infrastructure Recommendations

- **Immediate stopgap for C1:** add Cloudflare WAF/Transform rules blocking root requests to `*.db`, `.env`, `*.log`, `*.tmp`, `/server.js`, `/package*.json` — but treat this as a band‑aid, not the fix.
- **Lock origin ingress to Cloudflare IP ranges** (firewall / `cloudflared` tunnel) so attackers can't hit the origin directly and spoof `CF‑Connecting‑IP` (mitigates **H2**, **C1** exposure surface).
- **Verify TLS/HSTS at the edge:** the app is all `http.createServer` (the imported `https` module is unused) — TLS is terminated by an upstream proxy **that is not in the repo**. Confirm HSTS is set there; add it. Document the subdomain→port mapping (also only in the uncommitted proxy config).
- **Backups (C2):** off‑server, versioned, automated — the single most important infra task after C1.
- **Run‑user:** give the systemd unit a dedicated unprivileged account, not `$(whoami)`.
- **Monitoring:** add uptime + error‑rate + disk‑usage alerting; the SPOF design (H5) makes this essential.
- **DNS/email:** confirm SPF/DKIM/DMARC for the sending domain (emails come from `outbackelectronics.com.au`).

## 12. Quick Wins (high value, low effort)

1. **WAF rule blocking `.db`/`.env`/`.log` at root** — buys time on C1 today (minutes).
2. **Create/repoint `og-image.webp`** — fixes every broken share preview (minutes).
3. **Add `robots.txt` + `sitemap.xml`** (hour).
4. **Add `*.tmp`, `.env*`, `*.log` to `.gitignore`** — prevents committing live data (minutes).
5. **Wrap forum/portal handlers in try/catch + add `unhandledRejection` guard** (H5) — kills the easy site‑wide DoS (hour).
6. **Use `isPrivateIp` in `getIp`** (H2) — restores rate limiting (minutes).
7. **Strip `role`/`status` from `staff/members/save`** (H1) (minutes).
8. **Include `DELETE` in CSRF checks** (M1) (minutes).
9. **Rate‑limit + auth `warranty/order-lookup`** (M3) (minutes).
10. **Delete unused 344 KB `logo.png`; add `loading="lazy"` to shop images** (minutes).

## 13. Larger Improvements

- **Move data out of web root + static allowlist** (proper C1 fix).
- **Automated off‑server backups + restore drill** (C2).
- **In‑memory caching layer / migrate to SQLite** (M7, H3, scalability).
- **Per‑file write locking** (H3).
- **Shared frontend `api`/CSRF module + decompose God‑components** (M8, M9, H6).
- **Finish or formally shelve gift cards / memberships / rewards / wallet** (`todo.md`).
- **Client‑side head management + JSON‑LD for SEO.**
- **Monitoring/alerting + dedicated service user + documented infra.**

---

## 14. Prioritised Action Plan (with impact & effort)

> Effort: **S** = <½ day · **M** = ½–2 days · **L** = multi‑day. Impact: business/risk reduction.

### Phase 0 — Stop the bleeding (today)
| # | Action | Addresses | Impact | Effort |
|---|---|---|---|---|
| 1 | Cloudflare WAF rule blocking `*.db`/`.env`/`*.log`/source at root; lock origin to Cloudflare IPs | C1 (stopgap), H2 | Critical | S |
| 2 | Rotate **all** secrets (admin password, Stripe key, SMTP) — assume `.env` may already be leaked | C1 | Critical | S |
| 3 | Stand up automated off‑server `.db` backups | C2 | Critical | S |

### Phase 1 — Critical/High fixes (this week)
| # | Action | Addresses | Impact | Effort |
|---|---|---|---|---|
| 4 | Static allowlist + move `.db`/`.env` out of web root | C1 | Critical | S–M |
| 5 | `try/catch` on forum/portal + global rejection handler | H5 | High | S |
| 6 | Use `isPrivateIp` in `getIp` | H2 | High | S |
| 7 | Field allowlist on `staff/members/save` (and other spreads) | H1, L5 | High | S |
| 8 | Per‑file write mutex; re‑validate gift‑card/rewards balances in‑lock | H3 | High | M |
| 9 | Require server‑side price for every SKU/variant | H4 | High | M |
| 10 | Surface admin save failures; stop optimistic update on error | H6 | High | M |

### Phase 2 — Medium hardening (next 2–3 weeks)
| # | Action | Addresses | Impact | Effort |
|---|---|---|---|---|
| 11 | Sanitize tutorial HTML; validate iframe URL | M2 | Med | S |
| 12 | CSRF on DELETE/PUT everywhere | M1 | Med | S |
| 13 | Auth + rate‑limit warranty lookup; non‑sequential IDs | M3 | Med | S |
| 14 | Webhook size cap + replay window | M4 | Med | S |
| 15 | Stop persisting live secrets to `settings.db` | M5 | Med | M |
| 16 | HSTS + Permissions‑Policy; fix/verify CSP inline‑script handling | M6 | Med | S–M |
| 17 | In‑memory `.db` cache (write‑through) | M7 | Med | M |
| 18 | Shared `api`/CSRF module | M8, M11 | Med | M |

### Phase 3 — SEO, UX, performance (parallelizable)
| # | Action | Addresses | Impact | Effort |
|---|---|---|---|---|
| 19 | og‑image, robots, sitemap, JSON‑LD, client‑side titles, canonical, twitter/OG on sub‑apps | §9 | Med (growth) | M |
| 20 | Lazy‑load images, LCP preload, non‑blocking fonts, finish PWA | §7 | Med | M |
| 21 | Accessibility pass; themed dialogs; fix broken links/placeholders | §8, L10‑L14 | Med | M |
| 22 | Wire Cloudflare Web Analytics | §9 | Low–Med | S |

### Phase 4 — Strategic (this quarter)
| # | Action | Addresses | Impact | Effort |
|---|---|---|---|---|
| 23 | Migrate flat‑JSON → SQLite (indexed, transactional) | M7, H3, scale | High (long‑term) | L |
| 24 | Decompose God‑components; memoize heavy lists | M9 | Med | L |
| 25 | Monitoring/alerting, dedicated service user, documented infra, build‑strategy decision | H5, M10, §11 | Med | M–L |
| 26 | Finish or shelve gift cards / memberships / rewards / wallet | `todo.md` | Med | L |

---

### Appendix — Audit coverage
UX/design · frontend code quality · backend/API · database · security · performance/reliability · SEO/analytics/metadata · infrastructure/deployment · maintainability. Backend security, frontend quality, secrets/infra, and SEO/performance were each investigated in dedicated deep dives; the critical C1 finding was independently reproduced. No production data was accessed (the `.db` files are gitignored and absent from this checkout); C1's data‑exposure impact is inferred from the documented production layout where those files sit beside the code.
