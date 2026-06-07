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

// ── Shared helpers ────────────────────────────────────────────────────────────
const E12 = [1.0,1.2,1.5,1.8,2.2,2.7,3.3,3.9,4.7,5.6,6.8,8.2];
function nearestE12(v) {
  if (!v || v <= 0) return 0;
  const exp = Math.floor(Math.log10(v));
  const man = v / Math.pow(10, exp);
  return E12.reduce((a,b) => Math.abs(b-man)<Math.abs(a-man)?b:a) * Math.pow(10, exp);
}
function fmtR(v) {
  if (v >= 1e9) return `${(v/1e9).toPrecision(4)} GΩ`;
  if (v >= 1e6) return `${(v/1e6).toPrecision(4)} MΩ`;
  if (v >= 1e3) return `${(v/1e3).toPrecision(4)} kΩ`;
  if (v >= 1)   return `${v.toPrecision(4)} Ω`;
  return `${(v*1000).toPrecision(4)} mΩ`;
}
function fmtHz(v) {
  if (v >= 1e9) return `${(v/1e9).toPrecision(4)} GHz`;
  if (v >= 1e6) return `${(v/1e6).toPrecision(4)} MHz`;
  if (v >= 1e3) return `${(v/1e3).toPrecision(4)} kHz`;
  return `${v.toPrecision(4)} Hz`;
}
function fmtTime(s) {
  if (s >= 1)    return `${s.toFixed(4)} s`;
  if (s >= 1e-3) return `${(s*1e3).toFixed(4)} ms`;
  if (s >= 1e-6) return `${(s*1e6).toFixed(4)} µs`;
  return `${(s*1e9).toFixed(4)} ns`;
}

// ── PCB Tools ─────────────────────────────────────────────────────────────────
function TraceWidthCalc() {
  const [current, setCurrent] = useState('1');
  const [dT, setDT] = useState('10');
  const [layer, setLayer] = useState('external');
  const [oz, setOz] = useState('1');
  const [result, setResult] = useState(null);
  const calc = useCallback(() => {
    const I = parseFloat(current), deltaT = parseFloat(dT), cu = parseFloat(oz);
    if (!I || !deltaT || !cu) return;
    const k = layer === 'external' ? 0.048 : 0.024;
    const A_mil2 = Math.pow(I / (k * Math.pow(deltaT, 0.44)), 1/0.725);
    const thickness_mil = cu * 1.378;
    const width_mil = A_mil2 / thickness_mil;
    const width_mm = width_mil * 0.0254;
    setResult({ width_mil, width_mm, A_mil2, thickness_mil });
  }, [current, dT, layer, oz]);
  return (
    <Card title="Trace Width Calculator" icon="📐">
      <p style={{fontSize:13,color:C.ink2}}>IPC-2221 formula. Always verify with your PCB fab's design rules.</p>
      <Field label="Current" unit="A" value={current} onChange={setCurrent} min="0" step="0.1" />
      <Field label="Temp Rise" unit="°C" value={dT} onChange={setDT} options={[
        {value:'5',label:'5°C — sensitive board'},{value:'10',label:'10°C — standard'},{value:'20',label:'20°C — relaxed'},{value:'30',label:'30°C — power electronics'},
      ]} />
      <Field label="Layer" value={layer} onChange={setLayer} options={[
        {value:'external',label:'External (outer) — k=0.048'},{value:'internal',label:'Internal (inner) — k=0.024'},
      ]} />
      <Field label="Copper Weight" value={oz} onChange={setOz} options={[
        {value:'0.5',label:'0.5 oz (17.5 µm)'},{value:'1',label:'1 oz (35 µm) — standard'},{value:'2',label:'2 oz (70 µm)'},{value:'3',label:'3 oz (105 µm)'},
      ]} />
      <CalcBtn onClick={calc} />
      {result && (<><Divider />
        <Result label="Minimum Trace Width" value={`${result.width_mm.toFixed(3)} mm  (${result.width_mil.toFixed(1)} mil)`} color={C.blue} />
        <Result label="Cross-section Area" value={`${result.A_mil2.toFixed(1)} mil²`} color={C.ink2} note={`Copper thickness: ${(result.thickness_mil*25.4).toFixed(0)} µm`} />
      </>)}
    </Card>
  );
}

function ViaCurrentCalc() {
  const [drill, setDrill] = useState('0.3');
  const [plating, setPlating] = useState('25');
  const [dT, setDT] = useState('10');
  const [result, setResult] = useState(null);
  const calc = useCallback(() => {
    const D_mm = parseFloat(drill), t_um = parseFloat(plating), deltaT = parseFloat(dT);
    if (!D_mm || !t_um || !deltaT) return;
    const D_mil = D_mm / 0.0254, t_mil = t_um / 25.4;
    const A_mil2 = Math.PI * D_mil * t_mil;
    const I = 0.048 * Math.pow(deltaT, 0.44) * Math.pow(A_mil2, 0.725);
    setResult({ I, A_mil2, D_mil, t_mil });
  }, [drill, plating, dT]);
  return (
    <Card title="Via Current Calculator" icon="🔩">
      <p style={{fontSize:13,color:C.ink2}}>IPC-2221 — annular copper wall model. For high-current use filled/stacked vias.</p>
      <Field label="Drill Diameter" unit="mm" value={drill} onChange={setDrill} min="0.1" step="0.05" />
      <Field label="Copper Plating" unit="µm" value={plating} onChange={setPlating} options={[
        {value:'18',label:'18 µm — min standard'},{value:'25',label:'25 µm — IPC class 2'},{value:'35',label:'35 µm — class 3'},
      ]} />
      <Field label="Temp Rise" unit="°C" value={dT} onChange={setDT} options={[
        {value:'5',label:'5°C'},{value:'10',label:'10°C'},{value:'20',label:'20°C'},
      ]} />
      <CalcBtn onClick={calc} />
      {result && (<><Divider />
        <Result label="Max Via Current" value={`${result.I.toFixed(2)} A`} color={C.blue} />
        <Result label="Wall Cross-section" value={`${result.A_mil2.toFixed(1)} mil²`} color={C.ink2} note={`${result.D_mil.toFixed(1)} mil drill · ${result.t_mil.toFixed(1)} mil plating`} />
      </>)}
    </Card>
  );
}

function MicrostripCalc() {
  const [w, setW] = useState('1.5');
  const [h, setH] = useState('1.6');
  const [er, setEr] = useState('4.5');
  const [result, setResult] = useState(null);
  const calc = useCallback(() => {
    const W = parseFloat(w), H = parseFloat(h), Er = parseFloat(er);
    if (!W || !H || !Er) return;
    const ratio = W / H;
    const erEff = (Er+1)/2 + (Er-1)/2 * Math.pow(1+12/ratio, -0.5);
    const Z0 = ratio <= 1
      ? (60/Math.sqrt(erEff)) * Math.log(8*H/W + 0.25*W/H)
      : (120*Math.PI/Math.sqrt(erEff)) / (ratio + 1.393 + 0.667*Math.log(ratio+1.444));
    setResult({ Z0, erEff, ratio });
  }, [w, h, er]);
  return (
    <Card title="Microstrip Impedance" icon="〰">
      <p style={{fontSize:13,color:C.ink2}}>Hammerstad-Jensen approximation for single-ended microstrip on a PCB.</p>
      <Field label="Trace Width (W)" unit="mm" value={w} onChange={setW} min="0.01" step="0.05" />
      <Field label="Substrate Height (H)" unit="mm" value={h} onChange={setH} min="0.01" step="0.1" />
      <Field label="Dielectric Constant (Er)" value={er} onChange={setEr} options={[
        {value:'4.5',label:'4.5 — FR4 (typical)'},{value:'4.2',label:'4.2 — FR4 (low-loss)'},{value:'3.55',label:'3.55 — Rogers 4003C'},{value:'3.0',label:'3.0 — Rogers 3003'},{value:'2.2',label:'2.2 — PTFE / Rogers 5880'},
      ]} />
      <CalcBtn onClick={calc} />
      {result && (<><Divider />
        <Result label="Characteristic Impedance (Z₀)" value={`${result.Z0.toFixed(1)} Ω`}
          color={Math.abs(result.Z0-50)<3 ? C.green : Math.abs(result.Z0-50)<10 ? C.ochre : C.blue}
          note={`W/H=${result.ratio.toFixed(2)} · εr_eff=${result.erEff.toFixed(2)}. Common targets: 50Ω (RF), 75Ω (video), 90Ω (USB), 100Ω (diff pair).`} />
      </>)}
    </Card>
  );
}

