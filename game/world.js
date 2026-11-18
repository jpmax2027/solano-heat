// SOLANO HEAT — Port Solano itself: the road plan from config.js turned into
// blocks, buildings, sidewalks, a beach, a dock quarter with piers over the
// water, props, parking spots and the traffic node graph. Generated from a
// fixed seed: the same city every load.

import {
  TILE, WORLD_COLS, WORLD_ROWS, WORLD_W, WORLD_H,
  AVENUES, STREETS, SAND_X, WATER_X, DOCK,
} from './config.js';
import { makeRng } from './random.js';

export const tileToPx = (t) => t * TILE + TILE / 2;

export function isRoadTile(tx, ty) {
  if (AVENUES.some((a) => Math.abs(tx - a) <= 1)) return true;
  if (STREETS.some((s) => Math.abs(ty - s) <= 1)) return true;
  return false;
}

export function isPierPx(x, y) {
  for (const row of DOCK.piers) {
    const px = WATER_X * TILE, py = row * TILE;
    if (x >= px && x <= px + 7 * TILE && y >= py && y <= py + 2 * TILE) return true;
  }
  return false;
}

export function tileClass(tx, ty) {
  if (tx >= WATER_X) return isPierPx(tx * TILE + 1, ty * TILE + 1) ? 'pier' : 'water';
  if (tx >= SAND_X) return 'sand';
  if (tx >= DOCK.x0 && tx <= DOCK.x1 && ty >= DOCK.y0 && ty <= DOCK.y1) return 'dock';
  if (isRoadTile(tx, ty)) return 'road';
  // Sidewalk: a non-road tile touching a road tile.
  if (isRoadTile(tx + 1, ty) || isRoadTile(tx - 1, ty) || isRoadTile(tx, ty + 1) || isRoadTile(tx, ty - 1)) {
    return 'sidewalk';
  }
  return 'grass';
}

export function classAtPx(x, y) {
  return tileClass(Math.floor(x / TILE), Math.floor(y / TILE));
}

export function isWaterPx(x, y) {
  return classAtPx(x, y) === 'water';
}

/** Cars may drive on roads, the dock apron and the piers. */
export function isDrivablePx(x, y) {
  const c = classAtPx(x, y);
  return c === 'road' || c === 'dock' || c === 'pier';
}

function buildBuildings(rng) {
  const buildings = [];
  const kinds = ['office', 'shop', 'house', 'hotel', 'office', 'shop'];
  for (let i = 0; i < AVENUES.length - 1; i++) {
    for (let j = 0; j < STREETS.length; j++) {
      const x0 = AVENUES[i] + 2, x1 = AVENUES[i + 1] - 2;
      const y0 = (j === 0 ? 2 : STREETS[j - 1] + 2);
      const y1 = STREETS[j] - 2;
      if (x1 - x0 < 3 || y1 - y0 < 3) continue;
      // The dock quarter and the beach stay clear of the block builder.
      if (x0 >= DOCK.x0 - 2 && y0 >= DOCK.y0 - 2) continue;
      if (x0 >= SAND_X - 4) continue;
      const bw = (x1 - x0 + 1) * TILE, bh = (y1 - y0 + 1) * TILE;
      const split = rng.chance(0.55) && bw > 340;
      const lots = split
        ? [
            { x: x0 * TILE + 10, y: y0 * TILE + 10, w: bw / 2 - 26, h: bh - 20 },
            { x: x0 * TILE + bw / 2 + 16, y: y0 * TILE + 10, w: bw / 2 - 26, h: bh - 20 },
          ]
        : [{ x: x0 * TILE + 12, y: y0 * TILE + 12, w: bw - 24, h: bh - 24 }];
      for (const lot of lots) {
        buildings.push({
          ...lot,
          kind: rng.pick(kinds),
          tone: rng.next(),
          floors: rng.int(2, 9),
          label: null,
        });
      }
    }
  }
  // Landmarks the story uses, tagged so the renderer can sign them.
  const tag = (tx, ty, label, kind) => {
    const b = buildings.reduce((best, cur) => {
      const d = Math.abs(cur.x + cur.w / 2 - tileToPx(tx)) + Math.abs(cur.y + cur.h / 2 - tileToPx(ty));
      const bd = Math.abs(best.x + best.w / 2 - tileToPx(tx)) + Math.abs(best.y + best.h / 2 - tileToPx(ty));
      return d < bd ? cur : best;
    });
    b.label = label;
    if (kind) b.kind = kind;
    return { x: b.x + b.w / 2, y: b.y + b.h / 2 };
  };
  const spots = {
    police: tag(31, 40, 'POLICE', 'civic'),
    hospital: tag(55, 16, 'HOSPITAL', 'civic'),
    hotel: tag(77, 49, 'HOTEL BRISA', 'hotel'),
    beachHouse: tag(85, 30, 'CASA AZUL', 'house'),
    garage: tag(43, 57, 'TALLER SOLANO', 'shop'),
  };
  // Two dock warehouses, drawn as buildings on the apron.
  buildings.push(
    { x: 83 * TILE, y: 65 * TILE, w: 5 * TILE, h: 3 * TILE, kind: 'warehouse', tone: 0.3, floors: 1, label: 'CHOP SHOP' },
    { x: 89 * TILE, y: 70 * TILE, w: 5 * TILE, h: 3 * TILE, kind: 'warehouse', tone: 0.7, floors: 1, label: 'MUELLE 9' },
  );
  spots.chopShop = { x: tileToPx(85), y: tileToPx(69) };
  spots.dockGate = { x: tileToPx(88), y: tileToPx(64) };
  spots.pierEnd = { x: tileToPx(101), y: tileToPx(67) };
  return { buildings, spots };
}

