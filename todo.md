# Outback Electronics — TODO: Placeholders & Hardcoded Values

> Original audit: 2026-05-26 | Re-audited: 2026-05-28  
> Severity: CRITICAL → HIGH → MEDIUM → LOW  
> Status: ✅ DONE | ⚠️ PARTIAL | ❌ OPEN

**Note on settings.defaults.json:** This file does **not** exist in the repo and must **never** be created. All settings are read from and written to `settings.db` (gitignored, live data) exclusively. `readSettings()` in `server.js` (lines ~266–279) handles missing keys with inline fallbacks — there is no JSON defaults file involved. Any code, script, or deploy step that creates or reads `settings.defaults.json` should be rejected. `README.md` (lines 45, 57) and `CLAUDE.md` (line 66) still incorrectly describe a merge-with-defaults-file pattern — these docs need updating (see item #29 below).

---

## CRITICAL — Breaks or silently degrades real user flows

### ❌ 1. shop.email not set in admin Settings
`readSettings()` falls back to `shop: {}` when settings.db is absent or missing the key. Until an admin sets the contact email via admin → Settings → Shop, every staff notification (contact forms, quote requests, warranty registrations, order confirmations) falls back to `NOTIFY_EMAIL` → `SMTP_USER`, which may also be empty. Contact page renders `—` when empty (pages-info.jsx:342).  
**Fix:** Set shop email in admin → Settings.

### ❌ 2. shop.description not set in admin Settings
Footer falls back to hardcoded string `'An independent electronics outpost serving remote Australia...'` (app.jsx:565) when not set.  
**Fix:** Set shop description in admin → Settings.

### ❌ 3. SMTP not configured (server.js:35–38)
`SMTP_HOST`, `SMTP_USER`, `SMTP_PASS` all default to `''`. No email is ever delivered (quote confirmations, order shipped, warranty, password reset, contact form).  
**Fix:** Set env vars `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `NOTIFY_EMAIL`.

### ❌ 4. Stripe not configured (server.js:28–30)
`STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET` all default to `''`. Portal "Pay Now" and checkout return `503 stripe_not_configured`.  
**Fix:** Set Stripe env vars.

### ❌ 5. AusPost API not configured (server.js:31)
`AUSPOST_API_KEY` defaults to `''`. Shipping quote endpoint returns `503 auspost_not_configured`. Shop checkout has no live shipping rates.  
**Fix:** Set `AUSPOST_API_KEY` env var.

---

## HIGH — Visible "coming soon" / disabled features presented to customers

### ❌ 6. Gift Cards page — "coming soon" notice (pages-shop.jsx:1311)
```
"Gift cards coming soon — check back shortly."
```
Page is fully linked from nav and footer. Customers land on it and see this. Either implement or remove from nav.

### ❌ 7. Memberships page — tiers shown but purchase disabled (pages-shop.jsx:1462–1475)
```
"Memberships are not yet active. The tiers and prices shown below are
illustrative only — you cannot subscribe at this time."
opacity: usingDefaults ? 0.4 : 1
pointerEvents: usingDefaults ? 'none' : 'auto'
```
Three hardcoded default tiers shown greyed-out. Subscribe buttons completely disabled. Linked from nav. Either activate via admin → Memberships or remove from nav.

### ❌ 8. Hardcoded membership default tiers (pages-shop.jsx:1405–1425)
`defaultTiers` array hardcodes prices `$9`, `$19`, `$39` and feature lists directly in JSX. These placeholders should only exist in admin settings, not in source code.

### ✅ 9. Portal Rewards tab — ~~"COMING SOON"~~ (FIXED)
RewardsTab now loads real data from `/api/portal/rewards`, shows actual points balance and history. "No points yet" shown when empty — not a "coming soon" placeholder. (portal-page.jsx:1022–1101)

### ⚠️ 10. Portal Wallet tab — partially implemented (portal-page.jsx:1106–1199)
**Gift cards:** Fully working — fetches cards matched to user's email from DB, shows masked code, balance, issue date.  
**Store credit:** Always returns `storeCredits: []` (server.js:4680 hardcoded). No store credit data model exists anywhere — no `.db` file, no admin UI to issue credit, no checkout integration. The UI renders "No store credit available." for every user. This half of the wallet is a hollow shell.

### ❌ 11. AI/Edge AI page feature-flagged off
`aiEnabled` is not set in settings, so the AI page and "NEW · 2026" badge are hidden. Page content exists and is complete. Enable via admin → Settings → Site Content when ready to launch.

---

## MEDIUM — Hardcoded values that should come from config/settings

### ⚠️ 12. Address in AboutPage uses hardcoded fallback (pages-info.jsx:1143)
```js
<div>{shop?.address || '183 Peericoota Forest Rd, Moama NSW 2731'}</div>
```
Now reads from `shop.address` — but the hardcoded fallback string is still baked into JSX. The prose sentence at line 1129 also still hardcodes the full address inline. If the address changes and isn't set in admin Settings, both spots revert to the hardcoded string.

### ❌ 13. Hardcoded acknowledgement of country (app.jsx:613)
```
"ACKNOWLEDGES THE ARRERNTE PEOPLE AS TRADITIONAL OWNERS OF MPARNTWE"
```
Hardcoded in footer. Mparntwe is Alice Springs — needs verification this is correct for Moama/Echuca country. Should be editable via settings.

### ❌ 14. Hardcoded portal/forum/games URLs as fallbacks (app.jsx:25–27)
```js
let _PORTAL_URL = 'https://portal.outbackelectronics.com.au'
let _FORUM_URL  = 'https://forum.outbackelectronics.com.au'
let _GAMES_URL  = 'https://games.outbackelectronics.com.au'
```
Overwritten at runtime from `/api/shop-info`, but hardcoded fallbacks mean a misconfigured server silently sends users to the wrong place.

### ❌ 15. Hardcoded site URL in portal footer links (portal-page.jsx:1686–1689)
```jsx
<a href="https://outbackelectronics.com.au">Main site</a>
<a href="https://forum.outbackelectronics.com.au">Forum</a>
<a href="https://outbackelectronics.com.au/contact">Contact</a>
<a href="https://outbackelectronics.com.au/policies">Policies</a>
```
All hardcoded. Should read from the portal's equivalent of `shop._siteUrl` / `shop._forumUrl`.

### ❌ 16. Hardcoded "Back to public site" URL in admin login (pages-admin.jsx:134)
```js
window.location.href = 'https://outbackelectronics.com.au/home'
```
Hardcoded. Should use `shop.siteUrl` from settings.

### ❌ 17. Hardcoded portal/shop/contact links throughout portal (portal-page.jsx)
Multiple `href="https://outbackelectronics.com.au/..."` links throughout portal tabs:
- Line 111: back-to-main-site link
- Line 311: logo link
- Line 400: "Go to Shop →" in overview empty state
- Line 406: "Contact us →" in overview empty state
- Line 1399: "Contact us" in bookings tab
- Line 1534: "Contact our team →" in warranty tab

All should use a `getSiteUrl()` equivalent.

---

## MEDIUM — Empty states that masquerade as complete features

### ❌ 18. Software page — "No software listed yet." (pages-shop.jsx:604)
Real implementation, real API endpoint — but no data. Customers see a blank page. Add at least one listing or remove from nav until populated.

### ❌ 19. Tutorials page — "No tutorials published yet." (pages-community.jsx:135)
Real implementation — no data. Linked from footer and nav.

### ❌ 20. Groups page — "No active groups yet — they're coming soon." (pages-community.jsx:231)
Real implementation — no data. Linked from nav.

### ❌ 21. Admin overview "No activity yet" (pages-admin.jsx:458)
```
"No activity yet"
"Orders and new quote requests will appear here."
```
First thing a new admin sees. Fine for a fresh install, but no onboarding guidance on what to configure first.

### ❌ 22. Admin → Memberships: tiers disconnected from public page (pages-admin.jsx:5325)
Admin panel says "No tiers yet. Create one to enable memberships on the public site." — but public memberships page still shows hardcoded ghost tiers regardless. The two systems are not connected until real tiers are saved.

### ❌ 23. Admin → Memberships: "No subscriptions yet." (pages-admin.jsx:5350)
Expected — but combined with the public page showing disabled default tiers and no working subscribe flow, the entire memberships system is a dead end.

---

## LOW — Minor but visible gaps

### ✅ 24. Portal Bookings tab — ~~no online booking flow~~ (FIXED)
BookingsTab now has a full create form (serviceName, date, time, notes) that POSTs to `/api/portal/bookings`. Server-side endpoint creates and persists the booking. (portal-page.jsx:1306–1392, server.js:4691–4700)

### ❌ 25. Contact page email renders dash if empty (pages-info.jsx:342)
```jsx
{shop.email || '—'}
```
Renders a dash when `shop.email` is not set. Looks incomplete to customers. Tied to item #1.

### ❌ 26. Portal login requires username, not email (portal-page.jsx:84–87)
Username required (not email). New users arriving from a warranty link or order confirmation email don't know their username. Password reset requires knowing username AND email — registration collects email so it should work, but the UX is non-obvious.

### ❌ 27. AI page content ready but disabled
`aiHeading` and `aiBody` content written, AI page complete. Just needs `aiEnabled` set to `true` in admin → Settings → Site Content when ready to launch.

### ❌ 28. Integrations UI non-functional for external services
`readSettings()` always returns `integrations: []` as default (server.js:274, 278). Stripe, SMTP, AusPost must all be configured via environment variables — there is no working UI path for a non-technical operator to set these up.

### ❌ 29. Stale docs describe a settings.defaults.json merge pattern that no longer exists
`README.md` (lines 45, 57) and `CLAUDE.md` (line 66) both describe `settings.db` being merged over `settings.defaults.json` on every read. This is wrong — the file doesn't exist, `readSettings()` uses inline fallbacks only, and all settings are written to `settings.db` via admin → Settings. Both doc files need to be corrected to reflect the actual pattern.

---

## Summary table

| # | Location | Issue | Severity | Status |
|---|----------|-------|----------|--------|
| 1 | server.js / settings.db | shop.email empty | CRITICAL | ❌ OPEN |
| 2 | server.js / settings.db | shop.description empty | CRITICAL | ❌ OPEN |
| 3 | server.js env vars | SMTP not configured | CRITICAL | ❌ OPEN |
| 4 | server.js env vars | Stripe not configured | CRITICAL | ❌ OPEN |
| 5 | server.js env vars | AusPost not configured | CRITICAL | ❌ OPEN |
| 6 | pages-shop.jsx:1311 | Gift cards "coming soon" | HIGH | ❌ OPEN |
| 7 | pages-shop.jsx:1462 | Memberships disabled/greyed | HIGH | ❌ OPEN |
| 8 | pages-shop.jsx:1405 | Hardcoded membership default tiers | HIGH | ❌ OPEN |
| 9 | portal-page.jsx:1022 | Rewards "coming soon" | HIGH | ✅ DONE |
| 10 | portal-page.jsx:1106 / server.js:4680 | Wallet: gift cards work, store credit is hollow | HIGH | ⚠️ PARTIAL |
| 11 | settings.db / admin Settings | aiEnabled not set | HIGH | ❌ OPEN |
| 12 | pages-info.jsx:1129,1143 | Address hardcoded fallback in AboutPage | MEDIUM | ⚠️ PARTIAL |
| 13 | app.jsx:613 | Acknowledgement hardcoded | MEDIUM | ❌ OPEN |
| 14 | app.jsx:25–27 | Portal/forum/games URLs hardcoded | MEDIUM | ❌ OPEN |
| 15 | portal-page.jsx:1686 | Footer links hardcoded | MEDIUM | ❌ OPEN |
| 16 | pages-admin.jsx:134 | Back-to-site URL hardcoded | MEDIUM | ❌ OPEN |
| 17 | portal-page.jsx:111,311,400,406,1399,1534 | CTA links hardcoded | MEDIUM | ❌ OPEN |
| 18 | pages-shop.jsx:604 | Software — no data | MEDIUM | ❌ OPEN |
| 19 | pages-community.jsx:135 | Tutorials — no data | MEDIUM | ❌ OPEN |
| 20 | pages-community.jsx:231 | Groups — no data | MEDIUM | ❌ OPEN |
| 21 | pages-admin.jsx:458 | Overview "no activity yet" | MEDIUM | ❌ OPEN |
| 22 | pages-admin.jsx:5325 | Memberships tiers disconnected | MEDIUM | ❌ OPEN |
| 23 | pages-admin.jsx:5350 | No subscriptions yet | MEDIUM | ❌ OPEN |
| 24 | portal-page.jsx:1306 | Bookings — no create flow | LOW | ✅ DONE |
| 25 | pages-info.jsx:342 | Contact email renders dash if empty | LOW | ❌ OPEN |
| 26 | portal-page.jsx:84 | Login requires username not email | LOW | ❌ OPEN |
| 27 | admin Settings | aiEnabled not set | LOW | ❌ OPEN |
| 28 | server.js:274,278 | Integrations UI non-functional | LOW | ❌ OPEN |
| 29 | README.md:45,57 / CLAUDE.md:66 | Stale docs describe settings.defaults.json pattern | LOW | ❌ OPEN |
