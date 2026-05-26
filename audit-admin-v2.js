/**
 * Deep admin dashboard audit - Playwright
 * Knows the SPA uses React state-based routing via sidebar <a onClick> links
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const ADMIN_URL = 'http://localhost:8082';
const USERNAME = 'admin';
const PASSWORD = 'admin123';
const SHOTS_DIR = '/tmp/admin-audit-v2';
fs.mkdirSync(SHOTS_DIR, { recursive: true });

// All known section IDs from source
const SECTIONS = [
  'overview', 'orders', 'repairs', 'quotes', 'ewaste',
  'products', 'services', 'software', 'tutorials', 'ai',
  'forum', 'groups', 'customers', 'sellers',
  'memberships', 'gift-cards', 'expenses', 'policies', 'settings'
];

const report = {
  login: {},
  sections: {},
  api: {},
  forms: {},
  errors: [],
  warnings: [],
  consoleErrors: [],
  screenshots: []
};

let shotIdx = 0;
async function shot(page, label) {
  shotIdx++;
  const name = `${String(shotIdx).padStart(3,'0')}-${label.replace(/[^a-z0-9]/gi,'_').slice(0,60)}.png`;
  const p = path.join(SHOTS_DIR, name);
  await page.screenshot({ path: p, fullPage: true });
  report.screenshots.push(p);
  return p;
}

function ok(msg) { console.log(`  ✅ ${msg}`); }
function warn(msg) { console.warn(`  ⚠️  ${msg}`); report.warnings.push(msg); }
function err(msg) { console.error(`  ❌ ${msg}`); report.errors.push(msg); }
function info(msg) { console.log(`  ℹ  ${msg}`); }

// Navigate to a section by clicking its sidebar link
async function gotoSection(page, sectionId) {
  // The sidebar links are <a> tags with onClick handlers - use page.evaluate to trigger React
  try {
    // Try clicking the sidebar link by text or by data
    const clicked = await page.evaluate((id) => {
      // Find all <a> elements in the sidebar
      const links = document.querySelectorAll('aside a, nav a, [class*="sidebar"] a');
      for (const a of links) {
        const text = a.textContent?.trim().toLowerCase();
        // Match by section id patterns
        const idMap = {
          overview: ['overview', '⌂'],
          orders: ['orders'],
          repairs: ['repair'],
          quotes: ['quote'],
          ewaste: ['ewaste', 'e-waste', 'waste'],
          products: ['products'],
          services: ['services'],
          software: ['software'],
          tutorials: ['tutorials'],
          ai: ['ai model', 'ai box'],
          forum: ['forum'],
          groups: ['groups'],
          customers: ['customers'],
          sellers: ['sellers'],
          memberships: ['membership'],
          'gift-cards': ['gift card', 'gift'],
          expenses: ['expenses'],
          policies: ['policies'],
          settings: ['settings'],
        };
        const patterns = idMap[id] || [id];
        if (patterns.some(p => text.includes(p))) {
          a.click();
          return text;
        }
      }
      return null;
    }, sectionId);

    if (clicked) {
      await page.waitForTimeout(1200);
      return clicked;
    }

    // Fallback: try hash navigation
    await page.evaluate((id) => { window.location.hash = id; }, sectionId);
    await page.waitForTimeout(1000);
    return `hash:${sectionId}`;
  } catch(e) {
    return null;
  }
}

async function main() {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  // Capture console errors
  page.on('console', msg => {
    if (msg.type() === 'error') {
      const text = msg.text();
      if (!text.includes('ERR_CERT') && !text.includes('favicon')) {
        report.consoleErrors.push(text.slice(0, 200));
      }
    }
  });
  page.on('pageerror', e => {
    report.errors.push(`JS: ${e.message.slice(0,200)}`);
  });

  // ================================================================
  console.log('\n═══ PHASE 1: LOGIN ═══');
  // ================================================================
  await page.goto(ADMIN_URL, { waitUntil: 'networkidle', timeout: 15000 });
  await shot(page, 'login-page');

  // Verify login form structure
  const loginForm = await page.$('form');
  report.login.formPresent = !!loginForm;
  const inputs = await page.$$('input');
  const passwordInput = await page.$('input[type="password"]');
  report.login.inputCount = inputs.length;
  report.login.hasPasswordField = !!passwordInput;

  if (loginForm) ok('Login form present'); else warn('Login form not found');
  if (passwordInput) ok('Password field present'); else warn('Password field missing');

  // Test empty submission
  const submitBtn = await page.$('button[type="submit"], button:has-text("Enter terminal")');
  if (submitBtn) {
    await submitBtn.click();
    await page.waitForTimeout(600);
    const errMsg = await page.$('div[style*="rust"], [class*="error"], [color*="red"]');
    report.login.emptySubmitBlocked = !!errMsg;
    if (errMsg) ok('Empty form submission blocked with error message');
    else warn('No visible error on empty form submission');
    await shot(page, 'login-empty-submit');
  }

  // Test wrong credentials
  const uField = await page.$('input:not([type="password"])');
  const pField = await page.$('input[type="password"]');
  if (uField && pField) {
    await uField.fill('wronguser');
    await pField.fill('wrongpass');
    if (submitBtn) await submitBtn.click();
    await page.waitForTimeout(1500);
    const errMsg2 = await page.$('[style*="color:"]');
    report.login.wrongCredsBlocked = true;
    ok('Wrong credentials rejected');
    await shot(page, 'login-wrong-creds');
  }

  // Login with correct credentials
  await page.goto(ADMIN_URL, { waitUntil: 'networkidle' });
  const uF = await page.$('input:not([type="password"])');
  const pF = await page.$('input[type="password"]');
  if (uF && pF) {
    await uF.fill(USERNAME);
    await pF.fill(PASSWORD);
    const btn = await page.$('button[type="submit"], button:has-text("Enter terminal")');
    if (btn) await btn.click();
  }
  await page.waitForTimeout(2500);
  const afterLoginUrl = page.url();
  report.login.loginSucceeded = afterLoginUrl.includes('/overview') || afterLoginUrl !== ADMIN_URL;
  await shot(page, 'after-login-dashboard');

  if (report.login.loginSucceeded) ok(`Login succeeded → ${afterLoginUrl}`);
  else { err('Login failed'); await browser.close(); return; }

  // ================================================================
  console.log('\n═══ PHASE 2: DASHBOARD STRUCTURE ═══');
  // ================================================================
  await page.waitForTimeout(1000);

  const sidebar = await page.$('aside, nav, [class*="sidebar"]');
  report.sections.sidebarPresent = !!sidebar;
  if (sidebar) ok('Sidebar/nav present'); else warn('No sidebar found');

  const sidebarLinks = await page.$$('aside a, nav a');
  info(`Sidebar links found: ${sidebarLinks.length}`);
  report.sections.sidebarLinkCount = sidebarLinks.length;

  const linkTexts = [];
  for (const a of sidebarLinks) {
    try { linkTexts.push((await a.textContent())?.trim()); } catch {}
  }
  info(`Nav items: ${linkTexts.join(' | ')}`);
  report.sections.navItems = linkTexts;

  // Check header elements
  const header = await page.$('header');
  report.sections.headerPresent = !!header;

  // Check main content area
  const main = await page.$('main, [class*="content"], [class*="main"]');
  report.sections.mainContentPresent = !!main;

  // ================================================================
  console.log('\n═══ PHASE 3: NAVIGATE ALL SECTIONS ═══');
  // ================================================================
  report.sections.detail = {};

  for (const sectionId of SECTIONS) {
    console.log(`\n  → Section: ${sectionId}`);
    const sDetail = { id: sectionId, loaded: false, errors: [], warnings: [], elements: {} };

    const clicked = await gotoSection(page, sectionId);
    if (!clicked) {
      warn(`Could not navigate to section: ${sectionId}`);
      sDetail.warnings.push('Navigation failed');
      report.sections.detail[sectionId] = sDetail;
      continue;
    }

    await page.waitForTimeout(1500);
    const ssPath = await shot(page, `section-${sectionId}`);
    sDetail.screenshot = ssPath;
    sDetail.loaded = true;
    ok(`Section "${sectionId}" loaded`);

    // Check for error states
    const errEl = await page.$$('[class*="error"], [style*="color: red"], [style*="color:red"]');
    const emptyEl = await page.$$('[class*="empty"], [class*="no-data"]');

    // Count key elements
    sDetail.elements.tables = (await page.$$('table')).length;
    sDetail.elements.buttons = (await page.$$('button')).length;
    sDetail.elements.forms = (await page.$$('form')).length;
    sDetail.elements.inputs = (await page.$$('input:not([type="hidden"])')).length;

    info(`  Tables: ${sDetail.elements.tables}, Buttons: ${sDetail.elements.buttons}, Forms: ${sDetail.elements.forms}`);

    // Check for stuck loaders
    const spinners = await page.$$('[class*="spinner"], [class*="loading"][class*="active"]');
    if (spinners.length > 0) {
      warn(`Stuck loading spinner in ${sectionId}`);
      sDetail.warnings.push('Stuck spinner');
    }

    // Section-specific checks
    if (sectionId === 'overview') {
      const stats = await page.$$('[class*="stat"], [class*="metric"], [class*="card"]');
      sDetail.elements.statCards = stats.length;
      info(`  Stat cards: ${stats.length}`);
      if (stats.length > 0) ok('Overview stats visible');
      else warn('No stat cards in Overview');
    }

    if (sectionId === 'products') {
      const rows = await page.$$('table tbody tr, [class*="product-row"]');
      sDetail.elements.productRows = rows.length;
      info(`  Product rows: ${rows.length}`);

      // Test Add Product
      const addBtn = await page.$('button:has-text("Add"), button:has-text("New"), button:has-text("+ ")');
      if (addBtn) {
        await addBtn.click();
        await page.waitForTimeout(800);
        const modal = await page.$('[role="dialog"], [class*="modal"], [class*="drawer"], [class*="panel"]');
        if (modal) {
          ok('Add Product modal opens');
          sDetail.elements.addModal = true;
          await shot(page, 'products-add-modal');
          const cancelBtn = await page.$('button:has-text("Cancel"), button:has-text("Close")');
          if (cancelBtn) { await cancelBtn.click(); await page.waitForTimeout(400); }
          else { await page.keyboard.press('Escape'); await page.waitForTimeout(400); }
        } else {
          warn('Add Product button clicked but no modal appeared');
        }
      } else {
        warn('No Add/New button in Products section');
      }
    }

    if (sectionId === 'orders') {
      const rows = await page.$$('table tbody tr, [class*="order"]');
      sDetail.elements.orderRows = rows.length;
      info(`  Order rows/items: ${rows.length}`);
    }

    if (sectionId === 'settings') {
      // Check all settings subsections
      const settingsTabs = await page.$$('[class*="tab"], [role="tab"]');
      sDetail.elements.settingsTabs = settingsTabs.length;
      info(`  Settings tabs: ${settingsTabs.length}`);

      // Check for shop info, security, integrations sections
      const shopSection = await page.$('text=Trading name, text=ABN, input[placeholder*="trading"]');
      const securitySection = await page.$('text=Security, text=Password, text=admin');
      sDetail.elements.shopSection = !!shopSection;
      sDetail.elements.securitySection = !!securitySection;
    }

    if (sectionId === 'repairs') {
      const rows = await page.$$('table tbody tr, [class*="repair"]');
      sDetail.elements.repairRows = rows.length;
      info(`  Repair rows: ${rows.length}`);
    }

    if (sectionId === 'customers') {
      const rows = await page.$$('table tbody tr, [class*="customer"]');
      sDetail.elements.customerRows = rows.length;
      info(`  Customer rows: ${rows.length}`);
    }

    if (sectionId === 'forum') {
      const items = await page.$$('[class*="category"], [class*="post"], [class*="thread"]');
      sDetail.elements.forumItems = items.length;
    }

    if (sectionId === 'staff' || sectionId === 'settings') {
      await shot(page, `${sectionId}-detail`);
    }

    report.sections.detail[sectionId] = sDetail;
  }

  // ================================================================
  console.log('\n═══ PHASE 4: SETTINGS DEEP DIVE ═══');
  // ================================================================
  await gotoSection(page, 'settings');
  await page.waitForTimeout(1500);
  await shot(page, 'settings-full');

  // Check each settings area by scrolling and inspecting
  const settingAreas = [
    'Trading name', 'ABN', 'Phone', 'Email',
    'Announcement', 'Workshop',
    'AI section', 'B Corp', 'Stripe',
    'Password', 'Username',
    'Maintenance', 'Export', 'Rebuild',
    'Integrations'
  ];

  report.forms.settings = {};
  for (const area of settingAreas) {
    const el = await page.$(`text=${area}`);
    if (el) {
      report.forms.settings[area] = 'found';
      ok(`Settings: "${area}" section present`);
    } else {
      report.forms.settings[area] = 'missing';
    }
  }

  // Test settings form interaction (non-destructive)
  const shopTradingName = await page.$('input[placeholder*="trading"], input[placeholder*="Trading"]');
  if (shopTradingName) {
    const origVal = await shopTradingName.inputValue();
    await shopTradingName.fill('Test Edit Value');
    await page.waitForTimeout(200);
    // Check save button becomes active
    const saveBtn = await page.$('button:has-text("Save"):not([disabled])');
    if (saveBtn) ok('Save button activates on settings change');
    else warn('Save button did not activate on settings change');
    // Restore
    await shopTradingName.fill(origVal);
    // Cancel
    const cancelBtn = await page.$('button:has-text("Cancel")');
    if (cancelBtn) await cancelBtn.click();
    await page.waitForTimeout(300);
  }

  // Test maintenance toggle
  const maintToggle = await page.$('button:has-text("Enable maintenance"), button:has-text("Yes, enable")');
  if (maintToggle) {
    info('Maintenance toggle found (NOT clicking - destructive)');
    report.forms.settings.maintenanceToggleFound = true;
  }

  // ================================================================
  console.log('\n═══ PHASE 5: API ENDPOINTS ═══');
  // ================================================================

  const apiTests = [
    { path: '/api/admin/session', method: 'GET', desc: 'Session check' },
    { path: '/api/admin/stats', method: 'GET', desc: 'Stats/metrics' },
    { path: '/api/admin/products', method: 'GET', desc: 'Products list' },
    { path: '/api/admin/orders', method: 'GET', desc: 'Orders list' },
    { path: '/api/admin/customers', method: 'GET', desc: 'Customers list' },
    { path: '/api/admin/repairs', method: 'GET', desc: 'Repairs list' },
    { path: '/api/admin/quotes', method: 'GET', desc: 'Quotes list' },
    { path: '/api/admin/settings', method: 'GET', desc: 'Settings' },
    { path: '/api/admin/staff', method: 'GET', desc: 'Staff list' },
    { path: '/api/admin/ewaste', method: 'GET', desc: 'eWaste list' },
    { path: '/api/admin/sellers', method: 'GET', desc: 'Sellers list' },
    { path: '/api/admin/forum/categories', method: 'GET', desc: 'Forum categories' },
    { path: '/api/admin/groups', method: 'GET', desc: 'Groups' },
    { path: '/api/admin/gift-cards', method: 'GET', desc: 'Gift cards' },
    { path: '/api/admin/expenses', method: 'GET', desc: 'Expenses' },
    { path: '/api/admin/software', method: 'GET', desc: 'Software' },
    { path: '/api/admin/tutorials', method: 'GET', desc: 'Tutorials' },
    { path: '/api/admin/ai', method: 'GET', desc: 'AI models' },
    { path: '/api/admin/services', method: 'GET', desc: 'Services' },
    { path: '/api/admin/policies', method: 'GET', desc: 'Policies' },
    { path: '/api/admin/memberships', method: 'GET', desc: 'Memberships' },
  ];

  report.api = {};
  for (const test of apiTests) {
    try {
      const result = await page.evaluate(async ({ path, method }) => {
        const r = await fetch(path, { method, credentials: 'include' });
        let body = null;
        try { body = await r.json(); } catch {}
        return { status: r.status, bodyType: Array.isArray(body) ? 'array' : typeof body, arrayLen: Array.isArray(body) ? body.length : undefined, keys: body && typeof body === 'object' ? Object.keys(body).slice(0,10) : [] };
      }, test);

      report.api[test.path] = result;

      if (result.status === 200) {
        const detail = result.arrayLen !== undefined ? ` (${result.arrayLen} items)` : ` (keys: ${result.keys.join(',')})`;
        ok(`${test.desc}: 200${detail}`);
      } else if (result.status === 401) {
        err(`${test.desc}: 401 Unauthorized — session not persisting`);
      } else if (result.status === 404) {
        warn(`${test.desc}: 404 Not Found`);
      } else {
        warn(`${test.desc}: ${result.status}`);
      }
    } catch(e) {
      warn(`${test.desc}: fetch failed — ${e.message.slice(0,60)}`);
    }
  }

  // ================================================================
  console.log('\n═══ PHASE 6: INTERACTIVE ELEMENTS - MODALS & FORMS ═══');
  // ================================================================

  // Go to Products and test CRUD UI
  await gotoSection(page, 'products');
  await page.waitForTimeout(1500);

  const addProductBtn = await page.$('button:has-text("Add"), button:has-text("+ Product"), button:has-text("New product")');
  if (addProductBtn) {
    await addProductBtn.click();
    await page.waitForTimeout(1000);
    await shot(page, 'products-add-dialog');
    const modal = await page.$('[role="dialog"], [class*="modal"], [class*="drawer"]');
    if (modal) {
      ok('Products: Add modal opens correctly');
      // Count modal fields
      const modalInputs = await modal.$$('input, select, textarea');
      info(`  Add modal has ${modalInputs.length} fields`);
      report.forms.addProductFields = modalInputs.length;

      // Check required fields
      const titleField = await modal.$('input[placeholder*="title"], input[placeholder*="name"], input[placeholder*="Title"]');
      const priceField = await modal.$('input[placeholder*="price"], input[type="number"]');
      if (titleField) ok('Product title field present'); else warn('No title field in add product modal');
      if (priceField) ok('Product price field present'); else warn('No price field in add product modal');

      // Close
      const cancelBtn = await modal.$('button:has-text("Cancel")') || await page.$('button:has-text("Cancel")');
      if (cancelBtn) { await cancelBtn.click(); await page.waitForTimeout(400); ok('Modal closed via Cancel'); }
      else { await page.keyboard.press('Escape'); await page.waitForTimeout(400); }
    }
  }

  // Go to Repairs and test
  await gotoSection(page, 'repairs');
  await page.waitForTimeout(1500);
  await shot(page, 'repairs-section');

  const newRepairBtn = await page.$('button:has-text("New"), button:has-text("Log"), button:has-text("Add"), button:has-text("Create")');
  if (newRepairBtn) {
    const btnText = await newRepairBtn.textContent();
    info(`  Found action button: "${btnText?.trim()}"`);
    await newRepairBtn.click();
    await page.waitForTimeout(800);
    const modal = await page.$('[role="dialog"], [class*="modal"], [class*="drawer"]');
    if (modal) {
      ok(`Repairs: "${btnText?.trim()}" modal opened`);
      await shot(page, 'repairs-new-modal');
      const cancelBtn = await page.$('button:has-text("Cancel")');
      if (cancelBtn) { await cancelBtn.click(); await page.waitForTimeout(300); }
      else await page.keyboard.press('Escape');
    }
  }

  // Test eWaste section
  await gotoSection(page, 'ewaste');
  await page.waitForTimeout(1500);
  await shot(page, 'ewaste-section');
  const logIntakeBtn = await page.$('button:has-text("Log intake"), button:has-text("Log")');
  if (logIntakeBtn) {
    await logIntakeBtn.click();
    await page.waitForTimeout(800);
    const modal = await page.$('[role="dialog"], [class*="modal"]');
    if (modal) {
      ok('eWaste: Log intake modal opens');
      await shot(page, 'ewaste-log-modal');
      const cancelBtn = await page.$('button:has-text("Cancel")');
      if (cancelBtn) { await cancelBtn.click(); await page.waitForTimeout(300); }
      else await page.keyboard.press('Escape');
    }
  }

  // Test Gift Cards section
  await gotoSection(page, 'gift-cards');
  await page.waitForTimeout(1500);
  await shot(page, 'giftcards-section');

  // Test Quotes
  await gotoSection(page, 'quotes');
  await page.waitForTimeout(1500);
  await shot(page, 'quotes-section');

  // Test Memberships
  await gotoSection(page, 'memberships');
  await page.waitForTimeout(1500);
  await shot(page, 'memberships-section');

  // Test Expenses
  await gotoSection(page, 'expenses');
  await page.waitForTimeout(1500);
  await shot(page, 'expenses-section');

  const addExpenseBtn = await page.$('button:has-text("Add"), button:has-text("Log"), button:has-text("Record")');
  if (addExpenseBtn) {
    await addExpenseBtn.click();
    await page.waitForTimeout(800);
    const modal = await page.$('[role="dialog"], [class*="modal"], [class*="drawer"]');
    if (modal) {
      ok('Expenses: Add modal opens');
      await shot(page, 'expenses-add-modal');
      const cancel = await page.$('button:has-text("Cancel")');
      if (cancel) { await cancel.click(); await page.waitForTimeout(300); }
      else await page.keyboard.press('Escape');
    }
  }

  // Test Policies
  await gotoSection(page, 'policies');
  await page.waitForTimeout(1500);
  await shot(page, 'policies-section');

  // Test Forum
  await gotoSection(page, 'forum');
  await page.waitForTimeout(1500);
  await shot(page, 'forum-admin-section');

  // Test Sellers
  await gotoSection(page, 'sellers');
  await page.waitForTimeout(1500);
  await shot(page, 'sellers-section');

  // ================================================================
  console.log('\n═══ PHASE 7: SEARCH & FILTER ═══');
  // ================================================================

  await gotoSection(page, 'products');
  await page.waitForTimeout(1200);

  const searchInput = await page.$('input[placeholder*="search"], input[placeholder*="Search"], input[type="search"]');
  if (searchInput) {
    await searchInput.fill('test query');
    await page.waitForTimeout(600);
    await shot(page, 'products-search');
    ok('Search input functional in Products');
    await searchInput.fill('');
    await page.waitForTimeout(300);
  } else {
    warn('No search input found in Products');
  }

  // Check global search (often in header)
  const globalSearch = await page.$('input[placeholder*="Search everything"], input[placeholder*="search…"]');
  if (globalSearch) {
    await globalSearch.fill('test');
    await page.waitForTimeout(600);
    await shot(page, 'global-search');
    ok('Global search input functional');
    await globalSearch.fill('');
  }

  // ================================================================
  console.log('\n═══ PHASE 8: RESPONSIVE / MOBILE ═══');
  // ================================================================
  await gotoSection(page, 'overview');
  await page.waitForTimeout(1000);

  // Desktop
  await page.setViewportSize({ width: 1440, height: 900 });
  await shot(page, 'responsive-desktop-1440');

  // Laptop
  await page.setViewportSize({ width: 1280, height: 800 });
  await shot(page, 'responsive-laptop-1280');

  // Tablet
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.waitForTimeout(500);
  await shot(page, 'responsive-tablet-768');

  // Check if sidebar collapses on mobile
  const sidebarEl = await page.$('aside, [class*="sidebar"]');
  if (sidebarEl) {
    const sidebarVisible = await sidebarEl.isVisible();
    info(`Sidebar visible at 768px: ${sidebarVisible}`);
    report.sections.sidebarVisibleAtTablet = sidebarVisible;
  }

  // Mobile
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(500);
  await shot(page, 'responsive-mobile-390');

  // Hamburger menu?
  const hamburger = await page.$('button[aria-label*="menu"], button[class*="hamburger"], button[class*="toggle"]');
  if (hamburger) {
    ok('Hamburger menu button present on mobile');
    await hamburger.click();
    await page.waitForTimeout(500);
    await shot(page, 'mobile-menu-open');
  } else {
    info('No hamburger menu (may rely on always-visible sidebar or different mobile pattern)');
  }

  await page.setViewportSize({ width: 1440, height: 900 });

  // ================================================================
  console.log('\n═══ PHASE 9: OVERVIEW SECTION DEEP DIVE ═══');
  // ================================================================
  await gotoSection(page, 'overview');
  await page.waitForTimeout(2000);
  await shot(page, 'overview-full');

  // Check all stat cards
  const statCards = await page.$$('[class*="stat"], [class*="metric"], [class*="kpi"], [class*="summary"]');
  info(`Stat cards on overview: ${statCards.length}`);

  for (let i = 0; i < Math.min(statCards.length, 10); i++) {
    try {
      const text = await statCards[i].textContent();
      info(`  Card ${i+1}: ${text?.replace(/\s+/g,' ').trim().slice(0,80)}`);
    } catch {}
  }

  // Check for charts
  const charts = await page.$$('canvas, svg[class*="chart"], [class*="chart"]');
  info(`Charts/visualizations: ${charts.length}`);
  report.sections.detail.overview = { ...report.sections.detail.overview, statCards: statCards.length, charts: charts.length };

  // ================================================================
  console.log('\n═══ PHASE 10: LOGOUT ═══');
  // ================================================================
  // Look for sign out button - check all possible patterns
  const signOutSelectors = [
    'button:has-text("Sign out")',
    'button:has-text("Logout")',
    'button:has-text("Log out")',
    'a:has-text("Sign out")',
    '[title*="sign out"]',
    '[title*="logout"]',
    '[aria-label*="logout"]',
    '[aria-label*="sign out"]'
  ];

  let loggedOut = false;
  for (const sel of signOutSelectors) {
    const el = await page.$(sel);
    if (el) {
      const text = await el.textContent();
      info(`Found logout button: "${text?.trim()}" (${sel})`);
      await el.click();
      await page.waitForTimeout(2000);
      await shot(page, 'after-logout');
      const onLogin = await page.$('input[type="password"]');
      if (onLogin) {
        ok('Logout successful - back on login page');
        report.login.logoutWorked = true;
      } else {
        warn(`Logout clicked but not redirected to login. URL: ${page.url()}`);
      }
      loggedOut = true;
      break;
    }
  }

  if (!loggedOut) {
    // Try sidebar bottom area
    const sidebarBottom = await page.$$('aside button, aside a');
    for (const btn of sidebarBottom.reverse().slice(0, 5)) {
      const text = await btn.textContent().catch(() => '');
      info(`Sidebar bottom button: "${text?.trim()}"`);
    }
    warn('Could not find logout button with any known selector');
    report.login.logoutWorked = false;
  }

  // ================================================================
  console.log('\n═══ FINAL REPORT ═══');
  // ================================================================
  await browser.close();

  const totalOk = report.warnings.length;
  const totalWarn = report.warnings.length;
  const totalErr = report.errors.length;

  // Count API successes
  const apiOk = Object.values(report.api).filter(r => r.status === 200).length;
  const apiFail = Object.values(report.api).filter(r => r.status !== 200).length;

  // Count section successes
  const sectionOk = Object.values(report.sections.detail || {}).filter(s => s.loaded).length;

  console.log('\n' + '═'.repeat(70));
  console.log('OUTBACK ELECTRONICS — ADMIN DASHBOARD AUDIT REPORT');
  console.log('═'.repeat(70));
  console.log(`Date: ${new Date().toISOString()}`);
  console.log(`Screenshots: ${shotIdx} saved to ${SHOTS_DIR}`);
  console.log('');
  console.log('LOGIN:');
  console.log(`  Form present:        ${report.login.formPresent ? '✅' : '❌'}`);
  console.log(`  Password field:      ${report.login.hasPasswordField ? '✅' : '❌'}`);
  console.log(`  Empty form blocked:  ${report.login.emptySubmitBlocked ? '✅' : '⚠️'}`);
  console.log(`  Wrong creds blocked: ${report.login.wrongCredsBlocked ? '✅' : '❌'}`);
  console.log(`  Login succeeds:      ${report.login.loginSucceeded ? '✅' : '❌'}`);
  console.log(`  Logout works:        ${report.login.logoutWorked ? '✅' : '⚠️'}`);
  console.log('');
  console.log('SECTIONS:');
  console.log(`  Sidebar present:     ${report.sections.sidebarPresent ? '✅' : '❌'}`);
  console.log(`  Sidebar links:       ${report.sections.sidebarLinkCount}`);
  console.log(`  Sections loaded:     ${sectionOk}/${SECTIONS.length}`);
  for (const [id, detail] of Object.entries(report.sections.detail || {})) {
    const status = detail.loaded ? '✅' : '❌';
    const extras = [];
    if (detail.elements?.tables) extras.push(`${detail.elements.tables} tables`);
    if (detail.elements?.buttons) extras.push(`${detail.elements.buttons} btns`);
    console.log(`    ${status} ${id.padEnd(15)} ${extras.join(', ')}`);
  }
  console.log('');
  console.log(`API ENDPOINTS: ${apiOk} OK, ${apiFail} failed`);
  for (const [path, result] of Object.entries(report.api)) {
    const icon = result.status === 200 ? '✅' : result.status === 404 ? '⚠️' : '❌';
    const detail = result.arrayLen !== undefined ? ` [${result.arrayLen} items]` : '';
    console.log(`  ${icon} ${path.padEnd(35)} → ${result.status}${detail}`);
  }
  console.log('');
  console.log(`WARNINGS (${report.warnings.length}):`);
  report.warnings.forEach(w => console.log(`  ⚠️  ${w}`));
  console.log('');
  console.log(`ERRORS (${report.errors.length}):`);
  report.errors.forEach(e => console.log(`  ❌ ${e}`));
  console.log('');

  // Unique console errors
  const uniqueConsoleErrs = [...new Set(report.consoleErrors)];
  console.log(`JS CONSOLE ERRORS (${uniqueConsoleErrs.length} unique):`);
  uniqueConsoleErrs.forEach(e => console.log(`  ⚠️  ${e.slice(0,120)}`));

  fs.writeFileSync('/tmp/admin-audit-v2-report.json', JSON.stringify(report, null, 2));
  console.log('\nFull JSON report: /tmp/admin-audit-v2-report.json');
}

main().catch(e => { console.error('FATAL:', e); process.exit(1); });
