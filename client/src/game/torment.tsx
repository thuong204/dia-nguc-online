// Cảnh "hành hình" phiên bản hài theo từng tầng: đạo cụ trêu chọc + tư thế nhăn nhó buồn cười của hồn ma.
// Trạng thái "đang chịu hình" lấy từ schema (players[id].pain) — mọi người cùng tầng đều thấy.
import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { PAIN_DUR, SCREAMS } from '../../../shared/game.ts';
import { players } from '../net.ts';
import { showBubble, useGame } from '../store.ts';
import { onBurst } from '../fx.ts';
import { plead, sfx } from '../audio.ts';
import { textTexture } from './textures.ts';

export interface Pain {
  kind: number;
  e: number; // số giây đã chịu
  dur: number;
  k: number; // 0..1
}

const track = new Map<string, { kind: number; t0: number; lastFx: number; cryAt: number }>();
const now = () => performance.now() / 1000;

/** Trạng thái chịu hình của một hồn (null nếu không). Gọi nhiều lần mỗi khung hình vẫn an toàn. */
export function painOf(id?: string): Pain | null {
  if (!id) return null;
  const kind = players.get(id)?.pain ?? 0;
  let s = track.get(id);
  if (!kind) {
    if (s) track.delete(id);
    return null;
  }
  if (!s || s.kind !== kind) {
    s = { kind, t0: now(), lastFx: 0, cryAt: now() + 1.4 };
    track.set(id, s);
    onStart(id);
  }
  const dur = PAIN_DUR[kind] ?? 3;
  const e = now() - s.t0;
  // suốt lúc chịu hình: gào thét, khóc nấc liên hồi
  if (now() >= s.cryAt) {
    s.cryAt = now() + 1.1 + Math.random() * 1.1;
    cry(id);
  }
  return { kind, e, dur, k: Math.min(1, e / dur) };
}

/** Âm lượng tiếng kêu của một hồn tuỳ khoảng cách tới mình (0 = quá xa không nghe) */
function nearVol(id: string) {
  const st = useGame.getState();
  if (id === st.myId) return 1;
  const me = players.get(st.myId), p = players.get(id);
  if (!me || !p) return 0;
  const d = Math.hypot(me.x - p.x, me.z - p.z);
  return d > 30 ? 0 : Math.max(0.2, 1 - d / 30) * 0.7;
}

/** Tiếng kêu trong lúc chịu hình: thét, khóc nấc, rên xen nhau */
function cry(id: string) {
  const v = nearVol(id);
  if (!v) return;
  const r = Math.random();
  // khóc nấc van xin nhiều hơn thét
  if (r < 0.35) sfx.scream(v);
  else if (r < 0.75) sfx.sob(v);
  else sfx.moan(v);
  // chính mình chịu hình: thỉnh thoảng nghẹn ngào van xin giữa cơn đau
  if (id === useGame.getState().myId && Math.random() < 0.3) setTimeout(() => plead(undefined, true), 400);
}

/** Bắt đầu chịu hình: hồn gào lên van xin, mình thì nghe rõ tiếng. */
function onStart(id: string) {
  const line = SCREAMS[Math.floor(Math.random() * SCREAMS.length)];
  showBubble(id, line);
  const v = nearVol(id);
  if (!v) return;
  sfx.scream(v);
  if (id === useGame.getState().myId) {
    sfx.chain();
    plead(line, true); // giọng mình van xin — ngắt loa để nghe rõ
  } else if (v > 0.4 && Math.random() < 0.5) plead(line);
}

/** Mỗi `every` giây gọi f một lần (theo từng hồn) — để phun máu, phát âm thanh đúng nhịp. */
function every(id: string, sec: number, f: () => void) {
  const s = track.get(id);
  if (!s) return;
  const t = now();
  if (t - s.lastFx >= sec) {
    s.lastFx = t;
    f();
  }
}

/* ---------- Vật liệu dùng chung (phiên bản hài: màu đồ chơi, kẹo ngọt) ---------- */
const std = (color: string, o: Partial<THREE.MeshStandardMaterialParameters> = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.5, ...o });
const glow = (r: number, g: number, b: number, opacity = 1) => new THREE.MeshBasicMaterial({ color: new THREE.Color(r, g, b), toneMapped: false, transparent: opacity < 1, opacity });
const tongueMat = std('#ff7aa8', { roughness: 0.35 });
const springMat = std('#d0d8e0', { metalness: 0.6, roughness: 0.25 });
const scissorMat = std('#ff4a6a');
const bladeMat = std('#e8eef4', { metalness: 0.7, roughness: 0.2 });
const hairMat = std('#7a4a2a', { roughness: 0.9 });
const featherMat = std('#fff4fa', { roughness: 0.9, side: THREE.DoubleSide });
const featherTip = std('#ff8ad0', { roughness: 0.9, side: THREE.DoubleSide });
const frameMat = std('#ffcf3a', { metalness: 0.3, roughness: 0.3 });
const mirrorMat = glow(1.4, 1.2, 1.6);
const bunMat = std('#fff8ee', { roughness: 0.8 });
const bamboo = std('#e0b870', { roughness: 0.8 });
const poleMat = std('#8a8a9a', { roughness: 0.6 });
const zapMat = glow(3, 2.8, 0.6);
const legoMats = ['#ff3a3a', '#3a8aff', '#ffd02a', '#3ad06a'].map((c) => std(c, { roughness: 0.3 }));
const creamMat = std('#ffb0d4', { roughness: 0.4, transparent: true, opacity: 0.85 });
const stickMat = std('#e8c890', { roughness: 0.9 });
const panMat = std('#3a3a44', { metalness: 0.6, roughness: 0.4 });
const oilMat = new THREE.MeshStandardMaterial({ color: '#ffd04a', emissive: '#ff9a20', emissiveIntensity: 0.4, roughness: 0.1 });
const fireMat = glow(3, 1.6, 0.4, 0.85);
const cowMat = std('#ffffff', { roughness: 0.7 });
const spotMat = std('#222222', { roughness: 0.7 });
const noseMat = std('#ff9ab0');
const starMat = glow(3.2, 2.8, 0.5);
const pillowMat = std('#c8b4ff', { roughness: 0.95 });
const pillowTrim = std('#fff4fa', { roughness: 0.95 });
const hammerHead = std('#ff3a4a', { roughness: 0.35 });
const hammerHandle = std('#ffd02a', { roughness: 0.4 });
const sauceMat = new THREE.MeshStandardMaterial({ color: '#c07a1a', emissive: '#603a00', emissiveIntensity: 0.3, roughness: 0.1, transparent: true, opacity: 0.9 });
const bottleMat = std('#ffe08a', { transparent: true, opacity: 0.8, roughness: 0.1 });
const chairMat = std('#4ab0a0');
const noteMat = glow(2.4, 1.2, 2.8);
const clockMat = std('#ffffff');
const candyA = std('#ff7ac0', { roughness: 0.3 });
const candyB = std('#ffffff', { roughness: 0.3 });
const postMat = std('#a070ff');
const bowlMat = std('#ff4a2a', { roughness: 0.35 });
const noodleMat = std('#ffe8a0', { roughness: 0.6 });
const chiliMat = std('#e01a1a', { roughness: 0.4 });
const stickDark = std('#6a3a1a');
const washerMat = std('#f4f8ff', { roughness: 0.25 });
const glassMat = new THREE.MeshStandardMaterial({ color: '#8ad8ff', transparent: true, opacity: 0.28, roughness: 0.05, depthWrite: false });
const ringMat = std('#a8b0c0', { metalness: 0.6, roughness: 0.3 });
const boxMat = std('#7a3aff', { roughness: 0.5 });
const boxStar = glow(3, 2.4, 0.4);
const sawMat = std('#e0e8f0', { metalness: 0.8, roughness: 0.2 });
const demonMat = std('#ff7a5a', { roughness: 0.6 }); // quỷ sai đỏ cam như thú bông
const hornMat = std('#fff4c0', { roughness: 0.5 });
const eyeWhite = new THREE.MeshBasicMaterial({ color: '#ffffff' });
const eyeDot = new THREE.MeshBasicMaterial({ color: '#111111' });

