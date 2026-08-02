import React, { useState, useEffect, useMemo, useContext, useRef } from 'react';
import { getCsrf, ensureCsrf } from './src/lib/api.js';
import { bulkUnitPrice, hasBulkPrice, bulkOfferAvailable, availableStock, productPrice, isBackorder, onHandStock, backorderLead } from './src/lib/pricing.js';
import { CONDITION_COLORS } from './src/lib/conditions.js';

const _fallbackShopCtx = React.createContext({});
const useShop = () => useContext(window.__ShopContext__ || _fallbackShopCtx);

// Service descriptions are authored with {{serviceArea}} placeholders (see
// services.db) so location text stays correct across shop setting changes
// without a redeploy, fill it in with the live shop suburb just before render.
function interpolateServiceText(text, shop) {
  const area = [shop.suburb, shop.state].filter(Boolean).join('–') || 'our local area';
  return String(text || '').replace(/\{\{serviceArea\}\}/g, area);
}

function thumbUrl(src, w, q) {
  if (!src || !src.startsWith('/assets/uploads/')) return src;
  const qs = q ? `&q=${q}` : '';
  return `/api/thumb?src=${encodeURIComponent(src)}&w=${w}${qs}`;
}

// Responsive srcset so the browser downloads an image sized for the actual
// display + device pixel ratio instead of always pulling the largest variant.
function thumbSrcSet(src, widths, q) {
  if (!src || !src.startsWith('/assets/uploads/')) return undefined;
  return widths.map(w => `${thumbUrl(src, w, q)} ${w}w`).join(', ');
}

