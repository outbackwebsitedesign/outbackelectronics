#!/usr/bin/env node
// Run this ONCE on the Pi to migrate forum.db user accounts into users.db
// Usage:  node migrate-passwords.js            (applies changes)
//         node migrate-passwords.js --dry-run  (preview only)

const fs = require('fs');
const path = require('path');
const DRY_RUN = process.argv.includes('--dry-run');
const BASE = __dirname;

function read(file) {
  try { return JSON.parse(fs.readFileSync(path.join(BASE, file), 'utf8')); }
  catch (e) { console.error(`Cannot read ${file}:`, e.message); process.exit(1); }
}
function atomicWrite(file, data) {
  const full = path.join(BASE, file);
  fs.writeFileSync(full + '.tmp', JSON.stringify(data, null, 2));
  fs.renameSync(full + '.tmp', full);
}

const forumDb = read('forum.db');
const forumUsers = forumDb.users || [];

let usersDb;
try { usersDb = read('users.db'); } catch { usersDb = { users: [] }; }
const users = usersDb.users || [];

console.log(`forum.db:  ${forumUsers.length} users`);
console.log(`users.db:  ${users.length} users`);
console.log('');

let created = 0, skipped = 0;

for (const fu of forumUsers) {
  if (!fu.email || !fu.passwordHash) {
    console.log(`  SKIP    ${fu.username || fu.email} — no email or passwordHash`);
    skipped++;
    continue;
  }

  const existing = users.find(u => u.email && u.email.toLowerCase() === fu.email.toLowerCase());
  if (existing) {
    if (!existing.passwordHash) {
      console.log(`  UPDATE  ${fu.email} — adding passwordHash to existing record`);
      if (!DRY_RUN) existing.passwordHash = fu.passwordHash;
      created++;
    } else {
      console.log(`  SKIP    ${fu.email} — already exists in users.db`);
      skipped++;
    }
    continue;
  }

  // Copy the forum user record as-is into users.db
  console.log(`  CREATE  ${fu.email} (${fu.displayName || fu.username})`);
  if (!DRY_RUN) users.push({ ...fu });
  created++;
}

console.log('');
console.log(`Results: ${created} created/updated, ${skipped} skipped`);

if (DRY_RUN) {
  console.log('\n[DRY RUN] No changes written. Re-run without --dry-run to apply.');
} else {
  atomicWrite('users.db', { users });
  console.log(`\nusers.db updated — now has ${users.length} users.`);
  console.log('You can now log in with your existing email + password.');
}
