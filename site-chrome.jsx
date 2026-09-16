// Shared shop-site chrome: the utility bar, top nav, mobile drawer and footer
// used by the main site (app.jsx), Tools (tools.jsx) and Weather (weather.jsx).
//
// These three bundles are served from different origins but present one site to
// the customer, so the nav items, footer links and wording have to come from a
// single place. They previously each carried their own copy and had drifted
// apart in nav items, copy and accessibility attributes.
//
// The only real difference between the hosts is navigation: the main site
// SPA-routes with its own `go()`, while Tools and Weather do a real browser
// navigation back to the main origin. Both pass their `go` in as a prop, and
// set `setSiteRoot()` once at startup so link hrefs point at the right origin.

import React, { useState, useEffect, useRef, createContext, useContext } from 'react';
import { makePortalHelpers } from './src/lib/api.js';

// ---------------- Cross-site URLs ----------------
// Defaults are the production subdomains, replaced at runtime from
// /api/shop-info so the same build works on localhost and in production.
let _PORTAL_URL = 'https://portal.outbackelectronics.com.au';
let _GAMES_URL  = 'https://games.outbackelectronics.com.au';
let _TOOLS_URL  = 'https://tools.outbackelectronics.com.au';
let _FORUM_URL  = 'https://forum.outbackelectronics.com.au';
export function getPortalUrl() { return _PORTAL_URL; }
export function getGamesUrl()  { return _GAMES_URL; }
export function getToolsUrl()  { return _TOOLS_URL; }
export function getForumUrl()  { return _FORUM_URL; }

// Where main-site pages (/shop, /services, …) live. The main site serves them
// itself, so '/' is right there; Tools and Weather override this with a
// resolver that points back at the main origin.
let _siteRoot = () => '/';
export function setSiteRoot(fn) { _siteRoot = fn; }
export function siteHref(id) {
  const root = _siteRoot() || '/';
  return root.endsWith('/') ? root + id : root + '/' + id;
}

export const ShopContext = createContext({});
export const useShop = () => useContext(ShopContext);

const { portalApi, usePortalUser } = makePortalHelpers(getPortalUrl);
export { portalApi, usePortalUser };

// ---------------- Nav configuration ----------------
export const PRIMARY_PAGES = [
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

// Pages served from their own subdomain (tools./forum./games.), clicking these
// navigates the browser to the external service rather than SPA-routing.
const EXTERNAL_LINKS = {
  'forum-link': getForumUrl,
  'games-link': getGamesUrl,
  'tools-link': getToolsUrl,
};
export const isExternalLink = (id) => Object.prototype.hasOwnProperty.call(EXTERNAL_LINKS, id);
export const externalHref = (id) => EXTERNAL_LINKS[id] ? EXTERNAL_LINKS[id]() : null;

export const UTILITY_PAGES = [
  { id: 'quote', label: 'Request a Quote' },
  { id: 'book', label: 'Book a Repair' },
  { id: 'gift-cards', label: 'Gift Cards' },
  { id: 'about', label: 'About' },
  { id: 'sell-gear', label: 'Sell Your Gear' },
  { id: 'contact', label: 'Contact' },
  { id: 'policies', label: 'Policies' },
];

// Highlight the parent nav item for detail pages that aren't in PRIMARY_PAGES,
// so the active nav state always resets visibly on navigation (incl. logo clicks).
export const NAV_PAGE_ALIASES = { product: 'shop', service: 'services', repairs: 'services' };

// ---------------- Shared hooks ----------------
export function useFocusTrap(containerRef, onClose) {
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const prevFocus = document.activeElement;
    const getFocusable = () => Array.from(container.querySelectorAll(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    ));
    if (!container.contains(document.activeElement)) {
      const els = getFocusable();
      if (els[0]) els[0].focus();
      else if (typeof container.focus === 'function') container.focus();
    }
    const handleKey = (e) => {
      if (e.key === 'Escape') { e.stopPropagation(); if (onClose) onClose(); return; }
      if (e.key !== 'Tab') return;
      const els = getFocusable();
      if (els.length === 0) { e.preventDefault(); return; }
      const first = els[0];
      const last = els[els.length - 1];
      if (e.shiftKey && (document.activeElement === first || !container.contains(document.activeElement))) {
        e.preventDefault(); last.focus();
      } else if (!e.shiftKey && (document.activeElement === last || !container.contains(document.activeElement))) {
        e.preventDefault(); first.focus();
      }
    };
    document.addEventListener('keydown', handleKey, true);
    return () => {
      document.removeEventListener('keydown', handleKey, true);
      if (prevFocus && typeof prevFocus.focus === 'function') prevFocus.focus();
    };
  }, []);
}

// Freezes the page behind a full-screen overlay (nav drawer, search) so a swipe
// or wheel that reaches the overlay's scroll boundary does not scroll the page
// underneath it. Pads for the scrollbar it removes so the layout does not jump.
export function useBodyScrollLock() {
  useEffect(() => {
    const body = document.body;
    const prevOverflow = body.style.overflow;
    const prevPadding = body.style.paddingRight;
    const barWidth = window.innerWidth - document.documentElement.clientWidth;
    body.style.overflow = 'hidden';
    if (barWidth > 0) body.style.paddingRight = `${barWidth}px`;
    return () => {
      body.style.overflow = prevOverflow;
      body.style.paddingRight = prevPadding;
    };
  }, []);
}

