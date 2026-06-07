import { useState, useCallback, useEffect, useRef, createContext, useContext } from 'react';

// ── Design tokens ─────────────────────────────────────────────────────────────
// Mapped to the shared site palette (see tools.html / index.html :root vars) so
// this page reads like the rest of outbackelectronics.com.au.
const C = {
  bg:      'var(--bg)',
  bgElev:  'var(--bg-elev)',
  bgDeep:  'var(--bg-deep)',
  ink:     'var(--ink)',
  ink2:    'var(--ink-2)',
  ink3:    'var(--ink-3)',
  blue:    'var(--rust)',        // primary accent
  ochre:   'var(--ochre)',
  green:   'var(--eucalyptus)',
  red:     '#b5451b',
  line:    'var(--line)',
  paper:   'var(--paper)',
};

// ── Wire data ─────────────────────────────────────────────────────────────────
// resistance in mΩ/m, current rating (A) at 60°C for automotive
const WIRE_TABLE = [
  { awg: '0000 (4/0)', mm2: 107, resistance: 0.16,  rating: 230 },
  { awg: '000 (3/0)',  mm2: 85,  resistance: 0.197, rating: 200 },
  { awg: '00 (2/0)',   mm2: 67.4,resistance: 0.253, rating: 175 },
  { awg: '0 (1/0)',    mm2: 53.5,resistance: 0.328, rating: 150 },
  { awg: '1',          mm2: 42.4,resistance: 0.411, rating: 130 },
  { awg: '2',          mm2: 33.6,resistance: 0.518, rating: 115 },
  { awg: '4',          mm2: 21.2,resistance: 0.821, rating: 95  },
  { awg: '6',          mm2: 13.3,resistance: 1.296, rating: 75  },
  { awg: '8',          mm2: 8.37,resistance: 2.060, rating: 55  },
  { awg: '10',         mm2: 5.26,resistance: 3.280, rating: 40  },
  { awg: '12',         mm2: 3.31,resistance: 5.210, rating: 30  },
  { awg: '14',         mm2: 2.08,resistance: 8.290, rating: 25  },
  { awg: '16',         mm2: 1.31,resistance: 13.17, rating: 18  },
  { awg: '18',         mm2: 0.82,resistance: 20.95, rating: 14  },
  { awg: '20',         mm2: 0.52,resistance: 33.31, rating: 11  },
  { awg: '22',         mm2: 0.33,resistance: 52.96, rating: 7   },
];

// ── Shared UI primitives ──────────────────────────────────────────────────────
// These lean on the shared site stylesheet (.field/.input/.select/.card-paper/
// .eyebrow/.btn etc.) so the calculators match the rest of the site.
function Field({ label, unit, value, onChange, type = 'number', min, step, options }) {
  return (
    <label className="field" style={{ marginBottom: 0 }}>
      <span className="label">{label}{unit ? ` · ${unit}` : ''}</span>
      {options ? (
        <select className="select" value={value} onChange={e => onChange(e.target.value)}>
          {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      ) : (
        <input className="input" type={type} value={value} min={min} step={step}
          onChange={e => onChange(e.target.value)} />
      )}
    </label>
  );
}

function Result({ label, value, color, note }) {
  return (
    <div className="card-paper" style={{ padding: '14px 16px', borderLeft: `3px solid ${color || 'var(--line-strong)'}` }}>
      <div className="eyebrow" style={{ marginBottom: 6 }}>{label}</div>
      <div className="serif" style={{ fontSize: 30, lineHeight: 1.05, color: color || C.ink }}>{value}</div>
      {note && <div style={{ fontSize: 13, color: C.ink2, marginTop: 6 }}>{note}</div>}
    </div>
  );
}

function Card({ title, icon, children }) {
  return (
    <div className="card-paper">
      <div style={{ padding: '20px 24px', borderBottom: `1px solid ${C.line}`, display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ fontSize: 26 }}>{icon}</span>
        <h2 className="serif" style={{ fontSize: 30, color: C.ink }}>{title}</h2>
      </div>
      <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 18 }}>
        {children}
      </div>
    </div>
  );
}

function Divider() {
  return <hr className="thin" style={{ margin: '2px 0' }} />;
}

function CalcBtn({ onClick }) {
  return (
    <button className="btn btn-rust" onClick={onClick} style={{ alignSelf: 'flex-start' }}>
      Calculate →
    </button>
  );
}

// ── 1. Voltage Drop Calculator ────────────────────────────────────────────────
function VoltageDropCalc() {
  const [current, setCurrent] = useState('10');
  const [length, setLength] = useState('5');
  const [wire, setWire] = useState('12');
  const [system, setSystem] = useState('12');
  const [result, setResult] = useState(null);

  const calc = useCallback(() => {
    const I = parseFloat(current);
    const L = parseFloat(length);
    const V = parseFloat(system);
    const awgIdx = parseInt(wire);
    if (!I || !L || !V || isNaN(awgIdx)) return;
    const row = WIRE_TABLE[awgIdx];
    // total wire length = 2× (there and back)
    const drop = (row.resistance / 1000) * 2 * L * I;
    const pct = (drop / V) * 100;
    const color = pct > 5 ? C.red : pct > 3 ? C.ochre : C.green;

    // find recommended wire (≤3% drop and handles current)
    const rec = WIRE_TABLE.find(w => {
      const d = (w.resistance / 1000) * 2 * L * I;
      return (d / V) * 100 <= 3 && w.rating >= I;
    });

    setResult({ drop, pct, color, rec, selectedWire: row });
  }, [current, length, wire, system]);

  return (
    <Card title="Voltage Drop Calculator" icon="⚡">
      <Field label="System Voltage" value={system} onChange={setSystem} options={[
        { value: '12', label: '12V' }, { value: '24', label: '24V' }, { value: '48', label: '48V' },
      ]} />
      <Field label="Current (Load)" unit="A" value={current} onChange={setCurrent} min="0" step="0.5" />
      <Field label="Cable Run (one way)" unit="m" value={length} onChange={setLength} min="0" step="0.5" />
      <Field label="Wire Size" value={wire} onChange={setWire} options={
        WIRE_TABLE.map((w, i) => ({ value: String(i), label: `AWG ${w.awg} (${w.mm2} mm²) — rated ${w.rating}A` }))
      } />
      <CalcBtn onClick={calc} />
      {result && (
        <>
          <Divider />
          <Result label="Voltage Drop" value={`${result.drop.toFixed(3)} V  (${result.pct.toFixed(1)}%)`} color={result.color}
            note={result.pct > 5 ? 'Exceeds 5% — significant power loss, upgrade wire' : result.pct > 3 ? 'Between 3–5% — acceptable for lighting, marginal for motors' : 'Under 3% — good'} />
          {result.rec && result.rec.awg !== result.selectedWire.awg && (
            <Result label="Recommended Wire" color={C.green}
              value={`AWG ${result.rec.awg} (${result.rec.mm2} mm²)`}
              note={`Keeps drop ≤3% and handles ${result.rec.rating}A`} />
          )}
          {!result.rec && (
            <Result label="Recommendation" color={C.red}
              value="Parallel runs required"
              note="No single wire in the table keeps drop ≤3% at this current/length" />
          )}
        </>
      )}
    </Card>
  );
}

