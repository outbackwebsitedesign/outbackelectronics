import React, { useState, useEffect, useContext } from 'react';
const _fallbackShopCtx = React.createContext({});
const useShop = () => useContext(window.__ShopContext__ || _fallbackShopCtx);

function getCsrf() {
  return document.cookie.split(';').reduce((v, c) => {
    const [k, val] = c.trim().split('=');
    return k === '_csrf' ? decodeURIComponent(val || '') : v;
  }, '');
}

// ============================================================
// REQUEST A QUOTE
// ============================================================
const _SHOP_LAT = -35.9845;
const _SHOP_LNG = 144.7730;
const _CALLOUT_FREE_KM = 10;
const _CALLOUT_LOCAL_CAP_KM = 200;
const _CALLOUT_HIVAL_THRESHOLD = 10000;
const _CALLOUT_FUEL_RATE = 220 / 400;
const _CALLOUT_KM_PER_DAY = 480;
const _CALLOUT_DAILY_RATE = 150;
const _CALLOUT_DAILY_THRESHOLD_KM = 400;

function _calloutFeeAud(distKm) {
  if (distKm <= _CALLOUT_FREE_KM) return 0;
  const fuel = distKm * _CALLOUT_FUEL_RATE;
  const daily = distKm > _CALLOUT_DAILY_THRESHOLD_KM
    ? Math.ceil(distKm / _CALLOUT_KM_PER_DAY) * 2 * _CALLOUT_DAILY_RATE
    : 0;
  return Math.round(fuel + daily);
}

function _haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

