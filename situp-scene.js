// After the hero text: the real 3D sage pair lies on its side, scroll lifts it to the tipping point,
// then gravity (situp.js) drops it onto the soles with a foam bounce. The landing calls onLand();
// scrolling back above the tipping point calls onUnland() and the pair follows the scroll again.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { simulateSitUp, sitUpParams, SHOE } from './situp.js';

const U = 0.306;                 // metres per model unit (shoe 0.98 units = 30 cm)
const SLOW = 0.6;                // the drop plays at 0.6× speed, like a slow-motion camera
const LAG_R = 0.04;              // right shoe let go 40 ms later (real time)
export const VIDEO_RECT = [733, 488, 2894, 1628];   // the 16:9 area of the photo the swing video was made from
export const PHOTO_HEELS = [[2190, 1262], [2592, 1425]];   // heels in assets/air/air-photo.jpg (sage shoes)

const lerp = (a, b, t) => a + (b - a) * t;
const clamp01 = (x) => Math.min(1, Math.max(0, x));
const smooth = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };

export async function initSitUp(canvas, { SHOW, LIFT, onLand, onUnland }) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(2, devicePixelRatio || 1));
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  const scene = new THREE.Scene();
  scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
  const key = new THREE.DirectionalLight(0xfff1e0, 2.0); key.position.set(-1.5, 2.2, 3); scene.add(key);
  const rim = new THREE.DirectionalLight(0xdfe8ff, 0.6); rim.position.set(2, -1, 1.5); scene.add(rim);
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
  camera.position.set(0, 0, 6);             // set by layout()

  const gltf = await new GLTFLoader().loadAsync('assets/3d/sage.glb');
  const raw = new THREE.Box3().setFromObject(gltf.scene);
  const NORM = 0.98 / (raw.max.z - raw.min.z);
  const box = new THREE.Box3(raw.min.clone().multiplyScalar(NORM), raw.max.clone().multiplyScalar(NORM));
  // colour: less white wash from the room light, a touch of the sage back (matches the photos)
  gltf.scene.traverse((o) => {
    if (o.isMesh && o.material) {
      o.material.envMapIntensity = 0.55;
      o.material.color?.setRGB(0.96, 1.0, 0.95);
      o.material.needsUpdate = true;
    }
  });

  const yMin = box.min.y;
  const B = SHOE.b / U;
  const TOE = -1;                                  // the model's toe points along −z
  const base = new THREE.Matrix4().makeBasis(
    new THREE.Vector3(TOE, 0, 0), new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, -TOE, 0));
  const mk = () => {
    const inner = gltf.scene.clone(true); inner.scale.setScalar(NORM);
    const o = new THREE.Group(); o.add(inner); o.matrixAutoUpdate = false; scene.add(o); return o;
  };
  const shoes = [mk(), mk()];
  const LOCAL_MIRROR = new THREE.Matrix4().makeScale(-1, 1, 1);

  const edgeA = new THREE.Vector3(B / 2, yMin, 0), edgeB = new THREE.Vector3(-B / 2, yMin, 0);
  const ref = new THREE.Matrix4().makeRotationY(0.3).multiply(base);
  const za = edgeA.clone().applyMatrix4(ref).z, zb = edgeB.clone().applyMatrix4(ref).z;
  const negEdge = za < zb ? edgeA : edgeB, posEdge = za < zb ? edgeB : edgeA;
  const span = posEdge.clone().applyMatrix4(base).sub(negEdge.clone().applyMatrix4(base));
  function pose(theta, foam, floorPt) {
    const rot = new THREE.Matrix4().makeRotationY(-theta).multiply(base);
    const edge = theta <= 0 ? negEdge : posEdge;
    const anchor = theta <= 0 ? floorPt.clone() : floorPt.clone().add(span);
    const m = rot.clone().setPosition(anchor.sub(edge.clone().applyMatrix4(rot)));
    m.elements[14] -= foam / U;
    return m;
  }
  const FLOOR = -0.05;
  const SLANT = (PHOTO_HEELS[1][1] - PHOTO_HEELS[0][1]) / (PHOTO_HEELS[1][0] - PHOTO_HEELS[0][0]);
  const pivots = [new THREE.Vector3(), new THREE.Vector3()];        // floor contact points, standing
  const hand = [new THREE.Vector3(), new THREE.Vector3()];          // scroll "hand" offset while lying
  let handK = 1;                                                     // 1 lying … 0 at the tipping point
  const matOf = (i, th, fo, pivot) => {
    const m = pose(th, fo, pivot);
    return i ? m.multiply(LOCAL_MIRROR) : m;
  };
  const place = (tl, fl, tr, fr) => {
    for (const [i, th, fo] of [[0, tl, fl], [1, tr, fr]]) {
      const pv = pivots[i].clone().addScaledVector(hand[i], handK);
      shoes[i].matrix.copy(matOf(i, th, fo, pv));
    }
  };
  const heelLocal = new THREE.Vector3(0, box.max.y * 0.55, -TOE * box.max.z * 0.93);
  const centreOf = (m) => {
    const o = new THREE.Object3D(); o.matrixAutoUpdate = false; o.matrix.copy(m);
    const tmp = shoes[0].matrix.clone(); shoes[0].matrix.copy(m); shoes[0].updateMatrixWorld(true);
    const c = new THREE.Box3().setFromObject(shoes[0]).getCenter(new THREE.Vector3());
    shoes[0].matrix.copy(tmp); shoes[0].updateMatrixWorld(true);
    return c;
  };

  // The 3D pair takes over from the flat pair exactly where and as big as the flat pair hid under the
  // text (numbers from the hero: camera fov 38 at z 8.075 over a canvas starting 130 px down, pair
  // size 0.4 × 3.4 units, centres ±0.3026 units, 0.35 units above the middle). It sits up in place.
  function layout() {
    const hpx = (H - 130) / (2 * 8.075 * Math.tan(THREE.MathUtils.degToRad(19)));  // hero px per unit
    const shoePx = 0.4 * 3.4 * (1 - 2 * 53 / 1432) * hpx;                          // flat shoe, heel to toe
    const pxu = shoePx / 0.98;                                                     // our px per unit
    camera.fov = 30;
    camera.position.z = H / (pxu * 2 * Math.tan(THREE.MathUtils.degToRad(15))) + 0.15;
    camera.updateProjectionMatrix(); camera.updateMatrixWorld(true);
    const cy = 130 + (H - 130) / 2 - 0.35 * hpx;                                   // flat pair centre (px)
    const half = 0.3026 * hpx;                                                     // flat centres ± (px)
    const toW = (x, y) => new THREE.Vector3((x - W / 2) / pxu, -(y - H / 2) / pxu, 0);
    const sep = (2 * half) / pxu;
    const mid = toW(W / 2, cy);
    const lying = [toW(W / 2 - half, cy), toW(W / 2 + half, cy)];
    const stand = [mid.clone().add(new THREE.Vector3(-sep / 2, sep * SLANT / 2, 0)),
                   mid.clone().add(new THREE.Vector3(sep / 2, -sep * SLANT / 2, 0))];
    const origin = new THREE.Vector3(0, 0, FLOOR);
    for (let i = 0; i < 2; i++) {
      const c0 = centreOf(matOf(i, 0, 0, origin));
      pivots[i].set(stand[i].x - c0.x, stand[i].y - c0.y, FLOOR);
      const c1 = centreOf(matOf(i, -Math.PI / 2, 0, pivots[i]));
      hand[i].set(lying[i].x - c1.x, lying[i].y - c1.y, 0);
    }
  }

  const { alpha } = sitUpParams();
  const sim = simulateSitUp({ tEnd: 1.4 });
  const tLand = sim.impacts[0][0];
  const at = (t) => {
    const s = sim.samples; if (t <= 0) return s[0];
    const i = Math.min(s.length - 1, Math.floor(t * 120)); return s[i];
  };

  let W = 0, H = 0;
  const resize = () => {
    W = canvas.clientWidth; H = canvas.clientHeight;
    renderer.setSize(W, H, false);
    camera.aspect = W / H;
    camera.updateProjectionMatrix();
  };
  resize();
  layout();
  addEventListener('resize', () => { resize(); layout(); });

  // heel spots on screen (CSS px) when standing: the ink starts exactly there
  function heelsOnScreen() {
    const k = handK; handK = 0;
    place(0, 0, 0, 0); handK = k;
    scene.updateMatrixWorld(true);
    return shoes.map((s) => {
      const v = heelLocal.clone().applyMatrix4(s.matrix).project(camera);
      return [(v.x + 1) / 2 * W, (1 - v.y) / 2 * H];
    });
  }

  let phase = 'held';               // held → falling → landed
  let t0 = 0, landed = false;
  let thL = -Math.PI / 2, thR = -Math.PI / 2;

  function update(p, now) {
    // The flat pair went dark under the text's black band by SHOW[0]; from there the 3D pair sits in
    // the same place under the band and is simply uncovered as the text scrolls up. The short lift
    // (SHOW) only hides the hand-over while the band still covers almost all of it.
    if (p < SHOW[0]) { canvas.style.visibility = 'hidden'; return; }
    canvas.style.visibility = 'visible';
    const lit = smooth(SHOW[0], SHOW[1], p);
    const lift = smooth(LIFT[0], LIFT[1], p);
    const thScroll = lerp(-Math.PI / 2, -alpha, lift);
    let foL = 0, foR = 0;

    if (phase === 'held' && p >= LIFT[1]) { phase = 'falling'; t0 = now; landed = false; }
    if (phase !== 'held' && p < LIFT[1] - 0.04) {
      phase = 'held';
      if (landed) { landed = false; onUnland?.(); }
    }
    if (phase === 'held') {
      // follow the scroll, softly (also brings the pair back after a landing); the hand carries the
      // pair from where the flat pair hid to the spot it will fall from
      const k = Math.min(1, 0.18);
      thL += (thScroll - thL) * k; thR += (thScroll - thR) * k;
      handK += ((1 - lift) - handK) * k;
    } else {
      handK = 0;
      const t = (now - t0) * SLOW;
      const a = at(t), b = at(t - LAG_R);
      thL = a[1]; foL = a[2]; thR = b[1]; foR = b[2];
      if (!landed && t >= tLand) { landed = true; phase = 'landed'; onLand?.(heelsOnScreen()); }
    }
    renderer.toneMappingExposure = 1.05 * lit;
    place(thL, foL, thR, foR);
    renderer.render(scene, camera);
  }

  return { update, heelsOnScreen };
}
