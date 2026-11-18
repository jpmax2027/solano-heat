// SOLANO HEAT — a small seeded RNG (mulberry32) plus helpers. The world is
// generated from a fixed seed so Port Solano is the same city on every load
// and in every screenshot; gameplay picks its own stream from the same seed.

export function makeRng(seed) {
  let a = seed >>> 0;
  const next = () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    range: (lo, hi) => lo + next() * (hi - lo),
    int: (lo, hi) => Math.floor(lo + next() * (hi - lo + 1)),
    pick: (arr) => arr[Math.floor(next() * arr.length)],
    chance: (p) => next() < p,
  };
}

export const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
export const lerp = (a, b, t) => a + (b - a) * t;

/** Shortest signed turn from angle a to angle b, in radians. */
export function angleDelta(a, b) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

export function dist2(ax, ay, bx, by) {
  const dx = ax - bx, dy = ay - by;
  return dx * dx + dy * dy;
}

/** Push a circle (x, y, r) out of an axis-aligned rect; returns corrected [x, y]. */
export function resolveCircleRect(x, y, r, rect) {
  const nx = clamp(x, rect.x, rect.x + rect.w);
  const ny = clamp(y, rect.y, rect.y + rect.h);
  let dx = x - nx, dy = y - ny;
  const d2 = dx * dx + dy * dy;
  if (d2 > r * r) return [x, y];
  if (d2 > 0.0001) {
    const d = Math.sqrt(d2);
    return [nx + (dx / d) * r, ny + (dy / d) * r];
  }
  // Centre inside the rect: push out along the smallest penetration.
  const left = x - rect.x, right = rect.x + rect.w - x;
  const top = y - rect.y, bottom = rect.y + rect.h - y;
  const m = Math.min(left, right, top, bottom);
  if (m === left) return [rect.x - r, y];
  if (m === right) return [rect.x + rect.w + r, y];
  if (m === top) return [x, rect.y - r];
  return [x, rect.y + rect.h + r];
}

export function pointInRect(x, y, rect, pad = 0) {
  return x >= rect.x - pad && x <= rect.x + rect.w + pad && y >= rect.y - pad && y <= rect.y + rect.h + pad;
}
