// games.jsx — Outback Electronics Games Hub
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { makePortalHelpers } from './src/lib/api.js';

// ── Design tokens ─────────────────────────────────────────────────────────────
const T = {
  bg:         '#f4ede1',
  bgElev:     '#faf6ec',
  bgDeep:     '#e9dfc9',
  ink:        '#1f1a14',
  ink2:       '#5a4f40',
  ink3:       '#8b7e69',
  rust:       '#1f88f5',
  ochre:      '#d39a37',
  eucalyptus: '#4f6b3e',
  line:       '#d8cdb6',
  paper:      '#fbf7ed',
};

const css = {
  header: {
    background: T.paper, borderBottom: `1px solid ${T.line}`,
    padding: '0 24px', display: 'flex', alignItems: 'center', gap: 16,
    height: 56, flexShrink: 0,
  },
  logoLink: { display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', color: T.ink },
  logoImg:  { height: 28, display: 'block', background: '#000', padding: '2px 4px', borderRadius: 3 },
  siteName: { fontFamily: "'Instrument Serif', serif", fontSize: 18, color: T.ink },
  btn: { padding: '8px 18px', borderRadius: 6, border: 'none', cursor: 'pointer', fontFamily: "'Archivo', sans-serif", fontSize: 14, fontWeight: 600 },
  btnPrimary:   { background: T.rust, color: '#fff' },
  btnSecondary: { background: T.bgDeep, color: T.ink, border: `1px solid ${T.line}` },
  scoreBar: {
    background: T.bgElev, borderBottom: `1px solid ${T.line}`,
    padding: '8px 20px', display: 'flex', alignItems: 'center', gap: 20,
    fontFamily: "'JetBrains Mono', monospace", fontSize: 13, flexShrink: 0,
  },
  gameOver: {
    position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center', gap: 16,
    background: 'rgba(31,26,20,0.82)', color: '#fff', zIndex: 10, borderRadius: 8,
  },
};

// ── Portal auth helpers ───────────────────────────────────────────────────────
function derivePortalUrl() {
  try {
    const u = new URL(window.location.href);
    if (u.hostname.startsWith('games.')) u.hostname = u.hostname.replace('games.', 'portal.');
    else if (u.port === '8084') u.port = '8083';
    else return 'https://portal.outbackelectronics.com.au';
    return u.origin;
  } catch { return 'https://portal.outbackelectronics.com.au'; }
}
const PORTAL_URL = derivePortalUrl();
const { portalApi, usePortalUser } = makePortalHelpers(() => PORTAL_URL);

// ── Auth Modal ────────────────────────────────────────────────────────────────
function AuthModal({ onClose, onLogin }) {
  const [tab, setTab] = useState('login');
  const overlay = { position:'fixed', inset:0, background:'rgba(31,26,20,0.55)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center', padding:16 };
  const box = { background:T.paper, borderRadius:10, padding:32, width:'100%', maxWidth:440, maxHeight:'90vh', overflowY:'auto', position:'relative' };
  const fieldStyle = { display:'flex', flexDirection:'column', gap:4, marginBottom:14 };
  const labelStyle = { fontSize:11, fontWeight:700, letterSpacing:'0.06em', color:T.ink2, textTransform:'uppercase' };
  const inputStyle = { padding:'9px 12px', border:`1px solid ${T.line}`, borderRadius:6, fontSize:14, fontFamily:'inherit', color:T.ink, background:T.bg, outline:'none', width:'100%', boxSizing:'border-box' };

  const [loginEmail, setLoginEmail] = useState('');
  const [loginPass, setLoginPass] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginBusy, setLoginBusy] = useState(false);

  const [regFirst, setRegFirst] = useState('');
  const [regLast, setRegLast] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regAddress, setRegAddress] = useState('');
  const [regUser, setRegUser] = useState('');
  const [regPass, setRegPass] = useState('');
  const [regError, setRegError] = useState('');
  const [regBusy, setRegBusy] = useState(false);

  async function handleLogin(e) {
    e.preventDefault();
    setLoginError(''); setLoginBusy(true);
    const r = await portalApi('/api/portal/auth/login', { method: 'POST', body: JSON.stringify({ email: loginEmail, password: loginPass }) });
    setLoginBusy(false);
    if (r.ok) { onLogin(r.user); onClose(); }
    else { setLoginError(r.message || 'Invalid email or password.'); }
  }

  async function handleRegister(e) {
    e.preventDefault();
    setRegError(''); setRegBusy(true);
    const r = await portalApi('/api/portal/auth/register', { method: 'POST', body: JSON.stringify({ firstName: regFirst, lastName: regLast, email: regEmail, phone: regPhone, address: regAddress, username: regUser, password: regPass }) });
    setRegBusy(false);
    if (r.ok) { onLogin(r.user); onClose(); }
    else { setRegError(r.message || 'Registration failed.'); }
  }

  return (
    <div style={overlay} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={box}>
        <button onClick={onClose} style={{ position:'absolute', top:12, right:12, background:'none', border:'none', cursor:'pointer', fontSize:20, color:T.ink3, lineHeight:1 }} aria-label="Close">×</button>
        <div style={{ display:'flex', gap:0, marginBottom:24, borderBottom:`1px solid ${T.line}` }}>
          {['login','register'].map(t => (
            <button key={t} onClick={() => setTab(t)} style={{ flex:1, padding:'8px 0', background:'none', border:'none', borderBottom: tab===t ? `2px solid ${T.ochre}` : '2px solid transparent', marginBottom:-1, cursor:'pointer', fontFamily:'inherit', fontWeight:600, fontSize:13, color: tab===t ? T.ink : T.ink3, textTransform:'capitalize' }}>
              {t === 'login' ? 'Sign In' : 'Create Account'}
            </button>
          ))}
        </div>

        {tab === 'login' && (
          <form onSubmit={handleLogin}>
            {loginError && <div style={{background:'#fee2e2', border:'1px solid #fca5a5', color:'#991b1b', borderRadius:6, padding:'8px 12px', marginBottom:14, fontSize:13}}>{loginError}</div>}
            <label style={fieldStyle}><span style={labelStyle}>Email address</span><input style={inputStyle} type="email" value={loginEmail} autoComplete="email" onChange={e => setLoginEmail(e.target.value)} required /></label>
            <label style={fieldStyle}><span style={labelStyle}>Password</span><input style={inputStyle} type="password" value={loginPass} autoComplete="current-password" onChange={e => setLoginPass(e.target.value)} required /></label>
            <button type="submit" disabled={loginBusy} style={{ ...css.btn, ...css.btnPrimary, width:'100%', marginTop:8 }}>{loginBusy ? 'Signing in…' : 'Sign in →'}</button>
          </form>
        )}

        {tab === 'register' && (
          <form onSubmit={handleRegister}>
            {regError && <div style={{background:'#fee2e2', border:'1px solid #fca5a5', color:'#991b1b', borderRadius:6, padding:'8px 12px', marginBottom:14, fontSize:13}}>{regError}</div>}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:14 }}>
              <label style={{...fieldStyle, marginBottom:0}}><span style={labelStyle}>First name</span><input style={inputStyle} type="text" value={regFirst} autoComplete="given-name" onChange={e => setRegFirst(e.target.value)} required /></label>
              <label style={{...fieldStyle, marginBottom:0}}><span style={labelStyle}>Last name</span><input style={inputStyle} type="text" value={regLast} autoComplete="family-name" onChange={e => setRegLast(e.target.value)} required /></label>
            </div>
            <label style={fieldStyle}><span style={labelStyle}>Email address</span><input style={inputStyle} type="email" value={regEmail} autoComplete="email" onChange={e => setRegEmail(e.target.value)} required /></label>
            <label style={fieldStyle}><span style={labelStyle}>Phone number</span><input style={inputStyle} type="tel" value={regPhone} autoComplete="tel" onChange={e => setRegPhone(e.target.value)} /></label>
            <label style={fieldStyle}><span style={labelStyle}>Address</span><input style={inputStyle} type="text" value={regAddress} autoComplete="street-address" onChange={e => setRegAddress(e.target.value)} /></label>
            <label style={fieldStyle}><span style={labelStyle}>Username</span><input style={inputStyle} type="text" value={regUser} autoComplete="username" onChange={e => setRegUser(e.target.value)} required /><span style={{fontSize:11, color:T.ink3}}>3–30 chars · letters, numbers, underscores</span></label>
            <label style={fieldStyle}><span style={labelStyle}>Password</span><input style={inputStyle} type="password" value={regPass} autoComplete="new-password" onChange={e => setRegPass(e.target.value)} required /><span style={{fontSize:11, color:T.ink3}}>Minimum 8 characters</span></label>
            <button type="submit" disabled={regBusy} style={{ ...css.btn, ...css.btnPrimary, width:'100%', marginTop:8 }}>{regBusy ? 'Creating account…' : 'Create account →'}</button>
          </form>
        )}

        <p style={{ marginTop:16, fontSize:12, color:T.ink3, textAlign:'center' }}>
          Your account works across the portal and main site.
        </p>
      </div>
    </div>
  );
}

// ── localStorage + server score helpers ──────────────────────────────────────
function getHS(key) {
  try { return parseInt(localStorage.getItem(key) || '0', 10) || 0; } catch { return 0; }
}
// gameId derived from hsKey: 'oe_games_hs_serpent' → 'serpent'
function hsKeyToGameId(key) { return key.replace('oe_games_hs_', ''); }
function saveHS(key, score) {
  try { if (score > getHS(key)) localStorage.setItem(key, String(score)); } catch {}
  // Silently sync to server — succeeds if logged in, no-ops otherwise
  portalApi('/api/portal/game-scores', { method: 'POST', body: JSON.stringify({ gameId: hsKeyToGameId(key), score }) }).catch(() => {});
}
async function fetchServerScores() {
  try {
    const r = await portalApi('/api/portal/game-scores');
    return r.ok ? (r.scores || {}) : {};
  } catch { return {}; }
}

// ── Framework: useKeys ────────────────────────────────────────────────────────
// Returns a ref whose .current is a Set of currently-held key names.
function useKeys(preventDefaults = []) {
  const keys = useRef(new Set());
  useEffect(() => {
    const onDown = (e) => {
      keys.current.add(e.key);
      if (preventDefaults.includes(e.key)) e.preventDefault();
    };
    const onUp = (e) => keys.current.delete(e.key);
    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);
    return () => {
      window.removeEventListener('keydown', onDown);
      window.removeEventListener('keyup', onUp);
    };
  }, []);
  return keys;
}

// ── Framework: useGameLoop ────────────────────────────────────────────────────
// Runs an RAF loop. Calls tick() every tickMs milliseconds, draw() every frame.
// Returns { pause, resume, running }.
function useGameLoop(tick, draw, tickMs = 0) {
  const rafRef    = useRef(null);
  const lastTick  = useRef(0);
  const paused    = useRef(false);

  useEffect(() => {
    const loop = (ts) => {
      rafRef.current = requestAnimationFrame(loop);
      if (paused.current) return;
      if (tickMs > 0) {
        if (ts - lastTick.current >= tickMs) {
          lastTick.current = ts;
          tick(ts);
        }
      } else {
        tick(ts);
      }
      draw(ts);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [tick, draw, tickMs]);

  return {
    pause:  () => { paused.current = true; },
    resume: () => { paused.current = false; },
  };
}

// ── Framework: useResizeCanvas ────────────────────────────────────────────────
// Keeps canvas pixel dimensions in sync with its CSS container size.
function useResizeCanvas(canvasRef, onResize) {
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const apply = () => {
      el.width  = el.parentElement.clientWidth;
      el.height = el.parentElement.clientHeight;
      if (onResize) onResize(el.width, el.height);
    };
    apply();
    window.addEventListener('resize', apply);
    return () => window.removeEventListener('resize', apply);
  }, []);
}

// ── Framework: GameShell ──────────────────────────────────────────────────────
// Renders the score bar + game-over overlay. Children = the canvas area.
function GameShell({ name, hint, scoreSlots, hsKey, score, gameOver, gameWon, onBack, onRestart, children }) {
  const [hs, setHs] = useState(() => getHS(hsKey));

  useEffect(() => {
    if ((gameOver || gameWon) && score > 0) {
      saveHS(hsKey, score);
      setHs(getHS(hsKey));
    }
  }, [gameOver, gameWon]);

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={css.scoreBar}>
        <button style={{ ...css.btn, ...css.btnSecondary, padding: '4px 12px', fontSize: 13 }} onClick={onBack}>
          ← Back
        </button>
        <span style={{ color: T.ink2, marginRight: 4 }}>{name}</span>
        {scoreSlots}
        <span style={{ marginLeft: 'auto', color: T.ink3, fontSize: 12 }}>{hint}</span>
        <span style={{ color: T.ink3 }}>Best: {hs}</span>
      </div>
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        {children}
        {(gameOver || gameWon) && (
          <div style={css.gameOver}>
            <div style={{ fontFamily: "'Instrument Serif', serif", fontSize: 36 }}>
              {gameWon ? 'You Win!' : 'Game Over'}
            </div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 18 }}>Score: {score}</div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 14, color: T.ochre }}>Best: {hs}</div>
            <button style={{ ...css.btn, ...css.btnPrimary, marginTop: 8 }} onClick={onRestart}>Play Again</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// GAME 1: GRID SERPENT
