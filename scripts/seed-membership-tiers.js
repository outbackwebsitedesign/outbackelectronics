#!/usr/bin/env node
// Run from the repo root: node scripts/seed-membership-tiers.js
// Writes the three default membership tiers into memberships.db only if the tiers array is empty.

const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'memberships.db');
const TMP_PATH = DB_PATH + '.tmp';

const DEFAULT_TIERS = [
  {
    id: 'basic',
    name: 'Basic Member',
    price: 9,
    priceAud: 9,
    billingCycle: 'one-off',
    status: 'published',
    description: 'Join the community and get access to member-only groups and the monthly newsletter.',
    features: [
      'Member-only forum groups',
      'Monthly members newsletter',
      'Early access to new tutorials',
      'Member badge on your forum profile',
    ],
    color: 'tag-euc',
  },
  {
    id: 'pro',
    name: 'Pro Member',
    price: 19,
    priceAud: 19,
    billingCycle: 'one-off',
    status: 'published',
    description: 'Everything in Basic plus exclusive deep-dive content, pro groups, and a 10% discount in the shop.',
    features: [
      'Everything in Basic',
      'Pro-only blog posts & build logs',
      'Pro member groups',
      '1% discount on all shop purchases',
      'Priority support queue',
    ],
    discountPercent: 1,
    color: 'tag-rust',
    highlight: true,
  },
  {
    id: 'elite',
    name: 'Elite Member',
    price: 39,
    priceAud: 39,
    billingCycle: 'one-off',
    status: 'published',
    description: 'Full access, every group, every post, workshop event invites, and the biggest shop discount we offer.',
    features: [
      'Everything in Pro',
      'Elite-only groups & special content',
      '2% discount on all shop purchases',
      'One free bench diagnostic per month',
      'Workshop & field event invites',
      'Direct line to the tech team',
    ],
    discountPercent: 2,
    color: 'tag-ochre',
  },
];

let data = { tiers: [], subscriptions: [] };

if (fs.existsSync(DB_PATH)) {
  try {
    data = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
    data.tiers = data.tiers || [];
    data.subscriptions = data.subscriptions || [];
  } catch (e) {
    console.error('Could not parse memberships.db:', e.message);
    process.exit(1);
  }
}

if (data.tiers.length > 0) {
  console.log(`memberships.db already has ${data.tiers.length} tier(s), nothing to seed.`);
  process.exit(0);
}

data.tiers = DEFAULT_TIERS;

fs.writeFileSync(TMP_PATH, JSON.stringify(data, null, 2));
fs.renameSync(TMP_PATH, DB_PATH);

console.log(`Seeded ${DEFAULT_TIERS.length} membership tiers into memberships.db.`);
