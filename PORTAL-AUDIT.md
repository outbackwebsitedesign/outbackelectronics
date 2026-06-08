# Customer Portal — In-Depth Usability Audit

## Executive Summary

The portal is well-built with a clean design system, good branding, and solid feature coverage (10 tabs covering orders, repairs, quotes, membership, rewards, wallet, addresses, bookings, and account). However, there are significant usability issues across navigation, mobile responsiveness, accessibility, data presentation, and interaction patterns.

---

## 1. Navigation & Information Architecture

### 1.1 Tab Overload
**Severity: High**
10 horizontal tabs (`portal-page.jsx:277-288`) is too many for a single navigation bar. On screens under ~1100px, tabs will overflow horizontally. The mobile CSS makes them horizontally scrollable (`mobile.css:114-116`), but there's **no visual indicator that more tabs exist off-screen** — users won't know to scroll.

**Recommendation:** Group tabs into categories (e.g., "My Orders" section containing Orders/Repairs/Quotes, a "My Account" section with Wallet/Rewards/Membership/Addresses/Account), or use a sidebar nav on desktop and a hamburger-style menu on mobile.

### 1.2 Inconsistent Page Wrappers Across Tabs
**Severity: Medium**
Tab state is synced to the URL path (`portal-page.jsx:1633-1636`), which is good. But tabs like Memberships, Rewards, Wallet use `tab-content` / `section-block` wrapper classes instead of `page-section` / `container` — this creates **inconsistent page layouts** across tabs (see section 3.1).

### 1.3 No Breadcrumbs or Back Navigation
**Severity: Low**
When viewing expanded order details or quote acceptance flows, there's no breadcrumb trail. Users rely on browser back or re-clicking the tab.

---

## 2. Mobile Responsiveness

### 2.1 Tab Bar — Hidden Scrollability
**Severity: High**
The tab bar uses `overflow-x: auto` with hidden scrollbar (`mobile.css:114-115`). With 10 tabs, at least 4-5 will be hidden off-screen on mobile. There is **no scroll indicator, fade edge, or "more" affordance**. Users may never discover Bookings, Account, or Wallet tabs.

### 2.2 Nav User Section Not Mobile-Adapted
**Severity: High**
The top nav user section (`portal-page.jsx:308-315`) shows "Signed in as **username**" plus a Sign Out button inline. On narrow screens, this will either overflow or get severely compressed. There's **no mobile-specific nav layout** for the portal topnav — `mobile.css` handles the main site hamburger menu but not the portal's top bar.

### 2.3 Inline Grid Styles Not Responsive
**Severity: Medium**
The address form uses a 3-column grid (`portal-page.jsx:1239`) for city/state/postcode with inline `gridTemplateColumns` styles. While `mobile.css` collapses `.grid-2` and `.grid-3` to single column, inline styles **won't be overridden** by the CSS class-based media query. The 80px state field will be cramped on 320px screens.

### 2.4 Data Tables Overflow
**Severity: Medium**
Repairs (`portal-page.jsx:690`), Quotes history, and Bookings use `<table>` with `overflow:auto` on the card wrapper. This works, but the table content (Job ID, Device, Customer, Stage, Updated) doesn't reflow on mobile — users must horizontal-scroll within a card, which is poor UX.

---

## 3. Visual Consistency & Layout

### 3.1 Undefined CSS Classes on Multiple Tabs
**Severity: High (Bug)**
Some tabs use `page-section > container` (Overview, Orders, Repairs, Quotes, Account), while others use `tab-content > section-block` (Memberships, Rewards, Wallet, Addresses, Bookings). The `tab-content` and `section-block` classes **are never defined in CSS** — they have no padding, max-width, or margin rules. This means those tabs render edge-to-edge without the consistent container padding.

Affected tabs:
- `MembershipsTab` (`portal-page.jsx:954`)
- `RewardsTab` (`portal-page.jsx:1036`)
- `WalletTab` (`portal-page.jsx:1118`)
- `AddressesTab` (`portal-page.jsx:1222`)
- `BookingsTab` (`portal-page.jsx:1333`)