// ══════════════════════════════════════════════════════════════════════════════

const SN_COLS = 25, SN_ROWS = 20, SN_TICK = 120;

function snakeInit() {
  const head = { x: Math.floor(SN_COLS / 2), y: Math.floor(SN_ROWS / 2) };
  const body = [head, { x: head.x - 1, y: head.y }, { x: head.x - 2, y: head.y }];
  return { body, dir: { x: 1, y: 0 }, nextDir: { x: 1, y: 0 }, food: snakeFood(body), score: 0, dead: false, started: false };
}
function snakeFood(body) {
  const occ = new Set(body.map(s => `${s.x},${s.y}`));
  let p;
  do { p = { x: Math.floor(Math.random() * SN_COLS), y: Math.floor(Math.random() * SN_ROWS) }; }
  while (occ.has(`${p.x},${p.y}`));
  return p;
}

function GridSerpent({ onBack }) {
  const canvasRef = useRef(null);
  const st        = useRef(snakeInit());
  const [score, setScore]     = useState(0);
  const [dead, setDead]       = useState(false);

  const keys = useKeys(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight']);

  useResizeCanvas(canvasRef);

  const tick = useCallback(() => {
    const s = st.current;
    if (s.dead || !s.started) return;
    // Apply queued direction from keys (checked in draw loop via keys ref, but direction committed here)
    s.dir = s.nextDir;
    const nx = s.body[0].x + s.dir.x, ny = s.body[0].y + s.dir.y;
    if (nx < 0 || nx >= SN_COLS || ny < 0 || ny >= SN_ROWS || s.body.slice(0,-1).some(b => b.x===nx && b.y===ny)) {
      s.dead = true; setDead(true); return;
    }
    const ate = nx === s.food.x && ny === s.food.y;
    s.body = [{ x: nx, y: ny }, ...s.body];
    if (!ate) s.body.pop();
    else { s.score++; s.food = snakeFood(s.body); setScore(s.score); }
  }, []);

  const draw = useCallback(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    const s = st.current;
    const cw = W / SN_COLS, ch = H / SN_ROWS;

    // Poll keys each frame for direction (smooth input)
    if (!s.dead && s.started) {
      const k = keys.current;
      const cur = s.dir;
      if ((k.has('ArrowUp')    || k.has('w') || k.has('W')) && cur.y === 0) s.nextDir = { x: 0, y: -1 };
      if ((k.has('ArrowDown')  || k.has('s') || k.has('S')) && cur.y === 0) s.nextDir = { x: 0, y:  1 };
      if ((k.has('ArrowLeft')  || k.has('a') || k.has('A')) && cur.x === 0) s.nextDir = { x: -1, y: 0 };
      if ((k.has('ArrowRight') || k.has('d') || k.has('D')) && cur.x === 0) s.nextDir = { x:  1, y: 0 };
    }
    if (!s.started) {
      const k = keys.current;
      if (k.has('ArrowUp')||k.has('ArrowDown')||k.has('ArrowLeft')||k.has('ArrowRight')||k.has('w')||k.has('a')||k.has('s')||k.has('d')) {
        s.started = true;
      }
    }

    ctx.fillStyle = T.bgDeep; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = T.line; ctx.lineWidth = 0.5;
    for (let c = 0; c <= SN_COLS; c++) { ctx.beginPath(); ctx.moveTo(c*cw,0); ctx.lineTo(c*cw,H); ctx.stroke(); }
    for (let r = 0; r <= SN_ROWS; r++) { ctx.beginPath(); ctx.moveTo(0,r*ch); ctx.lineTo(W,r*ch); ctx.stroke(); }

    ctx.fillStyle = T.ochre;
    ctx.beginPath();
    ctx.ellipse(s.food.x*cw+cw/2, s.food.y*ch+ch/2, cw*0.38, ch*0.38, 0, 0, Math.PI*2);
    ctx.fill();

    s.body.forEach((seg, i) => {
      ctx.fillStyle = i === 0 ? T.eucalyptus : '#6a9455';
      ctx.beginPath(); ctx.roundRect(seg.x*cw+1, seg.y*ch+1, cw-2, ch-2, 3); ctx.fill();
      if (i === 0) {
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(seg.x*cw+cw*0.3, seg.y*ch+ch*0.3, 2, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(seg.x*cw+cw*0.7, seg.y*ch+ch*0.3, 2, 0, Math.PI*2); ctx.fill();
      }
    });

    if (!s.started) {
      ctx.fillStyle = 'rgba(31,26,20,0.7)'; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#fff'; ctx.font = `bold 20px Archivo,sans-serif`; ctx.textAlign = 'center';
      ctx.fillText('Press WASD or arrow keys to start', W/2, H/2); ctx.textAlign = 'left';
    }
  }, []);

  useGameLoop(tick, draw, SN_TICK);

  const restart = () => { st.current = snakeInit(); setScore(0); setDead(false); };

  return (
    <GameShell name="Grid Serpent" hint="WASD / Arrow keys" hsKey="oe_games_hs_serpent"
      score={score} gameOver={dead} onBack={onBack} onRestart={restart}
      scoreSlots={<span>Score: <strong>{score}</strong></span>}>
      <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: '100%' }} />
    </GameShell>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// GAME 2: BLOCK DROP
// ══════════════════════════════════════════════════════════════════════════════

const BD_COLS = 10, BD_ROWS = 20;
const PIECES = [
  { cells: [[0,0],[1,0],[2,0],[3,0]], color: '#5bc8e8' },
  { cells: [[0,0],[1,0],[0,1],[1,1]], color: T.ochre   },
  { cells: [[1,0],[0,1],[1,1],[2,1]], color: '#a855f7' },
  { cells: [[0,0],[0,1],[1,1],[2,1]], color: T.rust    },
  { cells: [[2,0],[0,1],[1,1],[2,1]], color: '#f97316' },
  { cells: [[1,0],[2,0],[0,1],[1,1]], color: '#22c55e' },
  { cells: [[0,0],[1,0],[1,1],[2,1]], color: '#ef4444' },
];

function bdRotate(cells) {
  const mx = Math.max(...cells.map(c => c[0]));
  return cells.map(([x,y]) => [mx-y, x]);
}
function bdNorm(cells) {
  const mn = Math.min(...cells.map(c => c[0])), mr = Math.min(...cells.map(c => c[1]));
  return cells.map(([x,y]) => [x-mn, y-mr]);
}
function bdRandPiece() { const p = PIECES[Math.floor(Math.random()*PIECES.length)]; return { cells: p.cells.map(c=>[...c]), color: p.color }; }
function bdCanPlace(board, cells, px, py) {
  return cells.every(([cx,cy]) => { const nx=px+cx,ny=py+cy; if(nx<0||nx>=BD_COLS||ny>=BD_ROWS) return false; if(ny<0) return true; return board[ny][nx]===null; });
}
function bdDropInterval(level) { return Math.max(80, 700-(level-1)*60); }

function bdDrawCell(ctx, x, y, w, h, color) {
  ctx.fillStyle = color; ctx.fillRect(x+1, y+1, w-2, h-2);
  ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fillRect(x+1, y+1, w-2, 3); ctx.fillRect(x+1, y+1, 3, h-2);
  ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.fillRect(x+1, y+h-4, w-2, 3); ctx.fillRect(x+w-4, y+1, 3, h-2);
}

function bdInit() {
  return {
    board: Array.from({length:BD_ROWS}, ()=>Array(BD_COLS).fill(null)),
    piece: bdRandPiece(), px: Math.floor(BD_COLS/2)-1, py: 0,
    next: bdRandPiece(), score: 0, lines: 0, level: 1,
    dead: false, started: false,
  };
}

function BlockDrop({ onBack }) {
  const canvasRef  = useRef(null);
  const nextRef    = useRef(null);
  const st         = useRef(bdInit());
  const lastDrop   = useRef(0);
  const [score, setScore]   = useState(0);
  const [lines, setLines]   = useState(0);
  const [dead, setDead]     = useState(false);

  const keys = useKeys(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown',' ']);

  useResizeCanvas(canvasRef);

  // track which keys were already handled to avoid repeat
  const prevKeys = useRef(new Set());

  const justPressed = (key) => keys.current.has(key) && !prevKeys.current.has(key);

  const lock = useCallback(() => {
    const s = st.current;
    const nb = s.board.map(r=>[...r]);
    s.piece.cells.forEach(([cx,cy])=>{ const nx=s.px+cx,ny=s.py+cy; if(ny>=0) nb[ny][nx]=s.piece.color; });
    const kept = nb.filter(row=>row.some(c=>c===null));
    const cleared = BD_ROWS-kept.length;
    s.board = [...Array.from({length:cleared},()=>Array(BD_COLS).fill(null)), ...kept];
    if (cleared>0) {
      const pts=[0,100,300,500,800][cleared]*s.level;
      s.score+=pts; s.lines+=cleared; s.level=Math.floor(s.lines/10)+1;
      setScore(s.score); setLines(s.lines);
    }
    s.piece=s.next; s.next=bdRandPiece(); s.px=Math.floor(BD_COLS/2)-1; s.py=0;
    if (!bdCanPlace(s.board,s.piece.cells,s.px,s.py)) { s.dead=true; setDead(true); }
  }, []);

  const tick = useCallback((ts) => {
    const s = st.current;
    if (s.dead) return;

    // Snapshot which keys are pressed now vs last frame
    const cur = new Set(keys.current);
    const prev = prevKeys.current;

    if (!s.started) {
      if (cur.size > 0) s.started = true;
      prevKeys.current = cur; return;
    }

    if (justPressed('ArrowLeft'))  { if (bdCanPlace(s.board,s.piece.cells,s.px-1,s.py)) s.px--; }
    if (justPressed('ArrowRight')) { if (bdCanPlace(s.board,s.piece.cells,s.px+1,s.py)) s.px++; }
    if (justPressed('ArrowUp')) {
      const rot = bdNorm(bdRotate(s.piece.cells));
      for (const kick of [0,-1,1,-2,2]) {
        if (bdCanPlace(s.board,rot,s.px+kick,s.py)) { s.piece={...s.piece,cells:rot}; s.px+=kick; break; }
      }
    }
    if (justPressed(' ')) {
      let dy=0; while(bdCanPlace(s.board,s.piece.cells,s.px,s.py+dy+1)) dy++;
      s.score+=dy*2; s.py+=dy; setScore(s.score); lock(); lastDrop.current=ts; prevKeys.current=cur; return;
    }

    const soft = cur.has('ArrowDown');
    const interval = soft ? 50 : bdDropInterval(s.level);
    if (ts - lastDrop.current >= interval) {
      lastDrop.current = ts;
      if (bdCanPlace(s.board,s.piece.cells,s.px,s.py+1)) s.py++;
      else lock();
    }

    prevKeys.current = cur;
  }, [lock]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ncanvas = nextRef.current;
    const ctx = canvas.getContext('2d');
    const W=canvas.width, H=canvas.height;
    const cw=W/BD_COLS, ch=H/BD_ROWS;
    const s = st.current;

    ctx.fillStyle='#1a1a2e'; ctx.fillRect(0,0,W,H);
    ctx.strokeStyle='rgba(255,255,255,0.04)'; ctx.lineWidth=1;
    for(let c=0;c<BD_COLS;c++) for(let r=0;r<BD_ROWS;r++) ctx.strokeRect(c*cw,r*ch,cw,ch);

    s.board.forEach((row,r)=>row.forEach((col,c)=>{ if(col) bdDrawCell(ctx,c*cw,r*ch,cw,ch,col); }));

    // Ghost
    let gy=s.py; while(bdCanPlace(s.board,s.piece.cells,s.px,gy+1)) gy++;
    if (gy!==s.py) s.piece.cells.forEach(([cx,cy])=>{
      ctx.fillStyle='rgba(255,255,255,0.12)';
      ctx.fillRect((s.px+cx)*cw+1,(gy+cy)*ch+1,cw-2,ch-2);
    });

    s.piece.cells.forEach(([cx,cy])=>{
      if(s.py+cy>=0) bdDrawCell(ctx,(s.px+cx)*cw,(s.py+cy)*ch,cw,ch,s.piece.color);
    });

    if (!s.started) {
      ctx.fillStyle='rgba(0,0,0,0.7)'; ctx.fillRect(0,0,W,H);
      ctx.fillStyle='#fff'; ctx.font=`bold 16px Archivo,sans-serif`; ctx.textAlign='center';
      ctx.fillText('Press any key to start',W/2,H/2); ctx.textAlign='left';
    }

    // Next piece preview
    if (ncanvas) {
      const nc = ncanvas.getContext('2d');
      ncanvas.width=100; ncanvas.height=100;
      nc.fillStyle=T.bgDeep; nc.fillRect(0,0,100,100);
      const cells=bdNorm(s.next.cells);
      const mx=Math.max(...cells.map(c=>c[0]))+1, my=Math.max(...cells.map(c=>c[1]))+1;
      const cs=Math.min(100/(mx+2),100/(my+2));
      const ox=(100-mx*cs)/2, oy=(100-my*cs)/2;
      cells.forEach(([cx,cy])=>bdDrawCell(nc,ox+cx*cs,oy+cy*cs,cs,cs,s.next.color));
    }
  }, []);

  useGameLoop(tick, draw, 16);

  const restart = () => {
    st.current=bdInit(); lastDrop.current=0; prevKeys.current=new Set();
    setScore(0); setLines(0); setDead(false);
  };

  return (
    <GameShell name="Block Drop" hint="←→ Move · ↑ Rotate · ↓ Soft · Space Hard drop"
      hsKey="oe_games_hs_blockdrop" score={score} gameOver={dead} onBack={onBack} onRestart={restart}
      scoreSlots={<><span>Score: <strong>{score}</strong></span><span>Lines: <strong>{lines}</strong></span></>}>
      <div style={{ flex:1, display:'flex', justifyContent:'center', alignItems:'flex-start', gap:20, padding:16, background:T.bgDeep, height:'100%', boxSizing:'border-box' }}>
        <div style={{ position:'relative', display:'flex', height:'100%', alignItems:'stretch' }}>
          <canvas ref={canvasRef} style={{ display:'block', border:`2px solid ${T.line}`, borderRadius:4, maxHeight:'100%', width:'auto' }} />
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:12, minWidth:110 }}>
          <div style={{ background:T.paper, border:`1px solid ${T.line}`, borderRadius:8, padding:12 }}>
            <div style={{ fontSize:11, fontWeight:700, color:T.ink3, textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:8 }}>Next</div>
            <canvas ref={nextRef} style={{ display:'block' }} />
          </div>
        </div>
      </div>
    </GameShell>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// GAME 3: ORBIT BREAKER
// ══════════════════════════════════════════════════════════════════════════════

const OB_PW=90, OB_PH=10, OB_BR=7, OB_BRICK_ROWS=6, OB_BRICK_COLS=10;

function obInit(W, H) {
  const bw=W/OB_BRICK_COLS, bh=22, bp=2;
  const bricks=[];
  for(let r=0;r<OB_BRICK_ROWS;r++) for(let c=0;c<OB_BRICK_COLS;c++) {
    const hp=r<2?1:r<4?2:3;
    bricks.push({x:c*bw,y:50+r*(bh+bp),w:bw-bp,h:bh,hp,max:hp});
  }
  const a=Math.PI/4+Math.random()*Math.PI/2;
  return { bricks, px:W/2-OB_PW/2, py:H-40, ball:{x:W/2,y:H-60,vx:4*Math.cos(a),vy:-4*Math.sin(a)},
    score:0, dead:false, won:false, started:false, speedMult:1, hits:0, W, H };
}
function obBrickColor(hp,max) {
  if(max===1) return T.eucalyptus;
  if(max===2) return hp===2?T.ochre:'#b87a1a';
  return hp===3?'#ef4444':hp===2?'#c44':'#922';
}

function OrbitBreaker({ onBack }) {
  const canvasRef  = useRef(null);
  const st         = useRef(null);
  const mouseX     = useRef(null);
  const [score, setScore] = useState(0);
  const [dead, setDead]   = useState(false);
  const [won, setWon]     = useState(false);

  const keys = useKeys(['ArrowLeft','ArrowRight']);

  useResizeCanvas(canvasRef, (W,H) => {
    st.current = obInit(W,H);
    setDead(false); setWon(false); setScore(0);
  });

  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const onMove = (e) => {
      const r=canvas.getBoundingClientRect();
      mouseX.current=(e.clientX-r.left)*(canvas.width/r.width);
      if(st.current&&!st.current.started) st.current.started=true;
    };
    const onTouch = (e) => {
      e.preventDefault();
      const r=canvas.getBoundingClientRect();
      mouseX.current=(e.touches[0].clientX-r.left)*(canvas.width/r.width);
      if(st.current&&!st.current.started) st.current.started=true;
    };
    canvas.addEventListener('mousemove',onMove);
    canvas.addEventListener('touchmove',onTouch,{passive:false});
    return () => { canvas.removeEventListener('mousemove',onMove); canvas.removeEventListener('touchmove',onTouch); };
  }, []);

  const tick = useCallback(() => {
    const s=st.current; if(!s||s.dead||s.won||!s.started) return;
    const {W,H}=s;

    // Keyboard starts game
    if(keys.current.has('ArrowLeft')||keys.current.has('ArrowRight')) s.started=true;
    if(keys.current.has('ArrowLeft'))  s.px=Math.max(0,s.px-6);
    if(keys.current.has('ArrowRight')) s.px=Math.min(W-OB_PW,s.px+6);
    if(mouseX.current!==null) {
      const target=mouseX.current-OB_PW/2;
      s.px+=Math.sign(target-s.px)*Math.min(Math.abs(target-s.px),10);
      s.px=Math.max(0,Math.min(W-OB_PW,s.px));
    }

    s.ball.x+=s.ball.vx*s.speedMult; s.ball.y+=s.ball.vy*s.speedMult;
    if(s.ball.x-OB_BR<=0){s.ball.x=OB_BR;s.ball.vx=Math.abs(s.ball.vx);}
    if(s.ball.x+OB_BR>=W){s.ball.x=W-OB_BR;s.ball.vx=-Math.abs(s.ball.vx);}
    if(s.ball.y-OB_BR<=0){s.ball.y=OB_BR;s.ball.vy=Math.abs(s.ball.vy);}
    if(s.ball.y+OB_BR>H){s.dead=true;setDead(true);return;}

    if(s.ball.vy>0&&s.ball.y+OB_BR>=s.py&&s.ball.y+OB_BR<=s.py+OB_PH+6&&s.ball.x>=s.px&&s.ball.x<=s.px+OB_PW){
      const hit=(s.ball.x-s.px)/OB_PW, ang=(hit-0.5)*Math.PI*0.7;
      const spd=Math.hypot(s.ball.vx,s.ball.vy);
      s.ball.vx=spd*Math.sin(ang); s.ball.vy=-spd*Math.cos(ang);
      s.ball.y=s.py-OB_BR-1;
    }

    let bounced=false;
    for(let i=s.bricks.length-1;i>=0;i--){
      const b=s.bricks[i];
      const nx=Math.max(b.x,Math.min(s.ball.x,b.x+b.w)), ny=Math.max(b.y,Math.min(s.ball.y,b.y+b.h));
      const dx=s.ball.x-nx, dy=s.ball.y-ny;
      if(dx*dx+dy*dy<OB_BR*OB_BR){
        b.hp--;
        if(b.hp<=0){s.score+=b.max*10;s.bricks.splice(i,1);}else s.score+=5;
        setScore(s.score);
        s.hits++;
        if(s.hits%10===0) s.speedMult=Math.min(2.5,s.speedMult+0.1);
        if(!bounced){
          if(Math.abs(dx)<Math.abs(dy)) s.ball.vx*=-1; else s.ball.vy*=-1;
          bounced=true;
        }
      }
    }
    if(s.bricks.length===0){s.won=true;setWon(true);}
  }, []);

  const draw = useCallback(() => {
    const canvas=canvasRef.current; if(!canvas) return;
    const ctx=canvas.getContext('2d');
    const W=canvas.width, H=canvas.height;
    const s=st.current; if(!s) return;

    ctx.fillStyle='#0f0f1e'; ctx.fillRect(0,0,W,H);
    ctx.fillStyle='rgba(255,255,255,0.3)';
    for(let i=0;i<60;i++) ctx.fillRect((i*137+17)%W,(i*97+53)%H,1,1);

    s.bricks.forEach(b=>{
      ctx.fillStyle=obBrickColor(b.hp,b.max);
      ctx.beginPath(); ctx.roundRect(b.x+1,b.y+1,b.w-2,b.h-2,3); ctx.fill();
      if(b.max>1) { ctx.fillStyle='rgba(255,255,255,0.4)'; for(let i=0;i<b.hp;i++) ctx.fillRect(b.x+4+i*7,b.y+b.h-6,5,3); }
    });

    const g=ctx.createLinearGradient(s.px,s.py,s.px,s.py+OB_PH);
    g.addColorStop(0,'#6ab4ff'); g.addColorStop(1,T.rust);
    ctx.fillStyle=g; ctx.beginPath(); ctx.roundRect(s.px,s.py,OB_PW,OB_PH,5); ctx.fill();

    const bg=ctx.createRadialGradient(s.ball.x-2,s.ball.y-2,1,s.ball.x,s.ball.y,OB_BR);
    bg.addColorStop(0,'#fff'); bg.addColorStop(1,'#aad4ff');
    ctx.save(); ctx.shadowColor='#4af'; ctx.shadowBlur=12;
    ctx.fillStyle=bg; ctx.beginPath(); ctx.arc(s.ball.x,s.ball.y,OB_BR,0,Math.PI*2); ctx.fill();
    ctx.restore();

    if(!s.started){
      ctx.fillStyle='rgba(0,0,0,0.65)'; ctx.fillRect(0,0,W,H);
      ctx.fillStyle='#fff'; ctx.font=`bold 18px Archivo,sans-serif`; ctx.textAlign='center';
      ctx.fillText('Move mouse or use ← → keys to start',W/2,H/2); ctx.textAlign='left';
    }
  }, []);

  useGameLoop(tick, draw);

  const restart = () => {
    const c=canvasRef.current; if(c) st.current=obInit(c.width,c.height);
    mouseX.current=null; setDead(false); setWon(false); setScore(0);
  };

  return (
    <GameShell name="Orbit Breaker" hint="Mouse or ← → keys"
      hsKey="oe_games_hs_orbit" score={score} gameOver={dead} gameWon={won} onBack={onBack} onRestart={restart}
      scoreSlots={<span>Score: <strong>{score}</strong></span>}>
      <canvas ref={canvasRef} style={{ display:'block', width:'100%', height:'100%', cursor:'none' }} />
    </GameShell>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// GAME 4: NED KELLY — THE LEGEND
// A narrative 2D adventure. Four acts. Multiple endings.
// ══════════════════════════════════════════════════════════════════════════════

// ── Palettes ──────────────────────────────────────────────────────────────────
const NKP = {
  stringybark: {
    sky: [['#b89050','0%'],['#d4aa68','40%'],['#e8c880','70%'],['#f0d890','100%']],
    ground: '#3d2a10', hill: '#2a3c18', tree: '#1e3012', fog: 'rgba(210,180,100,0.15)',
    light: 'rgba(255,200,80,0.06)',
  },
  euroa: {
    sky: [['#9e3a18','0%'],['#c85830','30%'],['#e07840','60%'],['#f0a050','100%']],
    ground: '#6a4520', hill: '#7a5828', tree: '#5a4020', fog: 'rgba(200,120,50,0.12)',
    light: 'rgba(255,160,60,0.08)',
  },
  jerilderie: {
    sky: [['#c8b860','0%'],['#ddd090','40%'],['#ede8b0','70%'],['#f8f4c8','100%']],
    ground: '#8a6840', hill: '#a07848', tree: '#786040', fog: 'rgba(230,210,150,0.18)',
    light: 'rgba(255,240,160,0.10)',
  },
  glenrowan: {
    sky: [['#04060a','0%'],['#080c12','50%'],['#100c16','100%']],
    ground: '#0e0908', hill: '#0a0c08', tree: '#060806', fog: 'rgba(160,40,10,0.22)',
    light: 'rgba(220,80,20,0.12)',
  },
};

// ── Act metadata ──────────────────────────────────────────────────────────────
const NK_ACTS = [
  {
    id: 'stringybark', title: 'Act I', subtitle: 'Stringybark Creek', year: 'October 1878',
    desc: 'The Wombat Ranges. Four police troopers have tracked the Kelly Gang to their camp. There is nowhere left to run.',
    sceneWidth: 2800, groundFrac: 0.72,
    npcs: [
      { id: 'dan',      x: 340,  label: 'Dan Kelly',       coat: '#3a2a10', hat: '#1a0e08' },
      { id: 'joe',      x: 620,  label: 'Joe Byrne',       coat: '#2a2010', hat: '#0e0c06' },
      { id: 'mcintyre', x: 1300, label: 'Cst. McIntyre',   coat: '#8a2010', hat: '#1a0a04' },
      { id: 'kennedy',  x: 1700, label: 'Sgt. Kennedy',    coat: '#8a2010', hat: '#1a0a04' },
    ],
  },
  {
    id: 'euroa', title: 'Act II', subtitle: 'Euroa', year: 'December 1878',
    desc: 'The gang rides into Euroa. The National Bank holds the district payroll. Word has not yet reached the police.',
    sceneWidth: 3000, groundFrac: 0.74,
    npcs: [
      { id: 'steve',   x: 420,  label: 'Steve Hart',     coat: '#3a2a10', hat: '#1a1208' },
      { id: 'manager', x: 1350, label: 'Bank Manager',   coat: '#304060', hat: '#1a2030' },
      { id: 'teller',  x: 1780, label: 'Mrs. Scott',     coat: '#5a4030', hat: '#2a1818' },
    ],
  },
  {
    id: 'jerilderie', title: 'Act III', subtitle: 'Jerilderie', year: 'February 1879',
    desc: 'A bigger plan. Take the police station, rob the bank. And deliver a message to the whole colony.',
    sceneWidth: 3200, groundFrac: 0.73,
    npcs: [
      { id: 'joe2',      x: 400,  label: 'Joe Byrne',        coat: '#2a2010', hat: '#0e0c06' },
      { id: 'constable', x: 1050, label: 'Cst. Devine',      coat: '#8a2010', hat: '#1a0a04' },
      { id: 'printer',   x: 1850, label: 'Edwin Living',     coat: '#304848', hat: '#182020' },
    ],
  },
  {
    id: 'glenrowan', title: 'Act IV', subtitle: 'Glenrowan', year: 'June 1880',
    desc: 'The inn. The rain. The police train. Someone has already talked.',
    sceneWidth: 2600, groundFrac: 0.70,
    npcs: [
      { id: 'ann',  x: 480,  label: 'Ann Jones',    coat: '#3a2820', hat: '#1a1210' },
      { id: 'hare', x: 1450, label: 'Supt. Hare',   coat: '#8a2010', hat: '#1a0a04' },
    ],
  },
];

// ── Dialogue tree ─────────────────────────────────────────────────────────────
const NK_NODES = {
  // Act 1
  dan_greet: {
    speaker: 'Dan Kelly', portrait: 'gang',
    text: "Ned. The troopers have been following us for two days. McIntyre and Kennedy are camped just past the ridge. Lonigan too.",
    choices: [
      { text: "We'll face them. No more running.", next: 'dan_b', notoriety: 5 },
      { text: "Maybe we can talk our way out.", next: 'dan_c', trust: 5 },
    ],
  },
  dan_b: {
    speaker: 'Dan Kelly', portrait: 'gang',
    text: "That's what I figured you'd say. Joe's ready. Just say the word.",
    choices: [{ text: "Let me speak to Joe first.", next: null }],
  },
  dan_c: {
    speaker: 'Dan Kelly', portrait: 'gang',
    text: "Talk? To the men that arrested Mum for something she didn't do? Ned, there's no talking left.",
    choices: [{ text: "You're right. Let me find Joe.", next: null }],
  },
  joe_greet: {
    speaker: 'Joe Byrne', portrait: 'gang',
    text: "Lonigan's with them. You know what he'll do when he sees you — remember what he did in Benalla gaol.",
    choices: [
      { text: "I remember everything.", next: 'joe_b', notoriety: 5 },
      { text: "I don't want anyone dead, Joe.", next: 'joe_c', loyalty: 5 },
    ],
  },
  joe_b: {
    speaker: 'Joe Byrne', portrait: 'gang',
    text: "Then you know what has to happen out there. I'll back you, whatever you decide.",
    choices: [{ text: "Let's go.", next: null }],
  },
  joe_c: {
    speaker: 'Joe Byrne', portrait: 'gang',
    text: "I don't either. But Ned — they won't give us the same courtesy. Be ready for anything.",
    choices: [{ text: "I hear you.", next: null }],
  },
  mcintyre_greet: {
    speaker: 'Constable McIntyre', portrait: 'police',
    text: "Kelly! I know you're in there. Come out. Sergeant Kennedy only wants to talk — man to man.",
    choices: [
      { text: "Then let him come out alone. Unarmed.", next: 'mcintyre_b', trust: 5 },
      { text: "We've had enough of your conversations.", next: 'mcintyre_c', notoriety: 10 },
      { text: "[Step into the clearing]", next: null, standoff: 'stringybark' },
    ],
  },
  mcintyre_b: {
    speaker: 'Constable McIntyre', portrait: 'police',
    text: "Kelly, be reasonable. There is still a way through this that doesn't end with someone dying today.",
    choices: [
      { text: "[Step out to meet them]", next: null, standoff: 'stringybark' },
    ],
  },
  mcintyre_c: {
    speaker: 'Constable McIntyre', portrait: 'police',
    text: "Don't make this any worse than it already—",
    choices: [
      { text: "[Enough talk.]", next: null, standoff: 'stringybark' },
    ],
  },
  kennedy_greet: {
    speaker: 'Sergeant Kennedy', portrait: 'police',
    text: "Ned Kelly. You've made your point. Stand down now and I'll personally see you get a fair hearing in Melbourne.",
    choices: [
      { text: "A fair hearing? Like the one my mother got?", next: 'kennedy_b', notoriety: 5 },
      { text: "I want that in writing, Kennedy.", next: 'kennedy_c', trust: 10 },
    ],
  },
  kennedy_b: {
    speaker: 'Sergeant Kennedy', portrait: 'police',
    text: "That is not what this is about. This is about what happens in the next five minutes. Your choice.",
    choices: [
      { text: "[Draw]", next: null, standoff: 'kennedy' },
    ],
  },
  kennedy_c: {
    speaker: 'Sergeant Kennedy', portrait: 'police',
    text: "I cannot put it in writing out here. But you have my word as a father and as a man.",
    choices: [
      { text: "Your word. That'll have to do.", next: null, standoff: 'kennedy' },
      { text: "Alright. I'm laying down my rifle.", next: 'kennedy_surrender', trust: 20, flag: 'surrendered_act1' },
    ],
  },
  kennedy_surrender: {
    speaker: 'Sergeant Kennedy', portrait: 'police',
    text: "...I wasn't expecting that. You're making the right decision.",
    choices: [{ text: "[Continue]", next: null, advanceAct: true }],
  },

  // Act 2
  steve_greet: {
    speaker: 'Steve Hart', portrait: 'gang',
    text: "Ned, I count at least a dozen people inside. We should move fast — in, take the cash, out before word spreads.",
    choices: [
      { text: "Fast and clean. Nobody gets hurt.", next: 'steve_b', trust: 5 },
      { text: "We take our time. Do it right.", next: 'steve_c', notoriety: 5 },
    ],
  },
  steve_b: {
    speaker: 'Steve Hart', portrait: 'gang',
    text: "Right. I'll hold the door. Joe's round back. Just say go.",
    choices: [{ text: "Go.", next: null }],
  },
  steve_c: {
    speaker: 'Steve Hart', portrait: 'gang',
    text: "They'll remember this either way. Let's make it count.",
    choices: [{ text: "Move.", next: null }],
  },
  manager_greet: {
    speaker: 'Bank Manager', portrait: 'civilian',
    text: "Please — there are women here. Children. Whatever you want — just take it. Don't hurt anyone.",
    choices: [
      { text: "No one gets hurt if everyone stays calm.", next: 'manager_b', trust: 10 },
      { text: "Open the safe. Now.", next: 'manager_c', notoriety: 10 },
      { text: "I'm not here to harm civilians. But I will if I have to.", next: 'manager_d' },
    ],
  },
  manager_b: {
    speaker: 'Bank Manager', portrait: 'civilian',
    text: "Yes... yes, alright. The safe key is in my desk drawer. I'll take you there myself.",
    choices: [{ text: "Lead the way.", next: null }],
  },
  manager_c: {
    speaker: 'Bank Manager', portrait: 'civilian',
    text: "I — yes. Yes, of course—",
    choices: [{ text: "[Follow him]", next: null }],
  },
  manager_d: {
    speaker: 'Bank Manager', portrait: 'civilian',
    text: "I believe you. God help me, but I believe you.",
    choices: [{ text: "Smart man.", next: null }],
  },
  teller_greet: {
    speaker: 'Mrs. Scott', portrait: 'civilian',
    text: "Are you really Ned Kelly? You're not what I imagined.",
    choices: [
      { text: "What did you imagine?", next: 'teller_b' },
      { text: "I don't have time for this, ma'am.", next: 'teller_c', notoriety: 5 },
    ],
  },
  teller_b: {
    speaker: 'Mrs. Scott', portrait: 'civilian',
    text: "A monster, I suppose. The papers say... things. But you seem just... tired.",
    choices: [
      { text: "I am tired. That's exactly right.", next: 'teller_d', trust: 10 },
      { text: "Don't be fooled. I'm dangerous when I need to be.", next: 'teller_e', notoriety: 5 },
    ],
  },
  teller_c: {
    speaker: 'Mrs. Scott', portrait: 'civilian',
    text: "...Of course. Forgive me.",
    choices: [{ text: "[Move on]", next: null, advanceAct: true }],
  },
  teller_d: {
    speaker: 'Mrs. Scott', portrait: 'civilian',
    text: "They don't write about the tiredness. They ought to.",
    choices: [{ text: "[Continue]", next: null, advanceAct: true }],
  },
  teller_e: {
    speaker: 'Mrs. Scott', portrait: 'civilian',
    text: "Yes. I can see that too.",
    choices: [{ text: "[Continue]", next: null, advanceAct: true }],
  },

  // Act 3
  joe2_greet: {
    speaker: 'Joe Byrne', portrait: 'gang',
    text: "I finished the letter, Ned. Every word. But you should read it — it says everything. Your mother. The police. What they've done. It's the truth and the whole colony needs to hear it.",
    choices: [
      { text: "Read me the part about the Fitzpatrick business.", next: 'joe2_b' },
      { text: "Does it sound like me?", next: 'joe2_c', loyalty: 5 },
    ],
  },
  joe2_b: {
    speaker: 'Joe Byrne', portrait: 'gang',
    text: '"I am a widow\'s son, outlawed, and my orders must be obeyed." Strong enough?',
    choices: [
      { text: "Add this: we are not murderers. We are men with no other choice.", next: 'joe2_mercy', trust: 15, flag: 'letter_mercy' },
      { text: "Keep it fierce. Let the whole colony know what they've made us.", next: 'joe2_fire', notoriety: 10, flag: 'letter_fire' },
    ],
  },
  joe2_c: {
    speaker: 'Joe Byrne', portrait: 'gang',
    text: "It sounds like the best of you. The angry part and the just part, together.",
    choices: [
      { text: "Then send it. Word for word.", next: 'joe2_balanced', trust: 10, loyalty: 5, flag: 'letter_balanced' },
    ],
  },
  joe2_mercy: {
    speaker: 'Joe Byrne', portrait: 'gang',
    text: "I'll add it. For what it's worth — I think that's right. We're not them.",
    choices: [{ text: "No. We're not.", next: null }],
  },
  joe2_fire: {
    speaker: 'Joe Byrne', portrait: 'gang',
    text: "Fierce it is. Let them be afraid of what they've made us.",
    choices: [{ text: "Let's finish this.", next: null }],
  },
  joe2_balanced: {
    speaker: 'Joe Byrne', portrait: 'gang',
    text: "Word for word. The people will decide what it means.",
    choices: [{ text: "Good.", next: null }],
  },
  constable_greet: {
    speaker: 'Constable Devine', portrait: 'police',
    text: "This can't — you're in the police station. You're standing in the police station—",
    choices: [
      { text: "Your station is ours tonight. Sit down. No one's hurt.", next: 'constable_b', trust: 5 },
      { text: "Lock him in the cell, Joe.", next: 'constable_c', notoriety: 5 },
    ],
  },
  constable_b: {
    speaker: 'Constable Devine', portrait: 'police',
    text: "...You're going to let us live?",
    choices: [{ text: "I've never wanted to kill anyone, Devine.", next: null, trust: 5 }],
  },
  constable_c: {
    speaker: 'Joe Byrne', portrait: 'gang',
    text: "Move, copper.",
    choices: [{ text: "[Continue]", next: null }],
  },
  printer_greet: {
    speaker: 'Edwin Living', portrait: 'civilian',
    text: "You want me to print this? All of it? Do you understand what they will do to me when they find out?",
    choices: [
      { text: "Print it. You'll be remembered well for it.", next: 'printer_b', trust: 10 },
      { text: "Print it or there'll be consequences.", next: 'printer_c', notoriety: 10 },
    ],
  },
  printer_b: {
    speaker: 'Edwin Living', portrait: 'civilian',
    text: "Remembered well... I suppose there are worse fates. Alright, Kelly. I'll print it.",
    choices: [{ text: "[Continue]", next: null, advanceAct: true }],
  },
  printer_c: {
    speaker: 'Edwin Living', portrait: 'civilian',
    text: "Fine. Fine. But don't come back here.",
    choices: [{ text: "[Continue]", next: null, advanceAct: true }],
  },

  // Act 4
  ann_greet: {
    speaker: 'Ann Jones', portrait: 'civilian',
    text: "Ned — Curnow got out. He flagged down the police train with a candle and a red scarf. They know we're here. I can hear them in the trees right now.",
    choices: [
      { text: "How many?", next: 'ann_b' },
      { text: "Get every civilian out through the back. Now.", next: 'ann_c', trust: 15 },
    ],
  },
  ann_b: {
    speaker: 'Ann Jones', portrait: 'civilian',
    text: "Fifty. Maybe more. The boys are asking what to do. The armor's ready but—",
    choices: [
      { text: "We fight. Put it on.", next: 'ann_fight', notoriety: 15, flag: 'donned_armor' },
      { text: "Get the people out first. Then we decide.", next: 'ann_c', trust: 10 },
    ],
  },
  ann_c: {
    speaker: 'Ann Jones', portrait: 'civilian',
    text: "The people... yes. Come on, out through the back. Hurry now.",
    choices: [
      { text: "[Help them out, then put on the armor]", next: 'ann_fight', trust: 10, notoriety: 5, flag: 'donned_armor', flag2: 'saved_civilians' },
    ],
  },
  ann_fight: {
    speaker: 'Ann Jones', portrait: 'civilian',
    text: "God be with you, Ned Kelly.",
    choices: [{ text: "And with the people of this country.", next: 'hare_greet' }],
  },
  hare_greet: {
    speaker: 'Supt. Hare', portrait: 'police',
    text: "KELLY! It's finished. Every road out is covered. Come out now and your men will not be shot. I give you my word.",
    choices: [
      { text: "Then we'll die on our feet.", next: null, standoff: 'glenrowan' },
      { text: "What guarantee do my men have?", next: 'hare_negotiate' },
      { text: "[Walk out, hands raised]", next: 'hare_surrender', trust: 20, flag: 'surrendered_glenrowan' },
    ],
  },
  hare_negotiate: {
    speaker: 'Supt. Hare', portrait: 'police',
    text: "I cannot speak for the courts, Kelly. But they won't be shot coming out. You have my word on that.",
    choices: [
      { text: "Your word. Same word Kennedy gave me.", next: null, standoff: 'glenrowan' },
      { text: "Alright. We're coming out.", next: 'hare_surrender', trust: 15, flag: 'surrendered_glenrowan' },
    ],
  },
  hare_surrender: {
    speaker: 'Supt. Hare', portrait: 'police',
    text: "Hold your fire! Kelly's surrendering — hold your fire, all units!",
    choices: [{ text: "[Walk forward]", next: null, advanceAct: true }],
  },
};

// ── Standoff configs ──────────────────────────────────────────────────────────
const NK_STANDOFFS = {
  stringybark: {
    title: 'Stringybark Creek',
    subtitle: '1878  —  Three armed men. One way out.',
    bgColor: '#0e0c06',
    rounds: [
      { label: 'Constable Lonigan', hint: 'He reaches for his pistol—', sweetStart: 0.18, sweetEnd: 0.38, speed: 1.0, color: '#c84820' },
      { label: 'Constable Scanlan', hint: 'He swings his rifle up—',    sweetStart: 0.52, sweetEnd: 0.70, speed: 1.5, color: '#c84820' },
    ],
    winFlag: 'won_stringybark', loseFlag: 'lost_stringybark',
  },
  kennedy: {
    title: 'Stringybark Creek',
    subtitle: 'Sergeant Kennedy  —  a fair man in an unfair situation.',
    bgColor: '#0e0c06',
    rounds: [
      { label: 'Sergeant Kennedy', hint: 'A long silence. Then his hand moves—', sweetStart: 0.28, sweetEnd: 0.54, speed: 0.9, color: '#a03010' },
    ],
    winFlag: 'won_kennedy', loseFlag: 'lost_kennedy',
  },
  glenrowan: {
    title: 'Glenrowan',
    subtitle: 'June 1880  —  The last stand.',
    bgColor: '#05070e',
    rounds: [
      { label: 'First volley',       hint: 'The police line opens fire—',   sweetStart: 0.12, sweetEnd: 0.32, speed: 1.6, color: '#e04010' },
      { label: 'Second volley',      hint: 'They reload fast—',             sweetStart: 0.60, sweetEnd: 0.78, speed: 2.0, color: '#e04010' },
      { label: 'Superintendent Hare', hint: 'One shot left—',              sweetStart: 0.35, sweetEnd: 0.52, speed: 2.4, color: '#ff6020' },
    ],
    winFlag: 'won_glenrowan', loseFlag: 'lost_glenrowan',
  },
};

// ── Endings ───────────────────────────────────────────────────────────────────
const NK_ENDINGS = {
  martyr: {
    title: 'Such is Life', subtitle: 'The Martyr', color: '#c84820',
    lines: [
      'Ned Kelly was tried at the Melbourne Supreme Court on 28 October 1880.',
      'He was convicted of the murders at Stringybark Creek and sentenced to death.',
      'On the morning of 11 November 1880, he walked to the gallows.',
      'His last recorded words were "Such is life."',
      'He was twenty-five years old.',
      '',
      'The legend was only beginning.',
    ],
  },
  ghost: {
    title: 'Into the Bush', subtitle: 'The Ghost', color: '#2a6a30',
    lines: [
      'They never found him.',
      'For years afterwards, sightings were reported across Victoria and New South Wales.',
      'A figure in a long coat. An iron helmet glimpsed at dusk.',
      'Some said he lived in the high country for decades.',
      'Some said he was never real to begin with — just something the poor needed to believe in.',
      '',
      "Maybe that's enough.",
    ],
  },
  cause: {
    title: 'The Trial', subtitle: 'The Cause', color: '#c8a830',
    lines: [
      'Ned Kelly surrendered at Glenrowan with his hands raised.',
      'His trial became the most watched event in the colony\'s history.',
      'He spoke for three hours without notes.',
      'The Jerilderie Letter was read aloud in court.',
      'The jury convicted him. The people never did.',
      '',
      'He was hanged, but the argument he started was never finished.',
    ],
  },
  betrayed: {
    title: 'The Price of Trust', subtitle: 'The Betrayed', color: '#8a4060',
    lines: [
      'Thomas Curnow slipped out of the Glenrowan Inn while Ned\'s back was turned.',
      'He flagged down the police train with a candle and a red scarf.',
      'Joe Byrne was killed in the first volley.',
      'Dan Kelly and Steve Hart were never found.',
      'Ned was taken alive, barely.',
      '',
      'He had trusted the wrong man. In a life like his, that was all it took.',
    ],
  },
};

function nkCalcEnding(metrics, flags) {
  if (flags.has('surrendered_glenrowan') &&
      (metrics.trust >= 40 || flags.has('letter_mercy') || flags.has('letter_balanced'))) return 'cause';
  if (flags.has('won_glenrowan') && metrics.trust >= 30 && flags.has('saved_civilians')) return 'ghost';
  if (flags.has('lost_stringybark') || (flags.has('lost_kennedy') && flags.has('lost_glenrowan'))) return 'betrayed';
  return 'martyr';
}

// ── Scene rendering ───────────────────────────────────────────────────────────
function nkDrawScene(ctx, W, H, actId, camX, t) {
  const p = NKP[actId];
  const act = NK_ACTS.find(a => a.id === actId);

  // Sky
  const sky = ctx.createLinearGradient(0, 0, 0, H * 0.8);
  p.sky.forEach(([c, stop]) => sky.addColorStop(parseFloat(stop) / 100, c));
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);

  // Stars (Glenrowan only)
  if (actId === 'glenrowan') {
    for (let i = 0; i < 80; i++) {
      const sx = ((i * 337 + 17) % 1000) / 1000 * W;
      const sy = ((i * 193 + 7) % 600) / 600 * H * 0.55;
      ctx.globalAlpha = (0.35 + 0.35 * Math.sin(t * 0.02 + i * 1.3));
      ctx.fillStyle = '#fff';
      ctx.fillRect(sx, sy, 1.5, 1.5);
    }
    ctx.globalAlpha = 1;
  }

  // Far hills
  ctx.fillStyle = p.hill;
  ctx.globalAlpha = 0.55;
  ctx.beginPath();
  for (let x = -200; x <= W + 200; x += 30) {
    const wx = x + camX * 0.15;
    const hy = H * 0.56 + Math.sin(wx * 0.0018) * 55 + Math.sin(wx * 0.0043) * 28;
    x === -200 ? ctx.moveTo(x, hy) : ctx.lineTo(x, hy);
  }
  ctx.lineTo(W + 200, H); ctx.lineTo(-200, H); ctx.closePath(); ctx.fill();

  // Near hills / treeline
  ctx.fillStyle = p.tree;
  ctx.globalAlpha = 0.8;
  ctx.beginPath();
  for (let x = -200; x <= W + 200; x += 20) {
    const wx = x + camX * 0.28;
    const hy = H * 0.63 + Math.sin(wx * 0.0025) * 40 + Math.sin(wx * 0.007) * 18;
    x === -200 ? ctx.moveTo(x, hy) : ctx.lineTo(x, hy);
  }
  ctx.lineTo(W + 200, H); ctx.lineTo(-200, H); ctx.closePath(); ctx.fill();
  ctx.globalAlpha = 1;

  // Trees — Stringybark Creek
  if (actId === 'stringybark') {
    for (let i = 0; i < 22; i++) {
      const tx = ((i * 163) % act.sceneWidth) - camX * 0.55;
      if (tx < -90 || tx > W + 90) continue;
      const th = 110 + (i * 41) % 90;
      const gY = H * act.groundFrac;
      ctx.fillStyle = '#1a1008';
      ctx.fillRect(tx + 7, gY - th, 10, th);
      const leafC = ['#1a2c10','#223816','#2a4a1c','#1e3412','#263c18'];
      for (let l = 0; l < 6; l++) {
        ctx.fillStyle = leafC[l % leafC.length];
        ctx.globalAlpha = 0.82 - l * 0.09;
        ctx.beginPath();
        ctx.ellipse(tx + 12 + (l - 2.5) * 7, gY - th + l * 13, 22 + l * 3, 18 + l * 2, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
  }

  // Buildings — Euroa & Jerilderie
  if (actId === 'euroa' || actId === 'jerilderie') {
    const blds = actId === 'euroa'
      ? [{ x:580,  w:180, h:120, c:'#8a6040' },{ x:900,  w:240, h:100, c:'#7a5030' },{ x:1420, w:200, h:130, c:'#6a4828' }]
      : [{ x:480,  w:160, h:110, c:'#9a7848' },{ x:840,  w:220, h:95,  c:'#8a6838' },{ x:1520, w:180, h:120, c:'#7a5828' }];
    const gY = H * act.groundFrac;
    blds.forEach(b => {
      const bx = b.x - camX;
      if (bx < -b.w - 30 || bx > W + 30) return;
      ctx.fillStyle = b.c;
      ctx.fillRect(bx, gY - b.h, b.w, b.h);
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      ctx.fillRect(bx, gY - b.h, b.w, 5);
      ctx.fillStyle = actId === 'euroa' ? '#f4d880' : '#e8e0b0';
      ctx.globalAlpha = 0.65;
      for (let wi = 0; wi < 3; wi++) ctx.fillRect(bx + 18 + wi * 52, gY - b.h + 18, 22, 30);
      ctx.globalAlpha = 1;
    });
  }

  // Inn + fire + rain — Glenrowan
  if (actId === 'glenrowan') {
    const gY = H * act.groundFrac;
    const ix = 760 - camX;
    if (ix > -320 && ix < W + 50) {
      ctx.fillStyle = '#16100a';
      ctx.fillRect(ix, gY - 170, 300, 170);
      ctx.fillStyle = '#0c0c08';
      ctx.beginPath();
      ctx.moveTo(ix - 20, gY - 170);
      ctx.lineTo(ix + 150, gY - 245);
      ctx.lineTo(ix + 320, gY - 170);
      ctx.closePath(); ctx.fill();
      const ff = 0.65 + 0.35 * Math.sin(t * 0.13);
      ctx.fillStyle = `rgba(210,70,10,${ff * 0.88})`;
      for (let wi = 0; wi < 3; wi++) ctx.fillRect(ix + 28 + wi * 88, gY - 140, 34, 50);
      const fg = ctx.createRadialGradient(ix + 150, gY - 100, 8, ix + 150, gY - 100, 200);
      fg.addColorStop(0, `rgba(220,70,10,${ff * 0.28})`);
      fg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = fg;
      ctx.fillRect(ix - 60, gY - 260, 420, 290);
    }
    // Rain
    ctx.strokeStyle = 'rgba(140,170,200,0.32)';
    ctx.lineWidth = 1;
    for (let r = 0; r < 70; r++) {
      const rx = ((r * 191 + t * 4) % (W + 60)) - 30;
      const ry = ((r * 107 + t * 6) % (H + 60)) - 30;
      ctx.beginPath(); ctx.moveTo(rx, ry); ctx.lineTo(rx - 5, ry + 20); ctx.stroke();
    }
    ctx.lineWidth = 1;
  }

  // Ground
  const gY = H * act.groundFrac;
  const gg = ctx.createLinearGradient(0, gY, 0, H);
  gg.addColorStop(0, p.ground);
  gg.addColorStop(1, actId === 'glenrowan' ? '#050402' : '#180e06');
  ctx.fillStyle = gg;
  ctx.fillRect(0, gY, W, H - gY);

  ctx.strokeStyle = actId === 'glenrowan' ? 'rgba(100,60,20,0.14)' : 'rgba(200,160,80,0.10)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 8; i++) {
    ctx.beginPath(); ctx.moveTo(0, gY + 8 + i * 13); ctx.lineTo(W, gY + 8 + i * 13); ctx.stroke();
  }

  // Ground fog
  const fgg = ctx.createLinearGradient(0, gY - 50, 0, gY + 30);
  fgg.addColorStop(0, 'rgba(0,0,0,0)');
  fgg.addColorStop(1, p.fog);
  ctx.fillStyle = fgg;
  ctx.fillRect(0, gY - 50, W, 80);

  // Ambient
  ctx.fillStyle = p.light;
  ctx.fillRect(0, 0, W, H);
}

// ── Ned drawing ───────────────────────────────────────────────────────────────
function nkDrawNed(ctx, sx, sy, frame, facing, armor) {
  ctx.save();
  ctx.translate(sx + 24, sy);
  if (facing === 'left') ctx.scale(-1, 1);
  const ls = Math.sin(frame * 0.28) * 9;

  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.20)';
  ctx.beginPath(); ctx.ellipse(0, 100, 18, 5, 0, 0, Math.PI * 2); ctx.fill();

  if (armor) {
    ctx.fillStyle = '#858585';
    ctx.beginPath(); ctx.roundRect(-18, -4, 36, 32, 2); ctx.fill();
    ctx.fillStyle = '#606060';
    ctx.fillRect(-16, 4, 32, 18);
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(-10, 10, 20, 7);
    ctx.fillStyle = '#787878';
    ctx.beginPath(); ctx.roundRect(-20, 26, 40, 42, 3); ctx.fill();
    ctx.fillStyle = '#606060'; ctx.fillRect(-18, 28, 36, 5);
    ctx.fillStyle = '#1a1208';
    ctx.fillRect(-18, 68 + ls, 14, 30); ctx.fillRect(4, 68 - ls, 14, 30);
  } else {
    // Hat
    ctx.fillStyle = '#160e06';
    ctx.beginPath(); ctx.roundRect(-18, -8, 36, 22, 3); ctx.fill();
    ctx.fillStyle = '#0c0804'; ctx.fillRect(-22, 12, 44, 5);
    // Head
    ctx.fillStyle = '#c8905a';
    ctx.beginPath(); ctx.ellipse(0, 28, 14, 16, 0, 0, Math.PI * 2); ctx.fill();
    // Beard
    ctx.fillStyle = '#3a2010';
    ctx.beginPath(); ctx.ellipse(0, 38, 10, 9, 0, 0, Math.PI * 2); ctx.fill();
    // Eyes
    ctx.fillStyle = '#160e06';
    ctx.fillRect(-8, 24, 4, 4); ctx.fillRect(4, 24, 4, 4);
    // Coat
    ctx.fillStyle = '#2a1e0e';
    ctx.beginPath(); ctx.roundRect(-18, 42, 36, 44, 5); ctx.fill();
    ctx.fillStyle = '#1e1408'; ctx.fillRect(-1, 44, 2, 40);
    // Legs
    ctx.fillStyle = '#1a1208';
    ctx.fillRect(-18, 86 + ls, 14, 32); ctx.fillRect(4, 86 - ls, 14, 32);
    // Boots
    ctx.fillStyle = '#0e0c06';
    ctx.beginPath(); ctx.roundRect(-20, 116 + ls, 18, 10, 2); ctx.fill();
    ctx.beginPath(); ctx.roundRect(2, 116 - ls, 18, 10, 2); ctx.fill();
  }
  ctx.restore();
}

// ── NPC drawing ───────────────────────────────────────────────────────────────
function nkDrawNPC(ctx, screenX, groundY, npc, t) {
  ctx.save();
  ctx.translate(screenX + 22, groundY);
  ctx.globalAlpha = npc.done ? 0.5 : 1;
  const idle = Math.sin(t * 0.018 + npc.x * 0.01) * 2;

  ctx.fillStyle = 'rgba(0,0,0,0.16)';
  ctx.beginPath(); ctx.ellipse(0, 4, 15, 4, 0, 0, Math.PI * 2); ctx.fill();

  ctx.fillStyle = npc.hat;
  ctx.beginPath(); ctx.roundRect(-18, -112, 36, 18, 3); ctx.fill();
  ctx.fillRect(-22, -96, 44, 5);

  ctx.fillStyle = '#c08858';
  ctx.beginPath(); ctx.ellipse(0, -76, 13, 15, 0, 0, Math.PI * 2); ctx.fill();

  ctx.fillStyle = npc.coat;
  ctx.beginPath(); ctx.roundRect(-16, -62, 32, 42, 4); ctx.fill();

  ctx.fillStyle = '#1a1208';
  ctx.fillRect(-14, -20 + idle, 12, 28);
  ctx.fillRect(2, -20 - idle, 12, 28);

  ctx.restore();
  ctx.globalAlpha = 1;
}

function nkDrawPrompt(ctx, sx, groundY, t) {
  ctx.save();
  ctx.globalAlpha = 0.7 + 0.3 * Math.sin(t * 0.09);
  ctx.fillStyle = '#f0e0a0';
  ctx.font = "bold 12px 'Archivo', sans-serif";
  ctx.textAlign = 'center';
  ctx.fillText('[E] Talk', sx + 22, groundY - 130);
  ctx.restore();
}

// ── Standoff overlay ──────────────────────────────────────────────────────────
function NKStandoff({ config, onResult }) {
  const canvasRef = useRef(null);
  const st = useRef({ round: 0, angle: 0, phase: 'intro', countdown: 100, result: null, fired: false });

  useEffect(() => {
    const onDown = (e) => { if (e.key === ' ' || e.key === 'Enter') { st.current.fired = true; e.preventDefault(); } };
    window.addEventListener('keydown', onDown);
    return () => window.removeEventListener('keydown', onDown);
  }, []);

  useEffect(() => {
    const c = canvasRef.current; if (!c) return;
    const resize = () => { c.width = c.parentElement.clientWidth; c.height = c.parentElement.clientHeight; };
    resize(); window.addEventListener('resize', resize);
    let raf;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const ctx = c.getContext('2d');
      const W = c.width, H = c.height;
      const s = st.current;
      if (s.done) return;

      ctx.fillStyle = config.bgColor; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = 'rgba(0,0,0,0.65)'; ctx.fillRect(0, 0, W, H);

      if (s.phase === 'intro') {
        s.countdown--;
        if (s.countdown <= 0) { s.phase = 'active'; s.fired = false; }
        ctx.textAlign = 'center';
        ctx.fillStyle = '#e8d0a0'; ctx.font = "bold 30px 'Instrument Serif', serif";
        ctx.fillText(config.title, W / 2, H / 2 - 48);
        ctx.fillStyle = '#908060'; ctx.font = "15px 'Archivo', sans-serif";
        ctx.fillText(config.subtitle, W / 2, H / 2 - 12);
        ctx.fillStyle = '#e8c060'; ctx.font = "bold 18px 'Archivo', sans-serif";
        ctx.fillText(config.rounds[s.round].label, W / 2, H / 2 + 42);
        ctx.fillStyle = '#706850'; ctx.font = "13px 'Archivo', sans-serif";
        ctx.fillText('Press SPACE when the hand enters the lit zone', W / 2, H / 2 + 72);
        return;
      }

      if (s.phase === 'result') {
        s.countdown--;
        ctx.fillStyle = s.result === 'win' ? 'rgba(20,70,20,0.45)' : 'rgba(70,10,10,0.45)';
        ctx.fillRect(0, 0, W, H);
        ctx.textAlign = 'center';
        ctx.fillStyle = s.result === 'win' ? '#50d050' : '#d04040';
        ctx.font = "bold 34px 'Instrument Serif', serif";
        ctx.fillText(s.result === 'win' ? 'You drew first.' : 'Too slow.', W / 2, H / 2);
        if (s.countdown <= 0) {
          if (s.result === 'win' && s.round + 1 < config.rounds.length) {
            s.round++; s.angle = 0; s.countdown = 80; s.phase = 'intro'; s.result = null; s.fired = false;
          } else {
            s.done = true; onResult(s.result === 'win' ? 'win' : 'lose');
          }
        }
        return;
      }

      // Active
      const rnd = config.rounds[s.round];
      s.angle += rnd.speed * 0.022;
      if (s.angle > Math.PI * 2) s.angle -= Math.PI * 2;

      if (s.fired) {
        s.fired = false;
        const frac = s.angle / (Math.PI * 2);
        s.result = (frac >= rnd.sweetStart && frac <= rnd.sweetEnd) ? 'win' : 'lose';
        s.countdown = 90; s.phase = 'result';
      }

      const cx = W / 2, cy = H / 2, R = Math.min(W, H) * 0.27;

      // Ring glow
      const glow = ctx.createRadialGradient(cx, cy, R - 18, cx, cy, R + 22);
      glow.addColorStop(0, 'rgba(200,140,50,0)'); glow.addColorStop(0.5, 'rgba(200,140,50,0.14)'); glow.addColorStop(1, 'rgba(200,140,50,0)');
      ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(cx, cy, R + 22, 0, Math.PI * 2); ctx.fill();

      // Track
      ctx.strokeStyle = 'rgba(80,65,35,0.55)'; ctx.lineWidth = 20;
      ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.stroke();

      // Sweet spot
      const ss = rnd.sweetStart * Math.PI * 2 - Math.PI / 2;
      const se = rnd.sweetEnd * Math.PI * 2 - Math.PI / 2;
      ctx.strokeStyle = rnd.color; ctx.lineWidth = 20; ctx.globalAlpha = 0.88;
      ctx.beginPath(); ctx.arc(cx, cy, R, ss, se); ctx.stroke();
      ctx.globalAlpha = 1;

      // Hand
      const ha = s.angle - Math.PI / 2;
      const hx = cx + Math.cos(ha) * R, hy = cy + Math.sin(ha) * R;
      ctx.strokeStyle = '#f0e8d0'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(hx, hy); ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(hx, hy, 9, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#c04020'; ctx.beginPath(); ctx.arc(hx, hy, 5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#e0d0a0'; ctx.beginPath(); ctx.arc(cx, cy, 7, 0, Math.PI * 2); ctx.fill();

      // Labels
      ctx.textAlign = 'center';
      ctx.fillStyle = '#e8d0a0'; ctx.font = "bold 22px 'Instrument Serif', serif";
      ctx.fillText(rnd.label, cx, cy - R - 38);
      ctx.fillStyle = '#907860'; ctx.font = "italic 14px 'Archivo', sans-serif";
      ctx.fillText(rnd.hint, cx, cy - R - 14);
      ctx.fillStyle = '#706850'; ctx.font = "13px 'Archivo', sans-serif";
      ctx.fillText('SPACE to fire', cx, cy + R + 38);
      if (config.rounds.length > 1) {
        ctx.fillStyle = '#706850'; ctx.font = "11px 'JetBrains Mono', monospace";
        ctx.fillText(`Round ${s.round + 1} / ${config.rounds.length}`, cx, cy + R + 58);
      }

      // Vignette
      const vig = ctx.createRadialGradient(cx, cy, R * 0.35, cx, cy, Math.max(W, H) * 0.72);
      vig.addColorStop(0, 'rgba(0,0,0,0)'); vig.addColorStop(1, 'rgba(0,0,0,0.78)');
      ctx.fillStyle = vig; ctx.fillRect(0, 0, W, H);
    };
    loop();
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize); };
  }, [config, onResult]);

  return <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 20 }} />;
}

