import React, { useState, useEffect, useContext } from 'react';
import { getCsrf } from './src/lib/api.js';
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
                        : <span><span style={{fontWeight:600}}>~${fee} travel fee</span> — {distKm}km at $0.55/km (round trip fuel). We'll confirm in the quote.</span>
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
// INFO FOR SELLERS — COMPONENTS
// ============================================================
function SellerTermsContent({ email, phone, address, abn }) {
  const s = {mt: {marginTop:32}, p: {fontSize:15, lineHeight:1.75, marginTop:8}};
  return (
    <div>
      <span className="eyebrow">SELLER AGREEMENT · OHD001</span>
      <h2 style={{marginTop:8}}>Terms and Conditions for Sellers</h2>
      <div style={s.mt}>
        <p style={s.p}>This Agreement is between Outback Electronics ('OE', 'we', 'us', or 'our'){address ? `, located at ${address}` : ''}{abn ? `, ABN ${abn}` : ''}, and the individual or entity approved to list products on the Platform ('Seller', 'you', or 'your').</p>
        <p style={s.p}>This Agreement incorporates the following documents by reference, together forming the entire seller agreement:</p>
        <ul style={{paddingLeft:20, lineHeight:2, marginTop:8}}>
          <li><strong>OHD001</strong> — Terms and Conditions for Sellers (this document)</li>
          <li><strong>OHD002</strong> — Design Quality Standards</li>
          <li><strong>OHD003</strong> — Fees Schedule</li>
          <li><strong>OHD004</strong> — Listing Requirements</li>
        </ul>
        <p style={s.p}>By submitting an application to list on the Platform, by listing a product, or by continuing to use the Platform after receiving notice of updated terms, you agree to be bound by this Agreement. We recommend that all prospective Sellers obtain independent legal advice before entering into this Agreement.</p>
      </div>

      <div style={s.mt}><h3>1. Definitions</h3>
        <ul style={{paddingLeft:20, lineHeight:2, marginTop:8}}>
          <li><strong>"Agreement"</strong> means OHD001–OHD004 collectively.</li>
          <li><strong>"ACL"</strong> means the Australian Consumer Law (Schedule 2 of the <em>Competition and Consumer Act 2010</em> (Cth)).</li>
          <li><strong>"Commission"</strong> means the percentage fee applied by OE to the Seller's listed price, per OHD003.</li>
          <li><strong>"ELV"</strong> means Extra Low Voltage — circuits or systems operating at or below 50 V AC or 120 V DC.</li>
          <li><strong>"Listing Fee"</strong> means the monthly subscription fee charged per OHD003.</li>
          <li><strong>"Platform"</strong> means the Outback Electronics website at <a href="https://outbackelectronics.com.au">outbackelectronics.com.au</a> and any related services.</li>
          <li><strong>"Products"</strong> means items listed by the Seller on the Platform.</li>
          <li><strong>"Sale Proceeds"</strong> means the price paid by a customer for a Product, inclusive of Commission.</li>
          <li><strong>"Seller Content"</strong> means all images, descriptions, schematics, branding, videos, and other materials submitted by the Seller for listing purposes.</li>
        </ul>
      </div>

      <div style={s.mt}><h3>2. Nature of the Relationship</h3>
        <p style={s.p}>OE operates the Platform as a marketplace. The Seller is an independent business; nothing in this Agreement creates a partnership, joint venture, franchise, employment, or general agency relationship, except as expressly stated below.</p>
        <p style={s.p}>OE acts as a <strong>disclosed payment collection agent</strong> for the Seller. When a customer purchases a Product, OE collects the Sale Proceeds on the Seller's behalf and remits the net amount (after Commission, Listing Fees, and any other deductions) to the Seller per Section 9.</p>
        <p style={s.p}><strong>ACL Supplier Status.</strong> The Seller acknowledges that under the ACL, OE may be treated as a 'supplier' of Products in respect of customers and therefore shares in the consumer guarantee obligations attaching to Products sold through the Platform. The Seller's obligation to indemnify OE under Section 12 reflects that any ACL liability OE incurs in respect of a Seller's Product originates with that Seller's product or conduct, not OE's own default.</p>
      </div>

      <div style={s.mt}><h3>3. ELV/LV Platform Scope</h3>
        <p style={s.p}>The Platform accepts <strong>only Extra Low Voltage (ELV, ≤50 V AC / ≤120 V DC) and Low Voltage (LV) products.</strong> Mains-voltage (240 V AC) products, components, or designs are strictly prohibited — there are no exceptions. This includes any product that connects directly to a mains supply, any mains-rated power supply unit, or any circuit designed to operate at mains voltages even if it includes a step-down stage.</p>
        <p style={s.p}>Acceptable categories include: Arduino, Raspberry Pi, and custom microcontroller boards and shields; embedded systems and ELV sensor/control modules; 12 V / 24 V / 48 V automotive, caravan, marine, and off-grid electronics; battery management systems; DC-DC converters; and other circuits operating entirely within ELV limits. Software, firmware, and digital products related to the above hardware are also accepted.</p>
        <p style={s.p}>By listing a Product, the Seller warrants the Product operates exclusively within ELV/LV limits. If OE identifies or receives a credible complaint that a listed Product operates at mains voltage, OE may immediately remove the listing without notice and may terminate this Agreement under Section 14.</p>
      </div>

      <div style={s.mt}><h3>4. Product Quality and Safety</h3>
        <p style={s.p}>All Products must comply with the Design Quality Standards in OHD002. The Seller is solely responsible for ensuring Products are safe, comply with all applicable Australian Standards (including <em>AS/NZS 3820</em> and any other relevant standard for the product category), and are fit for the purpose represented in the listing.</p>
        <p style={s.p}>The Seller must not list Products containing counterfeit, substandard, or materially misrepresented components. Specifications, capabilities, limitations, and intended use must be accurately represented.</p>
        <p style={s.p}><strong>Pre-Listing Samples.</strong> OE may request a sample of any Product before or after listing. Samples must be provided within 14 days of request at the Seller's cost. If a sample fails OE's quality assessment, the listing is suspended until the Seller demonstrates compliance.</p>
        <p style={s.p}><strong>Ongoing Compliance.</strong> If a design or component changes materially after initial listing, the Seller must notify OE and provide updated documentation and, if requested, a new sample.</p>
      </div>

      <div style={s.mt}><h3>5. Fulfillment Model</h3>
        <p style={s.p}><strong>OE operates as a pure digital marketplace and does not hold, handle, warehouse, or fulfill any seller inventory.</strong> All Products are dispatched directly by the Seller to the customer from the Seller's own location. The sender name and address on a parcel will be the Seller's, not Outback Electronics'.</p>
        <p style={s.p}>The Seller bears sole responsibility for all shipping, packaging, logistics, and delivery of Products to customers. The Seller bears all risk of loss or damage in transit from dispatch until the Product is delivered. OE retains all shipping and handling fees collected from customers per OHD003; these cover platform costs and do not represent any logistics service provided by OE.</p>
        <p style={s.p}>OE accepts no liability for delayed, damaged, or lost shipments arising from the Seller's fulfillment process. The Seller must have adequate processes in place to track orders, respond to delivery inquiries, and resolve delivery failures promptly.</p>
      </div>

      <div style={s.mt}><h3>6. Intellectual Property Licence</h3>
        <p style={s.p}>By submitting Seller Content to OE, the Seller grants OE a <strong>non-exclusive, royalty-free, worldwide, sub-licensable licence</strong> to use, reproduce, adapt, display, publish, and distribute Seller Content for the purpose of operating and promoting the Platform and the Seller's listings.</p>
        <p style={s.p}>This licence continues for 90 days after termination to allow OE to complete outstanding orders and wind down listings in an orderly manner. After 90 days, OE will remove Seller Content from active listings. OE may retain archival copies for legal, audit, and dispute-resolution purposes.</p>
        <p style={s.p}>The Seller warrants that: (a) it owns or holds a sufficient licence over all Seller Content; (b) OE's authorised use of Seller Content will not infringe any third party's intellectual property rights; and (c) no Seller Content is defamatory, obscene, misleading, or unlawful.</p>
        <p style={s.p}>OE retains all intellectual property rights in the Platform, its design, branding, and infrastructure. Nothing in this Agreement transfers any OE IP to the Seller.</p>
      </div>

      <div style={s.mt}><h3>7. Listing Fees and Commission</h3>
        <p style={s.p}>Fees and commission rates are set out in the Fees Schedule (OHD003).</p>
        <p style={s.p}><strong>Commission Mechanics.</strong> OE adds the applicable Commission percentage to the Seller's nominated price to determine the customer price. Example at 20%: Seller nominates $50 → customer price is $60 → OE remits $50 to the Seller and retains $10 as Commission. The customer is aware they are purchasing from a third-party seller on the Outback Electronics platform.</p>
        <p style={s.p}><strong>Listing Fee.</strong> Monthly Listing Fees are charged per OHD003 regardless of whether any Products are sold. Failure to pay within 14 days of the invoice date results in suspension of all listings; reinstatement occurs within 2 business days of full payment.</p>
        <p style={s.p}><strong>Listing Fees are non-refundable.</strong> Commission is refunded to the Seller if the corresponding sale is subsequently refunded to the customer. <strong>OE retains all shipping and handling fees</strong> collected from customers.</p>
      </div>

      <div style={s.mt}><h3>8. GST</h3>
        <p style={s.p}>Unless otherwise stated, all fees and Commission amounts are exclusive of GST. Where GST applies, it will be added and OE will provide a valid tax invoice.</p>
        <p style={s.p}>The Seller warrants that it holds a valid ABN and complies with all GST obligations under the <em>A New Tax System (Goods and Services Tax) Act 1999</em> (Cth). The Seller must provide its ABN to OE before listing. OE may withhold tax from payments under the ATO's no-ABN withholding rules if the Seller fails to provide a valid ABN.</p>
        <p style={s.p}>Where OE collects payment from customers as a disclosed agent, the Seller is the entity making the taxable supply for GST purposes. The Seller is responsible for accounting for GST on its supplies.</p>
      </div>

      <div style={s.mt}><h3>9. Payment Terms</h3>
        <p style={s.p}>OE will remit Sale Proceeds to the Seller within <strong>14 days of customer payment clearing</strong> to OE's payment processor, by electronic funds transfer to the Seller's nominated Australian bank account.</p>
        <p style={s.p}>Each remittance will be accompanied by a payment statement itemising sales, Commission deducted, Listing Fees deducted, refunds processed, and the net amount paid.</p>
        <p style={s.p}>OE may withhold or set off against any remittance: outstanding Listing Fees, refunds issued to customers, amounts owed under any indemnity in this Agreement, or any other amount the Seller owes OE.</p>
        <p style={s.p}>If a customer initiates a chargeback, OE will notify the Seller promptly. The Seller must provide reasonable assistance to contest chargebacks it believes are unwarranted. If a chargeback is upheld, the corresponding amount will be debited against the next remittance.</p>
      </div>

      <div style={s.mt}><h3>10. Customer Support and Complaint Response</h3>
        <p style={s.p}>The Seller is primarily responsible for customer support in relation to its Products. The Seller must:</p>
        <ul style={{paddingLeft:20, lineHeight:2, marginTop:8}}>
          <li>Respond to all customer inquiries within <strong>5 business days</strong>;</li>
          <li>Process ACL-compliant refunds, replacements, or repairs within <strong>10 business days</strong> of a valid customer request;</li>
          <li>Notify OE of any product safety issue, recall, or regulatory investigation within <strong>2 business days</strong> of becoming aware of it.</li>
        </ul>
        <p style={s.p}>If the Seller fails to meet these timeframes, OE may at its discretion: (a) issue a refund to the customer and debit the amount from the next Seller remittance; (b) remove or suspend the affected listing; or (c) refer the matter to the ACCC, Consumer Affairs, or another relevant authority. Repeated or serious failures are grounds for immediate termination under Section 14.</p>
      </div>

      <div style={s.mt}><h3>11. Australian Consumer Law Compliance</h3>
        <p style={s.p}><strong>Nothing in this Agreement overrides, excludes, or limits any right a consumer has under the ACL,</strong> including consumer guarantee rights under Part 3-2, Division 1 (acceptable quality, fitness for purpose, match description, and other guarantees).</p>
        <p style={s.p}>The Seller must not represent to customers that ACL guarantees are excluded or that the Seller's return policy is more restrictive than ACL minimum entitlements. Phrases such as 'no refunds' or 'all sales final' must not appear in Seller communications or listings.</p>
        <p style={s.p}><strong>Unfair Contract Terms.</strong> The Seller acknowledges the operation of the unfair contract terms provisions of the ACL (ss.23–28, as extended to small business contracts from November 2023). Any term of this Agreement found to be an unfair contract term is void to the extent of the unfairness; the remainder of the Agreement continues in force.</p>
      </div>

      <div style={s.mt}><h3>12. Product Liability Indemnity</h3>
        <p style={s.p}>The Seller indemnifies OE and its officers, employees, agents, and contractors against all claims, losses, damages, liabilities, penalties, costs (including reasonable legal costs), and expenses arising from or in connection with:</p>
        <ul style={{paddingLeft:20, lineHeight:2, marginTop:8}}>
          <li>Any personal injury, death, or property damage (including fire, explosion, or electrical damage) caused or allegedly caused by a Product listed or sold by the Seller;</li>
          <li>Any breach by the Seller of this Agreement, including OHD002 and OHD004;</li>
          <li>Any ACL consumer guarantee liability that OE incurs as a result of a defect, misdescription, or non-compliance in a Seller's Product;</li>
          <li>Any infringement by the Seller of a third party's intellectual property rights;</li>
          <li>Any misleading or deceptive conduct by the Seller in connection with its Products or listings;</li>
          <li>Any claim by a regulatory body (including the ACCC, Consumer Affairs, or an electrical safety regulator) arising from a Seller's Product.</li>
        </ul>
        <p style={s.p}><strong>Insurance.</strong> The Seller must maintain, at its own expense, adequate public liability and product liability insurance with a minimum cover of <strong>$5,000,000 per occurrence</strong> from a reputable insurer. The Seller must provide OE with a certificate of currency on request and within 7 days of any renewal.</p>
      </div>

      <div style={s.mt}><h3>13. Copyright and IP Compliance</h3>
        <p style={s.p}>The Seller must hold all necessary rights to list, sell, and grant OE a licence over all Products and Seller Content. The Seller must not list: counterfeit, replica, or unauthorised goods; products that infringe any patent, registered design, trade mark, or copyright; or products that incorporate third-party open-source hardware or software in violation of the applicable licence terms.</p>
        <p style={s.p}>If OE receives a credible intellectual property complaint from a rights-holder, OE may immediately remove the listing and suspend the Seller's account pending investigation. If the complaint is upheld, OE may terminate this Agreement under Section 14 without liability to the Seller.</p>
      </div>

      <div style={s.mt}><h3>14. Termination</h3>
        <p style={s.p}><strong>Termination by Notice.</strong> Either party may terminate this Agreement by providing <strong>30 days' written notice</strong> by email.</p>
        <p style={s.p}><strong>Immediate Termination by OE.</strong> OE may terminate immediately by written notice if the Seller: lists or sells a mains-voltage product; causes or is subject to a confirmed product safety incident (fire, personal injury, or serious property damage); commits an ACL offence or faces regulatory enforcement action; infringes third-party intellectual property rights; fails to pay fees within 30 days of the due date; becomes insolvent, enters administration, receivership, or liquidation; or engages in misleading, deceptive, or fraudulent conduct.</p>
        <p style={s.p}><strong>Effect of Termination.</strong> On termination: listings are removed within 7 days (immediately for termination for cause); outstanding customer orders placed before termination are completed or refunded; Consigned Stock is returned at the Seller's cost within 30 days; final payment is made within 30 days after all outstanding customer transactions are resolved and all amounts owed to OE are deducted.</p>
        <p style={s.p}>Sections 6 (IP Licence — 90-day tail), 11 (ACL), 12 (Indemnity), 13 (IP Compliance), 17 (Governing Law), and any accrued payment obligations survive termination.</p>
      </div>

      <div style={s.mt}><h3>15. Dispute Resolution</h3>
        <p style={s.p}>If a dispute arises in connection with this Agreement, the parties agree to the following process before commencing litigation (except for urgent interlocutory relief):</p>
        <ol style={{paddingLeft:20, lineHeight:2, marginTop:8}}>
          <li><strong>Internal Resolution:</strong> The aggrieved party sends a written notice of dispute. The other party must respond within 15 business days; both parties attempt good-faith resolution.</li>
          <li><strong>Mediation:</strong> If unresolved within 30 days of the notice, either party may refer the dispute to mediation through a mediator agreed by both parties or appointed by a recognised mediation provider. Mediation costs are shared equally.</li>
          <li><strong>Litigation:</strong> If mediation is unsuccessful, either party may commence proceedings in the courts of Queensland.</li>
        </ol>
      </div>

      <div style={s.mt}><h3>16. Variation</h3>
        <p style={s.p}>OE may vary this Agreement by providing <strong>30 days' written notice</strong> by email. The Seller may terminate within the notice period if it does not accept the changes. Continued use of the Platform after the notice period constitutes acceptance of the updated terms.</p>
        <p style={s.p}>OE may vary this Agreement with immediate effect where variation is required to comply with applicable law, with written notice given as soon as reasonably practicable.</p>
      </div>

      <div style={s.mt}><h3>17. General</h3>
        <p style={s.p}><strong>Governing Law.</strong> This Agreement is governed by the laws of Queensland, Australia. Each party submits to the non-exclusive jurisdiction of the courts of Queensland and, where applicable, the Federal Court of Australia.</p>
        <p style={s.p}><strong>Entire Agreement.</strong> This Agreement (OHD001–OHD004) constitutes the entire agreement between the parties and supersedes all prior representations, negotiations, and understandings.</p>
        <p style={s.p}><strong>Severability.</strong> If any provision is found to be void, unlawful, or unenforceable, that provision is severed and the remaining provisions continue in full force.</p>
        <p style={s.p}><strong>Notices.</strong> Notices under this Agreement must be given by email. Notices to OE must be sent to {email ? <a href={`mailto:${email}`}>{email}</a> : 'our support email address'}. Notices to the Seller will be sent to the email address on the Seller's account.</p>
        <p style={s.p}><strong>Waiver.</strong> Failure to enforce any provision is not a waiver of the right to enforce it in future.</p>
      </div>
    </div>
  );
}

function SellerQualityContent({ email }) {
  const s = {mt: {marginTop:32}, p: {fontSize:15, lineHeight:1.75, marginTop:8}};
  return (
    <div>
      <span className="eyebrow">SELLER AGREEMENT · OHD002</span>
      <h2 style={{marginTop:8}}>Design Quality Standards</h2>
      <div style={s.mt}>
        <p style={s.p}>This document sets out the minimum quality, safety, and presentation standards that all products listed on the Outback Electronics Platform must meet. It forms part of the Seller Agreement (OHD001–OHD004). Sellers are responsible for ongoing compliance, not only at initial listing.</p>
        <p style={s.p}>If you have questions about whether your product meets these standards, contact us before listing: {email ? <a href={`mailto:${email}`}>{email}</a> : 'our support team'}.</p>
      </div>

      <div style={s.mt}><h3>1. Professional Construction</h3>
        <p style={s.p}>Products must exhibit a professional standard of construction. The following will not be accepted: permanent breadboard or veroboard assemblies (these are prototyping mediums, not finished products); exposed, uninsulated wiring presenting a contact or short-circuit risk; loose components not secured within an enclosure or on a PCB; and hand-written or missing labelling on boards and enclosures.</p>
        <p style={s.p}>Acceptable construction includes: custom PCBs (through-hole or SMD), commercially manufactured enclosures, and 3D-printed enclosures of appropriate rigidity and thermal resistance for the application.</p>
      </div>

      <div style={s.mt}><h3>2. ELV/LV Compliance (Mandatory)</h3>
        <p style={s.p}>All products must operate exclusively at Extra Low Voltage (ELV: ≤50 V AC / ≤120 V DC) or within Low Voltage (LV) limits. No mains-voltage (240 V AC) products or components are accepted. This requirement is absolute.</p>
        <p style={s.p}><strong>Applicable standards</strong> (as relevant to the product category):</p>
        <ul style={{paddingLeft:20, lineHeight:2, marginTop:8}}>
          <li><em>AS/NZS 3820</em> — Essential requirements for electrical equipment;</li>
          <li><em>AS/NZS 62368-1</em> — Audio/video, IT, and communications technology equipment;</li>
          <li><em>AS/NZS 4268</em> — Radio communications equipment;</li>
          <li>Relevant IEC standards for the specific product type.</li>
        </ul>
        <p style={s.p}>Sellers do not need formal certification for all products, but designs must be assessed against the relevant standard and documentation must demonstrate how the design meets its requirements.</p>
      </div>

      <div style={s.mt}><h3>3. Functionality and Performance</h3>
        <p style={s.p}>Products must perform all functions and meet all specifications as advertised. Known limitations must be clearly disclosed in the listing — non-disclosure constitutes a misdescription under the ACL. Sellers must test products thoroughly before listing. OE may request evidence of testing at any time.</p>
      </div>

      <div style={s.mt}><h3>4. Documentation Requirements</h3>
        <p style={s.p}>For each listed product, the Seller must provide OE with (or make available to customers as applicable):</p>
        <ul style={{paddingLeft:20, lineHeight:2, marginTop:8}}>
          <li><strong>Schematic diagram</strong> — clearly annotated with component values and part numbers;</li>
          <li><strong>Assembly or connection instructions</strong> — step-by-step with clear diagrams;</li>
          <li><strong>Usage and safety guidelines</strong> — operating voltage/current ranges, maximum ratings, and specific precautions;</li>
          <li><strong>Specification sheet</strong> — key electrical parameters, dimensions, and environmental ratings;</li>
          <li><strong>Bill of Materials (BOM)</strong> — key components and sources for quality audit purposes.</li>
        </ul>
        <p style={s.p}>Documentation must be accurate, current, and written in clear English. Outdated or inaccurate documentation is a listing breach.</p>
      </div>

      <div style={s.mt}><h3>5. Component Quality</h3>
        <p style={s.p}>All components must be genuine, specification-grade parts from reputable manufacturers or authorised distributors. The use of counterfeit, salvaged, out-of-specification, or remarked components is prohibited and constitutes a serious breach of the Seller Agreement. Sellers should be able to provide sourcing information for key components on request — particularly safety-critical parts such as MOSFETs, gate drivers, voltage regulators, and battery protection ICs.</p>
      </div>

      <div style={s.mt}><h3>6. Lithium Battery Products</h3>
        <p style={s.p}>Products incorporating lithium cells or designed for use with lithium-based batteries are subject to additional requirements:</p>
        <ul style={{paddingLeft:20, lineHeight:2, marginTop:8}}>
          <li>Battery protection circuits (overcharge, over-discharge, overcurrent, short circuit) must be present and correctly rated;</li>
          <li>Cell specifications (chemistry, capacity, maximum charge/discharge current, operating temperature range) must be disclosed;</li>
          <li>Charging parameters must be clearly documented and must not exceed cell manufacturer's specifications;</li>
          <li>Enclosures must provide adequate thermal ventilation;</li>
          <li>Shipping must comply with IATA Dangerous Goods Regulations (DGR) and CASA requirements for lithium battery transport.</li>
        </ul>
        <p style={s.p}>Products failing lithium battery safety requirements pose a risk of fire, explosion, and toxic gas release. Such products will not be accepted and any listed product found to be non-compliant will be immediately removed.</p>
      </div>

      <div style={s.mt}><h3>7. Reliability and Durability</h3>
        <p style={s.p}>Products should be designed for a reasonable lifespan appropriate to their application and price point. Key considerations: component derating (operating below maximum rated values); thermal management (heat sinks, thermal pads, or adequate PCB copper); environmental protection (conformal coating or appropriate IP rating for outdoor or automotive applications); and mechanical robustness (secure PCB mounting and strain relief on wiring harnesses).</p>
      </div>

      <div style={s.mt}><h3>8. Packaging</h3>
        <p style={s.p}>Products must be packaged to withstand postal and courier shipping without damage. Packaging must include: adequate cushioning; clear external labelling including product name, Seller's name or brand, and required safety warnings; required dangerous goods labelling for lithium batteries or other regulated substances; and instructions inside the package.</p>
      </div>

      <div style={s.mt}><h3>9. Compatibility Claims</h3>
        <p style={s.p}>Any compatibility claim (e.g., "compatible with Toyota Land Cruiser 200 Series" or "works with ESP32") must be based on actual testing, not assumptions. If compatibility has not been tested, it must not be claimed. Sellers are liable under the ACL for misdescriptions arising from untested compatibility claims.</p>
      </div>

      <div style={s.mt}><h3>10. Customer Support</h3>
        <p style={s.p}>Post-sale technical support is a quality obligation. Sellers must assist customers with reasonable technical questions about product integration and troubleshooting. OHD001 Section 10 sets response time requirements. A Seller that is unresponsive to legitimate customer support requests is in breach of these Quality Standards.</p>
      </div>

      <div style={s.mt}><h3>11. Incident Reporting and Continuous Improvement</h3>
        <p style={s.p}>Sellers should actively monitor field performance, review customer feedback, and update designs or documentation where issues are identified. If a significant quality or safety issue is identified post-listing, the Seller must notify OE within 2 business days and take appropriate remedial action (listing update, recall, or withdrawal).</p>
      </div>
    </div>
  );
}

