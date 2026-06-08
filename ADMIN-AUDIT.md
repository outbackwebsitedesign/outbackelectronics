# Admin Dashboard — In-Depth Usability Audit

**Date:** 8 June 2026
**Scope:** Full usability review of the admin dashboard (`pages-admin.jsx`, `admin-login.html`, `mobile.css`, related components)

## Executive Summary

The admin dashboard is a well-designed, cohesive system with a strong visual identity (dark sidebar, outback-earthy palette, clear typography hierarchy). It covers 24 sections across operations, catalog, community, and store management. However, there are significant gaps in mobile responsiveness, accessibility, data safety patterns, and user feedback that would meaningfully impact daily staff workflows.

---

## 1. Navigation & Information Architecture

### Strengths

- **Role-based visibility** — 5-tier RBAC (owner → pending) correctly filters sidebar items per role, including `excludeRoles` for sellers
- **Logical grouping** — 4 groups (Operations, Catalog, Community, Store) map well to mental models
- **Active state clarity** — ochre highlight + left border + bold weight on active nav item
- **Profile pill** — initials + name + role + sign-out at sidebar bottom; useful identity confirmation

### Issues

| Issue | Severity | Detail |
|-------|----------|--------|
| **24 sections, no collapsible groups** | Medium | All items always visible — sidebar requires scrolling on smaller laptops (1366×768). Groups should collapse/expand. |
| **No breadcrumbs** | Low | When inside a drawer (e.g., editing an order), users lose context of where they are in the hierarchy. |
| **No keyboard nav for sidebar** | Medium | Sidebar links are `<a>` tags with `onClick` only — no `href`, no `tabIndex`, no arrow-key traversal. Screen reader users and keyboard navigators can't efficiently move between sections. |
| **Global search is shallow** | Medium | Single text input does substring matching only — no date ranges, no status filters, no advanced search. Power users managing hundreds of orders will hit a wall. |
| **"View public site" link placement** | Low | In the top bar next to search — easy to miss. Could be in the sidebar footer for better visibility. |

---

## 2. Mobile Responsiveness

### Critical Problems

The admin dashboard has almost no admin-specific mobile CSS. The `mobile.css` file (215 lines) is almost entirely for the public storefront — shop grids, hero sections, cart layouts, footer columns. The only admin mobile rule is embedded inline in `pages-admin.jsx`:

```css
@media (max-width: 768px) {
  .admin-sidebar { transform: translateX(-100%); }
  .admin-sidebar-open { transform: translateX(0); }
  .admin-hamburger { display: flex !important; }
}
```

| Issue | Severity | Detail |
|-------|----------|--------|
| **Drawer is hardcoded 540px wide** | Critical | On any screen < 540px, the drawer overflows. No `max-width: 100vw` or responsive sizing. |
| **Overview grid-4 doesn't collapse** | High | 4 stat tiles in a row — no mobile override means tiles shrink to illegibility or overflow. |
| **Table grids don't adapt** | High | Orders table uses CSS Grid with fixed column widths (e.g., 140px, 100px). On mobile, rows overflow horizontally with no card/stack alternative. |
| **Topbar search input is 260px fixed** | Medium | Won't fit on phones alongside the page title. |
| **Kanban board requires 1200px+** | High | Repair jobs show 5 columns (min 240px each). No mobile alternative — tablets and phones see a broken layout. |
| **Quote builder has 2-column grid layout** | Medium | Hardware items grid with 5 inline columns won't work below ~800px. |

---

## 3. Accessibility (WCAG 2.1 AA)

### What's Present (4 `aria-*` attributes total)

- `aria-label="Menu"` on hamburger button
- `aria-label="Close"` on drawer close button
- `aria-hidden="true"` on overlay backdrop
- `role="button"` + `tabIndex={0}` + `onKeyDown` on table rows

### What's Missing