// ── Dialogue portrait ─────────────────────────────────────────────────────────
const NK_PORT_STYLES = {
  gang:     { coat: '#2a2010', hat: '#0e0c06', skin: '#c09058' },
  police:   { coat: '#8a2010', hat: '#1a0a04', skin: '#c09058' },
  civilian: { coat: '#4a4030', hat: '#2a2018', skin: '#c09058' },
};
function NKPortrait({ type }) {
  const canvasRef = useRef(null);
  useEffect(() => {
    const c = canvasRef.current; if (!c) return;
    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, 80, 80);
    const p = NK_PORT_STYLES[type] || NK_PORT_STYLES.civilian;
    ctx.fillStyle = p.skin;
    ctx.beginPath(); ctx.ellipse(40, 46, 16, 18, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = p.hat;
    ctx.beginPath(); ctx.roundRect(20, 18, 40, 17, 3); ctx.fill();
    ctx.fillRect(16, 33, 48, 5);
    ctx.fillStyle = '#160e06';
    ctx.fillRect(32, 42, 4, 4); ctx.fillRect(44, 42, 4, 4);
    ctx.fillStyle = p.coat;
    ctx.beginPath(); ctx.roundRect(22, 62, 36, 18, 4); ctx.fill();
  }, [type]);
  return <canvas ref={canvasRef} width={80} height={80} style={{ borderRadius: 40, border: '2px solid rgba(200,160,80,0.35)', flexShrink: 0 }} />;
}

