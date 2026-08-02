// Beacon, a simple "I'm OK" safety check-in. Set a schedule + a contact; one
// tap marks you safe. Miss a window and the server emails your contact. Per-user
// config in beacon.db; no data shown until you sign in.
import { useState, useEffect } from 'react';
import { TopNav, Footer, useAuth, useShopInfo, apiPost } from './app-shell.jsx';

const fmt = (t) => t ? new Date(t).toLocaleString('en-AU', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : '-';

export default function BeaconApp() {
  const { user } = useAuth();
  const info = useShopInfo();
  const [st, setSt] = useState(null);
  const [form, setForm] = useState({ intervalHours: 24, contactName: '', contactEmail: '', message: '' });
  const [editing, setEditing] = useState(false);
  const [msg, setMsg] = useState('');

  const load = () => fetch('/api/beacon/status', { credentials: 'include' }).then(r => r.ok ? r.json() : { active: false }).then(setSt).catch(() => setSt({ active: false }));
  useEffect(() => { if (user) load(); }, [user]);

  async function setup(e) {
    e.preventDefault();
    setMsg('Saving…');
    const r = await apiPost('/api/beacon/setup', form);
    if (r.ok) { setEditing(false); setMsg(''); load(); }
    else { const d = await r.json().catch(() => ({})); setMsg(d.message || 'Could not save.'); }
  }
  async function checkin() { setMsg('…'); const r = await apiPost('/api/beacon/checkin', {}); if (r.ok) { setMsg("Checked in - you're marked safe."); load(); setTimeout(() => setMsg(''), 2500); } }
  async function stop() { if (!window.confirm('Turn off your beacon?')) return; await apiPost('/api/beacon/stop', {}); load(); }

  if (user === undefined) return (<><TopNav current="beacon" /><main className="container svc-main"><p>Loading…</p></main><Footer /></>);

  if (!user) return (
    <><TopNav current="beacon" />
      <main className="container svc-main">
        <header className="svc-head">
          <p className="eyebrow">Safety · Beacon</p>
          <h1 className="serif svc-title">Check-in beacon</h1>
          <p className="svc-sub">Heading somewhere remote? Set a check-in schedule, if you miss it, we email your contact automatically. Sign in to set one up.</p>
        </header>
        {info && info.portalUrl ? <a className="btn btn-rust" href={info.portalUrl}>Sign in / Register</a> : null}
      </main><Footer /></>
  );

  const active = st && st.active;
  return (
    <><TopNav current="beacon" />
      <main className="container svc-main">
        <header className="svc-head">
          <p className="eyebrow">Safety · Beacon</p>
          <h1 className="serif svc-title">Check-in beacon</h1>
          <p className="svc-sub">Set a schedule and check in with one tap. Miss the window and your contact gets an automatic alert email.</p>
        </header>

        {(!active || editing) ? (
          <form className="beacon-card" onSubmit={setup}>
            <h2 className="svc-h2">{active ? 'Edit beacon' : 'Set up your beacon'}</h2>
            <label className="fld"><span>Check in every</span>
              <select className="input" value={form.intervalHours} onChange={e => setForm(f => ({ ...f, intervalHours: +e.target.value }))}>
                <option value={6}>6 hours</option><option value={12}>12 hours</option><option value={24}>24 hours</option><option value={48}>48 hours</option><option value={72}>3 days</option>
              </select></label>
            <div className="fld-row">
              <label className="fld"><span>Contact name</span><input className="input" value={form.contactName} onChange={e => setForm(f => ({ ...f, contactName: e.target.value }))} /></label>
              <label className="fld"><span>Contact email</span><input className="input" type="email" value={form.contactEmail} onChange={e => setForm(f => ({ ...f, contactEmail: e.target.value }))} /></label>
            </div>
            <label className="fld"><span>Message for your contact (optional)</span><textarea className="textarea" value={form.message} placeholder="Where you're headed, vehicle, plans…" onChange={e => setForm(f => ({ ...f, message: e.target.value }))} /></label>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-rust" type="submit">{active ? 'Save' : 'Start beacon'}</button>
              {active ? <button type="button" className="btn btn-ghost" onClick={() => setEditing(false)}>Cancel</button> : null}
            </div>
            <p className="beacon-msg">{msg}</p>
          </form>
        ) : (
          <div className={'beacon-card' + (st.overdue ? ' overdue' : '')}>
            <div className="beacon-status">{st.overdue ? '⚠ Overdue, your contact has been alerted' : "✓ Active, you're marked safe"}</div>
            <button className="beacon-ok" onClick={checkin}>I'm OK</button>
            <p className="beacon-msg">{msg}</p>
            <ul className="beacon-info">
              <li><span>Last check-in</span><b>{fmt(st.lastCheckIn)}</b></li>
              <li><span>Next due</span><b>{fmt(st.dueAt)}</b></li>
              <li><span>Alerts go to</span><b>{(st.contactName ? st.contactName + ' · ' : '') + st.contactEmail}</b></li>
            </ul>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-ghost btn-sm" onClick={() => { setForm({ intervalHours: st.intervalHours, contactName: st.contactName || '', contactEmail: st.contactEmail || '', message: st.message || '' }); setEditing(true); }}>Edit</button>
              <button className="btn btn-ghost btn-sm" onClick={stop}>Turn off</button>
            </div>
          </div>
        )}
        <p className="beacon-note">Not a substitute for a registered PLB/EPIRB. Alerts depend on the shop's email being configured and the server being online, for life-threatening emergencies, call 000.</p>
      </main><Footer /></>
  );
}
