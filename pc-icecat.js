// Compatibility-spec enrichment.
//
// Open Icecat remains the first source. When a product is absent from Open
// Icecat or restricted to Full Icecat, the lookup falls back to a conservative
// PCPartPicker detail-page lookup. Both sources are converted into the existing
// PC builder spec schema by mapIcecatFeatures(), so server.js and the admin UI
// can keep their existing write path.

// There is deliberately no PCPartPicker fallback here. Automated access is
// against their terms and they enforce it at the IP level: driving lookups
// through pc-partpicker.js got the shop's own address blocked, which took
// PCPartPicker away from staff browsers on the whole network, not just from
// this code. pc-partpicker.js is kept in the repo but is not wired to
// anything. Do not reconnect it without an arrangement with PCPartPicker.
const ICECAT_ENDPOINT = 'https://live.icecat.biz/api';

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
    ['m2Slots', ['m.2 slots', 'm.2 connectors', 'm.2 sockets']],
    ['sataPorts', ['sata iii connectors', 'sata connectors', 'serial ata connectors', 'sata ports']],
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
    ['pcie8pin', ['pcie 8-pin connectors', 'pci express 8-pin connectors', '8-pin pcie connectors']],
    ['pcie12vhpwr', ['12vhpwr', '12v-2x6', '16-pin power connector']],
    ['colour', ['colour', 'color']],
  ],
  psu: [
    ['wattage', ['total power output', 'power supply wattage', 'output power', 'wattage']],
    ['formFactor', ['power supply form factor', 'psu form factor', 'form factor']],
    ['lengthMm', ['depth', 'length', 'product depth']],
    ['pcie8pin', ['pcie 6+2-pin connectors', 'pcie 8-pin connectors', 'pci express power connectors']],
    ['pcie12vhpwr', ['12vhpwr connectors', '12v-2x6 connectors', '16-pin pcie connectors']],
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
function numberFrom(raw) {
  const m = String(raw).replace(/,/g, '').match(/(-?\d+(?:\.\d+)?)/);
  if (!m) return undefined;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : undefined;
}

const NUMERIC_SPECS = new Set([
  'maxGpuLengthMm', 'maxCoolerHeightMm', 'maxPsuLengthMm', 'bays35', 'bays25', 'fanMounts',
  'fansIncluded', 'radiatorMm', 'memorySlots', 'maxMemoryGb', 'm2Slots', 'sataPorts',
  'pcieX16Slots', 'heightMm', 'tdpRating', 'lengthMm', 'tdp', 'slotWidth', 'wattage',
  'pcie8pin', 'capacityGb', 'moduleCount', 'speedMhz', 'casLatency', 'rpm', 'cacheMb', 'sizeMm',
]);
const BOOL_SPECS = new Set(['pcie12vhpwr']);
const BOARD_ORDER = ['Mini-ITX', 'Micro-ATX', 'ATX', 'E-ATX'];

function coerceSpec(key, value) {
  const t = String(value).toLowerCase();
  switch (key) {
    case 'maxBoardFormFactor': {
      const found = BOARD_ORDER.filter(ff => t.includes(ff.toLowerCase().replace('-', ' ')) || t.includes(ff.toLowerCase()));
      return found.length ? found[found.length - 1] : undefined;
    }
    case 'formFactor': {
      const found = BOARD_ORDER.filter(ff => t.includes(ff.toLowerCase().replace('-', ' ')) || t.includes(ff.toLowerCase()));
      return found.length ? found[0] : undefined;
    }
    case 'psuFormFactor':
      for (const ff of ['SFX-L', 'SFX', 'TFX', 'ATX']) if (t.includes(ff.toLowerCase())) return ff;
      return undefined;
    case 'memoryType':
      for (const g of ['DDR5', 'DDR4', 'DDR3']) if (t.includes(g.toLowerCase())) return g;
      return undefined;
    case 'interface':
      if (/m\.?2/.test(t)) return /sata/.test(t) ? 'M.2 SATA' : 'M.2 NVMe';
      if (/u\.?2/.test(t)) return 'U.2';
      if (/sata/.test(t)) return 'SATA';
      return undefined;
    case 'driveSize':
      if (/m\.?2/.test(t)) return 'M.2';
      if (/2\.5/.test(t)) return '2.5"';
      if (/3\.5/.test(t)) return '3.5"';
      return undefined;
    case 'colour':
      for (const [word, out] of [['white','White'],['black','Black'],['silver','Silver'],['grey','Grey'],['gray','Grey'],['pink','Pink'],['blue','Blue'],['red','Red'],['green','Green'],['wood','Wood / natural']]) if (t.includes(word)) return out;
      return undefined;
    case 'socket': {
      const cleaned = String(value).replace(/socket/ig, '').replace(/^fc/i, '').replace(/\s+/g, '').toUpperCase();
      const m = cleaned.match(/(LGA\d+(?:-\d+)?|AM\d\+?|FM\d\+?|STRX?\d|SP\d|G34|C32|SWRX\d)/);
      return m ? m[1] : undefined;
    }
    case 'sockets': {
      const found = Array.isArray(value) ? value : String(value).split(/[,;/]/).map(x => x.trim()).filter(Boolean);
      return found.length ? found : undefined;
    }
    default: return value;
  }
}

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
  const specs = {}, matched = [], usedFeature = new Set();
  for (const [specKey, patterns] of rules) {
    const sorted = [...patterns].sort((a, b) => b.length - a.length);
    let hit = null;
    for (const pat of sorted) {
      const patTokens = pat.split(' ').filter(Boolean);
      hit = flat.find(f => !usedFeature.has(f.name) && normalise(f.name) === pat)
        || flat.find(f => !usedFeature.has(f.name) && patTokens.every(t => normalise(f.name).includes(t)));
      if (hit) break;
    }
    if (!hit) continue;
    let value = hit.value;
    if (NUMERIC_SPECS.has(specKey)) {
      value = numberFrom(value);
      if (value === undefined) continue;
    } else if (BOOL_SPECS.has(specKey)) {
      const t = normalise(value);
      value = !/^(?:0|no|none|false)$/.test(t);
    } else {
      value = coerceSpec(specKey, value);
      if (value === undefined) continue;
    }
    specs[specKey] = value;
    usedFeature.add(hit.name);
    matched.push({ spec: specKey, feature: hit.name, raw: hit.value, value });
  }
  return { specs, matched, unmatched: flat.filter(f => !usedFeature.has(f.name)), source: 'icecat' };
}

