// PC builder part schema + compatibility engine.
//
// Pure data and pure functions, no React and no Node APIs, so the admin UI and
// any future public-facing builder can share exactly one set of rules. The
// admin PC Builder section in pages-admin.jsx is the only consumer today.
//
// Every part in the library is { id, category, name, brand, sku, priceAud,
// cost, productId, specs: {...}, notes }. The shape of `specs` depends on the
// category and is described by PC_PART_CATEGORIES[].fields below, which also
// drives the part editor form, so adding a new spec is a one-line change here.

// ── Vocabularies ─────────────────────────────────────────────────────────────

// Current desktop sockets first, then legacy desktop (a repair and refurb shop
// still sees these daily), then workstation and server. Matches the sockets
// present in the generated catalog in pc-parts-cpus.js.
export const CPU_SOCKETS = [
  // Current desktop
  'AM5', 'LGA1851', 'LGA1700', 'AM4',
  // Legacy desktop
  'LGA1200', 'LGA1151', 'LGA1150', 'LGA1155', 'LGA1156', 'LGA775',
  'AM3+', 'AM3', 'AM2+', 'AM1', 'FM2+', 'FM2', 'FM1',
  // Workstation and server
  'sTR5', 'sWRX8', 'sTRX4', 'sTR4', 'SP6', 'SP5', 'SP3',
  'LGA2066', 'LGA2011-3', 'LGA2011', 'LGA1366', 'LGA1248',
  'LGA4677', 'LGA4189', 'LGA3647', 'G34', 'C32',
];
export const MEMORY_TYPES = ['DDR5', 'DDR4', 'DDR3'];
export const BOARD_FORM_FACTORS = ['E-ATX', 'ATX', 'Micro-ATX', 'Mini-ITX'];
export const PSU_FORM_FACTORS = ['ATX', 'SFX', 'SFX-L', 'TFX'];
export const STORAGE_INTERFACES = ['M.2 NVMe', 'M.2 SATA', 'SATA', 'U.2'];
export const STORAGE_SIZES = ['M.2', '2.5"', '3.5"'];
export const COOLER_TYPES = ['Air', 'Liquid (AIO)'];

// Colour is a build requirement in its own right: a customer asking for a white
// build wants every visible part to match, and a black GPU ruins it as surely as
// a wrong socket stops it booting. Recorded on the categories you actually see
// through a side panel, not on CPUs or drives.
export const PART_COLOURS = ['Black', 'White', 'Silver', 'Grey', 'Pink', 'Blue', 'Red', 'Green', 'Wood / natural', 'Multi / RGB'];
const COLOUR_FIELD = { key: 'colour', label: 'Colour', type: 'select', options: PART_COLOURS };

// Boards fit a case if the case lists their form factor. Larger cases almost
// always take smaller boards, so the case's declared support is expanded
// downwards rather than making staff tick four boxes on every case.
const BOARD_SIZE_ORDER = ['Mini-ITX', 'Micro-ATX', 'ATX', 'E-ATX'];

export function boardFormFactorsFitting(largest) {
  const idx = BOARD_SIZE_ORDER.indexOf(largest);
  if (idx < 0) return [];
  return BOARD_SIZE_ORDER.slice(0, idx + 1);
}

// ── Category + field definitions ─────────────────────────────────────────────
// type: 'text' | 'number' | 'select' | 'multiselect' | 'bool'

