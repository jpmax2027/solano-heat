// SOLANO HEAT — screenshot staging. The ?shot=<name> URLs paint one staged
// scene from shots.json and, once main.js has stepped and rendered it, flag
// window.__shotReady (and optionally POST the canvas JPEG back to serve.ts).
// Every scene is the real game — real city, real traffic, real HUD — just
// posed: Rio placed, the clock set to golden hour, the heat set where the
// scene needs it.

import shotsData from './shots.json' with { type: 'json' };
import { clamp } from './random.js';
import { tileToPx, nearestNode, nextNode } from './world.js';
import { makeCar, addSkid } from './entities.js';
import { VIEW_W, VIEW_H } from './render.js';

function snapCam(G, x, y) {
  G.cam.x = clamp(x - VIEW_W / 2, 0, G.world.w - VIEW_W);
  G.cam.y = clamp(y - VIEW_H / 2, 0, G.world.h - VIEW_H);
}

function putPlayerInCar(G, typeIdx, x, y, angle, speed) {
  const car = makeCar(typeIdx, x, y, angle, 'player');
  car.vx = Math.cos(angle) * speed;
  car.vy = Math.sin(angle) * speed;
  car.speed = speed;
  G.cars.push(car);
  G.player.car = car;
  G.player.x = x;
  G.player.y = y;
  G.player.vx = car.vx;
  G.player.vy = car.vy;
  return car;
}

function skidTrail(G, car, len) {
  const fx = Math.cos(car.angle), fy = Math.sin(car.angle);
  const sx = -fy * 13, sy = fx * 13;
  for (let d = 26; d < len; d += 22) {
    addSkid(G,
      car.x - fx * (d + 22) - sx, car.y - fy * (d + 22) - sy,
      car.x - fx * d - sx, car.y - fy * d - sy);
    addSkid(G,
      car.x - fx * (d + 22) + sx, car.y - fy * (d + 22) + sy,
      car.x - fx * d + sx, car.y - fy * d + sy);
  }
}

/** Move a traffic car onto the node nearest (tx, ty), driving onward. */
function trafficAt(G, tx, ty, skip) {
  const car = G.cars.filter((c) => c.driver === 'traffic')[skip];
  if (!car) return;
  const node = nearestNode(G.world, tileToPx(tx), tileToPx(ty));
  car.fromNode = node;
  car.toNode = nextNode(G.world, node, 1, 0) ?? nextNode(G.world, node, 0, 1) ?? node;
  car.x = node.x;
  car.y = node.y;
  car.angle = Math.atan2(car.toNode.y - node.y, car.toNode.x - node.x);
  car.speed = 120;
}

const SCENES = {
  title(G, spec) {
    G.mode = 'title';
    snapCam(G, tileToPx(spec.camera.tx), tileToPx(spec.camera.ty));
    trafficAt(G, 54, 39, 0);
    trafficAt(G, 66, 28, 1);
  },

  city(G, spec) {
    const x = tileToPx(spec.player.tx), y = tileToPx(spec.player.ty);
    G.player.x = x; G.player.y = y;
    G.player.cash = 850;
    G.player.weapon = 'pistol';
    G.mission.index = spec.missionIndex;
    G.mission.active = true;
    G.mission.stage = 0;
    G.say('RICO: A friend at Casa Azul, up the beach road, is holding a package.');
    const spots = [[-70, 30], [60, -46], [120, 66], [-130, -60], [30, 110]];
    G.peds.slice(0, 5).forEach((ped, i) => {
      ped.x = x + spots[i][0];
      ped.y = y + spots[i][1];
      ped.state = 'walk';
      ped.target = null;
    });
    trafficAt(G, 42, 39, 0);
    trafficAt(G, 54, 28, 1);
    trafficAt(G, 30, 28, 2);
    snapCam(G, x, y);
  },

  drive(G, spec) {
    const x = tileToPx(spec.player.tx), y = tileToPx(spec.player.ty);
    const car = putPlayerInCar(G, spec.carType, x, y, spec.angle, spec.speed);
    G.player.cash = 2400;
    G.mission.active = true;
    G.mission.index = 0;
    G.mission.stage = 0;
    skidTrail(G, car, 170);
    trafficAt(G, 66, 39, 0);
    trafficAt(G, 54, 39, 1);
    snapCam(G, x + 190, y);
  },

  chase(G, spec) {
    const x = tileToPx(spec.player.tx), y = tileToPx(spec.player.ty);
    const car = putPlayerInCar(G, spec.carType, x, y, spec.angle, spec.speed);
    car.color = '#f2a81d';
    G.player.cash = 3150;
    G.player.armor = 40;
    G.addHeat(spec.heat);
    G.mission.active = true;
    G.mission.index = spec.missionIndex;
    G.mission.stage = 0;
    skidTrail(G, car, 210);
    const offsets = [[-170, -84], [-260, 30], [-140, 128]];
    for (const [ox, oy] of offsets) {
      const cop = makeCar(6, x + ox, y + oy, spec.angle + (oy > 0 ? -0.14 : 0.14), 'cop');
      cop.vx = Math.cos(cop.angle) * 330;
      cop.vy = Math.sin(cop.angle) * 330;
      cop.speed = 330;
      cop.sirenPhase = Math.random() * 6;
      G.cars.push(cop);
    }
    trafficAt(G, 66, 50, 0);
    snapCam(G, x + 150, y);
  },
};

export function stageShot(G, name) {
  const spec = shotsData[name];
  if (!spec) {
    G.say(`Unknown shot: ${name}`);
    return;
  }
  G.dayT = spec.dayT ?? 0.7;
  const scene = SCENES[spec.scene];
  if (scene) scene(G, spec);
}
