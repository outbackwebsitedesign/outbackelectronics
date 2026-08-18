// Icecat lookup: fill a part's specs from the manufacturer's own datasheet.
//
// This is the answer to the specs no bulk dataset carries. Case clearances,
// cooler heights and motherboard M.2 counts are published by the manufacturer
// and syndicated through Icecat, matched on manufacturer part number, which is
// what a supplier quote gives you. It is a per-part lookup rather than a bulk
// import, which suits ordering per build instead of stocking a range.
//
// CommonJS so server.js can require it. Pure apart from the fetch, so the
// mapping can be tested against a saved response.
//
// Credentials come from the environment, as the other integrations do:
//   ICECAT_USERNAME   the account name from your Icecat registration
//   ICECAT_APP_KEY    optional, only needed for Full Icecat brands
//
// Coverage is not guaranteed. Open Icecat is free for brands that sponsor it;
// others return 403 asking for a Full Icecat key. The lookup reports which of
// the two happened rather than just failing, so it is clear whether a miss is
// a missing product or a brand you are not entitled to.

const ICECAT_ENDPOINT = 'https://live.icecat.biz/api';

// Icecat feature names vary by category and by how a brand fills them in, so
// each spec lists several spellings. Matching is case-insensitive on the
// normalised name, longest pattern first, and anything unmatched is still
// returned so staff can map it by hand and so gaps here are visible.
const FEATURE_MAP = {
  case: [
    ['maxGpuLengthMm', ['maximum video card length', 'maximum graphics card length', 'compatible graphics card length', 'gpu clearance', 'max gpu length', 'video card compatibility']],
    ['maxCoolerHeightMm', ['maximum cpu cooler height', 'cpu cooler clearance', 'cpu cooler height', 'max cpu cooler height']],
    ['maxPsuLengthMm', ['maximum psu length', 'power supply length', 'psu clearance']],
    ['maxBoardFormFactor', ['motherboard form factors supported', 'supported motherboard form factor', 'motherboard compatibility', 'form factor compatibility']],
    ['psuFormFactor', ['power supply form factor', 'psu form factor', 'power supply type']],
    ['bays35', ['3.5" bays', 'number of 3.5" bays', 'internal 3.5" bays', '3.5" drive bays']],
    ['bays25', ['2.5" bays', 'number of 2.5" bays', 'internal 2.5" bays', '2.5" drive bays']],
    ['fanMounts', ['number of fan mounts', 'fan mounts', 'supported fan positions']],
    ['fansIncluded', ['fans included', 'number of fans installed', 'pre-installed fans']],
    ['radiatorMm', ['maximum radiator size', 'radiator support', 'liquid cooling support']],
    ['colour', ['colour', 'color', 'product colour', 'product color']],
  ],
  motherboard: [
    ['socket', ['processor socket', 'cpu socket', 'socket type', 'supported processor socket']],
    ['chipset', ['motherboard chipset', 'chipset', 'chipset family']],
    ['formFactor', ['motherboard form factor', 'form factor', 'board size']],
    ['memoryType', ['memory type', 'supported memory types', 'internal memory type', 'ram type']],
    ['memorySlots', ['number of memory slots', 'memory slots', 'memory slots type', 'dimm slots']],
    ['maxMemoryGb', ['maximum internal memory', 'max memory', 'maximum memory supported']],
    ['m2Slots', ['number of m.2 slots', 'm.2 slots', 'm.2 connectors', 'number of m.2 connectors']],
    ['sataPorts', ['number of sata connectors', 'sata connectors', 'sata iii ports', 'number of serial ata connectors']],
    ['pcieX16Slots', ['number of pci express x16 slots', 'pci express x16 slots', 'pcie x16 slots']],
  ],
  cooler: [
    ['heightMm', ['height', 'cooler height', 'product height']],
    ['radiatorMm', ['radiator size', 'radiator length']],
    ['tdpRating', ['maximum tdp', 'tdp rating', 'cooling capacity']],
    ['sockets', ['compatible processor sockets', 'supported sockets', 'processor socket', 'socket compatibility']],
    ['colour', ['colour', 'color']],
  ],
  gpu: [
    ['lengthMm', ['length', 'card length', 'product length', 'graphics card length']],
    ['tdp', ['power consumption', 'tdp', 'graphics card power']],
    ['slotWidth', ['expansion slots occupied', 'slot width', 'number of slots']],
    ['colour', ['colour', 'color']],
  ],
  psu: [
    ['wattage', ['total power output', 'power supply wattage', 'output power', 'wattage']],
    ['formFactor', ['power supply form factor', 'psu form factor', 'form factor']],
    ['lengthMm', ['depth', 'length', 'product depth']],
    ['efficiency', ['80 plus certification', 'efficiency certification', '80 plus']],
    ['colour', ['colour', 'color']],
  ],
  ram: [
    ['memoryType', ['internal memory type', 'memory type', 'ram type']],
    ['capacityGb', ['internal memory', 'memory capacity', 'total memory']],
    ['moduleCount', ['number of modules', 'module count', 'kit size']],
    ['speedMhz', ['memory clock speed', 'memory speed', 'clock speed']],
    ['casLatency', ['cas latency', 'cl']],
    ['colour', ['colour', 'color']],
  ],
  storage: [
    ['capacityGb', ['ssd capacity', 'hdd capacity', 'internal storage capacity', 'capacity']],
    ['driveSize', ['form factor', 'drive form factor']],
    ['interface', ['storage drive interface', 'interface', 'component interface']],
    ['rpm', ['rotational speed', 'spindle speed']],
    ['cacheMb', ['cache memory', 'buffer size']],
  ],
  fan: [
    ['sizeMm', ['fan diameter', 'fan size', 'width']],
    ['colour', ['colour', 'color']],
  ],
};