export const PC_PART_CATEGORIES = [
  {
    key: 'cpu', label: 'CPU', required: true, multi: false,
    fields: [
      { key: 'socket', label: 'Socket', type: 'select', options: CPU_SOCKETS },
      { key: 'memoryType', label: 'Memory type', type: 'select', options: MEMORY_TYPES },
      { key: 'tdp', label: 'TDP (W)', type: 'number' },
      { key: 'cores', label: 'Cores', type: 'number' },
      { key: 'integratedGraphics', label: 'Has integrated graphics', type: 'bool' },
      { key: 'coolerIncluded', label: 'Cooler included in box', type: 'bool' },
    ],
  },
  {
    key: 'cooler', label: 'CPU Cooler', required: false, multi: false,
    fields: [
      COLOUR_FIELD,
      { key: 'coolerType', label: 'Type', type: 'select', options: COOLER_TYPES },
      { key: 'sockets', label: 'Supported sockets', type: 'multiselect', options: CPU_SOCKETS },
      { key: 'heightMm', label: 'Height (mm, air)', type: 'number' },
      { key: 'radiatorMm', label: 'Radiator size (mm, AIO)', type: 'number' },
      { key: 'tdpRating', label: 'Rated for TDP (W)', type: 'number' },
    ],
  },
  {
    key: 'motherboard', label: 'Motherboard', required: true, multi: false,
    fields: [
      COLOUR_FIELD,
      { key: 'socket', label: 'Socket', type: 'select', options: CPU_SOCKETS },
      { key: 'chipset', label: 'Chipset', type: 'text' },
      { key: 'formFactor', label: 'Form factor', type: 'select', options: BOARD_FORM_FACTORS },
      { key: 'memoryType', label: 'Memory type', type: 'select', options: MEMORY_TYPES },
      { key: 'memorySlots', label: 'Memory slots', type: 'number' },
      { key: 'maxMemoryGb', label: 'Max memory (GB)', type: 'number' },
      { key: 'm2Slots', label: 'M.2 slots', type: 'number' },
      { key: 'sataPorts', label: 'SATA ports', type: 'number' },
      { key: 'pcieX16Slots', label: 'PCIe x16 slots', type: 'number' },
    ],
  },
  {
    key: 'ram', label: 'Memory', required: true, multi: true,
    fields: [
      COLOUR_FIELD,
      { key: 'memoryType', label: 'Memory type', type: 'select', options: MEMORY_TYPES },
      { key: 'moduleCount', label: 'Modules per kit', type: 'number' },
      { key: 'capacityGb', label: 'Kit capacity (GB)', type: 'number' },
      { key: 'speedMhz', label: 'Speed (MHz)', type: 'number' },
      { key: 'casLatency', label: 'CAS latency', type: 'number' },
    ],
  },
  {
    key: 'gpu', label: 'Graphics Card', required: false, multi: false,
    fields: [
      COLOUR_FIELD,
      { key: 'lengthMm', label: 'Length (mm)', type: 'number' },
      { key: 'slotWidth', label: 'Slot width', type: 'number' },
      { key: 'tdp', label: 'TDP (W)', type: 'number' },
      { key: 'pcie8pin', label: 'PCIe 8-pin connectors', type: 'number' },
      { key: 'pcie12vhpwr', label: 'Needs 12VHPWR', type: 'bool' },
    ],
  },
  {
    key: 'storage', label: 'Storage', required: true, multi: true,
    fields: [
      { key: 'interface', label: 'Interface', type: 'select', options: STORAGE_INTERFACES },
      { key: 'driveSize', label: 'Drive size', type: 'select', options: STORAGE_SIZES },
      { key: 'capacityGb', label: 'Capacity (GB)', type: 'number' },
    ],
  },
  {
    key: 'psu', label: 'Power Supply', required: true, multi: false,
    fields: [
      COLOUR_FIELD,
      { key: 'wattage', label: 'Wattage (W)', type: 'number' },
      { key: 'formFactor', label: 'Form factor', type: 'select', options: PSU_FORM_FACTORS },
      { key: 'lengthMm', label: 'Length (mm)', type: 'number' },
      { key: 'pcie8pin', label: 'PCIe 8-pin connectors', type: 'number' },
      { key: 'pcie12vhpwr', label: 'Has 12VHPWR cable', type: 'bool' },
      { key: 'efficiency', label: 'Efficiency rating', type: 'text' },
    ],
  },
  {
    key: 'case', label: 'Case', required: true, multi: false,
    fields: [
      COLOUR_FIELD,
      { key: 'maxBoardFormFactor', label: 'Largest board it takes', type: 'select', options: BOARD_FORM_FACTORS },
      { key: 'maxGpuLengthMm', label: 'Max GPU length (mm)', type: 'number' },
      { key: 'maxCoolerHeightMm', label: 'Max cooler height (mm)', type: 'number' },
      { key: 'maxPsuLengthMm', label: 'Max PSU length (mm)', type: 'number' },
      { key: 'psuFormFactor', label: 'PSU form factor', type: 'select', options: PSU_FORM_FACTORS },
      { key: 'radiatorMm', label: 'Max radiator (mm)', type: 'number' },
      { key: 'bays25', label: '2.5" bays', type: 'number' },
      { key: 'bays35', label: '3.5" bays', type: 'number' },
      { key: 'fanMounts', label: 'Fan mounts', type: 'number' },
      { key: 'fansIncluded', label: 'Fans included', type: 'number' },
    ],
  },
  {
    key: 'fan', label: 'Case Fan', required: false, multi: true,
    fields: [
      COLOUR_FIELD,
      { key: 'sizeMm', label: 'Size (mm)', type: 'number' },
      { key: 'watts', label: 'Draw (W)', type: 'number' },
    ],
  },
  { key: 'os', label: 'Operating System', required: false, multi: false, fields: [] },
  { key: 'monitor', label: 'Monitor', required: false, multi: true, fields: [ COLOUR_FIELD,
    { key: 'sizeIn', label: 'Size (in)', type: 'number' },
    { key: 'refreshHz', label: 'Refresh (Hz)', type: 'number' },
  ] },
  { key: 'peripheral', label: 'Peripheral', required: false, multi: true, fields: [ COLOUR_FIELD,] },
  { key: 'other', label: 'Other', required: false, multi: true, fields: [] },
];

