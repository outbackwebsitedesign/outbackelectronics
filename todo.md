# Outback Electronics — TODO: Placeholders & Hardcoded Values

> Original audit: 2026-05-26 | Re-audited: 2026-05-28  
> Severity: CRITICAL → HIGH → MEDIUM → LOW  
> Status: ✅ DONE | ⚠️ PARTIAL | ❌ OPEN

**Note on settings.defaults.json:** This file does **not** exist in the repo and must **never** be created. All settings are read from and written to `settings.db` (gitignored, live data) exclusively. `readSettings()` in `server.js` (lines ~266–279) handles missing keys with inline fallbacks — there is no JSON defaults file involved. Any code, script, or deploy step that creates or reads `settings.defaults.json` should be rejected. `README.md` (lines 45, 57) and `CLAUDE.md` (line 66) still incorrectly describe a merge-with-defaults-file pattern — these docs need updating (see item #29 below).

---

## CRITICAL — Breaks or silently degrades real user flows

### ✅ 1. shop.email not set in admin Settings (RESOLVED)
`settings.db` is the single source of truth — all settings are read from and written to it via admin → Settings. An unset email is just an unset field, not a silent fallback issue. Set via admin → Settings → Shop if not already done.

### ✅ 2. shop.description not set in admin Settings (RESOLVED)
Same as above — settings.db only, no defaults file. Set via admin → Settings → Shop if not already done.

### ✅ 3. SMTP not configured (RESOLVED)
Server reads SMTP config from `integrations.find('Email')` in `settings.db` (server.js:1481–1487), falling back to env vars only if no admin entry exists. Configurable via admin → Settings → Integrations → Email.

### ✅ 4. Stripe not configured (RESOLVED)
Server reads Stripe secret key from `integrations.find('Stripe')` in `settings.db` (server.js:1385–1386), falling back to env var only if no admin entry exists. Configurable via admin → Settings → Integrations → Stripe.

### ✅ 5. AusPost API not configured (RESOLVED)
Server reads AusPost API key from `integrations.find('AusPost')` in `settings.db` (server.js:1401–1402), falling back to env var only if no admin entry exists. Configurable via admin → Settings → Integrations → AusPost.

---

## HIGH — Visible "coming soon" / disabled features presented to customers

### ✅ 6. Gift Cards page — "coming soon" notice (RESOLVED)
Denominations are populated in `gift-card-denominations.db` and the page renders real purchasable denominations on the live site. The "coming soon" text at `pages-shop.jsx:1320` is only an empty-state fallback and is never shown in practice.

### ✅ 7. Memberships page — tiers shown but purchase disabled (RESOLVED)
COMING SOON banner removed, greyed-out/pointer-events disabled state removed. Tiers are now live and purchasable via Stripe checkout (one-off payment).

### ✅ 8. Hardcoded membership default tiers (RESOLVED)
`defaultTiers` array and `usingDefaults` fallback removed from JSX. Tiers seeded into `memberships.db` via `scripts/seed-membership-tiers.js`.

### ✅ 9. Portal Rewards tab — full system implemented (RESOLVED)
Full rewards system built end-to-end:
- **Earning:** 50pts on signup; 1pt/$1 when order reaches `fulfilled` (admin save or AusPost auto-tracking); 1pt/$1 when repair card moves to `Done` column. Dedup by refId prevents double-granting.
- **Redemption:** Cart checkout has email+password login to verify account, shows points balance, checkbox to apply points as a discount (100pts = $1). Applied as a Stripe line-item; deducted atomically on webhook payment confirmation.
- **Admin panel:** New "Rewards" section in admin STORE group — searchable customer list, full history, manual grant/deduct with reason.
- **Portal tab:** Already shows real balance and history from `rewards.db` via `/api/portal/rewards`.

### ✅ 10. Portal Wallet tab — store credit now fully implemented (RESOLVED)
**Gift cards:** Fully working — fetches cards matched to user's email from DB, shows masked code, balance, issue date.  
**Store credit:** Built end-to-end, mirroring the Rewards system:
- **Data model:** `store-credits.db` (`{ entries: [{ userId, email, balance, history }] }`) with `readStoreCredits`/`writeStoreCredits` (atomic write) and `grantStoreCredit`/`deductStoreCredit` helpers (dedup by refId) in server.js.
- **Admin UI:** New "Store Credit" section in admin STORE group (manager+) — searchable customer list, balance, history, manual issue/deduct with reason. Endpoints `GET /api/admin/store-credit` and `POST /api/admin/store-credit/adjust`.
- **Portal display:** `/api/portal/wallet` now returns the user's real store-credit balance + history; the Wallet tab renders it.
- **Checkout redemption:** Customer logs in once at cart (`/api/rewards/me` + `/api/rewards/lookup` now also return `storeCredit`); a checkbox applies credit 1:1 AUD as a Stripe line-item discount (after gift card + points), deducted atomically on the `checkout.session.completed` webhook via `deductStoreCredit`.

### ✅ 11. AI/Edge AI page — NOT AN ISSUE (INVALID)
Earlier audit claimed the AI page was feature-flagged off. This is wrong. `aiEnabled` only toggles a cosmetic "NEW · 2026" badge (pages-shop.jsx:169); the AI editorial section, its body, and the "See the AI suite →" CTA always render, and the page is always reachable. There is no page-level enable/disable flag — nor should there be. The admin checkbox (pages-admin.jsx:5121) is explicitly labelled "Show 'NEW · 2026' badge on AI section". Nothing to do.

---

## MEDIUM — Hardcoded values that should come from config/settings

### ⚠️ 12. Address in AboutPage uses hardcoded fallback (pages-info.jsx:1143)
```js
<div>{shop?.address || '183 Peericoota Forest Rd, Moama NSW 2731'}</div>
```
Now reads from `shop.address` — but the hardcoded fallback string is still baked into JSX. The prose sentence at line 1129 also still hardcodes the full address inline. If the address changes and isn't set in admin Settings, both spots revert to the hardcoded string.

### ✅ 13. Hardcoded acknowledgement of country (app.jsx:613) — RESOLVED
`app.jsx:618` now reads from `shop.acknowledgmentPeople` and `shop.acknowledgmentCountry`, both editable via admin → Settings → Shop. Updated to "Bidjara People, Bidjara Country (Blackall)". The footer renders blank if neither field is set.

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

### ✅ 27. AI page content ready — NOT AN ISSUE (INVALID, duplicate of #11)
The AI page is not disabled. See #11: `aiEnabled` only toggles the "NEW · 2026" badge, not the page. Page is live and reachable. Nothing to do.

### ❌ 28. Integrations UI non-functional for external services
`readSettings()` always returns `integrations: []` as default (server.js:274, 278). Stripe, SMTP, AusPost must all be configured via environment variables — there is no working UI path for a non-technical operator to set these up.

### ✅ 29. Stale docs describe a settings.defaults.json merge pattern that no longer exists — RESOLVED
`CLAUDE.md` corrected to describe `settings.db` as the single source of truth with inline code fallbacks; `settings.defaults.json` is noted as non-existent. `README.md` still references the old pattern and should be updated separately.

### ❌ 30. Purchasing items does not update stock numbers
Completing a purchase does not decrement the stock count on the purchased product(s) in `products.db`. Stock figures shown in admin and on product pages remain stale after orders are placed.

---

## Summary table

| # | Location | Issue | Severity | Status |
|---|----------|-------|----------|--------|
| 1 | admin → Settings | shop.email empty | CRITICAL | ✅ DONE |
| 2 | admin → Settings | shop.description empty | CRITICAL | ✅ DONE |
| 3 | admin → Settings → Integrations | SMTP not configured | CRITICAL | ✅ DONE |
| 4 | admin → Settings → Integrations | Stripe not configured | CRITICAL | ✅ DONE |
| 5 | admin → Settings → Integrations | AusPost not configured | CRITICAL | ✅ DONE |
| 6 | pages-shop.jsx:1320 | Gift cards "coming soon" | HIGH | ✅ DONE |
| 7 | pages-shop.jsx:1462 | Memberships disabled/greyed | HIGH | ✅ DONE |
| 8 | pages-shop.jsx:1405 | Hardcoded membership default tiers | HIGH | ✅ DONE |
| 9 | portal-page.jsx:1022 | Rewards "coming soon" | HIGH | ✅ DONE |
| 10 | portal-page.jsx / server.js | Wallet store credit — full build (model, admin, redemption) | HIGH | ✅ DONE |
| 11 | pages-shop.jsx:169 | AI page "disabled" — INVALID, aiEnabled only toggles a badge | HIGH | ✅ N/A |
| 12 | pages-info.jsx:1129,1143 | Address hardcoded fallback in AboutPage | MEDIUM | ⚠️ PARTIAL |
| 13 | app.jsx:618 | Acknowledgement hardcoded | MEDIUM | ✅ DONE |
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
| 27 | pages-shop.jsx:169 | AI page "disabled" — INVALID, duplicate of #11 | LOW | ✅ N/A |
| 28 | server.js:274,278 | Integrations UI non-functional | LOW | ❌ OPEN |
| 29 | README.md:45,57 / CLAUDE.md:66 | Stale docs describe settings.defaults.json pattern | LOW | ⚠️ PARTIAL (CLAUDE.md fixed; README.md still stale) |
