/**
 * Scène 3D du portfolio : un bureau, un ordinateur, et UN VRAI SITE sur l'écran.
 *
 * Principe (technique « écran CSS3D + trou WebGL ») :
 *  1. Les pages Astro (/accueil, /projets…) sont affichées dans un <iframe> projeté en 3D
 *     par CSS3DRenderer (couche DOM située DERRIÈRE le canvas).
 *  2. Dans le canvas WebGL, la dalle de l'écran est un « trou » (NoBlending + opacity 0) :
 *     on voit donc l'iframe à travers, correctement masqué par le reste du décor.
 *  3. Un clic zoome la caméra (GSAP) jusqu'à ce que l'écran remplisse la fenêtre ;
 *     le canvas devient alors transparent aux clics et l'iframe est utilisable normalement.
 *
 * Tout le décor est procédural (aucun modèle 3D à télécharger) → scène légère.
 */
import * as THREE from 'three';
import { CSS3DRenderer, CSS3DObject } from 'three/addons/renderers/CSS3DRenderer.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import gsap from 'gsap';

/* ───────────── Réglages faciles à ajuster ───────────── */
const SCREEN_W = 0.8; // largeur de la dalle (m)
const SCREEN_H = 0.5; // hauteur (ratio 16:10)
const PAGE_W = 1920; // résolution de la page dans l'écran (px CSS)
const PAGE_H = 1200;
const IDLE_FOV = 38;
const ZOOM_FOV = 26;
const FILL = 1.07; // marge autour de l'écran en vue zoomée (1 = bord à bord)
const SCREEN_POS = new THREE.Vector3(0, 1.17, -0.199);
const IDLE_POS = new THREE.Vector3(0.5, 1.4, 2.6);
const IDLE_LOOK = new THREE.Vector3(0, 1.0, -0.1);
const INTRO_POS = new THREE.Vector3(2.6, 2.5, 5.4);
const COLOR = { dominant: '#332013', header: '#1f130b', cream: '#f2f1df', gold: '#e6c280' };

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const stage = document.getElementById('stage') as HTMLElement;
const loader = document.getElementById('loader')!;
const exitBtn = document.getElementById('exit')!;
const enterBtn = document.getElementById('enter')!;

type State = 'loading' | 'intro' | 'idle' | 'moving' | 'screen';
let state: State = 'loading';
const setState = (s: State) => { state = s; stage.dataset.state = s; };

/* ───────────── Utilitaires ───────────── */
function tex(w: number, h: number, draw: (g: CanvasRenderingContext2D, w: number, h: number) => void) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d')!, w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
const wood = (base: string, grain: string) =>
  tex(1024, 512, (g, w, h) => {
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 420; i++) {
      const y = Math.random() * h;
      g.strokeStyle = grain; g.globalAlpha = Math.random() * 0.18; g.lineWidth = Math.random() * 2.4 + 0.3;
      g.beginPath(); g.moveTo(0, y);
      for (let x = 0; x <= w; x += 64) g.lineTo(x, y + Math.sin(x * 0.012 + i) * 3);
      g.stroke();
    }
    g.globalAlpha = 1;
  });
const std = (color: number | string, rough = 0.6, metal = 0) => new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal });
const Y = new THREE.Vector3(0, 1, 0);

/** Cylindre entre deux points (bras de lampe). */
function bar(a: THREE.Vector3, b: THREE.Vector3, r: number, mat: THREE.Material) {
  const d = b.clone().sub(a);
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, d.length(), 12), mat);
  m.position.copy(a).addScaledVector(d, 0.5);
  m.quaternion.setFromUnitVectors(Y, d.normalize());
  return m;
}

