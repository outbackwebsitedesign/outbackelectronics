import React, { useState, useEffect, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import { getCsrf, ensureCsrf } from './src/lib/api.js';
import { renderMarkdown, estimateReadTime, slugify } from './markdown.jsx';
import { PRODUCT_CONDITIONS } from './src/lib/conditions.js';
import { PC_PART_CATEGORIES, PC_CATEGORY_MAP, PART_COLOURS, categoryLabel, partDisplayName, checkBuild, buildTotals, compatibilityFilter } from './pc-compat.js';

// ── Shared helpers ────────────────────────────────────────────────────────────
// Canonical date format for all order dates: "27 May 2026"
function fmtOrderDate(raw) {
  if (!raw) return '';
  // Already in "27 May 2026" form
  const d = new Date(raw);
  if (isNaN(d)) {
    // Try parsing "27/05/2026" or "27/5/2026"
    const parts = String(raw).split('/');
    if (parts.length === 3) {
      const parsed = new Date(`${parts[2]}-${parts[1].padStart(2,'0')}-${parts[0].padStart(2,'0')}`);
      if (!isNaN(parsed)) return parsed.toLocaleDateString('en-AU', { day:'2-digit', month:'short', year:'numeric' });
    }
    return String(raw); // leave as-is if unparseable
  }
  return d.toLocaleDateString('en-AU', { day:'2-digit', month:'short', year:'numeric' });
}
function todayOrderDate() {
  return new Date().toLocaleDateString('en-AU', { day:'2-digit', month:'short', year:'numeric' });
}
function todayISODate() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
// Converts a yyyy-mm-dd (from an <input type="date">) to the "DD Mon YYYY" format used for logged payments.
function orderDateFromISO(iso) {
  if (!iso) return todayOrderDate();
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-AU', { day:'2-digit', month:'short', year:'numeric' });
}
// Converts an order date (any of the formats fmtOrderDate accepts) to yyyy-mm-dd for an <input type="date">.
function isoFromOrderDate(raw) {
  if (!raw) return '';
  let d = new Date(raw);
  if (isNaN(d)) {
    const parts = String(raw).split('/');
    if (parts.length === 3) d = new Date(`${parts[2]}-${parts[1].padStart(2,'0')}-${parts[0].padStart(2,'0')}`);
  }
  if (isNaN(d)) return '';
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
// Converts "DD/MM/YYYY" (the expense date storage format) to yyyy-mm-dd for an <input type="date">.
function auDateToISO(au) {
  if (!au) return '';
  const [d, m, y] = au.split('/');
  if (!d || !m || !y) return '';
  return `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`;
}
// Converts yyyy-mm-dd (from an <input type="date">) back to "DD/MM/YYYY" for storing an expense date.
function isoToAuDate(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}
// Australian cash rounding: round to nearest 5 cents
function cashRound(amount) {
  return Math.round(amount * 20) / 20;
}

function postHeaders() { return { 'Content-Type': 'application/json', 'X-CSRF-Token': getCsrf() }; }

// Persistent polite live region so screen readers announce toasts.
function ensureToastRegion() {
  let region = document.getElementById('admin-toast-region');
  if (!region) {
    region = document.createElement('div');
    region.id = 'admin-toast-region';
    region.setAttribute('role', 'status');
    region.setAttribute('aria-live', 'polite');
    Object.assign(region.style, {
      position: 'fixed', bottom: '24px', left: '50%', transform: 'translateX(-50%)',
      zIndex: '99999', pointerEvents: 'none', display: 'grid', gap: '8px', justifyItems: 'center',
    });
    document.body.appendChild(region);
  }
  return region;
}

function adminToast(msg, type = 'error') {
  const region = ensureToastRegion();
  const el = document.createElement('div');
  el.textContent = msg;
  Object.assign(el.style, {
    background: type === 'error' ? 'var(--rust, #c0392b)' : '#345526',
    color: '#fff', padding: '10px 20px', borderRadius: '4px',
    fontSize: '13px', pointerEvents: 'none',
    boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
  });
  region.appendChild(el);
  setTimeout(() => el.remove(), 4000);
}

// ── Validation helpers (client-side; server remains authoritative) ───────────
const isValidEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(v || '').trim());
const isValidPhone = (v) => /^[\d\s()+\-.]{6,20}$/.test(String(v || '').trim());
// Strip minus signs from numeric text inputs so prices/amounts can't go negative.
const nonNegInput = (v) => (typeof v === 'string' ? v.replace(/-/g, '') : v);

// Marks a required field label; pair with aria-required on the input.
const ReqMark = () => <span className="admin-req" aria-hidden="true"></span>;

// ── Icon system ────────────────────────────────────────────────────────────
// Every small in-UI icon renders through this one component so its size never
// depends on emoji/glyph metrics, which vary unpredictably by OS and browser.
const ICON_PATHS = {
  chevronLeft: <polyline points="15 18 9 12 15 6"/>,
  chevronRight: <polyline points="9 18 15 12 9 6"/>,
  chevronUp: <polyline points="18 15 12 9 6 15"/>,
  chevronDown: <polyline points="6 9 12 15 18 9"/>,
  chevronsUpDown: <><polyline points="7 14.5 12 19.5 17 14.5"/><polyline points="7 9.5 12 4.5 17 9.5"/></>,
  externalLink: <><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></>,
  download: <><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></>,
  camera: <><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></>,
  copy: <><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></>,
  trash: <><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/></>,
  pencil: <path d="M17 3a2.85 2.85 0 114 4L7.5 20.5 2 22l1.5-5.5z"/>,
  alertTriangle: <><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></>,
  dot: <circle cx="12" cy="12" r="7" fill="currentColor" stroke="none"/>,
  x: <><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></>,
  check: <polyline points="20 6 9 17 4 12"/>,
  circleEmpty: <circle cx="12" cy="12" r="9"/>,
  halfCircle: <><path d="M12 3a9 9 0 000 18z" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="9"/></>,
  quarterCircle: <><path d="M12 3a9 9 0 019 9h-9z" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="9"/></>,
  hammer: <><path d="M14.5 3.5l6 6-2.5 2.5-6-6z"/><path d="M2 22l7-7"/><path d="M12 12L7 7l-3 3 5 5z"/></>,
  diamond: <polygon points="12 2 22 12 12 22 2 12"/>,
  square: <rect x="4" y="4" width="16" height="16" rx="1"/>,
  undo: <><polyline points="9 14 4 9 9 4"/><path d="M20 20v-7a4 4 0 00-4-4H4"/></>,
  star: <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>,
  mail: <><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M22 6l-10 7L2 6"/></>,
  refresh: <><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0114.36-3.36L23 10M1 14l5.14 4.36A9 9 0 0020.49 15"/></>,
  printer: <><path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></>,
  minus: <line x1="5" y1="12" x2="19" y2="12"/>,
};
function Icon({ name, size = 12, strokeWidth = 2, style, className }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth}
      strokeLinecap="round" strokeLinejoin="round" style={style} className={className} aria-hidden="true">
      {ICON_PATHS[name]}
    </svg>
  );
}

// ── Overlay / dirty-drawer registries (module-level singletons) ──────────────
// Overlays (confirm dialogs, shortcut help) stack above drawers; while one is
// open the Drawer must not react to Escape/Tab.
let adminOverlayCount = 0;
const pushAdminOverlay = () => { adminOverlayCount++; };
const popAdminOverlay = () => { adminOverlayCount = Math.max(0, adminOverlayCount - 1); };
const hasAdminOverlay = () => adminOverlayCount > 0;
// Open drawers with unsaved changes register here so sidebar navigation can warn.
let adminDirtyDrawers = 0;
const hasDirtyDrawer = () => adminDirtyDrawers > 0;

// Tracks whether `value` has changed since `resetKey` last changed.
function useDirtyTracker(value, resetKey) {
  const snap = JSON.stringify(value ?? null);
  const baseRef = React.useRef(snap);
  const keyRef = React.useRef(resetKey);
  if (keyRef.current !== resetKey) { keyRef.current = resetKey; baseRef.current = snap; }
  return snap !== baseRef.current;
}

// ── Deep-link URL state ──────────────────────────────────────────────────────
// The admin section lives in the path (`/orders`, `/quotes`, …). Finer state
// which tab is active, which record is open - rides in the query string so a
// reload lands on the exact same spot. Helpers below read/write that query
// string without disturbing the path (which AdminPage owns).
const readAdminQuery = () => new URLSearchParams(window.location.search);
function writeAdminUrl(mutate, { push = false } = {}) {
  const params = readAdminQuery();
  mutate(params);
  const qs = params.toString();
  const url = window.location.pathname + (qs ? '?' + qs : '') + window.location.hash;
  if (push) window.history.pushState({}, '', url);
  else window.history.replaceState({}, '', url);
}
// Two-way binding between a piece of component state and a single query param.
// `push:false` (default) rewrites history in place, right for tab switches.
// `push:true` adds a history entry, right for opening a record, so Back closes
// it. Popstate (Back/Forward) flows the URL value back into state.
function useUrlState(key, defaultVal = null, { push = false } = {}) {
  const [val, setVal] = useState(() => readAdminQuery().get(key) ?? defaultVal);
  const valRef = React.useRef(val);
  valRef.current = val;
  const set = React.useCallback((next) => {
    const resolved = typeof next === 'function' ? next(valRef.current) : next;
    if (resolved === valRef.current) return;
    valRef.current = resolved;
    writeAdminUrl(p => {
      if (resolved == null || resolved === '' || resolved === defaultVal) p.delete(key);
      else p.set(key, String(resolved));
    }, { push });
    setVal(resolved);
  }, [key, defaultVal, push]);
  useEffect(() => {
    const onPop = () => { const v = readAdminQuery().get(key) ?? defaultVal; valRef.current = v; setVal(v); };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [key, defaultVal]);
  return [val, set];
}
// Guards against losing unsaved edits on a full-page reload / tab close, and
// registers with the same counter the sidebar checks before navigating away.
// Drawer wires this internally; use it directly for non-Drawer edit surfaces.
function useUnsavedGuard(dirty) {
  useEffect(() => {
    if (!dirty) return;
    adminDirtyDrawers++;
    const onBeforeUnload = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => {
      adminDirtyDrawers = Math.max(0, adminDirtyDrawers - 1);
      window.removeEventListener('beforeunload', onBeforeUnload);
    };
  }, [dirty]);
}

// ── ConfirmModal, styled replacement for window.confirm() ───────────────────
function ConfirmModal({ title = 'Please confirm', message, confirmLabel = 'Confirm', cancelLabel = 'Cancel', danger = false, onConfirm, onCancel }) {
  const dialogRef = React.useRef(null);
  const confirmRef = React.useRef(null);
  useEffect(() => {
    pushAdminOverlay();
    const prev = document.activeElement;
    if (confirmRef.current) confirmRef.current.focus();
    const h = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); onCancel(); return; }
      if (e.key === 'Tab' && dialogRef.current) {
        const btns = dialogRef.current.querySelectorAll('button');
        if (btns.length === 0) return;
        const first = btns[0], last = btns[btns.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
        else if (!dialogRef.current.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', h, true);
    return () => {
      popAdminOverlay();
      document.removeEventListener('keydown', h, true);
      if (prev && typeof prev.focus === 'function' && document.contains(prev)) prev.focus();
    };
  }, [onCancel]);
  return (
    <div style={{position:'fixed', inset:0, zIndex:600, background:'rgba(15,13,10,0.6)', display:'grid', placeItems:'center', padding:16}} onClick={onCancel}>
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-label={title} onClick={e => e.stopPropagation()}
        style={{background:'var(--paper)', border:'1px solid var(--line-strong)', boxShadow:'0 16px 48px rgba(0,0,0,.35)', padding:24, width:'100%', maxWidth:420}}>
        <div className="mono" style={{fontSize:10, letterSpacing:'.1em', color: danger ? 'var(--rust)' : 'var(--ink-2)', marginBottom:10}}>{title.toUpperCase()}</div>
        <div style={{fontSize:14, lineHeight:1.5, color:'var(--ink)', marginBottom:18, whiteSpace:'pre-line'}}>{message}</div>
        <div className="row-flex" style={{display:'flex', gap:8, justifyContent:'flex-end'}}>
          <button className="btn btn-ghost btn-sm" onClick={onCancel}>{cancelLabel}</button>
          <button ref={confirmRef} className={danger ? 'btn btn-sm btn-rust' : 'btn btn-sm'} onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

// Promise-based wrapper: `if (!(await adminConfirm('Delete?'))) return;`
function adminConfirm(message, opts = {}) {
  return new Promise((resolve) => {
    const host = document.createElement('div');
    if (document.querySelector('.admin-theme-dark')) host.className = 'admin-theme-dark';
    document.body.appendChild(host);
    const root = createRoot(host);
    const close = (val) => {
      setTimeout(() => { root.unmount(); host.remove(); }, 0);
      resolve(val);
    };
    root.render(<ConfirmModal message={message} {...opts} onConfirm={() => close(true)} onCancel={() => close(false)} />);
  });
}

async function uploadImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const r = await fetch('/api/admin/upload', {
          method: 'POST',
          headers: postHeaders(),
          credentials: 'include',
          body: JSON.stringify({ filename: file.name, data: reader.result }),
        });
        const d = await r.json();
        if (d.url) resolve(d.url);
        else reject(new Error('upload failed'));
      } catch (e) { reject(e); }
    };
    reader.readAsDataURL(file);
  });
}

// Kept as PNG server-side (not converted to WebP like uploadImage), pdfkit can only
// embed JPEG/PNG on the certificate PDF, and PNG preserves the transparent background
// a canvas signature pad produces. The file is always saved under the caller's own
// staffId server-side, so there's nothing client-supplied to restrict here.
async function saveSignature(dataUrl) {
  const r = await fetch('/api/admin/staff/signature', {
    method: 'POST', headers: postHeaders(), credentials: 'include',
    body: JSON.stringify({ data: dataUrl }),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok || !d.url) throw new Error(`${r.status} ${d.error || 'upload failed'}`);
  return d.url;
}
async function deleteSignature() {
  const r = await fetch('/api/admin/staff/signature/delete', { method:'POST', headers:postHeaders(), credentials:'include' });
  return r.ok;
}

// Signature capture pad, works with mouse, touch, and stylus (e.g. S Pen) via the
// Pointer Events API, which unifies all three input types with no special-casing.
function SignaturePad({ onSave, saving }) {
  const canvasRef = React.useRef(null);
  const drawingRef = React.useRef(false);
  const lastPointRef = React.useRef(null);
  const [hasDrawn, setHasDrawn] = useState(false);

  useEffect(() => {
    const ctx = canvasRef.current.getContext('2d');
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#1a1a1a';
  }, []);

  const posFromEvent = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (canvas.width / rect.width),
      y: (e.clientY - rect.top) * (canvas.height / rect.height),
    };
  };

  const start = (e) => { e.preventDefault(); drawingRef.current = true; lastPointRef.current = posFromEvent(e); setHasDrawn(true); };
  const move = (e) => {
    if (!drawingRef.current) return;
    e.preventDefault();
    const ctx = canvasRef.current.getContext('2d');
    const pos = posFromEvent(e);
    ctx.beginPath();
    ctx.moveTo(lastPointRef.current.x, lastPointRef.current.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    lastPointRef.current = pos;
  };
  const end = () => { drawingRef.current = false; };
  const clear = () => {
    const canvas = canvasRef.current;
    canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
  };
  const save = () => onSave(canvasRef.current.toDataURL('image/png'));

  return (
    <div>
      <canvas ref={canvasRef} width={600} height={200}
        style={{width:'100%', maxWidth:600, height:150, background:'#fff', border:'1px solid var(--line)', touchAction:'none', cursor:'crosshair', display:'block'}}
        onPointerDown={start} onPointerMove={move} onPointerUp={end} onPointerLeave={end} onPointerCancel={end}
      />
      <div className="row-flex" style={{gap:8, marginTop:8}}>
        <button type="button" className="btn btn-ghost btn-sm" onClick={clear} disabled={!hasDrawn}>Clear</button>
        <button type="button" className="btn btn-rust btn-sm" disabled={!hasDrawn || saving} onClick={save}>{saving ? 'Saving…' : 'Save signature'}</button>
      </div>
    </div>
  );
}

// ============================================================
// LOGIN
// ============================================================
function AdminLogin({ onAuth, siteUrl }) {
  const [u, setU] = useState('');
  const [p, setP] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    ensureCsrf();
  }, []);
  const submit = async (e) => {
    e.preventDefault();
    setErr('');
    if (!u || !p) { setErr('Enter both fields.'); return; }
    setBusy(true);
    try {
      const r = await fetch('/api/admin/login', {
        method: 'POST',
        headers: postHeaders(),
        credentials: 'include',
        body: JSON.stringify({ username: u, pin: p, password: p }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        if (r.status === 429) setErr(`Too many attempts. Try again in ${data.retryAfterSec || 60}s.`);
        else if (r.status === 404 || r.status === 405 || r.status === 501) setErr('Admin API unavailable. Start with `node server.js` (not `python -m http.server`).');
        else setErr('Invalid name or password / PIN.');
        return;
      }
      onAuth();
    } catch {
      setErr('Login service unavailable.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <div style={{
      minHeight:'100vh',
      background:'radial-gradient(ellipse at 60% 40%, #1c1510 0%, #0f0d0a 70%)',
      color:'var(--paper)',
      display:'grid', placeItems:'center', padding:24,
    }}>
      <div style={{width:'100%', maxWidth: 420}}>
        <div style={{display:'flex', alignItems:'center', gap:12, marginBottom: 28}}>
          <div className="logo-mark sm" style={{background:'#000'}}>
            <img src="/assets/logo.webp" alt="" style={{height:28}}/>
          </div>
          <div>
            <div style={{fontFamily:'JetBrains Mono, monospace', fontSize:11, letterSpacing:'.18em', color:'var(--ochre)'}}>OUTBACK · OPERATIONS</div>
            <div style={{fontFamily:'Instrument Serif, serif', fontSize:22}}>Staff terminal</div>
          </div>
        </div>
        <form onSubmit={submit} style={{background:'#181410', border:'1px solid #2a241c', padding: 28}}>
          <div className="mono" style={{fontSize:10, color:'rgba(244,237,225,0.5)', marginBottom: 14}}>// AUTH REQUIRED</div>
          <label className="field"><span className="label" style={{color:'var(--paper)'}}>Name</span>
            <input className="input" style={{background:'#0f0d0a', borderColor:'#2a241c', color:'var(--paper)'}} value={u} onChange={e => setU(e.target.value)} autoComplete="username" />
          </label>
          <label className="field"><span className="label" style={{color:'var(--paper)'}}>Password / PIN</span>
            <input className="input" type="password" style={{background:'#0f0d0a', borderColor:'#2a241c', color:'var(--paper)'}} value={p} onChange={e => setP(e.target.value)} autoComplete="current-password" />
          </label>
          {err && (
            <div style={{display:'flex', alignItems:'center', gap:8, color:'#f87060', background:'rgba(181,69,27,0.15)', border:'1px solid rgba(181,69,27,0.35)', padding:'10px 12px', fontSize:13, marginBottom:12}}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{flexShrink:0}}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              {err}
            </div>
          )}
          <button disabled={busy} className="btn btn-rust" style={{width:'100%', justifyContent:'center', marginTop:6, opacity:busy?0.7:1}}>
            {busy ? (
              <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{animation:'spin 1s linear infinite'}}><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg> Signing in…</>
            ) : <>Enter terminal <Icon name="chevronRight" size={13}/></>}
          </button>
        </form>
        <div style={{marginTop:18, textAlign:'center'}}>
          <a className="mono" style={{display:'inline-flex', alignItems:'center', gap:4, fontSize:11, color:'#c4a75d', textDecoration:'underline', textUnderlineOffset:3, cursor:'pointer'}} onClick={() => { if (siteUrl) window.location.href = siteUrl + '/home'; }}><Icon name="chevronLeft" size={10}/> Back to public site</a>
        </div>
      </div>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ============================================================
// SHELL
// ============================================================
const ROLE_LEVELS = { owner: 4, manager: 3, technician: 2, staff: 1, seller: 1, pending: 0 };

/* Compact SVG icons for the sidebar - 16×16 viewBox, stroke-based */
const NAV_ICONS = {
  overview:     <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
  orders:       <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 01-8 0"/></svg>,
  'payment-plans': <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="12" y1="13" x2="12" y2="19"/><path d="M14 14.5c0-.83-.9-1.5-2-1.5s-2 .67-2 1.5.9 1.5 2 1.5 2 .67 2 1.5-.9 1.5-2 1.5-2-.67-2-1.5"/></svg>,
  repairs:      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"/></svg>,
  'hdd-reports': <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="2" y="7" width="20" height="10" rx="2"/><line x1="6" y1="12" x2="6.01" y2="12"/><line x1="10" y1="12" x2="18" y2="12"/><path d="M6 17v3M18 17v3"/></svg>,
  quotes:       <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>,
  'pc-builder': <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="6" y="2" width="12" height="20" rx="1"/><line x1="9" y1="6" x2="15" y2="6"/><line x1="9" y1="9" x2="15" y2="9"/><circle cx="12" cy="16" r="2.5"/></svg>,
  reviews:      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>,
  ewaste:       <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><polyline points="1 4 1 10 7 10"/><polyline points="23 20 23 14 17 14"/><path d="M20.49 9A9 9 0 005.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 013.51 15"/></svg>,
  bookings:     <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
  availability: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><path d="M8 14h2M8 17h2M14 14h2M14 17h2"/></svg>,
  products:     <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="2" y="3" width="7" height="7"/><rect x="15" y="3" width="7" height="7"/><rect x="15" y="14" width="7" height="7"/><rect x="2" y="14" width="7" height="7"/></svg>,
  services:     <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93l-1.42 1.42M5.35 18.65l-1.42 1.42M22 12h-2M4 12H2M19.07 19.07l-1.42-1.42M5.35 5.35L3.93 3.93M12 22v-2M12 4V2"/></svg>,
  software:     <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>,
  tutorials:    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z"/><path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z"/></svg>,
  ai:           <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="4" y="8" width="16" height="10" rx="2"/><path d="M8 8V6a2 2 0 012-2h4a2 2 0 012 2v2"/><line x1="12" y1="13" x2="12" y2="15"/><line x1="9" y1="13" x2="9" y2="15"/><line x1="15" y1="13" x2="15" y2="15"/></svg>,
  groups:       <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>,
  customers:    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
  sellers:      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>,
  clients:      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="7" width="18" height="14" rx="1"/><path d="M8 7V5a2 2 0 012-2h4a2 2 0 012 2v2"/><line x1="3" y1="12" x2="21" y2="12"/></svg>,
  memberships:  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>,
  'gift-cards': <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><polyline points="20 12 20 22 4 22 4 12"/><rect x="2" y="7" width="20" height="5"/><line x1="12" y1="22" x2="12" y2="7"/><path d="M12 7H7.5a2.5 2.5 0 010-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 000-5C13 2 12 7 12 7z"/></svg>,
  rewards:      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M6 9c0-1 .895-2 2-2h8c1.105 0 2 .895 2 2v8c0 1.105-.895 2-2 2H8c-1.105 0-2-.895-2-2V9z"/><polyline points="9 4 9 2 15 2 15 4"/><line x1="12" y1="9" x2="12" y2="15"/><line x1="9" y1="12" x2="15" y2="12"/></svg>,
  'store-credit': <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>,
  analytics:    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>,
  expenses:     <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>,
  policies:     <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>,
  settings:     <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93l-1.41 1.41M16.24 16.24l1.41 1.41M4.93 4.93l1.41 1.41M7.76 16.24l-1.41 1.41M22 12h-2M4 12H2M12 22v-2M12 4V2"/></svg>,
  'seller-billing': <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>,
  'audit-log': <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="12" y2="17"/></svg>,
  'tax-reports': <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/><line x1="6" y1="8" x2="6" y2="13"/><line x1="10" y1="11" x2="10" y2="13"/><line x1="14" y1="9" x2="14" y2="13"/><line x1="18" y1="7" x2="18" y2="13"/></svg>,
};

const ADMIN_SECTIONS = [
  { group:'OPERATIONS', items: [
    { id:'overview',  label:'Overview',      minRole:'staff', excludeRoles:['seller'] },
    { id:'orders',    label:'Orders',        minRole:'technician' },
    { id:'payment-plans', label:'Payment Plans', minRole:'technician' },
    { id:'repairs',   label:'Repair Jobs',   minRole:'staff', excludeRoles:['seller'] },
    { id:'hdd-reports', label:'HDD Condition Reports', minRole:'staff', excludeRoles:['seller'] },
    { id:'quotes',    label:'Quotes',  minRole:'staff', excludeRoles:['seller'] },
    { id:'pc-builder', label:'PC Builder', minRole:'technician' },
    { id:'reviews',   label:'Reviews',       minRole:'staff', excludeRoles:['seller'] },
    { id:'ewaste',    label:'eWaste Intake', minRole:'technician' },
    { id:'bookings',  label:'Bookings',      minRole:'manager' },
    { id:'availability', label:'Availability', minRole:'manager' },
  ]},
  { group:'CATALOG', items: [
    { id:'products',  label:'Products',         minRole:'seller' },
    { id:'services',  label:'Services',          minRole:'manager' },
    { id:'software',  label:'Software',          minRole:'manager' },
    { id:'tutorials', label:'Tutorials',         minRole:'manager' },
    { id:'ai',        label:'AI Models & Boxes', minRole:'manager' },
    { id:'policies',  label:'Policies',          minRole:'manager' },
  ]},
  { group:'COMMUNITY', items: [
    { id:'groups',    label:'Groups',    minRole:'manager' },
    { id:'customers', label:'Customers', minRole:'technician' },
    { id:'sellers',   label:'Sellers',   minRole:'manager' },
    { id:'clients',   label:'Clients',   minRole:'manager' },
  ]},
  { group:'STORE', items: [
    { id:'memberships', label:'Memberships', minRole:'manager' },
    { id:'gift-cards', label:'Gift Cards',   minRole:'staff', excludeRoles:['seller'] },
    { id:'rewards',   label:'Rewards',       minRole:'manager' },
    { id:'store-credit', label:'Store Credit', minRole:'manager' },
    { id:'analytics', label:'Analytics',      minRole:'manager' },
    { id:'expenses',    label:'Expenses',      minRole:'manager' },
    { id:'tax-reports', label:'Tax Reports',   minRole:'manager' },
    { id:'seller-billing', label:'Seller Billing', minRole:'manager' },
    { id:'settings',  label:'Settings',      minRole:'seller' },
    { id:'audit-log', label:'Audit Log',     minRole:'manager' },
  ]},
];

const COLLAPSED_GROUPS_KEY = 'oe-admin-collapsed-groups';

function AdminSidebar({ section, setSection, onSignOut, role, username }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => {
    try { return JSON.parse(localStorage.getItem(COLLAPSED_GROUPS_KEY) || '[]'); } catch { return []; }
  });
  const toggleGroup = (g) => setCollapsed(cur => {
    const next = cur.includes(g) ? cur.filter(x => x !== g) : [...cur, g];
    try { localStorage.setItem(COLLAPSED_GROUPS_KEY, JSON.stringify(next)); } catch {}
    return next;
  });
  const navTo = async (id) => {
    if (id !== section && hasDirtyDrawer()) {
      const ok = await adminConfirm('A panel with unsaved changes is open.\nLeave this section and discard those changes?', {
        title: 'Unsaved changes', confirmLabel: 'Leave anyway', cancelLabel: 'Stay here', danger: true,
      });
      if (!ok) return;
    }
    setSection(id);
    setMobileOpen(false);
  };
  const myLevel = ROLE_LEVELS[role] ?? 0;
  const visibleSections = ADMIN_SECTIONS
    .map(g => ({ ...g, items: g.items.filter(it => {
      if ((ROLE_LEVELS[it.minRole] ?? 0) > myLevel) return false;
      if (it.excludeRoles && it.excludeRoles.includes(role)) return false;
      return true;
    }) }))
    .filter(g => g.items.length > 0);
  const initials = (username || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

  const NavContent = () => (
    <>
      <nav aria-label="Admin navigation" style={{flex:1, overflowY:'auto', padding:'14px 10px'}}>
        {visibleSections.map((g) => {
          const isCollapsed = collapsed.includes(g.group) && !g.items.some(it => it.id === section);
          return (
          <div key={g.group} style={{marginBottom: 18}}>
            <button type="button" className="mono" onClick={() => toggleGroup(g.group)} aria-expanded={!isCollapsed}
              style={{display:'flex', alignItems:'center', justifyContent:'space-between', width:'100%', background:'none', border:'none', cursor:'pointer', fontSize:10, letterSpacing:'.12em', color:'rgba(244,237,225,0.4)', padding:'4px 10px 8px', fontFamily:'JetBrains Mono, monospace'}}>
              <span>{g.group}</span>
              <Icon name="chevronDown" size={8} strokeWidth={3} style={{transition:'transform 150ms ease', transform: isCollapsed ? 'rotate(-90deg)' : 'none'}}/>
            </button>
            {!isCollapsed && <div style={{display:'grid', gap: 2}}>
              {g.items.map(it => {
                const active = section === it.id;
                return (
                  <a key={it.id} href={'/' + it.id} aria-current={active ? 'page' : undefined}
                    onClick={(e) => { e.preventDefault(); navTo(it.id); }}
                    style={{
                      display:'flex', alignItems:'center', gap:10, padding:'8px 10px',
                      cursor:'pointer', fontSize:13, lineHeight:1.2, borderRadius:2,
                      background: active ? 'rgba(211,154,55,0.18)' : 'transparent',
                      color: active ? 'var(--ochre)' : 'rgba(244,237,225,0.7)',
                      fontWeight: active ? 600 : 400,
                      borderLeft: active ? '2px solid var(--ochre)' : '2px solid transparent',
                    }}>
                    <span style={{width:16, display:'flex', alignItems:'center', justifyContent:'center', opacity: active ? 1 : 0.65, flexShrink:0}}>
                      {NAV_ICONS[it.id]}
                    </span>
                    <span style={{flex:1}}>{it.label}</span>
                    {it.count > 0 && (
                      <span className="mono" style={{
                        fontSize:10, padding:'2px 6px',
                        background: it.urgent && !active ? 'var(--rust)' : active ? 'rgba(211,154,55,0.3)' : '#2a241c',
                        color: it.urgent && !active ? '#fff' : active ? 'var(--ochre)' : 'var(--ochre)',
                      }}>{it.count}</span>
                    )}
                  </a>
                );
              })}
            </div>}
          </div>
          );
        })}
      </nav>
      <div style={{padding:'12px 14px', borderTop:'1px solid #2a241c', display:'flex', alignItems:'center', gap:10}}>
        <div style={{width:32, height:32, background:'var(--ochre)', color:'var(--dark)', fontSize:12, fontWeight:700, display:'grid', placeItems:'center', fontFamily:'JetBrains Mono, monospace', flexShrink:0}}>{initials}</div>
        <div style={{flex:1, minWidth:0}}>
          <div style={{fontSize:13, color:'var(--paper)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{username || 'Staff'}</div>
          <div className="mono" style={{fontSize:10, color:'rgba(244,237,225,0.5)'}}>{(role||'staff').toUpperCase()}</div>
        </div>
        <button
          className="btn btn-ghost btn-sm"
          style={{background:'transparent', borderColor:'#3a3228', color:'rgba(244,237,225,0.6)', flexShrink:0, gap:6, whiteSpace:'nowrap'}}
          onClick={onSignOut}
          title="Sign out"
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/></svg>
          Sign out
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile hamburger button */}
      <button
        onClick={() => setMobileOpen(o => !o)}
        style={{
          display:'none', position:'fixed', top:14, left:14, zIndex:300,
          width:40, height:40, background:'#0f0d0a', border:'1px solid #2a241c',
          color:'var(--ochre)', cursor:'pointer', alignItems:'center', justifyContent:'center',
        }}
        className="admin-hamburger"
        aria-label="Menu"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          style={{position:'fixed', inset:0, background:'rgba(0,0,0,0.55)', zIndex:250}}
        />
      )}

      {/* Desktop sidebar / mobile drawer */}
      <aside style={{
        width:248, background:'#0f0d0a', color:'rgba(244,237,225,0.75)',
        height:'100vh', position:'sticky', top:0,
        display:'flex', flexDirection:'column', borderRight:'1px solid #2a241c',
        flexShrink:0,
      }} className={mobileOpen ? 'admin-sidebar admin-sidebar-open' : 'admin-sidebar'}>
        <div style={{padding:'18px 18px 14px', borderBottom:'1px solid #2a241c', display:'flex', gap:10, alignItems:'center'}}>
          <div className="logo-mark sm" style={{background:'#000', padding:'3px 6px', height:32}}>
            <img src="/assets/logo.webp" alt="" style={{height:24}}/>
          </div>
          <div>
            <div style={{fontFamily:'JetBrains Mono, monospace', fontSize:9.5, letterSpacing:'.18em', color:'var(--ochre)'}}>OUTBACK · OPS</div>
            <div style={{fontSize:12, color:'rgba(244,237,225,0.45)'}}>Staff terminal</div>
          </div>
        </div>
        <NavContent />
      </aside>
      <style>{`
        @media (max-width: 768px) {
          .admin-sidebar { position: fixed !important; top: 0 !important; left: 0 !important; height: 100vh !important; z-index: 260; transform: translateX(-100%); transition: transform 220ms ease; }
          .admin-sidebar.admin-sidebar-open { transform: translateX(0); }
          .admin-hamburger { display: flex !important; }
        }
      `}</style>
    </>
  );
}

function AdminTopbar({ title, subtitle, actions, search, onSearch, searchRef }) {
  // Local input state debounced into onSearch so filtering doesn't run on every keystroke.
  const [local, setLocal] = useState(search || '');
  const timerRef = React.useRef(null);
  useEffect(() => {
    if (timerRef.current) return; // user is mid-typing; don't clobber
    setLocal(search || '');
  }, [search]);
  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);
  const handleChange = (v) => {
    setLocal(v);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => { timerRef.current = null; if (onSearch) onSearch(v); }, 250);
  };
  return (
    <div className="admin-topbar" style={{padding:'18px 32px', borderBottom:'1px solid var(--line)', background:'var(--bg-elev)', display:'flex', alignItems:'center', justifyContent:'space-between', gap:24, flexWrap:'wrap'}}>
      <div>
        <div className="mono" style={{fontSize:11, letterSpacing:'.12em', color:'var(--ink-2)'}}>STAFF TERMINAL · {new Date().toLocaleDateString('en-AU', {weekday:'long', day:'2-digit', month:'short'}).toUpperCase()}</div>
        <div style={{display:'flex', alignItems:'baseline', gap:14, marginTop:4, flexWrap:'wrap'}}>
          <h1 className="serif" style={{fontSize:32, fontWeight:400, lineHeight:1}}>{title}</h1>
          {subtitle && <span style={{fontSize:13, color:'var(--ink-2)'}}>{subtitle}</span>}
        </div>
      </div>
      <div className="row-flex" style={{gap:10}}>
        <input ref={searchRef} className="input admin-topbar-search" type="search" aria-label="Search orders, SKUs, customers" placeholder="Search… ( / )" style={{padding:'7px 12px', fontSize:13, width:260}} value={local} onChange={e => handleChange(e.target.value)} />
        {actions}
      </div>
    </div>
  );
}

// Reusable bits ----------------------------------------------
function StatTile({ label, value, delta, tone }) {
  const isUp = delta && (delta.startsWith('+') || delta.startsWith('↑'));
  const isDown = delta && (delta.startsWith('-') || delta.startsWith('↓'));
  return (
    <div style={{padding:'18px 20px', background:'var(--paper)', border:'1px solid var(--line-strong)', borderLeft: tone==='rust' ? '3px solid var(--rust)' : '1px solid var(--line-strong)'}}>
      <div className="mono" style={{fontSize:10, letterSpacing:'.1em', color:'var(--ink-2)'}}>{label}</div>
      <div className="serif" style={{fontSize:40, marginTop:6, lineHeight:1, color: tone==='rust'?'var(--rust)':'var(--ink)'}}>{value}</div>
      {delta && (
        <div className="mono" style={{fontSize:11, marginTop:8, display:'flex', alignItems:'center', gap:4, color: isUp ? 'var(--eucalyptus)' : isDown ? 'var(--rust)' : 'var(--ink-2)'}}>
          {isUp && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="18 15 12 9 6 15"/></svg>}
          {isDown && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 12 15 18 9"/></svg>}
          {delta}
        </div>
      )}
    </div>
  );
}

const TABLE_PAGE_SIZE = 50;

function Table({ columns, rows, onRowClick, emptyMessage, loading, defaultSort }) {
  const tpl = columns.map(c => c.w || '1fr').join(' ');
  const [sort, setSort] = useState(defaultSort || null); // { key, dir: 'asc' | 'desc' }
  const [page, setPage] = useState(0);
  const safeRows = rows || [];

  // Keep the original index alongside each row so onRowClick(row, i) callers
  // that index into their own state arrays keep working when sorted/paged.
  const sorted = useMemo(() => {
    const indexed = safeRows.map((r, i) => ({ r, i }));
    if (!sort) return indexed;
    const col = columns.find(c => (c.key || c.label) === sort.key);
    if (!col || !col.sort) return indexed;
    const val = typeof col.sort === 'function' ? col.sort : (r) => r[col.key];
    const arr = [...indexed].sort((a, b) => {
      const av = val(a.r), bv = val(b.r);
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === 'number' && typeof bv === 'number') return av - bv;
      return String(av).localeCompare(String(bv), undefined, { numeric: true, sensitivity: 'base' });
    });
    if (sort.dir === 'desc') arr.reverse();
    return arr;
  }, [safeRows, sort, columns]);

  useEffect(() => { setPage(0); }, [safeRows.length, sort]);

  const paged = sorted.length > TABLE_PAGE_SIZE;
  const pageCount = Math.max(1, Math.ceil(sorted.length / TABLE_PAGE_SIZE));
  const curPage = Math.min(page, pageCount - 1);
  const visible = paged ? sorted.slice(curPage * TABLE_PAGE_SIZE, (curPage + 1) * TABLE_PAGE_SIZE) : sorted;

  const toggleSort = (col) => {
    const key = col.key || col.label;
    setSort(s => {
      if (!s || s.key !== key) return { key, dir: 'asc' };
      if (s.dir === 'asc') return { key, dir: 'desc' };
      return null;
    });
  };

  return (
    <div style={{background:'var(--paper)', border:'1px solid var(--line-strong)'}}>
      <div className="admin-table-scroll" style={{overflowX:'auto'}}>
        <div style={{minWidth:560}}>
          <div role="row" style={{display:'grid', gridTemplateColumns:tpl, padding:'10px 18px', background:'var(--bg-elev)', borderBottom:'2px solid var(--ink)', fontFamily:'JetBrains Mono, monospace', fontSize:10, letterSpacing:'.1em', color:'var(--ink-2)'}}>
            {columns.map((c,i) => {
              const key = c.key || c.label;
              const active = sort && sort.key === key;
              if (!c.sort) return <div key={i} role="columnheader">{c.label.toUpperCase()}</div>;
              return (
                <div key={i} role="columnheader" aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
                  <button type="button" onClick={() => toggleSort(c)}
                    title={`Sort by ${c.label}`}
                    style={{font:'inherit', letterSpacing:'inherit', color: active ? 'var(--rust)' : 'inherit', background:'none', border:'none', padding:0, cursor:'pointer', display:'inline-flex', alignItems:'center', gap:4}}>
                    {c.label.toUpperCase()}
                    <span aria-hidden="true" style={{display:'inline-flex', opacity: active ? 1 : 0.4}}>
                      {active ? <Icon name={sort.dir === 'asc' ? 'chevronUp' : 'chevronDown'} size={8} strokeWidth={3}/> : <Icon name="chevronsUpDown" size={8} strokeWidth={3}/>}
                    </span>
                  </button>
                </div>
              );
            })}
          </div>
          {loading ? (
            [...Array(5)].map((_, i) => (
              <div key={i} aria-hidden="true" style={{display:'grid', gridTemplateColumns:tpl, padding:'14px 18px', borderTop:'1px solid var(--line)', gap:12}}>
                {columns.map((_, j) => <div key={j} className="admin-skel" style={{height:14, maxWidth: j === 0 ? 80 : 140}}/>)}
              </div>
            ))
          ) : sorted.length === 0 ? (
            <div style={{padding:'32px 24px', textAlign:'center', color:'var(--ink-2)'}}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{margin:'0 auto 12px', display:'block', opacity:.35}}><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>
              <div style={{fontSize:13, fontWeight:500}}>{emptyMessage || 'Nothing here yet.'}</div>
              {onRowClick && <div style={{fontSize:12, color:'var(--ink-3)', marginTop:4}}>Use the button above to add your first record.</div>}
            </div>
          ) : visible.map(({ r, i }) => (
            <div key={i}
              role={onRowClick ? 'button' : undefined}
              tabIndex={onRowClick ? 0 : undefined}
              onClick={() => onRowClick && onRowClick(r,i)}
              onKeyDown={e => { if (onRowClick && (e.key==='Enter'||e.key===' ')) { e.preventDefault(); onRowClick(r,i); } }}
              style={{display:'grid', gridTemplateColumns:tpl, padding:'14px 18px', borderTop:'1px solid var(--line)', fontSize:13, alignItems:'center', cursor: onRowClick?'pointer':'default'}}
              onMouseEnter={e => { if (onRowClick) e.currentTarget.style.background='var(--bg-elev)'; }}
              onMouseLeave={e => { e.currentTarget.style.background='transparent'; }}>
              {columns.map((c,j) => <div key={j} style={{minWidth:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{c.render ? c.render(r) : r[c.key]}</div>)}
            </div>
          ))}
        </div>
      </div>
      {!loading && paged && (
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', gap:12, padding:'10px 18px', borderTop:'1px solid var(--line)', background:'var(--bg-elev)', flexWrap:'wrap'}}>
          <span className="mono" style={{fontSize:11, color:'var(--ink-2)'}}>{sorted.length.toLocaleString()} RECORDS · PAGE {curPage + 1} / {pageCount}</span>
          <div style={{display:'flex', gap:6}}>
            <button className="btn btn-ghost btn-sm" disabled={curPage === 0} style={{opacity: curPage === 0 ? 0.45 : 1}} onClick={() => setPage(p => Math.max(0, p - 1))}><Icon name="chevronLeft" size={12}/> Prev</button>
            <button className="btn btn-ghost btn-sm" disabled={curPage >= pageCount - 1} style={{opacity: curPage >= pageCount - 1 ? 0.45 : 1}} onClick={() => setPage(p => Math.min(pageCount - 1, p + 1))}>Next <Icon name="chevronRight" size={12}/></button>
          </div>
        </div>
      )}
    </div>
  );
}

// Icons paired with status colors so state is never conveyed by colour alone (WCAG 1.4.1).
const STATUS_GLYPHS = {
  paid:'check', 'part-paid':'halfCircle', unpaid:'x',
  pending:'circleEmpty', ordering:'quarterCircle', building:'hammer', testing:'diamond', packed:'square', shipped:'chevronRight', fulfilled:'check', refunded:'undo',
  new:'star', 'in-review':'halfCircle', quoted:'mail', won:'check', closed:'minus',
  live:'check', sold:'check', bench:'hammer', recycle:'refresh',
  ok:'check', 'low batt':'halfCircle', offline:'x', maintenance:'hammer',
  active:'check', cancelled:'x', expired:'minus',
};

function StatusPill({ value, map }) {
  const cfg = map[value] || { bg:'var(--bg-deep)', fg:'var(--ink)' };
  const iconName = STATUS_GLYPHS[String(value || '').toLowerCase()];
  return (
    <span className="tag" style={{background: cfg.bg, color: cfg.fg, borderColor: cfg.bg, gap:4}}>
      {iconName && <Icon name={iconName} size={10} strokeWidth={2.5}/>}
      {String(value).toUpperCase()}
    </span>
  );
}

function Drawer({ open, onClose, title, children, footer, dirty = false }) {
  const panelRef = React.useRef(null);
  const confirmingRef = React.useRef(false);
  const dirtyRef = React.useRef(dirty);
  dirtyRef.current = dirty;

  // Close request, warns first when there are unsaved changes (P0: data safety).
  const requestClose = React.useCallback(async () => {
    if (confirmingRef.current) return;
    if (dirtyRef.current) {
      confirmingRef.current = true;
      const ok = await adminConfirm('You have unsaved changes that will be lost.\nClose without saving?', {
        title: 'Unsaved changes', confirmLabel: 'Discard changes', cancelLabel: 'Keep editing', danger: true,
      });
      confirmingRef.current = false;
      if (!ok) return;
    }
    onClose();
  }, [onClose]);

  // Register dirty state globally (sidebar nav warns) + native beforeunload guard.
  useEffect(() => {
    if (!open || !dirty) return;
    adminDirtyDrawers++;
    const onBeforeUnload = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => {
      adminDirtyDrawers = Math.max(0, adminDirtyDrawers - 1);
      window.removeEventListener('beforeunload', onBeforeUnload);
    };
  }, [open, dirty]);

  // Focus management: move focus in on open, trap Tab, restore focus on close.
  const requestCloseRef = React.useRef(requestClose);
  requestCloseRef.current = requestClose;
  useEffect(() => {
    if (!open) return;
    const prevFocus = document.activeElement;
    if (panelRef.current) panelRef.current.focus();
    const focusables = () => panelRef.current
      ? Array.from(panelRef.current.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'))
      : [];
    const h = (e) => {
      if (hasAdminOverlay()) return; // a confirm dialog / help overlay is stacked on top
      if (e.key === 'Escape') { e.preventDefault(); requestCloseRef.current(); return; }
      if (e.key === 'Tab' && panelRef.current) {
        const els = focusables();
        if (els.length === 0) { e.preventDefault(); panelRef.current.focus(); return; }
        const first = els[0], last = els[els.length - 1];
        if (e.shiftKey && (document.activeElement === first || document.activeElement === panelRef.current)) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
        else if (!panelRef.current.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', h);
    return () => {
      document.removeEventListener('keydown', h);
      if (prevFocus && typeof prevFocus.focus === 'function' && document.contains(prevFocus)) prevFocus.focus();
    };
  }, [open]);

  if (!open) return null;
  return (
    <div style={{position:'fixed', inset:0, zIndex:200}}>
      <div aria-hidden="true" onClick={requestClose} style={{position:'absolute', inset:0, background:'rgba(15,13,10,0.5)'}}></div>
      <div ref={panelRef} role="dialog" aria-modal="true" aria-label={typeof title === 'string' && title ? title : 'Edit panel'} tabIndex={-1}
        className="admin-drawer"
        style={{position:'absolute', top:0, right:0, bottom:0, width:'min(540px, 100vw)', maxWidth:'100vw', background:'var(--bg)', borderLeft:'1px solid var(--line)', boxShadow:'-8px 0 24px rgba(0,0,0,.15)', display:'flex', flexDirection:'column', outline:'none'}}>
        <div style={{padding:'16px 24px', borderBottom:'1px solid var(--line)', display:'flex', alignItems:'center', justifyContent:'space-between', gap:12}}>
          <h3 style={{fontSize:16, fontWeight:600, margin:0, minWidth:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{title}</h3>
          <div style={{display:'flex', alignItems:'center', gap:10, flexShrink:0}}>
            {dirty && <span className="mono" title="This drawer has unsaved changes" style={{display:'inline-flex', alignItems:'center', gap:4, fontSize:9, letterSpacing:'.08em', color:'var(--ochre)'}}><Icon name="dot" size={8}/> UNSAVED</span>}
            <button className="icon-btn" onClick={requestClose} aria-label="Close" style={{flexShrink:0}}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
        </div>
        <div style={{flex:1, minWidth:0, overflowY:'auto', overflowX:'hidden', padding:24}}>{children}</div>
        {footer && <div style={{padding:'14px 24px', borderTop:'1px solid var(--line)', background:'var(--bg-elev)'}}>{footer}</div>}
      </div>
    </div>
  );
}

// ============================================================
// OVERVIEW
// ============================================================
function parseOrderDate(dateStr) {
  if (!dateStr) return null;
  // ISO string (e.g. "2026-06-08T...")
  if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) return new Date(dateStr);
  // DD/MM/YYYY
  const dmy = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (dmy) return new Date(+dmy[3], +dmy[2] - 1, +dmy[1]);
  // DD Mon YYYY (e.g. "08 Jun 2026")
  const dmon = dateStr.match(/^(\d{1,2})\s+(\w+)\s+(\d{4})$/);
  if (dmon) return new Date(`${dmon[2]} ${dmon[1]}, ${dmon[3]}`);
  return null;
}

function AdminOverview({ go }) {
  const [overview, setOverview] = useState(null);
  const [orders, setOrders] = useState(null);
  const [repairs, setRepairs] = useState(null);
  const [quotes, setQuotes] = useState(null);
  const [catalog, setCatalog] = useState(null);
  useEffect(() => {
    fetch('/api/admin/metrics', { credentials:'include' })
      .then(r => r.ok ? r.json() : Promise.reject()).then(d => setOverview(d.overview || null)).catch(() => setOverview(null));
    fetch('/api/admin/orders', { credentials:'include' })
      .then(r => r.ok ? r.json() : Promise.reject()).then(d => setOrders(d.items || [])).catch(() => setOrders([]));
    fetch('/api/admin/repairs', { credentials:'include' })
      .then(r => r.ok ? r.json() : Promise.reject()).then(d => setRepairs(d.columns || [])).catch(() => setRepairs([]));
    fetch('/api/admin/quotes', { credentials:'include' })
      .then(r => r.ok ? r.json() : Promise.reject()).then(d => setQuotes(d.items || [])).catch(() => setQuotes([]));
    fetch('/api/admin/catalog', { credentials:'include' })
      .then(r => r.ok ? r.json() : Promise.reject()).then(d => setCatalog(d.products || [])).catch(() => setCatalog([]));
  }, []);

  const fmtAUD = n => '$' + Number(n).toLocaleString('en-AU', {minimumFractionDigits:2, maximumFractionDigits:2});
  const orderCount = overview ? overview.orders7d : '-';
  const revenue    = overview ? fmtAUD(overview.revenue7d) : '-';
  const openRepairs = repairs === null ? '-' : repairs.filter(c => c.id !== 'done').reduce((s, c) => s + (c.cards ? c.cards.length : 0), 0);
  const ACTIVE_QUOTE_STATUSES = new Set(['new', 'in-review', 'quoted']);
  const quotesAwaiting = quotes === null ? '-' : quotes.filter(q => ACTIVE_QUOTE_STATUSES.has(q.status || 'new')).length;
  const lowStock = catalog === null ? [] : catalog
    .filter(p => !p.infiniteStock)
    .map(p => ({ ...p, _stock: p.variants && p.variants.length > 0 ? p.variants.reduce((a, v) => a + (Number(v.stock) || 0), 0) : p.stock }))
    .filter(p => p._stock != null && p._stock <= 3);

  return (
    <div style={{padding: 32, display:'grid', gap: 28}}>
      <div className="grid-4">
        <StatTile label="REVENUE · 7D" value={revenue} />
        <StatTile label="ORDERS · 7D" value={orderCount} />
        <StatTile label="OPEN REPAIRS" value={openRepairs} tone="rust" />
        <StatTile label="QUOTES AWAITING" value={quotesAwaiting} tone="rust" />
      </div>

      <div className="admin-split" style={{display:'grid', gridTemplateColumns:'2fr 1fr', gap:28}}>
        <div>
          <div className="row-flex" style={{justifyContent:'space-between', marginBottom:12}}>
            <h3 className="serif" style={{fontSize:22}}>Activity stream</h3>
          </div>
          <div style={{background:'var(--paper)', border:'1px solid var(--line)'}}>
            {(() => {
              const events = [
                ...(orders || []).map(o => ({ type:'order', label: `Order ${o.id}`, sub: o.cust || o.items || '', date: o.date || '' })),
                ...(quotes || []).filter(q => q.status === 'new').map(q => ({ type:'quote', label: `Quote request · ${q.name}`, sub: q.loc || '', date: '' })),
              ].slice(-10).reverse();
              if (events.length === 0) return (
                <div style={{padding:'24px 20px'}}>
                  <div style={{fontSize:13, fontWeight:600, marginBottom:14, color:'var(--ink-1)'}}>Get started - set up your store</div>
                  <div style={{display:'grid', gap:10}}>
                    {[
                      { step:'1', label:'Shop details', desc:'Name, email, address, acknowledgement of country', nav:'Settings → Shop' },
                      { step:'2', label:'Integrations', desc:'Stripe payments, SMTP email, AusPost shipping', nav:'Settings → Integrations' },
                      { step:'3', label:'Add products', desc:'Create your first product listing or import a catalog', nav:'Catalog' },
                      { step:'4', label:'Membership tiers', desc:'Create tiers to enable subscriptions on the public site', nav:'Memberships' },
                    ].map(({ step, label, desc, nav }) => (
                      <div key={step} style={{display:'flex', gap:14, alignItems:'flex-start', padding:'10px 12px', background:'var(--bg)', border:'1px solid var(--line)'}}>
                        <div style={{minWidth:22, height:22, borderRadius:'50%', background:'var(--ochre)', color:'var(--dark)', fontSize:11, fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center', marginTop:1}}>{step}</div>
                        <div style={{flex:1}}>
                          <div style={{fontSize:13, fontWeight:600}}>{label}</div>
                          <div style={{fontSize:12, color:'var(--ink-2)', marginTop:2}}>{desc}</div>
                        </div>
                        <span className="mono" style={{fontSize:10, color:'var(--ink-3)', whiteSpace:'nowrap', marginTop:4}}>{nav}</span>
                      </div>
                    ))}
                  </div>
                  <div style={{fontSize:12, color:'var(--ink-3)', marginTop:14}}>Orders and quote requests will appear here once customers start arriving.</div>
                </div>
              );
              return events.map((ev, i) => (
                <div key={i} style={{display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 16px', borderBottom: i < events.length - 1 ? '1px solid var(--line)' : 'none'}}>
                  <div>
                    <span style={{fontSize:13, fontWeight:500}}>{ev.label}</span>
                    {ev.sub && <span style={{fontSize:12, color:'var(--ink-2)', marginLeft:8}}>{ev.sub}</span>}
                  </div>
                  {ev.date && <span className="mono" style={{fontSize:11, color:'var(--ink-2)'}}>{ev.date.toUpperCase()}</span>}
                </div>
              ));
            })()}
          </div>
        </div>

        <div style={{display:'grid', gap:20}}>
          <div style={{background:'var(--dark)', color:'var(--paper)', padding:24}}>
            <span className="eyebrow" style={{color:'var(--ochre)'}}>BENCH LOAD · TODAY</span>
            {(() => {
              const cards = (repairs || []).filter(c => c.id !== 'done').flatMap(c => (c.cards || []).map(card => ({...card, col: c.title || c.id })));
              if (cards.length === 0) return <div style={{padding:'12px 0 0', color:'rgba(244,237,225,0.45)', fontSize:13}}>No active jobs on bench.</div>;
              return (
                <ul style={{listStyle:'none', padding:'12px 0 0', margin:0, display:'grid', gap:8}}>
                  {cards.slice(0, 5).map((card, i) => (
                    <li key={i} style={{fontSize:12, display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:8}}>
                      <span style={{flex:1, lineHeight:1.3}}>{card.t}</span>
                      <span className="mono" style={{fontSize:10, color:'var(--ochre)', whiteSpace:'nowrap'}}>{card.who ? card.who.toUpperCase() : ''}</span>
                    </li>
                  ))}
                  {cards.length > 5 && <li style={{fontSize:11, color:'rgba(244,237,225,0.45)'}}>+{cards.length - 5} more</li>}
                </ul>
              );
            })()}
          </div>

          <div style={{background:'var(--paper)', border:'1px solid var(--line)', padding:22}}>
            <span className="eyebrow">LOW STOCK · REORDER</span>
            <ul style={{listStyle:'none', padding:0, margin:'10px 0 0', display:'grid', gap:8, fontSize:13}}>
              {lowStock.length === 0
                ? <li style={{fontSize:13, color:'var(--ink-2)'}}>No low-stock items.</li>
                : lowStock.map((p,i) => (
                  <li key={i} style={{display:'flex', justifyContent:'space-between', padding:'6px 0', borderBottom:'1px solid var(--line)'}}>
                    <span>{p.name}</span><span className="mono" style={{color:'var(--rust)'}}>{p._stock} left</span>
                  </li>
                ))
              }
            </ul>
            {lowStock.length > 0 && (
              <button className="btn btn-rust btn-sm" style={{marginTop:14, width:'100%', justifyContent:'center'}} onClick={() => {
                const csv = ['Name,Stock\n', ...lowStock.map(p => `${p.name},${p._stock}\n`)].join('');
                const a = document.createElement('a');
                a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
                a.download = 'purchase-order.csv';
                a.click();
              }}>Generate PO <Icon name="chevronRight" size={11}/></button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Full-page chrome for the order editor, a standalone, URL-addressable page
// (/orders?open=OE-0001) rather than a slide-over Drawer, so an order can be
// bookmarked, shared, or reopened straight from a refresh. Mirrors Drawer's
// unsaved-changes guard and beforeunload warning without the overlay/panel
// styling, since this replaces the Orders list in place rather than floating
// over it.
function OrderPage({ title, dirty, onClose, footer, children, backLabel = 'Back', maxWidth = 860 }) {
  const confirmingRef = React.useRef(false);
  const dirtyRef = React.useRef(dirty);
  dirtyRef.current = dirty;

  const requestClose = React.useCallback(async () => {
    if (confirmingRef.current) return;
    if (dirtyRef.current) {
      confirmingRef.current = true;
      const ok = await adminConfirm('You have unsaved changes that will be lost.\nGo back without saving?', {
        title: 'Unsaved changes', confirmLabel: 'Discard changes', cancelLabel: 'Keep editing', danger: true,
      });
      confirmingRef.current = false;
      if (!ok) return;
    }
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (!dirty) return;
    adminDirtyDrawers++;
    const onBeforeUnload = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => {
      adminDirtyDrawers = Math.max(0, adminDirtyDrawers - 1);
      window.removeEventListener('beforeunload', onBeforeUnload);
    };
  }, [dirty]);

  return (
    <div style={{padding:32, maxWidth}}>
      <div className="row-flex" style={{justifyContent:'space-between', marginBottom:18, gap:12}}>
        <button className="btn btn-ghost btn-sm" onClick={requestClose}>
          <Icon name="chevronLeft" size={12}/> {backLabel}
        </button>
        {dirty && <span className="mono" title="Unsaved changes" style={{display:'inline-flex', alignItems:'center', gap:4, fontSize:9, letterSpacing:'.08em', color:'var(--ochre)'}}><Icon name="dot" size={8}/> UNSAVED</span>}
      </div>
      <h2 style={{fontSize:22, fontWeight:600, margin:'0 0 20px'}}>{title}</h2>
      <div>{children}</div>
      {footer && <div style={{marginTop:24, padding:'14px 0', borderTop:'1px solid var(--line)'}}>{footer}</div>}
    </div>
  );
}

// ============================================================
// ORDER helpers, shared by AdminOrders and OrderDrawer
// ============================================================
const ORDER_PAYMENT_MAP = {
  paid:       { bg:'#d8e7d0', fg:'#345526' },
  'part-paid':{ bg:'#fff4d6', fg:'#7a5d10' },
  unpaid:     { bg:'#f3d5c5', fg:'#7a3a18' },
  gratis:     { bg:'#ede7f6', fg:'#4527a0', label:'Gratis' },
  cancelled:  { bg:'#f3d5c5', fg:'#7a3a18', label:'Cancelled' },
};
const ORDER_FULFILMENT_MAP = {
  pending:   { bg:'var(--bg-deep)', fg:'var(--ink-2)' },
  ordering:  { bg:'#f0e6d3', fg:'#7a5010' },
  building:  { bg:'#fff4d6', fg:'#7a5d10' },
  testing:   { bg:'#dceaf5', fg:'#1668c8' },
  packed:    { bg:'#c8dff5', fg:'#0e4a8c' },
  shipped:   { bg:'var(--ink)', fg:'var(--paper)' },
  fulfilled: { bg:'#d8e7d0', fg:'#345526' },
  refunded:  { bg:'#f3d5c5', fg:'#7a3a18' },
};
function liTotal(i) { return (Number(i.amount) || 0) * (Number(i.qty) || 1); }
function priceLineToAmount(priceLine) {
  const m = String(priceLine || '').match(/[\d,]+(\.\d+)?/);
  return m ? Number(m[0].replace(/,/g, '')) : '';
}
// Builds one or more sensible line items from a service's pricing model instead of
// blindly grabbing the first number in priceLine, an hourly rate, a range, a quote,
// a per-km callout fee, or an "hourly + parts" job should never collapse into a
// single flat one-off price times a single "quantity." Per-km travel is worked out
// automatically from the order's Location field (shop → customer distance) rather
// than asking staff to enter kilometres by hand.
async function buildServiceLineItems(svc, customerLoc) {
  const price = String(svc.price ?? svc.priceLine ?? '').trim();
  // `kind` and `needsDistanceRecalc` are explicit flags carried on the line item
  // itself, not re-derived later by pattern-matching the description text,
  // which breaks the instant a staff member rewords it.
  const mk = (description, amount, extra = {}) => ({ id: 'li-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6), description, amount, qty: 1, ...extra });
  const isFree = /no charge/i.test(price);
  const perKmMatch = price.match(/\$\s*(\d+(\.\d+)?)\s*\/\s*km/i);
  const flatCalloutMatch = price.match(/\$\s*(\d+(\.\d+)?)\s*call-?out/i);
  const hourlyMatch = price.match(/\$\s*(\d+(\.\d+)?)\s*\/\s*hr/i);
  const isRange = /–|-\s*\$/.test(price) && !hourlyMatch && !perKmMatch && !flatCalloutMatch;
  const isQuoted = /quoted/i.test(price);

  if (isFree) return [mk(svc.name || '', 0)];

  if (perKmMatch || flatCalloutMatch) {
    const items = [];
    if (perKmMatch) {
      const rate = Number(perKmMatch[1]);
      const loc = (customerLoc || '').trim();
      if (!loc) {
        items.push(mk(`${svc.name}, travel (set the order's Location or Shipping Address so km is worked out automatically)`, '', { needsDistanceRecalc: true, serviceName: svc.name, kmRate: rate }));
      } else {
        try {
          const r = await fetch(`/api/admin/geocode-distance?address=${encodeURIComponent(loc)}`, { credentials: 'include' });
          if (r.ok) {
            const d = await r.json();
            items.push(mk(`${svc.name}, travel (${d.distKm}km from shop to "${loc}" @ $${rate}/km)`, Math.round(rate * d.distKm * 100) / 100, { needsDistanceRecalc: true, serviceName: svc.name, kmRate: rate }));
          } else {
            items.push(mk(`${svc.name}, travel (couldn't locate "${loc}", confirm km manually)`, '', { needsDistanceRecalc: true, serviceName: svc.name, kmRate: rate }));
          }
        } catch {
          items.push(mk(`${svc.name}, travel (distance lookup failed, confirm km manually)`, '', { needsDistanceRecalc: true, serviceName: svc.name, kmRate: rate }));
        }
      }
    }
    if (flatCalloutMatch) items.push(mk(`${svc.name}, call-out fee`, Number(flatCalloutMatch[1])));
    if (hourlyMatch) items.push(mk(`${svc.name}, labour (set qty to hours worked)`, Number(hourlyMatch[1]), { kind: 'hourly' }));
    return items;
  }

  if (hourlyMatch) {
    // Labour is billed per hour (qty = hours worked). Parts are a real cost, not
    // a line item pulled from thin air, they go through the expense tracker so
    // the parts-auto line item (cost + margin) is what actually gets billed,
    // instead of a naked customer-facing number nothing backs.
    return [mk(`${svc.name}, labour (set qty to hours worked)`, Number(hourlyMatch[1]), { kind: 'hourly' })];
  }

  if (isRange || isQuoted) return [mk(`${svc.name} (${price}, confirm price before saving)`, '')];

  return [mk(svc.name || '', priceLineToAmount(price))];
}
function serviceNeedsPartsExpense(svc) {
  const price = String(svc.price ?? svc.priceLine ?? '').trim();
  return /\/\s*hr\b/i.test(price) && /\+\s*parts\b/i.test(price);
}
function discountAmountFor(subtotal, type, value) {
  const v = Number(value) || 0;
  if (!v || subtotal <= 0) return 0;
  const raw = type === 'percent' ? subtotal * (v / 100) : v;
  return Math.round(Math.max(0, Math.min(subtotal, raw)) * 100) / 100;
}
function expTotal(e) { return (Number(e.amount) || 0) * (Number(e.quantity) || 1); }
function orderAmountPaid(f) {
  return Math.round((f.payments || []).reduce((s, p) => s + (Number(p.amount) || 0), 0) * 100) / 100;
}
function orderEffectiveTotal(f) {
  const payments = f.payments || [];
  const lastMethod = payments.length ? (payments[payments.length - 1].method || 'Card') : 'Card';
  return lastMethod === 'Cash' ? cashRound(Number(f.total) || 0) : Math.round((Number(f.total) || 0) * 100) / 100;
}
function orderBalance(f) {
  if (f.gratis) return 0;
  return Math.round((orderEffectiveTotal(f) - orderAmountPaid(f)) * 100) / 100;
}
// Mirrors server.js's paymentPlanProgress(), progress is always derived from
// actual payments, never stored per-installment, so it reconciles correctly
// regardless of how each instalment was actually collected.
function paymentPlanProgress(order) {
  const plan = order.paymentPlan;
  if (!plan) return null;
  const paidSoFar = orderAmountPaid(order);
  const total = Number(order.total) || 0;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  let cumulative = 0;
  let nextDue = null;
  const entries = (plan.schedule || []).map(entry => {
    const amt = Math.round((Number(entry.amount) || 0) * 100) / 100;
    cumulative = Math.round((cumulative + amt) * 100) / 100;
    const owed = Math.round(Math.max(0, Math.min(amt, cumulative - paidSoFar)) * 100) / 100;
    let status;
    if (owed <= 0.005) status = 'paid';
    else status = new Date(entry.dueDate + 'T00:00:00') < today ? 'overdue' : 'upcoming';
    if (status !== 'paid' && !nextDue) nextDue = { dueDate: entry.dueDate, amount: owed };
    return { dueDate: entry.dueDate, amount: amt, owed, status };
  });
  const remaining = Math.max(0, Math.round((total - paidSoFar) * 100) / 100);
  const completed = remaining <= 0.005;
  return { paidSoFar, remaining, completed, nextDue: completed ? null : nextDue, entries };
}
function orderPaymentStatus(f) {
  if (f.cancelled) return 'cancelled';
  if (f.gratis) return 'gratis';
  if ((f.payments || []).length > 0) {
    if (orderAmountPaid(f) >= orderEffectiveTotal(f)) return 'paid';
    return 'part-paid';
  }
  if (f.status === 'paid' || f.status === 'part-paid') return f.status;
  return 'unpaid';
}

const PART_STATUS_COLORS = { ordered:{bg:'#dceaf5',fg:'#1668c8'}, arrived:{bg:'#fff4d6',fg:'#7a5d10'}, installed:{bg:'#d8e7d0',fg:'#345526'}, returned:{bg:'#f3d5c5',fg:'#7a3a18'} };

function QuantityInput({ value, onCommit }) {
  const [text, setText] = React.useState(String(value || 1));
  React.useEffect(() => { setText(String(value || 1)); }, [value]);
  return (
    <input className="input" type="number" min="1" step="1" value={text}
      onChange={ev => { setText(ev.target.value); }}
      onBlur={() => onCommit(Math.max(1, parseInt(text) || 1))}
    />
  );
}

function ExpenseRow({ e, isEditing, expenseForm, setExpenseForm, setExpenseEdit, saveExpense, deleteExpense }) {
  const ef = isEditing ? expenseForm : e;
  if (isEditing) return (
    <div style={{padding:'12px', background:'var(--paper)', border:'1px solid var(--ochre)', marginBottom:6}}>
      <div className="grid-2" style={{gap:10, marginBottom:10}}>
        <label className="field" style={{margin:0}}><span className="label">Description</span><input className="input" value={ef.description||''} onChange={ev=>setExpenseForm(f=>({...f,description:ev.target.value}))}/></label>
        <label className="field" style={{margin:0}}><span className="label">Amount (AUD, per item)</span><input className="input" type="number" min="0" step="0.01" value={ef.amount||''} onChange={ev=>setExpenseForm(f=>({...f,amount:nonNegInput(ev.target.value)}))}/></label>
      </div>
      <div className="grid-2" style={{gap:10, marginBottom:10}}>
        <label className="field" style={{margin:0}}><span className="label">Quantity</span>
          <QuantityInput value={ef.quantity} onCommit={q => setExpenseForm(f=>({...f,quantity:q}))}/>
        </label>
        <label className="field" style={{margin:0}}><span className="label">Category</span>
          <select className="select" value={ef.category||'parts'} onChange={ev=>setExpenseForm(f=>({...f,category:ev.target.value}))}>
            {['tools','equipment','parts','software','other'].map(c=><option key={c}>{c}</option>)}
          </select>
        </label>
      </div>
      <div className="grid-2" style={{gap:10, marginBottom:10}}>
        <label className="field" style={{margin:0}}><span className="label">Part status</span>
          <select className="select" value={ef.partStatus||''} onChange={ev=>setExpenseForm(f=>({...f,partStatus:ev.target.value}))}>
            <option value="">N/A</option>
            {['ordered','arrived','installed','returned'].map(s=><option key={s} value={s}>{s.charAt(0).toUpperCase()+s.slice(1)}</option>)}
          </select>
        </label>
      </div>
      <div className="grid-2" style={{gap:10, marginBottom:10}}>
        <label className="field" style={{margin:0}}><span className="label">Date</span><input className="input" type="date" value={auDateToISO(ef.date)} onChange={ev=>setExpenseForm(f=>({...f,date:isoToAuDate(ev.target.value)}))}/></label>
        <label className="field" style={{margin:0}}><span className="label">Notes</span><input className="input" value={ef.notes||''} onChange={ev=>setExpenseForm(f=>({...f,notes:ev.target.value}))}/></label>
      </div>
      <label style={{display:'flex',alignItems:'center',gap:8,cursor:'pointer',marginBottom:12,fontSize:13}}>
        <input type="checkbox" checked={!!ef.isSecondHand} onChange={ev=>setExpenseForm(f=>({...f,isSecondHand:ev.target.checked}))} style={{width:15,height:15}}/>
        Second-hand
      </label>
      <div style={{display:'flex', gap:8}}>
        <button className="btn btn-sm" onClick={() => saveExpense(ef)}>Save</button>
        <button className="btn btn-ghost btn-sm" onClick={() => { setExpenseEdit(null); setExpenseForm({}); }}>Cancel</button>
        <button className="btn btn-ghost btn-sm" style={{color:'var(--rust)', marginLeft:'auto'}} onClick={() => deleteExpense(e.id)}>Delete</button>
      </div>
    </div>
  );
  return (
    <div key={e.id} role="button" tabIndex={0} style={{display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 12px', background:'var(--bg-elev)', border:'1px solid var(--line)', marginBottom:6, cursor:'pointer', gap:10}}
      onClick={() => { setExpenseEdit(e.id); setExpenseForm({...e}); }}
      onKeyDown={e2 => { if (e2.key==='Enter'||e2.key===' ') { e2.preventDefault(); setExpenseEdit(e.id); setExpenseForm({...e}); } }}>
      <div style={{flex:1, minWidth:0}}>
        <span style={{fontSize:13, fontWeight:500}}>{e.description}</span>
        {Number(e.quantity) > 1 && <span className="mono" style={{fontSize:10, color:'var(--ink-3)', marginLeft:8}}>×{e.quantity}</span>}
        {e.category && <span className="mono" style={{fontSize:10, color:'var(--ink-3)', marginLeft:8}}>{e.category.toUpperCase()}</span>}
        {e.partStatus && (() => { const s = PART_STATUS_COLORS[e.partStatus]; return <span className="tag" style={{background:s?.bg,color:s?.fg,borderColor:s?.bg,marginLeft:8,fontSize:10}}>{e.partStatus.toUpperCase()}</span>; })()}
        {e.notes && <div style={{fontSize:11, color:'var(--ink-3)', marginTop:2}}>{e.notes}</div>}
      </div>
      <div style={{display:'flex', gap:12, alignItems:'center', flexShrink:0}}>
        <span className="mono" style={{fontSize:11, color:'var(--ink-3)'}}>{e.date}</span>
        {e.partStatus === 'returned'
          ? <span className="mono" style={{fontWeight:600}}>
              <span style={{textDecoration:'line-through', color:'var(--ink-3)', marginRight:6}}>-${expTotal(e).toLocaleString('en-AU',{minimumFractionDigits:2})}</span>
              <span style={{color:'#345526'}}>$0.00</span>
            </span>
          : <span className="mono" style={{fontWeight:600, color:'var(--rust)'}}>-${expTotal(e).toLocaleString('en-AU',{minimumFractionDigits:2})}</span>
        }
        <span style={{color:'var(--ink-3)', display:'inline-flex'}}><Icon name="pencil" size={12}/></span>
      </div>
    </div>
  );
}

// ============================================================
// OrderDrawer, edit panel for a single order
// ============================================================
function OrderDrawer({ edit, expenses, customers, services = [], onClose, onRowUpdate, onSave, onExpensesChange, onCustomerCreated, onDelete, sessionInfo = {}, siteUrl }) {
  const [form, setForm] = useState({ ...edit, id: edit.id || edit.suggestedId || '' });
  const findCustomerMatch = (c) => {
    const email = (c.email || '').toLowerCase().trim();
    const name = (c.cust || '').toLowerCase().trim();
    return (customers || []).find(x =>
      (email && (x.email || '').toLowerCase().trim() === email) ||
      (name && (x.name || '').toLowerCase().trim() === name)
    );
  };
  const [selectedCustomerId, setSelectedCustomerId] = useState(() => {
    const match = findCustomerMatch(edit);
    return match ? match.id : '';
  });
  const [customerQuery, setCustomerQuery] = useState(() => {
    const match = findCustomerMatch(edit);
    return match ? `${match.name}${match.email ? ` (${match.email})` : ''}` : '';
  });
  const [customerDropdownOpen, setCustomerDropdownOpen] = useState(false);
  const applyCustomer = (c) => {
    setSelectedCustomerId(c ? c.id : '');
    const typed = customerQuery.trim();
    setCustomerQuery(c ? `${c.name}${c.email ? ` (${c.email})` : ''}` : '');
    setCustomerDropdownOpen(false);
    if (c) setForm(f => ({ ...f, cust: c.name || f.cust, email: c.email || f.email, phone: c.phone || f.phone, loc: c.loc || f.loc, shippingAddress: c.shippingAddress || f.shippingAddress }));
    else if (typed && !form.cust) setForm(f => ({ ...f, cust: typed }));
  };
  const customerMatches = useMemo(() => {
    const q = customerQuery.trim().toLowerCase();
    if (!q) return (customers || []).slice(0, 8);
    return (customers || []).filter(c =>
      (c.name || '').toLowerCase().includes(q) ||
      (c.email || '').toLowerCase().includes(q) ||
      (c.phone || '').toLowerCase().includes(q)
    ).slice(0, 8);
  }, [customers, customerQuery]);
  const [payEntry, setPayEntry] = useState({ amount:'', method: localStorage.getItem('oe_lastPaymentMethod') || 'Cash', note:'', date: todayISODate() });
  const [deleteBusy, setDeleteBusy] = useState(false);
  const canDeleteOrder = (ROLE_LEVELS[sessionInfo.role] ?? 0) >= ROLE_LEVELS.manager;
  // Money taken but not yet refunded blocks cancel/delete/revert, those actions
  // make the order stop being a real sale, so the customer needs their money
  // back (or store credit) first rather than the order just vanishing with
  // cash unaccounted for.
  const blockIfUnrefunded = () => {
    if (maxRefund > 0.005) {
      adminToast(`This order has $${maxRefund.toFixed(2)} paid and not yet refunded. Issue a refund first (see the Refund section below).`);
      return true;
    }
    return false;
  };

  // Asks whether linked expenses (parts bought for this job) should be deleted
  // too. Once the order record is gone there's no other way to keep them out
  // of the tax report, unlike Cancel, which the server already excludes by
  // jobId, deleting/reverting removes the order those expenses are anchored to.
  const resolveLinkedExpenseDeletion = async (actionLabel) => {
    if (linkedExpenses.length === 0) return true;
    const total = linkedExpenses.reduce((s, e) => s + expTotal(e), 0);
    return await adminConfirm(
      `This order has ${linkedExpenses.length} linked expense(s) totalling $${total.toFixed(2)}. Since ${actionLabel}, keeping them would still count them as real business expenses in tax reports even though the parts were never sold. Delete them too?`,
      { title: 'Delete linked expenses?', confirmLabel: 'Delete expenses', cancelLabel: 'Keep expenses', danger: true }
    );
  };

  const deleteOrderNow = async () => {
    if (blockIfUnrefunded()) return;
    const ok = await adminConfirm(
      `This will permanently delete order ${form.id} for ${form.cust || 'this customer'} and cannot be undone.`,
      { title: 'Delete order', confirmLabel: 'Delete order', danger: true }
    );
    if (!ok) return;
    const deleteExpensesToo = await resolveLinkedExpenseDeletion('this order is being deleted');
    setDeleteBusy(true);
    if (deleteExpensesToo && linkedExpenses.length > 0) {
      await Promise.all(linkedExpenses.map(e => fetch('/api/admin/expenses/delete', { method:'POST', headers:postHeaders(), credentials:'include', body: JSON.stringify({ id: e.id }) }).catch(()=>null)));
      onExpensesChange(expenses.filter(e => !linkedExpenses.some(le => le.id === e.id)));
    }
    const r = await fetch('/api/admin/orders/delete', { method:'POST', headers:postHeaders(), credentials:'include', body: JSON.stringify({ id: form.id }) }).catch(()=>null);
    setDeleteBusy(false);
    if (!r || !r.ok) { adminToast('Failed to delete order.'); return; }
    onDelete?.(form.id);
    onClose();
  };

  const [cancelBusy, setCancelBusy] = useState(false);
  const toggleCancelled = async () => {
    if (!form.cancelled && blockIfUnrefunded()) return;
    setCancelBusy(true);
    await saveNow({ cancelled: !form.cancelled });
    setCancelBusy(false);
  };

  const [revertBusy, setRevertBusy] = useState(false);
  const revertToQuote = async () => {
    if (blockIfUnrefunded()) return;
    const expNote = linkedExpenses.length > 0
      ? ` Its ${linkedExpenses.length} linked expense(s) (totalling $${linkedExpenses.reduce((s,e)=>s+expTotal(e),0).toFixed(2)}) will be copied into the quote for reference, then removed from expense tracking so they stop counting as real business expenses in tax reports, nothing's actually been bought yet.`
      : '';
    const ok = await adminConfirm(
      `This will create a new quote from this order's details and permanently delete order ${form.id}. Use this when the work hasn't actually gone ahead yet.${expNote}`,
      { title: 'Revert to quote', confirmLabel: 'Revert to quote', danger: true }
    );
    if (!ok) return;
    setRevertBusy(true);
    try {
      const qr = await fetch('/api/admin/quotes', { credentials:'include' });
      const quotesList = qr.ok ? (await qr.json()).items || [] : [];
      const used = new Set(quotesList.map(q => { const m = String(q.quoteRef || '').match(/^OEQ-(\d+)$/); return m ? parseInt(m[1]) : null; }).filter(n => n != null));
      let n = 1; while (used.has(n)) n++;
      const quoteRef = `OEQ-${String(n).padStart(4, '0')}`;
      // Plain data snapshot only, no jobId/id carried over, so these can't be
      // mistaken for live expense records if the quote object is inspected later.
      const plannedExpenses = linkedExpenses.map(e => ({ description: e.description, amount: e.amount, quantity: e.quantity, category: e.category, date: e.date, notes: e.notes }));
      const quotePayload = {
        id: 'quot-' + Date.now(),
        quoteRef,
        cust: form.cust || '',
        email: form.email || '',
        phone: form.phone || '',
        loc: form.loc || '',
        shippingAddress: form.shippingAddress || '',
        lineItems: form.lineItems || [],
        discountType: form.discountType,
        discountValue: form.discountValue,
        discountAmount: form.discountAmount,
        total: form.total || 0,
        notes: `Reverted from order ${form.id}.`,
        plannedExpenses,
        status: 'new',
        createdAt: new Date().toISOString(),
        revertedFromOrderId: form.id,
      };
      const qs = await fetch('/api/admin/quotes/save', { method:'POST', headers:postHeaders(), credentials:'include', body: JSON.stringify(quotePayload) }).catch(()=>null);
      if (!qs || !qs.ok) { adminToast('Failed to create the quote, order was not touched.'); setRevertBusy(false); return; }
      if (linkedExpenses.length > 0) {
        await Promise.all(linkedExpenses.map(e => fetch('/api/admin/expenses/delete', { method:'POST', headers:postHeaders(), credentials:'include', body: JSON.stringify({ id: e.id }) }).catch(()=>null)));
        onExpensesChange(expenses.filter(e => !linkedExpenses.some(le => le.id === e.id)));
      }
      const dr = await fetch('/api/admin/orders/delete', { method:'POST', headers:postHeaders(), credentials:'include', body: JSON.stringify({ id: form.id }) }).catch(()=>null);
      if (!dr || !dr.ok) { adminToast(`Quote ${quoteRef} was created, but the order could not be deleted - please delete it manually.`); setRevertBusy(false); return; }
      adminToast(`Reverted to quote ${quoteRef}.`, 'success');
      onDelete?.(form.id);
      onClose();
    } finally {
      setRevertBusy(false);
    }
  };
  const [updateEntry, setUpdateEntry] = useState({ text:'', type:'note' });
  const [expenseEdit, setExpenseEdit] = useState(null);
  const [expenseForm, setExpenseForm] = useState({});
  const [trackingEmailStatus, setTrackingEmailStatus] = useState(null);
  const [trackingBusy, setTrackingBusy] = useState(false);
  const [trackingResult, setTrackingResult] = useState(null);
  const [refundEntry, setRefundEntry] = useState({ method:'stripe', amount:'' });
  const [refundBusy, setRefundBusy] = useState(false);
  const [refundError, setRefundError] = useState(null);
  const canManagePlan = (ROLE_LEVELS[sessionInfo.role] ?? 0) >= ROLE_LEVELS.manager;
  const [planForm, setPlanForm] = useState({ frequency:'fortnightly', installmentAmount:'', collectionMethod:'manual', startDate: todayISODate() });
  const [planBusy, setPlanBusy] = useState(false);
  const [planError, setPlanError] = useState(null);
  const [cardLookup, setCardLookup] = useState(null); // {exists, hasCard, cardLast4, cardBrand} for form.email

  useEffect(() => {
    if (!form.email || form.paymentPlan) { setCardLookup(null); return; }
    let cancelled = false;
    fetch(`/api/admin/portal-users/lookup?email=${encodeURIComponent(form.email)}`, { credentials:'include' })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (!cancelled && d) setCardLookup(d); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [form.email, form.paymentPlan]);

  const savePlan = async () => {
    setPlanError(null);
    const amt = Number(planForm.installmentAmount);
    if (!(amt > 0)) { setPlanError('Enter an instalment amount greater than zero.'); return; }
    setPlanBusy(true);
    const r = await fetch('/api/admin/orders/payment-plan/save', { method:'POST', headers:postHeaders(), credentials:'include', body: JSON.stringify({
      orderId: form.id, frequency: planForm.frequency, installmentAmount: amt, collectionMethod: planForm.collectionMethod, startDate: planForm.startDate,
    }) }).catch(()=>null);
    setPlanBusy(false);
    if (!r) { setPlanError('Network error. Please try again.'); return; }
    const d = await r.json().catch(()=>({}));
    if (!r.ok) { setPlanError(d.message || 'Could not set up payment plan.'); return; }
    setForm(f => ({ ...f, paymentPlan: d.order.paymentPlan }));
    onRowUpdate({ ...form, paymentPlan: d.order.paymentPlan });
  };

  const cancelPlan = async () => {
    const ok = await adminConfirm('Cancel this payment plan? Remaining instalments will no longer be tracked or collected.', { title:'Cancel payment plan', confirmLabel:'Cancel plan', danger:true });
    if (!ok) return;
    setPlanBusy(true);
    const r = await fetch('/api/admin/orders/payment-plan/cancel', { method:'POST', headers:postHeaders(), credentials:'include', body: JSON.stringify({ orderId: form.id }) }).catch(()=>null);
    setPlanBusy(false);
    if (!r || !r.ok) { adminToast('Failed to cancel payment plan.'); return; }
    setForm(f => ({ ...f, paymentPlan: { ...f.paymentPlan, status:'cancelled' } }));
    onRowUpdate({ ...form, paymentPlan: { ...form.paymentPlan, status:'cancelled' } });
  };

  // Dirty tracking against the last persisted snapshot, drives the
  // unsaved-changes warning in the Drawer (overlay click / Escape / nav).
  const savedSnapRef = React.useRef(JSON.stringify({ ...edit }));
  const dirty = JSON.stringify(form) !== savedSnapRef.current;

  // When line items are present they're the source of truth, keep total/items summary in sync.
  React.useEffect(() => {
    if (!form.lineItems || form.lineItems.length === 0) return;
    const lineItemsTotal = Math.round(form.lineItems.reduce((s,i)=>s+liTotal(i),0) * 100) / 100;
    const discountAmount = discountAmountFor(lineItemsTotal, form.discountType, form.discountValue);
    const total = Math.round((lineItemsTotal - discountAmount) * 100) / 100;
    const summary = form.lineItems.map(i => i.description).filter(Boolean).join(', ');
    if (total !== Number(form.total) || discountAmount !== Number(form.discountAmount || 0) || (summary && summary !== form.items)) {
      setForm(f => ({ ...f, total, discountAmount, items: summary || f.items }));
    }
  }, [form.lineItems, form.discountType, form.discountValue]);

  const saveNow = async (patch) => {
    const updated = { ...form, ...patch };
    const prevForm = form;
    const rowId = edit?.id || updated.id;
    setForm(updated);
    onRowUpdate(updated);
    savedSnapRef.current = JSON.stringify(updated);
    const r = await fetch('/api/admin/orders/save', { method:'POST', headers:postHeaders(), credentials:'include', body: JSON.stringify({ ...updated, _originalId: rowId }) }).catch(()=>null);
    if (!r || !r.ok) {
      setForm(prevForm);
      onRowUpdate(prevForm);
      savedSnapRef.current = JSON.stringify(prevForm);
      adminToast('Save failed, change not persisted. Please try again.');
    }
  };

  const doRefund = async () => {
    const amt = Number(refundEntry.amount);
    if (!amt || amt <= 0) { setRefundError('Enter a refund amount greater than zero.'); return; }
    // Never refund more than has actually been taken for this order.
    const paid = orderAmountPaid(form);
    const maxRefund = Math.max(0, Math.round((paid - (form.refund ? Number(form.refund.amount) || 0 : 0)) * 100) / 100);
    if (amt > maxRefund + 0.005) {
      setRefundError(`Refund exceeds the amount paid on this order, maximum refundable is $${Math.max(0, maxRefund).toFixed(2)}.`);
      return;
    }
    const methodLabel = refundEntry.method === 'stripe' ? 'refund to the original card via Stripe' : refundEntry.method === 'cash' ? 'record a cash refund' : 'issue store credit';
    const ok = await adminConfirm(`This will ${methodLabel} of $${amt.toFixed(2)} for order ${form.id} and mark it refunded.`, { title: 'Issue refund', confirmLabel: 'Issue refund', danger: true });
    if (!ok) return;
    setRefundBusy(true); setRefundError(null);
    const r = await fetch('/api/admin/orders/refund', { method:'POST', headers:postHeaders(), credentials:'include', body: JSON.stringify({ id: form.id, method: refundEntry.method, amount: amt }) }).catch(()=>null);
    setRefundBusy(false);
    if (!r) { setRefundError('Network error. Please try again.'); return; }
    const d = await r.json().catch(()=>({}));
    if (!r.ok) { setRefundError(d.message || 'Refund failed.'); return; }
    setForm(d.order);
    onRowUpdate(d.order);
    savedSnapRef.current = JSON.stringify(d.order);
    setRefundEntry({ method:'stripe', amount:'' });
  };

  const checkTracking = async () => {
    setTrackingBusy(true); setTrackingResult(null);
    const r = await fetch('/api/admin/orders/check-tracking', { method:'POST', headers:postHeaders(), credentials:'include', body: JSON.stringify({ id: form.id }) }).catch(()=>null);
    setTrackingBusy(false);
    if (!r) { setTrackingResult({ error: 'Network error.' }); return; }
    const d = await r.json().catch(()=>({}));
    if (!r.ok) { setTrackingResult({ error: d.message || 'Could not fetch tracking.' }); return; }
    setTrackingResult(d.tracking);
    if (d.fulfilment && d.fulfilment !== form.fulfilment) {
      const updated = { ...form, fulfilment: d.fulfilment };
      setForm(updated);
      onRowUpdate(updated);
      savedSnapRef.current = JSON.stringify(updated);
    }
  };

  const PARTS_MARGIN = 0.20;
  const blankExpense = (jobId) => ({ description:'', category:'parts', amount:'', quantity:1, date: new Date().toLocaleDateString('en-AU', {day:'2-digit',month:'2-digit',year:'numeric'}), receipt:null, jobId: jobId||'', notes:'', isSecondHand:false, partStatus:'' });

  const recalcTotal = (expList) => {
    const cost = expList.filter(e => e.jobId && e.jobId === form.id).reduce((s, e) => s + (e.partStatus === 'returned' ? 0 : expTotal(e)), 0);
    const partsCharge = Math.round(cost * (1 + PARTS_MARGIN) * 100) / 100;
    setForm(f => {
      const others = (f.lineItems || []).filter(li => li.id !== 'parts-auto');
      const lineItems = partsCharge > 0
        ? [...others, { id: 'parts-auto', description: 'Parts', amount: partsCharge }]
        : others;
      const subtotal = Math.round(lineItems.reduce((s, i) => s + liTotal(i), 0) * 100) / 100;
      const discountAmount = discountAmountFor(subtotal, f.discountType, f.discountValue);
      const newTotal = Math.round((subtotal - discountAmount) * 100) / 100;
      const updated = { ...f, lineItems, total: newTotal, discountAmount, items: lineItems.map(i => i.description).filter(Boolean).join(', ') || f.items };
      if (edit.id) saveNow(updated);
      return updated;
    });
  };

  const saveExpense = async (exp) => {
    const payload = { ...exp, amount: Number(exp.amount) || 0 };
    const r = await fetch('/api/admin/expenses/save', { method:'POST', headers:postHeaders(), credentials:'include', body: JSON.stringify(payload) }).catch(()=>null);
    if (r && r.ok) {
      const d = await r.json();
      const newExpenses = expenses.find(e => e.id === payload.id)
        ? expenses.map(e => e.id === payload.id ? d.item : e)
        : [...expenses, d.item];
      onExpensesChange(newExpenses);
      recalcTotal(newExpenses);
    }
    setExpenseEdit(null); setExpenseForm({});
  };

  const deleteExpense = async (id) => {
    if (!(await adminConfirm('Delete this expense? This cannot be undone.', { title: 'Delete expense', confirmLabel: 'Delete', danger: true }))) return;
    const r = await fetch('/api/admin/expenses/delete', { method:'POST', headers:postHeaders(), credentials:'include', body: JSON.stringify({ id }) }).catch(()=>null);
    if (!r || !r.ok) { adminToast('Failed to delete expense.'); return; }
    const newExpenses = expenses.filter(e => e.id !== id);
    onExpensesChange(newExpenses);
    recalcTotal(newExpenses);
    setExpenseEdit(null); setExpenseForm({});
  };

  const addPayment = () => {
    const rawAmt = Number(payEntry.amount);
    if (!rawAmt || rawAmt <= 0) return;
    const isCash = payEntry.method === 'Cash';
    const amt = isCash ? cashRound(rawAmt) : Math.round(rawAmt * 100) / 100;
    const payment = { amount: amt, method: payEntry.method, note: payEntry.note, date: orderDateFromISO(payEntry.date) };
    setForm(f => ({ ...f, payments: [...(f.payments || []), payment] }));
    localStorage.setItem('oe_lastPaymentMethod', payEntry.method);
    setPayEntry({ amount:'', method: payEntry.method, note:'', date: todayISODate() });
  };
  const removePayment = async (i) => {
    const p = (form.payments || [])[i];
    const ok = await adminConfirm(`Delete the ${p ? `$${Number(p.amount).toFixed(2)} ${p.method} payment` : 'payment'} logged on ${p?.date || 'this order'}? This cannot be undone.`, { title: 'Delete payment', confirmLabel: 'Delete', danger: true });
    if (!ok) return;
    setForm(f => ({ ...f, payments: (f.payments || []).filter((_,idx) => idx !== i) }));
  };
  const addUpdate = () => {
    if (!updateEntry.text.trim()) return;
    const u = { text: updateEntry.text.trim(), type: updateEntry.type, date: todayOrderDate(), ts: new Date().toISOString() };
    setForm(f => ({ ...f, updates: [...(f.updates || []), u] }));
    setUpdateEntry({ text:'', type:'note' });
  };
  const removeUpdate = (i) => setForm(f => ({ ...f, updates: (f.updates || []).filter((_,idx) => idx !== i) }));

  const linkedExpenses = expenses.filter(e => e.jobId && e.jobId === form.id);
  const partsCost = linkedExpenses.reduce((s, e) => s + (e.partStatus === 'returned' ? 0 : expTotal(e)), 0);

  // Self-heal orders saved before parts-margin auto line items existed: if the
  // linked expenses imply a different parts charge than what's on the order,
  // bring it into sync once on open rather than leaving it stale forever.
  React.useEffect(() => {
    if (!edit.id) return;
    const expectedCharge = Math.round(partsCost * (1 + PARTS_MARGIN) * 100) / 100;
    const existingCharge = Number((form.lineItems || []).find(li => li.id === 'parts-auto')?.amount) || 0;
    if (expectedCharge !== existingCharge) recalcTotal(expenses);
  }, [form.id]);
  const returnedCost = linkedExpenses.reduce((s, e) => s + (e.partStatus === 'returned' ? expTotal(e) : 0), 0);
  const amountPaid = orderAmountPaid(form);
  const profitRevenue = amountPaid > 0 ? amountPaid : (Number(form.total) || 0);
  const profit = profitRevenue - partsCost;
  const maxRefund = Math.max(0, Math.round((amountPaid - (form.refund ? Number(form.refund.amount) || 0 : 0)) * 100) / 100);

  return (
    <OrderPage onClose={onClose} dirty={dirty} backLabel="Back to Orders" title={edit.id ? `Order ${edit.id}` : 'New order'}
      footer={<div className="row-flex" style={{gap:8, justifyContent:'space-between'}}>
        {edit.id
          ? <div className="row-flex" style={{gap:8}}>
              <button className="btn btn-ghost btn-sm"
                onClick={() => window.open(`/api/admin/orders/invoice?id=${encodeURIComponent(form.id)}`, '_blank')}>
                <Icon name="printer" size={14}/>
                Print invoice
              </button>
              <button className="btn btn-ghost btn-sm"
                title="Copy a link the customer can use to leave a review, general feedback, or for a specific product from this order"
                onClick={() => {
                  if (!form.warrantyToken) { adminToast('This order has no review token yet, save it first.'); return; }
                  if (!siteUrl) { adminToast('Site URL not configured, set it in Settings first.'); return; }
                  const url = `${siteUrl}/review?order=${encodeURIComponent(form.id)}&token=${encodeURIComponent(form.warrantyToken)}`;
                  navigator.clipboard?.writeText(url).then(() => adminToast('Review link copied.', 'success')).catch(() => adminToast('Could not copy link.'));
                }}>
                <Icon name="star" size={14}/>
                Copy review link
              </button>
              <button className="btn btn-ghost btn-sm"
                disabled={trackingEmailStatus === 'sending' || !form.email}
                title={!form.email ? 'Order has no customer email' : 'Send order tracking email to customer'}
                onClick={async () => {
                  setTrackingEmailStatus('sending');
                  try {
                    const r = await fetch('/api/admin/orders/send-tracking-email', { method:'POST', headers:postHeaders(), credentials:'include', body: JSON.stringify({ id: form.id }) });
                    setTrackingEmailStatus(r.ok ? 'sent' : 'error');
                  } catch { setTrackingEmailStatus('error'); }
                  setTimeout(() => setTrackingEmailStatus(null), 4000);
                }}>
                <Icon name="mail" size={14}/>
                {trackingEmailStatus === 'sending' ? 'Sending…' : trackingEmailStatus === 'sent' ? 'Email sent' : trackingEmailStatus === 'error' ? 'Failed' : 'Send tracking email'}
              </button>
              {canDeleteOrder && (
                <button className="btn btn-ghost btn-sm" disabled={revertBusy} onClick={revertToQuote} title="The work hasn't happened yet, move this back to a quote instead of it being a real order.">
                  <Icon name="refresh" size={14}/>
                  {revertBusy ? 'Reverting…' : 'Revert to quote'}
                </button>
              )}
              {canDeleteOrder && (
                <button className="btn btn-ghost btn-sm" style={{color:'var(--rust)'}} disabled={deleteBusy} onClick={deleteOrderNow}>
                  <Icon name="trash" size={14}/>
                  {deleteBusy ? 'Deleting…' : 'Delete order'}
                </button>
              )}
            </div>
          : <span/>
        }
        <div className="row-flex" style={{gap:8}}>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>Cancel</button>
          <button className="btn btn-sm" onClick={async () => {
            if (form.email && !isValidEmail(form.email)) { adminToast('Customer email looks invalid, please check it.'); return; }
            if (form.phone && !isValidPhone(form.phone)) { adminToast('Phone number looks invalid, please check it.'); return; }
            if (Number(form.total) < 0) { adminToast('Order total cannot be negative.'); return; }
            const blankLineItem = (form.lineItems || []).find(li => li.id !== 'parts-auto' && li.description && (li.amount === '' || li.amount === null || li.amount === undefined || Number.isNaN(Number(li.amount))));
            if (blankLineItem) { adminToast(`"${blankLineItem.description}" has no price set, confirm it before saving, or it'll bill as $0.`); return; }
            const payload = { ...form, _originalId: edit.id || form.id, _isNew: !edit.id };
            const r = await fetch('/api/admin/orders/save', { method:'POST', headers:postHeaders(), credentials:'include', body: JSON.stringify(payload) }).catch(()=>null);
            if (r && r.ok) {
              const d = await r.json();
              if (d.error) { adminToast(d.message || 'Save failed'); return; }
              const savedItem = d.item || form;
              if (!edit.id && savedItem.id && savedItem.id !== payload.id) {
                adminToast(`Order number ${payload.id} was just taken, assigned ${savedItem.id} instead.`);
              }
              savedSnapRef.current = JSON.stringify(savedItem);
              // If this order was placed against a brand-new customer (no existing
              // record picked or matched), create that customer record now so they
              // immediately appear in the Customers list rather than waiting on backfill.
              if (!selectedCustomerId && form.cust && form.cust.trim() && !findCustomerMatch(form)) {
                const custPayload = { name: form.cust.trim(), email: form.email || '', phone: form.phone || '', loc: form.loc || '', shippingAddress: form.shippingAddress || '' };
                const cr = await fetch('/api/admin/customers/save', { method:'POST', headers:postHeaders(), credentials:'include', body: JSON.stringify(custPayload) }).catch(()=>null);
                if (cr && cr.ok) {
                  const cd = await cr.json();
                  if (cd.item) onCustomerCreated?.(cd.item);
                }
              } else if (selectedCustomerId) {
                // Keep the existing customer record in sync so their next order
                // doesn't need this retyped, e.g. a shipping address added or
                // corrected on this order should stick to the customer, not just
                // this one order.
                const existing = (customers || []).find(c => c.id === selectedCustomerId);
                if (existing) {
                  const changed = ['loc','phone','email','shippingAddress'].some(k => (form[k] || '') !== (existing[k] || ''));
                  if (changed) {
                    const cr = await fetch('/api/admin/customers/save', { method:'POST', headers:postHeaders(), credentials:'include',
                      body: JSON.stringify({ ...existing, loc: form.loc || existing.loc || '', phone: form.phone || existing.phone || '', email: form.email || existing.email || '', shippingAddress: form.shippingAddress || existing.shippingAddress || '' }) }).catch(()=>null);
                    if (cr && cr.ok) {
                      const cd = await cr.json();
                      if (cd.item) onCustomerCreated?.(cd.item);
                    }
                  }
                }
              }
              onSave(savedItem, !edit.id);
            } else {
              adminToast('Save failed, changes not persisted. Please try again.');
            }
          }}>{edit.id ? 'Save' : 'Create order'}</button>
        </div>
      </div>}
    >
      <label className="field"><span className="label">Order Number<ReqMark/></span><input className="input" aria-required="true" style={{fontFamily:'monospace', fontWeight:700}} value={form.id||''} onChange={e=>setForm({...form,id:e.target.value})} placeholder="e.g. OE-1001"/></label>
      <label className="field" style={{position:'relative'}}><span className="label">Customer<ReqMark/></span>
        <input className="input" placeholder="Search by name, email, or phone…" value={customerQuery}
          onChange={e => { setCustomerQuery(e.target.value); setCustomerDropdownOpen(true); if (selectedCustomerId) setSelectedCustomerId(''); }}
          onFocus={() => setCustomerDropdownOpen(true)}
          onBlur={() => setTimeout(() => setCustomerDropdownOpen(false), 150)}
        />
        {customerDropdownOpen && (
          <div style={{position:'absolute', top:'100%', left:0, right:0, zIndex:20, background:'var(--bg)', border:'1px solid var(--line)', boxShadow:'0 4px 12px rgba(0,0,0,.12)', maxHeight:240, overflowY:'auto'}}>
            <div role="button" tabIndex={0} onMouseDown={e => { e.preventDefault(); applyCustomer(null); }}
              style={{padding:'8px 12px', fontSize:13, cursor:'pointer', color:'var(--rust)', borderBottom:'1px solid var(--line)'}}>+ New customer{customerQuery.trim() ? ` "${customerQuery.trim()}"` : ''}</div>
            {customerMatches.length === 0 && (
              <div style={{padding:'8px 12px', fontSize:12, color:'var(--ink-3)'}}>No matching customers.</div>
            )}
            {customerMatches.map(c => (
              <div key={c.id} role="button" tabIndex={0} onMouseDown={e => { e.preventDefault(); applyCustomer(c); }}
                style={{padding:'8px 12px', fontSize:13, cursor:'pointer'}}>
                <div style={{fontWeight:600}}>{c.name}</div>
                <div style={{fontSize:11, color:'var(--ink-3)'}}>{[c.email, c.phone].filter(Boolean).join(' · ') || '-'}</div>
              </div>
            ))}
          </div>
        )}
      </label>
      <label className="field"><span className="label">{selectedCustomerId ? 'Customer name' : 'New customer name'}<ReqMark/></span><input className="input" aria-required="true" value={form.cust||''} onChange={e=>setForm({...form,cust:e.target.value})}/></label>
      <label className="field"><span className="label">Email</span><input className="input" type="email" value={form.email||''} onChange={e=>setForm({...form,email:e.target.value})}/></label>
      <label className="field"><span className="label">Phone</span><input className="input" type="tel" value={form.phone||''} onChange={e=>setForm({...form,phone:e.target.value})}/></label>
      <label className="field"><span className="label">Shipping Address</span><input className="input" value={form.shippingAddress||''} onChange={e=>setForm({...form,shippingAddress:e.target.value})} placeholder="Street, City, State, Postcode"/>
        <div style={{fontSize:11, color:'var(--ink-3)', marginTop:4}}>Where a physical order gets posted.</div>
      </label>
      <label className="field"><span className="label">Location</span><input className="input" value={form.loc||''} onChange={e=>setForm({...form,loc:e.target.value})} placeholder="e.g. suburb or full address"/>
        <div style={{fontSize:11, color:'var(--ink-3)', marginTop:4}}>Used for callout distance. Falls back to Shipping Address if left blank.</div>
      </label>
      <label className="field"><span className="label">Date</span><input className="input" type="date" value={isoFromOrderDate(form.date)} onChange={e=>setForm({...form,date:orderDateFromISO(e.target.value)})}/></label>

      <div className="field">
        <span className="label">Line items</span>
        {(form.lineItems||[]).map(li => {
          const isHourly = li.kind === 'hourly';
          const needsRecalc = !!li.needsDistanceRecalc;
          return (
          <div key={li.id} style={{display:'grid', gridTemplateColumns: needsRecalc ? '1fr 60px 110px 28px 28px' : '1fr 60px 110px 28px', gap:8, marginBottom:8}}>
            <input className="input" placeholder="e.g. Custom software development" value={li.description}
              onChange={e => setForm(f => ({...f, lineItems: f.lineItems.map(x => x.id === li.id ? {...x, description: e.target.value} : x)}))}/>
            <input className="input" type="number" min="1" step="1" placeholder={isHourly ? 'Hrs' : 'Qty'} value={li.qty||1}
              onChange={e => setForm(f => ({...f, lineItems: f.lineItems.map(x => x.id === li.id ? {...x, qty: Math.max(1, parseInt(e.target.value)||1)} : x)}))}/>
            <input className="input" type="number" min="0" step="0.01" placeholder="Price ea." value={li.amount}
              onChange={e => setForm(f => ({...f, lineItems: f.lineItems.map(x => x.id === li.id ? {...x, amount: nonNegInput(e.target.value)} : x)}))}/>
            {needsRecalc && (
              <button className="btn btn-ghost btn-sm" style={{padding:0}} title="Recalculate distance from the order's Location (or Shipping Address if Location is blank)"
                onClick={async () => {
                  const svcName = li.serviceName || 'Callout';
                  const rate = li.kmRate;
                  const loc = (form.loc || form.shippingAddress || '').trim();
                  if (!loc) { adminToast("Add the order's Location or Shipping Address first, then retry."); return; }
                  try {
                    const r = await fetch(`/api/admin/geocode-distance?address=${encodeURIComponent(loc)}`, { credentials:'include' });
                    if (!r.ok) { adminToast(`Couldn't locate "${loc}", check the address.`); return; }
                    const d = await r.json();
                    const amount = Number.isFinite(rate) ? Math.round(rate * d.distKm * 100) / 100 : li.amount;
                    const description = Number.isFinite(rate)
                      ? `${svcName}, travel (${d.distKm}km from shop to "${loc}" @ $${rate}/km)`
                      : `${svcName}, travel (${d.distKm}km from shop to "${loc}")`;
                    setForm(f => ({...f, lineItems: f.lineItems.map(x => x.id === li.id ? {...x, description, amount} : x)}));
                  } catch { adminToast('Distance lookup failed, try again.'); }
                }}><Icon name="refresh" size={12}/></button>
            )}
            <button className="btn btn-ghost btn-sm" style={{padding:0, color:'var(--rust)'}}
              onClick={() => setForm(f => ({...f, lineItems: f.lineItems.filter(x => x.id !== li.id)}))}><Icon name="x" size={12}/></button>
          </div>
          );
        })}
        <select className="select" value="" onChange={async e => {
          const val = e.target.value;
          if (!val) return;
          e.target.value = '';
          if (val === '__custom__') {
            setForm(f => ({...f, lineItems: [...(f.lineItems||[]), { id: 'li-' + Date.now(), description:'', amount:'', qty:1 }]}));
            return;
          }
          const svc = services.find(s => s.id === val);
          if (!svc) return;
          const items = await buildServiceLineItems(svc, form.loc || form.shippingAddress);
          setForm(f => ({...f, lineItems: [...(f.lineItems||[]), ...items]}));
          if (serviceNeedsPartsExpense(svc)) { setExpenseEdit('new'); setExpenseForm({ ...blankExpense(form.id), description: `${svc.name} - parts` }); }
        }}>
          <option value="">+ Add line item…</option>
          <option value="__custom__">Custom line item</option>
          {Object.entries(
            services.reduce((groups, s) => {
              const cat = s.category || 'Other';
              (groups[cat] = groups[cat] || []).push(s);
              return groups;
            }, {})
          ).sort(([a], [b]) => a.localeCompare(b)).map(([cat, svcs]) => (
            <optgroup key={cat} label={cat}>
              {svcs.map(s => <option key={s.id} value={s.id}>{s.name}{(s.price ?? s.priceLine) ? ` - ${s.price ?? s.priceLine}` : ''}</option>)}
            </optgroup>
          ))}
        </select>
        {(form.lineItems||[]).length > 0 && (
          <div style={{marginTop:8, fontSize:12, color:'var(--ink-3)'}}>Line items total: <strong>${(form.lineItems||[]).reduce((s,i)=>s+liTotal(i),0).toLocaleString('en-AU',{minimumFractionDigits:2})}</strong> - order total below is kept in sync.</div>
        )}
      </div>

      <div className="field">
        <span className="label">Discount</span>
        <div style={{display:'grid', gridTemplateColumns:'110px 1fr', gap:8, marginBottom:8}}>
          <select className="select" value={form.discountType || 'percent'} onChange={e=>setForm({...form, discountType:e.target.value})}>
            <option value="percent">Percent (%)</option>
            <option value="fixed">Dollar ($)</option>
          </select>
          <input className="input" type="number" min="0" step="0.01" placeholder={form.discountType === 'fixed' ? 'e.g. 20.00' : 'e.g. 10'}
            value={form.discountValue || ''} onChange={e=>setForm({...form, discountValue:nonNegInput(e.target.value)})}/>
        </div>
        <input className="input" list="discount-reason-presets" value={form.discountLabel || ''} onChange={e=>setForm({...form, discountLabel:e.target.value})}
          placeholder="Reason (optional), e.g. Multi-service discount, Loyalty discount"/>
        <datalist id="discount-reason-presets">
          {['Multi-service discount','Loyalty discount','Returning customer','Goodwill / service recovery','Staff discount','Bundle discount','Referral discount'].map(l => <option key={l} value={l}/>)}
        </datalist>
        {Number(form.discountAmount) > 0 && (
          <div style={{marginTop:8, fontSize:12, color:'var(--rust)'}}>{form.discountLabel || 'Discount'} applied: <strong>-${Number(form.discountAmount).toLocaleString('en-AU',{minimumFractionDigits:2})}</strong></div>
        )}
      </div>

      <label className="field"><span className="label">Items summary</span><input className="input" value={form.items||''} onChange={e=>setForm({...form,items:e.target.value})} placeholder="Shown in order lists"/></label>

      <label className="field"><span className="label">Fulfilment</span>
        <select className="select" value={form.fulfilment||'pending'} onChange={e=>setForm({...form,fulfilment:e.target.value})}>
          {['pending','ordering','building','testing','packed','shipped','fulfilled','refunded'].map(s => <option key={s}>{s}</option>)}
        </select>
      </label>
      <label className="field">
        <span className="label">Australia Post Tracking Number</span>
        <input className="input" value={form.trackingNumber||''} onChange={e=>setForm({...form,trackingNumber:e.target.value})} placeholder="e.g. 7ABC1234567890" />
      </label>
      {form.trackingNumber && (
        <div style={{marginBottom:14}}>
          <a href={`https://auspost.com.au/mypost/track/#/details/${form.trackingNumber}`} target="_blank" rel="noreferrer" style={{display:'inline-flex', alignItems:'center', gap:4, fontSize:13, color:'var(--rust)'}}>Preview tracking link <Icon name="externalLink" size={11}/></a>
        </div>
      )}

      {(() => {
        const f = form.fulfilment || 'pending';
        if (f === 'testing') return (
          <div style={{padding:'14px', background:'#fff4d6', border:'1px solid #e6cc88', marginBottom:14}}>
            <div className="mono" style={{fontSize:10, color:'#7a5d10', marginBottom:8}}>TESTING COMPLETE?</div>
            <button className="btn btn-sm" style={{background:'#0e4a8c', color:'#fff', border:'none'}} onClick={() => saveNow({ fulfilment:'packed' })}>Mark as Packed <Icon name="chevronRight" size={11}/></button>
          </div>
        );
        if (f === 'packed') return (
          <div style={{padding:'14px', background:'#dceaf5', border:'1px solid #9ec4e8', marginBottom:14}}>
            <div className="mono" style={{fontSize:10, color:'#1668c8', marginBottom:8}}>READY TO SHIP?</div>
            {!form.trackingNumber && <div style={{display:'flex', alignItems:'center', gap:6, fontSize:12, color:'var(--rust)', marginBottom:8}}><Icon name="alertTriangle" size={13}/> Add a tracking number above before marking as shipped.</div>}
            <button className="btn btn-sm" style={{background:'var(--ink)', color:'var(--paper)', border:'none', opacity: form.trackingNumber ? 1 : 0.5}} disabled={!form.trackingNumber} onClick={() => saveNow({ fulfilment:'shipped' })}>Mark as Shipped <Icon name="chevronRight" size={11}/></button>
          </div>
        );
        if (f === 'shipped') return (
          <div style={{padding:'14px', background:'var(--bg-elev)', border:'1px solid var(--line)', marginBottom:14}}>
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8}}>
              <div className="mono" style={{fontSize:10, color:'var(--ink-2)'}}>AUSPOST TRACKING</div>
              <button className="btn btn-ghost btn-sm" style={{fontSize:11}} onClick={checkTracking} disabled={trackingBusy}>{trackingBusy ? 'Checking…' : 'Check now'}</button>
            </div>
            {trackingResult && !trackingResult.error && (
              <div style={{marginBottom:8}}>
                <div style={{fontSize:13, fontWeight:600, marginBottom:4}}>{trackingResult.raw}</div>
                {(trackingResult.events || []).slice(0,3).map((e,i) => (
                  <div key={i} style={{fontSize:11, color:'var(--ink-2)', padding:'3px 0', borderTop: i > 0 ? '1px solid var(--line)' : 'none'}}>
                    {e.date && <span className="mono" style={{color:'var(--ink-3)', marginRight:8}}>{e.date}</span>}
                    {e.description}{e.location ? ` - ${e.location}` : ''}
                  </div>
                ))}
              </div>
            )}
            {trackingResult?.error && <div style={{fontSize:12, color:'var(--rust)', marginBottom:8}}>{trackingResult.error}</div>}
            {form.lastTrackingStatus && !trackingResult && <div style={{fontSize:12, color:'var(--ink-2)', marginBottom:8}}>Last known: <strong>{form.lastTrackingStatus}</strong></div>}
            <button className="btn btn-sm" style={{background:'#345526', color:'#fff', border:'none'}} onClick={() => saveNow({ fulfilment:'fulfilled' })}>Mark as Delivered manually <Icon name="chevronRight" size={11}/></button>
          </div>
        );
        return null;
      })()}

      {(form.parts || []).length > 0 && <>
        <div style={{borderTop:'1px solid var(--line)', margin:'12px 0 16px'}}/>
        <div className="mono" style={{fontSize:10, letterSpacing:'.1em', color:'var(--ink-2)', marginBottom:10}}>PARTS TRACKING</div>
        {(form.parts || []).map((part, i) => {
          const PART_STATUSES = ['pending','ordered','delivered','installed'];
          const statusColors = { pending:'var(--ink-3)', ordered:'#1668c8', delivered:'#7a5d10', installed:'#345526' };
          return (
            <div key={part.id || i} style={{padding:'10px 14px', background:'var(--bg-elev)', border:'1px solid var(--line)', marginBottom:6}}>
              <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', gap:10, flexWrap:'wrap'}}>
                <div style={{flex:1, minWidth:0}}>
                  <div style={{fontWeight:500, fontSize:13}}>{part.name}{part.qty > 1 ? <span style={{color:'var(--ink-3)', fontWeight:400}}> × {part.qty}</span> : ''}</div>
                  {part.orderedAt && <div className="mono" style={{fontSize:10, color:'var(--ink-3)', marginTop:2}}>Ordered {part.orderedAt}{part.deliveredAt ? ` · Delivered ${part.deliveredAt}` : ''}{part.installedAt ? ` · Installed ${part.installedAt}` : ''}</div>}
                </div>
                <div style={{display:'flex', gap:4, flexWrap:'wrap'}}>
                  {PART_STATUSES.map(s => {
                    const active = part.status === s;
                    return (
                      <button key={s} className="btn btn-sm" style={{fontSize:10, padding:'2px 8px', background: active ? statusColors[s] : 'transparent', color: active ? '#fff' : statusColors[s], border:`1px solid ${statusColors[s]}`, cursor: active ? 'default' : 'pointer'}}
                        onClick={() => {
                          if (active) return;
                          const dateStr = new Date().toLocaleDateString('en-AU', { day:'2-digit', month:'short', year:'numeric' });
                          const patch = { status: s };
                          if (s === 'ordered' && !part.orderedAt) patch.orderedAt = dateStr;
                          if (s === 'delivered' && !part.deliveredAt) patch.deliveredAt = dateStr;
                          if (s === 'installed' && !part.installedAt) patch.installedAt = dateStr;
                          setForm(f => {
                            const newParts = f.parts.map((p, pi) => pi === i ? { ...p, ...patch } : p);
                            const STAGE_ORDER = ['pending','ordering','building','testing','packed','shipped','fulfilled','refunded'];
                            const currentStage = STAGE_ORDER.indexOf(f.fulfilment || 'pending');
                            let derived = f.fulfilment || 'pending';
                            if (newParts.some(p => ['ordered','delivered','installed'].includes(p.status))) derived = 'ordering';
                            if (newParts.every(p => ['delivered','installed'].includes(p.status))) derived = 'building';
                            if (newParts.every(p => p.status === 'installed')) derived = 'testing';
                            const derivedStage = STAGE_ORDER.indexOf(derived);
                            const fulfilment = derivedStage > currentStage ? derived : f.fulfilment;
                            const updated = { ...f, parts: newParts, fulfilment };
                            saveNow({ parts: newParts, fulfilment });
                            return updated;
                          });
                        }}
                      >{s}</button>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}
      </>}

      <div style={{borderTop:'1px solid var(--line)', margin:'12px 0 16px'}}/>
      <label className="field"><span className="label">Order Total (AUD){(form.lineItems||[]).length > 0 && <span style={{color:'var(--ink-3)', fontWeight:400}}> - set by line items{Number(form.discountAmount) > 0 ? ' less discount' : ''}</span>}</span>
        <input className="input" type="number" min="0" step="0.01" disabled={(form.lineItems||[]).length > 0} value={form.total||''} onChange={e=>setForm({...form,total:Number(e.target.value)})}/>
      </label>

      <div style={{marginBottom:12}}>
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8}}>
          <div className="mono" style={{fontSize:10, color:'var(--ink-2)'}}>LINKED EXPENSES ({linkedExpenses.length})</div>
          {expenseEdit !== 'new' && <button className="btn btn-ghost btn-sm" style={{fontSize:11}} onClick={() => { setExpenseEdit('new'); setExpenseForm(blankExpense(form.id)); }}>+ Add expense</button>}
        </div>
        {linkedExpenses.length === 0 && expenseEdit !== 'new' && <div className="mono" style={{fontSize:11, color:'var(--ink-3)', marginBottom:8}}>No expenses linked.</div>}
        {linkedExpenses.map(e => (
          <ExpenseRow key={e.id} e={e} isEditing={expenseEdit === e.id} expenseForm={expenseForm}
            setExpenseForm={setExpenseForm} setExpenseEdit={setExpenseEdit} saveExpense={saveExpense} deleteExpense={deleteExpense} />
        ))}
        {expenseEdit === 'new' && (
          <div style={{padding:'12px', background:'var(--paper)', border:'1px solid var(--ochre)', marginBottom:6}}>
            <div className="grid-2" style={{gap:10, marginBottom:10}}>
              <label className="field" style={{margin:0}}><span className="label">Description</span><input className="input" value={expenseForm.description||''} onChange={e=>setExpenseForm(f=>({...f,description:e.target.value}))} autoFocus/></label>
              <label className="field" style={{margin:0}}><span className="label">Amount (AUD, per item)</span><input className="input" type="number" min="0" step="0.01" value={expenseForm.amount||''} onChange={e=>setExpenseForm(f=>({...f,amount:nonNegInput(e.target.value)}))}/></label>
            </div>
            <div className="grid-2" style={{gap:10, marginBottom:10}}>
              <label className="field" style={{margin:0}}><span className="label">Quantity</span>
                <QuantityInput value={expenseForm.quantity} onCommit={q => setExpenseForm(f=>({...f,quantity:q}))}/>
              </label>
              <label className="field" style={{margin:0}}><span className="label">Category</span>
                <select className="select" value={expenseForm.category||'parts'} onChange={e=>setExpenseForm(f=>({...f,category:e.target.value}))}>
                  {['tools','equipment','parts','software','other'].map(c=><option key={c}>{c}</option>)}
                </select>
              </label>
              <label className="field" style={{margin:0}}><span className="label">Part status</span>
                <select className="select" value={expenseForm.partStatus||''} onChange={e=>setExpenseForm(f=>({...f,partStatus:e.target.value}))}>
                  <option value="">N/A</option>
                  {['ordered','arrived','installed','returned'].map(s=><option key={s} value={s}>{s.charAt(0).toUpperCase()+s.slice(1)}</option>)}
                </select>
              </label>
            </div>
            <div className="grid-2" style={{gap:10, marginBottom:10}}>
              <label className="field" style={{margin:0}}><span className="label">Date</span><input className="input" type="date" value={auDateToISO(expenseForm.date)} onChange={e=>setExpenseForm(f=>({...f,date:isoToAuDate(e.target.value)}))}/></label>
              <label className="field" style={{margin:0}}><span className="label">Notes</span><input className="input" value={expenseForm.notes||''} onChange={e=>setExpenseForm(f=>({...f,notes:e.target.value}))}/></label>
            </div>
            <label style={{display:'flex',alignItems:'center',gap:8,cursor:'pointer',marginBottom:12,fontSize:13}}>
              <input type="checkbox" checked={!!expenseForm.isSecondHand} onChange={e=>setExpenseForm(f=>({...f,isSecondHand:e.target.checked}))} style={{width:15,height:15}}/>
              Second-hand
            </label>
            <div style={{display:'flex', gap:8}}>
              <button className="btn btn-sm" onClick={() => saveExpense(expenseForm)}>Save expense</button>
              <button className="btn btn-ghost btn-sm" onClick={() => { setExpenseEdit(null); setExpenseForm({}); }}>Cancel</button>
            </div>
          </div>
        )}
        {linkedExpenses.length > 0 && (
          <div style={{display:'flex', gap:24, padding:'10px 14px', background: profit >= 0 ? '#d8e7d0' : '#f3d5c5', marginTop:4, flexWrap:'wrap'}}>
            <div><div className="mono" style={{fontSize:10, color:'var(--ink-2)'}}>ORDER TOTAL</div><div className="mono" style={{fontSize:14, fontWeight:600, color:'var(--ink-1)'}}>${(Number(form.total)||0).toLocaleString('en-AU',{minimumFractionDigits:2})}</div></div>
            <div><div className="mono" style={{fontSize:10, color:'var(--ink-2)'}}>PAID</div><div className="mono" style={{fontSize:14, fontWeight:600, color:'var(--ink-1)'}}>${amountPaid.toLocaleString('en-AU',{minimumFractionDigits:2})}</div></div>
            <div><div className="mono" style={{fontSize:10, color:'var(--ink-2)'}}>PARTS COST</div><div className="mono" style={{fontSize:14, fontWeight:600, color:'var(--rust)'}}>-${partsCost.toLocaleString('en-AU',{minimumFractionDigits:2})}</div></div>
            {returnedCost > 0 && <div><div className="mono" style={{fontSize:10, color:'#345526'}}>RETURNED</div><div className="mono" style={{fontSize:14, fontWeight:600, color:'#345526'}}>+${returnedCost.toLocaleString('en-AU',{minimumFractionDigits:2})}</div></div>}
            <div><div className="mono" style={{fontSize:10, color: profit >= 0 ? '#345526' : '#7a3a18'}}>PROFIT</div><div className="mono" style={{fontSize:14, fontWeight:600, color: profit >= 0 ? '#345526' : '#7a3a18'}}>${profit.toLocaleString('en-AU',{minimumFractionDigits:2})}</div></div>
            <div><div className="mono" style={{fontSize:10, color:'var(--ink-2)'}}>MARGIN</div><div className="mono" style={{fontSize:14, fontWeight:600, color:'var(--ink-2)'}}>{profitRevenue ? Math.round(profit / profitRevenue * 100) : 0}%</div></div>
          </div>
        )}
      </div>

      <div style={{borderTop:'1px solid var(--line)', margin:'12px 0 16px'}}/>
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10}}>
        <div className="mono" style={{fontSize:10, letterSpacing:'.1em', color:'var(--ink-2)'}}>PAYMENT LOG</div>
        <div style={{display:'flex', gap:8, alignItems:'center'}}>
          <StatusPill value={orderPaymentStatus(form)} map={ORDER_PAYMENT_MAP} />
          {!form.gratis && <span className="mono" style={{fontSize:11}}>
            <span style={{color:'var(--eucalyptus)'}}>paid ${orderAmountPaid(form).toLocaleString()}</span>
            {orderBalance(form) > 0 && <span style={{color:'var(--rust)'}}> · owing ${orderBalance(form).toLocaleString()}</span>}
          </span>}
          <button
            className="btn btn-sm"
            style={form.gratis
              ? {background:'#ede7f6', color:'#4527a0', border:'1px solid #b39ddb', fontSize:11}
              : {background:'transparent', color:'var(--ink-3)', border:'1px solid var(--border)', fontSize:11}}
            onClick={() => saveNow({ gratis: !form.gratis })}
            title={form.gratis ? 'Remove gratis flag, order will appear in reports again' : 'Mark as complimentary, hides from receivables and revenue reports'}>
            {form.gratis ? <><Icon name="check" size={11}/> Gratis, click to unmark</> : 'Mark as Gratis'}
          </button>
          {form.id && (
            <button
              className="btn btn-sm"
              disabled={cancelBusy}
              style={form.cancelled
                ? {background:'#f3d5c5', color:'#7a3a18', border:'1px solid #e3b9a3', fontSize:11}
                : {background:'transparent', color:'var(--ink-3)', border:'1px solid var(--border)', fontSize:11}}
              onClick={toggleCancelled}
              title={form.cancelled ? 'Un-cancel, order will count in reports again' : "Mark cancelled, the work didn't go ahead. Excludes this order and its linked expenses from revenue/tax reports, but keeps the record."}>
              {cancelBusy ? 'Saving…' : form.cancelled ? <><Icon name="check" size={11}/> Cancelled, click to unmark</> : 'Mark as Cancelled'}
            </button>
          )}
        </div>
      </div>
      {form.gratis && (
        <div style={{background:'#ede7f6', border:'1px solid #b39ddb', borderRadius:5, padding:'8px 12px', marginBottom:12, fontSize:12, color:'#4527a0'}}>
          This order is marked <strong>gratis</strong>, it is excluded from revenue, receivables, and GST reports. The price on record is kept for reference only.
        </div>
      )}
      {form.cancelled && (
        <div style={{background:'#f3d5c5', border:'1px solid #e3b9a3', borderRadius:5, padding:'8px 12px', marginBottom:12, fontSize:12, color:'#7a3a18'}}>
          This order is marked <strong>cancelled</strong>, the work never went ahead. It's excluded from revenue, receivables, and tax reports, and so are any expenses linked to it. The record is kept for reference only.
        </div>
      )}
      {!form.gratis && (form.payments || []).length === 0 && <div className="mono" style={{fontSize:11, color:'var(--ink-3)', marginBottom:12}}>No payments recorded.</div>}
      {(form.payments || []).map((p, i) => (
        <div key={i} style={{display:'flex', alignItems:'center', gap:10, padding:'8px 12px', background:'var(--bg-elev)', border:'1px solid var(--line)', marginBottom:6}}>
          <div style={{flex:1}}>
            <span className="mono" style={{fontWeight:600}}>${Number(p.amount).toLocaleString()}</span>
            <span className="mono" style={{fontSize:11, color:'var(--ink-2)', marginLeft:10}}>{p.method}</span>
            {p.note && <span style={{fontSize:12, color:'var(--ink-2)', marginLeft:10}}>{p.note}</span>}
          </div>
          <span className="mono" style={{fontSize:10, color:'var(--ink-3)'}}>{p.date}</span>
          <button className="icon-btn" style={{width:22, height:22, fontSize:14, color:'var(--ink-3)'}} onClick={() => removePayment(i)}>×</button>
        </div>
      ))}
      {!form.gratis && orderBalance(form) > 0 && (
        <button className="btn btn-ghost btn-sm" style={{fontSize:11, marginTop:4, marginBottom:4}}
          onClick={() => setPayEntry(v => ({...v, amount: orderBalance(form).toFixed(2)}))}>
          Pay in full (${orderBalance(form).toLocaleString('en-AU',{minimumFractionDigits:2})})
        </button>
      )}
      <div style={{display:'grid', gridTemplateColumns:'100px 100px 130px 1fr auto', gap:8, alignItems:'end', marginTop:8}}>
        <label className="field" style={{margin:0}}><span className="label">Amount</span><input className="input" type="number" min="0" step="0.01" placeholder="0.00" value={payEntry.amount} onChange={e=>setPayEntry(v=>({...v,amount:nonNegInput(e.target.value)}))}/></label>
        <label className="field" style={{margin:0}}><span className="label">Method</span>
          <select className="select" value={payEntry.method} onChange={e=>setPayEntry(v=>({...v,method:e.target.value}))}>
            {['Cash','Card','Bank Transfer','Crypto','Other'].map(m => <option key={m}>{m}</option>)}
          </select>
        </label>
        <label className="field" style={{margin:0}}><span className="label">Date received</span><input className="input" type="date" max={todayISODate()} value={payEntry.date} onChange={e=>setPayEntry(v=>({...v,date:e.target.value}))}/></label>
        <label className="field" style={{margin:0}}><span className="label">Note (optional)</span><input className="input" placeholder="e.g. deposit, part payment" value={payEntry.note} onChange={e=>setPayEntry(v=>({...v,note:e.target.value}))}/></label>
        <button className="btn btn-sm" style={{marginBottom:1}} onClick={addPayment}>Log</button>
      </div>

      {form.id && !form.gratis && (
        <div style={{marginTop:16, padding:'14px', background:'var(--bg-elev)', border:'1px solid var(--line)'}}>
          <div className="mono" style={{fontSize:10, letterSpacing:'.1em', color:'var(--ink-2)', marginBottom:10}}>PAYMENT PLAN</div>
          {form.paymentPlan && form.paymentPlan.status === 'active' ? (() => {
            const progress = paymentPlanProgress(form);
            return (
              <>
                <div style={{fontSize:12, color:'var(--ink-2)', marginBottom:10}}>
                  {progress.completed
                    ? 'Fully paid off.'
                    : <>{progress.entries.filter(e=>e.status==='paid').length} of {progress.entries.length} instalments paid · next <strong>${progress.nextDue.amount.toLocaleString('en-AU',{minimumFractionDigits:2})}</strong> due {new Date(progress.nextDue.dueDate+'T00:00:00').toLocaleDateString('en-AU',{day:'2-digit',month:'short',year:'numeric'})}</>}
                  {' · '}{form.paymentPlan.frequency} · {{manual:'staff-collected', customer:'customer pays in portal', auto:'auto-charged'}[form.paymentPlan.collectionMethod]}
                </div>
                <div style={{border:'1px solid var(--line)', marginBottom:10}}>
                  {progress.entries.map((e, i) => (
                    <div key={i} style={{display:'flex', justifyContent:'space-between', alignItems:'center', padding:'6px 10px', borderBottom: i < progress.entries.length-1 ? '1px solid var(--line)' : 'none', fontSize:12}}>
                      <span className="mono" style={{color:'var(--ink-3)'}}>{new Date(e.dueDate+'T00:00:00').toLocaleDateString('en-AU',{day:'2-digit',month:'short',year:'numeric'})}</span>
                      <span className="mono" style={{fontWeight:600}}>${e.amount.toLocaleString('en-AU',{minimumFractionDigits:2})}</span>
                      <span className={`tag ${e.status==='paid'?'tag-green':e.status==='overdue'?'tag-red':'tag-outline'}`} style={{fontSize:10}}>{e.status.toUpperCase()}</span>
                    </div>
                  ))}
                </div>
                {canManagePlan && !progress.completed && (
                  <button className="btn btn-ghost btn-sm" style={{color:'var(--rust)'}} disabled={planBusy} onClick={cancelPlan}>Cancel plan</button>
                )}
              </>
            );
          })() : form.paymentPlan && form.paymentPlan.status === 'cancelled' ? (
            <div style={{fontSize:12, color:'var(--ink-3)'}}>Payment plan cancelled.</div>
          ) : canManagePlan ? (
            <>
              <div style={{display:'grid', gridTemplateColumns:'110px 130px 170px 130px auto', gap:8, alignItems:'end', marginBottom:8}}>
                <label className="field" style={{margin:0}}><span className="label">Instalment $</span>
                  <input className="input" type="number" min="0" step="0.01" placeholder="0.00" value={planForm.installmentAmount} onChange={e=>setPlanForm(v=>({...v,installmentAmount:nonNegInput(e.target.value)}))}/></label>
                <label className="field" style={{margin:0}}><span className="label">Frequency</span>
                  <select className="select" value={planForm.frequency} onChange={e=>setPlanForm(v=>({...v,frequency:e.target.value}))}>
                    <option value="weekly">Weekly</option>
                    <option value="fortnightly">Fortnightly</option>
                    <option value="monthly">Monthly</option>
                  </select>
                </label>
                <label className="field" style={{margin:0}}><span className="label">Collection</span>
                  <select className="select" value={planForm.collectionMethod} onChange={e=>setPlanForm(v=>({...v,collectionMethod:e.target.value}))}>
                    <option value="manual">Staff collects</option>
                    <option value="customer" disabled={!cardLookup?.exists}>Customer pays in portal{!cardLookup?.exists ? ' (needs portal account)' : ''}</option>
                    <option value="auto" disabled={!cardLookup?.hasCard}>Auto-charge saved card{!cardLookup?.hasCard ? ' (needs saved card)' : ''}</option>
                  </select>
                </label>
                <label className="field" style={{margin:0}}><span className="label">Start date</span>
                  <input className="input" type="date" value={planForm.startDate} onChange={e=>setPlanForm(v=>({...v,startDate:e.target.value}))}/></label>
                <button className="btn btn-sm" style={{marginBottom:1}} disabled={planBusy} onClick={savePlan}>{planBusy ? 'Saving…' : 'Create plan'}</button>
              </div>
              {!cardLookup?.exists && form.email && (
                <div style={{fontSize:11, color:'var(--ink-3)', marginBottom:8}}>No portal account found for this email yet, only staff-collected is available.</div>
              )}
              {cardLookup?.exists && !cardLookup?.hasCard && (
                <div style={{fontSize:11, color:'var(--ink-3)', marginBottom:8}}>This customer has no saved card yet, auto-charge isn't available until they add one in the portal.</div>
              )}
              {planError && <div style={{fontSize:12, color:'#b91c1c'}}>{planError}</div>}
            </>
          ) : (
            <div style={{fontSize:12, color:'var(--ink-3)'}}>Only managers can set up a payment plan.</div>
          )}
        </div>
      )}

      {form.id && (
        <div style={{marginTop:16, padding:'14px', background:'#fbeae1', border:'1px solid #e3b9a3'}}>
          <div className="mono" style={{fontSize:10, letterSpacing:'.1em', color:'#7a3a18', marginBottom:10}}>REFUND</div>
          {form.refund ? (
            <div style={{fontSize:13, color:'#7a3a18'}}>
              Refunded <strong>${Number(form.refund.amount).toLocaleString('en-AU',{minimumFractionDigits:2})}</strong> via {form.refund.method === 'stripe' ? 'Stripe (original payment)' : form.refund.method === 'cash' ? 'cash' : 'store credit'} on {new Date(form.refund.date).toLocaleDateString('en-AU',{day:'2-digit',month:'short',year:'numeric'})}.
            </div>
          ) : (
            <>
              <div style={{fontSize:12, color:'var(--ink-2)', marginBottom:10}}>Ask the customer whether they want their money back or store credit, then choose below. The customer is emailed automatically and the order is marked refunded.</div>
              {maxRefund > 0 && (
                <button className="btn btn-ghost btn-sm" style={{fontSize:11, marginBottom:8}}
                  onClick={() => setRefundEntry(v => ({...v, amount: maxRefund.toFixed(2)}))}>
                  Refund in full (${maxRefund.toLocaleString('en-AU',{minimumFractionDigits:2})})
                </button>
              )}
              <div style={{display:'grid', gridTemplateColumns:'1fr 120px auto', gap:8, alignItems:'end'}}>
                <label className="field" style={{margin:0}}><span className="label">Method</span>
                  <select className="select" value={refundEntry.method} onChange={e=>setRefundEntry(v=>({...v,method:e.target.value}))}>
                    <option value="stripe">Money back (Stripe)</option>
                    <option value="cash">Cash</option>
                    <option value="store-credit">Store credit</option>
                  </select>
                </label>
                <label className="field" style={{margin:0}}><span className="label">Amount</span><input className="input" type="number" min="0" max={maxRefund.toFixed(2)} step="0.01" placeholder={Number(form.total||0).toFixed(2)} value={refundEntry.amount} onChange={e=>setRefundEntry(v=>({...v,amount:nonNegInput(e.target.value)}))}/></label>
                <button className="btn btn-sm" style={{background:'#7a3a18', color:'#fff', border:'none', marginBottom:1}} onClick={doRefund} disabled={refundBusy}>{refundBusy ? 'Processing…' : 'Issue Refund'}</button>
              </div>
              {refundEntry.method === 'store-credit' && <div style={{fontSize:11, color:'var(--ink-3)', marginTop:6}}>Store credit requires the customer to have an account with email {form.email || '(none set)'}.</div>}
              {refundError && <div style={{fontSize:12, color:'#b91c1c', marginTop:8}}>{refundError}</div>}
            </>
          )}
        </div>
      )}

      <div style={{borderTop:'1px solid var(--line)', margin:'16px 0 16px'}}/>
      <div className="mono" style={{fontSize:10, letterSpacing:'.1em', color:'var(--ink-2)', marginBottom:10}}>ORDER UPDATES (VISIBLE TO CUSTOMER)</div>
      {(form.updates || []).length === 0 && <div className="mono" style={{fontSize:11, color:'var(--ink-3)', marginBottom:12}}>No updates posted.</div>}
      {(form.updates || []).map((u, i) => (
        <div key={i} style={{display:'flex', alignItems:'flex-start', gap:10, padding:'8px 12px', background:'var(--bg-elev)', border:'1px solid var(--line)', marginBottom:6}}>
          <div style={{flex:1}}>
            <span className="tag tag-outline" style={{fontSize:10, marginRight:8}}>{u.type}</span>
            <span style={{fontSize:13}}>{u.text}</span>
          </div>
          <span className="mono" style={{fontSize:10, color:'var(--ink-3)', whiteSpace:'nowrap'}}>{u.date}</span>
          <button className="icon-btn" style={{width:22, height:22, fontSize:14, color:'var(--ink-3)'}} onClick={() => removeUpdate(i)}>×</button>
        </div>
      ))}
      <div style={{display:'grid', gridTemplateColumns:'130px 1fr auto', gap:8, alignItems:'end', marginTop:8}}>
        <label className="field" style={{margin:0}}><span className="label">Type</span>
          <select className="select" value={updateEntry.type} onChange={e=>setUpdateEntry(v=>({...v,type:e.target.value}))}>
            {['note','parts_arrived','parts_ordered','build_started','ready_for_pickup','dispatched'].map(t => <option key={t} value={t}>{t.replace(/_/g,' ')}</option>)}
          </select>
        </label>
        <label className="field" style={{margin:0}}><span className="label">Message</span><input className="input" placeholder="e.g. RAM and SSD have arrived, waiting on GPU" value={updateEntry.text} onChange={e=>setUpdateEntry(v=>({...v,text:e.target.value}))} onKeyDown={e=>e.key==='Enter'&&addUpdate()}/></label>
        <button className="btn btn-sm" style={{marginBottom:1}} onClick={addUpdate}>Post</button>
      </div>
    </OrderPage>
  );
}

// ============================================================
// ORDERS
// ============================================================
function AdminOrders({ search, sessionInfo, siteUrl }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expenses, setExpenses] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [services, setServices] = useState([]);
  const [edit, setEdit] = useState(null);
  const [statusTab, setStatusTab] = useUrlState('tab', 'all');
  const [openId, setOpenId] = useUrlState('open', null, { push: true });
  const [dateRange, setDateRange] = useState({ from: '', to: '' });
  useEffect(() => {
    fetch('/api/admin/orders', { credentials:'include' })
      .then(r => r.ok ? r.json() : Promise.reject()).then(d => setRows(d.items || [])).catch(() => setRows([])).finally(() => setLoading(false));
    fetch('/api/admin/expenses', { credentials:'include' })
      .then(r => r.ok ? r.json() : Promise.reject()).then(d => setExpenses(d.items || [])).catch(() => {});
    fetch('/api/admin/customers', { credentials:'include' })
      .then(r => r.ok ? r.json() : Promise.reject()).then(d => setCustomers(d.items || [])).catch(() => {});
    fetch('/api/admin/catalog', { credentials:'include' })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(d => setServices((d.services || []).filter(s => s.status === 'published')))
      .catch(() => {});
  }, []);

  const q = (search || '').toLowerCase().trim();
  const visibleRows = useMemo(() => {
    let out = rows;
    if (q) out = out.filter(r =>
      (r.id || '').toLowerCase().includes(q) ||
      (r.cust || '').toLowerCase().includes(q) ||
      (r.items || '').toLowerCase().includes(q) ||
      (r.loc || '').toLowerCase().includes(q)
    );
    if (statusTab !== 'all') {
      out = out.filter(r => ['shipped','refunded'].includes(statusTab)
        ? (r.fulfilment || 'pending') === statusTab
        : statusTab === 'gratis' ? !!r.gratis
        : statusTab === 'cancelled' ? !!r.cancelled
        : orderPaymentStatus(r) === statusTab);
    }
    if (dateRange.from || dateRange.to) {
      const fromTs = dateRange.from ? new Date(dateRange.from + 'T00:00:00').getTime() : -Infinity;
      const toTs = dateRange.to ? new Date(dateRange.to + 'T23:59:59').getTime() : Infinity;
      out = out.filter(r => {
        const d = parseOrderDate(r.createdAt || r.date);
        if (!d) return false;
        return d.getTime() >= fromTs && d.getTime() <= toTs;
      });
    }
    return out;
  }, [rows, q, statusTab, dateRange]);

  const tabCounts = useMemo(() => ({
    all: rows.length,
    unpaid: rows.filter(r => orderPaymentStatus(r) === 'unpaid').length,
    'part-paid': rows.filter(r => orderPaymentStatus(r) === 'part-paid').length,
    paid: rows.filter(r => orderPaymentStatus(r) === 'paid').length,
    gratis: rows.filter(r => r.gratis).length,
    cancelled: rows.filter(r => r.cancelled).length,
    shipped: rows.filter(r => (r.fulfilment||'pending') === 'shipped').length,
    refunded: rows.filter(r => (r.fulfilment||'pending') === 'refunded').length,
  }), [rows]);

  // Fills the lowest deleted/unused number first (e.g. OE-0031 reopens after being
  // deleted, even with OE-0035 already on file) rather than always incrementing
  // past every gap.
  const nextOrderId = () => {
    const used = new Set(rows.map(o => { const m = String(o.id || '').match(/^OE-(\d+)$/); return m ? parseInt(m[1]) : null; }).filter(n => n != null));
    let n = 1;
    while (used.has(n)) n++;
    return `OE-${String(n).padStart(4, '0')}`;
  };

  const blankOrder = () => ({ id:'', suggestedId: nextOrderId(), cust:'', email:'', phone:'', loc:'', items:'', lineItems:[], date: todayOrderDate(), total:0, discountType:'percent', discountValue:'', discountAmount:0, fulfilment:'pending', payments:[], parts:[], updates:[] });

  const openRow = (r) => setOpenId(r.id);

  // Reconcile the open order drawer with the URL's `open` param (restore on
  // reload + Back/Forward). `new` opens a blank order; an id opens that order.
  useEffect(() => {
    const cur = edit === null ? null : (edit.id || 'new');
    if (openId === cur) return;
    if (openId == null) { setEdit(null); return; }
    if (openId === 'new') { setEdit(blankOrder()); return; }
    const r = rows.find(x => x.id === openId);
    if (r) setEdit(r);
  }, [openId, rows]);

  if (edit !== null) {
    return (
      <OrderDrawer
        edit={edit}
        expenses={expenses}
        customers={customers}
        services={services}
        sessionInfo={sessionInfo}
        siteUrl={siteUrl}
        onClose={() => setOpenId(null)}
        onRowUpdate={(updated) => setRows(rs => rs.map(r => r.id === (edit.id || updated.id) ? updated : r))}
        onSave={(saved, isNew) => {
          if (isNew) setRows(rs => [saved, ...rs]);
          else setRows(rs => rs.map(r => r.id === edit.id ? saved : r));
          setOpenId(null);
        }}
        onExpensesChange={setExpenses}
        onCustomerCreated={(cust) => setCustomers(cs => cs.some(c => c.id === cust.id) ? cs.map(c => c.id === cust.id ? cust : c) : [...cs, cust])}
        onDelete={(id) => setRows(rs => rs.filter(r => r.id !== id))}
      />
    );
  }

  return (
    <div style={{padding:32}}>
      <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14, flexWrap:'wrap', gap:10}}>
        <div className="tabs tabs-row" style={{margin:0}}>
          {[['all','All'],['unpaid','Unpaid'],['part-paid','Part paid'],['paid','Paid'],['gratis','Gratis'],['cancelled','Cancelled'],['shipped','Shipped'],['refunded','Refunded']].map(([k,l]) => (
            <div key={k} role="button" tabIndex={0} className={`tab ${statusTab===k?'active':''}`} style={{cursor:'pointer'}}
              onClick={() => setStatusTab(k)}
              onKeyDown={e => { if (e.key==='Enter'||e.key===' ') { e.preventDefault(); setStatusTab(k); } }}>{l} ({tabCounts[k]})</div>
          ))}
        </div>
        <button className="btn btn-rust btn-sm" onClick={() => setOpenId('new')}>+ New order</button>
      </div>
      <div className="row-flex" style={{gap:8, marginBottom:14, alignItems:'center'}}>
        <span className="mono" style={{fontSize:10, letterSpacing:'.08em', color:'var(--ink-2)'}}>DATE RANGE</span>
        <input className="input" type="date" aria-label="Orders from date" style={{width:150, padding:'5px 8px', fontSize:12}} value={dateRange.from} onChange={e => setDateRange(r => ({ ...r, from: e.target.value }))} />
        <span style={{color:'var(--ink-3)', display:'inline-flex'}}><Icon name="chevronRight" size={12}/></span>
        <input className="input" type="date" aria-label="Orders to date" style={{width:150, padding:'5px 8px', fontSize:12}} value={dateRange.to} onChange={e => setDateRange(r => ({ ...r, to: e.target.value }))} />
        {(dateRange.from || dateRange.to) && (
          <button className="btn btn-ghost btn-sm" onClick={() => setDateRange({ from:'', to:'' })}>Clear</button>
        )}
      </div>
      <Table
        loading={loading}
        columns={[
          { key:'id', label:'Order #', w:'140px', sort:true, render:r => <span className="mono" style={{fontSize:12, color:'var(--rust)'}}>{r.id}</span> },
          { key:'cust', label:'Customer', w:'1.5fr', sort:true },
          { key:'items', label:'Items', w:'2fr', render:r => <span style={{fontSize:13}}>{r.items}</span> },
          { key:'total', label:'Total', w:'90px', sort:r => Number(r.total) || 0, render:r => <span className="mono" style={{fontWeight:600}}>${(Number(r.total)||0).toLocaleString('en-AU',{minimumFractionDigits:2,maximumFractionDigits:2})}</span> },
          { key:'balance', label:'Balance', w:'90px', sort:r => orderBalance(r), render:r => {
            if (r.gratis) return <span className="mono" style={{fontSize:11, color:'#4527a0', fontWeight:700}}>GRATIS</span>;
            const b = orderBalance(r);
            return b <= 0.005
              ? <span className="mono" style={{fontSize:11, color:'var(--eucalyptus)'}}>CLEAR</span>
              : <span className="mono" style={{fontSize:12, color:'var(--rust)', fontWeight:600}}>${b.toLocaleString('en-AU',{minimumFractionDigits:2,maximumFractionDigits:2})}</span>;
          }},
          { key:'payment', label:'Payment', w:'100px', sort:r => orderPaymentStatus(r), render:r => <StatusPill value={orderPaymentStatus(r)} map={ORDER_PAYMENT_MAP} /> },
          { key:'fulfilment', label:'Fulfilment', w:'110px', sort:r => r.fulfilment || 'pending', render:r => { const legacyFul = ['packed','shipped','fulfilled','refunded'].includes(r.status) ? r.status : null; return <StatusPill value={r.fulfilment || legacyFul || 'pending'} map={ORDER_FULFILMENT_MAP} />; } },
          { key:'date', label:'When', w:'110px', sort:r => { const d = parseOrderDate(r.createdAt || r.date); return d ? d.getTime() : 0; }, render:r => <span className="mono" style={{fontSize:11, color:'var(--ink-2)'}}>{fmtOrderDate(r.date).toUpperCase()}</span> },
        ]}
        rows={visibleRows}
        onRowClick={openRow}
        defaultSort={{ key: 'id', dir: 'desc' }}
      />
    </div>
  );
}


// ============================================================
// REPAIRS - Kanban
// ============================================================
const DEFAULT_REPAIR_COLS = [
  { id:'intake',     label:'Intake',     cards:[] },
  { id:'diagnosis',  label:'Diagnosis',  cards:[] },
  { id:'in-progress',label:'In Progress',cards:[] },
  { id:'waiting',    label:'Waiting',    cards:[] },
  { id:'done',       label:'Done',       cards:[] },
];

function RepairJobDrawer({ card, expenses, customers, staff, onSave, onDelete, onExpensesChange, onCustomerCreated, onClose }) {
  const PARTS_MARGIN = 0.20;
  const [form, setForm] = useState(() => ({
    t:           card.t || '',
    who:         card.who || '',
    tag:         card.tag || '',
    customer:    card.customer || card.name || '',
    email:       card.email || '',
    phone:       card.phone || '',
    dateIn:      card.dateIn || new Date().toISOString().slice(0, 10),
    dateEst:     card.dateEst || '',
    device:      card.device || '',
    condition:   card.condition || '',
    findings:    card.findings || '',
    diagnostics: card.diagnostics || '',
    techNotes:   card.techNotes || '',
    lineItems:   card.lineItems || [],
    payments:    card.payments || [],
    notes:       card.notes || '',
  }));
  const findCustomerMatch = () => {
    const email = (card.email || '').toLowerCase().trim();
    const name  = (card.customer || card.name || '').toLowerCase().trim();
    return (customers || []).find(x =>
      (email && (x.email||'').toLowerCase().trim() === email) ||
      (name  && (x.name ||'').toLowerCase().trim() === name)
    );
  };
  const [selectedCustomerId, setSelectedCustomerId] = useState(() => { const m = findCustomerMatch(); return m ? m.id : ''; });
  const [customerQuery, setCustomerQuery] = useState(() => { const m = findCustomerMatch(); return m ? `${m.name}${m.email ? ` (${m.email})` : ''}` : ''; });
  const [customerDropdownOpen, setCustomerDropdownOpen] = useState(false);
  const applyCustomer = (c) => {
    setSelectedCustomerId(c ? c.id : '');
    setCustomerQuery(c ? `${c.name}${c.email ? ` (${c.email})` : ''}` : '');
    setCustomerDropdownOpen(false);
    if (c) setForm(f => ({ ...f, customer: c.name || f.customer, email: c.email || f.email, phone: c.phone || f.phone }));
  };
  const customerMatches = useMemo(() => {
    const q = customerQuery.trim().toLowerCase();
    if (!q) return (customers || []).slice(0, 8);
    return (customers || []).filter(c => (c.name||'').toLowerCase().includes(q) || (c.email||'').toLowerCase().includes(q) || (c.phone||'').toLowerCase().includes(q)).slice(0, 8);
  }, [customers, customerQuery]);
  const [expenseEdit, setExpenseEdit] = useState(null);
  const [expenseForm, setExpenseForm] = useState({});
  const [payEntry, setPayEntry] = useState({ amount:'', method:'Cash', note:'', date: todayISODate() });
  const savedSnapRef = React.useRef(JSON.stringify(card));
  const dirty = JSON.stringify({ ...card, ...form }) !== savedSnapRef.current;

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const linkedExpenses = (expenses || []).filter(e => e.jobId && e.jobId === card.id);
  const partsCost = linkedExpenses.reduce((s, e) => s + (e.partStatus === 'returned' ? 0 : expTotal(e)), 0);

  const recalcTotal = (expList) => {
    const cost = (expList || []).filter(e => e.jobId && e.jobId === card.id)
      .reduce((s, e) => s + (e.partStatus === 'returned' ? 0 : expTotal(e)), 0);
    const partsCharge = Math.round(cost * (1 + PARTS_MARGIN) * 100) / 100;
    setForm(f => {
      const others = (f.lineItems || []).filter(li => li.id !== 'parts-auto');
      const lineItems = partsCharge > 0
        ? [...others, { id: 'parts-auto', description: 'Parts & materials', amount: partsCharge }]
        : others;
      return { ...f, lineItems };
    });
  };

  React.useEffect(() => {
    const expectedCharge = Math.round(partsCost * (1 + PARTS_MARGIN) * 100) / 100;
    const existingCharge = Number((form.lineItems || []).find(li => li.id === 'parts-auto')?.amount) || 0;
    if (expectedCharge !== existingCharge) recalcTotal(expenses);
  }, [card.id]);

  const lineTotal = Math.round((form.lineItems || []).reduce((s, li) => s + liTotal(li), 0) * 100) / 100;
  const amountPaid = orderAmountPaid(form);
  const balance = Math.round((lineTotal - amountPaid) * 100) / 100;

  const blankExpense = () => ({
    description: '', category: 'parts', amount: '', quantity: 1,
    date: new Date().toLocaleDateString('en-AU', { day:'2-digit', month:'2-digit', year:'numeric' }),
    notes: '', isSecondHand: false, partStatus: '', jobId: card.id,
  });

  const saveExpense = async (exp) => {
    const payload = { ...exp, amount: Number(exp.amount) || 0 };
    const r = await fetch('/api/admin/expenses/save', { method:'POST', headers:postHeaders(), credentials:'include', body:JSON.stringify(payload) }).catch(()=>null);
    if (r && r.ok) {
      const d = await r.json();
      const newExpenses = (expenses||[]).find(e => e.id === payload.id)
        ? (expenses||[]).map(e => e.id === payload.id ? d.item : e)
        : [...(expenses||[]), d.item];
      onExpensesChange(newExpenses);
      recalcTotal(newExpenses);
    }
    setExpenseEdit(null); setExpenseForm({});
  };

  const deleteExpense = async (id) => {
    if (!(await adminConfirm('Delete this expense? This cannot be undone.', { title:'Delete expense', confirmLabel:'Delete', danger:true }))) return;
    const r = await fetch('/api/admin/expenses/delete', { method:'POST', headers:postHeaders(), credentials:'include', body:JSON.stringify({ id }) }).catch(()=>null);
    if (!r || !r.ok) { adminToast('Failed to delete expense.'); return; }
    const newExpenses = (expenses||[]).filter(e => e.id !== id);
    onExpensesChange(newExpenses);
    recalcTotal(newExpenses);
    setExpenseEdit(null); setExpenseForm({});
  };

  const addPayment = () => {
    const amt = Number(payEntry.amount);
    if (!amt || amt <= 0) return;
    const isCash = payEntry.method === 'Cash';
    const finalAmt = isCash ? cashRound(amt) : Math.round(amt * 100) / 100;
    const payment = { amount: finalAmt, method: payEntry.method, note: payEntry.note, date: orderDateFromISO(payEntry.date) };
    setForm(f => ({ ...f, payments: [...(f.payments||[]), payment] }));
    setPayEntry({ amount:'', method:'Cash', note:'', date: todayISODate() });
  };

  const handleSave = async () => {
    const updated = { ...card, ...form, name: form.customer, total: lineTotal || undefined };
    savedSnapRef.current = JSON.stringify(updated);
    if (!selectedCustomerId && form.customer.trim()) {
      const emailL = form.email.toLowerCase();
      const nameL  = form.customer.toLowerCase();
      const exists = (customers||[]).find(x => (x.email||'').toLowerCase()===emailL || (x.name||'').toLowerCase()===nameL);
      if (!exists) {
        const cr = await fetch('/api/admin/customers/save', { method:'POST', headers:postHeaders(), credentials:'include',
          body: JSON.stringify({ name:form.customer.trim(), email:form.email||'', phone:form.phone||'' }) }).catch(()=>null);
        if (cr && cr.ok) { const cd = await cr.json(); if (cd.item) onCustomerCreated?.(cd.item); }
      }
    }
    onSave(updated);
  };

  const S = { mb12:{ marginBottom:12 }, mt20:{ marginTop:20, marginBottom:12 } };
  return (
    <OrderPage onClose={onClose} dirty={dirty} backLabel="Back to Repairs"
      title={<span><span className="mono" style={{fontSize:11,color:'var(--rust)',marginRight:8}}>{card.id}</span>{form.t||'Repair Job'}</span>}
      footer={<div className="row-flex" style={{justifyContent:'space-between'}}>
        <button className="btn btn-ghost btn-sm" style={{color:'var(--rust)',borderColor:'var(--rust)'}}
          onClick={async () => {
            const ok = await adminConfirm(`Delete job ${card.id}? This cannot be undone.`, { title:'Delete repair job', confirmLabel:'Delete', danger:true });
            if (ok) onDelete(card.id);
          }}>Delete job</button>
        <div className="row-flex" style={{gap:8}}>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>Cancel</button>
          <button className="btn btn-rust btn-sm" onClick={handleSave}>Save changes</button>
        </div>
      </div>}>

      {/* ── Customer ── */}
      <div className="eyebrow" style={S.mb12}>Customer</div>
      <label className="field" style={{...S.mb12, position:'relative'}}><span className="label">Select existing or add new</span>
        <input className="input" placeholder="Search by name, email, or phone…" value={customerQuery}
          onChange={e => { setCustomerQuery(e.target.value); setCustomerDropdownOpen(true); if (selectedCustomerId) setSelectedCustomerId(''); }}
          onFocus={() => setCustomerDropdownOpen(true)}
          onBlur={() => setTimeout(() => setCustomerDropdownOpen(false), 150)}
        />
        {customerDropdownOpen && (
          <div style={{position:'absolute', top:'100%', left:0, right:0, zIndex:20, background:'var(--bg)', border:'1px solid var(--line)', boxShadow:'0 4px 12px rgba(0,0,0,.12)', maxHeight:240, overflowY:'auto'}}>
            <div role="button" tabIndex={0} onMouseDown={e => { e.preventDefault(); applyCustomer(null); }}
              style={{padding:'8px 12px', fontSize:13, cursor:'pointer', color:'var(--rust)', borderBottom:'1px solid var(--line)'}}>+ New customer{customerQuery.trim() ? ` "${customerQuery.trim()}"` : ''}</div>
            {customerMatches.length === 0 && <div style={{padding:'8px 12px', fontSize:12, color:'var(--ink-3)'}}>No matching customers.</div>}
            {customerMatches.map(c => (
              <div key={c.id} role="button" tabIndex={0} onMouseDown={e => { e.preventDefault(); applyCustomer(c); }} style={{padding:'8px 12px', fontSize:13, cursor:'pointer'}}>
                <div style={{fontWeight:600}}>{c.name}</div>
                <div style={{fontSize:11, color:'var(--ink-3)'}}>{[c.email, c.phone].filter(Boolean).join(' · ') || '-'}</div>
              </div>
            ))}
          </div>
        )}
      </label>
      <div className="grid-2" style={S.mb12}>
        <label className="field"><span className="label">{selectedCustomerId ? 'Customer name' : 'New customer name'}<ReqMark/></span>
          <input className="input" value={form.customer} onChange={e=>set('customer',e.target.value)} /></label>
        <label className="field"><span className="label">Phone</span>
          <input className="input" type="tel" value={form.phone} onChange={e=>set('phone',e.target.value)} placeholder="0400 000 000" /></label>
      </div>
      <label className="field" style={S.mb12}><span className="label">Email, status notifications &amp; portal access</span>
        <input className="input" type="email" value={form.email} onChange={e=>set('email',e.target.value)} placeholder="customer@example.com" /></label>

      {/* ── Job ── */}
      <div className="eyebrow" style={S.mt20}>Job</div>
      <label className="field" style={S.mb12}><span className="label">Description / fault reported<ReqMark/></span>
        <input className="input" value={form.t} onChange={e=>set('t',e.target.value)} placeholder="e.g. Toughbook 55, keyboard ribbon fault" /></label>
      <div className="grid-2" style={S.mb12}>
        <label className="field"><span className="label">Device / model</span>
          <input className="input" value={form.device} onChange={e=>set('device',e.target.value)} placeholder="e.g. Panasonic Toughbook 55" /></label>
        <label className="field"><span className="label">Assigned technician</span>
          <select className="select" value={form.who} onChange={e=>set('who',e.target.value)}>
            <option value="">(Unassigned)</option>
            {(staff||[]).map(m => <option key={m.id||m.name} value={m.name}>{m.name}</option>)}
          </select></label>
      </div>
      <div className="grid-2" style={S.mb12}>
        <label className="field"><span className="label">Date received</span>
          <input className="input" type="date" value={form.dateIn} onChange={e=>set('dateIn',e.target.value)} /></label>
        <label className="field"><span className="label">Est. completion</span>
          <input className="input" type="date" value={form.dateEst} onChange={e=>set('dateEst',e.target.value)} /></label>
      </div>
      <div className="grid-2" style={S.mb12}>
        <label className="field"><span className="label">Tag</span>
          <input className="input" value={form.tag} onChange={e=>set('tag',e.target.value)} placeholder="e.g. URGENT, WARRANTY" /></label>
        <label className="field"><span className="label">Condition on receipt</span>
          <input className="input" value={form.condition} onChange={e=>set('condition',e.target.value)} placeholder="e.g. Fair - cracked screen" /></label>
      </div>

      {/* ── Diagnostics ── */}
      <div className="eyebrow" style={S.mt20}>Diagnostics</div>
      <label className="field" style={S.mb12}><span className="label">Findings</span>
        <textarea className="textarea" rows={3} value={form.findings} onChange={e=>set('findings',e.target.value)} placeholder="What was found - e.g. Keyboard ribbon disconnected at left connector" /></label>
      <label className="field" style={S.mb12}><span className="label">Diagnostic notes, tests run &amp; results</span>
        <textarea className="textarea" rows={3} value={form.diagnostics} onChange={e=>set('diagnostics',e.target.value)} placeholder="e.g. POST passes, keyboard not detected in BIOS, HDD SMART OK" /></label>
      <label className="field" style={S.mb12}><span className="label">Technician notes</span>
        <textarea className="textarea" rows={3} value={form.techNotes} onChange={e=>set('techNotes',e.target.value)} placeholder="Work performed, observations, follow-up actions..." /></label>

      {/* ── Parts / Expenses ── */}
      <div className="eyebrow" style={S.mt20}>Parts &amp; Expenses</div>
      <div style={{fontSize:12,color:'var(--ink-3)',marginBottom:10}}>Parts cost + 20% margin is auto-added as a line item below.</div>
      {linkedExpenses.map(e => (
        <ExpenseRow key={e.id} e={e} isEditing={expenseEdit===e.id} expenseForm={expenseForm} setExpenseForm={setExpenseForm}
          setExpenseEdit={setExpenseEdit} saveExpense={saveExpense} deleteExpense={deleteExpense} />
      ))}
      {expenseEdit === 'new'
        ? <ExpenseRow e={expenseForm} isEditing={true} expenseForm={expenseForm} setExpenseForm={setExpenseForm}
            setExpenseEdit={setExpenseEdit} saveExpense={saveExpense} deleteExpense={() => { setExpenseEdit(null); setExpenseForm({}); }} />
        : <button className="btn btn-ghost btn-sm" style={{marginBottom:8}} onClick={() => { setExpenseEdit('new'); setExpenseForm(blankExpense()); }}>+ Add expense / part</button>
      }
      {partsCost > 0 && (
        <div style={{fontSize:12,color:'var(--ink-2)',marginBottom:8}}>
          Cost: <strong>${partsCost.toFixed(2)}</strong> → charged at cost+20%: <strong>${(Math.round(partsCost*1.2*100)/100).toFixed(2)}</strong>
        </div>
      )}

      {/* ── Line items ── */}
      <div className="eyebrow" style={S.mt20}>Line Items (Labour &amp; Services)</div>
      {(form.lineItems||[]).map(li => (
        <div key={li.id} style={{display:'grid',gridTemplateColumns:'1fr 56px 90px 28px',gap:8,marginBottom:8,alignItems:'center'}}>
          <input className="input" placeholder="e.g. Labour - 2hr diagnostic" value={li.description}
            onChange={e=>setForm(f=>({...f,lineItems:f.lineItems.map(x=>x.id===li.id?{...x,description:e.target.value}:x)}))}
            style={{fontSize:12}} disabled={li.id==='parts-auto'} />
          <input className="input" type="number" min="1" step="1" placeholder="Qty" value={li.qty||1}
            onChange={e=>setForm(f=>({...f,lineItems:f.lineItems.map(x=>x.id===li.id?{...x,qty:Math.max(1,parseInt(e.target.value)||1)}:x)}))}
            style={{fontSize:12}} disabled={li.id==='parts-auto'} />
          <input className="input" type="number" min="0" step="0.01" placeholder="Price" value={li.amount}
            onChange={e=>setForm(f=>({...f,lineItems:f.lineItems.map(x=>x.id===li.id?{...x,amount:nonNegInput(e.target.value)}:x)}))}
            style={{fontSize:12}} disabled={li.id==='parts-auto'} />
          {li.id==='parts-auto'
            ? <span style={{fontSize:10,color:'var(--ink-3)',textAlign:'center'}}>auto</span>
            : <button className="btn btn-ghost btn-sm" style={{padding:0,color:'var(--rust)'}}
                onClick={()=>setForm(f=>({...f,lineItems:f.lineItems.filter(x=>x.id!==li.id)}))}><Icon name="x" size={12}/></button>}
        </div>
      ))}
      <div className="row-flex" style={{marginBottom:8}}>
        <button className="btn btn-ghost btn-sm"
          onClick={()=>setForm(f=>({...f,lineItems:[...(f.lineItems||[]),{id:'li-'+Date.now(),description:'',amount:'',qty:1}]}))}>+ Add line item</button>
        {lineTotal > 0 && <span className="mono" style={{fontSize:12,fontWeight:600}}>TOTAL: ${lineTotal.toLocaleString('en-AU',{minimumFractionDigits:2})}</span>}
      </div>

      {/* ── Payments ── */}
      <div className="eyebrow" style={S.mt20}>Payments</div>
      {(form.payments||[]).map((p,i) => (
        <div key={i} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'7px 10px',background:'var(--bg-elev)',border:'1px solid var(--line)',marginBottom:6}}>
          <div>
            <span className="mono" style={{fontSize:12,fontWeight:600,color:'var(--eucalyptus)'}}>+${Number(p.amount).toFixed(2)}</span>
            <span style={{fontSize:12,color:'var(--ink-2)',marginLeft:10}}>{p.method}</span>
            {p.note && <span style={{fontSize:12,color:'var(--ink-3)',marginLeft:8}}>{p.note}</span>}
          </div>
          <div style={{display:'flex',alignItems:'center',gap:8}}>
            <span className="mono" style={{fontSize:10,color:'var(--ink-3)'}}>{p.date}</span>
            <button className="btn btn-ghost btn-sm" style={{padding:'2px 6px',fontSize:11,color:'var(--rust)'}}
              onClick={()=>setForm(f=>({...f,payments:f.payments.filter((_,idx)=>idx!==i)}))}><Icon name="x" size={12}/></button>
          </div>
        </div>
      ))}
      <div style={{display:'grid', gridTemplateColumns:'100px 100px 130px 1fr auto', gap:8, alignItems:'end', marginBottom:8}}>
        <label className="field" style={{margin:0}}><span className="label">Amount</span><input className="input" type="number" min="0" step="0.01" placeholder="0.00" value={payEntry.amount} onChange={e=>setPayEntry(p=>({...p,amount:nonNegInput(e.target.value)}))}/></label>
        <label className="field" style={{margin:0}}><span className="label">Method</span>
          <select className="select" value={payEntry.method} onChange={e=>setPayEntry(p=>({...p,method:e.target.value}))}>
            {['Cash','Card','Bank transfer','Invoice'].map(m=><option key={m}>{m}</option>)}
          </select>
        </label>
        <label className="field" style={{margin:0}}><span className="label">Date received</span><input className="input" type="date" max={todayISODate()} value={payEntry.date} onChange={e=>setPayEntry(p=>({...p,date:e.target.value}))}/></label>
        <label className="field" style={{margin:0}}><span className="label">Note (optional)</span><input className="input" placeholder="e.g. deposit, part payment" value={payEntry.note} onChange={e=>setPayEntry(p=>({...p,note:e.target.value}))}/></label>
        <button className="btn btn-sm" style={{marginBottom:1}} onClick={addPayment}>Log</button>
      </div>
      {lineTotal > 0 && (
        <div style={{padding:'10px 14px',background:balance<=0.005?'#d8e7d0':'var(--bg-deep)',marginBottom:4}}>
          <span className="mono" style={{fontSize:13,fontWeight:600,color:balance<=0.005?'#345526':'var(--ink)'}}>
            {balance<=0.005
              ? `PAID IN FULL - $${lineTotal.toLocaleString('en-AU',{minimumFractionDigits:2})}`
              : `BALANCE: $${balance.toLocaleString('en-AU',{minimumFractionDigits:2})} of $${lineTotal.toLocaleString('en-AU',{minimumFractionDigits:2})}`}
          </span>
        </div>
      )}

      {/* ── Notes ── */}
      <div className="eyebrow" style={S.mt20}>Internal Notes</div>
      <label className="field"><span className="label">Not visible to customer</span>
        <textarea className="textarea" rows={3} value={form.notes} onChange={e=>set('notes',e.target.value)} placeholder="Staff-only notes..." /></label>
    </OrderPage>
  );
}

function AdminRepairs() {
  const [cols, setCols] = useState(DEFAULT_REPAIR_COLS);
  const [expenses, setExpenses] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [staff, setStaff] = useState([]);
  const [editCard, setEditCard] = useState(null);
  const [dragOverCol, setDragOverCol] = useState(null);
  const [openId, setOpenId] = useUrlState('open', null, { push: true });

  // Reconcile the open job editor with the URL's `open` param (restore on
  // reload + Back/Forward), same as Orders/Quotes/Expenses.
  useEffect(() => {
    const cur = editCard ? editCard.card.id : null;
    if (openId === cur) return;
    if (openId == null) { setEditCard(null); return; }
    for (const c of cols) {
      const card = (c.cards || []).find(cd => cd.id === openId);
      if (card) { setEditCard({ card, colId: c.id }); return; }
    }
  }, [openId, cols]);

  useEffect(() => {
    fetch('/api/admin/repairs', { credentials:'include' })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(d => { if ((d.columns||[]).length) setCols(d.columns); else setCols(DEFAULT_REPAIR_COLS); })
      .catch(() => setCols(DEFAULT_REPAIR_COLS));
    fetch('/api/admin/expenses', { credentials:'include' })
      .then(r => r.ok ? r.json() : Promise.reject()).then(d => setExpenses(d.items||[])).catch(()=>{});
    fetch('/api/admin/customers', { credentials:'include' })
      .then(r => r.ok ? r.json() : Promise.reject()).then(d => setCustomers(d.items||[])).catch(()=>{});
    fetch('/api/admin/staff', { credentials:'include' })
      .then(r => r.ok ? r.json() : Promise.reject()).then(d => setStaff(d.members||[])).catch(()=>{});
  }, []);

  const openCount = cols.filter(c => c.id !== 'done').reduce((s, c) => s + (c.cards||[]).length, 0);

  const nextId = async () => {
    const r = await fetch('/api/admin/repairs/next-id', { credentials:'include' }).catch(()=>null);
    if (r && r.ok) { const d = await r.json(); return d.id; }
    const allCards = cols.flatMap(c => c.cards||[]);
    const maxN = allCards.reduce((mx, c) => { const m = String(c.id||'').match(/^REP-(\d+)$/); return m?Math.max(mx,parseInt(m[1])):mx; }, 0);
    return `REP-${String(maxN+1).padStart(4,'0')}`;
  };

  const persist = async (updated) => {
    const r = await fetch('/api/admin/repairs/save', { method:'POST', headers:postHeaders(), credentials:'include', body:JSON.stringify({ columns:updated }) }).catch(()=>null);
    return r && r.ok;
  };

  const newCard = async (colId) => {
    const id = await nextId();
    const card = { id, t:'New job', who:'', age:'0h', dateIn:new Date().toISOString().slice(0,10) };
    const updated = cols.map(c => c.id===colId ? { ...c, cards:[...(c.cards||[]),card] } : c);
    setCols(updated);
    setOpenId(id);
    await persist(updated);
  };

  const saveCard = async (updatedCard) => {
    const updated = cols.map(c => ({ ...c, cards:(c.cards||[]).map(cd => cd.id===updatedCard.id ? updatedCard : cd) }));
    setCols(updated);
    setOpenId(null);
    const ok = await persist(updated);
    if (!ok) adminToast('Save failed, check your connection.'); else adminToast('Job saved.','success');
  };

  const deleteCard = async (cardId) => {
    const updated = cols.map(c => ({ ...c, cards:(c.cards||[]).filter(cd => cd.id!==cardId) }));
    setCols(updated);
    setOpenId(null);
    const ok = await persist(updated);
    if (!ok) adminToast('Delete may not have saved.'); else adminToast('Job deleted.','success');
  };

  const moveCard = async (cardId, fromId, toId) => {
    if (!cardId || fromId===toId) return;
    let moved = null;
    const without = cols.map(c => c.id===fromId
      ? { ...c, cards:(c.cards||[]).filter(cd => { if(cd.id===cardId){moved=cd;return false;}return true; }) }
      : c);
    if (!moved) return;
    const updated = without.map(c => c.id===toId ? { ...c, cards:[...(c.cards||[]),moved] } : c);
    const prev = cols;
    setCols(updated);
    const ok = await persist(updated);
    if (!ok) { setCols(prev); adminToast('Failed to move job.'); }
    else adminToast(`Moved to ${updated.find(c=>c.id===toId)?.label||toId}.`,'success');
  };

  if (editCard) {
    return (
      <RepairJobDrawer
        card={editCard.card}
        expenses={expenses}
        customers={customers}
        staff={staff}
        onSave={saveCard}
        onDelete={deleteCard}
        onExpensesChange={setExpenses}
        onCustomerCreated={c => setCustomers(cs => [...cs, c])}
        onClose={() => setOpenId(null)}
      />
    );
  }

  return (
    <div style={{padding:32}}>
      <div className="row-flex" style={{justifyContent:'space-between', marginBottom:18}}>
        <div className="mono" style={{fontSize:12,color:'var(--ink-2)'}}>{openCount} OPEN</div>
        <button className="btn btn-rust btn-sm" onClick={() => newCard((cols[0]||{}).id)}>+ New job</button>
      </div>
      <div className="admin-kanban-grid" style={{display:'grid',gridTemplateColumns:'repeat(5,minmax(240px,1fr))',gap:16,minWidth:1200}}>
        {cols.map(c => (
          <div key={c.id}
            onDragOver={e=>{e.preventDefault();e.dataTransfer.dropEffect='move';setDragOverCol(c.id);}}
            onDragLeave={e=>{if(!e.currentTarget.contains(e.relatedTarget))setDragOverCol(cur=>cur===c.id?null:cur);}}
            onDrop={e=>{e.preventDefault();setDragOverCol(null);try{const{cardId,from}=JSON.parse(e.dataTransfer.getData('text/plain')||'{}');moveCard(cardId,from,c.id);}catch{}}}
            style={{outline:dragOverCol===c.id?'2px dashed var(--ochre)':'none',outlineOffset:4}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline',marginBottom:10}}>
              <span className="eyebrow">{c.label}</span>
              <span className="mono" style={{fontSize:11,color:'var(--ink-3)'}}>{(c.cards||[]).length}</span>
            </div>
            <div style={{display:'grid',gap:10,minHeight:40}}>
              {(c.cards||[]).map(card => {
                const paid = orderAmountPaid(card) >= (Number(card.total)||0) && (Number(card.total)||0) > 0;
                return (
                  <div key={card.id} draggable
                    onDragStart={e=>{e.dataTransfer.setData('text/plain',JSON.stringify({cardId:card.id,from:c.id}));e.dataTransfer.effectAllowed='move';}}
                    onClick={()=>setOpenId(card.id)}
                    title="Click to view / edit"
                    style={{padding:14,background:'var(--paper)',border:'1px solid var(--line)',cursor:'pointer'}}>
                    <div className="row-flex" style={{justifyContent:'space-between'}}>
                      <span className="mono" style={{fontSize:10,color:'var(--rust)'}}>{card.id}</span>
                      <div className="row-flex" style={{gap:4}}>
                        {paid && <span className="tag" style={{fontSize:9,color:'var(--eucalyptus)',borderColor:'var(--eucalyptus)'}}>PAID</span>}
                        {card.tag && <span className="tag" style={{fontSize:9}}>{card.tag}</span>}
                      </div>
                    </div>
                    <div style={{fontSize:13,marginTop:6,fontWeight:500,lineHeight:1.3}}>{card.t}</div>
                    {(card.customer||card.name) && <div style={{fontSize:11,color:'var(--ink-2)',marginTop:3}}>{card.customer||card.name}</div>}
                    <div className="mono" style={{fontSize:10,color:'var(--ink-2)',marginTop:8,display:'flex',justifyContent:'space-between'}}>
                      <span>{(card.who||'').toUpperCase()}</span>
                      <span>{card.total?`$${Number(card.total).toFixed(2)}`:(card.age||'').toUpperCase()}</span>
                    </div>
                  </div>
                );
              })}
              <button className="btn btn-ghost btn-sm" style={{justifyContent:'center',borderStyle:'dashed',color:'var(--ink-3)'}} onClick={()=>newCard(c.id)}>+ Card</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}


// ============================================================
// QUOTES, identical model/UI to Orders (customer combobox, service-driven
// lineItems, discount, standalone full page), with OEQ-xxxx refs instead of
// OE-xxxx and no payments/fulfilment section since nothing's been sold yet.
// ============================================================
function nextQuoteRefClient(quotes) {
  const used = new Set((quotes || []).map(q => { const m = String(q.quoteRef || '').match(/^OEQ-(\d+)$/); return m ? parseInt(m[1]) : null; }).filter(n => n != null));
  let n = 1;
  while (used.has(n)) n++;
  return `OEQ-${String(n).padStart(4, '0')}`;
}

function QuotePage({ edit, quotes, customers, services = [], onClose, onSave, onDelete, onCustomerCreated }) {
  const [form, setForm] = useState({ ...edit, quoteRef: edit.quoteRef || nextQuoteRefClient(quotes) });
  const findCustomerMatch = (q) => {
    const email = (q.email || '').toLowerCase().trim();
    const name = (q.cust || '').toLowerCase().trim();
    return (customers || []).find(x =>
      (email && (x.email || '').toLowerCase().trim() === email) ||
      (name && (x.name || '').toLowerCase().trim() === name)
    );
  };
  const [selectedCustomerId, setSelectedCustomerId] = useState(() => { const m = findCustomerMatch(edit); return m ? m.id : ''; });
  const [customerQuery, setCustomerQuery] = useState(() => { const m = findCustomerMatch(edit); return m ? `${m.name}${m.email ? ` (${m.email})` : ''}` : ''; });
  const [customerDropdownOpen, setCustomerDropdownOpen] = useState(false);
  const applyCustomer = (c) => {
    setSelectedCustomerId(c ? c.id : '');
    const typed = customerQuery.trim();
    setCustomerQuery(c ? `${c.name}${c.email ? ` (${c.email})` : ''}` : '');
    setCustomerDropdownOpen(false);
    if (c) setForm(f => ({ ...f, cust: c.name || f.cust, email: c.email || f.email, phone: c.phone || f.phone, loc: c.loc || f.loc, shippingAddress: c.shippingAddress || f.shippingAddress }));
    else if (typed && !form.cust) setForm(f => ({ ...f, cust: typed }));
  };
  const customerMatches = useMemo(() => {
    const q = customerQuery.trim().toLowerCase();
    if (!q) return (customers || []).slice(0, 8);
    return (customers || []).filter(c => (c.name||'').toLowerCase().includes(q) || (c.email||'').toLowerCase().includes(q) || (c.phone||'').toLowerCase().includes(q)).slice(0, 8);
  }, [customers, customerQuery]);

  const savedSnapRef = React.useRef(JSON.stringify({ ...edit }));
  const dirty = JSON.stringify(form) !== savedSnapRef.current;

  React.useEffect(() => {
    if (!form.lineItems || form.lineItems.length === 0) return;
    const lineItemsTotal = Math.round(form.lineItems.reduce((s,i)=>s+liTotal(i),0) * 100) / 100;
    const discountAmount = discountAmountFor(lineItemsTotal, form.discountType, form.discountValue);
    const total = Math.round((lineItemsTotal - discountAmount) * 100) / 100;
    if (total !== Number(form.total) || discountAmount !== Number(form.discountAmount || 0)) {
      setForm(f => ({ ...f, total, discountAmount }));
    }
  }, [form.lineItems, form.discountType, form.discountValue]);

  // Planned expenses (parts staff intend to buy but haven't yet, nothing's
  // purchased, so there's no real expenses.db entry) get the same cost+20%
  // margin treatment as Orders' linked-expenses auto line item, kept in sync
  // under the same 'parts-auto' id so it becomes a real expense cleanly once
  // this quote converts to an order.
  const PARTS_MARGIN = 0.20;
  React.useEffect(() => {
    const cost = (form.plannedExpenses || []).reduce((s, e) => s + (Number(e.amount) || 0) * (Number(e.quantity) || 1), 0);
    const partsCharge = Math.round(cost * (1 + PARTS_MARGIN) * 100) / 100;
    setForm(f => {
      const others = (f.lineItems || []).filter(li => li.id !== 'parts-auto');
      const lineItems = partsCharge > 0 ? [...others, { id: 'parts-auto', description: 'Parts', amount: partsCharge, qty: 1 }] : others;
      if (JSON.stringify(lineItems) === JSON.stringify(f.lineItems || [])) return f;
      return { ...f, lineItems };
    });
  }, [form.plannedExpenses]);

  const [busy, setBusy] = useState(null); // 'save' | 'send' | 'convert' | 'delete' | 'pdf'
  const [err, setErr] = useState(null);

  const validateLineItems = () => {
    const blank = (form.lineItems || []).find(li => li.description && (li.amount === '' || li.amount == null || Number.isNaN(Number(li.amount))));
    if (blank) { adminToast(`"${blank.description}" has no price set, confirm it before saving.`); return false; }
    return true;
  };

  const persistNewCustomerIfNeeded = async () => {
    if (selectedCustomerId || !form.cust || !form.cust.trim() || findCustomerMatch(form)) return;
    const cr = await fetch('/api/admin/customers/save', { method:'POST', headers:postHeaders(), credentials:'include',
      body: JSON.stringify({ name: form.cust.trim(), email: form.email||'', phone: form.phone||'', loc: form.loc||'', shippingAddress: form.shippingAddress||'' }) }).catch(()=>null);
    if (cr && cr.ok) { const cd = await cr.json(); if (cd.item) onCustomerCreated?.(cd.item); }
  };

  const doSave = async () => {
    if (!validateLineItems()) return;
    setBusy('save'); setErr(null);
    await persistNewCustomerIfNeeded();
    const r = await fetch('/api/admin/quotes/save', { method:'POST', headers:postHeaders(), credentials:'include', body: JSON.stringify(form) }).catch(()=>null);
    setBusy(null);
    if (!r || !r.ok) { setErr('Failed to save, please try again.'); return; }
    const d = await r.json();
    savedSnapRef.current = JSON.stringify(d.item || form);
    onSave(d.item || form, !edit.id);
  };

  const doSend = async () => {
    if (!form.email) { setErr('Customer email is required to send a quote.'); return; }
    if (!isValidEmail(form.email)) { setErr('Customer email looks invalid, please check it.'); return; }
    if (!validateLineItems()) return;
    setBusy('send'); setErr(null);
    await persistNewCustomerIfNeeded();
    const r = await fetch('/api/admin/quotes/send', { method:'POST', headers:postHeaders(), credentials:'include', body: JSON.stringify(form) }).catch(()=>null);
    setBusy(null);
    if (!r || !r.ok) { setErr('Failed to send, check SMTP settings in Settings → Integrations.'); return; }
    const d = await r.json();
    savedSnapRef.current = JSON.stringify(d.item || form);
    adminToast(`Quote sent to ${form.email}.`, 'success');
    onSave(d.item || form, !edit.id);
  };

  const doConvertToOrder = async () => {
    if (!(await adminConfirm(`This will create a real order from quote ${form.quoteRef || form.id} and mark it won.`, { title: 'Convert to order', confirmLabel: 'Convert to order' }))) return;
    setBusy('convert'); setErr(null);
    const orderPayload = {
      _isNew: true,
      cust: form.cust || '', email: form.email || '', phone: form.phone || '',
      loc: form.loc || '', shippingAddress: form.shippingAddress || '',
      items: (form.lineItems || []).map(i => i.description).filter(Boolean).join(', ') || form.quoteRef || 'Order',
      lineItems: form.lineItems || [],
      discountType: form.discountType, discountValue: form.discountValue, discountAmount: form.discountAmount,
      notes: form.notes || '',
      date: todayOrderDate(), total: form.total || 0, fulfilment: 'pending', payments: [],
      sourceQuoteId: form.id, quoteRef: form.quoteRef || '',
    };
    const or = await fetch('/api/admin/orders/save', { method:'POST', headers:postHeaders(), credentials:'include', body: JSON.stringify(orderPayload) }).catch(()=>null);
    if (!or || !or.ok) { setBusy(null); setErr('Failed to create the order, quote was not touched.'); return; }
    const od = await or.json();
    // Planned expenses were never real, this is the moment they become actual
    // costs, now that there's a real order to link them to for tax reporting.
    if (od.item?.id && (form.plannedExpenses || []).length > 0) {
      await Promise.all(form.plannedExpenses.map(pe => fetch('/api/admin/expenses/save', { method:'POST', headers:postHeaders(), credentials:'include',
        body: JSON.stringify({ ...pe, jobId: od.item.id, date: pe.date || new Date().toLocaleDateString('en-AU',{day:'2-digit',month:'2-digit',year:'numeric'}) }) }).catch(()=>null)));
    }
    const updated = { ...form, status: 'won', orderId: od.item?.id };
    const qr = await fetch('/api/admin/quotes/save', { method:'POST', headers:postHeaders(), credentials:'include', body: JSON.stringify(updated) }).catch(()=>null);
    setBusy(null);
    if (!qr || !qr.ok) { adminToast(`Order ${od.item?.id} was created, but the quote couldn't be marked won.`); }
    adminToast(`Converted to order ${od.item?.id}.`, 'success');
    onSave(qr && qr.ok ? (await qr.json()).item : updated, false);
  };

  const doDelete = async () => {
    if (!(await adminConfirm(`Delete quote ${form.quoteRef || form.id}? This cannot be undone.`, { title: 'Delete quote', confirmLabel: 'Delete', danger: true }))) return;
    setBusy('delete');
    const r = await fetch('/api/admin/quotes/delete', { method:'POST', headers:postHeaders(), credentials:'include', body: JSON.stringify({ id: form.id }) }).catch(()=>null);
    setBusy(null);
    if (!r || !r.ok) { adminToast('Failed to delete quote.'); return; }
    onDelete?.(form.id);
    onClose();
  };

  const doPdf = async () => {
    setBusy('pdf');
    const r = await fetch('/api/admin/quotes/pdf', { method:'POST', headers:postHeaders(), credentials:'include', body: JSON.stringify(form) }).catch(()=>null);
    setBusy(null);
    if (!r || !r.ok) { adminToast('Failed to generate PDF.'); return; }
    const blob = await r.blob();
    window.open(URL.createObjectURL(blob), '_blank');
  };

  return (
    <OrderPage onClose={onClose} dirty={dirty} backLabel="Back to Quotes" title={edit.id ? `Quote ${form.quoteRef || edit.id}` : 'New quote'}
      footer={<div className="row-flex" style={{gap:8, justifyContent:'space-between'}}>
        <div className="row-flex" style={{gap:8}}>
          {edit.id && <button className="btn btn-ghost btn-sm" disabled={busy==='pdf'} onClick={doPdf}><Icon name="printer" size={14}/>{busy==='pdf'?'Generating…':'Print PDF'}</button>}
          {edit.id && form.status !== 'won' && <button className="btn btn-ghost btn-sm" disabled={busy==='convert'} onClick={doConvertToOrder}><Icon name="refresh" size={14}/>{busy==='convert'?'Converting…':'Convert to order'}</button>}
          {edit.id && <button className="btn btn-ghost btn-sm" style={{color:'var(--rust)'}} disabled={busy==='delete'} onClick={doDelete}><Icon name="trash" size={14}/>{busy==='delete'?'Deleting…':'Delete quote'}</button>}
        </div>
        <div className="row-flex" style={{gap:8}}>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>Cancel</button>
          <button className="btn btn-ghost btn-sm" disabled={busy==='save'} onClick={doSave}>{busy==='save'?'Saving…':'Save draft'}</button>
          <button className="btn btn-sm" disabled={busy==='send'} onClick={doSend}>{busy==='send'?'Sending…':'Send to customer'}</button>
        </div>
      </div>}
    >
      {err && <div style={{marginBottom:14, padding:'10px 14px', background:'#fbeae1', border:'1px solid #e3b9a3', color:'#7a3a18', fontSize:13}}>{err}</div>}
      <label className="field"><span className="label">Quote Reference</span><input className="input" style={{fontFamily:'monospace', fontWeight:700}} value={form.quoteRef||''} onChange={e=>setForm({...form,quoteRef:e.target.value})}/></label>
      <label className="field" style={{position:'relative'}}><span className="label">Customer<ReqMark/></span>
        <input className="input" placeholder="Search by name, email, or phone…" value={customerQuery}
          onChange={e => { setCustomerQuery(e.target.value); setCustomerDropdownOpen(true); if (selectedCustomerId) setSelectedCustomerId(''); }}
          onFocus={() => setCustomerDropdownOpen(true)}
          onBlur={() => setTimeout(() => setCustomerDropdownOpen(false), 150)}
        />
        {customerDropdownOpen && (
          <div style={{position:'absolute', top:'100%', left:0, right:0, zIndex:20, background:'var(--bg)', border:'1px solid var(--line)', boxShadow:'0 4px 12px rgba(0,0,0,.12)', maxHeight:240, overflowY:'auto'}}>
            <div role="button" tabIndex={0} onMouseDown={e => { e.preventDefault(); applyCustomer(null); }}
              style={{padding:'8px 12px', fontSize:13, cursor:'pointer', color:'var(--rust)', borderBottom:'1px solid var(--line)'}}>+ New customer{customerQuery.trim() ? ` "${customerQuery.trim()}"` : ''}</div>
            {customerMatches.length === 0 && <div style={{padding:'8px 12px', fontSize:12, color:'var(--ink-3)'}}>No matching customers.</div>}
            {customerMatches.map(c => (
              <div key={c.id} role="button" tabIndex={0} onMouseDown={e => { e.preventDefault(); applyCustomer(c); }} style={{padding:'8px 12px', fontSize:13, cursor:'pointer'}}>
                <div style={{fontWeight:600}}>{c.name}</div>
                <div style={{fontSize:11, color:'var(--ink-3)'}}>{[c.email, c.phone].filter(Boolean).join(' · ') || '-'}</div>
              </div>
            ))}
          </div>
        )}
      </label>
      <label className="field"><span className="label">{selectedCustomerId ? 'Customer name' : 'New customer name'}<ReqMark/></span><input className="input" value={form.cust||''} onChange={e=>setForm({...form,cust:e.target.value})}/></label>
      <label className="field"><span className="label">Email</span><input className="input" type="email" value={form.email||''} onChange={e=>setForm({...form,email:e.target.value})}/></label>
      <label className="field"><span className="label">Phone</span><input className="input" type="tel" value={form.phone||''} onChange={e=>setForm({...form,phone:e.target.value})}/></label>
      <label className="field"><span className="label">Shipping Address</span><input className="input" value={form.shippingAddress||''} onChange={e=>setForm({...form,shippingAddress:e.target.value})} placeholder="Street, City, State, Postcode"/>
        <div style={{fontSize:11, color:'var(--ink-3)', marginTop:4}}>Where a physical order gets posted.</div>
      </label>
      <label className="field"><span className="label">Location</span><input className="input" value={form.loc||''} onChange={e=>setForm({...form,loc:e.target.value})} placeholder="e.g. suburb or full address"/>
        <div style={{fontSize:11, color:'var(--ink-3)', marginTop:4}}>Used for callout distance. Falls back to Shipping Address if left blank.</div>
      </label>
      <label className="field"><span className="label">Valid for (days)</span><input className="input" type="number" min="1" value={form.validDays||30} onChange={e=>setForm({...form,validDays:Number(e.target.value)})}/></label>

      <div className="field">
        <span className="label">Line items</span>
        {(form.lineItems||[]).map(li => {
          const isHourly = li.kind === 'hourly';
          const needsRecalc = !!li.needsDistanceRecalc;
          return (
          <div key={li.id} style={{display:'grid', gridTemplateColumns: needsRecalc ? '1fr 60px 110px 28px 28px' : '1fr 60px 110px 28px', gap:8, marginBottom:8}}>
            <input className="input" placeholder="e.g. Custom software development" value={li.description}
              onChange={e => setForm(f => ({...f, lineItems: f.lineItems.map(x => x.id === li.id ? {...x, description: e.target.value} : x)}))}/>
            <input className="input" type="number" min="1" step="1" placeholder={isHourly ? 'Hrs' : 'Qty'} value={li.qty||1}
              onChange={e => setForm(f => ({...f, lineItems: f.lineItems.map(x => x.id === li.id ? {...x, qty: Math.max(1, parseInt(e.target.value)||1)} : x)}))}/>
            <input className="input" type="number" min="0" step="0.01" placeholder="Price ea." value={li.amount}
              onChange={e => setForm(f => ({...f, lineItems: f.lineItems.map(x => x.id === li.id ? {...x, amount: nonNegInput(e.target.value)} : x)}))}/>
            {needsRecalc && (
              <button className="btn btn-ghost btn-sm" style={{padding:0}} title="Recalculate distance from the quote's Location (or Shipping Address if Location is blank)"
                onClick={async () => {
                  const svcName = li.serviceName || 'Callout';
                  const rate = li.kmRate;
                  const loc = (form.loc || form.shippingAddress || '').trim();
                  if (!loc) { adminToast("Add the quote's Location or Shipping Address first, then retry."); return; }
                  try {
                    const r = await fetch(`/api/admin/geocode-distance?address=${encodeURIComponent(loc)}`, { credentials:'include' });
                    if (!r.ok) { adminToast(`Couldn't locate "${loc}", check the address.`); return; }
                    const d = await r.json();
                    const amount = Number.isFinite(rate) ? Math.round(rate * d.distKm * 100) / 100 : li.amount;
                    const description = Number.isFinite(rate)
                      ? `${svcName}, travel (${d.distKm}km from shop to "${loc}" @ $${rate}/km)`
                      : `${svcName}, travel (${d.distKm}km from shop to "${loc}")`;
                    setForm(f => ({...f, lineItems: f.lineItems.map(x => x.id === li.id ? {...x, description, amount} : x)}));
                  } catch { adminToast('Distance lookup failed, try again.'); }
                }}><Icon name="refresh" size={12}/></button>
            )}
            <button className="btn btn-ghost btn-sm" style={{padding:0, color:'var(--rust)'}}
              onClick={() => setForm(f => ({...f, lineItems: f.lineItems.filter(x => x.id !== li.id)}))}><Icon name="x" size={12}/></button>
          </div>
          );
        })}
        <select className="select" value="" onChange={async e => {
          const val = e.target.value;
          if (!val) return;
          e.target.value = '';
          if (val === '__custom__') {
            setForm(f => ({...f, lineItems: [...(f.lineItems||[]), { id: 'li-' + Date.now(), description:'', amount:'', qty:1 }]}));
            return;
          }
          const svc = services.find(s => s.id === val);
          if (!svc) return;
          const items = await buildServiceLineItems(svc, form.loc || form.shippingAddress);
          setForm(f => ({...f, lineItems: [...(f.lineItems||[]), ...items]}));
        }}>
          <option value="">+ Add line item…</option>
          <option value="__custom__">Custom line item</option>
          {Object.entries(
            services.reduce((groups, s) => { const cat = s.category || 'Other'; (groups[cat] = groups[cat] || []).push(s); return groups; }, {})
          ).sort(([a], [b]) => a.localeCompare(b)).map(([cat, svcs]) => (
            <optgroup key={cat} label={cat}>
              {svcs.map(s => <option key={s.id} value={s.id}>{s.name}{(s.price ?? s.priceLine) ? ` - ${s.price ?? s.priceLine}` : ''}</option>)}
            </optgroup>
          ))}
        </select>
        {(form.lineItems||[]).length > 0 && (
          <div style={{marginTop:8, fontSize:12, color:'var(--ink-3)'}}>Line items total: <strong>${(form.lineItems||[]).reduce((s,i)=>s+liTotal(i),0).toLocaleString('en-AU',{minimumFractionDigits:2})}</strong> - quote total below is kept in sync.</div>
        )}
      </div>

      <div className="field">
        <span className="label">Discount</span>
        <div style={{display:'grid', gridTemplateColumns:'110px 1fr', gap:8, marginBottom:8}}>
          <select className="select" value={form.discountType || 'percent'} onChange={e=>setForm({...form, discountType:e.target.value})}>
            <option value="percent">Percent (%)</option>
            <option value="fixed">Dollar ($)</option>
          </select>
          <input className="input" type="number" min="0" step="0.01" placeholder={form.discountType === 'fixed' ? 'e.g. 20.00' : 'e.g. 10'}
            value={form.discountValue || ''} onChange={e=>setForm({...form, discountValue:nonNegInput(e.target.value)})}/>
        </div>
        <input className="input" list="discount-reason-presets" value={form.discountLabel || ''} onChange={e=>setForm({...form, discountLabel:e.target.value})}
          placeholder="Reason (optional), e.g. Multi-service discount, Loyalty discount"/>
        <datalist id="discount-reason-presets">
          {['Multi-service discount','Loyalty discount','Returning customer','Goodwill / service recovery','Staff discount','Bundle discount','Referral discount'].map(l => <option key={l} value={l}/>)}
        </datalist>
        {Number(form.discountAmount) > 0 && (
          <div style={{marginTop:8, fontSize:12, color:'var(--rust)'}}>{form.discountLabel || 'Discount'} applied: <strong>-${Number(form.discountAmount).toLocaleString('en-AU',{minimumFractionDigits:2})}</strong></div>
        )}
      </div>

      <label className="field"><span className="label">Total (AUD){(form.lineItems||[]).length > 0 && <span style={{color:'var(--ink-3)', fontWeight:400}}> - set by line items{Number(form.discountAmount) > 0 ? ' less discount' : ''}</span>}</span>
        <input className="input" type="number" min="0" step="0.01" disabled={(form.lineItems||[]).length > 0} value={form.total||''} onChange={e=>setForm({...form,total:Number(e.target.value)})}/>
      </label>

      <div className="field">
        <span className="label">Parts (your cost, {PARTS_MARGIN*100}% margin auto-added to the "Parts" line item above)</span>
        {(form.plannedExpenses||[]).map((pe, i) => (
          <div key={i} style={{display:'grid', gridTemplateColumns:'2fr 60px 130px 28px', gap:8, marginBottom:8, alignItems:'center'}}>
            <input className="input" placeholder="e.g. Ryzen 7 5800X CPU" value={pe.description||''}
              onChange={e => setForm(f => ({...f, plannedExpenses: f.plannedExpenses.map((x,xi) => xi===i ? {...x, description:e.target.value} : x)}))}/>
            <input className="input" type="number" min="1" step="1" placeholder="Qty" value={pe.quantity||1}
              onChange={e => setForm(f => ({...f, plannedExpenses: f.plannedExpenses.map((x,xi) => xi===i ? {...x, quantity: Math.max(1, parseInt(e.target.value)||1)} : x)}))}/>
            <div style={{position:'relative'}}>
              <span style={{position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', fontSize:13, color:'var(--ink-2)', pointerEvents:'none'}}>$</span>
              <input className="input" type="number" min="0" step="0.01" placeholder="0.00 (your cost)" value={pe.amount}
                onChange={e => setForm(f => ({...f, plannedExpenses: f.plannedExpenses.map((x,xi) => xi===i ? {...x, amount: nonNegInput(e.target.value)} : x)}))} style={{paddingLeft:22}}/>
            </div>
            <button className="btn btn-ghost btn-sm" style={{padding:0, color:'var(--rust)'}}
              onClick={() => setForm(f => ({...f, plannedExpenses: f.plannedExpenses.filter((_,xi) => xi!==i)}))}><Icon name="x" size={12}/></button>
          </div>
        ))}
        <button className="btn btn-ghost btn-sm" onClick={() => setForm(f => ({...f, plannedExpenses: [...(f.plannedExpenses||[]), { description:'', quantity:1, amount:'', category:'parts' }]}))}>+ Add part</button>
        {(form.plannedExpenses||[]).length > 0 && (
          <div style={{marginTop:8, fontSize:12, color:'var(--ink-3)'}}>
            Cost: <strong>${(form.plannedExpenses||[]).reduce((s,e)=>s+(Number(e.amount)||0)*(Number(e.quantity)||1),0).toFixed(2)}</strong> → charged at cost+{PARTS_MARGIN*100}%: <strong>${Math.round((form.plannedExpenses||[]).reduce((s,e)=>s+(Number(e.amount)||0)*(Number(e.quantity)||1),0)*(1+PARTS_MARGIN)*100)/100}</strong>. Not a real expense yet, becomes one automatically if this quote converts to an order.
          </div>
        )}
      </div>

      <label className="field"><span className="label">Notes to customer</span>
        <textarea className="textarea" style={{minHeight:80}} placeholder="Turnaround time, warranty, pickup/delivery, any conditions…" value={form.notes||''} onChange={e=>setForm({...form,notes:e.target.value})} />
      </label>

      <label className="field"><span className="label">Status</span>
        <select className="select" value={form.status||'new'} onChange={e=>setForm({...form, status:e.target.value})}>
          {['new','in-review','quoted','won','closed','declined'].map(s => <option key={s} value={s}>{s.replace(/-/g,' ')}</option>)}
        </select>
      </label>
    </OrderPage>
  );
}

// ============================================================
// QUOTES
// ============================================================
function AdminQuotes({ search, sessionInfo, siteUrl }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [customers, setCustomers] = useState([]);
  const [services, setServices] = useState([]);
  const [edit, setEdit] = useState(null);
  const [statusTab, setStatusTab] = useUrlState('tab', 'all');
  const [openId, setOpenId] = useUrlState('open', null, { push: true });

  useEffect(() => {
    fetch('/api/admin/quotes', { credentials:'include' })
      .then(r => r.ok ? r.json() : Promise.reject()).then(d => setRows(d.items || [])).catch(() => setRows([])).finally(() => setLoading(false));
    fetch('/api/admin/customers', { credentials:'include' })
      .then(r => r.ok ? r.json() : Promise.reject()).then(d => setCustomers(d.items || [])).catch(() => {});
    fetch('/api/admin/catalog', { credentials:'include' })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(d => setServices((d.services || []).filter(s => s.status === 'published')))
      .catch(() => {});
  }, []);

  const q = (search || '').toLowerCase().trim();
  const visibleRows = useMemo(() => {
    let out = rows;
    if (q) out = out.filter(r =>
      (r.id || '').toLowerCase().includes(q) ||
      (r.quoteRef || '').toLowerCase().includes(q) ||
      (r.cust || r.name || '').toLowerCase().includes(q) ||
      (r.email || '').toLowerCase().includes(q)
    );
    if (statusTab !== 'all') out = out.filter(r => (r.status || 'new') === statusTab);
    return out;
  }, [rows, q, statusTab]);

  const tabCounts = useMemo(() => ({
    all: rows.length,
    new: rows.filter(r => (r.status||'new') === 'new').length,
    'in-review': rows.filter(r => r.status === 'in-review').length,
    quoted: rows.filter(r => r.status === 'quoted').length,
    won: rows.filter(r => r.status === 'won').length,
    closed: rows.filter(r => r.status === 'closed').length,
    declined: rows.filter(r => r.status === 'declined').length,
  }), [rows]);

  const blankQuote = () => ({ id:'', quoteRef:'', cust:'', email:'', phone:'', loc:'', shippingAddress:'', lineItems:[], validDays:30, discountType:'percent', discountValue:'', discountAmount:0, total:0, notes:'', status:'new' });

  const openRow = (r) => setOpenId(r.id);

  useEffect(() => {
    const cur = edit === null ? null : (edit.id || 'new');
    if (openId === cur) return;
    if (openId == null) { setEdit(null); return; }
    if (openId === 'new') { setEdit(blankQuote()); return; }
    const r = rows.find(x => x.id === openId);
    if (r) setEdit(r);
  }, [openId, rows]);

  if (edit !== null) {
    return (
      <QuotePage
        edit={edit}
        quotes={rows}
        customers={customers}
        services={services}
        onClose={() => setOpenId(null)}
        onSave={(saved, isNew) => {
          if (isNew) setRows(rs => [saved, ...rs]);
          else setRows(rs => rs.map(r => r.id === edit.id ? saved : r));
          setOpenId(null);
        }}
        onDelete={(id) => setRows(rs => rs.filter(r => r.id !== id))}
        onCustomerCreated={(cust) => setCustomers(cs => cs.some(c => c.id === cust.id) ? cs.map(c => c.id === cust.id ? cust : c) : [...cs, cust])}
      />
    );
  }

  const statusMap = {
    new:        { bg:'var(--rust)', fg:'#fff' },
    'in-review':{ bg:'var(--ochre)', fg:'var(--dark)' },
    quoted:     { bg:'#d8e7d0', fg:'#345526' },
    won:        { bg:'#345526', fg:'#fff' },
    closed:     { bg:'var(--bg-deep)', fg:'var(--ink-2)' },
    declined:   { bg:'#f3d5c5', fg:'#7a3a18' },
  };

  return (
    <div style={{padding:32}}>
      <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14, flexWrap:'wrap', gap:10}}>
        <div className="tabs tabs-row" style={{margin:0}}>
          {[['all','All'],['new','New'],['in-review','In review'],['quoted','Quoted'],['won','Won'],['closed','Closed'],['declined','Declined']].map(([k,l]) => (
            <div key={k} role="button" tabIndex={0} className={`tab ${statusTab===k?'active':''}`} style={{cursor:'pointer'}}
              onClick={() => setStatusTab(k)}
              onKeyDown={e => { if (e.key==='Enter'||e.key===' ') { e.preventDefault(); setStatusTab(k); } }}>{l} ({tabCounts[k]})</div>
          ))}
        </div>
        <button className="btn btn-rust btn-sm" onClick={() => setOpenId('new')}>+ New quote</button>
      </div>
      <Table
        loading={loading}
        columns={[
          { key:'quoteRef', label:'Quote #', w:'120px', sort:true, render:r => <span className="mono" style={{fontSize:12, color:'var(--rust)'}}>{r.quoteRef || r.id}</span> },
          { key:'cust', label:'Customer', w:'1.5fr', sort:r => r.cust || r.name, render:r => r.cust || r.name || '-' },
          { key:'items', label:'Items', w:'2fr', render:r => <span style={{fontSize:13}}>{(r.lineItems||[]).map(i=>i.description).filter(Boolean).join(', ') || r.description || r.summary || '-'}</span> },
          { key:'total', label:'Total', w:'90px', sort:r => Number(r.total ?? r.grandTotal) || 0, render:r => <span className="mono" style={{fontWeight:600}}>${(Number(r.total ?? r.grandTotal)||0).toLocaleString('en-AU',{minimumFractionDigits:2,maximumFractionDigits:2})}</span> },
          { key:'status', label:'Status', w:'110px', sort:r => r.status || 'new', render:r => <StatusPill value={r.status || 'new'} map={statusMap} /> },
          { key:'date', label:'When', w:'110px', sort:r => { const d = r.createdAt ? new Date(r.createdAt) : null; return d ? d.getTime() : 0; }, render:r => <span className="mono" style={{fontSize:11, color:'var(--ink-2)'}}>{r.date || (r.createdAt ? new Date(r.createdAt).toLocaleDateString('en-AU',{day:'2-digit',month:'short',year:'numeric'}) : '-')}</span> },
        ]}
        rows={visibleRows}
        onRowClick={openRow}
        defaultSort={{ key: 'quoteRef', dir: 'desc' }}
      />
    </div>
  );
}

// ============================================================
// PC BUILDER
// ============================================================
// A PC Part Picker style builder: pick a part per category from the parts
// library, get live compatibility and physical-fit warnings, then turn the
// finished build into a quote. The rules and the part spec schema live in
// pc-compat.js so they stay testable and free of React.

const PC_BUILD_STATUS_MAP = {
  draft:    { bg:'var(--bg-deep)', fg:'var(--ink-2)' },
  quoted:   { bg:'#d8e7d0', fg:'#345526' },
  ordered:  { bg:'var(--ochre)', fg:'var(--dark)' },
  built:    { bg:'#345526', fg:'#fff' },
  archived: { bg:'#f3d5c5', fg:'#7a3a18' },
};

const PC_SEVERITY_STYLE = {
  error:   { bg:'#f9e2d6', border:'#c2643a', fg:'#7a3a18', label:'Blocker' },
  warning: { bg:'#fff4d6', border:'#d39a37', fg:'#7a5d10', label:'Check' },
  info:    { bg:'var(--bg-deep)', border:'var(--line)', fg:'var(--ink-2)', label:'Note' },
};

function blankPcPart(category) {
  return { id:'', category: category || 'cpu', name:'', brand:'', sku:'', priceAud:'', cost:'', specs:{}, notes:'' };
}

const pcMoney = (n) => `$${(Number(n) || 0).toLocaleString('en-AU', { minimumFractionDigits:2, maximumFractionDigits:2 })}`;
const pcPartLabel = (p) => partDisplayName(p);

// One spec input, driven by the field definition in PC_PART_CATEGORIES.
function PcSpecField({ field, value, onChange }) {
  if (field.type === 'bool') {
    // Tri-state on purpose: "not recorded" is different from "no", and the
    // compatibility rules skip a check rather than guess when a spec is unset.
    return (
      <label className="field">
        <span className="label">{field.label}</span>
        <select className="input" value={value === true ? 'yes' : value === false ? 'no' : ''}
          onChange={e => onChange(e.target.value === '' ? undefined : e.target.value === 'yes')}>
          <option value="">Not recorded</option>
          <option value="yes">Yes</option>
          <option value="no">No</option>
        </select>
      </label>
    );
  }
  if (field.type === 'select') {
    return (
      <label className="field">
        <span className="label">{field.label}</span>
        <select className="input" value={value ?? ''} onChange={e => onChange(e.target.value || undefined)}>
          <option value="">Not recorded</option>
          {field.options.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      </label>
    );
  }
  if (field.type === 'multiselect') {
    const selected = Array.isArray(value) ? value : [];
    const toggle = (o) => onChange(selected.includes(o) ? selected.filter(x => x !== o) : [...selected, o]);
    return (
      <div className="field" style={{gridColumn:'1 / -1'}}>
        <span className="label">{field.label}</span>
        <div className="row-flex" style={{flexWrap:'wrap', gap:6, marginTop:4}}>
          {field.options.map(o => (
            <button key={o} type="button" className={`btn btn-sm ${selected.includes(o) ? '' : 'btn-ghost'}`}
              onClick={() => toggle(o)} style={{padding:'3px 8px', fontSize:11}}>{o}</button>
          ))}
        </div>
      </div>
    );
  }
  return (
    <label className="field">
      <span className="label">{field.label}</span>
      <input className="input" type={field.type === 'number' ? 'number' : 'text'} value={value ?? ''}
        onChange={e => {
          const raw = e.target.value;
          if (raw === '') return onChange(undefined);
          onChange(field.type === 'number' ? Number(raw) : raw);
        }}/>
    </label>
  );
}

function PcPartEditor({ part, onClose, onSaved, onDeleted }) {
  const [form, setForm] = useState(part);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);
  const savedSnapRef = React.useRef(JSON.stringify(part));
  const dirty = JSON.stringify(form) !== savedSnapRef.current;
  const cat = PC_CATEGORY_MAP[form.category] || PC_CATEGORY_MAP.other;
  // Icecat fills in the specs no bulk dataset carries, looked up per part by
  // manufacturer part number. Results are shown for confirmation rather than
  // applied straight away, because a datasheet can describe a near neighbour.
  const [icecat, setIcecat] = useState(null);   // null | {loading} | result | {error}
  const doIcecat = async () => {
    setIcecat({ loading: true });
    const r = await fetch('/api/admin/pc-builder/icecat/lookup', {
      method:'POST', headers:postHeaders(), credentials:'include',
      body: JSON.stringify({ category: form.category, brand: form.brand, mpn: form.mpn, gtin: form.gtin }),
    }).catch(() => null);
    if (!r) { setIcecat({ error: 'Could not reach the server.' }); return; }
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { setIcecat({ error: d.message || 'Lookup failed.', reason: d.error }); return; }
    setIcecat(d);
  };
  const applyIcecat = () => {
    setForm(f => ({ ...f, specs: { ...(f.specs || {}), ...(icecat.specs || {}) } }));
    adminToast(`${Object.keys(icecat.specs || {}).length} spec(s) filled in from Icecat.`, 'success');
    setIcecat(null);
  };

  const setSpec = (key, val) => setForm(f => {
    const specs = { ...(f.specs || {}) };
    if (val === undefined) delete specs[key]; else specs[key] = val;
    return { ...f, specs };
  });

  const save = async () => {
    if (!form.name.trim()) { setErr('Give the part a name before saving.'); return; }
    setSaving(true); setErr(null);
    const r = await fetch('/api/admin/pc-builder/parts/save', {
      method:'POST', headers:postHeaders(), credentials:'include', body: JSON.stringify(form),
    }).catch(() => null);
    setSaving(false);
    if (!r || !r.ok) { setErr('Could not save the part, please try again.'); return; }
    const d = await r.json();
    savedSnapRef.current = JSON.stringify(d.item);
    onSaved(d.item, !part.id);
  };

  const remove = async () => {
    if (!await adminConfirm(`Delete "${pcPartLabel(form)}" from the parts library?`, {
      title:'Delete part', confirmLabel:'Delete part', danger:true,
    })) return;
    const r = await fetch('/api/admin/pc-builder/parts/delete', {
      method:'POST', headers:postHeaders(), credentials:'include', body: JSON.stringify({ id: form.id }),
    }).catch(() => null);
    if (!r || !r.ok) { setErr('Could not delete the part, please try again.'); return; }
    onDeleted(form.id);
  };

  return (
    <Drawer open onClose={onClose} dirty={dirty} title={part.id ? 'Edit part' : 'New part'}
      footer={
        <div className="row-flex" style={{justifyContent:'space-between', gap:8}}>
          {part.id
            ? <button className="btn btn-ghost btn-sm" onClick={remove} style={{color:'var(--rust)'}}>Delete</button>
            : <span/>}
          <div className="row-flex" style={{gap:8}}>
            <button className="btn btn-ghost btn-sm" onClick={onClose}>Cancel</button>
            <button className="btn btn-rust btn-sm" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save part'}</button>
          </div>
        </div>
      }>
      {err && <div className="mono" style={{fontSize:12, color:'var(--rust)', marginBottom:12}}>{err}</div>}
      <div className="form-grid">
        <label className="field">
          <span className="label">Category</span>
          <select className="input" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value, specs: {} }))}>
            {PC_PART_CATEGORIES.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
          </select>
        </label>
        <label className="field"><span className="label">Brand</span>
          <input className="input" value={form.brand || ''} onChange={e => setForm(f => ({ ...f, brand: e.target.value }))}/></label>
        <label className="field" style={{gridColumn:'1 / -1'}}><span className="label">Name</span>
          <input className="input" value={form.name || ''} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Ryzen 5 7600"/></label>
        <label className="field"><span className="label">SKU</span>
          <input className="input" value={form.sku || ''} onChange={e => setForm(f => ({ ...f, sku: e.target.value }))}/></label>
        <label className="field"><span className="label">Manufacturer part number</span>
          <input className="input" value={form.mpn || ''} placeholder="CMH32GX5M2E6000C36W"
            onChange={e => setForm(f => ({ ...f, mpn: e.target.value }))}/></label>
        <label className="field"><span className="label">Barcode (GTIN / EAN)</span>
          <input className="input" value={form.gtin || ''} onChange={e => setForm(f => ({ ...f, gtin: e.target.value }))}/></label>
        <label className="field"><span className="label">Sell price (AUD)</span>
          <input className="input" type="number" value={form.priceAud ?? ''} onChange={e => setForm(f => ({ ...f, priceAud: e.target.value }))}/></label>
        <label className="field"><span className="label">Our cost (AUD)</span>
          <input className="input" type="number" value={form.cost ?? ''} onChange={e => setForm(f => ({ ...f, cost: e.target.value }))}/></label>
        {form.supplierSku && (
          <label className="field" style={{gridColumn:'1 / -1'}}>
            <span className="label">Sell price on supplier imports</span>
            <select className="input" value={form.priceLocked ? 'locked' : 'auto'}
              onChange={e => setForm(f => ({ ...f, priceLocked: e.target.value === 'locked' }))}>
              <option value="auto">Recalculate from cost and markup</option>
              <option value="locked">Keep my price, only update the cost</option>
            </select>
          </label>
        )}
      </div>
      {form.supplierSku && (
        <p className="mono" style={{fontSize:11, color:'var(--ink-2)', margin:'10px 0 0'}}>
          From supplier feed · SKU {form.supplierSku}
          {form.stock != null ? ` · ${form.stock} in stock` : ''}
        </p>
      )}

      {(form.mpn || form.gtin) && (
        <div style={{marginTop:14}}>
          <button className="btn btn-ghost btn-sm" onClick={doIcecat} disabled={icecat && icecat.loading}>
            {icecat && icecat.loading ? 'Looking up…' : 'Fetch specs from Icecat'}
          </button>
        </div>
      )}
      {icecat && icecat.error && (
        <div style={{background:'#f9e2d6', borderLeft:'3px solid var(--rust)', padding:'8px 10px', marginTop:10}}>
          <span style={{fontSize:12.5}}>{icecat.error}</span>
          {icecat.reason === 'brand_restricted' && (
            <span style={{fontSize:11.5, color:'var(--ink-2)', display:'block', marginTop:3}}>
              That brand is Full Icecat rather than the free Open Icecat tier. Set ICECAT_APP_KEY to reach it.
            </span>
          )}
          {icecat.reason === 'not_configured' && (
            <span style={{fontSize:11.5, color:'var(--ink-2)', display:'block', marginTop:3}}>
              Register free at icecat.biz, then set ICECAT_USERNAME on the server.
            </span>
          )}
        </div>
      )}
      {icecat && icecat.ok && (
        <div style={{border:'1px solid var(--line)', padding:12, marginTop:10}}>
          <div className="row-flex" style={{justifyContent:'space-between', gap:10, marginBottom:8}}>
            <span style={{fontSize:13, fontWeight:600, minWidth:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{icecat.title || 'Datasheet found'}</span>
            <button className="btn btn-rust btn-sm" onClick={applyIcecat} disabled={!Object.keys(icecat.specs || {}).length}>
              Apply {Object.keys(icecat.specs || {}).length} spec(s)
            </button>
          </div>
          {icecat.matched.map(m => (
            <div key={m.spec} className="row-flex" style={{justifyContent:'space-between', gap:10, fontSize:12, marginBottom:2}}>
              <span style={{color:'var(--ink-2)'}}>{m.feature}</span>
              <span className="mono">{String(m.value)}</span>
            </div>
          ))}
          {!Object.keys(icecat.specs || {}).length && (
            <p style={{fontSize:12.5, color:'var(--ink-2)', margin:0}}>
              A datasheet was found but none of its fields matched a spec we use. The list below is what it carried.
            </p>
          )}
          {icecat.unmatched.length > 0 && (
            <details style={{marginTop:8}}>
              <summary style={{fontSize:11.5, color:'var(--ink-2)', cursor:'pointer'}}>
                {icecat.unmatched.length} other field(s) on the datasheet
              </summary>
              <div style={{marginTop:6, maxHeight:180, overflowY:'auto'}}>
                {icecat.unmatched.map((u, i) => (
                  <div key={i} className="row-flex" style={{justifyContent:'space-between', gap:10, fontSize:11.5, marginBottom:1}}>
                    <span style={{color:'var(--ink-2)'}}>{u.name}</span>
                    <span className="mono">{u.value}</span>
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>
      )}

      {form.specsNeedCheck && (
        <div style={{background:'#fff4d6', borderLeft:'3px solid var(--ochre)', padding:'8px 10px', margin:'14px 0 0'}}>
          <span className="mono" style={{fontSize:9.5, letterSpacing:'.08em', color:'#7a5d10', display:'block', marginBottom:2}}>UNVERIFIED</span>
          <span style={{fontSize:12.5}}>
            These specs came from the built-in catalog. Check the dimensions against the manufacturer page before quoting a build on them.
            Saving any change here marks them checked.
          </span>
        </div>
      )}
      {cat.fields.length > 0 && <>
        <h4 style={{margin:'22px 0 10px', fontSize:13, letterSpacing:'.04em'}}>{cat.label} specs</h4>
        <p style={{fontSize:12, color:'var(--ink-2)', margin:'0 0 12px'}}>
          Anything left as "not recorded" is skipped by the compatibility checker rather than guessed at.
        </p>
        <div className="form-grid">
          {cat.fields.map(f => (
            <PcSpecField key={f.key} field={f} value={(form.specs || {})[f.key]} onChange={v => setSpec(f.key, v)}/>
          ))}
        </div>
      </>}

      <label className="field" style={{marginTop:18}}><span className="label">Notes</span>
        <textarea className="input" rows={3} value={form.notes || ''} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}/></label>
    </Drawer>
  );
}

// Debounced server-side parts query. The library is far too big to ship to the
// browser once a distributor feed is in, so every list of parts is a request.
function usePartsQuery({ category, q, limit = 60, enabled = true, reloadKey = 0, filter = null, colour = '' }) {
  const [state, setState] = useState({ items: [], total: 0, counts: {}, filteredOutByFit: 0, filteredOutByColour: 0, loading: enabled });
  const filterKey = filter && filter.length ? JSON.stringify(filter) : '';
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    setState(s => ({ ...s, loading: true }));
    const t = setTimeout(() => {
      const params = new URLSearchParams();
      if (category) params.set('category', category);
      if (q) params.set('q', q);
      if (filterKey) params.set('filter', filterKey);
      if (colour) params.set('colour', colour);
      params.set('limit', String(limit));
      fetch(`/api/admin/pc-builder/parts?${params}`, { credentials:'include' })
        .then(r => r.ok ? r.json() : Promise.reject())
        .then(d => { if (!cancelled) setState({ items: d.items || [], total: d.total || 0, counts: d.counts || {}, filteredOutByFit: d.filteredOutByFit || 0, filteredOutByColour: d.filteredOutByColour || 0, loading: false }); })
        .catch(() => { if (!cancelled) setState(s => ({ ...s, loading: false })); });
    }, q ? 220 : 0);
    return () => { cancelled = true; clearTimeout(t); };
  }, [category, q, limit, enabled, reloadKey, filterKey, colour]);
  return state;
}

// Choose a part for one category, from the library, with search.
function PcPartPicker({ category, items, parts, colourTheme = '', onPick, onClose, onNewPart }) {
  const [q, setQ] = useState('');
  const [compatibleOnly, setCompatibleOnly] = useState(true);
  // Defaults to the build's colour theme, so a white build offers white parts
  // without setting it on every picker.
  const [colour, setColour] = useState(colourTheme);
  const cat = PC_CATEGORY_MAP[category] || PC_CATEGORY_MAP.other;
  const supportsColour = (cat.fields || []).some(f => f.key === 'colour');
  // Constraints come from what is already in the build, so picking a 14900K
  // leaves only LGA1700 boards on offer.
  const filter = useMemo(
    () => compatibilityFilter(category, items, parts),
    [category, items, parts]
  );
  const { items: matches, total, filteredOutByFit, filteredOutByColour, loading } = usePartsQuery({
    category, q, filter: compatibleOnly ? filter : null, colour: supportsColour ? colour : '',
  });
  const constraintSummary = filter.map(c => {
    const label = { socket:'socket', memoryType:'memory', formFactor:'form factor', sockets:'socket',
      heightMm:'height', radiatorMm:'radiator', lengthMm:'length', wattage:'wattage',
      maxBoardFormFactor:'board size', maxGpuLengthMm:'GPU clearance', maxCoolerHeightMm:'cooler clearance',
      psuFormFactor:'PSU type', pcie8pin:'PCIe power', tdpRating:'cooling capacity' }[c.field] || c.field;
    const v = Array.isArray(c.value) ? c.value.join(' / ') : c.value;
    const op = c.op === 'lte' ? '≤ ' : c.op === 'gte' ? '≥ ' : '';
    return `${label} ${op}${v}`;
  });

  return (
    <Drawer open onClose={onClose} title={`Choose ${cat.label.toLowerCase()}`}
      footer={<button className="btn btn-ghost btn-sm" onClick={onNewPart}>+ Add a new {cat.label.toLowerCase()} to the library</button>}>
      <input className="input" autoFocus placeholder={`Search ${cat.label.toLowerCase()}…`} value={q} onChange={e => setQ(e.target.value)} style={{marginBottom:10}}/>

      {supportsColour && (
        <div className="row-flex" style={{gap:8, alignItems:'center', marginBottom:10}}>
          <span style={{fontSize:12.5, color:'var(--ink-2)', whiteSpace:'nowrap'}}>Colour</span>
          <select className="input" style={{flex:1, fontSize:12}} value={colour} onChange={e => setColour(e.target.value)}>
            <option value="">Any colour</option>
            {PART_COLOURS.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          {colour && filteredOutByColour > 0 && (
            <span className="mono" style={{fontSize:10.5, color:'var(--ink-2)', whiteSpace:'nowrap'}}>
              {filteredOutByColour.toLocaleString()} other colours hidden
            </span>
          )}
        </div>
      )}
      {supportsColour && colour && (
        <p style={{fontSize:11.5, color:'var(--ink-2)', margin:'-4px 0 10px'}}>
          Parts with no colour recorded are still shown, since most imported parts have none yet.
        </p>
      )}

      {filter.length > 0 && (
        <div style={{background:'var(--bg-deep)', padding:'8px 10px', marginBottom:12}}>
          <label className="row-flex" style={{gap:7, alignItems:'center', cursor:'pointer'}}>
            <input type="checkbox" checked={compatibleOnly} onChange={e => setCompatibleOnly(e.target.checked)}/>
            <span style={{fontSize:12.5}}>Only show what fits this build</span>
          </label>
          <div className="mono" style={{fontSize:10.5, color:'var(--ink-2)', marginTop:4}}>
            Matching on {constraintSummary.join(' · ')}
          </div>
          {compatibleOnly && filteredOutByFit > 0 && (
            <div style={{fontSize:11.5, color:'var(--ink-2)', marginTop:4}}>
              {filteredOutByFit.toLocaleString()} hidden as incompatible.
              {' '}<button type="button" onClick={() => setCompatibleOnly(false)}
                style={{background:'none', border:'none', padding:0, color:'var(--rust)', cursor:'pointer', font:'inherit', textDecoration:'underline'}}>Show them anyway</button>
            </div>
          )}
          {!compatibleOnly && (
            <div style={{fontSize:11.5, color:'var(--rust)', marginTop:4}}>
              Showing everything, including parts that will not fit.
            </div>
          )}
        </div>
      )}

      {loading && <p style={{fontSize:13, color:'var(--ink-2)'}}>Searching…</p>}
      {!loading && matches.length === 0 && (
        <p style={{fontSize:13, color:'var(--ink-2)'}}>
          {compatibleOnly && filteredOutByFit > 0
            ? `Nothing in the library fits this build yet. ${filteredOutByFit.toLocaleString()} ${cat.label.toLowerCase()} were excluded, untick the box above to see them.`
            : q ? 'Nothing matches that search.' : `No ${cat.label.toLowerCase()} in the parts library yet.`}
        </p>
      )}
      {total > matches.length && (
        <p className="mono" style={{fontSize:11, color:'var(--ink-2)', margin:'0 0 8px'}}>
          Showing {matches.length} of {total.toLocaleString()}, narrow the search to see more.
        </p>
      )}
      <div style={{display:'grid', gap:6}}>
        {matches.map(p => (
          <button key={p.id} type="button" onClick={() => onPick(p)}
            style={{textAlign:'left', background:'var(--bg-deep)', border:'1px solid var(--line)', padding:'10px 12px', cursor:'pointer', display:'flex', justifyContent:'space-between', gap:12, alignItems:'center'}}>
            <span style={{minWidth:0}}>
              <span style={{display:'block', fontSize:13, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{pcPartLabel(p)}</span>
              <span className="mono" style={{fontSize:10.5, color:'var(--ink-2)'}}>
                {(p.specs || {}).colour ? `${p.specs.colour} · ` : ''}{pcSpecSummary(p) || (p.sku || 'no specs recorded')}
              </span>
            </span>
            <span className="mono" style={{fontWeight:600, whiteSpace:'nowrap'}}>{pcMoney(p.priceAud)}</span>
          </button>
        ))}
      </div>
    </Drawer>
  );
}

// A one-line "why this part" summary for pickers and build rows.
function pcSpecSummary(part) {
  const s = part.specs || {};
  const bits = [];
  const push = (v, suffix = '') => { if (v !== undefined && v !== null && v !== '') bits.push(`${v}${suffix}`); };
  switch (part.category) {
    case 'cpu': push(s.socket); push(s.cores, 'C'); push(s.tdp, 'W'); break;
    case 'motherboard': push(s.socket); push(s.formFactor); push(s.memoryType); break;
    case 'ram': push(s.capacityGb, 'GB'); push(s.memoryType); push(s.speedMhz, 'MHz'); push(s.casLatency ? `CL${s.casLatency}` : ''); break;
    case 'gpu': push(s.lengthMm, 'mm'); push(s.tdp, 'W'); break;
    case 'storage': push(s.capacityGb, 'GB'); push(s.rpm ? `${s.rpm}rpm` : s.driveType); push(s.interface); break;
    case 'psu': push(s.wattage, 'W'); push(s.formFactor); push(s.efficiency); break;
    case 'case': push(s.maxBoardFormFactor); push(s.maxGpuLengthMm ? `GPU ${s.maxGpuLengthMm}mm` : ''); break;
    case 'cooler': push(s.coolerType); push(s.radiatorMm ? `${s.radiatorMm}mm rad` : (s.heightMm ? `${s.heightMm}mm tall` : '')); break;
    case 'fan': push(s.sizeMm, 'mm'); break;
    default: break;
  }
  return bits.filter(Boolean).join(' · ');
}

function PcPartsLibrary({ products, onLibraryChanged }) {
  const [edit, setEdit] = useState(null);
  const [catFilter, setCatFilter] = useState('all');
  const [q, setQ] = useState('');
  const [importOpen, setImportOpen] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [colourFilter, setColourFilter] = useState('');
  const { items: rows, total, counts, loading } = usePartsQuery({
    category: catFilter === 'all' ? '' : catFilter, q, limit: 200, enabled: true, reloadKey, colour: colourFilter,
  });
  const refresh = () => { setReloadKey(k => k + 1); onLibraryChanged?.(); };

  return (
    <>
      <div className="row-flex" style={{justifyContent:'space-between', gap:10, flexWrap:'wrap', marginBottom:14}}>
        <div className="row-flex" style={{gap:8, flex:1, minWidth:260}}>
          <select className="input" style={{maxWidth:220}} value={catFilter} onChange={e => setCatFilter(e.target.value)}>
            <option value="all">All categories</option>
            {PC_PART_CATEGORIES.map(c => (
              <option key={c.key} value={c.key}>{c.label}{counts[c.key] ? ` (${counts[c.key]})` : ''}</option>
            ))}
          </select>
          <input className="input" style={{flex:1, maxWidth:280}} placeholder="Search parts…" value={q} onChange={e => setQ(e.target.value)}/>
          <select className="input" style={{maxWidth:150}} value={colourFilter} onChange={e => setColourFilter(e.target.value)}>
            <option value="">Any colour</option>
            {PART_COLOURS.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="row-flex" style={{gap:8}}>
          <button className="btn btn-ghost btn-sm" onClick={() => setImportOpen(true)}>Import from products</button>
          <button className="btn btn-rust btn-sm" onClick={() => setEdit(blankPcPart(catFilter === 'all' ? 'cpu' : catFilter))}>+ New part</button>
        </div>
      </div>
      {total > rows.length && (
        <p className="mono" style={{fontSize:11, color:'var(--ink-2)', margin:'0 0 8px'}}>
          Showing {rows.length} of {total.toLocaleString()} matching parts, narrow by category or search to see more.
        </p>
      )}
      <Table
        loading={loading}
        columns={[
          { key:'category', label:'Category', w:'130px', sort:true, render:r => <span className="mono" style={{fontSize:11, color:'var(--ink-2)'}}>{categoryLabel(r.category)}</span> },
          { key:'name', label:'Part', w:'2fr', sort:r => pcPartLabel(r), render:r => pcPartLabel(r) },
          { key:'colour', label:'Colour', w:'90px', sort:r => (r.specs || {}).colour || '', render:r => (r.specs || {}).colour
            ? <span style={{fontSize:12}}>{r.specs.colour}</span>
            : <span style={{color:'var(--ink-3)'}}>-</span> },
          { key:'specs', label:'Specs', w:'2fr', render:r => (
            <span className="row-flex" style={{gap:6, alignItems:'center', minWidth:0}}>
              <span className="mono" style={{fontSize:11, color:'var(--ink-2)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{pcSpecSummary(r) || '-'}</span>
              {r.specsNeedCheck && (
                <span className="mono" title="From the built-in catalog, dimensions not yet checked against the manufacturer"
                  style={{fontSize:9, padding:'1px 5px', background:'#fff4d6', color:'#7a5d10', whiteSpace:'nowrap', flexShrink:0}}>UNVERIFIED</span>
              )}
            </span>
          ) },
          { key:'stock', label:'Stock', w:'70px', sort:r => Number(r.stock) || 0, render:r => r.stock == null
            ? <span style={{color:'var(--ink-3)'}}>-</span>
            : <span className="mono" style={{fontSize:12, color: Number(r.stock) > 0 ? 'var(--ink)' : 'var(--rust)'}}>{r.stock}</span> },
          { key:'cost', label:'Cost', w:'90px', sort:r => Number(r.cost) || 0, render:r => <span className="mono" style={{fontSize:12, color:'var(--ink-2)'}}>{pcMoney(r.cost)}</span> },
          { key:'priceAud', label:'Price', w:'100px', sort:r => Number(r.priceAud) || 0, render:r => (
            <span className="mono" style={{fontWeight:600}}>{pcMoney(r.priceAud)}{r.priceLocked && <span title="Price locked against feed updates" style={{color:'var(--ochre)'}}> ×</span>}</span>
          ) },
        ]}
        rows={rows}
        onRowClick={r => setEdit(r)}
        emptyMessage="No parts yet. Update from the Data sources tab, add one by hand, or import a supplier price file."
        defaultSort={{ key:'category', dir:'asc' }}
      />
      {edit && (
        <PcPartEditor
          part={edit}
          onClose={() => setEdit(null)}
          onSaved={() => { setEdit(null); refresh(); }}
          onDeleted={() => { setEdit(null); refresh(); }}
        />
      )}
      {importOpen && (
        <PcImportProducts
          products={products}
          onClose={() => setImportOpen(false)}
          onImported={() => { setImportOpen(false); refresh(); }}
        />
      )}
    </>
  );
}

function PcImportProducts({ products, onClose, onImported }) {
  const [q, setQ] = useState('');
  const [category, setCategory] = useState('cpu');
  const [picked, setPicked] = useState([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  // Products already imported are skipped server-side, so no filtering here.
  const matches = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (products || [])
      .filter(p => !needle || (p.name || '').toLowerCase().includes(needle) || (p.sku || '').toLowerCase().includes(needle))
      .slice(0, 40);
  }, [products, q]);

  const doImport = async () => {
    if (!picked.length) return;
    setBusy(true); setErr(null);
    const r = await fetch('/api/admin/pc-builder/parts/import', {
      method:'POST', headers:postHeaders(), credentials:'include',
      body: JSON.stringify({ productIds: picked, category }),
    }).catch(() => null);
    setBusy(false);
    if (!r || !r.ok) { setErr('Import failed, please try again.'); return; }
    const d = await r.json();
    adminToast(`${(d.items || []).length} part(s) imported. Add their specs so compatibility checks can run.`, 'success');
    onImported(d.items || []);
  };

  return (
    <Drawer open onClose={onClose} title="Import products as parts"
      footer={
        <div className="row-flex" style={{justifyContent:'flex-end', gap:8}}>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>Cancel</button>
          <button className="btn btn-rust btn-sm" onClick={doImport} disabled={busy || !picked.length}>
            {busy ? 'Importing…' : `Import ${picked.length || ''}`.trim()}
          </button>
        </div>
      }>
      {err && <div className="mono" style={{fontSize:12, color:'var(--rust)', marginBottom:12}}>{err}</div>}
      <p style={{fontSize:12, color:'var(--ink-2)', margin:'0 0 12px'}}>
        Imported parts carry the product's name and price. Specs come across empty, fill them in so the compatibility checks can run.
      </p>
      <label className="field" style={{marginBottom:10}}><span className="label">Import as category</span>
        <select className="input" value={category} onChange={e => setCategory(e.target.value)}>
          {PC_PART_CATEGORIES.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
        </select>
      </label>
      <input className="input" placeholder="Search products…" value={q} onChange={e => setQ(e.target.value)} style={{marginBottom:12}}/>
      <div style={{display:'grid', gap:4, maxHeight:'46vh', overflowY:'auto'}}>
        {matches.length === 0 && <p style={{fontSize:13, color:'var(--ink-2)'}}>No products left to import.</p>}
        {matches.map(p => (
          <label key={p.id} className="row-flex" style={{gap:8, padding:'7px 9px', background:'var(--bg-deep)', cursor:'pointer'}}>
            <input type="checkbox" checked={picked.includes(p.id)}
              onChange={e => setPicked(cur => e.target.checked ? [...cur, p.id] : cur.filter(x => x !== p.id))}/>
            <span style={{flex:1, fontSize:13, minWidth:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{p.name}</span>
            <span className="mono" style={{fontSize:12}}>{pcMoney(p.priceAud ?? p.price)}</span>
          </label>
        ))}
      </div>
    </Drawer>
  );
}

// Supplier config: how one distributor's price file maps onto part fields, and
// what markup turns their cost into our sell price.
function PcSupplierEditor({ supplier, onClose, onSaved, onDeleted }) {
  const [form, setForm] = useState(supplier);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);
  const savedSnapRef = React.useRef(JSON.stringify(supplier));
  const dirty = JSON.stringify(form) !== savedSnapRef.current;

  const setRule = (idx, patch) => setForm(f => ({ ...f, categoryRules: f.categoryRules.map((r, i) => i === idx ? { ...r, ...patch } : r) }));
  const addRule = () => setForm(f => ({ ...f, categoryRules: [...(f.categoryRules || []), { match:'', category:'other' }] }));
  const removeRule = (idx) => setForm(f => ({ ...f, categoryRules: f.categoryRules.filter((_, i) => i !== idx) }));

  const save = async () => {
    if (!(form.name || '').trim()) { setErr('Give the supplier a name.'); return; }
    setSaving(true); setErr(null);
    const r = await fetch('/api/admin/pc-builder/suppliers/save', {
      method:'POST', headers:postHeaders(), credentials:'include', body: JSON.stringify(form),
    }).catch(() => null);
    setSaving(false);
    if (!r || !r.ok) { setErr('Could not save the supplier, please try again.'); return; }
    const d = await r.json();
    savedSnapRef.current = JSON.stringify(d.item);
    onSaved(d.item, !supplier.id);
  };

  const remove = async () => {
    if (!await adminConfirm(`Delete supplier "${form.name}"? Parts already imported stay in the library.`, {
      title:'Delete supplier', confirmLabel:'Delete supplier', danger:true })) return;
    const r = await fetch('/api/admin/pc-builder/suppliers/delete', {
      method:'POST', headers:postHeaders(), credentials:'include', body: JSON.stringify({ id: form.id }),
    }).catch(() => null);
    if (!r || !r.ok) { setErr('Could not delete the supplier.'); return; }
    onDeleted(form.id);
  };

  return (
    <Drawer open onClose={onClose} dirty={dirty} title={supplier.id ? 'Edit supplier' : 'New supplier'}
      footer={
        <div className="row-flex" style={{justifyContent:'space-between', gap:8}}>
          {supplier.id ? <button className="btn btn-ghost btn-sm" onClick={remove} style={{color:'var(--rust)'}}>Delete</button> : <span/>}
          <div className="row-flex" style={{gap:8}}>
            <button className="btn btn-ghost btn-sm" onClick={onClose}>Cancel</button>
            <button className="btn btn-rust btn-sm" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save supplier'}</button>
          </div>
        </div>
      }>
      {err && <div className="mono" style={{fontSize:12, color:'var(--rust)', marginBottom:12}}>{err}</div>}
      <div className="form-grid">
        <label className="field" style={{gridColumn:'1 / -1'}}><span className="label">Supplier name</span>
          <input className="input" value={form.name || ''} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Leader"/></label>
        <label className="field"><span className="label">Default markup (%)</span>
          <input className="input" type="number" value={form.markupPercent ?? ''} onChange={e => setForm(f => ({ ...f, markupPercent: e.target.value }))}/></label>
        <label className="field"><span className="label">GST (%)</span>
          <input className="input" type="number" value={form.gstPercent ?? 10} onChange={e => setForm(f => ({ ...f, gstPercent: e.target.value }))}/></label>
        <label className="field" style={{gridColumn:'1 / -1'}}>
          <span className="label">Feed prices already include GST</span>
          <select className="input" value={form.priceIncludesGst ? 'yes' : 'no'} onChange={e => setForm(f => ({ ...f, priceIncludesGst: e.target.value === 'yes' }))}>
            <option value="no">No, prices are ex-GST (usual for distributors)</option>
            <option value="yes">Yes, prices already include GST</option>
          </select>
        </label>
      </div>

      <h4 style={{margin:'22px 0 6px', fontSize:13}}>Markup by category</h4>
      <p style={{fontSize:12, color:'var(--ink-2)', margin:'0 0 10px'}}>
        Overrides the default for that category. Leave blank to use {Number(form.markupPercent) || 0}%.
      </p>
      <div className="form-grid">
        {PC_PART_CATEGORIES.filter(c => c.key !== 'other').map(c => (
          <label key={c.key} className="field"><span className="label">{c.label}</span>
            <input className="input" type="number" placeholder={`${Number(form.markupPercent) || 0}`}
              value={(form.markupByCategory || {})[c.key] ?? ''}
              onChange={e => setForm(f => {
                const m = { ...(f.markupByCategory || {}) };
                if (e.target.value === '') delete m[c.key]; else m[c.key] = Number(e.target.value);
                return { ...f, markupByCategory: m };
              })}/></label>
        ))}
      </div>

      <h4 style={{margin:'22px 0 6px', fontSize:13}}>Category rules</h4>
      <p style={{fontSize:12, color:'var(--ink-2)', margin:'0 0 10px'}}>
        A feed row is only imported if one of these matches its category or name, so a distributor's printers and cables stay out of the parts library.
        Comma-separated terms, first rule that matches wins.
      </p>
      {(form.categoryRules || []).map((r, i) => (
        <div key={i} className="row-flex" style={{gap:8, marginBottom:6}}>
          <input className="input" style={{flex:1}} value={r.match || ''} placeholder="graphics, video card, gpu"
            onChange={e => setRule(i, { match: e.target.value })}/>
          <select className="input" style={{width:150}} value={r.category} onChange={e => setRule(i, { category: e.target.value })}>
            {PC_PART_CATEGORIES.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
          </select>
          <button className="btn btn-ghost btn-sm" style={{padding:'2px 7px', fontSize:11, color:'var(--rust)'}} onClick={() => removeRule(i)} aria-label="Remove rule">×</button>
        </div>
      ))}
      <button className="btn btn-ghost btn-sm" onClick={addRule}>+ Add rule</button>
    </Drawer>
  );
}

// Import wizard: read the file, confirm the column mapping, dry run, commit.
function PcFeedImport({ supplier, onClose, onImported }) {
  const [csv, setCsv] = useState('');
  const [fileName, setFileName] = useState('');
  const [preview, setPreview] = useState(null);
  const [map, setMap] = useState({});
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(null);
  const [err, setErr] = useState(null);

  const onFile = (file) => {
    if (!file) return;
    setErr(null); setResult(null); setPreview(null);
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = async () => {
      const text = String(reader.result || '');
      setCsv(text);
      setBusy('preview');
      const r = await fetch('/api/admin/pc-builder/feed/preview', {
        method:'POST', headers:postHeaders(), credentials:'include', body: JSON.stringify({ csv: text }),
      }).catch(() => null);
      setBusy(null);
      if (!r || !r.ok) {
        const d = r ? await r.json().catch(() => ({})) : {};
        setErr(d.message || 'Could not read that file.');
        return;
      }
      const d = await r.json();
      setPreview(d);
      // A saved mapping from last time wins, it has already been corrected by
      // a human, but only where the column still exists in this file.
      const saved = supplier.columnMap || {};
      const merged = { ...d.suggestedMap };
      for (const [k, v] of Object.entries(saved)) if (d.headers.includes(v)) merged[k] = v;
      setMap(merged);
    };
    reader.onerror = () => setErr('Could not read that file.');
    reader.readAsText(file);
  };

  const run = async (commit) => {
    setBusy(commit ? 'commit' : 'dry'); setErr(null);
    const r = await fetch('/api/admin/pc-builder/feed/import', {
      method:'POST', headers:postHeaders(), credentials:'include',
      body: JSON.stringify({ supplierId: supplier.id, csv, columnMap: map, delimiter: preview?.delimiter, commit }),
    }).catch(() => null);
    setBusy(null);
    if (!r || !r.ok) {
      const d = r ? await r.json().catch(() => ({})) : {};
      setErr(d.message || 'Import failed, please try again.');
      return;
    }
    const d = await r.json();
    setResult(d);
    if (commit) {
      adminToast(`${d.summary.created} part(s) added, ${d.summary.priceChanged} price(s) updated.`, 'success');
      onImported();
    }
  };

  const FIELD_LABELS = [
    ['supplierSku', 'SKU / stock code', true],
    ['name', 'Product name', true],
    ['price', 'Your cost price', true],
    ['brand', 'Brand', false],
    ['stock', 'Stock on hand', false],
    ['category', 'Supplier category', false],
  ];
  const mappingReady = map.supplierSku && map.name && map.price;

  return (
    <Drawer open onClose={onClose} title={`Import price file · ${supplier.name}`}
      footer={
        <div className="row-flex" style={{justifyContent:'flex-end', gap:8}}>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>Close</button>
          {preview && !result?.summary && (
            <button className="btn btn-ghost btn-sm" onClick={() => run(false)} disabled={!mappingReady || !!busy}>
              {busy === 'dry' ? 'Checking…' : 'Preview changes'}
            </button>
          )}
          {result && result.dryRun && (
            <button className="btn btn-rust btn-sm" onClick={() => run(true)} disabled={!!busy}>
              {busy === 'commit' ? 'Importing…' : 'Apply import'}
            </button>
          )}
        </div>
      }>
      {err && <div className="mono" style={{fontSize:12, color:'var(--rust)', marginBottom:12}}>{err}</div>}

      <label className="field" style={{marginBottom:14}}>
        <span className="label">Price file (CSV or tab-separated)</span>
        <input className="input" type="file" accept=".csv,.tsv,.txt,text/csv" onChange={e => onFile(e.target.files?.[0])}/>
      </label>
      {busy === 'preview' && <p style={{fontSize:13, color:'var(--ink-2)'}}>Reading {fileName}…</p>}

      {preview && (
        <>
          <p className="mono" style={{fontSize:11, color:'var(--ink-2)', margin:'0 0 14px'}}>
            {fileName} · {preview.rowCount.toLocaleString()} rows · {preview.headers.length} columns
            {preview.delimiter === '\t' ? ' · tab separated' : ''}
          </p>

          <h4 style={{margin:'0 0 6px', fontSize:13}}>Column mapping</h4>
          <p style={{fontSize:12, color:'var(--ink-2)', margin:'0 0 10px'}}>
            Guessed from the headers. Correct anything wrong, it is saved against {supplier.name} for next time.
          </p>
          <div className="form-grid">
            {FIELD_LABELS.map(([key, label, required]) => (
              <label key={key} className="field">
                <span className="label">{label}{required && <span style={{color:'var(--rust)'}}> *</span>}</span>
                <select className="input" value={map[key] || ''} onChange={e => setMap(m => ({ ...m, [key]: e.target.value || undefined }))}>
                  <option value="">Not mapped</option>
                  {preview.headers.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
              </label>
            ))}
          </div>

          {map.name && (
            <>
              <h4 style={{margin:'20px 0 8px', fontSize:13}}>First rows as mapped</h4>
              <div style={{overflowX:'auto', border:'1px solid var(--line)'}}>
                <table style={{borderCollapse:'collapse', width:'100%', fontSize:12}}>
                  <thead><tr>
                    {FIELD_LABELS.filter(([k]) => map[k]).map(([k, l]) => (
                      <th key={k} style={{textAlign:'left', padding:'6px 8px', borderBottom:'1px solid var(--line)', whiteSpace:'nowrap', color:'var(--ink-2)', fontWeight:500}}>{l}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {preview.sample.map((row, i) => (
                      <tr key={i}>
                        {FIELD_LABELS.filter(([k]) => map[k]).map(([k]) => (
                          <td key={k} style={{padding:'6px 8px', borderBottom:'1px solid var(--line)', maxWidth:220, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{row[map[k]]}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}

      {result && (
        <div style={{marginTop:20, border:'1px solid var(--line)', padding:14}}>
          <h4 style={{margin:'0 0 10px', fontSize:13}}>
            {result.dryRun ? 'Preview, nothing saved yet' : 'Import complete'}
          </h4>
          {[
            ['New parts to add', result.summary.created],
            ['Prices to update', result.summary.priceChanged],
            ['Already up to date', result.summary.unchanged],
            ['Skipped, no category rule matched', result.summary.skippedNoCategory],
            ['Skipped, price could not be read', result.summary.skippedBadPrice],
          ].map(([label, n]) => (
            <div key={label} className="row-flex" style={{justifyContent:'space-between', marginBottom:3}}>
              <span style={{fontSize:12.5, color:'var(--ink-2)'}}>{label}</span>
              <span className="mono" style={{fontWeight:600}}>{n.toLocaleString()}</span>
            </div>
          ))}
          {result.summary.skippedNoCategory > 0 && (
            <p style={{fontSize:11.5, color:'var(--ink-2)', margin:'8px 0 0'}}>
              Skipped rows are normal, a distributor list carries plenty that is not a PC part. Add a category rule if something is missing.
            </p>
          )}
          {result.samples?.created?.length > 0 && (
            <>
              <div className="mono" style={{fontSize:10, letterSpacing:'.08em', color:'var(--ink-2)', margin:'14px 0 6px'}}>SAMPLE OF NEW PARTS</div>
              {result.samples.created.map((s, i) => (
                <div key={i} className="row-flex" style={{justifyContent:'space-between', gap:10, fontSize:12, marginBottom:2}}>
                  <span style={{minWidth:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{s.name}</span>
                  <span className="mono" style={{whiteSpace:'nowrap', color:'var(--ink-2)'}}>{categoryLabel(s.category)} · {pcMoney(s.price)}</span>
                </div>
              ))}
            </>
          )}
          {result.samples?.priceChanged?.length > 0 && (
            <>
              <div className="mono" style={{fontSize:10, letterSpacing:'.08em', color:'var(--ink-2)', margin:'14px 0 6px'}}>SAMPLE OF PRICE CHANGES</div>
              {result.samples.priceChanged.map((s, i) => (
                <div key={i} className="row-flex" style={{justifyContent:'space-between', gap:10, fontSize:12, marginBottom:2}}>
                  <span style={{minWidth:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{s.name}</span>
                  <span className="mono" style={{whiteSpace:'nowrap', color: s.to > s.from ? 'var(--rust)' : 'var(--ink-2)'}}>
                    {pcMoney(s.from)} → {pcMoney(s.to)}
                  </span>
                </div>
              ))}
            </>
          )}
          <p style={{fontSize:11.5, color:'var(--ink-2)', margin:'12px 0 0'}}>
            Specs you have filled in are never overwritten by a price file, and parts with a locked price keep it.
          </p>
        </div>
      )}
    </Drawer>
  );
}

// External spec datasets. One button pulls every source in turn and upserts
// what it finds; the loop lives here rather than server-side so progress is
// visible and one slow dataset cannot time out the whole run.
function PcDataSources({ onPartsReload }) {
  const [sources, setSources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(null);   // source id currently syncing
  const [results, setResults] = useState({});     // id -> {ok, summary} | {error}
  const [stopped, setStopped] = useState(false);
  const cancelRef = React.useRef(false);

  const load = React.useCallback(() => (
    fetch('/api/admin/pc-builder/sources', { credentials:'include' })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(d => setSources(d.sources || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  ), []);
  useEffect(() => { load(); }, [load]);

  const syncOne = async (id) => {
    setRunning(id);
    const r = await fetch('/api/admin/pc-builder/sources/sync', {
      method:'POST', headers:postHeaders(), credentials:'include', body: JSON.stringify({ sourceId: id }),
    }).catch(() => null);
    let outcome;
    if (!r || !r.ok) {
      const d = r ? await r.json().catch(() => ({})) : {};
      outcome = { error: d.message || 'Could not reach the source.' };
    } else {
      outcome = await r.json();
    }
    setResults(cur => ({ ...cur, [id]: outcome }));
    setRunning(null);
    return outcome;
  };

  const syncAll = async () => {
    if (!await adminConfirm(
      `Pull all ${sources.length} datasets and update the parts library?\n\nThis adds parts and fills in missing specs. It never changes prices, and never overwrites a spec you have edited.`,
      { title:'Update from datasets', confirmLabel:'Update all' })) return;
    cancelRef.current = false;
    setStopped(false);
    setResults({});
    for (const src of sources) {
      if (cancelRef.current) { setStopped(true); break; }
      await syncOne(src.id);
    }
    setRunning(null);
    await load();
    onPartsReload?.();
  };

  const totals = Object.values(results).reduce((acc, r) => {
    if (r && r.summary) {
      acc.created += r.summary.created;
      acc.updated += r.summary.updated;
      acc.merged += r.summary.merged || 0;
      acc.unchanged += r.summary.unchanged || 0;
      acc.kept += r.summary.keptStaffEdits;
    }
    if (r && r.error) acc.failed++;
    return acc;
  }, { created:0, updated:0, merged:0, unchanged:0, kept:0, failed:0 });
  const anyResults = Object.keys(results).length > 0;

  return (
    <>
      <div className="row-flex" style={{justifyContent:'space-between', gap:10, flexWrap:'wrap', marginBottom:14}}>
        <p style={{fontSize:12.5, color:'var(--ink-2)', margin:0, maxWidth:620}}>
          Public specification datasets. Updating pulls each one and fills in specs on parts already in the library,
          adding any it does not have. Prices are never imported, and a spec you have edited is never overwritten.
        </p>
        <div className="row-flex" style={{gap:8}}>
          {running && (
            <button className="btn btn-ghost btn-sm" onClick={() => { cancelRef.current = true; }}>Stop after this one</button>
          )}
          <button className="btn btn-rust btn-sm" onClick={syncAll} disabled={!!running || loading}>
            {running ? 'Updating…' : 'Update all from datasets'}
          </button>
        </div>
      </div>

      {anyResults && (
        <div style={{border:'1px solid var(--line)', padding:'10px 12px', marginBottom:14}}>
          <span className="mono" style={{fontSize:10.5, letterSpacing:'.1em', color:'var(--ink-2)'}}>THIS RUN</span>
          <div className="row-flex" style={{gap:18, marginTop:6, flexWrap:'wrap'}}>
            <span style={{fontSize:13}}><strong className="mono">{totals.created.toLocaleString()}</strong> parts added</span>
            {totals.updated > 0 && <span style={{fontSize:13}}><strong className="mono">{totals.updated.toLocaleString()}</strong> existing parts updated</span>}
            {totals.merged > 0 && <span style={{fontSize:13}}><strong className="mono">{totals.merged.toLocaleString()}</strong> merged into matching parts</span>}
            {totals.unchanged > 0 && <span style={{fontSize:13, color:'var(--ink-2)'}}><strong className="mono">{totals.unchanged.toLocaleString()}</strong> already current</span>}
            {totals.kept > 0 && <span style={{fontSize:13, color:'var(--ink-2)'}}><strong className="mono">{totals.kept.toLocaleString()}</strong> left as you edited them</span>}
            {totals.failed > 0 && <span style={{fontSize:13, color:'var(--rust)'}}><strong className="mono">{totals.failed}</strong> source(s) failed</span>}
          </div>
          {totals.created > 0 && totals.updated === 0 && totals.unchanged === 0 && (
            <div style={{fontSize:11.5, color:'var(--ink-2)', marginTop:5}}>
              Everything was new, so nothing needed updating. Running this again will report them as already current.
            </div>
          )}
          {stopped && <div style={{fontSize:12, color:'var(--ink-2)', marginTop:5}}>Stopped early, the remaining sources were not touched.</div>}
        </div>
      )}

      {loading && <p style={{fontSize:13, color:'var(--ink-2)'}}>Loading sources…</p>}
      <div style={{display:'grid', gap:10}}>
        {sources.map(src => {
          const res = results[src.id];
          const st = src.state;
          const isRunning = running === src.id;
          return (
            <div key={src.id} style={{border:'1px solid var(--line)', padding:14, opacity: isRunning ? 0.75 : 1}}>
              <div className="row-flex" style={{justifyContent:'space-between', gap:10, flexWrap:'wrap', alignItems:'flex-start'}}>
                <div style={{minWidth:0, flex:1}}>
                  <div className="row-flex" style={{gap:8, alignItems:'center'}}>
                    <span style={{fontSize:15, fontWeight:600}}>{src.label}</span>
                    <span className="mono" style={{fontSize:9.5, padding:'1px 6px', background:'var(--bg-deep)', color:'var(--ink-2)'}}>
                      {categoryLabel(src.category).toUpperCase()}
                    </span>
                  </div>
                  <div style={{fontSize:12.5, color:'var(--ink-2)', marginTop:3}}>Gives: {src.gives}</div>
                  <div className="mono" style={{fontSize:10.5, color:'var(--ink-3)', marginTop:2}}>{src.provenance}</div>
                  <div className="mono" style={{fontSize:10.5, color:'var(--ink-3)', marginTop:2}}>
                    {st && st.lastSyncAt
                      ? `Last updated ${new Date(st.lastSyncAt).toLocaleString('en-AU')} · ${(st.rows || 0).toLocaleString()} rows read`
                      : 'Never updated'}
                    {st && st.error && <span style={{color:'var(--rust)'}}> · last attempt failed: {st.error}</span>}
                  </div>
                </div>
                <button className="btn btn-ghost btn-sm" onClick={async () => { await syncOne(src.id); await load(); onPartsReload?.(); }} disabled={!!running}>
                  {isRunning ? 'Updating…' : 'Update'}
                </button>
              </div>
              {res && (
                <div style={{marginTop:8, paddingTop:8, borderTop:'1px solid var(--line)'}}>
                  {res.error
                    ? <span style={{fontSize:12.5, color:'var(--rust)'}}>{res.error}</span>
                    : <span style={{fontSize:12.5}}>
                        {[
                          `${res.summary.created.toLocaleString()} added`,
                          res.summary.updated ? `${res.summary.updated.toLocaleString()} updated` : null,
                          res.summary.merged ? `${res.summary.merged.toLocaleString()} merged into matching parts` : null,
                          res.summary.unchanged ? `${res.summary.unchanged.toLocaleString()} already current` : null,
                          res.summary.keptStaffEdits ? `${res.summary.keptStaffEdits.toLocaleString()} left as you edited them` : null,
                        ].filter(Boolean).join(' · ')}
                      </span>}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}

function PcSuppliers({ suppliers, onSuppliersChange, onPartsReload }) {
  const [edit, setEdit] = useState(null);
  const [importing, setImporting] = useState(null);
  const blank = () => ({ id:'', name:'', markupPercent:30, markupByCategory:{}, gstPercent:10, priceIncludesGst:false, categoryRules:[
    { match:'motherboard', category:'motherboard' },
    { match:'cpu, processor', category:'cpu' },
    { match:'graphics, video card, vga, gpu', category:'gpu' },
    { match:'memory, ram, dimm', category:'ram' },
    { match:'ssd, hard drive, hdd, nvme, storage', category:'storage' },
    { match:'power supply, psu', category:'psu' },
    { match:'case, chassis', category:'case' },
    { match:'cooler, cooling, heatsink', category:'cooler' },
    { match:'fan', category:'fan' },
    { match:'monitor', category:'monitor' },
  ] });

  return (
    <>
      <div className="row-flex" style={{justifyContent:'flex-end', marginBottom:14}}>
        <button className="btn btn-rust btn-sm" onClick={() => setEdit(blank())}>+ New supplier</button>
      </div>
      {suppliers.length === 0 && (
        <p style={{fontSize:13, color:'var(--ink-2)'}}>
          No suppliers yet. Add one, then import their price file to populate the parts library.
        </p>
      )}
      <div style={{display:'grid', gap:10}}>
        {suppliers.map(s => (
          <div key={s.id} style={{border:'1px solid var(--line)', padding:14}}>
            <div className="row-flex" style={{justifyContent:'space-between', gap:10, flexWrap:'wrap'}}>
              <div>
                <div style={{fontSize:15, fontWeight:600}}>{s.name}</div>
                <div className="mono" style={{fontSize:11, color:'var(--ink-2)', marginTop:3}}>
                  {Number(s.markupPercent) || 0}% markup
                  {s.priceIncludesGst ? ' · feed inc GST' : ` · feed ex GST, +${Number(s.gstPercent) || 10}%`}
                  {' · '}{(s.categoryRules || []).length} category rules
                </div>
                <div className="mono" style={{fontSize:11, color:'var(--ink-3)', marginTop:2}}>
                  {s.lastImportAt
                    ? `Last import ${new Date(s.lastImportAt).toLocaleString('en-AU')} · ${s.lastImportCounts?.created || 0} added, ${s.lastImportCounts?.priceChanged || 0} repriced`
                    : 'Never imported'}
                </div>
              </div>
              <div className="row-flex" style={{gap:8}}>
                <button className="btn btn-ghost btn-sm" onClick={() => setEdit(s)}>Settings</button>
                <button className="btn btn-rust btn-sm" onClick={() => setImporting(s)}>Import price file</button>
              </div>
            </div>
          </div>
        ))}
      </div>
      {edit && (
        <PcSupplierEditor
          supplier={edit}
          onClose={() => setEdit(null)}
          onSaved={(item, isNew) => { onSuppliersChange(ss => isNew ? [...ss, item] : ss.map(s => s.id === item.id ? item : s)); setEdit(null); }}
          onDeleted={(id) => { onSuppliersChange(ss => ss.filter(s => s.id !== id)); setEdit(null); }}
        />
      )}
      {importing && (
        <PcFeedImport
          supplier={importing}
          onClose={() => setImporting(null)}
          onImported={onPartsReload}
        />
      )}
    </>
  );
}

function PcBuildPage({ build, customers, onClose, onSave, onDelete }) {
  const [form, setForm] = useState(build);
  const [picking, setPicking] = useState(null);   // category key
  const [newPart, setNewPart] = useState(null);
  const [busy, setBusy] = useState(null);         // 'save' | 'quote' | 'delete'
  const [err, setErr] = useState(null);
  const savedSnapRef = React.useRef(JSON.stringify(build));
  const dirty = JSON.stringify(form) !== savedSnapRef.current;

  // Only the parts this build references are fetched, never the whole library.
  // Until they arrive, each item's stored snapshot keeps the page rendering,
  // so a slow request shows slightly stale prices rather than an empty build.
  const [parts, setParts] = useState(() => (build.items || []).map(it => it.snapshot).filter(Boolean));
  useEffect(() => {
    const ids = [...new Set((build.items || []).map(it => it.partId).filter(Boolean))];
    if (!ids.length) return;
    fetch(`/api/admin/pc-builder/parts?ids=${encodeURIComponent(ids.join(','))}`, { credentials:'include' })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(d => setParts(cur => {
        const byId = new Map(cur.map(p => [p.id, p]));
        for (const p of d.items || []) byId.set(p.id, p);
        return [...byId.values()];
      }))
      .catch(() => {});
  }, [build.id]);
  const rememberPart = (part) => setParts(cur => cur.some(p => p.id === part.id) ? cur.map(p => p.id === part.id ? part : p) : [...cur, part]);

  const check = useMemo(() => checkBuild(form.items, parts), [form.items, parts]);
  // Colour is a customer requirement rather than a fit problem, so it is
  // reported next to the compatibility list rather than inside it.
  const colourClashes = useMemo(() => {
    if (!form.colourTheme) return [];
    const byId = new Map(parts.map(p => [p.id, p]));
    return (form.items || [])
      .map(it => ({ part: byId.get(it.partId) || it.snapshot }))
      .filter(x => x.part && x.part.specs && x.part.specs.colour && x.part.specs.colour !== form.colourTheme);
  }, [form.items, form.colourTheme, parts]);
  const totals = useMemo(() => buildTotals(form, parts), [form, parts]);
  const partsById = useMemo(() => new Map(parts.map(p => [p.id, p])), [parts]);
  const discountAmount = useMemo(() => {
    const v = Number(form.discountValue) || 0;
    const raw = (form.discountType || 'percent') === 'percent' ? totals.total * (v / 100) : v;
    return Math.min(Math.round(raw * 100) / 100, totals.total);
  }, [form.discountType, form.discountValue, totals.total]);
  const grandTotal = Math.round((totals.total - discountAmount) * 100) / 100;

  const itemsFor = (cat) => (form.items || [])
    .map((it, idx) => ({ it, idx, part: partsById.get(it.partId) || it.snapshot }))
    .filter(x => x.part && x.part.category === cat);

  const addPart = (part) => {
    // The snapshot keeps a saved build readable if the part is later deleted
    // from the library, live prices still win while the part exists.
    rememberPart(part);
    setForm(f => ({ ...f, items: [...(f.items || []), { partId: part.id, qty: 1, snapshot: { ...part } }] }));
    setPicking(null);
  };
  const setQty = (idx, qty) => setForm(f => ({ ...f, items: f.items.map((it, i) => i === idx ? { ...it, qty: Math.max(1, Number(qty) || 1) } : it) }));
  const removeAt = (idx) => setForm(f => ({ ...f, items: f.items.filter((_, i) => i !== idx) }));

  const setLabour = (idx, patch) => setForm(f => ({ ...f, labour: (f.labour || []).map((l, i) => i === idx ? { ...l, ...patch } : l) }));
  const addLabour = () => setForm(f => ({ ...f, labour: [...(f.labour || []), { description:'Assembly and testing', amount:'', qty:1 }] }));
  const removeLabour = (idx) => setForm(f => ({ ...f, labour: (f.labour || []).filter((_, i) => i !== idx) }));

  const persist = async () => {
    const payload = { ...form, issueSummary: { errors: check.errors.length, warnings: check.warnings.length }, estimatedWatts: check.wattage };
    const r = await fetch('/api/admin/pc-builder/builds/save', {
      method:'POST', headers:postHeaders(), credentials:'include', body: JSON.stringify(payload),
    }).catch(() => null);
    if (!r || !r.ok) return null;
    const d = await r.json();
    savedSnapRef.current = JSON.stringify(d.item);
    setForm(d.item);
    return d.item;
  };

  const doSave = async () => {
    setBusy('save'); setErr(null);
    const item = await persist();
    setBusy(null);
    if (!item) { setErr('Could not save the build, please try again.'); return; }
    onSave(item, !build.id);
    adminToast('Build saved.', 'success');
  };

  const doQuote = async () => {
    if (check.errors.length && !await adminConfirm(
      `This build has ${check.errors.length} blocking compatibility issue(s).\nQuote it anyway?`,
      { title:'Compatibility blockers', confirmLabel:'Quote anyway', danger:true })) return;
    setBusy('quote'); setErr(null);
    const item = await persist();
    if (!item) { setBusy(null); setErr('Could not save the build, so no quote was created.'); return; }
    const r = await fetch('/api/admin/pc-builder/builds/quote', {
      method:'POST', headers:postHeaders(), credentials:'include', body: JSON.stringify({ buildId: item.id }),
    }).catch(() => null);
    setBusy(null);
    if (!r || !r.ok) {
      const reason = r && r.status === 400 ? 'Add at least one part or labour line first.' : 'Could not create the quote, please try again.';
      setErr(reason);
      return;
    }
    const d = await r.json();
    savedSnapRef.current = JSON.stringify(d.build);
    setForm(d.build);
    onSave(d.build, false);
    adminToast(`Quote ${d.quote.quoteRef} created, opening it now.`, 'success');
    window.location.href = `/quotes?open=${encodeURIComponent(d.quote.id)}`;
  };

  const doDelete = async () => {
    if (!await adminConfirm(`Delete build ${form.ref || form.name}? Any quote already created from it stays.`, {
      title:'Delete build', confirmLabel:'Delete build', danger:true })) return;
    setBusy('delete');
    const r = await fetch('/api/admin/pc-builder/builds/delete', {
      method:'POST', headers:postHeaders(), credentials:'include', body: JSON.stringify({ id: form.id }),
    }).catch(() => null);
    setBusy(null);
    if (!r || !r.ok) { setErr('Could not delete the build, please try again.'); return; }
    onDelete(form.id);
  };

  const applyCustomer = (name) => {
    const c = (customers || []).find(x => `${x.name}${x.email ? ` (${x.email})` : ''}` === name || x.name === name);
    if (c) setForm(f => ({ ...f, cust: c.name || '', email: c.email || '', phone: c.phone || '', loc: c.loc || '', shippingAddress: c.shippingAddress || '' }));
    else setForm(f => ({ ...f, cust: name }));
  };

  return (
    <>
      <OrderPage
        maxWidth={1180}
        title={build.id ? `${form.ref || 'Build'} · ${form.name || 'Untitled build'}` : 'New PC build'}
        dirty={dirty}
        onClose={onClose}
        backLabel="All builds"
        footer={
          <div className="row-flex" style={{justifyContent:'space-between', gap:8, flexWrap:'wrap'}}>
            {build.id
              ? <button className="btn btn-ghost btn-sm" onClick={doDelete} disabled={!!busy} style={{color:'var(--rust)'}}>Delete build</button>
              : <span/>}
            <div className="row-flex" style={{gap:8}}>
              {form.quoteId && (
                <a className="btn btn-ghost btn-sm" href={`/quotes?open=${encodeURIComponent(form.quoteId)}`} style={{textDecoration:'none'}}>
                  Open quote {form.quoteRef || ''}
                </a>
              )}
              <button className="btn btn-ghost btn-sm" onClick={doSave} disabled={!!busy}>{busy === 'save' ? 'Saving…' : 'Save build'}</button>
              <button className="btn btn-rust btn-sm" onClick={doQuote} disabled={!!busy}>
                {busy === 'quote' ? 'Creating…' : form.quoteId ? 'Update quote' : 'Create quote'}
              </button>
            </div>
          </div>
        }>
        {err && <div className="mono" style={{fontSize:12, color:'var(--rust)', marginBottom:14}}>{err}</div>}

        <div className="form-grid" style={{marginBottom:22}}>
          <label className="field"><span className="label">Build name</span>
            <input className="input" value={form.name || ''} placeholder="Gaming tower for J. Smith"
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}/></label>
          <label className="field"><span className="label">Status</span>
            <select className="input" value={form.status || 'draft'} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
              {['draft','quoted','ordered','built','archived'].map(s => <option key={s} value={s}>{s[0].toUpperCase() + s.slice(1)}</option>)}
            </select></label>
          <label className="field"><span className="label">Colour theme</span>
            <select className="input" value={form.colourTheme || ''} onChange={e => setForm(f => ({ ...f, colourTheme: e.target.value }))}>
              <option value="">No preference</option>
              {PART_COLOURS.map(c => <option key={c} value={c}>{c}</option>)}
            </select></label>
          <label className="field"><span className="label">Customer</span>
            <input className="input" list="pc-build-customers" value={form.cust || ''} onChange={e => applyCustomer(e.target.value)}/>
            <datalist id="pc-build-customers">
              {(customers || []).slice(0, 300).map(c => <option key={c.id} value={c.name}>{c.email}</option>)}
            </datalist></label>
          <label className="field"><span className="label">Email</span>
            <input className="input" value={form.email || ''} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}/></label>
        </div>

        <div className="pc-builder-grid">
          {/* Part picker, one row per category */}
          <div>
            {PC_PART_CATEGORIES.map(cat => {
              const chosen = itemsFor(cat.key);
              const canAddMore = cat.multi || chosen.length === 0;
              return (
                <div key={cat.key} style={{borderBottom:'1px solid var(--line)', padding:'10px 0'}}>
                  <div className="row-flex" style={{justifyContent:'space-between', gap:10, alignItems:'center'}}>
                    <span className="mono" style={{fontSize:10.5, letterSpacing:'.1em', color:'var(--ink-2)'}}>
                      {cat.label.toUpperCase()}{cat.required && <span style={{color:'var(--rust)'}}> *</span>}
                    </span>
                    {canAddMore && (
                      <button className="btn btn-ghost btn-sm" style={{padding:'2px 8px', fontSize:11}} onClick={() => setPicking(cat.key)}>
                        {chosen.length ? '+ Add another' : '+ Choose'}
                      </button>
                    )}
                  </div>
                  {chosen.length === 0 && (
                    <div style={{fontSize:13, color:'var(--ink-3)', paddingTop:4}}>Nothing selected</div>
                  )}
                  {chosen.map(({ it, idx, part }) => (
                    <div key={idx} className="row-flex" style={{gap:10, alignItems:'center', paddingTop:6}}>
                      <span style={{flex:1, minWidth:0}}>
                        <span style={{display:'block', fontSize:13.5}}>{pcPartLabel(part)}</span>
                        <span className="mono" style={{fontSize:10.5, color:'var(--ink-2)'}}>{pcSpecSummary(part) || 'no specs recorded'}</span>
                      </span>
                      <input className="input" type="number" min="1" value={it.qty || 1} onChange={e => setQty(idx, e.target.value)}
                        style={{width:58, padding:'3px 6px', fontSize:12}} aria-label={`${pcPartLabel(part)} quantity`}/>
                      <span className="mono" style={{width:88, textAlign:'right', fontWeight:600}}>{pcMoney((Number(part.priceAud) || 0) * (Number(it.qty) || 1))}</span>
                      <button className="btn btn-ghost btn-sm" style={{padding:'2px 7px', fontSize:11, color:'var(--rust)'}} onClick={() => removeAt(idx)} aria-label="Remove part">×</button>
                    </div>
                  ))}
                </div>
              );
            })}

            <h4 style={{margin:'22px 0 8px', fontSize:13}}>Labour and services</h4>
            {(form.labour || []).map((l, idx) => (
              <div key={idx} className="row-flex" style={{gap:8, marginBottom:6, alignItems:'center'}}>
                <input className="input" style={{flex:1}} value={l.description || ''} placeholder="Assembly and testing"
                  onChange={e => setLabour(idx, { description: e.target.value })}/>
                <input className="input" type="number" min="1" style={{width:58}} value={l.qty ?? 1} onChange={e => setLabour(idx, { qty: e.target.value })} aria-label="Quantity"/>
                <input className="input" type="number" style={{width:100}} value={l.amount ?? ''} placeholder="0.00"
                  onChange={e => setLabour(idx, { amount: e.target.value })} aria-label="Amount"/>
                <button className="btn btn-ghost btn-sm" style={{padding:'2px 7px', fontSize:11, color:'var(--rust)'}} onClick={() => removeLabour(idx)} aria-label="Remove line">×</button>
              </div>
            ))}
            <button className="btn btn-ghost btn-sm" onClick={addLabour}>+ Add labour line</button>

            <label className="field" style={{marginTop:20}}><span className="label">Notes for the quote</span>
              <textarea className="input" rows={3} value={form.notes || ''} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}/></label>
          </div>

          {/* Summary, compatibility and pricing */}
          <div className="pc-builder-aside">
            <div style={{border:'1px solid var(--line)', padding:14, marginBottom:14}}>
              <div className="row-flex" style={{justifyContent:'space-between', marginBottom:6}}>
                <span style={{fontSize:12.5, color:'var(--ink-2)'}}>Estimated draw</span>
                <span className="mono" style={{fontWeight:600}}>{check.wattage ? `${check.wattage} W` : '-'}</span>
              </div>
              <div className="row-flex" style={{justifyContent:'space-between'}}>
                <span style={{fontSize:12.5, color:'var(--ink-2)'}}>Suggested PSU</span>
                <span className="mono" style={{fontWeight:600}}>{check.recommendedPsu ? `${check.recommendedPsu} W` : '-'}</span>
              </div>
            </div>

            {colourClashes.length > 0 && (
              <div style={{background:'#fff4d6', borderLeft:'3px solid var(--ochre)', padding:'7px 9px', marginBottom:14}}>
                <span className="mono" style={{fontSize:9.5, letterSpacing:'.08em', color:'#7a5d10', display:'block', marginBottom:2}}>COLOUR</span>
                <span style={{fontSize:12.5, display:'block'}}>
                  {colourClashes.length} part{colourClashes.length > 1 ? 's do' : ' does'} not match the {form.colourTheme.toLowerCase()} theme:
                  {' '}{colourClashes.map(c => `${pcPartLabel(c.part)} (${c.part.specs.colour})`).join(', ')}.
                </span>
              </div>
            )}

            <div style={{marginBottom:14}}>
              <div className="row-flex" style={{gap:6, marginBottom:8, alignItems:'center'}}>
                <span className="mono" style={{fontSize:10.5, letterSpacing:'.1em', color:'var(--ink-2)'}}>COMPATIBILITY</span>
                <span className="mono" style={{fontSize:10.5, padding:'1px 6px', background: check.errors.length ? 'var(--rust)' : check.warnings.length ? 'var(--ochre)' : '#345526', color:'#fff'}}>
                  {check.errors.length ? `${check.errors.length} blocker${check.errors.length > 1 ? 's' : ''}` : check.warnings.length ? `${check.warnings.length} to check` : 'All clear'}
                </span>
              </div>
              {check.issues.length === 0 && (
                <p style={{fontSize:12.5, color:'var(--ink-2)', margin:0}}>Nothing flagged against the parts selected so far.</p>
              )}
              <div style={{display:'grid', gap:6}}>
                {check.issues.map((iss, i) => {
                  const st = PC_SEVERITY_STYLE[iss.severity];
                  return (
                    <div key={`${iss.code}-${i}`} style={{background:st.bg, borderLeft:`3px solid ${st.border}`, padding:'7px 9px'}}>
                      <span className="mono" style={{fontSize:9.5, letterSpacing:'.08em', color:st.fg, display:'block', marginBottom:2}}>{st.label.toUpperCase()}</span>
                      <span style={{fontSize:12.5, display:'block', color:'var(--ink)'}}>{iss.message}</span>
                      {iss.hint && <span style={{fontSize:11.5, display:'block', color:'var(--ink-2)', marginTop:2}}>{iss.hint}</span>}
                    </div>
                  );
                })}
              </div>
            </div>

            <div style={{border:'1px solid var(--line)', padding:14}}>
              <div className="row-flex" style={{justifyContent:'space-between', marginBottom:4}}>
                <span style={{fontSize:12.5, color:'var(--ink-2)'}}>Parts</span>
                <span className="mono">{pcMoney(totals.partsSubtotal)}</span>
              </div>
              <div className="row-flex" style={{justifyContent:'space-between', marginBottom:8}}>
                <span style={{fontSize:12.5, color:'var(--ink-2)'}}>Labour</span>
                <span className="mono">{pcMoney(totals.labourSubtotal)}</span>
              </div>
              <div className="row-flex" style={{gap:6, marginBottom:8}}>
                <select className="input" style={{flex:1, fontSize:12}} value={form.discountType || 'percent'} onChange={e => setForm(f => ({ ...f, discountType: e.target.value }))}>
                  <option value="percent">Discount %</option>
                  <option value="fixed">Discount $</option>
                </select>
                <input className="input" type="number" style={{width:82}} value={form.discountValue ?? ''} placeholder="0"
                  onChange={e => setForm(f => ({ ...f, discountValue: e.target.value }))} aria-label="Discount value"/>
              </div>
              {discountAmount > 0 && (
                <div className="row-flex" style={{justifyContent:'space-between', marginBottom:6}}>
                  <span style={{fontSize:12.5, color:'var(--ink-2)'}}>Discount</span>
                  <span className="mono" style={{color:'var(--rust)'}}>-{pcMoney(discountAmount)}</span>
                </div>
              )}
              <div className="row-flex" style={{justifyContent:'space-between', paddingTop:8, borderTop:'1px solid var(--line)'}}>
                <span style={{fontWeight:600}}>Quote total</span>
                <span className="mono" style={{fontWeight:700, fontSize:16}}>{pcMoney(grandTotal)}</span>
              </div>
              <div className="row-flex" style={{justifyContent:'space-between', marginTop:6}}>
                <span style={{fontSize:11.5, color:'var(--ink-2)'}}>Parts cost / margin</span>
                <span className="mono" style={{fontSize:11.5, color:'var(--ink-2)'}}>{pcMoney(totals.partsCost)} / {pcMoney(grandTotal - totals.partsCost)}</span>
              </div>
            </div>
          </div>
        </div>
      </OrderPage>

      {picking && (
        <PcPartPicker
          category={picking}
          items={form.items}
          parts={parts}
          colourTheme={form.colourTheme || ''}
          onPick={addPart}
          onClose={() => setPicking(null)}
          onNewPart={() => { setNewPart(blankPcPart(picking)); setPicking(null); }}
        />
      )}
      {newPart && (
        <PcPartEditor
          part={newPart}
          onClose={() => setNewPart(null)}
          onSaved={(item) => { addPart(item); setNewPart(null); }}
          onDeleted={() => setNewPart(null)}
        />
      )}
      <style>{`
        .pc-builder-grid { display: grid; grid-template-columns: minmax(0, 1fr) 320px; gap: 28px; align-items: start; }
        .pc-builder-aside { position: sticky; top: 18px; }
        @media (max-width: 900px) {
          .pc-builder-grid { grid-template-columns: minmax(0, 1fr); }
          .pc-builder-aside { position: static; }
        }
      `}</style>
    </>
  );
}

function AdminPcBuilder({ search }) {
  const [partCount, setPartCount] = useState(0);
  const [builds, setBuilds] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useUrlState('tab', 'builds');
  const [openId, setOpenId] = useUrlState('open', null, { push: true });
  const [edit, setEdit] = useState(null);

  const loadBuilderData = React.useCallback(() => (
    fetch('/api/admin/pc-builder', { credentials:'include' })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(d => { setPartCount(d.partCount || 0); setBuilds(d.builds || []); setSuppliers(d.suppliers || []); })
      .catch(() => {})
  ), []);

  useEffect(() => {
    loadBuilderData().finally(() => setLoading(false));
    fetch('/api/admin/customers', { credentials:'include' })
      .then(r => r.ok ? r.json() : Promise.reject()).then(d => setCustomers(d.items || [])).catch(() => {});
    fetch('/api/admin/catalog', { credentials:'include' })
      .then(r => r.ok ? r.json() : Promise.reject()).then(d => setProducts(d.products || [])).catch(() => {});
  }, []);

  const blankBuild = () => ({ id:'', ref:'', name:'', cust:'', email:'', phone:'', loc:'', shippingAddress:'', items:[], labour:[], discountType:'percent', discountValue:'', validDays:30, notes:'', status:'draft' });

  useEffect(() => {
    const cur = edit === null ? null : (edit.id || 'new');
    if (openId === cur) return;
    if (openId == null) { setEdit(null); return; }
    if (openId === 'new') { setEdit(blankBuild()); return; }
    const b = builds.find(x => x.id === openId);
    if (b) setEdit(b);
  }, [openId, builds]);

  if (edit !== null) {
    return (
      <PcBuildPage
        build={edit}
        customers={customers}
        onClose={() => setOpenId(null)}
        onSave={(saved, isNew) => setBuilds(bs => isNew ? [saved, ...bs] : bs.map(b => b.id === saved.id ? saved : b))}
        onDelete={(id) => { setBuilds(bs => bs.filter(b => b.id !== id)); setOpenId(null); }}
      />
    );
  }

  const q = (search || '').toLowerCase().trim();
  const visibleBuilds = !q ? builds : builds.filter(b =>
    (b.ref || '').toLowerCase().includes(q) ||
    (b.name || '').toLowerCase().includes(q) ||
    (b.cust || '').toLowerCase().includes(q)
  );

  return (
    <div style={{padding:32}}>
      <div className="row-flex" style={{justifyContent:'space-between', marginBottom:14, flexWrap:'wrap', gap:10}}>
        <div className="tabs tabs-row" style={{margin:0}}>
          {[['builds', `Builds (${builds.length})`], ['parts', `Parts library (${partCount.toLocaleString()})`], ['sources', 'Data sources'], ['suppliers', `Supplier feeds (${suppliers.length})`]].map(([k, l]) => (
            <div key={k} role="button" tabIndex={0} className={`tab ${tab === k ? 'active' : ''}`} style={{cursor:'pointer'}}
              onClick={() => setTab(k)}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setTab(k); } }}>{l}</div>
          ))}
        </div>
        {tab === 'builds' && <button className="btn btn-rust btn-sm" onClick={() => setOpenId('new')}>+ New build</button>}
      </div>

      {tab === 'builds' ? (
        <Table
          loading={loading}
          columns={[
            { key:'ref', label:'Build #', w:'110px', sort:true, render:r => <span className="mono" style={{fontSize:12, color:'var(--rust)'}}>{r.ref || r.id}</span> },
            { key:'name', label:'Build', w:'2fr', sort:true, render:r => r.name || 'Untitled build' },
            { key:'cust', label:'Customer', w:'1.4fr', sort:true, render:r => r.cust || '-' },
            { key:'parts', label:'Parts', w:'70px', sort:r => (r.items || []).length, render:r => <span className="mono" style={{fontSize:12}}>{(r.items || []).length}</span> },
            { key:'issues', label:'Issues', w:'110px', render:r => {
              const s = r.issueSummary || {};
              if (s.errors) return <span className="mono" style={{fontSize:11, color:'var(--rust)'}}>{s.errors} blocker{s.errors > 1 ? 's' : ''}</span>;
              if (s.warnings) return <span className="mono" style={{fontSize:11, color:'var(--ink-2)'}}>{s.warnings} to check</span>;
              return <span className="mono" style={{fontSize:11, color:'var(--ink-3)'}}>clear</span>;
            } },
            { key:'status', label:'Status', w:'100px', sort:r => r.status || 'draft', render:r => <StatusPill value={r.status || 'draft'} map={PC_BUILD_STATUS_MAP}/> },
            { key:'quoteRef', label:'Quote', w:'100px', render:r => r.quoteRef
              ? <a className="mono" style={{fontSize:11}} href={`/quotes?open=${encodeURIComponent(r.quoteId)}`} onClick={e => e.stopPropagation()}>{r.quoteRef}</a>
              : <span style={{color:'var(--ink-3)'}}>-</span> },
          ]}
          rows={visibleBuilds}
          onRowClick={r => setOpenId(r.id)}
          emptyMessage="No builds yet. Start one and pick parts from the library."
          defaultSort={{ key:'ref', dir:'desc' }}
        />
      ) : tab === 'parts' ? (
        <PcPartsLibrary products={products} onLibraryChanged={loadBuilderData}/>
      ) : tab === 'sources' ? (
        <PcDataSources onPartsReload={loadBuilderData}/>
      ) : (
        <PcSuppliers suppliers={suppliers} onSuppliersChange={setSuppliers} onPartsReload={loadBuilderData}/>
      )}
    </div>
  );
}

// ============================================================
// HDD CONDITION REPORTS
// ============================================================
function blankHddReport() {
  return {
    type: 'repair',
    repairJobId: '', customerName: '', customerEmail: '', customerPhone: '',
    linkedProductId: '', linkedVariantSku: '',
    driveModel: '', driveSerial: '', driveCapacity: '', driveInterface: '', driveFormFactor: '', driveManufactureDate: '',
    smartStatus: 'PASS', reallocatedSectors: 0, pendingSectors: 0, uncorrectableSectors: 0, powerOnHours: '', powerCycles: '', temperature: '', smartNotes: '',
    udmaCrcErrors: 0, reportedUncorrect: 0, spinRetryCount: 0, loadCycleCount: '', startStopCount: '', gSenseErrorRate: 0, wearPercent: '', totalBytesWritten: '',
    conditionNotes: '', verdict: 'healthy', recommendation: '', notes: '', technician: '',
  };
}

const SMARTCTL_SCAN_CMD = 'sudo smartctl --scan';
// Tries auto-detect, then forces SATA/NVMe/SCSI passthrough in turn and keeps the first
// attempt that actually returns SMART data, works across USB bridge chips without the
// tech needing to know or guess which -d type the enclosure needs.
const SMARTCTL_READ_CMD = [
  'D=/dev/sdX',
  'for t in "" sat nvme scsi; do',
  '  if [ -z "$t" ]; then FLAG=""; else FLAG="-d $t"; fi',
  '  OUT=$(sudo smartctl -a -j $FLAG "$D" 2>/dev/null)',
  '  echo "$OUT" | grep -qE "smart_status|nvme_smart_health_information_log" && break',
  'done',
  'echo "$OUT"',
].join('\n');

function AdminHddReports({ sessionInfo = {} }) {
  const [reports, setReports] = useState([]);
  const [edit, setEdit] = useState(null);
  const [form, setForm] = useState({});
  const [smartPaste, setSmartPaste] = useState('');
  const [smartParsing, setSmartParsing] = useState(false);
  const [products, setProducts] = useState([]);
  const [pendingCerts, setPendingCerts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [repairJobs, setRepairJobs] = useState([]);
  const [openId, setOpenId] = useUrlState('open', null, { push: true });
  const dirty = useDirtyTracker(form, edit);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const [customerQuery, setCustomerQuery] = useState('');
  const [customerDropdownOpen, setCustomerDropdownOpen] = useState(false);
  const applyCustomer = (c) => {
    setCustomerQuery(c ? `${c.name}${c.email ? ` (${c.email})` : ''}` : '');
    setCustomerDropdownOpen(false);
    if (c) setForm(f => ({ ...f, customerName: c.name || f.customerName, customerEmail: c.email || f.customerEmail, customerPhone: c.phone || f.customerPhone }));
  };
  const customerMatches = useMemo(() => {
    const q = customerQuery.trim().toLowerCase();
    if (!q) return (customers || []).slice(0, 8);
    return (customers || []).filter(c => (c.name||'').toLowerCase().includes(q) || (c.email||'').toLowerCase().includes(q) || (c.phone||'').toLowerCase().includes(q)).slice(0, 8);
  }, [customers, customerQuery]);

  const [jobQuery, setJobQuery] = useState('');
  const [jobDropdownOpen, setJobDropdownOpen] = useState(false);
  const applyJob = (j) => {
    setJobQuery(j ? `${j.id}${j.customer ? ` - ${j.customer}` : ''}` : '');
    setJobDropdownOpen(false);
    if (j) setForm(f => ({ ...f, repairJobId: j.id, customerName: j.customer || f.customerName, customerEmail: j.email || f.customerEmail, customerPhone: j.phone || f.customerPhone }));
  };
  const jobMatches = useMemo(() => {
    const q = jobQuery.trim().toLowerCase();
    if (!q) return (repairJobs || []).slice(0, 8);
    return (repairJobs || []).filter(j => (j.id||'').toLowerCase().includes(q) || (j.customer||'').toLowerCase().includes(q)).slice(0, 8);
  }, [repairJobs, jobQuery]);

  const reloadPendingCerts = () => {
    fetch('/api/admin/orders', { credentials:'include' })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(d => setPendingCerts((d.items || []).filter(o => o.pendingCertificatePrint)))
      .catch(() => setPendingCerts([]));
  };
  const markPrinted = async (orderId) => {
    const r = await fetch('/api/admin/orders/certificate-printed', { method:'POST', headers:postHeaders(), credentials:'include', body: JSON.stringify({ orderId }) }).catch(()=>null);
    if (!r || !r.ok) { adminToast('Failed to mark certificate as printed.'); return; }
    setPendingCerts(cs => cs.filter(o => o.id !== orderId));
  };

  const copyCmd = (cmd) => {
    navigator.clipboard?.writeText(cmd).then(() => adminToast('Command copied.', 'success')).catch(() => adminToast('Could not copy command.'));
  };

  const doParseSmart = async () => {
    if (!smartPaste.trim()) return;
    setSmartParsing(true);
    const r = await fetch('/api/admin/hdd-reports/parse-smart', { method:'POST', headers:postHeaders(), credentials:'include', body: JSON.stringify({ output: smartPaste }) }).catch(()=>null);
    setSmartParsing(false);
    if (!r) { adminToast('Could not reach the server, please try again.'); return; }
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { adminToast(d.message || 'Could not parse that output, make sure you ran smartctl with the -j flag.'); return; }
    const n = Object.keys(d.fields || {}).length;
    if (!n) { adminToast('No recognisable fields found in that output.'); return; }
    setForm(f => ({ ...f, ...d.fields }));
    adminToast(`Autofilled ${n} field${n===1?'':'s'} from smartctl.`, 'success');
  };

  useEffect(() => {
    fetch('/api/admin/hdd-reports', { credentials:'include' })
      .then(r => r.ok ? r.json() : Promise.reject()).then(d => setReports(d.items || [])).catch(() => setReports([]));
    fetch('/api/admin/catalog', { credentials:'include' })
      .then(r => r.ok ? r.json() : Promise.reject()).then(d => setProducts(d.products || [])).catch(() => setProducts([]));
    fetch('/api/admin/customers', { credentials:'include' })
      .then(r => r.ok ? r.json() : Promise.reject()).then(d => setCustomers(d.items || [])).catch(() => setCustomers([]));
    fetch('/api/admin/repairs', { credentials:'include' })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(d => setRepairJobs((d.columns||[]).flatMap(c => (c.cards||[]).map(cd => ({ id: cd.id, customer: cd.customer || cd.name, email: cd.email, phone: cd.phone })))))
      .catch(() => setRepairJobs([]));
    reloadPendingCerts();
  }, []);

  const openRow = (r) => setOpenId(r.id);
  const openNew = () => setOpenId('new');

  // Reconcile the open report editor with the URL's `open` param (restore on
  // reload + Back/Forward), same as Orders/Quotes/Expenses/Repairs.
  useEffect(() => {
    const cur = edit === null ? null : (edit.id || 'new');
    if (openId === cur) return;
    if (openId == null) { setEdit(null); return; }
    if (openId === 'new') {
      setEdit({});
      setForm({ ...blankHddReport(), technician: sessionInfo.username || '' });
      setCustomerQuery(''); setJobQuery('');
      return;
    }
    const r = reports.find(x => x.id === openId);
    if (r) {
      setEdit(r);
      setForm({ ...blankHddReport(), ...r });
      setCustomerQuery(r.customerName ? `${r.customerName}${r.customerEmail ? ` (${r.customerEmail})` : ''}` : '');
      setJobQuery(r.repairJobId || '');
    }
  }, [openId, reports]);

  const verdictMap = {
    healthy:  { bg:'#d8e7d0', fg:'#345526' },
    degraded: { bg:'var(--ochre)', fg:'var(--dark)' },
    failing:  { bg:'var(--rust)', fg:'#fff' },
  };

  const save = async () => {
    const r = await fetch('/api/admin/hdd-reports/save', { method:'POST', headers:postHeaders(), credentials:'include', body: JSON.stringify(form) }).catch(()=>null);
    if (r && r.ok) {
      const d = await r.json();
      if (!edit.id) setReports(rs => [...rs, d.item]); else setReports(rs => rs.map(x => x.id === edit.id ? d.item : x));
      setOpenId(null);
    } else {
      adminToast('Failed to save report, changes not persisted.');
    }
  };

  const del = async () => {
    if (!form.id || !(await adminConfirm(`Delete report ${form.id}? This cannot be undone.`, { title:'Delete report', confirmLabel:'Delete', danger:true }))) return;
    const r = await fetch('/api/admin/hdd-reports/delete', { method:'POST', headers:postHeaders(), credentials:'include', body: JSON.stringify({ id: form.id }) }).catch(()=>null);
    if (!r || !r.ok) { adminToast('Failed to delete report.'); return; }
    setReports(rs => rs.filter(x => x.id !== form.id));
    setOpenId(null);
  };

  const doPrintPdf = async () => {
    const r = await fetch('/api/admin/hdd-reports/pdf', { method:'POST', headers:postHeaders(), credentials:'include', body: JSON.stringify(form) }).catch(()=>null);
    if (!r || !r.ok) { adminToast('Failed to generate PDF.'); return; }
    const blob = await r.blob();
    window.open(URL.createObjectURL(blob), '_blank');
  };

  if (edit !== null) return (
    <HddReportPage
      edit={edit} form={form} set={set} setForm={setForm} sessionInfo={sessionInfo}
      products={products} dirty={dirty}
      smartPaste={smartPaste} setSmartPaste={setSmartPaste} smartParsing={smartParsing} doParseSmart={doParseSmart} copyCmd={copyCmd}
      customerQuery={customerQuery} setCustomerQuery={setCustomerQuery} customerDropdownOpen={customerDropdownOpen} setCustomerDropdownOpen={setCustomerDropdownOpen} customerMatches={customerMatches} applyCustomer={applyCustomer}
      jobQuery={jobQuery} setJobQuery={setJobQuery} jobDropdownOpen={jobDropdownOpen} setJobDropdownOpen={setJobDropdownOpen} jobMatches={jobMatches} applyJob={applyJob}
      onClose={() => setOpenId(null)} onSave={save} onDelete={del} onPrintPdf={doPrintPdf}
    />
  );

  return (
    <div style={{padding:32}}>
      {pendingCerts.length > 0 && (
        <div style={{marginBottom:24}}>
          <span className="eyebrow">Certificates to print ({pendingCerts.length})</span>
          <div style={{display:'grid', gap:10, marginTop:10}}>
            {pendingCerts.map(o => (
              <div key={o.id} style={{padding:16, background:'var(--paper)', border:'1px solid var(--line)', borderLeft:'3px solid var(--ochre)', display:'flex', justifyContent:'space-between', alignItems:'center', gap:16}}>
                <div>
                  <div style={{fontWeight:600}}>{o.cust || 'Unknown customer'}</div>
                  <div className="mono" style={{fontSize:11, color:'var(--ink-2)', marginTop:4}}>
                    Order {o.id} · {o.pendingCertificatePrint.driveModel || 'Drive'}{o.pendingCertificatePrint.driveSerial ? ` · ${o.pendingCertificatePrint.driveSerial}` : ''}
                  </div>
                </div>
                <button className="btn btn-ghost btn-sm" onClick={() => markPrinted(o.id)}>Mark printed</button>
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="row-flex" style={{justifyContent:'space-between', marginBottom:18}}>
        <span className="mono" style={{fontSize:11, color:'var(--ink-2)'}}>{reports.length} REPORT{reports.length===1?'':'S'}</span>
        <button className="btn btn-rust btn-sm" onClick={openNew}>+ New report</button>
      </div>
      <Table
        columns={[
          { key:'id', label:'#', w:'110px', sort:true, render:r => <span className="mono" style={{fontSize:11, color:'var(--rust)'}}>{r.id}</span> },
          { key:'createdAt', label:'Date', w:'120px', sort:true, render:r => <span className="mono" style={{fontSize:11, color:'var(--ink-2)'}}>{r.createdAt ? new Date(r.createdAt).toLocaleDateString('en-AU') : '-'}</span> },
          { key:'type', label:'Type', w:'100px', sort:true, render:r => <span className="tag tag-outline">{(r.type||'repair').toUpperCase()}</span> },
          { key:'drive', label:'Drive', w:'1.5fr', render:r => <span>{r.driveModel || '-'}{r.driveSerial ? <span className="mono" style={{color:'var(--ink-2)', fontSize:11}}> · {r.driveSerial}</span> : null}</span> },
          { key:'who', label:'Customer / job', w:'1.5fr', render:r => {
            if (r.type === 'repair') return <span style={{fontSize:13, color:'var(--ink-2)'}}>{r.customerName || r.repairJobId || '-'}</span>;
            const linkedProduct = products.find(p => p.id === r.linkedProductId);
            return linkedProduct
              ? <span style={{fontSize:13, color:'var(--ink-2)'}}>For sale · {linkedProduct.name}</span>
              : <span style={{fontSize:13, color:'var(--ink-3)'}}>For sale</span>;
          } },
          { key:'verdict', label:'Verdict', w:'120px', sort:true, render:r => <StatusPill value={r.verdict || 'healthy'} map={verdictMap} /> },
        ]}
        rows={reports}
        onRowClick={openRow}
        defaultSort={{ key:'createdAt', dir:'desc' }}
        emptyMessage="No hard drive condition reports yet."
      />

    </div>
  );
}

function HddReportPage({ edit, form, set, setForm, sessionInfo, products, dirty, smartPaste, setSmartPaste, smartParsing, doParseSmart, copyCmd,
  customerQuery, setCustomerQuery, customerDropdownOpen, setCustomerDropdownOpen, customerMatches, applyCustomer,
  jobQuery, setJobQuery, jobDropdownOpen, setJobDropdownOpen, jobMatches, applyJob,
  onClose, onSave, onDelete, onPrintPdf }) {
  return (
    <OrderPage onClose={onClose} dirty={dirty} backLabel="Back to HDD Reports" title={edit.id ? `Report ${edit.id}` : 'New HDD condition report'}
      footer={<div className="row-flex" style={{justifyContent:'space-between'}}>
        {edit.id ? <button className="btn btn-ghost btn-sm" style={{color:'var(--rust)'}} onClick={onDelete}>Delete</button> : <span/>}
        <div className="row-flex" style={{gap:8}}>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>Cancel</button>
          <button className="btn btn-ghost btn-sm" onClick={onPrintPdf}>Print / PDF</button>
          <button className="btn btn-sm" onClick={onSave}>Save</button>
        </div>
      </div>}
    >
          <div style={{padding:14, background:'var(--bg-elev)', border:'1px solid var(--line)', marginBottom:18}}>
            <span className="eyebrow">Autofill from smartctl (Linux)</span>
            <p style={{fontSize:12, color:'var(--ink-2)', margin:'6px 0 8px'}}>
              On the bench PC, find the drive then read its full S.M.A.R.T. data as JSON. Paste the output below and click Autofill.
            </p>
            <div style={{display:'grid', gridTemplateColumns:'minmax(0, 1fr)', gap:10, marginBottom:10}}>
              <div style={{minWidth:0}}>
                <div style={{fontSize:11, color:'var(--ink-3)', marginBottom:2}}>1. List drives to find the device (e.g. /dev/sda, /dev/nvme0)</div>
                <div className="row-flex" style={{gap:6, width:'100%', flexWrap:'nowrap'}}>
                  <code className="mono" style={{flex:1, minWidth:0, padding:'6px 8px', background:'var(--paper)', border:'1px solid var(--line)', fontSize:12, overflowX:'auto', whiteSpace:'pre'}}>{SMARTCTL_SCAN_CMD}</code>
                  <button type="button" className="btn btn-ghost btn-sm" style={{flexShrink:0}} onClick={() => copyCmd(SMARTCTL_SCAN_CMD)}>Copy</button>
                </div>
              </div>
              <div style={{minWidth:0}}>
                <div style={{fontSize:11, color:'var(--ink-3)', marginBottom:2}}>2. Read it - set D to the device found above, then paste the whole block into the terminal. It tries auto-detect, SATA, NVMe and SCSI passthrough in turn and keeps whichever one actually returns data, so it works through USB bridge chips without you needing to know the right -d type.</div>
                <pre className="mono" style={{margin:0, minWidth:0, padding:'8px', background:'var(--paper)', border:'1px solid var(--line)', fontSize:12, overflowX:'auto', whiteSpace:'pre'}}>{SMARTCTL_READ_CMD}</pre>
                <button type="button" className="btn btn-ghost btn-sm" style={{marginTop:4}} onClick={() => copyCmd(SMARTCTL_READ_CMD)}>Copy</button>
              </div>
            </div>
            <textarea className="textarea" rows={4} value={smartPaste} onChange={e=>setSmartPaste(e.target.value)} placeholder="Paste the full smartctl JSON output here…"/>
            <button type="button" className="btn btn-rust btn-sm" style={{marginTop:8}} disabled={!smartPaste.trim() || smartParsing} onClick={doParseSmart}>
              {smartParsing ? 'Parsing…' : 'Autofill from output'}
            </button>
            <p style={{fontSize:11, color:'var(--ink-3)', margin:'8px 0 0'}}>
              Requires smartmontools (<code className="mono">sudo apt install smartmontools</code> if not already installed). Fills model, serial, capacity, interface, SMART status, counters, and suggests an overall verdict from the SMART data, form factor, manufacture date and physical condition still need your eyes on the drive, and the suggested verdict is a starting point, not a certification, so check it against what you actually see before saving. If all four attempts fail, paste whatever it printed anyway - the error message tells you what to try next.
            </p>
          </div>

          <label className="field"><span className="label">Report type</span>
            <select className="select" value={form.type||'repair'} onChange={e=>set('type', e.target.value)}>
              <option value="repair">Repair job (customer recommendation)</option>
              <option value="sale">For sale (pre-sale inspection)</option>
            </select>
          </label>

          {form.type === 'repair' && (
            <>
              <label className="field" style={{position:'relative'}}><span className="label">Repair job</span>
                <input className="input" style={{fontFamily:'monospace'}} placeholder="Search by job # or customer…" value={jobQuery}
                  onChange={e => { setJobQuery(e.target.value); setJobDropdownOpen(true); }}
                  onFocus={() => setJobDropdownOpen(true)}
                  onBlur={() => setTimeout(() => setJobDropdownOpen(false), 150)}
                />
                {jobDropdownOpen && (
                  <div style={{position:'absolute', top:'100%', left:0, right:0, zIndex:20, background:'var(--bg)', border:'1px solid var(--line)', boxShadow:'0 4px 12px rgba(0,0,0,.12)', maxHeight:240, overflowY:'auto'}}>
                    <div role="button" tabIndex={0} onMouseDown={e => { e.preventDefault(); applyJob(null); }}
                      style={{padding:'8px 12px', fontSize:13, cursor:'pointer', color:'var(--rust)', borderBottom:'1px solid var(--line)'}}>No job link{jobQuery.trim() ? `, keep "${jobQuery.trim()}" as typed` : ''}</div>
                    {jobMatches.length === 0 && <div style={{padding:'8px 12px', fontSize:12, color:'var(--ink-3)'}}>No matching jobs.</div>}
                    {jobMatches.map(j => (
                      <div key={j.id} role="button" tabIndex={0} onMouseDown={e => { e.preventDefault(); applyJob(j); }} style={{padding:'8px 12px', fontSize:13, cursor:'pointer'}}>
                        <div style={{fontWeight:600, fontFamily:'monospace', fontSize:12}}>{j.id}</div>
                        <div style={{fontSize:11, color:'var(--ink-3)'}}>{j.customer || '-'}</div>
                      </div>
                    ))}
                  </div>
                )}
              </label>
              <label className="field" style={{position:'relative'}}><span className="label">Customer</span>
                <input className="input" placeholder="Search by name, email, or phone…" value={customerQuery}
                  onChange={e => { setCustomerQuery(e.target.value); setCustomerDropdownOpen(true); }}
                  onFocus={() => setCustomerDropdownOpen(true)}
                  onBlur={() => setTimeout(() => setCustomerDropdownOpen(false), 150)}
                />
                {customerDropdownOpen && (
                  <div style={{position:'absolute', top:'100%', left:0, right:0, zIndex:20, background:'var(--bg)', border:'1px solid var(--line)', boxShadow:'0 4px 12px rgba(0,0,0,.12)', maxHeight:240, overflowY:'auto'}}>
                    <div role="button" tabIndex={0} onMouseDown={e => { e.preventDefault(); applyCustomer(null); }}
                      style={{padding:'8px 12px', fontSize:13, cursor:'pointer', color:'var(--rust)', borderBottom:'1px solid var(--line)'}}>Not on file{customerQuery.trim() ? `, keep "${customerQuery.trim()}" as typed` : ''}</div>
                    {customerMatches.length === 0 && <div style={{padding:'8px 12px', fontSize:12, color:'var(--ink-3)'}}>No matching customers.</div>}
                    {customerMatches.map(c => (
                      <div key={c.id} role="button" tabIndex={0} onMouseDown={e => { e.preventDefault(); applyCustomer(c); }} style={{padding:'8px 12px', fontSize:13, cursor:'pointer'}}>
                        <div style={{fontWeight:600}}>{c.name}</div>
                        <div style={{fontSize:11, color:'var(--ink-3)'}}>{[c.email, c.phone].filter(Boolean).join(' · ') || '-'}</div>
                      </div>
                    ))}
                  </div>
                )}
              </label>
              <div className="grid-2" style={{gap:10, marginBottom:10}}>
                <label className="field" style={{margin:0}}><span className="label">Customer name</span><input className="input" value={form.customerName||''} onChange={e=>set('customerName', e.target.value)}/></label>
                <label className="field" style={{margin:0}}><span className="label">Customer email</span><input className="input" value={form.customerEmail||''} onChange={e=>set('customerEmail', e.target.value)}/></label>
              </div>
              <label className="field"><span className="label">Customer phone</span><input className="input" value={form.customerPhone||''} onChange={e=>set('customerPhone', e.target.value)}/></label>
            </>
          )}

          {form.type === 'sale' && (() => {
            const linkedProduct = products.find(p => p.id === form.linkedProductId);
            const variants = (linkedProduct && linkedProduct.variants) || [];
            return (
              <>
                <label className="field"><span className="label">Linked product</span>
                  <select className="select" value={form.linkedProductId||''} onChange={e=>setForm(f=>({...f, linkedProductId:e.target.value, linkedVariantSku:''}))}>
                    <option value="">not linked</option>
                    {products.map(p => <option key={p.id} value={p.id}>{p.name} {p.sku ? `(${p.sku})` : ''}</option>)}
                  </select>
                </label>
                {linkedProduct && variants.length > 0 && (
                  <label className="field"><span className="label">Linked variant</span>
                    <select className="select" value={form.linkedVariantSku||''} onChange={e=>set('linkedVariantSku', e.target.value)}>
                      <option value="">Any variant of this product</option>
                      {variants.map(v => <option key={v.sku} value={v.sku}>{v.name} {v.sku ? `(${v.sku})` : ''}</option>)}
                    </select>
                  </label>
                )}
                {linkedProduct && (
                  <p style={{fontSize:11, color:'var(--ink-3)', margin:'-4px 0 14px'}}>
                    When a customer buys{variants.length > 0 && form.linkedVariantSku ? ` the "${(variants.find(v=>v.sku===form.linkedVariantSku)||{}).name || form.linkedVariantSku}" variant of` : ''} this product, this certificate is emailed to them automatically and a print job appears above.
                  </p>
                )}
              </>
            );
          })()}

          <hr className="thin"/>
          <span className="eyebrow">Drive identification</span>
          <div className="grid-2" style={{gap:10, margin:'10px 0'}}>
            <label className="field" style={{margin:0}}><span className="label">Model</span><input className="input" value={form.driveModel||''} onChange={e=>set('driveModel', e.target.value)} placeholder="e.g. Seagate Barracuda ST2000DM008"/></label>
            <label className="field" style={{margin:0}}><span className="label">Serial number</span><input className="input" style={{fontFamily:'monospace'}} value={form.driveSerial||''} onChange={e=>set('driveSerial', e.target.value)}/></label>
          </div>
          <div className="grid-2" style={{gap:10, marginBottom:10}}>
            <label className="field" style={{margin:0}}><span className="label">Capacity</span><input className="input" value={form.driveCapacity||''} onChange={e=>set('driveCapacity', e.target.value)} placeholder="e.g. 2TB"/></label>
            <label className="field" style={{margin:0}}><span className="label">Interface</span><input className="input" value={form.driveInterface||''} onChange={e=>set('driveInterface', e.target.value)} placeholder="e.g. SATA III / NVMe"/></label>
          </div>
          <div className="grid-2" style={{gap:10, marginBottom:10}}>
            <label className="field" style={{margin:0}}><span className="label">Form factor</span><input className="input" value={form.driveFormFactor||''} onChange={e=>set('driveFormFactor', e.target.value)} placeholder="e.g. 3.5&quot; / 2.5&quot; / M.2"/></label>
            <label className="field" style={{margin:0}}><span className="label">Manufacture date</span><input className="input" value={form.driveManufactureDate||''} onChange={e=>set('driveManufactureDate', e.target.value)}/></label>
          </div>

          <hr className="thin"/>
          <span className="eyebrow">S.M.A.R.T. data</span>
          <label className="field" style={{marginTop:10}}><span className="label">Overall status</span>
            <select className="select" value={form.smartStatus||'PASS'} onChange={e=>set('smartStatus', e.target.value)}>
              {['PASS','CAUTION','FAIL'].map(s => <option key={s}>{s}</option>)}
            </select>
          </label>
          <div className="grid-2" style={{gap:10, marginBottom:10}}>
            <label className="field" style={{margin:0}}><span className="label">Reallocated sectors</span><input className="input" type="number" min="0" value={form.reallocatedSectors ?? 0} onChange={e=>set('reallocatedSectors', e.target.value)}/></label>
            <label className="field" style={{margin:0}}><span className="label">Pending sectors</span><input className="input" type="number" min="0" value={form.pendingSectors ?? 0} onChange={e=>set('pendingSectors', e.target.value)}/></label>
          </div>
          <div className="grid-2" style={{gap:10, marginBottom:10}}>
            <label className="field" style={{margin:0}}><span className="label">Uncorrectable sectors</span><input className="input" type="number" min="0" value={form.uncorrectableSectors ?? 0} onChange={e=>set('uncorrectableSectors', e.target.value)}/></label>
            <label className="field" style={{margin:0}}><span className="label">Power-on hours</span><input className="input" type="number" min="0" value={form.powerOnHours||''} onChange={e=>set('powerOnHours', e.target.value)}/></label>
          </div>
          <div className="grid-2" style={{gap:10, marginBottom:10}}>
            <label className="field" style={{margin:0}}><span className="label">Power cycles</span><input className="input" type="number" min="0" value={form.powerCycles||''} onChange={e=>set('powerCycles', e.target.value)}/></label>
            <label className="field" style={{margin:0}}><span className="label">Temperature (°C)</span><input className="input" type="number" value={form.temperature||''} onChange={e=>set('temperature', e.target.value)}/></label>
          </div>

          <span className="eyebrow" style={{display:'block', marginTop:14}}>Additional counters</span>
          <div className="grid-2" style={{gap:10, margin:'10px 0'}}>
            <label className="field" style={{margin:0}}><span className="label">UDMA CRC errors</span><input className="input" type="number" min="0" value={form.udmaCrcErrors ?? 0} onChange={e=>set('udmaCrcErrors', e.target.value)}/></label>
            <label className="field" style={{margin:0}}><span className="label">Reported uncorrectable</span><input className="input" type="number" min="0" value={form.reportedUncorrect ?? 0} onChange={e=>set('reportedUncorrect', e.target.value)}/></label>
          </div>
          <div className="grid-2" style={{gap:10, marginBottom:10}}>
            <label className="field" style={{margin:0}}><span className="label">Spin retry count</span><input className="input" type="number" min="0" value={form.spinRetryCount ?? 0} onChange={e=>set('spinRetryCount', e.target.value)}/></label>
            <label className="field" style={{margin:0}}><span className="label">G-sense error rate</span><input className="input" type="number" min="0" value={form.gSenseErrorRate ?? 0} onChange={e=>set('gSenseErrorRate', e.target.value)}/></label>
          </div>
          <div className="grid-2" style={{gap:10, marginBottom:10}}>
            <label className="field" style={{margin:0}}><span className="label">Load cycle count</span><input className="input" type="number" min="0" value={form.loadCycleCount||''} onChange={e=>set('loadCycleCount', e.target.value)}/></label>
            <label className="field" style={{margin:0}}><span className="label">Start/stop count</span><input className="input" type="number" min="0" value={form.startStopCount||''} onChange={e=>set('startStopCount', e.target.value)}/></label>
          </div>
          <div className="grid-2" style={{gap:10, marginBottom:10}}>
            <label className="field" style={{margin:0}}><span className="label">SSD/NVMe wear (%)</span><input className="input" type="number" min="0" max="100" value={form.wearPercent||''} onChange={e=>set('wearPercent', e.target.value)} placeholder="NVMe only"/></label>
            <label className="field" style={{margin:0}}><span className="label">Total bytes written</span><input className="input" value={form.totalBytesWritten||''} onChange={e=>set('totalBytesWritten', e.target.value)} placeholder="e.g. 12.4 TB"/></label>
          </div>

          <label className="field"><span className="label">SMART notes</span>
            <textarea className="textarea" rows={2} value={form.smartNotes||''} onChange={e=>set('smartNotes', e.target.value)} placeholder="Raw attribute readout, anything notable..."/>
          </label>

          <hr className="thin"/>
          <label className="field"><span className="label">Physical condition</span>
            <textarea className="textarea" rows={3} value={form.conditionNotes||''} onChange={e=>set('conditionNotes', e.target.value)} placeholder="Casing, connectors, unusual noise, physical damage..."/>
          </label>

          <label className="field"><span className="label">Overall verdict</span>
            <select className="select" value={form.verdict||'healthy'} onChange={e=>set('verdict', e.target.value)}>
              <option value="healthy">Healthy</option>
              <option value="degraded">Degraded</option>
              <option value="failing">Failing</option>
            </select>
          </label>

          {form.type === 'repair' && (
            <label className="field"><span className="label">Recommendation to customer</span>
              <textarea className="textarea" rows={3} value={form.recommendation||''} onChange={e=>set('recommendation', e.target.value)} placeholder="e.g. Drive is degrading, recommend backing up immediately and replacing within 2-4 weeks."/>
            </label>
          )}

          <label className="field"><span className="label">Internal notes</span>
            <textarea className="textarea" rows={2} value={form.notes||''} onChange={e=>set('notes', e.target.value)} placeholder="Staff-only notes..."/>
          </label>

          <label className="field"><span className="label">Prepared by</span><input className="input" value={form.technician||''} onChange={e=>set('technician', e.target.value)}/></label>

          <div style={{padding:'10px 12px', background:'var(--bg-elev)', border:'1px solid var(--line)', fontSize:11, color:'var(--ink-2)'}}>
            {form.signedBy
              ? <>Signed by <strong>{form.signedBy}</strong>{form.signedAt ? ` · ${new Date(form.signedAt).toLocaleString('en-AU')}` : ''}, will be re-signed as {sessionInfo.username || 'you'} on next save.</>
              : <>Will be signed electronically as <strong>{sessionInfo.username || 'you'}</strong> when saved.</>}
          </div>
    </OrderPage>
  );
}

// ============================================================
// BOOKINGS
// ============================================================
function AdminBookings() {
  const [bookings, setBookings] = useState([]);
  const [edit, setEdit] = useState(null);
  const [form, setForm] = useState({});
  const [statusTab, setStatusTab] = useUrlState('tab', 'all');
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetch('/api/admin/bookings', { credentials:'include' })
      .then(r => r.ok ? r.json() : Promise.reject()).then(d => setBookings(d.items || [])).catch(() => setBookings([]));
  }, []);

  const open = (b) => { setEdit(b); setForm({ status: b.status || 'new' }); };

  const statusMap = {
    'new':       { bg:'var(--rust)', fg:'#fff' },
    'pending':   { bg:'var(--rust)', fg:'#fff' },
    'confirmed': { bg:'var(--ochre)', fg:'var(--dark)' },
    'completed': { bg:'#d8e7d0', fg:'#345526' },
    'cancelled': { bg:'var(--bg-deep)', fg:'var(--ink-2)' },
  };

  const typeLabel = { dropoff: 'Drop-off', appointment: 'Appointment', callout: 'Callout' };

  const q = search.trim().toLowerCase();
  const visibleBookings = useMemo(() => {
    let out = bookings;
    if (statusTab !== 'all') out = out.filter(b => (b.status || 'new') === statusTab);
    if (q) out = out.filter(b =>
      (b.name || b.username || '').toLowerCase().includes(q) ||
      (b.email || '').toLowerCase().includes(q) ||
      (b.device || b.serviceName || '').toLowerCase().includes(q)
    );
    return out;
  }, [bookings, statusTab, q]);

  const tabCounts = useMemo(() => ({
    all: bookings.length,
    new: bookings.filter(b => (b.status||'new') === 'new').length,
    pending: bookings.filter(b => b.status === 'pending').length,
    confirmed: bookings.filter(b => b.status === 'confirmed').length,
    completed: bookings.filter(b => b.status === 'completed').length,
    cancelled: bookings.filter(b => b.status === 'cancelled').length,
  }), [bookings]);

  return (
    <div style={{padding:32, display:'grid', gap:24}}>
      <div className="row-flex" style={{justifyContent:'space-between', flexWrap:'wrap', gap:10}}>
        <div className="tabs tabs-row" style={{margin:0}}>
          {[['all','All'],['new','New'],['pending','Pending'],['confirmed','Confirmed'],['completed','Completed'],['cancelled','Cancelled']].map(([k,l]) => (
            <div key={k} role="button" tabIndex={0} className={`tab ${statusTab===k?'active':''}`} style={{cursor:'pointer'}}
              onClick={() => setStatusTab(k)}
              onKeyDown={e => { if (e.key==='Enter'||e.key===' ') { e.preventDefault(); setStatusTab(k); } }}>{l} ({tabCounts[k]})</div>
          ))}
        </div>
        <input className="input" style={{maxWidth:260}} placeholder="Search name, email, device…" value={search} onChange={e=>setSearch(e.target.value)} />
      </div>
      <Table
        columns={[
          { key:'id', label:'#', w:'120px', render:r => <span className="mono" style={{fontSize:11, color:'var(--rust)'}}>{r.id}</span> },
          { key:'type', label:'Type', w:'120px', render:r => <span className="tag tag-outline">{(typeLabel[r.type] || (r.serviceName ? 'Portal' : r.type) || '-').toUpperCase()}</span> },
          { key:'name', label:'Name', w:'1.5fr', render:r => r.name || r.username || '-' },
          { key:'when', label:'When', w:'160px', render:r => <span className="mono" style={{fontSize:11}}>{r.preferredDate || r.date || '-'}{(r.preferredTime || r.time) ? ` · ${r.preferredTime || r.time}` : ''}</span> },
          { key:'device', label:'Device / Service', w:'1.5fr', render:r => <span style={{fontSize:13, color:'var(--ink-2)'}}>{r.device || r.serviceName || '-'}</span> },
          { key:'status', label:'Status', w:'120px', render:r => <StatusPill value={r.status || 'new'} map={statusMap} /> },
        ]}
        rows={visibleBookings}
        onRowClick={open}
      />
      {visibleBookings.length === 0 && <div style={{ padding: 24, background: 'var(--paper)', border: '1px solid var(--line)', fontSize: 13, color: 'var(--ink-2)', textAlign: 'center' }}>{bookings.length === 0 ? 'No bookings yet.' : 'No bookings match this filter.'}</div>}

      {edit !== null && (
        <Drawer open={true} onClose={() => setEdit(null)} title={`Booking ${edit.id}`}
          footer={<div className="row-flex" style={{justifyContent:'space-between'}}>
            <button className="btn btn-ghost btn-sm" style={{color:'var(--rust)'}} onClick={async () => {
              if (!(await adminConfirm(`Delete booking ${edit.id}? This cannot be undone.`, { title: 'Delete booking', confirmLabel: 'Delete', danger: true }))) return;
              const r = await fetch('/api/admin/bookings/delete', { method:'POST', headers:postHeaders(), credentials:'include', body: JSON.stringify({ id: edit.id }) }).catch(()=>null);
              if (!r || !r.ok) { adminToast('Failed to delete booking.'); return; }
              setBookings(bs => bs.filter(b => b.id !== edit.id));
              setEdit(null);
            }}>Delete</button>
            <div className="row-flex" style={{gap:8}}>
              <button className="btn btn-ghost btn-sm" onClick={() => setEdit(null)}>Cancel</button>
              <button className="btn btn-sm" onClick={async () => {
                const r = await fetch('/api/admin/bookings/update', { method:'POST', headers:postHeaders(), credentials:'include', body: JSON.stringify({ id: edit.id, status: form.status }) }).catch(()=>null);
                if (r && r.ok) {
                  const d = await r.json();
                  setBookings(bs => bs.map(b => b.id === edit.id ? d.booking : b));
                  setEdit(null);
                } else {
                  adminToast('Failed to save booking, changes not persisted.');
                }
              }}>Save</button>
            </div>
          </div>}
        >
          <div className="term" style={{marginBottom:16}}>
            <div>name     : {edit.name || edit.username || '-'}</div>
            <div>email    : {edit.email || '-'}</div>
            <div>phone    : {edit.phone || '-'}</div>
            <div>when     : {edit.preferredDate || edit.date || '-'}{(edit.preferredTime || edit.time) ? ` · ${edit.preferredTime || edit.time}` : ''}</div>
            <div>device   : {edit.device || edit.serviceName || '-'}</div>
            {edit.address && <div>address  : {edit.address}</div>}
            {edit.notes && <div>notes    : {edit.notes}</div>}
          </div>
          <label className="field"><span className="label">Status</span>
            <select className="select" value={form.status||'new'} onChange={e=>setForm({...form,status:e.target.value})}>
              {['new','pending','confirmed','completed','cancelled'].map(s => <option key={s}>{s}</option>)}
            </select>
          </label>
        </Drawer>
      )}
    </div>
  );
}

// ============================================================
// AVAILABILITY
// ============================================================
const WEEKDAY_DEFS = [
  { k:'mon', l:'Monday' }, { k:'tue', l:'Tuesday' }, { k:'wed', l:'Wednesday' },
  { k:'thu', l:'Thursday' }, { k:'fri', l:'Friday' }, { k:'sat', l:'Saturday' }, { k:'sun', l:'Sunday' },
];

function fmtYMD(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

const WEEKDAY_KEYS_AVAIL = ['sun','mon','tue','wed','thu','fri','sat'];

function AdminAvailability() {
  const [avail, setAvail] = useState(null);
  const [hoursForm, setHoursForm] = useState(null);
  const [savingHours, setSavingHours] = useState(false);
  const [monthCursor, setMonthCursor] = useState(() => { const d = new Date(); d.setDate(1); return d; });
  const [slotDay, setSlotDay] = useState(null);

  const load = () => {
    fetch('/api/admin/availability', { credentials:'include' })
      .then(r => r.ok ? r.json() : Promise.reject()).then(d => { setAvail(d); setHoursForm(d.operatingHours); }).catch(() => {});
  };
  useEffect(load, []);

  const saveHours = async () => {
    setSavingHours(true);
    const r = await fetch('/api/admin/availability/hours', { method:'POST', headers:postHeaders(), credentials:'include', body: JSON.stringify({ operatingHours: hoursForm }) }).catch(()=>null);
    setSavingHours(false);
    if (r && r.ok) { adminToast('Operating hours saved.'); load(); }
    else adminToast('Failed to save operating hours.');
  };

  const toggleBlockDate = async (date) => {
    const r = await fetch('/api/admin/availability/block-date', { method:'POST', headers:postHeaders(), credentials:'include', body: JSON.stringify({ date }) }).catch(()=>null);
    if (r && r.ok) { const d = await r.json(); setAvail(a => ({ ...a, blockedDates: d.blockedDates })); }
    else adminToast('Failed to update day.');
  };

  const toggleBlockSlot = async (date, time) => {
    const r = await fetch('/api/admin/availability/block-slot', { method:'POST', headers:postHeaders(), credentials:'include', body: JSON.stringify({ date, time }) }).catch(()=>null);
    if (r && r.ok) { const d = await r.json(); setAvail(a => ({ ...a, blockedSlots: d.blockedSlots })); }
    else adminToast('Failed to update slot.');
  };

  if (!avail || !hoursForm) return <div style={{padding:32, color:'var(--ink-2)'}}>Loading…</div>;

  const year = monthCursor.getFullYear(), month = monthCursor.getMonth();
  const firstOfMonth = new Date(year, month, 1);
  const startOffset = firstOfMonth.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));

  const todayYMD = fmtYMD(new Date());

  const slotsForSlotDay = slotDay ? (() => {
    const WEEKDAY_KEYS = ['sun','mon','tue','wed','thu','fri','sat'];
    const dayKey = WEEKDAY_KEYS[new Date(slotDay + 'T00:00:00').getDay()];
    const hours = avail.operatingHours[dayKey];
    if (!hours || hours.closed) return [];
    const [openH, openM] = hours.open.split(':').map(Number);
    const [closeH, closeM] = hours.close.split(':').map(Number);
    const out = [];
    for (let m = openH*60+openM; m < closeH*60+closeM; m += 30) {
      out.push(`${String(Math.floor(m/60)).padStart(2,'0')}:${String(m%60).padStart(2,'0')}`);
    }
    return out;
  })() : [];

  return (
    <div style={{padding:32, display:'grid', gap:24}}>
      <div className="card-paper" style={{padding:24}}>
        <span className="eyebrow">OPERATING HOURS</span>
        <p style={{fontSize:13, color:'var(--ink-2)', marginTop:6, marginBottom:16}}>Customers can only book online within these hours. Outside them, the booking page tells them to call.</p>
        <div style={{display:'grid', gap:10}}>
          {WEEKDAY_DEFS.map(({k,l}) => (
            <div key={k} className="row-flex" style={{gap:12, alignItems:'center'}}>
              <span style={{width:100, fontSize:13}}>{l}</span>
              <label style={{display:'flex', alignItems:'center', gap:6, fontSize:12, color:'var(--ink-2)'}}>
                <input type="checkbox" checked={!hoursForm[k].closed} onChange={e => setHoursForm(f => ({ ...f, [k]: { ...f[k], closed: !e.target.checked } }))} />
                Open
              </label>
              <input type="time" className="input" style={{width:120}} disabled={hoursForm[k].closed} value={hoursForm[k].open}
                onChange={e => setHoursForm(f => ({ ...f, [k]: { ...f[k], open: e.target.value } }))} />
              <span style={{color:'var(--ink-3)'}}>to</span>
              <input type="time" className="input" style={{width:120}} disabled={hoursForm[k].closed} value={hoursForm[k].close}
                onChange={e => setHoursForm(f => ({ ...f, [k]: { ...f[k], close: e.target.value } }))} />
            </div>
          ))}
        </div>
        <div style={{marginTop:16}}>
          <button className="btn btn-sm" disabled={savingHours} onClick={saveHours}>{savingHours ? 'Saving…' : 'Save hours'}</button>
        </div>
      </div>

      <div className="card-paper" style={{padding:24}}>
        <div className="row-flex" style={{justifyContent:'space-between', marginBottom:12}}>
          <span className="eyebrow">CALENDAR - CLICK A DAY TO BLOCK IT ENTIRELY</span>
          <div className="row-flex" style={{gap:8}}>
            <button className="btn btn-ghost btn-sm" onClick={() => setMonthCursor(c => new Date(c.getFullYear(), c.getMonth()-1, 1))}><Icon name="chevronLeft" size={12}/></button>
            <span className="mono" style={{fontSize:12, minWidth:120, textAlign:'center'}}>{monthCursor.toLocaleString('en-AU',{month:'long', year:'numeric'})}</span>
            <button className="btn btn-ghost btn-sm" onClick={() => setMonthCursor(c => new Date(c.getFullYear(), c.getMonth()+1, 1))}><Icon name="chevronRight" size={12}/></button>
          </div>
        </div>
        <div style={{display:'grid', gridTemplateColumns:'repeat(7, 1fr)', gap:6}}>
          {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => (
            <div key={d} className="mono" style={{fontSize:10, color:'var(--ink-3)', textAlign:'center'}}>{d}</div>
          ))}
          {cells.map((d, i) => {
            if (!d) return <div key={i} />;
            const ymd = fmtYMD(d);
            const blocked = avail.blockedDates.includes(ymd);
            const dayKey = WEEKDAY_KEYS_AVAIL[d.getDay()];
            const closedByHours = !blocked && !!avail.operatingHours[dayKey]?.closed;
            const hasBlockedSlots = (avail.blockedSlots[ymd] || []).length > 0;
            const isPast = ymd < todayYMD;
            return (
              <div key={i}
                onClick={() => !isPast && toggleBlockDate(ymd)}
                title={closedByHours ? 'Closed every week on this day (set in operating hours)' : undefined}
                style={{
                  padding:'10px 4px', textAlign:'center', cursor: isPast ? 'default' : 'pointer', borderRadius:4,
                  border:'1px solid var(--line)', fontSize:13, position:'relative',
                  background: blocked ? 'var(--rust)' : closedByHours ? 'var(--bg-deep)' : 'var(--paper)',
                  color: blocked ? '#fff' : isPast ? 'var(--ink-3)' : closedByHours ? 'var(--ink-2)' : 'var(--ink)',
                  opacity: isPast ? 0.5 : 1,
                }}
              >
                {d.getDate()}
                {hasBlockedSlots && !blocked && <span style={{position:'absolute', bottom:3, right:3, width:5, height:5, borderRadius:'50%', background:'var(--ochre)'}} />}
                {!isPast && !blocked && (
                  <div style={{marginTop:4}}>
                    <button type="button" className="btn btn-ghost" style={{fontSize:9, padding:'1px 4px'}} onClick={e => { e.stopPropagation(); setSlotDay(ymd); }}>hours</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <div className="row-flex" style={{gap:16, marginTop:14, fontSize:11, color:'var(--ink-2)'}}>
          <span className="row-flex" style={{gap:6}}><span style={{width:10,height:10,borderRadius:'50%',background:'var(--rust)',display:'inline-block'}} /> Blocked day</span>
          <span className="row-flex" style={{gap:6}}><span style={{width:10,height:10,borderRadius:'50%',background:'var(--bg-deep)',border:'1px solid var(--line)',display:'inline-block'}} /> Closed weekly (operating hours)</span>
          <span className="row-flex" style={{gap:6}}><span style={{width:10,height:10,borderRadius:'50%',background:'var(--ochre)',display:'inline-block'}} /> Has blocked hours</span>
        </div>
      </div>

      {slotDay && (
        <Drawer open={true} onClose={() => setSlotDay(null)} title={`Block hours - ${slotDay}`}>
          {slotsForSlotDay.length === 0 ? (
            <div style={{fontSize:13, color:'var(--ink-2)'}}>No operating hours configured for this day of the week.</div>
          ) : (
            <div style={{display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:8}}>
              {slotsForSlotDay.map(t => {
                const blocked = (avail.blockedSlots[slotDay] || []).includes(t);
                return (
                  <button key={t} type="button" className={`btn btn-sm ${blocked ? 'btn-rust' : 'btn-ghost'}`}
                    onClick={() => toggleBlockSlot(slotDay, t)}>{t}</button>
                );
              })}
            </div>
          )}
        </Drawer>
      )}
    </div>
  );
}

// ============================================================
// REVIEWS
// ============================================================
function Stars({ n, size = 14 }) {
  return <span className="mono" style={{ color: 'var(--ochre)', letterSpacing: 1, fontSize: size }}>{'★'.repeat(n)}{'☆'.repeat(5 - n)}</span>;
}

function AdminReviews() {
  const [reviews, setReviews] = useState([]);
  const [activeTab, setActiveTab] = useUrlState('tab', 'pending');
  const [edit, setEdit] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch('/api/admin/reviews', { credentials: 'include' })
      .then(r => r.ok ? r.json() : Promise.reject()).then(d => setReviews(d.items || [])).catch(() => setReviews([]));
  }, []);

  const setStatus = async (status) => {
    setBusy(true);
    const r = await fetch('/api/admin/reviews/save', { method: 'POST', headers: postHeaders(), credentials: 'include', body: JSON.stringify({ ...edit, status }) }).catch(() => null);
    setBusy(false);
    if (r && r.ok) {
      const d = await r.json();
      setReviews(rs => rs.map(x => x.id === edit.id ? d.item : x));
      setEdit(null);
    } else adminToast('Failed to update review.');
  };

  const del = async () => {
    if (!(await adminConfirm('Delete this review? This cannot be undone.', { title: 'Delete review', confirmLabel: 'Delete', danger: true }))) return;
    setBusy(true);
    const r = await fetch('/api/admin/reviews/delete', { method: 'POST', headers: postHeaders(), credentials: 'include', body: JSON.stringify({ id: edit.id }) }).catch(() => null);
    setBusy(false);
    if (!r || !r.ok) { adminToast('Failed to delete review.'); return; }
    setReviews(rs => rs.filter(x => x.id !== edit.id));
    setEdit(null);
  };

  const statusMap = {
    pending: { bg: 'var(--ochre)', fg: 'var(--dark)' },
    approved: { bg: '#d8e7d0', fg: '#345526' },
    rejected: { bg: 'var(--bg-deep)', fg: 'var(--ink-2)' },
  };

  const visible = reviews.filter(r => (r.status || 'pending') === activeTab);

  return (
    <div style={{ padding: 32 }}>
      <div className="tabs" style={{ marginBottom: 18 }}>
        {[
          { key: 'pending', label: `Pending (${reviews.filter(r => (r.status || 'pending') === 'pending').length})` },
          { key: 'approved', label: `Approved (${reviews.filter(r => r.status === 'approved').length})` },
          { key: 'rejected', label: `Rejected (${reviews.filter(r => r.status === 'rejected').length})` },
        ].map(t => (
          <div key={t.key} role="button" tabIndex={0} className={`tab ${activeTab === t.key ? 'active' : ''}`}
            onClick={() => setActiveTab(t.key)}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setActiveTab(t.key); } }}
            style={{ cursor: 'pointer' }}>{t.label}</div>
        ))}
      </div>
      <div style={{ display: 'grid', gap: 12 }}>
        {visible.length === 0 && <div style={{ padding: 24, background: 'var(--paper)', border: '1px solid var(--line)', fontSize: 13, color: 'var(--ink-2)', textAlign: 'center' }}>No reviews here.</div>}
        {visible.map(r => (
          <div key={r.id} style={{ padding: 18, background: 'var(--paper)', border: '1px solid var(--line)', cursor: 'pointer' }} onClick={() => setEdit(r)}>
            <div className="row-flex" style={{ justifyContent: 'space-between' }}>
              <div className="row-flex" style={{ gap: 10 }}>
                <Stars n={r.rating} />
                <span style={{ fontWeight: 600 }}>{r.productName || 'General feedback'}</span>
              </div>
              <span className="mono" style={{ fontSize: 11, color: 'var(--ink-2)' }}>{r.createdAt ? new Date(r.createdAt).toLocaleDateString('en-AU') : ''}</span>
            </div>
            {r.title && <div style={{ marginTop: 8, fontWeight: 600, fontSize: 14 }}>{r.title}</div>}
            <p style={{ marginTop: 6, fontSize: 13, color: 'var(--ink-2)' }}>{r.body}</p>
            <div className="mono" style={{ marginTop: 10, fontSize: 11, color: 'var(--ink-3)' }}>{r.customerName || 'Customer'} · ORDER {r.orderId}</div>
          </div>
        ))}
      </div>
      {edit !== null && (
        <Drawer open={true} onClose={() => setEdit(null)} title={edit.productName || 'General feedback'}
          footer={<div className="row-flex" style={{ justifyContent: 'space-between' }}>
            <button className="btn btn-ghost btn-sm" style={{ color: 'var(--rust)' }} disabled={busy} onClick={del}>Delete</button>
            <div className="row-flex" style={{ gap: 8 }}>
              {edit.status !== 'rejected' && <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => setStatus('rejected')}>Reject</button>}
              {edit.status !== 'approved' && <button className="btn btn-sm" disabled={busy} onClick={() => setStatus('approved')}>Approve</button>}
            </div>
          </div>}
        >
          <div className="row-flex" style={{ gap: 10, marginBottom: 14 }}>
            <Stars n={edit.rating} size={18} />
            <StatusPill value={edit.status || 'pending'} map={statusMap} />
          </div>
          {edit.title && <h3 style={{ marginBottom: 10 }}>{edit.title}</h3>}
          <p style={{ fontSize: 14, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{edit.body}</p>
          {edit.photos?.length > 0 && (
            <div className="row-flex" style={{ gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
              {edit.photos.map(url => (
                <a key={url} href={url} target="_blank" rel="noopener noreferrer">
                  <img src={url} alt="" style={{ width: 90, height: 90, objectFit: 'cover', border: '1px solid var(--line)' }} />
                </a>
              ))}
            </div>
          )}
          <hr className="thin" />
          <div className="mono" style={{ fontSize: 11, color: 'var(--ink-2)', display: 'grid', gap: 6 }}>
            <div>CUSTOMER · {edit.customerName || '-'} {edit.customerEmail ? `<${edit.customerEmail}>` : ''}</div>
            <div>ORDER · {edit.orderId || '-'}</div>
            <div>ABOUT · {edit.productName || 'General feedback'}</div>
            <div>SUBMITTED · {edit.createdAt ? new Date(edit.createdAt).toLocaleString('en-AU') : '-'}</div>
          </div>
        </Drawer>
      )}
    </div>
  );
}

// ============================================================
// EWASTE
// ============================================================
function AdminEwaste() {
  const [intakes, setIntakes] = useState([]);
  const [edit, setEdit] = useState(null);
  const [form, setForm] = useState({});
  const [orders, setOrders] = useState([]);
  const [orderSearch, setOrderSearch] = useState('');
  useEffect(() => {
    fetch('/api/admin/ewaste', { credentials:'include' })
      .then(r => r.ok ? r.json() : Promise.reject()).then(d => setIntakes(d.items || [])).catch(() => setIntakes([]));
    fetch('/api/admin/orders', { credentials:'include' })
      .then(r => r.ok ? r.json() : Promise.reject()).then(d => setOrders(d.items || [])).catch(() => setOrders([]));
  }, []);
  const openIntake = (r) => { setEdit(r); setForm({...r}); setOrderSearch(''); };
  return (
    <div style={{padding:32, display:'grid', gap:24}}>
      <div className="grid-4">
        <StatTile label="INTAKE · THIS WEEK" value={intakes.filter(r => { const d = new Date(r.date); const now = new Date(); return !isNaN(d) && (now - d) < 7*24*3600*1000; }).length || 0} />
        <StatTile label="DIVERTED · YTD" value={intakes.reduce((s,r) => s + (Number(r.kg)||0), 0) + ' kg'} />
        <StatTile label="PAID OUT · MO" value={'$' + intakes.filter(r => { const d = new Date(r.date); const now = new Date(); return !isNaN(d) && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear(); }).reduce((s,r) => s + (parseFloat(r.payout?.replace(/[^0-9.]/g,''))||0), 0).toFixed(0)} />
        <StatTile label="PALLETS AWAITING SORT" value={intakes.filter(r => !r.disposition).length} tone={intakes.filter(r => !r.disposition).length > 0 ? 'rust' : undefined} />
      </div>

      <div className="admin-split" style={{display:'grid', gridTemplateColumns:'2fr 1fr', gap:24}}>
        <div>
          <div className="row-flex" style={{justifyContent:'space-between', marginBottom:12}}>
            <h3 className="serif" style={{fontSize:22}}>Recent intakes</h3>
            <button className="btn btn-rust btn-sm" onClick={() => { setEdit({}); setForm({ id:'', from:'', kg:0, items:'', tier:'', payout:'', date:'', orderId:'' }); setOrderSearch(''); }}>+ Log intake</button>
          </div>
          <Table
            columns={[
              { key:'id', label:'#', w:'120px', render:r => <span className="mono" style={{fontSize:11, color:'var(--rust)'}}>{r.id}</span>},
              { key:'from', label:'From', w:'1.5fr' },
              { key:'items', label:'Items', w:'2fr', render:r => <span style={{fontSize:13, color:'var(--ink-2)'}}>{r.items}</span> },
              { key:'serialNumber', label:'Serial', w:'140px', render:r => <span className="mono" style={{fontSize:11, color:'var(--ink-2)'}}>{r.serialNumber||'-'}</span> },
              { key:'kg', label:'Weight', w:'80px', render:r => <span className="mono">{r.kg}kg</span> },
              { key:'tier', label:'Condition', w:'110px', render:r => <span className="tag tag-outline" style={{textTransform:'capitalize'}}>{r.tier||'-'}</span> },
              { key:'disposition', label:'Disposition', w:'130px', render:r => <span className="tag tag-outline" style={{textTransform:'capitalize'}}>{r.disposition||'-'}</span> },
              { key:'payout', label:'Payout', w:'140px', render:r => <span style={{fontWeight:600}}>{r.payout}</span> },
              { key:'date', label:'When', w:'90px', render:r => <span className="mono" style={{fontSize:11, color:'var(--ink-2)'}}>{r.date.toUpperCase()}</span>},
              { key:'orderId', label:'Order', w:'120px', render:r => r.orderId ? <span className="mono" style={{fontSize:11, color:'var(--rust)', cursor:'pointer'}} onClick={e=>{e.stopPropagation(); window.location.hash='orders';}}>{r.orderId}</span> : <span style={{color:'var(--ink-3)'}}>-</span> },
            ]}
            rows={intakes}
            onRowClick={(r) => openIntake(r)}
          />
        </div>
        <div>
          <div style={{padding:20, background:'var(--paper)', border:'1px solid var(--line)'}}>
            <span className="eyebrow">PICKUP REQUESTS</span>
            <div style={{padding:18, color:'var(--ink-2)', fontSize:13}}>No pickups scheduled.</div>
          </div>
          <div style={{padding:20, background:'var(--dark)', color:'var(--paper)', marginTop:16}}>
            <span className="eyebrow" style={{color:'var(--ochre)'}}>DATA WIPE QUEUE</span>
            <div className="serif" style={{fontSize:40, marginTop:6, color:'var(--ochre)'}}>-</div>
            <div className="mono" style={{fontSize:11, color:'var(--bg-deep)'}}>NIST 800-88 · 9 PURGE / 5 SHRED</div>
          </div>
        </div>
      </div>
      {edit !== null && (
        <Drawer open={true} onClose={() => setEdit(null)} title={edit.id ? `Intake ${edit.id}` : 'New intake'}
          footer={<div className="row-flex" style={{justifyContent:'space-between'}}>
            {edit.id && <button className="btn btn-ghost btn-sm" style={{color:'var(--rust)'}} onClick={async () => {
              const r = await fetch('/api/admin/ewaste/delete', { method:'POST', headers:postHeaders(), credentials:'include', body: JSON.stringify({ id: edit.id }) }).catch(()=>null);
              if (!r || !r.ok) { adminToast('Failed to delete intake.'); return; }
              setIntakes(rs => rs.filter(r => r.id !== edit.id));
              setEdit(null);
            }}>Delete</button>}
            {!edit.id && <span/>}
            <div className="row-flex" style={{gap:8}}>
              <button className="btn btn-ghost btn-sm" onClick={() => setEdit(null)}>Cancel</button>
              <button className="btn btn-sm" onClick={async () => {
                const r = await fetch('/api/admin/ewaste/save', { method:'POST', headers:postHeaders(), credentials:'include', body: JSON.stringify(form) }).catch(()=>null);
                if (r && r.ok) {
                  const d = await r.json();
                  if (!edit.id) setIntakes(rs => [...rs, d.item]);
                  else setIntakes(rs => rs.map(row => row.id === edit.id ? d.item : row));
                } else {
                  if (!edit.id) setIntakes(rs => [...rs, form]);
                  else setIntakes(rs => rs.map(row => row.id === edit.id ? form : row));
                }
                setEdit(null);
              }}>Save</button>
            </div>
          </div>}
        >
          <label className="field"><span className="label">From</span><input className="input" value={form.from||''} onChange={e=>setForm({...form,from:e.target.value})}/></label>
          <label className="field"><span className="label">Items</span><input className="input" value={form.items||''} onChange={e=>setForm({...form,items:e.target.value})}/></label>
          <label className="field"><span className="label">Serial Number</span><input className="input" value={form.serialNumber||''} onChange={e=>setForm({...form,serialNumber:e.target.value})}/></label>
          <label className="field"><span className="label">Weight (kg)</span><input className="input" type="number" value={form.kg||0} onChange={e=>setForm({...form,kg:Number(e.target.value)})}/></label>
          <label className="field"><span className="label">Condition</span>
            <select className="input" value={form.tier||''} onChange={e=>setForm({...form,tier:e.target.value})}>
              <option value="">select</option>
              <option value="working">Working</option>
              <option value="repairable">Repairable</option>
              <option value="parts">Parts only</option>
              <option value="recycle">Recycle</option>
            </select>
          </label>
          <label className="field"><span className="label">Payout</span><input className="input" value={form.payout||''} onChange={e=>setForm({...form,payout:e.target.value})}/></label>
          <label className="field"><span className="label">Disposition</span>
            <select className="input" value={form.disposition||''} onChange={e=>setForm({...form,disposition:e.target.value})}>
              <option value="">select</option>
              <option value="resale">For resale</option>
              <option value="parts-donor">Parts donor / teardown</option>
              <option value="learning">Learning device (training)</option>
              <option value="home">For home use</option>
              <option value="business">For business use</option>
              <option value="recycling">Recycling / audited processor</option>
            </select>
          </label>
          <label className="field"><span className="label">Date</span><input className="input" type="date" value={form.date||''} onChange={e=>setForm({...form,date:e.target.value})}/></label>
          <div className="field">
            <span className="label">Linked order <span style={{fontWeight:400,color:'var(--ink-2)'}}>(optional - e.g. replaced component)</span></span>
            {(() => {
              const q = orderSearch.toLowerCase();
              const filtered = orders.filter(o =>
                !q || o.id?.toLowerCase().includes(q) || (o.cust||'').toLowerCase().includes(q)
              ).slice(0, 60);
              return (
                <div style={{display:'grid', gap:6}}>
                  <input className="input" placeholder="Search by order # or customer…" value={orderSearch} onChange={e=>setOrderSearch(e.target.value)}/>
                  <select className="input" value={form.orderId||''} onChange={e=>{
                    const oid = e.target.value;
                    const o = orders.find(o => o.id === oid);
                    const updates = { orderId: oid };
                    if (o) {
                      if (o.cust && !form.from) updates.from = o.cust;
                      if (!form.date) {
                        const raw = o.createdAt || o.date || '';
                        if (raw) {
                          const d = new Date(raw);
                          updates.date = isNaN(d) ? raw : d.toISOString().slice(0,10);
                        }
                      }
                    }
                    setForm(f => ({...f, ...updates}));
                  }} style={{fontFamily:'var(--font-mono)', fontSize:12}}>
                    <option value="">none</option>
                    {filtered.map(o => (
                      <option key={o.id} value={o.id}>{o.id}{o.cust ? ` · ${o.cust}` : ''}</option>
                    ))}
                  </select>
                  {form.orderId && !filtered.find(o=>o.id===form.orderId) && (
                    <div style={{fontSize:12,color:'var(--ink-2)'}}>Linked: <span className="mono">{form.orderId}</span></div>
                  )}
                </div>
              );
            })()}
          </div>
        </Drawer>
      )}
    </div>
  );
}

// ============================================================
// CRUD GENERIC LIST + DRAWER  (used by Products, Services, Software, AI Models)
// ============================================================
function CatalogList({ title, columns, initial, drawer, addLabel }) {
  const [rows, setRows] = useState(initial);
  const [open, setOpen] = useState(null);  // index of row being edited, or 'new'
  const [importMsg, setImportMsg] = useState('');
  const csvRef = React.useRef(null);

  const startNew = () => setOpen('new');
  const startEdit = (i) => setOpen(i);
  const save = (data) => {
    if (open === 'new') setRows(rs => [...rs, data]);
    else setRows(rs => rs.map((r,i) => i===open ? data : r));
    setOpen(null);
  };
  const remove = () => {
    if (open !== 'new') setRows(rs => rs.filter((_,i) => i!==open));
    setOpen(null);
  };

  const handleCsvImport = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const lines = (ev.target.result || '').split('\n').filter(Boolean);
      const headers = lines[0].split(',').map(h => h.trim());
      const newRows = lines.slice(1).map(line => {
        const vals = line.split(',');
        const obj = {};
        headers.forEach((h, i) => { obj[h] = (vals[i] || '').trim(); });
        return obj;
      }).filter(r => Object.values(r).some(Boolean));
      setRows(rs => [...rs, ...newRows]);
      setImportMsg(`Imported ${newRows.length} row${newRows.length !== 1 ? 's' : ''}.`);
      setTimeout(() => setImportMsg(''), 3000);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const editing = open === 'new' ? null : (open !== null ? rows[open] : null);
  return (
    <div style={{padding:32}}>
      <input ref={csvRef} type="file" accept=".csv" style={{display:'none'}} onChange={handleCsvImport} />
      <div className="row-flex" style={{justifyContent:'space-between', marginBottom:18}}>
        <div className="mono" style={{fontSize:12, color:'var(--ink-2)'}}>{rows.length} {title.toUpperCase()} · SORTED BY UPDATED{importMsg && <span style={{color:'var(--eucalyptus)', marginLeft:12}}>{importMsg}</span>}</div>
        <div className="row-flex" style={{gap:8}}>
          <button className="btn btn-ghost btn-sm" onClick={() => csvRef.current && csvRef.current.click()}>Import CSV</button>
          <button className="btn btn-rust btn-sm" onClick={startNew}>+ {addLabel}</button>
        </div>
      </div>
      <Table columns={columns} rows={rows} onRowClick={(_,i) => startEdit(i)} />
      <Drawer
        open={open !== null}
        onClose={() => setOpen(null)}
        title={open==='new' ? `New ${addLabel}` : (editing && (editing.name || editing.t || editing.title))}
        footer={
          <div className="row-flex" style={{justifyContent:'space-between'}}>
            {open !== 'new' ? <button className="btn btn-ghost btn-sm" style={{color:'var(--rust)'}} onClick={remove}>Delete</button> : <span/>}
            <div className="row-flex" style={{gap:8}}>
              <button className="btn btn-ghost btn-sm" onClick={() => setOpen(null)}>Cancel</button>
              <button className="btn btn-sm" onClick={() => save(editing || {})}>Save changes</button>
            </div>
          </div>
        }
      >
        {drawer(editing, (patch) => {
          if (open === 'new') {
            setRows(rs => {
              const next = { ...patch };
              return rs.find(() => false) ? rs : rs;
            });
          }
          // simpler: maintain a local form state via parent; for prototype, just reflect on save
        })}
      </Drawer>
    </div>
  );
}

// ============================================================
// PRODUCTS
// ============================================================
// Column captions for the variant editor rows. `.label` is scoped to
// `label.field > .label` in the page CSS, so these need their own styling.
const variantLabelStyle = { fontSize:10, letterSpacing:'.08em', textTransform:'uppercase', color:'var(--ink-3)', marginBottom:4 };

function AdminProducts({ sessionInfo = {} }) {
  const isSeller = sessionInfo.role === 'seller';
  const canAssignOwner = (ROLE_LEVELS[sessionInfo.role] ?? 0) >= ROLE_LEVELS.manager;
  const [rows, setRows] = useState([]);
  const [catOptions, setCatOptions] = useState([]);
  const [condOptions, setCondOptions] = useState(PRODUCT_CONDITIONS);
  const [brandOptions, setBrandOptions] = useState([]);
  const [ownerMembers, setOwnerMembers] = useState([]);
  useEffect(() => {
    fetch('/api/admin/catalog', { credentials:'include' })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(data => {
        const allProducts = data.products || [];
        let products = allProducts;
        if (isSeller) products = allProducts.filter(p => p.createdBy === sessionInfo.staffId);
        setRows(products.map(p => ({ ...p, cat: p.category, stock: p.stock ?? 0 })));
        setCatOptions([...new Set(allProducts.map(p => p.category).filter(Boolean))].sort());
        // Fixed vocabulary, plus any legacy value still in use so editing an
        // older product doesn't silently drop its condition.
        const inUse = [...new Set(allProducts.map(p => p.cond).filter(Boolean))].sort();
        setCondOptions([...PRODUCT_CONDITIONS, ...inUse.filter(c => !PRODUCT_CONDITIONS.includes(c))]);
        setBrandOptions([...new Set(allProducts.map(p => p.brand).filter(Boolean))].sort());
      })
      .catch(() => setRows((window.CATALOG_DATA?.getAdminProducts?.() || window.CATALOG_DATA?.getAdminCatalog?.().filter(item => item.price !== undefined) || []).map(p => ({ ...p, cat: p.category, stock: p.stock ?? 0 }))));
    if (canAssignOwner) {
      fetch('/api/admin/staff', { credentials:'include' })
        .then(r => r.ok ? r.json() : Promise.reject())
        // Any active staff member can own a listing, the shop owner and
        // staff sell their own stock too, not just consignment sellers.
        // Assigning a non-seller is safe: seller commission and the
        // force-to-draft rule key off the role of whoever saves the product,
        // not off the owner recorded here.
        .then(d => setOwnerMembers((d.members || []).filter(m => m.role && m.role !== 'pending')))
        .catch(() => {});
    }
  }, []);
  const [edit, setEdit] = useState(null);
  const [form, setForm] = useState({});
  // Explicit "typing a brand-new category" flag. Deriving this from whether
  // form.cat is in catOptions breaks while typing, the free-text box would
  // vanish the moment the partial name matched an existing category.
  const [newCat, setNewCat] = useState(false);
  const [openId, setOpenId] = useUrlState('open', null, { push: true });
  const openRow = (r) => setOpenId(r.id);
  // Dirty tracking against the last persisted snapshot, so closing the editor
  // with unsaved edits warns instead of silently discarding them.
  const savedSnapRef = React.useRef('{}');
  // A pending duplicate: the copied fields are parked here, then picked up by
  // the openId effect when it opens the editor on 'new'. Going through a ref
  // rather than setForm directly keeps the effect the only thing that seeds the
  // form, so the two cannot race and blank each other out.
  const dupRef = React.useRef(null);
  const dirty = JSON.stringify(form) !== savedSnapRef.current;
  // The footer's Cancel closes directly rather than through OrderPage's own
  // back button, so it needs the same guard.
  const closeGuarded = async () => {
    if (dirty && !await adminConfirm('You have unsaved changes that will be lost.\nClose without saving?', {
      title: 'Unsaved changes', confirmLabel: 'Discard changes', cancelLabel: 'Keep editing', danger: true,
    })) return;
    setOpenId(null);
  };

  // Reconcile the open product editor with the URL's `open` param (restore on
  // reload + Back/Forward), same as Orders/Quotes/Repairs/Expenses/HDD Reports.
  useEffect(() => {
    const cur = edit === null ? null : (edit === 'new' ? 'new' : edit.id);
    if (openId === cur) return;
    setNewCat(false);
    if (openId == null) { setEdit(null); return; }
    if (openId === 'new') {
      const dup = dupRef.current;
      dupRef.current = null;
      const blank = dup || { id:'', sku:'', status:'draft', cat: catOptions[0] || '', cond: condOptions[0] || '', stock:0, priceAud:0 };
      setEdit('new'); setForm(blank);
      // A duplicate starts dirty on purpose: nothing of it is saved yet, so
      // closing the editor should warn rather than quietly bin the copy.
      savedSnapRef.current = dup ? '{}' : JSON.stringify(blank);
      return;
    }
    const r = rows.find(x => x.id === openId);
    if (r) { setEdit(r); setForm(r); savedSnapRef.current = JSON.stringify(r); }
  }, [openId, rows]);

  // A failed save used to fall through to the same optimistic row update as a
  // successful one, so a 403, a 422 or a dropped connection looked identical to
  // success and left the admin believing a product was saved when it was not.
  const [saveError, setSaveError] = useState(null);
  const [saving, setSaving] = useState(false);
  const save = async () => {
    if (saving) return;
    setSaving(true);
    setSaveError(null);
    const { _inCarts: _ignored, ...formData } = form;
    const item = { ...formData, category: form.cat };
    const r = await fetch('/api/admin/catalog/products/save', {
      method: 'POST', headers: postHeaders(),
      credentials: 'include', body: JSON.stringify(item),
    }).catch(() => null);
    if (!r) { setSaving(false); setSaveError('Could not reach the server. Your changes have not been saved.'); return; }
    if (!r.ok) {
      const d = await r.json().catch(() => ({}));
      setSaving(false);
      setSaveError(d.message || `Save failed (${r.status}). Your changes have not been saved.`);
      return;
    }
    const d = await r.json().catch(() => ({}));
    if (!d.item) { setSaving(false); setSaveError('The server returned an unexpected response. Reload before making further changes.'); return; }
    // The API speaks `category`; the table rows use `cat`. Without this the
    // saved row's Category column reads blank until the next page load.
    const saved = { ...d.item, cat: d.item.category };
    if (edit === 'new') setRows(rs => [...rs, saved]);
    else setRows(rs => rs.map(row => row.id === edit.id ? saved : row));
    if (saved.cat && !catOptions.includes(saved.cat)) setCatOptions(cs => [...cs, saved.cat].sort());
    savedSnapRef.current = JSON.stringify(form);
    setSaving(false);
    setOpenId(null);
  };
  // Copy the open listing into a fresh, unsaved draft. Everything carries over
  // except the things that must not be shared between two listings: the id and
  // SKUs (blank, so the server assigns new ones on save), the published status
  // and the "was" price, which is a claim about what this particular listing
  // has actually charged.
  const duplicate = async () => {
    if (dirty && !await adminConfirm('This product has unsaved changes. They will be copied into the duplicate but not saved here.\nContinue?', {
      title: 'Unsaved changes', confirmLabel: 'Duplicate anyway', cancelLabel: 'Keep editing',
    })) return;
    const { id: _id, sku: _sku, _inCarts: _c, ...rest } = form;
    dupRef.current = {
      ...rest,
      id: '', sku: '', status: 'draft',
      name: form.name ? `${form.name} (copy)` : '',
      was: '', wasPriceConfirmed: false,
      ...(Array.isArray(form.variants) ? { variants: form.variants.map(v => ({ ...v, sku: '' })) } : {}),
    };
    setSaveError(null);
    setOpenId('new');
  };
  const remove = async () => {
    const item = edit;
    if (!await adminConfirm(`Delete "${item.name || 'this product'}"? This cannot be undone.`, { title: 'Delete product', confirmLabel: 'Delete', danger: true })) return;
    setSaveError(null);
    const r = await fetch('/api/admin/catalog/products/delete', {
      method: 'POST', headers: postHeaders(),
      credentials: 'include', body: JSON.stringify({ id: item.id }),
    }).catch(() => null);
    if (!r || !r.ok) {
      const d = r ? await r.json().catch(() => ({})) : {};
      setSaveError(d.message || 'Delete failed. The product has not been removed.');
      return;
    }
    setRows(rs => rs.filter(row => row.id !== item.id));
    setOpenId(null);
  };
  const [bulkError, setBulkError] = useState(null);
  const [tab, setTab] = useState('all');
  // Who is waiting on an out-of-stock product. The email goes out
  // automatically when stock returns; this is so staff can see the demand.
  const [waiting, setWaiting] = useState([]);
  useEffect(() => {
    fetch('/api/admin/stock-notify', { credentials:'include' })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(d => setWaiting(d.requests || []))
      .catch(() => {});
  }, []);
  const dismissWaiting = async (id) => {
    const r = await fetch('/api/admin/stock-notify/delete', {
      method:'POST', headers:postHeaders(), credentials:'include', body: JSON.stringify({ id }),
    }).catch(() => null);
    if (r && r.ok) setWaiting(ws => ws.filter(w => w.id !== id));
  };
  const moveAllToDraft = async () => {
    if (!await adminConfirm(
      `Unpublish all ${rows.length} products? Every listing comes off the public shop until republished individually.`,
      { title: 'Move all to draft', confirmLabel: 'Unpublish all', danger: true },
    )) return;
    setBulkError(null);
    const r = await fetch('/api/admin/catalog/products/status', { method:'POST', headers:postHeaders(), credentials:'include', body: JSON.stringify({ status:'draft' }) }).catch(() => null);
    if (!r || !r.ok) { setBulkError('Could not move products to draft. Nothing has been changed.'); return; }
    setRows(rs => rs.map(r2 => ({ ...r2, status:'draft' })));
  };

  // Stock for a product is the sum of its variants when it has any.
  const rowStock = (r) => (r.variants && r.variants.length ? r.variants.reduce((a, v) => a + (Number(v.stock) || 0), 0) : (Number(r.stock) || 0));
  const TABS = [
    { key:'all',       label:'All',          match: () => true },
    { key:'published', label:'Published',    match: r => r.status === 'published' },
    { key:'draft',     label:'Draft',        match: r => r.status !== 'published' },
    { key:'oos',       label:'Out of stock', match: r => !r.infiniteStock && !r.allowBackorder && rowStock(r) <= 0 },
    { key:'owed',      label:'Owed',         match: r => rowStock(r) < 0 },
    { key:'refurb',    label:'Refurbished',  match: r => (r.cond || '').toLowerCase().startsWith('refurb') },
  ];
  const visibleRows = rows.filter((TABS.find(t => t.key === tab) || TABS[0]).match);

  if (edit !== null) {
    return (
      <OrderPage onClose={() => setOpenId(null)} dirty={dirty} backLabel="Back to Products" title={edit==='new'?'New product':form.name}
        footer={<div>
          {saveError && (
            <div role="alert" style={{marginBottom:12, padding:'10px 14px', border:'1px solid var(--rust)', color:'var(--rust)', fontSize:13}}>{saveError}</div>
          )}
          <div className="row-flex" style={{justifyContent:'space-between'}}>
            {edit!=='new' && <button className="btn btn-ghost btn-sm" style={{color:'var(--rust)'}} onClick={remove}>Delete</button>}
            <div className="row-flex" style={{gap:8, marginLeft:'auto'}}>
              {edit!=='new' && <button className="btn btn-ghost btn-sm" onClick={duplicate}>Duplicate</button>}
              <button className="btn btn-ghost btn-sm" onClick={closeGuarded}>Cancel</button>
              <button className="btn btn-sm" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
            </div>
          </div>
        </div>}
      >
          <div style={{marginBottom:18}}>
            <div className="eyebrow" style={{marginBottom:8}}>IMAGES</div>
            <div style={{display:'flex', flexWrap:'wrap', gap:8, marginBottom:8}}>
              {(form.images||[]).map((url,i) => {
                const imgs = form.images || [];
                const move = (to) => {
                  if (to < 0 || to >= imgs.length) return;
                  const next = [...imgs];
                  const [moved] = next.splice(i, 1);
                  next.splice(to, 0, moved);
                  setForm({...form, images: next});
                };
                return (
                <div key={url} style={{width:110}}>
                  <div style={{position:'relative', width:110, height:80}}>
                    <img src={url} loading="lazy" alt={(form.imageAlts||{})[url] || 'Product image'} style={{width:110, height:80, objectFit:'cover', border: i===0 ? '2px solid var(--rust)' : '1px solid var(--line)'}} />
                    <button title="Remove image" aria-label="Remove image" onClick={() => setForm({...form, images: imgs.filter((_,j)=>j!==i)})}
                      style={{position:'absolute',top:2,right:2,background:'rgba(0,0,0,0.6)',color:'#fff',border:'none',borderRadius:2,width:18,height:18,cursor:'pointer',fontSize:12,lineHeight:'18px',padding:0}}>×</button>
                    {i===0 && <span className="mono" style={{position:'absolute',bottom:2,left:2,background:'var(--rust)',color:'#fff',fontSize:8,letterSpacing:'.08em',padding:'1px 4px'}}>COVER</span>}
                  </div>
                  {/* The first image is the cover everywhere on the public site,
                      so the order has to be changeable without re-uploading. */}
                  <div style={{display:'flex', gap:4, marginTop:4}}>
                    <button type="button" title="Move left" aria-label="Move image left" disabled={i===0} onClick={() => move(i-1)}
                      style={{flex:1, border:'1px solid var(--line)', background:'var(--bg-elev)', cursor: i===0?'not-allowed':'pointer', opacity: i===0?0.4:1, fontSize:11}}>◀</button>
                    <button type="button" title="Move right" aria-label="Move image right" disabled={i===imgs.length-1} onClick={() => move(i+1)}
                      style={{flex:1, border:'1px solid var(--line)', background:'var(--bg-elev)', cursor: i===imgs.length-1?'not-allowed':'pointer', opacity: i===imgs.length-1?0.4:1, fontSize:11}}>▶</button>
                  </div>
                  <input className="input" placeholder="Alt text" aria-label={`Alt text for image ${i+1}`}
                    value={(form.imageAlts||{})[url] || ''}
                    onChange={e => setForm({...form, imageAlts: {...(form.imageAlts||{}), [url]: e.target.value}})}
                    style={{marginTop:4, fontSize:11, padding:'4px 6px'}} />
                </div>
                );
              })}
              <label style={{width:110,height:80,border:'2px dashed var(--line)',display:'grid',placeItems:'center',cursor:'pointer',fontSize:11,color:'var(--ink-3)',flexShrink:0}}>
                <span>+ Add</span>
                {/* Multi-select: a product usually gets its whole photo set in
                    one go, so uploading them one file at a time is needless
                    work. Files upload in the order they were picked, and each
                    one is appended as it lands so a failure part-way through
                    still keeps what already uploaded. */}
                <input type="file" accept="image/*" multiple style={{display:'none'}} onChange={async e => {
                  const files = Array.from(e.target.files || []);
                  e.target.value = '';
                  if (!files.length) return;
                  const failed = [];
                  for (const file of files) {
                    try {
                      const url = await uploadImage(file);
                      setForm(f => ({...f, images:[...(f.images||[]), url]}));
                    } catch (err) {
                      failed.push(file.name + ' (' + (err?.message || 'unknown error') + ')');
                    }
                  }
                  if (failed.length) alert('Image upload failed for:\n' + failed.join('\n'));
                }} />
              </label>
            </div>
          </div>
          <div className="grid-2" style={{gap:14}}>
            <label className="field">
              <span className="label">SKU <span style={{fontWeight:400, color:'var(--ink-3)', fontSize:11}}>assigned on save</span></span>
              <input className="input mono" value={form.sku||''} readOnly tabIndex={-1}
                placeholder="OHE[cat][nnn] on save"
                style={{background:'var(--bg-elev)', color:'var(--ink-2)', cursor:'default'}} />
            </label>
            <label className="field"><span className="label">Status</span>
              <select className="select" value={form.status||'draft'} onChange={e=>setForm({...form, status:e.target.value})}>
                <option value="draft">Draft</option><option value="published">Published</option>
              </select>
            </label>
          </div>
          <label className="field"><span className="label">Name</span><input className="input" value={form.name||''} onChange={e=>setForm({...form, name:e.target.value})}/></label>
          <div className="grid-2" style={{gap:14}}>
            <label className="field"><span className="label">Category</span>
              <select className="select" value={!newCat && catOptions.includes(form.cat) ? form.cat : '__new__'} onChange={e => {
                if (e.target.value === '__new__') { setNewCat(true); setForm({...form, cat: ''}); }
                else { setNewCat(false); setForm({...form, cat: e.target.value}); }
              }}>
                {catOptions.map(c => <option key={c} value={c}>{c}</option>)}
                <option value="__new__">+ New category…</option>
              </select>
              {(newCat || !catOptions.includes(form.cat)) && (
                <input className="input" style={{marginTop:6}} placeholder="Type new category name" value={form.cat||''} onChange={e=>setForm({...form, cat:e.target.value})} autoFocus />
              )}
            </label>
            <label className="field"><span className="label">Condition</span>
              <select className="select" value={form.cond} onChange={e=>setForm({...form, cond:e.target.value})}>
                {condOptions.map(c => <option key={c}>{c}</option>)}
              </select>
            </label>
          </div>
          <div className="grid-2" style={{gap:14}}>
            <label className="field">
              <span className="label">Brand <span style={{fontWeight:400, color:'var(--ink-3)', fontSize:11}}>optional, drives the shop's brand filter</span></span>
              {/* Free text with a datalist rather than a select: brands are
                  derived from products in use, so the first product of a new
                  brand has nothing to pick from. */}
              <input className="input" list="product-brand-options" placeholder="e.g. Victron" value={form.brand||''} onChange={e=>setForm({...form, brand:e.target.value})} />
              <datalist id="product-brand-options">
                {brandOptions.map(b => <option key={b} value={b} />)}
              </datalist>
            </label>
            <div />
          </div>
          <label className="field" style={{flexDirection:'row', alignItems:'center', gap:10}}>
            <input type="checkbox" checked={!!form.digital} onChange={e=>setForm({...form, digital:e.target.checked, stock: e.target.checked && form.infiniteStock ? null : (form.stock||0)})} />
            <span className="label" style={{marginBottom:0}}>Digital product (gift card, software licence, download)</span>
          </label>
          <div className="grid-2" style={{gap:14}}>
            <label className="field"><span className="label">Price (AUD)</span><input className="input" type="number" value={form.priceAud ?? form.price ?? 0} onChange={e=>setForm({...form, priceAud:Number(e.target.value), price:undefined})}/></label>
            <label className="field">
              <span className="label">Cost Price (AUD) <span style={{fontWeight:400, color:'var(--ink-3)', fontSize:11}}>internal, for stock reports</span></span>
              <input className="input" type="number" step="0.01" min="0" placeholder="0.00" value={form.costPrice||''} onChange={e=>setForm({...form, costPrice:e.target.value ? Number(e.target.value) : ''})} />
            </label>
          </div>
          <div className="grid-2" style={{gap:14}}>
            <label className="field">
              <span className="label">Was price (AUD) <span style={{fontWeight:400, color:'var(--ink-3)', fontSize:11}}>optional, shown struck through next to the price</span></span>
              <input className="input" type="number" step="0.01" min="0" placeholder="0.00" value={form.was||''} onChange={e=>setForm({...form, was:e.target.value ? Number(e.target.value) : ''})} />
            </label>
            <div />
          </div>
          {!!form.was && (
            <label className="field" style={{flexDirection:'row', alignItems:'flex-start', gap:10}}>
              <input type="checkbox" style={{marginTop:3}} checked={!!form.wasPriceConfirmed} onChange={e=>setForm({...form, wasPriceConfirmed:e.target.checked})} />
              <span className="label" style={{marginBottom:0, fontWeight:400}}>I confirm this was a genuine price we actually charged for this product for a reasonable period, in line with Australian Consumer Law "was/now" pricing requirements.</span>
            </label>
          )}
          <div className="grid-2" style={{gap:14}}>
            <label className="field">
              <span className="label">Bulk from qty <span style={{fontWeight:400, color:'var(--ink-3)', fontSize:11}}>optional, 0 for none</span></span>
              <input className="input" type="number" min="0" step="1" placeholder="0" value={form.bulkQty||''} onChange={e=>setForm({...form, bulkQty:e.target.value ? Number(e.target.value) : ''})} />
            </label>
            <label className="field">
              <span className="label">Bulk price each (AUD)</span>
              <input className="input" type="number" min="0" step="0.01" placeholder="0.00" value={form.bulkPrice||''} onChange={e=>setForm({...form, bulkPrice:e.target.value ? Number(e.target.value) : ''})} />
            </label>
          </div>
          {!!(form.bulkQty && form.bulkPrice) && (
            <div style={{fontSize:12, color:'var(--ink-2)', marginTop:-6, marginBottom:4}}>
              Buying {form.bulkQty}+ charges ${Number(form.bulkPrice).toLocaleString()} each instead of ${Number(form.priceAud ?? form.price ?? 0).toLocaleString()}.
              {' '}The offer hides itself once stock drops below {form.bulkQty}.
            </div>
          )}
          <div className="grid-2" style={{gap:14}}>
            <div></div>
            <div className="field">
              <span className="label">Stock on hand</span>
              {form.digital ? (
                <div style={{display:'flex', flexDirection:'column', gap:6}}>
                  <label style={{display:'flex', alignItems:'center', gap:8, fontSize:13}}>
                    <input type="radio" name="stockMode" checked={!!form.infiniteStock} onChange={() => setForm({...form, infiniteStock:true, stock:null})} />
                    Unlimited (digital / no physical limit)
                  </label>
                  <label style={{display:'flex', alignItems:'center', gap:8, fontSize:13}}>
                    <input type="radio" name="stockMode" checked={!form.infiniteStock} onChange={() => setForm({...form, infiniteStock:false, stock: form.stock ?? 0})} />
                    Fixed quantity:&nbsp;
                    {!form.infiniteStock && <input className="input" type="number" style={{width:80}} value={form.stock||0} onChange={e=>setForm({...form, stock:Number(e.target.value)})} />}
                  </label>
                </div>
              ) : (
                <input className="input" type="number" value={form.stock||0} onChange={e=>setForm({...form, stock:Number(e.target.value)})}/>
              )}
            </div>
          </div>
          <label className="field" style={{flexDirection:'row', alignItems:'flex-start', gap:10, marginTop:10}}>
            <input type="checkbox" style={{marginTop:3}} checked={!!form.allowBackorder}
              onChange={e=>setForm({...form, allowBackorder:e.target.checked})} />
            <span className="label" style={{marginBottom:0, fontWeight:400}}>
              Accept backorders. Customers can keep buying once stock reaches zero, and the
              stock figure goes negative to show how many units are owed.
            </span>
          </label>
          {!!form.allowBackorder && (
            <div className="grid-2" style={{gap:14}}>
              <label className="field">
                <span className="label">Backorder lead time (weeks) <span style={{fontWeight:400, color:'var(--ink-3)', fontSize:11}}>shown to the customer before they buy</span></span>
                <input className="input" type="number" min="1" step="1" placeholder="e.g. 3"
                  value={form.backorderWeeks ?? ''}
                  onChange={e=>setForm({...form, backorderWeeks: e.target.value === '' ? '' : Math.max(1, Math.floor(Number(e.target.value) || 1))})} />
              </label>
              <div />
            </div>
          )}
          {(form.variants && form.variants.length > 0) && (
            <div style={{fontSize:12, color:'var(--ink-2)', marginTop:4}}>When variants are set, per-variant price and stock are used on the public site.</div>
          )}
          {Number(form._inCarts) > 0 && (
            <div style={{fontSize:12, color:'var(--ochre)', marginTop:4}}>
              Currently sitting in {form._inCarts} shopper cart{Number(form._inCarts) === 1 ? '' : 's'} (not yet ordered, stock not reserved).
            </div>
          )}
          {!form.digital && (
            <>
              <div className="eyebrow" style={{marginTop:18, marginBottom:10}}>SHIPPING</div>
              <div className="grid-2" style={{gap:14}}>
                <label className="field">
                  <span className="label">Weight (kg)</span>
                  <input className="input" type="number" step="0.01" min="0" placeholder="0.50" value={form.weightKg||''} onChange={e=>setForm({...form, weightKg:e.target.value})} />
                </label>
                <div />
              </div>
              <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:14}}>
                <label className="field">
                  <span className="label">Length (cm)</span>
                  <input className="input" type="number" step="1" min="0" placeholder="20" value={form.lengthCm||''} onChange={e=>setForm({...form, lengthCm:e.target.value})} />
                </label>
                <label className="field">
                  <span className="label">Width (cm)</span>
                  <input className="input" type="number" step="1" min="0" placeholder="15" value={form.widthCm||''} onChange={e=>setForm({...form, widthCm:e.target.value})} />
                </label>
                <label className="field">
                  <span className="label">Height (cm)</span>
                  <input className="input" type="number" step="1" min="0" placeholder="10" value={form.heightCm||''} onChange={e=>setForm({...form, heightCm:e.target.value})} />
                </label>
              </div>
              <div style={{fontSize:11, color:'var(--ink-3)', marginTop:-6, marginBottom:8}}>Used for AusPost shipping quotes. Defaults applied if left blank.</div>
            </>
          )}
          {/* A div, not a label: MarkdownField contains a hidden file input, and
              a label would make clicking anywhere in it open the file dialog. */}
          <div className="field">
            <span className="label">Description <span style={{fontWeight:400, color:'var(--ink-3)', fontSize:11}}>shown on the public product page, supports markdown</span></span>
            {/* Stored as `description`, the shop reads that key. Older products
                saved the text under `desc`, which nothing ever read; fall back to
                it here and drop it on the next save. */}
            <MarkdownField value={form.description ?? form.desc ?? ''} minHeight={180}
              placeholder="Bench-tested, 38-point check, ships with charger…"
              onChange={v=>setForm({...form, description:v, desc:undefined})} />
          </div>
          <label className="field"><span className="label">Bench check notes (internal)</span>
            <textarea className="textarea" placeholder="Battery cycle count, BIOS rev, replaced components…" value={form.benchNotes||''} onChange={e=>setForm({...form, benchNotes:e.target.value})} />
          </label>
          {canAssignOwner && (
            <label className="field">
              <span className="label">Owner / Seller <span style={{fontWeight:400, color:'var(--ink-3)', fontSize:11}}>who this stock belongs to</span></span>
              <select className="select" value={form.createdBy||''} onChange={e=>setForm({...form, createdBy:e.target.value})}>
                <option value="">(Unassigned)</option>
                {['seller', 'owner', 'manager', 'technician', 'staff']
                  .map(role => [role, ownerMembers.filter(m => m.role === role)])
                  .filter(([, members]) => members.length > 0)
                  .map(([role, members]) => (
                    <optgroup key={role} label={role === 'seller' ? 'Consignment sellers' : role.charAt(0).toUpperCase() + role.slice(1)}>
                      {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                    </optgroup>
                  ))}
              </select>
            </label>
          )}
          <div className="eyebrow" style={{marginTop:18, marginBottom:4}}>SPECIFICATIONS</div>
          <div style={{fontSize:11, color:'var(--ink-3)', marginBottom:10}}>
            Name and value pairs shown as a table on the product page. Better than
            listing specs in the description: they read clearly and search engines
            can understand them.
          </div>
          {(form.specs || []).map((sp, i) => {
            const specs = form.specs || [];
            const setSpecs = next => setForm({...form, specs: next});
            const move = to => { if (to < 0 || to >= specs.length) return; const n2 = [...specs]; const [m] = n2.splice(i,1); n2.splice(to,0,m); setSpecs(n2); };
            return (
              <div key={i} style={{display:'grid', gridTemplateColumns:'1fr 1.4fr 28px 28px 28px', gap:8, marginBottom:6}}>
                <input className="input" placeholder="e.g. Voc" value={sp.name||''}
                  onChange={e => { const n2=[...specs]; n2[i]={...n2[i], name:e.target.value}; setSpecs(n2); }} />
                <input className="input" placeholder="e.g. 37.8V" value={sp.value||''}
                  onChange={e => { const n2=[...specs]; n2[i]={...n2[i], value:e.target.value}; setSpecs(n2); }} />
                <button type="button" className="icon-btn" title="Move up" aria-label="Move specification up" disabled={i===0} onClick={() => move(i-1)}>↑</button>
                <button type="button" className="icon-btn" title="Move down" aria-label="Move specification down" disabled={i===specs.length-1} onClick={() => move(i+1)}>↓</button>
                <button type="button" className="icon-btn" title="Remove specification" aria-label="Remove specification" onClick={() => setSpecs(specs.filter((_,j)=>j!==i))}>×</button>
              </div>
            );
          })}
          <button className="btn btn-ghost btn-sm" style={{marginTop:4}}
            onClick={() => setForm({...form, specs: [...(form.specs||[]), {name:'', value:''}]})}>Add specification</button>

          <div className="eyebrow" style={{marginTop:18, marginBottom:10}}>VARIANTS</div>
          {(form.variants || []).map((v, i) => (
            <div key={i} style={{marginBottom:14, padding:10, border:'1px solid var(--line)', background:'var(--bg-elev)'}}>
              <div style={{display:'grid', gridTemplateColumns:'1.4fr 1fr 80px 70px 80px 80px 28px', gap:8, alignItems:'end', marginBottom: (form.images||[]).length > 0 ? 8 : 0}}>
                <div>
                  <div style={variantLabelStyle}>Name</div>
                  <input className="input" placeholder="e.g. With Certificate" value={v.name||''} onChange={e => { const vs = [...(form.variants||[])]; vs[i] = {...vs[i], name: e.target.value}; setForm({...form, variants: vs}); }} />
                </div>
                <div>
                  <div style={variantLabelStyle} title="Assigned on save as the product SKU plus a two digit suffix">SKU</div>
                  <input className="input mono" value={v.sku||''} readOnly tabIndex={-1}
                    placeholder="on save"
                    style={{background:'var(--bg-elev)', color:'var(--ink-2)', cursor:'default'}} />
                </div>
                <div>
                  <div style={variantLabelStyle}>Price AUD</div>
                  <input className="input" type="number" value={v.price||0} onChange={e => { const vs = [...(form.variants||[])]; vs[i] = {...vs[i], price: Number(e.target.value)}; setForm({...form, variants: vs}); }} />
                </div>
                <div>
                  <div style={variantLabelStyle}>Stock</div>
                  <input className="input" type="number" value={v.stock||0} onChange={e => { const vs = [...(form.variants||[])]; vs[i] = {...vs[i], stock: Number(e.target.value)}; setForm({...form, variants: vs}); }} />
                </div>
                <div>
                  <div style={variantLabelStyle} title="Buy this many or more to get the bulk price. 0 = no bulk price.">Bulk qty</div>
                  <input className="input" type="number" min="0" step="1" placeholder="0" value={v.bulkQty||''} onChange={e => { const vs = [...(form.variants||[])]; vs[i] = {...vs[i], bulkQty: e.target.value ? Number(e.target.value) : ''}; setForm({...form, variants: vs}); }} />
                </div>
                <div>
                  <div style={variantLabelStyle} title="Unit price once the bulk quantity is reached.">Bulk ea</div>
                  <input className="input" type="number" min="0" step="0.01" placeholder="0.00" value={v.bulkPrice||''} onChange={e => { const vs = [...(form.variants||[])]; vs[i] = {...vs[i], bulkPrice: e.target.value ? Number(e.target.value) : ''}; setForm({...form, variants: vs}); }} />
                </div>
                <button className="icon-btn" title="Remove variant" aria-label="Remove variant" onClick={() => { const vs = (form.variants||[]).filter((_,j) => j!==i); setForm({...form, variants: vs}); }}>×</button>
              </div>
              {(form.images||[]).length > 0 && (
                <div>
                  <div style={{fontSize:11, color:'var(--ink-3)', marginBottom:6}}>Linked images (shown when variant selected)</div>
                  <div style={{display:'flex', gap:6, flexWrap:'wrap'}}>
                    {(form.images||[]).map((url, imgIdx) => {
                      const linked = (v.images||[]).includes(url);
                      return (
                        <div key={imgIdx} role="button" tabIndex={0} onClick={() => {
                          const vs = [...(form.variants||[])];
                          const cur = vs[i].images || [];
                          vs[i] = {...vs[i], images: linked ? cur.filter(u => u !== url) : [...cur, url]};
                          setForm({...form, variants: vs});
                        }} onKeyDown={e2 => { if (e2.key==='Enter'||e2.key===' ') { e2.preventDefault(); const vs=[...(form.variants||[])]; const cur=vs[i].images||[]; vs[i]={...vs[i],images:linked?cur.filter(u=>u!==url):[...cur,url]}; setForm({...form,variants:vs}); } }} style={{width:48, height:48, cursor:'pointer', position:'relative', flexShrink:0}} aria-label={linked?'Unlink image from variant':'Link image to variant'}>
                          <img src={url} alt="" style={{width:'100%', height:'100%', objectFit:'cover', display:'block', opacity: linked ? 1 : 0.35}} />
                          {linked && <div style={{position:'absolute', bottom:2, right:2, width:14, height:14, background:'var(--rust)', borderRadius:2, display:'grid', placeItems:'center'}}>
                            <svg width="8" height="8" viewBox="0 0 10 10"><polyline points="1,5 4,8 9,2" fill="none" stroke="#fff" strokeWidth="2"/></svg>
                          </div>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ))}
          <button className="btn btn-ghost btn-sm" style={{marginTop:4}} onClick={() => setForm({...form, variants: [...(form.variants||[]), {sku:'', name:'', price:0, stock:0, bulkQty:'', bulkPrice:''}]})}>Add variant</button>
      </OrderPage>
    );
  }

  return (
    <div style={{padding:32}}>
      <div className="tabs" style={{marginBottom:18}}>
        {TABS.map(t => (
          <button key={t.key} type="button" className={`tab ${tab===t.key?'active':''}`}
            aria-pressed={tab===t.key} onClick={() => setTab(t.key)}
            style={{font:'inherit', color:'inherit', background:'none', cursor:'pointer'}}>
            {t.label} ({rows.filter(t.match).length})
          </button>
        ))}
        <div style={{flex:1}}></div>
        <button className="btn btn-ghost btn-sm" style={{color:'var(--ink-2)'}} onClick={moveAllToDraft}>Move all to draft</button>
        <button className="btn btn-rust btn-sm" onClick={() => setOpenId('new')}>+ New product</button>
      </div>
      {bulkError && (
        <div role="alert" style={{marginBottom:12, padding:'10px 14px', border:'1px solid var(--rust)', color:'var(--rust)', fontSize:13}}>{bulkError}</div>
      )}
      <Table
        columns={[
          { key:'sku', label:'SKU', w:'130px', sort:true, render:r => <span className="mono" style={{fontSize:11, color:'var(--rust)'}}>{r.sku}</span> },
          { key:'name', label:'Name', w:'2fr', sort:true, render:r => (<><div style={{fontWeight:600}}>{r.name || '(untitled)'}</div><div className="mono" style={{fontSize:10, color:'var(--ink-2)', marginTop:2}}>{r.cond || ''}</div></>) },
          { key:'cat', label:'Category', w:'1.2fr', sort:true },
          { key:'price', label:'Price', w:'90px', sort:true, render:r => {
            if (r.variants && r.variants.length) {
              const prices = r.variants.map(v => v.price);
              const lo = Math.min(...prices), hi = Math.max(...prices);
              return <span className="mono" style={{fontWeight:600}}>{lo===hi ? `$${lo}` : `$${lo}–$${hi}`}</span>;
            }
            return <span className="mono" style={{fontWeight:600}}>${Number(r.priceAud ?? r.price ?? 0).toLocaleString()}</span>;
          }},
          { key:'stock', label:'Stock', w:'80px', sort:true, render:r => {
            if (r.infiniteStock) return <span className="mono" style={{color:'var(--ink-2)'}}>∞</span>;
            const s = r.variants && r.variants.length ? r.variants.reduce((a,v) => a + (v.stock||0), 0) : (r.stock ?? 0);
            // Negative stock on a backorder product is the number owed to
            // customers, which staff need to see rather than a plain zero.
            if (s < 0) return <span className="mono" title={`${Math.abs(s)} owed on backorder`} style={{color:'var(--ochre)', fontWeight:600}}>{s}</span>;
            return <span className="mono" style={{color: s<3?'var(--rust)':'var(--ink)'}}>{s}</span>;
          }},
          { key:'_inCarts', label:'In carts', w:'90px', sort:true, render:r => {
            const n = Number(r._inCarts) || 0;
            if (n === 0) return <span className="mono" style={{color:'var(--ink-3)'}}>0</span>;
            return <span className="mono" title={`Sitting in ${n} shopper cart${n===1?'':'s'} right now`} style={{color:'var(--ochre)', fontWeight:600}}>{n}</span>;
          }},
          { key:'status', label:'Status', w:'120px', sort:true, render:r => <span className={`tag ${r.status==='published'?'tag-euc':'tag-outline'}`}>{(r.status || 'draft').toUpperCase()}</span> },
        ]}
        rows={visibleRows}
        onRowClick={openRow}
      />

      {waiting.length > 0 && (
        <div style={{marginTop:28}}>
          <div className="eyebrow" style={{marginBottom:4}}>WAITING ON STOCK ({waiting.filter(w => !w.notifiedAt).length})</div>
          <div style={{fontSize:11, color:'var(--ink-3)', marginBottom:10}}>
            Customers are emailed automatically when stock returns. Listed here so you can see what demand is being missed.
          </div>
          <div style={{border:'1px solid var(--line)'}}>
            {waiting.map(w => (
              <div key={w.id} style={{display:'grid', gridTemplateColumns:'1.6fr 1.4fr 120px 90px 32px', gap:10, alignItems:'center', padding:'8px 12px', borderBottom:'1px solid var(--line)', fontSize:13}}>
                <div style={{fontWeight:600}}>{w.productName}{w.variantSku ? ` / ${w.variantSku}` : ''}</div>
                <div className="mono" style={{fontSize:11, color:'var(--ink-2)'}}>{w.email}</div>
                <div className="mono" style={{fontSize:11, color:'var(--ink-3)'}}>{(w.createdAt || '').slice(0, 10)}</div>
                <div>
                  {w.notifiedAt
                    ? <span className="tag tag-euc">EMAILED</span>
                    : w.inStock
                      ? <span className="tag tag-ochre">IN STOCK</span>
                      : <span className="tag tag-outline">WAITING</span>}
                </div>
                <button className="icon-btn" title="Remove request" aria-label="Remove request" onClick={() => dismissWaiting(w.id)}>×</button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// SERVICES
// ============================================================
function AdminServices() {
  const [rows, setRows] = useState([]);
  const [catOptions, setCatOptions] = useState([]);
  useEffect(() => {
    fetch('/api/admin/catalog', { credentials:'include' })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(data => {
        const allServices = data.services || [];
        setRows(allServices.map(s => ({ ...s, cat:s.category, price:s.priceLine })));
        setCatOptions([...new Set(allServices.map(s => s.category).filter(Boolean))].sort());
      })
      .catch(() => setRows((window.CATALOG_DATA?.getAdminServices?.() || window.CATALOG_DATA?.getAdminCatalog?.().filter(item => item.priceLine !== undefined) || []).map(s => ({ ...s, cat:s.category, price:s.priceLine }))));
  }, []);
  const [edit, setEdit] = useState(null);
  const [form, setForm] = useState({});
  const [newCat, setNewCat] = useState(false);
  const open = (i) => { setEdit(i); setNewCat(false); setForm(i==='new' ? { id:'', sku:'', status:'draft', cat: catOptions[0] || '', active:true } : rows[i]); };
  const save = async () => {
    const item = { ...form, category: form.cat, priceLine: form.price, description: form.description };
    const r = await fetch('/api/admin/catalog/services/save', {
      method: 'POST', headers: postHeaders(),
      credentials: 'include', body: JSON.stringify(item),
    }).catch(() => null);
    if (r && r.ok) {
      const d = await r.json();
      const saved = { ...d.item, cat: d.item.category, price: d.item.priceLine };
      if (edit === 'new') setRows(rs => [...rs, saved]);
      else setRows(rs => rs.map((row, i) => i === edit ? saved : row));
      if (saved.cat && !catOptions.includes(saved.cat)) setCatOptions(cs => [...cs, saved.cat].sort());
      setEdit(null);
    } else {
      const err = r ? await r.json().catch(() => ({})) : {};
      adminToast(err.message || 'Failed to save service, check server logs', 'error');
    }
  };
  const remove = async () => {
    const item = rows[edit];
    await fetch('/api/admin/catalog/services/delete', {
      method: 'POST', headers: postHeaders(),
      credentials: 'include', body: JSON.stringify({ id: item.id }),
    }).catch(() => null);
    setRows(rs => rs.filter((_, i) => i !== edit));
    setEdit(null);
  };
  const moveAllToDraft = async () => {
    setRows(rs => rs.map(r => ({ ...r, status:'draft' })));
    await fetch('/api/admin/catalog/services/status', { method:'POST', headers:postHeaders(), credentials:'include', body: JSON.stringify({ status:'draft' }) }).catch(() => {});
  };
  return (
    <div style={{padding:32}}>
      <div className="row-flex" style={{justifyContent:'space-between', marginBottom:18}}>
        <div className="mono" style={{fontSize:12, color:'var(--ink-2)'}}>{rows.length} SERVICES · {rows.filter(r=>r.status==='published').length} PUBLISHED</div>
        <button className="btn btn-ghost btn-sm" onClick={moveAllToDraft}>Move all to draft</button>
        <button className="btn btn-rust btn-sm" onClick={() => open('new')}>+ New service</button>
      </div>
      <Table
        columns={[
          { key:'name', label:'Service', w:'2fr', render:r => <span style={{fontWeight:600}}>{r.name}</span> },
          { key:'cat', label:'Category', w:'1fr', render:r => <span className="tag tag-outline">{(r.cat || '').toUpperCase()}</span> },
          { key:'price', label:'Price', w:'1.5fr' },
          { key:'tat', label:'Turnaround', w:'130px', render:r => <span className="mono" style={{fontSize:12}}>{r.tat}</span> },
          { key:'status', label:'Status', w:'120px', render:r => <span className={`tag ${r.status==='published'?'tag-euc':'tag-outline'}`}>{(r.status || 'draft').toUpperCase()}</span> },
        ]}
        rows={rows}
        onRowClick={(_,i) => open(i)}
      />
      {edit !== null && (
        <Drawer open={true} onClose={() => setEdit(null)} title={edit==='new'?'New service':form.name}
          footer={<div className="row-flex" style={{justifyContent:'space-between'}}>
            {edit!=='new' && <button className="btn btn-ghost btn-sm" style={{color:'var(--rust)'}} onClick={remove}>Delete</button>}
            <div className="row-flex" style={{gap:8, marginLeft:'auto'}}>
              <button className="btn btn-ghost btn-sm" onClick={()=>setEdit(null)}>Cancel</button>
              <button className="btn btn-sm" onClick={save}>Save</button>
            </div>
          </div>}
        >
          <label className="field"><span className="label">Service name</span><input className="input" value={form.name||''} onChange={e=>setForm({...form, name:e.target.value})}/></label>
          <div className="grid-2" style={{gap:14}}>
            <label className="field"><span className="label">Category</span>
              <select className="select" value={!newCat && catOptions.includes(form.cat) ? form.cat : '__new__'} onChange={e => {
                if (e.target.value === '__new__') { setNewCat(true); setForm({...form, cat: ''}); }
                else { setNewCat(false); setForm({...form, cat: e.target.value}); }
              }}>
                {catOptions.map(c => <option key={c} value={c}>{c}</option>)}
                <option value="__new__">+ New category…</option>
              </select>
              {(newCat || !catOptions.includes(form.cat)) && (
                <input className="input" style={{marginTop:6}} placeholder="Type new category name" value={form.cat||''} onChange={e=>setForm({...form, cat:e.target.value})} autoFocus />
              )}
            </label>
            <label className="field"><span className="label">Turnaround</span><input className="input" placeholder="e.g. 3–7 days" value={form.tat||''} onChange={e=>setForm({...form, tat:e.target.value})}/></label>
          </div>
          <label className="field"><span className="label">Pricing line</span><input className="input" placeholder="from $120 / $50/hr / quoted" value={form.price||''} onChange={e=>setForm({...form, price:e.target.value})}/></label>
          <label className="field"><span className="label">Public description</span><textarea className="textarea" value={form.description||''} onChange={e=>setForm({...form, description:e.target.value})} /></label>
          <label className="field"><span className="label">Bench checklist (internal)</span><textarea className="textarea" placeholder="Steps the tech follows; what gets logged…" value={form.checklist||''} onChange={e=>setForm({...form, checklist:e.target.value})} /></label>
          <label className="field"><span className="label">Status</span>
            <select className="select" value={form.status || 'draft'} onChange={e=>setForm({...form, status:e.target.value})}>
              <option value="draft">Draft</option>
              <option value="published">Published</option>
            </select>
          </label>
        </Drawer>
      )}
    </div>
  );
}

// ============================================================
// CLIENTS
// ============================================================
function AdminClients() {
  const [rows, setRows] = useState([]);
  useEffect(() => {
    fetch('/api/admin/clients', { credentials:'include' })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(data => setRows(data.items || []))
      .catch(() => {});
  }, []);
  const [edit, setEdit] = useState(null);
  const [form, setForm] = useState({});
  const open = (i) => { setEdit(i); setForm(i==='new' ? { name:'', subtitle:'', description:'', since:'', url:'', logoUrl:'', logoAlt:'', order: rows.length, active:true } : rows[i]); };
  const save = async () => {
    const r = await fetch('/api/admin/clients/save', {
      method: 'POST', headers: postHeaders(),
      credentials: 'include', body: JSON.stringify(form),
    }).catch(() => null);
    if (r && r.ok) {
      const d = await r.json();
      if (edit === 'new') setRows(rs => [...rs, d.item]);
      else setRows(rs => rs.map((row, i) => i === edit ? d.item : row));
      setEdit(null);
    } else {
      const err = r ? await r.json().catch(() => ({})) : {};
      adminToast(err.error === 'name_required' ? 'Client name is required' : 'Failed to save client, check server logs', 'error');
    }
  };
  const remove = async () => {
    const item = rows[edit];
    await fetch('/api/admin/clients/delete', {
      method: 'POST', headers: postHeaders(),
      credentials: 'include', body: JSON.stringify({ id: item.id }),
    }).catch(() => null);
    setRows(rs => rs.filter((_, i) => i !== edit));
    setEdit(null);
  };
  return (
    <div style={{padding:32}}>
      <div className="row-flex" style={{justifyContent:'space-between', marginBottom:18}}>
        <div className="mono" style={{fontSize:12, color:'var(--ink-2)'}}>{rows.length} CLIENTS · {rows.filter(r=>r.active !== false).length} SHOWN ON SITE</div>
        <button className="btn btn-rust btn-sm" onClick={() => open('new')}>+ New client</button>
      </div>
      <p style={{fontSize:13, color:'var(--ink-2)', maxWidth:640, marginBottom:18}}>
        Clients listed here appear on the public site as a "who we work with" trust strip. Only add a client after they've agreed you can name them, most engagements are confidential by default.
      </p>
      <Table
        columns={[
          { key:'logo', label:'', w:'52px', render:r => r.logoUrl
            ? <img src={r.logoUrl} alt="" style={{width:36, height:36, objectFit:'contain', background:'var(--bg-deep)', border:'1px solid var(--line)', borderRadius:4, padding:3}} />
            : <div style={{width:36, height:36, background:'var(--bg-deep)', border:'1px dashed var(--line)', borderRadius:4}} /> },
          { key:'name', label:'Client', w:'2fr', render:r => <span style={{fontWeight:600}}>{r.name}</span> },
          { key:'subtitle', label:'Subtitle', w:'1.5fr' },
          { key:'order', label:'Order', w:'80px' },
          { key:'active', label:'Status', w:'120px', render:r => <span className={`tag ${r.active !== false ?'tag-euc':'tag-outline'}`}>{r.active !== false ? 'SHOWN' : 'HIDDEN'}</span> },
        ]}
        rows={rows}
        onRowClick={(_,i) => open(i)}
      />
      {edit !== null && (
        <Drawer open={true} onClose={() => setEdit(null)} title={edit==='new'?'New client':form.name}
          footer={<div className="row-flex" style={{justifyContent:'space-between'}}>
            {edit!=='new' && <button className="btn btn-ghost btn-sm" style={{color:'var(--rust)'}} onClick={remove}>Delete</button>}
            <div className="row-flex" style={{gap:8, marginLeft:'auto'}}>
              <button className="btn btn-ghost btn-sm" onClick={()=>setEdit(null)}>Cancel</button>
              <button className="btn btn-sm" onClick={save}>Save</button>
            </div>
          </div>}
        >
          <label className="field"><span className="label">Client name</span><input className="input" placeholder="e.g. Blackall-Tambo Regional Council" value={form.name||''} onChange={e=>setForm({...form, name:e.target.value})}/></label>
          <label className="field"><span className="label">Logo (optional)</span>
            <ImageUploadSlot value={form.logoUrl} onChange={v=>setForm({...form, logoUrl:v})} aspect="3/2" label="DROP LOGO, OR CLICK"
              alt={form.logoAlt} onAltChange={v=>setForm({...form, logoAlt:v})} />
          </label>
          <label className="field"><span className="label">Subtitle (optional)</span><input className="input" placeholder="e.g. Blackall Library" value={form.subtitle||''} onChange={e=>setForm({...form, subtitle:e.target.value})}/></label>
          <label className="field"><span className="label">What we did for them (optional)</span>
            <input className="input" placeholder="e.g. Ongoing IT support & hardware servicing" value={form.description||''} onChange={e=>setForm({...form, description:e.target.value})}/>
          </label>
          <div className="grid-2" style={{gap:14}}>
            <label className="field"><span className="label">Their website (optional)</span><input className="input" placeholder="https://…" value={form.url||''} onChange={e=>setForm({...form, url:e.target.value})}/></label>
            <label className="field"><span className="label">Client since (optional)</span><input className="input" placeholder="e.g. 2024" maxLength={4} inputMode="numeric" value={form.since||''} onChange={e=>setForm({...form, since:e.target.value.replace(/[^0-9]/g,'').slice(0,4)})}/></label>
          </div>
          <div className="grid-2" style={{gap:14}}>
            <label className="field"><span className="label">Display order</span><input className="input" type="number" value={form.order ?? 0} onChange={e=>setForm({...form, order: parseInt(e.target.value,10) || 0})}/></label>
            <label className="field" style={{flexDirection:'row', alignItems:'center', gap:10, marginTop:22}}>
              <input type="checkbox" checked={form.active !== false} onChange={e=>setForm({...form, active:e.target.checked})}/>
              <span className="label" style={{marginBottom:0}}>Shown on site</span>
            </label>
          </div>
        </Drawer>
      )}
    </div>
  );
}

// ============================================================
// SOFTWARE
// ============================================================
function PlatformIcon({ platform, size = 14 }) {
  const s = { width: size, height: size, fill: 'none', stroke: 'currentColor', strokeWidth: 2, verticalAlign: 'middle', flexShrink: 0 };
  const vb = '0 0 24 24';
  switch (platform) {
    case 'windows': return (
      // Four-pane Windows flag
      <svg style={s} viewBox={vb}>
        <rect x="2" y="2" width="9" height="9"/><rect x="13" y="2" width="9" height="9"/>
        <rect x="2" y="13" width="9" height="9"/><rect x="13" y="13" width="9" height="9"/>
      </svg>
    );
    case 'macos': return (
      // macOS command ⌘ key
      <svg style={s} viewBox={vb}>
        <path d="M18 3a3 3 0 00-3 3v12a3 3 0 003 3 3 3 0 003-3 3 3 0 00-3-3H6a3 3 0 00-3 3 3 3 0 003 3 3 3 0 003-3V6a3 3 0 00-3-3 3 3 0 00-3 3 3 3 0 003 3h12a3 3 0 003-3 3 3 0 00-3-3z"/>
      </svg>
    );
    case 'linux': return (
      // Terminal prompt  >_
      <svg style={s} viewBox={vb}>
        <rect x="2" y="3" width="20" height="18" rx="2"/>
        <polyline points="8 10 12 14 8 18"/>
        <line x1="14" y1="18" x2="20" y2="18"/>
      </svg>
    );
    case 'android': return (
      // Simple Android robot head + antennas
      <svg style={s} viewBox={vb}>
        <path d="M7 8C7 5.8 9.2 4 12 4s5 1.8 5 4"/>
        <rect x="5" y="8" width="14" height="11" rx="2"/>
        <line x1="9" y1="4" x2="7" y2="2"/><line x1="15" y1="4" x2="17" y2="2"/>
        <line x1="9" y1="14" x2="9" y2="16"/><line x1="15" y1="14" x2="15" y2="16"/>
      </svg>
    );
    case 'cross': return (
      // Globe, cross-platform
      <svg style={s} viewBox={vb}>
        <circle cx="12" cy="12" r="10"/>
        <line x1="2" y1="12" x2="22" y2="12"/>
        <path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/>
      </svg>
    );
    default: return (
      // Package box, other / all
      <svg style={s} viewBox={vb}>
        <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/>
        <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
        <line x1="12" y1="22.08" x2="12" y2="12"/>
      </svg>
    );
  }
}

function SoftwareFileRow({ file, onDelete, onUpdate }) {
  const [editing, setEditing] = React.useState(false);
  const [label, setLabel] = React.useState(file.label || '');
  const [version, setVersion] = React.useState(file.version || '');
  const [platform, setPlatform] = React.useState(file.platform || 'other');
  const saveEdit = () => { onUpdate({ ...file, label, version, platform }); setEditing(false); };
  const fmtSize = b => b >= 1048576 ? (b/1048576).toFixed(1)+' MB' : b >= 1024 ? (b/1024).toFixed(0)+' KB' : b+' B';
  return (
    <div style={{background:'var(--bg-mid)', border:'1px solid var(--border)', borderRadius:6, padding:'10px 12px', marginBottom:8}}>
      {editing ? (
        <div style={{display:'flex', flexDirection:'column', gap:8}}>
          <div className="grid-2" style={{gap:8}}>
            <label className="field" style={{margin:0}}>
              <span className="label" style={{fontSize:11}}>Label</span>
              <input className="input" style={{fontSize:13}} placeholder="e.g. Windows Installer" value={label} onChange={e=>setLabel(e.target.value)}/>
            </label>
            <label className="field" style={{margin:0}}>
              <span className="label" style={{fontSize:11}}>Version</span>
              <input className="input" style={{fontSize:13}} placeholder="v1.0.0" value={version} onChange={e=>setVersion(e.target.value)}/>
            </label>
          </div>
          <label className="field" style={{margin:0}}>
            <span className="label" style={{fontSize:11}}>Platform</span>
            <select className="select" style={{fontSize:13}} value={platform} onChange={e=>setPlatform(e.target.value)}>
              <option value="windows">Windows</option>
              <option value="macos">macOS</option>
              <option value="linux">Linux</option>
              <option value="android">Android</option>
              <option value="cross">Cross-platform</option>
              <option value="other">Other / All</option>
            </select>
          </label>
          <div className="row-flex" style={{gap:6, justifyContent:'flex-end'}}>
            <button className="btn btn-ghost btn-sm" style={{fontSize:12}} onClick={()=>setEditing(false)}>Cancel</button>
            <button className="btn btn-sm" style={{fontSize:12}} onClick={saveEdit}>Save</button>
          </div>
        </div>
      ) : (
        <div className="row-flex" style={{justifyContent:'space-between', alignItems:'center', gap:8}}>
          <div style={{minWidth:0}}>
            <div className="row-flex" style={{gap:6, alignItems:'center', flexWrap:'wrap'}}>
              <PlatformIcon platform={file.platform} size={15}/>
              <span style={{fontWeight:600, fontSize:13}}>{file.label || file.originalName}</span>
              {file.version && <span className="tag tag-outline" style={{fontSize:11}}>{file.version}</span>}
              {file.size > 0 && <span style={{fontSize:11, color:'var(--ink-2)'}}>{fmtSize(file.size)}</span>}
            </div>
            <div className="mono" style={{fontSize:11, color:'var(--ink-2)', marginTop:3, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{file.originalName}</div>
          </div>
          <div className="row-flex" style={{gap:6, flexShrink:0}}>
            <a href={file.url} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm" style={{fontSize:12, textDecoration:'none'}}>&#8595; Test</a>
            <button className="btn btn-ghost btn-sm" style={{fontSize:12}} onClick={()=>{ setLabel(file.label||''); setVersion(file.version||''); setPlatform(file.platform||'other'); setEditing(true); }}>Edit</button>
            <button className="btn btn-ghost btn-sm" style={{fontSize:12, color:'var(--rust)'}} onClick={()=>onDelete(file)}>&#10005;</button>
          </div>
        </div>
      )}
    </div>
  );
}

// Chunked upload helper, splits file into 20 MB slices, uploads one at a time.
// Calls onProgress(0..1) after each chunk. Returns the finalize response.
async function uploadSoftwareFile(file, onProgress) {
  const CHUNK_SIZE = 20 * 1024 * 1024; // 20 MB raw per chunk
  const totalChunks = Math.ceil(file.size / CHUNK_SIZE) || 1;
  // Generate a random upload ID safe for use as a directory name
  const uploadId = 'up' + Date.now() + Math.random().toString(36).slice(2, 10);

  const abort = () => fetch('/api/admin/software/upload/abort', {
    method:'POST', headers:postHeaders(), credentials:'include',
    body: JSON.stringify({ uploadId }),
  }).catch(()=>null);

  for (let i = 0; i < totalChunks; i++) {
    const slice = file.slice(i * CHUNK_SIZE, Math.min((i + 1) * CHUNK_SIZE, file.size));
    const dataUri = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(slice);
    });
    const r = await fetch('/api/admin/software/upload/chunk', {
      method:'POST', headers:postHeaders(), credentials:'include',
      body: JSON.stringify({ uploadId, chunkIndex: i, totalChunks, filename: file.name, data: dataUri }),
    });
    if (!r.ok) {
      const d = await r.json().catch(()=>({}));
      await abort();
      throw Object.assign(new Error('chunk_failed'), { apiError: d.error, apiDetail: d.detail });
    }
    onProgress((i + 1) / totalChunks);
  }

  const r = await fetch('/api/admin/software/upload/finalize', {
    method:'POST', headers:postHeaders(), credentials:'include',
    body: JSON.stringify({ uploadId, filename: file.name, totalChunks }),
  });
  if (!r.ok) {
    const d = await r.json().catch(()=>({}));
    await abort();
    throw Object.assign(new Error('finalize_failed'), { apiError: d.error, apiData: d });
  }
  return r.json();
}

function AdminSoftware() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [edit, setEdit] = useState(null);
  const [form, setForm] = useState({});
  const [uploadProgress, setUploadProgress] = useState(null); // null = idle, 0-100 = uploading
  const [uploadErr, setUploadErr] = useState('');
  const fileInputRef = React.useRef(null);

  const open = (i) => {
    setEdit(i);
    setForm(i==='new' ? { license:'OSS · MIT', live:true, files:[], platforms:[], minSpecs:{}, recSpecs:{} } : { ...rows[i], files: rows[i].files||[], platforms: rows[i].platforms||[], minSpecs: rows[i].minSpecs||{}, recSpecs: rows[i].recSpecs||{} });
    setUploadErr('');
    setUploadProgress(null);
  };

  useEffect(() => {
    fetch('/api/admin/software', { credentials:'include' })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(d => setRows(d.items || []))
      .catch(() => setError('Failed to load software.'))
      .finally(() => setLoading(false));
  }, []);

  const save = async () => {
    const payload = edit === 'new' ? form : { ...rows[edit], ...form };
    const r = await fetch('/api/admin/software/save', { method:'POST', headers:postHeaders(), credentials:'include', body: JSON.stringify(payload) }).catch(()=>null);
    if (r && r.ok) {
      const d = await r.json();
      setRows(rs => edit==='new' ? [...rs, d.item] : rs.map((row,i) => i===edit ? d.item : row));
    }
    setEdit(null);
  };

  const handleFileSelect = async (e) => {
    const file = e.target.files[0];
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (!file) return;
    setUploadErr('');
    setUploadProgress(0);
    try {
      const MAX_GB = 10;
      if (file.size > MAX_GB * 1024 * 1024 * 1024) {
        setUploadErr(`File too large, maximum ${MAX_GB} GB.`);
        setUploadProgress(null);
        return;
      }
      const d = await uploadSoftwareFile(file, p => setUploadProgress(Math.round(p * 100)));
      const newFile = {
        id: 'f-' + Date.now(),
        label: '', version: '', platform: 'other',
        url: d.url, filename: d.filename,
        originalName: d.originalName, size: d.size,
      };
      setForm(f => ({ ...f, files: [...(f.files||[]), newFile] }));
    } catch (err) {
      const ae = err.apiError;
      setUploadErr(
        ae === 'file_too_large' ? `File too large (max ${err.apiData?.maxGB||10} GB).` :
        ae === 'unsupported_file_type' ? 'Unsupported file type.' :
        ae === 'missing_chunk' ? 'Upload incomplete, please try again.' :
        ae ? `Upload failed (${ae}${err.apiDetail ? ': ' + err.apiDetail : ''}). Please try again.` :
        'Upload failed. Please try again.'
      );
    }
    setUploadProgress(null);
  };

  const deleteFile = async (file) => {
    if (!(await adminConfirm(`Delete "${file.originalName || file.filename}"?`, { title:'Delete file', confirmLabel:'Delete', danger:true }))) return;
    await fetch('/api/admin/software/upload/delete', {
      method:'POST', headers:postHeaders(), credentials:'include',
      body: JSON.stringify({ filename: file.filename }),
    }).catch(()=>null);
    setForm(f => ({ ...f, files: (f.files||[]).filter(x => x.id !== file.id) }));
  };

  const updateFile = (updated) => {
    setForm(f => ({ ...f, files: (f.files||[]).map(x => x.id === updated.id ? updated : x) }));
  };

  return (
    <div style={{padding:32}}>
      {loading && <div className="mono" style={{fontSize:12, color:'var(--ink-2)', marginBottom:10}}>Loading…</div>}
      {error && <div style={{fontSize:12, color:'var(--rust)', marginBottom:10}}>{error}</div>}
      <div className="row-flex" style={{justifyContent:'space-between', marginBottom:18}}>
        <div className="mono" style={{fontSize:12, color:'var(--ink-2)'}}>{rows.length} SOFTWARE PRODUCTS</div>
        <button className="btn btn-rust btn-sm" onClick={() => open('new')}>+ New software</button>
      </div>
      <Table
        columns={[
          { key:'name', label:'Product', w:'1.5fr', render:r => <span style={{fontWeight:600}}>{r.name}</span> },
          { key:'license', label:'License', w:'1.2fr', render:r => <span className={`tag ${r.license&&r.license.includes('OSS')?'tag-euc':'tag-rust'}`}>{r.license}</span> },
          { key:'price', label:'Pricing', w:'1fr' },
          { key:'files', label:'Files', w:'80px', render:r => {
            const n = (r.files||[]).length;
            return <span className="mono" style={{fontSize:12, color: n>0?'var(--ink)':'var(--ink-2)'}}>{n > 0 ? `${n} file${n!==1?'s':''}` : r.stars||'-'}</span>;
          }},
          { key:'repo', label:'Repo / GitHub', w:'2fr', render:r => r.repo ? <span className="mono" style={{fontSize:11, color:'var(--ink-2)'}}>{r.repo}</span> : <span style={{color:'var(--ink-2)', fontSize:11}}>-</span> },
          { key:'live', label:'Live', w:'70px', render:r => <span className={`tag ${r.live?'tag-euc':'tag-outline'}`}>{r.live?'YES':'NO'}</span> },
        ]}
        rows={rows}
        onRowClick={(_,i)=>open(i)}
      />
      {edit !== null && (
        <Drawer open={true} onClose={()=>setEdit(null)} title={edit==='new'?'New software':form.name}
          footer={<div className="row-flex" style={{justifyContent:'flex-end', gap:8}}>
            <button className="btn btn-ghost btn-sm" onClick={()=>setEdit(null)}>Cancel</button>
            <button className="btn btn-sm" onClick={save}>Save</button>
          </div>}
        >
          {/* ── Identity ── */}
          <label className="field"><span className="label">Product name</span>
            <input className="input" value={form.name||''} onChange={e=>{
              const name = e.target.value;
              const autoSlug = name.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
              setForm(f => ({ ...f, name, ...((!f.slug || f._slugAuto) ? { slug: autoSlug, _slugAuto: true } : {}) }));
            }}/>
          </label>
          <label className="field"><span className="label">Version</span>
            <input className="input" placeholder="0.1.0" value={form.version||''} onChange={e=>setForm({...form, version:e.target.value})}/>
          </label>
          <div className="grid-2" style={{gap:14}}>
            <label className="field"><span className="label">License</span>
              <select className="select" value={form.license||'OSS · MIT'} onChange={e=>setForm({...form, license:e.target.value})}>
                <option>OSS · MIT</option><option>OSS · GPLv3</option><option>OSS · Apache-2.0</option><option>COMMERCIAL</option><option>FREEWARE</option>
              </select>
            </label>
            <label className="field"><span className="label">Pricing</span><input className="input" placeholder="Free / $12/mo" value={form.price||''} onChange={e=>setForm({...form, price:e.target.value})}/></label>
          </div>

          {/* ── Description ── */}
          <label className="field"><span className="label">Tagline <span style={{fontWeight:400, color:'var(--ink-2)'}}>shown on listing card</span></span>
            <input className="input" placeholder="One-liner shown on the card" value={form.tagline||''} onChange={e=>setForm({...form, tagline:e.target.value})}/>
          </label>
          <label className="field"><span className="label">Full description <span style={{fontWeight:400, color:'var(--ink-2)'}}>shown on detail page</span></span>
            <textarea className="textarea" rows={5} placeholder="Detailed description of what the software does, who it's for, and what problems it solves." value={form.description||''} onChange={e=>setForm({...form, description:e.target.value})}/>
          </label>
          <label className="field"><span className="label">Repository / GitHub URL</span><input className="input" placeholder="https://github.com/outback/…" value={form.repo||''} onChange={e=>setForm({...form, repo:e.target.value})}/></label>
          <label className="field"><span className="label">Quickstart snippet</span>
            <textarea className="textarea" style={{fontFamily:'JetBrains Mono, monospace', fontSize:12}} rows={3} placeholder="curl -sSL get.outbackelec.au/your-tool | sh" value={form.quickstart||''} onChange={e=>setForm({...form, quickstart:e.target.value})}/>
          </label>
          <label className="field"><span className="label">Additional requirements</span>
            <textarea className="textarea" rows={2} placeholder="e.g. Requires an internet connection. Root access needed for installation." value={form.requirements||''} onChange={e=>setForm({...form, requirements:e.target.value})}/>
          </label>

          {/* ── Supported platforms ── */}
          <div>
            <span className="label">Supported platforms <span style={{fontWeight:400, color:'var(--ink-2)'}}>controls which OS buttons show on the card</span></span>
            <div className="row-flex" style={{gap:8, flexWrap:'wrap', marginTop:6}}>
              {['linux','windows','macos','ios','android','cross'].map(os => {
                const checked = (form.platforms||[]).includes(os);
                return (
                  <label key={os} style={{display:'flex', alignItems:'center', gap:6, fontSize:13, cursor:'pointer', padding:'4px 10px', border:'1px solid var(--line)', borderRadius:4, background: checked ? 'var(--bg-deep)' : 'transparent'}}>
                    <input type="checkbox" checked={checked} onChange={e=>{
                      const p = form.platforms||[];
                      setForm({...form, platforms: e.target.checked ? [...p,os] : p.filter(x=>x!==os)});
                    }}/>
                    {os.charAt(0).toUpperCase()+os.slice(1)}
                  </label>
                );
              })}
            </div>
          </div>

          {/* ── System requirements ── */}
          <div>
            <span className="label">System requirements</span>
            <div className="grid-2" style={{gap:14, marginTop:8}}>
              <div>
                <div style={{fontSize:11, fontWeight:600, color:'var(--ink-2)', marginBottom:8, textTransform:'uppercase', letterSpacing:'.06em'}}>Minimum</div>
                {[['os','OS / Distro'],['cpu','CPU'],['ram','RAM'],['storage','Storage'],['other','Other']].map(([k,l])=>(
                  <label key={k} className="field" style={{marginBottom:8}}>
                    <span className="label" style={{fontSize:11}}>{l}</span>
                    <input className="input" style={{fontSize:12}} placeholder={k==='os'?'Ubuntu 20.04+':k==='cpu'?'1 GHz dual-core':k==='ram'?'512 MB':k==='storage'?'200 MB':''} value={(form.minSpecs||{})[k]||''} onChange={e=>setForm({...form, minSpecs:{...(form.minSpecs||{}), [k]:e.target.value}})}/>
                  </label>
                ))}
              </div>
              <div>
                <div style={{fontSize:11, fontWeight:600, color:'var(--ink-2)', marginBottom:8, textTransform:'uppercase', letterSpacing:'.06em'}}>Recommended</div>
                {[['os','OS / Distro'],['cpu','CPU'],['ram','RAM'],['storage','Storage'],['other','Other']].map(([k,l])=>(
                  <label key={k} className="field" style={{marginBottom:8}}>
                    <span className="label" style={{fontSize:11}}>{l}</span>
                    <input className="input" style={{fontSize:12}} placeholder={k==='os'?'Ubuntu 22.04+':k==='cpu'?'2 GHz quad-core':k==='ram'?'2 GB':k==='storage'?'1 GB SSD':''} value={(form.recSpecs||{})[k]||''} onChange={e=>setForm({...form, recSpecs:{...(form.recSpecs||{}), [k]:e.target.value}})}/>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* ── Installation / Download Files ── */}
          <div>
            <div className="row-flex" style={{justifyContent:'space-between', alignItems:'center', marginBottom:10}}>
              <span className="label" style={{margin:0}}>Installation Files</span>
              <div className="row-flex" style={{gap:8, alignItems:'center'}}>
                <button className="btn btn-ghost btn-sm" style={{fontSize:12}} disabled={uploadProgress !== null}
                  onClick={()=>fileInputRef.current&&fileInputRef.current.click()}>+ Upload file</button>
                <input ref={fileInputRef} type="file" style={{display:'none'}}
                  accept=".zip,.gz,.tgz,.bz2,.xz,.7z,.iso,.img,.apk,.aab,.exe,.msi,.deb,.rpm,.dmg,.pkg,.appimage,.run,.sh,.tar"
                  onChange={handleFileSelect}/>
              </div>
            </div>
            {uploadProgress !== null && (
              <div style={{marginBottom:10}}>
                <div className="row-flex" style={{justifyContent:'space-between', fontSize:12, color:'var(--ink-2)', marginBottom:4}}>
                  <span>Uploading…</span><span>{uploadProgress}%</span>
                </div>
                <div style={{background:'var(--border)', borderRadius:4, height:6, overflow:'hidden'}}>
                  <div style={{background:'var(--rust)', height:'100%', width:`${uploadProgress}%`, transition:'width 0.2s ease'}}/>
                </div>
              </div>
            )}
            {uploadErr && <div style={{fontSize:12, color:'var(--rust)', marginBottom:8}}>{uploadErr}</div>}
            {(form.files||[]).length === 0 && uploadProgress === null && (
              <div style={{fontSize:12, color:'var(--ink-2)', padding:'12px 0', textAlign:'center', border:'1px dashed var(--border)', borderRadius:6}}>
                No files yet, upload an installer, binary, or archive above.
              </div>
            )}
            {(form.files||[]).map(f => (
              <SoftwareFileRow key={f.id} file={f} onDelete={deleteFile} onUpdate={updateFile} />
            ))}
            <div style={{fontSize:11, color:'var(--ink-2)', marginTop:6}}>
              Supported: .zip .tar.gz .iso .apk .exe .msi .deb .rpm .dmg .appimage, max 10 GB per file
            </div>
          </div>

          <label className="field" style={{display:'flex', alignItems:'center', gap:8, marginTop:4}}>
            <input type="checkbox" checked={!!form.live} onChange={e=>setForm({...form, live:e.target.checked})}/>
            <span style={{fontSize:14}}>Listed on public Software page</span>
          </label>
        </Drawer>
      )}
    </div>
  );
}

// ============================================================
// TUTORIALS, list + editor
// ============================================================
const TUTORIAL_FORMATS = [
  { id:'article', label:'Article', hint:'Long-form write-up, like a blog post.' },
  { id:'steps', label:'Step-by-step', hint:'Numbered steps, each with its own text and photo.' },
  { id:'info', label:'Info page', hint:'Short reference page - no difficulty or read-time shown.' },
];

function newTutorial() {
  return { status:'Draft', cat:'', format:'article', difficulty:'Intermediate', body:'', intro:'', steps:[], tools:[], tags:[], views:0, series:'', seriesOrder:'' };
}
function emptyStep() { return { id:'step-'+Date.now()+'-'+Math.random().toString(36).slice(2,7), title:'', body:'', image:'', imageAlt:'' }; }

// Mirrors TRUSTED_VIDEO_DOMAINS in server.js, the server silently blanks
// anything that doesn't match, so warn before that happens rather than
// after a save quietly drops the URL with no explanation.
const TRUSTED_VIDEO_DOMAINS = ['youtube.com', 'www.youtube.com', 'youtu.be', 'www.youtu.be', 'youtube-nocookie.com', 'www.youtube-nocookie.com', 'vimeo.com', 'www.vimeo.com'];
function isTrustedVideoUrl(url) {
  if (!url) return true;
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return TRUSTED_VIDEO_DOMAINS.some(d => hostname === d || hostname.endsWith('.' + d));
  } catch { return false; }
}

// Pure textarea-selection transform shared by every markdown field in the editor.
function applyMarkdownFormat(ta, val, fmt) {
  const ss = ta.selectionStart, se = ta.selectionEnd;
  const sel = val.slice(ss, se);
  const lineStart = val.lastIndexOf('\n', ss - 1) + 1;
  let newVal, cur;
  if (fmt === 'H2') { newVal = val.slice(0, lineStart) + '## ' + val.slice(lineStart); cur = [ss + 3, se + 3]; }
  else if (fmt === 'H3') { newVal = val.slice(0, lineStart) + '### ' + val.slice(lineStart); cur = [ss + 4, se + 4]; }
  else if (fmt === 'B') { const w = sel || 'bold text'; newVal = val.slice(0, ss) + `**${w}**` + val.slice(se); cur = sel ? [ss + 2, ss + 2 + sel.length] : [ss + 2, ss + 2 + w.length]; }
  else if (fmt === 'I') { const w = sel || 'italic text'; newVal = val.slice(0, ss) + `_${w}_` + val.slice(se); cur = sel ? [ss + 1, ss + 1 + sel.length] : [ss + 1, ss + 1 + w.length]; }
  else if (fmt === '</>') {
    if (sel.includes('\n')) { newVal = val.slice(0, ss) + '```\n' + sel + '\n```' + val.slice(se); cur = [ss + 4, ss + 4 + sel.length]; }
    else { const w = sel || 'code'; newVal = val.slice(0, ss) + '`' + w + '`' + val.slice(se); cur = sel ? [ss + 1, ss + 1 + sel.length] : [ss + 1, ss + 1 + w.length]; }
  }
  else if (fmt === '-') { newVal = val.slice(0, ss) + '-' + val.slice(se); cur = [ss + 1, ss + 1]; }
  else if (fmt === '· list') { newVal = val.slice(0, lineStart) + '- ' + val.slice(lineStart); cur = [ss + 2, se + 2]; }
  else if (fmt === '1. list') { newVal = val.slice(0, lineStart) + '1. ' + val.slice(lineStart); cur = [ss + 3, se + 3]; }
  else if (fmt === 'Link') { const snippet = sel ? `[${sel}](url)` : '[link text](url)'; newVal = val.slice(0, ss) + snippet + val.slice(se); cur = sel ? [ss + sel.length + 3, ss + sel.length + 6] : [ss + 1, ss + 10]; }
  else if (fmt === 'Table') {
    const snippet = '| Column 1 | Column 2 |\n|---|---|\n| Cell | Cell |\n';
    newVal = val.slice(0, lineStart) + snippet + val.slice(lineStart);
    cur = [lineStart + 2, lineStart + 2 + 'Column 1'.length];
  }
  else return null;
  return { newVal, cur };
}

// Markdown textarea with a formatting toolbar and a real "insert image" button
// that uploads the file and drops a ![alt](url) snippet at the cursor.
function MarkdownField({ value, onChange, placeholder, minHeight = 260 }) {
  const taRef = React.useRef(null);
  const fileRef = React.useRef(null);
  const [uploading, setUploading] = useState(false);

  const apply = (fmt) => {
    const ta = taRef.current; if (!ta) return;
    const result = applyMarkdownFormat(ta, value || '', fmt);
    if (!result) return;
    onChange(result.newVal);
    setTimeout(() => { ta.focus(); ta.setSelectionRange(result.cur[0], result.cur[1]); }, 0);
  };
  const insertImage = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadImage(file);
      const ta = taRef.current;
      const ss = ta ? ta.selectionStart : (value || '').length;
      const se = ta ? ta.selectionEnd : ss;
      const snippet = `![${file.name.replace(/\.[a-z0-9]+$/i, '')}](${url})`;
      onChange((value || '').slice(0, ss) + snippet + (value || '').slice(se));
    } catch { adminToast('Image upload failed.'); }
    setUploading(false);
  };

  return (
    <div>
      <div className="row-flex" style={{gap:4, paddingBottom:10, borderBottom:'1px solid var(--line)', flexWrap:'wrap'}}>
        {['H2','H3','B','I','</>','-','· list','1. list','Link','Table'].map((b,i) => (
          <button key={i} type="button" className="btn btn-ghost btn-sm" style={{minWidth:32, justifyContent:'center', padding:'4px 8px'}}
            onMouseDown={e => { e.preventDefault(); apply(b); }}>{b}</button>
        ))}
        <button type="button" className="btn btn-ghost btn-sm" disabled={uploading}
          onMouseDown={e => e.preventDefault()} onClick={() => fileRef.current && fileRef.current.click()}>
          {uploading ? 'Uploading…' : <><Icon name="camera" size={12}/> Image</>}
        </button>
        <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" style={{display:'none'}}
          onChange={e => { const f = e.target.files[0]; e.target.value = ''; insertImage(f); }} />
      </div>
      <textarea ref={taRef} className="textarea" style={{minHeight, marginTop:12, border:'none', fontSize:15, lineHeight:1.6, fontFamily:'Archivo, sans-serif'}}
        placeholder={placeholder} value={value || ''} onChange={e => onChange(e.target.value)} />
    </div>
  );
}

// Cover/step image slot, click or drag-drop to upload, with replace/remove.
function ImageUploadSlot({ value, onChange, aspect = '16/10', label, alt, onAltChange }) {
  const fileRef = React.useRef(null);
  const [uploading, setUploading] = useState(false);
  const pick = async (file) => {
    if (!file) return;
    setUploading(true);
    try { onChange(await uploadImage(file)); }
    catch { adminToast('Image upload failed.'); }
    setUploading(false);
  };
  return (
    <div>
      <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" style={{display:'none'}}
        onChange={e => { const f = e.target.files[0]; e.target.value = ''; pick(f); }} />
      {value ? (
        <div style={{marginTop:10}}>
          <img src={value} alt="" style={{width:'100%', aspectRatio:aspect, objectFit:'cover', display:'block'}} />
          <div className="row-flex" style={{gap:6, marginTop:8}}>
            <button type="button" className="btn btn-ghost btn-sm" disabled={uploading} onClick={() => fileRef.current.click()}>{uploading ? 'Uploading…' : 'Replace'}</button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => onChange('')}>Remove</button>
          </div>
          {onAltChange && (
            <input className="input" style={{marginTop:8, fontSize:13}} placeholder="Describe this image (alt text, for accessibility)"
              value={alt||''} onChange={e=>onAltChange(e.target.value)} />
          )}
        </div>
      ) : (
        <div className="slot" style={{aspectRatio:aspect, marginTop:10, cursor:'pointer'}}
          onClick={() => fileRef.current.click()}
          onDragOver={e => e.preventDefault()}
          onDrop={e => { e.preventDefault(); pick(e.dataTransfer.files[0]); }}>
          {uploading ? 'Uploading…' : (label || 'DROP IMAGE, OR CLICK')}
        </div>
      )}
    </div>
  );
}

// Chip/tag list input - Enter or comma to add, × to remove.
function ChipInput({ value, onChange, placeholder, suggestions }) {
  const [draft, setDraft] = useState('');
  const items = value || [];
  const add = (v) => {
    v = (v ?? draft).trim();
    if (v && !items.includes(v)) onChange([...items, v]);
    setDraft('');
  };
  const unused = (suggestions || []).filter(s => !items.includes(s));
  return (
    <div>
      {items.length > 0 && (
        <div className="row-flex" style={{gap:6, flexWrap:'wrap', marginBottom:8}}>
          {items.map((t,i) => (
            <span key={i} className="tag tag-outline" style={{display:'inline-flex', alignItems:'center', gap:6}}>
              {t}
              <button type="button" aria-label={`Remove ${t}`} onClick={() => onChange(items.filter((_,j) => j !== i))}
                style={{background:'none', border:'none', cursor:'pointer', color:'inherit', fontSize:12, lineHeight:1, padding:0}}>×</button>
            </span>
          ))}
        </div>
      )}
      <input className="input" placeholder={placeholder} value={draft} onChange={e => setDraft(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add(); } }}
        onBlur={() => add()} />
      {unused.length > 0 && (
        <div className="row-flex" style={{gap:6, flexWrap:'wrap', marginTop:8}}>
          {unused.map(s => (
            <button key={s} type="button" className="tag tag-outline" style={{cursor:'pointer', background:'none'}}
              onClick={() => add(s)}>+ {s}</button>
          ))}
        </div>
      )}
    </div>
  );
}

// Styled like the other <select> fields (same chevron, same box), but opens a
// searchable list of existing values with a "+ Create" option for new ones.
function ComboSelect({ value, options, onChange, placeholder }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const rootRef = React.useRef(null);
  const inputRef = React.useRef(null);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    const t = setTimeout(() => inputRef.current && inputRef.current.focus(), 0);
    const onDocClick = (e) => { if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => { clearTimeout(t); document.removeEventListener('mousedown', onDocClick); document.removeEventListener('keydown', onKey); };
  }, [open]);

  const q = query.trim();
  const ql = q.toLowerCase();
  const filtered = ql ? options.filter(o => o.toLowerCase().includes(ql)) : options;
  const canCreate = q && !options.some(o => o.toLowerCase() === ql);
  const choose = (v) => { onChange(v); setOpen(false); };

  return (
    <div ref={rootRef} style={{position:'relative'}}>
      <button type="button" className="select" style={{textAlign:'left', cursor:'pointer', color: value ? 'var(--ink)' : 'var(--ink-3)'}}
        onClick={() => setOpen(o => !o)} aria-haspopup="listbox" aria-expanded={open}>
        {value || placeholder || 'Select or create…'}
      </button>
      {open && (
        <div role="listbox" style={{position:'absolute', top:'calc(100% + 6px)', left:0, right:0, background:'var(--bg-elev)', border:'1px solid var(--line-strong)', boxShadow:'var(--shadow)', zIndex:80, maxHeight:280, display:'flex', flexDirection:'column'}}>
          <input ref={inputRef} className="input" style={{border:'none', borderBottom:'1px solid var(--line)'}}
            placeholder="Search or type to create…" value={query} onChange={e => setQuery(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && canCreate) { e.preventDefault(); choose(q); } }} />
          <div style={{overflowY:'auto'}}>
            {filtered.length === 0 && !canCreate && (
              <div style={{padding:'10px 12px', fontSize:13, color:'var(--ink-3)'}}>No options yet - type to create one.</div>
            )}
            {filtered.map(o => (
              <div key={o} role="option" aria-selected={o===value} tabIndex={0} onClick={() => choose(o)}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choose(o); } }}
                style={{padding:'9px 12px', fontSize:14, cursor:'pointer', background: o===value ? 'var(--bg-deep)' : 'transparent'}}
                onMouseEnter={e => e.currentTarget.style.background='var(--bg-deep)'}
                onMouseLeave={e => e.currentTarget.style.background = o===value ? 'var(--bg-deep)' : 'transparent'}>
                {o}
              </div>
            ))}
            {canCreate && (
              <div role="option" tabIndex={0} onClick={() => choose(q)}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choose(q); } }}
                style={{padding:'9px 12px', fontSize:14, cursor:'pointer', color:'var(--rust)', borderTop: filtered.length ? '1px solid var(--line)' : 'none'}}
                onMouseEnter={e => e.currentTarget.style.background='var(--bg-deep)'}
                onMouseLeave={e => e.currentTarget.style.background='transparent'}>
                + Create "{q}"
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// One card in the step-by-step builder: title, markdown body, photo, reorder/remove.
function StepRow({ step, index, total, onChange, onRemove, onMove }) {
  return (
    <div style={{padding:20, background:'var(--paper)', border:'1px solid var(--line)', marginBottom:14}}>
      <div className="row-flex" style={{justifyContent:'space-between', marginBottom:12}}>
        <span className="mono" style={{fontSize:11, color:'var(--ink-2)', letterSpacing:'.08em'}}>STEP {index + 1}</span>
        <div className="row-flex" style={{gap:4}}>
          <button type="button" className="btn btn-ghost btn-sm" disabled={index === 0} style={{opacity:index === 0 ? 0.4 : 1}} onClick={() => onMove(-1)} title="Move up"><Icon name="chevronUp" size={12}/></button>
          <button type="button" className="btn btn-ghost btn-sm" disabled={index === total - 1} style={{opacity:index === total - 1 ? 0.4 : 1}} onClick={() => onMove(1)} title="Move down"><Icon name="chevronDown" size={12}/></button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onRemove}>Remove</button>
        </div>
      </div>
      <input className="input" placeholder="Step title" value={step.title || ''} onChange={e => onChange({ ...step, title:e.target.value })} style={{marginBottom:10}} />
      <div className="row-flex" style={{gap:16, alignItems:'flex-start', flexWrap:'wrap'}}>
        <div style={{flex:1, minWidth:240}}>
          <MarkdownField value={step.body} onChange={v => onChange({ ...step, body:v })} placeholder="Describe this step…" minHeight={140} />
        </div>
        <div style={{width:160, flexShrink:0}}>
          <ImageUploadSlot value={step.image} onChange={v => onChange({ ...step, image:v })} aspect="4/3" label="STEP PHOTO"
            alt={step.imageAlt} onAltChange={v => onChange({ ...step, imageAlt:v })} />
        </div>
      </div>
    </div>
  );
}

function AdminTutorials({ sessionInfo, siteUrl }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editId, setEditId] = useState(null); // null | 'new' | tutorial id
  const [form, setForm] = useState({});
  const [notice, setNotice] = useState({ type:'', msg:'' });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [membershipTiers, setMembershipTiers] = useState([]);
  const [staffNames, setStaffNames] = useState([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const dirty = useDirtyTracker(form, editId);

  useEffect(() => {
    fetch('/api/admin/tutorials', { credentials:'include' })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(d => setRows(d.items || []))
      .catch(() => setError('Failed to load tutorials.'))
      .finally(() => setLoading(false));
    fetch('/api/admin/memberships', { credentials:'include' })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(d => setMembershipTiers((d.tiers || []).filter(t => t.status === 'published')))
      .catch(() => {});
    fetch('/api/admin/staff', { credentials:'include' })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(d => setStaffNames((d.members || []).filter(m => m.status === 'active').map(m => m.name).filter(Boolean)))
      .catch(() => {});
  }, []);

  const open = (rowOrNew) => {
    if (rowOrNew === 'new') { setEditId('new'); setForm({ ...newTutorial(), author: sessionInfo?.username || '' }); }
    else { setEditId(rowOrNew.id); setForm({ ...newTutorial(), ...rowOrNew }); }
    setNotice({ type:'', msg:'' });
    setPreviewing(false);
  };

  const closeEditor = async () => {
    if (dirty && !(await adminConfirm('Discard unsaved changes to this tutorial?', { danger:true, confirmLabel:'Discard' }))) return;
    setEditId(null);
  };

  const save = async (overrides = {}) => {
    setNotice({ type:'', msg:'' });
    const payload = { ...form, ...overrides };
    payload.title = (payload.title || '').trim();
    payload.slug = slugify(payload.slug) || slugify(payload.title);
    payload.cat = (payload.cat || '').trim() || 'General';
    payload.format = payload.format || 'article';
    payload.author = (payload.author || '').trim() || 'Staff';
    payload.status = payload.status || 'Draft';
    payload.date = payload.date || new Date().toISOString().slice(0, 10);
    payload.views = Number.isFinite(Number(payload.views)) ? Number(payload.views) : 0;
    payload.body = payload.body || '';
    payload.steps = (payload.steps || []).map(s => ({ ...s, title: (s.title || '').trim(), body: s.body || '' }));
    payload.series = (payload.series || '').trim();
    payload.seriesOrder = payload.series ? (Number(payload.seriesOrder) || 1) : '';
    // duration (estimated read time) is computed authoritatively by the server from content.
    if (!payload.title) { setNotice({ type:'error', msg:'Title is required.' }); return; }
    if (payload.format === 'steps' && payload.steps.length === 0) { setNotice({ type:'error', msg:"Add at least one step, or switch to Article/Info." }); return; }
    setSaving(true);
    const r = await fetch('/api/admin/tutorials/save', { method:'POST', headers:postHeaders(), credentials:'include', body: JSON.stringify(payload) }).catch(() => null);
    setSaving(false);
    if (r && r.ok) {
      const d = await r.json();
      setRows(rs => editId === 'new' ? [...rs, d.item] : rs.map(row => row.id === d.item.id ? d.item : row));
      setNotice({ type:'success', msg: payload.status === 'Published' ? 'Tutorial published.' : 'Tutorial saved.' });
      setEditId(null);
      return;
    }
    setNotice({ type:'error', msg:'Failed to save tutorial.' });
  };

  const removeTutorial = async (row) => {
    if (!(await adminConfirm(`Delete "${row.title || 'this tutorial'}"? This can't be undone.`, { danger:true, confirmLabel:'Delete' }))) return;
    setDeleting(true);
    const r = await fetch('/api/admin/tutorials/delete', { method:'POST', headers:postHeaders(), credentials:'include', body: JSON.stringify({ id: row.id }) }).catch(() => null);
    setDeleting(false);
    if (r && r.ok) {
      setRows(rs => rs.filter(x => x.id !== row.id));
      if (editId !== null && editId !== 'new') setEditId(null);
    } else adminToast('Failed to delete tutorial.');
  };

  const duplicate = (row) => {
    // A duplicate must never keep the original's slug (they'd collide, the
    // public /tutorial/:slug lookup would resolve to whichever comes first).
    // If it's part of a series, bump to the next free part number too,
    // rather than creating a second "Part N" collision in the series box.
    const seriesPeers = row.series ? rows.filter(r => r.series === row.series) : [];
    const seriesOrder = seriesPeers.length ? Math.max(...seriesPeers.map(r => Number(r.seriesOrder) || 0)) + 1 : row.seriesOrder;
    setEditId('new');
    setForm({ ...newTutorial(), ...row, id: undefined, title: row.title + ' (copy)', status:'Draft', views:0,
      date: new Date().toISOString().slice(0,10), slug:'', _slugTouched:false, seriesOrder });
    setNotice({ type:'', msg:'' });
    setPreviewing(false);
  };

  const setStep = (idx, next) => setForm(f => ({ ...f, steps: f.steps.map((s,i) => i === idx ? next : s) }));
  const addStep = () => setForm(f => ({ ...f, steps: [...(f.steps || []), emptyStep()] }));
  const removeStep = (idx) => setForm(f => ({ ...f, steps: f.steps.filter((_,i) => i !== idx) }));
  const moveStep = (idx, dir) => setForm(f => {
    const steps = [...f.steps];
    const to = idx + dir;
    if (to < 0 || to >= steps.length) return f;
    [steps[idx], steps[to]] = [steps[to], steps[idx]];
    return { ...f, steps };
  });

  if (editId !== null) {
    const format = form.format || 'article';
    const existingCategories = Array.from(new Set(rows.map(r => r.cat).filter(Boolean))).sort((a,b) => a.localeCompare(b));
    const existingSeries = Array.from(new Set(rows.map(r => r.series).filter(Boolean))).sort((a,b) => a.localeCompare(b));
    const existingAuthors = Array.from(new Set([...staffNames, ...rows.map(r => r.author)])).filter(Boolean).sort((a,b) => a.localeCompare(b));
    const existingTags = Array.from(new Set(rows.flatMap(r => r.tags || []))).filter(Boolean).sort((a,b) => a.localeCompare(b));
    const existingTools = Array.from(new Set(rows.flatMap(r => r.tools || []))).filter(Boolean).sort((a,b) => a.localeCompare(b));
    const liveDuration = format === 'steps'
      ? estimateReadTime(form.intro, (form.tools||[]).join(' '), ...(form.steps||[]).map(s => `${s.title||''} ${s.body||''}`))
      : estimateReadTime(form.body);
    const chooseSeries = (name) => {
      const partsInSeries = rows.filter(r => r.series === name && r.id !== form.id);
      const nextOrder = partsInSeries.length ? Math.max(...partsInSeries.map(r => Number(r.seriesOrder) || 0)) + 1 : 1;
      setForm(f => ({ ...f, series:name, seriesOrder: f.seriesOrder || nextOrder }));
    };
    return (
      <div style={{padding:32}}>
        <div className="row-flex" style={{justifyContent:'space-between', marginBottom:18, flexWrap:'wrap', gap:12}}>
          <div>
            <a className="mono" style={{display:'inline-flex', alignItems:'center', gap:4, fontSize:11, color:'var(--rust)', cursor:'pointer'}} onClick={closeEditor}><Icon name="chevronLeft" size={10}/> Back to list</a>
            <h2 className="serif" style={{fontSize:32, marginTop:6}}>{editId === 'new' ? 'New tutorial' : form.title}</h2>
          </div>
          <div className="row-flex" style={{gap:8}}>
            {editId !== 'new' && <button className="btn btn-ghost btn-sm" disabled={deleting} onClick={() => removeTutorial(form)}>{deleting ? 'Deleting…' : 'Delete'}</button>}
            {editId !== 'new' && form.status === 'Published' && form.slug && (
              <a className="btn btn-ghost btn-sm" href={(siteUrl||'') + '/tutorial/' + encodeURIComponent(form.slug)} target="_blank" rel="noreferrer" style={{textDecoration:'none'}}>
                View live <Icon name="externalLink" size={11}/>
              </a>
            )}
            <button className="btn btn-ghost btn-sm" onClick={() => setPreviewing(true)}>Preview</button>
            <button className="btn btn-ghost btn-sm" disabled={saving} onClick={() => save({ status:'Draft' })}>{saving ? 'Saving…' : 'Save draft'}</button>
            <button className="btn btn-rust btn-sm" disabled={saving} onClick={() => save({ status:'Published' })}>{saving ? 'Publishing…' : <>Publish <Icon name="chevronRight" size={11}/></>}</button>
          </div>
        </div>
        {notice.msg && <div style={{marginBottom:12, fontSize:13, color:notice.type==='error'?'var(--rust)':'var(--eucalyptus)'}}>{notice.msg}</div>}

        <div className="admin-split" style={{display:'grid', gridTemplateColumns:'1fr 300px', gap:24}}>
          <div style={{background:'var(--paper)', border:'1px solid var(--line)', padding:32}}>
            <input className="input" placeholder="Tutorial title" value={form.title||''} onChange={e=>{
                const title = e.target.value;
                setForm(f => ({ ...f, title, ...(f._slugTouched ? {} : { slug: slugify(title) }) }));
              }}
              style={{fontFamily:'Instrument Serif, serif', fontSize:32, padding:'8px 0', border:'none', borderBottom:'1px solid var(--line)', background:'transparent'}} />
            <div className="mono" style={{fontSize:11, color:'var(--ink-2)', marginTop:8, letterSpacing:'.08em'}}>BY {(form.author||'YOU').toUpperCase()} · {form.cat?.toUpperCase()} · {form.date||'TODAY'}</div>

            <div className="row-flex" style={{gap:6, marginTop:20}} role="group" aria-label="Tutorial format">
              {TUTORIAL_FORMATS.map(f => (
                <button key={f.id} type="button" className={`tab ${format===f.id?'active':''}`} style={{cursor:'pointer'}}
                  title={f.hint} onClick={() => setForm({...form, format:f.id})}>{f.label}</button>
              ))}
            </div>

            <label className="field" style={{marginTop:18}}><span className="label">Short description</span>
              <textarea className="textarea" style={{minHeight:60}} placeholder="One or two sentences, shown on the tutorial card and used as the meta description fallback."
                value={form.description||''} onChange={e=>setForm({...form, description:e.target.value})} />
            </label>

            {format === 'steps' ? (
              <>
                <div style={{marginTop:22}}>
                  <span className="eyebrow">INTRO (OPTIONAL)</span>
                  <div style={{marginTop:8}}>
                    <MarkdownField value={form.intro} onChange={v=>setForm({...form, intro:v})} placeholder="Set the scene before step 1…" minHeight={100} />
                  </div>
                </div>
                <div style={{marginTop:22}}>
                  <span className="eyebrow">TOOLS &amp; PARTS NEEDED</span>
                  <div style={{marginTop:8}}>
                    <ChipInput value={form.tools} onChange={v=>setForm({...form, tools:v})} placeholder="Type a tool or part, press Enter" suggestions={existingTools} />
                  </div>
                </div>
                <div style={{marginTop:26}}>
                  <div className="row-flex" style={{justifyContent:'space-between', marginBottom:12}}>
                    <span className="eyebrow">STEPS</span>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={addStep}>+ Add step</button>
                  </div>
                  {(form.steps||[]).length === 0 && (
                    <div style={{fontSize:12, color:'var(--ink-2)', padding:'16px 0', textAlign:'center', border:'1px dashed var(--line-strong)'}}>No steps yet, add the first one.</div>
                  )}
                  {(form.steps||[]).map((s,i) => (
                    <StepRow key={s.id||i} step={s} index={i} total={form.steps.length}
                      onChange={next=>setStep(i,next)} onRemove={()=>removeStep(i)} onMove={dir=>moveStep(i,dir)} />
                  ))}
                </div>
              </>
            ) : (
              <div style={{marginTop:18}}>
                <MarkdownField value={form.body} onChange={v=>setForm({...form, body:v})}
                  placeholder="Start writing… Markdown supported." minHeight={380} />
              </div>
            )}
          </div>

          <aside style={{display:'grid', gap:14, alignContent:'start'}}>
            <div style={{padding:18, background:'var(--paper)', border:'1px solid var(--line)'}}>
              <span className="eyebrow">VISIBILITY</span>
              <label className="field" style={{marginTop:10}}><span className="label">Status</span>
                <select className="select" value={form.status||'Draft'} onChange={e=>setForm({...form, status:e.target.value})}>
                  <option>Draft</option><option>Review</option><option>Published</option><option>Archived</option>
                </select>
              </label>
              <div className="field"><span className="label">Category</span>
                <ComboSelect value={form.cat} options={existingCategories} placeholder="Select or create…"
                  onChange={v=>setForm({...form, cat:v})} />
              </div>
              {format !== 'info' && (
                <label className="field"><span className="label">Difficulty</span>
                  <select className="select" value={form.difficulty||'Intermediate'} onChange={e=>setForm({...form, difficulty:e.target.value})}>
                    <option>Beginner</option><option>Intermediate</option><option>Advanced</option><option>Expert</option>
                  </select>
                </label>
              )}
              <label className="field"><span className="label">Access</span>
                <select className="select" value={form.requiredTierId || ''} onChange={e=>setForm({...form, requiredTierId: e.target.value})}>
                  <option value="">Public</option>
                  {membershipTiers.map(t => (
                    <option key={t.id} value={t.id}>{t.name}+</option>
                  ))}
                </select>
              </label>
              {format !== 'info' && (
                <div className="field"><span className="label">Estimated read</span>
                  <div className="input" style={{background:'var(--bg-elev)', color:'var(--ink-2)', cursor:'default'}} title="Calculated automatically from the word count.">
                    {liveDuration}
                  </div>
                </div>
              )}
              <label className="field"><span className="label">Author</span>
                <ComboSelect value={form.author} options={existingAuthors} placeholder="Select or type a name…"
                  onChange={v=>setForm({...form, author:v})} />
              </label>
            </div>
            <div style={{padding:18, background:'var(--paper)', border:'1px solid var(--line)'}}>
              <span className="eyebrow">SERIES</span>
              <label className="field" style={{marginTop:10}}><span className="label">Series name</span>
                <ComboSelect value={form.series} options={existingSeries} placeholder="None, standalone tutorial"
                  onChange={chooseSeries} />
              </label>
              {form.series && (
                <>
                  <label className="field"><span className="label">Part number</span>
                    <input className="input" type="number" min="1" placeholder="1" value={form.seriesOrder||''}
                      onChange={e=>setForm({...form, seriesOrder:e.target.value})}/>
                  </label>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={()=>setForm({...form, series:'', seriesOrder:''})}>Remove from series</button>
                </>
              )}
            </div>
            <div style={{padding:18, background:'var(--paper)', border:'1px solid var(--line)'}}>
              <span className="eyebrow">COVER IMAGE</span>
              <ImageUploadSlot value={form.coverImage} onChange={v=>setForm({...form, coverImage:v})} aspect="16/10" label="16:10 · DROP IMAGE, OR CLICK"
                alt={form.coverImageAlt} onAltChange={v=>setForm({...form, coverImageAlt:v})} />
            </div>
            <div style={{padding:18, background:'var(--paper)', border:'1px solid var(--line)'}}>
              <span className="eyebrow">VIDEO</span>
              <label className="field" style={{marginTop:10}}><span className="label">YouTube or Vimeo URL</span>
                <input className="input" placeholder="https://youtube.com/watch?v=…" value={form.videoUrl||''} onChange={e=>setForm({...form, videoUrl:e.target.value})}/>
              </label>
              {form.videoUrl && !isTrustedVideoUrl(form.videoUrl) && (
                <div style={{fontSize:12, color:'var(--rust)', marginTop:6}}>
                  Only YouTube and Vimeo links are supported, this URL will be removed when you save.
                </div>
              )}
            </div>
            <div style={{padding:18, background:'var(--paper)', border:'1px solid var(--line)'}}>
              <span className="eyebrow">TAGS</span>
              <div style={{marginTop:10}}>
                <ChipInput value={form.tags} onChange={v=>setForm({...form, tags:v})} placeholder="Add a tag, press Enter" suggestions={existingTags} />
              </div>
            </div>
            <div style={{padding:18, background:'var(--paper)', border:'1px solid var(--line)'}}>
              <span className="eyebrow">SEO</span>
              <label className="field" style={{marginTop:10}}><span className="label">Slug</span><input className="input" placeholder="building-a-12v-solar-shed" value={form.slug||''} onChange={e=>setForm({...form, slug:e.target.value, _slugTouched:true})}/></label>
              <label className="field"><span className="label">Meta description</span><textarea className="textarea" style={{minHeight:80}} value={form.metaDesc||''} onChange={e=>setForm({...form, metaDesc:e.target.value})}/></label>
            </div>
          </aside>
        </div>
        {previewing && (
          <div style={{position:'fixed', inset:0, zIndex:500, background:'rgba(15,13,10,0.75)', display:'flex', flexDirection:'column', alignItems:'center', padding:'40px 16px', overflowY:'auto'}}
            onClick={() => setPreviewing(false)}>
            <div style={{width:'100%', maxWidth:760, background:'var(--paper)', padding:'40px 48px', boxShadow:'0 16px 48px rgba(0,0,0,.35)'}}
              onClick={e => e.stopPropagation()}>
              <div className="mono" style={{fontSize:10, color:'var(--ink-3)', marginBottom:18, letterSpacing:'.1em'}}>PREVIEW · NOT PUBLISHED</div>
              <h1 style={{fontFamily:'Instrument Serif, serif', fontSize:48, lineHeight:1.05, marginBottom:10}}>{form.title || 'Untitled'}</h1>
              <div className="mono" style={{fontSize:11, color:'var(--ink-2)', marginBottom:20}}>
                {[
                  (form.author||'STAFF').toUpperCase(),
                  form.cat && form.cat.toUpperCase(),
                  format !== 'info' && form.difficulty,
                  format !== 'info' && liveDuration,
                ].filter(Boolean).join(' · ')}
              </div>
              {form.series && (
                <div className="mono" style={{fontSize:11, color:'var(--rust)', marginBottom:16}}>
                  {form.series.toUpperCase()} · PART {form.seriesOrder||1}
                </div>
              )}
              {form.coverImage && <img src={form.coverImage} alt={form.coverImageAlt || form.title} style={{width:'100%', maxHeight:320, objectFit:'cover', marginBottom:24}} />}
              {form.videoUrl && (
                <div style={{position:'relative', paddingTop:'56.25%', marginBottom:24, background:'#000'}}>
                  <iframe src={form.videoUrl} style={{position:'absolute', inset:0, width:'100%', height:'100%', border:0}} allowFullScreen title="Video preview" />
                </div>
              )}
              {format === 'steps' ? (
                <>
                  {form.intro && <div style={{fontSize:15, lineHeight:1.75, color:'var(--ink)'}}>{renderMarkdown(form.intro)}</div>}
                  {(form.tools||[]).length > 0 && (
                    <div style={{background:'var(--bg-elev)', padding:'14px 18px', margin:'12px 0'}}>
                      <div className="eyebrow" style={{marginBottom:6}}>WHAT YOU'LL NEED</div>
                      <ul style={{margin:0, paddingLeft:18, fontSize:13}}>{form.tools.map((t,i)=><li key={i}>{t}</li>)}</ul>
                    </div>
                  )}
                  {(form.steps||[]).length === 0 ? (
                    <p style={{color:'var(--ink-2)', fontSize:14}}>(no steps yet)</p>
                  ) : form.steps.map((s,i) => (
                    <div key={s.id||i} style={{marginBottom:20}}>
                      <h3 style={{fontFamily:'Instrument Serif, serif', fontSize:20, marginBottom:6}}>{i+1}. {s.title || 'Untitled step'}</h3>
                      {s.image && <img src={s.image} alt={s.imageAlt || s.title} style={{width:'100%', maxHeight:240, objectFit:'cover', marginBottom:8}} />}
                      <div style={{fontSize:15, lineHeight:1.75, color:'var(--ink)'}}>{renderMarkdown(s.body)}</div>
                    </div>
                  ))}
                </>
              ) : (
                <div style={{fontSize:15, lineHeight:1.75, color:'var(--ink)'}}>{form.body ? renderMarkdown(form.body) : '(no body yet)'}</div>
              )}
              {form.series && (() => {
                const peers = rows.filter(r => r.series === form.series && r.id !== form.id);
                const previewId = form.id || '__preview__';
                const allParts = [...peers, { ...form, id: previewId }].sort((a,b) => (Number(a.seriesOrder)||0) - (Number(b.seriesOrder)||0));
                return (
                  <div style={{marginTop:24, padding:20, background:'var(--bg-elev)', border:'1px solid var(--line)'}}>
                    <div className="eyebrow" style={{marginBottom:10}}>{form.series}, {allParts.length} PART{allParts.length===1?'':'S'}</div>
                    <ol style={{listStyle:'none', margin:0, padding:0, display:'grid', gap:4, fontSize:13}}>
                      {allParts.map(p => (
                        <li key={p.id}>
                          {p.id === previewId
                            ? <strong>#{p.seriesOrder||1} · {p.title || 'Untitled'} (this part)</strong>
                            : <span style={{color:'var(--ink-2)'}}>#{p.seriesOrder||1} · {p.title}</span>}
                        </li>
                      ))}
                    </ol>
                  </div>
                );
              })()}
              <button className="btn btn-ghost btn-sm" style={{marginTop:32}} onClick={() => setPreviewing(false)}>Close preview</button>
            </div>
          </div>
        )}
      </div>
    );
  }

  const counts = {
    All: rows.length,
    Published: rows.filter(r=>r.status==='Published').length,
    Draft: rows.filter(r=>r.status==='Draft').length,
    Review: rows.filter(r=>r.status==='Review').length,
    Archived: rows.filter(r=>r.status==='Archived').length,
  };
  const q = search.trim().toLowerCase();
  const filtered = rows
    .filter(r => statusFilter === 'All' || r.status === statusFilter)
    .filter(r => !q
      || (r.title||'').toLowerCase().includes(q)
      || (r.author||'').toLowerCase().includes(q)
      || (r.cat||'').toLowerCase().includes(q)
      || (r.series||'').toLowerCase().includes(q)
      || (r.tags||[]).some(t => t.toLowerCase().includes(q)));

  return (
    <div style={{padding:32}}>
      {loading && <div className="mono" style={{fontSize:12, color:'var(--ink-2)', marginBottom:10}}>Loading…</div>}
      {error && <div style={{fontSize:12, color:'var(--rust)', marginBottom:10}}>{error}</div>}
      <div className="row-flex" style={{justifyContent:'space-between', flexWrap:'wrap', gap:12, marginBottom:18}}>
        <div className="tabs">
          {['All','Published','Draft','Review','Archived'].map(t => (
            <div key={t} className={`tab ${statusFilter===t?'active':''}`} style={{cursor:'pointer'}} onClick={()=>setStatusFilter(t)}>{t} ({counts[t]})</div>
          ))}
        </div>
        <div className="row-flex" style={{gap:8}}>
          <input className="input" style={{width:220}} placeholder="Search title or author…" value={search} onChange={e=>setSearch(e.target.value)} />
          <button className="btn btn-rust btn-sm" onClick={() => open('new')}>+ New tutorial</button>
        </div>
      </div>
      <Table
        columns={[
          { key:'title', label:'Title', w:'2.2fr', render:r => <span style={{fontWeight:600}}>{r.title}</span>, sort:true },
          { key:'format', label:'Format', w:'110px', render:r => <span className="tag tag-outline">{(TUTORIAL_FORMATS.find(f=>f.id===(r.format||'article'))||TUTORIAL_FORMATS[0]).label.toUpperCase()}</span> },
          { key:'cat', label:'Category', w:'1fr', render:r => <span className="tag tag-outline">{(r.cat||'').toUpperCase()}</span>, sort:true },
          { key:'series', label:'Series', w:'1.2fr', render:r => r.series ? <span className="mono" style={{fontSize:11, color:'var(--ink-2)'}}>{r.series} · #{r.seriesOrder||1}</span> : <span style={{color:'var(--ink-3)'}}>-</span>, sort:true },
          { key:'author', label:'Author', w:'1fr', sort:true },
          { key:'date', label:'Date', w:'90px', render:r => <span className="mono" style={{fontSize:12, color:'var(--ink-2)'}}>{r.date}</span>, sort:true },
          { key:'views', label:'Views', w:'80px', render:r => <span className="mono">{(r.views||0).toLocaleString()}</span>, sort:true },
          { key:'status', label:'Status', w:'110px', render:r => <span className={`tag ${r.status==='Published'?'tag-euc':r.status==='Draft'?'tag-ochre':'tag-outline'}`}>{(r.status||'').toUpperCase()}</span>, sort:true },
          { key:'actions', label:'', w:'90px', render:r => (
            <div className="row-flex" style={{gap:4}} onClick={e=>e.stopPropagation()}>
              <button type="button" className="btn btn-ghost btn-sm" title="Duplicate" onClick={()=>duplicate(r)}><Icon name="copy" size={12}/></button>
              <button type="button" className="btn btn-ghost btn-sm" title="Delete" onClick={()=>removeTutorial(r)}><Icon name="trash" size={12}/></button>
            </div>
          ) },
        ]}
        rows={filtered}
        onRowClick={(r)=>open(r)}
        emptyMessage="No tutorials match."
      />
    </div>
  );
}

// ============================================================
// AI MODELS & BOXES
// ============================================================

const AI_STATUS_OPTIONS = ['Active','Beta','Training','Draft','Archived'];
const BOX_STATUS_OPTIONS = ['OK','Low batt','Offline','Maintenance'];

function AIModelDrawer({ model, onChange }) {
  const inp = { width:'100%', padding:'8px 10px', border:'1px solid var(--line-strong)', fontFamily:'inherit', fontSize:14, background:'var(--paper)', color:'var(--ink)' };
  const f = (key, label, placeholder, extra={}) => (
    <label className="field" key={key}>
      <span className="label">{label}</span>
      <input style={{...inp,...(extra.mono?{fontFamily:'monospace'}:{})}} value={model?.[key]||''} onChange={e=>onChange({...model,[key]:e.target.value})} placeholder={placeholder} />
    </label>
  );
  return (
    <div style={{display:'grid', gap:12}}>
      {f('name','Model name','e.g. outback-vision-v3',{mono:true})}
      {f('task','Task','e.g. Part identification')}
      {f('size','Size','e.g. 1.4B',{mono:true})}
      {f('acc','Accuracy','e.g. 94.2%',{mono:true})}
      {f('deployments','Deployments','0')}
      <label className="field">
        <span className="label">Status</span>
        <select style={inp} value={model?.status||'Draft'} onChange={e=>onChange({...model,status:e.target.value})}>
          {AI_STATUS_OPTIONS.map(s=><option key={s}>{s}</option>)}
        </select>
      </label>
    </div>
  );
}

function BoxDrawer({ box, onChange, modelOptions }) {
  const inp = { width:'100%', padding:'8px 10px', border:'1px solid var(--line-strong)', fontFamily:'inherit', fontSize:14, background:'var(--paper)', color:'var(--ink)' };
  const f = (key, label, placeholder, extra={}) => (
    <label className="field" key={key}>
      <span className="label">{label}</span>
      <input style={{...inp,...(extra.mono?{fontFamily:'monospace'}:{})}} value={box?.[key]||''} onChange={e=>onChange({...box,[key]:e.target.value})} placeholder={placeholder} />
    </label>
  );
  return (
    <div style={{display:'grid', gap:12}}>
      {f('id','Box ID','e.g. BOX-004',{mono:true})}
      {f('site','Site','e.g. Warehouse B')}
      <label className="field">
        <span className="label">Running model</span>
        <select style={inp} value={box?.model||''} onChange={e=>onChange({...box,model:e.target.value})}>
          <option value="">none</option>
          {modelOptions.map(m=><option key={m}>{m}</option>)}
        </select>
      </label>
      {f('uptime','Uptime','e.g. 14d 3h',{mono:true})}
      {f('sig','Link / Signal','e.g. 4G or WiFi',{mono:true})}
      {f('battery','Battery','e.g. 82%',{mono:true})}
      <label className="field">
        <span className="label">Status</span>
        <select style={inp} value={box?.status||'OK'} onChange={e=>onChange({...box,status:e.target.value})}>
          {BOX_STATUS_OPTIONS.map(s=><option key={s}>{s}</option>)}
        </select>
      </label>
    </div>
  );
}

const POLICY_AUDIENCE_LABELS = { all: 'All Customers', private: 'Private Customer', commercial: 'Commercial Customer', seller: 'Seller' };
const POLICY_AUDIENCE_ORDER = ['private', 'commercial', 'seller', 'all'];
function newPolicy() { return { audience: 'private', slug: '', title: '', body: '', status: 'draft' }; }

function AdminPolicies({ siteUrl }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editId, setEditId] = useState(null); // null | 'new' | policy id
  const [form, setForm] = useState({});
  const [notice, setNotice] = useState({ type:'', msg:'' });
  const [saving, setSaving] = useState(false);
  const dirty = useDirtyTracker(form, editId);

  useEffect(() => {
    fetch('/api/admin/policies', { credentials:'include' })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(d => setRows(d.items || []))
      .catch(() => setError('Failed to load policies.'))
      .finally(() => setLoading(false));
  }, []);

  const replaceRow = (item) => setRows(rs => {
    const idx = rs.findIndex(x => x.audience === item.audience && x.slug === item.slug);
    const next = { ...item, isDefault: false };
    if (idx < 0) return [...rs, next];
    const copy = [...rs]; copy[idx] = next; return copy;
  });

  const open = (rowOrNew) => {
    if (rowOrNew === 'new') { setEditId('new'); setForm(newPolicy()); }
    else { setEditId(rowOrNew.id); setForm({ ...rowOrNew }); }
    setNotice({ type:'', msg:'' });
  };

  const closeEditor = async () => {
    if (dirty && !(await adminConfirm('Discard unsaved changes to this policy?', { danger:true, confirmLabel:'Discard' }))) return;
    setEditId(null);
  };

  const save = async (overrides = {}) => {
    setNotice({ type:'', msg:'' });
    const payload = { ...form, ...overrides };
    payload.title = (payload.title || '').trim();
    payload.slug = slugify(payload.slug) || slugify(payload.title);
    payload.body = (payload.body || '').trim();
    // isDefault/_slugTouched are client-only scratch fields (isDefault is computed
    // by the server on every read; _slugTouched just tracks whether the user
    // hand-edited the slug field), never part of the persisted document.
    delete payload.isDefault;
    delete payload._slugTouched;
    if (!payload.title) { setNotice({ type:'error', msg:'Title is required.' }); return; }
    if (!payload.slug) { setNotice({ type:'error', msg:'Slug is required.' }); return; }
    if (!payload.body) { setNotice({ type:'error', msg:'Body is required.' }); return; }
    if (form.status === 'published' && payload.status !== 'published') {
      const ok = await adminConfirm('This document is currently live on the public site. Saving it as a draft will take it down until you publish again.\nContinue?', {
        title: 'Unpublish live document', confirmLabel: 'Save as draft', cancelLabel: 'Cancel', danger: true,
      });
      if (!ok) return;
    }
    setSaving(true);
    const r = await fetch('/api/admin/policies/save', { method:'POST', headers:postHeaders(), credentials:'include', body: JSON.stringify(payload) }).catch(() => null);
    setSaving(false);
    if (r && r.ok) {
      const d = await r.json();
      replaceRow(d.item);
      setNotice({ type:'success', msg: payload.status === 'published' ? 'Policy published.' : 'Policy saved as draft.' });
      setEditId(null);
      return;
    }
    const d = r ? await r.json().catch(() => ({})) : {};
    setNotice({ type:'error', msg: d.message || 'Failed to save policy.' });
  };

  const togglePublish = async (row) => {
    const nextStatus = row.status === 'published' ? 'draft' : 'published';
    const r = await fetch('/api/admin/policies/publish', { method:'POST', headers:postHeaders(), credentials:'include', body: JSON.stringify({ id: row.id, status: nextStatus }) }).catch(() => null);
    if (r && r.ok) { const d = await r.json(); replaceRow(d.item); }
    else adminToast('Failed to update policy status.');
  };

  if (loading) return <div style={{padding:32}}>Loading…</div>;
  if (error) return <div style={{padding:32, color:'var(--rust)'}}>{error}</div>;

  if (editId !== null) {
    const liveHref = form.status === 'published' && form.slug
      ? (siteUrl||'') + '/policies/' + encodeURIComponent(form.audience) + '/' + encodeURIComponent(form.slug)
      : null;
    return (
      <div style={{padding:32}}>
        <div className="row-flex" style={{justifyContent:'space-between', marginBottom:18, flexWrap:'wrap', gap:12}}>
          <div>
            <a className="mono" style={{display:'inline-flex', alignItems:'center', gap:4, fontSize:11, color:'var(--rust)', cursor:'pointer'}} onClick={closeEditor}><Icon name="chevronLeft" size={10}/> Back to list</a>
            <h2 className="serif" style={{fontSize:32, marginTop:6}}>{editId === 'new' ? 'New policy' : form.title}</h2>
          </div>
          <div className="row-flex" style={{gap:8}}>
            {liveHref && <a className="btn btn-ghost btn-sm" href={liveHref} target="_blank" rel="noreferrer" style={{textDecoration:'none'}}>View live <Icon name="externalLink" size={11}/></a>}
            <button className="btn btn-ghost btn-sm" disabled={saving} onClick={() => save({ status:'draft' })}>{saving ? 'Saving…' : 'Save draft'}</button>
            <button className="btn btn-rust btn-sm" disabled={saving} onClick={() => save({ status:'published' })}>{saving ? 'Publishing…' : <>Publish <Icon name="chevronRight" size={11}/></>}</button>
          </div>
        </div>
        {notice.msg && <div style={{marginBottom:12, fontSize:13, color:notice.type==='error'?'var(--rust)':'var(--eucalyptus)'}}>{notice.msg}</div>}
        {editId === 'new' && (
          <div className="notice" style={{marginBottom:18, fontSize:13}}>
            New policies are created from a blank document, they won't inherit any built-in default text.
          </div>
        )}

        <div className="admin-split" style={{display:'grid', gridTemplateColumns:'1fr 280px', gap:24}}>
          <div style={{background:'var(--paper)', border:'1px solid var(--line)', padding:32}}>
            <input className="input" placeholder="Policy title" value={form.title||''} onChange={e=>{
                const title = e.target.value;
                setForm(f => ({ ...f, title, ...(f._slugTouched ? {} : { slug: slugify(title) }) }));
              }}
              style={{fontFamily:'Instrument Serif, serif', fontSize:32, padding:'8px 0', border:'none', borderBottom:'1px solid var(--line)', background:'transparent'}} />
            <div className="mono" style={{fontSize:11, color:'var(--ink-2)', marginTop:8, letterSpacing:'.08em'}}>/POLICIES/{(form.audience||'private').toUpperCase()}/{(form.slug||'…').toUpperCase()}</div>

            <div style={{marginTop:22}}>
              <span className="eyebrow">BODY (MARKDOWN)</span>
              <p style={{fontSize:12, color:'var(--ink-2)', marginTop:4, marginBottom:8}}>
                Use <code>{'{{email}}'}</code>, <code>{'{{phone}}'}</code>, <code>{'{{phoneHref}}'}</code>, <code>{'{{address}}'}</code>, and <code>{'{{abn}}'}</code> as placeholders, they're filled in with live shop settings when the page renders.
              </p>
              <MarkdownField value={form.body} onChange={v=>setForm({...form, body:v})} placeholder="Start writing… Markdown supported." minHeight={420} />
            </div>
          </div>

          <aside style={{display:'grid', gap:14, alignContent:'start'}}>
            <div style={{padding:18, background:'var(--paper)', border:'1px solid var(--line)'}}>
              <span className="eyebrow">DOCUMENT</span>
              <label className="field" style={{marginTop:10}}><span className="label">Audience</span>
                <select className="select" value={form.audience||'private'} onChange={e=>setForm({...form, audience:e.target.value})} disabled={editId !== 'new'}>
                  {POLICY_AUDIENCE_ORDER.map(a => <option key={a} value={a}>{POLICY_AUDIENCE_LABELS[a]}</option>)}
                </select>
              </label>
              <label className="field"><span className="label">Slug</span>
                <input className="input" value={form.slug||''} onChange={e=>setForm({...form, slug:slugify(e.target.value), _slugTouched:true})} placeholder="e.g. return-policy" />
              </label>
              <label className="field"><span className="label">Status</span>
                <select className="select" value={form.status||'draft'} onChange={e=>setForm({...form, status:e.target.value})}>
                  <option value="draft">Draft</option>
                  <option value="published">Published</option>
                </select>
              </label>
              {form.updatedAt && <div className="mono" style={{fontSize:11, color:'var(--ink-2)', marginTop:10}}>Last updated {new Date(form.updatedAt).toLocaleDateString('en-AU', { day:'2-digit', month:'short', year:'numeric' })}{form.updatedBy ? ` by ${form.updatedBy}` : ''}</div>}
            </div>
          </aside>
        </div>
      </div>
    );
  }

  const groups = POLICY_AUDIENCE_ORDER.map(a => ({
    audience: a,
    label: POLICY_AUDIENCE_LABELS[a],
    items: rows.filter(r => r.audience === a).sort((x,y) => x.title.localeCompare(y.title)),
  }));

  return (
    <div style={{padding:32}}>
      <div className="row-flex" style={{justifyContent:'space-between', marginBottom:18}}>
        <p style={{fontSize:13, color:'var(--ink-2)', maxWidth:640}}>
          Legal and policy documents shown on the public site. Documents marked <strong>Built-in</strong> are still using their shipped default text, edit and save one to take it over.
        </p>
        <button className="btn btn-rust btn-sm" onClick={() => open('new')} style={{whiteSpace:'nowrap'}}>+ New policy</button>
      </div>
      {groups.map(g => (
        <div key={g.audience} style={{marginBottom:28}}>
          <div className="eyebrow" style={{marginBottom:10}}>{g.label.toUpperCase()}</div>
          <div style={{display:'grid', gap:1, background:'var(--line)', border:'1px solid var(--line)'}}>
            {g.items.map(row => (
              <div key={row.id} style={{display:'flex', alignItems:'center', gap:12, padding:'14px 18px', background:'var(--paper)', cursor:'pointer'}} onClick={() => open(row)}>
                <div style={{flex:1, minWidth:0}}>
                  <div style={{fontWeight:500, fontSize:14}}>{row.title}</div>
                  <div className="mono" style={{fontSize:11, color:'var(--ink-2)', marginTop:2}}>/{row.slug}</div>
                </div>
                {row.isDefault && <span className="tag tag-outline">BUILT-IN</span>}
                <span className={`tag ${row.status === 'published' ? 'tag-euc' : 'tag-outline'}`}>{row.status === 'published' ? 'PUBLISHED' : 'DRAFT'}</span>
                <button className="btn btn-ghost btn-sm" onClick={e => { e.stopPropagation(); togglePublish(row); }}>
                  {row.status === 'published' ? 'Unpublish' : 'Publish'}
                </button>
              </div>
            ))}
            {g.items.length === 0 && <div style={{padding:'14px 18px', background:'var(--paper)', fontSize:13, color:'var(--ink-2)'}}>No documents.</div>}
          </div>
        </div>
      ))}
    </div>
  );
}

function AdminAI() {
  const [models, setModels] = useState([]);
  const [boxes, setBoxes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');
  const [modelDrawer, setModelDrawer] = useState(null); // null | 'new' | index
  const [modelDraft, setModelDraft] = useState({});
  const [boxDrawer, setBoxDrawer] = useState(null);
  const [boxDraft, setBoxDraft] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch('/api/admin/ai', { credentials:'include' })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(d => { setModels(d.models || []); setBoxes(d.boxes || []); })
      .catch(() => setError('Failed to load AI data.'))
      .finally(() => setLoading(false));
  }, []);

  const saveAll = async (nextModels, nextBoxes) => {
    setSaving(true); setFeedback('');
    const r = await fetch('/api/admin/ai/save', { method:'POST', headers:postHeaders(), credentials:'include', body: JSON.stringify({ models:nextModels, boxes:nextBoxes }) }).catch(()=>null);
    setSaving(false);
    if (r && r.ok) {
      const d = await r.json();
      setModels(d.models || []); setBoxes(d.boxes || []);
      return true;
    }
    setFeedback('Failed to save.'); return false;
  };

  const openNewModel = () => { setModelDraft({ name:'', task:'', size:'', acc:'', deployments:0, status:'Draft' }); setModelDrawer('new'); };
  const openEditModel = (i) => { setModelDraft({...models[i]}); setModelDrawer(i); };
  const saveModel = async () => {
    const next = modelDrawer === 'new' ? [...models, modelDraft] : models.map((m,i)=>i===modelDrawer?modelDraft:m);
    if (await saveAll(next, boxes)) { setModelDrawer(null); setFeedback('Model saved.'); }
  };
  const deleteModel = async () => {
    if (!(await adminConfirm('Delete this model?', { title:'Delete model', confirmLabel:'Delete', danger:true }))) return;
    const next = models.filter((_,i)=>i!==modelDrawer);
    if (await saveAll(next, boxes)) { setModelDrawer(null); setFeedback('Model deleted.'); }
  };

  const openNewBox = () => { setBoxDraft({ id:'', site:'', model:'', uptime:'', sig:'', battery:'', status:'OK' }); setBoxDrawer('new'); };
  const openEditBox = (i) => { setBoxDraft({...boxes[i]}); setBoxDrawer(i); };
  const saveBox = async () => {
    const next = boxDrawer === 'new' ? [...boxes, boxDraft] : boxes.map((b,i)=>i===boxDrawer?boxDraft:b);
    if (await saveAll(models, next)) { setBoxDrawer(null); setFeedback('Box saved.'); }
  };
  const deleteBox = async () => {
    if (!(await adminConfirm('Delete this box?', { title:'Delete box', confirmLabel:'Delete', danger:true }))) return;
    const next = boxes.filter((_,i)=>i!==boxDrawer);
    if (await saveAll(models, next)) { setBoxDrawer(null); setFeedback('Box deleted.'); }
  };

  const map = { OK:{bg:'#d8e7d0', fg:'#345526'}, 'Low batt':{bg:'#fff4d6', fg:'#7a5d10'}, Offline:{bg:'var(--rust)', fg:'#fff'}, Maintenance:{bg:'#e8e0d0', fg:'#555'} };
  const deployedCount = boxes.length;
  const offlineCount = boxes.filter(b => (b.status || '').toLowerCase().includes('offline')).length;
  const lowBattCount = boxes.filter(b => (b.status || '').toLowerCase().includes('low batt')).length;
  const modelOptions = models.map(m => m.name).filter(Boolean);

  return (
    <div style={{padding:32, display:'grid', gap:28}}>
      {loading && <div className="mono" style={{fontSize:12, color:'var(--ink-2)'}}>Loading…</div>}
      {error && <div style={{fontSize:12, color:'var(--rust)'}}>{error}</div>}
      {feedback && <div style={{fontSize:12, color:feedback.includes('Failed')?'var(--rust)':'var(--eucalyptus)'}}>{feedback}</div>}
      <div>
        <div className="row-flex" style={{justifyContent:'space-between', marginBottom:14}}>
          <h3 className="serif" style={{fontSize:24}}>Models</h3>
          <button className="btn btn-rust btn-sm" onClick={openNewModel}>+ New model</button>
        </div>
        {!loading && models.length === 0 && <div className="mono" style={{fontSize:12, color:'var(--ink-3)'}}>No models yet. Click "+ New model" to add one.</div>}
        {models.length > 0 && <Table
          columns={[
            { key:'name', label:'Model', w:'1.5fr', render:r => <span className="mono" style={{color:'var(--rust)'}}>{r.name}</span> },
            { key:'task', label:'Task', w:'2fr' },
            { key:'size', label:'Size', w:'90px', render:r => <span className="mono" style={{fontSize:12}}>{r.size}</span> },
            { key:'acc', label:'Accuracy', w:'100px', render:r => <span className="mono" style={{fontSize:12}}>{r.acc}</span> },
            { key:'deployments', label:'Deployments', w:'120px', render:r => <span className="mono">{r.deployments}</span> },
            { key:'status', label:'Status', w:'120px', render:r => <span className={`tag ${r.status==='Training'?'tag-ochre':r.status==='Beta'?'tag-rust':'tag-euc'}`}>{(r.status||'').toUpperCase()}</span> },
          ]}
          rows={models}
          onRowClick={(_,i) => openEditModel(i)}
        />}
      </div>
      <div>
        <div className="row-flex" style={{justifyContent:'space-between', marginBottom:14}}>
          <h3 className="serif" style={{fontSize:24}}>Field inference boxes</h3>
          <div className="row-flex" style={{gap:12}}>
            <span className="mono" style={{fontSize:11, color:'var(--ink-2)'}}>{deployedCount} DEPLOYED · {offlineCount} OFFLINE · {lowBattCount} LOW-BATT</span>
            <button className="btn btn-rust btn-sm" onClick={openNewBox}>+ New box</button>
          </div>
        </div>
        {!loading && boxes.length === 0 && <div className="mono" style={{fontSize:12, color:'var(--ink-3)'}}>No boxes yet. Click "+ New box" to add one.</div>}
        {boxes.length > 0 && <Table
          columns={[
            { key:'id', label:'Box', w:'120px', render:r => <span className="mono" style={{fontSize:11, color:'var(--rust)'}}>{r.id}</span> },
            { key:'site', label:'Site', w:'2fr' },
            { key:'model', label:'Running', w:'1fr', render:r => <span className="mono" style={{fontSize:12}}>{r.model}</span> },
            { key:'uptime', label:'Uptime', w:'90px', render:r => <span className="mono" style={{fontSize:12}}>{r.uptime}</span> },
            { key:'sig', label:'Link', w:'70px', render:r => <span className="tag tag-outline">{r.sig?.toUpperCase()}</span> },
            { key:'battery', label:'Battery', w:'80px', render:r => <span className="mono" style={{fontSize:12, color: r.battery && parseInt(r.battery)<50?'var(--rust)':'var(--ink)'}}>{r.battery}</span> },
            { key:'status', label:'Status', w:'130px', render:r => <StatusPill value={r.status} map={map}/> },
          ]}
          rows={boxes}
          onRowClick={(_,i) => openEditBox(i)}
        />}
      </div>

      <Drawer open={modelDrawer !== null} onClose={()=>setModelDrawer(null)} title={modelDrawer==='new'?'New model':(modelDraft?.name||'Edit model')}
        footer={<div className="row-flex" style={{justifyContent:'space-between'}}>
          {modelDrawer !== 'new' ? <button className="btn btn-ghost btn-sm" style={{color:'var(--rust)'}} onClick={deleteModel} disabled={saving}>Delete</button> : <span/>}
          <div className="row-flex" style={{gap:8}}>
            <button className="btn btn-ghost btn-sm" onClick={()=>setModelDrawer(null)}>Cancel</button>
            <button className="btn btn-rust btn-sm" onClick={saveModel} disabled={saving}>{saving?'Saving…':'Save'}</button>
          </div>
        </div>}>
        <AIModelDrawer model={modelDraft} onChange={setModelDraft} />
      </Drawer>

      <Drawer open={boxDrawer !== null} onClose={()=>setBoxDrawer(null)} title={boxDrawer==='new'?'New box':(boxDraft?.id||'Edit box')}
        footer={<div className="row-flex" style={{justifyContent:'space-between'}}>
          {boxDrawer !== 'new' ? <button className="btn btn-ghost btn-sm" style={{color:'var(--rust)'}} onClick={deleteBox} disabled={saving}>Delete</button> : <span/>}
          <div className="row-flex" style={{gap:8}}>
            <button className="btn btn-ghost btn-sm" onClick={()=>setBoxDrawer(null)}>Cancel</button>
            <button className="btn btn-rust btn-sm" onClick={saveBox} disabled={saving}>{saving?'Saving…':'Save'}</button>
          </div>
        </div>}>
        <BoxDrawer box={boxDraft} onChange={setBoxDraft} modelOptions={modelOptions} />
      </Drawer>
    </div>
  );
}

// ============================================================
// GROUPS
function newGroup() {
  return { name:'', description:'', slug:'', loc:'', meets:'', focus:'', badge:'tag-outline', host:false, joinType:'invite', price:'', members:[], access:{ forumCategories:[], tutorials:[], software:[] } };
}

function GroupAccessPicker({ label, options, selected, onChange, loading, emptyMessage }) {
  const toggle = (v) => onChange(selected.includes(v) ? selected.filter(x=>x!==v) : [...selected, v]);
  return (
    <div style={{marginBottom:16}}>
      <div className="label" style={{marginBottom:8}}>{label}</div>
      <div style={{display:'flex', flexWrap:'wrap', gap:6}}>
        {loading && <span className="mono" style={{fontSize:11, color:'var(--ink-3)'}}>Loading options…</span>}
        {!loading && options.length === 0 && <span className="mono" style={{fontSize:11, color:'var(--ink-3)'}}>{emptyMessage || 'No options available.'}</span>}
        {!loading && options.map(o => (
          <button key={o.id} type="button"
            className={`tag ${selected.includes(o.id)?'tag-rust':'tag-outline'}`}
            style={{cursor:'pointer', padding:'4px 10px', fontSize:12}}
            onClick={()=>toggle(o.id)}
          >{o.label}</button>
        ))}
      </div>
    </div>
  );
}

function AdminGroups() {
  const [rows, setRows] = useState([]);
  const [edit, setEdit] = useState(null);
  const [form, setForm] = useState(newGroup());
  const [accessOptions, setAccessOptions] = useState({ forumCategories: [], tutorials: [], software: [] });
  const [optionsLoading, setOptionsLoading] = useState(true);
  const [drawerTab, setDrawerTab] = useState('details');
  const [newMember, setNewMember] = useState('');
  const [membershipTiers, setMembershipTiers] = useState([]);
  const [portalUsers, setPortalUsers] = useState([]);
  const [memberDropdownOpen, setMemberDropdownOpen] = useState(false);

  useEffect(() => {
    fetch('/api/admin/groups', { credentials:'include' })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(d => setRows(d.items || []))
      .catch(() => setRows([]));
    fetch('/api/admin/memberships', { credentials:'include' })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(d => setMembershipTiers((d.tiers || []).filter(t => t.status === 'published')))
      .catch(() => {});
    fetch('/api/admin/portal-users', { credentials:'include' })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(d => setPortalUsers(d.items || []))
      .catch(() => setPortalUsers([]));
  }, []);

  useEffect(() => {
    let mounted = true;
    setOptionsLoading(true);
    Promise.all([
      fetch('/api/admin/tutorials/list', { credentials:'include' }).then(r => r.ok ? r.json() : Promise.reject()),
      fetch('/api/admin/software/list', { credentials:'include' }).then(r => r.ok ? r.json() : Promise.reject()),
    ])
      .then(([tutorialsData, softwareData]) => {
        if (!mounted) return;
        setAccessOptions({
          forumCategories: [],
          tutorials: tutorialsData.items || [],
          software: softwareData.items || [],
        });
      })
      .catch(() => {
        if (!mounted) return;
        setAccessOptions({ forumCategories: [], tutorials: [], software: [] });
      })
      .finally(() => { if (mounted) setOptionsLoading(false); });
    return () => { mounted = false; };
  }, []);

  const openEdit = (r) => { setEdit(r); setForm({ ...newGroup(), ...r, members: r.members||[], access: { forumCategories:[], tutorials:[], software:[], ...(r.access||{}) } }); setDrawerTab('details'); setNewMember(''); };
  const openNew  = () => { setEdit({}); setForm(newGroup()); setDrawerTab('details'); setNewMember(''); };

  const saveGroup = async () => {
    const payload = { ...form, slug: form.slug || form.name.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'') };
    const r = await fetch('/api/admin/groups/save', { method:'POST', headers:postHeaders(), credentials:'include', body: JSON.stringify(payload) }).catch(()=>null);
    if (r && r.ok) {
      const d = await r.json();
      if (!edit.id) setRows(rs => [...rs, d.item]);
      else setRows(rs => rs.map(row => row.id === edit.id ? d.item : row));
    }
    setEdit(null);
  };

  const deleteGroup = async () => {
    const r = await fetch('/api/admin/groups/delete', { method:'POST', headers:postHeaders(), credentials:'include', body: JSON.stringify({ id: edit.id }) }).catch(()=>null);
    if (!r || !r.ok) { adminToast('Failed to delete group.'); return; }
    setRows(rs => rs.filter(r => r.id !== edit.id));
    setEdit(null);
  };

  const addMember = (username) => {
    const name = (username ?? newMember).trim();
    if (!name || form.members.find(m=>m.username===name)) return;
    setForm(f => ({ ...f, members: [...f.members, { username: name, joinedAt: new Date().toISOString().slice(0,10) }] }));
    setNewMember('');
    setMemberDropdownOpen(false);
  };

  const removeMember = (username) => setForm(f => ({ ...f, members: f.members.filter(m=>m.username!==username) }));

  const memberMatches = useMemo(() => {
    const q = newMember.trim().toLowerCase();
    const existing = new Set(form.members.map(m => m.username));
    const pool = portalUsers.filter(u => !existing.has(u.username));
    if (!q) return pool.slice(0, 8);
    return pool.filter(u => (u.username||'').toLowerCase().includes(q) || (u.displayName||'').toLowerCase().includes(q) || (u.email||'').toLowerCase().includes(q)).slice(0, 8);
  }, [portalUsers, newMember, form.members]);

  const joinTypeTag = (t) => t==='subscription'?'tag-rust':t==='one-time'?'tag-ochre':'tag-outline';

  return (
    <div style={{padding:32}}>
      <div className="row-flex" style={{justifyContent:'space-between', marginBottom:18}}>
        <div className="mono" style={{fontSize:12, color:'var(--ink-2)'}}>{rows.length} GROUP{rows.length!==1?'S':''}</div>
        <button className="btn btn-rust btn-sm" onClick={openNew}>+ New group</button>
      </div>
      <Table
        columns={[
          { key:'name', label:'Group', w:'1.8fr', render:r => <span style={{fontWeight:600}}>{r.name}</span> },
          { key:'description', label:'Description', w:'2.5fr', render:r => <span style={{fontSize:13, color:'var(--ink-2)'}}>{r.description}</span> },
          { key:'joinType', label:'Join', w:'130px', render:r => <span className={`tag ${joinTypeTag(r.joinType)}`}>{(r.joinType||'invite').toUpperCase()}</span> },
          { key:'price', label:'Price', w:'90px', render:r => <span className="mono" style={{fontSize:12}}>{r.price||'-'}</span> },
          { key:'members', label:'Members', w:'90px', render:r => <span className="mono" style={{fontWeight:600}}>{(r.members||[]).length}</span> },
        ]}
        rows={rows}
        onRowClick={openEdit}
      />

      {edit !== null && (
        <Drawer open={true} onClose={() => setEdit(null)} title={edit.id ? form.name : 'New group'}
          footer={<div className="row-flex" style={{justifyContent:'space-between'}}>
            {edit.id
              ? <button className="btn btn-ghost btn-sm" style={{color:'var(--rust)'}} onClick={deleteGroup}>Delete group</button>
              : <span/>}
            <div className="row-flex" style={{gap:8}}>
              <button className="btn btn-ghost btn-sm" onClick={() => setEdit(null)}>Cancel</button>
              <button className="btn btn-sm" onClick={saveGroup}>Save</button>
            </div>
          </div>}
        >
          <div className="tabs" style={{marginBottom:20}}>
            {['details','members','access'].map(t => (
              <div key={t} role="button" tabIndex={0} className={`tab ${drawerTab===t?'active':''}`} onClick={()=>setDrawerTab(t)} onKeyDown={e => { if (e.key==='Enter'||e.key===' ') { e.preventDefault(); setDrawerTab(t); } }} style={{textTransform:'capitalize'}}>{t}</div>
            ))}
          </div>

          {drawerTab==='details' && (<>
            <label className="field"><span className="label">Group name</span><input className="input" value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></label>
            <label className="field"><span className="label">Description (internal)</span><textarea className="textarea" value={form.description} onChange={e=>setForm({...form,description:e.target.value})} style={{minHeight:60}}/></label>
            <label className="field"><span className="label">Public focus line</span><input className="input" placeholder="One-liner shown on the Groups page" value={form.focus} onChange={e=>setForm({...form,focus:e.target.value})}/></label>
            <label className="field"><span className="label">Location</span><input className="input" placeholder="e.g. Darwin, NT" value={form.loc} onChange={e=>setForm({...form,loc:e.target.value})}/></label>
            <label className="field"><span className="label">Meeting schedule</span><input className="input" placeholder="e.g. Fortnightly · Wed 6pm" value={form.meets} onChange={e=>setForm({...form,meets:e.target.value})}/></label>
            <label className="field"><span className="label">Badge colour</span>
              <select className="select" value={form.badge} onChange={e=>setForm({...form,badge:e.target.value})}>
                <option value="tag-outline">Default</option>
                <option value="tag-rust">Rust (red)</option>
                <option value="tag-ochre">Ochre (yellow)</option>
                <option value="tag-euc">Eucalyptus (green)</option>
                <option value="tag-ink">Ink (dark)</option>
              </select>
            </label>
            <label className="field" style={{flexDirection:'row', alignItems:'center', gap:10}}>
              <input type="checkbox" checked={!!form.host} onChange={e=>setForm({...form,host:e.target.checked})}/>
              <span className="label" style={{marginBottom:0}}>Hosted in-store</span>
            </label>
            <label className="field"><span className="label">Slug (URL)</span><input className="input mono" placeholder="auto-generated from name" value={form.slug} onChange={e=>setForm({...form,slug:e.target.value})}/></label>
            <label className="field"><span className="label">Join type</span>
              <select className="select" value={form.joinType} onChange={e=>setForm({...form,joinType:e.target.value})}>
                <option value="invite">Invite / admin-approved</option>
                <option value="subscription">Subscription (recurring)</option>
                <option value="one-time">One-time purchase</option>
              </select>
            </label>
            {(form.joinType==='subscription'||form.joinType==='one-time') && (
              <label className="field"><span className="label">Price</span><input className="input" placeholder={form.joinType==='subscription'?'e.g. $9/mo':'e.g. $49'} value={form.price} onChange={e=>setForm({...form,price:e.target.value})}/></label>
            )}
            <label className="field"><span className="label">Required membership</span>
              <select className="select" value={form.requiredTierId || ''} onChange={e=>setForm({...form, requiredTierId: e.target.value})}>
                <option value="">None (public)</option>
                {membershipTiers.map(t => (
                  <option key={t.id} value={t.id}>{t.name}+</option>
                ))}
              </select>
            </label>
          </>)}

          {drawerTab==='members' && (<>
            <div style={{position:'relative', marginBottom:16}}>
              <div className="row-flex" style={{gap:8}}>
                <input className="input" style={{flex:1}} placeholder="Search portal users by username, name, or email…" value={newMember}
                  onChange={e => { setNewMember(e.target.value); setMemberDropdownOpen(true); }}
                  onFocus={() => setMemberDropdownOpen(true)}
                  onBlur={() => setTimeout(() => setMemberDropdownOpen(false), 150)}
                  onKeyDown={e=>e.key==='Enter'&&addMember()}/>
                <button className="btn btn-ghost btn-sm" onClick={() => addMember()}>Add</button>
              </div>
              {memberDropdownOpen && (
                <div style={{position:'absolute', top:'100%', left:0, right:0, zIndex:20, background:'var(--bg)', border:'1px solid var(--line)', boxShadow:'0 4px 12px rgba(0,0,0,.12)', maxHeight:240, overflowY:'auto'}}>
                  {memberMatches.length === 0 && <div style={{padding:'8px 12px', fontSize:12, color:'var(--ink-3)'}}>{newMember.trim() ? 'No matching portal users, press Add to use this exact username.' : 'No portal users found.'}</div>}
                  {memberMatches.map(u => (
                    <div key={u.username} role="button" tabIndex={0} onMouseDown={e => { e.preventDefault(); addMember(u.username); }} style={{padding:'8px 12px', fontSize:13, cursor:'pointer'}}>
                      <div style={{fontWeight:600}}>{u.displayName}{u.displayName !== u.username ? <span style={{fontWeight:400, color:'var(--ink-3)'}}> ({u.username})</span> : ''}</div>
                      <div style={{fontSize:11, color:'var(--ink-3)'}}>{u.email || '-'}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {form.members.length === 0 && <p style={{fontSize:13, color:'var(--ink-3)'}}>No members yet.</p>}
            {form.members.map(m => (
              <div key={m.username} className="row-flex" style={{justifyContent:'space-between', padding:'8px 0', borderBottom:'1px solid var(--line)'}}>
                <span style={{fontWeight:500}}>{m.username}</span>
                <div className="row-flex" style={{gap:12}}>
                  <span className="mono" style={{fontSize:11, color:'var(--ink-3)'}}>{m.joinedAt}</span>
                  <button className="btn btn-ghost btn-sm" style={{color:'var(--rust)'}} onClick={()=>removeMember(m.username)}>Remove</button>
                </div>
              </div>
            ))}
          </>)}

          {drawerTab==='access' && (<>
            <p style={{fontSize:13, color:'var(--ink-2)', marginBottom:16}}>Members of this group can access the selected content.</p>
            <GroupAccessPicker label="Tutorials" options={accessOptions.tutorials} loading={optionsLoading} emptyMessage="No tutorials found." selected={form.access.tutorials} onChange={v=>setForm(f=>({...f,access:{...f.access,tutorials:v}}))}/>
            <GroupAccessPicker label="Software" options={accessOptions.software} loading={optionsLoading} emptyMessage="No software entries found." selected={form.access.software} onChange={v=>setForm(f=>({...f,access:{...f.access,software:v}}))}/>
          </>)}
        </Drawer>
      )}
    </div>
  );
}

// ============================================================
// CUSTOMERS
// ============================================================
function MergeCustomerModal({ customers, onClose, onMerged }) {
  const [aId, setAId] = useState('');
  const [bId, setBId] = useState('');
  const [choices, setChoices] = useState({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const a = customers.find(c => c.id === aId);
  const b = customers.find(c => c.id === bId);

  const FIELDS = [
    { key: 'name', label: 'Name' },
    { key: 'email', label: 'Email' },
    { key: 'phone', label: 'Phone' },
    { key: 'loc', label: 'Location' },
    { key: 'tags', label: 'Tags', render: v => (v||[]).join(', ') },
    { key: 'testimonial', label: 'Testimonial' },
  ];

  function pick(field, src) {
    setChoices(c => ({ ...c, [field]: src }));
  }

  async function doMerge() {
    if (!a || !b) return setError('Select two different customers.');
    if (aId === bId) return setError('Select two different customers.');
    setBusy(true); setError('');
    const merged = {};
    for (const f of FIELDS) {
      const src = choices[f.key] === 'b' ? b : a;
      merged[f.key] = src[f.key];
    }
    const r = await fetch('/api/admin/customers/merge', {
      method: 'POST', headers: postHeaders(), credentials: 'include',
      body: JSON.stringify({ keepId: aId, deleteId: bId, merged })
    }).catch(() => null);
    setBusy(false);
    if (r && r.ok) { const d = await r.json(); onMerged(d.item, bId); onClose(); }
    else setError('Merge failed.');
  }

  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center'}}>
      <div style={{background:'var(--paper)',borderRadius:12,padding:32,width:640,maxHeight:'80vh',overflowY:'auto',display:'grid',gap:20}}>
        <h3 style={{margin:0,fontFamily:'Instrument Serif, serif',fontWeight:400,fontSize:24}}>Merge customers</h3>
        {error && <div className="alert alert-error">{error}</div>}
        <div className="grid-2" style={{gap:16}}>
          <label className="field">
            <span className="label">Customer A (keep)</span>
            <select className="input" value={aId} onChange={e=>setAId(e.target.value)}>
              <option value="">select</option>
              {customers.map(c=><option key={c.id} value={c.id}>{c.name} {c.email ? `(${c.email})` : ''}</option>)}
            </select>
          </label>
          <label className="field">
            <span className="label">Customer B (merge into A)</span>
            <select className="input" value={bId} onChange={e=>setBId(e.target.value)}>
              <option value="">select</option>
              {customers.filter(c=>c.id!==aId).map(c=><option key={c.id} value={c.id}>{c.name} {c.email ? `(${c.email})` : ''}</option>)}
            </select>
          </label>
        </div>
        {a && b && (
          <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
            <thead>
              <tr>
                <th style={{textAlign:'left',padding:'6px 8px',color:'var(--ink-2)',fontWeight:600,fontSize:11}}>FIELD</th>
                <th style={{textAlign:'left',padding:'6px 8px',color:'var(--ink-2)',fontWeight:600,fontSize:11}}>A - {a.name}</th>
                <th style={{textAlign:'left',padding:'6px 8px',color:'var(--ink-2)',fontWeight:600,fontSize:11}}>B - {b.name}</th>
              </tr>
            </thead>
            <tbody>
              {FIELDS.map(f => {
                const av = f.render ? f.render(a[f.key]) : (a[f.key] || '');
                const bv = f.render ? f.render(b[f.key]) : (b[f.key] || '');
                const chosen = choices[f.key] || 'a';
                return (
                  <tr key={f.key} style={{borderTop:'1px solid var(--rule)'}}>
                    <td style={{padding:'8px',fontWeight:600,fontSize:12,color:'var(--ink-2)'}}>{f.label}</td>
                    <td style={{padding:'8px',cursor:'pointer',background:chosen==='a'?'var(--bg-deep)':'transparent',borderRadius:4}} onClick={()=>pick(f.key,'a')}>
                      <span style={{fontSize:12}}>{av || <em style={{color:'var(--ink-3)'}}>empty</em>}</span>
                      {chosen==='a' && <span style={{marginLeft:6,display:'inline-flex',alignItems:'center',gap:3,fontSize:10,color:'var(--rust)',fontWeight:700}}><Icon name="check" size={9} strokeWidth={3}/> KEEP</span>}
                    </td>
                    <td style={{padding:'8px',cursor:'pointer',background:chosen==='b'?'var(--bg-deep)':'transparent',borderRadius:4}} onClick={()=>pick(f.key,'b')}>
                      <span style={{fontSize:12}}>{bv || <em style={{color:'var(--ink-3)'}}>empty</em>}</span>
                      {chosen==='b' && <span style={{marginLeft:6,display:'inline-flex',alignItems:'center',gap:3,fontSize:10,color:'var(--rust)',fontWeight:700}}><Icon name="check" size={9} strokeWidth={3}/> KEEP</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        <div className="row-flex" style={{justifyContent:'flex-end',gap:8,marginTop:4}}>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>Cancel</button>
          <button className="btn btn-sm" style={{background:'var(--rust)',color:'#fff'}} disabled={!a||!b||busy} onClick={doMerge}>
            {busy ? 'Merging…' : <>Merge <Icon name="chevronRight" size={11}/></>}
          </button>
        </div>
      </div>
    </div>
  );
}

function CustomerLinkedJobs({ customerId, email, manualLinks, onLinksChange }) {
  const [jobs, setJobs] = useState(null);
  const [allJobs, setAllJobs] = useState([]);
  const [claimedByOther, setClaimedByOther] = useState(new Set());
  const [query, setQuery] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);

  useEffect(() => {
    if (!customerId) return;
    fetch(`/api/admin/customers/linked-jobs?id=${customerId}`, { credentials:'include' })
      .then(r => r.ok ? r.json() : Promise.reject()).then(d => setJobs(d)).catch(() => setJobs({ orders:[], repairs:[], quotes:[] }));
  }, [customerId]);

  useEffect(() => {
    // Load all orders, repairs (Kanban), quotes + customers to detect jobs claimed by others
    Promise.all([
      fetch('/api/admin/orders', { credentials:'include' }).then(r => r.ok ? r.json() : { items:[] }),
      fetch('/api/admin/repairs', { credentials:'include' }).then(r => r.ok ? r.json() : { columns:[] }),
      fetch('/api/admin/quotes', { credentials:'include' }).then(r => r.ok ? r.json() : { items:[] }),
      fetch('/api/admin/customers', { credentials:'include' }).then(r => r.ok ? r.json() : { items:[] }),
    ]).then(([od, rd, qd, cd]) => {
      function np(p) { return (p||'').replace(/[\s\-().+]/g, '').toLowerCase(); }
      const orders = (od.items || od.orders || []).map(o => ({ id: o.id, ref: o.ref || o.id, label: o.title || o.description || o.ref || o.id, _type: 'order', email: (o.email||'').toLowerCase().trim(), phone: np(o.phone||o.mobile||''), jobName: (o.name||o.customer||o.customerName||'').toLowerCase().trim() }));
      // Repairs are a Kanban board, flatten all cards from all columns
      const repairCards = (rd.columns || []).flatMap(col => (col.cards || []).map(c => ({ ...c, _colLabel: col.label || col.id })));
      const repairs = repairCards.map(r => ({ id: r.id, ref: r.id, label: r.service || r.customer || r.description || r.id, _type: 'repair', email: (r.email||'').toLowerCase().trim(), phone: np(r.phone||r.mobile||''), jobName: (r.cust||r.name||r.customer||r.customerName||'').toLowerCase().trim() }));
      const quotes = (qd.items || qd.quotes || []).map(q => ({ id: q.id, ref: q.ref || q.id, label: q.service || q.description || q.ref || q.id, _type: 'quote', email: (q.email||'').toLowerCase().trim(), phone: np(q.phone||q.mobile||''), jobName: (q.name||q.customer||q.customerName||'').toLowerCase().trim() }));
      setAllJobs([...orders, ...repairs, ...quotes]);

      // Build set of job IDs claimed by a DIFFERENT customer (email, phone, or name match).
      // Never exclude jobs that match THIS customer's own identifiers.
      const thisCustomer = (cd.items || []).find(c => c.id === customerId);
      const thisEmail = ((thisCustomer && thisCustomer.email) || email || '').toLowerCase().trim();
      const thisPhone = np((thisCustomer && thisCustomer.phone) || '');
      const thisName  = ((thisCustomer && thisCustomer.name) || '').toLowerCase().trim();
      const otherCustomers = (cd.items || []).filter(c => c.id !== customerId);
      const otherManual = new Set(otherCustomers.flatMap(c => c.manualLinks||[]));
      // Collect per-field sets for other customers, excluding values shared with this customer
      const otherEmails = new Set(otherCustomers.map(c => (c.email||'').toLowerCase().trim()).filter(e => e && e !== thisEmail));
      const otherPhones = new Set(otherCustomers.map(c => np(c.phone||'')).filter(p => p && p !== thisPhone));
      const otherNames  = new Set(otherCustomers.map(c => (c.name||'').toLowerCase().trim()).filter(n => n && n !== thisName));
      const claimed = new Set();
      for (const j of [...orders, ...repairs, ...quotes]) {
        if (otherManual.has(j.id)) { claimed.add(j.id); continue; }
        if (j.email && otherEmails.has(j.email)) { claimed.add(j.id); continue; }
        if (j.phone && otherPhones.has(j.phone))  { claimed.add(j.id); continue; }
        if (j.jobName && otherNames.has(j.jobName)) { claimed.add(j.id); continue; }
      }
      setClaimedByOther(claimed);
    }).catch(() => {});
  }, [customerId]);

  function addLink(id) {
    if (!id) return;
    if ((manualLinks||[]).includes(id)) return;
    onLinksChange([...(manualLinks||[]), id]);
    setQuery('');
    setDropdownOpen(false);
  }

  function removeLink(v) {
    onLinksChange((manualLinks||[]).filter(x => x !== v));
  }

  if (!customerId) return null;

  const linkedIds = new Set([
    ...(jobs ? [...(jobs.orders||[]), ...(jobs.repairs||[]), ...(jobs.quotes||[])].map(j => j.id) : []),
    ...(manualLinks||[]),
  ]);

  const autoLinked = jobs ? [...(jobs.orders||[]), ...(jobs.repairs||[]), ...(jobs.quotes||[])] : [];
  const typeLabel = { order:'ORDER', repair:'REPAIR', quote:'QUOTE' };

  // Jobs available to manually link (not already auto-matched by email, not claimed by another customer)
  const autoIds = new Set(autoLinked.map(j => j.id));
  const available = allJobs.filter(j => !autoIds.has(j.id) && !(manualLinks||[]).includes(j.id) && !claimedByOther.has(j.id));
  const jobMatches = useMemo(() => {
    const q = query.trim().toLowerCase();
    const pool = !q ? available : available.filter(j => (j.ref||j.id||'').toLowerCase().includes(q) || (j.label||'').toLowerCase().includes(q));
    return pool.slice(0, 8);
  }, [available, query]);

  return (
    <div style={{marginTop:16}}>
      <div style={{fontWeight:700,fontSize:12,color:'var(--ink-2)',letterSpacing:'0.08em',marginBottom:10}}>LINKED JOBS</div>
      {!jobs && <div style={{fontSize:13,color:'var(--ink-3)'}}>Loading…</div>}
      {jobs && autoLinked.length === 0 && (manualLinks||[]).length === 0 && (
        <div style={{fontSize:13,color:'var(--ink-3)',marginBottom:10}}>No jobs linked yet.</div>
      )}
      {autoLinked.length > 0 && (
        <div style={{display:'grid',gap:5,marginBottom:10}}>
          {autoLinked.map(j => (
            <div key={j.id} style={{display:'flex',alignItems:'center',gap:8,padding:'6px 10px',background:'var(--bg-deep)',borderRadius:6,fontSize:13}}>
              <span style={{fontWeight:600,fontFamily:'monospace',fontSize:12}}>{j.ref || j.id}</span>
              <span style={{color:'var(--ink-2)',flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{j.title || j.service || j.label || ''}</span>
              <span style={{fontSize:10,color:'var(--ink-3)',fontWeight:600,letterSpacing:'0.05em'}}>{typeLabel[j._type] || j._type?.toUpperCase()}</span>
            </div>
          ))}
        </div>
      )}
      {(manualLinks||[]).length > 0 && (
        <div style={{display:'grid',gap:5,marginBottom:10}}>
          {(manualLinks||[]).map(v => {
            const job = allJobs.find(j => j.id === v);
            return (
              <div key={v} style={{display:'flex',alignItems:'center',gap:8,padding:'6px 10px',background:'#fff8f0',border:'1px solid var(--rule)',borderRadius:6,fontSize:13}}>
                <span style={{fontWeight:600,fontFamily:'monospace',fontSize:12}}>{job ? (job.ref || job.id) : v}</span>
                <span style={{color:'var(--ink-2)',flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{job ? job.label : ''}</span>
                <span style={{fontSize:10,color:'var(--rust)',fontWeight:600,letterSpacing:'0.05em'}}>MANUAL</span>
                <button onClick={() => removeLink(v)} style={{background:'none',border:'none',cursor:'pointer',color:'var(--ink-3)',fontSize:16,lineHeight:1,padding:0}}>×</button>
              </div>
            );
          })}
        </div>
      )}
      <div style={{position:'relative'}}>
        <input className="input" style={{fontSize:13}} placeholder="Search by order/repair/quote # or description…" value={query}
          onChange={e => { setQuery(e.target.value); setDropdownOpen(true); }}
          onFocus={() => setDropdownOpen(true)}
          onBlur={() => setTimeout(() => setDropdownOpen(false), 150)}
        />
        {dropdownOpen && (
          <div style={{position:'absolute', top:'100%', left:0, right:0, zIndex:20, background:'var(--bg)', border:'1px solid var(--line)', boxShadow:'0 4px 12px rgba(0,0,0,.12)', maxHeight:240, overflowY:'auto'}}>
            {jobMatches.length === 0 && <div style={{padding:'8px 12px', fontSize:12, color:'var(--ink-3)'}}>No matching jobs.</div>}
            {jobMatches.map(j => (
              <div key={j.id} role="button" tabIndex={0} onMouseDown={e => { e.preventDefault(); addLink(j.id); }}
                style={{display:'flex', alignItems:'center', gap:8, padding:'8px 12px', fontSize:13, cursor:'pointer'}}>
                <span style={{fontWeight:600, fontFamily:'monospace', fontSize:12}}>{j.ref || j.id}</span>
                <span style={{color:'var(--ink-2)', flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{j.label && j.label !== j.ref ? j.label : ''}</span>
                <span style={{fontSize:10, color:'var(--ink-3)', fontWeight:600, letterSpacing:'0.05em'}}>{typeLabel[j._type] || j._type?.toUpperCase()}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function AdminCustomers() {
  const [rows, setRows] = useState([]);
  const [edit, setEdit] = useState(null);
  const [form, setForm] = useState({});
  const [mergeOpen, setMergeOpen] = useState(false);
  const [openId, setOpenId] = useUrlState('open', null, { push: true });
  useEffect(() => {
    fetch('/api/admin/customers', { credentials:'include' })
      .then(r => r.ok ? r.json() : Promise.reject()).then(d => setRows(d.items || [])).catch(() => setRows([]));
  }, []);
  const openCustomer = (r) => setOpenId(r.id);

  // Reconcile the open customer editor with the URL's `open` param (restore on
  // reload + Back/Forward), same as Orders/Quotes/Repairs/Expenses/Products/HDD Reports.
  useEffect(() => {
    const cur = edit === null ? null : (edit.id || 'new');
    if (openId === cur) return;
    if (openId == null) { setEdit(null); return; }
    if (openId === 'new') { setEdit({}); setForm({ name:'', loc:'', email:'', phone:'', tagsStr:'' }); return; }
    const r = rows.find(x => x.id === openId);
    if (r) { setEdit(r); setForm({...r, tagsStr: (r.tags||[]).join(', ')}); }
  }, [openId, rows]);

  const now = new Date();
  const msPerDay = 86400000;
  const parseIso = s => { if (!s) return null; const d = new Date(s + 'T00:00:00'); return isNaN(d) ? null : d; };
  const active90     = rows.filter(r => { const d = parseIso(r.last); return d && (now - d) < 90 * msPerDay; }).length;
  const newThisMonth = rows.filter(r => { const d = parseIso(r.last); return d && d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth(); }).length;
  const repeatRate   = rows.length ? Math.round(rows.filter(r => (r.orders||0) > 1).length / rows.length * 100) : 0;
  const totalOrders  = rows.reduce((s, r) => s + (r.orders||0), 0);
  const totalSpent   = rows.reduce((s, r) => s + (r.spent||0), 0);
  const avgOrder     = totalOrders ? (totalSpent / totalOrders) : 0;
  const fmtAUD = n => `$${n.toLocaleString('en-AU', {minimumFractionDigits:2, maximumFractionDigits:2})}`;

  if (edit !== null) {
    return (
      <OrderPage onClose={() => setOpenId(null)} backLabel="Back to Customers" title={edit.name || 'New customer'}
        footer={<div className="row-flex" style={{justifyContent:'space-between'}}>
          {edit.id && <button className="btn btn-ghost btn-sm" style={{color:'var(--rust)'}} onClick={async () => {
            if (!(await adminConfirm('Delete this customer?', { title:'Delete customer', confirmLabel:'Delete', danger:true }))) return;
            const r = await fetch('/api/admin/customers/delete', { method:'POST', headers:postHeaders(), credentials:'include', body: JSON.stringify({ id: edit.id }) }).catch(()=>null);
            if (!r || !r.ok) { adminToast('Failed to delete customer.'); return; }
            setRows(rs => rs.filter(r => r.id !== edit.id));
            setOpenId(null);
          }}>Delete</button>}
          {!edit.id && <span/>}
          <div className="row-flex" style={{gap:8}}>
            <button className="btn btn-ghost btn-sm" onClick={() => setOpenId(null)}>Cancel</button>
            <button className="btn btn-sm" onClick={async () => {
              const item = { ...form, tags: (form.tagsStr||'').split(',').map(t=>t.trim()).filter(Boolean) };
              delete item.tagsStr;
              const r = await fetch('/api/admin/customers/save', { method:'POST', headers:postHeaders(), credentials:'include', body: JSON.stringify(item) }).catch(()=>null);
              if (r && r.ok) {
                const d = await r.json();
                if (!edit.id) setRows(rs => [...rs, d.item]);
                else setRows(rs => rs.map(row => row.id === edit.id ? d.item : row));
              } else {
                if (!edit.id) setRows(rs => [...rs, item]);
                else setRows(rs => rs.map(row => row.id === edit.id ? item : row));
              }
              setOpenId(null);
            }}>Save</button>
          </div>
        </div>}
      >
        <label className="field"><span className="label">Name</span><input className="input" value={form.name||''} onChange={e=>setForm({...form,name:e.target.value})}/></label>
        <label className="field"><span className="label">Location</span><input className="input" value={form.loc||''} onChange={e=>setForm({...form,loc:e.target.value})}/></label>
        <label className="field"><span className="label">Email</span><input className="input" type="email" value={form.email||''} onChange={e=>setForm({...form,email:e.target.value})}/></label>
        <label className="field"><span className="label">Phone</span><input className="input" type="tel" value={form.phone||''} onChange={e=>setForm({...form,phone:e.target.value})}/></label>
        <label className="field"><span className="label">Tags (comma-separated)</span><input className="input" value={form.tagsStr||''} onChange={e=>setForm({...form,tagsStr:e.target.value})}/></label>

        <label className="field"><span className="label">Testimonial quote</span><textarea className="input" rows={3} style={{resize:'vertical'}} value={form.testimonial||''} onChange={e=>setForm({...form,testimonial:e.target.value})} placeholder="In their own words…"/></label>
        <label className="field" style={{flexDirection:'row', alignItems:'center', gap:10, cursor:'pointer'}}>
          <input type="checkbox" checked={!!form.testimonialFeatured} onChange={e=>setForm({...form,testimonialFeatured:e.target.checked})}/>
          <span className="label" style={{marginBottom:0}}>Feature on shop page</span>
        </label>
        <CustomerLinkedJobs
          customerId={edit.id}
          email={form.email}
          manualLinks={form.manualLinks}
          onLinksChange={links => setForm(f => ({ ...f, manualLinks: links }))}
        />
      </OrderPage>
    );
  }

  return (
    <div style={{padding:32, display:'grid', gap:24}}>
      <div className="grid-4">
        <StatTile label="ACTIVE CUSTOMERS · 90D" value={rows.length ? active90 : '-'} />
        <StatTile label="NEW THIS MONTH" value={rows.length ? newThisMonth : '-'} />
        <StatTile label="REPEAT RATE" value={rows.length ? `${repeatRate}%` : '-'} />
        <StatTile label="AVG ORDER VALUE" value={rows.length ? fmtAUD(avgOrder) : '-'} />
      </div>
      <div className="row-flex" style={{justifyContent:'flex-end', gap:8, marginBottom:-8}}>
        <button className="btn btn-ghost btn-sm" onClick={async () => {
          await fetch('/api/admin/customers/backfill', { method:'POST', headers:postHeaders(), credentials:'include' });
          // Reload rows with fresh computed stats
          const d = await fetch('/api/admin/customers', { credentials:'include' }).then(r=>r.ok?r.json():{items:[]});
          setRows(d.items||[]);
        }}>Re-link all jobs</button>
        <button className="btn btn-ghost btn-sm" onClick={() => setMergeOpen(true)}>Merge duplicates</button>
        <button className="btn btn-rust btn-sm" onClick={() => setOpenId('new')}>+ New customer</button>
      </div>
      <Table
        columns={[
          { key:'name', label:'Customer', w:'1.5fr', render:r => <span style={{fontWeight:600}}>{r.name}</span> },
          { key:'loc', label:'Location', w:'1.2fr' },
          { key:'orders', label:'Orders', w:'80px', render:r => <span className="mono">{r.orders}</span> },
          { key:'spent', label:'Lifetime', w:'120px', render:r => <span className="mono" style={{fontWeight:600}}>${(r.spent||0).toLocaleString()}</span> },
          { key:'last', label:'Last order', w:'110px', render:r => <span className="mono" style={{fontSize:11, color:'var(--ink-2)'}}>{(r.last||'').toUpperCase()}</span> },
          { key:'tags', label:'Tags', w:'1.5fr', render:r => <div className="row-flex" style={{gap:4}}>{(r.tags||[]).map(t => <span key={t} className="tag tag-outline">{t.toUpperCase()}</span>)}</div> },
        ]}
        rows={rows}
        onRowClick={(r) => openCustomer(r)}
      />
      {mergeOpen && (
        <MergeCustomerModal
          customers={rows}
          onClose={() => setMergeOpen(false)}
          onMerged={(updated, deletedId) => {
            setRows(rs => rs.filter(r => r.id !== deletedId).map(r => r.id === updated.id ? updated : r));
          }}
        />
      )}
    </div>
  );
}

// ============================================================
// SELLERS
// ============================================================
function AdminSellers() {
  const [rows, setRows] = useState([]);
  const [edit, setEdit] = useState(null);
  const [form, setForm] = useState({});
  const [payoutsOpen, setPayoutsOpen] = useState(false);
  const [payoutsBusy, setPayoutsBusy] = useState(false);
  const [payoutsDone, setPayoutsDone] = useState(false);
  useEffect(() => {
    fetch('/api/admin/sellers', { credentials:'include' })
      .then(r => r.ok ? r.json() : Promise.reject()).then(d => setRows(d.items || [])).catch(() => setRows([]));
  }, []);
  const map = { Live:{bg:'#d8e7d0', fg:'#345526'}, Sold:{bg:'var(--ink)', fg:'var(--paper)'}, Bench:{bg:'#fff4d6', fg:'#7a5d10'}, Recycle:{bg:'var(--bg-deep)', fg:'var(--ink-2)'} };
  const openSeller = (r) => { setEdit(r); setForm({...r}); };
  // Sellers repeat constantly across listings but have no separate record of
  // their own, a free-text field silently fragments payout totals on typos,
  // so suggest every seller name already on file instead of typing blind.
  const sellerOptions = useMemo(() => [...new Set(rows.map(r => r.seller).filter(Boolean))].sort(), [rows]);
  const soldRows = rows.filter(r => r.status === 'Sold');
  const totalPayout = soldRows.reduce((s, r) => {
    const n = parseFloat((r.payout || '').replace(/[^0-9.]/g, ''));
    return s + (isNaN(n) ? 0 : n);
  }, 0);
  const doPayouts = async () => {
    setPayoutsBusy(true);
    const r = await fetch('/api/admin/sellers/process-payouts', { method:'POST', headers:postHeaders(), credentials:'include', body: JSON.stringify({ ids: soldRows.map(r => r.id) }) }).catch(()=>null);
    setPayoutsBusy(false);
    if (!r || !r.ok) { adminToast('Payout processing failed, please try again.'); return; }
    setPayoutsDone(true);
  };
  return (
    <div style={{padding:32}}>
      {payoutsOpen && (
        <Drawer open={true} onClose={() => { setPayoutsOpen(false); setPayoutsDone(false); }} title="Process payouts"
          footer={!payoutsDone && <div className="row-flex" style={{gap:8, justifyContent:'flex-end'}}>
            <button className="btn btn-ghost btn-sm" onClick={() => setPayoutsOpen(false)}>Cancel</button>
            <button className="btn btn-rust btn-sm" onClick={doPayouts} disabled={payoutsBusy || soldRows.length === 0}>{payoutsBusy ? 'Processing…' : `Pay out ${soldRows.length} seller${soldRows.length !== 1 ? 's' : ''}`}</button>
          </div>}>
          {payoutsDone ? (
            <div>
              <div className="mono" style={{display:'flex', alignItems:'center', gap:5, fontSize:12, color:'var(--eucalyptus)', marginBottom:8}}><Icon name="check" size={11} strokeWidth={3}/> PAYOUTS QUEUED</div>
              <p style={{fontSize:13, color:'var(--ink-2)'}}>EFTs for {soldRows.length} seller{soldRows.length !== 1 ? 's' : ''} have been queued. They will appear in bank statements within 1–2 business days.</p>
            </div>
          ) : soldRows.length === 0 ? (
            <p style={{fontSize:13, color:'var(--ink-2)'}}>No sold consignments awaiting payout.</p>
          ) : (
            <>
              <div className="mono" style={{fontSize:11, color:'var(--ink-2)', marginBottom:12}}>{soldRows.length} SOLD LISTINGS · TOTAL ${totalPayout.toLocaleString()}</div>
              {soldRows.map((r,i) => (
                <div key={i} style={{display:'flex', justifyContent:'space-between', padding:'10px 0', borderBottom:'1px solid var(--line)', fontSize:13}}>
                  <span>{r.seller} · {r.item}</span>
                  <span className="mono" style={{fontWeight:600}}>{r.payout}</span>
                </div>
              ))}
            </>
          )}
        </Drawer>
      )}
      <div className="row-flex" style={{justifyContent:'space-between', marginBottom:18}}>
        <div className="mono" style={{fontSize:12, color:'var(--ink-2)'}}>{rows.length} CONSIGNMENT LISTINGS</div>
        <div className="row-flex" style={{gap:8}}>
          <button className="btn btn-ghost btn-sm" onClick={() => { setPayoutsDone(false); setPayoutsOpen(true); }}>Process payouts</button>
          <button className="btn btn-rust btn-sm" onClick={() => { setEdit({}); setForm({ seller:'', item:'', tier:'A', listed:0, payout:'', status:'Live' }); }}>+ Log intake</button>
        </div>
      </div>
      <Table
        columns={[
          { key:'id', label:'#', w:'130px', render:r => <span className="mono" style={{fontSize:11, color:'var(--rust)'}}>{r.id}</span> },
          { key:'seller', label:'Seller', w:'1.2fr' },
          { key:'item', label:'Item', w:'2fr', render:r => <span style={{fontWeight:500}}>{r.item}</span> },
          { key:'tier', label:'Tier', w:'70px', render:r => <span className="tag tag-outline">{r.tier}</span> },
          { key:'listed', label:'Listed', w:'100px', render:r => <span className="mono" style={{fontWeight:600}}>${(r.listed||0).toLocaleString()}</span> },
          { key:'payout', label:'Payout terms', w:'1.4fr', render:r => <span style={{fontSize:13}}>{r.payout}</span> },
          { key:'status', label:'Status', w:'110px', render:r => <StatusPill value={r.status} map={map}/> },
        ]}
        rows={rows}
        onRowClick={(r) => openSeller(r)}
      />
      {edit !== null && (
        <Drawer open={true} onClose={() => setEdit(null)} title={edit.id ? `Consignment ${edit.id}` : 'New consignment'}
          footer={<div className="row-flex" style={{justifyContent:'space-between'}}>
            {edit.id && <button className="btn btn-ghost btn-sm" style={{color:'var(--rust)'}} onClick={async () => {
              const r = await fetch('/api/admin/sellers/delete', { method:'POST', headers:postHeaders(), credentials:'include', body: JSON.stringify({ id: edit.id }) }).catch(()=>null);
              if (!r || !r.ok) { adminToast('Failed to delete consignment.'); return; }
              setRows(rs => rs.filter(r => r.id !== edit.id));
              setEdit(null);
            }}>Delete</button>}
            {!edit.id && <span/>}
            <div className="row-flex" style={{gap:8}}>
              <button className="btn btn-ghost btn-sm" onClick={() => setEdit(null)}>Cancel</button>
              <button className="btn btn-sm" onClick={async () => {
                const r = await fetch('/api/admin/sellers/save', { method:'POST', headers:postHeaders(), credentials:'include', body: JSON.stringify(form) }).catch(()=>null);
                if (r && r.ok) {
                  const d = await r.json();
                  if (!edit.id) setRows(rs => [...rs, d.item]);
                  else setRows(rs => rs.map(row => row.id === edit.id ? d.item : row));
                } else {
                  alert('Failed to save consignment.');
                }
                setEdit(null);
              }}>Save</button>
            </div>
          </div>}
        >
          <label className="field"><span className="label">Seller</span>
            <input className="input" list="consignment-seller-options" value={form.seller||''} onChange={e=>setForm({...form,seller:e.target.value})}/>
            <datalist id="consignment-seller-options">
              {sellerOptions.map(s => <option key={s} value={s}/>)}
            </datalist>
          </label>
          <label className="field"><span className="label">Item</span><input className="input" value={form.item||''} onChange={e=>setForm({...form,item:e.target.value})}/></label>
          <label className="field"><span className="label">Tier</span>
            <select className="select" value={form.tier||'A'} onChange={e=>setForm({...form,tier:e.target.value})}>
              {['A','B','C','D'].map(t => <option key={t}>{t}</option>)}
            </select>
          </label>
          <label className="field"><span className="label">Listed price (AUD)</span><input className="input" type="number" value={form.listed||0} onChange={e=>setForm({...form,listed:Number(e.target.value)})}/></label>
          <label className="field"><span className="label">Payout terms</span><input className="input" value={form.payout||''} onChange={e=>setForm({...form,payout:e.target.value})}/></label>
          <label className="field"><span className="label">Status</span>
            <select className="select" value={form.status||'Live'} onChange={e=>setForm({...form,status:e.target.value})}>
              {['Live','Sold','Bench','Recycle'].map(s => <option key={s}>{s}</option>)}
            </select>
          </label>
        </Drawer>
      )}
    </div>
  );
}

// ============================================================
// GIFT CARDS
// ============================================================
function AdminGiftCards() {
  const [mainTab, setMainTab] = useState('issued'); // 'issued' | 'denominations'
  const [rows, setRows] = useState([]);
  const [issueForm, setIssueForm] = useState({ balance: '', recipientEmail: '', note: '' });
  const [issueError, setIssueError] = useState(null);
  const [issuing, setIssuing] = useState(false);
  const [filter, setFilter] = useState('all');

  // Denominations state
  const [denoms, setDenoms] = useState([]);
  const [denomEdit, setDenomEdit] = useState(null); // null | {} | existing row
  const [denomForm, setDenomForm] = useState({});
  const [denomSaving, setDenomSaving] = useState(false);
  const [denomError, setDenomError] = useState(null);

  const load = () => fetch('/api/admin/gift-cards', { credentials: 'include' })
    .then(r => r.json()).then(d => setRows(d.items || [])).catch(() => {});

  const loadDenoms = () => fetch('/api/admin/gift-cards/denominations', { credentials: 'include' })
    .then(r => r.json()).then(d => setDenoms(d.items || [])).catch(() => {});

  useEffect(() => { load(); loadDenoms(); }, []);

  const openNewDenom = () => { setDenomEdit({}); setDenomForm({ name: '', priceAud: '', description: '', status: 'draft' }); setDenomError(null); };
  const openEditDenom = (d) => { setDenomEdit(d); setDenomForm({ ...d }); setDenomError(null); };
  const cancelDenom = () => { setDenomEdit(null); setDenomError(null); };

  const saveDenom = async () => {
    if (!denomForm.name || !denomForm.name.trim()) { setDenomError('Name is required.'); return; }
    const price = Number(denomForm.priceAud);
    if (!price || price <= 0) { setDenomError('Enter a valid price.'); return; }
    setDenomSaving(true);
    setDenomError(null);
    const resp = await fetch('/api/admin/gift-cards/denominations/save', { method: 'POST', headers: postHeaders(), credentials: 'include', body: JSON.stringify(denomForm) }).catch(() => null);
    setDenomSaving(false);
    if (resp && resp.ok) {
      const data = await resp.json();
      if (denomForm.id) setDenoms(ds => ds.map(d => d.id === denomForm.id ? data.item : d));
      else setDenoms(ds => [...ds, data.item]);
      setDenomEdit(null);
    } else {
      setDenomError('Failed to save denomination.');
    }
  };

  const deleteDenom = async (id) => {
    if (!(await adminConfirm('Delete this denomination?', { title:'Delete denomination', confirmLabel:'Delete', danger:true }))) return;
    await fetch('/api/admin/gift-cards/denominations/delete', { method: 'POST', headers: postHeaders(), credentials: 'include', body: JSON.stringify({ id }) }).catch(() => null);
    setDenoms(ds => ds.filter(d => d.id !== id));
    if (denomEdit && denomEdit.id === id) setDenomEdit(null);
  };

  const voidCard = async (code) => {
    if (!(await adminConfirm(`Void gift card ${code}? This cannot be undone.`, { title:'Void gift card', confirmLabel:'Void', danger:true }))) return;
    await fetch('/api/admin/gift-cards/void', { method: 'POST', headers: postHeaders(), credentials: 'include', body: JSON.stringify({ code }) });
    load();
  };

  const issue = async () => {
    const balance = Number(issueForm.balance);
    if (!balance || balance <= 0) { setIssueError('Enter a valid amount.'); return; }
    setIssuing(true);
    setIssueError(null);
    await ensureCsrf();
    const resp = await fetch('/api/admin/gift-cards/issue', { method: 'POST', headers: postHeaders(), credentials: 'include', body: JSON.stringify(issueForm) });
    const data = await resp.json().catch(() => ({}));
    setIssuing(false);
    if (data.ok) { setIssueForm({ balance: '', recipientEmail: '', note: '' }); load(); }
    else setIssueError(data.message || `Failed to issue gift card. (${resp.status} ${data.error || ''})`);
  };

  const filtered = filter === 'all' ? rows
    : filter === 'active' ? rows.filter(r => !r.isVoid && r.balance > 0)
    : filter === 'used' ? rows.filter(r => !r.isVoid && r.balance === 0)
    : rows.filter(r => r.isVoid);

  return (
    <div style={{padding:32}}>
      <div className="tabs" style={{marginBottom:24}}>
        <div role="button" tabIndex={0} className={`tab ${mainTab==='issued'?'active':''}`} onClick={() => setMainTab('issued')} onKeyDown={e => { if (e.key==='Enter'||e.key===' ') { e.preventDefault(); setMainTab('issued'); } }}>Issued Cards ({rows.length})</div>
        <div role="button" tabIndex={0} className={`tab ${mainTab==='denominations'?'active':''}`} onClick={() => setMainTab('denominations')} onKeyDown={e => { if (e.key==='Enter'||e.key===' ') { e.preventDefault(); setMainTab('denominations'); } }}>Denominations ({denoms.length})</div>
      </div>

      {mainTab === 'issued' && (
        <div className="admin-split" style={{display:'grid', gridTemplateColumns:'1fr 320px', gap:32, alignItems:'start'}}>
          <div>
            <div className="tabs" style={{marginBottom:18}}>
              {[['all','All'], ['active','Active'], ['used','Used up'], ['void','Voided']].map(([v,l]) => (
                <div key={v} role="button" tabIndex={0} className={`tab ${filter===v?'active':''}`} onClick={() => setFilter(v)} onKeyDown={e => { if (e.key==='Enter'||e.key===' ') { e.preventDefault(); setFilter(v); } }}>{l} ({(v==='all'?rows:rows.filter(r=>v==='active'?!r.isVoid&&r.balance>0:v==='used'?!r.isVoid&&r.balance===0:r.isVoid)).length})</div>
              ))}
            </div>
            <Table
              columns={[
                { key:'code', label:'Code', w:'200px', render: r => <span className="mono" style={{fontSize:12, color:'var(--rust)'}}>{r.code}</span> },
                { key:'balance', label:'Balance', w:'110px', render: r => (
                  <span className="mono" style={{fontWeight:600, color: r.isVoid ? 'var(--ink-3)' : r.balance===0 ? 'var(--ink-3)' : 'var(--ink)'}}>
                    ${Number(r.balance).toFixed(2)} <span style={{fontWeight:400, fontSize:11, color:'var(--ink-3)'}}>/ ${Number(r.originalBalance).toFixed(2)}</span>
                  </span>
                )},
                { key:'status', label:'Status', w:'100px', render: r => (
                  <span className={`tag ${r.isVoid ? 'tag-outline' : r.balance===0 ? 'tag-outline' : 'tag-euc'}`}>
                    {r.isVoid ? 'VOIDED' : r.balance === 0 ? 'USED' : 'ACTIVE'}
                  </span>
                )},
                { key:'recipientEmail', label:'Recipient', w:'1fr', render: r => <span style={{fontSize:12, color:'var(--ink-2)'}}>{r.recipientEmail || '-'}</span> },
                { key:'orderId', label:'Order', w:'160px', render: r => <span className="mono" style={{fontSize:11, color:'var(--ink-3)'}}>{r.orderId || '-'}</span> },
                { key:'issuedAt', label:'Issued', w:'110px', render: r => <span style={{fontSize:12}}>{r.issuedAt ? new Date(r.issuedAt).toLocaleDateString('en-AU') : '-'}</span> },
                { key:'actions', label:'', w:'80px', render: r => !r.isVoid && (
                  <button className="btn btn-ghost btn-sm" style={{color:'var(--rust)', fontSize:11}} onClick={() => voidCard(r.code)}>Void</button>
                )},
              ]}
              rows={filtered}
            />
          </div>

          <div style={{position:'sticky', top:24}}>
            <div className="card-paper" style={{padding:24}}>
              <div className="eyebrow" style={{marginBottom:14}}>ISSUE GIFT CARD</div>
              <label className="field" style={{marginBottom:10}}>
                <span className="label">Amount (AUD)</span>
                <input className="input" type="number" min="1" placeholder="50" value={issueForm.balance} onChange={e => setIssueForm(f => ({...f, balance: e.target.value}))} />
              </label>
              <label className="field" style={{marginBottom:10}}>
                <span className="label">Recipient email (optional)</span>
                <input className="input" type="email" placeholder="customer@example.com" value={issueForm.recipientEmail} onChange={e => setIssueForm(f => ({...f, recipientEmail: e.target.value}))} />
              </label>
              <label className="field" style={{marginBottom:14}}>
                <span className="label">Note / reference (optional)</span>
                <input className="input" placeholder="Refund, promo, etc." value={issueForm.note} onChange={e => setIssueForm(f => ({...f, note: e.target.value}))} />
              </label>
              {issueError && <div style={{marginBottom:10, fontSize:12, color:'var(--rust)'}}>{issueError}</div>}
              <button className="btn btn-rust btn-sm" style={{width:'100%', justifyContent:'center'}} onClick={issue} disabled={issuing}>
                {issuing ? 'Issuing…' : 'Issue Gift Card'}
              </button>
            </div>
          </div>
        </div>
      )}

      {mainTab === 'denominations' && (
        <div className="admin-split" style={{display:'grid', gridTemplateColumns:'1fr 360px', gap:32, alignItems:'start'}}>
          <div>
            <div className="row-flex" style={{justifyContent:'flex-end', marginBottom:14}}>
              <button className="btn btn-rust btn-sm" onClick={openNewDenom}>+ New Denomination</button>
            </div>
            <Table
              columns={[
                { key:'name', label:'Name', w:'2fr', render: r => <span style={{fontWeight:600}}>{r.name}</span> },
                { key:'priceAud', label:'Price (AUD)', w:'120px', render: r => <span className="mono" style={{fontWeight:600}}>${Number(r.priceAud).toFixed(2)}</span> },
                { key:'description', label:'Description', w:'2fr', render: r => <span style={{fontSize:12, color:'var(--ink-2)'}}>{r.description || '-'}</span> },
                { key:'status', label:'Status', w:'110px', render: r => (
                  <span className={`tag ${r.status === 'published' ? 'tag-euc' : 'tag-outline'}`}>
                    {r.status === 'published' ? 'PUBLISHED' : 'DRAFT'}
                  </span>
                )},
                { key:'actions', label:'', w:'130px', render: r => (
                  <div className="row-flex" style={{gap:6}}>
                    <button className="btn btn-ghost btn-sm" style={{fontSize:11}} onClick={() => openEditDenom(r)}>Edit</button>
                    <button className="btn btn-ghost btn-sm" style={{color:'var(--rust)', fontSize:11}} onClick={() => deleteDenom(r.id)}>Delete</button>
                  </div>
                )},
              ]}
              rows={denoms}
            />
            {denoms.length === 0 && <div style={{padding:24, background:'var(--paper)', border:'1px solid var(--line)', fontSize:13, color:'var(--ink-2)', textAlign:'center'}}>No denominations yet. Add one to make gift cards available in the shop.</div>}
          </div>

          <div style={{position:'sticky', top:24}}>
            {denomEdit !== null ? (
              <div className="card-paper" style={{padding:24}}>
                <div className="eyebrow" style={{marginBottom:14}}>{denomForm.id ? 'EDIT DENOMINATION' : 'NEW DENOMINATION'}</div>
                <label className="field" style={{marginBottom:10}}>
                  <span className="label">Name</span>
                  <input className="input" placeholder="$25 Gift Card" value={denomForm.name || ''} onChange={e => setDenomForm(f => ({...f, name: e.target.value}))} />
                </label>
                <label className="field" style={{marginBottom:10}}>
                  <span className="label">Price AUD</span>
                  <input className="input" type="number" min="1" placeholder="25" value={denomForm.priceAud || ''} onChange={e => setDenomForm(f => ({...f, priceAud: e.target.value}))} />
                </label>
                <label className="field" style={{marginBottom:10}}>
                  <span className="label">Description (optional)</span>
                  <input className="input" placeholder="e.g. Perfect for small purchases" value={denomForm.description || ''} onChange={e => setDenomForm(f => ({...f, description: e.target.value}))} />
                </label>
                <label className="field" style={{marginBottom:10}}>
                  <span className="label">Image URL (optional)</span>
                  <input className="input" placeholder="/uploads/..." value={denomForm.imageUrl || ''} onChange={e => setDenomForm(f => ({...f, imageUrl: e.target.value}))} />
                </label>
                <label className="field" style={{marginBottom:14}}>
                  <span className="label">Status</span>
                  <div className="tabs" style={{marginTop:4}}>
                    {[['draft','Draft'], ['published','Published']].map(([v, l]) => (
                      <div key={v} role="button" tabIndex={0} className={`tab ${(denomForm.status || 'draft') === v ? 'active' : ''}`} style={{cursor:'pointer'}} onClick={() => setDenomForm(f => ({...f, status: v}))} onKeyDown={e => { if (e.key==='Enter'||e.key===' ') { e.preventDefault(); setDenomForm(f => ({...f, status: v})); } }}>{l}</div>
                    ))}
                  </div>
                </label>
                {denomError && <div style={{marginBottom:10, fontSize:12, color:'var(--rust)'}}>{denomError}</div>}
                <div className="row-flex" style={{gap:8}}>
                  <button className="btn btn-ghost btn-sm" onClick={cancelDenom}>Cancel</button>
                  <button className="btn btn-rust btn-sm" style={{flex:1, justifyContent:'center'}} onClick={saveDenom} disabled={denomSaving}>
                    {denomSaving ? 'Saving…' : 'Save'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="card-paper" style={{padding:24, textAlign:'center', color:'var(--ink-3)', fontSize:13}}>
                Select a denomination to edit, or click <strong>+ New Denomination</strong> to add one.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// REWARDS
// ============================================================
function AdminRewards() {
  const [entries, setEntries] = useState([]);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null); // { userId, displayName, email, points, history }
  const [grantForm, setGrantForm] = useState({ points: '', description: '' });
  const [grantError, setGrantError] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = () => fetch('/api/admin/rewards', { credentials: 'include' })
    .then(r => r.json()).then(d => {
      const sorted = (d.entries || []).sort((a, b) => b.points - a.points);
      setEntries(sorted);
      if (selected) setSelected(sorted.find(e => e.userId === selected.userId) || null);
    }).catch(() => {});

  useEffect(() => { load(); }, []);

  const filtered = entries.filter(e => {
    const q = search.toLowerCase();
    return !q || (e.displayName || '').toLowerCase().includes(q) || (e.email || '').toLowerCase().includes(q) || (e.username || '').toLowerCase().includes(q);
  });

  const adjust = async (pts) => {
    if (!selected) return;
    const p = Number(grantForm.points);
    if (!p || p === 0) { setGrantError('Enter a non-zero point amount.'); return; }
    const amount = pts > 0 ? Math.abs(p) : -Math.abs(p);
    setSaving(true); setGrantError(null);
    const resp = await fetch('/api/admin/rewards/adjust', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ userId: selected.userId, points: amount, description: grantForm.description }) }).catch(() => null);
    setSaving(false);
    if (resp && resp.ok) { setGrantForm({ points: '', description: '' }); load(); }
    else setGrantError('Failed to save. Check the amount and try again.');
  };

  const fmtDate = d => { try { return new Date(d).toLocaleDateString('en-AU', { day:'2-digit', month:'short', year:'numeric' }); } catch { return d || ''; } };
  const typeLabel = { order:'Order', repair:'Repair', bonus:'Bonus', redeem:'Redeemed', grant:'Admin grant', adjust:'Admin adjust', signup:'Welcome bonus' };

  return (
    <div style={{display:'flex', gap:24, alignItems:'flex-start', flexWrap:'wrap'}}>
      <div style={{flex:'0 0 320px', minWidth:0}}>
        <input className="input" placeholder="Search by name or email…" value={search} onChange={e => setSearch(e.target.value)} style={{width:'100%', marginBottom:12}} />
        <div className="card-paper" style={{overflow:'auto', maxHeight:520}}>
          {filtered.length === 0 && <div style={{padding:20, color:'var(--ink-3)', fontSize:13}}>No reward accounts yet.</div>}
          {filtered.map(e => (
            <div key={e.userId} role="button" tabIndex={0} onClick={() => { setSelected(e); setGrantError(null); setGrantForm({ points: '', description: '' }); }}
              onKeyDown={e2 => { if (e2.key==='Enter'||e2.key===' ') { e2.preventDefault(); setSelected(e); setGrantError(null); setGrantForm({ points: '', description: '' }); } }}
              style={{display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 16px', borderBottom:'1px solid var(--line)', cursor:'pointer', background: selected?.userId === e.userId ? 'var(--bg-elev)' : 'transparent'}}>
              <div>
                <div style={{fontWeight:500, fontSize:13}}>{e.displayName || e.username || e.userId}</div>
                <div style={{fontSize:11, color:'var(--ink-3)'}}>{e.email}</div>
              </div>
              <div style={{fontWeight:700, fontSize:14, color:'var(--ochre)', flexShrink:0}}>{(e.points || 0).toLocaleString('en-AU')} pts</div>
            </div>
          ))}
        </div>
      </div>

      {selected ? (
        <div style={{flex:1, minWidth:260}}>
          <div className="card-paper" style={{padding:20, marginBottom:16}}>
            <div style={{fontWeight:600, fontSize:15, marginBottom:2}}>{selected.displayName || selected.username}</div>
            <div style={{fontSize:12, color:'var(--ink-3)', marginBottom:12}}>{selected.email}</div>
            <div style={{fontSize:28, fontFamily:'Instrument Serif, serif', color:'var(--ochre)'}}>{(selected.points || 0).toLocaleString('en-AU')} <span style={{fontSize:14, color:'var(--ink-2)'}}>pts</span></div>
            <div style={{fontSize:12, color:'var(--ink-3)', marginTop:4}}>= ${((selected.points || 0) / 100).toLocaleString('en-AU', {minimumFractionDigits:2})} redemption value</div>
          </div>

          <div className="card-paper" style={{padding:20, marginBottom:16}}>
            <div className="eyebrow" style={{marginBottom:10}}>ADJUST POINTS</div>
            <div style={{display:'flex', gap:8, marginBottom:8}}>
              <input className="input" type="number" placeholder="Points (e.g. 500)" value={grantForm.points} onChange={e => setGrantForm(f => ({ ...f, points: e.target.value }))} style={{flex:1}} />
              <input className="input" placeholder="Reason" value={grantForm.description} onChange={e => setGrantForm(f => ({ ...f, description: e.target.value }))} style={{flex:2}} />
            </div>
            {grantError && <div style={{fontSize:12, color:'#b91c1c', marginBottom:8}}>{grantError}</div>}
            <div style={{display:'flex', gap:8}}>
              <button className="btn btn-sm" style={{background:'#345526', color:'#fff'}} onClick={() => adjust(1)} disabled={saving}>+ Grant</button>
              <button className="btn btn-sm btn-ghost" onClick={() => adjust(-1)} disabled={saving}>− Deduct</button>
            </div>
          </div>

          <div className="card-paper" style={{overflow:'auto', maxHeight:360}}>
            <div className="eyebrow" style={{padding:'12px 16px 8px'}}>HISTORY</div>
            {(selected.history || []).length === 0 && <div style={{padding:'8px 16px 16px', color:'var(--ink-3)', fontSize:13}}>No history.</div>}
            {[...(selected.history || [])].reverse().map((h, i) => (
              <div key={h.id || i} style={{display:'flex', alignItems:'center', gap:12, padding:'10px 16px', borderTop:'1px solid var(--line)', flexWrap:'wrap'}}>
                <div style={{flex:1, minWidth:0}}>
                  <div style={{fontSize:13, fontWeight:500}}>{typeLabel[h.type] || h.type}</div>
                  <div style={{fontSize:11, color:'var(--ink-3)'}}>{h.description}{h.refId ? ` · ${h.refId}` : ''}</div>
                  <div style={{fontSize:11, color:'var(--ink-3)'}}>{fmtDate(h.date)}</div>
                </div>
                <div style={{fontWeight:700, fontSize:13, color: h.points > 0 ? '#345526' : 'var(--rust)', flexShrink:0}}>
                  {h.points > 0 ? '+' : ''}{h.points} pts
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div style={{flex:1, display:'flex', alignItems:'center', justifyContent:'center', color:'var(--ink-3)', fontSize:13, padding:40}}>Select a customer to view their rewards.</div>
      )}
    </div>
  );
}

function AdminStoreCredit() {
  const [entries, setEntries] = useState([]);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null); // { userId, displayName, email, balance, history }
  const [grantForm, setGrantForm] = useState({ amount: '', description: '' });
  const [grantError, setGrantError] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = () => fetch('/api/admin/store-credit', { credentials: 'include' })
    .then(r => r.json()).then(d => {
      const sorted = (d.entries || []).sort((a, b) => b.balance - a.balance);
      setEntries(sorted);
      if (selected) setSelected(sorted.find(e => e.userId === selected.userId) || null);
    }).catch(() => {});

  useEffect(() => { load(); }, []);

  const filtered = entries.filter(e => {
    const q = search.toLowerCase();
    return !q || (e.displayName || '').toLowerCase().includes(q) || (e.email || '').toLowerCase().includes(q) || (e.username || '').toLowerCase().includes(q);
  });

  const adjust = async (sign) => {
    if (!selected) return;
    const v = Number(grantForm.amount);
    if (!v || v <= 0) { setGrantError('Enter a positive dollar amount.'); return; }
    const amount = sign > 0 ? Math.abs(v) : -Math.abs(v);
    setSaving(true); setGrantError(null);
    const resp = await fetch('/api/admin/store-credit/adjust', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ userId: selected.userId, amount, description: grantForm.description }) }).catch(() => null);
    setSaving(false);
    if (resp && resp.ok) { setGrantForm({ amount: '', description: '' }); load(); }
    else setGrantError('Failed to save. Check the amount and try again.');
  };

  const fmtDate = d => { try { return new Date(d).toLocaleDateString('en-AU', { day:'2-digit', month:'short', year:'numeric' }); } catch { return d || ''; } };
  const fmt$ = n => '$' + (Number(n) || 0).toLocaleString('en-AU', { minimumFractionDigits: 2 });
  const typeLabel = { order:'Order', repair:'Repair', refund:'Refund', redeem:'Redeemed', grant:'Admin grant', adjust:'Admin adjust' };

  return (
    <div style={{display:'flex', gap:24, alignItems:'flex-start', flexWrap:'wrap'}}>
      <div style={{flex:'0 0 320px', minWidth:0}}>
        <input className="input" placeholder="Search by name or email…" value={search} onChange={e => setSearch(e.target.value)} style={{width:'100%', marginBottom:12}} />
        <div className="card-paper" style={{overflow:'auto', maxHeight:520}}>
          {filtered.length === 0 && <div style={{padding:20, color:'var(--ink-3)', fontSize:13}}>No store credit accounts yet.</div>}
          {filtered.map(e => (
            <div key={e.userId} role="button" tabIndex={0} onClick={() => { setSelected(e); setGrantError(null); setGrantForm({ amount: '', description: '' }); }}
              onKeyDown={e2 => { if (e2.key==='Enter'||e2.key===' ') { e2.preventDefault(); setSelected(e); setGrantError(null); setGrantForm({ amount: '', description: '' }); } }}
              style={{display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 16px', borderBottom:'1px solid var(--line)', cursor:'pointer', background: selected?.userId === e.userId ? 'var(--bg-elev)' : 'transparent'}}>
              <div>
                <div style={{fontWeight:500, fontSize:13}}>{e.displayName || e.username || e.userId}</div>
                <div style={{fontSize:11, color:'var(--ink-3)'}}>{e.email}</div>
              </div>
              <div style={{fontWeight:700, fontSize:14, color:'var(--ochre)', flexShrink:0}}>{fmt$(e.balance)}</div>
            </div>
          ))}
        </div>
      </div>

      {selected ? (
        <div style={{flex:1, minWidth:260}}>
          <div className="card-paper" style={{padding:20, marginBottom:16}}>
            <div style={{fontWeight:600, fontSize:15, marginBottom:2}}>{selected.displayName || selected.username}</div>
            <div style={{fontSize:12, color:'var(--ink-3)', marginBottom:12}}>{selected.email}</div>
            <div style={{fontSize:28, fontFamily:'Instrument Serif, serif', color:'var(--ochre)'}}>{fmt$(selected.balance)} <span style={{fontSize:14, color:'var(--ink-2)'}}>balance</span></div>
          </div>

          <div className="card-paper" style={{padding:20, marginBottom:16}}>
            <div className="eyebrow" style={{marginBottom:10}}>ADJUST STORE CREDIT</div>
            <div style={{display:'flex', gap:8, marginBottom:8}}>
              <input className="input" type="number" step="0.01" placeholder="Amount (e.g. 25.00)" value={grantForm.amount} onChange={e => setGrantForm(f => ({ ...f, amount: e.target.value }))} style={{flex:1}} />
              <input className="input" placeholder="Reason" value={grantForm.description} onChange={e => setGrantForm(f => ({ ...f, description: e.target.value }))} style={{flex:2}} />
            </div>
            {grantError && <div style={{fontSize:12, color:'#b91c1c', marginBottom:8}}>{grantError}</div>}
            <div style={{display:'flex', gap:8}}>
              <button className="btn btn-sm" style={{background:'#345526', color:'#fff'}} onClick={() => adjust(1)} disabled={saving}>+ Issue</button>
              <button className="btn btn-sm btn-ghost" onClick={() => adjust(-1)} disabled={saving}>− Deduct</button>
            </div>
          </div>

          <div className="card-paper" style={{overflow:'auto', maxHeight:360}}>
            <div className="eyebrow" style={{padding:'12px 16px 8px'}}>HISTORY</div>
            {(selected.history || []).length === 0 && <div style={{padding:'8px 16px 16px', color:'var(--ink-3)', fontSize:13}}>No history.</div>}
            {[...(selected.history || [])].reverse().map((h, i) => (
              <div key={h.id || i} style={{display:'flex', alignItems:'center', gap:12, padding:'10px 16px', borderTop:'1px solid var(--line)', flexWrap:'wrap'}}>
                <div style={{flex:1, minWidth:0}}>
                  <div style={{fontSize:13, fontWeight:500}}>{typeLabel[h.type] || h.type}</div>
                  <div style={{fontSize:11, color:'var(--ink-3)'}}>{h.description}{h.refId ? ` · ${h.refId}` : ''}</div>
                  <div style={{fontSize:11, color:'var(--ink-3)'}}>{fmtDate(h.date)}</div>
                </div>
                <div style={{fontWeight:700, fontSize:13, color: h.amount > 0 ? '#345526' : 'var(--rust)', flexShrink:0}}>
                  {h.amount > 0 ? '+' : '−'}{fmt$(Math.abs(h.amount))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div style={{flex:1, display:'flex', alignItems:'center', justifyContent:'center', color:'var(--ink-3)', fontSize:13, padding:40}}>Select a customer to view their store credit.</div>
      )}
    </div>
  );
}

// ANALYTICS
// ============================================================
function AdminAnalytics() {
  const [data, setData] = useState(null);
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);

  const load = (d) => {
    setLoading(true);
    fetch(`/api/admin/analytics?days=${d}`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => { setData(null); setLoading(false); });
  };

  useEffect(() => { load(days); }, [days]);

  const card = (label, value, sub) => (
    <div style={{ background: 'var(--paper)', border: '1px solid var(--line)', borderRadius: 8, padding: '16px 20px', minWidth: 140 }}>
      <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--ink)' }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{sub}</div>}
    </div>
  );

  const barMax = data ? Math.max(1, ...data.daily.map(d => d.views)) : 1;

  return (
    <div style={{ padding: '24px 28px', maxWidth: 960 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <span style={{ fontSize: 13, color: 'var(--muted)' }}>Last</span>
        {[7, 30, 90].map(n => (
          <button key={n} onClick={() => setDays(n)}
            className={days === n ? 'btn btn-rust btn-sm' : 'btn btn-ghost btn-sm'}>
            {n} days
          </button>
        ))}
      </div>

      {loading && <div style={{ color: 'var(--muted)', padding: 32 }}>Loading…</div>}
      {!loading && !data && <div style={{ color: 'var(--muted)', padding: 32 }}>Failed to load analytics.</div>}
      {!loading && data && <>
        {/* Summary cards */}
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 28 }}>
          {card('Page Views', data.totalViews.toLocaleString(), `last ${data.days} days`)}
          {card('Unique Visitors', data.uniqueVisitors.toLocaleString(), 'by IP address')}
          {card('Avg / Day', data.daily.length ? Math.round(data.totalViews / data.daily.length).toLocaleString() : '0', 'page views')}
        </div>

        {/* Daily chart */}
        <div style={{ background: 'var(--paper)', border: '1px solid var(--line)', borderRadius: 8, padding: '20px 20px 12px', marginBottom: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 16 }}>Daily Page Views</div>
          {data.daily.length === 0
            ? <div style={{ color: 'var(--muted)', fontSize: 13 }}>No data yet.</div>
            : <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 80, overflowX: 'auto' }}>
                {data.daily.map(d => (
                  <div key={d.date} title={`${d.date}: ${d.views}`} style={{ flex: '0 0 auto', width: Math.max(6, Math.floor(560 / data.daily.length) - 3), background: 'var(--rust, #c0392b)', borderRadius: '2px 2px 0 0', height: `${Math.round((d.views / barMax) * 80)}px`, minHeight: 2 }} />
                ))}
              </div>
          }
          {data.daily.length > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 11, color: 'var(--muted)' }}>
              <span>{data.daily[0]?.date}</span>
              <span>{data.daily[data.daily.length - 1]?.date}</span>
            </div>
          )}
        </div>

        {/* Top pages + referrers + devices */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16, marginBottom: 20 }}>
          {/* Top pages */}
          <div style={{ background: 'var(--paper)', border: '1px solid var(--line)', borderRadius: 8, padding: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>Top Pages</div>
            {data.topPages.length === 0
              ? <div style={{ color: 'var(--muted)', fontSize: 13 }}>No data yet.</div>
              : data.topPages.map((p, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', borderBottom: i < data.topPages.length - 1 ? '1px solid var(--line)' : 'none' }}>
                  <span style={{ fontSize: 13, color: 'var(--ink)', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '75%' }} title={p.page}>{p.page || '/'}</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--rust, #c0392b)', flexShrink: 0 }}>{p.views.toLocaleString()}</span>
                </div>
              ))}
          </div>

          {/* Top referrers */}
          <div style={{ background: 'var(--paper)', border: '1px solid var(--line)', borderRadius: 8, padding: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>Top Referrers</div>
            {data.topReferrers.length === 0
              ? <div style={{ color: 'var(--muted)', fontSize: 13 }}>No referrer data yet.</div>
              : data.topReferrers.map((r, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', borderBottom: i < data.topReferrers.length - 1 ? '1px solid var(--line)' : 'none' }}>
                  <span style={{ fontSize: 13, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '75%' }} title={r.referrer}>{r.referrer}</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--rust, #c0392b)', flexShrink: 0 }}>{r.views.toLocaleString()}</span>
                </div>
              ))}
          </div>

          {/* Devices */}
          <div style={{ background: 'var(--paper)', border: '1px solid var(--line)', borderRadius: 8, padding: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>Devices</div>
            {[
              { label: 'Desktop', value: data.devices.desktop },
              { label: 'Mobile', value: data.devices.mobile },
              { label: 'Tablet', value: data.devices.tablet },
            ].map(({ label, value }) => {
              const total = data.devices.desktop + data.devices.mobile + data.devices.tablet || 1;
              const pct = Math.round((value / total) * 100);
              return (
                <div key={label} style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                    <span style={{ color: 'var(--ink)' }}>{label}</span>
                    <span style={{ color: 'var(--muted)' }}>{value.toLocaleString()} ({pct}%)</span>
                  </div>
                  <div style={{ height: 6, background: 'var(--line)', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ width: `${pct}%`, height: '100%', background: 'var(--rust, #c0392b)', borderRadius: 3 }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </>}
    </div>
  );
}

// EXPENSES
// ============================================================
const blankExpense = () => ({ description:'', category:'tools', amount:0, quantity:1, date:'', receipt:null, jobId:'', notes:'', isSecondHand:false, partStatus:'' });

function AdminExpenses() {
  const [rows, setRows] = useState([]);
  const [edit, setEdit] = useState(null);
  const [form, setForm] = useState({});
  const [jobOptions, setJobOptions] = useState([]);
  const [catFilter, setCatFilter] = useUrlState('cat', 'all');
  const [openId, setOpenId] = useUrlState('open', null, { push: true });
  const dirty = useDirtyTracker(form, edit && (edit.id || 'new'));

  useEffect(() => {
    fetch('/api/admin/expenses', { credentials:'include' })
      .then(r => r.ok ? r.json() : Promise.reject()).then(d => setRows(d.items || [])).catch(() => setRows([]));
    fetch('/api/admin/orders', { credentials:'include' })
      .then(r => r.ok ? r.json() : Promise.reject()).then(d => setJobOptions(d.items || [])).catch(() => {});
  }, []);

  const openRow = (r) => setOpenId(r.id);
  const openNew = () => setOpenId('new');
  const closeDrawer = () => setOpenId(null);

  // Reconcile the open drawer with the URL's `open` param, drives both the
  // initial restore on reload and Back/Forward navigation.
  useEffect(() => {
    const cur = edit === null ? null : (edit.id || 'new');
    if (openId === cur) return;
    if (openId == null) { setEdit(null); return; }
    if (openId === 'new') { setEdit({}); setForm(blankExpense()); return; }
    const r = rows.find(x => x.id === openId);
    if (r) { setEdit(r); setForm({ ...r }); }
  }, [openId, rows]);

  const save = async () => {
    const r = await fetch('/api/admin/expenses/save', { method:'POST', headers:postHeaders(), credentials:'include', body: JSON.stringify(form) }).catch(()=>null);
    if (r && r.ok) {
      const d = await r.json();
      if (!edit.id) setRows(rs => [...rs, d.item]);
      else setRows(rs => rs.map(x => x.id === edit.id ? d.item : x));
      closeDrawer();
    } else {
      adminToast('Failed to save expense, changes not persisted.');
    }
  };

  const del = async () => {
    if (!form.id || !(await adminConfirm('Delete this expense?', { title:'Delete expense', confirmLabel:'Delete', danger:true }))) return;
    const r = await fetch('/api/admin/expenses/delete', { method:'POST', headers:postHeaders(), credentials:'include', body: JSON.stringify({ id: form.id }) }).catch(()=>null);
    if (!r || !r.ok) { adminToast('Failed to delete expense.'); return; }
    setRows(rs => rs.filter(x => x.id !== form.id));
    closeDrawer();
  };

  const handleReceiptUpload = async (file) => {
    try {
      const url = await uploadImage(file);
      setForm(f => ({...f, receipt: url}));
    } catch {}
  };

  const catMap = { tools:{bg:'#dceaf5',fg:'#1668c8'}, equipment:{bg:'#fff4d6',fg:'#7a5d10'}, parts:{bg:'#f3d5c5',fg:'#7a3a18'}, software:{bg:'#e8d5f5',fg:'#5a1890'}, other:{bg:'var(--bg-deep)',fg:'var(--ink-2)'} };
  const cats = ['all', ...Object.keys(catMap)];

  const parseDate = (s) => {
    if (!s) return new Date(0);
    const m = String(s).match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
    if (m) return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
    const d = new Date(s);
    return isNaN(d) ? new Date(0) : d;
  };
  const visible = catFilter === 'all' ? rows : rows.filter(r => (r.category || 'other') === catFilter);
  const total = visible.reduce((s, e) => s + expTotal(e), 0);

  if (edit !== null) {
    return (
      <OrderPage onClose={closeDrawer} dirty={dirty} backLabel="Back to Expenses" title={edit.id ? `Expense - ${form.description || edit.id}` : 'Log expense'}
        footer={<div className="row-flex" style={{justifyContent:'space-between'}}>
          {edit.id ? <button className="btn btn-ghost btn-sm" style={{color:'var(--rust)'}} onClick={del}>Delete</button> : <span/>}
          <div className="row-flex" style={{gap:8}}>
            <button className="btn btn-ghost btn-sm" onClick={closeDrawer}>Cancel</button>
            <button className="btn btn-sm" onClick={save}>Save</button>
          </div>
        </div>}
      >
        <label className="field"><span className="label">Description</span><input className="input" value={form.description||''} onChange={e=>setForm({...form,description:e.target.value})}/></label>
        <div className="grid-2" style={{gap:14}}>
          <label className="field"><span className="label">Category</span>
            <select className="select" value={form.category||'tools'} onChange={e=>setForm({...form,category:e.target.value})}>
              {['tools','equipment','parts','software','other'].map(c => <option key={c}>{c}</option>)}
            </select>
          </label>
          <label className="field"><span className="label">Quantity</span>
            <QuantityInput value={form.quantity} onCommit={q => setForm(f=>({...f,quantity:q}))}/>
          </label>
        </div>
        <div className="grid-2" style={{gap:14}}>
          <label className="field"><span className="label">Amount (AUD, per item)</span><input className="input" type="number" min="0" step="0.01" value={form.amount||0} onChange={e=>setForm({...form,amount:Number(nonNegInput(e.target.value))||0})}/></label>
          <label className="field"><span className="label">Total</span><input className="input" disabled value={`$${expTotal(form).toLocaleString('en-AU',{minimumFractionDigits:2})}`}/></label>
        </div>
        <label className="field"><span className="label">Date</span><input className="input" type="date" value={auDateToISO(form.date)} onChange={e=>setForm({...form,date:isoToAuDate(e.target.value)})}/></label>
        <label className="field"><span className="label">Link to job</span>
          <select className="select" value={form.jobId||''} onChange={e=>setForm({...form,jobId:e.target.value})}>
            <option value="">No job link</option>
            {jobOptions.map(j => <option key={j.id} value={j.id}>{j.id} · {j.cust} · {j.items}</option>)}
          </select>
        </label>
        <label className="field"><span className="label">Notes</span><input className="input" value={form.notes||''} onChange={e=>setForm({...form,notes:e.target.value})}/></label>
        <label className="field"><span className="label">Part status</span>
          <select className="select" value={form.partStatus||''} onChange={e=>setForm({...form,partStatus:e.target.value})}>
            <option value="">Not applicable</option>
            <option value="ordered">Ordered</option>
            <option value="arrived">Arrived</option>
            <option value="installed">Installed</option>
            <option value="returned">Returned</option>
          </select>
        </label>
        <label style={{display:'flex',alignItems:'center',gap:10,cursor:'pointer',marginBottom:14}}>
          <input type="checkbox" checked={!!form.isSecondHand} onChange={e=>setForm({...form,isSecondHand:e.target.checked})} style={{width:16,height:16,cursor:'pointer'}}/>
          <span style={{fontSize:13,fontWeight:500}}>Second-hand part / item</span>
        </label>
        <div className="field">
          <span className="label">Receipt</span>
          {form.receipt && (
            <div style={{marginBottom:8,display:'flex',gap:8,alignItems:'center'}}>
              <a href={form.receipt} target="_blank" rel="noopener noreferrer" style={{display:'inline-flex', alignItems:'center', gap:4, color:'var(--rust)',fontSize:13}}>View current receipt <Icon name="externalLink" size={11}/></a>
              <button className="btn btn-ghost btn-sm" style={{color:'var(--rust)'}} onClick={() => setForm(f=>({...f,receipt:null}))}>Remove</button>
            </div>
          )}
          <label style={{cursor:'pointer',display:'inline-block'}}>
            <input type="file" accept="image/*,application/pdf" style={{display:'none'}} onChange={e => { if(e.target.files[0]) handleReceiptUpload(e.target.files[0]); }}/>
            <span className="btn btn-ghost btn-sm">{form.receipt ? 'Replace receipt' : 'Upload receipt'}</span>
          </label>
        </div>
      </OrderPage>
    );
  }

  return (
    <div style={{padding:32}}>
      <div className="row-flex" style={{justifyContent:'space-between', marginBottom:18}}>
        <div className="row-flex" style={{gap:16, alignItems:'center'}}>
          <div className="tabs">
            {cats.map(c => (
              <div key={c} role="button" tabIndex={0} className={`tab${catFilter===c?' active':''}`} onClick={() => setCatFilter(c)} onKeyDown={e => { if (e.key==='Enter'||e.key===' ') { e.preventDefault(); setCatFilter(c); } }} style={{cursor:'pointer'}}>
                {c === 'all' ? `All (${rows.length})` : c.charAt(0).toUpperCase() + c.slice(1)}
              </div>
            ))}
          </div>
          <div className="mono" style={{fontSize:11, color:'var(--rust)'}}>-${total.toLocaleString('en-AU', {minimumFractionDigits:2})}</div>
        </div>
        <button className="btn btn-rust btn-sm" onClick={openNew}>+ Log expense</button>
      </div>
      <Table
        columns={[
          { key:'description', label:'Description', w:'2fr', sort:true, render:r => <span style={{fontWeight:500}}>{r.description}</span> },
          { key:'category', label:'Category', w:'110px', sort:true, render:r => { const c = catMap[r.category]||catMap.other; return <span className="tag" style={{background:c.bg,color:c.fg,borderColor:c.bg}}>{(r.category||'other').toUpperCase()}</span>; } },
          { key:'isSecondHand', label:'Condition', w:'100px', sort:r => r.isSecondHand ? 1 : 0, render:r => r.isSecondHand ? <span className="tag tag-ochre">2ND HAND</span> : <span className="tag tag-euc">NEW</span> },
          { key:'partStatus', label:'Part status', w:'110px', sort:true, render:r => {
            if (!r.partStatus) return <span style={{color:'var(--ink-3)'}}>-</span>;
            const sc = { ordered:{bg:'#dceaf5',fg:'#1668c8'}, arrived:{bg:'#fff4d6',fg:'#7a5d10'}, installed:{bg:'#d8e7d0',fg:'#345526'}, returned:{bg:'#f3d5c5',fg:'#7a3a18'} };
            const s = sc[r.partStatus] || {bg:'var(--bg-deep)',fg:'var(--ink-2)'};
            return <span className="tag" style={{background:s.bg,color:s.fg,borderColor:s.bg}}>{r.partStatus.toUpperCase()}</span>;
          }},
          { key:'quantity', label:'Qty', w:'60px', sort:r => Number(r.quantity) || 1, render:r => <span className="mono" style={{fontSize:12,color:'var(--ink-2)'}}>×{Number(r.quantity)||1}</span> },
          { key:'amount', label:'Amount', w:'110px', sort:r => expTotal(r), render:r => <span className="mono" style={{fontWeight:600,color:'var(--rust)'}}>-${expTotal(r).toLocaleString('en-AU',{minimumFractionDigits:2})}</span> },
          { key:'date', label:'Date', w:'120px', sort:r => parseDate(r.date).getTime(), render:r => <span className="mono" style={{fontSize:11,color:'var(--ink-2)'}}>{r.date||'-'}</span> },
          { key:'jobId', label:'Linked job', w:'140px', sort:true, render:r => r.jobId ? <span className="mono" style={{fontSize:11,color:'var(--rust)'}}>{r.jobId}</span> : <span style={{color:'var(--ink-3)'}}>-</span> },
          { key:'receipt', label:'Receipt', w:'90px', render:r => r.receipt ? <a href={r.receipt} target="_blank" rel="noopener noreferrer" style={{display:'inline-flex', alignItems:'center', gap:4, color:'var(--rust)',fontSize:12}}>View <Icon name="externalLink" size={10}/></a> : <span style={{color:'var(--ink-3)'}}>-</span> },
          { key:'notes', label:'Notes', w:'1fr', render:r => <span style={{fontSize:12,color:'var(--ink-2)'}}>{r.notes||''}</span> },
        ]}
        rows={visible}
        onRowClick={openRow}
        defaultSort={{ key: 'date', dir: 'desc' }}
      />
    </div>
  );
}

// ============================================================
// TAX REPORTS - P&L + BAS WORKSHEET
// ============================================================
function AdminTaxReports() {
  const [view, setView] = useState('pl');
  const TABS = [
    {id:'pl',          label:'P&L Statement'},
    {id:'yoy',         label:'Year-on-Year'},
    {id:'cashflow',    label:'Cash Flow'},
    {id:'gst',         label:'GST Tracker'},
    {id:'bas',         label:'BAS Worksheet'},
    {id:'receivables', label:'Receivables'},
    {id:'stock',       label:'Trading Stock'},
    {id:'vehicle',     label:'Vehicle Log'},
    {id:'homeoffice',  label:'Home Office'},
    {id:'atodates',    label:'ATO Dates'},
    {id:'yearend',     label:'Year-End Checklist'},
  ];
  return (
    <div style={{padding:32, maxWidth:980}}>
      <div className="tabs" style={{marginBottom:24, flexWrap:'wrap', gap:4}}>
        {TABS.map(v => (
          <div key={v.id} role="button" tabIndex={0} className={`tab${view===v.id?' active':''}`}
            onClick={() => setView(v.id)}
            onKeyDown={e => { if (e.key==='Enter'||e.key===' ') setView(v.id); }}
            style={{cursor:'pointer'}}>
            {v.label}
          </div>
        ))}
      </div>
      {view === 'pl'          && <PLView />}
      {view === 'yoy'         && <YoYView />}
      {view === 'cashflow'    && <CashFlowView />}
      {view === 'gst'         && <GSTTrackerView />}
      {view === 'bas'         && <BASView />}
      {view === 'receivables' && <ReceivablesView />}
      {view === 'stock'       && <StockView />}
      {view === 'vehicle'     && <VehicleLogView />}
      {view === 'homeoffice'  && <HomeOfficeView />}
      {view === 'atodates'    && <ATODatesView />}
      {view === 'yearend'     && <YearEndView />}
    </div>
  );
}

function PLView() {
  const now = new Date();
  const currentFyYear = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;

  const FY_PRESETS = [
    { label: `FY ${currentFyYear}–${String(currentFyYear+1).slice(2)} (Current)`, from: `${currentFyYear}-07-01`, to: `${currentFyYear+1}-06-30` },
    { label: `FY ${currentFyYear-1}–${String(currentFyYear).slice(2)} (Previous)`, from: `${currentFyYear-1}-07-01`, to: `${currentFyYear}-06-30` },
    { label: `FY ${currentFyYear-2}–${String(currentFyYear-1).slice(2)}`, from: `${currentFyYear-2}-07-01`, to: `${currentFyYear-1}-06-30` },
    { label: 'Custom range', from: '', to: '' },
  ];

  const [preset, setPreset] = useState(0);
  const [from, setFrom] = useState(FY_PRESETS[0].from);
  const [to, setTo]     = useState(FY_PRESETS[0].to);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);
  const [expandedCat, setExpandedCat] = useState(null);

  const applyPreset = idx => {
    setPreset(idx);
    if (idx < FY_PRESETS.length - 1) { setFrom(FY_PRESETS[idx].from); setTo(FY_PRESETS[idx].to); }
  };

  const loadReport = async (f = from, t = to) => {
    if (!f || !t) { setError('Please select a date range.'); return; }
    setLoading(true); setError(null); setData(null);
    const r = await fetch(`/api/admin/tax-report?from=${f}&to=${t}`, { credentials:'include' }).catch(()=>null);
    setLoading(false);
    if (!r || !r.ok) { setError('Failed to load report.'); return; }
    setData(await r.json());
  };

  useEffect(() => { loadReport(FY_PRESETS[0].from, FY_PRESETS[0].to); }, []);

  const exportPdf = () => window.open(`/api/admin/tax-report/pdf?from=${from}&to=${to}`, '_blank');

  const fmtAUD = n => `$${(Number(n)||0).toLocaleString('en-AU',{minimumFractionDigits:2,maximumFractionDigits:2})}`;
  const fmtDateLabel = s => s ? new Date(s+'T00:00:00').toLocaleDateString('en-AU',{day:'numeric',month:'short',year:'numeric'}) : '';
  const catLabels = { tools:'Tools', equipment:'Equipment', parts:'Parts & Components', software:'Software', other:'Other' };
  const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  return (
    <>
      {/* Period selector */}
      <div className="card" style={{padding:'18px 22px', marginBottom:24}}>
        <div style={{display:'flex', gap:12, flexWrap:'wrap', alignItems:'flex-end'}}>
          <div>
            <div className="label" style={{marginBottom:6}}>Period</div>
            <div className="tabs">
              {FY_PRESETS.map((p, i) => (
                <div key={i} role="button" tabIndex={0} className={`tab${preset===i?' active':''}`}
                  onClick={() => applyPreset(i)}
                  onKeyDown={e => { if (e.key==='Enter'||e.key===' ') applyPreset(i); }}
                  style={{cursor:'pointer'}}>
                  {p.label}
                </div>
              ))}
            </div>
          </div>
          {preset === FY_PRESETS.length - 1 && (<>
            <label className="field" style={{margin:0}}>
              <span className="label">From</span>
              <input className="input" type="date" value={from} onChange={e => setFrom(e.target.value)} />
            </label>
            <label className="field" style={{margin:0}}>
              <span className="label">To</span>
              <input className="input" type="date" value={to} onChange={e => setTo(e.target.value)} />
            </label>
          </>)}
          <button className="btn btn-rust" onClick={() => loadReport()} disabled={loading}>
            {loading ? 'Loading…' : 'Generate'}
          </button>
          {data && (
            <button className="btn" style={{background:'#345526', color:'#fff'}} onClick={exportPdf}>
              <Icon name="download" size={13}/> Export PDF
            </button>
          )}
        </div>
        {error && <div className="mono" style={{color:'var(--rust)', fontSize:12, marginTop:8}}>{error}</div>}
        {data && <div className="mono" style={{fontSize:11, color:'var(--ink-3)', marginTop:8}}>
          Period: {fmtDateLabel(data.from)} – {fmtDateLabel(data.to)}
        </div>}
      </div>

      {loading && <div className="mono" style={{color:'var(--ink-3)', textAlign:'center', padding:40}}>Loading report…</div>}

      {data && <>
        {/* Summary tiles */}
        <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(180px, 1fr))', gap:14, marginBottom:24}}>
          {[
            { label:'TOTAL REVENUE',     value: fmtAUD(data.totalRevenue),                                    color:'#345526' },
            { label:'TOTAL EXPENSES',    value: `(${fmtAUD(data.totalExpenses)})`,                            color:'var(--rust)' },
            { label: data.grossProfit>=0 ? 'NET PROFIT' : 'NET LOSS',
              value: fmtAUD(Math.abs(data.grossProfit)),
              color: data.grossProfit>=0 ? '#345526' : 'var(--rust)' },
            { label:'SET ASIDE FOR TAX', value: fmtAUD((data.taxEstimate||{}).quarterlySetAside||0), sub:'per quarter', color:'var(--rust)' },
          ].map(t => (
            <div key={t.label} className="card" style={{padding:'16px 18px'}}>
              <div className="mono" style={{fontSize:10, color:'var(--ink-3)', marginBottom:4}}>{t.label}</div>
              <div className="mono" style={{fontSize:20, fontWeight:700, color:t.color}}>{t.value}</div>
              {t.sub && <div className="mono" style={{fontSize:10, color:'var(--ink-3)', marginTop:2}}>{t.sub}</div>}
            </div>
          ))}
        </div>

        {/* Income */}
        <div className="card" style={{padding:'18px 22px', marginBottom:16}}>
          <div className="mono" style={{fontSize:11, fontWeight:700, color:'var(--rust)', marginBottom:12, letterSpacing:1}}>INCOME</div>
          <table style={{width:'100%', borderCollapse:'collapse', fontSize:13}}>
            <tbody>
              <tr>
                <td style={{padding:'5px 0', color:'var(--ink-2)'}}>Shop Orders ({data.orderCount})</td>
                <td style={{textAlign:'right', fontFamily:'monospace'}}>{fmtAUD(data.orderRevenue)}</td>
              </tr>
              {data.refundTotal > 0 && (
                <tr>
                  <td style={{padding:'5px 0', color:'var(--ink-2)'}}>Less: Refunds</td>
                  <td style={{textAlign:'right', fontFamily:'monospace', color:'var(--rust)'}}>({fmtAUD(data.refundTotal)})</td>
                </tr>
              )}
              {data.repairRevenue > 0 && (
                <tr>
                  <td style={{padding:'5px 0', color:'var(--ink-2)'}}>Repair Jobs - completed ({data.repairCount})</td>
                  <td style={{textAlign:'right', fontFamily:'monospace'}}>{fmtAUD(data.repairRevenue)}</td>
                </tr>
              )}
              <tr style={{borderTop:'1px solid var(--border)'}}>
                <td style={{padding:'8px 0', fontWeight:700}}>Total Income</td>
                <td style={{textAlign:'right', fontFamily:'monospace', fontWeight:700, color:'#345526'}}>{fmtAUD(data.totalRevenue)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Expenses */}
        <div className="card" style={{padding:'18px 22px', marginBottom:16}}>
          <div style={{display:'flex', alignItems:'center', gap:10, marginBottom:12}}>
            <div className="mono" style={{fontSize:11, fontWeight:700, color:'var(--rust)', letterSpacing:1}}>EXPENSES</div>
            <div style={{fontSize:11, color:'var(--ink-3)'}}>Click a category to expand</div>
          </div>
          <table style={{width:'100%', borderCollapse:'collapse', fontSize:13}}>
            <tbody>
              {Object.entries(data.expByCat).sort(([,a],[,b])=>b-a).map(([cat, amt]) => (<>
                <tr key={cat} onClick={() => setExpandedCat(expandedCat===cat ? null : cat)}
                  style={{cursor:'pointer', background: expandedCat===cat ? 'var(--bg-deep)' : 'transparent'}}>
                  <td style={{padding:'6px 0', color:'var(--ink-2)'}}>
                    <span style={{marginRight:6, display:'inline-flex', color:'var(--ink-3)'}}><Icon name={expandedCat===cat?'chevronDown':'chevronRight'} size={11}/></span>
                    {catLabels[cat]||cat.charAt(0).toUpperCase()+cat.slice(1)}
                  </td>
                  <td style={{textAlign:'right', fontFamily:'monospace', color:'var(--rust)'}}>({fmtAUD(amt)})</td>
                </tr>
                {expandedCat === cat && (data.expLines||{})[cat] && (data.expLines[cat]).map((ln,i) => (
                  <tr key={i} style={{background:'#fdf9f5'}}>
                    <td style={{padding:'3px 0 3px 22px', color:'var(--ink-3)', fontSize:12}}>
                      <span className="mono" style={{fontSize:10, marginRight:8}}>{ln.date}</span>
                      {ln.description || '(no description)'}
                      {ln.notes && <span style={{marginLeft:8, fontSize:11, color:'var(--ink-3)'}}>{ln.notes}</span>}
                    </td>
                    <td style={{textAlign:'right', fontFamily:'monospace', fontSize:12, color:'var(--ink-2)'}}>({fmtAUD(ln.amount)})</td>
                  </tr>
                ))}
              </>))}
              {Object.keys(data.expByCat).length === 0 && (
                <tr><td colSpan={2} style={{color:'var(--ink-3)', padding:'5px 0'}}>No expenses recorded in this period.</td></tr>
              )}
              <tr style={{borderTop:'1px solid var(--border)'}}>
                <td style={{padding:'8px 0', fontWeight:700}}>Total Expenses</td>
                <td style={{textAlign:'right', fontFamily:'monospace', fontWeight:700, color:'var(--rust)'}}>({fmtAUD(data.totalExpenses)})</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Income tax estimate */}
        {(() => {
          const tx = data.taxEstimate || {};
          return (<>
            <div className="card" style={{padding:'18px 22px', marginBottom:16}}>
              <div className="mono" style={{fontSize:11, fontWeight:700, color:'var(--rust)', marginBottom:12, letterSpacing:1}}>INCOME TAX ESTIMATE - SOLE TRADER (2025-26 RATES)</div>
              <table style={{width:'100%', borderCollapse:'collapse', fontSize:13}}>
                <tbody>
                  <tr>
                    <td style={{padding:'5px 0', color:'var(--ink-2)'}}>Taxable income (net profit)</td>
                    <td style={{textAlign:'right', fontFamily:'monospace'}}>{fmtAUD(data.grossProfit)}</td>
                  </tr>
                  <tr>
                    <td style={{padding:'5px 0', color:'var(--ink-2)'}}>Base income tax (brackets)</td>
                    <td style={{textAlign:'right', fontFamily:'monospace', color:'var(--rust)'}}>({fmtAUD(tx.baseTax||0)})</td>
                  </tr>
                  {(tx.lito||0) > 0 && (
                    <tr>
                      <td style={{padding:'5px 0', color:'var(--ink-2)'}}>Low Income Tax Offset (LITO)</td>
                      <td style={{textAlign:'right', fontFamily:'monospace', color:'#345526'}}>{fmtAUD(tx.lito)}</td>
                    </tr>
                  )}
                  {(tx.sbito||0) > 0 && (
                    <tr>
                      <td style={{padding:'5px 0', color:'var(--ink-2)'}}>Small Business Income Tax Offset (SBITO)</td>
                      <td style={{textAlign:'right', fontFamily:'monospace', color:'#345526'}}>{fmtAUD(tx.sbito)}</td>
                    </tr>
                  )}
                  <tr>
                    <td style={{padding:'5px 0', color:'var(--ink-2)'}}>Medicare levy (2%)</td>
                    <td style={{textAlign:'right', fontFamily:'monospace', color:'var(--rust)'}}>({fmtAUD(tx.medicareLevy||0)})</td>
                  </tr>
                  <tr style={{borderTop:'1px solid var(--border)'}}>
                    <td style={{padding:'8px 0', fontWeight:700}}>
                      Estimated tax payable
                      <span className="mono" style={{fontWeight:400, fontSize:11, color:'var(--ink-3)', marginLeft:10}}>
                        effective {(tx.effectiveRate||0).toFixed(1)}% · marginal {((tx.marginalRate||0)*100).toFixed(0)}%
                      </span>
                    </td>
                    <td style={{textAlign:'right', fontFamily:'monospace', fontWeight:700, color:'var(--rust)'}}>{fmtAUD(tx.totalTax||0)}</td>
                  </tr>
                  <tr style={{background:'#fbe9e4'}}>
                    <td style={{padding:'8px 0 8px 8px', fontWeight:700, color:'var(--rust)'}}>Set aside per quarter</td>
                    <td style={{textAlign:'right', fontFamily:'monospace', fontWeight:700, fontSize:16, color:'var(--rust)', paddingRight:4}}>{fmtAUD(tx.quarterlySetAside||0)}</td>
                  </tr>
                </tbody>
              </table>
              {tx.paygRequired && (
                <div style={{background:'#fff8e1', border:'1px solid #f0d97c', borderRadius:5, padding:'8px 12px', marginTop:10, fontSize:12, color:'#7a5d10'}}>
                  <strong>PAYG Instalments likely required.</strong> Your estimated tax exceeds $4,000. The ATO will issue a PAYG instalment notice, lodge quarterly via myGov Business Portal.
                </div>
              )}
              <div style={{fontSize:11, color:'var(--ink-3)', marginTop:10}}>
                Estimated using 2025-26 Australian individual tax rates, LITO, and SBITO. Assumes this profit is your only income.
                Consult a registered tax agent for your actual liability.
              </div>
            </div>

            {/* Superannuation estimate */}
            <div className="card" style={{padding:'18px 22px', marginBottom:16}}>
              <div className="mono" style={{fontSize:11, fontWeight:700, color:'var(--rust)', marginBottom:12, letterSpacing:1}}>SUPERANNUATION ESTIMATE</div>
              <table style={{width:'100%', borderCollapse:'collapse', fontSize:13}}>
                <tbody>
                  <tr>
                    <td style={{padding:'5px 0', color:'var(--ink-2)'}}>
                      Recommended contribution
                      <span style={{fontSize:11, color:'var(--ink-3)', marginLeft:8}}>12% of profit, capped ${(tx.concessionalCap||30000).toLocaleString()}</span>
                    </td>
                    <td style={{textAlign:'right', fontFamily:'monospace'}}>{fmtAUD(tx.recommendedSuper||0)}</td>
                  </tr>
                  <tr style={{borderTop:'1px solid var(--border)'}}>
                    <td style={{padding:'8px 0', fontWeight:700}}>
                      Estimated tax saving
                      <span className="mono" style={{fontWeight:400, fontSize:11, color:'var(--ink-3)', marginLeft:8}}>
                        marginal {((tx.marginalRate||0)*100).toFixed(0)}% − 15% super tax
                      </span>
                    </td>
                    <td style={{textAlign:'right', fontFamily:'monospace', fontWeight:700, color:'#345526'}}>{fmtAUD(tx.superTaxSaving||0)}</td>
                  </tr>
                </tbody>
              </table>
              <div style={{fontSize:11, color:'var(--ink-3)', marginTop:10}}>
                Personal contributions are deductible up to the concessional cap if you lodge a "Notice of intent to claim a deduction" with your fund before lodging your tax return.
                Contributions must be made by 30 June. Consult a licensed financial adviser.
              </div>
            </div>
          </>);
        })()}

        {/* GST, not registered */}
        <div className="card" style={{padding:'14px 22px', marginBottom:16, background:'var(--bg-deep)', border:'1px solid var(--border)', opacity:0.6}}>
          <div style={{display:'flex', alignItems:'center', gap:12}}>
            <div className="mono" style={{fontSize:11, fontWeight:700, color:'var(--ink-3)', letterSpacing:1}}>GST</div>
            <div style={{fontSize:13, color:'var(--ink-3)'}}>Not registered - N/A</div>
            <div style={{fontSize:11, color:'var(--ink-3)', marginLeft:'auto'}}>Register at the ATO once turnover exceeds $75,000/yr</div>
          </div>
        </div>

        {/* Monthly breakdown */}
        {data.monthly.length > 0 && (
          <div className="card" style={{padding:'18px 22px', marginBottom:16}}>
            <div className="mono" style={{fontSize:11, fontWeight:700, color:'var(--rust)', marginBottom:12, letterSpacing:1}}>MONTHLY BREAKDOWN</div>
            <table style={{width:'100%', borderCollapse:'collapse', fontSize:13}}>
              <thead>
                <tr style={{borderBottom:'2px solid var(--border)'}}>
                  <th style={{textAlign:'left',  padding:'4px 0', fontWeight:600, color:'var(--ink-2)', fontSize:11}}>MONTH</th>
                  <th style={{textAlign:'right', padding:'4px 0', fontWeight:600, color:'var(--ink-2)', fontSize:11}}>REVENUE</th>
                  <th style={{textAlign:'right', padding:'4px 0', fontWeight:600, color:'var(--ink-2)', fontSize:11}}>EXPENSES</th>
                  <th style={{textAlign:'right', padding:'4px 0', fontWeight:600, color:'var(--ink-2)', fontSize:11}}>PROFIT / (LOSS)</th>
                </tr>
              </thead>
              <tbody>
                {data.monthly.map((m, i) => {
                  const [yr, mo] = m.month.split('-');
                  const lbl = `${monthNames[parseInt(mo)-1]} ${yr}`;
                  return (
                    <tr key={m.month} style={{background: i%2===1 ? 'var(--bg-deep)' : 'transparent'}}>
                      <td style={{padding:'6px 0', color:'var(--ink-1)'}}>{lbl}</td>
                      <td style={{textAlign:'right', fontFamily:'monospace'}}>{fmtAUD(m.revenue)}</td>
                      <td style={{textAlign:'right', fontFamily:'monospace', color:'var(--ink-2)'}}>({fmtAUD(m.expenses)})</td>
                      <td style={{textAlign:'right', fontFamily:'monospace', fontWeight:600, color: m.profit>=0 ? '#345526' : 'var(--rust)'}}>
                        {fmtAUD(m.profit)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </>}
    </>
  );
}

function BASView() {
  const now = new Date();
  const fyYear = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;

  const BAS_PRESETS = [
    { label: `Q1 – Jul–Sep ${fyYear}`,   from: `${fyYear}-07-01`,   to: `${fyYear}-09-30` },
    { label: `Q2 – Oct–Dec ${fyYear}`,   from: `${fyYear}-10-01`,   to: `${fyYear}-12-31` },
    { label: `Q3 – Jan–Mar ${fyYear+1}`, from: `${fyYear+1}-01-01`, to: `${fyYear+1}-03-31` },
    { label: `Q4 – Apr–Jun ${fyYear+1}`, from: `${fyYear+1}-04-01`, to: `${fyYear+1}-06-30` },
    { label: 'Custom', from: '', to: '' },
  ];

  // Default to the most recently completed quarter
  const defaultPreset = (() => {
    const m = now.getMonth() + 1; // 1-12
    if (m >= 10) return 0; // Oct+ → Q1 just finished
    if (m >= 7)  return 3; // Jul-Sep → Q4 of previous FY (just finished)
    if (m >= 4)  return 2; // Apr-Jun → Q3 just finished
    return 1;              // Jan-Mar → Q2 just finished
  })();

  const [preset, setPreset]  = useState(defaultPreset);
  const [from, setFrom]      = useState(BAS_PRESETS[defaultPreset].from);
  const [to, setTo]          = useState(BAS_PRESETS[defaultPreset].to);
  const [data, setData]      = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]    = useState(null);

  const applyPreset = idx => {
    setPreset(idx);
    if (idx < BAS_PRESETS.length - 1) { setFrom(BAS_PRESETS[idx].from); setTo(BAS_PRESETS[idx].to); }
  };

  const loadBAS = async (f = from, t = to) => {
    if (!f || !t) { setError('Please select a period.'); return; }
    setLoading(true); setError(null); setData(null);
    const r = await fetch(`/api/admin/bas-report?from=${f}&to=${t}`, { credentials:'include' }).catch(()=>null);
    setLoading(false);
    if (!r || !r.ok) { setError('Failed to load BAS data.'); return; }
    setData(await r.json());
  };

  useEffect(() => { loadBAS(BAS_PRESETS[defaultPreset].from, BAS_PRESETS[defaultPreset].to); }, []);

  const exportPdf = () => window.open(`/api/admin/bas-report/pdf?from=${from}&to=${to}`, '_blank');
  const fmtAUD = n => `$${(Number(n)||0).toLocaleString('en-AU',{minimumFractionDigits:2,maximumFractionDigits:2})}`;
  const fmtDateLabel = s => s ? new Date(s+'T00:00:00').toLocaleDateString('en-AU',{day:'numeric',month:'short',year:'numeric'}) : '';

  const GRow = ({ code, label, value, bold, shade, dim, highlight }) => (
    <tr style={{background: highlight ? '#003087' : shade ? 'var(--bg-deep)' : 'transparent', color: highlight ? '#fff' : 'inherit'}}>
      <td style={{padding:'5px 8px', fontWeight:700, fontSize:12, color: highlight ? '#fff' : '#777', width:36, fontFamily:'monospace'}}>{code}</td>
      <td style={{padding:'5px 0', fontWeight: bold||highlight ? 600 : 400, color: highlight ? '#fff' : dim ? 'var(--ink-3)' : 'var(--ink-1)', fontSize:13}}>{label}</td>
      <td style={{textAlign:'right', fontFamily:'monospace', fontWeight: bold||highlight ? 700 : 400, fontSize: highlight ? 14 : 13, padding:'5px 4px',
        color: highlight ? '#fff' : dim ? 'var(--ink-3)' : 'var(--ink-1)'}}>
        {value != null ? fmtAUD(value) : '-'}
      </td>
    </tr>
  );

  return (
    <>
      {/* Notice */}
      <div style={{background:'#fff8e1', border:'1px solid #f0d97c', borderRadius:6, padding:'10px 16px', marginBottom:20, fontSize:12, color:'#7a5d10'}}>
        <strong>Worksheet only, not an official ATO form.</strong> Use these figures as a reference when lodging your BAS via myGov Business Portal or with your registered BAS agent.
        Once you register for GST, you'll be assigned a BAS lodgement schedule (usually quarterly for small businesses).
      </div>

      {/* Period selector */}
      <div className="card" style={{padding:'18px 22px', marginBottom:20}}>
        <div style={{display:'flex', gap:12, flexWrap:'wrap', alignItems:'flex-end'}}>
          <div>
            <div className="label" style={{marginBottom:6}}>BAS Period</div>
            <div className="tabs">
              {BAS_PRESETS.map((p, i) => (
                <div key={i} role="button" tabIndex={0} className={`tab${preset===i?' active':''}`}
                  onClick={() => applyPreset(i)}
                  onKeyDown={e => { if (e.key==='Enter'||e.key===' ') applyPreset(i); }}
                  style={{cursor:'pointer'}}>
                  {p.label}
                </div>
              ))}
            </div>
          </div>
          {preset === BAS_PRESETS.length - 1 && (<>
            <label className="field" style={{margin:0}}>
              <span className="label">From</span>
              <input className="input" type="date" value={from} onChange={e => setFrom(e.target.value)} />
            </label>
            <label className="field" style={{margin:0}}>
              <span className="label">To</span>
              <input className="input" type="date" value={to} onChange={e => setTo(e.target.value)} />
            </label>
          </>)}
          <button className="btn btn-rust" onClick={() => loadBAS()} disabled={loading}>
            {loading ? 'Loading…' : 'Calculate'}
          </button>
          {data && (
            <button className="btn" style={{background:'#003087', color:'#fff'}} onClick={exportPdf}>
              <Icon name="download" size={13}/> Export BAS PDF
            </button>
          )}
        </div>
        {error && <div className="mono" style={{color:'var(--rust)', fontSize:12, marginTop:8}}>{error}</div>}
        {data && <div className="mono" style={{fontSize:11, color:'var(--ink-3)', marginTop:8}}>Period: {fmtDateLabel(data.from)} – {fmtDateLabel(data.to)}</div>}
      </div>

      {loading && <div className="mono" style={{color:'var(--ink-3)', textAlign:'center', padding:40}}>Calculating…</div>}

      {data && <>
        {/* Summary tiles */}
        <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(160px, 1fr))', gap:14, marginBottom:20}}>
          {[
            { label:'TOTAL SALES (G1)',   value: fmtAUD(data.G1),    color:'#345526' },
            { label:'TAXABLE SALES (G5)', value: fmtAUD(data.G5),    color:'#345526' },
            { label:'GST ON SALES (1A)',  value: fmtAUD(data.box1A), color:'#003087' },
            { label:'GST CREDITS (1B)',   value: fmtAUD(data.box1B), color:'#345526' },
            { label: data.netGST >= 0 ? 'NET GST PAYABLE' : 'NET GST REFUND',
              value: fmtAUD(Math.abs(data.netGST)),
              color: data.netGST >= 0 ? 'var(--rust)' : '#345526' },
          ].map(t => (
            <div key={t.label} className="card" style={{padding:'14px 16px'}}>
              <div className="mono" style={{fontSize:10, color:'var(--ink-3)', marginBottom:4}}>{t.label}</div>
              <div className="mono" style={{fontSize:17, fontWeight:700, color:t.color}}>{t.value}</div>
            </div>
          ))}
        </div>

        {/* G-label table */}
        <div className="card" style={{padding:'18px 22px', marginBottom:16}}>
          <div className="mono" style={{fontSize:11, fontWeight:700, color:'var(--rust)', marginBottom:12, letterSpacing:1}}>GST ON SALES</div>
          <table style={{width:'100%', borderCollapse:'collapse'}}>
            <tbody>
              <GRow code="G1" label="Total sales (all revenue, including GST where applicable)" value={data.G1} />
              <GRow code="G2" label="Export sales (GST-free)" value={data.G2} dim={data.G2===0} />
              <GRow code="G3" label="Other GST-free sales" value={data.G3} dim={data.G3===0} />
              <GRow code="G4" label="Input-taxed sales" value={data.G4} dim={data.G4===0} />
              <GRow code="G5" label="G1 minus (G2 + G3 + G4)  -  Taxable sales" value={data.G5} bold shade />
              <tr><td colSpan={3} style={{padding:4}}></td></tr>
              <GRow code="1A" label="GST on sales  =  G5 ÷ 11" value={data.box1A} highlight bold />
            </tbody>
          </table>

          <div className="mono" style={{fontSize:11, fontWeight:700, color:'var(--rust)', margin:'20px 0 12px', letterSpacing:1}}>GST CREDITS ON PURCHASES</div>
          <table style={{width:'100%', borderCollapse:'collapse'}}>
            <tbody>
              <GRow code="G10" label="Capital purchases (tools & equipment)" value={data.G10} dim={data.G10===0} />
              <GRow code="G11" label="Non-capital purchases (parts, software, other)" value={data.G11} dim={data.G11===0} />
              <GRow code="G6"  label="Total purchases  (G10 + G11)" value={data.G6} bold shade />
              <tr><td colSpan={3} style={{padding:4}}></td></tr>
              <GRow code="1B" label="GST credits  =  G6 ÷ 11" value={data.box1B} highlight bold />
            </tbody>
          </table>

          <div style={{margin:'16px 0 8px', borderTop:'2px solid var(--border)', paddingTop:12}}>
            <table style={{width:'100%', borderCollapse:'collapse'}}>
              <tbody>
                <tr style={{background: data.netGST >= 0 ? '#fbe9e4' : '#eaf3ea', borderRadius:4}}>
                  <td style={{padding:'8px 8px', fontWeight:700, fontSize:12, color:'#777', width:36, fontFamily:'monospace'}}>9</td>
                  <td style={{padding:'8px 0', fontWeight:700, fontSize:14, color: data.netGST>=0 ? 'var(--rust)' : '#2e7d32'}}>
                    {data.netGST >= 0 ? 'Net GST payable  (1A minus 1B)' : 'Net GST refundable  (1B minus 1A)'}
                  </td>
                  <td style={{textAlign:'right', fontFamily:'monospace', fontWeight:700, fontSize:16,
                    color: data.netGST>=0 ? 'var(--rust)' : '#2e7d32', paddingRight:4}}>
                    {fmtAUD(Math.abs(data.netGST))}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* PAYG */}
        <div className="card" style={{padding:'14px 22px', marginBottom:16, background:'var(--bg-deep)'}}>
          <div className="mono" style={{fontSize:11, fontWeight:700, color:'var(--ink-3)', marginBottom:6, letterSpacing:1}}>PAYG WITHHOLDING</div>
          <div style={{fontSize:13, color:'var(--ink-3)'}}>W1 / W2 - No employees · not applicable</div>
        </div>

        {/* Assumptions */}
        <div style={{fontSize:11, color:'var(--ink-3)', lineHeight:1.6, padding:'4px 2px'}}>
          <strong style={{color:'var(--ink-2)'}}>Assumptions: </strong>
          G1 includes all shop orders and completed repair jobs, net of refunds.
          All sales treated as fully taxable (G5 = G1), adjust G2/G3/G4 if you have export or GST-free sales.
          Tools & equipment expenses mapped to G10 (capital); all other categories to G11 (non-capital).
          All purchases assumed GST-inclusive, exclude purchases from unregistered sellers.
        </div>
      </>}
    </>
  );
}

function GSTTrackerView() {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    setLoading(true);
    fetch('/api/admin/gst-threshold', { credentials:'include' })
      .then(r => r.ok ? r.json() : null).then(d => { setData(d); setLoading(false); }).catch(()=>setLoading(false));
  }, []);

  const fmtAUD = n => `$${(Number(n)||0).toLocaleString('en-AU',{minimumFractionDigits:0,maximumFractionDigits:0})}`;
  const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const fmtMonthLabel = s => { const [yr,mo] = s.split('-'); return `${monthNames[parseInt(mo)-1]} ${yr.slice(2)}`; };

  if (loading) return <div className="mono" style={{textAlign:'center', padding:40, color:'var(--ink-3)'}}>Loading…</div>;
  if (!data) return null;

  const pct    = Math.min(200, data.pct);
  const barW   = Math.min(100, pct);
  const status = data.rolling12 >= data.threshold ? 'THRESHOLD EXCEEDED' : data.rolling12 >= data.threshold * 0.9 ? 'APPROACHING LIMIT' : data.rolling12 >= data.threshold * 0.75 ? 'GETTING CLOSE' : 'UNDER THRESHOLD';
  const statusColor = data.rolling12 >= data.threshold ? '#c62828' : data.rolling12 >= data.threshold * 0.9 ? '#e65100' : data.rolling12 >= data.threshold * 0.75 ? '#c67c00' : '#2e7d32';
  const maxMonthRev = Math.max(...data.months.map(m => m.revenue), 1);

  return (
    <>
      {/* Status card */}
      <div className="card" style={{padding:'22px 28px', marginBottom:20, borderLeft:`4px solid ${statusColor}`}}>
        <div style={{display:'flex', alignItems:'flex-start', justifyContent:'space-between', flexWrap:'wrap', gap:16}}>
          <div>
            <div className="mono" style={{fontSize:11, color:statusColor, fontWeight:700, letterSpacing:1, marginBottom:6}}>{status}</div>
            <div className="mono" style={{fontSize:28, fontWeight:700, color:statusColor}}>{fmtAUD(data.rolling12)}</div>
            <div style={{fontSize:12, color:'var(--ink-3)', marginTop:4}}>rolling 12-month GST turnover · threshold {fmtAUD(data.threshold)}</div>
          </div>
          <div style={{textAlign:'right'}}>
            <div className="mono" style={{fontSize:13, color:'var(--ink-2)'}}>{data.pct}% of threshold</div>
            <div style={{fontSize:11, color:'var(--ink-3)', marginTop:4}}>{fmtAUD(data.threshold - data.rolling12 > 0 ? data.threshold - data.rolling12 : 0)} remaining</div>
          </div>
        </div>
        <div style={{marginTop:16}}>
          <div style={{position:'relative', height:12, background:'var(--border)', borderRadius:6, overflow:'hidden'}}>
            <div style={{position:'absolute', left:0, top:0, height:'100%', width:`${barW}%`, background:statusColor, borderRadius:6, transition:'width 0.4s'}} />
            <div style={{position:'absolute', left:'calc(100% * 0.75)', top:'-2px', height:16, width:2, background:'#c67c00', opacity:0.7}} />
            <div style={{position:'absolute', left:'calc(100% * 0.9)', top:'-2px', height:16, width:2, background:'#e65100', opacity:0.7}} />
          </div>
          <div style={{display:'flex', justifyContent:'space-between', fontSize:10, color:'var(--ink-3)', marginTop:4}}>
            <span>$0</span><span style={{color:'#c67c00'}}>$56k</span><span style={{color:'#e65100'}}>$67.5k</span><span style={{color:'#c62828'}}>$75k</span>
          </div>
        </div>
      </div>

      {data.rolling12 >= data.threshold && (
        <div style={{background:'#ffebee', border:'1px solid #ef9a9a', borderRadius:6, padding:'12px 18px', marginBottom:20, fontSize:13, color:'#c62828'}}>
          <strong>Action required:</strong> Your rolling 12-month turnover has met or exceeded $75,000. You must register for GST within 21 days.
          Register at <strong>business.gov.au</strong> or through your registered tax agent.
        </div>
      )}

      {/* Bar chart */}
      <div className="card" style={{padding:'18px 22px', marginBottom:16}}>
        <div className="mono" style={{fontSize:11, fontWeight:700, color:'var(--rust)', marginBottom:16, letterSpacing:1}}>MONTHLY REVENUE - LAST 12 MONTHS</div>
        <div style={{display:'flex', alignItems:'flex-end', gap:6, height:120, padding:'0 4px'}}>
          {data.months.map(m => {
            const h = Math.round((m.revenue / maxMonthRev) * 100);
            return (
              <div key={m.month} style={{flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:4}}>
                <div className="mono" style={{fontSize:9, color:'var(--ink-3)'}}>{m.revenue > 0 ? fmtAUD(m.revenue) : ''}</div>
                <div style={{width:'100%', height:`${Math.max(2, h)}%`, background:'var(--rust)', borderRadius:'3px 3px 0 0', minHeight:2, opacity:0.8}} />
                <div className="mono" style={{fontSize:9, color:'var(--ink-3)', whiteSpace:'nowrap'}}>{fmtMonthLabel(m.month)}</div>
              </div>
            );
          })}
        </div>
      </div>

      <div style={{fontSize:11, color:'var(--ink-3)'}}>
        GST turnover = gross business income, excluding GST (which doesn't apply while unregistered).
        The ATO checks any consecutive 12-month period, past or projected. Voluntarily register earlier if clients need tax invoices.
      </div>
    </>
  );
}

function YoYView() {
  const now = new Date();
  const defaultFy = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;
  const [fy, setFy]       = useState(defaultFy);
  const [data, setData]   = useState(null);
  const [loading, setLoading] = useState(false);

  const load = (fyYear) => {
    setLoading(true); setData(null);
    fetch(`/api/admin/yoy-report?fy=${fyYear}`, { credentials:'include' })
      .then(r => r.ok ? r.json() : null).then(d => { setData(d); setLoading(false); }).catch(()=>setLoading(false));
  };
  useEffect(() => { load(defaultFy); }, []);

  const fmtAUD = n => `$${(Number(n)||0).toLocaleString('en-AU',{minimumFractionDigits:2,maximumFractionDigits:2})}`;
  const pct = (a, b) => { if (!b) return null; const p = ((a-b)/b)*100; return { val: p, label: `${p>=0?'+':''}${p.toFixed(1)}%`, color: p>=0?'#2e7d32':'var(--rust)' }; };

  const FY_OPTIONS = [defaultFy, defaultFy-1, defaultFy-2];

  return (
    <>
      <div className="card" style={{padding:'14px 22px', marginBottom:20, display:'flex', alignItems:'center', gap:16}}>
        <div className="label" style={{marginBottom:0}}>Compare</div>
        <div className="tabs">
          {FY_OPTIONS.map(y => (
            <div key={y} role="button" tabIndex={0} className={`tab${fy===y?' active':''}`} style={{cursor:'pointer'}}
              onClick={() => { setFy(y); load(y); }}
              onKeyDown={e => { if (e.key==='Enter'||e.key===' ') { setFy(y); load(y); } }}>
              FY {y}–{String(y+1).slice(2)} vs {y-1}–{String(y).slice(2)}
            </div>
          ))}
        </div>
        {loading && <span className="mono" style={{fontSize:12, color:'var(--ink-3)'}}>Loading…</span>}
      </div>

      {data && (() => {
        const c = data.curr, p = data.prev;
        const rows = [
          { label:'Total Revenue',   curr:c.totalRevenue,   prev:p.totalRevenue,   pos:true },
          { label:'Order Revenue',   curr:c.netOrderRevenue,prev:p.netOrderRevenue, pos:true },
          { label:'Repair Revenue',  curr:c.repairRevenue,  prev:p.repairRevenue,   pos:true },
          { label:'Total Expenses',  curr:c.totalExpenses,  prev:p.totalExpenses,   pos:false },
          { label:'Net Profit',      curr:c.grossProfit,    prev:p.grossProfit,     pos:true, bold:true },
          { label:'Estimated Tax',   curr:(c.taxEstimate||{}).totalTax, prev:(p.taxEstimate||{}).totalTax, pos:false },
          { label:'Orders',          curr:c.orderCount,     prev:p.orderCount,      pos:true,  money:false },
          { label:'Repair Jobs',     curr:c.repairCount,    prev:p.repairCount,     pos:true,  money:false },
        ];
        return (
          <div className="card" style={{padding:'18px 22px'}}>
            <table style={{width:'100%', borderCollapse:'collapse', fontSize:13}}>
              <thead>
                <tr style={{borderBottom:'2px solid var(--border)'}}>
                  <th style={{textAlign:'left',  padding:'4px 0', fontWeight:600, color:'var(--ink-2)', fontSize:11, width:'40%'}}>&nbsp;</th>
                  <th style={{textAlign:'right', padding:'4px 0', fontWeight:600, color:'var(--ink-2)', fontSize:11}}>FY {data.fyYear}–{String(data.fyYear+1).slice(2)}</th>
                  <th style={{textAlign:'right', padding:'4px 0', fontWeight:600, color:'var(--ink-2)', fontSize:11}}>FY {data.fyYear-1}–{String(data.fyYear).slice(2)}</th>
                  <th style={{textAlign:'right', padding:'4px 0', fontWeight:600, color:'var(--ink-2)', fontSize:11}}>Change</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r,i) => {
                  const ch = pct(r.curr, r.prev);
                  const money = r.money !== false;
                  const chColor = ch ? (((r.pos && ch.val>=0)||(!r.pos&&ch.val<=0)) ? '#2e7d32' : 'var(--rust)') : 'var(--ink-3)';
                  return (
                    <tr key={r.label} style={{background: i%2===1?'var(--bg-deep)':'transparent', fontWeight:r.bold?700:400}}>
                      <td style={{padding:'7px 0', color: r.bold?'var(--ink-1)':'var(--ink-2)'}}>{r.label}</td>
                      <td style={{textAlign:'right', fontFamily:'monospace', color: r.bold?(r.curr>=0?'#345526':'var(--rust)'):'var(--ink-1)'}}>{money ? fmtAUD(r.curr) : (r.curr||0)}</td>
                      <td style={{textAlign:'right', fontFamily:'monospace', color:'var(--ink-3)'}}>{money ? fmtAUD(r.prev) : (r.prev||0)}</td>
                      <td style={{textAlign:'right', fontFamily:'monospace', fontSize:12, color:chColor}}>{ch ? ch.label : '-'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        );
      })()}
    </>
  );
}

function CashFlowView() {
  const now = new Date();
  const currentFyYear = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;
  const FY_PRESETS = [
    { label:`FY ${currentFyYear}–${String(currentFyYear+1).slice(2)}`, from:`${currentFyYear}-07-01`, to:`${currentFyYear+1}-06-30` },
    { label:`FY ${currentFyYear-1}–${String(currentFyYear).slice(2)}`, from:`${currentFyYear-1}-07-01`, to:`${currentFyYear}-06-30` },
    { label:'Custom', from:'', to:'' },
  ];
  const [preset, setPreset] = useState(0);
  const [from, setFrom]     = useState(FY_PRESETS[0].from);
  const [to, setTo]         = useState(FY_PRESETS[0].to);
  const [data, setData]     = useState(null);
  const [opening, setOpening] = useState('');
  const [loading, setLoading] = useState(false);

  const load = (f=from, t=to) => {
    if (!f||!t) return;
    setLoading(true); setData(null);
    fetch(`/api/admin/tax-report?from=${f}&to=${t}`, { credentials:'include' })
      .then(r => r.ok ? r.json() : null).then(d => { setData(d); setLoading(false); }).catch(()=>setLoading(false));
  };
  useEffect(() => { load(FY_PRESETS[0].from, FY_PRESETS[0].to); }, []);

  const fmtAUD = n => `$${(Number(n)||0).toLocaleString('en-AU',{minimumFractionDigits:2,maximumFractionDigits:2})}`;
  const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const applyPreset = i => { setPreset(i); if (i < FY_PRESETS.length-1) { setFrom(FY_PRESETS[i].from); setTo(FY_PRESETS[i].to); } };
  const openingBal = Number(opening) || 0;

  return (
    <>
      <div className="card" style={{padding:'18px 22px', marginBottom:20}}>
        <div style={{display:'flex', gap:12, flexWrap:'wrap', alignItems:'flex-end'}}>
          <div>
            <div className="label" style={{marginBottom:6}}>Period</div>
            <div className="tabs">
              {FY_PRESETS.map((p,i) => (
                <div key={i} role="button" tabIndex={0} className={`tab${preset===i?' active':''}`} style={{cursor:'pointer'}}
                  onClick={() => applyPreset(i)} onKeyDown={e => { if(e.key==='Enter'||e.key===' ') applyPreset(i); }}>{p.label}</div>
              ))}
            </div>
          </div>
          {preset===2 && (<>
            <label className="field" style={{margin:0}}><span className="label">From</span><input className="input" type="date" value={from} onChange={e=>setFrom(e.target.value)}/></label>
            <label className="field" style={{margin:0}}><span className="label">To</span><input className="input" type="date" value={to} onChange={e=>setTo(e.target.value)}/></label>
          </>)}
          <label className="field" style={{margin:0}}>
            <span className="label">Opening balance ($)</span>
            <input className="input" type="number" step="0.01" placeholder="0.00" value={opening} onChange={e=>setOpening(e.target.value)} style={{width:110}} />
          </label>
          <button className="btn btn-rust" onClick={() => load()} disabled={loading}>{loading?'Loading…':'Generate'}</button>
        </div>
      </div>

      {loading && <div className="mono" style={{textAlign:'center', padding:40, color:'var(--ink-3)'}}>Loading…</div>}

      {data && (() => {
        let running = openingBal;
        const rows = data.monthly.map(m => {
          const net = m.revenue - m.expenses;
          running += net;
          return { ...m, net, balance: running };
        });
        const maxAbs = Math.max(...rows.map(r => Math.max(r.revenue, r.expenses)), 1);

        return (<>
          {/* Bar chart */}
          <div className="card" style={{padding:'18px 22px', marginBottom:16}}>
            <div className="mono" style={{fontSize:11, fontWeight:700, color:'var(--rust)', marginBottom:16, letterSpacing:1}}>MONTHLY CASH FLOW</div>
            <div style={{display:'flex', gap:4, alignItems:'flex-end', height:130}}>
              {rows.map(r => {
                const [yr,mo] = r.month.split('-');
                const inH  = Math.round((r.revenue  / maxAbs) * 100);
                const outH = Math.round((r.expenses / maxAbs) * 100);
                return (
                  <div key={r.month} style={{flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:2}}>
                    <div style={{width:'100%', display:'flex', gap:1, alignItems:'flex-end', height:110}}>
                      <div style={{flex:1, height:`${Math.max(1,inH)}%`, background:'#345526', borderRadius:'2px 2px 0 0', opacity:0.85}} title={`Revenue: ${fmtAUD(r.revenue)}`} />
                      <div style={{flex:1, height:`${Math.max(1,outH)}%`, background:'var(--rust)', borderRadius:'2px 2px 0 0', opacity:0.75}} title={`Expenses: ${fmtAUD(r.expenses)}`} />
                    </div>
                    <div className="mono" style={{fontSize:9, color:'var(--ink-3)'}}>{monthNames[parseInt(mo)-1]}</div>
                  </div>
                );
              })}
            </div>
            <div style={{display:'flex', gap:16, marginTop:8, fontSize:11}}>
              <span><span style={{display:'inline-block',width:10,height:10,background:'#345526',borderRadius:2,marginRight:4}} />Cash in</span>
              <span><span style={{display:'inline-block',width:10,height:10,background:'var(--rust)',borderRadius:2,marginRight:4}} />Cash out</span>
            </div>
          </div>

          {/* Table */}
          <div className="card" style={{padding:'18px 22px'}}>
            <table style={{width:'100%', borderCollapse:'collapse', fontSize:13}}>
              <thead>
                <tr style={{borderBottom:'2px solid var(--border)'}}>
                  {['Month','Cash In','Cash Out','Net','Running Balance'].map(h => (
                    <th key={h} style={{textAlign:h==='Month'?'left':'right', padding:'4px 0', fontWeight:600, color:'var(--ink-2)', fontSize:11}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r,i) => {
                  const [yr,mo] = r.month.split('-');
                  return (
                    <tr key={r.month} style={{background:i%2===1?'var(--bg-deep)':'transparent'}}>
                      <td style={{padding:'6px 0'}}>{monthNames[parseInt(mo)-1]} {yr}</td>
                      <td style={{textAlign:'right', fontFamily:'monospace', color:'#345526'}}>{fmtAUD(r.revenue)}</td>
                      <td style={{textAlign:'right', fontFamily:'monospace', color:'var(--rust)'}}>({fmtAUD(r.expenses)})</td>
                      <td style={{textAlign:'right', fontFamily:'monospace', fontWeight:600, color:r.net>=0?'#345526':'var(--rust)'}}>{fmtAUD(r.net)}</td>
                      <td style={{textAlign:'right', fontFamily:'monospace', color:r.balance>=0?'var(--ink-1)':'var(--rust)'}}>{fmtAUD(r.balance)}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr style={{borderTop:'2px solid var(--border)'}}>
                  <td style={{padding:'8px 0', fontWeight:700}}>Total</td>
                  <td style={{textAlign:'right', fontFamily:'monospace', fontWeight:700, color:'#345526'}}>{fmtAUD(data.totalRevenue)}</td>
                  <td style={{textAlign:'right', fontFamily:'monospace', fontWeight:700, color:'var(--rust)'}}>({fmtAUD(data.totalExpenses)})</td>
                  <td style={{textAlign:'right', fontFamily:'monospace', fontWeight:700, color:data.grossProfit>=0?'#345526':'var(--rust)'}}>{fmtAUD(data.grossProfit)}</td>
                  <td style={{textAlign:'right', fontFamily:'monospace', fontWeight:700}}>{fmtAUD(openingBal + data.grossProfit)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </>);
      })()}
    </>
  );
}

function VehicleLogView() {
  const now = new Date();
  const defaultFy = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;
  const [fy, setFy]           = useState(defaultFy);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm]       = useState({ date:'', from:'', to:'', km:'', purpose:'' });
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState(null);

  const KM_RATES = { 2021:0.72, 2022:0.78, 2023:0.85, 2024:0.88, 2025:0.88 };
  const rate = KM_RATES[fy] || 0.88;
  const fmtAUD = n => `$${(Number(n)||0).toLocaleString('en-AU',{minimumFractionDigits:2,maximumFractionDigits:2})}`;

  const load = () => {
    setLoading(true);
    fetch('/api/admin/vehicle-log', { credentials:'include' })
      .then(r => r.ok ? r.json() : {entries:[]})
      .then(d => { setEntries(d.entries||[]); setLoading(false); })
      .catch(()=>setLoading(false));
  };
  useEffect(load, []);

  const fyEntries = entries.filter(e => {
    const d = e.date ? new Date(e.date) : null;
    return d && d >= new Date(`${fy}-07-01`) && d <= new Date(`${fy+1}-06-30T23:59:59`);
  }).sort((a,b) => a.date < b.date ? -1 : 1);

  const totalKm = fyEntries.reduce((s,e) => s + (Number(e.km)||0), 0);
  const cappedKm = Math.min(5000, totalKm);
  const deduction = cappedKm * rate;

  const addEntry = async () => {
    if (!form.date || !form.km) { setError('Date and km are required.'); return; }
    setSaving(true); setError(null);
    const csrf = getCsrf();
    const r = await fetch('/api/admin/vehicle-log/add', {
      method:'POST', credentials:'include',
      headers:{'Content-Type':'application/json','X-CSRF-Token':csrf||''},
      body: JSON.stringify({ ...form, km: Number(form.km) }),
    }).catch(()=>null);
    setSaving(false);
    if (!r||!r.ok) { setError('Failed to save.'); return; }
    setForm({ date:'', from:'', to:'', km:'', purpose:'' });
    load();
  };

  const deleteEntry = async (id) => {
    if (!(await adminConfirm('Delete this trip?', { title:'Delete trip', confirmLabel:'Delete', danger:true }))) return;
    const csrf = getCsrf();
    await fetch('/api/admin/vehicle-log/delete', {
      method:'POST', credentials:'include',
      headers:{'Content-Type':'application/json','X-CSRF-Token':csrf||''},
      body: JSON.stringify({ id }),
    });
    load();
  };

  const exportPdf = () => window.open(`/api/admin/vehicle-log/pdf?fy=${fy}`, '_blank');

  const FY_OPTIONS = [defaultFy, defaultFy-1, defaultFy-2];
  const fmtDate = s => s ? new Date(s+'T00:00:00').toLocaleDateString('en-AU',{day:'numeric',month:'short',year:'numeric'}) : '-';

  return (
    <>
      {/* FY selector + summary */}
      <div className="card" style={{padding:'18px 22px', marginBottom:20}}>
        <div style={{display:'flex', alignItems:'center', gap:16, flexWrap:'wrap', marginBottom:16}}>
          <div>
            <div className="label" style={{marginBottom:6}}>Financial Year</div>
            <div className="tabs">
              {FY_OPTIONS.map(y => (
                <div key={y} role="button" tabIndex={0} className={`tab${fy===y?' active':''}`} style={{cursor:'pointer'}}
                  onClick={()=>setFy(y)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' ')setFy(y);}}>{y}–{String(y+1).slice(2)}</div>
              ))}
            </div>
          </div>
          <button className="btn" style={{background:'#345526',color:'#fff'}} onClick={exportPdf}><Icon name="download" size={13}/> Export PDF</button>
        </div>
        <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))', gap:12}}>
          {[
            {label:'TRIPS THIS FY', val:fyEntries.length, money:false},
            {label:'TOTAL KM', val:`${totalKm.toFixed(1)} km`, money:false},
            {label:`ATO RATE (${fy}–${String(fy+1).slice(2)})`, val:`${(rate*100).toFixed(0)}c/km`, money:false},
            {label:'ESTIMATED DEDUCTION', val:fmtAUD(deduction), color:'#345526'},
          ].map(t => (
            <div key={t.label} style={{padding:'12px 14px', background:'var(--bg-deep)', borderRadius:6}}>
              <div className="mono" style={{fontSize:10, color:'var(--ink-3)', marginBottom:4}}>{t.label}</div>
              <div className="mono" style={{fontSize:16, fontWeight:700, color:t.color||'var(--ink-1)'}}>{t.val}</div>
            </div>
          ))}
        </div>
        {totalKm > 5000 && (
          <div style={{background:'#fff8e1', border:'1px solid #f0d97c', borderRadius:5, padding:'8px 12px', marginTop:12, fontSize:12, color:'#7a5d10'}}>
            <strong>Over 5,000 km:</strong> The cents-per-km method is capped at 5,000 km. A logbook kept for 12 continuous weeks may allow you to claim more, talk to your tax agent.
          </div>
        )}
      </div>

      {/* Add trip form */}
      <div className="card" style={{padding:'18px 22px', marginBottom:20}}>
        <div className="mono" style={{fontSize:11, fontWeight:700, color:'var(--rust)', marginBottom:14, letterSpacing:1}}>LOG A TRIP</div>
        <div style={{display:'grid', gridTemplateColumns:'140px 1fr 1fr 80px 1fr auto', gap:10, alignItems:'flex-end', flexWrap:'wrap'}}>
          <label className="field" style={{margin:0}}><span className="label">Date</span>
            <input className="input" type="date" value={form.date} onChange={e=>setForm(f=>({...f,date:e.target.value}))} /></label>
          <label className="field" style={{margin:0}}><span className="label">From</span>
            <input className="input" placeholder="Workshop" value={form.from} onChange={e=>setForm(f=>({...f,from:e.target.value}))} /></label>
          <label className="field" style={{margin:0}}><span className="label">To</span>
            <input className="input" placeholder="Parts supplier" value={form.to} onChange={e=>setForm(f=>({...f,to:e.target.value}))} /></label>
          <label className="field" style={{margin:0}}><span className="label">km</span>
            <input className="input" type="number" step="0.1" min="0" placeholder="12.5" value={form.km} onChange={e=>setForm(f=>({...f,km:e.target.value}))} /></label>
          <label className="field" style={{margin:0}}><span className="label">Purpose</span>
            <input className="input" placeholder="Pick up capacitors for J-123" value={form.purpose} onChange={e=>setForm(f=>({...f,purpose:e.target.value}))} /></label>
          <button className="btn btn-rust btn-sm" onClick={addEntry} disabled={saving} style={{whiteSpace:'nowrap', marginBottom:1}}>{saving?'Saving…':'Add Trip'}</button>
        </div>
        {error && <div className="mono" style={{color:'var(--rust)', fontSize:12, marginTop:8}}>{error}</div>}
      </div>

      {/* Trip table */}
      {loading ? <div className="mono" style={{textAlign:'center', padding:40, color:'var(--ink-3)'}}>Loading…</div> : fyEntries.length === 0 ? (
        <div className="card" style={{padding:'32px 22px', textAlign:'center', color:'var(--ink-3)'}}>No trips logged for FY {fy}–{String(fy+1).slice(2)}.</div>
      ) : (
        <div className="card" style={{padding:'18px 22px'}}>
          <div className="mono" style={{fontSize:11, fontWeight:700, color:'var(--rust)', marginBottom:12, letterSpacing:1}}>TRIPS - FY {fy}–{String(fy+1).slice(2)}</div>
          <table style={{width:'100%', borderCollapse:'collapse', fontSize:13}}>
            <thead>
              <tr style={{borderBottom:'2px solid var(--border)'}}>
                {['Date','From','To','km','Purpose',''].map(h => (
                  <th key={h} style={{textAlign:h==='km'?'right':'left', padding:'4px 0', fontWeight:600, color:'var(--ink-2)', fontSize:11}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {fyEntries.map((e,i) => (
                <tr key={e.id} style={{background:i%2===1?'var(--bg-deep)':'transparent'}}>
                  <td style={{padding:'6px 0', fontFamily:'monospace', fontSize:11}}>{fmtDate(e.date)}</td>
                  <td style={{padding:'6px 0'}}>{e.from||'-'}</td>
                  <td style={{padding:'6px 0'}}>{e.to||'-'}</td>
                  <td style={{textAlign:'right', fontFamily:'monospace'}}>{(Number(e.km)||0).toFixed(1)}</td>
                  <td style={{padding:'6px 0', color:'var(--ink-2)'}}>{e.purpose||'-'}</td>
                  <td style={{textAlign:'right'}}>
                    <button className="btn" style={{padding:'2px 8px', fontSize:11, color:'var(--rust)', background:'transparent', border:'none', cursor:'pointer'}} onClick={() => deleteEntry(e.id)}><Icon name="x" size={12}/></button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{borderTop:'2px solid var(--border)'}}>
                <td colSpan={3} style={{padding:'8px 0', fontWeight:700}}>Total</td>
                <td style={{textAlign:'right', fontFamily:'monospace', fontWeight:700}}>{totalKm.toFixed(1)}</td>
                <td colSpan={2} style={{textAlign:'right', fontFamily:'monospace', color:'#345526', fontWeight:700}}>≈ {fmtAUD(deduction)} deduction</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </>
  );
}

function HomeOfficeView() {
  const [method, setMethod] = useState('fixed');
  // Fixed rate method (67c/hour from 1 July 2022)
  const [hoursPerWeek, setHoursPerWeek] = useState('');
  const [weeksPerYear, setWeeksPerYear] = useState('48');
  // Floor area method
  const [homeArea, setHomeArea]       = useState('');
  const [officeArea, setOfficeArea]   = useState('');
  const [annualCosts, setAnnualCosts] = useState('');

  const fmtAUD = n => `$${(Number(n)||0).toLocaleString('en-AU',{minimumFractionDigits:2,maximumFractionDigits:2})}`;

  const fixedResult   = Number(hoursPerWeek) * Number(weeksPerYear) * 0.67;
  const floorAreaPct  = homeArea && officeArea ? (Number(officeArea) / Number(homeArea)) * 100 : 0;
  const floorResult   = (Number(annualCosts) * (floorAreaPct / 100));
  const betterMethod  = fixedResult >= floorResult ? 'fixed' : 'floor';

  return (
    <>
      <div style={{background:'#fff8e1', border:'1px solid #f0d97c', borderRadius:6, padding:'10px 16px', marginBottom:20, fontSize:12, color:'#7a5d10'}}>
        <strong>Estimate only.</strong> Record your actual hours with a diary for 4 representative weeks under the fixed rate method.
        Consult a registered tax agent to confirm the best method for your situation.
      </div>

      <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:20, marginBottom:20}}>
        {/* Fixed Rate Method */}
        <div className="card" style={{padding:'22px', outline: method==='fixed'?'2px solid var(--rust)':undefined}}>
          <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16}}>
            <div className="mono" style={{fontSize:11, fontWeight:700, color:'var(--rust)', letterSpacing:1}}>FIXED RATE METHOD</div>
            <span style={{fontSize:10, background:'#345526', color:'#fff', borderRadius:10, padding:'2px 8px'}}>67c/hour</span>
          </div>
          <div style={{fontSize:12, color:'var(--ink-3)', marginBottom:14}}>
            Covers electricity, internet, stationery, and minor equipment. Does not include occupancy costs (rent/mortgage interest).
          </div>
          <label className="field"><span className="label">Hours/week worked from home</span>
            <input className="input" type="number" min="0" max="168" step="0.5" placeholder="25"
              value={hoursPerWeek} onChange={e=>setHoursPerWeek(e.target.value)} /></label>
          <label className="field"><span className="label">Weeks worked (default 48)</span>
            <input className="input" type="number" min="0" max="52" step="1" placeholder="48"
              value={weeksPerYear} onChange={e=>setWeeksPerYear(e.target.value)} /></label>
          {fixedResult > 0 && (
            <div style={{background: betterMethod==='fixed'?'#eaf3ea':'var(--bg-deep)', borderRadius:6, padding:'14px', marginTop:8, textAlign:'center'}}>
              <div className="mono" style={{fontSize:10, color:'var(--ink-3)', marginBottom:4}}>ESTIMATED DEDUCTION</div>
              <div className="mono" style={{fontSize:24, fontWeight:700, color:'#345526'}}>{fmtAUD(fixedResult)}</div>
              <div style={{fontSize:11, color:'var(--ink-3)', marginTop:4}}>{hoursPerWeek} hrs × {weeksPerYear} wks × 67c</div>
              {betterMethod==='fixed' && <div style={{fontSize:11, fontWeight:700, color:'#345526', marginTop:4}}>HIGHER DEDUCTION</div>}
            </div>
          )}
        </div>

        {/* Floor Area Method */}
        <div className="card" style={{padding:'22px', outline: method==='floor'?'2px solid var(--rust)':undefined}}>
          <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16}}>
            <div className="mono" style={{fontSize:11, fontWeight:700, color:'var(--rust)', letterSpacing:1}}>FLOOR AREA METHOD</div>
            <span style={{fontSize:10, background:'#555', color:'#fff', borderRadius:10, padding:'2px 8px'}}>% of costs</span>
          </div>
          <div style={{fontSize:12, color:'var(--ink-3)', marginBottom:14}}>
            Claim the business-use percentage of all running costs. Requires receipts for all expenses claimed.
          </div>
          <label className="field"><span className="label">Home total floor area (m²)</span>
            <input className="input" type="number" min="0" step="1" placeholder="120"
              value={homeArea} onChange={e=>setHomeArea(e.target.value)} /></label>
          <label className="field"><span className="label">Dedicated office area (m²)</span>
            <input className="input" type="number" min="0" step="0.5" placeholder="12"
              value={officeArea} onChange={e=>setOfficeArea(e.target.value)} /></label>
          <label className="field"><span className="label">Annual running costs ($), electricity, internet, etc.</span>
            <input className="input" type="number" min="0" step="1" placeholder="4000"
              value={annualCosts} onChange={e=>setAnnualCosts(e.target.value)} /></label>
          {floorAreaPct > 0 && annualCosts && (
            <div style={{background: betterMethod==='floor'?'#eaf3ea':'var(--bg-deep)', borderRadius:6, padding:'14px', marginTop:8, textAlign:'center'}}>
              <div className="mono" style={{fontSize:10, color:'var(--ink-3)', marginBottom:4}}>ESTIMATED DEDUCTION</div>
              <div className="mono" style={{fontSize:24, fontWeight:700, color:'#345526'}}>{fmtAUD(floorResult)}</div>
              <div style={{fontSize:11, color:'var(--ink-3)', marginTop:4}}>{floorAreaPct.toFixed(1)}% of ${Number(annualCosts).toLocaleString()}</div>
              {betterMethod==='floor' && <div style={{fontSize:11, fontWeight:700, color:'#345526', marginTop:4}}>HIGHER DEDUCTION</div>}
            </div>
          )}
        </div>
      </div>

      {(fixedResult > 0 || floorResult > 0) && (
        <div className="card" style={{padding:'16px 22px', background: betterMethod==='fixed'?'#eaf3ea':'#eaf3ea'}}>
          <div style={{fontSize:13}}>
            <strong>Recommended: {betterMethod==='fixed' ? 'Fixed Rate Method' : 'Floor Area Method'}</strong>
            {' '}gives you an estimated <strong style={{color:'#345526'}}>{fmtAUD(Math.max(fixedResult, floorResult))}</strong> deduction.
            {betterMethod==='fixed' && ' Remember to keep a 4-week representative diary to substantiate your hours.'}
            {betterMethod==='floor' && ' Keep all receipts for utilities and running costs.'}
          </div>
        </div>
      )}
    </>
  );
}

function ATODatesView() {
  const now = new Date();
  const todayStr = now.toISOString().slice(0,10);
  const fy = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;

  const dates = [
    // Q1 BAS + PAYG
    { due:`${fy}-10-28`, label:'Q1 BAS Lodge & Pay (Jul–Sep)',     cat:'GST',  gst:true },
    { due:`${fy}-10-28`, label:'Q1 PAYG Instalment (Jul–Sep)',      cat:'PAYG', payg:true },
    // Q2 BAS + PAYG
    { due:`${fy+1}-02-28`, label:'Q2 BAS Lodge & Pay (Oct–Dec)',    cat:'GST',  gst:true },
    { due:`${fy+1}-02-28`, label:'Q2 PAYG Instalment (Oct–Dec)',    cat:'PAYG', payg:true },
    // Q3 BAS + PAYG
    { due:`${fy+1}-04-28`, label:'Q3 BAS Lodge & Pay (Jan–Mar)',    cat:'GST',  gst:true },
    { due:`${fy+1}-04-28`, label:'Q3 PAYG Instalment (Jan–Mar)',    cat:'PAYG', payg:true },
    // Super personal contribution deadline
    { due:`${fy+1}-06-30`, label:'Personal super contributions - last day to contribute for FY deduction', cat:'Super' },
    // Tax return
    { due:`${fy+1}-10-31`, label:`Lodge income tax return FY${fy}–${String(fy+1).slice(2)} (self-lodging)`, cat:'Income Tax' },
    { due:`${fy+1}-05-15`, label:`Lodge via registered tax agent - extended deadline`, cat:'Income Tax' },
    // Q4 BAS + PAYG (next FY)
    { due:`${fy+1}-07-28`, label:'Q4 BAS Lodge & Pay (Apr–Jun)',    cat:'GST',  gst:true },
    { due:`${fy+1}-07-28`, label:'Q4 PAYG Instalment (Apr–Jun)',    cat:'PAYG', payg:true },
  ].sort((a,b) => a.due < b.due ? -1 : 1);

  const catColors = { 'GST':'#003087', 'PAYG':'#5e35b1', 'Income Tax':'var(--rust)', 'Super':'#345526' };
  const fmtDue = s => new Date(s+'T00:00:00').toLocaleDateString('en-AU',{weekday:'short',day:'numeric',month:'long',year:'numeric'});
  const daysUntil = s => Math.ceil((new Date(s+'T00:00:00') - now) / 86400000);
  const pastCount = dates.filter(d => d.due < todayStr).length;

  return (
    <>
      <div style={{background:'#fff8e1', border:'1px solid #f0d97c', borderRadius:6, padding:'10px 16px', marginBottom:20, fontSize:12, color:'#7a5d10'}}>
        <strong>FY {fy}–{String(fy+1).slice(2)} key dates.</strong> BAS and PAYG dates apply only if you are registered. GST/PAYG dates are shown for planning, they are greyed when not yet applicable.
        Always confirm exact due dates at <strong>ato.gov.au</strong> as dates may vary for weekends and public holidays.
      </div>

      <div style={{display:'flex', flexDirection:'column', gap:10}}>
        {dates.map((d,i) => {
          const days = daysUntil(d.due);
          const isPast = d.due < todayStr;
          const isSoon = !isPast && days <= 30;
          const isGstOrPayg = d.gst || d.payg;
          const bg    = isPast ? 'var(--bg-deep)' : isSoon ? '#fff8e1' : 'var(--bg-elev)';
          const border= isPast ? 'var(--border)' : isSoon ? '#f0d97c' : 'var(--border)';
          const opacity = isGstOrPayg ? 0.65 : 1;
          return (
            <div key={i} style={{display:'flex', alignItems:'center', gap:14, padding:'12px 16px',
              background:bg, border:`1px solid ${border}`, borderRadius:6, opacity}}>
              <div style={{width:6, height:36, background:catColors[d.cat]||'var(--rust)', borderRadius:3, flexShrink:0}} />
              <div style={{flex:1}}>
                <div style={{fontWeight:600, fontSize:13, color: isPast?'var(--ink-3)':'var(--ink-1)',
                  textDecoration: isPast?'line-through':'none'}}>{d.label}</div>
                <div style={{fontSize:11, color:'var(--ink-3)', marginTop:2}}>
                  <span className="mono" style={{marginRight:8}}>{fmtDue(d.due)}</span>
                  <span style={{background:catColors[d.cat]||'var(--rust)', color:'#fff', fontSize:9,
                    padding:'1px 6px', borderRadius:8, fontWeight:700}}>{d.cat}</span>
                  {isGstOrPayg && <span style={{marginLeft:6, fontSize:10, color:'var(--ink-3)'}}>when GST registered</span>}
                </div>
              </div>
              <div className="mono" style={{fontSize:12, fontWeight:700, textAlign:'right', flexShrink:0,
                color: isPast?'var(--ink-3)':isSoon?'#c67c00':'var(--ink-2)'}}>
                {isPast ? 'Passed' : days===0 ? 'TODAY' : `${days}d`}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

// ============================================================
// PAYMENT PLANS, cross-order dashboard
// ============================================================
function PaymentPlansView() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [runBusy, setRunBusy] = useState(false);
  const [runMsg, setRunMsg] = useState('');

  const load = async () => {
    setLoading(true); setError(null);
    const r = await fetch('/api/admin/payment-plans', { credentials:'include' }).catch(()=>null);
    setLoading(false);
    if (!r || !r.ok) { setError('Failed to load payment plans.'); return; }
    setData(await r.json());
  };

  const runNow = async () => {
    setRunBusy(true); setRunMsg('');
    const r = await fetch('/api/admin/orders/payment-plan/charge-now', { method:'POST', headers:postHeaders(), credentials:'include' }).catch(()=>null);
    setRunBusy(false);
    setRunMsg(r && r.ok ? 'Reminders/charges run complete.' : 'Failed to run.');
    if (r && r.ok) load();
    setTimeout(() => setRunMsg(''), 4000);
  };

  useEffect(() => { load(); }, []);

  const fmtAUD = n => `$${(Number(n)||0).toLocaleString('en-AU',{minimumFractionDigits:2,maximumFractionDigits:2})}`;
  const fmtDate = s => s ? new Date(s+'T00:00:00').toLocaleDateString('en-AU',{day:'numeric',month:'short',year:'numeric'}) : '-';
  const STATUS_MAP = {
    'on-track': { label:'On track', cls:'tag-outline' },
    'due-soon': { label:'Due soon', cls:'tag-ochre' },
    overdue:    { label:'Overdue',  cls:'tag-red' },
    failed:     { label:'Needs attention', cls:'tag-red' },
  };
  const goToOrder = (orderId) => {
    navigator.clipboard?.writeText(orderId).catch(()=>{});
    window.location.href = '/orders';
  };

  return (
    <>
      <div className="card" style={{padding:'14px 22px', marginBottom:20, display:'flex', alignItems:'center', gap:16}}>
        <button className="btn btn-rust" onClick={load} disabled={loading}>{loading ? 'Loading…' : 'Refresh'}</button>
        <button className="btn btn-ghost" onClick={runNow} disabled={runBusy} title="Manually run today's reminder/charge check instead of waiting for the nightly cron">
          {runBusy ? 'Running…' : 'Run reminders/charges now'}
        </button>
        {runMsg && <span className="mono" style={{fontSize:12, color:'var(--ink-2)'}}>{runMsg}</span>}
        {error && <span className="mono" style={{fontSize:12, color:'var(--rust)'}}>{error}</span>}
      </div>

      {loading && !data && <div className="mono" style={{color:'var(--ink-3)', textAlign:'center', padding:40}}>Loading…</div>}

      {data && <>
        <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(160px,1fr))', gap:14, marginBottom:20}}>
          {[
            {label:'ACTIVE PLANS', value:data.activeCount, color:'var(--ink-1)'},
            {label:'DUE SOON (7d)', value:data.dueSoonCount, color: data.dueSoonCount>0?'#c67c00':'var(--ink-3)'},
            {label:'OVERDUE',       value:data.overdueCount, color: data.overdueCount>0?'var(--rust)':'var(--ink-3)'},
            {label:'NEEDS ATTENTION', value:data.needsAttention, color: data.needsAttention>0?'var(--rust)':'var(--ink-3)'},
          ].map(t => (
            <div key={t.label} className="card" style={{padding:'14px 16px'}}>
              <div className="mono" style={{fontSize:10, color:'var(--ink-3)', marginBottom:4}}>{t.label}</div>
              <div className="mono" style={{fontSize:17, fontWeight:700, color:t.color}}>{t.value}</div>
            </div>
          ))}
        </div>

        {data.items.length === 0 ? (
          <div className="card" style={{padding:'32px 22px', textAlign:'center', color:'var(--ink-3)'}}>No active payment plans.</div>
        ) : (
          <div className="card" style={{padding:'18px 22px'}}>
            <div className="mono" style={{fontSize:11, fontWeight:700, color:'var(--rust)', marginBottom:12, letterSpacing:1}}>ACTIVE PLANS</div>
            <div style={{overflowX:'auto'}}>
              <table style={{width:'100%', borderCollapse:'collapse', fontSize:13}}>
                <thead>
                  <tr style={{borderBottom:'2px solid var(--border)'}}>
                    {['Order #','Customer','Frequency','Method','Next Due','Amount','Remaining','Status'].map(h => (
                      <th key={h} style={{textAlign: (h==='Amount'||h==='Remaining')?'right':'left', padding:'4px 6px 4px 0', fontWeight:600, color:'var(--ink-2)', fontSize:11, whiteSpace:'nowrap'}}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.items.map(item => (
                    <tr key={item.orderId} style={{borderBottom:'1px solid var(--line)', cursor:'pointer'}} onClick={() => goToOrder(item.orderId)} title="Click to copy order # and open Orders">
                      <td style={{padding:'7px 6px 7px 0', color:'var(--rust)', fontFamily:'monospace', whiteSpace:'nowrap'}}>{item.orderId}</td>
                      <td style={{padding:'7px 6px'}}>{item.customer}</td>
                      <td style={{padding:'7px 6px', textTransform:'capitalize'}}>{item.frequency}</td>
                      <td style={{padding:'7px 6px', textTransform:'capitalize'}}>{item.collectionMethod === 'auto' ? 'Auto-charge' : item.collectionMethod === 'customer' ? 'Customer pays' : 'Staff collects'}</td>
                      <td style={{padding:'7px 6px', whiteSpace:'nowrap'}}>{item.nextDue ? fmtDate(item.nextDue.dueDate) : '-'}</td>
                      <td style={{padding:'7px 6px', textAlign:'right', fontFamily:'monospace'}}>{item.nextDue ? fmtAUD(item.nextDue.amount) : '-'}</td>
                      <td style={{padding:'7px 6px', textAlign:'right', fontFamily:'monospace'}}>{fmtAUD(item.remaining)}</td>
                      <td style={{padding:'7px 6px'}}><span className={`tag ${STATUS_MAP[item.status]?.cls || 'tag-outline'}`} style={{fontSize:10}}>{STATUS_MAP[item.status]?.label || item.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </>}
    </>
  );
}

function ReceivablesView() {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);

  const load = async () => {
    setLoading(true); setError(null); setData(null);
    const r = await fetch('/api/admin/receivables-report', { credentials:'include' }).catch(()=>null);
    setLoading(false);
    if (!r || !r.ok) { setError('Failed to load receivables.'); return; }
    setData(await r.json());
  };

  useEffect(() => { load(); }, []);

  const fmtAUD = n => `$${(Number(n)||0).toLocaleString('en-AU',{minimumFractionDigits:2,maximumFractionDigits:2})}`;
  const fmtDate = s => s ? new Date(s+'T00:00:00').toLocaleDateString('en-AU',{day:'numeric',month:'short',year:'numeric'}) : '-';
  const exportPdf = () => window.open('/api/admin/receivables-report/pdf', '_blank');

  return (
    <>
      <div className="card" style={{padding:'14px 22px', marginBottom:20, display:'flex', alignItems:'center', gap:16}}>
        <button className="btn btn-rust" onClick={load} disabled={loading}>{loading ? 'Loading…' : 'Refresh'}</button>
        {data && <button className="btn" style={{background:'#345526',color:'#fff'}} onClick={exportPdf}><Icon name="download" size={13}/> Export PDF</button>}
        {data && <span className="mono" style={{fontSize:11, color:'var(--ink-3)'}}>As at {fmtDate(data.asAt)}</span>}
        {error && <span className="mono" style={{fontSize:12, color:'var(--rust)'}}>{error}</span>}
      </div>

      {loading && <div className="mono" style={{color:'var(--ink-3)', textAlign:'center', padding:40}}>Loading…</div>}

      {data && <>
        <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(160px,1fr))', gap:14, marginBottom:20}}>
          {[
            {label:'TOTAL OUTSTANDING', value:fmtAUD(data.total),      color:'var(--rust)'},
            {label:'CURRENT (≤ 30d)',   value:fmtAUD(data.current),    color: data.current>0?'var(--ink-1)':'var(--ink-3)'},
            {label:'> 30 DAYS',         value:fmtAUD(data.over30),     color: data.over30>0?'#c67c00':'var(--ink-3)'},
            {label:'> 60 DAYS',         value:fmtAUD(data.over60),     color: data.over60>0?'var(--rust)':'var(--ink-3)'},
            {label:'> 90 DAYS',         value:fmtAUD(data.over90),     color: data.over90>0?'var(--rust)':'var(--ink-3)'},
          ].map(t => (
            <div key={t.label} className="card" style={{padding:'14px 16px'}}>
              <div className="mono" style={{fontSize:10, color:'var(--ink-3)', marginBottom:4}}>{t.label}</div>
              <div className="mono" style={{fontSize:17, fontWeight:700, color:t.color}}>{t.value}</div>
            </div>
          ))}
        </div>

        {data.items.length === 0 ? (
          <div className="card" style={{padding:'32px 22px', textAlign:'center', color:'var(--ink-3)'}}>No outstanding receivables, great!</div>
        ) : (
          <div className="card" style={{padding:'18px 22px'}}>
            <div className="mono" style={{fontSize:11, fontWeight:700, color:'var(--rust)', marginBottom:12, letterSpacing:1}}>OUTSTANDING ITEMS</div>
            <table style={{width:'100%', borderCollapse:'collapse', fontSize:13}}>
              <thead>
                <tr style={{borderBottom:'2px solid var(--border)'}}>
                  {['Ref','Customer','Description','Date','Age','Status','Amount'].map(h => (
                    <th key={h} style={{textAlign: h==='Amount'?'right':'left', padding:'4px 6px 4px 0', fontWeight:600, color:'var(--ink-2)', fontSize:11}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.items.map((it,i) => {
                  const ageColor = it.ageDays > 90 ? 'var(--rust)' : it.ageDays > 60 ? '#c67c00' : 'var(--ink-2)';
                  return (
                    <tr key={i} style={{background: i%2===1?'var(--bg-deep)':'transparent'}}>
                      <td style={{padding:'6px 6px 6px 0', fontFamily:'monospace', fontSize:11}}>{it.ref}</td>
                      <td style={{padding:'6px 6px 6px 0', color:'var(--ink-1)'}}>{it.customer}</td>
                      <td style={{padding:'6px 6px 6px 0', color:'var(--ink-2)'}}>{it.description}</td>
                      <td style={{padding:'6px 6px 6px 0', fontFamily:'monospace', fontSize:11}}>{fmtDate(it.date)}</td>
                      <td style={{padding:'6px 6px 6px 0', fontFamily:'monospace', fontSize:11, color:ageColor}}>{it.ageDays != null ? `${it.ageDays}d` : '-'}</td>
                      <td style={{padding:'6px 6px 6px 0', color:'var(--ink-3)', fontSize:11}}>{it.status}</td>
                      <td style={{textAlign:'right', fontFamily:'monospace', fontWeight:600, color:'var(--rust)'}}>{fmtAUD(it.amount)}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr style={{borderTop:'2px solid var(--border)'}}>
                  <td colSpan={6} style={{padding:'8px 0', fontWeight:700}}>Total Outstanding</td>
                  <td style={{textAlign:'right', fontFamily:'monospace', fontWeight:700, fontSize:15, color:'var(--rust)'}}>{fmtAUD(data.total)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </>}
    </>
  );
}

function StockView() {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);

  const load = async () => {
    setLoading(true); setError(null); setData(null);
    const r = await fetch('/api/admin/trading-stock-report', { credentials:'include' }).catch(()=>null);
    setLoading(false);
    if (!r || !r.ok) { setError('Failed to load stock data.'); return; }
    setData(await r.json());
  };

  useEffect(() => { load(); }, []);

  const fmtAUD = n => `$${(Number(n)||0).toLocaleString('en-AU',{minimumFractionDigits:2,maximumFractionDigits:2})}`;
  const fmtDate = s => s ? new Date(s+'T00:00:00').toLocaleDateString('en-AU',{day:'numeric',month:'short',year:'numeric'}) : '-';
  const exportPdf = () => window.open('/api/admin/trading-stock-report/pdf', '_blank');

  return (
    <>
      <div className="card" style={{padding:'14px 22px', marginBottom:20, display:'flex', alignItems:'center', gap:16, flexWrap:'wrap'}}>
        <button className="btn btn-rust" onClick={load} disabled={loading}>{loading ? 'Loading…' : 'Refresh'}</button>
        {data && <button className="btn" style={{background:'#345526',color:'#fff'}} onClick={exportPdf}><Icon name="download" size={13}/> Export PDF</button>}
        {data && <span className="mono" style={{fontSize:11, color:'var(--ink-3)'}}>As at {fmtDate(data.asAt)}</span>}
        {error && <span className="mono" style={{fontSize:12, color:'var(--rust)'}}>{error}</span>}
      </div>

      {loading && <div className="mono" style={{color:'var(--ink-3)', textAlign:'center', padding:40}}>Loading…</div>}

      {data && <>
        <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(180px,1fr))', gap:14, marginBottom:20}}>
          <div className="card" style={{padding:'14px 16px'}}>
            <div className="mono" style={{fontSize:10, color:'var(--ink-3)', marginBottom:4}}>ITEMS IN STOCK</div>
            <div className="mono" style={{fontSize:20, fontWeight:700, color:'var(--ink-1)'}}>{data.itemCount}</div>
          </div>
          {data.hasCostPrices && (
            <div className="card" style={{padding:'14px 16px'}}>
              <div className="mono" style={{fontSize:10, color:'var(--ink-3)', marginBottom:4}}>VALUE AT COST</div>
              <div className="mono" style={{fontSize:20, fontWeight:700, color:'var(--ink-1)'}}>{fmtAUD(data.totalCostValue)}</div>
            </div>
          )}
          <div className="card" style={{padding:'14px 16px'}}>
            <div className="mono" style={{fontSize:10, color:'var(--ink-3)', marginBottom:4}}>VALUE AT SELLING PRICE</div>
            <div className="mono" style={{fontSize:20, fontWeight:700, color:'#345526'}}>{fmtAUD(data.totalSellValue)}</div>
          </div>
        </div>

        {!data.hasCostPrices && (
          <div style={{background:'#fff8e1', border:'1px solid #f0d97c', borderRadius:6, padding:'10px 16px', marginBottom:16, fontSize:12, color:'#7a5d10'}}>
            No cost prices set, stock valued at selling price (market value method, acceptable to ATO).
            Add a <strong>Cost Price (AUD)</strong> field to each product for more accurate COGS reporting.
          </div>
        )}

        {data.lines.length === 0 ? (
          <div className="card" style={{padding:'32px 22px', textAlign:'center', color:'var(--ink-3)'}}>No stock on hand.</div>
        ) : (
          <div className="card" style={{padding:'18px 22px'}}>
            <div className="mono" style={{fontSize:11, fontWeight:700, color:'var(--rust)', marginBottom:12, letterSpacing:1}}>STOCK ON HAND</div>
            <table style={{width:'100%', borderCollapse:'collapse', fontSize:13}}>
              <thead>
                <tr style={{borderBottom:'2px solid var(--border)'}}>
                  <th style={{textAlign:'left',  padding:'4px 0', fontWeight:600, color:'var(--ink-2)', fontSize:11, width:70}}>SKU</th>
                  <th style={{textAlign:'left',  padding:'4px 0', fontWeight:600, color:'var(--ink-2)', fontSize:11}}>Product</th>
                  <th style={{textAlign:'right', padding:'4px 0', fontWeight:600, color:'var(--ink-2)', fontSize:11, width:50}}>Qty</th>
                  <th style={{textAlign:'right', padding:'4px 0', fontWeight:600, color:'var(--ink-2)', fontSize:11, width:80}}>Sell $</th>
                  {data.hasCostPrices && <th style={{textAlign:'right', padding:'4px 0', fontWeight:600, color:'var(--ink-2)', fontSize:11, width:80}}>Cost $</th>}
                  <th style={{textAlign:'right', padding:'4px 0', fontWeight:600, color:'var(--ink-2)', fontSize:11, width:90}}>Value</th>
                </tr>
              </thead>
              <tbody>
                {data.lines.map((ln,i) => (
                  <tr key={i} style={{background: i%2===1?'var(--bg-deep)':'transparent'}}>
                    <td style={{padding:'5px 0', fontFamily:'monospace', fontSize:11, color:'var(--ink-3)'}}>{ln.sku}</td>
                    <td style={{padding:'5px 0'}}>{ln.name}</td>
                    <td style={{textAlign:'right', fontFamily:'monospace'}}>{ln.qty}</td>
                    <td style={{textAlign:'right', fontFamily:'monospace'}}>{fmtAUD(ln.sellPrice)}</td>
                    {data.hasCostPrices && <td style={{textAlign:'right', fontFamily:'monospace'}}>{ln.costPrice ? fmtAUD(ln.costPrice) : <span style={{color:'var(--ink-3)'}}>-</span>}</td>}
                    <td style={{textAlign:'right', fontFamily:'monospace', fontWeight:600}}>{fmtAUD(ln.hasCost ? ln.costValue : ln.sellValue)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{borderTop:'2px solid var(--border)'}}>
                  <td colSpan={data.hasCostPrices ? 5 : 4} style={{padding:'8px 0', fontWeight:700}}>
                    Total {data.hasCostPrices ? 'at cost' : 'at selling price'}
                  </td>
                  <td style={{textAlign:'right', fontFamily:'monospace', fontWeight:700, fontSize:15, color:'#345526'}}>
                    {fmtAUD(data.hasCostPrices ? data.totalCostValue : data.totalSellValue)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </>}
    </>
  );
}

function YearEndView() {
  const now = new Date();
  const fyYear = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;
  const fyLabel = `FY ${fyYear}–${String(fyYear+1).slice(2)}`;

  const CHECKLIST = [
    { id:'bank',    section:'Records', label:'Reconcile all business bank accounts and credit cards for the financial year' },
    { id:'invoices',section:'Records', label:'Ensure all invoices issued are recorded (check repairs + shop orders)' },
    { id:'receipts',section:'Records', label:'Gather receipts for all business expenses, store for 5 years' },
    { id:'stock',   section:'Records', label:'Complete a physical stocktake and reconcile with system stock levels' },
    { id:'assets',  section:'Tax deductions', label:'List all tools and equipment purchased, claim instant asset write-off if under the threshold' },
    { id:'super',   section:'Tax deductions', label:'Make personal super contributions before 30 June and lodge a "Notice of intent to claim a deduction" with your fund' },
    { id:'prepay',  section:'Tax deductions', label:'Prepay deductible expenses for next year (e.g. insurance, subscriptions) if cash allows' },
    { id:'baddebt', section:'Tax deductions', label:'Write off any genuinely unrecoverable debts before 30 June' },
    { id:'travel',  section:'Tax deductions', label:'Log all business travel / vehicle kilometres used for the year' },
    { id:'wfh',     section:'Tax deductions', label:'Calculate work-from-home expenses (fixed rate or actual cost method)' },
    { id:'bas',     section:'Lodgements', label:'Lodge Q4 BAS (if registered for GST) - due 28 July' },
    { id:'payg',    section:'Lodgements', label:'Check for any PAYG instalment notices from the ATO and pay by the due date' },
    { id:'agent',   section:'Lodgements', label:'Engage a registered tax agent or lodge your own tax return by 31 October' },
    { id:'abn',     section:'Lodgements', label:'Confirm your ABN and business details are up to date with the ATO' },
  ];

  const [checked, setChecked] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/admin/yearend-checklist?fy=${fyYear}`, { credentials:'include' })
      .then(r => r.ok ? r.json() : { checked:{} })
      .then(d => { setChecked(d.checked||{}); setLoading(false); })
      .catch(() => setLoading(false));
  }, [fyYear]);

  const toggle = id => {
    const next = { ...checked, [id]: !checked[id] };
    setChecked(next);
    fetch('/api/admin/yearend-checklist/save', {
      method:'POST', credentials:'include', headers: postHeaders(),
      body: JSON.stringify({ fy: fyYear, checked: next }),
    }).catch(()=>{});
  };

  const sections = [...new Set(CHECKLIST.map(c => c.section))];
  const done = CHECKLIST.filter(c => checked[c.id]).length;
  const pct  = Math.round(done / CHECKLIST.length * 100);

  if (loading) return <div className="mono" style={{textAlign:'center', padding:40, color:'var(--ink-3)'}}>Loading…</div>;

  return (
    <>
      <div className="card" style={{padding:'18px 22px', marginBottom:20}}>
        <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:12}}>
          <div>
            <div style={{fontSize:16, fontWeight:700}}>{fyLabel} Year-End Checklist</div>
            <div style={{fontSize:12, color:'var(--ink-3)', marginTop:4}}>{done} of {CHECKLIST.length} complete</div>
          </div>
          <div style={{display:'flex', alignItems:'center', gap:10}}>
            <div style={{width:120, height:8, background:'var(--border)', borderRadius:4, overflow:'hidden'}}>
              <div style={{width:`${pct}%`, height:'100%', background: pct===100?'#2e7d32':'var(--rust)', borderRadius:4, transition:'width 0.3s'}} />
            </div>
            <span className="mono" style={{fontSize:13, fontWeight:700, color: pct===100?'#2e7d32':'var(--rust)'}}>{pct}%</span>
          </div>
        </div>
      </div>

      {sections.map(section => (
        <div key={section} className="card" style={{padding:'18px 22px', marginBottom:16}}>
          <div className="mono" style={{fontSize:11, fontWeight:700, color:'var(--rust)', marginBottom:14, letterSpacing:1}}>{section.toUpperCase()}</div>
          {CHECKLIST.filter(c => c.section===section).map(c => (
            <label key={c.id} style={{display:'flex', alignItems:'flex-start', gap:12, marginBottom:12, cursor:'pointer'}}>
              <input type="checkbox" checked={!!checked[c.id]} onChange={() => toggle(c.id)}
                style={{marginTop:2, accentColor:'var(--rust)', width:16, height:16, flexShrink:0}} />
              <span style={{fontSize:13, color: checked[c.id] ? 'var(--ink-3)' : 'var(--ink-1)',
                textDecoration: checked[c.id] ? 'line-through' : 'none', lineHeight:1.5}}>
                {c.label}
              </span>
            </label>
          ))}
        </div>
      ))}

      <div style={{fontSize:11, color:'var(--ink-3)', marginTop:8}}>
        Checklist progress for {fyLabel} is saved to the server and shared across staff.
        Consult a registered tax agent for advice specific to your situation.
      </div>
    </>
  );
}

// ============================================================
// POLICIES, edit
// ============================================================
// ============================================================
// SETTINGS
// ============================================================
function AdminSettings({ sessionInfo = {} }) {
  if (sessionInfo.role === 'seller') return <SellerSettings sessionInfo={sessionInfo} />;
  return <AdminSettingsFull sessionInfo={sessionInfo} />;
}

async function loadStripeJs(publishableKey) {
  if (window.Stripe) return window.Stripe(publishableKey);
  await new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://js.stripe.com/v3/';
    s.onload = resolve; s.onerror = reject;
    document.head.appendChild(s);
  });
  return window.Stripe(publishableKey);
}

function SellerSettings({ sessionInfo = {} }) {
  const [form, setForm] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [billing, setBilling] = useState(null);
  const [cardBusy, setCardBusy] = useState(false);
  const [cardMsg, setCardMsg] = useState('');
  const [showCardForm, setShowCardForm] = useState(false);
  const [stripeElements, setStripeElements] = useState(null);
  const cardElRef = React.useRef(null);
  const cardDivRef = React.useRef(null);

  const loadBilling = () => {
    fetch('/api/admin/seller/billing', { credentials:'include' })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(d => setBilling(d))
      .catch(() => {});
  };

  useEffect(() => {
    fetch('/api/admin/staff', { credentials:'include' })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(d => {
        const me = (d.members || []).find(m => m.id === sessionInfo.staffId);
        if (me) setForm({ ...me, pin: '', newPin: '' });
      })
      .catch(() => {});
    loadBilling();
  }, []);

  const save = async () => {
    if (!form) return;
    if (form.newPin && !/^\d{4,6}$/.test(form.newPin)) { setMsg('PIN must be 4–6 digits.'); return; }
    setBusy(true);
    const payload = { id: form.id, name: form.name, email: form.email, phone: form.phone, color: form.color, status: form.status };
    if (form.newPin) payload.pin = form.newPin;
    const r = await fetch('/api/admin/staff/members/save', { method:'POST', headers:postHeaders(), credentials:'include', body: JSON.stringify(payload) }).catch(()=>null);
    setBusy(false);
    setMsg(r && r.ok ? 'Saved.' : 'Failed to save.');
    if (r && r.ok) setForm(f => ({ ...f, newPin: '' }));
  };

  const openCardForm = async () => {
    setCardMsg('');
    setShowCardForm(true);
    setCardBusy(true);
    try {
      const [siResp, settingsResp] = await Promise.all([
        fetch('/api/admin/seller/setup-intent', { method:'POST', headers:postHeaders(), credentials:'include' }).then(r => r.json()),
        fetch('/api/settings').then(r => r.json()),
      ]);
      const { clientSecret } = siResp;
      const { stripePublishableKey } = settingsResp;
      if (!clientSecret || !stripePublishableKey) { setCardMsg('Stripe not configured.'); setCardBusy(false); return; }
      const stripe = await loadStripeJs(stripePublishableKey);
      const elements = stripe.elements();
      const cardEl = elements.create('card', { style: { base: { fontSize: '14px', color: '#333' } } });
      setStripeElements({ stripe, elements, cardEl });
      // Mount after render
      setTimeout(() => {
        if (cardDivRef.current) cardEl.mount(cardDivRef.current);
      }, 50);
    } catch (e) {
      setCardMsg('Failed to load card form.');
    }
    setCardBusy(false);
  };

  const submitCard = async () => {
    if (!stripeElements) return;
    const { stripe, cardEl } = stripeElements;
    setCardBusy(true);
    setCardMsg('');
    // Get the setup intent client secret from a fresh call
    const siResp = await fetch('/api/admin/seller/setup-intent', { method:'POST', headers:postHeaders(), credentials:'include' }).then(r=>r.json()).catch(()=>null);
    if (!siResp || !siResp.clientSecret) { setCardMsg('Failed to create setup intent.'); setCardBusy(false); return; }
    const result = await stripe.confirmCardSetup(siResp.clientSecret, { payment_method: { card: cardEl } });
    if (result.error) { setCardMsg(result.error.message || 'Card setup failed.'); setCardBusy(false); return; }
    const pmId = result.setupIntent.payment_method;
    const saveResp = await fetch('/api/admin/seller/payment-method/save', { method:'POST', headers:postHeaders(), credentials:'include', body: JSON.stringify({ paymentMethodId: pmId }) }).then(r=>r.json()).catch(()=>null);
    if (!saveResp || !saveResp.ok) { setCardMsg('Failed to save card.'); setCardBusy(false); return; }
    cardEl.unmount();
    setStripeElements(null);
    setShowCardForm(false);
    setCardBusy(false);
    setCardMsg('');
    loadBilling();
    // Refresh form to get updated card fields
    fetch('/api/admin/staff', { credentials:'include' }).then(r=>r.ok?r.json():Promise.reject()).then(d=>{const me=(d.members||[]).find(m=>m.id===sessionInfo.staffId);if(me)setForm({...me,pin:'',newPin:''});}).catch(()=>{});
  };

  const removeCard = async () => {
    if (!(await adminConfirm('Remove saved card?', { title:'Remove saved card', confirmLabel:'Remove', danger:true }))) return;
    setCardBusy(true);
    const r = await fetch('/api/admin/seller/payment-method', { method:'DELETE', headers:postHeaders(), credentials:'include' }).catch(()=>null);
    setCardBusy(false);
    if (r && r.ok) {
      loadBilling();
      fetch('/api/admin/staff', { credentials:'include' }).then(r2=>r2.ok?r2.json():Promise.reject()).then(d=>{const me=(d.members||[]).find(m=>m.id===sessionInfo.staffId);if(me)setForm({...me,pin:'',newPin:''});}).catch(()=>{});
    }
  };

  if (!form) return <div style={{padding:32, fontSize:13, color:'var(--ink-2)'}}>Loading…</div>;

  const hasCard = !!(form.stripePaymentMethodId);
  const txns = billing ? (billing.transactions || []).slice(0, 20) : [];

  return (
    <div style={{padding:32, maxWidth:560}}>
      {msg && <div style={{marginBottom:16, fontSize:13, color:msg.includes('Failed')||msg.includes('must')?'var(--rust)':'var(--eucalyptus)'}}>{msg}</div>}
      <div style={{background:'var(--paper)', border:'1px solid var(--line)', padding:24, display:'grid', gap:10, marginBottom:24}}>
        <span className="eyebrow">MY DETAILS</span>
        <label className="field" style={{marginTop:8}}><span className="label">Name</span><input className="input" value={form.name||''} onChange={e=>setForm({...form,name:e.target.value})}/></label>
        <label className="field"><span className="label">Email</span><input className="input" type="email" value={form.email||''} onChange={e=>setForm({...form,email:e.target.value})}/></label>
        <label className="field"><span className="label">Phone</span><input className="input" type="tel" value={form.phone||''} onChange={e=>setForm({...form,phone:e.target.value})}/></label>
        <label className="field"><span className="label">Avatar colour</span><input type="color" value={form.color||'#d7c7a6'} onChange={e=>setForm({...form,color:e.target.value})} style={{width:48,height:32,padding:2,border:'1px solid var(--line)',borderRadius:4,cursor:'pointer'}}/></label>
        <label className="field"><span className="label">New PIN (leave blank to keep current)</span><input className="input" type="password" inputMode="numeric" maxLength={6} value={form.newPin||''} onChange={e=>setForm({...form,newPin:e.target.value.replace(/\D/g,'').slice(0,6)})} placeholder="4–6 digits"/></label>
        <button className="btn btn-rust btn-sm" style={{marginTop:4,alignSelf:'flex-start'}} disabled={busy} onClick={save}>{busy?'Saving…':'Save'}</button>
      </div>

      <div style={{background:'var(--paper)', border:'1px solid var(--line)', padding:24, display:'grid', gap:14}}>
        <span className="eyebrow">BILLING</span>
        <div style={{display:'flex', gap:32, flexWrap:'wrap'}}>
          <div>
            <div style={{fontSize:11, color:'var(--ink-2)', marginBottom:4}}>BALANCE</div>
            <div style={{fontSize:22, fontWeight:700, color: billing && billing.balance >= 0 ? 'var(--eucalyptus)' : 'var(--rust)'}}>
              {billing ? `$${billing.balance.toFixed(2)}` : '…'}
            </div>
          </div>
          <div>
            <div style={{fontSize:11, color:'var(--ink-2)', marginBottom:4}}>SAVED CARD</div>
            <div style={{fontSize:14, fontWeight:500}}>
              {hasCard ? `${form.stripeCardBrand ? form.stripeCardBrand.toUpperCase() : 'Card'} •••• ${form.stripeCardLast4}` : 'No card saved'}
            </div>
          </div>
        </div>
        <div style={{display:'flex', gap:8}}>
          <button className="btn btn-sm" style={{background:'var(--rust)',color:'#fff'}} disabled={cardBusy} onClick={openCardForm}>{hasCard ? 'Change card' : 'Add card'}</button>
          {hasCard && <button className="btn btn-sm" style={{background:'var(--line)',color:'var(--ink)'}} disabled={cardBusy} onClick={removeCard}>Remove card</button>}
        </div>
        {cardMsg && <div style={{fontSize:13, color:'var(--rust)'}}>{cardMsg}</div>}
        {showCardForm && (
          <div style={{border:'1px solid var(--line)', borderRadius:6, padding:16, display:'grid', gap:12}}>
            <div style={{fontSize:13, fontWeight:600}}>Enter card details</div>
            {cardBusy && !stripeElements && <div style={{fontSize:13,color:'var(--ink-2)'}}>Loading…</div>}
            <div ref={cardDivRef} style={{border:'1px solid var(--line)', borderRadius:4, padding:'10px 12px', background:'#fff', minHeight:38}}/>
            <div style={{display:'flex', gap:8}}>
              <button className="btn btn-rust btn-sm" disabled={cardBusy || !stripeElements} onClick={submitCard}>{cardBusy?'Saving…':'Save card'}</button>
              <button className="btn btn-sm" style={{background:'var(--line)',color:'var(--ink)'}} onClick={()=>{setShowCardForm(false);if(stripeElements){stripeElements.cardEl.unmount();setStripeElements(null);}}}>Cancel</button>
            </div>
          </div>
        )}

        {txns.length > 0 && (
          <div style={{marginTop:8}}>
            <div style={{fontSize:11, color:'var(--ink-2)', marginBottom:8}}>RECENT TRANSACTIONS</div>
            <table style={{width:'100%', fontSize:12, borderCollapse:'collapse'}}>
              <thead>
                <tr style={{color:'var(--ink-2)'}}>
                  <th style={{textAlign:'left', padding:'4px 8px 4px 0', fontWeight:500}}>Date</th>
                  <th style={{textAlign:'left', padding:'4px 8px', fontWeight:500}}>Description</th>
                  <th style={{textAlign:'center', padding:'4px 8px', fontWeight:500}}>Type</th>
                  <th style={{textAlign:'right', padding:'4px 0 4px 8px', fontWeight:500}}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {txns.map(t => (
                  <tr key={t.id} style={{borderTop:'1px solid var(--line)'}}>
                    <td style={{padding:'6px 8px 6px 0', color:'var(--ink-2)'}}>{new Date(t.date).toLocaleDateString('en-AU')}</td>
                    <td style={{padding:'6px 8px'}}>{t.description}</td>
                    <td style={{padding:'6px 8px', textAlign:'center'}}>
                      <span style={{fontSize:10, fontWeight:600, padding:'2px 6px', borderRadius:3, background: t.type==='sale_credit'?'#e8f5e9':'#fce4ec', color: t.type==='sale_credit'?'#2e7d32':'#c62828'}}>
                        {t.type==='sale_credit'?'CREDIT':'DEBIT'}
                      </span>
                    </td>
                    <td style={{padding:'6px 0 6px 8px', textAlign:'right', color: t.type==='sale_credit'?'var(--eucalyptus)':'var(--rust)', fontWeight:600}}>
                      {t.type==='sale_credit'?'+':'-'}${t.amount.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {billing && txns.length === 0 && <div style={{fontSize:13, color:'var(--ink-2)'}}>No transactions yet.</div>}
      </div>
    </div>
  );
}

function AdminSellerBilling({ sessionInfo = {} }) {
  const [sellers, setSellers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);
  const [txnMap, setTxnMap] = useState({});
  const [txnLoading, setTxnLoading] = useState({});
  const [chargeBusy, setChargeBusy] = useState(false);
  const [chargeMsg, setChargeMsg] = useState('');
  const isOwner = sessionInfo.role === 'owner';

  const load = () => {
    setLoading(true);
    fetch('/api/admin/seller-billing', { credentials:'include' })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(d => setSellers(d.sellers || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const toggleExpand = async (id) => {
    if (expandedId === id) { setExpandedId(null); return; }
    setExpandedId(id);
    if (txnMap[id]) return;
    setTxnLoading(m => ({ ...m, [id]: true }));
    const d = await fetch(`/api/admin/seller-billing/transactions/${encodeURIComponent(id)}`, { credentials:'include' }).then(r=>r.ok?r.json():Promise.reject()).catch(()=>({ transactions:[] }));
    setTxnMap(m => ({ ...m, [id]: d.transactions || [] }));
    setTxnLoading(m => ({ ...m, [id]: false }));
  };

  const chargeNow = async () => {
    if (!(await adminConfirm('Run listing fee billing now for all sellers?', { title:'Run billing', confirmLabel:'Run billing', danger:true }))) return;
    setChargeBusy(true); setChargeMsg('');
    const r = await fetch('/api/admin/seller-billing/charge-now', { method:'POST', headers:postHeaders(), credentials:'include' }).catch(()=>null);
    setChargeBusy(false);
    if (r && r.ok) { setChargeMsg('Billing run complete.'); load(); }
    else setChargeMsg('Billing run failed or Stripe not configured.');
  };

  if (loading) return <div style={{padding:32, fontSize:13, color:'var(--ink-2)'}}>Loading…</div>;

  return (
    <div style={{padding:32, maxWidth:860}}>
      <div style={{display:'flex', alignItems:'center', gap:12, marginBottom:24}}>
        <div style={{flex:1}}/>
        {isOwner && <button className="btn btn-rust btn-sm" disabled={chargeBusy} onClick={chargeNow}>{chargeBusy?'Running…':'Run billing now'}</button>}
      </div>
      {chargeMsg && <div style={{marginBottom:16, fontSize:13, color: chargeMsg.includes('failed')?'var(--rust)':'var(--eucalyptus)'}}>{chargeMsg}</div>}
      {sellers.length === 0 && <div style={{fontSize:13, color:'var(--ink-2)'}}>No sellers found.</div>}
      <table style={{width:'100%', fontSize:13, borderCollapse:'collapse'}}>
        <thead>
          <tr style={{color:'var(--ink-2)', borderBottom:'1px solid var(--line)'}}>
            <th style={{textAlign:'left', padding:'8px 12px 8px 0', fontWeight:500}}>Seller</th>
            <th style={{textAlign:'center', padding:'8px 12px', fontWeight:500}}>Listings</th>
            <th style={{textAlign:'right', padding:'8px 12px', fontWeight:500}}>Balance</th>
            <th style={{textAlign:'center', padding:'8px 12px', fontWeight:500}}>Card</th>
            <th style={{textAlign:'center', padding:'8px 0', fontWeight:500}}>History</th>
          </tr>
        </thead>
        <tbody>
          {sellers.map(s => (
            <React.Fragment key={s.id}>
              <tr style={{borderTop:'1px solid var(--line)'}}>
                <td style={{padding:'10px 12px 10px 0'}}>
                  <div style={{fontWeight:600}}>{s.name}</div>
                  <div style={{fontSize:11, color:'var(--ink-2)'}}>{s.email}</div>
                </td>
                <td style={{textAlign:'center', padding:'10px 12px'}}>{s.activeListings}</td>
                <td style={{textAlign:'right', padding:'10px 12px', fontWeight:700, color: s.balance >= 0 ? 'var(--eucalyptus)' : 'var(--rust)'}}>
                  ${s.balance.toFixed(2)}
                </td>
                <td style={{textAlign:'center', padding:'10px 12px'}}>
                  {s.hasCard ? <span style={{color:'var(--eucalyptus)', fontSize:11, fontWeight:600}}>{s.cardBrand ? s.cardBrand.toUpperCase() : 'CARD'} ···· {s.cardLast4}</span> : <span style={{color:'var(--rust)', fontSize:11}}>No card</span>}
                </td>
                <td style={{textAlign:'center', padding:'10px 0'}}>
                  <button className="btn btn-sm" style={{fontSize:11, padding:'3px 10px'}} onClick={()=>toggleExpand(s.id)}>{expandedId===s.id?'Hide':'View'}</button>
                </td>
              </tr>
              {expandedId === s.id && (
                <tr>
                  <td colSpan={5} style={{padding:'0 0 12px 0', background:'var(--paper-2, #faf9f7)'}}>
                    {txnLoading[s.id] && <div style={{padding:'12px 16px', fontSize:12, color:'var(--ink-2)'}}>Loading…</div>}
                    {!txnLoading[s.id] && txnMap[s.id] && txnMap[s.id].length === 0 && <div style={{padding:'12px 16px', fontSize:12, color:'var(--ink-2)'}}>No transactions.</div>}
                    {!txnLoading[s.id] && txnMap[s.id] && txnMap[s.id].length > 0 && (
                      <table style={{width:'100%', fontSize:12, borderCollapse:'collapse'}}>
                        <thead>
                          <tr style={{color:'var(--ink-2)'}}>
                            <th style={{textAlign:'left', padding:'6px 16px', fontWeight:500}}>Date</th>
                            <th style={{textAlign:'left', padding:'6px 8px', fontWeight:500}}>Description</th>
                            <th style={{textAlign:'center', padding:'6px 8px', fontWeight:500}}>Type</th>
                            <th style={{textAlign:'center', padding:'6px 8px', fontWeight:500}}>Status</th>
                            <th style={{textAlign:'right', padding:'6px 16px', fontWeight:500}}>Amount</th>
                          </tr>
                        </thead>
                        <tbody>
                          {txnMap[s.id].map(t => (
                            <tr key={t.id} style={{borderTop:'1px solid var(--line)'}}>
                              <td style={{padding:'6px 16px', color:'var(--ink-2)'}}>{new Date(t.date).toLocaleDateString('en-AU')}</td>
                              <td style={{padding:'6px 8px'}}>{t.description}</td>
                              <td style={{padding:'6px 8px', textAlign:'center'}}>
                                <span style={{fontSize:10, fontWeight:600, padding:'2px 6px', borderRadius:3, background: t.type==='sale_credit'?'#e8f5e9':'#fce4ec', color: t.type==='sale_credit'?'#2e7d32':'#c62828'}}>
                                  {t.type==='sale_credit'?'CREDIT':t.type==='listing_fee'?'FEE':'PAYOUT'}
                                </span>
                              </td>
                              <td style={{padding:'6px 8px', textAlign:'center', color: t.status==='ok'?'var(--eucalyptus)':'var(--rust)'}}>{t.status}</td>
                              <td style={{padding:'6px 16px', textAlign:'right', fontWeight:600, color: t.type==='sale_credit'?'var(--eucalyptus)':'var(--rust)'}}>
                                {t.type==='sale_credit'?'+':'-'}${t.amount.toFixed(2)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </td>
                </tr>
              )}
            </React.Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ============================================================
// SETTINGS TAB SUB-COMPONENTS
// ============================================================

function SettingsGeneralTab({ shop, setShop, savedShop, announcement, setAnnouncement, savedAnnouncement, siteContent, setSiteContent, savedSiteContent, shopDirty, announcementDirty, siteContentDirty, sectionBusy, onShopSubmit, onAnnouncementSubmit, onSiteContentSubmit }) {
  return (
    <div style={{display:'grid', gap:24}}>
      <form onSubmit={onShopSubmit} style={{background:'var(--paper)', border:'1px solid var(--line)', padding:24}}>
        <span className="eyebrow">Shop Details</span>
        <label className="field" style={{marginTop:12}}><span className="label">Trading name</span><input className="input" value={shop.tradingName} onChange={(e) => setShop({ ...shop, tradingName: e.target.value })}/></label>
        <label className="field"><span className="label">ABN</span><input className="input" value={shop.abn} onChange={(e) => setShop({ ...shop, abn: e.target.value })}/></label>
        <label className="field"><span className="label">Street address</span><input className="input" value={shop.streetAddress||''} onChange={(e) => setShop({ ...shop, streetAddress: e.target.value })} placeholder="e.g. 12 Station St"/></label>
        <div style={{display:'grid', gridTemplateColumns:'2fr 1fr 1fr', gap:8}}>
          <label className="field"><span className="label">Suburb / Town</span><input className="input" value={shop.suburb||''} onChange={(e) => setShop({ ...shop, suburb: e.target.value })} placeholder="e.g. Blackall"/></label>
          <label className="field"><span className="label">State</span><input className="input" value={shop.state||''} onChange={(e) => setShop({ ...shop, state: e.target.value })} placeholder="QLD"/></label>
          <label className="field"><span className="label">Postcode</span><input className="input" value={shop.postcode||''} onChange={(e) => setShop({ ...shop, postcode: e.target.value })} placeholder="4472"/></label>
        </div>
        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:8}}>
          <label className="field"><span className="label">Map latitude</span><input className="input" value={shop.mapLat||''} onChange={(e) => setShop({ ...shop, mapLat: e.target.value })} placeholder="-35.9833"/></label>
          <label className="field"><span className="label">Map longitude</span><input className="input" value={shop.mapLng||''} onChange={(e) => setShop({ ...shop, mapLng: e.target.value })} placeholder="144.7500"/></label>
        </div>
        <label className="field"><span className="label">Phone</span><input className="input" type="tel" value={shop.phone} onChange={(e) => setShop({ ...shop, phone: e.target.value })}/></label>
        <label className="field"><span className="label">Contact email</span><input className="input" type="email" value={shop.email||''} onChange={(e) => setShop({ ...shop, email: e.target.value })}/></label>
        <label className="field"><span className="label">Tagline</span><input className="input" value={shop.tagline} onChange={(e) => setShop({ ...shop, tagline: e.target.value })}/></label>
        <label className="field"><span className="label">Description (footer)</span><textarea className="textarea" value={shop.description||''} onChange={(e) => setShop({ ...shop, description: e.target.value })} style={{minHeight:80}} placeholder="e.g. An independent electronics outpost..."/></label>
        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:8}}>
          <label className="field"><span className="label">Acknowledgment - People</span><input className="input" value={shop.acknowledgmentPeople||''} onChange={(e) => setShop({ ...shop, acknowledgmentPeople: e.target.value })} placeholder="e.g. Bidjara People"/></label>
          <label className="field"><span className="label">Acknowledgment - Country</span><input className="input" value={shop.acknowledgmentCountry||''} onChange={(e) => setShop({ ...shop, acknowledgmentCountry: e.target.value })} placeholder="e.g. Bidjara Country"/></label>
        </div>
        <label className="field">
          <span className="label">Site URL</span>
          <input className="input" value={shop.siteUrl||''} onChange={(e) => setShop({ ...shop, siteUrl: e.target.value })} placeholder="https://outbackelectronics.com.au"/>
          {(shop.siteUrl||'').startsWith('http://localhost') && (
            <div style={{fontSize:11, color:'var(--ochre)', marginTop:4, display:'flex', alignItems:'center', gap:6}}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
              This is a local development URL, update it to your live domain before publishing.
            </div>
          )}
        </label>
        <span className="eyebrow" style={{marginTop:20, display:'block'}}>Bank Details (for invoices)</span>
        <label className="field" style={{marginTop:12}}><span className="label">Account name</span><input className="input" value={shop.bankAccountName||''} onChange={(e) => setShop({ ...shop, bankAccountName: e.target.value })} placeholder="e.g. Outback Electronics Pty Ltd"/></label>
        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:8}}>
          <label className="field"><span className="label">BSB</span><input className="input" value={shop.bankBsb||''} onChange={(e) => setShop({ ...shop, bankBsb: e.target.value })} placeholder="e.g. 123-456"/></label>
          <label className="field"><span className="label">Account number</span><input className="input" value={shop.bankAccountNumber||''} onChange={(e) => setShop({ ...shop, bankAccountNumber: e.target.value })} placeholder="e.g. 12345678"/></label>
        </div>
        <span className="eyebrow" style={{marginTop:20, display:'block'}}>Payment Plans</span>
        <label className="field" style={{marginTop:12, maxWidth:220}}>
          <span className="label">Minimum order total ($)</span>
          <input className="input" type="number" min="0" step="1" value={shop.paymentPlanMinTotal ?? 300}
            onChange={(e) => setShop({ ...shop, paymentPlanMinTotal: e.target.value === '' ? '' : Math.max(0, Number(e.target.value) || 0) })} />
          <span style={{fontSize:11, color:'var(--ink-3)', marginTop:3, display:'block'}}>Orders at or above this amount can be offered a payment plan at checkout.</span>
        </label>
        <div className="row-flex" style={{gap:8, marginTop:12}}>
          <button className="btn btn-rust btn-sm" disabled={!shopDirty || sectionBusy==='shop'}>{sectionBusy==='shop'?'Saving…':'Save'}</button>
          <button type="button" className="btn btn-ghost btn-sm" disabled={!shopDirty || sectionBusy==='shop'} onClick={() => setShop(savedShop)}>Cancel</button>
        </div>
      </form>
      <form onSubmit={onAnnouncementSubmit} style={{background:'var(--paper)', border:'1px solid var(--line)', padding:24}}>
        <span className="eyebrow">Announcement Bar</span>
        <label className="field" style={{marginTop:12}}><span className="label">Message</span><input className="input" value={announcement.text} onChange={e => setAnnouncement({...announcement, text: e.target.value})} placeholder="e.g. SUMMER SALE - 15% OFF · ENDS 30 JUN"/></label>
        <label className="field" style={{flexDirection:'row', alignItems:'center', gap:8}}><input type="checkbox" checked={!!announcement.enabled} onChange={e => setAnnouncement({...announcement, enabled: e.target.checked})}/><span className="label" style={{margin:0}}>Show announcement bar</span></label>
        <label className="field"><span className="label">Expires on (optional)</span><input className="input" type="date" value={announcement.expiresAt || ''} onChange={e => setAnnouncement({...announcement, expiresAt: e.target.value})}/></label>
        <div className="row-flex" style={{gap:8, marginTop:12}}>
          <button className="btn btn-rust btn-sm" disabled={!announcementDirty || sectionBusy==='announcement'}>{sectionBusy==='announcement'?'Saving…':'Save'}</button>
          <button type="button" className="btn btn-ghost btn-sm" disabled={!announcementDirty || sectionBusy==='announcement'} onClick={() => setAnnouncement(savedAnnouncement)}>Cancel</button>
        </div>
      </form>
      <form onSubmit={onSiteContentSubmit} style={{background:'var(--paper)', border:'1px solid var(--line)', padding:24}}>
        <span className="eyebrow">Site Content</span>
        <p style={{fontSize:12, color:'var(--ink-2)', marginTop:8}}>
          Leave a field blank to use the built-in wording. In the hero fields you can use{' '}
          <code>{'{{location}}'}</code>, <code>{'{{tradingName}}'}</code>, <code>{'{{phone}}'}</code>,{' '}
          <code>{'{{email}}'}</code>, <code>{'{{address}}'}</code> and <code>{'{{abn}}'}</code>, they are
          filled in from Shop Details above. The same wording is sent to browsers and to search engines.
        </p>
        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginTop:12}}>
          <div>
            <label className="field"><span className="label">Home hero eyebrow (small line above the headline)</span><input className="input" value={siteContent.heroEyebrow} onChange={e => setSiteContent({...siteContent, heroEyebrow: e.target.value})} placeholder="e.g. EST. 2023 · APPOINTMENT ONLY · REMOTE ELECTRONICS SUPPORT"/></label>
            <label className="field"><span className="label">Home hero headline (one line per row, last row is italic)</span><textarea className="input" style={{minHeight:64}} value={siteContent.heroHeadline} onChange={e => setSiteContent({...siteContent, heroHeadline: e.target.value})} placeholder={'e.g. Built for where\nthe signal ends.'}/></label>
            <label className="field"><span className="label">Home hero paragraph</span><textarea className="input" style={{minHeight:88}} value={siteContent.heroSub} onChange={e => setSiteContent({...siteContent, heroSub: e.target.value})} placeholder="e.g. We sell and repair electronics for people living a long way from a city … serving remote Australia from {{location}} by appointment only."/></label>
            <label className="field"><span className="label">Workshop blurb (home page &amp; services)</span><textarea className="input" style={{minHeight:64}} value={siteContent.workshopBlurb} onChange={e => setSiteContent({...siteContent, workshopBlurb: e.target.value})} placeholder="e.g. One desk, one tech, one ute…"/></label>
          </div>
          <div>
            <label className="field"><span className="label">AI section heading (use newline to split lines)</span><input className="input" value={siteContent.aiHeading} onChange={e => setSiteContent({...siteContent, aiHeading: e.target.value})} placeholder="e.g. Edge AI\nfor the long paddock."/></label>
            <label className="field"><span className="label">AI section body</span><textarea className="input" style={{minHeight:64}} value={siteContent.aiBody} onChange={e => setSiteContent({...siteContent, aiBody: e.target.value})}/></label>
            <label className="field" style={{flexDirection:'row', alignItems:'center', gap:8}}><input type="checkbox" checked={!!siteContent.aiEnabled} onChange={e => setSiteContent({...siteContent, aiEnabled: e.target.checked})}/><span className="label" style={{margin:0}}>Show "NEW · 2026" badge on AI section</span></label>
          </div>
        </div>
        <div className="row-flex" style={{gap:8, marginTop:12}}>
          <button className="btn btn-rust btn-sm" disabled={!siteContentDirty || sectionBusy==='siteContent'}>{sectionBusy==='siteContent'?'Saving…':'Save'}</button>
          <button type="button" className="btn btn-ghost btn-sm" disabled={!siteContentDirty || sectionBusy==='siteContent'} onClick={() => setSiteContent(savedSiteContent)}>Cancel</button>
        </div>
      </form>
    </div>
  );
}
SettingsGeneralTab = React.memo(SettingsGeneralTab);

function SettingsStaffTab({ staffMembers, staffForm, setStaffForm, staffBusy, onSave, onDelete, onOpenForm, sessionInfo = {} }) {
  const [sigSaving, setSigSaving] = useState(false);
  const [sigVersion, setSigVersion] = useState(() => Date.now());
  const [sigExists, setSigExists] = useState(true); // optimistic; flips false if the image 404s
  const [showPad, setShowPad] = useState(false);
  const isOwnRecord = staffForm && staffForm.id && staffForm.id === sessionInfo.staffId;

  useEffect(() => {
    if (isOwnRecord) { setSigExists(true); setSigVersion(Date.now()); setShowPad(false); }
  }, [isOwnRecord, staffForm && staffForm.id]);

  const handleSaveSignature = async (dataUrl) => {
    setSigSaving(true);
    try {
      await saveSignature(dataUrl);
      setSigVersion(Date.now());
      setSigExists(true);
      setShowPad(false);
      adminToast('Signature saved.', 'success');
    } catch (err) {
      adminToast(`Failed to save signature (${err.message}).`);
    } finally {
      setSigSaving(false);
    }
  };
  const handleRemoveSignature = async () => {
    const ok = await deleteSignature();
    if (ok) { setSigExists(false); setSigVersion(Date.now()); adminToast('Signature removed.', 'success'); }
    else adminToast('Failed to remove signature.');
  };

  return (
    <div style={{display:'grid', gap:24}}>
      <div style={{background:'var(--paper)', border:'1px solid var(--line)', padding:24}}>
        <span className="eyebrow">Staff &amp; Roles</span>
        <div style={{display:'grid', gap:8, marginTop:12}}>
          {staffMembers.map(s => (
            <div key={s.id} style={{display:'flex', alignItems:'center', gap:10, padding:'8px 10px', background:'var(--bg-elev)'}}>
              <div className="avatar" style={{width:32, height:32, background:s.color||'#d7c7a6', fontSize:14}}>{(s.name||'?').split(' ').map(w=>w[0]).join('')}</div>
              <div style={{flex:1}}>
                <div style={{fontSize:13, fontWeight:600}}>{s.name}</div>
                <div className="mono" style={{fontSize:10, color:'var(--ink-2)'}}>{(s.role||'staff').toUpperCase()}{s.email ? ` · ${s.email}` : ''}</div>
              </div>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => onOpenForm(s)}>Edit</button>
              <button type="button" className="btn btn-ghost btn-sm" style={{color:'var(--rust)'}} onClick={() => onDelete(s.id)}>Remove</button>
            </div>
          ))}
          {staffMembers.length === 0 && <div className="mono" style={{fontSize:12, color:'var(--ink-3)'}}>No staff members yet.</div>}
        </div>
        <div className="row-flex" style={{gap:8, marginTop:12}}>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => onOpenForm(null)}>+ Add staff member</button>
        </div>
        {staffForm !== null && (
          <div style={{marginTop:16, padding:16, background:'var(--bg-elev)', display:'grid', gap:8}}>
            <div style={{fontSize:13, fontWeight:600, marginBottom:4}}>{staffForm.id ? 'Edit member' : 'New member'}</div>
            <label className="field"><span className="label">Name</span><input className="input" value={staffForm.name} onChange={e=>setStaffForm({...staffForm,name:e.target.value})}/></label>
            <label className="field"><span className="label">Role</span>
              <select className="select" value={staffForm.role||'staff'} onChange={e=>setStaffForm({...staffForm,role:e.target.value})}>
                {['owner','manager','technician','staff','seller','pending'].map(r=><option key={r}>{r}</option>)}
              </select>
            </label>
            <label className="field"><span className="label">Email</span><input className="input" type="email" value={staffForm.email||''} onChange={e=>setStaffForm({...staffForm,email:e.target.value})}/></label>
            <label className="field"><span className="label">Phone</span><input className="input" type="tel" value={staffForm.phone||''} onChange={e=>setStaffForm({...staffForm,phone:e.target.value})}/></label>
            <label className="field"><span className="label">Status</span>
              <select className="select" value={staffForm.status||'active'} onChange={e=>setStaffForm({...staffForm,status:e.target.value})}>
                {['active','inactive'].map(s=><option key={s}>{s}</option>)}
              </select>
            </label>
            <label className="field"><span className="label">PIN{staffForm.id ? ' (leave blank to keep current)' : ''}</span><input className="input" type="password" inputMode="numeric" maxLength={6} value={staffForm.pin||''} onChange={e=>setStaffForm({...staffForm,pin:e.target.value.replace(/\D/g,'').slice(0,6)})} placeholder={staffForm.id ? '4–6 digits' : '4–6 digits (required)'}/></label>
            <label className="field"><span className="label">Avatar colour</span><input type="color" value={staffForm.color||'#d7c7a6'} onChange={e=>setStaffForm({...staffForm,color:e.target.value})} style={{width:48,height:32,padding:2,border:'1px solid var(--line)',borderRadius:4,cursor:'pointer'}}/></label>

            {isOwnRecord && (
              <div className="field">
                <span className="label">Signature</span>
                {sigExists && !showPad && (
                  <div style={{display:'flex', alignItems:'center', gap:12}}>
                    <img src={`/assets/signatures/${sessionInfo.staffId}.png?v=${sigVersion}`} alt="Your signature" onError={()=>setSigExists(false)} style={{height:40, background:'#fff', border:'1px solid var(--line)', padding:4}}/>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={()=>setShowPad(true)}>Re-sign</button>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={handleRemoveSignature}>Remove</button>
                  </div>
                )}
                {(!sigExists || showPad) && (
                  <>
                    <SignaturePad onSave={handleSaveSignature} saving={sigSaving} />
                    {sigExists && <button type="button" className="btn btn-ghost btn-sm" style={{marginTop:6}} onClick={()=>setShowPad(false)}>Cancel</button>}
                  </>
                )}
                <span style={{fontSize:11, color:'var(--ink-3)', marginTop:4, display:'block'}}>Draw with a mouse, finger, or stylus. Used to sign hard drive condition reports and other certificates.</span>
              </div>
            )}

            <div className="row-flex" style={{gap:8, marginTop:4}}>
              <button className="btn btn-rust btn-sm" disabled={!staffForm.name.trim()||staffBusy} onClick={onSave}>{staffBusy?'Saving…':'Save'}</button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={()=>setStaffForm(null)}>Cancel</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
SettingsStaffTab = React.memo(SettingsStaffTab);

function SettingsIntegrationsTab({ integrations, setIntegrations, savedIntegrations, integrationModal, setIntegrationModal, integrationForm, setIntegrationForm, integrationsDirty, sectionBusy, onSubmit, onOpenModal, onOpenAddModal, onSaveModal, onDisconnect, onRemove }) {
  useEffect(() => {
    if (!integrationModal) return;
    const h = e => { if (e.key === 'Escape') setIntegrationModal(null); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [integrationModal, setIntegrationModal]);
  return (
    <div style={{display:'grid', gap:24}}>
      <form onSubmit={onSubmit} style={{background:'var(--paper)', border:'1px solid var(--line)', padding:24}}>
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
          <span className="eyebrow">Integrations</span>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onOpenAddModal}>+ Add</button>
        </div>
        {integrations.length === 0 && <div style={{marginTop:12, fontSize:13, color:'var(--ink-3)'}}>No integrations configured.</div>}
        <div style={{display:'grid', gap:10, marginTop:12, fontSize:14}}>
          {integrations.map((r,i) => (
            <div key={i} style={{display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 0', borderBottom: i < integrations.length - 1 ? '1px solid var(--line)' : 'none'}}>
              <div>
                <div style={{fontWeight:600}}>{r[0]}</div>
                <div className="mono" style={{fontSize:11, color:r[2]?'var(--eucalyptus)':'var(--ink-3)', marginTop:2}}>{r[1] ? r[1].toUpperCase() : '-'} · {r[2] ? 'CONNECTED' : 'DISCONNECTED'}</div>
              </div>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => onOpenModal(i)}>{r[2]?'Configure':'Connect'}</button>
            </div>
          ))}
        </div>
        <div className="row-flex" style={{gap:8, marginTop:12}}>
          <button className="btn btn-rust btn-sm" disabled={!integrationsDirty || sectionBusy==='integrations'}>{sectionBusy==='integrations'?'Saving…':'Save'}</button>
          <button type="button" className="btn btn-ghost btn-sm" disabled={!integrationsDirty || sectionBusy==='integrations'} onClick={() => setIntegrations(savedIntegrations)}>Cancel</button>
        </div>
      </form>
      {integrationModal && (
        <div style={{position:'fixed', inset:0, zIndex:500, background:'rgba(15,13,10,0.75)', display:'flex', flexDirection:'column', alignItems:'center', padding:'40px 16px', overflowY:'auto'}} onClick={() => setIntegrationModal(null)}>
          <div style={{width:'100%', maxWidth:480, background:'var(--paper)', padding:32, boxShadow:'0 16px 48px rgba(0,0,0,.35)'}} onClick={e => e.stopPropagation()}>
            <div style={{fontWeight:700, fontSize:16, marginBottom:16}}>
              {integrationModal.mode === 'add' ? 'Add Integration' : `Configure ${integrationForm.name}`}
            </div>
            {integrationModal.mode === 'add' && <>
              <label className="field"><span className="label">Name</span><input className="input" value={integrationForm.name} onChange={e => setIntegrationForm({...integrationForm, name: e.target.value})} placeholder="e.g. Mailchimp"/></label>
              {integrationForm.name === 'Stripe' && <>
                <label className="field"><span className="label">Secret Key</span><input className="input" value={integrationForm.secretKey} onChange={e => setIntegrationForm({...integrationForm, secretKey: e.target.value})} placeholder="sk_live_… or sk_test_…"/></label>
                <label className="field"><span className="label">Publishable Key</span><input className="input" value={integrationForm.publishableKey} onChange={e => setIntegrationForm({...integrationForm, publishableKey: e.target.value})} placeholder="pk_live_…"/></label>
                <label className="field"><span className="label">Webhook Secret</span><input className="input" value={integrationForm.webhookSecret} onChange={e => setIntegrationForm({...integrationForm, webhookSecret: e.target.value})} placeholder="whsec_…"/></label>
                <p style={{fontSize:11, color:'var(--ink-3)', margin:'-4px 0 8px'}}>Find these in Stripe Dashboard → Developers → API keys / Webhooks</p>
              </>}
              {integrationForm.name === 'Email' && <>
                <label className="field"><span className="label">SMTP Host</span><input className="input" value={integrationForm.host} onChange={e => setIntegrationForm({...integrationForm, host: e.target.value})} placeholder="smtp.gmail.com"/></label>
                <label className="field"><span className="label">SMTP Port</span><input className="input" value={integrationForm.port} onChange={e => setIntegrationForm({...integrationForm, port: e.target.value})} placeholder="587"/></label>
                <label className="field"><span className="label">Username</span><input className="input" value={integrationForm.user} onChange={e => setIntegrationForm({...integrationForm, user: e.target.value})} placeholder="you@gmail.com"/></label>
                <label className="field"><span className="label">Password / App password</span><input className="input" type="password" value={integrationForm.pass} onChange={e => setIntegrationForm({...integrationForm, pass: e.target.value})}/></label>
                <label className="field"><span className="label">Notification address</span><input className="input" value={integrationForm.notifyEmail} onChange={e => setIntegrationForm({...integrationForm, notifyEmail: e.target.value})} placeholder="orders@yourshop.com"/></label>
                <p style={{fontSize:11, color:'var(--ink-3)', margin:'-4px 0 8px'}}>Use a Gmail app password (not your account password)</p>
              </>}
              {integrationForm.name !== 'Stripe' && integrationForm.name !== 'Email' && <>
                <label className="field"><span className="label">Endpoint</span><input className="input" value={integrationForm.endpoint} onChange={e => setIntegrationForm({...integrationForm, endpoint: e.target.value})} placeholder="e.g. api.mailchimp.com"/></label>
                <label className="field"><span className="label">API Key</span><input className="input" value={integrationForm.apiKey} onChange={e => setIntegrationForm({...integrationForm, apiKey: e.target.value})}/></label>
                <label className="field"><span className="label">Notes</span><input className="input" value={integrationForm.notes} onChange={e => setIntegrationForm({...integrationForm, notes: e.target.value})}/></label>
              </>}
            </>}
            {integrationModal.mode === 'edit' && integrationForm.name === 'Stripe' && <>
              <label className="field"><span className="label">Secret Key</span><input className="input" value={integrationForm.secretKey} onChange={e => setIntegrationForm({...integrationForm, secretKey: e.target.value})} placeholder="sk_live_… or sk_test_…"/></label>
              <label className="field"><span className="label">Publishable Key</span><input className="input" value={integrationForm.publishableKey} onChange={e => setIntegrationForm({...integrationForm, publishableKey: e.target.value})} placeholder="pk_live_…"/></label>
              <label className="field"><span className="label">Webhook Secret</span><input className="input" value={integrationForm.webhookSecret} onChange={e => setIntegrationForm({...integrationForm, webhookSecret: e.target.value})} placeholder="whsec_…"/></label>
              <p style={{fontSize:11, color:'var(--ink-3)', margin:'-4px 0 8px'}}>Find these in Stripe Dashboard → Developers → API keys / Webhooks</p>
            </>}
            {integrationModal.mode === 'edit' && integrationForm.name === 'Email' && <>
              <label className="field"><span className="label">SMTP Host</span><input className="input" value={integrationForm.host} onChange={e => setIntegrationForm({...integrationForm, host: e.target.value})} placeholder="smtp.gmail.com"/></label>
              <label className="field"><span className="label">SMTP Port</span><input className="input" value={integrationForm.port} onChange={e => setIntegrationForm({...integrationForm, port: e.target.value})} placeholder="587"/></label>
              <label className="field"><span className="label">Username</span><input className="input" value={integrationForm.user} onChange={e => setIntegrationForm({...integrationForm, user: e.target.value})} placeholder="you@gmail.com"/></label>
              <label className="field"><span className="label">Password / App password</span><input className="input" type="password" value={integrationForm.pass} onChange={e => setIntegrationForm({...integrationForm, pass: e.target.value})}/></label>
              <label className="field"><span className="label">Notification address</span><input className="input" value={integrationForm.notifyEmail} onChange={e => setIntegrationForm({...integrationForm, notifyEmail: e.target.value})} placeholder="orders@yourshop.com"/></label>
              <p style={{fontSize:11, color:'var(--ink-3)', margin:'-4px 0 8px'}}>Use a Gmail app password (not your account password)</p>
            </>}
            {integrationModal.mode === 'edit' && integrationForm.name !== 'Stripe' && integrationForm.name !== 'Email' && <>
              <label className="field"><span className="label">Endpoint</span><input className="input" value={integrationForm.endpoint} onChange={e => setIntegrationForm({...integrationForm, endpoint: e.target.value})}/></label>
              <label className="field"><span className="label">API Key</span><input className="input" value={integrationForm.apiKey} onChange={e => setIntegrationForm({...integrationForm, apiKey: e.target.value})}/></label>
              <label className="field"><span className="label">Notes</span><input className="input" value={integrationForm.notes} onChange={e => setIntegrationForm({...integrationForm, notes: e.target.value})}/></label>
            </>}
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:16}}>
              <div className="row-flex" style={{gap:8}}>
                <button type="button" className="btn btn-rust btn-sm" onClick={onSaveModal}>{integrationModal.mode === 'add' ? 'Add' : 'Save'}</button>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setIntegrationModal(null)}>Cancel</button>
              </div>
              {integrationModal.mode === 'edit' && (
                <div className="row-flex" style={{gap:8}}>
                  {integrations[integrationModal.idx]?.[2] && <button type="button" className="btn btn-ghost btn-sm" style={{color:'var(--ink-3)'}} onClick={onDisconnect}>Disconnect</button>}
                  <button type="button" className="btn btn-ghost btn-sm" style={{color:'var(--rust)'}} onClick={onRemove}>Remove</button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
SettingsIntegrationsTab = React.memo(SettingsIntegrationsTab);

function SettingsSecurityTab({ security, setSecurity, savedSecurity, securityDirty, sectionBusy, onSubmit }) {
  return (
    <div style={{display:'grid', gap:24}}>
      <form onSubmit={onSubmit} style={{background:'var(--paper)', border:'1px solid var(--line)', padding:24, maxWidth:480}}>
        <span className="eyebrow">Admin credentials</span>
        <label className="field" style={{marginTop:12}}><span className="label">Admin username</span><input className="input" value={security.adminUsername} onChange={e => setSecurity({...security, adminUsername: e.target.value})}/></label>
        <label className="field"><span className="label">New password <span style={{fontWeight:400, color:'var(--ink-3)'}}>(leave blank to keep current)</span></span><input className="input" type="password" value={security.adminPassword} onChange={e => setSecurity({...security, adminPassword: e.target.value})}/></label>
        <label className="field"><span className="label">Confirm password</span><input className="input" type="password" value={security.confirmPassword} onChange={e => setSecurity({...security, confirmPassword: e.target.value})}/></label>
        {security.adminPassword && security.adminPassword !== security.confirmPassword && <div style={{fontSize:11, color:'var(--rust)', marginBottom:4}}>Passwords do not match</div>}
        <div className="row-flex" style={{gap:8, marginTop:12}}>
          <button className="btn btn-rust btn-sm" disabled={!securityDirty || sectionBusy==='security' || !!(security.adminPassword && security.adminPassword !== security.confirmPassword)}>{sectionBusy==='security'?'Saving…':'Save'}</button>
          <button type="button" className="btn btn-ghost btn-sm" disabled={!securityDirty || sectionBusy==='security'} onClick={() => setSecurity(savedSecurity)}>Cancel</button>
        </div>
      </form>
    </div>
  );
}
SettingsSecurityTab = React.memo(SettingsSecurityTab);

// Messages are prefixed '✓ ' at the source to mark success; this strips that
// sentinel and renders a proper icon instead of leaving the raw glyph on screen.
function DangerMsgLine({ msg, okColor = 'var(--eucalyptus)', errColor = 'var(--rust)' }) {
  if (!msg) return null;
  const ok = msg.startsWith('✓ ');
  return (
    <div style={{display:'flex', alignItems:'center', gap:5, fontSize:12, marginBottom:6, color: ok ? okColor : errColor}}>
      {ok && <Icon name="check" size={11} strokeWidth={3}/>}
      {ok ? msg.slice(2) : msg}
    </div>
  );
}

function SettingsAdvancedTab({ maintenanceEnabled, setMaintenanceEnabled, maintConfirm, setMaintConfirm, dangerMsg, setDangerMsg, sectionBusy, setSectionBusy }) {
  return (
    <div style={{display:'grid', gap:24}}>
      <div style={{background:'var(--paper)', border:'1px solid var(--line)', padding:24}}>
        <span className="eyebrow">Maintenance &amp; Data</span>
        <div style={{marginTop:14, display:'grid', gap:10}}>
          <div style={{padding:'14px', background:'var(--bg-elev)', border:'1px solid var(--line)'}}>
            <div style={{fontWeight:600}}>Rebuild search index</div>
            <p style={{fontSize:13, color:'var(--ink-2)', margin:'4px 0 8px'}}>Re-indexes products and tutorials.</p>
            <DangerMsgLine msg={dangerMsg.rebuild}/>
            <button className="btn btn-ghost btn-sm" disabled={sectionBusy==='rebuild'} onClick={async () => {
              setSectionBusy('rebuild');
              setDangerMsg(m => ({...m, rebuild:'Rebuilding…'}));
              await fetch('/api/admin/rebuild', { method:'POST', headers:postHeaders(), credentials:'include' }).catch(()=>null);
              setSectionBusy('');
              setDangerMsg(m => ({...m, rebuild:'✓ Index rebuilt.'}));
              setTimeout(() => setDangerMsg(m => ({...m, rebuild:''})), 4000);
            }}>{sectionBusy==='rebuild' ? 'Rebuilding…' : 'Run rebuild'}</button>
          </div>
          <div style={{padding:'14px', background:'var(--bg-elev)', border:'1px solid var(--line)'}}>
            <div style={{fontWeight:600}}>Export all data</div>
            <p style={{fontSize:13, color:'var(--ink-2)', margin:'4px 0 8px'}}>JSON dump of everything, products, orders, customers, content.</p>
            <DangerMsgLine msg={dangerMsg.export}/>
            <button className="btn btn-ghost btn-sm" disabled={sectionBusy==='export'} onClick={async () => {
              setSectionBusy('export');
              setDangerMsg(m => ({...m, export:'Generating…'}));
              const r = await fetch('/api/admin/export', { credentials:'include' }).catch(()=>null);
              setSectionBusy('');
              if (r && r.ok) {
                const blob = await r.blob();
                const a = document.createElement('a');
                a.href = URL.createObjectURL(blob);
                a.download = `outback-export-${new Date().toISOString().slice(0,10)}.json`;
                a.click();
                setDangerMsg(m => ({...m, export:'✓ Export downloaded.'}));
              } else {
                setDangerMsg(m => ({...m, export:'Export failed - check server logs.'}));
              }
              setTimeout(() => setDangerMsg(m => ({...m, export:''})), 5000);
            }}>{sectionBusy==='export' ? 'Generating…' : 'Generate export'}</button>
          </div>
          <div style={{padding:'14px', background:'#3a1a14', color:'var(--paper)', border:'1px solid #7a3a18'}}>
            <div style={{fontWeight:600, color:'#ffb59c'}}>Maintenance mode</div>
            <p style={{fontSize:13, margin:'4px 0 8px', color:'var(--bg-deep)'}}>Shows a holding page to non-staff visitors.</p>
            {maintenanceEnabled && <div style={{display:'flex', alignItems:'center', gap:6, fontSize:12, marginBottom:6, color:'#ffb59c', fontWeight:600}}><Icon name="alertTriangle" size={13}/> Maintenance mode is currently ON</div>}
            <DangerMsgLine msg={dangerMsg.maint} okColor="#ffb59c" errColor="#ffb59c"/>
            {maintenanceEnabled ? (
              <button className="btn btn-ghost btn-sm" disabled={sectionBusy==='maint'} onClick={async () => {
                setSectionBusy('maint');
                const r = await fetch('/api/admin/maintenance', { method:'POST', credentials:'include', headers:postHeaders(), body: JSON.stringify({ enabled: false }) }).catch(()=>null);
                setSectionBusy('');
                if (r && r.ok) { setMaintenanceEnabled(false); setDangerMsg(m => ({...m, maint:'✓ Maintenance mode disabled.'})); }
                else { setDangerMsg(m => ({...m, maint:'Error disabling maintenance mode.'})); }
              }}>{sectionBusy==='maint' ? 'Disabling…' : 'Disable maintenance'}</button>
            ) : !maintConfirm ? (
              <button className="btn btn-rust btn-sm" onClick={() => setMaintConfirm(true)}>Enable maintenance</button>
            ) : (
              <div className="row-flex" style={{gap:8, alignItems:'center'}}>
                <span style={{fontSize:12, color:'#ffb59c'}}>Are you sure? This will hide the site from visitors.</span>
                <button className="btn btn-ghost btn-sm" onClick={() => setMaintConfirm(false)}>Cancel</button>
                <button className="btn btn-rust btn-sm" disabled={sectionBusy==='maint'} onClick={async () => {
                  setSectionBusy('maint');
                  const r = await fetch('/api/admin/maintenance', { method:'POST', credentials:'include', headers:postHeaders(), body: JSON.stringify({ enabled: true }) }).catch(()=>null);
                  setSectionBusy('');
                  setMaintConfirm(false);
                  if (r && r.ok) { setMaintenanceEnabled(true); setDangerMsg(m => ({...m, maint:'✓ Maintenance mode enabled.'})); }
                  else { setDangerMsg(m => ({...m, maint:'Error enabling maintenance mode.'})); }
                }}>{sectionBusy==='maint' ? 'Enabling…' : 'Yes, enable'}</button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
SettingsAdvancedTab = React.memo(SettingsAdvancedTab);

// ============================================================
// SETTINGS FULL
// ============================================================
function AdminSettingsFull({ sessionInfo = {} }) {
  const defaultShop = useMemo(() => ({
    tradingName: '',
    abn: '',
    streetAddress: '',
    suburb: '',
    state: '',
    postcode: '',
    mapLat: '',
    mapLng: '',
    phone: '',
    email: '',
    tagline: '',
    description: '',
    siteUrl: '',
    acknowledgmentPeople: '',
    acknowledgmentCountry: '',
    bankAccountName: '',
    bankBsb: '',
    bankAccountNumber: '',
  }), []);
  const defaultAnnouncement = useMemo(() => ({ text: '', enabled: false, expiresAt: '' }), []);
  const defaultSiteContent = useMemo(() => ({ aiHeading: '', aiBody: '', aiEnabled: false, workshopBlurb: '', heroEyebrow: '', heroHeadline: '', heroSub: '' }), []);
  const [shop, setShop] = useState(defaultShop);
  const [savedShop, setSavedShop] = useState(defaultShop);
  const [announcement, setAnnouncement] = useState(defaultAnnouncement);
  const [savedAnnouncement, setSavedAnnouncement] = useState(defaultAnnouncement);
  const [siteContent, setSiteContent] = useState(defaultSiteContent);
  const [savedSiteContent, setSavedSiteContent] = useState(defaultSiteContent);
  const [integrations, setIntegrations] = useState([]);
  const [savedIntegrations, setSavedIntegrations] = useState([]);
  const defaultSecurity = useMemo(() => ({ adminUsername: '', adminPassword: '', confirmPassword: '' }), []);
  const [security, setSecurity] = useState(defaultSecurity);
  const [savedSecurity, setSavedSecurity] = useState(defaultSecurity);
  const [integrationModal, setIntegrationModal] = useState(null);
  const [integrationForm, setIntegrationForm] = useState({ name: '', endpoint: '', secretKey: '', publishableKey: '', webhookSecret: '', host: '', port: '', user: '', pass: '', notifyEmail: '', apiKey: '', notes: '' });
  const [staffMembers, setStaffMembers] = useState([]);
  const [staffForm, setStaffForm] = useState(null);
  const [staffBusy, setStaffBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusMsg, setStatusMsg] = useState('');
  const [sectionBusy, setSectionBusy] = useState('');
  const [dangerMsg, setDangerMsg] = useState({});
  const [maintConfirm, setMaintConfirm] = useState(false);
  const [maintenanceEnabled, setMaintenanceEnabled] = useState(false);
  const [settingsTab, setSettingsTab] = useState('general');

  const shopDirty = JSON.stringify(shop) !== JSON.stringify(savedShop);
  const announcementDirty = JSON.stringify(announcement) !== JSON.stringify(savedAnnouncement);
  const integrationsDirty = JSON.stringify(integrations) !== JSON.stringify(savedIntegrations);
  const siteContentDirty = JSON.stringify(siteContent) !== JSON.stringify(savedSiteContent);
  const securityDirty = security.adminUsername !== savedSecurity.adminUsername || !!security.adminPassword;
  const hasUnsavedChanges = shopDirty || announcementDirty || integrationsDirty || siteContentDirty || securityDirty;

  const loadStaff = () => fetch('/api/admin/staff', { credentials:'include' })
    .then(r => r.ok ? r.json() : Promise.reject()).then(d => setStaffMembers(d.members || [])).catch(() => {});

  useEffect(() => {
    fetch('/api/admin/settings', { credentials:'include' })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(d => {
        const nextShop = { ...defaultShop, ...(d.shop || {}) };
        const nextAnnouncement = { ...defaultAnnouncement, ...(d.announcement || {}) };
        const nextIntegrations = d.integrations || [];
        const nextSiteContent = { ...defaultSiteContent, ...(d.siteContent || {}) };
        const nextSecurity = { ...defaultSecurity, adminUsername: d.security?.adminUsername || '' };
        setShop(nextShop); setSavedShop(nextShop);
        setAnnouncement(nextAnnouncement); setSavedAnnouncement(nextAnnouncement);
        setIntegrations(nextIntegrations); setSavedIntegrations(nextIntegrations);
        setSiteContent(nextSiteContent); setSavedSiteContent(nextSiteContent);
        setSecurity(nextSecurity); setSavedSecurity(nextSecurity);
        setMaintenanceEnabled(!!(d.maintenance && d.maintenance.enabled));
      })
      .catch(() => setError('Failed to load settings.'))
      .finally(() => setLoading(false));
    loadStaff();
  }, [defaultShop]);

  useEffect(() => {
    const onBeforeUnload = (event) => {
      if (!hasUnsavedChanges) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [hasUnsavedChanges]);

  const persistSettings = async (payload, key) => {
    setSectionBusy(key);
    setStatusMsg('');
    const normalized = {
      shop: {
        tradingName: (payload.shop?.tradingName || '').trim(),
        abn: (payload.shop?.abn || '').trim(),
        streetAddress: (payload.shop?.streetAddress || '').trim(),
        suburb: (payload.shop?.suburb || '').trim(),
        state: (payload.shop?.state || '').trim(),
        postcode: (payload.shop?.postcode || '').trim(),
        mapLat: (payload.shop?.mapLat || '').trim(),
        mapLng: (payload.shop?.mapLng || '').trim(),
        phone: (payload.shop?.phone || '').trim(),
        email: (payload.shop?.email || '').trim(),
        tagline: (payload.shop?.tagline || '').trim(),
        description: (payload.shop?.description || '').trim(),
        siteUrl: (payload.shop?.siteUrl || '').trim(),
        acknowledgmentPeople: (payload.shop?.acknowledgmentPeople || '').trim(),
        acknowledgmentCountry: (payload.shop?.acknowledgmentCountry || '').trim(),
        bankAccountName: (payload.shop?.bankAccountName || '').trim(),
        bankBsb: (payload.shop?.bankBsb || '').trim(),
        bankAccountNumber: (payload.shop?.bankAccountNumber || '').trim(),
      },
      announcement: {
        text: (payload.announcement?.text || '').trim(),
        enabled: !!payload.announcement?.enabled,
        expiresAt: (payload.announcement?.expiresAt || '').trim(),
      },
      integrations: (payload.integrations || []).map(r => [r[0], r[1], !!r[2], r[3] || {}]),
      siteContent: {
        aiHeading: (payload.siteContent?.aiHeading || '').trim(),
        aiBody: (payload.siteContent?.aiBody || '').trim(),
        aiEnabled: !!payload.siteContent?.aiEnabled,
        workshopBlurb: (payload.siteContent?.workshopBlurb || '').trim(),
        heroEyebrow: (payload.siteContent?.heroEyebrow || '').trim(),
        heroHeadline: (payload.siteContent?.heroHeadline || '').trim(),
        heroSub: (payload.siteContent?.heroSub || '').trim(),
      },
      security: {
        adminUsername: (payload.security?.adminUsername || '').trim(),
        adminPassword: payload.security?.adminPassword || '',
      },
    };
    const r = await fetch('/api/admin/settings/save', { method:'POST', headers:postHeaders(), credentials:'include', body: JSON.stringify(normalized) }).catch(()=>null);
    setSectionBusy('');
    if (r && r.ok) {
      const d = await r.json();
      const reconciledShop = { ...defaultShop, ...(d.shop || {}) };
      const reconciledAnnouncement = { ...defaultAnnouncement, ...(d.announcement || {}) };
      const reconciledIntegrations = d.integrations || [];
      const reconciledSiteContent = { ...defaultSiteContent, ...(d.siteContent || {}) };
      const reconciledSecurity = { ...defaultSecurity, adminUsername: d.security?.adminUsername || '' };
      setShop(reconciledShop); setSavedShop(reconciledShop);
      setAnnouncement(reconciledAnnouncement); setSavedAnnouncement(reconciledAnnouncement);
      setIntegrations(reconciledIntegrations); setSavedIntegrations(reconciledIntegrations);
      setSiteContent(reconciledSiteContent); setSavedSiteContent(reconciledSiteContent);
      setSecurity(reconciledSecurity); setSavedSecurity(reconciledSecurity);
      setStatusMsg('Settings updated successfully.');
    } else setStatusMsg('Failed to update settings.');
  };

  const onShopSubmit = (e) => { e.preventDefault(); persistSettings({ shop, announcement: savedAnnouncement, integrations: savedIntegrations, siteContent: savedSiteContent, security: savedSecurity }, 'shop'); };
  const onAnnouncementSubmit = (e) => { e.preventDefault(); persistSettings({ shop: savedShop, announcement, integrations: savedIntegrations, siteContent: savedSiteContent, security: savedSecurity }, 'announcement'); };
  const onIntegrationsSubmit = (e) => { e.preventDefault(); persistSettings({ shop: savedShop, announcement: savedAnnouncement, integrations, siteContent: savedSiteContent, security: savedSecurity }, 'integrations'); };
  const onSiteContentSubmit = (e) => { e.preventDefault(); persistSettings({ shop: savedShop, announcement: savedAnnouncement, integrations: savedIntegrations, siteContent, security: savedSecurity }, 'siteContent'); };
  const onSecuritySubmit = (e) => { e.preventDefault(); persistSettings({ shop: savedShop, announcement: savedAnnouncement, integrations: savedIntegrations, siteContent: savedSiteContent, security }, 'security'); };

  const openIntegrationModal = (idx) => {
    const r = integrations[idx];
    const cfg = r[3] || {};
    setIntegrationForm({ name: r[0], endpoint: r[1], secretKey: cfg.secretKey || '', publishableKey: cfg.publishableKey || '', webhookSecret: cfg.webhookSecret || '', host: cfg.host || '', port: cfg.port || '', user: cfg.user || '', pass: cfg.pass || '', notifyEmail: cfg.notifyEmail || '', apiKey: cfg.apiKey || '', notes: cfg.notes || '' });
    setIntegrationModal({ mode: 'edit', idx });
  };
  const openAddIntegrationModal = () => {
    setIntegrationForm({ name: '', endpoint: '', secretKey: '', webhookSecret: '', apiKey: '', notes: '' });
    setIntegrationModal({ mode: 'add', idx: null });
  };
  const saveIntegrationModal = () => {
    const { mode, idx } = integrationModal;
    const isStripe = integrationForm.name === 'Stripe';
    const isEmail = integrationForm.name === 'Email';
    const config = isStripe
      ? { secretKey: integrationForm.secretKey, publishableKey: integrationForm.publishableKey, webhookSecret: integrationForm.webhookSecret }
      : isEmail
      ? { host: integrationForm.host, port: integrationForm.port, user: integrationForm.user, pass: integrationForm.pass, notifyEmail: integrationForm.notifyEmail }
      : { apiKey: integrationForm.apiKey, notes: integrationForm.notes };
    if (mode === 'add') {
      if (!integrationForm.name.trim()) return;
      const defaultEndpoints = { Stripe: 'api.stripe.com', Email: integrationForm.host || 'smtp.gmail.com', AusPost: 'digitalapi.auspost.com.au' };
      const endpoint = integrationForm.endpoint.trim() || defaultEndpoints[integrationForm.name] || '';
      setIntegrations([...integrations, [integrationForm.name.trim(), endpoint, true, config]]);
    } else {
      setIntegrations(integrations.map((r, i) => i === idx ? [r[0], integrationForm.endpoint.trim(), true, config] : r));
    }
    setIntegrationModal(null);
  };
  const disconnectIntegration = () => {
    const { idx } = integrationModal;
    setIntegrations(integrations.map((r, i) => i === idx ? [r[0], r[1], false, {}] : r));
    setIntegrationModal(null);
  };
  const removeIntegration = () => {
    const { idx } = integrationModal;
    setIntegrations(integrations.filter((_, i) => i !== idx));
    setIntegrationModal(null);
  };

  const openStaffForm = (member) => setStaffForm(member ? { ...member, pin:'' } : { name:'', role:'staff', color:'#d7c7a6', email:'', phone:'', status:'active', pin:'' });
  const saveStaffMember = async () => {
    if (!staffForm.name.trim()) return;
    if (!staffForm.id && !/^\d{4,6}$/.test(staffForm.pin || '')) { alert('PIN must be 4–6 digits.'); return; }
    if (staffForm.pin && !/^\d{4,6}$/.test(staffForm.pin)) { alert('PIN must be 4–6 digits.'); return; }
    setStaffBusy(true);
    const r = await fetch('/api/admin/staff/members/save', { method:'POST', headers:postHeaders(), credentials:'include', body: JSON.stringify({ ...staffForm, name: staffForm.name.trim() }) }).catch(()=>null);
    setStaffBusy(false);
    if (!r || !r.ok) { adminToast('Failed to save staff member.'); return; }
    setStaffForm(null);
    loadStaff();
  };
  const deleteStaffMember = async (id) => {
    const r = await fetch('/api/admin/staff/members/delete', { method:'POST', headers:postHeaders(), credentials:'include', body: JSON.stringify({ id }) }).catch(()=>null);
    if (!r || !r.ok) { adminToast('Failed to delete staff member.'); return; }
    loadStaff();
  };

  return (
    <div style={{padding:32, maxWidth:960}}>
      {loading && <div className="mono" style={{fontSize:12, color:'var(--ink-2)', marginBottom:16}}>Loading…</div>}
      {error && <div style={{fontSize:12, color:'var(--rust)', marginBottom:12}}>{error}</div>}
      {statusMsg && <div style={{fontSize:12, color:statusMsg.includes('Failed') || statusMsg.includes('must') ? 'var(--rust)' : 'var(--eucalyptus)', marginBottom:12}}>{statusMsg}</div>}

      <div className="tabs" style={{marginBottom:28}}>
        {[['general','General'],['staff','Staff'],['integrations','Integrations'],['security','Security'],['advanced','Advanced']].map(([k,l]) => (
          <div key={k} role="button" tabIndex={0} className={`tab ${settingsTab===k?'active':''}`} style={{cursor:'pointer'}} onClick={() => setSettingsTab(k)} onKeyDown={e => { if (e.key==='Enter'||e.key===' ') { e.preventDefault(); setSettingsTab(k); } }}>{l}</div>
        ))}
      </div>

      {settingsTab === 'general' && (
        <SettingsGeneralTab
          shop={shop} setShop={setShop} savedShop={savedShop}
          announcement={announcement} setAnnouncement={setAnnouncement} savedAnnouncement={savedAnnouncement}
          siteContent={siteContent} setSiteContent={setSiteContent} savedSiteContent={savedSiteContent}
          shopDirty={shopDirty} announcementDirty={announcementDirty} siteContentDirty={siteContentDirty}
          sectionBusy={sectionBusy}
          onShopSubmit={onShopSubmit} onAnnouncementSubmit={onAnnouncementSubmit} onSiteContentSubmit={onSiteContentSubmit}
        />
      )}

      {settingsTab === 'staff' && (
        <SettingsStaffTab
          staffMembers={staffMembers}
          staffForm={staffForm} setStaffForm={setStaffForm} staffBusy={staffBusy}
          onSave={saveStaffMember} onDelete={deleteStaffMember} onOpenForm={openStaffForm}
          sessionInfo={sessionInfo}
        />
      )}

      {settingsTab === 'integrations' && (
        <SettingsIntegrationsTab
          integrations={integrations} setIntegrations={setIntegrations} savedIntegrations={savedIntegrations}
          integrationModal={integrationModal} setIntegrationModal={setIntegrationModal}
          integrationForm={integrationForm} setIntegrationForm={setIntegrationForm}
          integrationsDirty={integrationsDirty} sectionBusy={sectionBusy}
          onSubmit={onIntegrationsSubmit}
          onOpenModal={openIntegrationModal} onOpenAddModal={openAddIntegrationModal}
          onSaveModal={saveIntegrationModal} onDisconnect={disconnectIntegration} onRemove={removeIntegration}
        />
      )}

      {settingsTab === 'security' && (
        <SettingsSecurityTab
          security={security} setSecurity={setSecurity} savedSecurity={savedSecurity}
          securityDirty={securityDirty} sectionBusy={sectionBusy}
          onSubmit={onSecuritySubmit}
        />
      )}

      {settingsTab === 'advanced' && (
        <SettingsAdvancedTab
          maintenanceEnabled={maintenanceEnabled} setMaintenanceEnabled={setMaintenanceEnabled}
          maintConfirm={maintConfirm} setMaintConfirm={setMaintConfirm}
          dangerMsg={dangerMsg} setDangerMsg={setDangerMsg}
          sectionBusy={sectionBusy} setSectionBusy={setSectionBusy}
        />
      )}
    </div>
  );
}


// ============================================================
// MEMBERSHIPS
// ============================================================
function AdminMemberships() {
  const [tiers, setTiers] = useState([]);
  const [subs, setSubs] = useState([]);
  const [pendingOrders, setPendingOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('tiers');
  const [edit, setEdit] = useState(null);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const [activating, setActivating] = useState(null);

  const reload = () => {
    setLoading(true);
    Promise.all([
      fetch('/api/admin/memberships', { credentials: 'include' }).then(r => r.ok ? r.json() : Promise.reject()),
      fetch('/api/admin/orders', { credentials: 'include' }).then(r => r.ok ? r.json() : Promise.reject()),
    ]).then(([mb, ord]) => {
      setTiers(mb.tiers || []);
      setSubs(mb.subscriptions || []);
      setPendingOrders((ord.items || []).filter(o => o.pendingMembershipActivation));
    }).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => { reload(); }, []);

  const openTier = (i) => {
    setEdit(i);
    setForm(i === 'new'
      ? { name: '', price: '', billingCycle: 'one-off', description: '', features: '', color: '', highlight: false, status: 'draft' }
      : { ...tiers[i], features: Array.isArray(tiers[i].features) ? tiers[i].features.join('\n') : (tiers[i].features || '') });
  };

  const saveTier = async (status) => {
    setSaving(true);
    setNotice('');
    const payload = {
      ...form,
      status: status || form.status || 'draft',
      price: Number(form.price) || 0,
      priceAud: Number(form.price) || 0,
      features: (form.features || '').split('\n').map(s => s.trim()).filter(Boolean),
    };
    if (!payload.name) { setNotice('Name is required.'); setSaving(false); return; }
    if (!payload.id) payload.id = 'tier-' + Date.now();
    const r = await fetch('/api/admin/memberships/tiers/save', {
      method: 'POST', headers: postHeaders(), credentials: 'include', body: JSON.stringify(payload),
    }).catch(() => null);
    setSaving(false);
    if (r && r.ok) {
      const d = await r.json();
      if (edit === 'new') setTiers(ts => [...ts, d.item]);
      else setTiers(ts => ts.map((t, i) => i === edit ? d.item : t));
      setEdit(null);
    } else {
      setNotice('Save failed.');
    }
  };

  const deleteTier = async () => {
    const tier = tiers[edit];
    await fetch('/api/admin/memberships/tiers/delete', {
      method: 'POST', headers: postHeaders(), credentials: 'include', body: JSON.stringify({ id: tier.id }),
    }).catch(() => null);
    setTiers(ts => ts.filter((_, i) => i !== edit));
    setEdit(null);
  };

  const activatePending = async (order) => {
    setActivating(order.id);
    const r = await fetch('/api/admin/memberships/activate', {
      method: 'POST', headers: postHeaders(), credentials: 'include',
      body: JSON.stringify({ orderId: order.id }),
    }).catch(() => null);
    setActivating(null);
    if (r && r.ok) reload();
  };

  const cancelSub = async (subId) => {
    await fetch('/api/admin/memberships/subscriptions/cancel', {
      method: 'POST', headers: postHeaders(), credentials: 'include', body: JSON.stringify({ subId }),
    }).catch(() => null);
    setSubs(ss => ss.map(s => s.id === subId ? { ...s, status: 'cancelled' } : s));
  };

  const subStatusMap = {
    active:    { bg: '#d8e7d0', fg: '#345526' },
    cancelled: { bg: 'var(--bg-deep)', fg: 'var(--ink-2)' },
    expired:   { bg: '#f3d5c5', fg: '#7a3a18' },
  };

  if (loading) return <div style={{ padding: 32, color: 'var(--ink-2)', fontSize: 13 }}>Loading…</div>;

  return (
    <div style={{ padding: 32 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 28 }}>
        <StatTile label="TIERS PUBLISHED" value={tiers.filter(t => t.status === 'published').length} />
        <StatTile label="ACTIVE SUBSCRIPTIONS" value={subs.filter(s => s.status === 'active').length} />
        <StatTile label="PENDING ACTIVATION" value={pendingOrders.length} tone={pendingOrders.length > 0 ? 'rust' : undefined} />
      </div>

      <div className="tabs" style={{ marginBottom: 20 }}>
        <div role="button" tabIndex={0} className={`tab ${tab === 'tiers' ? 'active' : ''}`} onClick={() => setTab('tiers')} onKeyDown={e => { if (e.key==='Enter'||e.key===' ') { e.preventDefault(); setTab('tiers'); } }}>
          Tiers ({tiers.length})
        </div>
        <div role="button" tabIndex={0} className={`tab ${tab === 'subs' ? 'active' : ''}`} onClick={() => setTab('subs')} onKeyDown={e => { if (e.key==='Enter'||e.key===' ') { e.preventDefault(); setTab('subs'); } }}>
          Subscriptions ({subs.length})
        </div>
        {pendingOrders.length > 0 && (
          <div role="button" tabIndex={0} className={`tab ${tab === 'pending' ? 'active' : ''}`} onClick={() => setTab('pending')} onKeyDown={e => { if (e.key==='Enter'||e.key===' ') { e.preventDefault(); setTab('pending'); } }}>
            Pending activation ({pendingOrders.length})
          </div>
        )}
        <div style={{ flex: 1 }} />
        {tab === 'tiers' && (
          <button className="btn btn-rust btn-sm" onClick={() => openTier('new')}>+ New tier</button>
        )}
      </div>

      {tab === 'tiers' && (
        <>
          {tiers.length === 0
            ? <div className="mono" style={{ fontSize: 13, color: 'var(--ink-2)', padding: '18px 0' }}>No tiers yet. Create one to enable memberships on the public site.</div>
            : <Table
                columns={[
                  { key: 'name', label: 'Name', w: '1.5fr', render: r => <span style={{ fontWeight: 600 }}>{r.name}</span> },
                  { key: 'price', label: 'Price', w: '100px', render: r => { const cycle = r.billingCycle || 'one-off'; return <span className="mono" style={{ fontWeight: 600 }}>${r.price || r.priceAud || 0}<span style={{ fontWeight: 400, fontSize: 11, color: 'var(--ink-2)' }}>{cycle === 'one-off' ? ' one-off' : `/${cycle}`}</span></span>; } },
                  { key: 'features', label: 'Features', w: '2fr', render: r => <span style={{ fontSize: 12, color: 'var(--ink-2)' }}>{(Array.isArray(r.features) ? r.features : []).slice(0, 3).join(' · ')}</span> },
                  { key: 'status', label: 'Status', w: '120px', render: r => (
                    <span className="tag" style={{
                      background: r.status === 'published' ? '#d8e7d0' : 'var(--bg-deep)',
                      color: r.status === 'published' ? '#345526' : 'var(--ink-2)',
                      borderColor: 'transparent',
                    }}>{(r.status || 'draft').toUpperCase()}</span>
                  )},
                  { key: 'highlight', label: 'Featured', w: '90px', render: r => r.highlight ? <span className="tag tag-rust" style={{ fontSize: 10 }}>YES</span> : <span style={{ color: 'var(--ink-3)', fontSize: 12 }}>-</span> },
                ]}
                rows={tiers}
                onRowClick={(_, i) => openTier(i)}
              />
          }
        </>
      )}

      {tab === 'subs' && (
        <>
          {subs.length === 0
            ? <div className="mono" style={{ fontSize: 13, color: 'var(--ink-2)', padding: '18px 0' }}>No subscriptions yet.</div>
            : <Table
                columns={[
                  { key: 'userId', label: 'User', w: '1.5fr', render: r => <span style={{ fontWeight: 500 }}>{r.username || r.userId}</span> },
                  { key: 'tierId', label: 'Tier', w: '1fr', render: r => {
                    const tier = tiers.find(t => t.id === r.tierId);
                    return <span>{tier ? tier.name : r.tierId}</span>;
                  }},
                  { key: 'startDate', label: 'Since', w: '130px', render: r => <span className="mono" style={{ fontSize: 11, color: 'var(--ink-2)' }}>{(r.startDate || '').slice(0, 10)}</span> },
                  { key: 'orderId', label: 'Order', w: '130px', render: r => <span className="mono" style={{ fontSize: 11, color: 'var(--rust)' }}>{r.orderId || '-'}</span> },
                  { key: 'status', label: 'Status', w: '110px', render: r => <StatusPill value={r.status || 'active'} map={subStatusMap} /> },
                  { key: 'actions', label: '', w: '100px', render: r => r.status === 'active'
                    ? <button className="btn btn-ghost btn-sm" style={{ fontSize: 11, color: 'var(--rust)' }} onClick={e => { e.stopPropagation(); cancelSub(r.id); }}>Cancel</button>
                    : null,
                  },
                ]}
                rows={subs}
              />
          }
        </>
      )}

      {tab === 'pending' && (
        <div style={{ display: 'grid', gap: 12 }}>
          {pendingOrders.length === 0
            ? <div className="mono" style={{ fontSize: 13, color: 'var(--ink-2)', padding: '18px 0' }}>None.</div>
            : pendingOrders.map((o, i) => (
              <div key={i} style={{ padding: 18, background: 'var(--paper)', border: '1px solid var(--line)', borderLeft: '3px solid var(--ochre)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
                <div>
                  <div style={{ fontWeight: 600 }}>{o.cust || 'Unknown customer'}</div>
                  <div className="mono" style={{ fontSize: 11, color: 'var(--ink-2)', marginTop: 4 }}>
                    Order {o.id} · {o.pendingMembershipActivation.email} · Tier: {o.pendingMembershipActivation.tierId}
                  </div>
                </div>
                <button className="btn btn-rust btn-sm" disabled={activating === o.id} onClick={() => activatePending(o)}>
                  {activating === o.id ? 'Activating…' : <>Activate <Icon name="chevronRight" size={11}/></>}
                </button>
              </div>
            ))
          }
        </div>
      )}

      {edit !== null && (
        <Drawer
          open={true}
          onClose={() => { setEdit(null); setNotice(''); }}
          title={edit === 'new' ? 'New membership tier' : (tiers[edit]?.name || 'Edit tier')}
          footer={
            <div className="row-flex" style={{ justifyContent: 'space-between' }}>
              {edit !== 'new'
                ? <button className="btn btn-ghost btn-sm" style={{ color: 'var(--rust)' }} onClick={deleteTier}>Delete</button>
                : <span />}
              <div className="row-flex" style={{ gap: 8 }}>
                <button className="btn btn-ghost btn-sm" onClick={() => { setEdit(null); setNotice(''); }}>Cancel</button>
                <button className="btn btn-ghost btn-sm" disabled={saving} onClick={() => saveTier('draft')}>Save draft</button>
                <button className="btn btn-rust btn-sm" disabled={saving} onClick={() => saveTier('published')}>Publish <Icon name="chevronRight" size={11}/></button>
              </div>
            </div>
          }
        >
          {notice && <div style={{ marginBottom: 12, fontSize: 13, color: 'var(--rust)' }}>{notice}</div>}
          <label className="field"><span className="label">Name</span>
            <input className="input" placeholder="e.g. Mate, Cobber, Legend" value={form.name || ''} onChange={e => setForm({ ...form, name: e.target.value })} />
          </label>
          <label className="field"><span className="label">Price (AUD / billing cycle)</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <input className="input" type="number" min="0" step="0.01" placeholder="0.00" value={form.price || ''} onChange={e => setForm({ ...form, price: e.target.value })} style={{ flex: 1 }} />
              <select className="select" value={form.billingCycle || 'one-off'} onChange={e => setForm({ ...form, billingCycle: e.target.value })} style={{ width: 110 }}>
                <option value="one-off">one-off</option>
                <option value="month">/ month</option>
                <option value="year">/ year</option>
              </select>
            </div>
          </label>
          <label className="field"><span className="label">Short description</span>
            <input className="input" placeholder="One-line tagline" value={form.description || ''} onChange={e => setForm({ ...form, description: e.target.value })} />
          </label>
          <label className="field"><span className="label">Features (one per line)</span>
            <textarea className="textarea" style={{ minHeight: 120 }} placeholder={"10% off all products\nPriority repair queue\nExclusive member events"} value={form.features || ''} onChange={e => setForm({ ...form, features: e.target.value })} />
          </label>
          <label className="field"><span className="label">Shop discount %</span>
            <input className="input" type="number" min="0" max="100" step="0.01" placeholder="0" value={form.discountPercent || ''} onChange={e => setForm({ ...form, discountPercent: e.target.value })} />
          </label>
          <label className="field"><span className="label">Card accent colour (CSS value, optional)</span>
            <input className="input" placeholder="e.g. #1f88f5 or var(--rust)" value={form.color || ''} onChange={e => setForm({ ...form, color: e.target.value })} />
          </label>
          <label className="field" style={{ flexDirection: 'row', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
            <input type="checkbox" checked={!!form.highlight} onChange={e => setForm({ ...form, highlight: e.target.checked })} />
            <span className="label" style={{ margin: 0 }}>Featured / highlighted tier</span>
          </label>
        </Drawer>
      )}
    </div>
  );
}

// ============================================================
// ADMIN PAGE, top-level
// ============================================================
const METRIC_SUBTITLE_FALLBACK = {
  loading: 'Loading metrics…',
  error: 'Metrics unavailable',
};

function formatMetricSubtitle(section, metrics, fallbackState = 'loading') {
  if (!metrics || !metrics.subtitles) return METRIC_SUBTITLE_FALLBACK[fallbackState] || METRIC_SUBTITLE_FALLBACK.loading;
  return metrics.subtitles[section] || null;
}

function AdminAuditLog() {
  const [entries, setEntries] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const limit = 100;

  useEffect(() => {
    setLoading(true);
    fetch(`/api/admin/audit-log?limit=${limit}&offset=${page * limit}`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(d => { setEntries(d.entries || []); setTotal(d.total || 0); })
      .catch(() => setEntries([]))
      .finally(() => setLoading(false));
  }, [page]);

  const pageCount = Math.max(1, Math.ceil(total / limit));
  const actionColor = (a) => {
    if (a.includes('delete')) return '#c0392b';
    if (a.includes('refund') || a.includes('void')) return '#e67e22';
    if (a.includes('login') || a.includes('logout')) return '#2980b9';
    return 'var(--ink-2)';
  };

  return (
    <div style={{padding:32}}>
      <div className="row-flex" style={{justifyContent:'space-between', marginBottom:18}}>
        <span className="mono" style={{fontSize:11, color:'var(--ink-3)'}}>// {total} ENTRIES · PAGE {page + 1} OF {pageCount}</span>
        <div className="row-flex" style={{gap:8}}>
          <button className="btn btn-ghost btn-sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}><Icon name="chevronLeft" size={12}/> Prev</button>
          <button className="btn btn-ghost btn-sm" disabled={page >= pageCount - 1} onClick={() => setPage(p => p + 1)}>Next <Icon name="chevronRight" size={12}/></button>
        </div>
      </div>
      {loading ? <div style={{color:'var(--ink-2)', fontSize:13}}>Loading…</div> : entries.length === 0 ? (
        <div style={{color:'var(--ink-2)', fontSize:13}}>No audit entries found.</div>
      ) : (
        <div style={{overflowX:'auto'}}>
          <table style={{width:'100%', borderCollapse:'collapse', fontSize:12}}>
            <thead>
              <tr style={{borderBottom:'1px solid var(--line)'}}>
                {['Timestamp','Actor','IP','Action','Status','Detail'].map(h => (
                  <th key={h} className="mono" style={{textAlign:'left', padding:'6px 10px', fontSize:10, color:'var(--ink-3)', fontWeight:500, whiteSpace:'nowrap'}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {entries.map((e, i) => (
                <tr key={i} style={{borderBottom:'1px solid var(--line)', background: i % 2 === 0 ? 'transparent' : 'var(--bg-elev)'}}>
                  <td className="mono" style={{padding:'5px 10px', whiteSpace:'nowrap', color:'var(--ink-2)', fontSize:11}}>{e.timestamp ? new Date(e.timestamp).toLocaleString('en-AU') : '-'}</td>
                  <td style={{padding:'5px 10px', whiteSpace:'nowrap'}}>{e.actor || '-'}</td>
                  <td className="mono" style={{padding:'5px 10px', whiteSpace:'nowrap', color:'var(--ink-2)'}}>{e.ip || '-'}</td>
                  <td style={{padding:'5px 10px', whiteSpace:'nowrap', color: actionColor(e.action || '')}}>{e.action || '-'}</td>
                  <td style={{padding:'5px 10px', whiteSpace:'nowrap'}}>
                    <span style={{fontSize:10, padding:'2px 6px', borderRadius:2, background: e.status === 'ok' ? '#d4edda' : '#f8d7da', color: e.status === 'ok' ? '#155724' : '#721c24'}}>{e.status || '-'}</span>
                  </td>
                  <td className="mono" style={{padding:'5px 10px', color:'var(--ink-2)', maxWidth:320, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', fontSize:11}} title={JSON.stringify(e.changed || {})}>{e.reason || JSON.stringify(e.changed || {})}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const ADMIN_VIEWS = {
  overview:   { c: AdminOverview,   t:'Overview',         staticSubtitle:'shop heartbeat · today' },
  orders:     { c: AdminOrders,     t:'Orders' },
  'payment-plans': { c: PaymentPlansView, t:'Payment Plans', staticSubtitle:'active instalment plans · due dates · status' },
  repairs:    { c: AdminRepairs,    t:'Repair Jobs' },
  'hdd-reports': { c: AdminHddReports, t:'HDD Condition Reports', staticSubtitle:'S.M.A.R.T. summary · condition notes · printable PDF' },
  quotes:     { c: AdminQuotes,     t:'Quotes' },
  'pc-builder': { c: AdminPcBuilder, t:'PC Builder', staticSubtitle:'pick parts · check fit and compatibility · quote it' },
  reviews:    { c: AdminReviews,    t:'Reviews',           staticSubtitle:'pending · approved · rejected' },
  ewaste:     { c: AdminEwaste,     t:'eWaste Intake' },
  bookings:   { c: AdminBookings,   t:'Bookings' },
  availability: { c: AdminAvailability, t:'Availability', staticSubtitle:'operating hours · blocked days & slots' },
  products:   { c: AdminProducts,   t:'Products' },
  services:   { c: AdminServices,   t:'Services' },
  software:   { c: AdminSoftware,   t:'Software' },
  tutorials:  { c: AdminTutorials,  t:'Tutorials' },
  ai:         { c: AdminAI,         t:'AI Models & Boxes' },
  policies:   { c: AdminPolicies,   t:'Policies',          staticSubtitle:'legal & policy documents · draft · publish' },
  groups:     { c: AdminGroups,     t:'Groups' },
  customers:  { c: AdminCustomers,  t:'Customers' },
  sellers:    { c: AdminSellers,    t:'Sellers' },
  clients:    { c: AdminClients,    t:'Clients',          staticSubtitle:'named on the public site with permission' },
  memberships: { c: AdminMemberships, t:'Memberships', staticSubtitle:'tiers · subscriptions · activation' },
  'gift-cards': { c: AdminGiftCards, t:'Gift Cards',        staticSubtitle:'issued codes · balances · manual issuance' },
  'rewards':    { c: AdminRewards,   t:'Rewards',           staticSubtitle:'points balances · history · manual adjustments' },
  'store-credit': { c: AdminStoreCredit, t:'Store Credit',  staticSubtitle:'credit balances · history · manual adjustments' },
  analytics:  { c: AdminAnalytics,  t:'Analytics',        staticSubtitle:'page views · top pages · referrers · devices' },
  expenses:     { c: AdminExpenses,     t:'Expenses',          staticSubtitle:'track costs · receipt uploads' },
  'tax-reports': { c: AdminTaxReports, t:'Tax Reports',       staticSubtitle:'P&L · GST summary · monthly breakdown · PDF export' },
  settings:   { c: AdminSettings,   t:'Settings',         staticSubtitle:'shop · staff · integrations' },
  'seller-billing': { c: AdminSellerBilling, t:'Seller Billing', staticSubtitle:'listing fees · balances · card management' },
  'audit-log': { c: AdminAuditLog, t:'Audit Log', staticSubtitle:'admin actions · actor · timestamp · detail' },
};

const ADMIN_ALL_IDS = new Set([
  'overview','orders','payment-plans','repairs','hdd-reports','quotes','pc-builder','reviews','ewaste','bookings','availability',
  'products','services','software','tutorials','ai',
  'groups','customers','sellers','clients',
  'memberships','gift-cards','rewards','expenses','tax-reports','policies','seller-billing','settings','audit-log',
]);

function adminSectionFromPath() {
  const seg = window.location.pathname.replace(/^\/+/, '').split('/')[0];
  return ADMIN_ALL_IDS.has(seg) ? seg : 'overview';
}

function AdminPage({ go }) {
  const [sessionInfo, setSessionInfo] = useState({ authed: false, role: null, username: null, staffId: null });
  const [checking, setChecking] = useState(true);
  const [section, setSection] = useState(adminSectionFromPath);
  const [search, setSearch] = useState('');
  const [metrics, setMetrics] = useState(null);
  const [metricsState, setMetricsState] = useState('loading');
  const [siteUrl, setSiteUrl] = useState('');

  const fetchSession = (mounted = true) =>
    fetch('/api/admin/session', { credentials: 'include' })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(d => { if (mounted) setSessionInfo({ authed: !!d.authenticated, role: d.role || null, username: d.username || null, staffId: d.staffId || null }); })
      .catch(() => { if (mounted) setSessionInfo({ authed: false, role: null, username: null }); });

  useEffect(() => {
    let mounted = true;
    ensureCsrf();
    fetchSession(mounted).finally(() => { if (mounted) setChecking(false); });
    fetch('/api/shop-info').then(r => r.json()).then(d => {
      const url = d.siteUrl || d.shop?.siteUrl;
      if (mounted && url) setSiteUrl(url);
    }).catch(() => {});
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    const target = '/' + section;
    if (window.location.pathname !== target) window.history.pushState({}, '', target);
  }, [section]);

  useEffect(() => {
    const onPop = () => {
      const s = adminSectionFromPath();
      setSection(s);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  useEffect(() => {
    if (!sessionInfo.authed) return;
    setMetricsState('loading');
    fetch('/api/admin/metrics', { credentials: 'include' })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(d => { setMetrics(d); setMetricsState('ready'); })
      .catch(() => { setMetrics(null); setMetricsState('error'); });
  }, [sessionInfo.authed]);

  const myLevel = ROLE_LEVELS[sessionInfo.role] ?? 0;
  const allItems = ADMIN_SECTIONS.flatMap(g => g.items);
  const canAccess = (id) => {
    const it = allItems.find(x => x.id === id);
    if (!it) return false;
    if ((ROLE_LEVELS[it.minRole] ?? 0) > myLevel) return false;
    if (it.excludeRoles && it.excludeRoles.includes(sessionInfo.role)) return false;
    return true;
  };
  const effectiveSection = canAccess(section) ? section : (allItems.find(it => (ROLE_LEVELS[it.minRole] ?? 0) <= myLevel)?.id || 'repairs');

  if (checking) return <div style={{minHeight:'100vh', display:'grid', placeItems:'center'}}>Checking session…</div>;
  if (!sessionInfo.authed) return <AdminLogin onAuth={() => { setChecking(true); fetchSession(true).finally(() => setChecking(false)); }} siteUrl={siteUrl} />;

  const view = ADMIN_VIEWS[effectiveSection] || ADMIN_VIEWS.overview;
  const subtitle = view.staticSubtitle || formatMetricSubtitle(effectiveSection, metrics, metricsState);
  const Body = view.c;
  return (
    <div style={{display:'flex', minHeight:'100vh', background:'var(--bg)'}}>
      <AdminSidebar section={effectiveSection} setSection={s => {
        // Reset the query string synchronously so one section's record/tab
        // params don't leak into the next section's freshly-mounted view.
        if (s !== effectiveSection) window.history.pushState({}, '', '/' + s);
        setSection(s); setSearch('');
      }} role={sessionInfo.role} username={sessionInfo.username}
        onSignOut={async () => { await fetch('/api/admin/logout', { method:'POST', headers:postHeaders(), credentials:'include' }); setSessionInfo({ authed: false, role: null, username: null }); }} />
      <div style={{flex:1, minWidth:0}}>
        <AdminTopbar title={view.t} subtitle={subtitle} search={search} onSearch={setSearch}
          actions={
            <div className="row-flex" style={{gap:8}}>
              <a className="btn btn-ghost btn-sm" href={siteUrl ? siteUrl + '/home' : '/'} target="_blank" rel="noreferrer" style={{textDecoration:'none'}} title="Open public site in a new tab">View public site <Icon name="externalLink" size={11}/></a>
            </div>
          }
        />
        <div className="admin-section-root">
          <Body sessionInfo={sessionInfo} search={search} siteUrl={siteUrl} />
        </div>
      </div>
    </div>
  );
}

export default AdminPage;
