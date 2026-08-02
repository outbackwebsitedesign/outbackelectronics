#!/usr/bin/env node
// Run on the server: node migrate-giftcards-to-denominations.js [--dry-run] [--yes]
//
// Finds products whose category is 'Gift Cards' (case-insensitive) or whose
// name contains 'gift card', converts them to gift-card-denominations, and
// removes them from products.db.
//
// Safe to run multiple times, skips denominations that already exist by id.
//
// --dry-run  Preview what would be migrated without writing anything.
// --yes      Skip the confirmation prompt (for non-interactive use).

const fs   = require('fs');
const path = require('path');

const DRY_RUN = process.argv.includes('--dry-run');
const YES     = process.argv.includes('--yes');

const PRODUCTS_PATH      = path.join(__dirname, 'products.db');
const DENOMINATIONS_PATH = path.join(__dirname, 'gift-card-denominations.db');

function atomicWrite(filePath, data) {
  const tmp = filePath + '.tmp';
  fs.writeFileSync(tmp, data, 'utf8');
  fs.renameSync(tmp, filePath);
}

function backupFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const ts   = new Date().toISOString().replace(/[:.]/g, '-');
  const dest = `${filePath}.backup-${ts}`;
  fs.copyFileSync(filePath, dest);
  console.log(`  Backed up ${path.basename(filePath)} → ${path.basename(dest)}`);
}

function readProducts() {
  const raw = JSON.parse(fs.readFileSync(PRODUCTS_PATH, 'utf8'));
  return Array.isArray(raw.products) ? raw.products : [];
}

function readDenominations() {
  try {
    const raw = JSON.parse(fs.readFileSync(DENOMINATIONS_PATH, 'utf8'));
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

// Match products that are genuinely gift cards.
// Category match is preferred (exact, trimmed).  Name match is a fallback
// flag those separately so the confirmation step can highlight them.
function classifyGiftCard(p) {
  const cat  = (p.category || '').trim().toLowerCase();
  const name = (p.name     || '').trim().toLowerCase();

  const exactCat = cat === 'gift cards' || cat === 'gift card' || cat === 'gift-card';
  const nameHit  = name.includes('gift card') || name.includes('gift-card');

  if (exactCat)            return 'category';
  if (nameHit)             return 'name';
  return null;
}

function prompt(question) {
  const readline = require('readline');
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => { rl.question(question, ans => { rl.close(); resolve(ans); }); });
}

(async () => {
  const products  = readProducts();
  const toMigrate = [];
  const nameOnly  = [];

  for (const p of products) {
    const reason = classifyGiftCard(p);
    if (!reason) continue;
    toMigrate.push(p);
    if (reason === 'name') nameOnly.push(p);
  }

  if (toMigrate.length === 0) {
    console.log('No gift card products found in products.db, nothing to do.');
    process.exit(0);
  }

  console.log(`Found ${toMigrate.length} gift card product(s) to migrate:`);
  for (const p of toMigrate) {
    const tag = nameOnly.includes(p) ? ' [matched by name, verify this is correct]' : '';
    console.log(`  • [${p.id}] ${p.name} - $${p.price || p.priceAud || '?'}${tag}`);
  }

  if (nameOnly.length > 0) {
    console.log('\n⚠️  Products matched only by name (not by category) are marked above.');
    console.log('   Verify they are genuine gift cards before proceeding.');
  }

  if (DRY_RUN) {
    console.log('\n--dry-run: no files were changed.');
    process.exit(0);
  }

  if (!YES) {
    const ans = await prompt('\nProceed with migration? [y/N] ');
    if (ans.trim().toLowerCase() !== 'y') {
      console.log('Aborted.');
      process.exit(0);
    }
  }

  // Snapshot both files before any writes.
  console.log('\nCreating backups...');
  backupFile(PRODUCTS_PATH);
  backupFile(DENOMINATIONS_PATH);

  const denoms      = readDenominations();
  const existingIds = new Set(denoms.map(d => d.id));

  let added = 0;
  for (const p of toMigrate) {
    const denomId = 'gc-denom-' + p.id;
    if (existingIds.has(denomId)) {
      console.log(`  Skipping ${p.name}, denomination ${denomId} already exists.`);
      continue;
    }
    const denom = {
      id:          denomId,
      name:        p.name || `$${p.price} Gift Card`,
      priceAud:    Number(p.price || p.priceAud) || 0,
      description: p.description || '',
      status:      p.status === 'published' ? 'published' : 'draft',
      imageUrl:    (p.images && p.images[0]) || '',
    };
    denoms.push(denom);
    existingIds.add(denomId);
    added++;
    console.log(`  ✓ Added denomination: ${denom.name} ($${denom.priceAud}) imageUrl=${denom.imageUrl || '(none)'}`);
  }

  const migratedIds = new Set(toMigrate.map(p => p.id));
  const remaining   = products.filter(p => !migratedIds.has(p.id));

  atomicWrite(DENOMINATIONS_PATH, JSON.stringify(denoms, null, 2));
  atomicWrite(PRODUCTS_PATH, JSON.stringify({ products: remaining }, null, 2));

  console.log(`\nDone. ${added} denomination(s) added, ${toMigrate.length} product(s) removed from products.db.`);
  console.log('Image files are unchanged on disk, their paths are now stored in each denomination\'s imageUrl field.');
})().catch(err => { console.error(err); process.exit(1); });
