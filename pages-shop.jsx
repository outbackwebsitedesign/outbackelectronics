import React, { useState, useEffect, useMemo, useContext } from 'react';

const _fallbackShopCtx = React.createContext({});
const useShop = () => useContext(window.__ShopContext__ || _fallbackShopCtx);

function thumbUrl(src, w) {
  if (!src || !src.startsWith('/assets/uploads/')) return src;
  return `/api/thumb?src=${encodeURIComponent(src)}&w=${w}`;
}

function getCsrf() {
  return document.cookie.split(';').reduce((v, c) => {
    const [k, val] = c.trim().split('=');
    return k === '_csrf' ? decodeURIComponent(val || '') : v;
  }, '');
}

// ============================================================
// HOME
// ============================================================
function HomePage({ go, addToCart, portalUser }) {
  const shop = useShop();
  const [featuredProducts, setFeaturedProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [metrics, setMetrics] = useState({ repairCount: null, ewasteTonnes: null, forumMembers: null });
  const [testimonial, setTestimonial] = useState(null);
  const heroProduct = useMemo(() => featuredProducts.find(p => p.infiniteStock || p.stock > 0) || featuredProducts[0] || null, [featuredProducts]);
  const [recentThreads, setRecentThreads] = useState([]);
  const [aiData, setAiData] = useState(null);
  const [repairServices, setRepairServices] = useState([]);
  const [siteContent, setSiteContent] = useState({});
  const [loading, setLoading] = useState(true);
  const skuCounts = useMemo(() => {
    const counts = {};
    for (const p of featuredProducts) { counts[p.category] = (counts[p.category] || 0) + 1; }
    return counts;
  }, [featuredProducts]);
  useEffect(() => {
    Promise.allSettled([
      fetch('/api/catalog/products').then(r => r.json()).then(d => setFeaturedProducts(d.items || [])).catch(() => setFeaturedProducts(window.CATALOG_DATA?.getPublicProducts?.() || [])),
      fetch('/api/catalog/filters').then(r => r.ok ? r.json() : Promise.reject()).then(d => setCategories(d.categories || [])).catch(() => {}),
      fetch('/api/metrics').then(r => r.json()).then(d => setMetrics(d)).catch(() => {}),
      fetch('/api/testimonial').then(r => r.ok ? r.json() : Promise.reject()).then(d => setTestimonial(d.testimonial)).catch(() => {}),
      fetch('/api/forum/recent').then(r => r.ok ? r.json() : Promise.reject()).then(d => setRecentThreads(d.threads || [])).catch(() => {}),
      fetch('/api/ai').then(r => r.ok ? r.json() : Promise.reject()).then(d => setAiData(d)).catch(() => {}),
      fetch('/api/catalog/services').then(r => r.ok ? r.json() : Promise.reject()).then(d => setRepairServices(d.items || [])).catch(() => {}),
      fetch('/api/settings').then(r => r.ok ? r.json() : Promise.reject()).then(d => setSiteContent(d.siteContent || {})).catch(() => {}),
    ]).finally(() => { setLoading(false); setTimeout(() => window.observeReveal && window.observeReveal(), 80); });
  }, []);
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
                Rugged laptops, satellite uplinks, off-grid power, repair benches and an obstinate community of tinkerers — serving remote Australia{shop.address ? ` from ${shop.address}` : ''} by appointment only.
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
                  <a href="https://portal.outbackelectronics.com.au/?tab=register" style={{fontSize:13, color:'var(--rust)', fontWeight:600, textDecoration:'none'}}>Create a free account</a>
                  <span style={{fontSize:13, color:'var(--ink-3)'}}>·</span>
                  <a href="https://portal.outbackelectronics.com.au/?tab=login" style={{fontSize:13, color:'var(--ink-2)', textDecoration:'none'}}>Sign in</a>
                </div>
              )}
              <div className="row-flex hero-stats" style={{marginTop: 36, gap: 32, borderTop:'1px solid var(--line)', paddingTop: 22}}>
                <div><div className="serif" style={{fontSize:32, color:'var(--rust)'}}>{metrics.repairCount !== null ? metrics.repairCount.toLocaleString() : '—'}</div><div className="eyebrow">REPAIRS LOGGED</div></div>
                <div><div className="serif" style={{fontSize:32, color:'var(--rust)'}}>{metrics.ewasteTonnes !== null ? metrics.ewasteTonnes.toFixed(1) + 't' : '—'}</div><div className="eyebrow">E-WASTE DIVERTED</div></div>
                <div><div className="serif" style={{fontSize:32, color:'var(--rust)'}}>{metrics.forumMembers !== null ? metrics.forumMembers.toLocaleString() : '—'}</div><div className="eyebrow">FORUM MEMBERS</div></div>
              </div>
            </div>
            <div className="hero-image" style={{position:'relative'}}>
              {heroProduct && heroProduct.images && heroProduct.images.length > 0
                ? <img src={thumbUrl(heroProduct.images[0], 800)} alt={heroProduct.name} fetchpriority="high" style={{width:'100%', aspectRatio:'4/5', objectFit:'cover', display:'block'}} />
                : <div className="slot slot-rust" style={{aspectRatio: '4/5'}}>RUGGED LAPTOP ON RED-DIRT WORKBENCH</div>}
              {heroProduct && (
                <div className="card-paper" style={{position:'absolute', bottom:16, left:16, padding:18, width:240, boxShadow:'var(--shadow)'}}>
                  <div className="eyebrow">FIELD-TESTED</div>
                  <div className="serif" style={{fontSize:22, marginTop:6, lineHeight:1.1}}>{heroProduct.name}{heroProduct.cond ? ` // ${heroProduct.cond}` : ''}</div>
                  <div className="row-flex" style={{justifyContent:'space-between', marginTop:10}}>
                    <span className="price">${Number(heroProduct.price).toLocaleString('en-AU')}</span>
                    <span className={`tag ${(heroProduct.infiniteStock || heroProduct.stock > 0) ? 'tag-euc' : 'tag-outline'}`}>{(heroProduct.infiniteStock || heroProduct.stock > 0) ? 'IN STOCK' : 'OUT OF STOCK'}</span>
                  </div>
                </div>
              )}
              {testimonial && (
                <div className="card" style={{position:'absolute', top: -20, right: -16, padding:14, width:200}}>
                  <div className="mono" style={{fontSize:10, color:'var(--ink-2)', marginBottom:6}}>// CUSTOMER NOTE</div>
                  <p style={{fontFamily:'Instrument Serif, serif', fontSize: 18, lineHeight:1.25}}>
                    "{testimonial.quote}"
                  </p>
                  <div className="mono" style={{fontSize:10, marginTop:8}}>— {testimonial.name.toUpperCase()}{testimonial.loc ? ` · ${testimonial.loc.toUpperCase()}` : ''}</div>
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="scroll-indicator" aria-hidden="true">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6"/></svg>
        </div>
      </section>

      {/* Category strip */}
      <section className="container reveal" style={{paddingTop: 64, paddingBottom: 24}}>
        <div className="row-flex" style={{justifyContent:'space-between', marginBottom: 24, alignItems:'baseline'}}>
          <div>
            <span className="eyebrow">SECTIONS</span>
            <h2 className="serif" style={{fontSize: 42, marginTop:6}}>Shop by terrain.</h2>
          </div>
          <a className="mono" style={{fontSize:12, color:'var(--rust)', cursor:'pointer'}} onClick={() => go('shop')}>VIEW ALL CATEGORIES →</a>
        </div>
        <div className="grid-4">
          {(categories.length > 0 ? categories.slice(0, 4) : []).map((catName, i) => {
            const slotColors = ['slot-rust', 'slot', 'slot', 'slot-dark'];
            return (
              <div key={catName} className="product" onClick={() => go('shop', { initialCat: catName })}>
                <div className={`slot ${slotColors[i % slotColors.length]}`} style={{aspectRatio:'1/1'}}>{catName.toUpperCase()}</div>
                <div className="body">
                  <div className="name serif" style={{fontSize:22}}>{catName}</div>
                  <div className="row-px"><span className="mono" style={{fontSize:11, color:'var(--ink-3)'}}>{skuCounts[catName] != null ? `${skuCounts[catName]} SKUs` : ''}</span><span className="mono" style={{fontSize:11, color:'var(--rust)'}}>SHOP →</span></div>
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
                  <div className="serif" style={{fontSize:36, marginTop:4}}>{aiData.models?.length ?? '—'}</div>
                  <div style={{fontSize:12, color:'var(--bg-deep)', marginTop:2}}>
                    {aiData.models?.filter(m => m.status === 'Active').length ?? 0} active
                  </div>
                </div>
                <div style={{background:'#0e0c09', padding:'16px 20px'}}>
                  <div className="mono" style={{fontSize:11, color:'var(--ochre)', letterSpacing:'.08em'}}>FIELD BOXES</div>
                  <div className="serif" style={{fontSize:36, marginTop:4}}>{aiData.boxes?.length ?? '—'}</div>
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
          <a className="mono" style={{fontSize:12, color:'var(--rust)', cursor:'pointer'}} onClick={() => go('shop')}>ALL {featuredProducts.length || '—'} LISTINGS →</a>
        </div>
        <div className="grid-4">
          {featuredProducts.slice(0,4).map((p,i) => <ProductCard key={i} p={p} onClick={() => go('product', p)} />)}
        </div>
      </section>

      {/* Quote + Forum */}
      <section className="container reveal" style={{paddingTop: 64, paddingBottom: 16}}>
        <div className="grid-2">
          <div className="card-paper" style={{padding: 36}}>
            <span className="tag tag-rust">QUOTES IN 24h</span>
            <h3 className="serif" style={{fontSize:36, marginTop: 14, lineHeight:1.05}}>Got something weird that needs powering, fixing, or talking to a satellite?</h3>
            <p style={{marginTop: 12, color:'var(--ink-2)'}}>Tell us the use case in plain English. Our techs will spec it, price it, and ship it. No salespeople.</p>
            <button className="btn btn-rust" style={{marginTop: 18}} onClick={() => go('quote')}>Request a quote →</button>
          </div>
          <div style={{padding: 36, border:'1px solid var(--line)', background:'var(--bg-elev)'}}>
            <span className="eyebrow">FROM THE FORUM · LAST 24H</span>
            <ul style={{listStyle:'none', padding:0, margin:'14px 0 0', display:'grid', gap:10}}>
              {recentThreads.length === 0
                ? <li style={{color:'var(--ink-2)', fontSize:13}}>No recent threads.</li>
                : recentThreads.map((t,i)=>{
                  const threadUrl = t.id
                    ? `${shop._forumUrl || 'https://forum.outbackelectronics.com.au'}/thread/${t.id}`
                    : (shop._forumUrl || 'https://forum.outbackelectronics.com.au');
                  return (
                    <li key={t.id || i} style={{display:'flex', justifyContent:'space-between', padding:'10px 0', borderBottom:'1px solid var(--line)'}}>
                      <div>
                        <a href={threadUrl} target="_blank" rel="noopener noreferrer" style={{fontWeight:500, cursor:'pointer'}}>{t.title}</a>
                        <div className="mono" style={{fontSize:10, color:'var(--ink-2)', marginTop:3}}>{t.cat ? t.cat.toUpperCase() + ' · ' : ''}{t.replies} REPLIES</div>
                      </div>
                      <a href={threadUrl} target="_blank" rel="noopener noreferrer" className="mono" style={{fontSize:11, color:'var(--rust)', cursor:'pointer'}}>→</a>
                    </li>
                  );
                })}
            </ul>
          </div>
        </div>
      </section>
    </>
  );
}

// ============================================================
// SHOP
// ============================================================

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
    if (totalStock === 0) { displayTag = 'Out of stock'; displayTagClass = 'tag-outline'; }
    else if (totalStock <= 3) { displayTag = `${totalStock} left`; displayTagClass = 'tag-ochre'; }
    else { displayTag = 'In stock'; displayTagClass = 'tag-euc'; }
    displaySku = p.variants[0].sku;
  } else if (p.infiniteStock) {
    displayPrice = `$${p.price.toLocaleString()}`;
    displayTag = 'In stock';
    displayTagClass = 'tag-euc';
    displaySku = p.sku;
  } else {
    displayPrice = `$${p.price.toLocaleString()}`;
    displayTag = p.tag;
    displayTagClass = p.tagClass;
    displaySku = p.sku;
  }
  const thumb = p.images && p.images.length > 0 ? p.images[0] : null;
  return (
    <div className="product" onClick={onClick}>
      {thumb
        ? <img src={thumbUrl(thumb, 600)} alt={p.name} loading="lazy" style={{width:'100%', aspectRatio:'4/3', objectFit:'cover', display:'block'}} />
        : <div className="slot" style={{aspectRatio:'4/3'}}>{p.name.toUpperCase()}</div>}
      <div className="body">
        <div className="meta">{p.cond} · {displaySku}</div>
        <div className="name">{p.name}</div>
        <div className="row-px">
          <div>
            <span className="price">{displayPrice}</span>
            {!hasVariants && p.was && <span className="price-strike" style={{marginLeft:8}}>${p.was.toLocaleString()}</span>}
          </div>
          <span className={`tag ${displayTagClass}`}>{displayTag.toUpperCase()}</span>
        </div>
      </div>
    </div>
  );
}

function ShopPage({ go, addToCart, pageParams }) {
  const [cat, setCat] = useState(pageParams?.initialCat || 'All');
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterMeta, setFilterMeta] = useState({ categories: [], brands: [], conditions: [] });
  const [selectedBrands, setSelectedBrands] = useState([]);
  const [catalogError, setCatalogError] = useState(null);
  const [priceMin, setPriceMin] = useState('');
  const [priceMax, setPriceMax] = useState('');
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
  const [cond, setCond] = useState(pageParams?.initialCond || 'Any');
  const [sort, setSort] = useState('relevance');
  const [visibleCount, setVisibleCount] = useState(12);
  const chunkSize = 12;
  const filtered = useMemo(() => {
    let f = [...products];
    if (cat !== 'All') f = f.filter(p => p.category === cat);
    if (cond !== 'Any') f = f.filter(p => p.cond === cond);
    if (selectedBrands.length > 0) f = f.filter(p => selectedBrands.includes(p.brand));
    const min = parseFloat(priceMin);
    const max = parseFloat(priceMax);
    const effectivePrice = p => {
      if (p.price != null) return p.price;
      if (p.variants && p.variants.length > 0) return Math.min(...p.variants.map(v => v.price));
      return null;
    };
    if (!isNaN(min)) f = f.filter(p => { const ep = effectivePrice(p); return ep != null && ep >= min; });
    if (!isNaN(max)) f = f.filter(p => { const ep = effectivePrice(p); return ep != null && ep <= max; });
    if (sort === 'price-asc') f.sort((a,b) => a.price-b.price);
    if (sort === 'price-desc') f.sort((a,b) => b.price-a.price);
    return f;
  }, [products, cat, cond, selectedBrands, priceMin, priceMax, sort]);

  const totalResults = filtered.length;
  const visible = filtered.slice(0, visibleCount);

  useEffect(() => { setVisibleCount(chunkSize); }, [cat, cond, sort, priceMin, priceMax, products.length]);
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
      <div className="container" style={{paddingTop: 32, paddingBottom: 32, display:'grid', gridTemplateColumns:'240px 1fr', gap: 36}}>
        <aside>
          {(cat !== 'All' || cond !== 'Any' || selectedBrands.length > 0 || priceMin !== '' || priceMax !== '') && (
            <div style={{marginBottom:16, display:'flex', justifyContent:'space-between', alignItems:'center'}}>
              <span className="mono" style={{fontSize:10, color:'var(--rust)'}}>FILTERS ACTIVE</span>
              <button className="btn btn-sm btn-ghost" style={{fontSize:10, padding:'4px 8px'}} onClick={() => { setCat('All'); setCond('Any'); setSelectedBrands([]); setPriceMin(''); setPriceMax(''); }}>
                Clear all ×
              </button>
            </div>
          )}
          <div className="eyebrow" style={{marginBottom: 10}}>CATEGORY</div>
          <div className="stack" style={{gap:4}}>
            {['All', ...filterMeta.categories].map(c => (
              <button key={c} onClick={() => setCat(c)} style={{padding:'6px 8px', cursor:'pointer', fontSize:14, color: cat===c ? 'var(--rust)' : 'var(--ink)', fontWeight: cat===c ? 600 : 400, background:'none', border:'none', borderLeft: cat===c ? '2px solid var(--rust)':'2px solid transparent', textAlign:'left', width:'100%'}}>{c}</button>
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
            <input className="input" placeholder="$ min" style={{padding:'8px 10px'}} type="number" min="0" value={priceMin} onChange={e => setPriceMin(e.target.value)} />
            <input className="input" placeholder="$ max" style={{padding:'8px 10px'}} type="number" min="0" value={priceMax} onChange={e => setPriceMax(e.target.value)} />
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
        </aside>

        <div>
          {catalogError && (
            <div role="alert" style={{background:'#fff3f3', border:'1px solid #f5a5a5', borderRadius:6, padding:'12px 16px', marginBottom:18, color:'#c0392b', fontSize:14}}>
              Unable to load products — {catalogError}. Please refresh the page or try again later.
            </div>
          )}
          <div className="row-flex" style={{justifyContent:'space-between', marginBottom: 18}}>
            <div className="mono" style={{fontSize:12, color:'var(--ink-2)'}}>SHOWING {visible.length} OF {totalResults} RESULTS · {cat.toUpperCase()}</div>
            <div className="row-flex" style={{gap:10}}>
              <select className="select" value={sort} onChange={e => setSort(e.target.value)} style={{padding:'6px 28px 6px 10px', fontSize:13}}>
                <option value="relevance">Sort: Relevance</option>
                <option value="price-asc">Price: low → high</option>
                <option value="price-desc">Price: high → low</option>
              </select>
            </div>
          </div>
          {loading ? (
            <div style={{display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:20}}>
              {Array.from({length:6}).map((_,i) => (
                <div key={i} style={{background:'var(--bg-elev)', borderRadius:4, height:260, animation:'pulse 1.4s ease-in-out infinite', opacity: 0.6 + (i % 2) * 0.2}} />
              ))}
            </div>
          ) : (
            <>
              <div className="grid-3" style={{gridTemplateColumns:'repeat(3, 1fr)', gap: 20}}>
                {visible.map((p, i) => (
                  <ProductCard key={p.id || i} p={p} onClick={() => go('product', p)} />
                ))}
              </div>
              {visible.length < totalResults && <div className="mono" style={{fontSize:12, color:'var(--ink-2)', marginTop:18, textAlign:'center'}}>Scroll for more…</div>}
            </>
          )}
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
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [visibleCount, setVisibleCount] = useState(6);
  const [siteContent, setSiteContent] = useState({});
  const chunkSize = 6;

  useEffect(() => {
    Promise.all([
      fetch('/api/catalog/services').then(r => r.json()).then(d => setServices(d.items || [])).catch(() => setServices(window.CATALOG_DATA?.getPublicServices?.() || [])),
      fetch('/api/settings').then(r => r.ok ? r.json() : Promise.reject()).then(d => setSiteContent(d.siteContent || {})).catch(() => {}),
    ]).finally(() => setLoading(false));
  }, []);

  const visible = services.slice(0, visibleCount);

  useEffect(() => { setVisibleCount(chunkSize); }, [services.length]);
  useEffect(() => {
    const onScroll = () => {
      const nearBottom = window.innerHeight + window.scrollY >= document.body.offsetHeight - 240;
      if (nearBottom) setVisibleCount(v => Math.min(services.length, v + chunkSize));
    };
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, [services.length]);

  return (
    <>
      <PageHead crumbs={['Outback','Services']} title="Services" lead={`${services.length} services · ${siteContent.workshopBlurb}`} />
      <section className="container" style={{paddingTop: 40, paddingBottom: 40}}>
        {loading ? (
          <div style={{display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:24}}>
            {Array.from({length:6}).map((_,i) => (
              <div key={i} style={{background:'var(--bg-elev)', borderRadius:4, height:220, animation:'pulse 1.4s ease-in-out infinite', opacity: 0.6 + (i % 2) * 0.2}} />
            ))}
          </div>
        ) : (
        <>
        <div className="mono" style={{fontSize:12, color:'var(--ink-2)', marginBottom:18}}>SHOWING {visible.length} OF {services.length} SERVICES</div>
        <div className="grid-3" style={{gap: 24}}>
          {visible.map((s,i) => (
            <div key={i} className="card-paper" style={{padding: 24}}>
              <div className="row-flex" style={{justifyContent:'space-between'}}>
                <span className="mono" style={{fontSize:11, color:'var(--rust)'}}>S/{(i+1).toString().padStart(2,'0')}</span>
                <span className="tag">TAT · {s.tat.toUpperCase()}</span>
              </div>
              <h3 className="serif" style={{fontSize: 28, marginTop: 14, lineHeight:1.1}}>{s.name}</h3>
              <p style={{marginTop: 10, color:'var(--ink-2)', fontSize:14}}>{s.description}</p>
              <div className="row-flex" style={{justifyContent:'space-between', marginTop: 18, borderTop:'1px solid var(--line)', paddingTop:14}}>
                <span className="price" style={{fontSize:20}}>{s.priceLine}</span>
                <button className="mono" style={{fontSize:11, color:'var(--rust)', cursor:'pointer', background:'none', border:'none', padding:0}} onClick={() => go('service', s)}>VIEW →</button>
              </div>
            </div>
          ))}
        </div>
        {visible.length < services.length && <div className="mono" style={{fontSize:12, color:'var(--ink-2)', marginTop:18, textAlign:'center'}}>Scroll for more…</div>}
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
            <div className="slot" style={{aspectRatio:'4/3'}}>WORKBENCH — DUST, FLUX, COPPER WIRE</div>
            <PublicJobLog />
          </div>
        </div>
      </section>
    </>
  );
}

// ============================================================
// SOFTWARE
// ============================================================
function SoftwarePage({ go }) {
  const [products, setProducts] = useState([]);
  useEffect(() => {
    fetch('/api/software').then(r => r.ok ? r.json() : Promise.reject()).then(d => setProducts(d.items || [])).catch(() => {});
  }, []);
  return (
    <>
      <PageHead crumbs={['Outback','Software']} title="Software"
        lead="Tools we wrote for ourselves, then cleaned up enough to share. Mostly open source, mostly Linux, all paid-back in pull requests." />
      <section className="container" style={{paddingTop: 40, paddingBottom: 32}}>
        <div className="grid-2" style={{gap: 24}}>
          {products.length === 0 && <div className="mono" style={{fontSize:13, color:'var(--ink-2)', gridColumn:'1/-1'}}>No software listed yet.</div>}
          {products.map((p,i) => (
            <div key={p.id||i} className="card-paper" style={{padding: 28, display:'grid', gridTemplateColumns:'1fr', gap:14}}>
              <div className="row-flex" style={{justifyContent:'space-between'}}>
                <span className={`tag ${(p.license||'').includes('OSS')?'tag-euc':'tag-rust'}`}>{p.license}</span>
                <span className="mono" style={{fontSize:11, color:'var(--ink-2)'}}>{p.stars}</span>
              </div>
              <h3 className="serif" style={{fontSize: 36, lineHeight:1}}>{p.name}</h3>
              {p.description && <p style={{color:'var(--ink-2)', fontSize:14}}>{p.description}</p>}
              <div className="row-flex" style={{justifyContent:'space-between', borderTop:'1px solid var(--line)', paddingTop: 14}}>
                <span className="price" style={{fontSize: 20}}>{p.price}</span>
                <div className="row-flex" style={{gap:8}}>
                  <button className="btn btn-sm" onClick={() => p.repo && window.open(p.repo, '_blank')} disabled={!p.repo} title={!p.repo ? 'No repository available' : undefined}>{(p.license||'').includes('OSS') ? 'Repo →' : 'Try free →'}</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

    </>
  );
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
    {n: metrics.ewasteTonnes !== null ? metrics.ewasteTonnes.toFixed(1) + 't' : '—', l:'DIVERTED · TOTAL', s:'From landfill into refurb, parts, or audited recyclers.'},
    {n: metrics.resalePercent !== null ? metrics.resalePercent + '%' : '—', l:'GEAR RESOLD OR DONATED', s:'Most of what comes in still has a working second life.'},
    {n:'$0', l:'TO DROP OFF', s:'Counter drop-off is always free, regardless of brand.'},
  ];
  return (
    <>
      <PageHead crumbs={['Outback','eWaste']} title="eWaste"
        lead="A take-back program for the bits no one else will touch. We sort, salvage, refurbish, or properly recycle — and pay you for what's worth saving." />
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
            <h2 className="serif" style={{fontSize: 44, marginTop: 8, lineHeight:1}}>If it has a battery, a board or a buzzing transformer — bring it.</h2>
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
              <div style={{fontSize:13, color:'var(--ink-2)'}}>≥ 50kg pallet of dead gear? We'll come grab it for free by appointment only — or freight pre-paid anywhere in Aus.</div>
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
  return (
    <div style={{position:'fixed', inset:0, zIndex:500, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(15,13,10,0.7)'}}
      onClick={onClose}>
      <div style={{width:'100%', maxWidth:560, background:'var(--bg)', border:'1px solid var(--line)', boxShadow:'0 12px 40px rgba(0,0,0,.35)', padding:32}}
        onClick={e => e.stopPropagation()}>
        <div className="row-flex" style={{justifyContent:'space-between', marginBottom:18}}>
          <div>
            <span className="tag tag-euc">OPEN WEIGHTS</span>
            <h2 className="mono" style={{fontSize:24, marginTop:8, color:'var(--rust)'}}>{model.name}</h2>
          </div>
          <button style={{background:'none', border:'none', cursor:'pointer', fontSize:22, color:'var(--ink-2)', lineHeight:1}} onClick={onClose}>×</button>
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
    desc: 'We wire AI into your existing systems — APIs, databases, workflows. If you have a process, we can find where intelligence fits.',
  },
  {
    tag: 'CONVERSATIONAL',
    title: 'Chatbots',
    desc: 'Purpose-built conversational agents for customer support, internal tooling, or guided workflows. Trained on your content, deployed on your terms.',
  },
  {
    tag: 'PROJECT-SPECIFIC',
    title: 'Project AI',
    desc: 'AI scoped to a single project — one problem, one solution, built to fit. No bloat, no generic model handed over with a PDF.',
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
        lead="Custom AI built to your problem — from production chatbots and integrations to subject-specific models and frontier research into artificial general intelligence." />

      <section className="container" style={{paddingTop: 40, paddingBottom: 16}}>
        <span className="eyebrow">WHAT WE BUILD</span>
        <h2 className="serif" style={{fontSize: 48, marginTop: 8, lineHeight: 1.1, maxWidth: 640}}>AI for real problems.<br/>Built to spec.</h2>
        <p style={{marginTop: 16, fontSize: 16, color: 'var(--ink-2)', maxWidth: 560}}>
          We don't sell a platform or lock you into a product. Every engagement starts with your problem and ends with something that solves it — whether that's a chatbot, a fine-tuned model, or a full integration into your stack.
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
              We are actively pursuing artificial general intelligence — not as a marketing claim, but as a research direction. This is hard, unsolved, and we say so plainly. If you want to follow the work or collaborate, get in touch.
            </p>
            <button className="btn btn-rust" style={{marginTop: 28}} onClick={() => go('contact')}>Get in touch →</button>
          </div>
          <div style={{padding: 40, background: 'var(--paper)', border: '1px solid var(--line)'}}>
            <span className="tag tag-euc" style={{marginBottom: 16, display: 'inline-block'}}>RESEARCH · HUMANLY AI</span>
            <h2 className="serif" style={{fontSize: 40, lineHeight: 1.1, marginTop: 12}}>Growing a mind from scratch.</h2>
            <p style={{marginTop: 16, fontSize: 15, color: 'var(--ink-2)', lineHeight: 1.7}}>
              Humanly AI is an attempt to grow a sandboxed digital cognitive organism from raw sensory experience — using developmental learning principles modeled after the human brain. No pretraining on human knowledge. No shortcuts. The goal is to see whether genuine cognition can emerge from the bottom up.
            </p>
            <button className="btn btn-ghost" style={{marginTop: 28}} onClick={() => go('humanly-ai')}>Follow the research →</button>
          </div>
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
            allow="autoplay"
          />
        </div>
      </section>
    </>
  );
}

// ============================================================
// PRODUCT DETAIL
// ============================================================
function ProductDetailPage({ go, addToCart, pageParams }) {
  const [product, setProduct] = useState(pageParams || null);
  const [selectedVariant, setSelectedVariant] = useState(null);
  const [activeImage, setActiveImage] = useState(null);
  const [notifyEmail, setNotifyEmail] = useState('');
  const [notifySent, setNotifySent] = useState(false);
  const [relatedProducts, setRelatedProducts] = useState([]);

  useEffect(() => {
    if (pageParams) {
      setProduct(pageParams);
      const firstVariant = pageParams.variants && pageParams.variants.length > 0 ? pageParams.variants[0] : null;
      setSelectedVariant(firstVariant);
      const firstImg = (firstVariant?.images?.length ? firstVariant.images[0] : null) || (pageParams.images?.[0] ?? null);
      setActiveImage(firstImg);
    }
  }, [pageParams]);

  useEffect(() => {
    if (!pageParams) return;
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
    if (v.images && v.images.length > 0) setActiveImage(v.images[0]);
  };

  if (!product) {
    return (
      <>
        <PageHead crumbs={['Outback', 'Shop', 'Product']} title="Product not found" lead="This product could not be loaded." />
        <section className="container" style={{paddingTop:32, paddingBottom:48}}>
          <button className="btn btn-ghost" onClick={() => go('shop')}>← Back to Shop</button>
        </section>
      </>
    );
  }

  const hasVariants = product.variants && product.variants.length > 0;
  const activePrice = selectedVariant ? selectedVariant.price : product.price;
  const inStock = product.infiniteStock
    ? true
    : hasVariants
      ? (selectedVariant ? (selectedVariant.stock || 0) > 0 : false)
      : (product.stock == null || product.stock > 0);

  return (
    <>
      <PageHead crumbs={['Outback', 'Shop', product.name]} title={product.name} />
      <section className="container" style={{paddingTop:32, paddingBottom:56}}>
        <button className="btn btn-ghost btn-sm" onClick={() => go('shop')} style={{marginBottom:24}}>← Back to Shop</button>
        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:48, alignItems:'start'}}>
          <div>
            {activeImage
              ? <img src={activeImage} alt={product.name} loading="lazy" style={{width:'100%', aspectRatio:'4/3', maxHeight:'70vh', objectFit:'contain', display:'block', background:'var(--bg-deep)'}} />
              : <div className="slot" style={{aspectRatio:'4/3', width:'100%'}}>{product.name.toUpperCase()}</div>}
            {product.images && product.images.length > 1 && (
              <div style={{display:'flex', gap:8, marginTop:10, flexWrap:'wrap'}}>
                {product.images.map((url, i) => (
                  <div key={i} onClick={() => setActiveImage(url)}
                    style={{width:64, height:64, cursor:'pointer', border: activeImage===url ? '2px solid var(--rust)' : '2px solid transparent', flexShrink:0}}>
                    <img src={thumbUrl(url, 128)} alt="" loading="lazy" width="64" height="64" style={{width:'100%', height:'100%', objectFit:'cover', display:'block'}} />
                  </div>
                ))}
              </div>
            )}
          </div>
          <div>
            <div className="row-flex" style={{gap:8, marginBottom:12, flexWrap:'wrap'}}>
              {product.brand && <span className="tag tag-outline">{product.brand}</span>}
              {product.cond && <span className="tag">{product.cond}</span>}
              {!hasVariants && product.tag && <span className={`tag ${product.tagClass || ''}`}>{product.tag.toUpperCase()}</span>}
            </div>
            <h2 className="serif" style={{fontSize:40, lineHeight:1.05, marginBottom:8}}>{product.name}</h2>
            <div className="mono" style={{fontSize:12, color:'var(--ink-3)', marginBottom:20}}>SKU: {product.sku || (hasVariants && selectedVariant ? selectedVariant.sku : '—')}</div>
            <div style={{display:'flex', alignItems:'baseline', gap:12, marginBottom:24}}>
              <span className="price" style={{fontSize:36}}>${activePrice ? activePrice.toLocaleString() : '—'}</span>
              {!hasVariants && product.was && <span className="price-strike" style={{fontSize:20}}>${product.was.toLocaleString()}</span>}
            </div>

            {hasVariants && (
              <div style={{marginBottom:24}}>
                <div className="eyebrow" style={{marginBottom:10}}>SELECT VARIANT</div>
                <div style={{display:'grid', gap:8}}>
                  {product.variants.map((v, i) => {
                    const isSelected = selectedVariant && selectedVariant.sku === v.sku;
                    const stockLabel = !v.stock || v.stock === 0 ? 'Out of stock' : v.stock <= 3 ? `${v.stock} left` : 'In stock';
                    return (
                      <div key={i} onClick={() => selectVariant(v)}
                        style={{display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 14px', cursor:'pointer', border:'1px solid var(--line)', borderLeft: isSelected ? '3px solid var(--rust)' : '1px solid var(--line)', background: isSelected ? 'var(--bg-elev)' : 'transparent'}}>
                        <span style={{fontWeight: isSelected ? 600 : 400}}>{v.name}</span>
                        <div style={{display:'flex', gap:14, alignItems:'center'}}>
                          <span className="mono" style={{fontSize:14}}>${v.price.toLocaleString()}</span>
                          <span className="mono" style={{fontSize:11, color:'var(--ink-2)'}}>{stockLabel}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {product.description && (
              <p style={{color:'var(--ink-2)', fontSize:15, lineHeight:1.7, marginBottom:24}}>{product.description}</p>
            )}

            <div style={{display:'flex', gap:12}}>
              <button className="btn btn-rust" style={{flex:1, justifyContent:'center'}}
                disabled={!inStock}
                onClick={() => { addToCart(hasVariants ? { ...product, ...selectedVariant, _variantSku: selectedVariant.sku || selectedVariant.name || '' } : product); }}>
                {inStock ? 'Add to Cart' : 'Out of Stock'}
              </button>
              <button className="btn btn-ghost" onClick={() => go('quote')}>Request a Quote</button>
            </div>
            {!inStock && (
              <div style={{marginTop:16, padding:'16px 18px', background:'var(--bg-elev)', border:'1px solid var(--line)'}}>
                {notifySent ? (
                  <div className="mono" style={{fontSize:12, color:'var(--eucalyptus)'}}>✓ We'll email you when this is back in stock.</div>
                ) : (
                  <>
                    <div className="eyebrow" style={{marginBottom:8}}>NOTIFY ME WHEN BACK IN STOCK</div>
                    <div style={{display:'flex', gap:8}}>
                      <input
                        className="input"
                        type="email"
                        placeholder="your@email.com"
                        value={notifyEmail}
                        onChange={e => setNotifyEmail(e.target.value)}
                        style={{flex:1, fontSize:13}}
                      />
                      <button className="btn btn-ghost btn-sm"
                        disabled={!notifyEmail.trim()}
                        onClick={() => { if (notifyEmail.trim()) setNotifySent(true); }}>
                        Notify me
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </section>
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

function ServiceDetailPage({ go, pageParams }) {
  const [service, setService] = useState(pageParams || null);
  const [bookForm, setBookForm] = useState({ name: '', email: '', loc: '', date: '', notes: '' });
  const [booking, setBooking] = useState(false);
  const [bookError, setBookError] = useState(null);
  const [distanceKm, setDistanceKm] = useState(null); // null = not checked yet
  const [geocoding, setGeocoding] = useState(false);

  useEffect(() => {
    if (pageParams) { setService(pageParams); setBookForm({ name: '', email: '', loc: '', date: '', notes: '' }); setBookError(null); setDistanceKm(null); }
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

  const handlePayAndBook = async (e) => {
    e.preventDefault();
    setBookError(null);
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
      const resp = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
        body: JSON.stringify({
          items: [{ productId: service.id, name: service.name, priceAud: fixedPrice, quantity: 1 }],
          travelDistanceKm: distanceKm || 0,
        }),
      });
      const data = await resp.json().catch(() => ({}));
      if (data.url) {
        window.location.href = data.url;
      } else {
        setBookError(data.message || 'Could not start checkout — please try again or call us.');
      }
    } catch {
      setBookError('Could not connect to payment provider. Please try again.');
    } finally {
      setBooking(false);
    }
  };

  if (!service) {
    return (
      <>
        <PageHead crumbs={['Outback', 'Services', 'Service']} title="Service not found" lead="This service could not be loaded." />
        <section className="container" style={{paddingTop:32, paddingBottom:48}}>
          <button className="btn btn-ghost" onClick={() => go('services')}>← Back to Services</button>
        </section>
      </>
    );
  }

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
            <p style={{color:'var(--ink-2)', fontSize:15, lineHeight:1.7, marginBottom:24}}>{service.description}</p>
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
              <span className="eyebrow" style={{marginBottom:12, display:'block'}}>BOOK &amp; PAY — {service.priceLine}</span>
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
                    <>That's {distanceKm}km — on-site bookings for this service are capped at {CALLOUT_LOCAL_CAP_KM}km. <span style={{color:'var(--rust)', fontWeight:600}}>Post your device to us</span> or <a style={{color:'var(--rust)', cursor:'pointer', textDecoration:'underline'}} onClick={() => go('quote', service)}>request a quote</a> for a discussion.</>
                  ) : distanceKm <= CALLOUT_FREE_KM ? (
                    <><span style={{color:'var(--rust)', fontWeight:600}}>✓ Free callout</span> — you're {distanceKm}km away.</>
                  ) : (
                    <><span style={{fontWeight:600}}>+${travelFee} travel fee</span> — {calloutFeeBreakdown(distanceKm)}. Added to your total.</>
                  )}
                </div>
              )}
              <label className="field" style={{marginBottom:14}}>
                <span className="label">Preferred date (optional)</span>
                <input className="input" type="date" value={bookForm.date} onChange={e => setBookForm(f => ({...f, date: e.target.value}))} min={new Date().toISOString().slice(0,10)} />
              </label>
              <label className="field" style={{marginBottom:18}}>
                <span className="label">Notes (optional)</span>
                <textarea className="textarea" rows={3} value={bookForm.notes} onChange={e => setBookForm(f => ({...f, notes: e.target.value}))} placeholder="Anything we should know before the appointment." />
              </label>
              {bookError && <div style={{color:'var(--rust)', fontSize:13, marginBottom:12}}>{bookError}</div>}
              <div style={{display:'flex', gap:12, alignItems:'center'}}>
                <button type="submit" className="btn btn-rust" style={{flex:1, justifyContent:'center'}} disabled={booking || outOfRange}>
                  {booking ? 'Redirecting…' : travelFee > 0
                    ? `Pay now — $${(fixedPrice + travelFee).toLocaleString('en-AU', {minimumFractionDigits:2})} (incl. travel) →`
                    : `Pay now — $${fixedPrice.toLocaleString('en-AU', {minimumFractionDigits:2})} →`}
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
          <div style={{marginBottom:24, fontSize:14, color:'var(--ink-2)'}}>Gift cards coming soon — check back shortly.</div>
        ) : (
          <div className="grid-4" style={{gap:24, marginBottom:24}}>
            {denominations.map((denom, i) => (
              <div key={denom.id || i} className="card-paper" style={{padding:28, display:'flex', flexDirection:'column', gap:16}}>
                <div style={{position:'relative', textAlign:'center', background:'var(--bg-elev)', border:'1px solid var(--line)', overflow:'hidden'}}>
                  {denom.imageUrl
                    ? <img src={denom.imageUrl} alt={denom.name} width="600" height="180" style={{width:'100%', height:180, objectFit:'cover', display:'block'}} />
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
                    Add to Cart — ${Number(denom.priceAud).toFixed(2)}
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
            {icon:'★', t:'Redeemable on everything', d:'Products, services, repairs — anything we sell online.'},
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
          {balanceError && <p style={{marginTop:10, fontSize:13, color:'#b91c1c'}}>{balanceError}</p>}
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
        {checkoutError && (
          <div style={{marginBottom:20, padding:'12px 16px', background:'#fff1f0', border:'1px solid #fca5a5', fontSize:13, color:'#b91c1c'}}>
            {checkoutError}
          </div>
        )}

        <div style={{display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:24}}>
          {displayTiers.map((tier, i) => {
            const displayPrice = Number(tier.priceAud || tier.price);
            const isProcessing = checkingOut === tier.id;
            return (
              <div key={tier.id || i}
                style={{padding:32, background: tier.highlight ? 'var(--dark)' : 'var(--paper)', color: tier.highlight ? 'var(--paper)' : 'var(--ink)', border:'1px solid', borderColor: tier.highlight ? 'var(--dark)' : 'var(--line)', display:'flex', flexDirection:'column', gap:16, position:'relative'}}>
                {tier.highlight && <span className="tag tag-ochre" style={{alignSelf:'flex-start'}}>MOST POPULAR</span>}
                <div>
                  <span className={`tag ${tier.color || 'tag-outline'}`} style={{marginBottom:12, display:'inline-block'}}>{tier.name.toUpperCase()}</span>
                  <div style={{display:'flex', alignItems:'baseline', gap:6}}>
                    <span className="serif" style={{fontSize:52, lineHeight:1, color: tier.highlight ? 'var(--paper)' : 'var(--rust)'}}>${displayPrice}</span>
                    <span style={{fontSize:13, color: tier.highlight ? 'var(--bg-deep)' : 'var(--ink-2)'}}>one-off</span>
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
                    {isProcessing ? 'Redirecting to checkout…' : `Join — $${displayPrice} →`}
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
