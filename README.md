# Outback Electronics

**Built for where the signal ends.**

An independent electronics outpost serving remote Australia — rugged laptops, satellite uplinks, off-grid power systems, custom PC builds, field repairs, and edge AI. Based at 183 Peericoota Forest Rd, Moama NSW 2731. By appointment only.

---

## Architecture

A single Node.js server (`server.js`) runs five HTTP servers on separate ports from one process:

| Port | Service | Description |
|------|---------|-------------|
| 8080 | Main site | Public-facing SPA — shop, services, contact, quote request |
| 8081 | Forum | Community forum — threads, replies, user auth |
| 8082 | Admin | Staff dashboard — orders, repairs, quotes, inventory, settings |
| 8083 | Portal | Customer portal — order tracking, quote acceptance, warranty |
| 8084 | Games | Outback-themed browser games |

All five share a single data directory (flat JSON files, no database server required).

### Frontend

React 18 SPAs built with Vite. Each service has its own entry point:

| Entry | Output |
|-------|--------|
| `src/main.jsx` → `app.jsx` + `pages-*.jsx` | Main site |
| `src/forum-entry.jsx` → `forum-page.jsx` | Forum |
| `src/admin-entry.jsx` → `pages-admin.jsx` | Admin |
| `src/portal-entry.jsx` → `portal-page.jsx` | Portal |
| `src/games-entry.jsx` → `games.jsx` | Games |

Build output goes to `dist/`. The server serves pre-built assets from `dist/` in production.

---

## Data Storage

All data is stored as JSON files in the project root. No external database.

| File | Contents |
|------|----------|
| `settings.db` | Shop config, staff, integrations, site content (merged over `settings.defaults.json` on every read) |
| `forum.db` | Users, threads, replies, categories |
| `forum-sessions.db` | Active forum sessions |
| `portal-sessions.db` | Active portal sessions |
| `sessions.db` | Active admin sessions |
| `quotes.db` | Quote requests and responses |
| `orders.db` | Orders (created from accepted quotes or direct purchase) |
| `repairs.db` | Repair job Kanban board (`{columns:[{id,label,cards:[]}]}`) |
| `password-reset-tokens.db` | Active password reset tokens |

Writes use atomic file replacement (write to `.tmp`, then rename) to prevent corruption.

`settings.defaults.json` is a **live merge base**, not a one-time seed. Every `readSettings()` call deep-merges the defaults file with `settings.db`, so fields not explicitly saved in the db always fall back to the defaults. This means changing `settings.defaults.json` affects all running instances, and empty fields in it (like `shop.email`) remain empty until an admin sets them via admin → Settings.

---

## Authentication

### Unified account system
One account works across the portal, forum, main site, and games page. All registration endpoints write to `forum.db` users. Login endpoints across all services verify against the same user store.

| Endpoint | Service |
|----------|---------|
| `POST /api/portal/auth/register` | Portal (full fields: firstName, lastName, email, phone, address, username, password) |
| `POST /api/forum/auth/register` | Forum (same fields as portal) |
| `POST /api/portal/auth/login` | Portal login |
| `POST /api/forum/auth/login` | Forum login |

### Admin auth
Admin uses a separate session system. Password is set via `ADMIN_PASSWORD` env var or through admin Settings → Security. Admin roles: `owner` (4), `manager` (3), `technician` (2), `staff` (1), `seller` (1).

### CSRF protection
All POST requests require an `X-CSRF-Token` header. Token is obtained by `GET /api/csrf-token` (sets `_csrf` cookie). The frontend calls this automatically on load.

---

## Development

### Requirements
- Node.js 18+
- No external services required to run locally (email and payment are no-ops without env vars)

### Run locally

```bash
npm install
npx playwright install chromium  # only needed for audit scripts

# Run server
ADMIN_PASSWORD=yourpassword node server.js

# Run dev build (hot reload, served via Vite on :5173)
npm run dev

# Production build
npm run build
```

The server reads from `dist/` for static assets. Run `npm run build` before starting the server in production.

### Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `ADMIN_PASSWORD` | Yes | Admin login password |
| `SMTP_HOST` | No | SMTP server hostname |
| `SMTP_PORT` | No | SMTP port (default 587) |
| `SMTP_USER` | No | SMTP username |
| `SMTP_PASS` | No | SMTP password |
| `NOTIFY_EMAIL` | No | Staff notification email (falls back to SMTP_USER) |
| `STRIPE_SECRET_KEY` | No | Stripe secret key (enables checkout) |
| `STRIPE_PUBLISHABLE_KEY` | No | Stripe publishable key |
| `STRIPE_WEBHOOK_SECRET` | No | Stripe webhook signing secret |
| `AUSPOST_API_KEY` | No | Australia Post API key (enables shipping quotes) |

Without SMTP vars, all emails are silently dropped. Without Stripe, checkout and portal "Pay Now" return errors. Without AusPost, shipping quotes are disabled.

---

## Key flows

### Quote → Order → Build → Ship → Warranty

1. **Customer** submits quote request via portal Quotes tab or main site `/quote`
2. **Admin** reviews in admin → Quotes Inbox, moves to `in_review`, writes reply, sets price, saves as `quoted`
3. **Customer** sees reply and price in portal Quotes tab, clicks Accept
4. **System** creates an Order linked to the accepted quote
5. **Admin** sees order in admin → Orders, marks payment received
6. **Admin** creates repair/build job in admin → Repair Jobs (Kanban board)
7. **Admin** moves job through columns: Intake → Diagnosis → Build/Repair → Quality Check → Done
8. **Admin** marks order as shipped, adds tracking number
9. **Customer** receives shipped email with warranty registration link (`portal/?warranty=orderId`)
10. **Customer** registers warranty via portal — no login required for the warranty form

### Repair job (no order)
Admin can create repair jobs directly in admin → Repair Jobs without a linked order or quote.

---

## Admin sections

| Section | Description |
|---------|-------------|
| Overview | Live stats: open repairs, unpaid orders, pending quotes, recent activity |
| Orders | Full order management — payment, fulfilment, part tracking |
| Repair Jobs | Kanban board — drag cards between stage columns |
| Quotes Inbox | Incoming quote requests — review, reply, set price, send |
| eWaste Intake | Log incoming e-waste, assign tier, record payout |
| Products | Shop product listings |
| Services | Service listings shown on public services page |
| Software | Software listings |
| Tutorials | Tutorial articles |
| AI Models & Boxes | Edge AI product catalogue |
| Forum | Forum moderation — categories, pinned posts |
| Groups | Community group management |
| Customers | Customer records, linked orders/jobs, merge duplicates |
| Sellers | Second-hand seller management |
| Memberships | Membership tiers and active subscriptions |
| Gift Cards | Issue and manage gift card codes |
| Expenses | Track job costs, parts, receipts |
| Policies | Edit public-facing policy documents |
| Settings | Shop info, staff, integrations, SMTP, Stripe, security |

---

## Portal tabs

| Tab | Description |
|-----|-------------|
| Overview | Summary: active orders, open quotes, recent repairs |
| Orders | Order history with detail view and pay-now for pending invoices |
| Repairs | Repair job status — updated as job moves through Kanban |
| Quotes | Submit quote requests, view responses, accept quotes |
| Memberships | Active subscription management |
| Rewards | Loyalty points (not yet active — see todo.md) |
| Wallet | Store credit and gift card balances (not yet active — see todo.md) |
| Addresses | Saved delivery addresses |
| Bookings | Appointment history |
| Account | Display name, password change |

---

## Unfinished features

See `todo.md` for a full list. Key gaps:

- **Gift cards** — page exists, purchase flow not yet implemented
- **Memberships** — tiers shown, Stripe subscription flow not yet wired
- **Rewards** — UI exists, no points engine
- **Wallet** — UI exists, no credit/balance tracking
- **SMTP / Stripe / AusPost** — must be configured via env vars before emails, payments or shipping quotes work
- **shop.email** — must be set in admin Settings before contact forms notify staff

---

## Branch strategy

Active development branch: `claude/inspiring-bell-ddFxr`  
Production: `main`

PRs are created from feature branches into `main`. The `dist/` folder is committed — no separate build step in deployment.
