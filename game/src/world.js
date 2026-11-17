// SOLANO HEAT — the game's rules and state, with no drawing and no browser
// in it: the player on foot and behind the wheel, traffic, pedestrians,
// police, the wanted system, combat, pickups and the four-mission story.
// step() advances one fixed step and returns what happened as bit flags,
// so the caller can react (sounds, screens) without the world knowing
// about screens or sound. Nothing here allocates after createWorld returns.
import {
  BEACH, CAR, CAR_COLORS, CAR_NAMES, DOCKS, PALETTE, PARKED_COUNT,
  PED, PLAYER, PICKUP, POLICE, ROADS, STEP, TRAFFIC_COUNT, VIEW, WANTED, WORLD,
} from './config.js';
import { isOnRoad, nearestRoad } from './city.js';
import { MISSION_DEFS, STORY_COMPLETE } from './missions.js';
import { pick, randInt } from './random.js';

export const EVENT_SHOT = 1;
export const EVENT_CRASH = 2;
export const EVENT_PICKUP = 4;
export const EVENT_PUNCH = 8;
export const EVENT_MISSION = 16;
export const EVENT_BUSTED = 32;
export const EVENT_WASTED = 64;
export const EVENT_STORY = 128;
export const EVENT_HIT = 256;
export const EVENT_PHONE = 512;
export const EVENT_CASH = 1024;

const TWO_PI = Math.PI * 2;

function clamp(value, min, max) {
  return value < min ? min : value > max ? max : value;
}

function dist(ax, ay, bx, by) {
  return Math.hypot(ax - bx, ay - by);
}

function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= TWO_PI;
  while (d < -Math.PI) d += TWO_PI;
  return d;
}

function angleLerp(a, b, t) {
  return a + angleDiff(b, a) * t;
}

