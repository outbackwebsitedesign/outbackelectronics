// Swap & Sell — community classifieds. Public to browse; members post (with an
// optional photo). Listings live in swap.db; nothing seeded.
import { useState, useEffect, useRef } from 'react';
import { TopNav, Footer, useAuth, useShopInfo, apiPost } from './app-shell.jsx';

export default function SwapApp() {
  const { user } = useAuth();
  const info = useShopInfo();
  const [data, setData] = useState({ listings: [], categories: [] });
  const [cat, setCat] = useState('All');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', category: 'For Sale', desc: '', price: '', location: '', contact: '' });
  const [img, setImg] = useState(null);
  const [msg, setMsg] = useState('');
  const fileRef = useRef(null);

  const load = (c = cat) => { const qs = c && c !== 'All' ? `?cat=${encodeURIComponent(c)}` : ''; fetch('/api/swap/listings' + qs).then(r => r.json()).then(setData).catch(() => {}); };
  useEffect(() => { load(cat); }, [cat]);

  async function pickImg(file) {
    if (!file || !file.type.startsWith('image/')) return;
    if (file.size > 8 * 1024 * 1024) { setMsg('Image is over 8 MB.'); return; }
    const base64 = await new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(String(fr.result).split(',')[1]); fr.onerror = rej; fr.readAsDataURL(file); });
    setImg({ base64, type: file.type });
  }

  async function post(e) {
    e.preventDefault();
    if (!form.title.trim()) { setMsg('A title is required.'); return; }
    setMsg('Posting…');
    const body = { ...form };
    if (img) { body.imageBase64 = img.base64; body.imageType = img.type; }
    try {
      const r = await apiPost('/api/swap/post', body);
      if (r.ok) { setMsg('Posted!'); setForm({ title: '', category: 'For Sale', desc: '', price: '', location: '', contact: '' }); setImg(null); if (fileRef.current) fileRef.current.value = ''; setShowForm(false); load(cat); setTimeout(() => setMsg(''), 2000); }
      else if (r.status === 401) setMsg('Please sign in to post.');
      else setMsg('Could not post — try again.');
    } catch { setMsg('Could not post — try again.'); }
  }

  async function del(id) { if (!window.confirm('Delete this listing?')) return; await apiPost('/api/swap/delete', { id }); load(cat); }

  const cats = ['All', ...(data.categories || [])];

  return (
    <>
      <TopNav current="swap" />
      <main className="container svc-main">
        <header className="svc-head">
          <p className="eyebrow">Community · Classifieds</p>
          <h1 className="serif svc-title">Swap &amp; sell</h1>
          <p className="svc-sub">The local noticeboard for remote Australia — gear, parts, vehicles, wanted ads and free stuff. Free to post for members.</p>
        </header>

        <div className="swap-bar">
          <div className="swap-cats">{cats.map(c => <span key={c} className={'chip' + (cat === c ? ' on' : '')} onClick={() => setCat(c)}>{c}</span>)}</div>
          {user ? <button className="btn btn-rust" onClick={() => setShowForm(s => !s)}>{showForm ? 'Close' : '+ Post a listing'}</button>
            : (info && info.portalUrl ? <a className="btn btn-rust" href={info.portalUrl}>Sign in to post</a> : null)}
        </div>
        <p className="swap-msg">{msg}</p>

        {showForm && user ? (
          <form className="swap-form" onSubmit={post}>
            <div className="fld-row">
              <label className="fld"><span>Title</span><input className="input" value={form.title} maxLength={100} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} /></label>
              <label className="fld"><span>Category</span><select className="input" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>{(data.categories || []).map(c => <option key={c}>{c}</option>)}</select></label>
            </div>
            <label className="fld"><span>Description</span><textarea className="textarea" value={form.desc} maxLength={2000} onChange={e => setForm(f => ({ ...f, desc: e.target.value }))} /></label>
            <div className="fld-row">
              <label className="fld"><span>Price (optional)</span><input className="input" value={form.price} placeholder="$ or 'offers'" onChange={e => setForm(f => ({ ...f, price: e.target.value }))} /></label>
              <label className="fld"><span>Location</span><input className="input" value={form.location} placeholder="Town / region" onChange={e => setForm(f => ({ ...f, location: e.target.value }))} /></label>
            </div>
            <label className="fld"><span>Contact (how buyers reach you)</span><input className="input" value={form.contact} placeholder="Phone or email" onChange={e => setForm(f => ({ ...f, contact: e.target.value }))} /></label>
            <label className="fld"><span>Photo (optional)</span><input ref={fileRef} type="file" accept="image/*" onChange={e => pickImg(e.target.files[0])} /></label>
            <button className="btn btn-rust" type="submit">Post listing</button>
          </form>
        ) : null}

        {(data.listings || []).length === 0 ? <p className="swap-empty">No listings yet{cat !== 'All' ? ' in ' + cat : ''} — be the first to post.</p> : (
          <div className="swap-grid">
            {data.listings.map(l => (
              <article className="swap-card" key={l.id}>
                {l.hasImage ? <div className="swap-img"><img loading="lazy" src={`/api/swap/image?id=${encodeURIComponent(l.id)}`} alt={l.title} /></div> : null}
                <div className="swap-body">
                  <div className="swap-cat">{l.category}{l.price ? ` · ${l.price}` : ''}</div>
                  <h3 className="swap-title">{l.title}</h3>
                  {l.desc ? <p className="swap-desc">{l.desc}</p> : null}
                  <div className="swap-meta">{[l.location, l.sellerName].filter(Boolean).join(' · ')}</div>
                  {l.contact ? <div className="swap-contact">{l.contact}</div> : null}
                  {l.own ? <button className="btn btn-ghost btn-sm" onClick={() => del(l.id)} style={{ alignSelf: 'flex-start', marginTop: 4 }}>Delete</button> : null}
                </div>
              </article>
            ))}
          </div>
        )}
      </main>
      <Footer />
    </>
  );
}
