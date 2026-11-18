// SOLANO HEAT — the living city: traffic that drives the road graph, parked
// cars waiting to be borrowed, police that hunt, pedestrians that stroll and
// flee, pickups, and the particle/skid/floater effects. The game state object
// G is passed in; this module owns the per-step behaviour of everything that
// is not the player.

import { TILE, CAR_TYPES } from './config.js';
import { clamp, lerp, angleDelta, dist2, resolveCircleRect } from './random.js';
import { nearestNode, nextNode, isWaterPx } from './world.js';

const LANE = TILE * 0.52;

export function makeCar(typeIdx, x, y, angle, driver) {
  const type = CAR_TYPES[typeIdx];
  return {
    type: typeIdx, x, y, angle, vx: 0, vy: 0, speed: 0,
    driver, // 'traffic' | 'cop' | 'player' | null (parked)
    hp: 100, braking: false, honkT: 0, smokeT: 0, disabled: false,
    fromNode: null, toNode: null, waitT: 0, color: type.color,
    alarmT: 0, id: Math.random().toString(36).slice(2),
  };
}

export function carRadius(car) {
  return CAR_TYPES[car.type].l * 0.34;
}

/** Lane-corrected target point for a car driving from one node to another. */
function laneTarget(car) {
  const a = car.fromNode, b = car.toNode;
  const dx = Math.sign(b.x - a.x), dy = Math.sign(b.y - a.y);
  // Right-hand traffic: offset to the right of the direction of travel.
  return { x: b.x + dy * LANE, y: b.y - dx * LANE, dx, dy };
}

function pickNextNode(G, car) {
  const here = car.toNode;
  const came = car.fromNode;
  const options = [];
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const n = nextNode(G.world, here, dx, dy);
    if (n && n !== came) options.push(n);
  }
  const straight = options.find(
    (n) => Math.sign(n.x - here.x) === Math.sign(here.x - came.x) &&
           Math.sign(n.y - here.y) === Math.sign(here.y - came.y),
  );
  const next = straight && G.rng.chance(0.65) ? straight : G.rng.pick(options.length ? options : [came]);
  car.fromNode = here;
  car.toNode = next;
}

export function spawnTraffic(G, count) {
  const cars = [];
  for (let i = 0; i < count; i++) {
    const node = G.rng.pick(G.world.nodes);
    const car = makeCar(G.rng.int(0, 5), node.x, node.y, 0, 'traffic');
    car.fromNode = node;
    car.toNode = nextNode(G.world, node, G.rng.pick([1, -1]), 0) ?? nextNode(G.world, node, 0, 1);
    if (!car.toNode) continue;
    // Start part-way along the segment so the grid does not move in lockstep.
    const t = G.rng.range(0.15, 0.85);
    car.x = car.fromNode.x + (car.toNode.x - car.fromNode.x) * t;
    car.y = car.fromNode.y + (car.toNode.y - car.fromNode.y) * t;
    const lt = laneTarget(car);
    car.x += (lt.x - car.toNode.x) * 0 + Math.sign(lt.y - car.toNode.y) * 0; // lane applied in steering
    car.angle = Math.atan2(car.toNode.y - car.fromNode.y, car.toNode.x - car.fromNode.x);
    cars.push(car);
  }
  return cars;
}

export function spawnParked(G) {
  return G.world.parking.map((spot) => {
    const car = makeCar(G.rng.int(0, 5), spot.x, spot.y, spot.angle + (G.rng.chance(0.5) ? 0 : Math.PI), null);
    if (G.rng.chance(0.3)) car.color = G.rng.pick(['#8e6cc8', '#4fb3a9', '#d8d3c3', '#5b7fa6', '#b3543f']);
    return car;
  });
}

/** Something ahead? Returns the gap in px to the nearest blocker, or Infinity. */
function gapAhead(G, car, lookDist) {
  const fx = Math.cos(car.angle), fy = Math.sin(car.angle);
  let best = Infinity;
  const probe = (ox, oy, r) => {
    const dx = ox - car.x, dy = oy - car.y;
    const along = dx * fx + dy * fy;
    const side = Math.abs(dx * -fy + dy * fx);
    if (along > 0 && along < lookDist && side < r + 16) best = Math.min(best, along);
  };
  for (const other of G.cars) {
    if (other !== car) probe(other.x, other.y, carRadius(other));
  }
  if (G.player.car !== car) probe(G.player.x, G.player.y, 20);
  for (const ped of G.peds) {
    if (ped.state !== 'down') probe(ped.x, ped.y, 12);
  }
  return best;
}

