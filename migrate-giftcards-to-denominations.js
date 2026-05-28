#!/usr/bin/env node
// Run on the server: node migrate-giftcards-to-denominations.js
// Finds products whose category is 'Gift Cards' (case-insensitive) or whose
// name contains 'gift card', converts them to gift-card-denominations, and
// removes them from products.db.
//
// Safe to run multiple times — skips denominations that already exist by id.

const fs = require('fs');
const path = require('path');

const PRODUCTS_PATH     = path.join(__dirname, 'products.db');
const DENOMINATIONS_PATH = path.join(__dirname, 'gift-card-denominations.db');

function atomicWrite(filePath, data) {
  const tmp = filePath + '.tmp';
  fs.writeFileSync(tmp, data, 'utf8');
  fs.renameSync(tmp, filePath);
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

function isGiftCard(p) {
  const cat  = (p.category || '').toLowerCase();
  const name = (p.name || '').toLowerCase();
  return cat.includes('gift card') || cat.includes('gift-card') ||
         name.includes('gift card') || name.includes('gift-card');
}

const products = readProducts();
const toMigrate = products.filter(isGiftCard);

if (toMigrate.length === 0) {
  console.log('No gift card products found in products.db — nothing to do.');
  process.exit(0);
}

console.log(`Found ${toMigrate.length} gift card product(s) to migrate:`);
toMigrate.forEach(p => console.log(`  • [${p.id}] ${p.name} — $${p.price || p.priceAud || '?'}`));

const denoms = readDenominations();
const existingIds = new Set(denoms.map(d => d.id));

let added = 0;
for (const p of toMigrate) {
  const denomId = 'gc-denom-' + p.id;
  if (existingIds.has(denomId)) {
    console.log(`  Skipping ${p.name} — denomination ${denomId} already exists.`);
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

// Remove migrated products from products.db
const migratedIds = new Set(toMigrate.map(p => p.id));
const remaining = products.filter(p => !migratedIds.has(p.id));

// Write both files atomically
atomicWrite(DENOMINATIONS_PATH, JSON.stringify(denoms, null, 2));
atomicWrite(PRODUCTS_PATH, JSON.stringify({ products: remaining }, null, 2));

console.log(`\nDone. ${added} denomination(s) added, ${toMigrate.length} product(s) removed from products.db.`);
console.log('Image files are unchanged on disk — their paths are now stored in each denomination\'s imageUrl field.');
