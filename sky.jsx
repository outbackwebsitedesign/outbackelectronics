// Sky — tonight's dark-sky window, moon phase (computed client-side) and a
// live aurora Kp reading from NOAA (via the backend, cached + graceful).
import { useState, useEffect, useMemo } from 'react';
import { TopNav, Footer } from './app-shell.jsx';

const LOCATIONS = [
  { label: 'Moama, NSW', lat: -35.86, lon: 144.76 },
  { label: 'Broken Hill, NSW', lat: -31.96, lon: 141.47 },
  { label: 'Alice Springs, NT', lat: -23.70, lon: 133.88 },
  { label: 'Perth, WA', lat: -31.95, lon: 115.86 },
  { label: 'Melbourne, VIC', lat: -37.81, lon: 144.96 },
  { label: 'Hobart, TAS', lat: -42.88, lon: 147.33 },
];

const MOON_NAMES = ['New Moon', 'Waxing Crescent', 'First Quarter', 'Waxing Gibbous', 'Full Moon', 'Waning Gibbous', 'Last Quarter', 'Waning Crescent'];
const MOON_GLYPHS = ['🌑', '🌒', '🌓', '🌔', '🌕', '🌖', '🌗', '🌘'];

function moonInfo(date) {
  const synodic = 29.530588853;
  const refNew = Date.UTC(2000, 0, 6, 18, 14, 0); // known new moon
  let age = ((date.getTime() - refNew) / 86400000) % synodic;
  if (age < 0) age += synodic;
  const illum = Math.round(50 * (1 - Math.cos((2 * Math.PI * age) / synodic)));
  const idx = Math.floor((age / synodic) * 8 + 0.5) % 8;
  return { age: age.toFixed(1), illum, name: MOON_NAMES[idx], glyph: MOON_GLYPHS[idx] };
}

// Compact NOAA-style solar event times → sunset (-0.833°) and astronomical dusk (-18°).
function sunTimes(lat, lon, date) {
  const rad = Math.PI / 180, deg = 180 / Math.PI;
  const jdRef = date.getTime() / 86400000 + 2440587.5 - 2451545.0 + 0.0008;
  const n = Math.round(jdRef - lon / 360);
  const Jstar = n - lon / 360;
  const M = (357.5291 + 0.98560028 * Jstar) % 360;
  const C = 1.9148 * Math.sin(M * rad) + 0.0200 * Math.sin(2 * M * rad) + 0.0003 * Math.sin(3 * M * rad);
  const lambda = (M + C + 282.9372) % 360;
  const delta = Math.asin(Math.sin(lambda * rad) * Math.sin(23.44 * rad)) * deg;
  const event = (angle) => {
    const cosH = (Math.sin(angle * rad) - Math.sin(lat * rad) * Math.sin(delta * rad)) / (Math.cos(lat * rad) * Math.cos(delta * rad));
    if (cosH > 1 || cosH < -1) return null;
    const H = Math.acos(cosH) * deg;
    const Jset = 2451545.0 + (Jstar + H / 360) + 0.0053 * Math.sin(M * rad) - 0.0069 * Math.sin(2 * lambda * rad);
    return new Date((Jset - 2440587.5) * 86400000);
  };
  return { sunset: event(-0.833), astroDusk: event(-18) };
}

const fmtTime = (d) => d ? d.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' }) : '—';

function rating(illum) {
  if (illum < 25) return ['Excellent', 'rate-excellent'];
  if (illum < 50) return ['Good', 'rate-good'];
  if (illum < 75) return ['Fair', 'rate-fair'];
  return ['Poor — bright moon', 'rate-poor'];
}

export default function SkyApp() {
  const [loc, setLoc] = useState(LOCATIONS[0]);
  const [aurora, setAurora] = useState(null);
  const now = new Date();

  useEffect(() => {
    fetch('/api/sky/aurora').then(r => r.json()).then(setAurora).catch(() => setAurora({ available: false }));
  }, []);

  const moon = useMemo(() => moonInfo(now), [now.getDate()]);
  const sun = useMemo(() => sunTimes(loc.lat, loc.lon, now), [loc, now.getDate()]);
  const [rateLabel, rateClass] = rating(moon.illum);
  const kp = aurora && aurora.available ? aurora.kp : null;
  const auroraChance = kp == null ? null
    : kp >= 7 ? 'Likely across southern states'
    : kp >= 5 ? 'Possible in Tasmania & southern VIC'
    : kp >= 4 ? 'Slight chance in Tasmania'
    : 'Unlikely tonight';

  return (
    <>
      <TopNav current="sky" />
      <main className="container svc-main">
        <header className="svc-head">
          <p className="eyebrow">Night sky · Aurora</p>
          <h1 className="serif svc-title">The sky tonight</h1>
          <p className="svc-sub">Dark-sky window, moon phase and live aurora forecast — so you know when to look up out here under the clearest skies in the world.</p>
        </header>

        <label className="fld sky-tools">
          <span>Location</span>
          <select className="input" value={loc.label} onChange={e => setLoc(LOCATIONS.find(l => l.label === e.target.value))}>
            {LOCATIONS.map(l => <option key={l.label} value={l.label}>{l.label}</option>)}
          </select>
        </label>

        <div className="sky-grid">
          <section className="sky-card">
            <h3>Dark-sky window</h3>
            <div className="sky-line"><span>Sunset</span><b>{fmtTime(sun.sunset)}</b></div>
            <div className="sky-line"><span>Full dark (astro)</span><b>{fmtTime(sun.astroDusk)}</b></div>
            <p className="sky-sub">True darkness begins once the sun is 18° below the horizon. Head out after astronomical dusk for the faintest stars.</p>
          </section>

          <section className="sky-card">
            <h3>Moon</h3>
            <div className="sky-moon">{moon.glyph}</div>
            <div className="sky-big" style={{ fontSize: 24, marginTop: 8 }}>{moon.name}</div>
            <p className="sky-sub">{moon.illum}% illuminated · {moon.age} days old</p>
            <span className={'sky-rate ' + rateClass}>Stargazing: {rateLabel}</span>
          </section>

          <section className="sky-card">
            <h3>Aurora Australis</h3>
            {aurora == null ? <p className="sky-sub">Loading live data…</p>
              : !aurora.available ? <p className="sky-sub">Live space-weather feed unavailable right now. Try again shortly.</p>
              : (<>
                  <div className="sky-big">Kp {kp}</div>
                  <div className="kp-bar"><div className="kp-fill" style={{ width: Math.min(100, (kp / 9) * 100) + '%' }} /></div>
                  <p className="sky-sub">{auroraChance}</p>
                </>)}
          </section>

          <section className="sky-card">
            <h3>Live trackers</h3>
            <p className="sky-sub" style={{ marginTop: 0 }}>Spot the ISS and Starlink trains passing over your patch:</p>
            <div className="sky-track">
              <a className="btn btn-ghost btn-sm" href="https://spotthestation.nasa.gov/sightings/" target="_blank" rel="noopener">ISS sightings →</a>
              <a className="btn btn-ghost btn-sm" href="https://findstarlink.com/" target="_blank" rel="noopener">Starlink trains →</a>
            </div>
          </section>
        </div>
      </main>
      <Footer />
    </>
  );
}
