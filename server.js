const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const sharp = require('sharp');

const MAIN_PORT  = process.env.MAIN_PORT  || 8080;
const FORUM_PORT = process.env.FORUM_PORT || 8081;
const ADMIN_PORT = process.env.ADMIN_PORT || 8082;
const PORTAL_PORT = process.env.PORTAL_PORT || 8083;
const GAMES_PORT  = process.env.GAMES_PORT  || 8084;

const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD_RAW = process.env.ADMIN_PASSWORD || '';
const SESSION_TTL_MS = 1000 * 60 * 60 * 8;
const RATE_WINDOW_MS = 1000 * 60 * 10;
const RATE_MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 1000 * 60 * 15;
const ADMIN_IP_ALLOWLIST = (process.env.ADMIN_IP_ALLOWLIST || '').split(',').map(v => v.trim()).filter(Boolean);

const PUBLIC_CSP = "default-src 'self'; " +
  "script-src 'self' 'unsafe-inline' " +
    "https://*.tawk.to https://embed.tawk.to " +
    "https://static.cloudflareinsights.com " +
    "https://cdn.jsdelivr.net " +
    "https://pagead2.googlesyndication.com https://*.googlesyndication.com " +
    "https://securepubads.g.doubleclick.net https://*.doubleclick.net " +
    "https://partner.googleadservices.com https://*.googleadservices.com " +
    "https://*.googletagservices.com " +
    "https://adservice.google.com https://adservice.google.com.au " +
    "https://*.adtrafficquality.google; " +
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://*.tawk.to https://cdn.jsdelivr.net; " +
  "img-src 'self' data: https:; " +
  "font-src 'self' data: https://fonts.gstatic.com https://*.tawk.to; " +
  "connect-src 'self' " +
    "https://portal.outbackelectronics.com.au https://forum.outbackelectronics.com.au " +
    "https://nominatim.openstreetmap.org " +
    "wss://*.tawk.to https://*.tawk.to https://va.tawk.to " +
    "https://cloudflareinsights.com " +
    "https://*.googlesyndication.com https://*.doubleclick.net https://securepubads.g.doubleclick.net " +
    "https://adservice.google.com https://adservice.google.com.au " +
    "https://*.adtrafficquality.google; " +
  "frame-src https://www.openstreetmap.org https://*.tawk.to " +
    "https://pagead2.googlesyndication.com https://*.googlesyndication.com " +
    "https://googleads.g.doubleclick.net https://tpc.googlesyndication.com " +
    "https://www.google.com https://ep2.adtrafficquality.google; " +
  "frame-ancestors 'none';";
const PUBLIC_RATE_WINDOW_MS = 1000 * 60 * 10;
const PUBLIC_RATE_LIMITS = { checkout: 20, 'quote/request': 5, 'contact/quick-message': 5, 'register': 5, 'shipping/quote': 30, 'warranty/register': 10, 'forgot-password': 5, 'reset-password': 10, 'gift-card/apply': 10 };

fs.mkdirSync(path.join(__dirname, 'assets/uploads'), { recursive: true });
fs.mkdirSync(path.join(__dirname, 'assets/uploads/software'), { recursive: true });
fs.mkdirSync(path.join(__dirname, 'assets/uploads/software/.chunks'), { recursive: true });

const STRIPE_SECRET_KEY       = process.env.STRIPE_SECRET_KEY       || '';
const STRIPE_WEBHOOK_SECRET   = process.env.STRIPE_WEBHOOK_SECRET   || '';
const STRIPE_PUBLISHABLE_KEY  = process.env.STRIPE_PUBLISHABLE_KEY  || '';
const AUSPOST_API_KEY         = process.env.AUSPOST_API_KEY         || '';
const SITE_URL              = process.env.SITE_URL              || 'http://localhost:8080';
const ADMIN_URL             = process.env.ADMIN_URL             || (/^https?:\/\/(localhost|127\.|0\.0\.0\.0)(:\d+)?/.test(SITE_URL) ? SITE_URL.replace(/(:\d+)?(\/|$)/, ':8082$2') : SITE_URL.replace(/^(https?:\/\/)/, '$1admin.'));

const SMTP_HOST    = process.env.SMTP_HOST    || '';
const SMTP_PORT    = parseInt(process.env.SMTP_PORT || '587', 10);
const SMTP_USER    = process.env.SMTP_USER    || '';
const SMTP_PASS    = process.env.SMTP_PASS    || '';
const NOTIFY_EMAIL = process.env.NOTIFY_EMAIL || SMTP_USER;
const FROM_ADDRESS = `Outback Electronics <${SMTP_USER || 'noreply@outbackelectronics.com.au'}>`;

const ROLE_LEVELS = { owner: 4, manager: 3, technician: 2, staff: 1, seller: 1, pending: 0 };

const FORUM_SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30;
const PORTAL_SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30;
const loginAttempts = new Map();
const publicRateCounts = new Map();
const PRODUCTS_DB_PATH  = path.join(__dirname, 'products.db');
const SERVICES_DB_PATH  = path.join(__dirname, 'services.db');
const ORDERS_DB_PATH    = path.join(__dirname, 'orders.db');
const CUSTOMERS_DB_PATH = path.join(__dirname, 'customers.db');
const REPAIRS_DB_PATH   = path.join(__dirname, 'repairs.db');
const QUOTES_DB_PATH    = path.join(__dirname, 'quotes.db');
const EWASTE_DB_PATH    = path.join(__dirname, 'ewaste.db');
const SELLERS_DB_PATH   = path.join(__dirname, 'sellers.db');
const GROUPS_DB_PATH    = path.join(__dirname, 'groups.db');
const FORUM_DB_PATH     = path.join(__dirname, 'forum.db');
const SOFTWARE_DB_PATH  = path.join(__dirname, 'software.db');
const GIFTCARDS_DB_PATH = path.join(__dirname, 'gift-cards.db');
const DENOMINATIONS_DB_PATH = path.join(__dirname, 'gift-card-denominations.db');
const REWARDS_DB_PATH = path.join(__dirname, 'rewards.db');
const STORE_CREDIT_DB_PATH = path.join(__dirname, 'store-credits.db');
const BOOKINGS_DB_PATH = path.join(__dirname, 'bookings.db');
const TUTORIALS_DB_PATH = path.join(__dirname, 'tutorials.db');
const AI_DB_PATH        = path.join(__dirname, 'ai.db');
const POLICIES_DB_PATH  = path.join(__dirname, 'policies.db');
const SETTINGS_DB_PATH  = path.join(__dirname, 'settings.db');
const MEMBERSHIPS_DB_PATH = path.join(__dirname, 'memberships.db');
const STAFF_DB_PATH       = path.join(__dirname, 'staff.db');
const SELLER_LEDGER_DB_PATH = path.join(__dirname, 'seller-ledger.db');
const ADMIN_AUDIT_LOG_PATH   = path.join(__dirname, 'admin-audit.log');
const SESSIONS_DB_PATH        = path.join(__dirname, 'sessions.db');
const FORUM_SESSIONS_DB_PATH  = path.join(__dirname, 'forum-sessions.db');
const PORTAL_SESSIONS_DB_PATH = path.join(__dirname, 'portal-sessions.db');
const RESET_TOKENS_DB_PATH = path.join(__dirname, 'password-reset-tokens.db');
const CARTS_DB_PATH = path.join(__dirname, 'carts.db');
const RESET_TOKEN_TTL_MS = 1000 * 60 * 60; // 1 hour
function _defaultSubUrl(base, port, sub) {
  if (/^https?:\/\/(localhost|127\.|0\.0\.0\.0)(:\d+)?/.test(base))
    return base.replace(/(:\d+)?(\/|$)/, `:${port}$2`);
  return base.replace(/^(https?:\/\/)/, `$1${sub}.`);
}
const FORUM_URL  = process.env.FORUM_URL  || _defaultSubUrl(SITE_URL, 8081, 'forum');
const PORTAL_URL = process.env.PORTAL_URL || _defaultSubUrl(SITE_URL, 8083, 'portal');
const GAMES_URL  = process.env.GAMES_URL  || _defaultSubUrl(SITE_URL, 8084, 'games');

function loadSessionsFromDisk(filePath) {
  try {
    const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const map = new Map();
    const t = now();
    for (const [k, v] of Object.entries(raw)) {
      if (v.expiresAt > t) map.set(k, v);
    }
    return map;
  } catch { return new Map(); }
}

function saveSessionsToDisk(filePath, map) {
  const obj = {};
  for (const [k, v] of map) obj[k] = v;
  fs.writeFileSync(filePath, JSON.stringify(obj));
}

const sessions = loadSessionsFromDisk(SESSIONS_DB_PATH);
const forumSessions = loadSessionsFromDisk(FORUM_SESSIONS_DB_PATH);
const portalSessions = loadSessionsFromDisk(PORTAL_SESSIONS_DB_PATH);

const resetTokens = (() => {
  try {
    const raw = JSON.parse(fs.readFileSync(RESET_TOKENS_DB_PATH, 'utf8'));
    const map = new Map();
    const t = now();
    for (const [k, v] of Object.entries(raw)) {
      if (v.expiresAt > t) map.set(k, v);
    }
    return map;
  } catch { return new Map(); }
})();

function saveResetTokens() {
  const obj = {};
  for (const [k, v] of resetTokens) obj[k] = v;
  fs.writeFileSync(RESET_TOKENS_DB_PATH, JSON.stringify(obj));
}

// Prune expired sessions and flush to disk every 10 minutes.
setInterval(() => {
  const t = now();
  for (const [k, v] of sessions) if (v.expiresAt <= t) sessions.delete(k);
  for (const [k, v] of forumSessions) if (v.expiresAt <= t) forumSessions.delete(k);
  for (const [k, v] of portalSessions) if (v.expiresAt <= t) portalSessions.delete(k);
  for (const [k, v] of resetTokens) if (v.expiresAt <= t) resetTokens.delete(k);
  saveSessionsToDisk(SESSIONS_DB_PATH, sessions);
  saveSessionsToDisk(FORUM_SESSIONS_DB_PATH, forumSessions);
  saveSessionsToDisk(PORTAL_SESSIONS_DB_PATH, portalSessions);
  saveResetTokens();
}, 10 * 60 * 1000).unref();

// ── DB helpers ────────────────────────────────────────────────────────────────

// Atomic write: write to a temp file then rename so a crash mid-write never
// leaves a partially-written (corrupt) JSON file.
function atomicWriteFile(filePath, data) {
  const tmp = filePath + '.tmp';
  fs.writeFileSync(tmp, data);
  fs.renameSync(tmp, filePath);
}

function readCarts() {
  try { const p = JSON.parse(fs.readFileSync(CARTS_DB_PATH, 'utf8')); return Array.isArray(p.carts) ? p.carts : []; } catch { return []; }
}
function writeCarts(carts) { atomicWriteFile(CARTS_DB_PATH, JSON.stringify({ carts }, null, 2)); }

function readProducts() {
  try { const p = JSON.parse(fs.readFileSync(PRODUCTS_DB_PATH, 'utf8')); return Array.isArray(p.products) ? p.products : []; } catch { return []; }
}
function writeProducts(products) { atomicWriteFile(PRODUCTS_DB_PATH, JSON.stringify({ products }, null, 2)); }

function readServices() {
  try { const p = JSON.parse(fs.readFileSync(SERVICES_DB_PATH, 'utf8')); return Array.isArray(p.services) ? p.services : []; } catch { return []; }
}
function writeServices(services) { atomicWriteFile(SERVICES_DB_PATH, JSON.stringify({ services }, null, 2)); }

function readCatalog() { return { products: readProducts(), services: readServices() }; }

function normalisePhone(p) { return (p||'').replace(/[\s\-().+]/g, '').toLowerCase(); }

function readOrders() {
  try { const p = JSON.parse(fs.readFileSync(ORDERS_DB_PATH, 'utf8')); return Array.isArray(p.orders) ? p.orders : []; } catch { return []; }
}
function writeOrders(orders) { atomicWriteFile(ORDERS_DB_PATH, JSON.stringify({ orders }, null, 2)); }

function readCustomers() {
  try {
    const p = JSON.parse(fs.readFileSync(CUSTOMERS_DB_PATH, 'utf8'));
    const customers = Array.isArray(p.customers) ? p.customers : [];
    let dirty = false;
    for (const c of customers) { if (!c.id) { c.id = 'cust-' + Date.now() + '-' + Math.random().toString(36).slice(2); dirty = true; } }
    if (dirty) writeCustomers(customers);
    return customers;
  } catch { return []; }
}
function writeCustomers(customers) { atomicWriteFile(CUSTOMERS_DB_PATH, JSON.stringify({ customers }, null, 2)); }

const DEFAULT_REPAIR_COLUMNS = [
  { id: 'intake',    label: 'Intake',        cards: [] },
  { id: 'diagnosis', label: 'Diagnosis',     cards: [] },
  { id: 'repair',    label: 'Build / Repair',cards: [] },
  { id: 'qa',        label: 'Quality Check', cards: [] },
  { id: 'done',      label: 'Done',          cards: [] },
];
function readRepairs() {
  try {
    const p = JSON.parse(fs.readFileSync(REPAIRS_DB_PATH, 'utf8'));
    if (p && Array.isArray(p.columns) && p.columns.length) return p;
  } catch { /* fall through */ }
  return { columns: DEFAULT_REPAIR_COLUMNS.map(c => ({ ...c, cards: [] })) };
}
function writeRepairs(repairs) { atomicWriteFile(REPAIRS_DB_PATH, JSON.stringify(repairs, null, 2)); }
function flatRepairs() {
  const board = readRepairs();
  return (board.columns || []).flatMap(col => (col.cards || []).map(c => ({ ...c, _colId: col.id, _colLabel: col.label || col.id })));
}

function readQuotes() {
  try { const p = JSON.parse(fs.readFileSync(QUOTES_DB_PATH, 'utf8')); return Array.isArray(p.quotes) ? p.quotes : []; } catch { return []; }
}
function writeQuotes(quotes) { atomicWriteFile(QUOTES_DB_PATH, JSON.stringify({ quotes }, null, 2)); }

function readEwaste() {
  try { const p = JSON.parse(fs.readFileSync(EWASTE_DB_PATH, 'utf8')); return Array.isArray(p.intakes) ? p.intakes : []; } catch { return []; }
}
function writeEwaste(intakes) { atomicWriteFile(EWASTE_DB_PATH, JSON.stringify({ intakes }, null, 2)); }

function readSellers() {
  try { const p = JSON.parse(fs.readFileSync(SELLERS_DB_PATH, 'utf8')); return Array.isArray(p.consignments) ? p.consignments : []; } catch { return []; }
}
function writeSellers(consignments) { atomicWriteFile(SELLERS_DB_PATH, JSON.stringify({ consignments }, null, 2)); }

function readSellerLedger() {
  try { const d = JSON.parse(fs.readFileSync(SELLER_LEDGER_DB_PATH, 'utf8')); return d.transactions || []; } catch { return []; }
}
function writeSellerLedger(txns) { atomicWriteFile(SELLER_LEDGER_DB_PATH, JSON.stringify({ transactions: txns }, null, 2)); }

function calculateListingFee(count) {
  if (count <= 0) return 0;
  if (count <= 10) return Math.round(count * 0.75 * 100) / 100;
  if (count <= 50) return Math.round(count * 0.50 * 100) / 100;
  if (count <= 100) return Math.round(count * 0.30 * 100) / 100;
  return null; // custom — skip automatic charge
}

function getSellerBalance(sellerId) {
  const txns = readSellerLedger().filter(t => t.sellerId === sellerId && t.status === 'ok');
  const credits = txns.filter(t => t.type === 'sale_credit').reduce((s, t) => s + t.amount, 0);
  const debits = txns.filter(t => t.type === 'listing_fee' || t.type === 'payout').reduce((s, t) => s + t.amount, 0);
  return Math.round((credits - debits) * 100) / 100;
}

function readGroups() {
  try { const p = JSON.parse(fs.readFileSync(GROUPS_DB_PATH, 'utf8')); return Array.isArray(p.groups) ? p.groups : []; } catch { return []; }
}
function writeGroups(groups) { atomicWriteFile(GROUPS_DB_PATH, JSON.stringify({ groups }, null, 2)); }

function readForum() {
  try { return JSON.parse(fs.readFileSync(FORUM_DB_PATH, 'utf8')); }
  catch { return { queue: [], threads: [], users: [], categories: [], conduct: '' }; }
}
function writeForum(data) { atomicWriteFile(FORUM_DB_PATH, JSON.stringify(data, null, 2)); }

function readSoftware() { try { return JSON.parse(fs.readFileSync(SOFTWARE_DB_PATH, 'utf8')).items || []; } catch { return []; } }
function writeSoftware(items) { atomicWriteFile(SOFTWARE_DB_PATH, JSON.stringify({ items }, null, 2)); }
function readTutorials() { try { return JSON.parse(fs.readFileSync(TUTORIALS_DB_PATH, 'utf8')).items || []; } catch { return []; } }
function writeTutorials(items) { atomicWriteFile(TUTORIALS_DB_PATH, JSON.stringify({ items }, null, 2)); }
function readAI() { try { const d = JSON.parse(fs.readFileSync(AI_DB_PATH, 'utf8')); return { models: d.models || [], boxes: d.boxes || [] }; } catch { return { models: [], boxes: [] }; } }
function writeAI(data) { atomicWriteFile(AI_DB_PATH, JSON.stringify(data, null, 2)); }
function readPolicies() { try { return JSON.parse(fs.readFileSync(POLICIES_DB_PATH, 'utf8')).items || []; } catch { return []; } }
function writePolicies(items) { atomicWriteFile(POLICIES_DB_PATH, JSON.stringify({ items }, null, 2)); }

function readMemberships() {
  try { const d = JSON.parse(fs.readFileSync(MEMBERSHIPS_DB_PATH, 'utf8')); return { tiers: d.tiers || [], subscriptions: d.subscriptions || [] }; }
  catch { return { tiers: [], subscriptions: [] }; }
}
function writeMemberships(data) { atomicWriteFile(MEMBERSHIPS_DB_PATH, JSON.stringify(data, null, 2)); }

function readSettings() {
  try {
    const d = JSON.parse(fs.readFileSync(SETTINGS_DB_PATH, 'utf8'));
    return {
      shop: d.shop || {},
      announcement: d.announcement || {},
      maintenance: d.maintenance || {},
      staff: Array.isArray(d.staff) ? d.staff : [],
      integrations: Array.isArray(d.integrations) ? d.integrations : [],
      siteContent: d.siteContent || {},
      security: d.security || {},
    };
  } catch { return { shop: {}, announcement: {}, maintenance: {}, staff: [], integrations: [], siteContent: {}, security: {} }; }
}
function writeSettings(data) { atomicWriteFile(SETTINGS_DB_PATH, JSON.stringify(data, null, 2)); }

// SSE clients listening for maintenance state changes
const maintenanceSseClients = new Set();
function pushMaintenanceEvent(enabled) {
  const msg = `data: ${JSON.stringify({ enabled })}\n\n`;
  for (const res of maintenanceSseClients) {
    try { res.write(msg); } catch { maintenanceSseClients.delete(res); }
  }
}

function maskIntegrationConfig(name, config) {
  if (!config) return {};
  // Return config as-is; admin dashboard shows full values
  const result = {};
  for (const [k, v] of Object.entries(config)) {
    if (k === 'adminPasswordHash') continue; // never send password hash
    result[k] = v;
  }
  return result;
}

function readExpenses() { try { return JSON.parse(fs.readFileSync(path.join(__dirname, 'expenses.db'), 'utf8')).expenses || []; } catch { return []; } }
function writeExpenses(e) { atomicWriteFile(path.join(__dirname, 'expenses.db'), JSON.stringify({ expenses: e }, null, 2)); }

function readGiftCards() {
  try { const d = JSON.parse(fs.readFileSync(GIFTCARDS_DB_PATH, 'utf8')); return Array.isArray(d.giftCards) ? d.giftCards : []; }
  catch { return []; }
}
function writeGiftCards(giftCards) { atomicWriteFile(GIFTCARDS_DB_PATH, JSON.stringify({ giftCards }, null, 2)); }

function readDenominations() {
  try { const d = JSON.parse(fs.readFileSync(DENOMINATIONS_DB_PATH, 'utf8')); return Array.isArray(d) ? d : []; } catch { return []; }
}
function writeDenominations(denominations) { atomicWriteFile(DENOMINATIONS_DB_PATH, JSON.stringify(denominations, null, 2)); }

function readRewards() {
  try { const d = JSON.parse(fs.readFileSync(REWARDS_DB_PATH, 'utf8')); return { entries: Array.isArray(d.entries) ? d.entries : [] }; } catch { return { entries: [] }; }
}
function writeRewards(data) { atomicWriteFile(REWARDS_DB_PATH, JSON.stringify(data, null, 2)); }

// In-memory map of short-lived redemption tokens issued at cart time (30-min TTL)
const rewardsTokens = new Map(); // token -> { email, userId, points, storeCredit, expiresAt }