function SellerFeesContent({ email }) {
  const s = {mt: {marginTop:32}, p: {fontSize:15, lineHeight:1.75, marginTop:8}};
  return (
    <div>
      <span className="eyebrow">SELLER AGREEMENT · OHD003</span>
      <h2 style={{marginTop:8}}>Fees Schedule</h2>
      <div style={s.mt}>
        <p style={s.p}>This document sets out the fees payable by Sellers for listing products on the Outback Electronics Platform. It forms part of the Seller Agreement (OHD001–OHD004). All amounts are in Australian Dollars (AUD). Unless otherwise stated, fees are <strong>exclusive of GST</strong>; GST will be added where applicable.</p>
        <p style={s.p}>For questions about fees, contact us at {email ? <a href={`mailto:${email}`}>{email}</a> : 'our support team'}.</p>
      </div>

      <div style={s.mt}><h3>1. Monthly Listing Fee</h3>
        <p style={s.p}>A monthly listing fee applies based on the number of active product listings, counted at the beginning of each billing month.</p>
        <div style={{overflowX:'auto', marginTop:12}}>
          <table style={{width:'100%', borderCollapse:'collapse', fontSize:14}}>
            <thead>
              <tr style={{background:'var(--bg-2,#f5f5f5)'}}>
                <th style={{padding:'10px 14px', textAlign:'left', borderBottom:'1px solid var(--line)'}}>Number of Active Listings</th>
                <th style={{padding:'10px 14px', textAlign:'left', borderBottom:'1px solid var(--line)'}}>Rate (per listing / month, excl. GST)</th>
              </tr>
            </thead>
            <tbody>
              <tr><td style={{padding:'10px 14px', borderBottom:'1px solid var(--line)'}}>1 – 10</td><td style={{padding:'10px 14px', borderBottom:'1px solid var(--line)'}}>$0.75</td></tr>
              <tr><td style={{padding:'10px 14px', borderBottom:'1px solid var(--line)'}}>11 – 50</td><td style={{padding:'10px 14px', borderBottom:'1px solid var(--line)'}}>$0.50</td></tr>
              <tr><td style={{padding:'10px 14px', borderBottom:'1px solid var(--line)'}}>51 – 100</td><td style={{padding:'10px 14px', borderBottom:'1px solid var(--line)'}}>$0.30</td></tr>
              <tr><td style={{padding:'10px 14px'}}>Over 100</td><td style={{padding:'10px 14px'}}>Contact us for a custom arrangement</td></tr>
            </tbody>
          </table>
        </div>
        <p style={s.p}><strong>Example:</strong> A Seller with 15 active listings pays 15 × $0.50 = $7.50 per month (+ GST if applicable).</p>
        <p style={s.p}>Listing Fees are <strong>non-refundable</strong> and payable regardless of whether any Products are sold during the month. If a Seller reduces their listing count mid-month, the reduced rate applies from the following month.</p>
      </div>

      <div style={s.mt}><h3>2. Commission</h3>
        <p style={s.p}>A commission fee applies to every product sold through the Platform. The commission is <strong>added to the Seller's nominated price</strong> to determine the price displayed to customers. The Seller receives their full nominated price on every completed sale.</p>
        <p style={s.p}><strong>Current commission rate: up to 20% of the Seller's nominated price.</strong> The actual rate applicable to each Seller will be confirmed in their onboarding agreement or account settings.</p>
        <p style={s.p}><strong>Worked example at 20%:</strong></p>
        <ul style={{paddingLeft:20, lineHeight:2, marginTop:8}}>
          <li>Seller nominates a price of $50.00</li>
          <li>OE adds 20% → customer price displayed is $60.00</li>
          <li>Customer pays $60.00</li>
          <li>OE deducts $10.00 commission and remits $50.00 to the Seller (less any Listing Fee deductions)</li>
        </ul>
        <p style={s.p}><strong>Commission on refunds:</strong> If a sale is refunded to the customer, the Commission for that sale is also refunded to the Seller. Listing Fees are not affected by refunds.</p>
      </div>

      <div style={s.mt}><h3>3. Payment of Listing Fees</h3>
        <p style={s.p}>Listing Fees are invoiced at the beginning of each calendar month and are due within <strong>14 days</strong> of the invoice date. OE may deduct outstanding Listing Fees from the Seller's remittance before paying Sale Proceeds. If Listing Fees remain unpaid after 30 days, all Seller listings will be paused until full payment is received.</p>
      </div>

      <div style={s.mt}><h3>4. Payment of Sale Proceeds</h3>
        <p style={s.p}>OE remits Sale Proceeds to the Seller within <strong>14 days</strong> of customer payment clearing, by electronic funds transfer to the Seller's nominated Australian bank account. Each remittance is accompanied by a payment statement itemising: gross sales, Commission deducted, Listing Fees deducted, refunds processed, and the net amount paid.</p>
        <p style={s.p}><strong>OE retains all shipping and handling fees</strong> collected from customers. These are not remitted to Sellers.</p>
      </div>

      <div style={s.mt}><h3>5. GST Treatment</h3>
        <p style={s.p}>All fees in this document are exclusive of GST. Where a fee is subject to GST, the GST-inclusive amount will be charged and OE will provide a valid tax invoice. Sellers are responsible for their own GST obligations on their product sales. Sellers must provide a valid ABN to OE; failure to do so may result in OE withholding tax from remittances under the ATO's no-ABN withholding rules.</p>
      </div>

      <div style={s.mt}><h3>6. Refunds and Chargebacks</h3>
        <p style={s.p}><strong>Customer refunds:</strong> Where OE processes a customer refund, the corresponding Sale Proceeds are reversed in the next remittance and the Commission for that sale is also reversed. Listing Fees are not affected.</p>
        <p style={s.p}><strong>Chargebacks:</strong> If a customer-initiated chargeback is upheld by the payment processor, the charged-back amount is debited from the Seller's next remittance. OE will notify the Seller and provide an opportunity to contest the chargeback if the Seller believes it is unwarranted.</p>
      </div>

      <div style={s.mt}><h3>7. Optional Advertising Services</h3>
        <p style={s.p}>Optional advertising services (featured placements, promotional campaigns, targeted advertisements) are available for an additional fee at the Seller's sole discretion. Pricing is provided upon request and a separate written agreement is required. To enquire, contact us at {email ? <a href={`mailto:${email}`}>{email}</a> : 'our support team'}.</p>
      </div>

      <div style={s.mt}><h3>8. Fee Changes</h3>
        <p style={s.p}>OE may change Listing Fees or the Commission rate by providing <strong>30 days' written notice</strong> by email. Updated rates apply to the first billing period commencing after the notice period expires. If a Seller does not accept a fee change, they may terminate the Agreement per OHD001 Section 14 within the notice period.</p>
      </div>

      <div style={s.mt}><h3>9. Pricing Integrity</h3>
        <p style={s.p}>Sellers must not manipulate their nominated prices to artificially distort the commission calculation. OE reserves the right to audit listed prices and, if manipulation is detected, to apply corrective measures or terminate the Agreement for cause.</p>
      </div>
    </div>
  );
}

function SellerListingContent({ email }) {
  const s = {mt: {marginTop:32}, p: {fontSize:15, lineHeight:1.75, marginTop:8}};
  return (
    <div>
      <span className="eyebrow">SELLER AGREEMENT · OHD004</span>
      <h2 style={{marginTop:8}}>Listing Requirements</h2>
      <div style={s.mt}>
        <p style={s.p}>This document sets out the requirements that all product listings on the Outback Electronics Platform must satisfy. It forms part of the Seller Agreement (OHD001–OHD004). By listing a product, the Seller warrants compliance with these requirements at the time of submission and on an ongoing basis.</p>
        <p style={s.p}>Listings that do not meet these requirements may be suspended, corrected by OE, or removed. Repeated or serious non-compliance is a breach of OHD001 and may result in termination. Questions: {email ? <a href={`mailto:${email}`}>{email}</a> : 'contact our support team'}.</p>
      </div>

      <div style={s.mt}><h3>1. Product Photographs</h3>
        <p style={s.p}>Photographs must: be well-lit, in focus, and accurately represent the product; include at least one shot on a plain white or neutral background; show multiple angles where features are not visible from a single perspective; be of sufficient resolution for customers to zoom in on detail (minimum 1000 × 1000 px recommended); not contain watermarks, unrelated branding, or promotional text overlays; and be of the actual product — not renders, stock images, or competitor products.</p>
        <p style={s.p}><strong>IP in photographs:</strong> By submitting photographs, the Seller warrants it owns the copyright or holds a licence to use them, and grants OE the licence in OHD001 Section 6 to display them in connection with the listing.</p>
      </div>

      <div style={s.mt}><h3>2. Product Title</h3>
        <p style={s.p}>Titles must: accurately describe the product (misleading titles breach the ACL); be concise — preferred format is [Brand / Seller Name] [Product Name] [Key Spec or Variant]; use title case only (not ALL CAPS); not contain promotional language in the title field; and not include competitor brand names for search optimisation purposes.</p>
      </div>

      <div style={s.mt}><h3>3. Product Description</h3>
        <p style={s.p}><strong>Required information:</strong> full and accurate specifications (voltage, current, power, dimensions, weight, operating temperature, etc.); intended purpose and application; condition (new, refurbished, or open-box); known limitations or incompatibilities (non-disclosure is a misdescription under the ACL); what is included in the package; any tools, skills, or additional components required; and relevant safety warnings.</p>
        <p style={s.p}><strong>Language:</strong> Descriptions must be written in clear, correct English. Automated translations without human review are not acceptable.</p>
        <p style={s.p}><strong>Price:</strong> All prices in Australian Dollars (AUD) inclusive of GST where applicable. No foreign-currency prices may be displayed.</p>
        <p style={s.p}><strong>Stock availability:</strong> Listings must reflect actual available stock and must be updated promptly. Selling products that cannot be fulfilled within the stated timeframe is a breach of the ACL and this Agreement.</p>
      </div>

      <div style={s.mt}><h3>4. Keywords and Search Terms</h3>
        <p style={s.p}>Keywords must be genuinely relevant to the product. Prohibited: competitor brand names used as keywords; irrelevant or misleading search terms; and keyword stuffing (repeating the same word or phrase to game search rankings).</p>
      </div>

      <div style={s.mt}><h3>5. Pricing Compliance</h3>
        <p style={s.p}>Sellers must comply with all price representation requirements under the ACL. In particular: the customer price (Seller price + OE Commission) is the total price — no hidden extras; any "was price" or "RRP" shown must reflect a genuine prior selling price or manufacturer's RRP (false RRPs are misleading under ACL s.18 and may constitute a false representation under ACL s.29(1)(i)); and Sellers must not create artificial urgency through false countdown timers or fabricated stock level warnings.</p>
      </div>

      <div style={s.mt}><h3>6. Refund and Return Policy Disclosure</h3>
        <p style={s.p}>Sellers must clearly communicate their refund and return policy in the listing or seller profile. The policy must not be less generous than ACL minimum consumer guarantee entitlements. Phrases such as "no refunds" or "all sales final" that purport to exclude ACL rights must not appear in listings or Seller communications.</p>
      </div>

      <div style={s.mt}><h3>7. Contact Information</h3>
        <p style={s.p}>Sellers must maintain accurate, monitored contact information in their seller profile. An email address monitored within 5 business days is the minimum requirement. Failure to maintain contact information or to respond to OE or customer communications is a breach of this Agreement.</p>
      </div>

      <div style={s.mt}><h3>8. Intellectual Property and Authenticity</h3>
        <p style={s.p}>All listed products must be genuine and the Seller's own work, or legitimately licensed or authorised for sale. Sellers must not list: counterfeit, cloned, or unauthorised reproductions of another party's product; products that infringe a patent, registered design, trade mark, or copyright; or open-source hardware or software projects listed in violation of the applicable open-source licence terms.</p>
        <p style={s.p}>The Seller grants OE the IP licence set out in OHD001 Section 6 for all content submitted with a listing — including photographs, descriptions, schematics, and videos. The Seller warrants it has the right to grant this licence.</p>
      </div>

      <div style={s.mt}><h3>9. Legal and Regulatory Compliance</h3>
        <p style={s.p}>Listings must comply with all applicable Australian laws and regulations, including: the Australian Consumer Law (accurate descriptions, no misleading claims); electrical safety regulations (ELV/LV products only — see OHD002 Section 2); dangerous goods regulations (correct labelling for lithium batteries and other regulated items); trade marks (no unauthorised use of third-party trade marks); and ACCC product safety standards applicable to the product category.</p>
      </div>

      <div style={s.mt}><h3>10. Videos (Optional)</h3>
        <p style={s.p}>Videos included in listings must: be no longer than 5 minutes; be of professional quality (stable footage, clear audio or subtitles, good lighting); include the Seller's business name or brand for attribution; relate to the product (demonstrations, assembly instructions, and feature overviews encouraged); not contain misleading claims or unsubstantiated comparative advertising; and be owned or appropriately licensed by the Seller. OE may require removal of any video that does not meet these standards or that contravenes applicable law.</p>
      </div>

      <div style={s.mt}><h3>11. Listing Accuracy and Maintenance</h3>
        <p style={s.p}>The Seller is responsible for keeping listings accurate and up-to-date, including: updating specifications if the product design changes materially; updating stock availability promptly; removing listings for products the Seller can no longer fulfil; and notifying OE within 2 business days if a product is subject to a recall or safety issue. OE may suspend or remove listings found to be inaccurate, out of date, or non-compliant.</p>
      </div>

      <div style={s.mt}><h3>12. Platform Policy Compliance</h3>
        <p style={s.p}>All listings must comply with the Seller Agreement (OHD001–OHD004) and the consumer-facing policies published on the Platform (Terms and Conditions, Return Policy, and Disclaimer). In the event of any conflict between these Listing Requirements and OHD001, OHD001 prevails.</p>
      </div>
    </div>
  );
}

// ============================================================
// INFO FOR SELLERS — INDEX
// ============================================================
function SellersPage({ go }) {
  useEffect(() => { go('policies', { audience: 'seller', slug: 'terms-and-conditions' }); }, []);
  return null;
}

