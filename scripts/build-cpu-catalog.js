#!/usr/bin/env node
// Generates pc-parts-cpus.js, the comprehensive CPU catalog for the PC builder.
//
// The hand-written catalog in pc-parts-seed.js covers current retail platforms
// across every component category. This covers CPUs exhaustively instead, back
// through the older sockets a repair and refurb shop actually sees, and it is
// generated from published specification data rather than written by hand so
// the socket and TDP figures are sourced.
//
//   node scripts/build-cpu-catalog.js            # downloads the datasets
//   node scripts/build-cpu-catalog.js ./a.csv ./b.csv   # uses local copies
//
// Re-run it to refresh. The output is committed, so a deploy never needs
// network access, and seedIds are stable so re-seeding updates in place.
//
// Source: github.com/felixsteinke/cpu-spec-dataset, compiled from Intel ARK
// and AMD's published processor specifications. Confirm the dataset's licence
// terms before relying on it commercially.

const fs = require('fs');
const path = require('path');

const SOURCES = {
  intel: 'https://raw.githubusercontent.com/felixsteinke/cpu-spec-dataset/main/dataset/intel-cpus.csv',
  amd:   'https://raw.githubusercontent.com/felixsteinke/cpu-spec-dataset/main/dataset/amd-cpus.csv',
};

// Minimal RFC 4180 parser, same shape as the feed parser in server.js.
function parseCsv(text) {
  const src = String(text).replace(/^﻿/, '');
  const rows = []; let row = [], field = '', q = false, i = 0;
  while (i < src.length) {
    const c = src[i];
    if (q) {
      if (c === '"') { if (src[i + 1] === '"') { field += '"'; i += 2; continue; } q = false; i++; continue; }
      field += c; i++; continue;
    }
    if (c === '"') { q = true; i++; continue; }
    if (c === ',') { row.push(field); field = ''; i++; continue; }
    if (c === '\r') { i++; continue; }
    if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; i++; continue; }
    field += c; i++;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  const headers = rows.shift().map(h => h.trim());
  return rows.filter(r => r.some(v => (v || '').trim()))
    .map(r => Object.fromEntries(headers.map((h, n) => [h, r[n] ?? ''])));
}

function get(row, ...names) {
  for (const n of names) {
    const hit = Object.keys(row).find(k => k.trim().toLowerCase() === n.toLowerCase());
    if (hit && String(row[hit]).trim()) return String(row[hit]).trim();
  }
  return '';
}

// A soldered part cannot be bought and fitted, so it has no place in a builder.
function isSoldered(socket) {
  const s = socket.toUpperCase();
  return s.includes('BGA') || /^(FP|FT|FF)\d/.test(s) || s.startsWith('FCBGA');
}

// FCLGA1700 and LGA1700 are the same socket written two ways.
function normaliseSocket(raw) {
  // Source rows carry things like "LGA1155. FCLGA1155", "FM1 UPGA" and
  // comma-separated lists. Take the first token and drop the FC packaging
  // prefix, keeping revision suffixes such as LGA2011-3 intact.
  let s = raw.split(/[,/.]|\s+/) [0].trim().toUpperCase();
  s = s.replace(/^FC/, '');
  return s;
}

// Only commit to a memory generation where the part supports exactly one. Intel
// 12th to 14th gen run DDR4 or DDR5 depending on the board, and recording either
// would make the compatibility check contradict a perfectly valid build.
function memoryType(raw) {
  const t = raw.toUpperCase();
  const gens = ['DDR5', 'DDR4', 'DDR3', 'DDR2'].filter(g => new RegExp(`(^|[^P])${g}`).test(t.replace(/LPDDR/g, 'LP')));
  return gens.length === 1 ? gens[0] : undefined;
}

function watts(raw) {
  const m = String(raw).match(/([\d.]+)\s*W?/i);
  const n = m ? Number(m[1]) : NaN;
  return Number.isFinite(n) && n > 0 ? Math.round(n) : undefined;
}

