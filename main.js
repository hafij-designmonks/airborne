// Airborne landing — one smooth-scroll instance drives the hero spiral, the air reveal and the rest.
import Lenis from 'lenis';
import { initHero } from './hero.js';
import { initAir } from './air.js';
import { initSitUp } from './situp-scene.js';

if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
scrollTo(0, 0);

const lenis = new Lenis({ syncTouch: false });
window.__lenis = lenis;
// the WebGL pieces must never take the shop down with them (no GPU, blocked WebGL, old browser)
try { initHero(lenis); } catch (err) { console.warn('hero spiral off:', err); }

/* after the text: the 3D pair sits up; its landing opens the video from the heels */
const SHOW = [0.98, 1.12];          // 3D pair takes over under the text's black band (flat pair is dark by 0.98)
const LIFT = [1.35, 1.75];          // starts the moment the pair is fully uncovered under the body text
const REVEAL_IN = 1.5;              // s, heels → full close shot
const REVEAL_OUT = 0.6;             // s, back again when scrolling up past the tipping point
let air = null;
try { air = initAir(document.getElementById('airCanvas'), document.getElementById('airVideo')); } catch (err) { console.warn('air reveal off:', err); }
let reveal = 0, revealDir = 0;
let situp = null;
try {
  initSitUp(document.getElementById('situp'), {
    SHOW, LIFT,
    onLand: (heels) => { air?.alignTo(heels); revealDir = 1; },
    onUnland: () => { revealDir = -1; },
  }).then((s) => { situp = s; window.__situp = s; }).catch((err) => console.warn('sit-up off:', err));
} catch (err) { console.warn('sit-up off:', err); }
window.__air = air;
window.__setReveal = (r) => { reveal = r; revealDir = 0; };   // for checking stills

const restEl = document.querySelector('.rest');
const fixedEls = [document.getElementById('situp'), document.getElementById('air')];
let lastShift = -1;
let lastT = performance.now();
const raf = (t) => {
  lenis.raf(t);
  const now = performance.now(), dt = Math.min(0.05, (now - lastT) / 1000); lastT = now;
  const p = lenis.scroll / innerHeight;
  // no overlap: once the next section reaches the bottom of the screen, the film scrolls up with it
  const shift = Math.max(0, lenis.scroll - (restEl.offsetTop - innerHeight));
  const live = shift < innerHeight;
  if (shift !== lastShift) { lastShift = shift; for (const el of fixedEls) el.style.transform = shift ? `translate3d(0, ${-shift}px, 0)` : ''; }
  if (situp && live) situp.update(p, now / 1000);
  if (revealDir > 0) reveal = Math.min(1, reveal + dt / REVEAL_IN);
  if (revealDir < 0) { reveal = Math.max(0, reveal - dt / REVEAL_OUT); if (reveal === 0) revealDir = 0; }
  // a fast scroll never outruns the reveal: past the landing, the scroll itself pushes it to the end
  if (p > LIFT[1] && revealDir >= 0) reveal = Math.max(reveal, Math.min(1, (p - LIFT[1]) / 0.45));
  if (air) air.draw(reveal, live);
  else {   // no WebGL: skip the ink, just play the film once the pair would have landed
    const v = document.getElementById('airVideo'), on = p > LIFT[1] && live;
    if (on !== v.classList.contains('on')) { v.classList.toggle('on', on); on ? v.play().catch(() => {}) : v.pause(); }
  }
  requestAnimationFrame(raf);
};
requestAnimationFrame(raf);

