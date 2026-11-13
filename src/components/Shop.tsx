import { buildShop, WEAPONS } from '../game/config';
import type { Game } from '../game/engine';
import type { HudSnapshot, ShopItem } from '../game/types';
import { WeaponIcon } from './WeaponIcon';

const fmt = (n: number) => Math.floor(n).toLocaleString('en-US');

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded bg-black/40 px-2 py-1 text-center">
      <div className="text-[10px] text-white/40">{label}</div>
      <div className="text-sm text-white/90">{value}</div>
    </div>
  );
}

function Card({ item, points, onBuy }: { item: ShopItem; points: number; onBuy: (id: string) => void }) {
  const afford = points >= item.cost;
  const buyable = item.state === 'ok';
  const w = item.weapon ? WEAPONS[item.weapon] : null;
  return (
    <div
      className={`flex flex-col rounded-lg p-3 ring-1 transition ${
        item.state === 'owned' || item.state === 'maxed'
          ? 'bg-emerald-950/30 ring-emerald-700/40'
          : buyable && afford
            ? 'bg-zinc-900/90 ring-white/20 hover:ring-red-500/70'
            : 'bg-zinc-900/60 ring-white/10'
      }`}
    >
      <div className="flex items-center gap-3">
        {w && <WeaponIcon id={w.id} className="h-7 w-16 shrink-0 text-white/85" />}
        <div className="min-w-0 flex-1">
          <div className="truncate text-lg leading-tight tracking-wide text-white">{item.name}</div>
          {item.maxLevel !== undefined && (
            <div className="mt-1 flex gap-1">
              {Array.from({ length: item.maxLevel }).map((_, i) => (
                <span key={i} className={`h-1.5 w-5 rounded-sm ${i < (item.level ?? 0) ? 'bg-red-500' : 'bg-white/15'}`} />
              ))}
            </div>
          )}
        </div>
      </div>
      <p className="mt-1.5 flex-1 font-body text-xs normal-case leading-snug tracking-normal text-white/55">{item.desc}</p>
      {item.group === 'weapon' && w && (
        <div className="mt-2 grid grid-cols-4 gap-1.5">
          <Stat label="DMG" value={`${Math.round(w.damage)}${w.pellets > 1 ? `×${w.pellets}` : ''}`} />
          <Stat label="RPM" value={`${Math.round(60 / w.rate)}`} />
          <Stat label="MAG" value={`${w.mag}`} />
          <Stat label="PIERCE" value={w.explosive ? 'AoE' : `${w.pierce}`} />
        </div>
      )}
      <button
        disabled={!buyable}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => onBuy(item.id)}
        className={`mt-3 rounded py-1.5 text-base tracking-widest transition ${
          item.state === 'owned'
            ? 'cursor-default bg-emerald-900/40 text-emerald-300'
            : item.state === 'maxed'
              ? 'cursor-default bg-emerald-900/40 text-emerald-300'
              : item.state === 'full'
                ? 'cursor-default bg-white/5 text-white/35'
                : afford
                  ? 'bg-red-700 text-white hover:bg-red-600 active:scale-[0.98]'
                  : 'cursor-not-allowed bg-white/5 text-red-400/70'
        }`}
      >
        {item.state === 'owned' ? 'Owned' : item.state === 'maxed' ? 'Maxed' : item.state === 'full' ? 'Full' : `$ ${fmt(item.cost)}`}
      </button>
    </div>
  );
}

const GROUPS: { id: ShopItem['group']; title: string; sub: string }[] = [
  { id: 'weapon', title: 'Arsenal', sub: 'New weapons — auto-equipped on purchase' },
  { id: 'ammo', title: 'Ammunition', sub: 'Restock your reserves' },
  { id: 'supply', title: 'Supplies', sub: 'Healing & explosives' },
  { id: 'upgrade', title: 'Upgrades', sub: 'Permanent improvements' },
];

export function Shop({ hud, game }: { hud: HudSnapshot; game: Game | null }) {
  const items = buildShop(hud);
  const onBuy = (id: string) => game?.buy(id);
  return (
    <div className="absolute inset-0 z-20 flex flex-col bg-black/85 font-display uppercase tracking-wider text-white backdrop-blur-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-red-900/60 bg-gradient-to-b from-red-950/50 to-transparent px-4 py-3 sm:px-8 sm:py-4">
        <div>
          <div className="text-xs tracking-[0.4em] text-red-400">Wave {hud.wave} survived</div>
          <h2 className="text-3xl sm:text-5xl">Supply Depot</h2>
        </div>
        <div className="flex items-center gap-4 sm:gap-8">
          <div className="text-right">
            <div className="text-[10px] tracking-[0.3em] text-white/40">Health</div>
            <div className="text-xl sm:text-2xl">
              {Math.ceil(hud.hp)}
              <span className="text-sm text-white/40"> / {hud.maxHp}</span>
            </div>
          </div>
          <div className="text-right">
            <div className="text-[10px] tracking-[0.3em] text-white/40">Score</div>
            <div className="text-xl sm:text-2xl">{fmt(hud.score)}</div>
          </div>
          <div className="rounded-lg bg-black/60 px-4 py-2 text-right ring-1 ring-amber-400/50">
            <div className="text-[10px] tracking-[0.3em] text-amber-300/70">Points</div>
            <div className="text-2xl text-amber-300 sm:text-3xl">$ {fmt(hud.points)}</div>
          </div>
        </div>
      </div>

      <div className="shop-scroll flex-1 overflow-y-auto px-4 py-4 sm:px-8">
        {GROUPS.map((g) => {
          const list = items.filter((i) => i.group === g.id);
          if (!list.length) return null;
          return (
            <section key={g.id} className="mb-6">
              <div className="mb-2 flex items-baseline gap-3">
                <h3 className="text-xl text-red-500 sm:text-2xl">{g.title}</h3>
                <span className="font-body text-xs normal-case tracking-normal text-white/40">{g.sub}</span>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {list.map((it) => (
                  <Card key={it.id} item={it} points={hud.points} onBuy={onBuy} />
                ))}
              </div>
            </section>
          );
        })}
      </div>

      <div className="flex items-center justify-between gap-4 border-t border-red-900/60 bg-black/70 px-4 py-3 sm:px-8">
        <div className="hidden font-body text-xs normal-case tracking-normal text-white/45 sm:block">
          Zombies get faster, tougher and nastier every wave. A boss arrives every 5th wave.
        </div>
        <button
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => game?.nextWave()}
          className="ml-auto rounded bg-red-700 px-6 py-3 text-xl tracking-[0.2em] text-white shadow-lg shadow-red-900/50 transition hover:bg-red-600 active:scale-95 sm:px-10 sm:text-2xl"
        >
          Start Wave {hud.wave + 1} <span className="ml-2 text-xs text-white/60">[ENTER]</span>
        </button>
      </div>
    </div>
  );
}
