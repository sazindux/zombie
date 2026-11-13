import { buildShop, MAX_GRENADES, WEAPON_ORDER, WEAPONS, WORLD_H, WORLD_W, ZOMBIES } from './config';
import { Sfx } from './audio';
import { Input } from './input';
import {
  BORDER, CENTER, genObstacles, makeCanvas, mulberry32, paintGround, ROAD_H, ROAD_V,
  type Barrel, type Lamp, type Rect,
} from './world';
import {
  drawBarrel, drawCorpse, drawEyes, drawLampPost, drawMuzzleFlash, drawObstacle, drawPickup, drawPlayer,
  drawZombie, pickupColor,
} from './sprites';
import type {
  Blast, Bullet, Floater, GameCallbacks, Grenade, HudSnapshot, Particle, ParticleKind, Phase, Pickup,
  PickupKind, Player, PowerId, Spit, UpgradeId, WeaponId, Zombie, ZType,
} from './types';

const TAU = Math.PI * 2;
const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
const angDiff = (a: number, b: number) => {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
};
const pick = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];

const BLOOD = ['#7a0c0c', '#8e1111', '#600808', '#a01414'];
const BEST_KEY = 'dead-sector-best-v1';
const LIGHT_RES = 0.5;

type WaveState = 'intro' | 'active' | 'clear';

export class Game {
  phase: Phase = 'menu';
  readonly sfx = new Sfx();
  readonly input: Input;

  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private light: HTMLCanvasElement;
  private lctx: CanvasRenderingContext2D;
  private ground: HTMLCanvasElement;
  private blood: HTMLCanvasElement;
  private bctx: CanvasRenderingContext2D;
  private cb: GameCallbacks;

  private cssW = 1280;
  private cssH = 720;
  private dpr = 1;
  private scale = 1;
  private vw = 1400;
  private vh = 800;
  private cam = { x: 0, y: 0 };
  private shakeAmt = 0;
  private kickX = 0;
  private kickY = 0;
  private aim = { x: 0, y: 0 };

  private t = 0; // render clock
  private playTime = 0;
  private player!: Player;
  private zombies: Zombie[] = [];
  private bullets: Bullet[] = [];
  private spits: Spit[] = [];
  private nades: Grenade[] = [];
  private parts: Particle[] = [];
  private pickups: Pickup[] = [];
  private blasts: Blast[] = [];
  private floaters: Floater[] = [];
  private rects: Rect[] = [];
  private barrels: Barrel[] = [];
  private lamps: Lamp[] = [];

  private wave = 0;
  private waveState: WaveState = 'intro';
  private waveT = 0;
  private queue: ZType[] = [];
  private spawnT = 0;
  private nextId = 1;
  private kills = 0;
  private score = 0;
  private points = 0;
  private combo = 0;
  private comboT = 0;
  private banner: HudSnapshot['banner'] = null;
  private bannerId = 0;
  private dying = false;
  private deathT = 0;
  private flashA = 0;
  private hudT = 0;
  private best = 0;
  private newBest = false;
  private minimapW = 168;

  private raf = 0;
  private last = 0;
  private destroyed = false;

