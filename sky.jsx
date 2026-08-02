import { useState, useEffect, useMemo, lazy, Suspense } from 'react';
import { TopNav, Footer } from './app-shell.jsx';
import { METEOR_SHOWERS } from './src/star-data.js';

const SkyDome = lazy(() => import('./sky-dome.jsx'));

// ── Constants ──────────────────────────────────────────────────────────────
const LOCATIONS = [
  { label: 'Moama, NSW',       lat: -35.86, lon: 144.76 },
  { label: 'Broken Hill, NSW', lat: -31.96, lon: 141.47 },
  { label: 'Alice Springs, NT',lat: -23.70, lon: 133.88 },
  { label: 'Perth, WA',        lat: -31.95, lon: 115.86 },
  { label: 'Melbourne, VIC',   lat: -37.81, lon: 144.96 },
  { label: 'Hobart, TAS',      lat: -42.88, lon: 147.33 },
  { label: 'Darwin, NT',       lat: -12.46, lon: 130.84 },
  { label: 'Brisbane, QLD',    lat: -27.47, lon: 153.02 },
  { label: 'Adelaide, SA',     lat: -34.93, lon: 138.60 },
];

const PI = Math.PI, RAD = PI / 180;

// ── Julian Day ─────────────────────────────────────────────────────────────
function julianDay(date) {
  const Y = date.getUTCFullYear(), M = date.getUTCMonth() + 1, D = date.getUTCDate();
  const h = date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600;
  let a = Math.floor((14 - M) / 12);
  let y = Y + 4800 - a, m = M + 12 * a - 3;
  let jdn = D + Math.floor((153 * m + 2) / 5) + 365 * y + Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400) - 32045;
  return jdn + (h - 12) / 24;
}

function gmstDeg(date) {
  const jd = julianDay(date);
  const T = (jd - 2451545.0) / 36525;
  let g = 280.46061837 + 360.98564736629 * (jd - 2451545.0) + 0.000387933 * T * T;
  return ((g % 360) + 360) % 360;
}

// ── Sun position ───────────────────────────────────────────────────────────
function sunPosition(date) {
  const jd = julianDay(date);
  const T = (jd - 2451545.0) / 36525;
  const L0 = (280.46646 + 36000.76983 * T) % 360;
  const M = ((357.52911 + 35999.05029 * T) % 360) * RAD;
  const C = (1.914602 - 0.004817 * T) * Math.sin(M)
           + 0.019993 * Math.sin(2 * M)
           + 0.000289 * Math.sin(3 * M);
  const sunLon = (L0 + C + 360) % 360;
  const eps = (23.439291 - 0.013004 * T) * RAD;
  const lRad = sunLon * RAD;
  const ra = Math.atan2(Math.cos(eps) * Math.sin(lRad), Math.cos(lRad)) / RAD;
  const dec = Math.asin(Math.sin(eps) * Math.sin(lRad)) / RAD;
  return { ra: (ra + 360) % 360, dec };
}

// ── Sun event times (given depression angle) ───────────────────────────────
// Returns rise and set times as Date objects, or null if no crossing.
function sunEvent(date, lat, lon, depression) {
  const { ra, dec } = sunPosition(date);
  const decRad = dec * RAD, latRad = lat * RAD;
  const angle = depression * RAD;
  const cosH = (Math.sin(angle) - Math.sin(latRad) * Math.sin(decRad))
             / (Math.cos(latRad) * Math.cos(decRad));
  if (cosH < -1 || cosH > 1) return { rise: null, set: null };
  const H = Math.acos(cosH) / RAD; // in degrees

  // Solar noon in local time = 12 - eqTime - (lon - stdMeridian)/15
  // Simpler: solar noon when GMST + lon = ra (mod 360)
  const gmst0 = gmstDeg(new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0)));
  const noonUT = 12 - ((gmst0 + lon - ra + 540) % 360 - 180) / 15;

  const riseUT = noonUT - H / 15;
  const setUT  = noonUT + H / 15;

  function utToDate(utHours) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    d.setUTCMinutes(Math.round(utHours * 60));
    return d;
  }
  return { rise: utToDate(riseUT), set: utToDate(setUT) };
}

