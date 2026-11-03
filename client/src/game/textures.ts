import * as THREE from 'three';
import { FLOORS } from '../../../shared/game.ts';

export function seeded(seed: number) {
  let s = seed % 2147483647 || 1;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

// [sương mù, dung nham/biển, vết nứt phát sáng, màu nền đá, mật độ sương]
const PALETTES: [string, string, string, string, number][] = [
  ['#2a0608', '#c01020', '#ff3a3a', '#b08080', 0.022], // 1 Rút Lưỡi
  ['#0c1218', '#3a80ff', '#8ab8ff', '#8090a0', 0.022], // 2 Cắt Kéo
  ['#0c120c', '#4a9a2a', '#9aff6a', '#8a9a8a', 0.026], // 3 Cây Sắt
  ['#140a24', '#8a4aff', '#c08aff', '#a098c0', 0.02], // 4 Gương Nghiệt
  ['#2a2018', '#ff9a3a', '#ffc07a', '#c0a888', 0.034], // 5 Lồng Hấp
  ['#2a1006', '#ff6a10', '#ff9a3a', '#b08868', 0.022], // 6 Cột Đồng
  ['#1a0c10', '#ff2a4a', '#ff6a7a', '#9a8a90', 0.018], // 7 Núi Đao
  ['#20384a', '#6ad8ff', '#bff4ff', '#e0f0ff', 0.024], // 8 Núi Băng
  ['#2a1a04', '#ffb020', '#ffd060', '#b09a70', 0.022], // 9 Vạc Dầu
  ['#24140a', '#d0601a', '#ff8a3a', '#a08060', 0.022], // 10 Trâu Húc
  ['#161616', '#a03a2a', '#c07a5a', '#a0a0a0', 0.022], // 11 Đá Đè
  ['#241a08', '#e0901a', '#ffc04a', '#c0a878', 0.022], // 12 Cối Giã
  ['#2a0204', '#a00010', '#ff2030', '#9a7070', 0.024], // 13 Ao Máu
  ['#101418', '#4a6a8a', '#8ab0d0', '#8a9098', 0.04], // 14 Uổng Tử
  ['#0e1a0a', '#6aa020', '#b0ff5a', '#8a9a80', 0.026], // 15 Phanh Thây
  ['#200800', '#ff3a00', '#ff7a1a', '#806a60', 0.02], // 16 Núi Lửa
  ['#1a120c', '#ff7a1a', '#ff8a2a', '#ffffff', 0.022], // 17 Cối Xay Đá
  ['#1a0e06', '#c0501a', '#ff8a3a', '#a08870', 0.022], // 18 Cưa Xẻ
];

/** Màu sắc riêng từng tầng. */
export function floorLook(level: number) {
  const [fog, lava, crack, tint, density] = PALETTES[Math.max(0, Math.min(17, level - 1))];
  return { d: (level - 1) / 17, fog, lava, crack, tint, density };
}

let dot: THREE.Texture | null = null;
export function dotTexture() {
  if (dot) return dot;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.35, 'rgba(255,255,255,0.6)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  dot = new THREE.CanvasTexture(c);
  return dot;
}

let shadow: THREE.Texture | null = null;
export function blobShadow() {
  if (shadow) return shadow;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(0,0,0,0.65)');
  grd.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  shadow = new THREE.CanvasTexture(c);
  return shadow;
}

let lava: THREE.Texture | null = null;
export function lavaTexture() {
  if (lava) return lava;
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d')!;
  const r = seeded(42);
  g.fillStyle = '#3a0500';
  g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 90; i++) {
    const x = r() * 256, y = r() * 256, rad = 8 + r() * 34;
    for (const [dx, dy] of [[0, 0], [256, 0], [-256, 0], [0, 256], [0, -256]]) {
      const grd = g.createRadialGradient(x + dx, y + dy, 0, x + dx, y + dy, rad);
      grd.addColorStop(0, `rgba(255,${180 + r() * 60},80,${0.5 + r() * 0.5})`);
      grd.addColorStop(1, 'rgba(255,60,0,0)');
      g.fillStyle = grd;
      g.fillRect(x + dx - rad, y + dy - rad, rad * 2, rad * 2);
    }
  }
  lava = new THREE.CanvasTexture(c);
  lava.wrapS = lava.wrapT = THREE.RepeatWrapping;
  lava.repeat.set(24, 24);
  return lava;
}

