import { useEffect, useRef, useCallback } from 'react';
import * as THREE from 'three';
import { STARS, CONST_LINES } from './src/star-data.js';

const R = 900;
const PI = Math.PI;
const RAD = PI / 180;

// Galactic north pole (J2000)
const NGP_RA  = 192.859508 * RAD;
const NGP_DEC = 27.128336  * RAD;
const NGP_L0  = 122.932    * RAD; // l of NCP

const SPEC_COLORS = [
  [0.65, 0.72, 1.00],  // O/B
  [1.00, 0.99, 0.98],  // A/F
  [1.00, 1.00, 0.80],  // G
  [1.00, 0.68, 0.35],  // K
  [1.00, 0.38, 0.22],  // M
];

// ── Astronomy utils ────────────────────────────────────────────────────────
function julianDay(date) {
  const Y = date.getUTCFullYear(), M = date.getUTCMonth() + 1, D = date.getUTCDate();
  const h = date.getUTCHours() + date.getUTCMinutes() / 60;
  let a = Math.floor((14 - M) / 12);
  let y = Y + 4800 - a, m = M + 12 * a - 3;
  let jdn = D + Math.floor((153 * m + 2) / 5) + 365 * y + Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400) - 32045;
  return jdn + (h - 12) / 24;
}

function gmstDeg(date) {
  const jd = julianDay(date);
  const T = (jd - 2451545.0) / 36525;
  return ((280.46061837 + 360.98564736629 * (jd - 2451545.0) + 0.000387933 * T * T) % 360 + 360) % 360;
}

function lstDeg(date, lon) {
  return ((gmstDeg(date) + lon) % 360 + 360) % 360;
}

function eq2altaz(ra_deg, dec_deg, lst_deg, lat_deg) {
  const H  = (lst_deg - ra_deg) * RAD;
  const dec = dec_deg * RAD, lat = lat_deg * RAD;
  const sinAlt = Math.sin(lat) * Math.sin(dec) + Math.cos(lat) * Math.cos(dec) * Math.cos(H);
  const alt = Math.asin(Math.max(-1, Math.min(1, sinAlt)));
  const cosAz = (Math.sin(dec) - sinAlt * Math.sin(lat)) / (Math.cos(alt) * Math.cos(lat) + 1e-9);
  const sinAz = -Math.cos(dec) * Math.sin(H) / (Math.cos(alt) + 1e-9);
  return { alt, az: Math.atan2(sinAz, cosAz) };
}

// Alt/az → scene xyz  (x=east, y=zenith, z=north)
function hor2xyz(alt, az, r = R) {
  return new THREE.Vector3(
    r * Math.cos(alt) * Math.sin(az),
    r * Math.sin(alt),
    r * Math.cos(alt) * Math.cos(az),
  );
}

// ── Galactic latitude of equatorial (ra_rad, dec_rad) ─────────────────────
function galacticLatLon(ra_rad, dec_rad) {
  const sinB = Math.sin(NGP_DEC) * Math.sin(dec_rad)
             + Math.cos(NGP_DEC) * Math.cos(dec_rad) * Math.cos(ra_rad - NGP_RA);
  const b = Math.asin(Math.max(-1, Math.min(1, sinB)));
  const sinL = Math.cos(dec_rad) * Math.sin(ra_rad - NGP_RA);
  const cosL = Math.cos(NGP_DEC) * Math.sin(dec_rad) - Math.sin(NGP_DEC) * Math.cos(dec_rad) * Math.cos(ra_rad - NGP_RA);
  const l = ((Math.atan2(sinL, cosL) + NGP_L0) % (2 * PI) + 2 * PI) % (2 * PI);
  return { b, l };
}