// ============================================================
// HOME
// ============================================================
function HomePage({ go, addToCart, portalUser }) {
  const shop = useShop();
  const [featuredProducts, setFeaturedProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [metrics, setMetrics] = useState({ repairCount: null, ewasteTonnes: null });
  const [testimonials, setTestimonials] = useState([]);
  const [tIdx, setTIdx] = useState(0);
  const [clients, setClients] = useState([]);
  const heroProduct = useMemo(() => featuredProducts.find(p => p.infiniteStock || p.stock > 0) || featuredProducts[0] || null, [featuredProducts]);
  const [aiData, setAiData] = useState(null);
  const [repairServices, setRepairServices] = useState([]);
  const [siteContent, setSiteContent] = useState({});
  const [recentThreads, setRecentThreads] = useState([]);
  const [loading, setLoading] = useState(true);
  const skuCounts = useMemo(() => {
    const counts = {};
    for (const p of featuredProducts) { counts[p.category] = (counts[p.category] || 0) + 1; }
    return counts;
  }, [featuredProducts]);

  const categoryImages = useMemo(() => {
    const map = {};
    for (const p of featuredProducts) {
      if (!p.category || !p.images || p.images.length === 0) continue;
      if (!map[p.category]) map[p.category] = [];
      if (map[p.category].length < 4) map[p.category].push(p.images[0]);
    }
    return map;
  }, [featuredProducts]);
  useEffect(() => {
    Promise.allSettled([
      fetch('/api/catalog/products').then(r => r.json()).then(d => setFeaturedProducts(d.items || [])).catch(() => setFeaturedProducts(window.CATALOG_DATA?.getPublicProducts?.() || [])),
      fetch('/api/catalog/filters').then(r => r.ok ? r.json() : Promise.reject()).then(d => setCategories(d.categories || [])).catch(() => {}),
      fetch('/api/metrics').then(r => r.json()).then(d => setMetrics(d)).catch(() => {}),
      fetch('/api/testimonials').then(r => r.ok ? r.json() : Promise.reject()).then(d => setTestimonials(d.testimonials || [])).catch(() => {}),
      fetch('/api/clients').then(r => r.ok ? r.json() : Promise.reject()).then(d => setClients(d.items || [])).catch(() => {}),
      fetch('/api/ai').then(r => r.ok ? r.json() : Promise.reject()).then(d => setAiData(d)).catch(() => {}),
      fetch('/api/catalog/services').then(r => r.ok ? r.json() : Promise.reject()).then(d => setRepairServices(d.items || [])).catch(() => {}),
      fetch('/api/settings').then(r => r.ok ? r.json() : Promise.reject()).then(d => setSiteContent(d.siteContent || {})).catch(() => {}),
      fetch('/api/forum/recent').then(r => r.ok ? r.json() : Promise.reject()).then(d => setRecentThreads(d.topics || [])).catch(() => {}),
    ]).finally(() => { setLoading(false); setTimeout(() => window.observeReveal && window.observeReveal(), 80); });
  }, []);
  // Gently cycle through the featured testimonials + approved reviews.
  useEffect(() => {
    if (testimonials.length < 2) return;
    const t = setInterval(() => setTIdx(i => (i + 1) % testimonials.length), 6000);
    return () => clearInterval(t);
  }, [testimonials]);
  const testimonial = testimonials[tIdx] || null;
  if (loading) {
    return (
      <div style={{padding: '56px 0'}}>
        <div className="container">
          <div style={{display:'grid', gridTemplateColumns:'1.2fr 1fr', gap: 48, alignItems:'center', marginBottom: 48}}>
            <div style={{display:'flex', flexDirection:'column', gap: 16}}>
              <div className="skeleton" style={{height: 20, width: 280, borderRadius: 4}} />
              <div className="skeleton" style={{height: 80, width: '90%', borderRadius: 8}} />
              <div className="skeleton" style={{height: 60, width: '75%', borderRadius: 8}} />
              <div className="skeleton" style={{height: 20, width: '85%', borderRadius: 4}} />
              <div className="skeleton" style={{height: 20, width: '70%', borderRadius: 4}} />
              <div style={{display:'flex', gap: 12, marginTop: 8}}>
                <div className="skeleton" style={{height: 48, width: 140, borderRadius: 6}} />
                <div className="skeleton" style={{height: 48, width: 120, borderRadius: 6}} />
              </div>
            </div>
            <div className="skeleton" style={{height: 380, borderRadius: 12}} />
          </div>
          <div style={{display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap: 24, marginBottom: 48}}>
            {[0,1,2].map(i => <div key={i} className="skeleton" style={{height: 100, borderRadius: 8}} />)}
          </div>
          <div style={{display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap: 24}}>
            {[0,1,2,3].map(i => <div key={i} className="skeleton" style={{height: 320, borderRadius: 8}} />)}
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Hero */}
      <section className="hero-section" style={{position:'relative'}}>
        <div className="container" style={{paddingTop: 56, paddingBottom: 56}}>
          <div className="hero-grid" style={{display:'grid', gridTemplateColumns:'1.2fr 1fr', gap: 48, alignItems:'center'}}>
            <div>
              <span className="eyebrow hero-eyebrow">EST. 2023 · APPOINTMENT ONLY · REMOTE ELECTRONICS SUPPORT</span>
              <h1 className="serif hero-headline" style={{fontSize: 92, marginTop: 14, lineHeight: 0.95}}>
                Built for where<br/>
                <span className="italic" style={{color:'var(--rust)'}}>the signal ends.</span>
              </h1>
              <p className="hero-sub" style={{marginTop: 22, fontSize: 18, maxWidth: 520, color:'var(--ink-2)'}}>
                Arduino &amp; microcontroller gear, PC &amp; phone parts, software tools, and off-grid electronics - an obstinate community of tinkerers serving remote Australia{(shop.suburb || shop.state) ? ` from ${[shop.suburb, shop.state].filter(Boolean).join(', ')}` : ''} by appointment only.
              </p>
              <div className="row-flex hero-actions" style={{marginTop: 28}}>
                <button className="btn btn-rust" onClick={() => go('shop')}>Browse the Shop →</button>
                <button className="btn btn-ghost" onClick={() => go('services')}>Book a Repair</button>
                {shop.phone && <span className="mono" style={{fontSize:12, color:'var(--ink-2)'}}>OR · CALL {shop.phone}</span>}
              </div>
              {portalUser === null && (
                <div className="hero-actions" style={{marginTop:18, display:'flex', alignItems:'center', gap:10, padding:'12px 16px', border:'1px solid var(--line)', background:'var(--paper)', maxWidth:'fit-content', animationDelay:'380ms'}}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{color:'var(--ink-3)', flexShrink:0}}><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-7 8-7s8 3 8 7"/></svg>
                  <span style={{fontSize:13, color:'var(--ink-2)'}}>New customer?</span>
                  <a href={`${shop._portalUrl || 'https://portal.outbackelectronics.com.au'}/?tab=register`} style={{fontSize:13, color:'var(--rust)', fontWeight:600, textDecoration:'none'}}>Create a free account</a>
                  <span style={{fontSize:13, color:'var(--ink-3)'}}>·</span>
                  <a href={`${shop._portalUrl || 'https://portal.outbackelectronics.com.au'}/?tab=login`} style={{fontSize:13, color:'var(--ink-2)', textDecoration:'none'}}>Sign in</a>
                </div>
              )}
              <div className="row-flex hero-stats" style={{marginTop: 36, gap: 32, borderTop:'1px solid var(--line)', paddingTop: 22}}>
                <div><div className="serif" style={{fontSize:32, color:'var(--rust)'}}>{metrics.repairCount !== null ? metrics.repairCount.toLocaleString() : '-'}</div><div className="eyebrow">REPAIRS LOGGED</div></div>
                <div><div className="serif" style={{fontSize:32, color:'var(--rust)'}}>{metrics.ewasteTonnes !== null ? metrics.ewasteTonnes.toFixed(1) + 't' : '-'}</div><div className="eyebrow">E-WASTE DIVERTED</div></div>
              </div>
            </div>
            <div className="hero-image" style={{position:'relative'}}>
              {heroProduct && heroProduct.images && heroProduct.images.length > 0
                ? <img src={thumbUrl(heroProduct.images[0], 1000, 82)} srcSet={thumbSrcSet(heroProduct.images[0], [600, 800, 1000, 1200], 82)} sizes="(max-width: 900px) 100vw, 560px" alt={heroProduct.name} fetchpriority="high" style={{width:'100%', aspectRatio:'4/5', objectFit:'cover', display:'block'}} />
                : <div className="slot slot-rust" style={{aspectRatio: '4/5'}}>RUGGED LAPTOP ON RED-DIRT WORKBENCH</div>}
              {heroProduct && (
                <div className="card-paper" style={{position:'absolute', bottom:16, left:16, padding:18, width:240, boxShadow:'var(--shadow)'}}>
                  <div className="eyebrow">FIELD-TESTED</div>
                  <div className="serif" style={{fontSize:22, marginTop:6, lineHeight:1.1}}>{heroProduct.name}{heroProduct.cond ? ` // ${heroProduct.cond}` : ''}</div>
                  <div className="row-flex" style={{justifyContent:'space-between', marginTop:10}}>
                    <span className="price">${productPrice(heroProduct).toLocaleString('en-AU')}</span>
                    <span className={`tag ${(heroProduct.infiniteStock || heroProduct.stock > 0) ? 'tag-euc' : 'tag-outline'}`}>{(heroProduct.infiniteStock || heroProduct.stock > 0) ? 'IN STOCK' : 'OUT OF STOCK'}</span>
                  </div>
                </div>
              )}
              {testimonial && (
                <div className="card" style={{position:'absolute', top: -20, right: -16, padding:14, width:200, cursor:'pointer'}}
                  onClick={() => go('reviews')} title="Read all customer reviews">
                  <div className="row-flex" style={{justifyContent:'space-between', marginBottom:6}}>
                    <div className="mono" style={{fontSize:10, color:'var(--ink-2)'}}>// CUSTOMER NOTE</div>
                    {testimonial.rating > 0 && <div className="mono" style={{fontSize:10, color:'var(--ochre)'}}>{'★'.repeat(testimonial.rating)}</div>}
                  </div>
                  <p style={{fontFamily:'Instrument Serif, serif', fontSize: 18, lineHeight:1.25, display:'-webkit-box', WebkitLineClamp:6, WebkitBoxOrient:'vertical', overflow:'hidden'}}>
                    "{testimonial.quote}"
                  </p>
                  <div className="mono" style={{fontSize:10, marginTop:8}}>{testimonial.name.toUpperCase()}{testimonial.loc ? ` · ${testimonial.loc.toUpperCase()}` : ''}</div>
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="scroll-indicator" aria-hidden="true">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6"/></svg>
        </div>
      </section>

      {/* Trusted by / clients strip */}
      {clients.length > 0 && (
        <section className="container reveal" style={{paddingTop: 40, paddingBottom: 8}}>
          <div className="row-flex" style={{gap: 28, flexWrap:'wrap', alignItems:'center', borderTop:'1px solid var(--line)', borderBottom:'1px solid var(--line)', padding:'20px 0'}}>
            <span className="eyebrow" style={{whiteSpace:'nowrap'}}>WHO WE WORK WITH</span>
            <div className="row-flex" style={{gap: 28, flexWrap:'wrap', flex: 1}}>
              {clients.map(c => {
                const content = (
                  <>
                    {c.logoUrl && <img src={thumbUrl(c.logoUrl, 160)} alt={c.logoAlt || `${c.name} logo`} style={{height: 32, objectFit:'contain', display:'block'}} />}
                    <span style={{display:'flex', flexDirection:'column', lineHeight:1.3}}>
                      <span style={{fontSize:14, fontWeight:600}}>{c.name}{c.since && <span className="mono" style={{fontSize:10, fontWeight:400, color:'var(--ink-3)', marginLeft:8}}>CLIENT SINCE {c.since}</span>}</span>
                      {c.subtitle && <span className="mono" style={{fontSize:11, color:'var(--ink-2)'}}>{c.subtitle}</span>}
                      {c.description && <span style={{fontSize:12, color:'var(--ink-2)', marginTop:2}}>{c.description}</span>}
                    </span>
                  </>
                );
                return c.url ? (
                  <a key={c.id} href={c.url} target="_blank" rel="noopener noreferrer" style={{display:'flex', alignItems:'center', gap:10, color:'inherit', textDecoration:'none'}}>{content}</a>
                ) : (
                  <span key={c.id} style={{display:'flex', alignItems:'center', gap:10}}>{content}</span>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* Category strip */}
      <section className="container reveal" style={{paddingTop: 64, paddingBottom: 24}}>
        <div className="row-flex" style={{justifyContent:'space-between', marginBottom: 24, alignItems:'baseline'}}>
          <div>
            <span className="eyebrow">SECTIONS</span>
            <h2 className="serif" style={{fontSize: 42, marginTop:6}}>Shop by terrain.</h2>
          </div>
          <a className="mono" href="/shop" style={{fontSize:12, color:'var(--rust)', cursor:'pointer'}} onClick={(e) => { e.preventDefault(); go('shop'); }}>VIEW ALL CATEGORIES →</a>
        </div>
        <div className="grid-4">
          {(categories.length > 0 ? categories.slice(0, 4) : []).map((catName) => {
            const imgs = categoryImages[catName] || [];
            return (
              <div key={catName} className="product" onClick={() => go('shop', { initialCat: catName })} style={{cursor:'pointer'}}>
                <div style={{aspectRatio:'1/1', overflow:'hidden', background:'var(--bg-deep)', position:'relative'}}>
                  {imgs.length === 0 && (
                    <div style={{width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--ink-3)', fontSize:13, fontFamily:'var(--mono)'}}>{catName.toUpperCase()}</div>
                  )}
                  {imgs.length === 1 && (
                    <img src={thumbUrl(imgs[0], 400)} srcSet={thumbSrcSet(imgs[0], [200, 300, 400])} sizes="(max-width: 600px) 50vw, 300px" alt={catName} loading="lazy" style={{width:'100%', height:'100%', objectFit:'cover', display:'block'}} />
                  )}
                  {imgs.length === 2 && (
                    <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', height:'100%', gap:2}}>
                      {imgs.map((src, j) => <img key={j} src={thumbUrl(src, 200)} srcSet={thumbSrcSet(src, [100, 150, 200])} sizes="(max-width: 600px) 25vw, 150px" alt="" loading="lazy" style={{width:'100%', height:'100%', objectFit:'cover', display:'block'}} />)}
                    </div>
                  )}
                  {imgs.length === 3 && (
                    <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gridTemplateRows:'1fr 1fr', height:'100%', gap:2}}>
                      <img src={thumbUrl(imgs[0], 200)} srcSet={thumbSrcSet(imgs[0], [100, 150, 200])} sizes="(max-width: 600px) 25vw, 150px" alt="" loading="lazy" style={{width:'100%', height:'100%', minHeight:0, objectFit:'cover', display:'block', gridRow:'1 / 3'}} />
                      <img src={thumbUrl(imgs[1], 200)} srcSet={thumbSrcSet(imgs[1], [100, 150, 200])} sizes="(max-width: 600px) 25vw, 150px" alt="" loading="lazy" style={{width:'100%', height:'100%', minHeight:0, objectFit:'cover', display:'block'}} />
                      <img src={thumbUrl(imgs[2], 200)} srcSet={thumbSrcSet(imgs[2], [100, 150, 200])} sizes="(max-width: 600px) 25vw, 150px" alt="" loading="lazy" style={{width:'100%', height:'100%', minHeight:0, objectFit:'cover', display:'block'}} />
                    </div>
                  )}
                  {imgs.length >= 4 && (
                    <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gridTemplateRows:'1fr 1fr', height:'100%', gap:2}}>
                      {imgs.slice(0,4).map((src, j) => <img key={j} src={thumbUrl(src, 200)} srcSet={thumbSrcSet(src, [100, 150, 200])} sizes="(max-width: 600px) 25vw, 150px" alt="" loading="lazy" style={{width:'100%', height:'100%', objectFit:'cover', display:'block'}} />)}
                    </div>
                  )}
                </div>
                <div className="body">
                  <div className="name serif" style={{fontSize:22}}>{catName}</div>
                  <div className="row-px"><span className="mono" style={{fontSize:11, color:'var(--ink-3)'}}>{skuCounts[catName] != null ? `${skuCounts[catName]} ${skuCounts[catName] === 1 ? 'SKU' : 'SKUs'}` : ''}</span><span className="mono" style={{fontSize:11, color:'var(--rust)'}}>SHOP →</span></div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Editorial split: AI + Services */}
      <section className="container reveal" style={{paddingTop: 64}}>
        <div className="grid-2" style={{gap:32}}>
          <div style={{background:'var(--dark)', color:'var(--paper)', padding: 40, position:'relative', overflow:'hidden'}}>
            {siteContent.aiEnabled && <span className="tag tag-ochre">NEW · 2026</span>}
            <h2 className="serif" style={{fontSize: 56, marginTop: 18, lineHeight:1}}>
              {siteContent.aiHeading && siteContent.aiHeading.split('\n').map((line, i, arr) =>
                i < arr.length - 1 ? <React.Fragment key={i}>{line}<br/></React.Fragment> : <span key={i} className="italic">{line}</span>
              )}
            </h2>
            <p style={{marginTop: 16, color:'var(--bg-deep)', maxWidth: 420}}>
              {siteContent.aiBody}
            </p>
            <button className="btn btn-rust" style={{marginTop: 22}} onClick={() => go('ai')}>See the AI suite →</button>
            {aiData && (
              <div style={{marginTop: 28, display:'grid', gridTemplateColumns:'1fr 1fr', gap:16}}>
                <div style={{background:'#0e0c09', padding:'16px 20px'}}>
                  <div className="mono" style={{fontSize:11, color:'var(--ochre)', letterSpacing:'.08em'}}>MODELS</div>
                  <div className="serif" style={{fontSize:36, marginTop:4}}>{aiData.models?.length ?? '-'}</div>
                  <div style={{fontSize:12, color:'var(--bg-deep)', marginTop:2}}>
                    {aiData.models?.filter(m => m.status === 'Active').length ?? 0} active
                  </div>
                </div>
                <div style={{background:'#0e0c09', padding:'16px 20px'}}>
                  <div className="mono" style={{fontSize:11, color:'var(--ochre)', letterSpacing:'.08em'}}>FIELD BOXES</div>
                  <div className="serif" style={{fontSize:36, marginTop:4}}>{aiData.boxes?.length ?? '-'}</div>
                  <div style={{fontSize:12, color:'var(--bg-deep)', marginTop:2}}>
                    {aiData.boxes?.filter(b => !(b.status || '').toLowerCase().includes('offline')).length ?? 0} online
                  </div>
                </div>
              </div>
            )}
          </div>

          <div style={{background:'var(--paper)', border:'1px solid var(--line)', padding: 40}}>
            <span className="eyebrow">WHAT WE FIX</span>
            <h2 className="serif" style={{fontSize: 56, marginTop: 8, lineHeight:1}}>Bench, ute,<br/>or in the field.</h2>
            <p style={{marginTop: 16, color:'var(--ink-2)', maxWidth: 420}}>{siteContent.workshopBlurb}</p>
            {repairServices.length > 0 && (
              <ul className="checks" style={{marginTop: 22, fontSize:14}}>
                {repairServices.slice(0, 4).map((s, i) => <li key={i}>{s.name}</li>)}
              </ul>
            )}
            <div className="row-flex" style={{marginTop: 28, justifyContent:'space-between'}}>
              <button className="btn" onClick={() => go('services')}>Service catalogue</button>
              {repairServices.length > 0 && (
                <div className="mono" style={{fontSize:11, color:'var(--ink-2)'}}>{repairServices.length} SERVICES LISTED</div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Featured products */}
      <section className="container reveal" style={{paddingTop: 64}}>
        <div className="row-flex" style={{justifyContent:'space-between', marginBottom: 24, alignItems:'baseline'}}>
          <div>
            <span className="eyebrow">ON THE BENCH THIS WEEK</span>
            <h2 className="serif" style={{fontSize: 42, marginTop: 6}}>Tested. Tagged. Ready.</h2>
          </div>
          <a className="mono" href="/shop" style={{fontSize:12, color:'var(--rust)', cursor:'pointer'}} onClick={(e) => { e.preventDefault(); go('shop'); }}>ALL {featuredProducts.length || '-'} LISTINGS →</a>
        </div>
        <div className="grid-4">
          {featuredProducts.slice(0,4).map((p,i) => <ProductCard key={i} p={p} onClick={() => go('product', p)} />)}
        </div>
      </section>

      {/* Quote CTA */}
      <section className="container reveal" style={{paddingTop: 64, paddingBottom: 16}}>
        <div className="grid-2">
          <div className="card-paper" style={{padding: 36}}>
            <span className="tag tag-rust">QUOTES IN 24h</span>
            <h3 className="serif" style={{fontSize:36, marginTop: 14, lineHeight:1.05}}>Got something weird that needs powering, fixing, or talking to a satellite?</h3>
            <p style={{marginTop: 12, color:'var(--ink-2)'}}>Tell us the use case in plain English. Our techs will spec it, price it, and ship it. No salespeople.</p>
            <button className="btn btn-rust" style={{marginTop: 18}} onClick={() => go('quote')}>Request a quote →</button>
          </div>
          <div style={{padding: 36, border:'1px solid var(--line)', background:'var(--bg-elev)'}}>
            <span className="eyebrow">COMMUNITY FORUM</span>
            {recentThreads.length > 0 ? (
              <ul style={{margin:'14px 0 0', padding:0, listStyle:'none', display:'flex', flexDirection:'column', gap:10}}>
                {recentThreads.map(t => (
                  <li key={t.id} style={{borderBottom:'1px solid var(--line)', paddingBottom:10}}>
                    <a href={`${shop._forumUrl || 'https://forum.outbackelectronics.com.au'}/t/${t.slug}/${t.id}`} target="_blank" rel="noopener noreferrer"
                       style={{color:'var(--ink)', fontSize:14, fontWeight:500, textDecoration:'none', display:'block', lineHeight:1.3}}>
                      {t.title}
                    </a>
                    <span style={{fontSize:12, color:'var(--ink-3)'}}>{t.reply_count} {t.reply_count === 1 ? 'reply' : 'replies'} · {t.views} views</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p style={{marginTop: 14, color:'var(--ink-2)', fontSize:14}}>Join the discussion - repairs, builds, troubleshooting, and more.</p>
            )}
            <a href={shop._forumUrl || 'https://forum.outbackelectronics.com.au'} target="_blank" rel="noopener noreferrer" className="btn btn-outline" style={{marginTop: 18, display:'inline-block'}}>Visit the Forum →</a>
          </div>
        </div>
      </section>
    </>
  );
}

// ============================================================
// SHOP
// ============================================================

function CondLabel({ cond }) {
  if (!cond) return null;
  const color = CONDITION_COLORS[cond] || 'var(--ink-2)';
  return (
    <span style={{color, fontWeight:600}}>
      <span aria-hidden="true" style={{display:'inline-block', width:7, height:7, borderRadius:'50%', background:color, marginRight:5, verticalAlign:'1px'}} />
      {cond}
    </span>
  );
}

function ProductCard({ p, onClick }) {
  const hasVariants = p.variants && p.variants.length > 0;
  let displayPrice, displayTag, displayTagClass, displaySku;
  if (hasVariants) {
    const prices = p.variants.map(v => v.price);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    displayPrice = minPrice === maxPrice
      ? `$${minPrice.toLocaleString()}`
      : `$${minPrice.toLocaleString()} – $${maxPrice.toLocaleString()}`;
    const totalStock = p.variants.reduce((s, v) => s + (v.stock || 0), 0);
    if (totalStock <= 0 && p.allowBackorder) { displayTag = 'Backorder'; displayTagClass = 'tag-ochre'; }
    else if (totalStock <= 0) { displayTag = 'Out of stock'; displayTagClass = 'tag-outline'; }
    else if (totalStock <= 3) { displayTag = `${totalStock} left`; displayTagClass = 'tag-ochre'; }
    else { displayTag = 'In stock'; displayTagClass = 'tag-euc'; }
    displaySku = p.variants[0].sku;
  } else if (p.infiniteStock) {
    displayPrice = `$${productPrice(p).toLocaleString()}`;
    displayTag = 'In stock';
    displayTagClass = 'tag-euc';
    displaySku = p.sku;
  } else {
    displayPrice = `$${productPrice(p).toLocaleString()}`;
    // The product editor has no tag field, so p.tag is unset on everything
    // created through the admin UI. Derive the badge from stock the same way
    // the variant branch above does, and treat p.tag as an override for the
    // hand-authored listings that do carry one.
    const stock = Number(p.stock) || 0;
    if (p.tag) { displayTag = p.tag; displayTagClass = p.tagClass || 'tag-outline'; }
    else if (stock <= 0 && p.allowBackorder) { displayTag = 'Backorder'; displayTagClass = 'tag-ochre'; }
    else if (stock <= 0) { displayTag = 'Out of stock'; displayTagClass = 'tag-outline'; }
    else if (stock <= 3) { displayTag = `${stock} left`; displayTagClass = 'tag-ochre'; }
    else { displayTag = 'In stock'; displayTagClass = 'tag-euc'; }
    displaySku = p.sku;
  }
  const thumb = p.images && p.images.length > 0 ? p.images[0] : null;
  const soldOut = displayTag === 'Out of stock';
  // Advertise a bulk rate on the card too: an offer meant to shift volume is
  // wasted if it only appears once the shopper has opened the product.
  const bulkEntry = hasVariants ? (p.variants.find(v => bulkOfferAvailable(v)) || null) : (bulkOfferAvailable(p) ? p : null);
  return (
    <div className="product" onClick={onClick} style={soldOut ? {opacity:0.62} : undefined}>
      {thumb
        ? <img src={thumbUrl(thumb, 600)} srcSet={thumbSrcSet(thumb, [300, 450, 600])} sizes="(max-width: 600px) 50vw, (max-width: 1100px) 33vw, 300px" alt={(p.imageAlts||{})[thumb] || p.name} loading="lazy" style={{width:'100%', aspectRatio:'4/3', objectFit:'cover', display:'block'}} />
        : <div className="slot" style={{aspectRatio:'4/3'}}>{(p.name || '').toUpperCase()}</div>}
      <div className="body">
        <div className="meta"><CondLabel cond={p.cond} />{p.cond ? ' · ' : ''}{displaySku}</div>
        <div className="name">{p.name}</div>
        <div className="row-px">
          <div>
            <span className="price">{displayPrice}</span>
            {!hasVariants && p.was && <span className="price-strike" style={{marginLeft:8}}>${p.was.toLocaleString()}</span>}
          </div>
          <span className={`tag ${displayTagClass || 'tag-outline'}`}>{(displayTag || '').toUpperCase()}</span>
        </div>
        {bulkEntry && (
          <div className="mono" style={{fontSize:10, color:'var(--eucalyptus)', marginTop:6, letterSpacing:'.04em'}}>
            {Math.floor(Number(bulkEntry.bulkQty))}+ FOR ${Number(bulkEntry.bulkPrice).toLocaleString()} EA
          </div>
        )}
      </div>
    </div>
  );
}

// #8, shop filters/sort/search are serialized to the URL (?cat=&cond=&brands=&min=&max=&sort=&q=)
// so filtered views can be shared, bookmarked, and survive back/forward navigation.
function readShopParamsFromUrl() {
  const sp = new URLSearchParams(location.search);
  return {
    cat: sp.get('cat') || null,
    cond: sp.get('cond') || null,
    brands: (sp.get('brands') || '').split(',').filter(Boolean),
    min: sp.get('min') || '',
    max: sp.get('max') || '',
    sort: sp.get('sort') || null,
    oos: sp.get('oos') || '',
    q: sp.get('q') || '',
  };
}

function ShopPage({ go, addToCart, pageParams }) {
  const urlInit = useMemo(readShopParamsFromUrl, []);
  const [cat, setCat] = useState(pageParams?.initialCat || urlInit.cat || 'All');
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterMeta, setFilterMeta] = useState({ categories: [], brands: [], conditions: [] });
  const [selectedBrands, setSelectedBrands] = useState(urlInit.brands);
  const [catalogError, setCatalogError] = useState(null);
  const [hideOutOfStock, setHideOutOfStock] = useState(urlInit.oos === '1');
  const [priceMin, setPriceMin] = useState(urlInit.min);
  const [priceMax, setPriceMax] = useState(urlInit.max);
  const [query, setQuery] = useState(pageParams?.initialQuery || urlInit.q || '');
  useEffect(() => {
    Promise.all([
      fetch('/api/catalog/products')
        .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
        .then(d => setProducts(d.items || []))
        .catch(err => { setCatalogError(err.message || 'Failed to load products'); setProducts([]); }),
      fetch('/api/catalog/filters')
        .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
        .then(d => setFilterMeta(d))
        .catch(() => {}),
    ]).finally(() => setLoading(false));
  }, []);
  const [cond, setCond] = useState(pageParams?.initialCond || urlInit.cond || 'Any');
  const [sort, setSort] = useState(urlInit.sort || 'relevance');
  const [visibleCount, setVisibleCount] = useState(12);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const chunkSize = 12;

  // Apply new params when navigated to while already mounted (e.g. footer category
  // links or the search overlay's "view all results" while on /shop).
  useEffect(() => {
    if (!pageParams) return;
    if (pageParams.initialCat) setCat(pageParams.initialCat);
    if (pageParams.initialCond) setCond(pageParams.initialCond);
    if (pageParams.initialQuery != null) setQuery(pageParams.initialQuery);
  }, [pageParams]);

  // Serialize active filters/sort/search into the URL (replaceState, no history spam)
  const [urlSyncTick, setUrlSyncTick] = useState(0);
  useEffect(() => {
    // Second pass after mount so the initial state lands after App pushes /shop
    const t = setTimeout(() => setUrlSyncTick(1), 0);
    return () => clearTimeout(t);
  }, []);
  useEffect(() => {
    if (!location.pathname.startsWith('/shop')) return;
    const sp = new URLSearchParams();
    if (cat !== 'All') sp.set('cat', cat);
    if (cond !== 'Any') sp.set('cond', cond);
    if (selectedBrands.length > 0) sp.set('brands', selectedBrands.join(','));
    if (priceMin !== '') sp.set('min', priceMin);
    if (priceMax !== '') sp.set('max', priceMax);
    if (hideOutOfStock) sp.set('oos', '1');
    if (sort !== 'relevance') sp.set('sort', sort);
    if (query.trim()) sp.set('q', query.trim());
    const qs = sp.toString();
    const target = qs ? `/shop?${qs}` : '/shop';
    if (location.pathname + location.search !== target) window.history.replaceState({}, '', target);
  }, [cat, cond, selectedBrands, priceMin, priceMax, sort, query, hideOutOfStock, urlSyncTick]);

  // Restore filters from the URL on back/forward navigation
  useEffect(() => {
    const onPop = () => {
      if (!location.pathname.startsWith('/shop')) return;
      const p = readShopParamsFromUrl();
      setCat(p.cat || 'All');
      setCond(p.cond || 'Any');
      setSelectedBrands(p.brands);
      setPriceMin(p.min);
      setPriceMax(p.max);
      setSort(p.sort || 'relevance');
      setHideOutOfStock(p.oos === '1');
      setQuery(p.q);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  // "Available" means buyable, so a backorder product counts: it ranks with
  // the in-stock items and survives the hide-out-of-stock filter.
  const inStockNow = p => {
    if (p.infiniteStock || p.allowBackorder) return true;
    if (p.variants && p.variants.length > 0) return p.variants.some(v => (Number(v.stock) || 0) > 0);
    return (Number(p.stock) || 0) > 0;
  };
  const activeFilterCount = [cat !== 'All', cond !== 'Any', selectedBrands.length > 0, priceMin !== '', priceMax !== '', query.trim() !== '', hideOutOfStock].filter(Boolean).length;
  const clearFilters = () => { setCat('All'); setCond('Any'); setSelectedBrands([]); setPriceMin(''); setPriceMax(''); setQuery(''); setHideOutOfStock(false); };
  const filtered = useMemo(() => {
    let f = [...products];
    const q = query.trim().toLowerCase();
    if (q) f = f.filter(p =>
      (p.name || '').toLowerCase().includes(q) ||
      (p.brand || '').toLowerCase().includes(q) ||
      (p.sku || '').toLowerCase().includes(q) ||
      (p.category || '').toLowerCase().includes(q)
    );
    if (cat !== 'All') f = f.filter(p => p.category === cat);
    if (cond !== 'Any') f = f.filter(p => p.cond === cond);
    if (selectedBrands.length > 0) f = f.filter(p => selectedBrands.includes(p.brand));
    if (hideOutOfStock) f = f.filter(inStockNow);
    const min = parseFloat(priceMin);
    const max = parseFloat(priceMax);
    const effectivePrice = p => {
      if (p.variants && p.variants.length > 0) return Math.min(...p.variants.map(v => Number(v.price) || 0));
      const own = productPrice(p);
      return own > 0 ? own : null;
    };
    if (!isNaN(min)) f = f.filter(p => { const ep = effectivePrice(p); return ep != null && ep >= min; });
    if (!isNaN(max)) f = f.filter(p => { const ep = effectivePrice(p); return ep != null && ep <= max; });
    // Sort on the same effective price the min/max filter uses, a product
    // whose price lives on its variants has no top-level price, and comparing
    // undefined sorted it arbitrarily.
    const sortPrice = p => { const ep = effectivePrice(p); return ep == null ? Infinity : ep; };
    if (sort === 'price-asc') f.sort((a,b) => sortPrice(a) - sortPrice(b));
    else if (sort === 'price-desc') f.sort((a,b) => sortPrice(b) - sortPrice(a));
    else {
      // Relevance: in-stock first, then leave the catalog's own order intact.
      // Nothing out of stock should outrank something a customer can buy.
      f.sort((a,b) => (inStockNow(a) === inStockNow(b)) ? 0 : (inStockNow(a) ? -1 : 1));
    }
    return f;
  }, [products, cat, cond, selectedBrands, priceMin, priceMax, sort, query, hideOutOfStock]);

  const totalResults = filtered.length;
  const visible = filtered.slice(0, visibleCount);

  // selectedBrands was missing here, so changing the brand filter kept a
  // previously expanded page length instead of starting from the first chunk.
  useEffect(() => { setVisibleCount(chunkSize); }, [cat, cond, sort, priceMin, priceMax, query, selectedBrands.join(','), products.length]);
  useEffect(() => {
    const onScroll = () => {
      const nearBottom = window.innerHeight + window.scrollY >= document.body.offsetHeight - 240;
      if (nearBottom) setVisibleCount(v => Math.min(totalResults, v + chunkSize));
    };
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, [totalResults]);
  return (
    <>
      <PageHead crumbs={['Outback','Shop']} title="Shop"
        lead={`${products.length} listings · new, refurbished & field-tested gear. Every refurb passes our 38-point bench check.`} />
      <div className="container" style={{paddingTop: 32, paddingBottom: 32}}>
        {/* Mobile filter toggle bar, hidden on desktop via CSS */}
        <div className="shop-filter-bar">
          <button className="btn btn-sm btn-ghost shop-filter-toggle" aria-expanded={filtersOpen} onClick={() => setFiltersOpen(o => !o)}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true"><line x1="4" y1="6" x2="20" y2="6"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="11" y1="18" x2="13" y2="18"/></svg>
            {filtersOpen ? 'Hide filters' : 'Filters'}
            {activeFilterCount > 0 && <span style={{background:'var(--rust)', color:'#fff', borderRadius:999, fontSize:9, padding:'1px 5px', fontWeight:700, marginLeft:2}}>{activeFilterCount}</span>}
          </button>
          {activeFilterCount > 0 && (
            <button className="btn btn-sm btn-ghost" style={{fontSize:11}} onClick={clearFilters}>Clear ×</button>
          )}
        </div>

        <div className="shop-layout">
          <aside className={`shop-filters${filtersOpen ? ' open' : ''}`} aria-label="Product filters">
            {activeFilterCount > 0 && (
              <div style={{marginBottom:16, display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                <span className="mono" style={{fontSize:10, color:'var(--rust)'}}>FILTERS ACTIVE</span>
                <button className="btn btn-sm btn-ghost" style={{fontSize:10, padding:'4px 8px'}} onClick={clearFilters}>
                  Clear all ×
                </button>
              </div>
            )}
            <div className="eyebrow" style={{marginBottom: 10}}>CATEGORY</div>
            <div className="stack" style={{gap:4}}>
              {['All', ...filterMeta.categories].map(c => (
                <button key={c} onClick={() => { setCat(c); setFiltersOpen(false); }} style={{padding:'6px 8px', cursor:'pointer', fontSize:14, color: cat===c ? 'var(--rust)' : 'var(--ink)', fontWeight: cat===c ? 600 : 400, background:'none', border:'none', borderLeft: cat===c ? '2px solid var(--rust)':'2px solid transparent', textAlign:'left', width:'100%'}}>{c}</button>
              ))}
            </div>
            <hr className="thin" />
            <div className="eyebrow" style={{marginBottom: 10}}>CONDITION</div>
            {['Any', ...filterMeta.conditions].map(c => (
              <label key={c} style={{display:'flex', alignItems:'center', gap:8, fontSize:14, padding:'4px 0', cursor:'pointer'}}>
                <input type="radio" name="cond" checked={cond===c} onChange={() => setCond(c)} />
                {c}
              </label>
            ))}
            <hr className="thin" />
            <div className="eyebrow" style={{marginBottom: 10}}>PRICE</div>
            <div className="row-flex" style={{gap:8}}>
              <input className="input" placeholder="$ min" aria-label="Minimum price" style={{padding:'8px 10px'}} type="number" min="0" value={priceMin} onChange={e => setPriceMin(e.target.value)} />
              <input className="input" placeholder="$ max" aria-label="Maximum price" style={{padding:'8px 10px'}} type="number" min="0" value={priceMax} onChange={e => setPriceMax(e.target.value)} />
            </div>
            <hr className="thin" />
            <div className="eyebrow" style={{marginBottom: 10}}>BRAND</div>
            <div className="stack" style={{gap:4, fontSize:14}}>
              {filterMeta.brands.map(b => (
                <label key={b} style={{display:'flex', alignItems:'center', gap:8, cursor:'pointer'}}>
                  <input type="checkbox" checked={selectedBrands.includes(b)} onChange={e => setSelectedBrands(prev => e.target.checked ? [...prev, b] : prev.filter(x => x !== b))} /> {b}
                </label>
              ))}
            </div>
            <hr className="thin" />
            <label style={{display:'flex', alignItems:'center', gap:8, cursor:'pointer', fontSize:14}}>
              <input type="checkbox" checked={hideOutOfStock} onChange={e => setHideOutOfStock(e.target.checked)} />
              Hide out of stock
            </label>
          </aside>

          <div>
            {catalogError && (
              <div role="alert" style={{background:'#fff3f3', border:'1px solid #f5a5a5', borderRadius:6, padding:'12px 16px', marginBottom:18, color:'#c0392b', fontSize:14}}>
                Unable to load products: {catalogError}. Please refresh the page or try again later.
              </div>
            )}
            <div className="row-flex" style={{justifyContent:'space-between', marginBottom: 18, flexWrap:'wrap', gap:10}}>
              <div className="mono" aria-live="polite" style={{fontSize:12, color:'var(--ink-2)'}}>
                SHOWING {visible.length} OF {totalResults} RESULTS · {cat.toUpperCase()}{query.trim() ? ` · “${query.trim().toUpperCase()}”` : ''}
              </div>
              <div className="row-flex" style={{gap:10}}>
                <input className="input" type="search" placeholder="Search products…" aria-label="Search products"
                  value={query} onChange={e => setQuery(e.target.value)}
                  style={{padding:'6px 10px', fontSize:13, width:180}} />
                <select className="select" value={sort} onChange={e => setSort(e.target.value)} aria-label="Sort products" style={{padding:'6px 28px 6px 10px', fontSize:13}}>
                  <option value="relevance">Sort: Relevance</option>
                  <option value="price-asc">Price: low → high</option>
                  <option value="price-desc">Price: high → low</option>
                </select>
              </div>
            </div>
            {loading ? (
              <div className="grid-3" style={{gap:20}}>
                {Array.from({length:6}).map((_,i) => (
                  <div key={i} style={{background:'var(--bg-elev)', borderRadius:4, height:260, animation:'pulse 1.4s ease-in-out infinite', opacity: 0.6 + (i % 2) * 0.2}} />
                ))}
              </div>
            ) : (
              <>
                <div className="grid-3" style={{gap: 20}}>
                  {visible.map((p, i) => (
                    <ProductCard key={p.id || i} p={p} onClick={() => go('product', p)} />
                  ))}
                </div>
                {/* Infinite scroll alone is unreachable by keyboard and never
                    fires for anyone who cannot scroll the window, so the same
                    action is offered as a real button. */}
                {visible.length < totalResults && (
                  <div style={{marginTop:18, textAlign:'center'}}>
                    <button className="btn btn-ghost btn-sm"
                      onClick={() => setVisibleCount(v => Math.min(totalResults, v + chunkSize))}>
                      Load more ({totalResults - visible.length} remaining)
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

// ============================================================
// PUBLIC JOB LOG
// ============================================================
function PublicJobLog() {
  const [jobs, setJobs] = useState([]);
  useEffect(() => {
    fetch('/api/public-job-log')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d && d.jobs) setJobs(d.jobs); })
      .catch(() => {});
  }, []);

  if (jobs.length === 0) return null;

  return (
    <div className="card-paper" style={{padding: 24, marginTop:16}}>
      <span className="eyebrow">LATEST JOB LOG · PUBLIC</span>
      <table style={{width:'100%', marginTop: 12, borderCollapse:'collapse', fontSize:13}}>
        <thead>
          <tr style={{textAlign:'left', borderBottom:'1px solid var(--line)'}}>
            <th style={{padding:'8px 0'}}>JOB</th><th>ITEM</th><th>STATUS</th>
          </tr>
        </thead>
        <tbody>
          {jobs.map((r, i) => (
            <tr key={i} style={{borderBottom:'1px solid var(--line)'}}>
              <td style={{padding:'10px 0', fontFamily:'JetBrains Mono, monospace', fontSize:11}}>{r.id}</td>
              <td>{r.item}</td>
              <td><span className={`tag ${r.status==='Done'?'tag-euc':r.status==='Bench'?'tag-rust':'tag-outline'}`} style={{padding:'2px 6px'}}>{r.status}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ============================================================
// SERVICES
// ============================================================
function ServicesPage({ go }) {
  const shop = useShop();
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [siteContent, setSiteContent] = useState({});
  const [activeCategory, setActiveCategory] = useState(null);

  useEffect(() => {
    Promise.all([
      fetch('/api/catalog/services').then(r => r.json()).then(d => setServices(d.items || [])).catch(() => setServices(window.CATALOG_DATA?.getPublicServices?.() || [])),
      fetch('/api/settings').then(r => r.ok ? r.json() : Promise.reject()).then(d => setSiteContent(d.siteContent || {})).catch(() => {}),
    ]).finally(() => setLoading(false));
  }, []);

  const categories = useMemo(() => [...new Set(services.map(s => s.category).filter(Boolean))].sort(), [services]);
  useEffect(() => { if (activeCategory === null && categories.length) setActiveCategory(categories[0]); }, [categories, activeCategory]);

  const visible = services.filter(s => s.category === activeCategory);

  return (
    <>
      <PageHead crumbs={['Outback','Services']} title="Services" lead={`${services.length} services across ${categories.length} categories · ${siteContent.workshopBlurb}`} />
      <section className="container" style={{paddingTop: 40, paddingBottom: 40}}>
        {loading ? (
          <div style={{display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:24}}>
            {Array.from({length:6}).map((_,i) => (
              <div key={i} style={{background:'var(--bg-elev)', borderRadius:4, height:220, animation:'pulse 1.4s ease-in-out infinite', opacity: 0.6 + (i % 2) * 0.2}} />
            ))}
          </div>
        ) : (
        <>
        <div className="row-flex" style={{gap:8, flexWrap:'wrap', marginBottom:24}}>
          {categories.map(c => (
            <button
              key={c}
              className="mono"
              onClick={() => setActiveCategory(c)}
              style={{
                fontSize:11, padding:'8px 14px', cursor:'pointer', borderRadius:2,
                border: c === activeCategory ? '1px solid var(--rust)' : '1px solid var(--line)',
                background: c === activeCategory ? 'var(--rust)' : 'transparent',
                color: c === activeCategory ? '#fff' : 'var(--ink-2)',
              }}
            >{(c || '').toUpperCase()} ({services.filter(s => s.category === c).length})</button>
          ))}
        </div>
        <div className="mono" style={{fontSize:12, color:'var(--ink-2)', marginBottom:18}}>SHOWING {visible.length} OF {services.length} SERVICES · {(activeCategory||'').toUpperCase()}</div>
        <div className="grid-3" style={{gap: 24}}>
          {visible.map((s,i) => (
            <div key={i} className="card-paper" style={{padding: 24}}>
              <div className="row-flex" style={{justifyContent:'space-between'}}>
                <span className="mono" style={{fontSize:11, color:'var(--rust)'}}>S/{(i+1).toString().padStart(2,'0')}</span>
                {s.tat && <span className="tag">TAT · {s.tat.toUpperCase()}</span>}
              </div>
              <h3 className="serif" style={{fontSize: 28, marginTop: 14, lineHeight:1.1}}>{s.name}</h3>
              <p style={{marginTop: 10, color:'var(--ink-2)', fontSize:14}}>{interpolateServiceText(s.description, shop)}</p>
              <div className="row-flex" style={{justifyContent:'space-between', marginTop: 18, borderTop:'1px solid var(--line)', paddingTop:14}}>
                <span className="price" style={{fontSize:20}}>{s.priceLine}</span>
                <button className="mono" style={{fontSize:11, color:'var(--rust)', cursor:'pointer', background:'none', border:'none', padding:0}} onClick={() => go('service', s)}>VIEW →</button>
              </div>
            </div>
          ))}
        </div>
        </>
        )}
      </section>

      <section className="container" style={{paddingBottom: 60}}>
        <div className="grid-2">
          <div style={{padding: 32, background:'var(--dark)', color:'var(--paper)'}}>
            <h3 className="serif" style={{fontSize: 36, lineHeight:1.05}}>How a repair moves through the shop.</h3>
            <div style={{marginTop: 22, display:'grid', gap: 16}}>
              {[
                {n:'01',t:'Intake',d:'Walked in, posted, or radioed in. Triage in ≤15 min.'},
                {n:'02',t:'Bench Diagnosis',d:'Multimeter, scope, thermal cam, and a slow cup of tea.'},
                {n:'03',t:'Quote',d:'Fixed-price for known faults, hourly otherwise. You decide.'},
                {n:'04',t:'Repair',d:'Logged photo-by-photo. You get the dead parts back if you want them.'},
                {n:'05',t:'48h Burn-in',d:'We run it harder than you will. Then sign-off.'},
              ].map((step,i) => (
                <div key={i} style={{display:'grid', gridTemplateColumns:'48px 1fr', gap:14, borderTop:'1px solid #3a3127', paddingTop: 14}}>
                  <div className="serif" style={{fontSize: 28, color:'var(--ochre)'}}>{step.n}</div>
                  <div>
                    <div style={{fontWeight:600}}>{step.t}</div>
                    <div style={{color:'var(--bg-deep)', fontSize:13, marginTop:2}}>{step.d}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div>
            <div className="slot" style={{aspectRatio:'4/3'}}>WORKBENCH - DUST, FLUX, COPPER WIRE</div>
            <PublicJobLog />
          </div>
        </div>
      </section>
    </>
  );
}

// ============================================================
// SOFTWARE - OS icons, listing, OS picker, detail page
// ============================================================
// Proper Tux penguin SVG
const TuxIcon = () => (
  <svg width="28" height="28" viewBox="0 0 100 110" fill="none">
    <ellipse cx="50" cy="68" rx="28" ry="30" fill="#1a1a1a"/>
    <circle cx="50" cy="32" r="22" fill="#1a1a1a"/>
    <ellipse cx="50" cy="72" rx="17" ry="22" fill="#f0e6c8"/>
    <circle cx="41" cy="26" r="7" fill="#fff"/>
    <circle cx="59" cy="26" r="7" fill="#fff"/>
    <circle cx="42.5" cy="27.5" r="3.5" fill="#111"/>
    <circle cx="60.5" cy="27.5" r="3.5" fill="#111"/>
    <circle cx="41" cy="26" r="1.5" fill="#fff"/>
    <circle cx="59" cy="26" r="1.5" fill="#fff"/>
    <ellipse cx="50" cy="39" rx="6" ry="4" fill="#f90"/>
    <ellipse cx="36" cy="98" rx="12" ry="5" fill="#f90" transform="rotate(-15 36 98)"/>
    <ellipse cx="64" cy="98" rx="12" ry="5" fill="#f90" transform="rotate(15 64 98)"/>
    <ellipse cx="21" cy="67" rx="9" ry="20" fill="#1a1a1a" transform="rotate(-8 21 67)"/>
    <ellipse cx="79" cy="67" rx="9" ry="20" fill="#1a1a1a" transform="rotate(8 79 67)"/>
  </svg>
);

const OS_META = {
  linux:   { label: 'Linux',   icon: <TuxIcon /> },
  windows: { label: 'Windows', icon: <svg width="28" height="28" viewBox="0 0 24 24" fill="#0078d4"><path d="M3 5.6L10.5 4.5V11.5H3V5.6ZM11.5 4.3L21 3V11.5H11.5V4.3ZM3 12.5H10.5V19.5L3 18.4V12.5ZM11.5 12.5H21V21L11.5 19.7V12.5Z"/></svg> },
  macos:   { label: 'macOS',   icon: <svg width="28" height="28" viewBox="0 0 24 24" fill="#555"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/></svg> },
  ios:     { label: 'iOS',     icon: <svg width="28" height="28" viewBox="0 0 24 24" fill="none"><rect x="5" y="1" width="14" height="22" rx="3" fill="#555"/><rect x="6.5" y="2.5" width="11" height="17" rx="1.5" fill="#fff"/><circle cx="12" cy="21" r="1" fill="#aaa"/><rect x="9.5" y="2" width="5" height="1" rx=".5" fill="#888"/><path d="M14.5 10.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79" stroke="none"/><g transform="translate(7.5,5.5) scale(0.37)"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" fill="#555"/></g></svg> },
  android: { label: 'Android', icon: <svg width="28" height="28" viewBox="0 0 24 24" fill="#3ddc84"><path d="M6 18c0 .55.45 1 1 1h1v3.5c0 .83.67 1.5 1.5 1.5S11 23.33 11 22.5V19h2v3.5c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5V19h1c.55 0 1-.45 1-1V8H6v10zM3.5 8C2.67 8 2 8.67 2 9.5v7c0 .83.67 1.5 1.5 1.5S5 17.33 5 16.5v-7C5 8.67 4.33 8 3.5 8zm17 0c-.83 0-1.5.67-1.5 1.5v7c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5v-7c0-.83-.67-1.5-1.5-1.5zm-4.97-5.84l1.3-1.3c.2-.2.2-.51 0-.71-.2-.2-.51-.2-.71 0l-1.48 1.48A5.84 5.84 0 0 0 12 1c-1.1 0-2.15.23-3.1.63L7.41.15c-.2-.2-.51-.2-.71 0-.2.2-.2.51 0 .71l1.3 1.3C6.01 3.07 5 4.96 5 7h14c0-2.04-1.01-3.93-2.47-4.84zM10 5H9V4h1v1zm5 0h-1V4h1v1z"/></svg> },
  cross:   { label: 'All platforms', icon: <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg> },
};

function SoftwarePage({ go, pageParams }) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [osPicker, setOsPicker] = useState(null); // product being picked for

  useEffect(() => {
    fetch('/api/software').then(r => r.ok ? r.json() : Promise.reject()).then(d => setProducts(d.items || [])).catch(() => {}).finally(() => setLoading(false));
  }, []);

  // Deep-link: resolve product by slug once data loads
  useEffect(() => {
    if (!pageParams?.slug || !products.length) return;
    const found = products.find(p => p.slug === pageParams.slug);
    if (found && pageParams.name === undefined) {
      // Enrich pageParams with loaded data so title/meta update
      // We do this via a no-op state trick, just trigger a re-render via go
    }
  }, [products, pageParams]);

  // Detail page
  if (pageParams?.slug && pageParams?.os) {
    const product = products.find(p => p.slug === pageParams.slug);
    if (!loading && !product) return (
      <><PageHead crumbs={['Outback','Software']} title="Not found" lead="This software entry doesn't exist." />
      <section className="container" style={{padding:'40px 0'}}><button className="btn btn-ghost btn-sm" onClick={() => go('software', null)}>← Back to Software</button></section></>
    );
    if (!product) return <section className="container" style={{padding:'80px 0', textAlign:'center'}}><span className="mono" style={{fontSize:12,color:'var(--ink-2)'}}>Loading…</span></section>;
    return <SoftwareDetailPage product={product} os={pageParams.os} go={go} />;
  }

  // OS picker page (slug set but no OS yet)
  if (pageParams?.slug) {
    const product = products.find(p => p.slug === pageParams.slug);
    if (!loading && !product) return (
      <><PageHead crumbs={['Outback','Software']} title="Not found" lead="This software entry doesn't exist." />
      <section className="container" style={{padding:'40px 0'}}><button className="btn btn-ghost btn-sm" onClick={() => go('software', null)}>← Back to Software</button></section></>
    );
    if (!product) return <section className="container" style={{padding:'80px 0', textAlign:'center'}}><span className="mono" style={{fontSize:12,color:'var(--ink-2)'}}>Loading…</span></section>;
    return <SoftwareOSPickerPage product={product} go={go} />;
  }

  // Listing
  return (
    <>
      <PageHead crumbs={['Outback','Software']} title="Software"
        lead="Tools we wrote for ourselves, then cleaned up enough to share. Mostly open source, mostly Linux, all paid-back in pull requests." />
      <section className="container" style={{paddingTop: 40, paddingBottom: 48}}>
        {loading && <div className="mono" style={{fontSize:12,color:'var(--ink-2)'}}>Loading…</div>}
        {!loading && products.length === 0 && (
          <div style={{padding:'48px 0'}}>
            <p className="serif" style={{fontSize:28, marginBottom:12}}>Still in the workshop.</p>
            <p style={{color:'var(--ink-2)', fontSize:15, maxWidth:520, lineHeight:1.7}}>
              We're working on our first software release, internal tools we use every day that we think are worth sharing. Check back soon.
            </p>
          </div>
        )}
        <div className="grid-2" style={{gap: 24}}>
          {products.map((p,i) => {
            const isOss = (p.license||'').includes('OSS');
            const platforms = getSupportedPlatforms(p);
            const hasLink = !!p.slug || !!p.repo;
            return (
              <div key={p.id||i} className="card-paper card-hover" onClick={() => p.slug ? go('software', { slug: p.slug }) : null}
                style={{padding: 28, display:'grid', gridTemplateColumns:'1fr', gap:14, cursor: p.slug ? 'pointer' : 'default'}}>
                <div className="row-flex" style={{justifyContent:'space-between'}}>
                  <span className={`tag ${isOss?'tag-euc':'tag-rust'}`}>{p.license}</span>
                  {p.version && <span className="mono" style={{fontSize:11, color:'var(--ink-2)'}}>v{p.version}</span>}
                </div>
                <h3 className="serif" style={{fontSize: 36, lineHeight:1}}>{p.name}</h3>
                {p.tagline && <p style={{color:'var(--ink-2)', fontSize:14, margin:0}}>{p.tagline}</p>}
                <div className="row-flex" style={{justifyContent:'space-between', borderTop:'1px solid var(--line)', paddingTop: 14, marginTop: 4}}>
                  <span className="price" style={{fontSize: 20}}>{p.price || 'Free'}</span>
                  <div className="row-flex" style={{gap:10}}>
                    {platforms.map(os => (
                      <span key={os} style={{color:'var(--ink-2)'}} title={OS_META[os]?.label || os}>{OS_META[os]?.icon || os}</span>
                    ))}
                    {platforms.length === 0 && <span style={{fontSize:12,color:'var(--ink-2)'}}>Coming soon</span>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>
      {osPicker && <SoftwareOSOverlay product={osPicker} go={go} onClose={() => setOsPicker(null)} />}
    </>
  );
}

function getSupportedPlatforms(product) {
  // Derive available platforms from uploaded files, deduplicated
  const fromFiles = [...new Set((product.files || []).map(f => f.platform).filter(p => p && p !== 'other'))];
  // Also include any manually set platforms that don't have a file yet
  const manual = product.platforms || [];
  return [...new Set([...fromFiles, ...manual.filter(p => p !== 'other')])];
}

function SoftwareOSPickerPage({ product, go }) {
  const platforms = getSupportedPlatforms(product);
  const isOss = (product.license||'').includes('OSS');
  return (
    <>
      <PageHead crumbs={['Outback','Software',product.name]} title={product.name}
        lead={product.tagline || ''} />
      <section className="container" style={{paddingTop:32, paddingBottom:48}}>
        <button className="btn btn-ghost btn-sm" style={{marginBottom:32}} onClick={() => go('software', null)}>← All Software</button>
        <div style={{maxWidth:600}}>
          <span className="eyebrow">SELECT YOUR PLATFORM</span>
          <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(140px,1fr))', gap:16, marginTop:20}}>
            {platforms.map(os => {
              const meta = OS_META[os] || { label: os, icon: null };
              const fromFile = (product.files||[]).some(f => f.platform === os || (os === 'cross' && f.platform === 'cross'));
              const fromManual = (product.platforms||[]).includes(os) && (product.files||[]).length > 0;
              const hasFile = fromFile || fromManual;
              return (
                <button key={os} onClick={() => go('software', { slug: product.slug, os })}
                  className="card-paper card-hover"
                  style={{padding:'24px 16px', display:'flex', flexDirection:'column', alignItems:'center', gap:10, cursor:'pointer', border:'1px solid var(--line)', background:'var(--paper)', textAlign:'center'}}>
                  <span style={{color:'var(--ink)'}}>{meta.icon}</span>
                  <span style={{fontWeight:600, fontSize:14}}>{meta.label}</span>
                  {!hasFile && <span className="tag tag-outline" style={{fontSize:10}}>Coming soon</span>}
                </button>
              );
            })}
            {platforms.length === 0 && <p style={{color:'var(--ink-2)', fontSize:14}}>No downloads available yet. Check back soon.</p>}
          </div>
          {product.repo && isOss && (
            <div style={{marginTop:32}}>
              <a href={product.repo} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm">View source on GitHub →</a>
            </div>
          )}
        </div>
      </section>
    </>
  );
}

function SoftwareDetailPage({ product, os, go }) {
  const meta = OS_META[os] || { label: os, icon: null };
  const isOss = (product.license||'').includes('OSS');
  const osFiles = (product.files||[]).filter(f => f.platform === os || (os === 'cross' && f.platform === 'cross') || f.platform === 'other');
  const otherPlatforms = getSupportedPlatforms(product).filter(p => p !== os);
  const minSpecs = product.minSpecs || {};
  const recSpecs = product.recSpecs || {};
  const hasSpecs = Object.values({...minSpecs,...recSpecs}).some(v => v);

  return (
    <>
      <style>{`
        .sw-detail-grid { display: grid; grid-template-columns: 1fr min(320px,35%); gap: 48px; align-items: start; }
        .sw-detail-h1 { font-size: 56px; line-height: 1; margin-bottom: 16px; }
        .sw-specs-table { width: 100%; font-size: 13px; border-collapse: collapse; }
        @media (max-width: 680px) {
          .sw-detail-grid { grid-template-columns: 1fr; gap: 32px; }
          .sw-detail-h1 { font-size: 36px; }
          .sw-specs-table thead { display: none; }
          .sw-specs-table tr { display: block; border-top: 1px solid var(--line); padding: 10px 0; }
          .sw-specs-table td { display: block; padding: 2px 0 !important; }
          .sw-specs-table td:first-child { font-weight: 600; color: var(--ink); font-size: 11px; text-transform: uppercase; letter-spacing: .05em; }
          .sw-specs-table td:nth-child(2)::before { content: 'Min: '; color: var(--ink-2); font-size: 11px; }
          .sw-specs-table td:nth-child(3)::before { content: 'Rec: '; color: var(--ink-2); font-size: 11px; }
        }
      `}</style>
      <PageHead crumbs={['Outback','Software',product.name,meta.label]} title={product.name}
        lead={product.tagline || ''} />
      <section className="container" style={{paddingTop:32, paddingBottom:64}}>
        <div className="row-flex" style={{gap:12, marginBottom:32, flexWrap:'wrap'}}>
          <button className="btn btn-ghost btn-sm" onClick={() => go('software', { slug: product.slug })}>← {product.name}</button>
          {otherPlatforms.map(p => (
            <button key={p} className="btn btn-ghost btn-sm" onClick={() => go('software', { slug: product.slug, os: p })}>
              {OS_META[p]?.label || p} →
            </button>
          ))}
        </div>

        <div className="sw-detail-grid">
          {/* Left: info */}
          <div>
            <div className="row-flex" style={{gap:12, marginBottom:20, flexWrap:'wrap'}}>
              <span className={`tag ${isOss?'tag-euc':'tag-rust'}`}>{product.license}</span>
              {product.version && <span className="tag tag-outline">v{product.version}</span>}
              <span className="row-flex" style={{gap:6, color:'var(--ink-2)', fontSize:14}}>{meta.icon}<span>{meta.label}</span></span>
            </div>
            <h1 className="serif sw-detail-h1">{product.name}</h1>
            {product.tagline && <p style={{fontSize:18, color:'var(--ink-2)', marginBottom:24, lineHeight:1.6}}>{product.tagline}</p>}
            {product.description && <div style={{fontSize:15, lineHeight:1.8, color:'var(--ink)', marginBottom:32, whiteSpace:'pre-wrap'}}>{product.description}</div>}
            {product.quickstart && (
              <div style={{marginBottom:32}}>
                <span className="eyebrow">QUICK START</span>
                <pre style={{background:'var(--bg-deep)', borderRadius:6, padding:'14px 18px', fontSize:13, fontFamily:'JetBrains Mono, monospace', overflowX:'auto', marginTop:10, wordBreak:'break-all', whiteSpace:'pre-wrap'}}>{product.quickstart}</pre>
              </div>
            )}
            {product.requirements && (
              <div style={{marginBottom:32}}>
                <span className="eyebrow">ADDITIONAL REQUIREMENTS</span>
                <p style={{fontSize:14, color:'var(--ink-2)', marginTop:8, lineHeight:1.7}}>{product.requirements}</p>
              </div>
            )}
          </div>

          {/* Right: download + specs */}
          <div style={{display:'flex', flexDirection:'column', gap:20}}>
            {/* Download */}
            <div className="card-paper" style={{padding:24}}>
              <span className="eyebrow" style={{marginBottom:12, display:'block'}}>DOWNLOAD</span>
              {osFiles.length === 0 ? (
                <p style={{fontSize:13, color:'var(--ink-2)'}}>No {meta.label} build available yet.</p>
              ) : osFiles.map((f,i) => (
                <div key={i} style={{marginBottom: i < osFiles.length-1 ? 12 : 0}}>
                  <a href={f.url} download={f.originalName||f.filename} className="btn btn-sm" style={{width:'100%', textAlign:'center', textDecoration:'none', display:'block', marginBottom:6, wordBreak:'break-all', whiteSpace:'normal'}}>
                    ↓ {f.label || f.originalName || 'Download'}
                  </a>
                  <div className="row-flex" style={{justifyContent:'space-between'}}>
                    {f.version && <span className="mono" style={{fontSize:11, color:'var(--ink-2)'}}>v{f.version}</span>}
                    {f.size > 0 && <span className="mono" style={{fontSize:11, color:'var(--ink-2)'}}>{fmtSize(f.size)}</span>}
                  </div>
                </div>
              ))}
              {product.price && <div style={{marginTop:16, paddingTop:12, borderTop:'1px solid var(--line)'}}>
                <span className="price">{product.price}</span>
              </div>}
            </div>

            {/* Repo */}
            {product.repo && (
              <a href={product.repo} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm" style={{textDecoration:'none', textAlign:'center'}}>
                View source →
              </a>
            )}

            {/* System requirements */}
            {hasSpecs && (
              <div className="card-paper" style={{padding:24}}>
                <span className="eyebrow" style={{marginBottom:16, display:'block'}}>SYSTEM REQUIREMENTS</span>
                <table className="sw-specs-table">
                  <thead>
                    <tr>
                      <th style={{textAlign:'left', color:'var(--ink-2)', fontWeight:400, paddingBottom:8, width:'35%'}}></th>
                      <th style={{textAlign:'left', color:'var(--ink-2)', fontWeight:600, paddingBottom:8, fontSize:11}}>MINIMUM</th>
                      <th style={{textAlign:'left', color:'var(--ink-2)', fontWeight:600, paddingBottom:8, fontSize:11}}>RECOMMENDED</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[['OS','os'],['CPU','cpu'],['RAM','ram'],['Storage','storage'],['Other','other']].map(([label,key]) => {
                      if (!minSpecs[key] && !recSpecs[key]) return null;
                      return (
                        <tr key={key} style={{borderTop:'1px solid var(--line)'}}>
                          <td style={{padding:'8px 0', color:'var(--ink-2)', fontWeight:500}}>{label}</td>
                          <td style={{padding:'8px 8px 8px 0'}}>{minSpecs[key] || '-'}</td>
                          <td style={{padding:'8px 0'}}>{recSpecs[key] || '-'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </section>
    </>
  );
}

function fmtSize(bytes) {
  if (!bytes) return '';
  if (bytes >= 1024*1024*1024) return (bytes/(1024*1024*1024)).toFixed(1)+' GB';
  if (bytes >= 1024*1024) return (bytes/(1024*1024)).toFixed(1)+' MB';
  if (bytes >= 1024) return (bytes/1024).toFixed(0)+' KB';
  return bytes+' B';
}

// ============================================================
// EWASTE
// ============================================================
function EwastePage({ go }) {
  const [metrics, setMetrics] = useState({ ewasteTonnes: null, resalePercent: null });
  useEffect(() => {
    fetch('/api/metrics').then(r => r.ok ? r.json() : Promise.reject()).then(d => setMetrics(d)).catch(() => {});
  }, []);
  const stats = [
    {n: metrics.ewasteTonnes !== null ? metrics.ewasteTonnes.toFixed(1) + 't' : '-', l:'DIVERTED · TOTAL', s:'From landfill into refurb, parts, or audited recyclers.'},
    {n: metrics.resalePercent !== null ? metrics.resalePercent + '%' : '-', l:'GEAR RESOLD OR DONATED', s:'Most of what comes in still has a working second life.'},
    {n:'$0', l:'TO DROP OFF', s:'Counter drop-off is always free, regardless of brand.'},
  ];
  return (
    <>
      <PageHead crumbs={['Outback','eWaste']} title="eWaste"
        lead="A take-back program for the bits no one else will touch. We sort, salvage, refurbish, or properly recycle - and pay you for what's worth saving." />
      <section className="container" style={{paddingTop: 40, paddingBottom: 24}}>
        <div className="grid-3">
          {stats.map((s,i) => (
            <div key={i} style={{padding: 32, background:'var(--paper)', border:'1px solid var(--line)'}}>
              <div className="serif" style={{fontSize: 72, color:'var(--rust)', lineHeight:1}}>{s.n}</div>
              <div className="eyebrow" style={{marginTop: 8}}>{s.l}</div>
              <p style={{marginTop: 10, color:'var(--ink-2)', fontSize:14}}>{s.s}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="container" style={{paddingTop: 32, paddingBottom: 40}}>
        <div className="grid-2" style={{gap: 36}}>
          <div>
            <span className="eyebrow">WHAT WE TAKE</span>
            <h2 className="serif" style={{fontSize: 44, marginTop: 8, lineHeight:1}}>If it has a battery, a board or a buzzing transformer - bring it.</h2>
            <div className="grid-2" style={{marginTop: 24, gap:12}}>
              {['Laptops','Desktops','Phones','Tablets','Solar inverters','Power tools','Lead-acid batteries','LiFePO4 packs','UPS units','PV modules','Network gear','Server racks','Cables (sorted)','CRT & LCD displays','Printers','Cameras & scopes'].map((it,i) => (
                <div key={i} className="checks"><li style={{display:'flex', gap:10, alignItems:'flex-start'}}>{it}</li></div>
              ))}
            </div>
            <hr className="thin" />
            <span className="eyebrow">WHAT WE DON'T</span>
            <p style={{marginTop: 8, color:'var(--ink-2)', fontSize:14}}>
              Whitegoods, vape devices, asbestos-backed PCBs, anything radioactive (it has happened). For those, we'll point you at the right council waste transfer station.
            </p>
          </div>

          <div>
            <div className="card-paper" style={{padding: 28}}>
              <span className="tag tag-rust">CASH OR CREDIT</span>
              <h3 className="serif" style={{fontSize: 32, marginTop: 12}}>Trade-in tiers, plainly.</h3>
              <table style={{width:'100%', marginTop: 16, borderCollapse:'collapse', fontSize:13}}>
                <thead>
                  <tr style={{textAlign:'left', borderBottom:'2px solid var(--ink)'}}>
                    <th style={{padding:'10px 0'}}>TIER</th><th>WHAT IT IS</th><th>YOU GET</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ['A','Working, ≤3yrs old','60–75% of refurb price'],
                    ['B','Working, ≤7yrs old','30–50% of refurb price'],
                    ['C','Faulty but parts-worthy','Flat $10–80 + store credit'],
                    ['D','Recycle-only','Free drop-off, drink coupon'],
                  ].map((r,i)=>(
                    <tr key={i} style={{borderBottom:'1px solid var(--line)'}}>
                      <td style={{padding:'12px 0', fontFamily:'Instrument Serif, serif', fontSize:22, color:'var(--rust)'}}>{r[0]}</td>
                      <td>{r[1]}</td><td style={{fontWeight:600}}>{r[2]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="notice" style={{marginTop:16}}>
              <span className="tag tag-euc">PICKUP</span>
              <div style={{fontSize:13, color:'var(--ink-2)'}}>≥ 50kg pallet of dead gear? We'll come grab it for free by appointment only, or freight pre-paid anywhere in Aus.</div>
              <button className="btn btn-sm" onClick={() => go('quote')}>Book pickup</button>
            </div>

            <div className="notice" style={{marginTop:16, background:'var(--bg-elev)'}}>
              <span className="tag tag-ink">DATA</span>
              <div style={{fontSize:13, color:'var(--ink-2)'}}>Every drive is wiped to NIST 800-88 purge, or physically shredded. Certificate emailed within 48h.</div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

// ============================================================
// AI
// ============================================================
function ModelCardModal({ model, onClose, go }) {
  const panelRef = useRef(null);
  window.useFocusTrap(panelRef, onClose);
  return (
    <div style={{position:'fixed', inset:0, zIndex:500, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(15,13,10,0.7)'}}
      onClick={onClose}>
      <div ref={panelRef} role="dialog" aria-modal="true" aria-label={`${model.name} model details`}
        style={{width:'100%', maxWidth:560, background:'var(--bg)', border:'1px solid var(--line)', boxShadow:'0 12px 40px rgba(0,0,0,.35)', padding:32}}
        onClick={e => e.stopPropagation()}>
        <div className="row-flex" style={{justifyContent:'space-between', marginBottom:18}}>
          <div>
            <span className="tag tag-euc">OPEN WEIGHTS</span>
            <h2 className="mono" style={{fontSize:24, marginTop:8, color:'var(--rust)'}}>{model.name}</h2>
          </div>
          <button aria-label="Close model details" style={{background:'none', border:'none', cursor:'pointer', fontSize:22, color:'var(--ink-2)', lineHeight:1}} onClick={onClose}>×</button>
        </div>
        <table style={{width:'100%', borderCollapse:'collapse', fontSize:14, marginBottom:20}}>
          <tbody>
            {[
              ['Task', model.task],
              ['Model size', model.size],
              ['Accuracy', model.acc],
              ['Recommended HW', model.hw],
              ['Licence', 'Apache 2.0'],
              ['Format', 'ONNX / TFLite'],
            ].map(([k,v],i) => (
              <tr key={i} style={{borderBottom:'1px solid var(--line)'}}>
                <td style={{padding:'10px 0', color:'var(--ink-2)', width:'40%'}} className="mono">{k}</td>
                <td style={{padding:'10px 0', fontWeight:500}}>{v}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="term" style={{marginBottom:18}}>
          <div className="mono" style={{fontSize:10, color:'var(--ink-3)', marginBottom:6}}>// QUICK START</div>
          <div><span className="prompt">$</span> oe pull {model.name}</div>
          <div><span className="prompt">$</span> oe deploy {model.name} --camera cam0</div>
        </div>
        <div className="row-flex" style={{gap:8}}>
          <button className="btn btn-rust" onClick={() => { onClose(); go('quote'); }}>Spec a box for this model →</button>
          <button className="btn btn-ghost" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

const AI_SERVICES = [
  {
    tag: 'INTEGRATION',
    title: 'Custom Integration',
    desc: 'We wire AI into your existing systems - APIs, databases, workflows. If you have a process, we can find where intelligence fits.',
  },
  {
    tag: 'CONVERSATIONAL',
    title: 'Chatbots',
    desc: 'Purpose-built conversational agents for customer support, internal tooling, or guided workflows. Trained on your content, deployed on your terms.',
  },
  {
    tag: 'PROJECT-SPECIFIC',
    title: 'Project AI',
    desc: 'AI scoped to a single project, one problem, one solution, built to fit. No bloat, no generic model handed over with a PDF.',
  },
  {
    tag: 'DOMAIN',
    title: 'Subject-Specific AI',
    desc: 'Models fine-tuned on a particular field or discipline. If your domain has a body of knowledge, we can build a model that understands it.',
  },
  {
    tag: 'LARGE LANGUAGE MODELS',
    title: 'LLM Work',
    desc: 'Prompt engineering, fine-tuning, RAG pipelines, and production deployment of large language models for real business problems.',
  },
  {
    tag: 'SMALL LANGUAGE MODELS',
    title: 'SLM Work',
    desc: 'Compact, efficient models that run fast and cost less to operate. Right-sized intelligence for constrained environments or high-volume inference.',
  },
];

function AIPage({ go }) {
  return (
    <>
      <PageHead crumbs={['Outback','AI']} title="Artificial Intelligence"
        kicker={<span className="tag tag-rust">NEW 2026 · BETA PRICING</span>}
        lead="Custom AI built to your problem, from production chatbots and integrations to subject-specific models and frontier research into artificial general intelligence." />

      <section className="container" style={{paddingTop: 40, paddingBottom: 16}}>
        <span className="eyebrow">WHAT WE BUILD</span>
        <h2 className="serif" style={{fontSize: 48, marginTop: 8, lineHeight: 1.1, maxWidth: 640}}>AI for real problems.<br/>Built to spec.</h2>
        <p style={{marginTop: 16, fontSize: 16, color: 'var(--ink-2)', maxWidth: 560}}>
          We don't sell a platform or lock you into a product. Every engagement starts with your problem and ends with something that solves it, whether that's a chatbot, a fine-tuned model, or a full integration into your stack.
        </p>
      </section>

      <section className="container" style={{paddingTop: 32, paddingBottom: 16}}>
        <div className="grid-2" style={{gap: 1, border: '1px solid var(--line)', background: 'var(--line)'}}>
          {AI_SERVICES.map((s) => (
            <div key={s.tag} style={{background: 'var(--paper)', padding: 32}}>
              <span className="eyebrow" style={{fontSize: 10}}>{s.tag}</span>
              <h3 className="serif" style={{fontSize: 26, marginTop: 8, marginBottom: 10}}>{s.title}</h3>
              <p style={{fontSize: 14, color: 'var(--ink-2)', lineHeight: 1.6, margin: 0}}>{s.desc}</p>
            </div>
          ))}
        </div>
        <div style={{marginTop: 24, textAlign: 'center'}}>
          <button className="btn btn-rust" onClick={() => go('quote')}>Talk to us about your project →</button>
        </div>
      </section>

      <section className="container" style={{paddingTop: 56, paddingBottom: 16}}>
        <div className="grid-2" style={{gap: 32, alignItems: 'start'}}>
          <div style={{padding: 40, background: 'var(--dark)', color: 'var(--paper)', border: '1px solid var(--line)'}}>
            <span className="tag tag-rust" style={{marginBottom: 16, display: 'inline-block'}}>RESEARCH · AGI</span>
            <h2 className="serif" style={{fontSize: 40, lineHeight: 1.1, marginTop: 12}}>Attempting true AGI.</h2>
            <p style={{marginTop: 16, fontSize: 15, color: 'var(--bg-deep)', lineHeight: 1.7}}>
              We are actively pursuing artificial general intelligence, not as a marketing claim, but as a research direction. This is hard, unsolved, and we say so plainly. If you want to follow the work or collaborate, get in touch.
            </p>
            <button className="btn btn-rust" style={{marginTop: 28}} onClick={() => go('contact')}>Get in touch →</button>
          </div>
          <div style={{padding: 40, background: 'var(--paper)', border: '1px solid var(--line)'}}>
            <span className="tag tag-euc" style={{marginBottom: 16, display: 'inline-block'}}>RESEARCH · HUMANLY AI</span>
            <h2 className="serif" style={{fontSize: 40, lineHeight: 1.1, marginTop: 12}}>Growing a mind from scratch.</h2>
            <p style={{marginTop: 16, fontSize: 15, color: 'var(--ink-2)', lineHeight: 1.7}}>
              Humanly AI is an attempt to grow a sandboxed digital cognitive organism from raw sensory experience, using developmental learning principles modeled after the human brain. No pretraining on human knowledge. No shortcuts. The goal is to see whether genuine cognition can emerge from the bottom up.
            </p>
            <button className="btn btn-ghost" style={{marginTop: 28}} onClick={() => go('humanly-ai')}>Follow the research →</button>
          </div>
        </div>
      </section>

      <section className="container" style={{paddingTop: 56, paddingBottom: 16}}>
        <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:24, padding:'32px 40px', background:'var(--dark)', border:'1px solid var(--line)'}}>
          <div>
            <span className="eyebrow" style={{color:'var(--rust)'}}>TRY IT NOW</span>
            <h2 className="serif" style={{fontSize:32, color:'var(--paper)', marginTop:8, marginBottom:8}}>Chat with our on-prem AI assistant.</h2>
            <p style={{fontSize:14, color:'var(--bg-deep)', margin:0, maxWidth:480}}>Ask electronics repair questions, get troubleshooting help, or talk components. Runs entirely on our own hardware, nothing sent to the cloud.</p>
          </div>
          <a className="btn btn-rust" style={{flexShrink:0, fontSize:16, padding:'14px 28px'}} href="https://ai.outbackelectronics.com.au">Open AI Chat →</a>
        </div>
      </section>

      <section className="container" style={{paddingTop: 56, paddingBottom: 56}}>
        <span className="eyebrow">AI IN ACTION</span>
        <h2 className="serif" style={{fontSize: 40, marginTop: 6, marginBottom: 8}}>What it's like to be an AI</h2>
        <p style={{fontSize: 13, color: 'var(--ink-3)', fontFamily: 'JetBrains Mono, monospace', marginBottom: 24, maxWidth: 620}}>
          This video was created entirely by Claude AI, using only HTML code, no image or true video generation.
        </p>
        <div style={{position: 'relative', width: '100%', paddingBottom: '56.25%', background: '#000', border: '1px solid var(--line)'}}>
          <iframe
            src="/assets/ai-video.html"
            title="What It's Like to Be an AI"
            style={{position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none'}}
            allow="autoplay; encrypted-media"
          />
        </div>
      </section>
    </>
  );
}

// ============================================================
// PRODUCT DETAIL
// ============================================================

// In-app not-found view for invalid /product/:id and /service/:id deep links
// the user gets a clear message and a way back instead of a blank page.
function CatalogNotFound({ go, kind }) {
  const isService = kind === 'service';
  return (
    <>
      <PageHead crumbs={['Outback', isService ? 'Services' : 'Shop', 'Not Found']}
        title={isService ? 'Service not found' : 'Product not found'}
        lead={`Sorry, we couldn't find that ${kind}. It may have been removed or the link may be incorrect.`} />
      <section className="container" style={{paddingTop:32, paddingBottom:48}}>
        <div style={{display:'flex', gap:12, flexWrap:'wrap'}}>
          <button className="btn btn-rust" onClick={() => go(isService ? 'services' : 'shop')}>
            {isService ? 'Browse all Services →' : 'Browse the Shop →'}
          </button>
          <button className="btn btn-ghost" onClick={() => go('contact')}>Contact us</button>
        </div>
      </section>
    </>
  );
}

// Full-screen image lightbox with keyboard navigation (Escape closes, arrows cycle)
function ImageLightbox({ images, startIndex, alt, onClose }) {
  const [idx, setIdx] = useState(startIndex || 0);
  const panelRef = useRef(null);
  window.useFocusTrap(panelRef, onClose);
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'ArrowRight') setIdx(i => (i + 1) % images.length);
      if (e.key === 'ArrowLeft') setIdx(i => (i - 1 + images.length) % images.length);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [images.length]);
  return (
    <div style={{position:'fixed', inset:0, zIndex:600, background:'rgba(15,13,10,0.9)', display:'flex', alignItems:'center', justifyContent:'center', padding:24}}
      onClick={onClose}>
      <div ref={panelRef} role="dialog" aria-modal="true" aria-label={`${alt}, image ${idx + 1} of ${images.length}`}
        style={{position:'relative', maxWidth:'92vw', maxHeight:'92vh'}} onClick={e => e.stopPropagation()}>
        <img src={images[idx]} alt={alt} style={{maxWidth:'92vw', maxHeight:'86vh', objectFit:'contain', display:'block', background:'var(--bg-deep)'}} />
        <button onClick={onClose} aria-label="Close image viewer"
          style={{position:'absolute', top:-14, right:-14, width:36, height:36, borderRadius:'50%', background:'var(--paper)', border:'1px solid var(--line)', cursor:'pointer', fontSize:18, lineHeight:1, display:'grid', placeItems:'center'}}>×</button>
        {images.length > 1 && (
          <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:10, gap:12}}>
            <button className="btn btn-ghost btn-sm" aria-label="Previous image" onClick={() => setIdx(i => (i - 1 + images.length) % images.length)}>← Prev</button>
            <span className="mono" style={{fontSize:11, color:'var(--paper)'}}>{idx + 1} / {images.length}</span>
            <button className="btn btn-ghost btn-sm" aria-label="Next image" onClick={() => setIdx(i => (i + 1) % images.length)}>Next →</button>
          </div>
        )}
      </div>
    </div>
  );
}

function ProductReviews({ productId }) {
  const [reviews, setReviews] = useState(null);

  useEffect(() => {
    setReviews(null);
    if (!productId) return;
    fetch(`/api/reviews?productId=${encodeURIComponent(productId)}`)
      .then(r => r.ok ? r.json() : null).then(d => setReviews(d ? d.items : [])).catch(() => setReviews([]));
  }, [productId]);

  if (!productId || !reviews || reviews.length === 0) return null;

  const avg = reviews.reduce((s, r) => s + r.rating, 0) / reviews.length;
  const stars = n => '★'.repeat(n) + '☆'.repeat(5 - n);

  return (
    <section className="container" style={{paddingTop:40, paddingBottom:56}}>
      <div className="row-flex" style={{gap:14, alignItems:'baseline', marginBottom:20}}>
        <span className="eyebrow">CUSTOMER REVIEWS</span>
        <span className="mono" style={{fontSize:13, color:'var(--ochre)'}}>{stars(Math.round(avg))} {avg.toFixed(1)} ({reviews.length})</span>
      </div>
      <div style={{display:'grid', gap:16}}>
        {reviews.map(r => (
          <div key={r.id} className="card-paper" style={{padding:20}}>
            <div className="row-flex" style={{justifyContent:'space-between'}}>
              <span className="mono" style={{color:'var(--ochre)'}}>{stars(r.rating)}</span>
              <span className="mono" style={{fontSize:11, color:'var(--ink-2)'}}>{r.createdAt ? new Date(r.createdAt).toLocaleDateString('en-AU') : ''}</span>
            </div>
            {r.title && <div style={{fontWeight:600, marginTop:8}}>{r.title}</div>}
            <p style={{marginTop:6, fontSize:14, color:'var(--ink-2)'}}>{r.body}</p>
            {r.photos?.length > 0 && (
              <div className="row-flex" style={{gap:8, marginTop:10, flexWrap:'wrap'}}>
                {r.photos.map(url => (
                  <a key={url} href={url} target="_blank" rel="noopener noreferrer">
                    <img src={url} alt="" style={{width:72, height:72, objectFit:'cover', border:'1px solid var(--line)'}} />
                  </a>
                ))}
              </div>
            )}
            <div className="mono" style={{marginTop:10, fontSize:11, color:'var(--ink-3)'}}>{r.customerName}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

function ProductDetailPage({ go, addToCart, pageParams }) {
  const [product, setProduct] = useState(pageParams || null);
  const [selectedVariant, setSelectedVariant] = useState(
    pageParams?.variants?.length ? pageParams.variants[0] : null
  );
  const [activeImage, setActiveImage] = useState(null);
  const [qty, setQty] = useState(1);
  const [notifyEmail, setNotifyEmail] = useState('');
  const [notifySent, setNotifySent] = useState(false);
  const [notifySending, setNotifySending] = useState(false);
  const [notifyError, setNotifyError] = useState(null);
  const [relatedProducts, setRelatedProducts] = useState([]);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  useEffect(() => {
    setProduct(pageParams || null);
    if (pageParams && !pageParams._notFound) {
      const firstVariant = pageParams.variants && pageParams.variants.length > 0 ? pageParams.variants[0] : null;
      setSelectedVariant(firstVariant);
      const firstImg = (firstVariant?.images?.length ? firstVariant.images[0] : null) || (pageParams.images?.[0] ?? null);
      setActiveImage(firstImg);
      setQty(1);
      setNotifyEmail(''); setNotifySent(false); setNotifyError(null); setLightboxOpen(false);
    }
  }, [pageParams]);

  useEffect(() => {
    if (!pageParams || pageParams._notFound) return;
    fetch('/api/catalog/products').then(r => r.ok ? r.json() : null).then(d => {
      if (!d) return;
      const all = d.items || [];
      const currentKey = pageParams.sku || pageParams.id;
      const sameCategory = all.filter(p => p.category === pageParams.category && (p.sku || p.id) !== currentKey);
      const pool = sameCategory.length >= 4 ? sameCategory : all.filter(p => (p.sku || p.id) !== currentKey);
      const shuffled = pool.sort(() => 0.5 - Math.random()).slice(0, 4);
      setRelatedProducts(shuffled);
    }).catch(() => {});
  }, [pageParams]);

  const selectVariant = (v) => {
    setSelectedVariant(v);
    setQty(1);
    if (v.images && v.images.length > 0) setActiveImage(v.images[0]);
  };

  // #11, actually register the back-in-stock request with the server
  const submitNotify = async () => {
    const email = notifyEmail.trim();
    if (!email || notifySending) return;
    setNotifyError(null);
    setNotifySending(true);
    try {
      await ensureCsrf();
      const resp = await fetch('/api/stock-notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': getCsrf() },
        body: JSON.stringify({
          email,
          productId: product.id || product.sku || '',
          variantSku: selectedVariant?.sku || '',
        }),
      });
      const data = await resp.json().catch(() => ({}));
      if (resp.ok) setNotifySent(true);
      else setNotifyError(data.message || 'Could not save your request. Please try again.');
    } catch {
      setNotifyError('Could not connect. Please try again.');
    } finally {
      setNotifySending(false);
    }
  };

  // Deep link still resolving, show a loading state, not a premature 404
  if (!product) {
    return (
      <>
        <PageHead crumbs={['Outback', 'Shop', 'Product']} title="Loading…" />
        <section className="container" style={{paddingTop:32, paddingBottom:48}}>
          <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:48}}>
            <div className="skeleton" style={{aspectRatio:'4/3'}} />
            <div style={{display:'grid', gap:14, alignContent:'start'}}>
              <div className="skeleton" style={{height:36, width:'70%'}} />
              <div className="skeleton" style={{height:18, width:'40%'}} />
              <div className="skeleton" style={{height:48, width:'55%'}} />
            </div>
          </div>
        </section>
      </>
    );
  }

  if (product._notFound) return <CatalogNotFound go={go} kind="product" />;

  const hasVariants = product.variants && product.variants.length > 0;
  const activePrice = selectedVariant ? selectedVariant.price : productPrice(product);
  const onBackorder = !!product.allowBackorder && !product.infiniteStock && (hasVariants
    ? !(selectedVariant && (Number(selectedVariant.stock) || 0) > 0)
    : (Number(product.stock) || 0) <= 0);
  const inStock = product.infiniteStock || product.allowBackorder
    ? true
    : hasVariants
      ? (selectedVariant ? (selectedVariant.stock || 0) > 0 : false)
      : product.stock > 0;
  // Bulk pricing hangs off whichever entry owns the price and the stock.
  const priced = hasVariants ? selectedVariant : product;
  const bulkQty = Math.floor(Number(priced?.bulkQty) || 0);
  // The bulk rate is the same units at a lower price, not a separate pool
  // once fewer than bulkQty remain the threshold is unreachable, so the offer
  // stops being shown rather than becoming a promise we can't honour.
  const bulkAvailable = bulkOfferAvailable(priced);
  const bulkSoldDown = hasBulkPrice(priced) && !bulkAvailable;
  const stockLeft = availableStock(priced);
  // Bulk pricing applies from the quantity alone, no separate action to take.
  const maxQty = stockLeft === null ? 999 : Math.max(1, stockLeft);
  const safeQty = Math.min(Math.max(1, qty), maxQty);
  const unitPrice = bulkUnitPrice(priced, safeQty);
  // The bulk comparison base: a variant carries its own `price`, a product
  // carries `priceAud`.
  const pricedBase = hasVariants ? (Number(priced && priced.price) || 0) : productPrice(product);
  const bulkApplied = hasBulkPrice(priced) && unitPrice < pricedBase;
  const unitsToBulk = bulkAvailable && !bulkApplied ? bulkQty - safeQty : 0;
  const addSelection = () => addToCart(
    hasVariants ? { ...product, ...selectedVariant, _variantSku: selectedVariant.sku || selectedVariant.name || '' } : product,
    safeQty,
  );

  return (
    <>
      <PageHead crumbs={['Outback', 'Shop', product.name]} title={product.name} />
      <section className="container" style={{paddingTop:32, paddingBottom:56}}>
        <button className="btn btn-ghost btn-sm" onClick={() => go('shop')} style={{marginBottom:24}}>← Back to Shop</button>
        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:48, alignItems:'start'}}>
          <div>
            {activeImage
              ? <button onClick={() => setLightboxOpen(true)} aria-label={`View larger image of ${product.name}`}
                  style={{display:'block', width:'100%', padding:0, border:'none', background:'none', cursor:'zoom-in'}}>
                  <img src={thumbUrl(activeImage, 800)} srcSet={thumbSrcSet(activeImage, [400, 600, 800])} sizes="(max-width: 900px) 100vw, 50vw" alt={(product.imageAlts||{})[activeImage] || product.name} loading="lazy" style={{width:'100%', aspectRatio:'4/3', maxHeight:'70vh', objectFit:'contain', display:'block', background:'var(--bg-deep)'}} />
                </button>
              : <div className="slot" style={{aspectRatio:'4/3', width:'100%'}}>{(product.name || '').toUpperCase()}</div>}
            {activeImage && (
              <div className="mono" style={{fontSize:10, color:'var(--ink-3)', marginTop:6, textAlign:'center'}}>CLICK IMAGE TO ZOOM</div>
            )}
            {product.images && product.images.length > 1 && (
              <div style={{display:'flex', gap:8, marginTop:10, flexWrap:'wrap'}}>
                {product.images.map((url, i) => (
                  <button key={i} onClick={() => setActiveImage(url)}
                    aria-label={`View image ${i + 1} of ${product.images.length}`} aria-pressed={activeImage === url}
                    style={{width:64, height:64, cursor:'pointer', padding:0, background:'none', border: activeImage===url ? '2px solid var(--rust)' : '2px solid transparent', flexShrink:0}}>
                    <img src={thumbUrl(url, 128)} alt="" loading="lazy" width="64" height="64" style={{width:'100%', height:'100%', objectFit:'cover', display:'block'}} />
                  </button>
                ))}
              </div>
            )}
            {lightboxOpen && activeImage && (
              <ImageLightbox
                images={(product.images && product.images.length > 0 ? product.images : [activeImage]).map(u => thumbUrl(u, 1600, 90))}
                startIndex={Math.max(0, (product.images || [activeImage]).indexOf(activeImage))}
                alt={product.name}
                onClose={() => setLightboxOpen(false)}
              />
            )}
          </div>
          <div>
            <div className="row-flex" style={{gap:8, marginBottom:12, flexWrap:'wrap'}}>
              {product.brand && <span className="tag tag-outline">{product.brand}</span>}
              {product.cond && <span className="tag">{product.cond}</span>}
              {!hasVariants && product.tag && <span className={`tag ${product.tagClass || ''}`}>{product.tag.toUpperCase()}</span>}
            </div>
            <h2 className="serif" style={{fontSize:40, lineHeight:1.05, marginBottom:8}}>{product.name}</h2>
            <div className="mono" style={{fontSize:12, color:'var(--ink-3)', marginBottom:20}}>SKU: {product.sku || (hasVariants && selectedVariant ? selectedVariant.sku : '-')}</div>
            <div style={{display:'flex', alignItems:'baseline', gap:12, marginBottom: bulkApplied ? 6 : 24, flexWrap:'wrap'}}>
              <span className="price" style={{fontSize:36}}>${unitPrice ? unitPrice.toLocaleString() : (activePrice ? activePrice.toLocaleString() : '-')}</span>
              {bulkApplied && <span className="price-strike" style={{fontSize:20}}>${pricedBase.toLocaleString()}</span>}
              {!bulkApplied && !hasVariants && product.was && <span className="price-strike" style={{fontSize:20}}>${Number(product.was).toLocaleString()}</span>}
              {safeQty > 1 && <span className="mono" style={{fontSize:13, color:'var(--ink-2)'}}>each · ${(unitPrice * safeQty).toLocaleString()} total</span>}
            </div>
            {bulkApplied && (
              <div className="mono" style={{fontSize:12, color:'var(--eucalyptus)', marginBottom:24}}>
                ✓ BULK PRICE APPLIED: {bulkQty}+ AT ${Number(priced.bulkPrice).toLocaleString()} EACH
              </div>
            )}

            {hasVariants && (
              <div style={{marginBottom:24}}>
                <div className="eyebrow" id="variant-label" style={{marginBottom:10}}>SELECT VARIANT</div>
                <div style={{display:'grid', gap:8}} role="radiogroup" aria-labelledby="variant-label">
                  {product.variants.map((v, i) => {
                    const isSelected = selectedVariant && selectedVariant.sku === v.sku;
                    const stockLabel = !v.stock || v.stock === 0 ? 'Out of stock' : v.stock <= 3 ? `${v.stock} left` : 'In stock';
                    return (
                      <button key={i} type="button" onClick={() => selectVariant(v)}
                        role="radio" aria-checked={!!isSelected}
                        style={{display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 14px', cursor:'pointer', font:'inherit', color:'inherit', textAlign:'left', width:'100%', border:'1px solid var(--line)', borderLeft: isSelected ? '3px solid var(--rust)' : '1px solid var(--line)', background: isSelected ? 'var(--bg-elev)' : 'transparent'}}>
                        <span style={{fontWeight: isSelected ? 600 : 400}}>{v.name}</span>
                        <div style={{display:'flex', gap:14, alignItems:'center'}}>
                          <span className="mono" style={{fontSize:14}}>${v.price.toLocaleString()}</span>
                          <span className="mono" style={{fontSize:11, color:'var(--ink-2)'}}>{stockLabel}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {(bulkAvailable || bulkSoldDown) && (
              <div style={{marginBottom:24, padding:'12px 16px', border:'1px solid var(--line)', background:'var(--bg-elev)'}}>
                {bulkAvailable ? (
                  <div style={{fontSize:14}}>
                    Buy <strong>{bulkQty} or more</strong> for <strong>${Number(priced.bulkPrice).toLocaleString()} each</strong>
                    <span style={{color:'var(--ink-3)'}}> save ${((pricedBase - Number(priced.bulkPrice)) * bulkQty).toLocaleString()}</span>
                    {unitsToBulk > 0 && (
                      <div className="mono" style={{fontSize:12, color:'var(--ink-3)', marginTop:6}}>
                        ADD {unitsToBulk} MORE TO QUALIFY
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="mono" style={{fontSize:12, color:'var(--ink-3)'}}>
                    Bulk price unavailable: only {stockLeft} left, {bulkQty} needed.
                  </div>
                )}
              </div>
            )}

            {(product.description || product.desc) && (
              // Descriptions are plain text typed into a textarea, so the line
              // breaks the author put in are the only structure they have.
              // `desc` is the key the editor wrote before it was corrected;
              // reading it here saves re-saving every older product.
              <p style={{color:'var(--ink-2)', fontSize:15, lineHeight:1.7, marginBottom:24, whiteSpace:'pre-wrap'}}>{product.description || product.desc}</p>
            )}

            {Array.isArray(product.specs) && product.specs.filter(sp => sp && (sp.name || sp.value)).length > 0 && (
              <div style={{marginBottom:24}}>
                <div className="eyebrow" id="specs-label" style={{marginBottom:10}}>SPECIFICATIONS</div>
                <table aria-labelledby="specs-label" style={{width:'100%', borderCollapse:'collapse', fontSize:14}}>
                  <tbody>
                    {product.specs.filter(sp => sp && (sp.name || sp.value)).map((sp, i) => (
                      <tr key={i} style={{borderBottom:'1px solid var(--line)'}}>
                        <th scope="row" style={{textAlign:'left', fontWeight:600, color:'var(--ink-2)', padding:'7px 12px 7px 0', width:'40%', verticalAlign:'top'}}>{sp.name}</th>
                        <td style={{padding:'7px 0', color:'var(--ink)'}}>{sp.value}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {inStock && (
              <div className="row-flex" style={{gap:12, alignItems:'center', marginBottom:12}}>
                <span className="eyebrow" id="qty-label">QUANTITY</span>
                <div style={{display:'flex', alignItems:'center', gap:6}}>
                  <button type="button" onClick={() => setQty(q => Math.max(1, Math.min(q, maxQty) - 1))} disabled={safeQty <= 1}
                    aria-label="Decrease quantity"
                    style={{width:32, height:32, border:'1px solid var(--line)', background:'var(--bg-elev)', cursor: safeQty <= 1 ? 'not-allowed' : 'pointer', opacity: safeQty <= 1 ? 0.4 : 1, fontSize:18}}>−</button>
                  <input className="input mono" type="number" min="1" max={maxQty} value={safeQty} aria-labelledby="qty-label"
                    onChange={e => setQty(Math.min(maxQty, Math.max(1, Math.floor(Number(e.target.value) || 1))))}
                    style={{width:64, textAlign:'center'}} />
                  <button type="button" onClick={() => setQty(q => Math.min(maxQty, Math.max(1, q) + 1))} disabled={safeQty >= maxQty}
                    aria-label="Increase quantity"
                    style={{width:32, height:32, border:'1px solid var(--line)', background:'var(--bg-elev)', cursor: safeQty >= maxQty ? 'not-allowed' : 'pointer', opacity: safeQty >= maxQty ? 0.4 : 1, fontSize:18}}>+</button>
                </div>
                {onBackorder
                  ? <span className="mono" style={{fontSize:11, color:'var(--ochre)'}}>ON BACKORDER{backorderLead(product) ? ` - SHIPS IN ${backorderLead(product).toUpperCase()}` : ''}</span>
                  : stockLeft !== null && <span className="mono" style={{fontSize:11, color:'var(--ink-3)'}}>{stockLeft} AVAILABLE</span>}
              </div>
            )}

            <div style={{display:'flex', gap:12}}>
              <button className="btn btn-rust" style={{flex:1, justifyContent:'center'}}
                disabled={!inStock}
                onClick={addSelection}>
                {!inStock ? 'Out of Stock' : onBackorder ? (safeQty > 1 ? `Backorder ${safeQty}` : 'Backorder') : (safeQty > 1 ? `Add ${safeQty} to Cart` : 'Add to Cart')}
              </button>
              <button className="btn btn-ghost" onClick={() => go('quote')}>Request a Quote</button>
            </div>
            {!inStock && (
              <div style={{marginTop:16, padding:'16px 18px', background:'var(--bg-elev)', border:'1px solid var(--line)'}}>
                {notifySent ? (
                  <div className="mono" role="status" style={{fontSize:12, color:'var(--eucalyptus)'}}>✓ We'll email you when this is back in stock.</div>
                ) : (
                  <>
                    <div className="eyebrow" style={{marginBottom:8}}>NOTIFY ME WHEN BACK IN STOCK</div>
                    <div style={{display:'flex', gap:8}}>
                      <input
                        className="input"
                        type="email"
                        placeholder="your@email.com"
                        aria-label="Email address for back-in-stock notification"
                        value={notifyEmail}
                        onChange={e => { setNotifyEmail(e.target.value); setNotifyError(null); }}
                        onKeyDown={e => e.key === 'Enter' && submitNotify()}
                        style={{flex:1, fontSize:13}}
                      />
                      <button className="btn btn-ghost btn-sm"
                        disabled={!notifyEmail.trim() || notifySending}
                        onClick={submitNotify}>
                        {notifySending ? '…' : 'Notify me'}
                      </button>
                    </div>
                    <ErrorText inline>{notifyError}</ErrorText>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </section>
      <ProductReviews productId={product.id || product.sku} />
      {relatedProducts.length > 0 && (
        <section className="container" style={{paddingTop:40, paddingBottom:56}}>
          <div className="row-flex" style={{justifyContent:'space-between', marginBottom:20, alignItems:'baseline'}}>
            <div>
              <span className="eyebrow">MORE FROM THE SHOP</span>
              <h3 className="serif" style={{fontSize:28, marginTop:4}}>You might also like</h3>
            </div>
            <button className="mono" style={{fontSize:12, color:'var(--rust)', background:'none', border:'none', cursor:'pointer', padding:0}} onClick={() => go('shop')}>ALL LISTINGS →</button>
          </div>
          <div className="grid-4">
            {relatedProducts.map((p, i) => <ProductCard key={p.id || i} p={p} onClick={() => go('product', p)} />)}
          </div>
        </section>
      )}
    </>
  );
}

// ============================================================
// SERVICE DETAIL
// ============================================================
const SHOP_LAT = -35.9845;
const SHOP_LNG = 144.7730;
const CALLOUT_FREE_KM = 10;
const CALLOUT_LOCAL_CAP_KM = 200;
const CALLOUT_HIVAL_THRESHOLD = 10000;
const CALLOUT_FUEL_RATE = 220 / 400;  // $0.55/km round trip
const CALLOUT_KM_PER_DAY = 480;        // 6h × 80km/h
const CALLOUT_DAILY_RATE = 150;
const CALLOUT_DAILY_THRESHOLD_KM = 400;

function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

function calloutFeeAud(distKm) {
  if (distKm <= CALLOUT_FREE_KM) return 0;
  const fuel = distKm * CALLOUT_FUEL_RATE;
  const daily = distKm > CALLOUT_DAILY_THRESHOLD_KM
    ? Math.ceil(distKm / CALLOUT_KM_PER_DAY) * 2 * CALLOUT_DAILY_RATE
    : 0;
  return Math.round(fuel + daily);
}

function calloutFeeBreakdown(distKm) {
  if (distKm <= CALLOUT_FREE_KM) return null;
  const fuel = Math.round(distKm * CALLOUT_FUEL_RATE);
  if (distKm <= CALLOUT_DAILY_THRESHOLD_KM) return `${distKm}km · $0.55/km fuel`;
  const days = Math.ceil(distKm / CALLOUT_KM_PER_DAY);
  return `${distKm}km · $${fuel} fuel + ${days * 2} travel days × $${CALLOUT_DAILY_RATE}`;
}

function ServiceDetailPage({ go, pageParams, portalUser, onPortalUserChange }) {
  const shop = useShop();
  const { InlineAuthGate } = window.__OE_HELPERS__ || {};
  const [service, setService] = useState(pageParams || null);
  const [bookForm, setBookForm] = useState({ name: '', email: '', loc: '', date: '', notes: '' });
  const [booking, setBooking] = useState(false);
  const [bookError, setBookError] = useState(null);
  const [distanceKm, setDistanceKm] = useState(null); // null = not checked yet
  const [geocoding, setGeocoding] = useState(false);
  const [planMinTotal, setPlanMinTotal] = useState(300);
  const [checkoutMode, setCheckoutMode] = useState('full'); // 'full' | 'plan'
  const [planFrequency, setPlanFrequency] = useState('fortnightly');
  const [planInstallmentAmount, setPlanInstallmentAmount] = useState('');
  const [planCollectionMethod, setPlanCollectionMethod] = useState('manual');

  useEffect(() => {
    fetch('/api/shop-info').then(r => r.json()).then(d => {
      const min = Number(d.shop?.paymentPlanMinTotal);
      if (min > 0) setPlanMinTotal(min);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    setService(pageParams || null);
    if (pageParams && !pageParams._notFound) { setBookForm({ name: '', email: '', loc: '', date: '', notes: '' }); setBookError(null); setDistanceKm(null); }
  }, [pageParams]);

  // Debounced geocode on loc change
  useEffect(() => {
    if (!bookForm.loc || bookForm.loc.trim().length < 3) { setDistanceKm(null); return; }
    const t = setTimeout(async () => {
      setGeocoding(true);
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(bookForm.loc + ', Australia')}&limit=1`,
          { headers: { 'Accept-Language': 'en' } }
        );
        const data = await res.json();
        if (data[0]) {
          const km = haversineKm(SHOP_LAT, SHOP_LNG, parseFloat(data[0].lat), parseFloat(data[0].lon));
          setDistanceKm(Math.round(km));
        } else {
          setDistanceKm(null);
        }
      } catch { setDistanceKm(null); }
      finally { setGeocoding(false); }
    }, 700);
    return () => clearTimeout(t);
  }, [bookForm.loc]);

  const fixedPrice = service ? Number(service.priceAud) : NaN;
  const hasFixedPrice = service && !isNaN(fixedPrice) && fixedPrice > 0;
  const isHighValue = fixedPrice >= CALLOUT_HIVAL_THRESHOLD;
  const outOfRange = distanceKm !== null && distanceKm > CALLOUT_LOCAL_CAP_KM && !isHighValue;
  const travelFee = distanceKm !== null && !outOfRange ? calloutFeeAud(distanceKm) : null;
  // Payment plans don't carry the travel-fee calculation, so only offer one when there's no travel fee to add.
  const planEligible = fixedPrice >= planMinTotal && !(travelFee > 0);

  const handlePayAndBook = async (e) => {
    e.preventDefault();
    setBookError(null);
    if (!portalUser) { setBookError('Please sign in or create an account before booking.'); return; }
    if (checkoutMode === 'plan' && !(Number(planInstallmentAmount) > 0)) { setBookError('Enter an instalment amount greater than zero.'); return; }
    setBooking(true);
    try {
      await fetch('/api/csrf-token', { credentials: 'include' }).catch(() => {});
      const csrf = getCsrf();
      const travelLine = travelFee > 0 ? ` · Travel fee: $${travelFee} (${distanceKm}km)` : ' · Free callout';
      await fetch('/api/quote/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
        body: JSON.stringify({
          kind: 'Repair',
          budget: `$${fixedPrice} (fixed)`,
          urgency: 'Standard',
          name: bookForm.name,
          email: bookForm.email,
          loc: bookForm.loc,
          desc: `Service booking: ${service.name}${bookForm.date ? ` · Preferred date: ${bookForm.date}` : ''}${travelLine}${bookForm.notes ? ` · Notes: ${bookForm.notes}` : ''}`,
          _service: service.name,
          _serviceSku: service.sku || '',
        }),
      }).catch(() => {});
      const resp = await fetch(checkoutMode === 'plan' ? '/api/checkout/payment-plan' : '/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
        body: JSON.stringify({
          items: [{ productId: service.id, name: service.name, priceAud: fixedPrice, quantity: 1 }],
          travelDistanceKm: distanceKm || 0,
          ...(checkoutMode === 'plan' ? { paymentPlan: { frequency: planFrequency, installmentAmount: Number(planInstallmentAmount), collectionMethod: planCollectionMethod } } : {}),
        }),
      });
      const data = await resp.json().catch(() => ({}));
      if (data.url) {
        window.location.href = data.url;
      } else {
        setBookError(data.message || 'Could not start checkout, please try again or call us.');
      }
    } catch {
      setBookError('Could not connect to payment provider. Please try again.');
    } finally {
      setBooking(false);
    }
  };

  // Deep link still resolving, show a loading state, not a premature 404
  if (!service) {
    return (
      <>
        <PageHead crumbs={['Outback', 'Services', 'Service']} title="Loading…" />
        <section className="container" style={{paddingTop:32, paddingBottom:48}}>
          <div style={{maxWidth:640, display:'grid', gap:14}}>
            <div className="skeleton" style={{height:36, width:'60%'}} />
            <div className="skeleton" style={{height:18, width:'90%'}} />
            <div className="skeleton" style={{height:80, width:'100%'}} />
          </div>
        </section>
      </>
    );
  }

  if (service._notFound) return <CatalogNotFound go={go} kind="service" />;

  return (
    <>
      <PageHead crumbs={['Outback', 'Services', service.name]} title={service.name} />
      <section className="container" style={{paddingTop:32, paddingBottom:56}}>
        <button className="btn btn-ghost btn-sm" onClick={() => go('services')} style={{marginBottom:24}}>← Back to Services</button>
        <div style={{maxWidth:640}}>
          <div style={{display:'flex', gap:8, marginBottom:12, flexWrap:'wrap'}}>
            {service.category && <span className="tag tag-outline">{service.category}</span>}
            {service.sku && <span className="mono" style={{fontSize:11, color:'var(--rust)', padding:'4px 8px', border:'1px solid var(--line)'}}>{service.sku}</span>}
          </div>
          <h2 className="serif" style={{fontSize:40, lineHeight:1.05, marginBottom:16}}>{service.name}</h2>
          {service.description && (
            <p style={{color:'var(--ink-2)', fontSize:15, lineHeight:1.7, marginBottom:24}}>{interpolateServiceText(service.description, shop)}</p>
          )}
          <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:28}}>
            <div style={{padding:18, background:'var(--bg-elev)', border:'1px solid var(--line)'}}>
              <div className="eyebrow" style={{marginBottom:6}}>PRICE</div>
              <div className="price" style={{fontSize:24}}>{service.priceLine}</div>
            </div>
            <div style={{padding:18, background:'var(--bg-elev)', border:'1px solid var(--line)'}}>
              <div className="eyebrow" style={{marginBottom:6}}>TURNAROUND</div>
              <div style={{fontWeight:600, fontSize:16}}>{service.tat}</div>
            </div>
          </div>

          {hasFixedPrice ? (
            <form onSubmit={handlePayAndBook} style={{borderTop:'2px solid var(--rust)', paddingTop:24, marginTop:8}}>
              <span className="eyebrow" style={{marginBottom:12, display:'block'}}>BOOK &amp; PAY - {service.priceLine}</span>
              <div className="grid-2" style={{gap:14, marginBottom:14}}>
                <label className="field"><span className="label">Name</span><input required className="input" value={bookForm.name} onChange={e => setBookForm(f => ({...f, name: e.target.value}))} placeholder="Your name" /></label>
                <label className="field"><span className="label">Email or sat number</span><input required className="input" value={bookForm.email} onChange={e => setBookForm(f => ({...f, email: e.target.value}))} placeholder="your@email.com" /></label>
              </div>
              <label className="field" style={{marginBottom:6}}>
                <span className="label">Your location / nearest town</span>
                <input className="input" value={bookForm.loc} onChange={e => setBookForm(f => ({...f, loc: e.target.value}))} placeholder="Newman, WA" />
              </label>
              {/* Callout fee banner */}
              {geocoding && (
                <div className="mono" style={{fontSize:11, color:'var(--ink-2)', marginBottom:14}}>Checking distance…</div>
              )}
              {!geocoding && distanceKm !== null && (
                <div style={{marginBottom:14, padding:'10px 14px', fontSize:13, border:'1px solid var(--line)', background: outOfRange ? '#fff3f3' : 'var(--bg-elev)', borderColor: outOfRange ? 'var(--rust)' : 'var(--line)'}}>
                  {outOfRange ? (
                    <>That's {distanceKm}km, on-site bookings for this service are capped at {CALLOUT_LOCAL_CAP_KM}km. <span style={{color:'var(--rust)', fontWeight:600}}>Post your device to us</span> or <a href="/quote" style={{color:'var(--rust)', cursor:'pointer', textDecoration:'underline'}} onClick={(e) => { e.preventDefault(); go('quote', service); }}>request a quote</a> for a discussion.</>
                  ) : distanceKm <= CALLOUT_FREE_KM ? (
                    <><span style={{color:'var(--rust)', fontWeight:600}}>✓ Free callout</span> - you're {distanceKm}km away.</>
                  ) : (
                    <><span style={{fontWeight:600}}>+${travelFee} travel fee</span>, {calloutFeeBreakdown(distanceKm)}. Added to your total.</>
                  )}
                </div>
              )}
              <label className="field" style={{marginBottom:14}}>
                <span className="label">Preferred date (optional)</span>
                <input className="input" type="date" value={bookForm.date} onChange={e => setBookForm(f => ({...f, date: e.target.value}))} min={new Date().toISOString().slice(0,10)} max={new Date(Date.now() + 365 * 86400000).toISOString().slice(0,10)} />
              </label>
              <label className="field" style={{marginBottom:18}}>
                <span className="label">Notes (optional)</span>
                <textarea className="textarea" rows={3} value={bookForm.notes} onChange={e => setBookForm(f => ({...f, notes: e.target.value}))} placeholder="Anything we should know before the appointment." />
              </label>
              {portalUser === null && InlineAuthGate && (
                <InlineAuthGate title="Sign in to book" onAuthenticated={user => { onPortalUserChange?.(user); setBookError(null); }} />
              )}
              {portalUser && planEligible && (
                <div style={{marginBottom:14}}>
                  <div className="tabs" style={{marginBottom:12}}>
                    <div role="button" tabIndex={0} className={`tab ${checkoutMode === 'full' ? 'active' : ''}`} onClick={() => setCheckoutMode('full')}>Pay in full</div>
                    <div role="button" tabIndex={0} className={`tab ${checkoutMode === 'plan' ? 'active' : ''}`} onClick={() => setCheckoutMode('plan')}>Split into instalments</div>
                  </div>
                  {checkoutMode === 'plan' && (
                    <div style={{display:'grid', gap:8}}>
                      <div style={{display:'flex', gap:8}}>
                        <label className="field" style={{margin:0, flex:1}}><span className="label">Instalment ($)</span>
                          <input className="input" type="number" min="0" step="0.01" value={planInstallmentAmount} onChange={e => setPlanInstallmentAmount(e.target.value)} style={{fontSize:13}} /></label>
                        <label className="field" style={{margin:0, flex:1}}><span className="label">Frequency</span>
                          <select className="select" value={planFrequency} onChange={e => setPlanFrequency(e.target.value)} style={{fontSize:13}}>
                            <option value="weekly">Weekly</option>
                            <option value="fortnightly">Fortnightly</option>
                            <option value="monthly">Monthly</option>
                          </select>
                        </label>
                      </div>
                      <label className="field" style={{margin:0}}><span className="label">How you'll pay each instalment</span>
                        <select className="select" value={planCollectionMethod} onChange={e => setPlanCollectionMethod(e.target.value)} style={{fontSize:13}}>
                          <option value="manual">Outback Electronics will contact me to collect it</option>
                          <option value="customer">I'll pay each one myself in the portal</option>
                        </select>
                      </label>
                    </div>
                  )}
                </div>
              )}
              <ErrorText style={{marginBottom:12}}>{bookError}</ErrorText>
              <div style={{display:'flex', gap:12, alignItems:'center'}}>
                <button type="submit" className="btn btn-rust" style={{flex:1, justifyContent:'center', gap:8}} disabled={booking || outOfRange || !portalUser} aria-busy={booking}>
                  {booking ? <><span className="spinner" aria-hidden="true" /> Redirecting…</> : checkoutMode === 'plan'
                    ? `Set Up Payment Plan - $${fixedPrice.toLocaleString('en-AU', {minimumFractionDigits:2})} total →`
                    : travelFee > 0
                    ? `Pay now - $${(fixedPrice + travelFee).toLocaleString('en-AU', {minimumFractionDigits:2})} (incl. travel) →`
                    : `Pay now - $${fixedPrice.toLocaleString('en-AU', {minimumFractionDigits:2})} →`}
                </button>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => go('quote', service)}>Request a quote instead</button>
              </div>
            </form>
          ) : (
            <div style={{display:'flex', gap:12}}>
              <button className="btn btn-rust" style={{flex:1, justifyContent:'center'}} onClick={() => go('quote', service)}>Book this Service →</button>
              <button className="btn btn-ghost" onClick={() => go('contact')}>Ask a Question</button>
            </div>
          )}
        </div>
      </section>
    </>
  );
}

// ============================================================
// GIFT CARDS
// ============================================================
function GiftCardsPage({ go, addToCart }) {
  const [denominations, setDenominations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [balanceCode, setBalanceCode] = useState('');
  const [balanceEmail, setBalanceEmail] = useState('');
  const [balanceResult, setBalanceResult] = useState(null);
  const [balanceError, setBalanceError] = useState(null);
  const [balanceLoading, setBalanceLoading] = useState(false);

  useEffect(() => {
    fetch('/api/shop/gift-card-denominations')
      .then(r => r.json())
      .then(d => setDenominations(d.items || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const checkBalance = async () => {
    const code = balanceCode.trim().toUpperCase();
    const email = balanceEmail.trim().toLowerCase();
    if (!code || !email) return;
    setBalanceLoading(true);
    setBalanceResult(null);
    setBalanceError(null);
    try {
      const resp = await fetch(`/api/gift-card/balance?code=${encodeURIComponent(code)}&email=${encodeURIComponent(email)}`);
      const data = await resp.json();
      if (resp.ok) setBalanceResult(data);
      else if (data.error === 'missing_email') setBalanceError('Please enter the email address the gift card was sent to.');
      else setBalanceError(data.error === 'not_found' ? 'Gift card not found or email address does not match.' : 'Could not look up this code.');
    } catch {
      setBalanceError('Could not connect. Please try again.');
    } finally {
      setBalanceLoading(false);
    }
  };

  return (
    <>
      <PageHead crumbs={['Outback', 'Gift Cards']} title="Gift Cards"
        lead="The perfect gift for the remote-area tinkerer in your life. Redeemable on products and services. Sent by email instantly." />
      <section className="container" style={{paddingTop:40, paddingBottom:56}}>
        {loading ? (
          <div className="grid-4" style={{gap:24, marginBottom:24}}>
            {Array.from({length:3}).map((_,i) => (
              <div key={i} style={{background:'var(--bg-elev)', borderRadius:4, height:260, animation:'pulse 1.4s ease-in-out infinite', opacity: 0.6 + (i % 2) * 0.2}} />
            ))}
          </div>
        ) : denominations.length === 0 ? (
          <div style={{textAlign:'center', padding:'48px 0', color:'var(--ink-2)', fontSize:14, lineHeight:1.7}}>
            <div style={{fontSize:18, fontWeight:600, color:'var(--ink)', marginBottom:8}}>No gift cards available right now</div>
            <p style={{maxWidth:400, margin:'0 auto'}}>Check back soon, or <button style={{background:'none',border:'none',padding:0,color:'var(--rust)',cursor:'pointer',textDecoration:'underline',fontSize:'inherit'}} onClick={() => go('contact')}>contact us</button> if you'd like to purchase a custom amount.</p>
          </div>
        ) : (
          <div className="grid-4" style={{gap:24, marginBottom:24}}>
            {denominations.map((denom, i) => (
              <div key={denom.id || i} className="card-paper" style={{padding:28, display:'flex', flexDirection:'column', gap:16}}>
                <div style={{position:'relative', textAlign:'center', background:'var(--bg-elev)', border:'1px solid var(--line)', overflow:'hidden'}}>
                  {denom.imageUrl
                    ? <img src={thumbUrl(denom.imageUrl, 600)} srcSet={thumbSrcSet(denom.imageUrl, [300, 450, 600])} sizes="(max-width: 600px) 100vw, 400px" alt={denom.name} width="600" height="180" style={{width:'100%', height:180, objectFit:'cover', display:'block'}} />
                    : <div style={{padding:'32px 0'}}>
                        <div className="serif" style={{fontSize:52, color:'var(--rust)', lineHeight:1}}>${Number(denom.priceAud).toFixed(0)}</div>
                        <div className="eyebrow" style={{marginTop:6}}>GIFT CARD</div>
                      </div>
                  }
                </div>
                <div>
                  <div style={{fontWeight:600, marginBottom:4}}>{denom.name}</div>
                  <p style={{fontSize:13, color:'var(--ink-2)', lineHeight:1.6}}>{denom.description || 'Redeemable on anything in the Outback Electronics online store. Delivered by email. Never expires.'}</p>
                </div>
                <div style={{marginTop:'auto', display:'grid', gap:8}}>
                  <button className="btn btn-rust" style={{justifyContent:'center'}} onClick={() => addToCart({ id: 'gc-' + denom.id, name: denom.name, price: denom.priceAud, type: 'gift-card' })}>
                    Add to Cart - ${Number(denom.priceAud).toFixed(2)}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="card-paper" style={{marginTop:40, padding:32, display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:24}}>
          {[
            {icon:'✉', t:'Delivered by email', d:'Your gift card code arrives by email within minutes of purchase.'},
            {icon:'∞', t:'Never expires', d:'No use-by dates. Spend it whenever the right gear comes along.'},
            {icon:'★', t:'Redeemable on everything', d:'Products, services, repairs - anything we sell online.'},
          ].map((f,i) => (
            <div key={i} style={{textAlign:'center'}}>
              <div style={{fontSize:32, marginBottom:10}}>{f.icon}</div>
              <div style={{fontWeight:600, marginBottom:6}}>{f.t}</div>
              <p style={{fontSize:13, color:'var(--ink-2)', lineHeight:1.6}}>{f.d}</p>
            </div>
          ))}
        </div>

        <div className="card-paper" style={{marginTop:32, padding:32, maxWidth:480}}>
          <div className="eyebrow" style={{marginBottom:12}}>CHECK YOUR BALANCE</div>
          <div style={{display:'flex', flexDirection:'column', gap:8}}>
            <input
              className="input"
              placeholder="OBE-XXXX-XXXX-XXXX"
              value={balanceCode}
              onChange={e => { setBalanceCode(e.target.value.toUpperCase()); setBalanceResult(null); setBalanceError(null); }}
              onKeyDown={e => e.key === 'Enter' && checkBalance()}
              style={{fontFamily:'monospace', letterSpacing:'.05em', fontSize:13}}
            />
            <div style={{display:'flex', gap:8}}>
              <input
                className="input"
                type="email"
                placeholder="Email the card was sent to"
                value={balanceEmail}
                onChange={e => { setBalanceEmail(e.target.value); setBalanceResult(null); setBalanceError(null); }}
                onKeyDown={e => e.key === 'Enter' && checkBalance()}
                style={{flex:1, fontSize:13}}
              />
              <button className="btn btn-ghost btn-sm" onClick={checkBalance} disabled={balanceLoading || !balanceCode.trim() || !balanceEmail.trim()}>
                {balanceLoading ? '…' : 'Check'}
              </button>
            </div>
          </div>
          <ErrorText inline style={{marginTop:10, fontSize:13}}>{balanceError}</ErrorText>
          {balanceResult && (
            <div style={{marginTop:12, padding:'12px 16px', background: balanceResult.isVoid ? '#fff7ed' : '#f0fdf4', border:`1px solid ${balanceResult.isVoid ? '#fed7aa' : '#86efac'}`, fontSize:14}}>
              {balanceResult.isVoid
                ? <span style={{color:'#92400e'}}>This gift card has been voided.</span>
                : <>
                    <span style={{fontWeight:600, color:'#15803d'}}>
                      ${Number(balanceResult.balance).toLocaleString('en-AU', {minimumFractionDigits:2})} remaining
                    </span>
                    {balanceResult.balance < balanceResult.originalBalance && (
                      <span style={{marginLeft:8, fontSize:12, color:'var(--ink-3)'}}>
                        of ${Number(balanceResult.originalBalance).toLocaleString('en-AU', {minimumFractionDigits:2})} original
                      </span>
                    )}
                  </>
              }
            </div>
          )}
        </div>
      </section>
    </>
  );
}

// ============================================================
// MEMBERSHIPS
// ============================================================
function MembershipsPage({ go, portalUser }) {
  const shop = useShop();
  const [tiers, setTiers] = useState([]);
  const [tiersLoading, setTiersLoading] = useState(true);
  const [checkingOut, setCheckingOut] = useState(null); // tier id currently processing
  const [checkoutError, setCheckoutError] = useState(null);
  const [activeTier, setActiveTier] = useState(null); // active membership tier for logged-in user

  useEffect(() => {
    fetch('/api/memberships')
      .then(r => r.json())
      .then(d => setTiers(d.items || []))
      .catch(() => {})
      .finally(() => setTiersLoading(false));
  }, []);

  useEffect(() => {
    if (!portalUser) return;
    fetch('/api/portal/membership', { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d && d.tier) setActiveTier(d.tier); })
      .catch(() => {});
  }, [portalUser]);

  const displayTiers = tiers;

  const portalUrl = shop._portalUrl || 'https://portal.outbackelectronics.com.au';

  const startCheckout = async (tier) => {
    setCheckoutError(null);
    setCheckingOut(tier.id);
    try {
      const priceAud = Number(tier.priceAud || tier.price);
      await fetch('/api/csrf-token', { credentials: 'include' }).catch(() => {});
      const resp = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': getCsrf() },
        body: JSON.stringify({ items: [{ productId: tier.id, name: tier.name, priceAud, quantity: 1 }] }),
      });
      let data;
      try { data = await resp.json(); } catch { data = {}; }
      if (data.url) {
        window.location.href = data.url;
      } else {
        setCheckoutError(data.message || 'Could not start checkout. Please try again.');
      }
    } catch {
      setCheckoutError('Could not connect to payment provider. Please try again.');
    } finally {
      setCheckingOut(null);
    }
  };

  return (
    <>
      <PageHead crumbs={['Outback', 'Memberships']} title="Memberships"
        lead="Get access to member-only groups, exclusive content, and workshop perks. Cancel any time." />
      <section className="container" style={{paddingTop:40, paddingBottom:56}}>
        <ErrorText style={{marginBottom:20}}>{checkoutError}</ErrorText>

        {tiersLoading ? (
          <div style={{textAlign:'center', padding:'64px 0', color:'var(--ink-2)', fontSize:13}}>Loading…</div>
        ) : displayTiers.length === 0 ? (
          <div style={{textAlign:'center', padding:'64px 0', color:'var(--ink-2)', fontSize:14, lineHeight:1.7}}>
            <div style={{fontSize:18, fontWeight:600, color:'var(--ink)', marginBottom:8}}>No membership tiers available right now</div>
            <p style={{maxWidth:400, margin:'0 auto'}}>Check back soon, or <button style={{background:'none',border:'none',padding:0,color:'var(--rust)',cursor:'pointer',textDecoration:'underline',fontSize:'inherit'}} onClick={() => go('contact')}>contact us</button> with any questions.</p>
          </div>
        ) : null}

        <div className="membership-tiers">
          {displayTiers.map((tier, i) => {
            const displayPrice = Number(tier.priceAud || tier.price);
            const isProcessing = checkingOut === tier.id;
            const billingLabel = tier.billingCycle === 'month' ? '/month' : tier.billingCycle === 'year' ? '/year' : 'one-off';
            return (
              <div key={tier.id || i}
                style={{padding:32, background: tier.highlight ? 'var(--dark)' : 'var(--paper)', color: tier.highlight ? 'var(--paper)' : 'var(--ink)', border:'1px solid', borderColor: tier.highlight ? 'var(--dark)' : 'var(--line)', display:'flex', flexDirection:'column', gap:16, position:'relative'}}>
                {tier.highlight && <span className="tag tag-ochre" style={{alignSelf:'flex-start'}}>MOST POPULAR</span>}
                <div>
                  <span className={`tag ${tier.color || 'tag-outline'}`} style={{marginBottom:12, display:'inline-block'}}>{tier.name.toUpperCase()}</span>
                  <div style={{display:'flex', alignItems:'baseline', gap:6}}>
                    <span className="serif" style={{fontSize:52, lineHeight:1, color: tier.highlight ? 'var(--paper)' : 'var(--rust)'}}>${displayPrice}</span>
                    <span style={{fontSize:13, color: tier.highlight ? 'var(--bg-deep)' : 'var(--ink-2)'}}>{billingLabel}</span>
                  </div>
                </div>
                <p style={{fontSize:14, color: tier.highlight ? 'var(--bg-deep)' : 'var(--ink-2)', lineHeight:1.6}}>{tier.description}</p>
                <ul className="checks" style={{fontSize:14, flex:1}}>
                  {(tier.features || []).map((f, j) => (
                    <li key={j} style={{color: tier.highlight ? 'var(--paper)' : 'var(--ink)'}}>{f}</li>
                  ))}
                </ul>

                {portalUser === null ? (
                  <div style={{display:'grid', gap:8, marginTop:8}}>
                    <a href={`${portalUrl}/?tab=register`}
                      style={{display:'flex', alignItems:'center', justifyContent:'center', padding:'10px 16px', background:'var(--rust)', border:'1px solid var(--rust)', color:'var(--paper)', fontWeight:600, fontSize:13, textDecoration:'none', letterSpacing:'0.02em'}}>
                      Create account &amp; subscribe →
                    </a>
                    <a href={`${portalUrl}/?tab=login&redirect=memberships`}
                      style={{display:'flex', alignItems:'center', justifyContent:'center', padding:'8px 16px', background:'transparent', border:'1px solid var(--line)', color: tier.highlight ? 'var(--paper)' : 'var(--ink)', fontSize:12, textDecoration:'none', letterSpacing:'0.02em'}}>
                      Already a member? Sign in
                    </a>
                  </div>
                ) : (
                  <button className="btn btn-rust" style={{width:'100%', justifyContent:'center', marginTop:8}}
                    disabled={isProcessing}
                    onClick={() => startCheckout(tier)}>
                    {isProcessing ? 'Redirecting to checkout…' : `Join - $${displayPrice} →`}
                  </button>
                )}

                <div className="mono" style={{fontSize:10, color: tier.highlight ? 'rgba(244,237,225,0.5)' : 'var(--ink-3)', textAlign:'center'}}>
                  ONE-OFF PAYMENT · SECURE CHECKOUT VIA STRIPE
                </div>
              </div>
            );
          })}
        </div>

        {activeTier && Number(activeTier.discountPercent) > 0 && (
          <div style={{marginTop:24, padding:'12px 18px', background:'#f0faf4', border:'1px solid #86efac', fontSize:13, color:'#166534', display:'flex', alignItems:'center', gap:8}}>
            <span style={{fontWeight:700}}>✓</span>
            Your {Number(activeTier.discountPercent)}% member discount is applied automatically at checkout.
          </div>
        )}

        <div style={{marginTop:48, padding:32, background:'var(--bg-elev)', border:'1px solid var(--line)'}}>
          <div className="eyebrow" style={{marginBottom:12}}>MEMBER CONTENT INCLUDES</div>
          <div style={{display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:24}}>
            {[
              {t:'Member Groups', d:'Private forum groups where members swap configs, ask dumb questions safely, and organise local meetups.'},
              {t:'Members Blog', d:'Deep-dive build logs, tear-downs, field reports, and "how we fixed it" write-ups from our techs.'},
              {t:'Special Content', d:'Early firmware drops, beta tutorials, invite-only webinars, and the occasional ridiculous benchmark.'},
            ].map((item,i) => (
              <div key={i}>
                <div style={{fontWeight:600, marginBottom:6}}>{item.t}</div>
                <p style={{fontSize:13, color:'var(--ink-2)', lineHeight:1.6}}>{item.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}

// ---------------- Register ----------------
window.OE_PAGES = Object.assign(window.OE_PAGES || {}, {
  home: HomePage,
  shop: ShopPage,
  services: ServicesPage,
  software: SoftwarePage,
  ewaste: EwastePage,
  ai: AIPage,
  product: ProductDetailPage,
  service: ServiceDetailPage,
  'gift-cards': GiftCardsPage,
  memberships: MembershipsPage,
});
window.ProductCard = ProductCard;