export const PC_CATEGORY_MAP = Object.fromEntries(PC_PART_CATEGORIES.map(c => [c.key, c]));

export function categoryLabel(key) {
  return PC_CATEGORY_MAP[key]?.label || key || 'Part';
}

/**
 * Display name for a part: brand then name, but only where the name does not
 * already start with the brand. Distributor descriptions nearly always lead
 * with the manufacturer, so joining blindly gives "AMD AMD Ryzen 5 7600".
 */
export function partDisplayName(part) {
  if (!part) return 'Part';
  const name = String(part.name || '').trim();
  const brand = String(part.brand || '').trim();
  if (!brand) return name || 'Part';
  if (!name) return brand;
  return name.toLowerCase().startsWith(brand.toLowerCase()) ? name : `${brand} ${name}`;
}

// ── Small helpers ────────────────────────────────────────────────────────────

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) && v !== '' && v != null ? n : null;
};
const list = (v) => (Array.isArray(v) ? v.filter(Boolean) : []);

function issue(severity, code, message, hint) {
  return hint ? { severity, code, message, hint } : { severity, code, message };
}

/**
 * Turn build items into a flat list of { part, qty } for one category.
 * `items` are [{ partId, qty }]; `parts` is the library.
 */
export function selectedParts(items, parts) {
  const byId = new Map((parts || []).map(p => [p.id, p]));
  return (items || [])
    .map(it => ({ item: it, part: byId.get(it.partId) || it.snapshot || null, qty: Math.max(1, Number(it.qty) || 1) }))
    .filter(x => x.part);
}

function groupByCategory(resolved) {
  const out = {};
  for (const r of resolved) {
    const cat = r.part.category || 'other';
    (out[cat] = out[cat] || []).push(r);
  }
  return out;
}

// ── Power estimate ───────────────────────────────────────────────────────────
// Board, drives, fans and general overhead are approximated. The number is a
// sizing aid for picking a PSU, not a measurement.

const BASE_SYSTEM_WATTS = 60;
const WATTS_PER_DRIVE = 6;
const WATTS_PER_FAN = 3;
const WATTS_PER_RAM_MODULE = 4;

export function estimateWattage(items, parts) {
  const resolved = selectedParts(items, parts);
  // An empty build draws nothing. The base figure covers the board and general
  // overhead, so adding it before anything is selected reported a machine that
  // does not exist yet as drawing 60W.
  if (!resolved.length) return 0;
  const g = groupByCategory(resolved);
  let w = BASE_SYSTEM_WATTS;
  const add = (n) => { if (n) w += n; };

  for (const { part, qty } of g.cpu || []) add((num(part.specs?.tdp) || 65) * qty);
  for (const { part, qty } of g.gpu || []) add((num(part.specs?.tdp) || 0) * qty);
  for (const { part, qty } of g.storage || []) add(WATTS_PER_DRIVE * qty);
  for (const { part, qty } of g.fan || []) add((num(part.specs?.watts) || WATTS_PER_FAN) * qty);
  for (const { part, qty } of g.ram || []) add(WATTS_PER_RAM_MODULE * (num(part.specs?.moduleCount) || 1) * qty);
  // Liquid coolers run a pump plus radiator fans.
  for (const { part, qty } of g.cooler || []) add((part.specs?.coolerType === 'Liquid (AIO)' ? 15 : 4) * qty);

  return Math.round(w);
}

