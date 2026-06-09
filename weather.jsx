import { useState, useEffect, useRef } from 'react';

const READINGS = [
  { key: 'temperature', label: 'Temperature',     unit: '°C',   group: 'environment' },
  { key: 'humidity',    label: 'Humidity',         unit: '%',    group: 'environment' },
  { key: 'pressure',    label: 'Pressure',         unit: 'hPa',  group: 'environment' },
  { key: 'voc',         label: 'Air Quality (VOC)',unit: 'kΩ',   group: 'environment', note: 'Higher = cleaner air' },
  { key: 'co2',         label: 'CO₂',             unit: 'ppm',  group: 'environment' },
  { key: 'o2',          label: 'Oxygen',           unit: '%Vol', group: 'gas' },
  { key: 'nh3',         label: 'Ammonia',          unit: 'ppm',  group: 'gas' },
  { key: 'h2',          label: 'Hydrogen',         unit: 'ppm',  group: 'gas' },
  { key: 'ch4',         label: 'Methane',          unit: 'ppm',  group: 'gas' },
  { key: 'co',          label: 'Carbon Monoxide',  unit: 'ppm',  group: 'gas' },
  { key: 'h2s',         label: 'Hydrogen Sulfide', unit: 'ppm',  group: 'gas' },
  { key: 'combustible', label: 'Combustible Gas',  unit: 'ppm',  group: 'gas', note: 'CH₄, C₃H₈, C₄H₁₀' },
  { key: 'compass',     label: 'Compass Heading',  unit: '°',    group: 'other' },
  { key: 'mag_x',       label: 'Magnetic Field X', unit: 'µT',   group: 'other' },
  { key: 'mag_y',       label: 'Magnetic Field Y', unit: 'µT',   group: 'other' },
  { key: 'mag_z',       label: 'Magnetic Field Z', unit: 'µT',   group: 'other' },
];

const GROUPS = [
  { key: 'environment', label: 'Environment' },
  { key: 'gas',         label: 'Gas Detection' },
  { key: 'other',       label: 'Other' },
];

function formatAge(ms) {
  if (ms < 60000) return `${Math.round(ms / 1000)}s ago`;
  if (ms < 3600000) return `${Math.round(ms / 60000)}m ago`;
  if (ms < 86400000) return `${Math.round(ms / 3600000)}h ago`;
  return `${Math.round(ms / 86400000)}d ago`;
}

