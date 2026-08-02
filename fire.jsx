// Fire, live bushfire incidents by state with Leaflet map + alert list.
// A safety tool: always defer to official warnings.
import { useState, useEffect, useRef } from 'react';
import { TopNav, Footer } from './app-shell.jsx';

const LEVELS = [
  { key: 'Emergency Warning', cls: 'emergency',   badge: 'badge-emergency',   color: '#b3231b' },
  { key: 'Watch and Act',     cls: 'watch',       badge: 'badge-watch',       color: '#c4591a' },
  { key: 'Advice',            cls: 'advice',      badge: 'badge-advice',      color: '#b08a12' },
  { key: 'Information',       cls: 'information', badge: 'badge-information', color: '#4a7ba0' },
];

const STATES = [
  { key: 'QLD', label: 'Queensland',         service: 'QFD',       bounds: [[-29.2, 138.0], [-10.5, 153.6]],
    officialLabel: 'QFD Current Incidents',   officialUrl: 'https://www.fire.qld.gov.au/Current-Incidents',
    trafficLabel: 'Traffic QLD',              trafficUrl: 'https://www.131940.com.au/' },
  { key: 'NSW', label: 'New South Wales',    service: 'RFS',        bounds: [[-37.5, 141.0], [-28.2, 153.6]],
    officialLabel: 'RFS Fires Near Me',       officialUrl: 'https://www.rfs.nsw.gov.au/fire-information/fires-near-me',
    trafficLabel: 'Live Traffic NSW',         trafficUrl: 'https://www.livetraffic.com/' },
  { key: 'VIC', label: 'Victoria',           service: 'CFA / FRV',  bounds: [[-39.2, 140.9], [-33.9, 149.9]],
    officialLabel: 'Emergency Victoria',      officialUrl: 'https://www.emergency.vic.gov.au/',
    trafficLabel: 'VicRoads traffic',         trafficUrl: 'https://www.vicroads.vic.gov.au/traffic-and-road-conditions' },
  { key: 'SA',  label: 'South Australia',    service: 'CFS',        bounds: [[-38.1, 129.0], [-26.0, 141.0]],
    officialLabel: 'CFS warnings',            officialUrl: 'https://www.cfs.sa.gov.au/warnings-and-incidents/',
    trafficLabel: 'Traffic SA',               trafficUrl: 'https://traffic.sa.gov.au/' },
  { key: 'WA',  label: 'Western Australia',  service: 'DFES',       bounds: [[-35.1, 113.2], [-13.7, 129.0]],
    officialLabel: 'Emergency WA',            officialUrl: 'https://www.emergency.wa.gov.au/',
    trafficLabel: 'Main Roads WA',            trafficUrl: 'https://www.mainroads.wa.gov.au/traffic-travel/traffic-information/' },
  { key: 'TAS', label: 'Tasmania',           service: 'TFS',        bounds: [[-43.6, 144.6], [-39.5, 148.5]],
    officialLabel: 'TFS current incidents',   officialUrl: 'https://www.fire.tas.gov.au/Show?pageId=current-incidents',
    trafficLabel: 'Transport Tasmania',       trafficUrl: 'https://www.transport.tas.gov.au/road/road_safety/traffic_updates' },
  { key: 'NT',  label: 'Northern Territory', service: 'NTFRS',      bounds: [[-26.0, 129.0], [-10.9, 138.0]],
    officialLabel: 'NT Fire & Rescue',        officialUrl: 'https://pfes.nt.gov.au/',
    trafficLabel: 'NT road conditions',       trafficUrl: 'https://roadconditions.pfes.nt.gov.au/' },
  { key: 'ACT', label: 'ACT',                service: 'ACT ESA',    bounds: [[-35.92, 148.76], [-35.12, 149.40]],
    officialLabel: 'ACT ESA warnings',        officialUrl: 'https://esa.act.gov.au/cbr-be-ready/warnings-and-incidents',
    trafficLabel: 'ACT traffic',              trafficUrl: 'https://www.tccs.act.gov.au/roads-and-paths/travel-and-traffic' },
];

const ROAD_COLORS = {
  accident:    '#b3231b',
  roadwork:    '#b08a12',
  hazard:      '#c4591a',
  closure:     '#7b0000',
  other:       '#4a7ba0',
};

const badgeFor = (cat) => {
  const m = LEVELS.find(l => l.key.toLowerCase() === String(cat).toLowerCase());
  return m ? m.badge : '';
};
const colorFor = (cat) => {
  const m = LEVELS.find(l => l.key.toLowerCase() === String(cat).toLowerCase());
  return m ? m.color : '#666';
};
const roadColor = (type) => {
  const t = String(type).toLowerCase();
  if (/clos/i.test(t)) return ROAD_COLORS.closure;
  return ROAD_COLORS[t] || ROAD_COLORS.other;
};

