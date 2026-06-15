import { useEffect, useRef, useCallback } from 'react';
import * as THREE from 'three';
import { STARS, CONST_LINES } from './src/star-data.js';

const R   = 900;
const PI  = Math.PI;
const RAD = PI / 180;

const NGP_RA  = 192.859508 * RAD;
const NGP_DEC = 27.128336  * RAD;
const NGP_L0  = 122.932    * RAD;

const SPEC_COLORS = [
  [0.70, 0.78, 1.00],  // O/B  — blue-white
  [1.00, 0.99, 0.97],  // A/F  — white
  [1.00, 0.99, 0.78],  // G    — yellow-white
  [1.00, 0.68, 0.32],  // K    — orange
  [1.00, 0.38, 0.20],  // M    — red
];

// Stars to always label (name, mag threshold)
const LABEL_THRESHOLD = 1.8;

// ── Astronomy ──────────────────────────────────────────────────────────────
function julianDay(date) {
  const Y = date.getUTCFullYear(), M = date.getUTCMonth() + 1, D = date.getUTCDate();
  const h = date.getUTCHours() + date.getUTCMinutes() / 60;
  let a = Math.floor((14 - M) / 12), y = Y + 4800 - a, m = M + 12 * a - 3;
  let jdn = D + Math.floor((153*m+2)/5) + 365*y + Math.floor(y/4) - Math.floor(y/100) + Math.floor(y/400) - 32045;
  return jdn + (h - 12) / 24;
}
function gmstDeg(date) {
  const jd = julianDay(date), T = (jd - 2451545) / 36525;
  return ((280.46061837 + 360.98564736629 * (jd - 2451545) + 0.000387933 * T * T) % 360 + 360) % 360;
}
function lstDeg(date, lon) { return ((gmstDeg(date) + lon) % 360 + 360) % 360; }

function eq2altaz(ra_deg, dec_deg, lst_deg, lat_deg) {
  const H   = (lst_deg - ra_deg) * RAD;
  const dec = dec_deg * RAD, lat = lat_deg * RAD;
  const sinAlt = Math.sin(lat)*Math.sin(dec) + Math.cos(lat)*Math.cos(dec)*Math.cos(H);
  const alt    = Math.asin(Math.max(-1, Math.min(1, sinAlt)));
  const cosAz  = (Math.sin(dec) - sinAlt*Math.sin(lat)) / (Math.cos(alt)*Math.cos(lat) + 1e-9);
  const sinAz  = -Math.cos(dec)*Math.sin(H) / (Math.cos(alt) + 1e-9);
  return { alt, az: Math.atan2(sinAz, cosAz) };
}

// scene: x=east, y=zenith, z=north
function hor2xyz(alt, az, r = R) {
  return new THREE.Vector3(
    r * Math.cos(alt) * Math.sin(az),
    r * Math.sin(alt),
    r * Math.cos(alt) * Math.cos(az),
  );
}

