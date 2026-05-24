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
const PUBLIC_RATE_WINDOW_MS = 1000 * 60 * 10;
const PUBLIC_RATE_LIMITS = { checkout: 20, 'quote/request': 5, 'contact/quick-message': 5, 'register': 5 };

fs.mkdirSync(path.join(__dirname, 'assets/uploads'), { recursive: true });

const STRIPE_SECRET_KEY     = process.env.STRIPE_SECRET_KEY     || '';
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || '';
const SITE_URL              = process.env.SITE_URL              || 'http://localhost:8080';
const ADMIN_URL             = process.env.ADMIN_URL             || SITE_URL.replace(/(:\d+)?(\/|$)/, ':8082$2');

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
const TUTORIALS_DB_PATH = path.join(__dirname, 'tutorials.db');
const AI_DB_PATH        = path.join(__dirname, 'ai.db');
const POLICIES_DB_PATH  = path.join(__dirname, 'policies.db');
const SETTINGS_DB_PATH  = path.join(__dirname, 'settings.db');
const MEMBERSHIPS_DB_PATH = path.join(__dirname, 'memberships.db');
const STAFF_DB_PATH       = path.join(__dirname, 'staff.db');
const SETTINGS_DEFAULTS_PATH = path.join(__dirname, 'settings.defaults.json');
const ADMIN_AUDIT_LOG_PATH   = path.join(__dirname, 'admin-audit.log');
const SESSIONS_DB_PATH        = path.join(__dirname, 'sessions.db');
const FORUM_SESSIONS_DB_PATH  = path.join(__dirname, 'forum-sessions.db');
const PORTAL_SESSIONS_DB_PATH = path.join(__dirname, 'portal-sessions.db');
const RESET_TOKENS_DB_PATH = path.join(__dirname, 'password-reset-tokens.db');
const RESET_TOKEN_TTL_MS = 1000 * 60 * 60; // 1 hour
const FORUM_URL  = process.env.FORUM_URL  || SITE_URL.replace(/(:\d+)?(\/|$)/, ':8081$2');
const PORTAL_URL = process.env.PORTAL_URL || SITE_URL.replace(/(:\d+)?(\/|$)/, ':8083$2');

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

function readProducts() {
  try { const p = JSON.parse(fs.readFileSync(PRODUCTS_DB_PATH, 'utf8')); return Array.isArray(p.products) ? p.products : []; } catch { return []; }
}
function writeProducts(products) { atomicWriteFile(PRODUCTS_DB_PATH, JSON.stringify({ products }, null, 2)); }

function readServices() {
  try { const p = JSON.parse(fs.readFileSync(SERVICES_DB_PATH, 'utf8')); return Array.isArray(p.services) ? p.services : []; } catch { return []; }
}
function writeServices(services) { atomicWriteFile(SERVICES_DB_PATH, JSON.stringify({ services }, null, 2)); }

function readCatalog() { return { products: readProducts(), services: readServices() }; }

function readOrders() {
  try { const p = JSON.parse(fs.readFileSync(ORDERS_DB_PATH, 'utf8')); return Array.isArray(p.orders) ? p.orders : []; } catch { return []; }
}
function writeOrders(orders) { atomicWriteFile(ORDERS_DB_PATH, JSON.stringify({ orders }, null, 2)); }

function readCustomers() {
  try { const p = JSON.parse(fs.readFileSync(CUSTOMERS_DB_PATH, 'utf8')); return Array.isArray(p.customers) ? p.customers : []; } catch { return []; }
}
function writeCustomers(customers) { atomicWriteFile(CUSTOMERS_DB_PATH, JSON.stringify({ customers }, null, 2)); }

function readRepairs() {
  try { const p = JSON.parse(fs.readFileSync(REPAIRS_DB_PATH, 'utf8')); return p && Array.isArray(p.columns) ? p : { columns: [] }; } catch { return { columns: [] }; }
}
function writeRepairs(repairs) { atomicWriteFile(REPAIRS_DB_PATH, JSON.stringify(repairs, null, 2)); }

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

function readSettingsDefaults() {
  try {
    const d = JSON.parse(fs.readFileSync(SETTINGS_DEFAULTS_PATH, 'utf8'));
    return {
      shop: d.shop || {},
      announcement: d.announcement || { text: '', enabled: false, expiresAt: '' },
      maintenance: d.maintenance || { enabled: false },
      staff: d.staff || [],
      integrations: d.integrations || [],
      siteContent: d.siteContent || {},
    };
  } catch { return { shop: {}, announcement: { text: '', enabled: false, expiresAt: '' }, maintenance: { enabled: false }, staff: [], integrations: [], siteContent: {} }; }
}
function readSettings() {
  const defaults = readSettingsDefaults();
  try {
    const d = JSON.parse(fs.readFileSync(SETTINGS_DB_PATH, 'utf8'));
    return {
      shop: { ...defaults.shop, ...(d.shop || {}) },
      announcement: { ...defaults.announcement, ...(d.announcement || {}) },
      maintenance: { ...defaults.maintenance, ...(d.maintenance || {}) },
      staff: Array.isArray(d.staff) ? d.staff : defaults.staff,
      integrations: Array.isArray(d.integrations) ? d.integrations : defaults.integrations,
      siteContent: { ...defaults.siteContent, ...(d.siteContent || {}) },
    };
  } catch { return defaults; }
}
function writeSettings(data) { atomicWriteFile(SETTINGS_DB_PATH, JSON.stringify(data, null, 2)); }

function readExpenses() { try { return JSON.parse(fs.readFileSync(path.join(__dirname, 'expenses.db'), 'utf8')).expenses || []; } catch { return []; } }
function writeExpenses(e) { atomicWriteFile(path.join(__dirname, 'expenses.db'), JSON.stringify({ expenses: e }, null, 2)); }