// ── Solar noon ─────────────────────────────────────────────────────────────
function solarNoon(date, lat, lon) {
  const { ra } = sunPosition(date);
  const gmst0 = gmstDeg(new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0)));
  const noonUT = 12 - ((gmst0 + lon - ra + 540) % 360 - 180) / 15;
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCMinutes(Math.round(noonUT * 60));
  return d;
}

// ── Current sun altitude ───────────────────────────────────────────────────
function sunAltitude(date, lat, lon) {
  const { ra, dec } = sunPosition(date);
  const gmst = gmstDeg(date);
  const lmst = (gmst + lon + 360) % 360;
  const H = (lmst - ra) * RAD;
  const sinAlt = Math.sin(lat * RAD) * Math.sin(dec * RAD) + Math.cos(lat * RAD) * Math.cos(dec * RAD) * Math.cos(H);
  return Math.asin(Math.max(-1, Math.min(1, sinAlt))) / RAD;
}

// ── Moon position (simplified ELP2000) ────────────────────────────────────
function moonPosition(date) {
  const d = julianDay(date) - 2451545.0;
  const L = ((218.316 + 13.176396 * d) % 360 + 360) % 360;
  const M = ((134.963 + 13.064993 * d) % 360 + 360) % 360 * RAD;
  const F = ((93.272  + 13.229350 * d) % 360 + 360) % 360 * RAD;
  const lon = (L + 6.289 * Math.sin(M)) * RAD;
  const lat = (5.128 * Math.sin(F)) * RAD;
  const eps = (23.439 - 0.0000004 * d) * RAD;
  const ra = Math.atan2(Math.sin(lon) * Math.cos(eps) - Math.tan(lat) * Math.sin(eps), Math.cos(lon)) / RAD;
  const dec = Math.asin(Math.sin(lat) * Math.cos(eps) + Math.cos(lat) * Math.sin(eps) * Math.sin(lon)) / RAD;
  const dist = 385001 - 20905 * Math.cos(M);
  return { ra: (ra + 360) % 360, dec, dist };
}

// ── Moon rise/set ─────────────────────────────────────────────────────────
function moonRiseSet(date, lat, lon) {
  // Sample moon position at noon, use for the whole day (good ~4 min accuracy)
  const noon = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0));
  const { ra, dec } = moonPosition(noon);
  const decRad = dec * RAD, latRad = lat * RAD;
  const h0 = 0.125 * RAD; // adjusted for parallax + refraction
  const cosH = (Math.sin(h0) - Math.sin(latRad) * Math.sin(decRad))
             / (Math.cos(latRad) * Math.cos(decRad));
  if (cosH < -1) return { rise: null, set: null, circumpolar: true };
  if (cosH >  1) return { rise: null, set: null, circumpolar: false };
  const H = Math.acos(cosH) / RAD;

  const gmst0 = gmstDeg(new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0)));
  const noonUT = 12 - ((gmst0 + lon - ra + 540) % 360 - 180) / 15;
  const riseUT = noonUT - H / 15;
  const setUT  = noonUT + H / 15;

  function utToDate(utHours) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    d.setUTCMinutes(Math.round(utHours * 60));
    return d;
  }
  return { rise: utToDate(riseUT), set: utToDate(setUT), circumpolar: false };
}

// ── Moon phase ────────────────────────────────────────────────────────────
const MOON_NAMES  = ['New Moon','Waxing Crescent','First Quarter','Waxing Gibbous','Full Moon','Waning Gibbous','Last Quarter','Waning Crescent'];
const MOON_GLYPHS = ['🌑','🌒','🌓','🌔','🌕','🌖','🌗','🌘'];