// ── Milky Way ──────────────────────────────────────────────────────────────
function galLat(ra_rad, dec_rad) {
  const sinB = Math.sin(NGP_DEC)*Math.sin(dec_rad) + Math.cos(NGP_DEC)*Math.cos(dec_rad)*Math.cos(ra_rad - NGP_RA);
  return Math.asin(Math.max(-1, Math.min(1, sinB)));
}
function galLon(ra_rad, dec_rad) {
  const sinL = Math.cos(dec_rad)*Math.sin(ra_rad - NGP_RA);
  const cosL = Math.cos(NGP_DEC)*Math.sin(dec_rad) - Math.sin(NGP_DEC)*Math.cos(dec_rad)*Math.cos(ra_rad - NGP_RA);
  return ((Math.atan2(sinL, cosL) + NGP_L0) % (2*PI) + 2*PI) % (2*PI);
}
function mwDensity(l, b) {
  const ld = l/RAD, bd = b/RAD;
  const core = Math.exp(-bd*bd/(2*7*7));
  const wing = Math.exp(-bd*bd/(2*15*15))*0.4;
  const lc   = Math.min(ld, 360-ld);
  const ctr  = 1.0 + 1.8*Math.exp(-lc*lc/(2*55*55));
  const cyg  = 0.55*Math.exp(-(ld-80)*(ld-80)/(2*28*28));
  const car  = 0.65*Math.exp(-(ld-285)*(ld-285)/(2*22*22));
  const sct  = 0.45*Math.exp(-(ld-30)*(ld-30)/(2*18*18));
  return (core + wing) * (ctr + cyg + car + sct) * 0.28;
}
function buildMilkyWayTex(lst_deg, lat_deg) {
  const W = 512, H = 256;
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d');
  const img = ctx.createImageData(W, H); const d = img.data;
  const lat = lat_deg * RAD;
  for (let j = 0; j < H; j++) {
    const alt = (0.5 - j/H) * PI;
    const sinAlt = Math.sin(alt), cosAlt = Math.cos(alt);
    const sinLat = Math.sin(lat), cosLat = Math.cos(lat);
    for (let i = 0; i < W; i++) {
      const az = (i/W) * 2*PI;
      const sinDec = sinLat*sinAlt + cosLat*cosAlt*Math.cos(az);
      const dec    = Math.asin(Math.max(-1, Math.min(1, sinDec)));
      const cosH   = (sinAlt - sinLat*sinDec) / (cosLat*Math.cos(dec) + 1e-9);
      const sinH   = -cosAlt*Math.sin(az) / (Math.cos(dec) + 1e-9);
      const ra     = ((lst_deg*RAD - Math.atan2(sinH,cosH)) % (2*PI) + 2*PI) % (2*PI);
      const b = galLat(ra, dec), l = galLon(ra, dec);
      const dens = mwDensity(l, b);
      if (dens > 0.008) {
        const idx = (j*W+i)*4, br = Math.min(1, dens);
        d[idx]   = Math.round(br * 130);
        d[idx+1] = Math.round(br * 155);
        d[idx+2] = Math.round(br * 215);
        d[idx+3] = Math.round(br * 210);
      }
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(cv);
  tex.wrapS = THREE.RepeatWrapping;
  return tex;
}

// ── Terrain (outback hills + scrub) ───────────────────────────────────────
function prand(x) { const s = Math.sin(x*127.1+311.7)*43758.5; return s - Math.floor(s); }

function buildTerrain(scene) {
  const N = 720; // points around 360°
  const profile = [];
  for (let i = 0; i < N; i++) {
    const a = (i / N) * 2 * PI;
    // Rolling hills (sum of sines, fixed phase)
    let h = 1.5
          + 2.2 * Math.sin(a*1 + 0.3) + 1.4 * Math.sin(a*2 + 1.1)
          + 0.9 * Math.sin(a*3 + 2.7) + 0.7 * Math.sin(a*5 + 0.8)
          + 0.45* Math.sin(a*7 + 1.5) + 0.3 * Math.sin(a*11+ 3.2)
          + 0.2 * Math.sin(a*17+ 0.7);
    // Occasional scrub/tree spikes
    h += prand(i*0.31) > 0.82 ? prand(i*0.57) * 2.8 : 0;
    h += prand(i*0.61) > 0.92 ? prand(i*0.43) * 1.4 : 0;
    profile.push(Math.max(0.15, h) * RAD);
  }

  // Build geometry: strip from terrain height down to nadir
  const verts = [];
  const base  = -PI/2; // nadir
  for (let i = 0; i < N; i++) {
    const i1   = (i + 1) % N;
    const az0  = (i  / N) * 2 * PI;
    const az1  = (i1 / N) * 2 * PI;
    const h0   = profile[i], h1 = profile[i1];
    const tl   = hor2xyz(h0, az0, R * 0.95);
    const tr   = hor2xyz(h1, az1, R * 0.95);
    const bl   = hor2xyz(base, az0, R * 0.95);
    const br   = hor2xyz(base, az1, R * 0.95);
    verts.push(tl.x,tl.y,tl.z, tr.x,tr.y,tr.z, bl.x,bl.y,bl.z);
    verts.push(tr.x,tr.y,tr.z, br.x,br.y,br.z, bl.x,bl.y,bl.z);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));

  // Two-colour: dark silhouette body + subtle rim at top
  scene.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0x030904, side: THREE.FrontSide, depthTest: true })));

  // Top edge line for the horizon silhouette rim
  const rimPts = [];
  for (let i = 0; i <= N; i++) { const v = hor2xyz(profile[i % N], (i/N)*2*PI, R*0.951); rimPts.push(v.x,v.y,v.z); }
  const rimGeo = new THREE.BufferGeometry();
  rimGeo.setAttribute('position', new THREE.Float32BufferAttribute(rimPts, 3));
  scene.add(new THREE.Line(rimGeo, new THREE.LineBasicMaterial({ color: 0x0d1a0d, transparent: true, opacity: 0.8 })));
}

