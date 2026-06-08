# Usability Audit — Main Site (port 8080)

**Date:** 2026-06-08
**Scope:** Public shop + info site served from `index.html` via `app.jsx`, `pages-shop.jsx`, `pages-info.jsx`, `pages-community.jsx`, and `mobile.css`.

---

## CRITICAL

### 1. Search overlay has no focus trap or ARIA roles
**`app.jsx:112-172`** — The search overlay is a `position:fixed` backdrop but lacks `role="dialog"`, `aria-modal="true"`, and a focus trap. A user pressing Tab can focus elements behind the overlay. The result list has no `role="listbox"` / `aria-selected` attributes, so screen readers cannot navigate results. The `onMouseLeave` handler on lines 137/153 sets the highlight index to the *same* index instead of clearing it, meaning keyboard and mouse highlight can desync.

### 2. No skip-to-content link
**`index.html` / `app.jsx`** — There is a `<main id="main-content">` (line 1471) but no skip link anywhere. Keyboard users must Tab through the full utility bar, navigation, and hamburger button on every page load.

### 3. Mobile nav drawer has no focus trap
**`app.jsx:457-483`** — The mobile nav correctly uses `role="dialog"` and `aria-modal="true"`, but there is no focus trap implementation. When the drawer opens, focus stays on the hamburger button; Tab moves through content behind the full-screen overlay. Pressing Escape does not close it either (no `onKeyDown` handler).

### 4. Invalid product/service deep links show blank page
**`app.jsx:1340-1356`** — When navigating to `/product/invalid-sku`, the fetch resolves but finds no match. `setPageParams(null)` is called and `PageComponent` renders with `pageParams=null`. No 404 page, no error message, no redirect — the user sees a blank or broken layout.

### 5. Order success page shows no order ID
**`app.jsx:663-706`** — The `order_id` param is read (line 668) but never displayed to the user. The customer has no confirmation number to reference for pickup or support. For gift-card-only payments, `amountAud` is 0, so the "Amount Paid" section is hidden entirely (line 691: `session?.amountAud` is falsy for 0) — the customer gets no receipt summary at all.

---

## MAJOR

### 6. Accessibility: only 9 ARIA attributes across 3,142 lines of JSX
**`app.jsx`**: 8 ARIA attributes. **`pages-shop.jsx`**: 1. **`pages-info.jsx`** and **`pages-community.jsx`**: 0. Nearly all interactive elements (filter dropdowns, variant selectors, quantity controls, modals, tabs, accordions) lack screen reader support.

### 7. Quantity buttons are not keyboard accessible
**`app.jsx:987-989`** — The +/- buttons are `<button>` elements (good), but have no `aria-label`. Screen readers announce the raw text content "-" and "+", which is ambiguous. No `aria-describedby` links them to the item name.

### 8. Shop filters do not persist in URL
**`pages-shop.jsx:357-415`** — Category, brand, condition, and price filters are all React state with no URL serialization. If a user shares a filtered view, bookmarks it, or uses the browser back button, all filters reset. Sort also resets on filter change.

### 9. Cart sidebar not visible on mobile during editing
**`app.jsx:1003`** — The order summary sidebar uses `position:sticky; top:24` at desktop width. On mobile (`mobile.css:143`), the cart layout collapses to a single column, pushing the summary *below* all items. Users must scroll past their entire cart to see the total or checkout button. No floating "Checkout" bar or total indicator exists.

### 10. No live region for cart additions
**`app.jsx:1432-1438`** — When `addToCart()` fires, the cart count badge updates visually (with a pop animation, line 393), but there is no `aria-live` region to announce the change. Screen reader users get no confirmation that an item was added.

### 11. "Notify me" button does not call any API
**`pages-shop.jsx:1072-1073`** — The "Notify me" button on out-of-stock products just sets local state `setNotifySent(true)`. There is no `fetch()` call — the email is never sent to the server. The user is told "We'll email you" but nothing happens.

### 12. Breadcrumbs are not navigable
**`app.jsx` (PageHead component)** — Breadcrumbs render as `<span>` text, not links. "Outback / Shop / Product Detail" should let users click "Shop" to go back. This breaks a fundamental e-commerce navigation pattern.

### 13. Inconsistent error styling
Shipping error (`app.jsx:1037`) uses `color:'#b91c1c'`; gift card error uses the same; but rewards error and checkout error use different approaches. There is no shared error component or consistent `aria-live="polite"` announcement for errors.

