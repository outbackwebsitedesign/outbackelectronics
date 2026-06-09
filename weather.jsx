import { useState, useEffect, useRef, createContext, useContext, useCallback } from 'react';
import { makePortalHelpers } from './src/lib/api.js';

// ── Weather data ───────────────────────────────────────────────────────────────

const READINGS = [
  { key: 'temperature', label: 'Temperature',     unit: '°C',   group: 'environment' },
  { key: 'humidity',    label: 'Humidity',         unit: '%',    group: 'environment' },
  { key: 'pressure',    label: 'Pressure',         unit: 'hPa',  group: 'environment' },
  { key: 'voc',         label: 'Air Quality (VOC)',unit: 'kΩ',   group: 'environment', note: 'Higher = cleaner air' },
  { key: 'co2',         label: 'CO₂',             unit: 'ppm',  group: 'environment' },
  { key: 'o2',          label: 'Oxygen',           unit: '%Vol', group: 'gas' },
  { key: 'nh3',         label: 'Ammonia',          unit: 'ppm',  group: 'gas' },
  { key: 'h2',          label: 'Hydrogen',         unit: 'ppm',  group: 'gas' },
  { key: 'ch4',         label: 'Methane',          unit: 'ppm',  group: 'gas' },
  { key: 'co',          label: 'Carbon Monoxide',  unit: 'ppm',  group: 'gas' },
  { key: 'h2s',         label: 'Hydrogen Sulfide', unit: 'ppm',  group: 'gas' },
  { key: 'combustible', label: 'Combustible Gas',  unit: 'ppm',  group: 'gas', note: 'CH₄, C₃H₈, C₄H₁₀' },
  { key: 'compass',     label: 'Compass Heading',  unit: '°',    group: 'other' },
  { key: 'mag_x',       label: 'Magnetic Field X', unit: 'µT',   group: 'other' },
  { key: 'mag_y',       label: 'Magnetic Field Y', unit: 'µT',   group: 'other' },
  { key: 'mag_z',       label: 'Magnetic Field Z', unit: 'µT',   group: 'other' },
];

const GROUPS = [
  { key: 'environment', label: 'Environment' },
  { key: 'gas',         label: 'Gas Detection' },
  { key: 'other',       label: 'Other' },
];

function formatAge(ms) {
  if (ms < 60000) return `${Math.floor(ms / 1000)}s ago`;
  if (ms < 3600000) return `${Math.round(ms / 60000)}m ago`;
  if (ms < 86400000) return `${Math.round(ms / 3600000)}h ago`;
  return `${Math.round(ms / 86400000)}d ago`;
}