/** Wattage we would actually recommend buying: load plus headroom, rounded up. */
export function recommendedPsuWattage(load) {
  // Nothing selected, nothing to recommend. Returning the smallest unit in the
  // list would put a confident figure against an empty build.
  if (!load) return 0;
  const target = load * 1.4;
  const steps = [400, 450, 500, 550, 600, 650, 750, 850, 1000, 1200, 1500, 1600];
  return steps.find(s => s >= target) || Math.ceil(target / 100) * 100;
}

// ── Compatibility rules ──────────────────────────────────────────────────────

/**
 * Check a build for compatibility, physical fit and completeness problems.
 *
 * Returns { issues, errors, warnings, infos, wattage, recommendedPsu, ok }.
 * `ok` is true when nothing at error severity was found. Missing specs never
 * raise an error: a part with an unknown socket cannot be proven wrong, so the
 * rule that needs it is skipped and a "spec missing" info is raised instead so
 * staff know the check did not run.
 */
export function checkBuild(items, parts) {
  const resolved = selectedParts(items, parts);
  const g = groupByCategory(resolved);
  const issues = [];
  const one = (cat) => (g[cat] && g[cat].length ? g[cat][0].part : null);
  const qtyOf = (cat) => (g[cat] || []).reduce((s, r) => s + r.qty, 0);

  const cpu = one('cpu');
  const board = one('motherboard');
  const cooler = one('cooler');
  const gpu = one('gpu');
  const psu = one('psu');
  const kase = one('case');

  const cpuS = cpu?.specs || {};
  const boardS = board?.specs || {};
  const coolerS = cooler?.specs || {};
  const gpuS = gpu?.specs || {};
  const psuS = psu?.specs || {};
  const caseS = kase?.specs || {};

  // 1. Missing required categories.
  for (const cat of PC_PART_CATEGORIES.filter(c => c.required)) {
    if (!g[cat.key] || g[cat.key].length === 0) {
      issues.push(issue('warning', `missing-${cat.key}`, `No ${cat.label.toLowerCase()} selected.`, 'A complete build needs one before it can be quoted as a working machine.'));
    }
  }

  // 2. Duplicate single-fit parts.
  for (const cat of PC_PART_CATEGORIES.filter(c => !c.multi)) {
    const rows = g[cat.key] || [];
    const total = rows.reduce((s, r) => s + r.qty, 0);
    if (total > 1) {
      issues.push(issue('error', `duplicate-${cat.key}`, `${total} x ${cat.label.toLowerCase()} in the build.`, 'Only one fits in a single machine, drop the extras or split into separate builds.'));
    }
  }

  // 3. CPU and motherboard socket.
  if (cpu && board) {
    if (cpuS.socket && boardS.socket) {
      if (cpuS.socket !== boardS.socket) {
        issues.push(issue('error', 'socket-mismatch', `${cpu.name} is ${cpuS.socket} but ${board.name} is ${boardS.socket}.`, 'The CPU will not physically seat, swap one of the two.'));
      }
    } else {
      issues.push(issue('info', 'socket-unknown', 'Socket not recorded on the CPU or motherboard, socket fit was not checked.', 'Add the socket in the parts library to enable the check.'));
    }
  }

  // 4. Memory type across CPU, board and modules.
  const ramRows = g.ram || [];
  const ramTypes = [...new Set(ramRows.map(r => r.part.specs?.memoryType).filter(Boolean))];
  if (board && boardS.memoryType) {
    for (const t of ramTypes) {
      if (t !== boardS.memoryType) {
        issues.push(issue('error', 'memory-type', `${boardS.memoryType} board with ${t} memory selected.`, 'DDR generations are keyed differently and will not fit the slots.'));
      }
    }
    if (cpuS.memoryType && cpuS.memoryType !== boardS.memoryType) {
      issues.push(issue('error', 'memory-type-cpu', `${cpu.name} runs ${cpuS.memoryType} but the board is ${boardS.memoryType}.`));
    }
  }
  if (ramTypes.length > 1) {
    issues.push(issue('error', 'memory-type-mixed', `Mixed memory types in the build: ${ramTypes.join(' and ')}.`));
  }

  // 5. Memory slots and capacity.
  if (board) {
    const modules = ramRows.reduce((s, r) => s + (num(r.part.specs?.moduleCount) || 1) * r.qty, 0);
    const slots = num(boardS.memorySlots);
    if (slots != null && modules > slots) {
      issues.push(issue('error', 'memory-slots', `${modules} memory modules selected but ${board.name} has ${slots} slots.`));
    }
    const totalGb = ramRows.reduce((s, r) => s + (num(r.part.specs?.capacityGb) || 0) * r.qty, 0);
    const maxGb = num(boardS.maxMemoryGb);
    if (maxGb != null && totalGb > maxGb) {
      issues.push(issue('error', 'memory-capacity', `${totalGb}GB of memory selected but ${board.name} tops out at ${maxGb}GB.`));
    }
  }

  // 6. Board fits the case.
  if (board && kase) {
    if (boardS.formFactor && caseS.maxBoardFormFactor) {
      const fits = boardFormFactorsFitting(caseS.maxBoardFormFactor);
      if (!fits.includes(boardS.formFactor)) {
        issues.push(issue('error', 'board-case-size', `${boardS.formFactor} board will not fit ${kase.name}, which takes up to ${caseS.maxBoardFormFactor}.`));
      }
    } else {
      issues.push(issue('info', 'board-case-size-unknown', 'Board or case form factor not recorded, case fit was not checked.'));
    }
  }

  // 7. GPU length.
  if (gpu && kase) {
    const len = num(gpuS.lengthMm);
    const max = num(caseS.maxGpuLengthMm);
    if (len != null && max != null) {
      if (len > max) {
        issues.push(issue('error', 'gpu-length', `${gpu.name} is ${len}mm long, ${kase.name} clears ${max}mm.`, `It is ${len - max}mm too long, pick a shorter card or a bigger case.`));
      } else if (max - len < 10) {
        issues.push(issue('warning', 'gpu-length-tight', `Only ${max - len}mm of clearance behind ${gpu.name}.`, 'Front fans, cables or a radiator may take that space, check before ordering.'));
      }
    } else if (len == null || max == null) {
      issues.push(issue('info', 'gpu-length-unknown', 'GPU length or case clearance not recorded, GPU fit was not checked.'));
    }
  }

  // 8. Cooler socket, height and radiator.
  if (cooler && cpu) {
    const sockets = list(coolerS.sockets);
    if (sockets.length && cpuS.socket && !sockets.includes(cpuS.socket)) {
      issues.push(issue('error', 'cooler-socket', `${cooler.name} does not list a ${cpuS.socket} mount.`, 'Check for a bracket kit or choose a cooler that supports the socket.'));
    }
    const rating = num(coolerS.tdpRating);
    const tdp = num(cpuS.tdp);
    if (rating != null && tdp != null && rating < tdp) {
      issues.push(issue('warning', 'cooler-tdp', `${cooler.name} is rated to ${rating}W but ${cpu.name} draws up to ${tdp}W.`, 'Expect thermal throttling under sustained load.'));
    }
  }
  if (cooler && kase) {
    if (coolerS.coolerType === 'Liquid (AIO)') {
      const rad = num(coolerS.radiatorMm);
      const caseRad = num(caseS.radiatorMm);
      if (rad != null && caseRad != null && rad > caseRad) {
        issues.push(issue('error', 'radiator-size', `${rad}mm radiator will not mount in ${kase.name}, which takes up to ${caseRad}mm.`));
      }
    } else {
      const h = num(coolerS.heightMm);
      const maxH = num(caseS.maxCoolerHeightMm);
      if (h != null && maxH != null) {
        if (h > maxH) {
          issues.push(issue('error', 'cooler-height', `${cooler.name} is ${h}mm tall, ${kase.name} clears ${maxH}mm.`, `It is ${h - maxH}mm too tall, the side panel will not close.`));
        } else if (maxH - h < 5) {
          issues.push(issue('warning', 'cooler-height-tight', `Only ${maxH - h}mm above ${cooler.name}.`, 'Tall memory heatspreaders often eat that clearance.'));
        }
      }
    }
  }
  if (!cooler && cpu && !cpuS.coolerIncluded) {
    issues.push(issue('warning', 'no-cooler', `${cpu.name} does not ship with a cooler and none is selected.`, 'The machine will not boot safely without one.'));
  }

  // 9. Storage against board ports and case bays.
  const storageRows = g.storage || [];
  const countWhere = (fn) => storageRows.reduce((s, r) => s + (fn(r.part.specs || {}) ? r.qty : 0), 0);
  if (board) {
    const m2Used = countWhere(s => String(s.interface || '').startsWith('M.2'));
    const m2Slots = num(boardS.m2Slots);
    if (m2Slots != null && m2Used > m2Slots) {
      issues.push(issue('error', 'm2-slots', `${m2Used} M.2 drives selected but ${board.name} has ${m2Slots} M.2 slots.`));
    }
    const sataUsed = countWhere(s => s.interface === 'SATA' || s.interface === 'M.2 SATA');
    const sataPorts = num(boardS.sataPorts);
    if (sataPorts != null && sataUsed > sataPorts) {
      issues.push(issue('error', 'sata-ports', `${sataUsed} SATA drives selected but ${board.name} has ${sataPorts} SATA ports.`));
    }
  }
  if (kase) {
    const large = countWhere(s => s.driveSize === '3.5"');
    const bays35 = num(caseS.bays35);
    if (bays35 != null && large > bays35) {
      issues.push(issue('error', 'bays-35', `${large} x 3.5" drives selected but ${kase.name} has ${bays35} bays.`));
    }
    const small = countWhere(s => s.driveSize === '2.5"');
    const bays25 = num(caseS.bays25);
    if (bays25 != null && small > bays25) {
      issues.push(issue('error', 'bays-25', `${small} x 2.5" drives selected but ${kase.name} has ${bays25} bays.`));
    }
  }

  // 10. Case fans.
  if (kase) {
    const fans = qtyOf('fan');
    const mounts = num(caseS.fanMounts);
    if (mounts != null && fans > mounts) {
      issues.push(issue('warning', 'fan-mounts', `${fans} case fans selected but ${kase.name} has ${mounts} mounting points.`));
    }
  }

  // 11a. A graphics card with no recorded TDP contributes nothing to the power
  // estimate, which quietly under-sizes the PSU on the one part most likely to
  // dominate the load. Datasets that carry a card's physical length often carry
  // no power figure, so this is common and worth saying out loud.
  if (gpu && num(gpuS.tdp) == null) {
    issues.push(issue('warning', 'gpu-tdp-unknown', `Power draw not recorded for ${gpu.name}, so the estimate below excludes it.`, 'Add the card\'s TDP before sizing a power supply from that number.'));
  }

  // 11. Display output.
  if (cpu && !gpu && cpuS.integratedGraphics === false) {
    issues.push(issue('error', 'no-display', `${cpu.name} has no integrated graphics and no graphics card is selected.`, 'The machine will boot with no display output.'));
  }

  // 12. Power supply.
  const wattage = estimateWattage(items, parts);
  const recommendedPsu = recommendedPsuWattage(wattage);
  if (psu) {
    const w = num(psuS.wattage);
    if (w != null) {
      if (w < wattage) {
        issues.push(issue('error', 'psu-undersized', `${psu.name} supplies ${w}W but the build draws about ${wattage}W.`, `Fit at least a ${recommendedPsu}W unit.`));
      } else if (w < wattage * 1.25) {
        issues.push(issue('warning', 'psu-tight', `${w}W supply against an estimated ${wattage}W load leaves little headroom.`, `A ${recommendedPsu}W unit gives room for transients and future upgrades.`));
      }
    } else {
      issues.push(issue('info', 'psu-wattage-unknown', 'PSU wattage not recorded, power headroom was not checked.'));
    }
    if (kase) {
      if (psuS.formFactor && caseS.psuFormFactor && psuS.formFactor !== caseS.psuFormFactor) {
        issues.push(issue('error', 'psu-form-factor', `${psuS.formFactor} supply does not fit ${kase.name}, which takes ${caseS.psuFormFactor}.`));
      }
      const psuLen = num(psuS.lengthMm);
      const maxPsu = num(caseS.maxPsuLengthMm);
      if (psuLen != null && maxPsu != null && psuLen > maxPsu) {
        issues.push(issue('error', 'psu-length', `${psu.name} is ${psuLen}mm deep, ${kase.name} clears ${maxPsu}mm.`));
      }
    }
    if (gpu) {
      const need8 = num(gpuS.pcie8pin);
      const have8 = num(psuS.pcie8pin);
      if (need8 != null && have8 != null && need8 > have8) {
        issues.push(issue('error', 'pcie-connectors', `${gpu.name} needs ${need8} PCIe 8-pin connectors, ${psu.name} has ${have8}.`, 'Adapters off the SATA rail are not a safe substitute at this power level.'));
      }
      if (gpuS.pcie12vhpwr && psuS.pcie12vhpwr === false) {
        issues.push(issue('warning', 'vhpwr', `${gpu.name} uses a 12VHPWR connector, ${psu.name} is not listed as supplying one.`, 'An adapter ships with most cards but confirm it is in the box.'));
      }
    }
  }

  const errors = issues.filter(i => i.severity === 'error');
  const warnings = issues.filter(i => i.severity === 'warning');
  const infos = issues.filter(i => i.severity === 'info');
  return { issues, errors, warnings, infos, wattage, recommendedPsu, ok: errors.length === 0 };
}