// ── 2. Fuse Rating Calculator ─────────────────────────────────────────────────
const FUSE_SIZES = [1,2,3,5,7.5,10,15,20,25,30,35,40,50,60,70,80,100,125,150,200];

function FuseCalc() {
  const [watts, setWatts] = useState('100');
  const [voltage, setVoltage] = useState('12');
  const [margin, setMargin] = useState('125');
  const [result, setResult] = useState(null);

  const calc = useCallback(() => {
    const W = parseFloat(watts);
    const V = parseFloat(voltage);
    const M = parseFloat(margin) / 100;
    if (!W || !V || !M) return;
    const amps = W / V;
    const fusedAmps = amps * M;
    const recommended = FUSE_SIZES.find(f => f >= fusedAmps) || FUSE_SIZES[FUSE_SIZES.length - 1];
    setResult({ amps, fusedAmps, recommended });
  }, [watts, voltage, margin]);

  return (
    <Card title="Fuse Rating Calculator" icon="🔌">
      <Field label="Load Power" unit="W" value={watts} onChange={setWatts} min="0" step="1" />
      <Field label="System Voltage" value={voltage} onChange={setVoltage} options={[
        { value: '12', label: '12V' }, { value: '24', label: '24V' }, { value: '48', label: '48V' }, { value: '240', label: '240V AC' },
      ]} />
      <Field label="Safety Margin" value={margin} onChange={setMargin} options={[
        { value: '110', label: '110% — very tight' },
        { value: '125', label: '125% — standard (recommended)' },
        { value: '150', label: '150% — conservative' },
      ]} />
      <CalcBtn onClick={calc} />
      {result && (
        <>
          <Divider />
          <Result label="Load Current" value={`${result.amps.toFixed(2)} A`} color={C.ink} />
          <Result label="Fused at (×margin)" value={`${result.fusedAmps.toFixed(2)} A`} color={C.ink2} />
          <Result label="Recommended Fuse" value={`${result.recommended} A`} color={C.blue}
            note="Next standard fuse size up from calculated value" />
        </>
      )}
    </Card>
  );
}

// ── 3. Battery Runtime Estimator ──────────────────────────────────────────────
function BatteryCalc() {
  const [capacity, setCapacity] = useState('100');
  const [load, setLoad] = useState('50');
  const [voltage, setVoltage] = useState('12');
  const [dod, setDod] = useState('50');
  const [result, setResult] = useState(null);

  const calc = useCallback(() => {
    const Ah = parseFloat(capacity);
    const W = parseFloat(load);
    const V = parseFloat(voltage);
    const DOD = parseFloat(dod) / 100;
    if (!Ah || !W || !V || !DOD) return;
    const usableAh = Ah * DOD;
    const loadAmps = W / V;
    const hours = usableAh / loadAmps;
    setResult({ hours, usableAh, loadAmps });
  }, [capacity, load, voltage, dod]);

  const fmt = h => {
    if (h >= 24) return `${Math.floor(h / 24)}d ${Math.round(h % 24)}h`;
    return `${Math.floor(h)}h ${Math.round((h % 1) * 60)}m`;
  };

  return (
    <Card title="Battery Runtime Estimator" icon="🔋">
      <Field label="Battery Capacity" unit="Ah" value={capacity} onChange={setCapacity} min="0" step="1" />
      <Field label="System Voltage" value={voltage} onChange={setVoltage} options={[
        { value: '12', label: '12V' }, { value: '24', label: '24V' }, { value: '48', label: '48V' },
      ]} />
      <Field label="Total Load" unit="W" value={load} onChange={setLoad} min="0" step="1" />
      <Field label="Depth of Discharge" value={dod} onChange={setDod} options={[
        { value: '50', label: '50% — AGM / Flooded Lead Acid' },
        { value: '80', label: '80% — Lithium (LiFePO₄)' },
        { value: '100', label: '100% — theoretical max' },
      ]} />
      <CalcBtn onClick={calc} />
      {result && (
        <>
          <Divider />
          <Result label="Usable Capacity" value={`${result.usableAh.toFixed(1)} Ah`} color={C.ink2} />
          <Result label="Load Current" value={`${result.loadAmps.toFixed(2)} A`} color={C.ink2} />
          <Result label="Estimated Runtime" value={fmt(result.hours)} color={C.green}
            note="Assumes constant load and no charging" />
        </>
      )}
    </Card>
  );
}

// ── 4. Solar Panel Sizing Tool ────────────────────────────────────────────────
function SolarCalc() {
  const [dailyWh, setDailyWh] = useState('500');
  const [sunHours, setSunHours] = useState('5');
  const [voltage, setVoltage] = useState('12');
  const [dod, setDod] = useState('50');
  const [days, setDays] = useState('2');
  const [result, setResult] = useState(null);

  const calc = useCallback(() => {
    const Wh = parseFloat(dailyWh);
    const PSH = parseFloat(sunHours);
    const V = parseFloat(voltage);
    const DOD = parseFloat(dod) / 100;
    const autonomy = parseFloat(days);
    if (!Wh || !PSH || !V || !DOD || !autonomy) return;

    // panel watts needed (add 20% system losses)
    const panelW = (Wh / PSH) * 1.2;
    // battery bank (Wh needed for autonomy days at DOD)
    const bankWh = (Wh * autonomy) / DOD;
    const bankAh = bankWh / V;

    setResult({ panelW, bankWh, bankAh });
  }, [dailyWh, sunHours, voltage, dod, days]);

  return (
    <Card title="Solar Panel Sizing Tool" icon="☀️">
      <Field label="Daily Energy Use" unit="Wh/day" value={dailyWh} onChange={setDailyWh} min="0" step="10" />
      <Field label="Peak Sun Hours" value={sunHours} onChange={setSunHours} options={[
        { value: '3', label: '3h — overcast / winter / south-facing' },
        { value: '4', label: '4h — coastal / partly cloudy' },
        { value: '5', label: '5h — inland Australia (average)' },
        { value: '6', label: '6h — outback / optimal tilt' },
        { value: '7', label: '7h — peak summer / north-facing' },
      ]} />
      <Field label="System Voltage" value={voltage} onChange={setVoltage} options={[
        { value: '12', label: '12V' }, { value: '24', label: '24V' }, { value: '48', label: '48V' },
      ]} />
      <Field label="Battery Type (DoD)" value={dod} onChange={setDod} options={[
        { value: '50', label: '50% — AGM / Flooded' },
        { value: '80', label: '80% — Lithium LiFePO₄' },
      ]} />
      <Field label="Days Autonomy (no sun)" unit="days" value={days} onChange={setDays} min="1" step="1" />
      <CalcBtn onClick={calc} />
      {result && (
        <>
          <Divider />
          <Result label="Minimum Panel Output" value={`${Math.ceil(result.panelW)} W`} color={C.blue}
            note="Includes 20% for system losses (MPPT, wiring, temp derating)" />
          <Result label="Battery Bank" value={`${Math.ceil(result.bankAh)} Ah  @${voltage}V  (${Math.ceil(result.bankWh / 1000 * 10) / 10} kWh)`} color={C.green}
            note={`Supports ${days} day${days > 1 ? 's' : ''} without solar`} />
        </>
      )}
    </Card>
  );
}

