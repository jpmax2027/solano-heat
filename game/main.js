// SOLANO HEAT — the game itself: boot, the fixed-step loop, Rio on foot and
// behind the wheel, fists and pistol, the wanted system and its police,
// busted/wasted, the camera, and save/load. Rendering lives in render.js,
// behaviour of everyone else in entities.js, the story in missions.js.

import { STEP, SAVE_KEY, CAR_TYPES, TILE } from './config.js';
import { clamp, angleDelta, resolveCircleRect, dist2 } from './random.js';
import { buildWorld, classAtPx, isWaterPx } from './world.js';
import { attachInput, input, down, tapped, moveVector, endStep } from './input.js';
import {
  makeCar, spawnTraffic, spawnParked, spawnPeds, spawnCop, spawnPickups,
  updateTrafficCar, updateCopCar, updatePed, updatePickups, updateEffects,
  collideCarWorld, separateCars, burst, addSkid, addFloater, carRadius,
} from './entities.js';
import { createMissionState, updateMissions, MISSIONS } from './missions.js';
import {
  VIEW_W, VIEW_H, paletteAt, drawWorld, drawProps, drawBuildings, drawCar,
  drawPeds, drawPlayer, drawEffects, drawHUD, drawTitle, drawPause, drawEndScreen,
} from './render.js';
import * as audio from './audio.js';
import { stageShot } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const params = new URLSearchParams(location.search);
const shotName = params.get('shot');

function freshPlayer() {
  return {
    x: 2050, y: 1390, angle: -Math.PI / 2, vx: 0, vy: 0,
    hp: 100, armor: 0, cash: 250, weapon: 'fists', aim: 0,
    car: null, fireT: 0, hurtT: 0, calmT: 0,
  };
}

const G = {
  mode: shotName ? 'play' : 'title',
  time: 0,
  dayT: 0.40, // golden morning
  world: buildWorld(),
  rng: null, // set below
  player: freshPlayer(),
  cars: [], peds: [], pickups: [],
  particles: [], skids: [], floaters: [], tracers: [],
  dialog: [],
  wanted: { stars: 0, heat: 0, crimeT: 0, copT: 0 },
  bust: 0, endT: 0, endKind: null, endFee: 0,
  cam: { x: 0, y: 0, shake: 0 },
  danger: null, dangerT: 0,
  mission: createMissionState(),
  missionCar: null,
  objective: '', marker: null,
  hasSave: false, muted: false,
  shot: shotName,
};
G.rng = { // gameplay randomness: Math.random-backed, same shape as makeRng's
  next: () => Math.random(),
  range: (lo, hi) => lo + Math.random() * (hi - lo),
  int: (lo, hi) => Math.floor(lo + Math.random() * (hi - lo + 1)),
  pick: (arr) => arr[Math.floor(Math.random() * arr.length)],
  chance: (p) => Math.random() < p,
};

G.cars = [...spawnTraffic(G, 17), ...spawnParked(G)];
G.peds = spawnPeds(G, 26);
G.pickups = spawnPickups(G);

// ------------------------------------------------------------ G's helpers