// ── Dialogue overlay ──────────────────────────────────────────────────────────
function NKDialogue({ node, onChoice }) {
  const [shown, setShown] = useState('');
  const [done, setDone] = useState(false);
  const full = node.text || '';

  useEffect(() => {
    setShown(''); setDone(false);
    let i = 0;
    const id = setInterval(() => {
      i++; setShown(full.slice(0, i));
      if (i >= full.length) { clearInterval(id); setDone(true); }
    }, 22);
    return () => clearInterval(id);
  }, [node]);

  return (
    <div onClick={() => { if (!done) { setShown(full); setDone(true); } }}
      style={{ position: 'absolute', inset: 0, zIndex: 15, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', paddingBottom: 36 }}>
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '58%', background: 'linear-gradient(to top, rgba(6,4,2,0.93) 0%, rgba(6,4,2,0) 100%)', pointerEvents: 'none' }} />
      <div style={{ position: 'relative', zIndex: 1, maxWidth: 780, margin: '0 auto', width: '100%', padding: '0 48px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 20, marginBottom: 16 }}>
          <NKPortrait type={node.portrait} />
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: '#a09060', letterSpacing: 3, textTransform: 'uppercase', marginBottom: 5 }}>{node.speaker}</div>
            <div style={{ fontFamily: "'Instrument Serif', serif", fontSize: 20, color: '#f0e8d0', lineHeight: 1.6, minHeight: 52 }}>
              {shown}{!done && <span style={{ opacity: 0.7 }}>▌</span>}
            </div>
          </div>
        </div>
        {done && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginLeft: 100 }}>
            {node.choices.map((ch, i) => (
              <button key={i} onClick={e => { e.stopPropagation(); onChoice(ch); }}
                style={{ background: 'rgba(200,160,60,0.10)', border: '1px solid rgba(200,160,60,0.30)', color: '#e8d8a0', padding: '9px 18px', borderRadius: 4, cursor: 'pointer', fontFamily: "'Archivo', sans-serif", fontSize: 14, textAlign: 'left' }}>
                {ch.text}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Act card ──────────────────────────────────────────────────────────────────
function NKActCard({ act, onContinue }) {
  const [vis, setVis] = useState(false);
  useEffect(() => { const id = setTimeout(() => setVis(true), 60); return () => clearTimeout(id); }, []);
  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(4,3,2,0.97)', opacity: vis ? 1 : 0, transition: 'opacity 0.5s' }}>
      <div style={{ textAlign: 'center', maxWidth: 500, padding: '0 32px' }}>
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: '#806040', letterSpacing: 4, textTransform: 'uppercase', marginBottom: 12 }}>{act.year}</div>
        <div style={{ fontFamily: "'Instrument Serif', serif", fontSize: 13, color: '#c0a060', marginBottom: 4 }}>{act.title}</div>
        <div style={{ fontFamily: "'Instrument Serif', serif", fontSize: 44, color: '#f0e0c0', marginBottom: 22, fontWeight: 400 }}>{act.subtitle}</div>
        <div style={{ fontFamily: "'Archivo', sans-serif", fontSize: 15, color: '#a09070', lineHeight: 1.75, marginBottom: 44 }}>{act.desc}</div>
        <button onClick={onContinue} style={{ background: 'transparent', border: '1px solid rgba(200,160,60,0.5)', color: '#c8a840', padding: '13px 40px', borderRadius: 4, cursor: 'pointer', fontFamily: "'Archivo', sans-serif", fontSize: 14, letterSpacing: 1 }}>
          Continue
        </button>
      </div>
    </div>
  );
}

// ── Title screen ──────────────────────────────────────────────────────────────
function NKTitle({ onStart }) {
  const canvasRef = useRef(null);
  const tRef = useRef(0);
  useEffect(() => {
    const c = canvasRef.current; if (!c) return;
    const resize = () => { c.width = c.parentElement.clientWidth; c.height = c.parentElement.clientHeight; };
    resize(); window.addEventListener('resize', resize);
    let raf;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      tRef.current++;
      const ctx = c.getContext('2d'), W = c.width, H = c.height, t = tRef.current;
      const sky = ctx.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, '#04060c'); sky.addColorStop(1, '#100c1a');
      ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
      for (let i = 0; i < 100; i++) {
        ctx.globalAlpha = 0.3 + 0.4 * Math.sin(t * 0.025 + i * 0.8);
        ctx.fillStyle = '#fff';
        ctx.fillRect(((i * 293 + 7) % 1000) / 1000 * W, ((i * 173 + 13) % 600) / 600 * H * 0.58, 1.5, 1.5);
      }
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#0a0c08';
      ctx.beginPath();
      for (let x = 0; x <= W; x += 18) {
        const hy = H * 0.66 + Math.sin(x * 0.003) * 65 + Math.sin(x * 0.009) * 26;
        x === 0 ? ctx.moveTo(x, hy) : ctx.lineTo(x, hy);
      }
      ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath(); ctx.fill();
      // Ned silhouette
      const nx = W / 2 - 24, ny = H * 0.50;
      ctx.fillStyle = '#050403';
      ctx.beginPath(); ctx.roundRect(nx + 5, ny, 38, 22, 3); ctx.fill();
      ctx.fillRect(nx + 1, ny + 20, 46, 5);
      ctx.beginPath(); ctx.ellipse(nx + 24, ny + 48, 15, 17, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.roundRect(nx + 4, ny + 63, 40, 44, 5); ctx.fill();
      ctx.fillRect(nx + 7, ny + 107, 13, 30); ctx.fillRect(nx + 28, ny + 107, 13, 30);
    };
    loop();
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize); };
  }, []);
  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: '#806040', letterSpacing: 5, textTransform: 'uppercase', marginBottom: 18 }}>Outback Electronics Presents</div>
        <div style={{ fontFamily: "'Instrument Serif', serif", fontSize: 68, color: '#f0e0c0', lineHeight: 1, marginBottom: 8, textShadow: '0 2px 40px rgba(200,120,40,0.45)' }}>Ned Kelly</div>
        <div style={{ fontFamily: "'Instrument Serif', serif", fontSize: 22, color: '#c0a060', marginBottom: 52, letterSpacing: 4 }}>The Legend</div>
        <div style={{ fontFamily: "'Archivo', sans-serif", fontSize: 13, color: '#706040', textAlign: 'center', lineHeight: 1.8, maxWidth: 360, marginBottom: 8 }}>
          Four acts. Real history. Your choices shape the ending.
        </div>
        <button onClick={onStart} style={{ marginTop: 28, background: 'transparent', border: '1px solid rgba(200,160,60,0.55)', color: '#c8a840', padding: '13px 50px', borderRadius: 4, cursor: 'pointer', fontFamily: "'Archivo', sans-serif", fontSize: 14, letterSpacing: 2 }}>
          Begin
        </button>
      </div>
    </div>
  );
}