function credentials(supplied) {
  return {
    username: (supplied && supplied.username) || process.env.ICECAT_USERNAME || '',
    appKey: (supplied && supplied.appKey) || process.env.ICECAT_APP_KEY || '',
  };
}
function isConfigured() { return !!credentials().username; }

async function lookup({ gtin, brand, mpn, lang = 'en', credentials: supplied }) {
  const { username, appKey } = credentials(supplied);
  if (!username) return { ok: false, reason: 'not_configured', message: 'Add an Icecat integration under Settings, Integrations to use lookups.' };
  if (!gtin && !(brand && mpn)) return { ok: false, reason: 'error', message: 'Provide a GTIN, or a brand and part number.' };

  const params = new URLSearchParams({ lang, shopname: username, content: '' });
  if (gtin) params.set('GTIN', String(gtin).trim());
  else {
    const b = String(brand).trim();
    let code = String(mpn).trim();
    if (b && code.toLowerCase().startsWith(b.toLowerCase() + ' ')) code = code.slice(b.length + 1).trim();
    params.set('Brand', b);
    params.set('ProductCode', code);
  }
  if (appKey) params.set('app_key', appKey);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    const res = await fetch(`${ICECAT_ENDPOINT}?${params}`, { signal: controller.signal });
    const raw = await res.text();
    let body = null;
    try { body = JSON.parse(raw); } catch {}
    if (res.ok && body && body.data) return { ok: true, data: body.data, source: 'icecat' };

    const msg = (body && (body.Message || body.Error)) || `Icecat returned ${res.status}`;
    if (/user is unknown|unknown user|invalid user/i.test(msg)) return { ok: false, reason: 'bad_credentials', message: msg, status: res.status };

    if (res.status === 403 || res.status === 404) {
      return {
        ok: false,
        reason: res.status === 403 ? 'brand_restricted' : 'not_found',
        message: msg,
        status: res.status,
      };
    }
    return { ok: false, reason: 'error', message: msg, status: res.status };
  } catch (err) {
    return { ok: false, reason: 'error', message: err && err.name === 'AbortError' ? 'Icecat timed out.' : String(err && err.message || err) };
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { lookup, mapIcecatFeatures, isConfigured, FEATURE_MAP, numberFrom };