function TraceResistanceCalc() {
  const [len, setLen] = useState('100');
  const [width, setWidth] = useState('1');
  const [oz, setOz] = useState('1');
  const [curr, setCurr] = useState('1');
  const [result, setResult] = useState(null);
  const calc = useCallback(() => {
    const L = parseFloat(len), W = parseFloat(width), cu = parseFloat(oz), I = parseFloat(curr);
    if (!L || !W || !cu) return;
    const thickness_mm = cu * 0.035;
    const A_mm2 = W * thickness_mm;
    const R = 1.72e-5 * L / A_mm2;
    const Vdrop = R * I, P = I * I * R;
    setResult({ R, Vdrop, P, thickness_mm });
  }, [len, width, oz, curr]);
  return (
    <Card title="PCB Trace Resistance" icon="〰">
      <Field label="Trace Length" unit="mm" value={len} onChange={setLen} min="0" step="1" />
      <Field label="Trace Width" unit="mm" value={width} onChange={setWidth} min="0.05" step="0.05" />
      <Field label="Copper Weight" value={oz} onChange={setOz} options={[
        {value:'0.5',label:'0.5 oz (17.5 µm)'},{value:'1',label:'1 oz (35 µm)'},{value:'2',label:'2 oz (70 µm)'},{value:'3',label:'3 oz (105 µm)'},
      ]} />
      <Field label="Current" unit="A" value={curr} onChange={setCurr} min="0" step="0.1" />
      <CalcBtn onClick={calc} />
      {result && (<><Divider />
        <Result label="Trace Resistance" value={result.R < 1 ? `${(result.R*1000).toFixed(2)} mΩ` : `${result.R.toFixed(4)} Ω`} color={C.blue} note={`Copper thickness: ${(result.thickness_mm*1000).toFixed(0)} µm`} />
        <Result label="Voltage Drop at given current" value={`${(result.Vdrop*1000).toFixed(2)} mV`} color={C.ink2} />
        <Result label="Power Dissipated" value={result.P < 0.001 ? `${(result.P*1e6).toFixed(1)} µW` : result.P < 1 ? `${(result.P*1000).toFixed(2)} mW` : `${result.P.toFixed(3)} W`} color={result.P > 0.5 ? C.red : C.green} />
      </>)}
    </Card>
  );
}

// ── Arduino / Embedded Tools ──────────────────────────────────────────────────
function VoltageDividerCalc() {
  const [vin, setVin] = useState('5');
  const [vout, setVout] = useState('3.3');
  const [solve, setSolve] = useState('r2');
  const [r1, setR1] = useState('10000');
  const [r2, setR2] = useState('');
  const [result, setResult] = useState(null);
  const calc = useCallback(() => {
    const Vin = parseFloat(vin), Vout = parseFloat(vout);
    if (!Vin || !Vout || Vout >= Vin) return;
    if (solve === 'r2') {
      const R1v = parseFloat(r1); if (!R1v) return;
      const R2calc = R1v * Vout / (Vin - Vout);
      const R2std = nearestE12(R2calc);
      const VoutA = Vin * R2std / (R1v + R2std);
      setResult({ calc: R2calc, std: R2std, VoutA, I: Vin/(R1v+R2std), label:'R2' });
    } else {
      const R2v = parseFloat(r2); if (!R2v) return;
      const R1calc = R2v * (Vin - Vout) / Vout;
      const R1std = nearestE12(R1calc);
      const VoutA = Vin * R2v / (R1std + R2v);
      setResult({ calc: R1calc, std: R1std, VoutA, I: Vin/(R1std+R2v), label:'R1' });
    }
  }, [vin, vout, solve, r1, r2]);
  return (
    <Card title="Voltage Divider" icon="↕">
      <p style={{fontSize:13,color:C.ink2}}>Vout = Vin × R2 / (R1+R2). R1 is top (Vin side), R2 is bottom (GND side).</p>
      <Field label="Vin" unit="V" value={vin} onChange={setVin} min="0" step="0.1" />
      <Field label="Target Vout" unit="V" value={vout} onChange={setVout} min="0" step="0.1" />
      <Field label="Solve for" value={solve} onChange={setSolve} options={[
        {value:'r2',label:'R2 (I know R1)'},{value:'r1',label:'R1 (I know R2)'},
      ]} />
      {solve === 'r2'
        ? <Field label="R1" unit="Ω" value={r1} onChange={setR1} min="0" step="any" />
        : <Field label="R2" unit="Ω" value={r2} onChange={setR2} min="0" step="any" />}
      <CalcBtn onClick={calc} />
      {result && (<><Divider />
        <Result label={`Exact ${result.label}`} value={fmtR(result.calc)} color={C.ink2} />
        <Result label={`Nearest E12 ${result.label}`} value={fmtR(result.std)} color={C.blue} note={`Actual Vout with E12 value: ${result.VoutA.toFixed(3)} V`} />
        <Result label="Divider Current" value={`${(result.I*1000).toFixed(2)} mA`} color={C.ink2} note="Load impedance should be >> R1+R2 for accuracy" />
      </>)}
    </Card>
  );
}

function I2CPullupCalc() {
  const [vcc, setVcc] = useState('3.3');
  const [cap, setCap] = useState('100');
  const [speed, setSpeed] = useState('400');
  const [result, setResult] = useState(null);
  const calc = useCallback(() => {
    const Vcc = parseFloat(vcc), C_pF = parseFloat(cap), f_kHz = parseFloat(speed);
    if (!Vcc || !C_pF || !f_kHz) return;
    const C_F = C_pF * 1e-12;
    const t_rise = f_kHz <= 100 ? 1000e-9 : f_kHz <= 400 ? 300e-9 : 120e-9;
    const R_max = t_rise / (2.197 * C_F);
    const I_OL = f_kHz <= 400 ? 3e-3 : 20e-3;
    const R_min = (Vcc - 0.4) / I_OL;
    const R_rec = nearestE12(Math.sqrt(R_min * R_max));
    setResult({ R_min, R_max, R_rec, t_rise, I_OL });
  }, [vcc, cap, speed]);
  return (
    <Card title="I²C Pull-up Resistor" icon="📡">
      <Field label="VCC" value={vcc} onChange={setVcc} options={[{value:'3.3',label:'3.3V'},{value:'5',label:'5V'}]} />
      <Field label="Bus Capacitance" unit="pF" value={cap} onChange={setCap} options={[
        {value:'50',label:'50 pF — short traces'},{value:'100',label:'100 pF — typical'},{value:'200',label:'200 pF — long bus'},{value:'400',label:'400 pF — spec max (SM/FM)'},
      ]} />
      <Field label="Bus Speed" value={speed} onChange={setSpeed} options={[
        {value:'100',label:'100 kHz — Standard Mode'},{value:'400',label:'400 kHz — Fast Mode'},{value:'1000',label:'1 MHz — Fast Mode Plus'},
      ]} />
      <CalcBtn onClick={calc} />
      {result && (<><Divider />
        <Result label="R minimum (drive strength)" value={fmtR(result.R_min)} color={C.red} note={`VOL=0.4V, IOL=${(result.I_OL*1000).toFixed(0)} mA`} />
        <Result label="R maximum (rise time)" value={fmtR(result.R_max)} color={C.ochre} note={`Rise time spec: ${(result.t_rise*1e9).toFixed(0)} ns`} />
        <Result label="Recommended E12 (geometric mean)" value={fmtR(result.R_rec)} color={C.green} />
      </>)}
    </Card>
  );
}