/* ------------------------------------------------------------------ */
/* the reveal caption: placed in the video's own coordinates            */
/* ------------------------------------------------------------------ */
// The swing video is 1920 × 1080 drawn with object-fit: cover. The caption lives in the clear sky right of the
// right shoe: source px x 1340 → 1720 (the sky ends at the window frame there; ink on the frame would vanish), y from 560. If that pocket is too narrow on screen, it moves
// to the foot of the frame.
const revealEl = document.getElementById('reveal');
const capEl = document.getElementById('revealCap');
const airVideo = document.getElementById('airVideo');
const placeCap = () => {
  const W = innerWidth, H = innerHeight;
  const s = Math.max(W / 1920, H / 1080), ox = (W - 1920 * s) / 2, oy = (H - 1080 * s) / 2;
  const left = ox + 1340 * s, right = ox + 1720 * s, top = oy + 560 * s;
  const fits = W >= 900 && right - left >= 290;
  capEl.classList.toggle('foot', !fits);
  revealEl.classList.toggle('foot', !fits);
  if (fits) Object.assign(capEl.style, { left: `${left}px`, top: `${top}px`, width: `${Math.min(320, right - left)}px` });
};
placeCap();
addEventListener('resize', placeCap);
const syncReveal = () => revealEl.classList.toggle('on', airVideo.classList.contains('on'));
new MutationObserver(syncReveal).observe(airVideo, { attributes: true, attributeFilter: ['class'] });

/* ------------------------------------------------------------------ */
/* best sellers: two rows, filters, colour swatches, quick add         */
/* ------------------------------------------------------------------ */
const COLORS = {
  sage: { name: 'Sage', hex: '#a9bba9' },
  'ice-cobalt': { name: 'Ice Cobalt', hex: '#c9d0d8' },
  'white-blaze': { name: 'White Blaze', hex: '#f2f1ee' },
  'navy-sky': { name: 'Navy Sky', hex: '#27324a' },
};
const PRODUCTS = [
  { n: 'Cloud Drift', k: 'sage', p: 165, tag: 'Bestseller', r: 4.9, rc: '3.2k' },
  { n: 'Cloud Drift', k: 'ice-cobalt', p: 165, tag: 'New', r: 4.8, rc: '1.1k' },
  { n: 'Cloud Drift', k: 'white-blaze', p: 165, r: 4.8, rc: '2.4k' },
  { n: 'Cloud Drift', k: 'navy-sky', p: 165, tag: 'Back in stock', r: 4.9, rc: '2.9k' },
  { n: 'Cloud Drift Lite', k: 'sage', p: 145, was: 160, r: 4.7, rc: '860', alt: true },
  { n: 'Cloud Drift Lite', k: 'ice-cobalt', p: 145, r: 4.7, rc: '540', alt: true },
  { n: 'Cloud Drift Lite', k: 'white-blaze', p: 145, tag: 'Few left', r: 4.8, rc: '710', alt: true },
  { n: 'Cloud Drift Lite', k: 'navy-sky', p: 145, was: 160, r: 4.7, rc: '930', alt: true },
];
const SIZES = [6, 7, 8, 9, 10, 11, 12];
const imgs = (p, k) => (p.alt ? [`${k}-b`, `${k}-a`] : [`${k}-a`, `${k}-b`]);   // Lite leads with the other angle
const grid = document.getElementById('grid');
grid.innerHTML = PRODUCTS.map((p, i) => {
  const [a, b] = imgs(p, p.k);
  const badge = p.was ? `<span class="badge sale">Save $${p.was - p.p}</span>` : p.tag ? `<span class="badge">${p.tag}</span>` : '';
  const swatches = Object.entries(COLORS).map(([k, c]) =>
    `<button type="button" role="radio" aria-checked="${k === p.k}" aria-label="${c.name}" class="${k === p.k ? 'on' : ''}" data-k="${k}" style="background:${c.hex}"></button>`).join('');
  return `
  <article class="prod rv" data-line="${p.n}" data-i="${i}">
    <div class="p-box">
      <a class="p-img" href="#sellers" aria-label="${p.n}, ${COLORS[p.k].name}, $${p.p}">
        ${badge}
        <img class="main" src="assets/products/${a}.webp" alt="" loading="lazy" />
        <img class="alt" src="assets/products/${b}.webp" alt="" loading="lazy" />
      </a>
      <button class="fav" type="button" aria-label="Save ${p.n}" aria-pressed="false"><i data-lucide="heart"></i></button>
      <div class="quick">
        <span class="t-label"><span class="q-title">Quick add</span><span class="q-msg">US size</span></span>
        <div class="sizes">${SIZES.map((s) => `<button type="button" data-s="${s}">${s}</button>`).join('')}</div>
      </div>
    </div>
    <div class="p-info">
      <div class="p-row"><h3 class="p-name">${p.n}</h3><span class="p-price">${p.was ? `<s>$${p.was}</s>` : ''}$${p.p}</span></div>
      <div class="p-row"><span class="p-col">${COLORS[p.k].name}</span><span class="p-rate"><i data-lucide="star"></i>${p.r} (${p.rc})</span></div>
      <div class="swatches" role="radiogroup" aria-label="Colour">${swatches}</div>
    </div>
  </article>`;
}).join('');

