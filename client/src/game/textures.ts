import * as THREE from 'three';
import { FLOORS } from '../../../shared/game.ts';

export function seeded(seed: number) {
  let s = seed % 2147483647 || 1;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

// [sương mù / màu trời, dung nham/biển, vết nứt phát sáng, màu nền đá, mật độ sương]
// Phiên bản hài: màu kẹo ngọt, trời sáng, sương mỏng — địa ngục như công viên giải trí.
const PALETTES: [string, string, string, string, number][] = [
  ['#6a3a8a', '#ff5a9a', '#ffb0e0', '#e8c8f0', 0.012], // 1 Lưỡi Lò Xo
  ['#2f5a8a', '#4ab0ff', '#b0e4ff', '#d0e4f4', 0.012], // 2 Tiệm Cắt Tóc
  ['#3a7a5a', '#6aff9a', '#d0ffb0', '#d8f0d0', 0.013], // 3 Lông Gà Cù
  ['#5a3a9a', '#b07aff', '#e8c0ff', '#e0d4f8', 0.012], // 4 Gương Ảnh Thẻ
  ['#8a5a3a', '#ffc06a', '#ffe8b0', '#f8e4c8', 0.016], // 5 Bánh Bao
  ['#3a3a7a', '#ffe04a', '#fff4a0', '#d8d8f0', 0.012], // 6 Cột Điện
  ['#7a3a5a', '#ff4a6a', '#ffb0c0', '#f0d0dc', 0.011], // 7 Thảm Lego
  ['#4a8ab0', '#8ae8ff', '#e8fcff', '#f4fcff', 0.012], // 8 Kem Que
  ['#9a6a2a', '#ffc040', '#fff0a0', '#f8e8c0', 0.012], // 9 Gà Rán
  ['#5a8a3a', '#a8e05a', '#f0ffb0', '#e4f0c8', 0.012], // 10 Bò Húc
  ['#6a5a8a', '#c0a0ff', '#f0e4ff', '#e8e4f4', 0.012], // 11 Gối Ôm Khổng Lồ
  ['#8a3a3a', '#ff7a3a', '#ffd0a0', '#f8dcc8', 0.012], // 12 Búa Hơi
  ['#8a6a2a', '#e0a030', '#ffe090', '#f0e0c0', 0.013], // 13 Ao Nước Mắm
  ['#3a6a7a', '#6ad0e0', '#c8f4ff', '#dcecf0', 0.016], // 14 Phòng Chờ
  ['#8a4a7a', '#ff8ad0', '#ffd4f0', '#f8dcf0', 0.012], // 15 Kéo Kẹo
  ['#9a3a2a', '#ff5a20', '#ffc080', '#f8d8c8', 0.012], // 16 Mì Cay
  ['#3a5a9a', '#5ac8ff', '#c8ecff', '#ffffff', 0.012], // 17 Máy Giặt
  ['#6a3a8a', '#ff9a3a', '#ffe0a0', '#f0dcf0', 0.012], // 18 Ảo Thuật Cưa Hộp
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
  g.fillStyle = '#5a5a5a';
  g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 90; i++) {
    const x = r() * 256, y = r() * 256, rad = 8 + r() * 34;
    for (const [dx, dy] of [[0, 0], [256, 0], [-256, 0], [0, 256], [0, -256]]) {
      const grd = g.createRadialGradient(x + dx, y + dy, 0, x + dx, y + dy, rad);
      grd.addColorStop(0, `rgba(255,255,255,${0.5 + r() * 0.5})`); // bọt ga trắng
      grd.addColorStop(1, 'rgba(255,255,255,0)');
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
  b.fillStyle = '#9a90a0';
  b.fillRect(0, 0, W, H);
  // gạch lát kẻ ô như sàn sân chơi
  for (let y = 0; y < H; y += 54) {
    for (let x = (y / 54) % 2 ? -27 : 0; x < W; x += 54) {
      const checker = (Math.floor(x / 54) + Math.floor(y / 54)) % 2;
      const l = (checker ? 62 : 74) + r() * 6;
      b.fillStyle = `hsl(${(level * 37) % 360}, 18%, ${l}%)`;
      b.fillRect(x + 2, y + 2, 50, 50);
    }
  }
  for (let i = 0; i < 1500; i++) {
    b.fillStyle = r() < 0.5 ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.12)';
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
    ctx.strokeStyle = ctx === b ? 'rgba(255,255,255,0.5)' : 'rgba(255,200,120,0.4)';
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
  // vết nứt thành những vệt sơn kẹo uốn lượn
  b.strokeStyle = 'rgba(255,255,255,0.55)';
  b.lineWidth = 6;
  e.strokeStyle = 'rgba(255,230,180,0.8)';
  e.lineWidth = 3;
  e.shadowColor = '#ffffff';
  e.shadowBlur = 10;
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
  grd.addColorStop(0, '#ff6a9a'); // bảng hiệu kẹo hồng như cổng công viên
  grd.addColorStop(1, '#a03aff');
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