function intCount(raw) {
  const n = parseInt(String(raw).replace(/[^\d]/g, ''), 10);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

function cleanName(raw) {
  return raw
    .replace(/[®™©]/g, '')
    .replace(/\s+Processor\b.*$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

function buildIntel(rows) {
  const out = [];
  for (const r of rows) {
    const socketRaw = get(r, 'SocketsSupported');
    if (!socketRaw || isSoldered(socketRaw)) continue;
    const name = cleanName(get(r, 'CpuName'));
    if (!name) continue;
    const socket = normaliseSocket(socketRaw);
    if (!/^(LGA|SP|G3|C3)/.test(socket)) continue;

    const specs = { socket };
    const mt = memoryType(get(r, 'MemoryTypes'));
    if (mt) specs.memoryType = mt;
    const tdp = watts(get(r, 'MaxTDP', 'ProcessorBasePower', 'AssuredPowerMax', 'ConfigTDPMax'));
    if (tdp) specs.tdp = tdp;
    const cores = intCount(get(r, 'CoreCount'));
    if (cores) specs.cores = cores;
    // Intel F and KF parts ship with the integrated graphics disabled. Anything
    // else with a graphics model listed has one.
    if (/\d+(KF|F)\b/i.test(name)) specs.integratedGraphics = false;
    else if (get(r, 'GraphicsModel', 'ProcessorGraphicsModelId', 'GraphicsFreqMhz')) specs.integratedGraphics = true;

    out.push({ seedId: `cpu-i-${slug(name)}`, brand: 'Intel', name, specs });
  }
  return out;
}

function buildAmd(rows) {
  const out = [];
  for (const r of rows) {
    const socketRaw = get(r, 'CPU Socket', 'Socket');
    if (!socketRaw || isSoldered(socketRaw)) continue;
    const name = cleanName(get(r, 'Model', 'Name'));
    if (!name) continue;
    const socket = normaliseSocket(socketRaw);
    if (!/^(AM\d|FM\d|STR|SP\d|TR|G34|C32|SWRX|AM1)/i.test(socket)) continue;

    const specs = { socket };
    const mt = memoryType(get(r, 'System Memory Type'));
    if (mt) specs.memoryType = mt;
    const tdp = watts(get(r, 'Default TDP', 'Thermal Design Power'));
    if (tdp) specs.tdp = tdp;
    const cores = intCount(get(r, '# of CPU Cores'));
    if (cores) specs.cores = cores;
    // The source states this outright, and the negative matters: it is what
    // makes the "no display output" check fire on a build with no card in it.
    const gfxModel = get(r, 'Graphics Model');
    const gfxCores = intCount(get(r, 'Graphics Core Count'));
    if (/discrete\s+graphics\s+card\s+req/i.test(gfxModel)) specs.integratedGraphics = false;
    else if (gfxCores || /radeon|vega|graphics/i.test(gfxModel)) specs.integratedGraphics = true;

    out.push({ seedId: `cpu-a-${slug(name)}`, brand: 'AMD', name, specs });
  }
  return out;
}

async function load(src, localPath) {
  if (localPath) return fs.readFileSync(localPath, 'utf8');
  const res = await fetch(src);
  if (!res.ok) throw new Error(`${src} returned ${res.status}`);
  return res.text();
}

(async () => {
  const [intelPath, amdPath] = process.argv.slice(2);
  const intel = buildIntel(parseCsv(await load(SOURCES.intel, intelPath)));
  const amd = buildAmd(parseCsv(await load(SOURCES.amd, amdPath)));

  // Later duplicates lose, so a stable seedId always maps to one entry.
  const seen = new Set();
  const all = [...amd, ...intel].filter(c => !seen.has(c.seedId) && seen.add(c.seedId));
  all.sort((a, b) => a.brand.localeCompare(b.brand) || a.name.localeCompare(b.name));

  const withSocket = all.filter(c => c.specs.socket).length;
  const withTdp = all.filter(c => c.specs.tdp).length;
  const body = all.map(c =>
    `  { seedId:${JSON.stringify(c.seedId)}, brand:${JSON.stringify(c.brand)}, name:${JSON.stringify(c.name)}, specs:${JSON.stringify(c.specs)} },`
  ).join('\n');

  const out = `// GENERATED FILE, DO NOT EDIT BY HAND.
// Regenerate with: node scripts/build-cpu-catalog.js
//
// ${all.length} socketed CPUs (${amd.length} AMD, ${intel.length} Intel), covering current and
// older desktop, workstation and server platforms. Soldered mobile parts are
// excluded: they cannot be bought and fitted, so they have no place in a build.
//
// Every spec here is sourced, not estimated. memoryType is omitted where a part
// supports more than one DDR generation (Intel 12th to 14th gen run DDR4 or
// DDR5 by board), because the board decides and recording either one would make
// the compatibility check contradict a valid build.
//
// Coverage: socket ${withSocket}/${all.length}, TDP ${withTdp}/${all.length}.
// Generated ${new Date().toISOString().slice(0, 10)} from github.com/felixsteinke/cpu-spec-dataset
// (compiled from Intel ARK and AMD published specifications).

export const PC_CPU_CATALOG = [
${body}
].map(c => ({ ...c, category: 'cpu' }));

export default PC_CPU_CATALOG;
`;
  const dest = path.join(__dirname, '..', 'pc-parts-cpus.js');
  fs.writeFileSync(dest, out);
  console.log(`wrote ${dest}`);
  console.log(`  ${all.length} CPUs (${amd.length} AMD, ${intel.length} Intel)`);
  console.log(`  socket ${withSocket}/${all.length}, TDP ${withTdp}/${all.length}`);
  const bySocket = {};
  for (const c of all) bySocket[c.specs.socket] = (bySocket[c.specs.socket] || 0) + 1;
  console.log('  sockets:', Object.entries(bySocket).sort((a, b) => b[1] - a[1]).map(([s, n]) => `${s}:${n}`).join(' '));
})().catch(e => { console.error(e.message); process.exit(1); });