### 14. Footer causes layout shift
**`app.jsx:494-510`** — Footer fetches categories and services asynchronously, then populates links. The footer renders empty columns initially, then shifts when data loads. No skeleton loader.

### 15. Checkout has no loading indicator during Stripe redirect
**`app.jsx:901-941`** — When `checkout()` is called, `setCheckingOut(true)` disables the button (text changes to "Processing..."), but if the Stripe session creation takes several seconds, there is no visual progress indicator beyond the button text change. No spinner, no overlay.

### 16. Search limited to 6 product results with no "view all" option
**`app.jsx:86`** — Product results are sliced to 6. If more match, the user has no way to know and no "View all X results" link. For a shop, this could hide relevant products.

---

## MINOR

### 17. No `viewport-fit=cover` for notched devices
**`index.html:6`** — The viewport meta has `width=device-width, initial-scale=1` but no `viewport-fit=cover`. On iPhones with notches, content may render behind the status bar or not use the full screen.

### 18. Utility bar hidden entirely on mobile
**`mobile.css:12`** — The utility bar (free shipping promo, quick links to Quote/Gift Cards/Sellers/Contact) is `display: none !important` on mobile. These are useful links that could go in the mobile drawer instead.

### 19. Product card condition display unclear
**`pages-shop.jsx:343`** — Shows `p.cond . SKU` in small monospace text. "Refurbished" vs "New" is visually identical — just text. No color coding or icon to distinguish product condition at a glance.

### 20. Service booking date has no max limit
**`pages-shop.jsx:1289 area`** — The `<input type="date">` sets `min` to today but no `max`. Users can book appointments years in the future.

### 21. No page-level meta description updates for SPA navigation
**`app.jsx:1389-1407`** — `document.title` updates per page, but `<meta name="description">` never changes. Social shares of deep-linked product/service pages show the homepage description.

### 22. Hamburger button uses `display:none` inline
**`app.jsx:447`** — The hamburger has `style={{display:'none'}}` inline, overridden by `mobile.css:9` with `display: grid !important`. This works but is fragile — any inline style change would break mobile nav.

### 23. Cart share link shows "EXPIRES IN 30 DAYS" with no actual date
**`app.jsx` (CartPage area)** — The share link section tells users the link expires in 30 days but does not show the actual expiry date, making it impossible to track.

### 24. `scrollTo({top:0})` missing `behavior: 'smooth'`
**`app.jsx:1402`** — Page transitions call `window.scrollTo({top:0})` which causes an instant jump. The back-to-top button (line 1481) uses `behavior:'smooth'`, creating inconsistent scroll behavior.

### 25. Logo click does not always visually reset active nav state
**`app.jsx:412`** — `Logo onClick={() => go('home')}` navigates, but the active class on nav items depends on `page === p.id`. If the user was on a page not in `PRIMARY_PAGES` (e.g., cart, policies), no nav item was highlighted, so there is no visual change — mildly confusing.

### 26. Product images have no lightbox/zoom
**`pages-shop.jsx:990-1006`** — Product detail shows a main image and thumbnails, but clicking a thumbnail just swaps the image. There is no way to zoom or view full-resolution images — important for assessing condition of refurbished electronics.

### 27. Announcement bar can overflow on mobile
**`index.html` / `app.jsx:408`** — Long announcement text has no truncation or scrolling behavior. On mobile, this could push the nav down or clip text.

### 28. `<a>` tags used for SPA navigation without full progressive enhancement
**`app.jsx:466-472`** — Mobile nav uses `<a>` tags with `onClick` + `e.preventDefault()`. The `href` is set correctly for SEO, but if JavaScript fails to load, users navigate to literal `/shop` which returns the SPA shell with no server-rendered content.

---

## Recommendations (Priority Order)

1. **Add skip-to-content link** — low effort, high accessibility impact
2. **Add focus traps** to search overlay and mobile nav drawer
3. **Implement ARIA roles** across the site — especially search results (`listbox`), modals (`dialog`), tabs, and cart quantity controls
4. **Add `aria-live` regions** for cart updates, error messages, and loading states
5. **Make breadcrumbs clickable** links
6. **Show order ID** on confirmation page; fix the `amountAud === 0` display bug
7. **Persist shop filters in URL** query params for shareability and back-button support
8. **Add a floating checkout bar on mobile** cart page
9. **Fix the "Notify me" button** to actually POST to the server
10. **Add a 404/not-found page** for invalid product/service deep links
11. **Add image zoom/lightbox** on product detail pages
