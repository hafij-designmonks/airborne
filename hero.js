// Airborne landing — hero + About Problem (the approved Grail-style shoe spiral, version 2),
// moved here from R&D/Grail Hero. Original header: upright sneaker PNGs on the spiral,
// compacting into a pair of the same side-view shoe, touching (no flips). Shoes never go
// see-through: the rest tuck behind the pair. Earlier: archive/v2-before-solid, v2-top-reveal.
import * as THREE from 'three';

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */
const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const lerp = (a, b, t) => a + (b - a) * t;
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const coarse = matchMedia('(pointer: coarse)').matches;
const isMobile = coarse && Math.min(screen.width, screen.height) < 820;

// Large-viewport height, the unit every scroll stage is measured in
const vhProbe = document.createElement('div');
vhProbe.style.cssText =
  'position:fixed;top:0;left:0;width:0;visibility:hidden;pointer-events:none;' +
  (CSS.supports('height', '100lvh') ? 'height:100lvh;' : 'height:100vh;');
document.body.appendChild(vhProbe);
let vhCache = 0;
const vh = () => vhCache || (vhCache = vhProbe.offsetHeight || innerHeight);
addEventListener('resize', () => { vhCache = 0; });

/* ------------------------------------------------------------------ */
/* shoes                                                               */
/* ------------------------------------------------------------------ */
// Upright side views (toe down, heel up). Slot i of the spiral shows SHOES[i mod 8],
// so index 0 (ice-cobalt-a) and index 4 (ice-cobalt-b) are the same colourway.
const SHOES = ['ice-cobalt-a', 'white-blaze-a', 'navy-sky-a', 'sage-a', 'ice-cobalt-b', 'white-blaze-b', 'navy-sky-b', 'sage-b'];
const TOP_L = 'top-left';      // top-down pair the hero + mate cross-fade into
const TOP_R = 'top-right';
const NQ = SHOES.length;
const wrap = (i) => ((i % NQ) + NQ) % NQ;
const shoeSrc = (n) => `assets/shoes/v/${n}.webp`;

/* ------------------------------------------------------------------ */
/* shaders                                                             */
/* ------------------------------------------------------------------ */
const VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;
// Every plane has the same aspect (PLANE_ASP). Each texture is drawn centred at its
// own true aspect inside it, so a side view can cross-fade into a top view without
// stretching. No flips anywhere: shapes never get squashed.
const FRAG = /* glsl */ `
precision highp float;
uniform sampler2D uTexA;
uniform sampler2D uTexB;
uniform float uAspA;
uniform float uAspB;
uniform float uPlaneAsp;
uniform float uMix;
uniform float uSmear;
uniform vec2 uDir;
uniform float uDim;
uniform float uAlpha;
varying vec2 vUv;

vec4 fit(sampler2D t, vec2 uv, float asp) {
  vec2 q = vec2((uv.x - 0.5) * uPlaneAsp / asp + 0.5, uv.y);
  if (q.x < 0.0 || q.x > 1.0 || q.y < 0.0 || q.y > 1.0) return vec4(0.0);
  return texture2D(t, q);
}
vec4 shoe(vec2 uv) {
  vec4 a = fit(uTexA, uv, uAspA);
  if (uMix < 0.001) return a;
  return mix(a, fit(uTexB, uv, uAspB), uMix);
}
void main() {
  vec4 c;
  if (uSmear < 0.0008) {
    c = shoe(vUv);
  } else {
    vec4 acc = vec4(0.0);
    float total = 0.0;
    for (int i = 0; i < 7; i++) {
      float t = float(i) / 6.0 - 0.5;
      float w = 1.0 - abs(t) * 1.3;
      if (w <= 0.0) continue;
      acc += shoe(vUv + uDir * t * uSmear) * w;
      total += w;
    }
    c = acc / total;
  }
  float a = c.a * uAlpha;
  if (a < 0.004) discard;
  gl_FragColor = vec4(c.rgb * uDim, a);
}
`;