function driveCar(G, car, dt, target, cruise, topSpeed) {
  const type = CAR_TYPES[car.type];
  const want = Math.atan2(target.y - car.y, target.x - car.x);
  const turn = clamp(angleDelta(car.angle, want), -2.4 * dt, 2.4 * dt);
  car.angle += turn * clamp(Math.abs(car.speed) / 60, 0.25, 1);
  let goal = cruise;
  const gap = gapAhead(G, car, 95);
  if (gap < 60) goal = 0;
  else if (gap < 95) goal = cruise * 0.4;
  car.braking = goal < car.speed - 4;
  const accel = car.braking ? 320 : type.accel * 0.55;
  car.speed = clamp(car.speed + clamp(goal - car.speed, -accel * dt, accel * dt), 0, topSpeed);
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  collideCarWorld(G, car);
}

export function updateTrafficCar(G, car, dt) {
  if (car.disabled) return;
  if (car.waitT > 0) {
    car.waitT -= dt;
    car.speed = Math.max(0, car.speed - 300 * dt);
    return;
  }
  const target = laneTarget(car);
  driveCar(G, car, dt, target, 148, 175);
  const d = Math.hypot(car.toNode.x - car.x, car.toNode.y - car.y);
  if (d < 44) {
    if (G.rng.chance(0.12)) car.waitT = G.rng.range(0.3, 1.1); // a pause at the lights
    pickNextNode(G, car);
  }
}

export function spawnCop(G) {
  // Spawn on a road node off-camera, a few blocks from the player.
  const p = G.player;
  const candidates = G.world.nodes.filter((n) => {
    const d = Math.hypot(n.x - p.x, n.y - p.y);
    return d > 620 && d < 1250;
  });
  const node = candidates.length ? G.rng.pick(candidates) : nearestNode(G.world, p.x + 700, p.y);
  const car = makeCar(6, node.x, node.y, 0, 'cop');
  car.sirenPhase = G.rng.range(0, 6);
  G.cars.push(car);
  return car;
}

export function updateCopCar(G, car, dt) {
  if (car.disabled) return;
  const p = G.player;
  const stars = G.wanted.stars;
  // Aim where the player is heading, not where they are.
  const lead = 0.45;
  const tx = p.x + (p.vx ?? 0) * lead, ty = p.y + (p.vy ?? 0) * lead;
  const d = Math.hypot(p.x - car.x, p.y - car.y);
  let cruise = CAR_TYPES[car.type].top * (0.62 + stars * 0.07);
  if (!p.car && d < 70) cruise = 60; // pull up beside a runner instead of flattening them
  driveCar(G, car, dt, { x: tx, y: ty }, cruise, CAR_TYPES[car.type].top * (0.7 + stars * 0.07));
}

/** Keep a car out of buildings and the sea; returns impact speed if it hit. */
export function collideCarWorld(G, car) {
  const r = carRadius(car);
  let impact = 0;
  for (const b of G.world.buildings) {
    const before = { x: car.x, y: car.y };
    const [nx, ny] = resolveCircleRect(car.x, car.y, r, b);
    if (nx !== car.x || ny !== car.y) {
      impact = Math.max(impact, Math.abs(car.speed));
      car.x = nx; car.y = ny;
      car.speed *= 0.35;
      if (Math.hypot(before.x - nx, before.y - ny) > 0.1) car.angle += (Math.random() - 0.5) * 0.1;
    }
  }
  car.x = clamp(car.x, r, G.world.w - r);
  car.y = clamp(car.y, r, G.world.h - r);
  if (isWaterPx(car.x, car.y)) {
    // Cars that reach the water stop dead at the shoreline.
    car.x -= Math.cos(car.angle) * car.speed * (1 / 60);
    car.y -= Math.sin(car.angle) * car.speed * (1 / 60);
    car.speed = 0;
    car.hp -= 12;
    if (car.hp <= 0) car.disabled = true;
  }
  return impact;
}