function QuotePage({ go, pageParams }) {
  const shop = useShop();
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [ticketId, setTicketId] = useState(null);
  const [locDistKm, setLocDistKm] = useState(null);
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
    if (pageParams) { setForm(initForm()); setLocDistKm(null); }
  }, [pageParams]);

  const update = (k, v) => setForm(f => ({ ...f, [k]: v }));

  useEffect(() => {
    if (!form.loc || form.loc.trim().length < 3) { setLocDistKm(null); return; }
    const t = setTimeout(async () => {
      setLocGeocoding(true);
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(form.loc + ', Australia')}&limit=1`,
          { headers: { 'Accept-Language': 'en' } }
        );
        const data = await res.json();
        if (data[0]) {
          const km = _haversineKm(_SHOP_LAT, _SHOP_LNG, parseFloat(data[0].lat), parseFloat(data[0].lon));
          setLocDistKm(Math.round(km));
        } else {
          setLocDistKm(null);
        }
      } catch { setLocDistKm(null); }
      finally { setLocGeocoding(false); }
    }, 700);
    return () => clearTimeout(t);
  }, [form.loc]);

  if (submitted) {
    return (
      <>
        <PageHead crumbs={['Outback','Request a Quote']} title="Quote received." lead="A real human will get back to you within 24 hours — usually sooner if you're east of the Stuart Highway." />
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
              <label className="field"><span className="label">Email or sat number</span><input required className="input" value={form.email} onChange={e => update('email', e.target.value)} placeholder="your@email.com" /></label>
            </div>
            <label className="field"><span className="label">Location / nearest town</span><input className="input" value={form.loc} onChange={e => update('loc', e.target.value)} placeholder="Newman, WA" /></label>
            {locGeocoding && <div className="mono" style={{fontSize:11, color:'var(--ink-2)', marginTop:4, marginBottom:4}}>Checking distance…</div>}
            {!locGeocoding && locDistKm !== null && (() => {
              const fee = _calloutFeeAud(locDistKm);
              const days = locDistKm > _CALLOUT_DAILY_THRESHOLD_KM ? Math.ceil(locDistKm / _CALLOUT_KM_PER_DAY) : 0;
              const isHiVal = pageParams && Number(pageParams.priceAud) >= _CALLOUT_HIVAL_THRESHOLD;
              const capExceeded = locDistKm > _CALLOUT_LOCAL_CAP_KM && !isHiVal;
              return (
                <div style={{marginTop:4, marginBottom:4, padding:'8px 12px', fontSize:13, border:'1px solid var(--line)', background:'var(--bg-elev)', borderColor: capExceeded ? 'var(--rust)' : 'var(--line)'}}>
                  {capExceeded
                    ? <span style={{color:'var(--rust)'}}>That's {locDistKm}km — on-site visits for most services are capped at {_CALLOUT_LOCAL_CAP_KM}km. We can still quote; or post the device to us.</span>
                    : fee === 0
                      ? <span><span style={{color:'var(--rust)', fontWeight:600}}>Free callout</span> — you're {locDistKm}km away.</span>
                      : days > 0
                        ? <span><span style={{fontWeight:600}}>~${fee} travel fee</span> — {locDistKm}km: fuel + {days * 2} travel days @ $150/day. We'll confirm in the quote.</span>
                        : <span><span style={{fontWeight:600}}>~${fee} travel fee</span> — {locDistKm}km at $0.55/km (round trip fuel). We'll confirm in the quote.</span>
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
            {submitError && <div className="notice" style={{marginBottom: 12, color: 'var(--rust)', fontSize: 13}}>{submitError}</div>}
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
// CONTACT
// ============================================================
function ContactPage({ go }) {
  const shop = useShop();
  const [qm, setQm] = useState({ name: '', email: '', msg: '' });
  const [qmSent, setQmSent] = useState(false);
  const [qmSending, setQmSending] = useState(false);
  const [qmError, setQmError] = useState(null);
  const [mapCoords, setMapCoords] = useState(null);

  React.useEffect(() => {
    const fullAddress = [shop.streetAddress, shop.suburb, shop.state, shop.postcode].filter(Boolean).join(', ');
    if (!fullAddress) return;
    fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(fullAddress)}&limit=1`, {
      headers: { 'Accept-Language': 'en' },
    })
      .then(r => r.json())
      .then(data => { if (data[0]) setMapCoords({ lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) }); })
      .catch(() => {});
  }, [shop.streetAddress, shop.suburb, shop.state, shop.postcode]);

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
              <h3 className="serif" style={{fontSize: 36, marginTop: 8}}>{[shop.streetAddress, [shop.suburb, shop.state, shop.postcode].filter(Boolean).join(' ')].filter(Boolean).join(', ')}</h3>
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
              <div className="card-paper" style={{padding: 22}}>
                <span className="eyebrow">EMAIL</span>
                <a href={shop.email ? `mailto:${shop.email}` : undefined} style={{fontSize:18, marginTop:8, fontWeight:600, color:'inherit', display:'block'}}>{shop.email || '—'}</a>
                <div className="mono" style={{fontSize:11, color:'var(--ink-2)', marginTop:4}}>APPOINTMENTS ONLY</div>
              </div>
              <div className="card-paper" style={{padding: 22}}>
                <span className="eyebrow">UHF</span>
                <div style={{fontSize: 18, marginTop:8, fontWeight:600}}>Channel 18, callsign OUTBACK-1</div>
                <div className="mono" style={{fontSize:11, color:'var(--ink-2)', marginTop:4}}>WEEKDAYS · MORNINGS, USUALLY</div>
              </div>
              <div className="card-paper" style={{padding: 22}}>
                <span className="eyebrow">SAT MSG</span>
                <div style={{fontSize: 18, marginTop:8, fontWeight:600}}>Iridium SBD: 881693700212</div>
                <div className="mono" style={{fontSize:11, color:'var(--ink-2)', marginTop:4}}>SHORT MESSAGES ONLY · ASCII</div>
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
                src={(() => {
                  const lat = mapCoords ? mapCoords.lat : parseFloat(shop.mapLat) || -35.9845;
                  const lng = mapCoords ? mapCoords.lng : parseFloat(shop.mapLng) || 144.7730;
                  return `https://www.openstreetmap.org/export/embed.html?bbox=${lng-0.02}%2C${lat-0.02}%2C${lng+0.02}%2C${lat+0.02}&layer=mapnik&marker=${lat}%2C${lng}`;
                })()}
                allowFullScreen
              />
              <div style={{position:'absolute', bottom:0, left:0, right:0, background:'var(--ink)', color:'var(--paper)', padding:'8px 12px', fontFamily:'JetBrains Mono, monospace', fontSize:10}}>
                MAP · {[shop.suburb, shop.state].filter(Boolean).join(' ').toUpperCase()}
              </div>
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
                  {qmError && <div style={{fontSize:12, color:'var(--rust)', marginBottom:8}}>{qmError}</div>}
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
// INFO FOR SELLERS
// ============================================================
const SELLER_DOCS = [
  {
    id: 'OHD001',
    title: 'Terms and Conditions for Prospective Sellers',
    content: `In this agreement:

"Seller" refers to the individual or entity seeking to list and sell products on our platform.

"We" or "Our" refers to Outback Electronics, the platform provider.


1. Circuit Quality Standards

We will only accept designs and circuits that are designed, produced, and presented in a professional appearance. Designs or circuits utilizing permanent breadboard or veroboard setups will not meet our quality standards. Please see document OHD002 for further information.


2. Mains Voltage Circuits

We do not accept mains voltage circuits or circuits not classified as ELV (Extra Low Voltage <50V). The Designer/Manufacturer will retain all responsibility for compliance, injury, loss, or damage arising from use and/or misuse of any design or circuit and retains all responsibility for any potential issues arising from any design and/or circuits.


3. Customer Support and Liability

In the event that a customer encounters any issues with a product, the seller is expected to handle customer inquiries and process refunds, bearing full responsibility for customer satisfaction.


4. Payment Terms

Sellers will use our platform to market their products, with payment for these products being made upon a successful customer purchase.

Stock held by the seller remains the seller's responsibility until sold. Costs related to stock maintenance, including product packaging, and storage are also the seller's responsibility.

Payment for sales will be made according to the agreed-upon terms, typically upon successful customer purchase.


5. Sales Expectations

Our startup is still in its initial stages, and sellers should not anticipate rapid sales. We are working towards establishing our presence in the market.

All products will be marketed equally, without preference or favor. No commitment will be accepted for sold quantities or sales expectations and/or quotas.


6. Business Registration

Sellers are required to provide a registered business name and possess a valid tax identification number (ABN or equivalent for their respective country) as part of our partnership.

Sellers should maintain public liability insurance if applicable to their business activities.


7. Product Claims and Customer Complaints

If a product is advertised to perform specific functions but fails to do so, and the seller does not respond within a reasonable timeframe to address the issue, we, and/or the purchaser, reserve the right to contact relevant fair trade authorities.

We reserve the right to cease all future business, implied or actual, in response to serious and/or repeated failures, either in product or response.


8. Quality Assurance

To ensure that products meet our stringent quality standards, we request samples of all items that will be listed for sale on our platform.


9. Shipping and Payment

Products will be shipped from the seller's location to our address. Payment for these products will be issued once a customer completes the purchase, as per the agreed-upon terms.

We shall retain all/any shipping and/or handling fees and charges.


10. Product Packaging

The responsibility for product packaging rests with the seller. It is the seller's responsibility to ensure that products are packaged securely and professionally.


11. Copyright Infringement

We reserve the right to cease all future business with a seller if they infringe on copyright laws. This includes instances where we are contacted by a company complaining about a product listed by the seller that violates copyright laws.


12. Listing Fees and Commission

A monthly listing fee will be applied, the cost of which will vary depending on the number of different product listings a seller wishes to post. Please refer to our fee structure document OHD003 for specific details.

In addition to the listing fees, we reserve the right to apply up to a 20% commission price raise to all products sold through our platform. This commission will be calculated based on the final sale price of the product. Please see document OHD003 for further information.


Changes to Terms and Conditions

We reserve the right to change, amend, add, or remove any term or condition as needed.

These terms and conditions are provided to ensure transparency and professionalism in our partnership. We recommend a thorough review of these terms, and if necessary, legal counsel to ensure mutual understanding and compliance. We look forward to the opportunity to collaborate with you as a valued seller on our platform.`,
  },
  {
    id: 'OHD002',
    title: 'Design Quality Standards',
    content: `At Outback Electronics, we are committed to maintaining high-quality standards for the products listed on our platform. To ensure consistency and excellence in the products offered to our customers, we have established the following design quality standards for all prospective sellers. We kindly request that you review and adhere to these guidelines when developing and presenting your products on our platform.


1. Professional Appearance

Designs and circuits must exhibit a professional appearance, both in physical construction and documentation.

Avoid the use of permanent breadboard or veroboard setups, as they do not meet our quality standards.


2. Compliance with Safety Regulations

We do not accept mains voltage circuits or circuits that are not classified as ELV (Extra Low Voltage <50V).

Designers and manufacturers are responsible for ensuring compliance with all relevant safety regulations, including but not limited to electrical safety standards.


3. Functionality and Performance

Products must perform the functions and meet the specifications as advertised.

Sellers should thoroughly test their products to ensure they meet the expected performance criteria.


4. Documentation

Provide clear and comprehensive documentation for your product, including schematics, assembly instructions, and any necessary usage guidelines.

Ensure that documentation is accurate, up-to-date, and user-friendly.


5. Materials and Components

Use high-quality materials and components in the construction of your products.

Clearly specify the materials and components used, and ensure they meet industry standards.


6. Reliability and Durability

Products should be designed to be reliable and durable, with a reasonable lifespan.

Consider factors such as component quality, heat management, and long-term performance.


7. Compatibility and Interoperability

Ensure that your products are compatible with commonly used components and interfaces as specified in the product description.

Provide compatibility information to help customers integrate your products into their systems.


8. Packaging

Packaging should be sturdy and protective to prevent damage during shipping.

Include clear labeling and instructions on the packaging, as well as any necessary safety warnings.


9. Customer Support

Sellers should be responsive to customer inquiries and provide timely support to address any issues or questions related to their products.

Be prepared to assist with troubleshooting and technical support when needed.


10. Continuous Improvement

Strive for continuous improvement in the quality and performance of your products.

Listen to customer feedback and consider it for product enhancements.


By adhering to these design quality standards, you will contribute to the overall excellence of our platform and enhance the trust and satisfaction of our customers. We appreciate your commitment to maintaining these standards and look forward to collaborating with you as a valued seller on Outback Electronics.

If you have any questions or need further clarification on any of these standards, please do not hesitate to contact us. We are here to support your success as a seller on our platform.`,
  },
  {
    id: 'OHD003',
    title: 'Fees',
    content: `At Outback Electronics, we strive to maintain a transparent and fair fee structure for our valued sellers. This document outlines the listing fees that may apply when you choose to list your products on our platform. Please review these fees carefully to understand the cost associated with selling on our platform.


1. Monthly Listing Fee

A monthly listing fee will be applied to all sellers based on the number of different product listings you wish to post. The fee structure is as follows:

  • 1 to 10 product listings: $0.75 per listing per month.
  • 11 to 50 product listings: $0.50 per listing per month.
  • 51 to 100 product listings: $0.30 per listing per month.
  • Over 100 product listings: Please contact us for a custom fee arrangement.

These monthly listing fees must be paid for each product listing, regardless of whether any of the listed products are sold during that month.

Please note that these fees are subject to change, and we will notify you in advance of any fee adjustments.


2. Commission Fee

In addition to the monthly listing fee, a commission fee will be applied to each product listed on our platform. The commission fee will be automatically added to the price set by the seller at the time of listing. The price displayed to customers will include both the seller's listed price and the commission fee.

For example, if a seller lists a product for $50, the product will be listed on our platform for $60 ($50 + 20% commission). When a customer purchases the product at $60, the commission fee will be automatically subtracted, and the seller will receive $50.

This commission fee is calculated based on the final sale price of the product and is due upon a successful customer purchase.


3. Purpose of Fees

The listing fees and commission serve a vital purpose in ensuring the continued operation and growth of Outback Electronics. The listing fees help cover the cost of running the website, including server maintenance, security measures, and ongoing platform enhancements.

The commission fees play a crucial role in our ability to run sales, marketing campaigns, and provide customer support. They also contribute to compensating our dedicated staff who work tirelessly to support our sellers and maintain the platform's functionality.


4. Payment of Listing Fees

Monthly listing fees are billed at the beginning of each month.

If payment is not made, the listings will be paused or removed until all outstanding payments are made.


5. Changing Your Subscription

You can adjust the number of product listings you wish to post at any time to fit your needs. Your monthly listing fee will be adjusted accordingly based on your chosen subscription tier.


6. Refunds

Listing fees are non-refundable. In the event of a refund to a customer, any commission fees associated with that sale will also be refunded.


7. Extra Advertising Services

In addition to our standard listing fees and commission structure, we offer optional advertising services to help boost the visibility of your products on our platform. These advertising services are available upon request and for an additional fee.

Should you wish to enhance the visibility of your products and increase your reach to potential customers, you can request extra advertising services. These services may include featured product placements, promotional campaigns, or targeted advertisements.

The costs associated with extra advertising services will vary depending on the specific service and the extent of the advertising campaign. Detailed information on available advertising services and their associated fees can be provided upon request.


8. Requesting Extra Advertising

To inquire about and request extra advertising services, please contact our support team or your account manager. We will be happy to discuss your advertising needs and provide you with options tailored to your products and goals.

Please note that extra advertising services are entirely optional and come with additional fees. Participation in these services is at the discretion of the seller.


9. Fee Changes

Outback Electronics reserves the right to change the listing fees and commission structure. We will provide advance notice of any fee changes, and such changes will only apply to new listings or renewals.


10. Questions

If you have any questions or require clarification regarding our listing fees, commission structure, or advertising services, please do not hesitate to contact our support team. We are here to assist you and ensure a transparent and mutually beneficial partnership.

Thank you for choosing Outback Electronics as your platform for selling electronic products. We look forward to your successful presence on our platform.`,
  },
  {
    id: 'OHD004',
    title: 'Listing Requirements',
    content: `At Outback Electronics, we are committed to maintaining a high standard of quality and professionalism across all product listings on our platform. This document outlines the listing requirements that must be adhered to by all sellers. Please review these requirements carefully to ensure your product listings meet our standards.


1. Product Photographs

The responsibility for providing clear and accurate photographs of the product lies with the seller.

Photograph Quality: Photographs must be well lit, clear, and accurately represent the product being offered for sale.

All product photographs should be taken on a white background to ensure clarity and consistency.

Multiple Angles: Whenever possible, include multiple photographs showing different angles and perspectives of the product.

Ensure that photographs are of high resolution to enable customers to zoom in and examine product details.

No Watermarks: Product photographs should not contain watermarks, logos, or any other promotional material that is not part of the product itself.


2. Product Description

Provide a detailed and accurate product description that includes essential information such as specifications, dimensions, features, and any other relevant details.

Clearly indicate the condition of the product, whether it is new, refurbished, or used.

Clearly state the price of the product in Australian Dollars (AUD), including any applicable taxes or fees.

Ensure that the product's availability is up-to-date. Listings for products that are out of stock or unavailable should be promptly updated.


3. Title and Keywords

Create a clear and concise product title that accurately describes the item. Avoid using excessive capitalization, special characters, or promotional language.

Include relevant keywords in your product listing to improve its discoverability in search results.


4. Contact Information

Be responsive to customer inquiries and provide reliable contact information in your seller profile.


5. Compliance with Laws and Regulations

Legal Compliance: Ensure that your product listings adhere to all relevant laws, regulations, and safety standards, including any required certifications or documentation for certain product categories.


6. Intellectual Property and Copyright

Sellers must have the legal right to sell the products listed and should not infringe on intellectual property or copyright rights of others.

List only genuine and authentic products. Do not offer counterfeit, replica, or unauthorized items.


7. Customer Service

Be prompt in responding to customer inquiries and addressing any concerns or issues related to your products.

Refunds and Returns: Clearly communicate your refund and return policies to customers.


8. Compliance with Outback Electronics Policies

Platform Policies: Sellers must adhere to Outback Electronics' policies, terms, and conditions, as outlined in our Terms and Conditions for Prospective Sellers.


9. Videos (If Applicable)

If videos are included in your product listing, they must be of good quality and professionalism.

Business Branding: Videos should contain the seller's business name and logo for branding purposes.

Videos must be shorter than five minutes in duration.

Content: Videos can showcase the product or provide instructions on how to use it. They should enhance the overall customer experience.


10. Language and Presentation

Spelling, Capitalization, and Punctuation: All listings must have proper spelling, capitalization, and punctuation. Ensure that product descriptions are written in clear and correct English.


By listing your products on the Outback Electronics platform, you agree to adhere to these listing requirements. All prices should be listed in Australian Dollars (AUD). Failure to meet these requirements may result in the rejection or removal of your listings from our platform.

We value your commitment to maintaining the quality and professionalism of our platform and look forward to a successful partnership.

If you have any questions or require clarification regarding these listing requirements, please do not hesitate to contact our support team. We are here to assist you and ensure a transparent and mutually beneficial partnership.

Thank you for choosing Outback Electronics as your platform for selling electronic products.`,
  },
];

