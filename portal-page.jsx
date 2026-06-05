import React, { useState, useEffect, useRef } from 'react';

// ── Helpers ──────────────────────────────────────────────────────────────────

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

function api(path, opts = {}) {
  const isPost = opts.method && opts.method.toUpperCase() !== 'GET';
  const csrfHeader = isPost ? { 'X-CSRF-Token': getCsrf() } : {};
  return fetch(path, { headers: { 'Content-Type': 'application/json', ...csrfHeader }, credentials: 'include', ...opts })
    .then(async r => {
      const body = await r.json().catch(() => ({}));
      return { ok: r.ok, status: r.status, ...body };
    });
}

function fmtDate(iso) {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }); }
  catch { return iso; }
}

function StatusTag({ status }) {
  const cls =
    /paid|complete|delivered|approved|solved/i.test(status || '') ? 'tag tag-green' :
    /pending|new|open|awaiting/i.test(status || '') ? 'tag tag-ochre' :
    /in.progress|active|processing/i.test(status || '') ? 'tag tag-blue' :
    'tag';
  return <span className={cls}>{status || 'unknown'}</span>;
}

// ── Login ─────────────────────────────────────────────────────────────────────

function LoginPage({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const initialTab = new URLSearchParams(window.location.search).get('tab');
  const [showRegister, setShowRegister] = useState(initialTab === 'register');
  const [showForgot, setShowForgot] = useState(false);

  async function handleLogin(e) {
    e.preventDefault();
    setError(''); setBusy(true);
    const r = await api('/api/portal/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) });
    setBusy(false);
    if (r.ok) { onLogin(r.user); }
    else { setError(r.message || 'Invalid username or password.'); }
  }

  return (
    <div className="login-wrap">
      <div className="login-box">
        <div className="login-logo">
          <div className="login-logo-mark">
            <img src="assets/logo.webp" alt="Outback Electronics" />
          </div>
          <div>
            <div style={{fontWeight:700, fontSize:15, color:'var(--ink)'}}>Outback Electronics</div>
            <div className="eyebrow" style={{marginTop:3}}>Customer Portal</div>
          </div>
        </div>

        {showRegister
          ? <RegisterForm onLogin={onLogin} onBack={() => setShowRegister(false)} />
          : showForgot
          ? <ForgotPasswordForm onBack={() => setShowForgot(false)} />
          : <>
              <h2 style={{fontFamily:'Instrument Serif, serif', fontWeight:400, fontSize:28, marginBottom:20}}>Sign in</h2>
              {error && <div className="alert alert-error">{error}</div>}
              <form onSubmit={handleLogin}>
                <label className="field">
                  <span className="label">Username</span>
                  <input className="input" type="text" value={username} autoComplete="username"
                    onChange={e => setUsername(e.target.value)} required />
                </label>
                <label className="field">
                  <span className="label">Password</span>
                  <input className="input" type="password" value={password} autoComplete="current-password"
                    onChange={e => setPassword(e.target.value)} required />
                </label>
                <button className="btn btn-rust" type="submit" disabled={busy} style={{width:'100%', justifyContent:'center', marginTop:4}}>
                  {busy ? 'Signing in…' : 'Sign in →'}
                </button>
              </form>
              <div style={{marginTop:12, textAlign:'center', fontSize:13}}>
                <button onClick={() => setShowForgot(true)} style={{background:'none', border:'none', color:'var(--ink-2)', cursor:'pointer', fontSize:13, fontFamily:'inherit', padding:0}}>
                  Forgot password?
                </button>
              </div>
              <div style={{marginTop:20, textAlign:'center', fontSize:13, color:'var(--ink-2)'}}>
                No account?{' '}
                <button onClick={() => setShowRegister(true)}
                  style={{background:'none', border:'none', color:'var(--rust)', cursor:'pointer', fontWeight:600, fontSize:13, fontFamily:'inherit', padding:0}}>
                  Register
                </button>
              </div>
              <div style={{marginTop:12, textAlign:'center', fontSize:12, color:'var(--ink-3)'}}>
                <a href="https://outbackelectronics.com.au">← Back to main site</a>
              </div>
            </>
        }
      </div>
    </div>
  );
}

function RegisterForm({ onLogin, onBack }) {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleRegister(e) {
    e.preventDefault();
    setError(''); setBusy(true);
    const r = await api('/api/portal/auth/register', { method: 'POST', body: JSON.stringify({ firstName, lastName, email, phone, address, username, password }) });
    setBusy(false);
    if (r.ok) { onLogin(r.user); }
    else { setError(r.message || 'Registration failed.'); }
  }

  return (
    <>
      <h2 style={{fontFamily:'Instrument Serif, serif', fontWeight:400, fontSize:28, marginBottom:20}}>Create account</h2>
      {error && <div className="alert alert-error">{error}</div>}
      <form onSubmit={handleRegister}>
        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:12}}>
          <label className="field">
            <span className="label">First name</span>
            <input className="input" type="text" value={firstName} autoComplete="given-name" onChange={e => setFirstName(e.target.value)} required />
          </label>
          <label className="field">
            <span className="label">Last name</span>
            <input className="input" type="text" value={lastName} autoComplete="family-name" onChange={e => setLastName(e.target.value)} required />
          </label>
        </div>
        <label className="field">
          <span className="label">Email address</span>
          <input className="input" type="email" value={email} autoComplete="email" onChange={e => setEmail(e.target.value)} required />
        </label>
        <label className="field">
          <span className="label">Phone number</span>
          <input className="input" type="tel" value={phone} autoComplete="tel" onChange={e => setPhone(e.target.value)} />
        </label>
        <label className="field">
          <span className="label">Address</span>
          <input className="input" type="text" value={address} autoComplete="street-address" onChange={e => setAddress(e.target.value)} />
        </label>
        <label className="field">
          <span className="label">Username</span>
          <input className="input" type="text" value={username} autoComplete="username" onChange={e => setUsername(e.target.value)} required />
          <span style={{fontSize:11, color:'var(--ink-3)', marginTop:3, display:'block'}}>3–30 characters, letters, numbers and underscores</span>
        </label>
        <label className="field">
          <span className="label">Password</span>
          <input className="input" type="password" value={password} autoComplete="new-password" onChange={e => setPassword(e.target.value)} required />
          <span style={{fontSize:11, color:'var(--ink-3)', marginTop:3, display:'block'}}>Minimum 8 characters</span>
        </label>
        <button className="btn btn-rust" type="submit" disabled={busy} style={{width:'100%', justifyContent:'center', marginTop:4}}>
          {busy ? 'Creating account…' : 'Create account →'}
        </button>
      </form>
      <div style={{marginTop:16, textAlign:'center', fontSize:13}}>
        <button onClick={onBack} style={{background:'none', border:'none', color:'var(--rust)', cursor:'pointer', fontWeight:600, fontSize:13, fontFamily:'inherit', padding:0}}>
          ← Back to sign in
        </button>
      </div>
    </>
  );
}

function ForgotPasswordForm({ onBack }) {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setMsg(null); setBusy(true);
    await api('/api/portal/auth/forgot-password', { method: 'POST', body: JSON.stringify({ username, email }) });
    setBusy(false);
    setMsg('If that username and email match an account, you\'ll receive a reset link shortly.');
  }

  return (
    <>
      <h2 style={{fontFamily:'Instrument Serif, serif', fontWeight:400, fontSize:28, marginBottom:20}}>Reset password</h2>
      {msg
        ? <div className="alert alert-success">{msg}</div>
        : <>
            <p style={{color:'var(--ink-2)', fontSize:13, marginBottom:20}}>Enter your username and the email address on your account. We'll send you a link to reset your password.</p>
            <form onSubmit={handleSubmit}>
              <label className="field">
                <span className="label">Username</span>
                <input className="input" type="text" value={username} onChange={e => setUsername(e.target.value)} required />
              </label>
              <label className="field">
                <span className="label">Email address</span>
                <input className="input" type="email" value={email} onChange={e => setEmail(e.target.value)} required />
              </label>
              <button className="btn btn-rust" type="submit" disabled={busy} style={{width:'100%', justifyContent:'center', marginTop:4}}>
                {busy ? 'Sending…' : 'Send reset link →'}
              </button>
            </form>
          </>
      }
      <div style={{marginTop:16, textAlign:'center', fontSize:13}}>
        <button onClick={onBack} style={{background:'none', border:'none', color:'var(--rust)', cursor:'pointer', fontWeight:600, fontSize:13, fontFamily:'inherit', padding:0}}>
          ← Back to sign in
        </button>
      </div>
    </>
  );
}

function ResetPasswordForm({ token, onDone }) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [msg, setMsg] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (password !== confirm) { setError('Passwords do not match.'); return; }
    setError(''); setBusy(true);
    const r = await api('/api/portal/auth/reset-password', { method: 'POST', body: JSON.stringify({ token, password }) });
    setBusy(false);
    if (r.ok) { setMsg('Your password has been reset. You can now sign in.'); }
    else { setError(r.message || 'This reset link is invalid or has expired.'); }
  }

  if (msg) return (
    <div className="login-wrap">
      <div className="login-box">
        <div className="login-logo"><div className="login-logo-mark"><img src="assets/logo.webp" alt="Outback Electronics" /></div><div><div style={{fontWeight:700, fontSize:15, color:'var(--ink)'}}>Outback Electronics</div><div className="eyebrow" style={{marginTop:3}}>Customer Portal</div></div></div>
        <div className="alert alert-success" style={{marginBottom:16}}>{msg}</div>
        <button className="btn btn-rust" onClick={onDone} style={{width:'100%', justifyContent:'center'}}>Sign in →</button>
      </div>
    </div>
  );

  return (
    <div className="login-wrap">
      <div className="login-box">
        <div className="login-logo"><div className="login-logo-mark"><img src="assets/logo.webp" alt="Outback Electronics" /></div><div><div style={{fontWeight:700, fontSize:15, color:'var(--ink)'}}>Outback Electronics</div><div className="eyebrow" style={{marginTop:3}}>Customer Portal</div></div></div>
        <h2 style={{fontFamily:'Instrument Serif, serif', fontWeight:400, fontSize:28, marginBottom:20}}>Choose new password</h2>
        {error && <div className="alert alert-error">{error}</div>}
        <form onSubmit={handleSubmit}>
          <label className="field">
            <span className="label">New password</span>
            <input className="input" type="password" value={password} onChange={e => setPassword(e.target.value)} required autoComplete="new-password" />
          </label>
          <label className="field">
            <span className="label">Confirm password</span>
            <input className="input" type="password" value={confirm} onChange={e => setConfirm(e.target.value)} required autoComplete="new-password" />
          </label>
          <button className="btn btn-rust" type="submit" disabled={busy} style={{width:'100%', justifyContent:'center', marginTop:4}}>
            {busy ? 'Saving…' : 'Set new password →'}
          </button>
        </form>
      </div>
    </div>
  );
}

