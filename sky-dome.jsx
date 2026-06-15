import { useEffect, useRef, useCallback } from 'react';
import * as THREE from 'three';
import { STARS, CONST_LINES, MILKY_WAY_SPINE } from './src/star-data.js';

const R = 800; // dome radius
const PI = Math.PI;
const RAD = PI / 180;

// Spectral colors
const SPEC_COLORS = [
  new THREE.Color(0.6, 0.7, 1.0),  // O/B blue-white
  new THREE.Color(1.0, 1.0, 1.0),  // A/F white
  new THREE.Color(1.0, 1.0, 0.85), // G yellow-white
  new THREE.Color(1.0, 0.7, 0.4),  // K orange
  new THREE.Color(1.0, 0.4, 0.25), // M red
];

function julianDay(date) {
  const Y = date.getUTCFullYear(), M = date.getUTCMonth() + 1, D = date.getUTCDate();
  const h = date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600;
  let a = Math.floor((14 - M) / 12);
  let y = Y + 4800 - a, m = M + 12 * a - 3;
  let jdn = D + Math.floor((153 * m + 2) / 5) + 365 * y + Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400) - 32045;
  return jdn + (h - 12) / 24;
}

function gmst(date) {
  const jd = julianDay(date);
  const T = (jd - 2451545.0) / 36525;
  let g = 280.46061837 + 360.98564736629 * (jd - 2451545.0) + 0.000387933 * T * T;
  return ((g % 360) + 360) % 360;
}

function lst(date, lon_deg) {
  return ((gmst(date) + lon_deg) % 360 + 360) % 360;
}

function eq2hor(ra_deg, dec_deg, lst_deg, lat_deg) {
  const ra = ra_deg * RAD, dec = dec_deg * RAD;
  const H = (lst_deg - ra_deg) * RAD;
  const lat = lat_deg * RAD;
  const sinAlt = Math.sin(lat) * Math.sin(dec) + Math.cos(lat) * Math.cos(dec) * Math.cos(H);
  const alt = Math.asin(Math.max(-1, Math.min(1, sinAlt)));
  const cosAz = (Math.sin(dec) - sinAlt * Math.sin(lat)) / (Math.cos(alt) * Math.cos(lat));
  const sinAz = -Math.cos(dec) * Math.sin(H) / Math.cos(alt);
  const az = Math.atan2(sinAz, cosAz);
  return { alt, az };
}

// Horizontal (alt, az) -> Three.js Cartesian
// Convention: x=east, y=zenith, z=north (camera default looks -z = south)
// So north = +z:
function hor2xyz(alt, az) {
  return [
    R * Math.cos(alt) * Math.sin(az),
    R * Math.sin(alt),
    R * Math.cos(alt) * Math.cos(az),
  ];
}

function starSize(mag) {
  return Math.max(1.0, 5.0 - mag * 0.9);
}

// Simplified planet positions (Jean Meeus, Ch 33 — heliocentric → geocentric RA/Dec)
function sunLon(jd) {
  const T = (jd - 2451545.0) / 36525;
  const L0 = (280.46646 + 36000.76983 * T) % 360;
  const M = ((357.52911 + 35999.05029 * T) % 360) * RAD;
  const C = (1.914602 - 0.004817 * T) * Math.sin(M)
           + 0.019993 * Math.sin(2 * M)
           + 0.000289 * Math.sin(3 * M);
  return (L0 + C + 360) % 360;
}

function sunRaDec(jd) {
  const lsun = sunLon(jd) * RAD;
  const eps = (23.439291 - 0.013004 * (jd - 2451545.0) / 36525) * RAD;
  const ra = Math.atan2(Math.cos(eps) * Math.sin(lsun), Math.cos(lsun));
  const dec = Math.asin(Math.sin(eps) * Math.sin(lsun));
  return { ra: ((ra / RAD) + 360) % 360, dec: dec / RAD };
}

// Approximate planet (heliocentric L + very crude geocentric offset)
// Uses mean longitude & period only — good to ~5° for display
const PLANET_ELEMS = {
  Mercury: { L0: 252.25, n: 4.09234, color: 0xaaaaaa, size: 4 },
  Venus:   { L0: 181.98, n: 1.60213, color: 0xffeecc, size: 6 },
  Mars:    { L0: 355.45, n: 0.52403, color: 0xff5533, size: 5 },
  Jupiter: { L0: 34.40,  n: 0.08309, color: 0xffd8a8, size: 8 },
  Saturn:  { L0: 50.08,  n: 0.03346, color: 0xf5deb3, size: 7 },
};

