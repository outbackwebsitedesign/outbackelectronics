// NOT WIRED TO ANYTHING. Kept for reference only.
//
// Automated access to PCPartPicker is against their terms and they enforce it
// at the IP level. Driving lookups through this module got the shop's own
// address blocked, which removed PCPartPicker from staff browsers across the
// whole network, not just from this code. Throttling does not solve that; the
// block is a response to automated access at all, not to its rate.
//
// Do not reconnect this without an arrangement with PCPartPicker.

// PCPartPicker enrichment backed by the maintained Python `pypartpicker`
// package. A single persistent Python process is shared across lookups so bulk
// enrichment does not start a new interpreter/session for every part.

const { spawn } = require('child_process');
const path = require('path');

const CATEGORY_PATH = {
  case: 'case',
  motherboard: 'motherboard',
  cooler: 'cpu-cooler',
  gpu: 'video-card',
  psu: 'power-supply',
};

const norm = (s) => String(s || '').toLowerCase().replace(/[®™]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
const num = (s) => { const m = String(s || '').replace(/,/g, '').match(/\d+(?:\.\d+)?/); return m ? Number(m[0]) : undefined; };

function find(specs, ...names) {
  const entries = Object.entries(specs || {}).map(([k, v]) => [norm(k), v]);
  for (const name of names) {
    const n = norm(name);
    const exact = entries.find(([k]) => k === n);
    if (exact) return exact[1];
  }
  for (const name of names) {
    const tokens = norm(name).split(' ').filter(Boolean);
    const hit = entries.find(([k]) => tokens.every(t => k.includes(t)));
    if (hit) return hit[1];
  }
  return '';
}

function boolCable(raw) {
  if (!raw) return undefined;
  const t = norm(raw);
  if (/^(?:none|no|0|false)$/.test(t)) return false;
  return /12vhpwr|12v 2x6|16 pin/.test(t) ? true : undefined;
}

function mapSpecs(raw, category) {
  const s = {};
  const putNum = (key, ...names) => { const n = num(find(raw, ...names)); if (Number.isFinite(n)) s[key] = n; };
  if (category === 'case') {
    putNum('maxGpuLengthMm', 'Maximum Video Card Length', 'Maximum Graphics Card Length');
    putNum('maxCoolerHeightMm', 'Maximum CPU Cooler Height', 'CPU Cooler Height');
    putNum('maxPsuLengthMm', 'Maximum PSU Length', 'Maximum Power Supply Length');
  } else if (category === 'motherboard') {
    putNum('m2Slots', 'M.2 Slots', 'M.2 Socket');
    putNum('sataPorts', 'SATA 6 Gb/s', 'SATA Ports', 'SATA Connectors');
  } else if (category === 'cooler') {
    putNum('heightMm', 'Height', 'CPU Cooler Height');
    const sockets = find(raw, 'CPU Socket', 'Socket', 'Compatible Socket');
    if (sockets) s.sockets = String(sockets).split(/[,;/]/).map(x => x.trim()).filter(Boolean);
  } else if (category === 'gpu') {
    putNum('tdp', 'TDP', 'Thermal Design Power', 'Power Consumption');
    putNum('lengthMm', 'Length', 'Card Length');
    putNum('pcie8pin', 'PCIe 8-Pin Connectors', '8-Pin PCIe');
    const power = find(raw, 'External Power', 'Power Connectors', 'Supplementary Power');
    const has12 = boolCable(power);
    if (has12 !== undefined) s.pcie12vhpwr = has12;
  } else if (category === 'psu') {
    putNum('lengthMm', 'Length', 'Depth');
    putNum('pcie8pin', 'PCIe 6+2-Pin Connectors', 'PCIe 8-Pin Connectors', 'PCIe Connectors');
    const conn = find(raw, 'PCIe 12+4-Pin 12VHPWR Connectors', '12VHPWR Connectors', 'PCIe Connectors');
    const has12 = boolCable(conn);
    if (has12 !== undefined) s.pcie12vhpwr = has12;
  }
  return s;
}

let child = null;
let buffer = '';
let seq = 1;
const pending = new Map();
let fatal = null;

function failAll(reason, message) {
  for (const { resolve, timer } of pending.values()) {
    clearTimeout(timer);
    resolve({ ok:false, reason, message });
  }
  pending.clear();
}

function startBridge() {
  if (child && !child.killed) return child;
  fatal = null;
  buffer = '';
  const python = process.env.PYTHON || process.env.PYTHON3 || 'python3';
  child = spawn(python, [path.join(__dirname, 'pcpartpicker_bridge.py')], {
    cwd: __dirname,
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  child.stdout.setEncoding('utf8');
  child.stdout.on('data', chunk => {
    buffer += chunk;
    while (buffer.includes('\n')) {
      const i = buffer.indexOf('\n');
      const line = buffer.slice(0, i).trim();
      buffer = buffer.slice(i + 1);
      if (!line) continue;
      let msg;
      try { msg = JSON.parse(line); } catch { continue; }
      if (msg.fatal) {
        fatal = msg;
        failAll(msg.fatal, msg.message || 'pypartpicker bridge failed to start.');
        continue;
      }
      const item = pending.get(msg.id);
      if (!item) continue;
      pending.delete(msg.id);
      clearTimeout(item.timer);
      item.resolve(msg);
    }
  });
  child.stderr.setEncoding('utf8');
  child.stderr.on('data', chunk => {
    const line = String(chunk || '').trim();
    if (line) console.warn('[pypartpicker]', line.slice(0, 1000));
  });
  child.on('error', err => {
    fatal = { fatal:'bridge_start_failed', message:String(err && err.message || err) };
    failAll(fatal.fatal, fatal.message);
  });
  child.on('exit', (code, signal) => {
    const reason = fatal?.fatal || 'bridge_exited';
    const message = fatal?.message || `pypartpicker bridge exited (${code ?? signal ?? 'unknown'}).`;
    failAll(reason, message);
    child = null;
  });
  return child;
}

function bridgeLookup(payload, timeoutMs = 60000) {
  if (fatal) return Promise.resolve({ ok:false, reason:fatal.fatal, message:fatal.message });
  const proc = startBridge();
  const id = seq++;
  return new Promise(resolve => {
    const timer = setTimeout(() => {
      pending.delete(id);
      resolve({ ok:false, reason:'timeout', message:'PCPartPicker lookup timed out.' });
    }, timeoutMs);
    pending.set(id, { resolve, timer });
    try {
      proc.stdin.write(JSON.stringify({ id, ...payload }) + '\n');
    } catch (err) {
      pending.delete(id);
      clearTimeout(timer);
      resolve({ ok:false, reason:'bridge_write_failed', message:String(err && err.message || err) });
    }
  });
}

async function lookup({ category, brand = '', model = '', mpn = '' }) {
  if (category && !CATEGORY_PATH[category]) return { ok:false, reason:'unsupported_category' };
  const query = String(mpn || model || '').trim();
  if (!query) return { ok:false, reason:'missing_identity' };

  const result = await bridgeLookup({ brand, mpn:query, model });
  if (!result.ok) return result;
  const rawSpecs = result.rawSpecs || {};
  const specs = category ? mapSpecs(rawSpecs, category) : {};
  if (category && !Object.keys(specs).length) {
    return { ok:false, reason:'no_useful_specs', url:result.url, rawSpecs, matchedName:result.name };
  }
  return {
    ok:true,
    specs,
    rawSpecs,
    url:result.url,
    matchedName:result.name,
    score:result.score,
  };
}

module.exports = { lookup, mapSpecs, CATEGORY_PATH };