// ============================================================
// ============================================================
function TermsContent({ email, phone, address, abn }) {
  const s = {mt: {marginTop:32}, p: {fontSize:15, lineHeight:1.75, marginTop:8}};
  return (
    <div>
      <span className="eyebrow">LEGAL · TERMS AND CONDITIONS</span>
      <h2 style={{marginTop:8}}>Terms and Conditions</h2>
      <div style={s.mt}>
        <p style={s.p}>We are Outback Electronics ('Company', 'we', 'us', or 'our'), a mobile electronics services provider registered in Australia.{abn ? ` Our ABN is ${abn}.` : ''} Our correspondence and returns address is {address}, Australia. <strong>We do not operate a public shopfront.</strong> All in-person visits are by prior appointment only; mail-in correspondence and returns are accepted at any time without appointment.</p>
        <p style={s.p}>We operate the website <a href="https://outbackelectronics.com.au">outbackelectronics.com.au</a> (the 'Site'), as well as any other related products and services that refer or link to these legal terms (collectively, the 'Legal Terms').</p>
        <p style={s.p}>You can contact us by phone at <a href={`tel:${(phone||'').replace(/\s/g,'')}`}>{phone}</a>, by email at <a href={`mailto:${email}`}>{email}</a>, or by mail to {address}, Australia. Please contact us before visiting in person.</p>
        <p style={{...s.p, fontWeight:600}}>PLEASE READ THESE LEGAL TERMS CAREFULLY BEFORE USING THE SERVICES. BY ACCESSING, BROWSING, REGISTERING ON, PURCHASING FROM, SUBMITTING A FORM ON, OR OTHERWISE USING THE SERVICES IN ANY WAY, YOU ACKNOWLEDGE THAT YOU HAVE READ, UNDERSTOOD, AND UNCONDITIONALLY AGREE TO BE BOUND BY ALL OF THESE LEGAL TERMS AND ALL POLICIES INCORPORATED HEREIN BY REFERENCE. IF YOU DO NOT AGREE, YOU MUST IMMEDIATELY CEASE ALL USE OF THE SERVICES. YOUR CONTINUED USE OF THE SERVICES FOLLOWING THE POSTING OF ANY UPDATED LEGAL TERMS CONSTITUTES ACCEPTANCE OF THOSE CHANGES.</p>
        <p style={s.p}>The Services are intended for users who are at least 18 years old. By using the Services you represent that you are 18 years of age or older.</p>
      </div>
      <div style={s.mt}><h3>1. Our Services</h3><p style={s.p}>The Services are not intended for distribution in jurisdictions where such use would be contrary to law. Users accessing the Services from other locations do so on their own initiative and are solely responsible for compliance with local laws.</p></div>
      <div style={s.mt}><h3>2. Intellectual Property Rights</h3>
        <p style={s.p}>We own or are the licensee of all intellectual property rights in our Services, including all source code, databases, functionality, software, website designs, audio, video, text, photographs, and graphics (collectively, the 'Content'), as well as the trademarks, service marks, and logos (the 'Marks'). These are protected by copyright and trademark laws in Australia and around the world.</p>
        <p style={s.p}>We grant you a non-exclusive, non-transferable, revocable licence to access the Services and download or print Content solely for your personal, non-commercial use. No Content or Marks may be exploited for any commercial purpose without our express prior written permission. Requests may be directed to {email}.</p>
        <p style={s.p}>By posting Contributions, you grant us an unrestricted, irrevocable, perpetual, royalty-free worldwide licence to use, reproduce, distribute, and exploit your Contributions for any purpose. You are solely responsible for your Contributions and may not post anything illegal, harassing, defamatory, obscene, or misleading.</p>
      </div>
      <div style={s.mt}><h3>3. User Representations</h3><p style={s.p}>By using the Services you represent that: (1) all information you submit is true, accurate, and complete; (2) you have the legal capacity to agree to these terms; (3) you are not a minor; (4) you will not use automated means to access the Services; (5) you will not use the Services for illegal or unauthorised purposes.</p></div>
      <div style={s.mt}><h3>4. User Registration</h3><p style={s.p}>You agree to keep your password confidential and are responsible for all use of your account. We may remove usernames that are inappropriate or objectionable.</p></div>
      <div style={s.mt}><h3>5. Products</h3>
        <p style={s.p}>We endeavour to display products accurately but cannot guarantee colours, features, or specifications are error-free. All products are subject to availability. Prices are subject to change. Product descriptions are provided in good faith and do not constitute a warranty beyond what is required by the Australian Consumer Law.</p>
        <p style={s.p}><strong>Australian Consumer Law — Consumer Guarantees:</strong> Our goods come with guarantees that cannot be excluded under the Australian Consumer Law. You are entitled to a replacement or refund for a major failure and compensation for any other reasonably foreseeable loss or damage. You are also entitled to have goods repaired or replaced if they fail to be of acceptable quality and the failure does not amount to a major failure. Nothing in these Legal Terms excludes, restricts, or modifies any right or remedy you have under the Australian Consumer Law.</p>
        <p style={s.p}><strong>Electrical Safety and Compliance — ELV/LV Products Only.</strong> Outback Electronics works exclusively with Extra Low Voltage (ELV, ≤50 V AC / ≤120 V DC) and Low Voltage (LV) equipment. We do not supply, repair, or provide services for mains-connected (240 V AC) equipment, and we are not licensed to perform mains-voltage electrical work. Nothing on this Site or in our Services should be interpreted as advice, instruction, or authorisation for mains-voltage work. All mains-voltage electrical installation, repair, or modification work must only be performed by a licensed electrician under applicable state or territory electrical safety legislation (including <em>AS/NZS 3000</em>). If your project requires work on mains-voltage infrastructure, please engage a licensed electrician — we can help with the ELV/LV side only. We make no representation regarding the safety ratings, compliance certifications, or fitness for purpose of third-party products or components. You are responsible for verifying that any product is appropriate for your intended application and installation environment before purchase or use.</p>
        <p style={s.p}><strong>Lithium Battery Safety.</strong> Products containing lithium cells, or sold for use with lithium-based batteries, carry inherent risks including fire, explosion, and toxic gas release if the cells are punctured, overcharged, over-discharged, short-circuited, exposed to excessive heat or moisture, physically damaged, or otherwise mishandled. You must handle, charge, store, transport, and dispose of lithium batteries strictly in accordance with manufacturer specifications and all applicable dangerous-goods regulations. We are not liable for any property damage (including fire damage or total property loss), personal injury, or death arising from improper handling, storage, charging, modification, or disposal of lithium batteries, to the fullest extent permitted by applicable law. Nothing in this clause limits your rights under the Australian Consumer Law where a product sold by us is defective.</p>
        <p style={s.p}><strong>Third-Party Products and Marketplace Sellers.</strong> Products listed and sold by third-party sellers on our marketplace are the sole responsibility of those sellers. Outback Electronics makes <strong>no representation, warranty, or guarantee of any kind</strong> regarding the quality, safety, fitness for purpose, compliance, accuracy of description, or any other characteristic of third-party products. We do not independently test, inspect, or certify third-party products before or after listing. Your purchase contract for a third-party product is with the seller, not with Outback Electronics. Your rights under the Australian Consumer Law in relation to third-party products run primarily against that seller as the vendor and supplier. If you have a complaint, warranty claim, or dispute regarding a third-party product, you must direct that claim to the seller. Outback Electronics will not be liable for any loss, damage, personal injury, property damage, or adverse outcome arising from a third-party product, to the fullest extent permitted by applicable law. Outback Electronics' role is limited to operating the marketplace platform.</p>
      </div>
      <div style={s.mt}><h3>6. Purchases and Payment</h3>
        <p style={s.p}>We accept Visa, Mastercard, and Afterpay. All payments are in Australian Dollars and include GST where applicable. Payment is processed securely via Stripe. By completing a purchase, you agree to Stripe's terms of service and privacy policy.</p>
        <p style={s.p}>We reserve the right to refuse any order, correct pricing errors, or cancel orders placed by dealers or resellers. If we cancel an order for which payment has been received, we will issue a full refund via your original payment method.</p>
      </div>
      <div style={s.mt}><h3>7. Subscriptions</h3>
        <p style={s.p}><strong>Billing and Renewal:</strong> Subscriptions auto-renew monthly unless cancelled.</p>
        <p style={s.p}><strong>Free Trial:</strong> New users receive a 14-day free trial; your chosen subscription is charged at the end of the trial. The free trial is available <strong>once per person</strong>, regardless of how many accounts, email addresses, or payment methods you use. We may decline to extend a further free trial to anyone we reasonably believe has already received one, including where this is identified retrospectively, and may convert a duplicate trial to a paid subscription or cancel it.</p>
        <p style={s.p}><strong>Cancellation:</strong> Cancel anytime via your account; takes effect at end of the current paid period. You retain access to member-only content, tutorials, and groups gated by your tier until the end of the period you have already paid for, even if you cancel before that date. Questions? Email {email}.</p>
        <p style={s.p}><strong>Fee Changes:</strong> We will communicate price changes in accordance with applicable law.</p>
        <p style={s.p}><strong>Discontinued Tiers.</strong> If we discontinue a membership tier or its associated benefits, we will give you reasonable notice and either migrate you to a comparable tier or refund the unused, already-paid portion of your current billing period on a pro-rata basis. We are not liable for any other loss arising from a tier being discontinued.</p>
      </div>
      <div style={s.mt}><h3>8. Return / Refunds Policy</h3><p style={s.p}>Please review our Return Policy posted on the Services prior to making any purchases.</p></div>
      <div style={s.mt}><h3>9. Software</h3>
        <p style={s.p}>Any software provided is offered 'AS IS' without warranty of any kind. If a EULA accompanies the software, those terms govern and take precedence over this section. You may not reproduce or redistribute software except as permitted by the applicable EULA or these Legal Terms.</p>
        <p style={s.p}><strong>Firmware and Updates.</strong> We may release firmware or software updates for our products from time to time. While we endeavour to test updates thoroughly, we make no representation that any update will be compatible with your specific hardware configuration or third-party components. Applying firmware or software updates is done at your own risk. We are not liable for any damage, data loss, device malfunction, or loss of functionality arising from the application of a firmware or software update, except to the extent required by the Australian Consumer Law. You should back up your device settings and data before applying any update.</p>
        <p style={s.p}><strong>Security, Penetration-Testing, and Similar Dual-Use Tools.</strong> Some software we provide is designed for security research, penetration testing, network diagnostics, or other purposes that could be misused to gain unauthorised access to systems or data ('Security Tools'). Security Tools are supplied <strong>strictly for use on systems and networks you own, or for which you hold the explicit, documented authorisation of the owner</strong> (for example, a signed penetration-testing engagement letter or scope agreement). You must comply with the <em>Criminal Code Act 1995</em> (Cth), the <em>Cybercrime Act 2001</em> (Cth), and all other applicable Commonwealth, state, and territory laws governing computer access, and the equivalent laws of any other jurisdiction in which you use the Security Tool.</p>
        <p style={s.p}>You warrant that you will not use any Security Tool to access, damage, intercept, or interfere with any system, network, account, or data without proper authorisation, or for any other unlawful, unethical, or fraudulent purpose. Using a Security Tool against a system without authorisation is a criminal offence in Australia and most other jurisdictions, and we treat it as a serious breach of these Legal Terms.</p>
        <p style={s.p}><strong>Reporting and Disclosure.</strong> If we reasonably suspect that a Security Tool we have supplied is being, or has been, used for an unauthorised, unlawful, or malicious purpose, we reserve the right to report the matter — including disclosing your personal information, purchase records, and any other relevant details — to law enforcement, a relevant regulator, or an affected third party, without further notice to you. This is in addition to, and does not limit, any other rights we have under our Privacy Policy or applicable law to disclose information where required or permitted.</p>
        <p style={s.p}><strong>No Liability for Misuse.</strong> To the fullest extent permitted by law, we are not liable for any loss, damage, claim, fine, penalty, or legal liability arising from your use, or any other person's use, of a Security Tool for any illegal, unethical, or immoral purpose, or otherwise outside the scope of your documented authorisation. You indemnify us against any claim, loss, or liability arising from such use. Nothing in this clause excludes any consumer guarantee that cannot lawfully be excluded under the Australian Consumer Law.</p>
      </div>
      <div style={s.mt}><h3>9A. AI Assistant</h3>
        <p style={s.p}>Where we provide an AI-powered chat or assistant feature ('AI Assistant'), your messages and related data may be transmitted to and processed by a third-party AI service provider in order to generate a response. Do not submit sensitive personal information, payment card details, or confidential information to the AI Assistant.</p>
        <p style={s.p}><strong>No Professional Advice; Accuracy Not Guaranteed.</strong> Responses from the AI Assistant are generated automatically and may be inaccurate, incomplete, outdated, or entirely fabricated. They do not constitute professional, technical, electrical, legal, or safety advice, and must not be relied upon as a substitute for advice from a qualified professional — particularly for anything involving mains-voltage electricity, lithium battery handling, or safety-critical applications. You are solely responsible for independently verifying any information provided by the AI Assistant before acting on it.</p>
        <p style={s.p}><strong>Acceptable Use.</strong> You must not use the AI Assistant to generate, request, or attempt to extract content that is illegal, that facilitates unauthorised access to computer systems, that infringes a third party's intellectual property, or that otherwise breaches our Acceptable Use Policy. We may log, monitor, and review AI Assistant interactions to enforce this Policy and may suspend your access to the AI Assistant for breach, without notice.</p>
        <p style={s.p}><strong>No Liability.</strong> To the fullest extent permitted by law, we are not liable for any loss or damage arising from your reliance on AI Assistant output, including inaccurate information, code, or technical guidance. Nothing in this clause excludes any consumer guarantee that cannot lawfully be excluded under the Australian Consumer Law.</p>
      </div>
      <div style={s.mt}><h3>10. Repair and Technical Services</h3>
        <p style={s.p}><strong>Scope — ELV/LV Equipment Only.</strong> Our Repair Services are limited to Extra Low Voltage (ELV, ≤50 V AC / ≤120 V DC) and Low Voltage (LV) equipment. We do not perform repairs on mains-connected (240 V AC) devices and we are not licensed to do so. Any device submitted for repair that is found to contain mains-voltage components beyond our scope will not be worked on; we will advise you and return the device. Where we provide repair, diagnostic, or technical services within our scope ('Repair Services'), the following additional terms apply alongside your rights under the Australian Consumer Law. By submitting a device for Repair Services, you agree to these terms.</p>
        <p style={s.p}><strong>How to Submit a Device.</strong> We operate as a mobile service — we do not have a public shopfront. Devices may be submitted in one of three ways: (a) <strong>mail-in</strong> — you may post your device to our returns address at any time without prior arrangement (please include your name, contact details, and a description of the fault); (b) <strong>on-site service</strong> — we can attend your location by appointment; or (c) <strong>drop-off by appointment</strong> — contact us first to arrange a time. Devices sent by post should be packed securely; we are not liable for damage caused by inadequate packaging in transit to us.</p>
        <p style={s.p}><strong>Pre-Repair Quote.</strong> We will conduct an initial assessment of your device and provide a written quote before commencing any chargeable repair. Quotes are valid for 14 days from the date of issue unless otherwise stated. We reserve the right to vary a quote if additional faults are discovered during repair that were not apparent at the time of assessment; we will notify you and obtain your approval before proceeding with any work beyond the agreed scope.</p>
        <p style={s.p}><strong>Pre-Existing Conditions and Undisclosed Damage.</strong> You warrant that, to the best of your knowledge, you have disclosed all known damage, faults, modifications, liquid exposure, and relevant history at the time of submission. We are not liable for any damage, deterioration, or failure caused by pre-existing conditions, undisclosed damage, prior unauthorised repairs, manufacturing defects, or latent faults that were present before submission. Where a pre-existing condition is discovered during repair, we will advise you before proceeding.</p>
        <p style={s.p}><strong>No Liability for Consequential Failure.</strong> Electronic devices may contain multiple faults not apparent during or immediately after repair. To the fullest extent permitted by applicable law, we are not liable for any loss, damage, fire, personal injury, or adverse outcome caused by: (a) a fault that was not the subject of the agreed repair; (b) faults that manifest after repair as a result of pre-existing conditions; or (c) the customer's subsequent use of the device inconsistently with our repair instructions or manufacturer specifications. These limitations do not limit your rights under the Australian Consumer Law in respect of our Repair Services.</p>
        <p style={s.p}><strong>Repair Warranty.</strong> Subject to the exclusions set out in these terms, we provide a <strong>90-day warranty on parts and labour</strong> for completed repair work. This warranty covers the specific fault addressed in the agreed repair and does not extend to other components, pre-existing conditions, or damage caused by subsequent misuse or further modification. The repair warranty is voided if the device is further modified, damaged, or repaired by a third party after our repair. This warranty is in addition to your rights under the Australian Consumer Law, which cannot be excluded.</p>
        <p style={s.p}><strong>Customer Data and Software.</strong> You are solely responsible for backing up all data, software, settings, and personal information stored on your device before submitting it for Repair Services. We take reasonable care but are not liable for any loss, alteration, or corruption of data or software that occurs in connection with Repair Services, whether arising from negligence or otherwise.</p>
        <p style={s.p}><strong>Safety-Critical Findings.</strong> If during the course of repair we identify a condition that, in our reasonable opinion, presents a risk of fire, electric shock, explosion, or other serious safety hazard, we reserve the right to: (a) decline to return the device to service until the safety issue is addressed; (b) require written acknowledgment of the risk before collection; or (c) advise you to have the device assessed by a licensed electrician or other qualified professional before use. We are not liable for any loss arising from our reasonable refusal to return an unsafe device to service.</p>
        <p style={s.p}><strong>Uncollected Devices.</strong> If you fail to collect your device or respond to our communications within 90 days of being notified that it is ready (or that repair has been declined), we reserve the right to dispose of the device responsibly. We will make at least two attempts to contact you before disposal. No compensation is payable for any device disposed of under this clause.</p>
        <p style={s.p}><strong>Devices Beyond Economical Repair.</strong> If the estimated cost of repair exceeds the assessed fair market value of the device, we will advise you. You may choose to proceed with repair at the quoted cost, collect the device (a diagnostic fee may apply), or authorise disposal. We are not liable for consequential loss arising from a device being assessed as beyond economical repair.</p>
      </div>
      <div style={s.mt}><h3>11. Prohibited Activities</h3>
        <p style={s.p}>You agree not to:</p>
        <ul style={{paddingLeft:20, lineHeight:2, marginTop:8}}>
          <li>Compile collections of our content without written permission.</li>
          <li>Trick, defraud, or mislead us or other users.</li>
          <li>Circumvent security features of the Services.</li>
          <li>Harm, disparage, or tarnish us or the Services.</li>
          <li>Harass, abuse, or harm any person using information from the Services.</li>
          <li>Submit false reports of abuse or misconduct.</li>
          <li>Use the Services in violation of any applicable law or regulation.</li>
          <li>Upload viruses, Trojan horses, or other disruptive material.</li>
          <li>Use bots, scrapers, or automated data-gathering tools.</li>
          <li>Impersonate another user or person.</li>
          <li>Interfere with or disrupt the Services or connected networks.</li>
          <li>Copy or adapt the Services' source code.</li>
          <li>Collect user email addresses for unsolicited communications.</li>
          <li>Use the Services for commercial competition against us.</li>
          <li>Sell or transfer your profile.</li>
        </ul>
      </div>
      <div style={s.mt}><h3>12. User Generated Contributions</h3>
        <p style={s.p}>You warrant that your Contributions: do not infringe third-party rights; are not false, misleading, or spam; are not obscene, violent, or harassing; do not violate any law; and do not include offensive comments about race, gender, sexual preference, or disability.</p>
      </div>
      <div style={s.mt}><h3>13. Contribution Licence</h3><p style={s.p}>By posting Contributions you grant us an irrevocable, royalty-free, worldwide licence to use, reproduce, distribute, and exploit them for any purpose. You retain ownership of your Contributions. We may edit, re-categorise, or delete Contributions at any time without notice.</p></div>
      <div style={s.mt}><h3>14. Guidelines for Reviews</h3><p style={s.p}>Reviews must reflect firsthand experience and may not contain offensive language, discriminatory references, illegal activity, or false statements. We may remove reviews at our discretion. Reviews do not represent our views.</p></div>
      <div style={s.mt}><h3>15. Third-Party Websites and Content</h3><p style={s.p}>We are not responsible for third-party websites or content linked from or available through the Services. Inclusion of any third-party link does not imply endorsement. You hold us blameless from any harm arising from your use of third-party websites or content.</p></div>
      <div style={s.mt}><h3>16. Services Management</h3><p style={s.p}>We may monitor the Services for violations, take legal action against violators, restrict or disable Contributions, remove burdensome content, and otherwise manage the Services to protect our rights and ensure proper functioning.</p></div>
      <div style={s.mt}><h3>17. Privacy Policy</h3><p style={s.p}>We care about data privacy. Please review our Privacy Policy available on this site. By using the Services you agree to be bound by our Privacy Policy. The Services are hosted in Australia.</p></div>
      <div style={s.mt}><h3>18. Term and Termination</h3><p style={s.p}>These Legal Terms remain in effect while you use the Services. We may deny access, terminate your account, or remove your content at any time without warning. If terminated, you may not re-register under any name without our permission.</p></div>
      <div style={s.mt}><h3>19. Modifications and Interruptions</h3><p style={s.p}>We may change, modify, or remove content from the Services at any time without notice. We are not liable for any modification, suspension, or discontinuance of the Services, nor for any downtime or service interruptions.</p></div>
      <div style={s.mt}><h3>20. Governing Law</h3>
        <p style={s.p}>These Legal Terms and any dispute or claim arising out of or in connection with them (including non-contractual disputes or claims) are governed by and construed in accordance with the laws of Queensland, Australia, without regard to conflict of law principles. To the extent court proceedings are permitted under these Legal Terms, each party irrevocably submits to the exclusive jurisdiction of the courts of Queensland, Australia.</p>
      </div>
      <div style={s.mt}><h3>21. Dispute Resolution</h3>
        <p style={s.p}><strong>Mandatory Pre-Litigation Notice.</strong> Before commencing any legal proceedings (including arbitration) against Outback Electronics, you must provide written notice to us at <a href={`mailto:${email}`}>{email}</a> describing: (a) the nature of your claim in reasonable detail; (b) the specific relief sought; and (c) your contact details. We will have sixty (60) days from receipt of such notice to attempt to resolve the dispute informally. No proceedings may be commenced until this 60-day period has expired without resolution. This requirement is a condition precedent to any legal proceedings and, if not complied with, shall be raised as a complete defence to those proceedings.</p>
        <p style={s.p}><strong>Binding Arbitration.</strong> Subject to the exceptions below and to mandatory applicable law (including the Australian Consumer Law), any dispute, controversy, or claim arising out of or relating to these Legal Terms, the Services, or any breach, termination, or invalidity thereof, that is not resolved informally under the process above shall be finally settled by binding arbitration seated in Brisbane, Queensland, Australia. The arbitration shall be conducted by a single arbitrator agreed upon by the parties, or, failing agreement within 14 days, appointed by the Australian Centre for International Commercial Arbitration (ACICA). The substantive law of Queensland applies. The arbitration shall be conducted in English. The arbitral award shall be final and binding. Each party shall bear its own costs of arbitration unless the arbitrator orders otherwise. The existence and content of the arbitration shall be kept confidential except as required by law.</p>
        <p style={s.p}><strong>Exceptions to Arbitration.</strong> Either party may seek emergency or interim injunctive or equitable relief from a court of competent jurisdiction to prevent actual or threatened infringement, misappropriation, or violation of intellectual property rights, confidential information, or to prevent irreparable harm, without waiving the right to arbitrate the underlying dispute. Disputes that are within the jurisdiction of the Queensland Civil and Administrative Tribunal (QCAT) may be brought in that tribunal.</p>
        <p style={s.p}><strong>Waiver of Representative and Class Proceedings.</strong> To the maximum extent permitted by applicable law, you agree that any dispute resolution proceedings (whether in arbitration or in court, to the extent court proceedings are permitted) will be conducted only on an individual basis and not in a class, consolidated, or representative action. You waive any right to participate in any class, collective, coordinated, consolidated, or representative proceeding. Nothing in this clause limits rights you may have as a consumer under the Australian Consumer Law that cannot be waived by contract.</p>
        <p style={s.p}><strong>Limitation of Actions.</strong> To the maximum extent permitted by law, any claim or cause of action you may have arising out of or relating to the Services or these Legal Terms that does not arise under the Australian Consumer Law or other mandatory legislation must be commenced within one (1) year after the cause of action accrues. After that period, such claim or cause of action is permanently barred. Nothing in this clause limits time limits that cannot be contracted out of under applicable mandatory law.</p>
      </div>
      <div style={s.mt}><h3>22. Corrections</h3><p style={s.p}>We may correct typographical errors, inaccuracies, or omissions in our content at any time without prior notice. We are not liable for any reliance placed on content that is later corrected.</p></div>
      <div style={s.mt}><h3>23. Disclaimer and Assumption of Risk</h3>
        <p style={{...s.p, textTransform:'uppercase', fontSize:13}}>THE SERVICES ARE PROVIDED ON AN AS-IS AND AS-AVAILABLE BASIS WITHOUT ANY REPRESENTATION OR WARRANTY OF ANY KIND, WHETHER EXPRESS, IMPLIED, STATUTORY, OR OTHERWISE, INCLUDING BUT NOT LIMITED TO ANY WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, TITLE, NON-INFRINGEMENT, ACCURACY, RELIABILITY, OR COMPLETENESS. WE DO NOT WARRANT THAT THE SERVICES WILL BE UNINTERRUPTED, ERROR-FREE, SECURE, OR FREE OF VIRUSES OR OTHER HARMFUL COMPONENTS. YOUR USE OF THE SERVICES IS ENTIRELY AT YOUR OWN RISK.</p>
        <p style={s.p}><strong>Technical Information.</strong> Any technical information, advice, guides, tutorials, or recommendations made available through the Services (including the forum, repair guides, product descriptions, and our Repair Services) are provided for general informational purposes only and do not constitute professional engineering, electrical safety, or specialist advice. Our technical content relates exclusively to ELV (Extra Low Voltage, ≤50 V AC / ≤120 V DC) and LV equipment; nothing in the Services should be read as guidance for mains-voltage (240 V AC) work. You acknowledge that electronic repairs and modifications involve inherent and serious risks including, without limitation: <strong>electric shock capable of causing death or permanent serious injury; fire and explosion that may result in partial or complete property destruction (including damage to your home or premises); toxic gas release from damaged or mistreated battery cells; damage to connected equipment and infrastructure; personal injury; and voiding of manufacturer warranties</strong>. You should always consult a qualified professional before undertaking any electronic repair, modification, or installation, and must engage a licensed electrician for any mains-voltage work — which is outside our scope entirely. You assume all risk associated with acting on any technical information obtained through the Services and agree that we shall not be liable for any loss, damage, personal injury, serious bodily injury, death, fire, explosion, property damage (including total loss of property), or adverse outcome resulting from reliance on such information, to the fullest extent permitted by law.</p>
        <p style={s.p}><strong>No Reliance.</strong> You acknowledge that in agreeing to these Legal Terms you have not relied upon any representation, statement, promise, assurance, warranty, understanding, undertaking, or other matter that is not expressly set out in these Legal Terms. You waive any right or remedy based on such representations or matters.</p>
        <p style={s.p}><strong>Nothing in these Legal Terms excludes, restricts, or modifies any consumer guarantee, right, or remedy conferred by the Australian Consumer Law (Schedule 2 of the Competition and Consumer Act 2010 (Cth)) or any other applicable mandatory legislation that cannot lawfully be excluded.</strong></p>
      </div>
      <div style={s.mt}><h3>24. Limitations of Liability</h3>
        <p style={{...s.p, textTransform:'uppercase', fontSize:13}}>TO THE FULLEST EXTENT PERMITTED BY APPLICABLE LAW: (A) IN NO EVENT WILL OUTBACK ELECTRONICS, ITS DIRECTORS, EMPLOYEES, AGENTS, CONTRACTORS, LICENSORS, OR SERVICE PROVIDERS BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, EXEMPLARY, OR PUNITIVE DAMAGES, INCLUDING WITHOUT LIMITATION LOSS OF PROFITS, LOSS OF REVENUE, LOSS OF DATA, LOSS OF GOODWILL, BUSINESS INTERRUPTION, OR COST OF SUBSTITUTE SERVICES, WHETHER ARISING IN CONTRACT, TORT (INCLUDING NEGLIGENCE), STATUTE, OR OTHERWISE, EVEN IF WE HAVE BEEN ADVISED OF THE POSSIBILITY OF SUCH DAMAGES; AND (B) OUR TOTAL AGGREGATE LIABILITY TO YOU FOR ALL CLAIMS ARISING OUT OF OR RELATING TO THE SERVICES OR THESE LEGAL TERMS, REGARDLESS OF THE FORM OF THE ACTION, SHALL NOT EXCEED THE GREATER OF: (I) THE TOTAL AMOUNT ACTUALLY PAID BY YOU TO US IN THE THREE (3) MONTHS IMMEDIATELY PRECEDING THE EVENT GIVING RISE TO THE CLAIM; OR (II) ONE HUNDRED AUSTRALIAN DOLLARS (AUD $100.00).</p>
        <p style={s.p}><strong>Exclusive Remedy.</strong> The remedies set out in these Legal Terms are your sole and exclusive remedies in respect of any matter covered by these Legal Terms, to the maximum extent permitted by law.</p>
        <p style={s.p}><strong>These limitations do not apply to liability arising under the Australian Consumer Law or any other applicable mandatory law where such limitation or exclusion would be unlawful.</strong> Where our liability for failure to comply with a consumer guarantee cannot be excluded, it is limited (to the extent permitted by law) to: in the case of goods — repair, replacement, or refund of the purchase price; in the case of services — resupplying the services or paying the cost of having them resupplied.</p>
        <p style={s.p}><strong>Product Safety and Recalls.</strong> Nothing in these Legal Terms limits any obligation we may have under the <em>Competition and Consumer Act 2010</em> (Cth) or applicable product safety legislation in relation to product recalls, compulsory safety standards, or bans. If we become aware that a product we have supplied may be subject to a recall or poses a safety hazard, we will take steps to notify affected customers as required by law. You can check for current product recalls at the ACCC Product Safety website: <a href="https://www.productsafety.gov.au" target="_blank" rel="noopener noreferrer">www.productsafety.gov.au</a>.</p>
      </div>
      <div style={s.mt}><h3>25. Indemnification</h3>
        <p style={s.p}>You agree, to the fullest extent permitted by law, to defend, indemnify, and hold harmless Outback Electronics and its officers, directors, employees, agents, contractors, licensors, suppliers, and successors from and against any and all claims, liabilities, damages, judgments, awards, losses, costs, expenses, and fees (including reasonable legal costs) arising out of or relating to: (a) your Contributions; (b) your access to or use of the Services; (c) your breach of any of these Legal Terms; (d) your violation of any applicable law or regulation; (e) your violation of any third-party right, including any intellectual property right, privacy right, or proprietary right; or (f) any claim by a third party that your Contributions caused damage to that third party. This indemnification obligation survives termination of these Legal Terms and your use of the Services.</p>
      </div>
      <div style={s.mt}><h3>26. User Data</h3><p style={s.p}>We maintain data you transmit for managing the Services. You are solely responsible for all data you transmit. We are not liable for any loss, corruption, or unauthorised access to your data except to the extent required by the Privacy Act 1988 (Cth). You agree to maintain appropriate backups of any data important to you.</p></div>
      <div style={s.mt}><h3>27. Electronic Communications</h3><p style={s.p}>Visiting the Services, sending emails, and completing online forms constitute electronic communications. You consent to receive electronic communications and agree that all agreements, notices, disclosures, and other communications we provide electronically satisfy any legal requirement that such communications be in writing.</p></div>
      <div style={s.mt}><h3>28. Force Majeure</h3>
        <p style={s.p}>We will not be liable or responsible for any failure or delay in the performance of our obligations under these Legal Terms to the extent that such failure or delay is caused by or results from events beyond our reasonable control, including but not limited to: acts of God; natural disasters; pandemic or epidemic; acts of government or regulatory authority; war; civil unrest; terrorist acts; strikes or industrial action; power, internet, or telecommunications outages; or failure of third-party service providers. In such circumstances, we will notify you as soon as reasonably practicable and will resume performance as soon as reasonably possible.</p>
      </div>
      <div style={s.mt}><h3>29. Miscellaneous</h3>
        <p style={s.p}><strong>Entire Agreement.</strong> These Legal Terms, together with our Privacy Policy, Cookie Policy, Return Policy, Shipping Policy, Acceptable Use Policy, and any other policies posted on the Services, constitute the entire agreement between you and us with respect to the subject matter hereof and supersede all prior and contemporaneous agreements, representations, and understandings.</p>
        <p style={s.p}><strong>Severability.</strong> If any provision of these Legal Terms is held by a court or arbitrator to be invalid, illegal, or unenforceable, that provision shall be modified to the minimum extent necessary to make it enforceable, and the remainder of these Legal Terms shall continue in full force and effect.</p>
        <p style={s.p}><strong>No Waiver.</strong> Our failure to exercise or enforce any right or provision of these Legal Terms shall not constitute a waiver of such right or provision. Any waiver must be in writing signed by us to be effective.</p>
        <p style={s.p}><strong>Assignment.</strong> We may assign or transfer our rights and obligations under these Legal Terms at any time without your consent, including in connection with a merger, acquisition, or sale of assets. You may not assign your rights or obligations without our prior written consent. Any purported assignment without such consent is void.</p>
        <p style={s.p}><strong>Relationship of the Parties.</strong> No joint venture, partnership, employment, franchise, or agency relationship is created between you and us by these Legal Terms.</p>
        <p style={s.p}><strong>Survival.</strong> Provisions that by their nature should survive termination of these Legal Terms will survive, including without limitation sections relating to intellectual property, indemnification, disclaimer, limitation of liability, dispute resolution, and governing law.</p>
      </div>
      <div style={s.mt}><h3>30. Contact Us</h3>
        <p style={s.p}><strong>Outback Electronics</strong><br/>{address}, Australia<br/>Phone: <a href={`tel:${(phone||'').replace(/\s/g,'')}`}>{phone}</a><br/>Email: <a href={`mailto:${email}`}>{email}</a></p>
      </div>
      <hr className="thin" style={{marginTop:40}} />
      <div className="notice" style={{marginTop:24}}>
        <span className="tag tag-ink">QUESTIONS?</span>
        <div style={{fontSize:13, color:'var(--ink-2)'}}>Email <strong><a href={`mailto:${email}`}>{email}</a></strong> — we'll get back to you as soon as we can.</div>
      </div>
    </div>
  );
}