### 3.2 Missing Section Headers on Some Tabs
**Severity: Low**
Overview, Orders, Repairs, Quotes, and Account use the styled `section-head` with the serif `h2`. Memberships, Rewards, Wallet, Addresses, and Bookings use bare `<h2>` tags without the `section-head` wrapper, losing the description subtitle and consistent spacing.

### 3.3 Inconsistent Feedback Components
**Severity: Medium**
- Memberships uses `notice` and `notice-warn` classes (`portal-page.jsx:957`) — **these CSS classes don't exist** in `portal.html`. Messages will render unstyled.
- Rewards and Wallet have no user-facing error states.
- Quotes uses `alert()` for accept failures (`portal-page.jsx:759`) — a browser dialog instead of an inline message.

---

## 4. Forms & Input Validation

### 4.1 No Client-Side Validation Feedback
**Severity: High**
Forms rely entirely on HTML5 `required` attributes and server responses. There is:
- No real-time field validation (e.g., email format, password strength meter)
- No inline error messages next to specific fields
- Password change doesn't show a "confirm new password" field (`portal-page.jsx:1484`)
- Registration password has "Minimum 8 characters" hint but no strength indicator

### 4.2 Quote Request Form Doesn't Pre-fill Email
**Severity: Medium**
The quote request form (`portal-page.jsx:725`) pre-fills the name from `user.displayName || user.username` but leaves email blank. The user is already logged in — their email should auto-populate from the session.

### 4.3 Address Form — No Edit Capability
**Severity: Medium**
Users can add and delete addresses but **cannot edit** an existing address (`portal-page.jsx:1191-1272`). They must delete and re-add, losing any address if they make a typo.

### 4.4 Address Display Incomplete
**Severity: Low**
The address list card (`portal-page.jsx:1258-1260`) only shows `name`, `city state postcode` — it doesn't display `line1` (street address). Users can't verify which address is which if they have multiple in the same city.

### 4.5 Delete Address — No Confirmation
**Severity: Medium**
Clicking "Remove" on an address immediately deletes it (`portal-page.jsx:1216-1218`) with no confirmation dialog. Compare to membership cancellation which uses `window.confirm()`.

---

## 5. Empty States & Onboarding

### 5.1 No Onboarding Flow
**Severity: Medium**
After registration, users land on the Overview tab which shows "0 orders, 0 repairs, 0 quotes" — all zeros. There's no welcome message, getting-started guide, or suggestion to browse the shop, request a quote, or book a service.

### 5.2 Inconsistent Empty States
**Severity: Low**
- Orders/Repairs use the `EmptyState` component with SVG icon and contact link
- Addresses uses a plain `<p>` tag
- Bookings uses a card with a contact button
- Rewards/Wallet use cards with text
- No unified empty state pattern

---

## 6. Data Presentation

### 6.1 Orders Not Sorted
**Severity: Medium**
Orders are displayed in whatever order the API returns them (`portal-page.jsx:599-608`). There's no client-side sort by date, and no sort/filter controls. Users with many orders have no way to find a specific one besides scrolling.

### 6.2 No Search or Filter
**Severity: Medium**
No search, date filter, or status filter on any list view (Orders, Repairs, Quotes, Bookings). As data grows, these become unusable.

### 6.3 No Pagination
**Severity: Low (for now)**
All data is fetched in a single API call with no pagination. Fine for a small business, but will degrade with scale.

### 6.4 Repairs Are Read-Only
**Severity: Medium**
The Repairs tab is purely a status viewer — no ability to add notes, upload photos of damage, or communicate with the repair team. The "Need help?" link in the empty state goes to the main site contact page, which is a context switch.

---

## 7. Accessibility

### 7.1 No ARIA Labels or Roles
**Severity: High**
- Tab buttons have no `role="tab"`, `aria-selected`, or `tabpanel` relationships
- Expandable order cards use `onClick` on a `<div>` with no `role="button"`, `aria-expanded`, or keyboard support
- The ▲/▼ chevrons are plain text with no screen reader context
- Loading states have no `aria-live` regions

