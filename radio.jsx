// Outback Radio — tune in to one shared, continuous broadcast. The server
// streams the radio-media/ folder on a single timeline; the client can tune in
// or out, but there's no pause or skip (reconnecting drops you at the live edge).
import { useState, useEffect, useRef } from 'react';
import { TopNav, Footer } from './app-shell.jsx';

export default function RadioApp() {
  const audioRef = useRef(null);
  const wantOn = useRef(false); // desired state — drives auto-reconnect
  const [playing, setPlaying] = useState(false);
  const [np, setNp] = useState(null);

  const poll = () => fetch('/api/radio/nowplaying').then(r => r.json()).then(setNp).catch(() => {});
  useEffect(() => { poll(); const t = setInterval(poll, 10000); return () => clearInterval(t); }, []);

  function connect() {
    const a = audioRef.current; if (!a) return;
    a.src = '/stream?t=' + Date.now(); // fresh connection = live edge
    a.play().then(() => { setPlaying(true); poll(); })
      .catch(() => { if (wantOn.current) setTimeout(() => { if (wantOn.current) connect(); }, 800); });
  }

  // Safety net: if the stream ever ends or errors while we're meant to be on
  // air (track boundary, network blip, decoder hiccup), reconnect at the live
  // edge automatically instead of leaving the listener stuck on silence.
  useEffect(() => {
    const a = audioRef.current; if (!a) return;
    const onEnded = () => { if (wantOn.current) connect(); };
    const onError = () => { if (wantOn.current) setTimeout(() => { if (wantOn.current) connect(); }, 800); };
    a.addEventListener('ended', onEnded);
    a.addEventListener('error', onError);
    return () => { a.removeEventListener('ended', onEnded); a.removeEventListener('error', onError); };
  }, []);

  // Firefox (and some other browsers) can suspend background-tab audio or throttle
  // the HTTP streaming connection after a few minutes of inactivity. Two fixes:
  // 1. Register a MediaSession so the browser treats this as intentional media and
  //    keeps it alive (also gives OS-level media controls for free).
  // 2. On visibilitychange, if audio has stalled while we wanted it on, reconnect.
  useEffect(() => {
    if (!('mediaSession' in navigator)) return;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: np?.track || 'Outback Radio',
      artist: np?.artist || '',
      album: np?.album || 'Outback FM · Live',
    });
  }, [np]);

  useEffect(() => {
    if (!('mediaSession' in navigator)) return;
    navigator.mediaSession.playbackState = playing ? 'playing' : 'paused';
  }, [playing]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      const a = audioRef.current;
      if (wantOn.current && a && (a.paused || a.ended || a.readyState < 2)) connect();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);

  function tuneIn() {
    wantOn.current = true;
    connect();
  }
  function tuneOut() {
    wantOn.current = false;
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
            {playing && np && np.artist ? <div className="radio-artist">{np.artist}</div> : null}
            {playing && np && np.album ? <div className="radio-album">{np.album}</div> : null}
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