// ── 5. Wire Gauge Selector ────────────────────────────────────────────────────
function WireGaugeCalc() {
  const [current, setCurrent] = useState('20');
  const [length, setLength] = useState('3');
  const [voltage, setVoltage] = useState('12');
  const [maxDrop, setMaxDrop] = useState('3');
  const [result, setResult] = useState(null);

  const calc = useCallback(() => {
    const I = parseFloat(current);
    const L = parseFloat(length);
    const V = parseFloat(voltage);
    const maxPct = parseFloat(maxDrop) / 100;
    if (!I || !L || !V || !maxPct) return;

    const maxDropV = V * maxPct;
    // find smallest wire that: handles current AND stays within drop limit
    const matches = WIRE_TABLE.filter(w => {
      const drop = (w.resistance / 1000) * 2 * L * I;
      return drop <= maxDropV && w.rating >= I;
    });
    const best = matches[matches.length - 1]; // smallest that qualifies

    // also find wire just by current rating
    const byRating = WIRE_TABLE.find(w => w.rating >= I);

    setResult({ best, byRating, maxDropV });
  }, [current, length, voltage, maxDrop]);

  return (
    <Card title="Wire Gauge Selector" icon="🔧">
      <Field label="Current" unit="A" value={current} onChange={setCurrent} min="0" step="1" />
      <Field label="Cable Run (one way)" unit="m" value={length} onChange={setLength} min="0" step="0.5" />
      <Field label="System Voltage" value={voltage} onChange={setVoltage} options={[
        { value: '12', label: '12V' }, { value: '24', label: '24V' }, { value: '48', label: '48V' },
      ]} />
      <Field label="Max Acceptable Drop" value={maxDrop} onChange={setMaxDrop} options={[
        { value: '2', label: '2% — sensitive electronics' },
        { value: '3', label: '3% — general 12V / motors' },
        { value: '5', label: '5% — lighting OK' },
      ]} />
      <CalcBtn onClick={calc} />
      {result && (
        <>
          <Divider />
          {result.best ? (
            <Result label="Recommended Wire" value={`AWG ${result.best.awg}  (${result.best.mm2} mm²)`} color={C.green}
              note={`Rated ${result.best.rating}A — keeps drop ≤${maxDrop}% (≤${result.maxDropV.toFixed(2)}V)`} />
          ) : (
            <Result label="No Single Wire Sufficient" color={C.red}
              value="Use parallel runs"
              note="Consider two cables or reduce run length / increase voltage" />
          )}
          {result.byRating && result.best && result.byRating.awg !== result.best.awg && (
            <Result label="By Current Rating Only" value={`AWG ${result.byRating.awg}  (${result.byRating.mm2} mm²)`} color={C.ochre}
              note="Handles current but may exceed your drop limit" />
          )}
        </>
      )}
    </Card>
  );
}

// ── 6. LED Resistor Calculator ────────────────────────────────────────────────
function LEDCalc() {
  const [supply, setSupply] = useState('12');
  const [vf, setVf] = useState('2.1');
  const [mA, setMa] = useState('20');
  const [leds, setLeds] = useState('1');
  const [result, setResult] = useState(null);

  const calc = useCallback(() => {
    const Vs = parseFloat(supply);
    const Vf = parseFloat(vf);
    const If = parseFloat(mA) / 1000;
    const n = parseInt(leds);
    if (!Vs || !Vf || !If || !n) return;
    const totalVf = Vf * n;
    if (totalVf >= Vs) {
      setResult({ error: `Total LED forward voltage (${totalVf.toFixed(1)}V) ≥ supply voltage — reduce LEDs in series or increase supply` });
      return;
    }
    const R = (Vs - totalVf) / If;
    const P = (Vs - totalVf) * If;
    // nearest E12 resistor value
    const e12 = [1,1.2,1.5,1.8,2.2,2.7,3.3,3.9,4.7,5.6,6.8,8.2];
    const exp = Math.floor(Math.log10(R));
    const man = R / Math.pow(10, exp);
    const nearest = e12.reduce((a, b) => Math.abs(b - man) < Math.abs(a - man) ? b : a);
    const stdR = nearest * Math.pow(10, exp);
    const stdP = (Vs - totalVf) / stdR * (Vs - totalVf);
    setResult({ R, P, stdR, stdP, totalVf, dropR: Vs - totalVf });
  }, [supply, vf, mA, leds]);

  const fmtR = v => v >= 1000 ? `${(v / 1000).toFixed(2)} kΩ` : `${Math.round(v)} Ω`;

  return (
    <Card title="LED Resistor Calculator" icon="💡">
      <Field label="Supply Voltage" unit="V" value={supply} onChange={setSupply} min="0" step="0.1" />
      <Field label="LEDs in Series" unit="LEDs" value={leds} onChange={setLeds} min="1" step="1" />
      <Field label="LED Forward Voltage (Vf)" value={vf} onChange={setVf} options={[
        { value: '1.8', label: '1.8V — Red / Infrared' },
        { value: '2.0', label: '2.0V — Yellow / Orange' },
        { value: '2.1', label: '2.1V — Red (standard)' },
        { value: '2.5', label: '2.5V — Green' },
        { value: '3.0', label: '3.0V — Blue / White' },
        { value: '3.2', label: '3.2V — White / UV' },
      ]} />
      <Field label="LED Current" unit="mA" value={mA} onChange={setMa} min="0" step="1" />
      <CalcBtn onClick={calc} />
      {result && (
        <>
          <Divider />
          {result.error ? (
            <Result label="Error" value="Check inputs" color={C.red} note={result.error} />
          ) : (
            <>
              <Result label="Exact Resistor" value={fmtR(result.R)} color={C.ink}
                note={`Power: ${(result.P * 1000).toFixed(0)} mW`} />
              <Result label="Nearest E12 Standard Value" value={fmtR(result.stdR)} color={C.blue}
                note={`Power dissipated: ${(result.stdP * 1000).toFixed(0)} mW — use ≥${result.stdP < 0.125 ? '1/8W' : result.stdP < 0.25 ? '1/4W' : result.stdP < 0.5 ? '1/2W' : '1W'} resistor`} />
            </>
          )}
        </>
      )}
    </Card>
  );
}