function planetRaDec(name, jd) {
  const el = PLANET_ELEMS[name];
  const d = jd - 2451545.0;
  const Lp = ((el.L0 + el.n * d) % 360 + 360) % 360;
  // Sun's geocentric position opposite to heliocentric direction
  const Ls = sunLon(jd);
  // crude geocentric longitude: planet seen from Earth ~ its mean longitude minus parallax
  // For outer planets the correction is smaller. Use Lp directly as geocentric approx.
  // The error is ~5-20° but the dome is for visual impression only.
  const eps = (23.439291 - 0.013004 * d / 36525) * RAD;
  const lRad = Lp * RAD;
  const ra = Math.atan2(Math.cos(eps) * Math.sin(lRad), Math.cos(lRad));
  const dec = Math.asin(Math.sin(eps) * Math.sin(lRad));
  return { ra: ((ra / RAD) + 360) % 360, dec: dec / RAD };
}

export default function SkyDome({ lat, lon, date }) {
  const mountRef = useRef(null);
  const stateRef = useRef({
    theta: 0,      // look azimuth from north (rad)
    phi: PI / 2,   // look altitude (rad), PI/2 = zenith
    drag: false,
    lastX: 0, lastY: 0,
    fov: 70,
  });
  const rendererRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const starsGeoRef = useRef(null);
  const linesGeoRef = useRef(null);
  const planetMeshesRef = useRef({});
  const animFrameRef = useRef(null);
  const labelDivRef = useRef(null);
  const labelContainerRef = useRef(null);

  const updateCamera = useCallback(() => {
    const cam = cameraRef.current;
    if (!cam) return;
    const { theta, phi, fov } = stateRef.current;
    const ph = Math.max(-PI * 0.48, Math.min(PI * 0.48, phi));
    // look direction in scene coords (x=east, y=zenith, z=north)
    const lx = Math.cos(ph) * Math.sin(theta);
    const ly = Math.sin(ph);
    const lz = Math.cos(ph) * Math.cos(theta);
    cam.lookAt(lx, ly, lz);
    cam.fov = fov;
    cam.updateProjectionMatrix();
  }, []);

  useEffect(() => {
    const el = mountRef.current;
    if (!el) return;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(el.clientWidth, el.clientHeight);
    renderer.setClearColor(0x00000e);
    el.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Scene & camera
    const scene = new THREE.Scene();
    sceneRef.current = scene;
    const cam = new THREE.PerspectiveCamera(70, el.clientWidth / el.clientHeight, 0.1, 2000);
    cam.position.set(0, 0, 0);
    // Camera default looks at -z; we want to start looking at zenith (+y)
    // so set up = north (+z) and lookAt zenith
    cam.up.set(0, 0, 1);
    cam.lookAt(0, 1, 0);
    cameraRef.current = cam;

    const jd = julianDay(date);
    const lstDeg = lst(date, lon);

    // ── Stars ──────────────────────────────────────────────────────────────
    const positions = [];
    const colors = [];
    const sizes = [];

    for (const [ra, dec, mag, sp] of STARS) {
      if (mag > 5.5) continue;
      const { alt, az } = eq2hor(ra, dec, lstDeg, lat);
      const [x, y, z] = hor2xyz(alt, az);
      positions.push(x, y, z);
      const c = SPEC_COLORS[sp] || SPEC_COLORS[1];
      const bright = Math.min(1, Math.max(0.3, 1 - (mag + 1.5) / 7));
      colors.push(c.r * bright, c.g * bright, c.b * bright);
      sizes.push(starSize(mag));
    }

    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    starGeo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    starGeo.setAttribute('size', new THREE.Float32BufferAttribute(sizes, 1));
    starsGeoRef.current = starGeo;

    const starMat = new THREE.ShaderMaterial({
      uniforms: {},
      vertexShader: `
        attribute float size;
        attribute vec3 color;
        varying vec3 vColor;
        varying float vSize;
        void main() {
          vColor = color;
          vSize = size;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = size * (500.0 / -gl_Position.z);
          gl_PointSize = clamp(gl_PointSize, 1.0, 12.0);
        }
      `,
      fragmentShader: `
        varying vec3 vColor;
        varying float vSize;
        void main() {
          vec2 uv = gl_PointCoord - vec2(0.5);
          float r = dot(uv, uv);
          if (r > 0.25) discard;
          float alpha = 1.0 - smoothstep(0.15, 0.25, r);
          float glow = exp(-r * 18.0);
          gl_FragColor = vec4(vColor + glow * 0.4, alpha);
        }
      `,
      transparent: true,
      vertexColors: false,
      depthWrite: false,
    });

    const starPoints = new THREE.Points(starGeo, starMat);
    scene.add(starPoints);

    // ── Milky Way ──────────────────────────────────────────────────────────
    const mwPositions = [];
    const mwColors = [];
    const mwSizes = [];
    const mwCount = 6000;
    for (let i = 0; i < mwCount; i++) {
      // Sample a point along the spine + scatter
      const t = Math.random();
      const idx = Math.floor(t * (MILKY_WAY_SPINE.length - 1));
      const next = Math.min(idx + 1, MILKY_WAY_SPINE.length - 1);
      const frac = t * (MILKY_WAY_SPINE.length - 1) - idx;
      const s0 = MILKY_WAY_SPINE[idx], s1 = MILKY_WAY_SPINE[next];
      const ra = s0[0] + (s1[0] - s0[0]) * frac + (Math.random() - 0.5) * 18;
      const dec = s0[1] + (s1[1] - s0[1]) * frac + (Math.random() - 0.5) * 9;
      const intensity = s0[2] + (s1[2] - s0[2]) * frac;
      const mag = 4.5 + Math.random() * 2;
      const { alt, az } = eq2hor(ra, dec, lstDeg, lat);
      const [x, y, z] = hor2xyz(alt, az);
      mwPositions.push(x, y, z);
      const br = intensity * 0.3 * (0.5 + Math.random() * 0.5);
      mwColors.push(br * 0.7, br * 0.8, br);
      mwSizes.push(1.0 + Math.random() * 1.5);
    }

    const mwGeo = new THREE.BufferGeometry();
    mwGeo.setAttribute('position', new THREE.Float32BufferAttribute(mwPositions, 3));
    mwGeo.setAttribute('color', new THREE.Float32BufferAttribute(mwColors, 3));
    mwGeo.setAttribute('size', new THREE.Float32BufferAttribute(mwSizes, 1));

    const mwMat = new THREE.ShaderMaterial({
      uniforms: {},
      vertexShader: `
        attribute float size;
        attribute vec3 color;
        varying vec3 vColor;
        void main() {
          vColor = color;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = size * (300.0 / -gl_Position.z);
          gl_PointSize = clamp(gl_PointSize, 0.5, 3.0);
        }
      `,
      fragmentShader: `
        varying vec3 vColor;
        void main() {
          vec2 uv = gl_PointCoord - vec2(0.5);
          float r = dot(uv, uv);
          if (r > 0.25) discard;
          gl_FragColor = vec4(vColor, 0.7);
        }
      `,
      transparent: true,
      depthWrite: false,
    });
    scene.add(new THREE.Points(mwGeo, mwMat));

    // ── Constellation lines ────────────────────────────────────────────────
    const linePositions = [];
    for (const [ra1, dec1, ra2, dec2] of CONST_LINES) {
      const h1 = eq2hor(ra1, dec1, lstDeg, lat);
      const h2 = eq2hor(ra2, dec2, lstDeg, lat);
      linePositions.push(...hor2xyz(h1.alt, h1.az));
      linePositions.push(...hor2xyz(h2.alt, h2.az));
    }
    const linesGeo = new THREE.BufferGeometry();
    linesGeo.setAttribute('position', new THREE.Float32BufferAttribute(linePositions, 3));
    linesGeoRef.current = linesGeo;
    const linesMat = new THREE.LineBasicMaterial({ color: 0x334466, transparent: true, opacity: 0.6 });
    scene.add(new THREE.LineSegments(linesGeo, linesMat));

    // ── Horizon ring ───────────────────────────────────────────────────────
    const hPoints = [];
    for (let i = 0; i <= 128; i++) {
      const az = (i / 128) * 2 * PI;
      hPoints.push(R * Math.sin(az), -2, R * Math.cos(az));
    }
    const hGeo = new THREE.BufferGeometry();
    hGeo.setAttribute('position', new THREE.Float32BufferAttribute(hPoints, 3));
    scene.add(new THREE.Line(hGeo, new THREE.LineBasicMaterial({ color: 0x224422, opacity: 0.8, transparent: true })));

    // ── Ground fill (below horizon) ────────────────────────────────────────
    const groundGeo = new THREE.CircleGeometry(R * 1.1, 64);
    groundGeo.rotateX(-PI / 2);
    groundGeo.translate(0, -3, 0);
    scene.add(new THREE.Mesh(groundGeo, new THREE.MeshBasicMaterial({ color: 0x040d04, side: THREE.FrontSide })));

    // ── Alt/Az grid ────────────────────────────────────────────────────────
    const gridMat = new THREE.LineBasicMaterial({ color: 0x1a2233, transparent: true, opacity: 0.4 });
    // Altitude circles at 30° and 60°
    for (const altDeg of [30, 60]) {
      const alt = altDeg * RAD;
      const pts = [];
      for (let i = 0; i <= 64; i++) {
        const az = (i / 64) * 2 * PI;
        pts.push(...hor2xyz(alt, az));
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
      scene.add(new THREE.Line(g, gridMat));
    }
    // Cardinal azimuth lines
    for (let az = 0; az < 360; az += 45) {
      const azR = az * RAD;
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute([
        ...hor2xyz(0, azR), ...hor2xyz(PI / 2.05, azR)
      ], 3));
      scene.add(new THREE.Line(g, gridMat));
    }

    // ── Planets ────────────────────────────────────────────────────────────
    const planetMeshes = {};
    for (const [name, el] of Object.entries(PLANET_ELEMS)) {
      const geo = new THREE.SphereGeometry(el.size, 8, 8);
      const mat = new THREE.MeshBasicMaterial({ color: el.color });
      const mesh = new THREE.Mesh(geo, mat);
      const { ra, dec } = planetRaDec(name, jd);
      const { alt, az } = eq2hor(ra, dec, lstDeg, lat);
      const [x, y, z] = hor2xyz(alt, az);
      mesh.position.set(x, y, z);
      mesh.userData = { name, alt };
      scene.add(mesh);
      planetMeshes[name] = mesh;
    }
    planetMeshesRef.current = planetMeshes;

    // ── Render loop ────────────────────────────────────────────────────────
    let running = true;
    function animate() {
      if (!running) return;
      animFrameRef.current = requestAnimationFrame(animate);
      renderer.render(scene, cam);
    }
    animate();

    // ── Resize ────────────────────────────────────────────────────────────
    function onResize() {
      if (!el) return;
      cam.aspect = el.clientWidth / el.clientHeight;
      cam.updateProjectionMatrix();
      renderer.setSize(el.clientWidth, el.clientHeight);
    }
    window.addEventListener('resize', onResize);

    // ── Mouse/touch drag ──────────────────────────────────────────────────
    function startDrag(clientX, clientY) {
      stateRef.current.drag = true;
      stateRef.current.lastX = clientX;
      stateRef.current.lastY = clientY;
    }
    function moveDrag(clientX, clientY) {
      if (!stateRef.current.drag) return;
      const dx = clientX - stateRef.current.lastX;
      const dy = clientY - stateRef.current.lastY;
      stateRef.current.lastX = clientX;
      stateRef.current.lastY = clientY;
      stateRef.current.theta -= dx * 0.005;
      stateRef.current.phi = Math.max(-PI * 0.48, Math.min(PI * 0.48,
        stateRef.current.phi + dy * 0.005));
      updateCamera();
    }
    function endDrag() { stateRef.current.drag = false; }

    const canvas = renderer.domElement;
    canvas.addEventListener('mousedown', e => startDrag(e.clientX, e.clientY));
    window.addEventListener('mousemove', e => moveDrag(e.clientX, e.clientY));
    window.addEventListener('mouseup', endDrag);
    canvas.addEventListener('touchstart', e => { e.preventDefault(); startDrag(e.touches[0].clientX, e.touches[0].clientY); }, { passive: false });
    canvas.addEventListener('touchmove', e => { e.preventDefault(); moveDrag(e.touches[0].clientX, e.touches[0].clientY); }, { passive: false });
    canvas.addEventListener('touchend', endDrag);

    // Scroll = zoom
    canvas.addEventListener('wheel', e => {
      stateRef.current.fov = Math.max(20, Math.min(120, stateRef.current.fov + e.deltaY * 0.05));
      updateCamera();
    }, { passive: true });

    updateCamera();

    return () => {
      running = false;
      cancelAnimationFrame(animFrameRef.current);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('mousemove', moveDrag);
      window.removeEventListener('mouseup', endDrag);
      renderer.dispose();
      if (el.contains(renderer.domElement)) el.removeChild(renderer.domElement);
    };
  }, [lat, lon, date.toDateString(), updateCamera]);

  return (
    <div style={{ position: 'relative' }}>
      <div ref={mountRef} style={{ width: '100%', height: 480, cursor: 'grab', borderRadius: 0, overflow: 'hidden', background: '#00000e' }} />
      <div style={{ position: 'absolute', top: 10, left: 14, color: '#8899bb', fontFamily: 'JetBrains Mono, monospace', fontSize: 11, pointerEvents: 'none', lineHeight: 1.6 }}>
        <div>Drag to rotate · Scroll to zoom</div>
        <div style={{ color: '#445566' }}>Starting at zenith · N up</div>
      </div>
      <div style={{ position: 'absolute', top: 10, right: 14, display: 'flex', gap: 12, fontSize: 11, fontFamily: 'JetBrains Mono, monospace', color: '#8899bb', pointerEvents: 'none' }}>
        {Object.entries(PLANET_ELEMS).map(([name, el]) => (
          <span key={name} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#' + el.color.toString(16).padStart(6, '0'), display: 'inline-block' }} />
            {name}
          </span>
        ))}
      </div>
    </div>
  );
}