// ── Compatibility filtering for the part picker ──────────────────────────────
// The picker should offer only parts that fit what is already chosen. Rather
// than teaching the server the rules, this derives a plain list of constraints
// from the current build and the server applies them as dumb field matches, so
// the rules still live in exactly one place.
//
// A constraint is { field, op, value } against part.specs, where op is one of
// eq | in | contains | lte | gte. A part whose spec is not recorded is always
// included: an unknown value cannot be proven incompatible, which is the same
// principle checkBuild() uses when it skips a rule and says the check did not
// run. Hiding those would quietly bury every part with a blank spec.

export function compatibilityFilter(category, items, parts) {
  const g = {};
  for (const r of selectedParts(items, parts)) {
    const c = r.part.category || 'other';
    (g[c] = g[c] || []).push(r);
  }
  const one = (cat) => (g[cat] && g[cat].length ? g[cat][0].part : null);
  const specOf = (cat) => one(cat)?.specs || {};

  const cpu = specOf('cpu'), board = specOf('motherboard'), kase = specOf('case');
  const gpu = specOf('gpu'), psu = specOf('psu'), cooler = specOf('cooler');
  const ram = (g.ram || []).map(r => r.part.specs || {});
  const out = [];
  const add = (field, op, value) => {
    if (value === undefined || value === null || value === '') return;
    if (Array.isArray(value) && !value.length) return;
    out.push({ field, op, value });
  };

  switch (category) {
    case 'cpu':
      add('socket', 'eq', board.socket);
      // A DDR4 board cannot take a DDR5-only chip. Parts supporting both leave
      // memoryType unset and pass either way.
      add('memoryType', 'eq', board.memoryType);
      break;

    case 'motherboard':
      add('socket', 'eq', cpu.socket);
      add('memoryType', 'eq', cpu.memoryType || ram.find(r => r.memoryType)?.memoryType);
      add('formFactor', 'in', kase.maxBoardFormFactor ? boardFormFactorsFitting(kase.maxBoardFormFactor) : null);
      break;

    case 'ram':
      add('memoryType', 'eq', board.memoryType || cpu.memoryType);
      break;

    case 'cooler':
      add('sockets', 'contains', cpu.socket || board.socket);
      add('heightMm', 'lte', kase.maxCoolerHeightMm);
      add('radiatorMm', 'lte', kase.radiatorMm);
      add('tdpRating', 'gte', cpu.tdp);
      break;

    case 'gpu':
      add('lengthMm', 'lte', kase.maxGpuLengthMm);
      break;

    case 'psu':
      add('formFactor', 'eq', kase.psuFormFactor);
      add('lengthMm', 'lte', kase.maxPsuLengthMm);
      // Only meaningful once there is something to power.
      if (items && items.length) add('wattage', 'gte', estimateWattage(items, parts));
      if (gpu.pcie8pin) add('pcie8pin', 'gte', gpu.pcie8pin);
      break;

    case 'case':
      add('maxBoardFormFactor', 'in', board.formFactor
        ? BOARD_SIZE_ORDER.slice(BOARD_SIZE_ORDER.indexOf(board.formFactor)).filter(Boolean)
        : null);
      add('maxGpuLengthMm', 'gte', gpu.lengthMm);
      add('maxCoolerHeightMm', 'gte', cooler.coolerType === 'Liquid (AIO)' ? null : cooler.heightMm);
      add('radiatorMm', 'gte', cooler.coolerType === 'Liquid (AIO)' ? cooler.radiatorMm : null);
      add('psuFormFactor', 'eq', psu.formFactor);
      break;

    default:
      break;
  }
  return out;
}

