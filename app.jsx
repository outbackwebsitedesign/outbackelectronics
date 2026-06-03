import React, { useState, useEffect, useMemo, useRef, useCallback, createContext, useContext } from 'react';

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

const ShopContext = createContext({});
const useShop = () => useContext(ShopContext);

// Site-level feature flags — overridden at runtime from /api/shop-info flags.
const SITE_FLAGS = Object.assign(
  { showBCorpBadge: false, showRepairOrgBadge: false },
  window.OE_FLAGS || {}
);

// Cross-site URLs — populated from /api/shop-info at runtime.
let _PORTAL_URL = 'https://portal.outbackelectronics.com.au';
let _FORUM_URL  = 'https://forum.outbackelectronics.com.au';
let _GAMES_URL  = 'https://games.outbackelectronics.com.au';
function getPortalUrl() { return _PORTAL_URL; }
function getForumUrl()  { return _FORUM_URL; }
function getGamesUrl()  { return _GAMES_URL; }

// ---------------- Scroll Reveal Hook ----------------
function useReveal(options = {}) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      if (el) el.setAttribute('data-visible', '');
      return;
    }
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { el.setAttribute('data-visible', ''); observer.disconnect(); }
    }, { threshold: 0.1, ...options });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return ref;
}
window.useReveal = useReveal;

function observeReveal() {
  if (typeof IntersectionObserver === 'undefined') {
    document.querySelectorAll('.reveal').forEach(el => el.setAttribute('data-visible', ''));
    return;
  }
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) { e.target.setAttribute('data-visible', ''); observer.unobserve(e.target); }
    });
  }, { threshold: 0.08 });
  document.querySelectorAll('.reveal:not([data-visible])').forEach(el => observer.observe(el));
}
window.observeReveal = observeReveal;

// ---------------- Search Overlay ----------------
function SearchOverlay({ go, onClose }) {
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
    ...PRIMARY_PAGES.filter(p => p.id !== 'forum-link' && p.id !== 'games-link'),
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
    if (item.id === 'forum-link') { window.location.href = getForumUrl(); return; }
    if (item.id === 'games-link') { window.location.href = getGamesUrl(); return; }
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

// ---------------- Cross-origin portal API helpers ----------------
let _portalCsrfPromise = null;
async function getPortalCsrf() {
  if (!_portalCsrfPromise) {
    _portalCsrfPromise = fetch(getPortalUrl() + '/api/csrf-token', { credentials: 'include' })
      .then(r => r.json()).then(d => d.token || '').catch(() => { _portalCsrfPromise = null; return ''; });
  }
  return _portalCsrfPromise;
}

async function portalApi(path, opts = {}) {
  const isPost = opts.method && opts.method.toUpperCase() !== 'GET';
  const csrfToken = isPost ? await getPortalCsrf() : '';
  const headers = { 'Content-Type': 'application/json', ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}) };
  return fetch(getPortalUrl() + path, { headers, credentials: 'include', ...opts })
    .then(async r => { const body = await r.json().catch(() => ({})); return { ok: r.ok, status: r.status, ...body }; });
}

