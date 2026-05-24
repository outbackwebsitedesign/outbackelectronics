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
function QuotePage({ go }) {
  const shop = useShop();
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [ticketId, setTicketId] = useState(null);
  const [form, setForm] = useState({ kind: 'Repair', budget: '$1k–$5k', urgency: 'Standard', name: '', email: '', loc: '', desc: '' });
  const update = (k, v) => setForm(f => ({ ...f, [k]: v }));

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
      <section className="container" style={{paddingTop: 32, paddingBottom: 60, display:'grid', gridTemplateColumns:'1fr 320px', gap: 48}}>
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
                  {['Under $500','$500–$1k','$1k–$5k','$5k–$25k','$25k+','Tell us'].map(b => (
                    <label key={b} style={{display:'flex', alignItems:'center', gap:8, fontSize:14, padding:'4px 0', cursor:'pointer'}}>
                      <input type="radio" name="budget" checked={form.budget===b} onChange={() => update('budget',b)} />{b}
                    </label>
                  ))}
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
                  ].map(b => (
                    <label key={b.v} style={{display:'flex', alignItems:'center', gap:8, fontSize:14, padding:'4px 0', cursor:'pointer'}}>
                      <input type="radio" name="urgency" checked={form.urgency===b.v} onChange={() => update('urgency',b.v)} />{b.l}
                    </label>
                  ))}
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

            <hr className="thin" />
            <span className="eyebrow">05 · DESCRIBE THE JOB</span>
            <p style={{fontSize:13, color:'var(--ink-2)', marginTop:6, marginBottom: 10}}>Plain English is great. Photos can come later — we'll reply with an upload link.</p>
            <label className="field"><textarea className="textarea" value={form.desc} onChange={e => update('desc', e.target.value)} placeholder="My 6kW Fronius inverter is throwing 'AC Voltage High' once it gets over 38°C in the shed. Worked fine all winter. House is 80km west of Birdsville." style={{minHeight: 160}} /></label>

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
            <div className="serif" style={{fontSize:32, marginTop:14, color:'var(--rust)'}}>{shop.phone}</div>
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
      setQmError('Message could not be sent. Please email us directly at outbackhutelectronics@gmail.com.');
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
              <h3 className="serif" style={{fontSize: 36, marginTop: 8}}>{shop.address}</h3>
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
                <div className="serif" style={{fontSize: 28, marginTop:8, color:'var(--rust)'}}>{shop.phone}</div>
                <div className="mono" style={{fontSize:11, color:'var(--ink-2)', marginTop:4}}>CALL OR SMS TO BOOK AN APPOINTMENT</div>
              </div>
              <div className="card-paper" style={{padding: 22}}>
                <span className="eyebrow">EMAIL</span>
                <div style={{fontSize: 18, marginTop:8, fontWeight:600}}>outbackhutelectronics@gmail.com</div>
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
            <div className="slot slot-rust" style={{aspectRatio: '4/5', position:'relative', overflow:'hidden'}}>
              <div style={{position:'absolute', inset:0}}>
                {/* fake map grid */}
                <svg width="100%" height="100%" style={{opacity:0.35}}>
                  <defs>
                    <pattern id="g" width="40" height="40" patternUnits="userSpaceOnUse">
                      <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(31,26,20,0.3)" strokeWidth="0.5"/>
                    </pattern>
                  </defs>
                  <rect width="100%" height="100%" fill="url(#g)" />
                </svg>
              </div>
              <div style={{position:'absolute', top:'45%', left:'45%', width:24, height:24, background:'var(--rust)', borderRadius:'50%', border:'3px solid var(--paper)'}}></div>
              <div style={{position:'absolute', top:'calc(45% + 28px)', left:'calc(45% + 8px)', background:'var(--ink)', color:'var(--paper)', padding:'6px 10px', fontFamily:'JetBrains Mono, monospace', fontSize:11}}>23.6980°S, 133.8807°E</div>
              <div style={{position:'absolute', bottom:16, left:16, background:'var(--paper)', padding:'10px 14px', fontFamily:'JetBrains Mono, monospace', fontSize:10, color:'var(--ink)'}}>MAP · ALICE SPRINGS · GAP RD</div>
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
                  <label className="field" style={{marginTop:10}}><input className="input" placeholder="your name" value={qm.name} onChange={e => setQm(q => ({...q, name: e.target.value}))} required /></label>
                  <label className="field"><input className="input" placeholder="your email" type="email" value={qm.email} onChange={e => setQm(q => ({...q, email: e.target.value}))} required /></label>
                  <label className="field"><textarea className="textarea" placeholder="message…" value={qm.msg} onChange={e => setQm(q => ({...q, msg: e.target.value}))} required /></label>
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
function SellersPage({ go }) {
  return (
    <>
      <PageHead crumbs={['Outback','Info for Sellers']} title="Info for Sellers"
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

// ============================================================
// POLICIES
// ============================================================
function PoliciesPage() {
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
                  <div style={{fontSize:13, color:'var(--ink-2)'}}>Email <strong>outbackhutelectronics@gmail.com</strong> — we'll route you to whoever wrote the policy.</div>
                </div>
              </div>
            )}
          </div>
        )}
      </section>
    </>
  );
}

window.OE_PAGES = Object.assign(window.OE_PAGES || {}, {
  quote: QuotePage,
  contact: ContactPage,
  sellers: SellersPage,
  policies: PoliciesPage,
});