const ease = (x: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);
const jit = (e: number, a: number, f = 47) => Math.sin(e * f) * a;
const tmp = new THREE.Vector3();

/** Tung confetti / hơi / sao / bong bóng tại một điểm (toạ độ cục bộ của cụm) */
function spray(g: THREE.Object3D, x: number, y: number, z: number, c: string) {
  tmp.set(x, y, z);
  g.localToWorld(tmp);
  onBurst(tmp.x, tmp.y, tmp.z, c);
}

/* ---------- Tư thế của tội nhân khi chịu hình ---------- */
export interface Parts {
  pose: THREE.Group;
  head: THREE.Object3D;
  body: THREE.Object3D;
  armL: THREE.Object3D; // khớp vai trái
  armR: THREE.Object3D;
  legL: THREE.Object3D; // khớp hông
  legR: THREE.Object3D;
  mouth: THREE.Object3D;
  mats: THREE.MeshStandardMaterial[]; // da, áo — để đổi màu khi bị bỏng / đông cứng
}

/** Vị trí gốc các khớp của mô hình tội nhân (Convict.tsx) */
export const BASE = { head: 1.66, body: 1.2, arm: [0.3, 1.47, 0] as const, hip: [0.12, 0.9, 0] as const, mouth: [1, 0.45, 0.5] as const };
const savedMat = new WeakMap<THREE.Material, { color: THREE.Color; emissive: THREE.Color; opacity: number }>();

export function resetPose(p: Parts) {
  p.pose.position.set(0, 0, 0);
  p.pose.rotation.set(0, 0, 0);
  p.pose.scale.set(1, 1, 1);
  p.head.position.set(0, BASE.head, 0);
  p.head.rotation.set(0, 0, 0);
  p.body.position.set(0, BASE.body, 0);
  p.armL.position.set(-BASE.arm[0], BASE.arm[1], BASE.arm[2]);
  p.armR.position.set(BASE.arm[0], BASE.arm[1], BASE.arm[2]);
  p.armL.rotation.set(0, 0, 0);
  p.armR.rotation.set(0, 0, 0);
  p.legL.rotation.set(0, 0, 0);
  p.legR.rotation.set(0, 0, 0);
  p.armL.scale.setScalar(1);
  p.armR.scale.setScalar(1);
  p.mouth.scale.set(...BASE.mouth);
  for (const m of p.mats) {
    const o = savedMat.get(m);
    if (!o) continue;
    m.color.copy(o.color);
    m.emissive.copy(o.emissive);
    m.opacity = o.opacity;
    savedMat.delete(m);
  }
}

const PINK = new THREE.Color('#ff9ab8'), SPICY = new THREE.Color('#ff2a10'), ICE = new THREE.Color('#bfe8ff'), GOLDEN = new THREE.Color('#d08a2a'), ZAP = new THREE.Color('#fff6a0');