/** Soft separation so cars overlap less; returns the hardest contact speed. */
export function separateCars(G, dt) {
  let impact = 0;
  const cars = G.cars;
  for (let i = 0; i < cars.length; i++) {
    for (let j = i + 1; j < cars.length; j++) {
      const a = cars[i], b = cars[j];
      const dx = b.x - a.x, dy = b.y - a.y;
      const rr = carRadius(a) + carRadius(b);
      const d2 = dx * dx + dy * dy;
      if (d2 > rr * rr || d2 === 0) continue;
      const d = Math.sqrt(d2);
      const push = ((rr - d) / 2) * 0.8;
      const nx = dx / d, ny = dy / d;
      a.x -= nx * push; a.y -= ny * push;
      b.x += nx * push; b.y += ny * push;
      const rel = Math.abs(a.speed - b.speed) + Math.abs(a.speed) * 0.3;
      if (push > 1.2) {
        impact = Math.max(impact, rel);
        a.hp -= rel * 0.05; b.hp -= rel * 0.05;
        a.speed *= 0.72; b.speed *= 0.72;
        if (a.hp <= 0) a.disabled = true;
        if (b.hp <= 0) b.disabled = true;
      }
    }
  }
  return impact;
}

// ---------------------------------------------------------------- peds

export function makePed(G, x, y) {
  return {
    x, y, angle: G.rng.range(0, Math.PI * 2),
    color: G.rng.pick(['#e74c3c', '#3498db', '#f1c40f', '#9b59b6', '#1abc9c', '#e67e22', '#ecf0f1', '#fd79a8']),
    skin: G.rng.pick(['#f1c27d', '#e0ac69', '#8d5524', '#ffdbac']),
    state: 'walk', hp: 30, target: null, waitT: G.rng.range(0, 2),
    fleeT: 0, downT: 0, name: G.rng.pick(['Marisol', 'Diego', 'Ana', 'Tomas', 'Lucia', 'Pablo', 'Rosa', 'Felix']),
  };
}

export function spawnPeds(G, count) {
  const peds = [];
  let guard = 0;
  while (peds.length < count && guard++ < 400) {
    const tx = G.rng.int(4, 90), ty = G.rng.int(3, 72);
    const x = tx * TILE + 24, y = ty * TILE + 24;
    if (isWaterPx(x, y)) continue;
    if (G.world.buildings.some((b) => x > b.x && x < b.x + b.w && y > b.y && y < b.y + b.h)) continue;
    peds.push(makePed(G, x, y));
  }
  return peds;
}

function pedStep(G, ped, dt, tx, ty, speed) {
  const want = Math.atan2(ty - ped.y, tx - ped.x);
  ped.angle += clamp(angleDelta(ped.angle, want), -6 * dt, 6 * dt);
  ped.x += Math.cos(ped.angle) * speed * dt;
  ped.y += Math.sin(ped.angle) * speed * dt;
  for (const b of G.world.buildings) {
    const [nx, ny] = resolveCircleRect(ped.x, ped.y, 9, b);
    ped.x = nx; ped.y = ny;
  }
  ped.x = clamp(ped.x, 10, G.world.w - 10);
  ped.y = clamp(ped.y, 10, G.world.h - 10);
}

export function updatePed(G, ped, dt) {
  if (ped.state === 'down') {
    ped.downT += dt;
    return;
  }
  // Danger sense: gunfire, a fast car close by, or the player sprinting at them.
  const danger = G.danger;
  if (danger && dist2(ped.x, ped.y, danger.x, danger.y) < 170 * 170) {
    ped.state = 'flee';
    ped.fleeT = 2.4;
  }
  if (ped.state === 'flee') {
    ped.fleeT -= dt;
    const from = danger ?? G.player;
    pedStep(G, ped, dt, ped.x + (ped.x - from.x), ped.y + (ped.y - from.y), 158);
    if (ped.fleeT <= 0) ped.state = 'walk';
    return;
  }
  if (ped.waitT > 0) {
    ped.waitT -= dt;
    return;
  }
  if (!ped.target || Math.hypot(ped.target.x - ped.x, ped.target.y - ped.y) < 14) {
    // Wander to a nearby pavement point.
    for (let tries = 0; tries < 8; tries++) {
      const tx = ped.x + G.rng.range(-260, 260), ty = ped.y + G.rng.range(-260, 260);
      if (tx < 8 || ty < 8 || tx > G.world.w - 8 || ty > G.world.h - 8) continue;
      if (isWaterPx(tx, ty)) continue;
      if (G.world.buildings.some((b) => tx > b.x - 6 && tx < b.x + b.w + 6 && ty > b.y - 6 && ty < b.y + b.h + 6)) continue;
      ped.target = { x: tx, y: ty };
      break;
    }
    if (!ped.target) ped.waitT = 0.5;
    return;
  }
  pedStep(G, ped, dt, ped.target.x, ped.target.y, 52);
  if (G.rng.chance(0.002)) ped.waitT = G.rng.range(0.4, 2.2);
}