// ── 7. Ohm's Law Calculator ───────────────────────────────────────────────────
function OhmsLawCalc() {
  const [v, setV] = useState('');
  const [i, setI] = useState('');
  const [r, setR] = useState('');
  const [p, setP] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const calc = useCallback(() => {
    const vals = { v: parseFloat(v) || null, i: parseFloat(i) || null, r: parseFloat(r) || null, p: parseFloat(p) || null };
    const known = Object.entries(vals).filter(([, val]) => val !== null);
    if (known.length < 2) { setError('Enter at least 2 values'); setResult(null); return; }
    setError('');

    let V = vals.v, I = vals.i, R = vals.r, P = vals.p;

    // Solve using all combinations
    if (V && I) { R = R ?? V / I; P = P ?? V * I; }
    else if (V && R) { I = I ?? V / R; P = P ?? V * V / R; }
    else if (V && P) { I = I ?? P / V; R = R ?? V * V / P; }
    else if (I && R) { V = V ?? I * R; P = P ?? I * I * R; }
    else if (I && P) { V = V ?? P / I; R = R ?? P / (I * I); }
    else if (R && P) { V = V ?? Math.sqrt(P * R); I = I ?? Math.sqrt(P / R); }

    setResult({ V, I, R, P });
  }, [v, i, r, p]);

  const fmtVal = (val, unit) => {
    if (val === null || isNaN(val)) return '—';
    if (Math.abs(val) >= 1000) return `${(val / 1000).toFixed(3)} k${unit}`;
    if (Math.abs(val) < 0.01) return `${(val * 1000).toFixed(3)} m${unit}`;
    return `${val.toFixed(4).replace(/\.?0+$/, '')} ${unit}`;
  };

  return (
    <Card title="Ohm's Law Calculator" icon="🧮">
      <p style={{ fontSize: 13, color: C.ink2 }}>Enter any 2 values — the other 2 are calculated.</p>
      <Field label="Voltage (V)" unit="V" value={v} onChange={setV} min="0" step="any" />
      <Field label="Current (I)" unit="A" value={i} onChange={setI} min="0" step="any" />
      <Field label="Resistance (R)" unit="Ω" value={r} onChange={setR} min="0" step="any" />
      <Field label="Power (P)" unit="W" value={p} onChange={setP} min="0" step="any" />
      <CalcBtn onClick={calc} />
      {error && <div style={{ color: C.red, fontSize: 13 }}>{error}</div>}
      {result && (
        <>
          <Divider />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Result label="Voltage" value={fmtVal(result.V, 'V')} />
            <Result label="Current" value={fmtVal(result.I, 'A')} />
            <Result label="Resistance" value={fmtVal(result.R, 'Ω')} />
            <Result label="Power" value={fmtVal(result.P, 'W')} />
          </div>
        </>
      )}
    </Card>
  );
}

// ── 8. Capacitor Charge/Discharge Timer ───────────────────────────────────────
function CapacitorCalc() {
  const [mode, setMode] = useState('rc');
  const [r, setR] = useState('10000');
  const [c, setC] = useState('100');
  const [vSupply, setVSupply] = useState('5');
  const [vTarget, setVTarget] = useState('3.3');
  const [tauCount, setTauCount] = useState('5');
  const [result, setResult] = useState(null);

  const calc = useCallback(() => {
    const R = parseFloat(r);
    const Cuf = parseFloat(c) / 1e6; // µF → F
    const Vs = parseFloat(vSupply);
    const Vt = parseFloat(vTarget);
    const taus = parseFloat(tauCount);
    if (!R || !Cuf) return;

    const tau = R * Cuf;
    const freq = 1 / (2 * Math.PI * R * Cuf); // -3dB cutoff
    const fullChargeTime = tau * taus;

    let timeToTarget = null;
    if (Vs && Vt && Vt < Vs) {
      // charging: V(t) = Vs(1 - e^(-t/tau))  → t = -tau * ln(1 - Vt/Vs)
      timeToTarget = -tau * Math.log(1 - Vt / Vs);
    }

    const fmtT = s => {
      if (s >= 1) return `${s.toFixed(3)} s`;
      if (s >= 0.001) return `${(s * 1000).toFixed(3)} ms`;
      return `${(s * 1e6).toFixed(3)} µs`;
    };

    setResult({ tau, fullChargeTime, timeToTarget, freq, fmtT });
  }, [r, c, vSupply, vTarget, tauCount]);

  return (
    <Card title="Capacitor Charge/Discharge Timer" icon="⏱️">
      <Field label="Resistance" unit="Ω" value={r} onChange={setR} min="0" step="any" />
      <Field label="Capacitance" unit="µF" value={c} onChange={setC} min="0" step="any" />
      <Field label="Supply Voltage" unit="V" value={vSupply} onChange={setVSupply} min="0" step="any" />
      <Field label="Target Voltage (charge to)" unit="V" value={vTarget} onChange={setVTarget} min="0" step="any" />
      <Field label="Time Constants for 'Full Charge'" value={tauCount} onChange={setTauCount} options={[
        { value: '3', label: '3τ — 95%' },
        { value: '4', label: '4τ — 98%' },
        { value: '5', label: '5τ — 99.3% (standard)' },
      ]} />
      <CalcBtn onClick={calc} />
      {result && (
        <>
          <Divider />
          <Result label="Time Constant (τ = RC)" value={result.fmtT(result.tau)} color={C.blue} />
          <Result label={`Full Charge Time (${tauCount}τ)`} value={result.fmtT(result.fullChargeTime)} color={C.ink2} />
          {result.timeToTarget !== null && (
            <Result label={`Time to reach ${vTarget}V`} value={result.fmtT(result.timeToTarget)} color={C.green} />
          )}
          <Result label="RC Filter Cutoff Freq" value={`${result.freq >= 1000 ? (result.freq / 1000).toFixed(2) + ' kHz' : result.freq.toFixed(2) + ' Hz'}`}
            color={C.ink3} note="−3dB point for low-pass filter" />
        </>
      )}
    </Card>
  );
}

// ── 9. Relay Wiring Guide ─────────────────────────────────────────────────────
function RelayGuide() {
  const [type, setType] = useState('5pin');

  const pin4 = [
    { pin: '85', color: '#e74c3c', label: 'Coil −', desc: 'Connect to ground (chassis earth)' },
    { pin: '86', color: '#f39c12', label: 'Coil +', desc: 'Connect to 12V trigger signal (switch, ECU output, etc.)' },
    { pin: '30', color: '#3498db', label: 'Common', desc: 'Connect to your 12V power source (fused)' },
    { pin: '87', color: '#2ecc71', label: 'NO — Normally Open', desc: 'Connect to load +ve. Circuit closed when relay energised.' },
  ];

  const pin5 = [
    ...pin4,
    { pin: '87a', color: '#9b59b6', label: 'NC — Normally Closed', desc: 'Connected to pin 30 when relay is OFF. Use for fail-safe / bypass circuits.' },
  ];

  const pins = type === '5pin' ? pin5 : pin4;

  return (
    <Card title="Relay Wiring Guide" icon="🔄">
      <Field label="Relay Type" value={type} onChange={setType} options={[
        { value: '5pin', label: '5-pin relay (SPDT — has NC contact)' },
        { value: '4pin', label: '4-pin relay (SPST — NO only)' },
      ]} />

      {/* ASCII diagram */}
      <div style={{ background: C.paper, borderRadius: 10, border: `1px solid ${C.line}`, padding: '16px 20px' }}>
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: C.ink2, lineHeight: 1.8, whiteSpace: 'pre' }}>
{type === '5pin' ? `
    ┌──────────────────┐
    │  RELAY (5-pin)   │
    │                  │
 85 ┤ Coil −    30 ├── Common (power in)
 86 ┤ Coil +    87 ├── NO  (load +ve)
    │          87a ├── NC  (bypass)
    └──────────────────┘

  Energised: 30 ↔ 87  (NO closes)
  De-energised: 30 ↔ 87a (NC closes)
` : `
    ┌──────────────────┐
    │  RELAY (4-pin)   │
    │                  │
 85 ┤ Coil −    30 ├── Common (power in)
 86 ┤ Coil +    87 ├── NO  (load +ve)
    └──────────────────┘

  Energised: 30 ↔ 87  (circuit closes)
  De-energised: open circuit
`}
        </div>
      </div>

      {/* Pin descriptions */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {pins.map(({ pin, color, label, desc }) => (
          <div key={pin} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <div style={{
              minWidth: 42, height: 36, borderRadius: 8, background: color, color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 700, fontSize: 13, fontFamily: "'JetBrains Mono', monospace",
            }}>{pin}</div>
            <div>
              <div style={{ fontWeight: 600, fontSize: 13, color: C.ink }}>{label}</div>
              <div style={{ fontSize: 12, color: C.ink2 }}>{desc}</div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ padding: '12px 14px', borderRadius: 8, background: '#fff8e6', border: `1px solid ${C.ochre}`, fontSize: 12, color: C.ink2 }}>
        <strong>Tip:</strong> Always fuse the wire going to pin 30. Coil draws ~150–200 mA — any small signal wire can trigger it. Keep coil wiring away from sensitive audio/sensor cables to avoid interference.
      </div>
    </Card>
  );
}