// ── Top nav ───────────────────────────────────────────────────────────────────

function PortalNav({ user, tab, setTab, onLogout }) {
  const tabs = [
    { id: 'overview',    label: 'Overview' },
    { id: 'orders',      label: 'Orders' },
    { id: 'repairs',     label: 'Repairs' },
    { id: 'quotes',      label: 'Quotes' },
    { id: 'memberships', label: 'Membership' },
    { id: 'rewards',     label: 'Rewards' },
    { id: 'wallet',      label: 'Wallet' },
    { id: 'addresses',   label: 'Addresses' },
    { id: 'bookings',    label: 'Bookings' },
    { id: 'account',     label: 'Account' },
  ];

  async function handleLogout() {
    await api('/api/portal/auth/logout', { method: 'POST' });
    onLogout();
  }

  return (
    <>
      <div className="topnav">
        <div className="container row">
          <a href="https://outbackelectronics.com.au" className="logo">
            <div className="logo-mark">
              <img src="assets/logo.webp" alt="Outback Electronics" />
            </div>
            <div className="logo-text">
              <div className="name">Outback Electronics</div>
              <div className="sub">Customer Portal</div>
            </div>
          </a>
          <div className="nav-user">
            <span className="portal-badge">Portal</span>
            <span style={{color:'var(--ink-3)'}}>Signed in as <strong style={{color:'var(--bg-deep)'}}>{user.displayName || user.username}</strong></span>
            <button className="btn btn-ghost btn-sm" onClick={handleLogout}
              style={{color:'var(--bg-deep)', borderColor:'#3a3127'}}>
              Sign out
            </button>
          </div>
        </div>
      </div>
      <div className="tabs-bar">
        <div className="container">
          <div className="tabs-row">
            {tabs.map(t => (
              <button key={t.id} className={'tab-btn' + (tab === t.id ? ' active' : '')} onClick={() => setTab(t.id)}>
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

// ── Overview ──────────────────────────────────────────────────────────────────

function OverviewTab({ user, setTab }) {
  const [data, setData] = useState(null);

  useEffect(() => {
    Promise.all([
      api('/api/portal/orders'),
      api('/api/portal/repairs'),
      api('/api/portal/quotes'),
    ]).then(([o, r, q]) => setData({
      orders: o.items || [],
      repairs: r.items || [],
      quotes: q.items || [],
    }));
  }, []);

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  };

  return (
    <div className="page-section">
      <div className="container">
        <div className="section-head">
          <h2>{greeting()}, {data ? (user.displayName || user.username) : '…'}</h2>
          <p>Welcome to your Outback Electronics customer portal.</p>
        </div>

        <div className="grid-3" style={{marginBottom:36}}>
          <div className="stat-card" style={{cursor:'pointer'}} onClick={() => setTab('orders')}>
            <span className="eyebrow">Orders</span>
            <div className="num">{data ? data.orders.length : '—'}</div>
            <div className="desc">recorded orders</div>
          </div>
          <div className="stat-card" style={{cursor:'pointer'}} onClick={() => setTab('repairs')}>
            <span className="eyebrow">Repairs</span>
            <div className="num">{data ? data.repairs.length : '—'}</div>
            <div className="desc">repair jobs</div>
          </div>
          <div className="stat-card" style={{cursor:'pointer'}} onClick={() => setTab('quotes')}>
            <span className="eyebrow">Quotes</span>
            <div className="num">{data ? data.quotes.length : '—'}</div>
            <div className="desc">quote requests</div>
          </div>
        </div>

        <div className="grid-2">
          <div className="card-paper" style={{padding:24}}>
            <span className="eyebrow">Shop</span>
            <h3 className="serif" style={{fontSize:26, marginTop:8}}>Browse our catalogue</h3>
            <p style={{marginTop:8, color:'var(--ink-2)', fontSize:14}}>Rugged laptops, radios, solar gear and more — built for where the signal ends.</p>
            <a href="https://outbackelectronics.com.au/shop" className="btn btn-rust" style={{marginTop:16, display:'inline-flex'}}>Go to Shop →</a>
          </div>
          <div className="card-paper" style={{padding:24}}>
            <span className="eyebrow">Support</span>
            <h3 className="serif" style={{fontSize:26, marginTop:8}}>Need help?</h3>
            <p style={{marginTop:8, color:'var(--ink-2)', fontSize:14}}>Our team can help with orders, repairs, returns and anything else. Phone or email.</p>
            <a href="https://outbackelectronics.com.au/contact" className="btn btn-ghost" style={{marginTop:16, display:'inline-flex'}}>Contact us →</a>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Orders ────────────────────────────────────────────────────────────────────

const UPDATE_TYPE_LABEL = {
  note: 'Note',
  parts_ordered: 'Parts ordered',
  parts_arrived: 'Parts arrived',
  build_started: 'Build started',
  ready_for_pickup: 'Ready for pickup',
  dispatched: 'Dispatched',
};
const UPDATE_TYPE_COLOR = {
  note: 'var(--ink-2)',
  parts_ordered: '#1668c8',
  parts_arrived: '#345526',
  build_started: '#7a5d10',
  ready_for_pickup: '#345526',
  dispatched: 'var(--ink)',
};

function OrderDetail({ o, onPay, paying }) {
  const dq = o.draftQuote || {};
  const lineItems = [
    ...(dq.hardwareItems || []).filter(i => i.name).map(i => {
      const qty = parseInt(i.qty) || 1;
      return { label: i.name + (qty > 1 ? ` × ${qty}` : ''), amount: (parseFloat(i.basePrice) || 0) * qty * 1.02 };
    }),
    ...(dq.pcBuild && dq.pcBuildFee > 0 ? [{ label: 'Custom PC Build', amount: dq.pcBuildFee }] : []),
    ...(dq.otherItems || []).filter(i => i.description).map(i => ({ label: i.description, amount: parseFloat(i.amount) || 0 })),
  ];
  const paid = (o.payments || []).reduce((s, p) => s + (Number(p.amount) || 0), 0);
  const outstanding = o.total != null ? Math.max(0, Number(o.total) - paid) : null;
  const needsPayment = outstanding != null && outstanding > 0;
  const trackingUrl = o.trackingNumber ? `https://auspost.com.au/mypost/track/#/details/${encodeURIComponent(o.trackingNumber)}` : null;

  const FULFILMENT_STEPS = [
    { key:'pending',  label:'Order placed' },
    { key:'ordering', label:'Ordering parts' },
    { key:'building', label:'Building' },
    { key:'testing',  label:'Testing' },
    { key:'packed',   label:'Packed' },
    { key:'shipped',  label:'Shipped' },
    { key:'fulfilled',label:'Delivered' },
  ];
  const currentStep = Math.max(0, FULFILMENT_STEPS.findIndex(s => s.key === (o.fulfilment || 'pending')));

  return (
    <div style={{marginTop:16, borderTop:'1px solid var(--line)', paddingTop:16, display:'grid', gap:20}}>

      {/* Progress bar */}
      {o.fulfilment !== 'refunded' && (
        <div>
          <div className="mono" style={{fontSize:10, color:'var(--ink-3)', marginBottom:12, letterSpacing:'.08em'}}>FULFILMENT PROGRESS</div>
          <div style={{display:'flex', gap:0, overflowX:'auto', paddingBottom:4}}>
            {FULFILMENT_STEPS.map(({ label }, i) => {
              const done = i <= currentStep;
              const active = i === currentStep;
              return (
                <div key={i} style={{flex:'1 0 auto', textAlign:'center', minWidth:60}}>
                  <div style={{display:'flex', alignItems:'center'}}>
                    <div style={{flex: i === 0 ? '0 0 0' : 1, height:2, background: i <= currentStep ? 'var(--rust)' : 'var(--line)'}} />
                    <div style={{width:12, height:12, borderRadius:'50%', flexShrink:0, background: done ? 'var(--rust)' : 'var(--line)', outline: active ? '3px solid var(--rust)' : 'none', outlineOffset:2}} />
                    <div style={{flex: i === FULFILMENT_STEPS.length - 1 ? '0 0 0' : 1, height:2, background: i < currentStep ? 'var(--rust)' : 'var(--line)'}} />
                  </div>
                  <div style={{fontSize:10, marginTop:5, color: done ? 'var(--ink)' : 'var(--ink-3)', fontWeight: active ? 700 : 400, whiteSpace:'nowrap'}}>{label}</div>
                </div>
              );
            })}
          </div>
          {trackingUrl && (
            <div style={{marginTop:12, textAlign:'center'}}>
              <a href={trackingUrl} target="_blank" rel="noreferrer" style={{fontSize:13, color:'var(--rust)', fontWeight:600}}>
                Track with Australia Post ↗
              </a>
            </div>
          )}
        </div>
      )}

      {/* Parts tracking */}
      {(o.parts || []).length > 0 && (
        <div>
          <div className="mono" style={{fontSize:10, color:'var(--ink-3)', marginBottom:8, letterSpacing:'.08em'}}>PARTS STATUS</div>
          <div style={{border:'1px solid var(--line)'}}>
            {(o.parts || []).map((part, i) => {
              const PART_STEP = { pending:0, ordered:1, delivered:2, installed:3 };
              const step = PART_STEP[part.status] ?? 0;
              const dotColor = ['var(--ink-3)','#1668c8','#7a5d10','#345526'][step];
              const statusLabel = ['Pending','Ordered','Delivered','Installed'][step];
              return (
                <div key={part.id || i} style={{display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 14px', borderBottom: i < o.parts.length - 1 ? '1px solid var(--line)' : 'none', gap:12, flexWrap:'wrap'}}>
                  <div style={{flex:1, minWidth:0}}>
                    <span style={{fontSize:14}}>{part.name}</span>
                    {part.qty > 1 && <span style={{fontSize:12, color:'var(--ink-3)', marginLeft:6}}>× {part.qty}</span>}
                    <div className="mono" style={{fontSize:10, color:'var(--ink-3)', marginTop:2}}>
                      {part.orderedAt && `Ordered ${part.orderedAt}`}
                      {part.deliveredAt && ` · Delivered ${part.deliveredAt}`}
                      {part.installedAt && ` · Installed ${part.installedAt}`}
                    </div>
                  </div>
                  <div style={{display:'flex', alignItems:'center', gap:6, flexShrink:0}}>
                    <div style={{width:8, height:8, borderRadius:'50%', background:dotColor}} />
                    <span style={{fontSize:12, fontWeight:600, color:dotColor}}>{statusLabel}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Line items */}
      {lineItems.length > 0 && (
        <div>
          <div className="mono" style={{fontSize:10, color:'var(--ink-3)', marginBottom:8, letterSpacing:'.08em'}}>ORDER ITEMS</div>
          <div style={{border:'1px solid var(--line)'}}>
            {lineItems.map((item, i) => (
              <div key={i} style={{display:'flex', justifyContent:'space-between', padding:'9px 14px', borderBottom: i < lineItems.length - 1 ? '1px solid var(--line)' : 'none', fontSize:14}}>
                <span>{item.label}</span>
                <span className="mono" style={{fontWeight:600}}>${item.amount.toLocaleString('en-AU',{minimumFractionDigits:2})}</span>
              </div>
            ))}
            <div style={{display:'flex', justifyContent:'space-between', padding:'10px 14px', background:'var(--ink)', color:'var(--paper)'}}>
              <span style={{fontWeight:600, fontSize:13}}>Total (AUD)</span>
              <span className="mono" style={{fontWeight:700, color:'var(--ochre)'}}>
                ${Number(o.total||0).toLocaleString('en-AU',{minimumFractionDigits:2})}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Payment history */}
      <div>
        <div className="mono" style={{fontSize:10, color:'var(--ink-3)', marginBottom:8, letterSpacing:'.08em'}}>PAYMENTS</div>
        {(o.payments || []).length === 0 ? (
          <p style={{fontSize:13, color:'var(--ink-2)'}}>No payments recorded yet.</p>
        ) : (
          <div style={{border:'1px solid var(--line)'}}>
            {(o.payments || []).map((p, i) => (
              <div key={i} style={{display:'flex', justifyContent:'space-between', alignItems:'center', padding:'9px 14px', borderBottom: i < o.payments.length - 1 ? '1px solid var(--line)' : 'none', fontSize:13}}>
                <div>
                  <span style={{fontWeight:600}}>${Number(p.amount).toLocaleString('en-AU',{minimumFractionDigits:2})} AUD</span>
                  <span style={{color:'var(--ink-2)', marginLeft:10}}>{p.method}</span>
                  {p.note && !/^Session /i.test(p.note) && <span style={{color:'var(--ink-3)', marginLeft:8}}>— {p.note}</span>}
                </div>
                <span className="mono" style={{fontSize:11, color:'var(--ink-3)'}}>{p.date}</span>
              </div>
            ))}
          </div>
        )}
        {needsPayment && (
          <div style={{marginTop:12, display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:10}}>
            <span style={{fontSize:13, color:'var(--ink-2)'}}>Outstanding: <strong style={{color:'var(--ink)'}}>${outstanding.toFixed(2)} AUD</strong></span>
            <button className="btn btn-rust btn-sm" onClick={() => onPay(o.id)} disabled={paying === o.id}>
              {paying === o.id ? 'Redirecting…' : 'Pay Now →'}
            </button>
          </div>
        )}
      </div>

      {/* Admin updates timeline */}
      {(o.updates || []).length > 0 && (
        <div>
          <div className="mono" style={{fontSize:10, color:'var(--ink-3)', marginBottom:10, letterSpacing:'.08em'}}>ORDER UPDATES</div>
          <div style={{display:'grid', gap:0, borderLeft:'2px solid var(--line)', paddingLeft:16}}>
            {[...(o.updates || [])].reverse().map((u, i) => (
              <div key={i} style={{paddingBottom:14, position:'relative'}}>
                <div style={{position:'absolute', left:-21, top:4, width:8, height:8, borderRadius:'50%', background: UPDATE_TYPE_COLOR[u.type] || 'var(--ink-2)', border:'2px solid var(--paper)'}} />
                <div style={{fontSize:11, fontWeight:600, color: UPDATE_TYPE_COLOR[u.type] || 'var(--ink-2)', marginBottom:2, textTransform:'uppercase', letterSpacing:'.06em'}}>
                  {UPDATE_TYPE_LABEL[u.type] || u.type}
                </div>
                <div style={{fontSize:14, color:'var(--ink)'}}>{u.text}</div>
                <div className="mono" style={{fontSize:11, color:'var(--ink-3)', marginTop:3}}>{u.date}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {dq.notes && (
        <div>
          <div className="mono" style={{fontSize:10, color:'var(--ink-3)', marginBottom:6, letterSpacing:'.08em'}}>NOTES FROM US</div>
          <p style={{fontSize:13, color:'var(--ink-2)'}}>{dq.notes}</p>
        </div>
      )}
    </div>
  );
}

function OrdersTab({ highlightId }) {
  const [items, setItems] = useState(null);
  const [expanded, setExpanded] = useState(null);
  const [paying, setPaying] = useState(null);
  const [payErr, setPayErr] = useState('');
  const paidOrderId = new URLSearchParams(window.location.search).get('paid');

  useEffect(() => {
    api('/api/portal/orders').then(r => {
      const orders = r.items || [];
      setItems(orders);
      if (paidOrderId) {
        setExpanded(paidOrderId);
        window.history.replaceState({}, '', '/orders');
      } else if (highlightId) {
        setExpanded(highlightId);
      }
    });
  }, []);

  async function handlePay(orderId) {
    setPaying(orderId); setPayErr('');
    const r = await api('/api/portal/orders/pay', { method: 'POST', body: JSON.stringify({ orderId }) });
    setPaying(null);
    if (r.ok && r.url) { window.location.href = r.url; }
    else setPayErr(r.message || 'Could not start payment. Please try again or contact us.');
  }

  if (!items) return <LoadingSection />;

  const FULFILMENT_LABEL = { pending:'Pending', ordering:'Ordering parts', building:'Building', testing:'Testing', packed:'Packed', shipped:'Shipped', fulfilled:'Delivered', refunded:'Refunded' };

  return (
    <div className="page-section">
      <div className="container">
        <div className="section-head">
          <h2>Orders</h2>
          <p>Your order history with Outback Electronics.</p>
        </div>
        {paidOrderId && <div className="alert alert-success" style={{marginBottom:20}}>Payment received — thank you! Your order is being processed.</div>}
        {payErr && <div className="alert alert-error" style={{marginBottom:20}}>{payErr}</div>}
        {items.length === 0
          ? <EmptyState icon="cart" message="No orders found for your account." />
          : items.map(o => {
            const paid = (o.payments || []).reduce((s, p) => s + (Number(p.amount) || 0), 0);
            const outstanding = o.total != null ? Math.max(0, Number(o.total) - paid) : null;
            const needsPayment = outstanding != null && outstanding > 0;
            const isExpanded = expanded === o.id;
            const isNew = o.id === highlightId || o.id === paidOrderId;
            const hasUpdates = (o.updates || []).length > 0;
            return (
              <div key={o.id} className="card-paper" style={{padding:20, marginBottom:12, borderLeft: isNew ? '3px solid var(--eucalyptus)' : needsPayment ? '3px solid var(--rust)' : '3px solid transparent'}}>
                <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start', flexWrap:'wrap', gap:8, cursor:'pointer'}} onClick={() => setExpanded(isExpanded ? null : o.id)}>
                  <div style={{flex:1, minWidth:0}}>
                    <div style={{display:'flex', gap:10, alignItems:'center', flexWrap:'wrap'}}>
                      <span className="mono" style={{fontSize:12, color:'var(--ink-2)'}}>{o.id}</span>
                      {o.quoteRef && <span className="mono" style={{fontSize:11, color:'var(--ink-3)'}}>from {o.quoteRef}</span>}
                      {hasUpdates && <span style={{fontSize:11, background:'var(--rust)', color:'#fff', padding:'1px 6px', borderRadius:10}}>{o.updates.length} update{o.updates.length !== 1 ? 's' : ''}</span>}
                    </div>
                    <div style={{fontWeight:500, marginTop:4}}>{o.items || '—'}</div>
                    <div style={{fontSize:13, color:'var(--ink-2)', marginTop:2}}>{fmtDate(o.date || o.createdAt)}{o.total != null ? ` · $${Number(o.total).toLocaleString('en-AU',{minimumFractionDigits:2})} AUD` : ''}</div>
                  </div>
                  <div style={{display:'flex', alignItems:'center', gap:10}}>
                    <StatusTag status={o.fulfilment || o.status || 'pending'} label={FULFILMENT_LABEL[o.fulfilment] || o.fulfilment} />
                    <span style={{fontSize:16, color:'var(--ink-3)', userSelect:'none'}}>{isExpanded ? '▲' : '▼'}</span>
                  </div>
                </div>
                {isExpanded && <OrderDetail o={o} onPay={handlePay} paying={paying} />}
              </div>
            );
          })
        }
      </div>
    </div>
  );
}

// ── Repairs ───────────────────────────────────────────────────────────────────

function RepairsTab() {
  const [items, setItems] = useState(null);

  useEffect(() => {
    api('/api/portal/repairs').then(r => setItems(r.items || []));
  }, []);

  if (!items) return <LoadingSection />;

  return (
    <div className="page-section">
      <div className="container">
        <div className="section-head">
          <h2>Repairs</h2>
          <p>Status of your repair and service jobs.</p>
        </div>
        {items.length === 0
          ? <EmptyState icon="tool" message="No repair jobs found for your account." />
          : (
            <div className="card-paper" style={{overflow:'auto'}}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Job ID</th>
                    <th>Device / Description</th>
                    <th>Customer</th>
                    <th>Stage</th>
                    <th>Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map(card => (
                    <tr key={card.id}>
                      <td><span className="mono" style={{fontSize:12}}>{card.id}</span></td>
                      <td>{card.title || card.device || card.description || '—'}</td>
                      <td>{card.customer || card.name || '—'}</td>
                      <td><StatusTag status={card.column || card.stage || card.status} /></td>
                      <td>{fmtDate(card.updatedAt || card.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        }
      </div>
    </div>
  );
}

// ── Quotes ────────────────────────────────────────────────────────────────────

function QuotesTab({ user, onOrderCreated, highlightRef }) {
  const [items, setItems] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ name: user.displayName || user.username, email: '', description: '' });
  const [submitMsg, setSubmitMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [accepting, setAccepting] = useState(null);
  const [acceptedOrders, setAcceptedOrders] = useState({});

  useEffect(() => {
    api('/api/portal/quotes').then(r => setItems(r.items || []));
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setBusy(true); setSubmitMsg('');
    const r = await api('/api/portal/quotes/request', { method: 'POST', body: JSON.stringify(formData) });
    setBusy(false);
    if (r.ok) {
      setSubmitMsg('Quote request sent. We\'ll be in touch within 24 hours.');
      setShowForm(false);
      api('/api/portal/quotes').then(r2 => setItems(r2.items || []));
    } else {
      setSubmitMsg(r.message || 'Failed to submit. Please try again.');
    }
  }

  async function acceptQuote(quoteId) {
    setAccepting(quoteId);
    const r = await api('/api/portal/quotes/accept', { method: 'POST', body: JSON.stringify({ quoteId }) });
    setAccepting(null);
    if (r.ok) {
      setAcceptedOrders(prev => ({ ...prev, [quoteId]: r.orderId }));
      api('/api/portal/quotes').then(r2 => setItems(r2.items || []));
      if (onOrderCreated) onOrderCreated(r.orderId);
    } else {
      alert(r.message || 'Could not accept quote. Please try again or contact us.');
    }
  }

  if (!items) return <LoadingSection />;

  const actionable = items.filter(q => q.status === 'quoted');
  const history = items.filter(q => q.status !== 'quoted');

  return (
    <div className="page-section">
      <div className="container">
        <div className="section-head" style={{display:'flex', alignItems:'flex-start', justifyContent:'space-between', flexWrap:'wrap', gap:16}}>
          <div>
            <h2>Quotes</h2>
            <p>Your quote requests and their current status.</p>
          </div>
          <button className="btn btn-rust" onClick={() => setShowForm(s => !s)}>
            {showForm ? '↑ Cancel' : '+ Request a Quote'}
          </button>
        </div>

        {showForm && (
          <div className="card-paper" style={{padding:28, marginBottom:28}}>
            <h3 style={{marginBottom:20, fontSize:18}}>New Quote Request</h3>
            <form onSubmit={handleSubmit}>
              <div className="grid-2">
                <label className="field">
                  <span className="label">Your name</span>
                  <input className="input" value={formData.name} onChange={e => setFormData(f => ({...f, name: e.target.value}))} required />
                </label>
                <label className="field">
                  <span className="label">Email address</span>
                  <input className="input" type="email" value={formData.email} onChange={e => setFormData(f => ({...f, email: e.target.value}))} required />
                </label>
              </div>
              <label className="field">
                <span className="label">What do you need a quote for?</span>
                <textarea className="input textarea" rows={4} value={formData.description}
                  onChange={e => setFormData(f => ({...f, description: e.target.value}))}
                  placeholder="Describe the item, service, or repair you need priced up…" required />
              </label>
              <button className="btn btn-rust" type="submit" disabled={busy}>{busy ? 'Submitting…' : 'Submit Request →'}</button>
            </form>
          </div>
        )}

        {submitMsg && <div className={'alert ' + (submitMsg.includes('sent') ? 'alert-success' : 'alert-error')} style={{marginBottom:20}}>{submitMsg}</div>}

        {/* Quotes awaiting acceptance */}
        {actionable.map(q => {
          const dq = q.draftQuote || {};
          const accepted = acceptedOrders[q.id];
          const lineItems = [
            ...(dq.hardwareItems || []).filter(i => i.name).map(i => {
              const qty = parseInt(i.qty) || 1;
              return { label: i.name + (qty > 1 ? ` × ${qty}` : ''), amount: (parseFloat(i.basePrice) || 0) * qty * 1.02 };
            }),
            ...(dq.pcBuild && dq.pcBuildFee > 0 ? [{ label: 'Custom PC Build', amount: dq.pcBuildFee }] : []),
            ...(dq.otherItems || []).filter(i => i.description).map(i => ({ label: i.description, amount: parseFloat(i.amount) || 0 })),
          ];
          const validUntil = dq.validDays ? new Date(Date.now() + dq.validDays * 86400000).toLocaleDateString('en-AU', { day:'numeric', month:'long', year:'numeric' }) : null;
          const isHighlighted = highlightRef && (q.quoteRef === highlightRef || q.id === highlightRef);
          return (
            <div key={q.id} id={`quote-${q.quoteRef || q.id}`} className="card-paper" ref={isHighlighted ? el => el && el.scrollIntoView({ behavior: 'smooth', block: 'start' }) : null} style={{padding:28, marginBottom:20, borderLeft:`3px solid ${isHighlighted ? 'var(--rust)' : 'var(--ochre)'}`}}>
              <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start', flexWrap:'wrap', gap:12, marginBottom:16}}>
                <div>
                  <span className="eyebrow">Quote ready for acceptance</span>
                  <div style={{display:'flex', gap:12, alignItems:'center', marginTop:6}}>
                    <span className="mono" style={{fontSize:12, color:'var(--ink-2)'}}>{q.quoteRef || q.id}</span>
                    {validUntil && <span style={{fontSize:12, color:'var(--ink-3)'}}>Valid until {validUntil}</span>}
                  </div>
                </div>
                <StatusTag status={q.status} />
              </div>

              {lineItems.length > 0 && (
                <div style={{border:'1px solid var(--line)', marginBottom:16}}>
                  {lineItems.map((item, i) => (
                    <div key={i} style={{display:'flex', justifyContent:'space-between', padding:'10px 14px', borderBottom: i < lineItems.length - 1 ? '1px solid var(--line)' : 'none', fontSize:14}}>
                      <span>{item.label}</span>
                      <span className="mono" style={{fontWeight:600}}>${item.amount.toLocaleString('en-AU',{minimumFractionDigits:2})}</span>
                    </div>
                  ))}
                  <div style={{display:'flex', justifyContent:'space-between', padding:'12px 14px', background:'var(--ink)', color:'var(--paper)'}}>
                    <span style={{fontWeight:600}}>Total (AUD)</span>
                    <span className="mono" style={{fontWeight:700, fontSize:16, color:'var(--ochre)'}}>
                      ${Number(dq.grandTotal||0).toLocaleString('en-AU',{minimumFractionDigits:2})}
                    </span>
                  </div>
                </div>
              )}

              {q.reply && (
                <div style={{background:'var(--bg-elev)', border:'1px solid var(--line)', padding:'16px 20px', marginBottom:16, borderRadius:2}}>
                  <div className="eyebrow" style={{marginBottom:8, fontSize:10}}>MESSAGE FROM OUTBACK ELECTRONICS</div>
                  <p style={{fontSize:14, color:'var(--ink)', lineHeight:1.7, whiteSpace:'pre-wrap', margin:0}}>{q.reply}</p>
                </div>
              )}

              {dq.notes && <p style={{fontSize:13, color:'var(--ink-2)', marginBottom:16}}>{dq.notes}</p>}

              {accepted ? (
                <div className="alert alert-success">Order created — <strong>{accepted}</strong>. Check your Orders tab and your email for confirmation.</div>
              ) : (
                <div style={{display:'flex', gap:12, alignItems:'center'}}>
                  <button className="btn btn-rust" onClick={() => acceptQuote(q.id)} disabled={accepting === q.id}>
                    {accepting === q.id ? 'Accepting…' : 'Accept Quote →'}
                  </button>
                  <span style={{fontSize:13, color:'var(--ink-3)'}}>Or reply to your quote email to ask questions first.</span>
                </div>
              )}
            </div>
          );
        })}

        {/* Quote history */}
        {history.length === 0 && actionable.length === 0
          ? <EmptyState icon="file" message="No quote requests found for your account." />
          : history.length > 0 && (
            <div className="card-paper" style={{overflow:'auto'}}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Date</th>
                    <th>Description</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map(q => (
                    <tr key={q.id}>
                      <td><span className="mono" style={{fontSize:12}}>{q.quoteRef || q.id}</span></td>
                      <td>{fmtDate(q.date || q.createdAt)}</td>
                      <td style={{maxWidth:360}}>{q.summary || q.description || q.notes || '—'}</td>
                      <td><StatusTag status={q.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        }
      </div>
    </div>
  );
}

// ── Memberships ───────────────────────────────────────────────────────────────

function MembershipsTab() {
  const [data, setData] = useState(null);
  const [tiers, setTiers] = useState([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    Promise.all([
      api('/api/portal/membership'),
      fetch('/api/memberships').then(r => r.json()),
    ]).then(([m, t]) => {
      setData(m);
      setTiers(t.items || []);
    }).catch(() => {});
  }, []);

  async function subscribe(tierId) {
    setBusy(true); setMsg(null);
    // Request a Stripe checkout session from the server
    const r = await api('/api/portal/membership/checkout', { method: 'POST', body: JSON.stringify({ tierId }) });
    setBusy(false);
    if (r.ok && r.url) {
      window.location.href = r.url;
    } else if (r.ok && !r.url) {
      // Server acknowledged but returned no checkout URL — free/trial tier
      const r2 = await api('/api/portal/membership/subscribe', { method: 'POST', body: JSON.stringify({ tierId }) });
      if (r2.ok) { setData({ subscription: r2.subscription, tier: r2.tier }); setMsg({ ok: true, text: `Subscribed to ${r2.tier?.name || 'membership'}.` }); }
      else { setMsg({ ok: false, text: r2.message || 'Subscription failed.' }); }
    } else {
      setMsg({ ok: false, text: r.message || 'Could not start checkout. Please contact us to subscribe.' });
    }
  }

  async function cancel() {
    if (!window.confirm('Cancel your membership?')) return;
    setBusy(true); setMsg(null);
    const r = await api('/api/portal/membership/cancel', { method: 'POST' });
    setBusy(false);
    if (r.ok) { setData({ subscription: null, tier: null }); setMsg({ ok: true, text: 'Membership cancelled.' }); }
    else { setMsg({ ok: false, text: r.message || 'Failed to cancel.' }); }
  }

  const activeTier = data && data.tier;

  return (
    <div className="tab-content">
      <div className="section-block">
        <h2>Membership</h2>
        {msg && <div className={`notice ${msg.ok ? '' : 'notice-warn'}`} style={{marginBottom:16}}>{msg.text}</div>}

        {activeTier && (
          <div className="card-paper" style={{padding:24, marginBottom:24}}>
            <div className="eyebrow" style={{marginBottom:8}}>ACTIVE MEMBERSHIP</div>
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
              <div>
                <div style={{fontWeight:600, fontSize:18}}>{activeTier.name}</div>
                <div style={{color:'var(--ink-2)', fontSize:14, marginTop:4}}>${activeTier.price}/month</div>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={cancel} disabled={busy}>Cancel membership</button>
            </div>
            {activeTier.features && (
              <ul className="checks" style={{marginTop:16, fontSize:14}}>
                {activeTier.features.map((f,i) => <li key={i}>{f}</li>)}
              </ul>
            )}
          </div>
        )}

        {!activeTier && (
          <p style={{color:'var(--ink-2)', marginBottom:20}}>You don't have an active membership. Choose a tier below.</p>
        )}

        <div style={{display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:16}}>
          {tiers.map(tier => {
            const isActive = activeTier && activeTier.id === tier.id;
            return (
              <div key={tier.id}
                style={{padding:20, border:'1px solid var(--line)', background: isActive ? 'var(--bg-elev)' : 'transparent'}}>
                <span className={`tag ${tier.color}`} style={{marginBottom:10, display:'inline-block'}}>{tier.name.toUpperCase()}</span>
                <div style={{fontSize:28, fontFamily:'Instrument Serif, serif', marginBottom:4}}>${tier.price}<span style={{fontSize:13, fontFamily:'inherit', color:'var(--ink-2)'}}>/mo</span></div>
                <p style={{fontSize:13, color:'var(--ink-2)', marginBottom:14, lineHeight:1.6}}>{tier.description}</p>
                <ul className="checks" style={{fontSize:13, marginBottom:16}}>
                  {(tier.features || []).map((f,i) => <li key={i}>{f}</li>)}
                </ul>
                {isActive
                  ? <button className="btn btn-ghost btn-sm" disabled style={{width:'100%', justifyContent:'center'}}>Current plan</button>
                  : <button className="btn btn-rust btn-sm" style={{width:'100%', justifyContent:'center'}} onClick={() => subscribe(tier.id)} disabled={busy}>
                      {busy ? 'Redirecting…' : activeTier ? 'Switch to this →' : tier.price > 0 ? `Pay $${tier.price}/mo →` : 'Subscribe →'}
                    </button>
                }
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Rewards ───────────────────────────────────────────────────────────────────

function RewardsTab() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api('/api/portal/rewards')
      .then(d => setData(d))
      .catch(() => setData({ points: 0, history: [] }))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingSection />;

  const points = data?.points ?? 0;
  const history = data?.history || [];
  const isEmpty = points === 0 && history.length === 0;

  const typeIcons = {
    order:    '🛒',
    repair:   '🔧',
    referral: '🤝',
    redeem:   '🎁',
    bonus:    '⭐',
  };

  return (
    <div className="tab-content">
      <div className="section-block">
        <h2>My Rewards</h2>

        {/* Points balance */}
        <div className="card-paper" style={{padding:28, marginTop:16, marginBottom:20, borderLeft:'3px solid var(--ochre)'}}>
          <div className="eyebrow" style={{marginBottom:10}}>POINTS BALANCE</div>
          <div style={{display:'flex', alignItems:'baseline', gap:10}}>
            <span style={{fontFamily:'Instrument Serif, serif', fontSize:52, lineHeight:1, color:'var(--ochre)', fontWeight:400}}>
              {points.toLocaleString('en-AU')}
            </span>
            <span style={{fontSize:18, color:'var(--ink-2)', fontWeight:500}}>pts</span>
          </div>
          {points > 0 && (
            <p style={{color:'var(--ink-2)', fontSize:13, marginTop:10}}>
              Redeem your points on your next order or repair. Contact us to apply them.
            </p>
          )}
        </div>

        {/* History */}
        <div className="eyebrow" style={{marginBottom:12}}>POINTS HISTORY</div>
        {isEmpty ? (
          <div className="card-paper" style={{padding:28}}>
            <p style={{color:'var(--ink-2)'}}>No points yet. Points are earned on completed orders and repairs.</p>
          </div>
        ) : history.length === 0 ? (
          <div className="card-paper" style={{padding:28}}>
            <p style={{color:'var(--ink-2)'}}>No history to display yet.</p>
          </div>
        ) : (
          <div className="card-paper" style={{overflow:'auto'}}>
            {history.map((entry, i) => {
              const isEarn = (entry.points || 0) > 0;
              return (
                <div key={entry.id || i} style={{display:'flex', alignItems:'center', gap:14, padding:'14px 20px', borderBottom: i < history.length - 1 ? '1px solid var(--line)' : 'none', flexWrap:'wrap'}}>
                  <div style={{fontSize:20, flexShrink:0, width:28, textAlign:'center'}}>
                    {typeIcons[entry.type] || '•'}
                  </div>
                  <div style={{flex:1, minWidth:0}}>
                    <div style={{fontWeight:500, fontSize:14}}>{entry.description || entry.type || 'Points update'}</div>
                    <div style={{fontSize:12, color:'var(--ink-3)', marginTop:2}}>{fmtDate(entry.date || entry.createdAt)}</div>
                  </div>
                  <div style={{fontWeight:700, fontSize:16, color: isEarn ? '#345526' : 'var(--rust)', flexShrink:0}}>
                    {isEarn ? '+' : ''}{(entry.points || 0).toLocaleString('en-AU')} pts
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Wallet ────────────────────────────────────────────────────────────────────

function WalletTab() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api('/api/portal/wallet')
      .then(d => setData(d))
      .catch(() => setData({ giftCards: [], storeCredits: [] }))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingSection />;

  const giftCards = data?.giftCards || [];
  const storeCredits = data?.storeCredits || [];

  function maskCode(code) {
    if (!code) return '••••';
    const last4 = code.slice(-4);
    const masked = '•'.repeat(Math.max(0, code.length - 4));
    return masked + last4;
  }

  return (
    <div className="tab-content">
      <div className="section-block">
        <h2>My Wallet</h2>

        {/* Gift Cards */}
        <div style={{marginTop:20}}>
          <div className="eyebrow" style={{marginBottom:12}}>GIFT CARDS</div>
          {giftCards.length === 0 ? (
            <div className="card-paper" style={{padding:24}}>
              <p style={{color:'var(--ink-2)'}}>No gift cards linked to your account.</p>
            </div>
          ) : (
            <div style={{display:'grid', gap:12}}>
              {giftCards.map((card, i) => (
                <div key={card.id || i} className="card-paper" style={{padding:20, borderLeft:'3px solid var(--ochre)'}}>
                  <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start', flexWrap:'wrap', gap:10}}>
                    <div>
                      <div className="eyebrow" style={{marginBottom:6}}>GIFT CARD</div>
                      <div className="mono" style={{fontSize:16, letterSpacing:'.1em', fontWeight:600}}>{maskCode(card.code)}</div>
                      {card.issuedDate && (
                        <div style={{fontSize:12, color:'var(--ink-3)', marginTop:4}}>Issued {fmtDate(card.issuedDate)}</div>
                      )}
                    </div>
                    <div style={{textAlign:'right'}}>
                      <div style={{fontSize:11, color:'var(--ink-3)', marginBottom:4}}>BALANCE</div>
                      <div style={{fontFamily:'Instrument Serif, serif', fontSize:28, color:'var(--ochre)', lineHeight:1}}>
                        ${Number(card.balance || 0).toLocaleString('en-AU', {minimumFractionDigits:2})}
                      </div>
                      {card.originalBalance != null && (
                        <div style={{fontSize:11, color:'var(--ink-3)', marginTop:4}}>
                          of ${Number(card.originalBalance).toLocaleString('en-AU', {minimumFractionDigits:2})} original
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Store Credit */}
        <div style={{marginTop:28}}>
          <div className="eyebrow" style={{marginBottom:12}}>STORE CREDIT</div>
          {storeCredits.length === 0 ? (
            <div className="card-paper" style={{padding:24}}>
              <p style={{color:'var(--ink-2)'}}>No store credit available.</p>
            </div>
          ) : (
            <div style={{display:'grid', gap:12}}>
              {storeCredits.map((credit, i) => (
                <div key={credit.id || i} className="card-paper" style={{padding:20, display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:10}}>
                  <div>
                    <div style={{fontWeight:500, fontSize:14}}>{credit.description || 'Store Credit'}</div>
                    {credit.issuedDate && (
                      <div style={{fontSize:12, color:'var(--ink-3)', marginTop:3}}>Issued {fmtDate(credit.issuedDate)}</div>
                    )}
                  </div>
                  <div style={{fontFamily:'Instrument Serif, serif', fontSize:24, color:'#345526', fontWeight:400}}>
                    ${Number(credit.balance || 0).toLocaleString('en-AU', {minimumFractionDigits:2})}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Addresses ─────────────────────────────────────────────────────────────────

function AddressesTab() {
  const [addresses, setAddresses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', line1: '', line2: '', city: '', state: '', postcode: '', country: 'AU' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    api('/api/portal/addresses')
      .then(d => setAddresses(d.addresses || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function saveAddress(e) {
    e.preventDefault();
    setErr(''); setBusy(true);
    const r = await api('/api/portal/addresses/save', { method: 'POST', body: JSON.stringify(form) });
    setBusy(false);
    if (r.ok) { setAddresses(a => [...a, r.address]); setShowForm(false); setForm({ name: '', line1: '', line2: '', city: '', state: '', postcode: '', country: 'AU' }); }
    else setErr(r.message || 'Failed to save address.');
  }

  async function deleteAddress(id) {
    await api('/api/portal/addresses/delete', { method: 'POST', body: JSON.stringify({ id }) });
    setAddresses(a => a.filter(x => x.id !== id));
  }

  const f = (k) => ({ value: form[k], onChange: e => setForm(p => ({...p, [k]: e.target.value})) });

  return (
    <div className="tab-content">
      <div className="section-block">
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16}}>
          <h2>Saved Addresses</h2>
          {!showForm && <button className="btn btn-rust btn-sm" onClick={() => setShowForm(true)}>+ Add Address</button>}
        </div>
        {loading ? <LoadingSection /> : (
          <>
            {showForm && (
              <div className="card-paper" style={{padding:24, marginBottom:20}}>
                <h3 style={{fontSize:15, marginBottom:16}}>New Address</h3>
                {err && <div className="alert alert-error" style={{marginBottom:12}}>{err}</div>}
                <form onSubmit={saveAddress}>
                  <label className="field"><span className="label">Full name / label *</span><input className="input" required {...f('name')} placeholder="Home, Jane Smith, etc." /></label>
                  <label className="field"><span className="label">Street address *</span><input className="input" required {...f('line1')} placeholder="123 Station Rd" /></label>
                  <label className="field"><span className="label">Apartment / suite</span><input className="input" {...f('line2')} placeholder="Unit 4" /></label>
                  <div style={{display:'grid', gridTemplateColumns:'1fr 80px 100px', gap:12}}>
                    <label className="field"><span className="label">City / suburb *</span><input className="input" required {...f('city')} placeholder="Broken Hill" /></label>
                    <label className="field"><span className="label">State *</span><input className="input" required {...f('state')} placeholder="NSW" maxLength={3} /></label>
                    <label className="field"><span className="label">Postcode *</span><input className="input" required {...f('postcode')} placeholder="2880" maxLength={4} /></label>
                  </div>
                  <div style={{display:'flex', gap:8, marginTop:8}}>
                    <button className="btn btn-rust" type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save Address'}</button>
                    <button className="btn btn-ghost" type="button" onClick={() => setShowForm(false)}>Cancel</button>
                  </div>
                </form>
              </div>
            )}
            {addresses.length === 0 && !showForm
              ? <p style={{color:'var(--ink-2)', marginTop:8}}>No saved addresses yet. Add one to speed up checkout.</p>
              : (
                <div style={{display:'grid', gap:12}}>
                  {addresses.map(a => (
                    <div key={a.id} className="card-paper" style={{padding:20, display:'flex', justifyContent:'space-between', alignItems:'flex-start'}}>
                      <div>
                        <div style={{fontWeight:600}}>{a.name}</div>
                        <div style={{color:'var(--ink-2)', fontSize:14, marginTop:4}}>{a.line1}{a.line2 ? `, ${a.line2}` : ''}</div>
                        <div style={{color:'var(--ink-2)', fontSize:14}}>{a.city} {a.state} {a.postcode}</div>
                      </div>
                      <button className="btn btn-ghost btn-sm" style={{color:'var(--rust)', borderColor:'var(--rust)'}} onClick={() => deleteAddress(a.id)}>Remove</button>
                    </div>
                  ))}
                </div>
              )
            }
          </>
        )}
      </div>
    </div>
  );
}

// ── Bookings ──────────────────────────────────────────────────────────────────

function BookingStatusBadge({ status }) {
  const s = (status || '').toLowerCase();
  const style = {
    display: 'inline-block',
    padding: '2px 10px',
    borderRadius: 10,
    fontSize: 12,
    fontWeight: 600,
    ...(s === 'confirmed'
      ? { background: '#d4edda', color: '#345526' }
      : s === 'cancelled' || s === 'canceled'
      ? { background: '#f0e0e0', color: '#7a2020' }
      : { background: '#fef3cd', color: '#7a5d10' }) // pending / default = ochre/yellow
  };
  return <span style={style}>{status || 'pending'}</span>;
}

function BookingsTab() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ serviceName: '', date: '', time: '', notes: '' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const today = new Date().toISOString().split('T')[0];

  function loadBookings() {
    return api('/api/portal/bookings')
      .then(d => setBookings(d.bookings || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  useEffect(() => { loadBookings(); }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setErr(''); setBusy(true);
    const r = await api('/api/portal/bookings', {
      method: 'POST',
      body: JSON.stringify({ serviceName: form.serviceName, date: form.date, time: form.time, notes: form.notes }),
    });
    setBusy(false);
    if (r.ok) {
      setSuccessMsg('Booking request submitted. We\'ll confirm your appointment soon.');
      setShowForm(false);
      setForm({ serviceName: '', date: '', time: '', notes: '' });
      setLoading(true);
      loadBookings();
    } else {
      setErr(r.message || 'Failed to submit booking. Please try again.');
    }
  }

  return (
    <div className="tab-content">
      <div className="section-block">
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16, flexWrap:'wrap', gap:12}}>
          <h2 style={{margin:0}}>My Bookings</h2>
          <button className="btn btn-rust" onClick={() => { setShowForm(s => !s); setErr(''); }}>
            {showForm ? '↑ Cancel' : '+ Request a Booking'}
          </button>
        </div>

        {successMsg && <div className="alert alert-success" style={{marginBottom:20}}>{successMsg}</div>}

        {showForm && (
          <div className="card-paper" style={{padding:28, marginBottom:24}}>
            <h3 style={{marginBottom:20, fontSize:18}}>New Booking Request</h3>
            {err && <div className="alert alert-error" style={{marginBottom:16}}>{err}</div>}
            <form onSubmit={handleSubmit}>
              <label className="field">
                <span className="label">Service Name *</span>
                <input className="input" type="text" value={form.serviceName}
                  onChange={e => setForm(f => ({...f, serviceName: e.target.value}))}
                  placeholder="e.g. Laptop repair, field visit, consultation…" required />
              </label>
              <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:16}}>
                <label className="field">
                  <span className="label">Preferred Date *</span>
                  <input className="input" type="date" value={form.date} min={today}
                    onChange={e => setForm(f => ({...f, date: e.target.value}))} required />
                </label>
                <label className="field">
                  <span className="label">Preferred Time *</span>
                  <input className="input" type="time" value={form.time}
                    onChange={e => setForm(f => ({...f, time: e.target.value}))} required />
                </label>
              </div>
              <label className="field">
                <span className="label">Notes <span style={{color:'var(--ink-3)', fontWeight:400}}>(optional)</span></span>
                <textarea className="input textarea" rows={3} value={form.notes}
                  onChange={e => setForm(f => ({...f, notes: e.target.value}))}
                  placeholder="Any details we should know — device type, location, special requirements…" />
              </label>
              <div style={{display:'flex', gap:10, marginTop:4}}>
                <button className="btn btn-rust" type="submit" disabled={busy}>{busy ? 'Submitting…' : 'Submit Request →'}</button>
                <button className="btn btn-ghost" type="button" onClick={() => { setShowForm(false); setErr(''); }}>Cancel</button>
              </div>
            </form>
          </div>
        )}

        {loading ? <LoadingSection /> : bookings.length === 0
          ? (
            <div className="card-paper" style={{padding:28, marginTop: showForm ? 0 : 16}}>
              <p style={{color:'var(--ink-2)', marginBottom:16}}>No bookings yet. Use the button above to request an appointment, or contact us directly.</p>
              <div style={{display:'flex', gap:12, flexWrap:'wrap'}}>
                <a className="btn btn-ghost" href="https://outbackelectronics.com.au/contact">Contact us</a>
              </div>
            </div>
          )
          : (
            <div className="card-paper" style={{overflow:'auto', marginTop: showForm ? 0 : 16}}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Date &amp; Time</th>
                    <th>Service</th>
                    <th>Notes</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {bookings.map((b, i) => (
                    <tr key={b.id || i}>
                      <td style={{whiteSpace:'nowrap'}}>
                        {fmtDate(b.date)}
                        {b.time && <span style={{color:'var(--ink-3)', marginLeft:6, fontSize:12}}>{b.time}</span>}
                      </td>
                      <td>{b.service || b.serviceName || '—'}</td>
                      <td style={{maxWidth:220, color:'var(--ink-2)', fontSize:13}}>{b.notes || '—'}</td>
                      <td><BookingStatusBadge status={b.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        }
      </div>
    </div>
  );
}

// ── Account ───────────────────────────────────────────────────────────────────

function AccountTab({ user, setUser }) {
  const [displayName, setDisplayName] = useState(user.displayName || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [profileMsg, setProfileMsg] = useState(null);
  const [passwordMsg, setPasswordMsg] = useState(null);
  const [profileBusy, setProfileBusy] = useState(false);
  const [passwordBusy, setPasswordBusy] = useState(false);

  async function saveProfile(e) {
    e.preventDefault();
    setProfileBusy(true); setProfileMsg(null);
    const r = await api('/api/portal/profile', { method: 'PATCH', body: JSON.stringify({ displayName }) });
    setProfileBusy(false);
    if (r.ok) { setUser(r.user); setProfileMsg({ ok: true, text: 'Display name updated.' }); }
    else { setProfileMsg({ ok: false, text: r.message || 'Update failed.' }); }
  }

  async function changePassword(e) {
    e.preventDefault();
    setPasswordBusy(true); setPasswordMsg(null);
    const r = await api('/api/portal/profile', { method: 'PATCH', body: JSON.stringify({ currentPassword, newPassword }) });
    setPasswordBusy(false);
    if (r.ok) { setPasswordMsg({ ok: true, text: 'Password changed.' }); setCurrentPassword(''); setNewPassword(''); }
    else { setPasswordMsg({ ok: false, text: r.message || 'Failed to change password.' }); }
  }

  return (
    <div className="page-section">
      <div className="container">
        <div className="section-head"><h2>Account Settings</h2></div>
        <div className="grid-2" style={{alignItems:'start'}}>

          <div className="card-paper" style={{padding:28}}>
            <h3 style={{marginBottom:6, fontSize:16}}>Profile</h3>
            <p style={{color:'var(--ink-2)', fontSize:13, marginBottom:20}}>
              Username: <span className="mono">{user.username}</span>
            </p>
            {profileMsg && <div className={'alert ' + (profileMsg.ok ? 'alert-success' : 'alert-error')}>{profileMsg.text}</div>}
            <form onSubmit={saveProfile}>
              <label className="field">
                <span className="label">Display name</span>
                <input className="input" value={displayName} onChange={e => setDisplayName(e.target.value)} />
              </label>
              <button className="btn btn-rust" type="submit" disabled={profileBusy}>{profileBusy ? 'Saving…' : 'Save Changes'}</button>
            </form>
          </div>

          <div className="card-paper" style={{padding:28}}>
            <h3 style={{marginBottom:6, fontSize:16}}>Change Password</h3>
            <p style={{color:'var(--ink-2)', fontSize:13, marginBottom:20}}>Choose a password at least 8 characters long.</p>
            {passwordMsg && <div className={'alert ' + (passwordMsg.ok ? 'alert-success' : 'alert-error')}>{passwordMsg.text}</div>}
            <form onSubmit={changePassword}>
              <label className="field">
                <span className="label">Current password</span>
                <input className="input" type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} required autoComplete="current-password" />
              </label>
              <label className="field">
                <span className="label">New password</span>
                <input className="input" type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} required autoComplete="new-password" />
              </label>
              <button className="btn btn-rust" type="submit" disabled={passwordBusy}>{passwordBusy ? 'Updating…' : 'Update Password'}</button>
            </form>
          </div>

        </div>
      </div>
    </div>
  );
}

// ── Shared UI ─────────────────────────────────────────────────────────────────

function LoadingSection() {
  return (
    <div className="page-section">
      <div className="container">
        <div style={{color:'var(--ink-2)', fontSize:14, padding:'40px 0'}}>Loading…</div>
      </div>
    </div>
  );
}

function EmptyState({ icon, message }) {
  const icons = {
    cart: <path d="M3 4h2l2.5 12h11l2-9H6"/>,
    tool: <><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></>,
    file: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></>,
  };
  return (
    <div className="empty">
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        {icons[icon] || null}
      </svg>
      <p>{message}</p>
      <p style={{marginTop:8, fontSize:13}}>
        Need help? <a href="https://outbackelectronics.com.au/contact" style={{color:'var(--rust)'}}>Contact our team →</a>
      </p>
    </div>
  );
}

// ── Warranty Registration (portal route, no tab in nav) ───────────────────────

function WarrantyPage({ orderId: initialOrderId }) {
  const [orderId, setOrderId] = useState(initialOrderId || '');
  const [lookup, setLookup] = useState(null);
  const [lookupErr, setLookupErr] = useState('');
  const [form, setForm] = useState({ name: '', email: '', receivedDate: '', notes: '' });
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (initialOrderId) doLookup(initialOrderId);
  }, []);

  async function doLookup(id, email) {
    setLookupErr('');
    const em = (email || form.email || '').trim();
    if (!em) { setLookupErr('Please enter your email address first.'); return; }
    const d = await api(`/api/warranty/order-lookup?id=${encodeURIComponent(id)}&email=${encodeURIComponent(em)}`).catch(() => null);
    if (!d || !d.found) { setLookupErr('Order not found. Check the ID and email in your confirmation email and try again.'); return; }
    setLookup(d);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setErr(''); setBusy(true);
    const r = await api('/api/warranty/register', { method: 'POST', body: JSON.stringify({ ...form, orderId, expenses: lookup?.expenses || [] }) });
    setBusy(false);
    if (r.ok) setDone(r.id);
    else setErr(r.message || 'Something went wrong. Please try again.');
  }

  if (done) return (
    <div className="tab-content">
      <div className="section-block" style={{ maxWidth: 600 }}>
        <div className="eyebrow" style={{ color: 'var(--rust)', marginBottom: 12 }}>WARRANTY REGISTERED</div>
        <h2 style={{ marginBottom: 12 }}>You're covered.</h2>
        <p style={{ color: 'var(--ink-2)', lineHeight: 1.7 }}>
          Registration ID: <strong className="mono">{done}</strong><br />
          We've sent a confirmation to {form.email}. Keep it as your warranty record.
        </p>
      </div>
    </div>
  );

  return (
    <div className="tab-content">
      <div className="section-block" style={{ maxWidth: 640 }}>
        <h2 style={{ marginBottom: 8 }}>Register Your Build</h2>
        <p style={{ color: 'var(--ink-2)', marginBottom: 24 }}>Enter your order ID and we'll pull up your build details automatically.</p>

        {!lookup ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
            <input className="input" placeholder="e.g. ord-1234567890" value={orderId}
              onChange={e => setOrderId(e.target.value)} />
            <div style={{ display: 'flex', gap: 12 }}>
              <input className="input" type="email" style={{ flex: 1 }} placeholder="Email from your order confirmation"
                value={form.email} onChange={e => setForm(f => ({...f, email: e.target.value}))} />
              <button className="btn btn-rust" onClick={() => doLookup(orderId, form.email)} disabled={!orderId.trim() || !form.email.trim()}>Look up →</button>
            </div>
          </div>
        ) : (
          <div className="card-paper" style={{ padding: 16, marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div className="eyebrow" style={{ marginBottom: 4 }}>ORDER FOUND</div>
              <div className="mono" style={{ fontSize: 13 }}>{orderId} · {lookup.order?.date}</div>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={() => { setLookup(null); setLookupErr(''); }}>Change</button>
          </div>
        )}

        {lookupErr && <div className="alert alert-error" style={{ marginBottom: 16 }}>{lookupErr}</div>}

        {lookup && (
          <form onSubmit={handleSubmit}>
            <label className="field">
              <span className="label">Full name *</span>
              <input className="input" required value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} placeholder="Your name" />
            </label>
            <label className="field">
              <span className="label">Email address *</span>
              <input className="input" type="email" required value={form.email} onChange={e => setForm(f => ({...f, email: e.target.value}))} placeholder="your@email.com" />
            </label>
            <label className="field">
              <span className="label">Date received *</span>
              <input className="input" type="date" required value={form.receivedDate} onChange={e => setForm(f => ({...f, receivedDate: e.target.value}))} />
            </label>
            <label className="field">
              <span className="label">Notes (optional)</span>
              <textarea className="input textarea" rows={3} value={form.notes} onChange={e => setForm(f => ({...f, notes: e.target.value}))} placeholder="Anything we should know — e.g. arrived with minor transit damage" />
            </label>
            {err && <div className="alert alert-error" style={{ marginBottom: 12 }}>{err}</div>}
            <button className="btn btn-rust" type="submit" disabled={busy}>{busy ? 'Registering…' : 'Register Warranty →'}</button>
          </form>
        )}
      </div>
    </div>
  );
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

const PORTAL_TABS = ['overview','orders','repairs','quotes','memberships','rewards','wallet','addresses','bookings','account'];

function Dashboard({ user, setUser, onLogout }) {
  const [tab, setTab] = useState(() => {
    const seg = window.location.pathname.replace(/^\/+/, '').split('/')[0];
    return PORTAL_TABS.includes(seg) ? seg : 'overview';
  });
  const [newOrderId, setNewOrderId] = useState(null);
  const [quoteRef] = useState(() => new URLSearchParams(window.location.search).get('ref'));

  const switchTab = (id) => {
    setTab(id);
    const target = id === 'overview' ? '/' : '/' + id;
    if (window.location.pathname !== target) window.history.pushState({}, '', target);
  };

  const handleOrderCreated = (orderId) => {
    setNewOrderId(orderId);
    switchTab('orders');
  };

  useEffect(() => {
    const onPop = () => {
      const seg = window.location.pathname.replace(/^\/+/, '').split('/')[0];
      if (PORTAL_TABS.includes(seg)) setTab(seg);
      else setTab('overview');
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  return (
    <>
      <PortalNav user={user} tab={tab} setTab={switchTab} onLogout={onLogout} />
      {tab === 'overview'    && <OverviewTab user={user} setTab={switchTab} />}
      {tab === 'orders'      && <OrdersTab highlightId={newOrderId} />}
      {tab === 'repairs'     && <RepairsTab />}
      {tab === 'quotes'      && <QuotesTab user={user} onOrderCreated={handleOrderCreated} highlightRef={quoteRef} />}
      {tab === 'memberships' && <MembershipsTab />}
      {tab === 'rewards'     && <RewardsTab />}
      {tab === 'wallet'      && <WalletTab />}
      {tab === 'addresses'   && <AddressesTab />}
      {tab === 'bookings'    && <BookingsTab />}
      {tab === 'account'     && <AccountTab user={user} setUser={setUser} />}
      <footer className="portal-footer">
        <div className="container">
          <div className="row-flex">
            <span>© {new Date().getFullYear()} Outback Electronics</span>
            <div style={{display:'flex', gap:20}}>
              <a href="https://outbackelectronics.com.au">Main site</a>
              <a href="https://forum.outbackelectronics.com.au">Forum</a>
              <a href="https://outbackelectronics.com.au/contact">Contact</a>
              <a href="https://outbackelectronics.com.au/policies">Policies</a>
            </div>
          </div>
        </div>
      </footer>
    </>
  );
}

// ── Order tracking token view (no login required) ────────────────────────────

function OrderTokenView({ token, onLogin }) {
  const [info, setInfo] = useState(null);   // { orderId, customerName, email, hasAccount }
  const [err, setErr] = useState('');
  const [step, setStep] = useState('loading'); // 'loading' | 'register' | 'login-required' | 'done'
  // registration form fields
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [formErr, setFormErr] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api(`/api/order-token?token=${encodeURIComponent(token)}`)
      .then(d => {
        if (d.ok) {
          setInfo(d);
          if (d.hasAccount) {
            setStep('login-required');
          } else {
            // Pre-fill name if available
            const parts = (d.customerName || '').split(' ');
            setFirstName(parts[0] || '');
            setLastName(parts.slice(1).join(' ') || '');
            setStep('register');
          }
        } else {
          setErr(d.message || 'This link is invalid or has expired.');
          setStep('error');
        }
      })
      .catch(() => { setErr('Could not load order details. Please try again.'); setStep('error'); });
  }, [token]);

  async function handleRegister(e) {
    e.preventDefault();
    setFormErr(''); setBusy(true);
    const r = await api('/api/portal/auth/register', {
      method: 'POST',
      body: JSON.stringify({ firstName, lastName, email: info.email, phone, address, username, password }),
    });
    setBusy(false);
    if (r.ok) {
      onLogin(r.user);
      window.history.replaceState({}, '', '/orders');
    } else {
      setFormErr(r.message || 'Registration failed. Please try again.');
    }
  }

  if (step === 'loading') return (
    <div style={{minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--ink-2)', fontSize:14}}>
      Loading…
    </div>
  );

  if (step === 'error') return (
    <div style={{minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', padding:24}}>
      <div style={{maxWidth:480, textAlign:'center'}}>
        <p style={{color:'var(--rust)', marginBottom:16}}>{err}</p>
        <a href="/" style={{color:'var(--rust)', fontSize:13}}>Go to portal →</a>
      </div>
    </div>
  );

  if (step === 'login-required') return (
    <div style={{minHeight:'100vh', background:'var(--bg-deep)', display:'flex', alignItems:'center', justifyContent:'center', padding:24}}>
      <div className="card-paper" style={{maxWidth:440, width:'100%', padding:36, textAlign:'center'}}>
        <div className="eyebrow" style={{marginBottom:16}}>OUTBACK ELECTRONICS</div>
        <h2 style={{fontFamily:'Instrument Serif, serif', fontWeight:400, fontSize:28, marginBottom:12}}>Account already exists</h2>
        <p style={{color:'var(--ink-2)', marginBottom:24}}>
          A portal account already exists for <strong>{info.email}</strong>.<br/>
          Log in to track your order.
        </p>
        <a href="/" className="btn btn-rust" style={{width:'100%', justifyContent:'center'}}>Log in →</a>
      </div>
    </div>
  );

  // step === 'register'
  return (
    <div style={{minHeight:'100vh', background:'var(--bg-deep)', padding:'40px 16px'}}>
      <div style={{maxWidth:520, margin:'0 auto'}}>
        <div style={{textAlign:'center', marginBottom:28}}>
          <div className="eyebrow" style={{marginBottom:8}}>OUTBACK ELECTRONICS</div>
          <h1 className="serif" style={{fontSize:28, fontWeight:400, marginBottom:8}}>Track your order</h1>
          <p style={{color:'var(--ink-2)', fontSize:14}}>Create an account to view your order status and updates.</p>
        </div>
        <div className="card-paper" style={{padding:28}}>
          {formErr && <div className="alert alert-error" style={{marginBottom:16}}>{formErr}</div>}
          <form onSubmit={handleRegister}>
            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:12}}>
              <label className="field" style={{margin:0}}>
                <span className="label">First name</span>
                <input className="input" type="text" value={firstName} autoComplete="given-name" onChange={e => setFirstName(e.target.value)} required />
              </label>
              <label className="field" style={{margin:0}}>
                <span className="label">Last name</span>
                <input className="input" type="text" value={lastName} autoComplete="family-name" onChange={e => setLastName(e.target.value)} required />
              </label>
            </div>
            <label className="field">
              <span className="label">Email address</span>
              <input className="input" type="email" value={info.email} readOnly style={{opacity:0.6, cursor:'not-allowed'}} />
            </label>
            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:12}}>
              <label className="field" style={{margin:0}}>
                <span className="label">Phone <span style={{color:'var(--ink-3)'}}>(optional)</span></span>
                <input className="input" type="tel" value={phone} autoComplete="tel" onChange={e => setPhone(e.target.value)} />
              </label>
              <label className="field" style={{margin:0}}>
                <span className="label">Address <span style={{color:'var(--ink-3)'}}>(optional)</span></span>
                <input className="input" type="text" value={address} autoComplete="street-address" onChange={e => setAddress(e.target.value)} />
              </label>
            </div>
            <label className="field">
              <span className="label">Username</span>
              <input className="input" type="text" value={username} autoComplete="username" onChange={e => setUsername(e.target.value)} required />
              <span style={{fontSize:11, color:'var(--ink-3)', marginTop:3, display:'block'}}>3–30 characters, letters, numbers and underscores</span>
            </label>
            <label className="field">
              <span className="label">Password</span>
              <input className="input" type="password" value={password} autoComplete="new-password" onChange={e => setPassword(e.target.value)} required />
              <span style={{fontSize:11, color:'var(--ink-3)', marginTop:3, display:'block'}}>Minimum 8 characters</span>
            </label>
            <button className="btn btn-rust" type="submit" disabled={busy} style={{width:'100%', justifyContent:'center', marginTop:8}}>
              {busy ? 'Creating account…' : 'Create account & view order →'}
            </button>
          </form>
          <div style={{marginTop:16, textAlign:'center', fontSize:13, color:'var(--ink-3)'}}>
            Already have an account? <a href="/" style={{color:'var(--rust)', fontWeight:600}}>Log in →</a>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Quote token view (no login required) ─────────────────────────────────────

function QuoteTokenView({ token, onAccepted }) {
  const [quote, setQuote] = useState(null);
  const [err, setErr] = useState('');
  const [step, setStep] = useState('view'); // 'view' | 'create-account' | 'login-required' | 'done'
  const [form, setForm] = useState({ username: '', password: '', displayName: '' });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    api(`/api/quote/token?token=${encodeURIComponent(token)}`)
      .then(d => { if (d.ok) setQuote(d.quote); else setErr('This quote link is invalid or has expired.'); })
      .catch(() => setErr('Could not load quote. Please try again.'));
  }, [token]);

  const lineItems = quote ? [
    ...(quote.hardwareItems || []).filter(i => i.name).map(i => {
      const qty = parseInt(i.qty) || 1;
      return { label: i.name + (qty > 1 ? ` × ${qty}` : ''), amount: (parseFloat(i.basePrice) || 0) * qty * 1.02 };
    }),
    ...(quote.pcBuild && quote.pcBuildFee > 0 ? [{ label: 'Custom PC Build', amount: quote.pcBuildFee }] : []),
    ...(quote.otherItems || []).filter(i => i.description).map(i => ({ label: i.description, amount: parseFloat(i.amount) || 0 })),
  ] : [];

  const validUntil = quote?.validDays
    ? new Date(Date.now() + quote.validDays * 86400000).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })
    : null;

  async function handleAccept(e) {
    e.preventDefault();
    setBusy(true); setMsg('');
    const r = await api('/api/quote/accept-token', { method: 'POST', body: JSON.stringify({ token, ...form }) });
    setBusy(false);
    if (r.ok) {
      setStep('done');
      if (onAccepted) onAccepted(r.user, r.orderId);
    } else if (r.error === 'email_exists') {
      setStep('login-required');
    } else {
      setMsg(r.message || 'Something went wrong. Please try again.');
    }
  }

  if (err) return (
    <div style={{minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', padding:24}}>
      <div style={{maxWidth:480, textAlign:'center'}}>
        <p style={{color:'var(--rust)', marginBottom:16}}>{err}</p>
        <a href="/" style={{color:'var(--rust)', fontSize:13}}>Go to portal →</a>
      </div>
    </div>
  );

  if (!quote) return (
    <div style={{minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--ink-2)', fontSize:14}}>
      Loading quote…
    </div>
  );

  if (step === 'done') return (
    <div style={{minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', padding:24}}>
      <div className="card-paper" style={{maxWidth:480, padding:36, textAlign:'center'}}>
        <div style={{fontSize:32, marginBottom:12}}>✓</div>
        <h2 style={{marginBottom:8}}>Quote accepted!</h2>
        <p style={{color:'var(--ink-2)', marginBottom:20}}>Your order has been created and a confirmation is on its way to your email.</p>
        <a href="/orders" className="btn btn-rust">View your order →</a>
      </div>
    </div>
  );

  if (step === 'login-required') return (
    <div style={{minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', padding:24}}>
      <div className="card-paper" style={{maxWidth:480, padding:36, textAlign:'center'}}>
        <h2 style={{marginBottom:8}}>Account already exists</h2>
        <p style={{color:'var(--ink-2)', marginBottom:20}}>An account is already registered to <strong>{quote.email}</strong>. Please log in to accept this quote.</p>
        <a href={`/quotes?token=${encodeURIComponent(token)}`} className="btn btn-rust" onClick={e => { e.preventDefault(); window.location.replace('/quotes?ref=' + encodeURIComponent(quote.quoteRef)); }}>Log in to portal →</a>
      </div>
    </div>
  );

  return (
    <div style={{minHeight:'100vh', background:'var(--bg-deep)', padding:'40px 16px'}}>
      <div style={{maxWidth:640, margin:'0 auto'}}>
        <div style={{marginBottom:24, textAlign:'center'}}>
          <div className="eyebrow" style={{marginBottom:8}}>OUTBACK ELECTRONICS</div>
          <h1 className="serif" style={{fontSize:28, fontWeight:400}}>Your Quote — {quote.quoteRef}</h1>
          {validUntil && <p style={{color:'var(--ink-2)', fontSize:13, marginTop:6}}>Valid until {validUntil}</p>}
        </div>

        <div className="card-paper" style={{padding:28, marginBottom:20}}>
          {lineItems.length > 0 && (
            <div style={{border:'1px solid var(--line)', marginBottom:quote.notes ? 16 : 0}}>
              {lineItems.map((item, i) => (
                <div key={i} style={{display:'flex', justifyContent:'space-between', padding:'10px 14px', borderBottom: i < lineItems.length - 1 ? '1px solid var(--line)' : 'none', fontSize:14}}>
                  <span>{item.label}</span>
                  <span className="mono" style={{fontWeight:600}}>${item.amount.toLocaleString('en-AU',{minimumFractionDigits:2})}</span>
                </div>
              ))}
              <div style={{display:'flex', justifyContent:'space-between', padding:'12px 14px', background:'var(--ink)', color:'var(--paper)'}}>
                <span style={{fontWeight:600}}>Total (AUD)</span>
                <span className="mono" style={{fontWeight:700, fontSize:16, color:'var(--ochre)'}}>
                  ${Number(quote.grandTotal||0).toLocaleString('en-AU',{minimumFractionDigits:2})}
                </span>
              </div>
            </div>
          )}
          {quote.notes && <p style={{fontSize:13, color:'var(--ink-2)', marginTop:lineItems.length ? 16 : 0}}>{quote.notes}</p>}
        </div>

        {quote.status !== 'quoted' ? (
          <div className="card-paper" style={{padding:24, textAlign:'center', color:'var(--ink-2)'}}>
            This quote has already been accepted.
          </div>
        ) : step === 'view' ? (
          <div className="card-paper" style={{padding:28, textAlign:'center'}}>
            <p style={{marginBottom:20, color:'var(--ink-2)'}}>Ready to go ahead? Create your account below to accept this quote and track your order.</p>
            <button className="btn btn-rust" onClick={() => setStep('create-account')}>Accept Quote →</button>
            <p style={{marginTop:12, fontSize:12, color:'var(--ink-3)'}}>Already have an account? <a href="/" style={{color:'var(--rust)'}}>Log in here</a>.</p>
          </div>
        ) : (
          <div className="card-paper" style={{padding:28}}>
            <h3 style={{marginBottom:4}}>Create your account</h3>
            <p style={{color:'var(--ink-2)', fontSize:13, marginBottom:20}}>Your account email will be <strong>{quote.email}</strong> — the address we sent this quote to.</p>
            <form onSubmit={handleAccept}>
              <div className="grid-2" style={{marginBottom:14}}>
                <label className="field" style={{margin:0}}>
                  <span className="label">Display name</span>
                  <input className="input" placeholder={quote.name || 'Your name'} value={form.displayName} onChange={e => setForm(f => ({...f, displayName: e.target.value}))} />
                </label>
                <label className="field" style={{margin:0}}>
                  <span className="label">Username</span>
                  <input className="input" placeholder="e.g. jsmith91" value={form.username} onChange={e => setForm(f => ({...f, username: e.target.value}))} required pattern="[a-zA-Z0-9_]{3,30}" title="3–30 characters, letters, numbers and underscores" />
                </label>
              </div>
              <label className="field" style={{marginBottom:20}}>
                <span className="label">Password</span>
                <input className="input" type="password" placeholder="At least 8 characters" value={form.password} onChange={e => setForm(f => ({...f, password: e.target.value}))} required minLength={8} />
              </label>
              {msg && <div className="alert alert-error" style={{marginBottom:14}}>{msg}</div>}
              <div style={{display:'flex', gap:12, alignItems:'center'}}>
                <button className="btn btn-rust" type="submit" disabled={busy}>{busy ? 'Accepting…' : 'Confirm & Accept Quote →'}</button>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setStep('view')}>Back</button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Root ──────────────────────────────────────────────────────────────────────

function PortalApp() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const resetToken = new URLSearchParams(window.location.search).get('reset');
  const quoteToken = new URLSearchParams(window.location.search).get('token');
  const orderToken = new URLSearchParams(window.location.search).get('order_token');
  const warrantyOrderId = new URLSearchParams(window.location.search).get('warranty');

  useEffect(() => {
    ensureCsrf().then(() =>
      api('/api/portal/auth/me')
        .then(d => { setUser(d.user || null); setLoading(false); })
        .catch(() => setLoading(false))
    );
  }, []);

  if (resetToken && !user) {
    return <ResetPasswordForm token={resetToken} onDone={() => { window.history.replaceState({}, '', window.location.pathname); }} />;
  }

  if (loading) {
    return (
      <div style={{minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--ink-2)', fontSize:14}}>
        Loading…
      </div>
    );
  }

  if (orderToken && !user) {
    return <OrderTokenView token={orderToken} onLogin={(u) => { setUser(u); }} />;
  }

  if (quoteToken && !user) {
    return (
      <QuoteTokenView
        token={quoteToken}
        onAccepted={(newUser) => {
          setUser(newUser);
          window.history.replaceState({}, '', '/orders');
        }}
      />
    );
  }

  if (!user) return <LoginPage onLogin={setUser} />;
  if (warrantyOrderId) return <WarrantyPage orderId={warrantyOrderId} />;
  return <Dashboard user={user} setUser={setUser} onLogout={() => setUser(null)} />;
}

export default PortalApp;
