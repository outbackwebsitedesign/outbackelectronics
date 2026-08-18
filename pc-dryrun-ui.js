// Non-writing dry-run controls for the PC Builder fit-spec enrichment card.
//
// Kept separate from pages-admin.jsx so this can be enabled without making the
// already-large admin component harder to maintain. The script only calls the
// existing read-only parts query and single-part Icecat lookup endpoint. That
// lookup now falls through to PCPartPicker on Open Icecat misses. No save,
// enrich, import, or other database-writing endpoint is called here.

import { ensureCsrf, getCsrf } from './src/lib/api.js';

const SAMPLE_SIZE = 10;
const LIST_LIMIT = 200;
const TARGET_FIELDS = {
  case: ['maxGpuLengthMm', 'maxCoolerHeightMm'],
  motherboard: ['m2Slots', 'sataPorts'],
  cooler: ['heightMm', 'sockets'],
  psu: ['lengthMm', 'pcie8pin'],
  gpu: ['tdp'],
};
const CATEGORIES = [
  ['case', 'Cases'],
  ['motherboard', 'Motherboards'],
  ['cooler', 'CPU coolers'],
  ['psu', 'Power supplies'],
  ['gpu', 'Graphics cards'],
];

const state = {
  running: null,
  results: {},
};

function isBlank(v) {
  return v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0);
}

function incomplete(part, category) {
  const needed = TARGET_FIELDS[category] || [];
  return needed.some(k => isBlank((part.specs || {})[k]));
}

function csrfHeaders() {
  return { 'Content-Type': 'application/json', 'X-CSRF-Token': getCsrf() };
}

function sourceOf(result) {
  return (result.matched || []).some(m => String(m.feature || '').toLowerCase() === 'pcpartpicker')
    ? 'PCPartPicker'
    : 'Icecat';
}

function additionsFor(part, found) {
  const out = {};
  for (const [key, value] of Object.entries(found || {})) {
    if (isBlank((part.specs || {})[key]) && !isBlank(value)) out[key] = value;
  }
  return out;
}

function displayValue(v) {
  if (Array.isArray(v)) return v.join(', ');
  if (typeof v === 'boolean') return v ? 'yes' : 'no';
  return String(v);
}

async function lookupPart(part, category) {
  const body = {
    category,
    brand: part.brand || '',
    mpn: part.mpn || part.sourceName || part.name || '',
    productName: part.name || '',
  };
  const response = await fetch('/api/admin/pc-builder/icecat/lookup', {
    method: 'POST',
    headers: csrfHeaders(),
    credentials: 'include',
    body: JSON.stringify(body),
  }).catch(() => null);

  if (!response) return { part, ok:false, reason:'network_error', message:'No response from the server.' };
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    return {
      part,
      ok:false,
      reason:data.error || `http_${response.status}`,
      message:data.message || '',
    };
  }

  const additions = additionsFor(part, data.specs || {});
  return {
    part,
    ok:true,
    source:sourceOf(data),
    title:data.title || '',
    specs:data.specs || {},
    additions,
    matchedBy:data.matchedBy || '',
  };
}

async function runDry(category) {
  if (state.running) return;
  state.running = category;
  state.results[category] = { loading:true };
  render();

  try {
    await ensureCsrf();
    const params = new URLSearchParams({ category, limit:String(LIST_LIMIT) });
    const listResponse = await fetch(`/api/admin/pc-builder/parts?${params}`, { credentials:'include' });
    if (!listResponse.ok) throw new Error(`Could not load parts (${listResponse.status}).`);
    const list = await listResponse.json();
    const candidates = (list.items || [])
      .filter(p => !p.specsEditedByStaff)
      .filter(p => p.brand && (p.mpn || p.sourceName || p.name))
      .filter(p => incomplete(p, category))
      .slice(0, SAMPLE_SIZE);

    if (!candidates.length) {
      state.results[category] = {
        summary:{ sampled:0, matched:0, useful:0, fields:0, failed:0 },
        rows:[],
        note:`No incomplete ${category} parts were found in the first ${LIST_LIMIT} library results.`,
      };
      return;
    }

    const rows = new Array(candidates.length);
    let cursor = 0;
    // Two workers keeps a ten-item preview reasonably quick without turning a
    // dry run into a burst of scraper traffic.
    const worker = async () => {
      while (cursor < candidates.length) {
        const index = cursor++;
        rows[index] = await lookupPart(candidates[index], category);
        render();
        await new Promise(resolve => setTimeout(resolve, 250));
      }
    };
    await Promise.all(Array.from({ length:Math.min(2, candidates.length) }, () => worker()));

    const summary = { sampled:rows.length, matched:0, useful:0, fields:0, failed:0, icecat:0, pcpartpicker:0 };
    for (const row of rows) {
      if (!row?.ok) { summary.failed++; continue; }
      summary.matched++;
      if (row.source === 'PCPartPicker') summary.pcpartpicker++; else summary.icecat++;
      const count = Object.keys(row.additions || {}).length;
      summary.fields += count;
      if (count) summary.useful++;
    }
    state.results[category] = { summary, rows };
  } catch (err) {
    state.results[category] = { error:String(err?.message || err || 'Dry run failed.') };
  } finally {
    state.running = null;
    render();
  }
}