/** Apply the constraints above to one part. Shared by the server and the UI. */
export function partMatchesFilter(part, constraints) {
  const specs = (part && part.specs) || {};
  for (const c of constraints || []) {
    const v = specs[c.field];
    // Not recorded, so it cannot be ruled out.
    if (v === undefined || v === null || v === '') continue;
    switch (c.op) {
      case 'eq':       if (String(v) !== String(c.value)) return false; break;
      case 'in':       if (!c.value.map(String).includes(String(v))) return false; break;
      case 'contains': if (!Array.isArray(v) || !v.map(String).includes(String(c.value))) return false; break;
      case 'lte':      if (Number(v) > Number(c.value)) return false; break;
      case 'gte':      if (Number(v) < Number(c.value)) return false; break;
      default: break;
    }
  }
  return true;
}

// ── Pricing ──────────────────────────────────────────────────────────────────

/**
 * Parts subtotal, labour subtotal and grand total for a build.
 * Prices are per-unit sell prices in AUD, quantities multiply.
 */
export function buildTotals(build, parts) {
  const resolved = selectedParts(build?.items, parts);
  const partsSubtotal = resolved.reduce((s, r) => s + (Number(r.part.priceAud) || 0) * r.qty, 0);
  const partsCost = resolved.reduce((s, r) => s + (Number(r.part.cost) || 0) * r.qty, 0);
  const labourSubtotal = (build?.labour || []).reduce((s, l) => s + (Number(l.amount) || 0) * (Number(l.qty) || 1), 0);
  const round = (n) => Math.round(n * 100) / 100;
  return {
    partsSubtotal: round(partsSubtotal),
    partsCost: round(partsCost),
    labourSubtotal: round(labourSubtotal),
    total: round(partsSubtotal + labourSubtotal),
    margin: round(partsSubtotal + labourSubtotal - partsCost),
  };
}

/** Line items for a quote generated from this build, in build order. */
export function buildQuoteLineItems(build, parts) {
  const resolved = selectedParts(build?.items, parts);
  const order = PC_PART_CATEGORIES.map(c => c.key);
  const sorted = [...resolved].sort((a, b) => order.indexOf(a.part.category) - order.indexOf(b.part.category));
  const lines = sorted.map((r, i) => ({
    id: `pcb-${i}-${r.part.id || 'part'}`,
    description: `${categoryLabel(r.part.category)}: ${partDisplayName(r.part)}`,
    amount: Number(r.part.priceAud) || 0,
    qty: r.qty,
  }));
  (build?.labour || []).forEach((l, i) => {
    if (!l.description && !l.amount) return;
    lines.push({
      id: `pcb-labour-${i}`,
      description: l.description || 'Assembly',
      amount: Number(l.amount) || 0,
      qty: Number(l.qty) || 1,
    });
  });
  return lines;
}
