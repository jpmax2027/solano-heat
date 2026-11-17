// Port Solano, the city itself: a road grid, city blocks full of buildings,
// sidewalks, palms, lamps, crates, a beach strip in the south and the docks
// in the east. Built once from the seeded RNG, then read-only. Collision
// helpers live here too, so world and render agree on what is solid.
import { BEACH, DOCKS, PALETTE, ROADS, WORLD } from './config.js';
import { pick, randInt } from './random.js';

const HALF_ROAD = ROADS.width / 2;

function onRoadAxis(value, lines) {
  for (const line of lines) if (Math.abs(value - line) <= HALF_ROAD) return line;
  return null;
}

/** True when the point is on any road (roads are the only drivable surface). */
export function isOnRoad(x, y) {
  return onRoadAxis(x, ROADS.vertical) !== null || onRoadAxis(y, ROADS.horizontal) !== null;
}

/** The centreline of the nearest road to a point, and which way it runs. */
export function nearestRoad(x, y) {
  let best = null;
  let bestDist = Infinity;
  for (const line of ROADS.vertical) {
    const d = Math.abs(x - line);
    if (d < bestDist) { bestDist = d; best = { axis: 'v', line, dist: d }; }
  }
  for (const line of ROADS.horizontal) {
    const d = Math.abs(y - line);
    if (d < bestDist) { bestDist = d; best = { axis: 'h', line, dist: d }; }
  }
  return best;
}