function SellersPage({ go }) {
  const [activeDoc, setActiveDoc] = useState(null);
  const current = SELLER_DOCS.find(d => d.id === activeDoc);

  if (current) {
    return (
      <>
        <PageHead
          crumbs={['Outback', 'Info for Sellers', current.id]}
          title={current.title}
        />
        <section className="container" style={{paddingTop: 8, paddingBottom: 60}}>
          <button
            className="btn btn-ghost"
            style={{marginBottom: 28, fontSize: 13}}
            onClick={() => setActiveDoc(null)}
          >
            ← Back to Information for Sellers
          </button>
          <div className="card-paper" style={{padding: '36px 44px', maxWidth: 820}}>
            <div className="row-flex" style={{alignItems:'center', gap: 12, marginBottom: 24}}>
              <span className="tag tag-ochre">{current.id}</span>
            </div>
            <h2 className="serif" style={{fontSize: 32, lineHeight: 1.1}}>{current.title}</h2>
            <hr className="thin" style={{margin: '24px 0'}} />
            <div style={{fontSize: 14.5, lineHeight: 1.8, color: 'var(--ink-2)', whiteSpace: 'pre-wrap'}}>
              {current.content}
            </div>
          </div>
        </section>
      </>
    );
  }

  return (
    <>
      <PageHead
        crumbs={['Outback', 'Info for Sellers']}
        title="Information For Sellers"
        lead="Everything you need to know about listing and selling your products on the Outback Electronics platform."
      />
      <section className="container" style={{paddingTop: 32, paddingBottom: 60}}>
        <div style={{maxWidth: 680, display: 'grid', gap: 0}}>
          {SELLER_DOCS.map((doc, i) => (
            <button
              key={doc.id}
              onClick={() => setActiveDoc(doc.id)}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                background: 'none',
                border: 'none',
                borderBottom: i < SELLER_DOCS.length - 1 ? '1px solid var(--line)' : 'none',
                padding: '22px 0',
                cursor: 'pointer',
              }}
            >
              <span style={{
                fontFamily: 'Instrument Serif, serif',
                fontSize: 20,
                color: 'var(--rust)',
                textDecoration: 'underline',
                textUnderlineOffset: 3,
              }}>
                {doc.id} – {doc.title}
              </span>
            </button>
          ))}
        </div>
      </section>
    </>
  );
}

