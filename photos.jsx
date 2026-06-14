// Photos — account-gated photo backup + gallery on the Outback Electronics
// server. Empty until you sign in and upload; images live in photos-files/.
import { useState, useEffect, useRef } from 'react';
import { TopNav, Footer, useAuth, useShopInfo, apiPost } from './app-shell.jsx';

export default function PhotosApp() {
  const { user } = useAuth();
  const info = useShopInfo();
  const [photos, setPhotos] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [view, setView] = useState(null);
  const inputRef = useRef(null);

  const load = () => fetch('/api/photos/list', { credentials: 'include' }).then(r => r.ok ? r.json() : { photos: [] }).then(d => setPhotos(d.photos || [])).catch(() => setPhotos([]));
  useEffect(() => { if (user) load(); }, [user]);

  async function upload(list) {
    const arr = [...list].filter(f => f.type.startsWith('image/'));
    if (!arr.length) return;
    setBusy(true);
    for (const file of arr) {
      if (file.size > 15 * 1024 * 1024) { setMsg(`${file.name} is over 15 MB — skipped.`); continue; }
      setMsg(`Uploading ${file.name}…`);
      try {
        const dataBase64 = await new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(String(fr.result).split(',')[1]); fr.onerror = rej; fr.readAsDataURL(file); });
        const r = await apiPost('/api/photos/upload', { name: file.name, type: file.type, dataBase64 });
        if (!r.ok) setMsg(`Upload failed for ${file.name}.`);
      } catch { setMsg(`Upload failed for ${file.name}.`); }
    }
    setBusy(false); setMsg(''); await load();
  }

  async function del(id) { if (!window.confirm('Delete this photo?')) return; await apiPost('/api/photos/delete', { id }); setView(null); load(); }

  if (user === undefined) return (<><TopNav current="photos" /><main className="container svc-main"><p>Loading…</p></main><Footer /></>);

  if (!user) return (
    <><TopNav current="photos" />
      <main className="container svc-main">
        <header className="svc-head">
          <p className="eyebrow">Photos</p>
          <h1 className="serif svc-title">Your photos</h1>
          <p className="svc-sub">Back up the farm, the trip, the build — on the Outback Electronics server, not someone else's cloud. Sign in to start.</p>
        </header>
        {info && info.portalUrl ? <a className="btn btn-rust" href={info.portalUrl}>Sign in / Register</a> : null}
      </main><Footer /></>
  );

  return (
    <><TopNav current="photos" />
      <main className="container svc-main">
        <header className="svc-head">
          <p className="eyebrow">Photos</p>
          <h1 className="serif svc-title">Your photos</h1>
          <p className="svc-sub">Backed up on the Outback Electronics server. Up to 15 MB each.</p>
        </header>
        <div className="ph-actions">
          <button className="btn btn-rust" onClick={() => inputRef.current && inputRef.current.click()} disabled={busy}>{busy ? 'Uploading…' : 'Upload photos'}</button>
          <span className="ph-msg">{msg}</span>
          <input ref={inputRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={e => upload(e.target.files)} />
        </div>
        {photos === null ? <p className="ph-empty">Loading…</p>
          : photos.length === 0 ? <p className="ph-empty">No photos yet — upload your first above.</p>
          : (
            <div className="ph-grid">
              {photos.map(p => (
                <button className="ph-thumb" key={p.id} onClick={() => setView(p.id)} aria-label={p.name}>
                  <img loading="lazy" src={`/api/photos/file?id=${encodeURIComponent(p.id)}`} alt={p.name} />
                </button>
              ))}
            </div>
          )}
      </main>
      {view ? (
        <div className="ph-lightbox" onClick={() => setView(null)}>
          <img src={`/api/photos/file?id=${encodeURIComponent(view)}`} alt="" onClick={e => e.stopPropagation()} />
          <div className="ph-lb-bar" onClick={e => e.stopPropagation()}>
            <button className="btn btn-ghost btn-sm" onClick={() => del(view)}>Delete</button>
            <button className="btn btn-sm" onClick={() => setView(null)}>Close</button>
          </div>
        </div>
      ) : null}
      <Footer />
    </>
  );
}
