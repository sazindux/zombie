import { WEAPON_ORDER, WEAPONS } from '../game/config';
import type { Game } from '../game/engine';
import type { HudSnapshot, Phase } from '../game/types';
import { WeaponIcon } from './WeaponIcon';

const fmt = (n: number) => Math.floor(n).toLocaleString('en-US');
const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

function Bar({
  value, max, color, h = 'h-3', className = '',
}: { value: number; max: number; color: string; h?: string; className?: string }) {
  return (
    <div className={`relative w-full overflow-hidden rounded-sm bg-black/60 ring-1 ring-white/15 ${h} ${className}`}>
      <div className="absolute inset-y-0 left-0 transition-[width] duration-150" style={{ width: `${Math.max(0, Math.min(1, value / max)) * 100}%`, background: color }} />
      <div className="absolute inset-x-0 top-0 h-1/2 bg-white/15" />
    </div>
  );
}

export function Hud({ hud, game, phase, touch }: { hud: HudSnapshot; game: Game | null; phase: Phase; touch: boolean }) {
  const slot = hud.weapons[hud.weapon];
  const w = WEAPONS[hud.weapon];
  const lowHp = hud.hp < hud.maxHp * 0.3;
  const reserveTxt = Number.isFinite(slot.reserve) ? slot.reserve : '∞';
  const empty = slot.ammo === 0;

  return (
    <div className="pointer-events-none absolute inset-0 z-10 font-display uppercase tracking-wider text-white">
      {/* top-left: score */}
      <div className="absolute left-3 top-3 sm:left-5 sm:top-4">
        <div className="text-outline text-3xl leading-none sm:text-5xl">{fmt(hud.score)}</div>
        <div className="mt-1 flex items-center gap-3 text-xs text-white/70 sm:text-sm">
          <span>
            Kills <b className="text-white">{hud.kills}</b>
          </span>
          <span>
            Time <b className="text-white">{fmtTime(hud.time)}</b>
          </span>
        </div>
        <div className="mt-1.5 inline-flex items-center gap-2 rounded bg-black/55 px-2.5 py-1 text-base text-amber-300 ring-1 ring-amber-300/30 sm:text-lg">
          <span className="text-amber-400">$</span>
          {fmt(hud.points)}
        </div>
      </div>

      {/* top-center: wave */}
      <div className="absolute left-1/2 top-3 w-[min(60vw,520px)] -translate-x-1/2 text-center sm:top-4">
        <div className="text-outline text-lg sm:text-2xl">
          Wave <span className="text-red-500">{hud.wave}</span>
          <span className="mx-2 text-white/30">|</span>
          <span className="text-white/80">{hud.remaining}</span>
          <span className="text-sm text-white/50"> left</span>
        </div>
        {hud.boss && (
          <div className="mt-2">
            <div className="text-outline text-sm tracking-[0.3em] text-orange-400">{hud.boss.name}</div>
            <div className="relative mt-1 h-4 overflow-hidden rounded-sm bg-black/70 ring-2 ring-red-900">
              <div
                className="absolute inset-y-0 left-0 bg-gradient-to-r from-red-800 via-red-600 to-orange-500 transition-[width] duration-200"
                style={{ width: `${(hud.boss.hp / hud.boss.max) * 100}%` }}
              />
              <div className="absolute inset-x-0 top-0 h-1/2 bg-white/15" />
            </div>
          </div>
        )}
      </div>

      {/* combo */}
      {hud.combo >= 2 && (
        <div className="absolute right-3 top-48 text-right sm:right-5 sm:top-52">
          <div key={hud.combo} className="text-outline text-3xl text-yellow-300 sm:text-4xl" style={{ animation: 'pop 0.25s ease-out' }}>
            {hud.combo}x COMBO
          </div>
          <div className="ml-auto mt-1 h-1.5 w-28 overflow-hidden rounded bg-black/60">
            <div className="h-full bg-yellow-300 transition-[width] duration-100" style={{ width: `${hud.comboT * 100}%` }} />
          </div>
          <div className="mt-0.5 text-xs text-yellow-200/80">+{Math.min(hud.combo, 20) * 5}% points</div>
        </div>
      )}

      {/* side buttons */}
      <div className="pointer-events-auto absolute right-3 top-[132px] flex gap-1.5 sm:right-5 sm:top-[148px]">
        <HudBtn onClick={() => game?.toggleMute()} title="Mute (M)">
          {hud.muted ? 'MUTED' : 'SOUND'}
        </HudBtn>
        <HudBtn onClick={() => game?.pause()} title="Pause (Esc)">
          PAUSE
        </HudBtn>
      </div>

      {/* bottom-left: health */}
      <div className="absolute bottom-3 left-3 w-[min(46vw,300px)] sm:bottom-5 sm:left-5">
        <div className="flex items-end gap-2">
          <span className={`text-outline text-4xl leading-none sm:text-5xl ${lowHp ? 'text-red-500' : 'text-white'}`}>
            {Math.ceil(hud.hp)}
          </span>
          <span className="pb-1 text-sm text-white/60">/ {hud.maxHp} HP</span>
        </div>
        <Bar
          value={hud.hp}
          max={hud.maxHp}
          h="h-4"
          color={lowHp ? 'linear-gradient(90deg,#7f1d1d,#dc2626)' : 'linear-gradient(90deg,#b91c1c,#ef4444)'}
          className={lowHp ? 'animate-pulse-red' : ''}
        />
        <Bar value={hud.stamina} max={100 * (1 + 0.06 * hud.upgrades.agility)} h="h-1.5" color="linear-gradient(90deg,#ca8a04,#fde047)" className="mt-1.5" />
        <div className="mt-1 text-[10px] text-white/45">Stamina — hold shift to sprint</div>
        {hud.powerups.length > 0 && (
          <div className="mt-2 flex gap-2">
            {hud.powerups.map((p) => (
              <div
                key={p.id}
                className={`w-24 rounded px-2 py-1 text-xs ring-1 ${
                  p.id === 'damage' ? 'bg-orange-950/80 text-orange-300 ring-orange-500/60' : 'bg-cyan-950/80 text-cyan-300 ring-cyan-500/60'
                }`}
              >
                {p.id === 'damage' ? '2x Damage' : 'Rapid Fire'}
                <div className="mt-1 h-1 rounded bg-black/60">
                  <div className={`h-full rounded ${p.id === 'damage' ? 'bg-orange-400' : 'bg-cyan-400'}`} style={{ width: `${p.t * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* bottom-right: weapon */}
      <div className="absolute bottom-3 right-3 w-[min(50vw,330px)] text-right sm:bottom-5 sm:right-5">
        <div className="flex items-center justify-end gap-3">
          <div className="text-sm text-white/70 sm:text-base">{w.name}</div>
          <WeaponIcon id={hud.weapon} className="h-6 w-16 text-white/90 sm:h-7 sm:w-20" />
        </div>
        <div className="flex items-end justify-end gap-2 leading-none">
          <span className={`text-outline text-5xl sm:text-6xl ${empty ? 'text-red-500' : 'text-white'}`}>{slot.ammo}</span>
          <span className="pb-1 text-xl text-white/55 sm:text-2xl">/ {reserveTxt}</span>
        </div>
        <div className="mt-1 h-1.5 w-full overflow-hidden rounded bg-black/60">
          {hud.reload >= 0 && <div className="h-full bg-amber-300" style={{ width: `${hud.reload * 100}%` }} />}
        </div>
        <div className="mt-0.5 h-4 text-xs text-amber-300">
          {hud.reload >= 0 ? 'Reloading…' : empty && slot.reserve === 0 ? 'Out of ammo!' : slot.ammo <= w.mag * 0.25 ? 'Press R to reload' : ''}
        </div>
        <div className="mt-1 flex items-center justify-end gap-1.5">
          {WEAPON_ORDER.map((id, i) => {
            const s = hud.weapons[id];
            const active = hud.weapon === id;
            return (
              <button
                key={id}
                disabled={!s.owned}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => game?.selectWeapon(id)}
                className={`pointer-events-auto relative flex h-9 w-11 items-center justify-center rounded ring-1 transition sm:h-10 sm:w-14 ${
                  active
                    ? 'bg-red-900/70 text-white ring-red-400'
                    : s.owned
                      ? 'bg-black/60 text-white/70 ring-white/20 hover:bg-black/80'
                      : 'bg-black/30 text-white/15 ring-white/10'
                }`}
              >
                <span className="absolute left-1 top-0 text-[9px] text-white/50">{i + 1}</span>
                <WeaponIcon id={id} className="h-4 w-8 sm:h-5 sm:w-10" />
              </button>
            );
          })}
        </div>
        <div className="mt-2 flex items-center justify-end gap-2 text-sm text-lime-300">
          <span className="text-white/50">Grenades (G / R-click)</span>
          <span className="inline-flex items-center gap-1 rounded bg-black/55 px-2 py-0.5 ring-1 ring-lime-400/30">
            <span className="inline-block h-3 w-3 rounded-full bg-lime-500" />
            {hud.grenades}
          </span>
        </div>
      </div>

      {/* touch buttons */}
      {touch && phase === 'playing' && (
        <div className="pointer-events-auto absolute bottom-40 right-3 flex flex-col gap-2 sm:bottom-48">
          <TouchBtn label="Reload" onPress={() => game?.input.pressed.add('KeyR')} />
          <TouchBtn label="Nade" onPress={() => game?.input.pressed.add('KeyG')} />
          <TouchBtn label="Swap" onPress={() => game?.input.pressed.add('KeyE')} />
          <TouchBtn
            label="Sprint"
            onPress={() => game?.input.keys.add('ShiftLeft')}
            onRelease={() => game?.input.keys.delete('ShiftLeft')}
          />
        </div>
      )}

      {/* banner */}
      {hud.banner && (
        <div className="absolute inset-x-0 top-[22%] flex justify-center px-4 text-center">
          <div key={hud.banner.id} className="animate-banner opacity-0">
            <div className="text-outline text-5xl text-red-500 sm:text-7xl md:text-8xl" style={{ textShadow: '0 0 30px rgba(220,38,38,0.7), 0 3px 0 #000' }}>
              {hud.banner.title}
            </div>
            <div className="text-outline mt-1 text-lg tracking-[0.3em] text-white/80 sm:text-2xl">{hud.banner.sub}</div>
          </div>
        </div>
      )}
    </div>
  );
}

function HudBtn({ children, onClick, title }: { children: React.ReactNode; onClick: () => void; title: string }) {
  return (
    <button
      title={title}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className="flex h-7 items-center justify-center rounded bg-black/60 px-2 font-display text-[11px] uppercase tracking-wider text-white/80 ring-1 ring-white/20 transition hover:bg-black/80 hover:text-white"
    >
      {children}
    </button>
  );
}

function TouchBtn({ label, onPress, onRelease }: { label: string; onPress: () => void; onRelease?: () => void }) {
  return (
    <button
      onPointerDown={(e) => {
        e.preventDefault();
        onPress();
      }}
      onPointerUp={() => onRelease?.()}
      onPointerLeave={() => onRelease?.()}
      onPointerCancel={() => onRelease?.()}
      className="h-12 w-16 rounded-lg bg-black/55 font-display text-xs uppercase tracking-wider text-white/90 ring-1 ring-white/30 active:bg-red-800/70"
    >
      {label}
    </button>
  );
}