function PrivacyContent({ email, phone, address }) {
  const s = {mt: {marginTop:32}, p: {fontSize:15, lineHeight:1.75, marginTop:8}};
  return (
    <div>
      <span className="eyebrow">LEGAL · PRIVACY POLICY</span>
      <h2 style={{marginTop:8}}>Privacy Policy</h2>
      <p style={s.p}>This Privacy Notice for Outback Electronics ('we', 'us', or 'our') describes how and why we might access, collect, store, use, and/or share ('process') your personal information when you use our services ('Services'), including when you visit <a href="https://outbackelectronics.com.au">outbackelectronics.com.au</a> or engage with us in other related ways including sales, marketing, or events.</p>
      <p style={s.p}>Questions or concerns? Contact us at <a href={`mailto:${email}`}>{email}</a>.</p>

      <div style={s.mt}><h3>Summary of Key Points</h3>
        <ul style={{paddingLeft:20, lineHeight:2, marginTop:8}}>
          <li><strong>What personal information do we process?</strong> Information you provide when registering, making purchases, or contacting us.</li>
          <li><strong>Do we process sensitive personal information?</strong> No.</li>
          <li><strong>Do we collect information from third parties?</strong> No.</li>
          <li><strong>How do we process your information?</strong> To provide, improve, and administer our Services, communicate with you, prevent fraud, and comply with law.</li>
          <li><strong>How do we keep your information safe?</strong> We have appropriate organisational and technical measures in place, though no internet transmission is 100% secure.</li>
          <li><strong>What are your rights?</strong> Depending on your location, you may have rights to access, correct, or delete your personal information.</li>
        </ul>
      </div>

      <div style={s.mt}><h3>1. What Information Do We Collect?</h3>
        <p style={s.p}><strong>Personal information you disclose to us.</strong> We collect personal information that you voluntarily provide when you register, express an interest in our products or services, participate in activities, or contact us. This may include: names, phone numbers, email addresses, mailing addresses, usernames, passwords, contact preferences, and billing addresses.</p>
        <p style={s.p}><strong>Sensitive information.</strong> We do not process sensitive information.</p>
        <p style={s.p}><strong>Payment data.</strong> Payment data necessary to process purchases is handled and stored by Stripe. See Stripe's privacy notice at <a href="https://stripe.com/au/privacy" target="_blank" rel="noopener noreferrer">stripe.com/au/privacy</a>.</p>
        <p style={s.p}><strong>Information automatically collected.</strong> We automatically collect certain information when you visit the Services, including IP address, browser and device characteristics, operating system, language preferences, referring URLs, and usage data. We also collect information through cookies and similar technologies, including log data, device data, and approximate location data.</p>
      </div>

      <div style={s.mt}><h3>2. How Do We Process Your Information?</h3>
        <p style={s.p}>We process your personal information to:</p>
        <ul style={{paddingLeft:20, lineHeight:2, marginTop:8}}>
          <li>Facilitate account creation and authentication.</li>
          <li>Deliver services and fulfil orders.</li>
          <li>Respond to inquiries and offer support.</li>
          <li>Send administrative information and policy updates.</li>
          <li>Enable user-to-user communications.</li>
          <li>Protect individuals' vital interests and prevent harm.</li>
        </ul>
      </div>

      <div style={s.mt}><h3>3. What Legal Bases Do We Rely On?</h3>
        <p style={s.p}><strong>Australian residents:</strong> Australia's <em>Privacy Act 1988</em> (Cth) and the Australian Privacy Principles (APPs) do not prescribe 'legal bases' in the same manner as European law. Instead, they regulate the collection, use, and disclosure of personal information through the APPs. We collect personal information only where it is reasonably necessary for our functions or activities, and we handle it in accordance with the APPs. Where we rely on your consent (for example, for marketing communications), you may withdraw that consent at any time.</p>
        <p style={s.p}><strong>EU and UK residents:</strong> If you are located in the European Economic Area (EEA) or United Kingdom, the General Data Protection Regulation (GDPR) or UK GDPR applies to our processing of your personal information. Our legal bases for processing include: (a) performance of a contract with you; (b) our legitimate interests (e.g., fraud prevention and improving our Services) where not overridden by your interests; (c) compliance with legal obligations; and (d) your consent, where we have obtained it. You have the right to object to processing based on legitimate interests and to withdraw consent at any time without affecting the lawfulness of processing before withdrawal.</p>
      </div>

      <div style={s.mt}><h3>4. When and With Whom Do We Share Your Personal Information?</h3>
        <p style={s.p}>We may share your information in connection with: business transfers (e.g. merger or acquisition); use of Google Maps Platform APIs for location features; and with other users when you post public Contributions.</p>
      </div>

      <div style={s.mt}><h3>5. Do We Use Cookies and Other Tracking Technologies?</h3>
        <p style={s.p}>We may use cookies and similar tracking technologies (web beacons, pixels) to gather information, maintain security, save preferences, and assist with basic site functions. We also permit third parties such as Google Analytics to use tracking technologies for analytics purposes. You can opt out of Google Analytics at <a href="https://tools.google.com/dlpage/gaoptout" target="_blank" rel="noopener noreferrer">tools.google.com/dlpage/gaoptout</a>.</p>
      </div>

      <div style={s.mt}><h3>6. How Long Do We Keep Your Information?</h3>
        <p style={s.p}>We keep personal information only as long as necessary for the purposes outlined in this notice, or as required by applicable law, whichever is longer. Indicative retention periods are:</p>
        <ul style={{paddingLeft:20, lineHeight:2, marginTop:8}}>
          <li><strong>Order and transaction records:</strong> 7 years from the date of transaction (required under Australian taxation law).</li>
          <li><strong>Customer account data:</strong> For the duration of your account, and for up to 2 years following account closure or last activity.</li>
          <li><strong>Forum and community posts:</strong> Until deleted by you or by us in accordance with our Acceptable Use Policy and applicable law. Deleted posts may be retained in backup systems for up to 90 days.</li>
          <li><strong>Marketing preferences and consent records:</strong> Until you withdraw consent or unsubscribe, plus a reasonable period thereafter (generally up to 3 years) to maintain a suppression record and demonstrate compliance.</li>
          <li><strong>Repair service records:</strong> 7 years from completion (for taxation and warranty purposes).</li>
          <li><strong>Support and complaint records:</strong> Up to 5 years from resolution, or as required by law.</li>
        </ul>
        <p style={s.p}>When personal information is no longer required, we delete or irreversibly de-identify it. Some information may be retained in aggregated, anonymised form for analytics or business planning purposes and is no longer treated as personal information once de-identified.</p>
      </div>

      <div style={s.mt}><h3>7. How Do We Keep Your Information Safe?</h3>
        <p style={s.p}>We have implemented appropriate technical and organisational security measures. However, no electronic transmission over the internet is guaranteed 100% secure. Transmission of personal information to and from our Services is at your own risk.</p>
      </div>

      <div style={s.mt}><h3>8. Do We Collect Information from Minors?</h3>
        <p style={s.p}>We do not knowingly collect data from or market to children under 18. If we learn such data has been collected, we will deactivate the account and delete the data. Contact us at <a href={`mailto:${email}`}>{email}</a> if you become aware of any such data.</p>
      </div>

      <div style={s.mt}><h3>9. What Are Your Privacy Rights?</h3>
        <p style={s.p}>Depending on your location, you may have the right to: request access to and a copy of your personal information; request rectification or erasure; restrict processing; data portability; and object to processing. You can also opt out of marketing communications at any time via the unsubscribe link in our emails or by contacting us.</p>
        <p style={s.p}>To review or change your account information, log in to your account settings at <a href="/account/my-account">outbackelectronics.com.au/account/my-account</a>. Questions? Email us at <a href={`mailto:${email}`}>{email}</a>.</p>
      </div>

      <div style={s.mt}><h3>10. Controls for Do-Not-Track Features</h3>
        <p style={s.p}>We do not currently respond to DNT browser signals, as no uniform technology standard for DNT has been finalised. If a standard is adopted, we will update this notice accordingly.</p>
      </div>

      <div style={s.mt}><h3>11. Do United States Residents Have Specific Privacy Rights?</h3>
        <p style={s.p}>Residents of certain US states may have additional rights regarding personal information. We have not collected, sold, or shared any personal information to third parties for commercial purposes in the preceding twelve months, and we do not intend to do so. US residents may have rights including: right to know, access, correct, delete, and obtain a copy of their data; right to non-discrimination; and right to opt out of targeted advertising or profiling.</p>
        <p style={s.p}>To exercise these rights, visit <a href="/account/my-account">outbackelectronics.com.au/account/my-account</a> or email <a href={`mailto:${email}`}>{email}</a>.</p>
      </div>

      <div style={s.mt}><h3>12. Do Other Regions Have Specific Privacy Rights?</h3>
        <p style={s.p}><strong>Australia:</strong> We collect and process your personal information in accordance with Australia's <em>Privacy Act 1988</em> (Cth) and the Australian Privacy Principles (APPs) contained in that Act. You have the right to request access to or correction of your personal information at any time by contacting us. We will respond to access and correction requests within 30 days.</p>
        <p style={s.p}><strong>Notifiable Data Breaches:</strong> We are subject to the Notifiable Data Breaches (NDB) scheme under Part IIIC of the <em>Privacy Act 1988</em>. If we experience a data breach that is likely to result in serious harm to you, we will notify the Office of the Australian Information Commissioner (OAIC) and affected individuals as required by law.</p>
        <p style={s.p}>If you believe we are handling your personal information in breach of the Australian Privacy Principles, you may submit a complaint first to us (we will respond within 30 days), and thereafter to the OAIC at <a href="https://www.oaic.gov.au" target="_blank" rel="noopener noreferrer">www.oaic.gov.au</a>.</p>
        <p style={s.p}><strong>Cross-Border Disclosure:</strong> We may disclose your personal information to overseas recipients (for example, Stripe for payment processing, and Google Analytics for analytics). Where we do so, we take reasonable steps to ensure the recipient handles your information consistently with the APPs. By using our Services, you consent to such cross-border disclosure in accordance with APP 8.</p>
        <p style={s.p}><strong>Spam Act 2003 (Cth):</strong> All commercial electronic messages (including marketing emails and SMS messages) sent by us comply with the <em>Spam Act 2003</em> (Cth). Such messages will only be sent to recipients who have provided express or inferred consent, will clearly identify us as the sender, and will contain a functioning unsubscribe mechanism. We will honour all unsubscribe requests within 5 business days of receipt. You may unsubscribe at any time by clicking the unsubscribe link in any commercial message or by contacting us at <a href={`mailto:${email}`}>{email}</a>. Unsubscribing from marketing communications does not affect transactional communications related to orders or account activity.</p>
        <p style={s.p}><strong>Do Not Call Register:</strong> We respect the <em>Do Not Call Register Act 2006</em> (Cth). If you have registered your telephone number on the Australian Do Not Call Register, we will not make unsolicited telemarketing calls to that number.</p>
      </div>

      <div style={s.mt}><h3>13. Do We Make Updates to This Notice?</h3>
        <p style={s.p}>Yes. We may update this Privacy Notice from time to time to reflect changes in our practices, legal requirements, or for other operational reasons. The updated version will be indicated by an updated date at the top of this page. Material changes will be communicated to registered users via email where practicable. We encourage you to review this notice frequently.</p>
      </div>

      <div style={s.mt}><h3>14. How Can You Review, Update, or Delete Your Data?</h3>
        <p style={s.p}>To request to review, update, or delete your personal information, visit: <a href="/account/my-account">outbackelectronics.com.au/account/my-account</a></p>
      </div>

      <div style={s.mt}><h3>15. How Can You Contact Us About This Notice?</h3>
        <p style={s.p}><strong>Outback Electronics</strong><br/>{address}, Australia<br/>Phone: <a href={`tel:${(phone||'').replace(/\s/g,'')}`}>{phone}</a><br/>Email: <a href={`mailto:${email}`}>{email}</a></p>
      </div>

      <hr className="thin" style={{marginTop:40}} />
      <div className="notice" style={{marginTop:24}}>
        <span className="tag tag-ink">QUESTIONS?</span>
        <div style={{fontSize:13, color:'var(--ink-2)'}}>Email <strong><a href={`mailto:${email}`}>{email}</a></strong> — we'll get back to you as soon as we can.</div>
      </div>
    </div>
  );
}

function ShippingContent({ email }) {
  const s = {mt: {marginTop:32}, p: {fontSize:15, lineHeight:1.75, marginTop:8}};
  return (
    <div>
      <span className="eyebrow">LEGAL · SHIPPING & DELIVERY POLICY</span>
      <h2 style={{marginTop:8}}>Shipping & Delivery Policy</h2>
      <p style={s.p}>This Shipping & Delivery Policy is part of our Terms and Conditions and should be read alongside our main Terms at <a href="/policies/terms-and-conditions" onClick={e => { e.preventDefault(); window.history.pushState({}, '', '/policies/terms-and-conditions'); window.dispatchEvent(new PopStateEvent('popstate')); }}>outbackelectronics.com.au/policies/terms-and-conditions</a>.</p>
      <p style={s.p}>Please carefully review our Shipping & Delivery Policy when purchasing our products. This policy will apply to any order you place with us.</p>
      <p style={s.p}><strong>Australian Consumer Law:</strong> Nothing in this policy affects your rights as a consumer under the Australian Consumer Law. Our goods come with guarantees that cannot be excluded, including the guarantee that goods will be delivered within a reasonable time where no specific delivery date is agreed. For remote sales to consumers, the risk of loss of or damage to goods remains with us until the goods are delivered to you (or to a carrier nominated by you other than one we arranged).</p>
      <p style={{...s.p, padding:'14px 18px', background:'var(--bg-elev)', border:'1px solid var(--line)', borderRadius:6}}><strong>Third-Party Seller Orders:</strong> Outback Electronics is a marketplace. Products sold by third-party sellers are dispatched directly by the seller from their own location. The sender name and address on the parcel will be the seller's — not Outback Electronics. If you are unsure who dispatched your order, check your order confirmation email. For any delivery issue with a third-party seller order, contact us at <a href={`mailto:${email}`}>{email}</a> and we will assist you in reaching the seller.</p>

      <div style={s.mt}><h3>What Are My Shipping & Delivery Options?</h3>
        <p style={s.p}>We currently offer the following shipping options:</p>
        <ul style={{paddingLeft:20, lineHeight:2, marginTop:8}}>
          <li>Standard Shipping (Australia Post, typically 2–8 business days within Australia)</li>
          <li>Express Shipping (Australia Post Express, typically 1–3 business days within Australia)</li>
        </ul>
        <p style={s.p}>All times and dates given for delivery are estimates only and are given in good faith. We are not liable for delays caused by Australia Post, customs, or circumstances beyond our control, though we will keep you informed of any significant delay.</p>
        <p style={s.p}><em>For EU and UK consumers:</em> This does not affect your statutory rights. Unless specifically noted, estimated delivery times reflect the earliest available delivery, and deliveries will be made within 30 days after the day we accept your order. If we are unable to deliver within that period, you are entitled to cancel your order and receive a full refund.</p>
      </div>

      <div style={s.mt}><h3>Do You Deliver Internationally?</h3>
        <p style={s.p}>We offer international shipping to the following countries:</p>
        <ul style={{paddingLeft:20, lineHeight:2, marginTop:8}}>
          <li>Australia</li>
          <li>United Kingdom</li>
          <li>United States</li>
        </ul>
        <p style={s.p}>Free shipping is not valid on international orders.</p>
        <p style={s.p}>We may be subject to various rules and restrictions in relation to some international deliveries and you may be subject to additional taxes and duties over which we have no control. You are responsible for complying with the laws applicable to the country where you live and for any such additional costs or taxes.</p>
      </div>

      <div style={s.mt}><h3>Are There Other Shipping Restrictions?</h3>
        <p style={s.p}><strong>Lithium and Regulated Batteries.</strong> Lithium-ion, lithium-polymer, and certain other battery chemistries are classified as dangerous goods under the International Air Transport Association (IATA) Dangerous Goods Regulations, the International Civil Aviation Organization (ICAO) Technical Instructions, and the Civil Aviation Safety Authority (CASA) regulations for domestic Australian air freight. We do not offer air shipping for standalone batteries or battery-containing products that do not comply with applicable dangerous-goods transport requirements (including applicable watt-hour limits, packaging requirements, and state-of-charge restrictions). Standard ground shipping (Australia Post road network) may remain available for compliant battery products. If you are re-shipping or transporting batteries purchased from us, you are responsible for complying with all applicable dangerous-goods regulations in your jurisdiction.</p>
        <p style={s.p}><strong>Other Dangerous Goods.</strong> We do not ship items classified as dangerous goods (including certain chemicals, flammable liquids, compressed gases, aerosols, or other regulated materials) to international destinations or via air freight unless specifically permitted under applicable regulations. If your order contains restricted items, we will contact you before dispatch to discuss available shipping options or, if no compliant option exists, to cancel and refund that item.</p>
      </div>

      <div style={s.mt}><h3>What Happens If My Order Is Delayed?</h3>
        <p style={s.p}>If delivery is delayed for any reason we will let you know as soon as possible and will advise you of a revised estimated delivery date.</p>
        <p style={s.p}><em>For EU and UK consumers:</em> This does not affect your statutory rights.</p>
      </div>

      <div style={s.mt}><h3>What If My Order Is Lost or Missing?</h3>
        <p style={s.p}>If your tracking information has not updated for more than 5 business days, or if it has been more than 5 business days past the estimated delivery date with no delivery, please contact us at <a href={`mailto:${email}`}>{email}</a> with your order number and tracking details. We will raise an enquiry with Australia Post or the relevant carrier on your behalf.</p>
        <p style={s.p}>Where an order is confirmed as lost in transit, we will offer you a replacement or a full refund at your election, subject to stock availability for replacements. We will lodge any carrier claim on your behalf — you do not need to deal with the carrier directly.</p>
        <p style={s.p}><strong>Signature on Delivery.</strong> High-value orders may be dispatched with a signature-on-delivery requirement. If no one is available to sign at the time of delivery, a card will be left for redelivery or post office collection. We are not liable for packages left at an unattended delivery address where the carrier has confirmed delivery as per the applicable service terms and no signature was required.</p>
        <p style={s.p}><strong>Incorrect Delivery Address.</strong> You are responsible for providing a correct and complete delivery address at the time of order. We are not liable for delayed or failed delivery caused by an address error provided by you. If you notice an error immediately after placing your order, contact us at <a href={`mailto:${email}`}>{email}</a> as soon as possible; we will endeavour to correct it before dispatch but cannot guarantee we can do so.</p>
        <p style={s.p}><em>For EU and UK consumers:</em> Risk of loss or damage to goods passes to you upon delivery. This does not affect your statutory rights.</p>
      </div>

      <div style={s.mt}><h3>Questions About Returns?</h3>
        <p style={s.p}>If you have questions about returns, please review our Return Policy available on this site.</p>
      </div>

      <div style={s.mt}><h3>How Can You Contact Us?</h3>
        <p style={s.p}>If you have any questions about this policy, please contact us at <a href={`mailto:${email}`}>{email}</a>.</p>
      </div>

      <hr className="thin" style={{marginTop:40}} />
      <div className="notice" style={{marginTop:24}}>
        <span className="tag tag-ink">QUESTIONS?</span>
        <div style={{fontSize:13, color:'var(--ink-2)'}}>Email <strong><a href={`mailto:${email}`}>{email}</a></strong> — we'll get back to you as soon as we can.</div>
      </div>
    </div>
  );
}

