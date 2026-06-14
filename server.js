const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');
const sharp = require('sharp');

const gzipCache = new Map();

function gzipSend(req, res, statusCode, headers, body) {
  const acceptEnc = (req && req.headers && req.headers['accept-encoding']) || '';
  if (acceptEnc.includes('gzip')) {
    zlib.gzip(Buffer.from(body), { level: 6 }, (err, buf) => {
      if (err) { res.writeHead(statusCode, headers); res.end(body); return; }
      headers['Content-Encoding'] = 'gzip';
      headers['Vary'] = 'Accept-Encoding';
      res.writeHead(statusCode, headers);
      res.end(buf);
    });
  } else {
    res.writeHead(statusCode, headers);
    res.end(body);
  }
}

const MAIN_PORT  = process.env.MAIN_PORT  || 8080;
const DISCOURSE_REDIRECT_PORT = process.env.DISCOURSE_REDIRECT_PORT || 8081;
const ADMIN_PORT = process.env.ADMIN_PORT || 8082;
const PORTAL_PORT = process.env.PORTAL_PORT || 8083;
const GAMES_PORT  = process.env.GAMES_PORT  || 8084;
const TOOLS_PORT  = process.env.TOOLS_PORT  || 8085;
const WEATHER_PORT = process.env.WEATHER_PORT || 8089;
const AI_GATEWAY_PORT = process.env.AI_GATEWAY_PORT || 8091;
// ── Customer-facing service suite (hub + apps) — see CLAUDE.md ───────────────
const HUB_PORT      = process.env.HUB_PORT      || 8101;
const DRIVE_PORT    = process.env.DRIVE_PORT    || 8102;
const PHOTOS_PORT   = process.env.PHOTOS_PORT   || 8103;
const SKY_PORT      = process.env.SKY_PORT      || 8104;
const COVERAGE_PORT = process.env.COVERAGE_PORT || 8105;
const MAPS_PORT     = process.env.MAPS_PORT     || 8106;
const SOLAR_PORT    = process.env.SOLAR_PORT    || 8107;
const BEACON_PORT   = process.env.BEACON_PORT   || 8108;
const FIRE_PORT     = process.env.FIRE_PORT     || 8109;
const RADIO_PORT    = process.env.RADIO_PORT    || 8110;
const SWAP_PORT     = process.env.SWAP_PORT     || 8111;

const FORUM_PUBLIC_URL = process.env.FORUM_PUBLIC_URL || 'https://forum.outbackelectronics.com.au';
const DISCOURSE_CONNECT_SECRET = process.env.DISCOURSE_CONNECT_SECRET || '';

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
    "https://portal.outbackelectronics.com.au " +
    "https://nominatim.openstreetmap.org " +
    "https://overpass-api.de " +
    "wss://*.tawk.to https://*.tawk.to https://va.tawk.to " +
    "https://cloudflareinsights.com " +
    "https://*.googlesyndication.com https://*.doubleclick.net https://securepubads.g.doubleclick.net " +
    "https://adservice.google.com https://adservice.google.com.au " +
    "https://*.adtrafficquality.google; " +
  "frame-src 'self' https://www.openstreetmap.org https://*.tawk.to " +
    "https://pagead2.googlesyndication.com https://*.googlesyndication.com " +
    "https://googleads.g.doubleclick.net https://tpc.googlesyndication.com " +
    "https://www.google.com https://maps.google.com https://ep2.adtrafficquality.google; " +
  "frame-ancestors 'none';";
const HSTS_VALUE = 'max-age=31536000; includeSubDomains';
const PERMISSIONS_POLICY = 'camera=(), microphone=(), geolocation=(), payment=(), usb=()';
const PUBLIC_RATE_WINDOW_MS = 1000 * 60 * 10;
const PUBLIC_RATE_LIMITS = { analytics: 120, checkout: 20, 'quote/request': 5, 'contact/quick-message': 5, 'register': 5, 'shipping/quote': 30, 'warranty/register': 10, 'forgot-password': 5, 'reset-password': 10, 'gift-card/apply': 10, 'gift-card/balance': 5, 'warranty/order-lookup': 10, 'cart/get': 20, 'weather_register': 3, 'stock-notify': 5, 'membership': 10, 'order-token': 30 };

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

const PORTAL_SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30;
// Rate-limit counters are persisted so a process restart can't be used to
// reset login lockouts or public endpoint limits.
const RATE_LIMITS_DB_PATH = path.join(__dirname, 'rate-limits.db');
const { loginAttempts, publicRateCounts } = (() => {
  try {
    const raw = JSON.parse(fs.readFileSync(RATE_LIMITS_DB_PATH, 'utf8'));
    return {
      loginAttempts: new Map(Object.entries(raw.loginAttempts || {})),
      publicRateCounts: new Map(Object.entries(raw.publicRateCounts || {})),
    };
  } catch { return { loginAttempts: new Map(), publicRateCounts: new Map() }; }
})();
function saveRateLimitState() {
  try {
    atomicWriteFile(RATE_LIMITS_DB_PATH, JSON.stringify({
      loginAttempts: Object.fromEntries(loginAttempts),
      publicRateCounts: Object.fromEntries(publicRateCounts),
    }));
  } catch {}
}
const PRODUCTS_DB_PATH  = path.join(__dirname, 'products.db');
const SERVICES_DB_PATH  = path.join(__dirname, 'services.db');
const ORDERS_DB_PATH    = path.join(__dirname, 'orders.db');
const CUSTOMERS_DB_PATH = path.join(__dirname, 'customers.db');
const REPAIRS_DB_PATH   = path.join(__dirname, 'repairs.db');
const QUOTES_DB_PATH    = path.join(__dirname, 'quotes.db');
const EWASTE_DB_PATH    = path.join(__dirname, 'ewaste.db');
const SELLERS_DB_PATH   = path.join(__dirname, 'sellers.db');
const GROUPS_DB_PATH    = path.join(__dirname, 'groups.db');
const USERS_DB_PATH     = path.join(__dirname, 'users.db');
const SOFTWARE_DB_PATH  = path.join(__dirname, 'software.db');
const GIFTCARDS_DB_PATH = path.join(__dirname, 'gift-cards.db');
const DENOMINATIONS_DB_PATH = path.join(__dirname, 'gift-card-denominations.db');
const REWARDS_DB_PATH = path.join(__dirname, 'rewards.db');
const ANALYTICS_DB_PATH = path.join(__dirname, 'analytics.db');
const STORE_CREDIT_DB_PATH = path.join(__dirname, 'store-credits.db');
const BOOKINGS_DB_PATH = path.join(__dirname, 'bookings.db');
const TUTORIALS_DB_PATH = path.join(__dirname, 'tutorials.db');
const AI_DB_PATH        = path.join(__dirname, 'ai.db');
const POLICIES_DB_PATH  = path.join(__dirname, 'policies.db');
const SETTINGS_DB_PATH  = path.join(__dirname, 'settings.db');
const MEMBERSHIPS_DB_PATH = path.join(__dirname, 'memberships.db');
const STAFF_DB_PATH       = path.join(__dirname, 'staff.db');
const SELLER_LEDGER_DB_PATH = path.join(__dirname, 'seller-ledger.db');
const EXPENSES_DB_PATH    = path.join(__dirname, 'expenses.db');
const ADMIN_AUDIT_LOG_PATH   = path.join(__dirname, 'admin-audit.log');
const SESSIONS_DB_PATH        = path.join(__dirname, 'sessions.db');
const PORTAL_SESSIONS_DB_PATH = path.join(__dirname, 'portal-sessions.db');
const RESET_TOKENS_DB_PATH = path.join(__dirname, 'password-reset-tokens.db');
const CARTS_DB_PATH = path.join(__dirname, 'carts.db');
const STOCK_NOTIFY_DB_PATH = path.join(__dirname, 'stock-notify.db');
const RAG_CACHE_DB_PATH = path.join(__dirname, 'rag-cache.db');
const RESET_TOKEN_TTL_MS = 1000 * 60 * 60; // 1 hour
function _defaultSubUrl(base, port, sub) {
  // Localhost/dev: swap the port on the same host (e.g. http://localhost:8080 → :8101).
  // Anchor on scheme+host so we replace the authority's port, not the // after the scheme.
  if (/^https?:\/\/(localhost|127\.|0\.0\.0\.0)(:\d+)?/.test(base))
    return base.replace(/^(https?:\/\/[^/:]+)(:\d+)?/, `$1:${port}`);
  // Production: prefix the subdomain (e.g. https://outbackelectronics.com.au → https://hub.…).
  return base.replace(/^(https?:\/\/)/, `$1${sub}.`);
}
const PORTAL_URL = process.env.PORTAL_URL || _defaultSubUrl(SITE_URL, 8083, 'portal');
const GAMES_URL  = process.env.GAMES_URL  || _defaultSubUrl(SITE_URL, 8084, 'games');
const TOOLS_URL  = process.env.TOOLS_URL  || _defaultSubUrl(SITE_URL, 8085, 'tools');
const WEATHER_URL = process.env.WEATHER_URL || _defaultSubUrl(SITE_URL, 8089, 'weather');
// New-suite URLs are resolved dynamically in serviceUrls() (settings-aware),
// so no per-service consts are needed here — only env overrides + ports.

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

// Reset tokens are stored hashed — a leaked password-reset-tokens.db cannot be
// used to take over accounts. The raw token only ever exists in the email link.
function hashResetToken(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}

// Prune expired sessions and flush to disk every 10 minutes.
setInterval(() => {
  const t = now();
  for (const [k, v] of sessions) if (v.expiresAt <= t) sessions.delete(k);
  for (const [k, v] of portalSessions) if (v.expiresAt <= t) portalSessions.delete(k);
  for (const [k, v] of resetTokens) if (v.expiresAt <= t) resetTokens.delete(k);
  for (const [k, v] of loginAttempts) {
    if (v.lockedUntil <= t && v.attempts.every(ts => ts <= t - RATE_WINDOW_MS)) loginAttempts.delete(k);
  }
  for (const [k, v] of publicRateCounts) {
    if (v.every(ts => ts <= t - PUBLIC_RATE_WINDOW_MS)) publicRateCounts.delete(k);
  }
  saveSessionsToDisk(SESSIONS_DB_PATH, sessions);
  saveSessionsToDisk(PORTAL_SESSIONS_DB_PATH, portalSessions);
  saveResetTokens();
  saveRateLimitState();
}, 10 * 60 * 1000).unref();

// Security: sanitize tutorial HTML content and validate video URLs.
const TRUSTED_VIDEO_DOMAINS = ['youtube.com', 'www.youtube.com', 'youtu.be', 'www.youtu.be', 'youtube-nocookie.com', 'www.youtube-nocookie.com', 'vimeo.com', 'www.vimeo.com'];

function sanitizeTutorialHTML(html) {
  if (!html || typeof html !== 'string') return '';
  let result = html;
  // Remove script, iframe, object, embed, style tags and their content
  result = result.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  result = result.replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '');
  result = result.replace(/<(object|embed|style|form|input|button|textarea)\b[^<]*(?:(?!<\/(object|embed|style|form|input|button|textarea)>)<[^<]*)*<\/(object|embed|style|form|input|button|textarea)>/gi, '');
  // Remove event handlers (onclick, onload, etc.)
  result = result.replace(/\s+on\w+\s*=\s*["'][^"']*["']/gi, '');
  result = result.replace(/\s+on\w+\s*=\s*[^\s>]*/gi, '');
  // Remove javascript: protocol
  result = result.replace(/href\s*=\s*["']javascript:[^"']*["']/gi, 'href="#"');
  result = result.replace(/src\s*=\s*["']javascript:[^"']*["']/gi, '');
  return result;
}

function validateVideoUrl(url) {
  if (!url || typeof url !== 'string') return '';
  try {
    const u = new URL(url);
    const hostname = u.hostname.toLowerCase();
    // Check if URL is from a trusted video hosting service
    if (TRUSTED_VIDEO_DOMAINS.some(domain => hostname === domain || hostname.endsWith('.' + domain))) {
      return url;
    }
  } catch {
    // Invalid URL
  }
  return '';
}

// ── DB helpers ────────────────────────────────────────────────────────────────

// In-memory read cache: filePath → raw JSON string.
// Populated on first disk read; invalidated/updated by atomicWriteFile on every write.
// Eliminates repeated synchronous disk reads and JSON re-parses for hot paths like readSettings().
const _fileReadCache = new Map();

function cachedReadFile(filePath) {
  if (_fileReadCache.has(filePath)) return _fileReadCache.get(filePath);
  try {
    const data = fs.readFileSync(filePath, 'utf8');
    _fileReadCache.set(filePath, data);
    return data;
  } catch { return null; }
}

// Atomic write: write to a temp file then rename so a crash mid-write never
// leaves a partially-written (corrupt) JSON file. Also keeps the read cache in sync.
function atomicWriteFile(filePath, data) {
  const tmp = filePath + '.tmp';
  fs.writeFileSync(tmp, data);
  fs.renameSync(tmp, filePath);
  _fileReadCache.set(filePath, data);
}

// Per-key async mutex — serialises concurrent read-modify-write operations on
// shared data files so a later write can never clobber an earlier one.
const _locks = new Map();
async function withFileLock(key, fn) {
  const prev = _locks.get(key) || Promise.resolve();
  let release;
  const held = new Promise(r => { release = r; });
  _locks.set(key, held);
  try { await prev; } catch {}
  try { return await fn(); } finally { release(); }
}
// Single lock key for all checkout/webhook financial writes (orders + gift cards
// + rewards). A hierarchy of per-file locks would risk deadlock; one key is safe.
const CHECKOUT_LOCK = 'checkout';

function readCarts() {
  try { const p = JSON.parse(cachedReadFile(CARTS_DB_PATH)); return Array.isArray(p.carts) ? p.carts : []; } catch { return []; }
}
function writeCarts(carts) { atomicWriteFile(CARTS_DB_PATH, JSON.stringify({ carts }, null, 2)); }

function readStockNotify() {
  try { const p = JSON.parse(cachedReadFile(STOCK_NOTIFY_DB_PATH)); return Array.isArray(p.requests) ? p.requests : []; } catch { return []; }
}
function writeStockNotify(requests) { atomicWriteFile(STOCK_NOTIFY_DB_PATH, JSON.stringify({ requests }, null, 2)); }

function readProducts() {
  try { const p = JSON.parse(cachedReadFile(PRODUCTS_DB_PATH)); return Array.isArray(p.products) ? p.products : []; } catch { return []; }
}
function writeProducts(products) { atomicWriteFile(PRODUCTS_DB_PATH, JSON.stringify({ products }, null, 2)); }

function readServices() {
  try {
    const p = JSON.parse(cachedReadFile(SERVICES_DB_PATH));
    if (!Array.isArray(p.services)) return [];
    let dirty = false;
    for (const s of p.services) {
      if (!s.id) { s.id = 'svc-' + Date.now() + '-' + crypto.randomBytes(4).toString('hex'); dirty = true; }
    }
    if (dirty) writeServices(p.services);
    return p.services;
  } catch { return []; }
}
function writeServices(services) { atomicWriteFile(SERVICES_DB_PATH, JSON.stringify({ services }, null, 2)); }

function readCatalog() { return { products: readProducts(), services: readServices() }; }

function normalisePhone(p) { return (p||'').replace(/[\s\-().+]/g, '').toLowerCase(); }

function readOrders() {
  try { const p = JSON.parse(cachedReadFile(ORDERS_DB_PATH)); return Array.isArray(p.orders) ? p.orders : []; } catch { return []; }
}
function writeOrders(orders) { atomicWriteFile(ORDERS_DB_PATH, JSON.stringify({ orders }, null, 2)); }

function readCustomers() {
  try {
    const p = JSON.parse(cachedReadFile(CUSTOMERS_DB_PATH));
    const customers = Array.isArray(p.customers) ? p.customers : [];
    let dirty = false;
    for (const c of customers) { if (!c.id) { c.id = 'cust-' + Date.now() + '-' + crypto.randomBytes(4).toString('hex'); dirty = true; } }
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
    const p = JSON.parse(cachedReadFile(REPAIRS_DB_PATH));
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
  try { const p = JSON.parse(cachedReadFile(QUOTES_DB_PATH)); return Array.isArray(p.quotes) ? p.quotes : []; } catch { return []; }
}
function writeQuotes(quotes) { atomicWriteFile(QUOTES_DB_PATH, JSON.stringify({ quotes }, null, 2)); }

function readEwaste() {
  try { const p = JSON.parse(cachedReadFile(EWASTE_DB_PATH)); return Array.isArray(p.intakes) ? p.intakes : []; } catch { return []; }
}
function writeEwaste(intakes) { atomicWriteFile(EWASTE_DB_PATH, JSON.stringify({ intakes }, null, 2)); }

function readSellers() {
  try { const p = JSON.parse(cachedReadFile(SELLERS_DB_PATH)); return Array.isArray(p.consignments) ? p.consignments : []; } catch { return []; }
}
function writeSellers(consignments) { atomicWriteFile(SELLERS_DB_PATH, JSON.stringify({ consignments }, null, 2)); }

function readSellerLedger() {
  try { const d = JSON.parse(cachedReadFile(SELLER_LEDGER_DB_PATH)); return d.transactions || []; } catch { return []; }
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
  try { const p = JSON.parse(cachedReadFile(GROUPS_DB_PATH)); return Array.isArray(p.groups) ? p.groups : []; } catch { return []; }
}
function writeGroups(groups) { atomicWriteFile(GROUPS_DB_PATH, JSON.stringify({ groups }, null, 2)); }

function readUsers() {
  try { const d = JSON.parse(cachedReadFile(USERS_DB_PATH)); return Array.isArray(d.users) ? d.users : []; }
  catch { return []; }
}
function writeUsers(users) { atomicWriteFile(USERS_DB_PATH, JSON.stringify({ users }, null, 2)); }


function readSoftware() { try { return JSON.parse(cachedReadFile(SOFTWARE_DB_PATH)).items || []; } catch { return []; } }
function writeSoftware(items) { atomicWriteFile(SOFTWARE_DB_PATH, JSON.stringify({ items }, null, 2)); }
function readTutorials() { try { return JSON.parse(cachedReadFile(TUTORIALS_DB_PATH)).items || []; } catch { return []; } }
function writeTutorials(items) { atomicWriteFile(TUTORIALS_DB_PATH, JSON.stringify({ items }, null, 2)); }
function readAI() { try { const d = JSON.parse(cachedReadFile(AI_DB_PATH)); return { models: d.models || [], boxes: d.boxes || [] }; } catch { return { models: [], boxes: [] }; } }
function writeAI(data) { atomicWriteFile(AI_DB_PATH, JSON.stringify(data, null, 2)); }
function readPolicies() { try { return JSON.parse(cachedReadFile(POLICIES_DB_PATH)).items || []; } catch { return []; } }
function writePolicies(items) { atomicWriteFile(POLICIES_DB_PATH, JSON.stringify({ items }, null, 2)); }

function readMemberships() {
  try { const d = JSON.parse(cachedReadFile(MEMBERSHIPS_DB_PATH)); return { tiers: d.tiers || [], subscriptions: d.subscriptions || [] }; }
  catch { return { tiers: [], subscriptions: [] }; }
}
function writeMemberships(data) { atomicWriteFile(MEMBERSHIPS_DB_PATH, JSON.stringify(data, null, 2)); }

// Integration secrets (Stripe keys, SMTP password, AusPost API key) are
// encrypted at rest in settings.db when SETTINGS_ENCRYPTION_KEY is set in the
// environment. Without the key they are stored as-is (legacy behaviour).
const SENSITIVE_INTEGRATION_KEYS = new Set(['secretKey', 'webhookSecret', 'apiKey', 'pass']);
const _settingsEncKey = process.env.SETTINGS_ENCRYPTION_KEY
  ? crypto.createHash('sha256').update(process.env.SETTINGS_ENCRYPTION_KEY).digest()
  : null;
function encryptSecret(v) {
  if (!_settingsEncKey || typeof v !== 'string' || !v || v.startsWith('enc:v1:')) return v;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', _settingsEncKey, iv);
  const ct = Buffer.concat([cipher.update(v, 'utf8'), cipher.final()]);
  return 'enc:v1:' + Buffer.concat([iv, cipher.getAuthTag(), ct]).toString('base64');
}
function decryptSecret(v) {
  if (typeof v !== 'string' || !v.startsWith('enc:v1:')) return v;
  if (!_settingsEncKey) return '';
  try {
    const buf = Buffer.from(v.slice(7), 'base64');
    const decipher = crypto.createDecipheriv('aes-256-gcm', _settingsEncKey, buf.subarray(0, 12));
    decipher.setAuthTag(buf.subarray(12, 28));
    return Buffer.concat([decipher.update(buf.subarray(28)), decipher.final()]).toString('utf8');
  } catch { return ''; }
}
function mapIntegrationSecrets(integrations, fn) {
  return (Array.isArray(integrations) ? integrations : []).map(r => {
    const cfg = r[3] || {};
    const out = {};
    for (const [k, v] of Object.entries(cfg)) out[k] = SENSITIVE_INTEGRATION_KEYS.has(k) ? fn(v) : v;
    return [r[0], r[1], r[2], out];
  });
}
function readSettings() {
  try {
    const d = JSON.parse(cachedReadFile(SETTINGS_DB_PATH));
    return {
      shop: d.shop || {},
      announcement: d.announcement || {},
      maintenance: d.maintenance || {},
      staff: Array.isArray(d.staff) ? d.staff : [],
      integrations: mapIntegrationSecrets(d.integrations, decryptSecret),
      siteContent: d.siteContent || {},
      security: d.security || {},
    };
  } catch { return { shop: {}, announcement: {}, maintenance: {}, staff: [], integrations: [], siteContent: {}, security: {} }; }
}
function writeSettings(data) {
  const toStore = { ...data, integrations: mapIntegrationSecrets(data.integrations, encryptSecret) };
  atomicWriteFile(SETTINGS_DB_PATH, JSON.stringify(toStore, null, 2));
}

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
  // Secrets never leave the server in full — the admin dashboard sees a masked
  // value (last 4 chars) and settings/save ignores masked values on round-trip.
  const result = {};
  for (const [k, v] of Object.entries(config)) {
    if (k === 'adminPasswordHash') continue; // never send password hash
    if (SENSITIVE_INTEGRATION_KEYS.has(k)) {
      const s = String(v || '');
      result[k] = s ? '••••' + s.slice(-4) : '';
    } else {
      result[k] = v;
    }
  }
  return result;
}

function readExpenses() { try { return JSON.parse(cachedReadFile(EXPENSES_DB_PATH)).expenses || []; } catch { return []; } }
function writeExpenses(e) { atomicWriteFile(EXPENSES_DB_PATH, JSON.stringify({ expenses: e }, null, 2)); }

// Analytics — append-only event log. Kept in memory for fast aggregation;
// flushed to disk on a 30-second timer and on each new event batch.
let _analyticsEvents = [];
let _analyticsDirty = false;
try {
  const raw = JSON.parse(fs.readFileSync(ANALYTICS_DB_PATH, 'utf8'));
  _analyticsEvents = Array.isArray(raw.events) ? raw.events : [];
} catch { _analyticsEvents = []; }

function flushAnalytics() {
  if (!_analyticsDirty) return;
  atomicWriteFile(ANALYTICS_DB_PATH, JSON.stringify({ events: _analyticsEvents }));
  _analyticsDirty = false;
}
setInterval(flushAnalytics, 30_000).unref();

function appendAnalyticsEvent(ev) {
  _analyticsEvents.push(ev);
  // Keep at most 200 000 events to bound memory / disk usage (~60 MB).
  if (_analyticsEvents.length > 200_000) _analyticsEvents = _analyticsEvents.slice(-200_000);
  _analyticsDirty = true;
}

function readGiftCards() {
  try { const d = JSON.parse(cachedReadFile(GIFTCARDS_DB_PATH)); return Array.isArray(d.giftCards) ? d.giftCards : []; }
  catch { return []; }
}
function writeGiftCards(giftCards) { atomicWriteFile(GIFTCARDS_DB_PATH, JSON.stringify({ giftCards }, null, 2)); }

function readDenominations() {
  try { const d = JSON.parse(cachedReadFile(DENOMINATIONS_DB_PATH)); return Array.isArray(d) ? d : []; } catch { return []; }
}
function writeDenominations(denominations) { atomicWriteFile(DENOMINATIONS_DB_PATH, JSON.stringify(denominations, null, 2)); }

function readRewards() {
  try { const d = JSON.parse(cachedReadFile(REWARDS_DB_PATH)); return { entries: Array.isArray(d.entries) ? d.entries : [] }; } catch { return { entries: [] }; }
}
function writeRewards(data) { atomicWriteFile(REWARDS_DB_PATH, JSON.stringify(data, null, 2)); }

// In-memory map of short-lived redemption tokens issued at cart time (30-min TTL)
const rewardsTokens = new Map(); // token -> { email, userId, points, storeCredit, expiresAt }

function grantRewardPoints(email, points, type, description, refId) {
  if (!email || !Number.isFinite(points) || points <= 0) return;
  const users = readUsers();
  const user = users.find(u => String(u.email || '').toLowerCase() === String(email).toLowerCase());
  if (!user) return;
  const db = readRewards();
  let entry = db.entries.find(e => e.userId === user.id);
  if (!entry) { entry = { userId: user.id, email: String(user.email || '').toLowerCase(), points: 0, history: [] }; db.entries.push(entry); }
  if (refId && entry.history.some(h => h.refId === refId)) return; // deduplicate
  entry.points += points;
  entry.history.push({ id: 'rh-' + Date.now() + '-' + crypto.randomBytes(4).toString('hex'), type, points, description: description || '', refId: refId || null, date: new Date().toISOString() });
  writeRewards(db);
}

function deductRewardPoints(userId, points, description, refId) {
  if (!userId || !Number.isFinite(points) || points <= 0) return false;
  const db = readRewards();
  const entry = db.entries.find(e => e.userId === userId);
  if (!entry || entry.points < points) return false;
  if (refId && entry.history.some(h => h.refId === refId)) return false; // deduplicate
  entry.points = Math.max(0, entry.points - points);
  entry.history.push({ id: 'rh-' + Date.now() + '-' + crypto.randomBytes(4).toString('hex'), type: 'redeem', points: -points, description: description || '', refId: refId || null, date: new Date().toISOString() });
  writeRewards(db);
  return true;
}

// ── Store credit (dollar balances) — mirrors the rewards system but in AUD ──
function readStoreCredits() {
  try { const d = JSON.parse(cachedReadFile(STORE_CREDIT_DB_PATH)); return { entries: Array.isArray(d.entries) ? d.entries : [] }; } catch { return { entries: [] }; }
}
function writeStoreCredits(data) { atomicWriteFile(STORE_CREDIT_DB_PATH, JSON.stringify(data, null, 2)); }

