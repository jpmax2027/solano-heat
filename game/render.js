// SOLANO HEAT — everything the player sees: the city from above, cars, peds,
// effects, the HUD, the minimap and the screens. Pure canvas, no assets.
// The day cycle lerps the palette between night, dusk and day stops; at low
// light the cars grow headlight cones and the lamps switch on.

import { TILE, WORLD_COLS, WORLD_ROWS, PALETTE, CAR_TYPES, AVENUES, STREETS, WATER_X, SAND_X } from './config.js';
import { clamp, lerp } from './random.js';
import { tileClass } from './world.js';

export const VIEW_W = 1280;
export const VIEW_H = 800;

function hexRgb(color) {
  // Accepts '#rrggbb' and the 'rgb(r,g,b)' strings paletteAt returns.
  if (color.startsWith('#')) {
    return [parseInt(color.slice(1, 3), 16), parseInt(color.slice(3, 5), 16), parseInt(color.slice(5, 7), 16)];
  }
  const m = /(\d+),\s*(\d+),\s*(\d+)/.exec(color);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : [0, 0, 0];
}

function mix(a, b, t) {
  const ca = hexRgb(a), cb = hexRgb(b);
  return `rgb(${Math.round(lerp(ca[0], cb[0], t))},${Math.round(lerp(ca[1], cb[1], t))},${Math.round(lerp(ca[2], cb[2], t))})`;
}

/** The live palette for the current time of day, plus a darkness factor. */
export function paletteAt(dayT) {
  // dayT: 0..1 around the clock; daylight peaks mid-cycle.
  const sun = Math.sin((dayT - 0.25) * Math.PI * 2) * 0.5 + 0.5; // 0 night → 1 noon
  const pal = {};
  for (const key of Object.keys(PALETTE.day)) {
    if (sun > 0.55) pal[key] = mix(PALETTE.dusk[key], PALETTE.day[key], (sun - 0.55) / 0.45);
    else pal[key] = mix(PALETTE.night[key], PALETTE.dusk[key], Math.max(0, sun / 0.55));
  }
  return { pal, dark: clamp(1 - sun * 1.6, 0, 0.82) };
}