function CookieContent({ email }) {
  const s = {mt: {marginTop:32}, p: {fontSize:15, lineHeight:1.75, marginTop:8}};
  const cookieRow = (name, purpose, type, expires) => (
    <div style={{borderTop:'1px solid var(--line)', padding:'12px 0', display:'grid', gridTemplateColumns:'160px 1fr', gap:'4px 16px', fontSize:14}}>
      <span className="mono" style={{fontSize:12, color:'var(--rust)', gridColumn:'1/-1', marginBottom:4}}>{name}</span>
      {purpose && <><span style={{color:'var(--ink-2)'}}>Purpose</span><span>{purpose}</span></>}
      <span style={{color:'var(--ink-2)'}}>Type</span><span className="mono" style={{fontSize:12}}>{type}</span>
      <span style={{color:'var(--ink-2)'}}>Expires</span><span>{expires}</span>
    </div>
  );
  return (
    <div>
      <span className="eyebrow">LEGAL · COOKIE POLICY</span>
      <h2 style={{marginTop:8}}>Cookie Policy</h2>
      <p style={s.p}>This Cookie Policy explains how Outback Electronics ('Company', 'we', 'us', and 'our') uses cookies and similar technologies to recognise you when you visit our website at <a href="https://outbackelectronics.com.au">outbackelectronics.com.au</a> ('Website'). It explains what these technologies are and why we use them, as well as your rights to control our use of them.</p>
      <p style={s.p}>In some cases we may use cookies to collect personal information, or that becomes personal information if we combine it with other information.</p>

      <div style={s.mt}><h3>What Are Cookies?</h3>
        <p style={s.p}>Cookies are small data files placed on your computer or mobile device when you visit a website. Cookies are widely used by website owners to make their websites work, or work more efficiently, as well as to provide reporting information.</p>
        <p style={s.p}>Cookies set by the website owner are called 'first-party cookies.' Cookies set by parties other than the website owner are called 'third-party cookies.' Third-party cookies enable third-party features or functionality to be provided on or through the website (e.g. analytics). The parties that set these third-party cookies can recognise your computer both when it visits this website and also when it visits certain other websites.</p>
      </div>

      <div style={s.mt}><h3>Why Do We Use Cookies?</h3>
        <p style={s.p}>We use first- and third-party cookies for several reasons. Some cookies are required for technical reasons in order for our Website to operate — we refer to these as 'essential' or 'strictly necessary' cookies. Other cookies enable us to track and target the interests of our users to enhance their experience. Third parties serve cookies through our Website for analytics and other purposes.</p>
      </div>

      <div style={s.mt}><h3>How Can I Control Cookies?</h3>
        <p style={s.p}>You have the right to decide whether to accept or reject cookies. You can set or amend your web browser controls to accept or refuse cookies. If you choose to reject cookies, you may still use our website though your access to some functionality and areas may be restricted.</p>
      </div>

      <div style={s.mt}><h3>Essential Website Cookies</h3>
        <p style={s.p}>These cookies are strictly necessary to provide you with services available through our Website, such as maintaining your login session and protecting against cross-site request forgery.</p>
        {cookieRow('oe_admin_session', 'Maintains your admin login session', 'server_cookie (HttpOnly, SameSite=Strict)', '8 hours')}
        {cookieRow('oe_portal_session', 'Maintains your customer portal and forum login session', 'server_cookie (HttpOnly, SameSite=Strict)', '30 days')}
        {cookieRow('_csrf', 'Protects against Cross-Site Request Forgery (CSRF) attacks', 'server_cookie (SameSite=Strict)', '24 hours')}
      </div>

      <div style={s.mt}><h3>Performance and Functionality</h3>
        <p style={s.p}>We store your shopping cart locally in your browser to preserve it between visits. This data never leaves your device unless you proceed to checkout.</p>
        {cookieRow('oe_cart', 'Stores your shopping cart items between visits', 'localStorage (client-side only)', 'Persistent until cleared')}
      </div>

      <div style={s.mt}><h3>Analytics Cookies</h3>
        <p style={s.p}>We may use Google Analytics to understand how visitors interact with our Website. Google Analytics uses cookies to collect information such as how often users visit the site, what pages they visit, and what other sites they used prior to coming to our site. You can opt out of Google Analytics tracking at <a href="https://tools.google.com/dlpage/gaoptout" target="_blank" rel="noopener noreferrer">tools.google.com/dlpage/gaoptout</a>.</p>
      </div>

      <div style={s.mt}><h3>How Can I Control Cookies on My Browser?</h3>
        <p style={s.p}>The means by which you can refuse cookies vary from browser to browser. Please visit your browser's help menu for more information. Links for the most popular browsers:</p>
        <ul style={{paddingLeft:20, lineHeight:2, marginTop:8}}>
          <li><a href="https://support.google.com/chrome/answer/95647" target="_blank" rel="noopener noreferrer">Chrome</a></li>
          <li><a href="https://support.microsoft.com/en-us/windows/delete-and-manage-cookies-168dab11-0753-043d-7c16-ede5947fc64d" target="_blank" rel="noopener noreferrer">Internet Explorer / Edge</a></li>
          <li><a href="https://support.mozilla.org/en-US/kb/cookies-information-websites-store-on-your-computer" target="_blank" rel="noopener noreferrer">Firefox</a></li>
          <li><a href="https://support.apple.com/en-au/guide/safari/sfri11471/mac" target="_blank" rel="noopener noreferrer">Safari</a></li>
          <li><a href="https://help.opera.com/en/latest/web-preferences/" target="_blank" rel="noopener noreferrer">Opera</a></li>
        </ul>
        <p style={s.p}>In addition, most advertising networks offer a way to opt out of targeted advertising. For more information please visit:</p>
        <ul style={{paddingLeft:20, lineHeight:2, marginTop:8}}>
          <li><a href="https://optout.aboutads.info/" target="_blank" rel="noopener noreferrer">Digital Advertising Alliance</a></li>
          <li><a href="https://youradchoices.ca/" target="_blank" rel="noopener noreferrer">Digital Advertising Alliance of Canada</a></li>
          <li><a href="https://www.youronlinechoices.eu/" target="_blank" rel="noopener noreferrer">European Interactive Digital Advertising Alliance</a></li>
        </ul>
      </div>

      <div style={s.mt}><h3>What About Other Tracking Technologies?</h3>
        <p style={s.p}>Cookies are not the only way to recognise or track visitors. We may use other similar technologies from time to time, like web beacons (sometimes called 'tracking pixels' or 'clear gifs'). These are tiny graphics files that contain a unique identifier that enables us to recognise when someone has visited our Website or opened an email. In many instances, these technologies are reliant on cookies to function properly, and so declining cookies will impair their functioning.</p>
      </div>

      <div style={s.mt}><h3>Do You Serve Targeted Advertising?</h3>
        <p style={s.p}>Third parties may serve cookies on your computer or mobile device to serve advertising through our Website. These companies may use information about your visits to this and other websites to provide relevant advertisements about goods and services you may be interested in. The information collected through this process does not enable us or them to identify your name, contact details, or other personally identifying information unless you choose to provide these.</p>
      </div>

      <div style={s.mt}><h3>How Often Will You Update This Cookie Policy?</h3>
        <p style={s.p}>We may update this Cookie Policy from time to time to reflect changes to the cookies we use or for other operational, legal, or regulatory reasons. Please revisit this Cookie Policy regularly to stay informed. The date at the top of this Cookie Policy indicates when it was last updated.</p>
      </div>

      <div style={s.mt}><h3>Where Can I Get Further Information?</h3>
        <p style={s.p}>If you have any questions about our use of cookies or other technologies, please contact us at <a href={`mailto:${email}`}>{email}</a>.</p>
      </div>

      <hr className="thin" style={{marginTop:40}} />
      <div className="notice" style={{marginTop:24}}>
        <span className="tag tag-ink">QUESTIONS?</span>
        <div style={{fontSize:13, color:'var(--ink-2)'}}>Email <strong><a href={`mailto:${email}`}>{email}</a></strong> — we'll get back to you as soon as we can.</div>
      </div>
    </div>
  );
}