function grantRewardPoints(email, points, type, description, refId) {
  if (!email || !Number.isFinite(points) || points <= 0) return;
  const forum = readForum();
  const user = Array.isArray(forum.users) ? forum.users.find(u => String(u.email || '').toLowerCase() === String(email).toLowerCase()) : null;
  if (!user) return;
  const db = readRewards();
  let entry = db.entries.find(e => e.userId === user.id);
  if (!entry) { entry = { userId: user.id, email: String(user.email || '').toLowerCase(), points: 0, history: [] }; db.entries.push(entry); }
  if (refId && entry.history.some(h => h.refId === refId)) return; // deduplicate
  entry.points += points;
  entry.history.push({ id: 'rh-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6), type, points, description: description || '', refId: refId || null, date: new Date().toISOString() });
  writeRewards(db);
}

function deductRewardPoints(userId, points, description, refId) {
  if (!userId || !Number.isFinite(points) || points <= 0) return false;
  const db = readRewards();
  const entry = db.entries.find(e => e.userId === userId);
  if (!entry || entry.points < points) return false;
  if (refId && entry.history.some(h => h.refId === refId)) return false; // deduplicate
  entry.points = Math.max(0, entry.points - points);
  entry.history.push({ id: 'rh-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6), type: 'redeem', points: -points, description: description || '', refId: refId || null, date: new Date().toISOString() });
  writeRewards(db);
  return true;
}

// ── Store credit (dollar balances) — mirrors the rewards system but in AUD ──
function readStoreCredits() {
  try { const d = JSON.parse(fs.readFileSync(STORE_CREDIT_DB_PATH, 'utf8')); return { entries: Array.isArray(d.entries) ? d.entries : [] }; } catch { return { entries: [] }; }
}
function writeStoreCredits(data) { atomicWriteFile(STORE_CREDIT_DB_PATH, JSON.stringify(data, null, 2)); }

// Round to whole cents to avoid floating-point drift on balances.
function roundCents(n) { return Math.round((Number(n) || 0) * 100) / 100; }

function grantStoreCredit(email, amount, type, description, refId) {
  const amt = roundCents(amount);
  if (!email || !Number.isFinite(amt) || amt <= 0) return false;
  const forum = readForum();
  const user = Array.isArray(forum.users) ? forum.users.find(u => String(u.email || '').toLowerCase() === String(email).toLowerCase()) : null;
  if (!user) return false;
  const db = readStoreCredits();
  let entry = db.entries.find(e => e.userId === user.id);
  if (!entry) { entry = { userId: user.id, email: String(user.email || '').toLowerCase(), balance: 0, history: [] }; db.entries.push(entry); }
  if (refId && entry.history.some(h => h.refId === refId)) return false; // deduplicate
  entry.balance = roundCents(entry.balance + amt);
  entry.history.push({ id: 'sc-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6), type: type || 'grant', amount: amt, description: description || '', refId: refId || null, date: new Date().toISOString() });
  writeStoreCredits(db);
  return true;
}

function deductStoreCredit(userId, amount, description, refId) {
  const amt = roundCents(amount);
  if (!userId || !Number.isFinite(amt) || amt <= 0) return false;
  const db = readStoreCredits();
  const entry = db.entries.find(e => e.userId === userId);
  if (!entry || entry.balance < amt) return false;
  if (refId && entry.history.some(h => h.refId === refId)) return false; // deduplicate
  entry.balance = roundCents(Math.max(0, entry.balance - amt));
  entry.history.push({ id: 'sc-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6), type: 'redeem', amount: -amt, description: description || '', refId: refId || null, date: new Date().toISOString() });
  writeStoreCredits(db);
  return true;
}

function readBookings() {
  try { const d = JSON.parse(fs.readFileSync(BOOKINGS_DB_PATH, 'utf8')); return { bookings: Array.isArray(d.bookings) ? d.bookings : [] }; } catch { return { bookings: [] }; }
}
function writeBookings(data) { atomicWriteFile(BOOKINGS_DB_PATH, JSON.stringify(data, null, 2)); }

function generateGiftCardCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const seg = () => Array.from({ length: 4 }, () => chars[crypto.randomInt(chars.length)]).join('');
  return `OBE-${seg()}-${seg()}-${seg()}`;
}

function issueGiftCards(lineItems, orderId, customerEmail, customerName) {
  const gcItems = lineItems.filter(li => String(li.productId || '').startsWith('gc-'));
  if (gcItems.length === 0) return [];
  const giftCards = readGiftCards();
  const issued = [];
  for (const li of gcItems) {
    const qty = li.quantity || 1;
    const amount = Number(li.priceAud);
    for (let i = 0; i < qty; i++) {
      const card = {
        code: generateGiftCardCode(),
        balance: amount,
        originalBalance: amount,
        orderId,
        recipientEmail: customerEmail || '',
        issuedAt: new Date().toISOString(),
        redemptions: [],
        isVoid: false,
      };
      giftCards.push(card);
      issued.push(card);
    }
  }
  writeGiftCards(giftCards);
  if (customerEmail && issued.length > 0) {
    for (const card of issued) {
      const tmpl = emailGiftCard({ code: card.code, balance: card.originalBalance, customerName });
      sendEmail({ to: customerEmail, ...tmpl });
    }
  }
  return issued;
}

function readStaff() {
  try {
    const d = JSON.parse(fs.readFileSync(STAFF_DB_PATH, 'utf8'));
    return { members: d.members || [], activeJobs: d.activeJobs || [], completedJobs: d.completedJobs || [] };
  } catch { return { members: [], activeJobs: [], completedJobs: [] }; }
}
function writeStaff(data) { atomicWriteFile(STAFF_DB_PATH, JSON.stringify(data, null, 2)); }

function buildStaffStats(staffId, data) {
  const { activeJobs, completedJobs } = data;
  const active = activeJobs.filter(j => j.staffId === staffId);
  const completed = completedJobs.filter(j => j.staffId === staffId);
  const totalValue = completed.reduce((sum, j) => sum + (Number(j.value) || 0), 0);
  const ratings = completed.map(j => Number(j.rating)).filter(r => r > 0);
  const avgRating = ratings.length ? Math.round((ratings.reduce((s, r) => s + r, 0) / ratings.length) * 10) / 10 : null;
  return { staffId, activeJobs: active.length, completedJobs: completed.length, totalValue, avgRating };
}

// ── Misc helpers ──────────────────────────────────────────────────────────────

function countBy(items, predicate) {
  return items.reduce((sum, item) => sum + (predicate(item) ? 1 : 0), 0);
}
function formatCompactCurrency(value) {
  return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', notation: 'compact', maximumFractionDigits: 1 }).format(value || 0);
}

function buildAdminMetrics() {
  const orders = readOrders();
  const repairs = readRepairs();
  const quotes = readQuotes();
  const ewaste = readEwaste();
  const products = readProducts();
  const services = readServices();
  const software = readSoftware();
  const tutorials = readTutorials();
  const ai = readAI();
  const groups = readGroups();
  const customers = readCustomers();
  const sellers = readSellers();
  const repairColumns = Array.isArray(repairs.columns) ? repairs.columns : [];
  const openRepairs = repairColumns.reduce((sum, col) => sum + ((col.cards || []).length), 0);
  const awaitingQuotes = countBy(quotes, q => String(q.status || '').toLowerCase() === 'new');
  const ewasteTonnes = ewaste.reduce((sum, item) => sum + (Number(item.weightKg) || 0), 0) / 1000;
  const liveProducts = countBy(products, p => p.status === 'published');
  const draftTutorials = countBy(tutorials, t => t.status !== 'published');
  const repeatCustomers = countBy(customers, c => !!c.repeat);
  const repeatRate = customers.length ? Math.round((repeatCustomers / customers.length) * 100) : 0;
  const outstandingSellerValue = sellers.reduce((sum, s) => sum + (Number(s.payoutDue) || 0), 0);
  return {
    subtitles: {
      orders: `${orders.length} total orders`,
      repairs: `kanban · ${openRepairs} open jobs`,
      quotes: `${awaitingQuotes} awaiting reply · SLA 24h`,
      ewaste: `${ewasteTonnes.toFixed(1)}t diverted YTD`,
      products: `${liveProducts} SKUs live`,
      services: `${services.length} active services`,
      software: `${software.length} products listed`,
      tutorials: `${tutorials.length} tutorials · ${draftTutorials} in draft`,
      ai: `${ai.models.length} models · ${ai.boxes.length} inference boxes`,
      groups: `${groups.length} member groups`,
      customers: `${customers.length} active · ${repeatRate}% repeat`,
      sellers: `${sellers.length} consignments · ${formatCompactCurrency(outstandingSellerValue)} outstanding`,
    },
  };
}

function normalizePolicySlug(value) {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}
function validatePolicyPayload(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return 'Policy payload must be a JSON object.';
  if (typeof value.title !== 'string' || !value.title.trim()) return 'Field "title" is required.';
  if (typeof value.slug !== 'string' || !value.slug.trim()) return 'Field "slug" is required.';
  if (!normalizePolicySlug(value.slug)) return 'Field "slug" must include letters or numbers.';
  if (typeof value.body !== 'string' || !value.body.trim()) return 'Field "body" is required.';
  if (value.publishedAt != null && Number.isNaN(Date.parse(String(value.publishedAt)))) return 'Field "publishedAt" must be a valid date string.';
  if (value.publishedBy != null && (typeof value.publishedBy !== 'string' || !value.publishedBy.trim())) return 'Field "publishedBy" must be a non-empty string when provided.';
  return null;
}

// ── Auth / session helpers ────────────────────────────────────────────────────

function now() { return Date.now(); }
function randomId() { return crypto.randomBytes(32).toString('hex'); }

function parseCookies(req) {
  const raw = req.headers.cookie || '';
  return Object.fromEntries(raw.split(';').map(v => v.trim()).filter(Boolean).map(kv => {
    const i = kv.indexOf('=');
    return [decodeURIComponent(kv.slice(0, i)), decodeURIComponent(kv.slice(i + 1))];
  }));
}

function json(res, code, body) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

function isoNow() { return new Date().toISOString(); }

function operationMeta({ session, action, changed = {}, status = 'ok', reason = null, details = null }) {
  return { action, status, timestamp: isoNow(), actor: session?.username || 'unknown', changed, reason, details };
}

function auditAdminAction({ req, session, action, result }) {
  const record = {
    timestamp: isoNow(),
    actor: session?.username || 'unknown',
    ip: getIp(req),
    action,
    status: result?.status || 'unknown',
    changed: result?.changed || {},
    reason: result?.reason || null,
  };
  try { fs.appendFileSync(ADMIN_AUDIT_LOG_PATH, JSON.stringify(record) + '\n'); } catch {}
}

function readJson(req, maxBytes = 1e6) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', c => { data += c; if (data.length > maxBytes) req.destroy(); });
    req.on('end', () => { try { resolve(data ? JSON.parse(data) : {}); } catch { reject(new Error('invalid_json')); } });
    req.on('error', reject);
  });
}

async function parseJsonBody(res, req) {
  try { return { ok: true, body: await readJson(req) }; }
  catch { json(res, 400, { error: 'invalid_json', message: 'Request body must be valid JSON.' }); return { ok: false }; }
}

function failValidation(res, message) {
  json(res, 422, { error: 'invalid_payload', message });
  return null;
}

async function parseForumPayload(res, req, validate) {
  const parsed = await parseJsonBody(res, req);
  if (!parsed.ok) return null;
  const validationError = validate(parsed.body);
  if (validationError) return failValidation(res, validationError);
  return parsed.body;
}

function isPrivateIp(ip) {
  if (!ip) return false;
  return ip === '127.0.0.1' || ip === '::1' ||
    /^10\./.test(ip) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(ip) ||
    /^192\.168\./.test(ip) ||
    /^::ffff:(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.)/.test(ip);
}

// Cloudflare's published IPv4 and IPv6 egress ranges (https://www.cloudflare.com/ips/).
// Only trust CF-Connecting-IP / X-Forwarded-For when the TCP connection arrives from one of
// these ranges or a local private proxy — otherwise an attacker hitting the origin directly
// could spoof those headers to bypass rate limits, lockouts, and the admin IP allowlist.
const CLOUDFLARE_CIDRS_V4 = [
  [0x67390000, 16], // 103.57.0.0/16  — placeholder; real list below
].filter(() => false); // replaced by the cidr helper below

// We store CIDRs as [base, mask] pairs for fast matching without a dependency.
function parseCidr(cidr) {
  const [addr, bits] = cidr.split('/');
  const parts = addr.split('.').map(Number);
  const base = ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
  const mask = bits === '32' ? 0xffffffff : (~(0xffffffff >>> Number(bits))) >>> 0;
  return [base, mask];
}
const CF_V4_CIDRS = [
  '103.21.244.0/22', '103.22.200.0/22', '103.31.4.0/22',
  '104.16.0.0/13',   '104.24.0.0/14',
  '108.162.192.0/18',
  '131.0.72.0/22',
  '141.101.64.0/18',
  '162.158.0.0/15',
  '172.64.0.0/13',
  '173.245.48.0/20',
  '188.114.96.0/20',
  '190.93.240.0/20',
  '197.234.240.0/22',
  '198.41.128.0/17',
].map(parseCidr);

function isCloudflareIp(ip) {
  if (!ip) return false;
  // Strip IPv4-mapped IPv6 prefix
  const raw = ip.startsWith('::ffff:') ? ip.slice(7) : ip;
  if (!raw.includes('.')) return false; // IPv6 Cloudflare ranges not included; extend if needed
  const parts = raw.split('.').map(Number);
  if (parts.length !== 4 || parts.some(isNaN)) return false;
  const n = ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
  return CF_V4_CIDRS.some(([base, mask]) => (n & mask) === base);
}

function isTrustedProxy(ip) {
  return isPrivateIp(ip) || isCloudflareIp(ip);
}

function getIp(req) {
  const remoteIp = req.socket.remoteAddress || 'unknown';
  // Only trust proxy-injected headers when the direct connection is from a known proxy
  // (local private address or a published Cloudflare egress IP). If the origin is reachable
  // directly from arbitrary IPs, those headers must not be trusted.
  if (isTrustedProxy(remoteIp)) {
    const cf = (req.headers['cf-connecting-ip'] || '').trim();
    if (cf) return cf;
    const forwarded = (req.headers['x-forwarded-for'] || '').split(',')[0].trim();
    if (forwarded) return forwarded;
  }
  return remoteIp;
}

function isSecureRequest(req) {
  const xfProto = (req.headers['x-forwarded-proto'] || '').toString().split(',')[0].trim().toLowerCase();
  return req.socket.encrypted || xfProto === 'https';
}

// Set / clear both customer session cookies in one call (forum + portal share the same accounts)
function setCustomerSessionCookies(res, user, req) {
  const sid = randomId();
  const sessionData = { id: user.id, username: user.username, displayName: user.displayName, createdAt: user.createdAt, expiresAt: now() + PORTAL_SESSION_TTL_MS };
  forumSessions.set(sid, { ...sessionData, expiresAt: now() + FORUM_SESSION_TTL_MS });
  portalSessions.set(sid, sessionData);
  saveSessionsToDisk(FORUM_SESSIONS_DB_PATH, forumSessions);
  saveSessionsToDisk(PORTAL_SESSIONS_DB_PATH, portalSessions);
  res.setHeader('Set-Cookie', [
    customerSessionCookie('oe_forum_session',  sid, Math.floor(FORUM_SESSION_TTL_MS  / 1000), req),
    customerSessionCookie('oe_portal_session', sid, Math.floor(PORTAL_SESSION_TTL_MS / 1000), req),
  ]);
  return sid;
}
function clearCustomerSessionCookies(res, req, forumSid, portalSid) {
  if (forumSid)  { forumSessions.delete(forumSid);  saveSessionsToDisk(FORUM_SESSIONS_DB_PATH,  forumSessions); }
  if (portalSid) { portalSessions.delete(portalSid); saveSessionsToDisk(PORTAL_SESSIONS_DB_PATH, portalSessions); }
  res.setHeader('Set-Cookie', [
    customerSessionCookie('oe_forum_session',  '', 0, req),
    customerSessionCookie('oe_portal_session', '', 0, req),
  ]);
}

function sessionCookie(name, value, maxAgeSec, req) {
  const parts = [`${name}=${value}`, 'HttpOnly', 'SameSite=Strict', 'Path=/', `Max-Age=${maxAgeSec}`];
  if (isSecureRequest(req)) parts.push('Secure');
  return parts.join('; ');
}

// Customer session cookies need Domain set to the parent domain so they're shared
// across all subdomains (forum., portal., games., etc.). Localhost is exempt —
// browsers already share cookies across ports on the same hostname.
function sharedDomain() {
  try {
    const hostname = new URL(getSiteUrl()).hostname;
    if (hostname === 'localhost' || /^\d+\.\d+\.\d+\.\d+$/.test(hostname)) return null;
    const parts = hostname.split('.');
    // For country-code second-levels like .com.au keep last 3 parts, else last 2
    const root = (parts.length >= 3 && parts[parts.length - 2].length <= 4)
      ? parts.slice(-3).join('.')
      : parts.slice(-2).join('.');
    return '.' + root; // e.g. .outbackelectronics.com.au
  } catch { return null; }
}
function customerSessionCookie(name, value, maxAgeSec, req) {
  const parts = [`${name}=${value}`, 'HttpOnly', 'SameSite=Strict', 'Path=/', `Max-Age=${maxAgeSec}`];
  const domain = sharedDomain();
  if (domain) parts.push(`Domain=${domain}`);
  if (isSecureRequest(req)) parts.push('Secure');
  return parts.join('; ');
}

// ── CSRF helpers (double-submit cookie) ──────────────────────────────────────
function csrfCookie(value, req) {
  const parts = [`_csrf=${value}`, 'SameSite=Strict', 'Path=/', 'Max-Age=86400'];
  if (isSecureRequest(req)) parts.push('Secure');
  return parts.join('; ');
}
function ensureCsrfCookie(req, res) {
  const existing = parseCookies(req)._csrf || '';
  const token = existing.length === 64 ? existing : crypto.randomBytes(32).toString('hex');
  if (!existing || existing.length !== 64) res.setHeader('Set-Cookie', csrfCookie(token, req));
  return token;
}
function verifyCsrf(req, res) {
  const header = (req.headers['x-csrf-token'] || '').trim();
  const cookie = (parseCookies(req)._csrf || '').trim();
  if (!header || !cookie || header.length !== 64 || cookie.length !== 64) {
    json(res, 403, { error: 'csrf_required' }); return false;
  }
  try {
    if (!crypto.timingSafeEqual(Buffer.from(header, 'hex'), Buffer.from(cookie, 'hex'))) {
      json(res, 403, { error: 'csrf_invalid' }); return false;
    }
  } catch { json(res, 403, { error: 'csrf_invalid' }); return false; }
  return true;
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}
function verifyPassword(password, stored) {
  const [salt, hash] = stored.split(':');
  const attemptBuf = crypto.scryptSync(password, salt, 64);
  const hashBuf = Buffer.from(hash, 'hex');
  if (attemptBuf.length !== hashBuf.length) return false;
  return crypto.timingSafeEqual(attemptBuf, hashBuf);
}

// Hash the admin password once at startup so it is never compared plaintext at runtime.
// If the env var is not set, ADMIN_PASSWORD_HASH stays null and the env-var login path is disabled.
const ADMIN_PASSWORD_HASH = ADMIN_PASSWORD_RAW.length > 0 ? hashPassword(ADMIN_PASSWORD_RAW) : null;

function getSession(req) {
  const sid = parseCookies(req).oe_admin_session;
  if (!sid) return null;
  const session = sessions.get(sid);
  if (!session || session.expiresAt < now()) { if (sid) { sessions.delete(sid); saveSessionsToDisk(SESSIONS_DB_PATH, sessions); } return null; }
  return { sid, ...session };
}
function requireRole(req, res, minRole = 'owner') {
  const session = getSession(req);
  if (!session) { json(res, 401, { error: 'unauthorized' }); return null; }
  const level = ROLE_LEVELS[session.role] ?? -1;
  const required = ROLE_LEVELS[minRole] ?? 99;
  if (level < required) { json(res, 403, { error: 'forbidden' }); return null; }
  return session;
}
function requireAdmin(req, res) { return requireRole(req, res, 'owner'); }

function isIpAllowed(ip) { return ADMIN_IP_ALLOWLIST.length === 0 || ADMIN_IP_ALLOWLIST.includes(ip); }
function isLocked(ip) { const e = loginAttempts.get(ip); return !!e && e.lockedUntil && e.lockedUntil > now(); }
function trackFailure(ip) {
  const t = now();
  const entry = loginAttempts.get(ip) || { attempts: [], lockedUntil: 0 };
  entry.attempts = entry.attempts.filter(ts => ts > t - RATE_WINDOW_MS);
  entry.attempts.push(t);
  if (entry.attempts.length >= RATE_MAX_ATTEMPTS) { entry.lockedUntil = t + LOCKOUT_MS; entry.attempts = []; }
  loginAttempts.set(ip, entry);
}
function clearFailures(ip) { loginAttempts.delete(ip); }
function publicRateLimited(ip, bucket) {
  const key = `${bucket}:${ip}`;
  const t = now();
  const timestamps = (publicRateCounts.get(key) || []).filter(ts => ts > t - PUBLIC_RATE_WINDOW_MS);
  if (timestamps.length >= (PUBLIC_RATE_LIMITS[bucket] || 10)) return true;
  timestamps.push(t);
  publicRateCounts.set(key, timestamps);
  return false;
}

function getForumSession(req) {
  const sid = parseCookies(req).oe_forum_session;
  if (!sid) return null;
  const session = forumSessions.get(sid);
  if (!session || session.expiresAt < now()) { if (sid) { forumSessions.delete(sid); saveSessionsToDisk(FORUM_SESSIONS_DB_PATH, forumSessions); } return null; }
  return { sid, ...session };
}

function getPortalSession(req) {
  const sid = parseCookies(req).oe_portal_session;
  if (!sid) return null;
  const session = portalSessions.get(sid);
  if (!session || session.expiresAt < now()) { if (sid) { portalSessions.delete(sid); saveSessionsToDisk(PORTAL_SESSIONS_DB_PATH, portalSessions); } return null; }
  return { sid, ...session };
}

// ── Membership tier access helpers ───────────────────────────────────────────
function getMemberActiveTier(username) {
  if (!username) return null;
  const { tiers, subscriptions } = readMemberships();
  const sub = (subscriptions || []).find(s => s.username === username && s.status === 'active');
  if (!sub) return null;
  return (tiers || []).find(t => t.id === sub.tierId) || null;
}

function memberCanAccess(username, requiredTierId) {
  if (!requiredTierId) return true; // public
  const { tiers } = readMemberships();
  const requiredTier = tiers.find(t => t.id === requiredTierId);
  if (!requiredTier) return true; // required tier doesn't exist, allow access
  const userTier = getMemberActiveTier(username);
  if (!userTier) return false; // no membership
  const userPrice = Number(userTier.price || userTier.priceAud) || 0;
  const requiredPrice = Number(requiredTier.price || requiredTier.priceAud) || 0;
  return userPrice >= requiredPrice;
}

// ── Static file serving ───────────────────────────────────────────────────────

// Only files under these directories may be served. Data files (.db), .env,
// server.js, logs, etc. live in __dirname but must never be web-accessible.
const ALLOWED_SERVE_ROOTS = [
  path.join(__dirname, 'dist') + '/',
  path.join(__dirname, 'public') + '/',
  path.join(__dirname, 'assets') + '/',
];

// spaRoutes: Set of route names to serve rootFile for (main SPA).
// Pass null to serve rootFile for all non-asset paths (forum/admin/portal).
function serveStatic(req, res, urlPath, rootFile, spaRoutes = null) {
  const cleanPath = String(urlPath || '/').split('?')[0];
  const isAsset = cleanPath.startsWith('/assets/') || /\.(jsx|js|css|png|ico|jpg|svg|woff2?)$/.test(cleanPath);
  let safePath;
  if (cleanPath === '/') {
    safePath = rootFile;
  } else if (isAsset) {
    safePath = cleanPath;
  } else if (spaRoutes !== null) {
    safePath = spaRoutes.has(cleanPath.replace(/^\/+/, '')) ? rootFile : cleanPath;
  } else {
    safePath = rootFile;
  }

  // For dist-rooted servers, check dist/ first for any path, then fall back to the root
  const distRoot = rootFile.startsWith('/dist/');
  const candidates = [];
  if (distRoot) {
    candidates.push(path.join(__dirname, 'dist', safePath));
  }
  candidates.push(path.join(__dirname, safePath));
  // Also check public/ for static-only files (sw.js, offline.html, etc.)
  candidates.push(path.join(__dirname, 'public', safePath));

  const tryRead = (paths, idx) => {
    if (idx >= paths.length) { return sendErrorPage(res, 404, 'Not found', ERROR_404_HTML); }
    const filePath = paths[idx];
    if (!ALLOWED_SERVE_ROOTS.some(root => filePath.startsWith(root))) { return sendErrorPage(res, 403, 'Forbidden', ERROR_403_HTML); }
    fs.readFile(filePath, (err, data) => {
      if (err) return tryRead(paths, idx + 1);
      const ext = path.extname(filePath).toLowerCase();
      const types = { '.html': 'text/html', '.jsx': 'text/javascript', '.js': 'text/javascript', '.css': 'text/css', '.txt': 'text/plain', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff': 'font/woff', '.woff2': 'font/woff2' };
      const isSoftwareDownload = filePath.includes('/assets/uploads/software/');
      const isImmutable = /\.(js|css|png|jpg|jpeg|webp|gif|svg|ico|woff2?)$/.test(ext) && !isSoftwareDownload;
      const cacheHeader = isImmutable
        ? 'public, max-age=31536000, immutable'
        : 'no-cache, must-revalidate';
      const isHtml = ext === '.html';
      const isEmbeddable = isHtml && filePath.endsWith('ai-video.html');
      const securityHeaders = isHtml ? {
        'X-Frame-Options': isEmbeddable ? 'SAMEORIGIN' : 'DENY',
        'X-Content-Type-Options': 'nosniff',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
        'Content-Security-Policy': isEmbeddable
          ? "default-src 'self'; script-src 'self' https://cdnjs.cloudflare.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: https:; font-src 'self' data: https://fonts.gstatic.com; connect-src 'self' https://nominatim.openstreetmap.org; frame-src https://www.openstreetmap.org; frame-ancestors 'self';"
          : PUBLIC_CSP,
      } : { 'X-Content-Type-Options': 'nosniff' };
      const isPdf = ext === '.pdf';
      const extraHeaders = (isSoftwareDownload || isPdf)
        ? { 'Content-Disposition': `attachment; filename="${path.basename(filePath)}"` }
        : {};
      res.writeHead(200, {
        'Content-Type': (types[ext] || 'application/octet-stream'),
        'Cache-Control': cacheHeader,
        ...securityHeaders,
        ...extraHeaders,
      });
      res.end(data);
    });
  };
  tryRead(candidates, 0);
}

// ── OG tag injection for social crawlers ─────────────────────────────────────

const OG_BASE_URL = 'https://outbackelectronics.com.au';

const STATIC_OG = {
  '/shop':        { title: 'Shop — Outback Electronics',           description: 'Browse rugged laptops, solar gear, satellite comms, UHF radios and off-grid tools built for remote Australia.',           image: '/assets/og-image.webp' },
  '/services':    { title: 'Services — Outback Electronics',       description: 'Expert repairs, field service and bench diagnostics for rugged devices. Book a repair or drop in.',                       image: '/assets/og-image.webp' },
  '/groups':      { title: 'Community Groups — Outback Electronics', description: 'Connect with community chapters across remote Australia. Find your local Outback Electronics group.',                  image: '/assets/og-image.webp' },
  '/memberships': { title: 'Memberships — Outback Electronics',    description: 'Join the Outback Electronics community. Member discounts, priority repairs and exclusive access.',                       image: '/assets/og-image.webp' },
  '/tutorials':   { title: 'Tutorials — Outback Electronics',      description: 'Field guides, how-to videos and repair tutorials for off-grid gear and rugged electronics.',                            image: '/assets/og-image.webp' },
  '/software':    { title: 'Software Library — Outback Electronics', description: 'Download firmware, drivers and utilities for rugged devices and off-grid hardware.',                                  image: '/assets/og-image.webp' },
  '/ai':          { title: 'Edge AI — Outback Electronics',        description: 'Offline-capable AI models and inference hardware for remote deployments. No cloud required.',                           image: '/assets/og-image.webp' },
  '/ewaste':      { title: 'eWaste Take-Back — Outback Electronics', description: 'Responsible eWaste recycling and take-back for old electronics. Drop in or arrange a pickup.',                        image: '/assets/og-image.webp' },
  '/contact':     { title: 'Contact — Outback Electronics',        description: "Get in touch with the Outback Electronics team. We're based in Moama NSW and serve remote Australia.",                 image: '/assets/og-image.webp' },
  '/quote':       { title: 'Request a Quote — Outback Electronics', description: 'Need a custom kit or bulk order? Request a quote from Outback Electronics.',                                          image: '/assets/og-image.webp' },
};

function stripHtml(s) { return String(s || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim(); }

function resolveOgTags(pathname) {
  // Static routes
  if (STATIC_OG[pathname]) {
    const s = STATIC_OG[pathname];
    return { title: s.title, description: s.description, image: s.image, url: OG_BASE_URL + pathname };
  }
  // Product deep link: /product/<sku-or-id>
  if (pathname.startsWith('/product/')) {
    const id = decodeURIComponent(pathname.slice('/product/'.length));
    if (id) {
      const products = readProducts().filter(p => p.status === 'published');
      const p = products.find(x => x.sku === id || String(x.id) === id || (x.slug && x.slug === id));
      if (p) {
        const price = p.price != null ? ` — $${Number(p.price).toLocaleString('en-AU', { minimumFractionDigits: 2 })}` : '';
        const desc = p.description ? stripHtml(p.description).slice(0, 160) : `${p.name}. Available at Outback Electronics — rugged gear for remote Australia.`;
        return {
          title: `${p.name}${price} — Outback Electronics`,
          description: desc,
          image: (p.images && p.images[0]) || '/assets/og-image.webp',
          url: `${OG_BASE_URL}/product/${encodeURIComponent(id)}`,
          type: 'product',
        };
      }
    }
    // Unknown product SKU — still serve index.html so React can handle it
    return { title: 'Outback Electronics', description: 'Rugged gear, solar kits, comms and tools built for remote Australia.', image: '/assets/og-image.webp', url: OG_BASE_URL + pathname };
  }
  // Service deep link: /service/<id>
  if (pathname.startsWith('/service/')) {
    const id = decodeURIComponent(pathname.slice('/service/'.length));
    if (id) {
      const services = readServices();
      const s = services.find(x => String(x.id) === id || (x.slug && x.slug === id));
      if (s) {
        const desc = s.description ? stripHtml(s.description).slice(0, 160) : `${s.name}. Expert service from Outback Electronics.`;
        return {
          title: `${s.name} — Outback Electronics Services`,
          description: desc,
          image: (s.images && s.images[0]) || '/assets/og-image.webp',
          url: `${OG_BASE_URL}/service/${encodeURIComponent(id)}`,
        };
      }
    }
    return { title: 'Services — Outback Electronics', description: 'Expert repairs and field service for rugged electronics.', image: '/assets/og-image.webp', url: OG_BASE_URL + pathname };
  }
  return null;
}

const ESC_HTML_MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };
function escOg(s) { return String(s || '').replace(/[&<>"]/g, c => ESC_HTML_MAP[c]); }

function serveIndexWithOg(res, og) {
  const distPath = path.join(__dirname, 'dist', 'index.html');
  fs.readFile(distPath, 'utf8', (err, template) => {
    if (err) return sendErrorPage(res, 404, 'Not found', ERROR_404_HTML);
    const ogType = og.type === 'product' ? 'product' : 'website';
    const html = template
      .replace(/<title>[^<]*<\/title>/, `<title>${escOg(og.title)}</title>`)
      .replace(/<meta name="description"[^>]*\/?>/, `<meta name="description" content="${escOg(og.description)}" />`)
      .replace(/<meta property="og:title"[^>]*\/?>/, `<meta property="og:title" content="${escOg(og.title)}" />`)
      .replace(/<meta property="og:description"[^>]*\/?>/, `<meta property="og:description" content="${escOg(og.description)}" />`)
      .replace(/<meta property="og:image"[^>]*\/?>/, `<meta property="og:image" content="${escOg(og.image)}" />`)
      .replace(/<meta property="og:url"[^>]*\/?>/, `<meta property="og:url" content="${escOg(og.url)}" />`)
      .replace(/<meta property="og:type"[^>]*\/?>/, `<meta property="og:type" content="${ogType}" />`);
    res.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-cache, must-revalidate',
      'X-Frame-Options': 'DENY',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Content-Security-Policy': PUBLIC_CSP,
    });
    res.end(html);
  });
}

// Read once at startup so per-request file I/O can't fail
const MAINTENANCE_HTML = (() => {
  try { return fs.readFileSync(path.join(__dirname, 'dist', 'maintenance.html'), 'utf8'); }
  catch (e) { console.error('[maintenance] could not read dist/maintenance.html:', e.message); return null; }
})();

function loadErrorPage(name) {
  for (const p of [path.join(__dirname, 'dist', name), path.join(__dirname, name)]) {
    try { return fs.readFileSync(p, 'utf8'); } catch {}
  }
  return null;
}
const ERROR_404_HTML = loadErrorPage('404.html');
const ERROR_500_HTML = loadErrorPage('500.html');
const ERROR_403_HTML = loadErrorPage('403.html');
const ERROR_401_HTML = loadErrorPage('401.html');
const OFFLINE_HTML   = loadErrorPage('offline.html');

function sendErrorPage(res, status, fallback, html) {
  if (!html) { res.writeHead(status); return res.end(fallback); }
  res.writeHead(status, {
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'no-cache, must-revalidate',
    'X-Frame-Options': 'SAMEORIGIN',
    'X-Content-Type-Options': 'nosniff',
  });
  res.end(html);
}

function sendMaintenance(res) {
  if (!MAINTENANCE_HTML) { res.writeHead(503); return res.end('Service temporarily unavailable.'); }
  const { shop } = readSettings();
  const email = (shop && shop.email) ? shop.email.trim() : '';
  const emailHtml = email
    ? `<p class="note">Need help? Shoot us an email at <a href="mailto:${email}">${email}</a>!</p>`
    : '';
  const html = MAINTENANCE_HTML.replace(/\{\{CONTACT_EMAIL\}\}/g, emailHtml);
  res.writeHead(503, {
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'no-cache, must-revalidate',
    'X-Frame-Options': 'SAMEORIGIN',
    'X-Content-Type-Options': 'nosniff',
  });
  res.end(html);
}

function checkMaintenance(req, res, url) {
  // SSE stream — client connects once and gets pushed updates instantly
  if (req.method === 'GET' && url.pathname === '/api/maintenance-events') {
    const { maintenance } = readSettings();
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    res.write(`data: ${JSON.stringify({ enabled: !!(maintenance && maintenance.enabled) })}\n\n`);
    maintenanceSseClients.add(res);
    req.on('close', () => maintenanceSseClients.delete(res));
    return true;
  }

  // Legacy poll endpoint kept for backwards compatibility
  if (req.method === 'GET' && url.pathname === '/api/maintenance-status') {
    const { maintenance } = readSettings();
    json(res, 200, { enabled: !!(maintenance && maintenance.enabled) });
    return true;
  }

  const { maintenance } = readSettings();
  const enabled = !!(maintenance && maintenance.enabled);

  // If maintenance just turned off, redirect anyone still on /maintenance back to their original page
  if (url.pathname === '/maintenance' && !enabled) {
    const from = url.searchParams.get('from') || '/';
    const safe = from.startsWith('/') && !from.startsWith('//') ? from : '/';
    res.writeHead(302, { 'Location': safe });
    res.end();
    return true;
  }

  if (!enabled) return false;

  // Let static root assets through so the maintenance page can render them
  if (['/favicon.png', '/favicon.ico', '/logo.webp'].includes(url.pathname)) return false;

  if (url.pathname === '/maintenance') { sendMaintenance(res); return true; }

  if (req.method === 'GET') {
    const from = encodeURIComponent(url.pathname + url.search);
    res.writeHead(302, { 'Location': `/maintenance?from=${from}` });
    res.end();
    return true;
  }

  json(res, 503, { error: 'maintenance', message: 'Site is temporarily under maintenance.' });
  return true;
}

const MAIN_SPA_ROUTES = new Set([
  'home', 'shop', 'services', 'software', 'ewaste', 'ai', 'tutorials', 'groups',
  'quote', 'sellers', 'contact', 'policies', 'admin',
  'account', 'profile', 'subscriptions', 'rewards', 'wallet', 'my-groups',
  'orders', 'addresses', 'bookings',
  'product', 'service', 'memberships', 'gift-cards',
  'order-success', 'order-cancelled',
  'cart',
  'register',
  'about', 'repairs', 'humanly-ai',
]);

// ── Email ─────────────────────────────────────────────────────────────────────

const nodemailer = require('nodemailer');

function getMailer() {
  const smtp = getSmtpConfig();
  if (!smtp.host || !smtp.user || !smtp.pass) return null;
  return nodemailer.createTransport({
    host: smtp.host, port: smtp.port, secure: smtp.port === 465,
    auth: { user: smtp.user, pass: smtp.pass },
  });
}

async function sendEmail({ to, subject, html, replyTo }) {
  if (!to) return;
  const transport = getMailer();
  if (!transport) return;
  const smtp = getSmtpConfig();
  const fromAddress = `Outback Electronics <${smtp.user || 'noreply@outbackelectronics.com.au'}>`;
  const text = html.replace(/<[^>]+>/g, '').replace(/\n{3,}/g, '\n\n').trim();
  const msg = { from: fromAddress, to, subject, html, text };
  if (replyTo) msg.replyTo = replyTo;
  try {
    await transport.sendMail(msg);
  } catch (err) {
    console.error('[email] failed →', to, '|', err.message);
  }
}


function escHtml(str) {
  return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// Shared HTML wrapper
function emailHtml(title, bodyHtml) {
  const { shop } = readSettings();
  const address = shop.address || '183 Peericoota Forest Rd, Moama NSW 2731';
  return `<!DOCTYPE html><html><head><meta charset="utf-8">
<style>
  body{margin:0;padding:0;background:#f4ede1;font-family:Arial,sans-serif;color:#1f1a14}
  .wrap{max-width:560px;margin:32px auto;background:#fbf7ed;border:1px solid #d8cdb6}
  .hdr{background:#1f1a14;padding:20px 28px;display:flex;align-items:center;gap:12px}
  .hdr-title{color:#d39a37;font-family:monospace;font-size:11px;letter-spacing:.15em}
  .body{padding:28px 32px}
  h1{font-size:26px;font-weight:400;margin:0 0 16px;font-family:Georgia,serif}
  p{margin:0 0 14px;line-height:1.65;font-size:14px;color:#3a3028}
  .detail{background:#f4ede1;border:1px solid #d8cdb6;padding:14px 18px;margin:16px 0;font-size:13px}
  .detail dt{font-family:monospace;font-size:10px;letter-spacing:.1em;color:#5a4f40;margin-top:10px}
  .detail dt:first-child{margin-top:0}
  .detail dd{margin:2px 0 0;font-weight:600;color:#1f1a14}
  .btn{display:inline-block;background:#1f88f5;color:#fff;padding:11px 22px;text-decoration:none;font-size:13px;font-weight:600;margin:8px 0}
  .ftr{padding:16px 32px;border-top:1px solid #d8cdb6;font-size:11px;color:#8b7e69;font-family:monospace}
</style></head><body>
<div class="wrap">
  <div class="hdr"><div class="hdr-title">OUTBACK · ELECTRONICS</div></div>
  <div class="body">
    <h1>${title}</h1>
    ${bodyHtml}
  </div>
  <div class="ftr">${address} · Appointment only · outbackelectronics.com.au</div>
</div></body></html>`;
}

// ── Email templates ───────────────────────────────────────────────────────────

function emailOrderConfirmation({ orderId, customerName, amountAud, items }) {
  const name = customerName ? `, ${escHtml(customerName.split(' ')[0])}` : '';
  return {
    subject: `Order confirmed — ${orderId}`,
    html: emailHtml('Order confirmed', `
      <p>Thanks${name}! Your payment was received and your order has been logged.</p>
      <div class="detail">
        <dt>ORDER</dt><dd>${escHtml(orderId)}</dd>
        ${items ? `<dt>ITEMS</dt><dd>${escHtml(items)}</dd>` : ''}
        <dt>AMOUNT PAID</dt><dd>$${Number(amountAud).toLocaleString('en-AU', {minimumFractionDigits:2})} AUD</dd>
      </div>
      <p>Our team will be in touch shortly. For pickups or repairs, please bring this confirmation.</p>
      <a class="btn" href="${getSiteUrl()}/orders">View your orders →</a>
    `),
  };
}

function emailQuoteReceived({ quoteId, customerName, description }) {
  return {
    subject: `Quote request received — ${quoteId}`,
    html: emailHtml('We\'ve got your quote request', `
      <p>Hi${customerName ? ` ${escHtml(customerName.split(' ')[0])}` : ''},</p>
      <p>Thanks for reaching out. We've received your quote request and will get back to you as soon as possible.</p>
      <div class="detail">
        <dt>REFERENCE</dt><dd>${escHtml(quoteId)}</dd>
        <dt>YOUR REQUEST</dt><dd>${escHtml(description)}</dd>
      </div>
      <p>We'll reply to this email when your quote is ready. Typical turnaround is 1–2 business days.</p>
    `),
  };
}

function emailQuoteReply({ quoteId, customerName, reply, status }) {
  const statusLabel = { approved:'Approved', declined:'Declined', pending:'Pending review' }[status] || status;
  return {
    subject: `Your quote is ready — ${quoteId}`,
    html: emailHtml('Your quote is ready', `
      <p>Hi${customerName ? ` ${escHtml(customerName.split(' ')[0])}` : ''},</p>
      <p>We've reviewed your request and have an update for you.</p>
      <div class="detail">
        <dt>REFERENCE</dt><dd>${escHtml(quoteId)}</dd>
        <dt>STATUS</dt><dd>${escHtml(statusLabel)}</dd>
        <dt>MESSAGE FROM US</dt><dd>${escHtml(reply)}</dd>
      </div>
      <p>If you have questions or want to go ahead, reply to this email or get in touch via the portal.</p>
      <a class="btn" href="${getSiteUrl()}/portal">View in portal →</a>
    `),
  };
}

function emailQuoteFormal({ quoteRef, quoteId, quoteToken, customerName, validDays, hardwareItems, pcBuild, pcBuildFee, otherItems, grandTotal, notes }) {
  const validUntil = new Date(Date.now() + (validDays || 30) * 24 * 60 * 60 * 1000)
    .toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' });

  const lineItems = [
    ...(hardwareItems || []).filter(i => i.name).map(i => {
      const base = parseFloat(i.basePrice) || 0;
      const qty = parseInt(i.qty) || 1;
      return { label: i.name + (qty > 1 ? ` × ${qty}` : ''), amount: base * qty * 1.02 };
    }),
    ...(pcBuild && pcBuildFee > 0 ? [{ label: 'Custom PC Build', amount: pcBuildFee }] : []),
    ...(otherItems || []).filter(i => i.description).map(i => ({ label: i.description, amount: parseFloat(i.amount) || 0 })),
  ];

  const rows = lineItems.map(item =>
    `<tr><td style="padding:8px 12px;border-bottom:1px solid #d8cdb6;font-size:13px;">${escHtml(item.label)}</td>` +
    `<td style="padding:8px 12px;border-bottom:1px solid #d8cdb6;font-size:13px;text-align:right;font-family:monospace;font-weight:600;">$${item.amount.toLocaleString('en-AU',{minimumFractionDigits:2,maximumFractionDigits:2})}</td></tr>`
  ).join('');

  return {
    subject: `Your quote — ${quoteRef}`,
    html: emailHtml(`Quote — ${quoteRef}`, `
      <p>Hi${customerName ? ` ${escHtml(customerName.split(' ')[0])}` : ''},</p>
      <p>Thank you for your enquiry. Please find your quote from Outback Electronics below.</p>
      <div class="detail">
        <dt>REFERENCE</dt><dd>${escHtml(quoteRef)}</dd>
        <dt>VALID UNTIL</dt><dd>${validUntil}</dd>
      </div>
      <table style="width:100%;border-collapse:collapse;margin:16px 0;border:1px solid #d8cdb6;">
        <thead><tr style="background:#1f1a14;">
          <th style="padding:10px 12px;text-align:left;font-family:monospace;font-size:10px;letter-spacing:.1em;color:#d39a37;font-weight:400;">ITEM</th>
          <th style="padding:10px 12px;text-align:right;font-family:monospace;font-size:10px;letter-spacing:.1em;color:#d39a37;font-weight:400;">AMOUNT (AUD)</th>
        </tr></thead>
        <tbody>
          ${rows}
          <tr style="background:#1f1a14;">
            <td style="padding:12px;font-weight:700;color:#fbf7ed;font-size:14px;">Total (AUD)</td>
            <td style="padding:12px;text-align:right;font-weight:700;color:#d39a37;font-family:monospace;font-size:16px;">$${(grandTotal||0).toLocaleString('en-AU',{minimumFractionDigits:2,maximumFractionDigits:2})}</td>
          </tr>
        </tbody>
      </table>
      ${notes ? `<div class="detail"><dt>NOTES</dt><dd>${escHtml(notes).replace(/\n/g,'<br>')}</dd></div>` : ''}
      <p>To accept this quote or ask any questions, simply reply to this email or visit your portal.</p>
      <a class="btn" href="${getPortalUrl()}/quotes?token=${encodeURIComponent(quoteToken)}${quoteRef ? `&ref=${encodeURIComponent(quoteRef)}` : ''}">View Quote →</a>
    `),
  };
}

function emailQuoteAccepted({ orderId, quoteRef, customerName, grandTotal }) {
  const name = customerName ? customerName.split(' ')[0] : '';
  return {
    subject: `Order confirmed — ${orderId}`,
    html: emailHtml('Your order is confirmed.', `
      <p>Hi${name ? ` ${escHtml(name)}` : ''},</p>
      <p>Thanks for accepting your quote — your order is now confirmed and we're getting started.</p>
      <div class="detail">
        <dt>ORDER ID</dt><dd>${escHtml(orderId)}</dd>
        <dt>QUOTE REFERENCE</dt><dd>${escHtml(quoteRef)}</dd>
        <dt>TOTAL</dt><dd>$${Number(grandTotal||0).toLocaleString('en-AU',{minimumFractionDigits:2})} AUD</dd>
      </div>
      <p>We'll keep you updated as your build progresses. You can track your order in the customer portal at any time.</p>
      <a class="btn" href="${getSiteUrl()}/portal">View in portal →</a>
    `),
  };
}

function emailStaffQuoteAccepted({ orderId, quoteRef, name, email, grandTotal }) {
  return {
    subject: `[ORDER] Quote accepted — ${quoteRef} → ${orderId}`,
    html: emailHtml('Quote accepted — new order created', `
      <div class="detail">
        <dt>ORDER ID</dt><dd>${escHtml(orderId)}</dd>
        <dt>QUOTE REFERENCE</dt><dd>${escHtml(quoteRef)}</dd>
        <dt>CUSTOMER</dt><dd>${escHtml(name)} &lt;${escHtml(email)}&gt;</dd>
        <dt>TOTAL</dt><dd>$${Number(grandTotal||0).toLocaleString('en-AU',{minimumFractionDigits:2})} AUD</dd>
      </div>
    `),
  };
}

function emailOrderDelivered({ orderId, customerName, trackingNumber }) {
  const name = customerName ? customerName.split(' ')[0] : '';
  return {
    subject: `Your order has been delivered — ${orderId}`,
    html: emailHtml("Your order has arrived!", `
      <p>Hi${name ? ` ${escHtml(name)}` : ''},</p>
      <p>Australia Post has confirmed your order has been delivered. We hope everything looks great!</p>
      <div class="detail">
        <dt>ORDER ID</dt><dd>${escHtml(orderId)}</dd>
        ${trackingNumber ? `<dt>TRACKING</dt><dd>${escHtml(trackingNumber)}</dd>` : ''}
      </div>
      <p>If you have any questions about your order or anything isn't right, please don't hesitate to get in touch.</p>
      <a class="btn" href="${getPortalUrl()}/orders">View your order →</a>
    `),
  };
}

function emailOrderRefunded({ orderId, customerName, amount, method }) {
  const name = customerName ? customerName.split(' ')[0] : '';
  const amtStr = '$' + (Number(amount) || 0).toLocaleString('en-AU', { minimumFractionDigits: 2 });
  return {
    subject: `Your refund has been processed — ${orderId}`,
    html: emailHtml("Your refund has been processed", `
      <p>Hi${name ? ` ${escHtml(name)}` : ''},</p>
      <p>We've processed a refund of <strong>${escHtml(amtStr)}</strong> for your order to ${escHtml(method)}.</p>
      <div class="detail">
        <dt>ORDER ID</dt><dd>${escHtml(orderId)}</dd>
        <dt>REFUND AMOUNT</dt><dd>${escHtml(amtStr)}</dd>
      </div>
      <p>If this was a refund to your original payment method, please allow a few business days for it to appear. If you have any questions, just reply to this email.</p>
      <a class="btn" href="${getPortalUrl()}/orders">View your order →</a>
    `),
  };
}

function emailOrderShipped({ orderId, customerName, trackingNumber }) {
  const name = customerName ? customerName.split(' ')[0] : '';
  const trackingUrl = `https://auspost.com.au/mypost/track/#/details/${encodeURIComponent(trackingNumber)}`;
  const registerUrl = `${getPortalUrl()}/?warranty=${encodeURIComponent(orderId)}`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(registerUrl)}`;
  return {
    subject: `Your order has shipped — ${orderId}`,
    html: emailHtml("Your order is on its way!", `
      <p>Hi${name ? ` ${escHtml(name)}` : ''},</p>
      <p>Great news — your order has been shipped via Australia Post.</p>
      <div class="detail">
        <dt>ORDER ID</dt><dd>${escHtml(orderId)}</dd>
        <dt>TRACKING NUMBER</dt><dd>${escHtml(trackingNumber)}</dd>
      </div>
      <a class="btn" href="${escHtml(trackingUrl)}">Track your parcel →</a>
      <p style="margin-top:24px;font-size:13px;font-weight:600;">Register your build for warranty</p>
      <p style="font-size:13px;color:#5a4f40;margin-bottom:12px;">Once your order arrives, scan the QR code below or click the link to register your custom PC for warranty.</p>
      <div style="text-align:center;margin:16px 0;">
        <img src="${qrUrl}" alt="Warranty registration QR code" width="160" height="160" style="display:block;margin:0 auto 12px;" />
        <a href="${escHtml(registerUrl)}" style="font-family:monospace;font-size:12px;color:#1f88f5;word-break:break-all;">${escHtml(registerUrl)}</a>
      </div>
      <p style="margin-top:16px;font-size:12px;color:#8b7e69">For delivery issues contact Australia Post with your tracking number. For any issues with the build itself, reply to this email.</p>
    `),
  };
}

function emailRepairUpdate({ repairId, customerName, status, notes }) {
  const messages = {
    'In Progress': 'Your repair is now being worked on by our technicians.',
    'Waiting Parts': 'We\'re waiting on parts for your repair. We\'ll update you when they arrive.',
    'Ready': 'Great news — your repair is complete and ready for collection!',
    'Done': 'Your repair has been completed and marked as done.',
  };
  const msg = messages[status] || `Your repair status has been updated to: ${escHtml(status)}.`;
  return {
    subject: `Repair update — ${repairId}`,
    html: emailHtml('Repair status update', `
      <p>Hi${customerName ? ` ${escHtml(customerName.split(' ')[0])}` : ''},</p>
      <p>${msg}</p>
      <div class="detail">
        <dt>JOB REFERENCE</dt><dd>${escHtml(repairId)}</dd>
        <dt>STATUS</dt><dd>${escHtml(status)}</dd>
        ${notes ? `<dt>NOTES</dt><dd>${escHtml(notes)}</dd>` : ''}
      </div>
      <p>Our workshop is appointment-only — please call ahead before collecting.</p>
    `),
  };
}

function emailEwasteConfirmation({ intakeId, customerName, description }) {
  return {
    subject: `eWaste intake confirmed — ${intakeId}`,
    html: emailHtml('eWaste intake confirmed', `
      <p>Hi${customerName ? ` ${escHtml(customerName.split(' ')[0])}` : ''},</p>
      <p>Your eWaste intake request has been received. We'll arrange collection or drop-off and handle everything responsibly.</p>
      <div class="detail">
        <dt>REFERENCE</dt><dd>${escHtml(intakeId)}</dd>
        ${description ? `<dt>ITEMS</dt><dd>${escHtml(description)}</dd>` : ''}
      </div>
      <p>We'll be in touch to confirm next steps.</p>
    `),
  };
}

function emailMembershipWelcome({ customerName, tierName }) {
  return {
    subject: `Welcome to ${tierName} membership`,
    html: emailHtml(`Welcome to ${escHtml(tierName)}!`, `
      <p>Hi${customerName ? ` ${escHtml(customerName.split(' ')[0])}` : ''},</p>
      <p>You're now a <strong>${escHtml(tierName)}</strong> member of Outback Electronics. Thanks for your support!</p>
      <p>Your membership benefits are active immediately. Log in to the portal to see what's available to you.</p>
      <a class="btn" href="${getSiteUrl()}/portal">Go to portal →</a>
    `),
  };
}

function emailMembershipCancelled({ customerName, tierName }) {
  return {
    subject: 'Membership cancelled',
    html: emailHtml('Membership cancelled', `
      <p>Hi${customerName ? ` ${escHtml(customerName.split(' ')[0])}` : ''},</p>
      <p>Your <strong>${escHtml(tierName)}</strong> membership has been cancelled. You'll retain access until the end of your current period.</p>
      <p>If this was a mistake or you'd like to resubscribe, just log back into the portal.</p>
      <a class="btn" href="${getSiteUrl()}/portal">Return to portal →</a>
    `),
  };
}

function emailPortalWelcome({ username, displayName }) {
  return {
    subject: 'Welcome to Outback Electronics',
    html: emailHtml('Welcome!', `
      <p>Hi ${escHtml(displayName || username)},</p>
      <p>Your Outback Electronics account is ready. You can now track repairs, request quotes, and manage your membership from the portal.</p>
      <a class="btn" href="${getSiteUrl()}/portal">Go to your portal →</a>
    `),
  };
}

function emailOrderTracking({ customerName, orderId, trackingToken }) {
  const name = customerName ? customerName.split(' ')[0] : '';
  const link = `${getPortalUrl()}/?order_token=${encodeURIComponent(trackingToken)}`;
  return {
    subject: `Track your order — ${orderId}`,
    html: emailHtml('Your order is underway.', `
      <p>Hi${name ? ` ${escHtml(name)}` : ''},</p>
      <p>We've got your order and we're working on it. Click below to set up your account and track progress at any time.</p>
      <a class="btn" href="${link}">View your order →</a>
    `),
  };
}

function emailPasswordReset({ displayName, resetUrl }) {
  return {
    subject: 'Reset your password — Outback Electronics',
    html: emailHtml('Reset your password', `
      <p>Hi ${escHtml(displayName)},</p>
      <p>We received a request to reset your Outback Electronics password. Click the button below to choose a new one. This link expires in 1 hour.</p>
      <a class="btn" href="${resetUrl}">Reset password →</a>
      <p style="margin-top:20px;font-size:12px;color:#8b7e69;">If you didn't request a password reset, you can safely ignore this email.</p>
    `),
  };
}

// Staff notification templates
function emailStaffNewOrder({ orderId, customerName, amountAud, items }) {
  return {
    subject: `[ORDER] New Stripe order — ${orderId}`,
    html: emailHtml('New online order received', `
      <div class="detail">
        <dt>ORDER</dt><dd>${escHtml(orderId)}</dd>
        <dt>CUSTOMER</dt><dd>${escHtml(customerName || '—')}</dd>
        ${items ? `<dt>ITEMS</dt><dd>${escHtml(items)}</dd>` : ''}
        <dt>AMOUNT</dt><dd>$${Number(amountAud).toLocaleString('en-AU', {minimumFractionDigits:2})} AUD</dd>
      </div>
      <a class="btn" href="${getAdminUrl()}/admin#orders">View in admin →</a>
    `),
  };
}

function emailStaffNewQuote({ quoteId, name, email, description }) {
  return {
    subject: `[QUOTE] New request — ${quoteId}`,
    html: emailHtml('New quote request', `
      <div class="detail">
        <dt>REFERENCE</dt><dd>${escHtml(quoteId)}</dd>
        <dt>FROM</dt><dd>${escHtml(name)} &lt;${escHtml(email)}&gt;</dd>
        <dt>REQUEST</dt><dd>${escHtml(description)}</dd>
      </div>
      <a class="btn" href="${getAdminUrl()}/admin#quotes">View in admin →</a>
    `),
  };
}

function emailStaffNewEwaste({ intakeId, name, email, description }) {
  return {
    subject: `[EWASTE] New intake — ${intakeId}`,
    html: emailHtml('New eWaste intake', `
      <div class="detail">
        <dt>REFERENCE</dt><dd>${escHtml(intakeId)}</dd>
        <dt>FROM</dt><dd>${escHtml(name || '—')}${email ? ` &lt;${escHtml(email)}&gt;` : ''}</dd>
        ${description ? `<dt>ITEMS</dt><dd>${escHtml(description)}</dd>` : ''}
      </div>
      <a class="btn" href="${getAdminUrl()}/admin#ewaste">View in admin →</a>
    `),
  };
}

function emailStaffContactMessage({ name, email, msg }) {
  const safeName = String(name ?? '').replace(/[\r\n]+/g, ' ');
  return {
    subject: `[CONTACT] Message from ${safeName}`,
    html: emailHtml('New contact message', `
      <div class="detail">
        <dt>FROM</dt><dd>${escHtml(name)} &lt;${escHtml(email)}&gt;</dd>
        <dt>MESSAGE</dt><dd>${escHtml(msg)}</dd>
      </div>
      <p>Reply directly to this email to respond to the customer.</p>
    `),
  };
}

function emailWarrantyConfirmation({ regId, customerName, orderId, receivedDate, submittedAt, expenses }) {
  const firstName = customerName ? customerName.split(' ')[0] : 'there';
  const newParts = expenses.filter(e => !e.isSecondHand);
  const usedParts = expenses.filter(e => e.isSecondHand);
  const partsHtml = expenses.length === 0 ? '' : `
    <dt>PARTS</dt>
    ${newParts.map(e => `<dd>✓ ${escHtml(e.description)} <span style="font-size:10px;color:#4f6b3e">(NEW · MFR WARRANTY)</span></dd>`).join('')}
    ${usedParts.map(e => `<dd>✓ ${escHtml(e.description)} <span style="font-size:10px;color:#7a5d10">(2ND HAND · TESTED)</span></dd>`).join('')}
  `;
  const warrantyNote = usedParts.length > 0 && newParts.length === 0
    ? 'All parts in your build are second-hand. These have no manufacturer warranty, however every part was tested by us before leaving the shop.'
    : usedParts.length > 0
    ? 'Your build contains a mix of new and second-hand parts. New parts carry manufacturer warranty; second-hand parts were tested by us before leaving the shop and carry no manufacturer warranty.'
    : 'Your build uses all new parts — manufacturer warranty applies to each component. Contact the relevant manufacturer directly for warranty claims.';
  return {
    subject: `[WARRANTY] Custom PC registration confirmed — ${regId}`,
    html: emailHtml('Your build is registered.', `
      <p>Hi ${escHtml(firstName)}, thanks for registering your custom PC build with Outback Electronics.</p>
      <div class="detail">
        <dt>REGISTRATION ID</dt><dd>${escHtml(regId)}</dd>
        <dt>ORDER ID</dt><dd>${escHtml(orderId)}</dd>
        <dt>DATE RECEIVED</dt><dd>${escHtml(receivedDate)}</dd>
        <dt>REGISTERED ON</dt><dd>${new Date(submittedAt).toLocaleDateString('en-AU', { day:'numeric', month:'long', year:'numeric' })}</dd>
        ${partsHtml}
      </div>
      <p>${escHtml(warrantyNote)}</p>
      <p>We guarantee your build was working when it left our shop. If any issues arose during shipping, please raise a claim directly with <strong>Australia Post</strong>.</p>
      <p>Keep this email as your warranty record. If you have any questions, reply here or visit our contact page.</p>
    `),
  };
}

function emailStaffWarrantyRegistration({ regId, name, email, orderId, receivedDate, submittedAt, expenses, notes }) {
  const newParts = expenses.filter(e => !e.isSecondHand);
  const usedParts = expenses.filter(e => e.isSecondHand);
  const partsHtml = expenses.length === 0 ? '<dt>PARTS</dt><dd>None logged</dd>' : `
    <dt>PARTS</dt>
    ${newParts.map(e => `<dd>NEW: ${escHtml(e.description)}</dd>`).join('')}
    ${usedParts.map(e => `<dd>2ND HAND: ${escHtml(e.description)}</dd>`).join('')}
  `;
  return {
    subject: `[WARRANTY] New registration — ${name} (${regId})`,
    html: emailHtml('New warranty registration', `
      <div class="detail">
        <dt>REGISTRATION ID</dt><dd>${escHtml(regId)}</dd>
        <dt>CUSTOMER</dt><dd>${escHtml(name)} &lt;${escHtml(email)}&gt;</dd>
        <dt>ORDER ID</dt><dd>${escHtml(orderId)}</dd>
        <dt>DATE RECEIVED</dt><dd>${escHtml(receivedDate)}</dd>
        <dt>SUBMITTED</dt><dd>${new Date(submittedAt).toLocaleDateString('en-AU', { day:'numeric', month:'long', year:'numeric' })}</dd>
        ${partsHtml}
        ${notes ? `<dt>NOTES</dt><dd>${escHtml(notes)}</dd>` : ''}
      </div>
    `),
  };
}

function emailGiftCard({ code, balance, customerName }) {
  const name = customerName ? `, ${customerName.split(' ')[0]}` : '';
  return {
    subject: `Your $${balance} Outback Electronics Gift Card`,
    html: emailHtml('Your Gift Card is here!', `
      <p>Thanks${name}! Your Outback Electronics gift card is ready to use.</p>
      <div class="detail" style="text-align:center">
        <dt>YOUR GIFT CARD CODE</dt>
        <dd style="font-family:monospace;font-size:22px;letter-spacing:.15em;color:#1f1a14;margin-top:6px">${code}</dd>
        <dt style="margin-top:14px">VALUE</dt>
        <dd>$${Number(balance).toLocaleString('en-AU', { minimumFractionDigits: 2 })} AUD</dd>
      </div>
      <p>Enter this code at checkout to redeem your balance. It never expires and can be used on anything we sell — products, services, repairs, and more.</p>
      <a class="btn" href="${getSiteUrl()}/shop">Shop now →</a>
      <p style="margin-top:16px;font-size:12px;color:#8b7e69">To check your balance at any time, visit <a href="${getSiteUrl()}/gift-cards" style="color:#1f88f5">${getSiteUrl()}/gift-cards</a> and enter your code.</p>
    `),
  };
}

// ── Stripe helpers ────────────────────────────────────────────────────────────

function getStripeKey() {
  try {
    const s = readSettings();
    const entry = s.integrations.find(r => r[0] === 'Stripe');
    return entry?.[3]?.secretKey || STRIPE_SECRET_KEY;
  } catch { return STRIPE_SECRET_KEY; }
}

function getStripeWebhookSecret() {
  try {
    const s = readSettings();
    const entry = s.integrations.find(r => r[0] === 'Stripe');
    return entry?.[3]?.webhookSecret || STRIPE_WEBHOOK_SECRET;
  } catch { return STRIPE_WEBHOOK_SECRET; }
}

function getAuspostKey() {
  try {
    const s = readSettings();
    const entry = s.integrations.find(r => r[0] === 'AusPost');
    return entry?.[3]?.apiKey || AUSPOST_API_KEY;
  } catch { return AUSPOST_API_KEY; }
}

function auspostTrackingRequest(trackingNumber) {
  const apiKey = getAuspostKey();
  if (!apiKey) return Promise.resolve(null);
  return new Promise((resolve) => {
    const options = {
      hostname: 'digitalapi.auspost.com.au',
      path: `/shipmentsv2/shipments?q=${encodeURIComponent(trackingNumber)}`,
      method: 'GET',
      headers: { 'AUTH-KEY': apiKey },
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', d => { data += d; });
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve(null); }
      });
    });
    req.on('error', () => resolve(null));
    req.setTimeout(8000, () => { req.destroy(); resolve(null); });
    req.end();
  });
}

async function checkOrderTracking(order) {
  if (!order.trackingNumber) return null;
  const resp = await auspostTrackingRequest(order.trackingNumber);
  if (!resp || resp.status !== 200 || !resp.body) return null;
  const shipments = resp.body.shipments || [];
  const shipment = shipments[0];
  if (!shipment) return null;
  const status = (shipment.status || '').toLowerCase();
  const events = (shipment.events || []).map(e => ({ description: e.description, date: e.date, location: e.location }));
  return { status, events, raw: shipment.status };
}

async function pollShippedOrders() {
  const orders = readOrders();
  const shipped = orders.filter(o => o.fulfilment === 'shipped' && o.trackingNumber);
  if (!shipped.length) return;
  let changed = false;
  const nowStr = new Date().toLocaleDateString('en-AU', { day:'2-digit', month:'short', year:'numeric' });
  for (const order of shipped) {
    const tracking = await checkOrderTracking(order);
    if (!tracking) continue;
    const idx = orders.findIndex(o => o.id === order.id);
    if (idx < 0) continue;
    orders[idx] = { ...orders[idx], lastTrackingStatus: tracking.raw, lastTrackingCheck: new Date().toISOString(), trackingEvents: tracking.events };
    if (tracking.status.includes('delivered') || tracking.status.includes('complete')) {
      orders[idx].fulfilment = 'fulfilled';
      changed = true;
      if (order.email) {
        const tmpl = emailOrderDelivered({ orderId: order.id, customerName: order.cust, trackingNumber: order.trackingNumber });
        sendEmail({ to: order.email, ...tmpl }).catch(() => {});
      }
    }
    changed = true;
  }
  if (changed) writeOrders(orders);
}

setInterval(() => { pollShippedOrders().catch(() => {}); }, 2 * 60 * 60 * 1000);

function getShopPostcode() {
  try {
    const s = readSettings();
    const addr = s.shop?.address || '';
    const m = addr.match(/\b(\d{4})\b/);
    return m ? m[1] : '2731';
  } catch { return '2731'; }
}

function getSmtpConfig() {
  try {
    const s = readSettings();
    const entry = s.integrations.find(r => r[0] === 'Email');
    const cfg = entry?.[3] || {};
    return {
      host: cfg.host || SMTP_HOST,
      port: Number(cfg.port || SMTP_PORT),
      user: cfg.user || SMTP_USER,
      pass: cfg.pass || SMTP_PASS,
      notifyEmail: cfg.notifyEmail || NOTIFY_EMAIL,
    };
  } catch { return { host: SMTP_HOST, port: SMTP_PORT, user: SMTP_USER, pass: SMTP_PASS, notifyEmail: NOTIFY_EMAIL }; }
}
function getNotifyEmail() { return getSmtpConfig().notifyEmail; }
function getSiteUrl() {
  try { return readSettings().shop?.siteUrl || SITE_URL; } catch { return SITE_URL; }
}
function getAdminUrl() {
  if (ADMIN_URL) return ADMIN_URL;
  const base = getSiteUrl();
  if (/^https?:\/\/(localhost|127\.|0\.0\.0\.0)(:\d+)?/.test(base))
    return base.replace(/(:\d+)?(\/|$)/, ':8082$2');
  return base.replace(/^(https?:\/\/)/, '$1admin.');
}
function getForumUrl() {
  if (FORUM_URL) return FORUM_URL;
  const base = getSiteUrl();
  // Only use port-substitution for localhost/IP dev URLs; for real domains use subdomain
  if (/^https?:\/\/(localhost|127\.|0\.0\.0\.0)(:\d+)?/.test(base)) {
    return base.replace(/(:\d+)?(\/|$)/, ':8081$2');
  }
  return base.replace(/^(https?:\/\/)/, '$1forum.');
}
function hydrateOrder(o, quotes) {
  const srcQuote = o.sourceQuoteId ? quotes.find(q => q.id === o.sourceQuoteId) : null;
  const dq = srcQuote?.draftQuote || null;
  const parts = (o.parts && o.parts.length > 0) ? o.parts : (dq ? buildPartsFromDraftQuote(dq) : []);
  return { ...o, draftQuote: dq, parts };
}

function buildPartsFromDraftQuote(dq) {
  if (!dq) return [];
  const parts = [];
  for (const item of (dq.hardwareItems || [])) {
    if (!item.name) continue;
    parts.push({ id: item.id || ('p-' + Date.now() + '-' + Math.random().toString(36).slice(2,6)), name: item.name, qty: parseInt(item.qty) || 1, status: 'pending', orderedAt: null, deliveredAt: null, installedAt: null });
  }
  if (dq.pcBuild && dq.pcBuildFee > 0) {
    parts.push({ id: 'p-build', name: 'Custom PC Build (labour)', qty: 1, status: 'pending', orderedAt: null, deliveredAt: null, installedAt: null });
  }
  for (const item of (dq.otherItems || [])) {
    if (!item.description) continue;
    parts.push({ id: item.id || ('p-' + Date.now() + '-' + Math.random().toString(36).slice(2,6)), name: item.description, qty: 1, status: 'pending', orderedAt: null, deliveredAt: null, installedAt: null });
  }
  return parts;
}

function getPortalUrl() {
  const base = getSiteUrl();
  if (process.env.PORTAL_URL) return process.env.PORTAL_URL;
  if (/^https?:\/\/(localhost|127\.|0\.0\.0\.0)(:\d+)?/.test(base))
    return base.replace(/(:\d+)?(\/|$)/, ':8083$2');
  return base.replace(/^(https?:\/\/)/, '$1portal.');
}
function getGamesUrl() {
  if (GAMES_URL) return GAMES_URL;
  const base = getSiteUrl();
  if (/^https?:\/\/(localhost|127\.|0\.0\.0\.0)(:\d+)?/.test(base))
    return base.replace(/(:\d+)?(\/|$)/, ':8084$2');
  return base.replace(/^(https?:\/\/)/, '$1games.');
}
function getAdminUsername() {
  try { return readSettings().security?.adminUsername || ADMIN_USERNAME; } catch { return ADMIN_USERNAME; }
}
function getAdminPasswordHash() {
  try { return readSettings().security?.adminPasswordHash || ADMIN_PASSWORD_HASH; } catch { return ADMIN_PASSWORD_HASH; }
}

function stripeRequest(method, path, params) {
  return new Promise((resolve, reject) => {
    const body = params ? new URLSearchParams(params).toString() : '';
    const req = https.request({
      hostname: 'api.stripe.com',
      path,
      method,
      headers: {
        'Authorization': `Bearer ${getStripeKey()}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(body),
      },
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch { reject(new Error('stripe_parse_error')); }
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function verifyStripeSignature(rawBody, sigHeader, secret) {
  const parts = Object.fromEntries(sigHeader.split(',').map(p => p.split('=')));
  if (!parts.t || !parts.v1) return false;
  const expected = crypto.createHmac('sha256', secret).update(`${parts.t}.${rawBody}`).digest('hex');
  const actualBuf = Buffer.from(parts.v1, 'hex');
  const expectedBuf = Buffer.from(expected, 'hex');
  if (actualBuf.length !== expectedBuf.length) return false;
  return crypto.timingSafeEqual(actualBuf, expectedBuf);
}

// ── Shared customer auth handlers (used by all five servers) ─────────────────
// Single source of truth for register / login / logout / me.
// Any server that needs these just calls the function — no duplicate logic.

async function handleCustomerRegister(req, res) {
  if (publicRateLimited(getIp(req), 'register')) return json(res, 429, { error: 'too_many_requests' });
  let body; try { body = await readJson(req); } catch { return json(res, 400, { error: 'invalid_json' }); }
  if (!body || typeof body !== 'object') return json(res, 422, { error: 'invalid_payload', message: 'Payload must be a JSON object.' });
  const username = typeof body.username === 'string' ? body.username : '';
  const password = typeof body.password === 'string' ? body.password : '';
  const firstName = typeof body.firstName === 'string' ? body.firstName.trim() : '';
  const lastName  = typeof body.lastName  === 'string' ? body.lastName.trim()  : '';
  const email     = typeof body.email     === 'string' ? body.email.trim().toLowerCase() : '';
  const phone     = typeof body.phone     === 'string' ? body.phone.trim()     : '';
  const address   = typeof body.address   === 'string' ? body.address.trim()   : '';
  if (!firstName) return json(res, 422, { error: 'invalid_payload', message: 'First name is required.' });
  if (!lastName)  return json(res, 422, { error: 'invalid_payload', message: 'Last name is required.' });
  if (!email)     return json(res, 422, { error: 'invalid_payload', message: 'Email address is required.' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json(res, 422, { error: 'invalid_payload', message: 'Email address is invalid.' });
  if (!/^[a-zA-Z0-9_]{3,30}$/.test(username)) return json(res, 422, { error: 'invalid_payload', message: 'Username must be 3–30 characters, letters, numbers and underscores only.' });
  if (password.length < 8) return json(res, 422, { error: 'invalid_payload', message: 'Password must be at least 8 characters.' });
  const displayName = `${firstName} ${lastName}`.trim();
  const forum = readForum();
  if (!Array.isArray(forum.users)) forum.users = [];
  if (forum.users.find(u => u.username && u.username.toLowerCase() === username.toLowerCase()))
    return json(res, 409, { error: 'username_taken', message: 'That username is already taken.' });
  if (forum.users.find(u => u.email && u.email === email))
    return json(res, 409, { error: 'email_taken', message: 'An account with that email address already exists.' });
  const user = { id: 'U-' + Date.now(), username, firstName, lastName, displayName, email, phone, address, passwordHash: hashPassword(password), createdAt: new Date().toISOString() };
  forum.users.push(user);
  writeForum(forum);
  grantRewardPoints(email, 50, 'bonus', 'Welcome bonus', `signup-${user.id}`);
  setCustomerSessionCookies(res, user, req);
  sendEmail({ to: email, ...emailPortalWelcome({ username: user.username, displayName: user.displayName }) });
  return json(res, 201, { ok: true, user: { id: user.id, username: user.username, displayName: user.displayName, createdAt: user.createdAt } });
}

async function handleCustomerLogin(req, res) {
  const ip = getIp(req);
  const loginKey = `customer:${ip}`;
  const lockEntry = loginAttempts.get(loginKey);
  if (lockEntry && lockEntry.lockedUntil && lockEntry.lockedUntil > now()) {
    const retryAfterSec = Math.ceil((lockEntry.lockedUntil - now()) / 1000);
    res.setHeader('Retry-After', retryAfterSec);
    return json(res, 429, { error: 'locked_out', retryAfterSec });
  }
  let body; try { body = await readJson(req); } catch { return json(res, 400, { error: 'invalid_json' }); }
  // Accept username, email, or usernameOrEmail field — any server's form will work
  const credential = typeof body?.usernameOrEmail === 'string' ? body.usernameOrEmail.trim()
    : (typeof body?.email === 'string' && body.email.trim() ? body.email.trim()
    : (typeof body?.username === 'string' ? body.username.trim() : ''));
  const password = typeof body?.password === 'string' ? body.password : '';
  if (!credential) return json(res, 422, { error: 'missing_fields', message: 'Username or email is required.' });
  const forum = readForum();
  if (!Array.isArray(forum.users)) forum.users = [];
  const isEmail = credential.includes('@');
  const user = isEmail
    ? forum.users.find(u => u.email && u.email.toLowerCase() === credential.toLowerCase())
    : forum.users.find(u => u.username && u.username.toLowerCase() === credential.toLowerCase());
  if (!user || !user.passwordHash || !verifyPassword(password, user.passwordHash)) {
    trackFailure(loginKey);
    return json(res, 401, { ok: false, message: 'Invalid username/email or password.' });
  }
  clearFailures(loginKey);
  setCustomerSessionCookies(res, user, req);
  return json(res, 200, { ok: true, user: { id: user.id, username: user.username, displayName: user.displayName, createdAt: user.createdAt } });
}

function handleCustomerLogout(req, res) {
  const forumSession  = getForumSession(req);
  const portalSession = getPortalSession(req);
  clearCustomerSessionCookies(res, req, forumSession?.sid, portalSession?.sid);
  return json(res, 200, { ok: true });
}

function handleCustomerMe(req, res) {
  const session = getPortalSession(req) || getForumSession(req);
  if (!session) return json(res, 200, { user: null });
  return json(res, 200, { user: { id: session.id, username: session.username, displayName: session.displayName, createdAt: session.createdAt } });
}

// ── Main server (8080) ────────────────────────────────────────────────────────

const mainServer = http.createServer(async (req, res) => {
  try {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (checkMaintenance(req, res, url)) return;

  if (req.method === 'GET' && url.pathname === '/api/csrf-token') {
    const token = ensureCsrfCookie(req, res);
    return json(res, 200, { token });
  }

  if (['POST', 'PATCH', 'DELETE'].includes(req.method) && url.pathname !== '/api/stripe/webhook') {
    if (!verifyCsrf(req, res)) return;
  }

  if (req.method === 'GET' && url.pathname === '/api/testimonial') {
    const customers = readCustomers();
    const featured = customers.find(c => c.testimonialFeatured && c.testimonial);
    if (!featured) return json(res, 200, { testimonial: null });
    return json(res, 200, { testimonial: { quote: featured.testimonial, name: featured.name, loc: featured.loc } });
  }

  if (req.method === 'GET' && url.pathname === '/api/metrics') {
    const repairs = readRepairs();
    const ewaste = readEwaste();
    const forum = readForum();
    const repairCount = (repairs.columns || []).reduce((sum, col) => sum + ((col.cards || []).length), 0);
    const ewasteTonnes = ewaste.reduce((sum, item) => sum + (Number(item.weightKg) || Number(item.kg) || 0), 0) / 1000;
    const forumMembers = Array.isArray(forum.users) ? forum.users.length : 0;
    const resaleable = ewaste.filter(item => item.tier && item.tier !== 'D').length;
    const resalePercent = ewaste.length > 0 ? Math.round((resaleable / ewaste.length) * 100) : null;
    return json(res, 200, { repairCount, ewasteTonnes, forumMembers, resalePercent });
  }

  if (req.method === 'GET' && url.pathname === '/api/catalog/products') {
    return json(res, 200, { items: readProducts().filter(p => p.status === 'published') });
  }
  if (req.method === 'GET' && url.pathname.startsWith('/api/catalog/products/')) {
    const id = decodeURIComponent(url.pathname.split('/').pop() || '').trim();
    const product = readProducts().find(p => p.id === id && p.status === 'published');
    if (!product) return json(res, 404, { error: 'product_not_found' });
    return json(res, 200, { item: product });
  }
  if (req.method === 'GET' && url.pathname === '/api/catalog/services') {
    return json(res, 200, { items: readServices().filter(s => s.status === 'published') });
  }
  if (req.method === 'GET' && url.pathname.startsWith('/api/catalog/services/')) {
    const id = decodeURIComponent(url.pathname.split('/').pop() || '').trim();
    const service = readServices().find(s => s.id === id && s.status === 'published');
    if (!service) return json(res, 404, { error: 'service_not_found' });
    return json(res, 200, { item: service });
  }
  if (req.method === 'GET' && url.pathname === '/api/catalog/filters') {
    const products = readProducts().filter(p => p.status === 'published');
    const categories = [...new Set(products.map(p => p.category).filter(Boolean))].sort();
    const brands     = [...new Set(products.map(p => p.brand).filter(Boolean))].sort();
    const conditions = [...new Set(products.map(p => p.cond).filter(Boolean))].sort();
    return json(res, 200, { categories, brands, conditions });
  }
  if (req.method === 'GET' && url.pathname === '/api/memberships') {
    const { tiers } = readMemberships();
    return json(res, 200, { items: tiers.filter(t => t.status === 'published') });
  }
  if (req.method === 'GET' && url.pathname === '/api/software') {
    return json(res, 200, { items: readSoftware().filter(i => i.live) });
  }
  if (req.method === 'GET' && url.pathname === '/api/tutorials') {
    const tutorialPortalSession = getPortalSession(req);
    const tutorialUsername = tutorialPortalSession ? tutorialPortalSession.username : null;
    const allTutorials = readTutorials().filter(i => i.status === 'Published');
    const tutorialItems = allTutorials.map(t => {
      if (memberCanAccess(tutorialUsername, t.requiredTierId)) return t;
      // User lacks access — return locked tutorial without body
      const { body: _body, content: _content, ...rest } = t;
      return { ...rest, locked: true };
    });
    return json(res, 200, { items: tutorialItems });
  }
  if (req.method === 'GET' && url.pathname === '/api/ai') {
    return json(res, 200, readAI());
  }
  if (req.method === 'GET' && url.pathname === '/api/groups') {
    const groupPortalSession = getPortalSession(req);
    const groupUsername = groupPortalSession ? groupPortalSession.username : null;
    const groupItems = readGroups().map(g => {
      if (!memberCanAccess(groupUsername, g.requiredTierId)) return { ...g, locked: true };
      return g;
    });
    return json(res, 200, { items: groupItems });
  }
  if (req.method === 'GET' && url.pathname === '/api/policies') {
    return json(res, 200, { items: readPolicies().filter(p => p.status === 'published') });
  }
  if (req.method === 'GET' && url.pathname.startsWith('/api/policies/')) {
    const key = decodeURIComponent(url.pathname.split('/').pop() || '').trim();
    const policy = readPolicies().find(p => p.id === key || normalizePolicySlug(p.slug) === normalizePolicySlug(key));
    if (!policy || policy.status !== 'published') return json(res, 404, { error: 'policy_not_found' });
    return json(res, 200, { item: policy });
  }

  if (req.method === 'GET' && url.pathname === '/api/shop-info') {
    const { shop, flags } = readSettings();
    return json(res, 200, {
      shop,
      flags: flags || {},
      portalUrl: getPortalUrl(),
      forumUrl: getForumUrl(),
      gamesUrl: getGamesUrl(),
    });
  }

  if (req.method === 'GET' && url.pathname === '/api/public-job-log') {
    const repairs = readRepairs();
    const jobs = [];
    for (const col of (repairs.columns || [])) {
      for (const card of (col.cards || [])) {
        if (card.public) {
          jobs.push({ id: card.id || card.jobId || '—', item: card.title || card.item || '—', status: col.title || card.status || '—' });
        }
      }
    }
    return json(res, 200, { jobs: jobs.slice(0, 10) });
  }

  if (req.method === 'GET' && url.pathname === '/api/announcement') {
    const { announcement } = readSettings();
    if (!announcement.enabled) return json(res, 200, { active: false });
    if (announcement.expiresAt) {
      const expires = new Date(announcement.expiresAt);
      if (!isNaN(expires) && expires < new Date()) return json(res, 200, { active: false });
    }
    return json(res, 200, { active: true, text: announcement.text });
  }

  // ── AusPost: shipping quote ──────────────────────────────────────────────────
  if (req.method === 'POST' && url.pathname === '/api/shipping/quote') {
    if (publicRateLimited(getIp(req), 'shipping/quote')) return json(res, 429, { error: 'too_many_requests' });
    let body; try { body = await readJson(req); } catch { return json(res, 400, { error: 'invalid_json' }); }

    const { toPostcode, items } = body;
    if (!toPostcode || !/^\d{4}$/.test(String(toPostcode).trim())) {
      return json(res, 422, { error: 'invalid_postcode', message: 'Please enter a valid 4-digit Australian postcode.' });
    }
    if (!Array.isArray(items) || items.length === 0) {
      return json(res, 422, { error: 'missing_items' });
    }

    const auspostKey = getAuspostKey();
    if (!auspostKey) return json(res, 503, { error: 'auspost_not_configured', message: 'Shipping quotes are not available at this time.' });

    const catalog = readProducts();
    let totalWeightKg = 0;
    let maxLengthCm = 0;
    let maxWidthCm = 0;
    let totalHeightCm = 0;
    let hasPhysical = false;

    for (const li of items) {
      const pid = String(li.productId || '');
      const qty = Math.max(1, Math.floor(Number(li.quantity) || 1));
      const prod = catalog.find(p => p.id === pid);
      if (!prod || prod.digital) continue;
      hasPhysical = true;
      const w = Number(prod.weightKg) || 0.5;
      const l = Number(prod.lengthCm) || 20;
      const ww = Number(prod.widthCm) || 15;
      const h = Number(prod.heightCm) || 10;
      totalWeightKg += w * qty;
      maxLengthCm = Math.max(maxLengthCm, l);
      maxWidthCm = Math.max(maxWidthCm, ww);
      totalHeightCm += h * qty;
    }

    if (!hasPhysical) return json(res, 200, { services: [], digital: true });

    totalWeightKg = Math.max(0.1, totalWeightKg);
    maxLengthCm = Math.max(5, maxLengthCm);
    maxWidthCm = Math.max(5, maxWidthCm);
    totalHeightCm = Math.max(1, totalHeightCm);

    const fromPostcode = getShopPostcode();
    const params = new URLSearchParams({
      from_postcode: fromPostcode,
      to_postcode: String(toPostcode).trim(),
      length: String(Math.ceil(maxLengthCm)),
      width: String(Math.ceil(maxWidthCm)),
      height: String(Math.ceil(totalHeightCm)),
      weight: String(Math.min(22, totalWeightKg).toFixed(3)),
    });

    const auspostResp = await new Promise((resolve) => {
      const options = {
        hostname: 'digitalapi.auspost.com.au',
        path: `/postage/parcel/domestic/service.json?${params}`,
        method: 'GET',
        headers: { 'AUTH-KEY': auspostKey },
      };
      const req2 = https.request(options, (res2) => {
        let data = '';
        res2.on('data', d => { data += d; });
        res2.on('end', () => {
          try { resolve({ status: res2.statusCode, body: JSON.parse(data) }); }
          catch { resolve({ status: res2.statusCode, body: null }); }
        });
      });
      req2.on('error', () => resolve(null));
      req2.setTimeout(8000, () => { req2.destroy(); resolve(null); });
      req2.end();
    });

    if (!auspostResp || auspostResp.status !== 200 || !auspostResp.body) {
      return json(res, 502, { error: 'auspost_error', message: 'Could not retrieve shipping quotes. Please try again.' });
    }

    const rawServices = auspostResp.body?.services?.service || [];
    const services = (Array.isArray(rawServices) ? rawServices : [rawServices])
      .filter(s => s && s.code && s.price)
      .map(s => ({
        code: s.code,
        name: s.name,
        price: parseFloat(s.price),
        maxDays: s.max_extra_cover != null ? undefined : undefined,
        options: undefined,
      }))
      .sort((a, b) => a.price - b.price);

    return json(res, 200, {
      services,
      fromPostcode,
      toPostcode: String(toPostcode).trim(),
      totalWeightKg: parseFloat(totalWeightKg.toFixed(3)),
    });
  }

  // ── Stripe: session lookup (for success page) ───────────────────────────────
  if (req.method === 'GET' && url.pathname === '/api/checkout/session') {
    if (!getStripeKey()) return json(res, 503, { error: 'stripe_not_configured' });
    const sid = url.searchParams.get('id') || '';
    if (!sid.startsWith('cs_')) return json(res, 400, { error: 'invalid_session_id' });
    const resp = await stripeRequest('GET', `/v1/checkout/sessions/${encodeURIComponent(sid)}?expand[]=customer_details`, null).catch(() => null);
    if (!resp || resp.status !== 200) return json(res, 502, { error: 'stripe_error' });
    const s = resp.body;
    return json(res, 200, {
      amountAud: (s.amount_total || 0) / 100,
      customerName: s.customer_details?.name || '',
      customerEmail: s.customer_details?.email || '',
    });
  }

  // ── Stripe: create checkout session ─────────────────────────────────────────
  if (req.method === 'POST' && url.pathname === '/api/checkout') {
    if (publicRateLimited(getIp(req), 'checkout')) return json(res, 429, { error: 'too_many_requests', message: 'Too many requests. Please wait a moment and try again.' });
    if (!getStripeKey()) return json(res, 503, { error: 'stripe_not_configured', message: 'Payment is not configured. Please contact us.' });
    let body; try { body = await readJson(req); } catch { return json(res, 400, { error: 'invalid_json' }); }

    const { productId, name, priceAud, quantity = 1, customerEmail, items, giftCardCode, shippingAmount, shippingService, redeemPoints: redeemPointsBody, rewardsToken: rewardsTokenBody, redeemStoreCredit: redeemStoreCreditBody } = body;

    // Normalise to a line-items array (multi-item cart or legacy single-item)
    const rawLineItems = Array.isArray(items) && items.length > 0
      ? items
      : (name && priceAud ? [{ name, priceAud, quantity, productId: productId || '' }] : null);
    if (!rawLineItems) return json(res, 422, { error: 'missing_fields', message: 'items array or name+priceAud required' });

    // Resolve authoritative server-side prices from the catalog.
    // Client-supplied priceAud is ignored for any item with a recognised productId.
    const catalogProducts = readProducts();
    const catalogServices = readServices();
    const { tiers: membershipTiers } = readMemberships();
    function lookupCatalogPrice(pid, clientPrice) {
      if (!pid) return null;
      const prod = catalogProducts.find(p => p.id === pid && p.status === 'published');
      if (prod) {
        // For variant products, priceAud lives on the variant not the parent.
        // Fall back to client-supplied price (validated against a reasonable cap).
        const price = Number(prod.priceAud) || Number(clientPrice);
        return { priceAud: price, name: prod.name };
      }
      const svc = catalogServices.find(s => s.id === pid && s.status === 'published');
      if (svc) return { priceAud: Number(svc.priceAud) || Number(clientPrice), name: svc.name };
      const tier = membershipTiers.find(t => t.id === pid && t.status === 'published');
      if (tier) return { priceAud: Number(tier.priceAud) || Number(clientPrice), name: tier.name };
      return null;
    }
    const lineItems = [];
    for (const li of rawLineItems) {
      const pid = String(li.productId || '');
      const qty = Math.max(1, Math.floor(Number(li.quantity) || 1));
      if (pid.startsWith('gc-')) {
        // Gift card denominations: price is the chosen denomination value.
        // Look up in catalog; fall back to client value only if not found (admin-created custom GC).
        const catalogEntry = lookupCatalogPrice(pid);
        const resolvedPrice = catalogEntry ? catalogEntry.priceAud : Number(li.priceAud);
        if (!resolvedPrice || resolvedPrice <= 0) return json(res, 422, { error: 'invalid_item', message: `Invalid gift card: ${pid}` });
        lineItems.push({ ...li, priceAud: resolvedPrice, name: li.name || (catalogEntry ? catalogEntry.name : `Gift Card`), quantity: qty, productId: pid });
      } else if (pid) {
        const catalogEntry = lookupCatalogPrice(pid, li.priceAud);
        if (!catalogEntry) return json(res, 422, { error: 'invalid_item', message: `Product not found: ${pid}` });
        const resolvedPrice = Number(catalogEntry.priceAud);
        if (!Number.isFinite(resolvedPrice) || resolvedPrice <= 0) return json(res, 422, { error: 'invalid_item', message: `"${catalogEntry.name}" has no valid price set. Please contact us.` });
        lineItems.push({ ...li, priceAud: resolvedPrice, name: catalogEntry.name, quantity: qty, productId: pid });
      } else {
        // No productId — reject; all purchasable items must be in the catalog.
        return json(res, 422, { error: 'invalid_item', message: 'All cart items must have a valid productId.' });
      }
    }

    // Apply member discount if applicable
    const checkoutPortalSession = getPortalSession(req);
    let memberDiscountPercent = 0;
    let memberDiscountTierName = '';
    if (checkoutPortalSession) {
      const { tiers: mTiers, subscriptions: mSubs } = readMemberships();
      const mSub = (mSubs || []).find(s => s.username === checkoutPortalSession.username && s.status === 'active');
      if (mSub) {
        const mTier = (mTiers || []).find(t => t.id === mSub.tierId);
        if (mTier) {
          memberDiscountPercent = Number(mTier.discountPercent) || 0;
          memberDiscountTierName = mTier.name || '';
        }
      }
    }
    // Only apply discount if cart doesn't consist solely of membership items
    const onlyMembershipItems = lineItems.every(li => membershipTiers.some(t => t.id === li.productId));
    if (memberDiscountPercent > 0 && !onlyMembershipItems) {
      const discountableTotal = lineItems.reduce((s, li) => s + Math.round(Number(li.priceAud) * 100) * (li.quantity || 1), 0) / 100;
      const discountAmount = Math.round(discountableTotal * memberDiscountPercent / 100 * 100) / 100;
      if (discountAmount > 0) {
        lineItems.push({
          name: `Member discount (${memberDiscountPercent}%)`,
          priceAud: -discountAmount,
          quantity: 1,
          productId: '',
          _isMemberDiscount: true,
        });
      }
    }

    // Validate and apply gift card if provided
    // Validate shipping amount (server-side cap to prevent manipulation: max $200)
    const validatedShipping = shippingAmount && Number(shippingAmount) > 0 ? Math.min(200, Number(shippingAmount)) : 0;
    // Travel/callout fee — calculated server-side from reported one-way distance.
    // Fuel: $0.55/km round trip ($110/tank ÷ 400km × 2). Free within 10km.
    // Daily allowance (D > 400km): $150/day, 6h driving/day at ~80km/h = 480km/day; ×2 for return.
    const CALLOUT_FREE_KM = 10;
    const CALLOUT_FUEL_RATE = 220 / 400;  // $0.55/km round trip
    const CALLOUT_KM_PER_DAY = 480;        // 6h × 80km/h
    const CALLOUT_DAILY_RATE = 150;
    const CALLOUT_DAILY_THRESHOLD_KM = 400;
    const CALLOUT_LOCAL_CAP_KM = 200;      // cap for services under $10k
    const CALLOUT_HIVAL_THRESHOLD = 10000; // jobs at or above this go anywhere
    const reportedDistanceKm = Number(body.travelDistanceKm) || 0;
    if (reportedDistanceKm < 0 || reportedDistanceKm > 5000) {
      return json(res, 422, { error: 'invalid_distance', message: 'Invalid distance value.' });
    }
    // Enforce distance cap for lower-value services
    if (reportedDistanceKm > CALLOUT_LOCAL_CAP_KM) {
      // Look up the service being booked to check its value
      const bookedService = rawLineItems && rawLineItems.length === 1
        ? catalogServices.find(s => s.id === rawLineItems[0].productId && s.status === 'published')
        : null;
      const serviceValue = bookedService ? Number(bookedService.priceAud) : 0;
      if (serviceValue < CALLOUT_HIVAL_THRESHOLD) {
        return json(res, 422, {
          error: 'outside_callout_range',
          message: `On-site bookings for this service are limited to ${CALLOUT_LOCAL_CAP_KM}km. For longer distances, please post your device or request a quote.`,
        });
      }
    }
    let validatedTravelFee = 0;
    if (reportedDistanceKm > CALLOUT_FREE_KM) {
      const fuelCost = reportedDistanceKm * CALLOUT_FUEL_RATE;
      const dailyCost = reportedDistanceKm > CALLOUT_DAILY_THRESHOLD_KM
        ? Math.ceil(reportedDistanceKm / CALLOUT_KM_PER_DAY) * 2 * CALLOUT_DAILY_RATE
        : 0;
      validatedTravelFee = Math.round(fuelCost + dailyCost);
    }

    let gcDiscount = 0;
    let gcCodeNorm = '';
    let gcObject = null;
    if (giftCardCode) {
      gcCodeNorm = String(giftCardCode).trim().toUpperCase();
      const gcList = readGiftCards();
      gcObject = gcList.find(c => c.code === gcCodeNorm && !c.isVoid && c.balance > 0);
      if (!gcObject) return json(res, 422, { error: 'invalid_gift_card', message: 'Gift card code is invalid, already used, or has no remaining balance.' });
      const cartTotal = lineItems.reduce((s, li) => s + Math.round(Number(li.priceAud) * 100) * (li.quantity || 1), 0) / 100;
      const orderTotal = cartTotal + validatedShipping;
      gcDiscount = Math.min(gcObject.balance, orderTotal);
    }

    // If gift card covers the entire order, skip Stripe and create order directly
    const cartGross = lineItems.reduce((s, li) => s + Math.round(Number(li.priceAud) * 100) * (li.quantity || 1), 0) / 100;
    const orderGross = cartGross + validatedShipping + validatedTravelFee;

    // Validate rewards token and compute discount (100 pts = $1)
    let rewardsDiscount = 0;
    let validatedRewardsToken = null;
    let rewardsUserId = null;
    const rewardsTokenRaw = typeof rewardsTokenBody === 'string' ? rewardsTokenBody : '';
    const redeemPointsRaw = Math.max(0, Math.floor(Number(redeemPointsBody) || 0));
    if (rewardsTokenRaw && redeemPointsRaw > 0) {
      const tokenData = rewardsTokens.get(rewardsTokenRaw);
      if (tokenData && tokenData.expiresAt > Date.now() && tokenData.points >= redeemPointsRaw) {
        const maxDiscount = Math.max(0, orderGross - gcDiscount);
        const requestedDiscount = redeemPointsRaw / 100;
        rewardsDiscount = Math.min(requestedDiscount, maxDiscount);
        const actualPoints = Math.round(rewardsDiscount * 100);
        if (actualPoints > 0) {
          validatedRewardsToken = rewardsTokenRaw;
          rewardsUserId = tokenData.userId;
        }
      }
    }

    // Validate store-credit token and compute discount (1:1 AUD). Reuses the
    // same rewards token; store credit applies after gift card and points.
    let storeCreditDiscount = 0;
    let storeCreditUserId = null;
    const redeemStoreCreditRaw = roundCents(redeemStoreCreditBody);
    if (rewardsTokenRaw && redeemStoreCreditRaw > 0) {
      const tokenData = rewardsTokens.get(rewardsTokenRaw);
      if (tokenData && tokenData.expiresAt > Date.now() && (tokenData.storeCredit || 0) >= redeemStoreCreditRaw) {
        const maxDiscount = Math.max(0, roundCents(orderGross - gcDiscount - rewardsDiscount));
        storeCreditDiscount = roundCents(Math.min(redeemStoreCreditRaw, maxDiscount));
        if (storeCreditDiscount > 0) storeCreditUserId = tokenData.userId;
      }
    }

    if (gcDiscount >= orderGross && gcObject) {
      // Redeem gift card balance
      const gcList = readGiftCards();
      const gcIdx = gcList.findIndex(c => c.code === gcCodeNorm);
      if (gcIdx >= 0) {
        gcList[gcIdx].balance = Math.max(0, Math.round((gcList[gcIdx].balance - gcDiscount) * 100) / 100);
        gcList[gcIdx].redemptions = [...(gcList[gcIdx].redemptions || []), { orderId: 'pending', amount: gcDiscount, date: new Date().toISOString() }];
        writeGiftCards(gcList);
      }
      const allOrders = readOrders();
      const maxNum = allOrders.reduce((max, o) => { const m = String(o.id || '').match(/^OE-(\d+)$/); return m ? Math.max(max, parseInt(m[1])) : max; }, 1000);
      const newOrderId = `OE-${maxNum + 1}`;
      const gcOnlyOrder = {
        id: newOrderId,
        cust: customerEmail || 'Online customer',
        email: customerEmail || '',
        items: lineItems.map(li => li.name).join(', '),
        total: orderGross,
        date: new Date().toLocaleDateString('en-AU', { day:'2-digit', month:'short', year:'numeric' }),
        fulfilment: 'pending',
        payments: [{ amount: gcDiscount, method: 'Gift Card', note: gcCodeNorm, date: new Date().toLocaleDateString('en-AU', { day:'2-digit', month:'short', year:'numeric' }) }],
      };
      allOrders.push(gcOnlyOrder);
      writeOrders(allOrders);
      // Update gift card redemption with real order ID
      const gcList2 = readGiftCards();
      const gcIdx2 = gcList2.findIndex(c => c.code === gcCodeNorm);
      if (gcIdx2 >= 0) {
        const r = gcList2[gcIdx2].redemptions || [];
        const ri = r.findLastIndex ? r.findLastIndex(x => x.orderId === 'pending') : r.map(x => x.orderId).lastIndexOf('pending');
        if (ri >= 0) gcList2[gcIdx2].redemptions[ri].orderId = newOrderId;
        writeGiftCards(gcList2);
      }
      if (validatedRewardsToken && rewardsUserId) {
        const pts = Math.round(rewardsDiscount * 100);
        if (pts > 0) deductRewardPoints(rewardsUserId, pts, `Order ${newOrderId}`, `redeem-${newOrderId}`);
        rewardsTokens.delete(validatedRewardsToken);
      }
      return json(res, 200, { url: `${getSiteUrl()}/order-success?order_id=${newOrderId}`, sessionId: null, fullyCoveredByGiftCard: true });
    }

    const params = {
      'mode': 'payment',
      'success_url': `${getSiteUrl()}/order-success?session_id={CHECKOUT_SESSION_ID}`,
      'cancel_url': `${getSiteUrl()}/order-cancelled`,
      'payment_intent_data[metadata][source]': 'website',
      'metadata[source]': 'website',
      'shipping_address_collection[allowed_countries][0]': 'AU',
      'phone_number_collection[enabled]': 'true',
    };
    if (gcCodeNorm) {
      params['payment_intent_data[metadata][giftCardCode]'] = gcCodeNorm;
      params['metadata[giftCardCode]'] = gcCodeNorm;
    }
    if (gcDiscount > 0) {
      params['payment_intent_data[metadata][giftCardDiscount]'] = String(gcDiscount);
      params['metadata[giftCardDiscount]'] = String(gcDiscount);
    }

    // Store gift card product IDs so the webhook can issue codes (max 500 chars in metadata)
    const gcProductIds = lineItems
      .filter(li => String(li.productId || '').startsWith('gc-'))
      .flatMap(li => Array(li.quantity || 1).fill(`${li.productId}:${li.priceAud}`));
    if (gcProductIds.length > 0) {
      params['payment_intent_data[metadata][gcItems]'] = gcProductIds.join(',').slice(0, 500);
      params['metadata[gcItems]'] = gcProductIds.join(',').slice(0, 500);
    }

    // Tag membership purchases so the webhook can activate the subscription
    const membershipLineItem = lineItems.find(li => membershipTiers.some(t => t.id === li.productId));
    if (membershipLineItem) {
      params['payment_intent_data[metadata][membershipTierId]'] = membershipLineItem.productId;
      params['metadata[membershipTierId]'] = membershipLineItem.productId;
    }
    // Mirror productId and shipping onto session metadata for webhook access
    if (lineItems.length === 1) params['metadata[productId]'] = lineItems[0].productId || '';
    if (validatedShipping > 0) params['metadata[shippingAmount]'] = String(validatedShipping);
    if (shippingService) params['metadata[shippingService]'] = String(shippingService).slice(0, 80);
    if (rewardsDiscount > 0 && rewardsUserId) {
      const rewardsPtsUsed = Math.round(rewardsDiscount * 100);
      params['metadata[rewardsUserId]'] = rewardsUserId;
      params['metadata[rewardsPoints]'] = String(rewardsPtsUsed);
      params['payment_intent_data[metadata][rewardsUserId]'] = rewardsUserId;
      params['payment_intent_data[metadata][rewardsPoints]'] = String(rewardsPtsUsed);
      rewardsTokens.delete(validatedRewardsToken);
    }
    if (storeCreditDiscount > 0 && storeCreditUserId) {
      params['metadata[storeCreditUserId]'] = storeCreditUserId;
      params['metadata[storeCreditAmount]'] = String(storeCreditDiscount);
      params['payment_intent_data[metadata][storeCreditUserId]'] = storeCreditUserId;
      params['payment_intent_data[metadata][storeCreditAmount]'] = String(storeCreditDiscount);
    }
    const shippingServiceName = shippingService ? String(shippingService).slice(0, 80) : '';

    // Build line items; if a gift card covers the full amount, add a $0.50 minimum line item
    // so Stripe doesn't reject a $0 session — instead we add a discount coupon approach via negative line item
    const adjustedLineItems = [...lineItems];
    if (validatedShipping > 0) {
      adjustedLineItems.push({
        name: shippingServiceName || 'Shipping',
        priceAud: validatedShipping,
        quantity: 1,
        productId: '',
      });
    }
    if (validatedTravelFee > 0) {
      adjustedLineItems.push({ name: 'Callout / Travel Fee', priceAud: validatedTravelFee, quantity: 1, productId: '' });
    }
    if (gcDiscount > 0) {
      adjustedLineItems.push({
        name: `Gift Card (${gcCodeNorm})`,
        priceAud: -gcDiscount,
        quantity: 1,
        productId: '',
      });
    }
    if (rewardsDiscount > 0) {
      adjustedLineItems.push({
        name: `Rewards Points (${Math.round(rewardsDiscount * 100)} pts)`,
        priceAud: -rewardsDiscount,
        quantity: 1,
        productId: '',
        _isRewardsDiscount: true,
      });
    }
    if (storeCreditDiscount > 0) {
      adjustedLineItems.push({
        name: `Store Credit (−$${storeCreditDiscount.toFixed(2)})`,
        priceAud: -storeCreditDiscount,
        quantity: 1,
        productId: '',
        _isStoreCreditDiscount: true,
      });
    }
    // Add member discount metadata to Stripe
    const memberDiscountItem = lineItems.find(li => li._isMemberDiscount);
    if (memberDiscountItem) {
      const memberDiscountAmt = Math.abs(memberDiscountItem.priceAud);
      params['payment_intent_data[metadata][memberDiscount]'] = String(memberDiscountAmt);
      params['metadata[memberDiscount]'] = String(memberDiscountAmt);
      if (memberDiscountTierName) {
        params['payment_intent_data[metadata][memberDiscountTier]'] = memberDiscountTierName;
        params['metadata[memberDiscountTier]'] = memberDiscountTierName;
      }
    }

    // Stripe doesn't support negative unit_amount; use a free line item workaround:
    // we compute net total and replace all line items with a single "Order total" line when a GC or member discount is applied
    let finalLineItems = adjustedLineItems;
    const hasMemberDiscount = memberDiscountItem && Math.abs(memberDiscountItem.priceAud) > 0;
    if (gcDiscount > 0 || hasMemberDiscount || rewardsDiscount > 0) {
      const productCents = lineItems.filter(li => !li._isMemberDiscount).reduce((s, li) => s + Math.round(Number(li.priceAud) * 100) * (li.quantity || 1), 0);
      const shippingCents = Math.round(validatedShipping * 100);
      const memberDiscountCents = hasMemberDiscount ? Math.round(Math.abs(memberDiscountItem.priceAud) * 100) : 0;
      const rewardsCents = Math.round(rewardsDiscount * 100);
      const netCents = Math.max(50, productCents + shippingCents - Math.round(gcDiscount * 100) - memberDiscountCents - rewardsCents); // Stripe min 50c
      const nonDiscountItems = lineItems.filter(li => !li._isMemberDiscount);
      finalLineItems = [{ name: 'Outback Electronics Order', priceAud: netCents / 100, quantity: 1, productId: nonDiscountItems.length === 1 ? (nonDiscountItems[0].productId || '') : '' }];
    }

    finalLineItems.forEach((li, idx) => {
      const unitAmount = Math.round(Number(li.priceAud) * 100);
      if (!Number.isFinite(unitAmount) || unitAmount < 0) {
        throw new Error(`Invalid price for item "${li.name}": ${li.priceAud}`);
      }
      params[`line_items[${idx}][price_data][currency]`] = 'aud';
      params[`line_items[${idx}][price_data][unit_amount]`] = String(unitAmount);
      params[`line_items[${idx}][price_data][product_data][name]`] = li.name;
      params[`line_items[${idx}][quantity]`] = String(li.quantity || 1);
    });
    if (lineItems.length === 1) params['payment_intent_data[metadata][productId]'] = lineItems[0].productId || '';
    if (validatedShipping > 0) params['payment_intent_data[metadata][shippingAmount]'] = String(validatedShipping);
    if (shippingServiceName) params['payment_intent_data[metadata][shippingService]'] = shippingServiceName;
    if (customerEmail) params['customer_email'] = customerEmail;

    let resp;
    try { resp = await stripeRequest('POST', '/v1/checkout/sessions', params); }
    catch (err) {
      console.error('[checkout] stripeRequest threw:', err);
      return json(res, 502, { error: 'stripe_error', message: 'Payment provider unreachable. Please try again.' });
    }
    if (!resp || resp.status !== 200) {
      const stripeMsg = resp?.body?.error?.message || '';
      console.error('[checkout] Stripe error response:', resp?.status, stripeMsg);
      return json(res, 502, { error: 'stripe_error', message: stripeMsg || 'Payment provider error. Please try again.' });
    }
    return json(res, 200, { url: resp.body.url, sessionId: resp.body.id });
  }

  // ── Stripe: webhook ──────────────────────────────────────────────────────────
  if (req.method === 'POST' && url.pathname === '/api/stripe/webhook') {
    const stripeWebhookSecret = getStripeWebhookSecret();
    const sig = req.headers['stripe-signature'];
    if (!sig || !stripeWebhookSecret) return json(res, 400, { error: 'missing_signature' });

    const rawBody = await readRawBody(req);
    let valid = false;
    try { valid = verifyStripeSignature(rawBody, sig, stripeWebhookSecret); } catch (err) {
      console.error('Stripe signature verification error:', err);
    }
    if (!valid) return json(res, 400, { error: 'invalid_signature' });

    let event;
    try { event = JSON.parse(rawBody.toString()); } catch { return json(res, 400, { error: 'invalid_json' }); }

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const details = session.customer_details || {};
      const amountAud = (session.amount_total || 0) / 100;
      const meta = session.metadata || {};
      const productId = meta.productId || '';
      const gcCode = meta.giftCardCode || '';
      const gcDiscount = Number(meta.giftCardDiscount || 0);

      const existingOrders = readOrders();
      const maxNum = existingOrders.reduce((max, o) => {
        const m = String(o.id || '').match(/^OE-(\d+)$/);
        return m ? Math.max(max, parseInt(m[1])) : max;
      }, 1000);
      const shippingDetails = session.shipping_details || session.shipping || {};
      const shipAddr = shippingDetails.address || details.address || {};
      const shippingAddress = [
        shippingDetails.name || details.name || '',
        shipAddr.line1 || '',
        shipAddr.line2 || '',
        [shipAddr.city, shipAddr.state, shipAddr.postal_code].filter(Boolean).join(' '),
        shipAddr.country || '',
      ].filter(Boolean).join(', ');
      const order = {
        id: `OE-${maxNum + 1}`,
        stripeSessionId: session.id,
        stripePaymentIntent: session.payment_intent || '',
        cust: details.name || details.email || 'Online customer',
        email: details.email || '',
        phone: details.phone || '',
        loc: [shipAddr.city, shipAddr.state].filter(Boolean).join(', ') || [details.address?.city, details.address?.country].filter(Boolean).join(', ') || '',
        shippingAddress,
        items: productId || 'Online order',
        total: amountAud + gcDiscount,
        date: new Date().toLocaleDateString('en-AU', { day: '2-digit', month: '2-digit', year: 'numeric' }),
        fulfilment: 'pending',
        payments: [{
          amount: amountAud,
          method: 'Stripe',
          note: `Session ${session.id}`,
          date: new Date().toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' }),
        }],
      };
      if (gcCode && gcDiscount > 0) {
        order.payments.push({
          amount: gcDiscount,
          method: 'Gift Card',
          note: gcCode,
          date: new Date().toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' }),
        });
      }

      const orders = readOrders();
      const existingOrderId = meta.existingOrderId || '';
      const existingIdx = existingOrderId ? orders.findIndex(o => o.id === existingOrderId) : orders.findIndex(o => o.stripeSessionId === session.id);
      if (existingIdx >= 0 && existingOrderId) {
        // Payment for a pre-existing order (e.g. from accepted quote)
        const existing = orders[existingIdx];
        const payment = { amount: amountAud, method: 'Stripe', note: `Session ${session.id}`, date: new Date().toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' }) };
        orders[existingIdx] = { ...existing, stripeSessionId: session.id, payments: [...(existing.payments || []), payment] };
        writeOrders(orders);
        // Credit seller for existing-order payment path
        const existingProductId = meta.productId || '';
        if (existingProductId) {
          const prod = readProducts().find(p => p.id === existingProductId);
          if (prod && prod.createdBy && prod.sellerPrice != null) {
            const txns = readSellerLedger();
            txns.push({
              id: 'txn-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
              sellerId: prod.createdBy,
              type: 'sale_credit',
              amount: prod.sellerPrice,
              description: `Sale: ${prod.name || existingProductId}`,
              date: new Date().toISOString(),
              orderId: existing.id,
              status: 'ok',
            });
            writeSellerLedger(txns);
          }
        }
        const customerEmail = existing.email || details.email;
        if (customerEmail) {
          const tmpl = emailOrderConfirmation({ orderId: existing.id, customerName: existing.cust || details.name, amountAud, items: existing.items });
          sendEmail({ to: customerEmail, ...tmpl });
        }
        const staffTmpl = emailStaffNewOrder({ orderId: existing.id, customerName: existing.cust || details.name || details.email, amountAud, items: existing.items });
        sendEmail({ to: getNotifyEmail(), ...staffTmpl });
      } else if (!orders.find(o => o.stripeSessionId === session.id)) {
        orders.push(order);
        writeOrders(orders);

        // Credit seller if this product was listed by a seller
        if (productId) {
          const prod = readProducts().find(p => p.id === productId);
          if (prod && prod.createdBy && prod.sellerPrice != null) {
            const txns = readSellerLedger();
            txns.push({
              id: 'txn-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
              sellerId: prod.createdBy,
              type: 'sale_credit',
              amount: prod.sellerPrice,
              description: `Sale: ${prod.name || productId}`,
              date: new Date().toISOString(),
              orderId: order.id,
              status: 'ok',
            });
            writeSellerLedger(txns);
          }
        }

        // Deduct rewards points if redeemed at checkout
        const rewardsUserId = meta.rewardsUserId || '';
        const rewardsPoints = Math.floor(Number(meta.rewardsPoints || 0));
        if (rewardsUserId && rewardsPoints > 0) {
          deductRewardPoints(rewardsUserId, rewardsPoints, `Order ${order.id}`, `redeem-${order.id}`);
        }

        // Deduct store credit if redeemed at checkout
        const storeCreditUserId = meta.storeCreditUserId || '';
        const storeCreditAmount = roundCents(meta.storeCreditAmount);
        if (storeCreditUserId && storeCreditAmount > 0) {
          deductStoreCredit(storeCreditUserId, storeCreditAmount, `Order ${order.id}`, `redeem-${order.id}`);
        }

        // Deduct gift card balance
        if (gcCode && gcDiscount > 0) {
          const gcList = readGiftCards();
          const gc = gcList.find(c => c.code === gcCode);
          if (gc) {
            gc.balance = Math.max(0, gc.balance - gcDiscount);
            gc.redemptions = gc.redemptions || [];
            gc.redemptions.push({ orderId: order.id, amount: gcDiscount, date: new Date().toISOString() });
            writeGiftCards(gcList);
          }
        }

        // Issue gift cards for any gc- items purchased
        const gcItemsMeta = meta.gcItems || '';
        const gcLineItems = gcItemsMeta
          ? gcItemsMeta.split(',').map(entry => {
              const [pid, price] = entry.split(':');
              return { productId: pid, priceAud: Number(price) || 0, quantity: 1 };
            }).filter(li => li.productId.startsWith('gc-'))
          : (productId.startsWith('gc-') ? [{ productId, priceAud: amountAud + gcDiscount, quantity: 1 }] : []);
        issueGiftCards(gcLineItems, order.id, details.email, details.name);

        // Activate membership subscription if this was a membership purchase
        const membershipTierId = meta.membershipTierId || '';
        if (membershipTierId && details.email) {
          const mb = readMemberships();
          const tier = mb.tiers.find(t => t.id === membershipTierId);
          if (tier) {
            const forum = readForum();
            const user = (forum.users || []).find(u => u.email && u.email.toLowerCase() === details.email.toLowerCase());
            if (user) {
              // Cancel any existing active subscription first
              mb.subscriptions = mb.subscriptions.map(s =>
                s.username === user.username && s.status === 'active'
                  ? { ...s, status: 'cancelled', cancelledAt: new Date().toISOString(), cancelReason: 'replaced_by_new_purchase' }
                  : s
              );
              mb.subscriptions.push({
                id: 'sub-' + Date.now(),
                username: user.username,
                tierId: membershipTierId,
                startDate: new Date().toISOString(),
                status: 'active',
                orderId: order.id,
              });
              writeMemberships(mb);
              const tmpl = emailMembershipWelcome({ customerName: user.displayName || user.username, tierName: tier.name });
              sendEmail({ to: user.email, ...tmpl });
            } else {
              // No portal account yet — tag the order so admin can activate manually
              order.pendingMembershipActivation = { tierId: membershipTierId, email: details.email };
              const updatedOrders = readOrders();
              const idx = updatedOrders.findIndex(o => o.stripeSessionId === session.id);
              if (idx >= 0) { updatedOrders[idx] = order; writeOrders(updatedOrders); }
            }
          }
        }

        const customerEmail = details.email;
        if (customerEmail) {
          const tmpl = emailOrderConfirmation({ orderId: order.id, customerName: details.name, amountAud: order.total, items: order.items });
          sendEmail({ to: customerEmail, ...tmpl });
        }
        const staffTmpl = emailStaffNewOrder({ orderId: order.id, customerName: details.name || details.email, amountAud: order.total, items: order.items });
        sendEmail({ to: getNotifyEmail(), ...staffTmpl });
      }
    }

    return json(res, 200, { received: true });
  }

  // ── Gift card: denominations (public) ────────────────────────────────────────
  if (req.method === 'GET' && url.pathname === '/api/shop/gift-card-denominations') {
    return json(res, 200, { items: readDenominations().filter(d => d.status === 'published') });
  }

// ── Gift card: balance lookup ────────────────────────────────────────────────
  if (req.method === 'GET' && url.pathname === '/api/gift-card/balance') {
    if (publicRateLimited(getIp(req), 'gift-card/balance')) return json(res, 429, { error: 'too_many_requests' });
    const code = (url.searchParams.get('code') || '').trim().toUpperCase();
    if (!code) return json(res, 400, { error: 'missing_code' });
    const gc = readGiftCards().find(c => c.code === code);
    if (!gc) return json(res, 404, { error: 'not_found' });
    if (gc.isVoid) return json(res, 200, { code: gc.code, balance: 0, originalBalance: gc.originalBalance, isVoid: true });
    return json(res, 200, { code: gc.code, balance: gc.balance, originalBalance: gc.originalBalance, isVoid: false });
  }

  // ── Gift card: apply (validate + preview discount) ───────────────────────────
  if (req.method === 'POST' && url.pathname === '/api/gift-card/apply') {
    if (publicRateLimited(getIp(req), 'gift-card/apply')) return json(res, 429, { error: 'too_many_requests' });
    let body; try { body = await readJson(req); } catch { return json(res, 400, { error: 'invalid_json' }); }
    const code = (body.code || '').trim().toUpperCase();
    const cartTotal = Number(body.cartTotal) || 0;
    if (!code) return json(res, 400, { error: 'missing_code' });
    const gc = readGiftCards().find(c => c.code === code && !c.isVoid && c.balance > 0);
    if (!gc) return json(res, 422, { error: 'invalid_gift_card', message: 'Gift card code is invalid, already used, or has no remaining balance.' });
    const discount = cartTotal > 0 ? Math.min(gc.balance, cartTotal) : gc.balance;
    return json(res, 200, { valid: true, code: gc.code, balance: gc.balance, discount });
  }

  // ── Shared carts ─────────────────────────────────────────────────────────────
  if (req.method === 'POST' && url.pathname === '/api/cart/save') {
    let body; try { body = await readJson(req); } catch { return json(res, 400, { error: 'invalid_json' }); }
    if (!Array.isArray(body.items) || body.items.length === 0) return json(res, 422, { error: 'empty_cart' });
    const id = crypto.randomBytes(4).toString('hex'); // 8-char hex
    const expiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000; // 30 days
    const items = body.items.map(i => ({
      id: i.id || '', sku: i.sku || '', name: String(i.name || '').slice(0, 200),
      price: Number(i.price) || 0, qty: Math.max(1, Math.floor(Number(i.qty) || 1)),
      cond: i.cond || '',
    }));
    const carts = readCarts().filter(c => c.expiresAt > Date.now());
    carts.push({ id, items, expiresAt });
    writeCarts(carts);
    return json(res, 200, { id });
  }

  if (req.method === 'GET' && url.pathname.startsWith('/api/cart/')) {
    const id = url.pathname.split('/api/cart/')[1];
    if (!id || !/^[0-9a-f]{8}$/.test(id)) return json(res, 404, { error: 'not_found' });
    const cart = readCarts().find(c => c.id === id && c.expiresAt > Date.now());
    if (!cart) return json(res, 404, { error: 'not_found' });
    return json(res, 200, { items: cart.items });
  }

  // ── Contact quick-message ────────────────────────────────────────────────────
  if (req.method === 'POST' && url.pathname === '/api/quote/request') {
    if (publicRateLimited(getIp(req), 'quote/request')) return json(res, 429, { error: 'too_many_requests' });
    let body; try { body = await readJson(req); } catch { return json(res, 400, { error: 'invalid_json' }); }
    const { name, email, loc, kind, budget, urgency, desc } = body || {};
    if (!name || !email || !desc) return json(res, 422, { error: 'missing_fields' });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim())) return json(res, 422, { error: 'invalid_email', message: 'Email address is invalid.' });
    if (String(desc).trim().length > 2000) return json(res, 422, { error: 'description_too_long', message: 'Description must be 2000 characters or fewer.' });
    const quotes = readQuotes();
    const quote = {
      id: 'quot-' + Date.now(),
      name: String(name).trim(),
      email: String(email).trim(),
      loc: String(loc || '').trim(),
      kind: String(kind || '').trim(),
      budget: String(budget || '').trim(),
      urgency: String(urgency || '').trim(),
      description: String(desc).trim(),
      status: 'new',
      createdAt: new Date().toISOString(),
    };
    quotes.push(quote);
    writeQuotes(quotes);
    const custTmpl = emailQuoteReceived({ quoteId: quote.id, customerName: quote.name, description: quote.description });
    sendEmail({ to: quote.email, ...custTmpl });
    const staffTmpl = emailStaffNewQuote({ quoteId: quote.id, name: quote.name, email: quote.email, description: `[${quote.kind} · ${quote.budget} · ${quote.urgency}] ${quote.description}` });
    sendEmail({ to: getNotifyEmail(), ...staffTmpl });
    return json(res, 201, { ok: true, id: quote.id });
  }

  if (req.method === 'GET' && url.pathname === '/api/warranty/order-lookup') {
    const orderId = (url.searchParams.get('id') || '').trim();
    if (!orderId) return json(res, 400, { error: 'missing_id' });
    const orders = readOrders();
    const order = orders.find(o => o.id === orderId);
    if (!order) return json(res, 404, { found: false });
    const expenses = readExpenses().filter(e => e.jobId === order.id);
    return json(res, 200, {
      found: true,
      order: { id: order.id, date: order.date },
      expenses: expenses.map(e => ({ description: e.description, isSecondHand: !!e.isSecondHand, category: e.category || 'parts' })),
    });
  }

  if (req.method === 'POST' && url.pathname === '/api/warranty/register') {
    if (publicRateLimited(getIp(req), 'warranty/register')) return json(res, 429, { error: 'too_many_requests' });
    let body; try { body = await readJson(req); } catch { return json(res, 400, { error: 'invalid_json' }); }
    const { name, email, orderId, receivedDate, expenses, notes } = body || {};
    if (!name || !email || !orderId || !receivedDate) return json(res, 422, { error: 'missing_fields', message: 'Name, email, order ID, and date received are required.' });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim())) return json(res, 422, { error: 'invalid_email', message: 'Email address is invalid.' });
    const safeExpenses = Array.isArray(expenses) ? expenses.slice(0, 100).map(e => ({ description: String(e.description || '').trim().slice(0, 200), isSecondHand: !!e.isSecondHand })) : [];
    const submittedAt = new Date().toISOString();
    const regId = 'wrnt-' + Date.now();
    const custTmpl = emailWarrantyConfirmation({ regId, customerName: String(name).trim(), orderId: String(orderId).trim(), receivedDate: String(receivedDate).trim(), submittedAt, expenses: safeExpenses });
    sendEmail({ to: String(email).trim(), ...custTmpl });
    const staffTmpl = emailStaffWarrantyRegistration({ regId, name: String(name).trim(), email: String(email).trim(), orderId: String(orderId).trim(), receivedDate: String(receivedDate).trim(), submittedAt, expenses: safeExpenses, notes: String(notes || '').trim() });
    sendEmail({ to: getNotifyEmail(), ...staffTmpl });
    return json(res, 201, { ok: true, id: regId });
  }

  if (req.method === 'POST' && url.pathname === '/api/contact/quick-message') {
    if (publicRateLimited(getIp(req), 'contact/quick-message')) return json(res, 429, { error: 'too_many_requests' });
    let body; try { body = await readJson(req); } catch { return json(res, 400, { error: 'invalid_json' }); }
    const { name, email, msg } = body || {};
    if (!name || !email || !msg) return json(res, 422, { error: 'missing_fields' });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim())) return json(res, 422, { error: 'invalid_email', message: 'Email address is invalid.' });
    const tmpl = emailStaffContactMessage({ name, email, msg });
    sendEmail({ to: getNotifyEmail(), replyTo: email, ...tmpl });
    return json(res, 200, { ok: true });
  }

  if (req.method === 'GET' && url.pathname === '/api/settings') {
    const s = readSettings();
    const stripeIntegration = (s.integrations || []).find(r => r[0] === 'Stripe');
    const stripePublishableKey = (stripeIntegration && stripeIntegration[3] && stripeIntegration[3].publishableKey) || STRIPE_PUBLISHABLE_KEY || '';
    return json(res, 200, { siteContent: s.siteContent, stripePublishableKey });
  }

  if (req.method === 'GET' && url.pathname === '/api/forum/recent') {
    const forum = readForum();
    const threads = Array.isArray(forum.threads) ? forum.threads : [];
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    let recent = threads.filter(t => new Date(t.createdAt).getTime() >= cutoff);
    if (recent.length === 0) recent = threads.slice(0, 4);
    else recent = recent.slice(0, 4);
    return json(res, 200, { threads: recent.map(t => ({ id: t.id, title: t.title, cat: t.cat, replies: t.replies || 0 })) });
  }

  // Inject per-route OG tags for social crawlers (Facebook, Slack, iMessage, etc.)
  if (req.method === 'GET') {
    const og = resolveOgTags(url.pathname);
    if (og) return serveIndexWithOg(res, og);
  }

  // ── Universal customer auth (same endpoints on every server) ─────────────────
  if (req.method === 'GET'  && url.pathname === '/api/auth/me')       return handleCustomerMe(req, res);
  if (req.method === 'POST' && url.pathname === '/api/auth/register') return handleCustomerRegister(req, res);
  if (req.method === 'POST' && url.pathname === '/api/auth/login')    return handleCustomerLogin(req, res);
  if (req.method === 'POST' && url.pathname === '/api/auth/logout')   return handleCustomerLogout(req, res);

  // ── Rewards: return balance for already-logged-in portal session ─────────────
  if (req.method === 'GET' && url.pathname === '/api/rewards/me') {
    const session = getPortalSession(req);
    if (!session) return json(res, 200, { loggedIn: false });
    const db = readRewards();
    const entry = db.entries.find(e => e.userId === session.id);
    const points = entry ? entry.points : 0;
    const scEntry = readStoreCredits().entries.find(e => e.userId === session.id);
    const storeCredit = scEntry ? scEntry.balance : 0;
    const token = randomId();
    for (const [k, v] of rewardsTokens) { if (v.expiresAt < Date.now()) rewardsTokens.delete(k); }
    rewardsTokens.set(token, { email: '', userId: session.id, points, storeCredit, expiresAt: Date.now() + 30 * 60 * 1000 });
    return json(res, 200, { loggedIn: true, points, storeCredit, token, displayName: session.displayName || session.username });
  }

  // ── Rewards: verify account credentials and return points balance + token ────
  if (req.method === 'POST' && url.pathname === '/api/rewards/lookup') {
    if (publicRateLimited(getIp(req), 'register')) return json(res, 429, { error: 'too_many_requests' });
    let body; try { body = await readJson(req); } catch { return json(res, 400, { error: 'invalid_json' }); }
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const password = typeof body.password === 'string' ? body.password : '';
    if (!email || !password) return json(res, 422, { error: 'missing_fields', message: 'Email and password are required.' });
    const forum = readForum();
    const user = Array.isArray(forum.users) ? forum.users.find(u => String(u.email || '').toLowerCase() === email) : null;
    if (!user || !user.passwordHash || !verifyPassword(password, user.passwordHash)) {
      return json(res, 401, { error: 'invalid_credentials', message: 'Email or password is incorrect.' });
    }
    const db = readRewards();
    const entry = db.entries.find(e => e.userId === user.id);
    const points = entry ? entry.points : 0;
    const scEntry = readStoreCredits().entries.find(e => e.userId === user.id);
    const storeCredit = scEntry ? scEntry.balance : 0;
    const token = randomId();
    for (const [k, v] of rewardsTokens) { if (v.expiresAt < Date.now()) rewardsTokens.delete(k); }
    rewardsTokens.set(token, { email, userId: user.id, points, storeCredit, expiresAt: Date.now() + 30 * 60 * 1000 });
    setCustomerSessionCookies(res, user, req);
    return json(res, 200, { ok: true, points, storeCredit, token, displayName: user.displayName || user.username });
  }

  return serveStatic(req, res, url.pathname, '/dist/index.html', MAIN_SPA_ROUTES);
  } catch (err) {
    console.error('[mainServer] unhandled error:', err);
    if (!res.headersSent) json(res, 500, { error: 'server_error', message: 'An unexpected error occurred.' });
  }
});

// ── Forum server (8081) ───────────────────────────────────────────────────────

const forumServer = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (checkMaintenance(req, res, url)) return;

  if (req.method === 'GET' && url.pathname === '/api/csrf-token') {
    const token = ensureCsrfCookie(req, res);
    return json(res, 200, { token });
  }

  if (req.method === 'POST' || req.method === 'PATCH') {
    if (!verifyCsrf(req, res)) return;
  }

  if (req.method === 'GET' && url.pathname === '/api/forum') {
    const forum = readForum();
    return json(res, 200, {
      threads: Array.isArray(forum.threads) ? forum.threads : [],
      categories: Array.isArray(forum.categories) ? forum.categories : [],
      conduct: typeof forum.conduct === 'string' ? forum.conduct : '',
    });
  }

  if (req.method === 'POST' && url.pathname === '/api/forum/threads') {
    const forumSession = getForumSession(req);
    if (!forumSession) return json(res, 401, { error: 'login_required' });
    const body = await parseForumPayload(res, req, (value) => {
      if (!value || typeof value !== 'object') return 'Payload must be a JSON object.';
      if (!value.title || typeof value.title !== 'string' || !value.title.trim()) return 'Field "title" is required.';
      if (!value.body || typeof value.body !== 'string' || !value.body.trim()) return 'Field "body" is required.';
      if (value.title.trim().length > 200) return 'Title must be 200 characters or fewer.';
      if (value.body.trim().length > 10000) return 'Body must be 10,000 characters or fewer.';
      return null;
    });
    if (!body) return;
    const forum = readForum();
    if (!Array.isArray(forum.posts)) forum.posts = [];
    const threadId = 'T-' + Date.now();
    const thread = {
      id: threadId,
      title: body.title.trim(),
      cat: typeof body.cat === 'string' ? body.cat.trim() : '',
      author: forumSession.username,
      replies: 0, views: 0, likes: 0, activityHours: 0,
      pinned: false, hot: false, staff: false, locked: false, solved: false, solvedPostId: null,
      createdAt: new Date().toISOString(),
    };
    const firstPost = {
      id: 'P-' + Date.now(), threadId, author: forumSession.username,
      body: body.body.trim(), createdAt: new Date().toISOString(), likes: 0, likedBy: [], number: 1,
    };
    forum.threads.unshift(thread);
    forum.posts.push(firstPost);
    writeForum(forum);
    return json(res, 201, { ok: true, thread });
  }

  if (req.method === 'GET' && url.pathname.startsWith('/api/forum/threads/') && url.pathname.split('/').length === 5) {
    const threadId = url.pathname.split('/')[4];
    const forum = readForum();
    if (!Array.isArray(forum.posts)) forum.posts = [];
    const thread = (forum.threads || []).find(t => t.id === threadId);
    if (!thread) return json(res, 404, { error: 'Thread not found.' });
    thread.views = (thread.views || 0) + 1;
    writeForum(forum);
    // Enrich posts with member tier badge
    const { tiers: mbTiers, subscriptions: mbSubs } = readMemberships();
    const memberTierMap = {};
    for (const sub of mbSubs) {
      if (sub.status === 'active') {
        const t = mbTiers.find(t => t.id === sub.tierId);
        if (t) memberTierMap[sub.username] = t.name;
      }
    }
    const enrichedPosts = forum.posts.filter(p => p.threadId === threadId).map(p => ({
      ...p,
      memberTier: memberTierMap[p.author] || null,
    }));
    return json(res, 200, { thread, posts: enrichedPosts });
  }

  if (req.method === 'POST' && url.pathname.startsWith('/api/forum/threads/') && url.pathname.split('/').length === 6 && url.pathname.split('/')[5] === 'posts') {
    const forumSession = getForumSession(req);
    if (!forumSession) return json(res, 401, { error: 'login_required' });
    const threadId = url.pathname.split('/')[4];
    const body = await parseForumPayload(res, req, (value) => {
      if (!value || typeof value !== 'object') return 'Payload must be a JSON object.';
      if (!value.body || typeof value.body !== 'string' || !value.body.trim()) return 'Field "body" is required.';
      if (value.body.trim().length > 10000) return 'Body must be 10000 characters or fewer.';
      return null;
    });
    if (!body) return;
    const forum = readForum();
    if (!Array.isArray(forum.posts)) forum.posts = [];
    const thread = (forum.threads || []).find(t => t.id === threadId);
    if (!thread) return json(res, 404, { error: 'Thread not found.' });
    if (thread.locked) return json(res, 404, { error: 'Thread is locked.' });
    const threadPosts = forum.posts.filter(p => p.threadId === threadId);
    const post = {
      id: 'P-' + Date.now(), threadId, author: forumSession.username,
      body: body.body.trim(), createdAt: new Date().toISOString(), likes: 0, likedBy: [],
      number: threadPosts.length + 1,
    };
    thread.replies = (thread.replies || 0) + 1;
    thread.activityHours = 0;
    forum.posts.push(post);
    writeForum(forum);
    return json(res, 201, { ok: true, post });
  }

  if (req.method === 'POST' && url.pathname.startsWith('/api/forum/posts/') && url.pathname.split('/').length === 6 && url.pathname.split('/')[5] === 'like') {
    const forumSession = getForumSession(req);
    if (!forumSession) return json(res, 401, { error: 'login_required' });
    const postId = url.pathname.split('/')[4];
    const forum = readForum();
    if (!Array.isArray(forum.posts)) forum.posts = [];
    const post = forum.posts.find(p => p.id === postId);
    if (!post) return json(res, 404, { error: 'Post not found.' });
    if (!Array.isArray(post.likedBy)) post.likedBy = [];
    const author = forumSession.username;
    let liked;
    if (post.likedBy.includes(author)) {
      post.likedBy = post.likedBy.filter(a => a !== author);
      post.likes = Math.max(0, (post.likes || 0) - 1); liked = false;
    } else {
      post.likedBy.push(author); post.likes = (post.likes || 0) + 1; liked = true;
    }
    writeForum(forum);
    return json(res, 200, { ok: true, likes: post.likes, liked });
  }

  if (req.method === 'POST' && url.pathname.startsWith('/api/forum/threads/') && url.pathname.split('/').length === 6 && url.pathname.split('/')[5] === 'solve') {
    const forumSession = getForumSession(req);
    if (!forumSession) return json(res, 401, { error: 'login_required' });
    const threadId = url.pathname.split('/')[4];
    const body = await parseForumPayload(res, req, (value) => {
      if (!value || typeof value !== 'object') return 'Payload must be a JSON object.';
      if (!value.postId || typeof value.postId !== 'string') return 'Field "postId" is required.';
      return null;
    });
    if (!body) return;
    const forum = readForum();
    const thread = (forum.threads || []).find(t => t.id === threadId);
    if (!thread) return json(res, 404, { error: 'Thread not found.' });
    if (thread.author !== forumSession.username) return json(res, 403, { error: 'forbidden' });
    if (thread.solvedPostId === body.postId) { thread.solvedPostId = null; thread.solved = false; }
    else { thread.solvedPostId = body.postId; thread.solved = true; }
    writeForum(forum);
    return json(res, 200, { ok: true, solved: thread.solved, solvedPostId: thread.solvedPostId });
  }

  if (req.method === 'GET' && url.pathname === '/api/forum/auth/me') {
    const forumSession = getForumSession(req);
    if (!forumSession) return json(res, 200, { user: null });
    const forumDb = readForum();
    const dbUser = Array.isArray(forumDb.users) ? forumDb.users.find(u => u.id === forumSession.id) : null;
    return json(res, 200, { user: { id: forumSession.id, username: forumSession.username, displayName: forumSession.displayName, email: dbUser ? (dbUser.email || '') : '', createdAt: forumSession.createdAt } });
  }

  // Universal auth aliases (same handlers as all other servers)
  if (req.method === 'GET'  && url.pathname === '/api/auth/me')       return handleCustomerMe(req, res);
  if (req.method === 'POST' && url.pathname === '/api/auth/register') return handleCustomerRegister(req, res);
  if (req.method === 'POST' && url.pathname === '/api/auth/login')    return handleCustomerLogin(req, res);
  if (req.method === 'POST' && url.pathname === '/api/auth/logout')   return handleCustomerLogout(req, res);
  // Legacy forum-prefixed paths — delegate to shared handlers
  if (req.method === 'POST' && url.pathname === '/api/forum/auth/register') return handleCustomerRegister(req, res);
  if (req.method === 'POST' && url.pathname === '/api/forum/auth/login')    return handleCustomerLogin(req, res);
  if (req.method === 'POST' && url.pathname === '/api/forum/auth/logout')   return handleCustomerLogout(req, res);

  if (req.method === 'PATCH' && url.pathname === '/api/forum/auth/me') {
    const forumSession = getForumSession(req);
    if (!forumSession) return json(res, 401, { error: 'login_required' });
    let body; try { body = await readJson(req); } catch { return json(res, 400, { error: 'invalid_json' }); }
    const forum = readForum();
    if (!Array.isArray(forum.users)) forum.users = [];
    const userIdx = forum.users.findIndex(u => u.id === forumSession.id);
    if (userIdx < 0) return json(res, 404, { error: 'user_not_found' });
    const user = { ...forum.users[userIdx] };
    if (typeof body.displayName === 'string') {
      const dn = body.displayName.trim();
      if (dn.length > 50) return json(res, 422, { error: 'invalid_payload', message: 'Display name must be 50 characters or fewer.' });
      user.displayName = dn;
    }
    if (typeof body.email === 'string') {
      user.email = body.email.trim().toLowerCase();
    }
    if (typeof body.newPassword === 'string') {
      if (typeof body.currentPassword !== 'string' || !verifyPassword(body.currentPassword, user.passwordHash)) {
        return json(res, 401, { error: 'invalid_password', message: 'Current password is incorrect.' });
      }
      if (body.newPassword.length < 8) return json(res, 422, { error: 'invalid_payload', message: 'New password must be at least 8 characters.' });
      user.passwordHash = hashPassword(body.newPassword);
    }
    forum.users[userIdx] = user;
    writeForum(forum);
    forumSessions.set(forumSession.sid, { ...forumSessions.get(forumSession.sid), displayName: user.displayName });
    saveSessionsToDisk(FORUM_SESSIONS_DB_PATH, forumSessions);
    return json(res, 200, { ok: true, user: { id: user.id, username: user.username, displayName: user.displayName, createdAt: user.createdAt } });
  }

  if (req.method === 'POST' && url.pathname === '/api/forum/auth/forgot-password') {
    if (publicRateLimited(getIp(req), 'forgot-password')) return json(res, 429, { error: 'too_many_requests' });
    let body; try { body = await readJson(req); } catch { return json(res, 400, { error: 'invalid_json' }); }
    const username = typeof body?.username === 'string' ? body.username.trim() : '';
    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
    if (!username || !email) return json(res, 200, { ok: true }); // always 200 to avoid enumeration
    const forum = readForum();
    if (!Array.isArray(forum.users)) forum.users = [];
    const user = forum.users.find(u =>
      u.username && u.username.toLowerCase() === username.toLowerCase() &&
      u.email && u.email.toLowerCase() === email
    );
    if (user) {
      const token = crypto.randomBytes(32).toString('hex');
      resetTokens.set(token, { userId: user.id, expiresAt: now() + RESET_TOKEN_TTL_MS });
      saveResetTokens();
      const resetUrl = `${getForumUrl()}?reset=${token}`;
      const tmpl = emailPasswordReset({ displayName: user.displayName || user.username, resetUrl });
      sendEmail({ to: user.email, ...tmpl });
    }
    return json(res, 200, { ok: true });
  }

  if (req.method === 'POST' && url.pathname === '/api/forum/auth/reset-password') {
    if (publicRateLimited(getIp(req), 'reset-password')) return json(res, 429, { error: 'too_many_requests' });
    let body; try { body = await readJson(req); } catch { return json(res, 400, { error: 'invalid_json' }); }
    const token = typeof body?.token === 'string' ? body.token : '';
    const password = typeof body?.password === 'string' ? body.password : '';
    if (!token || password.length < 8) return json(res, 422, { error: 'invalid_payload', message: 'Token and a password of at least 8 characters are required.' });
    const entry = resetTokens.get(token);
    if (!entry || entry.expiresAt < now()) return json(res, 400, { error: 'invalid_token', message: 'This reset link has expired or is invalid.' });
    const forum = readForum();
    if (!Array.isArray(forum.users)) forum.users = [];
    const idx = forum.users.findIndex(u => u.id === entry.userId);
    if (idx < 0) return json(res, 400, { error: 'invalid_token', message: 'This reset link has expired or is invalid.' });
    forum.users[idx] = { ...forum.users[idx], passwordHash: hashPassword(password) };
    writeForum(forum);
    resetTokens.delete(token);
    saveResetTokens();
    return json(res, 200, { ok: true });
  }

  return serveStatic(req, res, url.pathname, '/dist/forum.html', null);
});