function buildProps(rng, buildings) {
  const props = [];
  // Palms along the promenade and the beach, lamps along the avenues.
  for (let ty = 2; ty < WORLD_ROWS - 2; ty += 3) {
    props.push({ kind: 'palm', x: tileToPx(91) + rng.range(-8, 8), y: tileToPx(ty) });
    if (ty % 6 === 0) props.push({ kind: 'lamp', x: tileToPx(88) - 14, y: tileToPx(ty) });
  }
  for (const a of AVENUES.slice(0, -1)) {
    for (let ty = 3; ty < WORLD_ROWS - 3; ty += 7) {
      props.push({ kind: 'lamp', x: tileToPx(a) - TILE - 6, y: tileToPx(ty) });
    }
  }
  for (let i = 0; i < 26; i++) {
    props.push({ kind: 'palm', x: rng.range(14 * TILE, 88 * TILE), y: rng.range(3 * TILE, 72 * TILE) });
  }
  // Crates and barrels around the docks.
  for (let i = 0; i < 22; i++) {
    props.push({
      kind: rng.chance(0.6) ? 'crate' : 'barrel',
      x: rng.range((DOCK.x0 + 1) * TILE, DOCK.x1 * TILE),
      y: rng.range((DOCK.y0 + 1) * TILE, DOCK.y1 * TILE),
    });
  }
  // Drop props that landed inside a building.
  return props.filter(
    (p) => !buildings.some((b) => p.x > b.x - 6 && p.x < b.x + b.w + 6 && p.y > b.y - 6 && p.y < b.y + b.h + 6),
  );
}

function buildParking(rng) {
  const spots = [];
  for (const s of STREETS) {
    for (let tx = 9; tx < 88; tx += rng.int(4, 8)) {
      if (AVENUES.some((a) => Math.abs(tx - a) <= 2)) continue;
      const side = rng.chance(0.5) ? -1 : 1;
      spots.push({
        x: tileToPx(tx),
        y: tileToPx(s) + side * TILE * 1.02,
        angle: 0, // parked parallel to the street
      });
    }
  }
  return spots;
}

function buildNodes() {
  const nodes = [];
  for (const a of AVENUES) {
    for (const s of STREETS) nodes.push({ x: tileToPx(a), y: tileToPx(s), a, s });
  }
  return nodes;
}

export function buildWorld() {
  const rng = makeRng(20261117);
  const { buildings, spots } = buildBuildings(rng);
  const props = buildProps(rng, buildings);
  const parking = buildParking(rng);
  const nodes = buildNodes();
  return {
    buildings, props, parking, nodes, spots,
    w: WORLD_W, h: WORLD_H,
  };
}

/** Nearest traffic node to a point. */
export function nearestNode(world, x, y) {
  let best = null, bd = Infinity;
  for (const n of world.nodes) {
    const d = (n.x - x) * (n.x - x) + (n.y - y) * (n.y - y);
    if (d < bd) { bd = d; best = n; }
  }
  return best;
}

/** The node one step from `node` in direction (dx, dy) along the grid, or null. */
export function nextNode(world, node, dx, dy) {
  let a = node.a, s = node.s;
  if (dx !== 0) {
    const na = AVENUES[AVENUES.indexOf(node.a) + dx];
    if (na === undefined) return null;
    a = na;
  }
  if (dy !== 0) {
    const ns = STREETS[STREETS.indexOf(node.s) + dy];
    if (ns === undefined) return null;
    s = ns;
  }
  return world.nodes.find((n) => n.a === a && n.s === s) ?? null;
}
