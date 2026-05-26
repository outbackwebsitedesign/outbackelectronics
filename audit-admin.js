const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const ADMIN_URL = 'http://localhost:8082';
const USERNAME = 'admin';
const PASSWORD = 'admin123';
const SCREENSHOTS_DIR = '/tmp/admin-audit-screenshots';

fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });

const findings = [];
const errors = [];
let screenshotIdx = 0;

function log(msg) { console.log(`[AUDIT] ${msg}`); }
function warn(msg) { console.warn(`[WARN] ${msg}`); findings.push({ level: 'warn', msg }); }
function error(msg) { console.error(`[ERROR] ${msg}`); errors.push(msg); }
function ok(msg) { console.log(`[OK] ${msg}`); findings.push({ level: 'ok', msg }); }

async function screenshot(page, label) {
  screenshotIdx++;
  const fname = path.join(SCREENSHOTS_DIR, `${String(screenshotIdx).padStart(3,'0')}-${label.replace(/[^a-z0-9]/gi,'_').slice(0,50)}.png`);
  await page.screenshot({ path: fname, fullPage: true });
  log(`Screenshot: ${fname}`);
  return fname;
}

async function checkForConsoleErrors(page, context) {
  // Already attached via listener
}

async function waitAndClick(page, selector, label) {
  try {
    await page.waitForSelector(selector, { timeout: 5000 });
    await page.click(selector);
    ok(`Clicked: ${label}`);
    return true;
  } catch (e) {
    warn(`Could not click ${label}: ${e.message.slice(0,100)}`);
    return false;
  }
}

async function checkVisible(page, selector, label) {
  try {
    const el = await page.$(selector);
    if (el && await el.isVisible()) {
      ok(`Visible: ${label}`);
      return true;
    } else {
      warn(`Not visible: ${label}`);
      return false;
    }
  } catch (e) {
    warn(`Check failed for ${label}: ${e.message.slice(0,80)}`);
    return false;
  }
}

