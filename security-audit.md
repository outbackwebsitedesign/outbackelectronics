# Security Audit — June 2026

Comprehensive audit covering `server.js` (backend), the React frontend, and
operational scripts/config (`deploy.sh`, `watchdog.py`, repo hygiene).

**Overall posture: good.** Authentication, session handling, CSRF, payment
validation, path traversal protection, and security headers are all solid
(see "Verified secure" at the bottom). The actionable findings are mostly
operational and a small number of code-level issues.

---

## High priority

### 1. Stored XSS in tutorial content — `pages-community.jsx:209`
`activeTutorial.content` is rendered via `dangerouslySetInnerHTML` with no
sanitization. A compromised admin account or poisoned tutorial record yields
stored XSS on the public site.

**Fix:** render through the existing safe `renderMarkdown()` path, or
sanitize with DOMPurify. Related: the markdown link renderer
(`pages-community.jsx:19`) does not block `javascript:` URLs.

### 2. `X-Forwarded-For` spoofing — `server.js:833-846` (`getIp`)
When the socket IP is private, the first `X-Forwarded-For` value is trusted
as-is. If any service port is ever directly reachable (or a local proxy
doesn't strip XFF), an attacker can spoof an allowlisted IP to bypass
`ADMIN_IP_ALLOWLIST` and reset login lockout counters.

**Fix:** only trust XFF / `cf-connecting-ip` when explicitly configured for
the actual proxy in front of the app.

### 3. Error detail leakage — `server.js:4106`
`String(err.message || err)` is returned to clients on write failures.

**Fix:** log the full error server-side; return a generic message.

---

## Medium priority

- **Predictable IDs from `Math.random()`** — `server.js:316, 338, 559-607`
  (service, customer, rewards/store-credit history IDs). Use
  `crypto.randomBytes(8).toString('hex')`.
- **Stripe redirect not validated** — `pages-cart.jsx:286` does
  `window.location.href = data.url` with no check. Constrain to
  `https://checkout.stripe.com/`.
- **Refund amount not validated against order total** (open item from
  ADMIN-AUDIT.md) — an admin typo can refund more than was charged.
- **Deploy script group setup** — `deploy.sh:38-65` adds the service user to
  the deploying user's primary group; use a dedicated system group instead.
- **`.env` permissions unchecked** — `watchdog.py:36-49` reads `.env`
  without verifying it isn't world-readable. Ensure `chmod 600 .env` on the
  server.
- **Quote pricing logic + shop GPS coordinates in the public bundle** —
  `pages-info.jsx:10-17`. Move fee calculation server-side if it matters.

## Low priority

- `/api/admin/login` requires a CSRF token fetched first
  (`server.js:3602`) — works but fragile; exempt login explicitly.
- Quantity/shipping caps silently clamp instead of returning an error
  (`server.js:2649, 2703`).
- `.gitignore`: add `*.pem`, `*.key`, `secrets.*`.
- No `/.well-known/security.txt`; no admin-facing audit-log viewer.
- Rewards lookup keeps the password in React state after submit
  (`pages-cart.jsx:229-250`).

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