// Round to whole cents to avoid floating-point drift on balances.
function roundCents(n) { return Math.round((Number(n) || 0) * 100) / 100; }

function grantStoreCredit(email, amount, type, description, refId) {
  const amt = roundCents(amount);
  if (!email || !Number.isFinite(amt) || amt <= 0) return false;
  const user = readUsers().find(u => String(u.email || '').toLowerCase() === String(email).toLowerCase());
  if (!user) return false;
  const db = readStoreCredits();
  let entry = db.entries.find(e => e.userId === user.id);
  if (!entry) { entry = { userId: user.id, email: String(user.email || '').toLowerCase(), balance: 0, history: [] }; db.entries.push(entry); }
  if (refId && entry.history.some(h => h.refId === refId)) return false; // deduplicate
  entry.balance = roundCents(entry.balance + amt);
  entry.history.push({ id: 'sc-' + Date.now() + '-' + crypto.randomBytes(4).toString('hex'), type: type || 'grant', amount: amt, description: description || '', refId: refId || null, date: new Date().toISOString() });
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
  entry.history.push({ id: 'sc-' + Date.now() + '-' + crypto.randomBytes(4).toString('hex'), type: 'redeem', amount: -amt, description: description || '', refId: refId || null, date: new Date().toISOString() });
  writeStoreCredits(db);
  return true;
}