// ---------------------------------------------------------------- pickups

export const PICKUP_SPOTS = [
  { kind: 'health', at: 'hospital' },
  { kind: 'armor', at: 'police' },
  { kind: 'cash', at: 'beachHouse' },
  { kind: 'cash', at: 'dockGate' },
  { kind: 'health', at: 'garage' },
  { kind: 'bribe', at: 'hotel' },
];

export function spawnPickups(G) {
  return PICKUP_SPOTS.map((s) => {
    const spot = G.world.spots[s.at];
    // Landmarks are building centres: step outward to the first spot that is
    // not inside a building, so every pickup can actually be reached.
    const offsets = [[0, 0], [52, 40], [-52, 40], [52, -40], [-52, -40], [0, 84], [0, -84], [92, 0], [-92, 0]];
    let x = spot.x, y = spot.y;
    for (const [ox, oy] of offsets) {
      const cx = spot.x + ox, cy = spot.y + oy;
      const inside = G.world.buildings.some(
        (b) => cx > b.x - 16 && cx < b.x + b.w + 16 && cy > b.y - 16 && cy < b.y + b.h + 16,
      );
      if (!inside) { x = cx; y = cy; break; }
    }
    return { kind: s.kind, x, y, active: true, respawnT: 0, phase: Math.random() * 6 };
  });
}

export function addPickup(G, kind, x, y) {
  G.pickups.push({ kind, x, y, active: true, respawnT: 0, phase: Math.random() * 6, temp: true });
}

export function updatePickups(G, dt) {
  for (const p of G.pickups) {
    if (!p.active) {
      p.respawnT -= dt;
      if (p.respawnT <= 0 && !p.temp) p.active = true;
      continue;
    }
    if (Math.hypot(G.player.x - p.x, G.player.y - p.y) < 30) {
      G.applyPickup(p.kind, p.x, p.y);
      p.active = false;
      p.respawnT = 26;
    }
  }
  G.pickups = G.pickups.filter((p) => p.active || !p.temp);
}

// ---------------------------------------------------------------- effects

export function burst(G, x, y, kind, n, spread = 90) {
  const colors = {
    dust: ['#cbb28c', '#c9b18c', '#b39b72'],
    spark: ['#ffd76a', '#ff9d3c', '#fff3b0'],
    smoke: ['#55565c', '#6d6e75', '#43444a'],
    splash: ['#bfe8ff', '#7fc4e8', '#e6f7ff'],
    puff: ['#d8d3c3', '#efe9da'],
  }[kind] ?? ['#ffffff'];
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = Math.random() * spread;
    G.particles.push({
      x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
      life: 0, max: 0.35 + Math.random() * 0.6,
      size: 2 + Math.random() * (kind === 'smoke' ? 7 : 3.5),
      color: colors[Math.floor(Math.random() * colors.length)],
      grow: kind === 'smoke' || kind === 'dust',
    });
  }
}

export function addSkid(G, x1, y1, x2, y2) {
  G.skids.push({ x1, y1, x2, y2, life: 7 });
  if (G.skids.length > 420) G.skids.splice(0, G.skids.length - 420);
}

export function addFloater(G, x, y, text, color = '#ffe66d') {
  G.floaters.push({ x, y, text, color, life: 0 });
}

export function updateEffects(G, dt) {
  for (const p of G.particles) {
    p.life += dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= 0.92; p.vy *= 0.92;
  }
  G.particles = G.particles.filter((p) => p.life < p.max);
  for (const s of G.skids) s.life -= dt;
  G.skids = G.skids.filter((s) => s.life > 0);
  for (const f of G.floaters) {
    f.life += dt;
    f.y -= 34 * dt;
  }
  G.floaters = G.floaters.filter((f) => f.life < 1.4);
}