function GPIOResistorCalc() {
  const [vcc, setVcc] = useState('3.3');
  const [vf, setVf] = useState('2.1');
  const [mA, setMa] = useState('10');
  const [result, setResult] = useState(null);
  const calc = useCallback(() => {
    const Vcc = parseFloat(vcc), Vf = parseFloat(vf), I = parseFloat(mA)/1000;
    if (!Vcc || !I || Vf >= Vcc) return;
    const R = (Vcc - Vf) / I;
    const Rstd = nearestE12(R);
    setResult({ R, Rstd, I_actual: (Vcc-Vf)/Rstd, P: (Vcc-Vf)*I });
  }, [vcc, vf, mA]);
  return (
    <Card title="GPIO Current-Limiting Resistor" icon="🎛">
      <Field label="GPIO / Supply Voltage" value={vcc} onChange={setVcc} options={[
        {value:'1.8',label:'1.8V'},{value:'3.3',label:'3.3V'},{value:'5',label:'5V'},
      ]} />
      <Field label="Load Forward Voltage (Vf)" value={vf} onChange={setVf} options={[
        {value:'0',label:'0V — resistive load'},{value:'1.8',label:'1.8V — Red LED'},{value:'2.1',label:'2.1V — Red LED (std)'},{value:'2.5',label:'2.5V — Green LED'},{value:'3.0',label:'3.0V — Blue/White LED'},{value:'0.7',label:'0.7V — NPN base'},
      ]} />
      <Field label="Desired Current" unit="mA" value={mA} onChange={setMa} min="0" step="1" />
      <CalcBtn onClick={calc} />
      {result && (<><Divider />
        <Result label="Exact Resistor" value={fmtR(result.R)} color={C.ink2} note={`Power: ${(result.P*1000).toFixed(0)} mW`} />
        <Result label="Nearest E12" value={fmtR(result.Rstd)} color={C.blue} note={`Actual current: ${(result.I_actual*1000).toFixed(1)} mA`} />
      </>)}
    </Card>
  );
}

function PWMCalc() {
  const [freq, setFreq] = useState('1000');
  const [duty, setDuty] = useState('50');
  const [clk, setClk] = useState('16');
  const [result, setResult] = useState(null);
  const calc = useCallback(() => {
    const f = parseFloat(freq), D = parseFloat(duty)/100, Fclk = parseFloat(clk)*1e6;
    if (!f || !D || !Fclk) return;
    const period = 1/f, t_on = period*D, t_off = period*(1-D);
    const prescalers = [1,8,64,256,1024];
    let best = null;
    for (const ps of prescalers) {
      const top = Math.round(Fclk/(ps*f)) - 1;
      if (top > 0 && top <= 65535) {
        const compare = Math.round(top*D);
        const actualF = Fclk/(ps*(top+1));
        const err = Math.abs((actualF-f)/f)*100;
        if (!best || err < best.err) best = {ps, top, compare, actualF, err};
      }
    }
    setResult({ period, t_on, t_off, best });
  }, [freq, duty, clk]);
  return (
    <Card title="PWM Frequency / Duty Cycle" icon="📊">
      <Field label="Desired Frequency" unit="Hz" value={freq} onChange={setFreq} min="1" step="any" />
      <Field label="Duty Cycle" unit="%" value={duty} onChange={setDuty} min="0" max="100" step="0.1" />
      <Field label="Timer Clock" value={clk} onChange={setClk} options={[
        {value:'16',label:'16 MHz — Arduino Uno/Mega'},{value:'8',label:'8 MHz — Pro Mini 3.3V'},{value:'84',label:'84 MHz — Arduino Due'},{value:'72',label:'72 MHz — STM32F103'},{value:'168',label:'168 MHz — STM32F4'},{value:'240',label:'240 MHz — ESP32'},
      ]} />
      <CalcBtn onClick={calc} />
      {result && (<><Divider />
        <Result label="Period" value={fmtTime(result.period)} color={C.ink2} />
        <Result label="ON time" value={fmtTime(result.t_on)} color={C.green} />
        <Result label="OFF time" value={fmtTime(result.t_off)} color={C.ink2} />
        {result.best && <Result label="16-bit timer registers" value={`Prescaler=${result.best.ps}  TOP=${result.best.top}  OCR=${result.best.compare}`} color={C.blue} note={`Actual: ${result.best.actualF.toFixed(2)} Hz (${result.best.err.toFixed(2)}% error)`} />}
      </>)}
    </Card>
  );
}

function NTCThermistorCalc() {
  const [r0, setR0] = useState('10000');
  const [B, setB] = useState('3950');
  const [rSeries, setRSeries] = useState('10000');
  const [adc, setAdc] = useState('512');
  const [adcMax, setAdcMax] = useState('1023');
  const [result, setResult] = useState(null);
  const calc = useCallback(() => {
    const R0=parseFloat(r0), Bv=parseFloat(B), Rs=parseFloat(rSeries), Vadc=parseFloat(adc), Vmax=parseFloat(adcMax);
    if (!R0||!Bv||!Rs||!Vadc||!Vmax||Vadc>=Vmax) return;
    const R_ntc = Rs * Vadc / (Vmax - Vadc);
    const T_K = 1 / (1/298.15 + (1/Bv)*Math.log(R_ntc/R0));
    setResult({ R_ntc, T_C: T_K-273.15, T_F: (T_K-273.15)*9/5+32 });
  }, [r0, B, rSeries, adc, adcMax]);
  return (
    <Card title="NTC Thermistor Temperature" icon="🌡">
      <p style={{fontSize:13,color:C.ink2}}>NTC on bottom of voltage divider (GND side), series R on top (Vcc side).</p>
      <Field label="NTC R₀ at 25°C" unit="Ω" value={r0} onChange={setR0} min="0" step="any" />
      <Field label="B Coefficient" unit="K" value={B} onChange={setB} options={[
        {value:'3435',label:'3435 K — MF52 10kΩ'},{value:'3950',label:'3950 K — common 10kΩ'},{value:'3977',label:'3977 K — Vishay NTCLE'},{value:'4050',label:'4050 K — high-temp'},
      ]} />
      <Field label="Series Resistor" unit="Ω" value={rSeries} onChange={setRSeries} min="0" step="any" />
      <Field label="ADC Resolution" value={adcMax} onChange={setAdcMax} options={[
        {value:'1023',label:'10-bit (0–1023) — Arduino'},{value:'4095',label:'12-bit (0–4095) — STM32/ESP32'},
      ]} />
      <Field label="ADC Reading" value={adc} onChange={setAdc} min="0" step="1" />
      <CalcBtn onClick={calc} />
      {result && (<><Divider />
        <Result label="NTC Resistance" value={fmtR(result.R_ntc)} color={C.ink2} />
        <Result label="Temperature" value={`${result.T_C.toFixed(1)} °C  (${result.T_F.toFixed(1)} °F)`} color={C.blue} />
      </>)}
    </Card>
  );
}

// ── Discrete Circuit Tools ────────────────────────────────────────────────────
function OpAmpCalc() {
  const [mode, setMode] = useState('noninv');
  const [r1, setR1] = useState('10000');
  const [rf, setRf] = useState('100000');
  const [gbp, setGbp] = useState('');
  const [vin, setVin] = useState('1');
  const [result, setResult] = useState(null);
  const calc = useCallback(() => {
    const R1=parseFloat(r1), Rf=parseFloat(rf), Vin=parseFloat(vin);
    if (!R1||!Rf) return;
    const gain = mode==='noninv' ? 1+Rf/R1 : -(Rf/R1);
    const dB = 20*Math.log10(Math.abs(gain));
    const GBP = parseFloat(gbp);
    const bw = (GBP&&!isNaN(GBP)) ? GBP*1e6/Math.abs(gain) : null;
    setResult({ gain, dB, Vout: gain*Vin, bw });
  }, [mode, r1, rf, gbp, vin]);
  return (
    <Card title="Op-Amp Gain Calculator" icon="📈">
      <Field label="Configuration" value={mode} onChange={setMode} options={[
        {value:'noninv',label:'Non-inverting  (Gain = 1 + Rf/R1)'},{value:'inv',label:'Inverting  (Gain = −Rf/R1)'},
      ]} />
      <Field label="R1" unit="Ω" value={r1} onChange={setR1} min="0" step="any" />
      <Field label="Rf (feedback)" unit="Ω" value={rf} onChange={setRf} min="0" step="any" />
      <Field label="Vin" unit="V" value={vin} onChange={setVin} step="any" />
      <Field label="GBP (optional, for bandwidth)" unit="MHz" value={gbp} onChange={setGbp} min="0" step="any" />
      <CalcBtn onClick={calc} />
      {result && (<><Divider />
        <Result label="Voltage Gain" value={result.gain.toFixed(4)} color={C.blue} note={`${result.dB.toFixed(2)} dB`} />
        <Result label="Output Voltage" value={`${result.Vout.toFixed(4)} V`} color={C.green} />
        {result.bw && <Result label="−3dB Bandwidth" value={fmtHz(result.bw)} color={C.ink2} note="GBP ÷ |gain|" />}
      </>)}
    </Card>
  );
}