| Issue | WCAG Criterion | Detail |
|-------|----------------|--------|
| **Drawer lacks `role="dialog"` and `aria-modal`** | 1.3.1, 4.1.2 | Screen readers don't know a modal opened |
| **No focus trap in drawers** | 2.4.3 | Tab key escapes to background content behind the overlay |
| **No focus management** | 2.4.3 | Opening a drawer doesn't auto-focus it; closing doesn't return focus to trigger |
| **Toast notifications have no `aria-live`** | 4.1.3 | `adminToast()` creates DOM elements dynamically — screen readers never announce them |
| **Status pills rely on color alone** | 1.4.1 | Payment status (green/yellow/red) and fulfilment status (6 colors) have no icons or patterns for colorblind users |
| **Sidebar nav isn't `<nav>`** | 1.3.1 | Uses `<aside>` — acceptable but `<nav>` with `aria-label="Admin navigation"` would be more semantic |
| **Form labels are visual-only** | 1.3.1 | Labels wrap inputs correctly (implicit association), but no `aria-required` or `aria-invalid` attributes |
| **No skip-to-content link** | 2.4.1 | Users must tab through the entire 24-item sidebar to reach main content |

---

## 4. Forms & Data Entry

### Patterns Observed

- All forms use `<label className="field">` → `<span className="label">` → `<input className="input">` pattern
- Fields styled consistently: 11px padding, 1px border, rust focus outline
- Save operations are optimistic (update UI immediately, roll back on failure)

### Issues

| Issue | Severity | Detail |
|-------|----------|--------|
| **No required field indicators** | High | No asterisk, no "(required)" text, no `aria-required`. Users discover required fields only after submit fails. |
| **No client-side validation** | High | Email, phone, monetary amounts, dates — all accepted as raw text. A quote can be "sent" with an invalid email. |
| **No unsaved changes warning** | High | Closing a drawer (click overlay, press Escape, click another nav item) silently discards edits. This will cause data loss. |
| **`confirm()` for destructive actions** | Medium | 11 occurrences of `window.confirm()`. Browser-native dialogs are jarring, unstyled, and don't match the UI. Should use the existing Drawer/modal pattern. |
| **No inline error display** | Medium | Failed saves show a toast at screen bottom — users editing a long form may miss it entirely. Errors should appear near the relevant field. |
| **Refund amount not validated against balance** | High | Code checks `amt > 0` but doesn't check if it exceeds the order total. Users could refund more than charged. |
| **Negative prices allowed** | Medium | Hardware prices in quote builder accept negative numbers — no `min="0"` constraint. |

---

## 5. Data Tables & Information Display

### Strengths

- Clean grid-based table component with header styling
- Row hover states and keyboard interaction (Enter/Space)
- Empty states with icon + message + hint text
- Color-coded status pills with semantic mapping

### Issues

| Issue | Severity | Detail |
|-------|----------|--------|
| **No column sorting** | High | Tables are display-only — users can't sort orders by date, amount, or status. With hundreds of orders this is a major friction point. |
| **No pagination** | High | All rows rendered in DOM. Performance will degrade beyond ~200 records and become unusable at 1000+. |
| **No bulk actions** | Medium | Can't select multiple orders to mark as shipped, or multiple products to change category. Each must be edited individually. |
| **Text truncation inconsistent** | Low | Long customer names or item lists can push columns and break grid alignment. No `text-overflow: ellipsis` on data cells. |
| **Date display is relative-unfriendly** | Low | Dates show as "27 May 2026" — no relative time ("2 hours ago", "yesterday") for recent activity, which is more scannable. |

---

## 6. Feedback & Loading States

### Current Pattern

- `adminToast(msg, type)` — fixed bottom-center, 4-second auto-dismiss, two types: error (rust) and success (green)
- Buttons show text change: "Save" → "Saving…" with `disabled={busy}`
- Loading: plain `<div>Loading…</div>` text

### Issues

| Issue | Severity | Detail |
|-------|----------|--------|
| **No skeleton loaders** | Medium | Data sections show nothing during fetch, then suddenly populate. Skeleton placeholders reduce perceived load time. |
| **Toast is easy to miss** | Medium | Bottom-center position may be below fold. No sound, no persistence for errors. |
| **No button loading spinner** | Low | Text changes from "Save" to "Saving…" but no visual spinner. Users may not notice the text change. |
| **No progress on file upload** | Medium | `uploadImage()` uploads via FileReader but shows no progress bar. Large images will appear stuck. |
| **No retry mechanism** | Medium | Network failures show "try again" toast but don't provide a retry button. Users must manually re-trigger the action. |
| **No optimistic rollback notification** | Low | When optimistic save fails and rolls back, the toast says "change not persisted" but the visual rollback can be confusing. |

---

## 7. Visual Design & Consistency

### Strengths

