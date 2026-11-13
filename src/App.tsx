import { useEffect, useRef, useState } from 'react';
import { Game } from './game/engine';
import type { HudSnapshot, Phase } from './game/types';
import { Hud } from './components/Hud';
import { Shop } from './components/Shop';
import { GameOver, Menu, PauseScreen } from './components/Screens';

const EMPTY: HudSnapshot = {
  hp: 100, maxHp: 100, stamina: 100, points: 0, score: 0, wave: 0, kills: 0, remaining: 0, combo: 0, comboT: 0,
  weapon: 'pistol',
  weapons: {
    pistol: { owned: true, ammo: 12, reserve: Infinity },
    smg: { owned: false, ammo: 0, reserve: 0 },
    shotgun: { owned: false, ammo: 0, reserve: 0 },
    rifle: { owned: false, ammo: 0, reserve: 0 },
    sniper: { owned: false, ammo: 0, reserve: 0 },
    launcher: { owned: false, ammo: 0, reserve: 0 },
  },
  reload: -1, grenades: 2, upgrades: { vitality: 0, firepower: 0, agility: 0, hands: 0 }, powerups: [],
  boss: null, banner: null, time: 0, hurt: 0, muted: false,
  over: { score: 0, wave: 0, kills: 0, time: 0, best: 0, newBest: false },
};

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [game, setGame] = useState<Game | null>(null);
  const [phase, setPhase] = useState<Phase>('menu');
  const [hud, setHud] = useState<HudSnapshot>(EMPTY);
  const [touch] = useState(
    () => typeof window !== 'undefined' && (window.matchMedia?.('(pointer: coarse)').matches || 'ontouchstart' in window),
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const g = new Game(canvas, { onPhase: setPhase, onHud: setHud });
    setGame(g);
    return () => {
      g.destroy();
      setGame(null);
    };
  }, []);

  const inGame = phase === 'playing' || phase === 'paused' || phase === 'shop' || phase === 'gameover';

  return (
    <div className="relative h-full w-full overflow-hidden bg-black">
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
      {inGame && phase !== 'gameover' && <Hud hud={hud} game={game} phase={phase} touch={touch} />}
      {phase === 'menu' && <Menu hud={hud} game={game} />}
      {phase === 'shop' && <Shop hud={hud} game={game} />}
      {phase === 'paused' && <PauseScreen game={game} />}
      {phase === 'gameover' && <GameOver hud={hud} game={game} />}
    </div>
  );
}
