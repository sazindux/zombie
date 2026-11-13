import type { Game } from '../game/engine';
import type { HudSnapshot } from '../game/types';

const fmt = (n: number) => Math.floor(n).toLocaleString('en-US');
const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

function Key({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-block min-w-7 rounded border border-white/30 bg-white/10 px-1.5 py-0.5 text-center font-display text-xs tracking-wider text-white shadow-[0_2px_0_rgba(255,255,255,0.15)]">
      {children}
    </kbd>
  );
}

function Btn({
  children, onClick, variant = 'primary',
}: { children: React.ReactNode; onClick: () => void; variant?: 'primary' | 'ghost' }) {
  return (
    <button
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={`rounded px-8 py-3 font-display text-xl uppercase tracking-[0.25em] transition active:scale-95 sm:text-2xl ${
        variant === 'primary'
          ? 'bg-red-700 text-white shadow-lg shadow-red-900/60 hover:bg-red-600'
          : 'bg-white/10 text-white/80 ring-1 ring-white/25 hover:bg-white/20'
      }`}
    >
      {children}
    </button>
  );
}

export function Menu({ hud, game }: { hud: HudSnapshot; game: Game | null }) {
  return (
    <div className="scanlines absolute inset-0 z-20 flex flex-col items-center justify-center overflow-y-auto bg-[radial-gradient(ellipse_at_center,rgba(0,0,0,0.35)_0%,rgba(0,0,0,0.85)_75%)] px-4 py-6 text-center text-white">
      <div className="animate-fade-up">
        <div className="font-display text-xs uppercase tracking-[0.6em] text-red-400 sm:text-sm">Top-down survival shooter</div>
        <h1
          className="animate-flicker font-display text-6xl uppercase leading-none tracking-wider text-red-600 sm:text-8xl md:text-9xl"
          style={{ textShadow: '0 0 40px rgba(220,38,38,0.6), 0 4px 0 #1a0000, 0 0 3px #000' }}
        >
          Dead Sector
        </h1>
        <p className="mx-auto mt-3 max-w-md font-body text-sm text-white/65 sm:text-base">
          The outbreak has swallowed the city. One flashlight, one pistol and a long night. Hold the sector, wave after wave.
        </p>
      </div>

      <div className="animate-fade-up mt-7 flex flex-col items-center gap-3" style={{ animationDelay: '0.15s' }}>
        <Btn onClick={() => game?.startGame()}>Deploy</Btn>
        <div className="font-display text-xs uppercase tracking-[0.3em] text-white/45">
          Press <span className="text-white/80">Enter</span> to start
        </div>
        {hud.over.best > 0 && (
          <div className="font-display text-sm uppercase tracking-[0.3em] text-amber-300">Best score: {fmt(hud.over.best)}</div>
        )}
      </div>

      <div
        className="animate-fade-up mt-7 grid max-w-3xl grid-cols-1 gap-x-8 gap-y-2 rounded-lg bg-black/55 px-6 py-4 text-left font-body text-sm text-white/75 ring-1 ring-white/10 sm:grid-cols-2"
        style={{ animationDelay: '0.3s' }}
      >
        <div className="flex items-center gap-2">
          <span className="flex gap-1">
            <Key>W</Key>
            <Key>A</Key>
            <Key>S</Key>
            <Key>D</Key>
          </span>
          Move
        </div>
        <div className="flex items-center gap-2">
          <Key>Shift</Key> Sprint (uses stamina)
        </div>
        <div className="flex items-center gap-2">
          <Key>Mouse</Key> Aim · <Key>L-Click</Key> Fire
        </div>
        <div className="flex items-center gap-2">
          <Key>R</Key> Reload · <Key>1-6</Key> / <Key>Wheel</Key> Weapon
        </div>
        <div className="flex items-center gap-2">
          <Key>R-Click</Key> / <Key>G</Key> Throw grenade
        </div>
        <div className="flex items-center gap-2">
          <Key>Esc</Key> Pause · <Key>M</Key> Mute
        </div>
        <div className="col-span-full mt-1 text-xs text-white/45">
          Shoot red barrels to blow up the horde. Grab pickups from fallen zombies. Spend points in the Supply Depot between waves. Touch
          devices: left thumb moves, right thumb aims &amp; fires.
        </div>
      </div>
    </div>
  );
}

export function PauseScreen({ game }: { game: Game | null }) {
  return (
    <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/70 text-center backdrop-blur-sm">
      <h2 className="animate-fade-up font-display text-6xl uppercase tracking-[0.2em] text-white sm:text-8xl">Paused</h2>
      <div className="animate-fade-up mt-8 flex flex-col gap-3" style={{ animationDelay: '0.1s' }}>
        <Btn onClick={() => game?.resume()}>Resume</Btn>
        <Btn variant="ghost" onClick={() => game?.startGame()}>
          Restart
        </Btn>
        <Btn variant="ghost" onClick={() => game?.goMenu()}>
          Main menu
        </Btn>
      </div>
      <div className="mt-6 font-display text-xs uppercase tracking-[0.3em] text-white/40">Press Esc to resume</div>
    </div>
  );
}

export function GameOver({ hud, game }: { hud: HudSnapshot; game: Game | null }) {
  const o = hud.over;
  return (
    <div className="scanlines absolute inset-0 z-30 flex flex-col items-center justify-center bg-[radial-gradient(ellipse_at_center,rgba(60,0,0,0.55)_0%,rgba(0,0,0,0.92)_80%)] px-4 text-center text-white">
      <h2
        className="animate-fade-up font-display text-7xl uppercase tracking-wider text-red-600 sm:text-9xl"
        style={{ textShadow: '0 0 40px rgba(220,38,38,0.6), 0 4px 0 #1a0000' }}
      >
        You died
      </h2>
      <div className="animate-fade-up mt-2 font-display text-lg uppercase tracking-[0.35em] text-white/60" style={{ animationDelay: '0.1s' }}>
        The horde devoured you on wave {o.wave}
      </div>
      <div
        className="animate-fade-up mt-8 grid grid-cols-2 gap-3 font-display uppercase tracking-wider sm:grid-cols-4"
        style={{ animationDelay: '0.2s' }}
      >
        {[
          ['Score', fmt(o.score)],
          ['Wave', String(o.wave)],
          ['Kills', String(o.kills)],
          ['Survived', fmtTime(o.time)],
        ].map(([l, v]) => (
          <div key={l} className="min-w-28 rounded-lg bg-black/60 px-5 py-3 ring-1 ring-white/15">
            <div className="text-[10px] tracking-[0.3em] text-white/45">{l}</div>
            <div className="text-3xl text-white">{v}</div>
          </div>
        ))}
      </div>
      <div className="mt-4 font-display text-lg uppercase tracking-[0.3em]">
        {o.newBest ? (
          <span className="text-amber-300">★ New high score! ★</span>
        ) : (
          <span className="text-white/50">Best: {fmt(o.best)}</span>
        )}
      </div>
      <div className="animate-fade-up mt-8 flex flex-wrap justify-center gap-3" style={{ animationDelay: '0.3s' }}>
        <Btn onClick={() => game?.startGame()}>Try again</Btn>
        <Btn variant="ghost" onClick={() => game?.goMenu()}>
          Main menu
        </Btn>
      </div>
      <div className="mt-4 font-display text-xs uppercase tracking-[0.3em] text-white/40">Press Enter to retry</div>
    </div>
  );
}