// ── Admin server (8082) ───────────────────────────────────────────────────────

const adminServer = http.createServer(async (req, res) => {
  try {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === 'GET' && url.pathname === '/api/csrf-token') {
    const token = ensureCsrfCookie(req, res);
    return json(res, 200, { token });
  }

  if (req.method === 'POST' || req.method === 'PATCH') {
    if (!verifyCsrf(req, res)) return;
  }

  if (req.method === 'POST' && url.pathname === '/api/admin/login') {
    const ip = getIp(req);
    if (!isIpAllowed(ip)) return json(res, 403, { error: 'forbidden' });
    const entry = loginAttempts.get(ip);
    if (isLocked(ip)) {
      const retryAfterSec = Math.ceil((entry.lockedUntil - now()) / 1000);
      res.setHeader('Retry-After', retryAfterSec);
      return json(res, 429, { error: 'locked_out', retryAfterSec });
    }
    let body; try { body = await readJson(req); } catch { return json(res, 400, { error: 'invalid_json' }); }
    const suppliedPass = typeof body.password === 'string' ? body.password : '';
    const adminPassOk = getAdminPasswordHash() !== null &&
      body.username === getAdminUsername() &&
      verifyPassword(suppliedPass, getAdminPasswordHash());
    if (adminPassOk) {
      clearFailures(ip);
      const sid = randomId();
      sessions.set(sid, { username: body.username, role: 'owner', createdAt: now(), expiresAt: now() + SESSION_TTL_MS });
      saveSessionsToDisk(SESSIONS_DB_PATH, sessions);
      res.setHeader('Set-Cookie', sessionCookie('oe_admin_session', sid, Math.floor(SESSION_TTL_MS / 1000), req));
      return json(res, 200, { ok: true });
    }
    const staffData = readStaff();
    const member = staffData.members.find(m => m.status === 'active' && m.pinHash && (
      (m.email && m.email.toLowerCase() === (body.username || '').toLowerCase()) ||
      m.name.toLowerCase() === (body.username || '').toLowerCase()
    ));
    if (!member || !verifyPassword(body.pin || '', member.pinHash)) {
      trackFailure(ip);
      return json(res, 401, { error: 'invalid_credentials' });
    }
    if ((ROLE_LEVELS[member.role] ?? 0) < 1) {
      return json(res, 403, { error: 'account_inactive', message: 'Your account does not have dashboard access.' });
    }
    clearFailures(ip);
    const sid = randomId();
    sessions.set(sid, { username: member.name, role: member.role || 'staff', staffId: member.id, createdAt: now(), expiresAt: now() + SESSION_TTL_MS });
    saveSessionsToDisk(SESSIONS_DB_PATH, sessions);
    res.setHeader('Set-Cookie', sessionCookie('oe_admin_session', sid, Math.floor(SESSION_TTL_MS / 1000), req));
    return json(res, 200, { ok: true });
  }

  if (req.method === 'POST' && url.pathname === '/api/admin/logout') {
    const session = requireRole(req, res, 'staff');
    if (!session) return;
    sessions.delete(session.sid);
    saveSessionsToDisk(SESSIONS_DB_PATH, sessions);
    res.setHeader('Set-Cookie', sessionCookie('oe_admin_session', '', 0, req));
    return json(res, 200, { ok: true });
  }

  if (req.method === 'GET' && url.pathname === '/api/admin/session') {
    const session = getSession(req);
    if (!session) return json(res, 401, { authenticated: false });
    return json(res, 200, { authenticated: true, username: session.username, role: session.role, staffId: session.staffId || null });
  }

  if (req.method === 'GET' && url.pathname === '/api/admin/catalog') {
    const session = requireRole(req, res, 'staff'); if (!session) return;
    const catalog = readCatalog();
    if (session.role === 'seller') {
      // Sellers only see their own products, with sellerPrice shown as the editable price
      const sellerProducts = catalog.products
        .filter(p => p.createdBy === session.staffId)
        .map(p => ({ ...p, priceAud: p.sellerPrice != null ? p.sellerPrice : p.priceAud }));
      return json(res, 200, { products: sellerProducts, services: [] });
    }
    return json(res, 200, catalog);
  }

  if (req.method === 'POST' && url.pathname === '/api/admin/catalog/products/status') {
    const session = requireRole(req, res, 'manager'); if (!session) return;
    let body; try { body = await readJson(req); } catch { return json(res, 400, { error: 'invalid_json' }); }
    const status = body.status === 'published' ? 'published' : 'draft';
    const products = readProducts().map(item => ({ ...item, status }));
    writeProducts(products);
    return json(res, 200, { ok: true, items: products });
  }

  if (req.method === 'POST' && url.pathname === '/api/admin/catalog/services/status') {
    const session = requireRole(req, res, 'manager'); if (!session) return;
    let body; try { body = await readJson(req); } catch { return json(res, 400, { error: 'invalid_json' }); }
    const status = body.status === 'published' ? 'published' : 'draft';
    const services = readServices().map(item => ({ ...item, status }));
    writeServices(services);
    return json(res, 200, { ok: true, items: services });
  }

  if (req.method === 'GET' && url.pathname === '/api/admin/gift-cards') {
    const session = requireRole(req, res, 'staff'); if (!session) return;
    return json(res, 200, { items: readGiftCards() });
  }

  if (req.method === 'POST' && url.pathname === '/api/admin/gift-cards/void') {
    const session = requireRole(req, res, 'manager'); if (!session) return;
    let body; try { body = await readJson(req); } catch { return json(res, 400, { error: 'invalid_json' }); }
    const code = (body.code || '').trim().toUpperCase();
    if (!code) return json(res, 400, { error: 'missing_code' });
    const gcList = readGiftCards();
    const gc = gcList.find(c => c.code === code);
    if (!gc) return json(res, 404, { error: 'not_found' });
    gc.isVoid = true;
    writeGiftCards(gcList);
    return json(res, 200, { ok: true });
  }

  if (req.method === 'POST' && url.pathname === '/api/admin/gift-cards/issue') {
    const session = requireRole(req, res, 'manager'); if (!session) return;
    let body; try { body = await readJson(req); } catch { return json(res, 400, { error: 'invalid_json' }); }
    const balance = Number(body.balance);
    const recipientEmail = (body.recipientEmail || '').trim();
    const note = (body.note || '').trim();
    if (!balance || balance <= 0) return json(res, 422, { error: 'invalid_balance' });
    const card = {
      code: generateGiftCardCode(),
      balance,
      originalBalance: balance,
      orderId: note || 'manual',
      recipientEmail,
      issuedAt: new Date().toISOString(),
      redemptions: [],
      isVoid: false,
    };
    const gcList = readGiftCards();
    gcList.push(card);
    writeGiftCards(gcList);
    if (recipientEmail) {
      const tmpl = emailGiftCard({ code: card.code, balance: card.originalBalance, customerName: '' });
      sendEmail({ to: recipientEmail, ...tmpl });
    }
    return json(res, 201, { ok: true, card });
  }

  if (req.method === 'GET' && url.pathname === '/api/admin/gift-cards/denominations') {
    const session = requireAdmin(req, res); if (!session) return;
    return json(res, 200, { items: readDenominations() });
  }

  if (req.method === 'POST' && url.pathname === '/api/admin/gift-cards/denominations/save') {
    const session = requireAdmin(req, res); if (!session) return;
    let body; try { body = await readJson(req); } catch { return json(res, 400, { error: 'invalid_json' }); }
    const { id, name, priceAud, description, status, imageUrl } = body || {};
    if (!id) return json(res, 422, { error: 'id_required' });
    const denoms = readDenominations();
    const idx = denoms.findIndex(d => d.id === id);
    const updated = { id, name: name || '', priceAud: Number(priceAud) || 0, description: description || '', status: status === 'published' ? 'published' : 'draft', imageUrl: imageUrl || '' };
    if (idx >= 0) denoms[idx] = updated; else denoms.push(updated);
    writeDenominations(denoms);
    return json(res, 200, { ok: true, item: updated });
  }

  if (req.method === 'POST' && url.pathname === '/api/admin/gift-cards/denominations/delete') {
    const session = requireAdmin(req, res); if (!session) return;
    let body; try { body = await readJson(req); } catch { return json(res, 400, { error: 'invalid_json' }); }
    const { id } = body || {};
    if (!id) return json(res, 422, { error: 'id_required' });
    const denoms = readDenominations().filter(d => d.id !== id);
    writeDenominations(denoms);
    return json(res, 200, { ok: true });
  }

  if (req.method === 'GET' && url.pathname === '/api/admin/orders') {
    const session = requireRole(req, res, 'staff'); if (!session) return;
    const quotes = readQuotes();
    const items = readOrders().map(o => hydrateOrder(o, quotes));
    return json(res, 200, { items });
  }
  if (req.method === 'GET' && url.pathname === '/api/admin/metrics') {
    const session = requireRole(req, res, 'staff'); if (!session) return;
    return json(res, 200, buildAdminMetrics());
  }
  if (req.method === 'GET' && url.pathname === '/api/admin/customers') {
    const session = requireRole(req, res, 'staff'); if (!session) return;
    const customers = readCustomers();
    const allOrders  = readOrders();
    const allRepairs = flatRepairs();
    const allQuotes  = readQuotes();
    function custMatches(cust, j) {
      const ce = (cust.email||'').toLowerCase().trim();
      const cp = normalisePhone(cust.phone||'');
      const cn = (cust.name||'').toLowerCase().trim();
      if (ce && ce === (j.email||'').toLowerCase().trim()) return true;
      if (cp && cp === normalisePhone(j.phone||j.mobile||'')) return true;
      if (cn && cn === (j.cust||j.name||j.customer||j.customerName||'').toLowerCase().trim()) return true;
      return (cust.manualLinks||[]).some(l => l === j.id || l === j.ref);
    }
    const items = customers.map(c => {
      const orders  = allOrders.filter(o => custMatches(c, o));
      const repairs = allRepairs.filter(r => custMatches(c, r));
      const spent   = orders.reduce((s, o) => s + (parseFloat(o.total)||0), 0)
                    + repairs.reduce((s, r) => s + (parseFloat(r.total||r.cost||0)||0), 0);
      const lastDates = [
        ...orders.map(o => o.createdAt||o.date||''),
        ...repairs.map(r => r.createdAt||r.date||''),
      ].filter(Boolean).sort();
      const last = lastDates.length ? lastDates[lastDates.length - 1].slice(0, 10) : (c.last||'');
      return { ...c, orders: orders.length + repairs.length, spent: Math.round(spent * 100) / 100, last };
    });
    return json(res, 200, { items });
  }
  if (req.method === 'GET' && url.pathname === '/api/admin/repairs') {
    const session = requireRole(req, res, 'staff'); if (!session) return;
    return json(res, 200, readRepairs());
  }
  if (req.method === 'GET' && url.pathname === '/api/admin/quotes') {
    const session = requireRole(req, res, 'staff'); if (!session) return;
    return json(res, 200, { items: readQuotes() });
  }
  if (req.method === 'GET' && url.pathname === '/api/admin/ewaste') {
    const session = requireRole(req, res, 'staff'); if (!session) return;
    return json(res, 200, { items: readEwaste() });
  }
  if (req.method === 'GET' && url.pathname === '/api/admin/sellers') {
    const session = requireRole(req, res, 'staff'); if (!session) return;
    return json(res, 200, { items: readSellers() });
  }
  if (req.method === 'GET' && url.pathname === '/api/admin/groups') {
    const session = requireRole(req, res, 'staff'); if (!session) return;
    return json(res, 200, { items: readGroups() });
  }

  if (req.method === 'GET' && url.pathname === '/api/admin/forum') {
    const session = requireRole(req, res, 'staff'); if (!session) return;
    const forumData = readForum();
    const sanitised = { ...forumData, users: (forumData.users || []).map(({ passwordHash: _p, ...u }) => u) };
    return json(res, 200, sanitised);
  }
  if (req.method === 'GET' && url.pathname === '/api/admin/forum/categories') {
    const session = requireRole(req, res, 'staff'); if (!session) return;
    return json(res, 200, { items: (readForum().categories || []).map((category, index) => ({
      id: category.id || `forum-cat-${index}`,
      label: category.name || category.label || String(category),
    })) });
  }
  if (req.method === 'GET' && url.pathname === '/api/admin/software') {
    const session = requireRole(req, res, 'staff'); if (!session) return;
    return json(res, 200, { items: readSoftware() });
  }
  if (req.method === 'GET' && url.pathname === '/api/admin/software/list') {
    const session = requireRole(req, res, 'staff'); if (!session) return;
    return json(res, 200, { items: readSoftware().map((item, index) => ({
      id: item.id || `software-${index}`,
      label: item.name || item.title || item.slug || `Software ${index + 1}`,
    })) });
  }
  if (req.method === 'GET' && url.pathname === '/api/admin/tutorials') {
    const session = requireRole(req, res, 'staff'); if (!session) return;
    return json(res, 200, { items: readTutorials() });
  }
  if (req.method === 'GET' && url.pathname === '/api/admin/tutorials/list') {
    const session = requireRole(req, res, 'staff'); if (!session) return;
    return json(res, 200, { items: readTutorials().map((item, index) => ({
      id: item.id || `tutorial-${index}`,
      label: item.title || item.name || item.slug || `Tutorial ${index + 1}`,
    })) });
  }
  if (req.method === 'GET' && url.pathname === '/api/admin/ai') {
    const session = requireRole(req, res, 'staff'); if (!session) return;
    return json(res, 200, readAI());
  }
  if (req.method === 'GET' && url.pathname === '/api/admin/policies') {
    const session = requireRole(req, res, 'staff'); if (!session) return;
    return json(res, 200, { items: readPolicies() });
  }
  if (req.method === 'GET' && url.pathname === '/api/admin/policies/list') {
    const session = requireRole(req, res, 'staff'); if (!session) return;
    return json(res, 200, { items: readPolicies().map((item, index) => ({
      id: item.id || `policy-${index}`,
      label: item.title || item.slug || `Policy ${index + 1}`,
      slug: item.slug || '',
      status: item.status === 'published' ? 'published' : 'draft',
      updatedAt: item.updatedAt || null,
      updatedBy: item.updatedBy || null,
    })) });
  }
  if (req.method === 'GET' && (url.pathname.startsWith('/api/admin/policies/') || url.pathname.startsWith('/api/policies/'))) {
    const isAdminRoute = url.pathname.startsWith('/api/admin/policies/');
    if (isAdminRoute) { const session = requireRole(req, res, 'staff'); if (!session) return; }
    const key = decodeURIComponent(url.pathname.split('/').pop() || '').trim();
    const policy = readPolicies().find(p => p.id === key || normalizePolicySlug(p.slug) === normalizePolicySlug(key));
    if (!policy) return json(res, 404, { error: 'policy_not_found' });
    if (!isAdminRoute && policy.status !== 'published') return json(res, 404, { error: 'policy_not_found' });
    return json(res, 200, { item: policy });
  }
  if (req.method === 'GET' && url.pathname === '/api/settings') {
    const s = readSettings();
    const stripeIntegration2 = (s.integrations || []).find(r => r[0] === 'Stripe');
    const stripePublishableKey2 = (stripeIntegration2 && stripeIntegration2[3] && stripeIntegration2[3].publishableKey) || STRIPE_PUBLISHABLE_KEY || '';
    return json(res, 200, { siteContent: s.siteContent, stripePublishableKey: stripePublishableKey2 });
  }
  if (req.method === 'GET' && url.pathname === '/api/admin/settings') {
    const session = requireRole(req, res, 'staff'); if (!session) return;
    const s = readSettings();
    const masked = {
      ...s,
      integrations: s.integrations.map(r => [r[0], r[1], r[2], maskIntegrationConfig(r[0], r[3])]),
      security: { adminUsername: s.security?.adminUsername || '' },
    };
    return json(res, 200, masked);
  }

  if (req.method === 'POST' && (url.pathname === '/api/admin/forum/queue/resolve' || url.pathname === '/api/admin/forum/queue/action')) {
    const session = requireRole(req, res, 'manager'); if (!session) return;
    const legacyQueueAction = url.pathname === '/api/admin/forum/queue/action';
    const body = await parseForumPayload(res, req, (value) => {
      if (!value || typeof value.id !== 'string' || !value.id.trim()) return 'Field "id" is required.';
      if (!legacyQueueAction && !['approve', 'edit-approve', 'reject'].includes(value.action)) return 'Field "action" must be one of approve, edit-approve, or reject.';
      if (legacyQueueAction && value.action != null && !['approve', 'edit-approve', 'reject'].includes(value.action)) return 'Field "action" must be one of approve, edit-approve, or reject.';
      return null;
    });
    if (!body) return;
    const forum = readForum();
    const exists = forum.queue.some(q => q.id === body.id);
    if (!exists) {
      const meta = operationMeta({ session, action: 'forum.queue.resolve', status: 'error', changed: { queueItemRemoved: false, queueId: body.id, moderationAction: body.action || 'approve' }, reason: 'queue_item_not_found' });
      auditAdminAction({ req, session, action: 'forum.queue.resolve', result: meta });
      return json(res, 404, { ok: false, result: meta });
    }
    forum.queue = forum.queue.filter(q => q.id !== body.id);
    writeForum(forum);
    const meta = operationMeta({ session, action: 'forum.queue.resolve', status: 'ok', changed: { queueItemRemoved: true, queueId: body.id, moderationAction: body.action || 'approve', queueCount: forum.queue.length } });
    auditAdminAction({ req, session, action: 'forum.queue.resolve', result: meta });
    return json(res, 200, { ok: true, result: meta });
  }

  if (req.method === 'POST' && url.pathname === '/api/admin/forum/threads/save') {
    const session = requireRole(req, res, 'manager'); if (!session) return;
    const body = await parseForumPayload(res, req, (value) => (value && typeof value === 'object' && !Array.isArray(value) ? null : 'Thread payload must be a JSON object.'));
    if (!body) return;
    const forum = readForum();
    const idx = forum.threads.findIndex(t => t.id === body.id);
    if (idx >= 0) { forum.threads[idx] = body; } else { body.id = 'T-' + Date.now(); forum.threads.push(body); }
    writeForum(forum);
    return json(res, 200, { ok: true });
  }

  if (req.method === 'POST' && url.pathname === '/api/admin/forum/users/save') {
    const session = requireRole(req, res, 'manager'); if (!session) return;
    const body = await parseForumPayload(res, req, (value) => (value && typeof value.name === 'string' && value.name.trim() ? null : 'Field "name" is required.'));
    if (!body) return;
    const forum = readForum();
    const idx = forum.users.findIndex(u => u.name === body.name);
    if (idx >= 0) { forum.users[idx] = body; } else { forum.users.push(body); }
    writeForum(forum);
    return json(res, 200, { ok: true });
  }

  if (req.method === 'POST' && url.pathname === '/api/admin/forum/categories/save') {
    const session = requireRole(req, res, 'manager'); if (!session) return;
    const body = await parseForumPayload(res, req, (value) => (value && Array.isArray(value.categories) ? null : 'Field "categories" must be an array.'));
    if (!body) return;
    const forum = readForum();
    forum.categories = body.categories;
    writeForum(forum);
    return json(res, 200, { ok: true });
  }

  if (req.method === 'POST' && url.pathname === '/api/admin/forum/conduct/save') {
    const session = requireRole(req, res, 'manager'); if (!session) return;
    const body = await parseForumPayload(res, req, (value) => (value && typeof value.conduct === 'string' ? null : 'Field "conduct" must be a string.'));
    if (!body) return;
    const forum = readForum();
    forum.conduct = body.conduct;
    writeForum(forum);
    return json(res, 200, { ok: true });
  }

  if (req.method === 'POST' && url.pathname.startsWith('/api/admin/forum/threads/') && url.pathname.split('/').length === 7 && url.pathname.split('/')[6] === 'pin') {
    const session = requireRole(req, res, 'manager'); if (!session) return;
    const threadId = url.pathname.split('/')[5];
    const body = await parseForumPayload(res, req, () => null); if (!body) return;
    const forum = readForum();
    const thread = (forum.threads || []).find(t => t.id === threadId);
    if (!thread) return json(res, 404, { error: 'Thread not found.' });
    thread.pinned = typeof body.pinned === 'boolean' ? body.pinned : !thread.pinned;
    writeForum(forum);
    return json(res, 200, { ok: true });
  }

  if (req.method === 'POST' && url.pathname.startsWith('/api/admin/forum/threads/') && url.pathname.split('/').length === 7 && url.pathname.split('/')[6] === 'lock') {
    const session = requireRole(req, res, 'manager'); if (!session) return;
    const threadId = url.pathname.split('/')[5];
    const body = await parseForumPayload(res, req, () => null); if (!body) return;
    const forum = readForum();
    const thread = (forum.threads || []).find(t => t.id === threadId);
    if (!thread) return json(res, 404, { error: 'Thread not found.' });
    thread.locked = typeof body.locked === 'boolean' ? body.locked : !thread.locked;
    writeForum(forum);
    return json(res, 200, { ok: true });
  }

  if (req.method === 'POST' && url.pathname === '/api/admin/upload') {
    const session = requireRole(req, res, 'staff'); if (!session) return;
    let body; try { body = await readJson(req, 15e6); } catch { return json(res, 400, { error: 'invalid_json' }); }
    try {
      // SVG is excluded: SVGs can contain <script> tags and would be served with
      // image/svg+xml MIME, enabling stored XSS from the site's own origin.
      const ALLOWED_MIME = new Set([
        'image/jpeg', 'image/png', 'image/gif', 'image/webp',
        'application/pdf',
      ]);
      const ALLOWED_EXT = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.pdf']);
      const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

      const dataUri = body.data || '';
      const mimeMatch = dataUri.match(/^data:([^;]+);base64,/);
      if (!mimeMatch) return json(res, 400, { error: 'invalid_data_uri' });
      const mime = mimeMatch[1].toLowerCase();
      if (!ALLOWED_MIME.has(mime)) return json(res, 400, { error: 'unsupported_mime_type' });

      const origName = (body.filename || 'upload').replace(/[^a-zA-Z0-9._-]/g, '_');
      const ext = path.extname(origName).toLowerCase();
      if (!ALLOWED_EXT.has(ext)) return json(res, 400, { error: 'unsupported_file_extension' });

      const raw = dataUri.slice(mimeMatch[0].length);
      const buf = Buffer.from(raw, 'base64');
      if (buf.length > MAX_BYTES) return json(res, 400, { error: 'file_too_large' });

      const RASTER_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
      let outBuf = buf;
      let outExt = ext;
      if (RASTER_MIME.has(mime)) {
        outExt = '.webp';
        outBuf = await sharp(buf)
          .resize({ width: 1200, height: 1200, fit: 'inside', withoutEnlargement: true })
          .webp({ quality: 82 })
          .toBuffer();
      }

      const baseName = path.basename(origName, ext);
      const safeFilename = Date.now() + '-' + baseName + outExt;
      fs.writeFileSync(path.join(__dirname, 'assets/uploads', safeFilename), outBuf);
      return json(res, 200, { url: '/assets/uploads/' + safeFilename });
    } catch { return json(res, 500, { error: 'upload_failed' }); }
  }

  if (req.method === 'POST' && url.pathname === '/api/admin/upload/delete') {
    const session = requireRole(req, res, 'staff'); if (!session) return;
    let body; try { body = await readJson(req); } catch { return json(res, 400, { error: 'invalid_json' }); }
    const filename = body.filename || '';
    if (path.basename(filename) !== filename || filename.includes('\0')) {
      return json(res, 400, { error: 'invalid_filename' });
    }
    const target = path.join(__dirname, 'assets/uploads', filename);
    const uploadsDir = path.resolve(path.join(__dirname, 'assets/uploads'));
    if (!path.resolve(target).startsWith(uploadsDir + path.sep) && path.resolve(target) !== uploadsDir) {
      return json(res, 400, { error: 'invalid_filename' });
    }
    try { fs.unlinkSync(target); } catch {}
    return json(res, 200, { ok: true });
  }

  // ---- Software binary file upload (chunked, supports up to 10 GB) ----------
  // Allowed extensions/MIME for software files (shared by chunk + finalize)
  const SW_ALLOWED_EXT = new Set([
    '.zip', '.gz', '.tgz', '.bz2', '.xz', '.7z',
    '.iso', '.img',
    '.apk', '.aab',
    '.exe', '.msi',
    '.deb', '.rpm',
    '.dmg', '.pkg',
    '.appimage', '.run', '.sh',
    '.tar',
  ]);
  // uploadId must be safe to use as a directory name
  const validUploadId = id => typeof id === 'string' && /^[a-zA-Z0-9_-]{8,64}$/.test(id);
  const swChunksRoot = path.join(__dirname, 'assets/uploads/software/.chunks');

  // POST /api/admin/software/upload/chunk
  // Body: { uploadId, chunkIndex, totalChunks, filename, data (base64 data-URI of slice) }
  // Each chunk is up to 20 MB raw → ~27 MB base64. readJson cap: 30 MB.
  if (req.method === 'POST' && url.pathname === '/api/admin/software/upload/chunk') {
    const session = requireRole(req, res, 'manager'); if (!session) return;
    let body; try { body = await readJson(req, 30e6); } catch { return json(res, 400, { error: 'invalid_json' }); }
    try {
      const { uploadId, chunkIndex, totalChunks, filename, data } = body;
      if (!validUploadId(uploadId)) return json(res, 400, { error: 'invalid_upload_id' });
      if (!Number.isInteger(chunkIndex) || chunkIndex < 0) return json(res, 400, { error: 'invalid_chunk_index' });
      if (!Number.isInteger(totalChunks) || totalChunks < 1 || totalChunks > 550) return json(res, 400, { error: 'invalid_total_chunks' }); // 550 × 20 MB ≈ 11 GB max
      const origName = (filename || 'file').replace(/[^a-zA-Z0-9._-]/g, '_');
      const ext = origName.includes('.tar.') ? '.' + origName.split('.').slice(-2).join('.') : path.extname(origName).toLowerCase();
      if (!SW_ALLOWED_EXT.has(ext)) return json(res, 400, { error: 'unsupported_file_type' });

      const dataUri = data || '';
      const mimeMatch = dataUri.match(/^data:([^;]+);base64,/);
      if (!mimeMatch) return json(res, 400, { error: 'invalid_data_uri' });
      const raw = dataUri.slice(mimeMatch[0].length);
      const buf = Buffer.from(raw, 'base64');
      if (buf.length > 21 * 1024 * 1024) return json(res, 400, { error: 'chunk_too_large' });

      const chunkDir = path.join(swChunksRoot, uploadId);
      fs.mkdirSync(chunkDir, { recursive: true });
      fs.writeFileSync(path.join(chunkDir, String(chunkIndex).padStart(6, '0')), buf);
      return json(res, 200, { ok: true, chunk: chunkIndex });
    } catch { return json(res, 500, { error: 'chunk_failed' }); }
  }

  // POST /api/admin/software/upload/finalize
  // Body: { uploadId, filename, totalChunks }
  // Assembles chunks → assets/uploads/software/{timestamp}-{filename}
  if (req.method === 'POST' && url.pathname === '/api/admin/software/upload/finalize') {
    const session = requireRole(req, res, 'manager'); if (!session) return;
    let body; try { body = await readJson(req); } catch { return json(res, 400, { error: 'invalid_json' }); }
    try {
      const { uploadId, filename, totalChunks } = body;
      if (!validUploadId(uploadId)) return json(res, 400, { error: 'invalid_upload_id' });
      if (!Number.isInteger(totalChunks) || totalChunks < 1 || totalChunks > 550) return json(res, 400, { error: 'invalid_total_chunks' });
      const origName = (filename || 'file').replace(/[^a-zA-Z0-9._-]/g, '_');
      const ext = origName.includes('.tar.') ? '.' + origName.split('.').slice(-2).join('.') : path.extname(origName).toLowerCase();
      if (!SW_ALLOWED_EXT.has(ext)) return json(res, 400, { error: 'unsupported_file_type' });

      const chunkDir = path.join(swChunksRoot, uploadId);
      // Verify all chunks are present and measure total size
      let totalSize = 0;
      for (let i = 0; i < totalChunks; i++) {
        const cf = path.join(chunkDir, String(i).padStart(6, '0'));
        let stat; try { stat = fs.statSync(cf); } catch { return json(res, 400, { error: 'missing_chunk', chunk: i }); }
        totalSize += stat.size;
      }
      const MAX_BYTES = 10 * 1024 * 1024 * 1024; // 10 GB
      if (totalSize > MAX_BYTES) {
        try { fs.rmSync(chunkDir, { recursive: true, force: true }); } catch {}
        return json(res, 400, { error: 'file_too_large', maxGB: 10 });
      }

      fs.mkdirSync(path.join(__dirname, 'assets/uploads/software'), { recursive: true });
      const safeFilename = Date.now() + '-' + origName;
      const outPath = path.join(__dirname, 'assets/uploads/software', safeFilename);
      // Stream chunks to final file without loading everything into memory at once
      const outStream = fs.createWriteStream(outPath);
      await new Promise((resolve, reject) => {
        let i = 0;
        const writeNext = () => {
          if (i >= totalChunks) { outStream.end(); return; }
          const cf = path.join(chunkDir, String(i++).padStart(6, '0'));
          const chunk = fs.readFileSync(cf);
          if (!outStream.write(chunk)) { outStream.once('drain', writeNext); } else { writeNext(); }
        };
        outStream.on('finish', resolve);
        outStream.on('error', reject);
        writeNext();
      });
      // Remove temp chunks
      try { fs.rmSync(chunkDir, { recursive: true, force: true }); } catch {}
      return json(res, 200, { ok: true, url: '/assets/uploads/software/' + safeFilename, filename: safeFilename, originalName: origName, size: totalSize });
    } catch { return json(res, 500, { error: 'finalize_failed' }); }
  }

  // POST /api/admin/software/upload/abort
  // Body: { uploadId } — cleans up temp chunks for a failed/cancelled upload
  if (req.method === 'POST' && url.pathname === '/api/admin/software/upload/abort') {
    const session = requireRole(req, res, 'manager'); if (!session) return;
    let body; try { body = await readJson(req); } catch { return json(res, 400, { error: 'invalid_json' }); }
    const { uploadId } = body;
    if (!validUploadId(uploadId)) return json(res, 400, { error: 'invalid_upload_id' });
    const chunkDir = path.join(swChunksRoot, uploadId);
    try { fs.rmSync(chunkDir, { recursive: true, force: true }); } catch {}
    return json(res, 200, { ok: true });
  }

  if (req.method === 'POST' && url.pathname === '/api/admin/software/upload/delete') {
    const session = requireRole(req, res, 'manager'); if (!session) return;
    let body; try { body = await readJson(req); } catch { return json(res, 400, { error: 'invalid_json' }); }
    const filename = path.basename(body.filename || '');
    if (!filename || filename.includes('\0') || filename.includes('/')) {
      return json(res, 400, { error: 'invalid_filename' });
    }
    const swUploadsDir = path.resolve(path.join(__dirname, 'assets/uploads/software'));
    const target = path.resolve(path.join(__dirname, 'assets/uploads/software', filename));
    if (!target.startsWith(swUploadsDir + path.sep) && target !== swUploadsDir) {
      return json(res, 400, { error: 'invalid_filename' });
    }
    try { fs.unlinkSync(target); } catch {}
    return json(res, 200, { ok: true });
  }

  if (req.method === 'POST' && url.pathname === '/api/admin/catalog/products/save') {
    const session = requireRole(req, res, 'seller'); if (!session) return;
    let body; try { body = await readJson(req); } catch { return json(res, 400, { error: 'invalid_json' }); }
    const products = readProducts();
    const idx = products.findIndex(p => p.id && p.id === body.id);
    if (session.role === 'seller') {
      if (idx >= 0 && products[idx].createdBy !== session.staffId) return json(res, 403, { error: 'forbidden' });
      body.createdBy = session.staffId;
      // Sellers enter their own base price; customer-facing priceAud includes the 20% commission.
      // Store sellerPrice for payout tracking and display back to the seller.
      const settings = readSettings();
      const commissionPct = Number((settings.shop || {}).sellerCommissionPct) || 20;
      const sellerPrice = parseFloat(body.priceAud) || 0;
      body.sellerPrice = Math.round(sellerPrice * 100) / 100;
      body.priceAud = Math.round(sellerPrice * (1 + commissionPct / 100) * 100) / 100;
    }
    if (idx >= 0) { products[idx] = body; } else { body.id = 'prod-' + Date.now(); products.push(body); }
    writeProducts(products);
    // Return sellerPrice to the client so the seller's UI shows their own price
    return json(res, 200, { ok: true, item: body });
  }
  if (req.method === 'POST' && url.pathname === '/api/admin/catalog/products/delete') {
    const session = requireRole(req, res, 'seller'); if (!session) return;
    let body; try { body = await readJson(req); } catch { return json(res, 400, { error: 'invalid_json' }); }
    const products = readProducts();
    const product = products.find(p => p.id === body.id);
    if (session.role === 'seller' && product && product.createdBy !== session.staffId) return json(res, 403, { error: 'forbidden' });
    writeProducts(products.filter(p => p.id !== body.id));
    return json(res, 200, { ok: true });
  }

  if (req.method === 'POST' && url.pathname === '/api/admin/catalog/services/save') {
    const session = requireRole(req, res, 'manager'); if (!session) return;
    let body; try { body = await readJson(req); } catch { return json(res, 400, { error: 'invalid_json' }); }
    const services = readServices();
    const idx = services.findIndex(s => s.id && s.id === body.id);
    if (idx >= 0) { services[idx] = body; } else { body.id = 'svc-' + Date.now(); services.push(body); }
    writeServices(services);
    return json(res, 200, { ok: true, item: body });
  }
  if (req.method === 'POST' && url.pathname === '/api/admin/catalog/services/delete') {
    const session = requireRole(req, res, 'manager'); if (!session) return;
    let body; try { body = await readJson(req); } catch { return json(res, 400, { error: 'invalid_json' }); }
    writeServices(readServices().filter(s => s.id !== body.id));
    return json(res, 200, { ok: true });
  }

  if (req.method === 'POST' && url.pathname === '/api/admin/orders/save') {
    const session = requireRole(req, res, 'manager'); if (!session) return;
    let body; try { body = await readJson(req); } catch { return json(res, 400, { error: 'invalid_json' }); }
    const orders = readOrders();
    // _originalId lets the client rename an order's ID — find by original, save with new
    const lookupId = body._originalId || body.id;
    const idx = orders.findIndex(o => o.id && o.id === lookupId);
    const existing = idx >= 0 ? orders[idx] : null;
    const { draftQuote: _dq, _originalId: _oid, ...bodyToStore } = body;
    // Check new ID isn't already taken by a different order
    if (bodyToStore.id && idx >= 0 && bodyToStore.id !== existing.id) {
      const collision = orders.find((o, i) => i !== idx && o.id === bodyToStore.id);
      if (collision) return json(res, 409, { error: 'id_taken', message: `Order number ${bodyToStore.id} is already in use.` });
    }
    if (idx >= 0) { orders[idx] = bodyToStore; } else {
      if (!bodyToStore.id) {
        const maxN = orders.reduce((max, o) => { const m = String(o.id||'').match(/^OE-(\d+)$/); return m ? Math.max(max, parseInt(m[1])) : max; }, 1000);
        bodyToStore.id = `OE-${maxN + 1}`;
      }
      orders.push(bodyToStore);
    }
    writeOrders(orders);
    const justFulfilled = body.fulfilment === 'fulfilled' && existing && existing.fulfilment !== 'fulfilled';
    if (justFulfilled && body.email) {
      const pts = Math.floor(Number(body.total) || 0);
      if (pts > 0) grantRewardPoints(body.email, pts, 'order', `Order ${body.id}`, `order-${body.id}`);
    }
    const justShipped = body.fulfilment === 'shipped' && existing && existing.fulfilment !== 'shipped';
    if (justShipped && body.trackingNumber && body.email) {
      const tmpl = emailOrderShipped({ orderId: body.id, customerName: body.cust, trackingNumber: body.trackingNumber });
      sendEmail({ to: body.email, ...tmpl });
    }
    return json(res, 200, { ok: true, item: body });
  }
  if (req.method === 'POST' && url.pathname === '/api/admin/orders/refund') {
    const session = requireRole(req, res, 'manager'); if (!session) return;
    let body; try { body = await readJson(req); } catch { return json(res, 400, { error: 'invalid_json' }); }
    const { id, method } = body || {};
    if (!id) return json(res, 422, { error: 'id_required' });
    if (method !== 'stripe' && method !== 'store-credit') return json(res, 422, { error: 'invalid_method', message: 'Refund method must be "stripe" or "store-credit".' });
    const orders = readOrders();
    const idx = orders.findIndex(o => o.id === id);
    if (idx < 0) return json(res, 404, { error: 'not_found' });
    const order = orders[idx];
    if (order.refund) return json(res, 409, { error: 'already_refunded', message: `Order ${id} has already been refunded.` });

    const stripePaid = roundCents((order.payments || []).filter(p => p.method === 'Stripe').reduce((s, p) => s + (Number(p.amount) || 0), 0));
    const orderTotal = roundCents(order.total);
    const maxRefund = method === 'stripe' ? stripePaid : orderTotal;
    const requested = body.amount != null ? roundCents(body.amount) : maxRefund;
    if (!(requested > 0)) return json(res, 422, { error: 'invalid_amount', message: 'Refund amount must be greater than zero.' });
    if (requested > maxRefund) return json(res, 422, { error: 'amount_too_high', message: `Maximum refundable via ${method === 'stripe' ? 'Stripe' : 'store credit'} is $${maxRefund.toFixed(2)}.` });

    const nowStr = new Date().toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' });
    if (method === 'store-credit') {
      const ok = grantStoreCredit(order.email, requested, 'refund', `Refund for order ${id}`, `refund-${id}`);
      if (!ok) return json(res, 422, { error: 'no_account', message: 'Store credit requires the customer to have an account with this email. Use a Stripe refund instead, or ask the customer to register.' });
    } else {
      // Stripe refund — resolve the payment intent (older orders may only have a session id)
      let pi = order.stripePaymentIntent || '';
      if (!pi && order.stripeSessionId) {
        const sResp = await stripeRequest('GET', `/v1/checkout/sessions/${encodeURIComponent(order.stripeSessionId)}`, null).catch(() => null);
        pi = sResp && sResp.status === 200 ? (sResp.body.payment_intent || '') : '';
      }
      if (!pi) return json(res, 422, { error: 'no_payment_intent', message: 'No Stripe payment found for this order. It may have been paid another way — issue store credit instead.' });
      let rResp;
      try { rResp = await stripeRequest('POST', '/v1/refunds', { payment_intent: pi, amount: String(Math.round(requested * 100)) }); }
      catch { return json(res, 502, { error: 'stripe_error', message: 'Payment provider unreachable. Please try again.' }); }
      if (!rResp || rResp.status !== 200) {
        const msg = rResp?.body?.error?.message || 'Stripe refund failed.';
        return json(res, 502, { error: 'stripe_error', message: msg });
      }
    }

    order.fulfilment = 'refunded';
    order.refund = { method, amount: requested, date: new Date().toISOString(), by: session.username || session.role || 'admin' };
    order.payments = [...(order.payments || []), { amount: -requested, method: method === 'stripe' ? 'Stripe Refund' : 'Store Credit', note: `Refund for ${id}`, date: nowStr }];
    orders[idx] = order;
    writeOrders(orders);
    if (order.email) {
      const tmpl = emailOrderRefunded({ orderId: id, customerName: order.cust, amount: requested, method: method === 'stripe' ? 'your original payment method' : 'store credit' });
      sendEmail({ to: order.email, ...tmpl }).catch(() => {});
    }
    return json(res, 200, { ok: true, order });
  }
  if (req.method === 'POST' && url.pathname === '/api/admin/orders/check-tracking') {
    const session = requireRole(req, res, 'staff'); if (!session) return;
    let body; try { body = await readJson(req); } catch { return json(res, 400, { error: 'invalid_json' }); }
    const orders = readOrders();
    const idx = orders.findIndex(o => o.id === body.id);
    if (idx < 0) return json(res, 404, { error: 'not_found' });
    const order = orders[idx];
    if (!order.trackingNumber) return json(res, 400, { error: 'no_tracking_number' });
    const tracking = await checkOrderTracking(order);
    if (!tracking) return json(res, 502, { error: 'tracking_unavailable', message: 'Could not reach Australia Post tracking. Check your AusPost API key in Settings → Integrations.' });
    const nowStr = new Date().toLocaleDateString('en-AU', { day:'2-digit', month:'short', year:'numeric' });
    const update = { lastTrackingStatus: tracking.raw, lastTrackingCheck: new Date().toISOString(), trackingEvents: tracking.events };
    if (tracking.status.includes('delivered') || tracking.status.includes('complete')) {
      update.fulfilment = 'fulfilled';
      if (order.email && order.fulfilment !== 'fulfilled') {
        const tmpl = emailOrderDelivered({ orderId: order.id, customerName: order.cust, trackingNumber: order.trackingNumber });
        sendEmail({ to: order.email, ...tmpl }).catch(() => {});
        const pts = Math.floor(Number(order.total) || 0);
        if (pts > 0) grantRewardPoints(order.email, pts, 'order', `Order ${order.id}`, `order-${order.id}`);
      }
    }
    orders[idx] = { ...order, ...update };
    writeOrders(orders);
    return json(res, 200, { ok: true, tracking, fulfilment: orders[idx].fulfilment });
  }

  if (req.method === 'POST' && url.pathname === '/api/admin/orders/delete') {
    const session = requireRole(req, res, 'manager'); if (!session) return;
    let body; try { body = await readJson(req); } catch { return json(res, 400, { error: 'invalid_json' }); }
    writeOrders(readOrders().filter(o => o.id !== body.id));
    return json(res, 200, { ok: true });
  }

  if (req.method === 'POST' && url.pathname === '/api/admin/orders/send-tracking-email') {
    const session = requireRole(req, res, 'manager'); if (!session) return;
    let body; try { body = await readJson(req); } catch { return json(res, 400, { error: 'invalid_json' }); }
    const orders = readOrders();
    const idx = orders.findIndex(o => o.id === body.id);
    if (idx < 0) return json(res, 404, { error: 'not_found' });
    const order = orders[idx];
    if (!order.email) return json(res, 422, { error: 'no_email', message: 'Order has no customer email address.' });
    // Generate a token valid for 7 days and store it on the order
    const trackingToken = randomId();
    const trackingTokenExpiry = Date.now() + 7 * 24 * 60 * 60 * 1000;
    orders[idx] = { ...order, trackingToken, trackingTokenExpiry };
    writeOrders(orders);
    const tmpl = emailOrderTracking({ customerName: order.cust, orderId: order.id, trackingToken });
    await sendEmail({ to: order.email, ...tmpl });
    return json(res, 200, { ok: true });
  }

  // Public: validate an order tracking token (used by portal registration flow)
  if (req.method === 'GET' && url.pathname === '/api/order-token') {
    const token = url.searchParams.get('token');
    if (!token) return json(res, 400, { error: 'missing_token' });
    const orders = readOrders();
    const order = orders.find(o => o.trackingToken === token && o.trackingTokenExpiry > Date.now());
    if (!order) return json(res, 404, { error: 'invalid_or_expired', message: 'This link is invalid or has expired.' });
    const forum = readForum();
    const hasAccount = !!(forum.users || []).find(u => u.email && u.email.toLowerCase() === order.email.toLowerCase());
    return json(res, 200, { ok: true, orderId: order.id, customerName: order.cust, email: order.email, hasAccount });
  }

  if (req.method === 'POST' && url.pathname === '/api/admin/customers/save') {
    const session = requireRole(req, res, 'manager'); if (!session) return;
    let body; try { body = await readJson(req); } catch { return json(res, 400, { error: 'invalid_json' }); }
    const customers = readCustomers();
    const idx = customers.findIndex(c => c.id && c.id === body.id);
    if (idx >= 0) { customers[idx] = body; } else { body.id = 'cust-' + Date.now(); customers.push(body); }
    writeCustomers(customers);
    // Auto-stamp jobs that match by name (but lack email/phone) with this customer's email,
    // so they will be found by email-based lookups going forward.
    const custEmail = (body.email||'').trim();
    const custPhone = normalisePhone(body.phone||'');
    const custName  = (body.name||'').toLowerCase().trim();
    if (custName && custEmail) {
      function needsStamp(j) {
        if ((j.email||'').trim()) return false; // already has email — don't overwrite
        const jName = (j.cust||j.name||j.customer||j.customerName||'').toLowerCase().trim();
        return jName && jName === custName;
      }
      const orders = readOrders();
      const stamped = orders.map(o => needsStamp(o) ? { ...o, email: custEmail } : o);
      if (stamped.some((o, i) => o !== orders[i])) writeOrders(stamped);
      const repairsBoard = readRepairs();
      let repairsDirty = false;
      repairsBoard.columns = (repairsBoard.columns||[]).map(col => ({
        ...col,
        cards: (col.cards||[]).map(c => { if (needsStamp(c)) { repairsDirty = true; return { ...c, email: custEmail }; } return c; })
      }));
      if (repairsDirty) writeRepairs(repairsBoard);
      const quotes = readQuotes();
      const stampedQ = quotes.map(q => needsStamp(q) ? { ...q, email: custEmail } : q);
      if (stampedQ.some((q, i) => q !== quotes[i])) writeQuotes(stampedQ);
    }
    return json(res, 200, { ok: true, item: body });
  }
  if (req.method === 'POST' && url.pathname === '/api/admin/customers/delete') {
    const session = requireRole(req, res, 'manager'); if (!session) return;
    let body; try { body = await readJson(req); } catch { return json(res, 400, { error: 'invalid_json' }); }
    writeCustomers(readCustomers().filter(c => c.id !== body.id));
    return json(res, 200, { ok: true });
  }
  if (req.method === 'POST' && url.pathname === '/api/admin/customers/backfill') {
    const session = requireRole(req, res, 'manager'); if (!session) return;
    backfillJobEmails();
    return json(res, 200, { ok: true });
  }
  if (req.method === 'GET' && url.pathname === '/api/admin/customers/linked-jobs') {
    const session = requireRole(req, res, 'staff'); if (!session) return;
    const custId = url.searchParams.get('id');
    const customers = readCustomers();
    const cust = customers.find(c => c.id === custId);
    const custEmail = (cust && cust.email || '').toLowerCase().trim();
    const custPhone = normalisePhone(cust && cust.phone || '');
    const custName  = (cust && cust.name  || '').toLowerCase().trim();
    const manualLinks = (cust && cust.manualLinks) || [];
    function matchesCust(j) {
      if (manualLinks.includes(j.id) || manualLinks.includes(j.ref)) return true;
      const jEmail = (j.email||'').toLowerCase().trim();
      const jPhone = normalisePhone(j.phone || j.mobile || '');
      const jName  = (j.cust || j.name || j.customer || j.customerName || '').toLowerCase().trim();
      if (custEmail && jEmail && custEmail === jEmail) return true;
      if (custPhone && jPhone && custPhone === jPhone) return true;
      if (custName  && jName  && custName  === jName)  return true;
      return false;
    }
    const orders = readOrders().filter(matchesCust)
      .map(o => ({ id: o.id, ref: o.ref || o.id, title: o.title || o.description, _type: 'order' }));
    const repairs = flatRepairs().filter(matchesCust)
      .map(r => ({ id: r.id, ref: r.id, service: r.service || r.customer || r.description, status: r._colLabel, _type: 'repair' }));
    const quotes = readQuotes().filter(matchesCust)
      .map(q => ({ id: q.id, ref: q.ref || q.id, service: q.service || q.description, _type: 'quote' }));
    return json(res, 200, { orders, repairs, quotes });
  }
  if (req.method === 'POST' && url.pathname === '/api/admin/customers/merge') {
    const session = requireRole(req, res, 'manager'); if (!session) return;
    let body; try { body = await readJson(req); } catch { return json(res, 400, { error: 'invalid_json' }); }
    const { keepId, deleteId, merged } = body;
    if (!keepId || !deleteId || keepId === deleteId) return json(res, 400, { error: 'invalid_ids' });
    let customers = readCustomers();
    const keepIdx = customers.findIndex(c => c.id === keepId);
    if (keepIdx < 0) return json(res, 404, { error: 'not_found' });
    const deleteCustomer = customers.find(c => c.id === deleteId);
    const oldEmail = (deleteCustomer && deleteCustomer.email || '').toLowerCase().trim();
    const oldPhone = normalisePhone(deleteCustomer && deleteCustomer.phone || '');
    const oldName  = (deleteCustomer && deleteCustomer.name  || '').toLowerCase().trim();
    const newEmail = (merged.email || customers[keepIdx].email || '').toLowerCase().trim();
    // Re-link orders, repairs, quotes by email, phone, or name
    function matchesDeleted(j) {
      const jEmail = (j.email||'').toLowerCase().trim();
      const jPhone = normalisePhone(j.phone || j.mobile || '');
      const jName  = (j.cust || j.name || j.customer || j.customerName || '').toLowerCase().trim();
      if (oldEmail && jEmail && oldEmail === jEmail) return true;
      if (oldPhone && jPhone && oldPhone === jPhone) return true;
      if (oldName  && jName  && oldName  === jName)  return true;
      return false;
    }
    const orders = readOrders().map(o => matchesDeleted(o) ? { ...o, email: newEmail } : o);
    writeOrders(orders);
    const repairsBoard = readRepairs();
    repairsBoard.columns = (repairsBoard.columns || []).map(col => ({
      ...col,
      cards: (col.cards || []).map(c => matchesDeleted(c) ? { ...c, email: newEmail } : c)
    }));
    writeRepairs(repairsBoard);
    const quotes = readQuotes().map(q => matchesDeleted(q) ? { ...q, email: newEmail } : q);
    writeQuotes(quotes);
    // Combine manual links from both
    const combinedManualLinks = [...new Set([
      ...((customers[keepIdx].manualLinks)||[]),
      ...((deleteCustomer && deleteCustomer.manualLinks)||[])
    ])];
    customers[keepIdx] = { ...customers[keepIdx], ...merged, id: keepId, manualLinks: combinedManualLinks };
    customers = customers.filter(c => c.id !== deleteId);
    writeCustomers(customers);
    return json(res, 200, { ok: true, item: customers[customers.findIndex(c => c.id === keepId)] });
  }

  if (req.method === 'POST' && url.pathname === '/api/admin/quotes/save') {
    const session = requireRole(req, res, 'technician'); if (!session) return;
    let body; try { body = await readJson(req); } catch { return json(res, 400, { error: 'invalid_json' }); }
    const quotes = readQuotes();
    const idx = quotes.findIndex(q => q.id && q.id === body.id);
    const prev = idx >= 0 ? quotes[idx] : null;
    if (idx >= 0) { quotes[idx] = body; } else { body.id = 'quot-' + Date.now(); quotes.push(body); }
    writeQuotes(quotes);
    // Email customer if a reply was just added or status changed to replied/approved/declined
    const replyAdded = body.reply && body.reply.trim() && (!prev || prev.reply !== body.reply);
    const statusChanged = prev && prev.status !== body.status && ['replied','approved','declined'].includes(body.status);
    if ((replyAdded || statusChanged) && body.email) {
      const tmpl = emailQuoteReply({ quoteId: body.id, customerName: body.name, reply: body.reply || '', status: body.status });
      sendEmail({ to: body.email, ...tmpl });
    }
    return json(res, 200, { ok: true, item: body });
  }
  if (req.method === 'POST' && url.pathname === '/api/admin/quotes/delete') {
    const session = requireRole(req, res, 'technician'); if (!session) return;
    let body; try { body = await readJson(req); } catch { return json(res, 400, { error: 'invalid_json' }); }
    writeQuotes(readQuotes().filter(q => q.id !== body.id));
    return json(res, 200, { ok: true });
  }

  if (req.method === 'POST' && url.pathname === '/api/admin/quotes/send') {
    const session = requireRole(req, res, 'technician'); if (!session) return;
    let body; try { body = await readJson(req); } catch { return json(res, 400, { error: 'invalid_json' }); }
    if (!body.customerEmail) return json(res, 400, { error: 'customer_email_required' });
    const quotes = readQuotes();
    const quoteRef = body.quoteRef || ('QT-' + Date.now());
    const now = new Date().toLocaleDateString('en-AU', { day:'2-digit', month:'short', year:'numeric' });
    const existingQuote = body.sourceQuoteId ? quotes.find(q => q.id === body.sourceQuoteId) : null;
    const quoteToken = existingQuote?.quoteToken || randomId();
    const savedQuote = {
      id: body.sourceQuoteId || ('quot-' + Date.now()),
      name: body.customerName || '',
      email: body.customerEmail,
      status: 'quoted',
      kind: 'custom-pc-build',
      quoteRef,
      quoteToken,
      draftQuote: body,
      age: '0m',
      date: now,
      summary: `Quote ${quoteRef} — $${(body.grandTotal||0).toLocaleString('en-AU',{minimumFractionDigits:2})} AUD`,
    };
    const idx = quotes.findIndex(q => q.id === savedQuote.id);
    if (idx >= 0) { quotes[idx] = { ...quotes[idx], ...savedQuote }; } else { quotes.push(savedQuote); }
    writeQuotes(quotes);
    const tmpl = emailQuoteFormal({
      quoteRef,
      quoteId: savedQuote.id,
      quoteToken,
      customerName: body.customerName,
      validDays: body.validDays || 30,
      hardwareItems: body.hardwareItems || [],
      pcBuild: body.pcBuild,
      pcBuildFee: body.pcBuildFee || 0,
      otherItems: body.otherItems || [],
      grandTotal: body.grandTotal || 0,
      notes: body.notes || '',
    });
    const sent = await sendEmail({ to: body.customerEmail, ...tmpl });
    return json(res, 200, { ok: true, quoteRef, sent });
  }

  if (req.method === 'POST' && url.pathname === '/api/admin/ewaste/save') {
    const session = requireRole(req, res, 'technician'); if (!session) return;
    let body; try { body = await readJson(req); } catch { return json(res, 400, { error: 'invalid_json' }); }
    const intakes = readEwaste();
    const idx = intakes.findIndex(e => e.id && e.id === body.id);
    const isNew = idx < 0;
    if (idx >= 0) { intakes[idx] = body; } else { body.id = 'ew-' + Date.now(); intakes.push(body); }
    writeEwaste(intakes);
    if (isNew) {
      if (body.email) {
        const tmpl = emailEwasteConfirmation({ intakeId: body.id, customerName: body.name, description: body.description });
        sendEmail({ to: body.email, ...tmpl });
      }
      const staffTmpl = emailStaffNewEwaste({ intakeId: body.id, name: body.name, email: body.email, description: body.description });
      sendEmail({ to: getNotifyEmail(), ...staffTmpl });
    }
    return json(res, 200, { ok: true, item: body });
  }
  if (req.method === 'POST' && url.pathname === '/api/admin/ewaste/delete') {
    const session = requireRole(req, res, 'technician'); if (!session) return;
    let body; try { body = await readJson(req); } catch { return json(res, 400, { error: 'invalid_json' }); }
    writeEwaste(readEwaste().filter(e => e.id !== body.id));
    return json(res, 200, { ok: true });
  }

  if (req.method === 'POST' && url.pathname === '/api/admin/sellers/save') {
    const session = requireRole(req, res, 'manager'); if (!session) return;
    let body; try { body = await readJson(req); } catch { return json(res, 400, { error: 'invalid_json' }); }
    const consignments = readSellers();
    const idx = consignments.findIndex(s => s.id && s.id === body.id);
    if (idx >= 0) { consignments[idx] = body; } else { body.id = 'sel-' + Date.now(); consignments.push(body); }
    writeSellers(consignments);
    return json(res, 200, { ok: true, item: body });
  }
  if (req.method === 'POST' && url.pathname === '/api/admin/sellers/delete') {
    const session = requireRole(req, res, 'manager'); if (!session) return;
    let body; try { body = await readJson(req); } catch { return json(res, 400, { error: 'invalid_json' }); }
    writeSellers(readSellers().filter(s => s.id !== body.id));
    return json(res, 200, { ok: true });
  }

  // ── Seller billing API ───────────────────────────────────────────────────────

  if (req.method === 'GET' && url.pathname === '/api/admin/seller/billing') {
    const session = requireRole(req, res, 'seller'); if (!session) return;
    const sellerId = session.staffId;
    const balance = getSellerBalance(sellerId);
    const allTxns = readSellerLedger().filter(t => t.sellerId === sellerId);
    allTxns.sort((a, b) => new Date(b.date) - new Date(a.date));
    return json(res, 200, { balance, transactions: allTxns.slice(0, 50) });
  }

  if (req.method === 'POST' && url.pathname === '/api/admin/seller/setup-intent') {
    const session = requireRole(req, res, 'seller'); if (!session) return;
    if (!getStripeKey()) return json(res, 503, { error: 'stripe_not_configured' });
    const staffData = readStaff();
    const memberIdx = staffData.members.findIndex(m => m.id === session.staffId);
    if (memberIdx < 0) return json(res, 404, { error: 'not_found' });
    let seller = staffData.members[memberIdx];
    if (!seller.stripeCustomerId) {
      const custResp = await stripeRequest('POST', '/v1/customers', { email: seller.email || '', name: seller.name || '' }).catch(() => null);
      if (!custResp || custResp.status !== 200) return json(res, 502, { error: 'stripe_customer_failed' });
      seller = { ...seller, stripeCustomerId: custResp.body.id };
      staffData.members[memberIdx] = seller;
      writeStaff(staffData);
    }
    const siResp = await stripeRequest('POST', '/v1/setup_intents', { customer: seller.stripeCustomerId, 'payment_method_types[]': 'card' }).catch(() => null);
    if (!siResp || siResp.status !== 200) return json(res, 502, { error: 'stripe_setup_intent_failed' });
    return json(res, 200, { clientSecret: siResp.body.client_secret });
  }

  if (req.method === 'POST' && url.pathname === '/api/admin/seller/payment-method/save') {
    const session = requireRole(req, res, 'seller'); if (!session) return;
    if (!getStripeKey()) return json(res, 503, { error: 'stripe_not_configured' });
    let body; try { body = await readJson(req); } catch { return json(res, 400, { error: 'invalid_json' }); }
    const { paymentMethodId } = body || {};
    if (!paymentMethodId) return json(res, 400, { error: 'paymentMethodId required' });
    const staffData = readStaff();
    const memberIdx = staffData.members.findIndex(m => m.id === session.staffId);
    if (memberIdx < 0) return json(res, 404, { error: 'not_found' });
    const seller = staffData.members[memberIdx];
    // Fetch PM from Stripe
    const pmResp = await stripeRequest('GET', `/v1/payment_methods/${encodeURIComponent(paymentMethodId)}`, null).catch(() => null);
    if (!pmResp || pmResp.status !== 200) return json(res, 502, { error: 'stripe_pm_fetch_failed' });
    const pm = pmResp.body;
    const last4 = (pm.card && pm.card.last4) || '';
    const brand = (pm.card && pm.card.brand) || '';
    // Attach PM to customer
    if (seller.stripeCustomerId) {
      await stripeRequest('POST', `/v1/payment_methods/${encodeURIComponent(paymentMethodId)}/attach`, { customer: seller.stripeCustomerId }).catch(() => null);
      await stripeRequest('POST', `/v1/customers/${encodeURIComponent(seller.stripeCustomerId)}`, { 'invoice_settings[default_payment_method]': paymentMethodId }).catch(() => null);
    }
    staffData.members[memberIdx] = { ...seller, stripePaymentMethodId: paymentMethodId, stripeCardLast4: last4, stripeCardBrand: brand };
    writeStaff(staffData);
    return json(res, 200, { ok: true, last4, brand });
  }

  if (req.method === 'DELETE' && url.pathname === '/api/admin/seller/payment-method') {
    const session = requireRole(req, res, 'seller'); if (!session) return;
    if (!getStripeKey()) return json(res, 503, { error: 'stripe_not_configured' });
    const staffData = readStaff();
    const memberIdx = staffData.members.findIndex(m => m.id === session.staffId);
    if (memberIdx < 0) return json(res, 404, { error: 'not_found' });
    const seller = staffData.members[memberIdx];
    if (seller.stripePaymentMethodId) {
      await stripeRequest('POST', `/v1/payment_methods/${encodeURIComponent(seller.stripePaymentMethodId)}/detach`, {}).catch(() => null);
    }
    staffData.members[memberIdx] = { ...seller, stripePaymentMethodId: '', stripeCardLast4: '', stripeCardBrand: '' };
    writeStaff(staffData);
    return json(res, 200, { ok: true });
  }

  if (req.method === 'GET' && url.pathname === '/api/admin/seller-billing') {
    const session = requireRole(req, res, 'manager'); if (!session) return;
    const staffData = readStaff();
    const products = readProducts();
    const sellers = staffData.members.filter(m => m.role === 'seller');
    const result = sellers.map(s => {
      const activeListings = products.filter(p => p.createdBy === s.id && p.status === 'published').length;
      return {
        id: s.id,
        name: s.name,
        email: s.email,
        balance: getSellerBalance(s.id),
        cardLast4: s.stripeCardLast4 || '',
        cardBrand: s.stripeCardBrand || '',
        hasCard: !!(s.stripePaymentMethodId),
        activeListings,
      };
    });
    return json(res, 200, { sellers: result });
  }

  if (req.method === 'GET' && url.pathname.startsWith('/api/admin/seller-billing/transactions/')) {
    const session = requireRole(req, res, 'manager'); if (!session) return;
    const sellerId = decodeURIComponent(url.pathname.split('/').pop() || '');
    const txns = readSellerLedger().filter(t => t.sellerId === sellerId);
    txns.sort((a, b) => new Date(b.date) - new Date(a.date));
    return json(res, 200, { transactions: txns });
  }

  if (req.method === 'POST' && url.pathname === '/api/admin/seller-billing/charge-now') {
    const session = requireAdmin(req, res); if (!session) return;
    await runMonthlyListingFees();
    return json(res, 200, { ok: true });
  }

  if (req.method === 'POST' && url.pathname === '/api/admin/groups/save') {
    const session = requireRole(req, res, 'manager'); if (!session) return;
    let body; try { body = await readJson(req); } catch { return json(res, 400, { error: 'invalid_json' }); }
    const groups = readGroups();
    const idx = groups.findIndex(g => g.id && g.id === body.id);
    if (idx >= 0) { groups[idx] = body; } else { body.id = 'grp-' + Date.now(); groups.push(body); }
    writeGroups(groups);
    return json(res, 200, { ok: true, item: body });
  }
  if (req.method === 'POST' && url.pathname === '/api/admin/groups/delete') {
    const session = requireRole(req, res, 'manager'); if (!session) return;
    let body; try { body = await readJson(req); } catch { return json(res, 400, { error: 'invalid_json' }); }
    writeGroups(readGroups().filter(g => g.id !== body.id));
    return json(res, 200, { ok: true });
  }

  if (req.method === 'POST' && url.pathname === '/api/admin/software/save') {
    const session = requireRole(req, res, 'manager'); if (!session) return;
    let body; try { body = await readJson(req); } catch { return json(res, 400, { error: 'invalid_json' }); }
    const items = readSoftware(); const idx = items.findIndex(x => x.id && x.id === body.id);
    if (idx >= 0) items[idx] = body; else { body.id = 'sw-' + Date.now(); items.push(body); }
    writeSoftware(items); return json(res, 200, { ok: true, item: body });
  }

  if (req.method === 'POST' && url.pathname === '/api/admin/tutorials/save') {
    const session = requireRole(req, res, 'manager'); if (!session) return;
    let body; try { body = await readJson(req); } catch { return json(res, 400, { error: 'invalid_json' }); }
    const items = readTutorials(); const idx = items.findIndex(x => x.id && x.id === body.id);
    if (idx >= 0) items[idx] = body; else { body.id = 'tut-' + Date.now(); items.push(body); }
    writeTutorials(items); return json(res, 200, { ok: true, item: body });
  }

  if (req.method === 'POST' && url.pathname === '/api/admin/ai/save') {
    const session = requireRole(req, res, 'manager'); if (!session) return;
    let body; try { body = await readJson(req); } catch { return json(res, 400, { error: 'invalid_json' }); }
    writeAI({ models: body.models || [], boxes: body.boxes || [] });
    return json(res, 200, { ok: true, models: body.models || [], boxes: body.boxes || [] });
  }

  if (req.method === 'POST' && url.pathname === '/api/admin/policies/save') {
    const session = requireRole(req, res, 'manager'); if (!session) return;
    let body; try { body = await readJson(req); } catch { return json(res, 400, { error: 'invalid_json' }); }
    const validationError = validatePolicyPayload(body);
    if (validationError) return json(res, 400, { error: 'invalid_policy', message: validationError });
    const items = readPolicies();
    const nowIso = new Date().toISOString();
    const normalizedSlug = normalizePolicySlug(body.slug);
    const idx = items.findIndex(x => x.id && x.id === body.id);
    const duplicateSlug = items.some((item, itemIndex) => itemIndex !== idx && normalizePolicySlug(item.slug) === normalizedSlug);
    if (duplicateSlug) return json(res, 409, { error: 'slug_exists', message: 'A policy with this slug already exists.' });
    const existing = idx >= 0 ? items[idx] : null;
    const isPublished = body.status === 'published';
    const updated = {
      ...existing, ...body,
      id: existing?.id || body.id || `policy-${Date.now()}`,
      slug: normalizedSlug, title: body.title.trim(), body: body.body.trim(),
      status: isPublished ? 'published' : 'draft',
      updatedAt: nowIso, updatedBy: session.username,
      createdAt: existing?.createdAt || nowIso, createdBy: existing?.createdBy || session.username,
      publishedAt: isPublished ? (body.publishedAt || existing?.publishedAt || nowIso) : null,
      publishedBy: isPublished ? (body.publishedBy || existing?.publishedBy || session.username) : null,
    };
    if (idx >= 0) items[idx] = updated; else items.push(updated);
    writePolicies(items); return json(res, 200, { ok: true, item: updated });
  }

  if (req.method === 'POST' && url.pathname === '/api/admin/policies/publish') {
    const session = requireRole(req, res, 'manager'); if (!session) return;
    let body; try { body = await readJson(req); } catch { return json(res, 400, { error: 'invalid_json' }); }
    if (!body || typeof body.id !== 'string' || !body.id.trim()) return json(res, 400, { error: 'invalid_policy_id', message: 'Field "id" is required.' });
    if (!['published', 'draft'].includes(body.status)) return json(res, 400, { error: 'invalid_status', message: 'Field "status" must be "published" or "draft".' });
    const items = readPolicies();
    const idx = items.findIndex(x => x.id === body.id);
    if (idx < 0) return json(res, 404, { error: 'policy_not_found' });
    const nowIso = new Date().toISOString();
    const item = items[idx];
    const next = { ...item, status: body.status, updatedAt: nowIso, updatedBy: session.username, publishedAt: body.status === 'published' ? (item.publishedAt || nowIso) : null, publishedBy: body.status === 'published' ? (item.publishedBy || session.username) : null };
    items[idx] = next;
    writePolicies(items);
    return json(res, 200, { ok: true, item: next });
  }

  if (req.method === 'POST' && url.pathname === '/api/admin/settings/save') {
    const session = requireAdmin(req, res); if (!session) return;
    let body; try { body = await readJson(req); } catch { return json(res, 400, { error: 'invalid_json' }); }
    const existing = readSettings();
    const existingByName = Object.fromEntries((existing.integrations || []).map(r => [r[0], r[3] || {}]));
    const mergedIntegrations = (body.integrations || []).map(r => {
      const existingConfig = existingByName[r[0]] || {};
      const incomingConfig = r[3] || {};
      const config = { ...existingConfig };
      for (const [k, v] of Object.entries(incomingConfig)) { config[k] = v; }
      return [r[0], r[1], !!r[2], config];
    });
    const security = { ...(existing.security || {}) };
    if ((body.security?.adminUsername || '').trim()) security.adminUsername = body.security.adminUsername.trim();
    const newPass = (body.security?.adminPassword || '').trim();
    if (newPass && newPass !== '***') security.adminPasswordHash = hashPassword(newPass);
    const payload = { shop: body.shop || {}, announcement: body.announcement || { text: '', enabled: false, expiresAt: '' }, maintenance: body.maintenance || { enabled: false }, staff: body.staff || [], integrations: mergedIntegrations, siteContent: body.siteContent || {}, security };
    writeSettings(payload);
    pushMaintenanceEvent(!!(payload.maintenance && payload.maintenance.enabled));
    const maskedPayload = {
      ...payload,
      integrations: payload.integrations.map(r => [r[0], r[1], r[2], maskIntegrationConfig(r[0], r[3])]),
      security: { adminUsername: security.adminUsername || '' },
    };
    return json(res, 200, { ok: true, ...maskedPayload });
  }

  if (req.method === 'POST' && url.pathname === '/api/admin/maintenance') {
    const session = requireAdmin(req, res); if (!session) return;
    let body; try { body = await readJson(req); } catch { return json(res, 400, { error: 'invalid_json' }); }
    const enabled = body.enabled === true;
    const s = readSettings();
    writeSettings({ ...s, maintenance: { enabled } });
    pushMaintenanceEvent(enabled);
    return json(res, 200, { ok: true, enabled });
  }

  if (req.method === 'GET' && url.pathname === '/api/admin/expenses') {
    const session = requireRole(req, res, 'staff'); if (!session) return;
    return json(res, 200, { items: readExpenses() });
  }
  if (req.method === 'POST' && url.pathname === '/api/admin/expenses/save') {
    const session = requireRole(req, res, 'manager'); if (!session) return;
    let body; try { body = await readJson(req); } catch { return json(res, 400, { error: 'invalid_json' }); }
    const items = readExpenses();
    const idx = items.findIndex(e => e.id && e.id === body.id);
    if (idx >= 0) { items[idx] = body; } else { body.id = 'exp-' + Date.now(); items.push(body); }
    writeExpenses(items);
    return json(res, 200, { ok: true, item: body });
  }
  if (req.method === 'POST' && url.pathname === '/api/admin/expenses/delete') {
    const session = requireRole(req, res, 'manager'); if (!session) return;
    let body; try { body = await readJson(req); } catch { return json(res, 400, { error: 'invalid_json' }); }
    writeExpenses(readExpenses().filter(e => e.id !== body.id));
    return json(res, 200, { ok: true });
  }

  // ── Admin: Memberships ──────────────────────────────────────
  if (req.method === 'GET' && url.pathname === '/api/admin/memberships') {
    const session = requireRole(req, res, 'manager'); if (!session) return;
    return json(res, 200, readMemberships());
  }
  if (req.method === 'POST' && url.pathname === '/api/admin/memberships/tiers/save') {
    const session = requireRole(req, res, 'manager'); if (!session) return;
    let body; try { body = await readJson(req); } catch { return json(res, 400, { error: 'invalid_json' }); }
    if (!body || !body.name) return json(res, 422, { error: 'name_required' });
    const mb = readMemberships();
    if (!body.id) body.id = 'tier-' + Date.now();
    const idx = mb.tiers.findIndex(t => t.id === body.id);
    if (idx >= 0) mb.tiers[idx] = body; else mb.tiers.push(body);
    writeMemberships(mb);
    return json(res, 200, { ok: true, item: body });
  }
  if (req.method === 'POST' && url.pathname === '/api/admin/memberships/tiers/delete') {
    const session = requireRole(req, res, 'manager'); if (!session) return;
    let body; try { body = await readJson(req); } catch { return json(res, 400, { error: 'invalid_json' }); }
    const mb = readMemberships();
    mb.tiers = mb.tiers.filter(t => t.id !== body.id);
    writeMemberships(mb);
    return json(res, 200, { ok: true });
  }
  if (req.method === 'POST' && url.pathname === '/api/admin/memberships/subscriptions/cancel') {
    const session = requireRole(req, res, 'manager'); if (!session) return;
    let body; try { body = await readJson(req); } catch { return json(res, 400, { error: 'invalid_json' }); }
    const mb = readMemberships();
    const sub = mb.subscriptions.find(s => s.id === body.subId);
    if (sub) { sub.status = 'cancelled'; sub.cancelledAt = new Date().toISOString(); sub.cancelReason = 'admin_cancelled'; }
    writeMemberships(mb);
    return json(res, 200, { ok: true });
  }
  if (req.method === 'POST' && url.pathname === '/api/admin/memberships/activate') {
    const session = requireRole(req, res, 'manager'); if (!session) return;
    let body; try { body = await readJson(req); } catch { return json(res, 400, { error: 'invalid_json' }); }
    const orders = readOrders();
    const order = orders.find(o => o.id === body.orderId);
    if (!order || !order.pendingMembershipActivation) return json(res, 404, { error: 'not_found' });
    const { tierId, email } = order.pendingMembershipActivation;
    const mb = readMemberships();
    const tier = mb.tiers.find(t => t.id === tierId);
    if (!tier) return json(res, 404, { error: 'tier_not_found' });
    const forumData = readForum();
    const user = (forumData.users || []).find(u => u.email === email);
    if (!user) return json(res, 404, { error: 'user_not_found', message: 'No portal account found for ' + email });
    mb.subscriptions = (mb.subscriptions || []).map(s => s.userId === user.id && s.status === 'active'
      ? { ...s, status: 'cancelled', cancelReason: 'replaced_by_admin_activation', cancelledAt: new Date().toISOString() }
      : s);
    mb.subscriptions.push({ id: 'sub-' + Date.now(), userId: user.id, username: user.username, tierId, orderId: order.id, status: 'active', startDate: new Date().toISOString() });
    writeMemberships(mb);
    delete order.pendingMembershipActivation;
    writeOrders(orders);
    const tmpl = emailMembershipWelcome({ customerName: user.displayName || user.username, tierName: tier.name });
    sendEmail({ to: email, ...tmpl }).catch(() => {});
    return json(res, 200, { ok: true });
  }

  if (req.method === 'GET' && url.pathname === '/api/admin/staff') {
    const session = requireRole(req, res, 'staff'); if (!session) return;
    const staffData = readStaff();
    const sanitised = { ...staffData, members: staffData.members.map(({ pinHash: _p, ...m }) => m) };
    return json(res, 200, sanitised);
  }
  if (req.method === 'GET' && url.pathname === '/api/admin/staff/stats') {
    const session = requireRole(req, res, 'staff'); if (!session) return;
    const data = readStaff();
    const stats = data.members.map(m => buildStaffStats(m.id, data));
    return json(res, 200, { stats });
  }
  if (req.method === 'POST' && url.pathname === '/api/admin/staff/members/save') {
    const session = requireRole(req, res, 'seller'); if (!session) return;
    let body; try { body = await readJson(req); } catch { return json(res, 400, { error: 'invalid_json' }); }
    if (!body || typeof body.name !== 'string' || !body.name.trim()) return json(res, 422, { error: 'invalid_payload', message: 'Field "name" is required.' });
    if (session.role === 'seller' && body.id !== session.staffId) return json(res, 403, { error: 'forbidden' });
    if (session.role !== 'owner') { delete body.role; delete body.status; }
    if (typeof body.pin === 'string' && body.pin.length > 0) {
      if (!/^\d{4,6}$/.test(body.pin)) return json(res, 422, { error: 'invalid_payload', message: 'PIN must be 4–6 digits.' });
      body.pinHash = hashPassword(body.pin);
    }
    delete body.pin;
    const data = readStaff();
    const idx = data.members.findIndex(m => m.id && m.id === body.id);
    if (idx >= 0) { data.members[idx] = { ...data.members[idx], ...body }; } else { body.id = 'staff-' + Date.now(); data.members.push(body); }
    writeStaff(data);
    return json(res, 200, { ok: true, item: data.members[idx >= 0 ? idx : data.members.length - 1] });
  }
  if (req.method === 'POST' && url.pathname === '/api/admin/staff/members/delete') {
    const session = requireAdmin(req, res); if (!session) return;
    let body; try { body = await readJson(req); } catch { return json(res, 400, { error: 'invalid_json' }); }
    const data = readStaff();
    data.members = data.members.filter(m => m.id !== body.id);
    writeStaff(data);
    return json(res, 200, { ok: true });
  }
  if (req.method === 'POST' && url.pathname === '/api/admin/staff/active-jobs/save') {
    const session = requireRole(req, res, 'technician'); if (!session) return;
    let body; try { body = await readJson(req); } catch { return json(res, 400, { error: 'invalid_json' }); }
    if (!body || !body.staffId) return json(res, 422, { error: 'invalid_payload', message: 'Field "staffId" is required.' });
    const data = readStaff();
    const idx = data.activeJobs.findIndex(j => j.id && j.id === body.id);
    if (idx >= 0) { data.activeJobs[idx] = body; } else { body.id = 'aj-' + Date.now(); body.assignedAt = body.assignedAt || new Date().toISOString(); data.activeJobs.push(body); }
    writeStaff(data);
    return json(res, 200, { ok: true, item: body });
  }
  if (req.method === 'POST' && url.pathname === '/api/admin/staff/active-jobs/delete') {
    const session = requireRole(req, res, 'technician'); if (!session) return;
    let body; try { body = await readJson(req); } catch { return json(res, 400, { error: 'invalid_json' }); }
    const data = readStaff();
    data.activeJobs = data.activeJobs.filter(j => j.id !== body.id);
    writeStaff(data);
    return json(res, 200, { ok: true });
  }
  if (req.method === 'POST' && url.pathname === '/api/admin/staff/active-jobs/complete') {
    const session = requireRole(req, res, 'technician'); if (!session) return;
    let body; try { body = await readJson(req); } catch { return json(res, 400, { error: 'invalid_json' }); }
    const data = readStaff();
    const job = data.activeJobs.find(j => j.id === body.id);
    if (!job) return json(res, 404, { error: 'job_not_found' });
    data.activeJobs = data.activeJobs.filter(j => j.id !== body.id);
    const completed = { ...job, ...body, completedAt: body.completedAt || new Date().toISOString() };
    data.completedJobs.push(completed);
    writeStaff(data);
    return json(res, 200, { ok: true, item: completed });
  }
  if (req.method === 'POST' && url.pathname === '/api/admin/staff/completed-jobs/save') {
    const session = requireRole(req, res, 'technician'); if (!session) return;
    let body; try { body = await readJson(req); } catch { return json(res, 400, { error: 'invalid_json' }); }
    const data = readStaff();
    const idx = data.completedJobs.findIndex(j => j.id && j.id === body.id);
    if (idx >= 0) { data.completedJobs[idx] = body; } else { body.id = 'cj-' + Date.now(); data.completedJobs.push(body); }
    writeStaff(data);
    return json(res, 200, { ok: true, item: body });
  }
  if (req.method === 'POST' && url.pathname === '/api/admin/staff/completed-jobs/delete') {
    const session = requireRole(req, res, 'technician'); if (!session) return;
    let body; try { body = await readJson(req); } catch { return json(res, 400, { error: 'invalid_json' }); }
    const data = readStaff();
    data.completedJobs = data.completedJobs.filter(j => j.id !== body.id);
    writeStaff(data);
    return json(res, 200, { ok: true });
  }

  if (req.method === 'POST' && url.pathname === '/api/admin/repairs/save') {
    const session = requireRole(req, res, 'technician'); if (!session) return;
    let body; try { body = await readJson(req); } catch { return json(res, 400, { error: 'invalid_json' }); }
    // Detect cards that changed column since last save — email customer
    const prev = readRepairs();
    const prevCardCol = {};
    (prev.columns || []).forEach(col => (col.cards || []).forEach(c => { prevCardCol[c.id] = col.id; }));
    writeRepairs(body);
    (body.columns || []).forEach(col => {
      (col.cards || []).forEach(card => {
        const wasIn = prevCardCol[card.id];
        if (wasIn && wasIn !== col.id && card.email) {
          const tmpl = emailRepairUpdate({ repairId: card.id, customerName: card.customer || card.name, status: col.label || col.id, notes: card.notes });
          sendEmail({ to: card.email, ...tmpl });
          if ((col.label || col.id) === 'Done') {
            const pts = Math.floor(Number(card.total || card.cost) || 0);
            if (pts > 0) grantRewardPoints(card.email, pts, 'repair', `Repair ${card.id}`, `repair-${card.id}`);
          }
        }
      });
    });
    return json(res, 200, { ok: true });
  }

  if (req.method === 'GET' && url.pathname === '/api/admin/rewards') {
    const session = requireRole(req, res, 'manager'); if (!session) return;
    const db = readRewards();
    const forum = readForum();
    const entries = db.entries.map(e => {
      const user = Array.isArray(forum.users) ? forum.users.find(u => u.id === e.userId) : null;
      return { ...e, displayName: user?.displayName || '', username: user?.username || '', email: user?.email || e.email || '' };
    });
    return json(res, 200, { entries });
  }

  if (req.method === 'POST' && url.pathname === '/api/admin/rewards/grant') {
    const session = requireRole(req, res, 'manager'); if (!session) return;
    let body; try { body = await readJson(req); } catch { return json(res, 400, { error: 'invalid_json' }); }
    const { userId, points, description } = body || {};
    if (!userId) return json(res, 422, { error: 'userId_required' });
    const pts = Number(points);
    if (!pts || pts <= 0) return json(res, 422, { error: 'invalid_points' });
    const db = readRewards();
    let entry = db.entries.find(e => e.userId === userId);
    if (!entry) { entry = { userId, points: 0, history: [] }; db.entries.push(entry); }
    entry.points += pts;
    entry.history.push({ id: 'rh-' + Date.now(), type: 'grant', points: pts, description: description || '', date: new Date().toISOString() });
    writeRewards(db);
    return json(res, 200, { ok: true, entry });
  }

  if (req.method === 'POST' && url.pathname === '/api/admin/rewards/adjust') {
    const session = requireRole(req, res, 'manager'); if (!session) return;
    let body; try { body = await readJson(req); } catch { return json(res, 400, { error: 'invalid_json' }); }
    const { userId, points, description } = body || {};
    if (!userId) return json(res, 422, { error: 'userId_required' });
    const pts = Number(points);
    if (!pts || pts === 0) return json(res, 422, { error: 'invalid_points' });
    const db = readRewards();
    let entry = db.entries.find(e => e.userId === userId);
    if (!entry) { entry = { userId, points: 0, history: [] }; db.entries.push(entry); }
    entry.points = Math.max(0, entry.points + pts);
    entry.history.push({ id: 'rh-' + Date.now(), type: pts > 0 ? 'grant' : 'adjust', points: pts, description: description || '', date: new Date().toISOString() });
    writeRewards(db);
    return json(res, 200, { ok: true, entry });
  }

  if (req.method === 'GET' && url.pathname === '/api/admin/store-credit') {
    const session = requireRole(req, res, 'manager'); if (!session) return;
    const db = readStoreCredits();
    const forum = readForum();
    const entries = db.entries.map(e => {
      const user = Array.isArray(forum.users) ? forum.users.find(u => u.id === e.userId) : null;
      return { ...e, displayName: user?.displayName || '', username: user?.username || '', email: user?.email || e.email || '' };
    });
    return json(res, 200, { entries });
  }

  if (req.method === 'POST' && url.pathname === '/api/admin/store-credit/adjust') {
    const session = requireRole(req, res, 'manager'); if (!session) return;
    let body; try { body = await readJson(req); } catch { return json(res, 400, { error: 'invalid_json' }); }
    const { userId, amount, description } = body || {};
    if (!userId) return json(res, 422, { error: 'userId_required' });
    const amt = roundCents(amount);
    if (!amt || amt === 0) return json(res, 422, { error: 'invalid_amount' });
    const db = readStoreCredits();
    let entry = db.entries.find(e => e.userId === userId);
    if (!entry) {
      const forum = readForum();
      const user = Array.isArray(forum.users) ? forum.users.find(u => u.id === userId) : null;
      entry = { userId, email: user ? String(user.email || '').toLowerCase() : '', balance: 0, history: [] };
      db.entries.push(entry);
    }
    entry.balance = roundCents(Math.max(0, entry.balance + amt));
    entry.history.push({ id: 'sc-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6), type: amt > 0 ? 'grant' : 'adjust', amount: amt, description: description || '', refId: null, date: new Date().toISOString() });
    writeStoreCredits(db);
    return json(res, 200, { ok: true, entry });
  }

  if (req.method === 'GET' && url.pathname === '/api/admin/bookings') {
    const session = requireAdmin(req, res); if (!session) return;
    const db = readBookings();
    return json(res, 200, { items: db.bookings });
  }

  if (req.method === 'POST' && url.pathname === '/api/admin/bookings/update') {
    const session = requireAdmin(req, res); if (!session) return;
    let body; try { body = await readJson(req); } catch { return json(res, 400, { error: 'invalid_json' }); }
    const { id, status } = body || {};
    if (!id) return json(res, 422, { error: 'id_required' });
    const db = readBookings();
    const idx = db.bookings.findIndex(b => b.id === id);
    if (idx < 0) return json(res, 404, { error: 'not_found' });
    db.bookings[idx] = { ...db.bookings[idx], status };
    writeBookings(db);
    return json(res, 200, { ok: true, booking: db.bookings[idx] });
  }

  if (url.pathname === '/admin-login.html' || url.pathname === '/') {
    const ip = getIp(req);
    if (!isIpAllowed(ip)) return json(res, 403, { error: 'forbidden' });
  }

  return serveStatic(req, res, url.pathname, '/dist/admin-login.html', null);
  } catch (err) {
    console.error('[adminServer] unhandled error:', err);
    if (!res.headersSent) json(res, 500, { error: 'server_error', message: 'An unexpected error occurred.' });
  }
});

// ── Portal server (8083) ──────────────────────────────────────────────────────

const PORTAL_CORS_ORIGINS = new Set([
  process.env.SITE_URL || `http://localhost:${MAIN_PORT}`,
  FORUM_URL,
  GAMES_URL,
].filter(Boolean));

const portalServer = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (checkMaintenance(req, res, url)) return;

  // CORS for cross-origin endpoints (portal runs on a different port/origin)
  const crossOriginPaths = ['/api/portal/auth/logout', '/api/portal/auth/me', '/api/csrf-token'];
  if (crossOriginPaths.includes(url.pathname) || url.pathname.startsWith('/api/portal/')) {
    const reqOrigin = req.headers['origin'] || '';
    const allowedOrigin = PORTAL_CORS_ORIGINS.has(reqOrigin) ? reqOrigin : [...PORTAL_CORS_ORIGINS][0];
    res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-CSRF-Token');
  }

  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }

  if (req.method === 'GET' && url.pathname === '/api/csrf-token') {
    const token = ensureCsrfCookie(req, res);
    return json(res, 200, { token });
  }

  if (req.method === 'POST' || req.method === 'PATCH') {
    if (!verifyCsrf(req, res)) return;
  }

  if (req.method === 'GET' && url.pathname === '/api/portal/auth/me') {
    const session = getPortalSession(req);
    if (!session) return json(res, 200, { user: null });
    return json(res, 200, { user: { id: session.id, username: session.username, displayName: session.displayName, createdAt: session.createdAt } });
  }

  // Universal auth aliases (same handlers as all other servers)
  if (req.method === 'GET'  && url.pathname === '/api/auth/me')       return handleCustomerMe(req, res);
  if (req.method === 'POST' && url.pathname === '/api/auth/register') return handleCustomerRegister(req, res);
  if (req.method === 'POST' && url.pathname === '/api/auth/login')    return handleCustomerLogin(req, res);
  if (req.method === 'POST' && url.pathname === '/api/auth/logout')   return handleCustomerLogout(req, res);
  // Legacy portal-prefixed paths — delegate to shared handlers
  if (req.method === 'POST' && url.pathname === '/api/portal/auth/register') return handleCustomerRegister(req, res);
  if (req.method === 'POST' && url.pathname === '/api/portal/auth/login')    return handleCustomerLogin(req, res);
  if (req.method === 'POST' && url.pathname === '/api/portal/auth/logout')   return handleCustomerLogout(req, res);

  if (req.method === 'PATCH' && url.pathname === '/api/portal/profile') {
    const session = getPortalSession(req);
    if (!session) return json(res, 401, { error: 'login_required' });
    let body; try { body = await readJson(req); } catch { return json(res, 400, { error: 'invalid_json' }); }
    const forum = readForum();
    if (!Array.isArray(forum.users)) forum.users = [];
    const userIdx = forum.users.findIndex(u => u.id === session.id);
    if (userIdx < 0) return json(res, 404, { error: 'user_not_found' });
    const user = { ...forum.users[userIdx] };
    if (typeof body.displayName === 'string') {
      const dn = body.displayName.trim();
      if (dn.length > 50) return json(res, 422, { error: 'invalid_payload', message: 'Display name must be 50 characters or fewer.' });
      user.displayName = dn;
    }
    if (typeof body.email === 'string') {
      user.email = body.email.trim().toLowerCase();
    }
    if (typeof body.newPassword === 'string') {
      if (typeof body.currentPassword !== 'string' || !verifyPassword(body.currentPassword, user.passwordHash)) {
        return json(res, 401, { error: 'invalid_password', message: 'Current password is incorrect.' });
      }
      if (body.newPassword.length < 8) return json(res, 422, { error: 'invalid_payload', message: 'New password must be at least 8 characters.' });
      user.passwordHash = hashPassword(body.newPassword);
    }
    forum.users[userIdx] = user;
    writeForum(forum);
    portalSessions.set(session.sid, { ...portalSessions.get(session.sid), displayName: user.displayName });
    saveSessionsToDisk(PORTAL_SESSIONS_DB_PATH, portalSessions);
    return json(res, 200, { ok: true, user: { id: user.id, username: user.username, displayName: user.displayName, createdAt: user.createdAt } });
  }

  if (req.method === 'GET' && url.pathname === '/api/portal/addresses') {
    const session = getPortalSession(req);
    if (!session) return json(res, 401, { error: 'login_required' });
    const forum = readForum();
    const user = Array.isArray(forum.users) ? forum.users.find(u => u.id === session.id) : null;
    return json(res, 200, { addresses: user?.addresses || [] });
  }

  if (req.method === 'POST' && url.pathname === '/api/portal/addresses/save') {
    const session = getPortalSession(req);
    if (!session) return json(res, 401, { error: 'login_required' });
    let body; try { body = await readJson(req); } catch { return json(res, 400, { error: 'invalid_json' }); }
    const { name, line1, line2, city, state, postcode, country } = body || {};
    if (!name || !line1 || !city || !state || !postcode) return json(res, 422, { error: 'missing_fields', message: 'Name, street, city, state and postcode are required.' });
    const forum = readForum();
    if (!Array.isArray(forum.users)) forum.users = [];
    const idx = forum.users.findIndex(u => u.id === session.id);
    if (idx < 0) return json(res, 404, { error: 'user_not_found' });
    const addr = { id: 'addr-' + Date.now(), name: String(name).trim(), line1: String(line1).trim(), line2: String(line2||'').trim(), city: String(city).trim(), state: String(state).trim(), postcode: String(postcode).trim(), country: String(country||'AU').trim() };
    forum.users[idx].addresses = [...(forum.users[idx].addresses || []), addr];
    writeForum(forum);
    return json(res, 201, { ok: true, address: addr });
  }

  if (req.method === 'POST' && url.pathname === '/api/portal/addresses/delete') {
    const session = getPortalSession(req);
    if (!session) return json(res, 401, { error: 'login_required' });
    let body; try { body = await readJson(req); } catch { return json(res, 400, { error: 'invalid_json' }); }
    const forum = readForum();
    if (!Array.isArray(forum.users)) forum.users = [];
    const idx = forum.users.findIndex(u => u.id === session.id);
    if (idx < 0) return json(res, 404, { error: 'user_not_found' });
    forum.users[idx].addresses = (forum.users[idx].addresses || []).filter(a => a.id !== body.id);
    writeForum(forum);
    return json(res, 200, { ok: true });
  }

  if (req.method === 'GET' && url.pathname === '/api/portal/orders') {
    const session = getPortalSession(req);
    if (!session) return json(res, 401, { error: 'login_required' });
    const forumDb = readForum();
    const portalUser = Array.isArray(forumDb.users) ? forumDb.users.find(u => u.id === session.id) : null;
    const sessionEmail = portalUser ? String(portalUser.email || '').toLowerCase() : '';
    if (!sessionEmail) return json(res, 200, { items: [] });
    const orders = readOrders();
    const quotes = readQuotes();
    const matched = orders
      .filter(o => String(o.email || '').toLowerCase() === sessionEmail)
      .map(o => hydrateOrder(o, quotes));
    return json(res, 200, { items: matched });
  }

  if (req.method === 'POST' && url.pathname === '/api/portal/orders/pay') {
    const session = getPortalSession(req);
    if (!session) return json(res, 401, { error: 'login_required' });
    if (!getStripeKey()) return json(res, 503, { error: 'stripe_not_configured', message: 'Online payment is not configured. Please contact us to arrange payment.' });
    let body; try { body = await readJson(req); } catch { return json(res, 400, { error: 'invalid_json' }); }
    if (!body.orderId) return json(res, 400, { error: 'order_id_required' });
    const forumDb = readForum();
    const portalUser = Array.isArray(forumDb.users) ? forumDb.users.find(u => u.id === session.id) : null;
    const sessionEmail = portalUser ? String(portalUser.email || '').toLowerCase() : '';
    const orders = readOrders();
    const oIdx = orders.findIndex(o => o.id === body.orderId && String(o.email || '').toLowerCase() === sessionEmail);
    if (oIdx < 0) return json(res, 404, { error: 'order_not_found' });
    const order = orders[oIdx];
    const paid = (order.payments || []).reduce((s, p) => s + (Number(p.amount) || 0), 0);
    const outstanding = Math.round((Number(order.total || 0) - paid) * 100);
    if (outstanding <= 0) return json(res, 409, { error: 'already_paid', message: 'This order has already been paid.' });
    const params = {
      'mode': 'payment',
      'success_url': `${getPortalUrl()}/orders?paid=${encodeURIComponent(order.id)}`,
      'cancel_url': `${getPortalUrl()}/orders`,
      'customer_email': order.email,
      'payment_intent_data[metadata][source]': 'portal',
      'payment_intent_data[metadata][existingOrderId]': order.id,
      'line_items[0][price_data][currency]': 'aud',
      'line_items[0][price_data][unit_amount]': String(outstanding),
      'line_items[0][price_data][product_data][name]': order.quoteRef ? `Quote ${order.quoteRef}` : (order.items || 'Order'),
      'line_items[0][quantity]': '1',
    };
    const resp = await stripeRequest('POST', '/v1/checkout/sessions', params).catch(() => null);
    if (!resp || resp.status !== 200) return json(res, 502, { error: 'stripe_error', message: 'Could not create payment session. Please try again.' });
    const stripeSession = resp.body;
    orders[oIdx] = { ...order, stripeSessionId: stripeSession.id };
    writeOrders(orders);
    return json(res, 200, { ok: true, url: stripeSession.url });
  }

  if (req.method === 'GET' && url.pathname === '/api/portal/repairs') {
    const session = getPortalSession(req);
    if (!session) return json(res, 401, { error: 'login_required' });
    const repairs = readRepairs();
    const allCards = (repairs.columns || []).flatMap(col =>
      (col.cards || []).map(card => ({ ...card, column: col.title || col.id }))
    );
    const forumDb = readForum();
    const portalUser = Array.isArray(forumDb.users) ? forumDb.users.find(u => u.id === session.id) : null;
    const sessionEmail = portalUser ? String(portalUser.email || '').toLowerCase() : '';
    if (!sessionEmail) return json(res, 200, { items: [] });
    const matched = allCards.filter(c => {
      const cardEmail = String(c.email || '').toLowerCase();
      return cardEmail && cardEmail === sessionEmail;
    });
    return json(res, 200, { items: matched });
  }

  if (req.method === 'GET' && url.pathname === '/api/portal/quotes') {
    const session = getPortalSession(req);
    if (!session) return json(res, 401, { error: 'login_required' });
    const forumDb = readForum();
    const portalUser = Array.isArray(forumDb.users) ? forumDb.users.find(u => u.id === session.id) : null;
    const sessionEmail = portalUser ? String(portalUser.email || '').toLowerCase() : '';
    if (!sessionEmail) return json(res, 200, { items: [] });
    const quotes = readQuotes();
    const matched = quotes.filter(q => {
      const email = String(q.email || '').toLowerCase();
      return email && email === sessionEmail;
    });
    return json(res, 200, { items: matched });
  }

  if (req.method === 'GET' && url.pathname === '/api/quote/token') {
    const token = url.searchParams.get('token');
    if (!token) return json(res, 400, { error: 'token_required' });
    const quotes = readQuotes();
    const quote = quotes.find(q => q.quoteToken === token);
    if (!quote) return json(res, 404, { error: 'not_found' });
    const dq = quote.draftQuote || {};
    return json(res, 200, {
      ok: true,
      quote: {
        id: quote.id,
        quoteRef: quote.quoteRef || quote.id,
        name: quote.name,
        email: quote.email,
        status: quote.status,
        validDays: dq.validDays,
        hardwareItems: dq.hardwareItems || [],
        pcBuild: dq.pcBuild || false,
        pcBuildFee: dq.pcBuildFee || 0,
        otherItems: dq.otherItems || [],
        grandTotal: dq.grandTotal || 0,
        notes: dq.notes || '',
      },
    });
  }

  if (req.method === 'POST' && url.pathname === '/api/quote/accept-token') {
    if (publicRateLimited(getIp(req), 'register')) return json(res, 429, { error: 'too_many_requests' });
    let body; try { body = await readJson(req); } catch { return json(res, 400, { error: 'invalid_json' }); }
    const { token, username, password, displayName } = body || {};
    if (!token) return json(res, 400, { error: 'token_required' });
    const quotes = readQuotes();
    const qIdx = quotes.findIndex(q => q.quoteToken === token);
    if (qIdx < 0) return json(res, 404, { error: 'not_found' });
    const quote = quotes[qIdx];
    if (quote.status !== 'quoted') return json(res, 409, { error: 'quote_not_actionable', message: 'This quote has already been accepted or is not ready for acceptance.' });
    const forum = readForum();
    if (!Array.isArray(forum.users)) forum.users = [];
    const quoteEmail = String(quote.email || '').toLowerCase();
    const existingUser = forum.users.find(u => String(u.email || '').toLowerCase() === quoteEmail);
    if (existingUser) {
      return json(res, 409, { error: 'email_exists', message: 'An account already exists for this email. Please log in to accept the quote.' });
    }
    if (!username || !/^[a-zA-Z0-9_]{3,30}$/.test(username)) return json(res, 422, { error: 'invalid_payload', message: 'Username must be 3–30 characters, letters, numbers and underscores only.' });
    if (!password || password.length < 8) return json(res, 422, { error: 'invalid_payload', message: 'Password must be at least 8 characters.' });
    if (forum.users.find(u => u.username && u.username.toLowerCase() === username.toLowerCase())) {
      return json(res, 409, { error: 'username_taken', message: 'That username is already taken.' });
    }
    const resolvedDisplayName = (typeof displayName === 'string' ? displayName.trim() : '') || username;
    const newUser = { id: 'U-' + Date.now(), username, displayName: resolvedDisplayName, email: quoteEmail, passwordHash: hashPassword(password), createdAt: new Date().toISOString() };
    forum.users.push(newUser);
    writeForum(forum);
    const dq = quote.draftQuote || {};
    const nowStr = new Date().toLocaleDateString('en-AU', { day:'2-digit', month:'short', year:'numeric' });
    const order = {
      id: 'OE-' + (readOrders().reduce((mx,o) => { const m=String(o.id||'').match(/^OE-(\d+)$/); return m?Math.max(mx,parseInt(m[1])):mx; }, 1000) + 1),
      cust: quote.name,
      email: quote.email,
      items: quote.summary || quote.quoteRef || quote.description || 'Custom build',
      date: nowStr,
      total: Math.round((dq.grandTotal || 0) * 100) / 100,
      fulfilment: 'pending',
      payments: [],
      sourceQuoteId: quote.id,
      quoteRef: quote.quoteRef || '',
      parts: buildPartsFromDraftQuote(dq),
    };
    const orders = readOrders();
    orders.push(order);
    writeOrders(orders);
    quotes[qIdx] = { ...quote, status: 'accepted', orderId: order.id };
    writeQuotes(quotes);
    const sid = randomId();
    portalSessions.set(sid, { id: newUser.id, username: newUser.username, displayName: newUser.displayName, createdAt: newUser.createdAt, expiresAt: now() + PORTAL_SESSION_TTL_MS });
    saveSessionsToDisk(PORTAL_SESSIONS_DB_PATH, portalSessions);
    res.setHeader('Set-Cookie', sessionCookie('oe_portal_session', sid, Math.floor(PORTAL_SESSION_TTL_MS / 1000), req));
    const custTmpl = emailQuoteAccepted({ orderId: order.id, quoteRef: quote.quoteRef || quote.id, customerName: quote.name, grandTotal: order.total });
    sendEmail({ to: quote.email, ...custTmpl });
    const staffTmpl = emailStaffQuoteAccepted({ orderId: order.id, quoteRef: quote.quoteRef || quote.id, name: quote.name, email: quote.email, grandTotal: order.total });
    sendEmail({ to: getNotifyEmail(), ...staffTmpl });
    const welcomeTmpl = emailPortalWelcome({ username: newUser.username, displayName: newUser.displayName });
    sendEmail({ to: quoteEmail, ...welcomeTmpl });
    return json(res, 201, { ok: true, orderId: order.id, user: { id: newUser.id, username: newUser.username, displayName: newUser.displayName, createdAt: newUser.createdAt } });
  }

  if (req.method === 'POST' && url.pathname === '/api/portal/quotes/request') {
    const session = getPortalSession(req);
    if (!session) return json(res, 401, { error: 'login_required' });
    let body; try { body = await readJson(req); } catch { return json(res, 400, { error: 'invalid_json' }); }
    if (!body.description || !body.description.trim()) return json(res, 422, { error: 'invalid_payload', message: 'Description is required.' });
    if (body.description.trim().length > 2000) return json(res, 422, { error: 'description_too_long', message: 'Description must be 2000 characters or fewer.' });
    if (!body.email || !body.email.trim()) return json(res, 422, { error: 'invalid_payload', message: 'Email is required.' });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email.trim())) return json(res, 422, { error: 'invalid_email', message: 'Email address is invalid.' });
    const quotes = readQuotes();
    const { tiers: qTiers, subscriptions: qSubs } = readMemberships();
    const qSub = qSubs.find(s => s.username === session.username && s.status === 'active');
    const qTier = qSub ? qTiers.find(t => t.id === qSub.tierId) : null;
    const quote = {
      id: 'quot-' + Date.now(),
      name: body.name || session.displayName || session.username,
      email: body.email.trim(),
      description: body.description.trim(),
      status: 'new',
      createdAt: new Date().toISOString(),
      portalUser: session.username,
      ...(qTier ? { memberTier: qTier.name, priority: true } : {}),
    };
    quotes.push(quote);
    writeQuotes(quotes);
    const custTmpl = emailQuoteReceived({ quoteId: quote.id, customerName: quote.name, description: quote.description });
    sendEmail({ to: quote.email, ...custTmpl });
    const staffTmpl = emailStaffNewQuote({ quoteId: quote.id, name: quote.name, email: quote.email, description: quote.description });
    sendEmail({ to: getNotifyEmail(), ...staffTmpl });
    return json(res, 201, { ok: true, item: quote });
  }

  if (req.method === 'POST' && url.pathname === '/api/portal/quotes/accept') {
    const session = getPortalSession(req);
    if (!session) return json(res, 401, { error: 'login_required' });
    let body; try { body = await readJson(req); } catch { return json(res, 400, { error: 'invalid_json' }); }
    if (!body.quoteId) return json(res, 400, { error: 'quote_id_required' });
    const forumDb = readForum();
    const portalUser = Array.isArray(forumDb.users) ? forumDb.users.find(u => u.id === session.id) : null;
    const sessionEmail = portalUser ? String(portalUser.email || '').toLowerCase() : '';
    const quotes = readQuotes();
    const qIdx = quotes.findIndex(q => q.id === body.quoteId && String(q.email || '').toLowerCase() === sessionEmail);
    if (qIdx < 0) return json(res, 404, { error: 'quote_not_found' });
    const quote = quotes[qIdx];
    if (quote.status !== 'quoted') return json(res, 409, { error: 'quote_not_actionable', message: 'This quote has already been accepted or is not ready for acceptance.' });
    const dq = quote.draftQuote || {};
    const now = new Date().toLocaleDateString('en-AU', { day:'2-digit', month:'short', year:'numeric' });
    const order = {
      id: 'OE-' + (readOrders().reduce((mx,o) => { const m=String(o.id||'').match(/^OE-(\d+)$/); return m?Math.max(mx,parseInt(m[1])):mx; }, 1000) + 1),
      cust: quote.name,
      email: quote.email,
      items: quote.summary || quote.quoteRef || quote.description || 'Custom build',
      date: now,
      total: Math.round((dq.grandTotal || 0) * 100) / 100,
      fulfilment: 'pending',
      payments: [],
      sourceQuoteId: quote.id,
      quoteRef: quote.quoteRef || '',
      parts: buildPartsFromDraftQuote(dq),
    };
    const orders = readOrders();
    orders.push(order);
    writeOrders(orders);
    quotes[qIdx] = { ...quote, status: 'accepted', orderId: order.id };
    writeQuotes(quotes);
    const custTmpl = emailQuoteAccepted({ orderId: order.id, quoteRef: quote.quoteRef || quote.id, customerName: quote.name, grandTotal: order.total });
    sendEmail({ to: quote.email, ...custTmpl });
    const staffTmpl = emailStaffQuoteAccepted({ orderId: order.id, quoteRef: quote.quoteRef || quote.id, name: quote.name, email: quote.email, grandTotal: order.total });
    sendEmail({ to: getNotifyEmail(), ...staffTmpl });
    return json(res, 200, { ok: true, orderId: order.id });
  }

  if (req.method === 'GET' && url.pathname === '/api/portal/membership') {
    const session = getPortalSession(req);
    if (!session) return json(res, 401, { error: 'login_required' });
    const { tiers, subscriptions } = readMemberships();
    const sub = subscriptions.find(s => s.username === session.username && s.status === 'active');
    if (!sub) return json(res, 200, { subscription: null, tier: null });
    const tier = tiers.find(t => t.id === sub.tierId) || null;
    return json(res, 200, { subscription: sub, tier });
  }

  if (req.method === 'POST' && url.pathname === '/api/portal/membership/subscribe') {
    const session = getPortalSession(req);
    if (!session) return json(res, 401, { error: 'login_required' });
    let body; try { body = await readJson(req); } catch { return json(res, 400, { error: 'invalid_json' }); }
    const { tierId } = body || {};
    const mb = readMemberships();
    const tier = mb.tiers.find(t => t.id === tierId && t.status === 'published');
    if (!tier) return json(res, 404, { error: 'tier_not_found' });
    mb.subscriptions = mb.subscriptions.filter(s => s.username !== session.username);
    const sub = {
      id: 'sub-' + Date.now(),
      username: session.username,
      tierId,
      startDate: new Date().toISOString(),
      status: 'active',
    };
    mb.subscriptions.push(sub);
    writeMemberships(mb);
    const forum = readForum();
    const user = (forum.users || []).find(u => u.username === session.username);
    if (user && user.email) {
      const tmpl = emailMembershipWelcome({ customerName: user.displayName || user.username, tierName: tier.name });
      sendEmail({ to: user.email, ...tmpl });
    }
    return json(res, 201, { ok: true, subscription: sub, tier });
  }

  if (req.method === 'POST' && url.pathname === '/api/portal/membership/cancel') {
    const session = getPortalSession(req);
    if (!session) return json(res, 401, { error: 'login_required' });
    const mb = readMemberships();
    const prevSub = mb.subscriptions.find(s => s.username === session.username && s.status === 'active');
    const prevTier = prevSub ? mb.tiers.find(t => t.id === prevSub.tierId) : null;
    mb.subscriptions = mb.subscriptions.map(s =>
      s.username === session.username ? { ...s, status: 'cancelled', cancelledAt: new Date().toISOString() } : s
    );
    writeMemberships(mb);
    if (prevTier) {
      const forum = readForum();
      const user = (forum.users || []).find(u => u.username === session.username);
      if (user && user.email) {
        const tmpl = emailMembershipCancelled({ customerName: user.displayName || user.username, tierName: prevTier.name });
        sendEmail({ to: user.email, ...tmpl });
      }
    }
    return json(res, 200, { ok: true });
  }

  if (req.method === 'POST' && url.pathname === '/api/portal/auth/forgot-password') {
    if (publicRateLimited(getIp(req), 'forgot-password')) return json(res, 429, { error: 'too_many_requests' });
    let body; try { body = await readJson(req); } catch { return json(res, 400, { error: 'invalid_json' }); }
    const username = typeof body?.username === 'string' ? body.username.trim() : '';
    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
    if (!username || !email) return json(res, 200, { ok: true }); // always 200 to avoid enumeration
    const forum = readForum();
    if (!Array.isArray(forum.users)) forum.users = [];
    const user = forum.users.find(u =>
      u.username && u.username.toLowerCase() === username.toLowerCase() &&
      u.email && u.email.toLowerCase() === email
    );
    if (user) {
      const token = crypto.randomBytes(32).toString('hex');
      resetTokens.set(token, { userId: user.id, expiresAt: now() + RESET_TOKEN_TTL_MS });
      saveResetTokens();
      const resetUrl = `${getPortalUrl()}?reset=${token}`;
      const tmpl = emailPasswordReset({ displayName: user.displayName || user.username, resetUrl });
      sendEmail({ to: user.email, ...tmpl });
    }
    return json(res, 200, { ok: true });
  }

  if (req.method === 'POST' && url.pathname === '/api/portal/auth/reset-password') {
    if (publicRateLimited(getIp(req), 'reset-password')) return json(res, 429, { error: 'too_many_requests' });
    let body; try { body = await readJson(req); } catch { return json(res, 400, { error: 'invalid_json' }); }
    const token = typeof body?.token === 'string' ? body.token : '';
    const password = typeof body?.password === 'string' ? body.password : '';
    if (!token || password.length < 8) return json(res, 422, { error: 'invalid_payload', message: 'Token and a password of at least 8 characters are required.' });
    const entry = resetTokens.get(token);
    if (!entry || entry.expiresAt < now()) return json(res, 400, { error: 'invalid_token', message: 'This reset link has expired or is invalid.' });
    const forum = readForum();
    if (!Array.isArray(forum.users)) forum.users = [];
    const idx = forum.users.findIndex(u => u.id === entry.userId);
    if (idx < 0) return json(res, 400, { error: 'invalid_token', message: 'This reset link has expired or is invalid.' });
    forum.users[idx] = { ...forum.users[idx], passwordHash: hashPassword(password) };
    writeForum(forum);
    resetTokens.delete(token);
    saveResetTokens();
    return json(res, 200, { ok: true });
  }

  if (req.method === 'GET' && url.pathname === '/api/portal/rewards') {
    const session = getPortalSession(req);
    if (!session) return json(res, 401, { error: 'login_required' });
    const db = readRewards();
    const entry = db.entries.find(e => e.userId === session.id);
    return json(res, 200, entry ? { points: entry.points, history: entry.history } : { points: 0, history: [] });
  }

  if (req.method === 'GET' && url.pathname === '/api/portal/wallet') {
    const session = getPortalSession(req);
    if (!session) return json(res, 401, { error: 'login_required' });
    const forumDb = readForum();
    const portalUser = Array.isArray(forumDb.users) ? forumDb.users.find(u => u.id === session.id) : null;
    const userEmail = portalUser ? String(portalUser.email || '').toLowerCase() : '';
    const giftCards = userEmail
      ? readGiftCards().filter(c => String(c.recipientEmail || '').toLowerCase() === userEmail && !c.isVoid && c.balance > 0)
      : [];
    const scEntry = readStoreCredits().entries.find(e => e.userId === session.id);
    const storeCredits = scEntry && scEntry.balance > 0
      ? [{ description: 'Store credit', balance: scEntry.balance, history: scEntry.history || [] }]
      : [];
    return json(res, 200, { giftCards, storeCredits });
  }

  if (req.method === 'GET' && url.pathname === '/api/portal/bookings') {
    const session = getPortalSession(req);
    if (!session) return json(res, 401, { error: 'login_required' });
    const db = readBookings();
    const items = db.bookings.filter(b => b.userId === session.id);
    return json(res, 200, { items });
  }

  if (req.method === 'POST' && url.pathname === '/api/portal/bookings') {
    const session = getPortalSession(req);
    if (!session) return json(res, 401, { error: 'login_required' });
    let body; try { body = await readJson(req); } catch { return json(res, 400, { error: 'invalid_json' }); }
    const { serviceName, date, time, notes } = body || {};
    if (!serviceName) return json(res, 422, { error: 'serviceName_required' });
    const db = readBookings();
    const booking = {
      id: `bk-${Date.now()}`,
      userId: session.id,
      username: session.username,
      serviceName,
      date: date || '',
      time: time || '',
      notes: notes || '',
      status: 'pending',
      createdAt: new Date().toISOString(),
    };
    db.bookings.push(booking);
    writeBookings(db);
    return json(res, 201, { ok: true, booking });
  }

  return serveStatic(req, res, url.pathname, '/dist/portal.html', null);
});

