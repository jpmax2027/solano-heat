// SOLANO HEAT — shared constants: world shape, the road plan, the palette and
// the car catalogue. Everything else reads from here so the city stays
// consistent between the generator, the traffic and the minimap.

export const TILE = 48;
export const WORLD_COLS = 104;
export const WORLD_ROWS = 76;
export const WORLD_W = WORLD_COLS * TILE;
export const WORLD_H = WORLD_ROWS * TILE;

// Road plan, in tile coordinates. A road is three tiles wide, centred on the
// listed column or row. The last avenue is the beach promenade.
export const AVENUES = [6, 18, 30, 42, 54, 66, 78, 90];
export const STREETS = [6, 17, 28, 39, 50, 61];

// The sea starts here; between the promenade and the water is sand.
export const SAND_X = 92;
export const WATER_X = 96;

// The dock quarter in the south-east: concrete apron plus two piers.
export const DOCK = { x0: 82, y0: 64, x1: 95, y1: 74, piers: [66, 71] };

// Fixed step, seconds.
export const STEP = 1 / 60;

// Golden-hour palette. The day cycle lerps between these stops.
export const PALETTE = {
  day: {
    grass: '#79a85b', sand: '#e6cf9a', water: '#2e7fa8', road: '#4a4a52',
    roadLine: '#e8e4d0', sidewalk: '#b9b3a4', roof: '#c96f4a', roofAlt: '#a85b6e',
    dock: '#9a8f7d', pier: '#8a6f4d', sky: '#000000',
  },
  dusk: {
    grass: '#5f7d49', sand: '#d9b57e', water: '#275f7d', road: '#3c3c44',
    roadLine: '#d8b26a', sidewalk: '#9c9482', roof: '#b85f42', roofAlt: '#93506a',
    dock: '#7d7462', pier: '#755f42', sky: '#000000',
  },
  night: {
    grass: '#33502e', sand: '#8f7c58', water: '#173d54', road: '#26262e',
    roadLine: '#8f8a70', sidewalk: '#5d594e', roof: '#6e4438', roofAlt: '#5d3a4a',
    dock: '#4c463c', pier: '#4a3d2c', sky: '#000000',
  },
};

// Car catalogue: name, paint, size, top speed (px/s), acceleration, grip.
// Everything invented — Port Solano metal, no real badges.
export const CAR_TYPES = [
  { name: 'Cordero Sedan', color: '#c8cdd4', w: 34, l: 62, top: 330, accel: 210, grip: 6.5 },
  { name: 'Palmera Coupe', color: '#d84f4f', w: 34, l: 60, top: 430, accel: 300, grip: 7.5 },
  { name: 'Sultan RS', color: '#f2a81d', w: 34, l: 60, top: 500, accel: 360, grip: 8.5 },
  { name: 'Bruma Van', color: '#7fa6c9', w: 38, l: 70, top: 290, accel: 170, grip: 5.5 },
  { name: 'Tortuga Pickup', color: '#6f9e5f', w: 38, l: 68, top: 310, accel: 190, grip: 6.0 },
  { name: 'Veloz Taxi', color: '#f5d13d', w: 34, l: 62, top: 350, accel: 230, grip: 7.0 },
  { name: 'Interceptor', color: '#e8e8ec', w: 35, l: 64, top: 470, accel: 340, grip: 8.0, police: true },
];

export const PED_COLORS = ['#e74c3c', '#3498db', '#f1c40f', '#9b59b6', '#1abc9c', '#e67e22', '#ecf0f1', '#fd79a8'];
export const PED_NAMES = ['Marisol', 'Diego', 'Ana', 'Tomas', 'Lucia', 'Pablo', 'Rosa', 'Felix', 'Nina', 'Hugo'];

export const SAVE_KEY = 'solano-heat-save-v1';
