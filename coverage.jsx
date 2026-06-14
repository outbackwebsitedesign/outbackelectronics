// Coverage — a crowd-sourced mobile/satellite signal map. No seed data: the
// map is empty until real people drop reports (stored in coverage.db). Click
// where you got reception, log carrier/tech/bars, and it's on the map.
import { useEffect, useRef, useState } from 'react';
import { TopNav, Footer, apiPost } from './app-shell.jsx';

const CARRIERS = ['Telstra', 'Optus', 'Vodafone', 'Starlink', 'Other'];
const TECHS = ['5G', '4G', '3G', 'Satellite', 'None'];
const TECH_COLOR = { '5G': '#4f6b3e', '4G': '#1f88f5', '3G': '#d39a37', Satellite: '#7a1fa2', None: '#9c8f78' };
const esc = (s) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export default function CoverageApp() {
  const mapEl = useRef(null), map = useRef(null), group = useRef(null), draftM = useRef(null);
  const [reports, setReports] = useState([]);
  const [draft, setDraft] = useState(null);
  const [form, setForm] = useState({ carrier: 'Telstra', tech: '4G', bars: 3, note: '' });
  const [filter, setFilter] = useState('All');
  const [msg, setMsg] = useState('');

  const load = () => fetch('/api/coverage/reports').then(r => r.json()).then(d => setReports(d.reports || [])).catch(() => {});

  useEffect(() => {
    const L = window.L;
    if (!L || map.current || !mapEl.current) return;
    const m = L.map(mapEl.current).setView([-35.95, 144.85], 6);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap contributors' }).addTo(m);
    group.current = L.layerGroup().addTo(m);
    map.current = m;
    m.on('click', (e) => {
      setDraft({ lat: e.latlng.lat, lon: e.latlng.lng });
      if (draftM.current) m.removeLayer(draftM.current);
      draftM.current = L.circleMarker([e.latlng.lat, e.latlng.lng], { radius: 9, weight: 3, color: '#b5451b', fillColor: '#b5451b', fillOpacity: 0.25 }).addTo(m);
    });
    load();
  }, []);

  useEffect(() => {
    const L = window.L;
    if (!L || !group.current) return;
    group.current.clearLayers();
    for (const r of reports) {
      if (filter !== 'All' && r.carrier !== filter) continue;
      const c = TECH_COLOR[r.tech] || '#9c8f78';
      L.circleMarker([r.lat, r.lon], { radius: 4 + (r.bars || 0), weight: 1, color: '#fff', fillColor: c, fillOpacity: 0.85 })
        .addTo(group.current)
        .bindPopup(`<b>${esc(r.carrier)} · ${esc(r.tech)}</b><br>${r.bars}/5 bars${r.note ? '<br>' + esc(r.note) : ''}`);
    }
  }, [reports, filter]);

  async function submit(e) {
    e.preventDefault();
    if (!draft) return;
    setMsg('Saving…');
    try {
      const res = await apiPost('/api/coverage/report', { ...form, bars: Number(form.bars), lat: draft.lat, lon: draft.lon });
      if (res.ok) {
        setMsg('Thanks — added to the map!');
        setDraft(null);
        if (draftM.current && map.current) { map.current.removeLayer(draftM.current); draftM.current = null; }
        await load();
        setTimeout(() => setMsg(''), 2500);
      } else if (res.status === 429) { setMsg('Easy on — too many reports, try again shortly.'); }
      else { setMsg('Could not save — please try again.'); }
    } catch { setMsg('Could not save — please try again.'); }
  }

  return (
    <>
      <TopNav current="coverage" />
      <div className="cov-wrap">
        <aside className="cov-side">
          <h2>Signal map · {reports.length} report{reports.length === 1 ? '' : 's'}</h2>
          <div className="cov-filter">
            {['All', ...CARRIERS].map(c => (
              <span key={c} className={'cov-chip' + (filter === c ? ' on' : '')} onClick={() => setFilter(c)}>{c}</span>
            ))}
          </div>
          <div className="cov-legend">
            {TECHS.map(t => <span key={t}><span className="cov-dot" style={{ background: TECH_COLOR[t] }} />{t}</span>)}
          </div>

          {draft ? (
            <form className="cov-form" onSubmit={submit}>
              <h2>Report signal here</h2>
              <div className="fld-row">
                <label className="fld"><span>Carrier</span>
                  <select className="input" value={form.carrier} onChange={e => setForm(f => ({ ...f, carrier: e.target.value }))}>
                    {CARRIERS.map(c => <option key={c}>{c}</option>)}
                  </select></label>
                <label className="fld"><span>Type</span>
                  <select className="input" value={form.tech} onChange={e => setForm(f => ({ ...f, tech: e.target.value }))}>
                    {TECHS.map(t => <option key={t}>{t}</option>)}
                  </select></label>
              </div>
              <label className="fld"><span>Bars (0–5): {form.bars}</span>
                <input type="range" min="0" max="5" value={form.bars} onChange={e => setForm(f => ({ ...f, bars: e.target.value }))} /></label>
              <label className="fld"><span>Note (optional)</span>
                <input className="input" maxLength={140} value={form.note} placeholder="e.g. 1 bar on the ridge only" onChange={e => setForm(f => ({ ...f, note: e.target.value }))} /></label>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-rust" type="submit">Add report</button>
                <button className="btn btn-ghost" type="button" onClick={() => { setDraft(null); if (draftM.current && map.current) { map.current.removeLayer(draftM.current); draftM.current = null; } }}>Cancel</button>
              </div>
              <p className="cov-msg">{msg}</p>
            </form>
          ) : (
            <>
              <p className="cov-hint">Tap the map where you got (or lost) reception, then log the carrier and how many bars. Your report helps the next person crossing that stretch.</p>
              <p className="cov-msg">{msg}</p>
            </>
          )}
        </aside>
        <div id="covmap" ref={mapEl} />
      </div>
      <Footer />
    </>
  );
}
