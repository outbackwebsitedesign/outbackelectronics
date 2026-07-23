import React, { useState, useEffect, useContext } from 'react';
import { getCsrf } from './src/lib/api.js';
import { renderMarkdown } from './markdown.jsx';
const _fallbackShopCtx = React.createContext({});
const useShop = () => useContext(window.__ShopContext__ || _fallbackShopCtx);
const ErrorText = window.ErrorText;

// ============================================================
// REQUEST A QUOTE
// ============================================================

function QuotePage({ go, pageParams }) {
  const shop = useShop();
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [ticketId, setTicketId] = useState(null);
  const [calloutInfo, setCalloutInfo] = useState(null);
  const [locGeocoding, setLocGeocoding] = useState(false);

  const initForm = () => {
    const svc = pageParams;
    return {
      kind: 'Repair',
      budget: '$1k–$5k',
      urgency: 'Standard',
      name: '',
      email: '',
      loc: '',
      desc: svc?.name ? `Service: ${svc.name}` : '',
      _service: svc?.name || '',
      _serviceSku: svc?.sku || '',
    };
  };

  const [form, setForm] = useState(initForm);

  useEffect(() => {
    if (pageParams) { setForm(initForm()); setCalloutInfo(null); }
  }, [pageParams]);

  const update = (k, v) => setForm(f => ({ ...f, [k]: v }));

  useEffect(() => {
    if (!form.loc || form.loc.trim().length < 3) { setCalloutInfo(null); return; }
    const t = setTimeout(async () => {
      setLocGeocoding(true);
      try {
        const geoRes = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(form.loc + ', Australia')}&limit=1`,
          { headers: { 'Accept-Language': 'en' } }
        );
        const geoData = await geoRes.json();
        if (geoData[0]) {
          const feeRes = await fetch(`/api/callout-fee?lat=${encodeURIComponent(geoData[0].lat)}&lng=${encodeURIComponent(geoData[0].lon)}`);
          const info = await feeRes.json();
          setCalloutInfo(info);
        } else {
          setCalloutInfo(null);
        }
      } catch { setCalloutInfo(null); }
      finally { setLocGeocoding(false); }
    }, 700);
    return () => clearTimeout(t);
  }, [form.loc]);

  if (submitted) {
    return (
      <>
        <PageHead crumbs={['Outback','Request a Quote']} title="Quote received." lead="A real human will get back to you within 24 hours — usually sooner for urgent jobs." />
        <section className="container" style={{paddingTop: 32, paddingBottom: 60}}>
          <div className="card-paper" style={{padding: 40, maxWidth: 640}}>
            <div className="row-flex"><span className="tag tag-euc">TICKET · {ticketId ? `#${ticketId}` : 'SUBMITTED'}</span></div>
            <h3 className="serif" style={{fontSize: 36, marginTop: 14}}>Thanks{form.name && `, ${form.name.split(' ')[0]}`}.</h3>
            <p style={{marginTop: 12, color:'var(--ink-2)'}}>We've logged your request. If we need more info we'll email; if it's urgent and you left a phone number, we'll call.</p>
            <div className="term" style={{marginTop:24}}>
              <div className="mono" style={{fontSize:10, color:'var(--ink-3)', marginBottom: 6}}>// YOUR REQUEST</div>
              <div>kind     : {form.kind}</div>
              <div>budget   : {form.budget}</div>
              <div>urgency  : {form.urgency}</div>
              <div>location : {form.loc || '—'}</div>
              <div>summary  : {form.desc.slice(0,120) || '—'}{form.desc.length > 120 ? '…' : ''}</div>
            </div>
            <div className="row-flex" style={{marginTop:24}}>
              <button className="btn" onClick={() => setSubmitted(false)}>Submit another</button>
              <button className="btn btn-ghost" onClick={() => go('home')}>Back to home</button>
            </div>
          </div>
        </section>
      </>
    );
  }

  return (
    <>
      <PageHead crumbs={['Outback','Request a Quote']} title="Request a Quote"
        lead="Tell us what you're trying to do, in plain English. We'll scope it, price it, and either say yes, no, or 'here's who can.'" />
      <section className="container quote-layout" style={{paddingTop: 32, paddingBottom: 60, display:'grid', gridTemplateColumns:'1fr 320px', gap: 48}}>
        <form onSubmit={async (e) => {
          e.preventDefault();
          setSubmitError(null);
          setSubmitting(true);
          try {
            const res = await fetch('/api/quote/request', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': getCsrf() },
              body: JSON.stringify(form),
            });
            if (!res.ok) throw new Error('server_error');
            const data = await res.json().catch(() => ({}));
            setTicketId(data.id || null);
            setSubmitted(true);
          } catch {
            setSubmitError('Something went wrong — please try again or call us directly.');
          } finally {
            setSubmitting(false);
          }
        }}>
          <div className="card-paper" style={{padding: 32}}>
            {form._service && (
              <div style={{marginBottom:20, padding:'12px 16px', background:'var(--bg-elev)', border:'1px solid var(--rust)', borderRadius:4, display:'flex', alignItems:'center', gap:10}}>
                <span className="mono" style={{fontSize:11, color:'var(--rust)'}}>SERVICE</span>
                <span style={{fontWeight:600, fontSize:14}}>{form._service}</span>
                {pageParams?.priceLine && <span className="mono" style={{fontSize:12, color:'var(--ink-2)', marginLeft:'auto'}}>{pageParams.priceLine}</span>}
              </div>
            )}
            <span className="eyebrow">01 · WHAT KIND OF JOB?</span>
            <div className="row-flex" style={{marginTop: 12, gap:8}}>
              {['Repair','Custom Build','Off-grid System','AI Pilot','Bulk eWaste','Other'].map(k => (
                <button type="button" key={k} className={`btn btn-sm ${form.kind===k?'btn-rust':'btn-ghost'}`} onClick={() => update('kind', k)}>{k}</button>
              ))}
            </div>

            <hr className="thin" />
            <div className="grid-2" style={{gap: 16}}>
              <div>
                <span className="eyebrow">02 · BUDGET BAND</span>
                <div className="stack" style={{marginTop: 10, gap:6}}>
                  {['Under $500','$500–$1k','$1k–$5k','$5k–$25k','$25k+','Tell us'].map(b => {
                    const bid = `budget-${b.replace(/[^a-z0-9]/gi, '-')}`;
                    return (
                      <label key={b} htmlFor={bid} style={{display:'flex', alignItems:'center', gap:8, fontSize:14, padding:'4px 0', cursor:'pointer'}}>
                        <input id={bid} type="radio" name="budget" checked={form.budget===b} onChange={() => update('budget',b)} />{b}
                      </label>
                    );
                  })}
                </div>
              </div>
              <div>
                <span className="eyebrow">03 · URGENCY</span>
                <div className="stack" style={{marginTop: 10, gap:6}}>
                  {[
                    {v:'Whenever',l:'Whenever (≤3 months)'},
                    {v:'Standard',l:'Standard (2–4 weeks)'},
                    {v:'Soon',l:'Soon (≤7 days)'},
                    {v:'Yesterday',l:"Yesterday (call us)"},
                  ].map(b => {
                    const uid = `urgency-${b.v.toLowerCase()}`;
                    return (
                      <label key={b.v} htmlFor={uid} style={{display:'flex', alignItems:'center', gap:8, fontSize:14, padding:'4px 0', cursor:'pointer'}}>
                        <input id={uid} type="radio" name="urgency" checked={form.urgency===b.v} onChange={() => update('urgency',b.v)} />{b.l}
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>

            <hr className="thin" />
            <span className="eyebrow">04 · YOUR DETAILS</span>
            <div className="grid-2" style={{gap:16, marginTop: 12}}>
              <label className="field"><span className="label">Name</span><input required className="input" value={form.name} onChange={e => update('name', e.target.value)} placeholder="Your name" /></label>
              <label className="field"><span className="label">Email</span><input required className="input" value={form.email} onChange={e => update('email', e.target.value)} placeholder="your@email.com" /></label>
            </div>
            <label className="field"><span className="label">Location / nearest town</span><input className="input" value={form.loc} onChange={e => update('loc', e.target.value)} placeholder="Newman, WA" /></label>
            {locGeocoding && <div className="mono" style={{fontSize:11, color:'var(--ink-2)', marginTop:4, marginBottom:4}}>Checking distance…</div>}
            {!locGeocoding && calloutInfo !== null && (() => {
              const { distKm, fee, days, localCapKm, hiValThreshold, dailyRate } = calloutInfo;
              const isHiVal = pageParams && Number(pageParams.priceAud) >= hiValThreshold;
              const capExceeded = distKm > localCapKm && !isHiVal;
              return (
                <div style={{marginTop:4, marginBottom:4, padding:'8px 12px', fontSize:13, border:'1px solid var(--line)', background:'var(--bg-elev)', borderColor: capExceeded ? 'var(--rust)' : 'var(--line)'}}>
                  {capExceeded
                    ? <span style={{color:'var(--rust)'}}>That's {distKm}km — on-site visits for most services are capped at {localCapKm}km. We can still quote; or post the device to us.</span>
                    : fee === 0
                      ? <span><span style={{color:'var(--rust)', fontWeight:600}}>Free callout</span> — you're {distKm}km away.</span>
                      : days > 0
                        ? <span><span style={{fontWeight:600}}>~${fee} travel fee</span> — {distKm}km: fuel + {days * 2} travel days @ ${dailyRate}/day. We'll confirm in the quote.</span>
                        : <span><span style={{fontWeight:600}}>~${fee} travel fee</span> — {distKm}km at $0.60/km (round trip fuel). We'll confirm in the quote.</span>
                  }
                </div>
              );
            })()}

            <hr className="thin" />
            <span className="eyebrow">05 · DESCRIBE THE JOB</span>
            <p style={{fontSize:13, color:'var(--ink-2)', marginTop:6, marginBottom: 10}}>Plain English is great. Photos can come later — we'll reply with an upload link.</p>
            <label className="field">
              <textarea className="textarea" value={form.desc} onChange={e => update('desc', e.target.value)} placeholder="My 6kW Fronius inverter is throwing 'AC Voltage High' once it gets over 38°C in the shed. Worked fine all winter. House is 80km west of Birdsville." style={{minHeight: 160}} />
              <div style={{display:'flex', justifyContent:'flex-end', marginTop:4}}>
                <span className="mono" style={{fontSize:10, color: form.desc.length > 1800 ? 'var(--rust)' : 'var(--ink-3)'}}>{form.desc.length} / 2000</span>
              </div>
            </label>

            <hr className="thin" />
            <ErrorText style={{marginBottom: 12}}>{submitError}</ErrorText>
            <div className="row-flex" style={{justifyContent:'space-between'}}>
              <span className="mono" style={{fontSize:11, color:'var(--ink-2)'}}>WE REPLY IN ≤24H · NO BOTS · NO UPSELL</span>
              <button className="btn btn-rust" type="submit" disabled={submitting}>{submitting ? 'Sending…' : 'Send to the bench →'}</button>
            </div>
          </div>
        </form>

        <aside>
          <div className="card" style={{padding: 22}}>
            <span className="tag tag-rust">PHONE FIRST</span>
            <h3 className="serif" style={{fontSize:28, marginTop:12, lineHeight:1.05}}>Or just call.</h3>
            <p style={{marginTop:8, fontSize:13, color:'var(--ink-2)'}}>If it's actively smoking, on fire, or sinking, save the form.</p>
            <a href={`tel:${(shop.phone||'').replace(/\s/g,'')}`} className="serif" style={{fontSize:32, marginTop:14, color:'var(--rust)', textDecoration:'none', display:'block'}}>{shop.phone}</a>
            <div className="mono" style={{fontSize:11, color:'var(--ink-2)', marginTop:6}}>BY APPOINTMENT ONLY</div>
          </div>
          <div className="card" style={{padding: 22, marginTop: 16, background:'var(--dark)', color:'var(--paper)', borderColor:'var(--dark)'}}>
            <span className="eyebrow" style={{color:'var(--ochre)'}}>WHAT TO INCLUDE</span>
            <ul className="checks" style={{marginTop:12, fontSize:13}}>
              <li>Model numbers + serials</li>
              <li>Photos of nameplates &amp; faults</li>
              <li>What you've already tried</li>
              <li>How far from a tarmac road</li>
            </ul>
          </div>
        </aside>
      </section>
    </>
  );
}

// ============================================================
// BOOK A REPAIR / APPOINTMENT
// ============================================================
const BOOKING_TYPES = [
  { v: 'dropoff',     l: 'Repair drop-off',  d: 'Bring your device to the bench.' },
  { v: 'appointment', l: 'In-store appointment', d: 'A general consultation or service slot.' },
  { v: 'callout',     l: 'On-site callout',  d: 'We come to you — travel fees may apply.' },
];

function BookingPage({ go, pageParams }) {
  const shop = useShop();
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [bookingId, setBookingId] = useState(null);

  const [slotInfo, setSlotInfo] = useState(null);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [calloutInfo, setCalloutInfo] = useState(null);
  const [addrGeocoding, setAddrGeocoding] = useState(false);

  const [form, setForm] = useState({
    type: pageParams?.type || 'dropoff',
    name: '',
    email: '',
    phone: '',
    preferredDate: '',
    preferredTime: '',
    device: '',
    address: '',
    notes: '',
    durationMinutes: 60,
    lat: null,
    lng: null,
  });

  const update = (k, v) => setForm(f => ({ ...f, [k]: v }));

  useEffect(() => {
    if (pageParams?.type) update('type', pageParams.type);
  }, [pageParams?.type]);

  useEffect(() => {
    if (!form.preferredDate) { setSlotInfo(null); return; }
    if (form.type === 'callout' && form.address && (form.lat == null || form.lng == null)) return;
    setSlotsLoading(true);
    const params = new URLSearchParams({ date: form.preferredDate, durationMinutes: String(form.durationMinutes) });
    if (form.type === 'callout' && form.lat != null && form.lng != null) {
      params.set('lat', String(form.lat));
      params.set('lng', String(form.lng));
    }
    fetch(`/api/availability/slots?${params.toString()}`)
      .then(r => r.json())
      .then(d => {
        setSlotInfo(d);
        if (d.closed || !d.slots.includes(form.preferredTime)) update('preferredTime', '');
      })
      .catch(() => setSlotInfo({ closed: true, slots: [] }))
      .finally(() => setSlotsLoading(false));
  }, [form.preferredDate, form.durationMinutes, form.lat, form.lng, form.type]);

  useEffect(() => {
    if (form.type !== 'callout' || !form.address || form.address.trim().length < 3) { setCalloutInfo(null); update('lat', null); update('lng', null); return; }
    const t = setTimeout(async () => {
      setAddrGeocoding(true);
      try {
        const geoRes = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(form.address + ', Australia')}&limit=1`,
          { headers: { 'Accept-Language': 'en' } }
        );
        const geoData = await geoRes.json();
        if (geoData[0]) {
          update('lat', parseFloat(geoData[0].lat));
          update('lng', parseFloat(geoData[0].lon));
          const feeRes = await fetch(`/api/callout-fee?lat=${encodeURIComponent(geoData[0].lat)}&lng=${encodeURIComponent(geoData[0].lon)}`);
          const info = await feeRes.json();
          setCalloutInfo(info);
        } else {
          setCalloutInfo(null);
          update('lat', null);
          update('lng', null);
        }
      } catch { setCalloutInfo(null); }
      finally { setAddrGeocoding(false); }
    }, 700);
    return () => clearTimeout(t);
  }, [form.address, form.type]);

  const pageCopy = {
    dropoff:     { title: 'Book a Repair Drop-off',  lead: "Bring your device to the bench. Pick a date and we'll have a slot ready." },
    appointment: { title: 'Book an In-Store Appointment', lead: 'A general consultation or service slot — pick what fits.' },
    callout:     { title: 'Book an On-Site Callout',  lead: 'We come to you. Travel fees may apply depending on distance.' },
  }[form.type] || { title: 'Book a Repair or Appointment', lead: 'Drop your device at the bench, book an in-store slot, or get a callout — pick what fits.' };

  if (submitted) {
    return (
      <>
        <PageHead crumbs={['Outback','Book']} title="Booking received." lead="We'll confirm the date and time by email — usually within a business day." />
        <section className="container" style={{paddingTop: 32, paddingBottom: 60}}>
          <div className="card-paper" style={{padding: 40, maxWidth: 640}}>
            <div className="row-flex"><span className="tag tag-euc">BOOKING · {bookingId ? `#${bookingId}` : 'SUBMITTED'}</span></div>
            <h3 className="serif" style={{fontSize: 36, marginTop: 14}}>Thanks{form.name && `, ${form.name.split(' ')[0]}`}.</h3>
            <p style={{marginTop: 12, color:'var(--ink-2)'}}>We've logged your request. If we need more info we'll email; if it's urgent and you left a phone number, we'll call.</p>
            <div className="term" style={{marginTop:24}}>
              <div className="mono" style={{fontSize:10, color:'var(--ink-3)', marginBottom: 6}}>// YOUR BOOKING</div>
              <div>type     : {BOOKING_TYPES.find(t => t.v === form.type)?.l || form.type}</div>
              <div>date     : {form.preferredDate}{form.preferredTime ? ` · ${form.preferredTime}` : ''}</div>
              <div>device   : {form.device || '—'}</div>
            </div>
            <div className="row-flex" style={{marginTop:24}}>
              <button className="btn" onClick={() => setSubmitted(false)}>Book another</button>
              <button className="btn btn-ghost" onClick={() => go('home')}>Back to home</button>
            </div>
          </div>
        </section>
      </>
    );
  }

  return (
    <>
      <PageHead crumbs={['Outback','Book']} title={pageCopy.title} lead={pageCopy.lead} />
      <section className="container" style={{paddingTop: 32, paddingBottom: 60, display:'grid', gridTemplateColumns:'1fr 320px', gap: 48}}>
        <form onSubmit={async (e) => {
          e.preventDefault();
          setSubmitError(null);
          setSubmitting(true);
          try {
            const res = await fetch('/api/bookings/request', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': getCsrf() },
              body: JSON.stringify(form),
            });
            if (!res.ok) throw new Error('server_error');
            const data = await res.json().catch(() => ({}));
            setBookingId(data.id || null);
            setSubmitted(true);
          } catch {
            setSubmitError('Something went wrong — please try again or call us directly.');
          } finally {
            setSubmitting(false);
          }
        }}>
          <div className="card-paper" style={{padding: 32}}>
            <span className="eyebrow">01 · WHAT KIND OF BOOKING?</span>
            <div className="row-flex" style={{marginTop: 12, gap:8, flexWrap:'wrap'}}>
              {BOOKING_TYPES.map(t => (
                <button type="button" key={t.v} className={`btn btn-sm ${form.type===t.v?'btn-rust':'btn-ghost'}`} onClick={() => go('book', { type: t.v })}>{t.l}</button>
              ))}
            </div>
            <p style={{fontSize:13, color:'var(--ink-2)', marginTop:10}}>{BOOKING_TYPES.find(t => t.v === form.type)?.d}</p>

            <hr className="thin" />
            <span className="eyebrow">02 · YOUR DETAILS</span>
            <div className="grid-2" style={{gap:16, marginTop: 12}}>
              <label className="field"><span className="label">Name</span><input required className="input" value={form.name} onChange={e => update('name', e.target.value)} placeholder="Your name" /></label>
              <label className="field"><span className="label">Email</span><input required type="email" className="input" value={form.email} onChange={e => update('email', e.target.value)} placeholder="your@email.com" /></label>
            </div>
            <label className="field"><span className="label">Phone (optional)</span><input className="input" value={form.phone} onChange={e => update('phone', e.target.value)} placeholder="04xx xxx xxx" /></label>

            <hr className="thin" />
            <span className="eyebrow">03 · WHEN</span>
            <div className="grid-2" style={{gap:16, marginTop: 12}}>
              <label className="field"><span className="label">Preferred date</span><input required type="date" min={new Date().toISOString().slice(0,10)} className="input" value={form.preferredDate} onChange={e => update('preferredDate', e.target.value)} /></label>
              <label className="field">
                <span className="label">Preferred time</span>
                <select required className="select" value={form.preferredTime} disabled={!form.preferredDate || slotsLoading || (slotInfo && slotInfo.closed)}
                  onChange={e => update('preferredTime', e.target.value)}>
                  <option value="">{slotsLoading ? 'Loading…' : 'Select a time'}</option>
                  {slotInfo && !slotInfo.closed && slotInfo.slots.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </label>
            </div>
            <label className="field" style={{marginTop:12}}>
              <span className="label">How long will this take?</span>
              <select className="select" value={form.durationMinutes} onChange={e => update('durationMinutes', parseInt(e.target.value, 10))}>
                <option value={30}>30 minutes</option>
                <option value={60}>1 hour</option>
                <option value={90}>1.5 hours</option>
                <option value={120}>2 hours</option>
                <option value={180}>3 hours</option>
                <option value={240}>4 hours</option>
                <option value={360}>6 hours</option>
                <option value={480}>8 hours</option>
                <option value={600}>10 hours</option>
              </select>
            </label>
            {form.preferredDate && !slotsLoading && slotInfo && slotInfo.closed && (
              <div style={{marginTop:4, marginBottom:4, padding:'8px 12px', fontSize:13, border:'1px solid var(--rust)', background:'var(--bg-elev)', color:'var(--rust)'}}>
                We're not taking online bookings on that date. Please call us to arrange a time.
              </div>
            )}

            {form.type === 'callout' && (
              <>
                <label className="field"><span className="label">Address</span><input required className="input" value={form.address} onChange={e => update('address', e.target.value)} placeholder="Street, town" /></label>
                {addrGeocoding && <div className="mono" style={{fontSize:11, color:'var(--ink-2)', marginTop:4, marginBottom:4}}>Checking distance…</div>}
                {!addrGeocoding && calloutInfo !== null && (() => {
                  const { distKm, fee, days, localCapKm, dailyRate } = calloutInfo;
                  const capExceeded = distKm > localCapKm;
                  return (
                    <div style={{marginTop:4, marginBottom:4, padding:'8px 12px', fontSize:13, border:'1px solid var(--line)', background:'var(--bg-elev)', borderColor: capExceeded ? 'var(--rust)' : 'var(--line)'}}>
                      {capExceeded
                        ? <span style={{color:'var(--rust)'}}>That's {distKm}km — on-site callouts are capped at {localCapKm}km. Please call us to discuss options.</span>
                        : fee === 0
                          ? <span><span style={{color:'var(--rust)', fontWeight:600}}>Free callout</span> — you're {distKm}km away.</span>
                          : days > 0
                            ? <span><span style={{fontWeight:600}}>~${fee} travel fee</span> — {distKm}km: fuel + {days * 2} travel days @ ${dailyRate}/day. We'll confirm when we book you in.</span>
                            : <span><span style={{fontWeight:600}}>~${fee} travel fee</span> — {distKm}km at $0.60/km (round trip fuel). We'll confirm when we book you in.</span>
                      }
                    </div>
                  );
                })()}
              </>
            )}

            <hr className="thin" />
            <span className="eyebrow">04 · DEVICE &amp; NOTES</span>
            <label className="field"><span className="label">Device (optional)</span><input className="input" value={form.device} onChange={e => update('device', e.target.value)} placeholder="e.g. Dell XPS 15, won't boot" /></label>
            <label className="field">
              <span className="label">Notes (optional)</span>
              <textarea className="textarea" value={form.notes} onChange={e => update('notes', e.target.value)} placeholder="Anything else we should know." style={{minHeight: 100}} />
              <div style={{display:'flex', justifyContent:'flex-end', marginTop:4}}>
                <span className="mono" style={{fontSize:10, color: form.notes.length > 1800 ? 'var(--rust)' : 'var(--ink-3)'}}>{form.notes.length} / 2000</span>
              </div>
            </label>

            <hr className="thin" />
            <ErrorText style={{marginBottom: 12}}>{submitError}</ErrorText>
            <div className="row-flex" style={{justifyContent:'space-between'}}>
              <span className="mono" style={{fontSize:11, color:'var(--ink-2)'}}>WE CONFIRM BY EMAIL · BY APPOINTMENT ONLY</span>
              <button className="btn btn-rust" type="submit" disabled={submitting}>{submitting ? 'Booking…' : 'Book now →'}</button>
            </div>
          </div>
        </form>

        <aside>
          <div className="card" style={{padding: 22}}>
            <span className="tag tag-rust">PHONE FIRST</span>
            <h3 className="serif" style={{fontSize:28, marginTop:12, lineHeight:1.05}}>Or just call.</h3>
            <p style={{marginTop:8, fontSize:13, color:'var(--ink-2)'}}>Need it sooner than the next available slot? Call us directly.</p>
            <a href={`tel:${(shop.phone||'').replace(/\s/g,'')}`} className="serif" style={{fontSize:32, marginTop:14, color:'var(--rust)', textDecoration:'none', display:'block'}}>{shop.phone}</a>
            <div className="mono" style={{fontSize:11, color:'var(--ink-2)', marginTop:6}}>BY APPOINTMENT ONLY</div>
          </div>
        </aside>
      </section>
    </>
  );
}

// ============================================================
// CONTACT
// ============================================================
function ContactPage({ go }) {
  const shop = useShop();
  const [qm, setQm] = useState({ name: '', email: '', msg: '' });
  const [qmSent, setQmSent] = useState(false);
  const [qmSending, setQmSending] = useState(false);
  const [qmError, setQmError] = useState(null);

  const sendQuickMsg = async (e) => {
    e.preventDefault();
    if (!qm.name.trim() || !qm.email.trim() || !qm.msg.trim()) return;
    setQmSending(true);
    setQmError(null);
    try {
      const res = await fetch('/api/contact/quick-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': getCsrf() },
        body: JSON.stringify(qm),
      });
      if (!res.ok) throw new Error('server error');
      setQmSent(true);
    } catch {
      setQmError(`Message could not be sent. Please email us directly at ${shop.email || 'our support address'}.`);
    } finally {
      setQmSending(false);
    }
  };

  return (
    <>
      <PageHead crumbs={['Outback','Contact']} title="Contact"
        lead="Outback Electronics is appointment-only. Call or email to arrange a visit." />
      <section className="container" style={{paddingTop: 32, paddingBottom: 40}}>
        <div className="grid-2" style={{gap: 36}}>
          <div className="stack" style={{gap:18}}>
            <div className="card-paper" style={{padding: 28}}>
              <span className="eyebrow">THE SHOP</span>
              <h3 className="serif" style={{fontSize: 36, marginTop: 8}}>{[shop.suburb, shop.state, shop.postcode].filter(Boolean).join(' ')}</h3>
              <p style={{marginTop: 12, color:'var(--ink-2)', fontSize:14}}>No public access, arrive by appointment only.</p>
              <table style={{width:'100%', marginTop: 18, borderCollapse:'collapse', fontSize:14}}>
                <tbody>
                  {[
                    ['Monday – Sunday','By appointment only'],
                    ['Public holidays','By appointment only'],
                  ].map((r,i) => (
                    <tr key={i} style={{borderTop:'1px solid var(--line)'}}>
                      <td style={{padding:'10px 0', color:'var(--ink-2)'}}>{r[0]}</td>
                      <td style={{padding:'10px 0', textAlign:'right', fontFamily:'JetBrains Mono, monospace', fontSize:12}}>{r[1]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="grid-2" style={{gap: 16}}>
              <div className="card-paper" style={{padding: 22}}>
                <span className="eyebrow">PHONE</span>
                <a href={`tel:${(shop.phone||'').replace(/\s/g,'')}`} className="serif" style={{fontSize:28, marginTop:8, color:'var(--rust)', textDecoration:'none', display:'block'}}>{shop.phone}</a>
                <div className="mono" style={{fontSize:11, color:'var(--ink-2)', marginTop:4}}>CALL OR SMS TO BOOK AN APPOINTMENT</div>
              </div>
              {shop.email && (
              <div className="card-paper" style={{padding: 22}}>
                <span className="eyebrow">EMAIL</span>
                <a href={`mailto:${shop.email}`} style={{fontSize:18, marginTop:8, fontWeight:600, color:'inherit', display:'block'}}>{shop.email}</a>
                <div className="mono" style={{fontSize:11, color:'var(--ink-2)', marginTop:4}}>APPOINTMENTS ONLY</div>
              </div>
              )}
              <div className="card-paper" style={{padding: 22}}>
                <span className="eyebrow">UHF</span>
                <div style={{fontSize: 18, marginTop:8, fontWeight:600}}>Channel 40</div>
                <div className="mono" style={{fontSize:12, marginTop:2}}>OUTBACK-1</div>
                <div className="mono" style={{fontSize:11, color:'var(--ink-2)', marginTop:4}}>ONLY IF VEHICLE SPOTTED</div>
              </div>
              <div className="card-paper" style={{padding: 22}}>
                <span className="eyebrow">SAT MSG</span>
                <div style={{fontSize: 18, marginTop:8, fontWeight:600}}>Iridium SBD</div>
                <div className="mono" style={{fontSize:11, color:'var(--ink-2)', marginTop:4}}>NOT CURRENTLY AVAILABLE · NO SAT</div>
              </div>
            </div>

            <div className="notice">
              <span className="tag tag-rust">EMERGENCY</span>
              <div style={{fontSize:13, color:'var(--ink-2)'}}>If something is sparking, smoking or sinking, call 000 first, then us.</div>
            </div>
          </div>

          <div>
            <div style={{aspectRatio: '4/5', position:'relative', overflow:'hidden', border:'2px solid var(--rust)'}}>
              <iframe
                title="Shop location"
                width="100%"
                height="100%"
                style={{display:'block', border:0}}
                loading="lazy"
                src={`https://maps.google.com/maps?q=${encodeURIComponent([shop.streetAddress, shop.suburb, shop.state, shop.postcode].filter(Boolean).join(', '))}&output=embed`}
                allowFullScreen
              />
            </div>
            <div className="card" style={{padding:18, marginTop:16}}>
              <span className="eyebrow">QUICK MESSAGE</span>
              {qmSent ? (
                <div style={{marginTop:12}}>
                  <div className="mono" style={{fontSize:12, color:'var(--eucalyptus)', marginBottom:6}}>✓ MESSAGE SENT</div>
                  <p style={{fontSize:13, color:'var(--ink-2)'}}>We'll get back to you within 24 hours.</p>
                  <button className="btn btn-ghost btn-sm" style={{marginTop:10}} onClick={() => { setQmSent(false); setQmError(null); setQm({ name:'', email:'', msg:'' }); }}>Send another</button>
                </div>
              ) : (
                <form onSubmit={sendQuickMsg}>
                  <label className="field" style={{marginTop:10}}><span className="label">Name</span><input className="input" placeholder="Your name" value={qm.name} onChange={e => setQm(q => ({...q, name: e.target.value}))} required /></label>
                  <label className="field"><span className="label">Email</span><input className="input" placeholder="your@email.com" type="email" value={qm.email} onChange={e => setQm(q => ({...q, email: e.target.value}))} required /></label>
                  <label className="field"><span className="label">Message</span><textarea className="textarea" placeholder="How can we help?" value={qm.msg} onChange={e => setQm(q => ({...q, msg: e.target.value}))} required /></label>
                  <ErrorText inline style={{marginTop:0, marginBottom:8}}>{qmError}</ErrorText>
                  <button className="btn btn-rust" style={{width:'100%', justifyContent:'center'}} type="submit" disabled={qmSending}>{qmSending ? 'Sending…' : 'Send →'}</button>
                </form>
              )}
            </div>
          </div>
        </div>
      </section>
    </>
  );
}


// ============================================================
// LEAVE A REVIEW
// ============================================================
function StarPicker({ value, onChange, size = 32 }) {
  return (
    <div className="row-flex" style={{ gap: 4 }} role="radiogroup" aria-label="Rating">
      {[1, 2, 3, 4, 5].map(n => (
        <button key={n} type="button" role="radio" aria-checked={value === n} aria-label={`${n} star${n > 1 ? 's' : ''}`}
          onClick={() => onChange(n)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, fontSize: size, lineHeight: 1, color: n <= value ? 'var(--ochre)' : 'var(--line)' }}>
          ★
        </button>
      ))}
    </div>
  );
}

function ReviewPage({ go }) {
  const shop = useShop();
  const params = new URLSearchParams(window.location.search);
  const orderId = params.get('order') || '';
  const token = params.get('token') || '';

  const [state, setState] = useState('loading'); // loading | invalid | ready
  const [customerName, setCustomerName] = useState('');
  const [mode, setMode] = useState('general'); // general | product
  const [orderItems, setOrderItems] = useState([]); // this order's items, offered in the picker
  const [selectedItem, setSelectedItem] = useState(null); // { productId, name } from orderItems
  const [rating, setRating] = useState(0);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [photos, setPhotos] = useState([]);
  const [uploadingCount, setUploadingCount] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [submitted, setSubmitted] = useState(false);
  const MAX_PHOTOS = 5;

  const readAsDataUri = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  const addPhotos = async (fileList) => {
    const files = Array.from(fileList || []).slice(0, MAX_PHOTOS - photos.length);
    if (!files.length) return;
    setUploadingCount(c => c + files.length);
    for (const file of files) {
      try {
        const data = await readAsDataUri(file);
        const res = await fetch('/api/review/upload-photo', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': getCsrf() },
          body: JSON.stringify({ orderId, token, filename: file.name, data }),
        });
        const d = await res.json().catch(() => ({}));
        if (res.ok && d.url) setPhotos(p => (p.length < MAX_PHOTOS ? [...p, d.url] : p));
      } catch { /* skip failed photo, keep the rest */ }
      finally { setUploadingCount(c => c - 1); }
    }
  };

  const removePhoto = (url) => setPhotos(p => p.filter(u => u !== url));

  useEffect(() => {
    if (!orderId || !token) { setState('invalid'); return; }
    fetch(`/api/review/context?order=${encodeURIComponent(orderId)}&token=${encodeURIComponent(token)}`)
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(d => { setCustomerName(d.customerName || ''); setOrderItems(Array.isArray(d.products) ? d.products : []); setState('ready'); })
      .catch(() => setState('invalid'));
  }, [orderId, token]);

  const resetForm = () => {
    setMode('general'); setSelectedItem(null);
    setRating(0); setTitle(''); setBody(''); setPhotos([]); setSubmitError(null); setSubmitted(false);
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!rating) { setSubmitError('Please choose a star rating.'); return; }
    if (!body.trim()) { setSubmitError('Please write a few words about your experience.'); return; }
    if (mode === 'product' && !selectedItem) { setSubmitError('Please pick which item this review is about.'); return; }
    setSubmitting(true); setSubmitError(null);
    try {
      const res = await fetch('/api/review/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': getCsrf() },
        body: JSON.stringify({
          orderId, token, rating, title: title.trim(), body: body.trim(), photos,
          productId: mode === 'product' && selectedItem ? (selectedItem.productId || '') : '',
          productName: mode === 'product' && selectedItem ? selectedItem.name : '',
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'server_error');
      setSubmitted(true);
    } catch (err) {
      setSubmitError(err.message === 'server_error' || !err.message ? 'Could not submit your review. Please try again.' : err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (state === 'loading') {
    return (
      <>
        <PageHead crumbs={['Outback', 'Review']} title="Leave a Review" />
        <section className="container" style={{ paddingTop: 32, paddingBottom: 60 }}>
          <div className="skeleton" style={{ height: 240, maxWidth: 640 }} />
        </section>
      </>
    );
  }

  if (state === 'invalid') {
    return (
      <>
        <PageHead crumbs={['Outback', 'Review']} title="Link not valid"
          lead="This review link is missing or no longer works. Please use the link exactly as it was sent to you, or get in touch and we'll send a new one." />
        <section className="container" style={{ paddingTop: 8, paddingBottom: 60 }}>
          <a className="btn btn-rust" href="/contact">Contact us →</a>
        </section>
      </>
    );
  }

  return (
    <>
      <PageHead crumbs={['Outback', 'Review']} title="Leave a Review"
        lead={`Hi${customerName ? ` ${customerName.split(' ')[0]}` : ''} — tell us how we did. You can review your whole order, or a specific item you bought.`} />
      <section className="container" style={{ paddingTop: 8, paddingBottom: 60 }}>
        <div className="card-paper" style={{ padding: 32, maxWidth: 640 }}>
          {submitted ? (
            <>
              <span className="tag tag-euc">SUBMITTED</span>
              <h3 className="serif" style={{ fontSize: 30, marginTop: 14 }}>Thanks for the feedback.</h3>
              <p style={{ marginTop: 10, color: 'var(--ink-2)' }}>Your review is in — it'll appear on the site once we've had a look.</p>
              <button className="btn btn-rust" style={{ marginTop: 20 }} onClick={resetForm}>Leave another review →</button>
            </>
          ) : (
            <form onSubmit={submit} noValidate>
              <div className="row-flex" style={{ gap: 8, marginBottom: 20 }}>
                <button type="button" className={`btn btn-sm ${mode === 'general' ? 'btn-rust' : 'btn-ghost'}`} onClick={() => setMode('general')}>The whole order</button>
                {orderItems.length > 0 && (
                  <button type="button" className={`btn btn-sm ${mode === 'product' ? 'btn-rust' : 'btn-ghost'}`} onClick={() => setMode('product')}>A specific item</button>
                )}
              </div>

              {mode === 'product' && orderItems.length > 0 && (
                <label className="field">
                  <span className="label">Which item?</span>
                  {/* Only this order's own items — the dropdown value is the item's index so
                      duplicate names and items without a catalog id still select cleanly. */}
                  <select className="select"
                    value={selectedItem ? String(orderItems.indexOf(selectedItem)) : ''}
                    onChange={e => { const i = Number(e.target.value); setSelectedItem(Number.isInteger(i) && orderItems[i] ? orderItems[i] : null); }}>
                    <option value="">Choose an item from your order…</option>
                    {orderItems.map((it, i) => <option key={i} value={i}>{it.name}</option>)}
                  </select>
                </label>
              )}

              <label className="field">
                <span className="label">Rating</span>
                <StarPicker value={rating} onChange={setRating} />
              </label>

              <label className="field">
                <span className="label">Title (optional)</span>
                <input className="input" value={title} onChange={e => setTitle(e.target.value)} placeholder="Sum it up in a few words" maxLength={120} />
              </label>

              <label className="field">
                <span className="label">Your review</span>
                <textarea className="input textarea" rows={5} value={body} onChange={e => setBody(e.target.value)} placeholder="What was your experience?" maxLength={2000} required />
              </label>

              <label className="field">
                <span className="label">Photos (optional, up to {MAX_PHOTOS})</span>
                {photos.length > 0 && (
                  <div className="row-flex" style={{ gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
                    {photos.map(url => (
                      <div key={url} style={{ position: 'relative' }}>
                        <img src={url} alt="" style={{ width: 72, height: 72, objectFit: 'cover', border: '1px solid var(--line)' }} />
                        <button type="button" onClick={() => removePhoto(url)} aria-label="Remove photo"
                          style={{ position: 'absolute', top: -8, right: -8, width: 22, height: 22, borderRadius: '50%', background: 'var(--ink)', color: '#fff', border: 'none', cursor: 'pointer', lineHeight: 1 }}>×</button>
                      </div>
                    ))}
                  </div>
                )}
                {photos.length < MAX_PHOTOS && (
                  <input type="file" accept="image/*" multiple
                    disabled={uploadingCount > 0}
                    onChange={e => { addPhotos(e.target.files); e.target.value = ''; }} />
                )}
                {uploadingCount > 0 && <span className="mono" style={{ fontSize: 11, color: 'var(--ink-2)' }}>Uploading…</span>}
              </label>

              {submitError && <ErrorText inline>{submitError}</ErrorText>}
              <button className="btn btn-rust" type="submit" disabled={submitting || uploadingCount > 0} style={{ marginTop: 8 }}>{submitting ? 'Submitting…' : 'Submit review →'}</button>
            </form>
          )}
        </div>
      </section>
    </>
  );
}


// ============================================================
// INFO FOR SELLERS — INDEX
// ============================================================
function SellersPage({ go }) {
  useEffect(() => { go('policies', { audience: 'seller', slug: 'terms-and-conditions' }); }, []);
  return null;
}

const POLICY_AUDIENCE_LABELS = { all: 'All Customers', private: 'Private Customer', commercial: 'Commercial Customer', seller: 'Seller' };
const POLICY_AUDIENCE_ORDER = ['all', 'private', 'commercial', 'seller'];
const POLICY_AUDIENCE_DEFAULT_SLUG = { all: 'terms-of-engagement', private: 'terms-and-conditions', commercial: 'terms-and-conditions', seller: 'terms-and-conditions' };

// Back-compat for the old single-segment slugs used before audience-scoped URLs existed.
const LEGACY_POLICY_SLUGS = {
  'commercial-terms': { audience: 'commercial', slug: 'terms-and-conditions' },
  'commercial-returns': { audience: 'commercial', slug: 'return-policy' },
  'seller-terms': { audience: 'seller', slug: 'terms-and-conditions' },
  'seller-quality': { audience: 'seller', slug: 'quality-standards' },
  'seller-fees': { audience: 'seller', slug: 'fees-schedule' },
  'seller-listing': { audience: 'seller', slug: 'listing-requirements' },
};

function findPolicyAudience(slug, items) {
  const match = items.find(d => d.slug === slug);
  return match ? match.audience : null;
}

// Policy bodies are authored with {{email}}/{{phone}}/{{phoneHref}}/{{address}}/{{abn}}
// placeholders (see policy-defaults.js) so the same text works across every shop
// setting change without a redeploy — fill them in with live values just before render.
function interpolatePolicyBody(body, shop) {
  const phone = shop.phone || '';
  const accountUrl = `${shop._portalUrl || 'https://portal.outbackelectronics.com.au'}/account`;
  // Markdown link syntax like [{{email}}](mailto:{{email}}) requires non-empty
  // link text to render at all — an empty substitution leaves the raw [](...)
  // syntax visible to every visitor, so fall back to plain-English text (matching
  // what the pre-CMS hardcoded pages showed) rather than an empty string.
  const values = {
    email: shop.email || 'our support team',
    phone: phone || 'our office',
    phoneHref: phone.replace(/\s/g, ''),
    address: [shop.streetAddress, shop.suburb, shop.state, shop.postcode].filter(Boolean).join(', ') || 'our business address',
    abn: shop.abn || 'not yet provided',
    accountUrl,
    accountUrlDisplay: accountUrl.replace(/^https?:\/\//, ''),
  };
  let text = String(body || '');
  // The email fallback text above is not a valid mailto address, so when
  // shop.email is unset, drop the [{{email}}](mailto:{{email}}) link down to
  // plain text rather than emitting mailto:our support team.
  if (!shop.email) {
    text = text.replace(/\[\{\{email\}\}\]\(mailto:\{\{email\}\}\)/g, values.email);
  }
  return text.replace(/\{\{(\w+)\}\}/g, (full, key) => (Object.prototype.hasOwnProperty.call(values, key) ? values[key] : full));
}

function PoliciesPage({ go, pageParams }) {
  const shop = useShop();
  const [items, setItems] = useState(null);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    fetch('/api/policies').then(r => r.ok ? r.json() : Promise.reject()).then(d => setItems(d.items || [])).catch(() => setLoadError(true));
  }, []);

  // Resolve the incoming params: prefer an explicit two-segment {audience, slug},
  // fall back to legacy single-segment slugs (some of which moved audience+slug on rename).
  let rawSlug = pageParams?.slug || 'terms-and-conditions';
  let urlAudience = pageParams?.audience;
  if (!urlAudience && LEGACY_POLICY_SLUGS[rawSlug]) {
    urlAudience = LEGACY_POLICY_SLUGS[rawSlug].audience;
    rawSlug = LEGACY_POLICY_SLUGS[rawSlug].slug;
  }
  const resolvedAudience = (urlAudience && POLICY_AUDIENCE_LABELS[urlAudience])
    ? urlAudience
    : (items ? (findPolicyAudience(rawSlug, items) || 'private') : (urlAudience || 'private'));
  const [audience, setAudience] = useState(resolvedAudience);

  useEffect(() => {
    if (resolvedAudience !== audience) setAudience(resolvedAudience);
  }, [resolvedAudience]);

  const goDoc = (a, s) => go('policies', { audience: a, slug: s });
  const onAudienceChange = (next) => {
    setAudience(next);
    goDoc(next, POLICY_AUDIENCE_DEFAULT_SLUG[next]);
  };

  if (loadError) {
    return (
      <>
        <PageHead crumbs={['Outback', 'Policies']} title="Policies unavailable"
          lead="We couldn't load our policy documents right now — please try again shortly." />
      </>
    );
  }

  if (!items) {
    return (
      <>
        <PageHead crumbs={['Outback', 'Policies', 'Loading…']} title="Loading…" />
        <section className="container" style={{paddingTop: 32, paddingBottom: 60}}>
          <div style={{maxWidth:760, margin:'0 auto', display:'grid', gap:14}}>
            <div className="skeleton" style={{height:36, width:'70%'}} />
            <div className="skeleton" style={{height:18, width:'40%'}} />
            <div className="skeleton" style={{height:320}} />
          </div>
        </section>
      </>
    );
  }

  const docs = items.filter(d => d.audience === audience).sort((a, b) => a.title.localeCompare(b.title));
  const activeDoc = docs.find(d => d.slug === rawSlug) || docs.find(d => d.slug === POLICY_AUDIENCE_DEFAULT_SLUG[audience]) || docs[0];

  return (
    <>
      <PageHead crumbs={['Outback', 'Policies', activeDoc?.title]} title={activeDoc?.title}
        lead={activeDoc ? `Last updated ${new Date(activeDoc.publishedAt || activeDoc.updatedAt).toLocaleDateString('en-AU', { day:'numeric', month:'long', year:'numeric' })}` : ''} />
      <section className="container" style={{paddingTop: 32, paddingBottom: 60}}>
        <div className="policy-layout">
          <aside className="policy-nav" aria-label="Policy documents">
            <div className="eyebrow" style={{padding:'0 0 8px 0', marginBottom:4}}>VIEWING AS</div>
            <select
              value={audience}
              onChange={(e) => onAudienceChange(e.target.value)}
              style={{width:'100%', padding:'10px 12px', marginBottom:20, border:'1px solid var(--line)', borderRadius:6, fontSize:14, background:'var(--bg)', color:'var(--ink)'}}
            >
              {POLICY_AUDIENCE_ORDER.map(key => (
                <option key={key} value={key}>{POLICY_AUDIENCE_LABELS[key]}</option>
              ))}
            </select>
            <div className="eyebrow" style={{padding:'0 0 8px 0', marginBottom:4}}>DOCUMENTS</div>
            {docs.map(d => (
              <a key={d.slug} href={`/policies/${audience}/${d.slug}`} className={activeDoc?.slug===d.slug?'active':''} aria-current={activeDoc?.slug===d.slug ? 'page' : undefined} onClick={(e) => { e.preventDefault(); goDoc(audience, d.slug); }}>{d.title}</a>
            ))}
          </aside>
          <div className="policy-content">
            {activeDoc ? renderMarkdown(interpolatePolicyBody(activeDoc.body, shop)) : (
              <p>This document isn't available right now.</p>
            )}
          </div>
        </div>
      </section>
    </>
  );
}

// ============================================================
// WARRANTY REGISTRATION
// ============================================================
function WarrantyRegisterPage({ go }) {
  const [form, setForm] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return { name: '', email: '', orderId: params.get('orderId') || '', receivedDate: '', notes: '' };
  });
  const update = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const [looking, setLooking] = useState(false);
  const [lookupError, setLookupError] = useState(null);
  const [orderData, setOrderData] = useState(null); // { date, expenses: [{description, isSecondHand}] }

  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [regId, setRegId] = useState(null);

  const lookupOrder = async () => {
    const id = form.orderId.trim();
    const email = form.email.trim();
    if (!id || !email) return;
    setLooking(true);
    setLookupError(null);
    setOrderData(null);
    try {
      const res = await fetch(`/api/warranty/order-lookup?id=${encodeURIComponent(id)}&email=${encodeURIComponent(email)}`);
      if (res.status === 404) { setLookupError('Order not found. Check the ID and email on your confirmation email.'); return; }
      if (res.status === 400) { setLookupError('Please enter your email address below first.'); return; }
      if (!res.ok) throw new Error();
      const data = await res.json();
      setOrderData(data);
    } catch {
      setLookupError('Could not look up order — check your ID or contact us.');
    } finally {
      setLooking(false);
    }
  };

  // Auto-lookup if orderId was pre-filled from QR code / email link
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('orderId')) lookupOrder();
  }, []);

  const resetForm = () => {
    setForm({ name: '', email: '', orderId: '', receivedDate: '', notes: '' });
    setOrderData(null);
    setLookupError(null);
    setSubmitted(false);
    setSubmitError(null);
  };

  if (submitted) {
    const newParts = (orderData?.expenses || []).filter(e => !e.isSecondHand);
    const usedParts = (orderData?.expenses || []).filter(e => e.isSecondHand);
    return (
      <>
        <PageHead crumbs={['Outback', 'Warranty Registration']} title="Registration received."
          lead="We've logged your build. Keep this confirmation for your records." />
        <section className="container" style={{ paddingTop: 32, paddingBottom: 60 }}>
          <div className="card-paper" style={{ padding: 40, maxWidth: 640 }}>
            <div className="row-flex"><span className="tag tag-euc">WARRANTY · {regId ? `#${regId}` : 'REGISTERED'}</span></div>
            <h3 className="serif" style={{ fontSize: 36, marginTop: 14 }}>Thanks, {form.name.split(' ')[0] || 'mate'}.</h3>
            <p style={{ marginTop: 12, color: 'var(--ink-2)' }}>
              Your build is registered. A confirmation has been sent to <strong>{form.email}</strong>.
            </p>
            <div className="term" style={{ marginTop: 24 }}>
              <div className="mono" style={{ fontSize: 10, color: 'var(--ink-3)', marginBottom: 6 }}>// REGISTERED BUILD</div>
              <div>order    : {form.orderId || '—'}</div>
              <div>received : {form.receivedDate || '—'}</div>
              {newParts.length > 0 && newParts.map((e, i) => (
                <div key={i}>new      : {e.description}</div>
              ))}
              {usedParts.length > 0 && usedParts.map((e, i) => (
                <div key={i}>2nd-hand : {e.description}</div>
              ))}
              {!orderData?.expenses?.length && <div>parts    : see confirmation email</div>}
            </div>
            <div className="row-flex" style={{ marginTop: 24 }}>
              <button className="btn" onClick={resetForm}>Register another</button>
              <button className="btn btn-ghost" onClick={() => go('home')}>Back to home</button>
            </div>
          </div>
        </section>
      </>
    );
  }

  const expenses = orderData?.expenses || [];
  const hasExpenses = expenses.length > 0;

  return (
    <>
      <PageHead crumbs={['Outback', 'Warranty Registration']} title="Register Your Build"
        lead="Enter your order ID and we'll pull up your build details automatically." />
      <section className="container quote-layout" style={{ paddingTop: 32, paddingBottom: 60, display: 'grid', gridTemplateColumns: '1fr 300px', gap: 48 }}>
        <form onSubmit={async (e) => {
          e.preventDefault();
          setSubmitError(null);
          setSubmitting(true);
          try {
            const payload = { ...form, expenses: orderData?.expenses || [] };
            const res = await fetch('/api/warranty/register', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': getCsrf() },
              body: JSON.stringify(payload),
            });
            if (!res.ok) {
              const data = await res.json().catch(() => ({}));
              throw new Error(data.message || 'server_error');
            }
            const data = await res.json().catch(() => ({}));
            setRegId(data.id || null);
            setSubmitted(true);
          } catch (err) {
            setSubmitError(err.message && err.message !== 'server_error'
              ? err.message
              : 'Something went wrong — please try again or contact us directly.');
          } finally {
            setSubmitting(false);
          }
        }}>
          <div className="card-paper" style={{ padding: 32 }}>
            <span className="eyebrow">01 · ORDER ID</span>
            <p style={{ fontSize: 13, color: 'var(--ink-2)', marginTop: 6, marginBottom: 12 }}>
              Find this on your order confirmation email from us.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <input
                required
                className="input"
                value={form.orderId}
                onChange={e => { update('orderId', e.target.value); setOrderData(null); setLookupError(null); }}
                placeholder="ord-1234567890"
              />
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  required
                  type="email"
                  className="input"
                  style={{ flex: 1 }}
                  value={form.email}
                  onChange={e => { update('email', e.target.value); setOrderData(null); setLookupError(null); }}
                  placeholder="Email from your order confirmation"
                />
                <button type="button" className="btn" onClick={lookupOrder} disabled={!form.orderId.trim() || !form.email.trim() || looking}
                  style={{ whiteSpace: 'nowrap', flexShrink: 0 }}>
                  {looking ? 'Looking up…' : 'Look up →'}
                </button>
              </div>
            </div>
            <ErrorText style={{marginTop: 10}}>{lookupError}</ErrorText>

            {orderData && (
              <div style={{ marginTop: 16 }}>
                {hasExpenses ? (
                  <>
                    <div className="eyebrow" style={{ color: 'var(--eucalyptus)', marginBottom: 10 }}>Build found — {expenses.length} part{expenses.length !== 1 ? 's' : ''}</div>
                    <div style={{ display: 'grid', gap: 8 }}>
                      {expenses.map((e, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'var(--bg)', border: '1px solid var(--line)', fontSize: 13 }}>
                          <span style={{ fontWeight: 500 }}>{e.description}</span>
                          {e.isSecondHand
                            ? <span className="tag tag-ochre">2ND HAND · TESTED</span>
                            : <span className="tag tag-euc">NEW · MFR WARRANTY</span>
                          }
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="notice" style={{ marginTop: 0, fontSize: 13 }}>Order found, but no parts are logged against it yet. Add any notes below.</div>
                )}
              </div>
            )}

            <hr className="thin" />
            <span className="eyebrow">02 · YOUR DETAILS</span>
            <div className="grid-2" style={{ gap: 16, marginTop: 12 }}>
              <label className="field">
                <span className="label">Full name</span>
                <input required className="input" value={form.name} onChange={e => update('name', e.target.value)} placeholder="Your name" />
              </label>
              <label className="field">
                <span className="label">Email</span>
                <input required type="email" className="input" value={form.email} onChange={e => update('email', e.target.value)} placeholder="your@email.com" />
              </label>
            </div>
            <label className="field">
              <span className="label">Date received</span>
              <input required type="date" className="input" value={form.receivedDate} onChange={e => update('receivedDate', e.target.value)} />
            </label>

            <label className="field">
              <span className="label">Additional notes (optional)</span>
              <textarea className="textarea" value={form.notes} onChange={e => update('notes', e.target.value)}
                placeholder="Anything else we should know" style={{ minHeight: 80 }} />
            </label>

            <hr className="thin" />
            <ErrorText style={{marginBottom: 12}}>{submitError}</ErrorText>
            <div className="row-flex" style={{ justifyContent: 'space-between' }}>
              <span className="mono" style={{ fontSize: 11, color: 'var(--ink-2)' }}>KEEP YOUR RECEIPT — IT'S YOUR PROOF OF PURCHASE</span>
              <button className="btn btn-rust" type="submit" disabled={submitting}>{submitting ? 'Registering…' : 'Register build →'}</button>
            </div>
          </div>
        </form>

        <aside>
          <div className="card" style={{ padding: 22 }}>
            <span className="tag tag-ochre">WARRANTY INFO</span>
            <h3 className="serif" style={{ fontSize: 22, marginTop: 12, lineHeight: 1.1 }}>What's covered?</h3>
            <div style={{ marginTop: 16, display: 'grid', gap: 16 }}>
              <div>
                <div className="eyebrow" style={{ color: 'var(--eucalyptus)', marginBottom: 6 }}>New parts</div>
                <p style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.6 }}>
                  Manufacturer warranty applies. Contact the part manufacturer directly for warranty claims.
                </p>
              </div>
              <div className="rule" />
              <div>
                <div className="eyebrow" style={{ color: 'var(--ink-2)', marginBottom: 6 }}>Second-hand parts</div>
                <p style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.6 }}>
                  No manufacturer warranty. Every second-hand part is tested by us before it leaves the shop.
                </p>
              </div>
              <div className="rule" />
              <div>
                <div className="eyebrow" style={{ color: 'var(--ink-2)', marginBottom: 6 }}>Shipping</div>
                <p style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.6 }}>
                  We guarantee your build is working when it leaves our shop. Issues during shipping must be raised with <strong>Australia Post</strong>.
                </p>
              </div>
            </div>
          </div>
          <div className="card" style={{ padding: 22, marginTop: 16, background: 'var(--dark)', color: 'var(--paper)', borderColor: 'var(--dark)' }}>
            <span className="eyebrow" style={{ color: 'var(--ochre)' }}>QUESTIONS?</span>
            <p style={{ fontSize: 13, color: 'var(--bg-deep)', marginTop: 10, lineHeight: 1.6 }}>
              Not sure what applies to your build? Get in touch.
            </p>
            <button className="btn btn-ghost" style={{ marginTop: 12, color: 'var(--paper)', borderColor: 'var(--paper)' }}
              onClick={() => go('contact')}>Contact us →</button>
          </div>
        </aside>
      </section>
    </>
  );
}

