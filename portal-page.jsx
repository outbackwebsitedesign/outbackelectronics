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
                  Register with your forum account
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
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleRegister(e) {
    e.preventDefault();
    setError(''); setBusy(true);
    const r = await api('/api/portal/auth/register', { method: 'POST', body: JSON.stringify({ username, displayName, email, password }) });
    setBusy(false);
    if (r.ok) { onLogin(r.user); }
    else { setError(r.message || 'Registration failed.'); }
  }

  return (
    <>
      <h2 style={{fontFamily:'Instrument Serif, serif', fontWeight:400, fontSize:28, marginBottom:20}}>Create account</h2>
      {error && <div className="alert alert-error">{error}</div>}
      <form onSubmit={handleRegister}>
        <label className="field">
          <span className="label">Username</span>
          <input className="input" type="text" value={username} onChange={e => setUsername(e.target.value)} required />
        </label>
        <label className="field">
          <span className="label">Display name (optional)</span>
          <input className="input" type="text" value={displayName} onChange={e => setDisplayName(e.target.value)} />
        </label>
        <label className="field">
          <span className="label">Email address (optional)</span>
          <input className="input" type="email" value={email} onChange={e => setEmail(e.target.value)} />
        </label>
        <label className="field">
          <span className="label">Password</span>
          <input className="input" type="password" value={password} onChange={e => setPassword(e.target.value)} required />
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

function OrdersTab() {
  const [items, setItems] = useState(null);

  useEffect(() => {
    api('/api/portal/orders').then(r => setItems(r.items || []));
  }, []);

  if (!items) return <LoadingSection />;

  return (
    <div className="page-section">
      <div className="container">
        <div className="section-head">
          <h2>Orders</h2>
          <p>Your order history with Outback Electronics.</p>
        </div>
        {items.length === 0
          ? <EmptyState icon="cart" message="No orders found for your account." />
          : (
            <div className="card-paper" style={{overflow:'auto'}}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Order ID</th>
                    <th>Date</th>
                    <th>Customer</th>
                    <th>Items</th>
                    <th>Total</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map(o => (
                    <tr key={o.id}>
                      <td><span className="mono" style={{fontSize:12}}>{o.id}</span></td>
                      <td>{fmtDate(o.date || o.createdAt)}</td>
                      <td>{o.customer || o.name || '—'}</td>
                      <td>{Array.isArray(o.items) ? o.items.length : (o.itemCount || '—')}</td>
                      <td>{o.total != null ? `$${Number(o.total).toFixed(2)}` : '—'}</td>
                      <td><StatusTag status={o.status} /></td>
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

function QuotesTab({ user }) {
  const [items, setItems] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ name: user.displayName || user.username, email: '', description: '' });
  const [submitMsg, setSubmitMsg] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api('/api/portal/quotes').then(r => setItems(r.items || []));
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setBusy(true); setSubmitMsg('');
    const r = await api('/api/portal/quotes/request', {
      method: 'POST',
      body: JSON.stringify(formData),
    });
    setBusy(false);
    if (r.ok) {
      setSubmitMsg('Quote request sent. We\'ll be in touch within 24 hours.');
      setShowForm(false);
      api('/api/portal/quotes').then(r2 => setItems(r2.items || []));
    } else {
      setSubmitMsg(r.message || 'Failed to submit. Please try again.');
    }
  }

  if (!items) return <LoadingSection />;

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

        {items.length === 0
          ? <EmptyState icon="file" message="No quote requests found for your account." />
          : (
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
                  {items.map(q => (
                    <tr key={q.id}>
                      <td><span className="mono" style={{fontSize:12}}>{q.id}</span></td>
                      <td>{fmtDate(q.date || q.createdAt)}</td>
                      <td style={{maxWidth:360}}>{q.description || q.notes || q.body || '—'}</td>
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
  return (
    <div className="tab-content">
      <div className="section-block">
        <h2>My Rewards</h2>
        <p style={{color:'var(--ink-2)', marginTop:8}}>Rewards and loyalty points are coming soon. Check back after your next repair or purchase.</p>
      </div>
    </div>
  );
}

// ── Wallet ────────────────────────────────────────────────────────────────────

function WalletTab() {
  return (
    <div className="tab-content">
      <div className="section-block">
        <h2>My Wallet</h2>
        <p style={{color:'var(--ink-2)', marginTop:8}}>Store credit and gift card balance will appear here once the wallet feature launches.</p>
      </div>
    </div>
  );
}

// ── Addresses ─────────────────────────────────────────────────────────────────

function AddressesTab() {
  const [addresses, setAddresses] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api('/api/portal/addresses')
      .then(d => setAddresses(d.addresses || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="tab-content">
      <div className="section-block">
        <h2>Saved Addresses</h2>
        {loading ? <LoadingSection /> : addresses.length === 0
          ? <p style={{color:'var(--ink-2)', marginTop:8}}>No saved addresses yet. Your delivery addresses will appear here after your first order.</p>
          : (
            <div style={{display:'grid', gap:16, marginTop:16}}>
              {addresses.map((a, i) => (
                <div key={i} className="card-paper" style={{padding:20}}>
                  <div style={{fontWeight:600}}>{a.name}</div>
                  <div style={{color:'var(--ink-2)', fontSize:14, marginTop:4}}>{a.line1}{a.line2 ? `, ${a.line2}` : ''}</div>
                  <div style={{color:'var(--ink-2)', fontSize:14}}>{a.city} {a.state} {a.postcode}</div>
                </div>
              ))}
            </div>
          )
        }
      </div>
    </div>
  );
}

// ── Bookings ──────────────────────────────────────────────────────────────────

function BookingsTab() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api('/api/portal/bookings')
      .then(d => setBookings(d.bookings || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="tab-content">
      <div className="section-block">
        <h2>My Bookings</h2>
        {loading ? <LoadingSection /> : bookings.length === 0
          ? <EmptyState icon="tool" message="No bookings yet. Book a repair or service appointment to see it here." />
          : (
            <table className="data-table" style={{marginTop:16}}>
              <thead><tr><th>Date</th><th>Service</th><th>Status</th></tr></thead>
              <tbody>
                {bookings.map((b, i) => (
                  <tr key={i}>
                    <td>{fmtDate(b.date)}</td>
                    <td>{b.service || '—'}</td>
                    <td><StatusTag status={b.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
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

// ── Dashboard ─────────────────────────────────────────────────────────────────

const PORTAL_TABS = ['overview','orders','repairs','quotes','memberships','rewards','wallet','addresses','bookings','account'];

function Dashboard({ user, setUser, onLogout }) {
  const [tab, setTab] = useState(() => {
    const seg = window.location.pathname.replace(/^\/+/, '').split('/')[0];
    return PORTAL_TABS.includes(seg) ? seg : 'overview';
  });

  const switchTab = (id) => {
    setTab(id);
    const target = id === 'overview' ? '/' : '/' + id;
    if (window.location.pathname !== target) window.history.pushState({}, '', target);
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
      {tab === 'orders'      && <OrdersTab />}
      {tab === 'repairs'     && <RepairsTab />}
      {tab === 'quotes'      && <QuotesTab user={user} />}
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

// ── Root ──────────────────────────────────────────────────────────────────────

function PortalApp() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const resetToken = new URLSearchParams(window.location.search).get('reset');

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

  if (!user) return <LoginPage onLogin={setUser} />;
  return <Dashboard user={user} setUser={setUser} onLogout={() => setUser(null)} />;
}

export default PortalApp;