function readGiftCards() {
  try { const d = JSON.parse(fs.readFileSync(GIFTCARDS_DB_PATH, 'utf8')); return Array.isArray(d.giftCards) ? d.giftCards : []; }
  catch { return []; }
}
function writeGiftCards(giftCards) { atomicWriteFile(GIFTCARDS_DB_PATH, JSON.stringify({ giftCards }, null, 2)); }

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

function getIp(req) {
  return (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress || 'unknown';
}

function isSecureRequest(req) {
  const xfProto = (req.headers['x-forwarded-proto'] || '').toString().split(',')[0].trim().toLowerCase();
  return req.socket.encrypted || xfProto === 'https';
}

function sessionCookie(name, value, maxAgeSec, req) {
  const parts = [`${name}=${value}`, 'HttpOnly', 'SameSite=Strict', 'Path=/', `Max-Age=${maxAgeSec}`];
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

// ── Static file serving ───────────────────────────────────────────────────────

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

  // For the main SPA (served from dist/), check dist/assets/ before falling back to assets/
  const distRoot = rootFile.startsWith('/dist/');
  const candidates = [];
  if (distRoot && safePath.startsWith('/assets/')) {
    candidates.push(path.join(__dirname, 'dist', safePath));
  }
  candidates.push(path.join(__dirname, safePath));

  const tryRead = (paths, idx) => {
    if (idx >= paths.length) { res.writeHead(404); return res.end('Not found'); }
    const filePath = paths[idx];
    if (!filePath.startsWith(__dirname)) { res.writeHead(403); return res.end('Forbidden'); }
    fs.readFile(filePath, (err, data) => {
      if (err) return tryRead(paths, idx + 1);
      const ext = path.extname(filePath).toLowerCase();
      const types = { '.html': 'text/html', '.jsx': 'text/javascript', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff': 'font/woff', '.woff2': 'font/woff2' };
      const isImmutable = /\.(js|css|png|jpg|jpeg|webp|gif|svg|ico|woff2?)$/.test(ext);
      const cacheHeader = isImmutable
        ? 'public, max-age=31536000, immutable'
        : 'no-cache, must-revalidate';
      const isHtml = ext === '.html';
      const securityHeaders = isHtml ? {
        'X-Frame-Options': 'SAMEORIGIN',
        'X-Content-Type-Options': 'nosniff',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
        'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self'; frame-ancestors 'none';",
      } : { 'X-Content-Type-Options': 'nosniff' };
      res.writeHead(200, {
        'Content-Type': (types[ext] || 'application/octet-stream') + '; charset=utf-8',
        'Cache-Control': cacheHeader,
        ...securityHeaders,
      });
      res.end(data);
    });
  };
  tryRead(candidates, 0);
}

// Read once at startup so per-request file I/O can't fail
const MAINTENANCE_HTML = (() => {
  try { return fs.readFileSync(path.join(__dirname, 'dist', 'maintenance.html'), 'utf8'); }
  catch (e) { console.error('[maintenance] could not read dist/maintenance.html:', e.message); return null; }
})();

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
  // Always handle the status poll so the maintenance page can detect when to redirect
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

  // Let the favicon through so the maintenance page can render it
  if (url.pathname === '/favicon.png' || url.pathname === '/favicon.ico') return false;

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
]);

// ── Email ─────────────────────────────────────────────────────────────────────

const nodemailer = require('nodemailer');

let _mailer = null;
function getMailer() {
  if (!_mailer && SMTP_HOST && SMTP_USER && SMTP_PASS) {
    _mailer = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_PORT === 465,
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    });
  }
  return _mailer;
}

