// Air layer: the full photo opens from the two heels like ink (WebGL), the camera pushes in to a
// close shot, then the looping swing video takes over (same framing). Driven by situp-scene.js:
// the shoes landing starts the reveal (time-based, so it is smooth whatever the scroll speed).
import { PHOTO_HEELS, VIDEO_RECT } from './situp-scene.js';

const lerp = (a, b, t) => a + (b - a) * t;
const clamp01 = (x) => Math.min(1, Math.max(0, x));

const IMG = { w: 4096, h: 2560 };
const R_SLOW = 110;                              // the two spots at the heels
const R_FULL = 3400;                             // past every corner of the close shot, edge noise included
// the extension (assets/air/air-wide.jpg) covers this rect of the photo's pixel space
const OUT = [-1300, -700, 7300, 4600];

const VERT = `
attribute vec2 aPos;
varying vec2 vUv;
void main() { vUv = aPos * .5 + .5; gl_Position = vec4(aPos, 0., 1.); }`;

const N_DROPS = 48;
const FRAG = `
precision highp float;
uniform sampler2D uTex;      // sharp photo, 4096 × 2560 (image px)
uniform sampler2D uTexOut;   // the same scene extended on all sides (Freepik), lower resolution
uniform vec4 uOut;           // where the extension sits, in image px: x, y, w, h
uniform vec2 uImg;
uniform vec4 uCrop;
uniform float uR;
uniform float uPx;
uniform vec2 uH1;
uniform vec2 uH2;
uniform vec3 uDrops[${N_DROPS}];
varying vec2 vUv;

float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3. - 2. * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}
float fbm(vec2 p) {
  float s = 0., a = 1., n = 0.;
  for (int o = 0; o < 5; o++) { s += (vnoise(p) - .5) * a; n += a; p *= 2.03; a *= .55; }
  return s / n * 3.2;
}
float fbm3(vec2 p) {
  float s = 0., a = 1., n = 0.;
  for (int o = 0; o < 3; o++) { s += (vnoise(p) - .5) * a; n += a; p *= 2.03; a *= .55; }
  return s / n * 3.2;
}
void main() {
  vec2 p = uCrop.xy + vec2(vUv.x, 1. - vUv.y) * uCrop.zw;
  float d1 = distance(p, uH1), d2 = distance(p, uH2);
  float k = 108. + uR * .35;                                  // the two blobs flow into one
  float h = clamp(.5 + .5 * (d2 - d1) / k, 0., 1.);
  float d = mix(d2, d1, h) - k * h * (1. - h);
  float n = fbm(p / 683.);
  float amp = 11. + uR * .22;
  // fine bleed at a FIXED scale: the edge only grows outward, it never boils or trembles
  float n2 = fbm3(p / 70. + 31.7);
  float f = uR - (d + n * amp + n2 * min(14. + uR * .06, 60.));
  float m = clamp(f / (1.6 * uPx) + .5, 0., 1.);
  if (uR > 217.) {
    float grow = min(1., (uR - 217.) / 362.);
    for (int i = 0; i < ${N_DROPS}; i++) {
      vec3 dr = uDrops[i];
      if (abs(distance(dr.xy, uH1) - uR) < 470.) {
        float e = dr.z * grow - distance(p, dr.xy) - n * 7.;
        m = max(m, clamp(e / (1.6 * uPx) + .5, 0., 1.));
      }
    }
  }
  // sharp photo in the middle, the extension around it, blended over 80 px at the seam
  vec3 inner = texture2D(uTex, clamp(p / uImg, 0., 1.)).rgb;
  vec3 outer = texture2D(uTexOut, (p - uOut.xy) / uOut.zw).rgb;
  float e = min(min(p.x, uImg.x - p.x), min(p.y, uImg.y - p.y));
  vec3 col = mix(outer, inner, smoothstep(0., 80., e));
  gl_FragColor = vec4(col * m, m);
}`;