/** Nền đá + vết nứt dung nham (emissive), sinh theo hạt giống từng tầng. */
export function groundTextures(level: number) {
  const W = 1080, H = 760; // tỉ lệ 54 x 38
  const r = seeded(level * 7919 + 13);
  const base = document.createElement('canvas');
  base.width = W;
  base.height = H;
  const b = base.getContext('2d')!;
  b.fillStyle = '#2b1915';
  b.fillRect(0, 0, W, H);
  // đá lát
  for (let y = 0; y < H; y += 54) {
    for (let x = (y / 54) % 2 ? -27 : 0; x < W; x += 54) {
      const l = 14 + r() * 10;
      b.fillStyle = `hsl(10, 22%, ${l}%)`;
      b.fillRect(x + 2, y + 2, 50, 50);
    }
  }
  for (let i = 0; i < 4000; i++) {
    b.fillStyle = r() < 0.5 ? 'rgba(0,0,0,0.25)' : 'rgba(255,220,200,0.05)';
    b.fillRect(r() * W, r() * H, 2 + r() * 3, 2 + r() * 3);
  }

  const glow = document.createElement('canvas');
  glow.width = W;
  glow.height = H;
  const e = glow.getContext('2d')!;
  e.fillStyle = '#000';
  e.fillRect(0, 0, W, H);

  // vòng pháp trận quanh cối xay (tâm cối ở x=0,z=-2 → pixel)
  const cx = W / 2, cy = H / 2 - 2 * 20;
  for (const ctx of [b, e]) {
    ctx.strokeStyle = ctx === b ? 'rgba(0,0,0,0.5)' : 'rgba(255,120,40,0.55)';
    ctx.lineWidth = 4;
    for (const rad of [120, 150]) {
      ctx.beginPath();
      ctx.arc(cx, cy, rad, 0, Math.PI * 2);
      ctx.stroke();
    }
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * 120, cy + Math.sin(a) * 120);
      ctx.lineTo(cx + Math.cos(a) * 150, cy + Math.sin(a) * 150);
      ctx.stroke();
    }
  }

  // vết nứt — vẽ cùng hạt giống lên 2 lớp (đá tối + phát sáng) để trùng khớp
  const crackWith = (ctx: CanvasRenderingContext2D, rnd: () => number, x: number, y: number, depth: number) => {
    let a = rnd() * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(x, y);
    const steps = 4 + Math.floor(rnd() * 5);
    for (let j = 0; j < steps; j++) {
      a += (rnd() - 0.5) * 1.2;
      x += Math.cos(a) * (20 + rnd() * 40);
      y += Math.sin(a) * (20 + rnd() * 40);
      ctx.lineTo(x, y);
      if (depth < 1 && rnd() < 0.25) {
        ctx.stroke();
        crackWith(ctx, rnd, x, y, depth + 1);
        ctx.beginPath();
        ctx.moveTo(x, y);
      }
    }
    ctx.stroke();
  };
  b.lineCap = e.lineCap = 'round';
  b.strokeStyle = 'rgba(10,3,2,0.9)';
  b.lineWidth = 7;
  e.strokeStyle = 'rgba(255,140,60,1)';
  e.lineWidth = 3.5;
  e.shadowColor = '#ff6a00';
  e.shadowBlur = 16;
  for (let i = 0; i < 16 + level; i++) {
    const x = r() * W, y = r() * H, s = Math.floor(r() * 1e9);
    crackWith(b, seeded(s), x, y, 0);
    crackWith(e, seeded(s), x, y, 0);
  }
  e.shadowBlur = 0;

  const map = new THREE.CanvasTexture(base);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 8;
  const emissive = new THREE.CanvasTexture(glow);
  emissive.colorSpace = THREE.SRGBColorSpace;
  return { map, emissive };
}