/* ------------------------------------------------------------------ */
/* spiral config + scroll stage boundaries (in viewport heights)       */
/* ------------------------------------------------------------------ */
const CFG = {
  angleStep: 0.5,
  radius: 2.25,       // horizontal spread cut by 25% (was 3)
  squish: 0.7,
  gapX: -0.04,
  gapY: 0.22,
  edgeTwist: -0.06,
  cardScale: 0.5,
  maxTurn: 0.5,       // shoes only lean up to ~29° as they go round: never edge-on
  smear: 1,
  auto: true,
  autoSpeed: 0.15,
  mouseTilt: 0.12,
  magnet: 0.1,
};
const CAM_BACK = 6.5;
const N_CARDS = 26;
const MID = 13;                  // hero shoe slot → left shoe of the pair
const INTRO_R = 3.75;            // fly-in starts a little wider than the settled column
const INTRO_S = 0.44;
const INTRO_DUR = 2.2;
const PAIRING = [0.14, 0.58];    // spiral compacts into a pair of side-view shoes
// The pair = two slots of the same shoe (sage-b): with the spin anchored on a multiple of 8,
// slot i shows SHOES[(i + 3) mod 8], so slots 12 and 20 are both sage-b. Every other shoe
// tucks behind one of them. No other pair is revealed later.
const FRONT_L = 12;
const FRONT_R = 20;
const TUCK = 0.8;                // tucked shoe size vs a pair shoe: fully covered by it
const HIDE = [0.82, 0.98];       // pair goes dark (never see-through) under the problem text
const SHOW = [1.32, 1.66];       // …and is lit again, bigger, after the text
const SP_MAX = 1.9;
const HERO_END = 2.0;             // the flat spiral is dark from here on: the 3D pair takes over
const PLANE_H = 3.4;
const PLANE_ASP = 0.53;          // ≥ every texture's aspect (side ≈ .50–.52)
const PAIR_S1 = 0.4;             // pair size when it forms, just above the problem headline
const PAIR_S2 = 1.0;             // pair size after the text
const PAIR_Y1 = 0.35;            // pair sits low enough that the headline almost reaches it
const PAIR_GAP = 0.445;          // centre-to-centre, in shoe heights: the two shoes touch

/* ------------------------------------------------------------------ */
/* shared scroll state                                                 */
/* ------------------------------------------------------------------ */
const scrollState = { p: 0 };