export function initAir(canvas, video) {
  const gl = canvas.getContext('webgl', { premultipliedAlpha: true, alpha: true, antialias: false });
  if (!gl) return null;
  const sh = (type, src) => {
    const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  };
  const prog = gl.createProgram();
  gl.attachShader(prog, sh(gl.VERTEX_SHADER, VERT));
  gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FRAG));
  gl.linkProgram(prog);
  gl.useProgram(prog);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const aPos = gl.getAttribLocation(prog, 'aPos');
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
  const U = (n) => gl.getUniformLocation(prog, n);
  const u = { img: U('uImg'), crop: U('uCrop'), r: U('uR'), px: U('uPx'), h1: U('uH1'), h2: U('uH2'), drops: U('uDrops') };
  gl.uniform2f(u.img, IMG.w, IMG.h);
  gl.uniform1i(U('uTex'), 0);
  gl.uniform1i(U('uTexOut'), 1);
  gl.uniform4f(U('uOut'), ...OUT);
  gl.uniform2f(u.h1, ...PHOTO_HEELS[0]);
  gl.uniform2f(u.h2, ...PHOTO_HEELS[1]);
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const gauss = () => Math.sqrt(-2 * Math.log(rnd() + 1e-9)) * Math.cos(2 * Math.PI * rnd());
  const drops = new Float32Array(N_DROPS * 3);
  for (let i = 0; i < N_DROPS; i++) {
    const hl = PHOTO_HEELS[i % 2];
    drops.set([hl[0] + gauss() * 760, hl[1] + gauss() * 540, 11 + rnd() * 29], i * 3);
  }
  gl.uniform3fv(u.drops, drops);

  let loaded = 0;
  const loadTex = (unit, src) => {
    const tex = gl.createTexture();
    const img = new Image();
    img.onload = () => {
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, img);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      loaded++;
    };
    img.src = src;
  };
  loadTex(0, 'assets/air/air-photo.jpg?v=sage');
  loadTex(1, 'assets/air/air-wide.jpg?v=1');

  let W = 0, H = 0;
  const resize = () => {
    const dpr = 1;            // the ink edge is soft and only lives 1.5 s: 1x keeps it at full frame rate
    W = canvas.clientWidth; H = canvas.clientHeight;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    gl.viewport(0, 0, canvas.width, canvas.height);
  };
  resize();
  addEventListener('resize', resize);

  // final framing = the video's own "cover" framing, so the swap to video lines up exactly
  const finalCrop = () => {
    const [vx, vy, vw, vh] = VIDEO_RECT, a = W / H;
    let w = vw, h = vw / a;
    if (h > vh) { h = vh; w = vh * a; }
    return [vx + (vw - w) / 2, vy + (vh - h) / 2, w, h];
  };
  // start framing: the photo heels sit exactly on the screen heels of the landed 3D shoes
  let startCrop = null;
  function alignTo(heels) {
    const [a, b] = heels;
    const s = Math.hypot(b[0] - a[0], b[1] - a[1]) /
      Math.hypot(PHOTO_HEELS[1][0] - PHOTO_HEELS[0][0], PHOTO_HEELS[1][1] - PHOTO_HEELS[0][1]);
    const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
    const pmx = (PHOTO_HEELS[0][0] + PHOTO_HEELS[1][0]) / 2, pmy = (PHOTO_HEELS[0][1] + PHOTO_HEELS[1][1]) / 2;
    startCrop = [pmx - mx / s, pmy - my / s, W / s, H / s];
  }

  let videoOn = false, visible = true;
  const syncVideo = () => {
    video.classList.toggle('on', videoOn);
    if (videoOn && visible) video.play().catch(() => {});
    else video.pause();
  };
  // browsers may pause a muted background video on their own (power saving): resume it when it
  // should be playing and the page is in front again
  const resume = () => {
    if (videoOn && visible && document.visibilityState === 'visible' && video.paused) video.play().catch(() => {});
  };
  video.addEventListener('pause', () => setTimeout(resume, 250));
  document.addEventListener('visibilitychange', resume);

  // reveal r: 0 → 1. Spots grow at the heels first, then the ink speeds up, then eases out.
  function draw(r, show = true) {
    visible = show;
    canvas.style.visibility = show && r > 0 ? 'visible' : 'hidden';
    const on = r >= 1 && show;
    if (on !== videoOn) { videoOn = on; if (on) video.currentTime = 0; syncVideo(); }
    if (loaded < 2 || !startCrop || W === 0 || r <= 0 || !show) return;
    if (r >= 1 && video.readyState >= 2 && !video.paused) return;   // the video covers it: no need to draw
    const t1 = clamp01(r / 0.2), t2 = clamp01((r - 0.2) / 0.8);
    const R = t2 <= 0 ? R_SLOW * (1 - (1 - t1) ** 2)
      : R_SLOW + (R_FULL - R_SLOW) * (t2 < .5 ? 2 * t2 * t2 : 1 - (-2 * t2 + 2) ** 2 / 2);
    const cam = r * r * (3 - 2 * r);
    const fc = finalCrop();
    const crop = startCrop.map((v, i) => lerp(v, fc[i], cam));
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform4f(u.crop, ...crop);
    gl.uniform1f(u.r, R);
    gl.uniform1f(u.px, crop[2] / canvas.width);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  return { draw, alignTo };
}