export function createCity(random) {
  const buildings = [];
  const palms = [];
  const lamps = [];
  const crates = [];
  const hydrants = [];

  // One building (or a small cluster) per city block, between the roads.
  for (let vi = 0; vi < ROADS.vertical.length - 1; vi += 1) {
    for (let hi = 0; hi < ROADS.horizontal.length - 1; hi += 1) {
      const x0 = ROADS.vertical[vi] + HALF_ROAD + 14;
      const x1 = ROADS.vertical[vi + 1] - HALF_ROAD - 14;
      const y0 = ROADS.horizontal[hi] + HALF_ROAD + 14;
      const y1 = ROADS.horizontal[hi + 1] - HALF_ROAD - 14;
      if (y0 > BEACH.sandTop - 40) continue; // beach blocks stay open
      if (x0 > DOCKS.x0 - 60) continue; // docks stay open
      // The central plaza: one open block with a fountain square downtown.
      if (vi === 3 && hi === 2) {
        palms.push({ x: (x0 + x1) / 2, y: (y0 + y1) / 2, big: true });
        continue;
      }
      const n = 1 + Math.floor(random() * 3);
      for (let b = 0; b < n; b += 1) {
        const w = 70 + random() * 110;
        const h = 60 + random() * 90;
        const x = x0 + random() * Math.max(1, x1 - x0 - w);
        const y = y0 + random() * Math.max(1, y1 - y0 - h);
        buildings.push({
          x, y, w, h,
          roof: pick(random, PALETTE.buildingRoof),
          wall: pick(random, PALETTE.buildingWall),
          floors: 1 + randInt(random, 0, 3),
          lit: random() < 0.6,
        });
      }
      // Street props around the block.
      const propCount = randInt(random, 2, 6);
      for (let p = 0; p < propCount; p += 1) {
        const px = x0 + random() * (x1 - x0);
        const py = y0 + random() * (y1 - y0);
        const roll = random();
        if (roll < 0.45) palms.push({ x: px, y: py, big: false });
        else if (roll < 0.7) crates.push({ x: px, y: py, s: 14 + random() * 10 });
        else hydrants.push({ x: px, y: py });
      }
    }
  }

  // Lamps along every road, alternating sides.
  for (const line of ROADS.vertical) {
    for (const y of ROADS.horizontal) {
      lamps.push({ x: line + HALF_ROAD + 6, y: y + HALF_ROAD + 6 });
      lamps.push({ x: line - HALF_ROAD - 6, y: y - HALF_ROAD - 6 });
    }
  }
  for (const line of ROADS.horizontal) {
    for (const x of ROADS.vertical) {
      lamps.push({ x: x + HALF_ROAD + 6, y: line - HALF_ROAD - 6 });
    }
  }

  // Palms along the beach promenade and the docks.
  for (let x = 160; x < WORLD.width - 200; x += 130) {
    palms.push({ x: x + random() * 40, y: BEACH.sandTop - 24 - random() * 30, big: random() < 0.3 });
  }
  for (let y = DOCKS.y0 + 80; y < DOCKS.y1; y += 150) {
    crates.push({ x: DOCKS.x0 + 60 + random() * 120, y, s: 20 + random() * 14 });
  }

  // Named places the missions and the story use.
  const places = {
    spawn: { x: 1020, y: 620 }, // Rio starts downtown, on foot
    garage: { x: 620, y: 1020 }, // "Marco's Garage" — mission 2 drop-off
    packageSpot: { x: 2980, y: 1420 }, // docks pickup — mission 1
    hospital: { x: 2220, y: 220 }, // respawn after WASTED
    policeStation: { x: 220, y: 1820 }, // respawn after BUSTED
    dockRun: { x: 3080, y: 1750 }, // final run — mission 4
    hideout: { x: 2620, y: 220 }, // crew safehouse
    beach: { x: 1420, y: 2240 },
  };

  const city = { buildings, palms, lamps, crates, hydrants, places };

  /** Circle (x, y, r) against every building rect; returns the building or null. */
  city.collidesBuilding = function collidesBuilding(x, y, r) {
    for (const b of buildings) {
      if (x + r > b.x && x - r < b.x + b.w && y + r > b.y && y - r < b.y + b.h) return b;
    }
    return null;
  };

  /** Push a circle out of buildings and the map edge; returns true if it hit something. */
  city.resolveCollision = function resolveCollision(entity, r) {
    let hit = false;
    const b = city.collidesBuilding(entity.x, entity.y, r);
    if (b) {
      const dxLeft = entity.x + r - b.x;
      const dxRight = b.x + b.w - (entity.x - r);
      const dyTop = entity.y + r - b.y;
      const dyBottom = b.y + b.h - (entity.y - r);
      const m = Math.min(dxLeft, dxRight, dyTop, dyBottom);
      if (m === dxLeft) entity.x = b.x - r;
      else if (m === dxRight) entity.x = b.x + b.w + r;
      else if (m === dyTop) entity.y = b.y - r;
      else entity.y = b.y + b.h + r;
      hit = true;
    }
    const minX = 24 + r;
    const minY = 24 + r;
    const maxX = WORLD.width - 24 - r;
    const maxY = WORLD.height - 24 - r;
    if (entity.x < minX) { entity.x = minX; hit = true; }
    if (entity.x > maxX) { entity.x = maxX; hit = true; }
    if (entity.y < minY) { entity.y = minY; hit = true; }
    if (entity.y > maxY) { entity.y = maxY; hit = true; }
    return hit;
  };

  /** A random point on a sidewalk (just off a road), for pedestrians. */
  city.randomSidewalkPoint = function randomSidewalkPoint() {
    if (random() < 0.5) {
      const line = pick(random, ROADS.vertical);
      const y = 60 + random() * (BEACH.sandTop - 120);
      return { x: line + (random() < 0.5 ? -1 : 1) * (HALF_ROAD + 12), y };
    }
    const line = pick(random, ROADS.horizontal);
    const x = 60 + random() * (DOCKS.x0 - 120);
    return { x, y: line + (random() < 0.5 ? -1 : 1) * (HALF_ROAD + 12) };
  };

  /** A random point on a road, for traffic spawns. */
  city.randomRoadPoint = function randomRoadPoint() {
    if (random() < 0.5) {
      return { x: pick(random, ROADS.vertical), y: 80 + random() * (BEACH.sandTop - 160), axis: 'v' };
    }
    return { x: 80 + random() * (DOCKS.x0 - 160), y: pick(random, ROADS.horizontal), axis: 'h' };
  };

  return city;
}