const normalise = (s) => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();

// Icecat presents values as "355 mm", "4 x SATA", "ATX, Micro-ATX", "Black".
// Pull the leading number for numeric specs and leave text ones alone.
function numberFrom(raw) {
  const m = String(raw).replace(/,/g, '').match(/(-?\d+(?:\.\d+)?)/);
  if (!m) return undefined;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : undefined;
}

// Which specs are numbers, so the right coercion is applied.
const NUMERIC_SPECS = new Set([
  'maxGpuLengthMm', 'maxCoolerHeightMm', 'maxPsuLengthMm', 'bays35', 'bays25', 'fanMounts',
  'fansIncluded', 'radiatorMm', 'memorySlots', 'maxMemoryGb', 'm2Slots', 'sataPorts',
  'pcieX16Slots', 'heightMm', 'tdpRating', 'lengthMm', 'tdp', 'slotWidth', 'wattage',
  'capacityGb', 'moduleCount', 'speedMhz', 'casLatency', 'rpm', 'cacheMb', 'sizeMm',
]);

// Icecat writes free text where our schema wants one of a fixed set. A case
// listing "ATX, Micro-ATX, Mini-ITX" means it takes up to ATX, so the largest
// wins; a colour of "Matte Black" is Black. A value that cannot be coerced is
// dropped rather than stored as something the checker will not understand.
const BOARD_ORDER = ['Mini-ITX', 'Micro-ATX', 'ATX', 'E-ATX'];

function coerceSpec(key, value) {
  const t = String(value).toLowerCase();
  const pickBoard = () => {
    const found = BOARD_ORDER.filter(ff => t.includes(ff.toLowerCase().replace('-', ' ')) || t.includes(ff.toLowerCase()));
    return found.length ? found[found.length - 1] : undefined;
  };
  switch (key) {
    case 'maxBoardFormFactor': return pickBoard();
    case 'formFactor': {
      // A board states one size, so take the first named rather than the largest.
      const found = BOARD_ORDER.filter(ff => t.includes(ff.toLowerCase().replace('-', ' ')) || t.includes(ff.toLowerCase()));
      return found.length ? found[0] : undefined;
    }
    case 'psuFormFactor': {
      for (const ff of ['SFX-L', 'SFX', 'TFX', 'ATX']) if (t.includes(ff.toLowerCase())) return ff;
      return undefined;
    }
    case 'memoryType': {
      for (const g of ['DDR5', 'DDR4', 'DDR3']) if (t.includes(g.toLowerCase())) return g;
      return undefined;
    }
    case 'interface': {
      if (/m\.?2/.test(t)) return /sata/.test(t) ? 'M.2 SATA' : 'M.2 NVMe';
      if (/u\.?2/.test(t)) return 'U.2';
      if (/sata/.test(t)) return 'SATA';
      return undefined;
    }
    case 'driveSize': {
      if (/m\.?2/.test(t)) return 'M.2';
      if (/2\.5/.test(t)) return '2.5"';
      if (/3\.5/.test(t)) return '3.5"';
      return undefined;
    }
    case 'colour': {
      for (const [word, out] of [['white','White'],['black','Black'],['silver','Silver'],['grey','Grey'],['gray','Grey'],
        ['pink','Pink'],['blue','Blue'],['red','Red'],['green','Green'],['wood','Wood / natural']]) {
        if (t.includes(word)) return out;
      }
      return undefined;
    }
    case 'socket': {
      // "Socket AM5", "LGA 1700", "FCLGA1700" all name the same thing our
      // vocabulary spells one way.
      const cleaned = String(value).replace(/socket/ig, '').replace(/^fc/i, '').replace(/\s+/g, '').toUpperCase();
      const m = cleaned.match(/(LGA\d+(?:-\d+)?|AM\d\+?|FM\d\+?|STRX?\d|SP\d|G34|C32|SWRX\d)/);
      return m ? m[1] : undefined;
    }
    case 'sockets': {
      // Coolers list several. Keep them as the array the checker expects.
      const found = String(value).split(/[,;/]/).map(x => x.trim()).filter(Boolean);
      return found.length ? found : undefined;
    }
    default: return value;
  }
}