function AboutPage({ go }) {
  const shop = window.__ShopContext__ ? React.useContext(window.__ShopContext__) : {};
  return (
    <>
      <PageHead crumbs={['Outback', 'About']} title="About Outback Electronics"
        lead={shop?.workshopBlurb || 'One desk, one tech, one ute. Arduino &amp; microcontroller builds, PC &amp; phone repairs, software, AI, and off-grid electronics. We travel, we ship worldwide.'} />
      <section className="container" style={{ paddingTop: 32, paddingBottom: 64 }}>
        <div style={{ maxWidth: 720 }}>
          <h2 className="serif" style={{ fontSize: 28, marginBottom: 16 }}>The workshop</h2>
          <p style={{ color: 'var(--ink-2)', lineHeight: 1.8, marginBottom: 24 }}>
            Outback Electronics is an independent electronics outpost{(() => {
              const addr = [shop?.suburb, shop?.state, shop?.postcode].filter(Boolean).join(' ');
              return addr ? ` based at ${addr}` : '';
            })()}.
            We build Arduino and microcontroller projects, repair PCs and phones, write software and AI solutions, and handle off-grid and automotive electronics — for people who live and work where the signal ends.
          </p>
          <p style={{ color: 'var(--ink-2)', lineHeight: 1.8, marginBottom: 24 }}>
            No public walk-in. Every visit is by appointment — call, email, or book online. We travel across remote Australia and ship worldwide.
          </p>
          <div className="row-flex" style={{ gap: 12, flexWrap: 'wrap', marginBottom: 32 }}>
            <button className="btn btn-rust" onClick={() => go('quote')}>Get a Quote</button>
            <button className="btn btn-ghost" onClick={() => go('contact')}>Contact us</button>
            <button className="btn btn-ghost" onClick={() => go('services')}>Our Services</button>
            <button className="btn btn-ghost" onClick={() => go('capability-statement')}>Capability Statement</button>
          </div>
          <div className="card-paper" style={{ padding: 28, background: 'var(--dark)', color: 'var(--paper)' }}>
            <div className="eyebrow" style={{ color: 'var(--ochre)', marginBottom: 12 }}>FIND US</div>
            <div style={{ fontSize: 15, lineHeight: 1.8 }}>
              <div>{[shop?.suburb, shop?.state, shop?.postcode].filter(Boolean).join(' ')}</div>
              {shop?.phone && <div style={{ marginTop: 6 }}>{shop.phone}</div>}
              <div style={{ marginTop: 6, color: 'var(--ink-3)', fontSize: 13 }}>No public access — appointment only.</div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

// ============================================================
// CAPABILITY STATEMENT (verbatim content of the printed/PDF document)
// ============================================================
function CapabilityStatementTable({ rows }) {
  return (
    <div style={{ overflowX: 'auto', marginBottom: 28 }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14.5 }}>
        <thead>
          <tr style={{ background: 'var(--dark)', color: 'var(--paper)' }}>
            <th style={{ textAlign: 'left', padding: '10px 14px', fontWeight: 600 }}>Service Area</th>
            <th style={{ textAlign: 'left', padding: '10px 14px', fontWeight: 600 }}>Description</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([area, desc], i) => (
            <tr key={i} style={{ borderBottom: '1px solid var(--line)' }}>
              <td style={{ padding: '10px 14px', fontWeight: 600, whiteSpace: 'nowrap', verticalAlign: 'top' }}>{area}</td>
              <td style={{ padding: '10px 14px', color: 'var(--ink-2)', lineHeight: 1.6 }}>{desc}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CapabilityStatementPage({ go }) {
  const shop = window.__ShopContext__ ? React.useContext(window.__ShopContext__) : {};
  const phone = shop?.phone || '0497 522 768';
  const email = shop?.email || 'outbackhutelectronics@gmail.com';
  const abn = shop?.abn || '99 496 591 295';
  const address = '137B Thistle Street, Blackall QLD 4472';

  return (
    <>
      <PageHead crumbs={['Outback', 'Capability Statement']} title="Capability Statement"
        lead="Full-Service Electronics & Technology Provider — Blackall, QLD. By appointment only." />
      <section className="container" style={{ paddingTop: 32, paddingBottom: 64 }}>
        <div style={{ maxWidth: 880, margin: '0 auto' }}>

          <div className="card-paper" style={{ padding: 24, marginBottom: 32, display: 'flex', flexWrap: 'wrap', gap: 24 }}>
            <div>
              <div className="eyebrow" style={{ color: 'var(--ochre)' }}>Contact</div>
              <div style={{ lineHeight: 1.8 }}>{phone}<br />{email}</div>
            </div>
            <div>
              <div className="eyebrow" style={{ color: 'var(--ochre)' }}>Web</div>
              <div style={{ lineHeight: 1.8 }}>outbackelectronics.com.au<br />By Appointment Only</div>
            </div>
            <div>
              <div className="eyebrow" style={{ color: 'var(--ochre)' }}>Location</div>
              <div style={{ lineHeight: 1.8 }}>{address}</div>
            </div>
          </div>

          <h2 className="serif" style={{ fontSize: 24, marginBottom: 14 }}>Business Overview</h2>
          <p style={{ color: 'var(--ink-2)', lineHeight: 1.8, marginBottom: 16 }}>
            Outback Electronics is a full-service electronics and technology provider based in Blackall, Queensland. The business covers the complete spectrum — consumer device repair, custom embedded hardware, PCB design, SCADA and industrial control, software development, web hosting, cybersecurity, digital forensics, and technical consulting. If it involves electronics, hardware, or software, Outback Electronics can handle it.
          </p>
          <p style={{ color: 'var(--ink-2)', lineHeight: 1.8, marginBottom: 32 }}>
            Commercial, agricultural, and research clients can engage Outback Electronics for end-to-end project delivery: from initial requirements through circuit design, PCB layout, firmware, software, and documentation. Mobile and FIFO field service is available across the Central West region.
          </p>

          <h2 className="serif" style={{ fontSize: 24, marginBottom: 14 }}>Hardware, Repair &amp; Installation</h2>
          <CapabilityStatementTable rows={[
            ['Electronics & PCB Repair', 'Component-level SMD rework, diagnostics, through-hole and surface mount soldering. Fault diagnosis on consumer, commercial, and industrial electronics.'],
            ['PC Repair & Custom Builds', 'Desktop and laptop fault diagnosis, OS repair, clone migration, malware removal, hardware upgrades, and full custom PC builds to specification.'],
            ['Phone & Tablet Repair', 'Screen replacement, charging port repair, battery replacement, water damage assessment, and software recovery on iOS and Android devices.'],
            ['Game Console Repair', 'Fault diagnosis and repair of PlayStation, Xbox, Nintendo, and handheld gaming devices including HDMI port repair, disc drive faults, and overheating remediation.'],
            ['TV & AV Equipment', 'Flat panel TV repair, power supply and backlight faults, AV receiver and home theatre equipment diagnosis and repair.'],
            ['CB & Radio Equipment', 'Transmit/receive fault diagnosis, RF section inspection and repair, antenna system assessment, and field comms equipment servicing.'],
            ['Drone & RC Equipment', 'ESC, flight controller, and motor diagnosis. Firmware flashing, calibration, and repair of consumer and hobbyist drones and RC vehicles.'],
            ['Solar & 12V Systems', 'Solar panel system assessment, charge controller configuration, dual battery system design and installation, 12V DC wiring and fault diagnosis for vehicles and off-grid setups.'],
            ['UPS & Power Backup', 'UPS selection, installation, battery replacement, and runtime testing for residential and commercial applications.'],
            ['Appliance Repair', 'Diagnosis and repair of household appliances at component level where viable, including washing machines, dryers, refrigerators, and small appliances. Excludes work on 240V mains-connected circuits.'],
            ['Audio Electronics', 'Amplifier, receiver, and speaker crossover repair. Component-level fault diagnosis on hi-fi and PA equipment.'],
          ]} />

          <h2 className="serif" style={{ fontSize: 24, marginBottom: 14 }}>Custom Development &amp; Engineering</h2>
          <CapabilityStatementTable rows={[
            ['Custom Embedded Systems', 'End-to-end embedded hardware development: requirements through to finished product. AVR, ARM, ESP32, and custom silicon. Suitable for agricultural, industrial, medical, and research applications.'],
            ['Custom PCB Design', 'Schematic capture and PCB layout (KiCad) for client-specified end goals. Client provides the problem; Outback Electronics designs the circuit.'],
            ['Hardware-Software Integration', 'Software development that interfaces directly with external hardware — instruments, sensors, controllers, and industrial devices. Examples include viscometer interfaces, data loggers, and custom instrument front-ends.'],
            ['Digital Forensics', 'Data recovery and forensic analysis from computers, phones, storage media, and embedded devices. Deleted file recovery, fault diagnosis, and evidence-grade documentation where required.'],
            ['Reverse Engineering', 'Hardware and firmware reverse engineering for compatibility, repair, legacy system support, or security assessment purposes.'],
            ['IoT & Home Automation', 'Design and deployment of IoT sensor networks, smart home systems, and remote monitoring solutions. Custom firmware and cloud/local integration.'],
            ['SCADA & Industrial Control', 'SCADA system design, integration, and troubleshooting. PLC interfacing, sensor integration, and industrial control system development for remote and rural applications.'],
            ['Product Prototyping', 'Full prototype development for client product concepts — from circuit design and PCB layout through to enclosure, firmware, and production-ready documentation.'],
          ]} />

          <h2 className="serif" style={{ fontSize: 24, marginBottom: 14 }}>Software, Web &amp; Systems</h2>
          <CapabilityStatementTable rows={[
            ['Windows / Mac / Linux Software', 'Cross-platform desktop application development, system utilities, automation tools, and software that interfaces with external hardware or instruments.'],
            ['Mobile App Development', 'Android and iOS application development for consumer, business, and hardware-interfacing purposes.'],
            ['Web Development', 'Front-end and back-end web development. Custom HTML/CSS/JS, Node.js/Express, and full-stack application builds.'],
            ['Web Hosting', 'Self-hosted and managed web hosting solutions. Domain configuration, SSL, Cloudflare integration, and ongoing maintenance.'],
            ['Database Design & Administration', 'Relational and NoSQL database design, deployment, and administration. MySQL/MariaDB, PostgreSQL, and embedded database solutions.'],
            ['API Development & Integration', 'REST and custom API design, development, and third-party API integration for web and hardware-interfacing applications.'],
            ['Automation & Scripting', 'Workflow automation, scripting (Python, Bash, Node.js), scheduled tasks, and system integration across platforms.'],
            ['AI & Machine Learning Integration', 'Integration of AI/ML models into software applications and hardware systems. Local inference, API-based AI integration, and custom model deployment.'],
            ['Cybersecurity & Pen Testing', 'Security assessment, penetration testing, vulnerability analysis, and hardening recommendations for web applications, networks, and embedded systems.'],
            ['Networking & WiFi', 'Home and business network design, WiFi optimisation, router and switch configuration, VLAN setup, and fault diagnosis.'],
            ['CCTV & Security Systems', 'IP and analogue camera system installation, configuration, fault diagnosis, NVR/DVR setup, and remote viewing configuration.'],
          ]} />

          <h2 className="serif" style={{ fontSize: 24, marginBottom: 14 }}>Consulting &amp; Professional Services</h2>
          <CapabilityStatementTable rows={[
            ['Technical Consulting', 'Expert advice on electronics, software, infrastructure, and technology strategy for businesses, farms, and organisations operating in remote and regional settings.'],
            ['Equipment Sourcing & Procurement', 'Specification and sourcing of electronics components, IT hardware, and specialised equipment. Supplier identification and procurement support.'],
            ['Documentation & Technical Writing', 'User manuals, technical specifications, wiring diagrams, system documentation, and compliance documentation for hardware and software products.'],
            ['Remote & Field Service', 'Mobile pickup and drop-off across the Blackall region. On-site assessment and FIFO/remote site visits by arrangement for commercial and pastoral clients.'],
          ]} />

          <h2 className="serif" style={{ fontSize: 24, marginBottom: 14 }}>Key Differentiators</h2>
          <CapabilityStatementTable rows={[
            ['Full-Spectrum Capability', 'One provider from consumer device repair through to custom embedded hardware, SCADA systems, software development, and web hosting. No need to source multiple specialists.'],
            ['Component-Level Repair', 'Full SMD rework capability. Diagnoses and repairs at component level rather than defaulting to board or unit replacement, reducing cost significantly.'],
            ['Hardware + Software', 'Rare combination of deep hardware engineering and full-stack software development. Able to build complete systems end-to-end including the physical circuit, firmware, and user-facing software.'],
            ['Regional Availability', 'Based in Blackall — delivering specialist capability to the Central West and surrounding regions where these services are otherwise absent locally.'],
            ['Flexible Engagement', 'Appointment-based with mobile pickup/drop-off. FIFO and remote site visits available for commercial and pastoral clients. Work quoted promptly and transparently.'],
          ]} />

          <div className="card-paper" style={{ padding: 24, marginTop: 8, background: 'var(--dark)', color: 'var(--paper)', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 16 }}>OUTBACK ELECTRONICS</div>
              <div style={{ color: 'var(--ink-3)', fontSize: 13, marginTop: 4 }}>outbackelectronics.com.au | {phone}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 13 }}>{address}</div>
              <div style={{ color: 'var(--ink-3)', fontSize: 13, marginTop: 4 }}>ABN: {abn}</div>
            </div>
          </div>

          <div className="row-flex" style={{ gap: 12, flexWrap: 'wrap', marginTop: 32 }}>
            <button className="btn btn-rust" onClick={() => go('quote')}>Get a Quote</button>
            <button className="btn btn-ghost" onClick={() => go('contact')}>Contact us</button>
          </div>
        </div>
      </section>
    </>
  );
}

// ============================================================
// SELL YOUR GEAR (used gear — consignment / outright / trade)
// ============================================================
function SellGearPage({ go }) {
  return (
    <>
      <PageHead crumbs={['Outback','Sell Your Gear']} title="Sell Your Gear"
        lead="We resell other people's gear too. Here's how to sell yours through us — consignment, outright, or a trade." />

      <section className="container" style={{paddingTop: 40}}>
        <div className="grid-3" style={{gap: 24}}>
          {[
            {n:'01', t:'Outright Purchase', d:'Walk in or mail in. We test, we offer, you decide. Cash same day.', tag:'FAST'},
            {n:'02', t:'Consignment', d:'We list it, photograph it, support it. You set the floor. 18% commission.', tag:'BEST PRICE'},
            {n:'03', t:'Trade Credit', d:'+15% bonus when you take it as store credit. Stackable with refurb sales.', tag:'+15%'},
          ].map((c,i) => (
            <div key={i} className="card-paper" style={{padding: 28}}>
              <div className="row-flex" style={{justifyContent:'space-between'}}>
                <span className="serif" style={{fontSize: 48, color:'var(--rust)', lineHeight:0.9}}>{c.n}</span>
                <span className="tag tag-ochre">{c.tag}</span>
              </div>
              <h3 className="serif" style={{fontSize: 28, marginTop:14, lineHeight:1.1}}>{c.t}</h3>
              <p style={{marginTop:10, fontSize:14, color:'var(--ink-2)'}}>{c.d}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="container" style={{paddingTop: 48, paddingBottom: 40}}>
        <div className="grid-2" style={{gap: 36}}>
          <div>
            <span className="eyebrow">THE PROCESS · 4 STEPS</span>
            <h2 className="serif" style={{fontSize: 44, marginTop: 8, lineHeight:1.02}}>How a piece of gear becomes someone else's win.</h2>
            <div style={{marginTop: 24, display:'grid', gap: 16}}>
              {[
                {n:'A',t:'Inventory form',d:'List what you\'ve got. Photos welcome but optional.'},
                {n:'B',t:'Bench appraisal',d:'We test, grade (A–D), and offer a price for each line item.'},
                {n:'C',t:'Choose your path',d:'Outright cash, consignment listing, or trade credit. Mix & match per item.'},
                {n:'D',t:'You get paid',d:'EFT within 48h for cash. Consigned items pay out monthly.'},
              ].map((s,i) => (
                <div key={i} style={{display:'grid', gridTemplateColumns:'56px 1fr', gap: 14, padding:'18px 0', borderTop:'1px solid var(--line)'}}>
                  <div className="serif" style={{fontSize: 36, color:'var(--rust)'}}>{s.n}</div>
                  <div>
                    <div className="serif" style={{fontSize:22}}>{s.t}</div>
                    <p style={{marginTop:4, color:'var(--ink-2)', fontSize:14}}>{s.d}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="card-paper" style={{padding: 28}}>
              <h3 className="serif" style={{fontSize:30, lineHeight:1.05}}>Grading rubric, no surprises.</h3>
              <table style={{width:'100%', marginTop:14, borderCollapse:'collapse', fontSize:13}}>
                <thead>
                  <tr style={{textAlign:'left', borderBottom:'2px solid var(--ink)'}}>
                    <th style={{padding:'10px 0'}}>GRADE</th><th>CONDITION</th><th>MULTIPLIER</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ['A','Near-new, original box, ≤2 yrs','×0.65'],
                    ['B','Working, minor cosmetic, ≤5 yrs','×0.45'],
                    ['C','Working but tired or 5+ yrs','×0.25'],
                    ['D','Parts only / needs work','flat $5–80'],
                  ].map((r,i)=>(
                    <tr key={i} style={{borderBottom:'1px solid var(--line)'}}>
                      <td style={{padding:'12px 0', fontFamily:'Instrument Serif, serif', fontSize:24, color:'var(--rust)'}}>{r[0]}</td>
                      <td>{r[1]}</td>
                      <td className="mono" style={{fontSize:13}}>{r[2]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p style={{marginTop:14, fontSize:12, color:'var(--ink-2)'}}>* Multipliers applied against our refurb sell-through price for the last 90 days.</p>
            </div>

            <div className="card" style={{padding: 22, marginTop:16, background:'var(--dark)', color:'var(--paper)', borderColor:'var(--dark)'}}>
              <span className="eyebrow" style={{color:'var(--ochre)'}}>BULK SELLERS · 50+ ITEMS</span>
              <p style={{marginTop:10, fontSize:14, color:'var(--bg-deep)'}}>Decommissioning a fleet, an office, a station shed? We'll come to you, do the appraisal on-site, and pay one lump sum.</p>
              <button className="btn btn-rust" style={{marginTop:14}} onClick={() => go('quote')}>Book a site visit →</button>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

const ACD_STAGES = [
  {
    n: '0', name: 'Birth', active: true,
    plain: 'The system exists but does nothing yet. It has a heartbeat — a clock, a memory, a boundary between itself and the outside world. Nothing more.',
    tech: 'Runtime persistence · internal state variables · clock and scheduling · sandbox boundary enforcement',
  },
  {
    n: '1', name: 'Waking up', active: true,
    plain: 'It learns to be awake and asleep. It starts reacting to the world around it — loud sounds, bright movement — without understanding any of it.',
    tech: 'Wake/sleep transitions · sensory gating · arousal state · adaptive thresholds · raw energy detection',
  },
  {
    n: '2', name: 'Learning to see and hear', active: false,
    plain: 'It starts making sense of the raw flood of pixels and sound. Not understanding — just finding patterns. The same way a newborn learns to focus before it learns to recognise.',
    tech: 'Visual and auditory latent space stabilisation · temporal continuity · feature persistence · waveform structure modelling',
  },
  {
    n: '3', name: 'Things exist when you look away', active: false,
    plain: 'It learns that objects are persistent — that the cup is still the cup even when it moves, or is partially hidden. This is object permanence. Babies develop it around 8 months.',
    tech: 'Visual identity persistence · motion tracking · partial occlusion handling · re-identification without labels',
  },
  {
    n: '4', name: 'Babbling', active: false,
    plain: 'It starts making sounds. Not words — just attempts. It hears a sound, tries to reproduce it, listens to what it made, and adjusts. Over and over. The same process a baby uses.',
    tech: 'Sensorimotor audio loop · closed-loop imitation · motor-to-acoustic mapping · iterative error reduction',
  },
  {
    n: '5', name: 'Connecting what it sees to what it hears', active: false,
    plain: 'It starts noticing that some sounds go with some sights. A moving mouth produces voice. A falling object makes a thud. No meaning yet — just correlation.',
    tech: 'Cross-modal temporal synchrony · predictive coupling between visual and auditory streams · co-occurrence learning',
  },
  {
    n: '6', name: 'Shared attention', active: false,
    plain: 'A person can point at something, say a word, and repeat it. The system starts connecting the pointing to the thing and the thing to the sound. The beginning of understanding that sounds refer to objects.',
    tech: 'Caregiver-guided referential binding · joint attention · attended visual cluster paired with repeated auditory pattern',
  },
  {
    n: '7', name: 'First words', active: false,
    plain: 'A word becomes real. Not because it was programmed in — but because the system has seen the thing, heard the word, and had the connection reinforced enough times that it sticks.',
    tech: 'Stable symbol grounding · visual cluster ↔ auditory pattern ↔ reinforcement binding · reusable cross-modal association',
  },
  {
    n: '8+', name: 'Thinking', active: false,
    plain: 'If the foundations hold, higher capabilities follow — reasoning, planning, memory across time, a model of itself. These are distant goals. We are not there yet, and we will not pretend otherwise.',
    tech: 'Abstraction · planning · compositional language · episodic memory · self-modelling · long-term prediction',
  },
];

const ACD_LAYERS = [
  {
    n: '1', name: 'Survival first',
    plain: 'Before anything else, the system needs to stay stable. This layer manages energy, attention, and whether the system is awake or resting — equivalent to the brainstem keeping a body alive.',
    tech: 'Regulatory layer · arousal control · sleep/wake · metabolic budgeting · sensory gating · sandbox enforcement',
  },
  {
    n: '2', name: 'Raw senses',
    plain: 'Eyes and ears. This layer takes in the camera and microphone and finds structure in the noise — without labelling or understanding anything. Pure pattern detection.',
    tech: 'Sensory layer · visual and auditory stream ingestion · latent compression · representation stabilisation · no symbolic reasoning',
  },
  {
    n: '3', name: 'Constant prediction',
    plain: 'The core engine. Every moment, it predicts what will happen next. When it\'s wrong, it adjusts. This single loop drives almost everything the system learns.',
    tech: 'Predictive layer · next-state prediction · temporal continuity modelling · event anticipation · prediction error minimisation',
  },
  {
    n: '4', name: 'Connecting the senses',
    plain: 'Sight and sound start to inform each other. Not because we tell it they should — but because they keep happening together, and the system notices.',
    tech: 'Cross-modal integration layer · temporal synchrony detection · caregiver-guided binding · shared latent cause learning',
  },
  {
    n: '5', name: 'Drives and motivation',
    plain: 'It has something like wants — curiosity, the need for stability, a pull toward social interaction. These shape what it pays attention to and what it tries to do.',
    tech: 'Reinforcement and value layer · internal drives: continuity, stability, curiosity, social reinforcement, integrity · learning pressure shaping',
  },
  {
    n: '6', name: 'Memory',
    plain: 'It remembers — but not like a hard drive. Memory here is active compression. Important things get reinforced. Useless things fade. Forgetting is a feature.',
    tech: 'Memory and consolidation layer · replay · compression · reinforcement · pruning · working / episodic / procedural / associative memory types',
  },
  {
    n: '7', name: 'Higher thought',
    plain: 'Reasoning, planning, understanding itself. This layer does not exist yet. It will only be built once everything beneath it is solid. We don\'t skip steps.',
    tech: 'Higher cognition layer · abstraction · planning · self-modelling · long-term reasoning · symbolic manipulation · late-stage only',
  },
];

function HumanlyAIPage({ go }) {
  return (
    <>
      <PageHead
        crumbs={['Outback', 'AI', 'Humanly AI']}
        title="Humanly AI"
        kicker={<span className="tag tag-euc">RESEARCH · ACD</span>}
        lead="We are trying to grow a mind from scratch. Not program one. Not train one on the internet. Grow one — the way a brain grows — from raw experience, one stage at a time."
      />

      {/* The idea */}
      <section className="container" style={{paddingTop: 40, paddingBottom: 16}}>
        <div className="grid-2" style={{gap: 32, alignItems: 'start'}}>
          <div>
            <span className="eyebrow">THE IDEA</span>
            <h2 className="serif" style={{fontSize: 40, marginTop: 8, lineHeight: 1.15}}>Every AI you've used was taught.<br/>This one is being raised.</h2>
            <p style={{marginTop: 16, fontSize: 16, color: 'var(--ink-2)', lineHeight: 1.8}}>
              ChatGPT, Gemini, every AI assistant you've encountered — they were trained on billions of pages of human writing before you ever spoke to them. They arrived knowing language, facts, and how to hold a conversation.
            </p>
            <p style={{marginTop: 12, fontSize: 16, color: 'var(--ink-2)', lineHeight: 1.8}}>
              Humanly AI starts with none of that. No words. No facts. No prior knowledge of any kind. It starts with a camera, a microphone, and silence — and we are trying to see whether a mind can grow from there, the same way yours did.
            </p>
          </div>
          <div style={{padding: 32, background: 'var(--paper)', border: '1px solid var(--line)'}}>
            <span className="eyebrow">IT BEGINS WITH</span>
            <ul className="checks" style={{marginTop: 16, fontSize: 15, lineHeight: 2}}>
              <li>Eyes — a raw camera feed</li>
              <li>Ears — a raw microphone feed</li>
              <li>A voice — controllable audio output</li>
              <li>Memory — persistent storage</li>
              <li>Drives — something like hunger and curiosity</li>
              <li>Hard walls — a strict sandbox it cannot escape</li>
            </ul>
            <div style={{marginTop: 20, paddingTop: 20, borderTop: '1px solid var(--line)'}}>
              <span className="eyebrow" style={{color: 'var(--rust)'}}>IT DOES NOT BEGIN WITH</span>
              <ul style={{marginTop: 12, fontSize: 14, lineHeight: 2, listStyle: 'none', padding: 0, color: 'var(--ink-2)'}}>
                {['Any language or vocabulary','Knowledge of objects or the world','The ability to reason','Access to the internet','Anything pretrained'].map(x => (
                  <li key={x} style={{display:'flex', gap: 10}}><span style={{color:'var(--rust)'}}>✗</span>{x}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* How it learns */}
      <section className="container" style={{paddingTop: 56, paddingBottom: 16}}>
        <span className="eyebrow">HOW IT LEARNS</span>
        <div className="grid-2" style={{gap: 32, marginTop: 24}}>
          <div>
            <h3 className="serif" style={{fontSize: 30, lineHeight: 1.2}}>It guesses constantly — and learns from being wrong.</h3>
            <p style={{marginTop: 14, fontSize: 15, color: 'var(--ink-2)', lineHeight: 1.8}}>
              The system's core loop is prediction. Every moment, it tries to predict what will happen next — what the next frame will look like, what sound is coming. When it's wrong, it adjusts. This is how a brain works too: not storing information like a database, but building a model of the world by constantly testing it.
            </p>
            <p style={{marginTop: 12, fontSize: 15, color: 'var(--ink-2)', lineHeight: 1.8}}>
              There is no teacher correcting it with right answers. There is only reality, pushing back.
            </p>
            <div className="mono" style={{marginTop: 20, fontSize: 12, color: 'var(--ink-3)', lineHeight: 2, borderLeft: '2px solid var(--line)', paddingLeft: 16}}>
              <div>// technical: predictive coding architecture</div>
              <div>observe → predict → compare → reduce error → repeat</div>
            </div>
          </div>
          <div>
            <h3 className="serif" style={{fontSize: 30, lineHeight: 1.2}}>Knowledge is formed. Not installed.</h3>
            <p style={{marginTop: 14, fontSize: 15, color: 'var(--ink-2)', lineHeight: 1.8}}>
              When you were a baby, nobody uploaded "apple" into your brain. You saw apples, touched them, heard the word while looking at them, and over time the concept formed. We are attempting the same process — grounded, embodied, earned knowledge rather than injected facts.
            </p>
            <p style={{marginTop: 12, fontSize: 15, color: 'var(--ink-2)', lineHeight: 1.8}}>
              If the system eventually knows what an apple is, it will be because it figured it out — not because we told it.
            </p>
            <div className="mono" style={{marginTop: 20, fontSize: 12, color: 'var(--ink-3)', lineHeight: 2, borderLeft: '2px solid var(--line)', paddingLeft: 16}}>
              <div>// technical: grounded cognition via cross-modal</div>
              <div>association, reinforcement, and caregiver interaction</div>
            </div>
          </div>
        </div>
      </section>

      {/* Developmental stages */}
      <section className="container" style={{paddingTop: 56, paddingBottom: 16}}>
        <span className="eyebrow">THE STAGES</span>
        <h2 className="serif" style={{fontSize: 40, marginTop: 8, marginBottom: 8}}>It grows in order.<br/>No skipping ahead.</h2>
        <p style={{fontSize: 15, color: 'var(--ink-2)', marginBottom: 36, maxWidth: 600}}>
          A human brain doesn't develop all at once. The brainstem comes before the cortex. Vision before language. Babbling before words. We follow the same order — because we believe the order matters.
        </p>
        <div style={{position: 'relative', paddingLeft: 36}}>
          <div style={{position: 'absolute', left: 11, top: 8, bottom: 8, width: 1, background: 'var(--line)'}} />
          {ACD_STAGES.map((s, i) => (
            <div key={s.n} style={{position: 'relative', marginBottom: 36}}>
              <div style={{position: 'absolute', left: -36, top: 4, width: 22, height: 22, borderRadius: '50%', background: s.active ? 'var(--rust)' : 'var(--bg)', border: '2px solid', borderColor: s.active ? 'var(--rust)' : 'var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0}}>
                <span className="mono" style={{fontSize: 8, color: s.active ? '#fff' : 'var(--ink-3)'}}>{s.n}</span>
              </div>
              <div>
                <div style={{display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6}}>
                  <h3 style={{fontSize: 17, fontWeight: 700, margin: 0}}>{s.name}</h3>
                  {s.active && <span className="tag tag-rust" style={{fontSize: 9}}>WHERE WE ARE</span>}
                </div>
                <p style={{margin: '0 0 8px', fontSize: 15, color: 'var(--ink)', lineHeight: 1.7, maxWidth: 620}}>{s.plain}</p>
                <div className="mono" style={{fontSize: 11, color: 'var(--ink-3)', lineHeight: 1.8}}>{s.tech}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* How it's structured */}
      <section className="container" style={{paddingTop: 56, paddingBottom: 16}}>
        <span className="eyebrow">HOW IT'S BUILT</span>
        <h2 className="serif" style={{fontSize: 40, marginTop: 8, marginBottom: 8}}>Seven layers.<br/>Lowest first.</h2>
        <p style={{fontSize: 15, color: 'var(--ink-2)', marginBottom: 32, maxWidth: 580}}>
          The system is built in layers, each one depending on the ones below it. The higher layers don't exist yet — and won't until the lower ones are stable. We don't build the roof before the foundations.
        </p>
        <div style={{border: '1px solid var(--line)'}}>
          {ACD_LAYERS.map((l, i) => (
            <div key={l.n} style={{padding: '24px 28px', borderTop: i === 0 ? 'none' : '1px solid var(--line)', background: i % 2 === 0 ? 'var(--paper)' : 'var(--bg)'}}>
              <div style={{display: 'flex', alignItems: 'baseline', gap: 14, marginBottom: 8}}>
                <span className="mono" style={{fontSize: 11, color: 'var(--rust)', flexShrink: 0}}>LAYER {l.n}</span>
                <h3 style={{fontSize: 17, fontWeight: 700, margin: 0}}>{l.name}</h3>
              </div>
              <p style={{margin: '0 0 8px', fontSize: 15, color: 'var(--ink-2)', lineHeight: 1.7, maxWidth: 680}}>{l.plain}</p>
              <div className="mono" style={{fontSize: 11, color: 'var(--ink-3)'}}>{l.tech}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Memory and sleep */}
      <section className="container" style={{paddingTop: 48, paddingBottom: 16}}>
        <div className="grid-2" style={{gap: 32}}>
          <div style={{padding: 32, background: 'var(--paper)', border: '1px solid var(--line)'}}>
            <span className="eyebrow">MEMORY</span>
            <h3 className="serif" style={{fontSize: 28, marginTop: 10, marginBottom: 14}}>It forgets on purpose.</h3>
            <p style={{fontSize: 15, color: 'var(--ink-2)', lineHeight: 1.8, marginBottom: 16}}>
              Memory here isn't a hard drive. The system doesn't just record everything and keep it forever. Instead, it continuously replays experiences, reinforces what mattered, and lets the rest fade. Forgetting is not a bug — it's how noise gets cleared and real patterns survive.
            </p>
            <div className="mono" style={{fontSize: 11, color: 'var(--ink-3)', lineHeight: 2, borderTop: '1px solid var(--line)', paddingTop: 14}}>
              <div>Working memory — what it's attending to right now</div>
              <div>Episodic memory — compressed records of past interactions</div>
              <div>Procedural memory — learned behaviours and motor patterns</div>
              <div>Associative memory — cross-modal bindings (sight ↔ sound)</div>
            </div>
          </div>
          <div style={{padding: 32, background: 'var(--paper)', border: '1px solid var(--line)'}}>
            <span className="eyebrow">SLEEP</span>
            <h3 className="serif" style={{fontSize: 28, marginTop: 10, marginBottom: 14}}>Sleep is when the real work happens.</h3>
            <p style={{fontSize: 15, color: 'var(--ink-2)', lineHeight: 1.8, marginBottom: 16}}>
              When the system rests, it isn't idle. It replays what it experienced, consolidates what it learned, prunes what it doesn't need, and recalibrates. This mirrors what the human brain does during sleep — which is one reason sleep deprivation destroys learning.
            </p>
            <div className="mono" style={{fontSize: 11, color: 'var(--ink-3)', lineHeight: 2, borderTop: '1px solid var(--line)', paddingTop: 14}}>
              <div>Light sleep — low-level monitoring continues</div>
              <div>Deep sleep — internal replay and structural maintenance</div>
              <div>Dream-like replay — recombination of past experiences</div>
            </div>
          </div>
        </div>
      </section>

      {/* Sandbox */}
      <section className="container" style={{paddingTop: 48, paddingBottom: 16}}>
        <div style={{padding: 40, background: 'var(--dark)', color: 'var(--paper)', border: '1px solid var(--line)'}}>
          <span className="eyebrow" style={{color: 'var(--rust)'}}>CONTAINMENT</span>
          <h3 className="serif" style={{fontSize: 32, marginTop: 10, marginBottom: 16, color: 'var(--paper)'}}>It lives in a box it cannot leave.</h3>
          <div className="grid-2" style={{gap: 40}}>
            <div>
              <p style={{fontSize: 15, color: 'var(--bg-deep)', lineHeight: 1.8}}>
                The system has no access to the internet. It cannot touch the operating system it runs on. It cannot rewrite its own core rules. It cannot give itself more capabilities than it has been granted.
              </p>
              <p style={{marginTop: 12, fontSize: 15, color: 'var(--bg-deep)', lineHeight: 1.8}}>
                We are doing genuine research into emergent cognition. We take that seriously. The sandbox isn't a footnote — it's a first-class requirement.
              </p>
            </div>
            <div className="term">
              <div className="mono" style={{fontSize: 10, color: 'var(--ink-3)', marginBottom: 10}}>// HARD CONSTRAINTS</div>
              <div><span className="prompt">$</span> internet_access: <span style={{color:'var(--rust)'}}>false</span></div>
              <div><span className="prompt">$</span> host_os_access: <span style={{color:'var(--rust)'}}>false</span></div>
              <div><span className="prompt">$</span> self_modification: <span style={{color:'var(--rust)'}}>false</span></div>
              <div><span className="prompt">$</span> privilege_escalation: <span style={{color:'var(--rust)'}}>false</span></div>
              <div><span className="prompt">$</span> capability_gating: <span className="ok">staged · earned</span></div>
            </div>
          </div>
        </div>
      </section>

      {/* Success criteria */}
      <section className="container" style={{paddingTop: 56, paddingBottom: 16}}>
        <span className="eyebrow">WHAT SUCCESS LOOKS LIKE</span>
        <h2 className="serif" style={{fontSize: 40, marginTop: 8, marginBottom: 8}}>We'll know it's working<br/>when we see it.</h2>
        <p style={{fontSize: 15, color: 'var(--ink-2)', marginBottom: 32, maxWidth: 580}}>
          We're not chasing a benchmark score. These are the four moments that would tell us something real is happening.
        </p>
        <div className="grid-2" style={{gap: 1, border: '1px solid var(--line)', background: 'var(--line)'}}>
          {[
            { id: 'A', plain: 'It keeps track of an object as it moves — without being told what the object is.', tech: 'Persistent visual object tracking from raw input without labels' },
            { id: 'B', plain: 'It hears a sound and teaches itself to reproduce it, purely by listening to its own attempts and adjusting.', tech: 'Closed-loop audio imitation via sensorimotor error reduction' },
            { id: 'C', plain: 'It starts expecting a specific sound when it sees a particular thing — before it understands either.', tech: 'Stable cross-modal association between visual cluster and auditory pattern' },
            { id: 'D', plain: 'It sees an object and produces the word for it — a word it learned the same way a child does, through repeated experience.', tech: 'Grounded label production: perceived object → acquired sound pattern' },
          ].map(s => (
            <div key={s.id} style={{background: 'var(--paper)', padding: 32}}>
              <div className="mono" style={{fontSize: 11, color: 'var(--rust)', marginBottom: 10, letterSpacing: '.1em'}}>MILESTONE {s.id}</div>
              <p style={{fontSize: 16, lineHeight: 1.7, margin: '0 0 12px', fontWeight: 500}}>{s.plain}</p>
              <div className="mono" style={{fontSize: 11, color: 'var(--ink-3)'}}>{s.tech}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Final statement */}
      <section className="container" style={{paddingTop: 56, paddingBottom: 64}}>
        <div style={{maxWidth: 660, margin: '0 auto', textAlign: 'center'}}>
          <h2 className="serif" style={{fontSize: 36, lineHeight: 1.3, marginBottom: 20}}>We are not trying to build something smart.<br/>We are trying to build something that can become smart.</h2>
          <p style={{fontSize: 16, color: 'var(--ink-2)', lineHeight: 1.8, marginBottom: 12}}>
            The difference matters. Intelligence handed down is borrowed. Intelligence grown from experience — tested against reality, shaped by failure, reinforced by what works — is something else entirely.
          </p>
          <p style={{fontSize: 16, color: 'var(--ink-2)', lineHeight: 1.8, marginBottom: 36}}>
            We don't know if it will work. We think it's worth trying.
          </p>
          <div className="mono" style={{fontSize: 11, color: 'var(--ink-3)', marginBottom: 24, letterSpacing: '.1em'}}>// Biology is the developmental template. Silicon is the substrate.</div>
          <button className="btn btn-ghost" onClick={() => go('contact')}>Get in touch →</button>
        </div>
      </section>
    </>
  );
}

window.OE_PAGES = Object.assign(window.OE_PAGES || {}, {
  quote: QuotePage,
  book: BookingPage,
  contact: ContactPage,
  review: ReviewPage,
  sellers: SellersPage,
  'sell-gear': SellGearPage,
  policies: PoliciesPage,
  register: WarrantyRegisterPage,
  about: AboutPage,
  'capability-statement': CapabilityStatementPage,
  'humanly-ai': HumanlyAIPage,
  repairs: null, // resolved dynamically — alias to services
});
window.dispatchEvent(new Event('oe:pages-updated'));
