// External spec datasets the PC builder can refresh itself from.
//
// CommonJS so server.js can require it, and so scripts/build-cpu-catalog.js can
// share exactly one copy of the mapping logic rather than keeping its own.
//
// Each source declares where its data lives and how to turn a row into a part
// in our own schema. Fetching is the server's job (see the sources/sync
// endpoint); everything here is pure, so the mappers can be tested against a
// saved file with no network involved.
//
// Three rules every mapper follows:
//
//   1. Never import a price. These datasets carry US retail figures that have
//      nothing to do with what the shop pays or charges, and quoting off them
//      would be actively wrong. Pricing comes from the catalog or a supplier
//      feed.
//   2. Only emit a spec the source actually states. A missing spec makes the
//      compatibility checker skip a rule and say so, which is recoverable; a
//      guessed one is reported to staff as fact, which is not.
//   3. Use a stable seedId so a re-sync updates in place. Parts whose specs a
//      staff member has edited are skipped entirely by the upsert.

const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80);

// ── Shared parsing helpers ───────────────────────────────────────────────────

function parseCsv(text) {
  const src = String(text).replace(/^﻿/, '');
  const rows = [];
  let row = [], field = '', q = false, i = 0;
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

function watts(raw) {
  const m = String(raw).match(/([\d.]+)\s*W?/i);
  const n = m ? Number(m[1]) : NaN;
  return Number.isFinite(n) && n > 0 ? Math.round(n) : undefined;
}

function intCount(raw) {
  const n = parseInt(String(raw).replace(/[^\d]/g, ''), 10);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

function mm(raw) {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : undefined;
}

// Drop the word "Processor" wherever it appears but keep everything around it.
// Intel writes it mid-name ("Intel Xeon Processor E5-2670"), so stripping from
// that word onwards threw the model number away and collapsed 441 Xeons, plus
// every Pentium, Celeron and Itanium, into one entry each.
function cleanName(raw) {
  return String(raw)
    .replace(/[®™©]/g, '')
    .replace(/\bprocessors?\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Sources describe colour freely ("Black / Silver", "White / Black", "Matte
// Black"). Two-tone parts take the colour named first, because that is the one
// these sources lead with and the one the part reads as: a "White / Black" case
// belongs in a white build, and forcing every two-tone part into a Multi bucket
// would hide most of the catalog from a colour filter.
const COLOUR_WORDS = [
  ['white', 'White'], ['black', 'Black'], ['silver', 'Silver'], ['grey', 'Grey'], ['gray', 'Grey'],
  ['pink', 'Pink'], ['blue', 'Blue'], ['red', 'Red'], ['green', 'Green'],
  ['wood', 'Wood / natural'], ['walnut', 'Wood / natural'], ['oak', 'Wood / natural'],
];
function normaliseColour(raw) {
  const t = String(raw || '').toLowerCase();
  if (!t) return undefined;
  let best = null;
  for (const [word, value] of COLOUR_WORDS) {
    const at = t.indexOf(word);
    if (at >= 0 && (best === null || at < best.at)) best = { at, value };
  }
  // Only reads as RGB when no actual colour is named alongside it.
  if (!best) return /rgb/.test(t) ? 'Multi / RGB' : undefined;
  return best.value;
}

// ── CPU spec dataset (Intel ARK + AMD published specs) ───────────────────────

function isSoldered(socket) {
  const s = String(socket).toUpperCase();
  return s.includes('BGA') || /^(FP|FT|FF)\d/.test(s) || s.startsWith('FCBGA');
}

function normaliseSocket(raw) {
  // Source rows carry things like "LGA1155. FCLGA1155", "FM1 UPGA" and
  // comma-separated lists. Take the first token and drop the FC packaging
  // prefix, keeping revision suffixes such as LGA2011-3 intact.
  return String(raw).split(/[,/.]|\s+/)[0].trim().toUpperCase().replace(/^FC/, '');
}

// Only commit to a memory generation where the part supports exactly one. Intel
// 12th to 14th gen run DDR4 or DDR5 depending on the board, and recording either
// would make the compatibility check contradict a perfectly valid build.
function memoryType(raw) {
  const t = String(raw).toUpperCase().replace(/LPDDR/g, 'LP');
  const gens = ['DDR5', 'DDR4', 'DDR3', 'DDR2'].filter(g => new RegExp(`(^|[^P])${g}`).test(t));
  return gens.length === 1 ? gens[0] : undefined;
}

function mapIntelCpus(rows) {
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

    out.push({ seedId: `cpu-i-${slug(name)}`, category: 'cpu', brand: 'Intel', name, specs });
  }
  return out;
}

function mapAmdCpus(rows) {
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

    out.push({ seedId: `cpu-a-${slug(name)}`, category: 'cpu', brand: 'AMD', name, specs });
  }
  return out;
}

// ── PC part dataset (per-model retail parts) ─────────────────────────────────
// The value here is the physical and cosmetic detail the manufacturers do not
// publish in bulk: the length of a specific board partner graphics card, and
// the colour of nearly everything.

const brandOf = (name) => String(name).trim().split(/\s+/)[0] || '';

// Product names in these sources are not unique. "Sapphire PULSE" covers dozens
// of different cards and "Montech XR" covers both the black and the white one,
// so keying on the name alone collapses distinct products into a single part
// and merges their specs into something that does not exist. The identity has
// to include whatever actually distinguishes the variant.
function variantId(prefix, name, specs, keys) {
  const bits = keys.map(k => specs[k]).filter(v => v !== undefined && v !== null && v !== '');
  return `${prefix}-${slug(name)}${bits.length ? '-' + slug(bits.join('-')) : ''}`;
}

// The picker shows the name, so it has to carry the distinguishing detail too.
// Thirty-nine rows all reading "Sapphire PULSE" are useless to choose between.
function withDetail(name, ...extras) {
  let out = String(name).trim();
  for (const extra of extras) {
    const e = String(extra || '').trim();
    if (!e) continue;
    if (out.toLowerCase().includes(e.toLowerCase())) continue;
    out += ` ${e}`;
  }
  return out.replace(/\s+/g, ' ').trim();
}

function mapVideoCards(rows) {
  const out = [];
  for (const r of rows) {
    const name = cleanName(r.name);
    if (!name) continue;
    const specs = {};
    // The reason this source is worth having: length belongs to the individual
    // card, not the chip, and it is what the case clearance check reads.
    const len = mm(r.length);
    if (len) specs.lengthMm = len;
    const col = normaliseColour(r.color);
    if (col) specs.colour = col;
    if (!Object.keys(specs).length) continue;
    const chipset = r.chipset ? String(r.chipset).trim() : '';
    if (chipset) {
      specs.chipset = chipset;
      const tdp = tdpForChipset(chipset);
      if (tdp) specs.tdp = tdp;
    }
    // Colour belongs in the name as well as the specs: the black and the white
    // version of the same card are otherwise identical rows in the picker, and
    // a quote line would not say which one was quoted.
    const display = withDetail(name, chipset, specs.colour);
    out.push({
      seedId: variantId('gpu-d', name, specs, ['chipset', 'lengthMm', 'colour']),
      category: 'gpu', brand: brandOf(name), name: display, specs,
    });
  }
  return out;
}

function mapMotherboards(rows) {
  const out = [];
  for (const r of rows) {
    const name = cleanName(r.name);
    if (!name || !r.socket) continue;
    const specs = { socket: normaliseSocket(r.socket) };
    const ff = String(r.form_factor || '').trim();
    // Normalise to the vocabulary the fit rules use.
    const ffMap = { 'ATX': 'ATX', 'Micro ATX': 'Micro-ATX', 'MicroATX': 'Micro-ATX', 'Mini ITX': 'Mini-ITX',
      'MiniITX': 'Mini-ITX', 'EATX': 'E-ATX', 'E-ATX': 'E-ATX', 'Extended ATX': 'E-ATX' };
    const norm = ffMap[ff] || ffMap[ff.replace(/-/g, ' ')] || (/^atx$/i.test(ff) ? 'ATX' : undefined);
    if (norm) specs.formFactor = norm;
    const slots = intCount(r.memory_slots);
    if (slots) specs.memorySlots = slots;
    const maxMem = intCount(r.max_memory);
    if (maxMem) specs.maxMemoryGb = maxMem;
    const col = normaliseColour(r.color);
    if (col) specs.colour = col;
    out.push({
      seedId: variantId('mb-d', name, specs, ['socket', 'colour']),
      category: 'motherboard', brand: brandOf(name), name: withDetail(name, specs.colour), specs,
    });
  }
  return out;
}

function mapPowerSupplies(rows) {
  const out = [];
  for (const r of rows) {
    const name = cleanName(r.name);
    if (!name) continue;
    const specs = {};
    const w = intCount(r.wattage);
    if (w) specs.wattage = w;
    const t = String(r.type || '').trim();
    const ffMap = { 'ATX': 'ATX', 'SFX': 'SFX', 'SFX-L': 'SFX-L', 'TFX': 'TFX' };
    if (ffMap[t]) specs.formFactor = ffMap[t];
    if (r.efficiency) specs.efficiency = String(r.efficiency).trim();
    const col = normaliseColour(r.color);
    if (col) specs.colour = col;
    if (!Object.keys(specs).length) continue;
    out.push({
      seedId: variantId('psu-d', name, specs, ['wattage', 'formFactor', 'colour']),
      category: 'psu', brand: brandOf(name), name: withDetail(name, specs.wattage ? `${specs.wattage}W` : '', specs.colour), specs,
    });
  }
  return out;
}

function mapCases(rows) {
  const out = [];
  for (const r of rows) {
    const name = cleanName(r.name);
    if (!name) continue;
    const specs = {};
    // This source carries no GPU clearance and no cooler height, the two specs
    // the fit checks most want. What it does give is the board size it takes
    // and the colour, so those are imported and the clearances stay blank for
    // staff to fill in on the cases actually stocked.
    const type = String(r.type || '');
    if (/mini itx|mini-itx/i.test(type)) specs.maxBoardFormFactor = 'Mini-ITX';
    else if (/micro atx|microatx|micro-atx/i.test(type)) specs.maxBoardFormFactor = 'Micro-ATX';
    else if (/eatx|e-atx|full tower/i.test(type)) specs.maxBoardFormFactor = 'E-ATX';
    else if (/atx/i.test(type)) specs.maxBoardFormFactor = 'ATX';
    const bays = intCount(r.internal_35_bays);
    if (bays) specs.bays35 = bays;
    const col = normaliseColour(r.color);
    if (col) specs.colour = col;
    if (!Object.keys(specs).length) continue;
    out.push({
      seedId: variantId('case-d', name, specs, ['maxBoardFormFactor', 'colour']),
      category: 'case', brand: brandOf(name), name: withDetail(name, specs.colour), specs,
    });
  }
  return out;
}

function mapCoolers(rows) {
  const out = [];
  for (const r of rows) {
    const name = cleanName(r.name);
    if (!name) continue;
    const specs = {};
    // `size` is the radiator on liquid coolers and blank on air ones, so it
    // identifies the type as well. Air cooler height is not in this source and
    // is the spec that matters most, so it stays blank.
    const rad = intCount(r.size);
    if (rad) { specs.radiatorMm = rad; specs.coolerType = 'Liquid (AIO)'; }
    const col = normaliseColour(r.color);
    if (col) specs.colour = col;
    if (!Object.keys(specs).length) continue;
    out.push({
      seedId: variantId('cool-d', name, specs, ['radiatorMm', 'colour']),
      category: 'cooler', brand: brandOf(name), name: withDetail(name, specs.radiatorMm ? `${specs.radiatorMm}mm` : '', specs.colour), specs,
    });
  }
  return out;
}

function mapMemory(rows) {
  const out = [];
  for (const r of rows) {
    const name = cleanName(r.name);
    if (!name) continue;
    const specs = {};
    // "DDR4-3200 CL16" style, and modules as [count, gbEach].
    const gen = String(r.speed && Array.isArray(r.speed) ? `DDR${r.speed[0]}` : (r.speed || name));
    const mt = memoryType(gen.match(/DDR\d/) ? gen : name);
    if (mt) specs.memoryType = mt;
    if (Array.isArray(r.modules) && r.modules.length === 2) {
      const [count, each] = r.modules.map(Number);
      if (count > 0) specs.moduleCount = count;
      if (count > 0 && each > 0) specs.capacityGb = count * each;
    }
    if (Array.isArray(r.speed) && r.speed.length === 2 && Number(r.speed[1]) > 0) specs.speedMhz = Number(r.speed[1]);
    // Latency distinguishes otherwise identical kits (a DDR5-6000 CL30 and a
    // CL36 are different products at different prices), so without it they
    // collapse into one part the way the colour variants used to.
    const cl = intCount(r.cas_latency);
    if (cl) specs.casLatency = cl;
    const col = normaliseColour(r.color);
    if (col) specs.colour = col;
    if (!Object.keys(specs).length) continue;
    const speedLabel = specs.memoryType && specs.speedMhz ? `${specs.memoryType}-${specs.speedMhz}` : '';
    out.push({
      seedId: variantId('ram-d', name, specs, ['memoryType', 'capacityGb', 'moduleCount', 'speedMhz', 'casLatency', 'colour']),
      category: 'ram', brand: brandOf(name), name: withDetail(name, speedLabel, cl ? `CL${cl}` : '', specs.colour), specs,
    });
  }
  return out;
}

function mapStorage(rows) {
  const out = [];
  for (const r of rows) {
    const name = cleanName(r.name);
    if (!name) continue;
    const specs = {};

    // "M.2 PCIe 4.0 X4", "M.2 PCIe 3.0 X2", "SATA 6 Gb/s", "M.2 SATA", "U.2".
    // Only the family matters to the compatibility rules: an M.2 drive occupies
    // an M.2 slot and a SATA drive occupies a SATA port, whatever the revision.
    const iface = String(r.interface || '');
    if (/^m\.?2/i.test(iface)) specs.interface = /sata/i.test(iface) ? 'M.2 SATA' : 'M.2 NVMe';
    else if (/^u\.?2/i.test(iface)) specs.interface = 'U.2';
    else if (/sata/i.test(iface)) specs.interface = 'SATA';

    // "M.2-2280", "2.5\"", "3.5\"". The physical size decides which bay it
    // needs, which is what the case bay counts are checked against.
    const ff = String(r.form_factor || '');
    if (/^m\.?2/i.test(ff)) specs.driveSize = 'M.2';
    else if (/2\.5/.test(ff)) specs.driveSize = '2.5"';
    else if (/3\.5/.test(ff)) specs.driveSize = '3.5"';
    else if (specs.interface && specs.interface.startsWith('M.2')) specs.driveSize = 'M.2';

    const cap = intCount(r.capacity);
    if (cap) specs.capacityGb = cap;

    // `type` holds "SSD" or the spindle speed for a mechanical drive, which is
    // the main thing separating otherwise identically named drives: this source
    // names a whole Barracuda generation just "Seagate BarraCuda", so without
    // the speed and cache twenty-two distinct 1TB drives collapse into one.
    const type = String(r.type || '').trim();
    if (/^ssd$/i.test(type)) specs.driveType = 'SSD';
    else if (/^\d+$/.test(type)) { specs.driveType = 'HDD'; specs.rpm = Number(type); }
    const cache = intCount(r.cache);
    if (cache) specs.cacheMb = cache;
    if (!Object.keys(specs).length) continue;

    const capLabel = cap ? (cap >= 1000 && cap % 1000 === 0 ? `${cap / 1000}TB` : `${cap}GB`) : '';
    const speedLabel = specs.rpm ? `${specs.rpm}rpm` : (specs.driveType === 'SSD' ? 'SSD' : '');
    out.push({
      seedId: variantId('sto-d', name, specs, ['capacityGb', 'interface', 'driveSize', 'driveType', 'rpm', 'cacheMb']),
      category: 'storage', brand: brandOf(name),
      // An M.2 interface already implies the M.2 size, so naming both reads
      // "M.2 M.2 NVMe".
      name: withDetail(
        name, capLabel, speedLabel,
        String(specs.interface || '').startsWith('M.2') ? '' : specs.driveSize,
        specs.interface, cache ? `${cache}MB cache` : ''),
      specs,
    });
  }
  return out;
}

function mapCaseFans(rows) {
  const out = [];
  for (const r of rows) {
    const name = cleanName(r.name);
    if (!name) continue;
    const specs = {};
    const size = intCount(r.size);
    if (size) specs.sizeMm = size;
    const col = normaliseColour(r.color);
    if (col) specs.colour = col;
    if (!Object.keys(specs).length) continue;
    out.push({
      seedId: variantId('fan-d', name, specs, ['sizeMm', 'colour']),
      category: 'fan', brand: brandOf(name),
      name: withDetail(name, size ? `${size}mm` : '', specs.colour),
      specs,
    });
  }
  return out;
}

function mapMonitors(rows) {
  const out = [];
  for (const r of rows) {
    const name = cleanName(r.name);
    if (!name) continue;
    const specs = {};
    const size = Number(r.screen_size);
    if (Number.isFinite(size) && size > 0) specs.sizeIn = size;
    const hz = intCount(r.refresh_rate);
    if (hz) specs.refreshHz = hz;
    if (!Object.keys(specs).length) continue;
    // Resolution is what a customer actually picks on, so it goes in the name
    // even though no compatibility rule reads it.
    const res = Array.isArray(r.resolution) && r.resolution.length === 2 ? `${r.resolution[0]}x${r.resolution[1]}` : '';
    out.push({
      seedId: variantId('mon-d', name, specs, ['sizeIn', 'refreshHz']),
      category: 'monitor', brand: brandOf(name),
      name: withDetail(name, size ? `${size}"` : '', res, hz ? `${hz}Hz` : ''),
      specs,
    });
  }
  return out;
}

// Accessories and peripherals carry no compatibility rules: nothing about a
// keyboard can stop a machine booting. They exist so a complete system can be
// quoted from one build instead of the extras being typed in by hand every
// time, so the mapper keeps the descriptive detail in the name and records only
// colour, which the build colour theme reads.
function makeAccessoryMapper(prefix, category, detail) {
  return (rows) => {
    const out = [];
    for (const r of rows) {
      const name = cleanName(r.name);
      if (!name) continue;
      const specs = {};
      const col = normaliseColour(r.color);
      if (col) specs.colour = col;
      const extras = (detail ? detail(r) : []).filter(Boolean);
      out.push({
        seedId: variantId(prefix, name, specs, ['colour']),
        category, brand: brandOf(name),
        name: withDetail(name, ...extras, specs.colour),
        specs,
      });
    }
    return out;
  };
}

const ACCESSORY_FILES = [
  { file: 'thermal-paste', prefix: 'tp-d', category: 'other', detail: r => [r.amount ? `${r.amount}g` : ''] },
  { file: 'fan-controller', prefix: 'fc-d', category: 'other', detail: r => [r.channels ? `${r.channels} channel` : ''] },
  { file: 'ups', prefix: 'ups-d', category: 'other', detail: r => [r.capacity_va ? `${r.capacity_va}VA` : '', r.capacity_w ? `${r.capacity_w}W` : ''] },
  { file: 'sound-card', prefix: 'snd-d', category: 'other', detail: r => [r.channels ? `${r.channels}ch` : ''] },
  { file: 'wired-network-card', prefix: 'net-d', category: 'other', detail: r => [r.interface] },
  { file: 'wireless-network-card', prefix: 'wifi-d', category: 'other', detail: r => [r.protocol] },
  { file: 'case-accessory', prefix: 'acc-d', category: 'other', detail: r => [r.type, r.form_factor] },
];

const PERIPHERAL_FILES = [
  { file: 'keyboard', prefix: 'kb-d', category: 'peripheral', detail: r => [r.style, r.switches, r.connection_type] },
  { file: 'mouse', prefix: 'mou-d', category: 'peripheral', detail: r => [r.connection_type, r.max_dpi ? `${r.max_dpi}dpi` : ''] },
  { file: 'headphones', prefix: 'hp-d', category: 'peripheral', detail: r => [r.type, r.wireless ? 'wireless' : ''] },
  { file: 'speakers', prefix: 'spk-d', category: 'peripheral', detail: r => [r.configuration, r.wattage ? `${r.wattage}W` : ''] },
  { file: 'webcam', prefix: 'cam-d', category: 'peripheral', detail: r => [r.fov ? `${r.fov} FOV` : ''] },
];

const bundleFiles = (defs) => defs.map(d => ({
  url: `${RAW_PARTS}/${d.file}.json`,
  map: makeAccessoryMapper(d.prefix, d.category, d.detail),
}));

// ── Source registry ──────────────────────────────────────────────────────────

// The built-in catalogs ship in the repo, so they need no network and are the
// fallback when a remote source is unreachable. They are the only source for
// case clearances, cooler heights and socket support, graphics card power draw,
// and the storage, fan and OS categories.
const { PC_PARTS_SEED } = require('./pc-parts-seed');
const { PC_CPU_CATALOG } = require('./pc-parts-cpus');

// Remote card listings give a card's length but almost never its power draw,
// which left the build power estimate excluding the part most likely to
// dominate it. The built-in catalog records draw per GPU chip, and every card
// row names its chipset, so the two join up.
const TDP_BY_CHIPSET = (() => {
  const map = new Map();
  for (const p of PC_PARTS_SEED) {
    if (p.category !== 'gpu') continue;
    const tdp = p.specs && p.specs.tdp;
    if (tdp) map.set(String(p.name).toLowerCase().replace(/[^a-z0-9]/g, ''), tdp);
  }
  return map;
})();

function tdpForChipset(chipset) {
  if (!chipset) return undefined;
  const key = String(chipset).toLowerCase().replace(/[^a-z0-9]/g, '');
  if (TDP_BY_CHIPSET.has(key)) return TDP_BY_CHIPSET.get(key);
  // Card listings append the memory size ("GeForce RTX 3060 12GB"), so retry
  // without a trailing capacity before giving up.
  const trimmed = key.replace(/\d+gb$/, '');
  return TDP_BY_CHIPSET.get(trimmed);
}

const RAW_CPU = 'https://raw.githubusercontent.com/felixsteinke/cpu-spec-dataset/main/dataset';
const RAW_PARTS = 'https://raw.githubusercontent.com/docyx/pc-part-dataset/main/data/json';

const DATA_SOURCES = [
  {
    id: 'cpu-intel', label: 'Intel CPUs', category: 'cpu', format: 'csv',
    url: `${RAW_CPU}/intel-cpus.csv`,
    provenance: 'felixsteinke/cpu-spec-dataset, compiled from Intel ARK',
    gives: 'socket, TDP, cores, memory generation',
    map: mapIntelCpus,
  },
  {
    id: 'cpu-amd', label: 'AMD CPUs', category: 'cpu', format: 'csv',
    url: `${RAW_CPU}/amd-cpus.csv`,
    provenance: "felixsteinke/cpu-spec-dataset, compiled from AMD's published specifications",
    gives: 'socket, TDP, cores, memory generation, integrated graphics',
    map: mapAmdCpus,
  },
  {
    id: 'gpu-cards', label: 'Graphics cards', category: 'gpu', format: 'json',
    url: `${RAW_PARTS}/video-card.json`,
    provenance: 'docyx/pc-part-dataset, scraped from PCPartPicker',
    gives: 'card length in mm and colour, per board partner model',
    map: mapVideoCards,
  },
  {
    id: 'motherboards', label: 'Motherboards', category: 'motherboard', format: 'json',
    url: `${RAW_PARTS}/motherboard.json`,
    provenance: 'docyx/pc-part-dataset, scraped from PCPartPicker',
    gives: 'socket, form factor, memory slots, max memory, colour',
    map: mapMotherboards,
  },
  {
    id: 'power-supplies', label: 'Power supplies', category: 'psu', format: 'json',
    url: `${RAW_PARTS}/power-supply.json`,
    provenance: 'docyx/pc-part-dataset, scraped from PCPartPicker',
    gives: 'wattage, form factor, efficiency, colour',
    map: mapPowerSupplies,
  },
  {
    id: 'cases', label: 'Cases', category: 'case', format: 'json',
    url: `${RAW_PARTS}/case.json`,
    provenance: 'docyx/pc-part-dataset, scraped from PCPartPicker',
    gives: 'board size and colour. No GPU or cooler clearance, those stay manual',
    map: mapCases,
  },
  {
    id: 'coolers', label: 'CPU coolers', category: 'cooler', format: 'json',
    url: `${RAW_PARTS}/cpu-cooler.json`,
    provenance: 'docyx/pc-part-dataset, scraped from PCPartPicker',
    gives: 'radiator size and colour. No air cooler height, that stays manual',
    map: mapCoolers,
  },
  {
    id: 'memory', label: 'Memory', category: 'ram', format: 'json',
    url: `${RAW_PARTS}/memory.json`,
    provenance: 'docyx/pc-part-dataset, scraped from PCPartPicker',
    gives: 'generation, kit size, module count, speed, colour',
    map: mapMemory,
  },
  {
    id: 'storage', label: 'Storage', category: 'storage', format: 'json',
    url: `${RAW_PARTS}/internal-hard-drive.json`,
    provenance: 'docyx/pc-part-dataset, scraped from PCPartPicker',
    gives: 'interface, drive size and capacity, which the M.2 slot, SATA port and drive bay checks read',
    map: mapStorage,
  },
  {
    id: 'case-fans', label: 'Case fans', category: 'fan', format: 'json',
    url: `${RAW_PARTS}/case-fan.json`,
    provenance: 'docyx/pc-part-dataset, scraped from PCPartPicker',
    gives: 'size and colour',
    map: mapCaseFans,
  },
  {
    id: 'monitors', label: 'Monitors', category: 'monitor', format: 'json',
    url: `${RAW_PARTS}/monitor.json`,
    provenance: 'docyx/pc-part-dataset, scraped from PCPartPicker',
    gives: 'screen size, resolution and refresh rate, for quoting a complete system',
    map: mapMonitors,
  },
  {
    id: 'accessories', label: 'Accessories and expansion', category: 'other', kind: 'bundle',
    provenance: 'docyx/pc-part-dataset, scraped from PCPartPicker',
    gives: 'thermal paste, fan controllers, UPS units, sound and network cards. Support brackets, cable extensions and risers are not in any dataset and stay manual',
    files: () => bundleFiles(ACCESSORY_FILES),
  },
  {
    id: 'peripherals', label: 'Peripherals', category: 'peripheral', kind: 'bundle',
    provenance: 'docyx/pc-part-dataset, scraped from PCPartPicker',
    gives: 'keyboards, mice, headsets, speakers and webcams, for quoting a complete system',
    files: () => bundleFiles(PERIPHERAL_FILES),
  },
  // Last on purpose. These fill in the specs the datasets above do not carry,
  // merging into the parts those already created rather than sitting alongside
  // them as a second copy of the same product.
  {
    id: 'builtin-cpus', label: 'Built-in CPU catalog', category: 'cpu', kind: 'builtin', mergeByName: true,
    provenance: 'Ships with the site, generated from the CPU sources above',
    gives: 'the same CPUs, available offline when the sources above cannot be reached',
    load: () => PC_CPU_CATALOG,
  },
  {
    id: 'builtin-catalog', label: 'Built-in component catalog', category: 'all', kind: 'builtin', mergeByName: true,
    provenance: 'Ships with the site, no network needed',
    gives: 'case clearances, cooler heights and sockets, GPU power draw, and the storage, fan and OS categories',
    load: () => PC_PARTS_SEED,
  },
];

// Identity of a physical product across sources. The built-in catalog calls a
// case "4000D Airflow" by Corsair while a listing calls it "Corsair 4000D
// Airflow Black", and they are the same case: without this they land as two
// parts, one holding the clearances and the other the colour, and whichever
// staff happen to pick decides whether the fit checks run at all.
//
// Colour stays in the key, because the black and the white version really are
// different products to order.
const COLOUR_TOKENS = ['black', 'white', 'silver', 'grey', 'gray', 'pink', 'blue', 'red', 'green', 'chalk', 'rgb'];
function identityKey(part) {
  const brand = String(part.brand || '').toLowerCase().trim();
  let text = String(part.name || '').toLowerCase();
  if (brand && text.startsWith(brand)) text = text.slice(brand.length);
  // Colour words are removed by name, not by stripping anything in brackets.
  // The built-in catalog writes form factor in brackets too, so discarding
  // bracketed text made "B650 (ATX)" and "B650 (Mini-ITX)" the same product and
  // let them overwrite each other's form factor and slot count on every sync.
  for (const c of COLOUR_TOKENS) text = text.replace(new RegExp(`\\b${c}\\b`, 'g'), ' ');
  const model = text.replace(/[^a-z0-9]/g, '');
  const colour = (part.specs && part.specs.colour) ? String(part.specs.colour).toLowerCase().replace(/[^a-z]/g, '') : '';
  if (!model) return null;
  return `${part.category}|${brand.replace(/[^a-z0-9]/g, '')}|${model}|${colour}`;
}

function parseSource(source, text) {
  if (source.kind === 'builtin') return source.load();
  const rows = source.format === 'csv' ? parseCsv(text) : JSON.parse(text);
  if (!Array.isArray(rows)) throw new Error('expected a list of rows');
  const mapped = source.map(rows);
  // After variant keying, a repeated seedId means the source listed the same
  // variant twice (commonly one row per retailer). Keep the first; merging them
  // would only re-introduce the specs of a product that does not exist.
  const seen = new Set();
  return mapped.filter(i => !seen.has(i.seedId) && seen.add(i.seedId));
}

module.exports = {
  DATA_SOURCES,
  parseSource,
  identityKey,
  parseCsv,
  normaliseColour,
  mapIntelCpus,
  mapAmdCpus,
};
