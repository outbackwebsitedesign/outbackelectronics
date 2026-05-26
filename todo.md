# Outback Electronics — TODO: Placeholders & Hardcoded Values

> Audit date: 2026-05-26  
> No code edited — this is a read-only findings list.  
> Severity: CRITICAL → HIGH → MEDIUM → LOW

---

## CRITICAL — Breaks or silently degrades real user flows

### 1. shop.email not set in admin Settings
`readSettings()` merges `settings.defaults.json` (where email is `""`) with `settings.db` on every read — the defaults file is a live merge base, not a one-time seed. Until an admin sets the contact email via admin → Settings → Shop, every staff notification (contact forms, quote requests, warranty registrations, order confirmations) falls back to `NOTIFY_EMAIL` → `SMTP_USER`, which may also be empty.  
**Fix:** Set shop email in admin → Settings.

### 2. shop.description not set in admin Settings
Same merge behaviour — `description` is `""` in defaults. Shows as hardcoded fallback string in footer and About page until set.  
**Fix:** Set shop description in admin → Settings.

### 3. SMTP not configured (server.js:33–36)
`SMTP_HOST`, `SMTP_USER`, `SMTP_PASS` all default to empty string. No email is ever delivered (quote confirmations, order shipped, warranty, password reset, contact form). Must be set via env vars or admin Settings → Integrations.

### 4. Stripe not configured (server.js:26–28)
`STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET` all empty. Portal "Pay Now" button and checkout return `503 stripe_not_configured`. Must be set via env vars or admin Settings → Integrations.

### 5. AusPost API not configured (server.js:29)
`AUSPOST_API_KEY` empty. Shipping quote endpoint returns `503 auspost_not_configured`. Shop checkout has no live shipping rates.

---

## HIGH — Visible "coming soon" / disabled features presented to customers

### 6. Gift Cards page — "coming soon" notice (pages-shop.jsx:1146–1147)
```
<span className="tag tag-outline">COMING SOON</span>
"Gift cards are not yet available. Check back soon."
```
Page is fully linked from nav and footer. Customers land on it and see this. Either implement or remove from nav.

### 7. Memberships page — tiers shown but purchase disabled (pages-shop.jsx:1296–1309)
```
"Memberships are not yet active. The tiers and prices shown below are
illustrative only — you cannot subscribe at this time."
opacity: usingDefaults ? 0.4 : 1
pointerEvents: usingDefaults ? 'none' : 'auto'
```
Three hardcoded default tiers (Basic $9/mo, Pro $19/mo, Elite $39/mo) shown greyed-out. Subscribe buttons completely disabled. Linked from nav. Either activate via admin → Memberships or remove from nav.

### 8. Hardcoded membership default tiers (pages-shop.jsx:1241–1264)
`defaultTiers` with hardcoded prices `$9`, `$19`, `$39` and hardcoded feature lists. These are illustrative placeholders — they should only exist in admin settings, not in the source code.

### 9. Portal Rewards tab — "COMING SOON" (portal-page.jsx:1028)
Visible tab in customer portal. Shows loyalty points programme description but zero functionality. No points earned, no history, no redemption.

### 10. Portal Wallet tab — "COMING SOON" (portal-page.jsx:1050–1052)
```
"Store credit and gift card balances will appear here."
```
Visible tab. No balance, no transaction history, no redemption.

### 11. siteContent.aiEnabled is false (settings.defaults.json)
AI/Edge AI page is feature-flagged off. "NEW · 2026" badge hidden. Page content exists and is good — just never shown unless an admin enables it in Settings.

---

## MEDIUM — Hardcoded values that should come from config/settings

### 12. Hardcoded address in AboutPage (pages-info.jsx:692)
```js
"183 Peericoota Forest Rd, Moama NSW 2731"
```
Hardcoded directly in JSX string, not reading from `shop.address`. If the address changes it won't update here.

### 13. Hardcoded acknowledgement of country (app.jsx:611)
```
"ACKNOWLEDGES THE ARRERNTE PEOPLE AS TRADITIONAL OWNERS OF MPARNTWE"
```
Hardcoded in footer. Should be in settings or at minimum a named constant — Mparntwe is Alice Springs, which is only accurate if this is correct for Moama/Echuca country. Should be verified and made editable.

### 14. Hardcoded portal/forum/games URLs as fallbacks (app.jsx:25–27, 1280–1281)
```js
let _PORTAL_URL = 'https://portal.outbackelectronics.com.au'
let _FORUM_URL  = 'https://forum.outbackelectronics.com.au'
let _GAMES_URL  = 'https://games.outbackelectronics.com.au'
```
These are overwritten at runtime from `/api/shop-info`, but the hardcoded fallbacks mean a misconfigured server silently sends users to the wrong place.

### 15. Hardcoded site URL in portal footer links (portal-page.jsx:1447–1450)
```jsx
<a href="https://outbackelectronics.com.au">Main site</a>
<a href="https://forum.outbackelectronics.com.au">Forum</a>
<a href="https://outbackelectronics.com.au/contact">Contact</a>
<a href="https://outbackelectronics.com.au/policies">Policies</a>
```
All hardcoded. Should read from the portal's equivalent of `shop._siteUrl` / `shop._forumUrl`.

