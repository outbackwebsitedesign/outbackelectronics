import React, { useState, useEffect, useMemo } from 'react';

function getCsrf() {
  return document.cookie.split(';').reduce((v, c) => {
    const [k, val] = c.trim().split('=');
    return k === '_csrf' ? decodeURIComponent(val || '') : v;
  }, '');
}
let _csrfReady = null;
function ensureCsrf() {
  if (!_csrfReady) _csrfReady = fetch('/api/csrf-token', { credentials: 'include' }).catch(() => {});
  return _csrfReady;
}
function postHeaders() { return { 'Content-Type': 'application/json', 'X-CSRF-Token': getCsrf() }; }

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

// ============================================================
// LOGIN
// ============================================================
function AdminLogin({ onAuth }) {
  const [u, setU] = useState('');
  const [p, setP] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { ensureCsrf(); }, []);
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
        else setErr('Invalid username or password / PIN.');
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
    <div style={{minHeight:'100vh', background:'#0f0d0a', color:'var(--paper)', display:'grid', placeItems:'center', padding:24}}>
      <div style={{width:'100%', maxWidth: 420}}>
        <div style={{display:'flex', alignItems:'center', gap:12, marginBottom: 28}}>
          <div className="logo-mark sm" style={{background:'#000'}}>
            <img src="assets/logo.webp" alt="" style={{height:28}}/>
          </div>
          <div>
            <div style={{fontFamily:'JetBrains Mono, monospace', fontSize:11, letterSpacing:'.18em', color:'var(--ochre)'}}>OUTBACK · OPERATIONS</div>
            <div style={{fontFamily:'Instrument Serif, serif', fontSize:22}}>Staff terminal</div>
          </div>
        </div>
        <form onSubmit={submit} style={{background:'#181410', border:'1px solid #2a241c', padding: 28}}>
          <div className="mono" style={{fontSize:10, color:'rgba(244,237,225,0.5)', marginBottom: 14}}>// AUTH REQUIRED</div>
          <label className="field"><span className="label" style={{color:'var(--paper)'}}>Username</span>
            <input className="input" style={{background:'#0f0d0a', borderColor:'#2a241c', color:'var(--paper)'}} value={u} onChange={e => setU(e.target.value)} />
          </label>
          <label className="field"><span className="label" style={{color:'var(--paper)'}}>Password / PIN</span>
            <input className="input" type="password" style={{background:'#0f0d0a', borderColor:'#2a241c', color:'var(--paper)'}} value={p} onChange={e => setP(e.target.value)} />
          </label>
          {err && <div style={{color:'var(--rust)', fontSize:13, marginBottom:10}}>{err}</div>}
          <button disabled={busy} className="btn btn-rust" style={{width:'100%', justifyContent:'center', marginTop:6, opacity:busy?0.7:1}}>{busy ? 'Signing in…' : 'Enter terminal →'}</button>
        </form>
        <div style={{marginTop:18, textAlign:'center'}}>
          <a className="mono" style={{fontSize:11, color:'var(--ochre)', cursor:'pointer'}} onClick={() => { window.location.href = 'https://outbackelectronics.com.au/home'; }}>← Back to public site</a>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// SHELL
// ============================================================
const ROLE_LEVELS = { owner: 4, manager: 3, technician: 2, staff: 1, seller: 1, pending: 0 };

const ADMIN_SECTIONS = [
  { group:'OPERATIONS', items: [
    { id:'overview',  label:'Overview',      icon:'⌂', minRole:'staff', excludeRoles:['seller'] },
    { id:'orders',    label:'Orders',        icon:'⊞', minRole:'technician' },
    { id:'repairs',   label:'Repair Jobs',   icon:'⚒', minRole:'staff', excludeRoles:['seller'] },
    { id:'quotes',    label:'Quotes Inbox',  icon:'✉', minRole:'staff', excludeRoles:['seller'] },
    { id:'ewaste',    label:'eWaste Intake', icon:'♻', minRole:'technician' },
  ]},
  { group:'CATALOG', items: [
    { id:'products',  label:'Products',         icon:'▣', minRole:'seller' },
    { id:'services',  label:'Services',          icon:'⚙', minRole:'manager' },
    { id:'software',  label:'Software',          icon:'⌘', minRole:'manager' },
    { id:'tutorials', label:'Tutorials',         icon:'✎', minRole:'manager' },
    { id:'ai',        label:'AI Models & Boxes', icon:'◉', minRole:'manager' },
  ]},
  { group:'COMMUNITY', items: [
    { id:'forum',     label:'Forum',     icon:'⌬', minRole:'manager' },
    { id:'groups',    label:'Groups',    icon:'◯', minRole:'manager' },
    { id:'customers', label:'Customers', icon:'☻', minRole:'technician' },
    { id:'sellers',   label:'Sellers',   icon:'$', minRole:'manager' },
  ]},
  { group:'STORE', items: [
    { id:'memberships', label:'Memberships', icon:'★', minRole:'manager' },
    { id:'gift-cards', label:'Gift Cards', icon:'◈', minRole:'staff', excludeRoles:['seller'] },
    { id:'expenses',  label:'Expenses', icon:'⊟', minRole:'manager' },
    { id:'policies',  label:'Policies', icon:'§', minRole:'manager' },
    { id:'settings',  label:'Settings', icon:'⚒', minRole:'seller' },
  ]},
];

function AdminSidebar({ section, setSection, onSignOut, role, username }) {
  const myLevel = ROLE_LEVELS[role] ?? 0;
  const visibleSections = ADMIN_SECTIONS
    .map(g => ({ ...g, items: g.items.filter(it => {
      if ((ROLE_LEVELS[it.minRole] ?? 0) > myLevel) return false;
      if (it.excludeRoles && it.excludeRoles.includes(role)) return false;
      return true;
    }) }))
    .filter(g => g.items.length > 0);
  const initials = (username || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  return (
    <aside style={{width: 248, background:'#0f0d0a', color:'var(--bg-deep)', height:'100vh', position:'sticky', top:0, display:'flex', flexDirection:'column', borderRight:'1px solid #2a241c'}}>
      <div style={{padding:'18px 18px 14px', borderBottom:'1px solid #2a241c', display:'flex', gap:10, alignItems:'center'}}>
        <div className="logo-mark sm" style={{background:'#000', padding:'3px 6px', height:32}}>
          <img src="assets/logo.webp" alt="" style={{height:24}}/>
        </div>
        <div>
          <div style={{fontFamily:'JetBrains Mono, monospace', fontSize:9.5, letterSpacing:'.18em', color:'var(--ochre)'}}>OUTBACK · OPS</div>
          <div style={{fontSize:12, color:'var(--bg-deep)'}}>prod</div>
        </div>
      </div>
      <div style={{flex:1, overflowY:'auto', padding:'14px 10px'}}>
        {visibleSections.map((g) => (
          <div key={g.group} style={{marginBottom: 18}}>
            <div className="mono" style={{fontSize:10, letterSpacing:'.12em', color:'rgba(244,237,225,0.4)', padding:'4px 10px 8px'}}>{g.group}</div>
            <div style={{display:'grid', gap: 2}}>
              {g.items.map(it => (
                <a key={it.id} onClick={() => setSection(it.id)}
                  style={{
                    display:'flex', alignItems:'center', gap:10, padding:'8px 10px',
                    cursor:'pointer', fontSize:13, lineHeight:1.2,
                    background: section===it.id ? '#1f88f5' : 'transparent',
                    color: section===it.id ? '#fff' : 'var(--bg-deep)',
                    fontWeight: section===it.id ? 600 : 400,
                  }}>
                  <span style={{width:18, textAlign:'center', opacity:.8, fontSize:13}}>{it.icon}</span>
                  <span style={{flex:1}}>{it.label}</span>
                  {it.count > 0 && (
                    <span className="mono" style={{
                      fontSize:10, padding:'2px 6px',
                      background: it.urgent && section!==it.id ? 'var(--rust)' : section===it.id ? 'rgba(255,255,255,.2)' : '#2a241c',
                      color: it.urgent && section!==it.id ? '#fff' : section===it.id ? '#fff' : 'var(--ochre)',
                    }}>{it.count}</span>
                  )}
                </a>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div style={{padding:'12px 14px', borderTop:'1px solid #2a241c', display:'flex', alignItems:'center', gap:10}}>
        <div className="avatar" style={{width:32, height:32, background:'var(--ochre)', color:'var(--dark)', fontSize:14}}>{initials}</div>
        <div style={{flex:1}}>
          <div style={{fontSize:13, color:'var(--paper)'}}>{username || 'Staff'}</div>
          <div className="mono" style={{fontSize:10, color:'rgba(244,237,225,0.5)'}}>{(role||'staff').toUpperCase()}</div>
        </div>
        <button title="Sign out" className="icon-btn" style={{width:28, height:28, background:'#2a241c', borderColor:'#2a241c', color:'var(--bg-deep)'}} onClick={onSignOut}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/></svg>
        </button>
      </div>
    </aside>
  );
}

function AdminTopbar({ title, subtitle, actions, search, onSearch }) {
  return (
    <div style={{padding:'18px 32px', borderBottom:'1px solid var(--line)', background:'var(--bg-elev)', display:'flex', alignItems:'center', justifyContent:'space-between', gap:24}}>
      <div>
        <div className="mono" style={{fontSize:11, letterSpacing:'.12em', color:'var(--ink-2)'}}>STAFF TERMINAL · {new Date().toLocaleDateString('en-AU', {weekday:'long', day:'2-digit', month:'short'}).toUpperCase()}</div>
        <div style={{display:'flex', alignItems:'baseline', gap:14, marginTop:4}}>
          <h1 className="serif" style={{fontSize:32, fontWeight:400, lineHeight:1}}>{title}</h1>
          {subtitle && <span style={{fontSize:13, color:'var(--ink-2)'}}>{subtitle}</span>}
        </div>
      </div>
      <div className="row-flex" style={{gap:10}}>
        <input className="input" placeholder="Search orders, SKUs, customers…" style={{padding:'7px 12px', fontSize:13, width:260}} value={search||''} onChange={e => onSearch && onSearch(e.target.value)} />
        {actions}
      </div>
    </div>
  );
}

// Reusable bits ----------------------------------------------
function StatTile({ label, value, delta, tone }) {
  return (
    <div style={{padding:'18px 20px', background:'var(--paper)', border:'1px solid var(--line)'}}>
      <div className="mono" style={{fontSize:10, letterSpacing:'.1em', color:'var(--ink-2)'}}>{label}</div>
      <div className="serif" style={{fontSize:42, marginTop:6, lineHeight:1, color: tone==='rust'?'var(--rust)':'var(--ink)'}}>{value}</div>
      {delta && <div className="mono" style={{fontSize:11, marginTop:6, color: delta.startsWith('+')?'var(--eucalyptus)':'var(--rust)'}}>{delta}</div>}
    </div>
  );
}

function Table({ columns, rows, onRowClick }) {
  return (
    <div style={{background:'var(--paper)', border:'1px solid var(--line)'}}>
      <div style={{display:'grid', gridTemplateColumns: columns.map(c => c.w || '1fr').join(' '), padding:'12px 18px', background:'var(--bg-elev)', borderBottom:'2px solid var(--ink)', fontFamily:'JetBrains Mono, monospace', fontSize:10, letterSpacing:'.1em', color:'var(--ink-2)'}}>
        {columns.map((c,i) => <div key={i}>{c.label.toUpperCase()}</div>)}
      </div>
      {rows.map((r,i) => (
        <div key={i}
          onClick={() => onRowClick && onRowClick(r,i)}
          style={{display:'grid', gridTemplateColumns: columns.map(c => c.w || '1fr').join(' '), padding:'14px 18px', borderTop: i===0?'none':'1px solid var(--line)', fontSize:13, alignItems:'center', cursor: onRowClick?'pointer':'default'}}
          onMouseEnter={e => { if (onRowClick) e.currentTarget.style.background='var(--bg-elev)'; }}
          onMouseLeave={e => { e.currentTarget.style.background='transparent'; }}>
          {columns.map((c,j) => <div key={j}>{c.render ? c.render(r) : r[c.key]}</div>)}
        </div>
      ))}
    </div>
  );
}

function StatusPill({ value, map }) {
  const cfg = map[value] || { bg:'var(--bg-deep)', fg:'var(--ink)' };
  return <span className="tag" style={{background: cfg.bg, color: cfg.fg, borderColor: cfg.bg}}>{value.toUpperCase()}</span>;
}

function Drawer({ open, onClose, title, children, footer }) {
  if (!open) return null;
  return (
    <div style={{position:'fixed', inset:0, zIndex:200}}>
      <div onClick={onClose} style={{position:'absolute', inset:0, background:'rgba(15,13,10,0.5)'}}></div>
      <div style={{position:'absolute', top:0, right:0, bottom:0, width:540, background:'var(--bg)', borderLeft:'1px solid var(--line)', boxShadow:'-8px 0 24px rgba(0,0,0,.15)', display:'flex', flexDirection:'column'}}>
        <div style={{padding:'18px 24px', borderBottom:'1px solid var(--line)', display:'flex', alignItems:'center', justifyContent:'space-between'}}>
          <div>
            <div className="mono" style={{fontSize:10, color:'var(--ink-2)', letterSpacing:'.1em'}}>EDIT RECORD</div>
            <h3 className="serif" style={{fontSize:24, marginTop:4}}>{title}</h3>
          </div>
          <button className="icon-btn" onClick={onClose}>×</button>
        </div>
        <div style={{flex:1, overflowY:'auto', padding:24}}>{children}</div>
        {footer && <div style={{padding:'14px 24px', borderTop:'1px solid var(--line)', background:'var(--bg-elev)'}}>{footer}</div>}
      </div>
    </div>
  );
}

// ============================================================
// OVERVIEW
// ============================================================
function AdminOverview({ go }) {
  const [orders, setOrders] = useState(null);
  const [repairs, setRepairs] = useState(null);
  const [quotes, setQuotes] = useState(null);
  const [catalog, setCatalog] = useState(null);
  useEffect(() => {
    fetch('/api/admin/orders', { credentials:'include' })
      .then(r => r.ok ? r.json() : Promise.reject()).then(d => setOrders(d.items || [])).catch(() => setOrders([]));
    fetch('/api/admin/repairs', { credentials:'include' })
      .then(r => r.ok ? r.json() : Promise.reject()).then(d => setRepairs(d.columns || [])).catch(() => setRepairs([]));
    fetch('/api/admin/quotes', { credentials:'include' })
      .then(r => r.ok ? r.json() : Promise.reject()).then(d => setQuotes(d.items || [])).catch(() => setQuotes([]));
    fetch('/api/admin/catalog', { credentials:'include' })
      .then(r => r.ok ? r.json() : Promise.reject()).then(d => setCatalog(d.products || [])).catch(() => setCatalog([]));
  }, []);

  const orderCount = orders === null ? '—' : orders.length;
  const revenue = orders === null ? '—' : '$' + orders.reduce((s, o) => s + (Number(o.total) || 0), 0).toLocaleString();
  const openRepairs = repairs === null ? '—' : repairs.filter(c => c.id !== 'done').reduce((s, c) => s + (c.cards ? c.cards.length : 0), 0);
  const quotesAwaiting = quotes === null ? '—' : quotes.length;
  const lowStock = catalog === null ? [] : catalog.filter(p => !p.infiniteStock && p.stock != null && p.stock <= 3);

  return (
    <div style={{padding: 32, display:'grid', gap: 28}}>
      <div className="grid-4">
        <StatTile label="REVENUE · 7D" value={revenue} />
        <StatTile label="ORDERS · 7D" value={orderCount} />
        <StatTile label="OPEN REPAIRS" value={openRepairs} tone="rust" />
        <StatTile label="QUOTES AWAITING" value={quotesAwaiting} tone="rust" />
      </div>

      <div style={{display:'grid', gridTemplateColumns:'2fr 1fr', gap:28}}>
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
              if (events.length === 0) return <div style={{padding:18, color:'var(--ink-2)', fontSize:13}}>No recent activity.</div>;
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
                    <span>{p.name}</span><span className="mono" style={{color:'var(--rust)'}}>{p.stock} left</span>
                  </li>
                ))
              }
            </ul>
            <button className="btn btn-ghost btn-sm" style={{marginTop:12, width:'100%', justifyContent:'center'}} onClick={() => {
              if (lowStock.length === 0) return;
              const csv = ['Name,Stock\n', ...lowStock.map(p => `${p.name},${p.stock}\n`)].join('');
              const a = document.createElement('a');
              a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
              a.download = 'purchase-order.csv';
              a.click();
            }}>Generate PO →</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// ORDERS
// ============================================================
function AdminOrders({ search }) {
  const [rows, setRows] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [edit, setEdit] = useState(null);
  const [form, setForm] = useState({});
  const [payEntry, setPayEntry] = useState({ amount:'', method:'Cash', note:'' });
  const [updateEntry, setUpdateEntry] = useState({ text:'', type:'note' });
  const [expenseEdit, setExpenseEdit] = useState(null); // id of expense being edited inline, or 'new'
  const [expenseForm, setExpenseForm] = useState({});
  useEffect(() => {
    fetch('/api/admin/orders', { credentials:'include' })
      .then(r => r.ok ? r.json() : Promise.reject()).then(d => setRows(d.items || [])).catch(() => setRows([]));
    fetch('/api/admin/expenses', { credentials:'include' })
      .then(r => r.ok ? r.json() : Promise.reject()).then(d => setExpenses(d.items || [])).catch(() => {});
  }, []);
  const [trackingBusy, setTrackingBusy] = useState(false);
  const [trackingResult, setTrackingResult] = useState(null);

  const openRow = (r) => { setEdit(r); setForm({...r}); setPayEntry({ amount:'', method:'Cash', note:'' }); setExpenseEdit(null); setExpenseForm({}); setTrackingResult(null); };

  const saveNow = async (patch) => {
    const updated = { ...form, ...patch };
    setForm(updated);
    await fetch('/api/admin/orders/save', { method:'POST', headers:postHeaders(), credentials:'include', body: JSON.stringify(updated) }).catch(()=>null);
    setRows(rs => rs.map(r => r.id === updated.id ? updated : r));
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
      setForm(f => ({ ...f, fulfilment: d.fulfilment }));
      setRows(rs => rs.map(r => r.id === form.id ? { ...r, fulfilment: d.fulfilment } : r));
    }
  };

  const blankExpense = (jobId) => ({ description:'', category:'parts', amount:'', date: new Date().toLocaleDateString('en-AU', {day:'2-digit',month:'2-digit',year:'numeric'}), receipt:null, jobId: jobId||'', notes:'', isSecondHand:false, partStatus:'' });

  const saveExpense = async (exp) => {
    const payload = { ...exp, amount: Number(exp.amount) || 0 };
    if (!payload.id) payload.id = 'exp-' + Date.now();
    const r = await fetch('/api/admin/expenses/save', { method:'POST', headers:postHeaders(), credentials:'include', body: JSON.stringify(payload) }).catch(()=>null);
    if (r && r.ok) {
      const d = await r.json();
      setExpenses(es => es.find(e => e.id === payload.id) ? es.map(e => e.id === payload.id ? d.item : e) : [...es, d.item]);
    }
    setExpenseEdit(null); setExpenseForm({});
  };

  const deleteExpense = async (id) => {
    if (!confirm('Delete this expense?')) return;
    await fetch('/api/admin/expenses/delete', { method:'POST', headers:postHeaders(), credentials:'include', body: JSON.stringify({ id }) }).catch(()=>null);
    setExpenses(es => es.filter(e => e.id !== id));
    setExpenseEdit(null); setExpenseForm({});
  };

  const paymentMap = {
    paid:       { bg:'#d8e7d0', fg:'#345526' },
    'part-paid':{ bg:'#fff4d6', fg:'#7a5d10' },
    unpaid:     { bg:'#f3d5c5', fg:'#7a3a18' },
  };
  const fulfilmentMap = {
    pending:   { bg:'var(--bg-deep)', fg:'var(--ink-2)' },
    ordering:  { bg:'#f0e6d3', fg:'#7a5010' },
    building:  { bg:'#fff4d6', fg:'#7a5d10' },
    testing:   { bg:'#dceaf5', fg:'#1668c8' },
    packed:    { bg:'#c8dff5', fg:'#0e4a8c' },
    shipped:   { bg:'var(--ink)', fg:'var(--paper)' },
    fulfilled: { bg:'#d8e7d0', fg:'#345526' },
    refunded:  { bg:'#f3d5c5', fg:'#7a3a18' },
  };

  const amountPaid = (f) => (f.payments || []).reduce((s, p) => s + (Number(p.amount) || 0), 0);
  const balance = (f) => (Number(f.total) || 0) - amountPaid(f);
  const paymentStatus = (f) => {
    // If a payment log exists, derive status from it
    if ((f.payments || []).length > 0) {
      const paid = amountPaid(f);
      const total = Number(f.total) || 0;
      if (paid >= total) return 'paid';
      return 'part-paid';
    }
    // Fall back to legacy stored status for orders saved before payment log existed
    if (f.status === 'paid' || f.status === 'part-paid') return f.status;
    return 'unpaid';
  };

  const addPayment = () => {
    const amt = Number(payEntry.amount);
    if (!amt || amt <= 0) return;
    const payment = { amount: amt, method: payEntry.method, note: payEntry.note, date: new Date().toLocaleDateString('en-AU', {day:'2-digit', month:'short', year:'numeric'}) };
    setForm(f => ({ ...f, payments: [...(f.payments || []), payment] }));
    setPayEntry({ amount:'', method:'Cash', note:'' });
  };
  const removePayment = (i) => {
    setForm(f => ({ ...f, payments: (f.payments || []).filter((_,idx) => idx !== i) }));
  };
  const addUpdate = () => {
    if (!updateEntry.text.trim()) return;
    const u = { text: updateEntry.text.trim(), type: updateEntry.type, date: new Date().toLocaleDateString('en-AU', { day:'2-digit', month:'short', year:'numeric' }), ts: new Date().toISOString() };
    setForm(f => ({ ...f, updates: [...(f.updates || []), u] }));
    setUpdateEntry({ text:'', type:'note' });
  };
  const removeUpdate = (i) => {
    setForm(f => ({ ...f, updates: (f.updates || []).filter((_,idx) => idx !== i) }));
  };

  const linkedExpenses = (f) => expenses.filter(e => e.jobId && e.jobId === f.id);
  const partsCost = (f) => linkedExpenses(f).reduce((s, e) => s + (Number(e.amount) || 0), 0);
  const profit = (f) => {
    const cost = partsCost(f);
    if (!cost) return null;
    return (Number(f.total) || 0) - cost;
  };

  const q = (search || '').toLowerCase().trim();
  const visibleRows = q
    ? rows.filter(r =>
        (r.id || '').toLowerCase().includes(q) ||
        (r.cust || '').toLowerCase().includes(q) ||
        (r.items || '').toLowerCase().includes(q) ||
        (r.loc || '').toLowerCase().includes(q)
      )
    : rows;

  const tabCounts = {
    all: rows.length,
    unpaid: rows.filter(r => paymentStatus(r) === 'unpaid').length,
    'part-paid': rows.filter(r => paymentStatus(r) === 'part-paid').length,
    paid: rows.filter(r => paymentStatus(r) === 'paid').length,
    shipped: rows.filter(r => (r.fulfilment||'pending') === 'shipped').length,
    refunded: rows.filter(r => (r.fulfilment||'pending') === 'refunded').length,
  };

  return (
    <div style={{padding:32}}>
      <div className="tabs" style={{marginBottom:18}}>
        {[['all','All'],['unpaid','Unpaid'],['part-paid','Part paid'],['paid','Paid'],['shipped','Shipped'],['refunded','Refunded']].map(([k,l],i) => (
          <div key={k} className={`tab ${i===0?'active':''}`}>{l} ({tabCounts[k]})</div>
        ))}
      </div>
      <Table
        columns={[
          { key:'id', label:'Order #', w:'140px', render:r => <span className="mono" style={{fontSize:12, color:'var(--rust)'}}>{r.id}</span> },
          { key:'cust', label:'Customer', w:'1.5fr' },
          { key:'items', label:'Items', w:'2fr', render:r => <span style={{fontSize:13}}>{r.items}</span> },
          { key:'total', label:'Total', w:'90px', render:r => <span className="mono" style={{fontWeight:600}}>${(Number(r.total)||0).toLocaleString()}</span> },
          { key:'balance', label:'Balance', w:'90px', render:r => {
            const b = balance(r);
            return b <= 0
              ? <span className="mono" style={{fontSize:11, color:'var(--eucalyptus)'}}>CLEAR</span>
              : <span className="mono" style={{fontSize:12, color:'var(--rust)', fontWeight:600}}>${b.toLocaleString()}</span>;
          }},
          { key:'payment', label:'Payment', w:'100px', render:r => <StatusPill value={paymentStatus(r)} map={paymentMap} /> },
          { key:'fulfilment', label:'Fulfilment', w:'110px', render:r => { const legacyFul = ['packed','shipped','fulfilled','refunded'].includes(r.status) ? r.status : null; return <StatusPill value={r.fulfilment || legacyFul || 'pending'} map={fulfilmentMap} />; } },
          { key:'date', label:'When', w:'110px', render:r => <span className="mono" style={{fontSize:11, color:'var(--ink-2)'}}>{(r.date||'').toUpperCase()}</span> },
        ]}
        rows={visibleRows}
        onRowClick={(r) => openRow(r)}
      />
      {edit !== null && (
        <Drawer open={true} onClose={() => setEdit(null)} title={`Order ${edit.id}`}
          footer={<div className="row-flex" style={{gap:8, justifyContent:'flex-end'}}>
            <button className="btn btn-ghost btn-sm" onClick={() => setEdit(null)}>Cancel</button>
            <button className="btn btn-sm" onClick={async () => {
              await fetch('/api/admin/orders/save', { method:'POST', headers:postHeaders(), credentials:'include', body: JSON.stringify(form) }).catch(()=>null);
              setRows(rs => rs.map(r => r.id === form.id ? form : r));
              setEdit(null);
            }}>Save</button>
          </div>}
        >
          <label className="field"><span className="label">Customer</span><input className="input" value={form.cust||''} onChange={e=>setForm({...form,cust:e.target.value})}/></label>
          <label className="field"><span className="label">Location</span><input className="input" value={form.loc||''} onChange={e=>setForm({...form,loc:e.target.value})}/></label>
          <label className="field"><span className="label">Items</span><input className="input" value={form.items||''} onChange={e=>setForm({...form,items:e.target.value})}/></label>
          <label className="field"><span className="label">Date</span><input className="input" value={form.date||''} onChange={e=>setForm({...form,date:e.target.value})}/></label>

          {/* Fulfilment — only manual status */}
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
              <a href={`https://auspost.com.au/mypost/track/#/details/${form.trackingNumber}`} target="_blank" rel="noreferrer" style={{fontSize:13, color:'var(--rust)'}}>Preview tracking link ↗</a>
            </div>
          )}

          {/* Stage-advance actions */}
          {(() => {
            const f = form.fulfilment || 'pending';
            if (f === 'testing') return (
              <div style={{padding:'14px', background:'#fff4d6', border:'1px solid #e6cc88', marginBottom:14}}>
                <div className="mono" style={{fontSize:10, color:'#7a5d10', marginBottom:8}}>TESTING COMPLETE?</div>
                <button className="btn btn-sm" style={{background:'#0e4a8c', color:'#fff', border:'none'}} onClick={() => saveNow({ fulfilment:'packed' })}>Mark as Packed →</button>
              </div>
            );
            if (f === 'packed') return (
              <div style={{padding:'14px', background:'#dceaf5', border:'1px solid #9ec4e8', marginBottom:14}}>
                <div className="mono" style={{fontSize:10, color:'#1668c8', marginBottom:8}}>READY TO SHIP?</div>
                {!form.trackingNumber && <div style={{fontSize:12, color:'var(--rust)', marginBottom:8}}>⚠ Add a tracking number above before marking as shipped.</div>}
                <button className="btn btn-sm" style={{background:'var(--ink)', color:'var(--paper)', border:'none', opacity: form.trackingNumber ? 1 : 0.5}} disabled={!form.trackingNumber} onClick={() => saveNow({ fulfilment:'shipped' })}>Mark as Shipped →</button>
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
                        {e.description}{e.location ? ` — ${e.location}` : ''}
                      </div>
                    ))}
                  </div>
                )}
                {trackingResult?.error && <div style={{fontSize:12, color:'var(--rust)', marginBottom:8}}>{trackingResult.error}</div>}
                {form.lastTrackingStatus && !trackingResult && <div style={{fontSize:12, color:'var(--ink-2)', marginBottom:8}}>Last known: <strong>{form.lastTrackingStatus}</strong></div>}
                <button className="btn btn-sm" style={{background:'#345526', color:'#fff', border:'none'}} onClick={() => saveNow({ fulfilment:'fulfilled' })}>Mark as Delivered manually →</button>
              </div>
            );
            return null;
          })()}

          {/* Parts tracking */}
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

          {/* Financials */}
          <div style={{borderTop:'1px solid var(--line)', margin:'12px 0 16px'}}/>
          <label className="field"><span className="label">Order Total (AUD)</span><input className="input" type="number" min="0" step="0.01" value={form.total||''} onChange={e=>setForm({...form,total:Number(e.target.value)})}/></label>
          {(() => {
            const linked = linkedExpenses(form);
            const cost = partsCost(form);
            const p = profit(form);
            const partStatusColors = { ordered:{bg:'#dceaf5',fg:'#1668c8'}, arrived:{bg:'#fff4d6',fg:'#7a5d10'}, installed:{bg:'#d8e7d0',fg:'#345526'}, returned:{bg:'#f3d5c5',fg:'#7a3a18'} };
            const ExpenseRow = ({ e }) => {
              const isEditing = expenseEdit === e.id;
              const ef = isEditing ? expenseForm : e;
              if (isEditing) return (
                <div style={{padding:'12px', background:'var(--paper)', border:'1px solid var(--ochre)', marginBottom:6}}>
                  <div className="grid-2" style={{gap:10, marginBottom:10}}>
                    <label className="field" style={{margin:0}}><span className="label">Description</span><input className="input" value={ef.description||''} onChange={ev=>setExpenseForm(f=>({...f,description:ev.target.value}))}/></label>
                    <label className="field" style={{margin:0}}><span className="label">Amount (AUD)</span><input className="input" type="number" step="0.01" value={ef.amount||''} onChange={ev=>setExpenseForm(f=>({...f,amount:ev.target.value}))}/></label>
                  </div>
                  <div className="grid-2" style={{gap:10, marginBottom:10}}>
                    <label className="field" style={{margin:0}}><span className="label">Category</span>
                      <select className="select" value={ef.category||'parts'} onChange={ev=>setExpenseForm(f=>({...f,category:ev.target.value}))}>
                        {['tools','equipment','parts','software','other'].map(c=><option key={c}>{c}</option>)}
                      </select>
                    </label>
                    <label className="field" style={{margin:0}}><span className="label">Part status</span>
                      <select className="select" value={ef.partStatus||''} onChange={ev=>setExpenseForm(f=>({...f,partStatus:ev.target.value}))}>
                        <option value="">— N/A —</option>
                        {['ordered','arrived','installed','returned'].map(s=><option key={s}>{s}</option>)}
                      </select>
                    </label>
                  </div>
                  <div className="grid-2" style={{gap:10, marginBottom:10}}>
                    <label className="field" style={{margin:0}}><span className="label">Date</span><input className="input" value={ef.date||''} onChange={ev=>setExpenseForm(f=>({...f,date:ev.target.value}))}/></label>
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
                <div key={e.id} style={{display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 12px', background:'var(--bg-elev)', border:'1px solid var(--line)', marginBottom:6, cursor:'pointer', gap:10}}
                  onClick={() => { setExpenseEdit(e.id); setExpenseForm({...e}); }}>
                  <div style={{flex:1, minWidth:0}}>
                    <span style={{fontSize:13, fontWeight:500}}>{e.description}</span>
                    {e.category && <span className="mono" style={{fontSize:10, color:'var(--ink-3)', marginLeft:8}}>{e.category.toUpperCase()}</span>}
                    {e.partStatus && (() => { const s = partStatusColors[e.partStatus]; return <span className="tag" style={{background:s?.bg,color:s?.fg,borderColor:s?.bg,marginLeft:8,fontSize:10}}>{e.partStatus.toUpperCase()}</span>; })()}
                    {e.notes && <div style={{fontSize:11, color:'var(--ink-3)', marginTop:2}}>{e.notes}</div>}
                  </div>
                  <div style={{display:'flex', gap:12, alignItems:'center', flexShrink:0}}>
                    <span className="mono" style={{fontSize:11, color:'var(--ink-3)'}}>{e.date}</span>
                    <span className="mono" style={{fontWeight:600, color:'var(--rust)'}}>-${(Number(e.amount)||0).toLocaleString('en-AU',{minimumFractionDigits:2})}</span>
                    <span style={{fontSize:12, color:'var(--ink-3)'}}>✎</span>
                  </div>
                </div>
              );
            };
            const showNewExpense = expenseEdit === 'new';
            return (
              <div style={{marginBottom:12}}>
                <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8}}>
                  <div className="mono" style={{fontSize:10, color:'var(--ink-2)'}}>LINKED EXPENSES ({linked.length})</div>
                  {!showNewExpense && <button className="btn btn-ghost btn-sm" style={{fontSize:11}} onClick={() => { setExpenseEdit('new'); setExpenseForm(blankExpense(form.id)); }}>+ Add expense</button>}
                </div>
                {linked.length === 0 && !showNewExpense && <div className="mono" style={{fontSize:11, color:'var(--ink-3)', marginBottom:8}}>No expenses linked.</div>}
                {linked.map(e => <ExpenseRow key={e.id} e={e} />)}
                {showNewExpense && (
                  <div style={{padding:'12px', background:'var(--paper)', border:'1px solid var(--ochre)', marginBottom:6}}>
                    <div className="grid-2" style={{gap:10, marginBottom:10}}>
                      <label className="field" style={{margin:0}}><span className="label">Description</span><input className="input" value={expenseForm.description||''} onChange={e=>setExpenseForm(f=>({...f,description:e.target.value}))} autoFocus/></label>
                      <label className="field" style={{margin:0}}><span className="label">Amount (AUD)</span><input className="input" type="number" step="0.01" value={expenseForm.amount||''} onChange={e=>setExpenseForm(f=>({...f,amount:e.target.value}))}/></label>
                    </div>
                    <div className="grid-2" style={{gap:10, marginBottom:10}}>
                      <label className="field" style={{margin:0}}><span className="label">Category</span>
                        <select className="select" value={expenseForm.category||'parts'} onChange={e=>setExpenseForm(f=>({...f,category:e.target.value}))}>
                          {['tools','equipment','parts','software','other'].map(c=><option key={c}>{c}</option>)}
                        </select>
                      </label>
                      <label className="field" style={{margin:0}}><span className="label">Part status</span>
                        <select className="select" value={expenseForm.partStatus||''} onChange={e=>setExpenseForm(f=>({...f,partStatus:e.target.value}))}>
                          <option value="">— N/A —</option>
                          {['ordered','arrived','installed','returned'].map(s=><option key={s}>{s}</option>)}
                        </select>
                      </label>
                    </div>
                    <div className="grid-2" style={{gap:10, marginBottom:10}}>
                      <label className="field" style={{margin:0}}><span className="label">Date</span><input className="input" value={expenseForm.date||''} onChange={e=>setExpenseForm(f=>({...f,date:e.target.value}))}/></label>
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
                {linked.length > 0 && (
                  <div style={{display:'flex', gap:24, padding:'10px 14px', background: p >= 0 ? '#d8e7d0' : '#f3d5c5', marginTop:4}}>
                    <div><div className="mono" style={{fontSize:10, color:'var(--ink-2)'}}>PARTS COST</div><div className="mono" style={{fontSize:14, fontWeight:600, color:'var(--rust)'}}>-${cost.toLocaleString('en-AU',{minimumFractionDigits:2})}</div></div>
                    <div><div className="mono" style={{fontSize:10, color: p >= 0 ? '#345526' : '#7a3a18'}}>PROFIT</div><div className="mono" style={{fontSize:14, fontWeight:600, color: p >= 0 ? '#345526' : '#7a3a18'}}>${p.toLocaleString('en-AU',{minimumFractionDigits:2})}</div></div>
                    <div><div className="mono" style={{fontSize:10, color:'var(--ink-2)'}}>MARGIN</div><div className="mono" style={{fontSize:14, fontWeight:600, color:'var(--ink-2)'}}>{form.total ? Math.round(p / Number(form.total) * 100) : 0}%</div></div>
                  </div>
                )}
              </div>
            );
          })()}

          {/* Payment log */}
          <div style={{borderTop:'1px solid var(--line)', margin:'12px 0 16px'}}/>
          <div style={{display:'flex', justifyContent:'space-between', alignItems:'baseline', marginBottom:10}}>
            <div className="mono" style={{fontSize:10, letterSpacing:'.1em', color:'var(--ink-2)'}}>PAYMENT LOG</div>
            <div style={{display:'flex', gap:8, alignItems:'center'}}>
              <StatusPill value={paymentStatus(form)} map={paymentMap} />
              <span className="mono" style={{fontSize:11}}>
                <span style={{color:'var(--eucalyptus)'}}>paid ${amountPaid(form).toLocaleString()}</span>
                {balance(form) > 0 && <span style={{color:'var(--rust)'}}> · owing ${balance(form).toLocaleString()}</span>}
              </span>
            </div>
          </div>
          {(form.payments || []).length === 0 && <div className="mono" style={{fontSize:11, color:'var(--ink-3)', marginBottom:12}}>No payments recorded.</div>}
          {(form.payments || []).map((p, i) => (
            <div key={i} style={{display:'flex', alignItems:'center', gap:10, padding:'8px 12px', background:'var(--bg-elev)', border:'1px solid var(--line)', marginBottom:6}}>
              <div style={{flex:1}}>
                <span className="mono" style={{fontWeight:600}}>${Number(p.amount).toLocaleString()}</span>
                <span className="mono" style={{fontSize:11, color:'var(--ink-2)', marginLeft:10}}>{p.method}</span>
                {p.note && <span style={{fontSize:12, color:'var(--ink-2)', marginLeft:10}}>— {p.note}</span>}
              </div>
              <span className="mono" style={{fontSize:10, color:'var(--ink-3)'}}>{p.date}</span>
              <button className="icon-btn" style={{width:22, height:22, fontSize:14, color:'var(--ink-3)'}} onClick={() => removePayment(i)}>×</button>
            </div>
          ))}
          <div style={{display:'grid', gridTemplateColumns:'100px 100px 1fr auto', gap:8, alignItems:'end', marginTop:8}}>
            <label className="field" style={{margin:0}}><span className="label">Amount</span><input className="input" type="number" min="0" step="0.01" placeholder="0.00" value={payEntry.amount} onChange={e=>setPayEntry(v=>({...v,amount:e.target.value}))}/></label>
            <label className="field" style={{margin:0}}><span className="label">Method</span>
              <select className="select" value={payEntry.method} onChange={e=>setPayEntry(v=>({...v,method:e.target.value}))}>
                {['Cash','Card','Bank Transfer','Crypto','Other'].map(m => <option key={m}>{m}</option>)}
              </select>
            </label>
            <label className="field" style={{margin:0}}><span className="label">Note (optional)</span><input className="input" placeholder="e.g. deposit, part payment" value={payEntry.note} onChange={e=>setPayEntry(v=>({...v,note:e.target.value}))}/></label>
            <button className="btn btn-sm" style={{marginBottom:1}} onClick={addPayment}>Log</button>
          </div>

          {/* Customer-visible updates */}
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
        </Drawer>
      )}
    </div>
  );
}

