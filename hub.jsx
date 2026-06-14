// Outback Hub — the account-aware launcher and home base for the whole
// service suite. Big-tile launcher (always works) plus a live snapshot of the
// signed-in customer's orders / repairs / quotes and the latest weather.
import { useState, useEffect } from 'react';
import { TopNav, Footer, SERVICES, useShopInfo, useAuth } from './app-shell.jsx';

// Tile order on the home grid (the launcher dropdown shows the full set).
const HOME_TILES = [
  'portal', 'drive', 'photos', 'radio', 'sky', 'weather',
  'maps', 'coverage', 'solar', 'fire', 'beacon', 'swap',
  'ai', 'tools', 'games', 'shop',
];

function useOverview() {
  const [data, setData] = useState(null);
  useEffect(() => {
    fetch('/api/hub/overview', { credentials: 'include' })
      .then(r => r.ok ? r.json() : {})
      .then(setData)
      .catch(() => setData({}));
  }, []);
  return data;
}

function weatherChipValue(w) {
  if (!w || !w.data) return null;
  const t = w.data.temperature ?? w.data.temp ?? w.data.temperature_c ?? null;
  return (t != null && isFinite(t)) ? `${Math.round(t)}°C` : null;
}

export default function HubApp() {
  const info = useShopInfo();
  const { user } = useAuth();
  const ov = useOverview();
  const urls = info || {};
  const tiles = HOME_TILES.map(k => SERVICES.find(s => s.key === k)).filter(Boolean);
  const stats = (ov && ov.stats) || null;
  const ann = ov && ov.announcement;
  const wx = ov ? weatherChipValue(ov.weather) : null;
  const greeting = user ? `G’day, ${user.displayName || user.username}` : 'Welcome to the Outback Hub';

  return (
    <>
      <TopNav current="hub" />

      {ann && ann.text ? <div className="oe-ann"><div className="container">{ann.text}</div></div> : null}

      <main className="container hub-main">
        <section className="hub-hero">
          <div>
            <p className="eyebrow">Field Network</p>
            <h1 className="serif hub-title">{greeting}</h1>
            <p className="hub-sub">Everything Outback Electronics runs — your files, the airwaves, the sky, the weather and the bush — in one place.</p>
          </div>
          <div className="hub-hero-side">
            {wx ? (
              <a className="hub-chip" href={urls.weatherUrl || undefined}>
                <span className="hub-chip-glyph">⛅</span>
                <span><b>{wx}</b><small>Live weather</small></span>
              </a>
            ) : null}
            {user === null && urls.portalUrl ? <a className="btn btn-rust" href={urls.portalUrl}>Sign in / Register</a> : null}
          </div>
        </section>

        <section className="hub-grid">
          {tiles.map(s => {
            const href = urls[s.url];
            return (
              <a key={s.key} className="hub-card"
                 href={href || undefined}
                 style={!href ? { opacity: 0.45, pointerEvents: 'none' } : undefined}>
                <span className="hub-card-glyph">{s.glyph}</span>
                <span className="hub-card-label">{s.label}</span>
                <span className="hub-card-tag">{s.tagline}</span>
              </a>
            );
          })}
        </section>

        {user ? (
          <section className="hub-snapshot">
            <h2 className="hub-h2">Your snapshot</h2>
            <div className="hub-stats">
              <a className="hub-stat" href={(urls.portalUrl || '') + '/orders'}>
                <b>{stats ? stats.openOrders : '—'}</b><span>Open orders</span>
              </a>
              <a className="hub-stat" href={(urls.portalUrl || '') + '/repairs'}>
                <b>{stats ? stats.activeRepairs : '—'}</b><span>Active repairs</span>
              </a>
              <a className="hub-stat" href={(urls.portalUrl || '') + '/quotes'}>
                <b>{stats ? stats.openQuotes : '—'}</b><span>Open quotes</span>
              </a>
            </div>
          </section>
        ) : null}
      </main>

      <Footer />
    </>
  );
}