grid.addEventListener('click', (e) => {
  const card = e.target.closest('.prod'); if (!card) return;
  const p = PRODUCTS[+card.dataset.i];
  const sw = e.target.closest('.swatches button');
  if (sw) {   // colour swatch: swap the shoe and the colour name
    const k = sw.dataset.k, [a, b] = imgs(p, k);
    card.querySelector('.main').src = `assets/products/${a}.webp`;
    card.querySelector('.alt').src = `assets/products/${b}.webp`;
    card.querySelector('.p-col').textContent = COLORS[k].name;
    card.querySelectorAll('.swatches button').forEach((x) => { x.classList.toggle('on', x === sw); x.setAttribute('aria-checked', x === sw); });
    return;
  }
  const fav = e.target.closest('.fav');
  if (fav) { const on = fav.classList.toggle('on'); fav.setAttribute('aria-pressed', on); return; }
  const size = e.target.closest('.sizes button');
  if (size) {   // one tap adds to the bag
    const q = card.querySelector('.quick');
    q.classList.add('done');
    q.querySelector('.q-title').textContent = 'In your bag';
    q.querySelector('.q-msg').textContent = `US ${size.dataset.s}`;
    clearTimeout(q._t);
    q._t = setTimeout(() => { q.classList.remove('done'); q.querySelector('.q-title').textContent = 'Quick add'; q.querySelector('.q-msg').textContent = 'US size'; }, 2400);
  }
});

// filters
document.querySelectorAll('.chip').forEach((chip) => chip.addEventListener('click', () => {
  document.querySelectorAll('.chip').forEach((c) => { c.classList.toggle('on', c === chip); c.setAttribute('aria-selected', c === chip); });
  const f = chip.dataset.f;
  grid.querySelectorAll('.prod').forEach((card) => { card.hidden = f !== 'all' && card.dataset.line !== f; });
}));

/* ------------------------------------------------------------------ */
/* studio column: the cards come out of On repeat; the last shoe loses   */
/* its backdrop from the toe up and rides the centre down to the footer  */
/* ------------------------------------------------------------------ */
const repeatEl = document.querySelector('.repeat');
const repTitle = document.querySelector('.repeat-copy .t-h2');
const studio = document.getElementById('studio');
const sCards = [...studio.querySelectorAll('.s-card:not(.s-hero)')];
const sHero = document.getElementById('sHero');
const sBg = sHero.querySelector('.s-bg');
const sCut = document.getElementById('sCut');
const footShoe = document.getElementById('footShoe');
const outLines = [...document.querySelectorAll('#out .o-line')];
const outBtn = document.getElementById('outBtn');
// where the shoe sits inside its photo (from the cut-out's bounds), as fractions of the card
const SHOE = { top: 107 / 900, bottom: 789 / 900, x0: 318 / 900, x1: 585 / 900, w: (585 - 318) / 900 };   // square crop, shoe at 85%
const footEl = document.getElementById('foot');
const pCards = document.getElementsByClassName('p-img');   // live: the shop grid re-renders on filter
const clamp01 = (v) => Math.min(1, Math.max(0, v));
const ease = (v) => v * v * (3 - 2 * v);