// ============================================================
// REPAIRS — Kanban
// ============================================================
function AdminRepairs() {
  const [cols, setCols] = useState([]);
  const [newJob, setNewJob] = useState(null);
  const [newJobForm, setNewJobForm] = useState({ t:'', who:'', tag:'' });
  useEffect(() => {
    fetch('/api/admin/repairs', { credentials:'include' })
      .then(r => r.ok ? r.json() : Promise.reject()).then(d => setCols(d.columns || [])).catch(() => setCols([]));
  }, []);
  const openCount = cols.filter(c => c.id !== 'done').reduce((s, c) => s + (c.cards ? c.cards.length : 0), 0);
  const addCard = async (colId) => {
    const newCard = { id: 'J-' + Date.now(), t: 'New job', who: '', age: '0h' };
    const updated = cols.map(c => c.id === colId ? { ...c, cards: [...(c.cards || []), newCard] } : c);
    setCols(updated);
    await fetch('/api/admin/repairs/save', {
      method: 'POST', headers: postHeaders(),
      credentials: 'include', body: JSON.stringify({ columns: updated }),
    }).catch(() => null);
  };
  const createJob = async () => {
    if (!newJobForm.t.trim()) return;
    const firstCol = cols[0];
    if (!firstCol) return;
    const newCard = { id: 'J-' + Date.now(), t: newJobForm.t, who: newJobForm.who, age: '0h', tag: newJobForm.tag || undefined };
    const updated = cols.map(c => c.id === firstCol.id ? { ...c, cards: [...(c.cards || []), newCard] } : c);
    setCols(updated);
    setNewJob(null);
    setNewJobForm({ t:'', who:'', tag:'' });
    await fetch('/api/admin/repairs/save', {
      method: 'POST', headers: postHeaders(),
      credentials: 'include', body: JSON.stringify({ columns: updated }),
    }).catch(() => null);
  };
  return (
    <div style={{padding:32, overflowX:'auto'}}>
      <div className="row-flex" style={{justifyContent:'space-between', marginBottom: 18}}>
        <div className="mono" style={{fontSize:12, color:'var(--ink-2)'}}>{openCount} OPEN</div>
        <button className="btn btn-rust btn-sm" onClick={() => { setNewJobForm({ t:'', who:'', tag:'' }); setNewJob(true); }}>+ New job</button>
      </div>
      {newJob && (
        <Drawer open={true} onClose={() => setNewJob(null)} title="New repair job"
          footer={<div className="row-flex" style={{gap:8, justifyContent:'flex-end'}}>
            <button className="btn btn-ghost btn-sm" onClick={() => setNewJob(null)}>Cancel</button>
            <button className="btn btn-rust btn-sm" onClick={createJob}>Create job</button>
          </div>}>
          <label className="field"><span className="label">Job description</span><input className="input" placeholder="e.g. Toughbook 55 — keyboard ribbon fault" value={newJobForm.t} onChange={e => setNewJobForm(f => ({...f, t:e.target.value}))} /></label>
          <label className="field"><span className="label">Assigned to</span><input className="input" placeholder="Technician name" value={newJobForm.who} onChange={e => setNewJobForm(f => ({...f, who:e.target.value}))} /></label>
          <label className="field"><span className="label">Tag (optional)</span><input className="input" placeholder="e.g. URGENT" value={newJobForm.tag} onChange={e => setNewJobForm(f => ({...f, tag:e.target.value}))} /></label>
        </Drawer>
      )}
      <div style={{display:'grid', gridTemplateColumns:'repeat(5, minmax(240px, 1fr))', gap:16, minWidth:1200}}>
        {cols.map(c => (
          <div key={c.id}>
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'baseline', marginBottom:10}}>
              <span className="eyebrow">{c.label}</span>
              <span className="mono" style={{fontSize:11, color:'var(--ink-3)'}}>{c.cards.length}</span>
            </div>
            <div style={{display:'grid', gap:10}}>
              {c.cards.map(card => (
                <div key={card.id} style={{padding:14, background:'var(--paper)', border:'1px solid var(--line)', cursor:'grab'}}>
                  <div className="row-flex" style={{justifyContent:'space-between'}}>
                    <span className="mono" style={{fontSize:10, color:'var(--rust)'}}>{card.id}</span>
                    {card.tag && <span className="tag" style={{fontSize:9}}>{card.tag}</span>}
                  </div>
                  <div style={{fontSize:13, marginTop:6, fontWeight:500, lineHeight:1.3}}>{card.t}</div>
                  <div className="mono" style={{fontSize:10, color:'var(--ink-2)', marginTop:8, display:'flex', justifyContent:'space-between'}}>
                    <span>{card.who.toUpperCase()}</span><span>{card.age.toUpperCase()}</span>
                  </div>
                </div>
              ))}
              <button className="btn btn-ghost btn-sm" style={{justifyContent:'center', borderStyle:'dashed', color:'var(--ink-3)'}} onClick={() => addCard(c.id)}>+ Card</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// QUOTE CREATOR
// ============================================================
function QuoteCreator({ context, onBack, onQuoteSent }) {
  const HARDWARE_MARGIN = 0.02;
  const PC_BUILD_RATE = 40;
  const genRef = () => 'QT-' + Date.now().toString().slice(-6);

  const dq = context?.draftQuote || {};
  const [form, setForm] = useState({
    quoteRef: dq.quoteRef || context?.quoteRef || genRef(),
    customerName: dq.customerName || context?.name || '',
    customerEmail: dq.customerEmail || context?.email || '',
    validDays: dq.validDays || 30,
    hardwareItems: dq.hardwareItems?.length ? dq.hardwareItems : [{ id: 'h' + Date.now(), name: '', qty: 1, basePrice: '' }],
    pcBuild: dq.pcBuild || false,
    pcHours: dq.pcHours || '',
    otherItems: dq.otherItems || [],
    notes: dq.notes || '',
    sourceQuoteId: context?.id || null,
  });
  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState({ text: '', ok: true });

  const hw = form.hardwareItems;
  const hardwareTotal = hw.reduce((s, i) => s + (parseFloat(i.basePrice) || 0) * (parseInt(i.qty) || 1) * (1 + HARDWARE_MARGIN), 0);
  const pcBuildFee = form.pcBuild ? (parseFloat(form.pcHours) || 0) * PC_BUILD_RATE : 0;
  const otherTotal = form.otherItems.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0);
  const grandTotal = hardwareTotal + pcBuildFee + otherTotal;

  const addHw = () => setForm(f => ({ ...f, hardwareItems: [...f.hardwareItems, { id: 'h' + Date.now(), name: '', qty: 1, basePrice: '' }] }));
  const updHw = (id, patch) => setForm(f => ({ ...f, hardwareItems: f.hardwareItems.map(i => i.id === id ? { ...i, ...patch } : i) }));
  const remHw = (id) => setForm(f => ({ ...f, hardwareItems: f.hardwareItems.filter(i => i.id !== id) }));

  const addOther = () => setForm(f => ({ ...f, otherItems: [...f.otherItems, { id: 'o' + Date.now(), description: '', amount: '' }] }));
  const updOther = (id, patch) => setForm(f => ({ ...f, otherItems: f.otherItems.map(i => i.id === id ? { ...i, ...patch } : i) }));
  const remOther = (id) => setForm(f => ({ ...f, otherItems: f.otherItems.filter(i => i.id !== id) }));

  const buildPayload = () => ({ ...form, hardwareTotal, pcBuildFee, otherTotal, grandTotal });

  const doSend = async () => {
    if (!form.customerEmail) { setMsg({ text: 'Customer email is required.', ok: false }); return; }
    setSending(true); setMsg({ text: '', ok: true });
    try {
      const r = await fetch('/api/admin/quotes/send', { method: 'POST', headers: postHeaders(), credentials: 'include', body: JSON.stringify(buildPayload()) });
      const d = await r.json().catch(() => ({}));
      if (r.ok) {
        setMsg({ text: `Quote sent to ${form.customerEmail}`, ok: true });
        if (onQuoteSent) onQuoteSent(d);
        setTimeout(() => onBack(), 2200);
      } else {
        setMsg({ text: d.error || 'Failed to send. Check SMTP settings in Settings → Integrations.', ok: false });
      }
    } catch { setMsg({ text: 'Network error.', ok: false }); }
    finally { setSending(false); }
  };

  const doSaveDraft = async () => {
    setSending(true); setMsg({ text: '', ok: true });
    try {
      const payload = {
        id: form.sourceQuoteId || ('quot-' + Date.now()),
        name: form.customerName,
        email: form.customerEmail,
        status: 'in-review',
        kind: 'custom-pc-build',
        quoteRef: form.quoteRef,
        summary: `Draft quote — $${grandTotal.toLocaleString('en-AU', { minimumFractionDigits: 2 })} AUD`,
        age: '0m',
        draftQuote: buildPayload(),
      };
      const r = await fetch('/api/admin/quotes/save', { method: 'POST', headers: postHeaders(), credentials: 'include', body: JSON.stringify(payload) });
      setMsg(r.ok ? { text: 'Draft saved.', ok: true } : { text: 'Failed to save.', ok: false });
    } catch { setMsg({ text: 'Network error.', ok: false }); }
    finally { setSending(false); }
  };

  const fmtAUD = (n) => n.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div style={{ padding: 32, maxWidth: 980, overflowY: 'auto' }}>
      {/* Page header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 28 }}>
        <div>
          <a style={{ cursor: 'pointer', fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'var(--rust)', letterSpacing: '.08em' }} onClick={onBack}>← BACK TO INBOX</a>
          <h2 className="serif" style={{ fontSize: 30, marginTop: 6, fontWeight: 400 }}>{context?.draftQuote ? 'Edit Quote' : 'Quote Builder'}</h2>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {msg.text && <span style={{ fontSize: 13, color: msg.ok ? 'var(--eucalyptus)' : 'var(--rust)' }}>{msg.text}</span>}
          <button className="btn btn-ghost btn-sm" disabled={sending} onClick={doSaveDraft}>Save draft</button>
          <button className="btn btn-rust btn-sm" disabled={sending} onClick={doSend} style={{ minWidth: 130 }}>{sending ? 'Sending…' : 'Send quote →'}</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 24, alignItems: 'start' }}>
        {/* ── Left column ── */}
        <div style={{ display: 'grid', gap: 20 }}>

          {/* Customer details */}
          <section style={{ background: 'var(--paper)', border: '1px solid var(--line)', padding: 24 }}>
            <div className="eyebrow" style={{ marginBottom: 16 }}>CUSTOMER DETAILS</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <label className="field" style={{ margin: 0 }}><span className="label">Customer name</span>
                <input className="input" placeholder="Jane Smith" value={form.customerName} onChange={e => setForm({ ...form, customerName: e.target.value })} />
              </label>
              <label className="field" style={{ margin: 0 }}><span className="label">Customer email</span>
                <input className="input" type="email" placeholder="jane@example.com" value={form.customerEmail} onChange={e => setForm({ ...form, customerEmail: e.target.value })} />
              </label>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 130px', gap: 14, marginTop: 14 }}>
              <label className="field" style={{ margin: 0 }}><span className="label">Quote reference</span>
                <input className="input" value={form.quoteRef} onChange={e => setForm({ ...form, quoteRef: e.target.value })} />
              </label>
              <label className="field" style={{ margin: 0 }}><span className="label">Valid (days)</span>
                <input className="input" type="number" min="1" value={form.validDays} onChange={e => setForm({ ...form, validDays: Number(e.target.value) })} />
              </label>
            </div>
          </section>

          {/* Hardware items */}
          <section style={{ background: 'var(--paper)', border: '1px solid var(--line)', padding: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div>
                <div className="eyebrow" style={{ margin: 0 }}>HARDWARE ITEMS</div>
                <div className="mono" style={{ fontSize: 10, color: 'var(--ink-2)', marginTop: 4, letterSpacing: '.06em' }}>2% MARGIN AUTO-APPLIED · NOT ITEMISED FOR CUSTOMER</div>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={addHw}>+ Add item</button>
            </div>

            {hw.length > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 70px 130px 120px 28px', gap: 8, marginBottom: 6 }}>
                {['ITEM', 'QTY', 'YOUR COST', 'CUSTOMER PRICE', ''].map((h, i) => (
                  <div key={i} className="mono" style={{ fontSize: 10, color: 'var(--ink-2)', letterSpacing: '.06em' }}>{h}</div>
                ))}
              </div>
            )}

            <div style={{ display: 'grid', gap: 8 }}>
              {hw.map(item => {
                const base = parseFloat(item.basePrice) || 0;
                const qty = parseInt(item.qty) || 1;
                const customerPrice = base * qty * (1 + HARDWARE_MARGIN);
                return (
                  <div key={item.id} style={{ display: 'grid', gridTemplateColumns: '2fr 70px 130px 120px 28px', gap: 8, alignItems: 'center' }}>
                    <input className="input" placeholder="e.g. Ryzen 7 5800X CPU" value={item.name} onChange={e => updHw(item.id, { name: e.target.value })} />
                    <input className="input" type="number" min="1" placeholder="1" value={item.qty} onChange={e => updHw(item.id, { qty: e.target.value })} />
                    <div style={{ position: 'relative' }}>
                      <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 13, color: 'var(--ink-2)', pointerEvents: 'none' }}>$</span>
                      <input className="input" type="number" min="0" step="0.01" placeholder="0.00" value={item.basePrice} onChange={e => updHw(item.id, { basePrice: e.target.value })} style={{ paddingLeft: 22 }} />
                    </div>
                    <div className="mono" style={{ fontSize: 13, fontWeight: 600, textAlign: 'right', color: 'var(--ink)' }}>
                      ${fmtAUD(customerPrice)}
                    </div>
                    <button className="icon-btn" style={{ width: 24, height: 24, fontSize: 16, color: 'var(--ink-3)' }} onClick={() => remHw(item.id)}>×</button>
                  </div>
                );
              })}
            </div>

            {hw.length === 0 && (
              <div style={{ fontSize: 13, color: 'var(--ink-2)', padding: '12px 0', textAlign: 'center' }}>No hardware items — click + Add item.</div>
            )}

            {hw.length > 0 && (
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--line)' }}>
                <span className="mono" style={{ fontSize: 12, color: 'var(--ink-2)' }}>Hardware subtotal: <strong style={{ color: 'var(--ink)' }}>${fmtAUD(hardwareTotal)}</strong></span>
              </div>
            )}
          </section>

          {/* PC Build */}
          <section style={{ background: 'var(--paper)', border: '1px solid var(--line)', padding: 24 }}>
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: 12, cursor: 'pointer', marginBottom: form.pcBuild ? 20 : 0 }}>
              <input type="checkbox" checked={form.pcBuild} onChange={e => setForm({ ...form, pcBuild: e.target.checked })} style={{ marginTop: 3 }} />
              <div style={{ flex: 1 }}>
                <div className="eyebrow" style={{ margin: 0 }}>CUSTOM PC BUILD</div>
                <div className="mono" style={{ fontSize: 10, color: 'var(--ink-2)', marginTop: 4, letterSpacing: '.06em' }}>$40/HR · SHOWN AS FLAT FEE TO CUSTOMER · HOURS NOT DISCLOSED</div>
              </div>
              {form.pcBuild && pcBuildFee > 0 && (
                <span className="mono" style={{ fontWeight: 700, fontSize: 14, color: 'var(--ink)' }}>${fmtAUD(pcBuildFee)}</span>
              )}
            </label>

            {form.pcBuild && (
              <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr', gap: 14, alignItems: 'end' }}>
                <label className="field" style={{ margin: 0 }}>
                  <span className="label">Build hours</span>
                  <input className="input" type="number" min="0" step="0.25" placeholder="0" value={form.pcHours} onChange={e => setForm({ ...form, pcHours: e.target.value })} />
                </label>
                <div style={{ paddingBottom: 4 }}>
                  {form.pcHours ? (
                    <div>
                      <span style={{ fontSize: 13, color: 'var(--ink-2)' }}>{parseFloat(form.pcHours)} hr{parseFloat(form.pcHours) !== 1 ? 's' : ''} × $40 = </span>
                      <strong style={{ fontSize: 14, color: 'var(--ink)' }}>${fmtAUD(pcBuildFee)} flat fee</strong>
                      <div className="mono" style={{ fontSize: 10, color: 'var(--ink-3)', marginTop: 6, letterSpacing: '.06em' }}>CUSTOMER SEES: "Custom PC Build — ${fmtAUD(pcBuildFee)}"</div>
                    </div>
                  ) : (
                    <span style={{ fontSize: 13, color: 'var(--ink-2)' }}>Enter hours above</span>
                  )}
                </div>
              </div>
            )}
          </section>

          {/* Other items */}
          <section style={{ background: 'var(--paper)', border: '1px solid var(--line)', padding: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div className="eyebrow" style={{ margin: 0 }}>OTHER ITEMS / SERVICES</div>
              <button className="btn btn-ghost btn-sm" onClick={addOther}>+ Add</button>
            </div>
            <div style={{ display: 'grid', gap: 8 }}>
              {form.otherItems.map(item => (
                <div key={item.id} style={{ display: 'grid', gridTemplateColumns: '1fr 150px 28px', gap: 8, alignItems: 'center' }}>
                  <input className="input" placeholder="e.g. Cable management, OS installation" value={item.description} onChange={e => updOther(item.id, { description: e.target.value })} />
                  <div style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 13, color: 'var(--ink-2)', pointerEvents: 'none' }}>$</span>
                    <input className="input" type="number" min="0" step="0.01" placeholder="0.00" value={item.amount} onChange={e => updOther(item.id, { amount: e.target.value })} style={{ paddingLeft: 22 }} />
                  </div>
                  <button className="icon-btn" style={{ width: 24, height: 24, fontSize: 16, color: 'var(--ink-3)' }} onClick={() => remOther(item.id)}>×</button>
                </div>
              ))}
            </div>
            {form.otherItems.length === 0 && (
              <div style={{ fontSize: 13, color: 'var(--ink-2)', textAlign: 'center', padding: '10px 0' }}>No additional items.</div>
            )}
          </section>

          {/* Notes */}
          <section style={{ background: 'var(--paper)', border: '1px solid var(--line)', padding: 24 }}>
            <div className="eyebrow" style={{ marginBottom: 12 }}>NOTES TO CUSTOMER</div>
            <textarea className="textarea" style={{ minHeight: 90 }}
              placeholder="Turnaround time, warranty, pickup/delivery, any conditions…"
              value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
          </section>
        </div>

        {/* ── Right column: live preview ── */}
        <aside style={{ display: 'grid', gap: 16, position: 'sticky', top: 24 }}>
          {/* Total summary */}
          <div style={{ background: 'var(--dark)', color: 'var(--paper)', padding: 22 }}>
            <div className="eyebrow" style={{ color: 'var(--ochre)', marginBottom: 16 }}>QUOTE TOTAL</div>
            <div style={{ display: 'grid', gap: 10 }}>
              {hardwareTotal > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <span style={{ color: 'rgba(244,237,225,.65)' }}>Hardware</span>
                  <span className="mono">${fmtAUD(hardwareTotal)}</span>
                </div>
              )}
              {form.pcBuild && pcBuildFee > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <span style={{ color: 'rgba(244,237,225,.65)' }}>PC Build</span>
                  <span className="mono">${fmtAUD(pcBuildFee)}</span>
                </div>
              )}
              {form.otherItems.filter(i => parseFloat(i.amount) > 0).map((item, idx) => (
                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <span style={{ color: 'rgba(244,237,225,.65)', flex: 1, marginRight: 8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.description || 'Other'}</span>
                  <span className="mono">${fmtAUD(parseFloat(item.amount) || 0)}</span>
                </div>
              ))}
              <div style={{ borderTop: '1px solid rgba(255,255,255,.15)', paddingTop: 12, marginTop: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span style={{ fontSize: 13, fontWeight: 600 }}>Total (AUD)</span>
                <span className="mono" style={{ fontSize: 20, fontWeight: 700, color: 'var(--ochre)' }}>${fmtAUD(grandTotal)}</span>
              </div>
            </div>
          </div>

          {/* Customer-facing preview */}
          <div style={{ background: 'var(--paper)', border: '1px solid var(--line)', padding: 20 }}>
            <div className="eyebrow" style={{ marginBottom: 12 }}>CUSTOMER SEES</div>
            <div style={{ fontSize: 12, color: 'var(--ink-2)' }}>
              {[
                ...hw.filter(i => i.name || i.basePrice).map(i => {
                  const base = parseFloat(i.basePrice) || 0;
                  const qty = parseInt(i.qty) || 1;
                  return { label: (i.name || '(item)') + (qty > 1 ? ` × ${qty}` : ''), amount: base * qty * (1 + HARDWARE_MARGIN) };
                }),
                ...(form.pcBuild && pcBuildFee > 0 ? [{ label: 'Custom PC Build', amount: pcBuildFee }] : []),
                ...form.otherItems.filter(i => i.description || i.amount).map(i => ({ label: i.description || '(item)', amount: parseFloat(i.amount) || 0 })),
              ].map((row, idx, arr) => (
                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: idx < arr.length - 1 ? '1px dashed var(--line)' : 'none' }}>
                  <span style={{ flex: 1, marginRight: 8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.label}</span>
                  <span className="mono" style={{ fontWeight: 600 }}>${fmtAUD(row.amount)}</span>
                </div>
              ))}
              {grandTotal > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 10, marginTop: 4, borderTop: '1px solid var(--line)', fontWeight: 700 }}>
                  <span>Total</span>
                  <span className="mono" style={{ color: 'var(--rust)' }}>${fmtAUD(grandTotal)}</span>
                </div>
              )}
              {grandTotal === 0 && <div style={{ textAlign: 'center', color: 'var(--ink-3)', padding: '8px 0' }}>Add items to see preview.</div>}
            </div>
          </div>

          {/* Quote meta */}
          <div style={{ background: 'var(--paper)', border: '1px solid var(--line)', padding: 18 }}>
            <div className="eyebrow" style={{ marginBottom: 10 }}>QUOTE META</div>
            <div style={{ fontSize: 12, color: 'var(--ink-2)', lineHeight: 1.8 }}>
              <div><span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: 'var(--ink-3)' }}>REF</span><br />{form.quoteRef}</div>
              <div><span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: 'var(--ink-3)' }}>VALID</span><br />{form.validDays} days</div>
              {form.customerName && <div><span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: 'var(--ink-3)' }}>TO</span><br />{form.customerName}</div>}
              {form.customerEmail && <div><span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: 'var(--ink-3)' }}>EMAIL</span><br />{form.customerEmail}</div>}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