/** Bảng tên tầng treo trên Quỷ Môn Quan. */
export function drawSign(canvas: HTMLCanvasElement, level: number) {
  const f = FLOORS[level - 1];
  const W = (canvas.width = 1024), H = (canvas.height = 300);
  const g = canvas.getContext('2d')!;
  const grd = g.createLinearGradient(0, 0, 0, H);
  grd.addColorStop(0, '#8a1010');
  grd.addColorStop(1, '#4a0606');
  g.fillStyle = grd;
  g.fillRect(0, 0, W, H);
  g.strokeStyle = '#f5c04a';
  g.lineWidth = 10;
  g.strokeRect(14, 14, W - 28, H - 28);
  g.lineWidth = 3;
  g.strokeRect(30, 30, W - 60, H - 60);
  g.fillStyle = '#ffd56a';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = '800 92px "Noto Serif TC", "Noto Serif SC", serif';
  g.fillText(f.han, W / 2, 105);
  let size = 60;
  const text = `TẦNG ${level} · ${f.name.toUpperCase()}`;
  do {
    g.font = `800 ${size}px "Be Vietnam Pro", sans-serif`;
    size -= 4;
  } while (g.measureText(text).width > W - 110 && size > 24);
  g.fillStyle = '#fff3d6';
  g.fillText(text, W / 2, 218);
}

/** Chữ neon / bảng hiệu vẽ bằng canvas. */
export function textTexture(lines: string[], opts: { w?: number; h?: number; color?: string; bg?: string; glow?: string; size?: number; serif?: boolean } = {}) {
  const { w = 1024, h = 256, color = '#fff', bg = 'rgba(0,0,0,0)', glow = color, size = 110, serif = false } = opts;
  const family = serif ? '700 SIZEpx "Noto Serif TC", serif' : '800 SIZEpx "Be Vietnam Pro", sans-serif';
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const paint = () => {
    const g = c.getContext('2d')!;
    g.clearRect(0, 0, w, h);
    g.fillStyle = bg;
    g.fillRect(0, 0, w, h);
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.shadowColor = glow;
    g.shadowBlur = 24;
    g.fillStyle = color;
    lines.forEach((l, i) => {
      let s = size;
      do {
        g.font = family.replace('SIZE', String(s));
        s -= 4;
      } while (g.measureText(l).width > w - 40 && s > 16);
      g.fillText(l, w / 2, (h / (lines.length + 1)) * (i + 1));
    });
    tex.needsUpdate = true;
  };
  paint();
  document.fonts?.load(family.replace('SIZE', '64')).then(paint).catch(() => {});
  return tex;
}

/** Màn hình điện thoại: khung chat bị "Đã xem". */
let phoneTex: THREE.Texture | null = null;
export function phoneScreen() {
  if (phoneTex) return phoneTex;
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 512;
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const paint = () => {
    const g = c.getContext('2d')!;
    g.fillStyle = '#0e1a33';
    g.fillRect(0, 0, 256, 512);
    g.fillStyle = '#1b2b52';
    g.fillRect(0, 0, 256, 60);
    g.fillStyle = '#fff';
    g.font = '800 24px "Be Vietnam Pro", sans-serif';
    g.fillText('💬 Crush', 16, 40);
    const bubbles: [boolean, string][] = [[false, 'Ê ngủ chưa?'], [false, 'Mai đi chơi k'], [false, 'Alo???'], [false, 'Sao k rep 😢'], [true, '...']];
    let y = 90;
    for (const [mine, t] of bubbles) {
      g.font = '600 20px "Be Vietnam Pro", sans-serif';
      const w = g.measureText(t).width + 28;
      const x = mine ? 240 - w : 16;
      g.fillStyle = mine ? '#3a7bff' : '#2c3a5e';
      g.beginPath();
      g.roundRect(x, y, w, 44, 18);
      g.fill();
      g.fillStyle = '#fff';
      g.fillText(t, x + 14, y + 29);
      y += 62;
    }
    g.fillStyle = '#8fa8d8';
    g.font = '600 18px "Be Vietnam Pro", sans-serif';
    g.fillText('Đã xem 23:59 ✓✓', 80, y + 10);
    tex.needsUpdate = true;
  };
  paint();
  document.fonts?.load('800 24px "Be Vietnam Pro"').then(paint).catch(() => {});
  phoneTex = tex;
  return tex;
}