  constructor(canvas: HTMLCanvasElement, cb: GameCallbacks) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.cb = cb;
    this.light = makeCanvas(2, 2);
    this.lctx = this.light.getContext('2d')!;
    this.ground = paintGround();
    this.blood = makeCanvas(WORLD_W, WORLD_H);
    this.bctx = this.blood.getContext('2d')!;
    this.input = new Input(canvas);
    try {
      this.best = Number(localStorage.getItem(BEST_KEY)) || 0;
    } catch {
      this.best = 0;
    }
    this.resize();
    window.addEventListener('resize', this.resize);
    window.addEventListener('blur', this.onBlur);
    document.addEventListener('visibilitychange', this.onBlur);
    this.newWorld();
    this.initPlayer();
    this.enterMenu();
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.loop);
  }

  destroy() {
    this.destroyed = true;
    cancelAnimationFrame(this.raf);
    window.removeEventListener('resize', this.resize);
    window.removeEventListener('blur', this.onBlur);
    document.removeEventListener('visibilitychange', this.onBlur);
    this.input.destroy();
    this.sfx.setAmbient(false);
  }

  // ───────────────────────── public API ─────────────────────────

  startGame() {
    this.sfx.init();
    this.sfx.click();
    this.newWorld();
    this.initPlayer();
    this.wave = 0;
    this.kills = 0;
    this.score = 0;
    this.points = 0;
    this.combo = 0;
    this.comboT = 0;
    this.playTime = 0;
    this.dying = false;
    this.deathT = 0;
    this.newBest = false;
    this.banner = null;
    this.input.reset();
    this.cam.x = clamp(this.player.x - this.vw / 2, 0, WORLD_W - this.vw);
    this.cam.y = clamp(this.player.y - this.vh / 2, 0, WORLD_H - this.vh);
    this.setPhase('playing');
    this.sfx.setAmbient(true);
    this.startWave();
    this.emitHud();
  }

  goMenu() {
    this.sfx.click();
    this.enterMenu();
  }

  pause() {
    if (this.phase !== 'playing' || this.dying) return;
    this.input.reset();
    this.setPhase('paused');
    this.emitHud();
  }

  resume() {
    if (this.phase !== 'paused') return;
    this.sfx.init();
    this.input.reset();
    this.last = performance.now();
    this.setPhase('playing');
  }

  nextWave() {
    if (this.phase !== 'shop') return;
    this.sfx.click();
    const p = this.player;
    p.hp = Math.min(p.maxHp, p.hp + 15);
    this.input.reset();
    this.setPhase('playing');
    this.startWave();
    this.emitHud();
  }

  toggleMute() {
    this.sfx.init();
    this.sfx.setMuted(!this.sfx.muted);
    this.emitHud();
  }

  selectWeapon(id: WeaponId) {
    const p = this.player;
    if (p.dead || !p.ws[id].owned || p.weapon === id) return;
    if (this.phase !== 'playing' && this.phase !== 'shop') return;
    p.last = p.weapon;
    p.weapon = id;
    p.reloading = false;
    p.fireCd = Math.max(p.fireCd, 0.2);
    this.sfx.switchWeapon();
    this.emitHud(true);
  }

  buy(id: string): boolean {
    if (this.phase !== 'shop') return false;
    const snap = this.snapshot();
    const item = buildShop(snap).find((i) => i.id === id);
    if (!item || item.state !== 'ok') return false;
    if (this.points < item.cost) {
      this.sfx.denied();
      return false;
    }
    const p = this.player;
    const [kind, arg] = id.split(':');
    if (kind === 'weapon') {
      const w = WEAPONS[arg as WeaponId];
      const s = p.ws[arg as WeaponId];
      s.owned = true;
      s.ammo = w.mag;
      s.reserve = w.pack;
      p.last = p.weapon;
      p.weapon = arg as WeaponId;
    } else if (kind === 'ammo') {
      const w = WEAPONS[arg as WeaponId];
      const s = p.ws[arg as WeaponId];
      s.reserve = Math.min(w.maxReserve, s.reserve + w.pack);
    } else if (id === 'medkit') {
      p.hp = Math.min(p.maxHp, p.hp + 50);
    } else if (id === 'grenades') {
      p.grenades = Math.min(MAX_GRENADES, p.grenades + 3);
    } else if (kind === 'upgrade') {
      const u = arg as UpgradeId;
      p.up[u]++;
      if (u === 'vitality') {
        p.maxHp += 20;
        p.hp = Math.min(p.maxHp, p.hp + 20);
      }
    }
    this.points -= item.cost;
    this.sfx.buy();
    this.emitHud(true);
    return true;
  }

  snapshot(): HudSnapshot {
    const p = this.player;
    const boss = this.zombies.find((z) => z.type === 'boss' && !z.dead);
    return {
      hp: Math.max(0, p.hp),
      maxHp: p.maxHp,
      stamina: p.stamina,
      points: this.points,
      score: this.score,
      wave: this.wave,
      kills: this.kills,
      remaining: this.queue.length + this.zombies.filter((z) => !z.dead).length,
      combo: this.combo,
      comboT: clamp(this.comboT / 3, 0, 1),
      weapon: p.weapon,
      weapons: {
        pistol: { ...p.ws.pistol },
        smg: { ...p.ws.smg },
        shotgun: { ...p.ws.shotgun },
        rifle: { ...p.ws.rifle },
        sniper: { ...p.ws.sniper },
        launcher: { ...p.ws.launcher },
      },
      reload: p.reloading ? clamp(p.reloadT / p.reloadTime, 0, 1) : -1,
      grenades: p.grenades,
      upgrades: { ...p.up },
      powerups: (['damage', 'rapid'] as PowerId[])
        .filter((id) => p.power[id] > 0)
        .map((id) => ({ id, t: p.power[id] / 15 })),
      boss: boss ? { hp: boss.hp, max: boss.maxHp, name: ZOMBIES.boss.name } : null,
      banner: this.banner,
      time: this.playTime,
      hurt: p.hurt,
      muted: this.sfx.muted,
      over: { score: this.score, wave: this.wave, kills: this.kills, time: this.playTime, best: this.best, newBest: this.newBest },
    };
  }

  // ───────────────────────── setup ─────────────────────────

  private resize = () => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.cssW = w;
    this.cssH = h;
    this.dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    let s = clamp(w / 1400, 0.62, 1.5);
    s = Math.max(s, w / WORLD_W, h / WORLD_H);
    this.scale = s;
    this.vw = w / s;
    this.vh = h / s;
    this.canvas.width = Math.floor(w * this.dpr);
    this.canvas.height = Math.floor(h * this.dpr);
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
    this.light.width = Math.max(2, Math.floor(this.canvas.width * LIGHT_RES));
    this.light.height = Math.max(2, Math.floor(this.canvas.height * LIGHT_RES));
    this.minimapW = w < 700 ? 112 : 168;
  };

  private onBlur = () => {
    if (this.phase === 'playing') this.pause();
  };

  private setPhase(p: Phase) {
    this.phase = p;
    this.canvas.style.cursor = p === 'playing' ? 'none' : 'default';
    this.cb.onPhase(p);
  }

  private newWorld() {
    const gen = genObstacles(mulberry32((Math.random() * 1e9) | 0));
    this.rects = gen.rects;
    this.barrels = gen.barrels;
    this.lamps = gen.lamps;
    this.bctx.clearRect(0, 0, WORLD_W, WORLD_H);
    this.zombies = [];
    this.bullets = [];
    this.spits = [];
    this.nades = [];
    this.parts = [];
    this.pickups = [];
    this.blasts = [];
    this.floaters = [];
    this.queue = [];
    this.shakeAmt = 0;
    this.flashA = 0;
  }

  private initPlayer() {
    const ws = {} as Player['ws'];
    for (const id of WEAPON_ORDER) {
      const w = WEAPONS[id];
      ws[id] = { owned: id === 'pistol', ammo: w.mag, reserve: id === 'pistol' ? Infinity : 0 };
    }
    this.player = {
      x: CENTER.x, y: CENTER.y + 30, r: 14, vx: 0, vy: 0, angle: -Math.PI / 2,
      hp: 100, maxHp: 100, stamina: 100, exhausted: false, staminaDelay: 0, sprinting: false,
      weapon: 'pistol', last: 'pistol', ws, fireCd: 0, trig: false, reloading: false, reloadT: 0, reloadTime: 1,
      grenades: 2, flash: 0, hurt: 0, iframes: 0, walk: 0, dead: false,
      up: { vitality: 0, firepower: 0, agility: 0, hands: 0 },
      power: { damage: 0, rapid: 0 }, kick: 0, hitMarker: 0, heartT: 0, slow: 0,
    };
  }

  private enterMenu() {
    this.newWorld();
    this.initPlayer();
    this.player.dead = true; // hidden in menu
    this.dying = false;
    for (let i = 0; i < 20; i++) {
      const types: ZType[] = ['walker', 'walker', 'walker', 'runner', 'bloater', 'brute', 'spitter'];
      const a = rnd(0, TAU);
      const d = rnd(150, 900);
      const z = this.makeZombie(pick(types), CENTER.x + Math.cos(a) * d, CENTER.y + Math.sin(a) * d * 0.7);
      this.collide(z, z.r);
      z.tx = CENTER.x + rnd(-700, 700);
      z.ty = CENTER.y + rnd(-450, 450);
      z.speed *= 0.6;
      this.zombies.push(z);
    }
    this.sfx.setAmbient(false);
    this.setPhase('menu');
    this.emitHud(true);
  }

  // ───────────────────────── main loop ─────────────────────────

  private loop = (now: number) => {
    if (this.destroyed) return;
    const rdt = Math.min(0.05, Math.max(0, (now - this.last) / 1000));
    this.last = now;
    this.t += rdt;
    this.globalKeys();
    switch (this.phase) {
      case 'menu':
        this.updateMenu(rdt);
        break;
      case 'playing': {
        if (this.dying) {
          this.deathT += rdt;
          if (this.deathT > 2.4) this.gameOver();
        }
        this.update(rdt * (this.dying ? 0.4 : 1));
        break;
      }
      case 'shop':
      case 'gameover':
        this.updateIdle(rdt);
        break;
      default:
        break;
    }
    this.render();
    this.input.endFrame();
    this.hudT -= rdt;
    if (this.hudT <= 0) {
      this.hudT = 0.07;
      this.emitHud(true);
    }
    this.raf = requestAnimationFrame(this.loop);
  };

  private emitHud(_force = false) {
    this.cb.onHud(this.snapshot());
  }

  private globalKeys() {
    const k = this.input.pressed;
    if (k.has('KeyM')) this.toggleMute();
    if (k.has('Escape') || k.has('KeyP')) {
      if (this.phase === 'playing') this.pause();
      else if (this.phase === 'paused') this.resume();
    }
    if (k.has('Enter') || k.has('Space')) {
      if (this.phase === 'shop') this.nextWave();
      else if (this.phase === 'menu' || this.phase === 'gameover') {
        if (k.has('Enter')) this.startGame();
      }
    }
  }

  private updateMenu(dt: number) {
    const a = this.t * 0.12;
    this.cam.x = clamp(CENTER.x + Math.cos(a) * 280 - this.vw / 2, 0, WORLD_W - this.vw);
    this.cam.y = clamp(CENTER.y + Math.sin(a * 1.3) * 160 - this.vh / 2, 0, WORLD_H - this.vh);
    this.updateZombies(dt, true);
    this.zombies = this.zombies.filter((z) => !z.dead);
    this.updateParticles(dt);
  }

  private updateIdle(dt: number) {
    this.updateParticles(dt);
    this.updateFloaters(dt);
    this.updateBlasts(dt);
    this.shakeAmt *= Math.exp(-dt * 8);
    this.flashA = Math.max(0, this.flashA - dt * 2);
    this.player.hurt = Math.max(0, this.player.hurt - dt * 2);
    this.player.flash = 0;
  }

  // ───────────────────────── update ─────────────────────────

  private update(dt: number) {
    this.playTime += dt;
    this.updateCamera(dt);
    this.updateWave(dt);
    this.updatePlayer(dt);
    this.updateZombies(dt, false);
    this.updateBullets(dt);
    this.updateSpits(dt);
    this.updateNades(dt);
    this.updateBarrels(dt);
    this.updatePickups(dt);
    this.updateParticles(dt);
    this.updateFloaters(dt);
    this.updateBlasts(dt);
    this.zombies = this.zombies.filter((z) => !z.dead);
    this.shakeAmt *= Math.exp(-dt * 8);
    this.kickX *= Math.exp(-dt * 12);
    this.kickY *= Math.exp(-dt * 12);
    this.flashA = Math.max(0, this.flashA - dt * 1.6);
    if (this.comboT > 0) {
      this.comboT -= dt;
      if (this.comboT <= 0) this.combo = 0;
    }
  }

  private updateCamera(dt: number) {
    const p = this.player;
    let ox = 0;
    let oy = 0;
    if (this.input.touchMode) {
      const a = this.input.aimVec();
      if (a) {
        ox = Math.cos(a.angle) * 120;
        oy = Math.sin(a.angle) * 120;
      }
    } else {
      ox = ((this.input.mouse.x - this.cssW / 2) / this.scale) * 0.28;
      oy = ((this.input.mouse.y - this.cssH / 2) / this.scale) * 0.28;
    }
    const tx = p.x + ox - this.vw / 2;
    const ty = p.y + oy - this.vh / 2;
    const k = 1 - Math.exp(-dt * 7);
    this.cam.x += (tx - this.cam.x) * k;
    this.cam.y += (ty - this.cam.y) * k;
    this.cam.x = clamp(this.cam.x, 0, WORLD_W - this.vw);
    this.cam.y = clamp(this.cam.y, 0, WORLD_H - this.vh);
  }

  private updateWave(dt: number) {
    if (this.dying) return;
    if (this.waveState === 'intro') {
      this.waveT -= dt;
      if (this.waveT <= 0) {
        this.waveState = 'active';
        this.spawnT = 0;
      }
    } else if (this.waveState === 'active') {
      this.spawnT -= dt;
      const alive = this.zombies.reduce((n, z) => n + (z.dead ? 0 : 1), 0);
      const cap = Math.min(16 + this.wave * 3, 55);
      if (this.queue.length && alive < cap && this.spawnT <= 0) {
        this.spawnZombie(this.queue.shift()!);
        this.spawnT = Math.max(0.22, 1.0 - this.wave * 0.05) * rnd(0.6, 1.2);
      }
      if (!this.queue.length && alive === 0) {
        this.waveState = 'clear';
        this.waveT = 2.4;
        const bonus = 50 + this.wave * 25;
        this.points += bonus;
        this.score += bonus;
        this.showBanner('WAVE CLEARED', `+${bonus} bonus points`);
        this.sfx.waveClear();
      }
    } else {
      this.waveT -= dt;
      if (this.waveT <= 0) {
        this.setPhase('shop');
        this.input.reset();
        this.emitHud(true);
      }
    }
  }

  private startWave() {
    this.wave++;
    this.waveState = 'intro';
    this.waveT = 2.8;
    this.queue = this.makeQueue(this.wave);
    const boss = this.wave % 5 === 0;
    this.showBanner(
      boss ? `WAVE ${this.wave}` : `WAVE ${this.wave}`,
      boss ? '⚠ BOSS INCOMING ⚠' : `${this.queue.length} infected approaching`,
    );
    this.sfx.waveStart();
  }

  private showBanner(title: string, sub: string) {
    this.banner = { id: ++this.bannerId, title, sub };
  }

  private makeQueue(n: number): ZType[] {
    const boss = n % 5 === 0;
    let budget = (5 + 4 * n) * (boss ? 0.6 : 1);
    const pool = (Object.keys(ZOMBIES) as ZType[]).filter((t) => t !== 'boss' && ZOMBIES[t].minWave <= n);
    const q: ZType[] = [];
    const total = pool.reduce((s, t) => s + ZOMBIES[t].weight, 0);
    while (budget > 0) {
      let r = Math.random() * total;
      let chosen = pool[0];
      for (const t of pool) {
        r -= ZOMBIES[t].weight;
        if (r <= 0) {
          chosen = t;
          break;
        }
      }
      q.push(chosen);
      budget -= ZOMBIES[chosen].cost;
    }
    for (let i = q.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [q[i], q[j]] = [q[j], q[i]];
    }
    if (boss) q.splice(Math.floor(q.length * 0.25), 0, 'boss');
    return q;
  }

  private spawnZombie(type: ZType) {
    const p = this.player;
    const minD = Math.hypot(this.vw, this.vh) / 2 + 50;
    let x = 0;
    let y = 0;
    let ok = false;
    for (let i = 0; i < 30 && !ok; i++) {
      const a = rnd(0, TAU);
      const d = minD + rnd(0, 260);
      x = p.x + Math.cos(a) * d;
      y = p.y + Math.sin(a) * d;
      if (x < BORDER + 40 || y < BORDER + 40 || x > WORLD_W - BORDER - 40 || y > WORLD_H - BORDER - 40) continue;
      if (this.blocked(x, y, 28)) continue;
      ok = true;
    }
    if (!ok) {
      // fallback: far-away random edge point
      for (let i = 0; i < 40 && !ok; i++) {
        x = rnd(BORDER + 60, WORLD_W - BORDER - 60);
        y = rnd(BORDER + 60, WORLD_H - BORDER - 60);
        if (Math.hypot(x - p.x, y - p.y) > 450 && !this.blocked(x, y, 28)) ok = true;
      }
    }
    const z = this.makeZombie(type, x, y);
    this.zombies.push(z);
    if (type === 'boss') {
      this.sfx.boss();
      this.shakeAmt += 10;
      this.showBanner('THE ABOMINATION', 'Kill it before it kills you');
    }
  }

  private makeZombie(type: ZType, x: number, y: number): Zombie {
    const def = ZOMBIES[type];
    const w = this.wave;
    const hpMul = type === 'boss' ? 1 + Math.max(0, w / 5 - 1) * 0.6 : 1 + Math.max(0, w - 1) * 0.09;
    const spMul = (1 + Math.min(0.3, Math.max(0, w - 1) * 0.018)) * rnd(0.9, 1.12);
    const hp = def.hp * hpMul;
    return {
      id: this.nextId++, type, x, y, kx: 0, ky: 0, hp, maxHp: hp, r: def.r, mass: def.mass,
      speed: def.speed * (type === 'boss' ? 1 : spMul), dmg: def.dmg * (1 + Math.max(0, w - 1) * 0.03),
      angle: rnd(0, TAU), anim: rnd(0, TAU), flash: 0, atkCd: 0.4,
      skin: pick(def.skins), cloth: pick(def.cloths), hair: pick(['#1c1612', '#2a2118', '#3a342c', '#1a1a1a', '#4a3a28']),
      turn: Math.random() < 0.5 ? 1 : -1, groanT: rnd(0.5, 6), spitCd: rnd(1.5, 3.5),
      state: 'chase', st: 0, abilityT: 3.5, nextMove: 'charge', chargeDir: 0, hitDone: false, stun: 0,
      dead: false, tx: x, ty: y, enraged: false,
    };
  }

  // ───────────────────────── player ─────────────────────────

  private dmgMul() {
    const p = this.player;
    return (1 + 0.12 * p.up.firepower) * (p.power.damage > 0 ? 2 : 1);
  }

  private updatePlayer(dt: number) {
    const p = this.player;
    const inp = this.input;
    p.hurt = Math.max(0, p.hurt - dt * 2.2);
    p.iframes = Math.max(0, p.iframes - dt);
    p.flash = Math.max(0, p.flash - dt);
    p.kick = Math.max(0, p.kick - dt * 6);
    p.hitMarker = Math.max(0, p.hitMarker - dt);
    p.slow = Math.max(0, p.slow - dt);
    p.fireCd -= dt;
    p.power.damage = Math.max(0, p.power.damage - dt);
    p.power.rapid = Math.max(0, p.power.rapid - dt);
    if (p.dead) return;

    // movement
    const mv = inp.moveVec();
    const moving = mv.x !== 0 || mv.y !== 0;
    const wantSprint = (inp.keys.has('ShiftLeft') || inp.keys.has('ShiftRight')) && moving;
    const maxStam = 100 * (1 + 0.06 * p.up.agility);
    p.sprinting = wantSprint && !p.exhausted && p.stamina > 0;
    if (p.sprinting) {
      p.stamina -= 26 * dt;
      p.staminaDelay = 0.7;
      if (p.stamina <= 0) {
        p.stamina = 0;
        p.exhausted = true;
      }
    } else {
      p.staminaDelay -= dt;
      if (p.staminaDelay <= 0) p.stamina = Math.min(maxStam, p.stamina + 20 * dt);
      if (p.exhausted && p.stamina > 25) p.exhausted = false;
    }
    p.stamina = Math.min(p.stamina, maxStam);
    let speed = 195 * (1 + 0.06 * p.up.agility) * (p.sprinting ? 1.5 : 1) * (p.slow > 0 ? 0.6 : 1);
    if (p.reloading) speed *= 0.93;
    const k = 1 - Math.exp(-dt * 12);
    p.vx += (mv.x * speed - p.vx) * k;
    p.vy += (mv.y * speed - p.vy) * k;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    this.collide(p, p.r);
    p.x = clamp(p.x, BORDER + p.r, WORLD_W - BORDER - p.r);
    p.y = clamp(p.y, BORDER + p.r, WORLD_H - BORDER - p.r);
    const spd = Math.hypot(p.vx, p.vy);
    p.walk += dt * spd * 0.07;

    // aim
    const ta = inp.aimVec();
    if (inp.touchMode && ta) {
      p.angle = ta.angle;
    } else {
      this.aim.x = this.cam.x + inp.mouse.x / this.scale;
      this.aim.y = this.cam.y + inp.mouse.y / this.scale;
      p.angle = Math.atan2(this.aim.y - p.y, this.aim.x - p.x);
    }
    if (inp.touchMode) {
      const d = 260;
      this.aim.x = p.x + Math.cos(p.angle) * d;
      this.aim.y = p.y + Math.sin(p.angle) * d;
    }

    // weapon switching
    const keys = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6'];
    keys.forEach((code, i) => {
      if (inp.pressed.has(code)) this.selectWeapon(WEAPON_ORDER[i]);
    });
    if (inp.pressed.has('KeyQ')) this.selectWeapon(p.last);
    if (inp.pressed.has('KeyE')) this.cycleWeapon(1);
    if (inp.wheel !== 0) this.cycleWeapon(inp.wheel > 0 ? 1 : -1);

    const w = WEAPONS[p.weapon];
    const ws = p.ws[p.weapon];

    // reload
    if (inp.pressed.has('KeyR')) this.startReload();
    if (p.reloading) {
      p.reloadT += dt;
      if (p.reloadT >= p.reloadTime) {
        p.reloading = false;
        const need = w.mag - ws.ammo;
        const take = Number.isFinite(ws.reserve) ? Math.min(need, ws.reserve) : need;
        ws.ammo += take;
        if (Number.isFinite(ws.reserve)) ws.reserve -= take;
        this.sfx.reloadDone();
      }
    }

    // fire
    const wantFire = inp.touchMode ? !!ta?.fire : inp.mouse.down;
    if (wantFire && !p.reloading && p.fireCd <= 0) {
      if (ws.ammo > 0) {
        if (w.auto || !p.trig) this.fire();
      } else if (!p.trig || w.auto) {
        if (ws.reserve > 0) this.startReload();
        else {
          this.sfx.dry();
          p.fireCd = 0.3;
          this.floater(p.x, p.y - 26, 'NO AMMO', '#ff6a5a', 13);
        }
      }
    }
    p.trig = wantFire;
    if (ws.ammo <= 0 && !p.reloading && ws.reserve > 0 && p.fireCd <= 0) this.startReload();

    // grenade
    if (inp.pressed.has('KeyG') || inp.rightPressed) this.throwGrenade();

    // heartbeat when low hp
    if (p.hp < p.maxHp * 0.3) {
      p.heartT -= dt;
      if (p.heartT <= 0) {
        p.heartT = 0.95;
        this.sfx.heartbeat();
      }
    }
  }

  private cycleWeapon(dir: number) {
    const p = this.player;
    const owned = WEAPON_ORDER.filter((id) => p.ws[id].owned);
    if (owned.length < 2) return;
    const i = owned.indexOf(p.weapon);
    this.selectWeapon(owned[(i + dir + owned.length) % owned.length]);
  }

  private startReload() {
    const p = this.player;
    const w = WEAPONS[p.weapon];
    const ws = p.ws[p.weapon];
    if (p.reloading || ws.ammo >= w.mag || ws.reserve <= 0 || p.dead) return;
    p.reloading = true;
    p.reloadT = 0;
    p.reloadTime = w.reload * (1 - 0.12 * p.up.hands);
    this.sfx.reload();
  }

  private fire() {
    const p = this.player;
    const w = WEAPONS[p.weapon];
    const ws = p.ws[p.weapon];
    ws.ammo--;
    p.fireCd = w.rate / (p.power.rapid > 0 ? 1.6 : 1);
    const moving = Math.hypot(p.vx, p.vy) > 40;
    const spreadMul = 1 + (moving ? 0.35 : 0) + (p.sprinting ? 0.4 : 0);
    const cos = Math.cos(p.angle);
    const sin = Math.sin(p.angle);
    const mx = p.x + cos * (w.len + 8) - sin * -2;
    const my = p.y + sin * (w.len + 8) + cos * -2;
    const dmg = w.damage * this.dmgMul();
    for (let i = 0; i < w.pellets; i++) {
      const a = p.angle + (Math.random() + Math.random() - 1) * w.spread * spreadMul;
      const sp = w.speed * rnd(0.95, 1.05);
      this.bullets.push({
        x: mx, y: my, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, dmg, range: w.range, dist: 0,
        pierce: w.pierce, knock: w.knock, rocket: !!w.explosive, hit: [], dead: false,
        len: w.id === 'sniper' ? 46 : w.id === 'shotgun' ? 16 : 26,
      });
    }
    p.flash = 0.07;
    p.kick = Math.min(1.5, p.kick + 0.5 + w.shake * 0.08);
    this.shakeAmt += w.shake;
    this.kickX -= cos * w.shake * 1.3;
    this.kickY -= sin * w.shake * 1.3;
    p.vx -= cos * w.recoil;
    p.vy -= sin * w.recoil;
    this.sfx.shot(w.id);
    // casing
    if (!w.explosive) {
      const ca = p.angle + Math.PI / 2 + rnd(-0.4, 0.4);
      const sp = rnd(90, 190);
      this.addPart('casing', p.x + cos * 10, p.y + sin * 10, Math.cos(ca) * sp, Math.sin(ca) * sp, rnd(0.8, 1.3),
        w.id === 'shotgun' ? 3.2 : 2.2, w.id === 'shotgun' ? '#c0392b' : '#d8b04a', 5, true, false);
    }
    // muzzle smoke
    for (let i = 0; i < 2; i++) {
      this.addPart('smoke', mx, my, cos * rnd(20, 60) + rnd(-15, 15), sin * rnd(20, 60) + rnd(-15, 15), rnd(0.4, 0.8),
        rnd(3, 5), '', 3, false, false);
    }
    if (w.explosive) {
      for (let i = 0; i < 8; i++) {
        this.addPart('smoke', p.x - cos * 12, p.y - sin * 12, -cos * rnd(60, 160) + rnd(-50, 50), -sin * rnd(60, 160) + rnd(-50, 50),
          rnd(0.5, 1), rnd(5, 9), '', 3, false, false);
      }
    }
  }

  private throwGrenade() {
    const p = this.player;
    if (p.grenades <= 0 || p.dead) return;
    p.grenades--;
    const dist = clamp(Math.hypot(this.aim.x - p.x, this.aim.y - p.y), 110, 520);
    const v0 = dist * 2.2;
    this.nades.push({
      x: p.x + Math.cos(p.angle) * 16, y: p.y + Math.sin(p.angle) * 16,
      vx: Math.cos(p.angle) * v0, vy: Math.sin(p.angle) * v0, fuse: 1.6, spin: 0,
    });
    this.sfx.pin();
  }

  private hurtPlayer(dmg: number, ang: number, knock: number, ignoreI = false) {
    const p = this.player;
    if (p.dead) return;
    if (p.iframes > 0 && !ignoreI) return;
    p.hp -= dmg;
    p.hurt = 1;
    p.iframes = 0.2;
    p.vx += Math.cos(ang) * knock;
    p.vy += Math.sin(ang) * knock;
    this.shakeAmt += 6 + dmg * 0.15;
    this.sfx.hurt();
    this.spawnBlood(p.x, p.y, ang, 6, 1);
    if (p.hp <= 0 && !p.dead) this.killPlayer();
  }

  private killPlayer() {
    const p = this.player;
    p.dead = true;
    p.hp = 0;
    this.dying = true;
    this.deathT = 0;
    this.sfx.death();
    this.shakeAmt += 16;
    this.spawnBlood(p.x, p.y, 0, 40, 2);
    for (let i = 0; i < 4; i++) this.stampBlood(p.x, p.y, rnd(0, TAU), 5, 30);
    this.sfx.setAmbient(false);
  }

  private gameOver() {
    this.dying = false;
    if (this.score > this.best) {
      this.best = this.score;
      this.newBest = true;
      try {
        localStorage.setItem(BEST_KEY, String(this.best));
      } catch {
        /* ignore */
      }
    }
    this.input.reset();
    this.setPhase('gameover');
    this.emitHud(true);
  }

  // ───────────────────────── zombies ─────────────────────────

  private updateZombies(dt: number, passive: boolean) {
    const p = this.player;
    const zs = this.zombies;
    // separation
    for (let i = 0; i < zs.length; i++) {
      const a = zs[i];
      if (a.dead) continue;
      for (let j = i + 1; j < zs.length; j++) {
        const b = zs[j];
        if (b.dead) continue;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const min = a.r + b.r - 3;
        if (Math.abs(dx) > min || Math.abs(dy) > min) continue;
        const d2 = dx * dx + dy * dy;
        if (d2 >= min * min) continue;
        const d = Math.sqrt(d2) || 0.01;
        const o = min - d;
        const nx = dx / d;
        const ny = dy / d;
        const wa = b.mass / (a.mass + b.mass);
        const wb = a.mass / (a.mass + b.mass);
        a.x -= nx * o * wa * 0.55;
        a.y -= ny * o * wa * 0.55;
        b.x += nx * o * wb * 0.55;
        b.y += ny * o * wb * 0.55;
      }
    }

    for (const z of zs) {
      if (z.dead) continue;
      z.flash = Math.max(0, z.flash - dt * 5);
      z.atkCd -= dt;
      z.stun -= dt;
      let tx = p.x;
      let ty = p.y;
      if (passive) {
        tx = z.tx;
        ty = z.ty;
      } else if (p.dead) {
        // wander when the player is dead
        tx = z.x + Math.cos(z.anim * 0.05) * 100;
        ty = z.y + Math.sin(z.anim * 0.05) * 100;
      }
      const dx = tx - z.x;
      const dy = ty - z.y;
      const d = Math.hypot(dx, dy) || 1;
      const want = Math.atan2(dy, dx);
      let speed = z.speed;
      let dir = want;
      if (passive && d < 50) {
        z.tx = CENTER.x + rnd(-800, 800);
        z.ty = CENTER.y + rnd(-500, 500);
      }
      if (passive) speed *= 0.7;

      // boss enrage
      if (z.type === 'boss' && !z.enraged && z.hp < z.maxHp * 0.5) {
        z.enraged = true;
        z.speed *= 1.25;
        this.sfx.boss();
        this.shakeAmt += 12;
        this.floater(z.x, z.y - 60, 'ENRAGED!', '#ff5a3a', 22);
      }

      const turnRate = z.type === 'runner' ? 9 : 5;
      switch (z.state) {
        case 'chase': {
          z.angle += angDiff(z.angle, want) * Math.min(1, dt * turnRate);
          if (!passive && !p.dead) {
            if (z.type === 'spitter') {
              z.spitCd -= dt;
              if (d < 230) {
                dir = want + Math.PI;
                speed *= 0.9;
              } else if (d < 400) {
                dir = want + (Math.PI / 2) * z.turn;
                speed *= 0.55;
              }
              if (z.spitCd <= 0 && d < 560 && d > 140) {
                z.state = 'spit';
                z.st = 0.55;
              }
            } else if (z.type === 'boss') {
              z.abilityT -= dt;
              if (z.abilityT <= 0 && d < 700) {
                z.nextMove = Math.random() < 0.55 ? 'charge' : 'slam';
                z.state = 'windup';
                z.st = z.nextMove === 'charge' ? 0.9 : 0.8;
                z.chargeDir = want;
                this.sfx.groan(1, clamp(dx / 600, -1, 1), true);
              }
            }
          }
          dir = this.steer(z, dir);
          break;
        }
        case 'windup': {
          speed = 0;
          z.st -= dt;
          if (z.nextMove === 'charge') {
            if (z.st > 0.3) z.chargeDir += angDiff(z.chargeDir, want) * Math.min(1, dt * 8);
            z.angle = z.chargeDir;
          } else {
            z.angle += angDiff(z.angle, want) * Math.min(1, dt * 5);
          }
          if (z.st <= 0) {
            if (z.nextMove === 'charge') {
              z.state = 'charge';
              z.st = 0.85;
              z.hitDone = false;
            } else {
              this.doSlam(z);
              z.state = 'chase';
              z.abilityT = z.enraged ? 2.4 : 4;
            }
          }
          break;
        }
        case 'charge': {
          dir = z.chargeDir;
          speed = 560;
          z.angle = dir;
          z.st -= dt;
          if (!z.hitDone && !p.dead && d < z.r + p.r + 8) {
            z.hitDone = true;
            this.hurtPlayer(z.dmg * 1.3, want, 650, true);
          }
          if (z.st <= 0) {
            z.state = 'chase';
            z.abilityT = z.enraged ? 2.4 : 4;
          }
          break;
        }
        case 'stun': {
          speed = 0;
          z.st -= dt;
          if (z.st <= 0) {
            z.state = 'chase';
            z.abilityT = 1.5;
          }
          break;
        }
        case 'spit': {
          speed = 0;
          z.angle += angDiff(z.angle, want) * Math.min(1, dt * 10);
          z.st -= dt;
          if (z.st <= 0) {
            this.fireSpit(z, want);
            z.state = 'chase';
            z.spitCd = rnd(2, 3.4);
          }
          break;
        }
        default:
          break;
      }
      if (z.stun > 0 && z.type !== 'boss') speed *= 0.25;
      z.anim += dt * (speed * 0.1 + (z.state === 'windup' ? 8 : 2));
      const mvx = Math.cos(dir) * speed + z.kx;
      const mvy = Math.sin(dir) * speed + z.ky;
      z.x += mvx * dt;
      z.y += mvy * dt;
      const decay = Math.exp(-dt * 7);
      z.kx *= decay;
      z.ky *= decay;
      const hitWall = this.collide(z, z.r);
      z.x = clamp(z.x, BORDER + z.r, WORLD_W - BORDER - z.r);
      z.y = clamp(z.y, BORDER + z.r, WORLD_H - BORDER - z.r);
      if (z.state === 'charge' && hitWall) {
        z.state = 'stun';
        z.st = 1.4;
        this.shakeAmt += 12;
        this.sfx.slam();
        for (let i = 0; i < 14; i++) {
          this.addPart('spark', z.x, z.y, rnd(-300, 300), rnd(-300, 300), rnd(0.2, 0.5), 2, '', 3, false, false);
        }
        this.floater(z.x, z.y - 50, 'STUNNED', '#ffd24a', 16);
      }

      // melee attack
      if (!passive && !p.dead && z.state === 'chase' && d < z.r + p.r + 5 && z.atkCd <= 0) {
        this.hurtPlayer(z.dmg, want, z.type === 'brute' || z.type === 'boss' ? 280 : 120);
        z.atkCd = ZOMBIES[z.type].atk;
      }

      // groans
      z.groanT -= dt;
      if (z.groanT <= 0) {
        z.groanT = rnd(4, 9);
        if (!passive && d < 800) this.sfx.groan(1 - d / 900, clamp(dx / 600, -1, 1), z.type === 'brute' || z.type === 'bloater');
      }
    }
  }

  private steer(z: Zombie, dir: number): number {
    const look = z.r + 34;
    const offs = [0, 0.7 * z.turn, -0.7 * z.turn, 1.4 * z.turn, -1.4 * z.turn];
    for (const off of offs) {
      const a = dir + off;
      if (!this.blocked(z.x + Math.cos(a) * look, z.y + Math.sin(a) * look, z.r * 0.8)) return a;
    }
    return dir + 1.6 * z.turn;
  }

  private blocked(x: number, y: number, r: number): boolean {
    for (const rc of this.rects) {
      if (x < rc.x - r || x > rc.x + rc.w + r || y < rc.y - r || y > rc.y + rc.h + r) continue;
      const cx = clamp(x, rc.x, rc.x + rc.w);
      const cy = clamp(y, rc.y, rc.y + rc.h);
      if ((x - cx) ** 2 + (y - cy) ** 2 < r * r) return true;
    }
    for (const b of this.barrels) {
      if (!b.dead && (x - b.x) ** 2 + (y - b.y) ** 2 < (r + b.r) ** 2) return true;
    }
    return false;
  }

  private collide(o: { x: number; y: number }, r: number): boolean {
    let hit = false;
    for (const rc of this.rects) {
      if (o.x < rc.x - r || o.x > rc.x + rc.w + r || o.y < rc.y - r || o.y > rc.y + rc.h + r) continue;
      const cx = clamp(o.x, rc.x, rc.x + rc.w);
      const cy = clamp(o.y, rc.y, rc.y + rc.h);
      const dx = o.x - cx;
      const dy = o.y - cy;
      const d2 = dx * dx + dy * dy;
      if (d2 >= r * r) continue;
      hit = true;
      if (d2 > 1e-6) {
        const d = Math.sqrt(d2);
        const k = (r - d) / d;
        o.x += dx * k;
        o.y += dy * k;
      } else {
        const l = o.x - rc.x;
        const rr = rc.x + rc.w - o.x;
        const t = o.y - rc.y;
        const b = rc.y + rc.h - o.y;
        const m = Math.min(l, rr, t, b);
        if (m === l) o.x = rc.x - r;
        else if (m === rr) o.x = rc.x + rc.w + r;
        else if (m === t) o.y = rc.y - r;
        else o.y = rc.y + rc.h + r;
      }
    }
    for (const b of this.barrels) {
      if (b.dead) continue;
      const dx = o.x - b.x;
      const dy = o.y - b.y;
      const min = r + b.r;
      const d2 = dx * dx + dy * dy;
      if (d2 >= min * min) continue;
      hit = true;
      const d = Math.sqrt(d2) || 0.01;
      o.x = b.x + (dx / d) * min;
      o.y = b.y + (dy / d) * min;
    }
    return hit;
  }

  private pointInRect(x: number, y: number): boolean {
    for (const rc of this.rects) {
      if (x >= rc.x && x <= rc.x + rc.w && y >= rc.y && y <= rc.y + rc.h) return true;
    }
    return false;
  }

  private doSlam(z: Zombie) {
    this.blasts.push({ x: z.x, y: z.y, t: 0, r: 250, color: '#ff5a30' });
    this.shakeAmt += 16;
    this.sfx.slam();
    const p = this.player;
    const d = Math.hypot(p.x - z.x, p.y - z.y);
    if (d < 250 + p.r && !p.dead) this.hurtPlayer(26, Math.atan2(p.y - z.y, p.x - z.x), 700, true);
    for (let i = 0; i < 30; i++) {
      const a = rnd(0, TAU);
      const s = rnd(100, 400);
      this.addPart('smoke', z.x, z.y, Math.cos(a) * s, Math.sin(a) * s, rnd(0.5, 1), rnd(6, 12), '', 3, false, false);
    }
    const alive = this.zombies.filter((q) => !q.dead).length;
    const n = alive < 40 ? 3 : 0;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + rnd(0, 1);
      const q = this.makeZombie(Math.random() < 0.4 ? 'runner' : 'walker', z.x + Math.cos(a) * 90, z.y + Math.sin(a) * 90);
      this.collide(q, q.r);
      this.zombies.push(q);
    }
  }

  private fireSpit(z: Zombie, ang: number) {
    const a = ang + rnd(-0.06, 0.06);
    this.spits.push({ x: z.x + Math.cos(a) * 16, y: z.y + Math.sin(a) * 16, vx: Math.cos(a) * 360, vy: Math.sin(a) * 360, life: 2, dead: false });
    this.sfx.spit();
  }

  private hurtZombie(z: Zombie, dmg: number, ang: number, knock: number, crit = false) {
    if (z.dead) return;
    z.hp -= dmg;
    z.flash = 1;
    z.kx += (Math.cos(ang) * knock) / z.mass;
    z.ky += (Math.sin(ang) * knock) / z.mass;
    z.stun = Math.max(z.stun, 0.12 / (z.mass > 3 ? 3 : 1));
    this.spawnBlood(z.x, z.y, ang, clamp(Math.floor(dmg / 8), 2, 8), z.type === 'spitter' ? 3 : 1);
    this.player.hitMarker = 0.14;
    if (dmg >= 10 || crit) {
      this.floater(z.x + rnd(-8, 8), z.y - z.r - 6, `${Math.round(dmg)}`, crit ? '#ffd23a' : '#ffffff', crit ? 17 : 12);
    }
    this.sfx.hit();
    if (z.hp <= 0) this.killZombie(z, ang);
  }

  private killZombie(z: Zombie, ang: number) {
    if (z.dead) return;
    z.dead = true;
    const def = ZOMBIES[z.type];
    this.kills++;
    this.combo++;
    this.comboT = 3;
    const mult = 1 + Math.min(this.combo, 20) * 0.05;
    const pts = Math.round(def.pts * mult);
    this.points += pts;
    this.score += pts;
    this.floater(z.x, z.y - z.r - 14, `+${pts}`, '#ffcf4a', 14);
    this.spawnBlood(z.x, z.y, ang, 14 + Math.floor(z.r / 3), 1);
    for (let i = 0; i < 3 + Math.floor(z.r / 8); i++) {
      const a = ang + rnd(-0.9, 0.9);
      const s = rnd(80, 300);
      this.addPart('gib', z.x, z.y, Math.cos(a) * s, Math.sin(a) * s, rnd(0.5, 1), rnd(2, 4.5), pick(BLOOD), 4, true, true);
    }
    drawCorpse(this.bctx, z, ang);
    this.stampBlood(z.x, z.y, ang, 6, 70);
    const pd = Math.hypot(z.x - this.player.x, z.y - this.player.y);
    this.sfx.zdeath(clamp(1 - pd / 1000, 0.2, 1), clamp((z.x - this.player.x) / 600, -1, 1));
    if (z.type === 'bloater') {
      for (let i = 0; i < 18; i++) {
        const a = rnd(0, TAU);
        const s = rnd(30, 180);
        this.addPart('gas', z.x, z.y, Math.cos(a) * s, Math.sin(a) * s, rnd(0.8, 1.6), rnd(8, 16), '', 3, false, false);
      }
      this.explode(z.x, z.y, 120, 80, 0.8, '#b6e04a');
    }
    if (z.type === 'boss') {
      this.showBanner('ABOMINATION SLAIN', 'Collect the loot');
      this.explode(z.x, z.y, 200, 0, 0, '#ff7a3a');
      this.flashA = 0.6;
      for (const k of ['health', 'health', 'ammo', pick<PickupKind>(['damage', 'rapid', 'grenade'])] as PickupKind[]) {
        this.spawnPickup(z.x + rnd(-60, 60), z.y + rnd(-60, 60), k);
      }
      const bonus = 200;
      this.points += bonus;
      this.score += bonus;
    } else {
      this.dropLoot(z);
    }
  }

  private dropLoot(z: Zombie) {
    const r = Math.random();
    let kind: PickupKind | null = null;
    if (r < 0.06) kind = 'health';
    else if (r < 0.14) kind = 'ammo';
    else if (r < 0.17) kind = 'grenade';
    else if (r < 0.19) kind = 'damage';
    else if (r < 0.205) kind = 'rapid';
    else if (r < 0.212) kind = 'nuke';
    if (kind) this.spawnPickup(z.x, z.y, kind);
  }

  private spawnPickup(x: number, y: number, kind: PickupKind) {
    this.pickups.push({ x, y, kind, life: 20, t: 0 });
  }

  // ───────────────────────── projectiles ─────────────────────────

  private updateBullets(dt: number) {
    for (const b of this.bullets) {
      const sp = Math.hypot(b.vx, b.vy);
      const steps = Math.max(1, Math.ceil((sp * dt) / 10));
      const sdt = dt / steps;
      for (let s = 0; s < steps && !b.dead; s++) {
        b.x += b.vx * sdt;
        b.y += b.vy * sdt;
        b.dist += sp * sdt;
        if (b.rocket && s === 0) {
          this.addPart('smoke', b.x - b.vx * 0.01, b.y - b.vy * 0.01, rnd(-20, 20), rnd(-20, 20), rnd(0.4, 0.8), rnd(3, 6), '', 3, false, false);
          this.addPart('fire', b.x, b.y, rnd(-30, 30), rnd(-30, 30), rnd(0.15, 0.3), rnd(3, 5), '', 4, false, false);
        }
        if (b.dist > b.range || b.x < BORDER || b.y < BORDER || b.x > WORLD_W - BORDER || b.y > WORLD_H - BORDER) {
          b.dead = true;
          if (b.rocket) this.rocketBoom(b);
          break;
        }
        if (this.pointInRect(b.x, b.y)) {
          b.dead = true;
          for (let i = 0; i < 5; i++) {
            const a = Math.atan2(-b.vy, -b.vx) + rnd(-1, 1);
            this.addPart('spark', b.x, b.y, Math.cos(a) * rnd(60, 260), Math.sin(a) * rnd(60, 260), rnd(0.1, 0.3), 1.6, '', 3, false, false);
          }
          if (b.rocket) this.rocketBoom(b);
          break;
        }
        let consumed = false;
        for (const br of this.barrels) {
          if (br.dead) continue;
          if ((b.x - br.x) ** 2 + (b.y - br.y) ** 2 < (br.r + 2) ** 2) {
            this.damageBarrel(br, b.dmg);
            for (let i = 0; i < 4; i++) {
              this.addPart('spark', b.x, b.y, rnd(-200, 200), rnd(-200, 200), rnd(0.1, 0.3), 1.6, '', 3, false, false);
            }
            b.dead = true;
            if (b.rocket) this.rocketBoom(b);
            consumed = true;
            break;
          }
        }
        if (consumed) break;
        for (const z of this.zombies) {
          if (z.dead || b.hit.includes(z.id)) continue;
          const rr = z.r + 3;
          const dx = b.x - z.x;
          const dy = b.y - z.y;
          if (Math.abs(dx) > rr || Math.abs(dy) > rr) continue;
          if (dx * dx + dy * dy > rr * rr) continue;
          if (b.rocket) {
            b.dead = true;
            this.rocketBoom(b);
            break;
          }
          const crit = Math.random() < 0.1;
          this.hurtZombie(z, b.dmg * (crit ? 2 : 1), Math.atan2(b.vy, b.vx), b.knock, crit);
          b.hit.push(z.id);
          b.dmg *= 0.8;
          if (b.pierce-- <= 0) {
            b.dead = true;
            break;
          }
        }
      }
    }
    this.bullets = this.bullets.filter((b) => !b.dead);
  }

  private rocketBoom(b: Bullet) {
    this.explode(b.x, b.y, 135, b.dmg, 0.45, '#ff9a3a');
  }

  private updateSpits(dt: number) {
    const p = this.player;
    for (const s of this.spits) {
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.life -= dt;
      this.addPartChance('acid', s.x, s.y, 0.5);
      if (s.life <= 0 || this.pointInRect(s.x, s.y)) {
        this.splatAcid(s.x, s.y);
        s.dead = true;
      } else if (!p.dead && (s.x - p.x) ** 2 + (s.y - p.y) ** 2 < (p.r + 6) ** 2) {
        this.hurtPlayer(12, Math.atan2(s.vy, s.vx), 60);
        p.slow = 1.5;
        this.splatAcid(s.x, s.y);
        s.dead = true;
      }
    }
    this.spits = this.spits.filter((s) => !s.dead);
  }

  private addPartChance(kind: ParticleKind, x: number, y: number, chance: number) {
    if (Math.random() < chance) this.addPart(kind, x + rnd(-3, 3), y + rnd(-3, 3), rnd(-20, 20), rnd(-20, 20), rnd(0.2, 0.4), rnd(2, 3.5), '', 3, false, false);
  }

  private splatAcid(x: number, y: number) {
    for (let i = 0; i < 10; i++) {
      const a = rnd(0, TAU);
      const s = rnd(40, 200);
      this.addPart('acid', x, y, Math.cos(a) * s, Math.sin(a) * s, rnd(0.2, 0.5), rnd(1.5, 3), '', 4, false, false);
    }
    const g = this.bctx;
    g.fillStyle = 'rgba(120,190,40,0.45)';
    for (let i = 0; i < 6; i++) {
      g.beginPath();
      g.arc(x + rnd(-14, 14), y + rnd(-14, 14), rnd(2, 7), 0, TAU);
      g.fill();
    }
  }

  private updateNades(dt: number) {
    for (const n of this.nades) {
      n.fuse -= dt;
      n.spin += dt * 12;
      const fr = Math.exp(-dt * 2.2);
      n.vx *= fr;
      n.vy *= fr;
      const nx = n.x + n.vx * dt;
      const ny = n.y + n.vy * dt;
      if (this.pointInRect(nx, n.y) || nx < BORDER || nx > WORLD_W - BORDER) n.vx *= -0.5;
      else n.x = nx;
      if (this.pointInRect(n.x, ny) || ny < BORDER || ny > WORLD_H - BORDER) n.vy *= -0.5;
      else n.y = ny;
    }
    const boom = this.nades.filter((n) => n.fuse <= 0);
    this.nades = this.nades.filter((n) => n.fuse > 0);
    for (const n of boom) this.explode(n.x, n.y, 145, 260 * (1 + 0.12 * this.player.up.firepower), 0.45, '#ffb050');
  }

  private updateBarrels(dt: number) {
    for (const b of this.barrels) {
      if (b.dead) continue;
      if (b.fuse >= 0) {
        b.fuse -= dt;
        this.addPartChance('fire', b.x, b.y, 0.8);
        this.addPartChance('smoke', b.x, b.y, 0.5);
        if (b.fuse <= 0) {
          b.dead = true;
          this.explode(b.x, b.y, 125, 150, 0.8, '#ff8a3a');
        }
      }
    }
    this.barrels = this.barrels.filter((b) => !b.dead);
  }

  private damageBarrel(b: Barrel, dmg: number) {
    b.hp -= dmg;
    if (b.hp <= 0 && b.fuse < 0) b.fuse = 0.18;
  }

  private explode(x: number, y: number, radius: number, dmg: number, playerMul: number, color: string) {
    this.blasts.push({ x, y, t: 0, r: radius, color });
    this.shakeAmt += 14;
    this.sfx.explosion(clamp(1 - Math.hypot(x - this.player.x, y - this.player.y) / 1500, 0.35, 1));
    this.flashA = Math.max(this.flashA, 0.18);
    for (let i = 0; i < 34; i++) {
      const a = rnd(0, TAU);
      const s = rnd(40, 380);
      this.addPart('fire', x, y, Math.cos(a) * s, Math.sin(a) * s, rnd(0.2, 0.55), rnd(5, 12), '', 4, false, false);
    }
    for (let i = 0; i < 22; i++) {
      const a = rnd(0, TAU);
      const s = rnd(30, 200);
      this.addPart('smoke', x, y, Math.cos(a) * s, Math.sin(a) * s, rnd(0.8, 1.8), rnd(8, 16), '', 2.5, false, false);
    }
    for (let i = 0; i < 26; i++) {
      const a = rnd(0, TAU);
      const s = rnd(150, 600);
      this.addPart('spark', x, y, Math.cos(a) * s, Math.sin(a) * s, rnd(0.2, 0.6), 2, '', 2, false, false);
    }
    // scorch mark
    const g = this.bctx;
    const gr = g.createRadialGradient(x, y, 0, x, y, radius * 0.9);
    gr.addColorStop(0, 'rgba(0,0,0,0.65)');
    gr.addColorStop(0.7, 'rgba(10,8,6,0.4)');
    gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr;
    g.beginPath();
    g.arc(x, y, radius * 0.9, 0, TAU);
    g.fill();

    if (dmg > 0) {
      for (const z of this.zombies) {
        if (z.dead) continue;
        const d = Math.hypot(z.x - x, z.y - y);
        if (d < radius + z.r) {
          const f = clamp(1 - d / (radius + z.r), 0, 1);
          this.hurtZombie(z, dmg * (0.35 + 0.65 * f), Math.atan2(z.y - y, z.x - x), 700 * f + 150);
        }
      }
      for (const br of this.barrels) {
        if (br.dead || br.fuse >= 0) continue;
        const d = Math.hypot(br.x - x, br.y - y);
        if (d < radius + br.r) this.damageBarrel(br, 999);
      }
    }
    const p = this.player;
    const pd = Math.hypot(p.x - x, p.y - y);
    if (playerMul > 0 && !p.dead && pd < radius + p.r) {
      const f = clamp(1 - pd / (radius + p.r), 0, 1);
      const pdmg = Math.max(8, (dmg || 60) * (0.4 + 0.6 * f) * playerMul * 0.5);
      this.hurtPlayer(pdmg, Math.atan2(p.y - y, p.x - x), 500 * f, true);
    }
  }

  // ───────────────────────── pickups ─────────────────────────

  private updatePickups(dt: number) {
    const p = this.player;
    for (const k of this.pickups) {
      k.life -= dt;
      k.t += dt;
      const dx = p.x - k.x;
      const dy = p.y - k.y;
      const d = Math.hypot(dx, dy);
      if (!p.dead && d < 130) {
        const s = 320 * (1 - d / 160);
        k.x += (dx / (d || 1)) * s * dt;
        k.y += (dy / (d || 1)) * s * dt;
      }
      if (!p.dead && d < 26) {
        if (this.collectPickup(k)) k.life = -1;
      }
    }
    this.pickups = this.pickups.filter((k) => k.life > 0);
  }

  private collectPickup(k: Pickup): boolean {
    const p = this.player;
    switch (k.kind) {
      case 'health': {
        if (p.hp >= p.maxHp) return false;
        const h = Math.min(p.maxHp - p.hp, 30);
        p.hp += h;
        this.floater(p.x, p.y - 28, `+${h} HP`, '#ff6a7a', 15);
        this.sfx.pickup();
        break;
      }
      case 'ammo': {
        const opts = WEAPON_ORDER.filter((id) => id !== 'pistol' && p.ws[id].owned && p.ws[id].reserve < WEAPONS[id].maxReserve);
        if (!opts.length) {
          if (p.grenades >= MAX_GRENADES) return false;
          p.grenades++;
          this.floater(p.x, p.y - 28, '+1 GRENADE', '#9be06a', 14);
        } else {
          const id = opts.includes(p.weapon) ? p.weapon : pick(opts);
          const w = WEAPONS[id];
          const n = Math.ceil(w.pack * 0.6);
          p.ws[id].reserve = Math.min(w.maxReserve, p.ws[id].reserve + n);
          this.floater(p.x, p.y - 28, `+${n} ${w.name.split(' ').pop()!.toUpperCase()} AMMO`, '#ffd24a', 14);
        }
        this.sfx.pickup();
        break;
      }
      case 'grenade':
        if (p.grenades >= MAX_GRENADES) return false;
        p.grenades = Math.min(MAX_GRENADES, p.grenades + 2);
        this.floater(p.x, p.y - 28, '+2 GRENADES', '#9be06a', 14);
        this.sfx.pickup();
        break;
      case 'damage':
        p.power.damage = 15;
        this.floater(p.x, p.y - 28, 'DOUBLE DAMAGE!', '#ff8a3a', 17);
        this.sfx.power();
        break;
      case 'rapid':
        p.power.rapid = 15;
        this.floater(p.x, p.y - 28, 'RAPID FIRE!', '#4ad0ff', 17);
        this.sfx.power();
        break;
      case 'nuke': {
        this.floater(p.x, p.y - 28, 'TACTICAL NUKE!', '#ffffff', 20);
        this.sfx.nuke();
        this.flashA = 1;
        this.shakeAmt += 30;
        for (const z of this.zombies) {
          if (z.dead) continue;
          if (z.type === 'boss') this.hurtZombie(z, z.maxHp * 0.25, 0, 0);
          else this.hurtZombie(z, 99999, rnd(0, TAU), 0);
        }
        break;
      }
    }
    return true;
  }

  // ───────────────────────── particles & fx ─────────────────────────

  private addPart(
    kind: ParticleKind, x: number, y: number, vx: number, vy: number, life: number, size: number,
    color: string, drag: number, stamp: boolean, spin: boolean,
  ) {
    if (this.parts.length > 1100) return;
    this.parts.push({
      kind, x, y, vx, vy, life, max: life, size, color, drag, rot: rnd(0, TAU), vr: spin ? rnd(-14, 14) : 0, stamp,
    });
  }

  private spawnBlood(x: number, y: number, ang: number, n: number, spread: number) {
    const acid = spread === 3;
    for (let i = 0; i < n; i++) {
      const a = ang + rnd(-0.7, 0.7) * (spread === 2 ? 5 : 1);
      const s = rnd(80, 340);
      this.addPart(acid ? 'acid' : 'blood', x, y, Math.cos(a) * s, Math.sin(a) * s, rnd(0.25, 0.65), rnd(1.4, 3.6),
        acid ? '#9be03a' : pick(BLOOD), 5, !acid, false);
    }
    if (!acid) this.stampBlood(x, y, ang, Math.min(3, 1 + Math.floor(n / 4)), 34);
  }

  private stampBlood(x: number, y: number, ang: number, n: number, dist: number) {
    const g = this.bctx;
    for (let i = 0; i < n; i++) {
      const a = ang + rnd(-0.8, 0.8);
      const d = rnd(4, dist);
      g.fillStyle = `rgba(${rnd(80, 120) | 0},6,6,${rnd(0.35, 0.7)})`;
      g.beginPath();
      g.ellipse(x + Math.cos(a) * d, y + Math.sin(a) * d, rnd(1.5, 5), rnd(1.2, 3.5), a, 0, TAU);
      g.fill();
    }
  }

  private updateParticles(dt: number) {
    const ps = this.parts;
    let w = 0;
    for (let i = 0; i < ps.length; i++) {
      const p = ps[i];
      p.life -= dt;
      if (p.life <= 0) {
        if (p.stamp && p.kind === 'blood') {
          this.bctx.fillStyle = 'rgba(100,8,8,0.55)';
          this.bctx.beginPath();
          this.bctx.arc(p.x, p.y, p.size * 1.1, 0, TAU);
          this.bctx.fill();
        }
        continue;
      }
      const dr = Math.exp(-p.drag * dt);
      p.vx *= dr;
      p.vy *= dr;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
      if (p.kind === 'smoke' || p.kind === 'gas') p.size += dt * 10;
      ps[w++] = p;
    }
    ps.length = w;
  }

  private updateBlasts(dt: number) {
    for (const b of this.blasts) b.t += dt;
    this.blasts = this.blasts.filter((b) => b.t < 0.7);
  }

  private floater(x: number, y: number, text: string, color: string, size: number) {
    if (this.floaters.length > 50) this.floaters.shift();
    this.floaters.push({ x, y, text, color, t: 0, life: 0.9, size });
  }

  private updateFloaters(dt: number) {
    for (const f of this.floaters) {
      f.t += dt;
      f.y -= dt * 38;
    }
    this.floaters = this.floaters.filter((f) => f.t < f.life);
  }

  // ───────────────────────── rendering ─────────────────────────

  private inView(x: number, y: number, m: number) {
    return x > this.cam.x - m && x < this.cam.x + this.vw + m && y > this.cam.y - m && y < this.cam.y + this.vh + m;
  }

  private render() {
    const ctx = this.ctx;
    const p = this.player;
    const W = this.canvas.width;
    const H = this.canvas.height;
    const s = this.dpr * this.scale;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#050607';
    ctx.fillRect(0, 0, W, H);

    const sh = this.shakeAmt;
    const cx = clamp(this.cam.x + this.kickX + (Math.random() - 0.5) * sh * 0.9, -20, WORLD_W - this.vw + 20);
    const cy = clamp(this.cam.y + this.kickY + (Math.random() - 0.5) * sh * 0.9, -20, WORLD_H - this.vh + 20);
    ctx.setTransform(s, 0, 0, s, -cx * s, -cy * s);
    ctx.imageSmoothingEnabled = true;

    // ground + decals
    const sx = Math.max(0, Math.floor(cx) - 2);
    const sy = Math.max(0, Math.floor(cy) - 2);
    const sw = Math.min(WORLD_W - sx, Math.ceil(this.vw) + 6);
    const sh2 = Math.min(WORLD_H - sy, Math.ceil(this.vh) + 6);
    ctx.drawImage(this.ground, sx, sy, sw, sh2, sx, sy, sw, sh2);
    ctx.drawImage(this.blood, sx, sy, sw, sh2, sx, sy, sw, sh2);

    // boss telegraphs
    for (const z of this.zombies) {
      if (z.dead || z.state !== 'windup') continue;
      const a = 0.12 + 0.12 * Math.sin(this.t * 30);
      if (z.nextMove === 'charge') {
        ctx.save();
        ctx.translate(z.x, z.y);
        ctx.rotate(z.chargeDir);
        ctx.fillStyle = `rgba(255,40,30,${a + 0.08})`;
        ctx.fillRect(0, -z.r, 520, z.r * 2);
        ctx.restore();
      } else {
        ctx.fillStyle = `rgba(255,60,30,${a})`;
        ctx.beginPath();
        ctx.arc(z.x, z.y, 250 * (1 - z.st / 0.8 * 0.4), 0, TAU);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,80,40,0.7)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(z.x, z.y, 250, 0, TAU);
        ctx.stroke();
      }
    }

    // pickups
    for (const k of this.pickups) if (this.inView(k.x, k.y, 40)) drawPickup(ctx, k, this.t);

    // obstacles
    for (const r of this.rects) if (this.inView(r.x + r.w / 2, r.y + r.h / 2, 120)) drawObstacle(ctx, r);
    for (const b of this.barrels) if (this.inView(b.x, b.y, 40)) drawBarrel(ctx, b, this.t);
    for (const l of this.lamps) if (this.inView(l.x, l.y, 20)) drawLampPost(ctx, l, this.lampPower(l));

    // grenades
    for (const n of this.nades) {
      ctx.save();
      ctx.translate(n.x, n.y);
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.beginPath();
      ctx.arc(3, 4, 5, 0, TAU);
      ctx.fill();
      ctx.rotate(n.spin);
      ctx.fillStyle = '#3c5a2a';
      ctx.beginPath();
      ctx.arc(0, 0, 5.5, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#222';
      ctx.fillRect(-1.5, -8, 3, 4);
      ctx.restore();
      if (Math.floor(n.fuse * 8) % 2 === 0) {
        ctx.fillStyle = '#ff3030';
        ctx.beginPath();
        ctx.arc(n.x, n.y, 2.2, 0, TAU);
        ctx.fill();
      }
    }

    // zombies (bigger last so they overlap smaller)
    const vis = this.zombies.filter((z) => !z.dead && this.inView(z.x, z.y, 80)).sort((a, b) => a.r - b.r);
    for (const z of vis) {
      drawZombie(ctx, z);
      if (z.hp < z.maxHp && z.type !== 'boss') {
        const bw = z.r * 1.8;
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(z.x - bw / 2, z.y - z.r - 11, bw, 3.5);
        ctx.fillStyle = z.hp / z.maxHp > 0.4 ? '#c24a3a' : '#ff3030';
        ctx.fillRect(z.x - bw / 2, z.y - z.r - 11, (bw * z.hp) / z.maxHp, 3.5);
      }
    }

    // player
    if (this.phase !== 'menu' && !p.dead) {
      const w = WEAPONS[p.weapon];
      drawPlayer(ctx, p, w, Math.hypot(p.vx, p.vy) > 30);
      drawMuzzleFlash(ctx, p, w);
      // laser sight (subtle)
      if (this.phase === 'playing' && !this.input.touchMode) {
        const len = w.id === 'sniper' ? 900 : 380;
        const ox = p.x + Math.cos(p.angle) * (w.len + 10);
        const oy = p.y + Math.sin(p.angle) * (w.len + 10);
        const g = ctx.createLinearGradient(ox, oy, ox + Math.cos(p.angle) * len, oy + Math.sin(p.angle) * len);
        g.addColorStop(0, 'rgba(255,60,60,0.5)');
        g.addColorStop(1, 'rgba(255,60,60,0)');
        ctx.strokeStyle = g;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(ox, oy);
        ctx.lineTo(ox + Math.cos(p.angle) * len, oy + Math.sin(p.angle) * len);
        ctx.stroke();
      }
    }

    // acid spit
    for (const sp of this.spits) {
      ctx.fillStyle = 'rgba(150,230,50,0.9)';
      ctx.beginPath();
      ctx.arc(sp.x, sp.y, 5.5, 0, TAU);
      ctx.fill();
      ctx.fillStyle = 'rgba(230,255,150,0.9)';
      ctx.beginPath();
      ctx.arc(sp.x - 1, sp.y - 1, 2.2, 0, TAU);
      ctx.fill();
    }

    // bullets
    ctx.globalCompositeOperation = 'lighter';
    for (const b of this.bullets) {
      const sp = Math.hypot(b.vx, b.vy) || 1;
      if (b.rocket) {
        ctx.fillStyle = 'rgba(255,200,100,0.9)';
        ctx.beginPath();
        ctx.arc(b.x, b.y, 5, 0, TAU);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,120,30,0.35)';
        ctx.beginPath();
        ctx.arc(b.x, b.y, 14, 0, TAU);
        ctx.fill();
        continue;
      }
      const tail = Math.min(b.len, b.dist + 4);
      const g = ctx.createLinearGradient(b.x, b.y, b.x - (b.vx / sp) * tail, b.y - (b.vy / sp) * tail);
      g.addColorStop(0, 'rgba(255,240,180,1)');
      g.addColorStop(1, 'rgba(255,170,60,0)');
      ctx.strokeStyle = g;
      ctx.lineWidth = 2.2;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(b.x, b.y);
      ctx.lineTo(b.x - (b.vx / sp) * tail, b.y - (b.vy / sp) * tail);
      ctx.stroke();
    }
    ctx.globalCompositeOperation = 'source-over';

    // particles
    this.drawParticles(ctx);

    // shockwave rings
    for (const b of this.blasts) {
      const k = b.t / 0.7;
      ctx.strokeStyle = b.color;
      ctx.globalAlpha = (1 - k) * 0.8;
      ctx.lineWidth = 6 * (1 - k) + 1;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r * (0.25 + k * 0.85), 0, TAU);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // warm lamp glow
    ctx.globalCompositeOperation = 'lighter';
    for (const l of this.lamps) {
      if (!this.inView(l.x, l.y, 320)) continue;
      const pw = this.lampPower(l);
      const g = ctx.createRadialGradient(l.x, l.y, 0, l.x, l.y, 300);
      g.addColorStop(0, `rgba(255,170,80,${0.2 * pw})`);
      g.addColorStop(1, 'rgba(255,150,60,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(l.x, l.y, 300, 0, TAU);
      ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';

    // darkness / lighting
    this.drawLighting(cx, cy);

    // glowing eyes (draw above darkness)
    for (const z of vis) drawEyes(ctx, z);
    // lamp bulbs
    for (const l of this.lamps) {
      if (!this.inView(l.x, l.y, 20)) continue;
      const pw = this.lampPower(l);
      const g = ctx.createRadialGradient(l.x, l.y, 0, l.x, l.y, 14);
      g.addColorStop(0, `rgba(255,230,170,${0.9 * pw})`);
      g.addColorStop(1, 'rgba(255,200,120,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(l.x, l.y, 14, 0, TAU);
      ctx.fill();
    }
    // explosion flash cores (additive)
    ctx.globalCompositeOperation = 'lighter';
    for (const b of this.blasts) {
      const k = b.t / 0.7;
      if (k > 0.5) continue;
      const g = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r);
      g.addColorStop(0, `rgba(255,240,200,${(0.5 - k) * 1.4})`);
      g.addColorStop(1, 'rgba(255,120,30,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, TAU);
      ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';

    // floaters
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    for (const f of this.floaters) {
      const a = 1 - Math.pow(f.t / f.life, 2);
      ctx.globalAlpha = clamp(a, 0, 1);
      ctx.font = `bold ${f.size}px Impact, "Arial Narrow", sans-serif`;
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(0,0,0,0.85)';
      ctx.strokeText(f.text, f.x, f.y);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, f.y);
    }
    ctx.globalAlpha = 1;

    // screen-space overlays
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.drawScreenFx();
    if (this.phase !== 'menu') {
      this.drawMinimap();
      if (this.phase === 'playing' && !p.dead) this.drawCrosshair();
      if (this.input.touchMode && this.phase === 'playing') this.drawSticks();
    }
  }

  private lampPower(l: Lamp) {
    if (!l.flicker) return 1;
    const n = Math.sin(this.t * 9 + l.phase) * Math.sin(this.t * 3.7 + l.phase * 2);
    return n > 0.55 ? 0.25 : n > 0.3 ? 0.7 : 1;
  }

  private drawParticles(ctx: CanvasRenderingContext2D) {
    for (const p of this.parts) {
      if (!this.inView(p.x, p.y, 20)) continue;
      const a = p.life / p.max;
      switch (p.kind) {
        case 'blood':
          ctx.globalAlpha = Math.min(1, a * 1.6);
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, TAU);
          ctx.fill();
          break;
        case 'acid':
          ctx.globalAlpha = Math.min(1, a * 1.6);
          ctx.fillStyle = p.color || '#9be03a';
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, TAU);
          ctx.fill();
          break;
        case 'spark':
          ctx.globalCompositeOperation = 'lighter';
          ctx.globalAlpha = a;
          ctx.strokeStyle = '#ffc060';
          ctx.lineWidth = 1.6;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x - p.vx * 0.04, p.y - p.vy * 0.04);
          ctx.stroke();
          ctx.globalCompositeOperation = 'source-over';
          break;
        case 'smoke':
          ctx.globalAlpha = 0.32 * a;
          ctx.fillStyle = '#4a4a4a';
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, TAU);
          ctx.fill();
          break;
        case 'gas':
          ctx.globalAlpha = 0.28 * a;
          ctx.fillStyle = '#8fb83a';
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, TAU);
          ctx.fill();
          break;
        case 'fire':
          ctx.globalCompositeOperation = 'lighter';
          ctx.globalAlpha = a * 0.9;
          ctx.fillStyle = a > 0.5 ? '#ffb040' : '#e0501a';
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * (0.5 + a * 0.6), 0, TAU);
          ctx.fill();
          ctx.globalCompositeOperation = 'source-over';
          break;
        case 'casing':
          ctx.globalAlpha = Math.min(1, a * 2);
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rot);
          ctx.fillStyle = p.color;
          ctx.fillRect(-p.size, -p.size * 0.5, p.size * 2, p.size);
          ctx.restore();
          break;
        case 'gib':
          ctx.globalAlpha = Math.min(1, a * 2);
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rot);
          ctx.fillStyle = p.color;
          ctx.fillRect(-p.size, -p.size * 0.6, p.size * 2, p.size * 1.2);
          ctx.restore();
          break;
      }
    }
    ctx.globalAlpha = 1;
  }

  private hole(x: number, y: number, r: number, a: number) {
    const lc = this.lctx;
    const g = lc.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(0,0,0,${a})`);
    g.addColorStop(0.5, `rgba(0,0,0,${a * 0.55})`);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    lc.fillStyle = g;
    lc.beginPath();
    lc.arc(x, y, r, 0, TAU);
    lc.fill();
  }

  private cone(x: number, y: number, ang: number, half: number, r: number, a: number) {
    const lc = this.lctx;
    const g = lc.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(0,0,0,${a})`);
    g.addColorStop(0.55, `rgba(0,0,0,${a * 0.65})`);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    lc.save();
    lc.beginPath();
    lc.moveTo(x, y);
    lc.arc(x, y, r, ang - half, ang + half);
    lc.closePath();
    lc.clip();
    lc.fillStyle = g;
    lc.fillRect(x - r, y - r, r * 2, r * 2);
    lc.restore();
  }

  private drawLighting(cx: number, cy: number) {
    const lc = this.lctx;
    const p = this.player;
    const ls = this.dpr * this.scale * LIGHT_RES;
    lc.setTransform(1, 0, 0, 1, 0, 0);
    lc.globalCompositeOperation = 'source-over';
    const amb = this.phase === 'menu' ? 0.82 : 0.76;
    lc.fillStyle = `rgba(3,5,12,${amb})`;
    lc.fillRect(0, 0, this.light.width, this.light.height);
    lc.globalCompositeOperation = 'destination-out';
    lc.setTransform(ls, 0, 0, ls, -cx * ls, -cy * ls);

    if (this.phase !== 'menu' && !p.dead) {
      this.hole(p.x, p.y, 190, 0.92);
      const flick = 1 + Math.sin(this.t * 40) * 0.015;
      this.cone(p.x, p.y, p.angle, 0.62, 640 * flick, 0.3);
      this.cone(p.x, p.y, p.angle, 0.4, 700 * flick, 0.5);
      this.cone(p.x, p.y, p.angle, 0.2, 760 * flick, 0.55);
      if (p.flash > 0) {
        const w = WEAPONS[p.weapon];
        this.hole(p.x + Math.cos(p.angle) * (w.len + 14), p.y + Math.sin(p.angle) * (w.len + 14), 300, 0.9);
      }
    }
    for (const l of this.lamps) {
      if (!this.inView(l.x, l.y, 340)) continue;
      this.hole(l.x, l.y, 320, 0.95 * this.lampPower(l));
    }
    for (const k of this.pickups) if (this.inView(k.x, k.y, 90)) this.hole(k.x, k.y, 80, 0.85);
    for (const b of this.barrels) if (b.fuse >= 0) this.hole(b.x, b.y, 150, 0.9);
    for (const b of this.blasts) {
      const k = 1 - b.t / 0.7;
      this.hole(b.x, b.y, b.r * 2.6, clamp(k * 1.5, 0, 1));
    }
    for (const b of this.bullets) if (b.rocket) this.hole(b.x, b.y, 170, 0.9);
    for (const n of this.nades) if (Math.floor(n.fuse * 8) % 2 === 0) this.hole(n.x, n.y, 50, 0.7);
    for (const s of this.spits) this.hole(s.x, s.y, 55, 0.7);
    for (const z of this.zombies) {
      if (z.dead) continue;
      if (z.type === 'boss' || z.type === 'spitter' || z.type === 'bloater') this.hole(z.x, z.y, z.type === 'boss' ? 130 : 60, 0.45);
    }

    lc.setTransform(1, 0, 0, 1, 0, 0);
    lc.globalCompositeOperation = 'source-over';
    const ctx = this.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(this.light, 0, 0, this.canvas.width, this.canvas.height);
    const s = this.dpr * this.scale;
    ctx.setTransform(s, 0, 0, s, -cx * s, -cy * s);
  }

  private drawScreenFx() {
    const ctx = this.ctx;
    const w = this.cssW;
    const h = this.cssH;
    const p = this.player;
    // vignette
    const vg = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.78);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,0,0.6)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, w, h);
    if (this.phase === 'menu') return;
    // damage / low health
    const low = p.hp < p.maxHp * 0.3 && !p.dead ? (0.25 + 0.2 * Math.sin(this.t * 6)) : 0;
    const dmgA = Math.max(p.hurt * 0.55, low);
    if (dmgA > 0.01) {
      const rg = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.25, w / 2, h / 2, Math.max(w, h) * 0.7);
      rg.addColorStop(0, 'rgba(180,0,0,0)');
      rg.addColorStop(1, `rgba(200,0,0,${dmgA})`);
      ctx.fillStyle = rg;
      ctx.fillRect(0, 0, w, h);
    }
    if (p.power.damage > 0 || p.power.rapid > 0) {
      const col = p.power.damage > 0 ? '255,120,30' : '60,200,255';
      const rg = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.4, w / 2, h / 2, Math.max(w, h) * 0.75);
      rg.addColorStop(0, `rgba(${col},0)`);
      rg.addColorStop(1, `rgba(${col},0.16)`);
      ctx.fillStyle = rg;
      ctx.fillRect(0, 0, w, h);
    }
    if (this.flashA > 0.01) {
      ctx.fillStyle = `rgba(255,245,225,${Math.min(1, this.flashA)})`;
      ctx.fillRect(0, 0, w, h);
    }
    if (this.dying) {
      ctx.fillStyle = `rgba(60,0,0,${Math.min(0.7, this.deathT * 0.35)})`;
      ctx.fillRect(0, 0, w, h);
    }
  }

  private drawCrosshair() {
    const ctx = this.ctx;
    const p = this.player;
    const m = this.input.mouse;
    if (this.input.touchMode) return;
    const w = WEAPONS[p.weapon];
    const moving = Math.hypot(p.vx, p.vy) > 40;
    const spreadMul = 1 + (moving ? 0.35 : 0) + (p.sprinting ? 0.4 : 0);
    const gap = 7 + w.spread * spreadMul * 160 * this.scale + p.kick * 6;
    let over = false;
    for (const z of this.zombies) {
      if (!z.dead && (z.x - this.aim.x) ** 2 + (z.y - this.aim.y) ** 2 < (z.r + 6) ** 2) {
        over = true;
        break;
      }
    }
    const col = over ? '#ff4a3a' : '#f2f2f2';
    ctx.save();
    ctx.translate(m.x, m.y);
    ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    const draw = () => {
      ctx.beginPath();
      for (let i = 0; i < 4; i++) {
        const a = (i * Math.PI) / 2;
        ctx.moveTo(Math.cos(a) * gap, Math.sin(a) * gap);
        ctx.lineTo(Math.cos(a) * (gap + 8), Math.sin(a) * (gap + 8));
      }
      ctx.stroke();
    };
    draw();
    ctx.strokeStyle = col;
    ctx.lineWidth = 2;
    draw();
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.arc(0, 0, 1.6, 0, TAU);
    ctx.fill();
    if (p.reloading) {
      const k = clamp(p.reloadT / p.reloadTime, 0, 1);
      ctx.strokeStyle = 'rgba(0,0,0,0.5)';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(0, 0, gap + 16, 0, TAU);
      ctx.stroke();
      ctx.strokeStyle = '#ffd24a';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, gap + 16, -Math.PI / 2, -Math.PI / 2 + k * TAU);
      ctx.stroke();
    }
    if (p.hitMarker > 0) {
      ctx.strokeStyle = `rgba(255,70,50,${Math.min(1, p.hitMarker * 8)})`;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        ctx.moveTo(sx * 5, sy * 5);
        ctx.lineTo(sx * 11, sy * 11);
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawSticks() {
    const ctx = this.ctx;
    const R = this.input.stickRadius();
    for (const s of [this.input.moveStick, this.input.aimStick]) {
      if (!s.active) continue;
      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(s.ox, s.oy, R, 0, TAU);
      ctx.fill();
      ctx.stroke();
      const dx = s.x - s.ox;
      const dy = s.y - s.oy;
      const l = Math.min(R, Math.hypot(dx, dy));
      const a = Math.atan2(dy, dx);
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.beginPath();
      ctx.arc(s.ox + Math.cos(a) * l, s.oy + Math.sin(a) * l, 24, 0, TAU);
      ctx.fill();
    }
  }

  private drawMinimap() {
    const ctx = this.ctx;
    const mw = this.minimapW;
    const mh = (mw * WORLD_H) / WORLD_W;
    const x0 = this.cssW - mw - 12;
    const y0 = 12;
    const k = mw / WORLD_W;
    ctx.save();
    ctx.fillStyle = 'rgba(6,8,10,0.72)';
    ctx.strokeStyle = 'rgba(255,255,255,0.22)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(x0 - 3, y0 - 3, mw + 6, mh + 6, 6);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.rect(x0, y0, mw, mh);
    ctx.clip();
    ctx.fillStyle = 'rgba(70,72,78,0.5)';
    ctx.fillRect(x0, y0 + ROAD_H.y * k, mw, ROAD_H.h * k);
    ctx.fillRect(x0 + ROAD_V.x * k, y0, ROAD_V.w * k, mh);
    ctx.fillStyle = 'rgba(150,150,140,0.55)';
    for (const r of this.rects) ctx.fillRect(x0 + r.x * k, y0 + r.y * k, Math.max(1.5, r.w * k), Math.max(1.5, r.h * k));
    ctx.fillStyle = '#e8742a';
    for (const b of this.barrels) ctx.fillRect(x0 + b.x * k - 1, y0 + b.y * k - 1, 2.5, 2.5);
    for (const pk of this.pickups) {
      ctx.fillStyle = pickupColor(pk.kind);
      ctx.fillRect(x0 + pk.x * k - 1.5, y0 + pk.y * k - 1.5, 3, 3);
    }
    for (const z of this.zombies) {
      if (z.dead) continue;
      ctx.fillStyle = z.type === 'boss' ? '#ff9a30' : '#ff3a3a';
      const sz = z.type === 'boss' ? 5 : 2.4;
      ctx.fillRect(x0 + z.x * k - sz / 2, y0 + z.y * k - sz / 2, sz, sz);
    }
    const p = this.player;
    ctx.strokeStyle = 'rgba(255,255,255,0.45)';
    ctx.strokeRect(x0 + this.cam.x * k, y0 + this.cam.y * k, this.vw * k, this.vh * k);
    if (!p.dead) {
      ctx.fillStyle = '#4aff7a';
      ctx.beginPath();
      ctx.arc(x0 + p.x * k, y0 + p.y * k, 2.8, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }
}