### 7.2 No Keyboard Navigation
**Severity: High**
- Order expansion is click-only (`portal-page.jsx:643`) — no keyboard handler
- Tab switching is click-only — no arrow key navigation
- Focus is not managed when switching tabs or expanding content

### 7.3 Color Contrast Issues
**Severity: Medium**
- `--ink-3: #8b7e69` on `--bg: #f4ede1` — secondary text likely fails WCAG AA (4.5:1 ratio)
- `--ink-2: #5a4f40` on `--bg` is borderline
- Status tags use small (10px) uppercase text which needs higher contrast ratios

### 7.4 No Focus Styles
**Severity: Medium**
Buttons and inputs have `outline: none` on the input class (`portal.html:67`) with no custom focus indicator. Tab and keyboard users have no visible focus ring.

---

## 8. Security & UX Friction

### 8.1 Password Change Missing Confirmation Field
**Severity: Medium**
The change password form (`portal-page.jsx:1477-1486`) asks for current and new password but has **no "confirm new password" field**. Users can easily mistype their new password and lock themselves out.

### 8.2 No Session Timeout Warning
**Severity: Low**
Portal sessions have a 30-day TTL, but there's no warning before expiry and no "remember me" option. Users may lose unsaved form data if their session expires mid-use.

### 8.3 Account Deletion Not Available
**Severity: Low**
No way for users to delete their account or request data export (GDPR/Privacy Act compliance concern).

---

## 9. Performance & Loading

### 9.1 No Loading Skeletons
**Severity: Low**
All tabs show "Loading..." plain text. Skeleton/shimmer placeholders would reduce perceived load time and prevent layout shifts.

### 9.2 Redundant API Calls
**Severity: Low**
Switching between tabs re-fetches data every time (no caching). The Overview tab fires 3 parallel requests, then switching to Orders fires another request for the same data.

### 9.3 Maintenance Check Polling
**Severity: Low**
`portal.html:156-169` polls `/api/maintenance-status` every 5 seconds unconditionally. This is wasteful — should use a longer interval or server-sent events.

---

## 10. Specific Bug-Level Issues

| # | Issue | Location | Severity |
|---|-------|----------|----------|
| 1 | `notice` / `notice-warn` CSS classes used but **never defined** — membership messages render unstyled | `portal-page.jsx:957` | Bug |
| 2 | `checks` CSS class used for feature lists but **never defined** — membership features render as unstyled `<ul>` | `portal-page.jsx:970, 990` | Bug |
| 3 | `section-block` / `tab-content` classes **never defined** — 5 tabs lack container padding | `portal-page.jsx:954, 1036, 1118, 1222, 1333` | Bug |
| 4 | BookingStatusBadge uses `borderRadius: 10` (pill shape) while all other tags use square corners — visual inconsistency | `portal-page.jsx:1280` | Minor |
| 5 | Quote accept error uses `alert()` instead of inline message | `portal-page.jsx:759` | Minor |
| 6 | `getSiteUrl()` returns empty string until `/api/shop-info` resolves — "Back to main site" link on login page may be broken during initial load | `portal-page.jsx:104` | Bug |

---

## Priority Recommendations

1. **Fix the CSS bugs** — define the missing classes (`notice`, `checks`, `tab-content`, `section-block`) or replace with existing classes
2. **Add container wrappers** to the 5 tabs missing them so content doesn't render edge-to-edge
3. **Add a mobile nav solution** — either a hamburger menu or visible tab scroll indicators
4. **Add confirmation dialogs** to destructive actions (address delete) and a confirm field to password change
5. **Pre-fill the quote form email** from the logged-in user's session
6. **Add basic accessibility** — ARIA roles on tabs, keyboard handlers on expandable cards, visible focus styles
7. **Add edit capability** to saved addresses
8. **Add sort/filter controls** to Orders list