/** Đặt tư thế "chịu hình" theo tầng — phiên bản hài: giãy nảy, cười sằng sặc, choáng váng. */
export function applyPose(level: number, pain: Pain, p: Parts) {
  for (const m of p.mats) if (!savedMat.has(m)) savedMat.set(m, { color: m.color.clone(), emissive: m.emissive.clone(), opacity: m.opacity });
  const { e, k } = pain;
  const fade = Math.min(1, (pain.dur - e) / 0.4); // hồi lại ở cuối
  const P = p.pose;
  // mặc định: nhún nhảy cuống quýt, há miệng "Á á á"
  P.rotation.z = Math.sin(e * 9) * 0.06;
  P.position.x = 0;
  p.mouth.scale.set(BASE.mouth[0] * 1.3, BASE.mouth[1] * (2 + Math.sin(e * 9)), BASE.mouth[2]);
  p.head.rotation.x = -0.2 + Math.sin(e * 7) * 0.08;
  p.legL.rotation.x = Math.sin(e * 11) * 0.3;
  p.legR.rotation.x = -Math.sin(e * 11) * 0.3;
  p.armL.position.y = BASE.arm[1] + 0.3 + Math.sin(e * 12) * 0.2;
  p.armR.position.y = BASE.arm[1] + 0.3 + Math.cos(e * 12) * 0.2;
  const tint = (c: THREE.Color, em: THREE.Color, a: number) => {
    for (const m of p.mats) {
      const o = savedMat.get(m)!;
      m.color.copy(o.color).lerp(c, a);
      m.emissive.copy(o.emissive).lerp(em, a * 0.3);
    }
  };

  switch (level) {
    case 1: // lưỡi lò xo bị kéo dài: chúi người theo, mắt trợn
      P.rotation.x = 0.25 + Math.sin(e * 6) * 0.08;
      P.position.z = 0.15 + Math.max(0, Math.sin(e * 6)) * 0.25;
      break;
    case 2: // cắt tóc nấm: ôm đầu rụt cổ
      p.head.rotation.x = 0.15;
      p.armL.position.y = p.armR.position.y = BASE.arm[1] + 0.9;
      P.scale.y = 0.95 + Math.abs(Math.sin(e * 10)) * 0.04;
      break;
    case 3: // bị cù lét: cười gập bụng, ưỡn ra ưỡn vào
      P.rotation.x = Math.sin(e * 8) * 0.35;
      P.rotation.z = Math.sin(e * 5) * 0.18;
      p.mouth.scale.set(BASE.mouth[0] * 1.6, BASE.mouth[1] * (2.6 + Math.sin(e * 16)), BASE.mouth[2]);
      p.armL.position.y = p.armR.position.y = BASE.arm[1] - 0.1; // ôm bụng
      break;
    case 4: // soi gương thấy ảnh thẻ: che mặt, quay đi ngượng chín
      P.position.z = -0.4 * ease(e);
      p.head.rotation.y = 0.7 * ease(e * 2);
      p.armL.position.y = p.armR.position.y = BASE.arm[1] + 1;
      tint(PINK, PINK, ease(e) * 0.45 * fade);
      break;
    case 5: // bị gói thành bánh bao: đỏ mặt vì nóng, nhún nhún
      tint(PINK, PINK, ease(e / 2) * 0.55 * fade);
      P.scale.y = 1 - 0.06 * Math.abs(Math.sin(e * 8));
      break;
    case 6: // ôm cột điện: giật tưng tưng, chớp vàng
      P.position.y = Math.abs(Math.sin(e * 40)) * 0.08;
      P.rotation.z = Math.sin(e * 55) * 0.08;
      tint(ZAP, ZAP, (Math.sin(e * 30) > 0 ? 0.7 : 0.1) * fade);
      p.armL.position.y = p.armR.position.y = BASE.arm[1] + 0.9; // tay dang thẳng đơ
      break;
    case 7: // giẫm phải Lego: ôm chân nhảy lò cò
      P.position.y = Math.abs(Math.sin(e * 7)) * 0.45;
      P.rotation.z = Math.sin(e * 3.5) * 0.15;
      p.legL.rotation.x = -1.3;
      p.legR.rotation.x = 0;
      p.armL.position.y = BASE.arm[1] - 0.3;
      break;
    case 8: // đông cứng thành kem que
      tint(ICE, ICE, ease(e / 1.2) * 0.8 * fade);
      P.position.y = 0.55 * ease(e * 2) * fade;
      P.rotation.z = Math.sin(e * 60) * 0.015; // run cầm cập
      p.legL.rotation.x = p.legR.rotation.x = 0;
      p.armL.position.y = p.armR.position.y = BASE.arm[1];
      break;
    case 9: // tẩm bột chiên giòn: vàng ruộm, vỗ cánh như gà
      tint(GOLDEN, GOLDEN, ease(e / 1.5) * 0.7 * fade);
      P.position.y = 0.35 + Math.abs(Math.sin(e * 5)) * 0.25;
      p.armL.position.y = BASE.arm[1] + 0.5 + Math.sin(e * 22) * 0.4;
      p.armR.position.y = BASE.arm[1] + 0.5 + Math.sin(e * 22) * 0.4;
      break;
    case 10: { // bò húc bay lộn vòng, đáp xuống choáng váng
      const ph = e % 1.6;
      const air = ph > 0.8 ? (ph - 0.8) / 0.8 : 0;
      P.position.y = Math.sin(air * Math.PI) * 3;
      P.position.x = air * 1.6;
      P.rotation.x = air * Math.PI * 2;
      if (!air && e > 0.8) p.head.rotation.z = Math.sin(e * 6) * 0.3; // lắc lư chóng mặt
      break;
    }
    case 11: { // gối ôm khổng lồ đè bẹp như bánh tráng
      const sq = ease((e - 0.45) * 6) * fade;
      P.scale.set(1 + 0.45 * sq, 1 - 0.7 * sq, 1 + 0.45 * sq);
      p.armL.position.x = -BASE.arm[0] - 0.4 * sq;
      p.armR.position.x = BASE.arm[0] + 0.4 * sq;
      break;
    }
    case 12: { // búa hơi đồ chơi gõ "chíp chíp"
      const ph = (e % 0.7) / 0.7;
      const sq = ph < 0.12 ? ph / 0.12 : Math.max(0, 1 - (ph - 0.12) / 0.4);
      P.scale.set(1 + 0.3 * sq, 1 - 0.45 * sq, 1 + 0.3 * sq);
      break;
    }
    case 13: // ngâm ao nước mắm: bịt mũi, ngoi lên ngụp xuống
      P.position.y = (-0.8 * ease(e) + Math.sin(e * 3) * 0.2) * fade;
      p.armR.position.y = BASE.arm[1] + 0.9; // bịt mũi
      p.armL.position.y = BASE.arm[1] + 0.6 + Math.sin(e * 10) * 0.3;
      break;
    case 14: // phòng chờ tổng đài: ngồi gật gù ngáp dài
      P.rotation.z = 0;
      P.position.y = -0.42;
      p.legL.rotation.x = p.legR.rotation.x = -1.45;
      p.head.rotation.x = 0.25 + Math.sin(e * 1.6) * 0.18;
      p.mouth.scale.set(BASE.mouth[0], BASE.mouth[1] * (1 + Math.max(0, Math.sin(e * 0.9)) * 2), BASE.mouth[2]);
      p.armL.position.y = p.armR.position.y = BASE.arm[1] - 0.2;
      break;
    case 15: { // kéo dãn như kẹo kéo
      const pull = ease(e / 1.2) * (0.8 + 0.2 * Math.sin(e * 8)) * fade;
      p.head.position.y = BASE.head + 0.8 * pull;
      p.armL.position.x = -BASE.arm[0] - 1 * pull;
      p.armR.position.x = BASE.arm[0] + 1 * pull;
      p.armL.position.y = p.armR.position.y = BASE.arm[1] + 0.3 * pull;
      p.body.position.y = BASE.body + 0.15 * pull;
      P.scale.x = 1 - 0.25 * pull;
      break;
    }
    case 16: // ăn mì cay cấp 7: đỏ bừng, nhảy tưng tưng, quạt miệng
      tint(SPICY, SPICY, (0.45 + Math.sin(e * 10) * 0.15) * ease(e) * fade);
      P.position.y = Math.abs(Math.sin(e * 6)) * 0.3;
      p.armR.position.y = BASE.arm[1] + 0.5 + Math.sin(e * 30) * 0.15;
      p.mouth.scale.set(BASE.mouth[0] * 1.8, BASE.mouth[1] * 3, BASE.mouth[2]);
      break;
    case 17: { // quay vòng vòng trong máy giặt
      const sq = ease(e / 0.8) * fade;
      const th = e * 9 * sq, s = 1 - 0.2 * sq, c = 0.9 * s;
      P.scale.setScalar(s);
      P.rotation.z = th;
      P.position.x = Math.sin(th) * c;
      P.position.y = sq * (1.2 - Math.cos(th) * c); // giữ tâm người ở giữa lồng giặt
      break;
    }
    case 18: { // ảo thuật cưa hộp: cưa xong ráp lại bị lệch
      const crooked = ease((e / pain.dur - 0.65) * 4) * fade;
      p.head.position.x = 0.3 * crooked;
      p.armL.position.x = -BASE.arm[0] + 0.3 * crooked;
      p.armR.position.x = BASE.arm[0] + 0.3 * crooked;
      P.rotation.z = Math.sin(e * 4) * 0.04;
      p.legL.rotation.x = p.legR.rotation.x = 0;
      break;
    }
  }
  void k;
  // tay "nhấc lên" theo độ cao → xoay quanh khớp vai cho ra dáng vùng vẫy
  const lift = (y: number) => THREE.MathUtils.clamp((y - BASE.arm[1]) * 2.6, 0, 2.8);
  p.armL.rotation.z = -lift(p.armL.position.y);
  p.armR.rotation.z = lift(p.armR.position.y);
  p.armL.position.y = Math.min(p.armL.position.y, BASE.arm[1] + 0.25);
  p.armR.position.y = Math.min(p.armR.position.y, BASE.arm[1] + 0.25);
}

