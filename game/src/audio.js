// Procedural WebAudio only — no audio files. Engine hum, police siren,
// gunshots, pickup chimes and a simple bassline loop, all synthesized.
// Everything is guarded: nothing plays before the first user gesture,
// and M toggles mute.
import { PALETTE } from './config.js';

const BASSLINE = [55, 0, 55, 65.41, 0, 49, 55, 0, 55, 0, 73.42, 65.41, 49, 0, 58.27, 0];

export function createAudio() {
  let ctx = null;
  let master = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let sirenLfo = null;
  let muted = false;
  let bassStep = 0;
  let bassTimer = 0;
  let bassGain = null;

  function ensure() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      return true;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(ctx.destination);
      // Engine: a low sawtooth whose pitch follows the car's speed.
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 55;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      const engineFilter = ctx.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 320;
      engineOsc.connect(engineFilter);
      engineFilter.connect(engineGain);
      engineGain.connect(master);
      engineOsc.start();
      // Siren: a sine that wails between two tones.
      sirenOsc = ctx.createOscillator();
      sirenOsc.type = 'sine';
      sirenOsc.frequency.value = 720;
      sirenLfo = ctx.createOscillator();
      sirenLfo.type = 'square';
      sirenLfo.frequency.value = 0.55;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 160;
      sirenLfo.connect(lfoGain);
      lfoGain.connect(sirenOsc.frequency);
      sirenGain = ctx.createGain();
      sirenGain.gain.value = 0;
      sirenOsc.connect(sirenGain);
      sirenGain.connect(master);
      sirenOsc.start();
      sirenLfo.start();
      bassGain = ctx.createGain();
      bassGain.gain.value = 0.16;
      bassGain.connect(master);
      return true;
    } catch {
      ctx = null;
      return false;
    }
  }

  function noiseBurst(duration, filterFreq, volume) {
    if (!ctx || muted) return;
    const length = Math.max(1, Math.floor(ctx.sampleRate * duration));
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;
    const gain = ctx.createGain();
    gain.gain.value = volume;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    source.start();
  }

  function tone(freq, duration, type, volume, slideTo) {
    if (!ctx || muted) return;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), ctx.currentTime + duration);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(master);
    osc.start();
    osc.stop(ctx.currentTime + duration + 0.02);
  }

  return {
    ensure,
    get muted() { return muted; },
    setMuted(value) {
      muted = value;
      if (master) master.gain.value = muted ? 0 : 0.5;
    },
    /** Called every frame with the driving speed (0..1) and wanted level. */
    update(dt, speed01, wanted) {
      if (!ctx) return;
      if (engineGain) {
        engineGain.gain.value = muted ? 0 : 0.03 + speed01 * 0.05;
        engineOsc.frequency.value = 50 + speed01 * 110;
      }
      if (sirenGain) sirenGain.gain.value = muted || wanted === 0 ? 0 : 0.05 + wanted * 0.008;
      // Bassline: one step every 0.22 s, a soft triangle note.
      bassTimer += dt;
      while (bassTimer >= 0.22) {
        bassTimer -= 0.22;
        const freq = BASSLINE[bassStep % BASSLINE.length];
        bassStep += 1;
        if (freq > 0 && !muted) {
          const osc = ctx.createOscillator();
          osc.type = 'triangle';
          osc.frequency.value = freq;
          const gain = ctx.createGain();
          gain.gain.setValueAtTime(0.5, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
          osc.connect(gain);
          gain.connect(bassGain);
          osc.start();
          osc.stop(ctx.currentTime + 0.22);
        }
      }
    },
    shot() { noiseBurst(0.12, 1800, 0.5); tone(180, 0.08, 'square', 0.25, 60); },
    punch() { noiseBurst(0.08, 900, 0.35); },
    crash() { noiseBurst(0.25, 700, 0.6); tone(90, 0.2, 'sine', 0.4, 40); },
    chime() { tone(880, 0.12, 'sine', 0.3); tone(1318, 0.18, 'sine', 0.25); },
    phone() { tone(1200, 0.09, 'square', 0.18); setTimeout(() => tone(1200, 0.09, 'square', 0.18), 140); },
    missionDone() {
      tone(523, 0.14, 'triangle', 0.3);
      setTimeout(() => tone(659, 0.14, 'triangle', 0.3), 130);
      setTimeout(() => tone(784, 0.26, 'triangle', 0.3), 260);
    },
    busted() { tone(440, 0.3, 'sawtooth', 0.25, 220); tone(330, 0.4, 'sawtooth', 0.2, 180); },
  };
}

// Referenced only to keep the palette import honest in bundlers that drop
// unused imports; the audio module's colours are the same golden-hour set.
export const AUDIO_ACCENT = PALETTE.gold;