G.say = (text) => {
  G.dialog.push({ text, t: 5.2 });
  if (G.dialog.length > 3) G.dialog.shift();
};
G.earn = (amount, x, y) => {
  G.player.cash += amount;
  addFloater(G, x, y, `+$${amount}`, '#69e58a');
  audio.sfx.cash();
};
G.sfxPhone = () => audio.sfx.phone();
G.sfxMission = () => audio.sfx.mission();
G.applyPickup = (kind, x, y) => {
  const p = G.player;
  if (kind === 'health') { p.hp = Math.min(100, p.hp + 40); addFloater(G, x, y - 14, '+HEALTH', '#ff8b96'); }
  if (kind === 'armor') { p.armor = Math.min(100, p.armor + 50); addFloater(G, x, y - 14, '+ARMOR', '#5bb8ff'); }
  if (kind === 'cash') { G.earn(G.rng.int(80, 240), x, y - 10); }
  if (kind === 'bribe') {
    G.wanted.heat = Math.max(0, G.wanted.stars - 1);
    addFloater(G, x, y - 14, 'BRIBED: -1 STAR', '#ffe66d');
  }
  audio.sfx.pickup();
};
G.addHeat = (n) => {
  const w = G.wanted;
  w.heat = clamp(w.heat + n, 0, 5.99);
  w.stars = Math.min(5, Math.floor(w.heat));
  w.crimeT = 0;
};
G.spawnMissionCar = (x, y) => {
  const car = makeCar(2, x, y, Math.PI / 2, null);
  car.color = '#ff2fb3';
  G.cars.push(car);
  G.missionCar = car;
};
G.retireCar = (car) => {
  if (G.player.car === car) exitCar();
  G.cars = G.cars.filter((c) => c !== car);
};
G.saveGame = () => {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      cash: G.player.cash, missionIndex: G.mission.index, done: G.mission.done,
      x: Math.round(G.player.x), y: Math.round(G.player.y),
    }));
  } catch { /* private mode: play on unsaved */ }
};

function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data.cash !== 'number') return null;
    return data;
  } catch {
    return null;
  }
}
G.hasSave = !!loadSave();

function applySave(data) {
  G.player.cash = data.cash;
  G.player.x = data.x; G.player.y = data.y;
  G.mission.index = data.missionIndex ?? 0;
  G.mission.done = !!data.done;
  G.mission.wait = 1.2;
}

// ------------------------------------------------------------ player

function enterCar(car) {
  const p = G.player;
  if (car.driver === 'traffic') {
    // The driver bails and runs; Port Solano calls that theft.
    const ped = G.peds[0];
    if (ped) { ped.x = car.x + 20; ped.y = car.y + 10; ped.state = 'flee'; ped.fleeT = 3; }
    if (!car.stolen) { car.stolen = true; G.addHeat(1); }
    G.say('DRIVER: Hey! That is my car!');
  } else if (car.driver === 'cop') {
    if (!car.stolen) { car.stolen = true; G.addHeat(1.5); }
  }
  car.driver = 'player';
  p.car = car;
  audio.sfx.door();
}

function exitCar() {
  const p = G.player;
  const car = p.car;
  if (!car) return;
  car.driver = null;
  const side = car.angle + Math.PI / 2;
  p.x = car.x + Math.cos(side) * 30;
  p.y = car.y + Math.sin(side) * 30;
  p.car = null;
  audio.sfx.door();
  audio.setEngine(null);
}

function nearestEnterableCar() {
  const p = G.player;
  let best = null, bd = 52 * 52;
  for (const car of G.cars) {
    if (car.disabled) continue;
    const d = dist2(p.x, p.y, car.x, car.y);
    if (d < bd) { bd = d; best = car; }
  }
  return best;
}

function updatePlayerOnFoot(dt) {
  const p = G.player;
  const mv = moveVector();
  const running = down('ShiftLeft') || down('ShiftRight');
  const speed = running ? 218 : 132;
  let mx = mv.x, my = mv.y;
  const len = Math.hypot(mx, my) || 1;
  if (mv.x || mv.y) {
    mx = (mx / len) * speed; my = (my / len) * speed;
    p.angle = Math.atan2(my, mx);
  } else { mx = 0; my = 0; }
  p.vx = mx; p.vy = my;

  let nx = p.x + mx * dt, ny = p.y + my * dt;
  // The sea is not walkable; piers are.
  if (!isWaterPx(nx, p.y)) p.x = nx;
  if (!isWaterPx(p.x, ny)) p.y = ny;
  for (const b of G.world.buildings) {
    const [cx, cy] = resolveCircleRect(p.x, p.y, 10, b);
    p.x = cx; p.y = cy;
  }
  for (const car of G.cars) {
    const rr = carRadius(car) + 9;
    const d2 = dist2(p.x, p.y, car.x, car.y);
    if (d2 < rr * rr && d2 > 0.01) {
      const d = Math.sqrt(d2);
      p.x = car.x + ((p.x - car.x) / d) * rr;
      p.y = car.y + ((p.y - car.y) / d) * rr;
    }
  }
  p.x = clamp(p.x, 12, G.world.w - 12);
  p.y = clamp(p.y, 12, G.world.h - 12);

  // Aim follows the mouse in world space.
  const wx = G.cam.x + input.mouseX, wy = G.cam.y + input.mouseY;
  p.aim = Math.atan2(wy - p.y, wx - p.x);
  if (p.weapon === 'pistol') p.angle = p.aim;

  if (tapped('Digit1')) p.weapon = 'fists';
  if (tapped('Digit2')) p.weapon = 'pistol';
  if (tapped('KeyE') || tapped('KeyF')) {
    const car = nearestEnterableCar();
    if (car) enterCar(car);
    return;
  }

  p.fireT -= dt;
  const wantFire = input.mouseDown || down('Space');
  if (wantFire && p.fireT <= 0) {
    if (p.weapon === 'pistol') firePistol();
    else throwPunch();
  }
}