// the first card starts level with the top of the "On repeat" title, so it only overlaps that strip
const placeStudio = () => {
  const ov = innerWidth < 900 ? 0 : repeatEl.getBoundingClientRect().bottom - repTitle.getBoundingClientRect().top;
  studio.style.setProperty('--ov', `${Math.max(0, ov)}px`);
};

// split each title line in two at the centre of the screen, so it can open around the shoe
const splitLines = () => {
  const cx = innerWidth / 2;
  outLines.forEach((line) => {
    const text = line.dataset.text || (line.dataset.text = line.textContent);
    line.innerHTML = [...text].map((ch) => `<span>${ch}</span>`).join('');
    let k = text.length;
    [...line.children].some((sp, i) => { const r = sp.getBoundingClientRect(); if (r.left + r.width / 2 > cx) { k = i; return true; } return false; });
    line.innerHTML = `<span class="o-l">${text.slice(0, k)}</span><span class="o-r">${text.slice(k)}</span>`;
    line._lr = line.firstElementChild.getBoundingClientRect().right; line._rl = line.lastElementChild.getBoundingClientRect().left;
  });
  // the button: its label / price divide goes on the centre line
  outBtn.style.setProperty('--bx', '0px');
  const pr = outBtn.querySelector('.pt-p').getBoundingClientRect();
  outBtn.style.setProperty('--bx', `${cx - pr.left}px`);
  outBtn._lr = cx; outBtn._rl = cx;   // the label / price divide sits exactly on the centre line
};
const layoutStudio = () => { placeStudio(); splitLines(); footShoe.style.setProperty('--my', `${footShoe.offsetWidth * (SHOE.bottom - SHOE.top) + 20}px`); };
requestAnimationFrame(layoutStudio); addEventListener('resize', layoutStudio);   // after the price tags below are built document.fonts?.ready.then(layoutStudio);

