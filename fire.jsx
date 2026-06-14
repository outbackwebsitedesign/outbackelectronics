// Fire — live bushfire incidents by state, with links to official sources.
// A safety tool: always defer to official warnings.
import { useState, useEffect } from 'react';
import { TopNav, Footer } from './app-shell.jsx';

const LEVELS = [
  { key: 'Emergency Warning', cls: 'emergency', badge: 'badge-emergency' },
  { key: 'Watch and Act',     cls: 'watch',     badge: 'badge-watch' },
  { key: 'Advice',            cls: 'advice',    badge: 'badge-advice' },
];

const STATES = [
  { key: 'QLD', label: 'Queensland',         service: 'QFES',
    officialLabel: 'QFES Current Incidents',  officialUrl: 'https://www.qfes.qld.gov.au/Current-Incidents',
    banLabel: 'Fire danger ratings',          banUrl: 'https://www.ruralfire.qld.gov.au/Fire_Information/Pages/FireDangerRatings.aspx',
    trafficLabel: 'Traffic QLD',              trafficUrl: 'https://www.131940.com.au/' },
  { key: 'NSW', label: 'New South Wales',    service: 'RFS',
    officialLabel: 'RFS Fires Near Me',       officialUrl: 'https://www.rfs.nsw.gov.au/fire-information/fires-near-me',
    banLabel: 'Total fire bans',              banUrl: 'https://www.rfs.nsw.gov.au/fire-information/fdr-and-tobans',
    trafficLabel: 'Live Traffic NSW',         trafficUrl: 'https://www.livetraffic.com/' },
  { key: 'VIC', label: 'Victoria',           service: 'CFA / FRV',
    officialLabel: 'Emergency Victoria',      officialUrl: 'https://www.emergency.vic.gov.au/',
    banLabel: 'CFA warnings',                 banUrl: 'https://www.cfa.vic.gov.au/warnings-restrictions',
    trafficLabel: 'VicRoads traffic',         trafficUrl: 'https://www.vicroads.vic.gov.au/traffic-and-road-conditions' },
  { key: 'SA',  label: 'South Australia',    service: 'CFS',
    officialLabel: 'CFS warnings',            officialUrl: 'https://www.cfs.sa.gov.au/warnings-and-incidents/',
    banLabel: 'Total fire ban',               banUrl: 'https://www.cfs.sa.gov.au/warnings-and-incidents/total-fire-ban/',
    trafficLabel: 'Traffic SA',               trafficUrl: 'https://traffic.sa.gov.au/' },
  { key: 'WA',  label: 'Western Australia',  service: 'DFES',
    officialLabel: 'Emergency WA',            officialUrl: 'https://www.emergency.wa.gov.au/',
    banLabel: null,                           banUrl: null,
    trafficLabel: 'Main Roads WA',            trafficUrl: 'https://www.mainroads.wa.gov.au/traffic-travel/traffic-information/' },
  { key: 'TAS', label: 'Tasmania',           service: 'TFS',
    officialLabel: 'TFS current incidents',   officialUrl: 'https://www.fire.tas.gov.au/Show?pageId=current-incidents',
    banLabel: 'Total fire ban',               banUrl: 'https://www.fire.tas.gov.au/Show?pageId=total-fire-ban',
    trafficLabel: 'Transport Tasmania',       trafficUrl: 'https://www.transport.tas.gov.au/road/road_safety/traffic_updates' },
  { key: 'NT',  label: 'Northern Territory', service: 'NTFRS',
    officialLabel: 'NT Fire & Rescue',        officialUrl: 'https://pfes.nt.gov.au/',
    banLabel: null,                           banUrl: null,
    trafficLabel: 'NT road conditions',       trafficUrl: 'https://roadconditions.pfes.nt.gov.au/' },
  { key: 'ACT', label: 'ACT',                service: 'ACT ESA',
    officialLabel: 'ACT ESA warnings',        officialUrl: 'https://esa.act.gov.au/cbr-be-ready/warnings-and-incidents',
    banLabel: 'Fire danger ratings',          banUrl: 'https://esa.act.gov.au/cbr-be-ready/act-fire-danger-ratings-and-bans',
    trafficLabel: 'ACT traffic',              trafficUrl: 'https://www.tccs.act.gov.au/roads-and-paths/travel-and-traffic' },
];

const badgeFor = (cat) => {
  const m = LEVELS.find(l => l.key.toLowerCase() === String(cat).toLowerCase());
  return m ? m.badge : '';
};

export default function FireApp() {
  const [state, setState] = useState('QLD');
  const [data, setData] = useState(null);
  const st = STATES.find(s => s.key === state) || STATES[0];

  useEffect(() => {
    setData(null);
    fetch(`/api/fire/status?state=${state}`)
      .then(r => r.json())
      .then(setData)
      .catch(() => setData({ available: false }));
  }, [state]);

  const available = data && data.available;
  const counts = available ? (data.counts || {}) : {};
  const items = available ? (data.items || []) : [];
  const sorted = [...items].sort((a, b) => {
    const rank = c => { const i = LEVELS.findIndex(l => l.key.toLowerCase() === String(c).toLowerCase()); return i < 0 ? 99 : i; };
    return rank(a.category) - rank(b.category);
  });

  return (
    <>
      <TopNav current="fire" />
      <main className="container svc-main">
        <header className="svc-head">
          <p className="eyebrow">Safety · {st.service}</p>
          <h1 className="serif svc-title">Fire &amp; roads</h1>
          <p className="svc-sub">Live bushfire incidents and alert levels, pulled straight from the state fire service. Out here, knowing what's burning between you and town matters.</p>
        </header>

        <div className="fire-state-select">
          <label htmlFor="fire-state">State / Territory</label>
          <select id="fire-state" value={state} onChange={e => setState(e.target.value)}>
            {STATES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
        </div>

        {data == null ? <p className="fire-note">Loading live incidents…</p>
          : !available ? <p className="fire-note">Live feed unavailable for {st.label} right now — check the official sources below.</p>
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
          <a className="btn btn-rust" href={st.officialUrl} target="_blank" rel="noopener">{st.officialLabel} →</a>
          {st.banUrl && <a className="btn btn-ghost" href={st.banUrl} target="_blank" rel="noopener">{st.banLabel}</a>}
          <a className="btn btn-ghost" href={st.trafficUrl} target="_blank" rel="noopener">{st.trafficLabel}</a>
        </div>
      </main>
      <Footer />
    </>
  );
}