function throwPunch() {
  const p = G.player;
  p.fireT = 0.34;
  audio.sfx.punch();
  const tx = p.x + Math.cos(p.aim) * 30, ty = p.y + Math.sin(p.aim) * 30;
  for (const ped of G.peds) {
    if (ped.state !== 'down' && Math.hypot(ped.x - tx, ped.y - ty) < 26) {
      ped.hp -= 16;
      ped.state = 'flee'; ped.fleeT = 2.6;
      burst(G, ped.x, ped.y - 4, 'puff', 5, 60);
      if (ped.hp <= 0) { ped.state = 'down'; ped.downT = 0; G.addHeat(1.2); }
      else G.addHeat(0.3);
      G.danger = { x: p.x, y: p.y }; G.dangerT = 1;
      break;
    }
  }
}

function firePistol() {
  const p = G.player;
  p.fireT = 0.23;
  audio.sfx.shot();
  G.danger = { x: p.x, y: p.y }; G.dangerT = 1.2;
  G.addHeat(0.35);
  const range = 540;
  let ex = p.x + Math.cos(p.aim) * range, ey = p.y + Math.sin(p.aim) * range;
  let bestT = 1;
  // Buildings stop the bullet.
  for (const b of G.world.buildings) {
    const t = rayRect(p.x, p.y, p.aim, b);
    if (t !== null && t < bestT) { bestT = t; }
  }
  ex = p.x + Math.cos(p.aim) * range * bestT;
  ey = p.y + Math.sin(p.aim) * range * bestT;
  // Peds and cars along the line.
  let hit = null, hitD = range * bestT;
  const probe = (o, r, kind) => {
    const dx = o.x - p.x, dy = o.y - p.y;
    const along = dx * Math.cos(p.aim) + dy * Math.sin(p.aim);
    const side = Math.abs(dx * -Math.sin(p.aim) + dy * Math.cos(p.aim));
    if (along > 8 && along < hitD && side < r) { hit = { o, kind }; hitD = along; }
  };
  for (const ped of G.peds) if (ped.state !== 'down') probe(ped, 11, 'ped');
  for (const car of G.cars) probe(car, carRadius(car), 'car');
  if (hit) {
    ex = p.x + Math.cos(p.aim) * hitD;
    ey = p.y + Math.sin(p.aim) * hitD;
    if (hit.kind === 'ped') {
      const ped = hit.o;
      ped.hp -= 34;
      burst(G, ped.x, ped.y - 4, 'puff', 6, 70);
      if (ped.hp <= 0) { ped.state = 'down'; ped.downT = 0; G.addHeat(1.4); }
      else { ped.state = 'flee'; ped.fleeT = 3; }
    } else {
      hit.o.hp -= 7;
      burst(G, ex, ey, 'spark', 6, 90);
      if (hit.o.hp <= 0 && !hit.o.disabled) {
        hit.o.disabled = true;
        burst(G, hit.o.x, hit.o.y, 'smoke', 12, 50);
      }
    }
  } else {
    burst(G, ex, ey, 'puff', 3, 40);
  }
  G.tracers.push({ x1: p.x + Math.cos(p.aim) * 14, y1: p.y + Math.sin(p.aim) * 14, x2: ex, y2: ey, life: 0.09 });
  burst(G, p.x + Math.cos(p.aim) * 16, p.y + Math.sin(p.aim) * 16, 'spark', 2, 30);
}