// ── Ending screen ─────────────────────────────────────────────────────────────
function NKEndingScreen({ endingId, onRestart, onBack }) {
  const e = NK_ENDINGS[endingId] || NK_ENDINGS.martyr;
  const [lines, setLines] = useState([]);
  useEffect(() => {
    setLines([]);
    let i = 0;
    const id = setInterval(() => {
      if (i < e.lines.length) { setLines(l => [...l, e.lines[i]]); i++; }
      else clearInterval(id);
    }, 950);
    return () => clearInterval(id);
  }, [endingId]);
  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(4,3,2,0.97)' }}>
      <div style={{ maxWidth: 520, textAlign: 'center', padding: '0 32px' }}>
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: '#806040', letterSpacing: 4, textTransform: 'uppercase', marginBottom: 10 }}>Ending</div>
        <div style={{ fontFamily: "'Instrument Serif', serif", fontSize: 40, color: e.color, marginBottom: 6 }}>{e.title}</div>
        <div style={{ fontFamily: "'Archivo', sans-serif", fontSize: 12, color: '#806040', marginBottom: 44, letterSpacing: 2 }}>{e.subtitle}</div>
        <div style={{ minHeight: 220 }}>
          {lines.map((l, i) => (
            <div key={i} style={{ fontFamily: "'Instrument Serif', serif", fontSize: 17, color: l ? '#d0c0a0' : 'transparent', lineHeight: 2.1 }}>{l || '—'}</div>
          ))}
        </div>
        {lines.length >= e.lines.length && (
          <div style={{ marginTop: 52, display: 'flex', gap: 14, justifyContent: 'center' }}>
            <button onClick={onRestart} style={{ background: 'transparent', border: '1px solid rgba(200,160,60,0.5)', color: '#c8a840', padding: '11px 28px', borderRadius: 4, cursor: 'pointer', fontFamily: "'Archivo', sans-serif", fontSize: 13 }}>Play Again</button>
            <button onClick={onBack} style={{ background: 'transparent', border: '1px solid rgba(120,100,60,0.35)', color: '#707050', padding: '11px 28px', borderRadius: 4, cursor: 'pointer', fontFamily: "'Archivo', sans-serif", fontSize: 13 }}>← Games</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── HUD ───────────────────────────────────────────────────────────────────────
function NKHUD({ actIndex, metrics, onBack }) {
  const act = NK_ACTS[actIndex];
  return (
    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10, display: 'flex', alignItems: 'center', padding: '10px 20px', gap: 16, background: 'linear-gradient(to bottom, rgba(0,0,0,0.52) 0%, transparent 100%)', pointerEvents: 'none' }}>
      <button onClick={onBack} style={{ pointerEvents: 'auto', background: 'rgba(0,0,0,0.38)', border: '1px solid rgba(200,160,60,0.28)', color: '#c8a840', padding: '5px 14px', borderRadius: 4, cursor: 'pointer', fontFamily: "'Archivo', sans-serif", fontSize: 12 }}>← Back</button>
      <span style={{ fontFamily: "'Instrument Serif', serif", fontSize: 15, color: '#e0d0a0' }}>{act?.title} — {act?.subtitle}</span>
      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: '#a09060' }}>{act?.year}</span>
      <div style={{ marginLeft: 'auto', display: 'flex', gap: 20 }}>
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: '#c06040' }}>Notoriety {metrics.notoriety}</span>
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: '#40a060' }}>Trust {metrics.trust}</span>
      </div>
    </div>
  );
}

