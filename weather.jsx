import { useState, useEffect, useRef } from 'react';

const SENSORS = [
  { key: 'bme680_temp',     label: 'Temperature',        unit: '°C',  icon: '🌡', group: 'environment', sensor: 'BME680' },
  { key: 'bme680_humidity', label: 'Humidity',            unit: '%',   icon: '💧', group: 'environment', sensor: 'BME680' },
  { key: 'bme680_pressure', label: 'Barometric Pressure', unit: 'hPa', icon: '🔵', group: 'environment', sensor: 'BME680' },
  { key: 'bme680_gas',      label: 'VOC / Gas Resistance',unit: 'kΩ', icon: '🌫', group: 'environment', sensor: 'BME680' },
  { key: 'scd41_co2',       label: 'CO₂',                unit: 'ppm', icon: '🫁', group: 'environment', sensor: 'SCD41' },
  { key: 'scd41_temp',      label: 'Temperature (SCD41)', unit: '°C', icon: '🌡', group: 'environment', sensor: 'SCD41' },
  { key: 'scd41_humidity',  label: 'Humidity (SCD41)',    unit: '%',   icon: '💧', group: 'environment', sensor: 'SCD41' },
  { key: 'sen0322_o2',      label: 'Oxygen (O₂)',        unit: '%Vol',icon: '🅾️', group: 'gas', sensor: 'SEN0322' },
  { key: 'sen0567_nh3',     label: 'Ammonia (NH₃)',      unit: 'ppm', icon: '⚗️', group: 'gas', sensor: 'SEN0567' },
  { key: 'sen0572_h2',      label: 'Hydrogen (H₂)',      unit: 'ppm', icon: '⚡', group: 'gas', sensor: 'SEN0572' },
  { key: 'sen0565_ch4',     label: 'Methane (CH₄)',      unit: 'ppm', icon: '🔥', group: 'gas', sensor: 'SEN0565' },
  { key: 'sen0564_co',      label: 'Carbon Monoxide (CO)',unit: 'ppm', icon: '☠️', group: 'gas', sensor: 'SEN0564' },
  { key: 'sen0568_h2s',     label: 'Hydrogen Sulfide (H₂S)', unit: 'ppm', icon: '🥚', group: 'gas', sensor: 'SEN0568' },
  { key: 'mq4_combustible', label: 'Combustible Gas',    unit: 'ppm', icon: '💥', group: 'gas', sensor: 'MQ-4', note: 'CH₄, C₃H₈, C₄H₁₀' },
  { key: 'mmc5603_x',       label: 'Magnetic X',         unit: 'µT',  icon: '🧭', group: 'magnetic', sensor: 'MMC5603' },
  { key: 'mmc5603_y',       label: 'Magnetic Y',         unit: 'µT',  icon: '🧭', group: 'magnetic', sensor: 'MMC5603' },
  { key: 'mmc5603_z',       label: 'Magnetic Z',         unit: 'µT',  icon: '🧭', group: 'magnetic', sensor: 'MMC5603' },
  { key: 'mmc5603_heading',  label: 'Compass Heading',   unit: '°',   icon: '🧭', group: 'magnetic', sensor: 'MMC5603' },
];

const GROUPS = [
  { key: 'environment', label: 'Environment' },
  { key: 'gas',         label: 'Gas Detection' },
  { key: 'magnetic',    label: 'Magnetometer' },
];

function formatAge(ms) {
  if (ms < 60000) return `${Math.round(ms / 1000)}s ago`;
  if (ms < 3600000) return `${Math.round(ms / 60000)}m ago`;
  if (ms < 86400000) return `${Math.round(ms / 3600000)}h ago`;
  return `${Math.round(ms / 86400000)}d ago`;
}

