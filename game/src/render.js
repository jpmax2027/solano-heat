// Drawing only: the world's state and the current screen in, pixels out.
// The camera shows a 1280x720 window of Port Solano, scaled to fit the
// browser; the HUD and the minimap are drawn in screen space on top.
// Golden-hour look: warm sun, long shadows, lit windows, headlight glow.
import { BEACH, DOCKS, FONT, PALETTE, ROADS, VIEW, WORLD } from './config.js';
import { missionObjective, missionTitle } from './missions.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_BUSTED = 'busted';
export const SCREEN_WASTED = 'wasted';
export const SCREEN_STORY = 'story';

const HALF_ROAD = ROADS.width / 2;

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    canvas.width = width;
    canvas.height = height;
    view.scale = Math.min(width / VIEW.width, height / VIEW.height);
    view.x = (width - VIEW.width * view.scale) / 2;
    view.y = (height - VIEW.height * view.scale) / 2;
  }

  const fonts = new Map();
  function font(size, bold) {
    const key = `${bold ? 'b' : ''}${size}`;
    if (!fonts.has(key)) fonts.set(key, `${bold ? '700 ' : ''}${size}px ${FONT}`);
    return fonts.get(key);
  }

  function text(value, x, y, size, color, align, bold) {
    context.font = font(size, bold);
    context.fillStyle = color;
    context.textAlign = align || 'left';
    context.textBaseline = 'alphabetic';
    context.fillText(value, x, y);
  }

  function rr(x, y, w, h, r) {
    context.beginPath();
    context.moveTo(x + r, y);
    context.arcTo(x + w, y, x + w, y + h, r);
    context.arcTo(x + w, y + h, x, y + h, r);
    context.arcTo(x, y + h, x, y, r);
    context.arcTo(x, y, x + w, y, r);
    context.closePath();
  }

  function drawGround(city, time) {
    // Grass base for the whole map.
    context.fillStyle = PALETTE.grass;
    context.fillRect(0, 0, WORLD.width, WORLD.height);
    // Mown stripes for a little texture.
    context.fillStyle = PALETTE.grassDark;
    for (let y = 0; y < WORLD.height; y += 160) {
      context.fillRect(0, y, WORLD.width, 40);
    }
    // Beach: sand, then wet sand, then the sea with moving wave lines.
    context.fillStyle = PALETTE.sand;
    context.fillRect(0, BEACH.sandTop, WORLD.width, BEACH.waterTop - BEACH.sandTop);
    context.fillStyle = PALETTE.sandWet;
    context.fillRect(0, BEACH.waterTop - 26, WORLD.width, 26);
    context.fillStyle = PALETTE.water;
    context.fillRect(0, BEACH.waterTop, WORLD.width, WORLD.height - BEACH.waterTop);
    context.strokeStyle = 'rgba(255,255,255,0.35)';
    context.lineWidth = 3;
    for (let i = 0; i < 5; i += 1) {
      const wy = BEACH.waterTop + 18 + i * 22 + Math.sin(time * 0.7 + i * 1.7) * 5;
      context.beginPath();
      context.moveTo(0, wy);
      for (let x = 0; x <= WORLD.width; x += 160) {
        context.lineTo(x, wy + Math.sin(x * 0.01 + time + i) * 4);
      }
      context.stroke();
    }
    // Docks: concrete apron, piers and stacked containers.
    context.fillStyle = '#8a8378';
    context.fillRect(DOCKS.x0, DOCKS.y0, WORLD.width - DOCKS.x0, DOCKS.y1 - DOCKS.y0);
    context.fillStyle = '#6f6a60';
    for (let y = DOCKS.y0 + 40; y < DOCKS.y1; y += 170) {
      context.fillRect(DOCKS.x0 + 60, y, 160, 26);
      context.fillStyle = '#a8845c';
      for (let x = DOCKS.x0 + 70; x < DOCKS.x0 + 210; x += 24) {
        context.fillRect(x, y + 4, 16, 18);
      }
      context.fillStyle = '#6f6a60';
    }
    const containerColors = ['#c94f3d', '#3d7dc9', '#e8c94c', '#5b9e4f'];
    for (let i = 0; i < 6; i += 1) {
      context.fillStyle = containerColors[i % containerColors.length];
      context.fillRect(DOCKS.x0 + 30 + (i % 3) * 70, DOCKS.y0 + 60 + Math.floor(i / 3) * 90, 56, 72);
      context.fillStyle = 'rgba(0,0,0,0.25)';
      context.fillRect(DOCKS.x0 + 30 + (i % 3) * 70, DOCKS.y0 + 60 + Math.floor(i / 3) * 90, 56, 10);
    }
  }

  function drawRoads() {
    // Sidewalks first (a pale border around each road), then asphalt.
    for (const line of ROADS.vertical) {
      context.fillStyle = PALETTE.sidewalk;
      context.fillRect(line - HALF_ROAD - 14, 0, ROADS.width + 28, BEACH.sandTop);
      context.fillStyle = PALETTE.road;
      context.fillRect(line - HALF_ROAD, 0, ROADS.width, BEACH.sandTop);
    }
    for (const line of ROADS.horizontal) {
      context.fillStyle = PALETTE.sidewalk;
      context.fillRect(0, line - HALF_ROAD - 14, DOCKS.x0, ROADS.width + 28);
      context.fillStyle = PALETTE.road;
      context.fillRect(0, line - HALF_ROAD, DOCKS.x0, ROADS.width);
    }
    // Centre dashes.
    context.fillStyle = PALETTE.lane;
    for (const line of ROADS.vertical) {
      for (let y = 0; y < BEACH.sandTop; y += 64) {
        context.fillRect(line - 3, y + 8, 6, 30);
      }
    }
    for (const line of ROADS.horizontal) {
      for (let x = 0; x < DOCKS.x0; x += 64) {
        context.fillRect(x + 8, line - 3, 30, 6);
      }
    }
    // Crosswalks at every intersection.
    context.fillStyle = 'rgba(240,240,230,0.75)';
    for (const vx of ROADS.vertical) {
      for (const hy of ROADS.horizontal) {
        for (let i = -3; i <= 3; i += 1) {
          context.fillRect(vx + i * 13 - 4, hy - HALF_ROAD + 6, 8, 16);
          context.fillRect(vx + i * 13 - 4, hy + HALF_ROAD - 22, 8, 16);
        }
      }
    }
  }

  function drawBuildings(city) {
    for (const b of city.buildings) {
      // Long late-afternoon shadow.
      context.fillStyle = 'rgba(0,0,0,0.18)';
      context.fillRect(b.x + 10, b.y + 12, b.w, b.h);
      // Walls with a fake-height top face.
      context.fillStyle = b.wall;
      context.fillRect(b.x, b.y, b.w, b.h);
      context.fillStyle = b.roof;
      context.fillRect(b.x + 5, b.y + 5, b.w - 10, b.h - 10);
      // Rooftop details: AC box and a skylight.
      context.fillStyle = 'rgba(0,0,0,0.25)';
      context.fillRect(b.x + b.w * 0.2, b.y + b.h * 0.25, 16, 12);
      context.fillStyle = 'rgba(255,255,255,0.35)';
      context.fillRect(b.x + b.w * 0.6, b.y + b.h * 0.55, 18, 14);
      // Lit windows on the south face.
      const cols = Math.max(1, Math.floor(b.w / 26));
      for (let c = 0; c < cols; c += 1) {
        context.fillStyle = b.lit ? PALETTE.windowLit : PALETTE.windowDark;
        context.fillRect(b.x + 10 + c * 26, b.y + b.h - 14, 14, 9);
      }
    }
  }

  function drawProps(city, time) {
    // Crates.
    for (const c of city.crates) {
      context.fillStyle = '#a8845c';
      context.fillRect(c.x - c.s / 2, c.y - c.s / 2, c.s, c.s);
      context.strokeStyle = 'rgba(0,0,0,0.3)';
      context.lineWidth = 2;
      context.strokeRect(c.x - c.s / 2, c.y - c.s / 2, c.s, c.s);
    }
    // Hydrants.
    for (const h of city.hydrants) {
      context.fillStyle = '#d9382b';
      context.fillRect(h.x - 4, h.y - 6, 8, 12);
    }
    // Lamps with a warm glow pool.
    for (const lamp of city.lamps) {
      context.fillStyle = 'rgba(255, 214, 130, 0.10)';
      context.beginPath();
      context.arc(lamp.x, lamp.y, 26, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#3a3a3a';
      context.fillRect(lamp.x - 2, lamp.y - 2, 4, 4);
      context.fillStyle = '#ffd682';
      context.beginPath();
      context.arc(lamp.x, lamp.y, 4, 0, Math.PI * 2);
      context.fill();
    }
    // Palms: trunk + five fronds, swaying gently.
    for (const palm of city.palms) {
      const sway = Math.sin(time * 0.8 + palm.x * 0.01) * 3;
      const s = palm.big ? 1.5 : 1;
      context.strokeStyle = PALETTE.palmTrunk;
      context.lineWidth = 5 * s;
      context.beginPath();
      context.moveTo(palm.x, palm.y);
      context.lineTo(palm.x + sway, palm.y - 26 * s);
      context.stroke();
      context.fillStyle = PALETTE.palm;
      for (let i = 0; i < 5; i += 1) {
        const a = (i / 5) * Math.PI * 2 + 0.4;
        context.beginPath();
        context.ellipse(
          palm.x + sway + Math.cos(a) * 13 * s, palm.y - 26 * s + Math.sin(a) * 10 * s,
          14 * s, 5 * s, a, 0, Math.PI * 2,
        );
        context.fill();
      }
    }
  }

  function drawPickups(state, time) {
    for (const pk of state.pickups) {
      if (!pk.active) continue;
      const bob = Math.sin(time * 3 + pk.x) * 3;
      const y = pk.y + bob;
      context.save();
      context.translate(pk.x, y);
      if (pk.kind === 'health') {
        context.fillStyle = '#ffffff';
        context.beginPath();
        context.arc(0, 0, 15, 0, Math.PI * 2);
        context.fill();
        context.fillStyle = PALETTE.health;
        context.fillRect(-3, -9, 6, 18);
        context.fillRect(-9, -3, 18, 6);
      } else if (pk.kind === 'armor') {
        context.fillStyle = PALETTE.armor;
        context.beginPath();
        context.moveTo(0, -12);
        context.lineTo(11, -6);
        context.lineTo(11, 4);
        context.lineTo(0, 13);
        context.lineTo(-11, 4);
        context.lineTo(-11, -6);
        context.closePath();
        context.fill();
        context.fillStyle = '#ffffff';
        context.font = font(13, true);
        context.textAlign = 'center';
        context.fillText('A', 0, 5);
      } else {
        context.fillStyle = PALETTE.gold;
        context.beginPath();
        context.arc(0, 0, 13, 0, Math.PI * 2);
        context.fill();
        context.fillStyle = '#7a5b00';
        context.font = font(16, true);
        context.textAlign = 'center';
        context.fillText('$', 0, 6);
      }
      context.restore();
    }
  }

  function drawMarker(target, time) {
    if (!target) return;
    const pulse = 1 + Math.sin(time * 4) * 0.12;
    // A column of light so the marker is visible across the city.
    const grad = context.createLinearGradient(0, target.y - 160, 0, target.y);
    grad.addColorStop(0, 'rgba(242,183,5,0)');
    grad.addColorStop(1, 'rgba(242,183,5,0.35)');
    context.fillStyle = grad;
    context.fillRect(target.x - 10, target.y - 160, 20, 160);
    context.save();
    context.translate(target.x, target.y);
    context.rotate(Math.PI / 4);
    context.fillStyle = PALETTE.gold;
    const s = 16 * pulse;
    context.fillRect(-s / 2, -s / 2, s, s);
    context.strokeStyle = '#7a5b00';
    context.lineWidth = 2;
    context.strokeRect(-s / 2, -s / 2, s, s);
    context.restore();
  }

  function drawSkids(state) {
    context.strokeStyle = 'rgba(20,20,20,0.45)';
    context.lineWidth = 5;
    for (const skid of state.skids) {
      context.globalAlpha = Math.min(1, skid.life / 2);
      context.beginPath();
      context.moveTo(skid.x - Math.cos(skid.a) * 14, skid.y - Math.sin(skid.a) * 14);
      context.lineTo(skid.x + Math.cos(skid.a) * 14, skid.y + Math.sin(skid.a) * 14);
      context.stroke();
    }
    context.globalAlpha = 1;
  }

  function drawCar(car, time, isPlayer) {
    context.save();
    context.translate(car.x, car.y);
    context.rotate(car.angle);
    // Headlight cones (golden hour: lights already on).
    const beam = context.createLinearGradient(27, 0, 110, 0);
    beam.addColorStop(0, 'rgba(255, 220, 130, 0.28)');
    beam.addColorStop(1, 'rgba(255, 220, 130, 0)');
    context.fillStyle = beam;
    context.beginPath();
    context.moveTo(26, -8);
    context.lineTo(110, -30);
    context.lineTo(110, 30);
    context.lineTo(26, 8);
    context.closePath();
    context.fill();
    // Shadow, body, roof, windshield, details.
    context.fillStyle = 'rgba(0,0,0,0.25)';
    rr(-26, -11, 54, 26, 8);
    context.fill();
    context.fillStyle = car.color;
    rr(-27, -13, 54, 26, 8);
    context.fill();
    context.fillStyle = 'rgba(255,255,255,0.22)';
    rr(-8, -11, 20, 22, 5);
    context.fill();
    context.fillStyle = '#1c2733';
    context.fillRect(6, -10, 10, 20); // windshield
    context.fillRect(-16, -10, 7, 20); // rear window
    // Headlights and taillights.
    context.fillStyle = '#fff6c9';
    context.fillRect(24, -11, 3, 5);
    context.fillRect(24, 6, 3, 5);
    context.fillStyle = '#ff3b30';
    context.fillRect(-27, -11, 3, 5);
    context.fillRect(-27, 6, 3, 5);
    if (car.kind === 'police') {
      // Flashing light bar.
      const phase = Math.floor(time * 4) % 2 === 0;
      context.fillStyle = phase ? '#ff2d2d' : '#2d5bff';
      context.fillRect(-4, -13, 8, 5);
      context.fillStyle = phase ? '#2d5bff' : '#ff2d2d';
      context.fillRect(-4, 8, 8, 5);
      context.fillStyle = '#1c2733';
      context.font = font(9, true);
      context.textAlign = 'center';
      context.fillText('PD', 0, 3);
    }
    if (isPlayer) {
      context.strokeStyle = PALETTE.gold;
      context.lineWidth = 2;
      rr(-30, -16, 60, 32, 9);
      context.stroke();
    }
    context.restore();
  }

  function drawPed(ped, time) {
    const walking = Math.sin(time * 8 + ped.x) * 2;
    context.save();
    context.translate(ped.x, ped.y);
    // Shadow.
    context.fillStyle = 'rgba(0,0,0,0.25)';
    context.beginPath();
    context.ellipse(0, 7, 10, 5, 0, 0, Math.PI * 2);
    context.fill();
    context.rotate(ped.angle);
    // Body (shirt), head, and a gun for gang members.
    context.fillStyle = ped.shirt;
    context.beginPath();
    context.arc(0, 0, 10, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = '#e8c39a';
    context.beginPath();
    context.arc(3, 0, 5, 0, Math.PI * 2);
    context.fill();
    if (ped.kind === 'gang') {
      context.fillStyle = '#222';
      context.fillRect(8, -2, 10, 4);
    }
    if (ped.flee > 0) {
      context.strokeStyle = '#fff';
      context.lineWidth = 2;
      context.beginPath();
      context.moveTo(-6, -8 + walking);
      context.lineTo(6, -8 - walking);
      context.stroke();
    }
    context.restore();
  }

  function drawPlayer(state, time) {
    const p = state.player;
    if (p.inCar) return; // the car drawing carries him
    const blink = p.invulnerable > 0 && Math.floor(p.invulnerable * 10) % 2 === 0;
    if (blink) return;
    context.save();
    context.translate(p.x, p.y);
    context.fillStyle = 'rgba(0,0,0,0.3)';
    context.beginPath();
    context.ellipse(0, 8, 11, 5, 0, 0, Math.PI * 2);
    context.fill();
    context.rotate(p.angle);
    // Rio: red shirt, gold cap, pistol in hand.
    context.fillStyle = PALETTE.playerShirt;
    context.beginPath();
    context.arc(0, 0, 12, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = '#e8c39a';
    context.beginPath();
    context.arc(4, 0, 6, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = PALETTE.gold;
    context.beginPath();
    context.arc(2, 0, 6, Math.PI * 0.5, Math.PI * 1.5);
    context.fill();
    context.fillStyle = '#222';
    context.fillRect(12, -2, 12, 4);
    context.restore();
  }

  function drawBullets(state) {
    context.strokeStyle = PALETTE.bullet;
    context.lineWidth = 3;
    for (const b of state.bullets) {
      context.beginPath();
      context.moveTo(b.x - b.vx * 0.012, b.y - b.vy * 0.012);
      context.lineTo(b.x, b.y);
      context.stroke();
    }
  }

  function drawParticles(state) {
    for (const p of state.particles) {
      context.globalAlpha = Math.max(0, p.life / p.maxLife);
      context.fillStyle = p.color;
      context.beginPath();
      context.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      context.fill();
    }
    context.globalAlpha = 1;
  }

  function drawFloats(state) {
    context.font = font(18, true);
    context.textAlign = 'center';
    for (const f of state.floats) {
      context.globalAlpha = Math.min(1, f.life);
      context.fillStyle = f.color;
      context.fillText(f.text, f.x, f.y);
    }
    context.globalAlpha = 1;
  }

  function drawWorld(state, city, ui) {
    const cam = state.camera;
    const shx = state.shake > 0 ? (Math.random() - 0.5) * state.shake : 0;
    const shy = state.shake > 0 ? (Math.random() - 0.5) * state.shake : 0;
    context.setTransform(view.scale, 0, 0, view.scale, view.x - (cam.x + shx) * view.scale, view.y - (cam.y + shy) * view.scale);
    drawGround(city, state.time);
    drawRoads();
    drawBuildings(city);
    drawProps(city, state.time);
    drawPickups(state, state.time);
    drawMarker(ui.missionTarget, state.time);
    drawSkids(state);
    for (const car of state.cars) drawCar(car, state.time, car.driven);
    for (const ped of state.peds) drawPed(ped, state.time);
    drawPlayer(state, state.time);
    drawBullets(state);
    drawParticles(state);
    drawFloats(state);
    // Warm golden-hour wash over the whole scene.
    context.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    const wash = context.createLinearGradient(0, 0, 0, VIEW.height);
    wash.addColorStop(0, 'rgba(255, 170, 80, 0.05)');
    wash.addColorStop(1, 'rgba(255, 120, 40, 0.12)');
    context.fillStyle = wash;
    context.fillRect(0, 0, VIEW.width, VIEW.height);
  }

  function drawMinimap(state, ui) {
    const mw = 230;
    const mh = 168;
    const mx = VIEW.width - mw - 16;
    const my = VIEW.height - mh - 16;
    const sx = mw / WORLD.width;
    const sy = mh / WORLD.height;
    context.save();
    context.fillStyle = 'rgba(16, 14, 12, 0.82)';
    rr(mx - 6, my - 6, mw + 12, mh + 12, 8);
    context.fill();
    context.strokeStyle = PALETTE.panelEdge;
    context.lineWidth = 1.5;
    context.stroke();
    context.beginPath();
    context.rect(mx, my, mw, mh);
    context.clip();
    // Sea and sand at the bottom.
    context.fillStyle = PALETTE.water;
    context.fillRect(mx, my + BEACH.waterTop * sy, mw, mh - BEACH.waterTop * sy);
    context.fillStyle = PALETTE.sand;
    context.fillRect(mx, my + BEACH.sandTop * sy, mw, (BEACH.waterTop - BEACH.sandTop) * sy);
    // Roads.
    context.strokeStyle = '#8a8a92';
    context.lineWidth = 2;
    for (const line of ROADS.vertical) {
      context.beginPath();
      context.moveTo(mx + line * sx, my);
      context.lineTo(mx + line * sx, my + BEACH.sandTop * sy);
      context.stroke();
    }
    for (const line of ROADS.horizontal) {
      context.beginPath();
      context.moveTo(mx, my + line * sy);
      context.lineTo(mx + DOCKS.x0 * sx, my + line * sy);
      context.stroke();
    }
    // Pickups, traffic, police, mission marker, player.
    context.fillStyle = PALETTE.cash;
    for (const pk of state.pickups) {
      if (pk.active) context.fillRect(mx + pk.x * sx - 1, my + pk.y * sy - 1, 3, 3);
    }
    context.fillStyle = '#c9c9c9';
    for (const car of state.cars) {
      if (car.kind === 'traffic') context.fillRect(mx + car.x * sx - 1, my + car.y * sy - 1, 3, 3);
    }
    context.fillStyle = PALETTE.blue;
    for (const car of state.cars) {
      if (car.kind === 'police') {
        context.beginPath();
        context.arc(mx + car.x * sx, my + car.y * sy, 3.5, 0, Math.PI * 2);
        context.fill();
      }
    }
    if (ui.missionTarget) {
      context.fillStyle = PALETTE.gold;
      const tx = mx + ui.missionTarget.x * sx;
      const ty = my + ui.missionTarget.y * sy;
      context.save();
      context.translate(tx, ty);
      context.rotate(Math.PI / 4);
      context.fillRect(-5, -5, 10, 10);
      context.restore();
    }
    const p = state.player;
    context.save();
    context.translate(mx + p.x * sx, my + p.y * sy);
    context.rotate(p.angle);
    context.fillStyle = PALETTE.gold;
    context.beginPath();
    context.moveTo(7, 0);
    context.lineTo(-5, -5);
    context.lineTo(-5, 5);
    context.closePath();
    context.fill();
    context.restore();
    context.restore();
    text('PORT SOLANO', mx, my - 10, 12, PALETTE.muted, 'left', true);
  }

  function drawHud(state, ui) {
    const p = state.player;
    // Top-left: health + armor bars and cash.
    context.fillStyle = 'rgba(16,14,12,0.75)';
    rr(16, 14, 250, 64, 8);
    context.fill();
    text('RIO VARGAS', 28, 36, 13, PALETTE.muted, 'left', true);
    context.fillStyle = '#3a2020';
    context.fillRect(28, 44, 180, 10);
    context.fillStyle = p.health > 30 ? PALETTE.health : '#ff2d2d';
    context.fillRect(28, 44, 180 * (p.health / 100), 10);
    context.fillStyle = '#1c2a3a';
    context.fillRect(28, 58, 180, 7);
    context.fillStyle = PALETTE.armor;
    context.fillRect(28, 58, 180 * (p.armor / 100), 7);
    text(`$${p.cash}`, 216, 54, 22, PALETTE.cash, 'left', true);
    // Top-right: wanted stars.
    const starCount = ui.stars;
    context.fillStyle = 'rgba(16,14,12,0.75)';
    rr(VIEW.width - 16 - 190, 14, 190, 40, 8);
    context.fill();
    for (let i = 0; i < 5; i += 1) {
      text('★', VIEW.width - 32 - i * 34, 44, 26, i < starCount ? PALETTE.gold : 'rgba(255,255,255,0.22)', 'center', true);
    }
    // Top-centre: mission objective banner.
    const objective = missionObjective(ui.missionIndex);
    context.fillStyle = 'rgba(16,14,12,0.75)';
    const bannerW = 520;
    rr((VIEW.width - bannerW) / 2, 14, bannerW, 40, 8);
    context.fill();
    text(missionTitle(ui.missionIndex), VIEW.width / 2, 32, 13, PALETTE.gold, 'center', true);
    text(objective, VIEW.width / 2, 48, 13, PALETTE.text, 'center');
    if (ui.missionTimer > 0) {
      text(`${Math.ceil(ui.missionTimer)}s`, VIEW.width / 2 + bannerW / 2 - 14, 48, 15, PALETTE.red, 'right', true);
    }
    // Bottom-left: weapon, ammo, speed.
    context.fillStyle = 'rgba(16,14,12,0.75)';
    rr(16, VIEW.height - 66, 350, 50, 8);
    context.fill();
    const weapon = p.inCar ? `${p.inCar.name}  •  ${Math.round(Math.abs(p.inCar.speed) * 0.22)} km/h` : `PISTOL  •  ${p.ammo} ammo`;
    text(weapon, 28, VIEW.height - 40, 16, PALETTE.text, 'left', true);
    text(p.inCar ? 'E — exit car    •    Click — shoot' : 'E — steal car    •    V — punch    •    Click — shoot', 28, VIEW.height - 22, 12, PALETTE.muted, 'left');
    // Mission message banner.
    if (ui.messageTimer > 0 && ui.message) {
      context.fillStyle = 'rgba(16,14,12,0.85)';
      const lines = wrap(ui.message, 92);
      const h = 30 + lines.length * 24;
      rr((VIEW.width - 760) / 2, 66, 760, h, 8);
      context.fill();
      context.strokeStyle = PALETTE.panelEdge;
      context.lineWidth = 1.5;
      context.stroke();
      lines.forEach((line, i) => text(line, VIEW.width / 2, 92 + i * 24, 15, PALETTE.text, 'center'));
    }
    // Mute indicator.
    if (ui.muted) text('🔇 MUTED (M)', VIEW.width - 16, VIEW.height - 200, 13, PALETTE.muted, 'right');
    drawMinimap(state, ui);
  }

  function wrap(value, maxChars) {
    const words = String(value).split(' ');
    const lines = [];
    let line = '';
    for (const word of words) {
      if ((line + ' ' + word).trim().length > maxChars && line) {
        lines.push(line.trim());
        line = word;
      } else {
        line = `${line} ${word}`;
      }
    }
    if (line.trim()) lines.push(line.trim());
    return lines;
  }

  function drawPanel(title, lines, prompt, accent) {
    const width = 780;
    const lineH = 30;
    const height = 150 + lines.length * lineH + 70;
    const x = (VIEW.width - width) / 2;
    const y = (VIEW.height - height) / 2;
    context.fillStyle = PALETTE.panel;
    rr(x, y, width, height, 12);
    context.fill();
    context.strokeStyle = accent || PALETTE.panelEdge;
    context.lineWidth = 2;
    context.stroke();
    text(title, VIEW.width / 2, y + 72, 52, accent || PALETTE.gold, 'center', true);
    lines.forEach((line, i) => {
      text(line, VIEW.width / 2, y + 128 + i * lineH, 19, i === 0 ? PALETTE.text : PALETTE.muted, 'center');
    });
    text(prompt, VIEW.width / 2, y + height - 30, 20, PALETTE.gold, 'center', true);
  }

  function drawTitle(state, city, ui) {
    drawWorld(state, city, { missionTarget: ui.missionTarget });
    // Title panel over the living city.
    const lines = [
      'Port Solano — a sun-baked coastal city where everybody owes somebody.',
      'RIO VARGAS drives for the crews. Tonight the crews need him one last time.',
      '',
      'WASD / Arrows — move & drive      E — enter / steal car      Shift — run',
      'Mouse aim + Click / Space — shoot      V — punch      P — pause      M — mute',
      '',
      `Best cash banked: $${ui.best}`,
    ];
    if (ui.hasSave) lines.push('Press L — Continue your saved game');
    drawPanel('SOLANO HEAT', lines, 'Press Space or click to start', PALETTE.gold);
  }

  /** Paint one frame: the world, then the HUD or a panel for the screen the game is on. */
  function draw(state, city, screen, ui) {
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = PALETTE.backdrop;
    context.fillRect(0, 0, canvas.width, canvas.height);
    if (screen === SCREEN_TITLE) {
      drawTitle(state, city, ui);
      return;
    }
    drawWorld(state, city, ui);
    context.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    drawHud(state, ui);
    if (screen === SCREEN_PAUSED) {
      drawPanel('PAUSED', ['The city waits. The cops do not.', 'Progress auto-saves after every mission.'], 'Press P to resume');
    } else if (screen === SCREEN_BUSTED) {
      drawPanel('BUSTED', ['The Solano PD caught up with Rio.', 'They took 20% of your cash. Back on the street.'], 'Press Space to keep playing');
    } else if (screen === SCREEN_WASTED) {
      drawPanel('WASTED', ['Rio woke up at Solano General.', 'Hospital bill: 20% of your cash.'], 'Press Space to keep playing');
    } else if (screen === SCREEN_STORY) {
      drawPanel('STORY COMPLETE', ['Port Solano is yours, Rio.', 'The crews answer to you now.', '', `Cash banked: $${state.player.cash}   •   Cars stolen: ${state.stats.carsStolen}`], 'Press Space to free-roam');
    }
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw, view };
}
