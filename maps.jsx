// Maps, an interactive outback map (Leaflet via CDN + OSM tiles). Nothing is
// hardcoded: the workshop marker is geocoded from the shop address in settings
// (/api/shop-info), and fuel/water/camp POIs are pulled live from OpenStreetMap
// (Overpass) for whatever's in view. Your own pins are saved on-device.
import { useEffect, useRef, useState, useCallback } from 'react';
import { TopNav, Footer, useShopInfo } from './app-shell.jsx';

const CATS = {
  shop:  { label: 'Workshop', color: '#b5451b' },
  fuel:  { label: 'Fuel',     color: '#1f88f5' },
  water: { label: 'Water',    color: '#2b8fb3' },
  camp:  { label: 'Camp',     color: '#4f6b3e' },
  pin:   { label: 'My pins',  color: '#7a1fa2' },
};
const esc = (s) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export default function MapsApp() {
  const info = useShopInfo();
  const mapEl = useRef(null), map = useRef(null), group = useRef(null), timer = useRef(null);
  const [shop, setShop] = useState(null);
  const [pois, setPois] = useState([]);
  const [pins, setPins] = useState(() => { try { return JSON.parse(localStorage.getItem('oe_map_pins') || '[]'); } catch { return []; } });
  const [on, setOn] = useState({ shop: true, fuel: true, water: true, camp: true, pin: true });
  const [status, setStatus] = useState('');
  const [q, setQ] = useState('');

  const runOverpass = useCallback(async () => {
    const m = map.current;
    if (!m) return;
    if (m.getZoom() < 10) { setPois([]); setStatus('Zoom in to load fuel, water & camps'); return; }
    const b = m.getBounds();
    setStatus('Loading places…');
    try {
      const r = await fetch(`/api/maps/pois?s=${b.getSouth()}&w=${b.getWest()}&n=${b.getNorth()}&e=${b.getEast()}`).then(r => r.json());
      const list = (r.pois || []).filter(p => p.cat && p.lat && p.lon);
      setPois(list);
      setStatus(r.available === false ? 'Live places unavailable right now' : (list.length ? `${list.length} places in view` : 'No fuel/water/camps mapped here'));
    } catch { setStatus('Live places unavailable right now'); }
  }, []);

  const schedule = useCallback(() => { if (timer.current) clearTimeout(timer.current); timer.current = setTimeout(runOverpass, 700); }, [runOverpass]);

  // Init map once
  useEffect(() => {
    const L = window.L;
    if (!L || map.current || !mapEl.current) return;
    const m = L.map(mapEl.current).setView([-35.95, 144.85], 6);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap contributors' }).addTo(m);
    group.current = L.layerGroup().addTo(m);
    map.current = m;
    m.on('click', (e) => {
      const name = window.prompt('Name this pin:');
      if (!name) return;
      setPins(prev => { const next = [...prev, { name: name.slice(0, 60), lat: e.latlng.lat, lon: e.latlng.lng }]; try { localStorage.setItem('oe_map_pins', JSON.stringify(next)); } catch {} return next; });
    });
    m.on('moveend', schedule);
    schedule();
  }, [schedule]);

  // Workshop marker, geocoded from the shop address in settings (never hardcoded)
  useEffect(() => {
    if (!info || shop) return;
    const s = info.shop || {};
    const addr = [s.address, s.suburb, s.state, s.postcode].filter(Boolean).join(', ');
    if (!addr) return;
    fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(addr + ', Australia')}`, { headers: { Accept: 'application/json' } })
      .then(r => r.json())
      .then(d => { if (d && d[0]) { const lat = parseFloat(d[0].lat), lon = parseFloat(d[0].lon); setShop({ lat, lon, name: s.name || 'Workshop', meta: addr }); if (map.current) map.current.setView([lat, lon], 11); } })
      .catch(() => {});
  }, [info, shop]);

  // Draw all markers
  useEffect(() => {
    const L = window.L;
    if (!L || !group.current) return;
    group.current.clearLayers();
    const items = [];
    if (shop && on.shop) items.push({ ...shop, cat: 'shop' });
    for (const p of pois) if (on[p.cat]) items.push({ ...p, name: p.name || CATS[p.cat].label, meta: CATS[p.cat].label });
    for (const p of pins) if (on.pin) items.push({ ...p, cat: 'pin', meta: 'Saved pin' });
    for (const p of items) {
      const color = (CATS[p.cat] || {}).color || '#333';
      L.circleMarker([p.lat, p.lon], { radius: p.cat === 'shop' ? 9 : 6, weight: 2, color: '#fff', fillColor: color, fillOpacity: 1 })
        .addTo(group.current)
        .bindPopup(`<b>${esc(p.name || '')}</b>${p.meta ? '<br>' + esc(p.meta) : ''}`);
    }
  }, [shop, pois, pins, on]);

  const flyTo = (p) => { if (map.current) map.current.setView([p.lat, p.lon], 14); };
  const search = async (e) => {
    e.preventDefault();
    if (!q.trim()) return;
    try {
      const r = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q + ' Australia')}`, { headers: { Accept: 'application/json' } }).then(r => r.json());
      if (r && r[0] && map.current) map.current.setView([parseFloat(r[0].lat), parseFloat(r[0].lon)], 12);
    } catch {}
  };

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
          <p className="maps-hint">{status || 'Live fuel, water and camp sites from OpenStreetMap.'}</p>
          {shop ? <div className="poi-item" onClick={() => flyTo(shop)}><div className="n">{shop.name}</div><div className="m">{shop.meta}</div></div> : null}
          {pins.map((p, i) => (
            <div className="poi-item" key={i} onClick={() => flyTo(p)}><div className="n">{p.name}</div><div className="m">Saved pin</div></div>
          ))}
          <p className="maps-hint">Tip: click anywhere on the map to drop and name your own pin. Pins are saved on this device.</p>
        </aside>
        <div id="map" ref={mapEl} />
      </div>
      <Footer />
    </>
  );
}