function SensorCard({ def, value, ts }) {
  const age = ts ? Date.now() - ts : null;
  const stale = age !== null && age > 120000;
  const offline = value === null || value === undefined;

  return (
    <div className="card" style={{
      padding: '20px',
      display: 'flex', flexDirection: 'column', gap: 8,
      opacity: offline ? 0.5 : 1,
      borderLeft: stale ? '3px solid var(--ochre)' : offline ? '3px solid var(--line-strong)' : '3px solid var(--eucalyptus)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span className="eyebrow">{def.sensor}</span>
        {ts && <span className="mono" style={{ fontSize: 10, color: stale ? 'var(--ochre)' : 'var(--ink-3)' }}>
          {formatAge(age)}
        </span>}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <span style={{ fontSize: 36, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", lineHeight: 1 }}>
          {offline ? '—' : typeof value === 'number' ? value.toFixed(1) : value}
        </span>
        <span style={{ fontSize: 14, color: 'var(--ink-2)', fontFamily: "'JetBrains Mono', monospace" }}>{def.unit}</span>
      </div>
      <div style={{ fontSize: 13, color: 'var(--ink-2)' }}>
        {def.label}
        {def.note && <span style={{ fontSize: 11, color: 'var(--ink-3)', marginLeft: 6 }}>({def.note})</span>}
      </div>
    </div>
  );
}

function StationStatus({ latest, rtcTime }) {
  const online = latest && (Date.now() - latest.ts < 120000);
  return (
    <div className="card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
      <div style={{
        width: 10, height: 10, borderRadius: '50%',
        background: online ? 'var(--eucalyptus)' : 'var(--rust)',
        boxShadow: online ? '0 0 8px rgba(79,107,62,0.5)' : 'none',
      }} />
      <span style={{ fontWeight: 600, fontSize: 14 }}>
        Station {online ? 'Online' : 'Offline'}
      </span>
      {rtcTime && (
        <span className="mono" style={{ fontSize: 11, color: 'var(--ink-3)', marginLeft: 'auto' }}>
          RTC: {rtcTime}
        </span>
      )}
      <span className="tag tag-euc" style={{ marginLeft: rtcTime ? 0 : 'auto' }}>RPi + DS3231</span>
    </div>
  );
}

export default function WeatherApp() {
  const [latest, setLatest] = useState(null);
  const [history, setHistory] = useState([]);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState('live');
  const intervalRef = useRef(null);

  const fetchLatest = () => {
    fetch('/api/weather/latest')
      .then(r => r.json())
      .then(d => { if (d.reading) setLatest(d.reading); setError(null); })
      .catch(() => setError('Could not reach weather station API'));
  };

  const fetchHistory = () => {
    fetch('/api/weather/history?hours=24')
      .then(r => r.json())
      .then(d => { if (d.readings) setHistory(d.readings); })
      .catch(() => {});
  };

  useEffect(() => {
    fetchLatest();
    fetchHistory();
    intervalRef.current = setInterval(fetchLatest, 15000);
    return () => clearInterval(intervalRef.current);
  }, []);

  const readings = latest?.data || {};
  const rtcTime = latest?.rtc_time || null;

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Nav */}
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

      {/* Hero */}
      <div className="page-head">
        <div className="container">
          <span className="eyebrow">Live Environmental Monitoring</span>
          <h1 className="serif">Weather Station</h1>
          <p className="lead">
            Real-time sensor data from our Raspberry Pi monitoring station — temperature, humidity, pressure, air quality, and gas detection.
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="container" style={{ flex: 1, paddingTop: 32, paddingBottom: 48 }}>
        <StationStatus latest={latest} rtcTime={rtcTime} />

        {error && (
          <div style={{ marginTop: 16, padding: '12px 16px', background: '#f3d5c5', border: '1px solid #e8b898', color: '#7a3a18', fontSize: 13 }}>
            {error}
          </div>
        )}

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--line)', marginTop: 32 }}>
          {[['live', 'Live Readings'], ['sensors', 'Sensor Info']].map(([k, l]) => (
            <button key={k} className={`tab${tab === k ? ' active' : ''}`} onClick={() => setTab(k)} style={{
              padding: '10px 14px', fontSize: 13, fontWeight: 500, cursor: 'pointer',
              borderBottom: tab === k ? '2px solid var(--rust)' : '2px solid transparent',
              marginBottom: -1, background: 'none', border: 'none',
              borderBottomWidth: 2, borderBottomStyle: 'solid',
              borderBottomColor: tab === k ? 'var(--rust)' : 'transparent',
              color: tab === k ? 'var(--rust)' : 'var(--ink)',
            }}>
              {l}
            </button>
          ))}
        </div>

        {tab === 'live' && (
          <div style={{ marginTop: 24 }}>
            {GROUPS.map(g => (
              <div key={g.key} style={{ marginBottom: 32 }}>
                <h2 style={{ fontSize: 18, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
                  {g.label}
                </h2>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
                  gap: 16,
                }}>
                  {SENSORS.filter(s => s.group === g.key).map(def => (
                    <SensorCard key={def.key} def={def} value={readings[def.key] ?? null} ts={latest?.ts} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === 'sensors' && (
          <div style={{ marginTop: 24 }}>
            <div className="card-paper" style={{ padding: 24, overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--line)' }}>
                    <th style={{ padding: '8px 12px' }} className="eyebrow">Sensor</th>
                    <th style={{ padding: '8px 12px' }} className="eyebrow">Model</th>
                    <th style={{ padding: '8px 12px' }} className="eyebrow">Measures</th>
                    <th style={{ padding: '8px 12px' }} className="eyebrow">Range</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ['BME680', 'Bosch BME680', 'Temperature, humidity, pressure, VOC gas resistance', '–40–85°C, 0–100%, 300–1100hPa'],
                    ['SCD41', 'Sensirion SCD41', 'CO₂ concentration, temperature, humidity', '400–5000ppm CO₂'],
                    ['SEN0322', 'Gravity O₂ Sensor', 'Electrochemical oxygen detection (I2C)', '0–25%Vol'],
                    ['SEN0567', 'Fermion MEMS NH₃', 'Ammonia detection', '1–300ppm'],
                    ['SEN0572', 'Fermion MEMS H₂', 'Hydrogen detection', '0.1–1000ppm'],
                    ['SEN0565', 'Fermion MEMS CH₄', 'Methane detection', '1–10000ppm'],
                    ['SEN0564', 'Fermion MEMS CO', 'Carbon monoxide detection', '5–5000ppm'],
                    ['SEN0568', 'Fermion MEMS H₂S', 'Hydrogen sulfide detection', '0.5–50ppm'],
                    ['MQ-4', 'MQ-4', 'Combustible gas (methane, propane, butane)', 'Analog'],
                    ['MMC5603', 'MEMSIC MMC5603', '3-axis magnetometer / compass', '±30 Gauss'],
                    ['DS3231', 'DS3231 RTC', 'Real-time clock (±2ppm accuracy)', 'N/A'],
                  ].map(([id, model, meas, range]) => (
                    <tr key={id} style={{ borderBottom: '1px solid var(--line)' }}>
                      <td style={{ padding: '10px 12px', fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }}>{id}</td>
                      <td style={{ padding: '10px 12px' }}>{model}</td>
                      <td style={{ padding: '10px 12px' }}>{meas}</td>
                      <td style={{ padding: '10px 12px', fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }}>{range}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
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
