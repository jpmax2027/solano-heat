// The story of SOLANO HEAT: Rio Vargas, getaway driver for the Solano crews.
// Four missions, given by phone call from Marco, each with an objective, a
// target on the map, an optional timer and a cash reward. The world module
// owns the state machine; this file is only the script.

export const MISSION_DEFS = [
  {
    id: 'pickup',
    title: 'MISSION 1 — THE PACKAGE',
    caller: 'MARCO (phone)',
    brief: 'Rio, a package is waiting at the docks. No cops, no noise. Walk over, grab it, walk away.',
    objective: 'Pick up the package at the docks (east end)',
    target: 'packageSpot',
    reward: 400,
    timer: 0,
    heat: 0,
  },
  {
    id: 'deliver',
    title: 'MISSION 2 — THE DELIVERY',
    caller: 'MARCO (phone)',
    brief: 'Got a client car that needs to be at my garage before the buyer walks. Grab ANY car and bring it to Marco\'s Garage. Clock is ticking.',
    objective: 'Deliver a car to Marco\'s Garage before the timer ends',
    target: 'garage',
    reward: 650,
    timer: 90,
    heat: 0,
  },
  {
    id: 'heat',
    title: 'MISSION 3 — LOSE THE HEAT',
    caller: 'MARCO (phone)',
    brief: 'The Solano PD is all over you, Rio. Three stars. Stay out of their hands until the heat dies down. Do NOT get busted.',
    objective: 'Survive with 3 stars until the heat dies down',
    target: null,
    reward: 800,
    timer: 45,
    heat: 3,
  },
  {
    id: 'dockrun',
    title: 'MISSION 4 — THE DOCK RUN',
    caller: 'MARCO (phone)',
    brief: 'Last job, Rio. The Vipers are moving product through the docks tonight. Take them out, get to the pier, and we are done. After this, Port Solano is ours.',
    objective: 'Clear the Vipers at the docks, then reach the pier',
    target: 'dockRun',
    reward: 2000,
    timer: 0,
    heat: 2,
  },
];

export const STORY_INTRO = [
  'PORT SOLANO — a sun-baked coastal city where everybody owes somebody.',
  'RIO VARGAS drives for the crews. Tonight the crews need him one last time.',
  'Four jobs. One city. No brakes.',
];

export const STORY_COMPLETE = 'STORY COMPLETE — Port Solano is yours, Rio. The crews answer to you now.';

export function missionTitle(index) {
  return index < MISSION_DEFS.length ? MISSION_DEFS[index].title : 'FREE ROAM';
}

export function missionObjective(index) {
  return index < MISSION_DEFS.length ? MISSION_DEFS[index].objective : 'Free roam — cause chaos, or just cruise the beach.';
}
