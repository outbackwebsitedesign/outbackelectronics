import { useEffect, useRef, useState } from 'react';
import { TopNav, Footer } from './app-shell.jsx';

// Australian Government spatial service — per-carrier coverage tile layers
// https://spatial.infrastructure.gov.au/server/rest/services/Communications/Mobile_Phone_Coverage_by_provider/MapServer
const CARRIERS = [
  { id: 'telstra',  label: 'Telstra',  layerId: 2, color: '#0066cc' },
  { id: 'optus',   label: 'Optus',    layerId: 1, color: '#009900' },
  { id: 'tpg',     label: 'Vodafone', layerId: 0, color: '#e60000' },
];

const TILE_BASE = '/api/coverage/tile';

export default function CoverageApp() {
  const mapEl = useRef(null);
  const map = useRef(null);
  const layers = useRef({});
  const [active, setActive] = useState({ telstra: true, optus: true, tpg: true });

  useEffect(() => {
    const L = window.L;
    if (!L || map.current || !mapEl.current) return;

    const m = L.map(mapEl.current).setView([-27, 134], 5);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors · Coverage data © <a href="https://www.infrastructure.gov.au">Australian Government</a>',
    }).addTo(m);

    for (const c of CARRIERS) {
      const layer = L.tileLayer(`${TILE_BASE}/${c.layerId}/{z}/{x}/{y}`, {
        maxZoom: 18,
        opacity: 0.6,
        attribution: '',
      });
      layer.addTo(m);
      layers.current[c.id] = layer;
    }

    map.current = m;
  }, []);

  function toggle(id) {
    const L = window.L;
    if (!L || !map.current) return;
    const next = !active[id];
    setActive(a => ({ ...a, [id]: next }));
    const layer = layers.current[id];
    if (!layer) return;
    if (next) layer.addTo(map.current);
    else map.current.removeLayer(layer);
  }

  return (
    <>
      <TopNav current="coverage" />
      <div className="cov-wrap">
        <div className="cov-bar">
          <span className="cov-bar-label">Show</span>
          <div className="cov-chips">
            {CARRIERS.map(c => (
              <button
                key={c.id}
                className={'cov-chip' + (active[c.id] ? ' on' : '')}
                style={active[c.id] ? { background: c.color, borderColor: c.color } : {}}
                onClick={() => toggle(c.id)}
              >
                {c.label}
              </button>
            ))}
          </div>
          <span className="cov-source">
            Data: <a href="https://www.infrastructure.gov.au/media-communications/phone/mobile-services-and-coverage" target="_blank" rel="noopener noreferrer">Australian Government</a>
          </span>
        </div>
        <div id="covmap" ref={mapEl} />
      </div>
      <Footer />
    </>
  );
}
