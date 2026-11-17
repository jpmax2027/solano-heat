// SOLANO HEAT — every tuning number and colour in one place.
// The camera shows a 1280x720 logical window into a much larger world;
// the renderer scales that window to the browser, so no rule below
// depends on the screen size.

export const VIEW = { width: 1280, height: 720 };

/** The whole city, in world units. South is the beach and the sea. */
export const WORLD = { width: 3200, height: 2400 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

/** Road grid: vertical and horizontal road centrelines, road width in world units. */
export const ROADS = {
  vertical: [220, 620, 1020, 1420, 1820, 2220, 2620, 2980],
  horizontal: [220, 620, 1020, 1420, 1820, 2120],
  width: 96,
  lane: 24,
};

/** Where the sand starts and where the water starts (south edge of the city). */
export const BEACH = { sandTop: 2180, waterTop: 2300 };

/** The docks occupy the far east of the map, past the last road. */
export const DOCKS = { x0: 3020, y0: 1300, y1: 2050 };

export const PLAYER = {
  radius: 13,
  walkSpeed: 175,
  runSpeed: 275,
  health: 100,
  armor: 50,
  punchDamage: 25,
  punchRange: 36,
  punchCooldown: 0.45,
  fireCooldown: 0.22,
  bulletSpeed: 950,
  bulletRange: 560,
  bulletDamage: 34,
  startCash: 250,
  startAmmo: 90,
};

export const CAR = {
  length: 54,
  width: 26,
  accel: 420,
  brake: 620,
  reverseAccel: 260,
  maxSpeed: 560,
  maxReverse: 170,
  turnRate: 2.6,
  grip: 3.2,
  trafficSpeed: 150,
  policeSpeed: 430,
  policeSpeedPerStar: 35,
  ramDamage: 14,
};

export const PED = {
  radius: 10,
  walkSpeed: 55,
  fleeSpeed: 190,
  count: 46,
};

export const TRAFFIC_COUNT = 16;
export const PARKED_COUNT = 22;

/** Wanted heat: how much heat each crime adds, how fast it cools when unseen. */
export const WANTED = {
  steal: 55,
  hitPed: 45,
  hitCar: 18,
  shoot: 30,
  kill: 60,
  decayPerSecond: 7,
  starHeat: 100,
  maxStars: 5,
};

export const POLICE = {
  maxCops: 6,
  spawnDistance: 700,
  bustDistance: 46,
  bustSeconds: 1.4,
};

export const PICKUP = {
  health: 35,
  armor: 50,
  cash: 120,
};

/** Golden-hour palette: sun-baked coastal city at late afternoon. */
export const PALETTE = {
  backdrop: '#1a1210',
  grass: '#7d9b4e',
  grassDark: '#6b8a42',
  sand: '#e8c98a',
  sandWet: '#d9b878',
  water: '#2e7f9e',
  waterDeep: '#1f5f7d',
  road: '#3a3a40',
  roadEdge: '#2c2c31',
  lane: '#e8d27a',
  sidewalk: '#9a938a',
  sidewalkEdge: '#7d766d',
  buildingRoof: ['#c96f4a', '#b0523c', '#d9a05b', '#8a6f9e', '#5b7d8a', '#a34d5e', '#7a8a4f', '#4f6f8a'],
  buildingWall: ['#e8d8c0', '#d9c8a8', '#cbb59a', '#e0c9b0', '#c9b8a0'],
  windowLit: '#ffd98a',
  windowDark: '#3a4550',
  palm: '#3f7d3a',
  palmTrunk: '#8a6a45',
  player: '#f2b705',
  playerShirt: '#e8483f',
  pedShirt: ['#4f8a5b', '#5b7d9e', '#9e5b7d', '#c98a3f', '#6f5b9e', '#3f9e8a'],
  cop: '#2b4fd8',
  copCar: '#e8e8e8',
  gang: '#8a2f5e',
  bullet: '#ffe9a8',
  muzzle: '#ffb347',
  cash: '#7de07d',
  health: '#ff5b5b',
  armor: '#5b9eff',
  panel: 'rgba(20, 16, 14, 0.88)',
  panelEdge: '#f2b705',
  text: '#f5efe2',
  muted: '#c9bda8',
  gold: '#f2b705',
  red: '#ff4b3e',
  blue: '#4f8aff',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the save lives between visits (this browser only). */
export const SAVE_KEY = 'solano-heat.save.v1';
export const BEST_KEY = 'solano-heat.best';

export const CAR_COLORS = [
  '#c94f3d', '#3d7dc9', '#e8c94c', '#5b9e4f', '#8a4f9e', '#e8e8e8',
  '#2b2b2e', '#d97b2b', '#4f9e9e', '#9e3d5b', '#b8b8c0', '#6f8a2b',
];

export const CAR_NAMES = [
  'Solano GT', 'Marina Coupe', 'Dune Runner', 'Palma Sedan', 'Harbor Van',
  'Cactus Pickup', 'Sunset Cruiser', 'Tide Hatchback', 'Coral Sport', 'Bay Taxi',
];