// ============================================================
// QUOTES INBOX
// ============================================================
function AdminQuotes() {
  const [view, setView] = useState('inbox'); // 'inbox' | 'create'
  const [quoteContext, setQuoteContext] = useState(null);
  const [quotes, setQuotes] = useState([]);
  const [staffMembers, setStaffMembers] = useState([]);
  const [edit, setEdit] = useState(null);
  const [form, setForm] = useState({});
  const [assignTarget, setAssignTarget] = useState(null);
  const [assignee, setAssignee] = useState('');
  const [activeTab, setActiveTab] = useState('new');

  useEffect(() => {
    fetch('/api/admin/quotes', { credentials:'include' })
      .then(r => r.ok ? r.json() : Promise.reject()).then(d => setQuotes(d.items || [])).catch(() => setQuotes([]));
    fetch('/api/admin/staff', { credentials:'include' })
      .then(r => r.ok ? r.json() : Promise.reject()).then(d => setStaffMembers(d.members || [])).catch(() => setStaffMembers([]));
  }, []);

  const openQuoteCreator = (q) => { setQuoteContext(q || null); setView('create'); };

  const doAssign = async () => {
    if (!assignee) return;
    const updated = quotes.map(q => q.id === assignTarget.id ? {...q, assignee, status: q.status === 'new' ? 'in-review' : q.status} : q);
    setQuotes(updated);
    setAssignTarget(null);
    await fetch('/api/admin/quotes/save', { method:'POST', headers:postHeaders(), credentials:'include', body: JSON.stringify({...assignTarget, assignee, status: assignTarget.status === 'new' ? 'in-review' : assignTarget.status}) }).catch(()=>null);
  };

  const statusMap = {
    'new':       { bg:'var(--rust)', fg:'#fff' },
    'in-review': { bg:'var(--ochre)', fg:'var(--dark)' },
    'quoted':    { bg:'#d8e7d0', fg:'#345526' },
    'closed':    { bg:'var(--bg-deep)', fg:'var(--ink-2)' },
  };

  if (view === 'create') {
    return (
      <QuoteCreator
        context={quoteContext}
        onBack={() => setView('inbox')}
        onQuoteSent={() => {
          fetch('/api/admin/quotes', { credentials:'include' })
            .then(r => r.ok ? r.json() : Promise.reject()).then(d => setQuotes(d.items || [])).catch(() => {});
        }}
      />
    );
  }

  return (
    <div style={{padding:32, display:'grid', gridTemplateColumns:'1fr 360px', gap:24}}>
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <div className="tabs" style={{marginBottom:0}}>
            {[
              { key:'new',       label:`Inbox (${quotes.filter(q=>q.status==='new').length})` },
              { key:'in-review', label:`In review (${quotes.filter(q=>q.status==='in-review').length})` },
              { key:'quoted',    label:`Quoted (${quotes.filter(q=>q.status==='quoted').length})` },
              { key:'won',       label:`Won (${quotes.filter(q=>q.status==='won').length})` },
              { key:'closed',    label:'Closed' },
            ].map(t => (
              <div key={t.key} className={`tab ${activeTab===t.key?'active':''}`} onClick={() => setActiveTab(t.key)} style={{cursor:'pointer'}}>{t.label}</div>
            ))}
          </div>
          <button className="btn btn-rust btn-sm" onClick={() => openQuoteCreator(null)}>+ New quote</button>
        </div>
        <div style={{display:'grid', gap:12}}>
          {quotes.filter(q => (q.status||'new') === activeTab).length === 0 && <div style={{ padding: 24, background: 'var(--paper)', border: '1px solid var(--line)', fontSize: 13, color: 'var(--ink-2)', textAlign: 'center' }}>No quotes in this category.</div>}
          {quotes.filter(q => (q.status||'new') === activeTab).map((q,i) => (
            <div key={i} style={{padding:18, background:'var(--paper)', border:'1px solid var(--line)', borderLeft: q.status==='new'?'3px solid var(--rust)':'1px solid var(--line)'}}>
              <div className="row-flex" style={{justifyContent:'space-between'}}>
                <div className="row-flex" style={{gap:10}}>
                  <span className="mono" style={{fontSize:11, color:'var(--rust)'}}>{q.id}</span>
                  {q.kind && <span className="tag tag-outline">{q.kind.toUpperCase()}</span>}
                  <StatusPill value={q.status || 'new'} map={statusMap} />
                </div>
                {q.age && <span className="mono" style={{fontSize:11, color:'var(--ink-2)'}}>{q.age.toUpperCase()} AGO</span>}
              </div>
              <div style={{marginTop:10, display:'grid', gridTemplateColumns:'1fr auto', gap:14}}>
                <div>
                  <div style={{fontWeight:600}}>{q.name} {q.loc && <span style={{color:'var(--ink-2)', fontWeight:400}}>· {q.loc}</span>}</div>
                  {q.summary && <p style={{marginTop:6, fontSize:13, color:'var(--ink-2)'}}>{q.summary}</p>}
                </div>
                {(q.urgency || q.budget) && (
                  <div style={{textAlign:'right'}}>
                    {q.urgency && <><div className="mono" style={{fontSize:10, color:'var(--ink-3)'}}>URGENCY</div>
                    <div style={{fontWeight:600, fontSize:14, color: q.urgency==='Yesterday'?'var(--rust)':'var(--ink)'}}>{q.urgency}</div></>}
                    {q.budget && <><div className="mono" style={{fontSize:10, color:'var(--ink-3)', marginTop:6}}>BUDGET</div>
                    <div style={{fontWeight:600, fontSize:13}}>{q.budget}</div></>}
                  </div>
                )}
              </div>
              <div className="row-flex" style={{marginTop:14, gap:8, justifyContent:'flex-end'}}>
                <button className="btn btn-ghost btn-sm" onClick={() => { setAssignee(''); setAssignTarget(q); }}>Assign</button>
                <button className="btn btn-rust btn-sm" onClick={() => openQuoteCreator(q)}>{q.status === 'quoted' ? 'Edit & Resend →' : 'Build quote →'}</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <aside>
        <div style={{padding:20, background:'var(--paper)', border:'1px solid var(--line)'}}>
          <span className="eyebrow">SLA — RESPONSE TIME</span>
          <div className="serif" style={{fontSize:40, marginTop:6, color:'var(--eucalyptus)'}}>—</div>
          <div className="mono" style={{fontSize:11, color:'var(--ink-2)'}}>AVG · LAST 30 DAYS · TARGET 24H</div>
          <hr className="thin"/>
          <span className="eyebrow">UNASSIGNED</span>
          <ul style={{listStyle:'none', padding:0, margin:'10px 0 0', display:'grid', gap:6, fontSize:13}}>
            {quotes.filter(q => q.status === 'new').length === 0
              ? <li style={{fontSize:13, color:'var(--ink-2)'}}>None — all assigned.</li>
              : quotes.filter(q => q.status === 'new').map((q,i) => (
                <li key={i} style={{display:'flex', justifyContent:'space-between'}}>
                  <span className="mono" style={{fontSize:12}}>{q.id}</span>
                  <a className="mono" style={{fontSize:11, color:'var(--rust)', cursor:'pointer'}} onClick={() => openQuoteCreator(q)}>BUILD →</a>
                </li>
              ))
            }
          </ul>
          <hr className="thin"/>
          <button className="btn btn-rust btn-sm" style={{ width: '100%', justifyContent: 'center', marginTop: 4 }} onClick={() => openQuoteCreator(null)}>
            + Create new quote
          </button>
        </div>
      </aside>

      {edit !== null && (
        <Drawer open={true} onClose={() => setEdit(null)} title={`Quote ${edit.id}`}
          footer={<div className="row-flex" style={{justifyContent:'space-between'}}>
            <button className="btn btn-ghost btn-sm" style={{color:'var(--rust)'}} onClick={async () => {
              await fetch('/api/admin/quotes/delete', { method:'POST', headers:postHeaders(), credentials:'include', body: JSON.stringify({ id: edit.id }) }).catch(()=>null);
              setQuotes(qs => qs.filter(q => q.id !== edit.id));
              setEdit(null);
            }}>Delete</button>
            <div className="row-flex" style={{gap:8}}>
              <button className="btn btn-ghost btn-sm" onClick={() => setEdit(null)}>Cancel</button>
              <button className="btn btn-sm" onClick={async () => {
                const r = await fetch('/api/admin/quotes/save', { method:'POST', headers:postHeaders(), credentials:'include', body: JSON.stringify(form) }).catch(()=>null);
                if (r && r.ok) {
                  const d = await r.json();
                  setQuotes(qs => qs.map(q => q.id === edit.id ? d.item : q));
                } else {
                  setQuotes(qs => qs.map(q => q.id === edit.id ? form : q));
                }
                setEdit(null);
              }}>Save</button>
            </div>
          </div>}
        >
          <label className="field"><span className="label">ID</span><input className="input" value={form.id||''} onChange={e=>setForm({...form,id:e.target.value})}/></label>
          <label className="field"><span className="label">Name</span><input className="input" value={form.name||''} onChange={e=>setForm({...form,name:e.target.value})}/></label>
          <label className="field"><span className="label">Location</span><input className="input" value={form.loc||''} onChange={e=>setForm({...form,loc:e.target.value})}/></label>
          <label className="field"><span className="label">Kind</span><input className="input" value={form.kind||''} onChange={e=>setForm({...form,kind:e.target.value})}/></label>
          <label className="field"><span className="label">Status</span>
            <select className="select" value={form.status||'new'} onChange={e=>setForm({...form,status:e.target.value})}>
              {['new','in-review','quoted','closed'].map(s => <option key={s}>{s}</option>)}
            </select>
          </label>
        </Drawer>
      )}

      {assignTarget && (
        <Drawer open={true} onClose={() => setAssignTarget(null)} title={`Assign ${assignTarget.id}`}
          footer={<div className="row-flex" style={{gap:8, justifyContent:'flex-end'}}>
            <button className="btn btn-ghost btn-sm" onClick={() => setAssignTarget(null)}>Cancel</button>
            <button className="btn btn-rust btn-sm" onClick={doAssign} disabled={!assignee}>Assign</button>
          </div>}>
          <div style={{fontSize:13, color:'var(--ink-2)', marginBottom:16}}>{assignTarget.name} · {assignTarget.summary}</div>
          <label className="field"><span className="label">Assign to</span>
            <select className="select" value={assignee} onChange={e => setAssignee(e.target.value)}>
              <option value="">— select staff —</option>
              {staffMembers.map(s => <option key={s.id} value={s.name}>{s.name}{s.role ? ` · ${s.role}` : ''}</option>)}
            </select>
          </label>
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
  useEffect(() => {
    fetch('/api/admin/ewaste', { credentials:'include' })
      .then(r => r.ok ? r.json() : Promise.reject()).then(d => setIntakes(d.items || [])).catch(() => setIntakes([]));
  }, []);
  const openIntake = (r) => { setEdit(r); setForm({...r}); };
  return (
    <div style={{padding:32, display:'grid', gap:24}}>
      <div className="grid-4">
        <StatTile label="INTAKE · THIS WEEK" value="—" />
        <StatTile label="DIVERTED · YTD" value="—" />
        <StatTile label="PAID OUT · MO" value="—" />
        <StatTile label="PALLETS AWAITING SORT" value="—" tone="rust" />
      </div>

      <div style={{display:'grid', gridTemplateColumns:'2fr 1fr', gap:24}}>
        <div>
          <div className="row-flex" style={{justifyContent:'space-between', marginBottom:12}}>
            <h3 className="serif" style={{fontSize:22}}>Recent intakes</h3>
            <button className="btn btn-rust btn-sm" onClick={() => { setEdit({}); setForm({ id:'', from:'', kg:0, items:'', tier:'A', payout:'', date:'' }); }}>+ Log intake</button>
          </div>
          <Table
            columns={[
              { key:'id', label:'#', w:'120px', render:r => <span className="mono" style={{fontSize:11, color:'var(--rust)'}}>{r.id}</span>},
              { key:'from', label:'From', w:'1.5fr' },
              { key:'items', label:'Items', w:'2fr', render:r => <span style={{fontSize:13, color:'var(--ink-2)'}}>{r.items}</span> },
              { key:'kg', label:'Weight', w:'80px', render:r => <span className="mono">{r.kg}kg</span> },
              { key:'tier', label:'Tier', w:'80px', render:r => <span className="tag tag-outline">{r.tier}</span> },
              { key:'payout', label:'Payout', w:'140px', render:r => <span style={{fontWeight:600}}>{r.payout}</span> },
              { key:'date', label:'When', w:'90px', render:r => <span className="mono" style={{fontSize:11, color:'var(--ink-2)'}}>{r.date.toUpperCase()}</span>},
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
            <div className="serif" style={{fontSize:40, marginTop:6, color:'var(--ochre)'}}>—</div>
            <div className="mono" style={{fontSize:11, color:'var(--bg-deep)'}}>NIST 800-88 · 9 PURGE / 5 SHRED</div>
          </div>
        </div>
      </div>
      {edit !== null && (
        <Drawer open={true} onClose={() => setEdit(null)} title={edit.id ? `Intake ${edit.id}` : 'New intake'}
          footer={<div className="row-flex" style={{justifyContent:'space-between'}}>
            {edit.id && <button className="btn btn-ghost btn-sm" style={{color:'var(--rust)'}} onClick={async () => {
              await fetch('/api/admin/ewaste/delete', { method:'POST', headers:postHeaders(), credentials:'include', body: JSON.stringify({ id: edit.id }) }).catch(()=>null);
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
          <label className="field"><span className="label">Weight (kg)</span><input className="input" type="number" value={form.kg||0} onChange={e=>setForm({...form,kg:Number(e.target.value)})}/></label>
          <label className="field"><span className="label">Items</span><input className="input" value={form.items||''} onChange={e=>setForm({...form,items:e.target.value})}/></label>
          <label className="field"><span className="label">Tier</span><input className="input" value={form.tier||''} onChange={e=>setForm({...form,tier:e.target.value})}/></label>
          <label className="field"><span className="label">Payout</span><input className="input" value={form.payout||''} onChange={e=>setForm({...form,payout:e.target.value})}/></label>
          <label className="field"><span className="label">Date</span><input className="input" value={form.date||''} onChange={e=>setForm({...form,date:e.target.value})}/></label>
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
function AdminProducts({ sessionInfo = {} }) {
  const isSeller = sessionInfo.role === 'seller';
  const canAssignOwner = (ROLE_LEVELS[sessionInfo.role] ?? 0) >= ROLE_LEVELS.manager;
  const [rows, setRows] = useState([]);
  const [catOptions, setCatOptions] = useState([]);
  const [condOptions, setCondOptions] = useState([]);
  const [sellerMembers, setSellerMembers] = useState([]);
  useEffect(() => {
    fetch('/api/admin/catalog', { credentials:'include' })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(data => {
        const allProducts = data.products || [];
        let products = allProducts;
        if (isSeller) products = allProducts.filter(p => p.createdBy === sessionInfo.staffId);
        setRows(products.map(p => ({ ...p, cat: p.category, stock: p.stock ?? 0 })));
        setCatOptions([...new Set(allProducts.map(p => p.category).filter(Boolean))].sort());
        setCondOptions([...new Set(allProducts.map(p => p.cond).filter(Boolean))].sort());
      })
      .catch(() => setRows((window.CATALOG_DATA?.getAdminProducts?.() || window.CATALOG_DATA?.getAdminCatalog?.().filter(item => item.price !== undefined) || []).map(p => ({ ...p, cat: p.category, stock: p.stock ?? 0 }))));
    if (canAssignOwner) {
      fetch('/api/admin/staff', { credentials:'include' })
        .then(r => r.ok ? r.json() : Promise.reject())
        .then(d => setSellerMembers((d.members || []).filter(m => m.role === 'seller')))
        .catch(() => {});
    }
  }, []);
  const [edit, setEdit] = useState(null);
  const [form, setForm] = useState({});
  const open = (i) => { setEdit(i); setForm(i === 'new' ? { id:'', sku:'', status:'draft', cat: catOptions[0] || '', cond: condOptions[0] || '', stock:0, price:0 } : rows[i]); };
  const save = async () => {
    const item = { ...form, category: form.cat };
    const r = await fetch('/api/admin/catalog/products/save', {
      method: 'POST', headers: postHeaders(),
      credentials: 'include', body: JSON.stringify(item),
    }).catch(() => null);
    if (r && r.ok) {
      const d = await r.json();
      if (edit === 'new') setRows(rs => [...rs, d.item]);
      else setRows(rs => rs.map((row, i) => i === edit ? d.item : row));
    } else {
      if (edit === 'new') setRows(rs => [...rs, item]);
      else setRows(rs => rs.map((row, i) => i === edit ? item : row));
    }
    setEdit(null);
  };
  const remove = async () => {
    const item = rows[edit];
    await fetch('/api/admin/catalog/products/delete', {
      method: 'POST', headers: postHeaders(),
      credentials: 'include', body: JSON.stringify({ id: item.id }),
    }).catch(() => null);
    setRows(rs => rs.filter((_, i) => i !== edit));
    setEdit(null);
  };
  const moveAllToDraft = async () => {
    setRows(rs => rs.map(r => ({ ...r, status:'draft' })));
    await fetch('/api/admin/catalog/products/status', { method:'POST', headers:postHeaders(), credentials:'include', body: JSON.stringify({ status:'draft' }) }).catch(() => {});
  };

  return (
    <div style={{padding:32}}>
      <div className="tabs" style={{marginBottom:18}}>
        {[`All (${rows.length})`,`Published (${rows.filter(r=>r.status==='published').length})`,`Draft (${rows.filter(r=>r.status==='draft').length})`,'Out of stock','Refurbished'].map((t,i) => (
          <div key={i} className={`tab ${i===0?'active':''}`}>{t}</div>
        ))}
        <div style={{flex:1}}></div>
        <button className="btn btn-ghost btn-sm" onClick={moveAllToDraft}>Move all to draft</button>
        <button className="btn btn-rust btn-sm" onClick={() => open('new')}>+ New product</button>
      </div>
      <Table
        columns={[
          { key:'sku', label:'SKU', w:'130px', render:r => <span className="mono" style={{fontSize:11, color:'var(--rust)'}}>{r.sku}</span> },
          { key:'name', label:'Name', w:'2fr', render:r => (<><div style={{fontWeight:600}}>{r.name}</div><div className="mono" style={{fontSize:10, color:'var(--ink-2)', marginTop:2}}>{r.cond}</div></>) },
          { key:'cat', label:'Category', w:'1.2fr' },
          { key:'price', label:'Price', w:'90px', render:r => {
            if (r.variants && r.variants.length) {
              const prices = r.variants.map(v => v.price);
              const lo = Math.min(...prices), hi = Math.max(...prices);
              return <span className="mono" style={{fontWeight:600}}>{lo===hi ? `$${lo}` : `$${lo}–$${hi}`}</span>;
            }
            return <span className="mono" style={{fontWeight:600}}>${(r.price ?? 0).toLocaleString()}</span>;
          }},
          { key:'stock', label:'Stock', w:'80px', render:r => {
            if (r.infiniteStock) return <span className="mono" style={{color:'var(--ink-2)'}}>∞</span>;
            const s = r.variants && r.variants.length ? r.variants.reduce((a,v) => a + (v.stock||0), 0) : (r.stock ?? 0);
            return <span className="mono" style={{color: s<3?'var(--rust)':'var(--ink)'}}>{s}</span>;
          }},
          { key:'status', label:'Status', w:'120px', render:r => <span className={`tag ${r.status==='published'?'tag-euc':'tag-outline'}`}>{r.status.toUpperCase()}</span> },
        ]}
        rows={rows}
        onRowClick={(_,i) => open(i)}
      />
      {edit !== null && (
        <Drawer open={true} onClose={() => setEdit(null)} title={edit==='new'?'New product':form.name}
          footer={<div className="row-flex" style={{justifyContent:'space-between'}}>
            {edit!=='new' && <button className="btn btn-ghost btn-sm" style={{color:'var(--rust)'}} onClick={remove}>Delete</button>}
            <div className="row-flex" style={{gap:8, marginLeft:'auto'}}>
              <button className="btn btn-ghost btn-sm" onClick={() => setEdit(null)}>Cancel</button>
              <button className="btn btn-sm" onClick={save}>Save</button>
            </div>
          </div>}
        >
          <div style={{marginBottom:18}}>
            <div className="eyebrow" style={{marginBottom:8}}>IMAGES</div>
            <div style={{display:'flex', flexWrap:'wrap', gap:8, marginBottom:8}}>
              {(form.images||[]).map((url,i) => (
                <div key={i} style={{position:'relative', width:80, height:80}}>
                  <img src={url} loading="lazy" style={{width:80, height:80, objectFit:'cover', border:'1px solid var(--line)'}} />
                  <button onClick={() => setForm({...form, images:(form.images||[]).filter((_,j)=>j!==i)})}
                    style={{position:'absolute',top:2,right:2,background:'rgba(0,0,0,0.6)',color:'#fff',border:'none',borderRadius:2,width:18,height:18,cursor:'pointer',fontSize:12,lineHeight:'18px',padding:0}}>×</button>
                </div>
              ))}
              <label style={{width:80,height:80,border:'2px dashed var(--line)',display:'grid',placeItems:'center',cursor:'pointer',fontSize:11,color:'var(--ink-3)',flexShrink:0}}>
                <span>+ Add</span>
                <input type="file" accept="image/*" style={{display:'none'}} onChange={async e => {
                  const file = e.target.files[0];
                  if (!file) return;
                  try {
                    const url = await uploadImage(file);
                    setForm(f => ({...f, images:[...(f.images||[]), url]}));
                  } catch (err) {
                    alert('Image upload failed: ' + (err?.message || 'unknown error'));
                  }
                  e.target.value = '';
                }} />
              </label>
            </div>
          </div>
          <div className="grid-2" style={{gap:14}}>
            <label className="field"><span className="label">SKU</span><input className="input" value={form.sku||''} onChange={e=>setForm({...form, sku:e.target.value})}/></label>
            <label className="field"><span className="label">Status</span>
              <select className="select" value={form.status||'draft'} onChange={e=>setForm({...form, status:e.target.value})}>
                <option value="draft">Draft</option><option value="published">Published</option>
              </select>
            </label>
          </div>
          <label className="field"><span className="label">Name</span><input className="input" value={form.name||''} onChange={e=>setForm({...form, name:e.target.value})}/></label>
          <div className="grid-2" style={{gap:14}}>
            <label className="field"><span className="label">Category</span>
              <select className="select" value={catOptions.includes(form.cat) ? form.cat : '__new__'} onChange={e => { if (e.target.value !== '__new__') setForm({...form, cat: e.target.value}); }}>
                {catOptions.map(c => <option key={c} value={c}>{c}</option>)}
                <option value="__new__">+ New category…</option>
              </select>
              {(!catOptions.includes(form.cat) || form.cat === '') && (
                <input className="input" style={{marginTop:6}} placeholder="Type new category name" value={form.cat||''} onChange={e=>setForm({...form, cat:e.target.value})} autoFocus />
              )}
            </label>
            <label className="field"><span className="label">Condition</span>
              <select className="select" value={form.cond} onChange={e=>setForm({...form, cond:e.target.value})}>
                {condOptions.map(c => <option key={c}>{c}</option>)}
              </select>
            </label>
          </div>
          <label className="field" style={{flexDirection:'row', alignItems:'center', gap:10}}>
            <input type="checkbox" checked={!!form.digital} onChange={e=>setForm({...form, digital:e.target.checked, stock: e.target.checked && form.infiniteStock ? null : (form.stock||0)})} />
            <span className="label" style={{marginBottom:0}}>Digital product (gift card, software licence, download)</span>
          </label>
          <div className="grid-2" style={{gap:14}}>
            <label className="field"><span className="label">Price (AUD)</span><input className="input" type="number" value={form.price||0} onChange={e=>setForm({...form, price:Number(e.target.value)})}/></label>
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
          {(form.variants && form.variants.length > 0) && (
            <div style={{fontSize:12, color:'var(--ink-2)', marginTop:4}}>When variants are set, per-variant price and stock are used on the public site.</div>
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
          <label className="field"><span className="label">Description</span>
            <textarea className="textarea" placeholder="Bench-tested, 38-point check, ships with charger…" value={form.desc||''} onChange={e=>setForm({...form, desc:e.target.value})} />
          </label>
          <label className="field"><span className="label">Bench check notes (internal)</span>
            <textarea className="textarea" placeholder="Battery cycle count, BIOS rev, replaced components…" value={form.benchNotes||''} onChange={e=>setForm({...form, benchNotes:e.target.value})} />
          </label>
          {canAssignOwner && (
            <label className="field"><span className="label">Owner / Seller</span>
              <select className="select" value={form.createdBy||''} onChange={e=>setForm({...form, createdBy:e.target.value})}>
                <option value="">— Unassigned —</option>
                {sellerMembers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </label>
          )}
          <div className="eyebrow" style={{marginTop:18, marginBottom:10}}>VARIANTS</div>
          {(form.variants || []).map((v, i) => (
            <div key={i} style={{marginBottom:14, padding:10, border:'1px solid var(--line)', background:'var(--bg-elev)'}}>
              <div style={{display:'grid', gridTemplateColumns:'1.5fr 1.2fr 80px 70px 28px', gap:8, marginBottom: (form.images||[]).length > 0 ? 8 : 0}}>
                <input className="input" placeholder="e.g. With Certificate" value={v.name||''} onChange={e => { const vs = [...(form.variants||[])]; vs[i] = {...vs[i], name: e.target.value}; setForm({...form, variants: vs}); }} />
                <input className="input" value={v.sku||''} onChange={e => { const vs = [...(form.variants||[])]; vs[i] = {...vs[i], sku: e.target.value}; setForm({...form, variants: vs}); }} />
                <input className="input" type="number" value={v.price||0} onChange={e => { const vs = [...(form.variants||[])]; vs[i] = {...vs[i], price: Number(e.target.value)}; setForm({...form, variants: vs}); }} />
                <input className="input" type="number" value={v.stock||0} onChange={e => { const vs = [...(form.variants||[])]; vs[i] = {...vs[i], stock: Number(e.target.value)}; setForm({...form, variants: vs}); }} />
                <button className="icon-btn" onClick={() => { const vs = (form.variants||[]).filter((_,j) => j!==i); setForm({...form, variants: vs}); }}>×</button>
              </div>
              {(form.images||[]).length > 0 && (
                <div>
                  <div style={{fontSize:11, color:'var(--ink-3)', marginBottom:6}}>Linked images (shown when variant selected)</div>
                  <div style={{display:'flex', gap:6, flexWrap:'wrap'}}>
                    {(form.images||[]).map((url, imgIdx) => {
                      const linked = (v.images||[]).includes(url);
                      return (
                        <div key={imgIdx} onClick={() => {
                          const vs = [...(form.variants||[])];
                          const cur = vs[i].images || [];
                          vs[i] = {...vs[i], images: linked ? cur.filter(u => u !== url) : [...cur, url]};
                          setForm({...form, variants: vs});
                        }} style={{width:48, height:48, cursor:'pointer', position:'relative', flexShrink:0}}>
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
          <button className="btn btn-ghost btn-sm" style={{marginTop:4}} onClick={() => setForm({...form, variants: [...(form.variants||[]), {sku:'', name:'', price:0, stock:0}]})}>Add variant</button>
        </Drawer>
      )}
    </div>
  );
}

// ============================================================
// SERVICES
// ============================================================
function AdminServices() {
  const [rows, setRows] = useState([]);
  useEffect(() => {
    fetch('/api/admin/catalog', { credentials:'include' })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(data => setRows((data.services || []).map(s => ({ ...s, cat:s.category, price:s.priceLine }))))
      .catch(() => setRows((window.CATALOG_DATA?.getAdminServices?.() || window.CATALOG_DATA?.getAdminCatalog?.().filter(item => item.priceLine !== undefined) || []).map(s => ({ ...s, cat:s.category, price:s.priceLine }))));
  }, []);
  const [edit, setEdit] = useState(null);
  const [form, setForm] = useState({});
  const open = (i) => { setEdit(i); setForm(i==='new' ? { id:'', sku:'', status:'draft', cat:'Repair', active:true } : rows[i]); };
  const save = async () => {
    const item = { ...form, category: form.cat, priceLine: form.price };
    const r = await fetch('/api/admin/catalog/services/save', {
      method: 'POST', headers: postHeaders(),
      credentials: 'include', body: JSON.stringify(item),
    }).catch(() => null);
    if (r && r.ok) {
      const d = await r.json();
      if (edit === 'new') setRows(rs => [...rs, d.item]);
      else setRows(rs => rs.map((row, i) => i === edit ? d.item : row));
    } else {
      if (edit === 'new') setRows(rs => [...rs, item]);
      else setRows(rs => rs.map((row, i) => i === edit ? item : row));
    }
    setEdit(null);
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
          { key:'cat', label:'Category', w:'1fr', render:r => <span className="tag tag-outline">{r.cat.toUpperCase()}</span> },
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
              <select className="select" value={form.cat||'Repair'} onChange={e=>setForm({...form, cat:e.target.value})}>
                {['Repair','Off-grid','Build','Field','AI'].map(c => <option key={c}>{c}</option>)}
              </select>
            </label>
            <label className="field"><span className="label">Turnaround</span><input className="input" placeholder="e.g. 3–7 days" value={form.tat||''} onChange={e=>setForm({...form, tat:e.target.value})}/></label>
          </div>
          <label className="field"><span className="label">Pricing line</span><input className="input" placeholder="from $120 / $50/hr / quoted" value={form.price||''} onChange={e=>setForm({...form, price:e.target.value})}/></label>
          <label className="field"><span className="label">Public description</span><textarea className="textarea" value={form.desc||''} onChange={e=>setForm({...form, desc:e.target.value})} /></label>
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
// SOFTWARE
// ============================================================
function AdminSoftware() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [edit, setEdit] = useState(null);
  const [form, setForm] = useState({});
  const open = (i) => { setEdit(i); setForm(i==='new'?{ license:'OSS', live:true }:rows[i]); };
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
          { key:'license', label:'License', w:'1.2fr', render:r => <span className={`tag ${r.license.includes('OSS')?'tag-euc':'tag-rust'}`}>{r.license}</span> },
          { key:'price', label:'Pricing', w:'1fr' },
          { key:'stars', label:'GitHub', w:'100px', render:r => <span className="mono" style={{fontSize:12}}>{r.stars}</span> },
          { key:'repo', label:'Repo', w:'2fr', render:r => <span className="mono" style={{fontSize:11, color:'var(--ink-2)'}}>{r.repo}</span> },
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
          <label className="field"><span className="label">Product name</span><input className="input" value={form.name||''} onChange={e=>setForm({...form, name:e.target.value})}/></label>
          <div className="grid-2" style={{gap:14}}>
            <label className="field"><span className="label">License</span>
              <select className="select" value={form.license||'OSS'} onChange={e=>setForm({...form, license:e.target.value})}>
                <option>OSS · MIT</option><option>OSS · GPLv3</option><option>OSS · Apache-2.0</option><option>COMMERCIAL</option>
              </select>
            </label>
            <label className="field"><span className="label">Pricing</span><input className="input" placeholder="free / $12/mo" value={form.price||''} onChange={e=>setForm({...form, price:e.target.value})}/></label>
          </div>
          <label className="field"><span className="label">Public tagline</span><textarea className="textarea" placeholder="One paragraph for the Software page card." value={form.tagline||''} onChange={e=>setForm({...form, tagline:e.target.value})}/></label>
          <label className="field"><span className="label">Repository / docs URL</span><input className="input" placeholder="github.com/outback/…" value={form.repo||''} onChange={e=>setForm({...form, repo:e.target.value})}/></label>
          <label className="field"><span className="label">Quickstart snippet</span><textarea className="textarea mono" style={{fontFamily:'JetBrains Mono, monospace', fontSize:12}} placeholder="curl -sSL get.outbackelec.au/your-tool | sh" value={form.quickstart||''} onChange={e=>setForm({...form, quickstart:e.target.value})}/></label>
          <label className="field" style={{display:'flex', alignItems:'center', gap:8}}>
            <input type="checkbox" checked={!!form.live} onChange={e=>setForm({...form, live:e.target.checked})}/>
            <span style={{fontSize:14}}>Listed on public Software page</span>
          </label>
        </Drawer>
      )}
    </div>
  );
}

// ============================================================
// TUTORIALS — list + editor
// ============================================================
function AdminTutorials() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [edit, setEdit] = useState(null);
  const [form, setForm] = useState({});
  const [notice, setNotice] = useState({ type:'', msg:'' });
  const [saving, setSaving] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const bodyRef = React.useRef(null);

  const applyFormat = (fmt) => {
    const ta = bodyRef.current;
    if (!ta) return;
    const val = form.body || '';
    const ss = ta.selectionStart;
    const se = ta.selectionEnd;
    const sel = val.slice(ss, se);
    const lineStart = val.lastIndexOf('\n', ss - 1) + 1;
    let newVal, cur;

    if (fmt === 'H2') {
      newVal = val.slice(0, lineStart) + '## ' + val.slice(lineStart);
      cur = [ss + 3, se + 3];
    } else if (fmt === 'H3') {
      newVal = val.slice(0, lineStart) + '### ' + val.slice(lineStart);
      cur = [ss + 4, se + 4];
    } else if (fmt === 'B') {
      const word = sel || 'bold text';
      newVal = val.slice(0, ss) + `**${word}**` + val.slice(se);
      cur = sel ? [ss + 2, ss + 2 + sel.length] : [ss + 2, ss + 2 + word.length];
    } else if (fmt === 'I') {
      const word = sel || 'italic text';
      newVal = val.slice(0, ss) + `_${word}_` + val.slice(se);
      cur = sel ? [ss + 1, ss + 1 + sel.length] : [ss + 1, ss + 1 + word.length];
    } else if (fmt === '</>') {
      if (sel.includes('\n')) {
        newVal = val.slice(0, ss) + '```\n' + sel + '\n```' + val.slice(se);
        cur = [ss + 4, ss + 4 + sel.length];
      } else {
        const word = sel || 'code';
        newVal = val.slice(0, ss) + '`' + word + '`' + val.slice(se);
        cur = sel ? [ss + 1, ss + 1 + sel.length] : [ss + 1, ss + 1 + word.length];
      }
    } else if (fmt === '—') {
      newVal = val.slice(0, ss) + '—' + val.slice(se);
      cur = [ss + 1, ss + 1];
    } else if (fmt === '· list') {
      newVal = val.slice(0, lineStart) + '- ' + val.slice(lineStart);
      cur = [ss + 2, se + 2];
    } else if (fmt === '1. list') {
      newVal = val.slice(0, lineStart) + '1. ' + val.slice(lineStart);
      cur = [ss + 3, se + 3];
    } else if (fmt === '📷') {
      const snippet = '![description](image-url)';
      newVal = val.slice(0, ss) + snippet + val.slice(se);
      cur = [ss + 2, ss + 13];
    } else if (fmt === '🎥') {
      const snippet = '[video](youtube-url)';
      newVal = val.slice(0, ss) + snippet + val.slice(se);
      cur = [ss + 8, ss + 19];
    } else if (fmt === 'Link') {
      const snippet = sel ? `[${sel}](url)` : '[link text](url)';
      newVal = val.slice(0, ss) + snippet + val.slice(se);
      cur = sel ? [ss + sel.length + 3, ss + sel.length + 6] : [ss + 1, ss + 10];
    } else {
      return;
    }

    setForm(f => ({...f, body: newVal}));
    setTimeout(() => { ta.focus(); ta.setSelectionRange(cur[0], cur[1]); }, 0);
  };
  const open = (i) => { setEdit(i); setForm(i==='new'?{ status:'Draft', cat:'Repair' }:rows[i]); };
  useEffect(() => {
    fetch('/api/admin/tutorials', { credentials:'include' })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(d => setRows(d.items || []))
      .catch(() => setError('Failed to load tutorials.'))
      .finally(() => setLoading(false));
  }, []);
  const save = async (overrides = {}) => {
    setNotice({ type:'', msg:'' });
    const payload = edit === 'new' ? { ...form, ...overrides } : { ...rows[edit], ...form, ...overrides };
    payload.title = (payload.title || '').trim();
    payload.cat = payload.cat || 'Repair';
    payload.author = (payload.author || '').trim() || 'Staff';
    payload.status = payload.status || 'Draft';
    payload.date = payload.date || new Date().toISOString().slice(0, 10);
    payload.views = Number.isFinite(Number(payload.views)) ? Number(payload.views) : 0;
    payload.body = payload.body || '';
    if (!payload.title) { setNotice({ type:'error', msg:'Title is required.' }); return; }
    setSaving(true);
    const r = await fetch('/api/admin/tutorials/save', { method:'POST', headers:postHeaders(), credentials:'include', body: JSON.stringify(payload) }).catch(()=>null);
    setSaving(false);
    if (r && r.ok) {
      const d = await r.json();
      setRows(rs => edit==='new' ? [...rs, d.item] : rs.map((row,i)=>i===edit?d.item:row));
      setNotice({ type:'success', msg: payload.status === 'Published' ? 'Tutorial published.' : 'Tutorial saved.' });
      setEdit(null);
      return;
    }
    setNotice({ type:'error', msg:'Failed to save tutorial.' });
  };

  if (edit !== null) {
    return (
      <div style={{padding:32}}>
        <div className="row-flex" style={{justifyContent:'space-between', marginBottom:18}}>
          <div>
            <a className="mono" style={{fontSize:11, color:'var(--rust)', cursor:'pointer'}} onClick={()=>setEdit(null)}>← Back to list</a>
            <h2 className="serif" style={{fontSize:32, marginTop:6}}>{edit==='new'?'New tutorial':form.title}</h2>
          </div>
          <div className="row-flex" style={{gap:8}}>
            <button className="btn btn-ghost btn-sm" onClick={() => setPreviewing(true)}>Preview</button>
            <button className="btn btn-ghost btn-sm" disabled={saving} onClick={() => save({ status:'Draft' })}>{saving ? 'Saving…' : 'Save draft'}</button>
            <button className="btn btn-rust btn-sm" disabled={saving} onClick={() => save({ status:'Published' })}>{saving ? 'Publishing…' : 'Publish →'}</button>
          </div>
        </div>
        {notice.msg && <div style={{marginBottom:12, fontSize:13, color:notice.type==='error'?'var(--rust)':'var(--eucalyptus)'}}>{notice.msg}</div>}

        <div style={{display:'grid', gridTemplateColumns:'1fr 280px', gap:24}}>
          <div style={{background:'var(--paper)', border:'1px solid var(--line)', padding:32}}>
            <input className="input" placeholder="Tutorial title" value={form.title||''} onChange={e=>setForm({...form, title:e.target.value})}
              style={{fontFamily:'Instrument Serif, serif', fontSize:32, padding:'8px 0', border:'none', borderBottom:'1px solid var(--line)', background:'transparent'}} />
            <div className="mono" style={{fontSize:11, color:'var(--ink-2)', marginTop:8, letterSpacing:'.08em'}}>BY {(form.author||'YOU').toUpperCase()} · {form.cat?.toUpperCase()} · {form.date||'TODAY'}</div>

            <div className="row-flex" style={{marginTop:18, gap:4, paddingBottom:10, borderBottom:'1px solid var(--line)'}}>
              {['H2','H3','B','I','</>','—','· list','1. list','📷','🎥','Link'].map((b,i) => (
                <button key={i} className="btn btn-ghost btn-sm" style={{minWidth:32, justifyContent:'center', padding:'4px 8px'}}
                  onMouseDown={e => { e.preventDefault(); applyFormat(b); }}>{b}</button>
              ))}
            </div>

            <textarea ref={bodyRef} className="textarea" style={{minHeight:380, marginTop:12, border:'none', fontSize:15, lineHeight:1.6, fontFamily:'Archivo, sans-serif'}}
              placeholder="Start writing… Markdown supported. Drop in photos by dragging onto this area."
              value={form.body ?? `## The problem\n\nA Toughbook 55's keyboard cuts out after a hot day in the ute. Here's what's actually failing and how to swap it on the bench in under an hour…\n\n## Tools you'll need\n\n- T6 Torx driver\n- Plastic spudger\n- Replacement ribbon (Pana p/n: FZ-VKB55U)\n- ESD strap (you do have one, right?)\n\n## Step 1 — Cool it down\n\nPull the battery, leave it 20 minutes. Most "intermittent" failures resolve themselves once the silicone substrate stops flexing…`}
              onChange={e => setForm(f => ({...f, body: e.target.value}))}
            />

            <div style={{marginTop:18, padding:16, background:'var(--bg-elev)', border:'1px dashed var(--line-strong)', textAlign:'center', color:'var(--ink-2)', fontSize:13}}>
              📎 Drop images or video here, or paste a YouTube URL
            </div>
          </div>

          <aside style={{display:'grid', gap:14, alignContent:'start'}}>
            <div style={{padding:18, background:'var(--paper)', border:'1px solid var(--line)'}}>
              <span className="eyebrow">VISIBILITY</span>
              <label className="field" style={{marginTop:10}}><span className="label">Status</span>
                <select className="select" value={form.status||'Draft'} onChange={e=>setForm({...form, status:e.target.value})}>
                  <option>Draft</option><option>Review</option><option>Published</option><option>Archived</option>
                </select>
              </label>
              <label className="field"><span className="label">Category</span>
                <select className="select" value={form.cat||'Repair'} onChange={e=>setForm({...form, cat:e.target.value})}>
                  {['Repair','Off-grid','Software','AI','Comms'].map(c => <option key={c}>{c}</option>)}
                </select>
              </label>
              <label className="field"><span className="label">Difficulty</span>
                <select className="select" value={form.difficulty||'Intermediate'} onChange={e=>setForm({...form, difficulty:e.target.value})}>
                  <option>Beginner</option><option>Intermediate</option><option>Advanced</option><option>Expert</option>
                </select>
              </label>
              <label className="field"><span className="label">Estimated read</span>
                <input className="input" placeholder="22 min" value={form.duration||''} onChange={e=>setForm({...form, duration:e.target.value})}/>
              </label>
              <label className="field"><span className="label">Author</span>
                <input className="input" value={form.author||''} onChange={e=>setForm({...form, author:e.target.value})}/>
              </label>
            </div>
            <div style={{padding:18, background:'var(--paper)', border:'1px solid var(--line)'}}>
              <span className="eyebrow">COVER IMAGE</span>
              <div className="slot" style={{aspectRatio:'16/10', marginTop:10}}>16:10 · DRAG TO REPLACE</div>
            </div>
            <div style={{padding:18, background:'var(--paper)', border:'1px solid var(--line)'}}>
              <span className="eyebrow">SEO</span>
              <label className="field" style={{marginTop:10}}><span className="label">Slug</span><input className="input" placeholder="building-a-12v-solar-shed" value={form.slug||''} onChange={e=>setForm({...form, slug:e.target.value})}/></label>
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
              <div className="mono" style={{fontSize:11, color:'var(--ink-2)', marginBottom:28}}>BY {(form.author||'STAFF').toUpperCase()} · {(form.cat||'REPAIR').toUpperCase()} · {form.date||'TODAY'}</div>
              <div style={{fontSize:15, lineHeight:1.75, whiteSpace:'pre-wrap', color:'var(--ink)'}}>{form.body || '(no body yet)'}</div>
              <button className="btn btn-ghost btn-sm" style={{marginTop:32}} onClick={() => setPreviewing(false)}>Close preview</button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{padding:32}}>
      {loading && <div className="mono" style={{fontSize:12, color:'var(--ink-2)', marginBottom:10}}>Loading…</div>}
      {error && <div style={{fontSize:12, color:'var(--rust)', marginBottom:10}}>{error}</div>}
      <div className="tabs" style={{marginBottom:18}}>
        {['All (7)','Published (5)','Draft (2)','Review','Archived'].map((t,i) => (
          <div key={i} className={`tab ${i===0?'active':''}`}>{t}</div>
        ))}
        <div style={{flex:1}}></div>
        <button className="btn btn-rust btn-sm" onClick={() => open('new')}>+ New tutorial</button>
      </div>
      <Table
        columns={[
          { key:'title', label:'Title', w:'2.5fr', render:r => <span style={{fontWeight:600}}>{r.title}</span> },
          { key:'cat', label:'Category', w:'1fr', render:r => <span className="tag tag-outline">{r.cat.toUpperCase()}</span> },
          { key:'author', label:'Author', w:'1fr' },
          { key:'date', label:'Date', w:'90px', render:r => <span className="mono" style={{fontSize:12, color:'var(--ink-2)'}}>{r.date}</span> },
          { key:'views', label:'Views', w:'80px', render:r => <span className="mono">{r.views.toLocaleString()}</span> },
          { key:'status', label:'Status', w:'110px', render:r => <span className={`tag ${r.status==='Published'?'tag-euc':r.status==='Draft'?'tag-ochre':'tag-outline'}`}>{r.status.toUpperCase()}</span> },
        ]}
        rows={rows}
        onRowClick={(_,i)=>open(i)}
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
          <option value="">— none —</option>
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
    if (!window.confirm('Delete this model?')) return;
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
    if (!window.confirm('Delete this box?')) return;
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
// FORUM
// ============================================================
function AdminForumCategoryEditor({ cat, onSave, onCancel }) {
  const isNew = !cat;
  const [label, setLabel] = useState(cat?.label || cat?.name || '');
  const [desc, setDesc]   = useState(cat?.desc || cat?.description || '');
  const [id, setId]       = useState(cat?.id || '');
  const [idTouched, setIdTouched] = useState(!isNew);
  const [error, setError] = useState('');

  function slugify(s) {
    return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  }

  function handleLabelChange(v) {
    setLabel(v);
    if (!idTouched) setId(slugify(v));
  }

  function handleIdChange(v) {
    setIdTouched(true);
    setId(slugify(v));
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!label.trim()) { setError('Name is required.'); return; }
    if (!id.trim())    { setError('Slug is required.'); return; }
    onSave({ ...(cat || {}), id: id.trim(), label: label.trim(), desc: desc.trim() });
  }

  const inputStyle = { width:'100%', padding:'8px 10px', border:'1px solid var(--line-strong)', fontFamily:'inherit', fontSize:14, background:'var(--paper)', color:'var(--ink)' };

  return (
    <form onSubmit={handleSubmit} style={{background:'var(--bg-elev)', border:'1px solid var(--line)', padding:20, display:'grid', gap:14, marginBottom:8}}>
      <div style={{fontWeight:600, fontSize:13, marginBottom:4}}>{isNew ? 'New category' : `Edit — ${cat.label || cat.name}`}</div>
      {error && <div style={{fontSize:12, color:'var(--rust)'}}>{error}</div>}
      <label className="field">
        <span className="label">Name</span>
        <input style={inputStyle} value={label} onChange={e=>handleLabelChange(e.target.value)} placeholder="e.g. Repairs & Troubleshooting" autoFocus />
      </label>
      <label className="field">
        <span className="label">Slug / ID</span>
        <input style={{...inputStyle, fontFamily:'monospace'}} value={id} onChange={e=>handleIdChange(e.target.value)} placeholder="e.g. repairs" />
      </label>
      <label className="field">
        <span className="label">Description <span style={{fontWeight:400, color:'var(--ink-3)'}}>(optional)</span></span>
        <input style={inputStyle} value={desc} onChange={e=>setDesc(e.target.value)} placeholder="One-line summary shown in the sidebar" />
      </label>
      <div className="row-flex" style={{justifyContent:'flex-end', gap:8}}>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onCancel}>Cancel</button>
        <button type="submit" className="btn btn-rust btn-sm">{isNew ? 'Create category' : 'Save changes'}</button>
      </div>
    </form>
  );
}

function AdminForum() {
  const [tab, setTab] = useState('queue');
  const [queue, setQueue] = useState([]);
  const [threads, setThreads] = useState([]);
  const [users, setUsers] = useState([]);
  const [categories, setCategories] = useState([]);
  const [conduct, setConduct] = useState('');
  const [queueError, setQueueError] = useState('');
  const [catEditor, setCatEditor] = useState(null); // null | 'new' | index
  const [catSaving, setCatSaving] = useState(false);
  const [catError, setCatError] = useState('');
  const [conductSaving, setConductSaving] = useState(false);
  const [conductNotice, setConductNotice] = useState(null);

  useEffect(() => {
    fetch('/api/admin/forum', { credentials: 'include' })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(d => {
        setQueue(d.queue || []);
        setThreads(d.threads || []);
        setUsers(d.users || []);
        setCategories(d.categories || []);
        setConduct(d.conduct || '');
      })
      .catch(() => {});
  }, []);

  function dismissQueueItem(id, action) {
    setQueueError('');
    fetch('/api/admin/forum/queue/resolve', {
      method: 'POST', credentials: 'include',
      headers: postHeaders(),
      body: JSON.stringify({ id, action }),
    })
      .then(async (r) => {
        const payload = await r.json().catch(() => ({}));
        if (!r.ok || !payload?.ok) {
          const reason = payload?.result?.reason || payload?.error || 'unknown_error';
          throw new Error(reason);
        }
        setQueue(q => q.filter(item => item.id !== id));
      })
      .catch((err) => {
        setQueueError(`Failed to resolve moderation item: ${err.message}`);
      });
  }

  async function toggleThreadFlag(id, flag, currentValue) {
    const r = await fetch(`/api/admin/forum/threads/${id}/${flag}`, {
      method: 'POST', credentials: 'include',
      headers: postHeaders(),
      body: JSON.stringify({ [flag]: !currentValue }),
    });
    if (r.ok) setThreads(ts => ts.map(t => t.id === id ? { ...t, [flag]: !currentValue } : t));
  }

  async function saveConductText() {
    setConductSaving(true); setConductNotice(null);
    try {
      const r = await fetch('/api/admin/forum/conduct/save', {
        method: 'POST', credentials: 'include',
        headers: postHeaders(),
        body: JSON.stringify({ conduct }),
      });
      if (!r.ok) throw new Error('Save failed');
      setConductNotice({ type: 'success', msg: 'Code of conduct saved.' });
    } catch {
      setConductNotice({ type: 'error', msg: 'Failed to save. Please try again.' });
    } finally {
      setConductSaving(false);
    }
  }

  async function persistCategories(updated) {
    setCatSaving(true); setCatError('');
    try {
      const r = await fetch('/api/admin/forum/categories/save', {
        method: 'POST', credentials: 'include',
        headers: postHeaders(),
        body: JSON.stringify({ categories: updated }),
      });
      if (!r.ok) throw new Error('Save failed');
      setCategories(updated);
      setCatEditor(null);
    } catch {
      setCatError('Failed to save categories. Please try again.');
    } finally {
      setCatSaving(false);
    }
  }

  function handleCatSave(saved) {
    let updated;
    if (catEditor === 'new') {
      updated = [...categories, saved];
    } else {
      updated = categories.map((c, i) => i === catEditor ? saved : c);
    }
    persistCategories(updated);
  }

  function handleCatDelete(index) {
    if (!confirm(`Delete category "${categories[index].label || categories[index].name}"? Threads in this category will become uncategorised.`)) return;
    persistCategories(categories.filter((_, i) => i !== index));
  }

  function moveCat(index, dir) {
    const updated = [...categories];
    const swap = index + dir;
    if (swap < 0 || swap >= updated.length) return;
    [updated[index], updated[swap]] = [updated[swap], updated[index]];
    persistCategories(updated);
  }

  return (
    <div style={{padding:32}}>
      <div className="tabs" style={{marginBottom:18}}>
        <div className={`tab ${tab==='queue'?'active':''}`} onClick={()=>setTab('queue')}>Moderation queue ({queue.length})</div>
        <div className={`tab ${tab==='threads'?'active':''}`} onClick={()=>setTab('threads')}>Threads</div>
        <div className={`tab ${tab==='users'?'active':''}`} onClick={()=>setTab('users')}>Members</div>
        <div className={`tab ${tab==='cats'?'active':''}`} onClick={()=>setTab('cats')}>Categories</div>
        <div className={`tab ${tab==='rules'?'active':''}`} onClick={()=>setTab('rules')}>Code of conduct</div>
      </div>

      {tab==='queue' && (
        <div style={{display:'grid', gap:12}}>
          {queueError && <div style={{fontSize:12, color:'var(--rust)'}}>{queueError}</div>}
          {queue.length === 0 && <div style={{fontSize:14, color:'var(--ink-2)'}}>No items in the moderation queue.</div>}
          {queue.map((q,i) => (
            <div key={i} style={{padding:18, background:'var(--paper)', border:'1px solid var(--line)', borderLeft:'3px solid var(--rust)'}}>
              <div className="row-flex" style={{justifyContent:'space-between'}}>
                <div className="row-flex" style={{gap:10}}>
                  <span className="mono" style={{fontSize:11, color:'var(--rust)'}}>{q.id}</span>
                  <span className="tag tag-outline">{q.cat.toUpperCase()}</span>
                  <span className="tag tag-rust">{q.reports} REPORTS</span>
                  <span className="tag" style={{fontSize:9}}>{q.reason.toUpperCase()}</span>
                </div>
                <span className="mono" style={{fontSize:11, color:'var(--ink-2)'}}>{q.age.toUpperCase()} AGO · BY {q.who.toUpperCase()}</span>
              </div>
              <p style={{marginTop:12, fontSize:14, color:'var(--ink)', background:'var(--bg-elev)', padding:'12px 14px'}}>{q.body}</p>
              <div className="row-flex" style={{marginTop:12, justifyContent:'flex-end', gap:8}}>
                <button className="btn btn-ghost btn-sm" onClick={() => window.open(`/t/${q.id}`, '_blank')}>View thread</button>
                <button className="btn btn-ghost btn-sm" style={{color:'var(--ink-2)'}} onClick={()=>dismissQueueItem(q.id,'approve')}>Approve</button>
                <button className="btn btn-ghost btn-sm" style={{color:'var(--ochre)'}} onClick={()=>dismissQueueItem(q.id,'edit-approve')}>Edit & approve</button>
                <button className="btn btn-ghost btn-sm" style={{color:'var(--rust)'}} onClick={()=>dismissQueueItem(q.id,'reject')}>Hide</button>
                <button className="btn btn-sm" style={{background:'var(--rust)', borderColor:'var(--rust)'}} onClick={()=>dismissQueueItem(q.id,'hide-warn')}>Hide + warn user</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab==='threads' && (
        <Table
          columns={[
            { key:'id', label:'#', w:'90px', render:r => <span className="mono" style={{fontSize:11, color:'var(--rust)'}}>{r.id}</span> },
            { key:'title', label:'Thread', w:'3fr', render:r => <span style={{fontWeight:600}}>{r.title}</span> },
            { key:'cat', label:'Category', w:'1.2fr', render:r => <span className="tag tag-outline">{(r.cat||'—').toUpperCase()}</span> },
            { key:'replies', label:'Replies', w:'80px' },
            { key:'views', label:'Views', w:'80px' },
            { key:'pinned', label:'State', w:'240px', render:r => (
              <div className="row-flex" style={{gap:6}}>
                {r.solved && <span className="tag tag-euc">SOLVED</span>}
                <button className={`btn btn-sm ${r.pinned ? 'btn-rust' : 'btn-ghost'}`} onClick={e=>{e.stopPropagation();toggleThreadFlag(r.id,'pinned',r.pinned);}}>
                  {r.pinned ? '📌 Unpin' : 'Pin'}
                </button>
                <button className={`btn btn-sm ${r.locked ? 'btn-rust' : 'btn-ghost'}`} onClick={e=>{e.stopPropagation();toggleThreadFlag(r.id,'locked',r.locked);}}>
                  {r.locked ? '🔒 Unlock' : 'Lock'}
                </button>
              </div>
            )},
          ]}
          rows={threads}
          onRowClick={()=>{}}
        />
      )}

      {tab==='users' && (
        <Table
          columns={[
            { key:'name', label:'Member', w:'1.5fr', render:r => <span style={{fontWeight:600}}>{r.name}</span> },
            { key:'joined', label:'Joined', w:'100px' },
            { key:'posts', label:'Posts', w:'80px' },
            { key:'rep', label:'Rep', w:'80px' },
            { key:'role', label:'Role', w:'120px', render:r => <span className={`tag ${r.role==='Staff'?'tag-ink':r.role==='Trusted'?'tag-euc':'tag-outline'}`}>{(r.role||'Member').toUpperCase()}</span> },
            { key:'flags', label:'Flags', w:'80px', render:r => <span className="mono" style={{color: r.flags>0?'var(--rust)':'var(--ink-3)'}}>{r.flags||0}</span> },
          ]}
          rows={users}
        />
      )}

      {tab==='cats' && (
        <div style={{maxWidth:720}}>
          <div className="row-flex" style={{justifyContent:'space-between', marginBottom:16}}>
            <p style={{fontSize:14, color:'var(--ink-2)'}}>Only admins can create or modify categories. Users choose from these when posting.</p>
            <button className="btn btn-rust btn-sm" onClick={()=>setCatEditor('new')} disabled={catEditor !== null}>+ New category</button>
          </div>
          {catError && <div style={{fontSize:12, color:'var(--rust)', marginBottom:12}}>{catError}</div>}

          {catEditor === 'new' && (
            <AdminForumCategoryEditor
              cat={null}
              onSave={handleCatSave}
              onCancel={() => setCatEditor(null)}
            />
          )}

          <div style={{display:'grid', gap:8}}>
            {categories.length === 0 && catEditor !== 'new' && (
              <div style={{padding:'32px 0', textAlign:'center', color:'var(--ink-2)', fontSize:14}}>
                No categories yet. Create one above and it will appear in the forum sidebar.
              </div>
            )}
            {categories.map((c, i) => (
              <React.Fragment key={c.id || i}>
                {catEditor === i ? (
                  <AdminForumCategoryEditor
                    cat={c}
                    onSave={handleCatSave}
                    onCancel={() => setCatEditor(null)}
                  />
                ) : (
                  <div style={{display:'flex', alignItems:'center', gap:12, padding:'12px 16px', background:'var(--paper)', border:'1px solid var(--line)'}}>
                    <div style={{display:'flex', flexDirection:'column', gap:2}}>
                      <button onClick={()=>moveCat(i,-1)} disabled={i===0||catSaving} style={{background:'none',border:'none',cursor:'pointer',fontSize:10,color:'var(--ink-3)',lineHeight:1,padding:'1px 3px'}}>▲</button>
                      <button onClick={()=>moveCat(i,1)} disabled={i===categories.length-1||catSaving} style={{background:'none',border:'none',cursor:'pointer',fontSize:10,color:'var(--ink-3)',lineHeight:1,padding:'1px 3px'}}>▼</button>
                    </div>
                    <div style={{flex:1}}>
                      <div style={{fontWeight:600, fontSize:14}}>{c.label || c.name}</div>
                      {(c.desc || c.description) && <div style={{fontSize:12, color:'var(--ink-2)', marginTop:2}}>{c.desc || c.description}</div>}
                      <div className="mono" style={{fontSize:10, color:'var(--ink-3)', marginTop:4}}>slug: {c.id}</div>
                    </div>
                    <span className="mono" style={{fontSize:11, color:'var(--ink-2)'}}>
                      {threads.filter(t => t.cat === c.id).length} threads
                    </span>
                    <button className="btn btn-ghost btn-sm" onClick={()=>setCatEditor(i)} disabled={catEditor !== null || catSaving}>Edit</button>
                    <button className="btn btn-ghost btn-sm" style={{color:'var(--rust)'}} onClick={()=>handleCatDelete(i)} disabled={catSaving}>Delete</button>
                  </div>
                )}
              </React.Fragment>
            ))}
          </div>
        </div>
      )}

      {tab==='rules' && (
        <div style={{maxWidth:720}}>
          <p style={{fontSize:14, color:'var(--ink-2)', marginBottom:14}}>Shown to every new member on signup, and at the bottom of every Forum page.</p>
          <textarea className="textarea" style={{minHeight: 280}} value={conduct} onChange={e=>{ setConduct(e.target.value); setConductNotice(null); }}/>
          <div className="row-flex" style={{marginTop:12, alignItems:'center', gap:12}}>
            <button className="btn btn-rust" disabled={conductSaving} onClick={saveConductText}>{conductSaving ? 'Saving…' : 'Save & publish'}</button>
            {conductNotice && <span style={{fontSize:13, color: conductNotice.type === 'error' ? 'var(--rust)' : 'var(--green, #2a7a4b)'}}>{conductNotice.msg}</span>}
          </div>
        </div>
      )}
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

  useEffect(() => {
    fetch('/api/admin/groups', { credentials:'include' })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(d => setRows(d.items || []))
      .catch(() => setRows([]));
  }, []);

  useEffect(() => {
    let mounted = true;
    setOptionsLoading(true);
    Promise.all([
      fetch('/api/admin/forum/categories', { credentials:'include' }).then(r => r.ok ? r.json() : Promise.reject()),
      fetch('/api/admin/tutorials/list', { credentials:'include' }).then(r => r.ok ? r.json() : Promise.reject()),
      fetch('/api/admin/software/list', { credentials:'include' }).then(r => r.ok ? r.json() : Promise.reject()),
    ])
      .then(([forumData, tutorialsData, softwareData]) => {
        if (!mounted) return;
        setAccessOptions({
          forumCategories: forumData.items || [],
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
    await fetch('/api/admin/groups/delete', { method:'POST', headers:postHeaders(), credentials:'include', body: JSON.stringify({ id: edit.id }) }).catch(()=>null);
    setRows(rs => rs.filter(r => r.id !== edit.id));
    setEdit(null);
  };

  const addMember = () => {
    const name = newMember.trim();
    if (!name || form.members.find(m=>m.username===name)) return;
    setForm(f => ({ ...f, members: [...f.members, { username: name, joinedAt: new Date().toISOString().slice(0,10) }] }));
    setNewMember('');
  };

  const removeMember = (username) => setForm(f => ({ ...f, members: f.members.filter(m=>m.username!==username) }));

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
          { key:'price', label:'Price', w:'90px', render:r => <span className="mono" style={{fontSize:12}}>{r.price||'—'}</span> },
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
              <div key={t} className={`tab ${drawerTab===t?'active':''}`} onClick={()=>setDrawerTab(t)} style={{textTransform:'capitalize'}}>{t}</div>
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
          </>)}

          {drawerTab==='members' && (<>
            <div className="row-flex" style={{gap:8, marginBottom:16}}>
              <input className="input" style={{flex:1}} placeholder="Username" value={newMember} onChange={e=>setNewMember(e.target.value)} onKeyDown={e=>e.key==='Enter'&&addMember()}/>
              <button className="btn btn-ghost btn-sm" onClick={addMember}>Add</button>
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
            <GroupAccessPicker label="Forum categories" options={accessOptions.forumCategories} loading={optionsLoading} emptyMessage="No forum categories found." selected={form.access.forumCategories} onChange={v=>setForm(f=>({...f,access:{...f.access,forumCategories:v}}))}/>
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
              <option value="">— select —</option>
              {customers.map(c=><option key={c.id} value={c.id}>{c.name} {c.email ? `(${c.email})` : ''}</option>)}
            </select>
          </label>
          <label className="field">
            <span className="label">Customer B (merge into A)</span>
            <select className="input" value={bId} onChange={e=>setBId(e.target.value)}>
              <option value="">— select —</option>
              {customers.filter(c=>c.id!==aId).map(c=><option key={c.id} value={c.id}>{c.name} {c.email ? `(${c.email})` : ''}</option>)}
            </select>
          </label>
        </div>
        {a && b && (
          <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
            <thead>
              <tr>
                <th style={{textAlign:'left',padding:'6px 8px',color:'var(--ink-2)',fontWeight:600,fontSize:11}}>FIELD</th>
                <th style={{textAlign:'left',padding:'6px 8px',color:'var(--ink-2)',fontWeight:600,fontSize:11}}>A — {a.name}</th>
                <th style={{textAlign:'left',padding:'6px 8px',color:'var(--ink-2)',fontWeight:600,fontSize:11}}>B — {b.name}</th>
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
                      {chosen==='a' && <span style={{marginLeft:6,fontSize:10,color:'var(--rust)',fontWeight:700}}>✓ KEEP</span>}
                    </td>
                    <td style={{padding:'8px',cursor:'pointer',background:chosen==='b'?'var(--bg-deep)':'transparent',borderRadius:4}} onClick={()=>pick(f.key,'b')}>
                      <span style={{fontSize:12}}>{bv || <em style={{color:'var(--ink-3)'}}>empty</em>}</span>
                      {chosen==='b' && <span style={{marginLeft:6,fontSize:10,color:'var(--rust)',fontWeight:700}}>✓ KEEP</span>}
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
            {busy ? 'Merging…' : 'Merge →'}
          </button>
        </div>
      </div>
    </div>
  );
}

function CustomerLinkedJobs({ customerId, email, manualLinks, onLinksChange }) {
  const [jobs, setJobs] = useState(null);
  const [allJobs, setAllJobs] = useState([]);
  const [selected, setSelected] = useState('');

  useEffect(() => {
    if (!customerId) return;
    fetch(`/api/admin/customers/linked-jobs?id=${customerId}`, { credentials:'include' })
      .then(r => r.ok ? r.json() : Promise.reject()).then(d => setJobs(d)).catch(() => setJobs({ orders:[], repairs:[], quotes:[] }));
  }, [customerId]);

  useEffect(() => {
    // Load all orders, repairs, quotes for the dropdown
    Promise.all([
      fetch('/api/admin/orders', { credentials:'include' }).then(r => r.ok ? r.json() : { items:[] }),
      fetch('/api/admin/repairs', { credentials:'include' }).then(r => r.ok ? r.json() : []),
      fetch('/api/admin/quotes', { credentials:'include' }).then(r => r.ok ? r.json() : { items:[] }),
    ]).then(([od, rd, qd]) => {
      const orders = (od.items || od.orders || []).map(o => ({ id: o.id, ref: o.ref || o.id, label: o.title || o.description || o.ref || o.id, _type: 'order' }));
      const repairs = (Array.isArray(rd) ? rd : (rd.items || rd.repairs || [])).map(r => ({ id: r.id, ref: r.id, label: r.service || r.description || r.id, _type: 'repair' }));
      const quotes = (qd.items || qd.quotes || []).map(q => ({ id: q.id, ref: q.ref || q.id, label: q.service || q.description || q.ref || q.id, _type: 'quote' }));
      setAllJobs([...orders, ...repairs, ...quotes]);
    }).catch(() => {});
  }, []);

  function addLink() {
    if (!selected) return;
    if ((manualLinks||[]).includes(selected)) return;
    onLinksChange([...(manualLinks||[]), selected]);
    setSelected('');
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

  // Jobs available to manually link (not already auto-matched by email)
  const autoIds = new Set(autoLinked.map(j => j.id));
  const available = allJobs.filter(j => !autoIds.has(j.id) && !(manualLinks||[]).includes(j.id));

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
      <div className="row-flex" style={{gap:8}}>
        <select className="input" style={{flex:1,fontSize:13}} value={selected} onChange={e=>setSelected(e.target.value)}>
          <option value="">— link a job —</option>
          {available.filter(j=>j._type==='order').length > 0 && (
            <optgroup label="Orders">
              {available.filter(j=>j._type==='order').map(j=><option key={j.id} value={j.id}>{j.ref || j.id}{j.label && j.label !== j.ref ? ` — ${j.label}` : ''}</option>)}
            </optgroup>
          )}
          {available.filter(j=>j._type==='repair').length > 0 && (
            <optgroup label="Repairs">
              {available.filter(j=>j._type==='repair').map(j=><option key={j.id} value={j.id}>{j.ref || j.id}{j.label && j.label !== j.ref ? ` — ${j.label}` : ''}</option>)}
            </optgroup>
          )}
          {available.filter(j=>j._type==='quote').length > 0 && (
            <optgroup label="Quotes">
              {available.filter(j=>j._type==='quote').map(j=><option key={j.id} value={j.id}>{j.ref || j.id}{j.label && j.label !== j.ref ? ` — ${j.label}` : ''}</option>)}
            </optgroup>
          )}
        </select>
        <button className="btn btn-ghost btn-sm" disabled={!selected} onClick={addLink}>Add</button>
      </div>
    </div>
  );
}

function AdminCustomers() {
  const [rows, setRows] = useState([]);
  const [edit, setEdit] = useState(null);
  const [form, setForm] = useState({});
  const [mergeOpen, setMergeOpen] = useState(false);
  useEffect(() => {
    fetch('/api/admin/customers', { credentials:'include' })
      .then(r => r.ok ? r.json() : Promise.reject()).then(d => setRows(d.items || [])).catch(() => setRows([]));
  }, []);
  const openCustomer = (r) => { setEdit(r); setForm({...r, tagsStr: (r.tags||[]).join(', ')}); };
  return (
    <div style={{padding:32, display:'grid', gap:24}}>
      <div className="grid-4">
        <StatTile label="ACTIVE CUSTOMERS · 90D" value="—" />
        <StatTile label="NEW THIS MONTH" value="—" />
        <StatTile label="REPEAT RATE" value="—" />
        <StatTile label="AVG ORDER VALUE" value="—" />
      </div>
      <div className="row-flex" style={{justifyContent:'flex-end', gap:8, marginBottom:-8}}>
        <button className="btn btn-ghost btn-sm" onClick={() => setMergeOpen(true)}>Merge duplicates</button>
        <button className="btn btn-rust btn-sm" onClick={() => { setEdit({}); setForm({ name:'', loc:'', email:'', phone:'', tagsStr:'', orders:0, spent:0, last:'' }); }}>+ New customer</button>
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
      {edit !== null && (
        <Drawer open={true} onClose={() => setEdit(null)} title={edit.name || 'New customer'}
          footer={<div className="row-flex" style={{justifyContent:'space-between'}}>
            {edit.id && <button className="btn btn-ghost btn-sm" style={{color:'var(--rust)'}} onClick={async () => {
              if (!confirm('Delete this customer?')) return;
              await fetch('/api/admin/customers/delete', { method:'POST', headers:postHeaders(), credentials:'include', body: JSON.stringify({ id: edit.id }) }).catch(()=>null);
              setRows(rs => rs.filter(r => r.id !== edit.id));
              setEdit(null);
            }}>Delete</button>}
            {!edit.id && <span/>}
            <div className="row-flex" style={{gap:8}}>
              <button className="btn btn-ghost btn-sm" onClick={() => setEdit(null)}>Cancel</button>
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
                setEdit(null);
              }}>Save</button>
            </div>
          </div>}
        >
          <label className="field"><span className="label">Name</span><input className="input" value={form.name||''} onChange={e=>setForm({...form,name:e.target.value})}/></label>
          <label className="field"><span className="label">Location</span><input className="input" value={form.loc||''} onChange={e=>setForm({...form,loc:e.target.value})}/></label>
          <label className="field"><span className="label">Email</span><input className="input" type="email" value={form.email||''} onChange={e=>setForm({...form,email:e.target.value})}/></label>
          <label className="field"><span className="label">Phone</span><input className="input" value={form.phone||''} onChange={e=>setForm({...form,phone:e.target.value})}/></label>
          <label className="field"><span className="label">Tags (comma-separated)</span><input className="input" value={form.tagsStr||''} onChange={e=>setForm({...form,tagsStr:e.target.value})}/></label>
          <div className="grid-2" style={{gap:14}}>
            <label className="field"><span className="label">Orders</span><input className="input" type="number" value={form.orders||0} onChange={e=>setForm({...form,orders:Number(e.target.value)})}/></label>
            <label className="field"><span className="label">Lifetime spend (AUD)</span><input className="input" type="number" value={form.spent||0} onChange={e=>setForm({...form,spent:Number(e.target.value)})}/></label>
          </div>
          <label className="field"><span className="label">Last order</span><input className="input" value={form.last||''} onChange={e=>setForm({...form,last:e.target.value})}/></label>
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
        </Drawer>
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
  const soldRows = rows.filter(r => r.status === 'Sold');
  const totalPayout = soldRows.reduce((s, r) => {
    const n = parseFloat((r.payout || '').replace(/[^0-9.]/g, ''));
    return s + (isNaN(n) ? 0 : n);
  }, 0);
  const doPayouts = async () => {
    setPayoutsBusy(true);
    await fetch('/api/admin/sellers/process-payouts', { method:'POST', headers:postHeaders(), credentials:'include', body: JSON.stringify({ ids: soldRows.map(r => r.id) }) }).catch(()=>null);
    setPayoutsBusy(false);
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
              <div className="mono" style={{fontSize:12, color:'var(--eucalyptus)', marginBottom:8}}>✓ PAYOUTS QUEUED</div>
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
              await fetch('/api/admin/sellers/delete', { method:'POST', headers:postHeaders(), credentials:'include', body: JSON.stringify({ id: edit.id }) }).catch(()=>null);
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
          <label className="field"><span className="label">Seller</span><input className="input" value={form.seller||''} onChange={e=>setForm({...form,seller:e.target.value})}/></label>
          <label className="field"><span className="label">Item</span><input className="input" value={form.item||''} onChange={e=>setForm({...form,item:e.target.value})}/></label>
          <label className="field"><span className="label">Tier</span><input className="input" value={form.tier||''} onChange={e=>setForm({...form,tier:e.target.value})}/></label>
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
  const [rows, setRows] = useState([]);
  const [issueForm, setIssueForm] = useState({ balance: '', recipientEmail: '', note: '' });
  const [issueError, setIssueError] = useState(null);
  const [issuing, setIssuing] = useState(false);
  const [filter, setFilter] = useState('all');

  const load = () => fetch('/api/admin/gift-cards', { credentials: 'include' })
    .then(r => r.json()).then(d => setRows(d.items || [])).catch(() => {});

  useEffect(() => { load(); }, []);

  const voidCard = async (code) => {
    if (!confirm(`Void gift card ${code}? This cannot be undone.`)) return;
    await fetch('/api/admin/gift-cards/void', { method: 'POST', headers: postHeaders(), credentials: 'include', body: JSON.stringify({ code }) });
    load();
  };

  const issue = async () => {
    const balance = Number(issueForm.balance);
    if (!balance || balance <= 0) { setIssueError('Enter a valid amount.'); return; }
    setIssuing(true);
    setIssueError(null);
    const resp = await fetch('/api/admin/gift-cards/issue', { method: 'POST', headers: postHeaders(), credentials: 'include', body: JSON.stringify(issueForm) });
    const data = await resp.json();
    setIssuing(false);
    if (data.ok) { setIssueForm({ balance: '', recipientEmail: '', note: '' }); load(); }
    else setIssueError(data.message || 'Failed to issue gift card.');
  };

  const filtered = filter === 'all' ? rows
    : filter === 'active' ? rows.filter(r => !r.isVoid && r.balance > 0)
    : filter === 'used' ? rows.filter(r => !r.isVoid && r.balance === 0)
    : rows.filter(r => r.isVoid);

  return (
    <div style={{padding:32}}>
      <div style={{display:'grid', gridTemplateColumns:'1fr 320px', gap:32, alignItems:'start'}}>
        <div>
          <div className="tabs" style={{marginBottom:18}}>
            {[['all','All'], ['active','Active'], ['used','Used up'], ['void','Voided']].map(([v,l]) => (
              <div key={v} className={`tab ${filter===v?'active':''}`} onClick={() => setFilter(v)}>{l} ({(v==='all'?rows:rows.filter(r=>v==='active'?!r.isVoid&&r.balance>0:v==='used'?!r.isVoid&&r.balance===0:r.isVoid)).length})</div>
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
              { key:'recipientEmail', label:'Recipient', w:'1fr', render: r => <span style={{fontSize:12, color:'var(--ink-2)'}}>{r.recipientEmail || '—'}</span> },
              { key:'orderId', label:'Order', w:'160px', render: r => <span className="mono" style={{fontSize:11, color:'var(--ink-3)'}}>{r.orderId || '—'}</span> },
              { key:'issuedAt', label:'Issued', w:'110px', render: r => <span style={{fontSize:12}}>{r.issuedAt ? new Date(r.issuedAt).toLocaleDateString('en-AU') : '—'}</span> },
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
    </div>
  );
}

// EXPENSES
// ============================================================
function AdminExpenses() {
  const [rows, setRows] = useState([]);
  const [edit, setEdit] = useState(null);
  const [form, setForm] = useState({});
  const [jobOptions, setJobOptions] = useState([]);
  const [catFilter, setCatFilter] = useState('all');

  useEffect(() => {
    fetch('/api/admin/expenses', { credentials:'include' })
      .then(r => r.ok ? r.json() : Promise.reject()).then(d => setRows(d.items || [])).catch(() => setRows([]));
    fetch('/api/admin/orders', { credentials:'include' })
      .then(r => r.ok ? r.json() : Promise.reject()).then(d => setJobOptions(d.items || [])).catch(() => {});
  }, []);

  const openRow = (r) => { setEdit(r); setForm({...r}); };
  const openNew = () => { setEdit({}); setForm({ description:'', category:'tools', amount:0, date:'', receipt:null, jobId:'', notes:'', isSecondHand:false, partStatus:'' }); };

  const save = async () => {
    const r = await fetch('/api/admin/expenses/save', { method:'POST', headers:postHeaders(), credentials:'include', body: JSON.stringify(form) }).catch(()=>null);
    if (r && r.ok) {
      const d = await r.json();
      if (!edit.id) setRows(rs => [...rs, d.item]);
      else setRows(rs => rs.map(x => x.id === edit.id ? d.item : x));
    }
    setEdit(null);
  };

  const del = async () => {
    if (!form.id || !confirm('Delete this expense?')) return;
    await fetch('/api/admin/expenses/delete', { method:'POST', headers:postHeaders(), credentials:'include', body: JSON.stringify({ id: form.id }) }).catch(()=>null);
    setRows(rs => rs.filter(x => x.id !== form.id));
    setEdit(null);
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
    const [d, m, y] = s.split('/');
    return new Date(y, m - 1, d);
  };
  const sorted = [...rows].sort((a, b) => parseDate(b.date) - parseDate(a.date));
  const visible = catFilter === 'all' ? sorted : sorted.filter(r => (r.category || 'other') === catFilter);
  const total = visible.reduce((s, e) => s + (Number(e.amount) || 0), 0);

  return (
    <div style={{padding:32}}>
      <div className="row-flex" style={{justifyContent:'space-between', marginBottom:18}}>
        <div className="row-flex" style={{gap:16, alignItems:'center'}}>
          <div className="tabs">
            {cats.map(c => (
              <div key={c} className={`tab${catFilter===c?' active':''}`} onClick={() => setCatFilter(c)} style={{cursor:'pointer'}}>
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
          { key:'description', label:'Description', w:'2fr', render:r => <span style={{fontWeight:500}}>{r.description}</span> },
          { key:'category', label:'Category', w:'110px', render:r => { const c = catMap[r.category]||catMap.other; return <span className="tag" style={{background:c.bg,color:c.fg,borderColor:c.bg}}>{(r.category||'other').toUpperCase()}</span>; } },
          { key:'isSecondHand', label:'Condition', w:'100px', render:r => r.isSecondHand ? <span className="tag tag-ochre">2ND HAND</span> : <span className="tag tag-euc">NEW</span> },
          { key:'partStatus', label:'Part status', w:'110px', render:r => {
            if (!r.partStatus) return <span style={{color:'var(--ink-3)'}}>—</span>;
            const sc = { ordered:{bg:'#dceaf5',fg:'#1668c8'}, arrived:{bg:'#fff4d6',fg:'#7a5d10'}, installed:{bg:'#d8e7d0',fg:'#345526'}, returned:{bg:'#f3d5c5',fg:'#7a3a18'} };
            const s = sc[r.partStatus] || {bg:'var(--bg-deep)',fg:'var(--ink-2)'};
            return <span className="tag" style={{background:s.bg,color:s.fg,borderColor:s.bg}}>{r.partStatus.toUpperCase()}</span>;
          }},
          { key:'amount', label:'Amount', w:'110px', render:r => <span className="mono" style={{fontWeight:600,color:'var(--rust)'}}>-${(r.amount||0).toLocaleString('en-AU',{minimumFractionDigits:2})}</span> },
          { key:'date', label:'Date', w:'120px', render:r => <span className="mono" style={{fontSize:11,color:'var(--ink-2)'}}>{r.date||'—'}</span> },
          { key:'jobId', label:'Linked job', w:'140px', render:r => r.jobId ? <span className="mono" style={{fontSize:11,color:'var(--rust)'}}>{r.jobId}</span> : <span style={{color:'var(--ink-3)'}}>—</span> },
          { key:'receipt', label:'Receipt', w:'90px', render:r => r.receipt ? <a href={r.receipt} target="_blank" style={{color:'var(--rust)',fontSize:12}}>View ↗</a> : <span style={{color:'var(--ink-3)'}}>—</span> },
          { key:'notes', label:'Notes', w:'1fr', render:r => <span style={{fontSize:12,color:'var(--ink-2)'}}>{r.notes||''}</span> },
        ]}
        rows={visible}
        onRowClick={openRow}
      />
      {edit !== null && (
        <Drawer open={true} onClose={() => setEdit(null)} title={edit.id ? `Edit — ${form.description}` : 'Log expense'}
          footer={<div className="row-flex" style={{justifyContent:'space-between'}}>
            {edit.id && <button className="btn btn-ghost btn-sm" style={{color:'var(--rust)'}} onClick={del}>Delete</button>}
            {!edit.id && <span/>}
            <div className="row-flex" style={{gap:8}}>
              <button className="btn btn-ghost btn-sm" onClick={() => setEdit(null)}>Cancel</button>
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
            <label className="field"><span className="label">Amount (AUD)</span><input className="input" type="number" step="0.01" value={form.amount||0} onChange={e=>setForm({...form,amount:Number(e.target.value)})}/></label>
          </div>
          <label className="field"><span className="label">Date</span><input className="input" value={form.date||''} onChange={e=>setForm({...form,date:e.target.value})}/></label>
          <label className="field"><span className="label">Link to job</span>
            <select className="select" value={form.jobId||''} onChange={e=>setForm({...form,jobId:e.target.value})}>
              <option value="">— No job link —</option>
              {jobOptions.map(j => <option key={j.id} value={j.id}>{j.id} · {j.cust} · {j.items}</option>)}
            </select>
          </label>
          <label className="field"><span className="label">Notes</span><input className="input" value={form.notes||''} onChange={e=>setForm({...form,notes:e.target.value})}/></label>
          <label className="field"><span className="label">Part status</span>
            <select className="select" value={form.partStatus||''} onChange={e=>setForm({...form,partStatus:e.target.value})}>
              <option value="">— Not applicable —</option>
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
                <a href={form.receipt} target="_blank" style={{color:'var(--rust)',fontSize:13}}>View current receipt ↗</a>
                <button className="btn btn-ghost btn-sm" style={{color:'var(--rust)'}} onClick={() => setForm(f=>({...f,receipt:null}))}>Remove</button>
              </div>
            )}
            <label style={{cursor:'pointer',display:'inline-block'}}>
              <input type="file" accept="image/*,application/pdf" style={{display:'none'}} onChange={e => { if(e.target.files[0]) handleReceiptUpload(e.target.files[0]); }}/>
              <span className="btn btn-ghost btn-sm">{form.receipt ? 'Replace receipt' : 'Upload receipt'}</span>
            </label>
          </div>
        </Drawer>
      )}
    </div>
  );
}

// ============================================================
// POLICIES — edit
// ============================================================
function AdminPolicies() {
  const [docs, setDocs] = useState([]);
  const [form, setForm] = useState({ id:'', title:'', slug:'', body:'', status:'draft' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [error, setError] = useState('');
  const [active, setActive] = useState('');
  const activeDoc = useMemo(() => docs.find(d => d.id === active) || null, [docs, active]);
  const validate = () => {
    if (!form.title.trim()) return 'Title is required.';
    if (!form.slug.trim() || !/^[a-z0-9-]+$/.test(form.slug.trim().toLowerCase())) return 'Slug must use lowercase letters, numbers, and hyphens.';
    if (!form.body.trim()) return 'Body is required.';
    return '';
  };
  const hydrateForm = (doc) => setForm({
    id: doc?.id || '',
    title: doc?.title || '',
    slug: doc?.slug || '',
    body: doc?.body || '',
    status: doc?.status || 'draft',
    updatedAt: doc?.updatedAt || '',
    updatedBy: doc?.updatedBy || '',
    publishedAt: doc?.publishedAt || '',
    publishedBy: doc?.publishedBy || '',
  });
  useEffect(() => {
    fetch('/api/admin/policies', { credentials:'include' })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(d => {
        const items = d.items || [];
        setDocs(items);
        if (items[0]?.id) {
          setActive(items[0].id);
          hydrateForm(items[0]);
        } else {
          const empty = { id:`policy-${Date.now()}`, title:'', slug:'', body:'', status:'draft' };
          setActive(empty.id);
          hydrateForm(empty);
        }
      })
      .catch(() => setError('Failed to load policies.'))
      .finally(() => setLoading(false));
  }, []);
  const selectDoc = (doc) => { setActive(doc.id); hydrateForm(doc); setStatusMsg(''); setError(''); };
  const onSave = async (publish = false) => {
    const validationError = validate();
    if (validationError) { setError(validationError); return; }
    setSaving(true); setError(''); setStatusMsg('');
    try {
      const payload = { ...form, slug: form.slug.trim().toLowerCase(), status: publish ? 'published' : form.status };
      const res = await fetch('/api/admin/policies/save', { method:'POST', credentials:'include', headers:postHeaders(), body: JSON.stringify(payload) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to save policy.');
      const updated = data.item;
      setDocs(prev => {
        const idx = prev.findIndex(d => d.id === updated.id);
        if (idx >= 0) { const next = [...prev]; next[idx] = updated; return next; }
        return [updated, ...prev];
      });
      setActive(updated.id);
      hydrateForm(updated);
      setStatusMsg(publish ? 'Saved and published.' : 'Saved.');
    } catch (e) { setError(e.message || 'Failed to save policy.'); }
    finally { setSaving(false); }
  };
  const onPublishToggle = async () => {
    if (!activeDoc) return;
    setSaving(true); setError(''); setStatusMsg('');
    try {
      const targetStatus = activeDoc.status === 'published' ? 'draft' : 'published';
      const res = await fetch('/api/admin/policies/publish', { method:'POST', credentials:'include', headers:postHeaders(), body: JSON.stringify({ id: activeDoc.id, status: targetStatus }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to update publish status.');
      setDocs(prev => prev.map(d => d.id === data.item.id ? data.item : d));
      hydrateForm(data.item);
      setStatusMsg(targetStatus === 'published' ? 'Published.' : 'Moved to draft.');
    } catch (e) { setError(e.message || 'Failed to update publish status.'); }
    finally { setSaving(false); }
  };
  return (
    <div style={{padding:32, display:'grid', gridTemplateColumns:'260px 1fr', gap:24}}>
      {loading && <div className="mono" style={{fontSize:12, color:'var(--ink-2)'}}>Loading…</div>}
      {error && <div style={{fontSize:12, color:'var(--rust)'}}>{error}</div>}
      <aside>
        <div className="row-flex" style={{justifyContent:'space-between', marginBottom: 12}}>
          <span className="eyebrow">DOCUMENTS</span>
          <a className="mono" style={{fontSize:11, color:'var(--rust)', cursor:'pointer'}} onClick={() => {
            const next = { id:`policy-${Date.now()}`, title:'', slug:'', body:'', status:'draft' };
            setActive(next.id); hydrateForm(next); setStatusMsg(''); setError('');
          }}>+ NEW</a>
        </div>
        <div style={{display:'grid', gap:2}}>
          {docs.map(d => (
            <a key={d.id} onClick={()=>selectDoc(d)} style={{padding:'10px 12px', cursor:'pointer', fontSize:13, borderLeft: active===d.id?'2px solid var(--rust)':'2px solid transparent', background: active===d.id?'var(--bg-elev)':'transparent', color: active===d.id?'var(--rust)':'var(--ink)', fontWeight: active===d.id?600:400}}>
              <div>{d.title || d.slug || 'Untitled policy'}</div>
              <div className="mono" style={{fontSize:10, color:'var(--ink-3)', marginTop:2}}>UPDATED {(d.updatedAt || 'N/A').toUpperCase()}</div>
            </a>
          ))}
        </div>
      </aside>
      <div style={{background:'var(--paper)', border:'1px solid var(--line)', padding:28}}>
        <div className="row-flex" style={{justifyContent:'space-between'}}>
          <h2 className="serif" style={{fontSize:28}}>{activeDoc?.title || 'Policy document'}</h2>
          <div className="row-flex" style={{gap:8}}>
            <span className={`tag ${activeDoc?.status === 'published' ? 'tag-euc' : 'tag-red'}`}>{(activeDoc?.status || 'draft').toUpperCase()}</span>
            <button className="btn btn-ghost btn-sm" onClick={onPublishToggle} disabled={saving || !activeDoc?.id}>{activeDoc?.status === 'published' ? 'Unpublish' : 'Publish'}</button>
            <button className="btn btn-rust btn-sm" onClick={() => onSave(true)} disabled={saving}>Save & publish</button>
          </div>
        </div>
        <div className="mono" style={{fontSize:11, color:'var(--ink-2)', marginTop:8}}>SLUG · /policies/{form.slug || 'new-policy'} · LAST EDITED BY {form.updatedBy || '—'} · {form.updatedAt || '—'}</div>
        {statusMsg && <div style={{marginTop:8, fontSize:12, color:'var(--eucalyptus)'}}>{statusMsg}</div>}
        {error && <div style={{marginTop:8, fontSize:12, color:'var(--rust)'}}>{error}</div>}
        <hr className="thin"/>
        <div className="grid-2" style={{gap:12, marginBottom:10}}>
          <label className="field"><span className="label">Title</span><input className="input" value={form.title} onChange={e=>setForm({...form, title:e.target.value})}/></label>
          <label className="field"><span className="label">Slug</span><input className="input" value={form.slug} onChange={e=>setForm({...form, slug:e.target.value.toLowerCase().replace(/[^a-z0-9-]/g,'-')})}/></label>
        </div>
        <textarea className="textarea" style={{minHeight:440, fontSize:14, lineHeight:1.6}} value={form.body} onChange={e=>setForm({...form, body:e.target.value})}/>
        <div style={{marginTop:12}}>
          <button className="btn btn-ghost btn-sm" onClick={() => onSave(false)} disabled={saving}>Save draft</button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// SETTINGS
// ============================================================
function AdminSettings({ sessionInfo = {} }) {
  if (sessionInfo.role === 'seller') return <SellerSettings sessionInfo={sessionInfo} />;
  return <AdminSettingsFull sessionInfo={sessionInfo} />;
}

function SellerSettings({ sessionInfo = {} }) {
  const [form, setForm] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  useEffect(() => {
    fetch('/api/admin/staff', { credentials:'include' })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(d => {
        const me = (d.members || []).find(m => m.id === sessionInfo.staffId);
        if (me) setForm({ ...me, pin: '', newPin: '' });
      })
      .catch(() => {});
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
  if (!form) return <div style={{padding:32, fontSize:13, color:'var(--ink-2)'}}>Loading…</div>;
  return (
    <div style={{padding:32, maxWidth:480}}>
      {msg && <div style={{marginBottom:16, fontSize:13, color:msg.includes('Failed')||msg.includes('must')?'var(--rust)':'var(--eucalyptus)'}}>{msg}</div>}
      <div style={{background:'var(--paper)', border:'1px solid var(--line)', padding:24, display:'grid', gap:10}}>
        <span className="eyebrow">MY DETAILS</span>
        <label className="field" style={{marginTop:8}}><span className="label">Name</span><input className="input" value={form.name||''} onChange={e=>setForm({...form,name:e.target.value})}/></label>
        <label className="field"><span className="label">Email</span><input className="input" type="email" value={form.email||''} onChange={e=>setForm({...form,email:e.target.value})}/></label>
        <label className="field"><span className="label">Phone</span><input className="input" value={form.phone||''} onChange={e=>setForm({...form,phone:e.target.value})}/></label>
        <label className="field"><span className="label">Avatar colour</span><input type="color" value={form.color||'#d7c7a6'} onChange={e=>setForm({...form,color:e.target.value})} style={{width:48,height:32,padding:2,border:'1px solid var(--line)',borderRadius:4,cursor:'pointer'}}/></label>
        <label className="field"><span className="label">New PIN (leave blank to keep current)</span><input className="input" type="password" inputMode="numeric" maxLength={6} value={form.newPin||''} onChange={e=>setForm({...form,newPin:e.target.value.replace(/\D/g,'').slice(0,6)})} placeholder="4–6 digits"/></label>
        <button className="btn btn-rust btn-sm" style={{marginTop:4,alignSelf:'flex-start'}} disabled={busy} onClick={save}>{busy?'Saving…':'Save'}</button>
      </div>
    </div>
  );
}

function AdminSettingsFull({ sessionInfo = {} }) {
  const defaultShop = useMemo(() => ({
    tradingName: '',
    abn: '',
    address: '',
    mapLat: '',
    mapLng: '',
    phone: '',
    email: '',
    tagline: '',
    siteUrl: '',
  }), []);
  const defaultAnnouncement = useMemo(() => ({ text: '', enabled: false, expiresAt: '' }), []);
  const defaultSiteContent = useMemo(() => ({ aiHeading: '', aiBody: '', aiEnabled: false, workshopBlurb: '' }), []);
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
        setShop(nextShop);
        setSavedShop(nextShop);
        setAnnouncement(nextAnnouncement);
        setSavedAnnouncement(nextAnnouncement);
        setIntegrations(nextIntegrations);
        setSavedIntegrations(nextIntegrations);
        setSiteContent(nextSiteContent);
        setSavedSiteContent(nextSiteContent);
        setSecurity(nextSecurity);
        setSavedSecurity(nextSecurity);
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
        address: (payload.shop?.address || '').trim(),
        mapLat: (payload.shop?.mapLat || '').trim(),
        mapLng: (payload.shop?.mapLng || '').trim(),
        phone: (payload.shop?.phone || '').trim(),
        email: (payload.shop?.email || '').trim(),
        tagline: (payload.shop?.tagline || '').trim(),
        siteUrl: (payload.shop?.siteUrl || '').trim(),
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
      setShop(reconciledShop);
      setSavedShop(reconciledShop);
      setAnnouncement(reconciledAnnouncement);
      setSavedAnnouncement(reconciledAnnouncement);
      setIntegrations(reconciledIntegrations);
      setSavedIntegrations(reconciledIntegrations);
      setSiteContent(reconciledSiteContent);
      setSavedSiteContent(reconciledSiteContent);
      setSecurity(reconciledSecurity);
      setSavedSecurity(reconciledSecurity);
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
      setIntegrations([...integrations, [integrationForm.name.trim(), integrationForm.endpoint.trim(), true, config]]);
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
    await fetch('/api/admin/staff/members/save', { method:'POST', headers:postHeaders(), credentials:'include', body: JSON.stringify({ ...staffForm, name: staffForm.name.trim() }) }).catch(()=>null);
    setStaffBusy(false);
    setStaffForm(null);
    loadStaff();
  };
  const deleteStaffMember = async (id) => {
    await fetch('/api/admin/staff/members/delete', { method:'POST', headers:postHeaders(), credentials:'include', body: JSON.stringify({ id }) }).catch(()=>null);
    loadStaff();
  };
  return (
    <div style={{padding:32, display:'grid', gridTemplateColumns:'1fr 1fr', gap:24, maxWidth: 1200}}>
      {loading && <div className="mono" style={{fontSize:12, color:'var(--ink-2)'}}>Loading…</div>}
      {error && <div style={{fontSize:12, color:'var(--rust)'}}>{error}</div>}
      {statusMsg && <div style={{gridColumn:'1 / -1', fontSize:12, color:statusMsg.includes('Failed') || statusMsg.includes('must') ? 'var(--rust)' : 'var(--eucalyptus)'}}>{statusMsg}</div>}
      <form onSubmit={onShopSubmit} style={{background:'var(--paper)', border:'1px solid var(--line)', padding:24}}>
        <span className="eyebrow">SHOP DETAILS</span>
        <label className="field" style={{marginTop:12}}><span className="label">Trading name</span><input className="input" value={shop.tradingName} onChange={(e) => setShop({ ...shop, tradingName: e.target.value })}/></label>
        <label className="field"><span className="label">ABN</span><input className="input" value={shop.abn} onChange={(e) => setShop({ ...shop, abn: e.target.value })}/></label>
        <label className="field"><span className="label">Street address</span><input className="input" value={shop.address} onChange={(e) => setShop({ ...shop, address: e.target.value })}/></label>
        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:8}}>
          <label className="field"><span className="label">Map latitude</span><input className="input" value={shop.mapLat||''} onChange={(e) => setShop({ ...shop, mapLat: e.target.value })} placeholder="-35.9833"/></label>
          <label className="field"><span className="label">Map longitude</span><input className="input" value={shop.mapLng||''} onChange={(e) => setShop({ ...shop, mapLng: e.target.value })} placeholder="144.7500"/></label>
        </div>
        <label className="field"><span className="label">Phone</span><input className="input" value={shop.phone} onChange={(e) => setShop({ ...shop, phone: e.target.value })}/></label>
        <label className="field"><span className="label">Contact email</span><input className="input" type="email" value={shop.email||''} onChange={(e) => setShop({ ...shop, email: e.target.value })}/></label>
        <label className="field"><span className="label">Tagline</span><input className="input" value={shop.tagline} onChange={(e) => setShop({ ...shop, tagline: e.target.value })}/></label>
        <label className="field"><span className="label">Site URL</span><input className="input" value={shop.siteUrl||''} onChange={(e) => setShop({ ...shop, siteUrl: e.target.value })} placeholder="https://outbackelectronics.com.au"/></label>
        <div className="row-flex" style={{gap:8, marginTop:12}}>
          <button className="btn btn-rust btn-sm" disabled={!shopDirty || sectionBusy==='shop'}>{sectionBusy==='shop'?'Saving…':'Save'}</button>
          <button type="button" className="btn btn-ghost btn-sm" disabled={!shopDirty || sectionBusy==='shop'} onClick={() => setShop(savedShop)}>Cancel</button>
        </div>
      </form>
      <form onSubmit={onAnnouncementSubmit} style={{background:'var(--paper)', border:'1px solid var(--line)', padding:24}}>
        <span className="eyebrow">ANNOUNCEMENT BAR</span>
        <label className="field" style={{marginTop:12}}><span className="label">Message</span><input className="input" value={announcement.text} onChange={e => setAnnouncement({...announcement, text: e.target.value})} placeholder="e.g. SUMMER SALE — 15% OFF · ENDS 30 JUN"/></label>
        <label className="field" style={{flexDirection:'row', alignItems:'center', gap:8}}><input type="checkbox" checked={!!announcement.enabled} onChange={e => setAnnouncement({...announcement, enabled: e.target.checked})}/><span className="label" style={{margin:0}}>Show announcement bar</span></label>
        <label className="field"><span className="label">Expires on (optional)</span><input className="input" type="date" value={announcement.expiresAt || ''} onChange={e => setAnnouncement({...announcement, expiresAt: e.target.value})}/></label>
        <div className="row-flex" style={{gap:8, marginTop:12}}>
          <button className="btn btn-rust btn-sm" disabled={!announcementDirty || sectionBusy==='announcement'}>{sectionBusy==='announcement'?'Saving…':'Save'}</button>
          <button type="button" className="btn btn-ghost btn-sm" disabled={!announcementDirty || sectionBusy==='announcement'} onClick={() => setAnnouncement(savedAnnouncement)}>Cancel</button>
        </div>
      </form>
      <form onSubmit={onSiteContentSubmit} style={{background:'var(--paper)', border:'1px solid var(--line)', padding:24, gridColumn:'1 / -1'}}>
        <span className="eyebrow">SITE CONTENT</span>
        <div className="grid-2" style={{gap:16, marginTop:12}}>
          <div>
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
      <div style={{background:'var(--paper)', border:'1px solid var(--line)', padding:24}}>
        <span className="eyebrow">STAFF & ROLES</span>
        <div style={{display:'grid', gap:8, marginTop:12}}>
          {staffMembers.map(s => (
            <div key={s.id} style={{display:'flex', alignItems:'center', gap:10, padding:'8px 10px', background:'var(--bg-elev)'}}>
              <div className="avatar" style={{width:32, height:32, background:s.color||'#d7c7a6', fontSize:14}}>{(s.name||'?').split(' ').map(w=>w[0]).join('')}</div>
              <div style={{flex:1}}>
                <div style={{fontSize:13, fontWeight:600}}>{s.name}</div>
                <div className="mono" style={{fontSize:10, color:'var(--ink-2)'}}>{(s.role||'staff').toUpperCase()}{s.email ? ` · ${s.email}` : ''}</div>
              </div>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => openStaffForm(s)}>Edit</button>
              <button type="button" className="btn btn-ghost btn-sm" style={{color:'var(--rust)'}} onClick={() => deleteStaffMember(s.id)}>Remove</button>
            </div>
          ))}
          {staffMembers.length === 0 && <div className="mono" style={{fontSize:12, color:'var(--ink-3)'}}>No staff members yet.</div>}
        </div>
        <div className="row-flex" style={{gap:8, marginTop:12}}>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => openStaffForm(null)}>+ Add staff member</button>
        </div>
        {staffForm !== null && (
          <div style={{marginTop:16, padding:16, background:'var(--bg-elev)', display:'grid', gap:8}}>
            <span className="eyebrow" style={{fontSize:10}}>{staffForm.id ? 'EDIT MEMBER' : 'NEW MEMBER'}</span>
            <label className="field"><span className="label">Name</span><input className="input" value={staffForm.name} onChange={e=>setStaffForm({...staffForm,name:e.target.value})}/></label>
            <label className="field"><span className="label">Role</span>
              <select className="select" value={staffForm.role||'staff'} onChange={e=>setStaffForm({...staffForm,role:e.target.value})}>
                {['owner','manager','technician','staff','seller','pending'].map(r=><option key={r}>{r}</option>)}
              </select>
            </label>
            <label className="field"><span className="label">Email</span><input className="input" type="email" value={staffForm.email||''} onChange={e=>setStaffForm({...staffForm,email:e.target.value})}/></label>
            <label className="field"><span className="label">Phone</span><input className="input" value={staffForm.phone||''} onChange={e=>setStaffForm({...staffForm,phone:e.target.value})}/></label>
            <label className="field"><span className="label">Status</span>
              <select className="select" value={staffForm.status||'active'} onChange={e=>setStaffForm({...staffForm,status:e.target.value})}>
                {['active','inactive'].map(s=><option key={s}>{s}</option>)}
              </select>
            </label>
            <label className="field"><span className="label">PIN{staffForm.id ? ' (leave blank to keep current)' : ''}</span><input className="input" type="password" inputMode="numeric" maxLength={6} value={staffForm.pin||''} onChange={e=>setStaffForm({...staffForm,pin:e.target.value.replace(/\D/g,'').slice(0,6)})} placeholder={staffForm.id ? '4–6 digits' : '4–6 digits (required)'}/></label>
            <label className="field"><span className="label">Avatar colour</span><input type="color" value={staffForm.color||'#d7c7a6'} onChange={e=>setStaffForm({...staffForm,color:e.target.value})} style={{width:48,height:32,padding:2,border:'1px solid var(--line)',borderRadius:4,cursor:'pointer'}}/></label>
            <div className="row-flex" style={{gap:8, marginTop:4}}>
              <button className="btn btn-rust btn-sm" disabled={!staffForm.name.trim()||staffBusy} onClick={saveStaffMember}>{staffBusy?'Saving…':'Save'}</button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={()=>setStaffForm(null)}>Cancel</button>
            </div>
          </div>
        )}
      </div>
      <form onSubmit={onIntegrationsSubmit} style={{background:'var(--paper)', border:'1px solid var(--line)', padding:24}}>
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
          <span className="eyebrow">INTEGRATIONS</span>
          <button type="button" className="btn btn-ghost btn-sm" onClick={openAddIntegrationModal}>+ Add</button>
        </div>
        {integrations.length === 0 && <div style={{marginTop:12, fontSize:13, color:'var(--ink-3)'}}>No integrations configured.</div>}
        <div style={{display:'grid', gap:10, marginTop:12, fontSize:14}}>
          {integrations.map((r,i) => (
            <div key={i} style={{display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 0', borderBottom: i < integrations.length - 1 ? '1px solid var(--line)' : 'none'}}>
              <div>
                <div style={{fontWeight:600}}>{r[0]}</div>
                <div className="mono" style={{fontSize:11, color:r[2]?'var(--eucalyptus)':'var(--ink-3)', marginTop:2}}>{r[1].toUpperCase()} · {r[2] ? 'CONNECTED' : 'DISCONNECTED'}</div>
              </div>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => openIntegrationModal(i)}>{r[2]?'Configure':'Connect'}</button>
            </div>
          ))}
        </div>
        <div className="row-flex" style={{gap:8, marginTop:12}}>
          <button className="btn btn-rust btn-sm" disabled={!integrationsDirty || sectionBusy==='integrations'}>{sectionBusy==='integrations'?'Saving…':'Save'}</button>
          <button type="button" className="btn btn-ghost btn-sm" disabled={!integrationsDirty || sectionBusy==='integrations'} onClick={() => setIntegrations(savedIntegrations)}>Cancel</button>
        </div>
      </form>
      <form onSubmit={onSecuritySubmit} style={{background:'var(--paper)', border:'1px solid var(--line)', padding:24}}>
        <span className="eyebrow">SECURITY</span>
        <label className="field" style={{marginTop:12}}><span className="label">Admin username</span><input className="input" value={security.adminUsername} onChange={e => setSecurity({...security, adminUsername: e.target.value})}/></label>
        <label className="field"><span className="label">New password <span style={{fontWeight:400, color:'var(--ink-3)'}}>(leave blank to keep current)</span></span><input className="input" type="password" value={security.adminPassword} onChange={e => setSecurity({...security, adminPassword: e.target.value})}/></label>
        <label className="field"><span className="label">Confirm password</span><input className="input" type="password" value={security.confirmPassword} onChange={e => setSecurity({...security, confirmPassword: e.target.value})}/></label>
        {security.adminPassword && security.adminPassword !== security.confirmPassword && <div style={{fontSize:11, color:'var(--rust)', marginBottom:4}}>Passwords do not match</div>}
        <div className="row-flex" style={{gap:8, marginTop:12}}>
          <button className="btn btn-rust btn-sm" disabled={!securityDirty || sectionBusy==='security' || !!(security.adminPassword && security.adminPassword !== security.confirmPassword)}>{sectionBusy==='security'?'Saving…':'Save'}</button>
          <button type="button" className="btn btn-ghost btn-sm" disabled={!securityDirty || sectionBusy==='security'} onClick={() => setSecurity(savedSecurity)}>Cancel</button>
        </div>
      </form>
      <div style={{background:'var(--paper)', border:'1px solid var(--line)', padding:24}}>
        <span className="eyebrow">DANGER ZONE</span>
        <div style={{marginTop:14, display:'grid', gap:10}}>
          <div style={{padding:'14px', background:'var(--bg-elev)', border:'1px solid var(--line)'}}>
            <div style={{fontWeight:600}}>Rebuild search index</div>
            <p style={{fontSize:13, color:'var(--ink-2)', margin:'4px 0 8px'}}>Re-indexes products, tutorials, and forum threads.</p>
            {dangerMsg.rebuild && <div style={{fontSize:12, marginBottom:6, color:dangerMsg.rebuild.includes('✓')?'var(--eucalyptus)':'var(--rust)'}}>{dangerMsg.rebuild}</div>}
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
            <p style={{fontSize:13, color:'var(--ink-2)', margin:'4px 0 8px'}}>JSON dump of everything — products, orders, customers, content.</p>
            {dangerMsg.export && <div style={{fontSize:12, marginBottom:6, color:dangerMsg.export.includes('✓')?'var(--eucalyptus)':'var(--rust)'}}>{dangerMsg.export}</div>}
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
                setDangerMsg(m => ({...m, export:'Export failed — check server logs.'}));
              }
              setTimeout(() => setDangerMsg(m => ({...m, export:''})), 5000);
            }}>{sectionBusy==='export' ? 'Generating…' : 'Generate export'}</button>
          </div>
          <div style={{padding:'14px', background:'#3a1a14', color:'var(--paper)', border:'1px solid var(--rust)'}}>
            <div style={{fontWeight:600, color:'#ffb59c'}}>Maintenance mode</div>
            <p style={{fontSize:13, margin:'4px 0 8px', color:'var(--bg-deep)'}}>Shows a holding page to non-staff visitors.</p>
            {maintenanceEnabled && <div style={{fontSize:12, marginBottom:6, color:'#ffb59c', fontWeight:600}}>⚠ Maintenance mode is currently ON</div>}
            {dangerMsg.maint && <div style={{fontSize:12, marginBottom:6, color:'#ffb59c'}}>{dangerMsg.maint}</div>}
            {maintenanceEnabled ? (
              <button className="btn btn-ghost btn-sm" disabled={sectionBusy==='maint'} onClick={async () => {
                setSectionBusy('maint');
                const r = await fetch('/api/admin/maintenance', { method:'POST', credentials:'include', headers:postHeaders(), body: JSON.stringify({ enabled: false }) }).catch(()=>null);
                setSectionBusy('');
                if (r && r.ok) {
                  setMaintenanceEnabled(false);
                  setDangerMsg(m => ({...m, maint:'✓ Maintenance mode disabled.'}));
                } else {
                  setDangerMsg(m => ({...m, maint:'Error disabling maintenance mode.'}));
                }
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
                  if (r && r.ok) {
                    setMaintenanceEnabled(true);
                    setDangerMsg(m => ({...m, maint:'✓ Maintenance mode enabled.'}));
                  } else {
                    setDangerMsg(m => ({...m, maint:'Error enabling maintenance mode.'}));
                  }
                }}>{sectionBusy==='maint' ? 'Enabling…' : 'Yes, enable'}</button>
              </div>
            )}
          </div>
        </div>
      </div>
      {integrationModal && (
        <div style={{position:'fixed', inset:0, zIndex:500, background:'rgba(15,13,10,0.75)', display:'flex', flexDirection:'column', alignItems:'center', padding:'40px 16px', overflowY:'auto'}} onClick={() => setIntegrationModal(null)}>
          <div style={{width:'100%', maxWidth:480, background:'var(--paper)', padding:32, boxShadow:'0 16px 48px rgba(0,0,0,.35)'}} onClick={e => e.stopPropagation()}>
            <div style={{fontWeight:700, fontSize:16, marginBottom:16}}>
              {integrationModal.mode === 'add' ? 'Add Integration' : `Configure ${integrationForm.name}`}
            </div>
            {integrationModal.mode === 'add' && <>
              <label className="field"><span className="label">Name</span><input className="input" value={integrationForm.name} onChange={e => setIntegrationForm({...integrationForm, name: e.target.value})} placeholder="e.g. Mailchimp"/></label>
              <label className="field"><span className="label">Endpoint</span><input className="input" value={integrationForm.endpoint} onChange={e => setIntegrationForm({...integrationForm, endpoint: e.target.value})} placeholder="e.g. api.mailchimp.com"/></label>
              <label className="field"><span className="label">API Key</span><input className="input" type="password" value={integrationForm.apiKey} onChange={e => setIntegrationForm({...integrationForm, apiKey: e.target.value})}/></label>
              <label className="field"><span className="label">Notes</span><input className="input" value={integrationForm.notes} onChange={e => setIntegrationForm({...integrationForm, notes: e.target.value})}/></label>
            </>}
            {integrationModal.mode === 'edit' && integrationForm.name === 'Stripe' && <>
              <label className="field"><span className="label">Secret Key</span><input className="input" type="password" value={integrationForm.secretKey} onChange={e => setIntegrationForm({...integrationForm, secretKey: e.target.value})} placeholder="sk_live_… or sk_test_…"/></label>
              <label className="field"><span className="label">Publishable Key</span><input className="input" value={integrationForm.publishableKey} onChange={e => setIntegrationForm({...integrationForm, publishableKey: e.target.value})} placeholder="pk_live_…"/></label>
              <label className="field"><span className="label">Webhook Secret</span><input className="input" type="password" value={integrationForm.webhookSecret} onChange={e => setIntegrationForm({...integrationForm, webhookSecret: e.target.value})} placeholder="whsec_…"/></label>
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
              <label className="field"><span className="label">API Key</span><input className="input" type="password" value={integrationForm.apiKey} onChange={e => setIntegrationForm({...integrationForm, apiKey: e.target.value})}/></label>
              <label className="field"><span className="label">Notes</span><input className="input" value={integrationForm.notes} onChange={e => setIntegrationForm({...integrationForm, notes: e.target.value})}/></label>
            </>}
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:16}}>
              <div className="row-flex" style={{gap:8}}>
                <button type="button" className="btn btn-rust btn-sm" onClick={saveIntegrationModal}>{integrationModal.mode === 'add' ? 'Add' : 'Save'}</button>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setIntegrationModal(null)}>Cancel</button>
              </div>
              {integrationModal.mode === 'edit' && (
                <div className="row-flex" style={{gap:8}}>
                  {integrations[integrationModal.idx]?.[2] && <button type="button" className="btn btn-ghost btn-sm" style={{color:'var(--ink-3)'}} onClick={disconnectIntegration}>Disconnect</button>}
                  <button type="button" className="btn btn-ghost btn-sm" style={{color:'var(--rust)'}} onClick={removeIntegration}>Remove</button>
                </div>
              )}
            </div>
          </div>
        </div>
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
      ? { name: '', price: '', billingCycle: 'month', description: '', features: '', color: '', highlight: false, status: 'draft' }
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
        <div className={`tab ${tab === 'tiers' ? 'active' : ''}`} onClick={() => setTab('tiers')}>
          Tiers ({tiers.length})
        </div>
        <div className={`tab ${tab === 'subs' ? 'active' : ''}`} onClick={() => setTab('subs')}>
          Subscriptions ({subs.length})
        </div>
        {pendingOrders.length > 0 && (
          <div className={`tab ${tab === 'pending' ? 'active' : ''}`} onClick={() => setTab('pending')}>
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
                  { key: 'price', label: 'Price', w: '100px', render: r => <span className="mono" style={{ fontWeight: 600 }}>${r.price || r.priceAud || 0}<span style={{ fontWeight: 400, fontSize: 11, color: 'var(--ink-2)' }}>/{r.billingCycle || 'mo'}</span></span> },
                  { key: 'features', label: 'Features', w: '2fr', render: r => <span style={{ fontSize: 12, color: 'var(--ink-2)' }}>{(Array.isArray(r.features) ? r.features : []).slice(0, 3).join(' · ')}</span> },
                  { key: 'status', label: 'Status', w: '120px', render: r => (
                    <span className="tag" style={{
                      background: r.status === 'published' ? '#d8e7d0' : 'var(--bg-deep)',
                      color: r.status === 'published' ? '#345526' : 'var(--ink-2)',
                      borderColor: 'transparent',
                    }}>{(r.status || 'draft').toUpperCase()}</span>
                  )},
                  { key: 'highlight', label: 'Featured', w: '90px', render: r => r.highlight ? <span className="tag tag-rust" style={{ fontSize: 10 }}>YES</span> : <span style={{ color: 'var(--ink-3)', fontSize: 12 }}>—</span> },
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
                  { key: 'orderId', label: 'Order', w: '130px', render: r => <span className="mono" style={{ fontSize: 11, color: 'var(--rust)' }}>{r.orderId || '—'}</span> },
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
                  {activating === o.id ? 'Activating…' : 'Activate →'}
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
                <button className="btn btn-rust btn-sm" disabled={saving} onClick={() => saveTier('published')}>Publish →</button>
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
              <select className="select" value={form.billingCycle || 'month'} onChange={e => setForm({ ...form, billingCycle: e.target.value })} style={{ width: 110 }}>
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
// ADMIN PAGE — top-level
// ============================================================
const METRIC_SUBTITLE_FALLBACK = {
  loading: 'Loading metrics…',
  error: 'Metrics unavailable',
};

function formatMetricSubtitle(section, metrics, fallbackState = 'loading') {
  if (!metrics || !metrics.subtitles) return METRIC_SUBTITLE_FALLBACK[fallbackState] || METRIC_SUBTITLE_FALLBACK.loading;
  return metrics.subtitles[section] || null;
}

const ADMIN_VIEWS = {
  overview:   { c: AdminOverview,   t:'Overview',         staticSubtitle:'shop heartbeat · today' },
  orders:     { c: AdminOrders,     t:'Orders' },
  repairs:    { c: AdminRepairs,    t:'Repair Jobs' },
  quotes:     { c: AdminQuotes,     t:'Quotes Inbox' },
  ewaste:     { c: AdminEwaste,     t:'eWaste Intake' },
  products:   { c: AdminProducts,   t:'Products' },
  services:   { c: AdminServices,   t:'Services' },
  software:   { c: AdminSoftware,   t:'Software' },
  tutorials:  { c: AdminTutorials,  t:'Tutorials' },
  ai:         { c: AdminAI,         t:'AI Models & Boxes' },
  forum:      { c: AdminForum,      t:'Forum',            staticSubtitle:'Forum moderation' },
  groups:     { c: AdminGroups,     t:'Groups' },
  customers:  { c: AdminCustomers,  t:'Customers' },
  sellers:    { c: AdminSellers,    t:'Sellers' },
  memberships: { c: AdminMemberships, t:'Memberships', staticSubtitle:'tiers · subscriptions · activation' },
  'gift-cards': { c: AdminGiftCards, t:'Gift Cards',        staticSubtitle:'issued codes · balances · manual issuance' },
  expenses:   { c: AdminExpenses,   t:'Expenses',         staticSubtitle:'track costs · receipt uploads' },
  policies:   { c: AdminPolicies,   t:'Policies',         staticSubtitle:'edit public-facing policy docs' },
  settings:   { c: AdminSettings,   t:'Settings',         staticSubtitle:'shop · staff · integrations' },
};

const ADMIN_ALL_IDS = new Set([
  'overview','orders','repairs','quotes','ewaste',
  'products','services','software','tutorials','ai',
  'forum','groups','customers','sellers',
  'memberships','gift-cards','expenses','policies','settings',
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

  const fetchSession = (mounted = true) =>
    fetch('/api/admin/session', { credentials: 'include' })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(d => { if (mounted) setSessionInfo({ authed: !!d.authenticated, role: d.role || null, username: d.username || null, staffId: d.staffId || null }); })
      .catch(() => { if (mounted) setSessionInfo({ authed: false, role: null, username: null }); });

  useEffect(() => {
    let mounted = true;
    fetchSession(mounted).finally(() => { if (mounted) setChecking(false); });
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
  if (!sessionInfo.authed) return <AdminLogin onAuth={() => { setChecking(true); fetchSession(true).finally(() => setChecking(false)); }} />;

  const view = ADMIN_VIEWS[effectiveSection] || ADMIN_VIEWS.overview;
  const subtitle = view.staticSubtitle || formatMetricSubtitle(effectiveSection, metrics, metricsState);
  const Body = view.c;
  return (
    <div style={{display:'flex', minHeight:'100vh', background:'var(--bg)'}}>
      <AdminSidebar section={effectiveSection} setSection={s => { setSection(s); setSearch(''); }} role={sessionInfo.role} username={sessionInfo.username}
        onSignOut={async () => { await fetch('/api/admin/logout', { method:'POST', headers:postHeaders(), credentials:'include' }); setSessionInfo({ authed: false, role: null, username: null }); }} />
      <div style={{flex:1, minWidth:0}}>
        <AdminTopbar title={view.t} subtitle={subtitle} search={search} onSearch={setSearch}
          actions={
            <div className="row-flex" style={{gap:8}}>
              <a className="btn btn-ghost btn-sm" href="#home" target="_blank" rel="noreferrer" style={{textDecoration:'none'}} title="Open public site in a new tab">View public site ↗</a>
            </div>
          }
        />
        <Body sessionInfo={sessionInfo} search={search} />
      </div>
    </div>
  );
}

export default AdminPage;