function Timer555Calc() {
  const [mode, setMode] = useState('astable');
  const [ra, setRa] = useState('10000');
  const [rb, setRb] = useState('10000');
  const [c, setC] = useState('0.1');
  const [result, setResult] = useState(null);
  const calc = useCallback(() => {
    const Ra=parseFloat(ra), Rb=parseFloat(rb), Cuf=parseFloat(c)*1e-6;
    if (!Ra||!Cuf) return;
    if (mode==='astable') {
      if (!Rb) return;
      const T_high=0.693*(Ra+Rb)*Cuf, T_low=0.693*Rb*Cuf;
      const period=T_high+T_low;
      setResult({ mode:'astable', T_high, T_low, period, freq:1/period, duty:T_high/period*100 });
    } else {
      setResult({ mode:'mono', t: 1.1*Ra*Cuf });
    }
  }, [mode, ra, rb, c]);
  return (
    <Card title="555 Timer" icon="⏰">
      <Field label="Mode" value={mode} onChange={setMode} options={[
        {value:'astable',label:'Astable (oscillator / PWM)'},{value:'monostable',label:'Monostable (one-shot pulse)'},
      ]} />
      <Field label={mode==='astable'?'RA':'R'} unit="Ω" value={ra} onChange={setRa} min="0" step="any" />
      {mode==='astable' && <Field label="RB" unit="Ω" value={rb} onChange={setRb} min="0" step="any" />}
      <Field label="C" unit="µF" value={c} onChange={setC} min="0" step="any" />
      <CalcBtn onClick={calc} />
      {result && (<><Divider />
        {result.mode==='astable' ? (<>
          <Result label="Frequency" value={fmtHz(result.freq)} color={C.blue} />
          <Result label="Period" value={fmtTime(result.period)} color={C.ink2} />
          <Result label="Duty Cycle" value={`${result.duty.toFixed(1)}%`} color={C.ink} note="555 astable is always >50%. Use output inverter for ≤50%." />
          <Result label="T_high / T_low" value={`${fmtTime(result.T_high)} / ${fmtTime(result.T_low)}`} color={C.ink2} />
        </>) : (
          <Result label="Output Pulse Width" value={fmtTime(result.t)} color={C.blue} note="t = 1.1 × R × C" />
        )}
      </>)}
    </Card>
  );
}

function RCFilterCalc() {
  const [type, setType] = useState('lp');
  const [r, setR] = useState('10000');
  const [cVal, setCVal] = useState('100');
  const [cUnit, setCUnit] = useState('nF');
  const [result, setResult] = useState(null);
  const cMult = {pF:1e-12, nF:1e-9, µF:1e-6};
  const calc = useCallback(() => {
    const R=parseFloat(r), Cv=parseFloat(cVal)*(cMult[cUnit]||1e-9);
    if (!R||!Cv) return;
    const tau=R*Cv, fc=1/(2*Math.PI*tau);
    setResult({ tau, fc });
  }, [r, cVal, cUnit]);
  return (
    <Card title="RC Filter" icon="🔊">
      <Field label="Filter Type" value={type} onChange={setType} options={[
        {value:'lp',label:'Low-pass — passes below fc'},{value:'hp',label:'High-pass — passes above fc'},
      ]} />
      <Field label="Resistance (R)" unit="Ω" value={r} onChange={setR} min="0" step="any" />
      <div style={{display:'flex',gap:10}}>
        <div style={{flex:2}}><Field label="Capacitance" unit={cUnit} value={cVal} onChange={setCVal} min="0" step="any" /></div>
        <div style={{flex:1}}><Field label="Unit" value={cUnit} onChange={setCUnit} options={[{value:'pF',label:'pF'},{value:'nF',label:'nF'},{value:'µF',label:'µF'}]} /></div>
      </div>
      <CalcBtn onClick={calc} />
      {result && (<><Divider />
        <Result label="Cutoff Frequency (−3dB)" value={fmtHz(result.fc)} color={C.blue}
          note={type==='lp' ? `Below ${fmtHz(result.fc)} passes; above attenuated at −20dB/decade` : `Above ${fmtHz(result.fc)} passes; below attenuated at −20dB/decade`} />
        <Result label="Time Constant (τ = RC)" value={fmtTime(result.tau)} color={C.ink2} />
      </>)}
    </Card>
  );
}

function SeriesParallelCalc() {
  const [compType, setCompType] = useState('R');
  const [mode, setMode] = useState('series');
  const [vals, setVals] = useState(['','','']);
  const [unit, setUnit] = useState('Ω');
  const unitOpts = {R:['mΩ','Ω','kΩ','MΩ'], C:['pF','nF','µF','mF'], L:['nH','µH','mH','H']};
  const unitBase = {'mΩ':1e-3,'Ω':1,'kΩ':1e3,'MΩ':1e6,'pF':1e-12,'nF':1e-9,'µF':1e-6,'mF':1e-3,'nH':1e-9,'µH':1e-6,'mH':1e-3,'H':1};
  const setVal = (i,v) => { const n=[...vals]; n[i]=v; setVals(n); };
  const inBase = vals.map(v=>parseFloat(v)).filter(v=>!isNaN(v)&&v>0).map(n=>n*(unitBase[unit]||1));
  let total = null;
  if (inBase.length >= 2) {
    if (compType==='R'||compType==='L') total = mode==='series' ? inBase.reduce((a,b)=>a+b,0) : 1/inBase.reduce((a,b)=>a+1/b,0);
    else total = mode==='series' ? 1/inBase.reduce((a,b)=>a+1/b,0) : inBase.reduce((a,b)=>a+b,0);
  }
  const fmtTotal = v => {
    if (!v) return '—';
    if (compType==='R') return fmtR(v);
    if (compType==='C') { if(v>=1e-3) return `${(v/1e-3).toPrecision(4)} mF`; if(v>=1e-6) return `${(v/1e-6).toPrecision(4)} µF`; if(v>=1e-9) return `${(v/1e-9).toPrecision(4)} nF`; return `${(v/1e-12).toPrecision(4)} pF`; }
    if(v>=1) return `${v.toPrecision(4)} H`; if(v>=1e-3) return `${(v/1e-3).toPrecision(4)} mH`; if(v>=1e-6) return `${(v/1e-6).toPrecision(4)} µH`; return `${(v/1e-9).toPrecision(4)} nH`;
  };
  return (
    <Card title="Series / Parallel R, C, L" icon="⛓">
      <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
        <Field label="Component" value={compType} onChange={v=>{setCompType(v);setUnit(unitOpts[v][1]);}} options={[{value:'R',label:'Resistors'},{value:'C',label:'Capacitors'},{value:'L',label:'Inductors'}]} />
        <Field label="Configuration" value={mode} onChange={setMode} options={[{value:'series',label:'Series'},{value:'parallel',label:'Parallel'}]} />
        <Field label="Unit" value={unit} onChange={setUnit} options={unitOpts[compType].map(u=>({value:u,label:u}))} />
      </div>
      {vals.map((v,i) => (
        <div key={i} style={{display:'flex',gap:8}}>
          <div style={{flex:1}}>
            <label className="field" style={{marginBottom:0}}>
              <span className="label">Value {i+1} · {unit}</span>
              <input className="input" type="number" value={v} min="0" step="any" onChange={e=>setVal(i,e.target.value)} />
            </label>
          </div>
          {vals.length>2 && <button onClick={()=>setVals(vals.filter((_,idx)=>idx!==i))} style={{background:'none',border:`1px solid ${C.line}`,borderRadius:6,width:32,cursor:'pointer',color:C.ink2,fontSize:16,alignSelf:'flex-end',flexShrink:0}}>×</button>}
        </div>
      ))}
      <div style={{display:'flex',gap:10}}>
        {vals.length<8 && <button className="btn" style={{fontSize:13,padding:'8px 16px'}} onClick={()=>setVals([...vals,''])}>+ Add</button>}
      </div>
      {total !== null && (<><Divider /><Result label={`Total (${mode})`} value={fmtTotal(total)} color={C.green} note={`${inBase.length} values combined`} /></>)}
    </Card>
  );
}