/* ---------- Đạo cụ "hành hình" hài: hiện ra quanh hồn đang chịu phạt ---------- */
export function TortureRig({ id, level, sin }: { id: string; level: number; sin?: string }) {
  const root = useRef<THREE.Group>(null);
  const a = useRef<THREE.Group>(null); // bộ phận chuyển động chính
  const b = useRef<THREE.Group>(null); // bộ phận phụ
  const mirrorTex = useMemo(
    () => (level === 4 ? textTexture(['GƯƠNG THẦN 📸', 'Ảnh thẻ căn cước 🤪', (sin || 'Ai cũng có một tấm như vầy').slice(0, 40)], { w: 1024, h: 512, size: 72, color: '#3a1a4a', glow: '#ffffff' }) : null),
    [level, sin],
  );

  useFrame(() => {
    const g = root.current;
    if (!g) return;
    const pain = painOf(id);
    g.visible = !!pain;
    if (!pain) return;
    const { e, dur } = pain;
    const out = Math.min(1, (dur - e) / 0.35); // thu đạo cụ về ở cuối
    const A = a.current, B = b.current;
    const near = id === useGame.getState().myId ? 1 : 0;

    switch (level) {
      case 1: { // lưỡi lò xo kéo dài "boing boing"
        const pull = 0.3 + (Math.sin(e * 6) * 0.5 + 0.5) * 2 * out;
        if (A) A.scale.set(1, 1, pull);
        if (B) B.position.z = 0.2 + pull;
        every(id, 0.7, () => {
          spray(g, 0, 1.55, 0.3 + pull, 'star');
          if (near) sfx.squelch();
        });
        break;
      }
      case 2: { // kéo khổng lồ tỉa tóc nấm
        const ph = (e % 0.5) / 0.5;
        const open = ph < 0.2 ? 0.05 : 0.05 + Math.min(1, (ph - 0.2) / 0.5) * 0.6;
        if (A) A.rotation.y = open;
        if (B) B.rotation.y = -open;
        every(id, 0.5, () => {
          spray(g, 0, 2, 0.1, 'hair');
          if (near) sfx.snip();
        });
        break;
      }
      case 3: { // lông gà cù lét hai bên nách
        if (A) A.rotation.z = Math.sin(e * 16) * 0.5;
        if (B) B.rotation.z = -Math.sin(e * 16 + 1) * 0.5;
        every(id, 0.6, () => {
          spray(g, 0, 1.8, 0.3, 'pink');
          if (near) sfx.bubble();
        });
        break;
      }
      case 4: // gương thần chiếu ảnh thẻ xấu hoắc
        mirrorMat.color.setRGB(1.3 + Math.abs(Math.sin(e * 5)) * 0.5, 1.2, 1.5);
        if (A) A.scale.setScalar(ease(e * 2.5) * out);
        every(id, 1.1, () => {
          spray(g, 0, 2.2, 2.4, 'star'); // đèn flash "tách"
          if (near) sfx.ding();
        });
        break;
      case 5: // bị gói thành bánh bao, xửng hấp phun hơi
        if (A) A.scale.setScalar(Math.max(0.01, ease(e * 2) * out));
        every(id, 0.3, () => spray(g, 0, 2.3, 0, 'white'));
        if (near && Math.random() < 0.04) sfx.sizzle();
        break;
      case 6: // cột điện: tia điện chớp, tóc dựng đứng
        if (A) A.scale.set(1, Math.max(0.01, ease(e * 3) * out), 1);
        if (B) B.visible = Math.sin(e * 30) > 0;
        every(id, 0.4, () => {
          spray(g, 0, 2, 0, 'star');
          if (near) sfx.crack();
        });
        break;
      case 7: // thảm Lego mọc lên dưới chân
        if (A) A.scale.set(1, Math.max(0.01, ease(e * 4) * out), 1);
        every(id, 0.9, () => {
          spray(g, 0, 0.4, 0, 'star');
          if (near) sfx.stab();
        });
        break;
      case 8: // đông thành kem que
        if (A) A.scale.setScalar(Math.max(0.01, ease(e * 1.5) * out));
        every(id, 0.6, () => {
          spray(g, 0, 2, 0, 'blue');
          if (near) sfx.crack();
        });
        break;
      case 9: { // chảo chiên gà rán
        if (A) A.scale.setScalar(Math.max(0.01, ease(e * 3) * out));
        if (B) B.position.y = 0.45 + Math.sin(e * 9) * 0.03;
        every(id, 0.2, () => spray(g, (Math.random() - 0.5) * 2, 0.8, (Math.random() - 0.5) * 2, 'gold'));
        if (near && Math.random() < 0.08) sfx.sizzle();
        break;
      }
      case 10: { // bò sữa lao tới húc, sao bay vòng quanh đầu
        const ph = e % 1.6;
        if (A) {
          A.position.x = ph < 0.8 ? -9 + (ph / 0.8) * 8.4 : -0.6 + (ph - 0.8) * 3;
          A.visible = e < dur - 0.3;
        }
        if (B) {
          B.visible = e > 0.85;
          B.rotation.y = e * 5;
          B.position.y = 2.2 + Math.sin(e * 3) * 0.1;
        }
        if (ph > 0.78 && ph < 0.84) every(id, 1, () => {
          spray(g, 0, 1.4, 0, 'star');
          if (near) sfx.crunch();
        });
        break;
      }
      case 11: { // gối ôm khổng lồ rơi "bịch"
        const fall = ease((e - 0.1) * 3);
        if (A) {
          A.position.y = 9 - fall * (9 - 0.9) + Math.max(0, Math.sin(e * 5)) * 0.15 + (1 - out) * 6;
          A.rotation.z = Math.sin(e * 3) * 0.1;
        }
        if (e > 0.42 && e < 0.5) every(id, 1, () => {
          spray(g, 0, 0.6, 0, 'white'); // lông vũ bay tung
          if (near) sfx.thud();
        });
        break;
      }
      case 12: { // búa hơi đồ chơi gõ đầu
        const ph = (e % 0.7) / 0.7;
        if (A) A.position.y = ph < 0.12 ? 3.4 - (ph / 0.12) * 1.6 : 1.8 + Math.min(1, (ph - 0.12) / 0.5) * 1.6;
        every(id, 0.7, () => {
          spray(g, 0, 1.9, 0, 'star');
          if (near) sfx.tick();
        });
        break;
      }
      case 13: // ao nước mắm sủi tăm
        if (A) A.scale.setScalar(Math.max(0.01, ease(e * 2) * out));
        every(id, 0.25, () => spray(g, (Math.random() - 0.5) * 2.5, 0.2, (Math.random() - 0.5) * 2.5, 'gold'));
        if (near && Math.random() < 0.05) sfx.bubble();
        break;
      case 14: // phòng chờ: nốt nhạc chờ bay lơ lửng
        if (B) {
          B.rotation.y = e * 1.2;
          B.children.forEach((n, i) => (n.position.y = 2.1 + ((e * 0.6 + i * 0.33) % 1) * 1.2));
        }
        every(id, 1.6, () => near && sfx.ding());
        break;
      case 15: { // kẹo kéo căng tứ chi
        const pull = ease(e / 1.2) * (0.8 + 0.2 * Math.sin(e * 8)) * out;
        if (A) A.scale.setScalar(0.6 + pull * 0.6);
        every(id, 0.6, () => {
          spray(g, (Math.random() < 0.5 ? -1 : 1) * 1.2, 1.6, 0, 'confetti');
          if (near) sfx.squelch();
        });
        break;
      }
      case 16: // tô mì cay cấp 7 bốc khói
        if (A) A.scale.setScalar(Math.max(0.01, ease(e * 2.5) * out));
        every(id, 0.25, () => spray(g, 0, 2.1, 0.1, Math.random() < 0.5 ? 'white' : 'gold')); // khói bốc lên từ đầu
        if (near && Math.random() < 0.05) sfx.sizzle();
        break;
      case 17: // máy giặt quay, cửa kính xoay
        if (A) A.scale.setScalar(Math.max(0.01, ease(e * 3) * out));
        if (B) B.rotation.z = -e * 9;
        every(id, 0.3, () => {
          spray(g, (Math.random() - 0.5) * 1.6, 1.2, 0.9, 'bubble');
          if (near && Math.random() < 0.4) sfx.grind();
        });
        break;
      case 18: { // ảo thuật gia cưa hộp
        const cut = ease(e / (dur * 0.6));
        if (A) {
          A.position.x = Math.sin(e * 14) * 0.5;
          A.position.z = 0.9 - cut * 0.9;
        }
        const crooked = ease((e / dur - 0.65) * 4) * out;
        if (B) B.position.x = 0.3 * crooked;
        every(id, 0.35, () => {
          spray(g, 0, 1.05, 0.6, 'confetti');
          if (near) sfx.saw();
        });
        break;
      }
    }
  });

  return (
    <group ref={root} visible={false}>
      <Rig level={level} a={a} b={b} mirrorTex={mirrorTex} />
    </group>
  );
}

