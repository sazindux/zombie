import type { HudSnapshot, ShopItem, UpgradeId, WeaponDef, WeaponId, ZType, ZombieDef } from './types';

export const WORLD_W = 2800;
export const WORLD_H = 2000;
export const MAX_GRENADES = 8;

export const WEAPON_ORDER: WeaponId[] = ['pistol', 'smg', 'shotgun', 'rifle', 'sniper', 'launcher'];

export const WEAPONS: Record<WeaponId, WeaponDef> = {
  pistol: {
    id: 'pistol', name: 'M9 Pistol', desc: 'Reliable sidearm. Infinite ammo.', auto: false,
    damage: 28, rate: 0.24, mag: 12, maxReserve: Infinity, pack: 0, ammoPrice: 0, reload: 1.0,
    spread: 0.03, pellets: 1, speed: 1300, range: 900, pierce: 0, knock: 110, cost: 0,
    shake: 1.5, recoil: 20, len: 14, color: '#ffd27a',
  },
  smg: {
    id: 'smg', name: 'MP7 SMG', desc: 'Blistering fire rate. Sprays a lot of lead.', auto: true,
    damage: 15, rate: 0.07, mag: 40, maxReserve: 320, pack: 80, ammoPrice: 70, reload: 1.5,
    spread: 0.09, pellets: 1, speed: 1400, range: 800, pierce: 0, knock: 55, cost: 350,
    shake: 1.6, recoil: 14, len: 20, color: '#ffd27a',
  },
  shotgun: {
    id: 'shotgun', name: 'Pump Shotgun', desc: 'Devastating up close. Wide spread of pellets.', auto: false,
    damage: 12, rate: 0.85, mag: 6, maxReserve: 54, pack: 12, ammoPrice: 90, reload: 2.1,
    spread: 0.2, pellets: 9, speed: 1150, range: 520, pierce: 0, knock: 190, cost: 500,
    shake: 7, recoil: 120, len: 30, color: '#ffb25a',
  },
  rifle: {
    id: 'rifle', name: 'AK Assault Rifle', desc: 'Strong all-rounder. Bullets punch through one target.', auto: true,
    damage: 24, rate: 0.095, mag: 30, maxReserve: 270, pack: 60, ammoPrice: 100, reload: 1.8,
    spread: 0.045, pellets: 1, speed: 1700, range: 1100, pierce: 1, knock: 90, cost: 850,
    shake: 2.4, recoil: 28, len: 32, color: '#ffe08a',
  },
  sniper: {
    id: 'sniper', name: 'Hunter Sniper', desc: 'One shot, many dead. Pierces up to five targets.', auto: false,
    damage: 150, rate: 0.9, mag: 5, maxReserve: 45, pack: 10, ammoPrice: 110, reload: 2.4,
    spread: 0.004, pellets: 1, speed: 3200, range: 1900, pierce: 4, knock: 320, cost: 1200,
    shake: 6, recoil: 70, len: 42, color: '#fff2b0',
  },
  launcher: {
    id: 'launcher', name: 'RPG Launcher', desc: 'Rockets with a huge blast radius. Handle with care.', auto: false,
    damage: 170, rate: 0.9, mag: 2, maxReserve: 22, pack: 4, ammoPrice: 180, reload: 2.6,
    spread: 0.01, pellets: 1, speed: 720, range: 1500, pierce: 0, knock: 0, cost: 2000,
    shake: 8, recoil: 90, len: 34, explosive: true, color: '#ff9a3a',
  },
};

