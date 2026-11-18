// SOLANO HEAT — the story: five jobs for Rio Vargas, told through phone calls
// and dashboard objectives. Each mission is a list of stages; a stage has a
// marker to reach (or a condition to meet), an objective line for the HUD,
// optional setup, and an optional countdown. Finishing a stage advances;
// finishing the last stage pays and rings the next job in.

import { addPickup } from './entities.js';

export function createMissionState() {
  return {
    index: 0, stage: 0, active: false, done: false,
    timer: null, wait: 1.2, flags: {},
  };
}

const S = (G) => G.world.spots;

export const MISSIONS = [
  {
    title: 'First Steps',
    reward: 100,
    intro: [
      'RICO: Rio! You made it to Port Solano. I run the Taller Solano garage.',
      'RICO: Come by the shop. I have work for a driver who keeps his cool.',
    ],
    outro: ['RICO: There he is. Hungry? Good. Jobs pay cash, cash buys freedom.'],
    stages: [
      {
        text: 'Go to Taller Solano and meet Rico',
        marker: (G) => S(G).garage,
        check: (G) => near(G, S(G).garage, 90),
      },
    ],
  },
  {
    title: 'Package Run',
    reward: 600,
    intro: [
      'RICO: A friend at Casa Azul, up the beach road, is holding a package.',
      'RICO: Pick it up and bring it to my garage. Clock is ticking, amigo.',
    ],
    outro: ['RICO: Fast and clean. The city is starting to know your name.'],
    stages: [
      {
        text: 'Pick up the package at Casa Azul',
        marker: (G) => S(G).beachHouse,
        check: (G) => near(G, S(G).beachHouse, 80),
        onDone: (G) => G.say('RIO: Got it. Heavy for its size...'),
      },
      {
        text: 'Deliver the package to Taller Solano',
        marker: (G) => S(G).garage,
        timer: 110,
        check: (G) => near(G, S(G).garage, 90),
      },
    ],
  },
  {
    title: 'Hot Wheels',
    reward: 900,
    intro: [
      'RICO: A magenta Sultan RS is parked by the Hotel Brisa. Very collectible.',
      'RICO: Borrow it. Bring it to the chop shop at Muelle 9. Do not scratch it.',
    ],
    outro: ['RICO: Beautiful. The buyer wired the money before you even parked.'],
    stages: [
      {
        text: 'Steal the magenta Sultan RS at Hotel Brisa',
        marker: (G) => (G.missionCar ? { x: G.missionCar.x, y: G.missionCar.y } : S(G).hotel),
        setup: (G) => {
          if (!G.missionCar) {
            const spot = S(G).hotel;
            G.spawnMissionCar(spot.x + 70, spot.y + 46);
          }
        },
        check: (G) => G.player.car && G.player.car === G.missionCar,
        onDone: (G) => {
          G.say('RIO: Sorry, friend. Business is business.');
          G.addHeat(2, 'mission');
        },
      },
      {
        text: 'Deliver the Sultan RS to the chop shop',
        marker: (G) => S(G).chopShop,
        check: (G) => G.player.car === G.missionCar && near(G, S(G).chopShop, 110),
        onDone: (G) => {
          G.retireCar(G.missionCar);
          G.missionCar = null;
        },
      },
    ],
  },
  {
    title: 'Lose the Heat',
    reward: 800,
    intro: [
      'RICO: The police captain wants an example made of you. Bad timing.',
      'RICO: They are coming hot. Shake them, all of them, and stay gone.',
    ],
    outro: ['RICO: Ghost. The captain is screaming into a dead radio. Classic.'],
    stages: [
      {
        text: 'Lose the police completely',
        marker: () => null,
        setup: (G) => {
          G.addHeat(3, 'mission');
          G.mission.flags.heatSet = true;
        },
        check: (G) => G.mission.flags.heatSet && G.wanted.stars === 0,
      },
    ],
  },
  {
    title: 'The Dock Run',
    reward: 1500,
    intro: [
      'RICO: Last job, Rio. My crew is waiting at the Hotel Brisa, nervous.',
      'RICO: Pick them up and get them to the end of Muelle 9 pier. A boat waits.',
      'RICO: Half the force will chase. Drive like the tide is behind you.',
    ],
    outro: [
      'RICO: They are away clean. You just bought your legend, Rio.',
      'PORT SOLANO IS YOURS NOW. STORY COMPLETE.',
    ],
    stages: [
      {
        text: 'Pick up the crew at Hotel Brisa',
        marker: (G) => S(G).hotel,
        check: (G) => near(G, S(G).hotel, 100) && !!G.player.car,
        onDone: (G) => {
          G.say('CREW: Go go go! They are already behind us!');
          G.addHeat(3, 'mission');
        },
      },
      {
        text: 'Reach the end of the Muelle 9 pier',
        marker: (G) => S(G).pierEnd,
        timer: 160,
        check: (G) => near(G, S(G).pierEnd, 120),
        onDone: (G) => addPickup(G, 'cash', S(G).pierEnd.x - 60, S(G).pierEnd.y),
      },
    ],
  },
];

function near(G, spot, r) {
  return Math.hypot(G.player.x - spot.x, G.player.y - spot.y) < r;
}

export function startMission(G) {
  const m = MISSIONS[G.mission.index];
  if (!m) {
    G.mission.done = true;
    return;
  }
  G.mission.active = true;
  G.mission.stage = 0;
  G.mission.flags = {};
  G.sfxPhone();
  for (const line of m.intro) G.say(line);
  beginStage(G);
}

function beginStage(G) {
  const stage = MISSIONS[G.mission.index].stages[G.mission.stage];
  G.mission.timer = stage.timer ?? null;
  if (stage.setup) stage.setup(G);
}

export function updateMissions(G, dt) {
  const ms = G.mission;
  if (ms.done) {
    G.objective = 'Free roam — Port Solano is yours. (Progress saved)';
    G.marker = null;
    return;
  }
  if (!ms.active) {
    ms.wait -= dt;
    if (ms.wait <= 0) startMission(G);
    G.objective = 'Wait for Rico\'s call...';
    G.marker = null;
    return;
  }
  const mission = MISSIONS[ms.index];
  const stage = mission.stages[ms.stage];
  G.objective = stage.text;
  G.marker = stage.marker ? stage.marker(G) : null;

  if (ms.timer !== null) {
    ms.timer -= dt;
    G.objective += ` — ${Math.max(0, Math.ceil(ms.timer))}s`;
    if (ms.timer <= 0) {
      G.say('RICO: Too slow. Shake it off and try again.');
      beginStage(G);
      return;
    }
  }

  if (stage.check(G)) {
    if (stage.onDone) stage.onDone(G);
    ms.stage++;
    if (ms.stage >= mission.stages.length) {
      G.earn(mission.reward, G.player.x, G.player.y - 30);
      for (const line of mission.outro) G.say(line);
      G.sfxMission();
      ms.active = false;
      ms.index++;
      ms.wait = 5;
      if (ms.index >= MISSIONS.length) {
        ms.done = true;
        G.say('STORY COMPLETE — thanks for playing SOLANO HEAT.');
      }
      G.saveGame();
    } else {
      beginStage(G);
    }
  }
}