type R = React.RefObject<THREE.Group | null>;

/** Ngưu Đầu / Mã Diện phiên bản thú bông: mắt tròn xoe, sừng mềm */
function Demon({ position, rotY = 0, hat = false }: { position: [number, number, number]; rotY?: number; hat?: boolean }) {
  return (
    <group position={position} rotation-y={rotY}>
      <mesh material={demonMat} position-y={1.1} castShadow>
        <capsuleGeometry args={[0.55, 0.6, 4, 12]} />
      </mesh>
      <mesh material={demonMat} position-y={2.2}>
        <sphereGeometry args={[0.5, 16, 12]} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} material={hornMat} position={[s * 0.38, 2.65, 0]} rotation-z={-s * 0.5}>
          <coneGeometry args={[0.1, 0.35, 8]} />
        </mesh>
      ))}
      {[-0.17, 0.17].map((x) => (
        <group key={x} position={[x, 2.3, 0.42]}>
          <mesh material={eyeWhite}><sphereGeometry args={[0.13, 12, 8]} /></mesh>
          <mesh material={eyeDot} position-z={0.1}><sphereGeometry args={[0.05, 8, 6]} /></mesh>
        </group>
      ))}
      {hat && (
        <group position-y={2.7}>
          <mesh material={eyeDot}><cylinderGeometry args={[0.28, 0.28, 0.5, 16]} /></mesh>
          <mesh material={eyeDot} position-y={-0.25}><cylinderGeometry args={[0.45, 0.45, 0.04, 16]} /></mesh>
          <mesh material={scissorMat} position-y={-0.15}><cylinderGeometry args={[0.285, 0.285, 0.08, 16]} /></mesh>
        </group>
      )}
    </group>
  );
}