/** Ray vs rect: returns the fraction of the ray at entry, or null. */
function rayRect(x, y, angle, b) {
  const dx = Math.cos(angle), dy = Math.sin(angle);
  let tmin = 0, tmax = 1;
  const range = 540;
  const axes = [
    [dx, x, b.x, b.x + b.w],
    [dy, y, b.y, b.y + b.h],
  ];
  for (const [d, o, lo, hi] of axes) {
    if (Math.abs(d) < 1e-8) {
      if (o < lo || o > hi) return null;
    } else {
      let t1 = ((lo - o) / d) / range, t2 = ((hi - o) / d) / range;
      if (t1 > t2) [t1, t2] = [t2, t1];
      tmin = Math.max(tmin, t1);
      tmax = Math.min(tmax, t2);
      if (tmin > tmax) return null;
    }
  }
  return tmin > 0 ? tmin : null;
}

// ------------------------------------------------------------ driving

function updatePlayerDriving(dt) {
  const p = G.player;
  const car = p.car;
  const type = CAR_TYPES[car.type];
  const fwd = down('KeyW') || down('ArrowUp');
  const back = down('KeyS') || down('ArrowDown');
  const left = down('KeyA') || down('ArrowLeft');
  const right = down('KeyD') || down('ArrowRight');
  const hand = down('Space');

  const fx = Math.cos(car.angle), fy = Math.sin(car.angle);
  // Split velocity into forward and lateral parts; grip eats the lateral.
  let vf = car.vx * fx + car.vy * fy;
  let vl = car.vx * -fy + car.vy * fx;
  if (fwd) vf += type.accel * dt;
  if (back) vf -= (vf > 12 ? 380 : 130) * dt;
  vf = clamp(vf, -type.top * 0.36, type.top);
  if (!fwd && !back) vf -= vf * Math.min(1, 0.7 * dt) + Math.sign(vf) * Math.min(Math.abs(vf), 22 * dt);
  if (hand) vf -= vf * Math.min(1, 2.4 * dt);
  const grip = hand ? 1.6 : type.grip;
  vl -= vl * Math.min(1, grip * dt);

  const steer = (left ? -1 : 0) + (right ? 1 : 0);
  if (steer !== 0 && Math.abs(vf) > 4) {
    car.angle += steer * clamp(Math.abs(vf) / 130, 0.25, 1.15) * 1.85 * dt * Math.sign(vf);
  }
  const nfx = Math.cos(car.angle), nfy = Math.sin(car.angle);
  car.vx = nfx * vf - nfy * vl;
  car.vy = nfy * vf + nfx * vl;
  car.speed = vf;
  car.braking = back || hand;

  const px = car.x, py = car.y;
  car.x += car.vx * dt;
  car.y += car.vy * dt;
  const impact = collideCarWorld(G, car);
  if (impact > 150) {
    car.hp -= (impact - 140) * 0.09;
    hurtPlayer((impact - 150) * 0.02);
    G.cam.shake = Math.min(14, (impact - 140) * 0.05);
    audio.sfx.crash(impact > 260);
    burst(G, car.x, car.y, 'spark', 8, 120);
    if (impact > 210) G.addHeat(0.4);
  }
  // Sync the velocity back after any collision push.
  if (impact > 0) { car.vx *= 0.5; car.vy *= 0.5; }

  // Drift theatre: skid marks, dust, and a wandering danger radius.
  const slipping = Math.abs(vl) > 55 || (hand && Math.abs(vf) > 90);
  if (slipping) {
    const rx = car.x - nfx * type.l * 0.32, ry = car.y - nfy * type.l * 0.32;
    const sx = -nfy * type.w * 0.36, sy = nfx * type.w * 0.36;
    if (car.lastSkid) {
      addSkid(G, car.lastSkid.lx, car.lastSkid.ly, rx - sx, ry - sy);
      addSkid(G, car.lastSkid.rx, car.lastSkid.ry, rx + sx, ry + sy);
    }
    car.lastSkid = { lx: rx - sx, ly: ry - sy, rx: rx + sx, ry: ry + sy };
    if (Math.random() < 0.5) burst(G, rx, ry, 'dust', 1, 40);
  } else {
    car.lastSkid = null;
  }
  if (Math.abs(vf) > 265) { G.danger = { x: car.x, y: car.y }; G.dangerT = 0.4; }

  // Running someone down is the city's loudest crime.
  for (const ped of G.peds) {
    if (ped.state === 'down') continue;
    if (Math.abs(vf) > 60 && dist2(ped.x, ped.y, car.x, car.y) < (carRadius(car) + 8) ** 2) {
      ped.state = 'down'; ped.downT = 0; ped.hp = 0;
      burst(G, ped.x, ped.y, 'puff', 8, 80);
      G.addHeat(1.3);
      car.vx *= 0.82; car.vy *= 0.82;
      audio.sfx.crash(false);
      G.cam.shake = Math.max(G.cam.shake, 5);
    }
  }

  p.x = car.x; p.y = car.y;
  p.vx = car.vx; p.vy = car.vy;
  p.angle = car.angle;

  if (car.hp < 45 && Math.random() < dt * 6) burst(G, car.x + nfx * 18, car.y + nfy * 18, 'smoke', 1, 26);
  if (car.hp <= 0 && !car.disabled) {
    car.disabled = true;
    burst(G, car.x, car.y, 'smoke', 16, 60);
    G.say('RIO: This car is done. Find another!');
    exitCar();
  }

  audio.setEngine(clamp(Math.abs(vf) / type.top, 0, 1));
  audio.driveMusic(dt, Math.abs(vf) > 30);

  if (tapped('KeyE') || tapped('KeyF')) {
    exitCar();
  }
}