function moonPhase(date) {
  const synodic = 29.530588853;
  const refNew = Date.UTC(2000, 0, 6, 18, 14, 0);
  let age = ((date.getTime() - refNew) / 86400000) % synodic;
  if (age < 0) age += synodic;
  const illum = Math.round(50 * (1 - Math.cos((2 * PI * age) / synodic)));
  const idx = Math.floor((age / synodic) * 8 + 0.5) % 8;
  return { age: age.toFixed(1), illum, name: MOON_NAMES[idx], glyph: MOON_GLYPHS[idx] };
}

// ── Next moon phases ───────────────────────────────────────────────────────
function nextMoonPhases(date) {
  const synodic = 29.530588853;
  const refNew = Date.UTC(2000, 0, 6, 18, 14, 0);
  let age = ((date.getTime() - refNew) / 86400000) % synodic;
  if (age < 0) age += synodic;
  const phases = [
    { name: 'New Moon',    target: 0 },
    { name: 'First Qtr',  target: synodic * 0.25 },
    { name: 'Full Moon',  target: synodic * 0.5 },
    { name: 'Last Qtr',   target: synodic * 0.75 },
  ];
  return phases.map(({ name, target }) => {
    let daysAway = target - age;
    if (daysAway <= 0) daysAway += synodic;
    const d = new Date(date.getTime() + daysAway * 86400000);
    return { name, date: d };
  }).sort((a, b) => a.date - b.date);
}

// ── Solstice / equinox ────────────────────────────────────────────────────
function nextSolsticesEquinoxes(date) {
  const year = date.getFullYear();
  function jde(Y, k) {
    // Mean JDE for equinox/solstice (Meeus Table 27.a simplified)
    const JDE0 = [
      2451623.80984 + 365242.37404 * (Y - 2000) / 1000,
      2451716.56767 + 365241.62603 * (Y - 2000) / 1000,
      2451810.21715 + 365242.01767 * (Y - 2000) / 1000,
      2451900.05952 + 365242.74049 * (Y - 2000) / 1000,
    ];
    return new Date((JDE0[k] - 2440587.5) * 86400000);
  }
  const events = [];
  for (let y = year; y <= year + 1; y++) {
    const Y = (y - 2000) / 1000;
    events.push(
      { name: 'March Equinox',    date: jde(Y, 0) },
      { name: 'June Solstice',    date: jde(Y, 1) },
      { name: 'September Equinox',date: jde(Y, 2) },
      { name: 'December Solstice',date: jde(Y, 3) },
    );
  }
  return events.filter(e => e.date > date).slice(0, 4);
}

// ── Planet visibility ─────────────────────────────────────────────────────
const PLANET_ELEMS = {
  Mercury: { L0: 252.25, n: 4.09234 },
  Venus:   { L0: 181.98, n: 1.60213 },
  Mars:    { L0: 355.45, n: 0.52403 },
  Jupiter: { L0: 34.40,  n: 0.08309 },
  Saturn:  { L0: 50.08,  n: 0.03346 },
};

function sunLon(jd) {
  const T = (jd - 2451545.0) / 36525;
  const L0 = (280.46646 + 36000.76983 * T) % 360;
  const M = ((357.52911 + 35999.05029 * T) % 360) * RAD;
  return (L0 + (1.914602 - 0.004817 * T) * Math.sin(M) + 0.019993 * Math.sin(2 * M) + 360) % 360;
}