// ── Games server (8084) ───────────────────────────────────────────────────────

const gamesServer = http.createServer(async (req, res) => {
  try {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (checkMaintenance(req, res, url)) return;

  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }

  if (req.method === 'GET' && url.pathname === '/api/csrf-token') {
    const token = ensureCsrfCookie(req, res);
    return json(res, 200, { token });
  }

  if ((req.method === 'POST' || req.method === 'PATCH') && url.pathname.startsWith('/api/')) {
    if (!verifyCsrf(req, res)) return;
  }

  if (req.method === 'GET'  && url.pathname === '/api/config')        return json(res, 200, { portalUrl: PORTAL_URL });
  if (req.method === 'GET'  && url.pathname === '/api/auth/me')       return handleCustomerMe(req, res);
  if (req.method === 'POST' && url.pathname === '/api/auth/register') return handleCustomerRegister(req, res);
  if (req.method === 'POST' && url.pathname === '/api/auth/login')    return handleCustomerLogin(req, res);
  if (req.method === 'POST' && url.pathname === '/api/auth/logout')   return handleCustomerLogout(req, res);

  return serveStatic(req, res, url.pathname, '/dist/games.html', null);
  } catch (err) {
    console.error('[gamesServer] unhandled error:', err);
    if (!res.headersSent) json(res, 500, { error: 'server_error' });
  }
});