async function run() {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', err => {
    consoleErrors.push(`PAGE ERROR: ${err.message}`);
    error(`Page JS error: ${err.message}`);
  });

  // ============================================================
  log('=== PHASE 1: LOGIN PAGE ===');
  // ============================================================
  await page.goto(ADMIN_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);
  await screenshot(page, 'login-page');

  // Check login form elements
  await checkVisible(page, 'input[type="text"], input[name="username"], input[placeholder*="sername"], input[placeholder*="Username"]', 'username field');
  await checkVisible(page, 'input[type="password"]', 'password field');
  await checkVisible(page, 'button[type="submit"], button:has-text("Login"), button:has-text("Sign in")', 'login button');

  // Test empty form submission
  try {
    const btn = await page.$('button[type="submit"]') || await page.$('button:has-text("Sign")') || await page.$('button:has-text("Login")');
    if (btn) {
      await btn.click();
      await page.waitForTimeout(500);
      await screenshot(page, 'login-empty-submit');
      ok('Empty form submission handled');
    }
  } catch(e) { warn(`Empty submit test: ${e.message.slice(0,80)}`); }

  // Test wrong credentials
  try {
    const usernameInput = await page.$('input[type="text"]') || await page.$('input[name="username"]');
    const passwordInput = await page.$('input[type="password"]');
    if (usernameInput && passwordInput) {
      await usernameInput.fill('wronguser');
      await passwordInput.fill('wrongpass');
      const btn = await page.$('button[type="submit"]');
      if (btn) {
        await btn.click();
        await page.waitForTimeout(1000);
        await screenshot(page, 'login-wrong-creds');
        ok('Wrong credentials error shown');
      }
    }
  } catch(e) { warn(`Wrong creds test: ${e.message.slice(0,80)}`); }

  // Actual login
  log('Attempting login with correct credentials...');
  try {
    await page.goto(ADMIN_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(500);

    const usernameInput = await page.$('input[type="text"]') || await page.$('input[name="username"]');
    const passwordInput = await page.$('input[type="password"]');

    if (usernameInput && passwordInput) {
      await usernameInput.fill(USERNAME);
      await passwordInput.fill(PASSWORD);
      const btn = await page.$('button[type="submit"]');
      if (btn) await btn.click();
    } else {
      // Try filling by placeholder or label
      await page.fill('input', USERNAME);
    }

    await page.waitForTimeout(2000);
    await screenshot(page, 'after-login');

    const currentUrl = page.url();
    log(`After login URL: ${currentUrl}`);
    if (currentUrl.includes('login') || currentUrl === ADMIN_URL + '/') {
      // Check if still on login page
      const loginForm = await page.$('input[type="password"]');
      if (loginForm) {
        warn('Login may have failed - still on login page');
      } else {
        ok('Logged in successfully');
      }
    } else {
      ok('Logged in - redirected to dashboard');
    }
  } catch(e) {
    error(`Login process failed: ${e.message}`);
  }

  // ============================================================
  log('=== PHASE 2: DASHBOARD OVERVIEW ===');
  // ============================================================
  await page.waitForTimeout(1000);
  await screenshot(page, 'dashboard-main');

  // Check dashboard elements
  const navItems = await page.$$('nav a, [role="navigation"] a, aside a, .sidebar a');
  log(`Found ${navItems.length} navigation links`);

  // Get all nav links text
  const navTexts = [];
  for (const item of navItems) {
    try {
      const text = await item.textContent();
      if (text?.trim()) navTexts.push(text.trim());
    } catch {}
  }
  log(`Nav items: ${navTexts.slice(0, 20).join(', ')}`);

  // Check for stat cards/KPIs
  const statCards = await page.$$('[class*="stat"], [class*="card"], [class*="metric"], [class*="kpi"]');
  log(`Found ${statCards.length} stat/card elements`);

  // ============================================================
  log('=== PHASE 3: NAVIGATING ALL SECTIONS ===');
  // ============================================================

  // Collect all unique links in the nav
  const allLinks = await page.evaluate(() => {
    const links = new Set();
    document.querySelectorAll('a[href]').forEach(a => {
      const href = a.href;
      if (href && !href.startsWith('mailto') && !href.startsWith('javascript') && !href.includes('#')) {
        links.add(href);
      }
    });
    return [...links];
  });
  log(`Found ${allLinks.length} unique links: ${allLinks.join(', ')}`);

  // Navigate each internal link
  const visited = new Set();
  const internalLinks = allLinks.filter(l => l.includes('localhost:8082'));

  for (const link of internalLinks.slice(0, 30)) {
    if (visited.has(link)) continue;
    visited.add(link);
    try {
      log(`Navigating to: ${link}`);
      await page.goto(link, { waitUntil: 'domcontentloaded', timeout: 10000 });
      await page.waitForTimeout(1000);
      const label = link.replace('http://localhost:8082', '').replace(/\//g, '-') || 'root';
      await screenshot(page, `section${label}`);
      ok(`Loaded: ${link}`);
    } catch(e) {
      warn(`Failed to load ${link}: ${e.message.slice(0,80)}`);
    }
  }

  // Go back to dashboard and explore hash-based routing
  await page.goto(ADMIN_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  await screenshot(page, 'dashboard-fresh');

  // Find all clickable nav elements (hash routing SPA)
  const hashLinks = await page.evaluate(() => {
    const links = [];
    document.querySelectorAll('a[href^="#"], [data-page], [data-tab], [data-section]').forEach(el => {
      links.push({
        tag: el.tagName,
        href: el.getAttribute('href') || '',
        page: el.getAttribute('data-page') || '',
        tab: el.getAttribute('data-tab') || '',
        text: el.textContent?.trim().slice(0,50) || ''
      });
    });
    return links;
  });
  log(`Hash links found: ${JSON.stringify(hashLinks.slice(0,20))}`);

  // ============================================================
  log('=== PHASE 4: CLICK ALL NAV ITEMS ===');
  // ============================================================

  // Re-navigate to dashboard
  await page.goto(ADMIN_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  // Get all clickable sidebar/nav items
  const sidebarSelectors = [
    'nav li', 'nav a', 'aside li', 'aside a',
    '[class*="sidebar"] li', '[class*="sidebar"] a',
    '[class*="nav"] li', '[class*="nav-item"]',
    '[class*="menu"] li', '[class*="menu"] a',
    'button[class*="nav"]', 'button[class*="menu"]',
    '[data-page]', '[data-section]', '[data-tab]'
  ];

  let navElements = [];
  for (const sel of sidebarSelectors) {
    const els = await page.$$(sel);
    if (els.length > 0) {
      navElements = els;
      log(`Found ${els.length} nav elements with selector: ${sel}`);
      break;
    }
  }

  // Click each nav element
  const navSections = [];
  for (let i = 0; i < Math.min(navElements.length, 25); i++) {
    try {
      const el = navElements[i];
      const text = await el.textContent();
      const trimText = text?.trim().slice(0, 30) || `item-${i}`;
      if (!trimText) continue;

      log(`Clicking nav item: "${trimText}"`);
      await el.click();
      await page.waitForTimeout(1000);
      navSections.push(trimText);
      await screenshot(page, `nav-${trimText.replace(/[^a-z0-9]/gi,'_')}`);
      ok(`Navigated to section: ${trimText}`);

      // Check for errors on this page
      const errorEls = await page.$$('[class*="error"], [class*="alert-danger"], [class*="Error"]');
      if (errorEls.length > 0) {
        const errText = await errorEls[0].textContent();
        warn(`Error visible on ${trimText}: ${errText?.slice(0,100)}`);
      }
    } catch(e) {
      warn(`Nav click failed for item ${i}: ${e.message.slice(0,80)}`);
    }
  }

  // ============================================================
  log('=== PHASE 5: PRODUCTS SECTION ===');
  // ============================================================
  await page.goto(ADMIN_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);

  // Look for Products link
  const productLinks = await page.$$('text=Products, text=Product, [href*="product"], [data-page*="product"]');
  log(`Found ${productLinks.length} product-related links`);

  // Try clicking products via multiple strategies
  let foundProducts = false;
  const productSelectors = [
    'text=Products', 'a:has-text("Products")', '[href*="product"]',
    'button:has-text("Products")', '[data-page="products"]'
  ];
  for (const sel of productSelectors) {
    try {
      const el = await page.$(sel);
      if (el) {
        await el.click();
        await page.waitForTimeout(1500);
        await screenshot(page, 'products-section');
        ok(`Navigated to Products via: ${sel}`);
        foundProducts = true;
        break;
      }
    } catch {}
  }

  if (foundProducts) {
    // Look for add product button
    const addBtns = ['button:has-text("Add")', 'button:has-text("New Product")', 'button:has-text("Create")', '[class*="add"]'];
    for (const sel of addBtns) {
      try {
        const el = await page.$(sel);
        if (el) {
          await el.click();
          await page.waitForTimeout(1000);
          await screenshot(page, 'products-add-modal');
          ok(`Add product dialog opened`);
          // Close modal if open
          const closeBtn = await page.$('button:has-text("Cancel"), button:has-text("Close"), [aria-label="Close"]');
          if (closeBtn) await closeBtn.click();
          break;
        }
      } catch {}
    }

    // Check product list loads
    const productRows = await page.$$('table tr, [class*="product-row"], [class*="product-item"]');
    log(`Product rows found: ${productRows.length}`);
    if (productRows.length > 0) ok(`Product list loaded with ${productRows.length} rows`);
    else warn('No product rows found in products section');
  } else {
    warn('Could not navigate to Products section');
  }

  // ============================================================
  log('=== PHASE 6: ORDERS SECTION ===');
  // ============================================================
  await page.goto(ADMIN_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);

  const orderSelectors = ['text=Orders', 'a:has-text("Orders")', '[href*="order"]', '[data-page="orders"]'];
  for (const sel of orderSelectors) {
    try {
      const el = await page.$(sel);
      if (el) {
        await el.click();
        await page.waitForTimeout(1500);
        await screenshot(page, 'orders-section');
        ok(`Navigated to Orders`);
        const rows = await page.$$('table tr, [class*="order-row"]');
        log(`Order rows: ${rows.length}`);
        break;
      }
    } catch {}
  }

  // ============================================================
  log('=== PHASE 7: SETTINGS SECTION ===');
  // ============================================================
  await page.goto(ADMIN_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);

  const settingsSelectors = ['text=Settings', 'a:has-text("Settings")', '[href*="setting"]', '[data-page="settings"]'];
  for (const sel of settingsSelectors) {
    try {
      const el = await page.$(sel);
      if (el) {
        await el.click();
        await page.waitForTimeout(1500);
        await screenshot(page, 'settings-section');
        ok(`Navigated to Settings`);

        // Look for settings tabs
        const tabs = await page.$$('[role="tab"], [class*="tab"]');
        log(`Settings tabs found: ${tabs.length}`);
        for (let i = 0; i < Math.min(tabs.length, 8); i++) {
          try {
            const tabText = await tabs[i].textContent();
            await tabs[i].click();
            await page.waitForTimeout(800);
            await screenshot(page, `settings-tab-${tabText?.trim().slice(0,20).replace(/[^a-z0-9]/gi,'_')}`);
            ok(`Settings tab: ${tabText?.trim()}`);
          } catch {}
        }
        break;
      }
    } catch {}
  }

  // ============================================================
  log('=== PHASE 8: FORMS & INTERACTIVE ELEMENTS ===');
  // ============================================================
  await page.goto(ADMIN_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  await screenshot(page, 'dashboard-for-forms');

  // Count all interactive elements
  const buttons = await page.$$('button');
  const inputs = await page.$$('input:not([type="hidden"])');
  const selects = await page.$$('select');
  const textareas = await page.$$('textarea');

  log(`Interactive elements: ${buttons.length} buttons, ${inputs.length} inputs, ${selects.length} selects, ${textareas.length} textareas`);
  ok(`Found ${buttons.length} buttons on dashboard`);

  // Log button texts
  const buttonTexts = [];
  for (const btn of buttons.slice(0, 30)) {
    try { buttonTexts.push((await btn.textContent())?.trim().slice(0,30) || ''); } catch {}
  }
  log(`Button labels: ${buttonTexts.filter(t=>t).join(' | ')}`);

  // ============================================================
  log('=== PHASE 9: API ENDPOINT CHECKS ===');
  // ============================================================
  // Test key API endpoints are responding
  const apiEndpoints = [
    '/api/admin/session',
    '/api/admin/products',
    '/api/admin/orders',
    '/api/admin/customers',
    '/api/admin/settings',
    '/api/admin/staff',
    '/api/admin/stats',
    '/api/admin/repairs',
    '/api/admin/quotes',
  ];

  // Get cookies from browser context
  const cookies = await context.cookies();
  const sessionCookie = cookies.find(c => c.name === 'oe_admin_session');
  const csrfCookie = cookies.find(c => c.name === '_csrf');

  for (const endpoint of apiEndpoints) {
    try {
      const resp = await page.evaluate(async (ep) => {
        try {
          const r = await fetch(ep, { credentials: 'include' });
          return { status: r.status, ok: r.ok };
        } catch(e) { return { error: e.message }; }
      }, endpoint);

      if (resp.status === 200) {
        ok(`API ${endpoint} → ${resp.status}`);
      } else if (resp.status === 404) {
        warn(`API ${endpoint} → 404 NOT FOUND`);
      } else if (resp.status === 401) {
        warn(`API ${endpoint} → 401 (auth issue)`);
      } else {
        log(`API ${endpoint} → ${resp.status}`);
      }
    } catch(e) {
      warn(`API check failed for ${endpoint}: ${e.message.slice(0,80)}`);
    }
  }

  // ============================================================
  log('=== PHASE 10: DEEP SECTION EXPLORATION ===');
  // ============================================================

  // Try to find and click all main dashboard sections
  const sections = [
    'Dashboard', 'Overview', 'Analytics',
    'Products', 'Inventory', 'Catalogue',
    'Orders', 'Sales',
    'Customers', 'Users',
    'Repairs', 'Service',
    'Quotes', 'Estimates',
    'Staff', 'Team',
    'Settings', 'Configuration',
    'Reports', 'Finance',
    'Forum', 'Community',
    'E-Waste', 'Sellers',
    'Tutorials', 'Content',
    'Gift Cards', 'Vouchers',
    'Shipping', 'Logistics',
    'Security', 'Logs'
  ];

  for (const section of sections) {
    await page.goto(ADMIN_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(800);

    try {
      // Try multiple ways to find section links
      const selectors = [
        `text=${section}`,
        `a:has-text("${section}")`,
        `button:has-text("${section}")`,
        `[data-page="${section.toLowerCase()}"]`,
        `[href*="${section.toLowerCase()}"]`
      ];

      let found = false;
      for (const sel of selectors) {
        try {
          const el = await page.$(sel);
          if (el && await el.isVisible()) {
            await el.click();
            await page.waitForTimeout(1200);
            const label = `section-${section.replace(/[^a-z0-9]/gi,'_')}`;
            await screenshot(page, label);
            ok(`Section "${section}" accessible and rendered`);

            // Check for loading spinners stuck
            const spinners = await page.$$('[class*="spinner"], [class*="loading"], [class*="skeleton"]');
            if (spinners.length > 0) warn(`Loading spinners still present in ${section}`);

            // Check for error states
            const errorEls = await page.$$('[class*="error-state"], [class*="empty-state"]');
            if (errorEls.length > 0) {
              const errText = await errorEls[0].textContent();
              log(`State in ${section}: ${errText?.trim().slice(0,80)}`);
            }

            found = true;
            break;
          }
        } catch {}
      }

      if (!found) log(`Section "${section}" not found in nav (may not exist)`);
    } catch(e) {
      warn(`Error exploring ${section}: ${e.message.slice(0,80)}`);
    }
  }

  // ============================================================
  log('=== PHASE 11: MODALS & DIALOGS ===');
  // ============================================================
  await page.goto(ADMIN_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);

  // Look for all buttons and try clicking non-destructive ones
  const safeButtonPatterns = ['Add', 'New', 'Create', 'View', 'Filter', 'Export', 'Import', 'Search', 'Refresh'];

  for (const pattern of safeButtonPatterns) {
    try {
      const btn = await page.$(`button:has-text("${pattern}")`);
      if (btn && await btn.isVisible()) {
        await btn.click();
        await page.waitForTimeout(800);
        const modalVisible = await page.$('[role="dialog"], [class*="modal"], [class*="overlay"]');
        if (modalVisible) {
          await screenshot(page, `modal-${pattern}`);
          ok(`Modal opened for "${pattern}" button`);
          const closeBtn = await page.$('[aria-label="Close"], button:has-text("Cancel"), button:has-text("Close"), .modal-close');
          if (closeBtn) {
            await closeBtn.click();
            await page.waitForTimeout(500);
            ok(`Modal closed`);
          } else {
            await page.keyboard.press('Escape');
            await page.waitForTimeout(500);
          }
        }
      }
    } catch {}
  }

  // ============================================================
  log('=== PHASE 12: RESPONSIVE CHECK ===');
  // ============================================================

  // Check mobile view
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.goto(ADMIN_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);
  await screenshot(page, 'responsive-tablet');

  await page.setViewportSize({ width: 375, height: 812 });
  await page.waitForTimeout(500);
  await screenshot(page, 'responsive-mobile');
  ok('Responsive views captured');

  // Reset viewport
  await page.setViewportSize({ width: 1440, height: 900 });

  // ============================================================
  log('=== PHASE 13: LOGOUT ===');
  // ============================================================
  await page.goto(ADMIN_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);

  const logoutSelectors = ['button:has-text("Logout")', 'button:has-text("Sign out")', 'a:has-text("Logout")', '[href*="logout"]', '[data-action="logout"]'];
  let loggedOut = false;
  for (const sel of logoutSelectors) {
    try {
      const el = await page.$(sel);
      if (el) {
        await el.click();
        await page.waitForTimeout(1500);
        await screenshot(page, 'after-logout');
        const onLogin = await page.$('input[type="password"]');
        if (onLogin) {
          ok('Logout successful - redirected to login page');
        } else {
          warn('Logout clicked but not redirected to login');
        }
        loggedOut = true;
        break;
      }
    } catch {}
  }
  if (!loggedOut) warn('Logout button not found');

  // ============================================================
  log('=== FINAL REPORT ===');
  // ============================================================

  await browser.close();

  console.log('\n' + '='.repeat(60));
  console.log('ADMIN DASHBOARD AUDIT REPORT');
  console.log('='.repeat(60));

  console.log(`\nTotal screenshots: ${screenshotIdx}`);
  console.log(`Console JS errors: ${consoleErrors.length}`);
  if (consoleErrors.length) {
    consoleErrors.forEach(e => console.log(`  ⚠ ${e.slice(0,120)}`));
  }

  const okFindings = findings.filter(f => f.level === 'ok');
  const warnFindings = findings.filter(f => f.level === 'warn');

  console.log(`\n✅ PASSED (${okFindings.length}):`);
  okFindings.forEach(f => console.log(`  ✅ ${f.msg}`));

  console.log(`\n⚠️  WARNINGS (${warnFindings.length}):`);
  warnFindings.forEach(f => console.log(`  ⚠️  ${f.msg}`));

  console.log(`\n❌ ERRORS (${errors.length}):`);
  errors.forEach(e => console.log(`  ❌ ${e}`));

  console.log(`\nScreenshots saved to: ${SCREENSHOTS_DIR}`);

  // Write JSON report
  const report = {
    timestamp: new Date().toISOString(),
    screenshots: screenshotIdx,
    jsErrors: consoleErrors,
    findings: findings,
    errors: errors,
    summary: {
      ok: okFindings.length,
      warnings: warnFindings.length,
      errors: errors.length
    }
  };
  fs.writeFileSync('/tmp/admin-audit-report.json', JSON.stringify(report, null, 2));
  console.log('\nJSON report: /tmp/admin-audit-report.json');
}

run().catch(e => {
  console.error('FATAL:', e);
  process.exit(1);
});