function findCard() {
  const headings = [...document.querySelectorAll('div')];
  const heading = headings.find(el => {
    const own = [...el.childNodes].filter(n => n.nodeType === Node.TEXT_NODE).map(n => n.textContent).join(' ').trim();
    return own === 'Fill in fit specs from Icecat' || own === 'Fill in fit specs from Icecat + PCPartPicker';
  });
  if (!heading) return null;
  let card = heading.parentElement;
  while (card && card !== document.body) {
    if (card.querySelector && CATEGORIES.some(([, label]) => card.textContent.includes(label))) return card;
    card = card.parentElement;
  }
  return null;
}

function findCategoryRow(card, label) {
  const spans = [...card.querySelectorAll('span')];
  const labelSpan = spans.find(el => {
    const own = [...el.childNodes].find(n => n.nodeType === Node.TEXT_NODE && n.textContent.trim());
    return own && own.textContent.trim() === label;
  });
  if (!labelSpan) return null;
  let row = labelSpan.parentElement;
  while (row && row !== card) {
    if (row.classList?.contains('row-flex') && row.querySelector('button')) return row;
    row = row.parentElement;
  }
  return null;
}

function makeButton(category) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'btn btn-ghost btn-sm';
  button.dataset.pcDryrun = category;
  button.textContent = state.running === category ? 'Testing…' : `Dry run ${SAMPLE_SIZE}`;
  button.disabled = !!state.running;
  button.title = 'Test a sample without changing any part specs or enrichment timestamps.';
  button.addEventListener('click', () => runDry(category));
  return button;
}

function renderResults(card) {
  let panel = card.querySelector('[data-pc-dryrun-results]');
  const entries = Object.entries(state.results).filter(([, r]) => r && !r.loading);
  if (!entries.length) {
    if (panel) panel.remove();
    return;
  }
  if (!panel) {
    panel = document.createElement('div');
    panel.dataset.pcDryrunResults = '1';
    panel.style.marginTop = '10px';
    card.appendChild(panel);
  }
  panel.replaceChildren();

  for (const [category, result] of entries) {
    const label = CATEGORIES.find(([key]) => key === category)?.[1] || category;
    const box = document.createElement('details');
    box.open = true;
    Object.assign(box.style, { border:'1px solid var(--line)', padding:'8px 10px', marginTop:'7px' });
    const summaryEl = document.createElement('summary');
    Object.assign(summaryEl.style, { cursor:'pointer', fontSize:'12.5px', fontWeight:'600' });

    if (result.error) {
      summaryEl.textContent = `${label} dry run failed: ${result.error}`;
      summaryEl.style.color = 'var(--rust)';
      box.appendChild(summaryEl);
      panel.appendChild(box);
      continue;
    }

    const s = result.summary || {};
    summaryEl.textContent = result.note || `${label}: ${s.matched || 0}/${s.sampled || 0} matched, ${s.useful || 0} would add missing specs, ${s.fields || 0} fields, ${s.failed || 0} failed`;
    box.appendChild(summaryEl);

    if (s.sampled) {
      const sourceLine = document.createElement('div');
      sourceLine.className = 'mono';
      sourceLine.style.cssText = 'font-size:10.5px;color:var(--ink-3);margin:6px 0';
      sourceLine.textContent = `Sources in sample: ${s.icecat || 0} Icecat, ${s.pcpartpicker || 0} PCPartPicker`;
      box.appendChild(sourceLine);
    }

    for (const row of result.rows || []) {
      const line = document.createElement('div');
      line.style.cssText = `font-size:11.5px;margin-top:4px;color:${row.ok ? 'var(--ink-2)' : 'var(--rust)'}`;
      const name = `${row.part.brand ? row.part.brand + ' ' : ''}${row.part.name || ''}`.trim();
      if (!row.ok) {
        line.textContent = `${name}: ${row.reason}${row.message ? ' · ' + row.message : ''}`;
      } else {
        const fields = Object.entries(row.additions || {}).map(([k,v]) => `${k}=${displayValue(v)}`);
        line.textContent = `${name}: ${row.source}${fields.length ? ' · ' + fields.join(' · ') : ' · matched, but no missing target fields would change'}`;
      }
      box.appendChild(line);
    }

    const safe = document.createElement('div');
    safe.style.cssText = 'font-size:10.5px;color:var(--ink-3);margin-top:7px';
    safe.textContent = 'Preview only. This did not save specs, mark parts as tried, or modify the parts library.';
    box.appendChild(safe);
    panel.appendChild(box);
  }
}

function render() {
  const card = findCard();
  if (!card) return;

  const heading = [...card.querySelectorAll('div')].find(el => el.textContent.trim() === 'Fill in fit specs from Icecat');
  if (heading && heading.childNodes.length === 1) heading.textContent = 'Fill in fit specs from Icecat + PCPartPicker';

  for (const [category, label] of CATEGORIES) {
    const row = findCategoryRow(card, label);
    if (!row) continue;
    let button = row.querySelector(`[data-pc-dryrun="${category}"]`);
    if (!button) {
      const buttons = [...row.querySelectorAll('button')];
      const normal = buttons[buttons.length - 1];
      button = makeButton(category);
      if (normal?.parentElement) normal.parentElement.insertBefore(button, normal);
      else row.appendChild(button);
    } else {
      button.textContent = state.running === category ? 'Testing…' : `Dry run ${SAMPLE_SIZE}`;
      button.disabled = !!state.running;
    }
  }
  renderResults(card);
}

let queued = false;
const observer = new MutationObserver(() => {
  if (queued) return;
  queued = true;
  requestAnimationFrame(() => { queued = false; render(); });
});

function start() {
  observer.observe(document.body, { childList:true, subtree:true });
  render();
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once:true });
else start();