async function sendEmail({ to, subject, html }) {
  if (!to) return;
  const transport = getMailer();
  if (!transport) return;
  const text = html.replace(/<[^>]+>/g, '').replace(/\n{3,}/g, '\n\n').trim();
  try {
    await transport.sendMail({ from: FROM_ADDRESS, to, subject, html, text });
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
  const name = customerName ? `, ${customerName.split(' ')[0]}` : '';
  return {
    subject: `Order confirmed — ${orderId}`,
    html: emailHtml('Order confirmed', `
      <p>Thanks${name}! Your payment was received and your order has been logged.</p>
      <div class="detail">
        <dt>ORDER</dt><dd>${orderId}</dd>
        ${items ? `<dt>ITEMS</dt><dd>${items}</dd>` : ''}
        <dt>AMOUNT PAID</dt><dd>$${Number(amountAud).toLocaleString('en-AU', {minimumFractionDigits:2})} AUD</dd>
      </div>
      <p>Our team will be in touch shortly. For pickups or repairs, please bring this confirmation.</p>
      <a class="btn" href="${SITE_URL}/orders">View your orders →</a>
    `),
  };
}

function emailQuoteReceived({ quoteId, customerName, description }) {
  return {
    subject: `Quote request received — ${quoteId}`,
    html: emailHtml('We\'ve got your quote request', `
      <p>Hi${customerName ? ` ${customerName.split(' ')[0]}` : ''},</p>
      <p>Thanks for reaching out. We've received your quote request and will get back to you as soon as possible.</p>
      <div class="detail">
        <dt>REFERENCE</dt><dd>${quoteId}</dd>
        <dt>YOUR REQUEST</dt><dd>${description}</dd>
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
      <p>Hi${customerName ? ` ${customerName.split(' ')[0]}` : ''},</p>
      <p>We've reviewed your request and have an update for you.</p>
      <div class="detail">
        <dt>REFERENCE</dt><dd>${quoteId}</dd>
        <dt>STATUS</dt><dd>${statusLabel}</dd>
        <dt>MESSAGE FROM US</dt><dd>${reply}</dd>
      </div>
      <p>If you have questions or want to go ahead, reply to this email or get in touch via the portal.</p>
      <a class="btn" href="${SITE_URL}/portal">View in portal →</a>
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
      <p>Hi${customerName ? ` ${customerName.split(' ')[0]}` : ''},</p>
      <p>Your eWaste intake request has been received. We'll arrange collection or drop-off and handle everything responsibly.</p>
      <div class="detail">
        <dt>REFERENCE</dt><dd>${intakeId}</dd>
        ${description ? `<dt>ITEMS</dt><dd>${description}</dd>` : ''}
      </div>
      <p>We'll be in touch to confirm next steps.</p>
    `),
  };
}

function emailMembershipWelcome({ customerName, tierName }) {
  return {
    subject: `Welcome to ${tierName} membership`,
    html: emailHtml(`Welcome to ${tierName}!`, `
      <p>Hi${customerName ? ` ${customerName.split(' ')[0]}` : ''},</p>
      <p>You're now a <strong>${tierName}</strong> member of Outback Electronics. Thanks for your support!</p>
      <p>Your membership benefits are active immediately. Log in to the portal to see what's available to you.</p>
      <a class="btn" href="${SITE_URL}/portal">Go to portal →</a>
    `),
  };
}

function emailMembershipCancelled({ customerName, tierName }) {
  return {
    subject: 'Membership cancelled',
    html: emailHtml('Membership cancelled', `
      <p>Hi${customerName ? ` ${customerName.split(' ')[0]}` : ''},</p>
      <p>Your <strong>${tierName}</strong> membership has been cancelled. You'll retain access until the end of your current period.</p>
      <p>If this was a mistake or you'd like to resubscribe, just log back into the portal.</p>
      <a class="btn" href="${SITE_URL}/portal">Return to portal →</a>
    `),
  };
}

function emailPortalWelcome({ username, displayName }) {
  return {
    subject: 'Welcome to Outback Electronics',
    html: emailHtml('Welcome!', `
      <p>Hi ${displayName || username},</p>
      <p>Your Outback Electronics account is ready. You can now track repairs, request quotes, and manage your membership from the portal.</p>
      <a class="btn" href="${SITE_URL}/portal">Go to your portal →</a>
    `),
  };
}

function emailPasswordReset({ displayName, resetUrl }) {
  return {
    subject: 'Reset your password — Outback Electronics',
    html: emailHtml('Reset your password', `
      <p>Hi ${displayName},</p>
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
        <dt>ORDER</dt><dd>${orderId}</dd>
        <dt>CUSTOMER</dt><dd>${customerName || '—'}</dd>
        ${items ? `<dt>ITEMS</dt><dd>${items}</dd>` : ''}
        <dt>AMOUNT</dt><dd>$${Number(amountAud).toLocaleString('en-AU', {minimumFractionDigits:2})} AUD</dd>
      </div>
      <a class="btn" href="${ADMIN_URL}/admin#orders">View in admin →</a>
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
      <a class="btn" href="${ADMIN_URL}/admin#quotes">View in admin →</a>
    `),
  };
}

function emailStaffNewEwaste({ intakeId, name, email, description }) {
  return {
    subject: `[EWASTE] New intake — ${intakeId}`,
    html: emailHtml('New eWaste intake', `
      <div class="detail">
        <dt>REFERENCE</dt><dd>${intakeId}</dd>
        <dt>FROM</dt><dd>${name || '—'}${email ? ` &lt;${email}&gt;` : ''}</dd>
        ${description ? `<dt>ITEMS</dt><dd>${description}</dd>` : ''}
      </div>
      <a class="btn" href="${ADMIN_URL}/admin#ewaste">View in admin →</a>
    `),
  };
}

function emailStaffContactMessage({ name, email, msg }) {
  return {
    subject: `[CONTACT] Message from ${name}`,
    html: emailHtml('New contact message', `
      <div class="detail">
        <dt>FROM</dt><dd>${escHtml(name)} &lt;${escHtml(email)}&gt;</dd>
        <dt>MESSAGE</dt><dd>${escHtml(msg)}</dd>
      </div>
      <p>Reply directly to this email to respond to the customer.</p>
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
      <a class="btn" href="${SITE_URL}/shop">Shop now →</a>
      <p style="margin-top:16px;font-size:12px;color:#8b7e69">To check your balance at any time, visit <a href="${SITE_URL}/gift-cards" style="color:#1f88f5">${SITE_URL}/gift-cards</a> and enter your code.</p>
    `),
  };
}

// ── Stripe helpers ────────────────────────────────────────────────────────────

function stripeRequest(method, path, params) {
  return new Promise((resolve, reject) => {
    const body = params ? new URLSearchParams(params).toString() : '';
    const req = https.request({
      hostname: 'api.stripe.com',
      path,
      method,
      headers: {
        'Authorization': `Bearer ${STRIPE_SECRET_KEY}`,
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

// ── Main server (8080) ────────────────────────────────────────────────────────

const mainServer = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (checkMaintenance(req, res, url)) return;

  if (req.method === 'GET' && url.pathname === '/api/csrf-token') {
    const token = ensureCsrfCookie(req, res);
    return json(res, 200, { token });
  }

  if (req.method === 'POST' && url.pathname !== '/api/stripe/webhook') {
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
    return json(res, 200, { items: readTutorials().filter(i => i.status === 'Published') });
  }
  if (req.method === 'GET' && url.pathname === '/api/ai') {
    return json(res, 200, readAI());
  }
  if (req.method === 'GET' && url.pathname === '/api/groups') {
    return json(res, 200, { items: readGroups() });
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
    const { shop } = readSettings();
    return json(res, 200, { shop });
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

  // ── Stripe: session lookup (for success page) ───────────────────────────────
  if (req.method === 'GET' && url.pathname === '/api/checkout/session') {
    if (!STRIPE_SECRET_KEY) return json(res, 503, { error: 'stripe_not_configured' });
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
    if (publicRateLimited(getIp(req), 'checkout')) return json(res, 429, { error: 'too_many_requests' });
    if (!STRIPE_SECRET_KEY) return json(res, 503, { error: 'stripe_not_configured' });
    let body; try { body = await readJson(req); } catch { return json(res, 400, { error: 'invalid_json' }); }

    const { productId, name, priceAud, quantity = 1, customerEmail, items, giftCardCode } = body;

    // Normalise to a line-items array (multi-item cart or legacy single-item)
    const lineItems = Array.isArray(items) && items.length > 0
      ? items
      : (name && priceAud ? [{ name, priceAud, quantity, productId: productId || '' }] : null);
    if (!lineItems) return json(res, 422, { error: 'missing_fields', message: 'items array or name+priceAud required' });

    // Validate and apply gift card if provided
    let gcDiscount = 0;
    let gcCodeNorm = '';
    if (giftCardCode) {
      gcCodeNorm = String(giftCardCode).trim().toUpperCase();
      const gcList = readGiftCards();
      const gc = gcList.find(c => c.code === gcCodeNorm && !c.isVoid && c.balance > 0);
      if (!gc) return json(res, 422, { error: 'invalid_gift_card', message: 'Gift card code is invalid, already used, or has no remaining balance.' });
      const cartTotal = lineItems.reduce((s, li) => s + Math.round(Number(li.priceAud) * 100) * (li.quantity || 1), 0) / 100;
      gcDiscount = Math.min(gc.balance, cartTotal);
    }

    const params = {
      'mode': 'payment',
      'success_url': `${SITE_URL}/order-success?session_id={CHECKOUT_SESSION_ID}`,
      'cancel_url': `${SITE_URL}/order-cancelled`,
      'payment_intent_data[metadata][source]': 'website',
    };
    if (gcCodeNorm) params['payment_intent_data[metadata][giftCardCode]'] = gcCodeNorm;
    if (gcDiscount > 0) params['payment_intent_data[metadata][giftCardDiscount]'] = String(gcDiscount);

    // Store gift card product IDs so the webhook can issue codes (max 500 chars in metadata)
    const gcProductIds = lineItems
      .filter(li => String(li.productId || '').startsWith('gc-'))
      .flatMap(li => Array(li.quantity || 1).fill(`${li.productId}:${li.priceAud}`));
    if (gcProductIds.length > 0) params['payment_intent_data[metadata][gcItems]'] = gcProductIds.join(',').slice(0, 500);

    // Build line items; if a gift card covers the full amount, add a $0.50 minimum line item
    // so Stripe doesn't reject a $0 session — instead we add a discount coupon approach via negative line item
    const adjustedLineItems = [...lineItems];
    if (gcDiscount > 0) {
      adjustedLineItems.push({
        name: `Gift Card (${gcCodeNorm})`,
        priceAud: -gcDiscount,
        quantity: 1,
        productId: '',
      });
    }
    // Stripe doesn't support negative unit_amount; use a free line item workaround:
    // we compute net total and replace all line items with a single "Order total" line when a GC is applied
    let finalLineItems = adjustedLineItems;
    if (gcDiscount > 0) {
      const grossCents = lineItems.reduce((s, li) => s + Math.round(Number(li.priceAud) * 100) * (li.quantity || 1), 0);
      const netCents = Math.max(50, grossCents - Math.round(gcDiscount * 100)); // Stripe min 50c
      finalLineItems = [{ name: 'Outback Electronics Order', priceAud: netCents / 100, quantity: 1, productId: lineItems.length === 1 ? (lineItems[0].productId || '') : '' }];
    }

    finalLineItems.forEach((li, idx) => {
      params[`line_items[${idx}][price_data][currency]`] = 'aud';
      params[`line_items[${idx}][price_data][unit_amount]`] = String(Math.round(Number(li.priceAud) * 100));
      params[`line_items[${idx}][price_data][product_data][name]`] = li.name;
      params[`line_items[${idx}][quantity]`] = String(li.quantity || 1);
    });
    if (lineItems.length === 1) params['payment_intent_data[metadata][productId]'] = lineItems[0].productId || '';
    if (customerEmail) params['customer_email'] = customerEmail;

    const resp = await stripeRequest('POST', '/v1/checkout/sessions', params).catch(() => null);
    if (!resp || resp.status !== 200) return json(res, 502, { error: 'stripe_error' });
    return json(res, 200, { url: resp.body.url, sessionId: resp.body.id });
  }

  // ── Stripe: webhook ──────────────────────────────────────────────────────────
  if (req.method === 'POST' && url.pathname === '/api/stripe/webhook') {
    const sig = req.headers['stripe-signature'];
    if (!sig || !STRIPE_WEBHOOK_SECRET) return json(res, 400, { error: 'missing_signature' });

    const rawBody = await readRawBody(req);
    let valid = false;
    try { valid = verifyStripeSignature(rawBody, sig, STRIPE_WEBHOOK_SECRET); } catch (err) {
      console.error('Stripe signature verification error:', err);
    }
    if (!valid) return json(res, 400, { error: 'invalid_signature' });

    let event;
    try { event = JSON.parse(rawBody.toString()); } catch { return json(res, 400, { error: 'invalid_json' }); }

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const details = session.customer_details || {};
      const amountAud = (session.amount_total || 0) / 100;
      const meta = session.payment_intent_metadata || session.metadata || {};
      const productId = meta.productId || '';
      const gcCode = meta.giftCardCode || '';
      const gcDiscount = Number(meta.giftCardDiscount || 0);

      const order = {
        id: `stripe-${session.id}`,
        stripeSessionId: session.id,
        cust: details.name || details.email || 'Online customer',
        loc: [details.address?.city, details.address?.country].filter(Boolean).join(', ') || '',
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
      if (!orders.find(o => o.stripeSessionId === session.id)) {
        orders.push(order);
        writeOrders(orders);

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

        const customerEmail = details.email;
        if (customerEmail) {
          const tmpl = emailOrderConfirmation({ orderId: order.id, customerName: details.name, amountAud: order.total, items: order.items });
          sendEmail({ to: customerEmail, ...tmpl });
        }
        const staffTmpl = emailStaffNewOrder({ orderId: order.id, customerName: details.name || details.email, amountAud: order.total, items: order.items });
        sendEmail({ to: NOTIFY_EMAIL, ...staffTmpl });
      }
    }

    return json(res, 200, { received: true });
  }

  // ── Gift card: balance lookup ────────────────────────────────────────────────
  if (req.method === 'GET' && url.pathname === '/api/gift-card/balance') {
    const code = (url.searchParams.get('code') || '').trim().toUpperCase();
    if (!code) return json(res, 400, { error: 'missing_code' });
    const gc = readGiftCards().find(c => c.code === code);
    if (!gc) return json(res, 404, { error: 'not_found' });
    if (gc.isVoid) return json(res, 200, { code: gc.code, balance: 0, originalBalance: gc.originalBalance, isVoid: true });
    return json(res, 200, { code: gc.code, balance: gc.balance, originalBalance: gc.originalBalance, isVoid: false });
  }

  // ── Gift card: apply (validate + preview discount) ───────────────────────────
  if (req.method === 'POST' && url.pathname === '/api/gift-card/apply') {
    let body; try { body = await readJson(req); } catch { return json(res, 400, { error: 'invalid_json' }); }
    const code = (body.code || '').trim().toUpperCase();
    const cartTotal = Number(body.cartTotal) || 0;
    if (!code) return json(res, 400, { error: 'missing_code' });
    const gc = readGiftCards().find(c => c.code === code && !c.isVoid && c.balance > 0);
    if (!gc) return json(res, 422, { error: 'invalid_gift_card', message: 'Gift card code is invalid, already used, or has no remaining balance.' });
    const discount = cartTotal > 0 ? Math.min(gc.balance, cartTotal) : gc.balance;
    return json(res, 200, { valid: true, code: gc.code, balance: gc.balance, discount });
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
    sendEmail({ to: NOTIFY_EMAIL, ...staffTmpl });
    return json(res, 201, { ok: true, id: quote.id });
  }

  if (req.method === 'POST' && url.pathname === '/api/contact/quick-message') {
    if (publicRateLimited(getIp(req), 'contact/quick-message')) return json(res, 429, { error: 'too_many_requests' });
    let body; try { body = await readJson(req); } catch { return json(res, 400, { error: 'invalid_json' }); }
    const { name, email, msg } = body || {};
    if (!name || !email || !msg) return json(res, 422, { error: 'missing_fields' });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim())) return json(res, 422, { error: 'invalid_email', message: 'Email address is invalid.' });
    const tmpl = emailStaffContactMessage({ name, email, msg });
    sendEmail({ to: NOTIFY_EMAIL, replyTo: email, ...tmpl });
    return json(res, 200, { ok: true });
  }

  if (req.method === 'GET' && url.pathname === '/api/settings') {
    const s = readSettings();
    return json(res, 200, { siteContent: s.siteContent });
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

  return serveStatic(req, res, url.pathname, '/dist/index.html', MAIN_SPA_ROUTES);
});

// ── Forum server (8081) ───────────────────────────────────────────────────────

const forumServer = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (checkMaintenance(req, res, url)) return;

  if (req.method === 'GET' && url.pathname === '/api/csrf-token') {
    const token = ensureCsrfCookie(req, res);
    return json(res, 200, { token });
  }

  if (req.method === 'POST') {
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
    return json(res, 200, { thread, posts: forum.posts.filter(p => p.threadId === threadId) });
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

  if (req.method === 'POST' && url.pathname.startsWith('/api/forum/posts/') && url.pathname.split('/').length === 5 && url.pathname.split('/')[4] === 'like') {
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

  if (req.method === 'POST' && url.pathname === '/api/forum/auth/register') {
    if (publicRateLimited(getIp(req), 'register')) return json(res, 429, { error: 'too_many_requests' });
    let body; try { body = await readJson(req); } catch { return json(res, 400, { error: 'invalid_json' }); }
    if (!body || typeof body !== 'object') return json(res, 422, { error: 'invalid_payload', message: 'Payload must be a JSON object.' });
    const username = typeof body.username === 'string' ? body.username : '';
    const password = typeof body.password === 'string' ? body.password : '';
    const displayName = typeof body.displayName === 'string' ? body.displayName.trim() : '';
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    if (!/^[a-zA-Z0-9_]{3,30}$/.test(username)) return json(res, 422, { error: 'invalid_payload', message: 'Username must be 3–30 characters, letters, numbers and underscores only.' });
    if (password.length < 8) return json(res, 422, { error: 'invalid_payload', message: 'Password must be at least 8 characters.' });
    const resolvedDisplayName = displayName || username;
    if (resolvedDisplayName.length > 50) return json(res, 422, { error: 'invalid_payload', message: 'Display name must be 50 characters or fewer.' });
    const forum = readForum();
    if (!Array.isArray(forum.users)) forum.users = [];
    if (forum.users.find(u => u.username && u.username.toLowerCase() === username.toLowerCase())) {
      return json(res, 409, { error: 'username_taken', message: 'That username is already taken.' });
    }
    const user = { id: 'U-' + Date.now(), username, displayName: resolvedDisplayName, email, passwordHash: hashPassword(password), createdAt: new Date().toISOString() };
    forum.users.push(user);
    writeForum(forum);
    const sid = randomId();
    forumSessions.set(sid, { id: user.id, username: user.username, displayName: user.displayName, createdAt: user.createdAt, expiresAt: now() + FORUM_SESSION_TTL_MS });
    saveSessionsToDisk(FORUM_SESSIONS_DB_PATH, forumSessions);
    res.setHeader('Set-Cookie', sessionCookie('oe_forum_session', sid, Math.floor(FORUM_SESSION_TTL_MS / 1000), req));
    return json(res, 201, { ok: true, user: { id: user.id, username: user.username, displayName: user.displayName, createdAt: user.createdAt } });
  }

  if (req.method === 'POST' && url.pathname === '/api/forum/auth/login') {
    let body; try { body = await readJson(req); } catch { return json(res, 400, { error: 'invalid_json' }); }
    const username = typeof body?.username === 'string' ? body.username : '';
    const password = typeof body?.password === 'string' ? body.password : '';
    const forum = readForum();
    if (!Array.isArray(forum.users)) forum.users = [];
    const user = forum.users.find(u => u.username && u.username.toLowerCase() === username.toLowerCase());
    if (!user || !user.passwordHash || !verifyPassword(password, user.passwordHash)) {
      return json(res, 401, { ok: false, message: 'Invalid username or password.' });
    }
    const sid = randomId();
    forumSessions.set(sid, { id: user.id, username: user.username, displayName: user.displayName, createdAt: user.createdAt, expiresAt: now() + FORUM_SESSION_TTL_MS });
    saveSessionsToDisk(FORUM_SESSIONS_DB_PATH, forumSessions);
    res.setHeader('Set-Cookie', sessionCookie('oe_forum_session', sid, Math.floor(FORUM_SESSION_TTL_MS / 1000), req));
    return json(res, 200, { ok: true, user: { id: user.id, username: user.username, displayName: user.displayName, createdAt: user.createdAt } });
  }

  if (req.method === 'POST' && url.pathname === '/api/forum/auth/logout') {
    const forumSession = getForumSession(req);
    if (forumSession) { forumSessions.delete(forumSession.sid); saveSessionsToDisk(FORUM_SESSIONS_DB_PATH, forumSessions); }
    res.setHeader('Set-Cookie', sessionCookie('oe_forum_session', '', 0, req));
    return json(res, 200, { ok: true });
  }

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
      const resetUrl = `${FORUM_URL}?reset=${token}`;
      const tmpl = emailPasswordReset({ displayName: user.displayName || user.username, resetUrl });
      sendEmail({ to: user.email, ...tmpl });
    }
    return json(res, 200, { ok: true });
  }

  if (req.method === 'POST' && url.pathname === '/api/forum/auth/reset-password') {
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
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === 'GET' && url.pathname === '/api/csrf-token') {
    const token = ensureCsrfCookie(req, res);
    return json(res, 200, { token });
  }

  if (req.method === 'POST') {
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
    const adminPassOk = ADMIN_PASSWORD_HASH !== null &&
      body.username === ADMIN_USERNAME &&
      verifyPassword(suppliedPass, ADMIN_PASSWORD_HASH);
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
    return json(res, 200, readCatalog());
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

  if (req.method === 'GET' && url.pathname === '/api/admin/orders') {
    const session = requireRole(req, res, 'staff'); if (!session) return;
    return json(res, 200, { items: readOrders() });
  }
  if (req.method === 'GET' && url.pathname === '/api/admin/metrics') {
    const session = requireRole(req, res, 'staff'); if (!session) return;
    return json(res, 200, buildAdminMetrics());
  }
  if (req.method === 'GET' && url.pathname === '/api/admin/customers') {
    const session = requireRole(req, res, 'staff'); if (!session) return;
    return json(res, 200, { items: readCustomers() });
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
    return json(res, 200, readForum());
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
    return json(res, 200, { siteContent: s.siteContent });
  }
  if (req.method === 'GET' && url.pathname === '/api/admin/settings') {
    const session = requireRole(req, res, 'staff'); if (!session) return;
    return json(res, 200, readSettings());
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
      const ALLOWED_MIME = new Set([
        'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
        'application/pdf',
      ]);
      const ALLOWED_EXT = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.pdf']);
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
    try { fs.unlinkSync(path.join(__dirname, 'assets/uploads', body.filename)); } catch {}
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
    }
    if (idx >= 0) { products[idx] = body; } else { body.id = 'prod-' + Date.now(); products.push(body); }
    writeProducts(products);
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
    const idx = orders.findIndex(o => o.id && o.id === body.id);
    if (idx >= 0) { orders[idx] = body; } else { body.id = 'ord-' + Date.now(); orders.push(body); }
    writeOrders(orders);
    return json(res, 200, { ok: true, item: body });
  }
  if (req.method === 'POST' && url.pathname === '/api/admin/orders/delete') {
    const session = requireRole(req, res, 'manager'); if (!session) return;
    let body; try { body = await readJson(req); } catch { return json(res, 400, { error: 'invalid_json' }); }
    writeOrders(readOrders().filter(o => o.id !== body.id));
    return json(res, 200, { ok: true });
  }

  if (req.method === 'POST' && url.pathname === '/api/admin/customers/save') {
    const session = requireRole(req, res, 'manager'); if (!session) return;
    let body; try { body = await readJson(req); } catch { return json(res, 400, { error: 'invalid_json' }); }
    const customers = readCustomers();
    const idx = customers.findIndex(c => c.id && c.id === body.id);
    if (idx >= 0) { customers[idx] = body; } else { body.id = 'cust-' + Date.now(); customers.push(body); }
    writeCustomers(customers);
    return json(res, 200, { ok: true, item: body });
  }
  if (req.method === 'POST' && url.pathname === '/api/admin/customers/delete') {
    const session = requireRole(req, res, 'manager'); if (!session) return;
    let body; try { body = await readJson(req); } catch { return json(res, 400, { error: 'invalid_json' }); }
    writeCustomers(readCustomers().filter(c => c.id !== body.id));
    return json(res, 200, { ok: true });
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
      sendEmail({ to: NOTIFY_EMAIL, ...staffTmpl });
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
    const payload = { shop: body.shop || {}, announcement: body.announcement || { text: '', enabled: false, expiresAt: '' }, maintenance: body.maintenance || { enabled: false }, staff: body.staff || [], integrations: body.integrations || [], siteContent: body.siteContent || {} };
    writeSettings(payload);
    return json(res, 200, { ok: true, ...payload });
  }

  if (req.method === 'POST' && url.pathname === '/api/admin/maintenance') {
    const session = requireAdmin(req, res); if (!session) return;
    let body; try { body = await readJson(req); } catch { return json(res, 400, { error: 'invalid_json' }); }
    const enabled = body.enabled === true;
    const s = readSettings();
    writeSettings({ ...s, maintenance: { enabled } });
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

  if (req.method === 'GET' && url.pathname === '/api/admin/staff') {
    const session = requireRole(req, res, 'staff'); if (!session) return;
    return json(res, 200, readStaff());
  }
  if (req.method === 'GET' && url.pathname === '/api/admin/staff/stats') {
    const session = requireRole(req, res, 'staff'); if (!session) return;
    const data = readStaff();
    const stats = data.members.map(m => buildStaffStats(m.id, data));
    return json(res, 200, { stats });
  }
  if (req.method === 'POST' && url.pathname === '/api/admin/staff/members/save') {
    const session = requireAdmin(req, res); if (!session) return;
    let body; try { body = await readJson(req); } catch { return json(res, 400, { error: 'invalid_json' }); }
    if (!body || typeof body.name !== 'string' || !body.name.trim()) return json(res, 422, { error: 'invalid_payload', message: 'Field "name" is required.' });
    if (typeof body.pin === 'string' && body.pin.length > 0) {
      if (!/^\d{4,6}$/.test(body.pin)) return json(res, 422, { error: 'invalid_payload', message: 'PIN must be 4–6 digits.' });
      body.pinHash = hashPassword(body.pin);
    }
    delete body.pin;
    const data = readStaff();
    const idx = data.members.findIndex(m => m.id && m.id === body.id);
    if (idx >= 0) { data.members[idx] = body; } else { body.id = 'staff-' + Date.now(); data.members.push(body); }
    writeStaff(data);
    return json(res, 200, { ok: true, item: body });
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
        }
      });
    });
    return json(res, 200, { ok: true });
  }

  if (url.pathname === '/admin-login.html' || url.pathname === '/') {
    const ip = getIp(req);
    if (!isIpAllowed(ip)) return json(res, 403, { error: 'forbidden' });
  }

  return serveStatic(req, res, url.pathname, '/dist/admin-login.html', null);
});