// ── Start all servers ─────────────────────────────────────────────────────────

function startServer(server, port, label) {
  server.on('error', (err) => {
    if (err && err.code === 'EADDRINUSE') {
      console.error(`[${label}] Port ${port} is already in use.`);
      process.exit(1);
    }
    throw err;
  });
  server.listen(port, () => {
    console.log(`[${label}] http://localhost:${port}`);
  });
}

function migrateEnvToSettings() {
  const s = readSettings();
  let changed = false;

  if (STRIPE_SECRET_KEY && !s.integrations.find(r => r[0] === 'Stripe')) {
    s.integrations = [['Stripe', 'api.stripe.com', true, {
      secretKey: STRIPE_SECRET_KEY, publishableKey: STRIPE_PUBLISHABLE_KEY, webhookSecret: STRIPE_WEBHOOK_SECRET,
    }], ...s.integrations];
    changed = true;
  }

  if ((SMTP_HOST || SMTP_USER) && !s.integrations.find(r => r[0] === 'Email')) {
    s.integrations.push(['Email', SMTP_HOST || 'smtp.gmail.com', !!(SMTP_HOST && SMTP_USER && SMTP_PASS), {
      host: SMTP_HOST, port: String(SMTP_PORT), user: SMTP_USER, pass: SMTP_PASS, notifyEmail: NOTIFY_EMAIL,
    }]);
    changed = true;
  }

  if (SITE_URL && !s.shop.siteUrl) {
    s.shop = { ...s.shop, siteUrl: SITE_URL };
    changed = true;
  }

  if (ADMIN_USERNAME && !s.security?.adminUsername) {
    s.security = { ...(s.security || {}), adminUsername: ADMIN_USERNAME };
    changed = true;
  }

  if (ADMIN_PASSWORD_HASH && !s.security?.adminPasswordHash) {
    s.security = { ...(s.security || {}), adminPasswordHash: ADMIN_PASSWORD_HASH };
    changed = true;
  }

  if (changed) writeSettings(s);
}