### 16. Hardcoded "Back to public site" URL in admin login (pages-admin.jsx:109)
```js
window.location.href = 'https://outbackelectronics.com.au/home'
```
Hardcoded. Should use `shop.siteUrl` from settings.

### 17. Hardcoded portal/shop/contact links in portal tabs (portal-page.jsx:400, 406, 1056, 1172–1173, 1295)
Multiple `href="https://outbackelectronics.com.au/..."` links throughout portal tabs (overview empty state, bookings CTA, wallet, warranty). All should use `getSiteUrl()` equivalent.

---

## MEDIUM — Empty states that masquerade as complete features

### 18. Software page — "No software listed yet." (pages-shop.jsx:604)
Real implementation, real API endpoint — but no data. Customers see a blank page. Add at least one listing or remove from nav until populated.

### 19. Tutorials page — "No tutorials published yet." (pages-community.jsx:143)
Real implementation — no data. Linked from footer and nav.

### 20. Groups page — "No groups listed yet." (pages-community.jsx:193)
Real implementation — no data. Linked from nav.

### 21. Admin overview "No activity yet" (pages-admin.jsx:431–432)
```
"No activity yet"
"Orders and new quote requests will appear here."
```
This is the first thing a new admin sees. Fine for a fresh install, but no guidance on what to do next.

### 22. Admin → Memberships: "No tiers yet. Create one to enable memberships" (pages-admin.jsx:4576)
Admin panel tells you to create tiers but the public memberships page still shows the hardcoded default tiers in ghost mode. The two systems are disconnected until real tiers are saved.

### 23. Admin → Memberships: "No subscriptions yet." (pages-admin.jsx:4601)
Expected — but combined with the public page showing disabled default tiers, the entire memberships flow is a dead end.

---

## LOW — Minor but visible gaps

### 24. Portal Bookings tab — no online booking flow
Has a list view and API call, but no way to create a booking from the portal. Currently shows a CTA to the quote form as workaround. Should either have a real booking form or be removed from the tab bar.

### 25. `shop.email` fallback copy in contact page (pages-info.jsx:797)
```js
const email = (shop && shop.email) ? shop.email.trim() : '';
```
If empty, the contact page EMAIL section renders a dash (`—`). Not a crash but looks incomplete.

### 26. Portal login has no "Sign in with…" / SSO — minor UX gap
Username required (not email). New users arriving from a warranty link or quote email don't know their username. Password reset requires knowing your username AND email — but registration now collects email so this should work, just not obvious to the user.

### 27. `siteContent.aiHeading` and `siteContent.aiBody` in settings are live but `aiEnabled: false`
Content is written and committed. Just needs enabling in admin → Settings → Site Content when ready to launch.

### 28. Admin Settings → Integrations is empty (`settings.defaults.json: "integrations": []`)
The integrations array is used to configure third-party webhooks/APIs. Nothing is pre-configured. This is expected but means Stripe, SMTP, AusPost must all be set via environment variables instead of the UI — which is less discoverable for a non-technical operator.

---

## Summary table

| # | Location | Issue | Severity |
|---|----------|-------|----------|
| 1 | settings.defaults.json | shop.email empty | CRITICAL |
| 2 | settings.defaults.json | shop.description empty | CRITICAL |
| 3 | server.js env vars | SMTP not configured | CRITICAL |
| 4 | server.js env vars | Stripe not configured | CRITICAL |
| 5 | server.js env vars | AusPost not configured | CRITICAL |
| 6 | pages-shop.jsx:1146 | Gift cards "coming soon" | HIGH |
| 7 | pages-shop.jsx:1296 | Memberships disabled/greyed | HIGH |
| 8 | pages-shop.jsx:1241 | Hardcoded membership default tiers | HIGH |
| 9 | portal-page.jsx:1028 | Rewards "coming soon" | HIGH |
| 10 | portal-page.jsx:1050 | Wallet "coming soon" | HIGH |
| 11 | settings.defaults.json | aiEnabled: false | HIGH |
| 12 | pages-info.jsx:692 | Address hardcoded in AboutPage | MEDIUM |
| 13 | app.jsx:611 | Acknowledgement hardcoded | MEDIUM |
| 14 | app.jsx:25–27 | Portal/forum/games URLs hardcoded | MEDIUM |
| 15 | portal-page.jsx:1447 | Footer links hardcoded | MEDIUM |
| 16 | pages-admin.jsx:109 | Back-to-site URL hardcoded | MEDIUM |
| 17 | portal-page.jsx multiple | CTA links hardcoded | MEDIUM |
| 18 | pages-shop.jsx | Software — no data | MEDIUM |
| 19 | pages-community.jsx | Tutorials — no data | MEDIUM |
| 20 | pages-community.jsx | Groups — no data | MEDIUM |
| 21 | pages-admin.jsx:431 | Overview "no activity yet" | MEDIUM |
| 22 | pages-admin.jsx:4576 | Memberships tiers disconnected | MEDIUM |
| 23 | pages-admin.jsx:4601 | No subscriptions yet | MEDIUM |
| 24 | portal-page.jsx | Bookings — no create flow | LOW |
| 25 | pages-info.jsx:797 | Contact email renders dash if empty | LOW |
| 26 | portal-page.jsx | Login requires username not email | LOW |
| 27 | settings.defaults.json | aiEnabled: false | LOW |
| 28 | settings.defaults.json | Integrations array empty | LOW |
