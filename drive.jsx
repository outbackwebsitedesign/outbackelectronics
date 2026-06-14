// Drive — account-gated file storage on the Outback Electronics server.
// Nothing shown until you sign in and upload; files live in drive-files/ and
// metadata in drive.db, scoped to your account.
import { useState, useEffect, useRef } from 'react';
import { TopNav, Footer, useAuth, useShopInfo, apiPost } from './app-shell.jsx';

const fmtSize = (n) => n < 1024 ? n + ' B' : n < 1048576 ? (n / 1024).toFixed(1) + ' KB' : (n / 1048576).toFixed(1) + ' MB';

export default function DriveApp() {
  const { user } = useAuth();
  const info = useShopInfo();
  const [files, setFiles] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const inputRef = useRef(null);

  const load = () => fetch('/api/drive/list', { credentials: 'include' }).then(r => r.ok ? r.json() : { files: [] }).then(d => setFiles(d.files || [])).catch(() => setFiles([]));
  useEffect(() => { if (user) load(); }, [user]);

  async function upload(fileList) {
    const arr = [...fileList];
    if (!arr.length) return;
    setBusy(true);
    for (const file of arr) {
      if (file.size > 20 * 1024 * 1024) { setMsg(`${file.name} is over 20 MB — skipped.`); continue; }
      setMsg(`Uploading ${file.name}…`);
      try {
        const dataBase64 = await new Promise((resolve, reject) => { const fr = new FileReader(); fr.onload = () => resolve(String(fr.result).split(',')[1]); fr.onerror = reject; fr.readAsDataURL(file); });
        const res = await apiPost('/api/drive/upload', { name: file.name, type: file.type, dataBase64 });
        if (!res.ok) setMsg(`Upload failed for ${file.name}.`);
      } catch { setMsg(`Upload failed for ${file.name}.`); }
    }
    setBusy(false);
    setMsg('Done.');
    await load();
    setTimeout(() => setMsg(''), 2000);
  }

  async function del(id, name) { if (!window.confirm(`Delete ${name}?`)) return; await apiPost('/api/drive/delete', { id }); load(); }

  if (user === undefined) return (<><TopNav current="drive" /><main className="container svc-main"><p>Loading…</p></main><Footer /></>);

  if (!user) return (
    <><TopNav current="drive" />
      <main className="container svc-main">
        <header className="svc-head">
          <p className="eyebrow">Drive</p>
          <h1 className="serif svc-title">Your files</h1>
          <p className="svc-sub">Store and grab your files anywhere — backed up on the Outback Electronics server, not big tech's cloud. Sign in to get started.</p>
        </header>
        {info && info.portalUrl ? <a className="btn btn-rust" href={info.portalUrl}>Sign in / Register</a> : null}
      </main><Footer /></>
  );

  return (
    <><TopNav current="drive" />
      <main className="container svc-main">
        <header className="svc-head">
          <p className="eyebrow">Drive</p>
          <h1 className="serif svc-title">Your files</h1>
          <p className="svc-sub">Stored on the Outback Electronics server. Up to 20 MB per file.</p>
        </header>
        <div className={'drive-drop' + (busy ? ' busy' : '')} onClick={() => inputRef.current && inputRef.current.click()}
          onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); upload(e.dataTransfer.files); }}>
          <input ref={inputRef} type="file" multiple style={{ display: 'none' }} onChange={e => upload(e.target.files)} />
          <b>{busy ? 'Uploading…' : 'Drop files here, or click to upload'}</b>
          <span>{msg}</span>
        </div>
        {files === null ? <p className="drive-empty">Loading…</p>
          : files.length === 0 ? <p className="drive-empty">No files yet — upload your first above.</p>
          : (
            <div className="file-list">
              {files.map(f => (
                <div className="file-row" key={f.id}>
                  <span className="file-name">{f.name}</span>
                  <span className="file-meta">{fmtSize(f.size)}</span>
                  <a className="btn btn-ghost btn-sm" href={`/api/drive/file?id=${encodeURIComponent(f.id)}`}>Download</a>
                  <button className="btn btn-ghost btn-sm" onClick={() => del(f.id, f.name)}>Delete</button>
                </div>
              ))}
            </div>
          )}
      </main><Footer /></>
  );
}