function planetInfo(name, date, lat, lon) {
  const jd = julianDay(date);
  const d = jd - 2451545.0;
  const el = PLANET_ELEMS[name];
  const Lp = ((el.L0 + el.n * d) % 360 + 360) % 360;
  const eps = (23.439 - 0.013004 * d / 36525) * RAD;
  const lRad = Lp * RAD;
  const ra = ((Math.atan2(Math.cos(eps) * Math.sin(lRad), Math.cos(lRad)) / RAD) + 360) % 360;
  const dec = Math.asin(Math.sin(eps) * Math.sin(lRad)) / RAD;

  // Elongation from sun
  const Ls = sunLon(jd);
  let elong = Lp - Ls;
  if (elong > 180) elong -= 360;
  if (elong < -180) elong += 360;

  // Rise time estimate using same method as moon
  const decRad = dec * RAD, latRad = lat * RAD;
  const h0 = -0.833 * RAD;
  const cosH = (Math.sin(h0) - Math.sin(latRad) * Math.sin(decRad))
             / (Math.cos(latRad) * Math.cos(decRad));
  let rise = null, set = null;
  if (cosH >= -1 && cosH <= 1) {
    const H = Math.acos(cosH) / RAD;
    const gmst0 = gmstDeg(new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0)));
    const noonUT = 12 - ((gmst0 + lon - ra + 540) % 360 - 180) / 15;
    const riseUT = noonUT - H / 15;
    const setUT  = noonUT + H / 15;
    const base = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    rise = new Date(base.getTime() + riseUT * 3600000);
    set  = new Date(base.getTime() + setUT  * 3600000);
  }

  // Current altitude
  const gmst = gmstDeg(date);
  const lmst = (gmst + lon + 360) % 360;
  const H_now = (lmst - ra) * RAD;
  const sinAlt = Math.sin(latRad) * Math.sin(dec * RAD) + Math.cos(latRad) * Math.cos(dec * RAD) * Math.cos(H_now);
  const altNow = Math.asin(Math.max(-1, Math.min(1, sinAlt))) / RAD;

  const visible = altNow > 0 || (rise !== null && set !== null);
  const conjunction = Math.abs(elong) < 20;

  return { rise, set, altNow, elong: elong.toFixed(0), visible, conjunction };
}

// ── Next meteor showers ────────────────────────────────────────────────────
function nextMeteorShowers(date, n = 3) {
  const yr = date.getFullYear();
  const all = [];
  for (let y = yr; y <= yr + 1; y++) {
    for (const s of METEOR_SHOWERS) {
      const d = new Date(y, s.peak[0] - 1, s.peak[1]);
      all.push({ ...s, date: d });
    }
  }
  return all.filter(s => s.date >= date).sort((a, b) => a.date - b.date).slice(0, n);
}

// ── Galactic center visibility ─────────────────────────────────────────────
function galacticCenterAlt(date, lat, lon) {
  // Galactic center: RA=17h45m = 266.4°, Dec=-29.0°
  const ra = 266.4, dec = -29.0;
  const gmst = gmstDeg(date);
  const lmst = (gmst + lon + 360) % 360;
  const H = (lmst - ra) * RAD;
  const sinAlt = Math.sin(lat * RAD) * Math.sin(dec * RAD) + Math.cos(lat * RAD) * Math.cos(dec * RAD) * Math.cos(H);
  return Math.asin(Math.max(-1, Math.min(1, sinAlt))) / RAD;
}

// ── Stargazing rating ──────────────────────────────────────────────────────
function rating(illum) {
  if (illum < 25) return ['Excellent', 'rate-excellent'];
  if (illum < 50) return ['Good',      'rate-good'];
  if (illum < 75) return ['Fair',      'rate-fair'];
  return ['Poor, bright moon', 'rate-poor'];
}

// ── Format helpers ─────────────────────────────────────────────────────────
const fmtTime = d => d ? d.toLocaleTimeString('en-AU', { timeZone: 'Australia/Sydney', hour: 'numeric', minute: '2-digit' }) : '-';
const fmtDate = d => d ? d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' }) : '-';
const fmtDuration = mins => `${Math.floor(mins / 60)}h ${mins % 60}m`;

