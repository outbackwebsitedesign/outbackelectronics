// Shared app-shell for the Outback Electronics service suite.
// Imported by every subdomain app (hub, drive, photos, sky, …) so they share
// one launcher, one nav, one account state, and one visual language.
//
// URLs are NEVER hard-coded — they're read at runtime from /api/shop-info
// (which every service returns via serviceUrls() in server.js). That keeps
// localhost (ports) and production (subdomains) working from the same code.
import { useState, useEffect, useRef } from 'react';

// The whole environment. `url` is the key in the /api/shop-info response.
export const SERVICES = [
  { key: 'hub',      label: 'Hub',      url: 'hubUrl',      glyph: '🧭', tagline: 'Your dashboard' },
  { key: 'shop',     label: 'Shop',     url: 'siteUrl',     glyph: '🛒', tagline: 'Store & services' },
  { key: 'portal',   label: 'Portal',   url: 'portalUrl',   glyph: '👤', tagline: 'Orders & repairs' },
  { key: 'drive',    label: 'Drive',    url: 'driveUrl',    glyph: '📁', tagline: 'Your files' },
  { key: 'photos',   label: 'Photos',   url: 'photosUrl',   glyph: '🖼️', tagline: 'Photo backup' },
  { key: 'radio',    label: 'Radio',    url: 'radioUrl',    glyph: '📻', tagline: 'Outback FM' },
  { key: 'sky',      label: 'Sky',      url: 'skyUrl',      glyph: '🛰️', tagline: 'Passes & aurora' },
  { key: 'weather',  label: 'Weather',  url: 'weatherUrl',  glyph: '⛅', tagline: 'Live stations' },
  { key: 'maps',     label: 'Maps',     url: 'mapsUrl',     glyph: '🗺️', tagline: 'Outback map' },
  { key: 'coverage', label: 'Coverage', url: 'coverageUrl', glyph: '📡', tagline: 'Signal map' },
  { key: 'solar',    label: 'Solar',    url: 'solarUrl',    glyph: '☀️', tagline: 'Power planner' },
  { key: 'fire',     label: 'Fire',     url: 'fireUrl',     glyph: '🔥', tagline: 'Bans & roads' },
  { key: 'beacon',   label: 'Beacon',   url: 'beaconUrl',   glyph: '🆘', tagline: 'Check-ins' },
  { key: 'swap',     label: 'Swap',     url: 'swapUrl',     glyph: '🔄', tagline: 'Classifieds' },
  { key: 'ai',       label: 'AI',       url: 'aiUrl',       glyph: '🤖', tagline: 'Assistant' },
  { key: 'tools',    label: 'Tools',    url: 'toolsUrl',    glyph: '🧰', tagline: 'Handy tools' },
  { key: 'games',    label: 'Games',    url: 'gamesUrl',    glyph: '🎮', tagline: 'Play' },
];

// One shared, cached fetch of /api/shop-info across every consumer on the page.
let _shopInfoPromise = null;
export function fetchShopInfo() {
  if (!_shopInfoPromise) {
    _shopInfoPromise = fetch('/api/shop-info', { credentials: 'include' })
      .then(r => r.ok ? r.json() : {})
      .catch(() => ({}));
  }
  return _shopInfoPromise;
}

export function useShopInfo() {
  const [info, setInfo] = useState(null);
  useEffect(() => {
    let alive = true;
    fetchShopInfo().then(d => { if (alive) setInfo(d || {}); });
    return () => { alive = false; };
  }, []);
  return info; // { shop, flags, siteUrl, portalUrl, …, swapUrl } or null while loading
}

// user === undefined → still loading; null → signed out; object → signed in
export function useAuth() {
  const [user, setUser] = useState(undefined);
  const refresh = () => fetch('/api/auth/me', { credentials: 'include' })
    .then(r => r.ok ? r.json() : { user: null })
    .then(d => setUser(d.user || null))
    .catch(() => setUser(null));
  useEffect(() => { refresh(); }, []);
  return { user, refresh };
}

