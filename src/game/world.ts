import { WORLD_H, WORLD_W } from './config';

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
  kind: 'crate' | 'barrier' | 'car' | 'dumpster' | 'container';
  color: string;
  variant: number;
}

export interface Barrel {
  x: number;
  y: number;
  r: number;
  hp: number;
  fuse: number;
  dead: boolean;
}

export interface Lamp {
  x: number;
  y: number;
  flicker: boolean;
  phase: number;
}

export const ROAD_H = { y: 880, h: 240 };
export const ROAD_V = { x: 1280, w: 240 };
export const CENTER = { x: WORLD_W / 2, y: WORLD_H / 2 };
export const BORDER = 40;

export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function makeCanvas(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

/** Paints a big static ground texture: concrete plaza, grass, roads, cracks, fence. */
export function paintGround(): HTMLCanvasElement {
  const c = makeCanvas(WORLD_W, WORLD_H);
  const g = c.getContext('2d')!;
  const rng = mulberry32(1337);
  const R = (a: number, b: number) => a + rng() * (b - a);

  // base dirt/concrete
  g.fillStyle = '#34372f';
  g.fillRect(0, 0, WORLD_W, WORLD_H);

  // paving slabs
  g.strokeStyle = 'rgba(0,0,0,0.22)';
  g.lineWidth = 2;
  for (let x = 0; x <= WORLD_W; x += 140) {
    g.beginPath();
    g.moveTo(x, 0);
    g.lineTo(x, WORLD_H);
    g.stroke();
  }
  for (let y = 0; y <= WORLD_H; y += 140) {
    g.beginPath();
    g.moveTo(0, y);
    g.lineTo(WORLD_W, y);
    g.stroke();
  }
  // slab tone variations
  for (let x = 0; x < WORLD_W; x += 140) {
    for (let y = 0; y < WORLD_H; y += 140) {
      const v = rng();
      g.fillStyle = v < 0.5 ? `rgba(255,255,255,${R(0, 0.035)})` : `rgba(0,0,0,${R(0, 0.07)})`;
      g.fillRect(x + 2, y + 2, 136, 136);
    }
  }

  // grass blobs
  for (let i = 0; i < 52; i++) {
    const x = R(0, WORLD_W);
    const y = R(0, WORLD_H);
    const r = R(90, 280);
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, 'rgba(48,66,38,0.95)');
    gr.addColorStop(0.65, 'rgba(42,58,34,0.7)');
    gr.addColorStop(1, 'rgba(40,55,32,0)');
    g.fillStyle = gr;
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
    // grass blades
    for (let k = 0; k < r * 1.6; k++) {
      const a = rng() * Math.PI * 2;
      const d = Math.sqrt(rng()) * r * 0.85;
      g.strokeStyle = rng() < 0.5 ? 'rgba(90,120,60,0.45)' : 'rgba(30,45,25,0.5)';
      g.lineWidth = 1.5;
      const px = x + Math.cos(a) * d;
      const py = y + Math.sin(a) * d;
      g.beginPath();
      g.moveTo(px, py);
      g.lineTo(px + R(-2, 2), py - R(3, 8));
      g.stroke();
    }
  }

  // dirt stains
  for (let i = 0; i < 70; i++) {
    const x = R(0, WORLD_W);
    const y = R(0, WORLD_H);
    const r = R(20, 90);
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, 'rgba(20,16,10,0.35)');
    gr.addColorStop(1, 'rgba(20,16,10,0)');
    g.fillStyle = gr;
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
  }

  // roads
  const road = (x: number, y: number, w: number, h: number) => {
    g.fillStyle = '#232528';
    g.fillRect(x, y, w, h);
  };
  road(0, ROAD_H.y, WORLD_W, ROAD_H.h);
  road(ROAD_V.x, 0, ROAD_V.w, WORLD_H);
  // asphalt speckle on roads
  for (let i = 0; i < 60000; i++) {
    const onH = rng() < 0.55;
    const x = onH ? R(0, WORLD_W) : R(ROAD_V.x, ROAD_V.x + ROAD_V.w);
    const y = onH ? R(ROAD_H.y, ROAD_H.y + ROAD_H.h) : R(0, WORLD_H);
    g.fillStyle = rng() < 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.2)';
    g.fillRect(x, y, 2, 2);
  }
  // curbs
  g.fillStyle = '#4b4b46';
  g.fillRect(0, ROAD_H.y - 10, WORLD_W, 10);
  g.fillRect(0, ROAD_H.y + ROAD_H.h, WORLD_W, 10);
  g.fillRect(ROAD_V.x - 10, 0, 10, WORLD_H);
  g.fillRect(ROAD_V.x + ROAD_V.w, 0, 10, WORLD_H);
  // re-open the intersection
  g.fillStyle = '#232528';
  g.fillRect(ROAD_V.x - 10, ROAD_H.y - 10, ROAD_V.w + 20, ROAD_H.h + 20);
  for (let i = 0; i < 9000; i++) {
    g.fillStyle = rng() < 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.2)';
    g.fillRect(R(ROAD_V.x - 10, ROAD_V.x + ROAD_V.w + 10), R(ROAD_H.y - 10, ROAD_H.y + ROAD_H.h + 10), 2, 2);
  }
  // lane markings
  g.fillStyle = 'rgba(214,170,40,0.75)';
  for (let x = 20; x < WORLD_W; x += 90) {
    if (x > ROAD_V.x - 150 && x < ROAD_V.x + ROAD_V.w + 110) continue;
    g.fillRect(x, ROAD_H.y + ROAD_H.h / 2 - 3, 50, 6);
  }
  for (let y = 20; y < WORLD_H; y += 90) {
    if (y > ROAD_H.y - 150 && y < ROAD_H.y + ROAD_H.h + 110) continue;
    g.fillRect(ROAD_V.x + ROAD_V.w / 2 - 3, y, 6, 50);
  }
  // crosswalks
  g.fillStyle = 'rgba(230,230,225,0.55)';
  for (let i = 0; i < 9; i++) {
    const o = 12 + i * 26;
    g.fillRect(ROAD_V.x - 90, ROAD_H.y + o, 70, 12);
    g.fillRect(ROAD_V.x + ROAD_V.w + 20, ROAD_H.y + o, 70, 12);
    g.fillRect(ROAD_V.x + o, ROAD_H.y - 90, 12, 70);
    g.fillRect(ROAD_V.x + o, ROAD_H.y + ROAD_H.h + 20, 12, 70);
  }
  // oil stains + cracks on road
  for (let i = 0; i < 40; i++) {
    const onH = rng() < 0.5;
    const x = onH ? R(0, WORLD_W) : R(ROAD_V.x + 20, ROAD_V.x + ROAD_V.w - 20);
    const y = onH ? R(ROAD_H.y + 20, ROAD_H.y + ROAD_H.h - 20) : R(0, WORLD_H);
    g.fillStyle = 'rgba(0,0,0,0.3)';
    g.beginPath();
    g.ellipse(x, y, R(10, 40), R(8, 26), R(0, 3), 0, Math.PI * 2);
    g.fill();
  }
  g.strokeStyle = 'rgba(0,0,0,0.5)';
  g.lineWidth = 1.5;
  for (let i = 0; i < 90; i++) {
    let x = R(0, WORLD_W);
    let y = R(0, WORLD_H);
    g.beginPath();
    g.moveTo(x, y);
    for (let k = 0; k < 7; k++) {
      x += R(-24, 24);
      y += R(-24, 24);
      g.lineTo(x, y);
    }
    g.stroke();
  }
  // manholes
  for (const [mx, my] of [[500, 1000], [2000, 960], [1400, 400], [1400, 1620]]) {
    g.fillStyle = '#17181a';
    g.beginPath();
    g.arc(mx, my, 22, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = '#3a3b3e';
    g.lineWidth = 3;
    g.stroke();
    g.beginPath();
    g.moveTo(mx - 14, my);
    g.lineTo(mx + 14, my);
    g.moveTo(mx, my - 14);
    g.lineTo(mx, my + 14);
    g.stroke();
  }

  // fine noise
  for (let i = 0; i < 140000; i++) {
    g.fillStyle = rng() < 0.5 ? 'rgba(255,255,255,0.035)' : 'rgba(0,0,0,0.09)';
    g.fillRect(R(0, WORLD_W), R(0, WORLD_H), 2, 2);
  }

  // boundary fence
  g.fillStyle = '#0d0e10';
  g.fillRect(0, 0, WORLD_W, BORDER);
  g.fillRect(0, WORLD_H - BORDER, WORLD_W, BORDER);
  g.fillRect(0, 0, BORDER, WORLD_H);
  g.fillRect(WORLD_W - BORDER, 0, BORDER, WORLD_H);
  g.strokeStyle = 'rgba(120,125,130,0.35)';
  g.lineWidth = 1;
  for (let i = -WORLD_H; i < WORLD_W + WORLD_H; i += 14) {
    // diagonal chain-link hatch, clipped to border strips
    g.save();
    g.beginPath();
    g.rect(0, 0, WORLD_W, BORDER);
    g.rect(0, WORLD_H - BORDER, WORLD_W, BORDER);
    g.rect(0, 0, BORDER, WORLD_H);
    g.rect(WORLD_W - BORDER, 0, BORDER, WORLD_H);
    g.clip();
    g.beginPath();
    g.moveTo(i, 0);
    g.lineTo(i + WORLD_H, WORLD_H);
    g.moveTo(i + WORLD_H, 0);
    g.lineTo(i, WORLD_H);
    g.stroke();
    g.restore();
  }
  g.strokeStyle = '#55595e';
  g.lineWidth = 4;
  g.strokeRect(BORDER, BORDER, WORLD_W - BORDER * 2, WORLD_H - BORDER * 2);
  g.fillStyle = '#3a3d41';
  for (let x = BORDER; x < WORLD_W - BORDER; x += 120) {
    g.fillRect(x - 3, BORDER - 6, 7, 12);
    g.fillRect(x - 3, WORLD_H - BORDER - 6, 7, 12);
  }
  for (let y = BORDER; y < WORLD_H - BORDER; y += 120) {
    g.fillRect(BORDER - 6, y - 3, 12, 7);
    g.fillRect(WORLD_W - BORDER - 6, y - 3, 12, 7);
  }

  return c;
}