// ── Component ──────────────────────────────────────────────────────────────
export default function SkyApp() {
  const [geoLoc, setGeoLoc] = useState(null);    // {lat, lon, label} from GPS
  const [search, setSearch] = useState('');       // fallback search text
  const [manualLoc, setManualLoc] = useState(null); // picked from search
  const [geoState, setGeoState] = useState('loading'); // 'loading'|'ok'|'denied'
  const [aurora, setAurora] = useState(null);
  const [issPasses, setIssPasses] = useState(null);
  const [issPos, setIssPos] = useState(null);
  const [now, setNow] = useState(new Date());

  const activeLoc = geoLoc || manualLoc || LOCATIONS[0];

  // Auto-detect on mount
  useEffect(() => {
    if (!navigator.geolocation) { setGeoState('denied'); return; }
    navigator.geolocation.getCurrentPosition(
      pos => {
        setGeoLoc({ lat: pos.coords.latitude, lon: pos.coords.longitude, label: null });
        setGeoState('ok');
      },
      () => setGeoState('denied'),
      { timeout: 10000 },
    );
  }, []);

  // Search suggestions
  const suggestions = search.length > 1
    ? LOCATIONS.filter(l => l.label.toLowerCase().includes(search.toLowerCase()))
    : [];

  useEffect(() => {
    fetch('/api/sky/aurora').then(r => r.json()).then(setAurora).catch(() => setAurora({ available: false }));
  }, []);

  // Fetch ISS passes whenever location is known
  useEffect(() => {
    const { lat, lon } = activeLoc;
    if (lat == null || lon == null) return;
    fetch(`/api/sky/iss?lat=${lat}&lon=${lon}`)
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(d => setIssPasses(d.ok ? d.passes : []))
      .catch(() => setIssPasses(null));
  }, [activeLoc.lat ?? 0, activeLoc.lon ?? 0]);

  // Live ISS position every 10 s
  useEffect(() => {
    function fetchPos() {
      fetch('/api/sky/iss?mode=now').then(r => r.json()).then(d => d.ok && setIssPos(d)).catch(() => {});
    }
    fetchPos();
    const t = setInterval(fetchPos, 10000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(t);
  }, []);

  // ── Sun events ──────────────────────────────────────────────────────────
  const sunEvents = useMemo(() => ({
    civil:  sunEvent(now, activeLoc.lat, activeLoc.lon, 6),
    naut:   sunEvent(now, activeLoc.lat, activeLoc.lon, 12),
    astro:  sunEvent(now, activeLoc.lat, activeLoc.lon, 18),
    day:    sunEvent(now, activeLoc.lat, activeLoc.lon, -0.833),
    noon:   solarNoon(now, activeLoc.lat, activeLoc.lon),
    alt:    sunAltitude(now, activeLoc.lat, activeLoc.lon),
  }), [activeLoc, now.toDateString()]);

  const dayLength = useMemo(() => {
    if (!sunEvents.day.rise || !sunEvents.day.set) return null;
    return Math.round((sunEvents.day.set - sunEvents.day.rise) / 60000);
  }, [sunEvents]);

  // ── Moon ────────────────────────────────────────────────────────────────
  const moon = useMemo(() => moonPhase(now), [now.toDateString()]);
  const moonRS = useMemo(() => moonRiseSet(now, activeLoc.lat, activeLoc.lon), [activeLoc, now.toDateString()]);
  const moonPos = useMemo(() => moonPosition(now), [now.toDateString()]);
  const nextPhases = useMemo(() => nextMoonPhases(now), [now.toDateString()]);
  const [rateLabel, rateClass] = rating(moon.illum);

  // ── Planets ─────────────────────────────────────────────────────────────
  const planets = useMemo(() => {
    return Object.keys(PLANET_ELEMS).map(name => ({
      name,
      ...planetInfo(name, now, activeLoc.lat, activeLoc.lon),
    }));
  }, [activeLoc, now.toDateString()]);

  // ── Other ───────────────────────────────────────────────────────────────
  const kp = aurora?.available ? aurora.kp : null;
  const auroraChance = kp == null ? null
    : kp >= 7 ? 'Likely across southern states'
    : kp >= 5 ? 'Possible in Tasmania & southern VIC'
    : kp >= 4 ? 'Slight chance in Tasmania'
    : 'Unlikely tonight';

  const gcAlt = useMemo(() => galacticCenterAlt(now, activeLoc.lat, activeLoc.lon), [activeLoc, now.toDateString()]);
  const nextEvents = useMemo(() => nextSolsticesEquinoxes(now), [now.toDateString()]);
  const meteors = useMemo(() => nextMeteorShowers(now), [now.toDateString()]);

  return (
    <>
      <TopNav current="sky" />
      <main className="container svc-main">
        <header className="svc-head">
          <p className="eyebrow">Night sky · Aurora · Astronomy</p>
          <h1 className="serif svc-title">The sky tonight</h1>
          <p className="svc-sub">Dark-sky window, moon phase, planets and live aurora forecast for remote Australia. Drag the dome to explore tonight's sky.</p>
        </header>

        <div className="sky-loc-bar">
          <div className="sky-loc-pill">
            {geoState === 'loading' && <span className="sky-loc-status">Detecting location…</span>}
            {geoState === 'ok' && geoLoc && !manualLoc && (
              <span className="sky-loc-status sky-loc-live">
                📍 {geoLoc.lat.toFixed(4)}°, {geoLoc.lon.toFixed(4)}°
              </span>
            )}
            {(geoState === 'denied' || manualLoc) && (
              <span className="sky-loc-status">{manualLoc ? manualLoc.label : 'Location unavailable'}</span>
            )}
          </div>
          <div className="sky-loc-search-wrap">
            <input
              className="input sky-loc-search"
              type="text"
              placeholder="Search location…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              onBlur={() => setTimeout(() => setSearch(''), 200)}
            />
            {suggestions.length > 0 && (
              <div className="sky-loc-suggestions">
                {suggestions.map(l => (
                  <button key={l.label} className="sky-loc-suggestion" onMouseDown={() => {
                    setManualLoc(l);
                    setGeoLoc(null);
                    setSearch('');
                  }}>{l.label}</button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 3D Dome */}
        <div className="sky-dome-wrap">
          <Suspense fallback={<div className="sky-dome-loading">Loading star dome…</div>}>
            <SkyDome lat={activeLoc.lat} lon={activeLoc.lon} date={now} issPos={issPos} />
          </Suspense>
        </div>

        {/* Sun */}
        <section className="sky-section">
          <h2 className="sky-section-title">Sun</h2>
          <div className="sky-grid">
            <div className="sky-card">
              <h3>Today's daylight</h3>
              <div className="sky-line"><span>Sunrise</span><b>{fmtTime(sunEvents.day.rise)}</b></div>
              <div className="sky-line"><span>Solar noon</span><b>{fmtTime(sunEvents.noon)}</b></div>
              <div className="sky-line"><span>Sunset</span><b>{fmtTime(sunEvents.day.set)}</b></div>
              {dayLength && <div className="sky-line"><span>Day length</span><b>{fmtDuration(dayLength)}</b></div>}
              <p className="sky-sub" style={{ marginTop: 10 }}>
                Sun is currently {sunEvents.alt > 0 ? `${sunEvents.alt.toFixed(1)}° above` : `${Math.abs(sunEvents.alt).toFixed(1)}° below`} the horizon.
              </p>
            </div>
            <div className="sky-card">
              <h3>Twilight</h3>
              <div className="sky-line"><span>Astronomical dawn</span><b>{fmtTime(sunEvents.astro.rise)}</b></div>
              <div className="sky-line"><span>Nautical dawn</span><b>{fmtTime(sunEvents.naut.rise)}</b></div>
              <div className="sky-line"><span>Civil dawn</span><b>{fmtTime(sunEvents.civil.rise)}</b></div>
              <div className="sky-line" style={{ borderTop: '1px solid var(--line-strong)', marginTop: 6, paddingTop: 6 }}>
                <span>Civil dusk</span><b>{fmtTime(sunEvents.civil.set)}</b>
              </div>
              <div className="sky-line"><span>Nautical dusk</span><b>{fmtTime(sunEvents.naut.set)}</b></div>
              <div className="sky-line"><span>Astronomical dusk</span><b>{fmtTime(sunEvents.astro.set)}</b></div>
              <p className="sky-sub" style={{ marginTop: 10 }}>True darkness begins at astronomical dusk - 18° below horizon.</p>
            </div>
          </div>
        </section>

        {/* Moon */}
        <section className="sky-section">
          <h2 className="sky-section-title">Moon</h2>
          <div className="sky-grid">
            <div className="sky-card">
              <h3>Phase tonight</h3>
              <div className="sky-moon">{moon.glyph}</div>
              <div className="sky-big" style={{ fontSize: 24, marginTop: 8 }}>{moon.name}</div>
              <p className="sky-sub">{moon.illum}% illuminated · {moon.age} days old</p>
              <p className="sky-sub">Distance: {(moonPos.dist / 1000).toFixed(0)} km</p>
              <span className={'sky-rate ' + rateClass}>Stargazing: {rateLabel}</span>
            </div>
            <div className="sky-card">
              <h3>Rise &amp; set</h3>
              <div className="sky-line"><span>Moonrise</span><b>{fmtTime(moonRS.rise)}</b></div>
              <div className="sky-line"><span>Moonset</span><b>{fmtTime(moonRS.set)}</b></div>
              {moonRS.circumpolar && <p className="sky-sub">Moon is circumpolar tonight.</p>}
              <h3 style={{ marginTop: 16 }}>Coming phases</h3>
              {nextPhases.map(p => (
                <div key={p.name} className="sky-line">
                  <span>{p.name}</span><b>{fmtDate(p.date)}</b>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Planets */}
        <section className="sky-section">
          <h2 className="sky-section-title">Planets tonight</h2>
          <div className="sky-planet-table">
            <div className="sky-planet-row sky-planet-head">
              <span>Planet</span><span>Rise</span><span>Set</span><span>Alt now</span><span>Elongation</span><span>Visibility</span>
            </div>
            {planets.map(p => (
              <div key={p.name} className={'sky-planet-row' + (p.conjunction ? ' planet-conj' : '')}>
                <span><b>{p.name}</b></span>
                <span>{fmtTime(p.rise)}</span>
                <span>{fmtTime(p.set)}</span>
                <span>{p.altNow > 0 ? `${p.altNow.toFixed(0)}°` : '-'}</span>
                <span>{p.elong > 0 ? `E ${p.elong}°` : `W ${Math.abs(p.elong)}°`}</span>
                <span>
                  {p.conjunction ? <span className="sky-rate rate-poor">Near sun</span>
                   : p.altNow > 15 ? <span className="sky-rate rate-excellent">Good</span>
                   : p.altNow > 0  ? <span className="sky-rate rate-fair">Low</span>
                   : p.visible     ? <span className="sky-rate rate-good">Later</span>
                   : <span className="sky-rate rate-poor">Not tonight</span>}
                </span>
              </div>
            ))}
          </div>
          <p className="sky-sub" style={{ marginTop: 8 }}>Planet positions are approximate (±5°). Elongation measured from Sun, eastern = visible after sunset, western = before sunrise.</p>
        </section>

        {/* Aurora + Milky Way */}
        <section className="sky-section">
          <h2 className="sky-section-title">Space weather &amp; Milky Way</h2>
          <div className="sky-grid">
            <div className="sky-card">
              <h3>Aurora Australis</h3>
              {aurora == null
                ? <p className="sky-sub">Loading live data…</p>
                : !aurora.available
                ? <p className="sky-sub">Live space-weather feed unavailable. Try again shortly.</p>
                : (<>
                    <div className="sky-big">Kp {kp}</div>
                    <div className="kp-bar"><div className="kp-fill" style={{ width: Math.min(100, (kp / 9) * 100) + '%' }} /></div>
                    <p className="sky-sub">{auroraChance}</p>
                    <p className="sky-sub" style={{ marginTop: 6 }}>
                      Kp ≥ 5 may be visible from Tasmania. Kp ≥ 7 possible from southern VIC &amp; NSW.
                    </p>
                  </>)}
            </div>
            <div className="sky-card">
              <h3>Milky Way galactic centre</h3>
              <div className="sky-big" style={{ fontSize: 28 }}>
                {gcAlt > 0 ? `${gcAlt.toFixed(0)}° alt` : 'Below horizon'}
              </div>
              <p className="sky-sub" style={{ marginTop: 8 }}>
                {gcAlt > 20 ? 'Galactic centre is well placed, ideal Milky Way conditions.'
                 : gcAlt > 5 ? 'Galactic centre is low, rising towards better viewing.'
                 : 'Galactic centre is not visible tonight from this location.'}
              </p>
              <p className="sky-sub">Best months from Australia: May – October</p>
            </div>
          </div>
        </section>

        {/* Events calendar */}
        <section className="sky-section">
          <h2 className="sky-section-title">Coming events</h2>
          <div className="sky-grid">
            <div className="sky-card">
              <h3>Solstices &amp; Equinoxes</h3>
              {nextEvents.map(e => (
                <div key={e.name} className="sky-line">
                  <span>{e.name}</span>
                  <b>{e.date.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}</b>
                </div>
              ))}
            </div>
            <div className="sky-card">
              <h3>Meteor showers</h3>
              {meteors.map(m => (
                <div key={m.name} className="sky-event">
                  <div className="sky-event-head">
                    <span className="sky-event-name">{m.name}</span>
                    <b>{new Date(m.date.getFullYear(), m.date.getMonth(), m.date.getDate()).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}</b>
                  </div>
                  <p className="sky-sub" style={{ margin: '2px 0 8px' }}>{m.rate} ZHR · {m.note}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ISS */}
        <section className="sky-section">
          <h2 className="sky-section-title">ISS - International Space Station</h2>
          <div className="sky-grid">
            <div className="sky-card">
              <h3>Live position</h3>
              {issPos?.lat != null ? (<>
                <div className="sky-big" style={{ fontSize: 22, marginTop: 4 }}>
                  {Math.abs(issPos.lat).toFixed(2)}°{issPos.lat >= 0 ? 'N' : 'S'}, {Math.abs(issPos.lon).toFixed(2)}°{issPos.lon >= 0 ? 'E' : 'W'}
                </div>
                <div className="sky-line" style={{ marginTop: 10 }}><span>Altitude</span><b>{issPos.alt.toFixed(0)} km</b></div>
                <p className="sky-sub">Updated every 10 seconds. ISS orbits at ~28,000 km/h.</p>
              </>) : <p className="sky-sub">Loading…</p>}
            </div>

            <div className="sky-card">
              <h3>Upcoming passes, {activeLoc.label || (activeLoc.lat != null ? `${activeLoc.lat.toFixed(1)}°, ${activeLoc.lon.toFixed(1)}°` : '…')}</h3>
              {issPasses === null && <p className="sky-sub">Loading…</p>}
              {issPasses && issPasses.length === 0 && <p className="sky-sub">No visible passes in the next 5 days.</p>}
              {issPasses && issPasses.map((p, i) => {
                const rise = new Date(p.rise);
                const isNext = i === 0;
                return (
                  <div key={i} className={'iss-pass' + (isNext ? ' iss-pass-next' : '')}>
                    <div className="iss-pass-head">
                      <span className="iss-pass-date">
                        {rise.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' })}
                        {' '}
                        <b>{rise.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' })}</b>
                      </span>
                      <span className="iss-pass-el">Max {p.maxEl}°</span>
                    </div>
                    <div className="iss-pass-detail">
                      {Math.floor(p.duration / 60)}m {p.duration % 60}s &nbsp;·&nbsp;
                      {p.riseDir} → {p.maxDir} → {p.setDir}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="sky-track" style={{ marginTop: 12 }}>
            <a className="btn btn-ghost btn-sm" href="https://www.nasa.gov/spot-the-station/#Sightings" target="_blank" rel="noopener">NASA Spot the Station →</a>
            <a className="btn btn-ghost btn-sm" href="https://findstarlink.com/" target="_blank" rel="noopener">Starlink trains →</a>
            <a className="btn btn-ghost btn-sm" href="https://www.heavens-above.com/" target="_blank" rel="noopener">Heavens-Above →</a>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