// ── Planets ────────────────────────────────────────────────────────────────
const PLANET_DEFS = {
  Mercury: { L0:252.25, n:4.09234, color:new THREE.Color(0.72,0.72,0.72), size:3.5, label:'Mercury' },
  Venus:   { L0:181.98, n:1.60213, color:new THREE.Color(1.00,0.96,0.72), size:7,   label:'Venus'   },
  Mars:    { L0:355.45, n:0.52403, color:new THREE.Color(1.00,0.42,0.20), size:4.5, label:'Mars'    },
  Jupiter: { L0:34.40,  n:0.08309, color:new THREE.Color(1.00,0.88,0.70), size:10,  label:'Jupiter' },
  Saturn:  { L0:50.08,  n:0.03346, color:new THREE.Color(0.96,0.91,0.70), size:8,   label:'Saturn'  },
};
function planetRaDec(name, jd) {
  const d = jd - 2451545, el = PLANET_DEFS[name];
  const Lp  = ((el.L0 + el.n*d) % 360 + 360) % 360;
  const eps  = (23.439 - 0.013004*d/36525) * RAD;
  const lRad = Lp * RAD;
  const ra  = ((Math.atan2(Math.cos(eps)*Math.sin(lRad), Math.cos(lRad))/RAD) + 360) % 360;
  const dec = Math.asin(Math.sin(eps)*Math.sin(lRad)) / RAD;
  return { ra, dec };
}