function ZenerCalc() {
  const [vin, setVin] = useState('12');
  const [vz, setVz] = useState('5.1');
  const [il, setIl] = useState('50');
  const [iz, setIz] = useState('10');
  const [result, setResult] = useState(null);
  const calc = useCallback(() => {
    const Vin=parseFloat(vin), Vz=parseFloat(vz), Il=parseFloat(il)/1000, Iz=parseFloat(iz)/1000;
    if (!Vin||!Vz||Vin<=Vz) return;
    const I_total=Il+Iz, R=(Vin-Vz)/I_total, Rstd=nearestE12(R);
    const I_std=(Vin-Vz)/Rstd;
    setResult({ R, Rstd, Iz_actual: I_std-Il, P_R:(Vin-Vz)*I_std, P_Z:Vz*(I_std-Il) });
  }, [vin, vz, il, iz]);
  return (
    <Card title="Zener Diode Regulator" icon="↗">
      <Field label="Input Voltage (Vin)" unit="V" value={vin} onChange={setVin} min="0" step="0.1" />
      <Field label="Zener Voltage (Vz)" value={vz} onChange={setVz} options={[
        {value:'2.4',label:'2.4V'},{value:'3.3',label:'3.3V'},{value:'3.6',label:'3.6V'},{value:'5.1',label:'5.1V'},{value:'6.2',label:'6.2V'},{value:'9.1',label:'9.1V'},{value:'12',label:'12V'},{value:'15',label:'15V'},
      ]} />
      <Field label="Load Current (Il)" unit="mA" value={il} onChange={setIl} min="0" step="1" />
      <Field label="Min Zener Current (Iz)" unit="mA" value={iz} onChange={setIz} options={[
        {value:'5',label:'5 mA — minimum'},{value:'10',label:'10 mA — standard'},{value:'20',label:'20 mA — stable'},
      ]} />
      <CalcBtn onClick={calc} />
      {result && (<><Divider />
        <Result label="Series Resistor (exact)" value={fmtR(result.R)} color={C.ink2} />
        <Result label="Nearest E12 Resistor" value={fmtR(result.Rstd)} color={C.blue} note={`Actual Iz: ${(result.Iz_actual*1000).toFixed(1)} mA`} />
        <Result label="Resistor Power" value={`${(result.P_R*1000).toFixed(0)} mW`} color={result.P_R>0.25?C.red:C.green} note="Power rating needed for series resistor" />
        <Result label="Zener Power" value={`${(result.P_Z*1000).toFixed(0)} mW`} color={result.P_Z>0.25?C.ochre:C.green} note="Must be within zener's rated power" />
      </>)}
    </Card>
  );
}

function BJTBiasCalc() {
  const [vcc, setVcc] = useState('12');
  const [r1, setR1] = useState('47000');
  const [r2, setR2] = useState('10000');
  const [rc, setRc] = useState('4700');
  const [re, setRe] = useState('1000');
  const [beta, setBeta] = useState('100');
  const [result, setResult] = useState(null);
  const calc = useCallback(() => {
    const Vcc=parseFloat(vcc), R1=parseFloat(r1), R2=parseFloat(r2), Rc=parseFloat(rc), Re=parseFloat(re), B=parseFloat(beta);
    if (!Vcc||!R1||!R2||!Rc||!Re||!B) return;
    const Vth=Vcc*R2/(R1+R2), Rth=R1*R2/(R1+R2);
    const Ib=(Vth-0.7)/(Rth+(B+1)*Re), Ic=B*Ib;
    const Vb=Vth-Ib*Rth, Ve=Vb-0.7, Vc=Vcc-Ic*Rc, Vce=Vc-Ve;
    const region = Vce<0.2?'Saturation':Ib<=0||Ic<=0?'Cutoff':'Active';
    setResult({ Vb, Ve, Vc, Vce, Ib, Ic, region });
  }, [vcc, r1, r2, rc, re, beta]);
  const regionColor = r => r==='Active'?C.green:r==='Saturation'?C.ochre:C.red;
  return (
    <Card title="BJT Voltage-Divider Bias (NPN)" icon="🔬">
      <p style={{fontSize:13,color:C.ink2}}>Vcc → R1 → base node, R2 → GND. Rc = collector load, Re = emitter degeneration. Vbe = 0.7V.</p>
      <Field label="VCC" unit="V" value={vcc} onChange={setVcc} min="0" step="0.1" />
      <Field label="R1 (top)" unit="Ω" value={r1} onChange={setR1} min="0" step="any" />
      <Field label="R2 (bottom)" unit="Ω" value={r2} onChange={setR2} min="0" step="any" />
      <Field label="RC (collector)" unit="Ω" value={rc} onChange={setRc} min="0" step="any" />
      <Field label="RE (emitter)" unit="Ω" value={re} onChange={setRe} min="0" step="any" />
      <Field label="β (hFE)" value={beta} onChange={setBeta} options={[{value:'50',label:'50'},{value:'100',label:'100'},{value:'200',label:'200'},{value:'300',label:'300'}]} />
      <CalcBtn onClick={calc} />
      {result && (<><Divider />
        <Result label="Operating Region" value={result.region} color={regionColor(result.region)} />
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
          <Result label="Vb" value={`${result.Vb.toFixed(3)} V`} />
          <Result label="Ve" value={`${result.Ve.toFixed(3)} V`} />
          <Result label="Vc" value={`${result.Vc.toFixed(3)} V`} />
          <Result label="Vce" value={`${result.Vce.toFixed(3)} V`} />
          <Result label="Ic" value={`${(result.Ic*1000).toFixed(2)} mA`} />
          <Result label="Ib" value={`${(result.Ib*1e6).toFixed(1)} µA`} />
        </div>
      </>)}
    </Card>
  );
}