function ReadingCard({ def, value, ts, onClick }) {
  const age = ts ? Date.now() - ts : null;
  const stale = age !== null && age > 120000;
  const offline = value === null || value === undefined;

  return (
    <div className="card" onClick={onClick} style={{
      padding: '20px',
      display: 'flex', flexDirection: 'column', gap: 8,
      opacity: offline ? 0.4 : 1,
      borderLeft: stale ? '3px solid var(--ochre)' : offline ? '3px solid var(--line-strong)' : '3px solid var(--eucalyptus)',
      cursor: onClick ? 'pointer' : 'default',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 13, color: 'var(--ink-2)', fontWeight: 500 }}>{def.label}</span>
        {ts && !offline && <span className="mono" style={{ fontSize: 10, color: stale ? 'var(--ochre)' : 'var(--ink-3)' }}>
          {formatAge(age)}
        </span>}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <span style={{ fontSize: 36, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", lineHeight: 1 }}>
          {offline ? '—' : typeof value === 'number' ? value.toFixed(1) : value}
        </span>
        <span style={{ fontSize: 14, color: 'var(--ink-2)', fontFamily: "'JetBrains Mono', monospace" }}>{def.unit}</span>
      </div>
      {def.note && !offline && <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>{def.note}</div>}
    </div>
  );
}

// ── Sparkline / line graph ─────────────────────────────────────────────────────
function LineGraph({ points, color = 'var(--rust)', height = 200, fromTs, toTs }) {
  const now = Date.now();
  const minT = fromTs != null ? fromTs : (points.length ? Math.min(...points.map(p => p.t)) : now - 3600000);
  const maxT = toTs   != null ? toTs   : now;
  const tRange = maxT - minT || 1;

  if (!points || points.length < 2) return (
    <svg viewBox={`0 0 800 ${height}`} style={{ width: '100%', height: 'auto', display: 'block', overflow: 'visible' }}>
      {/* still render axes so the empty graph looks intentional */}
      {Array.from({ length: 5 }, (_, i) => (
        <line key={i} x1={48} x2={788} y1={8 + ((height - 36) * i) / 4} y2={8 + ((height - 36) * i) / 4}
          stroke="var(--line)" strokeWidth="1" />
      ))}
      {Array.from({ length: 7 }, (_, i) => {
        const t = minT + (tRange * i) / 6;
        const xPos = 48 + ((t - minT) / tRange) * (800 - 48 - 12);
        const d = new Date(t);
        const label = `${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`;
        return (
          <text key={i} x={xPos} y={height - 6} textAnchor="middle"
            fontSize="10" fill="var(--ink-3)" fontFamily="'JetBrains Mono', monospace">{label}</text>
        );
      })}
      <text x={420} y={height / 2} textAnchor="middle" fontSize="13" fill="var(--ink-3)" fontFamily="inherit">No data for this period</text>
    </svg>
  );

  const values = points.map(p => p.v);
  const W = 800, H = height;
  const PAD = { top: 8, bottom: 28, left: 48, right: 12 };
  const iw = W - PAD.left - PAD.right;
  const ih = H - PAD.top - PAD.bottom;
  const minV = Math.min(...values);
  const maxV = Math.max(...values);
  const range = maxV - minV || 1;

  const x = t  => PAD.left + ((t  - minT) / tRange) * iw;
  const y = v  => PAD.top  + (1 - (v  - minV) / range) * ih;

  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(p.t).toFixed(1)},${y(p.v).toFixed(1)}`).join(' ');
  const areaD = pathD + ` L${x(points[points.length - 1].t).toFixed(1)},${(PAD.top + ih).toFixed(1)} L${x(points[0].t).toFixed(1)},${(PAD.top + ih).toFixed(1)} Z`;

  // Y-axis ticks
  const yTicks = 4;
  const yTickVals = Array.from({ length: yTicks + 1 }, (_, i) => minV + (range * i) / yTicks);

  const xTickCount = 6;
  const xTicks = Array.from({ length: xTickCount + 1 }, (_, i) => minT + (tRange * i) / xTickCount);

  const fmt = (v) => Math.abs(v) >= 1000 ? v.toFixed(0) : Math.abs(v) >= 10 ? v.toFixed(1) : v.toFixed(2);
  const fmtTime = (ms) => {
    const d = new Date(ms);
    const rangeDays = tRange / 86400000;
    if (rangeDays > 60) {
      // year view: "Jan", "Feb", …
      return d.toLocaleString('en-AU', { month: 'short' });
    } else if (rangeDays > 1) {
      // multi-day: "Mon 9", "Tue 10", …
      return d.toLocaleString('en-AU', { weekday: 'short', day: 'numeric' });
    } else {
      // intraday: "14:30"
      return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
    }
  };

  const gradId = `grad-${Math.random().toString(36).slice(2)}`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block', overflow: 'visible' }}>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.18" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      {/* Grid lines */}
      {yTickVals.map((v, i) => (
        <line key={i} x1={PAD.left} x2={W - PAD.right} y1={y(v)} y2={y(v)}
          stroke="var(--line)" strokeWidth="1" />
      ))}
      {/* Area fill */}
      <path d={areaD} fill={`url(#${gradId})`} />
      {/* Line */}
      <path d={pathD} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
      {/* Y axis labels */}
      {yTickVals.map((v, i) => (
        <text key={i} x={PAD.left - 6} y={y(v) + 4} textAnchor="end"
          fontSize="10" fill="var(--ink-3)" fontFamily="'JetBrains Mono', monospace">
          {fmt(v)}
        </text>
      ))}
      {/* X axis labels */}
      {xTicks.map((t, i) => (
        <text key={i} x={x(t)} y={H - 6} textAnchor="middle"
          fontSize="10" fill="var(--ink-3)" fontFamily="'JetBrains Mono', monospace">
          {fmtTime(t)}
        </text>
      ))}
    </svg>
  );
}

// ── Detail page for a single reading ──────────────────────────────────────────
const QUICK_RANGES = [
  { label: '6h',  hours: 6 },
  { label: '24h', hours: 24 },
  { label: '7d',  hours: 24 * 7 },
  { label: '30d', hours: 24 * 30 },
];

function ReadingDetail({ def, stationId, onBack }) {
  const [history, setHistory] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState('range'); // 'range' | 'year'
  const [hours, setHours] = useState(24);
  const [years, setYears] = useState([]);
  const [selectedYear, setSelectedYear] = useState(null);

  // Load available years once
  useEffect(() => {
    fetch('/api/weather/years').then(r => r.json()).then(d => {
      const ys = d.years || [];
      setYears(ys);
      if (ys.length > 0 && !selectedYear) setSelectedYear(ys[0]);
    }).catch(() => {});
  }, []);

  const loadRange = (h, sid) => {
    const sq = sid ? `&station=${encodeURIComponent(sid)}` : '';
    const sq2 = sid ? `?station=${encodeURIComponent(sid)}` : '';
    setLoading(true);
    Promise.all([
      fetch(`/api/weather/history?hours=${h}${sq}`).then(r => r.json()).catch(() => ({ readings: [] })),
      fetch(`/api/weather/stats${sq2}`).then(r => r.json()).catch(() => ({ stats: {} })),
    ]).then(([hist, st]) => {
      setHistory(hist.readings || []);
      setStats(st.stats || {});
      setLoading(false);
    });
  };

  const loadYear = (yr, sid) => {
    const from = new Date(yr, 0, 1).getTime();
    const to   = new Date(yr + 1, 0, 1).getTime() - 1;
    const sq  = sid ? `&station=${encodeURIComponent(sid)}` : '';
    const sq2 = sid ? `&station=${encodeURIComponent(sid)}` : '';
    setLoading(true);
    Promise.all([
      fetch(`/api/weather/history?from=${from}&to=${to}${sq}`).then(r => r.json()).catch(() => ({ readings: [] })),
      fetch(`/api/weather/stats?from=${from}&to=${to}${sq2}`).then(r => r.json()).catch(() => ({ stats: {} })),
    ]).then(([hist, st]) => {
      setHistory(hist.readings || []);
      setStats(st.stats || {});
      setLoading(false);
    });
  };

  useEffect(() => {
    if (mode === 'range') loadRange(hours, stationId);
    else if (mode === 'year' && selectedYear) loadYear(selectedYear, stationId);

    // SSE — append new readings instantly when in live range mode
    if (mode !== 'range') return;
    const es = new EventSource('/api/weather/stream');
    es.onmessage = (e) => {
      try {
        const reading = JSON.parse(e.data);
        if (!stationId || (reading.station_id || 'default') === stationId) {
          setHistory(prev => [...prev, reading]);
        }
      } catch {}
    };
    return () => es.close();
  }, [mode, hours, selectedYear, stationId]);

  const points = history
    .filter(r => r.data && r.data[def.key] !== undefined)
    .map(r => ({ t: r.ts, v: r.data[def.key] }));

  const keyStat = stats && stats[def.key];
  const fmt = (v) => v === null || v === undefined ? '—' : (typeof v === 'number' ? (Math.abs(v) >= 10 ? v.toFixed(1) : v.toFixed(2)) : v);

  const avgPeriod = points.length ? (points.reduce((s, p) => s + p.v, 0) / points.length) : null;
  const minPeriod = points.length ? Math.min(...points.map(p => p.v)) : null;
  const maxPeriod = points.length ? Math.max(...points.map(p => p.v)) : null;
  const periodLabel = mode === 'year' ? `${selectedYear}` : QUICK_RANGES.find(r => r.hours === hours)?.label || `${hours}h`;

  return (
    <div>
      <div style={{ marginTop: 0, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12 }}>
        {[
          { label: `${periodLabel} Average`, value: fmt(avgPeriod), unit: def.unit },
          { label: `${periodLabel} Min`,     value: fmt(minPeriod), unit: def.unit },
          { label: `${periodLabel} Max`,     value: fmt(maxPeriod), unit: def.unit },
        ].map(s => (
          <div key={s.label} className="card" style={{ padding: '14px 16px' }}>
            <div className="eyebrow" style={{ marginBottom: 6 }}>{s.label}</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
              <span style={{ fontSize: 28, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace" }}>{s.value}</span>
              <span style={{ fontSize: 12, color: 'var(--ink-3)', fontFamily: "'JetBrains Mono', monospace" }}>{s.unit}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="card" style={{ marginTop: 20, padding: '20px 24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
          <div style={{ fontSize: 14, fontWeight: 600 }}>History — {def.label}</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            {QUICK_RANGES.map(r => (
              <button key={r.hours} className={`btn ${mode === 'range' && hours === r.hours ? 'btn-rust' : 'btn-ghost'}`}
                style={{ padding: '4px 10px', fontSize: 11 }}
                onClick={() => { setMode('range'); setHours(r.hours); }}>
                {r.label}
              </button>
            ))}
            {years.length > 0 && (
              <select
                className="select"
                style={{ padding: '4px 8px', fontSize: 11, width: 'auto', minWidth: 80 }}
                value={mode === 'year' ? selectedYear : ''}
                onChange={e => { if (e.target.value) { setMode('year'); setSelectedYear(parseInt(e.target.value, 10)); } }}
              >
                <option value="">Year…</option>
                {years.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            )}
          </div>
        </div>
        {loading ? (
          <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink-3)', fontSize: 13 }}>Loading…</div>
        ) : (
          <LineGraph
            points={points}
            color="var(--rust)"
            height={220}
            fromTs={mode === 'year' && selectedYear
              ? new Date(selectedYear, 0, 1).getTime()
              : Date.now() - hours * 3600000}
            toTs={mode === 'year' && selectedYear
              ? new Date(selectedYear + 1, 0, 1).getTime() - 1
              : Date.now()}
          />
        )}
      </div>

      {points.length > 0 && (
        <div className="card" style={{ marginTop: 16, padding: '20px 24px' }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Recent Readings</div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--line)' }}>
                  <th style={{ textAlign: 'left', padding: '6px 12px 6px 0', fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: '0.1em', color: 'var(--ink-3)', textTransform: 'uppercase' }}>Time</th>
                  <th style={{ textAlign: 'right', padding: '6px 0', fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: '0.1em', color: 'var(--ink-3)', textTransform: 'uppercase' }}>Value</th>
                </tr>
              </thead>
              <tbody>
                {[...points].reverse().slice(0, 50).map((p, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--line)' }}>
                    <td style={{ padding: '6px 12px 6px 0', fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: 'var(--ink-2)' }}>
                      {new Date(p.t).toLocaleString('en-AU', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td style={{ textAlign: 'right', padding: '6px 0', fontFamily: "'JetBrains Mono', monospace", fontWeight: 600 }}>
                      {fmt(p.v)} <span style={{ color: 'var(--ink-3)', fontWeight: 400 }}>{def.unit}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function StationStatus({ latest, rtcTime, stationId }) {
  const online = latest && (Date.now() - latest.ts < 120000);
  const sensorCount = latest ? Object.keys(latest.data || {}).length : 0;
  return (
    <div className="card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
      <div style={{
        width: 10, height: 10, borderRadius: '50%',
        background: online ? 'var(--eucalyptus)' : 'var(--rust)',
        boxShadow: online ? '0 0 8px rgba(79,107,62,0.5)' : 'none',
      }} />
      <span style={{ fontWeight: 600, fontSize: 14 }}>
        {stationId ? stationId : 'Station'} — {online ? 'Online' : 'Offline'}
      </span>
      {online && sensorCount > 0 && (
        <span className="tag" style={{ marginLeft: 4 }}>{sensorCount} readings</span>
      )}
      {rtcTime && (
        <span className="mono" style={{ fontSize: 11, color: 'var(--ink-3)', marginLeft: 'auto' }}>
          {rtcTime}
        </span>
      )}
    </div>
  );
}

// ── Site chrome (header + footer) ─────────────────────────────────────────────
// Ported verbatim from tools.jsx so this standalone page renders the EXACT same
// header and footer as every other page on outbackelectronics.com.au.

const ShopContext = createContext({});
const useShop = () => useContext(ShopContext);

let _PORTAL_URL = 'https://portal.outbackelectronics.com.au';
let _GAMES_URL  = 'https://games.outbackelectronics.com.au';
let _TOOLS_URL  = 'https://tools.outbackelectronics.com.au';
function getPortalUrl() { return _PORTAL_URL; }
function getGamesUrl()  { return _GAMES_URL; }
function getToolsUrl()  { return _TOOLS_URL; }

const PRIMARY_PAGES = [
  { id: 'home', label: 'Home' },
  { id: 'shop', label: 'Shop' },
  { id: 'services', label: 'Services' },
  { id: 'memberships', label: 'Memberships' },
  { id: 'software', label: 'Software' },
  { id: 'ewaste', label: 'eWaste' },
  { id: 'ai', label: 'AI' },
  { id: 'tutorials', label: 'Tutorials' },
  { id: 'tools-link', label: 'Tools' },
  { id: 'games-link', label: 'Games' },
  { id: 'groups', label: 'Groups' },
];
const EXTERNAL_LINKS = {
  'games-link': getGamesUrl,
  'tools-link': getToolsUrl,
};
const isExternalLink = (id) => Object.prototype.hasOwnProperty.call(EXTERNAL_LINKS, id);
const externalHref = (id) => EXTERNAL_LINKS[id] ? EXTERNAL_LINKS[id]() : null;
const UTILITY_PAGES = [
  { id: 'quote', label: 'Request a Quote' },
  { id: 'gift-cards', label: 'Gift Cards' },
  { id: 'sellers', label: 'Info for Sellers' },
  { id: 'sell-gear', label: 'Sell Your Gear' },
  { id: 'contact', label: 'Contact' },
  { id: 'policies', label: 'Policies' },
];

function getSiteRoot() {
  try {
    const u = new URL(window.location.href);
    if (u.hostname.startsWith('weather.')) u.hostname = u.hostname.slice('weather.'.length);
    else if (u.port === '8089') u.port = '8080';
    return u.origin + '/';
  } catch { return '/'; }
}

function go(id, params = null) {
  if (id === 'home') { window.location.href = getSiteRoot(); return; }
  if (isExternalLink(id)) { window.location.href = externalHref(id); return; }
  if (id === 'product' && params) { window.location.href = getSiteRoot() + 'product/' + (params.slug || params.id || ''); return; }
  if (id === 'service' && params) { window.location.href = getSiteRoot() + 'service/' + (params.slug || params.id || ''); return; }
  window.location.href = getSiteRoot() + id;
}

const { portalApi, usePortalUser } = makePortalHelpers(getPortalUrl);

function SearchOverlay({ onClose }) {
  const [q, setQ] = useState('');
  const [products, setProducts] = useState([]);
  const [highlightIdx, setHighlightIdx] = useState(0);
  const inputRef = useRef(null);
  const listRef = useRef(null);
  useEffect(() => { inputRef.current && inputRef.current.focus(); }, []);

  useEffect(() => {
    fetch('/api/catalog/products')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setProducts(d.items || []); })
      .catch(() => {});
  }, []);

  const allPages = [
    ...PRIMARY_PAGES.filter(p => !isExternalLink(p.id)),
    ...UTILITY_PAGES,
  ];

  const query = q.trim().toLowerCase();
  const pageResults = query.length < 1
    ? allPages.slice(0, 6)
    : allPages.filter(p => p.label.toLowerCase().includes(query));
  const productResults = query.length >= 2 ? products.filter(p =>
    (p.name || '').toLowerCase().includes(query) ||
    (p.brand || '').toLowerCase().includes(query) ||
    (p.sku || '').toLowerCase().includes(query) ||
    (p.category || '').toLowerCase().includes(query)
  ).slice(0, 6) : [];

  const allResults = [...pageResults, ...productResults.map(p => ({ ...p, _isProduct: true }))];

  useEffect(() => { setHighlightIdx(0); }, [q]);

  const pick = (item) => {
    if (item._isProduct) { go('product', item); onClose(); return; }
    if (isExternalLink(item.id)) { window.location.href = externalHref(item.id); return; }
    go(item.id);
    onClose();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') { onClose(); return; }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightIdx(i => Math.min(i + 1, allResults.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightIdx(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && allResults[highlightIdx]) {
      pick(allResults[highlightIdx]);
    }
  };

  return (
    <div className="search-backdrop" style={{position:'fixed', inset:0, zIndex:500, display:'flex', flexDirection:'column', alignItems:'center', paddingTop:80, background:'rgba(15,13,10,0.72)'}}
      onClick={onClose}>
      <div style={{width:'100%', maxWidth:560, background:'var(--bg)', border:'1px solid var(--line)', boxShadow:'0 12px 40px rgba(0,0,0,.35)'}}
        onClick={e => e.stopPropagation()}>
        <div style={{display:'flex', alignItems:'center', padding:'12px 16px', borderBottom:'1px solid var(--line)', gap:10}}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{flexShrink:0, color:'var(--ink-2)'}}><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>
          <input ref={inputRef} value={q} onChange={e => setQ(e.target.value)}
            placeholder="Search pages and products…" style={{flex:1, border:'none', outline:'none', background:'transparent', fontSize:15, color:'var(--ink)'}}
            onKeyDown={handleKeyDown} />
          <button onClick={onClose} style={{background:'none', border:'none', cursor:'pointer', color:'var(--ink-2)', fontSize:18, lineHeight:1}} aria-label="Close search">×</button>
        </div>
        <div ref={listRef} style={{maxHeight:420, overflowY:'auto'}}>
          {query.length === 0 && (
            <div style={{padding:'6px 20px 2px', fontSize:11, color:'var(--ink-3)', fontFamily:'monospace', letterSpacing:'0.08em'}}>QUICK LINKS</div>
          )}
          {query.length >= 2 && pageResults.length > 0 && (
            <div style={{padding:'6px 20px 2px', fontSize:11, color:'var(--ink-3)', fontFamily:'monospace', letterSpacing:'0.08em'}}>PAGES</div>
          )}
          {pageResults.map((p, idx) => {
            const isHighlighted = highlightIdx === idx;
            return (
              <div key={p.id} onClick={() => pick(p)}
                style={{padding:'12px 20px', cursor:'pointer', fontSize:14, borderBottom:'1px solid var(--line)', display:'flex', alignItems:'center', gap:10, background: isHighlighted ? 'var(--bg-elev)' : 'transparent'}}
                onMouseEnter={() => setHighlightIdx(idx)}
                onMouseLeave={() => setHighlightIdx(idx)}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{color:'var(--ink-3)'}}><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                {p.label}
              </div>
            );
          })}
          {productResults.length > 0 && (
            <div style={{padding:'6px 20px 2px', fontSize:11, color:'var(--ink-3)', fontFamily:'monospace', letterSpacing:'0.08em', borderTop: pageResults.length > 0 ? '1px solid var(--line)' : 'none'}}>PRODUCTS</div>
          )}
          {productResults.map((p, relIdx) => {
            const idx = pageResults.length + relIdx;
            const isHighlighted = highlightIdx === idx;
            return (
              <div key={p.id || p.sku} onClick={() => pick({...p, _isProduct: true})}
                style={{padding:'12px 20px', cursor:'pointer', fontSize:14, borderBottom:'1px solid var(--line)', display:'flex', alignItems:'center', gap:10, background: isHighlighted ? 'var(--bg-elev)' : 'transparent'}}
                onMouseEnter={() => setHighlightIdx(idx)}
                onMouseLeave={() => setHighlightIdx(idx)}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{color:'var(--rust)'}}><rect x="2" y="3" width="20" height="18" rx="2"/><path d="M16 3v4M8 3v4M2 11h20"/></svg>
                <div>
                  <div style={{fontWeight:500}}>{p.name}</div>
                  {(p.brand || p.category) && <div style={{fontSize:12, color:'var(--ink-2)', marginTop:2}}>{[p.brand, p.category].filter(Boolean).join(' · ')}</div>}
                </div>
                {p.price && <div style={{marginLeft:'auto', fontWeight:600, color:'var(--rust)', whiteSpace:'nowrap'}}>${Number(p.price).toLocaleString('en-AU')}</div>}
              </div>
            );
          })}
          {allResults.length === 0 && query.length > 0 && <div style={{padding:'16px 20px', color:'var(--ink-2)', fontSize:14}}>No results for "{q}".</div>}
          {query.length === 0 && (
            <div style={{padding:'10px 20px', fontSize:12, color:'var(--ink-3)', borderTop:'1px solid var(--line)'}}>
              Type to search products, or use ↑↓ arrows + Enter to navigate
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function AccountDropdown({ onClose, user }) {
  const ref = useRef(null);
  const portal = (path = '') => { window.location.href = getPortalUrl() + path; };
  const goPage = (id) => { go(id); onClose(); };
  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  const dropdownStyle = {position:'absolute', top:'calc(100% + 8px)', right:0, width:220, background:'var(--bg)', border:'1px solid var(--line)', boxShadow:'0 8px 24px rgba(0,0,0,.15)', zIndex:300};
  const btnStyle = (last) => ({width:'100%', textAlign:'left', padding:'12px 16px', cursor:'pointer', fontSize:14, border:'none', borderBottom: last ? 'none' : '1px solid var(--line)', background:'transparent', color:'var(--ink)'});
  const hoverOn = e => { e.currentTarget.style.background = 'var(--bg-elev)'; };
  const hoverOff = e => { e.currentTarget.style.background = 'transparent'; };

  if (!user) {
    return (
      <div ref={ref} style={dropdownStyle}>
        <div style={{padding:'16px 16px 12px', borderBottom:'1px solid var(--line)'}}>
          <div className="mono" style={{fontSize:10, color:'var(--ink-3)', marginBottom:6}}>ACCOUNT</div>
          <p style={{fontSize:13, color:'var(--ink-2)', lineHeight:1.5, margin:0}}>
            Sign in to track orders, book repairs, and access your account.
          </p>
        </div>
        <button style={{...btnStyle(false), fontWeight:600, color:'var(--rust)'}}
          onMouseEnter={hoverOn} onMouseLeave={hoverOff}
          onClick={() => { portal('/'); onClose(); }}>
          Sign In →
        </button>
        <button style={btnStyle(true)}
          onMouseEnter={hoverOn} onMouseLeave={hoverOff}
          onClick={() => { portal('/?tab=register'); onClose(); }}>
          Create an Account
        </button>
      </div>
    );
  }

  return (
    <div ref={ref} style={dropdownStyle}>
      {user.displayName && (
        <div style={{padding:'12px 16px', borderBottom:'1px solid var(--line)'}}>
          <div className="mono" style={{fontSize:10, color:'var(--ink-3)'}}>SIGNED IN AS</div>
          <div style={{fontSize:14, marginTop:3, fontWeight:600, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{user.displayName}</div>
        </div>
      )}
      {[
        { label:'Profile',           action: () => portal('/#account') },
        { label:'My Subscriptions',  action: () => portal('/#memberships') },
        { label:'My Rewards',        action: () => portal('/#rewards') },
        { label:'My Wallet',         action: () => portal('/#wallet') },
        { label:'My Groups',         action: () => { go('groups'); onClose(); } },
        { label:'My Orders',         action: () => portal('/orders') },
        { label:'My Addresses',      action: () => portal('/addresses') },
        { label:'My Bookings',       action: () => portal('/bookings') },
        { label:'My Account',        action: () => portal('/account') },
        { label:'Log Out',           action: () => { portalApi('/api/portal/auth/logout', { method: 'POST' }).then(() => window.location.reload()); onClose(); } },
      ].map((item, i, arr) => (
        <button key={item.label} onClick={() => { item.action(); onClose(); }}
          style={btnStyle(i === arr.length - 1)}
          onMouseEnter={hoverOn} onMouseLeave={hoverOff}>
          {item.label}
        </button>
      ))}
    </div>
  );
}

function Logo({ onClick }) {
  return (
    <div className="logo" onClick={onClick}>
      <div className="logo-mark">
        <img src="assets/logo.webp" alt="Outback Electronics" width="55" height="40" />
      </div>
      <div className="logo-text">
        <div className="sub">Est. 2023 · Appointment only</div>
      </div>
    </div>
  );
}

function UtilityBar() {
  const shop = useShop();
  return (
    <div className="utility-bar">
      <div className="container">
        <div className="links">
          <span>FREE FREIGHT OVER $200 · OUTBACK NT/SA/WA</span>
        </div>
        <div className="links">
          {UTILITY_PAGES.map(p => (
            <a key={p.id} href={getSiteRoot() + p.id} onClick={(e) => { e.preventDefault(); go(p.id); }}>{p.label}</a>
          ))}
          {shop.phone && <span style={{color:'var(--ochre)'}}>{shop.phone}</span>}
        </div>
      </div>
    </div>
  );
}

function useAnnouncement() {
  const [text, setText] = useState('');
  useEffect(() => {
    fetch('/api/announcement')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d && d.active && d.text) setText(d.text); })
      .catch(() => {});
  }, []);
  return text;
}

function useCartCount() {
  const [count, setCount] = useState(0);
  useEffect(() => {
    const read = () => {
      try {
        const cart = JSON.parse(localStorage.getItem('oe_cart') || '[]');
        setCount(Array.isArray(cart) ? cart.reduce((s, i) => s + (i.qty || 0), 0) : 0);
      } catch { setCount(0); }
    };
    read();
    window.addEventListener('storage', read);
    return () => window.removeEventListener('storage', read);
  }, []);
  return count;
}

function TopNav({ page, onSearchOpen, accountOpen, setAccountOpen, portalUser, cart }) {
  const announcement = useAnnouncement();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const signedOut = portalUser === null;
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const handleNavClick = (id) => {
    setMobileMenuOpen(false);
    if (isExternalLink(id)) window.location.href = externalHref(id);
    else go(id);
  };

  return (
    <header>
      {announcement && <div className="announce">{announcement}</div>}
      <UtilityBar />
      <div className={scrolled ? 'topnav scrolled' : 'topnav'}>
        <div className="container row">
          <Logo onClick={() => go('home')} />
          <nav className="mainlinks">
            {PRIMARY_PAGES.map(p => (
              <a
                key={p.id}
                href={isExternalLink(p.id) ? externalHref(p.id) : getSiteRoot() + p.id}
                className={page === p.id ? 'active' : ''}
                onClick={isExternalLink(p.id) ? undefined : (e) => { e.preventDefault(); go(p.id); }}
                {...((p.id === 'forum-link' || p.id === 'games-link') ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
              >
                {p.label}
              </a>
            ))}
          </nav>
          <div className="topnav-actions">
            <button className="icon-btn" title="Search" aria-label="Search" onClick={onSearchOpen}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>
            </button>
            <div style={{position:'relative'}}>
              <button
                className="icon-btn"
                title={signedOut ? 'Sign In / Create Account' : 'Account'}
                aria-label={signedOut ? 'Sign In / Create Account' : 'Account'}
                onClick={() => setAccountOpen(o => !o)}
                style={signedOut ? {color:'var(--rust)', borderColor:'var(--rust)'} : {}}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-7 8-7s8 3 8 7"/></svg>
              </button>
              {accountOpen && <AccountDropdown onClose={() => setAccountOpen(false)} user={portalUser} />}
            </div>
            <button className="icon-btn" title="Cart" aria-label={cart > 0 ? `Cart, ${cart} item${cart === 1 ? '' : 's'}` : 'Cart'} onClick={() => go('cart')}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M3 4h2l2.5 12h11l2-9H6"/><circle cx="9" cy="20" r="1.5"/><circle cx="18" cy="20" r="1.5"/></svg>
              {cart > 0 && <span className="cart-count" aria-hidden="true">{cart}</span>}
            </button>
            <button className="icon-btn hamburger" style={{display:'none'}} title="Menu" aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'} aria-expanded={mobileMenuOpen} aria-controls="mobile-nav" onClick={() => setMobileMenuOpen(o => !o)}>
              {mobileMenuOpen
                ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
                : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 12h18M3 6h18M3 18h18"/></svg>
              }
            </button>
          </div>
        </div>
      </div>
      {mobileMenuOpen && (
        <div id="mobile-nav" className="mobile-nav" role="dialog" aria-modal="true" aria-label="Navigation menu">
          <div className="mobile-nav-header">
            <Logo onClick={() => { go('home'); setMobileMenuOpen(false); }} />
            <button className="icon-btn" aria-label="Close menu" onClick={() => setMobileMenuOpen(false)}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
            </button>
          </div>
          {PRIMARY_PAGES.map(p => (
            <a key={p.id}
              href={isExternalLink(p.id) ? externalHref(p.id) : getSiteRoot() + p.id}
              className={page === p.id ? 'active' : ''}
              onClick={isExternalLink(p.id) ? undefined : (e) => { e.preventDefault(); handleNavClick(p.id); }}
              {...((p.id === 'forum-link' || p.id === 'games-link') ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
              {p.label}
            </a>
          ))}
          <div style={{borderTop:'2px solid var(--line)', marginTop:8}}>
            {UTILITY_PAGES.map(p => (
              <a key={p.id} href={getSiteRoot() + p.id} className={page === p.id ? 'active' : ''}
                onClick={(e) => { e.preventDefault(); handleNavClick(p.id); }}
                style={{fontSize:14, color:'var(--ink-2)'}}>
                {p.label}
              </a>
            ))}
          </div>
        </div>
      )}
    </header>
  );
}

function Footer() {
  const shop = useShop();
  const [topCategories, setTopCategories] = useState([]);
  const [footerServices, setFooterServices] = useState([]);

  useEffect(() => {
    fetch('/api/catalog/products')
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(d => {
        const counts = {};
        (d.items || []).forEach(p => {
          if (p.status === 'published' && p.category) {
            counts[p.category] = (counts[p.category] || 0) + 1;
          }
        });
        const sorted = Object.entries(counts)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 5)
          .map(([cat]) => cat);
        setTopCategories(sorted);
      })
      .catch(() => {});

    fetch('/api/catalog/services')
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(d => {
        setFooterServices((d.items || []).slice(0, 5));
      })
      .catch(() => {});
  }, []);

  return (
    <footer>
      <div className="container">
        <div className="grid">
          <div>
            <div className="logo">
              <div className="logo-mark sm" style={{background:'#000'}}>
                <img src="assets/logo.webp" alt="Outback Electronics" width="40" height="29" />
              </div>
              <div className="logo-text">
                <div className="sub" style={{color:'var(--ochre)'}}>{shop.tagline}</div>
              </div>
            </div>
            <p style={{marginTop: 18, fontSize: 13, color: 'var(--ink-on-dark-muted)', maxWidth: 360, lineHeight: 1.6}}>
              {shop.description}
            </p>
          </div>
          <div>
            <h3>Shop</h3>
            <ul>
              {topCategories.map((cat) => (
                <li key={cat}><a href="/shop" onClick={(e) => { e.preventDefault(); go('shop', { initialCat: cat }); }}>{cat}</a></li>
              ))}
            </ul>
          </div>
          <div>
            <h3>Services</h3>
            <ul>
              {footerServices.map((svc) => (
                <li key={svc.id}><a href={`/service/${svc.slug || svc.id}`} onClick={(e) => { e.preventDefault(); go('service', svc); }}>{svc.name}</a></li>
              ))}
            </ul>
          </div>
          <div>
            <h3>Community</h3>
            <ul>
              <li><a href="/tutorials" onClick={(e) => { e.preventDefault(); go('tutorials'); }}>Tutorials</a></li>
              <li><a href="/groups" onClick={(e) => { e.preventDefault(); go('groups'); }}>Groups</a></li>
              <li><a href="/memberships" onClick={(e) => { e.preventDefault(); go('memberships'); }}>Memberships</a></li>
              <li><a href="/sellers" onClick={(e) => { e.preventDefault(); go('sellers'); }}>Info for Sellers</a></li>
              <li><a href="/sell-gear" onClick={(e) => { e.preventDefault(); go('sell-gear'); }}>Sell Your Gear</a></li>
            </ul>
          </div>
          <div>
            <h3>Visit</h3>
            <ul style={{color:'var(--ink-on-dark-muted)'}}>
              <li>{[shop.suburb, shop.state, shop.postcode].filter(Boolean).join(' ')}<br/>No public access, arrive by appointment only.</li>
              {shop.phone && <li>{shop.phone}</li>}
              <li><a href="/contact" onClick={(e) => { e.preventDefault(); go('contact'); }} style={{color:'var(--ochre)'}}>Get directions →</a></li>
            </ul>
          </div>
        </div>
        <div className="baseline">
          <span>© 2023–2026 {shop.tradingName}{shop.abn ? ` · ABN ${shop.abn}` : ''}</span>
          {(shop.acknowledgmentPeople || shop.acknowledgmentCountry) && <span>ACKNOWLEDGES THE {(shop.acknowledgmentPeople || '').toUpperCase()} AS TRADITIONAL CUSTODIANS OF {(shop.acknowledgmentCountry || '').toUpperCase()}</span>}
        </div>
      </div>
    </footer>
  );
}

function useShopInfo() {
  const [info, setInfo] = useState({ shop: {} });
  useEffect(() => {
    fetch('/api/shop-info')
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (!d) return;
        if (d.portalUrl) _PORTAL_URL = d.portalUrl;
        if (d.gamesUrl)  _GAMES_URL  = d.gamesUrl;
        if (d.toolsUrl)  _TOOLS_URL  = d.toolsUrl;
        setInfo({ shop: d.shop || {} });
      })
      .catch(() => {});
  }, []);
  return info;
}

// ── App ───────────────────────────────────────────────────────────────────────

// ── Add Sensor modal ──────────────────────────────────────────────────────────
function AddSensorModal({ onClose }) {
  const [step, setStep] = useState('form'); // 'form' | 'done'
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [contact, setContact] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  const submit = async () => {
    const n = name.trim();
    if (!n) { setError('Station name is required.'); return; }
    setBusy(true); setError('');
    try {
      const r = await fetch('/api/weather/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: n, location: location.trim(), contact: contact.trim() }),
      });
      const d = await r.json();
      if (!r.ok) {
        setError(d.error === 'name_taken' ? 'That station name is already taken — choose another.' : 'Registration failed, please try again.');
        setBusy(false); return;
      }
      setResult(d);
      setStep('done');
    } catch { setError('Network error, please try again.'); }
    setBusy(false);
  };

  const setupCmd = result
    ? `WEATHER_API_KEY="${result.apiKey}" WEATHER_URL="${result.weatherUrl}" python3 weather-station/weather_station.py`
    : '';

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 400, background: 'rgba(15,13,10,0.72)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
      onClick={onClose}>
      <div style={{ width: '100%', maxWidth: 540, background: 'var(--bg)', border: '1px solid var(--line)', boxShadow: '0 12px 40px rgba(0,0,0,.35)', maxHeight: '90vh', overflowY: 'auto' }}
        onClick={e => e.stopPropagation()}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: 20, fontFamily: "'Instrument Serif', serif", fontWeight: 400 }}>
            {step === 'form' ? 'Add a Weather Sensor' : 'Sensor Registered'}
          </h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: 'var(--ink-2)', lineHeight: 1 }}>×</button>
        </div>

        {step === 'form' && (
          <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <p style={{ fontSize: 14, color: 'var(--ink-2)', lineHeight: 1.6, margin: 0 }}>
              Anyone can add a sensor to this network. Give your station a name, run the script on a Raspberry Pi, and your readings will appear live on this dashboard.
            </p>
            <label className="field" style={{ marginBottom: 0 }}>
              <span className="label">Station Name *</span>
              <input className="input" value={name} onChange={e => setName(e.target.value)}
                placeholder="e.g. My Back Yard, Roof, Workshop" maxLength={64} />
            </label>
            <label className="field" style={{ marginBottom: 0 }}>
              <span className="label">Location (optional)</span>
              <input className="input" value={location} onChange={e => setLocation(e.target.value)}
                placeholder="e.g. Alice Springs NT, Australia" maxLength={128} />
            </label>
            <label className="field" style={{ marginBottom: 0 }}>
              <span className="label">Contact / name (optional)</span>
              <input className="input" value={contact} onChange={e => setContact(e.target.value)}
                placeholder="e.g. your name or email" maxLength={128} />
            </label>
            {error && <div style={{ fontSize: 13, color: 'var(--rust)', padding: '10px 12px', background: '#f3d5c5', border: '1px solid #e8b898' }}>{error}</div>}
            <button className="btn btn-rust" onClick={submit} disabled={busy} style={{ alignSelf: 'flex-start' }}>
              {busy ? 'Registering…' : 'Register Station →'}
            </button>
          </div>
        )}

        {step === 'done' && result && (
          <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ padding: '12px 16px', background: 'rgba(79,107,62,0.1)', border: '1px solid var(--eucalyptus)', fontSize: 14, color: 'var(--eucalyptus)', fontWeight: 600 }}>
              Station "{result.name}" registered successfully.
            </div>
            <p style={{ fontSize: 14, color: 'var(--ink-2)', lineHeight: 1.6, margin: 0 }}>
              Save your API key — it won't be shown again. Then run the command below on your Raspberry Pi (or any Linux machine with Python 3).
            </p>

            <div>
              <div className="eyebrow" style={{ marginBottom: 6 }}>Your API Key</div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'stretch' }}>
                <code style={{ flex: 1, padding: '10px 12px', background: 'var(--bg-deep)', border: '1px solid var(--line-strong)', fontSize: 12, fontFamily: "'JetBrains Mono', monospace", wordBreak: 'break-all' }}>
                  {result.apiKey}
                </code>
                <button className="btn btn-ghost" style={{ padding: '10px 14px', fontSize: 12, flexShrink: 0 }}
                  onClick={() => navigator.clipboard.writeText(result.apiKey)}>Copy</button>
              </div>
            </div>

            <div>
              <div className="eyebrow" style={{ marginBottom: 6 }}>Setup — Raspberry Pi / Linux</div>
              <p style={{ fontSize: 13, color: 'var(--ink-2)', marginBottom: 8, lineHeight: 1.5 }}>
                Download <code style={{ fontFamily: 'monospace', fontSize: 12 }}>weather-station/weather_station.py</code> from the{' '}
                <a href="https://github.com/outbackwebsitedesign/outbackelectronics" style={{ color: 'var(--rust)' }} target="_blank" rel="noopener noreferrer">GitHub repo</a>,
                then run:
              </p>
              <div style={{ position: 'relative' }}>
                <pre style={{ margin: 0, padding: '12px 16px', background: '#181410', color: '#f4ede1', fontFamily: "'JetBrains Mono', monospace", fontSize: 11, overflowX: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-all', border: '1px solid #2a241c' }}>
                  {setupCmd}
                </pre>
                <button className="btn btn-ghost" style={{ position: 'absolute', top: 8, right: 8, padding: '4px 10px', fontSize: 11 }}
                  onClick={() => navigator.clipboard.writeText(setupCmd)}>Copy</button>
              </div>
            </div>

            <p style={{ fontSize: 13, color: 'var(--ink-3)', margin: 0, lineHeight: 1.5 }}>
              Once running, your station will appear on the dashboard within 30 seconds. Supported sensors: BME280/680 (temp, humidity, pressure, VOC), MQ series gas sensors, QMC5883L compass, and more — see the script header for the full list.
            </p>

            <button className="btn btn-rust" onClick={onClose} style={{ alignSelf: 'flex-start' }}>Done</button>
          </div>
        )}
      </div>
    </div>
  );
}

function WeatherDashboard() {
  const [latest, setLatest] = useState(null);
  const [history, setHistory] = useState([]);
  const [stations, setStations] = useState([]);
  const [activeStation, setActiveStation] = useState(null);
  const [error, setError] = useState(null);
  const [tick, setTick] = useState(0);
  const [detailKey, setDetailKey] = useState(null);
  const [addSensorOpen, setAddSensorOpen] = useState(false);
  const fetchStations = () => {
    fetch('/api/weather/stations')
      .then(r => r.json())
      .then(d => { if (d.stations) setStations(d.stations); })
      .catch(() => {});
  };

  const fetchHistory = (stationId) => {
    const q = stationId ? `&station=${encodeURIComponent(stationId)}` : '';
    fetch(`/api/weather/history?hours=24${q}`)
      .then(r => r.json())
      .then(d => { if (d.readings) setHistory(d.readings); })
      .catch(() => {});
  };

  useEffect(() => {
    fetchStations();
    fetchHistory(activeStation);

    // Fetch the latest reading immediately so the page isn't blank on first load
    const q = activeStation ? `?station=${encodeURIComponent(activeStation)}` : '';
    fetch(`/api/weather/latest${q}`)
      .then(r => r.json())
      .then(d => { if (d.reading) { setLatest(d.reading); setError(null); } })
      .catch(() => setError('Could not reach weather station API'));

    // SSE — receive new readings the instant the RPi pushes them
    const es = new EventSource('/api/weather/stream');
    es.onmessage = (e) => {
      try {
        const reading = JSON.parse(e.data);
        if (!activeStation || (reading.station_id || 'default') === activeStation) {
          setLatest(reading);
          setError(null);
          setHistory(prev => [...prev, reading]);
        }
        setStations(prev => {
          const sid = reading.station_id || 'default';
          const exists = prev.find(s => s.id === sid);
          if (exists) return prev.map(s => s.id === sid ? { ...s, last_seen: reading.ts } : s);
          return [...prev, { id: sid, last_seen: reading.ts }];
        });
      } catch {}
    };
    es.onerror = () => setError('Could not reach weather station API');
    return () => es.close();
  }, [activeStation]);

  useEffect(() => {
    const t = setInterval(() => setTick(n => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const data = latest?.data || {};
  const rtcTime = latest?.rtc_time || null;

  const hasAnyData = Object.keys(data).length > 0;
  const visibleGroups = GROUPS.filter(g =>
    !hasAnyData || READINGS.some(r => r.group === g.key && data[r.key] !== undefined)
  );

  const detailDef = detailKey
    ? (READINGS.find(r => r.key === detailKey) || {
        key: detailKey,
        label: detailKey.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
        unit: '',
        group: 'custom',
      })
    : null;

  if (detailDef) {
    return (
      <>
        <div className="page-head">
          <div className="container">
            <div className="crumbs eyebrow">
              <span onClick={() => setDetailKey(null)} style={{ cursor: 'pointer' }}>Outback</span>
              <span style={{ color: 'var(--ink-3)' }}>/</span>
              <span onClick={() => setDetailKey(null)} style={{ cursor: 'pointer' }}>Weather Station</span>
              <span style={{ color: 'var(--ink-3)' }}>/</span>
              <span>{detailDef.label}</span>
            </div>
            <h1>{detailDef.label}</h1>
            <p className="lead">{detailDef.unit}{detailDef.note ? ` · ${detailDef.note}` : ''}</p>
          </div>
        </div>
        <div className="container" style={{ flex: 1, paddingTop: 32, paddingBottom: 48 }}>
          <ReadingDetail def={detailDef} stationId={activeStation} onBack={() => setDetailKey(null)} />
        </div>
      </>
    );
  }

  return (
    <>
      <div className="page-head">
        <div className="container">
          <div className="crumbs eyebrow">
            <span>Outback</span>
            <span style={{ color: 'var(--ink-3)' }}>/</span>
            <span>Weather Station</span>
          </div>
          <h1>Weather Station</h1>
          <p className="lead">
            Real-time environmental data — temperature, humidity, pressure, air quality, and gas detection.
          </p>
        </div>
      </div>

      <div className="container" style={{ flex: 1, paddingTop: 32, paddingBottom: 48 }}>
        {stations.length > 1 && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
            <button className={`btn ${!activeStation ? 'btn-rust' : 'btn-ghost'}`} style={{ padding: '6px 12px', fontSize: 12 }}
              onClick={() => setActiveStation(null)}>All Stations</button>
            {stations.map(s => (
              <button key={s.id} className={`btn ${activeStation === s.id ? 'btn-rust' : 'btn-ghost'}`}
                style={{ padding: '6px 12px', fontSize: 12 }}
                onClick={() => setActiveStation(s.id)}>{s.id}</button>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <StationStatus latest={latest} rtcTime={rtcTime} stationId={latest?.station_id} />
          </div>
          <button className="btn btn-rust" style={{ whiteSpace: 'nowrap', flexShrink: 0 }}
            onClick={() => setAddSensorOpen(true)}>
            + Add Sensor
          </button>
        </div>
        {addSensorOpen && <AddSensorModal onClose={() => setAddSensorOpen(false)} />}

        {error && (
          <div style={{ marginTop: 16, padding: '12px 16px', background: '#f3d5c5', border: '1px solid #e8b898', color: '#7a3a18', fontSize: 13 }}>
            {error}
          </div>
        )}

        <div style={{ marginTop: 32 }}>
          {visibleGroups.map(g => {
            const groupReadings = READINGS.filter(r => r.group === g.key);
            const visible = hasAnyData ? groupReadings.filter(r => data[r.key] !== undefined) : groupReadings;
            if (visible.length === 0) return null;
            return (
              <div key={g.key} style={{ marginBottom: 32 }}>
                <h2 style={{ fontSize: 18, marginBottom: 16 }}>{g.label}</h2>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16 }}>
                  {visible.map(def => (
                    <ReadingCard key={def.key} def={def} value={data[def.key] ?? null} ts={latest?.ts}
                      onClick={() => setDetailKey(def.key)} />
                  ))}
                </div>
              </div>
            );
          })}

          {/* Custom / unknown sensor keys not in the built-in READINGS list */}
          {(() => {
            const knownKeys = new Set(READINGS.map(r => r.key));
            const extraKeys = Object.keys(data).filter(k => !knownKeys.has(k));
            if (extraKeys.length === 0) return null;
            return (
              <div style={{ marginBottom: 32 }}>
                <h2 style={{ fontSize: 18, marginBottom: 16 }}>Custom Sensors</h2>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16 }}>
                  {extraKeys.map(k => {
                    const label = k.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
                    const def = { key: k, label, unit: '', group: 'custom' };
                    return (
                      <ReadingCard key={k} def={def} value={data[k] ?? null} ts={latest?.ts}
                        onClick={() => setDetailKey(k)} />
                    );
                  })}
                </div>
              </div>
            );
          })()}
        </div>
      </div>
    </>
  );
}

export default function WeatherApp() {
  const { shop } = useShopInfo();
  const [searchOpen, setSearchOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [portalUser] = usePortalUser();
  const cart = useCartCount();

  return (
    <ShopContext.Provider value={shop}>
      {searchOpen && <SearchOverlay onClose={() => setSearchOpen(false)} />}
      <TopNav page={null} cart={cart} onSearchOpen={() => setSearchOpen(true)} accountOpen={accountOpen} setAccountOpen={setAccountOpen} portalUser={portalUser} />
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <WeatherDashboard />
        <Footer />
      </div>
    </ShopContext.Provider>
  );
}