export function useShopInfo() {
  const [info, setInfo] = useState({ shop: {}, flags: {}, portalUrl: '', gamesUrl: '', forumUrl: '' });
  useEffect(() => {
    fetch('/api/shop-info')
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (!d) return;
        if (d.portalUrl) _PORTAL_URL = d.portalUrl;
        if (d.gamesUrl)  _GAMES_URL  = d.gamesUrl;
        if (d.toolsUrl)  _TOOLS_URL  = d.toolsUrl;
        if (d.forumUrl)  _FORUM_URL  = d.forumUrl;
        setInfo({
          shop: d.shop || {},
          flags: d.flags || {},
          portalUrl: d.portalUrl || _PORTAL_URL,
          gamesUrl: d.gamesUrl || _GAMES_URL,
          forumUrl: d.forumUrl || _FORUM_URL,
        });
      })
      .catch(() => {});
  }, []);
  return info;
}

export function useAnnouncement() {
  const [text, setText] = useState('');
  useEffect(() => {
    fetch('/api/announcement')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d && d.active && d.text) setText(d.text); })
      .catch(() => {});
  }, []);
  return text;
}

// ---------------- Brand Mark ----------------
export function Logo({ onClick }) {
  return (
    <div className="logo" onClick={onClick}>
      <div className="logo-mark">
        <img src="/assets/logo.webp" alt="Outback Electronics" width="55" height="40" />
      </div>
      <div className="logo-text">
        <div className="sub">Est. 2023 · Appointment only</div>
      </div>
    </div>
  );
}