// spec sheet: one entry per card (placeholder numbers until real specs arrive)
const SPECS = [
  { c: 'Navy Sky', stat: ['Heel-to-toe drop', '8', 'mm'], cap: 'Low enough to feel the ground, enough to spare your calves on the last mile.', rows: [['Weight', '252 g'], ['Drop', '8 mm'], ['Upper', 'Engineered knit'], ['Sole', '18 cloud pods'], ['Price', 'From $145']] },
  { c: 'Ice Cobalt', stat: ["Weight, men's 9", '236', 'g'], cap: 'Lighter than a paperback, and it breathes like one is open.', rows: [['Weight', '236 g'], ['Drop', '8 mm'], ['Upper', 'Open mesh knit'], ['Sole', '18 cloud pods'], ['Price', 'From $145']] },
  { c: 'White Blaze', stat: ['Cloud pods', '18', ''], cap: 'Each one squashes flat as you land and pushes back as you go.', rows: [['Weight', '244 g'], ['Drop', '8 mm'], ['Upper', 'Two-tone knit'], ['Sole', '18 cloud pods'], ['Price', 'From $145']] },
  { c: 'Sage', stat: ['Recycled upper', '74', '%'], cap: 'Knit from recycled bottles, with foam made from sugarcane.', rows: [['Weight', '248 g'], ['Drop', '8 mm'], ['Upper', 'Recycled knit'], ['Sole', '18 cloud pods'], ['Price', 'From $165']] },
  { c: 'Sage, from above', stat: ['Day trial', '60', ''], cap: 'Wear them out properly. Not right? Send them back within 60 days.', rows: [['Weight', '248 g'], ['Drop', '8 mm'], ['Upper', 'Recycled knit'], ['Sole', '18 cloud pods'], ['Price', 'From $165']] },
];
const sList = [...document.querySelectorAll('#sList li')];
const specNo = document.getElementById('specNo'), specRows = document.getElementById('specRows');
const bigLab = document.getElementById('bigLab'), bigNum = document.getElementById('bigNum'), bigCap = document.getElementById('bigCap');
const sLink = document.getElementById('sLink');
const wirePath = sLink.querySelector('path'), wireDot = sLink.querySelector('rect');
const wire = { live: false };
const springPt = (p, tx, ty, k, c, dt) => {
  p.vx += (k * (tx - p.x) - c * p.vx) * dt; p.vy += (k * (ty - p.y) - c * p.vy) * dt;
  p.x += p.vx * dt; p.y += p.vy * dt;
};
const allCards = [...sCards, sHero];
const roll = (el, value, unit) => {
  const old = el.querySelector('.now:not(.out)');
  const nu = document.createElement('span');
  nu.className = 'now in';
  nu.innerHTML = [...value].map((ch, i) => `<span style="--i:${i}">${ch}</span>`).join('') + (unit ? `<span class="u" style="--i:${value.length}">${unit}</span>` : '');
  el.appendChild(nu);
  void nu.offsetWidth;
  nu.classList.remove('in');
  if (old) { old.classList.add('out'); setTimeout(() => old.remove(), 1000); }
};
let activeCard = -1;
const setActive = (i) => {
  if (i === activeCard) return;
  activeCard = i;
  const d = SPECS[i];
  sList.forEach((li, k) => li.classList.toggle('on', k === i));
  specNo.textContent = String(i + 1).padStart(2, '0');
  specRows.classList.add('swap');
  specRows.innerHTML = d.rows.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('');
  void specRows.offsetWidth; specRows.classList.remove('swap');
  bigLab.textContent = d.stat[0]; bigCap.textContent = d.cap;
  roll(bigNum, d.stat[1], d.stat[2]);
};
setActive(0);