// ── Main component ─────────────────────────────────────────────────────────
export default function SkyDome({ lat, lon, date }) {
  const mountRef  = useRef(null);
  const overlayRef = useRef(null);
  const stateRef  = useRef({ theta: PI, phi: 0.28, drag:false, lastX:0, lastY:0, fov:80 });
  const refs      = useRef({});

  const applyCamera = useCallback(() => {
    const cam = refs.current.cam;
    if (!cam) return;
    const { theta, phi, fov } = stateRef.current;
    const ph = Math.max(-PI*0.44, Math.min(PI*0.44, phi));
    cam.lookAt(Math.cos(ph)*Math.sin(theta), Math.sin(ph), Math.cos(ph)*Math.cos(theta));
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
    const cam   = new THREE.PerspectiveCamera(80, W/H, 0.1, R*3);
    cam.up.set(0,1,0);
    refs.current.cam = cam;

    const jd  = julianDay(date);
    const lst = lstDeg(date, lon);

    // ── Sky sphere (gradient shader) ──────────────────────────────────────
    {
      const geo = new THREE.SphereGeometry(R*1.5, 48, 32);
      const mat = new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        vertexShader: `
          varying float vAlt;
          void main() {
            vAlt = normalize(position).y;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
          }
        `,
        fragmentShader: `
          varying float vAlt;
          void main() {
            vec3 zenith  = vec3(0.001, 0.003, 0.014);
            vec3 mid     = vec3(0.005, 0.010, 0.032);
            vec3 haze    = vec3(0.012, 0.022, 0.055);
            float t = clamp(vAlt, -0.15, 1.0);
            vec3 col = mix(haze, mid, smoothstep(-0.15, 0.0, t));
            col = mix(col, zenith, smoothstep(0.0, 0.45, t));
            // Horizon glow (atmosphere at alt ≈ 0)
            float glow = exp(-vAlt * vAlt / (2.0 * 0.018)) * 0.08;
            col += vec3(0.04, 0.08, 0.14) * glow;
            gl_FragColor = vec4(col, 1.0);
          }
        `,
      });
      scene.add(new THREE.Mesh(geo, mat));
    }

    // ── Milky Way ─────────────────────────────────────────────────────────
    {
      const mwTex = buildMilkyWayTex(lst, lat);
      mwTex.repeat.x = -1; mwTex.offset.x = 1;
      const geo = new THREE.SphereGeometry(R*0.98, 128, 64);
      const mat = new THREE.MeshBasicMaterial({
        map: mwTex, side: THREE.BackSide,
        transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 1.0,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.rotation.y = PI/2;
      scene.add(mesh);
    }

    // ── Stars ─────────────────────────────────────────────────────────────
    const labelData = []; // [{name, pos3d, mag}]
    {
      const pos=[], col=[], siz=[], blr=[];
      const seen = new Set();
      for (const s of STARS) {
        const k = `${s[0].toFixed(1)},${s[1].toFixed(1)}`;
        if (seen.has(k)) continue; seen.add(k);
        if (s[2] > 5.5) continue;
        const { alt, az } = eq2altaz(s[0], s[1], lst, lat);
        const v = hor2xyz(alt, az);
        pos.push(v.x, v.y, v.z);
        const [r,g,b] = SPEC_COLORS[s[3] ?? 1];
        const altDeg = alt/RAD;
        const ext    = altDeg < 5 ? 0.25 : altDeg < 10 ? 0.6 : 1.0;
        const bright = ext * Math.min(1, Math.max(0.15, 1.0 - (s[2]+1.5)/7.5));
        col.push(r*bright, g*bright, b*bright);
        siz.push(Math.max(1.2, 7.5 - s[2]*1.1));
        blr.push(s[2] < 1.5 ? 1.0 : 0.0);
        // collect label candidates
        if (s[4] && s[2] <= LABEL_THRESHOLD) {
          labelData.push({ name: s[4], v: v.clone(), mag: s[2] });
        }
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos,3));
      geo.setAttribute('color',    new THREE.Float32BufferAttribute(col,3));
      geo.setAttribute('size',     new THREE.Float32BufferAttribute(siz,1));
      geo.setAttribute('bright',   new THREE.Float32BufferAttribute(blr,1));
      const mat = new THREE.ShaderMaterial({
        uniforms: {},
        vertexShader:`
          attribute float size; attribute vec3 color; attribute float bright;
          varying vec3 vCol; varying float vBr;
          void main(){
            vCol=color; vBr=bright;
            vec4 mv=modelViewMatrix*vec4(position,1.0);
            gl_Position=projectionMatrix*mv;
            gl_PointSize=size*(650.0/-mv.z);
            gl_PointSize=clamp(gl_PointSize,1.0,20.0);
          }
        `,
        fragmentShader:`
          varying vec3 vCol; varying float vBr;
          void main(){
            vec2 uv=gl_PointCoord-0.5; float r=dot(uv,uv);
            if(r>0.25) discard;
            float core=exp(-r*28.0);
            float halo=exp(-r*7.0)*0.5;
            float bloom=vBr*exp(-r*2.5)*0.4;
            float alpha=(core+halo)*0.97;
            vec3 col=vCol*(core*1.5+halo)+vCol*bloom;
            gl_FragColor=vec4(col,alpha);
          }
        `,
        transparent:true, blending:THREE.AdditiveBlending, depthWrite:false,
      });
      scene.add(new THREE.Points(geo, mat));
    }

    // ── Constellation lines ───────────────────────────────────────────────
    {
      const pts=[];
      for(const [ra1,dec1,ra2,dec2] of CONST_LINES){
        const h1=eq2altaz(ra1,dec1,lst,lat), h2=eq2altaz(ra2,dec2,lst,lat);
        const v1=hor2xyz(h1.alt,h1.az,R*0.97), v2=hor2xyz(h2.alt,h2.az,R*0.97);
        pts.push(v1.x,v1.y,v1.z, v2.x,v2.y,v2.z);
      }
      const geo=new THREE.BufferGeometry();
      geo.setAttribute('position',new THREE.Float32BufferAttribute(pts,3));
      scene.add(new THREE.LineSegments(geo,new THREE.LineBasicMaterial({
        color:0x2a4a77, transparent:true, opacity:0.65, blending:THREE.AdditiveBlending
      })));
    }

    // ── Terrain silhouette ────────────────────────────────────────────────
    buildTerrain(scene);

    // ── Planets + labels ──────────────────────────────────────────────────
    const planetLabelData = [];
    {
      for(const [name,el] of Object.entries(PLANET_DEFS)){
        const { ra, dec } = planetRaDec(name, jd);
        const { alt, az } = eq2altaz(ra, dec, lst, lat);
        const v = hor2xyz(alt, az, R*0.95);
        // Glow sprite
        const sp = new THREE.Sprite(new THREE.SpriteMaterial({
          color:el.color, transparent:true, opacity:0.85, blending:THREE.AdditiveBlending, sizeAttenuation:true,
        }));
        sp.position.copy(v); sp.scale.setScalar(el.size*5);
        scene.add(sp);
        // Solid dot
        const m = new THREE.Mesh(new THREE.SphereGeometry(el.size*0.55,6,6), new THREE.MeshBasicMaterial({color:el.color}));
        m.position.copy(v); scene.add(m);
        // Label (always shown for planets)
        planetLabelData.push({ name, v: v.clone() });
      }
    }

    // ── Altitude circles ──────────────────────────────────────────────────
    {
      const gm = new THREE.LineBasicMaterial({color:0x182030, transparent:true, opacity:0.55});
      for(const ad of [30,60]){
        const pts=[];
        for(let i=0;i<=96;i++){ const az=(i/96)*2*PI; const v=hor2xyz(ad*RAD,az,R*0.96); pts.push(v.x,v.y,v.z); }
        const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.Float32BufferAttribute(pts,3));
        scene.add(new THREE.Line(g,gm));
      }
    }

    // ── Labels: bright stars + planets + cardinals ─────────────────────────
    refs.current.labelData       = labelData;
    refs.current.planetLabelData = planetLabelData;
    refs.current.cardinalData    = [
      {label:'N',az:0},{label:'NE',az:PI*0.25},{label:'E',az:PI*0.5},{label:'SE',az:PI*0.75},
      {label:'S',az:PI},{label:'SW',az:PI*1.25},{label:'W',az:PI*1.5},{label:'NW',az:PI*1.75},
    ].map(c=>({ ...c, v: hor2xyz(0.01, c.az, R*0.93) }));

    // ── Render loop ───────────────────────────────────────────────────────
    let running = true;
    function projectLabel(v3, W2, H2) {
      const ndc = v3.clone().project(cam);
      if (ndc.z > 1) return null;
      return { x:(ndc.x+1)/2*W2, y:(1-ndc.y)/2*H2 };
    }

    function updateOverlay() {
      const ov = overlayRef.current; if(!ov) return;
      const rect = el.getBoundingClientRect();
      const W2 = rect.width, H2 = rect.height;
      const spans = ov.querySelectorAll('[data-sky-label]');
      let idx = 0;
      const allLabels = [
        ...(refs.current.labelData||[]).map(l=>({...l,type:'star'})),
        ...(refs.current.planetLabelData||[]).map(l=>({...l,type:'planet'})),
        ...(refs.current.cardinalData||[]).map(l=>({...l,type:'cardinal'})),
      ];
      allLabels.forEach((item, i) => {
        const span = spans[i]; if(!span) return;
        const pos = projectLabel(item.v, W2, H2);
        if(!pos) { span.style.display='none'; return; }
        span.style.display='block';
        span.style.left = pos.x+'px';
        span.style.top  = pos.y+'px';
      });
    }

    function animate() {
      if(!running) return;
      refs.current.raf = requestAnimationFrame(animate);
      updateOverlay();
      renderer.render(scene, cam);
    }
    animate();

    // ── Resize ────────────────────────────────────────────────────────────
    function onResize() {
      const w=el.clientWidth, h=el.clientHeight||520;
      cam.aspect=w/h; cam.updateProjectionMatrix(); renderer.setSize(w,h);
    }
    window.addEventListener('resize', onResize);

    // ── Drag ─────────────────────────────────────────────────────────────
    function startDrag(x,y){Object.assign(stateRef.current,{drag:true,lastX:x,lastY:y});}
    function moveDrag(x,y){
      if(!stateRef.current.drag) return;
      const s=stateRef.current;
      s.theta -= (x-s.lastX)*0.0038;
      s.phi = Math.max(-PI*0.44, Math.min(PI*0.44, s.phi + (y-s.lastY)*0.0038));
      s.lastX=x; s.lastY=y;
      applyCamera();
    }
    function endDrag(){stateRef.current.drag=false;}
    const cvs = renderer.domElement;
    cvs.addEventListener('mousedown',  e=>startDrag(e.clientX,e.clientY));
    window.addEventListener('mousemove', e=>moveDrag(e.clientX,e.clientY));
    window.addEventListener('mouseup',   endDrag);
    cvs.addEventListener('touchstart', e=>{e.preventDefault();startDrag(e.touches[0].clientX,e.touches[0].clientY);},{passive:false});
    cvs.addEventListener('touchmove',  e=>{e.preventDefault();moveDrag(e.touches[0].clientX,e.touches[0].clientY);},{passive:false});
    cvs.addEventListener('touchend', endDrag);
    cvs.addEventListener('wheel', e=>{
      stateRef.current.fov=Math.max(18,Math.min(110,stateRef.current.fov+e.deltaY*0.04));
      applyCamera();
    },{passive:true});

    applyCamera();

    return()=>{
      running=false;
      cancelAnimationFrame(refs.current.raf);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('mousemove', moveDrag);
      window.removeEventListener('mouseup', endDrag);
      renderer.dispose();
      if(el.contains(cvs)) el.removeChild(cvs);
    };
  }, [lat, lon, date.toDateString(), applyCamera]);

  // Pre-compute label list (must match allLabels order in animate loop)
  // We build placeholders here; positions are updated in the render loop
  const starLabels   = STARS.filter(s=>s[4] && s[2]<=LABEL_THRESHOLD && !({}).hasOwnProperty);
  // Dedupe
  const seenL=new Set();
  const filteredLabels = STARS.filter(s=>{
    if(!s[4]||s[2]>LABEL_THRESHOLD) return false;
    const k=`${s[0].toFixed(1)},${s[1].toFixed(1)}`;
    if(seenL.has(k)) return false; seenL.add(k); return true;
  });
  const cardinalDefs=[
    {label:'N'},{label:'NE'},{label:'E'},{label:'SE'},{label:'S'},{label:'SW'},{label:'W'},{label:'NW'},
  ];

  return (
    <div style={{position:'relative',userSelect:'none'}}>
      <div ref={mountRef} style={{width:'100%',height:520,cursor:'grab',background:'#000',overflow:'hidden'}}/>

      {/* Label overlay */}
      <div ref={overlayRef} style={{position:'absolute',inset:0,pointerEvents:'none',overflow:'hidden'}}>
        {/* Star labels */}
        {filteredLabels.map((s,i)=>(
          <span key={`st${i}`} data-sky-label="1" style={{
            position:'absolute', transform:'translate(8px,-50%)',
            fontFamily:'Archivo,sans-serif', fontSize:11,
            color:'#9ab0cc', pointerEvents:'none', display:'none', whiteSpace:'nowrap',
            textShadow:'0 0 4px #000,0 0 8px #000',
          }}>{s[4]}</span>
        ))}
        {/* Planet labels */}
        {Object.keys(PLANET_DEFS).map((name,i)=>(
          <span key={`pl${i}`} data-sky-label="1" style={{
            position:'absolute', transform:'translate(8px,-50%)',
            fontFamily:'Archivo,sans-serif', fontSize:12, fontWeight:600,
            color:'#ddc98a', pointerEvents:'none', display:'none', whiteSpace:'nowrap',
            textShadow:'0 0 4px #000,0 0 8px #000',
          }}>{name}</span>
        ))}
        {/* Cardinal labels */}
        {cardinalDefs.map(c=>(
          <span key={`cd${c.label}`} data-sky-label="1" style={{
            position:'absolute', transform:'translate(-50%,-50%)',
            fontFamily:'JetBrains Mono,monospace',
            fontSize: c.label.length===1 ? 13 : 10,
            color: c.label.length===1 ? '#c05030' : '#6a3520',
            display:'none', letterSpacing:'0.06em',
            textShadow:'0 0 6px #000',
          }}>{c.label}</span>
        ))}
      </div>

      <div style={{position:'absolute',bottom:10,left:12,color:'#1e2e40',fontFamily:'JetBrains Mono,monospace',fontSize:10,pointerEvents:'none'}}>
        Drag · Scroll to zoom
      </div>
    </div>
  );
}
