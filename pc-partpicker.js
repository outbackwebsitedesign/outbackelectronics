// PCPartPicker detail-page enrichment for compatibility-critical PC specs.
//
// PCPartPicker has no supported public API. This module therefore performs
// deliberately conservative, on-demand reads of public product/search pages.
// Callers must throttle requests and cache both hits and misses. It never reads
// prices and never guesses a specification that is not present on the page.
//
// The HTML parser intentionally depends on the small, stable semantic surface
// used by PCPartPicker product pages: search result product links and the
// .specs/.group--spec detail list. If their markup changes, a lookup fails
// closed and leaves the existing library untouched.

const BASE_URL = 'https://pcpartpicker.com';
const USER_AGENT = 'OutbackElectronics-PCBuilder/1.0 (+https://outbackelectronics.com.au)';

const CATEGORY_PATH = {
  case: 'case',
  motherboard: 'motherboard',
  cooler: 'cpu-cooler',
  gpu: 'video-card',
  psu: 'power-supply',
};

const wanted = new Set(Object.keys(CATEGORY_PATH));
const text = (s) => String(s || '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'").replace(/\s+/g, ' ').trim();
const norm = (s) => text(s).toLowerCase().replace(/[®™]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
const num = (s) => { const m = String(s || '').replace(/,/g, '').match(/\d+(?:\.\d+)?/); return m ? Number(m[0]) : undefined; };

function fetchPage(url, timeoutMs = 15000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { redirect: 'follow', signal: controller.signal, headers: { 'User-Agent': USER_AGENT, Accept: 'text/html,application/xhtml+xml' } })
    .finally(() => clearTimeout(timer));
}

function blocked(html, status) {
  const t = String(html || '');
  return status === 429 || /<title>\s*(?:Just a moment|Unavailable|Verification)\s*<\/title>/i.test(t);
}

function productLinks(html) {
  const out = [];
  const re = /href=["'](\/product\/[^"'#?]+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = re.exec(html))) {
    const name = text(m[2]);
    if (!name || out.some(x => x.path === m[1])) continue;
    out.push({ path: m[1], name });
  }
  return out;
}

function scoreCandidate(candidate, brand, model) {
  const c = norm(candidate.name);
  const b = norm(brand);
  const q = norm(model);
  if (!c || !q) return 0;
  let score = 0;
  if (c === q || (b && c === `${b} ${q}`)) score += 1000;
  if (c.includes(q)) score += 500;
  const tokens = q.split(' ').filter(x => x.length > 1);
  if (tokens.length) score += Math.round(tokens.filter(t => c.includes(t)).length / tokens.length * 300);
  if (b && c.includes(b)) score += 100;
  return score;
}

function parseSpecs(html) {
  const specs = {};
  // Current product pages render each spec as group--spec with a title/content.
  const blockRe = /<[^>]+class=["'][^"']*group--spec[^"']*["'][^>]*>([\s\S]*?)<\/[^>]+>\s*(?=<[^>]+class=["'][^"']*group--spec|<\/div>|<\/section>)/gi;
  let m;
  while ((m = blockRe.exec(html))) {
    const block = m[1];
    const tm = block.match(/class=["'][^"']*group__title[^"']*["'][^>]*>([\s\S]*?)<\//i);
    const vm = block.match(/class=["'][^"']*group__content[^"']*["'][^>]*>([\s\S]*?)<\//i);
    if (tm && vm) specs[text(tm[1])] = text(vm[1]);
  }
  // More tolerant fallback for markup where the wrappers nest deeper.
  if (!Object.keys(specs).length) {
    const pairRe = /class=["'][^"']*group__title[^"']*["'][^>]*>([\s\S]*?)<\/[^>]+>[\s\S]{0,1000}?class=["'][^"']*group__content[^"']*["'][^>]*>([\s\S]*?)<\/[^>]+>/gi;
    while ((m = pairRe.exec(html))) specs[text(m[1])] = text(m[2]);
  }
  return specs;
}

function find(specs, ...names) {
  const entries = Object.entries(specs).map(([k, v]) => [norm(k), v]);
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
  if (/none|no|0/.test(t)) return false;
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
    if (sockets) s.sockets = sockets.split(/[,;/]/).map(x => x.trim()).filter(Boolean);
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

async function lookup({ category, brand = '', model = '', mpn = '' }) {
  if (!wanted.has(category)) return { ok: false, reason: 'unsupported_category' };
  const query = String(mpn || model || '').trim();
  if (!query) return { ok: false, reason: 'missing_identity' };
  const searchUrl = `${BASE_URL}/search/?q=${encodeURIComponent([brand, query].filter(Boolean).join(' '))}`;
  try {
    const search = await fetchPage(searchUrl);
    const searchHtml = await search.text();
    if (blocked(searchHtml, search.status)) return { ok: false, reason: 'blocked', status: search.status };
    if (!search.ok) return { ok: false, reason: 'http_error', status: search.status };

    // A sufficiently specific search can redirect straight to /product/.
    let productUrl = search.url.includes('/product/') ? search.url : '';
    if (!productUrl) {
      const links = productLinks(searchHtml)
        .map(x => ({ ...x, score: scoreCandidate(x, brand, query) }))
        .filter(x => x.score >= 200)
        .sort((a, b) => b.score - a.score);
      if (!links.length) return { ok: false, reason: 'not_found' };
      // Refuse ambiguous weak matches. A wrong compatibility spec is worse than
      // a blank one.
      if (links[1] && links[0].score < 700 && links[0].score - links[1].score < 80) return { ok: false, reason: 'ambiguous' };
      productUrl = BASE_URL + links[0].path;
    }

    const product = productUrl === search.url ? { html: searchHtml, status: search.status } : await (async () => {
      const r = await fetchPage(productUrl); return { html: await r.text(), status: r.status, url: r.url };
    })();
    if (blocked(product.html, product.status)) return { ok: false, reason: 'blocked', status: product.status };
    if (product.status < 200 || product.status >= 300) return { ok: false, reason: 'http_error', status: product.status };
    const rawSpecs = parseSpecs(product.html);
    if (!Object.keys(rawSpecs).length) return { ok: false, reason: 'parse_failed' };
    const specs = mapSpecs(rawSpecs, category);
    if (!Object.keys(specs).length) return { ok: false, reason: 'no_useful_specs', url: productUrl };
    return { ok: true, specs, rawSpecs, url: productUrl };
  } catch (err) {
    return { ok: false, reason: err && err.name === 'AbortError' ? 'timeout' : 'error', message: String(err && err.message || err) };
  }
}

module.exports = { lookup, parseSpecs, mapSpecs, scoreCandidate, CATEGORY_PATH };