// ── Portal server (8083) ──────────────────────────────────────────────────────

const PORTAL_CORS_ORIGIN = process.env.SITE_URL || `http://localhost:${MAIN_PORT}`;

const portalServer = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (checkMaintenance(req, res, url)) return;

  // CORS for cross-origin endpoints (portal runs on a different port/origin)
  const crossOriginPaths = ['/api/portal/auth/logout', '/api/portal/auth/me', '/api/csrf-token'];
  if (crossOriginPaths.includes(url.pathname) || url.pathname.startsWith('/api/portal/')) {
    res.setHeader('Access-Control-Allow-Origin', PORTAL_CORS_ORIGIN);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-CSRF-Token');
  }

  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }

  if (req.method === 'GET' && url.pathname === '/api/csrf-token') {
    const token = ensureCsrfCookie(req, res);
    return json(res, 200, { token });
  }

  if (req.method === 'POST') {
    if (!verifyCsrf(req, res)) return;
  }

  if (req.method === 'GET' && url.pathname === '/api/portal/auth/me') {
    const session = getPortalSession(req);
    if (!session) return json(res, 200, { user: null });
    return json(res, 200, { user: { id: session.id, username: session.username, displayName: session.displayName, createdAt: session.createdAt } });
  }

  if (req.method === 'POST' && url.pathname === '/api/portal/auth/login') {
    const ip = getIp(req);
    const portalKey = `portal:${ip}`;
    const lockEntry = loginAttempts.get(portalKey);
    if (lockEntry && lockEntry.lockedUntil && lockEntry.lockedUntil > now()) {
      const retryAfterSec = Math.ceil((lockEntry.lockedUntil - now()) / 1000);
      res.setHeader('Retry-After', retryAfterSec);
      return json(res, 429, { error: 'locked_out', retryAfterSec });
    }
    let body; try { body = await readJson(req); } catch { return json(res, 400, { error: 'invalid_json' }); }
    const username = typeof body?.username === 'string' ? body.username : '';
    const password = typeof body?.password === 'string' ? body.password : '';
    const forum = readForum();
    if (!Array.isArray(forum.users)) forum.users = [];
    const user = forum.users.find(u => u.username && u.username.toLowerCase() === username.toLowerCase());
    if (!user || !user.passwordHash || !verifyPassword(password, user.passwordHash)) {
      trackFailure(portalKey);
      return json(res, 401, { ok: false, message: 'Invalid username or password.' });
    }
    loginAttempts.delete(portalKey);
    const sid = randomId();
    portalSessions.set(sid, { id: user.id, username: user.username, displayName: user.displayName, createdAt: user.createdAt, expiresAt: now() + PORTAL_SESSION_TTL_MS });
    saveSessionsToDisk(PORTAL_SESSIONS_DB_PATH, portalSessions);
    res.setHeader('Set-Cookie', sessionCookie('oe_portal_session', sid, Math.floor(PORTAL_SESSION_TTL_MS / 1000), req));
    return json(res, 200, { ok: true, user: { id: user.id, username: user.username, displayName: user.displayName, createdAt: user.createdAt } });
  }

  if (req.method === 'POST' && url.pathname === '/api/portal/auth/register') {
    if (publicRateLimited(getIp(req), 'register')) return json(res, 429, { error: 'too_many_requests' });
    let body; try { body = await readJson(req); } catch { return json(res, 400, { error: 'invalid_json' }); }
    if (!body || typeof body !== 'object') return json(res, 422, { error: 'invalid_payload', message: 'Payload must be a JSON object.' });
    const username = typeof body.username === 'string' ? body.username : '';
    const password = typeof body.password === 'string' ? body.password : '';
    const displayName = typeof body.displayName === 'string' ? body.displayName.trim() : '';
    if (!/^[a-zA-Z0-9_]{3,30}$/.test(username)) return json(res, 422, { error: 'invalid_payload', message: 'Username must be 3–30 characters, letters, numbers and underscores only.' });
    if (password.length < 8) return json(res, 422, { error: 'invalid_payload', message: 'Password must be at least 8 characters.' });
    const resolvedDisplayName = displayName || username;
    if (resolvedDisplayName.length > 50) return json(res, 422, { error: 'invalid_payload', message: 'Display name must be 50 characters or fewer.' });
    const forum = readForum();
    if (!Array.isArray(forum.users)) forum.users = [];
    if (forum.users.find(u => u.username && u.username.toLowerCase() === username.toLowerCase())) {
      return json(res, 409, { error: 'username_taken', message: 'That username is already taken.' });
    }
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const user = { id: 'U-' + Date.now(), username, displayName: resolvedDisplayName, email, passwordHash: hashPassword(password), createdAt: new Date().toISOString() };
    forum.users.push(user);
    writeForum(forum);
    const sid = randomId();
    portalSessions.set(sid, { id: user.id, username: user.username, displayName: user.displayName, createdAt: user.createdAt, expiresAt: now() + PORTAL_SESSION_TTL_MS });
    saveSessionsToDisk(PORTAL_SESSIONS_DB_PATH, portalSessions);
    res.setHeader('Set-Cookie', sessionCookie('oe_portal_session', sid, Math.floor(PORTAL_SESSION_TTL_MS / 1000), req));
    if (email) {
      const tmpl = emailPortalWelcome({ username: user.username, displayName: user.displayName });
      sendEmail({ to: email, ...tmpl });
    }
    return json(res, 201, { ok: true, user: { id: user.id, username: user.username, displayName: user.displayName, createdAt: user.createdAt } });
  }

  if (req.method === 'POST' && url.pathname === '/api/portal/auth/logout') {
    const session = getPortalSession(req);
    if (session) { portalSessions.delete(session.sid); saveSessionsToDisk(PORTAL_SESSIONS_DB_PATH, portalSessions); }
    res.setHeader('Set-Cookie', sessionCookie('oe_portal_session', '', 0, req));
    return json(res, 200, { ok: true });
  }

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

  if (req.method === 'GET' && url.pathname === '/api/portal/orders') {
    const session = getPortalSession(req);
    if (!session) return json(res, 401, { error: 'login_required' });
    const orders = readOrders();
    const uname = session.username.toLowerCase();
    const matched = orders.filter(o => {
      const customer = String(o.customer || o.name || '').toLowerCase();
      const email = String(o.email || '').toLowerCase();
      return customer === uname || email === uname;
    });
    return json(res, 200, { items: matched });
  }

  if (req.method === 'GET' && url.pathname === '/api/portal/repairs') {
    const session = getPortalSession(req);
    if (!session) return json(res, 401, { error: 'login_required' });
    const repairs = readRepairs();
    const allCards = (repairs.columns || []).flatMap(col =>
      (col.cards || []).map(card => ({ ...card, column: col.title || col.id }))
    );
    const uname = session.username.toLowerCase();
    const forum = readForum();
    const portalUser = Array.isArray(forum.users) ? forum.users.find(u => u.id === session.id) : null;
    const sessionEmail = portalUser ? String(portalUser.email || '').toLowerCase() : '';
    const matched = allCards.filter(c => {
      const customer = String(c.customer || c.name || c.title || '').toLowerCase();
      const cardEmail = String(c.email || '').toLowerCase();
      return customer === uname || (sessionEmail && cardEmail && cardEmail === sessionEmail);
    });
    return json(res, 200, { items: matched });
  }

  if (req.method === 'GET' && url.pathname === '/api/portal/quotes') {
    const session = getPortalSession(req);
    if (!session) return json(res, 401, { error: 'login_required' });
    const quotes = readQuotes();
    const uname = session.username.toLowerCase();
    const matched = quotes.filter(q => {
      const name = String(q.name || q.customer || '').toLowerCase();
      const email = String(q.email || '').toLowerCase();
      return name === uname || email === uname;
    });
    return json(res, 200, { items: matched });
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
    const quote = {
      id: 'quot-' + Date.now(),
      name: body.name || session.displayName || session.username,
      email: body.email.trim(),
      description: body.description.trim(),
      status: 'new',
      createdAt: new Date().toISOString(),
      portalUser: session.username,
    };
    quotes.push(quote);
    writeQuotes(quotes);
    const custTmpl = emailQuoteReceived({ quoteId: quote.id, customerName: quote.name, description: quote.description });
    sendEmail({ to: quote.email, ...custTmpl });
    const staffTmpl = emailStaffNewQuote({ quoteId: quote.id, name: quote.name, email: quote.email, description: quote.description });
    sendEmail({ to: NOTIFY_EMAIL, ...staffTmpl });
    return json(res, 201, { ok: true, item: quote });
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
      const resetUrl = `${PORTAL_URL}?reset=${token}`;
      const tmpl = emailPasswordReset({ displayName: user.displayName || user.username, resetUrl });
      sendEmail({ to: user.email, ...tmpl });
    }
    return json(res, 200, { ok: true });
  }

  if (req.method === 'POST' && url.pathname === '/api/portal/auth/reset-password') {
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

  return serveStatic(req, res, url.pathname, '/dist/portal.html', null);
});

// ── Games server (8084) ───────────────────────────────────────────────────────

const gamesServer = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (checkMaintenance(req, res, url)) return;

  return serveStatic(req, res, url.pathname, '/dist/games.html', null);
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

startServer(mainServer,   MAIN_PORT,   'main  ');
startServer(forumServer,  FORUM_PORT,  'forum ');
startServer(adminServer,  ADMIN_PORT,  'admin ');
startServer(portalServer, PORTAL_PORT, 'portal');
startServer(gamesServer,  GAMES_PORT,  'games ');