/**
 * Flatten an Icecat response into { specs, matched, unmatched }.
 * `specs` are the values recognised for this category, `matched` explains which
 * Icecat feature produced each one so staff can see the reasoning, and
 * `unmatched` is everything else the datasheet carried, so a spec this mapping
 * does not know about is visible rather than silently dropped.
 */
function mapIcecatFeatures(data, category) {
  const groups = (data && data.FeaturesGroups) || [];
  const flat = [];
  for (const g of groups) {
    for (const f of (g.Features || [])) {
      const name = f.Feature && f.Feature.Name && f.Feature.Name.Value;
      const value = f.PresentationValue != null && f.PresentationValue !== '' ? f.PresentationValue : f.Value;
      if (!name || value == null || value === '') continue;
      flat.push({ name: String(name), value: String(value), group: (g.FeatureGroup && g.FeatureGroup.Name && g.FeatureGroup.Name.Value) || '' });
    }
  }

  const rules = FEATURE_MAP[category] || [];
  const specs = {};
  const matched = [];
  const usedFeature = new Set();

  for (const [specKey, patterns] of rules) {
    // Longest pattern first so "maximum cpu cooler height" wins over "height".
    const sorted = [...patterns].sort((a, b) => b.length - a.length);
    let hit = null;
    for (const pat of sorted) {
      hit = flat.find(f => !usedFeature.has(f.name) && normalise(f.name) === pat)
        || flat.find(f => !usedFeature.has(f.name) && normalise(f.name).includes(pat));
      if (hit) break;
    }
    if (!hit) continue;
    let value = hit.value;
    if (NUMERIC_SPECS.has(specKey)) {
      value = numberFrom(value);
      if (value === undefined) continue;
    }
    if (!NUMERIC_SPECS.has(specKey)) {
      value = coerceSpec(specKey, value);
      if (value === undefined) continue;
    }
    specs[specKey] = value;
    usedFeature.add(hit.name);
    matched.push({ spec: specKey, feature: hit.name, raw: hit.value, value });
  }

  const unmatched = flat.filter(f => !usedFeature.has(f.name));
  return { specs, matched, unmatched };
}

// Credentials are supplied by the caller, which reads them from Settings,
// Integrations. The environment is only a fallback for an existing deployment.
function credentials(supplied) {
  return {
    username: (supplied && supplied.username) || process.env.ICECAT_USERNAME || '',
    appKey: (supplied && supplied.appKey) || process.env.ICECAT_APP_KEY || '',
  };
}

function isConfigured() {
  return !!credentials().username;
}

/**
 * Look a product up by GTIN, or by brand plus manufacturer part number.
 * Returns { ok, data } or { ok:false, reason, message } where reason is one of
 * not_configured | not_found | brand_restricted | error.
 */
async function lookup({ gtin, brand, mpn, lang = 'en', credentials: supplied }) {
  const { username, appKey } = credentials(supplied);
  if (!username) return { ok: false, reason: 'not_configured', message: 'Add an Icecat integration under Settings, Integrations to use lookups.' };
  if (!gtin && !(brand && mpn)) return { ok: false, reason: 'error', message: 'Provide a GTIN, or a brand and part number.' };

  const params = new URLSearchParams({ lang, shopname: username, content: '' });
  if (gtin) params.set('GTIN', String(gtin).trim());
  else { params.set('Brand', String(brand).trim()); params.set('ProductCode', String(mpn).trim()); }
  if (appKey) params.set('app_key', appKey);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    const res = await fetch(`${ICECAT_ENDPOINT}?${params}`, { signal: controller.signal });
    const text = await res.text();
    let body = null;
    try { body = JSON.parse(text); } catch { /* handled below */ }
    if (!res.ok) {
      const msg = (body && (body.Message || body.Error)) || `Icecat returned ${res.status}`;
      // 403 means the brand is Full Icecat rather than Open Icecat, which is a
      // subscription question and not a missing product. Worth saying plainly.
      const reason = res.status === 403 ? 'brand_restricted' : res.status === 404 ? 'not_found' : 'error';
      return { ok: false, reason, message: msg, status: res.status };
    }
    if (!body || !body.data) return { ok: false, reason: 'not_found', message: 'No datasheet returned for that product.' };
    return { ok: true, data: body.data };
  } catch (err) {
    return { ok: false, reason: 'error', message: err && err.name === 'AbortError' ? 'Icecat timed out.' : String(err && err.message || err) };
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { lookup, mapIcecatFeatures, isConfigured, FEATURE_MAP, numberFrom };
