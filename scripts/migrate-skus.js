#!/usr/bin/env node
// Rewrite every legacy product and variant SKU into the house format.
//
//   node scripts/migrate-skus.js            # dry run, prints what would change
//   node scripts/migrate-skus.js --apply    # writes, after taking backups
//
// Product SKUs become OHE[cat][nnn] and variant SKUs OHE[cat][nnn]-[nn], with
// the category code taken from the first word of the product's category.
// Anything already in the house format keeps its code, and its number is
// reserved so nothing collides with it.
//
// Also remaps the places that reference a SKU as a live pointer:
//   hdd-reports.db  linkedVariantSku  (which certificate a variant ships with)
//   carts.db        sku / _variantSku (unexpired shared cart links)
//
// Deliberately does NOT touch orders.db. The SKU on a past order line is a
// record of what was sold under that code at the time; rewriting it would
// falsify history rather than migrate it.

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const APPLY = process.argv.includes('--apply');

const SKU_HOUSE_PREFIX = 'OHE';

function readDb(file, key) {
  const p = path.join(ROOT, file);
  if (!fs.existsSync(p)) return null;
  try {
    const parsed = JSON.parse(fs.readFileSync(p, 'utf8'));
    return Array.isArray(parsed[key]) ? parsed : null;
  } catch (err) {
    console.error(`Could not parse ${file}: ${err.message}`);
    process.exit(1);
  }
}

// Same atomic write the server uses: write a temp file, then rename over.
function writeDb(file, data) {
  const p = path.join(ROOT, file);
  const tmp = p + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, p);
}

function backup(file) {
  const p = path.join(ROOT, file);
  if (!fs.existsSync(p)) return null;
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const dest = `${p}.bak-${stamp}`;
  fs.copyFileSync(p, dest);
  return path.basename(dest);
}

function catCode(category) {
  const words = String(category || '').toUpperCase().replace(/[^A-Z0-9 ]/g, ' ').split(/\s+/).filter(Boolean);
  if (words.length === 0) return `${SKU_HOUSE_PREFIX}GEN`;
  return SKU_HOUSE_PREFIX + words[0].slice(0, 3).padEnd(3, 'X');
}

const productDb = readDb('products.db', 'products');
if (!productDb) {
  console.error('products.db not found or unreadable. Run this from the repo root on the server.');
  process.exit(1);
}
const products = productDb.products;

// Reserve every number already used by a house-format SKU so the codes we keep
// are never handed out again.
const counters = new Map();
const inHouseFormat = sku => /^OHE[A-Z0-9]{3}\d+$/i.test(String(sku || ''));
for (const p of products) {
  for (const sku of [p.sku, ...((p.variants || []).map(v => v.sku))]) {
    const m = /^(OHE[A-Z0-9]{3})(\d+)$/i.exec(String(sku || ''));
    if (!m) continue;
    const prefix = m[1].toUpperCase();
    counters.set(prefix, Math.max(counters.get(prefix) || 0, parseInt(m[2], 10)));
  }
}
function nextFor(prefix) {
  const n = (counters.get(prefix) || 0) + 1;
  counters.set(prefix, n);
  return `${prefix}${String(n).padStart(3, '0')}`;
}

const productMap = new Map();  // old product sku -> new
const variantMap = new Map();  // old variant sku -> new
const changes = [];

for (const p of products) {
  const prefix = catCode(p.category || p.cat);
  const oldSku = String(p.sku || '').trim();
  const newSku = inHouseFormat(oldSku) ? oldSku : nextFor(prefix);
  if (oldSku !== newSku) {
    if (oldSku) productMap.set(oldSku, newSku);
    changes.push({ kind: 'product', name: p.name || p.id, from: oldSku || '(blank)', to: newSku });
  }
  p.sku = newSku;

  if (Array.isArray(p.variants)) {
    let seq = 0;
    // Keep any suffix already hanging off this product's own SKU, so a variant
    // that is already correct is not renumbered underneath it.
    for (const v of p.variants) {
      const m = new RegExp(`^${newSku}-(\\d+)$`, 'i').exec(String(v.sku || ''));
      if (m) seq = Math.max(seq, parseInt(m[1], 10));
    }
    for (const v of p.variants) {
      const oldV = String(v.sku || '').trim();
      if (new RegExp(`^${newSku}-\\d+$`, 'i').test(oldV)) continue;
      const newV = `${newSku}-${String(++seq).padStart(2, '0')}`;
      if (oldV) variantMap.set(oldV, newV);
      changes.push({ kind: 'variant', name: `${p.name || p.id} / ${v.name || '(unnamed)'}`, from: oldV || '(blank)', to: newV });
      v.sku = newV;
    }
  }
}

// Referencing files.
const hddDb = readDb('hdd-reports.db', 'reports');
let hddTouched = 0;
if (hddDb) {
  for (const r of hddDb.reports) {
    const mapped = variantMap.get(String(r.linkedVariantSku || ''));
    if (mapped) { r.linkedVariantSku = mapped; hddTouched++; }
  }
}

const cartDb = readDb('carts.db', 'carts');
let cartTouched = 0;
if (cartDb) {
  for (const c of cartDb.carts) {
    for (const it of (c.items || [])) {
      const v = variantMap.get(String(it._variantSku || ''));
      if (v) { it._variantSku = v; cartTouched++; }
      const s = variantMap.get(String(it.sku || '')) || productMap.get(String(it.sku || ''));
      if (s) { it.sku = s; cartTouched++; }
    }
  }
}

if (changes.length === 0) {
  console.log('Every SKU is already in the house format. Nothing to do.');
  process.exit(0);
}

const width = Math.max(...changes.map(c => c.from.length), 8);
console.log(`\n${changes.length} SKU${changes.length === 1 ? '' : 's'} to rewrite:\n`);
for (const c of changes) {
  console.log(`  ${c.kind.padEnd(7)} ${c.from.padEnd(width)} ->  ${c.to.padEnd(14)} ${c.name}`);
}
console.log(`\nReferences to update: ${hddTouched} in hdd-reports.db, ${cartTouched} in carts.db`);
console.log('orders.db is left untouched: past order lines record what was sold under the old code.');

if (!APPLY) {
  console.log('\nDry run. Nothing has been written. Re-run with --apply to commit these changes.\n');
  process.exit(0);
}

const backups = ['products.db', 'hdd-reports.db', 'carts.db'].map(backup).filter(Boolean);
console.log(`\nBackups written: ${backups.join(', ')}`);

writeDb('products.db', productDb);
if (hddDb && hddTouched > 0) writeDb('hdd-reports.db', hddDb);
if (cartDb && cartTouched > 0) writeDb('carts.db', cartDb);

console.log('Done. Restart the server so it picks up the rewritten catalog.\n');
