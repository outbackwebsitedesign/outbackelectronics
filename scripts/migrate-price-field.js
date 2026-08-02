#!/usr/bin/env node
// Collapse the two product price keys into one.
//
//   node scripts/migrate-price-field.js              # dry run
//   node scripts/migrate-price-field.js --apply      # writes, after a backup
//   node scripts/migrate-price-field.js --prefer=price [--apply]
//
// Products carried both `price` (what the shop displayed and the editor wrote)
// and `priceAud` (what checkout actually charged). Where the two disagreed the
// customer saw one number and was charged another. This makes `priceAud` the
// single source for both and removes `price` from every product.
//
// Default is --prefer=priceAud: keep the charged figure. Use --prefer=price to
// keep the displayed figure instead. Either way the dry run lists every product
// where the two disagree, with both values, so the choice is made with the
// damage visible rather than in the abstract.
//
// Variants are untouched. Their price has always lived on `price` alone, with
// no second key to disagree with.

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const APPLY = process.argv.includes('--apply');
const preferArg = process.argv.find(a => a.startsWith('--prefer='));
const PREFER = preferArg ? preferArg.split('=')[1] : 'priceAud';
if (!['price', 'priceAud'].includes(PREFER)) {
  console.error(`--prefer must be "price" or "priceAud", got "${PREFER}"`);
  process.exit(1);
}

const DB = path.join(ROOT, 'products.db');
if (!fs.existsSync(DB)) {
  console.error('products.db not found. Run this from the repo root on the server.');
  process.exit(1);
}

let db;
try { db = JSON.parse(fs.readFileSync(DB, 'utf8')); }
catch (err) { console.error(`Could not parse products.db: ${err.message}`); process.exit(1); }
if (!Array.isArray(db.products)) { console.error('products.db has no products array.'); process.exit(1); }

const num = v => (v == null || v === '' ? null : Number(v));
const conflicts = [];
const filled = [];
let removed = 0;

for (const p of db.products) {
  const legacy = num(p.price);
  const current = num(p.priceAud);
  const label = `${p.name || p.id} (${p.sku || 'no sku'})`;

  let chosen;
  if (current != null && legacy != null && current !== legacy) {
    chosen = PREFER === 'price' ? legacy : current;
    conflicts.push({ label, price: legacy, priceAud: current, chosen });
  } else {
    chosen = current != null ? current : legacy;
    if (current == null && legacy != null) filled.push({ label, chosen });
  }

  if (chosen != null) p.priceAud = chosen;
  if ('price' in p) { delete p.price; removed++; }
}

console.log(`\nproducts: ${db.products.length}`);
console.log(`price key removed from: ${removed}`);
console.log(`priceAud filled in from price: ${filled.length}`);
console.log(`disagreements: ${conflicts.length}   (keeping ${PREFER})\n`);

if (conflicts.length > 0) {
  const w = Math.max(...conflicts.map(c => c.label.length));
  console.log('  Products where the displayed and charged prices differed:');
  console.log(`  ${'product'.padEnd(w)}   displayed    charged   ->  keeping`);
  for (const c of conflicts) {
    console.log(`  ${c.label.padEnd(w)}   ${String(c.price).padStart(8)}   ${String(c.priceAud).padStart(8)}   ->  ${c.chosen}`);
  }
  console.log('');
}
if (filled.length > 0) {
  console.log(`  ${filled.length} product(s) had no priceAud and take their displayed price. These are the`);
  console.log('  ones created through the admin editor. No visible change to any of them.\n');
}

if (!APPLY) {
  console.log('Dry run. Nothing has been written.');
  console.log('Re-run with --apply to commit, or --prefer=price --apply to keep displayed prices.\n');
  process.exit(0);
}

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const bak = `${DB}.bak-${stamp}`;
fs.copyFileSync(DB, bak);
console.log(`Backup written: ${path.basename(bak)}`);

const tmp = DB + '.tmp';
fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
fs.renameSync(tmp, DB);

console.log('Done. Restart the server so it picks up the rewritten catalog.\n');