function InductorReactanceCalc() {
  const [lVal, setLVal] = useState('100');
  const [lUnit, setLUnit] = useState('µH');
  const [cVal, setCVal] = useState('100');
  const [cUnit, setCUnit] = useState('nF');
  const [fVal, setFVal] = useState('100');
  const [fUnit, setFUnit] = useState('kHz');
  const [result, setResult] = useState(null);
  const lBase = {nH:1e-9, µH:1e-6, mH:1e-3, H:1};
  const cBase = {pF:1e-12, nF:1e-9, µF:1e-6};
  const fBase = {Hz:1, kHz:1e3, MHz:1e6};
  const calc = useCallback(() => {
    const L=parseFloat(lVal)*(lBase[lUnit]||1e-6), C=parseFloat(cVal)*(cBase[cUnit]||1e-9), f=parseFloat(fVal)*(fBase[fUnit]||1e3);
    if (!L||!f) return;
    const XL=2*Math.PI*f*L;
    const XC=C?1/(2*Math.PI*f*C):null;
    const fRes=C?1/(2*Math.PI*Math.sqrt(L*C)):null;
    setResult({ XL, XC, fRes, Zseries: XC!==null?Math.abs(XL-XC):null });
  }, [lVal, lUnit, cVal, cUnit, fVal, fUnit]);
  return (
    <Card title="L/C Reactance & Resonance" icon="🌀">
      <div style={{display:'flex',gap:10}}>
        <div style={{flex:2}}><Field label="Inductance" value={lVal} onChange={setLVal} min="0" step="any" /></div>
        <div style={{flex:1}}><Field label="Unit" value={lUnit} onChange={setLUnit} options={[{value:'nH',label:'nH'},{value:'µH',label:'µH'},{value:'mH',label:'mH'},{value:'H',label:'H'}]} /></div>
      </div>
      <div style={{display:'flex',gap:10}}>
        <div style={{flex:2}}><Field label="Capacitance (optional)" value={cVal} onChange={setCVal} min="0" step="any" /></div>
        <div style={{flex:1}}><Field label="Unit" value={cUnit} onChange={setCUnit} options={[{value:'pF',label:'pF'},{value:'nF',label:'nF'},{value:'µF',label:'µF'}]} /></div>
      </div>
      <div style={{display:'flex',gap:10}}>
        <div style={{flex:2}}><Field label="Frequency" value={fVal} onChange={setFVal} min="0" step="any" /></div>
        <div style={{flex:1}}><Field label="Unit" value={fUnit} onChange={setFUnit} options={[{value:'Hz',label:'Hz'},{value:'kHz',label:'kHz'},{value:'MHz',label:'MHz'}]} /></div>
      </div>
      <CalcBtn onClick={calc} />
      {result && (<><Divider />
        <Result label="Inductive Reactance (XL)" value={fmtR(result.XL)} color={C.blue} note="XL = 2πfL" />
        {result.XC!==null && <Result label="Capacitive Reactance (XC)" value={fmtR(result.XC)} color={C.ochre} note="XC = 1/(2πfC)" />}
        {result.fRes!==null && <Result label="LC Resonant Frequency" value={fmtHz(result.fRes)} color={C.green} note="f = 1/(2π√LC) — XL equals XC at this point" />}
        {result.Zseries!==null && <Result label="|Z| Series LC at given freq" value={fmtR(result.Zseries)} color={C.ink2} />}
      </>)}
    </Card>
  );
}

// ── General Tools ─────────────────────────────────────────────────────────────
const RC_COLORS = [
  {name:'Black', bg:'#1a1a1a',fg:'#fff', digit:0, mult:1,    tol:null,     tc:null},
  {name:'Brown', bg:'#8B4513',fg:'#fff', digit:1, mult:10,   tol:'±1%',    tc:'100 ppm/°C'},
  {name:'Red',   bg:'#CC2200',fg:'#fff', digit:2, mult:100,  tol:'±2%',    tc:'50 ppm/°C'},
  {name:'Orange',bg:'#FF6600',fg:'#fff', digit:3, mult:1e3,  tol:'±0.05%', tc:'15 ppm/°C'},
  {name:'Yellow',bg:'#E8C000',fg:'#333', digit:4, mult:1e4,  tol:'±0.02%', tc:'25 ppm/°C'},
  {name:'Green', bg:'#228B22',fg:'#fff', digit:5, mult:1e5,  tol:'±0.5%',  tc:null},
  {name:'Blue',  bg:'#0055CC',fg:'#fff', digit:6, mult:1e6,  tol:'±0.25%', tc:'10 ppm/°C'},
  {name:'Violet',bg:'#7B2FBE',fg:'#fff', digit:7, mult:1e7,  tol:'±0.1%',  tc:'5 ppm/°C'},
  {name:'Grey',  bg:'#808080',fg:'#fff', digit:8, mult:1e8,  tol:'±0.05%', tc:null},
  {name:'White', bg:'#EEEEEE',fg:'#333', digit:9, mult:1e9,  tol:null,     tc:null},
  {name:'Gold',  bg:'#B8960C',fg:'#fff', digit:null, mult:0.1,  tol:'±5%',  tc:null},
  {name:'Silver',bg:'#A0A0A0',fg:'#fff', digit:null, mult:0.01, tol:'±10%', tc:null},
  {name:'None',  bg:'transparent',fg:'#999', digit:null, mult:null, tol:'±20%', tc:null},
];

function ResistorColorCalc() {
  const [bands, setBands] = useState(4);
  const [b1,setB1]=useState('Brown'); const [b2,setB2]=useState('Black');
  const [b3,setB3]=useState('Black'); const [b4,setB4]=useState('Red');
  const [b5,setB5]=useState('Gold');  const [b6,setB6]=useState('Brown');
  const getC = name => RC_COLORS.find(c=>c.name===name);
  const digitC = RC_COLORS.filter(c=>c.digit!==null);
  const multC  = RC_COLORS.filter(c=>c.mult!==null&&c.name!=='None');
  const tolC   = RC_COLORS.filter(c=>c.tol!==null);
  const tcC    = RC_COLORS.filter(c=>c.tc!==null);

  let value=null, tol=null, tc=null;
  const c1=getC(b1),c2=getC(b2),c3=getC(b3),c4=getC(b4),c5=getC(b5),c6=getC(b6);
  if (bands===4 && c1?.digit!=null && c2?.digit!=null && c4?.mult!=null) value=(c1.digit*10+c2.digit)*c4.mult;
  else if (bands>=5 && c1?.digit!=null && c2?.digit!=null && c3?.digit!=null && c4?.mult!=null) value=(c1.digit*100+c2.digit*10+c3.digit)*c4.mult;
  tol=c5?.tol; if(bands===6) tc=c6?.tc;

  const fmtVal = v => {
    if(v==null) return '—';
    if(v>=1e9) return `${(v/1e9).toPrecision(4)} GΩ`;
    if(v>=1e6) return `${(v/1e6).toPrecision(4)} MΩ`;
    if(v>=1e3) return `${(v/1e3).toPrecision(4)} kΩ`;
    return `${v.toPrecision(4)} Ω`;
  };

  const BandSelect = ({label, val, set, opts}) => {
    const color = getC(val);
    return (
      <div style={{flex:1,minWidth:72,textAlign:'center'}}>
        <div style={{fontSize:11,color:C.ink3,marginBottom:4}}>{label}</div>
        <div style={{height:32,background:color?.bg||'transparent',border:`1px solid ${C.line}`,borderRadius:4,marginBottom:4}} />
        <select className="select" value={val} onChange={e=>set(e.target.value)} style={{fontSize:12,padding:'4px 2px',width:'100%'}}>
          {opts.map(o=><option key={o.name} value={o.name}>{o.name}</option>)}
        </select>
      </div>
    );
  };

  return (
    <Card title="Resistor Colour Code" icon="🌈">
      <Field label="Number of Bands" value={String(bands)} onChange={v=>setBands(Number(v))} options={[
        {value:'4',label:'4 bands (±5% / ±10%)'},{value:'5',label:'5 bands (±1% / ±2%)'},{value:'6',label:'6 bands (+ temp coefficient)'},
      ]} />
      <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
        <BandSelect label="Band 1" val={b1} set={setB1} opts={digitC} />
        <BandSelect label="Band 2" val={b2} set={setB2} opts={digitC} />
        {bands>=5 && <BandSelect label="Band 3" val={b3} set={setB3} opts={digitC} />}
        <BandSelect label="Multiplier" val={b4} set={setB4} opts={multC} />
        <BandSelect label="Tolerance" val={b5} set={setB5} opts={tolC} />
        {bands===6 && <BandSelect label="Temp Co" val={b6} set={setB6} opts={tcC} />}
      </div>
      {value!==null && (<><Divider />
        <Result label="Resistance" value={fmtVal(value)} color={C.blue} note={[tol,tc].filter(Boolean).join(' · ')} />
      </>)}
    </Card>
  );
}