function readBookings() {
  try { const d = JSON.parse(cachedReadFile(BOOKINGS_DB_PATH)); return { bookings: Array.isArray(d.bookings) ? d.bookings : [] }; } catch { return { bookings: [] }; }
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
    const d = JSON.parse(cachedReadFile(STAFF_DB_PATH));
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

function maskEmail(email) {
  const [local = '', domain = ''] = String(email || '').split('@');
  if (!domain) return '';
  return `${local.slice(0, 2)}***@${domain}`;
}

function parseCookies(req) {
  const raw = req.headers.cookie || '';
  return Object.fromEntries(raw.split(';').map(v => v.trim()).filter(Boolean).map(kv => {
    const i = kv.indexOf('=');
    return [decodeURIComponent(kv.slice(0, i)), decodeURIComponent(kv.slice(i + 1))];
  }));
}

function json(res, code, body) {
  const payload = JSON.stringify(body);
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'X-Content-Type-Options': 'nosniff',
    'Strict-Transport-Security': HSTS_VALUE,
  };
  const acceptEnc = (res.req && res.req.headers && res.req.headers['accept-encoding']) || '';
  if (acceptEnc.includes('gzip') && payload.length > 1024) {
    zlib.gzip(Buffer.from(payload), { level: 6 }, (err, buf) => {
      if (err) { res.writeHead(code, headers); res.end(payload); return; }
      headers['Content-Encoding'] = 'gzip';
      headers['Vary'] = 'Accept-Encoding';
      res.writeHead(code, headers);
      res.end(buf);
    });
  } else {
    res.writeHead(code, headers);
    res.end(payload);
  }
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

function isLoopback(ip) {
  return ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1';
}

function getIp(req) {
  const remoteIp = req.socket.remoteAddress || 'unknown';
  // Only trust CF-Connecting-IP / X-Forwarded-For from loopback. Cloudflare Tunnel
  // (cloudflared) always connects from loopback, so this is sufficient. Trusting
  // all private IPs would allow anyone on the LAN to spoof an allowlisted IP.
  if (isLoopback(remoteIp)) {
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
  portalSessions.set(sid, sessionData);
  saveSessionsToDisk(PORTAL_SESSIONS_DB_PATH, portalSessions);
  res.setHeader('Set-Cookie', [
    customerSessionCookie('oe_portal_session', sid, Math.floor(PORTAL_SESSION_TTL_MS / 1000), req),
  ]);
  return sid;
}
function clearCustomerSessionCookies(res, req, portalSid) {
  if (portalSid) { portalSessions.delete(portalSid); saveSessionsToDisk(PORTAL_SESSIONS_DB_PATH, portalSessions); }
  res.setHeader('Set-Cookie', [
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
  try {
    if (!stored || typeof stored !== 'string') return false;
    const [salt, hash] = stored.split(':');
    if (!salt || !hash) return false;
    const attemptBuf = crypto.scryptSync(password, salt, 64);
    const hashBuf = Buffer.from(hash, 'hex');
    if (attemptBuf.length !== hashBuf.length) return false;
    return crypto.timingSafeEqual(attemptBuf, hashBuf);
  } catch {
    return false;
  }
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
  // Persist lockouts immediately so a restart can't clear them
  if (entry.lockedUntil > t) saveRateLimitState();
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
// Strict CSP for ad-free services (admin, portal): no 'unsafe-inline' for
// scripts — inline <script> blocks in the built HTML are allowed via SHA-256
// hashes computed lazily from dist/ (which only exists after a build).
const _inlineScriptHashCache = new Map();
function inlineScriptHashes(rootFile) {
  if (_inlineScriptHashCache.has(rootFile)) return _inlineScriptHashCache.get(rootFile);
  let hashes = [];
  try {
    const html = fs.readFileSync(path.join(__dirname, rootFile.replace(/^\//, '')), 'utf8');
    const re = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi;
    let m;
    while ((m = re.exec(html))) {
      if (m[1].trim()) hashes.push(`'sha256-${crypto.createHash('sha256').update(m[1]).digest('base64')}'`);
    }
  } catch { return []; } // dist not built yet — don't cache, retry next request
  _inlineScriptHashCache.set(rootFile, hashes);
  return hashes;
}
function strictCsp(rootFile) {
  const hashes = inlineScriptHashes(rootFile).join(' ');
  return "default-src 'self'; " +
    `script-src 'self'${hashes ? ' ' + hashes : ''}; ` +
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
    "img-src 'self' data: https:; " +
    "font-src 'self' data: https://fonts.gstatic.com; " +
    "connect-src 'self' https://nominatim.openstreetmap.org; " +
    "frame-src 'self' https://www.openstreetmap.org; " +
    "frame-ancestors 'none';";
}

// Pass null to serve rootFile for all non-asset paths (forum/admin/portal).
function serveStatic(req, res, urlPath, rootFile, spaRoutes = null, cspOverride = null) {
  const cleanPath = String(urlPath || '/').split('?')[0];
  const isAsset = cleanPath.startsWith('/assets/') || /\.(jsx|js|css|png|ico|jpg|svg|woff2?|txt)$/.test(cleanPath);
  let safePath;
  if (cleanPath === '/') {
    safePath = rootFile;
  } else if (isAsset) {
    safePath = cleanPath;
  } else if (spaRoutes !== null) {
    const stripped = cleanPath.replace(/^\/+/, '');
    const isSpaRoute = spaRoutes.has(stripped) || [...spaRoutes].some(r => stripped.startsWith(r + '/'));
    safePath = isSpaRoute ? rootFile : cleanPath;
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
    if (idx >= paths.length) { return sendErrorPage(req, res, 404, 'Not found', ERROR_404_HTML); }
    const filePath = paths[idx];
    if (!ALLOWED_SERVE_ROOTS.some(root => filePath.startsWith(root))) { return tryRead(paths, idx + 1); }

    const ext = path.extname(filePath).toLowerCase();
    const types = { '.html': 'text/html', '.jsx': 'text/javascript', '.js': 'text/javascript', '.css': 'text/css', '.txt': 'text/plain', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff': 'font/woff', '.woff2': 'font/woff2' };
    const isSoftwareDownload = filePath.includes('/assets/uploads/software/') && !filePath.includes('/.chunks/');
    const isImmutable = /\.(js|css|png|jpg|jpeg|webp|gif|svg|ico|woff2?)$/.test(ext) && !isSoftwareDownload;
    const cacheHeader = isImmutable ? 'public, max-age=31536000, immutable' : 'no-cache, must-revalidate';
    const isHtml = ext === '.html';
    const isEmbeddable = isHtml && cleanPath.startsWith('/assets/') && !cleanPath.startsWith('/assets/uploads/');
    const securityHeaders = isHtml ? {
      'X-Frame-Options': isEmbeddable ? 'SAMEORIGIN' : 'DENY',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Strict-Transport-Security': HSTS_VALUE,
      'Permissions-Policy': PERMISSIONS_POLICY,
      'Content-Security-Policy': isEmbeddable
        ? "default-src 'self'; script-src 'self' https://cdnjs.cloudflare.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: https:; font-src 'self' data: https://fonts.gstatic.com; connect-src 'self' https://nominatim.openstreetmap.org; frame-src https://www.openstreetmap.org; frame-ancestors 'self';"
        : (cspOverride || PUBLIC_CSP),
    } : { 'X-Content-Type-Options': 'nosniff', 'Strict-Transport-Security': HSTS_VALUE };
    const isPdf = ext === '.pdf';
    const expiresDate = isImmutable
      ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toUTCString()
      : new Date(0).toUTCString();

    // Stream large binary downloads directly — no buffering in memory.
    if (isSoftwareDownload || isPdf) {
      fs.stat(filePath, (statErr, stat) => {
        if (statErr) return tryRead(paths, idx + 1);
        const totalSize = stat.size;
        const rangeHeader = req.headers['range'];
        const filename = path.basename(filePath).replace(/^\d+-/, '');
        const baseHeaders = {
          'Content-Type': types[ext] || 'application/octet-stream',
          'Content-Disposition': `attachment; filename="${filename}"`,
          'Accept-Ranges': 'bytes',
          'Cache-Control': 'public, max-age=31536000, immutable',
          'X-Content-Type-Options': 'nosniff',
          'Strict-Transport-Security': HSTS_VALUE,
        };
        if (rangeHeader) {
          const match = rangeHeader.match(/^bytes=(\d*)-(\d*)$/);
          const start = match && match[1] !== '' ? parseInt(match[1], 10) : 0;
          const end = match && match[2] !== '' ? parseInt(match[2], 10) : totalSize - 1;
          if (!match || start > end || end >= totalSize) {
            res.writeHead(416, { 'Content-Range': `bytes */${totalSize}` });
            return res.end();
          }
          res.writeHead(206, { ...baseHeaders, 'Content-Range': `bytes ${start}-${end}/${totalSize}`, 'Content-Length': end - start + 1 });
          fs.createReadStream(filePath, { start, end }).pipe(res);
        } else {
          res.writeHead(200, { ...baseHeaders, 'Content-Length': totalSize });
          const stream = fs.createReadStream(filePath);
          stream.on('error', () => { if (!res.headersSent) res.end(); else res.destroy(); });
          stream.pipe(res);
        }
      });
      return;
    }

    fs.readFile(filePath, (err, data) => {
      if (err) return tryRead(paths, idx + 1);
      const extraHeaders = {};
      const baseHeaders = {
        'Content-Type': (types[ext] || 'application/octet-stream'),
        'Cache-Control': cacheHeader,
        'Expires': expiresDate,
        ...securityHeaders,
        ...extraHeaders,
      };
      const compressible = new Set(['.js', '.jsx', '.css', '.html', '.svg', '.json', '.txt', '.xml']);
      const acceptEnc = req.headers['accept-encoding'] || '';
      if (compressible.has(ext) && acceptEnc.includes('gzip')) {
        const cached = gzipCache.get(filePath);
        if (cached) {
          res.writeHead(200, { ...baseHeaders, 'Content-Encoding': 'gzip', 'Vary': 'Accept-Encoding' });
          res.end(cached);
        } else {
          zlib.gzip(data, { level: 6 }, (gzErr, buf) => {
            if (gzErr) { res.writeHead(200, baseHeaders); res.end(data); return; }
            if (isImmutable) gzipCache.set(filePath, buf);
            res.writeHead(200, { ...baseHeaders, 'Content-Encoding': 'gzip', 'Vary': 'Accept-Encoding' });
            res.end(buf);
          });
        }
      } else {
        res.writeHead(200, baseHeaders);
        res.end(data);
      }
    });
  };
  tryRead(candidates, 0);
}

// ── OG tag injection for social crawlers ─────────────────────────────────────

const OG_BASE_URL = 'https://outbackelectronics.com.au';

const STATIC_OG = {
  '/':          { title: 'Outback Electronics — Built for where the signal ends', description: 'Arduino & microcontroller builds, PC & phone repairs, software and AI solutions, and off-grid electronics — serving remote Australia by appointment.', image: '/assets/og-image.webp' },
  '/home':      { title: 'Outback Electronics — Built for where the signal ends', description: 'Arduino & microcontroller builds, PC & phone repairs, software and AI solutions, and off-grid electronics — serving remote Australia by appointment.', image: '/assets/og-image.webp' },
  '/shop':        { title: 'Shop — Outback Electronics',           description: 'Browse rugged laptops, solar gear, satellite comms, UHF radios and off-grid tools built for remote Australia.',           image: '/assets/og-image.webp' },
  '/services':    { title: 'Services — Outback Electronics',       description: 'Expert repairs, field service and bench diagnostics for rugged devices. Book a repair or drop in.',                       image: '/assets/og-image.webp' },
  '/groups':      { title: 'Community Groups — Outback Electronics', description: 'Connect with community chapters across remote Australia. Find your local Outback Electronics group.',                  image: '/assets/og-image.webp' },
  '/memberships': { title: 'Memberships — Outback Electronics',    description: 'Join the Outback Electronics community. Member discounts, priority repairs and exclusive access.',                       image: '/assets/og-image.webp' },
  '/tutorials':   { title: 'Tutorials — Outback Electronics',      description: 'Field guides, how-to videos and repair tutorials for off-grid gear and rugged electronics.',                            image: '/assets/og-image.webp' },
  '/software':    { title: 'Software Library — Outback Electronics', description: 'Download firmware, drivers and utilities for rugged devices and off-grid hardware.',                                  image: '/assets/og-image.webp' },
  '/ai':          { title: 'Edge AI — Outback Electronics',        description: 'Offline-capable AI models and inference hardware for remote deployments. No cloud required.',                           image: '/assets/og-image.webp' },
  '/ewaste':      { title: 'eWaste Take-Back — Outback Electronics', description: 'Responsible eWaste recycling and take-back for old electronics. Drop in or arrange a pickup.',                        image: '/assets/og-image.webp' },
  '/contact':     { title: 'Contact — Outback Electronics',        description: null, image: '/assets/og-image.webp' },
  '/quote':       { title: 'Request a Quote — Outback Electronics', description: 'Need a custom kit or bulk order? Request a quote from Outback Electronics.',                                          image: '/assets/og-image.webp' },
  '/about':       { title: 'About — Outback Electronics',           description: 'Learn about Outback Electronics — our mission, team, and commitment to remote Australia.',                           image: '/assets/og-image.webp' },
  '/repairs':     { title: 'Repairs — Outback Electronics',         description: 'Expert device repairs for rugged electronics, laptops, phones and off-grid gear. Drop in or book online.',          image: '/assets/og-image.webp' },
  '/policies':    { title: 'Policies — Outback Electronics',        description: 'Shipping, returns, warranty and privacy policies for Outback Electronics.',                                          image: '/assets/og-image.webp' },
  '/sellers':     { title: 'Info for Sellers — Outback Electronics', description: 'Sell your surplus electronics through Outback Electronics. Consignment and trade-in options available.',           image: '/assets/og-image.webp' },
  '/gift-cards':  { title: 'Gift Cards — Outback Electronics',      description: 'Give the gift of rugged gear. Outback Electronics gift cards — perfect for the remote tech enthusiast.',            image: '/assets/og-image.webp' },
};

function stripHtml(s) { return String(s || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim(); }

function resolveOgTags(pathname) {
  // Static routes
  if (STATIC_OG[pathname]) {
    const s = STATIC_OG[pathname];
    let description = s.description;
    if (description === null) {
      // Build from live settings
      try {
        const { shop } = readSettings();
        const loc = [shop.suburb, shop.state].filter(Boolean).join(' ');
        description = `Get in touch with the Outback Electronics team.${loc ? ` Based in ${loc},` : ''} Serving remote Australia by appointment.`;
      } catch { description = 'Get in touch with the Outback Electronics team. Serving remote Australia by appointment.'; }
    }
    return { title: s.title, description, image: s.image, url: OG_BASE_URL + pathname };
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

let _heroPreloadCache = { html: '', expires: 0 };
function getHeroImagePreload() {
  // Recomputing this reads + parses products.db on every home-page request.
  // Cache for a short window so the document TTFB stays low under load.
  const now = Date.now();
  if (now < _heroPreloadCache.expires) return _heroPreloadCache.html;
  const html = _computeHeroImagePreload();
  _heroPreloadCache = { html, expires: now + 30000 };
  return html;
}
function _computeHeroImagePreload() {
  try {
    const products = readProducts().filter(p => p.status === 'published');
    const hero = products.find(p => p.infiniteStock || p.stock > 0) || products[0];
    if (hero && hero.images && hero.images.length > 0) {
      const src = hero.images[0];
      if (src.startsWith('/assets/uploads/')) {
        const u = w => `/api/thumb?src=${encodeURIComponent(src)}&w=${w}&q=82`;
        const srcset = [600, 800, 1000, 1200].map(w => `${u(w)} ${w}w`).join(', ');
        // Mirror the hero <img> srcset/sizes so the preload matches the variant
        // the browser actually picks — no wasted second download.
        return `<link rel="preload" as="image" href="${u(1000)}" imagesrcset="${srcset}" imagesizes="(max-width: 900px) 100vw, 560px" fetchpriority="high">`;
      }
    }
  } catch {}
  return '';
}

let _indexTemplateCache = { template: null, mtimeMs: 0 };
function readIndexTemplate(distPath, cb) {
  // The base index.html never changes between deploys; avoid re-reading it from
  // disk on every document request. Invalidate via mtime so a deploy is picked up.
  fs.stat(distPath, (statErr, stat) => {
    if (!statErr && _indexTemplateCache.template != null && stat.mtimeMs === _indexTemplateCache.mtimeMs) {
      return cb(null, _indexTemplateCache.template);
    }
    fs.readFile(distPath, 'utf8', (err, template) => {
      if (err) return cb(err);
      if (!statErr) _indexTemplateCache = { template, mtimeMs: stat.mtimeMs };
      cb(null, template);
    });
  });
}

function buildJsonLd(og, pathname) {
  const isHome = pathname === '/' || pathname === '/home';
  if (!isHome) return '';
  let shopData = {};
  try { shopData = readSettings().shop || {}; } catch {}
  const address = {
    '@type': 'PostalAddress',
    addressCountry: 'AU',
    ...(shopData.suburb  ? { addressLocality: shopData.suburb }  : {}),
    ...(shopData.state   ? { addressRegion:   shopData.state   } : {}),
    ...(shopData.postcode ? { postalCode:     shopData.postcode } : {}),
  };
  const ld = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: 'Outback Electronics',
    url: OG_BASE_URL,
    logo: `${OG_BASE_URL}/assets/logo.webp`,
    image: `${OG_BASE_URL}/assets/og-image.webp`,
    description: og.description,
    address,
    ...(shopData.phone ? { telephone: shopData.phone } : {}),
    ...(shopData.email ? { email: shopData.email }     : {}),
  };
  return `<script type="application/ld+json">${JSON.stringify(ld)}</script>`;
}

function serveIndexWithOg(req, res, og, pathname) {
  const distPath = path.join(__dirname, 'dist', 'index.html');
  readIndexTemplate(distPath, (err, template) => {
    if (err) return sendErrorPage(req, res, 404, 'Not found', ERROR_404_HTML);
    const ogType = og.type === 'product' ? 'product' : 'website';
    const isHome = pathname === '/' || pathname === '/home';
    const heroPreload = isHome ? getHeroImagePreload() : '';
    const absoluteImage = og.image && og.image.startsWith('/') ? OG_BASE_URL + og.image : og.image;
    const jsonLd = buildJsonLd(og, pathname);
    const extraHead = [heroPreload, jsonLd].filter(Boolean).join('\n');
    const html = template
      .replace(/<\/head>/, `${extraHead}\n</head>`)
      .replace(/<title>[^<]*<\/title>/, `<title>${escOg(og.title)}</title>`)
      .replace(/<meta name="description"[^>]*\/?>/, `<meta name="description" content="${escOg(og.description)}" />`)
      .replace(/<meta property="og:title"[^>]*\/?>/, `<meta property="og:title" content="${escOg(og.title)}" />`)
      .replace(/<meta property="og:description"[^>]*\/?>/, `<meta property="og:description" content="${escOg(og.description)}" />`)
      .replace(/<meta property="og:image"[^>]*\/?>/, `<meta property="og:image" content="${escOg(absoluteImage)}" />`)
      .replace(/<meta property="og:url"[^>]*\/?>/, `<meta property="og:url" content="${escOg(og.url)}" />`)
      .replace(/<meta property="og:type"[^>]*\/?>/, `<meta property="og:type" content="${ogType}" />`)
      .replace(/<meta name="twitter:title"[^>]*\/?>/, `<meta name="twitter:title" content="${escOg(og.title)}" />`)
      .replace(/<meta name="twitter:description"[^>]*\/?>/, `<meta name="twitter:description" content="${escOg(og.description)}" />`)
      .replace(/<meta name="twitter:image"[^>]*\/?>/, `<meta name="twitter:image" content="${escOg(absoluteImage)}" />`)
      .replace(/<link rel="canonical"[^>]*\/?>/, `<link rel="canonical" href="${escOg(og.url)}" />`);
    gzipSend(req, res, 200, {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-cache, must-revalidate',
      'X-Frame-Options': 'DENY',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Strict-Transport-Security': HSTS_VALUE,
      'Permissions-Policy': PERMISSIONS_POLICY,
      'Content-Security-Policy': PUBLIC_CSP,
    }, html);
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

function sendErrorPage(req, res, status, fallback, html) {
  if (!html) { res.writeHead(status); return res.end(fallback); }
  let body = html;
  try {
    const { shop } = readSettings();
    const loc = [shop.suburb, shop.state, shop.postcode].filter(Boolean).join(' ') || 'Central Queensland, Australia';
    body = body.replace(/<!--SHOP_LOCATION-->[^<]*/g, `<!--SHOP_LOCATION-->${loc}`);
  } catch {}
  gzipSend(req, res, status, {
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'no-cache, must-revalidate',
    'X-Frame-Options': 'SAMEORIGIN',
    'X-Content-Type-Options': 'nosniff',
    'Strict-Transport-Security': HSTS_VALUE,
  }, body);
}

function sendMaintenance(req, res) {
  if (!MAINTENANCE_HTML) { res.writeHead(503); return res.end('Service temporarily unavailable.'); }
  const { shop } = readSettings();
  const email = (shop && shop.email) ? shop.email.trim() : '';
  const emailHtml = email
    ? `<p class="note">Need help? Shoot us an email at <a href="mailto:${email}">${email}</a>!</p>`
    : '';
  const html = MAINTENANCE_HTML.replace(/\{\{CONTACT_EMAIL\}\}/g, emailHtml);
  gzipSend(req, res, 503, {
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'no-cache, must-revalidate',
    'X-Frame-Options': 'SAMEORIGIN',
    'X-Content-Type-Options': 'nosniff',
    'Strict-Transport-Security': HSTS_VALUE,
  }, html);
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

  if (url.pathname === '/maintenance') { sendMaintenance(req, res); return true; }

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
  const address = shop.address || '';
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

function emailOrderShipped({ orderId, warrantyToken, customerName, trackingNumber }) {
  const name = customerName ? customerName.split(' ')[0] : '';
  const trackingUrl = `https://auspost.com.au/mypost/track/#/details/${encodeURIComponent(trackingNumber)}`;
  const registerUrl = `${getPortalUrl()}/?warranty=${encodeURIComponent(warrantyToken || orderId)}`;
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
    parts.push({ id: item.id || ('p-' + Date.now() + '-' + crypto.randomBytes(4).toString('hex')), name: item.name, qty: parseInt(item.qty) || 1, status: 'pending', orderedAt: null, deliveredAt: null, installedAt: null });
  }
  if (dq.pcBuild && dq.pcBuildFee > 0) {
    parts.push({ id: 'p-build', name: 'Custom PC Build (labour)', qty: 1, status: 'pending', orderedAt: null, deliveredAt: null, installedAt: null });
  }
  for (const item of (dq.otherItems || [])) {
    if (!item.description) continue;
    parts.push({ id: item.id || ('p-' + Date.now() + '-' + crypto.randomBytes(4).toString('hex')), name: item.description, qty: 1, status: 'pending', orderedAt: null, deliveredAt: null, installedAt: null });
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
function getToolsUrl() {
  if (TOOLS_URL) return TOOLS_URL;
  const base = getSiteUrl();
  if (/^https?:\/\/(localhost|127\.|0\.0\.0\.0)(:\d+)?/.test(base))
    return base.replace(/(:\d+)?(\/|$)/, ':8085$2');
  return base.replace(/^(https?:\/\/)/, '$1tools.');
}
function getWeatherUrl() {
  if (WEATHER_URL) return WEATHER_URL;
  const base = getSiteUrl();
  if (/^https?:\/\/(localhost|127\.|0\.0\.0\.0)(:\d+)?/.test(base))
    return base.replace(/(:\d+)?(\/|$)/, ':8089$2');
  return base.replace(/^(https?:\/\/)/, '$1weather.');
}
// Resolve a service URL: explicit env override wins, else derive from the
// configured site URL (subdomain in prod, port on localhost).
function subUrl(override, port, sub) {
  return override || _defaultSubUrl(getSiteUrl(), port, sub);
}
// Aggregated map of every service URL. Returned by /api/shop-info on every
// server so any frontend (especially the hub launcher) can cross-link without
// hard-coding hostnames. Localhost falls back to ports; production to subdomains.
function serviceUrls() {
  return {
    siteUrl:     getSiteUrl(),
    portalUrl:   subUrl(process.env.PORTAL_URL,   PORTAL_PORT,     'portal'),
    gamesUrl:    subUrl(process.env.GAMES_URL,    GAMES_PORT,      'games'),
    toolsUrl:    subUrl(process.env.TOOLS_URL,    TOOLS_PORT,      'tools'),
    weatherUrl:  subUrl(process.env.WEATHER_URL,  WEATHER_PORT,    'weather'),
    aiUrl:       subUrl(process.env.AI_URL,       AI_GATEWAY_PORT, 'ai'),
    hubUrl:      subUrl(process.env.HUB_URL,      HUB_PORT,        'hub'),
    driveUrl:    subUrl(process.env.DRIVE_URL,    DRIVE_PORT,      'drive'),
    photosUrl:   subUrl(process.env.PHOTOS_URL,   PHOTOS_PORT,     'photos'),
    skyUrl:      subUrl(process.env.SKY_URL,      SKY_PORT,        'sky'),
    coverageUrl: subUrl(process.env.COVERAGE_URL, COVERAGE_PORT,   'coverage'),
    mapsUrl:     subUrl(process.env.MAPS_URL,     MAPS_PORT,       'maps'),
    solarUrl:    subUrl(process.env.SOLAR_URL,    SOLAR_PORT,      'solar'),
    beaconUrl:   subUrl(process.env.BEACON_URL,   BEACON_PORT,     'beacon'),
    fireUrl:     subUrl(process.env.FIRE_URL,     FIRE_PORT,       'fire'),
    radioUrl:    subUrl(process.env.RADIO_URL,    RADIO_PORT,      'radio'),
    swapUrl:     subUrl(process.env.SWAP_URL,     SWAP_PORT,       'swap'),
  };
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

function readRawBody(req, maxSize = 10 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let totalSize = 0;
    req.on('data', c => {
      totalSize += c.length;
      if (totalSize > maxSize) {
        req.destroy();
        return reject(new Error('request_body_too_large'));
      }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function verifyStripeSignature(rawBody, sigHeader, secret, toleranceSeconds = 300) {
  const parts = Object.fromEntries(sigHeader.split(',').map(p => p.split('=')));
  if (!parts.t || !parts.v1) return false;

  const signedTime = parseInt(parts.t, 10);
  const now = Math.floor(Date.now() / 1000);
  if (isNaN(signedTime) || Math.abs(now - signedTime) > toleranceSeconds) {
    return false;
  }

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
  const username = typeof body.username === 'string' ? body.username.trim() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  const firstName = typeof body.firstName === 'string' ? body.firstName.trim() : '';
  const lastName  = typeof body.lastName  === 'string' ? body.lastName.trim()  : '';
  let email       = typeof body.email     === 'string' ? body.email.trim().toLowerCase() : '';
  // Registration from an order-tracking link: the client sends the token and the
  // server resolves the email itself, so the address is never exposed client-side.
  if (typeof body.orderToken === 'string' && body.orderToken) {
    const tokenOrder = readOrders().find(o => o.trackingToken === body.orderToken && o.trackingTokenExpiry > Date.now());
    if (!tokenOrder || !tokenOrder.email) return json(res, 400, { error: 'invalid_token', message: 'This link is invalid or has expired.' });
    email = String(tokenOrder.email).trim().toLowerCase();
  }
  const phone     = typeof body.phone     === 'string' ? body.phone.trim()     : '';
  const address   = typeof body.address   === 'string' ? body.address.trim()   : '';
  if (!firstName) return json(res, 422, { error: 'invalid_payload', message: 'First name is required.' });
  if (!lastName)  return json(res, 422, { error: 'invalid_payload', message: 'Last name is required.' });
  if (!email)     return json(res, 422, { error: 'invalid_payload', message: 'Email address is required.' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json(res, 422, { error: 'invalid_payload', message: 'Email address is invalid.' });
  if (!/^[a-zA-Z0-9_]{3,30}$/.test(username)) return json(res, 422, { error: 'invalid_payload', message: 'Username must be 3–30 characters, letters, numbers and underscores only.' });
  if (password.length < 8) return json(res, 422, { error: 'invalid_payload', message: 'Password must be at least 8 characters.' });
  const displayName = `${firstName} ${lastName}`.trim();
  const users = readUsers();
  if (users.find(u => u.username && u.username.toLowerCase() === username.toLowerCase()))
    return json(res, 409, { error: 'username_taken', message: 'That username is already taken.' });
  if (users.find(u => u.email && u.email === email))
    return json(res, 409, { error: 'email_taken', message: 'An account with that email address already exists.' });
  const user = { id: 'U-' + Date.now(), username, firstName, lastName, displayName, email, phone, address, passwordHash: hashPassword(password), createdAt: new Date().toISOString() };
  users.push(user);
  writeUsers(users);
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
  const users = readUsers();
  const isEmail = credential.includes('@');
  const user = isEmail
    ? users.find(u => u.email && u.email.toLowerCase() === credential.toLowerCase())
    : users.find(u => u.username && u.username.toLowerCase() === credential.toLowerCase());
  if (!user || !user.passwordHash || !verifyPassword(password, user.passwordHash)) {
    trackFailure(loginKey);
    return json(res, 401, { ok: false, message: 'Invalid username/email or password.' });
  }
  clearFailures(loginKey);
  setCustomerSessionCookies(res, user, req);
  return json(res, 200, { ok: true, user: { id: user.id, username: user.username, displayName: user.displayName, createdAt: user.createdAt } });
}

function handleCustomerLogout(req, res) {
  const portalSession = getPortalSession(req);
  clearCustomerSessionCookies(res, req, portalSession?.sid);
  return json(res, 200, { ok: true });
}

function handleCustomerMe(req, res) {
  const session = getPortalSession(req);
  if (!session) return json(res, 200, { user: null });
  return json(res, 200, { user: { id: session.id, username: session.username, displayName: session.displayName, createdAt: session.createdAt } });
}

// ── Main server (8080) ────────────────────────────────────────────────────────

const mainServer = http.createServer(async (req, res) => {
  try {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (checkMaintenance(req, res, url)) return;

  if (req.method === 'GET' && url.pathname === '/robots.txt') {
    const txt = [
      'User-agent: *',
      'Disallow: /api/',
      'Disallow: /assets/uploads/',
      `Sitemap: ${OG_BASE_URL}/sitemap.xml`,
    ].join('\n') + '\n';
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=3600', 'Expires': new Date(Date.now() + 3600 * 1000).toUTCString() });
    return res.end(txt);
  }

  if (req.method === 'GET' && url.pathname === '/.well-known/security.txt') {
    const { shop } = readSettings();
    const contact = ((shop && shop.email) ? shop.email.trim() : '') || NOTIFY_EMAIL || '';
    const expires = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().replace(/\.\d{3}Z$/, 'Z');
    const lines = [`Expires: ${expires}`, 'Preferred-Languages: en'];
    if (contact) lines.unshift(`Contact: mailto:${contact}`);
    const txt = lines.join('\n') + '\n';
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=86400' });
    return res.end(txt);
  }

  if (req.method === 'GET' && url.pathname === '/sitemap.xml') {
    const now = new Date().toISOString().slice(0, 10);
    const staticUrls = Object.keys(STATIC_OG).map(p => `  <url><loc>${escOg(OG_BASE_URL + p)}</loc><lastmod>${now}</lastmod><changefreq>weekly</changefreq><priority>${p === '/' || p === '/home' ? '1.0' : '0.8'}</priority></url>`);
    let productUrls = [];
    try {
      productUrls = readProducts()
        .filter(p => p.status === 'published' && (p.sku || p.id))
        .map(p => {
          const id = encodeURIComponent(p.sku || p.id);
          return `  <url><loc>${escOg(OG_BASE_URL + '/product/' + id)}</loc><lastmod>${now}</lastmod><changefreq>weekly</changefreq><priority>0.7</priority></url>`;
        });
    } catch {}
    const xml = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
      ...staticUrls,
      ...productUrls,
      '</urlset>',
    ].join('\n');
    res.writeHead(200, { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=3600', 'Expires': new Date(Date.now() + 3600 * 1000).toUTCString() });
    return res.end(xml);
  }

  if (req.method === 'GET' && url.pathname === '/api/csrf-token') {
    const token = ensureCsrfCookie(req, res);
    return json(res, 200, { token });
  }

  if (['POST', 'PATCH', 'DELETE'].includes(req.method) && url.pathname !== '/api/stripe/webhook' && url.pathname !== '/api/analytics/event' && url.pathname !== '/api/ai-chat') {
    if (!verifyCsrf(req, res)) return;
  }

  if (req.method === 'GET' && url.pathname === '/api/testimonial') {
    const customers = readCustomers();
    const featured = customers.find(c => c.testimonialFeatured && c.testimonial);
    if (!featured) return json(res, 200, { testimonial: null });
    return json(res, 200, { testimonial: { quote: featured.testimonial, name: featured.name, loc: featured.loc } });
  }

  // Public analytics event ingestion
  if (req.method === 'POST' && url.pathname === '/api/analytics/event') {
    if (publicRateLimited(getIp(req), 'analytics')) return json(res, 429, { error: 'rate_limited' });
    let body;
    try { body = await readJson(req); } catch { return json(res, 400, { error: 'bad_request' }); }
    const type = typeof body.type === 'string' ? body.type.slice(0, 64) : null;
    if (!type) return json(res, 400, { error: 'missing_type' });
    const page = typeof body.page === 'string' ? body.page.slice(0, 256) : '';
    const referrer = typeof body.referrer === 'string' ? body.referrer.slice(0, 256) : '';
    const ua = (req.headers['user-agent'] || '').slice(0, 256);
    const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
    // Rough bot detection — don't record bot traffic
    if (/bot|crawl|spider|slurp|headless/i.test(ua)) return json(res, 204, {});
    appendAnalyticsEvent({ ts: Date.now(), type, page, referrer, ua, ip });
    return json(res, 204, {});
  }

  if (req.method === 'GET' && url.pathname === '/api/metrics') {
    const repairs = readRepairs();
    const ewaste = readEwaste();
    const repairCount = (repairs.columns || []).reduce((sum, col) => sum + ((col.cards || []).length), 0);
    const ewasteTonnes = ewaste.reduce((sum, item) => sum + (Number(item.weightKg) || Number(item.kg) || 0), 0) / 1000;
    const resaleable = ewaste.filter(item => item.tier && item.tier !== 'D').length;
    const resalePercent = ewaste.length > 0 ? Math.round((resaleable / ewaste.length) * 100) : null;
    return json(res, 200, { repairCount, ewasteTonnes, resalePercent });
  }


  if (req.method === 'GET' && url.pathname === '/api/forum/recent') {
    try {
      const httpsM = require('https');
      const data = await new Promise((resolve, reject) => {
        const r2 = httpsM.get('https://forum.outbackelectronics.com.au/latest.json?order=created', {
          headers: { 'Accept': 'application/json', 'User-Agent': 'OutbackElectronics/1.0' },
        }, r => {
          let buf = '';
          r.on('data', c => buf += c);
          r.on('end', () => { try { resolve(JSON.parse(buf)); } catch { reject(new Error('parse')); } });
        });
        r2.on('error', reject);
        r2.setTimeout(5000, () => { r2.destroy(); reject(new Error('timeout')); });
      });
      const topics = (data?.topic_list?.topics || [])
        .filter(t => !t.pinned)
        .slice(0, 5)
        .map(t => ({ id: t.id, title: t.title, slug: t.slug, reply_count: t.reply_count || 0, views: t.views || 0, created_at: t.created_at }));
      return json(res, 200, { topics });
    } catch {
      return json(res, 200, { topics: [] });
    }
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
      gamesUrl: getGamesUrl(),
      toolsUrl: getToolsUrl(),
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
      const qty = Math.min(999, Math.max(1, Math.floor(Number(li.quantity) || 1)));
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
    // Include our order number (created by the Stripe webhook) so the success
    // page can show the customer a reference for pickup/support.
    const matchedOrder = readOrders().find(o => o.stripeSessionId === sid);
    return json(res, 200, {
      amountAud: (s.amount_total || 0) / 100,
      customerName: s.customer_details?.name || '',
      customerEmail: s.customer_details?.email || '',
      orderId: matchedOrder ? matchedOrder.id : null,
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
    if (rawLineItems.length > 100) return json(res, 422, { error: 'too_many_items', message: 'A checkout can contain at most 100 line items.' });

    // Resolve authoritative server-side prices from the catalog.
    // Client-supplied priceAud is ignored for any item with a recognised productId.
    const catalogProducts = readProducts();
    const catalogServices = readServices();
    const { tiers: membershipTiers } = readMemberships();
    function lookupCatalogPrice(pid, variantSku) {
      if (!pid) return null;
      const prod = catalogProducts.find(p => p.id === pid && p.status === 'published');
      if (prod) {
        if (prod.variants && prod.variants.length > 0) {
          // Price lives on the variant — must identify it server-side; never trust client price.
          const variant = variantSku
            ? (prod.variants.find(v => v.sku === variantSku) || prod.variants.find(v => v.name === variantSku))
            : null;
          if (!variant) return null;
          const price = Number(variant.price);
          return price > 0 ? { priceAud: price, name: `${prod.name}${variant.name ? ` — ${variant.name}` : ''}` } : null;
        }
        const price = Number(prod.priceAud);
        return price > 0 ? { priceAud: price, name: prod.name } : null;
      }
      const svc = catalogServices.find(s => s.id === pid && s.status === 'published');
      if (svc) { const price = Number(svc.priceAud); return price > 0 ? { priceAud: price, name: svc.name } : null; }
      const tier = membershipTiers.find(t => t.id === pid && t.status === 'published');
      if (tier) { const price = Number(tier.priceAud); return price > 0 ? { priceAud: price, name: tier.name } : null; }
      return null;
    }
    const lineItems = [];
    for (const li of rawLineItems) {
      const pid = String(li.productId || '');
      const qty = Math.floor(Number(li.quantity) || 0);
      if (qty < 1 || qty > 999) return json(res, 422, { error: 'invalid_quantity', message: `Quantity for item ${pid || '(unknown)'} must be between 1 and 999.` });
      if (pid.startsWith('gc-')) {
        // Gift card denominations: price is the chosen denomination value.
        // Look up in catalog; fall back to client value only if not found (admin-created custom GC).
        const catalogEntry = lookupCatalogPrice(pid);
        const resolvedPrice = catalogEntry ? catalogEntry.priceAud : Number(li.priceAud);
        if (!resolvedPrice || resolvedPrice <= 0) return json(res, 422, { error: 'invalid_item', message: `Invalid gift card: ${pid}` });
        lineItems.push({ ...li, priceAud: resolvedPrice, name: li.name || (catalogEntry ? catalogEntry.name : `Gift Card`), quantity: qty, productId: pid });
      } else if (pid) {
        const variantSku = li.variantSku ? String(li.variantSku) : null;
        const catalogEntry = lookupCatalogPrice(pid, variantSku);
        if (!catalogEntry) return json(res, 422, { error: 'invalid_item', message: `Product not found or variant not specified: ${pid}` });
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
    const rawShipping = Number(shippingAmount) || 0;
    if (rawShipping < 0 || rawShipping > 200) return json(res, 422, { error: 'invalid_shipping', message: 'Shipping amount is outside the accepted range.' });
    const validatedShipping = rawShipping > 0 ? rawShipping : 0;
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
      // Hold the checkout lock for the entire read-modify-write so concurrent
      // requests with the same gift card code cannot both succeed.
      const gcResult = await withFileLock(CHECKOUT_LOCK, async () => {
        // Re-read and re-validate inside the lock to prevent double-spend.
        const gcList = readGiftCards();
        const gcIdx = gcList.findIndex(c => c.code === gcCodeNorm && !c.isVoid && c.balance >= gcDiscount);
        if (gcIdx < 0) return null; // balance already spent by a concurrent request
        const allOrders = readOrders();
        const maxNum = allOrders.reduce((max, o) => { const m = String(o.id || '').match(/^OE-(\d+)$/); return m ? Math.max(max, parseInt(m[1])) : max; }, 1000);
        const newOrderId = `OE-${maxNum + 1}`;
        gcList[gcIdx].balance = Math.max(0, Math.round((gcList[gcIdx].balance - gcDiscount) * 100) / 100);
        gcList[gcIdx].redemptions = [...(gcList[gcIdx].redemptions || []), { orderId: newOrderId, amount: gcDiscount, date: new Date().toISOString() }];
        writeGiftCards(gcList);
        const gcOnlyOrder = {
          id: newOrderId,
          warrantyToken: crypto.randomBytes(16).toString('hex'),
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
        return newOrderId;
      });
      if (!gcResult) return json(res, 422, { error: 'invalid_gift_card', message: 'Gift card has already been used or has insufficient balance.' });
      if (validatedRewardsToken && rewardsUserId) {
        const pts = Math.round(rewardsDiscount * 100);
        if (pts > 0) deductRewardPoints(rewardsUserId, pts, `Order ${gcResult}`, `redeem-${gcResult}`);
        rewardsTokens.delete(validatedRewardsToken);
      }
      // Decrement stock for gift-card-covered orders
      const gcStockItems = lineItems.filter(li => li.productId && !li.productId.startsWith('gc-') && !membershipTiers.some(t => t.id === li.productId));
      if (gcStockItems.length > 0) {
        const prods = readProducts();
        let stockChanged = false;
        for (const si of gcStockItems) {
          const idx = prods.findIndex(p => p.id === si.productId);
          if (idx < 0) continue;
          const prod = prods[idx];
          if (prod.infiniteStock) continue;
          const vsku = si.variantSku || null;
          if (vsku && prod.variants && prod.variants.length > 0) {
            const vi = prod.variants.findIndex(v => v.sku === vsku);
            if (vi >= 0 && prod.variants[vi].stock != null) {
              prod.variants[vi] = { ...prod.variants[vi], stock: Math.max(0, prod.variants[vi].stock - (si.quantity || 1)) };
              prods[idx] = prod;
              stockChanged = true;
            }
          } else if (prod.stock != null) {
            prods[idx] = { ...prod, stock: Math.max(0, prod.stock - (si.quantity || 1)) };
            stockChanged = true;
          }
        }
        if (stockChanged) writeProducts(prods);
      }
      return json(res, 200, { url: `${getSiteUrl()}/order-success?order_id=${gcResult}`, sessionId: null, fullyCoveredByGiftCard: true });
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
    // Encode all physical (non-gc, non-membership, non-discount) items for stock decrement in webhook
    const stockableItems = lineItems.filter(li => li.productId && !li.productId.startsWith('gc-') && !li._isMemberDiscount && !membershipTiers.some(t => t.id === li.productId));
    if (stockableItems.length > 0) {
      const encoded = stockableItems.map(li => `${li.productId}:${li.variantSku || '_'}:${li.quantity || 1}`).join('|').slice(0, 500);
      params['metadata[cartItems]'] = encoded;
      params['payment_intent_data[metadata][cartItems]'] = encoded;
    }
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

    let rawBody;
    try { rawBody = await readRawBody(req); }
    catch (err) {
      console.error('Stripe webhook body read error:', err);
      return json(res, 413, { error: 'payload_too_large' });
    }

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

      // Build shipping address outside the lock (pure computation, no I/O).
      const shippingDetails = session.shipping_details || session.shipping || {};
      const shipAddr = shippingDetails.address || details.address || {};
      const shippingAddress = [
        shippingDetails.name || details.name || '',
        shipAddr.line1 || '',
        shipAddr.line2 || '',
        [shipAddr.city, shipAddr.state, shipAddr.postal_code].filter(Boolean).join(' '),
        shipAddr.country || '',
      ].filter(Boolean).join(', ');

      // All order/GC/rewards writes are held under CHECKOUT_LOCK to prevent
      // concurrent webhook deliveries from generating duplicate order IDs or
      // double-spending the same gift card balance.
      const webhookEmails = await withFileLock(CHECKOUT_LOCK, async () => {
        const orders = readOrders();
        const existingOrderId = meta.existingOrderId || '';
        const existingIdx = existingOrderId
          ? orders.findIndex(o => o.id === existingOrderId)
          : orders.findIndex(o => o.stripeSessionId === session.id);

        if (existingIdx >= 0 && existingOrderId) {
          // Payment for a pre-existing order (e.g. from accepted quote)
          const existing = orders[existingIdx];
          const payment = { amount: amountAud, method: 'Stripe', note: `Session ${session.id}`, date: new Date().toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' }) };
          orders[existingIdx] = { ...existing, stripeSessionId: session.id, payments: [...(existing.payments || []), payment] };
          writeOrders(orders);
          const existingProductId = meta.productId || '';
          if (existingProductId) {
            const prod = readProducts().find(p => p.id === existingProductId);
            if (prod && prod.createdBy && prod.sellerPrice != null) {
              const txns = readSellerLedger();
              txns.push({
                id: 'txn-' + Date.now() + '-' + crypto.randomBytes(4).toString('hex'),
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
          return { type: 'existing', orderId: existing.id, cust: existing.cust, email: existing.email || details.email, items: existing.items, amountAud };
        }

        if (orders.find(o => o.stripeSessionId === session.id)) return null; // already processed (idempotent)

        // Generate a collision-free order ID from the freshly-read list.
        const maxNum = orders.reduce((max, o) => { const m = String(o.id || '').match(/^OE-(\d+)$/); return m ? Math.max(max, parseInt(m[1])) : max; }, 1000);
        const order = {
          id: `OE-${maxNum + 1}`,
          warrantyToken: crypto.randomBytes(16).toString('hex'),
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
        orders.push(order);
        writeOrders(orders);

        // Credit seller if this product was listed by a seller
        if (productId) {
          const prod = readProducts().find(p => p.id === productId);
          if (prod && prod.createdBy && prod.sellerPrice != null) {
            const txns = readSellerLedger();
            txns.push({
              id: 'txn-' + Date.now() + '-' + crypto.randomBytes(4).toString('hex'),
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

        // Decrement stock for purchased products
        const cartItemsMeta = meta.cartItems || '';
        const stockItems = cartItemsMeta
          ? cartItemsMeta.split('|').map(entry => { const [pid, vsku, qty] = entry.split(':'); return { productId: pid, variantSku: vsku === '_' ? null : vsku, quantity: Number(qty) || 1 }; })
          : (productId && !productId.startsWith('gc-') ? [{ productId, variantSku: null, quantity: 1 }] : []);
        if (stockItems.length > 0) {
          const prods = readProducts();
          let stockChanged = false;
          for (const si of stockItems) {
            const idx = prods.findIndex(p => p.id === si.productId);
            if (idx < 0) continue;
            const prod = prods[idx];
            if (prod.infiniteStock) continue;
            if (si.variantSku && prod.variants && prod.variants.length > 0) {
              const vi = prod.variants.findIndex(v => v.sku === si.variantSku);
              if (vi >= 0 && prod.variants[vi].stock != null) {
                prod.variants[vi] = { ...prod.variants[vi], stock: Math.max(0, prod.variants[vi].stock - si.quantity) };
                prods[idx] = prod;
                stockChanged = true;
              }
            } else if (prod.stock != null) {
              prods[idx] = { ...prod, stock: Math.max(0, prod.stock - si.quantity) };
              stockChanged = true;
            }
          }
          if (stockChanged) writeProducts(prods);
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

        // Deduct gift card balance (re-read inside lock so balance is current)
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
        let membershipWelcomeEmail = null;
        if (membershipTierId && details.email) {
          const mb = readMemberships();
          const tier = mb.tiers.find(t => t.id === membershipTierId);
          if (tier) {
            const user = readUsers().find(u => u.email && u.email.toLowerCase() === details.email.toLowerCase());
            if (user) {
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
              membershipWelcomeEmail = { to: user.email, tmpl: emailMembershipWelcome({ customerName: user.displayName || user.username, tierName: tier.name }) };
            } else {
              // No portal account yet — tag the order so admin can activate manually
              const updatedOrders = readOrders();
              const idx = updatedOrders.findIndex(o => o.stripeSessionId === session.id);
              if (idx >= 0) {
                updatedOrders[idx] = { ...updatedOrders[idx], pendingMembershipActivation: { tierId: membershipTierId, email: details.email } };
                writeOrders(updatedOrders);
              }
            }
          }
        }

        return { type: 'new', order, membershipWelcomeEmail };
      });

      // Send emails outside the lock.
      if (webhookEmails) {
        if (webhookEmails.type === 'existing') {
          const { orderId, cust, email: custEmail, items, amountAud: amt } = webhookEmails;
          if (custEmail) sendEmail({ to: custEmail, ...emailOrderConfirmation({ orderId, customerName: cust || details.name, amountAud: amt, items }) });
          sendEmail({ to: getNotifyEmail(), ...emailStaffNewOrder({ orderId, customerName: cust || details.name || details.email, amountAud: amt, items }) });
        } else if (webhookEmails.type === 'new') {
          const { order, membershipWelcomeEmail } = webhookEmails;
          if (membershipWelcomeEmail) sendEmail({ to: membershipWelcomeEmail.to, ...membershipWelcomeEmail.tmpl });
          if (details.email) sendEmail({ to: details.email, ...emailOrderConfirmation({ orderId: order.id, customerName: details.name, amountAud: order.total, items: order.items }) });
          sendEmail({ to: getNotifyEmail(), ...emailStaffNewOrder({ orderId: order.id, customerName: details.name || details.email, amountAud: order.total, items: order.items }) });
        }
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
    const emailParam = (url.searchParams.get('email') || '').trim().toLowerCase();
    if (!code) return json(res, 400, { error: 'missing_code' });
    if (!emailParam) return json(res, 400, { error: 'missing_email' });
    const gc = readGiftCards().find(c => c.code === code);
    // Always do the email comparison to prevent timing-based code enumeration
    const gcEmail = gc ? (gc.recipientEmail || '').toLowerCase() : '';
    const emailMatch = gcEmail && gcEmail === emailParam;
    if (!gc || !emailMatch) return json(res, 404, { error: 'not_found' });
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
    if (body.items.length > 100) return json(res, 422, { error: 'too_many_items', message: 'A cart can contain at most 100 line items.' });
    const cartProducts = readProducts();
    const cartServices = readServices();
    const items = [];
    for (const i of body.items) {
      const pid = String(i.id || i.sku || '');
      const variantSku = i._variantSku ? String(i._variantSku) : null;
      const qty = Math.min(999, Math.max(1, Math.floor(Number(i.qty) || 1)));
      // Resolve price and name authoritatively from catalog
      const prod = cartProducts.find(p => p.id === pid && p.status === 'published');
      if (prod) {
        let price, name;
        if (prod.variants && prod.variants.length > 0) {
          const variant = variantSku
            ? (prod.variants.find(v => v.sku === variantSku) || prod.variants.find(v => v.name === variantSku))
            : prod.variants[0];
          if (!variant) continue; // skip unresolvable variant
          price = Number(variant.price);
          name = `${prod.name}${variant.name ? ` — ${variant.name}` : ''}`;
        } else {
          price = Number(prod.priceAud);
          name = prod.name;
        }
        if (!price || price <= 0) continue;
        items.push({ id: prod.id, sku: variantSku || prod.sku || '', name, price, qty, _variantSku: variantSku || undefined, cond: i.cond || '' });
        continue;
      }
      const svc = cartServices.find(s => s.id === pid && s.status === 'published');
      if (svc) {
        const price = Number(svc.priceAud);
        if (!price || price <= 0) continue;
        items.push({ id: svc.id, sku: svc.sku || '', name: svc.name, price, qty, cond: i.cond || '' });
      }
      // Items not found in catalog are silently dropped
    }
    if (items.length === 0) return json(res, 422, { error: 'empty_cart' });
    const id = crypto.randomBytes(4).toString('hex');
    const expiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000;
    const carts = readCarts().filter(c => c.expiresAt > Date.now());
    carts.push({ id, items, expiresAt });
    writeCarts(carts);
    return json(res, 200, { id });
  }

  if (req.method === 'GET' && url.pathname.startsWith('/api/cart/')) {
    if (publicRateLimited(getIp(req), 'cart/get')) return json(res, 429, { error: 'too_many_requests' });
    const id = url.pathname.split('/api/cart/')[1];
    if (!id || !/^[0-9a-f]{8}$/.test(id)) return json(res, 404, { error: 'not_found' });
    const cart = readCarts().find(c => c.id === id && c.expiresAt > Date.now());
    if (!cart) return json(res, 404, { error: 'not_found' });
    return json(res, 200, { items: cart.items });
  }

  // ── Back-in-stock notification requests ──────────────────────────────────────
  if (req.method === 'POST' && url.pathname === '/api/stock-notify') {
    if (publicRateLimited(getIp(req), 'stock-notify')) return json(res, 429, { error: 'too_many_requests' });
    let body; try { body = await readJson(req); } catch { return json(res, 400, { error: 'invalid_json' }); }
    const email = String(body.email || '').trim().toLowerCase();
    const productId = String(body.productId || '').trim();
    const variantSku = String(body.variantSku || '').trim();
    if (!email || !productId) return json(res, 422, { error: 'missing_fields' });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json(res, 422, { error: 'invalid_email', message: 'Email address is invalid.' });
    const product = readProducts().find(p => (p.id === productId || p.sku === productId) && p.status === 'published');
    if (!product) return json(res, 404, { error: 'not_found', message: 'Product not found.' });
    const requests = readStockNotify();
    const exists = requests.some(r => r.email === email && r.productId === product.id && (r.variantSku || '') === variantSku && !r.notifiedAt);
    if (!exists) {
      requests.push({
        id: 'sn-' + Date.now(),
        email,
        productId: product.id,
        productName: product.name,
        ...(variantSku ? { variantSku } : {}),
        createdAt: new Date().toISOString(),
      });
      writeStockNotify(requests);
    }
    return json(res, 201, { ok: true });
  }

  // ── Callout fee estimate (keeps pricing constants server-side) ───────────────
  if (req.method === 'GET' && url.pathname === '/api/callout-fee') {
    const SHOP_LAT = -24.4235, SHOP_LNG = 145.4693;
    const FREE_KM = 10, LOCAL_CAP_KM = 200, HIVAL_THRESHOLD = 10000;
    const FUEL_RATE = 220 / 400, KM_PER_DAY = 480, DAILY_RATE = 150, DAILY_THRESHOLD_KM = 400;
    const lat = parseFloat(url.searchParams.get('lat'));
    const lng = parseFloat(url.searchParams.get('lng'));
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return json(res, 422, { error: 'invalid_coords' });
    const R = 6371;
    const dLat = (lat - SHOP_LAT) * Math.PI / 180;
    const dLng = (lng - SHOP_LNG) * Math.PI / 180;
    const a = Math.sin(dLat/2)**2 + Math.cos(SHOP_LAT*Math.PI/180) * Math.cos(lat*Math.PI/180) * Math.sin(dLng/2)**2;
    const distKm = Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)));
    const fuel = distKm > FREE_KM ? distKm * FUEL_RATE : 0;
    const days = distKm > DAILY_THRESHOLD_KM ? Math.ceil(distKm / KM_PER_DAY) : 0;
    const fee = distKm <= FREE_KM ? 0 : Math.round(fuel + days * 2 * DAILY_RATE);
    return json(res, 200, { distKm, fee, days, freeKm: FREE_KM, localCapKm: LOCAL_CAP_KM, hiValThreshold: HIVAL_THRESHOLD, dailyRate: DAILY_RATE });
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
    if (publicRateLimited(getIp(req), 'warranty/order-lookup')) return json(res, 429, { error: 'too_many_requests' });
    const tokenParam = (url.searchParams.get('token') || '').trim();
    const emailParam = (url.searchParams.get('email') || '').trim().toLowerCase();
    if (!tokenParam) return json(res, 400, { error: 'missing_token' });
    if (!emailParam) return json(res, 400, { error: 'missing_email' });
    const orders = readOrders();
    // Only match by warrantyToken to prevent enumeration of sequential order IDs.
    const order = orders.find(o => o.warrantyToken === tokenParam);
    // Always compare email regardless of whether order was found (constant-time guard).
    const orderEmail = order ? (order.email || '').toLowerCase() : '';
    const emailMatch = orderEmail && orderEmail === emailParam;
    if (!order || !emailMatch) return json(res, 404, { found: false });
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


  // Inject per-route OG tags for social crawlers (Facebook, Slack, iMessage, etc.)
  if (req.method === 'GET') {
    const og = resolveOgTags(url.pathname);
    if (og) return serveIndexWithOg(req, res, og, url.pathname);
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
    const usersDb = readUsers();
    const user = usersDb.find(u => String(u.email || '').toLowerCase() === email);
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

  // GET /api/thumb?src=/assets/uploads/...&w=N — resized image cache
  if (req.method === 'GET' && url.pathname === '/api/thumb') {
    const src = url.searchParams.get('src') || '';
    const w = Math.min(Math.max(parseInt(url.searchParams.get('w') || '600', 10), 32), 1200);
    // Optional per-image quality (clamped). Larger LCP images (e.g. the hero)
    // request a higher quality so they don't look soft after downscaling.
    const qParam = parseInt(url.searchParams.get('q') || '', 10);
    if (!src.startsWith('/assets/uploads/') || src.includes('..') || src.includes('\0')) {
      return json(res, 400, { error: 'invalid_src' });
    }
    const srcPath = path.join(__dirname, src.replace(/^\//, ''));
    const uploadsDir = path.resolve(path.join(__dirname, 'assets/uploads'));
    if (!path.resolve(srcPath).startsWith(uploadsDir + path.sep)) return json(res, 403, { error: 'forbidden' });
    const thumbsDir = path.join(__dirname, 'assets/uploads/.thumbs');
    try { fs.mkdirSync(thumbsDir, { recursive: true }); } catch {}
    const baseName = path.basename(src, path.extname(src));
    const THUMB_QUALITY = Number.isFinite(qParam) ? Math.min(Math.max(qParam, 40), 90) : 55;
    // Quality is part of the cache key so tuning it regenerates variants
    // instead of serving stale higher-weight files.
    const thumbPath = path.join(thumbsDir, `${baseName}-w${w}-q${THUMB_QUALITY}.webp`);
    const serveThumb = (buf) => {
      res.writeHead(200, { 'Content-Type': 'image/webp', 'Cache-Control': 'public, max-age=31536000, immutable', 'Expires': new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toUTCString(), 'X-Content-Type-Options': 'nosniff', 'Vary': 'Accept-Encoding' });
      res.end(buf);
    };
    try {
      if (fs.existsSync(thumbPath)) return serveThumb(fs.readFileSync(thumbPath));
      const buf = fs.readFileSync(srcPath);
      const thumb = await sharp(buf).resize({ width: w, withoutEnlargement: true }).webp({ quality: THUMB_QUALITY }).toBuffer();
      try { fs.writeFileSync(thumbPath, thumb); } catch {}
      serveThumb(thumb);
    } catch (thumbErr) {
      console.error('[thumb] failed:', src, thumbErr.message || thumbErr);
      try {
        const fallback = fs.readFileSync(srcPath);
        res.writeHead(200, { 'Content-Type': 'image/webp', 'Cache-Control': 'public, max-age=60' });
        res.end(fallback);
      } catch { return json(res, 500, { error: 'thumb_failed' }); }
    }
  }

  if (req.method === 'POST' && url.pathname === '/api/ai-chat') {
    // Proxy to AI gateway (adds RAG, queue, rate limiting)
    const rawBody = await new Promise((resolve, reject) => {
      let b = ''; req.on('data', c => b += c); req.on('end', () => resolve(b)); req.on('error', reject);
    });
    await new Promise((resolve) => {
      const proxyReq = http.request({ hostname: '127.0.0.1', port: AI_GATEWAY_PORT, path: '/api/chat', method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(rawBody), 'Cookie': req.headers.cookie || '' }, timeout: 120000 }, (proxyRes) => {
        res.writeHead(proxyRes.statusCode, proxyRes.headers);
        proxyRes.pipe(res);
        proxyRes.on('end', resolve);
        proxyRes.on('error', resolve);
      });
      proxyReq.on('error', () => { if (!res.headersSent) json(res, 503, { error: 'ai_unavailable', message: 'AI service is currently offline.' }); resolve(); });
      proxyReq.on('timeout', () => { proxyReq.destroy(); if (!res.headersSent) json(res, 504, { error: 'ai_timeout', message: 'AI took too long to respond. Please try again.' }); resolve(); });
      proxyReq.write(rawBody); proxyReq.end();
    });
    return;
  }

  return serveStatic(req, res, url.pathname, '/dist/index.html', MAIN_SPA_ROUTES);
  } catch (err) {
    console.error('[mainServer] unhandled error:', err);
    if (!res.headersSent) json(res, 500, { error: 'server_error', message: 'An unexpected error occurred.' });
  }
});

// ── Discourse redirect server (8081) ─────────────────────────────────────────
// Redirects discourse.outbackelectronics.com.au → forum.outbackelectronics.com.au

const discourseRedirectServer = http.createServer((req, res) => {
  const target = FORUM_PUBLIC_URL + (req.url || '/');
  res.writeHead(301, { Location: target });
  res.end();
});

// ── Admin server (8082) ───────────────────────────────────────────────────────

const adminServer = http.createServer(async (req, res) => {
  try {
  const url = new URL(req.url, `http://${req.headers.host}`);

  // Keep the admin dashboard out of search engines entirely.
  res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');

  if (url.pathname === '/robots.txt') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    return res.end('User-agent: *\nDisallow: /\n');
  }

  if (req.method === 'GET' && url.pathname === '/api/csrf-token') {
    const token = ensureCsrfCookie(req, res);
    return json(res, 200, { token });
  }

  if (req.method === 'GET' && url.pathname === '/api/shop-info') {
    const { shop, flags } = readSettings();
    return json(res, 200, { shop, flags: flags || {}, siteUrl: getSiteUrl(), portalUrl: getPortalUrl() });
  }

  if (['POST', 'PATCH', 'DELETE'].includes(req.method)) {
    // Login is pre-auth; CSRF provides no meaningful protection (attacker must
    // know the password anyway) and requiring it is fragile on first visit
    // before a CSRF cookie has been issued.
    if (url.pathname !== '/api/admin/login' && !verifyCsrf(req, res)) return;
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
    const member = staffData.members.find(m => m.status === 'active' && m.pinHash &&
      m.name.toLowerCase() === (body.username || '').toLowerCase()
    );
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
    auditAdminAction({ req, session, action: 'gift-card.void', result: { status: 'ok', changed: { code } } });
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
    auditAdminAction({ req, session, action: 'gift-card.issue', result: { status: 'ok', changed: { code: card.code, balance, recipientEmail } } });
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
  if (req.method === 'GET' && url.pathname === '/api/admin/analytics') {
    const session = requireRole(req, res, 'manager'); if (!session) return;
    // Range: default last 30 days; supports ?days=N
    const days = Math.min(Math.max(parseInt(url.searchParams.get('days') || '30', 10) || 30, 1), 365);
    const since = Date.now() - days * 24 * 60 * 60 * 1000;
    const events = _analyticsEvents.filter(e => e.ts >= since && e.type === 'pageview');

    // Daily page views
    const dailyMap = {};
    for (const e of events) {
      const d = new Date(e.ts);
      const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      dailyMap[key] = (dailyMap[key] || 0) + 1;
    }
    const daily = Object.entries(dailyMap).sort(([a],[b]) => a < b ? -1 : 1).map(([date, views]) => ({ date, views }));

    // Top pages
    const pageMap = {};
    for (const e of events) {
      const p = e.page || '/';
      pageMap[p] = (pageMap[p] || 0) + 1;
    }
    const topPages = Object.entries(pageMap).sort(([,a],[,b]) => b - a).slice(0, 20).map(([page, views]) => ({ page, views }));

    // Top referrers
    const refMap = {};
    for (const e of events) {
      if (!e.referrer) continue;
      let host = e.referrer;
      try { host = new URL(e.referrer).hostname.replace(/^www\./, ''); } catch {}
      refMap[host] = (refMap[host] || 0) + 1;
    }
    const topReferrers = Object.entries(refMap).sort(([,a],[,b]) => b - a).slice(0, 10).map(([referrer, views]) => ({ referrer, views }));

    // Device breakdown via UA
    let mobile = 0, tablet = 0, desktop = 0;
    for (const e of events) {
      const ua = e.ua || '';
      if (/tablet|ipad/i.test(ua)) tablet++;
      else if (/mobile|android|iphone/i.test(ua)) mobile++;
      else desktop++;
    }

    const totalViews = events.length;
    // Unique IPs as a proxy for unique visitors
    const uniqueIps = new Set(events.map(e => e.ip)).size;

    return json(res, 200, { days, totalViews, uniqueVisitors: uniqueIps, daily, topPages, topReferrers, devices: { mobile, tablet, desktop } });
  }

  if (req.method === 'GET' && url.pathname === '/api/admin/audit-log') {
    const session = requireRole(req, res, 'manager'); if (!session) return;
    const limit = Math.min(500, Math.max(1, parseInt(url.searchParams.get('limit') || '200')));
    const offset = Math.max(0, parseInt(url.searchParams.get('offset') || '0'));
    let lines = [];
    try {
      const raw = fs.readFileSync(ADMIN_AUDIT_LOG_PATH, 'utf8');
      lines = raw.split('\n').filter(Boolean);
    } catch { /* file may not exist yet */ }
    lines.reverse();
    const total = lines.length;
    const page = lines.slice(offset, offset + limit).map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
    return json(res, 200, { total, offset, limit, entries: page });
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
    '.tar.gz', '.tar.bz2', '.tar.xz', '.tar.zst',
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

  // GET /api/admin/software  — list all software items (admin)
  // GET /api/admin/software/list — same, used by membership access picker
  if (req.method === 'GET' && (url.pathname === '/api/admin/software' || url.pathname === '/api/admin/software/list')) {
    const session = requireRole(req, res, 'manager'); if (!session) return;
    return json(res, 200, { items: readSoftware() });
  }

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
    } catch (e) { return json(res, 500, { error: 'chunk_failed', detail: e?.message }); }
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
      // Sellers cannot publish their own listings — every seller save goes back
      // to draft and a manager must publish it.
      body.status = 'draft';
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
    if (!body.name) return json(res, 422, { error: 'name_required' });
    const services = readServices();
    const idx = body.id ? services.findIndex(s => s.id === body.id) : -1;
    if (idx >= 0) { services[idx] = body; } else { body.id = 'svc-' + Date.now(); services.push(body); }
    try { writeServices(services); } catch (err) {
      console.error('[services/save] write failed:', err);
      return json(res, 500, { error: 'write_failed' });
    }
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
    // Financial fields are audited with before/after values so any change to an
    // order's total or recorded payments is traceable to a staff member.
    const sumPayments = o => (o && Array.isArray(o.payments) ? o.payments : []).reduce((s, p) => s + (Number(p.amount) || 0), 0);
    auditAdminAction({ req, session, action: existing ? 'order.update' : 'order.create', result: { status: 'ok', changed: {
      id: bodyToStore.id,
      totalBefore: existing ? Number(existing.total) || 0 : null,
      totalAfter: Number(bodyToStore.total) || 0,
      paymentsBefore: existing ? sumPayments(existing) : null,
      paymentsAfter: sumPayments(bodyToStore),
    } } });
    const justFulfilled = body.fulfilment === 'fulfilled' && existing && existing.fulfilment !== 'fulfilled';
    if (justFulfilled && body.email) {
      const pts = Math.floor(Number(body.total) || 0);
      if (pts > 0) grantRewardPoints(body.email, pts, 'order', `Order ${body.id}`, `order-${body.id}`);
    }
    const justShipped = body.fulfilment === 'shipped' && existing && existing.fulfilment !== 'shipped';
    if (justShipped && body.trackingNumber && body.email) {
      const tmpl = emailOrderShipped({ orderId: body.id, warrantyToken: body.warrantyToken, customerName: body.cust, trackingNumber: body.trackingNumber });
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
    auditAdminAction({ req, session, action: 'order.refund', result: { status: 'ok', changed: { id, method, amount: requested } } });
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
    auditAdminAction({ req, session, action: 'order.delete', result: { status: 'ok', changed: { id: body.id } } });
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

  // Public: validate an order tracking token (used by portal registration flow).
  // PII is kept server-side: the email is masked for display and the register
  // endpoint resolves the real address from the token itself.
  if (req.method === 'GET' && url.pathname === '/api/order-token') {
    if (publicRateLimited(getIp(req), 'order-token')) return json(res, 429, { error: 'too_many_requests' });
    const token = url.searchParams.get('token');
    if (!token) return json(res, 400, { error: 'missing_token' });
    const orders = readOrders();
    const order = orders.find(o => o.trackingToken === token && o.trackingTokenExpiry > Date.now());
    if (!order) return json(res, 404, { error: 'invalid_or_expired', message: 'This link is invalid or has expired.' });
    const hasAccount = !!readUsers().find(u => u.email && u.email.toLowerCase() === order.email.toLowerCase());
    return json(res, 200, { ok: true, orderId: order.id, customerName: String(order.cust || '').split(' ')[0] || '', email: maskEmail(order.email), hasAccount });
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
    auditAdminAction({ req, session, action: 'customer.delete', result: { status: 'ok', changed: { id: body.id } } });
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
    auditAdminAction({ req, session, action: 'customer.merge', result: { status: 'ok', changed: { keepId, deleteId } } });
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
    // Sanitize HTML content and validate video URL
    if (body.content) body.content = sanitizeTutorialHTML(body.content);
    if (body.videoUrl) body.videoUrl = validateVideoUrl(body.videoUrl);
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

  if (req.method === 'GET' && url.pathname === '/api/admin/settings') {
    const session = requireAdmin(req, res); if (!session) return;
    const settings = readSettings();
    const maskedPayload = {
      ...settings,
      integrations: settings.integrations.map(r => [r[0], r[1], r[2], maskIntegrationConfig(r[0], r[3])]),
      security: { adminUsername: settings.security?.adminUsername || '' },
    };
    return json(res, 200, maskedPayload);
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
      for (const [k, v] of Object.entries(incomingConfig)) {
        // Masked secrets round-tripped from the dashboard mean "unchanged"
        if (SENSITIVE_INTEGRATION_KEYS.has(k) && typeof v === 'string' && v.includes('••••')) continue;
        config[k] = v;
      }
      return [r[0], r[1], !!r[2], config];
    });
    const security = { ...(existing.security || {}) };
    if ((body.security?.adminUsername || '').trim()) security.adminUsername = body.security.adminUsername.trim();
    const newPass = (body.security?.adminPassword || '').trim();
    if (newPass && newPass !== '***') security.adminPasswordHash = hashPassword(newPass);
    const payload = { shop: body.shop || {}, announcement: body.announcement || { text: '', enabled: false, expiresAt: '' }, maintenance: body.maintenance || { enabled: false }, staff: body.staff || [], integrations: mergedIntegrations, siteContent: body.siteContent || {}, security };
    writeSettings(payload);
    pushMaintenanceEvent(!!(payload.maintenance && payload.maintenance.enabled));
    auditAdminAction({ req, session, action: 'settings.save', result: { status: 'ok', changed: { passwordChanged: !!(newPass && newPass !== '***'), usernameChanged: !!(body.security?.adminUsername || '').trim() } } });
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
    auditAdminAction({ req, session, action: 'maintenance.toggle', result: { status: 'ok', changed: { enabled } } });
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
    const user = readUsers().find(u => u.email === email);
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
    auditAdminAction({ req, session, action: idx >= 0 ? 'staff.update' : 'staff.create', result: { status: 'ok', changed: { id: body.id, name: body.name, role: body.role } } });
    return json(res, 200, { ok: true, item: data.members[idx >= 0 ? idx : data.members.length - 1] });
  }
  if (req.method === 'POST' && url.pathname === '/api/admin/staff/members/delete') {
    const session = requireAdmin(req, res); if (!session) return;
    let body; try { body = await readJson(req); } catch { return json(res, 400, { error: 'invalid_json' }); }
    const data = readStaff();
    data.members = data.members.filter(m => m.id !== body.id);
    writeStaff(data);
    auditAdminAction({ req, session, action: 'staff.delete', result: { status: 'ok', changed: { id: body.id } } });
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
    // The board is replaced wholesale, so validate its shape before writing:
    // an object with a bounded array of column objects, each with a string id
    // and a bounded array of card objects with string ids.
    if (!body || typeof body !== 'object' || Array.isArray(body) || !Array.isArray(body.columns)) {
      return json(res, 422, { error: 'invalid_payload', message: 'Body must be an object with a columns array.' });
    }
    if (body.columns.length > 50) return json(res, 422, { error: 'invalid_payload', message: 'Too many columns.' });
    for (const col of body.columns) {
      if (!col || typeof col !== 'object' || Array.isArray(col) || typeof col.id !== 'string' || !col.id) {
        return json(res, 422, { error: 'invalid_payload', message: 'Each column must be an object with a string id.' });
      }
      if (col.cards !== undefined && !Array.isArray(col.cards)) {
        return json(res, 422, { error: 'invalid_payload', message: 'Column cards must be an array.' });
      }
      if ((col.cards || []).length > 1000) return json(res, 422, { error: 'invalid_payload', message: 'Too many cards in a column.' });
      for (const card of col.cards || []) {
        if (!card || typeof card !== 'object' || Array.isArray(card) || typeof card.id !== 'string' || !card.id) {
          return json(res, 422, { error: 'invalid_payload', message: 'Each card must be an object with a string id.' });
        }
      }
    }
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
    const usersArr = readUsers();
    const entries = db.entries.map(e => {
      const user = usersArr.find(u => u.id === e.userId);
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
    auditAdminAction({ req, session, action: 'rewards.grant', result: { status: 'ok', changed: { userId, points: pts, description } } });
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
    auditAdminAction({ req, session, action: 'rewards.adjust', result: { status: 'ok', changed: { userId, points: pts, description } } });
    return json(res, 200, { ok: true, entry });
  }

  if (req.method === 'GET' && url.pathname === '/api/admin/store-credit') {
    const session = requireRole(req, res, 'manager'); if (!session) return;
    const db = readStoreCredits();
    const users = readUsers();
    const entries = db.entries.map(e => {
      const user = users.find(u => u.id === e.userId);
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
      const user = readUsers().find(u => u.id === userId);
      entry = { userId, email: user ? String(user.email || '').toLowerCase() : '', balance: 0, history: [] };
      db.entries.push(entry);
    }
    entry.balance = roundCents(Math.max(0, entry.balance + amt));
    entry.history.push({ id: 'sc-' + Date.now() + '-' + crypto.randomBytes(4).toString('hex'), type: amt > 0 ? 'grant' : 'adjust', amount: amt, description: description || '', refId: null, date: new Date().toISOString() });
    writeStoreCredits(db);
    auditAdminAction({ req, session, action: 'store-credit.adjust', result: { status: 'ok', changed: { userId, amount: amt, description } } });
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

  return serveStatic(req, res, url.pathname, '/dist/admin-login.html', null, strictCsp('/dist/admin-login.html'));
  } catch (err) {
    console.error('[adminServer] unhandled error:', err);
    if (!res.headersSent) json(res, 500, { error: 'server_error', message: 'An unexpected error occurred.' });
  }
});

// ── Portal server (8083) ──────────────────────────────────────────────────────

const PORTAL_CORS_ORIGINS = new Set([
  process.env.SITE_URL || `http://localhost:${MAIN_PORT}`,
  GAMES_URL,
  TOOLS_URL,
  WEATHER_URL,
].filter(Boolean));

const portalServer = http.createServer(async (req, res) => {
  try {
  const url = new URL(req.url, `http://${req.headers.host}`);

  // Keep the customer portal out of search engines entirely.
  res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');

  if (url.pathname === '/robots.txt') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    return res.end('User-agent: *\nDisallow: /\n');
  }

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

  if (['POST', 'PATCH', 'DELETE'].includes(req.method)) {
    if (!verifyCsrf(req, res)) return;
  }

  if (req.method === 'GET' && url.pathname === '/api/shop-info') {
    const { shop, flags } = readSettings();
    return json(res, 200, { shop, flags: flags || {}, portalUrl: getPortalUrl(), gamesUrl: getGamesUrl(), toolsUrl: getToolsUrl() });
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

  // ── DiscourseConnect SSO provider ────────────────────────────────────────────
  // Discourse admin → Settings → Login → "Enable DiscourseConnect" + set
  // "DiscourseConnect URL" to https://portal.outbackelectronics.com.au/discourse/sso
  // and "DiscourseConnect Secret" to the value of DISCOURSE_CONNECT_SECRET.
  if (req.method === 'GET' && url.pathname === '/discourse/sso') {
    if (!DISCOURSE_CONNECT_SECRET) {
      res.writeHead(503, { 'Content-Type': 'text/plain' });
      return res.end('DiscourseConnect is not configured on this server.');
    }

    function discourseHmac(payload) {
      return crypto.createHmac('sha256', DISCOURSE_CONNECT_SECRET).update(payload).digest('hex');
    }

    const rawSso = url.searchParams.get('sso');
    const rawSig = url.searchParams.get('sig');

    let ssoPayload, sigValue;

    if (rawSso && rawSig) {
      // Validate the signature from Discourse before doing anything else
      if (discourseHmac(rawSso) !== rawSig) {
        res.writeHead(403, { 'Content-Type': 'text/plain' });
        return res.end('Invalid SSO signature.');
      }
      ssoPayload = rawSso;
      sigValue = rawSig;
    } else {
      // No params — try to resume from a pending-SSO cookie set during a prior visit
      const pending = parseCookies(req).oe_discourse_sso;
      if (!pending) { res.writeHead(302, { Location: '/' }); return res.end(); }
      try {
        const p = JSON.parse(Buffer.from(pending, 'base64url').toString('utf8'));
        ssoPayload = p.sso; sigValue = p.sig;
        if (!ssoPayload || !sigValue) throw new Error('incomplete');
      } catch {
        res.writeHead(302, { Location: '/' }); return res.end();
      }
    }

    const session = getPortalSession(req);

    if (!session) {
      // Not logged in — park the SSO params in a short-lived cookie and send to login
      const pendingData = Buffer.from(JSON.stringify({ sso: ssoPayload, sig: sigValue })).toString('base64url');
      const cookieParts = [`oe_discourse_sso=${pendingData}`, 'HttpOnly', 'Path=/', 'Max-Age=600', 'SameSite=Lax'];
      if (isSecureRequest(req)) cookieParts.push('Secure');
      res.setHeader('Set-Cookie', cookieParts.join('; '));
      res.writeHead(302, { Location: '/' });
      return res.end();
    }

    // Logged in — look up the full user record (session doesn't store email)
    const user = readUsers().find(u => u.id === session.id);
    if (!user || !user.email) {
      res.writeHead(302, { Location: '/?sso_error=1' }); return res.end();
    }

    // Decode the nonce Discourse sent; it must be echoed back unchanged
    let nonce;
    try {
      nonce = new URLSearchParams(Buffer.from(ssoPayload, 'base64').toString('utf8')).get('nonce');
    } catch { nonce = null; }
    if (!nonce) { res.writeHead(400, { 'Content-Type': 'text/plain' }); return res.end('Missing nonce.'); }

    // Build the DiscourseConnect response payload and sign it
    const responseParams = new URLSearchParams({
      nonce,
      email:              user.email,
      external_id:        user.id,
      username:           user.username,
      name:               user.displayName || user.username,
      require_activation: 'false',
    });
    const responsePayload = Buffer.from(responseParams.toString()).toString('base64');
    const responseSig     = discourseHmac(responsePayload);

    // Clear the pending-SSO cookie now that we're done with it
    const clearParts = ['oe_discourse_sso=', 'HttpOnly', 'Path=/', 'Max-Age=0', 'SameSite=Lax'];
    if (isSecureRequest(req)) clearParts.push('Secure');
    res.setHeader('Set-Cookie', clearParts.join('; '));

    const location = `${FORUM_PUBLIC_URL}/session/sso_login?sso=${encodeURIComponent(responsePayload)}&sig=${responseSig}`;
    res.writeHead(302, { Location: location });
    return res.end();
  }

  if (req.method === 'PATCH' && url.pathname === '/api/portal/profile') {
    const session = getPortalSession(req);
    if (!session) return json(res, 401, { error: 'login_required' });
    let body; try { body = await readJson(req); } catch { return json(res, 400, { error: 'invalid_json' }); }
    const users = readUsers();
    const userIdx = users.findIndex(u => u.id === session.id);
    if (userIdx < 0) return json(res, 404, { error: 'user_not_found' });
    const user = { ...users[userIdx] };
    if (typeof body.displayName === 'string') {
      const dn = body.displayName.trim();
      if (dn.length > 50) return json(res, 422, { error: 'invalid_payload', message: 'Display name must be 50 characters or fewer.' });
      user.displayName = dn;
    }
    let previousEmail = null;
    if (typeof body.email === 'string') {
      const newEmail = body.email.trim().toLowerCase();
      if (newEmail !== String(user.email || '').toLowerCase()) {
        // Changing the email re-keys password reset and order history, so it
        // requires the current password and notifies the old address.
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) return json(res, 422, { error: 'invalid_payload', message: 'Email address is invalid.' });
        if (typeof body.currentPassword !== 'string' || !verifyPassword(body.currentPassword, user.passwordHash)) {
          return json(res, 401, { error: 'invalid_password', message: 'Your current password is required to change your email address.' });
        }
        if (users.some((u, i) => i !== userIdx && u.email && u.email.toLowerCase() === newEmail)) {
          return json(res, 409, { error: 'email_taken', message: 'An account with that email address already exists.' });
        }
        previousEmail = user.email || '';
        user.email = newEmail;
      }
    }
    if (typeof body.newPassword === 'string') {
      if (typeof body.currentPassword !== 'string' || !verifyPassword(body.currentPassword, user.passwordHash)) {
        return json(res, 401, { error: 'invalid_password', message: 'Current password is incorrect.' });
      }
      if (body.newPassword.length < 8) return json(res, 422, { error: 'invalid_payload', message: 'New password must be at least 8 characters.' });
      user.passwordHash = hashPassword(body.newPassword);
    }
    users[userIdx] = user;
    writeUsers(users);
    if (previousEmail) {
      sendEmail({
        to: previousEmail,
        subject: 'Your account email address was changed',
        html: emailHtml('Email address changed', `
          <p>G'day ${escHtml(user.displayName || user.username)},</p>
          <p>The email address on your Outback Electronics account was just changed to <strong>${escHtml(maskEmail(user.email))}</strong>.</p>
          <p>If this wasn't you, contact us immediately so we can secure your account.</p>
        `),
      });
    }
    portalSessions.set(session.sid, { ...portalSessions.get(session.sid), displayName: user.displayName });
    saveSessionsToDisk(PORTAL_SESSIONS_DB_PATH, portalSessions);
    return json(res, 200, { ok: true, user: { id: user.id, username: user.username, displayName: user.displayName, createdAt: user.createdAt } });
  }

  if (req.method === 'GET' && url.pathname === '/api/portal/addresses') {
    const session = getPortalSession(req);
    if (!session) return json(res, 401, { error: 'login_required' });
    const user = readUsers().find(u => u.id === session.id);
    return json(res, 200, { addresses: user?.addresses || [] });
  }

  if (req.method === 'POST' && url.pathname === '/api/portal/addresses/save') {
    const session = getPortalSession(req);
    if (!session) return json(res, 401, { error: 'login_required' });
    let body; try { body = await readJson(req); } catch { return json(res, 400, { error: 'invalid_json' }); }
    const { name, line1, line2, city, state, postcode, country } = body || {};
    if (!name || !line1 || !city || !state || !postcode) return json(res, 422, { error: 'missing_fields', message: 'Name, street, city, state and postcode are required.' });
    const users = readUsers();
    const idx = users.findIndex(u => u.id === session.id);
    if (idx < 0) return json(res, 404, { error: 'user_not_found' });
    const addr = { id: 'addr-' + Date.now(), name: String(name).trim(), line1: String(line1).trim(), line2: String(line2||'').trim(), city: String(city).trim(), state: String(state).trim(), postcode: String(postcode).trim(), country: String(country||'AU').trim() };
    users[idx].addresses = [...(users[idx].addresses || []), addr];
    writeUsers(users);
    return json(res, 201, { ok: true, address: addr });
  }

  if (req.method === 'POST' && url.pathname === '/api/portal/addresses/delete') {
    const session = getPortalSession(req);
    if (!session) return json(res, 401, { error: 'login_required' });
    let body; try { body = await readJson(req); } catch { return json(res, 400, { error: 'invalid_json' }); }
    const users = readUsers();
    const idx = users.findIndex(u => u.id === session.id);
    if (idx < 0) return json(res, 404, { error: 'user_not_found' });
    users[idx].addresses = (users[idx].addresses || []).filter(a => a.id !== body.id);
    writeUsers(users);
    return json(res, 200, { ok: true });
  }

  if (req.method === 'GET' && url.pathname === '/api/portal/orders') {
    const session = getPortalSession(req);
    if (!session) return json(res, 401, { error: 'login_required' });
    const portalUser = readUsers().find(u => u.id === session.id);
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
    const portalUser = readUsers().find(u => u.id === session.id);
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
    const portalUser = readUsers().find(u => u.id === session.id);
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
    const portalUser = readUsers().find(u => u.id === session.id);
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
    const users = readUsers();
    const quoteEmail = String(quote.email || '').toLowerCase();
    const existingUser = users.find(u => String(u.email || '').toLowerCase() === quoteEmail);
    if (existingUser) {
      return json(res, 409, { error: 'email_exists', message: 'An account already exists for this email. Please log in to accept the quote.' });
    }
    if (!username || !/^[a-zA-Z0-9_]{3,30}$/.test(username)) return json(res, 422, { error: 'invalid_payload', message: 'Username must be 3–30 characters, letters, numbers and underscores only.' });
    if (!password || password.length < 8) return json(res, 422, { error: 'invalid_payload', message: 'Password must be at least 8 characters.' });
    if (users.find(u => u.username && u.username.toLowerCase() === username.toLowerCase())) {
      return json(res, 409, { error: 'username_taken', message: 'That username is already taken.' });
    }
    const resolvedDisplayName = (typeof displayName === 'string' ? displayName.trim() : '') || quote.name || username;
    const newUser = { id: 'U-' + Date.now(), username, displayName: resolvedDisplayName, email: quoteEmail, passwordHash: hashPassword(password), createdAt: new Date().toISOString() };
    users.push(newUser);
    writeUsers(users);
    const dq = quote.draftQuote || {};
    const nowStr = new Date().toLocaleDateString('en-AU', { day:'2-digit', month:'short', year:'numeric' });
    const order = {
      id: 'OE-' + (readOrders().reduce((mx,o) => { const m=String(o.id||'').match(/^OE-(\d+)$/); return m?Math.max(mx,parseInt(m[1])):mx; }, 1000) + 1),
      warrantyToken: crypto.randomBytes(16).toString('hex'),
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
    res.setHeader('Set-Cookie', customerSessionCookie('oe_portal_session', sid, Math.floor(PORTAL_SESSION_TTL_MS / 1000), req));
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
    const portalUser = readUsers().find(u => u.id === session.id);
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
      warrantyToken: crypto.randomBytes(16).toString('hex'),
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

  // Create a Stripe checkout session for a paid membership tier. Activation
  // happens in the Stripe webhook (metadata.membershipTierId) after payment.
  // Free tiers return no URL and the client falls back to /membership/subscribe.
  if (req.method === 'POST' && url.pathname === '/api/portal/membership/checkout') {
    if (publicRateLimited(getIp(req), 'membership')) return json(res, 429, { error: 'too_many_requests' });
    const session = getPortalSession(req);
    if (!session) return json(res, 401, { error: 'login_required' });
    let body; try { body = await readJson(req); } catch { return json(res, 400, { error: 'invalid_json' }); }
    const mb = readMemberships();
    const tier = mb.tiers.find(t => t.id === (body || {}).tierId && t.status === 'published');
    if (!tier) return json(res, 404, { error: 'tier_not_found' });
    if (!(Number(tier.priceAud) > 0)) return json(res, 200, { ok: true }); // free tier — no payment needed
    if (!getStripeKey()) return json(res, 503, { error: 'stripe_not_configured', message: 'Online payment is not configured. Please contact us.' });
    const portalUser = readUsers().find(u => u.id === session.id);
    const params = {
      'mode': 'payment',
      'success_url': `${getPortalUrl()}/membership?subscribed=1`,
      'cancel_url': `${getPortalUrl()}/membership`,
      'customer_email': (portalUser && portalUser.email) || '',
      'metadata[membershipTierId]': tier.id,
      'payment_intent_data[metadata][membershipTierId]': tier.id,
      'line_items[0][price_data][currency]': 'aud',
      'line_items[0][price_data][unit_amount]': String(Math.round(Number(tier.priceAud) * 100)),
      'line_items[0][price_data][product_data][name]': `${tier.name} membership`,
      'line_items[0][quantity]': '1',
    };
    const resp = await stripeRequest('POST', '/v1/checkout/sessions', params).catch(() => null);
    if (!resp || resp.status !== 200) return json(res, 502, { error: 'stripe_error', message: 'Could not create payment session. Please try again.' });
    return json(res, 200, { ok: true, url: resp.body.url });
  }

  if (req.method === 'POST' && url.pathname === '/api/portal/membership/subscribe') {
    if (publicRateLimited(getIp(req), 'membership')) return json(res, 429, { error: 'too_many_requests' });
    const session = getPortalSession(req);
    if (!session) return json(res, 401, { error: 'login_required' });
    let body; try { body = await readJson(req); } catch { return json(res, 400, { error: 'invalid_json' }); }
    const { tierId } = body || {};
    const mb = readMemberships();
    const tier = mb.tiers.find(t => t.id === tierId && t.status === 'published');
    if (!tier) return json(res, 404, { error: 'tier_not_found' });
    // Paid tiers can only be activated by the Stripe webhook after a successful
    // payment — direct activation here is reserved for free tiers.
    if (Number(tier.priceAud) > 0) {
      return json(res, 402, { error: 'payment_required', message: 'This membership tier requires payment. Please purchase it through checkout.' });
    }
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
    const user = readUsers().find(u => u.username === session.username);
    if (user && user.email) {
      const tmpl = emailMembershipWelcome({ customerName: user.displayName || user.username, tierName: tier.name });
      sendEmail({ to: user.email, ...tmpl });
    }
    return json(res, 201, { ok: true, subscription: sub, tier });
  }

  if (req.method === 'POST' && url.pathname === '/api/portal/membership/cancel') {
    if (publicRateLimited(getIp(req), 'membership')) return json(res, 429, { error: 'too_many_requests' });
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
      const user = readUsers().find(u => u.username === session.username);
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
    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
    if (!email) return json(res, 200, { ok: true }); // always 200 to avoid enumeration
    const users = readUsers();
    const user = users.find(u => u.email && u.email.toLowerCase() === email);
    if (user) {
      const token = crypto.randomBytes(32).toString('hex');
      resetTokens.set(hashResetToken(token), { userId: user.id, expiresAt: now() + RESET_TOKEN_TTL_MS });
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
    const tokenHash = hashResetToken(token);
    const entry = resetTokens.get(tokenHash);
    if (!entry || entry.expiresAt < now()) return json(res, 400, { error: 'invalid_token', message: 'This reset link has expired or is invalid.' });
    const users = readUsers();
    const idx = users.findIndex(u => u.id === entry.userId);
    if (idx < 0) return json(res, 400, { error: 'invalid_token', message: 'This reset link has expired or is invalid.' });
    users[idx] = { ...users[idx], passwordHash: hashPassword(password) };
    writeUsers(users);
    resetTokens.delete(tokenHash);
    saveResetTokens();
    return json(res, 200, { ok: true });
  }

  if (req.method === 'GET' && url.pathname === '/api/portal/game-scores') {
    const session = getPortalSession(req);
    if (!session) return json(res, 401, { error: 'login_required' });
    const user = readUsers().find(u => u.id === session.id);
    return json(res, 200, { scores: (user && user.gameScores) || {} });
  }

  if (req.method === 'POST' && url.pathname === '/api/portal/game-scores') {
    const session = getPortalSession(req);
    if (!session) return json(res, 401, { error: 'login_required' });
    let body; try { body = await readJson(req); } catch { return json(res, 400, { error: 'invalid_json' }); }
    const { gameId, score } = body || {};
    if (!gameId || typeof score !== 'number' || score < 0) return json(res, 422, { error: 'invalid_payload' });
    const users = readUsers();
    const idx = users.findIndex(u => u.id === session.id);
    if (idx < 0) return json(res, 404, { error: 'user_not_found' });
    const existing = users[idx].gameScores || {};
    if (score > (existing[gameId] || 0)) {
      users[idx] = { ...users[idx], gameScores: { ...existing, [gameId]: score } };
      writeUsers(users);
    }
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
    const portalUser = readUsers().find(u => u.id === session.id);
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

  if (req.method === 'POST' && url.pathname === '/api/analytics/event') {
    if (publicRateLimited(getIp(req), 'analytics')) return json(res, 429, { error: 'rate_limited' });
    let body; try { body = await readJson(req); } catch { return json(res, 400, { error: 'bad_request' }); }
    const type = typeof body.type === 'string' ? body.type.slice(0, 64) : null;
    if (!type) return json(res, 400, { error: 'missing_type' });
    const ua = (req.headers['user-agent'] || '').slice(0, 256);
    if (/bot|crawl|spider|slurp|headless/i.test(ua)) return json(res, 204, {});
    appendAnalyticsEvent({ ts: Date.now(), type, page: (body.page || '').slice(0, 256), referrer: (body.referrer || '').slice(0, 256), ua, ip: getIp(req) });
    return json(res, 204, {});
  }

  return serveStatic(req, res, url.pathname, '/dist/portal.html', null, strictCsp('/dist/portal.html'));
  } catch (err) {
    console.error('[portalServer] unhandled error:', err);
    if (!res.headersSent) json(res, 500, { error: 'server_error', message: 'An unexpected error occurred.' });
  }
});

// ── Tools server (8085) ───────────────────────────────────────────────────────

const toolsServer = http.createServer(async (req, res) => {
  try {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (checkMaintenance(req, res, url)) return;

  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }

  if (req.method === 'GET' && url.pathname === '/api/csrf-token') {
    const token = ensureCsrfCookie(req, res);
    return json(res, 200, { token });
  }

  if (['POST', 'PATCH', 'DELETE'].includes(req.method) && url.pathname.startsWith('/api/') && url.pathname !== '/api/analytics/event') {
    if (!verifyCsrf(req, res)) return;
  }

  if (req.method === 'POST' && url.pathname === '/api/analytics/event') {
    if (publicRateLimited(getIp(req), 'analytics')) return json(res, 429, { error: 'rate_limited' });
    let body; try { body = await readJson(req); } catch { return json(res, 400, { error: 'bad_request' }); }
    const type = typeof body.type === 'string' ? body.type.slice(0, 64) : null;
    if (!type) return json(res, 400, { error: 'missing_type' });
    const ua = (req.headers['user-agent'] || '').slice(0, 256);
    if (/bot|crawl|spider|slurp|headless/i.test(ua)) return json(res, 204, {});
    appendAnalyticsEvent({ ts: Date.now(), type, page: (body.page || '').slice(0, 256), referrer: (body.referrer || '').slice(0, 256), ua, ip: getIp(req) });
    return json(res, 204, {});
  }

  if (req.method === 'GET' && url.pathname === '/api/shop-info') {
    const { shop, flags } = readSettings();
    return json(res, 200, { shop, flags: flags || {}, portalUrl: getPortalUrl(), gamesUrl: getGamesUrl(), toolsUrl: getToolsUrl() });
  }

  if (req.method === 'GET' && url.pathname === '/api/catalog/products') {
    return json(res, 200, { items: readProducts().filter(p => p.status === 'published') });
  }

  if (req.method === 'GET' && url.pathname === '/api/catalog/services') {
    return json(res, 200, { items: readServices().filter(s => s.status === 'published') });
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

  return serveStatic(req, res, url.pathname, '/dist/tools.html', null);
  } catch (err) {
    console.error('[toolsServer] unhandled error:', err);
    if (!res.headersSent) json(res, 500, { error: 'server_error' });
  }
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

  if (['POST', 'PATCH', 'DELETE'].includes(req.method) && url.pathname.startsWith('/api/') && url.pathname !== '/api/analytics/event') {
    if (!verifyCsrf(req, res)) return;
  }

  if (req.method === 'GET'  && url.pathname === '/api/config')        return json(res, 200, { portalUrl: PORTAL_URL });
  if (req.method === 'GET'  && url.pathname === '/api/auth/me')       return handleCustomerMe(req, res);
  if (req.method === 'POST' && url.pathname === '/api/auth/register') return handleCustomerRegister(req, res);
  if (req.method === 'POST' && url.pathname === '/api/auth/login')    return handleCustomerLogin(req, res);
  if (req.method === 'POST' && url.pathname === '/api/auth/logout')   return handleCustomerLogout(req, res);

  if (req.method === 'POST' && url.pathname === '/api/analytics/event') {
    if (publicRateLimited(getIp(req), 'analytics')) return json(res, 429, { error: 'rate_limited' });
    let body; try { body = await readJson(req); } catch { return json(res, 400, { error: 'bad_request' }); }
    const type = typeof body.type === 'string' ? body.type.slice(0, 64) : null;
    if (!type) return json(res, 400, { error: 'missing_type' });
    const ua = (req.headers['user-agent'] || '').slice(0, 256);
    if (/bot|crawl|spider|slurp|headless/i.test(ua)) return json(res, 204, {});
    appendAnalyticsEvent({ ts: Date.now(), type, page: (body.page || '').slice(0, 256), referrer: (body.referrer || '').slice(0, 256), ua, ip: getIp(req) });
    return json(res, 204, {});
  }

  return serveStatic(req, res, url.pathname, '/dist/games.html', null);
  } catch (err) {
    console.error('[gamesServer] unhandled error:', err);
    if (!res.headersSent) json(res, 500, { error: 'server_error' });
  }
});

// ── Weather data helpers ──────────────────────────────────────────────────────

const WEATHER_DB = path.join(__dirname, 'weather.db');
const WEATHER_API_KEY = process.env.WEATHER_API_KEY || '';

function readWeatherDb() {
  try { return JSON.parse(fs.readFileSync(WEATHER_DB, 'utf8')); }
  catch { return { readings: [], stations: [] }; }
}

function weatherApiKeyValid(apiKey) {
  if (!apiKey) return null;
  // Built-in server key (env var) — station_id is set by the device
  if (WEATHER_API_KEY && apiKey === WEATHER_API_KEY) return { builtin: true };
  // Registered community station keys
  const db = readWeatherDb();
  const station = (db.stations || []).find(s => s.apiKey === apiKey);
  return station || null;
}

function writeWeatherDb(data) {
  const tmp = WEATHER_DB + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data));
  fs.renameSync(tmp, WEATHER_DB);
}

function appendWeatherReading(reading) {
  const db = readWeatherDb();
  db.readings.push(reading);
  writeWeatherDb(db);
  broadcastWeatherReading(reading);
}

// SSE broadcast — push new readings to all connected browser clients instantly
const weatherSseClients = new Set();

function broadcastWeatherReading(reading) {
  const payload = `data: ${JSON.stringify(reading)}\n\n`;
  for (const res of weatherSseClients) {
    try { res.write(payload); } catch { weatherSseClients.delete(res); }
  }
}

// ── Weather server (8089) ────────────────────────────────────────────────────

const weatherServer = http.createServer(async (req, res) => {
  try {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (checkMaintenance(req, res, url)) return;

  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }

  if (req.method === 'GET' && url.pathname === '/api/csrf-token') {
    const token = ensureCsrfCookie(req, res);
    return json(res, 200, { token });
  }

  if (req.method === 'GET' && url.pathname === '/api/shop-info') {
    const { shop, flags } = readSettings();
    return json(res, 200, { shop, flags: flags || {}, portalUrl: getPortalUrl(), gamesUrl: getGamesUrl(), toolsUrl: getToolsUrl() });
  }

  if (req.method === 'GET' && url.pathname === '/api/catalog/products') {
    return json(res, 200, { items: readProducts().filter(p => p.status === 'published') });
  }

  if (req.method === 'GET' && url.pathname === '/api/catalog/services') {
    return json(res, 200, { items: readServices().filter(s => s.status === 'published') });
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

  // Public station registration — anyone can create a station and get an API key
  if (req.method === 'POST' && url.pathname === '/api/weather/register') {
    if (publicRateLimited(getIp(req), 'weather_register')) return json(res, 429, { error: 'rate_limited' });
    let body;
    try { body = await readJson(req); } catch { return json(res, 400, { error: 'bad_request' }); }
    const name = typeof body.name === 'string' ? body.name.trim().slice(0, 64) : '';
    const location = typeof body.location === 'string' ? body.location.trim().slice(0, 128) : '';
    const contact = typeof body.contact === 'string' ? body.contact.trim().slice(0, 128) : '';
    if (!name) return json(res, 400, { error: 'name_required' });
    const db = readWeatherDb();
    if (!db.stations) db.stations = [];
    const existing = db.stations.find(s => s.name.toLowerCase() === name.toLowerCase());
    if (existing) return json(res, 409, { error: 'name_taken' });
    const apiKey = require('crypto').randomBytes(32).toString('hex');
    const station = { id: require('crypto').randomBytes(8).toString('hex'), name, location, contact, apiKey, registeredAt: Date.now() };
    db.stations.push(station);
    writeWeatherDb(db);
    return json(res, 200, { ok: true, apiKey, name, weatherUrl: WEATHER_URL || `http://localhost:${WEATHER_PORT}` });
  }

  // RPi pushes readings — authenticated via API key, not CSRF
  if (req.method === 'POST' && url.pathname === '/api/weather/readings') {
    const apiKey = req.headers['x-api-key'] || url.searchParams.get('key') || '';
    const keyRecord = weatherApiKeyValid(apiKey);
    if (!keyRecord) return json(res, 401, { error: 'invalid_api_key' });
    let body;
    try { body = await readJson(req); } catch { return json(res, 400, { error: 'bad_request' }); }
    if (!body || typeof body !== 'object') return json(res, 400, { error: 'bad_request' });
    // Registered stations use their registered name; built-in key uses device-supplied station_id
    const stationId = keyRecord.builtin
      ? (typeof body.station_id === 'string' ? body.station_id.slice(0, 64) : 'default')
      : keyRecord.name;
    const reading = {
      ts: Date.now(),
      station_id: stationId,
      rtc_time: typeof body.rtc_time === 'string' ? body.rtc_time.slice(0, 32) : null,
      sensors: Array.isArray(body.sensors) ? body.sensors.slice(0, 32).map(s => String(s).slice(0, 64)) : [],
      data: {},
    };
    // Accept any key that is safe (alphanumeric + _ + ., max 64 chars), up to 64 keys
    if (body.data && typeof body.data === 'object') {
      const safeKey = /^[a-zA-Z0-9_.]{1,64}$/;
      for (const [k, v] of Object.entries(body.data)) {
        if (Object.keys(reading.data).length >= 64) break;
        if (safeKey.test(k) && typeof v === 'number' && isFinite(v)) {
          reading.data[k] = v;
        }
      }
    }
    appendWeatherReading(reading);
    return json(res, 200, { ok: true });
  }

  // List stations
  if (req.method === 'GET' && url.pathname === '/api/weather/stations') {
    const db = readWeatherDb();
    const stationMap = {};
    for (const r of db.readings) {
      const sid = r.station_id || 'default';
      if (!stationMap[sid] || r.ts > stationMap[sid].ts) stationMap[sid] = r;
    }
    const stations = Object.entries(stationMap).map(([id, r]) => ({ id, last_seen: r.ts }));
    return json(res, 200, { stations });
  }

  // Latest reading (optionally filtered by ?station=)
  if (req.method === 'GET' && url.pathname === '/api/weather/latest') {
    const station = url.searchParams.get('station') || null;
    const db = readWeatherDb();
    const candidates = station ? db.readings.filter(r => (r.station_id || 'default') === station) : db.readings;
    const last = candidates.length ? candidates[candidates.length - 1] : null;
    return json(res, 200, { reading: last });
  }

  // Historical readings (optionally filtered by ?station=)
  if (req.method === 'GET' && url.pathname === '/api/weather/history') {
    const hours = parseInt(url.searchParams.get('hours') || '24', 10) || 24;
    const from  = url.searchParams.get('from') ? parseInt(url.searchParams.get('from'), 10) : null;
    const to    = url.searchParams.get('to')   ? parseInt(url.searchParams.get('to'),   10) : null;
    const station = url.searchParams.get('station') || null;
    const since = from || (Date.now() - hours * 3600000);
    const until = to || null;
    const db = readWeatherDb();
    let filtered = db.readings.filter(r => r.ts > since);
    if (until) filtered = filtered.filter(r => r.ts <= until);
    if (station) filtered = filtered.filter(r => (r.station_id || 'default') === station);
    let result = filtered;
    if (filtered.length > 1000) {
      const step = Math.ceil(filtered.length / 1000);
      result = filtered.filter((_, i) => i % step === 0);
    }
    return json(res, 200, { readings: result, count: filtered.length });
  }

  // Stats — min/avg/max per key, optionally filtered by station/from/to
  if (req.method === 'GET' && url.pathname === '/api/weather/stats') {
    const station = url.searchParams.get('station') || null;
    const from = url.searchParams.get('from') ? parseInt(url.searchParams.get('from'), 10) : null;
    const to   = url.searchParams.get('to')   ? parseInt(url.searchParams.get('to'),   10) : null;
    const db = readWeatherDb();
    let readings = db.readings;
    if (station) readings = readings.filter(r => (r.station_id || 'default') === station);
    if (from) readings = readings.filter(r => r.ts >= from);
    if (to)   readings = readings.filter(r => r.ts <= to);
    const stats = {};
    for (const r of readings) {
      for (const [k, v] of Object.entries(r.data || {})) {
        if (typeof v !== 'number') continue;
        if (!stats[k]) stats[k] = { min: v, max: v, sum: 0, count: 0 };
        if (v < stats[k].min) stats[k].min = v;
        if (v > stats[k].max) stats[k].max = v;
        stats[k].sum += v;
        stats[k].count += 1;
      }
    }
    for (const s of Object.values(stats)) { s.avg = s.count ? s.sum / s.count : null; delete s.sum; }
    return json(res, 200, { stats, count: readings.length });
  }

  // Available years in the DB
  if (req.method === 'GET' && url.pathname === '/api/weather/years') {
    const db = readWeatherDb();
    const yearSet = new Set();
    for (const r of db.readings) { yearSet.add(new Date(r.ts).getFullYear()); }
    return json(res, 200, { years: [...yearSet].sort((a, b) => b - a) });
  }

  // Analytics event
  if (req.method === 'POST' && url.pathname === '/api/analytics/event') {
    if (publicRateLimited(getIp(req), 'analytics')) return json(res, 429, { error: 'rate_limited' });
    let body; try { body = await readJson(req); } catch { return json(res, 400, { error: 'bad_request' }); }
    const type = typeof body.type === 'string' ? body.type.slice(0, 64) : null;
    if (!type) return json(res, 400, { error: 'missing_type' });
    const ua = (req.headers['user-agent'] || '').slice(0, 256);
    if (/bot|crawl|spider|slurp|headless/i.test(ua)) return json(res, 204, {});
    appendAnalyticsEvent({ ts: Date.now(), type, page: (body.page || '').slice(0, 256), referrer: (body.referrer || '').slice(0, 256), ua, ip: getIp(req) });
    return json(res, 204, {});
  }

  // SSE stream — browser subscribes here and receives readings as they arrive
  if (req.method === 'GET' && url.pathname === '/api/weather/stream') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    });
    res.write(': connected\n\n');
    weatherSseClients.add(res);
    req.on('close', () => weatherSseClients.delete(res));
    return;
  }

  return serveStatic(req, res, url.pathname, '/dist/weather.html', null);
  } catch (err) {
    console.error('[weatherServer] unhandled error:', err);
    if (!res.headersSent) json(res, 500, { error: 'server_error' });
  }
});

// ── Global crash guards — keep the process alive on unexpected throws ─────────

process.on('uncaughtException', (err) => {
  console.error('[process] uncaughtException — continuing:', err);
});

process.on('unhandledRejection', (reason) => {
  console.error('[process] unhandledRejection — continuing:', reason);
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

  // Secrets are NOT copied from the environment into settings.db — the getters
  // (getStripeKey, getSmtpConfig, getAuspostKey) fall back to env vars when the
  // stored value is empty, so they only end up on disk if entered via the
  // dashboard (and are then encrypted when SETTINGS_ENCRYPTION_KEY is set).
  if (!s.integrations.find(r => r[0] === 'Stripe')) {
    s.integrations = [['Stripe', 'api.stripe.com', !!(STRIPE_SECRET_KEY), {
      secretKey: '', publishableKey: STRIPE_PUBLISHABLE_KEY || '', webhookSecret: '',
    }], ...s.integrations];
    changed = true;
  }

  if (!s.integrations.find(r => r[0] === 'Email')) {
    s.integrations.push(['Email', SMTP_HOST || 'smtp.gmail.com', !!(SMTP_HOST && SMTP_USER && SMTP_PASS), {
      host: SMTP_HOST || '', port: String(SMTP_PORT || ''), user: SMTP_USER || '', pass: '', notifyEmail: NOTIFY_EMAIL || '',
    }]);
    changed = true;
  }

  if (!s.integrations.find(r => r[0] === 'AusPost')) {
    s.integrations.push(['AusPost', 'digitalapi.auspost.com.au', !!(AUSPOST_API_KEY), {
      apiKey: '',
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
      id: 'txn-' + Date.now() + '-' + crypto.randomBytes(4).toString('hex'),
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

// ── AI Gateway ────────────────────────────────────────────────────────────────

const AI_CHAT_MODEL   = 'qwen2.5:1.5b';
const AI_VISION_MODEL = 'llava-phi3';
const AI_EMBED_MODEL  = 'nomic-embed-text';
const AI_RATE_WINDOW  = 5 * 60 * 1000; // 5 minutes
const AI_RATE_MAX     = 15;

// ── Request queue (serialise Ollama calls) ────────────────────────────────────
let _aiQueueRunning = false;
const _aiQueue = [];
function enqueueAI(fn) {
  return new Promise((resolve, reject) => {
    _aiQueue.push({ fn, resolve, reject });
    _drainAIQueue();
  });
}
async function _drainAIQueue() {
  if (_aiQueueRunning || _aiQueue.length === 0) return;
  _aiQueueRunning = true;
  const { fn, resolve, reject } = _aiQueue.shift();
  try { resolve(await fn()); } catch (e) { reject(e); } finally {
    _aiQueueRunning = false;
    _drainAIQueue();
  }
}

// ── Per-user rate limiter ─────────────────────────────────────────────────────
const _aiRateLimits = new Map();
function checkAIRateLimit(userId) {
  const now = Date.now();
  const entry = _aiRateLimits.get(userId) || { count: 0, start: now };
  if (now - entry.start > AI_RATE_WINDOW) { entry.count = 0; entry.start = now; }
  if (entry.count >= AI_RATE_MAX) return false;
  entry.count++;
  _aiRateLimits.set(userId, entry);
  return true;
}

// ── Ollama helpers ────────────────────────────────────────────────────────────
function ollamaGet(path) {
  return new Promise((resolve, reject) => {
    const req = http.request({ hostname: '127.0.0.1', port: 11434, path, method: 'GET', timeout: 8000 }, res => {
      let d = ''; res.on('data', c => d += c); res.on('end', () => { try { resolve(JSON.parse(d)); } catch { resolve({}); } });
    });
    req.on('error', reject); req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); }); req.end();
  });
}

function ollamaPost(path, payload, timeoutMs = 30000) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(payload);
    const req = http.request({ hostname: '127.0.0.1', port: 11434, path, method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }, timeout: timeoutMs }, res => {
      let d = ''; res.on('data', c => d += c); res.on('end', () => { try { resolve({ ok: res.statusCode === 200, body: JSON.parse(d) }); } catch { resolve({ ok: false, body: {} }); } });
    });
    req.on('error', reject); req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    req.write(body); req.end();
  });
}

function ollamaStream(apiPath, payload, res) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ ...payload, stream: true });
    const req = http.request({ hostname: '127.0.0.1', port: 11434, path: apiPath, method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }, timeout: 120000 }, (ores) => {
      if (ores.statusCode !== 200) { ores.resume(); return reject(new Error(`ollama:${ores.statusCode}`)); }
      let buf = '';
      ores.on('data', chunk => {
        buf += chunk.toString();
        const lines = buf.split('\n'); buf = lines.pop();
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const obj = JSON.parse(line);
            const token = obj?.message?.content ?? obj?.response ?? '';
            if (token && !res.writableEnded) res.write(`data: ${JSON.stringify({ token })}\n\n`);
            if (obj.done && !res.writableEnded) res.write('data: [DONE]\n\n');
          } catch { }
        }
      });
      ores.on('end', resolve); ores.on('error', reject);
    });
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    req.on('error', reject);
    req.write(body); req.end();
  });
}

// ── RAG engine ────────────────────────────────────────────────────────────────
let _ragDocs = [];
let _ragReady = false;
let _ragBuilding = false;

function cosineSim(a, b) {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) || 1);
}

async function getEmbedding(text) {
  const r = await ollamaPost('/api/embeddings', { model: AI_EMBED_MODEL, prompt: text.slice(0, 2000) }, 30000);
  if (!r.ok || !r.body.embedding) throw new Error('embed failed');
  return r.body.embedding;
}

async function buildRagIndex() {
  if (_ragBuilding) return;
  _ragBuilding = true;
  console.log('[ai] building RAG index…');
  let cache = {};
  try { cache = JSON.parse(fs.readFileSync(RAG_CACHE_DB_PATH, 'utf8')); } catch { }
  const docs = [];

  const products = readProducts().filter(p => p.status === 'published');
  for (const p of products) {
    const text = `Product: ${p.name}. Category: ${p.category || ''}. Brand: ${p.brand || ''}. Condition: ${p.cond || ''}. Price: $${p.priceAud || '?'} AUD. ${p.description || ''}`.slice(0, 1500);
    const key = `prod-${p.id}`;
    let emb = cache[key];
    if (!emb) { try { emb = await getEmbedding(text); cache[key] = emb; } catch { continue; } }
    docs.push({ id: p.id, type: 'product', title: p.name, text, emb });
  }

  const tutorials = readTutorials().filter(t => t.status === 'Published');
  for (const t of tutorials) {
    const body = (t.body || t.content || '').replace(/<[^>]+>/g, '').slice(0, 600);
    const text = `Tutorial: ${t.title}. Category: ${t.cat || ''}. Difficulty: ${t.difficulty || ''}. ${body}`.slice(0, 1500);
    const key = `tut-${t.id}`;
    let emb = cache[key];
    if (!emb) { try { emb = await getEmbedding(text); cache[key] = emb; } catch { continue; } }
    docs.push({ id: t.id, type: 'tutorial', title: t.title, text, emb });
  }

  try { atomicWriteFile(RAG_CACHE_DB_PATH, JSON.stringify(cache)); } catch { }
  _ragDocs = docs;
  _ragReady = true;
  _ragBuilding = false;
  console.log(`[ai] RAG index ready — ${docs.length} documents`);
}

async function ragSearch(query, topK = 4) {
  if (!_ragReady || !_ragDocs.length) return [];
  try {
    const qEmb = await getEmbedding(query);
    return _ragDocs
      .map(d => ({ ...d, score: cosineSim(qEmb, d.emb) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  } catch { return []; }
}

const AI_SYSTEM_PROMPT = `You are the Outback Electronics AI assistant — a helpful, knowledgeable electronics technician and advisor. You help customers with repair questions, troubleshooting, parts selection, soldering tips, circuit theory, and general DIY electronics. Outback Electronics is a small Australian electronics repair and parts shop. Be concise and practical. When relevant products or tutorials from the catalogue are provided below, reference them by name. If a repair is beyond DIY, recommend booking a professional service through Outback Electronics.`;

// ── AI Gateway server ─────────────────────────────────────────────────────────
const aiGatewayServer = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  res.setHeader('Access-Control-Allow-Origin', (req.headers.origin || '').includes('outbackelectronics') ? req.headers.origin : '');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }

  try {
    // Session info (for AI frontend to check login state)
    if (req.method === 'GET' && url.pathname === '/api/session') {
      const session = getPortalSession(req);
      if (!session) return json(res, 401, { error: 'not_logged_in' });
      return json(res, 200, { id: session.id, username: session.username, displayName: session.displayName });
    }

    // Health / status
    if (req.method === 'GET' && url.pathname === '/health') {
      return json(res, 200, { ok: true, ragReady: _ragReady, ragDocs: _ragDocs.length, queue: _aiQueue.length });
    }

    // Available models
    if (req.method === 'GET' && url.pathname === '/api/models') {
      try {
        const data = await ollamaGet('/api/tags');
        return json(res, 200, { models: (data.models || []).map(m => ({ name: m.name, size: m.size })), ragReady: _ragReady, queue: _aiQueue.length });
      } catch { return json(res, 503, { error: 'ollama_unavailable' }); }
    }

    // RAG index status + manual rebuild trigger
    if (req.method === 'GET' && url.pathname === '/api/rag/status') {
      return json(res, 200, { ready: _ragReady, building: _ragBuilding, docs: _ragDocs.length });
    }
    if (req.method === 'POST' && url.pathname === '/api/rag/rebuild') {
      const session = getPortalSession(req);
      if (!session) return json(res, 401, { error: 'login_required' });
      buildRagIndex().catch(e => console.error('[ai] RAG rebuild error:', e));
      return json(res, 202, { ok: true, message: 'RAG rebuild started' });
    }

    // Chat (text)
    if (req.method === 'POST' && url.pathname === '/api/chat') {
      const session = getPortalSession(req);
      if (!session) return json(res, 401, { error: 'login_required' });
      if (!checkAIRateLimit(session.id)) return json(res, 429, { error: 'rate_limited', message: 'Too many requests. Please wait a few minutes.' });
      let body; try { body = await readJson(req); } catch { return json(res, 400, { error: 'invalid_json' }); }
      const messages = Array.isArray(body?.messages) ? body.messages : [];
      if (!messages.length) return json(res, 422, { error: 'messages_required' });

      const lastUser = [...messages].reverse().find(m => m.role === 'user');
      let contextBlock = '';
      if (lastUser) {
        const hits = await ragSearch(lastUser.content, 4);
        if (hits.length) contextBlock = '\n\nRelevant catalogue context:\n' + hits.map(h => `[${h.type.toUpperCase()}] ${h.title}: ${h.text.slice(0, 300)}`).join('\n\n');
      }

      res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' });
      try {
        await enqueueAI(() => ollamaStream('/api/chat', {
          model: AI_CHAT_MODEL,
          messages: [
            { role: 'system', content: AI_SYSTEM_PROMPT + contextBlock },
            ...messages.slice(-20).map(m => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: String(m.content).slice(0, 4000) })),
          ],
        }, res));
      } catch (e) { if (!res.writableEnded) res.write(`data: ${JSON.stringify({ error: e.message })}\n\n`); }
      if (!res.writableEnded) res.end();
      return;
    }

    // Vision (board photo → diagnosis)
    if (req.method === 'POST' && url.pathname === '/api/vision') {
      const session = getPortalSession(req);
      if (!session) return json(res, 401, { error: 'login_required' });
      if (!checkAIRateLimit(session.id)) return json(res, 429, { error: 'rate_limited', message: 'Too many requests. Please wait a few minutes.' });
      let body; try { body = await readJson(req); } catch { return json(res, 400, { error: 'invalid_json' }); }
      const { image, prompt } = body || {};
      if (!image) return json(res, 422, { error: 'image_required' });
      const b64 = image.replace(/^data:image\/[a-z]+;base64,/, '');
      if (!b64 || b64.length > 10 * 1024 * 1024) return json(res, 413, { error: 'image_too_large' });

      res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' });
      try {
        await enqueueAI(() => ollamaStream('/api/generate', {
          model: AI_VISION_MODEL,
          system: 'You are an electronics repair technician. Respond only with plain text — no ASCII art, no diagrams, no decorative lines or symbols. Be concise and practical.',
          prompt: prompt || 'Analyse this electronics image. Identify the component or PCB. Describe any visible damage such as burnt components, failed capacitors, cracked traces, corrosion, or physical damage. Provide a diagnosis and recommended repair steps.',
          images: [b64],
        }, res));
      } catch (e) { if (!res.writableEnded) res.write(`data: ${JSON.stringify({ error: e.message })}\n\n`); }
      if (!res.writableEnded) res.end();
      return;
    }

    return serveStatic(req, res, url.pathname, '/dist/ai.html', new Set(['chat', 'vision']));
  } catch (err) {
    console.error('[aiGateway] error:', err);
    if (!res.headersSent) json(res, 500, { error: 'server_error' });
  }
});

// Build RAG index 5s after startup (non-blocking)
setTimeout(() => buildRagIndex().catch(e => console.error('[ai] RAG build error:', e)), 5000);

// ════════════════════════════════════════════════════════════════════════════
// Customer-facing service suite (hub + apps)
// Shared factory so each new subdomain service doesn't repeat the common
// preamble: maintenance gate, CSRF, shop-info, announcement, unified-account
// auth (one login across all subdomains via the shared-domain cookie),
// analytics, and the static SPA fallback. Each service supplies only its own
// routes via the `routes(req, res, url)` callback — return true if handled.
// ════════════════════════════════════════════════════════════════════════════
function createServiceServer({ htmlEntry, spaRoutes = null, routes = null }) {
  return http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, `http://${req.headers.host}`);

      if (checkMaintenance(req, res, url)) return;
      if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }

      if (req.method === 'GET' && url.pathname === '/api/csrf-token') {
        const token = ensureCsrfCookie(req, res);
        return json(res, 200, { token });
      }
      if (['POST', 'PATCH', 'DELETE'].includes(req.method) && url.pathname.startsWith('/api/') && url.pathname !== '/api/analytics/event') {
        if (!verifyCsrf(req, res)) return;
      }

      if (req.method === 'POST' && url.pathname === '/api/analytics/event') {
        if (publicRateLimited(getIp(req), 'analytics')) return json(res, 429, { error: 'rate_limited' });
        let body; try { body = await readJson(req); } catch { return json(res, 400, { error: 'bad_request' }); }
        const type = typeof body.type === 'string' ? body.type.slice(0, 64) : null;
        if (!type) return json(res, 400, { error: 'missing_type' });
        const ua = (req.headers['user-agent'] || '').slice(0, 256);
        if (/bot|crawl|spider|slurp|headless/i.test(ua)) return json(res, 204, {});
        appendAnalyticsEvent({ ts: Date.now(), type, page: (body.page || '').slice(0, 256), referrer: (body.referrer || '').slice(0, 256), ua, ip: getIp(req) });
        return json(res, 204, {});
      }

      if (req.method === 'GET' && url.pathname === '/api/shop-info') {
        const { shop, flags } = readSettings();
        return json(res, 200, { shop, flags: flags || {}, ...serviceUrls() });
      }
      if (req.method === 'GET' && url.pathname === '/api/announcement') {
        const { announcement } = readSettings();
        if (!announcement || !announcement.enabled) return json(res, 200, { active: false });
        if (announcement.expiresAt) {
          const expires = new Date(announcement.expiresAt);
          if (!isNaN(expires) && expires < new Date()) return json(res, 200, { active: false });
        }
        return json(res, 200, { active: true, text: announcement.text });
      }

      // Unified account — one login across every subdomain (shared-domain cookie)
      if (req.method === 'GET'  && url.pathname === '/api/auth/me')       return handleCustomerMe(req, res);
      if (req.method === 'POST' && url.pathname === '/api/auth/login')    return handleCustomerLogin(req, res);
      if (req.method === 'POST' && url.pathname === '/api/auth/register') return handleCustomerRegister(req, res);
      if (req.method === 'POST' && url.pathname === '/api/auth/logout')   return handleCustomerLogout(req, res);

      if (routes) {
        const handled = await routes(req, res, url);
        if (handled) return;
      }

      return serveStatic(req, res, url.pathname, htmlEntry, spaRoutes);
    } catch (err) {
      console.error(`[service ${htmlEntry}] error:`, err);
      if (!res.headersSent) json(res, 500, { error: 'server_error' });
    }
  });
}

// ── Hub (8101) — account-aware launcher + live snapshot ─────────────────────
function hubLatestWeather() {
  try { const db = readWeatherDb(); const r = db.readings || []; return r.length ? r[r.length - 1] : null; }
  catch { return null; }
}
function hubActiveAnnouncement() {
  try {
    const { announcement } = readSettings();
    if (!announcement || !announcement.enabled) return null;
    if (announcement.expiresAt) { const e = new Date(announcement.expiresAt); if (!isNaN(e) && e < new Date()) return null; }
    return { text: announcement.text };
  } catch { return null; }
}
function handleHubOverview(req, res) {
  const weather = hubLatestWeather();
  const announcement = hubActiveAnnouncement();
  const session = getPortalSession(req);
  if (!session) return json(res, 200, { user: null, weather, announcement });
  const portalUser = readUsers().find(u => u.id === session.id);
  const email = portalUser ? String(portalUser.email || '').toLowerCase() : '';
  const orders = email ? readOrders().filter(o => String(o.email || '').toLowerCase() === email) : [];
  const quotes = email ? readQuotes().filter(q => String(q.email || '').toLowerCase() === email) : [];
  const repairCards = email ? flatRepairs().filter(c => String(c.email || '').toLowerCase() === email) : [];
  const openOrders = orders.filter(o => {
    const paid = (o.payments || []).reduce((s, p) => s + (Number(p.amount) || 0), 0);
    return paid < Number(o.total || 0);
  }).length;
  const activeRepairs = repairCards.filter(c => c._colId !== 'done').length;
  const openQuotes = quotes.filter(q => q.status !== 'accepted' && q.status !== 'declined').length;
  return json(res, 200, {
    user: { displayName: session.displayName, username: session.username },
    weather,
    announcement,
    stats: {
      orders: orders.length, openOrders,
      repairs: repairCards.length, activeRepairs,
      quotes: quotes.length, openQuotes,
    },
  });
}
const hubServer = createServiceServer({
  htmlEntry: '/dist/hub.html',
  spaRoutes: new Set([]),
  routes: async (req, res, url) => {
    if (req.method === 'GET' && url.pathname === '/api/hub/overview') { handleHubOverview(req, res); return true; }
    return false;
  },
});

// ── Solar (8107) — off-grid power planner (pure client-side calculator) ──────
const solarServer = createServiceServer({ htmlEntry: '/dist/solar.html' });

// ── Sky (8104) — dark-sky window + moon (client) + live aurora Kp (NOAA) ────
let _auroraCache = { ts: 0, data: null };
function fetchAuroraKp() {
  return new Promise((resolve) => {
    const req = https.get('https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json', { timeout: 6000 }, (r) => {
      if (r.statusCode !== 200) { r.resume(); return resolve(null); }
      let buf = '';
      r.on('data', c => { buf += c; if (buf.length > 1e6) req.destroy(); });
      r.on('end', () => {
        try {
          const rows = JSON.parse(buf); // rows[0] is a header; later rows are [time, Kp, ...]
          for (let i = rows.length - 1; i >= 1; i--) {
            const kp = parseFloat(rows[i][1]);
            if (isFinite(kp)) return resolve({ kp, time: rows[i][0] });
          }
          resolve(null);
        } catch { resolve(null); }
      });
    });
    req.on('error', () => resolve(null));
    req.on('timeout', () => { req.destroy(); resolve(null); });
  });
}
async function handleSkyAurora(req, res) {
  const t = Date.now();
  if (!_auroraCache.data || t - _auroraCache.ts > 10 * 60 * 1000) {
    const d = await fetchAuroraKp();
    if (d) _auroraCache = { ts: t, data: d };
  }
  if (!_auroraCache.data) return json(res, 200, { available: false });
  const kp = _auroraCache.data.kp;
  const level = kp >= 7 ? 'severe' : kp >= 5 ? 'storm' : kp >= 4 ? 'active' : 'quiet';
  return json(res, 200, { available: true, kp, level, time: _auroraCache.data.time });
}
const skyServer = createServiceServer({
  htmlEntry: '/dist/sky.html',
  routes: async (req, res, url) => {
    if (req.method === 'GET' && url.pathname === '/api/sky/aurora') { await handleSkyAurora(req, res); return true; }
    return false;
  },
});

// ── Fire (8109) — shared browser-like UA to pass BOM / state service blocks ──
const FEED_UA = 'Mozilla/5.0 (compatible; OutbackElectronics/1.0; +https://outbackelectronics.com.au)';

// ── Fire (8109) — live bushfire incidents by state, cached per state ──────────
const FIRE_STATE_FEEDS = {
  // NSW RFS — confirmed GeoJSON FeatureCollection
  NSW: 'https://www.rfs.nsw.gov.au/feeds/majorIncidents.json',
  // QLD Fire Department (formerly QFES, renamed 01/07/2024) — GeoJSON via PSBA GIS portal (S3-backed)
  QLD: 'https://publiccontent.gis.psba.qld.gov.au/content/Feeds/BushfireCurrentIncidents/bushfireAlert.json',
  // VIC Emergency Management — public GeoJSON feed
  VIC: 'https://emergency.vic.gov.au/public/events-geojson.json',
  // SA CFS — JSON current incidents from ESO
  SA:  'https://data.eso.sa.gov.au/prod/cfs/criimson/cfs_current_incidents.json',
  // WA DFES — emergency.wa.gov.au/data/incident_FCAD.json requires SPA session token; no public feed confirmed
  WA:  null,
  // TAS TFS — KML current incidents feed
  TAS: 'http://www.fire.tas.gov.au/Show?pageId=bfKml',
  // NT Fire & Rescue — public incident JSON feed
  NT:  'https://www.pfes.nt.gov.au/incidentmap/json/incidents.json',
  // ACT ESA — Atom/GeoRSS incident feed
  ACT: 'https://esa.act.gov.au/act-gov-esa/incidents/feed',
};
const _fireCache = {};
// Fetch fire feed as raw text (handles http/https + redirects)
function fetchFireFeedRaw(url, extraHeaders, _depth) {
  _depth = _depth || 0;
  if (_depth > 3) return Promise.resolve(null);
  return new Promise((resolve) => {
    const mod = url.startsWith('https') ? https : http;
    const headers = { 'User-Agent': FEED_UA, 'Accept': 'application/json, application/geo+json, application/xml, application/atom+xml, text/xml, */*', ...(extraHeaders || {}) };
    const req = mod.get(url, { timeout: 9000, headers }, (r) => {
      if (r.statusCode >= 300 && r.statusCode < 400 && r.headers.location) {
        r.resume();
        return resolve(fetchFireFeedRaw(r.headers.location, extraHeaders, _depth + 1));
      }
      if (r.statusCode !== 200) { r.resume(); return resolve(null); }
      let buf = '';
      r.on('data', c => { buf += c; if (buf.length > 5e6) req.destroy(); });
      r.on('end', () => resolve(buf || null));
    });
    req.on('error', () => resolve(null));
    req.on('timeout', () => { req.destroy(); resolve(null); });
  });
}
// Parse ACT ESA Atom/GeoRSS feed into normalised fire data
function parseFireAtom(xml) {
  const entries = [];
  const entryRe = /<entry[^>]*>([\s\S]*?)<\/entry>/gi;
  let m;
  while ((m = entryRe.exec(xml)) !== null) {
    const block = m[1];
    const title = (/<title[^>]*>([\s\S]*?)<\/title>/i.exec(block) || [])[1] || 'Incident';
    const cat = (/<category[^>]*term=["']([^"']+)["']/i.exec(block) || [])[1] ||
                (/<[a-z]*:alertLevel[^>]*>([\s\S]*?)<\/[^>]+>/i.exec(block) || [])[1] ||
                (/<[a-z]*:severity[^>]*>([\s\S]*?)<\/[^>]+>/i.exec(block) || [])[1] || 'Information';
    const pointStr = (/<georss:point[^>]*>([\s\S]*?)<\/georss:point>/i.exec(block) || [])[1] || '';
    const [latStr, lonStr] = pointStr.trim().split(/\s+/);
    const lat = parseFloat(latStr);
    const lon = parseFloat(lonStr);
    entries.push({
      title: title.replace(/<[^>]+>/g, '').trim(),
      category: cat.replace(/<[^>]+>/g, '').trim(),
      lat: isFinite(lat) ? lat : null,
      lon: isFinite(lon) ? lon : null,
    });
  }
  return entries;
}
function geomCentroid(g) {
  if (!g) return null;
  if (g.type === 'Point') { const [lon, lat] = g.coordinates; return isFinite(lat) && isFinite(lon) ? { lat, lon } : null; }
  if (g.type === 'LineString') { const c = g.coordinates; if (!c?.length) return null; return { lat: c.reduce((s, p) => s + p[1], 0) / c.length, lon: c.reduce((s, p) => s + p[0], 0) / c.length }; }
  if (g.type === 'MultiLineString') { const all = g.coordinates.flat(); if (!all.length) return null; return { lat: all.reduce((s, p) => s + p[1], 0) / all.length, lon: all.reduce((s, p) => s + p[0], 0) / all.length }; }
  if (g.type === 'Polygon') { const r = g.coordinates[0]; if (!r?.length) return null; return { lat: r.reduce((s, c) => s + c[1], 0) / r.length, lon: r.reduce((s, c) => s + c[0], 0) / r.length }; }
  if (g.type === 'MultiPolygon') { const r = g.coordinates[0]?.[0]; if (!r?.length) return null; return { lat: r.reduce((s, c) => s + c[1], 0) / r.length, lon: r.reduce((s, c) => s + c[0], 0) / r.length }; }
  if (g.type === 'GeometryCollection') { for (const sub of g.geometries || []) { const c = geomCentroid(sub); if (c) return c; } }
  return null;
}
// SA CFS Level → alert category
const SA_LEVEL_CAT = { 1: 'Information', 2: 'Advice', 3: 'Watch and Act', 4: 'Emergency Warning', 5: 'Emergency Warning' };
// Normalise any category string to one of the 4 standard fire alert levels
const STANDARD_FIRE_LEVELS = ['Emergency Warning', 'Watch and Act', 'Advice', 'Information'];
const STANDARD_LEVEL_SET = new Set(STANDARD_FIRE_LEVELS.map(l => l.toLowerCase()));
function toAlertLevel(cat) {
  const c = String(cat).toLowerCase().trim();
  if (STANDARD_LEVEL_SET.has(c)) return STANDARD_FIRE_LEVELS.find(l => l.toLowerCase() === c);
  if (/out.of.control|going|uncontrolled|major.emergency|ember.attack/i.test(c)) return 'Emergency Warning';
  if (/watch.and.act/i.test(c)) return 'Watch and Act';
  if (/advice|hazard.reduc|planned.burn|burn.off|prescribed.burn|controlled.burn/i.test(c)) return 'Advice';
  return 'Information'; // catch-all: any unrecognised fire category
}
function normalizeFireItem(p, geometry) {
  const coords = geomCentroid(geometry);
  // Title: QLD=WarningTitle, VIC=sourceTitle/name, SA=Location_name, NSW=title, NT="Fire Type"/_eventtype, ACT=title
  const title = p.WarningTitle || p.sourceTitle || p.Location_name || p['Fire Type'] || p._eventtype
    || p.title || p.Title || p.name || p.Name || p.headline || p.description || 'Incident';
  // Alert level: QLD=WarningLevel, NSW=category, VIC=category1, SA=Level(int), NT="Alert Level", ACT=alert_level/_category
  const saLvl = p.Level != null ? SA_LEVEL_CAT[p.Level] : null;
  const category = p.WarningLevel || p['Alert Level'] || p.alert_level || p.category || p.Category
    || p.alertLevel || p.responseLevel || p.category1 || p._category || saLvl || p.type || p.eventType || 'Other';
  const pubDate = p.ItemDateTimeLocal_ISO || p.pubDate || p.created || p.updated || p.Updated || p.Date || p.onset || null;
  // Coordinates: geometry centroid first, then named fields (may be strings — coerce), then SA "lat,lon" Location string
  let lat = coords?.lat ?? p.Latitude ?? Number(p.lat ?? p.latitude ?? NaN);
  let lon = coords?.lon ?? p.Longitude ?? Number(p.lon ?? p.longitude ?? NaN);
  if ((!isFinite(lat) || !isFinite(lon)) && typeof p.Location === 'string' && p.Location.includes(',')) {
    const [a, b] = p.Location.split(',').map(Number);
    if (isFinite(a) && isFinite(b)) { lat = a; lon = b; }
  }
  const rawCat = String(category);
  const level = toAlertLevel(rawCat);
  return {
    title: String(title).trim().replace(/\s*-\s*$/, '') || 'Incident',
    category: level,
    type: rawCat !== level ? rawCat : undefined, // original incident type if different from alert level
    pubDate,
    lat: isFinite(lat) ? lat : null,
    lon: isFinite(lon) ? lon : null,
  };
}
function normalizeFireData(raw) {
  // Heuristic: is this item fire-related?
  // Accept if: no type field (dedicated fire feed), has known fire alert level, or type mentions fire/burn/etc.
  const FIRE_CATS = new Set(['emergency warning', 'watch and act', 'advice', 'information']);
  function isFireItem(p) {
    const typeVal = [p.type, p.feedType, p.feedtype, p.eventType, p.category1, p.incident_type,
                     p.IncidentType, p.incidentType, p._category, p._eventtype, p['Fire Type'], p.GroupedType]
      .filter(Boolean).map(s => String(s).toLowerCase());
    if (!typeVal.length) return true; // no type field — assume dedicated fire feed
    // Standard alert level on item → definitely a fire incident
    const alertCat = String(p.WarningLevel || p['Alert Level'] || p.alert_level || p.category || p.alertLevel || p.responseLevel || '').toLowerCase().trim();
    if (FIRE_CATS.has(alertCat)) return true;
    return typeVal.some(t => /fire|burn|ember|blaze|bush|grass|smoke|vegetation/i.test(t));
  }

  // GeoJSON FeatureCollection — NSW RFS, QLD QFD, VIC, WA, etc.
  const feats = Array.isArray(raw?.features) ? raw.features : null;
  if (feats) {
    const filtered = feats.filter(f => isFireItem(f.properties || {}));
    const counts = {}, items = [];
    for (const f of filtered) {
      const item = normalizeFireItem(f.properties || {}, f.geometry);
      counts[item.category] = (counts[item.category] || 0) + 1;
      if (items.length < 40) items.push(item);
    }
    return { available: true, total: filtered.length, counts, items };
  }
  // VIC Emergency getIncidentJSON legacy: { result: [...] }
  const result = Array.isArray(raw?.result) ? raw.result : null;
  if (result) {
    const filtered = result.filter(i => isFireItem(i));
    const counts = {}, items = [];
    for (const i of filtered) {
      const item = normalizeFireItem(i, null);
      counts[item.category] = (counts[item.category] || 0) + 1;
      if (items.length < 40) items.push(item);
    }
    return { available: true, total: filtered.length, counts, items };
  }
  // SA CFS cfs_current_incidents.json: { incidents: [...] }
  const incidents = Array.isArray(raw?.incidents) ? raw.incidents : null;
  if (incidents) {
    const filtered = incidents.filter(i => isFireItem(i));
    const counts = {}, items = [];
    for (const i of filtered) {
      const item = normalizeFireItem(i, null);
      counts[item.category] = (counts[item.category] || 0) + 1;
      if (items.length < 40) items.push(item);
    }
    return { available: true, total: filtered.length, counts, items };
  }
  // NT PFES — { incidents: { type: "FeatureCollection", features: [...] } } — nested GeoJSON
  const ntFeats = Array.isArray(raw?.incidents?.features) ? raw.incidents.features : null;
  if (ntFeats) {
    const filtered = ntFeats.filter(f => isFireItem(f.properties || {}));
    const counts = {}, items = [];
    for (const f of filtered) {
      const item = normalizeFireItem(f.properties || {}, f.geometry);
      counts[item.category] = (counts[item.category] || 0) + 1;
      if (items.length < 40) items.push(item);
    }
    return { available: true, total: filtered.length, counts, items };
  }
  // SA CFS direct JSON array (and any other flat-array feed)
  const rawArr = Array.isArray(raw) ? raw : Array.isArray(raw?.data) ? raw.data : Array.isArray(raw?.incidents_list) ? raw.incidents_list : null;
  if (rawArr) {
    const filtered = rawArr.filter(i => isFireItem(i));
    const counts = {}, items = [];
    for (const i of filtered) {
      const item = normalizeFireItem(i, null);
      counts[item.category] = (counts[item.category] || 0) + 1;
      if (items.length < 40) items.push(item);
    }
    return { available: true, total: filtered.length, counts, items };
  }
  return null;
}
// Parse TFS KML feed into normalised fire data
function parseFireKml(xml) {
  const entries = [];
  const pmRe = /<Placemark[^>]*>([\s\S]*?)<\/Placemark>/gi;
  let m;
  while ((m = pmRe.exec(xml)) !== null) {
    const block = m[1];
    const title = (/<name[^>]*>([\s\S]*?)<\/name>/i.exec(block) || [])[1] || 'Incident';
    // Try ExtendedData for alertLevel / category
    let category = 'Information';
    const edMatch = /<Data\s+name=["'](?:alertLevel|category|status|Type)["'][^>]*>[\s\S]*?<value[^>]*>([\s\S]*?)<\/value>/i.exec(block);
    if (edMatch) category = edMatch[1].trim();
    // Coordinates: Point or first ring of Polygon
    let lat = null, lon = null;
    const ptMatch = /<Point[^>]*>[\s\S]*?<coordinates[^>]*>([\s\S]*?)<\/coordinates>/i.exec(block);
    if (ptMatch) {
      const [lonS, latS] = ptMatch[1].trim().split(',');
      lon = parseFloat(lonS); lat = parseFloat(latS);
    } else {
      const polyMatch = /<coordinates[^>]*>([\s\S]*?)<\/coordinates>/i.exec(block);
      if (polyMatch) {
        const tuples = polyMatch[1].trim().split(/\s+/);
        const lons = [], lats = [];
        for (const t of tuples) { const [lo, la] = t.split(','); if (isFinite(+lo) && isFinite(+la)) { lons.push(+lo); lats.push(+la); } }
        if (lons.length) { lon = lons.reduce((s, v) => s + v, 0) / lons.length; lat = lats.reduce((s, v) => s + v, 0) / lats.length; }
      }
    }
    entries.push({
      title: title.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').trim(),
      category: category.replace(/<[^>]+>/g, '').trim(),
      lat: isFinite(lat) ? lat : null,
      lon: isFinite(lon) ? lon : null,
    });
  }
  return entries;
}
// normalizeFireData for pre-parsed Atom/KML entries (ACT ESA + TAS TFS)
function normalizeAtomEntries(entries) {
  if (!entries.length) return { available: true, total: 0, counts: {}, items: [] };
  const counts = {}, items = [];
  for (const i of entries) {
    counts[i.category] = (counts[i.category] || 0) + 1;
    if (items.length < 40) items.push(i);
  }
  return { available: true, total: entries.length, counts, items };
}
async function handleFireStatus(req, res, url) {
  const state = (url.searchParams.get('state') || 'QLD').toUpperCase();
  if (!(state in FIRE_STATE_FEEDS)) return json(res, 400, { error: 'Unknown state' });
  const feedUrl = FIRE_STATE_FEEDS[state];
  if (!feedUrl) return json(res, 200, { available: false });
  const t = Date.now();
  const cached = _fireCache[state];
  if (!cached || t - cached.ts > 10 * 60 * 1000) {
    // WA emergency.wa.gov.au requires Referer to return JSON instead of SPA HTML
    const extraHdrs = state === 'WA' ? { 'Referer': 'https://www.emergency.wa.gov.au/', 'Accept': 'application/json' } : null;
    const rawText = await fetchFireFeedRaw(feedUrl, extraHdrs);
    let normalized = null;
    if (rawText) {
      const trimmed = rawText.trimStart();
      if (trimmed.startsWith('<')) {
        // KML feed (TAS TFS) — detect by <kml or <Folder or <Placemark at root level
        if (/<kml[\s>]/i.test(trimmed) || /<Folder[\s>]/i.test(trimmed.slice(0, 500))) {
          const entries = parseFireKml(rawText);
          normalized = normalizeAtomEntries(entries);
        } else {
          // Atom/GeoRSS feed (ACT ESA)
          const entries = parseFireAtom(rawText);
          normalized = normalizeAtomEntries(entries);
        }
      } else {
        try {
          const parsed = JSON.parse(rawText);
          normalized = normalizeFireData(parsed);
        } catch { /* ignore */ }
      }
    }
    if (normalized) _fireCache[state] = { ts: t, data: normalized };
  }
  const entry = _fireCache[state];
  if (!entry) return json(res, 200, { available: false });
  return json(res, 200, { ...entry.data, updated: entry.ts });
}

// ── Fire Danger Ratings + Roads — shared raw fetcher (http or https) ─────────
function fetchFeedRaw(url, extraHeaders, _depth) {
  _depth = _depth || 0;
  if (_depth > 4) return Promise.resolve(null);
  return new Promise((resolve) => {
    const lib = url.startsWith('https') ? https : http;
    const req = lib.get(url, { timeout: 9000, headers: { 'User-Agent': FEED_UA, 'Accept': 'application/xml,application/json,text/xml,*/*', ...extraHeaders } }, (r) => {
      if ([301, 302, 307, 308].includes(r.statusCode) && r.headers.location) { r.resume(); return fetchFeedRaw(r.headers.location, extraHeaders, _depth + 1).then(resolve); }
      if (r.statusCode !== 200) { r.resume(); return resolve(null); }
      let buf = '';
      r.on('data', c => { buf += c; if (buf.length > 8e6) req.destroy(); });
      r.on('end', () => resolve(buf));
    });
    req.on('error', () => resolve(null));
    req.on('timeout', () => { req.destroy(); resolve(null); });
  });
}
function fetchFeedJSON(url, extraHeaders) { return fetchFeedRaw(url, extraHeaders).then(s => { if (!s) return null; try { return JSON.parse(s); } catch { return null; } }); }


// ── Road closures ─────────────────────────────────────────────────────────────
const QLDTRAFFIC_API_KEY = process.env.QLDTRAFFIC_API_KEY || '3e83add325cbb69ac4d8e5bf433d770b';
const VIC_OPENDATA_KEY   = process.env.VIC_OPENDATA_KEY   || 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJqdGkiOiJwWndKa3V1cmxBUDRKZjNYYkdoWkJfMjdzMzM3TTB6YU1uLTdVYW1LekFnIiwiaWF0IjoxNzgxNDI4MDc0fQ.JoU4UbnCIZJ2Mf3xi7rNo8lxTjkeOqWKmp3mQapv23M';
// Web Mercator (EPSG:3857) → WGS84 — WA and SA ArcGIS services return projected coords
function mercToLatLon(x, y) {
  const lon = (x / 20037508.342) * 180;
  const lat = (Math.atan(Math.exp(y / 6378137.0)) * 360.0) / Math.PI - 90;
  return isFinite(lat) && isFinite(lon) ? { lat, lon } : null;
}
function arcGisMercCentroid(paths) {
  if (!Array.isArray(paths)) return null;
  const pts = paths.flat();
  if (!pts.length) return null;
  const mx = pts.reduce((s, p) => s + p[0], 0) / pts.length;
  const my = pts.reduce((s, p) => s + p[1], 0) / pts.length;
  return mercToLatLon(mx, my);
}
// QLD Traffic API GeoJSON — EPSG:7844 geographic (lat/lon already), MultiLineString
// Properties are nested: description at root, road_name inside road_summary{}
function parseQLDClosures(raw) {
  if (!Array.isArray(raw?.features)) return null;
  const items = [];
  for (const f of raw.features) {
    const p = f.properties || {};
    const coords = geomCentroid(f.geometry);
    if (!coords) continue;
    const rs = p.road_summary || {};
    const road = rs.road_name || '';
    const locality = rs.locality || '';
    const desc = (p.description || '').trim();
    const title = (desc || [road, locality].filter(Boolean).join(', ') || 'Road Closure').slice(0, 200);
    items.push({ title, type: 'road_closure', lat: coords.lat, lon: coords.lon });
  }
  return { available: true, total: items.length, items };
}
// NSW Live Traffic GeoJSON — incidentKind is only Planned/Unplanned; real filter is
// periods[].closureType === 'ROAD_CLOSURE'. Title from roads[].mainStreet + suburb.
function parseNSWClosures(raw) {
  if (!Array.isArray(raw?.features)) return null;
  const items = [];
  for (const f of raw.features) {
    const p = f.properties || {};
    const hasRoadClosure = Array.isArray(p.periods) && p.periods.some(per => per.closureType === 'ROAD_CLOSURE');
    if (!hasRoadClosure) continue;
    const coords = geomCentroid(f.geometry);
    if (!coords) continue;
    const rds = Array.isArray(p.roads) ? p.roads : [];
    const road = rds[0] ? [rds[0].mainStreet, rds[0].suburb].filter(Boolean).join(' — ') : '';
    const title = (road || p.displayName || p.mainCategory || 'Road Closure').slice(0, 200);
    items.push({ title, type: 'road_closure', lat: coords.lat, lon: coords.lon });
  }
  return { available: true, total: items.length, items };
}
// SA ArcGIS MapServer layer 1 — pre-filtered to RD_CLOSURE, Web Mercator paths
function parseSAClosures(raw) {
  if (!Array.isArray(raw?.features)) return null;
  const items = [];
  for (const f of raw.features) {
    const a = f.attributes || {};
    const coords = arcGisMercCentroid(f.geometry?.paths);
    if (!coords) continue;
    const road = a.LOCAL_ROAD_NAME || '';
    const from = a.START_SUBURB || '';
    const to = a.END_SUBURB || '';
    const detail = (a.PLOT_DETAILS || '').replace(/\s*Ref#\s*\d+\s*$/i, '').trim();
    const title = (detail || [road, from && to ? `${from} to ${to}` : from || to].filter(Boolean).join(' — ') || 'Road Closure').slice(0, 200);
    items.push({ title, type: 'road_closure', lat: coords.lat, lon: coords.lon });
  }
  return { available: true, total: items.length, items };
}
// WA WebEOC ArcGIS FeatureServer layer 4 — Web Mercator paths
function parseWAClosures(raw) {
  if (!Array.isArray(raw?.features)) return null;
  const items = [];
  for (const f of raw.features) {
    const a = f.attributes || {};
    const coords = arcGisMercCentroid(f.geometry?.paths);
    if (!coords) continue;
    const desc = [a.Location || a.Road, a.TrafficImp].filter(Boolean).join(' — ');
    const title = (desc || 'Road Closure').slice(0, 200);
    const ct = String(a.ClosureTyp || '').toLowerCase();
    const type = ct.includes('clos') ? 'road_closure' : ct || 'caution';
    items.push({ title, type, lat: coords.lat, lon: coords.lon });
  }
  return { available: true, total: items.length, items };
}
// NT road report obstructions — response wrapped in { response: [...] }, coords in startPoint:[lat,lon]
function parseNTObstructions(raw) {
  const arr = Array.isArray(raw) ? raw : Array.isArray(raw?.response) ? raw.response : Array.isArray(raw?.data) ? raw.data : [];
  const items = [];
  for (const item of arr) {
    const sp = item.startPoint;
    const lat = Array.isArray(sp) ? parseFloat(sp[0]) : parseFloat(item.Lat ?? item.lat ?? item.latitude ?? item.Y ?? NaN);
    const lon = Array.isArray(sp) ? parseFloat(sp[1]) : parseFloat(item.Lon ?? item.lon ?? item.longitude ?? item.X ?? NaN);
    if (!isFinite(lat) || !isFinite(lon)) continue;
    const road = item.roadName || '';
    const loc  = item.locationComment || item.comment || '';
    const title = (road && loc ? `${road} — ${loc}` : road || loc || 'Road Obstruction').slice(0, 200);
    const rt = String(item.restrictionType || '').toLowerCase();
    const type = /road closed|impassable|detour/.test(rt) ? 'road_closure'
               : /caution|roadworks/.test(rt)             ? 'caution'
               : /4wd|high clearance/.test(rt)            ? 'hazard'
               : 'other';
    items.push({ title, type, lat, lon });
  }
  return { available: true, total: items.length, items };
}
// VIC Open Data — planned + unplanned road disruptions (GeoJSON, GeometryCollection geometry)
// Requires VIC_OPENDATA_KEY env var (Ocp-Apim-Subscription-Key from api.opendata.transport.vic.gov.au)
function parseVICDisruptions(raw) {
  if (!Array.isArray(raw?.features)) return null;
  const items = [];
  for (const f of raw.features) {
    const p = f.properties || {};
    const coords = geomCentroid(f.geometry);
    if (!coords) continue;
    const title = String(
      p.heading || p.title || p.description || p.suburb || p.location || p.disruption_type || 'Road Disruption'
    ).slice(0, 200);
    items.push({ title, type: 'road_closure', lat: coords.lat, lon: coords.lon });
  }
  return { available: true, total: items.length, items };
}
const ROAD_FEEDS = {
  QLD: { url: `https://api.qldtraffic.qld.gov.au/v2/events?apikey=${QLDTRAFFIC_API_KEY}&event_type=road_closure`, parse: parseQLDClosures, qldAuth: true },
  NSW: { url: 'https://data.livetraffic.com/traffic/hazards/incident.json', parse: parseNSWClosures },
  VIC: {
    urls: [
      'https://api.opendata.transport.vic.gov.au/opendata/roads/disruptions/planned/v1/?format=geojson',
      'https://api.opendata.transport.vic.gov.au/opendata/roads/disruptions/unplanned/v3/?format=geojson',
    ],
    parse: parseVICDisruptions,
    vicAuth: true,
  },
  SA:  { url: "https://maps.sa.gov.au/arcgis/rest/services/DPTIExtTransport/TrafficSAOpenData/MapServer/1/query?where=PLOT_TYPE+%3D+%27RD_CLOSURE%27&outFields=PLOT_DETAILS%2CLOCAL_ROAD_NAME%2CSTART_SUBURB%2CEND_SUBURB&f=json", parse: parseSAClosures },
  WA:  { url: 'https://services2.arcgis.com/cHGEnmsJ165IBJRM/arcgis/rest/services/WebEoc_RoadClosures/FeatureServer/4/query?where=1%3D1&outFields=Location%2CIncidentTy%2CClosureTyp%2CRoad%2CTrafficImp%2CRegion&f=json', parse: parseWAClosures },
  NT:  { url: 'https://roadreport.nt.gov.au/api/Obstruction/GetAll', parse: parseNTObstructions },
};
const _roadCache = {};
async function handleRoadsStatus(req, res, url) {
  const state = (url.searchParams.get('state') || 'QLD').toUpperCase();
  const feedCfg = ROAD_FEEDS[state];
  if (!feedCfg) return json(res, 200, { available: false });
  const t = Date.now();
  const cached = _roadCache[state];
  if (!cached || t - cached.ts > 5 * 60 * 1000) {
    const deadline = new Promise(r => setTimeout(() => r(null), 12000));
    let normalized = null;
    if (feedCfg.vicAuth) {
      // VIC: fetch planned + unplanned in parallel, merge features, parse once
      if (!VIC_OPENDATA_KEY) {
        // no key — leave normalized null so we return available:false
      } else {
        const vicHeaders = { 'Ocp-Apim-Subscription-Key': VIC_OPENDATA_KEY };
        const fetches = (feedCfg.urls || []).map(u => fetchFeedJSON(u, vicHeaders).catch(() => null));
        const raws = await Promise.race([Promise.all(fetches), deadline.then(() => null)]);
        if (raws) {
          const allFeatures = raws.flatMap(r => r?.features || []);
          normalized = feedCfg.parse({ type: 'FeatureCollection', features: allFeatures });
        }
      }
    } else {
      const extraHeaders = feedCfg.qldAuth ? { 'Authorization': `apikey ${QLDTRAFFIC_API_KEY}` } : {};
      const raw = await Promise.race([fetchFeedJSON(feedCfg.url, extraHeaders), deadline]);
      normalized = raw != null ? feedCfg.parse(raw) : null;
    }
    if (normalized) _roadCache[state] = { ts: t, data: normalized };
  }
  const entry = _roadCache[state];
  if (!entry) return json(res, 200, { available: false });
  return json(res, 200, { ...entry.data, updated: entry.ts });
}

const fireServer = createServiceServer({
  htmlEntry: '/dist/fire.html',
  routes: async (req, res, url) => {
    if (req.method === 'GET' && url.pathname === '/api/fire/status') { await handleFireStatus(req, res, url); return true; }
    if (req.method === 'GET' && url.pathname === '/api/fire/roads')  { await handleRoadsStatus(req, res, url); return true; }
    if (req.method === 'GET' && url.pathname === '/api/fire/debug') {
      const state = (url.searchParams.get('state') || 'QLD').toUpperCase();
      const feedUrl = FIRE_STATE_FEEDS[state];
      if (!feedUrl) return json(res, 200, { state, feedUrl: null, available: false });
      const rawText = await fetchFireFeedRaw(feedUrl);
      let parsed = null, normalized = null, parseError = null;
      if (rawText) {
        const trimmed = rawText.trimStart();
        if (trimmed.startsWith('<')) {
          const entries = /<kml[\s>]/i.test(trimmed) ? parseFireKml(rawText) : parseFireAtom(rawText);
          normalized = normalizeAtomEntries(entries);
          parsed = { xmlEntries: entries.slice(0, 2), entryCount: entries.length };
        } else {
          try { parsed = JSON.parse(rawText); normalized = normalizeFireData(parsed); } catch (e) { parseError = e.message; }
        }
      }
      return json(res, 200, {
        state, feedUrl,
        rawLength: rawText ? rawText.length : 0,
        rawSnippet: rawText ? rawText.slice(0, 500) : null,
        parseError,
        topLevelKeys: parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? Object.keys(parsed) : null,
        firstRawItem: (() => {
          if (!parsed) return null;
          const f = Array.isArray(parsed) ? parsed[0]
            : (parsed?.features?.[0] || parsed?.incidents?.features?.[0] || parsed?.incidents?.[0] || parsed?.result?.[0] || parsed?.data?.[0]);
          return f ? { properties: f?.properties || f, geometry: f?.geometry?.type } : null;
        })(),
        normalized: normalized ? { total: normalized.total, counts: normalized.counts, firstItem: normalized.items?.[0] } : null,
      });
    }
    return false;
  },
});

// ── Maps (8106) — interactive outback map (Leaflet CDN + OSM tiles) ──────────
// POIs are proxied from OSM Overpass server-side so the browser only talks to
// 'self' — no dependency on the (Cloudflare-managed) external CSP. Cached 2 min.
function fetchOverpass(bbox) {
  return new Promise((resolve) => {
    const query = `[out:json][timeout:20];(node["amenity"="fuel"](${bbox});node["amenity"="drinking_water"](${bbox});node["tourism"="camp_site"](${bbox});node["tourism"="caravan_site"](${bbox}););out body 150;`;
    const body = 'data=' + encodeURIComponent(query);
    const req = https.request({ hostname: 'overpass-api.de', path: '/api/interpreter', method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(body), 'User-Agent': 'OutbackElectronics/1.0' }, timeout: 25000 }, (r) => {
      if (r.statusCode !== 200) { r.resume(); return resolve(null); }
      let buf = '';
      r.on('data', c => { buf += c; if (buf.length > 8e6) req.destroy(); });
      r.on('end', () => { try { resolve(JSON.parse(buf)); } catch { resolve(null); } });
    });
    req.on('error', () => resolve(null));
    req.on('timeout', () => { req.destroy(); resolve(null); });
    req.write(body); req.end();
  });
}
const _overpassCache = new Map();
async function cachedOverpass(bbox) {
  const hit = _overpassCache.get(bbox);
  if (hit && Date.now() - hit.ts < 120000) return hit.data;
  const data = await fetchOverpass(bbox);
  if (data) { _overpassCache.set(bbox, { ts: Date.now(), data }); if (_overpassCache.size > 80) _overpassCache.delete(_overpassCache.keys().next().value); }
  return data;
}
const mapsServer = createServiceServer({
  htmlEntry: '/dist/maps.html',
  routes: async (req, res, url) => {
    if (req.method === 'GET' && url.pathname === '/api/maps/pois') {
      const r2 = (x) => Math.round(Number(x) * 100) / 100;
      const s = r2(url.searchParams.get('s')), w = r2(url.searchParams.get('w')), n = r2(url.searchParams.get('n')), e = r2(url.searchParams.get('e'));
      if (![s, w, n, e].every(Number.isFinite)) { json(res, 422, { error: 'bad_bbox' }); return true; }
      const data = await cachedOverpass(`${s},${w},${n},${e}`);
      if (!data) { json(res, 200, { available: false, pois: [] }); return true; }
      const pois = (data.elements || []).map(el => {
        const t = el.tags || {};
        const cat = t.amenity === 'fuel' ? 'fuel' : t.amenity === 'drinking_water' ? 'water' : (t.tourism === 'camp_site' || t.tourism === 'caravan_site') ? 'camp' : null;
        return (cat && el.lat && el.lon) ? { id: el.id, lat: el.lat, lon: el.lon, cat, name: (t.name || null) } : null;
      }).filter(Boolean);
      json(res, 200, { available: true, pois });
      return true;
    }
    return false;
  },
});

// ── Coverage (8105) — crowd-sourced mobile/satellite signal map ──────────────
const COVERAGE_DB = path.join(__dirname, 'coverage.db');
function readCoverage() { try { const d = JSON.parse(fs.readFileSync(COVERAGE_DB, 'utf8')); return Array.isArray(d.reports) ? d.reports : []; } catch { return []; } }
function writeCoverage(reports) { atomicWriteFile(COVERAGE_DB, JSON.stringify({ reports })); }
const COVERAGE_CARRIERS = ['Telstra', 'Optus', 'Vodafone', 'Starlink', 'Other'];
const COVERAGE_TECHS = ['5G', '4G', '3G', 'Satellite', 'None'];
const coverageServer = createServiceServer({
  htmlEntry: '/dist/coverage.html',
  routes: async (req, res, url) => {
    if (req.method === 'GET' && url.pathname === '/api/coverage/reports') {
      json(res, 200, { reports: readCoverage().slice(-3000) });
      return true;
    }
    if (req.method === 'POST' && url.pathname === '/api/coverage/report') {
      if (publicRateLimited(getIp(req), 'coverage')) { json(res, 429, { error: 'rate_limited' }); return true; }
      let b; try { b = await readJson(req); } catch { json(res, 400, { error: 'bad_request' }); return true; }
      const lat = Number(b.lat), lon = Number(b.lon);
      if (!isFinite(lat) || !isFinite(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) { json(res, 422, { error: 'bad_coords' }); return true; }
      const carrier = COVERAGE_CARRIERS.includes(b.carrier) ? b.carrier : 'Other';
      const tech = COVERAGE_TECHS.includes(b.tech) ? b.tech : 'None';
      const bars = Math.max(0, Math.min(5, parseInt(b.bars, 10) || 0));
      const note = typeof b.note === 'string' ? b.note.trim().slice(0, 140) : '';
      const reports = readCoverage();
      reports.push({ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), lat: +lat.toFixed(5), lon: +lon.toFixed(5), carrier, tech, bars, note, ts: Date.now() });
      if (reports.length > 20000) reports.splice(0, reports.length - 20000);
      writeCoverage(reports);
      json(res, 200, { ok: true });
      return true;
    }
    return false;
  },
});

// ── Drive (8102) — account-gated file storage (drive.db + drive-files/) ─────
const DRIVE_DB = path.join(__dirname, 'drive.db');
const DRIVE_DIR = path.join(__dirname, 'drive-files');
fs.mkdirSync(DRIVE_DIR, { recursive: true });
function readDrive() { try { const d = JSON.parse(fs.readFileSync(DRIVE_DB, 'utf8')); return Array.isArray(d.files) ? d.files : []; } catch { return []; } }
function writeDrive(files) { atomicWriteFile(DRIVE_DB, JSON.stringify({ files })); }
function safeFileName(n) { return String(n || 'file').replace(/[^a-zA-Z0-9._ -]/g, '_').slice(0, 120) || 'file'; }
function userDirFor(base, id) { const d = path.join(base, String(id).replace(/[^a-zA-Z0-9_-]/g, '_')); fs.mkdirSync(d, { recursive: true }); return d; }
const driveServer = createServiceServer({
  htmlEntry: '/dist/drive.html',
  routes: async (req, res, url) => {
    if (!url.pathname.startsWith('/api/drive')) return false;
    const session = getPortalSession(req);
    if (!session) { json(res, 401, { error: 'login_required' }); return true; }
    if (req.method === 'GET' && url.pathname === '/api/drive/list') {
      const files = readDrive().filter(f => f.userId === session.id).map(({ path: _p, ...m }) => m).sort((a, b) => b.ts - a.ts);
      json(res, 200, { files }); return true;
    }
    if (req.method === 'POST' && url.pathname === '/api/drive/upload') {
      let b; try { b = await readJson(req, 30e6); } catch { json(res, 400, { error: 'bad_request' }); return true; }
      const name = safeFileName(b.name);
      const type = String(b.type || 'application/octet-stream').slice(0, 100);
      const buf = Buffer.from(String(b.dataBase64 || ''), 'base64');
      if (!buf.length) { json(res, 422, { error: 'empty' }); return true; }
      if (buf.length > 20 * 1024 * 1024) { json(res, 413, { error: 'too_large', message: 'Max 20 MB per file.' }); return true; }
      const dir = userDirFor(DRIVE_DIR, session.id);
      const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
      const fp = path.join(dir, id + '-' + name);
      fs.writeFileSync(fp, buf);
      const files = readDrive();
      files.push({ id, userId: session.id, name, size: buf.length, type, ts: Date.now(), path: fp });
      writeDrive(files);
      json(res, 200, { ok: true }); return true;
    }
    if (req.method === 'GET' && url.pathname === '/api/drive/file') {
      const f = readDrive().find(x => x.id === url.searchParams.get('id') && x.userId === session.id);
      if (!f || !fs.existsSync(f.path)) { json(res, 404, { error: 'not_found' }); return true; }
      res.writeHead(200, { 'Content-Type': f.type || 'application/octet-stream', 'Content-Disposition': `attachment; filename="${f.name}"`, 'Content-Length': f.size, 'X-Content-Type-Options': 'nosniff' });
      fs.createReadStream(f.path).on('error', () => res.end()).pipe(res); return true;
    }
    if (req.method === 'POST' && url.pathname === '/api/drive/delete') {
      let b; try { b = await readJson(req); } catch { json(res, 400, { error: 'bad_request' }); return true; }
      const files = readDrive(); const i = files.findIndex(x => x.id === b.id && x.userId === session.id);
      if (i < 0) { json(res, 404, { error: 'not_found' }); return true; }
      try { fs.unlinkSync(files[i].path); } catch {}
      files.splice(i, 1); writeDrive(files);
      json(res, 200, { ok: true }); return true;
    }
    return false;
  },
});

// ── Photos (8103) — account-gated photo gallery (photos.db + photos-files/) ──
const PHOTOS_DB = path.join(__dirname, 'photos.db');
const PHOTOS_DIR = path.join(__dirname, 'photos-files');
fs.mkdirSync(PHOTOS_DIR, { recursive: true });
function readPhotos() { try { const d = JSON.parse(fs.readFileSync(PHOTOS_DB, 'utf8')); return Array.isArray(d.photos) ? d.photos : []; } catch { return []; } }
function writePhotos(photos) { atomicWriteFile(PHOTOS_DB, JSON.stringify({ photos })); }
const photosServer = createServiceServer({
  htmlEntry: '/dist/photos.html',
  routes: async (req, res, url) => {
    if (!url.pathname.startsWith('/api/photos')) return false;
    const session = getPortalSession(req);
    if (!session) { json(res, 401, { error: 'login_required' }); return true; }
    if (req.method === 'GET' && url.pathname === '/api/photos/list') {
      const photos = readPhotos().filter(p => p.userId === session.id).map(({ path: _p, ...m }) => m).sort((a, b) => b.ts - a.ts);
      json(res, 200, { photos }); return true;
    }
    if (req.method === 'POST' && url.pathname === '/api/photos/upload') {
      let b; try { b = await readJson(req, 25e6); } catch { json(res, 400, { error: 'bad_request' }); return true; }
      const type = String(b.type || '').toLowerCase();
      if (!type.startsWith('image/')) { json(res, 422, { error: 'not_image', message: 'Images only.' }); return true; }
      const buf = Buffer.from(String(b.dataBase64 || ''), 'base64');
      if (!buf.length) { json(res, 422, { error: 'empty' }); return true; }
      if (buf.length > 15 * 1024 * 1024) { json(res, 413, { error: 'too_large', message: 'Max 15 MB per photo.' }); return true; }
      const dir = userDirFor(PHOTOS_DIR, session.id);
      const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
      const ext = (type.split('/')[1] || 'jpg').replace(/[^a-z0-9]/g, '').slice(0, 5) || 'jpg';
      const fp = path.join(dir, id + '.' + ext);
      fs.writeFileSync(fp, buf);
      const photos = readPhotos();
      photos.push({ id, userId: session.id, name: safeFileName(b.name || ('photo.' + ext)), size: buf.length, type, ts: Date.now(), path: fp });
      writePhotos(photos);
      json(res, 200, { ok: true }); return true;
    }
    if (req.method === 'GET' && url.pathname === '/api/photos/file') {
      const p = readPhotos().find(x => x.id === url.searchParams.get('id') && x.userId === session.id);
      if (!p || !fs.existsSync(p.path)) { json(res, 404, { error: 'not_found' }); return true; }
      res.writeHead(200, { 'Content-Type': p.type || 'image/jpeg', 'Content-Length': p.size, 'Cache-Control': 'private, max-age=3600', 'X-Content-Type-Options': 'nosniff' });
      fs.createReadStream(p.path).on('error', () => res.end()).pipe(res); return true;
    }
    if (req.method === 'POST' && url.pathname === '/api/photos/delete') {
      let b; try { b = await readJson(req); } catch { json(res, 400, { error: 'bad_request' }); return true; }
      const photos = readPhotos(); const i = photos.findIndex(x => x.id === b.id && x.userId === session.id);
      if (i < 0) { json(res, 404, { error: 'not_found' }); return true; }
      try { fs.unlinkSync(photos[i].path); } catch {}
      photos.splice(i, 1); writePhotos(photos);
      json(res, 200, { ok: true }); return true;
    }
    return false;
  },
});

// ── Swap (8111) — community classifieds (swap.db + swap-files/) ─────────────
const SWAP_DB = path.join(__dirname, 'swap.db');
const SWAP_DIR = path.join(__dirname, 'swap-files');
fs.mkdirSync(SWAP_DIR, { recursive: true });
function readSwap() { try { const d = JSON.parse(fs.readFileSync(SWAP_DB, 'utf8')); return Array.isArray(d.listings) ? d.listings : []; } catch { return []; } }
function writeSwap(listings) { atomicWriteFile(SWAP_DB, JSON.stringify({ listings })); }
const SWAP_CATS = ['For Sale', 'Wanted', 'Free', 'Swap/Trade', 'Services'];
const swapServer = createServiceServer({
  htmlEntry: '/dist/swap.html',
  routes: async (req, res, url) => {
    if (req.method === 'GET' && url.pathname === '/api/swap/listings') {
      const cat = url.searchParams.get('cat');
      let list = readSwap().slice().sort((a, b) => b.ts - a.ts);
      if (cat && SWAP_CATS.includes(cat)) list = list.filter(l => l.category === cat);
      const session = getPortalSession(req);
      const mine = session ? session.id : null;
      json(res, 200, {
        categories: SWAP_CATS,
        listings: list.slice(0, 500).map(l => ({ id: l.id, title: l.title, desc: l.desc, price: l.price, category: l.category, location: l.location, contact: l.contact, sellerName: l.sellerName, hasImage: !!l.imageId, ts: l.ts, own: l.userId === mine })),
      });
      return true;
    }
    if (req.method === 'GET' && url.pathname === '/api/swap/image') {
      const l = readSwap().find(x => x.id === url.searchParams.get('id'));
      if (!l || !l.imagePath || !fs.existsSync(l.imagePath)) { json(res, 404, { error: 'not_found' }); return true; }
      res.writeHead(200, { 'Content-Type': l.imageType || 'image/jpeg', 'Cache-Control': 'public, max-age=3600', 'X-Content-Type-Options': 'nosniff' });
      fs.createReadStream(l.imagePath).on('error', () => res.end()).pipe(res); return true;
    }
    if (req.method === 'POST' && url.pathname === '/api/swap/post') {
      const session = getPortalSession(req);
      if (!session) { json(res, 401, { error: 'login_required' }); return true; }
      if (publicRateLimited(getIp(req), 'swap_post')) { json(res, 429, { error: 'rate_limited' }); return true; }
      let b; try { b = await readJson(req, 12e6); } catch { json(res, 400, { error: 'bad_request' }); return true; }
      const title = String(b.title || '').trim().slice(0, 100);
      if (!title) { json(res, 422, { error: 'title_required', message: 'A title is required.' }); return true; }
      const category = SWAP_CATS.includes(b.category) ? b.category : 'For Sale';
      const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
      let imageId = null, imagePath = null, imageType = null;
      if (b.imageBase64 && typeof b.imageType === 'string' && b.imageType.toLowerCase().startsWith('image/')) {
        const buf = Buffer.from(String(b.imageBase64), 'base64');
        if (buf.length && buf.length <= 8 * 1024 * 1024) {
          imageType = b.imageType.toLowerCase();
          const ext = (imageType.split('/')[1] || 'jpg').replace(/[^a-z0-9]/g, '').slice(0, 5) || 'jpg';
          imagePath = path.join(SWAP_DIR, id + '.' + ext);
          fs.writeFileSync(imagePath, buf); imageId = id;
        }
      }
      const listings = readSwap();
      listings.push({ id, userId: session.id, sellerName: session.displayName || session.username, title, desc: String(b.desc || '').trim().slice(0, 2000), price: String(b.price || '').trim().slice(0, 40), category, location: String(b.location || '').trim().slice(0, 80), contact: String(b.contact || '').trim().slice(0, 120), imageId, imagePath, imageType, ts: Date.now() });
      if (listings.length > 5000) listings.splice(0, listings.length - 5000);
      writeSwap(listings);
      json(res, 200, { ok: true, id }); return true;
    }
    if (req.method === 'POST' && url.pathname === '/api/swap/delete') {
      const session = getPortalSession(req);
      if (!session) { json(res, 401, { error: 'login_required' }); return true; }
      let b; try { b = await readJson(req); } catch { json(res, 400, { error: 'bad_request' }); return true; }
      const listings = readSwap(); const i = listings.findIndex(x => x.id === b.id && x.userId === session.id);
      if (i < 0) { json(res, 404, { error: 'not_found' }); return true; }
      if (listings[i].imagePath) { try { fs.unlinkSync(listings[i].imagePath); } catch {} }
      listings.splice(i, 1); writeSwap(listings);
      json(res, 200, { ok: true }); return true;
    }
    return false;
  },
});

// ── Beacon (8108) — safety check-ins; emails a contact on a missed check-in ─
const BEACON_DB = path.join(__dirname, 'beacon.db');
function readBeacons() { try { const d = JSON.parse(fs.readFileSync(BEACON_DB, 'utf8')); return (d && d.beacons) || {}; } catch { return {}; } }
function writeBeacons(beacons) { atomicWriteFile(BEACON_DB, JSON.stringify({ beacons })); }
const beaconEsc = (s) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
function beaconView(b) {
  if (!b || !b.active) return { active: false };
  const dueAt = b.lastCheckIn + b.intervalHours * 3600000;
  return { active: true, intervalHours: b.intervalHours, contactName: b.contactName, contactEmail: b.contactEmail, message: b.message, lastCheckIn: b.lastCheckIn, dueAt, overdue: Date.now() > dueAt };
}
const beaconServer = createServiceServer({
  htmlEntry: '/dist/beacon.html',
  routes: async (req, res, url) => {
    if (!url.pathname.startsWith('/api/beacon')) return false;
    const session = getPortalSession(req);
    if (!session) { json(res, 401, { error: 'login_required' }); return true; }
    const beacons = readBeacons();
    if (req.method === 'GET' && url.pathname === '/api/beacon/status') { json(res, 200, beaconView(beacons[session.id])); return true; }
    if (req.method === 'POST' && url.pathname === '/api/beacon/setup') {
      let b; try { b = await readJson(req); } catch { json(res, 400, { error: 'bad_request' }); return true; }
      const intervalHours = Math.max(1, Math.min(168, parseInt(b.intervalHours, 10) || 24));
      const contactEmail = String(b.contactEmail || '').trim().slice(0, 120);
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) { json(res, 422, { error: 'bad_email', message: 'A valid contact email is required.' }); return true; }
      beacons[session.id] = { userId: session.id, userName: session.displayName || session.username, intervalHours, contactEmail, contactName: String(b.contactName || '').trim().slice(0, 80), message: String(b.message || '').trim().slice(0, 300), active: true, lastCheckIn: Date.now(), alertedAt: 0 };
      writeBeacons(beacons); json(res, 200, beaconView(beacons[session.id])); return true;
    }
    if (req.method === 'POST' && url.pathname === '/api/beacon/checkin') {
      const b = beacons[session.id]; if (!b || !b.active) { json(res, 404, { error: 'no_beacon' }); return true; }
      b.lastCheckIn = Date.now(); b.alertedAt = 0; writeBeacons(beacons); json(res, 200, beaconView(b)); return true;
    }
    if (req.method === 'POST' && url.pathname === '/api/beacon/stop') {
      const b = beacons[session.id]; if (b) { b.active = false; writeBeacons(beacons); } json(res, 200, { active: false }); return true;
    }
    return false;
  },
});
// Overdue checker — emails the nominated contact once per missed cycle
setInterval(() => {
  try {
    const beacons = readBeacons(); let changed = false; const now = Date.now();
    for (const id of Object.keys(beacons)) {
      const b = beacons[id];
      if (!b || !b.active) continue;
      const dueAt = b.lastCheckIn + b.intervalHours * 3600000;
      if (now > dueAt && (!b.alertedAt || b.alertedAt < b.lastCheckIn)) {
        if (b.contactEmail) {
          const hoursLate = Math.round((now - dueAt) / 3600000);
          sendEmail({ to: b.contactEmail, subject: `Missed check-in from ${b.userName || 'a traveller'}`, html: `<p>Hi ${beaconEsc(b.contactName || 'there')},</p><p><b>${beaconEsc(b.userName || 'A traveller')}</b> set up an Outback Electronics safety beacon and has missed a scheduled check-in — it was due ${new Date(dueAt).toLocaleString('en-AU')} (about ${hoursLate}h ago).</p>${b.message ? `<p>Their note: "${beaconEsc(b.message)}"</p>` : ''}<p>This is an automated safety alert. Please try to reach them — and contact emergency services (000) if you're concerned.</p>` }).catch(() => {});
        }
        b.alertedAt = now; changed = true;
      }
    }
    if (changed) writeBeacons(beacons);
  } catch {}
}, 5 * 60 * 1000);

// ── Radio (8110) — continuous server-side broadcast from radio-media/ ────────
// One shared timeline streamed to all listeners (audio-only; tune in/out but no
// pause or skip). Drop .mp3 files into radio-media/. Paced to a CBR estimate.
// Media folder is configurable — point RADIO_MEDIA_DIR at any library
// (e.g. /home/daniel/Music). Defaults to radio-media/ in the project root.
const RADIO_DIR = process.env.RADIO_MEDIA_DIR || path.join(__dirname, 'radio-media');
try { fs.mkdirSync(RADIO_DIR, { recursive: true }); } catch {}
const RADIO_BYTES_PER_SEC = Math.max(4000, Math.round((parseInt(process.env.RADIO_BITRATE_KBPS, 10) || 128) * 125));
let _radioPlaylist = [], _radioIdx = -1, _radioTrack = null, _radioBuf = null, _radioPos = 0;
const _radioListeners = new Set();
// Walk radio-media/ recursively — each subfolder is an album. Playlist entries
// are relative paths (e.g. "Heimsöknin/01-track.mp3"), sorted so albums group
// and tracks play in order within each.
function radioScan() {
  const out = [];
  const walk = (dir, rel) => {
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (e.name.startsWith('.')) continue;
      const abs = path.join(dir, e.name);
      const r = rel ? rel + '/' + e.name : e.name;
      if (e.isDirectory()) walk(abs, r);
      else if (/\.mp3$/i.test(e.name)) out.push(r);
    }
  };
  walk(RADIO_DIR, '');
  out.sort((a, b) => a.localeCompare(b));
  _radioPlaylist = out;
}
radioScan();
function radioLoadNext() {
  if (!_radioPlaylist.length) radioScan();
  if (!_radioPlaylist.length) { _radioBuf = null; _radioTrack = null; return; }
  _radioIdx = (_radioIdx + 1) % _radioPlaylist.length;
  if (_radioIdx === 0) radioScan(); // pick up newly-added tracks each loop
  _radioTrack = _radioPlaylist[_radioIdx] || null;
  try { _radioBuf = _radioTrack ? fs.readFileSync(path.join(RADIO_DIR, _radioTrack)) : null; _radioPos = 0; } catch { _radioBuf = null; }
}
setInterval(() => {
  if (!_radioListeners.size) return; // advance the dial only while someone's tuned in
  if (!_radioBuf) { radioLoadNext(); if (!_radioBuf) return; }
  const end = Math.min(_radioPos + Math.round(RADIO_BYTES_PER_SEC / 4), _radioBuf.length);
  const chunk = _radioBuf.slice(_radioPos, end);
  _radioPos = end;
  for (const res of _radioListeners) { try { res.write(chunk); } catch { _radioListeners.delete(res); } }
  if (_radioPos >= _radioBuf.length) radioLoadNext();
}, 250);
const radioServer = createServiceServer({
  htmlEntry: '/dist/radio.html',
  routes: async (req, res, url) => {
    if (req.method === 'GET' && url.pathname === '/api/radio/nowplaying') {
      const rel = _radioTrack || '';
      const slash = rel.lastIndexOf('/');
      const album = slash >= 0 ? rel.slice(0, slash).split('/').pop() : null;
      const file = slash >= 0 ? rel.slice(slash + 1) : rel;
      const title = file ? file.replace(/\.mp3$/i, '').replace(/^\d+[-_ ]*/, '').replace(/[_-]+/g, ' ').trim() : null;
      json(res, 200, { onAir: _radioPlaylist.length > 0, track: title, album: album || null, count: _radioPlaylist.length, listeners: _radioListeners.size });
      return true;
    }
    if (req.method === 'GET' && url.pathname === '/stream') {
      if (!_radioPlaylist.length) radioScan();
      if (!_radioPlaylist.length) { json(res, 503, { error: 'off_air' }); return true; }
      if (!_radioBuf) radioLoadNext();
      res.writeHead(200, { 'Content-Type': 'audio/mpeg', 'Cache-Control': 'no-cache, no-store', 'Pragma': 'no-cache', 'Connection': 'keep-alive' });
      _radioListeners.add(res);
      req.on('close', () => { _radioListeners.delete(res); });
      return true; // keep the connection open for streaming
    }
    return false;
  },
});

startServer(mainServer,   MAIN_PORT,   'main  ');
startServer(discourseRedirectServer, DISCOURSE_REDIRECT_PORT, 'redirect');
startServer(adminServer,  ADMIN_PORT,  'admin ');
startServer(portalServer, PORTAL_PORT, 'portal');
startServer(gamesServer,  GAMES_PORT,  'games ');
startServer(toolsServer,  TOOLS_PORT,  'tools ');
startServer(weatherServer, WEATHER_PORT, 'weather');
startServer(aiGatewayServer, AI_GATEWAY_PORT, 'ai    ');
startServer(hubServer,    HUB_PORT,    'hub   ');
startServer(solarServer,  SOLAR_PORT,  'solar ');
startServer(skyServer,    SKY_PORT,    'sky   ');
startServer(fireServer,   FIRE_PORT,   'fire  ');
startServer(mapsServer,   MAPS_PORT,   'maps  ');
startServer(coverageServer, COVERAGE_PORT, 'cover ');
startServer(driveServer,  DRIVE_PORT,  'drive ');
startServer(photosServer, PHOTOS_PORT, 'photos');
startServer(swapServer,   SWAP_PORT,   'swap  ');
startServer(beaconServer, BEACON_PORT, 'beacon');
startServer(radioServer,  RADIO_PORT,  'radio ');