// ------------------------------------------------------------ wanted & harm

function hurtPlayer(amount) {
  const p = G.player;
  if (G.mode !== 'play' || amount <= 0) return;
  const absorbed = Math.min(p.armor, amount * 0.7);
  p.armor -= absorbed;
  p.hp -= amount - absorbed;
  p.calmT = 0;
  if (p.hp <= 0) {
    p.hp = 0;
    endRun('wasted');
  }
}

function endRun(kind) {
  const p = G.player;
  const fee = kind === 'busted'
    ? Math.min(p.cash, Math.max(150, Math.round(p.cash * 0.12)))
    : Math.min(p.cash, Math.max(100, Math.round(p.cash * 0.1)));
  p.cash -= fee;
  G.endKind = kind;
  G.endFee = fee;
  G.endT = 3;
  G.mode = kind;
  if (kind === 'busted') audio.sfx.bust();
  audio.setEngine(null);
}

function respawn() {
  const p = G.player;
  const spot = G.endKind === 'busted' ? G.world.spots.police : G.world.spots.hospital;
  if (p.car) exitCar();
  p.x = spot.x + 40; p.y = spot.y + 60;
  p.hp = 90; p.armor = 0;
  G.wanted.heat = 0; G.wanted.stars = 0;
  G.bust = 0;
  G.cars = G.cars.filter((c) => c.driver !== 'cop');
  G.mode = 'play';
  G.saveGame();
}