export const ZOMBIES: Record<ZType, ZombieDef> = {
  walker: {
    name: 'Walker', hp: 60, speed: 64, dmg: 10, r: 14, pts: 10, mass: 1, cost: 1, minWave: 1, weight: 10, atk: 0.9,
    skins: ['#7c9a6b', '#8aa17a', '#97a888', '#6f8f62', '#86987a'],
    cloths: ['#4b3b2f', '#2f3f4f', '#5a2f2f', '#3d4d3a', '#4a4a4a', '#6b5b3a', '#35354a'],
  },
  runner: {
    name: 'Runner', hp: 36, speed: 150, dmg: 8, r: 12, pts: 15, mass: 0.8, cost: 1.6, minWave: 2, weight: 5, atk: 0.65,
    skins: ['#aebba3', '#b9c4ab', '#a3b098'],
    cloths: ['#7a2a2a', '#8a3a1a', '#33333f', '#5a1f1f'],
  },
  bloater: {
    name: 'Bloater', hp: 120, speed: 48, dmg: 12, r: 19, pts: 30, mass: 2, cost: 3, minWave: 3, weight: 2.5, atk: 1.1,
    skins: ['#9fb06a', '#a5b575'],
    cloths: ['#6a7040'],
  },
  brute: {
    name: 'Brute', hp: 330, speed: 60, dmg: 26, r: 22, pts: 45, mass: 4, cost: 5, minWave: 4, weight: 2, atk: 1.2,
    skins: ['#6d7a63', '#75806a'],
    cloths: ['#2c2c2c', '#3a2a22'],
  },
  spitter: {
    name: 'Spitter', hp: 55, speed: 72, dmg: 8, r: 14, pts: 28, mass: 1, cost: 2.5, minWave: 4, weight: 3, atk: 1,
    skins: ['#8ccf3a', '#7fc232'],
    cloths: ['#3a4a2a', '#2a3a2a'],
  },
  boss: {
    name: 'The Abomination', hp: 1900, speed: 82, dmg: 30, r: 38, pts: 600, mass: 14, cost: 0, minWave: 99, weight: 0, atk: 1.1,
    skins: ['#8a2f2f'],
    cloths: ['#2a0f0f'],
  },
};

export const UPGRADES: Record<UpgradeId, { name: string; desc: string; base: number; max: number }> = {
  vitality: { name: 'Vitality', desc: '+20 max health and heal 20.', base: 250, max: 5 },
  firepower: { name: 'Firepower', desc: '+12% weapon damage.', base: 300, max: 5 },
  agility: { name: 'Agility', desc: '+6% move speed & stamina.', base: 200, max: 5 },
  hands: { name: 'Quick Hands', desc: '-12% reload time.', base: 220, max: 5 },
};

export const UPGRADE_ORDER: UpgradeId[] = ['vitality', 'firepower', 'agility', 'hands'];

export const MEDKIT_COST = 120;
export const GRENADE_COST = 100;

export function buildShop(s: Pick<HudSnapshot, 'weapons' | 'hp' | 'maxHp' | 'grenades' | 'upgrades'>): ShopItem[] {
  const items: ShopItem[] = [];
  for (const id of WEAPON_ORDER) {
    if (id === 'pistol') continue;
    const w = WEAPONS[id];
    items.push({
      id: `weapon:${id}`, group: 'weapon', name: w.name, desc: w.desc, cost: w.cost,
      state: s.weapons[id].owned ? 'owned' : 'ok', weapon: id,
    });
  }
  for (const id of WEAPON_ORDER) {
    if (id === 'pistol') continue;
    const w = WEAPONS[id];
    const slot = s.weapons[id];
    if (!slot.owned) continue;
    items.push({
      id: `ammo:${id}`, group: 'ammo', name: `${w.name} ammo`, desc: `+${w.pack} rounds (${slot.reserve}/${w.maxReserve})`,
      cost: w.ammoPrice, state: slot.reserve >= w.maxReserve ? 'full' : 'ok', weapon: id,
    });
  }
  items.push({
    id: 'medkit', group: 'supply', name: 'Medkit', desc: 'Restore 50 health.', cost: MEDKIT_COST,
    state: s.hp >= s.maxHp ? 'full' : 'ok',
  });
  items.push({
    id: 'grenades', group: 'supply', name: 'Grenades x3', desc: `Frag grenades (${s.grenades}/${MAX_GRENADES}). Right-click or G.`, cost: GRENADE_COST,
    state: s.grenades >= MAX_GRENADES ? 'full' : 'ok',
  });
  for (const id of UPGRADE_ORDER) {
    const u = UPGRADES[id];
    const lvl = s.upgrades[id];
    items.push({
      id: `upgrade:${id}`, group: 'upgrade', name: u.name, desc: u.desc, cost: u.base * (lvl + 1),
      state: lvl >= u.max ? 'maxed' : 'ok', level: lvl, maxLevel: u.max,
    });
  }
  return items;
}