export function createWorld(random, city) {
  const places = city.places;
  let carId = 0;

  const player = {
    x: places.spawn.x, y: places.spawn.y, angle: -Math.PI / 2,
    vx: 0, vy: 0, health: PLAYER.health, armor: PLAYER.armor,
    cash: PLAYER.startCash, ammo: PLAYER.startAmmo, weapon: 'pistol',
    inCar: null, fireCooldown: 0, punchCooldown: 0, invulnerable: 0,
    heat: 0, crimeTimer: 0, bustTimer: 0, speed: 0,
  };

  const cars = [];
  const peds = [];
  const bullets = [];
  const particles = [];
  const floats = [];
  const skids = [];
  const pickups = [
    { x: places.hospital.x + 60, y: places.hospital.y, kind: 'health', active: true, respawn: 0 },
    { x: places.policeStation.x + 60, y: places.policeStation.y, kind: 'armor', active: true, respawn: 0 },
    { x: 1220, y: 820, kind: 'cash', active: true, respawn: 0 },
    { x: places.beach.x, y: places.beach.y - 60, kind: 'cash', active: true, respawn: 0 },
    { x: places.hideout.x, y: places.hideout.y + 60, kind: 'health', active: true, respawn: 0 },
  ];

  const mission = {
    index: 0, timer: 0, stage: 0, gangLeft: 0,
    message: '', messageTimer: 0, storyComplete: false, active: false,
  };

  const camera = { x: 0, y: 0 };
  const state = {
    player, cars, peds, bullets, particles, floats, skids, pickups, mission,
    camera, time: 0, shake: 0, stats: { carsStolen: 0, pedsHit: 0, shotsFired: 0, missionsDone: 0 },
  };

  function stars() {
    return Math.min(WANTED.maxStars, Math.floor(player.heat / WANTED.starHeat));
  }

  function addFloat(x, y, text, color) {
    if (floats.length > 14) floats.shift();
    floats.push({ x, y, text, life: 1.6, color });
  }

  function addParticles(x, y, count, color, speed, life) {
    for (let i = 0; i < count; i += 1) {
      if (particles.length > 320) particles.shift();
      const a = random() * TWO_PI;
      const s = speed * (0.4 + random() * 0.8);
      particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: life * (0.5 + random()), maxLife: life, color, size: 2 + random() * 3 });
    }
  }

  function addCrime(heat) {
    player.heat = Math.min(WANTED.maxStars * WANTED.starHeat, player.heat + heat);
    player.crimeTimer = 6;
  }

  function damagePlayer(amount) {
    if (player.invulnerable > 0) return;
    let rest = amount;
    if (player.armor > 0) {
      const absorbed = Math.min(player.armor, rest);
      player.armor -= absorbed;
      rest -= absorbed;
    }
    player.health -= rest;
    player.invulnerable = 0.35;
    state.shake = Math.max(state.shake, 6);
    if (player.health <= 0) player.health = 0;
  }

  function makeCar(kind, x, y, angle) {
    const car = {
      id: carId += 1, kind, x, y, angle, speed: 0, vx: 0, vy: 0,
      color: kind === 'police' ? PALETTE.copCar : pick(random, CAR_COLORS),
      name: pick(random, CAR_NAMES),
      parked: kind === 'parked', driven: false, hp: 100,
      axis: 'h', dir: 1, line: y, yieldTimer: 0, turnCooldown: 0, honk: 0,
    };
    cars.push(car);
    return car;
  }

  function spawnTrafficCar() {
    const p = city.randomRoadPoint();
    const car = makeCar('traffic', p.x, p.y, 0);
    car.axis = p.axis;
    car.dir = random() < 0.5 ? 1 : -1;
    if (p.axis === 'v') {
      car.line = p.x;
      car.x = p.x + (car.dir > 0 ? 20 : -20);
      car.angle = car.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
    } else {
      car.line = p.y;
      car.y = p.y + (car.dir > 0 ? 20 : -20);
      car.angle = car.dir > 0 ? 0 : Math.PI;
    }
    car.speed = CAR.trafficSpeed * (0.8 + random() * 0.4);
    return car;
  }

  function spawnParkedCar() {
    const vertical = random() < 0.5;
    let x;
    let y;
    let angle;
    if (vertical) {
      const line = pick(random, ROADS.vertical);
      x = line + (random() < 0.5 ? 1 : -1) * (ROADS.width / 2 + 18);
      y = 120 + random() * (BEACH.sandTop - 240);
      angle = random() < 0.5 ? Math.PI / 2 : -Math.PI / 2;
    } else {
      const line = pick(random, ROADS.horizontal);
      x = 120 + random() * (DOCKS.x0 - 240);
      y = line + (random() < 0.5 ? 1 : -1) * (ROADS.width / 2 + 18);
      angle = random() < 0.5 ? 0 : Math.PI;
    }
    const car = makeCar('parked', x, y, angle);
    car.speed = 0;
    return car;
  }

  function spawnPed(kind, x, y) {
    const p = { x, y, angle: random() * TWO_PI, tx: x, ty: y, kind, speed: 0, health: kind === 'gang' ? 50 : 100, flee: 0, fleeX: 0, fleeY: 0, shootCooldown: 1 + random(), shirt: kind === 'gang' ? PALETTE.gang : pick(random, PALETTE.pedShirt) };
    const target = city.randomSidewalkPoint();
    p.tx = target.x;
    p.ty = target.y;
    peds.push(p);
    return p;
  }

  function spawnCopCar() {
    // Appear on a road a little way off, so the player sees them arrive.
    const a = random() * TWO_PI;
    let x = player.x + Math.cos(a) * POLICE.spawnDistance;
    let y = player.y + Math.sin(a) * POLICE.spawnDistance;
    x = clamp(x, 80, WORLD.width - 80);
    y = clamp(y, 80, BEACH.sandTop - 80);
    const road = nearestRoad(x, y);
    if (road) {
      if (road.axis === 'v') x = road.line;
      else y = road.line;
    }
    const car = makeCar('police', x, y, 0);
    car.speed = CAR.policeSpeed * 0.6;
    return car;
  }

  function reset() {
    player.x = places.spawn.x;
    player.y = places.spawn.y;
    player.angle = -Math.PI / 2;
    player.vx = 0;
    player.vy = 0;
    player.health = PLAYER.health;
    player.armor = PLAYER.armor;
    player.cash = PLAYER.startCash;
    player.ammo = PLAYER.startAmmo;
    player.inCar = null;
    player.heat = 0;
    player.crimeTimer = 0;
    player.bustTimer = 0;
    cars.length = 0;
    peds.length = 0;
    bullets.length = 0;
    particles.length = 0;
    floats.length = 0;
    skids.length = 0;
    carId = 0;
    for (const pk of pickups) { pk.active = true; pk.respawn = 0; }
    for (let i = 0; i < TRAFFIC_COUNT; i += 1) spawnTrafficCar();
    for (let i = 0; i < PARKED_COUNT; i += 1) spawnParkedCar();
    for (let i = 0; i < PED.count; i += 1) {
      const p = city.randomSidewalkPoint();
      spawnPed('civil', p.x, p.y);
    }
    mission.index = 0;
    mission.timer = 0;
    mission.stage = 0;
    mission.gangLeft = 0;
    mission.storyComplete = false;
    mission.active = false;
    mission.message = '';
    mission.messageTimer = 0;
    state.time = 0;
    state.shake = 0;
    state.stats.carsStolen = 0;
    state.stats.pedsHit = 0;
    state.stats.shotsFired = 0;
    state.stats.missionsDone = 0;
    startMission(0);
  }

  function startMission(index) {
    const def = MISSION_DEFS[index];
    if (!def) return;
    mission.index = index;
    mission.stage = 0;
    mission.timer = def.timer;
    mission.active = true;
    mission.message = `${def.title} — ${def.brief}`;
    mission.messageTimer = 7;
    if (def.heat > 0) player.heat = def.heat * WANTED.starHeat;
    if (def.id === 'dockrun') {
      // The Vipers hold the pier: three armed gang members.
      for (let i = 0; i < 3; i += 1) {
        const gx = places.dockRun.x - 120 + i * 90 + random() * 30;
        const gy = places.dockRun.y - 60 + (random() - 0.5) * 120;
        spawnPed('gang', gx, gy);
      }
      mission.gangLeft = 3;
    }
  }

  function completeMission() {
    const def = MISSION_DEFS[mission.index];
    player.cash += def.reward;
    state.stats.missionsDone += 1;
    addFloat(player.x, player.y - 30, `+$${def.reward}`, PALETTE.cash);
    mission.active = false;
    mission.message = `MISSION COMPLETE — $${def.reward} banked.`;
    mission.messageTimer = 5;
    const next = mission.index + 1;
    if (next >= MISSION_DEFS.length) {
      mission.storyComplete = true;
      mission.message = STORY_COMPLETE;
      mission.messageTimer = 9;
      return EVENT_MISSION | EVENT_STORY;
    }
    startMission(next);
    return EVENT_MISSION | EVENT_PHONE;
  }

  function failMission(reason) {
    mission.message = `MISSION FAILED — ${reason} Try again.`;
    mission.messageTimer = 5;
    mission.active = false;
    const index = mission.index;
    if (index === 2) player.heat = 0; // heat mission resets clean
    startMission(index);
    return EVENT_MISSION | EVENT_PHONE;
  }

  function missionTarget() {
    const def = MISSION_DEFS[mission.index];
    if (!def || !def.target) return null;
    return places[def.target];
  }

  function respawnAfter(kind) {
    const lost = Math.floor(player.cash * 0.2);
    player.cash -= lost;
    player.health = PLAYER.health;
    player.armor = Math.max(player.armor, 25);
    player.heat = 0;
    player.bustTimer = 0;
    if (player.inCar) {
      player.inCar.driven = false;
      player.inCar.parked = true;
      player.inCar.kind = 'parked';
      player.inCar = null;
    }
    const spot = kind === 'busted' ? places.policeStation : places.hospital;
    player.x = spot.x;
    player.y = spot.y;
    player.vx = 0;
    player.vy = 0;
    player.invulnerable = 2;
    // Remove the cops that caught him.
    for (let i = cars.length - 1; i >= 0; i -= 1) {
      if (cars[i].kind === 'police') cars.splice(i, 1);
    }
    mission.message = kind === 'busted'
      ? `BUSTED — The Solano PD took $${lost}. Back on the street.`
      : `WASTED — You woke up at Solano General. Hospital bill: $${lost}.`;
    mission.messageTimer = 6;
  }

  function nearestCar(maxDist, kinds) {
    let best = null;
    let bestDist = maxDist;
    for (const car of cars) {
      if (kinds && !kinds.includes(car.kind)) continue;
      const d = dist(player.x, player.y, car.x, car.y);
      if (d < bestDist) { bestDist = d; best = car; }
    }
    return best;
  }

  function enterCar() {
    const car = nearestCar(58, ['traffic', 'parked']);
    if (!car) return 0;
    car.driven = true;
    car.parked = false;
    car.kind = 'player';
    player.inCar = car;
    player.x = car.x;
    player.y = car.y;
    player.angle = car.angle;
    state.stats.carsStolen += 1;
    addCrime(WANTED.steal);
    addFloat(car.x, car.y - 40, car.name, PALETTE.gold);
    // The driver, if there was one, runs for it.
    if (peds.length < 70) {
      const p = city.randomSidewalkPoint();
      spawnPed('civil', car.x + 30, car.y + 30);
      const driver = peds[peds.length - 1];
      driver.flee = 3;
      driver.fleeX = p.x;
      driver.fleeY = p.y;
    }
    return EVENT_PICKUP;
  }

  function exitCar() {
    const car = player.inCar;
    if (!car) return;
    const side = car.angle + Math.PI / 2;
    player.x = car.x + Math.cos(side) * 34;
    player.y = car.y + Math.sin(side) * 34;
    player.angle = car.angle;
    player.vx = 0;
    player.vy = 0;
    car.driven = false;
    car.parked = true;
    car.kind = 'parked';
    car.speed = 0;
    player.inCar = null;
    city.resolveCollision(player, PLAYER.radius);
  }

  function fireBullet() {
    if (player.ammo <= 0) return 0;
    player.ammo -= 1;
    player.fireCooldown = PLAYER.fireCooldown;
    state.stats.shotsFired += 1;
    const a = player.angle;
    const bx = player.x + Math.cos(a) * (player.inCar ? 30 : 18);
    const by = player.y + Math.sin(a) * (player.inCar ? 30 : 18);
    bullets.push({
      x: bx, y: by, vx: Math.cos(a) * PLAYER.bulletSpeed, vy: Math.sin(a) * PLAYER.bulletSpeed,
      life: PLAYER.bulletRange / PLAYER.bulletSpeed, from: 'player', damage: PLAYER.bulletDamage,
    });
    addParticles(bx, by, 5, PALETTE.muzzle, 180, 0.12);
    addCrime(WANTED.shoot * 0.2);
    return EVENT_SHOT;
  }

  function punch() {
    player.punchCooldown = PLAYER.punchCooldown;
    const a = player.angle;
    let hit = false;
    for (let i = peds.length - 1; i >= 0; i -= 1) {
      const ped = peds[i];
      const d = dist(player.x, player.y, ped.x, ped.y);
      if (d > PLAYER.punchRange + PED.radius) continue;
      const pa = Math.atan2(ped.y - player.y, ped.x - player.x);
      if (Math.abs(angleDiff(pa, a)) > 1.1) continue;
      ped.health -= PLAYER.punchDamage;
      if (ped.kind !== 'gang') {
        ped.flee = 4;
        ped.fleeX = player.x;
        ped.fleeY = player.y;
      }
      ped.x += Math.cos(pa) * 14;
      ped.y += Math.sin(pa) * 14;
      addParticles(ped.x, ped.y, 6, '#ffffff', 140, 0.25);
      addCrime(WANTED.hitPed);
      hit = true;
      if (ped.health <= 0) {
        addCrime(WANTED.kill);
        addFloat(ped.x, ped.y - 20, 'KO', PALETTE.red);
        peds.splice(i, 1);
        if (ped.kind === 'gang' && mission.index === 3) mission.gangLeft -= 1;
      }
      break;
    }
    return hit ? EVENT_PUNCH : EVENT_PUNCH;
  }

  function stepPlayer(dt, input) {
    if (player.fireCooldown > 0) player.fireCooldown -= dt;
    if (player.punchCooldown > 0) player.punchCooldown -= dt;
    if (player.invulnerable > 0) player.invulnerable -= dt;
    if (player.crimeTimer > 0) {
      player.crimeTimer -= dt;
    } else if (player.heat > 0 && !(mission.index === 2 && mission.active)) {
      // Heat cools slowly when the player stays out of trouble.
      player.heat = Math.max(0, player.heat - WANTED.decayPerSecond * dt);
    }

    if (player.inCar) {
      const car = player.inCar;
      const forward = input.moveY; // W = +1, S = -1
      const steer = input.moveX; // D = +1
      if (forward > 0) car.speed += CAR.accel * dt;
      else if (forward < 0) {
        car.speed -= (car.speed > 20 ? CAR.brake : CAR.reverseAccel) * dt;
      } else {
        car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 240 * dt);
      }
      car.speed = clamp(car.speed, -CAR.maxReverse, CAR.maxSpeed);
      const steerFactor = clamp(Math.abs(car.speed) / 180, 0, 1) * Math.sign(car.speed || 1);
      car.angle += steer * CAR.turnRate * steerFactor * dt;
      const fx = Math.cos(car.angle);
      const fy = Math.sin(car.angle);
      // Lateral velocity damps out (grip), which gives the drift feel at speed.
      const fwd = car.vx * fx + car.vy * fy;
      const latX = car.vx - fwd * fx;
      const latY = car.vy - fwd * fy;
      const damp = Math.exp(-CAR.grip * dt);
      car.vx = fwd * fx + latX * damp;
      car.vy = fwd * fy + latY * damp;
      car.vx += fx * (car.speed - fwd) * dt * 6;
      car.vy += fy * (car.speed - fwd) * dt * 6;
      car.x += car.vx * dt;
      car.y += car.vy * dt;
      const lateral = Math.abs(latX) + Math.abs(latY);
      if (lateral > 90 && Math.abs(car.speed) > 200) {
        if (skids.length > 220) skids.shift();
        skids.push({ x: car.x - fx * 22, y: car.y - fy * 22, a: car.angle, life: 5 });
        if (random() < 0.3) addParticles(car.x - fx * 26, car.y - fy * 26, 1, '#c9bda8', 40, 0.4);
      }
      const hitBuilding = city.resolveCollision(car, CAR.length / 2 - 4);
      if (hitBuilding && Math.abs(car.speed) > 120) {
        car.speed *= 0.35;
        state.shake = Math.max(state.shake, 8);
        addParticles(car.x + fx * 26, car.y + fy * 26, 10, '#ffb347', 200, 0.3);
        damagePlayer(6);
        return EVENT_CRASH;
      }
      if (car.y > BEACH.waterTop - 20) { car.y = BEACH.waterTop - 20; car.speed *= 0.5; }
      player.x = car.x;
      player.y = car.y;
      player.angle = car.angle;
      player.speed = Math.abs(car.speed);
      // Aim follows the mouse even while driving; firing from the car is allowed.
      player.angle = input.aimAngle !== undefined ? input.aimAngle : car.angle;
      if (input.fire && player.fireCooldown <= 0) return fireBullet();
      return 0;
    }

    // On foot: 8-direction movement, Shift to run.
    const speed = input.run ? PLAYER.runSpeed : PLAYER.walkSpeed;
    let mx = input.moveX;
    let my = input.moveY;
    const len = Math.hypot(mx, my);
    if (len > 1) { mx /= len; my /= len; }
    player.vx = mx * speed;
    player.vy = my * speed;
    player.x += player.vx * dt;
    player.y += player.vy * dt;
    if (len > 0.1) player.angle = Math.atan2(my, mx);
    player.speed = len > 0.1 ? speed : 0;
    if (player.y > BEACH.waterTop - 10) player.y = BEACH.waterTop - 10;
    city.resolveCollision(player, PLAYER.radius);
    if (input.aimAngle !== undefined) player.angle = input.aimAngle;
    let events = 0;
    if (input.enter) events |= enterCar();
    if (input.fire && player.fireCooldown <= 0) events |= fireBullet();
    if (input.punch && player.punchCooldown <= 0) events |= punch();
    return events;
  }

  function stepTraffic(dt) {
    for (const car of cars) {
      if (car.kind !== 'traffic') continue;
      if (car.yieldTimer > 0) {
        car.yieldTimer -= dt;
        continue;
      }
      // Car ahead on the same lane? Slow down.
      let blocked = false;
      for (const other of cars) {
        if (other === car || other.kind === 'parked') continue;
        const dx = other.x - car.x;
        const dy = other.y - car.y;
        const ahead = car.axis === 'v' ? (car.dir > 0 ? dy : -dy) : (car.dir > 0 ? dx : -dx);
        const side = car.axis === 'v' ? Math.abs(dx) : Math.abs(dy);
        if (ahead > 0 && ahead < 90 && side < 30) { blocked = true; break; }
      }
      const targetSpeed = blocked ? 0 : CAR.trafficSpeed;
      car.speed += clamp(targetSpeed - car.speed, -300 * dt, 200 * dt);
      car.turnCooldown -= dt;
      // At an intersection, sometimes turn onto the crossing road.
      if (car.turnCooldown <= 0) {
        const lines = car.axis === 'v' ? ROADS.horizontal : ROADS.vertical;
        for (const line of lines) {
          const pos = car.axis === 'v' ? car.y : car.x;
          if (Math.abs(pos - line) < 34 && random() < 0.35) {
            car.axis = car.axis === 'v' ? 'h' : 'v';
            car.dir = random() < 0.5 ? 1 : -1;
            car.line = line;
            car.turnCooldown = 4;
            break;
          }
        }
      }
      if (car.axis === 'v') {
        car.x = car.line + (car.dir > 0 ? 20 : -20);
        car.y += car.dir * car.speed * dt;
        car.angle = car.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
        if (car.y < 60) { car.dir = 1; }
        if (car.y > BEACH.sandTop - 60) { car.dir = -1; }
      } else {
        car.y = car.line + (car.dir > 0 ? 20 : -20);
        car.x += car.dir * car.speed * dt;
        car.angle = car.dir > 0 ? 0 : Math.PI;
        if (car.x < 60) { car.dir = 1; }
        if (car.x > DOCKS.x0 - 60) { car.dir = -1; }
      }
    }
  }

  function stepPolice(dt) {
    const want = stars();
    let cops = 0;
    for (const car of cars) if (car.kind === 'police') cops += 1;
    if (want > 0 && cops < Math.min(POLICE.maxCops, want + 1) && random() < dt * 0.8) spawnCopCar();
    if (want === 0) {
      // No heat: the cops give up and drive off.
      for (let i = cars.length - 1; i >= 0; i -= 1) {
        if (cars[i].kind === 'police') {
          const cop = cars[i];
          cop.x += Math.cos(cop.angle) * 300 * dt;
          cop.y += Math.sin(cop.angle) * 300 * dt;
          if (dist(cop.x, cop.y, player.x, player.y) > 1100) cars.splice(i, 1);
        }
      }
      player.bustTimer = 0;
      return 0;
    }
    let events = 0;
    let copClose = false;
    for (const cop of cars) {
      if (cop.kind !== 'police') continue;
      const d = dist(cop.x, cop.y, player.x, player.y);
      // Straight at the player, but a building in the way means detouring
      // around the block instead of ramming the wall forever.
      if (cop.detour === undefined) { cop.detour = 0; cop.detourDir = 1; }
      if (cop.detour > 0) cop.detour -= dt;
      const steerTo = cop.detour > 0
        ? Math.atan2(player.y - cop.y, player.x - cop.x) + cop.detourDir * 1.3
        : Math.atan2(player.y - cop.y, player.x - cop.x);
      const targetAngle = steerTo;
      const maxTurn = 2.4 * dt;
      cop.angle += clamp(angleDiff(targetAngle, cop.angle), -maxTurn, maxTurn);
      let speed = Math.min(CAR.policeSpeed + CAR.policeSpeedPerStar * want, 640);
      // Closing in on a player on foot: creep in slowly enough to actually catch him.
      if (!player.inCar && d < 170) speed = Math.min(speed, 135);
      cop.speed += clamp(speed - cop.speed, -400 * dt, 300 * dt);
      const ox = cop.x;
      const oy = cop.y;
      cop.x += Math.cos(cop.angle) * cop.speed * dt;
      cop.y += Math.sin(cop.angle) * cop.speed * dt;
      city.resolveCollision(cop, CAR.length / 2 - 4);
      const moved = dist(cop.x, cop.y, ox, oy);
      if (moved < Math.abs(cop.speed) * dt * 0.35 && cop.speed > 60) {
        cop.detour = 0.9;
        cop.detourDir = -cop.detourDir;
      }
      const dNow = dist(cop.x, cop.y, player.x, player.y);
      // Ram the player's car.
      if (player.inCar && dNow < 52) {
        const pc = player.inCar;
        pc.speed *= 0.7;
        cop.speed *= 0.6;
        state.shake = Math.max(state.shake, 7);
        addParticles(player.x, player.y, 8, '#ffb347', 180, 0.3);
        damagePlayer(CAR.ramDamage);
        events |= EVENT_CRASH;
      }
      // On foot, a cop car parked on top of the player busts him.
      // Noted once per step, not once per cop: with three cops, one close
      // and two far, per-cop decay would cancel the close one out.
      if (!player.inCar && dNow < POLICE.bustDistance && player.speed < 60) copClose = true;
    }
    if (!player.inCar) {
      if (copClose) {
        player.bustTimer += dt;
        if (player.bustTimer >= POLICE.bustSeconds) {
          const failedHeat = mission.index === 2 && mission.active;
          respawnAfter('busted');
          events |= EVENT_BUSTED;
          if (failedHeat) events |= failMission('Busted by the Solano PD.');
          return events;
        }
      } else {
        player.bustTimer = Math.max(0, player.bustTimer - dt * 2);
      }
    }
    return events;
  }

  function stepPeds(dt) {
    for (let i = peds.length - 1; i >= 0; i -= 1) {
      const ped = peds[i];
      if (ped.shootCooldown > 0) ped.shootCooldown -= dt;
      let targetX = ped.tx;
      let targetY = ped.ty;
      let speed = PED.walkSpeed;
      if (ped.flee > 0) {
        ped.flee -= dt;
        const a = Math.atan2(ped.y - ped.fleeY, ped.x - ped.fleeX);
        targetX = ped.x + Math.cos(a) * 100;
        targetY = ped.y + Math.sin(a) * 100;
        speed = PED.fleeSpeed;
      } else if (ped.kind === 'gang' && mission.index === 3 && mission.active) {
        // Vipers hold their ground and shoot at Rio.
        const d = dist(ped.x, ped.y, player.x, player.y);
        if (d < 460 && ped.shootCooldown <= 0) {
          ped.shootCooldown = 1.1 + random() * 0.6;
          const a = Math.atan2(player.y - ped.y, player.x - ped.x) + (random() - 0.5) * 0.25;
          bullets.push({
            x: ped.x, y: ped.y, vx: Math.cos(a) * 700, vy: Math.sin(a) * 700,
            life: 0.9, from: 'gang', damage: 9,
          });
          addParticles(ped.x, ped.y, 4, PALETTE.muzzle, 150, 0.1);
        }
        continue;
      }
      const dx = targetX - ped.x;
      const dy = targetY - ped.y;
      const d = Math.hypot(dx, dy);
      if (d < 12) {
        if (ped.flee <= 0) {
          const t = city.randomSidewalkPoint();
          ped.tx = t.x;
          ped.ty = t.y;
        }
        continue;
      }
      ped.angle = Math.atan2(dy, dx);
      ped.x += (dx / d) * speed * dt;
      ped.y += (dy / d) * speed * dt;
      if (ped.y > BEACH.sandTop - 12) ped.y = BEACH.sandTop - 12;
      city.resolveCollision(ped, PED.radius);
      // A reckless driver ploughs through pedestrians.
      if (player.inCar && player.speed > 240) {
        const pd = dist(ped.x, ped.y, player.x, player.y);
        if (pd < 30) {
          addCrime(WANTED.hitPed);
          state.stats.pedsHit += 1;
          addParticles(ped.x, ped.y, 10, '#ff5b5b', 220, 0.4);
          addFloat(ped.x, ped.y - 20, 'OUCH!', PALETTE.red);
          ped.flee = 5;
          ped.fleeX = player.x;
          ped.fleeY = player.y;
          ped.x += Math.cos(ped.angle) * 26;
          ped.y += Math.sin(ped.angle) * 26;
        }
      }
    }
  }

  function stepBullets(dt) {
    let events = 0;
    for (let i = bullets.length - 1; i >= 0; i -= 1) {
      const b = bullets[i];
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      let dead = b.life <= 0;
      if (!dead && city.collidesBuilding(b.x, b.y, 2)) {
        addParticles(b.x, b.y, 4, '#c9bda8', 120, 0.2);
        dead = true;
      }
      if (!dead && b.from === 'player') {
        for (let j = peds.length - 1; j >= 0; j -= 1) {
          const ped = peds[j];
          if (dist(b.x, b.y, ped.x, ped.y) < PED.radius + 4) {
            ped.health -= b.damage;
            if (ped.kind !== 'gang') {
              ped.flee = 4;
              ped.fleeX = player.x;
              ped.fleeY = player.y;
            }
            addParticles(ped.x, ped.y, 8, '#ff5b5b', 180, 0.3);
            addCrime(WANTED.hitPed);
            dead = true;
            events |= EVENT_HIT;
            if (ped.health <= 0) {
              addCrime(WANTED.kill);
              addFloat(ped.x, ped.y - 20, 'DOWN', PALETTE.red);
              peds.splice(j, 1);
              if (ped.kind === 'gang' && mission.index === 3) mission.gangLeft -= 1;
            }
            break;
          }
        }
      }
      if (!dead && b.from === 'gang') {
        if (dist(b.x, b.y, player.x, player.y) < PLAYER.radius + 4) {
          damagePlayer(b.damage);
          addParticles(player.x, player.y, 6, '#ff5b5b', 160, 0.25);
          dead = true;
          events |= EVENT_HIT;
        }
      }
      if (dead) bullets.splice(i, 1);
    }
    return events;
  }

  function stepCarCollisions(dt) {
    let events = 0;
    for (let i = 0; i < cars.length; i += 1) {
      for (let j = i + 1; j < cars.length; j += 1) {
        const a = cars[i];
        const b = cars[j];
        const d = dist(a.x, a.y, b.x, b.y);
        if (d >= 44 || d === 0) continue;
        const push = (44 - d) / 2;
        const nx = (b.x - a.x) / d;
        const ny = (b.y - a.y) / d;
        a.x -= nx * push;
        a.y -= ny * push;
        b.x += nx * push;
        b.y += ny * push;
        const relSpeed = Math.abs(a.speed - b.speed);
        if (relSpeed > 120) {
          a.speed *= 0.6;
          b.speed *= 0.6;
          addParticles((a.x + b.x) / 2, (a.y + b.y) / 2, 8, '#ffb347', 180, 0.3);
          if ((a.driven || b.driven) && relSpeed > 200) {
            state.shake = Math.max(state.shake, 6);
            damagePlayer(5);
            addCrime(WANTED.hitCar);
            events |= EVENT_CRASH;
          }
        }
      }
    }
    return events;
  }

  function stepPickups(dt) {
    let events = 0;
    for (const pk of pickups) {
      if (!pk.active) {
        pk.respawn -= dt;
        if (pk.respawn <= 0) pk.active = true;
        continue;
      }
      if (dist(player.x, player.y, pk.x, pk.y) < 34) {
        pk.active = false;
        pk.respawn = 22;
        if (pk.kind === 'health') {
          player.health = Math.min(PLAYER.health, player.health + PICKUP.health);
          addFloat(pk.x, pk.y - 24, `+${PICKUP.health} HP`, PALETTE.health);
        } else if (pk.kind === 'armor') {
          player.armor = Math.min(100, player.armor + PICKUP.armor);
          addFloat(pk.x, pk.y - 24, `+${PICKUP.armor} ARMOR`, PALETTE.armor);
        } else {
          player.cash += PICKUP.cash;
          addFloat(pk.x, pk.y - 24, `+$${PICKUP.cash}`, PALETTE.cash);
          events |= EVENT_CASH;
        }
        events |= EVENT_PICKUP;
      }
    }
    return events;
  }

  function stepMissions(dt) {
    if (!mission.active || mission.storyComplete) return 0;
    const def = MISSION_DEFS[mission.index];
    if (mission.timer > 0) {
      mission.timer -= dt;
      if (mission.timer <= 0) {
        if (mission.index === 1) return failMission('Out of time — the buyer walked.');
        if (mission.index === 2) return completeMission();
      }
    }
    const target = missionTarget();
    if (def.id === 'pickup' && target && dist(player.x, player.y, target.x, target.y) < 46) {
      return completeMission();
    }
    if (def.id === 'deliver' && target && player.inCar && dist(player.x, player.y, target.x, target.y) < 70) {
      return completeMission();
    }
    if (def.id === 'dockrun') {
      if (mission.stage === 0 && mission.gangLeft <= 0) {
        mission.stage = 1;
        mission.message = 'Vipers down. Get to the pier, Rio.';
        mission.messageTimer = 5;
        return EVENT_MISSION;
      }
      if (mission.stage === 1 && target && dist(player.x, player.y, target.x, target.y) < 60) {
        return completeMission();
      }
    }
    return 0;
  }

  function stepFx(dt) {
    for (let i = particles.length - 1; i >= 0; i -= 1) {
      const p = particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.98;
      p.vy *= 0.98;
      p.life -= dt;
      if (p.life <= 0) particles.splice(i, 1);
    }
    for (let i = floats.length - 1; i >= 0; i -= 1) {
      const f = floats[i];
      f.y -= 26 * dt;
      f.life -= dt;
      if (f.life <= 0) floats.splice(i, 1);
    }
    for (let i = skids.length - 1; i >= 0; i -= 1) {
      skids[i].life -= dt;
      if (skids[i].life <= 0) skids.splice(i, 1);
    }
    if (mission.messageTimer > 0) mission.messageTimer -= dt;
    if (state.shake > 0) state.shake = Math.max(0, state.shake - dt * 26);
  }

  function stepCamera() {
    const tx = clamp(player.x - VIEW.width / 2, 0, WORLD.width - VIEW.width);
    const ty = clamp(player.y - VIEW.height / 2, 0, WORLD.height - VIEW.height);
    camera.x += (tx - camera.x) * 0.12;
    camera.y += (ty - camera.y) * 0.12;
  }

  /**
   * One fixed step. `input` is { moveX, moveY, run, aimAngle, fire, punch, enter }.
   * Returns event bit flags for the caller (sound + screens).
   */
  function step(dt, input) {
    let events = 0;
    state.time += dt;
    events |= stepPlayer(dt, input);
    stepTraffic(dt);
    events |= stepPolice(dt);
    stepPeds(dt);
    events |= stepBullets(dt);
    events |= stepCarCollisions(dt);
    events |= stepPickups(dt);
    events |= stepMissions(dt);
    stepFx(dt);
    stepCamera();
    if (player.health <= 0) {
      respawnAfter('wasted');
      events |= EVENT_WASTED;
      if (mission.index === 2 && mission.active) events |= failMission('Wasted by the heat.');
    }
    return events;
  }

  reset();
  return {
    state, city, reset, step, stars, missionTarget,
    /** The current mission definition, or null once the story is done. */
    currentMission() {
      return mission.index < MISSION_DEFS.length ? MISSION_DEFS[mission.index] : null;
    },
    /** Restart the story at the given mission (used by load and by shot staging). */
    setMission(index) {
      mission.storyComplete = false;
      startMission(index);
    },
    /** Put the player behind the wheel of the nearest parked car to a point. */
    putPlayerInCar(x, y, angle) {
      let best = null;
      let bestDist = Infinity;
      for (const car of cars) {
        if (car.kind !== 'parked') continue;
        const d = dist(x, y, car.x, car.y);
        if (d < bestDist) { bestDist = d; best = car; }
      }
      if (!best) return null;
      best.x = x;
      best.y = y;
      best.angle = angle;
      best.speed = 0;
      best.vx = 0;
      best.vy = 0;
      best.driven = true;
      best.parked = false;
      best.kind = 'player';
      player.inCar = best;
      player.x = x;
      player.y = y;
      player.angle = angle;
      return best;
    },
    /** Drop the player on foot at a point (used by shot staging). */
    putPlayerOnFoot(x, y) {
      if (player.inCar) {
        player.inCar.driven = false;
        player.inCar.parked = true;
        player.inCar.kind = 'parked';
        player.inCar = null;
      }
      player.x = x;
      player.y = y;
      player.vx = 0;
      player.vy = 0;
    },
    setHeat(value) {
      player.heat = value;
    },
    spawnCops(count) {
      for (let i = 0; i < count; i += 1) spawnCopCar();
    },
    /** Extra pedestrians around a point, for busy street scenes. */
    crowd(x, y, count) {
      for (let i = 0; i < count; i += 1) {
        spawnPed('civil', x + (random() - 0.5) * 500, y + (random() - 0.5) * 300);
      }
    },
  };
}