function updateWanted(dt) {
  const w = G.wanted;
  const p = G.player;
  w.crimeT += dt;
  // Decay only when no officer is close enough to keep eyes on Rio.
  let nearestCop = Infinity;
  for (const c of G.cars) {
    if (c.driver === 'cop') nearestCop = Math.min(nearestCop, Math.hypot(c.x - p.x, c.y - p.y));
  }
  if (w.stars > 0 && nearestCop > 380 && w.crimeT > 4) {
    w.heat = Math.max(0, w.heat - dt * 0.055);
    w.stars = Math.min(5, Math.floor(w.heat + 0.0001)) || (w.heat > 0 ? 1 : 0);
    if (w.heat <= 0) w.stars = 0;
  }
  // Spawn pressure.
  const wantCops = w.stars === 0 ? 0 : Math.min(2 + w.stars, 7);
  const cops = G.cars.filter((c) => c.driver === 'cop');
  w.copT -= dt;
  if (cops.length < wantCops && w.copT <= 0) {
    spawnCop(G);
    w.copT = 1.4;
  }
  if (w.stars === 0) {
    G.cars = G.cars.filter((c) => c.driver !== 'cop' || Math.hypot(c.x - p.x, c.y - p.y) < 950);
  }
  audio.setSiren(cops.length > 0 && nearestCop < 560, dt);

  // Bust pressure: an officer alongside a running Rio.
  if (!p.car && w.stars > 0 && nearestCop < 62) {
    const speed = Math.hypot(p.vx, p.vy);
    G.bust += dt * (speed > 170 ? 0.25 : 0.5);
    if (G.bust >= 1) {
      G.bust = 0;
      endRun('busted');
    }
  } else {
    G.bust = Math.max(0, G.bust - dt * 1.6);
  }
  // Cop rams hurt.
  for (const c of cops) {
    if (Math.abs(c.speed) > 200 && dist2(c.x, c.y, p.x, p.y) < 40 * 40 && !p.car) {
      hurtPlayer(9);
      G.cam.shake = Math.max(G.cam.shake, 6);
    }
  }
}

// ------------------------------------------------------------ the step

function step(dt) {
  G.time += dt;
  for (const line of G.dialog) line.t -= dt;
  G.dialog = G.dialog.filter((l) => l.t > 0);
  if (G.dangerT > 0) { G.dangerT -= dt; if (G.dangerT <= 0) G.danger = null; }
  for (const t of G.tracers) t.life -= dt;
  G.tracers = G.tracers.filter((t) => t.life > 0);

  if (G.mode === 'title') {
    // The city idles behind the title: traffic rolls, the camera drifts.
    for (const car of G.cars) if (car.driver === 'traffic') updateTrafficCar(G, car, dt);
    G.cam.x = clamp(G.cam.x + dt * 26, 0, G.world.w - VIEW_W);
    if (G.cam.x >= G.world.w - VIEW_W - 1) G.cam.x = 900;
    if (tapped('Enter')) startGame(false);
    if (tapped('KeyC') && G.hasSave) startGame(true);
    return;
  }
  if (G.mode === 'busted' || G.mode === 'wasted') {
    G.endT -= dt;
    if (G.endT <= 0) respawn();
    return;
  }
  if (G.mode === 'pause') {
    if (tapped('KeyP') || tapped('Escape')) G.mode = 'play';
    return;
  }

  // play
  G.dayT = (G.dayT + dt / 260) % 1;
  if (tapped('KeyP') || tapped('Escape')) { G.mode = 'pause'; return; }
  if (tapped('KeyM')) G.muted = audio.toggleMute();

  const p = G.player;
  p.calmT += dt;
  if (p.calmT > 9 && p.hp > 0 && p.hp < 100) p.hp = Math.min(100, p.hp + dt * 1.1);

  if (p.car) updatePlayerDriving(dt);
  else updatePlayerOnFoot(dt);

  for (const car of G.cars) {
    if (car.driver === 'traffic') {
      if (dist2(car.x, car.y, p.x, p.y) < 1600 * 1600) updateTrafficCar(G, car, dt);
    } else if (car.driver === 'cop') {
      updateCopCar(G, car, dt);
    } else if (car !== p.car) {
      car.speed = 0;
      car.vx *= 0.9; car.vy *= 0.9;
    }
    // A damaged parked car smoulders.
    if (car.hp < 40 && car.hp > 0 && Math.random() < dt * 2) {
      burst(G, car.x, car.y - 6, 'smoke', 1, 20);
    }
  }
  const impact = separateCars(G, dt);
  if (impact > 200 && p.car) {
    hurtPlayer((impact - 190) * 0.03);
    G.cam.shake = Math.max(G.cam.shake, 7);
    audio.sfx.crash(true);
  }
  for (const ped of G.peds) updatePed(G, ped, dt);
  // Keep the streets populated.
  G.peds = G.peds.filter((ped) => ped.state !== 'down' || ped.downT < 24);
  if (G.peds.length < 24 && Math.random() < dt * 0.5) {
    const fresh = spawnPeds(G, 1);
    if (fresh.length) G.peds.push(fresh[0]);
  }
  updatePickups(G, dt);
  updateMissions(G, dt);
  updateWanted(dt);
  updateEffects(G, dt);

  // Camera: follow with a velocity lean and crash shake.
  const lead = 0.32;
  const tx = clamp(p.x + (p.vx ?? 0) * lead - VIEW_W / 2, 0, G.world.w - VIEW_W);
  const ty = clamp(p.y + (p.vy ?? 0) * lead - VIEW_H / 2, 0, G.world.h - VIEW_H);
  G.cam.x += (tx - G.cam.x) * Math.min(1, dt * 5);
  G.cam.y += (ty - G.cam.y) * Math.min(1, dt * 5);
  G.cam.shake = Math.max(0, G.cam.shake - dt * 26);
}

