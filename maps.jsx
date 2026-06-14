// Maps — an interactive outback map (Leaflet via CDN + OSM tiles). Seed POIs
// for the region plus your own pins (saved locally), and a place search via
// OpenStreetMap's Nominatim. Drop a pin by clicking the map.
import { useEffect, useRef, useState } from 'react';
import { TopNav, Footer } from './app-shell.jsx';

const CATS = {
  shop:  { label: 'Workshop', color: '#b5451b' },
  fuel:  { label: 'Fuel',     color: '#1f88f5' },
  water: { label: 'Water',    color: '#2b8fb3' },
  camp:  { label: 'Camp',     color: '#4f6b3e' },
  mech:  { label: 'Repairs',  color: '#d39a37' },
  pin:   { label: 'My pins',  color: '#7a1fa2' },
};

// Seed directory for the Riverina/Murray region — curate/expand over time.
const POIS = [
  { name: 'Outback Electronics', cat: 'shop',  lat: -35.952, lon: 144.852, meta: '183 Peericoota Forest Rd, Moama · by appointment' },
  { name: 'Moama fuel', cat: 'fuel',  lat: -35.905, lon: 144.762, meta: 'Servo · Moama township' },
  { name: 'Echuca fuel', cat: 'fuel',  lat: -36.131, lon: 144.751, meta: 'Servo · Echuca' },
  { name: 'Moama rest area', cat: 'water', lat: -35.912, lon: 144.771, meta: 'Town water · toilets' },
  { name: 'Murray River camp', cat: 'camp',  lat: -35.926, lon: 144.808, meta: 'Riverside camping' },
  { name: 'Barmah NP camp', cat: 'camp',  lat: -35.876, lon: 144.974, meta: 'Bush camping · forest' },
  { name: 'Echuca auto repairs', cat: 'mech',  lat: -36.140, lon: 144.744, meta: 'Mechanic · Echuca' },
];

export default function MapsApp() {
  const mapEl = useRef(null);
  const map = useRef(null);
  const group = useRef(null);
  const [on, setOn] = useState({ shop: true, fuel: true, water: true, camp: true, mech: true, pin: true });
  const [pins, setPins] = useState(() => { try { return JSON.parse(localStorage.getItem('oe_map_pins') || '[]'); } catch { return []; } });
  const [q, setQ] = useState('');

  // Init map once
  useEffect(() => {
    const L = window.L;
    if (!L || map.current || !mapEl.current) return;
    const m = L.map(mapEl.current).setView([-35.95, 144.85], 7);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap contributors' }).addTo(m);
    group.current = L.layerGroup().addTo(m);
    map.current = m;
    m.on('click', (e) => {
      const name = window.prompt('Name this pin:');
      if (!name) return;
      setPins(prev => {
        const next = [...prev, { name: name.slice(0, 60), lat: e.latlng.lat, lon: e.latlng.lng }];
        try { localStorage.setItem('oe_map_pins', JSON.stringify(next)); } catch {}
        return next;
      });
    });
  }, []);

  // (Re)draw markers when filters or pins change
  useEffect(() => {
    const L = window.L;
    if (!L || !map.current || !group.current) return;
    group.current.clearLayers();
    const all = [...POIS, ...pins.map(p => ({ ...p, cat: 'pin', meta: p.meta || 'Saved pin' }))];
    for (const p of all) {
      if (!on[p.cat]) continue;
      const color = (CATS[p.cat] || {}).color || '#333';
      L.circleMarker([p.lat, p.lon], { radius: 7, weight: 2, color: '#fff', fillColor: color, fillOpacity: 1 })
        .addTo(group.current)
        .bindPopup(`<b>${p.name}</b><br>${p.meta || ''}`);
    }
  }, [on, pins]);

  const flyTo = (p) => { if (map.current) { map.current.setView([p.lat, p.lon], 13); } };

  const search = async (e) => {
    e.preventDefault();
    if (!q.trim()) return;
    try {
      const r = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q + ' Australia')}`, { headers: { Accept: 'application/json' } }).then(r => r.json());
      if (r && r[0] && map.current) map.current.setView([parseFloat(r[0].lat), parseFloat(r[0].lon)], 12);
    } catch { /* offline / blocked — ignore */ }
  };

  const visiblePois = [...POIS, ...pins.map(p => ({ ...p, cat: 'pin', meta: p.meta || 'Saved pin' }))].filter(p => on[p.cat]);

  return (
    <>
      <TopNav current="maps" />
      <div className="maps-wrap">
        <aside className="maps-side">
          <h2>Find a place</h2>
          <form className="maps-search" onSubmit={search}>
            <input className="input" placeholder="Town, park, address…" value={q} onChange={e => setQ(e.target.value)} />
            <button className="btn btn-sm" type="submit">Go</button>
          </form>
          <div className="cat-toggle">
            {Object.entries(CATS).map(([k, c]) => (
              <span key={k} className={'cat-chip' + (on[k] ? '' : ' off')} onClick={() => setOn(s => ({ ...s, [k]: !s[k] }))}>
                <span className="cat-dot" style={{ background: c.color }} />{c.label}
              </span>
            ))}
          </div>
          {visiblePois.map((p, i) => (
            <div className="poi-item" key={i} onClick={() => flyTo(p)}>
              <div className="n">{p.name}</div>
              <div className="m">{p.meta}</div>
            </div>
          ))}
          <p className="maps-hint">Tip: click anywhere on the map to drop and name your own pin. Pins are saved on this device.</p>
        </aside>
        <div id="map" ref={mapEl} />
      </div>
      <Footer />
    </>
  );
}