// ---------------- Portal auth state ----------------
function usePortalUser() {
  const [user, setUser] = useState(undefined);
  useEffect(() => {
    fetch(getPortalUrl() + '/api/portal/auth/me', { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(d => setUser(d?.user || null))
      .catch(() => setUser(null));
  }, []);
  return user;
}

// ---------------- Account Dropdown ----------------
function AccountDropdown({ go, onClose, user }) {
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
          onClick={() => goPage('register')}>
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

// ---------------- Brand Mark ----------------
function Logo({ onClick }) {
  return (
    <div className="logo" onClick={onClick}>
      <div className="logo-mark">
        <img src="assets/logo.webp" alt="Outback Electronics" />
      </div>
      <div className="logo-text">
        <div className="sub">Est. 2023 · Appointment only</div>
      </div>
    </div>
  );
}

// ---------------- Nav ----------------
const PRIMARY_PAGES = [
  { id: 'home', label: 'Home' },
  { id: 'shop', label: 'Shop' },
  { id: 'services', label: 'Services' },
  { id: 'memberships', label: 'Memberships' },
  { id: 'software', label: 'Software' },
  { id: 'ewaste', label: 'eWaste' },
  { id: 'ai', label: 'AI' },
  { id: 'tutorials', label: 'Tutorials' },
  { id: 'forum-link', label: 'Forum' },
  { id: 'games-link', label: 'Games' },
  { id: 'groups', label: 'Groups' },
];
const UTILITY_PAGES = [
  { id: 'quote', label: 'Request a Quote' },
  { id: 'gift-cards', label: 'Gift Cards' },
  { id: 'sellers', label: 'Info for Sellers' },
  { id: 'sell-gear', label: 'Sell Your Gear' },
  { id: 'contact', label: 'Contact' },
  { id: 'policies', label: 'Policies' },
];
const ACCOUNT_PAGES = [
  { id: 'account', label: 'Account Dashboard' },
  { id: 'profile', label: 'Profile' },
  { id: 'subscriptions', label: 'My Subscriptions' },
  { id: 'rewards', label: 'My Rewards' },
  { id: 'wallet', label: 'My Wallet' },
  { id: 'my-groups', label: 'My Groups' },
  { id: 'orders', label: 'My Orders' },
  { id: 'addresses', label: 'My Addresses' },
  { id: 'bookings', label: 'My Bookings' },
  { id: 'logout', label: 'Log Out' },
];

function AccountPlaceholderPage({ title, portalPath }) {
  React.useEffect(() => {
    window.location.href = getPortalUrl() + portalPath;
  }, [portalPath]);
  return (
    <>
      <PageHead crumbs={['Outback', 'Account']} title={title}
        lead={`Redirecting to ${title}…`}
      />
      <section className="container" style={{paddingTop:32, paddingBottom:48}}>
        <div className="card-paper" style={{padding:24}}>
          <span className="eyebrow">ACCOUNT</span>
          <p style={{marginTop:10, color:'var(--ink-2)'}}>
            Taking you to <a href={getPortalUrl() + portalPath}>the portal</a>…
          </p>
        </div>
      </section>
    </>
  );
}

function AccountDashboardPage({ go }) {
  return (
    <>
      <PageHead crumbs={['Outback', 'Account']} title="Account Dashboard"
        lead="Manage your account, view orders, and jump to your support options."
      />
      <section className="container" style={{paddingTop:32, paddingBottom:48}}>
        <div className="grid-2" style={{gap:20}}>
          <div className="card-paper" style={{padding:24}}>
            <span className="eyebrow">ORDERS</span>
            <h3 className="serif" style={{fontSize:30, marginTop:8}}>Track recent purchases</h3>
            <p style={{marginTop:10, color:'var(--ink-2)'}}>Open your order history to check progress, invoices, and shipment updates.</p>
            <button className="btn btn-rust" style={{marginTop:16}} onClick={() => go('orders')}>Go to My Orders →</button>
          </div>
          <div className="card-paper" style={{padding:24}}>
            <span className="eyebrow">SUPPORT</span>
            <h3 className="serif" style={{fontSize:30, marginTop:8}}>Need help with an order?</h3>
            <p style={{marginTop:10, color:'var(--ink-2)'}}>Our support team can help with tracking issues, returns, or changes.</p>
            <button className="btn btn-ghost" style={{marginTop:16}} onClick={() => go('contact')}>Contact support</button>
          </div>
        </div>
      </section>
    </>
  );
}


function UtilityBar({ go }) {
  const shop = useShop();
  return (
    <div className="utility-bar">
      <div className="container">
        <div className="links">
          <span>FREE FREIGHT OVER $200 · OUTBACK NT/SA/WA</span>
        </div>
        <div className="links">
          {UTILITY_PAGES.map(p => (
            <a key={p.id} href={`/${p.id}`} onClick={(e) => { e.preventDefault(); go(p.id); }}>{p.label}</a>
          ))}
          {shop.phone && <span style={{color:'var(--ochre)'}}>{shop.phone}</span>}
        </div>
      </div>
    </div>
  );
}

function useShopInfo() {
  const [info, setInfo] = useState({ shop: {}, flags: {}, portalUrl: '', forumUrl: '', gamesUrl: '' });
  useEffect(() => {
    fetch('/api/shop-info')
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (!d) return;
        if (d.portalUrl) _PORTAL_URL = d.portalUrl;
        if (d.forumUrl)  _FORUM_URL  = d.forumUrl;
        if (d.gamesUrl)  _GAMES_URL  = d.gamesUrl;
        setInfo({
          shop: d.shop || {},
          flags: d.flags || {},
          portalUrl: d.portalUrl || _PORTAL_URL,
          forumUrl: d.forumUrl || _FORUM_URL,
          gamesUrl: d.gamesUrl || _GAMES_URL,
        });
      })
      .catch(() => {});
  }, []);
  return info;
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

function TopNav({ page, go, cart, onSearchOpen, accountOpen, setAccountOpen, portalUser }) {
  const announcement = useAnnouncement();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const signedOut = portalUser === null;
  const [scrolled, setScrolled] = useState(false);
  const prevCartRef = useRef(cart);
  const [cartPopped, setCartPopped] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (cart > prevCartRef.current) {
      setCartPopped(true);
      const t = setTimeout(() => setCartPopped(false), 400);
      return () => clearTimeout(t);
    }
    prevCartRef.current = cart;
  }, [cart]);

  const handleNavClick = (id) => {
    setMobileMenuOpen(false);
    if (id === 'forum-link') window.location.href = getForumUrl();
    else if (id === 'games-link') window.location.href = getGamesUrl();
    else go(id);
  };

  return (
    <header>
      {announcement && <div className="announce">{announcement}</div>}
      <UtilityBar go={go} />
      <div className={scrolled ? 'topnav scrolled' : 'topnav'}>
        <div className="container row">
          <Logo onClick={() => go('home')} />
          <nav className="mainlinks">
            {PRIMARY_PAGES.map(p => (
              <a
                key={p.id}
                href={p.id === 'forum-link' ? getForumUrl() : p.id === 'games-link' ? getGamesUrl() : `/${p.id}`}
                className={page === p.id ? 'active' : ''}
                onClick={(p.id === 'forum-link' || p.id === 'games-link') ? undefined : (e) => { e.preventDefault(); go(p.id); }}
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
                style={signedOut ? {display:'flex', alignItems:'center', gap:6, padding:'6px 10px', border:'1px solid var(--line)', fontSize:13} : {}}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-7 8-7s8 3 8 7"/></svg>
                {signedOut && <span className="sign-in-text" style={{whiteSpace:'nowrap'}}>Sign In</span>}
              </button>
              {accountOpen && <AccountDropdown go={go} onClose={() => setAccountOpen(false)} user={portalUser} />}
            </div>
            <button className="icon-btn" title="Cart" aria-label={cart > 0 ? `Cart, ${cart} item${cart === 1 ? '' : 's'}` : 'Cart'} onClick={() => go('cart')}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M3 4h2l2.5 12h11l2-9H6"/><circle cx="9" cy="20" r="1.5"/><circle cx="18" cy="20" r="1.5"/></svg>
              {cart > 0 && <span className={`cart-count${cartPopped ? ' popped' : ''}`} aria-hidden="true">{cart}</span>}
            </button>
            {/* Hamburger — hidden on desktop via CSS, shown on mobile */}
            <button className="icon-btn hamburger" style={{display:'none'}} title="Menu" aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'} aria-expanded={mobileMenuOpen} aria-controls="mobile-nav" onClick={() => setMobileMenuOpen(o => !o)}>
              {mobileMenuOpen
                ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
                : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 12h18M3 6h18M3 18h18"/></svg>
              }
            </button>
          </div>
        </div>
      </div>
      {/* Mobile nav drawer — hidden on desktop via CSS */}
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
              href={p.id === 'forum-link' ? getForumUrl() : p.id === 'games-link' ? getGamesUrl() : `/${p.id}`}
              className={page === p.id ? 'active' : ''}
              onClick={(p.id === 'forum-link' || p.id === 'games-link') ? undefined : (e) => { e.preventDefault(); handleNavClick(p.id); }}
              {...((p.id === 'forum-link' || p.id === 'games-link') ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
              {p.label}
            </a>
          ))}
          <div style={{borderTop:'2px solid var(--line)', marginTop:8}}>
            {UTILITY_PAGES.map(p => (
              <a key={p.id} href={`/${p.id}`} className={page === p.id ? 'active' : ''}
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

// ---------------- Footer ----------------
function Footer({ go }) {
  const shop = useShop();
  const renderFooterLink = (item) => {
    if (item.filterType === 'page') {
      return <a href={`/${item.filterValue}`} onClick={(e) => { e.preventDefault(); go(item.filterValue); }}>{item.label}</a>;
    } else if (item.filterType === 'category') {
      return <a href="/shop" onClick={(e) => { e.preventDefault(); go('shop', { initialCat: item.filterValue }); }}>{item.label}</a>;
    } else if (item.filterType === 'cond') {
      return <a href="/shop" onClick={(e) => { e.preventDefault(); go('shop', { initialCond: item.filterValue }); }}>{item.label}</a>;
    }
    return <a href={item.href || '#'}>{item.label}</a>;
  };

  return (
    <footer>
      <div className="container">
        <div className="grid">
          <div>
            <div className="logo">
              <div className="logo-mark sm" style={{background:'#000'}}>
                <img src="assets/logo.webp" alt="Outback Electronics" />
              </div>
              <div className="logo-text">
                <div className="sub" style={{color:'var(--ochre)'}}>{shop.tagline}</div>
              </div>
            </div>
            <p style={{marginTop: 18, fontSize: 13, color: 'var(--ink-3)', maxWidth: 360, lineHeight: 1.6}}>
              {shop.description}
            </p>
          </div>
          <div>
            <h5>Shop</h5>
            <ul>
              {(shop.footerCategories || []).map((item, i) => (
                <li key={i}>{renderFooterLink(item)}</li>
              ))}
            </ul>
          </div>
          <div>
            <h5>Services</h5>
            <ul>
              <li><a href="/services" onClick={(e) => { e.preventDefault(); go('services'); }}>Field Repair</a></li>
              <li><a href="/software" onClick={(e) => { e.preventDefault(); go('software'); }}>Software</a></li>
              <li><a href="/ai" onClick={(e) => { e.preventDefault(); go('ai'); }}>Edge AI</a></li>
              <li><a href="/ewaste" onClick={(e) => { e.preventDefault(); go('ewaste'); }}>eWaste Take-back</a></li>
              <li><a href="/quote" onClick={(e) => { e.preventDefault(); go('quote'); }}>Get a Quote</a></li>
            </ul>
          </div>
          <div>
            <h5>Community</h5>
            <ul>
              <li><a href="/tutorials" onClick={(e) => { e.preventDefault(); go('tutorials'); }}>Tutorials</a></li>
              <li><a href="/groups" onClick={(e) => { e.preventDefault(); go('groups'); }}>Groups</a></li>
              <li><a href="/memberships" onClick={(e) => { e.preventDefault(); go('memberships'); }}>Memberships</a></li>
              <li><a href="/sellers" onClick={(e) => { e.preventDefault(); go('sellers'); }}>Info for Sellers</a></li>
              <li><a href="/sell-gear" onClick={(e) => { e.preventDefault(); go('sell-gear'); }}>Sell Your Gear</a></li>
            </ul>
          </div>
          <div>
            <h5>Visit</h5>
            <ul style={{color:'var(--ink-3)'}}>
              <li>{shop.address}<br/>No public access, arrive by appointment only.</li>
              {shop.phone && <li>{shop.phone}</li>}
              <li><a href="/contact" onClick={(e) => { e.preventDefault(); go('contact'); }} style={{color:'var(--ochre)'}}>Get directions →</a></li>
            </ul>
          </div>
        </div>
        <div className="baseline">
          <span>© 2023–2026 {shop.tradingName}{shop.abn ? ` · ABN ${shop.abn}` : ''}</span>
          <span>ACKNOWLEDGES THE ARRERNTE PEOPLE AS TRADITIONAL OWNERS OF MPARNTWE</span>
        </div>
      </div>
    </footer>
  );
}

// ---------------- Page Head helper ----------------
function PageHead({ crumbs, title, lead, kicker }) {
  return (
    <div className="page-head">
      <div className="container">
        <div className="crumbs eyebrow">
          {crumbs.map((c, i) => (
            <React.Fragment key={i}>
              <span>{c}</span>
              {i < crumbs.length - 1 && <span style={{color:'var(--ink-3)'}}>/</span>}
            </React.Fragment>
          ))}
        </div>
        <h1 data-screen-label={title}>{title}</h1>
        {lead && <p className="lead">{lead}</p>}
        {kicker && <div style={{marginTop:18}}>{kicker}</div>}
      </div>
    </div>
  );
}

// ---------------- Tweaks ----------------
const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "palette": ["#1f88f5","#d39a37","#4f6b3e"],
  "showAnnounce": true,
  "density": "comfortable"
}/*EDITMODE-END*/;

function ApplyTweaks({ tweaks }) {
  useEffect(() => {
    const root = document.documentElement;
    if (Array.isArray(tweaks.palette)) {
      root.style.setProperty('--rust', tweaks.palette[0]);
      root.style.setProperty('--ochre', tweaks.palette[1]);
      root.style.setProperty('--eucalyptus', tweaks.palette[2]);
    }
    const ann = document.querySelector('.announce');
    if (ann) ann.style.display = tweaks.showAnnounce ? 'block' : 'none';
    document.body.style.fontSize = tweaks.density === 'cozy' ? '14px' : '15px';
  }, [tweaks]);
  return null;
}

function TweaksUI() {
  const { TweaksPanel, TweakSection, TweakColor, TweakToggle, TweakRadio, useTweaks } = window;
  const [tweaks, setTweak] = useTweaks(TWEAK_DEFAULTS);
  return (
    <>
      <ApplyTweaks tweaks={tweaks} />
      <TweaksPanel title="Tweaks">
        <TweakSection title="Palette">
          <TweakColor
            label="Accent palette"
            value={tweaks.palette}
            onChange={(v) => setTweak('palette', v)}
            options={[
              ['#1f88f5','#d39a37','#4f6b3e'],
              ['#b9531f','#d39a37','#4f6b3e'],
              ['#2f6986','#d39a37','#b9531f'],
              ['#1f1a14','#d39a37','#1f88f5'],
            ]}
          />
        </TweakSection>
        <TweakSection title="Layout">
          <TweakToggle label="Show top announcement" value={tweaks.showAnnounce} onChange={(v) => setTweak('showAnnounce', v)} />
          <TweakRadio
            label="Density"
            value={tweaks.density}
            onChange={(v) => setTweak('density', v)}
            options={[
              { value: 'comfortable', label: 'Comfortable' },
              { value: 'cozy', label: 'Cozy' },
            ]}
          />
        </TweakSection>
      </TweaksPanel>
    </>
  );
}

// ---------------- Order Success / Cancelled ----------------

function OrderSuccessPage({ go }) {
  const [session, setSession] = useState(null);
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const sid = params.get('session_id');
    const orderId = params.get('order_id');
    if (orderId) {
      // Fully covered by gift card — no Stripe session
      setSession({ customerEmail: null, amountAud: 0, orderId });
      return;
    }
    if (!sid) return;
    fetch(`/api/checkout/session?id=${encodeURIComponent(sid)}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setSession(d); })
      .catch(() => {});
  }, []);

  return (
    <div style={{minHeight:'60vh', display:'grid', placeItems:'center', padding:32}}>
      <div style={{maxWidth:520, textAlign:'center', display:'grid', gap:20}}>
        <div style={{fontSize:56}}>✓</div>
        <h1 className="serif" style={{fontSize:40, fontWeight:400}}>Order confirmed</h1>
        <p style={{color:'var(--ink-2)', lineHeight:1.7}}>
          {session?.customerEmail
            ? <>Thanks{session.customerName ? `, ${session.customerName}` : ''}! A confirmation has been sent to <strong>{session.customerEmail}</strong>.</>
            : 'Thanks for your order! Your payment was received successfully.'}
        </p>
        {session?.amountAud && (
          <div style={{padding:'14px 24px', background:'var(--paper)', border:'1px solid var(--line)', display:'inline-block', margin:'0 auto'}}>
            <div className="mono" style={{fontSize:11, color:'var(--ink-2)', marginBottom:4}}>AMOUNT PAID</div>
            <div className="serif" style={{fontSize:32}}>${Number(session.amountAud).toLocaleString('en-AU', {minimumFractionDigits:2})}</div>
          </div>
        )}
        <p style={{fontSize:13, color:'var(--ink-3)'}}>
          Your order has been logged and our team will be in touch. For pickups or repairs, please bring this confirmation.
        </p>
        <div style={{display:'flex', gap:12, justifyContent:'center', flexWrap:'wrap'}}>
          <button className="btn btn-rust" onClick={() => go('shop')}>Continue shopping</button>
          <button className="btn btn-ghost" onClick={() => go('home')}>Back to home</button>
        </div>
      </div>
    </div>
  );
}

function OrderCancelledPage({ go }) {
  return (
    <div style={{minHeight:'60vh', display:'grid', placeItems:'center', padding:32}}>
      <div style={{maxWidth:480, textAlign:'center', display:'grid', gap:20}}>
        <div style={{fontSize:56}}>✕</div>
        <h1 className="serif" style={{fontSize:40, fontWeight:400}}>Payment cancelled</h1>
        <p style={{color:'var(--ink-2)', lineHeight:1.7}}>
          No charge was made. If you had trouble checking out or want to pay another way, get in touch and we'll sort it out.
        </p>
        <div style={{display:'flex', gap:12, justifyContent:'center', flexWrap:'wrap'}}>
          <button className="btn btn-rust" onClick={() => go('shop')}>Back to shop</button>
          <button className="btn btn-ghost" onClick={() => go('contact')}>Contact us</button>
        </div>
      </div>
    </div>
  );
}

// ---------------- Cart Page ----------------
function CartPage({ go, cart, removeFromCart, updateQty, clearCart, addToCart }) {
  const [checkingOut, setCheckingOut] = useState(false);
  const [error, setError] = useState(null);
  const [gcInput, setGcInput] = useState('');
  const [gc, setGc] = useState(null); // { code, balance, discount }
  const [gcError, setGcError] = useState(null);
  const [gcLoading, setGcLoading] = useState(false);
  const [rewardsEmail, setRewardsEmail] = useState('');
  const [rewardsPassword, setRewardsPassword] = useState('');
  const [rewardsData, setRewardsData] = useState(null); // { points, token, displayName }
  const [rewardsLoading, setRewardsLoading] = useState(true);
  const [rewardsError, setRewardsError] = useState(null);
  const [rewardsApply, setRewardsApply] = useState(false);
  const [shareLink, setShareLink] = useState(null);
  const [sharing, setSharing] = useState(false);
  const [shareError, setShareError] = useState(null);
  const [loadingShared, setLoadingShared] = useState(false);
  const [sharedLoaded, setSharedLoaded] = useState(false);
  const [postcodeInput, setPostcodeInput] = useState('');
  const [shippingQuote, setShippingQuote] = useState(null); // { services, fromPostcode, toPostcode, totalWeightKg }
  const [shippingLoading, setShippingLoading] = useState(false);
  const [shippingError, setShippingError] = useState(null);
  const [selectedShipping, setSelectedShipping] = useState(null); // { code, name, price }

  // Reset shipping quote when cart contents change
  useEffect(() => {
    setShippingQuote(null);
    setSelectedShipping(null);
    setShippingError(null);
  }, [cart.map(i => `${i.id||i.sku}:${i.qty}`).join(',')]);

  // Load a shared cart from ?share=<id> on first render
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const shareId = params.get('share');
    if (!shareId || !/^[0-9a-f]{8}$/.test(shareId)) return;
    setLoadingShared(true);
    fetch(`/api/cart/${shareId}`)
      .then(r => r.json())
      .then(data => {
        if (data.items) {
          data.items.forEach(item => addToCart(item));
          setSharedLoaded(true);
          // Clean the URL without reloading
          window.history.replaceState({}, '', '/cart');
        }
      })
      .catch(() => {})
      .finally(() => setLoadingShared(false));
  }, []);

  const shareCart = async () => {
    setSharing(true);
    setShareError(null);
    setShareLink(null);
    try {
      const resp = await fetch('/api/cart/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': getCsrf() },
        body: JSON.stringify({ items: cart }),
      });
      const data = await resp.json();
      if (data.id) {
        const link = `${location.origin}/cart?share=${data.id}`;
        setShareLink(link);
        try { await navigator.clipboard.writeText(link); } catch {}
      } else {
        setShareError('Could not create share link. Please try again.');
      }
    } catch {
      setShareError('Could not create share link. Please try again.');
    } finally {
      setSharing(false);
    }
  };

  const subtotal = cart.reduce((s, i) => s + i.price * i.qty, 0);
  const discount = gc ? gc.discount : 0;
  const shippingCost = selectedShipping ? selectedShipping.price : 0;
  const preRewardsTotal = Math.max(0, subtotal + shippingCost - discount);
  const rewardsPointsToRedeem = (rewardsData && rewardsApply) ? Math.min(rewardsData.points, Math.round(preRewardsTotal * 100)) : 0;
  const rewardsDollars = rewardsPointsToRedeem / 100;
  const total = Math.max(0, preRewardsTotal - rewardsDollars);

  const getShippingQuote = async () => {
    const pc = postcodeInput.trim();
    if (!/^\d{4}$/.test(pc)) { setShippingError('Enter a valid 4-digit Australian postcode.'); return; }
    setShippingLoading(true);
    setShippingError(null);
    setShippingQuote(null);
    setSelectedShipping(null);
    try {
      const items = cart.map(i => ({ productId: i.id || i.sku || '', quantity: i.qty }));
      const resp = await fetch('/api/shipping/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': getCsrf() },
        body: JSON.stringify({ toPostcode: pc, items }),
      });
      const data = await resp.json();
      if (!resp.ok) { setShippingError(data.message || 'Could not get shipping quote.'); return; }
      if (data.digital) { setShippingQuote({ services: [], digital: true, toPostcode: pc }); return; }
      if (!data.services || data.services.length === 0) { setShippingError('No shipping services available for that postcode.'); return; }
      setShippingQuote(data);
      setSelectedShipping(data.services[0]);
    } catch {
      setShippingError('Could not connect to shipping service. Please try again.');
    } finally {
      setShippingLoading(false);
    }
  };

  const applyGiftCard = async () => {
    const code = gcInput.trim().toUpperCase();
    if (!code) return;
    setGcLoading(true);
    setGcError(null);
    try {
      const resp = await fetch('/api/gift-card/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': getCsrf() },
        body: JSON.stringify({ code, cartTotal: subtotal + shippingCost }),
      });
      const data = await resp.json();
      if (data.valid) { setGc(data); setGcError(null); }
      else setGcError(data.message || 'Invalid gift card code.');
    } catch {
      setGcError('Could not validate gift card. Please try again.');
    } finally {
      setGcLoading(false);
    }
  };

  const removeGiftCard = () => { setGc(null); setGcInput(''); setGcError(null); };

  // Auto-load rewards if portal session is active
  useEffect(() => {
    fetch('/api/rewards/me', { credentials: 'include' })
      .then(r => r.json())
      .then(d => { if (d.loggedIn) { setRewardsData(d); setRewardsApply(d.points > 0); } })
      .catch(() => {})
      .finally(() => setRewardsLoading(false));
  }, []);

  const lookupRewards = async () => {
    if (!rewardsEmail.trim() || !rewardsPassword) return;
    setRewardsLoading(true);
    setRewardsError(null);
    try {
      await ensureCsrf();
      const resp = await fetch('/api/rewards/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': getCsrf() },
        body: JSON.stringify({ email: rewardsEmail.trim(), password: rewardsPassword }),
      });
      const data = await resp.json();
      if (!resp.ok) { setRewardsError(data.message || 'Could not verify account.'); return; }
      setRewardsData(data);
      setRewardsApply(data.points > 0);
    } catch {
      setRewardsError('Could not connect. Please try again.');
    } finally {
      setRewardsLoading(false);
    }
  };
  const removeRewards = () => { setRewardsData(null); setRewardsEmail(''); setRewardsPassword(''); setRewardsError(null); setRewardsApply(false); };

  const checkout = async () => {
    if (cart.length === 0) return;
    const hasPhysical = cart.some(i => !i.digital);
    if (hasPhysical && !selectedShipping) {
      setError('Please get a shipping quote and select a shipping method before checkout.');
      return;
    }
    setCheckingOut(true);
    setError(null);
    try {
      const items = cart.map(i => ({ name: i.name, priceAud: i.price, quantity: i.qty, productId: i.id || i.sku || '' }));
      const body = { items };
      if (gc) body.giftCardCode = gc.code;
      if (rewardsData && rewardsApply && rewardsPointsToRedeem > 0) {
        body.redeemPoints = rewardsPointsToRedeem;
        body.rewardsToken = rewardsData.token;
      }
      if (selectedShipping) {
        body.shippingAmount = selectedShipping.price;
        body.shippingService = selectedShipping.name;
      }
      await ensureCsrf();
      const resp = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': getCsrf() },
        body: JSON.stringify(body),
      });
      let data;
      try { data = await resp.json(); } catch { data = {}; }
      if (data.url) { clearCart(); window.location.href = data.url; }
      else setError(data.message || 'Checkout failed. Please try again.');
    } catch (err) {
      setError('Could not connect to payment provider. Please try again.');
    } finally {
      setCheckingOut(false);
    }
  };

  if (loadingShared) {
    return (
      <>
        <PageHead crumbs={['Outback', 'Cart']} title="Your Cart" lead="Loading shared cart…" />
        <section className="container" style={{paddingTop:40, paddingBottom:56, textAlign:'center'}}>
          <p style={{color:'var(--ink-2)'}}>Please wait…</p>
        </section>
      </>
    );
  }

  if (cart.length === 0) {
    return (
      <>
        <PageHead crumbs={['Outback', 'Cart']} title="Your Cart" lead="Nothing in your cart yet." />
        <section className="container" style={{paddingTop:40, paddingBottom:56, textAlign:'center'}}>
          <p style={{color:'var(--ink-2)', marginBottom:24}}>Browse the shop and add items to get started.</p>
          <button className="btn btn-rust" onClick={() => go('shop')}>Go to Shop →</button>
        </section>
      </>
    );
  }

  return (
    <>
      <PageHead crumbs={['Outback', 'Cart']} title="Your Cart" lead={`${cart.length} item${cart.length !== 1 ? 's' : ''} ready to checkout.`} />
      <section className="container" style={{paddingTop:32, paddingBottom:56}}>
        <div className="cart-layout" style={{display:'grid', gridTemplateColumns:'1fr 320px', gap:40, alignItems:'start'}}>
          <div>
            <div style={{borderTop:'2px solid var(--ink)', marginBottom:4}}>
              <div className="cart-header-row" style={{display:'grid', gridTemplateColumns:'1fr 120px 100px 40px', padding:'10px 0', fontFamily:'JetBrains Mono,monospace', fontSize:11, letterSpacing:'.06em', color:'var(--ink-2)', borderBottom:'1px solid var(--line)'}}>
                <div>ITEM</div><div style={{textAlign:'center'}}>QTY</div><div style={{textAlign:'right'}}>PRICE</div><div />
              </div>
            </div>
            {cart.map((item) => {
              const key = item.sku || item.id || item.name;
              return (
                <div key={key} className="cart-item-row" style={{display:'grid', gridTemplateColumns:'1fr 120px 100px 40px', padding:'18px 0', borderBottom:'1px solid var(--line)', alignItems:'center', gap:8}}>
                  <div>
                    <div style={{fontWeight:600, fontSize:15}}>{item.name}</div>
                    {item.sku && <div className="mono" style={{fontSize:11, color:'var(--ink-3)', marginTop:3}}>SKU: {item.sku}</div>}
                    {item.cond && <div className="mono" style={{fontSize:11, color:'var(--ink-2)', marginTop:2}}>{item.cond}</div>}
                  </div>
                  <div style={{display:'flex', alignItems:'center', justifyContent:'center', gap:6}}>
                    <button onClick={() => updateQty(key, item.qty - 1)} style={{width:28, height:28, border:'1px solid var(--line)', background:'var(--bg-elev)', cursor:'pointer', fontSize:16, display:'flex', alignItems:'center', justifyContent:'center'}}>−</button>
                    <span className="mono" style={{fontSize:14, minWidth:20, textAlign:'center'}}>{item.qty}</span>
                    <button onClick={() => updateQty(key, item.qty + 1)} style={{width:28, height:28, border:'1px solid var(--line)', background:'var(--bg-elev)', cursor:'pointer', fontSize:16, display:'flex', alignItems:'center', justifyContent:'center'}}>+</button>
                  </div>
                  <div style={{textAlign:'right', fontFamily:'Instrument Serif,serif', fontSize:18, color:'var(--rust)'}}>
                    ${(item.price * item.qty).toLocaleString()}
                  </div>
                  <div style={{textAlign:'center'}}>
                    <button onClick={() => removeFromCart(key)} title="Remove" style={{background:'none', border:'none', cursor:'pointer', color:'var(--ink-3)', fontSize:18, lineHeight:1}}>×</button>
                  </div>
                </div>
              );
            })}
            <button className="btn btn-ghost btn-sm" onClick={() => go('shop')} style={{marginTop:18}}>← Continue Shopping</button>
          </div>

          <div style={{position:'sticky', top:24}}>
            <div className="card-paper" style={{padding:28}}>
              <div className="eyebrow" style={{marginBottom:14}}>ORDER SUMMARY</div>
              {cart.map(item => {
                const key = item.sku || item.id || item.name;
                return (
                  <div key={key} style={{display:'flex', justifyContent:'space-between', fontSize:13, marginBottom:8, color:'var(--ink-2)'}}>
                    <span>{item.name} × {item.qty}</span>
                    <span>${(item.price * item.qty).toLocaleString()}</span>
                  </div>
                );
              })}
              <hr className="thin" />

              {/* Shipping estimator */}
              {cart.some(i => !i.digital) && (
                <div style={{marginBottom:14}}>
                  <div className="mono" style={{fontSize:11, color:'var(--ink-2)', marginBottom:8}}>SHIPPING ESTIMATE</div>
                  {!shippingQuote ? (
                    <>
                      <div style={{display:'flex', gap:6}}>
                        <input
                          className="input"
                          placeholder="Your postcode"
                          value={postcodeInput}
                          maxLength={4}
                          onChange={e => { setPostcodeInput(e.target.value.replace(/\D/,'')); setShippingError(null); }}
                          onKeyDown={e => e.key === 'Enter' && getShippingQuote()}
                          style={{flex:1, fontSize:13, fontFamily:'monospace', letterSpacing:'.05em'}}
                        />
                        <button className="btn btn-ghost btn-sm" onClick={getShippingQuote} disabled={shippingLoading || postcodeInput.length !== 4}>
                          {shippingLoading ? '…' : 'Quote'}
                        </button>
                      </div>
                      {shippingError && <div style={{marginTop:6, fontSize:12, color:'#b91c1c'}}>{shippingError}</div>}
                    </>
                  ) : shippingQuote.digital ? (
                    <div style={{fontSize:12, color:'#16a34a'}}>All items are digital — no shipping required.</div>
                  ) : (
                    <div>
                      <div style={{fontSize:11, color:'var(--ink-3)', marginBottom:6}}>
                        Shipping to {shippingQuote.toPostcode} · {shippingQuote.totalWeightKg}kg
                        <button onClick={() => { setShippingQuote(null); setSelectedShipping(null); setPostcodeInput(''); }} style={{marginLeft:8, background:'none', border:'none', cursor:'pointer', color:'var(--ink-3)', fontSize:11, textDecoration:'underline', padding:0}}>Change</button>
                      </div>
                      {shippingQuote.services.map(s => (
                        <label key={s.code} style={{display:'flex', alignItems:'center', gap:8, fontSize:13, marginBottom:6, cursor:'pointer'}}>
                          <input
                            type="radio"
                            name="shippingService"
                            checked={selectedShipping?.code === s.code}
                            onChange={() => setSelectedShipping(s)}
                          />
                          <span style={{flex:1}}>{s.name}</span>
                          <span style={{fontFamily:'monospace', color:'var(--rust)'}}>${s.price.toFixed(2)}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {(discount > 0 || shippingCost > 0) && (
                <>
                  <div style={{display:'flex', justifyContent:'space-between', fontSize:13, marginBottom:6, color:'var(--ink-2)'}}>
                    <span>Subtotal</span>
                    <span>${subtotal.toLocaleString('en-AU', {minimumFractionDigits:2})}</span>
                  </div>
                  {shippingCost > 0 && (
                    <div style={{display:'flex', justifyContent:'space-between', fontSize:13, marginBottom:6, color:'var(--ink-2)'}}>
                      <span>Shipping</span>
                      <span>${shippingCost.toFixed(2)}</span>
                    </div>
                  )}
                  {discount > 0 && (
                    <div style={{display:'flex', justifyContent:'space-between', fontSize:13, marginBottom:6, color:'#16a34a'}}>
                      <span>Gift card ({gc.code})</span>
                      <span>−${discount.toLocaleString('en-AU', {minimumFractionDigits:2})}</span>
                    </div>
                  )}
                  <hr className="thin" />
                </>
              )}
              <div style={{display:'flex', justifyContent:'space-between', alignItems:'baseline', marginBottom:6}}>
                <span style={{fontSize:13, color:'var(--ink-2)'}}>Total</span>
                <span className="serif" style={{fontSize:24, color:'var(--rust)'}}>${total.toLocaleString('en-AU', {minimumFractionDigits:2})}</span>
              </div>
              {!selectedShipping && cart.some(i => !i.digital) && (
                <div className="mono" style={{fontSize:11, color:'var(--ink-3)', marginBottom:6}}>+ SHIPPING (QUOTE ABOVE)</div>
              )}

              {/* Gift card input */}
              {gc ? (
                <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', background:'#f0fdf4', border:'1px solid #86efac', padding:'8px 12px', marginBottom:14, fontSize:13}}>
                  <span style={{color:'#15803d', fontFamily:'monospace'}}>{gc.code} — ${gc.balance.toLocaleString('en-AU', {minimumFractionDigits:2})} balance</span>
                  <button onClick={removeGiftCard} style={{background:'none', border:'none', cursor:'pointer', color:'var(--ink-3)', fontSize:16, padding:0, lineHeight:1}}>×</button>
                </div>
              ) : (
                <div style={{marginBottom:14}}>
                  <div style={{display:'flex', gap:6}}>
                    <input
                      className="input"
                      placeholder="Gift card code"
                      value={gcInput}
                      onChange={e => setGcInput(e.target.value.toUpperCase())}
                      onKeyDown={e => e.key === 'Enter' && applyGiftCard()}
                      style={{flex:1, fontSize:12, fontFamily:'monospace', letterSpacing:'.05em'}}
                    />
                    <button className="btn btn-ghost btn-sm" onClick={applyGiftCard} disabled={gcLoading || !gcInput.trim()}>
                      {gcLoading ? '…' : 'Apply'}
                    </button>
                  </div>
                  {gcError && <div style={{marginTop:6, fontSize:12, color:'#b91c1c'}}>{gcError}</div>}
                </div>
              )}

              {/* Rewards points */}
              {rewardsData ? (
                <div style={{marginBottom:14, padding:'10px 14px', background:'#fffbeb', border:'1px solid #fde68a', fontSize:13}}>
                  <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:rewardsData.points > 0 ? 8 : 0}}>
                    <span style={{color:'#92400e', fontWeight:600}}>{rewardsData.displayName} — {rewardsData.points.toLocaleString('en-AU')} pts</span>
                    <button onClick={removeRewards} style={{background:'none', border:'none', cursor:'pointer', color:'var(--ink-3)', fontSize:16, padding:0, lineHeight:1}}>×</button>
                  </div>
                  {rewardsData.points > 0 && (
                    <label style={{display:'flex', alignItems:'center', gap:8, cursor:'pointer', color:'#78350f'}}>
                      <input type="checkbox" checked={rewardsApply} onChange={e => setRewardsApply(e.target.checked)} />
                      Redeem {Math.min(rewardsData.points, Math.round(preRewardsTotal * 100)).toLocaleString('en-AU')} pts (−${(Math.min(rewardsData.points, Math.round(preRewardsTotal * 100)) / 100).toLocaleString('en-AU', {minimumFractionDigits:2})})
                    </label>
                  )}
                  {rewardsData.points === 0 && <span style={{color:'#92400e'}}>No points to redeem.</span>}
                </div>
              ) : rewardsLoading ? null : (
                <div style={{marginBottom:14}}>
                  <div className="mono" style={{fontSize:10, color:'var(--ink-3)', marginBottom:6}}>HAVE AN ACCOUNT? REDEEM YOUR POINTS</div>
                  <div style={{display:'flex', gap:6, marginBottom:4}}>
                    <input className="input" placeholder="Email" type="email" value={rewardsEmail} onChange={e => setRewardsEmail(e.target.value)} style={{flex:1, fontSize:12}} />
                    <input className="input" placeholder="Password" type="password" value={rewardsPassword} onChange={e => setRewardsPassword(e.target.value)} onKeyDown={e => e.key === 'Enter' && lookupRewards()} style={{flex:1, fontSize:12}} />
                  </div>
                  <button className="btn btn-ghost btn-sm" onClick={lookupRewards} disabled={rewardsLoading || !rewardsEmail.trim() || !rewardsPassword} style={{width:'100%', justifyContent:'center'}}>
                    {rewardsLoading ? '…' : 'Check Points Balance'}
                  </button>
                  {rewardsError && <div style={{marginTop:6, fontSize:12, color:'#b91c1c'}}>{rewardsError}</div>}
                </div>
              )}

              {error && <div style={{marginBottom:12, padding:'10px 14px', background:'#fff1f0', border:'1px solid #fca5a5', fontSize:13, color:'#b91c1c'}}>{error}</div>}
              <button className="btn btn-rust" style={{width:'100%', justifyContent:'center'}} onClick={checkout} disabled={checkingOut}>
                {checkingOut ? 'Redirecting…' : `Checkout — $${total.toLocaleString('en-AU', {minimumFractionDigits:2})}${selectedShipping ? '' : cart.some(i=>!i.digital) ? ' + shipping' : ''}`}
              </button>
              <div className="mono" style={{fontSize:10, color:'var(--ink-3)', marginTop:10, textAlign:'center'}}>SECURE CHECKOUT VIA STRIPE</div>

              <hr className="thin" style={{marginTop:16, marginBottom:12}} />
              {sharedLoaded && (
                <div style={{marginBottom:10, padding:'8px 12px', background:'#f0fdf4', border:'1px solid #86efac', fontSize:12, color:'#15803d'}}>
                  Shared cart loaded successfully.
                </div>
              )}
              <button className="btn btn-ghost btn-sm" style={{width:'100%', justifyContent:'center'}} onClick={shareCart} disabled={sharing}>
                {sharing ? 'Generating link…' : 'Share this cart'}
              </button>
              {shareLink && (
                <div style={{marginTop:10}}>
                  <div style={{fontSize:11, color:'var(--ink-2)', marginBottom:4}}>Link copied to clipboard:</div>
                  <div style={{display:'flex', gap:6, alignItems:'center'}}>
                    <input readOnly value={shareLink} onClick={e => e.target.select()} style={{flex:1, fontSize:11, fontFamily:'monospace', padding:'5px 8px', border:'1px solid var(--line)', background:'var(--bg-elev)', color:'var(--ink)'}} />
                  </div>
                  <div className="mono" style={{fontSize:10, color:'var(--ink-3)', marginTop:4}}>EXPIRES IN 30 DAYS</div>
                </div>
              )}
              {shareError && <div style={{marginTop:8, fontSize:12, color:'#b91c1c'}}>{shareError}</div>}
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

// ---------------- Register Page ----------------
function RegisterPage({ go }) {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(''); setBusy(true);
    const r = await portalApi('/api/portal/auth/register', {
      method: 'POST',
      body: JSON.stringify({ firstName, lastName, email, phone, address, username, password }),
    });
    setBusy(false);
    if (r.ok) {
      window.location.href = getPortalUrl();
    } else {
      setError(r.message || 'Registration failed. Please try again.');
    }
  }

  const fieldStyle = { display:'flex', flexDirection:'column', gap:4, marginBottom:16 };
  const labelStyle = { fontSize:11, fontWeight:700, letterSpacing:'0.06em', color:'var(--ink-2)', textTransform:'uppercase' };
  const inputStyle = { padding:'10px 12px', border:'1px solid var(--line)', borderRadius:6, fontSize:14, fontFamily:'inherit', color:'var(--ink)', background:'var(--bg)', outline:'none', width:'100%', boxSizing:'border-box' };

  return (
    <>
      <PageHead crumbs={['Outback', 'Create Account']} title="Create an Account"
        lead="Sign up once and use the same account across the portal, forum, and more."
      />
      <section className="container" style={{paddingTop:32, paddingBottom:64}}>
        <div style={{maxWidth:560, margin:'0 auto'}}>
          <div className="card-paper" style={{padding:32}}>
            {error && (
              <div style={{background:'#fee2e2', border:'1px solid #fca5a5', color:'#991b1b', borderRadius:6, padding:'10px 14px', marginBottom:20, fontSize:13}}>
                {error}
              </div>
            )}
            <form onSubmit={handleSubmit}>
              <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:16}}>
                <label style={fieldStyle}>
                  <span style={labelStyle}>First name</span>
                  <input style={inputStyle} type="text" value={firstName} autoComplete="given-name" onChange={e => setFirstName(e.target.value)} required />
                </label>
                <label style={fieldStyle}>
                  <span style={labelStyle}>Last name</span>
                  <input style={inputStyle} type="text" value={lastName} autoComplete="family-name" onChange={e => setLastName(e.target.value)} required />
                </label>
              </div>
              <label style={fieldStyle}>
                <span style={labelStyle}>Email address</span>
                <input style={inputStyle} type="email" value={email} autoComplete="email" onChange={e => setEmail(e.target.value)} required />
              </label>
              <label style={fieldStyle}>
                <span style={labelStyle}>Phone number</span>
                <input style={inputStyle} type="tel" value={phone} autoComplete="tel" onChange={e => setPhone(e.target.value)} />
              </label>
              <label style={fieldStyle}>
                <span style={labelStyle}>Address</span>
                <input style={inputStyle} type="text" value={address} autoComplete="street-address" onChange={e => setAddress(e.target.value)} />
              </label>
              <label style={fieldStyle}>
                <span style={labelStyle}>Username</span>
                <input style={inputStyle} type="text" value={username} autoComplete="username" onChange={e => setUsername(e.target.value)} required />
                <span style={{fontSize:11, color:'var(--ink-3)'}}>3–30 characters · letters, numbers and underscores</span>
              </label>
              <label style={fieldStyle}>
                <span style={labelStyle}>Password</span>
                <input style={inputStyle} type="password" value={password} autoComplete="new-password" onChange={e => setPassword(e.target.value)} required />
                <span style={{fontSize:11, color:'var(--ink-3)'}}>Minimum 8 characters</span>
              </label>
              <button className="btn btn-rust" type="submit" disabled={busy} style={{width:'100%', justifyContent:'center', marginTop:8}}>
                {busy ? 'Creating account…' : 'Create account →'}
              </button>
            </form>
            <div style={{marginTop:20, textAlign:'center', fontSize:13, color:'var(--ink-2)'}}>
              Already have an account?{' '}
              <button onClick={() => { window.location.href = getPortalUrl(); }}
                style={{background:'none', border:'none', color:'var(--rust)', cursor:'pointer', fontWeight:600, fontSize:13, fontFamily:'inherit', padding:0}}>
                Sign in →
              </button>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

// ---------------- Router ----------------
const KNOWN_PAGES = [...PRIMARY_PAGES, ...UTILITY_PAGES, ...ACCOUNT_PAGES, {id:'cart'}, {id:'order-success'}, {id:'order-cancelled'}, {id:'register'}, {id:'about'}, {id:'repairs'}, {id:'humanly-ai'}].map(p => p.id);

function App() {
  useEffect(() => { ensureCsrf(); }, []);

  // Button ripple effect via event delegation
  useEffect(() => {
    const handler = (e) => {
      const btn = e.target.closest('.btn');
      if (!btn) return;
      const rect = btn.getBoundingClientRect();
      const size = Math.max(rect.width, rect.height) * 2;
      const x = e.clientX - rect.left - size / 2;
      const y = e.clientY - rect.top - size / 2;
      const ripple = document.createElement('span');
      ripple.className = 'btn-ripple';
      ripple.style.cssText = `width:${size}px;height:${size}px;left:${x}px;top:${y}px`;
      btn.appendChild(ripple);
      ripple.addEventListener('animationend', () => ripple.remove(), { once: true });
    };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, []);

  const PAGE_ALIASES_INIT = { repairs: 'services' };
  const [page, setPage] = useState(() => {
    const path = location.pathname.replace(/^\/+/, '');
    if (path.startsWith('product/')) return 'product';
    if (path.startsWith('service/')) return 'service';
    const resolved = PAGE_ALIASES_INIT[path] || path;
    return KNOWN_PAGES.includes(resolved) ? resolved : 'home';
  });
  const [pageParams, setPageParams] = useState(null);

  // Resolve deep-linked product/service on first load
  useEffect(() => {
    const path = location.pathname.replace(/^\/+/, '');
    if (path.startsWith('product/') && !pageParams) {
      const id = decodeURIComponent(path.slice('product/'.length));
      fetch('/api/catalog/products').then(r => r.json()).then(d => {
        const p = (d.items || []).find(x => x.sku === id || String(x.id) === id || x.slug === id);
        if (p) setPageParams(p);
      }).catch(() => {});
    } else if (path.startsWith('service/') && !pageParams) {
      const id = decodeURIComponent(path.slice('service/'.length));
      fetch('/api/catalog/services').then(r => r.json()).then(d => {
        const s = (d.items || []).find(x => String(x.id) === id || x.slug === id);
        if (s) setPageParams(s);
      }).catch(() => {});
    }
  }, []);
  const [cart, setCart] = useState(() => {
    try { return JSON.parse(localStorage.getItem('oe_cart') || '[]'); } catch { return []; }
  });
  const [searchOpen, setSearchOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const { shop, flags, portalUrl, forumUrl } = useShopInfo();
  const portalUser = usePortalUser();
  const resolvedFlags = useMemo(() => Object.assign({}, SITE_FLAGS, flags), [flags]);
  const siteUrls = useMemo(() => ({
    portal: portalUrl || 'https://portal.outbackelectronics.com.au',
    forum: forumUrl || 'https://forum.outbackelectronics.com.au',
  }), [portalUrl, forumUrl]);

  useEffect(() => {
    let target = `/${page}`;
    if (page === 'product' && pageParams) {
      const id = pageParams.sku || pageParams.id || pageParams.slug;
      if (id) target = `/product/${encodeURIComponent(id)}`;
    } else if (page === 'service' && pageParams) {
      const id = pageParams.id || pageParams.slug;
      if (id) target = `/service/${encodeURIComponent(id)}`;
    }
    if (location.pathname !== target) window.history.pushState({}, '', target);
    window.scrollTo({top:0});
    // Observe newly mounted reveal elements after a short delay (wait for render)
    const t = setTimeout(observeReveal, 80);
    return () => clearTimeout(t);
  }, [page, pageParams]);

  useEffect(() => {
    const onPop = () => {
      const path = location.pathname.replace(/^\/+/, '');
      if (path.startsWith('product/')) { setPage('product'); setPageParams(null); return; }
      if (path.startsWith('service/')) { setPage('service'); setPageParams(null); return; }
      if (KNOWN_PAGES.includes(path)) setPage(path);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  useEffect(() => {
    localStorage.setItem('oe_cart', JSON.stringify(cart));
  }, [cart]);

  const PAGE_ALIASES = { repairs: 'services' };
  const go = (id, params = null) => { setPage(PAGE_ALIASES[id] || id); setPageParams(params); };

  const addToCart = (item) => {
    const key = item.sku || item.id || item.name;
    setCart(prev => {
      const existing = prev.find(i => (i.sku || i.id || i.name) === key);
      if (existing) return prev.map(i => (i.sku || i.id || i.name) === key ? { ...i, qty: i.qty + 1 } : i);
      return [...prev, { ...item, qty: 1 }];
    });
  };
  const removeFromCart = (key) => setCart(prev => prev.filter(i => (i.sku || i.id || i.name) !== key));
  const updateQty = (key, qty) => {
    if (qty < 1) { removeFromCart(key); return; }
    setCart(prev => prev.map(i => (i.sku || i.id || i.name) === key ? { ...i, qty } : i));
  };
  const clearCart = () => setCart([]);
  const cartCount = cart.reduce((s, i) => s + i.qty, 0);

  const PAGES = window.OE_PAGES || {};
  const PageComponent = PAGES[page] || PAGES.home;

  const shopCtxValue = useMemo(
    () => ({ ...shop, _flags: resolvedFlags, _portalUrl: siteUrls.portal, _forumUrl: siteUrls.forum }),
    [shop, resolvedFlags, siteUrls]
  );

  // Admin uses its own full-bleed chrome — no public nav/footer/tweaks
  if (page === 'admin') {
    return <ShopContext.Provider value={shopCtxValue}><PageComponent go={go} /></ShopContext.Provider>;
  }

  const [showBackTop, setShowBackTop] = useState(false);
  useEffect(() => {
    const onScroll = () => setShowBackTop(window.scrollY > 600);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <ShopContext.Provider value={shopCtxValue}>
      <TopNav page={page} go={go} cart={cartCount} onSearchOpen={() => setSearchOpen(true)} accountOpen={accountOpen} setAccountOpen={setAccountOpen} portalUser={portalUser} />
      <main id="main-content">
        <div key={page} className="page-in">
          <PageComponent go={go} addToCart={addToCart} pageParams={pageParams} cart={cart} removeFromCart={removeFromCart} updateQty={updateQty} clearCart={clearCart} portalUser={portalUser} />
        </div>
      </main>
      <Footer go={go} />
      <TweaksUI />
      {searchOpen && <SearchOverlay go={go} onClose={() => setSearchOpen(false)} />}
      {showBackTop && (
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          aria-label="Back to top"
          style={{position:'fixed', bottom:24, right:24, zIndex:400, width:44, height:44, background:'var(--ink)', color:'var(--paper)', border:'none', cursor:'pointer', display:'grid', placeItems:'center', boxShadow:'0 4px 16px rgba(0,0,0,.25)', transition:'opacity 120ms'}}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 19V5M5 12l7-7 7 7"/></svg>
        </button>
      )}
    </ShopContext.Provider>
  );
}

// Expose helpers globally
window.__ShopContext__ = ShopContext;
Object.assign(window, { PageHead, PRIMARY_PAGES, UTILITY_PAGES });
window.OE_PAGES = Object.assign(window.OE_PAGES || {}, {
  register: RegisterPage,
  account: AccountDashboardPage,
  orders: () => <AccountPlaceholderPage title="My Orders" portalPath="/orders" />,
  profile: () => <AccountPlaceholderPage title="Profile" portalPath="/profile" />,
  subscriptions: () => <AccountPlaceholderPage title="My Subscriptions" portalPath="/subscriptions" />,
  rewards: () => <AccountPlaceholderPage title="My Rewards" portalPath="/rewards" />,
  wallet: () => <AccountPlaceholderPage title="My Wallet" portalPath="/wallet" />,
  'my-groups': () => <AccountPlaceholderPage title="My Groups" portalPath="/my-groups" />,
  addresses: () => <AccountPlaceholderPage title="My Addresses" portalPath="/addresses" />,
  bookings: () => <AccountPlaceholderPage title="My Bookings" portalPath="/bookings" />,
  logout: () => <AccountPlaceholderPage title="Log Out" portalPath="/logout" />,
  'order-success': OrderSuccessPage,
  'order-cancelled': OrderCancelledPage,
  cart: CartPage,
});

export default App;