function ReturnContent({ email, phone, address }) {
  const s = {mt: {marginTop:32}, p: {fontSize:15, lineHeight:1.75, marginTop:8}};
  return (
    <div>
      <span className="eyebrow">LEGAL · RETURN POLICY</span>
      <h2 style={{marginTop:8}}>Return Policy</h2>
      <p style={s.p}>Thank you for your purchase. We hope you are happy with it. However, if you are not completely satisfied for any reason, you may return it for a full refund or exchange. Please see below for more information on your rights and our process.</p>
      <p style={{...s.p, padding:'14px 18px', background:'var(--bg-elev)', border:'1px solid var(--line)', borderRadius:6}}><strong>Third-Party Seller Products:</strong> Outback Electronics is a marketplace. If your product was sold by a third-party seller, your return must go back to that seller — not to Outback Electronics. Your order confirmation will identify the seller. Contact us at <a href={`mailto:${email}`}>{email}</a> if you need help identifying the seller or facilitating a return. The return address and process below applies only to products sold directly by Outback Electronics.</p>

      <div style={s.mt}><h3>Australian Consumer Law — Your Statutory Rights</h3>
        <p style={s.p}>Our products come with guarantees that cannot be excluded under the Australian Consumer Law. You are entitled to a replacement or refund for a major failure and compensation for any other reasonably foreseeable loss or damage. You are also entitled to have the goods repaired or replaced if the goods fail to be of acceptable quality and the failure does not amount to a major failure.</p>
        <p style={s.p}><strong>These rights apply regardless of — and are in addition to — our voluntary change-of-mind policy below.</strong> Nothing in this policy excludes, restricts, or modifies any right or remedy you have under the Australian Consumer Law.</p>
        <p style={s.p}>For warranty claims or ACL issues (e.g. goods not of acceptable quality, not fit for purpose, or not matching description), contact us at <a href={`mailto:${email}`}>{email}</a>. There is no set time limit for statutory guarantee claims — they apply for a reasonable period depending on the nature of the goods.</p>
      </div>

      <div style={s.mt}><h3>Dead on Arrival (DOA) — Goods Not Working on Receipt</h3>
        <p style={s.p}>If your item arrives and does not function at all upon first use ('Dead on Arrival' or 'DOA'), please contact us within <strong>48 hours of delivery</strong> at <a href={`mailto:${email}`}>{email}</a>. Include your order number, a description of the issue, and photographs or video evidence where possible. Subject to assessment, we will arrange a replacement, repair, or full refund as required by the Australian Consumer Law — at your election for a major failure.</p>
        <p style={s.p}>Your statutory rights under the Australian Consumer Law are not limited by this 48-hour notification window — this is our preferred process for handling DOA claims efficiently. If you miss this window, your ACL rights to a remedy for defective goods still apply in full.</p>
      </div>

      <div style={s.mt}><h3>Items Damaged in Transit</h3>
        <p style={s.p}>We take care in packaging all orders, but damage can occur during transit. If your order arrives damaged:</p>
        <ul style={{paddingLeft:20, lineHeight:2, marginTop:8}}>
          <li>Do not discard any packaging — it may be required for a carrier claim.</li>
          <li>Photograph or video the outer packaging and the damaged item before unpacking further.</li>
          <li>Contact us within <strong>48 hours of delivery</strong> at <a href={`mailto:${email}`}>{email}</a> with your order number and photographic evidence.</li>
        </ul>
        <p style={s.p}>We will arrange a replacement, repair, or refund as required. Where damage was caused by the carrier, we will lodge a claim with Australia Post or the relevant carrier on your behalf. You may be required to retain damaged packaging and the item for inspection. <em>For EU and UK consumers, this does not affect your statutory rights.</em></p>
      </div>

      <div style={s.mt}><h3>Products Posing a Safety Hazard</h3>
        <p style={{...s.p, fontWeight:600}}>If you receive a product that you believe poses an immediate safety hazard — including a product that is sparking, smoking, leaking fluid, swelling, emitting unusual heat, or emitting chemical odours — do not use it. Disconnect it from power immediately if it is safe to do so. Keep it away from flammable materials.</p>
        <p style={s.p}>Contact us immediately by phone at <a href={`tel:${(phone||'').replace(/\s/g,'')}`}>{phone}</a> or by email at <a href={`mailto:${email}`}>{email}</a>. We will arrange return or inspection as a priority, ahead of any standard returns process. If there is any immediate risk to life or property, call 000 first.</p>
        <p style={s.p}>Your rights under the Australian Consumer Law in relation to unsafe goods are not limited by this policy. You may also report a dangerous product to the ACCC Product Safety website at <a href="https://www.productsafety.gov.au" target="_blank" rel="noopener noreferrer">www.productsafety.gov.au</a>.</p>
      </div>

      <div style={s.mt}><h3>Change-of-Mind Returns</h3>
        <p style={s.p}>In addition to your statutory rights, we accept change-of-mind returns postmarked within <strong>seven (7) days</strong> of the date of delivery. All returned items must be in new and unused condition, with all original packaging, tags, seals, and labels intact and undamaged. We are not required by law to offer this voluntary policy and it does not affect or limit your ACL rights in any way.</p>
      </div>

      <div style={s.mt}><h3>Return Process</h3>
        <p style={s.p}>To return an item, please email customer service at <a href={`mailto:${email}`}>{email}</a> to obtain a Return Merchandise Authorisation (RMA) number. After receiving your RMA number you have two options:</p>
        <ul style={{paddingLeft:20, lineHeight:2, marginTop:8}}>
          <li><strong>Mail-in (accepted any time, no appointment needed):</strong> Pack the item securely in its original packaging, include proof of purchase and your RMA number, and post to:<br/><br/>
            <span style={{display:'block', margin:'8px 0 8px 0', padding:'14px 18px', background:'var(--bg-elev)', border:'1px solid var(--line)', fontSize:14, lineHeight:2}}>
              <strong>Outback Electronics</strong> — Attn: Returns (RMA # [your number])<br/>
              {address}, Australia
            </span>
          </li>
          <li><strong>In-person drop-off (by prior appointment only):</strong> Contact us to arrange a suitable time before attending. We do not accept unannounced walk-in returns.</li>
        </ul>
        <p style={s.p}>For <strong>change-of-mind returns</strong>, you are responsible for return shipping charges. We strongly recommend using a trackable method. For returns under your ACL statutory rights (e.g. faulty goods), we will cover reasonable return shipping costs.</p>
      </div>

      <div style={s.mt}><h3>Refunds</h3>
        <p style={s.p}>After receiving your return and inspecting the condition of your item, we will process your return. Please allow at least <strong>seven (7) days</strong> from receipt of your item for processing. Refunds will be issued via your original payment method. Card refunds may take 1–2 billing cycles to appear on your statement depending on your card issuer. We will notify you by email when your return has been processed.</p>
      </div>

      <div style={s.mt}><h3>Repair Services — Warranty Returns</h3>
        <p style={s.p}><em>Our repair services cover ELV (Extra Low Voltage, ≤50 V AC / ≤120 V DC) and LV equipment — including PCs, phones, tablets, microcontroller boards, and embedded systems. We do not repair mains-connected appliances or perform mains wiring.</em></p>
        <p style={s.p}><strong>Repair Warranty Period.</strong> Our repair work is warranted for <strong>90 days from the date of completion</strong>. If the same fault that was repaired reoccurs within the Repair Warranty Period, contact us at <a href={`mailto:${email}`}>{email}</a> and we will re-examine and re-repair at no charge, or provide an alternative remedy as required by the Australian Consumer Law.</p>
        <p style={s.p}><strong>What the Repair Warranty Covers.</strong> The Repair Warranty covers the specific fault addressed in the agreed repair. It does not cover: (a) faults unrelated to the repair performed; (b) damage caused by misuse, accidental damage, liquid ingress, or physical impact after collection; (c) damage caused by a pre-existing condition separate from the agreed repair; or (d) further modification or repair by the customer or a third party after collection from us.</p>
        <p style={s.p}><strong>Repairs to Second-Hand or Used Devices.</strong> Where the device you submit for repair is itself second-hand or used (including devices purchased from us as 'Used' or 'Refurbished' stock, traded in, or otherwise acquired second-hand), the Repair Warranty above applies to <strong>our repair work only</strong> — it does not extend, restore, or create any warranty over the device as a whole, and does not cover faults, wear, or failures unrelated to the specific repair performed. The device's separate product warranty (if any) is governed by its own terms, including our Return Policy's used/refurbished goods provisions, and is not affected by the existence of a Repair Warranty on unrelated work.</p>
        <p style={s.p}><strong>Your ACL Rights for Repair Services.</strong> If our Repair Services fail to comply with a consumer guarantee under the Australian Consumer Law (e.g., not carried out with due care and skill), you are entitled to a remedy under the ACL, which may include re-performance of the service or compensation for foreseeable loss. These rights apply regardless of, and in addition to, our Repair Warranty.</p>
      </div>

      <div style={s.mt}><h3>Exceptions (Change-of-Mind Returns Only)</h3>
        <p style={s.p}>The following items are excluded from our voluntary change-of-mind return policy:</p>
        <ul style={{paddingLeft:20, lineHeight:2, marginTop:8}}>
          <li>Software (once opened or downloaded)</li>
          <li>Digital files and downloadable content</li>
          <li>Services (once performed)</li>
          <li>Custom or bespoke jobs</li>
        </ul>
        <p style={s.p}><strong>Please note:</strong> These exclusions do not affect your rights under the Australian Consumer Law. If any of these items are faulty, not as described, or not fit for purpose, your statutory rights still apply — contact us to arrange a remedy.</p>
        <p style={s.p}>For defective or damaged products (any category), please contact us at the details below to arrange a repair, replacement, or refund as required by law.</p>
      </div>

      <div style={s.mt}><h3>Questions</h3>
        <p style={s.p}>If you have any questions concerning our return policy or your rights under the Australian Consumer Law, please contact us at:</p>
        <p style={s.p}>Phone: <a href={`tel:${(phone||'').replace(/\s/g,'')}`}>{phone}</a><br/>Email: <a href={`mailto:${email}`}>{email}</a></p>
        <p style={s.p}>You can also obtain information about your consumer rights from the Australian Competition and Consumer Commission (ACCC) at <a href="https://www.accc.gov.au" target="_blank" rel="noopener noreferrer">www.accc.gov.au</a> or Queensland Office of Fair Trading at <a href="https://www.qld.gov.au/law/fair-trading" target="_blank" rel="noopener noreferrer">www.qld.gov.au/law/fair-trading</a>.</p>
      </div>

      <hr className="thin" style={{marginTop:40}} />
      <div className="notice" style={{marginTop:24}}>
        <span className="tag tag-ink">QUESTIONS?</span>
        <div style={{fontSize:13, color:'var(--ink-2)'}}>Email <strong><a href={`mailto:${email}`}>{email}</a></strong> — we'll get back to you as soon as we can.</div>
      </div>
    </div>
  );
}

function CommercialTermsContent({ email, phone, address, abn }) {
  const s = {mt: {marginTop:32}, p: {fontSize:15, lineHeight:1.75, marginTop:8}};
  return (
    <div>
      <span className="eyebrow">LEGAL · COMMERCIAL TERMS AND CONDITIONS</span>
      <h2 style={{marginTop:8}}>Terms and Conditions — Commercial Customers</h2>
      <div style={s.mt}>
        <p style={s.p}>These Commercial Terms and Conditions apply to any purchase from Outback Electronics ('Company', 'we', 'us', or 'our') made by a business, trade, or wholesale account, or otherwise made for the purposes of resupply, business use, or in trade ('Commercial Customer', 'you'). If you are purchasing as a private individual mainly for personal, domestic, or household use, our standard <a href="/policies/private/terms-and-conditions">Terms and Conditions for Private Customers</a> apply instead.</p>
        <p style={s.p}>We are Outback Electronics, a mobile electronics services provider registered in Australia.{abn ? ` Our ABN is ${abn}.` : ''} Our correspondence and returns address is {address}, Australia. You can contact us by phone at <a href={`tel:${(phone||'').replace(/\s/g,'')}`}>{phone}</a> or by email at <a href={`mailto:${email}`}>{email}</a>.</p>
        <p style={{...s.p, fontWeight:600}}>BY PLACING A COMMERCIAL OR TRADE ORDER WITH US, YOU REPRESENT THAT YOU ARE ACQUIRING THE GOODS OR SERVICES FOR BUSINESS USE OR RESUPPLY AND YOU AGREE TO BE BOUND BY THESE COMMERCIAL TERMS IN PLACE OF OUR PRIVATE CUSTOMER TERMS.</p>
      </div>

      <div style={s.mt}><h3>1. Application and Precedence</h3>
        <p style={s.p}>These Commercial Terms apply to the exclusion of our standard private-customer Terms and Conditions wherever an order is placed on a trade or business account, in quantities or at prices consistent with wholesale or resupply, or where the customer identifies itself as a business at checkout or in account setup. Our Privacy Policy, Cookie Policy, and Acceptable Use Policy apply equally to Commercial Customers and are incorporated by reference.</p>
      </div>

      <div style={s.mt}><h3>2. Consumer Guarantees and Business Purchases</h3>
        <p style={s.p}>The Australian Consumer Law ('ACL') consumer guarantees apply to goods and services acquired by a 'consumer' as defined in section 3 of the ACL. Depending on the value and nature of the goods, some business purchases — particularly higher-value purchases, or goods not of a kind ordinarily acquired for personal, domestic, or household use — may fall outside the ACL's consumer guarantee regime and are instead governed by the contractual warranties set out in these Commercial Terms.</p>
        <p style={s.p}><strong>Nothing in these Commercial Terms excludes, restricts, or modifies any guarantee, right, or remedy that applies as a matter of law and cannot lawfully be excluded</strong>, including any ACL consumer guarantee that does apply to your purchase. Where the ACL consumer guarantees do not apply to your purchase, the warranties in clause 6 below apply in their place.</p>
      </div>

      <div style={s.mt}><h3>3. Trade Accounts and Credit</h3>
        <p style={s.p}>Trade accounts may be approved at our discretion. Where a credit account is approved, payment terms (e.g. 14 or 30 days from invoice) will be confirmed in writing at account setup. Invoices not paid by the due date may attract interest at 1.5% per month (or part thereof) on the overdue balance, and we may suspend supply on the account until overdue amounts are paid. We reserve the right to require security, a deposit, or payment in advance for any order, and to vary, suspend, or withdraw credit terms at any time on reasonable notice.</p>
        <p style={s.p}>Title in goods does not pass to you until payment in full has been received by us in cleared funds. Until title passes, you must store the goods separately, keep them identifiable as our property, and not encumber or sell them other than in the ordinary course of resupply.</p>
      </div>

      <div style={s.mt}><h3>4. Pricing, Quotes, and Bulk Orders</h3>
        <p style={s.p}>Trade and wholesale pricing is provided on request and may vary by volume, account history, or negotiated arrangement. Written quotes are valid for 14 days from issue unless otherwise stated and are subject to stock availability at the time of order confirmation. All prices are in Australian Dollars and exclude GST unless stated otherwise; GST will be added where applicable and shown on the tax invoice.</p>
      </div>

      <div style={s.mt}><h3>5. Delivery and Risk</h3>
        <p style={s.p}>Estimated delivery times are not guaranteed. Risk in the goods passes to you on delivery to the address you nominate, or on collection if you arrange your own freight or pick-up. You are responsible for inspecting goods on delivery and notifying us in writing of any shortage, transit damage, or discrepancy within 5 business days of delivery; claims made after this period may not be accepted, except to the extent the ACL or other mandatory law requires otherwise.</p>
      </div>

      <div style={s.mt}><h3>6. Warranty (Where ACL Consumer Guarantees Do Not Apply)</h3>
        <p style={s.p}>Where the ACL consumer guarantees do not apply to your purchase under clause 2, we warrant that goods supplied will be free from material defects in materials and workmanship for a period of <strong>12 months from the date of delivery</strong> ('Commercial Warranty'), or such other period as agreed in writing for a specific order. Our sole obligation under the Commercial Warranty, at our election, is to repair, replace, or credit the price of any defective goods returned to us at your cost within the warranty period, provided the defect is not the result of misuse, unauthorised modification, incorrect installation, normal wear and tear, or use outside the goods' rated specifications.</p>
        <p style={s.p}>To the fullest extent permitted by law, the Commercial Warranty is the sole and exclusive remedy for defective goods supplied under these Commercial Terms, and excludes any other warranty, condition, or guarantee, whether express, implied, statutory, or otherwise, except any guarantee that applies as a matter of law and cannot lawfully be excluded.</p>
      </div>

      <div style={s.mt}><h3>7. Returns</h3>
        <p style={s.p}>Please refer to our <a href="/policies/commercial/return-policy">Return Policy for Commercial Customers</a>, which forms part of these Commercial Terms.</p>
      </div>

      <div style={s.mt}><h3>8. Resupply, Relabelling, and Representations to End Customers</h3>
        <p style={s.p}>If you resell or resupply our products, you are solely responsible for any representations you make to your own customers about those products, and for complying with the ACL and any other applicable law in respect of your own sales. You must not represent that we warrant, endorse, or are responsible for any modification, integration, relabelling, or bundling you apply to our products. You agree to indemnify us against any claim arising from a representation you make to your customers that is inconsistent with these Commercial Terms or our published product specifications.</p>
      </div>

      <div style={s.mt}><h3>8A. Subscriptions</h3>
        <p style={s.p}>Where you take out a membership, subscription, or recurring trade account billing arrangement with us, it auto-renews on the agreed cycle unless cancelled. A free trial, where offered, is available once per business, regardless of how many accounts or related entities you operate; we may decline a further trial, or convert it to a paid subscription, where we reasonably believe you have already received one. Cancellation takes effect at the end of the current paid period, and you retain access to any tier-gated benefits already paid for until that date. If we discontinue a tier or its benefits, we will give reasonable notice and either migrate you to a comparable tier or credit the unused, already-paid portion of the period on a pro-rata basis.</p>
      </div>

      <div style={s.mt}><h3>8B. Software and AI Assistant</h3>
        <p style={s.p}>Any software we supply is offered 'AS IS' without warranty of any kind beyond the Commercial Warranty in clause 6, except where a EULA accompanies the software, in which case the EULA governs to the extent of any inconsistency. Where we provide an AI-powered chat or assistant feature, your input may be transmitted to and processed by a third-party AI service provider to generate a response; do not submit confidential, commercially sensitive, or personal information to it. AI Assistant output is generated automatically, may be inaccurate or incomplete, does not constitute professional or technical advice, and must be independently verified before you rely on it for any business purpose. To the fullest extent permitted by law, we are not liable for any loss arising from your reliance on AI Assistant output or from a firmware/software update, except as required by the ACL where it applies.</p>
      </div>

      <div style={s.mt}><h3>8C. Security, Penetration-Testing, and Similar Dual-Use Tools</h3>
        <p style={s.p}>Some software we supply is designed for security research, penetration testing, network diagnostics, or similar dual-use purposes ('Security Tools'). Security Tools are supplied strictly for use on systems and networks your business owns, or for which your business holds documented authorisation (such as a signed penetration-testing engagement letter). You must comply with the <em>Criminal Code Act 1995</em> (Cth), the <em>Cybercrime Act 2001</em> (Cth), and all other applicable laws governing computer access in any jurisdiction in which the Security Tool is used.</p>
        <p style={s.p}>If we reasonably suspect a Security Tool we have supplied is being used for an unauthorised or unlawful purpose, we may report the matter — including disclosing your business and personal information — to law enforcement, a regulator, or an affected third party without notice. To the fullest extent permitted by law, we are not liable for any loss, claim, fine, or legal liability arising from use of a Security Tool for any illegal, unethical, or unauthorised purpose, and you indemnify us against any such claim.</p>
      </div>

      <div style={s.mt}><h3>9. Limitation of Liability</h3>
        <p style={{...s.p, textTransform:'uppercase', fontSize:13}}>TO THE FULLEST EXTENT PERMITTED BY LAW, OUR TOTAL AGGREGATE LIABILITY TO YOU UNDER OR IN CONNECTION WITH THESE COMMERCIAL TERMS, WHETHER IN CONTRACT, TORT (INCLUDING NEGLIGENCE), OR OTHERWISE, IS LIMITED TO THE PRICE PAID BY YOU FOR THE GOODS OR SERVICES GIVING RISE TO THE CLAIM. WE ARE NOT LIABLE FOR ANY INDIRECT, CONSEQUENTIAL, OR ECONOMIC LOSS, INCLUDING LOSS OF PROFITS, LOSS OF CONTRACTS, OR LOSS OF BUSINESS OPPORTUNITY, ARISING OUT OF OR IN CONNECTION WITH THESE COMMERCIAL TERMS.</p>
        <p style={s.p}><strong>This limitation does not apply to liability that cannot lawfully be excluded or limited, including liability arising under any ACL consumer guarantee that does apply to your purchase.</strong></p>
      </div>

      <div style={s.mt}><h3>10. Governing Law and Disputes</h3>
        <p style={s.p}>These Commercial Terms are governed by the laws of Queensland, Australia. Each party submits to the exclusive jurisdiction of the courts of Queensland in respect of any dispute arising out of or in connection with these Commercial Terms, except where mandatory law provides otherwise.</p>
      </div>

      <div style={s.mt}><h3>11. Contact Us</h3>
        <p style={s.p}><strong>Outback Electronics</strong><br/>{address}, Australia<br/>Phone: <a href={`tel:${(phone||'').replace(/\s/g,'')}`}>{phone}</a><br/>Email: <a href={`mailto:${email}`}>{email}</a></p>
      </div>

      <hr className="thin" style={{marginTop:40}} />
      <div className="notice" style={{marginTop:24}}>
        <span className="tag tag-ink">QUESTIONS?</span>
        <div style={{fontSize:13, color:'var(--ink-2)'}}>Email <strong><a href={`mailto:${email}`}>{email}</a></strong> — we'll get back to you as soon as we can.</div>
      </div>
    </div>
  );
}

function CommercialReturnContent({ email, phone, address }) {
  const s = {mt: {marginTop:32}, p: {fontSize:15, lineHeight:1.75, marginTop:8}};
  return (
    <div>
      <span className="eyebrow">LEGAL · RETURN POLICY — COMMERCIAL CUSTOMERS</span>
      <h2 style={{marginTop:8}}>Return Policy — Commercial Customers</h2>
      <p style={s.p}>This Return Policy applies to purchases made on a trade, wholesale, or business account. If you are a private customer purchasing mainly for personal or household use, our <a href="/policies/private/return-policy">standard Return Policy</a> applies instead.</p>

      <div style={s.mt}><h3>Statutory Rights</h3>
        <p style={s.p}>Where the Australian Consumer Law consumer guarantees apply to your purchase (see clause 2 of our Commercial Terms and Conditions), nothing in this policy excludes, restricts, or modifies those rights. For purchases outside the scope of the ACL consumer guarantees, the Commercial Warranty described in our Commercial Terms and Conditions applies in their place.</p>
      </div>

      <div style={s.mt}><h3>Faulty or Defective Goods</h3>
        <p style={s.p}>If goods are defective on arrival or fail within the applicable warranty period, contact us at <a href={`mailto:${email}`}>{email}</a> with your account or invoice number, a description of the fault, and supporting photographs or video where possible. We will assess the claim and, where the goods are confirmed defective, repair, replace, or credit them in accordance with our Commercial Terms and Conditions.</p>
      </div>

      <div style={s.mt}><h3>Change-of-Mind Returns — No General Right</h3>
        <p style={s.p}>Unlike our private-customer policy, we do <strong>not</strong> offer a general change-of-mind return right on commercial or trade orders, including bulk and made-to-order stock. Any change-of-mind return is at our sole discretion, must be agreed with us in writing before the goods are sent back, and may be subject to a restocking fee of up to 20% of the invoice value plus return freight, deducted from any credit issued. Goods must be unused, in original packaging, and in resaleable condition to be accepted for a discretionary change-of-mind return.</p>
      </div>

      <div style={s.mt}><h3>Shortages and Transit Damage</h3>
        <p style={s.p}>Shortages, incorrect items, or transit damage must be reported in writing within <strong>5 business days</strong> of delivery, with photographic evidence of the goods and packaging as received. Claims reported after this period may not be accepted, except to the extent required by the ACL or other mandatory law.</p>
      </div>

      <div style={s.mt}><h3>Return Process</h3>
        <p style={s.p}>Email <a href={`mailto:${email}`}>{email}</a> to obtain a Return Merchandise Authorisation (RMA) number before sending anything back. Goods returned without a prior RMA number may be refused or delayed. Unless the return relates to a confirmed defect or an error on our part, you are responsible for return freight, which must be sent prepaid to:</p>
        <span style={{display:'block', margin:'8px 0 8px 0', padding:'14px 18px', background:'var(--bg-elev)', border:'1px solid var(--line)', fontSize:14, lineHeight:2}}>
          <strong>Outback Electronics</strong> — Attn: Trade Returns (RMA # [your number])<br/>
          {address}, Australia
        </span>
      </div>

      <div style={s.mt}><h3>Credits and Refunds</h3>
        <p style={s.p}>Approved returns are processed as an account credit by default. A refund to your original payment method, or to your nominated bank account for invoiced trade accounts, will be issued on request once the returned goods have been received and inspected. Please allow up to 14 business days for processing.</p>
      </div>

      <div style={s.mt}><h3>Questions</h3>
        <p style={s.p}>Phone: <a href={`tel:${(phone||'').replace(/\s/g,'')}`}>{phone}</a><br/>Email: <a href={`mailto:${email}`}>{email}</a></p>
      </div>

      <hr className="thin" style={{marginTop:40}} />
      <div className="notice" style={{marginTop:24}}>
        <span className="tag tag-ink">QUESTIONS?</span>
        <div style={{fontSize:13, color:'var(--ink-2)'}}>Email <strong><a href={`mailto:${email}`}>{email}</a></strong> — we'll get back to you as soon as we can.</div>
      </div>
    </div>
  );
}

function CustomWorkContent({ email, phone, address, abn }) {
  const s = {mt: {marginTop:32}, p: {fontSize:15, lineHeight:1.75, marginTop:8}};
  return (
    <div>
      <span className="eyebrow">LEGAL · CUSTOM WORK AND REVERSE ENGINEERING POLICY</span>
      <h2 style={{marginTop:8}}>Custom Work and Reverse Engineering Policy</h2>
      <div style={s.mt}>
        <p style={s.p}>This policy applies whenever Outback Electronics ('Company', 'we', 'us', or 'our') designs or builds bespoke hardware, writes or modifies custom software or firmware, or performs reverse-engineering work (collectively, 'Custom Work') for a customer ('you'). It applies alongside, and in addition to, our Terms and Conditions (private or commercial, as applicable) and our Acceptable Use Policy.{abn ? ` Our ABN is ${abn}.` : ''} Contact us at <a href={`tel:${(phone||'').replace(/\s/g,'')}`}>{phone}</a> or <a href={`mailto:${email}`}>{email}</a> with any questions before commencing a Custom Work job.</p>
      </div>

      <div style={s.mt}><h3>1. Quote and Scope</h3>
        <p style={s.p}>Before we start any Custom Work, we will agree a written quote or statement of work describing the scope, deliverables, fees, and timeline. Work outside this agreed scope ('Change Requests') must be confirmed in writing and may incur additional fees or affect the timeline. Verbal or informal requests made during the course of a job are treated as Change Requests and are not binding until confirmed in writing.</p>
      </div>

      <div style={s.mt}><h3>2. Ownership of Deliverables — We Retain IP, You Get a Licence</h3>
        <p style={s.p}>Unless we agree otherwise in writing for a specific job, <strong>we retain ownership of all intellectual property</strong> in the deliverables created in performing Custom Work — including schematics, PCB layouts, firmware, source code, designs, drawings, and documentation ('Deliverables').</p>
        <p style={s.p}>On payment in full for the job, we grant you a <strong>non-exclusive, non-transferable, perpetual licence</strong> to use, operate, and maintain the Deliverable for your own internal or personal purposes, and to have it repaired or modified by us or (where we provide the necessary materials, such as source files) a third party. This licence does <strong>not</strong> include the right to resell, sublicense, manufacture at volume, distribute, or commercially exploit the Deliverable or any copy or derivative of it. If you want to do any of those things, contact us to discuss a separate commercialisation licence — fees and terms for that are negotiated separately and are not covered by this policy.</p>
        <p style={s.p}>We may reuse general techniques, methods, and know-how developed during your job in other jobs for other customers. We will not disclose your specific designs, source code, or confidential information to another customer — see clause 6 (Confidentiality). Where a job involves recreating or replicating the functionality of a third-party product or tool that is itself publicly available (for example, a reverse-engineered replacement for commercial software), our default position is that the recreation itself is not your confidential information merely because the original product is publicly available, and we may offer similar recreations to other customers. <strong>This default does not apply, and any separate written agreement for the job prevails over it,</strong> where a specific contract, statement of work, or non-disclosure agreement for that job restricts our ability to do so — including where we are engaged as a subcontractor under an NDA that covers the deliverable, the engagement itself, or the surrounding business context. In every case, this reuse right (whether under the general know-how rule above or this clause) is subject to, and does not override, any separate confidentiality or non-disclosure agreement we have entered into with a third party. Where we hold information under such an agreement, we will not use or disclose it in performing work for you, even if it would otherwise qualify as general know-how or a publicly-available recreation.</p>
        <p style={s.p}>No licence is granted, and no Deliverable will be released to you, until the job is paid in full. We may withhold source files, firmware images, or design files (while still providing the finished physical item, where applicable) until payment is received.</p>
      </div>

      <div style={s.mt}><h3>3. Reverse Engineering — Your Warranty</h3>
        <p style={s.p}>If you ask us to reverse-engineer an item — including recreating a circuit or board, extracting or decompiling firmware, recovering a design with no remaining documentation, or cloning a part that is no longer manufactured — you warrant to us that:</p>
        <ul style={{paddingLeft:20, lineHeight:2, marginTop:8}}>
          <li>you own the item, or are its lawful licensee or authorised user with the right to have it serviced, repaired, or made interoperable with other equipment;</li>
          <li>the request is for a legitimate purpose such as repair, maintenance, interoperability, or preservation of a product you are entitled to use, and not for unauthorised cloning of a current commercial product for competing manufacture or resale;</li>
          <li>to the best of your knowledge, the work does not infringe any third party's patent, registered design, copyright, or trade mark, and does not breach the anti-circumvention provisions of the <em>Copyright Act 1968</em> (Cth) or any other applicable law; and</li>
          <li>you have not misrepresented your relationship to, or rights in, the item.</li>
        </ul>
        <p style={s.p}>You indemnify us against any claim, loss, or liability arising from reverse-engineering work we perform at your request where any part of this warranty is false, to the fullest extent permitted by law.</p>
      </div>

      <div style={s.mt}><h3>4. Our Right to Decline or Stop a Job</h3>
        <p style={s.p}>We are not lawyers and do not provide legal advice on whether a specific reverse-engineering or custom-build request is lawful in your circumstances. As a matter of our own business discretion, we may decline to accept, or stop work part-way through, any job that appears to us to involve: circumventing a technological protection measure (such as DRM or device locking) for a purpose other than lawful repair or interoperability; cloning a current commercial product for the purpose of competing manufacture or resale; infringing an obvious and apparent patent, registered design, or trade mark; or any other request that raises an apparent red flag for unauthorised use of a third party's intellectual property. Declining or stopping a job under this clause is a business decision, not a legal determination, and does not constitute legal advice to you about the lawfulness of your request. If we stop a job already in progress under this clause, we will refund fees paid for work not yet performed, but are not liable for any other loss arising from the job not being completed.</p>
        <p style={s.p}>If you would like independent advice on whether a particular reverse-engineering or custom-build request is lawful, you should consult a qualified intellectual property lawyer before asking us to proceed.</p>
      </div>

      <div style={s.mt}><h3>5. Risks Specific to Custom and Reverse-Engineered Work</h3>
        <p style={s.p}>Custom hardware, custom software, and reverse-engineered designs are, by their nature, novel, one-off, or recreated without the benefit of original manufacturer documentation, testing, or certification. The following apply in addition to the general disclaimers in our Terms and Conditions and Disclaimer:</p>
        <ul style={{paddingLeft:20, lineHeight:2, marginTop:8}}>
          <li><strong>No regulatory certification implied.</strong> Unless we expressly agree in writing to obtain a specific certification (e.g. RCM) for a Deliverable, Custom Work is supplied uncertified. You are responsible for arranging any compliance testing or certification required before deploying a Deliverable commercially or in a regulated environment.</li>
          <li><strong>ELV/LV scope only.</strong> As with all our services, Custom Work is limited to Extra Low Voltage (≤50 V AC / ≤120 V DC) and Low Voltage equipment. We do not design, build, or reverse-engineer mains-voltage (240 V AC) hardware.</li>
          <li><strong>Prototype-grade reliability.</strong> One-off and recreated designs may contain faults or limitations not apparent at delivery, including faults inherited from incomplete or imperfect reverse-engineering of the original item. We are not liable for faults arising from the inherent limitations of recreating a design without complete original documentation, beyond the workmanship warranty in clause 7.</li>
          <li><strong>Not validated for safety-critical or production deployment.</strong> Unless expressly agreed in writing, Custom Work is not validated for use in safety-critical applications or volume production. You should have a Deliverable independently assessed before such use.</li>
        </ul>
      </div>

      <div style={s.mt}><h3>6. Confidentiality</h3>
        <p style={s.p}>We will keep confidential any proprietary information, designs, or materials you provide to us for a Custom Work job, and will not disclose them to other customers or third parties except: as needed to perform the job (e.g. component suppliers); as required by law; or with your written consent. You should clearly mark any materials you consider confidential. This clause survives completion of the job.</p>
        <p style={s.p}>Where you and we have entered into a separate non-disclosure agreement for a job, we will only disclose information covered by that agreement where we are legally compelled to do so — for example, in response to a court order, subpoena, summons, or other binding legal process (including being required to give evidence or testimony in connection with legal proceedings involving you). Where legally permitted to do so, we will give you reasonable notice before making any such disclosure so you have the opportunity to object or seek a protective order. We will not disclose NDA-covered information on the basis of an informal request, a request from a party other than a court or regulator with legal authority to compel disclosure, or our own discretion.</p>
      </div>

      <div style={s.mt}><h3>7. Warranty on Custom Work</h3>
        <p style={s.p}>We warrant that Custom Work will be performed with due care and skill and will conform to the agreed written scope. For private customers, this is in addition to your rights under the Australian Consumer Law, which are not excluded. For commercial customers, the Commercial Warranty in our Commercial Terms and Conditions applies in place of ACL consumer guarantees where those guarantees do not apply to your purchase. This warranty does not cover faults arising from the inherent limitations described in clause 5, from your own specifications or design input, or from modification or further work by you or a third party after delivery.</p>
      </div>

      <div style={s.mt}><h3>8. Cancellation</h3>
        <p style={s.p}>If you cancel a Custom Work job after we have started, you remain liable for fees for work already performed and for any non-returnable materials already ordered for the job. Deposits paid are applied against work performed and are non-refundable to the extent work has commenced, except as required by the Australian Consumer Law.</p>
      </div>

      <div style={s.mt}><h3>9. Contact Us</h3>
        <p style={s.p}><strong>Outback Electronics</strong><br/>{address}, Australia<br/>Phone: <a href={`tel:${(phone||'').replace(/\s/g,'')}`}>{phone}</a><br/>Email: <a href={`mailto:${email}`}>{email}</a></p>
      </div>

      <hr className="thin" style={{marginTop:40}} />
      <div className="notice" style={{marginTop:24}}>
        <span className="tag tag-ink">QUESTIONS?</span>
        <div style={{fontSize:13, color:'var(--ink-2)'}}>Email <strong><a href={`mailto:${email}`}>{email}</a></strong> — we'll get back to you as soon as we can.</div>
      </div>
    </div>
  );
}

function DisclaimerContent() {
  const s = {mt: {marginTop:32}, p: {fontSize:15, lineHeight:1.75, marginTop:8}};
  return (
    <div>
      <span className="eyebrow">LEGAL · DISCLAIMER</span>
      <h2 style={{marginTop:8}}>Disclaimer</h2>
      <p style={s.p}>This Disclaimer forms part of our Terms and Conditions. By accessing or using this Site in any way, you accept this Disclaimer in full. If you do not accept this Disclaimer, you must immediately cease using this Site.</p>

      <div style={s.mt}><h3>General Website Disclaimer</h3>
        <p style={s.p}>The information provided by Outback Electronics ('we', 'us', or 'our') on <a href="https://outbackelectronics.com.au">outbackelectronics.com.au</a> (the 'Site') is for general informational purposes only. All information on the Site is provided in good faith; however, we make no representation or warranty of any kind, express or implied, regarding the accuracy, adequacy, validity, reliability, availability, or completeness of any information on the Site.</p>
        <p style={{...s.p, textTransform:'uppercase', fontSize:13}}>TO THE FULLEST EXTENT PERMITTED BY LAW, WE SHALL NOT BE LIABLE TO YOU OR ANY THIRD PARTY FOR ANY LOSS OR DAMAGE OF ANY KIND WHATSOEVER — INCLUDING BUT NOT LIMITED TO INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, EXEMPLARY, OR PUNITIVE DAMAGES — INCURRED AS A RESULT OF: (A) YOUR USE OF OR INABILITY TO USE THE SITE; (B) YOUR RELIANCE ON ANY INFORMATION OBTAINED FROM THE SITE; OR (C) ANY ERROR, OMISSION, INTERRUPTION, DELETION, DEFECT, DELAY IN OPERATION, COMPUTER VIRUS, UNAUTHORISED ACCESS, OR OTHER TECHNICAL FAILURE. YOUR USE OF THE SITE AND YOUR RELIANCE ON ANY INFORMATION ON THE SITE IS SOLELY AT YOUR OWN RISK.</p>
        <p style={s.p}><strong>Nothing in this Disclaimer excludes, restricts, or modifies any consumer guarantee, right, or remedy conferred by the Australian Consumer Law (Schedule 2 of the Competition and Consumer Act 2010 (Cth)) or any other applicable mandatory legislation that cannot lawfully be excluded or limited.</strong></p>
      </div>

      <div style={s.mt}><h3>Technical Information Disclaimer</h3>
        <p style={s.p}>Any technical information, repair guides, product specifications, tutorials, forum posts, or other technical content available on this Site are provided for general informational purposes only. They do not constitute professional engineering, electrical safety, or specialist advice. Our content relates exclusively to ELV (Extra Low Voltage, ≤50 V AC / ≤120 V DC) and LV equipment — nothing on this Site should be read as guidance for mains-voltage (240 V AC) work. Electronic repairs, modifications, and electrical work involve inherent and serious risks, including, without limitation: <strong>electric shock capable of causing death or permanent serious injury; fire and explosion that may result in partial or complete destruction of property (including your home or premises); toxic gas release from damaged or mishandled battery cells; damage to connected equipment and infrastructure; personal injury; and voiding of manufacturer warranties</strong>. Following any guide or tutorial on this Site does not guarantee safety, accuracy, or a successful outcome for your specific device, application, component selection, or environment. Always verify technical information from authoritative sources and consult a qualified professional where appropriate.</p>
        <p style={{...s.p, textTransform:'uppercase', fontSize:13}}>YOU ASSUME ALL RISK AND RESPONSIBILITY FOR ANY ACTIONS TAKEN IN RELIANCE ON TECHNICAL INFORMATION OBTAINED FROM THIS SITE, INCLUDING WITHOUT LIMITATION ANY REPAIR GUIDES, TUTORIALS, FORUM POSTS, OR PRODUCT DESCRIPTIONS. WE SHALL HAVE NO LIABILITY WHATSOEVER FOR ANY LOSS, DAMAGE, PERSONAL INJURY, SERIOUS BODILY INJURY, DEATH, FIRE, EXPLOSION, PROPERTY DAMAGE (INCLUDING TOTAL OR PARTIAL LOSS OF YOUR HOME OR PREMISES), CONSEQUENTIAL HARM, OR OTHER ADVERSE OUTCOME RESULTING FROM YOUR USE OF OR RELIANCE ON ANY TECHNICAL INFORMATION ON THIS SITE, WHETHER ARISING FROM NEGLIGENCE OR OTHERWISE. YOU SHOULD ALWAYS CONSULT A QUALIFIED PROFESSIONAL — AND IN AUSTRALIA, A LICENSED ELECTRICIAN FOR ANY MAINS-VOLTAGE WORK — BEFORE UNDERTAKING ANY ELECTRICAL OR ELECTRONIC REPAIR, MODIFICATION, OR INSTALLATION.</p>
        <p style={s.p}><strong>Nothing in this Technical Information Disclaimer excludes, restricts, or modifies any consumer guarantee, right, or remedy conferred by the Australian Consumer Law or any other applicable mandatory legislation that cannot lawfully be excluded.</strong></p>
      </div>

      <div style={s.mt}><h3>Scope of Our Work</h3>
        <p style={{...s.p, fontWeight:600, borderLeft:'3px solid var(--rust)', paddingLeft:14}}>⚠ IMPORTANT: Outback Electronics works exclusively with Extra Low Voltage (ELV, ≤50 V AC / ≤120 V DC) and Low Voltage (LV) equipment — including PCs, phones, tablets, microcontroller boards, and embedded systems. We are not licensed electrical contractors and we do not perform, advise on, or accept any responsibility for mains-voltage (240 V AC) wiring or appliance work. Nothing on this Site, in our tutorials, forum, or in our repair or technical services constitutes advice, instruction, or authorisation for any mains-voltage electrical work.</p>
        <p style={s.p}><strong>Mains Voltage Hazard:</strong> Mains-voltage electricity (240 V AC in Australia) can cause electrocution, cardiac arrest, severe burns, and death. All work on mains-connected equipment or infrastructure must only be performed by a licensed electrician under applicable state or territory legislation. Even after disconnection from mains supply, capacitors within mains-powered devices may retain lethal stored charge for extended periods. If your project involves mains voltage at any point, engage a licensed electrician — do not rely on this Site.</p>
        <p style={s.p}><strong>Nothing in this section limits your rights under the Australian Consumer Law where a product we have supplied is defective.</strong></p>
      </div>

      <div style={s.mt}><h3>Lithium Battery Hazard Warning</h3>
        <p style={{...s.p, fontWeight:600, borderLeft:'3px solid var(--rust)', paddingLeft:14}}>⚠ WARNING — FIRE AND EXPLOSION RISK: Lithium-ion and lithium-polymer batteries can ignite and explode violently if punctured, short-circuited, overcharged, over-discharged, crushed, or exposed to excessive heat or physical damage. A lithium battery fire produces intense heat and toxic fumes, is extremely difficult to extinguish, and can result in complete destruction of property.</p>
        <p style={s.p}>You must handle, charge, store, transport, and dispose of lithium batteries strictly in accordance with manufacturer specifications and applicable dangerous-goods regulations. If a lithium battery shows signs of swelling (puffing), leaking, excessive heat generation, unusual odour, or discolouration, cease use immediately, move it away from flammable materials, and consult a qualified professional. Never charge a visibly damaged battery. Always use manufacturer-approved or compatible chargers within specified voltage and current limits.</p>
        <p style={s.p}><strong>Nothing in this warning limits your rights under the Australian Consumer Law where a product sold by us is defective.</strong></p>
      </div>

      <div style={s.mt}><h3>Product Compatibility and Electrical Ratings Disclaimer</h3>
        <p style={s.p}>We make no independent representation, warranty, or guarantee regarding the electrical ratings (voltage, current, power, temperature), compatibility, regulatory compliance, or fitness for purpose of any component or product for your specific application, installation environment, or load conditions. Component specifications published on this Site are sourced from manufacturers and distributors and may contain errors or may not reflect the most current revision of a product. You are solely responsible for verifying that any component or product is correctly rated and appropriate for your intended application before use. We are not liable for any loss, equipment damage, fire, personal injury, or death arising from the use of a component or product in an application for which it is incorrectly rated or unsuitable, to the fullest extent permitted by applicable law.</p>
      </div>

      <div style={s.mt}><h3>Repair Services Disclaimer</h3>
        <p style={s.p}>Where we perform repair services on your device, our repair addresses the specific fault presented and agreed. A repaired device may contain other pre-existing or latent faults unrelated to the repair performed; we do not conduct a whole-device safety audit unless this is specifically agreed in writing. A device returned from repair is not certified safe for use in any safety-critical application beyond normal consumer use of that repaired item. If you intend to deploy a repaired device in a safety-critical environment, you should have it independently assessed by a qualified professional before doing so. To the fullest extent permitted by applicable law, we are not liable for any loss, damage, fire, personal injury, or adverse outcome arising from pre-existing conditions or latent faults in a repaired device, or from use of the device inconsistently with any instructions provided at time of return.</p>
      </div>

      <div style={s.mt}><h3>External Links Disclaimer</h3>
        <p style={s.p}>The Site may contain links to other websites or content belonging to or originating from third parties. Such external links are not investigated, monitored, or checked for accuracy, adequacy, validity, reliability, availability, or completeness by us.</p>
        <p style={{...s.p, textTransform:'uppercase', fontSize:13}}>WE DO NOT WARRANT, ENDORSE, GUARANTEE, OR ASSUME RESPONSIBILITY FOR THE ACCURACY OR RELIABILITY OF ANY INFORMATION OFFERED BY THIRD-PARTY WEBSITES. WE WILL NOT BE A PARTY TO OR IN ANY WAY RESPONSIBLE FOR ANY TRANSACTION BETWEEN YOU AND THIRD-PARTY PROVIDERS. ACCESS TO ANY LINKED WEBSITE IS AT YOUR OWN RISK.</p>
      </div>

      <div style={s.mt}><h3>Testimonials Disclaimer</h3>
        <p style={s.p}>Testimonials on the Site reflect the real-life experiences and opinions of individual users. They are personal to those users and may not be representative of all users of our products and services. We do not claim that all users will have the same experiences.</p>
        <p style={{...s.p, textTransform:'uppercase', fontSize:13}}>YOUR INDIVIDUAL RESULTS MAY VARY. TESTIMONIALS ARE NOT GUARANTEES OF SPECIFIC RESULTS.</p>
        <p style={s.p}>Testimonials are reviewed by us before posting and appear substantially as given, except for minor corrections. The views in testimonials belong solely to the individual and do not represent our views. We are not affiliated with testimonial authors, and no compensation is provided for testimonials.</p>
      </div>

      <div style={s.mt}><h3>Forum and User-Generated Content Disclaimer</h3>
        <p style={s.p}>Content posted on the Outback Electronics forum and community areas is generated by users and does not represent our views or recommendations. We do not warrant the accuracy, completeness, or usefulness of any user-generated content. You use forum content entirely at your own risk. We are not liable for any harm arising from your reliance on user-generated content.</p>
      </div>

      <div style={s.mt}><h3>Availability Disclaimer</h3>
        <p style={s.p}>We do not warrant that the Site will be available at all times, uninterrupted, or free from errors. We reserve the right to withdraw or amend the Site at any time without notice. We are not liable for any consequences arising from the unavailability of the Site.</p>
      </div>

      <div style={s.mt}><h3>No Professional Advice</h3>
        <p style={s.p}>Nothing on this Site constitutes legal, financial, accounting, tax, medical, safety, or other professional advice. You should seek independent professional advice tailored to your specific circumstances before acting on any information on this Site.</p>
      </div>

      <hr className="thin" style={{marginTop:40}} />
    </div>
  );
}

function AcceptableUseContent({ email, address, abn }) {
  const s = {mt: {marginTop:32}, p: {fontSize:15, lineHeight:1.75, marginTop:8}};
  const li = (text) => <li style={{marginBottom:6}}>{text}</li>;
  return (
    <div>
      <span className="eyebrow">LEGAL · ACCEPTABLE USE POLICY</span>
      <h2 style={{marginTop:8}}>Acceptable Use Policy</h2>
      <p style={s.p}>This Acceptable Use Policy ('Policy') is part of our Terms and Conditions ('Legal Terms') and should be read alongside our main Legal Terms at <a href="/policies/terms-and-conditions">outbackelectronics.com.au/policies/terms-and-conditions</a>. If you do not agree with these Legal Terms, please refrain from using our Services. Your continued use of our Services implies acceptance of these Legal Terms.</p>
      <p style={s.p}>This Policy applies to any and all: (a) uses of our Services; (b) forms, materials, consent tools, comments, posts, and all other content available on the Services ('Content'); and (c) material you contribute to the Services including uploads, posts, reviews, ratings, comments, chat, etc. ('Contribution').</p>

      <div style={s.mt}><h3>Who We Are</h3>
        <p style={s.p}>We are Outback Electronics ('Company', 'we', 'us', or 'our'), a mobile electronics services provider registered in Australia.{abn ? ` Our ABN is ${abn}.` : ''} Our correspondence address is {address}, Australia. We operate the website <a href="https://outbackelectronics.com.au">outbackelectronics.com.au</a> (the 'Site'), as well as any other related products and services that refer or link to this Policy (collectively, the 'Services').</p>
      </div>

      <div style={s.mt}><h3>Use of the Services</h3>
        <p style={s.p}>When you use the Services, you warrant that you will comply with this Policy and with all applicable laws. You also acknowledge that you may not:</p>
        <ul style={{paddingLeft:20, lineHeight:1.9, marginTop:8}}>
          {li('Systematically retrieve data or other content from the Services to create or compile a collection, compilation, database, or directory without written permission from us.')}
          {li('Make any unauthorised use of the Services, including collecting email addresses of users for sending unsolicited email, or creating user accounts by automated means or under false pretences.')}
          {li('Circumvent, disable, or otherwise interfere with security-related features of the Services.')}
          {li('Engage in unauthorised framing of or linking to the Services.')}
          {li('Trick, defraud, or mislead us and other users, especially in any attempt to learn sensitive account information such as user passwords.')}
          {li('Make improper use of our support services or submit false reports of abuse or misconduct.')}
          {li('Engage in any automated use of the Services, such as using scripts to send comments or messages, or using data mining, robots, or similar data gathering and extraction tools.')}
          {li('Interfere with, disrupt, or create an undue burden on the Services or the networks connected to the Services.')}
          {li('Attempt to impersonate another user or person or use the username of another user.')}
          {li('Use any information obtained from the Services in order to harass, abuse, or harm another person.')}
          {li('Use the Services as part of any effort to compete with us or for any revenue-generating endeavour or commercial enterprise.')}
          {li('Decipher, decompile, disassemble, or reverse engineer any of the software comprising or in any way making up a part of the Services, except as expressly permitted by applicable law.')}
          {li('Attempt to bypass any measures of the Services designed to prevent or restrict access to the Services, or any portion of the Services.')}
          {li('Harass, annoy, intimidate, or threaten any of our employees or agents.')}
          {li('Delete the copyright or other proprietary rights notice from any Content.')}
          {li('Copy or adapt the Services\' software, including but not limited to HTML, JavaScript, or other code.')}
          {li('Upload or transmit viruses, Trojan horses, spyware, or other material that interferes with any party\'s uninterrupted use and enjoyment of the Services.')}
          {li('Use any automated system, including spiders, robots, scrapers, or offline readers, that accesses the Services without authorisation.')}
          {li('Disparage, tarnish, or otherwise harm, in our opinion, us and/or the Services.')}
          {li('Use the Services in a manner inconsistent with any applicable laws or regulations.')}
          {li('Use a buying agent or purchasing agent to make purchases on the Services.')}
          {li('Sell or otherwise transfer your or any other user\'s profile.')}
        </ul>
        <p style={{...s.p, marginTop:20}}><strong>Subscriptions.</strong> If you subscribe to our Services, you may not: engage in any use, modification, copying, redistribution, or retransmission of any portions of the Services without prior written consent; reconstruct or attempt to discover any source code or algorithms; provide the Services to any third party; intercept data not intended for you; or damage, reveal, or alter any user's data or information relating to another person or entity.</p>
      </div>

      <div style={s.mt}><h3>Community / Forum Guidelines</h3>
        <p style={s.p}>Please review our forum rules at <a href="https://forum.outbackelectronics.com.au/t/forum-rules/7" target="_blank" rel="noopener noreferrer">forum.outbackelectronics.com.au/t/forum-rules/7</a>.</p>
      </div>

      <div style={s.mt}><h3>Contributions</h3>
        <p style={s.p}>A 'Contribution' means any data, information, software, text, code, music, scripts, sound, graphics, photos, videos, tags, messages, interactive features, or other materials you post, share, upload, submit, or otherwise provide on or through the Services.</p>
        <p style={s.p}>We may but are under no obligation to review or moderate Contributions, and we expressly exclude our liability for any loss or damage resulting from any user's breach of this Policy. Please report any Contribution that you believe breaches this Policy.</p>
        <p style={s.p}>You warrant that: you are the creator and owner of, or have the necessary licences and permissions to use your Contributions; all your Contributions comply with applicable laws and are original and true; your Contributions do not infringe the intellectual property rights of any third party; and you have verifiable consent from any identifiable individual person in your Contributions.</p>
        <p style={s.p}>You also agree that you will not post any Contribution that is: in breach of applicable laws or court orders; defamatory, obscene, offensive, hateful, bullying, or threatening; false, inaccurate, or misleading; sexually explicit or harmful to minors; promoting violence or terrorism; discriminatory based on race, sex, religion, nationality, disability, sexual orientation, or age; or unsolicited advertising, spam, or pyramid schemes.</p>
        <p style={s.p}><strong>Dangerous Technical Content:</strong> You must not post any Contribution that: (a) provides instructions for electrical or electronic work that you know or ought reasonably to know is likely to cause injury, death, fire, or property damage if followed; (b) misrepresents the safety ratings, electrical specifications, or compliance status of any component or product; (c) encourages others to perform mains-voltage (240 V AC) electrical work without appropriate qualifications; (d) provides instructions for modifying lithium batteries, battery management systems, or chargers in a manner that creates a fire or explosion risk; or (e) omits material safety warnings that a reasonable person would expect to accompany such technical instructions. Any technical guide, tutorial, or post that involves inherent risk must include a prominent and accurate safety warning. We reserve the right to remove any Contribution that we consider poses a safety risk, without notice.</p>
        <p style={s.p}>You may not use our Services to offer or promote: items that encourage illegal activity; cigarettes, nicotine, alcohol, or controlled substances; regulated weapons, firearms, or ammunition; sexually oriented materials; stolen goods; products or services that do not comply with applicable Australian product safety standards; mains-voltage (240 V AC) circuits or equipment (we list ELV/LV products only); or any transaction requiring pre-approval that has not been obtained.</p>
        <p style={s.p}><strong>Third-Party Sellers:</strong> If you list products for sale on our platform, all customer claims, warranty obligations, and ACL liability for those products rest with you as the seller. You must not represent Outback Electronics as providing any warranty, guarantee, or endorsement for your products. Any product-related dispute from a customer will be referred to you as the seller. Outback Electronics' liability as a platform operator does not extend to the quality, safety, or fitness for purpose of products listed by third-party sellers.</p>
        <p style={s.p}><strong>Swap &amp; Sell Classifieds:</strong> Our Swap &amp; Sell classifieds feature lets members post free listings to buy, sell, swap, or give away items directly with other members. We are not a party to, and have no liability for, any transaction arising from a Swap &amp; Sell listing — including non-payment, non-delivery, item condition, item authenticity, or any dispute between the parties to the transaction. You deal with other members at your own risk and are responsible for satisfying yourself as to the legitimacy of the other party and the item before exchanging money or goods. By posting or responding to a Swap &amp; Sell listing, you warrant that: you lawfully own the item, or are authorised to sell or give it away, and it is not stolen, counterfeit, or encumbered; the item is not a regulated, prohibited, or restricted good under the categories listed above (including weapons, mains-voltage equipment, or anything requiring a licence you do not hold); and your listing is accurate and not misleading. We may remove any Swap &amp; Sell listing, and may report a listing or user to police or another relevant authority, without notice, where we reasonably suspect stolen goods, fraud, or another unlawful transaction.</p>
      </div>

      <div style={s.mt}><h3>Reviews and Ratings</h3>
        <p style={s.p}>When your Contribution is a review or rating, you also agree that: you have firsthand experience with the goods or services being reviewed; your Contribution is true to your experience; you are not affiliated with competitors if posting negative reviews; you will not make false or misleading statements; and you will not organise a campaign encouraging others to post reviews.</p>
      </div>

      <div style={s.mt}><h3>Reporting a Breach of This Policy</h3>
        <p style={s.p}>If you consider that any Service, Content, or Contribution breaches this Policy, please visit <a href="https://forum.outbackelectronics.com.au" target="_blank" rel="noopener noreferrer">forum.outbackelectronics.com.au</a> or contact us using the details below. For suspected intellectual property infringement, please review our <a href="/policies/terms-and-conditions">Terms and Conditions</a>.</p>
        <p style={s.p}>We will reasonably determine whether a Service, Content, or Contribution breaches this Policy and respond within a reasonable time.</p>
        <p style={s.p}>Australian users may also report harmful online content (including cyberbullying and image-based abuse) to the eSafety Commissioner at <a href="https://www.esafety.gov.au" target="_blank" rel="noopener noreferrer">www.esafety.gov.au</a> under the <em>Online Safety Act 2021</em> (Cth).</p>
      </div>

      <div style={s.mt}><h3>Consequences of Breaching This Policy</h3>
        <p style={s.p}>The consequences for violating our Policy will vary depending on the severity of the breach and the user's history on the Services. We may issue a warning and/or remove the infringing Contribution. For serious or repeated breaches, we have the right to suspend or terminate your access and, if applicable, disable your account. We may also notify law enforcement or issue legal proceedings when we believe there is a genuine risk to an individual or a threat to public safety.</p>
        <p style={s.p}>We exclude our liability for all action we may take in response to your breach of this Policy.</p>
      </div>

      <div style={s.mt}><h3>Complaints and Removal of Legitimate Content</h3>
        <p style={s.p}>If you consider that Content or a Contribution has been mistakenly removed or blocked, please contact us using the details below and we will promptly review our decision. The Content or Contribution may stay 'down' whilst we conduct the review. For more information, visit our <a href="https://forum.outbackelectronics.com.au/t/forum-rules/7" target="_blank" rel="noopener noreferrer">forum rules</a>.</p>
      </div>

      <div style={s.mt}><h3>Disclaimer</h3>
        <p style={s.p}>Outback Electronics is under no obligation to monitor users' activities, and we disclaim any responsibility for any user's misuse of the Services. Outback Electronics has no responsibility for any user or other Content or Contribution created, maintained, stored, transmitted, or accessible on or through the Services, and is not obligated to monitor or exercise any editorial control over such material. If Outback Electronics becomes aware that any such Content or Contribution violates this Policy, Outback Electronics may, in addition to removing such Content or Contribution and blocking your account, report such breach to the police or appropriate regulatory authority.</p>
        <p style={s.p}><strong>Technical Content Assumption of Risk:</strong> Any technical information, repair guides, tutorials, or similar content posted by other users on this platform has not been verified by us and may be incomplete, inaccurate, or unsuitable for your specific device, application, or skill level. You assume all risk associated with acting on any user-generated technical content. We are not liable for any loss, damage, personal injury, death, fire, or property damage arising from your reliance on user-generated technical content. Always verify technical information from authoritative sources and consult a qualified professional before undertaking any electrical or electronic work.</p>
      </div>

      <div style={s.mt}><h3>Contact Us</h3>
        <p style={s.p}>If you have any further questions or comments, or wish to report any problematic Content or Contribution, please contact us:</p>
        <p style={s.p}>Email: <a href={`mailto:${email}`}>{email}</a><br/>Online contact form: <a href="/contact">outbackelectronics.com.au/contact</a></p>
      </div>

      <hr className="thin" style={{marginTop:40}} />
      <div className="notice" style={{marginTop:24}}>
        <span className="tag tag-ink">QUESTIONS?</span>
        <div style={{fontSize:13, color:'var(--ink-2)'}}>Email <strong><a href={`mailto:${email}`}>{email}</a></strong> or use the <a href="/contact">contact form</a>.</div>
      </div>
    </div>
  );
}

function GeneralEngagementContent({ email, phone, address, abn }) {
  const s = {mt: {marginTop:32}, p: {fontSize:15, lineHeight:1.75, marginTop:8}};
  return (
    <div>
      <span className="eyebrow">LEGAL · GENERAL TERMS OF ENGAGEMENT</span>
      <h2 style={{marginTop:8}}>General Terms of Engagement</h2>
      <p style={s.p}>This document applies to <strong>every</strong> person or business that interacts with Outback Electronics ('Company', 'we', 'us', or 'our') in any capacity — private customer, commercial customer, seller, or otherwise.{abn ? ` Our ABN is ${abn}.` : ''}</p>

      <div style={s.mt}><h3>Commencement Is Acceptance</h3>
        <p style={s.p}>By doing any of the following, you accept and agree to be bound by all of our policies that apply to that activity (for example, our Terms and Conditions, Privacy Policy, Return Policy, Acceptable Use Policy, and — where relevant — our Custom Work and Reverse Engineering Policy, Seller Agreement, or Commercial Terms and Conditions):</p>
        <ul style={{paddingLeft:20, lineHeight:2, marginTop:8}}>
          <li>placing an order, paying a deposit, or paying for goods or services;</li>
          <li>submitting a repair, quote, or custom work request, or handing over a device or materials to us;</li>
          <li>creating an account on our Site, forum, customer portal, or seller dashboard;</li>
          <li>listing a product for sale on our platform as a seller;</li>
          <li>otherwise using our Site, services, or facilities.</li>
        </ul>
        <p style={s.p}>You do not need to separately sign or click-accept each individual policy for it to apply — commencing the relevant activity is itself your acceptance, in the same way that walking into a shop and placing an order implies acceptance of that shop's standard terms of trade. Where we ask you to expressly sign or click-accept a specific document (for example, a quote, a non-disclosure agreement, or a seller agreement), that document applies in addition to, and to the extent of any inconsistency prevails over, this general statement.</p>
      </div>

      <div style={s.mt}><h3>Which Policies Apply to You</h3>
        <p style={s.p}>Use the audience selector on this page to view the specific documents that apply to your relationship with us (private customer, commercial customer, or seller). Some documents — such as our Privacy Policy, Cookie Policy, and Acceptable Use Policy — apply to everyone regardless of audience. Others — such as our Commercial Terms and Conditions or Seller Agreement — apply only where that relationship exists.</p>
      </div>

      <div style={s.mt}><h3>Updates to Our Policies</h3>
        <p style={s.p}>We may update any of our policies from time to time. Continuing to engage with us after an update takes effect constitutes acceptance of the updated policy. Material changes will be dated on the relevant document.</p>
      </div>

      <div style={s.mt}><h3>Contact Us</h3>
        <p style={s.p}><strong>Outback Electronics</strong><br/>{address}, Australia<br/>Phone: <a href={`tel:${(phone||'').replace(/\s/g,'')}`}>{phone}</a><br/>Email: <a href={`mailto:${email}`}>{email}</a></p>
      </div>

      <hr className="thin" style={{marginTop:40}} />
      <div className="notice" style={{marginTop:24}}>
        <span className="tag tag-ink">QUESTIONS?</span>
        <div style={{fontSize:13, color:'var(--ink-2)'}}>Email <strong><a href={`mailto:${email}`}>{email}</a></strong> — we'll get back to you as soon as we can.</div>
      </div>
    </div>
  );
}

function GiftCardStoreCreditContent({ email, phone, address, abn }) {
  const s = {mt: {marginTop:32}, p: {fontSize:15, lineHeight:1.75, marginTop:8}};
  return (
    <div>
      <span className="eyebrow">LEGAL · GIFT CARDS, STORE CREDIT &amp; REWARDS</span>
      <h2 style={{marginTop:8}}>Gift Cards, Store Credit &amp; Rewards Terms</h2>
      <p style={s.p}>This policy governs gift cards, store credit, and rewards points issued by Outback Electronics ('Company', 'we', 'us', or 'our').{abn ? ` Our ABN is ${abn}.` : ''} It applies alongside our Terms and Conditions and Return Policy.</p>

      <div style={s.mt}><h3>1. Gift Cards</h3>
        <p style={s.p}><strong>Validity and Expiry.</strong> Gift cards are valid for at least three (3) years from the date of issue, in accordance with the minimum expiry period required by the Australian Consumer Law. We will state the specific expiry date on the gift card or its accompanying record at the time of issue.</p>
        <p style={s.p}><strong>Not Redeemable for Cash.</strong> Gift cards cannot be redeemed or exchanged for cash, in whole or in part, except where required by law. They can only be applied against the purchase of goods or services from us.</p>
        <p style={s.p}><strong>Lost or Stolen Cards.</strong> We treat a gift card code as equivalent to cash. We are not responsible for, and will not replace or refund, a gift card that is lost, stolen, or used without your authorisation, except where required by law or where we are reasonably satisfied of fraud on our part.</p>
        <p style={s.p}><strong>Partial Use and Balance.</strong> If a purchase is less than your gift card balance, the remaining balance stays on the card for future use until it expires. You can check your balance using the balance lookup on our Site or by contacting us.</p>
        <p style={s.p}><strong>No Resale.</strong> Gift cards may not be resold or on-sold for a profit. We may void a gift card we reasonably believe was obtained fraudulently (for example, through a disputed or charged-back payment) and are not liable for any resulting loss to a subsequent holder who is not the original purchaser.</p>
      </div>

      <div style={s.mt}><h3>2. Store Credit</h3>
        <p style={s.p}>Store credit may be issued by us at our discretion (for example, as part of a refund, a trade-in, or a goodwill gesture) or where you have elected to receive store credit instead of a cash refund where both are offered. Store credit:</p>
        <ul style={{paddingLeft:20, lineHeight:2, marginTop:8}}>
          <li>is not redeemable for cash and can only be applied against future purchases from us;</li>
          <li>does not expire unless we tell you otherwise at the time it is issued;</li>
          <li>is not transferable to another person or account except with our written consent; and</li>
          <li>may be reversed or adjusted by us where it was issued in error, or where the transaction it relates to is reversed, refunded, or subject to a successful chargeback by the original payment method.</li>
        </ul>
        <p style={s.p}>Where store credit was issued as an incentive (for example, a trade-in bonus for accepting credit instead of cash), that bonus amount may be removed if the underlying transaction is later unwound — for example, because the traded-in item was misdescribed, found to be faulty contrary to your description, or found not to be lawfully yours to sell.</p>
      </div>

      <div style={s.mt}><h3>3. Rewards Points</h3>
        <p style={s.p}>Rewards points are issued at our discretion as a loyalty benefit and have no cash value. Points may be redeemed for a discount on a future purchase in accordance with the redemption rate displayed in your account at the time of redemption, which we may change going forward without affecting points already earned.</p>
        <p style={s.p}><strong>Clawback on Refund or Chargeback.</strong> If an order that earned rewards points is later refunded, cancelled, or successfully charged back, we may deduct the points earned on that order from your account, even if you have since redeemed them — in which case your account balance may go negative and must be repaid through future earned points, or we may instead invoice you for the value of the discount obtained using those points, at our discretion.</p>
        <p style={s.p}><strong>Fraud and Abuse.</strong> We may suspend, adjust, or cancel rewards points, and may close the associated account, where we reasonably suspect the points were earned through fraud, abuse of the program (including the use of multiple accounts), or a breach of these terms.</p>
        <p style={s.p}>Rewards points have no value if your account is closed for breach of our Terms and Conditions or Acceptable Use Policy, and do not survive the death of the account holder except as required by law.</p>
      </div>

      <div style={s.mt}><h3>4. Contact Us</h3>
        <p style={s.p}><strong>Outback Electronics</strong><br/>{address}, Australia<br/>Phone: <a href={`tel:${(phone||'').replace(/\s/g,'')}`}>{phone}</a><br/>Email: <a href={`mailto:${email}`}>{email}</a></p>
      </div>

      <hr className="thin" style={{marginTop:40}} />
      <div className="notice" style={{marginTop:24}}>
        <span className="tag tag-ink">QUESTIONS?</span>
        <div style={{fontSize:13, color:'var(--ink-2)'}}>Email <strong><a href={`mailto:${email}`}>{email}</a></strong> — we'll get back to you as soon as we can.</div>
      </div>
    </div>
  );
}

function SaleOfGoodsToUsContent({ email, phone, address, abn }) {
  const s = {mt: {marginTop:32}, p: {fontSize:15, lineHeight:1.75, marginTop:8}};
  return (
    <div>
      <span className="eyebrow">LEGAL · SALE OF GOODS TO US</span>
      <h2 style={{marginTop:8}}>Sale of Goods to Us — Trade-In, E-Waste &amp; Consignment</h2>
      <p style={s.p}>This policy applies whenever you sell, trade in, consign, or otherwise provide used or end-of-life electronics or equipment to Outback Electronics ('Company', 'we', 'us', or 'our') — whether through our outright purchase, consignment, trade credit, or e-waste take-back programs ('Sale Programs').{abn ? ` Our ABN is ${abn}.` : ''} It applies alongside our Terms and Conditions.</p>

      <div style={s.mt}><h3>1. Your Warranties of Title</h3>
        <p style={s.p}>By offering an item to us under any Sale Program, you warrant that:</p>
        <ul style={{paddingLeft:20, lineHeight:2, marginTop:8}}>
          <li>you are the lawful owner of the item, or have the owner's express authority to sell, consign, or dispose of it on their behalf;</li>
          <li>the item is not stolen, subject to any security interest, lease, finance arrangement, or third-party claim, and is free of any encumbrance;</li>
          <li>you have removed or disclosed any personal data, account locks (e.g. Find My, BIOS/firmware passwords, cloud activation locks), or other access restrictions that would prevent us from inspecting, testing, refurbishing, or reselling the item; and</li>
          <li>your description of the item's condition, fault history, and included accessories is accurate and complete to the best of your knowledge.</li>
        </ul>
        <p style={s.p}>You indemnify us against any claim, loss, or liability arising from a breach of these warranties, including any claim by a third party asserting an interest in the item.</p>
      </div>

      <div style={s.mt}><h3>2. Verification and Right to Decline or Report</h3>
        <p style={s.p}>We may ask you for photo ID and proof of ownership (such as a receipt, warranty card, or account login demonstrating control of the device) before accepting an item, particularly for higher-value items or where the circumstances of the offer raise concern. We may decline to accept any item without giving a reason. Where we reasonably suspect an item offered to us is stolen or otherwise unlawfully obtained, we may refuse the transaction, retain the item, and report the matter — including your personal information and any identification you have provided — to police or another relevant authority, without further notice to you.</p>
      </div>

      <div style={s.mt}><h3>3. Grading and Pricing</h3>
        <p style={s.p}>Items are graded (e.g. A/B/C/D) and priced based on our assessment of condition, function, and current resale value at the time of inspection, which may differ from any estimate given before physical inspection. We will confirm the final grade and price with you before completing an outright purchase or trade credit transaction. For consignment, the listing price and commission are agreed separately and set out in our Seller Agreement or consignment terms provided to you at the time.</p>
        <p style={s.p}>If, after inspection, an item does not match its description (for example, a fault was not disclosed, or an accessory listed as included is missing), we may revise our offer, decline the item, or — where the transaction has already completed — reverse the payment or store credit issued, including any associated bonus (see our Gift Cards, Store Credit &amp; Rewards Terms).</p>
      </div>

      <div style={s.mt}><h3>4. Outright Purchase</h3>
        <p style={s.p}>Where we purchase an item outright, ownership transfers to us on payment, and the transaction is final — there is no cooling-off period or right to reverse the sale on your part, except as required by law (for example, where you were misled or the transaction was procured by fraud).</p>
      </div>

      <div style={s.mt}><h3>5. Consignment</h3>
        <p style={s.p}>Under consignment, you remain the owner of the item until it sells. We list and sell the item on your behalf for an agreed commission, and remit the net proceeds to you in accordance with the timeframe agreed at the time of listing. If the item does not sell within the agreed listing period, we will offer to return it to you, dispose of it, or relist it at a reduced price, as agreed. We are not liable for loss or damage to a consigned item beyond what is required by law, but will take reasonable care of it while in our possession.</p>
      </div>

      <div style={s.mt}><h3>6. Trade Credit</h3>
        <p style={s.p}>Where you elect to receive store credit instead of cash for a trade-in, any bonus applied to the store credit amount is subject to clause 3 (Grading and Pricing) above and our Gift Cards, Store Credit &amp; Rewards Terms, including reversal if the underlying transaction is later found to be based on an inaccurate description or an item you were not entitled to sell.</p>
      </div>

      <div style={s.mt}><h3>7. E-Waste / No-Value Items</h3>
        <p style={s.p}>Items accepted for recycling or disposal with no resale value are accepted on the basis that you are surrendering ownership to us at no charge, for responsible recycling or disposal. The warranties in clause 1 still apply.</p>
      </div>

      <div style={s.mt}><h3>8. Contact Us</h3>
        <p style={s.p}><strong>Outback Electronics</strong><br/>{address}, Australia<br/>Phone: <a href={`tel:${(phone||'').replace(/\s/g,'')}`}>{phone}</a><br/>Email: <a href={`mailto:${email}`}>{email}</a></p>
      </div>

      <hr className="thin" style={{marginTop:40}} />
      <div className="notice" style={{marginTop:24}}>
        <span className="tag tag-ink">QUESTIONS?</span>
        <div style={{fontSize:13, color:'var(--ink-2)'}}>Email <strong><a href={`mailto:${email}`}>{email}</a></strong> — we'll get back to you as soon as we can.</div>
      </div>
    </div>
  );
}

// POLICIES
// ============================================================
const POLICY_AUDIENCES = {
  all: {
    label: 'All Customers',
    defaultSlug: 'terms-of-engagement',
    docs: {
      'terms-of-engagement': { title: 'General Terms of Engagement', updated: 'June 19, 2026', Component: GeneralEngagementContent },
      'privacy-policy': { title: 'Privacy Policy', updated: 'June 6, 2026', Component: PrivacyContent },
      'cookie-policy': { title: 'Cookie Policy', updated: 'June 6, 2026', Component: CookieContent },
      'acceptable-use': { title: 'Acceptable Use Policy', updated: 'June 6, 2026', Component: AcceptableUseContent },
      'disclaimer': { title: 'Disclaimer', updated: 'June 6, 2026', Component: DisclaimerContent },
      'gift-cards-store-credit-rewards': { title: 'Gift Cards, Store Credit & Rewards Terms', updated: 'June 19, 2026', Component: GiftCardStoreCreditContent },
      'sale-of-goods-to-us': { title: 'Sale of Goods to Us', updated: 'June 19, 2026', Component: SaleOfGoodsToUsContent },
    },
  },
  private: {
    label: 'Private Customer',
    defaultSlug: 'terms-and-conditions',
    docs: {
      'terms-and-conditions': { title: 'Terms & Conditions', updated: 'June 6, 2026', Component: TermsContent },
      'privacy-policy': { title: 'Privacy Policy', updated: 'June 6, 2026', Component: PrivacyContent },
      'shipping-and-delivery': { title: 'Shipping & Delivery', updated: 'June 6, 2026', Component: ShippingContent },
      'cookie-policy': { title: 'Cookie Policy', updated: 'June 6, 2026', Component: CookieContent },
      'return-policy': { title: 'Return Policy', updated: 'June 6, 2026', Component: ReturnContent },
      'custom-work': { title: 'Custom Work & Reverse Engineering', updated: 'June 19, 2026', Component: CustomWorkContent },
      'disclaimer': { title: 'Disclaimer', updated: 'June 6, 2026', Component: DisclaimerContent },
      'acceptable-use': { title: 'Acceptable Use Policy', updated: 'June 6, 2026', Component: AcceptableUseContent },
      'gift-cards-store-credit-rewards': { title: 'Gift Cards, Store Credit & Rewards Terms', updated: 'June 19, 2026', Component: GiftCardStoreCreditContent },
      'sale-of-goods-to-us': { title: 'Sale of Goods to Us', updated: 'June 19, 2026', Component: SaleOfGoodsToUsContent },
    },
  },
  commercial: {
    label: 'Commercial Customer',
    defaultSlug: 'terms-and-conditions',
    docs: {
      'terms-and-conditions': { title: 'Terms & Conditions', updated: 'June 6, 2026', Component: CommercialTermsContent },
      'return-policy': { title: 'Return Policy', updated: 'June 6, 2026', Component: CommercialReturnContent },
      'custom-work': { title: 'Custom Work & Reverse Engineering', updated: 'June 19, 2026', Component: CustomWorkContent },
      'privacy-policy': { title: 'Privacy Policy', updated: 'June 6, 2026', Component: PrivacyContent },
      'shipping-and-delivery': { title: 'Shipping & Delivery', updated: 'June 6, 2026', Component: ShippingContent },
      'cookie-policy': { title: 'Cookie Policy', updated: 'June 6, 2026', Component: CookieContent },
      'disclaimer': { title: 'Disclaimer', updated: 'June 6, 2026', Component: DisclaimerContent },
      'acceptable-use': { title: 'Acceptable Use Policy', updated: 'June 6, 2026', Component: AcceptableUseContent },
      'gift-cards-store-credit-rewards': { title: 'Gift Cards, Store Credit & Rewards Terms', updated: 'June 19, 2026', Component: GiftCardStoreCreditContent },
      'sale-of-goods-to-us': { title: 'Sale of Goods to Us', updated: 'June 19, 2026', Component: SaleOfGoodsToUsContent },
    },
  },
  seller: {
    label: 'Seller',
    defaultSlug: 'terms-and-conditions',
    docs: {
      'terms-and-conditions': { title: 'OHD001 – Terms and Conditions for Sellers', updated: 'June 6, 2026', Component: SellerTermsContent },
      'quality-standards': { title: 'OHD002 – Design Quality Standards', updated: 'June 6, 2026', Component: SellerQualityContent },
      'fees-schedule': { title: 'OHD003 – Fees Schedule', updated: 'June 6, 2026', Component: SellerFeesContent },
      'listing-requirements': { title: 'OHD004 – Listing Requirements', updated: 'June 6, 2026', Component: SellerListingContent },
    },
  },
};

// Back-compat for the old single-segment slugs used before audience-scoped URLs existed.
const LEGACY_POLICY_SLUGS = {
  'commercial-terms': { audience: 'commercial', slug: 'terms-and-conditions' },
  'commercial-returns': { audience: 'commercial', slug: 'return-policy' },
  'seller-terms': { audience: 'seller', slug: 'terms-and-conditions' },
  'seller-quality': { audience: 'seller', slug: 'quality-standards' },
  'seller-fees': { audience: 'seller', slug: 'fees-schedule' },
  'seller-listing': { audience: 'seller', slug: 'listing-requirements' },
};

function findPolicyAudience(slug) {
  for (const [key, group] of Object.entries(POLICY_AUDIENCES)) {
    if (group.docs[slug]) return key;
  }
  return null;
}

function PoliciesPage({ go, pageParams }) {
  const shop = useShop();
  const fullAddress = [shop.streetAddress, shop.suburb, shop.state, shop.postcode].filter(Boolean).join(', ');
  const email = shop.email;
  const phone = shop.phone;
  const address = fullAddress;
  const abn = shop.abn;

  // Resolve the incoming params: prefer an explicit two-segment {audience, slug},
  // fall back to legacy single-segment slugs (some of which moved audience+slug on rename).
  let rawSlug = pageParams?.slug || 'terms-and-conditions';
  let urlAudience = pageParams?.audience;
  if (!urlAudience && LEGACY_POLICY_SLUGS[rawSlug]) {
    urlAudience = LEGACY_POLICY_SLUGS[rawSlug].audience;
    rawSlug = LEGACY_POLICY_SLUGS[rawSlug].slug;
  }
  const resolvedAudience = (urlAudience && POLICY_AUDIENCES[urlAudience]) ? urlAudience : (findPolicyAudience(rawSlug) || 'private');
  const [audience, setAudience] = useState(resolvedAudience);

  useEffect(() => {
    if (resolvedAudience !== audience) setAudience(resolvedAudience);
  }, [resolvedAudience]);

  const goDoc = (a, s) => go('policies', { audience: a, slug: s });
  const onAudienceChange = (next) => {
    setAudience(next);
    goDoc(next, POLICY_AUDIENCES[next].defaultSlug);
  };

  const group = POLICY_AUDIENCES[audience] || POLICY_AUDIENCES.private;
  const DOCS = group.docs;
  const activeDoc = DOCS[rawSlug] ? rawSlug : group.defaultSlug;
  const DocComponent = DOCS[activeDoc].Component;

  return (
    <>
      <PageHead crumbs={['Outback', 'Policies', DOCS[activeDoc]?.title]} title={DOCS[activeDoc]?.title}
        lead={`Last updated ${DOCS[activeDoc]?.updated}`} />
      <section className="container" style={{paddingTop: 32, paddingBottom: 60}}>
        <div className="policy-layout">
          <aside className="policy-nav" aria-label="Policy documents">
            <div className="eyebrow" style={{padding:'0 0 8px 0', marginBottom:4}}>VIEWING AS</div>
            <select
              value={audience}
              onChange={(e) => onAudienceChange(e.target.value)}
              style={{width:'100%', padding:'10px 12px', marginBottom:20, border:'1px solid var(--line)', borderRadius:6, fontSize:14, background:'var(--bg)', color:'var(--ink)'}}
            >
              {Object.entries(POLICY_AUDIENCES).map(([key, g]) => (
                <option key={key} value={key}>{g.label}</option>
              ))}
            </select>
            <div className="eyebrow" style={{padding:'0 0 8px 0', marginBottom:4}}>DOCUMENTS</div>
            {Object.entries(DOCS).map(([s, d]) => (
              <a key={s} href={`/policies/${audience}/${s}`} className={activeDoc===s?'active':''} aria-current={activeDoc===s ? 'page' : undefined} onClick={(e) => { e.preventDefault(); goDoc(audience, s); }}>{d.title}</a>
            ))}
          </aside>
          <div className="policy-content">
            <DocComponent email={email} phone={phone} address={address} abn={abn} />
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