// ── Nav ───────────────────────────────────────────────────────────────────────
const TOOLS = [
  { id: 'vdrop',    label: 'Voltage Drop',    icon: '⚡' },
  { id: 'fuse',     label: 'Fuse Rating',     icon: '🔌' },
  { id: 'battery',  label: 'Battery Runtime', icon: '🔋' },
  { id: 'solar',    label: 'Solar Sizing',    icon: '☀️' },
  { id: 'wire',     label: 'Wire Gauge',      icon: '🔧' },
  { id: 'led',      label: 'LED Resistor',    icon: '💡' },
  { id: 'ohms',     label: "Ohm's Law",       icon: '🧮' },
  { id: 'cap',      label: 'Capacitor Timer', icon: '⏱️' },
  { id: 'relay',    label: 'Relay Wiring',    icon: '🔄' },
];

// ── Site chrome (header + footer) ─────────────────────────────────────────────
// Ported verbatim from app.jsx so this standalone page renders the EXACT same
// header and footer as every other page on outbackelectronics.com.au. Because
// this bundle has no SPA router or cart context, `go()` performs a real browser
// navigation and the cart count is read from localStorage.

// ShopContext mirrors app.jsx
const ShopContext = createContext({});
const useShop = () => useContext(ShopContext);

// Cross-site URLs — populated from /api/shop-info at runtime (mirrors app.jsx).
let _PORTAL_URL = 'https://portal.outbackelectronics.com.au';
let _GAMES_URL  = 'https://games.outbackelectronics.com.au';
let _TOOLS_URL  = 'https://tools.outbackelectronics.com.au';
function getPortalUrl() { return _PORTAL_URL; }
function getGamesUrl()  { return _GAMES_URL; }
function getToolsUrl()  { return _TOOLS_URL; }

// ---------------- Nav ----------------
const PRIMARY_PAGES = [
  { id: 'home', label: 'Home' },
  { id: 'shop', label: 'Shop' },
  { id: 'services', label: 'Services' },
  { id: 'memberships', label: 'Memberships' },
  { id: 'software', label: 'Software' },
  { id: 'ewaste', label: 'eWaste' },
  { id: 'ai', label: 'AI' },
  { id: 'tutorials', label: 'Tutorials' },
  { id: 'tools-link', label: 'Tools' },
  { id: 'games-link', label: 'Games' },
  { id: 'groups', label: 'Groups' },
];
// Pages served from their own subdomain (tools./forum./games.) — mirrors app.jsx.
const EXTERNAL_LINKS = {
  'games-link': getGamesUrl,
  'tools-link': getToolsUrl,
};
const isExternalLink = (id) => Object.prototype.hasOwnProperty.call(EXTERNAL_LINKS, id);
const externalHref = (id) => EXTERNAL_LINKS[id] ? EXTERNAL_LINKS[id]() : null;
const UTILITY_PAGES = [
  { id: 'quote', label: 'Request a Quote' },
  { id: 'gift-cards', label: 'Gift Cards' },
  { id: 'sellers', label: 'Info for Sellers' },
  { id: 'sell-gear', label: 'Sell Your Gear' },
  { id: 'contact', label: 'Contact' },
  { id: 'policies', label: 'Policies' },
];

// This bundle is served from the tools. subdomain, so links to main-site pages
// (/shop, /services, …) must target the main origin, not tools.*. Derive it from
// the current location by stripping the `tools.` host or the dev port.
function getSiteRoot() {
  try {
    const u = new URL(window.location.href);
    if (u.hostname.startsWith('tools.')) u.hostname = u.hostname.slice('tools.'.length);
    else if (u.port === '8085') u.port = '8080';
    return u.origin + '/';
  } catch { return '/'; }
}

// Standalone navigation: replaces the SPA `go()` with a real browser navigation.
function go(id, params = null) {
  if (id === 'home') { window.location.href = getSiteRoot(); return; }
  if (isExternalLink(id)) { window.location.href = externalHref(id); return; }
  if (id === 'product' && params) { window.location.href = getSiteRoot() + 'product/' + (params.slug || params.id || ''); return; }
  if (id === 'service' && params) { window.location.href = getSiteRoot() + 'service/' + (params.slug || params.id || ''); return; }
  window.location.href = getSiteRoot() + id;
}

// ---------------- Cross-origin portal API helpers ----------------
let _portalCsrfPromise = null;
async function getPortalCsrf() {
  if (!_portalCsrfPromise) {
    _portalCsrfPromise = fetch(getPortalUrl() + '/api/csrf-token', { credentials: 'include' })
      .then(r => r.json()).then(d => d.token || '').catch(() => { _portalCsrfPromise = null; return ''; });
  }
  return _portalCsrfPromise;
}
async function portalApi(path, opts = {}) {
  const isPost = opts.method && opts.method.toUpperCase() !== 'GET';
  const csrfToken = isPost ? await getPortalCsrf() : '';
  const headers = { 'Content-Type': 'application/json', ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}) };
  return fetch(getPortalUrl() + path, { headers, credentials: 'include', ...opts })
    .then(async r => { const body = await r.json().catch(() => ({})); return { ok: r.ok, status: r.status, ...body }; });
}

