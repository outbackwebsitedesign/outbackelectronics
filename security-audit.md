# Security Audit — June 2026

Comprehensive audit covering `server.js` (backend), the React frontend, and
operational scripts/config (`deploy.sh`, `watchdog.py`, repo hygiene).

**Overall posture: good.** Authentication, session handling, CSRF, payment
validation, path traversal protection, and security headers are all solid
(see "Verified secure" at the bottom). The actionable findings are mostly
operational and a small number of code-level issues.

---

## High priority

### 1. ✅ Stored XSS in tutorial content — `pages-community.jsx:209`
~~`activeTutorial.content` is rendered via `dangerouslySetInnerHTML` with no
sanitization. A compromised admin account or poisoned tutorial record yields
stored XSS on the public site.~~

**Fixed:** replaced `dangerouslySetInnerHTML` with `renderMarkdown()` (safe JSX).
Also blocked `javascript:` URLs in the inline link renderer (`pages-community.jsx:19`).

### 2. ✅ `X-Forwarded-For` spoofing — `server.js:833-846` (`getIp`)
~~When the socket IP is private, the first `X-Forwarded-For` value is trusted
as-is. If any service port is ever directly reachable (or a local proxy
doesn't strip XFF), an attacker can spoof an allowlisted IP to bypass
`ADMIN_IP_ALLOWLIST` and reset login lockout counters.~~

**Fixed:** proxy headers are now only trusted when the socket IP is loopback
(`127.0.0.1`/`::1`). Cloudflare Tunnel always connects from loopback, so
legitimate traffic is unaffected; LAN clients can no longer spoof the IP.

### 3. ✅ Error detail leakage — `server.js:4106`
~~`String(err.message || err)` is returned to clients on write failures.~~

**Fixed:** full error logged server-side only; generic `write_failed` returned to client.

---

## Medium priority

- ✅ **Predictable IDs from `Math.random()`** — All `Math.random().toString(36)`
  ID suffixes in `server.js` replaced with `crypto.randomBytes(4).toString('hex')`.
- ✅ **Stripe redirect not validated** — `pages-cart.jsx:286` now checks that
  `data.url` starts with `https://checkout.stripe.com/` before redirecting.
- ✅ **Refund amount not validated against order total** — Already validated at
  `server.js:4178-4181` (`maxRefund` cap enforced server-side). Confirmed closed.
- ✅ **Deploy script group setup** — `deploy.sh` now creates and uses a dedicated
  `outback-app` system group instead of the deploying user's primary group.
- ✅ **`.env` permissions unchecked** — `watchdog.py` now checks the file mode
  at startup and logs a warning if `.env` is world-readable.
- ✅ **Quote pricing logic + shop GPS coordinates in the public bundle** —
  Pricing constants and haversine formula removed from `pages-info.jsx`;
  new `GET /api/callout-fee?lat=&lng=` endpoint computes distance and fee
  server-side and returns only the values needed for display.

## Low priority

- ✅ `/api/admin/login` CSRF exempted — login is pre-auth; CSRF provides
  no meaningful protection and was fragile on first visit before a token
  was issued (`server.js`).
- ✅ Quantity/shipping caps now return 422 instead of silently clamping
  (`server.js` checkout handler).
- ✅ `.gitignore`: added `*.pem`, `*.key`, `secrets.*`.
- ✅ `/.well-known/security.txt` endpoint added to main server; contact
  email pulled from `settings.db` → `shop.email`, falls back to
  `NOTIFY_EMAIL`.
- ✅ Admin audit log viewer added (`/audit-log` section, manager+ only)
  — paginated table of all `auditAdminAction` entries from
  `admin-audit.log`; backed by `GET /api/admin/audit-log`.
- ✅ Rewards password cleared from React state after a successful lookup
  (`pages-cart.jsx`).

## Accepted risk (owner decision)

- **Unencrypted USB backups including `.env`** — `deploy.sh:183-219`. The
  hourly backup tars the `.db` files and `.env` in plaintext onto a USB
  stick. Owner has assessed this as a non-issue: only the owner has physical
  access to the server and the stick does not leave the premises. Revisit if
  backups are ever taken offsite.
- **Hardcoded WiFi password and weather API key** in
  `arduino/gas-sensor-monitor/gas-sensor-monitor.ino:22-29` (also in git
  history). Owner has assessed this as a non-issue for this private repo /
  low-stakes network. Revisit if the repo is ever made public or access
  widens.

---

## Verified secure (no action needed)

- Password hashing: scrypt with random salt, timing-safe comparison.
- Session tokens and reset tokens: `crypto.randomBytes(32)`; reset tokens
  hashed at rest.
- Checkout prices recalculated server-side from the catalog
  (`server.js:2619-2667`) — client-submitted prices are ignored.
- Stripe webhook signatures verified with `timingSafeEqual`.
- Static file serving and uploads protected against path traversal; `.db`
  files are not reachable via the static server.
- CSRF enforced on all mutating routes; cookies are HttpOnly,
  SameSite=Strict, Secure under HTTPS.
- CSP, HSTS, X-Frame-Options: DENY, X-Content-Type-Options: nosniff set.
- No SQL, no `child_process`/`exec`, no `eval`.
- Admin endpoints all check role; portal data filtered by user; public
  endpoints rate-limited with login lockout.
- Integration secrets encrypted (AES-256-GCM) when
  `SETTINGS_ENCRYPTION_KEY` is set.
- No secrets in `public/`, `assets/`, README, or the Vite build config; no
  source maps shipped.

## Suggested order of work

1. Fix the tutorial XSS.
2. Harden `getIp()` and sanitize the write-failure error response.
3. Replace `Math.random()` IDs; validate the Stripe redirect URL; add
   refund-amount validation.
4. Low-priority items as convenient.
