// SOLANO HEAT — procedural WebAudio sound. No audio files: an engine hum
// whose pitch follows speed, a two-tone siren, noise-burst gunshots, thuds,
// chimes, and a little bassline loop while driving. Everything is created
// lazily on the first user gesture and every call is guarded, so the game
// runs silent (and safely) where audio is unavailable.

let ctx = null;
let master = null;
let muted = false;
let engineOsc = null;
let engineGain = null;
let sirenOsc = null;
let sirenGain = null;
let sirenTimer = 0;
let bassTimer = 0;
let bassStep = 0;

export function initAudio() {
  if (ctx) {
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return;
  }
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain();
    master.gain.value = 0.35;
    master.connect(ctx.destination);
  } catch {
    ctx = null;
  }
}

export function toggleMute() {
  muted = !muted;
  if (master && ctx) master.gain.value = muted ? 0 : 0.35;
  return muted;
}

export function isMuted() {
  return muted;
}

function env(gainNode, t0, peak, dur) {
  gainNode.gain.setValueAtTime(0, t0);
  gainNode.gain.linearRampToValueAtTime(peak, t0 + 0.008);
  gainNode.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
}

function blip(freq, dur, type = 'square', peak = 0.2) {
  if (!ctx || muted) return;
  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  env(g, t, peak, dur);
  osc.connect(g).connect(master);
  osc.start(t);
  osc.stop(t + dur + 0.05);
}

function noise(dur, peak = 0.3, freq = 1200) {
  if (!ctx || muted) return;
  const t = ctx.currentTime;
  const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
  const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = freq;
  const g = ctx.createGain();
  env(g, t, peak, dur);
  src.connect(filter).connect(g).connect(master);
  src.start(t);
}

export const sfx = {
  shot() { noise(0.14, 0.35, 2600); blip(160, 0.08, 'sawtooth', 0.12); },
  punch() { noise(0.08, 0.25, 500); },
  crash(big) { noise(big ? 0.35 : 0.18, big ? 0.4 : 0.22, 700); },
  pickup() { blip(880, 0.1, 'sine', 0.22); setTimeout(() => blip(1320, 0.14, 'sine', 0.2), 60); },
  cash() { blip(1560, 0.07, 'square', 0.15); setTimeout(() => blip(2090, 0.12, 'square', 0.13), 55); },
  door() { blip(220, 0.07, 'sine', 0.18); },
  bust() { blip(392, 0.18, 'square', 0.2); setTimeout(() => blip(311, 0.3, 'square', 0.2), 140); },
  mission() { blip(660, 0.1, 'triangle', 0.22); setTimeout(() => blip(990, 0.16, 'triangle', 0.2), 90); },
  phone() { blip(1175, 0.09, 'sine', 0.16); setTimeout(() => blip(1175, 0.09, 'sine', 0.16), 130); },
};

/** Engine hum: speed 0..1 while the player drives, null to stop. */
export function setEngine(speed) {
  if (!ctx) return;
  if (speed === null) {
    if (engineGain && ctx) engineGain.gain.setTargetAtTime(0, ctx.currentTime, 0.08);
    return;
  }
  if (!engineOsc) {
    engineOsc = ctx.createOscillator();
    engineGain = ctx.createGain();
    engineOsc.type = 'sawtooth';
    engineGain.gain.value = 0;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 500;
    engineOsc.connect(filter).connect(engineGain).connect(master);
    engineOsc.start();
  }
  engineOsc.frequency.setTargetAtTime(55 + speed * 165, ctx.currentTime, 0.06);
  engineGain.gain.setTargetAtTime(muted ? 0 : 0.05 + speed * 0.05, ctx.currentTime, 0.08);
}

/** Police siren near the player: on/off, wails while on. */
export function setSiren(on, dt) {
  if (!ctx) return;
  if (!on) {
    if (sirenGain && ctx) sirenGain.gain.setTargetAtTime(0, ctx.currentTime, 0.1);
    return;
  }
  if (!sirenOsc) {
    sirenOsc = ctx.createOscillator();
    sirenGain = ctx.createGain();
    sirenOsc.type = 'triangle';
    sirenGain.gain.value = 0;
    sirenOsc.connect(sirenGain).connect(master);
    sirenOsc.start();
  }
  sirenTimer += dt;
  const phase = Math.sin(sirenTimer * 4.2) > 0 ? 880 : 660;
  sirenOsc.frequency.setTargetAtTime(phase, ctx.currentTime, 0.03);
  sirenGain.gain.setTargetAtTime(muted ? 0 : 0.035, ctx.currentTime, 0.1);
}

const BASSLINE = [55, 0, 55, 0, 65.4, 0, 55, 0, 49, 0, 49, 0, 73.4, 0, 61.7, 0];

/** A slow bass loop while driving; call every step with dt. */
export function driveMusic(dt, driving) {
  if (!ctx || muted || !driving) return;
  bassTimer -= dt;
  if (bassTimer > 0) return;
  bassTimer = 0.21;
  const note = BASSLINE[bassStep % BASSLINE.length];
  bassStep++;
  if (note) blip(note * 2, 0.19, 'triangle', 0.16);
}
