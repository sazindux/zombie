import type { WeaponId } from './types';

const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);

/** Fully synthesized sound effects — no audio files required. */
export class Sfx {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noiseBuf: AudioBuffer | null = null;
  private ambGain: GainNode | null = null;
  muted = false;
  private lastHit = 0;
  private lastGroan = 0;
  private lastDeath = 0;

  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.65;
    const comp = this.ctx.createDynamicsCompressor();
    this.master.connect(comp);
    comp.connect(this.ctx.destination);
    // 2s of white noise reused by every noise effect
    const len = this.ctx.sampleRate * 2;
    this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.startAmbient();
  }

  setMuted(m: boolean) {
    this.muted = m;
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(m ? 0 : 0.65, this.ctx.currentTime, 0.05);
  }

  setAmbient(on: boolean) {
    if (this.ambGain && this.ctx) this.ambGain.gain.setTargetAtTime(on ? 0.06 : 0.0, this.ctx.currentTime, 0.6);
  }

  private startAmbient() {
    if (!this.ctx || !this.master || !this.noiseBuf) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 280;
    const lfo = this.ctx.createOscillator();
    lfo.frequency.value = 0.09;
    const lfoG = this.ctx.createGain();
    lfoG.gain.value = 120;
    lfo.connect(lfoG);
    lfoG.connect(lp.frequency);
    lfo.start();
    this.ambGain = this.ctx.createGain();
    this.ambGain.gain.value = 0;
    src.connect(lp);
    lp.connect(this.ambGain);
    this.ambGain.connect(this.master);
    src.start();
    // low drone
    const o = this.ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.value = 41;
    const og = this.ctx.createGain();
    og.gain.value = 0.12;
    const olp = this.ctx.createBiquadFilter();
    olp.type = 'lowpass';
    olp.frequency.value = 120;
    o.connect(olp);
    olp.connect(og);
    og.connect(this.ambGain);
    o.start();
  }

  private out(pan: number): AudioNode | null {
    if (!this.ctx || !this.master) return null;
    if (pan !== 0 && this.ctx.createStereoPanner) {
      const p = this.ctx.createStereoPanner();
      p.pan.value = clamp(pan, -1, 1);
      p.connect(this.master);
      return p;
    }
    return this.master;
  }

  private tone(
    type: OscillatorType, f0: number, f1: number, dur: number, vol: number,
    delay = 0, pan = 0, lp = 0,
  ) {
    const c = this.ctx;
    const out = this.out(pan);
    if (!c || !out) return;
    const t = c.currentTime + delay;
    const o = c.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(Math.max(1, f0), t);
    o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let node: AudioNode = o;
    if (lp) {
      const f = c.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = lp;
      o.connect(f);
      node = f;
    }
    node.connect(g);
    g.connect(out);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  private noise(
    dur: number, ft: BiquadFilterType, f0: number, f1: number, vol: number,
    delay = 0, pan = 0, q = 1,
  ) {
    const c = this.ctx;
    const out = this.out(pan);
    if (!c || !out || !this.noiseBuf) return;
    const t = c.currentTime + delay;
    const s = c.createBufferSource();
    s.buffer = this.noiseBuf;
    const f = c.createBiquadFilter();
    f.type = ft;
    f.Q.value = q;
    f.frequency.setValueAtTime(Math.max(20, f0), t);
    f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(Math.max(0.0002, vol), t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f);
    f.connect(g);
    g.connect(out);
    s.start(t, Math.random() * 1.5);
    s.stop(t + dur + 0.05);
  }

  shot(id: WeaponId) {
    switch (id) {
      case 'pistol':
        this.noise(0.12, 'bandpass', 2400, 500, 0.55, 0, 0, 0.8);
        this.tone('square', 220, 60, 0.1, 0.35);
        break;
      case 'smg':
        this.noise(0.09, 'bandpass', 3000, 700, 0.5, 0, 0, 0.8);
        this.tone('square', 260, 80, 0.07, 0.3);
        break;
      case 'shotgun':
        this.noise(0.4, 'lowpass', 3500, 200, 0.95);
        this.tone('sawtooth', 120, 35, 0.3, 0.55);
        this.tone('square', 900, 700, 0.03, 0.2, 0.42);
        this.noise(0.05, 'highpass', 2000, 4000, 0.3, 0.45);
        this.noise(0.05, 'highpass', 2500, 4500, 0.3, 0.55);
        break;
      case 'rifle':
        this.noise(0.14, 'bandpass', 1800, 400, 0.65, 0, 0, 0.7);
        this.tone('sawtooth', 170, 50, 0.12, 0.45, 0, 0, 900);
        break;
      case 'sniper':
        this.noise(0.55, 'lowpass', 5000, 150, 1.0);
        this.tone('sawtooth', 100, 28, 0.5, 0.6);
        this.noise(0.04, 'highpass', 3000, 6000, 0.5, 0.0);
        this.tone('square', 600, 400, 0.04, 0.2, 0.55);
        break;
      case 'launcher':
        this.noise(0.6, 'lowpass', 1200, 100, 0.8);
        this.tone('sawtooth', 90, 30, 0.45, 0.5);
        break;
    }
  }

  dry() {
    this.tone('square', 1200, 800, 0.025, 0.18);
  }

  reload() {
    this.tone('square', 900, 500, 0.04, 0.22);
    this.noise(0.05, 'highpass', 3000, 5000, 0.2, 0);
    this.tone('square', 600, 400, 0.05, 0.22, 0.28);
    this.noise(0.06, 'bandpass', 2000, 1000, 0.3, 0.28);
  }

  reloadDone() {
    this.tone('square', 1100, 700, 0.035, 0.25);
    this.noise(0.05, 'highpass', 4000, 6000, 0.3);
  }

  switchWeapon() {
    this.tone('square', 500, 300, 0.04, 0.15);
    this.noise(0.04, 'bandpass', 2500, 1500, 0.15);
  }

  hit() {
    const now = performance.now();
    if (now - this.lastHit < 35) return;
    this.lastHit = now;
    this.noise(0.09, 'lowpass', 1100, 250, 0.35);
    this.tone('sine', 140, 60, 0.08, 0.3);
  }

  zdeath(vol = 1, pan = 0) {
    const now = performance.now();
    if (now - this.lastDeath < 50) return;
    this.lastDeath = now;
    this.tone('sawtooth', 170, 45, 0.4, 0.2 * vol, 0, pan, 500);
    this.noise(0.22, 'lowpass', 1400, 150, 0.45 * vol, 0, pan);
  }

  groan(vol: number, pan: number, big = false) {
    const c = this.ctx;
    const out = this.out(pan);
    if (!c || !out) return;
    const now = performance.now();
    if (now - this.lastGroan < 140) return;
    this.lastGroan = now;
    const t = c.currentTime;
    const base = (big ? 55 : 70 + Math.random() * 50) * (0.9 + Math.random() * 0.3);
    const dur = big ? 1.4 : 0.7 + Math.random() * 0.6;
    const o = c.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(base * 1.25, t);
    o.frequency.linearRampToValueAtTime(base * 0.7, t + dur);
    const lfo = c.createOscillator();
    lfo.frequency.value = 5 + Math.random() * 3;
    const lg = c.createGain();
    lg.gain.value = base * 0.07;
    lfo.connect(lg);
    lg.connect(o.frequency);
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(350, t);
    f.frequency.linearRampToValueAtTime(700, t + dur * 0.4);
    f.frequency.linearRampToValueAtTime(250, t + dur);
    f.Q.value = 4;
    const g = c.createGain();
    const v = Math.max(0.001, 0.2 * vol);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(v, t + dur * 0.25);
    g.gain.linearRampToValueAtTime(0.0001, t + dur);
    o.connect(f);
    f.connect(g);
    g.connect(out);
    o.start(t);
    lfo.start(t);
    o.stop(t + dur + 0.05);
    lfo.stop(t + dur + 0.05);
  }

  hurt() {
    this.noise(0.18, 'lowpass', 1500, 200, 0.6);
    this.tone('sawtooth', 220, 90, 0.2, 0.35, 0, 0, 800);
  }

  explosion(vol = 1) {
    this.noise(1.1, 'lowpass', 1800, 50, 1.0 * vol);
    this.tone('sine', 80, 22, 0.9, 0.9 * vol);
    this.noise(0.3, 'bandpass', 800, 200, 0.5 * vol, 0.05);
  }

  pickup() {
    this.tone('sine', 660, 880, 0.09, 0.25);
    this.tone('sine', 880, 1320, 0.14, 0.25, 0.08);
  }

  power() {
    this.tone('triangle', 300, 900, 0.3, 0.3);
    this.tone('triangle', 450, 1350, 0.3, 0.2, 0.1);
  }

  buy() {
    this.tone('square', 1200, 1200, 0.05, 0.15);
    this.tone('square', 1800, 1800, 0.09, 0.15, 0.06);
  }

  denied() {
    this.tone('square', 160, 120, 0.15, 0.25);
  }

  click() {
    this.tone('square', 700, 500, 0.03, 0.15);
  }

  waveStart() {
    this.tone('sawtooth', 110, 104, 1.6, 0.35, 0, 0, 600);
    this.tone('sawtooth', 113, 106, 1.6, 0.3, 0, 0, 600);
    this.tone('sawtooth', 55, 52, 1.8, 0.4, 0, 0, 300);
  }

  waveClear() {
    this.tone('triangle', 523, 523, 0.18, 0.28);
    this.tone('triangle', 659, 659, 0.18, 0.28, 0.14);
    this.tone('triangle', 784, 784, 0.4, 0.28, 0.28);
  }

  boss() {
    this.tone('sawtooth', 60, 30, 1.6, 0.7, 0, 0, 400);
    this.noise(1.4, 'lowpass', 600, 80, 0.6);
    this.tone('sawtooth', 90, 40, 1.2, 0.4, 0.1, 0, 300);
  }

  spit() {
    this.noise(0.22, 'bandpass', 2200, 700, 0.35, 0, 0, 2);
    this.tone('sine', 500, 200, 0.18, 0.2);
  }

  pin() {
    this.tone('square', 1500, 1500, 0.02, 0.15);
    this.tone('sine', 400, 250, 0.15, 0.15, 0.03);
  }

  heartbeat() {
    this.tone('sine', 62, 38, 0.14, 0.7);
    this.tone('sine', 56, 34, 0.16, 0.55, 0.17);
  }

  slam() {
    this.tone('sine', 90, 25, 0.5, 0.9);
    this.noise(0.5, 'lowpass', 700, 60, 0.8);
  }

  nuke() {
    this.noise(1.6, 'lowpass', 3000, 40, 1.0);
    this.tone('sine', 100, 18, 1.4, 1.0);
    this.tone('sawtooth', 400, 40, 1.2, 0.3, 0, 0, 800);
  }

  death() {
    this.tone('sawtooth', 200, 30, 1.6, 0.4, 0, 0, 500);
    this.tone('sine', 70, 20, 1.5, 0.6);
  }
}