migrateEnvToSettings();

async function runMonthlyListingFees() {
  const key = getStripeKey();
  if (!key) { console.log('[listing-fees] Stripe not configured, skipping'); return; }
  const staffData = readStaff();
  const sellers = staffData.members.filter(m => m.role === 'seller' && m.status !== 'inactive');
  const products = readProducts();
  const settings = readSettings();
  const commissionPct = Number((settings.shop || {}).sellerCommissionPct) || 20;
  void commissionPct;

  for (const seller of sellers) {
    const activeListings = products.filter(p => p.createdBy === seller.id && p.status === 'published');
    const count = activeListings.length;
    const fee = calculateListingFee(count);

    if (fee === null) {
      console.log(`[listing-fees] Seller ${seller.id} (${seller.name}) has ${count} listings — custom tier, skipping`);
      continue;
    }
    if (fee === 0 || count === 0) continue;

    if (!seller.stripeCustomerId || !seller.stripePaymentMethodId) {
      console.warn(`[listing-fees] Seller ${seller.id} (${seller.name}) has no saved card — cannot charge`);
      continue;
    }

    let chargeId = null;
    let status = 'failed';
    try {
      const resp = await stripeRequest('POST', '/v1/payment_intents', {
        amount: String(Math.round(fee * 100)),
        currency: 'aud',
        customer: seller.stripeCustomerId,
        payment_method: seller.stripePaymentMethodId,
        confirm: 'true',
        off_session: 'true',
        description: `Outback Electronics listing fee — ${count} listings`,
      });
      if (resp.status === 200 && resp.body.id) {
        chargeId = resp.body.id;
        status = 'ok';
        console.log(`[listing-fees] Charged ${seller.name} $${fee} — ${chargeId}`);
      } else {
        console.error(`[listing-fees] Stripe error for ${seller.name}:`, resp.body);
      }
    } catch (err) {
      console.error(`[listing-fees] Charge failed for ${seller.name}:`, err);
    }

    const txns = readSellerLedger();
    txns.push({
      id: 'txn-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
      sellerId: seller.id,
      type: 'listing_fee',
      amount: fee,
      description: `Monthly listing fee — ${count} listing${count !== 1 ? 's' : ''}`,
      date: new Date().toISOString(),
      stripeChargeId: chargeId,
      status,
    });
    writeSellerLedger(txns);
  }
  console.log('[listing-fees] Run complete');
}

