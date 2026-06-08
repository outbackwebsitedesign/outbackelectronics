import React, { useState, useEffect, useMemo, useRef, useCallback, createContext, useContext } from 'react';
import { getCsrf, ensureCsrf, makePortalHelpers } from './src/lib/api.js';

const ShopContext = createContext({});
const useShop = () => useContext(ShopContext);

// Site-level feature flags — overridden at runtime from /api/shop-info flags.
const SITE_FLAGS = Object.assign(
  { showBCorpBadge: false, showRepairOrgBadge: false },
  window.OE_FLAGS || {}
);

// Cross-site URLs — populated from /api/shop-info at runtime.
let _PORTAL_URL = 'https://portal.outbackelectronics.com.au';
let _GAMES_URL  = 'https://games.outbackelectronics.com.au';
let _TOOLS_URL  = 'https://tools.outbackelectronics.com.au';
function getPortalUrl() { return _PORTAL_URL; }
function getGamesUrl()  { return _GAMES_URL; }
function getToolsUrl()  { return _TOOLS_URL; }

const { portalApi, usePortalUser } = makePortalHelpers(getPortalUrl);

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

// ---------------- Brand Mark ----------------
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
  { id: 'tools-link', label: 'Tools' },
  { id: 'forum-link', label: 'Forum' },
  { id: 'games-link', label: 'Games' },
  { id: 'groups', label: 'Groups' },
];
// Pages served from their own subdomain (tools./forum./games.) — clicking these
// navigates the browser to the external service rather than SPA-routing.
const FORUM_URL = 'https://forum.outbackelectronics.com.au';
const EXTERNAL_LINKS = {
  'forum-link': () => FORUM_URL,
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
  const [info, setInfo] = useState({ shop: {}, flags: {}, portalUrl: '', gamesUrl: '' });
  useEffect(() => {
    fetch('/api/shop-info')
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (!d) return;
        if (d.portalUrl) _PORTAL_URL = d.portalUrl;
        if (d.gamesUrl)  _GAMES_URL  = d.gamesUrl;
        if (d.toolsUrl)  _TOOLS_URL  = d.toolsUrl;
        setInfo({
          shop: d.shop || {},
          flags: d.flags || {},
          portalUrl: d.portalUrl || _PORTAL_URL,
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
    if (isExternalLink(id)) window.location.href = externalHref(id);
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
                href={isExternalLink(p.id) ? externalHref(p.id) : `/${p.id}`}
                className={page === p.id ? 'active' : ''}
                onClick={isExternalLink(p.id) ? undefined : (e) => { e.preventDefault(); go(p.id); }}
                {...(isExternalLink(p.id) ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
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
              href={isExternalLink(p.id) ? externalHref(p.id) : `/${p.id}`}
              className={page === p.id ? 'active' : ''}
              onClick={isExternalLink(p.id) ? undefined : (e) => { e.preventDefault(); handleNavClick(p.id); }}
              {...(isExternalLink(p.id) ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
              {p.label}
            </a>
          ))}
          <div className="mobile-nav-utils">
            {UTILITY_PAGES.map(p => (
              <a key={p.id} href={`/${p.id}`} className={page === p.id ? 'active' : ''}
                onClick={(e) => { e.preventDefault(); handleNavClick(p.id); }}>
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

const _noopTweaks = (d) => [d, () => {}];
function TweaksUI() {
  const { TweaksPanel, TweakSection, TweakColor, TweakToggle, TweakRadio, useTweaks } = window;
  const [tweaks, setTweak] = (useTweaks || _noopTweaks)(TWEAK_DEFAULTS);
  if (!TweaksPanel) return null;
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
// ---------------- Router ----------------
const KNOWN_PAGES = [...PRIMARY_PAGES, ...UTILITY_PAGES, ...ACCOUNT_PAGES, {id:'cart'}, {id:'order-success'}, {id:'order-cancelled'}, {id:'register'}, {id:'about'}, {id:'repairs'}, {id:'humanly-ai'}].map(p => p.id);

function App() {
  useEffect(() => { ensureCsrf(); }, []);

  // Re-render when deferred page chunks register themselves
  const [, forcePageUpdate] = useState(0);
  useEffect(() => {
    const handler = () => forcePageUpdate(n => n + 1);
    window.addEventListener('oe:pages-updated', handler);
    return () => window.removeEventListener('oe:pages-updated', handler);
  }, []);

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
    if (path.startsWith('policies/')) return 'policies';
    const resolved = PAGE_ALIASES_INIT[path] || path;
    return KNOWN_PAGES.includes(resolved) ? resolved : 'home';
  });
  const [pageParams, setPageParams] = useState(null);

  // Resolve deep-linked product/service on first load
  useEffect(() => {
    const path = location.pathname.replace(/^\/+/, '');
    if (path.startsWith('policies/') && !pageParams) {
      const slug = decodeURIComponent(path.slice('policies/'.length));
      if (slug) setPageParams({ slug });
    } else if (path.startsWith('product/') && !pageParams) {
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
  const { shop, flags, portalUrl } = useShopInfo();
  const [portalUser] = usePortalUser();
  const resolvedFlags = useMemo(() => Object.assign({}, SITE_FLAGS, flags), [flags]);
  const siteUrls = useMemo(() => ({
    portal: portalUrl || 'https://portal.outbackelectronics.com.au',
  }), [portalUrl]);

  const PAGE_TITLES = {
    home:         'Outback Electronics — Built for where the signal ends',
    shop:         'Shop — Outback Electronics',
    services:     'Services — Outback Electronics',
    memberships:  'Memberships — Outback Electronics',
    software:     'Software Library — Outback Electronics',
    ewaste:       'eWaste Take-Back — Outback Electronics',
    ai:           'Edge AI — Outback Electronics',
    tutorials:    'Tutorials — Outback Electronics',
    groups:       'Community Groups — Outback Electronics',
    quote:        'Request a Quote — Outback Electronics',
    'gift-cards': 'Gift Cards — Outback Electronics',
    sellers:      'Info for Sellers — Outback Electronics',
    contact:      'Contact — Outback Electronics',
    policies:     'Policies — Outback Electronics',
    about:        'About — Outback Electronics',
    repairs:      'Repairs — Outback Electronics',
    cart:         'Cart — Outback Electronics',
  };

  useEffect(() => {
    let target = `/${page}`;
    if (page === 'product' && pageParams) {
      const id = pageParams.sku || pageParams.id || pageParams.slug;
      if (id) target = `/product/${encodeURIComponent(id)}`;
    } else if (page === 'service' && pageParams) {
      const id = pageParams.id || pageParams.slug;
      if (id) target = `/service/${encodeURIComponent(id)}`;
    } else if (page === 'policies') {
      const slug = pageParams?.slug || 'terms-and-conditions';
      target = `/policies/${slug}`;
    }
    if (location.pathname !== target) window.history.pushState({}, '', target);
    window.scrollTo({top:0});
    // Update the browser tab title on every SPA navigation
    let title = PAGE_TITLES[page] || 'Outback Electronics';
    if (page === 'product' && pageParams?.name) title = `${pageParams.name} — Outback Electronics`;
    else if (page === 'service' && pageParams?.name) title = `${pageParams.name} — Outback Electronics`;
    document.title = title;
    // Observe newly mounted reveal elements after a short delay (wait for render)
    const t = setTimeout(observeReveal, 80);
    return () => clearTimeout(t);
  }, [page, pageParams]);

  useEffect(() => {
    const onPop = () => {
      const path = location.pathname.replace(/^\/+/, '');
      if (path.startsWith('product/')) { setPage('product'); setPageParams(null); return; }
      if (path.startsWith('service/')) { setPage('service'); setPageParams(null); return; }
      if (path.startsWith('policies/')) { setPage('policies'); setPageParams({ slug: path.slice('policies/'.length) }); return; }
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

  useEffect(() => {
    if (!PAGES[page] && window.__loadDeferredChunks) window.__loadDeferredChunks();
  }, [page]);

  const shopCtxValue = useMemo(
    () => ({ ...shop, _flags: resolvedFlags, _portalUrl: siteUrls.portal }),
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
window.__OE_HELPERS__ = { portalApi, getPortalUrl };
Object.assign(window, { PageHead, PRIMARY_PAGES, UTILITY_PAGES });
window.OE_PAGES = Object.assign(window.OE_PAGES || {}, {
  account: () => <AccountPlaceholderPage title="Account Dashboard" portalPath="/account" />,
  orders: () => <AccountPlaceholderPage title="My Orders" portalPath="/orders" />,
  profile: () => <AccountPlaceholderPage title="Profile" portalPath="/profile" />,
  subscriptions: () => <AccountPlaceholderPage title="My Subscriptions" portalPath="/subscriptions" />,
  rewards: () => <AccountPlaceholderPage title="My Rewards" portalPath="/rewards" />,
  wallet: () => <AccountPlaceholderPage title="My Wallet" portalPath="/wallet" />,
  'my-groups': () => <AccountPlaceholderPage title="My Groups" portalPath="/my-groups" />,
  addresses: () => <AccountPlaceholderPage title="My Addresses" portalPath="/addresses" />,
  bookings: () => <AccountPlaceholderPage title="My Bookings" portalPath="/bookings" />,
  logout: () => <AccountPlaceholderPage title="Log Out" portalPath="/logout" />,
});

export default App;