function usePortalUser() {
  const [user, setUser] = useState(undefined);
  useEffect(() => {
    fetch(getPortalUrl() + '/api/portal/auth/me', { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(d => setUser(d?.user || null))
      .catch(() => setUser(null));
  }, []);
  return user;
}

// ---------------- Search Overlay ----------------
function SearchOverlay({ onClose }) {
  const [q, setQ] = useState('');
  const [products, setProducts] = useState([]);
  const [highlightIdx, setHighlightIdx] = useState(0);
  const inputRef = useRef(null);
  const listRef = useRef(null);
  useEffect(() => { inputRef.current && inputRef.current.focus(); }, []);

  useEffect(() => {
    fetch('/api/catalog/products')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setProducts(d.items || []); })
      .catch(() => {});
  }, []);

  const allPages = [
    ...PRIMARY_PAGES.filter(p => !isExternalLink(p.id)),
    ...UTILITY_PAGES,
  ];

  const query = q.trim().toLowerCase();
  const pageResults = query.length < 1
    ? allPages.slice(0, 6)
    : allPages.filter(p => p.label.toLowerCase().includes(query));
  const productResults = query.length >= 2 ? products.filter(p =>
    (p.name || '').toLowerCase().includes(query) ||
    (p.brand || '').toLowerCase().includes(query) ||
    (p.sku || '').toLowerCase().includes(query) ||
    (p.category || '').toLowerCase().includes(query)
  ).slice(0, 6) : [];

  const allResults = [...pageResults, ...productResults.map(p => ({ ...p, _isProduct: true }))];

  useEffect(() => { setHighlightIdx(0); }, [q]);

  const pick = (item) => {
    if (item._isProduct) { go('product', item); onClose(); return; }
    if (isExternalLink(item.id)) { window.location.href = externalHref(item.id); return; }
    go(item.id);
    onClose();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') { onClose(); return; }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightIdx(i => Math.min(i + 1, allResults.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightIdx(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && allResults[highlightIdx]) {
      pick(allResults[highlightIdx]);
    }
  };

  return (
    <div className="search-backdrop" style={{position:'fixed', inset:0, zIndex:500, display:'flex', flexDirection:'column', alignItems:'center', paddingTop:80, background:'rgba(15,13,10,0.72)'}}
      onClick={onClose}>
      <div style={{width:'100%', maxWidth:560, background:'var(--bg)', border:'1px solid var(--line)', boxShadow:'0 12px 40px rgba(0,0,0,.35)'}}
        onClick={e => e.stopPropagation()}>
        <div style={{display:'flex', alignItems:'center', padding:'12px 16px', borderBottom:'1px solid var(--line)', gap:10}}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{flexShrink:0, color:'var(--ink-2)'}}><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>
          <input ref={inputRef} value={q} onChange={e => setQ(e.target.value)}
            placeholder="Search pages and products…" style={{flex:1, border:'none', outline:'none', background:'transparent', fontSize:15, color:'var(--ink)'}}
            onKeyDown={handleKeyDown} />
          <button onClick={onClose} style={{background:'none', border:'none', cursor:'pointer', color:'var(--ink-2)', fontSize:18, lineHeight:1}} aria-label="Close search">×</button>
        </div>
        <div ref={listRef} style={{maxHeight:420, overflowY:'auto'}}>
          {query.length === 0 && (
            <div style={{padding:'6px 20px 2px', fontSize:11, color:'var(--ink-3)', fontFamily:'monospace', letterSpacing:'0.08em'}}>QUICK LINKS</div>
          )}
          {query.length >= 2 && pageResults.length > 0 && (
            <div style={{padding:'6px 20px 2px', fontSize:11, color:'var(--ink-3)', fontFamily:'monospace', letterSpacing:'0.08em'}}>PAGES</div>
          )}
          {pageResults.map((p, idx) => {
            const isHighlighted = highlightIdx === idx;
            return (
              <div key={p.id} onClick={() => pick(p)}
                style={{padding:'12px 20px', cursor:'pointer', fontSize:14, borderBottom:'1px solid var(--line)', display:'flex', alignItems:'center', gap:10, background: isHighlighted ? 'var(--bg-elev)' : 'transparent'}}
                onMouseEnter={() => setHighlightIdx(idx)}
                onMouseLeave={() => setHighlightIdx(idx)}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{color:'var(--ink-3)'}}><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                {p.label}
              </div>
            );
          })}
          {productResults.length > 0 && (
            <div style={{padding:'6px 20px 2px', fontSize:11, color:'var(--ink-3)', fontFamily:'monospace', letterSpacing:'0.08em', borderTop: pageResults.length > 0 ? '1px solid var(--line)' : 'none'}}>PRODUCTS</div>
          )}
          {productResults.map((p, relIdx) => {
            const idx = pageResults.length + relIdx;
            const isHighlighted = highlightIdx === idx;
            return (
              <div key={p.id || p.sku} onClick={() => pick({...p, _isProduct: true})}
                style={{padding:'12px 20px', cursor:'pointer', fontSize:14, borderBottom:'1px solid var(--line)', display:'flex', alignItems:'center', gap:10, background: isHighlighted ? 'var(--bg-elev)' : 'transparent'}}
                onMouseEnter={() => setHighlightIdx(idx)}
                onMouseLeave={() => setHighlightIdx(idx)}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{color:'var(--rust)'}}><rect x="2" y="3" width="20" height="18" rx="2"/><path d="M16 3v4M8 3v4M2 11h20"/></svg>
                <div>
                  <div style={{fontWeight:500}}>{p.name}</div>
                  {(p.brand || p.category) && <div style={{fontSize:12, color:'var(--ink-2)', marginTop:2}}>{[p.brand, p.category].filter(Boolean).join(' · ')}</div>}
                </div>
                {p.price && <div style={{marginLeft:'auto', fontWeight:600, color:'var(--rust)', whiteSpace:'nowrap'}}>${Number(p.price).toLocaleString('en-AU')}</div>}
              </div>
            );
          })}
          {allResults.length === 0 && query.length > 0 && <div style={{padding:'16px 20px', color:'var(--ink-2)', fontSize:14}}>No results for "{q}".</div>}
          {query.length === 0 && (
            <div style={{padding:'10px 20px', fontSize:12, color:'var(--ink-3)', borderTop:'1px solid var(--line)'}}>
              Type to search products, or use ↑↓ arrows + Enter to navigate
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------- Account Dropdown ----------------
function AccountDropdown({ onClose, user }) {
  const ref = useRef(null);
  const portal = (path = '') => { window.location.href = getPortalUrl() + path; };
  const goPage = (id) => { go(id); onClose(); };
  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  const dropdownStyle = {position:'absolute', top:'calc(100% + 8px)', right:0, width:220, background:'var(--bg)', border:'1px solid var(--line)', boxShadow:'0 8px 24px rgba(0,0,0,.15)', zIndex:300};
  const btnStyle = (last) => ({width:'100%', textAlign:'left', padding:'12px 16px', cursor:'pointer', fontSize:14, border:'none', borderBottom: last ? 'none' : '1px solid var(--line)', background:'transparent', color:'var(--ink)'});
  const hoverOn = e => { e.currentTarget.style.background = 'var(--bg-elev)'; };
  const hoverOff = e => { e.currentTarget.style.background = 'transparent'; };

  if (!user) {
    return (
      <div ref={ref} style={dropdownStyle}>
        <div style={{padding:'16px 16px 12px', borderBottom:'1px solid var(--line)'}}>
          <div className="mono" style={{fontSize:10, color:'var(--ink-3)', marginBottom:6}}>ACCOUNT</div>
          <p style={{fontSize:13, color:'var(--ink-2)', lineHeight:1.5, margin:0}}>
            Sign in to track orders, book repairs, and access your account.
          </p>
        </div>
        <button style={{...btnStyle(false), fontWeight:600, color:'var(--rust)'}}
          onMouseEnter={hoverOn} onMouseLeave={hoverOff}
          onClick={() => { portal('/'); onClose(); }}>
          Sign In →
        </button>
        <button style={btnStyle(true)}
          onMouseEnter={hoverOn} onMouseLeave={hoverOff}
          onClick={() => { portal('/?tab=register'); onClose(); }}>
          Create an Account
        </button>
      </div>
    );
  }

  return (
    <div ref={ref} style={dropdownStyle}>
      {user.displayName && (
        <div style={{padding:'12px 16px', borderBottom:'1px solid var(--line)'}}>
          <div className="mono" style={{fontSize:10, color:'var(--ink-3)'}}>SIGNED IN AS</div>
          <div style={{fontSize:14, marginTop:3, fontWeight:600, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{user.displayName}</div>
        </div>
      )}
      {[
        { label:'Profile',           action: () => portal('/#account') },
        { label:'My Subscriptions',  action: () => portal('/#memberships') },
        { label:'My Rewards',        action: () => portal('/#rewards') },
        { label:'My Wallet',         action: () => portal('/#wallet') },
        { label:'My Groups',         action: () => { go('groups'); onClose(); } },
        { label:'My Orders',         action: () => portal('/orders') },
        { label:'My Addresses',      action: () => portal('/addresses') },
        { label:'My Bookings',       action: () => portal('/bookings') },
        { label:'My Account',        action: () => portal('/account') },
        { label:'Log Out',           action: () => { portalApi('/api/portal/auth/logout', { method: 'POST' }).then(() => window.location.reload()); onClose(); } },
      ].map((item, i, arr) => (
        <button key={item.label} onClick={() => { item.action(); onClose(); }}
          style={btnStyle(i === arr.length - 1)}
          onMouseEnter={hoverOn} onMouseLeave={hoverOff}>
          {item.label}
        </button>
      ))}
    </div>
  );
}

// ---------------- Brand Mark ----------------
function Logo({ onClick }) {
  return (
    <div className="logo" onClick={onClick}>
      <div className="logo-mark">
        <img src="assets/logo.webp" alt="Outback Electronics" width="55" height="40" />
      </div>
      <div className="logo-text">
        <div className="sub">Est. 2023 · Appointment only</div>
      </div>
    </div>
  );
}

function UtilityBar() {
  const shop = useShop();
  return (
    <div className="utility-bar">
      <div className="container">
        <div className="links">
          <span>FREE FREIGHT OVER $200 · OUTBACK NT/SA/WA</span>
        </div>
        <div className="links">
          {UTILITY_PAGES.map(p => (
            <a key={p.id} href={getSiteRoot() + p.id} onClick={(e) => { e.preventDefault(); go(p.id); }}>{p.label}</a>
          ))}
          {shop.phone && <span style={{color:'var(--ochre)'}}>{shop.phone}</span>}
        </div>
      </div>
    </div>
  );
}

function useAnnouncement() {
  const [text, setText] = useState('');
  useEffect(() => {
    fetch('/api/announcement')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d && d.active && d.text) setText(d.text); })
      .catch(() => {});
  }, []);
  return text;
}

function useCartCount() {
  const [count, setCount] = useState(0);
  useEffect(() => {
    const read = () => {
      try {
        const cart = JSON.parse(localStorage.getItem('oe_cart') || '[]');
        setCount(Array.isArray(cart) ? cart.reduce((s, i) => s + (i.qty || 0), 0) : 0);
      } catch { setCount(0); }
    };
    read();
    window.addEventListener('storage', read);
    return () => window.removeEventListener('storage', read);
  }, []);
  return count;
}

// ---------------- Top Nav ----------------
function TopNav({ page, onSearchOpen, accountOpen, setAccountOpen, portalUser, cart }) {
  const announcement = useAnnouncement();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const signedOut = portalUser === null;
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const handleNavClick = (id) => {
    setMobileMenuOpen(false);
    if (isExternalLink(id)) window.location.href = externalHref(id);
    else go(id);
  };

  return (
    <header>
      {announcement && <div className="announce">{announcement}</div>}
      <UtilityBar />
      <div className={scrolled ? 'topnav scrolled' : 'topnav'}>
        <div className="container row">
          <Logo onClick={() => go('home')} />
          <nav className="mainlinks">
            {PRIMARY_PAGES.map(p => (
              <a
                key={p.id}
                href={isExternalLink(p.id) ? externalHref(p.id) : getSiteRoot() + p.id}
                className={page === p.id ? 'active' : ''}
                onClick={isExternalLink(p.id) ? undefined : (e) => { e.preventDefault(); go(p.id); }}
                {...((p.id === 'forum-link' || p.id === 'games-link') ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
              >
                {p.label}
              </a>
            ))}
          </nav>
          <div className="topnav-actions">
            <button className="icon-btn" title="Search" aria-label="Search" onClick={onSearchOpen}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>
            </button>
            <div style={{position:'relative'}}>
              <button
                className="icon-btn"
                title={signedOut ? 'Sign In / Create Account' : 'Account'}
                aria-label={signedOut ? 'Sign In / Create Account' : 'Account'}
                onClick={() => setAccountOpen(o => !o)}
                style={signedOut ? {color:'var(--rust)', borderColor:'var(--rust)'} : {}}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-7 8-7s8 3 8 7"/></svg>
              </button>
              {accountOpen && <AccountDropdown onClose={() => setAccountOpen(false)} user={portalUser} />}
            </div>
            <button className="icon-btn" title="Cart" aria-label={cart > 0 ? `Cart, ${cart} item${cart === 1 ? '' : 's'}` : 'Cart'} onClick={() => go('cart')}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M3 4h2l2.5 12h11l2-9H6"/><circle cx="9" cy="20" r="1.5"/><circle cx="18" cy="20" r="1.5"/></svg>
              {cart > 0 && <span className="cart-count" aria-hidden="true">{cart}</span>}
            </button>
            {/* Hamburger — hidden on desktop via CSS, shown on mobile */}
            <button className="icon-btn hamburger" style={{display:'none'}} title="Menu" aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'} aria-expanded={mobileMenuOpen} aria-controls="mobile-nav" onClick={() => setMobileMenuOpen(o => !o)}>
              {mobileMenuOpen
                ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
                : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 12h18M3 6h18M3 18h18"/></svg>
              }
            </button>
          </div>
        </div>
      </div>
      {/* Mobile nav drawer — hidden on desktop via CSS */}
      {mobileMenuOpen && (
        <div id="mobile-nav" className="mobile-nav" role="dialog" aria-modal="true" aria-label="Navigation menu">
          <div className="mobile-nav-header">
            <Logo onClick={() => { go('home'); setMobileMenuOpen(false); }} />
            <button className="icon-btn" aria-label="Close menu" onClick={() => setMobileMenuOpen(false)}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
            </button>
          </div>
          {PRIMARY_PAGES.map(p => (
            <a key={p.id}
              href={isExternalLink(p.id) ? externalHref(p.id) : getSiteRoot() + p.id}
              className={page === p.id ? 'active' : ''}
              onClick={isExternalLink(p.id) ? undefined : (e) => { e.preventDefault(); handleNavClick(p.id); }}
              {...((p.id === 'forum-link' || p.id === 'games-link') ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
              {p.label}
            </a>
          ))}
          <div style={{borderTop:'2px solid var(--line)', marginTop:8}}>
            {UTILITY_PAGES.map(p => (
              <a key={p.id} href={getSiteRoot() + p.id} className={page === p.id ? 'active' : ''}
                onClick={(e) => { e.preventDefault(); handleNavClick(p.id); }}
                style={{fontSize:14, color:'var(--ink-2)'}}>
                {p.label}
              </a>
            ))}
          </div>
        </div>
      )}
    </header>
  );
}

// ---------------- Footer ----------------
function Footer() {
  const shop = useShop();
  const [topCategories, setTopCategories] = useState([]);
  const [footerServices, setFooterServices] = useState([]);

  useEffect(() => {
    fetch('/api/catalog/products')
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(d => {
        const counts = {};
        (d.items || []).forEach(p => {
          if (p.status === 'published' && p.category) {
            counts[p.category] = (counts[p.category] || 0) + 1;
          }
        });
        const sorted = Object.entries(counts)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 5)
          .map(([cat]) => cat);
        setTopCategories(sorted);
      })
      .catch(() => {});

    fetch('/api/catalog/services')
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(d => {
        setFooterServices((d.items || []).slice(0, 5));
      })
      .catch(() => {});
  }, []);

  return (
    <footer>
      <div className="container">
        <div className="grid">
          <div>
            <div className="logo">
              <div className="logo-mark sm" style={{background:'#000'}}>
                <img src="assets/logo.webp" alt="Outback Electronics" width="40" height="29" />
              </div>
              <div className="logo-text">
                <div className="sub" style={{color:'var(--ochre)'}}>{shop.tagline}</div>
              </div>
            </div>
            <p style={{marginTop: 18, fontSize: 13, color: 'var(--ink-on-dark-muted)', maxWidth: 360, lineHeight: 1.6}}>
              {shop.description}
            </p>
          </div>
          <div>
            <h3>Shop</h3>
            <ul>
              {topCategories.map((cat) => (
                <li key={cat}><a href="/shop" onClick={(e) => { e.preventDefault(); go('shop', { initialCat: cat }); }}>{cat}</a></li>
              ))}
            </ul>
          </div>
          <div>
            <h3>Services</h3>
            <ul>
              {footerServices.map((svc) => (
                <li key={svc.id}><a href={`/service/${svc.slug || svc.id}`} onClick={(e) => { e.preventDefault(); go('service', svc); }}>{svc.name}</a></li>
              ))}
            </ul>
          </div>
          <div>
            <h3>Community</h3>
            <ul>
              <li><a href="/tutorials" onClick={(e) => { e.preventDefault(); go('tutorials'); }}>Tutorials</a></li>
              <li><a href="/groups" onClick={(e) => { e.preventDefault(); go('groups'); }}>Groups</a></li>
              <li><a href="/memberships" onClick={(e) => { e.preventDefault(); go('memberships'); }}>Memberships</a></li>
              <li><a href="/sellers" onClick={(e) => { e.preventDefault(); go('sellers'); }}>Info for Sellers</a></li>
              <li><a href="/sell-gear" onClick={(e) => { e.preventDefault(); go('sell-gear'); }}>Sell Your Gear</a></li>
            </ul>
          </div>
          <div>
            <h3>Visit</h3>
            <ul style={{color:'var(--ink-on-dark-muted)'}}>
              <li>{[shop.suburb, shop.state, shop.postcode].filter(Boolean).join(' ')}<br/>No public access, arrive by appointment only.</li>
              {shop.phone && <li>{shop.phone}</li>}
              <li><a href="/contact" onClick={(e) => { e.preventDefault(); go('contact'); }} style={{color:'var(--ochre)'}}>Get directions →</a></li>
            </ul>
          </div>
        </div>
        <div className="baseline">
          <span>© 2023–2026 {shop.tradingName}{shop.abn ? ` · ABN ${shop.abn}` : ''}</span>
          {(shop.acknowledgmentPeople || shop.acknowledgmentCountry) && <span>ACKNOWLEDGES THE {(shop.acknowledgmentPeople || '').toUpperCase()} AS TRADITIONAL CUSTODIANS OF {(shop.acknowledgmentCountry || '').toUpperCase()}</span>}
        </div>
      </div>
    </footer>
  );
}

function useShopInfo() {
  const [info, setInfo] = useState({ shop: {} });
  useEffect(() => {
    fetch('/api/shop-info')
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (!d) return;
        if (d.portalUrl) _PORTAL_URL = d.portalUrl;
        if (d.gamesUrl)  _GAMES_URL  = d.gamesUrl;
        setInfo({ shop: d.shop || {} });
      })
      .catch(() => {});
  }, []);
  return info;
}

// ── App ───────────────────────────────────────────────────────────────────────
export default function App() {
  const [active, setActive] = useState('vdrop');
  const { shop } = useShopInfo();
  const [searchOpen, setSearchOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const portalUser = usePortalUser();
  const cart = useCartCount();

  const renderTool = () => {
    switch (active) {
      case 'vdrop':   return <VoltageDropCalc />;
      case 'fuse':    return <FuseCalc />;
      case 'battery': return <BatteryCalc />;
      case 'solar':   return <SolarCalc />;
      case 'wire':    return <WireGaugeCalc />;
      case 'led':     return <LEDCalc />;
      case 'ohms':    return <OhmsLawCalc />;
      case 'cap':     return <CapacitorCalc />;
      case 'relay':   return <RelayGuide />;
      default:        return null;
    }
  };

  return (
    <ShopContext.Provider value={shop}>
      <TopNav page="tools-link" cart={cart} onSearchOpen={() => setSearchOpen(true)} accountOpen={accountOpen} setAccountOpen={setAccountOpen} portalUser={portalUser} />

      {/* Page head — matches the shared PageHead on other pages */}
      <div className="page-head">
        <div className="container">
          <div className="crumbs eyebrow">
            <span>Outback</span>
            <span style={{ color: 'var(--ink-3)' }}>/</span>
            <span>Tools &amp; Calculators</span>
          </div>
          <h1>Tools &amp; Calculators</h1>
          <p className="lead">Free field calculators for 12/24/48V builds — voltage drop, fusing, battery runtime, solar sizing and more. Estimates for guidance; always verify critical installs with a qualified auto-electrician.</p>
        </div>
      </div>

      {/* Tool tabs */}
      <div style={{ background: 'var(--bg-elev)', borderBottom: '1px solid var(--line)' }}>
        <div className="container hscroll">
          <nav className="tabs" style={{ border: 'none', minWidth: 'max-content' }}>
            {TOOLS.map(t => (
              <button key={t.id} className={active === t.id ? 'tab active' : 'tab'} onClick={() => setActive(t.id)}>
                <span>{t.icon}</span>
                <span>{t.label}</span>
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Content */}
      <main className="container" style={{ flex: 1, paddingTop: 36, paddingBottom: 60, maxWidth: 720 }}>
        {renderTool()}
      </main>

      <Footer />
      {searchOpen && <SearchOverlay onClose={() => setSearchOpen(false)} />}
    </ShopContext.Provider>
  );
}