function ReadingCard({ def, value, ts }) {
  const age = ts ? Date.now() - ts : null;
  const stale = age !== null && age > 120000;
  const offline = value === null || value === undefined;

  return (
    <div className="card" style={{
      padding: '20px',
      display: 'flex', flexDirection: 'column', gap: 8,
      opacity: offline ? 0.4 : 1,
      borderLeft: stale ? '3px solid var(--ochre)' : offline ? '3px solid var(--line-strong)' : '3px solid var(--eucalyptus)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 13, color: 'var(--ink-2)', fontWeight: 500 }}>{def.label}</span>
        {ts && !offline && <span className="mono" style={{ fontSize: 10, color: stale ? 'var(--ochre)' : 'var(--ink-3)' }}>
          {formatAge(age)}
        </span>}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <span style={{ fontSize: 36, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", lineHeight: 1 }}>
          {offline ? '—' : typeof value === 'number' ? value.toFixed(1) : value}
        </span>
        <span style={{ fontSize: 14, color: 'var(--ink-2)', fontFamily: "'JetBrains Mono', monospace" }}>{def.unit}</span>
      </div>
      {def.note && !offline && <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>{def.note}</div>}
    </div>
  );
}

function StationStatus({ latest, rtcTime, stationId }) {
  const online = latest && (Date.now() - latest.ts < 120000);
  const sensorCount = latest ? Object.keys(latest.data || {}).length : 0;
  return (
    <div className="card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
      <div style={{
        width: 10, height: 10, borderRadius: '50%',
        background: online ? 'var(--eucalyptus)' : 'var(--rust)',
        boxShadow: online ? '0 0 8px rgba(79,107,62,0.5)' : 'none',
      }} />
      <span style={{ fontWeight: 600, fontSize: 14 }}>
        {stationId ? stationId : 'Station'} — {online ? 'Online' : 'Offline'}
      </span>
      {online && sensorCount > 0 && (
        <span className="tag" style={{ marginLeft: 4 }}>{sensorCount} readings</span>
      )}
      {rtcTime && (
        <span className="mono" style={{ fontSize: 11, color: 'var(--ink-3)', marginLeft: 'auto' }}>
          {rtcTime}
        </span>
      )}
    </div>
  );
}

export default function WeatherApp() {
  const [latest, setLatest] = useState(null);
  const [history, setHistory] = useState([]);
  const [stations, setStations] = useState([]);
  const [activeStation, setActiveStation] = useState(null);
  const [error, setError] = useState(null);
  const [tick, setTick] = useState(0);
  const intervalRef = useRef(null);

  const fetchStations = () => {
    fetch('/api/weather/stations')
      .then(r => r.json())
      .then(d => { if (d.stations) setStations(d.stations); })
      .catch(() => {});
  };

  const fetchLatest = (stationId) => {
    const q = stationId ? `?station=${encodeURIComponent(stationId)}` : '';
    fetch(`/api/weather/latest${q}`)
      .then(r => r.json())
      .then(d => { if (d.reading) setLatest(d.reading); setError(null); })
      .catch(() => setError('Could not reach weather station API'));
  };

  const fetchHistory = (stationId) => {
    const q = stationId ? `&station=${encodeURIComponent(stationId)}` : '';
    fetch(`/api/weather/history?hours=24${q}`)
      .then(r => r.json())
      .then(d => { if (d.readings) setHistory(d.readings); })
      .catch(() => {});
  };

  useEffect(() => {
    fetchStations();
    fetchLatest(activeStation);
    fetchHistory(activeStation);
    intervalRef.current = setInterval(() => {
      fetchStations();
      fetchLatest(activeStation);
    }, 15000);
    return () => clearInterval(intervalRef.current);
  }, [activeStation]);

  useEffect(() => {
    const t = setInterval(() => setTick(n => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const data = latest?.data || {};
  const rtcTime = latest?.rtc_time || null;

  // Only show readings that have data (or all if nothing yet)
  const hasAnyData = Object.keys(data).length > 0;
  const visibleGroups = GROUPS.filter(g =>
    !hasAnyData || READINGS.some(r => r.group === g.key && data[r.key] !== undefined)
  );

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <nav className="topnav" id="topnav">
        <div className="container">
          <div className="row">
            <a className="logo" href="/">
              <div className="logo-mark">
                <img src="/logo.png" alt="OE" />
              </div>
              <div className="logo-text">
                <strong style={{ fontSize: 18 }}>Outback Electronics</strong>
                <div className="sub">Weather Station</div>
              </div>
            </a>
          </div>
        </div>
      </nav>

      <div className="page-head">
        <div className="container">
          <span className="eyebrow">Live Environmental Monitoring</span>
          <h1 className="serif">Weather Station</h1>
          <p className="lead">
            Real-time environmental data — temperature, humidity, pressure, air quality, and gas detection.
          </p>
        </div>
      </div>

      <div className="container" style={{ flex: 1, paddingTop: 32, paddingBottom: 48 }}>
        {stations.length > 1 && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
            <button className={`btn ${!activeStation ? 'btn-rust' : 'btn-ghost'}`} style={{ padding: '6px 12px', fontSize: 12 }}
              onClick={() => setActiveStation(null)}>All Stations</button>
            {stations.map(s => (
              <button key={s.id} className={`btn ${activeStation === s.id ? 'btn-rust' : 'btn-ghost'}`}
                style={{ padding: '6px 12px', fontSize: 12 }}
                onClick={() => setActiveStation(s.id)}>{s.id}</button>
            ))}
          </div>
        )}

        <StationStatus latest={latest} rtcTime={rtcTime} stationId={latest?.station_id} />

        {error && (
          <div style={{ marginTop: 16, padding: '12px 16px', background: '#f3d5c5', border: '1px solid #e8b898', color: '#7a3a18', fontSize: 13 }}>
            {error}
          </div>
        )}

        <div style={{ marginTop: 32 }}>
          {visibleGroups.map(g => {
            const groupReadings = READINGS.filter(r => r.group === g.key);
            const visible = hasAnyData ? groupReadings.filter(r => data[r.key] !== undefined) : groupReadings;
            if (visible.length === 0) return null;
            return (
              <div key={g.key} style={{ marginBottom: 32 }}>
                <h2 style={{ fontSize: 18, marginBottom: 16 }}>{g.label}</h2>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                  gap: 16,
                }}>
                  {visible.map(def => (
                    <ReadingCard key={def.key} def={def} value={data[def.key] ?? null} ts={latest?.ts} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <footer>
        <div className="container">
          <div className="baseline">
            <span>Outback Electronics — Weather Station</span>
            <span>Powered by Raspberry Pi</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