/** Hai lưỡi kéo bắt chéo (dùng cho tầng 2) */
function Blade() {
  return (
    <>
      <mesh material={bladeMat} position-x={-0.55}>
        <boxGeometry args={[1.1, 0.05, 0.18]} />
      </mesh>
      <mesh material={scissorMat} position-x={0.35} rotation-x={Math.PI / 2}>
        <torusGeometry args={[0.18, 0.05, 8, 16]} />
      </mesh>
    </>
  );
}

function Rig({ level, a, b, mirrorTex }: { level: number; a: R; b: R; mirrorTex: THREE.Texture | null }) {
  switch (level) {
    case 1:
      return (
        <>
          <group ref={a} position={[0, 1.55, 0.2]}>
            {/* lưỡi lò xo: các vòng xoắn, kéo dãn theo trục z */}
            {Array.from({ length: 7 }, (_, i) => (
              <mesh key={i} material={i % 2 ? tongueMat : springMat} position-z={0.07 + i * 0.13}>
                <torusGeometry args={[0.09, 0.025, 6, 14]} />
              </mesh>
            ))}
          </group>
          <group ref={b} position={[0, 1.55, 1.0]}>
            <mesh material={tongueMat} scale={[1, 0.5, 1]}>
              <sphereGeometry args={[0.13, 12, 8]} />
            </mesh>
          </group>
          <Demon position={[0, 0, 3.4]} rotY={Math.PI} />
        </>
      );
    case 2:
      return (
        <>
          {/* tóc nấm úp lên đầu */}
          <mesh material={hairMat} position-y={1.82} scale={[1, 0.65, 1]}>
            <sphereGeometry args={[0.36, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
          </mesh>
          <group position={[0.1, 2.25, 0.15]} rotation-z={-0.3}>
            <group ref={a}><Blade /></group>
            <group ref={b}><Blade /></group>
            <mesh material={scissorMat}><cylinderGeometry args={[0.06, 0.06, 0.12, 10]} /></mesh>
          </group>
        </>
      );
    case 3:
      return (
        <>
          {[-1, 1].map((s) => (
            <group key={s} ref={s < 0 ? a : b} position={[s * 0.75, 1.15, 0.1]}>
              <mesh material={featherMat} position-y={0.35} scale={[0.25, 1, 0.05]}>
                <sphereGeometry args={[0.4, 10, 8]} />
              </mesh>
              <mesh material={featherTip} position-y={0.7} scale={[0.18, 0.4, 0.05]}>
                <sphereGeometry args={[0.4, 10, 8]} />
              </mesh>
            </group>
          ))}
        </>
      );
    case 4:
      return (
        <group ref={a} position={[0, 2.2, 2.6]} rotation-y={Math.PI}>
          <mesh material={frameMat}>
            <torusGeometry args={[1.6, 0.16, 12, 40]} />
          </mesh>
          <mesh material={mirrorMat} position-z={-0.02}>
            <circleGeometry args={[1.55, 40]} />
          </mesh>
          {mirrorTex && (
            <mesh position-z={0.03}>
              <planeGeometry args={[2.8, 1.4]} />
              <meshBasicMaterial map={mirrorTex} transparent toneMapped={false} />
            </mesh>
          )}
        </group>
      );
    case 5:
      return (
        <>
          {/* xửng hấp tre dưới chân */}
          <mesh material={bamboo} position-y={0.2}>
            <cylinderGeometry args={[1.1, 1.1, 0.4, 20]} />
          </mesh>
          {/* vỏ bánh bao bọc người tới cổ, chóp xoắn */}
          <group ref={a}>
            <mesh material={bunMat} position-y={0.55} scale={[1, 1.05, 1]}>
              <sphereGeometry args={[0.95, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.62]} />
            </mesh>
            <mesh material={bunMat} position-y={0.55} rotation-x={Math.PI}>
              <sphereGeometry args={[0.95, 20, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
            </mesh>
          </group>
        </>
      );
    case 6:
      return (
        <>
          <group ref={a}>
            <mesh material={poleMat} position={[0, 1.8, -0.8]} castShadow>
              <cylinderGeometry args={[0.18, 0.22, 3.6, 10]} />
            </mesh>
            <mesh material={poleMat} position={[0, 3.4, -0.8]}>
              <boxGeometry args={[1.6, 0.12, 0.12]} />
            </mesh>
          </group>
          {/* tóc dựng đứng như nhím */}
          {Array.from({ length: 9 }, (_, i) => {
            const a2 = (i / 9) * Math.PI * 2;
            return (
              <mesh key={i} material={hairMat} position={[Math.cos(a2) * 0.18, 1.98, Math.sin(a2) * 0.18]} rotation={[Math.sin(a2) * 0.6, 0, -Math.cos(a2) * 0.6]}>
                <coneGeometry args={[0.05, 0.35, 5]} />
              </mesh>
            );
          })}
          {/* tia điện zic-zac */}
          <group ref={b}>
            {[-1, 1].map((s) => (
              <group key={s} position={[s * 0.6, 1.5, 0]}>
                {[0, 1, 2].map((i) => (
                  <mesh key={i} material={zapMat} position={[(i % 2 ? 0.12 : -0.12) * s, i * 0.3, 0]} rotation-z={(i % 2 ? 0.7 : -0.7) * s}>
                    <boxGeometry args={[0.05, 0.38, 0.05]} />
                  </mesh>
                ))}
              </group>
            ))}
          </group>
        </>
      );
    case 7:
      return (
        <group ref={a}>
          {Array.from({ length: 10 }, (_, i) => {
            const ang = i * 1.7, r = 0.35 + (i % 3) * 0.45;
            return (
              <group key={i} position={[Math.cos(ang) * r, 0.1, Math.sin(ang) * r]} rotation-y={ang}>
                <mesh material={legoMats[i % 4]}>
                  <boxGeometry args={[0.5, 0.2, 0.25]} />
                </mesh>
                {[-0.12, 0.12].map((x) => (
                  <mesh key={x} material={legoMats[i % 4]} position={[x, 0.13, 0]}>
                    <cylinderGeometry args={[0.06, 0.06, 0.06, 8]} />
                  </mesh>
                ))}
              </group>
            );
          })}
        </group>
      );
    case 8:
      return (
        <group ref={a}>
          <mesh material={creamMat} position-y={1.55}>
            <capsuleGeometry args={[0.7, 1.4, 4, 16]} />
          </mesh>
          <mesh material={stickMat} position-y={0.3}>
            <boxGeometry args={[0.25, 0.8, 0.08]} />
          </mesh>
        </group>
      );
    case 9:
      return (
        <group ref={a}>
          {/* chảo chiên to đùng */}
          <mesh material={panMat} position-y={0.25} castShadow>
            <cylinderGeometry args={[1.5, 1.2, 0.5, 24, 1, true]} />
          </mesh>
          <mesh material={panMat} position-y={0.02}>
            <cylinderGeometry args={[1.2, 1.2, 0.04, 24]} />
          </mesh>
          <mesh material={panMat} position={[2.2, 0.45, 0]} rotation-z={Math.PI / 2}>
            <cylinderGeometry args={[0.1, 0.1, 1.5, 8]} />
          </mesh>
          <group ref={b} position-y={0.45}>
            <mesh material={oilMat} rotation-x={-Math.PI / 2}>
              <circleGeometry args={[1.45, 24]} />
            </mesh>
          </group>
          {[0, 2.1, 4.2].map((a2) => (
            <mesh key={a2} material={fireMat} position={[Math.cos(a2) * 0.6, -0.15, Math.sin(a2) * 0.6]}>
              <coneGeometry args={[0.25, 0.45, 8]} />
            </mesh>
          ))}
        </group>
      );
    case 10:
      return (
        <>
          <group ref={a} position={[-9, 0, 0]}>
            {/* bò sữa đốm đen trắng */}
            <mesh material={cowMat} position-y={1.1} castShadow>
              <boxGeometry args={[2.2, 1.2, 1.1]} />
            </mesh>
            {[[-0.5, 1.4, 0.56], [0.4, 0.9, 0.56], [0.1, 1.5, -0.56]].map(([x, y, z], i) => (
              <mesh key={i} material={spotMat} position={[x, y, z]}>
                <boxGeometry args={[0.5, 0.4, 0.02]} />
              </mesh>
            ))}
            <mesh material={cowMat} position={[1.3, 1.45, 0]}>
              <boxGeometry args={[0.8, 0.75, 0.8]} />
            </mesh>
            <mesh material={noseMat} position={[1.75, 1.3, 0]}>
              <boxGeometry args={[0.15, 0.35, 0.6]} />
            </mesh>
            {[-1, 1].map((s) => (
              <mesh key={s} material={hornMat} position={[1.5, 1.95, s * 0.35]} rotation-x={s * 0.6}>
                <coneGeometry args={[0.08, 0.35, 8]} />
              </mesh>
            ))}
            {[-0.7, 0.7].flatMap((x) => [-0.4, 0.4].map((z) => (
              <mesh key={`${x}${z}`} material={cowMat} position={[x, 0.3, z]}>
                <boxGeometry args={[0.25, 0.6, 0.25]} />
              </mesh>
            )))}
          </group>
          {/* sao bay vòng quanh đầu */}
          <group ref={b} position-y={2.2} visible={false}>
            {Array.from({ length: 5 }, (_, i) => (
              <mesh key={i} material={starMat} position={[Math.cos((i / 5) * Math.PI * 2) * 0.5, 0, Math.sin((i / 5) * Math.PI * 2) * 0.5]}>
                <octahedronGeometry args={[0.1, 0]} />
              </mesh>
            ))}
          </group>
        </>
      );
    case 11:
      return (
        <group ref={a} position-y={9}>
          <mesh material={pillowMat} scale={[1.7, 0.55, 1.2]} castShadow>
            <sphereGeometry args={[1, 18, 12]} />
          </mesh>
          {[-1, 1].map((s) => (
            <mesh key={s} material={pillowTrim} position-x={s * 1.65} scale={[0.2, 0.45, 1]}>
              <sphereGeometry args={[1, 10, 8]} />
            </mesh>
          ))}
        </group>
      );
    case 12:
      return (
        <group ref={a} position-y={3.4}>
          {/* búa hơi đồ chơi: đầu đỏ, cán vàng */}
          <mesh material={hammerHead} rotation-z={Math.PI / 2} castShadow>
            <cylinderGeometry args={[0.35, 0.35, 0.9, 16]} />
          </mesh>
          {[-1, 1].map((s) => (
            <mesh key={s} material={hammerHandle} position-x={s * 0.47} rotation-z={Math.PI / 2}>
              <cylinderGeometry args={[0.36, 0.36, 0.06, 16]} />
            </mesh>
          ))}
          <mesh material={hammerHandle} position={[0, 0.9, 0]}>
            <cylinderGeometry args={[0.07, 0.07, 1.5, 8]} />
          </mesh>
        </group>
      );
    case 13:
      return (
        <>
          <group ref={a}>
            <mesh material={sauceMat} rotation-x={-Math.PI / 2} position-y={0.06}>
              <circleGeometry args={[2.3, 32]} />
            </mesh>
          </group>
          {/* chai nước mắm khổng lồ cắm bên ao */}
          <group position={[2.4, 0, -0.6]} rotation-z={0.15}>
            <mesh material={bottleMat} position-y={0.9}><cylinderGeometry args={[0.35, 0.35, 1.8, 14]} /></mesh>
            <mesh material={bottleMat} position-y={2}><cylinderGeometry args={[0.12, 0.3, 0.4, 14]} /></mesh>
            <mesh material={hammerHead} position-y={2.28}><cylinderGeometry args={[0.13, 0.13, 0.16, 12]} /></mesh>
          </group>
        </>
      );
    case 14:
      return (
        <>
          {/* ghế nhựa phòng chờ + đồng hồ */}
          <mesh material={chairMat} position={[0, 0.45, -0.1]}><boxGeometry args={[0.8, 0.1, 0.7]} /></mesh>
          <mesh material={chairMat} position={[0, 0.9, -0.45]}><boxGeometry args={[0.8, 0.8, 0.08]} /></mesh>
          {[-0.33, 0.33].flatMap((x) => [-0.4, 0.2].map((z) => (
            <mesh key={`${x}${z}`} material={chairMat} position={[x, 0.2, z]}><cylinderGeometry args={[0.04, 0.04, 0.4, 6]} /></mesh>
          )))}
          <group position={[1.6, 2.6, -0.6]}>
            <mesh material={clockMat} rotation-x={Math.PI / 2}><cylinderGeometry args={[0.45, 0.45, 0.08, 20]} /></mesh>
            <mesh material={eyeDot} position={[0, 0.12, 0.05]}><boxGeometry args={[0.04, 0.3, 0.02]} /></mesh>
          </group>
          {/* nốt nhạc chờ "tò te tí te" */}
          <group ref={b}>
            {Array.from({ length: 4 }, (_, i) => (
              <group key={i} position={[Math.cos(i * 1.6) * 0.8, 2.1, Math.sin(i * 1.6) * 0.8]}>
                <mesh material={noteMat}><sphereGeometry args={[0.09, 8, 6]} /></mesh>
                <mesh material={noteMat} position={[0.08, 0.18, 0]}><boxGeometry args={[0.025, 0.36, 0.025]} /></mesh>
              </group>
            ))}
          </group>
        </>
      );
    case 15:
      return (
        <group ref={a}>
          {[[-1, 1.1], [1, 1.1], [0, 2.4]].map(([x, y], i) => (
            <mesh key={i} material={i % 2 ? candyB : candyA} position={[x * 1.6, y + (i === 2 ? 0.6 : 0), 0]} rotation-z={i === 2 ? 0 : Math.PI / 2}>
              <cylinderGeometry args={[0.06, 0.06, 2, 8]} />
            </mesh>
          ))}
          {[-2.8, 2.8].map((x) => (
            <mesh key={x} material={postMat} position={[x, 0.9, 0]}>
              <cylinderGeometry args={[0.15, 0.2, 1.8, 8]} />
            </mesh>
          ))}
        </group>
      );
    case 16:
      return (
        <group ref={a} position={[0, 0, 0.75]}>
          {/* bàn nhỏ + tô mì cay đỏ rực */}
          <mesh material={stickMat} position-y={0.4}><cylinderGeometry args={[0.6, 0.6, 0.08, 16]} /></mesh>
          <mesh material={stickDark} position-y={0.2}><cylinderGeometry args={[0.06, 0.06, 0.4, 6]} /></mesh>
          <mesh material={bowlMat} position-y={0.62}><sphereGeometry args={[0.42, 16, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2]} /></mesh>
          <mesh material={noodleMat} position-y={0.6} rotation-x={-Math.PI / 2}><circleGeometry args={[0.38, 16]} /></mesh>
          {[0, 1, 2].map((i) => (
            <mesh key={i} material={chiliMat} position={[Math.cos(i * 2) * 0.2, 0.63, Math.sin(i * 2) * 0.2]} rotation-z={i}>
              <capsuleGeometry args={[0.04, 0.12, 2, 6]} />
            </mesh>
          ))}
          {[-0.05, 0.05].map((x) => (
            <mesh key={x} material={stickDark} position={[x + 0.15, 0.85, 0]} rotation-z={-0.4}>
              <cylinderGeometry args={[0.015, 0.015, 0.6, 4]} />
            </mesh>
          ))}
        </group>
      );
    case 17:
      return (
        <group ref={a}>
          {/* thân máy giặt: khung trắng hở mặt trước */}
          <mesh material={washerMat} position={[0, 1.25, -1.05]}><boxGeometry args={[2.5, 2.5, 0.1]} /></mesh>
          {[-1.2, 1.2].map((x) => (
            <mesh key={x} material={washerMat} position={[x, 1.25, -0.1]}><boxGeometry args={[0.1, 2.5, 2]} /></mesh>
          ))}
          <mesh material={washerMat} position={[0, 2.55, -0.1]}><boxGeometry args={[2.5, 0.1, 2]} /></mesh>
          <mesh material={washerMat} position={[0, -0.02, -0.1]}><boxGeometry args={[2.5, 0.06, 2]} /></mesh>
          {/* cửa kính tròn xoay */}
          <group ref={b} position={[0, 1.2, 0.95]}>
            <mesh material={ringMat}><torusGeometry args={[1.0, 0.09, 8, 32]} /></mesh>
            <mesh material={glassMat}><circleGeometry args={[1.0, 32]} /></mesh>
            <mesh material={ringMat} position={[0.85, 0, 0.05]}><boxGeometry args={[0.12, 0.3, 0.08]} /></mesh>
          </group>
        </group>
      );
    case 18:
      return (
        <>
          {/* hộp ảo thuật tím có sao: nửa dưới đứng yên, nửa trên ráp lại lệch */}
          <mesh material={boxMat} position-y={0.5}><boxGeometry args={[1.1, 1.0, 1.0]} /></mesh>
          <group ref={b}>
            <mesh material={boxMat} position-y={1.32}><boxGeometry args={[1.1, 0.6, 1.0]} /></mesh>
          </group>
          {[0.3, 0.7].map((y) => (
            <mesh key={y} material={boxStar} position={[0, y, 0.51]}><octahedronGeometry args={[0.09, 0]} /></mesh>
          ))}
          <group ref={a} position={[0, 1.02, 0.9]}>
            <mesh material={sawMat} rotation-x={Math.PI / 2}><boxGeometry args={[2.4, 0.04, 0.35]} /></mesh>
            <mesh material={hammerHandle} position-x={1.4}><boxGeometry args={[0.45, 0.25, 0.1]} /></mesh>
          </group>
          <Demon position={[-2.2, 0, 0.6]} rotY={Math.PI / 2} hat />
        </>
      );
    default:
      return null;
  }
}
