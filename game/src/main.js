// Boot and the one loop: input is read every frame, the world advances in fixed 1/60 s steps
// (several in a slow frame, none in a fast one), and the renderer paints what is there. The game
// moves between title, play, paused, busted, wasted and story-complete screens.
//
// ?seed=N fixes the city. ?shot=start|city|drive|chase (with &seed=N) stages that scene
// instead of running the loop, paints it twice and sets window.__shotReady for a screenshot.
//
// Progress saves to localStorage after every mission and when pausing; L on the title screen
// continues a saved game.
import { BEST_KEY, SAVE_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import { createCity } from './city.js';
import {
  EVENT_BUSTED, EVENT_CASH, EVENT_CRASH, EVENT_HIT, EVENT_MISSION,
  EVENT_PHONE, EVENT_PICKUP, EVENT_PUNCH, EVENT_SHOT, EVENT_STORY, EVENT_WASTED,
  createWorld,
} from './world.js';
import {
  ACTION_CONFIRM, ACTION_ENTER, ACTION_LOAD, ACTION_MUTE, ACTION_PAUSE,
  ACTION_PUNCH, createInput,
} from './input.js';
import {
  SCREEN_BUSTED, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_STORY,
  SCREEN_TITLE, SCREEN_WASTED, createRenderer,
} from './render.js';
import { stageShot } from './shots.js';
import { createAudio } from './audio.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const city = createCity(createRandom(seed));
const world = createWorld(createRandom(seed + 7), city);
const renderer = createRenderer(canvas);
const audio = createAudio();

// Debug handle for play-testing from the console (read-only peeking).
window.__world = world;
window.__city = city;

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function readSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveGame() {
  try {
    const p = world.state.player;
    window.localStorage.setItem(SAVE_KEY, JSON.stringify({
      cash: p.cash,
      missionIndex: world.state.mission.index,
      x: p.x,
      y: p.y,
      health: p.health,
      armor: p.armor,
      ammo: p.ammo,
    }));
    if (p.cash > readBest()) {
      window.localStorage.setItem(BEST_KEY, String(p.cash));
    }
  } catch {
    // Storage can be off (private windows): progress then lasts this visit only.
  }
}

function loadGame() {
  const save = readSave();
  if (!save) return false;
  world.reset();
  world.setMission(Math.min(save.missionIndex ?? 0, 3));
  const p = world.state.player;
  p.cash = save.cash ?? 250;
  p.health = save.health ?? 100;
  p.armor = save.armor ?? 50;
  p.ammo = save.ammo ?? 60;
  world.putPlayerOnFoot(save.x ?? city.places.spawn.x, save.y ?? city.places.spawn.y);
  world.state.mission.message = 'Welcome back, Rio. The city kept your seat warm.';
  world.state.mission.messageTimer = 5;
  return true;
}

function buildUi(overrides) {
  const state = world.state;
  const ui = {
    stars: world.stars(),
    missionIndex: state.mission.storyComplete ? 4 : state.mission.index,
    missionTimer: state.mission.timer,
    message: state.mission.message,
    messageTimer: state.mission.messageTimer,
    missionTarget: world.missionTarget(),
    best: readBest(),
    hasSave: readSave() !== null,
    muted: audio.muted,
  };
  return { ...ui, ...(overrides || {}) };
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, city, scene.screen, buildUi(scene.ui));
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let accumulator = 0;
  let last = performance.now();
  let pendingEnter = false;
  let pendingPunch = false;

  function announce(message) {
    status.textContent = message;
  }

  function handleEvents(events) {
    if (events & EVENT_SHOT) audio.shot();
    if (events & EVENT_CRASH) audio.crash();
    if (events & EVENT_PUNCH) audio.punch();
    if (events & EVENT_PICKUP) audio.chime();
    if (events & EVENT_CASH) audio.chime();
    if (events & EVENT_PHONE) audio.phone();
    if (events & EVENT_MISSION) {
      audio.missionDone();
      saveGame();
    }
    if (events & EVENT_BUSTED) {
      audio.busted();
      screen = SCREEN_BUSTED;
      announce('Busted by the Solano PD.');
    }
    if (events & EVENT_WASTED) {
      audio.busted();
      screen = SCREEN_WASTED;
      announce('Wasted. You woke up at Solano General.');
    }
    if (events & EVENT_STORY) {
      screen = SCREEN_STORY;
      announce('Story complete. Port Solano is yours.');
    }
    if (events & EVENT_HIT) announce('Hit.');
  }

  function startGame(fresh) {
    audio.ensure();
    if (fresh) world.reset();
    accumulator = 0;
    screen = SCREEN_PLAY;
    announce('Playing. Follow the gold marker.');
  }

  function step() {
    if (screen === SCREEN_TITLE) {
      // The city idles behind the title panel.
      world.step(STEP, { moveX: 0, moveY: 0, run: false, aimAngle: 0, fire: false, punch: false, enter: false });
      return;
    }
    const move = input.move();
    const mouse = input.mouse();
    const ratio = window.devicePixelRatio || 1;
    const view = renderer.view;
    const worldMouseX = (mouse.x * ratio - view.x) / view.scale + world.state.camera.x;
    const worldMouseY = (mouse.y * ratio - view.y) / view.scale + world.state.camera.y;
    const p = world.state.player;
    const aimAngle = Math.atan2(worldMouseY - p.y, worldMouseX - p.x);
    const events = world.step(STEP, {
      moveX: move.x,
      moveY: move.y,
      run: input.run(),
      aimAngle,
      fire: input.firing(),
      punch: pendingPunch,
      enter: pendingEnter,
    });
    pendingEnter = false;
    pendingPunch = false;
    handleEvents(events);
    audio.update(STEP, p.inCar ? Math.abs(p.inCar.speed) / 560 : 0, world.stars());
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_MUTE) {
      audio.setMuted(!audio.muted);
      announce(audio.muted ? 'Muted.' : 'Sound on.');
    }
    if (actions & ACTION_ENTER) pendingEnter = true;
    if (actions & ACTION_PUNCH) pendingPunch = true;
    if (screen === SCREEN_TITLE) {
      if (actions & ACTION_LOAD && readSave()) {
        if (loadGame()) startGame(false);
      } else if (actions & ACTION_CONFIRM) {
        startGame(true);
      }
    } else if (screen === SCREEN_PLAY) {
      if (actions & ACTION_PAUSE) {
        screen = SCREEN_PAUSED;
        saveGame();
        announce('Paused.');
      }
    } else if (screen === SCREEN_PAUSED) {
      if (actions & (ACTION_PAUSE | ACTION_CONFIRM)) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      }
    } else if (screen === SCREEN_BUSTED || screen === SCREEN_WASTED || screen === SCREEN_STORY) {
      if (actions & ACTION_CONFIRM) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      }
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
        step();
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(world.state, city, screen, buildUi());
  }

  // Leaving the tab pauses a running game rather than letting the cops close in unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      saveGame();
      announce('Paused.');
    }
  });

  announce('SOLANO HEAT. Press Space or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