export default function FireApp() {
  const [state, setState] = useState('QLD');
  const [layer, setLayer] = useState('fire');
  const [data, setData] = useState(null);
  const [roads, setRoads] = useState(null);
  const mapEl = useRef(null);
  const map = useRef(null);
  const markers = useRef(null);
  const st = STATES.find(s => s.key === state) || STATES[0];

  // Fetch fire incidents when state changes
  useEffect(() => {
    setData(null);
    fetch(`/api/fire/status?state=${state}`)
      .then(r => r.json())
      .then(setData)
      .catch(() => setData({ available: false }));
  }, [state]);

  // Fetch road data when state changes or layer switches to roads
  useEffect(() => {
    if (layer !== 'roads') return;
    setRoads(null);
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 15000);
    fetch(`/api/fire/roads?state=${state}`, { signal: ctrl.signal })
      .then(r => r.json())
      .then(setRoads)
      .catch(() => setRoads({ available: false }))
      .finally(() => clearTimeout(timer));
    return () => { ctrl.abort(); clearTimeout(timer); };
  }, [state, layer]);

  // Init map once
  useEffect(() => {
    const L = window.L;
    if (!L || map.current || !mapEl.current) return;
    const m = L.map(mapEl.current).setView([-25, 133], 4);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19, attribution: '© OpenStreetMap contributors',
    }).addTo(m);
    markers.current = L.featureGroup().addTo(m);
    map.current = m;
  }, []);

  // Re-centre + re-plot whenever layer/state/data/roads changes
  useEffect(() => {
    const L = window.L;
    if (!L || !map.current) return;
    markers.current?.clearLayers();

    if (layer === 'roads') {
      if (!roads?.available) {
        map.current.fitBounds(st.bounds, { padding: [10, 10] });
        return;
      }
      for (const item of roads.items || []) {
        if (item.lat == null || item.lon == null) continue;
        const color = roadColor(item.type);
        L.circleMarker([item.lat, item.lon], {
          radius: 8, weight: 2, color: '#fff', fillColor: color, fillOpacity: 0.9,
        }).addTo(markers.current)
          .bindPopup(`<b>${item.title}</b><br><small>${item.type || 'Incident'}</small>`);
      }
      map.current.fitBounds(st.bounds, { padding: [10, 10] });
      return;
    }

    // Fire layer
    if (!data?.available) {
      map.current.fitBounds(st.bounds, { padding: [10, 10] });
      return;
    }
    for (const item of data.items || []) {
      if (item.lat == null || item.lon == null) continue;
      L.circleMarker([item.lat, item.lon], {
        radius: 9, weight: 2, color: '#fff', fillColor: colorFor(item.category), fillOpacity: 0.9,
      }).addTo(markers.current)
        .bindPopup(`<b>${item.title}</b><br><small>${item.category}</small>`);
    }
    map.current.fitBounds(st.bounds, { padding: [10, 10] });
  }, [data, roads, layer, state]);

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

        <div className="fire-controls">
          <div className="fire-state-select">
            <label htmlFor="fire-state">State</label>
            <select id="fire-state" value={state} onChange={e => { setState(e.target.value); }}>
              {STATES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select>
          </div>
          <div className="fire-state-select">
            <label htmlFor="fire-layer">Layer</label>
            <select id="fire-layer" value={layer} onChange={e => setLayer(e.target.value)}>
              <option value="fire">Fire incidents</option>
              <option value="roads">Road closures</option>
            </select>
          </div>
        </div>

        {layer === 'fire' && (
          <>
            {available && (
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
              </>
            )}
            {data == null && <p className="fire-note">Loading live incidents…</p>}
            {data && !available && <p className="fire-note">Live feed unavailable for {st.label} right now, check the official sources below.</p>}
          </>
        )}

        {layer === 'roads' && (
          <>
            {roads?.available && <p className="fire-note">{roads.total} road closure{roads.total === 1 ? '' : 's'} · updated live.</p>}
            {roads == null && <p className="fire-note">Loading road closures…</p>}
            {roads && !roads.available && <p className="fire-note">Road closure data unavailable for {st.label}, check the traffic link below.</p>}
          </>
        )}

        <div ref={mapEl} className="fire-map" />

        {layer === 'fire' && available && (
          <div className="fire-list">
            {sorted.length === 0
              ? <p className="fire-note">No active incidents listed. Stay safe out there.</p>
              : sorted.map((it, i) => (
                <div className="fire-item" key={i}>
                  <span className="t">{it.title}{it.type ? <span className="fire-item-type"> · {it.type}</span> : null}</span>
                  <span className={'fire-badge ' + badgeFor(it.category)}>{it.category}</span>
                </div>
              ))}
          </div>
        )}

        {layer === 'roads' && roads?.available && (
          <div className="fire-list">
            {(roads.items || []).length === 0
              ? <p className="fire-note">No road closures listed.</p>
              : (roads.items || []).map((it, i) => (
                <div className="fire-item" key={i}>
                  <span className="t">{it.title}</span>
                  <span className="fire-badge" style={{ borderColor: roadColor(it.type), color: roadColor(it.type) }}>{/clos/i.test(it.type) ? 'Closed' : it.type || 'Closed'}</span>
                </div>
              ))}
          </div>
        )}

        <div className="fire-links">
          <a className="btn btn-rust" href={st.officialUrl} target="_blank" rel="noopener">{st.officialLabel} →</a>
          <a className="btn btn-ghost" href={st.trafficUrl} target="_blank" rel="noopener">{st.trafficLabel}</a>
        </div>
      </main>
      <Footer />
    </>
  );
}