function backfillJobEmails() {
  // For every customer that has a name + email, find any jobs matched by name
  // (or phone) that are missing an email, and stamp the customer's email onto them.
  // This makes old records discoverable by email-based lookups going forward.
  const customers = readCustomers().filter(c => c.name && c.email);
  if (!customers.length) return;

  const orders      = readOrders();
  const repairBoard = readRepairs();
  const quotes      = readQuotes();
  let ordersDirty = false, repairsDirty = false, quotesDirty = false;

  function stampIfMatch(j, custEmail, custPhone, custName) {
    if ((j.email||'').trim()) return j; // already has email
    const jName  = (j.cust||j.name||j.customer||j.customerName||'').toLowerCase().trim();
    const jPhone = normalisePhone(j.phone||j.mobile||'');
    const nameHit  = custName  && jName  && custName  === jName;
    const phoneHit = custPhone && jPhone && custPhone === jPhone;
    if (nameHit || phoneHit) return { ...j, email: custEmail };
    return j;
  }

  for (const c of customers) {
    const ce = c.email.trim();
    const cp = normalisePhone(c.phone||'');
    const cn = (c.name||'').toLowerCase().trim();

    const newOrders = orders.map((o, i) => {
      const stamped = stampIfMatch(o, ce, cp, cn);
      if (stamped !== o) { orders[i] = stamped; ordersDirty = true; }
      return orders[i];
    });
    void newOrders;

    repairBoard.columns = (repairBoard.columns||[]).map(col => ({
      ...col,
      cards: (col.cards||[]).map(card => {
        const stamped = stampIfMatch(card, ce, cp, cn);
        if (stamped !== card) repairsDirty = true;
        return stamped;
      }),
    }));

    quotes.forEach((q, i) => {
      const stamped = stampIfMatch(q, ce, cp, cn);
      if (stamped !== q) { quotes[i] = stamped; quotesDirty = true; }
    });
  }

  if (ordersDirty)  writeOrders(orders);
  if (repairsDirty) writeRepairs(repairBoard);
  if (quotesDirty)  writeQuotes(quotes);
  if (ordersDirty || repairsDirty || quotesDirty)
    console.log('[backfill] Stamped emails onto name/phone-matched jobs');
}

backfillJobEmails();

// ── Monthly listing fee cron ──────────────────────────────────────────────────
(function scheduleDailyCheck() {
  function msUntilMidnight() {
    const now = new Date();
    const midnight = new Date(now);
    midnight.setHours(24, 0, 0, 0);
    return midnight - now;
  }
  function isLastDayOfMonth() {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.getDate() === 1;
  }
  function tick() {
    if (isLastDayOfMonth()) {
      console.log('[cron] Last day of month — running listing fees');
      runMonthlyListingFees().catch(err => console.error('[cron] listing fee error:', err));
    }
    setTimeout(tick, msUntilMidnight() + 1000);
  }
  setTimeout(tick, msUntilMidnight() + 1000);
})();

startServer(mainServer,   MAIN_PORT,   'main  ');
startServer(forumServer,  FORUM_PORT,  'forum ');
startServer(adminServer,  ADMIN_PORT,  'admin ');
startServer(portalServer, PORTAL_PORT, 'portal');
startServer(gamesServer,  GAMES_PORT,  'games ');