// carving: the leading edge of every card bends into a curve while the page moves (top edge on the way down,
// bottom edge on the way up), deeper the faster you scroll, and springs back flat when you stop
let carve = 0;
const carvePath = (w, h, d) => {
  // both edges bend the same way, like a sheet lagging behind the scroll: going down, the middle sags
  // (top edge dips, bottom edge's corners lift); going up, the middle rises. The card never grows past its box.
  const n = 14, top = [], bot = [], a = Math.abs(d), down = d >= 0;
  for (let i = 0; i <= n; i++) {
    const x = (i / n) * w, k = Math.sin(Math.PI * i / n);
    top.push(`${x.toFixed(1)}px ${(down ? a * k : a * (1 - k)).toFixed(1)}px`);
    bot.push(`${x.toFixed(1)}px ${(down ? h - a * (1 - k) : h - a * k).toFixed(1)}px`);
  }
  return `polygon(${top.concat(bot.reverse()).join(',')})`;
};
// the split title and button close with a small, soft bounce, like the foam giving back
const springs = new Map();
const spring = (key, target, dt) => {
  const st = springs.get(key) || { x: 0, v: 0 };
  const k = 210, c = 17;                       // about 9% overshoot
  st.v += (k * (target - st.x) - c * st.v) * dt; st.x += st.v * dt;
  if (Math.abs(target - st.x) < 0.05 && Math.abs(st.v) < 0.05) { st.x = target; st.v = 0; }
  springs.set(key, st); return st.x;
};
let sLast = performance.now(), sLastScroll = 0;
const studioTick = () => {
  const now = performance.now(), dt = Math.min(1 / 30, (now - sLast) / 1000); sLast = now;
  const H = innerHeight;
  const sc = lenis.scroll, vel = dt > 0 ? (sc - sLastScroll) / (dt * 60) : 0; sLastScroll = sc;   // px per 60th of a second
  carve += (vel - carve) * 0.12;
  const cv = Math.max(-1, Math.min(1, carve / 40));
  const carveAll = (list, depth) => list.forEach((c) => {
    const r = c.getBoundingClientRect();
    if (r.bottom < -50 || r.top > H + 50) return;
    const d = cv * r.height * depth;
    c.style.clipPath = Math.abs(d) < 0.3 ? '' : carvePath(r.width, r.height, d);
  });
  carveAll([...sCards, sBg], 0.115);
  carveAll([...pCards], 0.08);
  // the selected card is the one nearest the middle of the screen; the others rest at about 60%
  let best = 0, bestD = Infinity;
  const rects = allCards.map((c) => c.getBoundingClientRect());
  rects.forEach((r, i) => {
    const dist = Math.abs(r.top + r.height / 2 - H / 2);
    if (dist < bestD) { bestD = dist; best = i; }
    const k = ease(clamp01(dist / (r.height * 0.9)));
    const el = i === 4 ? sBg : allCards[i];
    const f = `brightness(${(1 - 0.4 * k).toFixed(3)})`;
    if (el.style.filter !== f) el.style.filter = f;
  });
  const sr = studio.getBoundingClientRect();
  const inStudio = sr.top < H * 0.45 && sr.bottom > H * 0.55;
  if (inStudio) setActive(best);
  // pointer: the start and most of the line are held straight and exact; only the front part, where it meets the
  // card, flexes. Its tip chases the card on a soft spring, and only a fifth of that lag is drawn, so when the
  // selection changes the front bends gently, bounces once and settles straight
  const li = sList[activeCard];
  if (inStudio && li && innerWidth >= 900) {
    const a = li.getBoundingClientRect(), r = rects[activeCard];
    const x1 = a.right + 14, y1 = a.top + a.height / 2, x2 = r.left - 14, y2 = Math.min(r.bottom - 20, Math.max(r.top + 20, y1));
    if (!wire.live) Object.assign(wire, { live: true, tip: { x: x2, y: y2, vx: 0, vy: 0 } });
    springPt(wire.tip, x2, y2, 150, 13, dt);
    const ex = x2 + (wire.tip.x - x2) * 0.2, ey = y2 + (wire.tip.y - y2) * 0.2;   // 80% less bend
    const dx = x2 - x1, dy = y2 - y1;
    const sx = x1 + dx * 0.6, sy = y1 + dy * 0.6;     // straight up to here
    const cx = x1 + dx * 0.8, cy = y1 + dy * 0.8;     // the curve leaves along the same line, so the joint is smooth
    wirePath.setAttribute('d', `M${x1.toFixed(1)} ${y1.toFixed(1)} L${sx.toFixed(1)} ${sy.toFixed(1)} Q${cx.toFixed(1)} ${cy.toFixed(1)} ${ex.toFixed(1)} ${ey.toFixed(1)}`);
    wireDot.setAttribute('x', (ex - 3.5).toFixed(1)); wireDot.setAttribute('y', (ey - 3.5).toFixed(1));
    sLink.style.opacity = a.bottom > 0 && a.top < H && dx > 20 ? '1' : '0';
  } else { sLink.style.opacity = '0'; wire.live = false; }
  // the hero: the cut-out shoe holds the middle of the screen once its card gets there, while the empty backdrop scrolls on
  const hr = sHero.getBoundingClientRect(), hc = hr.top + hr.height / 2;
  const fr = footShoe.getBoundingClientRect(), fc = fr.top + fr.height / 2;
  const ty = Math.min(Math.max(0, H / 2 - hc), fc - hc);
  sCut.style.transform = ty > 0 ? `translate3d(0, ${ty.toFixed(1)}px, 0)` : '';
  footEl.classList.toggle('paired', fc - hc - ty < 1 && fc < H);
  // the Out there title and button open where the shoe passes, each half stopping 14px clear of it, then spring shut
  const sTop = hr.top + ty + hr.height * SHOE.top, sBot = hr.top + ty + hr.height * SHOE.bottom;
  const sL = hr.left + hr.width * SHOE.x0 - 14, sR = hr.left + hr.width * SHOE.x1 + 14;
  const near = (r) => { const out = Math.max(sTop - r.bottom, r.top - sBot, 0); return ease(clamp01(1 - out / 60)); };   // any overlap with the shoe opens fully
  const part = (key, el, r, lr, rl, a, b) => {
    const f = near(r);
    const gl = spring(`${key}l`, f * Math.max(0, lr - sL), dt), gr = spring(`${key}r`, f * Math.max(0, sR - rl), dt);
    a.style.transform = Math.abs(gl) > 0.05 ? `translateX(${(-gl).toFixed(1)}px)` : '';
    b.style.transform = Math.abs(gr) > 0.05 ? `translateX(${gr.toFixed(1)}px)` : '';
  };
  outLines.forEach((line, i) => {
    const r = line.getBoundingClientRect();
    if (r.bottom < -80 || r.top > H + 80) return;
    part(i, line, r, line._lr, line._rl, line.firstElementChild, line.lastElementChild);
  });
  const br = outBtn.getBoundingClientRect();
  if (br.bottom > -80 && br.top < H + 80) part('btn', outBtn, br, outBtn._lr, outBtn._rl, outBtn.querySelector('.pt-l'), outBtn.querySelector('.pt-p'));
  requestAnimationFrame(studioTick);
};
requestAnimationFrame(studioTick);