function UnitConverterCalc() {
  const [cat,setCat]=useState('cap');
  const [val,setVal]=useState('1');
  const [fromU,setFromU]=useState('µF');
  const cats = {
    cap:  {label:'Capacitance', units:['pF','nF','µF','mF','F'],    base:{pF:1e-12,nF:1e-9,µF:1e-6,mF:1e-3,F:1}},
    freq: {label:'Frequency',   units:['Hz','kHz','MHz','GHz'],      base:{Hz:1,kHz:1e3,MHz:1e6,GHz:1e9}},
    ind:  {label:'Inductance',  units:['nH','µH','mH','H'],          base:{nH:1e-9,µH:1e-6,mH:1e-3,H:1}},
    res:  {label:'Resistance',  units:['mΩ','Ω','kΩ','MΩ','GΩ'],    base:{'mΩ':1e-3,'Ω':1,'kΩ':1e3,'MΩ':1e6,'GΩ':1e9}},
    volt: {label:'Voltage',     units:['µV','mV','V','kV'],           base:{'µV':1e-6,'mV':1e-3,'V':1,'kV':1e3}},
    curr: {label:'Current',     units:['nA','µA','mA','A'],           base:{'nA':1e-9,'µA':1e-6,'mA':1e-3,'A':1}},
    pwr:  {label:'Power',       units:['µW','mW','W','kW'],           base:{'µW':1e-6,'mW':1e-3,'W':1,'kW':1e3}},
  };
  const c=cats[cat];
  const baseVal=parseFloat(val)*(c.base[fromU]||1);
  const fmtN=v=>{ if(isNaN(v))return'—'; if(Math.abs(v)===0)return'0'; if(Math.abs(v)>=1e10||(Math.abs(v)<1e-6&&v!==0))return v.toExponential(4); return parseFloat(v.toPrecision(6)).toString(); };
  return (
    <Card title="Unit Converter" icon="📏">
      <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
        {Object.entries(cats).map(([k,cc])=>(
          <button key={k} onClick={()=>{setCat(k);setFromU(cc.units[Math.floor(cc.units.length/2)]);setVal('1');}}
            className={cat===k?'btn btn-rust':'btn'} style={{fontSize:12,padding:'6px 12px'}}>{cc.label}</button>
        ))}
      </div>
      <div style={{display:'flex',gap:10}}>
        <div style={{flex:2}}>
          <label className="field" style={{marginBottom:0}}><span className="label">Value</span>
            <input className="input" type="number" value={val} onChange={e=>setVal(e.target.value)} step="any" />
          </label>
        </div>
        <div style={{flex:1}}><Field label="From" value={fromU} onChange={setFromU} options={c.units.map(u=>({value:u,label:u}))} /></div>
      </div>
      <div style={{display:'flex',flexDirection:'column',gap:6}}>
        {c.units.map(u=>(
          <div key={u} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'10px 14px',
            background:u===fromU?'var(--bg-elev)':'transparent',border:`1px solid ${C.line}`,borderRadius:6}}>
            <span style={{fontSize:13,color:C.ink2,width:48}}>{u}</span>
            <span style={{fontSize:15,fontWeight:600,fontFamily:'monospace',color:C.ink}}>{fmtN(baseVal/(c.base[u]||1))}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

function DBmCalc() {
  const [mode,setMode]=useState('dbm');
  const [inputVal,setInputVal]=useState('0');
  const [result,setResult]=useState(null);
  const calc=useCallback(()=>{
    const v=parseFloat(inputVal); if(isNaN(v))return;
    let dBm,mW;
    if(mode==='dbm'){dBm=v;mW=Math.pow(10,dBm/10);}
    else{mW=v;if(mW<=0)return;dBm=10*Math.log10(mW);}
    setResult({dBm,mW,W:mW/1000,dBW:dBm-30});
  },[mode,inputVal]);
  const refs=[
    {dBm:-30,label:'1 µW'},{dBm:-20,label:'10 µW'},{dBm:-10,label:'100 µW'},
    {dBm:0,label:'1 mW'},{dBm:10,label:'10 mW'},{dBm:20,label:'100 mW'},
    {dBm:27,label:'500 mW (WiFi max)'},{dBm:30,label:'1 W'},{dBm:37,label:'5 W'},
    {dBm:40,label:'10 W'},{dBm:43,label:'20 W'},{dBm:50,label:'100 W'},
  ];
  return (
    <Card title="dBm ↔ Power Converter" icon="📶">
      <Field label="Input as" value={mode} onChange={setMode} options={[{value:'dbm',label:'dBm → Watts'},{value:'mw',label:'mW → dBm'}]} />
      <Field label={mode==='dbm'?'Power (dBm)':'Power (mW)'} unit={mode==='dbm'?'dBm':'mW'} value={inputVal} onChange={setInputVal} step="any" />
      <CalcBtn onClick={calc} />
      {result && (<><Divider />
        <Result label="dBm" value={`${result.dBm.toFixed(2)} dBm`} color={C.blue} />
        <Result label="mW"  value={`${result.mW<0.001?result.mW.toExponential(3):result.mW.toPrecision(4)} mW`} color={C.ink} />
        <Result label="W"   value={`${result.W<0.0001?result.W.toExponential(3):result.W.toPrecision(4)} W`} color={C.ink2} />
        <Result label="dBW" value={`${result.dBW.toFixed(2)} dBW`} color={C.ink3} />
      </>)}
      <div style={{marginTop:8}}>
        <div className="eyebrow" style={{marginBottom:8}}>Quick reference</div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:4}}>
          {refs.map(r=>(
            <div key={r.dBm} style={{display:'flex',justifyContent:'space-between',padding:'5px 10px',fontSize:12,
              border:`1px solid ${C.line}`,borderRadius:5,background:result&&Math.abs(result.dBm-r.dBm)<0.5?'var(--bg-elev)':'transparent'}}>
              <span style={{color:C.ink2}}>{r.dBm} dBm</span>
              <span style={{color:C.ink}}>{r.label}</span>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

function PowerRatingCalc() {
  const [r,setR]=useState('100');
  const [rating,setRating]=useState('0.25');
  const [mode,setMode]=useState('voltage');
  const [inp,setInp]=useState('5');
  const [result,setResult]=useState(null);
  const calc=useCallback(()=>{
    const R=parseFloat(r),Pr=parseFloat(rating),v=parseFloat(inp);
    if(!R||!Pr||!v)return;
    let P,I,V;
    if(mode==='voltage'){V=v;I=V/R;P=V*V/R;}else{I=v;V=I*R;P=I*I*R;}
    const pct=(P/Pr)*100;
    setResult({P,I,V,pct,color:pct>90?C.red:pct>66?C.ochre:C.green});
  },[r,rating,mode,inp]);
  return (
    <Card title="Power / Thermal Rating Check" icon="🌡">
      <Field label="Resistance" unit="Ω" value={r} onChange={setR} min="0" step="any" />
      <Field label="Component Power Rating" value={rating} onChange={setRating} options={[
        {value:'0.063',label:'1/16 W'},{value:'0.1',label:'1/10 W'},{value:'0.125',label:'1/8 W'},{value:'0.25',label:'1/4 W'},{value:'0.5',label:'1/2 W'},{value:'1',label:'1 W'},{value:'2',label:'2 W'},{value:'5',label:'5 W'},{value:'10',label:'10 W'},
      ]} />
      <Field label="Known value" value={mode} onChange={setMode} options={[{value:'voltage',label:'Apply Voltage (V)'},{value:'current',label:'Apply Current (A)'}]} />
      <Field label={mode==='voltage'?'Voltage':'Current'} unit={mode==='voltage'?'V':'A'} value={inp} onChange={setInp} min="0" step="any" />
      <CalcBtn onClick={calc} />
      {result && (<><Divider />
        <Result label="Power Dissipated" value={result.P<1?`${(result.P*1000).toFixed(1)} mW`:`${result.P.toFixed(3)} W`} color={result.color} note={`${result.pct.toFixed(1)}% of rated power`} />
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
          <Result label="Voltage" value={`${result.V.toFixed(3)} V`} />
          <Result label="Current" value={result.I<0.01?`${(result.I*1000).toFixed(2)} mA`:`${result.I.toFixed(4)} A`} />
        </div>
        {result.pct>90 && <div style={{padding:'12px 14px',borderRadius:8,background:'#fef2f2',border:`1px solid ${C.red}`,fontSize:12,color:C.red}}><strong>Over-rated!</strong> {result.pct.toFixed(0)}% of thermal limit — use a higher-wattage component.</div>}
        {result.pct>66&&result.pct<=90 && <div style={{padding:'12px 14px',borderRadius:8,background:'#fff8e6',border:`1px solid ${C.ochre}`,fontSize:12,color:C.ink2}}><strong>Marginal.</strong> Standard practice is to derate to 50% of rated power for long-term reliability.</div>}
      </>)}
    </Card>
  );
}

// ── Sections ──────────────────────────────────────────────────────────────────
const SECTIONS = [
  { id:'automotive', label:'Automotive / 12V', tools:[
    {id:'vdrop',    label:'Voltage Drop',    icon:'⚡'},
    {id:'fuse',     label:'Fuse Rating',     icon:'🔌'},
    {id:'battery',  label:'Battery Runtime', icon:'🔋'},
    {id:'solar',    label:'Solar Sizing',    icon:'☀️'},
    {id:'wire',     label:'Wire Gauge',      icon:'🔧'},
    {id:'led',      label:'LED Resistor',    icon:'💡'},
    {id:'ohms',     label:"Ohm's Law",       icon:'🧮'},
    {id:'cap',      label:'Capacitor Timer', icon:'⏱️'},
    {id:'relay',    label:'Relay Wiring',    icon:'🔄'},
  ]},
  { id:'pcb', label:'PCB Design', tools:[
    {id:'trace',      label:'Trace Width',      icon:'📐'},
    {id:'via',        label:'Via Current',      icon:'🔩'},
    {id:'microstrip', label:'Impedance',         icon:'〰'},
    {id:'traceres',   label:'Trace Resistance',  icon:'〰'},
  ]},
  { id:'embedded', label:'Arduino / Embedded', tools:[
    {id:'vdivider', label:'Voltage Divider', icon:'↕'},
    {id:'i2c',      label:'I²C Pull-up',     icon:'📡'},
    {id:'gpio',     label:'GPIO Resistor',   icon:'🎛'},
    {id:'pwm',      label:'PWM / Timer',     icon:'📊'},
    {id:'ntc',      label:'NTC Thermistor',  icon:'🌡'},
  ]},
  { id:'discrete', label:'Discrete Circuits', tools:[
    {id:'opamp',    label:'Op-Amp Gain',     icon:'📈'},
    {id:'timer555', label:'555 Timer',       icon:'⏰'},
    {id:'rcfilter', label:'RC Filter',       icon:'🔊'},
    {id:'serpar',   label:'Series/Parallel', icon:'⛓'},
    {id:'zener',    label:'Zener Diode',     icon:'↗'},
    {id:'bjt',      label:'BJT Bias',        icon:'🔬'},
    {id:'reactance',label:'L/C Reactance',   icon:'🌀'},
  ]},
  { id:'general', label:'General', tools:[
    {id:'resistorcode', label:'Resistor Code',  icon:'🌈'},
    {id:'units',        label:'Unit Converter', icon:'📏'},
    {id:'dbm',          label:'dBm / Power',    icon:'📶'},
    {id:'pwrrating',    label:'Power Rating',   icon:'🌡'},
  ]},
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
let _FORUM_URL  = 'https://forum.outbackelectronics.com.au';
let _GAMES_URL  = 'https://games.outbackelectronics.com.au';
let _TOOLS_URL  = 'https://tools.outbackelectronics.com.au';
function getPortalUrl() { return _PORTAL_URL; }
function getForumUrl()  { return _FORUM_URL; }
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
  { id: 'forum-link', label: 'Forum' },
  { id: 'games-link', label: 'Games' },
  { id: 'groups', label: 'Groups' },
];
// Pages served from their own subdomain (tools./forum./games.) — mirrors app.jsx.
const EXTERNAL_LINKS = {
  'forum-link': getForumUrl,
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
              <li>{[shop.streetAddress, [shop.suburb, shop.state, shop.postcode].filter(Boolean).join(' ')].filter(Boolean).join(', ')}<br/>No public access, arrive by appointment only.</li>
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
        if (d.forumUrl)  _FORUM_URL  = d.forumUrl;
        if (d.gamesUrl)  _GAMES_URL  = d.gamesUrl;
        setInfo({ shop: d.shop || {} });
      })
      .catch(() => {});
  }, []);
  return info;
}

// ── App ───────────────────────────────────────────────────────────────────────
export default function App() {
  const [activeSection, setActiveSection] = useState('automotive');
  const [activeTool, setActiveTool] = useState('vdrop');
  const { shop } = useShopInfo();
  const [searchOpen, setSearchOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const portalUser = usePortalUser();
  const cart = useCartCount();

  const section = SECTIONS.find(s => s.id === activeSection);

  const selectSection = (sid) => {
    setActiveSection(sid);
    const s = SECTIONS.find(s => s.id === sid);
    if (s) setActiveTool(s.tools[0].id);
  };

  const renderTool = () => {
    switch (activeTool) {
      case 'vdrop':       return <VoltageDropCalc />;
      case 'fuse':        return <FuseCalc />;
      case 'battery':     return <BatteryCalc />;
      case 'solar':       return <SolarCalc />;
      case 'wire':        return <WireGaugeCalc />;
      case 'led':         return <LEDCalc />;
      case 'ohms':        return <OhmsLawCalc />;
      case 'cap':         return <CapacitorCalc />;
      case 'relay':       return <RelayGuide />;
      case 'trace':       return <TraceWidthCalc />;
      case 'via':         return <ViaCurrentCalc />;
      case 'microstrip':  return <MicrostripCalc />;
      case 'traceres':    return <TraceResistanceCalc />;
      case 'vdivider':    return <VoltageDividerCalc />;
      case 'i2c':         return <I2CPullupCalc />;
      case 'gpio':        return <GPIOResistorCalc />;
      case 'pwm':         return <PWMCalc />;
      case 'ntc':         return <NTCThermistorCalc />;
      case 'opamp':       return <OpAmpCalc />;
      case 'timer555':    return <Timer555Calc />;
      case 'rcfilter':    return <RCFilterCalc />;
      case 'serpar':      return <SeriesParallelCalc />;
      case 'zener':       return <ZenerCalc />;
      case 'bjt':         return <BJTBiasCalc />;
      case 'reactance':   return <InductorReactanceCalc />;
      case 'resistorcode':return <ResistorColorCalc />;
      case 'units':       return <UnitConverterCalc />;
      case 'dbm':         return <DBmCalc />;
      case 'pwrrating':   return <PowerRatingCalc />;
      default:            return null;
    }
  };

  return (
    <ShopContext.Provider value={shop}>
      <TopNav page="tools-link" cart={cart} onSearchOpen={() => setSearchOpen(true)} accountOpen={accountOpen} setAccountOpen={setAccountOpen} portalUser={portalUser} />

      <div className="page-head">
        <div className="container">
          <div className="crumbs eyebrow">
            <span>Outback</span>
            <span style={{ color: 'var(--ink-3)' }}>/</span>
            <span>Tools &amp; Calculators</span>
          </div>
          <h1>Tools &amp; Calculators</h1>
          <p className="lead">Free electronics calculators covering automotive 12V builds, PCB design, Arduino/embedded systems, discrete circuits, and general electronics. Estimates for guidance — always verify critical work with a qualified engineer.</p>
        </div>
      </div>

      {/* Section tabs */}
      <div style={{ background: 'var(--bg-elev)', borderBottom: '2px solid var(--line)' }}>
        <div className="container hscroll">
          <nav className="tabs" style={{ border: 'none', minWidth: 'max-content' }}>
            {SECTIONS.map(s => (
              <button key={s.id} className={activeSection === s.id ? 'tab active' : 'tab'}
                onClick={() => selectSection(s.id)} style={{ fontWeight: 600 }}>
                {s.label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Tool tabs for active section */}
      <div style={{ background: 'var(--bg-deep)', borderBottom: '1px solid var(--line)' }}>
        <div className="container hscroll">
          <nav className="tabs" style={{ border: 'none', minWidth: 'max-content' }}>
            {section && section.tools.map(t => (
              <button key={t.id} className={activeTool === t.id ? 'tab active' : 'tab'}
                onClick={() => setActiveTool(t.id)} style={{ fontSize: 13 }}>
                <span>{t.icon}</span>
                <span>{t.label}</span>
              </button>
            ))}
          </nav>
        </div>
      </div>

      <main className="container" style={{ flex: 1, paddingTop: 36, paddingBottom: 60, maxWidth: 720 }}>
        {renderTool()}
      </main>

      <Footer />
      {searchOpen && <SearchOverlay onClose={() => setSearchOpen(false)} />}
    </ShopContext.Provider>
  );
}
