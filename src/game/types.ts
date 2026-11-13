export type Phase = 'menu' | 'playing' | 'shop' | 'paused' | 'gameover';
export type WeaponId = 'pistol' | 'smg' | 'shotgun' | 'rifle' | 'sniper' | 'launcher';
export type ZType = 'walker' | 'runner' | 'brute' | 'spitter' | 'bloater' | 'boss';
export type UpgradeId = 'vitality' | 'firepower' | 'agility' | 'hands';
export type PowerId = 'damage' | 'rapid';
export type PickupKind = 'health' | 'ammo' | 'grenade' | 'damage' | 'rapid' | 'nuke';

export interface WeaponDef {
  id: WeaponId;
  name: string;
  desc: string;
  auto: boolean;
  damage: number;
  rate: number; // seconds between shots
  mag: number;
  maxReserve: number; // Infinity for pistol
  pack: number; // rounds per ammo pack in shop
  ammoPrice: number;
  reload: number;
  spread: number;
  pellets: number;
  speed: number;
  range: number;
  pierce: number;
  knock: number;
  cost: number;
  shake: number;
  recoil: number;
  len: number;
  explosive?: boolean;
  color: string;
}

export interface ZombieDef {
  name: string;
  hp: number;
  speed: number;
  dmg: number;
  r: number;
  pts: number;
  mass: number;
  cost: number;
  minWave: number;
  weight: number;
  atk: number;
  skins: string[];
  cloths: string[];
}

export interface WeaponSlot {
  owned: boolean;
  ammo: number;
  reserve: number;
}

export type ZState = 'chase' | 'windup' | 'charge' | 'slam' | 'stun' | 'spit';

export interface Zombie {
  id: number;
  type: ZType;
  x: number;
  y: number;
  kx: number;
  ky: number;
  hp: number;
  maxHp: number;
  r: number;
  mass: number;
  speed: number;
  dmg: number;
  angle: number;
  anim: number;
  flash: number;
  atkCd: number;
  skin: string;
  cloth: string;
  hair: string;
  turn: number;
  groanT: number;
  spitCd: number;
  state: ZState;
  st: number;
  abilityT: number;
  nextMove: 'charge' | 'slam';
  chargeDir: number;
  hitDone: boolean;
  stun: number;
  dead: boolean;
  tx: number;
  ty: number;
  enraged: boolean;
}

export interface Player {
  x: number;
  y: number;
  r: number;
  vx: number;
  vy: number;
  angle: number;
  hp: number;
  maxHp: number;
  stamina: number;
  exhausted: boolean;
  staminaDelay: number;
  sprinting: boolean;
  weapon: WeaponId;
  last: WeaponId;
  ws: Record<WeaponId, WeaponSlot>;
  fireCd: number;
  trig: boolean;
  reloading: boolean;
  reloadT: number;
  reloadTime: number;
  grenades: number;
  flash: number;
  hurt: number;
  iframes: number;
  walk: number;
  dead: boolean;
  up: Record<UpgradeId, number>;
  power: Record<PowerId, number>;
  kick: number;
  hitMarker: number;
  heartT: number;
  slow: number;
}

export interface Bullet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  dmg: number;
  range: number;
  dist: number;
  pierce: number;
  knock: number;
  rocket: boolean;
  hit: number[];
  dead: boolean;
  len: number;
}

export interface Spit {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  dead: boolean;
}

export interface Grenade {
  x: number;
  y: number;
  vx: number;
  vy: number;
  fuse: number;
  spin: number;
}

export type ParticleKind = 'blood' | 'spark' | 'smoke' | 'fire' | 'casing' | 'gib' | 'gas' | 'acid';

export interface Particle {
  kind: ParticleKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  color: string;
  drag: number;
  rot: number;
  vr: number;
  stamp: boolean;
}

export interface Pickup {
  x: number;
  y: number;
  kind: PickupKind;
  life: number;
  t: number;
  weapon?: WeaponId;
}

export interface Blast {
  x: number;
  y: number;
  t: number;
  r: number;
  color: string;
}

export interface Floater {
  x: number;
  y: number;
  text: string;
  color: string;
  t: number;
  life: number;
  size: number;
}

export interface HudSnapshot {
  hp: number;
  maxHp: number;
  stamina: number;
  points: number;
  score: number;
  wave: number;
  kills: number;
  remaining: number;
  combo: number;
  comboT: number;
  weapon: WeaponId;
  weapons: Record<WeaponId, WeaponSlot>;
  reload: number; // -1 when not reloading, else 0..1
  grenades: number;
  upgrades: Record<UpgradeId, number>;
  powerups: { id: PowerId; t: number }[];
  boss: null | { hp: number; max: number; name: string };
  banner: null | { id: number; title: string; sub: string };
  time: number;
  hurt: number;
  muted: boolean;
  over: { score: number; wave: number; kills: number; time: number; best: number; newBest: boolean };
}

export interface GameCallbacks {
  onPhase: (p: Phase) => void;
  onHud: (h: HudSnapshot) => void;
}

export type ShopGroup = 'weapon' | 'ammo' | 'supply' | 'upgrade';

export interface ShopItem {
  id: string;
  group: ShopGroup;
  name: string;
  desc: string;
  cost: number;
  state: 'ok' | 'owned' | 'maxed' | 'full';
  level?: number;
  maxLevel?: number;
  weapon?: WeaponId;
}