export function drawWorld(ctx, G, pal, dark) {
  const cam = G.cam;
  const tx0 = Math.max(0, Math.floor(cam.x / TILE)), ty0 = Math.max(0, Math.floor(cam.y / TILE));
  const tx1 = Math.min(WORLD_COLS - 1, tx0 + Math.ceil(VIEW_W / TILE) + 1);
  const ty1 = Math.min(WORLD_ROWS - 1, ty0 + Math.ceil(VIEW_H / TILE) + 1);
  const wave = Math.sin(G.time * 1.4) * 3;

  for (let ty = ty0; ty <= ty1; ty++) {
    for (let tx = tx0; tx <= tx1; tx++) {
      const cls = tileClass(tx, ty);
      const x = tx * TILE - cam.x, y = ty * TILE - cam.y;
      ctx.fillStyle = pal[cls] ?? pal.grass;
      if (cls === 'water') ctx.fillStyle = mix(pal.water, '#ffffff', 0.05 + 0.04 * Math.sin(tx * 0.7 + wave));
      ctx.fillRect(x, y, TILE + 1, TILE + 1);
      if (cls === 'road') {
        // Lane dashes along road centres.
        ctx.fillStyle = pal.roadLine;
        const onAve = AVENUES.some((a) => a === tx), onSt = STREETS.some((s) => s === ty);
        if (onAve && !onSt && ty % 2 === 0) ctx.fillRect(x + TILE / 2 - 2, y + 8, 4, 20);
        if (onSt && !onAve && tx % 2 === 0) ctx.fillRect(x + 8, y + TILE / 2 - 2, 20, 4);
      }
      if (cls === 'sand') {
        ctx.fillStyle = 'rgba(160,120,60,0.25)';
        if ((tx * 7 + ty * 13) % 5 === 0) ctx.fillRect(x + 10, y + 14, 5, 3);
      }
    }
  }

  // Skid marks under everything mobile.
  ctx.lineWidth = 4;
  for (const s of G.skids) {
    ctx.strokeStyle = `rgba(20,20,24,${clamp(s.life / 7, 0, 0.5)})`;
    ctx.beginPath();
    ctx.moveTo(s.x1 - cam.x, s.y1 - cam.y);
    ctx.lineTo(s.x2 - cam.x, s.y2 - cam.y);
    ctx.stroke();
  }

  // Pickups: a glowing ring and a glyph.
  for (const p of G.pickups) {
    if (!p.active) continue;
    const bob = Math.sin(G.time * 3 + p.phase) * 3;
    const x = p.x - cam.x, y = p.y - cam.y + bob;
    const glyph = { health: '+', armor: 'A', cash: '$', bribe: '★' }[p.kind];
    const color = { health: '#ff5b6a', armor: '#5bb8ff', cash: '#69e58a', bribe: '#ffe66d' }[p.kind];
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath(); ctx.ellipse(x, y + 12 - bob, 13, 5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(x, y, 12, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#14202a';
    ctx.font = 'bold 15px system-ui, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(glyph, x, y + 1);
  }
}

export function drawProps(ctx, G, dark) {
  const cam = G.cam;
  for (const p of G.world.props) {
    const x = p.x - cam.x, y = p.y - cam.y;
    if (x < -60 || y < -60 || x > VIEW_W + 60 || y > VIEW_H + 60) continue;
    if (p.kind === 'palm') {
      ctx.strokeStyle = '#7a5a38';
      ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 3, y - 12); ctx.stroke();
      ctx.strokeStyle = '#3f8f4f';
      ctx.lineWidth = 3;
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + 0.4;
        ctx.beginPath();
        ctx.moveTo(x + 3, y - 12);
        ctx.quadraticCurveTo(x + 3 + Math.cos(a) * 12, y - 16 + Math.sin(a) * 5, x + 3 + Math.cos(a) * 19, y - 8 + Math.sin(a) * 9);
        ctx.stroke();
      }
    } else if (p.kind === 'lamp') {
      ctx.fillStyle = '#3a3a40';
      ctx.fillRect(x - 2, y - 14, 4, 14);
      if (dark > 0.25) {
        const g = ctx.createRadialGradient(x, y - 15, 2, x, y - 15, 44);
        g.addColorStop(0, `rgba(255,214,140,${0.5 * dark})`);
        g.addColorStop(1, 'rgba(255,214,140,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(x, y - 15, 44, 0, Math.PI * 2); ctx.fill();
      }
      ctx.fillStyle = '#ffe9b0';
      ctx.fillRect(x - 2, y - 17, 4, 4);
    } else if (p.kind === 'crate') {
      ctx.fillStyle = '#a67c4e';
      ctx.fillRect(x - 10, y - 10, 20, 20);
      ctx.strokeStyle = '#7d5a33';
      ctx.lineWidth = 2;
      ctx.strokeRect(x - 10, y - 10, 20, 20);
      ctx.beginPath(); ctx.moveTo(x - 10, y - 10); ctx.lineTo(x + 10, y + 10); ctx.stroke();
    } else if (p.kind === 'barrel') {
      ctx.fillStyle = '#5b7fa6';
      ctx.beginPath(); ctx.arc(x, y, 8, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#42617f';
      ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2); ctx.fill();
    }
  }
}

export function drawBuildings(ctx, G, pal) {
  const cam = G.cam;
  for (const b of G.world.buildings) {
    const x = b.x - cam.x, y = b.y - cam.y;
    if (x + b.w < -40 || y + b.h < -40 || x > VIEW_W + 40 || y > VIEW_H + 40) continue;
    const lift = 4 + b.floors * 2.2;
    // Shadow / side wall, offset up-left for the golden-hour sun.
    ctx.fillStyle = 'rgba(30,20,16,0.35)';
    ctx.fillRect(x + 6, y + 8, b.w, b.h);
    ctx.fillStyle = mix(b.tone > 0.5 ? pal.roof : pal.roofAlt, '#000000', 0.028 * (9 - b.floors));
    ctx.fillRect(x - lift * 0.3, y - lift * 0.3, b.w, b.h);
    const rx = x - lift * 0.3, ry = y - lift * 0.3;
    // Roof furniture: AC boxes and a parapet.
    ctx.strokeStyle = 'rgba(0,0,0,0.28)';
    ctx.lineWidth = 3;
    ctx.strokeRect(rx + 3, ry + 3, b.w - 6, b.h - 6);
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    const n = Math.max(1, Math.floor(b.w / 70));
    for (let i = 0; i < n; i++) {
      ctx.fillRect(rx + 14 + i * 62, ry + 12, 22, 14);
    }
    if (b.kind === 'shop' || b.kind === 'warehouse') {
      ctx.fillStyle = b.kind === 'warehouse' ? '#7d7462' : '#e2725b';
      ctx.fillRect(rx, ry + b.h - 16, b.w, 12);
    }
    if (b.label) {
      ctx.font = 'bold 13px system-ui, sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.fillText(b.label, rx + b.w / 2 + 1, ry + b.h / 2 + 1);
      ctx.fillStyle = '#fff7e0';
      ctx.fillText(b.label, rx + b.w / 2, ry + b.h / 2);
    }
  }
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function drawCar(ctx, G, car, dark) {
  const cam = G.cam;
  const type = CAR_TYPES[car.type];
  const x = car.x - cam.x, y = car.y - cam.y;
  if (x < -90 || y < -90 || x > VIEW_W + 90 || y > VIEW_H + 90) return;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(car.angle);

  // Headlight cones at low light.
  if (dark > 0.2 && !car.disabled) {
    const g = ctx.createRadialGradient(type.l / 2, 0, 6, type.l / 2 + 95, 0, 110);
    g.addColorStop(0, `rgba(255,240,190,${0.35 * dark})`);
    g.addColorStop(1, 'rgba(255,240,190,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(type.l / 2, -9);
    ctx.lineTo(type.l / 2 + 105, -34);
    ctx.lineTo(type.l / 2 + 105, 34);
    ctx.lineTo(type.l / 2, 9);
    ctx.closePath();
    ctx.fill();
  }

  // Shadow, body, glass, details.
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  roundRect(ctx, -type.l / 2 + 3, -type.w / 2 + 4, type.l, type.w, 7);
  ctx.fill();
  ctx.fillStyle = car.disabled ? '#4c4c50' : car.color;
  roundRect(ctx, -type.l / 2, -type.w / 2, type.l, type.w, 7);
  ctx.fill();
  ctx.fillStyle = 'rgba(20,28,38,0.9)';
  roundRect(ctx, -type.l * 0.08, -type.w / 2 + 4, type.l * 0.3, type.w - 8, 4); // windshield block
  ctx.fill();
  roundRect(ctx, -type.l * 0.34, -type.w / 2 + 5, type.l * 0.18, type.w - 10, 3); // rear glass
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.16)';
  roundRect(ctx, type.l * 0.24, -type.w / 2 + 3, type.l * 0.2, type.w - 6, 4); // hood sheen
  ctx.fill();

  // Police livery and light bar; taxi sign; brake and tail lights.
  if (type.police) {
    ctx.fillStyle = '#20242c';
    roundRect(ctx, -type.l * 0.3, -type.w / 2, type.l * 0.52, type.w, 5);
    ctx.fill();
    const flash = Math.sin(G.time * 10 + (car.sirenPhase ?? 0)) > 0;
    ctx.fillStyle = flash ? '#ff4040' : '#7a1616';
    roundRect(ctx, -8, -type.w / 2 + 3, 9, type.w - 6, 2);
    ctx.fill();
    ctx.fillStyle = flash ? '#16507a' : '#3a7bd5';
    roundRect(ctx, 1, -type.w / 2 + 3, 9, type.w - 6, 2);
    ctx.fill();
  }
  if (type.name === 'Veloz Taxi') {
    ctx.fillStyle = '#20242c';
    roundRect(ctx, -6, -6, 12, 12, 2);
    ctx.fill();
    ctx.fillStyle = '#f5d13d';
    ctx.font = 'bold 8px system-ui, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('TAXI', 0, 0.5);
  }
  ctx.fillStyle = car.braking ? '#ff5b4d' : '#a02c22';
  ctx.fillRect(-type.l / 2 - 1, -type.w / 2 + 3, 3, 7);
  ctx.fillRect(-type.l / 2 - 1, type.w / 2 - 10, 3, 7);
  ctx.fillStyle = '#fff3c4';
  ctx.fillRect(type.l / 2 - 2, -type.w / 2 + 3, 3, 7);
  ctx.fillRect(type.l / 2 - 2, type.w / 2 - 10, 3, 7);

  ctx.restore();

  // A marker over the player's own car so it is never lost in traffic.
  if (G.player.car === car) {
    ctx.fillStyle = '#ffe66d';
    ctx.beginPath();
    ctx.moveTo(x, y - 34 + Math.sin(G.time * 4) * 3);
    ctx.lineTo(x - 7, y - 44 + Math.sin(G.time * 4) * 3);
    ctx.lineTo(x + 7, y - 44 + Math.sin(G.time * 4) * 3);
    ctx.closePath();
    ctx.fill();
  }
  if (G.missionCar === car) {
    ctx.strokeStyle = '#ff5fd0';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(x, y, 30 + Math.sin(G.time * 5) * 3, 0, Math.PI * 2); ctx.stroke();
  }
}

export function drawPeds(ctx, G) {
  const cam = G.cam;
  for (const ped of G.peds) {
    const x = ped.x - cam.x, y = ped.y - cam.y;
    if (x < -30 || y < -30 || x > VIEW_W + 30 || y > VIEW_H + 30) continue;
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath(); ctx.ellipse(x, y + 5, 8, 4, 0, 0, Math.PI * 2); ctx.fill();
    if (ped.state === 'down') {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(ped.angle);
      ctx.globalAlpha = clamp(1.6 - ped.downT * 0.05, 0.25, 1);
      ctx.fillStyle = ped.color;
      roundRect(ctx, -11, -5, 22, 10, 5);
      ctx.fill();
      ctx.fillStyle = ped.skin;
      ctx.beginPath(); ctx.arc(13, 0, 5, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      ctx.globalAlpha = 1;
      continue;
    }
    const stride = ped.state === 'flee' ? Math.sin(G.time * 14 + ped.x) * 3 : Math.sin(G.time * 7 + ped.x) * 2;
    ctx.fillStyle = '#2c2c34';
    ctx.fillRect(x - 5, y + 2 + Math.max(0, stride), 4, 6);
    ctx.fillRect(x + 1, y + 2 + Math.max(0, -stride), 4, 6);
    ctx.fillStyle = ped.color;
    ctx.beginPath(); ctx.arc(x, y - 1, 7.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = ped.skin;
    ctx.beginPath(); ctx.arc(x, y - 3, 4.6, 0, Math.PI * 2); ctx.fill();
  }
}

export function drawPlayer(ctx, G) {
  const p = G.player;
  if (p.car) return; // the car is drawn by drawCar
  const cam = G.cam;
  const x = p.x - cam.x, y = p.y - cam.y;
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath(); ctx.ellipse(x, y + 6, 9, 4.5, 0, 0, Math.PI * 2); ctx.fill();
  const moving = Math.hypot(p.vx ?? 0, p.vy ?? 0) > 12;
  const stride = moving ? Math.sin(G.time * 11) * 3.4 : 0;
  ctx.fillStyle = '#263238';
  ctx.fillRect(x - 5.5, y + 2 + Math.max(0, stride), 4.5, 7);
  ctx.fillRect(x + 1, y + 2 + Math.max(0, -stride), 4.5, 7);
  // Rio's teal jacket and cap.
  ctx.fillStyle = '#12b5a5';
  ctx.beginPath(); ctx.arc(x, y - 1, 8.4, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#f1c27d';
  ctx.beginPath(); ctx.arc(x, y - 3.5, 5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#e8490f';
  ctx.beginPath(); ctx.arc(x, y - 4.5, 5, Math.PI, Math.PI * 2); ctx.fill();
  // Aim: a short arm and the pistol toward the mouse when it is out.
  if (p.weapon === 'pistol') {
    const a = p.aim;
    ctx.strokeStyle = '#f1c27d';
    ctx.lineWidth = 3.4;
    ctx.beginPath();
    ctx.moveTo(x, y - 1);
    ctx.lineTo(x + Math.cos(a) * 11, y - 1 + Math.sin(a) * 11);
    ctx.stroke();
    ctx.fillStyle = '#22242a';
    ctx.fillRect(x + Math.cos(a) * 11 - 2, y - 1 + Math.sin(a) * 11 - 2, 5, 4);
  }
}

export function drawEffects(ctx, G) {
  const cam = G.cam;
  for (const t of G.tracers) {
    ctx.strokeStyle = `rgba(255,230,150,${clamp(t.life / 0.09, 0, 1)})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(t.x1 - cam.x, t.y1 - cam.y);
    ctx.lineTo(t.x2 - cam.x, t.y2 - cam.y);
    ctx.stroke();
  }
  for (const p of G.particles) {
    const a = 1 - p.life / p.max;
    ctx.globalAlpha = a * 0.8;
    ctx.fillStyle = p.color;
    const s = p.size * (p.grow ? 1 + p.life * 1.6 : 1);
    ctx.beginPath(); ctx.arc(p.x - cam.x, p.y - cam.y, s, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
  // Mission marker beacon.
  if (G.marker && G.mode === 'play') {
    const x = G.marker.x - cam.x, y = G.marker.y - cam.y;
    const pulse = 0.5 + Math.sin(G.time * 4) * 0.2;
    const g = ctx.createLinearGradient(0, y - 190, 0, y);
    g.addColorStop(0, 'rgba(255,214,64,0)');
    g.addColorStop(1, `rgba(255,214,64,${pulse * 0.5})`);
    ctx.fillStyle = g;
    ctx.fillRect(x - 13, y - 190, 26, 190);
    ctx.strokeStyle = '#ffd740';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(x, y, 20 + Math.sin(G.time * 4) * 3, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#ffd740';
    ctx.beginPath();
    ctx.moveTo(x, y - 34 + Math.sin(G.time * 4) * 3);
    ctx.lineTo(x - 8, y - 46 + Math.sin(G.time * 4) * 3);
    ctx.lineTo(x + 8, y - 46 + Math.sin(G.time * 4) * 3);
    ctx.closePath(); ctx.fill();
  }
  ctx.textAlign = 'center';
  for (const f of G.floaters) {
    ctx.globalAlpha = clamp(1.3 - f.life, 0, 1);
    ctx.font = 'bold 17px system-ui, sans-serif';
    ctx.fillStyle = f.color;
    ctx.fillText(f.text, f.x - cam.x, f.y - cam.y);
  }
  ctx.globalAlpha = 1;
}

// ---------------------------------------------------------------- HUD

function panel(ctx, x, y, w, h, alpha = 0.55) {
  ctx.fillStyle = `rgba(10,14,20,${alpha})`;
  roundRect(ctx, x, y, w, h, 8);
  ctx.fill();
}

function bar(ctx, x, y, w, h, frac, color) {
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  roundRect(ctx, x, y, w, h, h / 2);
  ctx.fill();
  if (frac > 0) {
    ctx.fillStyle = color;
    roundRect(ctx, x + 1.5, y + 1.5, Math.max(2, (w - 3) * clamp(frac, 0, 1)), h - 3, (h - 3) / 2);
    ctx.fill();
  }
}

export function drawMinimap(ctx, G) {
  const MW = 216, MH = 168, MX = 16, MY = VIEW_H - MH - 16;
  const sx = MW / G.world.w, sy = MH / G.world.h;
  panel(ctx, MX - 5, MY - 5, MW + 10, MH + 10, 0.62);
  ctx.save();
  ctx.beginPath();
  ctx.rect(MX, MY, MW, MH);
  ctx.clip();
  ctx.fillStyle = '#57743f';
  ctx.fillRect(MX, MY, MW, MH);
  // Sea and beach.
  ctx.fillStyle = '#2e7fa8';
  ctx.fillRect(MX + WATER_X * 48 * sx, MY, MW, MH);
  ctx.fillStyle = '#e6cf9a';
  ctx.fillRect(MX + SAND_X * 48 * sx, MY, (WATER_X - SAND_X) * 48 * sx, MH);
  // Roads.
  ctx.strokeStyle = 'rgba(240,238,225,0.85)';
  ctx.lineWidth = 2;
  for (const a of AVENUES) {
    ctx.beginPath();
    ctx.moveTo(MX + a * 48 * sx, MY);
    ctx.lineTo(MX + a * 48 * sx, MY + MH);
    ctx.stroke();
  }
  for (const s of STREETS) {
    ctx.beginPath();
    ctx.moveTo(MX, MY + s * 48 * sy);
    ctx.lineTo(MX + MW, MY + s * 48 * sy);
    ctx.stroke();
  }
  const dot = (x, y, color, r = 2.4) => {
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(MX + x * sx, MY + y * sy, r, 0, Math.PI * 2); ctx.fill();
  };
  for (const car of G.cars) {
    if (car.driver === 'cop') dot(car.x, car.y, Math.sin(G.time * 8) > 0 ? '#4da3ff' : '#ff5b4d', 2.6);
    else if (car.driver === 'traffic') dot(car.x, car.y, 'rgba(255,255,255,0.75)', 1.8);
  }
  if (G.missionCar) dot(G.missionCar.x, G.missionCar.y, '#ff5fd0', 3);
  if (G.marker) {
    const pulse = 3 + Math.sin(G.time * 5) * 1.2;
    dot(G.marker.x, G.marker.y, '#ffd740', pulse);
  }
  // Player arrow.
  const px = MX + G.player.x * sx, py = MY + G.player.y * sy;
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(G.player.car ? G.player.car.angle : G.player.angle);
  ctx.fillStyle = '#ffe66d';
  ctx.beginPath();
  ctx.moveTo(6, 0); ctx.lineTo(-4, -4); ctx.lineTo(-4, 4);
  ctx.closePath(); ctx.fill();
  ctx.restore();
  ctx.restore();
}

export function drawHUD(ctx, G) {
  const p = G.player;
  // Health and armour, top-left.
  panel(ctx, 14, 14, 232, 58);
  ctx.fillStyle = '#e8f0e8';
  ctx.font = 'bold 11px system-ui, sans-serif';
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  ctx.fillText('HEALTH', 24, 33);
  bar(ctx, 78, 23, 156, 12, p.hp / 100, p.hp > 30 ? '#69e58a' : '#ff5b4d');
  ctx.fillText('ARMOR', 24, 57);
  bar(ctx, 78, 47, 156, 12, p.armor / 100, '#5bb8ff');

  // Cash, stars and weapon, top-right.
  panel(ctx, VIEW_W - 264, 14, 250, 84);
  ctx.textAlign = 'right';
  ctx.fillStyle = '#69e58a';
  ctx.font = 'bold 25px system-ui, sans-serif';
  ctx.fillText(`$${p.cash.toLocaleString('en-US')}`, VIEW_W - 26, 44);
  ctx.font = '20px system-ui, sans-serif';
  let stars = '';
  for (let i = 0; i < 5; i++) stars += i < G.wanted.stars ? '★' : '☆';
  ctx.fillStyle = G.wanted.stars > 0 ? (Math.sin(G.time * 6) > -0.4 ? '#ffd740' : '#8a742a') : '#9aa3ab';
  ctx.fillText(stars, VIEW_W - 26, 70);
  ctx.font = 'bold 12px system-ui, sans-serif';
  ctx.fillStyle = '#dfe7ee';
  ctx.fillText(p.car ? CAR_TYPES[p.car.type].name.toUpperCase() : p.weapon.toUpperCase(), VIEW_W - 26, 90);

  // Bust meter while the police have hands on Rio.
  if (G.bust > 0.02) {
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ff5b4d';
    ctx.font = 'bold 16px system-ui, sans-serif';
    ctx.fillText('BUSTED?', VIEW_W / 2, VIEW_H - 128);
    bar(ctx, VIEW_W / 2 - 110, VIEW_H - 118, 220, 12, G.bust, '#ff5b4d');
  }

  // Objective, bottom-centre.
  if (G.objective) {
    ctx.font = 'bold 16px system-ui, sans-serif';
    const w = Math.min(760, ctx.measureText(G.objective).width + 44);
    panel(ctx, (VIEW_W - w) / 2, VIEW_H - 52, w, 36, 0.62);
    ctx.fillStyle = '#ffe66d';
    ctx.textAlign = 'center';
    ctx.fillText(G.objective, VIEW_W / 2, VIEW_H - 28);
  }

  // Dialogue / phone lines above the objective.
  ctx.textAlign = 'center';
  let dy = VIEW_H - 66;
  for (const line of G.dialog) {
    ctx.font = '15px system-ui, sans-serif';
    const w = Math.min(820, ctx.measureText(line.text).width + 36);
    panel(ctx, (VIEW_W - w) / 2, dy - 24, w, 30, 0.5);
    ctx.fillStyle = '#f2f5f7';
    ctx.fillText(line.text, VIEW_W / 2, dy - 4);
    dy -= 38;
  }

  drawMinimap(ctx, G);

  if (G.muted) {
    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.font = '12px system-ui, sans-serif';
    ctx.fillText('MUTED (M)', VIEW_W - 16, VIEW_H - 12);
  }
}

// ---------------------------------------------------------------- screens

function centerText(ctx, text, y, font, color) {
  ctx.font = font;
  ctx.textAlign = 'center';
  ctx.fillStyle = color;
  ctx.fillText(text, VIEW_W / 2, y);
}

export function drawTitle(ctx, G) {
  ctx.fillStyle = 'rgba(16,10,8,0.36)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  centerText(ctx, 'SOLANO HEAT', 208, 'bold 96px system-ui, sans-serif', '#ffd740');
  centerText(ctx, 'P O R T   S O L A N O', 252, 'bold 24px system-ui, sans-serif', '#ff9d5c');
  centerText(ctx, 'Rio Vargas just hit town with a fast hand, a borrowed name,', 330, '19px system-ui, sans-serif', '#f5efe2');
  centerText(ctx, 'and a garage full of people who pay cash for impossible drives.', 358, '19px system-ui, sans-serif', '#f5efe2');
  centerText(ctx, 'Work the jobs. Outrun the law. Own the streets.', 386, 'italic 17px system-ui, sans-serif', '#ffd9a0');
  const lines = [
    'WASD / Arrows — walk & drive        E or F — enter / exit car',
    'Shift — run        Mouse — aim        Click / Space — punch & shoot',
    '1 / 2 — fists / pistol        P or Esc — pause        M — mute',
  ];
  lines.forEach((line, i) => centerText(ctx, line, 452 + i * 28, '16px system-ui, sans-serif', '#dfe7ee'));
  centerText(ctx, G.hasSave ? 'ENTER — new game        C — continue (saved)' : 'PRESS ENTER TO PLAY', 584, 'bold 22px system-ui, sans-serif',
    Math.sin(G.time * 3) > -0.3 ? '#69e58a' : '#3f7a4e');
}

export function drawPause(ctx, G) {
  ctx.fillStyle = 'rgba(8,10,14,0.62)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  centerText(ctx, 'PAUSED', 330, 'bold 54px system-ui, sans-serif', '#ffd740');
  centerText(ctx, `Cash $${G.player.cash.toLocaleString('en-US')} — mission ${Math.min(G.mission.index + 1, 5)} of 5`, 380, '19px system-ui, sans-serif', '#f5efe2');
  centerText(ctx, 'P or Esc — resume        Progress saves after every job', 424, '16px system-ui, sans-serif', '#b9c4cc');
}

export function drawEndScreen(ctx, G, kind, amount) {
  ctx.fillStyle = kind === 'busted' ? 'rgba(20,30,70,0.55)' : 'rgba(70,12,12,0.55)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  centerText(ctx, kind === 'busted' ? 'BUSTED' : 'WASTED', 330, 'bold 84px system-ui, sans-serif', kind === 'busted' ? '#7db4ff' : '#ff6b5e');
  centerText(
    ctx,
    kind === 'busted'
      ? `The Port Solano PD took $${amount} in "processing fees". Rio walks free — poorer.`
      : `Rio wakes up at the hospital. The bill: $${amount}. The city keeps spinning.`,
    396, '19px system-ui, sans-serif', '#f5efe2',
  );
}