/* footer wordmark: letters hop onto the line, one after another, each time it comes into view */
const footWord = document.getElementById('footWord');
footWord.innerHTML = [...'Airborne'].map((ch, i) => `<span style="--i:${i}" aria-hidden="true">${ch}</span>`).join('');
new IntersectionObserver(([e]) => {
  if (e.isIntersecting) { footWord.classList.remove('play'); void footWord.offsetWidth; footWord.classList.add('play'); }
}, { threshold: 0.5 }).observe(footWord);
footWord.addEventListener('animationend', (e) => { if (e.target === footWord.lastElementChild) footWord.classList.remove('play'); });

/* price tag buttons: label + price, built from data-price (and data-to for a launch price) */
document.querySelectorAll('.ptag').forEach((el) => {
  const label = el.textContent.trim(), from = el.dataset.price, to = el.dataset.to;
  const chars = (s) => [...s].map((c, i) => `<span style="--i:${i}">${c}</span>`).join('');
  const arrow = (i) => `<i data-lucide="arrow-right" style="--i:${i}"></i>`;
  el.innerHTML = `<span class="pt-l"><span class="pt-w"><span class="pt-t" data-t="${label}">${label}</span></span></span>`
    + `<span class="pt-p" aria-hidden="true"><span class="pt-c"><span class="pt-a">${from ? chars(from) : arrow(0)}</span>`
    + `<span class="pt-b">${to ? chars(to) : arrow(from ? Math.max(0, from.length - 2) : 1)}</span></span></span>`;
  if (el.tagName === 'A' && from) el.setAttribute('aria-label', `${label}, ${to ? `${to} ${el.dataset.note || ''}`.trim() : from}`);
});

/* Lucide icons (script is deferred; module runs after it) */
const icons = () => window.lucide?.createIcons({ attrs: { 'stroke-width': 1.6 } });
if (window.lucide) icons(); else addEventListener('load', icons);


/* in-page links go through the smooth scroll */
document.querySelectorAll('a[href^="#"]').forEach((a) => a.addEventListener('click', (e) => {
  const id = a.getAttribute('href');
  if (id.length > 1 && document.querySelector(id)) { e.preventDefault(); lenis.scrollTo(id, { duration: 1.4, offset: 0 }); }
}));