// ---------------- Account dropdown ----------------
export function AccountDropdown({ go, onClose, user }) {
  const ref = useRef(null);
  const portal = (path = '') => { window.location.href = getPortalUrl() + path; };
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

// ---------------- Utility bar ----------------
export function UtilityBar({ go }) {
  const shop = useShop();
  return (
    <div className="utility-bar">
      <div className="container">
        <div className="links"></div>
        <div className="links">
          {UTILITY_PAGES.map(p => (
            <a key={p.id} href={siteHref(p.id)} onClick={(e) => { e.preventDefault(); go(p.id); }}>{p.label}</a>
          ))}
          {shop.phone && <span style={{color:'var(--ochre)'}}>{shop.phone}</span>}
        </div>
      </div>
    </div>
  );
}

// ---------------- Mobile nav drawer ----------------
export function MobileNavDrawer({ page, go, onClose, handleNavClick }) {
  const shop = useShop();
  const drawerRef = useRef(null);
  useFocusTrap(drawerRef, onClose);
  useBodyScrollLock();
  const isNavActive = (id) => page === id || NAV_PAGE_ALIASES[page] === id;
  return (
    <div ref={drawerRef} id="mobile-nav" className="mobile-nav" role="dialog" aria-modal="true" aria-label="Navigation menu">
      <div className="mobile-nav-header">
        <Logo onClick={() => { go('home'); onClose(); }} />
        <button className="icon-btn" aria-label="Close menu" onClick={onClose}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>
        </button>
      </div>
      {PRIMARY_PAGES.map(p => (
        <a key={p.id}
          href={isExternalLink(p.id) ? externalHref(p.id) : siteHref(p.id)}
          className={isNavActive(p.id) ? 'active' : ''}
          aria-current={isNavActive(p.id) ? 'page' : undefined}
          onClick={isExternalLink(p.id) ? undefined : (e) => { e.preventDefault(); handleNavClick(p.id); }}
          {...(isExternalLink(p.id) ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
          {p.label}
        </a>
      ))}
      <div className="mobile-nav-utils">
        {UTILITY_PAGES.map(p => (
          <a key={p.id} href={siteHref(p.id)} className={page === p.id ? 'active' : ''}
            aria-current={page === p.id ? 'page' : undefined}
            onClick={(e) => { e.preventDefault(); handleNavClick(p.id); }}>
            {p.label}
          </a>
        ))}
      </div>
      {shop.phone && (
        <div className="mobile-nav-promo">
          <span className="phone">{shop.phone}</span>
        </div>
      )}
    </div>
  );
}

// ---------------- Top nav ----------------
export function SiteTopNav({ page, go, cart, onSearchOpen, accountOpen, setAccountOpen, portalUser }) {
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
          <nav className="mainlinks" aria-label="Primary">
            {PRIMARY_PAGES.map(p => {
              const active = page === p.id || NAV_PAGE_ALIASES[page] === p.id;
              return (
                <a
                  key={p.id}
                  href={isExternalLink(p.id) ? externalHref(p.id) : siteHref(p.id)}
                  className={active ? 'active' : ''}
                  aria-current={active ? 'page' : undefined}
                  onClick={isExternalLink(p.id) ? undefined : (e) => { e.preventDefault(); go(p.id); }}
                  {...(isExternalLink(p.id) ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                >
                  {p.label}
                </a>
              );
            })}
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
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-7 8-7s8 3 8 7"/></svg>
              </button>
              {accountOpen && <AccountDropdown go={go} onClose={() => setAccountOpen(false)} user={portalUser} />}
            </div>
            <button className="icon-btn" title="Cart" aria-label={cart > 0 ? `Cart, ${cart} item${cart === 1 ? '' : 's'}` : 'Cart'} onClick={() => go('cart')}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M3 4h2l2.5 12h11l2-9H6"/><circle cx="9" cy="20" r="1.5"/><circle cx="18" cy="20" r="1.5"/></svg>
              {cart > 0 && <span className={`cart-count${cartPopped ? ' popped' : ''}`} aria-hidden="true">{cart}</span>}
            </button>
            {/* Hamburger, hidden on desktop via CSS (.hamburger), shown on mobile */}
            <button className="icon-btn hamburger" title="Menu" aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'} aria-expanded={mobileMenuOpen} aria-controls="mobile-nav" onClick={() => setMobileMenuOpen(o => !o)}>
              {mobileMenuOpen
                ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>
                : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M3 12h18M3 6h18M3 18h18"/></svg>
              }
            </button>
          </div>
        </div>
      </div>
      {/* Mobile nav drawer, hidden on desktop via CSS */}
      {mobileMenuOpen && (
        <MobileNavDrawer page={page} go={go} onClose={() => setMobileMenuOpen(false)} handleNavClick={handleNavClick} />
      )}
    </header>
  );
}

// ---------------- Footer ----------------
export function SiteFooter({ go }) {
  const shop = useShop();
  const [topCategories, setTopCategories] = useState([]);
  const [footerServices, setFooterServices] = useState([]);
  const [footerLoading, setFooterLoading] = useState(true);

  useEffect(() => {
    Promise.allSettled([
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
        }),
      fetch('/api/catalog/services')
        .then(r => r.ok ? r.json() : Promise.reject())
        .then(d => {
          setFooterServices((d.items || []).slice(0, 5));
        }),
    ]).finally(() => setFooterLoading(false));
  }, []);

  // Skeleton rows keep the footer columns sized while link data loads (no layout shift)
  const footerSkeleton = Array.from({ length: 5 }).map((_, i) => (
    <li key={`sk-${i}`} aria-hidden="true"><span className="skeleton" style={{display:'inline-block', height:13, width: 90 + (i % 3) * 24, opacity:0.35}} /></li>
  ));

  const link = (id, label) => (
    <li key={id}><a href={siteHref(id)} onClick={(e) => { e.preventDefault(); go(id); }}>{label}</a></li>
  );

  return (
    <footer>
      <div className="container">
        <div className="grid">
          <div>
            <div className="logo">
              <div className="logo-mark sm" style={{background:'#000'}}>
                <img src="/assets/logo.webp" alt="Outback Electronics" width="40" height="29" />
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
              {footerLoading ? footerSkeleton : topCategories.map((cat) => (
                <li key={cat}><a href={siteHref('shop')} onClick={(e) => { e.preventDefault(); go('shop', { initialCat: cat }); }}>{cat}</a></li>
              ))}
            </ul>
          </div>
          <div>
            <h3>Services</h3>
            <ul>
              {footerLoading ? footerSkeleton : footerServices.map((svc) => (
                <li key={svc.id}><a href={siteHref('service/' + (svc.slug || svc.id))} onClick={(e) => { e.preventDefault(); go('service', svc); }}>{svc.name}</a></li>
              ))}
            </ul>
          </div>
          <div>
            <h3>Community</h3>
            <ul>
              {link('tutorials', 'Tutorials')}
              {link('groups', 'Groups')}
              {link('memberships', 'Memberships')}
              {link('reviews', 'Reviews')}
              {link('about', 'About')}
              {link('sellers', 'Info for Sellers')}
              {link('sell-gear', 'Sell Your Gear')}
            </ul>
          </div>
          <div>
            <h3>Visit</h3>
            <ul style={{color:'var(--ink-on-dark-muted)'}}>
              <li>{[shop.suburb, shop.state, shop.postcode].filter(Boolean).join(' ')}<br/>There is no public access. Please come by appointment.</li>
              {shop.phone && <li>{shop.phone}</li>}
              <li><a href={siteHref('contact')} onClick={(e) => { e.preventDefault(); go('contact'); }} style={{color:'var(--ochre)'}}>Get directions →</a></li>
            </ul>
          </div>
        </div>
        <div className="baseline">
          <span>© 2023–{new Date().getFullYear()} {shop.tradingName}{shop.abn ? ` · ABN ${shop.abn}` : ''}</span>
          {(shop.acknowledgmentPeople || shop.acknowledgmentCountry) && <span>ACKNOWLEDGES THE {(shop.acknowledgmentPeople || '').toUpperCase()} AS TRADITIONAL CUSTODIANS OF {(shop.acknowledgmentCountry || '').toUpperCase()}</span>}
        </div>
      </div>
    </footer>
  );
}
