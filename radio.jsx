// Outback Radio — tune in to one shared, continuous broadcast. The server
// streams the radio-media/ folder on a single timeline; the client can tune in
// or out, but there's no pause or skip (reconnecting drops you at the live edge).
import { useState, useEffect, useRef } from 'react';
import { TopNav, Footer } from './app-shell.jsx';

export default function RadioApp() {
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [np, setNp] = useState(null);

  const poll = () => fetch('/api/radio/nowplaying').then(r => r.json()).then(setNp).catch(() => {});
  useEffect(() => { poll(); const t = setInterval(poll, 10000); return () => clearInterval(t); }, []);

  function tuneIn() {
    const a = audioRef.current; if (!a) return;
    a.src = '/stream?t=' + Date.now(); // fresh connection = live edge
    a.play().then(() => { setPlaying(true); poll(); }).catch(() => setPlaying(false));
  }
  function tuneOut() {
    const a = audioRef.current; if (!a) return;
    a.pause(); a.removeAttribute('src'); a.load();
    setPlaying(false);
  }

  const offAir = np && !np.onAir;

  return (
    <>
      <TopNav current="radio" />
      <main className="container svc-main">
        <header className="svc-head">
          <p className="eyebrow">Outback FM · Live</p>
          <h1 className="serif svc-title">Outback Radio</h1>
          <p className="svc-sub">A continuous community broadcast — tune in or out, but there's no pause or skip. Just like the wireless.</p>
        </header>

        <div className="radio-deck">
          <div className="radio-dial">
            <div className="radio-wave" data-on={playing}>{Array.from({ length: 7 }).map((_, i) => <i key={i} />)}</div>
            <div className="radio-np">{offAir ? 'Off air' : (playing ? (np && np.track ? np.track : 'On air') : 'Tap to tune in')}</div>
            <div className="radio-sub">{offAir ? 'No tracks loaded yet' : (np ? `${np.count} track${np.count === 1 ? '' : 's'} in rotation · ${np.listeners} listening` : '…')}</div>
          </div>
          {offAir ? <button className="btn radio-btn" disabled>Off air</button>
            : playing ? <button className="btn btn-ghost radio-btn" onClick={tuneOut}>◼ Tune out</button>
            : <button className="btn btn-rust radio-btn" onClick={tuneIn}>► Tune in</button>}
        </div>

        <audio ref={audioRef} preload="none" />
        <p className="radio-note">Plays the station's own uploaded tracks. Audio-only, one shared stream for everyone tuned in — there's no rewind out here.</p>
      </main>
      <Footer />
    </>
  );
}