// ── Milky Way density at galactic (l, b) ─────────────────────────────────
function mwDensity(l, b) {
  const lDeg = l / RAD, bDeg = b / RAD;
  // Gaussian width ~6° core, extended wing
  const core = Math.exp(-bDeg * bDeg / (2 * 7 * 7));
  const wing = Math.exp(-bDeg * bDeg / (2 * 14 * 14)) * 0.35;
  const base = core + wing;
  // Brighter toward center (l=0 or 360)
  const lC = Math.min(lDeg, 360 - lDeg);
  const center = 1.0 + 1.5 * Math.exp(-lC * lC / (2 * 55 * 55));
  // Cygnus/Persus arm brightness (l~80°)
  const cygnus = 0.5 * Math.exp(-(lDeg - 80) * (lDeg - 80) / (2 * 30 * 30));
  // Carina arm (l~285°)
  const carina = 0.6 * Math.exp(-(lDeg - 285) * (lDeg - 285) / (2 * 25 * 25));
  // Scutum-Centaurus (l~30°)
  const scutum = 0.4 * Math.exp(-(lDeg - 30) * (lDeg - 30) / (2 * 20 * 20));
  return base * (center + cygnus + carina + scutum) * 0.3;
}

// ── Generate Milky Way canvas texture (equirectangular, RA/Dec) ───────────
function buildMilkyWayTexture(lst_deg, lat_deg) {
  const W = 512, H = 256;
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);

  const img = ctx.createImageData(W, H);
  const d = img.data;

  for (let j = 0; j < H; j++) {
    // v=0 → north pole (alt=90°?). Map v to altitude: alt = 90 - j/H*180
    // Use equirectangular alt/az mapping
    const alt = (0.5 - j / H) * PI;   // +π/2 at top, -π/2 at bottom
    for (let i = 0; i < W; i++) {
      const az  = (i / W) * 2 * PI;  // 0 = north, clockwise

      // Convert alt/az to ra/dec
      const lat = lat_deg * RAD;
      const sinDec = Math.sin(lat) * Math.sin(alt) + Math.cos(lat) * Math.cos(alt) * Math.cos(az);
      const dec = Math.asin(Math.max(-1, Math.min(1, sinDec)));
      const cosH = (Math.sin(alt) - Math.sin(lat) * sinDec) / (Math.cos(lat) * Math.cos(dec) + 1e-9);
      const sinH = -Math.cos(alt) * Math.sin(az) / (Math.cos(dec) + 1e-9);
      const H_ang = Math.atan2(sinH, cosH);
      const ra = ((lst_deg * RAD - H_ang) % (2 * PI) + 2 * PI) % (2 * PI);

      const { b, l } = galacticLatLon(ra, dec);
      const dens = mwDensity(l, b);

      if (dens > 0.01) {
        const idx = (j * W + i) * 4;
        const br = Math.min(1, dens);
        d[idx]   = Math.round(br * 140);
        d[idx+1] = Math.round(br * 160);
        d[idx+2] = Math.round(br * 220);
        d[idx+3] = Math.round(br * 200);
      }
    }
  }
  ctx.putImageData(img, 0, 0);
  return new THREE.CanvasTexture(canvas);
}

// ── Planet elements ────────────────────────────────────────────────────────
const PLANET_DEFS = {
  Mercury: { L0: 252.25, n: 4.09234, color: new THREE.Color(0.7, 0.7, 0.7),  size: 3.5 },
  Venus:   { L0: 181.98, n: 1.60213, color: new THREE.Color(1.0, 0.95, 0.7), size: 6 },
  Mars:    { L0: 355.45, n: 0.52403, color: new THREE.Color(1.0, 0.4, 0.2),  size: 4.5 },
  Jupiter: { L0: 34.40,  n: 0.08309, color: new THREE.Color(1.0, 0.87, 0.7), size: 9 },
  Saturn:  { L0: 50.08,  n: 0.03346, color: new THREE.Color(0.96, 0.90, 0.7),size: 7.5 },
};

function planetRaDec(name, jd) {
  const d = jd - 2451545.0;
  const el = PLANET_DEFS[name];
  const Lp = ((el.L0 + el.n * d) % 360 + 360) % 360;
  const eps = (23.439 - 0.013004 * d / 36525) * RAD;
  const lRad = Lp * RAD;
  const ra = ((Math.atan2(Math.cos(eps) * Math.sin(lRad), Math.cos(lRad)) / RAD) + 360) % 360;
  const dec = Math.asin(Math.sin(eps) * Math.sin(lRad)) / RAD;
  return { ra, dec };
}

