import React, { useState, useEffect } from 'react';
import { getCsrf, ensureCsrf } from './src/lib/api.js';

const PageHead = window.PageHead;
const ErrorText = window.ErrorText;

// ---------------- Order Success / Cancelled ----------------

function OrderSuccessPage({ go, clearCart }) {
  const [session, setSession] = useState(null);
  useEffect(() => {
    clearCart();
    const params = new URLSearchParams(location.search);
    const sid = params.get('session_id');
    const orderId = params.get('order_id');
    if (orderId && !sid) {
      setSession({ customerEmail: null, amountAud: null, orderId });
      return;
    }
    if (!sid) return;
    fetch(`/api/checkout/session?id=${encodeURIComponent(sid)}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setSession(orderId ? { orderId, ...d } : d); })
      .catch(() => { if (orderId) setSession({ customerEmail: null, amountAud: null, orderId }); });
  }, []);

  return (
    <div style={{minHeight:'60vh', display:'grid', placeItems:'center', padding:32}}>
      <div style={{maxWidth:520, textAlign:'center', display:'grid', gap:20}}>
        <div style={{fontSize:56}}>✓</div>
        <h1 className="serif" style={{fontSize:40, fontWeight:400}}>Order confirmed</h1>
        <p style={{color:'var(--ink-2)', lineHeight:1.7}}>
          {session?.customerEmail
            ? <>Thanks{session.customerName ? `, ${session.customerName}` : ''}! A confirmation has been sent to <strong>{session.customerEmail}</strong>.</>
            : 'Thanks for your order! Your payment was received successfully.'}
        </p>
        {(session?.orderId || session?.amountAud != null) && (
          <div style={{padding:'14px 24px', background:'var(--paper)', border:'1px solid var(--line)', display:'inline-block', margin:'0 auto'}}>
            {session?.orderId && (
              <div style={{marginBottom: session?.amountAud != null ? 12 : 0}}>
                <div className="mono" style={{fontSize:11, color:'var(--ink-2)', marginBottom:4}}>ORDER NUMBER</div>
                <div className="mono" style={{fontSize:20, fontWeight:600}}>{session.orderId}</div>
              </div>
            )}
            {/* amountAud can legitimately be 0 (gift-card-only orders) — only hide when unknown */}
            {session?.amountAud != null && (
              <div>
                <div className="mono" style={{fontSize:11, color:'var(--ink-2)', marginBottom:4}}>AMOUNT PAID</div>
                <div className="serif" style={{fontSize:32}}>${Number(session.amountAud).toLocaleString('en-AU', {minimumFractionDigits:2})}</div>
              </div>
            )}
          </div>
        )}
        <p style={{fontSize:13, color:'var(--ink-3)'}}>
          Your order has been logged and our team will be in touch. For pickups or repairs, please bring this confirmation.
        </p>
        <div style={{display:'flex', gap:12, justifyContent:'center', flexWrap:'wrap'}}>
          <button className="btn btn-rust" onClick={() => go('shop')}>Continue shopping</button>
          <button className="btn btn-ghost" onClick={() => go('home')}>Back to home</button>
        </div>
      </div>
    </div>
  );
}

function OrderCancelledPage({ go }) {
  return (
    <div style={{minHeight:'60vh', display:'grid', placeItems:'center', padding:32}}>
      <div style={{maxWidth:480, textAlign:'center', display:'grid', gap:20}}>
        <div style={{fontSize:56}}>✕</div>
        <h1 className="serif" style={{fontSize:40, fontWeight:400}}>Payment cancelled</h1>
        <p style={{color:'var(--ink-2)', lineHeight:1.7}}>
          No charge was made. If you had trouble checking out or want to pay another way, get in touch and we'll sort it out.
        </p>
        <div style={{display:'flex', gap:12, justifyContent:'center', flexWrap:'wrap'}}>
          <button className="btn btn-rust" onClick={() => go('shop')}>Back to shop</button>
          <button className="btn btn-ghost" onClick={() => go('contact')}>Contact us</button>
        </div>
      </div>
    </div>
  );
}

// ---------------- Cart Page ----------------
function CartPage({ go, cart, removeFromCart, updateQty, clearCart, addToCart }) {
  const [checkingOut, setCheckingOut] = useState(false);
  const [error, setError] = useState(null);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [gcInput, setGcInput] = useState('');
  const [gc, setGc] = useState(null);
  const [gcError, setGcError] = useState(null);
  const [gcLoading, setGcLoading] = useState(false);
  const [rewardsEmail, setRewardsEmail] = useState('');
  const [rewardsPassword, setRewardsPassword] = useState('');
  const [rewardsData, setRewardsData] = useState(null);
  const [rewardsLoading, setRewardsLoading] = useState(true);
  const [rewardsError, setRewardsError] = useState(null);
  const [rewardsApply, setRewardsApply] = useState(false);
  const [storeCreditApply, setStoreCreditApply] = useState(false);
  const [shareLink, setShareLink] = useState(null);
  const [sharing, setSharing] = useState(false);
  const [shareError, setShareError] = useState(null);
  const [loadingShared, setLoadingShared] = useState(false);
  const [sharedLoaded, setSharedLoaded] = useState(false);
  const [postcodeInput, setPostcodeInput] = useState('');
  const [shippingQuote, setShippingQuote] = useState(null);
  const [shippingLoading, setShippingLoading] = useState(false);
  const [shippingError, setShippingError] = useState(null);
  const [selectedShipping, setSelectedShipping] = useState(null);

  useEffect(() => {
    setShippingQuote(null);
    setSelectedShipping(null);
    setShippingError(null);
  }, [cart.map(i => `${i.id||i.sku}:${i.qty}`).join(',')]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const shareId = params.get('share');
    if (!shareId || !/^[0-9a-f]{8}$/.test(shareId)) return;
    setLoadingShared(true);
    fetch(`/api/cart/${shareId}`)
      .then(r => r.json())
      .then(data => {
        if (data.items) {
          data.items.forEach(item => addToCart(item));
          setSharedLoaded(true);
          window.history.replaceState({}, '', '/cart');
        }
      })
      .catch(() => {})
      .finally(() => setLoadingShared(false));
  }, []);

  const shareCart = async () => {
    setSharing(true);
    setShareError(null);
    setShareLink(null);
    try {
      const resp = await fetch('/api/cart/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': getCsrf() },
        body: JSON.stringify({ items: cart }),
      });
      const data = await resp.json();
      if (data.id) {
        const link = `${location.origin}/cart?share=${data.id}`;
        setShareLink(link);
        try { await navigator.clipboard.writeText(link); } catch {}
      } else {
        setShareError('Could not create share link. Please try again.');
      }
    } catch {
      setShareError('Could not create share link. Please try again.');
    } finally {
      setSharing(false);
    }
  };

  const subtotal = cart.reduce((s, i) => s + i.price * i.qty, 0);
  const discount = gc ? gc.discount : 0;
  const shippingCost = selectedShipping ? selectedShipping.price : 0;
  const preRewardsTotal = Math.max(0, subtotal + shippingCost - discount);
  const rewardsPointsToRedeem = (rewardsData && rewardsApply) ? Math.min(rewardsData.points, Math.round(preRewardsTotal * 100)) : 0;
  const rewardsDollars = rewardsPointsToRedeem / 100;
  const afterRewardsTotal = Math.max(0, preRewardsTotal - rewardsDollars);
  const storeCreditAvail = rewardsData ? (rewardsData.storeCredit || 0) : 0;
  const storeCreditToRedeem = (rewardsData && storeCreditApply)
    ? Math.round(Math.min(storeCreditAvail, afterRewardsTotal) * 100) / 100
    : 0;
  const total = Math.max(0, Math.round((afterRewardsTotal - storeCreditToRedeem) * 100) / 100);

  const getShippingQuote = async () => {
    const pc = postcodeInput.trim();
    if (!/^\d{4}$/.test(pc)) { setShippingError('Enter a valid 4-digit Australian postcode.'); return; }
    setShippingLoading(true);
    setShippingError(null);
    setShippingQuote(null);
    setSelectedShipping(null);
    try {
      const items = cart.map(i => ({ productId: i.id || i.sku || '', quantity: i.qty }));
      const resp = await fetch('/api/shipping/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': getCsrf() },
        body: JSON.stringify({ toPostcode: pc, items }),
      });
      const data = await resp.json();
      if (!resp.ok) { setShippingError(data.message || 'Could not get shipping quote.'); return; }
      if (data.digital) { setShippingQuote({ services: [], digital: true, toPostcode: pc }); return; }
      if (!data.services || data.services.length === 0) { setShippingError('No shipping services available for that postcode.'); return; }
      setShippingQuote(data);
      setSelectedShipping(data.services[0]);
    } catch {
      setShippingError('Could not connect to shipping service. Please try again.');
    } finally {
      setShippingLoading(false);
    }
  };

  const applyGiftCard = async () => {
    const code = gcInput.trim().toUpperCase();
    if (!code) return;
    setGcLoading(true);
    setGcError(null);
    try {
      const resp = await fetch('/api/gift-card/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': getCsrf() },
        body: JSON.stringify({ code, cartTotal: subtotal + shippingCost }),
      });
      const data = await resp.json();
      if (data.valid) { setGc(data); setGcError(null); }
      else setGcError(data.message || 'Invalid gift card code.');
    } catch {
      setGcError('Could not validate gift card. Please try again.');
    } finally {
      setGcLoading(false);
    }
  };

  const removeGiftCard = () => { setGc(null); setGcInput(''); setGcError(null); };

  useEffect(() => {
    fetch('/api/rewards/me', { credentials: 'include' })
      .then(r => r.json())
      .then(d => { if (d.loggedIn) { setRewardsData(d); setRewardsApply(d.points > 0); setStoreCreditApply((d.storeCredit || 0) > 0); } })
      .catch(() => {})
      .finally(() => setRewardsLoading(false));
  }, []);

  const lookupRewards = async () => {
    if (!rewardsEmail.trim() || !rewardsPassword) return;
    setRewardsLoading(true);
    setRewardsError(null);
    try {
      await ensureCsrf();
      const resp = await fetch('/api/rewards/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': getCsrf() },
        body: JSON.stringify({ email: rewardsEmail.trim(), password: rewardsPassword }),
      });
      const data = await resp.json();
      if (!resp.ok) { setRewardsError(data.message || 'Could not verify account.'); return; }
      setRewardsData(data);
      setRewardsApply(data.points > 0);
      setStoreCreditApply((data.storeCredit || 0) > 0);
      setRewardsPassword('');
    } catch {
      setRewardsError('Could not connect. Please try again.');
    } finally {
      setRewardsLoading(false);
    }
  };
  const removeRewards = () => { setRewardsData(null); setRewardsEmail(''); setRewardsPassword(''); setRewardsError(null); setRewardsApply(false); setStoreCreditApply(false); };

  const checkout = async () => {
    if (cart.length === 0) return;
    if (!termsAccepted) {
      setError('Please accept the Terms & Conditions and Privacy Policy before proceeding to checkout.');
      return;
    }
    const hasPhysical = cart.some(i => !i.digital);
    if (hasPhysical && !selectedShipping) {
      setError('Please get a shipping quote and select a shipping method before checkout.');
      return;
    }
    setCheckingOut(true);
    setError(null);
    try {
      const items = cart.map(i => ({ name: i.name, priceAud: i.price, quantity: i.qty, productId: i.id || i.sku || '', variantSku: i._variantSku || null }));
      const body = { items };
      if (gc) body.giftCardCode = gc.code;
      if (rewardsData && rewardsApply && rewardsPointsToRedeem > 0) {
        body.redeemPoints = rewardsPointsToRedeem;
        body.rewardsToken = rewardsData.token;
      }
      if (rewardsData && storeCreditApply && storeCreditToRedeem > 0) {
        body.redeemStoreCredit = storeCreditToRedeem;
        body.rewardsToken = rewardsData.token;
      }
      if (selectedShipping) {
        body.shippingAmount = selectedShipping.price;
        body.shippingService = selectedShipping.name;
        body.shippingCode = selectedShipping.code;
        body.toPostcode = shippingQuote?.toPostcode || '';
      }
      await ensureCsrf();
      const resp = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': getCsrf() },
        body: JSON.stringify(body),
      });
      let data;
      try { data = await resp.json(); } catch { data = {}; }
      if (data.url && data.url.startsWith('https://checkout.stripe.com/')) { window.location.href = data.url; }
      else if (data.url) { setError('Unexpected redirect URL from payment provider.'); }
      else setError(data.message || 'Checkout failed. Please try again.');
    } catch (err) {
      setError('Could not connect to payment provider. Please try again.');
    } finally {
      setCheckingOut(false);
    }
  };

  if (loadingShared) {
    return (
      <>
        <PageHead crumbs={['Outback', 'Cart']} title="Your Cart" lead="Loading shared cart…" />
        <section className="container" style={{paddingTop:40, paddingBottom:56, textAlign:'center'}}>
          <p style={{color:'var(--ink-2)'}}>Please wait…</p>
        </section>
      </>
    );
  }

  if (cart.length === 0) {
    return (
      <>
        <PageHead crumbs={['Outback', 'Cart']} title="Your Cart" lead="Nothing in your cart yet." />
        <section className="container" style={{paddingTop:40, paddingBottom:56, textAlign:'center'}}>
          <p style={{color:'var(--ink-2)', marginBottom:24}}>Browse the shop and add items to get started.</p>
          <button className="btn btn-rust" onClick={() => go('shop')}>Go to Shop →</button>
        </section>
      </>
    );
  }

  return (
    <>
      <PageHead crumbs={['Outback', 'Cart']} title="Your Cart" lead={`${cart.length} item${cart.length !== 1 ? 's' : ''} ready to checkout.`} />
      <section className="container" style={{paddingTop:32, paddingBottom:56}}>
        <div className="cart-layout" style={{display:'grid', gridTemplateColumns:'1fr 320px', gap:40, alignItems:'start'}}>
          <div>
            <div style={{borderTop:'2px solid var(--ink)', marginBottom:4}}>
              <div className="cart-header-row" style={{display:'grid', gridTemplateColumns:'1fr 120px 100px 40px', padding:'10px 0', fontFamily:'JetBrains Mono,monospace', fontSize:11, letterSpacing:'.06em', color:'var(--ink-2)', borderBottom:'1px solid var(--line)'}}>
                <div>ITEM</div><div style={{textAlign:'center'}}>QTY</div><div style={{textAlign:'right'}}>PRICE</div><div />
              </div>
            </div>
            {cart.map((item) => {
              const key = item.sku || item.id || item.name;
              return (
                <div key={key} className="cart-item-row" style={{display:'grid', gridTemplateColumns:'1fr 120px 100px 40px', padding:'18px 0', borderBottom:'1px solid var(--line)', alignItems:'center', gap:8}}>
                  <div>
                    <div style={{fontWeight:600, fontSize:15}}>{item.name}</div>
                    {item.sku && <div className="mono" style={{fontSize:11, color:'var(--ink-3)', marginTop:3}}>SKU: {item.sku}</div>}
                    {item.cond && <div className="mono" style={{fontSize:11, color:'var(--ink-2)', marginTop:2}}>{item.cond}</div>}
                  </div>
                  <div style={{display:'flex', alignItems:'center', justifyContent:'center', gap:6}}>
                    <button onClick={() => updateQty(key, item.qty - 1)} aria-label={`Decrease quantity of ${item.name}`} style={{width:28, height:28, border:'1px solid var(--line)', background:'var(--bg-elev)', cursor:'pointer', fontSize:16, display:'flex', alignItems:'center', justifyContent:'center'}}>−</button>
                    <span className="mono" aria-label={`Quantity of ${item.name}`} style={{fontSize:14, minWidth:20, textAlign:'center'}}>{item.qty}</span>
                    <button onClick={() => updateQty(key, item.qty + 1)} aria-label={`Increase quantity of ${item.name}`} style={{width:28, height:28, border:'1px solid var(--line)', background:'var(--bg-elev)', cursor:'pointer', fontSize:16, display:'flex', alignItems:'center', justifyContent:'center'}}>+</button>
                  </div>
                  <div style={{textAlign:'right', fontFamily:'Instrument Serif,serif', fontSize:18, color:'var(--rust)'}}>
                    ${(item.price * item.qty).toLocaleString()}
                  </div>
                  <div style={{textAlign:'center'}}>
                    <button onClick={() => removeFromCart(key)} title="Remove" aria-label={`Remove ${item.name} from cart`} style={{background:'none', border:'none', cursor:'pointer', color:'var(--ink-3)', fontSize:18, lineHeight:1}}>×</button>
                  </div>
                </div>
              );
            })}
            <button className="btn btn-ghost btn-sm" onClick={() => go('shop')} style={{marginTop:18}}>← Continue Shopping</button>
          </div>

          <div style={{position:'sticky', top:24}}>
            <div className="card-paper" style={{padding:28}}>
              <div className="eyebrow" style={{marginBottom:14}}>ORDER SUMMARY</div>
              {cart.map(item => {
                const key = item.sku || item.id || item.name;
                return (
                  <div key={key} style={{display:'flex', justifyContent:'space-between', fontSize:13, marginBottom:8, color:'var(--ink-2)'}}>
                    <span>{item.name} × {item.qty}</span>
                    <span>${(item.price * item.qty).toLocaleString()}</span>
                  </div>
                );
              })}
              <hr className="thin" />

              {cart.some(i => !i.digital) && (
                <div style={{marginBottom:14}}>
                  <div className="mono" style={{fontSize:11, color:'var(--ink-2)', marginBottom:8}}>SHIPPING ESTIMATE</div>
                  {!shippingQuote ? (
                    <>
                      <div style={{display:'flex', gap:6}}>
                        <input
                          className="input"
                          placeholder="Your postcode"
                          value={postcodeInput}
                          maxLength={4}
                          onChange={e => { setPostcodeInput(e.target.value.replace(/\D/,'')); setShippingError(null); }}
                          onKeyDown={e => e.key === 'Enter' && getShippingQuote()}
                          style={{flex:1, fontSize:13, fontFamily:'monospace', letterSpacing:'.05em'}}
                        />
                        <button className="btn btn-ghost btn-sm" onClick={getShippingQuote} disabled={shippingLoading || postcodeInput.length !== 4}>
                          {shippingLoading ? '…' : 'Quote'}
                        </button>
                      </div>
                      <ErrorText inline>{shippingError}</ErrorText>
                    </>
                  ) : shippingQuote.digital ? (
                    <div style={{fontSize:12, color:'#16a34a'}}>All items are digital — no shipping required.</div>
                  ) : (
                    <div>
                      <div style={{fontSize:11, color:'var(--ink-3)', marginBottom:6}}>
                        Shipping to {shippingQuote.toPostcode} · {shippingQuote.totalWeightKg}kg
                        <button onClick={() => { setShippingQuote(null); setSelectedShipping(null); setPostcodeInput(''); }} style={{marginLeft:8, background:'none', border:'none', cursor:'pointer', color:'var(--ink-3)', fontSize:11, textDecoration:'underline', padding:0}}>Change</button>
                      </div>
                      {shippingQuote.services.map(s => (
                        <label key={s.code} style={{display:'flex', alignItems:'center', gap:8, fontSize:13, marginBottom:6, cursor:'pointer'}}>
                          <input
                            type="radio"
                            name="shippingService"
                            checked={selectedShipping?.code === s.code}
                            onChange={() => setSelectedShipping(s)}
                          />
                          <span style={{flex:1}}>{s.name}</span>
                          <span style={{fontFamily:'monospace', color:'var(--rust)'}}>${s.price.toFixed(2)}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {(discount > 0 || shippingCost > 0 || rewardsDollars > 0 || storeCreditToRedeem > 0) && (
                <>
                  <div style={{display:'flex', justifyContent:'space-between', fontSize:13, marginBottom:6, color:'var(--ink-2)'}}>
                    <span>Subtotal</span>
                    <span>${subtotal.toLocaleString('en-AU', {minimumFractionDigits:2})}</span>
                  </div>
                  {shippingCost > 0 && (
                    <div style={{display:'flex', justifyContent:'space-between', fontSize:13, marginBottom:6, color:'var(--ink-2)'}}>
                      <span>Shipping</span>
                      <span>${shippingCost.toFixed(2)}</span>
                    </div>
                  )}
                  {discount > 0 && (
                    <div style={{display:'flex', justifyContent:'space-between', fontSize:13, marginBottom:6, color:'#16a34a'}}>
                      <span>Gift card ({gc.code})</span>
                      <span>−${discount.toLocaleString('en-AU', {minimumFractionDigits:2})}</span>
                    </div>
                  )}
                  {rewardsDollars > 0 && (
                    <div style={{display:'flex', justifyContent:'space-between', fontSize:13, marginBottom:6, color:'#16a34a'}}>
                      <span>Rewards points</span>
                      <span>−${rewardsDollars.toLocaleString('en-AU', {minimumFractionDigits:2})}</span>
                    </div>
                  )}
                  {storeCreditToRedeem > 0 && (
                    <div style={{display:'flex', justifyContent:'space-between', fontSize:13, marginBottom:6, color:'#16a34a'}}>
                      <span>Store credit</span>
                      <span>−${storeCreditToRedeem.toLocaleString('en-AU', {minimumFractionDigits:2})}</span>
                    </div>
                  )}
                  <hr className="thin" />
                </>
              )}
              <div style={{display:'flex', justifyContent:'space-between', alignItems:'baseline', marginBottom:6}}>
                <span style={{fontSize:13, color:'var(--ink-2)'}}>Total</span>
                <span className="serif" style={{fontSize:24, color:'var(--rust)'}}>${total.toLocaleString('en-AU', {minimumFractionDigits:2})}</span>
              </div>
              {!selectedShipping && cart.some(i => !i.digital) && (
                <div className="mono" style={{fontSize:11, color:'var(--ink-3)', marginBottom:6}}>+ SHIPPING (QUOTE ABOVE)</div>
              )}

              {gc ? (
                <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', background:'#f0fdf4', border:'1px solid #86efac', padding:'8px 12px', marginBottom:14, fontSize:13}}>
                  <span style={{color:'#15803d', fontFamily:'monospace'}}>{gc.code} — ${gc.balance.toLocaleString('en-AU', {minimumFractionDigits:2})} balance</span>
                  <button onClick={removeGiftCard} style={{background:'none', border:'none', cursor:'pointer', color:'var(--ink-3)', fontSize:16, padding:0, lineHeight:1}}>×</button>
                </div>
              ) : (
                <div style={{marginBottom:14}}>
                  <div style={{display:'flex', gap:6}}>
                    <input
                      className="input"
                      placeholder="Gift card code"
                      value={gcInput}
                      onChange={e => setGcInput(e.target.value.toUpperCase())}
                      onKeyDown={e => e.key === 'Enter' && applyGiftCard()}
                      style={{flex:1, fontSize:12, fontFamily:'monospace', letterSpacing:'.05em'}}
                    />
                    <button className="btn btn-ghost btn-sm" onClick={applyGiftCard} disabled={gcLoading || !gcInput.trim()}>
                      {gcLoading ? '…' : 'Apply'}
                    </button>
                  </div>
                  <ErrorText inline>{gcError}</ErrorText>
                </div>
              )}

              {rewardsData ? (
                <div style={{marginBottom:14, padding:'10px 14px', background:'#fffbeb', border:'1px solid #fde68a', fontSize:13}}>
                  <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:rewardsData.points > 0 ? 8 : 0}}>
                    <span style={{color:'#92400e', fontWeight:600}}>{rewardsData.displayName} — {rewardsData.points.toLocaleString('en-AU')} pts</span>
                    <button onClick={removeRewards} style={{background:'none', border:'none', cursor:'pointer', color:'var(--ink-3)', fontSize:16, padding:0, lineHeight:1}}>×</button>
                  </div>
                  {rewardsData.points > 0 && (
                    <label style={{display:'flex', alignItems:'center', gap:8, cursor:'pointer', color:'#78350f'}}>
                      <input type="checkbox" checked={rewardsApply} onChange={e => setRewardsApply(e.target.checked)} />
                      Redeem {Math.min(rewardsData.points, Math.round(preRewardsTotal * 100)).toLocaleString('en-AU')} pts (−${(Math.min(rewardsData.points, Math.round(preRewardsTotal * 100)) / 100).toLocaleString('en-AU', {minimumFractionDigits:2})})
                    </label>
                  )}
                  {rewardsData.points === 0 && (rewardsData.storeCredit || 0) === 0 && <span style={{color:'#92400e'}}>No points to redeem.</span>}
                  {storeCreditAvail > 0 && (
                    <label style={{display:'flex', alignItems:'center', gap:8, cursor:'pointer', color:'#78350f', marginTop: rewardsData.points > 0 ? 8 : 0}}>
                      <input type="checkbox" checked={storeCreditApply} onChange={e => setStoreCreditApply(e.target.checked)} />
                      Apply store credit ${storeCreditAvail.toLocaleString('en-AU', {minimumFractionDigits:2})} (−${Math.min(storeCreditAvail, afterRewardsTotal).toLocaleString('en-AU', {minimumFractionDigits:2})})
                    </label>
                  )}
                </div>
              ) : rewardsLoading ? null : (
                <div style={{marginBottom:14}}>
                  <div className="mono" style={{fontSize:10, color:'var(--ink-3)', marginBottom:6}}>HAVE AN ACCOUNT? REDEEM YOUR POINTS</div>
                  <div style={{display:'flex', gap:6, marginBottom:4}}>
                    <input className="input" placeholder="Email" type="email" value={rewardsEmail} onChange={e => setRewardsEmail(e.target.value)} style={{flex:1, fontSize:12}} />
                    <input className="input" placeholder="Password" type="password" value={rewardsPassword} onChange={e => setRewardsPassword(e.target.value)} onKeyDown={e => e.key === 'Enter' && lookupRewards()} style={{flex:1, fontSize:12}} />
                  </div>
                  <button className="btn btn-ghost btn-sm" onClick={lookupRewards} disabled={rewardsLoading || !rewardsEmail.trim() || !rewardsPassword} style={{width:'100%', justifyContent:'center'}}>
                    {rewardsLoading ? '…' : 'Check Points Balance'}
                  </button>
                  <ErrorText inline>{rewardsError}</ErrorText>
                </div>
              )}

              <label style={{display:'flex', alignItems:'flex-start', gap:10, marginBottom:12, cursor:'pointer'}}>
                <input type="checkbox" checked={termsAccepted} onChange={e => { setTermsAccepted(e.target.checked); setError(null); }} style={{marginTop:2, flexShrink:0, accentColor:'var(--rust)', width:15, height:15, cursor:'pointer'}} />
                <span style={{fontSize:12, color:'var(--ink-2)', lineHeight:1.5}}>
                  I agree to the{' '}
                  <a href="/policies/terms-and-conditions" target="_blank" rel="noopener noreferrer" style={{color:'var(--rust)', fontWeight:600}}>Terms &amp; Conditions</a>
                  {', '}
                  <a href="/policies/privacy-policy" target="_blank" rel="noopener noreferrer" style={{color:'var(--rust)', fontWeight:600}}>Privacy Policy</a>
                  {', '}
                  <a href="/policies/return-policy" target="_blank" rel="noopener noreferrer" style={{color:'var(--rust)', fontWeight:600}}>Return Policy</a>
                  {', and '}
                  <a href="/policies" target="_blank" rel="noopener noreferrer" style={{color:'var(--rust)', fontWeight:600}}>all site policies</a>.
                </span>
              </label>
              <ErrorText style={{marginBottom:12}}>{error}</ErrorText>
              <button className="btn btn-rust" style={{width:'100%', justifyContent:'center', gap:8}} onClick={checkout} disabled={checkingOut} aria-busy={checkingOut}>
                {checkingOut ? <><span className="spinner" aria-hidden="true" /> Redirecting…</> : `Checkout — $${total.toLocaleString('en-AU', {minimumFractionDigits:2})}${selectedShipping ? '' : cart.some(i=>!i.digital) ? ' + shipping' : ''}`}
              </button>
              <div className="mono" style={{fontSize:10, color:'var(--ink-3)', marginTop:10, textAlign:'center'}}>SECURE CHECKOUT VIA STRIPE</div>

              <hr className="thin" style={{marginTop:16, marginBottom:12}} />
              {sharedLoaded && (
                <div style={{marginBottom:10, padding:'8px 12px', background:'#f0fdf4', border:'1px solid #86efac', fontSize:12, color:'#15803d'}}>
                  Shared cart loaded successfully.
                </div>
              )}
              <button className="btn btn-ghost btn-sm" style={{width:'100%', justifyContent:'center'}} onClick={shareCart} disabled={sharing}>
                {sharing ? 'Generating link…' : 'Share this cart'}
              </button>
              {shareLink && (
                <div style={{marginTop:10}}>
                  <div style={{fontSize:11, color:'var(--ink-2)', marginBottom:4}}>Link copied to clipboard:</div>
                  <div style={{display:'flex', gap:6, alignItems:'center'}}>
                    <input readOnly value={shareLink} onClick={e => e.target.select()} style={{flex:1, fontSize:11, fontFamily:'monospace', padding:'5px 8px', border:'1px solid var(--line)', background:'var(--bg-elev)', color:'var(--ink)'}} />
                  </div>
                  <div className="mono" style={{fontSize:10, color:'var(--ink-3)', marginTop:4}}>EXPIRES {new Date(Date.now() + 30 * 86400000).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }).toUpperCase()} (30 DAYS)</div>
                </div>
              )}
              <ErrorText inline style={{marginTop:8}}>{shareError}</ErrorText>
            </div>
          </div>
        </div>
      </section>
      {/* Floating checkout bar — mobile only (hidden on desktop via index.html, shown in mobile.css) */}
      <div className="cart-mobile-bar">
        <div>
          <div className="mono" style={{fontSize:10, color:'var(--ink-2)'}}>TOTAL{selectedShipping ? '' : cart.some(i => !i.digital) ? ' + SHIPPING' : ''}</div>
          <div className="serif" style={{fontSize:22, color:'var(--rust)', lineHeight:1.1}}>${total.toLocaleString('en-AU', {minimumFractionDigits:2})}</div>
        </div>
        <button className="btn btn-rust" style={{justifyContent:'center', gap:8}} onClick={checkout} disabled={checkingOut} aria-busy={checkingOut}>
          {checkingOut ? <><span className="spinner" aria-hidden="true" /> Redirecting…</> : 'Checkout →'}
        </button>
      </div>
    </>
  );
}

// ---------------- Register Page ----------------
function RegisterPage({ go }) {
  const { portalApi, getPortalUrl } = window.__OE_HELPERS__ || {};
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!termsAccepted) { setError('You must accept the Terms & Conditions and Privacy Policy to create an account.'); return; }
    setError(''); setBusy(true);
    const r = await portalApi('/api/portal/auth/register', {
      method: 'POST',
      body: JSON.stringify({ firstName, lastName, email, phone, address, username, password }),
    });
    setBusy(false);
    if (r.ok) {
      window.location.href = getPortalUrl();
    } else {
      setError(r.message || 'Registration failed. Please try again.');
    }
  }

  const fieldStyle = { display:'flex', flexDirection:'column', gap:4, marginBottom:16 };
  const labelStyle = { fontSize:11, fontWeight:700, letterSpacing:'0.06em', color:'var(--ink-2)', textTransform:'uppercase' };
  const inputStyle = { padding:'10px 12px', border:'1px solid var(--line)', borderRadius:6, fontSize:14, fontFamily:'inherit', color:'var(--ink)', background:'var(--bg)', outline:'none', width:'100%', boxSizing:'border-box' };

  return (
    <>
      <PageHead crumbs={['Outback', 'Create Account']} title="Create an Account"
        lead="Sign up once and use the same account across the portal, forum, and more."
      />
      <section className="container" style={{paddingTop:32, paddingBottom:64}}>
        <div style={{maxWidth:560, margin:'0 auto'}}>
          <div className="card-paper" style={{padding:32}}>
            {error && (
              <div style={{background:'#fee2e2', border:'1px solid #fca5a5', color:'#991b1b', borderRadius:6, padding:'10px 14px', marginBottom:20, fontSize:13}}>
                {error}
              </div>
            )}
            <form onSubmit={handleSubmit}>
              <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:16}}>
                <label style={fieldStyle}>
                  <span style={labelStyle}>First name</span>
                  <input style={inputStyle} type="text" value={firstName} autoComplete="given-name" onChange={e => setFirstName(e.target.value)} required />
                </label>
                <label style={fieldStyle}>
                  <span style={labelStyle}>Last name</span>
                  <input style={inputStyle} type="text" value={lastName} autoComplete="family-name" onChange={e => setLastName(e.target.value)} required />
                </label>
              </div>
              <label style={fieldStyle}>
                <span style={labelStyle}>Email address</span>
                <input style={inputStyle} type="email" value={email} autoComplete="email" onChange={e => setEmail(e.target.value)} required />
              </label>
              <label style={fieldStyle}>
                <span style={labelStyle}>Phone number</span>
                <input style={inputStyle} type="tel" value={phone} autoComplete="tel" onChange={e => setPhone(e.target.value)} />
              </label>
              <label style={fieldStyle}>
                <span style={labelStyle}>Address</span>
                <input style={inputStyle} type="text" value={address} autoComplete="street-address" onChange={e => setAddress(e.target.value)} />
              </label>
              <label style={fieldStyle}>
                <span style={labelStyle}>Username</span>
                <input style={inputStyle} type="text" value={username} autoComplete="username" onChange={e => setUsername(e.target.value)} required />
                <span style={{fontSize:11, color:'var(--ink-3)'}}>3–30 characters · letters, numbers and underscores</span>
              </label>
              <label style={fieldStyle}>
                <span style={labelStyle}>Password</span>
                <input style={inputStyle} type="password" value={password} autoComplete="new-password" onChange={e => setPassword(e.target.value)} required />
                <span style={{fontSize:11, color:'var(--ink-3)'}}>Minimum 8 characters</span>
              </label>
              <label style={{display:'flex', alignItems:'flex-start', gap:10, marginTop:8, marginBottom:4, cursor:'pointer'}}>
                <input type="checkbox" checked={termsAccepted} onChange={e => { setTermsAccepted(e.target.checked); setError(''); }} style={{marginTop:2, flexShrink:0, accentColor:'var(--rust)', width:16, height:16, cursor:'pointer'}} />
                <span style={{fontSize:13, color:'var(--ink-2)', lineHeight:1.5}}>
                  I have read and agree to the{' '}
                  <a href="/policies/terms-and-conditions" target="_blank" rel="noopener noreferrer" style={{color:'var(--rust)', fontWeight:600}}>Terms &amp; Conditions</a>
                  {', '}
                  <a href="/policies/privacy-policy" target="_blank" rel="noopener noreferrer" style={{color:'var(--rust)', fontWeight:600}}>Privacy Policy</a>
                  {', and '}
                  <a href="/policies" target="_blank" rel="noopener noreferrer" style={{color:'var(--rust)', fontWeight:600}}>all site policies</a>.
                </span>
              </label>
              <button className="btn btn-rust" type="submit" disabled={busy} style={{width:'100%', justifyContent:'center', marginTop:8}}>
                {busy ? 'Creating account…' : 'Create account →'}
              </button>
            </form>
            <div style={{marginTop:20, textAlign:'center', fontSize:13, color:'var(--ink-2)'}}>
              Already have an account?{' '}
              <button onClick={() => { window.location.href = getPortalUrl(); }}
                style={{background:'none', border:'none', color:'var(--rust)', cursor:'pointer', fontWeight:600, fontSize:13, fontFamily:'inherit', padding:0}}>
                Sign in →
              </button>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

window.OE_PAGES = Object.assign(window.OE_PAGES || {}, {
  'order-success': OrderSuccessPage,
  'order-cancelled': OrderCancelledPage,
  cart: CartPage,
  register: RegisterPage,
});
window.dispatchEvent(new Event('oe:pages-updated'));
