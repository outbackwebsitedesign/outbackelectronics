#!/usr/bin/env node
// Generates pc-parts-cpus.js, the offline CPU catalog for the PC builder.
//
// The admin can pull this data live from the Data sources tab. This script
// bakes the same result into a committed file so a fresh deploy has a usable
// library before anyone presses that button, and so the builder still works if
// the upstream dataset is unreachable.
//
//   node scripts/build-cpu-catalog.js                    # downloads
//   node scripts/build-cpu-catalog.js ./intel.csv ./amd.csv   # local copies
//
// The mapping lives in pc-datasources.js and is shared with the live sync, so
// the two can never disagree about what a row means.

const fs = require('fs');
const path = require('path');
const { DATA_SOURCES, parseSource } = require('../pc-datasources');

async function load(url, localPath) {
  if (localPath) return fs.readFileSync(localPath, 'utf8');
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} returned ${res.status}`);
  return res.text();
}

(async () => {
  const [intelPath, amdPath] = process.argv.slice(2);
  const intelSrc = DATA_SOURCES.find(s => s.id === 'cpu-intel');
  const amdSrc = DATA_SOURCES.find(s => s.id === 'cpu-amd');
  const intel = parseSource(intelSrc, await load(intelSrc.url, intelPath));
  const amd = parseSource(amdSrc, await load(amdSrc.url, amdPath));

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
// This is the offline copy. The same data can be refreshed live from the admin
// Data sources tab, which shares the mapping in pc-datasources.js.
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
})().catch(e => { console.error(e.message); process.exit(1); });