// ── Main game component ───────────────────────────────────────────────────────
function nkFreshState() {
  return {
    phase: 'title',
    actIndex: 0,
    ned: { x: 180, y: 0, vx: 0, facing: 'right', frame: 0, armor: false },
    camX: 0,
    npcs: [],
    metrics: { notoriety: 0, trust: 0, loyalty: 0 },
    flags: new Set(),
    activeNpcId: null,
    nearNpcId: null,
    dialogueNodeId: null,
    standoffId: null,
    t: 0,
  };
}

function NedKellyLegend({ onBack: exitToLobby }) {
  const canvasRef  = useRef(null);
  const gs         = useRef(nkFreshState());
  const [phase,    setPhase]    = useState('title');
  const [dlgNode,  setDlgNode]  = useState(null);
  const [sfId,     setSfId]     = useState(null);
  const [endingId, setEndingId] = useState(null);
  const [nearId,   setNearId]   = useState(null);

  const keys = useKeys(['ArrowLeft','ArrowRight','a','d','A','D',' ','e','E']);
  useResizeCanvas(canvasRef);

  const beginAct = useCallback((idx) => {
    const s = gs.current;
    s.actIndex  = idx;
    s.ned       = { x: 180, y: 0, vx: 0, facing: 'right', frame: 0, armor: idx === 3 && s.flags.has('donned_armor') };
    s.camX      = 0;
    s.npcs      = NK_ACTS[idx].npcs.map(n => ({ ...n, spoken: false, done: false }));
    s.nearNpcId = null;
    s.phase     = 'actcard';
    setPhase('actcard');
  }, []);

  const restart = useCallback(() => {
    gs.current = nkFreshState();
    setPhase('title'); setDlgNode(null); setSfId(null); setEndingId(null); setNearId(null);
  }, []);

  const applyMeta = useCallback((ch) => {
    const m = gs.current.metrics;
    if (ch.notoriety) m.notoriety = Math.max(0, Math.min(100, m.notoriety + ch.notoriety));
    if (ch.trust)     m.trust     = Math.max(0, Math.min(100, m.trust     + ch.trust));
    if (ch.loyalty)   m.loyalty   = Math.max(0, Math.min(100, m.loyalty   + ch.loyalty));
    if (ch.flag)  gs.current.flags.add(ch.flag);
    if (ch.flag2) gs.current.flags.add(ch.flag2);
  }, []);

  const finishAct = useCallback(() => {
    const s = gs.current;
    const next = s.actIndex + 1;
    if (next >= NK_ACTS.length) {
      const eid = nkCalcEnding(s.metrics, s.flags);
      s.phase = 'ending'; setEndingId(eid); setPhase('ending');
    } else { beginAct(next); }
  }, [beginAct]);

  const handleChoice = useCallback((ch) => {
    applyMeta(ch);
    const s = gs.current;

    if (ch.standoff) {
      s.phase = 'standoff'; s.standoffId = ch.standoff;
      setDlgNode(null); setSfId(ch.standoff); setPhase('standoff');
      return;
    }
    if (ch.advanceAct) { setDlgNode(null); finishAct(); return; }

    if (ch.next) {
      const node = NK_NODES[ch.next];
      if (!node) { setDlgNode(null); s.phase = 'explore'; setPhase('explore'); return; }
      if (node.standoff) {
        s.phase = 'standoff'; s.standoffId = node.standoff;
        setDlgNode(null); setSfId(node.standoff); setPhase('standoff');
        return;
      }
      s.dialogueNodeId = ch.next; setDlgNode(node);
    } else {
      // null next = end conversation
      const npc = s.npcs.find(n => n.id === s.activeNpcId);
      if (npc) npc.done = true;
      s.phase = 'explore'; setDlgNode(null); setPhase('explore');
    }
  }, [applyMeta, finishAct]);

  const handleStandoffResult = useCallback((result) => {
    const s = gs.current;
    const cfg = NK_STANDOFFS[s.standoffId];
    if (result === 'win'  && cfg?.winFlag)  s.flags.add(cfg.winFlag);
    if (result === 'lose' && cfg?.loseFlag) s.flags.add(cfg.loseFlag);
    setSfId(null); finishAct();
  }, [finishAct]);

  const tick = useCallback(() => {
    const s = gs.current;
    if (s.phase !== 'explore') return;
    s.t++;
    const k    = keys.current;
    const act  = NK_ACTS[s.actIndex];
    const H    = canvasRef.current?.height || 576;
    const W    = canvasRef.current?.width  || 1024;
    const gY   = H * act.groundFrac - 130;

    const goL = k.has('ArrowLeft')  || k.has('a') || k.has('A');
    const goR = k.has('ArrowRight') || k.has('d') || k.has('D');
    if (goL) { s.ned.vx = -3.2; s.ned.facing = 'left';  s.ned.frame++; }
    else if (goR) { s.ned.vx = 3.2; s.ned.facing = 'right'; s.ned.frame++; }
    else s.ned.vx = 0;

    s.ned.x = Math.max(40, Math.min(act.sceneWidth - 80, s.ned.x + s.ned.vx));
    s.ned.y = gY;

    const targetCam = s.ned.x - W * 0.38;
    s.camX += (targetCam - s.camX) * 0.1;
    s.camX  = Math.max(0, Math.min(act.sceneWidth - W, s.camX));

    let near = null;
    for (const npc of s.npcs) {
      if (npc.done) continue;
      if (Math.abs(s.ned.x - npc.x) < 88) { near = npc; break; }
    }
    const newNearId = near?.id || null;
    if (newNearId !== s.nearNpcId) { s.nearNpcId = newNearId; setNearId(newNearId); }

    if ((k.has('e') || k.has('E')) && near && !near.spoken) {
      near.spoken = true;
      k.delete('e'); k.delete('E');
      const node = NK_NODES[`${near.id}_greet`];
      if (node) {
        s.activeNpcId = near.id; s.dialogueNodeId = `${near.id}_greet`;
        s.phase = 'dialogue'; setDlgNode(node); setPhase('dialogue');
      }
    }
  }, []);

  const draw = useCallback(() => {
    const c = canvasRef.current; if (!c) return;
    const ctx = c.getContext('2d');
    const s = gs.current;
    if (s.phase === 'title' || s.phase === 'actcard' || s.phase === 'ending') return;
    const W = c.width, H = c.height;
    const act = NK_ACTS[s.actIndex];
    const gY  = H * act.groundFrac;

    nkDrawScene(ctx, W, H, act.id, s.camX, s.t);

    s.npcs.forEach(npc => {
      const sx = npc.x - s.camX;
      if (sx < -100 || sx > W + 100) return;
      nkDrawNPC(ctx, sx, gY, npc, s.t);
      if (s.nearNpcId === npc.id && !npc.done) nkDrawPrompt(ctx, sx, gY, s.t);
    });

    nkDrawNed(ctx, s.ned.x - s.camX, s.ned.y, s.ned.frame, s.ned.facing, s.ned.armor);

    // Cinematic vignette
    const vig = ctx.createRadialGradient(W / 2, H / 2, H * 0.28, W / 2, H / 2, Math.max(W, H) * 0.72);
    vig.addColorStop(0, 'rgba(0,0,0,0)'); vig.addColorStop(1, 'rgba(0,0,0,0.48)');
    ctx.fillStyle = vig; ctx.fillRect(0, 0, W, H);
  }, []);

  useGameLoop(tick, draw);

  const s = gs.current;
  return (
    <div style={{ flex: 1, position: 'relative', overflow: 'hidden', background: '#040308' }}>
      <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: '100%' }} />

      {phase === 'title' && <NKTitle onStart={() => beginAct(0)} />}

      {phase === 'actcard' && (
        <NKActCard act={NK_ACTS[s.actIndex]} onContinue={() => { gs.current.phase = 'explore'; setPhase('explore'); }} />
      )}

      {(phase === 'explore' || phase === 'dialogue') && (
        <NKHUD actIndex={s.actIndex} metrics={s.metrics} onBack={exitToLobby} />
      )}

      {phase === 'dialogue' && dlgNode && (
        <NKDialogue node={dlgNode} onChoice={handleChoice} />
      )}

      {phase === 'standoff' && sfId && (
        <NKStandoff config={NK_STANDOFFS[sfId]} onResult={handleStandoffResult} />
      )}

      {phase === 'ending' && endingId && (
        <NKEndingScreen endingId={endingId} onRestart={restart} onBack={exitToLobby} />
      )}
    </div>
  );
}

