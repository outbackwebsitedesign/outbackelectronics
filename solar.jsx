// Solar power planner — size a stand-alone off-grid solar + battery system.
// Pure client-side: appliance loads → daily Wh → array watts + battery Ah,
// using worst-case winter peak-sun-hours and a derate for real-world losses.
import { useState, useMemo } from 'react';
import { TopNav, Footer, useShopInfo } from './app-shell.jsx';

const PSH_PRESETS = [
  { label: 'Far North QLD / Top End', psh: 5.0 },
  { label: 'Outback interior (NT/SA/WA)', psh: 4.8 },
  { label: 'Central NSW / Riverina (Moama)', psh: 3.6 },
  { label: 'Sydney / Adelaide', psh: 3.4 },
  { label: 'Melbourne / VIC', psh: 3.0 },
  { label: 'Tasmania', psh: 2.6 },
];

const BATTERIES = [
  { label: 'LiFePO₄ (lithium)', dod: 0.9 },
  { label: 'AGM / Gel (sealed lead-acid)', dod: 0.5 },
  { label: 'Flooded lead-acid', dod: 0.5 },
];

const STARTER_APPLIANCES = [
  { name: 'LED lights', watts: 10, hours: 5, qty: 4 },
  { name: '12V fridge / freezer', watts: 45, hours: 24, qty: 1 },
  { name: 'Phone / laptop charging', watts: 30, hours: 3, qty: 2 },
  { name: 'Water pump', watts: 60, hours: 1, qty: 1 },
  { name: 'Starlink / satellite', watts: 50, hours: 12, qty: 1 },
];

const num = (v, d = 0) => { const n = parseFloat(v); return isFinite(n) ? n : d; };

export default function SolarApp() {
  const info = useShopInfo();
  const [appliances, setAppliances] = useState(STARTER_APPLIANCES);
  const [psh, setPsh] = useState(3.6);
  const [autonomy, setAutonomy] = useState(2);
  const [systemV, setSystemV] = useState(24);
  const [dod, setDod] = useState(0.9);
  const [panelW, setPanelW] = useState(200);
  const derate = 0.75;

  const update = (i, k, v) => setAppliances(a => a.map((row, j) => j === i ? { ...row, [k]: v } : row));
  const remove = (i) => setAppliances(a => a.filter((_, j) => j !== i));
  const add = () => setAppliances(a => [...a, { name: 'New load', watts: 0, hours: 0, qty: 1 }]);

  const r = useMemo(() => {
    const dailyWh = appliances.reduce((s, a) => s + num(a.watts) * num(a.hours) * num(a.qty, 1), 0);
    const arrayW = psh > 0 ? dailyWh / (psh * derate) : 0;
    const batteryWh = dod > 0 ? (dailyWh * autonomy) / dod : 0;
    const batteryAh = systemV > 0 ? batteryWh / systemV : 0;
    const panels = panelW > 0 ? Math.ceil(arrayW / panelW) : 0;
    return { dailyWh, arrayW, batteryWh, batteryAh, panels };
  }, [appliances, psh, autonomy, systemV, dod, panelW]);

  const shopHref = info && info.siteUrl ? info.siteUrl + '/shop' : undefined;
  const quoteHref = info && info.siteUrl ? info.siteUrl + '/quote' : undefined;

  return (
    <>
      <TopNav current="solar" />
      <main className="container svc-main">
        <header className="svc-head">
          <p className="eyebrow">Off-grid · Power</p>
          <h1 className="serif svc-title">Solar power planner</h1>
          <p className="svc-sub">Size a stand-alone solar + battery system for life off the grid. Built for worst-case winter sun, the way it should be done out bush.</p>
        </header>

        <div className="solar-grid">
          <section className="solar-panel">
            <h2 className="svc-h2">1 · Your daily loads</h2>
            <div className="appl-head"><span>Appliance</span><span>Watts</span><span>Hrs/day</span><span>Qty</span><span></span></div>
            {appliances.map((a, i) => (
              <div className="appl-row" key={i}>
                <input className="input" value={a.name} onChange={e => update(i, 'name', e.target.value)} aria-label="Appliance name" />
                <input className="input" type="number" min="0" value={a.watts} onChange={e => update(i, 'watts', e.target.value)} aria-label="Watts" />
                <input className="input" type="number" min="0" max="24" value={a.hours} onChange={e => update(i, 'hours', e.target.value)} aria-label="Hours per day" />
                <input className="input" type="number" min="1" value={a.qty} onChange={e => update(i, 'qty', e.target.value)} aria-label="Quantity" />
                <button className="appl-x" onClick={() => remove(i)} aria-label="Remove load">×</button>
              </div>
            ))}
            <button className="btn btn-ghost btn-sm" onClick={add}>+ Add load</button>

            <h2 className="svc-h2" style={{ marginTop: 26 }}>2 · Your setup</h2>
            <label className="fld">
              <span>Location — winter peak sun hours</span>
              <select className="input" value={psh} onChange={e => setPsh(num(e.target.value))}>
                {PSH_PRESETS.map(p => <option key={p.label} value={p.psh}>{p.label} — {p.psh} h</option>)}
              </select>
            </label>
            <div className="fld-row">
              <label className="fld"><span>Days of autonomy</span>
                <input className="input" type="number" min="1" value={autonomy} onChange={e => setAutonomy(num(e.target.value, 1))} /></label>
              <label className="fld"><span>System voltage</span>
                <select className="input" value={systemV} onChange={e => setSystemV(num(e.target.value))}>
                  <option value={12}>12 V</option><option value={24}>24 V</option><option value={48}>48 V</option>
                </select></label>
            </div>
            <div className="fld-row">
              <label className="fld"><span>Battery type</span>
                <select className="input" value={dod} onChange={e => setDod(num(e.target.value))}>
                  {BATTERIES.map(b => <option key={b.label} value={b.dod}>{b.label}</option>)}
                </select></label>
              <label className="fld"><span>Panel size</span>
                <select className="input" value={panelW} onChange={e => setPanelW(num(e.target.value))}>
                  <option value={120}>120 W</option><option value={200}>200 W</option><option value={300}>300 W</option><option value={415}>415 W</option>
                </select></label>
            </div>
          </section>

          <section className="solar-results">
            <h2 className="svc-h2">Recommended system</h2>
            <div className="res-big">
              <div className="res-card"><b>{(r.dailyWh / 1000).toFixed(2)}</b><span>kWh / day</span></div>
              <div className="res-card hl"><b>{Math.round(r.arrayW)}</b><span>Watts solar</span></div>
              <div className="res-card hl"><b>{Math.round(r.batteryAh)}</b><span>Ah @ {systemV}V</span></div>
            </div>
            <ul className="res-list">
              <li><span>Daily energy</span><b>{Math.round(r.dailyWh)} Wh</b></li>
              <li><span>Solar array</span><b>≈ {r.panels} × {panelW} W panels</b></li>
              <li><span>Battery bank</span><b>{(r.batteryWh / 1000).toFixed(2)} kWh usable</b></li>
              <li><span>Autonomy</span><b>{autonomy} day(s) no sun</b></li>
            </ul>
            <p className="res-note">Estimates assume winter peak-sun-hours and a {Math.round(derate * 100)}% derate for wiring, heat and controller losses. Round up for hard country.</p>
            <div className="res-cta">
              {shopHref ? <a className="btn btn-rust" href={shopHref}>Shop off-grid kits →</a> : null}
              {quoteHref ? <a className="btn btn-ghost" href={quoteHref}>Get a custom quote</a> : null}
            </div>
          </section>
        </div>
      </main>
      <Footer />
    </>
  );
}