/* ───────────── Initialisation ───────────── */
async function init() {
  await Promise.all([document.fonts.load('96px "Emblema One"', '</> Full Stack MB'), document.fonts.ready]);

  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  } catch {
    location.replace('/accueil?flat'); // pas de WebGL → version 2D
    return;
  }
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setClearColor(0x000000, 0); // fond transparent : laisse voir la couche CSS3D à travers le « trou »
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  renderer.domElement.setAttribute('aria-hidden', 'true');

  const cssRenderer = new CSS3DRenderer();
  Object.assign(cssRenderer.domElement.style, { position: 'absolute', inset: '0', zIndex: '0' });
  stage.prepend(cssRenderer.domElement);
  stage.insertBefore(renderer.domElement, cssRenderer.domElement.nextSibling); // canvas AU-DESSUS du CSS3D

  const scene = new THREE.Scene();
  const cssScene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(IDLE_FOV, 1, 0.05, 60);

  /* ── Matériaux ── */
  const deskMat = std(0xffffff, 0.55); deskMat.map = wood('#6a4428', '#2a170a');
  const darkMetal = std(0x2a1d13, 0.35, 0.8);
  const goldMat = std(COLOR.gold, 0.35, 0.9);

  /* ── Sol & mur ── */
  const floorMat = std(0xffffff, 0.8); floorMat.map = wood('#2a1a10', '#0e0703'); floorMat.map.repeat.set(10, 10);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), floorMat);
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);

  const wallMat = std(0xffffff, 0.9);
  wallMat.map = tex(512, 512, (g, w, h) => {
    g.fillStyle = '#2b1a0f'; g.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 64) { g.fillStyle = 'rgba(0,0,0,.3)'; g.fillRect(x, 0, 3, h); g.fillStyle = 'rgba(230,194,128,.05)'; g.fillRect(x + 3, 0, 2, h); }
    for (let i = 0; i < 4000; i++) { g.fillStyle = `rgba(255,220,170,${Math.random() * 0.03})`; g.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
  });
  wallMat.map.repeat.set(40, 8);
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(40, 8), wallMat);
  wall.position.set(0, 3, -0.62); wall.receiveShadow = true; scene.add(wall);

  // Motif de rayures dorées de la maquette, en décor mural
  const stripes = new THREE.Mesh(
    new THREE.PlaneGeometry(1.5, 1.5),
    new THREE.MeshBasicMaterial({
      transparent: true, depthWrite: false, toneMapped: false,
      map: tex(512, 512, (g, w, h) => {
        g.strokeStyle = COLOR.gold; g.lineWidth = 7;
        for (let i = -h; i < w + h; i += 34) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + h * 0.7, h); g.stroke(); }
        g.globalCompositeOperation = 'destination-in';
        const m = g.createLinearGradient(0, h, w, 0); m.addColorStop(0, 'rgba(0,0,0,.9)'); m.addColorStop(0.7, 'rgba(0,0,0,0)');
        g.fillStyle = m; g.fillRect(0, 0, w, h);
      }),
    }),
  );
  stripes.position.set(-1.55, 0.9, -0.615); scene.add(stripes);

  /* ── Enseigne néon « </> Full Stack » ── */
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(1.5, 0.42),
    new THREE.MeshBasicMaterial({
      transparent: true, toneMapped: false, depthWrite: false,
      map: tex(1024, 288, (g, w, h) => {
        g.font = '110px "Emblema One"'; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.shadowColor = COLOR.gold; g.shadowBlur = 40; g.fillStyle = COLOR.gold; g.fillText('</> Full Stack', w / 2, h / 2);
        g.shadowBlur = 8; g.fillStyle = '#fff3d6'; g.fillText('</> Full Stack', w / 2, h / 2);
      }),
    }),
  );
  sign.position.set(0, 1.88, -0.61); scene.add(sign);
  const signLight = new THREE.PointLight(0xe6c280, 0.9, 3.5, 2); signLight.position.set(0, 1.85, -0.2); scene.add(signLight);

  /* ── Cadres au mur ── */
  const frame = (x: number, y: number, w: number, h: number, art: (g: CanvasRenderingContext2D, W: number, H: number) => void) => {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(new RoundedBoxGeometry(w + 0.04, h + 0.04, 0.03, 2, 0.005), goldMat));
    const p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex(512, Math.round((512 * h) / w), art), toneMapped: false }));
    p.position.z = 0.0165; g.add(p); g.position.set(x, y, -0.59); scene.add(g);
  };
  frame(1.15, 1.55, 0.45, 0.6, (g, w, h) => {
    g.fillStyle = COLOR.header; g.fillRect(0, 0, w, h);
    g.fillStyle = COLOR.gold; g.font = `${w * 0.5}px "Emblema One"`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('MB', w / 2, h / 2);
  });
  frame(1.8, 1.45, 0.6, 0.4, (g, w, h) => {
    g.fillStyle = '#120a05'; g.fillRect(0, 0, w, h); g.font = `${w * 0.05}px monospace`; g.fillStyle = COLOR.gold;
    ['const dev = {', '  stack: "full",', '  coffee: true,', '};'].forEach((l, i) => g.fillText(l, w * 0.08, h * (0.22 + i * 0.18)));
  });

  /* ── Bureau ── */
  const top = new THREE.Mesh(new RoundedBoxGeometry(3.4, 0.05, 1.0, 3, 0.012), deskMat);
  top.position.set(0, 0.725, 0); scene.add(top);
  for (const [x, z] of [[-1.55, -0.4], [1.55, -0.4], [-1.55, 0.4], [1.55, 0.4]]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.7, 0.06), darkMetal); leg.position.set(x, 0.35, z); scene.add(leg);
  }

  /* ── Moniteur ── */
  const bezel = new THREE.Mesh(new RoundedBoxGeometry(0.88, 0.58, 0.04, 4, 0.012), std(0x14100c, 0.4, 0.3));
  bezel.position.set(0, 1.17, -0.22); scene.add(bezel);
  const neck = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.36, 0.03), darkMetal); neck.position.set(0, 0.93, -0.27); scene.add(neck);
  const base = new THREE.Mesh(new RoundedBoxGeometry(0.3, 0.014, 0.2, 2, 0.006), darkMetal); base.position.set(0, 0.757, -0.24); scene.add(base);
  const led = new THREE.Mesh(new THREE.SphereGeometry(0.004, 8, 8), new THREE.MeshBasicMaterial({ color: COLOR.gold, toneMapped: false }));
  led.position.set(0, 0.895, -0.199); scene.add(led);

  // Le « trou » : on voit la couche CSS3D (iframe) à travers
  const hole = new THREE.Mesh(
    new THREE.PlaneGeometry(SCREEN_W, SCREEN_H),
    new THREE.MeshBasicMaterial({ color: 0x000000, opacity: 0, blending: THREE.NoBlending, side: THREE.DoubleSide }),
  );
  hole.position.copy(SCREEN_POS); scene.add(hole);
  // Reflet de vitre (très léger), par-dessus
  const glass = new THREE.Mesh(
    new THREE.PlaneGeometry(SCREEN_W, SCREEN_H),
    new THREE.MeshBasicMaterial({
      transparent: true, opacity: 0.1, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
      map: tex(256, 160, (g, w, h) => {
        const l = g.createLinearGradient(0, 0, w, h); l.addColorStop(0, 'rgba(255,240,210,1)'); l.addColorStop(0.35, 'rgba(255,240,210,0)'); l.addColorStop(1, 'rgba(255,240,210,0.25)');
        g.fillStyle = l; g.fillRect(0, 0, w, h);
      }),
    }),
  );
  glass.position.copy(SCREEN_POS); glass.position.z += 0.0008; scene.add(glass);

  /* ── Clavier ── */
  const kb = new THREE.Mesh(new RoundedBoxGeometry(0.46, 0.02, 0.17, 3, 0.006), darkMetal); kb.position.set(0, 0.77, 0.2); kb.rotation.x = -0.05; scene.add(kb);
  const keys = new THREE.InstancedMesh(new RoundedBoxGeometry(0.024, 0.012, 0.024, 2, 0.003), std(0xffffff, 0.5), 14 * 4);
  const m4 = new THREE.Matrix4(), col = new THREE.Color();
  let n = 0;
  for (let r = 0; r < 4; r++) for (let c = 0; c < 14; c++) {
    m4.makeTranslation(-0.2 + c * 0.0308, 0.787 - r * 0.0013, 0.15 + r * 0.027);
    keys.setMatrixAt(n, m4); col.set(n % 13 === 0 || (r === 0 && c === 13) ? COLOR.gold : '#3a261a'); keys.setColorAt(n++, col);
  }
  keys.instanceColor!.needsUpdate = true; scene.add(keys);
  const space = new THREE.Mesh(new RoundedBoxGeometry(0.17, 0.012, 0.024, 2, 0.003), std('#3a261a', 0.5)); space.position.set(-0.02, 0.785, 0.258); scene.add(space);

  /* ── Tapis, souris ── */
  const pad = new THREE.Mesh(new RoundedBoxGeometry(0.3, 0.004, 0.24, 2, 0.002), std(0x1a0f08, 0.9)); pad.position.set(0.46, 0.752, 0.2); scene.add(pad);
  const mouse = new THREE.Mesh(new RoundedBoxGeometry(0.06, 0.028, 0.1, 4, 0.012), darkMetal); mouse.position.set(0.46, 0.768, 0.2); scene.add(mouse);

  /* ── Mug + vapeur ── */
  const mug = new THREE.Group(); mug.position.set(0.78, 0.75, 0.12);
  const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.036, 0.09, 24), std(COLOR.cream, 0.4)); cup.position.y = 0.045; mug.add(cup);
  const coffee = new THREE.Mesh(new THREE.CircleGeometry(0.037, 24), std('#1a0d06', 0.2)); coffee.rotation.x = -Math.PI / 2; coffee.position.y = 0.084; mug.add(coffee);
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.025, 0.006, 8, 16, Math.PI), std(COLOR.cream, 0.4)); handle.position.set(0.042, 0.045, 0); handle.rotation.z = -Math.PI / 2; mug.add(handle);
  scene.add(mug);
  const puff = tex(64, 64, (g) => { const r = g.createRadialGradient(32, 32, 0, 32, 32, 32); r.addColorStop(0, 'rgba(255,255,255,.9)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, 64, 64); });
  const steam = Array.from({ length: 6 }, () => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: puff, transparent: true, depthWrite: false, opacity: 0 })); scene.add(s); return s;
  });

  /* ── Livres, carnet, plante ── */
  [['#7a2e2e', 0.2, 0.035], ['#e6c280', 0.18, 0.03], ['#2d4a3e', 0.16, 0.03]].forEach(([c, w, h], i) => {
    const b = new THREE.Mesh(new RoundedBoxGeometry(w as number, h as number, 0.14, 2, 0.004), std(c as string, 0.7));
    b.position.set(-0.95 + (i % 2) * 0.01, 0.75 + (h as number) / 2 + i * 0.033, 0.18); b.rotation.y = 0.12 * (i - 1); scene.add(b);
  });
  const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.055, 0.12, 20), std('#8a5a3a', 0.8)); pot.position.set(1.3, 0.81, -0.2); scene.add(pot);
  for (let i = 0; i < 9; i++) {
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 8), std(i % 2 ? '#3f6b3a' : '#2f5a2f', 0.6));
    leaf.scale.set(0.028, 0.15, 0.012); const a = (i / 9) * Math.PI * 2;
    leaf.position.set(1.3 + Math.cos(a) * 0.05, 1.0, -0.2 + Math.sin(a) * 0.05); leaf.rotation.set(Math.sin(a) * 0.6, 0, -Math.cos(a) * 0.6); scene.add(leaf);
  }

  /* ── Lampe de bureau (source principale de lumière chaude) ── */
  const A = new THREE.Vector3(-0.95, 0.76, -0.1), B = new THREE.Vector3(-0.86, 1.1, -0.12), P = new THREE.Vector3(-0.62, 1.3, -0.08);
  const aim = new THREE.Vector3(-0.15, 0.76, 0.12), dir = aim.clone().sub(P).normalize();
  const lampBase = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.1, 0.02, 24), darkMetal); lampBase.position.set(A.x, 0.76, A.z); scene.add(lampBase);
  scene.add(bar(A, B, 0.008, darkMetal), bar(B, P, 0.008, darkMetal));
  const elbow = new THREE.Mesh(new THREE.SphereGeometry(0.015, 12, 12), goldMat); elbow.position.copy(B); scene.add(elbow);
  const shade = new THREE.Mesh(new THREE.ConeGeometry(0.085, 0.13, 28, 1, true), new THREE.MeshStandardMaterial({ color: COLOR.gold, metalness: 0.9, roughness: 0.3, side: THREE.DoubleSide }));
  shade.position.copy(P); shade.quaternion.setFromUnitVectors(Y, dir.clone().negate()); scene.add(shade);
  const bulbPos = P.clone().addScaledVector(dir, 0.035);
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.028, 16, 16), new THREE.MeshBasicMaterial({ color: 0xffe2a8, toneMapped: false })); bulb.position.copy(bulbPos); scene.add(bulb);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: puff, color: 0xffc873, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false }));
  glow.scale.setScalar(0.4); glow.position.copy(bulbPos); scene.add(glow);

  const lamp = new THREE.SpotLight(0xffc873, 14, 5, 0.8, 0.9, 2);
  lamp.position.copy(bulbPos); lamp.target.position.copy(aim); lamp.castShadow = true;
  lamp.shadow.mapSize.set(1024, 1024); lamp.shadow.bias = -0.0004; lamp.shadow.normalBias = 0.02; scene.add(lamp, lamp.target);

  /* ── Lumières d'ambiance ── */
  scene.add(new THREE.HemisphereLight(0xffe2c0, 0x2a1a10, 0.55));
  const fill = new THREE.DirectionalLight(0xffd9a8, 0.45); fill.position.set(2, 3, 3); scene.add(fill);
  const screenLight = new THREE.PointLight(0xffd9a0, 0.28, 2.5, 2); screenLight.position.set(0, 1.15, 0.15); scene.add(screenLight);

  /* ── Poussière en suspension dans la lumière ── */
  const DUST = 220, dustPos = new Float32Array(DUST * 3);
  for (let i = 0; i < DUST; i++) { dustPos[i * 3] = -1.2 + Math.random() * 2.2; dustPos[i * 3 + 1] = 0.85 + Math.random() * 1.1; dustPos[i * 3 + 2] = -0.4 + Math.random() * 1.2; }
  const dustGeo = new THREE.BufferGeometry(); dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
  scene.add(new THREE.Points(dustGeo, new THREE.PointsMaterial({ size: 0.007, color: 0xffe2a8, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false })));

  // Ombres sur tout ce qui s'y prête
  scene.traverse((o) => { if ((o as THREE.Mesh).isMesh && o !== hole && o !== glass && o !== sign && o !== stripes && o !== bulb) { o.castShadow = true; o.receiveShadow = true; } });
  for (const o of [wall, floor]) o.castShadow = false;

  /* ── L'écran : iframe en CSS3D ── */
  const params = new URLSearchParams(location.search);
  const startPath = (() => { const g = params.get('go'); return g && g.startsWith('/') && !g.startsWith('//') ? g : null; })();
  const wrap = document.createElement('div');
  wrap.style.cssText = `width:${PAGE_W}px;height:${PAGE_H}px;background:${COLOR.dominant};border-radius:28px;overflow:hidden;`;
  const iframe = document.createElement('iframe');
  iframe.src = startPath ?? '/accueil';
  iframe.title = 'Écran de l’ordinateur : pages du portfolio';
  iframe.style.cssText = 'width:100%;height:100%;border:0;display:block;';
  wrap.append(iframe);
  const css = new CSS3DObject(wrap);
  css.position.copy(SCREEN_POS); css.scale.setScalar(SCREEN_W / PAGE_W);
  cssScene.add(css);

  /* Une ancre cliquée DANS l'iframe fait aussi défiler les conteneurs parents (scrollIntoView traverse les iframes),
     ce qui décale le calque CSS3D par rapport au « trou » du canvas. On interdit tout défilement de la scène. */
  for (const el of [stage, cssRenderer.domElement, wrap]) el.style.overflow = 'clip'; // clip = non scrollable, même par script
  addEventListener('scroll', (e) => {
    const t = e.target;
    if (t instanceof HTMLElement && t !== document.documentElement) { t.scrollTop = 0; t.scrollLeft = 0; }
    else scrollTo(0, 0);
  }, true);

  /* ───────────── Caméra : « rig » animé par GSAP ───────────── */
  const rig = { pos: INTRO_POS.clone(), look: IDLE_LOOK.clone(), parallax: 0 };
  const pointer = { x: 0, y: 0, sx: 0, sy: 0 };
  const idlePos = () => IDLE_POS.clone().setZ(IDLE_POS.z * Math.max(1, 1.7 / camera.aspect));
  const zoomPos = () => {
    const t = Math.tan(THREE.MathUtils.degToRad(ZOOM_FOV) / 2);
    const d = Math.max((SCREEN_H * FILL) / (2 * t), (SCREEN_W * FILL) / (2 * t * camera.aspect));
    return SCREEN_POS.clone().setZ(SCREEN_POS.z + d);
  };

  const resize = () => {
    const w = stage.clientWidth, h = stage.clientHeight;
    renderer.setSize(w, h); cssRenderer.setSize(w, h);
    camera.aspect = w / h; camera.updateProjectionMatrix();
    if (state === 'screen') rig.pos.copy(zoomPos());
    else if (state === 'idle') rig.pos.copy(idlePos());
  };
  new ResizeObserver(resize).observe(stage);
  resize();

  const fly = (to: { pos: THREE.Vector3; look: THREE.Vector3; fov: number; parallax: number }, duration: number, ease: string, done: () => void) => {
    gsap.killTweensOf([rig.pos, rig.look, rig, camera]);
    const d = reduced ? 0.01 : duration;
    gsap.to(rig.pos, { x: to.pos.x, y: to.pos.y, z: to.pos.z, duration: d, ease });
    gsap.to(rig.look, { x: to.look.x, y: to.look.y, z: to.look.z, duration: d, ease });
    gsap.to(rig, { parallax: to.parallax, duration: d, ease });
    gsap.to(camera, { fov: to.fov, duration: d, ease, onUpdate: () => camera.updateProjectionMatrix(), onComplete: done });
  };

  const zoomIn = () => {
    if (state !== 'idle' && state !== 'intro') return;
    setState('moving');
    fly({ pos: zoomPos(), look: SCREEN_POS, fov: ZOOM_FOV, parallax: 0 }, 1.8, 'power3.inOut', () => {
      setState('screen');
      renderer.domElement.style.pointerEvents = 'none'; // les clics traversent le canvas → iframe utilisable
      iframe.focus();
    });
  };
  const zoomOut = () => {
    if (state !== 'screen') return;
    setState('moving');
    renderer.domElement.style.pointerEvents = 'auto';
    (document.activeElement as HTMLElement | null)?.blur();
    fly({ pos: idlePos(), look: IDLE_LOOK, fov: IDLE_FOV, parallax: 1 }, 1.5, 'power3.inOut', () => setState('idle'));
  };

  /* ── Interactions ── */
  stage.addEventListener('click', (e) => {
    if (e.target instanceof Node && wrap.contains(e.target)) return;
    if (state === 'idle' || state === 'intro') zoomIn();
    else if (state === 'screen') zoomOut(); // clic hors de l'écran = reculer
  });
  enterBtn.addEventListener('click', (e) => { e.stopPropagation(); zoomIn(); });
  exitBtn.addEventListener('click', (e) => { e.stopPropagation(); zoomOut(); });
  addEventListener('keydown', (e) => {
    if (e.key === 'Escape') zoomOut();
    else if ((e.key === 'Enter' || e.key === ' ') && (state === 'idle' || state === 'intro') && document.activeElement === document.body) { e.preventDefault(); zoomIn(); }
  });
  stage.addEventListener('pointermove', (e) => { pointer.x = (e.clientX / innerWidth) * 2 - 1; pointer.y = (e.clientY / innerHeight) * 2 - 1; });

  // Messages envoyés par les pages affichées dans l'écran (voir src/scripts/page.ts)
  let opened = !!startPath;
  addEventListener('message', (e) => {
    if (e.origin !== location.origin || !e.data || typeof e.data !== 'object') return;
    if (e.data.type === 'portfolio:exit') zoomOut();
    if (e.data.type === 'portfolio:navigate') {
      if (state === 'screen') opened = true;
      if (opened) { history.replaceState(null, '', `/?go=${encodeURIComponent(e.data.path)}`); document.title = e.data.title; }
    }
  });

  /* ───────────── Boucle de rendu ───────────── */
  const clock = new THREE.Clock();
  renderer.setAnimationLoop(() => {
    const t = clock.getElapsedTime();
    pointer.sx += (pointer.x - pointer.sx) * 0.05; pointer.sy += (pointer.y - pointer.sy) * 0.05;
    const w = reduced ? 0 : rig.parallax;
    camera.position.set(rig.pos.x + pointer.sx * 0.28 * w, rig.pos.y - pointer.sy * 0.1 * w + Math.sin(t * 0.6) * 0.004 * w, rig.pos.z);
    camera.lookAt(rig.look);

    steam.forEach((s, i) => {
      const k = (t * 0.22 + i / steam.length) % 1;
      s.position.set(mug.position.x + Math.sin(k * 7 + i) * 0.012, 0.85 + k * 0.24, mug.position.z);
      s.scale.setScalar(0.03 + k * 0.08); (s.material as THREE.SpriteMaterial).opacity = Math.sin(k * Math.PI) * 0.2;
    });
    if (!reduced) {
      const p = dustGeo.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < DUST; i++) {
        p.setY(i, p.getY(i) + 0.0002 + Math.sin(t + i) * 0.00008);
        p.setX(i, p.getX(i) + Math.cos(t * 0.5 + i) * 0.00008);
        if (p.getY(i) > 1.95) p.setY(i, 0.85);
      }
      p.needsUpdate = true;
    }
    lamp.intensity = 14 + Math.sin(t * 3.1) * 0.15; // léger scintillement
    screenLight.intensity = 0.28 + Math.sin(t * 1.7) * 0.02;
    glow.material.opacity = 0.5 + Math.sin(t * 2) * 0.03;
    led.visible = Math.sin(t * 2) > -0.2;

    renderer.render(scene, camera);
    cssRenderer.render(cssScene, camera);
  });

  /* ───────────── Intro ───────────── */
  setState('intro');
  loader.style.opacity = '0'; setTimeout(() => loader.remove(), 800);
  fly({ pos: idlePos(), look: IDLE_LOOK, fov: IDLE_FOV, parallax: 1 }, 3, 'power3.out', () => {
    if (state === 'intro') setState('idle');
    if (startPath) zoomIn(); // lien direct vers une page : on entre tout de suite dans l'écran
  });
}

init();