/* ------------------------------------------------------------------ */
/* WebGL shoe spiral                                                   */
/* ------------------------------------------------------------------ */
function initSpiral(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !isMobile, alpha: true });
  renderer.setPixelRatio(Math.min(isMobile ? 1.5 : 2, devicePixelRatio || 1));
  renderer.setClearColor(0, 0);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
  camera.position.z = 9;

  const resize = () => {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  resize();
  addEventListener('resize', resize);

  const loader = new THREE.TextureLoader();
  const tex = {}, aspect = {};
  for (const n of [...SHOES, TOP_L, TOP_R]) {
    aspect[n] = n.startsWith('top') ? 0.374 : 0.51;
    tex[n] = loader.load(shoeSrc(n), (t) => { aspect[n] = t.image.width / t.image.height; });
    tex[n].colorSpace = THREE.NoColorSpace;
    tex[n].generateMipmaps = false;           // no mip bleed at the cut-out edges
    tex[n].minFilter = THREE.LinearFilter;
    tex[n].anisotropy = Math.min(isMobile ? 2 : 8, renderer.capabilities.getMaxAnisotropy());
  }

  const group = new THREE.Group();
  scene.add(group);
  const geo = new THREE.PlaneGeometry(PLANE_ASP, 1, 1, 1);
  const cards = [];
  for (let i = 0; i < N_CARDS; i++) {
    const mesh = new THREE.Mesh(
      geo,
      new THREE.ShaderMaterial({
        uniforms: {
          uTexA: { value: tex[SHOES[0]] },
          uTexB: { value: tex[TOP_L] },
          uAspA: { value: 0.51 },
          uAspB: { value: 0.374 },
          uPlaneAsp: { value: PLANE_ASP },
          uMix: { value: 0 },
          uSmear: { value: 0 },
          uDir: { value: new THREE.Vector2(0, 1) },
          uDim: { value: 1 },
          uAlpha: { value: 1 },
        },
        vertexShader: VERT,
        fragmentShader: FRAG,
        transparent: true,
        side: THREE.DoubleSide,
        depthTest: false,
        depthWrite: false,
      }),
    );
    group.add(mesh);
    cards.push(mesh);
  }

  // pointer: tilt + magnet + vertical drag to spin
  const mouse = { x: 0, y: 0 };
  let drag = null;
  let spinTarget = 0;
  let spin = 0;
  canvas.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'touch') canvas.setPointerCapture?.(e.pointerId);
    drag = { x: e.clientX, y: e.clientY };
  });
  canvas.addEventListener('pointermove', (e) => {
    const r = canvas.getBoundingClientRect();
    mouse.x = ((e.clientX - r.left) / r.width) * 2 - 1;
    mouse.y = -(((e.clientY - r.top) / r.height) * 2 - 1);
    if (!drag) return;
    const d = e.pointerType === 'touch' ? (e.clientX - drag.x) * 0.008 : -(e.clientY - drag.y) * 0.006;
    drag.x = e.clientX;
    drag.y = e.clientY;
    spinTarget += d;
  });
  const endDrag = () => { drag = null; };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointerleave', endDrag);

  let lastSpin = 0;
  let spinVel = 0;
  let tiltX = 0, tiltZ = 0;
  let anchor = null;
  let introStart = reduced ? -1 : performance.now() / 1000;
  let prev = performance.now() / 1000;

  const frame = () => {
    const now = performance.now() / 1000;
    const dt = Math.min(0.05, now - prev) || 0.016;
    prev = now;

    if (scrollState.p > HERO_END) { requestAnimationFrame(frame); return; }   // covered by the page below
    const p = Math.min(SP_MAX, Number.isFinite(scrollState.p) ? scrollState.p : 0);
    const pairing = smooth(PAIRING[0], PAIRING[1], p);
    const hide = smooth(HIDE[0], HIDE[1], p);
    const show = smooth(SHOW[0], SHOW[1], p);
    const grow = smooth(HIDE[1], SHOW[0], p);          // resize while dark
    const lit = 1 - hide;   // dims to black under the text; after it the 3D pair (situp-scene.js) takes over

    let intro = 1;
    if (introStart >= 0) {
      const e = Math.min(1, (now - introStart) / INTRO_DUR);
      intro = 1 - (1 - e) ** 3;
      if (e >= 1) introStart = -1;
    }
    const radius = INTRO_R + (CFG.radius - INTRO_R) * intro;
    const speed = 1 + (CFG.autoSpeed - 1) * intro;
    const baseScale = INTRO_S + (CFG.cardScale - INTRO_S) * intro;

    // As the pair forms, the spin glides to the nearest ice-grey shoe so it becomes
    // the hero (its top-down pair is the ending).
    if (pairing > 0.001 && anchor === null) anchor = Math.round(spin / NQ) * NQ;
    if (pairing < 0.001) anchor = null;
    if (anchor !== null) spinTarget += (anchor - spinTarget) * Math.min(1, dt * 4);
    else if (CFG.auto && !reduced) spinTarget += speed * dt;

    spin += (spinTarget - spin) * Math.min(1, dt * 8);
    if (Math.abs(spinTarget - spin) < 3e-4) spin = spinTarget;
    const b = spin;
    const v = (b - lastSpin) / dt;
    lastSpin = b;
    spinVel += (v - spinVel) * 0.25;
    const smear = Math.min(0.055, Math.abs(spinVel) * 0.012 * CFG.smear);

    const depth = radius * CFG.squish;
    camera.position.z = depth + CAM_BACK;

    tiltX += (-mouse.y * CFG.mouseTilt - tiltX) * Math.min(1, dt * 4);
    tiltZ += (mouse.x * CFG.mouseTilt - tiltZ) * Math.min(1, dt * 4);
    group.rotation.x = tiltX * (1 - pairing);
    group.rotation.z = -tiltZ * (1 - pairing);

    const halfH = Math.tan((38 * Math.PI) / 180 / 2) * camera.position.z;
    const halfW = halfH * camera.aspect;
    const mx = mouse.x * halfW;
    const my = mouse.y * halfH;

    // pair size: small above the headline, full size after the text (grows while hidden)
    const pairS = lerp(PAIR_S1, PAIR_S2 * 0.92, grow) * lerp(1, 1 / 0.92, show);
    const pairHalf = (PAIR_GAP * PLANE_H * pairS) / 2;
    const pairY = lerp(PAIR_Y1, -0.1, grow);

    const first = (anchor ?? Math.round(b)) - MID;
    for (let i = 0; i < N_CARDS; i++) {
      const idx = first + i;
      const n = idx - b;
      const ang = n * CFG.angleStep;
      const cs = Math.cos(ang);
      const sn = Math.sin(ang);
      const mesh = cards[i];
      const off = i - MID;
      const front = i === FRONT_L || i === FRONT_R;
      // which pair shoe it becomes or tucks behind
      const side = i === FRONT_L ? -1 : i === FRONT_R ? 1 : i % 2 ? 1 : -1;

      let x = radius * sn + n * CFG.gapX;
      let y = n * CFG.gapY;
      const dx = mx - x, dy = my - y;
      const pull = CFG.magnet * Math.exp(-(dx * dx + dy * dy) / 9) * (1 - pairing);
      x += dx * pull;
      y += dy * pull;
      const z = depth * cs;
      const dim = Math.max(0.32, 0.5 + 0.5 * cs);
      // lean with the column, capped so a shoe never turns edge-on
      const lean = sn * CFG.maxTurn;
      const name = SHOES[wrap(idx)];

      // every shoe stays fully solid: two become the pair, the rest tuck behind them
      const px = lerp(x, side * pairHalf, pairing);
      const py = lerp(y, pairY, pairing);
      const pz = lerp(z, 0, pairing);
      const sc = lerp(baseScale, pairS * (front ? 1 : TUCK), pairing);
      const dm = lerp(dim, front ? 1 : 0.6, pairing) * lit;
      const ry = lerp(lean, 0, pairing);
      const rz = lerp(-sn * CFG.edgeTwist, 0, pairing);

      mesh.visible = lit > 0.004 && sc > 0.002;
      mesh.position.set(px, py, pz);
      mesh.rotation.set(0, ry, rz);
      mesh.scale.set(sc * PLANE_H, sc * PLANE_H, 1);
      mesh.renderOrder = Math.round(lerp(z * 100, front ? 500 : 60 - Math.abs(off), pairing));

      const u = mesh.material.uniforms;
      u.uTexA.value = tex[name];
      u.uAspA.value = aspect[name];
      u.uMix.value = 0;
      u.uSmear.value = smear;
      u.uDim.value = dm;
      u.uAlpha.value = 1;
    }

    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

/* ------------------------------------------------------------------ */
/* headline: per-letter spans, then fit to viewport width              */
/* ------------------------------------------------------------------ */
const headline = document.getElementById('headline');
const NAV_GAP = 10;              // px between the nav boxes and the top of AIRBORNE
{
  const words = ['Get', 'airborne'];   // one line, full width (Charles Rosie, caps)
  let k = 0;
  words.forEach((w, wi) => {
    const word = document.createElement('span');
    word.className = 'word';
    for (const ch of w) {
      const l = document.createElement('span');
      l.className = 'letter';
      l.style.animationDelay = `${k++ * 0.045}s`;
      l.textContent = ch;
      word.appendChild(l);
    }
    headline.appendChild(word);
    if (wi < words.length - 1) {
      const s = document.createElement('span');
      s.className = 'space';
      s.setAttribute('aria-hidden', 'true');
      headline.appendChild(s);
    }
  });
  let lastW = 0;
  const fit = () => {
    lastW = innerWidth;
    const target = innerWidth - 40 * 2;
    headline.style.fontSize = '200px';
    const w = headline.scrollWidth;
    if (w > 0) headline.style.fontSize = `${(200 * target) / w}px`;
    // the tops of the letters sit NAV_GAP px under the nav boxes, whatever the screen width
    const fs = parseFloat(headline.style.fontSize);
    const ctx = (fit.c ||= document.createElement('canvas').getContext('2d'));
    ctx.font = `400 ${fs}px "Charles Rosie"`;
    const m = ctx.measureText(headline.textContent.toUpperCase());
    const lh = parseFloat(getComputedStyle(headline).lineHeight) || fs * 0.92;
    const capTop = (lh - (m.fontBoundingBoxAscent + m.fontBoundingBoxDescent)) / 2 + m.fontBoundingBoxAscent - m.actualBoundingBoxAscent;
    const nav = document.querySelector('.hero .nav'), navL = nav.querySelector('.navL');
    headline.style.marginTop = '0px';
    const navBottom = nav.offsetTop + navL.offsetTop + navL.offsetHeight;
    headline.style.marginTop = `${navBottom + NAV_GAP - headline.offsetTop - capTop}px`;
  };
  fit();
  document.fonts?.ready.then(fit);
  document.fonts?.load('100px "Charles Rosie"').then(fit);
  addEventListener('resize', () => { if (innerWidth !== lastW) fit(); });
}

/* ------------------------------------------------------------------ */
/* smooth scroll + scroll-driven state                                 */
/* ------------------------------------------------------------------ */
export function initHero(lenis) {
const pill = document.getElementById('waitPill');
const sceneEl = document.getElementById('scene');
const onScroll = () => {
  const y = lenis.scroll;
  const h = vh();
  scrollState.p = h > 0 && Number.isFinite(y) ? y / h : 0;
  sceneEl.style.visibility = scrollState.p > HERO_END ? 'hidden' : '';
  sceneEl.style.setProperty('--tf', (26 * (1 - smooth(PAIRING[0], PAIRING[1], scrollState.p))).toFixed(2));
  pill?.classList.toggle('on', y > h * 0.15);
  // headline shrinks, drifts up and fades over the first third of a screen
  const k = Math.min(1, y / (h * 0.33));
  headline.style.transform = `translate3d(0, ${-y * 0.18}px, 0) scale(${1 - 0.62 * k})`;
  headline.style.opacity = String(1 - k);
};
lenis.on('scroll', onScroll);
onScroll();

const toBottom = () => lenis.scrollTo('#shop', { duration: 1.8 });
document.getElementById('logoBtn').addEventListener('click', () => lenis.scrollTo(0, { duration: 1.4 }));
document.getElementById('navCta').addEventListener('click', toBottom);
document.getElementById('menuBtn').addEventListener('click', () => lenis.scrollTo('#foot', { duration: 1.8 }));
pill?.addEventListener('click', toBottom);

// "About Problem" copy rises in each time the block enters the view
const section2 = document.getElementById('section2');
new IntersectionObserver(([e]) => section2.classList.toggle('in', e.isIntersecting), {
  threshold: 0.25,
}).observe(document.getElementById('s2inner'));

initSpiral(document.getElementById('spiral'));
}
