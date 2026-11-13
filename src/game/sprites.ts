import type { Pickup, Player, WeaponDef, Zombie, ZType } from './types';
import type { Barrel, Lamp, Rect } from './world';

const TAU = Math.PI * 2;

interface Visual {
  bw: number; // body half-width (shoulders)
  bh: number; // body half-thickness
  head: number;
  arm: number;
  aw: number;
}

const VIS: Record<ZType, Visual> = {
  walker: { bw: 11.5, bh: 7.5, head: 7.5, arm: 15, aw: 4 },
  runner: { bw: 9.5, bh: 6, head: 6.8, arm: 15, aw: 3.2 },
  bloater: { bw: 15, bh: 14, head: 5.5, arm: 11, aw: 4.5 },
  brute: { bw: 13, bh: 9, head: 7, arm: 16, aw: 6.5 },
  spitter: { bw: 10, bh: 6.5, head: 7, arm: 12, aw: 3.4 },
  boss: { bw: 13, bh: 9, head: 6.5, arm: 17, aw: 6 },
};

export function drawZombie(ctx: CanvasRenderingContext2D, z: Zombie, dead = false) {
  const v = VIS[z.type];
  const s = z.r / 14;
  ctx.save();
  ctx.translate(z.x, z.y);
  ctx.rotate(z.angle);
  ctx.scale(s, s);

  let shake = 0;
  if (z.state === 'windup') shake = Math.sin(z.anim * 8) * 1.2;
  if (shake) ctx.translate(0, shake);

  if (!dead) {
    ctx.fillStyle = 'rgba(0,0,0,0.38)';
    ctx.beginPath();
    ctx.ellipse(2, 3, v.bh + 4, v.bw + 3, 0, 0, TAU);
    ctx.fill();
  }

  const sw = Math.sin(z.anim);
  // feet
  if (!dead) {
    ctx.fillStyle = '#17181a';
    ctx.beginPath();
    ctx.ellipse(sw * 7, -v.bw * 0.5, 4.5, 3, 0, 0, TAU);
    ctx.ellipse(-sw * 7, v.bw * 0.5, 4.5, 3, 0, 0, TAU);
    ctx.fill();
  }

  // arms
  const swing = dead ? 0 : Math.sin(z.anim * 0.5) * 0.18;
  const spread = dead ? 0.9 : z.state === 'windup' ? -0.3 : 0;
  for (const side of [-1, 1]) {
    const a = side * (spread + 0.12) + swing * side;
    const sx = 2;
    const sy = side * (v.bw - 2);
    const ex = sx + Math.cos(a) * v.arm;
    const ey = sy + Math.sin(a) * v.arm * 0.6 + side * 1.5;
    ctx.strokeStyle = z.cloth;
    ctx.lineWidth = v.aw + 1.2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(sx + (ex - sx) * 0.5, sy + (ey - sy) * 0.5);
    ctx.stroke();
    ctx.strokeStyle = z.skin;
    ctx.lineWidth = v.aw;
    ctx.beginPath();
    ctx.moveTo(sx + (ex - sx) * 0.45, sy + (ey - sy) * 0.45);
    ctx.lineTo(ex, ey);
    ctx.stroke();
    ctx.fillStyle = z.skin;
    ctx.beginPath();
    ctx.arc(ex, ey, v.aw * 0.65, 0, TAU);
    ctx.fill();
    if (z.type === 'brute' || z.type === 'boss') {
      // claws
      ctx.strokeStyle = z.type === 'boss' ? '#d9c9a0' : '#2a2a2a';
      ctx.lineWidth = 1.6;
      for (let i = -1; i <= 1; i++) {
        ctx.beginPath();
        ctx.moveTo(ex, ey + i * 2);
        ctx.lineTo(ex + 5, ey + i * 3);
        ctx.stroke();
      }
    }
  }

  // body
  if (z.type === 'bloater') {
    const pulse = 1 + Math.sin(z.anim * 0.6) * 0.04 + (z.hp / z.maxHp < 0.4 ? Math.sin(z.anim * 3) * 0.05 : 0);
    ctx.fillStyle = z.cloth;
    ctx.beginPath();
    ctx.ellipse(0, 0, v.bh * pulse, v.bw * pulse, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = z.skin;
    ctx.beginPath();
    ctx.ellipse(1, 0, (v.bh - 2.5) * pulse, (v.bw - 3) * pulse, 0, 0, TAU);
    ctx.fill();
    // veins & pustules
    ctx.strokeStyle = 'rgba(80,110,30,0.7)';
    ctx.lineWidth = 1.2;
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.moveTo(-4, -8 + i * 5);
      ctx.quadraticCurveTo(2, -6 + i * 5, 8, -9 + i * 6);
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(210,230,90,0.8)';
    ctx.beginPath();
    ctx.arc(3, -5, 2.4, 0, TAU);
    ctx.arc(-3, 6, 2, 0, TAU);
    ctx.arc(5, 7, 1.6, 0, TAU);
    ctx.fill();
  } else {
    ctx.fillStyle = z.cloth;
    ctx.beginPath();
    ctx.ellipse(0, 0, v.bh, v.bw, 0, 0, TAU);
    ctx.fill();
    // torn clothes / skin patches
    ctx.fillStyle = z.skin;
    ctx.globalAlpha = 0.5;
    ctx.beginPath();
    ctx.ellipse(-2, (z.id % 2 ? 1 : -1) * 4, 3, 2.5, 0, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;
    if (z.type === 'brute') {
      ctx.fillStyle = '#4a4d50';
      ctx.beginPath();
      ctx.arc(0, -v.bw + 1, 5.5, 0, TAU);
      ctx.arc(0, v.bw - 1, 5.5, 0, TAU);
      ctx.fill();
    }
    if (z.type === 'spitter') {
      const glow = z.state === 'spit' ? 1 : 0.5 + Math.sin(z.anim * 0.8) * 0.15;
      ctx.fillStyle = `rgba(190,235,70,${0.7 + glow * 0.3})`;
      ctx.beginPath();
      ctx.arc(-3.5, 0, 5 + glow * (z.state === 'spit' ? 3 : 0.6), 0, TAU);
      ctx.fill();
      ctx.fillStyle = 'rgba(80,120,20,0.7)';
      ctx.beginPath();
      ctx.arc(-3.5, 0, 2.2, 0, TAU);
      ctx.fill();
    }
    if (z.type === 'boss') {
      ctx.fillStyle = '#d9c9a0';
      for (let i = -2; i <= 2; i++) {
        ctx.beginPath();
        ctx.moveTo(-3, i * 5 - 2.5);
        ctx.lineTo(-13 - (2 - Math.abs(i)) * 2.5, i * 5);
        ctx.lineTo(-3, i * 5 + 2.5);
        ctx.closePath();
        ctx.fill();
      }
      const rage = z.enraged ? 1 : 0.55;
      ctx.fillStyle = `rgba(255,70,30,${rage})`;
      ctx.beginPath();
      ctx.arc(0, 0, 3.4 + Math.sin(z.anim * 1.5) * 0.8, 0, TAU);
      ctx.fill();
    }
  }

  // head
  const hx = z.type === 'bloater' ? 9 : 2.5;
  ctx.fillStyle = z.skin;
  ctx.beginPath();
  ctx.arc(hx, 0, v.head, 0, TAU);
  ctx.fill();
  ctx.fillStyle = z.hair;
  ctx.beginPath();
  ctx.arc(hx - 2.2, 0, v.head * 0.78, 0, TAU);
  ctx.fill();
  if (z.type === 'boss') {
    ctx.fillStyle = '#d9c9a0';
    for (const sd of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(hx + 1, sd * 4);
      ctx.lineTo(hx + 12, sd * 8);
      ctx.lineTo(hx + 3, sd * 7);
      ctx.closePath();
      ctx.fill();
    }
  }
  // blood on face
  ctx.fillStyle = 'rgba(110,10,10,0.7)';
  ctx.beginPath();
  ctx.ellipse(hx + v.head * 0.55, (z.id % 2 ? 1 : -1) * 1.5, 2.8, 2, 0, 0, TAU);
  ctx.fill();

  // hit flash
  if (z.flash > 0 && !dead) {
    ctx.fillStyle = `rgba(255,255,255,${Math.min(0.75, z.flash * 0.8)})`;
    ctx.beginPath();
    ctx.ellipse(0, 0, v.bh + 0.5, v.bw + 0.5, 0, 0, TAU);
    ctx.arc(hx, 0, v.head, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

export function drawEyes(ctx: CanvasRenderingContext2D, z: Zombie) {
  const v = VIS[z.type];
  const s = z.r / 14;
  const hx = z.type === 'bloater' ? 9 : 2.5;
  ctx.save();
  ctx.translate(z.x, z.y);
  ctx.rotate(z.angle);
  ctx.scale(s, s);
  const col =
    z.type === 'spitter' ? '120,255,60' : z.type === 'boss' ? '255,140,30' : z.type === 'bloater' ? '230,255,90' : '255,40,30';
  const ex = hx + v.head * 0.55;
  const ey = v.head * 0.42;
  for (const sd of [-1, 1]) {
    ctx.fillStyle = `rgba(${col},0.25)`;
    ctx.beginPath();
    ctx.arc(ex, sd * ey, 4, 0, TAU);
    ctx.fill();
    ctx.fillStyle = `rgba(${col},1)`;
    ctx.beginPath();
    ctx.arc(ex, sd * ey, 1.5, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

export function drawCorpse(g: CanvasRenderingContext2D, z: Zombie, ang: number) {
  // blood pool
  const pr = z.r * (2 + Math.random() * 0.8);
  const gr = g.createRadialGradient(z.x, z.y, 0, z.x, z.y, pr);
  gr.addColorStop(0, 'rgba(90,6,6,0.9)');
  gr.addColorStop(0.7, 'rgba(70,5,5,0.75)');
  gr.addColorStop(1, 'rgba(60,4,4,0)');
  g.fillStyle = gr;
  g.beginPath();
  g.ellipse(z.x, z.y, pr, pr * 0.85, ang, 0, TAU);
  g.fill();
  const dz = { ...z, angle: ang + (Math.random() - 0.5) * 1.2, flash: 0, state: 'chase' as const };
  drawZombie(g, dz, true);
  // darken
  g.save();
  g.translate(z.x, z.y);
  g.rotate(dz.angle);
  g.fillStyle = 'rgba(25,0,0,0.5)';
  g.beginPath();
  g.ellipse(0, 0, z.r * 0.8, z.r * 0.95, 0, 0, TAU);
  g.fill();
  g.restore();
}

export function drawPlayer(ctx: CanvasRenderingContext2D, p: Player, w: WeaponDef, moving: boolean) {
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.beginPath();
  ctx.ellipse(3, 4, 13, 15, 0, 0, TAU);
  ctx.fill();
  ctx.rotate(p.angle);
  const recoil = Math.min(4, p.kick * 3);
  // feet
  const sw = moving ? Math.sin(p.walk) * 7 : 0;
  ctx.fillStyle = '#16171a';
  ctx.beginPath();
  ctx.ellipse(sw, -6, 5.5, 3.3, 0, 0, TAU);
  ctx.ellipse(-sw, 6, 5.5, 3.3, 0, 0, TAU);
  ctx.fill();
  // backpack
  ctx.fillStyle = '#3a4530';
  ctx.beginPath();
  ctx.roundRect(-13, -8, 9, 16, 3);
  ctx.fill();
  // gun
  const gy = 2;
  const gx = 7 - recoil;
  const thick = w.id === 'launcher' ? 8 : w.id === 'shotgun' ? 5.5 : 4.6;
  ctx.fillStyle = '#1c1d1f';
  ctx.beginPath();
  ctx.roundRect(gx, gy - thick / 2, w.len, thick, 1.5);
  ctx.fill();
  ctx.fillStyle = '#34363a';
  ctx.fillRect(gx + 2, gy - thick / 2 + 0.8, w.len * 0.55, thick * 0.35);
  if (w.id === 'sniper') {
    ctx.fillStyle = '#0d0e10';
    ctx.fillRect(gx + 10, gy - 5.5, 10, 3);
  }
  if (w.id === 'launcher') {
    ctx.fillStyle = '#4a5238';
    ctx.beginPath();
    ctx.roundRect(gx - 4, gy - 5, w.len + 6, 10, 3);
    ctx.fill();
    ctx.fillStyle = '#222';
    ctx.fillRect(gx + w.len + 1, gy - 4, 3, 8);
  }
  // arms
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#3f553f';
  ctx.lineWidth = 5.5;
  ctx.beginPath();
  ctx.moveTo(1, 8);
  ctx.lineTo(gx + 4, gy + 1);
  ctx.moveTo(1, -8);
  ctx.lineTo(gx + w.len * 0.55 + 2, gy - 1);
  ctx.stroke();
  ctx.fillStyle = '#d6b090';
  ctx.beginPath();
  ctx.arc(gx + 4, gy + 1, 3, 0, TAU);
  ctx.arc(gx + w.len * 0.55 + 2, gy - 1, 3, 0, TAU);
  ctx.fill();
  // torso
  ctx.fillStyle = '#486549';
  ctx.beginPath();
  ctx.ellipse(0, 0, 8.5, 13.5, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#35503a';
  ctx.beginPath();
  ctx.ellipse(-1, 0, 4, 10, 0, 0, TAU);
  ctx.fill();
  // head + helmet
  ctx.fillStyle = '#d6b090';
  ctx.beginPath();
  ctx.arc(1.5, 0, 7.6, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#2f3a2c';
  ctx.beginPath();
  ctx.arc(-0.8, 0, 7.2, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#1d251b';
  ctx.beginPath();
  ctx.arc(-1.8, 0, 3.4, 0, TAU);
  ctx.fill();
  // flashlight on gun
  ctx.fillStyle = '#ffeaa0';
  ctx.beginPath();
  ctx.arc(gx + w.len * 0.35, gy + thick / 2 + 1.5, 1.8, 0, TAU);
  ctx.fill();
  // hurt flash
  if (p.hurt > 0.6) {
    ctx.fillStyle = `rgba(255,60,60,${(p.hurt - 0.6) * 1.2})`;
    ctx.beginPath();
    ctx.ellipse(0, 0, 9, 14, 0, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

export function drawMuzzleFlash(ctx: CanvasRenderingContext2D, p: Player, w: WeaponDef) {
  if (p.flash <= 0) return;
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.angle);
  ctx.globalCompositeOperation = 'lighter';
  const x = 7 + w.len + 2;
  const size = (w.id === 'shotgun' || w.id === 'launcher' ? 30 : w.id === 'sniper' ? 34 : 20) * (0.7 + Math.random() * 0.5);
  const grad = ctx.createRadialGradient(x, 2, 0, x, 2, size);
  grad.addColorStop(0, 'rgba(255,250,200,1)');
  grad.addColorStop(0.35, 'rgba(255,190,70,0.8)');
  grad.addColorStop(1, 'rgba(255,100,20,0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(x - 4, 2);
  const spikes = 7;
  for (let i = 0; i < spikes * 2; i++) {
    const a = (i / (spikes * 2)) * TAU - Math.PI / 2;
    const r = i % 2 === 0 ? size : size * 0.35;
    ctx.lineTo(x + Math.cos(a) * r * 1.3, 2 + Math.sin(a) * r * 0.7);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

export function drawObstacle(ctx: CanvasRenderingContext2D, r: Rect) {
  // shadow
  ctx.fillStyle = 'rgba(0,0,0,0.38)';
  ctx.fillRect(r.x + 7, r.y + 9, r.w, r.h);
  switch (r.kind) {
    case 'crate': {
      ctx.fillStyle = '#4a361c';
      ctx.fillRect(r.x, r.y, r.w, r.h);
      ctx.fillStyle = r.variant === 1 ? '#86653a' : '#7a5a32';
      ctx.fillRect(r.x + 2, r.y + 2, r.w - 4, r.h - 4);
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      for (let i = 1; i < 4; i++) ctx.fillRect(r.x + 2, r.y + (r.h / 4) * i, r.w - 4, 1.5);
      ctx.strokeStyle = '#5a4122';
      ctx.lineWidth = 3;
      ctx.strokeRect(r.x + 7, r.y + 7, r.w - 14, r.h - 14);
      ctx.beginPath();
      ctx.moveTo(r.x + 7, r.y + 7);
      ctx.lineTo(r.x + r.w - 7, r.y + r.h - 7);
      ctx.moveTo(r.x + r.w - 7, r.y + 7);
      ctx.lineTo(r.x + 7, r.y + r.h - 7);
      ctx.stroke();
      break;
    }
    case 'barrier': {
      ctx.fillStyle = '#5c5c58';
      ctx.fillRect(r.x, r.y, r.w, r.h);
      ctx.fillStyle = '#9a9a94';
      ctx.fillRect(r.x + 2, r.y + 2, r.w - 4, r.h - 4);
      const horiz = r.w > r.h;
      ctx.fillStyle = '#c0392b';
      if (horiz) {
        for (let x = r.x + 10; x < r.x + r.w - 14; x += 26) ctx.fillRect(x, r.y + 6, 12, r.h - 12);
      } else {
        for (let y = r.y + 10; y < r.y + r.h - 14; y += 26) ctx.fillRect(r.x + 6, y, r.w - 12, 12);
      }
      break;
    }
    case 'car': {
      const horiz = r.w > r.h;
      ctx.fillStyle = '#111';
      // wheels
      if (horiz) {
        for (const fx of [0.18, 0.72]) {
          ctx.fillRect(r.x + r.w * fx, r.y - 3, 16, 5);
          ctx.fillRect(r.x + r.w * fx, r.y + r.h - 2, 16, 5);
        }
      } else {
        for (const fy of [0.18, 0.72]) {
          ctx.fillRect(r.x - 3, r.y + r.h * fy, 5, 16);
          ctx.fillRect(r.x + r.w - 2, r.y + r.h * fy, 5, 16);
        }
      }
      ctx.fillStyle = r.color;
      ctx.beginPath();
      ctx.roundRect(r.x, r.y, r.w, r.h, 9);
      ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.beginPath();
      ctx.roundRect(r.x + 2, r.y + 2, r.w - 4, r.h - 4, 8);
      ctx.fill();
      ctx.fillStyle = r.color;
      ctx.beginPath();
      ctx.roundRect(r.x + 2, r.y + 2, r.w - 4, r.h - 7, 8);
      ctx.fill();
      // cabin
      ctx.fillStyle = '#10151a';
      if (horiz) {
        ctx.beginPath();
        ctx.roundRect(r.x + r.w * 0.22, r.y + 5, r.w * 0.5, r.h - 10, 5);
        ctx.fill();
        ctx.fillStyle = r.color;
        ctx.fillRect(r.x + r.w * 0.32, r.y + 7, r.w * 0.3, r.h - 14);
        ctx.fillStyle = 'rgba(255,255,255,0.12)';
        ctx.fillRect(r.x + r.w * 0.32, r.y + 7, r.w * 0.3, 3);
        ctx.fillStyle = '#ffe9a0';
        ctx.fillRect(r.x + r.w - 4, r.y + 4, 3, 6);
        ctx.fillRect(r.x + r.w - 4, r.y + r.h - 10, 3, 6);
        ctx.fillStyle = '#a02020';
        ctx.fillRect(r.x + 1, r.y + 4, 3, 6);
        ctx.fillRect(r.x + 1, r.y + r.h - 10, 3, 6);
      } else {
        ctx.beginPath();
        ctx.roundRect(r.x + 5, r.y + r.h * 0.22, r.w - 10, r.h * 0.5, 5);
        ctx.fill();
        ctx.fillStyle = r.color;
        ctx.fillRect(r.x + 7, r.y + r.h * 0.32, r.w - 14, r.h * 0.3);
        ctx.fillStyle = '#ffe9a0';
        ctx.fillRect(r.x + 4, r.y + r.h - 4, 6, 3);
        ctx.fillRect(r.x + r.w - 10, r.y + r.h - 4, 6, 3);
        ctx.fillStyle = '#a02020';
        ctx.fillRect(r.x + 4, r.y + 1, 6, 3);
        ctx.fillRect(r.x + r.w - 10, r.y + 1, 6, 3);
      }
      // rust / damage
      if (r.variant % 2 === 0) {
        ctx.fillStyle = 'rgba(90,40,10,0.45)';
        ctx.beginPath();
        ctx.arc(r.x + r.w * 0.8, r.y + r.h * 0.3, 5, 0, TAU);
        ctx.fill();
      }
      break;
    }
    case 'dumpster': {
      ctx.fillStyle = '#16301e';
      ctx.fillRect(r.x, r.y, r.w, r.h);
      ctx.fillStyle = r.color;
      ctx.fillRect(r.x + 2, r.y + 2, r.w - 4, r.h - 4);
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      const horiz = r.w > r.h;
      if (horiz) {
        ctx.fillRect(r.x + r.w / 2 - 1, r.y + 2, 2, r.h - 4);
        ctx.fillRect(r.x + 2, r.y + 8, r.w - 4, 2);
      } else {
        ctx.fillRect(r.x + 2, r.y + r.h / 2 - 1, r.w - 4, 2);
        ctx.fillRect(r.x + 8, r.y + 2, 2, r.h - 4);
      }
      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      ctx.fillRect(r.x + 2, r.y + 2, r.w - 4, 3);
      break;
    }
    case 'container': {
      const horiz = r.w > r.h;
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(r.x, r.y, r.w, r.h);
      ctx.fillStyle = r.color;
      ctx.fillRect(r.x + 2, r.y + 2, r.w - 4, r.h - 4);
      ctx.fillStyle = 'rgba(0,0,0,0.28)';
      if (horiz) for (let x = r.x + 8; x < r.x + r.w - 6; x += 12) ctx.fillRect(x, r.y + 3, 3, r.h - 6);
      else for (let y = r.y + 8; y < r.y + r.h - 6; y += 12) ctx.fillRect(r.x + 3, y, r.w - 6, 3);
      ctx.fillStyle = 'rgba(255,255,255,0.1)';
      ctx.fillRect(r.x + 2, r.y + 2, r.w - 4, 3);
      ctx.fillStyle = 'rgba(80,35,10,0.35)';
      ctx.beginPath();
      ctx.arc(r.x + r.w * (0.3 + r.variant * 0.2), r.y + r.h * 0.5, 9, 0, TAU);
      ctx.fill();
      break;
    }
  }
}

export function drawBarrel(ctx: CanvasRenderingContext2D, b: Barrel, t: number) {
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.beginPath();
  ctx.ellipse(b.x + 5, b.y + 7, b.r, b.r, 0, 0, TAU);
  ctx.fill();
  const hot = b.fuse >= 0;
  ctx.fillStyle = '#5a1a12';
  ctx.beginPath();
  ctx.arc(b.x, b.y, b.r, 0, TAU);
  ctx.fill();
  ctx.fillStyle = hot && Math.floor(t * 20) % 2 === 0 ? '#ffb040' : '#b83a22';
  ctx.beginPath();
  ctx.arc(b.x, b.y, b.r - 2, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(b.x, b.y, b.r - 5, 0, TAU);
  ctx.stroke();
  // hazard symbol
  ctx.fillStyle = '#f2d230';
  ctx.beginPath();
  ctx.moveTo(b.x, b.y - 5);
  ctx.lineTo(b.x + 4.5, b.y + 3);
  ctx.lineTo(b.x - 4.5, b.y + 3);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#5a1a12';
  ctx.fillRect(b.x - 0.7, b.y - 2, 1.4, 3);
  ctx.fillRect(b.x - 0.7, b.y + 1.5, 1.4, 1.2);
}

export function drawLampPost(ctx: CanvasRenderingContext2D, l: Lamp, on: number) {
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath();
  ctx.arc(l.x + 5, l.y + 7, 6, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#2b2d30';
  ctx.beginPath();
  ctx.arc(l.x, l.y, 6, 0, TAU);
  ctx.fill();
  ctx.fillStyle = `rgba(255,${200 + on * 40},${120 + on * 60},1)`;
  ctx.beginPath();
  ctx.arc(l.x, l.y, 3.2, 0, TAU);
  ctx.fill();
}

const PICKUP_STYLE: Record<string, { color: string; label: string }> = {
  health: { color: '#ff4d5a', label: '+' },
  ammo: { color: '#ffc83a', label: 'A' },
  grenade: { color: '#7bd05a', label: 'G' },
  damage: { color: '#ff7a2a', label: '2x' },
  rapid: { color: '#3ac8ff', label: '»' },
  nuke: { color: '#ffffff', label: '☢' },
};

export function pickupColor(kind: string) {
  return PICKUP_STYLE[kind].color;
}

export function drawPickup(ctx: CanvasRenderingContext2D, p: Pickup, t: number) {
  const st = PICKUP_STYLE[p.kind];
  const bob = Math.sin(t * 4 + p.x) * 2;
  const fade = p.life < 4 ? (Math.floor(p.life * 6) % 2 === 0 ? 0.35 : 1) : 1;
  ctx.save();
  ctx.globalAlpha = fade;
  ctx.translate(p.x, p.y + bob);
  // glow
  const g = ctx.createRadialGradient(0, 0, 2, 0, 0, 30);
  g.addColorStop(0, st.color + 'aa');
  g.addColorStop(1, st.color + '00');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, 30, 0, TAU);
  ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.beginPath();
  ctx.roundRect(-11, -11, 22, 22, 5);
  ctx.fill();
  ctx.strokeStyle = st.color;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = st.color;
  if (p.kind === 'health') {
    ctx.fillRect(-2.5, -7, 5, 14);
    ctx.fillRect(-7, -2.5, 14, 5);
  } else if (p.kind === 'ammo') {
    for (let i = -1; i <= 1; i++) {
      ctx.fillRect(i * 5 - 1.6, -6, 3.2, 12);
      ctx.beginPath();
      ctx.arc(i * 5, -6, 1.6, Math.PI, 0);
      ctx.fill();
    }
  } else if (p.kind === 'grenade') {
    ctx.beginPath();
    ctx.arc(0, 1, 6, 0, TAU);
    ctx.fill();
    ctx.fillRect(-1.5, -8, 3, 4);
  } else {
    ctx.font = 'bold 12px Impact, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(st.label, 0, 1);
  }
  ctx.restore();
}