// ── Game Registry ─────────────────────────────────────────────────────────────
// To add a game: push one entry here. No other wiring needed.
const GAME_REGISTRY = [
  { id:'serpent',   name:'Grid Serpent',   tagline:'Grow long. Avoid yourself. Classic grid-based action.',     hsKey:'oe_games_hs_serpent',   component: GridSerpent  },
  { id:'blockdrop', name:'Block Drop',     tagline:'Stack falling pieces. Clear lines. Keep the field clear.',  hsKey:'oe_games_hs_blockdrop', component: BlockDrop    },
  { id:'orbit',     name:'Orbit Breaker',  tagline:'Smash through brick walls. Survive. Score big.',            hsKey:'oe_games_hs_orbit',     component: OrbitBreaker },
  { id:'nedkelly',  name:'Ned Kelly: The Legend', tagline:'Four acts. Real history. Your choices shape the ending.',  hsKey:'oe_games_hs_nedkelly',  component: NedKellyLegend },
];

// ── Lobby ─────────────────────────────────────────────────────────────────────
function Lobby({ onPlay }) {
  const [scores, setScores] = useState({});
  useEffect(() => {
    const local = {}; GAME_REGISTRY.forEach(g => { local[g.id] = getHS(g.hsKey); });
    setScores(local);
    fetchServerScores().then(server => {
      setScores(prev => {
        const merged = { ...prev };
        for (const [id, score] of Object.entries(server)) {
          if (score > (merged[id] || 0)) merged[id] = score;
        }
        return merged;
      });
    });
  }, []);

  return (
    <div style={{ flex:1, padding:'40px 24px', maxWidth:960, margin:'0 auto', width:'100%' }}>
      <div style={{ marginBottom:32, textAlign:'center' }}>
        <h2 style={{ fontFamily:"'Instrument Serif', serif", fontSize:36, color:T.ink, fontWeight:400 }}>
          Take a break. Play something.
        </h2>
        <p style={{ color:T.ink3, marginTop:8, fontSize:15 }}>Original games, no installs, no logins.</p>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))', gap:20 }}>
        {GAME_REGISTRY.map(g => (
          <div key={g.id} style={{ background:T.paper, border:`1px solid ${T.line}`, borderRadius:10, padding:28, display:'flex', flexDirection:'column', gap:12, boxShadow:'0 2px 6px rgba(31,26,20,0.06)' }}>
            <h3 style={{ fontFamily:"'Instrument Serif', serif", fontSize:24, fontWeight:400, color:T.ink }}>{g.name}</h3>
            <p style={{ color:T.ink2, fontSize:14, lineHeight:1.6, flex:1 }}>{g.tagline}</p>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginTop:4 }}>
              <span style={{ fontFamily:"'JetBrains Mono', monospace", fontSize:12, color:T.ink3 }}>Best: {scores[g.id]||0}</span>
              <button style={{ ...css.btn, ...css.btnPrimary }} onClick={()=>onPlay(g.id)}>Play</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Root App ──────────────────────────────────────────────────────────────────
const GAME_IDS = new Set(GAME_REGISTRY.map(g => g.id));

function gameIdFromPath() {
  const seg = window.location.pathname.replace(/^\/+/, '').split('/')[0];
  return GAME_IDS.has(seg) ? seg : null;
}

function App() {
  const [activeId, setActiveId] = useState(gameIdFromPath);
  const [authOpen, setAuthOpen] = useState(false);
  const [portalUser, setPortalUser] = usePortalUser();
  const active = activeId ? GAME_REGISTRY.find(g=>g.id===activeId) : null;
  const GameComponent = active ? active.component : null;

  const playGame = (id) => {
    setActiveId(id);
    if (window.location.pathname !== '/' + id) window.history.pushState({}, '', '/' + id);
  };

  const backToLobby = () => {
    setActiveId(null);
    if (window.location.pathname !== '/') window.history.pushState({}, '', '/');
  };

  useEffect(() => {
    const onPop = () => { setActiveId(gameIdFromPath()); };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  async function handleSignOut() {
    await portalApi('/api/portal/auth/logout', { method: 'POST' });
    setPortalUser(null);
    _portalCsrfPromise = null;
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', minHeight:'100vh' }}>
      <header style={css.header}>
        <a href="https://outbackelectronics.com.au" style={css.logoLink} title="Back to Outback Electronics">
          <img src="assets/logo.webp" alt="" style={css.logoImg} onError={e=>{e.target.style.display='none';}} />
          <span style={css.siteName}>Outback Electronics</span>
        </a>
        <div style={{ flex:1 }} />
        <span style={{ fontFamily:"'Instrument Serif', serif", fontSize:20, color:T.ink }}>
          {active ? active.name : 'Games'}
        </span>
        {portalUser === undefined ? null : portalUser ? (
          <div style={{ display:'flex', alignItems:'center', gap:10, fontSize:13, color:T.ink2 }}>
            <span style={{ maxWidth:140, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{portalUser.displayName || portalUser.username}</span>
            <button onClick={handleSignOut} style={{ ...css.btn, ...css.btnSecondary, padding:'5px 12px', fontSize:12 }}>Sign out</button>
          </div>
        ) : (
          <button onClick={() => setAuthOpen(true)} style={{ ...css.btn, ...css.btnSecondary, padding:'5px 14px', fontSize:13 }}>Sign In</button>
        )}
      </header>
      {GameComponent
        ? <GameComponent key={activeId} onBack={backToLobby} />
        : <Lobby onPlay={playGame} />}
      {authOpen && <AuthModal onClose={() => setAuthOpen(false)} onLogin={u => { setPortalUser(u); }} />}
    </div>
  );
}

export default App;
