// Fire — live bushfire incidents + alert levels from the NSW RFS feed, with
// links to the official fire-ban and road sources. A safety tool: always
// defer to official warnings.
import { useState, useEffect } from 'react';
import { TopNav, Footer } from './app-shell.jsx';

const LEVELS = [
  { key: 'Emergency Warning', cls: 'emergency', badge: 'badge-emergency' },
  { key: 'Watch and Act', cls: 'watch', badge: 'badge-watch' },
  { key: 'Advice', cls: 'advice', badge: 'badge-advice' },
];

const badgeFor = (cat) => {
  const m = LEVELS.find(l => l.key.toLowerCase() === String(cat).toLowerCase());
  return m ? m.badge : '';
};

export default function FireApp() {
  const [data, setData] = useState(null);
  useEffect(() => {
    fetch('/api/fire/status').then(r => r.json()).then(setData).catch(() => setData({ available: false }));
  }, []);

  const available = data && data.available;
  const counts = available ? (data.counts || {}) : {};
  const items = available ? (data.items || []) : [];
  // Active alerts first, then the rest
  const sorted = [...items].sort((a, b) => {
    const rank = c => { const i = LEVELS.findIndex(l => l.key.toLowerCase() === String(c).toLowerCase()); return i < 0 ? 99 : i; };
    return rank(a.category) - rank(b.category);
  });

  return (
    <>
      <TopNav current="fire" />
      <main className="container svc-main">
        <header className="svc-head">
          <p className="eyebrow">Safety · NSW RFS</p>
          <h1 className="serif svc-title">Fire &amp; roads</h1>
          <p className="svc-sub">Live bushfire incidents and alert levels across NSW, pulled straight from the Rural Fire Service. Out here, knowing what's burning between you and town matters.</p>
        </header>

        {data == null ? <p className="fire-note">Loading live incidents…</p>
          : !available ? <p className="fire-note">The live RFS feed is unavailable right now — please check the official sources below.</p>
          : (
            <>
              <div className="fire-alerts">
                {LEVELS.map(l => (
                  <div key={l.key} className={'fire-alert ' + l.cls}>
                    <b>{counts[l.key] || 0}</b>
                    <span>{l.key}</span>
                  </div>
                ))}
              </div>
              <p className="fire-note">{data.total} active incident{data.total === 1 ? '' : 's'} statewide · updated live · always follow official warnings.</p>
              <div className="fire-list">
                {sorted.length === 0 ? <p className="fire-note">No active incidents listed. Stay safe out there.</p>
                  : sorted.map((it, i) => (
                    <div className="fire-item" key={i}>
                      <span className="t">{it.title}</span>
                      <span className={'fire-badge ' + badgeFor(it.category)}>{it.category}</span>
                    </div>
                  ))}
              </div>
            </>
          )}

        <div className="fire-links">
          <a className="btn btn-rust" href="https://www.rfs.nsw.gov.au/fire-information/fires-near-me" target="_blank" rel="noopener">RFS Fires Near Me →</a>
          <a className="btn btn-ghost" href="https://www.rfs.nsw.gov.au/fire-information/fdr-and-tobans" target="_blank" rel="noopener">Total fire bans</a>
          <a className="btn btn-ghost" href="https://www.livetraffic.com/" target="_blank" rel="noopener">Live Traffic NSW</a>
          <a className="btn btn-ghost" href="https://www.cfa.vic.gov.au/warnings-restrictions" target="_blank" rel="noopener">VIC CFA</a>
        </div>
      </main>
      <Footer />
    </>
  );
}