function startGame(useSave) {
  audio.initAudio();
  if (useSave) {
    const data = loadSave();
    if (data) applySave(data);
  }
  G.mode = 'play';
  G.say('RICO: Welcome to Port Solano, Rio. Try not to die on day one.');
}

// ------------------------------------------------------------ render & loop

function render() {
  const { pal, dark } = paletteAt(G.dayT);
  const shX = G.cam.shake ? (Math.random() - 0.5) * G.cam.shake : 0;
  const shY = G.cam.shake ? (Math.random() - 0.5) * G.cam.shake : 0;
  ctx.save();
  ctx.translate(-Math.round(shX), -Math.round(shY));
  drawWorld(ctx, G, pal, dark);
  drawProps(ctx, G, dark);
  for (const car of G.cars) drawCar(ctx, G, car, dark);
  drawPeds(ctx, G);
  drawPlayer(ctx, G);
  drawBuildings(ctx, G, pal);
  drawEffects(ctx, G);
  ctx.restore();
  if (dark > 0.05) {
    ctx.fillStyle = `rgba(16,14,44,${(dark * 0.30).toFixed(3)})`;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  }
  if (G.mode === 'title') {
    drawTitle(ctx, G);
    return;
  }
  drawHUD(ctx, G);
  if (G.mode === 'pause') drawPause(ctx, G);
  if (G.mode === 'busted' || G.mode === 'wasted') drawEndScreen(ctx, G, G.mode, G.endFee);
}

attachInput(canvas);
if (shotName) {
  stageShot(G, shotName, params);
} else {
  // Open on downtown so the title backdrop is the living city.
  G.cam.x = clamp(G.player.x - VIEW_W / 2, 0, G.world.w - VIEW_W);
  G.cam.y = clamp(G.player.y - VIEW_H / 2, 0, G.world.h - VIEW_H);
}

let last = performance.now();
let acc = 0;
let frames = 0;
function frame(now) {
  requestAnimationFrame(frame);
  let elapsed = (now - last) / 1000;
  last = now;
  if (elapsed > 0.25) elapsed = 0.25;
  acc += elapsed;
  while (acc >= STEP) {
    step(STEP);
    endStep();
    acc -= STEP;
  }
  render();
  frames++;
  if (G.shot && frames === 10 && !window.__shotReady) {
    // The staged scene has been stepped and painted: hand it over.
    window.__shotReady = true;
    if (params.get('save') === '1') {
      canvas.toBlob((blob) => {
        if (!blob) return;
        fetch(`/__save/${G.shot}.jpg`, { method: 'POST', body: blob }).catch(() => {});
      }, 'image/jpeg', 0.82);
    }
  }
}
requestAnimationFrame(frame);