function Launcher({ urls, current, onClose }) {
  const ref = useRef(null);
  useEffect(() => {
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    const onEsc = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onEsc);
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onEsc); };
  }, [onClose]);
  return (
    <div className="oe-launcher" ref={ref} role="menu">
      <div className="oe-launcher-grid">
        {SERVICES.map(s => {
          const href = urls[s.url];
          if (!href) return null;
          const active = s.key === current;
          return (
            <a key={s.key} className={'oe-tile' + (active ? ' is-active' : '')}
               href={active ? undefined : href} role="menuitem">
              <span className="oe-tile-glyph">{s.glyph}</span>
              <span className="oe-tile-label">{s.label}</span>
            </a>
          );
        })}
      </div>
    </div>
  );
}

export function TopNav({ current }) {
  const info = useShopInfo();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const urls = info || {};
  const shopName = (info && info.shop && info.shop.name) || 'Outback Electronics';
  const hubHref = urls.hubUrl || urls.siteUrl || '/';
  return (
    <header className="topnav">
      <div className="container inner">
        <a className="logo" href={hubHref}>
          <span className="logo-mark"><img src="/logo.webp" alt="" onError={e => { e.target.style.display = 'none'; }} /></span>
          <span className="logo-text">
            <span className="name">{shopName}</span>
            <span className="sub">Field Network</span>
          </span>
        </a>
        <div className="nav-right">
          {user === undefined ? null : user
            ? <span className="oe-hello">{user.displayName || user.username}</span>
            : (urls.portalUrl ? <a className="btn btn-sm" href={urls.portalUrl}>Sign in</a> : null)}
          <button className="oe-launch-btn" aria-label="App launcher" aria-expanded={open} onClick={() => setOpen(o => !o)}>
            <span className="oe-waffle">{Array.from({ length: 9 }).map((_, i) => <i key={i} />)}</span>
          </button>
        </div>
      </div>
      {open && <Launcher urls={urls} current={current} onClose={() => setOpen(false)} />}
    </header>
  );
}

export function Footer() {
  const info = useShopInfo();
  const name = (info && info.shop && info.shop.name) || 'Outback Electronics';
  return (
    <footer className="footer">
      <div className="container inner">
        <span>{name} — Field Network</span>
        <span>Built for where the signal ends</span>
      </div>
    </footer>
  );
}

// Inject the shell-only styles once (launcher + nav extras). The base design
// system (colours, .btn, .topnav, .footer, .container) lives in each app's HTML.
const SHELL_CSS = `
.nav-right{ position: relative; }
.oe-hello{ color: var(--bg-deep); font-weight: 600; font-size: 13px; }
.oe-launch-btn{ background: transparent; border: 1px solid #3a3228; color: var(--sand-dim); width: 38px; height: 38px; display: grid; place-items: center; cursor: pointer; transition: border-color 120ms, color 120ms; }
.oe-launch-btn:hover{ border-color: var(--ochre); color: var(--ochre); }
.oe-waffle{ display: grid; grid-template-columns: repeat(3, 4px); gap: 3px; }
.oe-waffle i{ width: 4px; height: 4px; background: currentColor; display: block; border-radius: 1px; }
.oe-launcher{ position: absolute; right: 0; top: calc(100% + 10px); background: var(--bg-elev); border: 1px solid var(--line-strong); box-shadow: var(--shadow); padding: 12px; width: min(440px, 92vw); z-index: 80; }
.oe-launcher-grid{ display: grid; grid-template-columns: repeat(3, 1fr); gap: 4px; }
@media (max-width: 420px){ .oe-launcher-grid{ grid-template-columns: repeat(2, 1fr); } }
.oe-tile{ display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 12px 6px; text-align: center; border: 1px solid transparent; transition: background 120ms, border-color 120ms; cursor: pointer; }
.oe-tile:hover{ background: var(--bg-deep); border-color: var(--line); }
.oe-tile.is-active{ background: var(--bg-deep); border-color: var(--ochre); cursor: default; }
.oe-tile-glyph{ font-size: 22px; line-height: 1; }
.oe-tile-label{ font-size: 11px; font-weight: 600; color: var(--ink-2); letter-spacing: 0.02em; }
`;
if (typeof document !== 'undefined' && !document.getElementById('oe-shell-css')) {
  const el = document.createElement('style');
  el.id = 'oe-shell-css';
  el.textContent = SHELL_CSS;
  document.head.appendChild(el);
}