export interface WorldGen {
  rects: Rect[];
  barrels: Barrel[];
  lamps: Lamp[];
}

export function genObstacles(rng: () => number): WorldGen {
  const R = (a: number, b: number) => a + rng() * (b - a);
  const pick = <T,>(arr: T[]) => arr[Math.floor(rng() * arr.length)];
  const rects: Rect[] = [];
  const barrels: Barrel[] = [];

  const clearZone = { x: CENTER.x - 170, y: CENTER.y - 170, w: 340, h: 340 };
  const free = (x: number, y: number, w: number, h: number, pad: number) => {
    if (x < BORDER + 30 || y < BORDER + 30 || x + w > WORLD_W - BORDER - 30 || y + h > WORLD_H - BORDER - 30) return false;
    if (x < clearZone.x + clearZone.w && x + w > clearZone.x && y < clearZone.y + clearZone.h && y + h > clearZone.y) return false;
    for (const r of rects) {
      if (x < r.x + r.w + pad && x + w + pad > r.x && y < r.y + r.h + pad && y + h + pad > r.y) return false;
    }
    return true;
  };
  const add = (r: Rect) => {
    rects.push(r);
  };

  // cars on roads
  const carColors = ['#7a2a2a', '#2a4a7a', '#6a6a6a', '#b8a878', '#2a5a3a', '#6a5a2a', '#3a3a3a'];
  let tries = 0;
  let cars = 0;
  while (cars < 15 && tries++ < 300) {
    const horiz = rng() < 0.5;
    const long = 96;
    const short = 48;
    // along road, keep within road bounds
    let x: number, y: number, w: number, h: number;
    if (horiz) {
      w = rng() < 0.5 ? long : short;
      h = w === long ? short : long;
      x = R(60, WORLD_W - 160);
      y = R(ROAD_H.y + 14, ROAD_H.y + ROAD_H.h - h - 14);
    } else {
      w = rng() < 0.5 ? long : short;
      h = w === long ? short : long;
      x = R(ROAD_V.x + 14, ROAD_V.x + ROAD_V.w - w - 14);
      y = R(60, WORLD_H - 160);
    }
    if (!free(x, y, w, h, 40)) continue;
    add({ x, y, w, h, kind: 'car', color: pick(carColors), variant: Math.floor(rng() * 4) });
    cars++;
  }
  // crate clusters
  tries = 0;
  let clusters = 0;
  while (clusters < 20 && tries++ < 400) {
    const cx = R(80, WORLD_W - 140);
    const cy = R(80, WORLD_H - 140);
    const n = 1 + Math.floor(rng() * 3);
    let placed = false;
    for (let i = 0; i < n; i++) {
      const s = rng() < 0.3 ? 56 : 44;
      const x = cx + (i % 2) * (s + 2) + R(-4, 4);
      const y = cy + Math.floor(i / 2) * (s + 2) + (i === 2 ? 0 : R(-4, 4));
      if (free(x, y, s, s, i === 0 ? 70 : 0)) {
        add({ x, y, w: s, h: s, kind: 'crate', color: '#7a5a32', variant: Math.floor(rng() * 3) });
        placed = true;
      }
    }
    if (placed) clusters++;
  }
  // shipping containers
  tries = 0;
  let cont = 0;
  while (cont < 7 && tries++ < 200) {
    const horiz = rng() < 0.5;
    const w = horiz ? 170 : 62;
    const h = horiz ? 62 : 170;
    const x = R(80, WORLD_W - 260);
    const y = R(80, WORLD_H - 260);
    if (!free(x, y, w, h, 120)) continue;
    // keep roads mostly clear
    if (y + h > ROAD_H.y - 10 && y < ROAD_H.y + ROAD_H.h + 10) continue;
    if (x + w > ROAD_V.x - 10 && x < ROAD_V.x + ROAD_V.w + 10) continue;
    add({ x, y, w, h, kind: 'container', color: pick(['#8a3a22', '#2c5a7a', '#3a6a3a', '#7a6a2a']), variant: Math.floor(rng() * 3) });
    cont++;
  }
  // concrete barriers
  tries = 0;
  let bar = 0;
  while (bar < 9 && tries++ < 200) {
    const horiz = rng() < 0.5;
    const w = horiz ? 130 : 28;
    const h = horiz ? 28 : 130;
    const x = R(80, WORLD_W - 200);
    const y = R(80, WORLD_H - 200);
    if (!free(x, y, w, h, 100)) continue;
    add({ x, y, w, h, kind: 'barrier', color: '#8c8c86', variant: 0 });
    bar++;
  }
  // dumpsters
  tries = 0;
  let dump = 0;
  while (dump < 6 && tries++ < 200) {
    const horiz = rng() < 0.5;
    const w = horiz ? 70 : 40;
    const h = horiz ? 40 : 70;
    const x = R(80, WORLD_W - 160);
    const y = R(80, WORLD_H - 160);
    if (!free(x, y, w, h, 80)) continue;
    add({ x, y, w, h, kind: 'dumpster', color: '#2f5a3a', variant: 0 });
    dump++;
  }
  // explosive barrels
  tries = 0;
  while (barrels.length < 14 && tries++ < 300) {
    const x = R(100, WORLD_W - 100);
    const y = R(100, WORLD_H - 100);
    if (!free(x - 16, y - 16, 32, 32, 40)) continue;
    if (barrels.some((b) => Math.hypot(b.x - x, b.y - y) < 160)) continue;
    barrels.push({ x, y, r: 13, hp: 30, fuse: -1, dead: false });
  }

  const lamps: Lamp[] = [
    [250, 868], [700, 1132], [1000, 868], [1800, 1132], [2100, 868], [2550, 1132],
    [1268, 300], [1532, 650], [1268, 1450], [1532, 1780],
    [1268, 868], [1532, 1132], [1268, 1132], [1532, 868],
    [500, 400], [2300, 500], [600, 1600], [2200, 1550],
  ].map(([x, y], i) => ({ x, y, flicker: i % 5 === 3, phase: i * 1.7 }));

  return { rects, barrels, lamps };
}
