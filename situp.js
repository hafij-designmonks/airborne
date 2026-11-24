// Sit-up physics for one shoe lying on its side: rigid "rocking block" about its sole edges.
// θ = tilt from upright, rad. θ = -π/2 lying on its side, θ = -α balance point, 0 = standing on the sole.
// Lifting from -π/2 to -α is done by the scroll (an invisible hand). From the balance point gravity
// takes over: it falls onto the sole, the impact switches the pivot to the other sole edge and keeps
// only r of the angular speed (Housner, r = 1 - 1.5 sin²α), so it rocks a little and settles.
// Plus a short vertical foam bounce at the first impact.

export const SHOE = {
  len: 0.30,            // m, real shoe length (model length 0.98 units → 1 unit = 0.306 m)
  b: 0.105,             // m, sole width at the ground
  hc: 0.050,            // m, centre of mass height above the sole
};
export const G = 9.81;

export function sitUpParams(s = SHOE) {
  const R = Math.hypot(s.b / 2, s.hc);
  const alpha = Math.atan2(s.b / 2, s.hc);
  const p2 = (3 * G) / (4 * R);                    // rectangular block: I0 = 4/3 m R²
  // hard block: r = 1 - 1.5 sin²α ≈ 0.21; a foam midsole gives some energy back on landing,
  // so the effective restitution of a running shoe is higher (measured drops: 0.4–0.5)
  const rBlock = 1 - 1.5 * Math.sin(alpha) ** 2;
  const r = Math.min(0.46, rBlock + 0.25);
  return { R, alpha, p2, r, rBlock };
}

// Simulate from the balance point. Returns samples [t, θ, foam] every dt (seconds of real time).
export function simulateSitUp({ w0 = 0.6, tEnd = 1.2, dt = 1 / 2000, every = 1 / 120 } = {}, s = SHOE) {
  const { R, alpha, p2, r } = sitUpParams(s);
  let th = -alpha + 1e-4, w = w0, t = 0, next = 0;
  let foamV = 0, foam = 0, impacts = [];
  const out = [];
  const kFoam = 2600, cFoam = 38;                  // foam spring (1/s²) and damping (1/s), foam in metres
  while (t <= tEnd) {
    const acc = th < 0 ? p2 * Math.sin(alpha + th) : -p2 * Math.sin(alpha - th);
    const wPrev = w, thPrev = th;
    w += acc * dt;
    th += w * dt;
    if (Math.sign(th) !== Math.sign(thPrev) && thPrev !== 0) {      // sole slaps the floor
      foamV -= Math.abs(wPrev) * R * 0.25;                       // each slap squeezes the foam (~3 mm first)
      w *= r;
      th = 0;
      impacts.push([+t.toFixed(4), +Math.abs(wPrev).toFixed(3)]);
      if (Math.abs(w) < 0.02) w = 0;
    }
    foamV += (-kFoam * foam - cFoam * foamV) * dt;
    foam += foamV * dt;
    if (t >= next) { out.push([t, th, foam]); next += every; }
    t += dt;
  }
  return { samples: out, impacts, alpha, r };
}
