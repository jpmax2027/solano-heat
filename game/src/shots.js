// The screenshot scenes behind ?shot=start|city|drive|chase. Each one plays
// the real rules forward from a fresh world for a fixed number of steps,
// steering the player with a simple scripted driver, so the frame is what
// a short game really looks like and the same seed always gives the same frame.
import { STEP } from './config.js';
import { SCREEN_PLAY, SCREEN_TITLE } from './render.js';

const IDLE = { moveX: 0, moveY: 0, run: false, aimAngle: 0, fire: false, punch: false, enter: false };
const DRIVE = { moveX: 0, moveY: 1, run: false, aimAngle: 0, fire: false, punch: false, enter: false };

function stepFor(world, seconds, input) {
  for (let i = 0; i < seconds / STEP; i += 1) world.step(STEP, input);
}

/**
 * Set `world` to the named scene and return the screen to draw over it plus
 * any UI overrides (mission text, marker, timer) the scene wants to show.
 * Unknown names stage the title scene.
 */
export function stageShot(name, world) {
  const state = world.state;
  const city = world.city;
  if (name === 'city') {
    // On foot downtown: Rio, pedestrians, traffic, a mission marker in view.
    world.putPlayerOnFoot(1220, 820);
    world.crowd(1220, 820, 10);
    state.player.angle = -Math.PI / 2;
    stepFor(world, 2.5, IDLE);
    return {
      screen: SCREEN_PLAY,
      ui: {
        missionIndex: 0,
        missionTimer: 0,
        missionTarget: { x: 1420, y: 1020 },
        message: 'MISSION 1 — THE PACKAGE: pick up the package at the docks (east end).',
        messageTimer: 99,
      },
    };
  }
  if (name === 'drive') {
    // Behind the wheel on the downtown avenue, traffic ahead, a skid coming out of a turn.
    world.putPlayerInCar(700, 1020, 0);
    world.setMission(1);
    state.mission.timer = 62;
    stepFor(world, 2.2, DRIVE);
    stepFor(world, 0.7, { ...DRIVE, moveX: 1 });
    stepFor(world, 1.4, DRIVE);
    return {
      screen: SCREEN_PLAY,
      ui: {
        missionIndex: 1,
        missionTimer: 62,
        missionTarget: city.places.garage,
        message: 'MISSION 2 — THE DELIVERY: bring the car to Marco\'s Garage before the timer ends.',
        messageTimer: 99,
      },
    };
  }
  if (name === 'chase') {
    // Three stars, three cop cars closing in on a fast getaway.
    world.putPlayerInCar(1500, 1420, 0);
    world.setMission(2);
    world.setHeat(350);
    world.spawnCops(3);
    state.mission.timer = 30;
    stepFor(world, 2.6, DRIVE);
    stepFor(world, 0.8, { ...DRIVE, moveX: -1 });
    stepFor(world, 1.2, DRIVE);
    return {
      screen: SCREEN_PLAY,
      ui: {
        missionIndex: 2,
        missionTimer: 30,
        missionTarget: null,
        message: 'MISSION 3 — LOSE THE HEAT: 3 stars. Stay out of their hands until the heat dies down.',
        messageTimer: 99,
      },
    };
  }
  // Title: the living city idles behind the start panel.
  stepFor(world, 6, IDLE);
  return { screen: SCREEN_TITLE, ui: { missionTarget: null } };
}