// ============================================================
// POLICIES
// ============================================================
function PoliciesPage() {
  const shop = useShop();
  const [policies, setPolicies] = useState([]);
  const [active, setActive] = useState(null);
  useEffect(() => {
    fetch('/api/policies').then(r => r.ok ? r.json() : Promise.reject()).then(d => {
      const items = d.items || [];
      setPolicies(items);
      if (items.length > 0) setActive(items[0].id);
    }).catch(() => {});
  }, []);
  const current = policies.find(p => p.id === active);
  return (
    <>
      <PageHead crumbs={['Outback','Policies']} title="Policies"
        lead="The rules we run by — read them once, then never again unless something has gone sideways." />
      <section className="container" style={{paddingTop: 32, paddingBottom: 60}}>
        {policies.length === 0 ? (
          <div className="mono" style={{fontSize:13, color:'var(--ink-2)'}}>No policies published yet.</div>
        ) : (
          <div className="policy-layout">
            <aside className="policy-nav">
              {policies.map(p => (
                <a key={p.id} className={active===p.id?'active':''} onClick={() => setActive(p.id)}>{p.title}</a>
              ))}
            </aside>
            {current && (
              <div className="policy-content">
                <span className="eyebrow">POLICY · {current.title.toUpperCase()}</span>
                <h2 style={{marginTop:8}}>{current.title}</h2>
                <div style={{marginTop:18, fontSize:15, lineHeight:1.75, whiteSpace:'pre-wrap'}}>{current.body}</div>
                <hr className="thin" />
                <div className="notice" style={{marginTop: 24}}>
                  <span className="tag tag-ink">QUESTIONS?</span>
                  <div style={{fontSize:13, color:'var(--ink-2)'}}>Email <strong>{shop.email || 'us'}</strong> — we'll route you to whoever wrote the policy.</div>
                </div>
              </div>
            )}
          </div>
        )}
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
            {lookupError && (
              <div className="notice" style={{ marginTop: 10, fontSize: 13, color: 'var(--rust)' }}>{lookupError}</div>
            )}

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
            {submitError && <div className="notice" style={{ marginBottom: 12, color: 'var(--rust)', fontSize: 13 }}>{submitError}</div>}
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
        lead={shop?.workshopBlurb || 'One desk, one tech, one ute. Free callout in Moama/Echuca; we travel anywhere in Australia. Ship anywhere in the world.'} />
      <section className="container" style={{ paddingTop: 32, paddingBottom: 64 }}>
        <div style={{ maxWidth: 720 }}>
          <h2 className="serif" style={{ fontSize: 28, marginBottom: 16 }}>The workshop</h2>
          <p style={{ color: 'var(--ink-2)', lineHeight: 1.8, marginBottom: 24 }}>
            Outback Electronics is an independent electronics outpost based at 183 Peericoota Forest Rd, Moama NSW 2731.
            We repair rugged laptops, satellite uplinks and off-grid power systems — and we build custom rigs for people who live and work where the signal ends.
          </p>
          <p style={{ color: 'var(--ink-2)', lineHeight: 1.8, marginBottom: 24 }}>
            No public walk-in. Every visit is by appointment — call, email, or book online. We travel the full length of the Stuart Highway and ship worldwide.
          </p>
          <div className="row-flex" style={{ gap: 12, flexWrap: 'wrap', marginBottom: 32 }}>
            <button className="btn btn-rust" onClick={() => go('quote')}>Get a Quote</button>
            <button className="btn btn-ghost" onClick={() => go('contact')}>Contact us</button>
            <button className="btn btn-ghost" onClick={() => go('services')}>Our Services</button>
          </div>
          <div className="card-paper" style={{ padding: 28, background: 'var(--dark)', color: 'var(--paper)' }}>
            <div className="eyebrow" style={{ color: 'var(--ochre)', marginBottom: 12 }}>FIND US</div>
            <div style={{ fontSize: 15, lineHeight: 1.8 }}>
              <div>{[shop?.streetAddress, [shop?.suburb, shop?.state, shop?.postcode].filter(Boolean).join(' ')].filter(Boolean).join(', ')}</div>
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
  contact: ContactPage,
  sellers: SellersPage,
  'sell-gear': SellGearPage,
  policies: PoliciesPage,
  register: WarrantyRegisterPage,
  about: AboutPage,
  'humanly-ai': HumanlyAIPage,
  repairs: null, // resolved dynamically — alias to services
});
window.dispatchEvent(new Event('oe:pages-updated'));