- **Coherent palette** — CSS variables for all colors; earthy tones (ochre, rust, eucalyptus) are distinctive and consistent
- **Typography hierarchy** — Instrument Serif for headings, Archivo for body, JetBrains Mono for codes/labels
- **Dark sidebar + light content** — good visual separation between nav and workspace
- **Status color semantics** — green=success, yellow=in-progress, red=warning/urgent used consistently

### Issues

| Issue | Severity | Detail |
|-------|----------|--------|
| **13px body text** | Low | Small for extended reading. No user-configurable font size or zoom setting. |
| **Red overloaded** | Medium | Rust/red used for: primary buttons, error toasts, urgent badges, unpaid status, refunded status, open repairs count. Too many meanings for one color. |
| **Settings icon identical to Services icon** | Low | Both use the same sun/gear SVG pattern — easy to confuse at 15×15. |
| **No dark mode toggle** | Low | Sidebar is dark, content is light. No option for full dark mode, which staff working long shifts may prefer. |

---

## 8. Security UX

### Strengths

- CSRF protection on all mutations
- Rate-limited login with clear "retry in Xs" messaging
- Role-based section visibility
- 8-hour session TTL

### Issues

| Issue | Severity | Detail |
|-------|----------|--------|
| **No session timeout warning** | Medium | 8-hour sessions expire silently. Users editing a long form could lose work when the session expires mid-save. A "session expiring in 5 minutes" warning would help. |
| **No audit log visible to staff** | Low | No "who changed what when" trail in the UI. Important for multi-staff environments. |
| **Password field labeled "Password / PIN"** | Low | Ambiguous — users may not know which to enter. Should be one or the other, or explain the difference. |

---

## 9. Workflow-Specific Issues

### Orders

- **Fulfilment flow is linear but not guided** — 8 statuses (pending → ordering → building → testing → packed → shipped → fulfilled → refunded) but no visual stepper showing progress or suggesting next action
- **Payment recording is append-only** — can add payments but can't edit/delete a mistaken entry

### Repair Jobs (Kanban)

- **No drag-and-drop** — cards can only be moved by editing. A kanban board without drag-and-drop defeats the purpose of the visual metaphor.
- **No time tracking** — cards show "age" but no logged hours for billing

### Quotes

- **Quote builder is strong** — live preview, auto-margin calculation, hardware + labor + other items
- **2% margin is hardcoded** — can't be configured per quote or globally in settings

### Settings

- **5 sub-tabs within Settings** (General, Staff, Integrations, Security, Advanced) — this nesting adds cognitive load. Staff and Integrations could be top-level sections.

---

## 10. Priority Recommendations

### P0 — Fix Now (data loss / broken workflows)

1. **Add `max-width: 100vw` to Drawer** — prevents overflow on mobile
2. **Add unsaved changes warning** — `beforeunload` + overlay-click confirmation
3. **Validate refund amount ≤ order balance** — prevents over-refunding
4. **Add `role="dialog"`, `aria-modal`, focus trap to Drawer** — basic accessibility compliance

### P1 — Fix Soon (significant friction)

5. **Add responsive breakpoints for admin layout** — stat grids, tables, kanban, topbar
6. **Replace all `confirm()` with styled modal** — 11 occurrences
7. **Add required field indicators** — asterisk + `aria-required`
8. **Add column sorting to tables** — at minimum on date and amount
9. **Add pagination or virtual scroll** — table rows > 100 will cause performance issues
10. **Add `aria-live="polite"` region for toasts** — screen reader announcement

### P2 — Improve (quality of life)

11. Add status icons alongside colors (colorblind support)
12. Add skeleton loaders for data fetching
13. Add client-side validation (email, phone, amounts)
14. Add debounce to search input (currently fires every keystroke)
15. Add session expiry warning
16. Collapsible sidebar groups
17. Add skip-to-content link
18. Add keyboard shortcuts (e.g., `?` for help, `/` for search focus)

### P3 — Nice to Have

19. Drag-and-drop for repair kanban
20. Date range filters on orders/analytics
21. Bulk select + actions on tables
22. Dark mode toggle
23. Audit log UI
24. Configurable quote margin percentage

---

**Bottom line:** The dashboard has a polished visual design and solid feature set. The most impactful improvements are around **mobile responsiveness** (the admin drawer alone breaks on any phone), **data safety** (unsaved changes warning, refund validation), and **accessibility** (4 aria attributes across 5,700 lines is far below WCAG AA). Fixing P0 and P1 items would transform this from "works on desktop with a mouse" to "usable by any staff member on any device."