export default function SkyDome({ lat, lon, date }) {
  const mountRef = useRef(null);
  const stateRef = useRef({ theta: PI, phi: 0.30, drag: false, lastX: 0, lastY: 0, fov: 75 });
  // theta=PI → looking south (southern hemisphere favors south for Milky Way)
  const refs = useRef({});

  const applyCamera = useCallback(() => {
    const cam = refs.current.cam;
    if (!cam) return;
    const { theta, phi, fov } = stateRef.current;
    const ph = Math.max(-PI * 0.45, Math.min(PI * 0.45, phi));
    cam.lookAt(
      Math.cos(ph) * Math.sin(theta),
      Math.sin(ph),
      Math.cos(ph) * Math.cos(theta),
    );
    cam.fov = fov;
    cam.updateProjectionMatrix();
  }, []);

  useEffect(() => {
    const el = mountRef.current;
    if (!el) return;

    const W = el.clientWidth, H = el.clientHeight || 520;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(W, H);
    el.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const cam = new THREE.PerspectiveCamera(75, W / H, 0.1, R * 3);
    cam.up.set(0, 1, 0);
    refs.current.cam = cam;

    const jd = julianDay(date);
    const lst = lstDeg(date, lon);

    // ── Sky sphere background (gradient: black zenith → deep navy horizon) ──
    {
      const geo = new THREE.SphereGeometry(R * 1.5, 48, 32);
      const mat = new THREE.ShaderMaterial({
        side: THREE.BackSide,
        uniforms: { sunAlt: { value: -0.3 } },
        vertexShader: `
          varying vec3 vPos;
          void main() {
            vPos = normalize(position);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          varying vec3 vPos;
          uniform float sunAlt;
          void main() {
            float alt = vPos.y;  // -1 (nadir) to 1 (zenith)
            // Night sky: deep navy at horizon, near-black at zenith
            vec3 zenith  = vec3(0.002, 0.004, 0.018);
            vec3 horizon = vec3(0.010, 0.018, 0.045);
            vec3 color = mix(horizon, zenith, smoothstep(-0.1, 0.5, alt));
            // Slight atmospheric glow just above horizon
            float haze = exp(-alt * alt / (2.0 * 0.04)) * 0.06;
            color += vec3(0.05, 0.06, 0.08) * haze;
            gl_FragColor = vec4(color, 1.0);
          }
        `,
        depthWrite: false,
      });
      scene.add(new THREE.Mesh(geo, mat));
    }

    // ── Milky Way (canvas texture mapped onto inner sphere, alt/az space) ──
    {
      const mwTex = buildMilkyWayTexture(lst, lat);
      mwTex.wrapS = THREE.RepeatWrapping;
      const geo = new THREE.SphereGeometry(R * 0.98, 128, 64);
      // The sphere UV by default wraps 0-1 in u around the equator.
      // We need to rotate it so az=0 (north) aligns with the front of the sphere (+z).
      const mat = new THREE.MeshBasicMaterial({
        map: mwTex,
        side: THREE.BackSide,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        opacity: 0.95,
      });
      const mesh = new THREE.Mesh(geo, mat);
      // In our convention: north=+z, east=+x, zenith=+y
      // SphereGeometry in Three.js: UV u=0 at phi=0 (+x axis), v=0 at top.
      // We want u=0 (az=0=north) to map to +z direction.
      // The sphere's phi=0 is +x (east in our scene), so rotate -90° around Y.
      mesh.rotation.y = PI / 2; // shift so az=0 (north, +z) aligns with texture u=0
      // Flip texture: our az increases clockwise, texture u increases left-to-right
      mwTex.repeat.x = -1;
      mwTex.offset.x = 1;
      // v=0 of sphere is top (zenith), we want v=0.5 to be horizon (alt=0):
      // sphere v=0→π: alt goes 90→-90. That maps alt=0 to v=0.5. ✓
      // But we want to flip so the top half of texture (alt>0) shows:
      scene.add(mesh);
    }

    // ── Ground disk ────────────────────────────────────────────────────────
    {
      const geo = new THREE.CircleGeometry(R * 1.1, 96);
      geo.rotateX(-PI / 2);
      geo.translate(0, -1, 0);
      const mat = new THREE.MeshBasicMaterial({ color: 0x060b06 });
      scene.add(new THREE.Mesh(geo, mat));
      // Horizon glow ring
      const pts = [];
      for (let i = 0; i <= 128; i++) {
        const a = (i / 128) * 2 * PI;
        pts.push(R * 0.99 * Math.sin(a), 0, R * 0.99 * Math.cos(a));
      }
      const hGeo = new THREE.BufferGeometry();
      hGeo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
      scene.add(new THREE.Line(hGeo, new THREE.LineBasicMaterial({ color: 0x223322, opacity: 0.9, transparent: true })));
    }

    // ── Stars ──────────────────────────────────────────────────────────────
    {
      const positions = [], colors = [], sizes = [], brightFlags = [];
      const uniqueStars = [];
      const seen = new Set();
      for (const s of STARS) {
        const k = `${s[0].toFixed(1)},${s[1].toFixed(1)}`;
        if (seen.has(k)) continue;
        seen.add(k);
        if (s[2] > 5.5) continue;
        const { alt, az } = eq2altaz(s[0], s[1], lst, lat);
        const v = hor2xyz(alt, az);
        positions.push(v.x, v.y, v.z);
        const [r, g, b] = SPEC_COLORS[s[3] ?? 1];
        // Atmospheric extinction near horizon (dims stars below 10° alt)
        const altDeg = alt / RAD;
        const extFactor = altDeg < 5 ? 0.3 : altDeg < 10 ? 0.65 : 1.0;
        const bright = extFactor * Math.min(1, Math.max(0.2, 1.0 - (s[2] + 1.5) / 7.5));
        colors.push(r * bright, g * bright, b * bright);
        const sz = Math.max(1.5, 7.0 - s[2] * 1.1);
        sizes.push(sz);
        brightFlags.push(s[2] < 1.5 ? 1.0 : 0.0);
        uniqueStars.push(s);
      }

      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      geo.setAttribute('color',    new THREE.Float32BufferAttribute(colors, 3));
      geo.setAttribute('size',     new THREE.Float32BufferAttribute(sizes, 1));
      geo.setAttribute('bright',   new THREE.Float32BufferAttribute(brightFlags, 1));

      const mat = new THREE.ShaderMaterial({
        uniforms: {},
        vertexShader: `
          attribute float size;
          attribute vec3 color;
          attribute float bright;
          varying vec3 vColor;
          varying float vBright;
          void main() {
            vColor = color;
            vBright = bright;
            vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
            gl_Position = projectionMatrix * mvPos;
            gl_PointSize = size * (600.0 / -mvPos.z);
            gl_PointSize = clamp(gl_PointSize, 1.0, 18.0);
          }
        `,
        fragmentShader: `
          varying vec3 vColor;
          varying float vBright;
          void main() {
            vec2 uv = gl_PointCoord - 0.5;
            float r = dot(uv, uv);
            if (r > 0.25) discard;
            // Bright core + soft halo
            float core = exp(-r * 30.0);
            float halo = exp(-r * 8.0) * 0.45;
            float alpha = core + halo;
            // For very bright stars add a slight bloom
            vec3 col = vColor * (core * 1.4 + halo);
            col += vBright * vColor * exp(-r * 3.0) * 0.3;
            gl_FragColor = vec4(col, alpha * 0.95);
          }
        `,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      scene.add(new THREE.Points(geo, mat));
    }

    // ── Constellation lines ────────────────────────────────────────────────
    {
      const pos = [];
      for (const [ra1, dec1, ra2, dec2] of CONST_LINES) {
        const h1 = eq2altaz(ra1, dec1, lst, lat);
        const h2 = eq2altaz(ra2, dec2, lst, lat);
        const v1 = hor2xyz(h1.alt, h1.az, R * 0.97);
        const v2 = hor2xyz(h2.alt, h2.az, R * 0.97);
        pos.push(v1.x, v1.y, v1.z, v2.x, v2.y, v2.z);
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      const mat = new THREE.LineBasicMaterial({
        color: 0x3a5888,
        transparent: true,
        opacity: 0.55,
        blending: THREE.AdditiveBlending,
      });
      scene.add(new THREE.LineSegments(geo, mat));
    }

    // ── Altitude circles (30°, 60°) ────────────────────────────────────────
    {
      const gridMat = new THREE.LineBasicMaterial({ color: 0x1a2640, transparent: true, opacity: 0.5 });
      for (const altDeg of [30, 60]) {
        const alt = altDeg * RAD;
        const pts = [];
        for (let i = 0; i <= 96; i++) {
          const az = (i / 96) * 2 * PI;
          const v = hor2xyz(alt, az, R * 0.96);
          pts.push(v.x, v.y, v.z);
        }
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
        scene.add(new THREE.Line(g, gridMat));
      }
    }

    // ── Planets ────────────────────────────────────────────────────────────
    {
      for (const [name, el] of Object.entries(PLANET_DEFS)) {
        const { ra, dec } = planetRaDec(name, jd);
        const { alt, az } = eq2altaz(ra, dec, lst, lat);
        const v = hor2xyz(alt, az, R * 0.95);
        // Glow sprite
        const spriteMat = new THREE.SpriteMaterial({
          color: el.color,
          transparent: true,
          opacity: 0.9,
          blending: THREE.AdditiveBlending,
          sizeAttenuation: true,
        });
        const sprite = new THREE.Sprite(spriteMat);
        sprite.position.copy(v);
        sprite.scale.setScalar(el.size * 4);
        scene.add(sprite);
        // Solid center
        const geo = new THREE.SphereGeometry(el.size * 0.5, 6, 6);
        const mat = new THREE.MeshBasicMaterial({ color: el.color });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.copy(v);
        scene.add(mesh);
      }
    }

    // ── Cardinal direction markers ─────────────────────────────────────────
    // We'll overlay these as HTML divs via a ref update
    const cardinals = [
      { label: 'N', az: 0 },
      { label: 'NE', az: PI * 0.25 },
      { label: 'E', az: PI * 0.5 },
      { label: 'SE', az: PI * 0.75 },
      { label: 'S', az: PI },
      { label: 'SW', az: PI * 1.25 },
      { label: 'W', az: PI * 1.5 },
      { label: 'NW', az: PI * 1.75 },
    ].map(c => {
      const v = hor2xyz(0, c.az, R * 0.93);
      return { ...c, v };
    });
    refs.current.cardinals = cardinals;

    // ── Render loop ────────────────────────────────────────────────────────
    let running = true;
    refs.current.scene = scene;
    refs.current.renderer = renderer;

    function animate() {
      if (!running) return;
      refs.current.raf = requestAnimationFrame(animate);
      updateCardinalOverlay();
      renderer.render(scene, cam);
    }
    animate();

    // ── Cardinal overlay ───────────────────────────────────────────────────
    const overlayEl = refs.current.overlayEl;
    function updateCardinalOverlay() {
      if (!overlayEl) return;
      const rect = el.getBoundingClientRect();
      const W2 = rect.width, H2 = rect.height;
      const labels = overlayEl.querySelectorAll('.sky-cardinal');
      (refs.current.cardinals || []).forEach((c, i) => {
        const label = labels[i];
        if (!label) return;
        const v4 = c.v.clone().project(cam);
        if (v4.z > 1) { label.style.display = 'none'; return; }
        const x = (v4.x + 1) / 2 * W2;
        const y = (1 - v4.y) / 2 * H2;
        label.style.display = 'block';
        label.style.left = x + 'px';
        label.style.top  = y + 'px';
      });
    }

    // ── Resize ─────────────────────────────────────────────────────────────
    function onResize() {
      const w = el.clientWidth, h = el.clientHeight || 520;
      cam.aspect = w / h;
      cam.updateProjectionMatrix();
      renderer.setSize(w, h);
    }
    window.addEventListener('resize', onResize);

    // ── Pointer drag ───────────────────────────────────────────────────────
    function startDrag(x, y) { Object.assign(stateRef.current, { drag: true, lastX: x, lastY: y }); }
    function moveDrag(x, y) {
      if (!stateRef.current.drag) return;
      const s = stateRef.current;
      s.theta -= (x - s.lastX) * 0.004;
      s.phi = Math.max(-PI * 0.45, Math.min(PI * 0.45, s.phi + (y - s.lastY) * 0.004));
      s.lastX = x; s.lastY = y;
      applyCamera();
    }
    function endDrag() { stateRef.current.drag = false; }

    const cvs = renderer.domElement;
    cvs.addEventListener('mousedown', e => startDrag(e.clientX, e.clientY));
    window.addEventListener('mousemove', e => moveDrag(e.clientX, e.clientY));
    window.addEventListener('mouseup', endDrag);
    cvs.addEventListener('touchstart', e => { e.preventDefault(); startDrag(e.touches[0].clientX, e.touches[0].clientY); }, { passive: false });
    cvs.addEventListener('touchmove',  e => { e.preventDefault(); moveDrag(e.touches[0].clientX, e.touches[0].clientY); }, { passive: false });
    cvs.addEventListener('touchend', endDrag);
    cvs.addEventListener('wheel', e => {
      stateRef.current.fov = Math.max(18, Math.min(110, stateRef.current.fov + e.deltaY * 0.04));
      applyCamera();
    }, { passive: true });

    applyCamera();

    return () => {
      running = false;
      cancelAnimationFrame(refs.current.raf);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('mousemove', moveDrag);
      window.removeEventListener('mouseup', endDrag);
      renderer.dispose();
      if (el.contains(cvs)) el.removeChild(cvs);
    };
  }, [lat, lon, date.toDateString(), applyCamera]);

  // Store overlay ref so the animation loop can access it
  const overlayRef = useCallback(node => {
    refs.current.overlayEl = node;
  }, []);

  // Cardinal labels (created server-side, positioned by JS)
  const cardinalDefs = [
    { label: 'N', az: 0 }, { label: 'NE', az: 0.25 }, { label: 'E', az: 0.5 }, { label: 'SE', az: 0.75 },
    { label: 'S', az: 1 }, { label: 'SW', az: 1.25 }, { label: 'W', az: 1.5 }, { label: 'NW', az: 1.75 },
  ];

  return (
    <div style={{ position: 'relative', userSelect: 'none' }}>
      <div ref={mountRef} style={{ width: '100%', height: 520, cursor: 'grab', background: '#000', overflow: 'hidden' }} />

      {/* Cardinal labels overlay */}
      <div ref={overlayRef} style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
        {cardinalDefs.map(c => (
          <span key={c.label} className="sky-cardinal" style={{
            position: 'absolute', transform: 'translate(-50%,-50%)',
            fontFamily: 'JetBrains Mono, monospace', fontSize: c.label.length === 1 ? 12 : 10,
            color: c.label.length === 1 ? '#4466aa' : '#2a3d5a',
            letterSpacing: '0.06em', display: 'none',
          }}>{c.label}</span>
        ))}
      </div>

      {/* Controls hint */}
      <div style={{ position: 'absolute', bottom: 12, left: 14, color: '#2a3d5a', fontFamily: 'JetBrains Mono, monospace', fontSize: 10, pointerEvents: 'none', lineHeight: 1.8 }}>
        <div>Drag to look around · Scroll to zoom</div>
      </div>

      {/* Planet legend */}
      <div style={{ position: 'absolute', top: 10, right: 14, display: 'flex', gap: 10, fontSize: 10, fontFamily: 'JetBrains Mono, monospace', color: '#2a3d60', pointerEvents: 'none', flexWrap: 'wrap', justifyContent: 'flex-end', maxWidth: 200 }}>
        {Object.entries(PLANET_DEFS).map(([name, el]) => {
          const hex = '#' + el.color.getHexString();
          return (
            <span key={name} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: hex, display: 'inline-block' }} />
              {name}
            </span>
          );
        })}
      </div>
    </div>
  );
}
