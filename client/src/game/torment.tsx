// Cảnh hành hình theo từng tầng: dụng cụ tra tấn + tư thế giãy giụa của hồn ma.
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

/* ---------- Vật liệu dùng chung ---------- */
const iron = new THREE.MeshStandardMaterial({ color: '#5c5f66', metalness: 0.9, roughness: 0.3 });
const blade = new THREE.MeshStandardMaterial({ color: '#cfd6de', metalness: 1, roughness: 0.15 });
const bloodMat = new THREE.MeshStandardMaterial({ color: '#7a0008', emissive: '#3a0004', roughness: 0.25 });
const tongueMat = new THREE.MeshStandardMaterial({ color: '#c41a2a', emissive: '#500010', roughness: 0.4 });
const demonMat = new THREE.MeshStandardMaterial({ color: '#3a1a14', roughness: 0.85 });
const hornMat = new THREE.MeshStandardMaterial({ color: '#e8dcc0', roughness: 0.5 });
const bronzeHot = new THREE.MeshStandardMaterial({ color: '#5a2a10', emissive: new THREE.Color(0.9, 0.18, 0.03), metalness: 0.75, roughness: 0.45 });
const bamboo = new THREE.MeshStandardMaterial({ color: '#b08a4a', roughness: 0.85 });
const iceMat = new THREE.MeshPhysicalMaterial({ color: '#a8e4ff', transparent: true, opacity: 0.55, roughness: 0.05, emissive: '#1a4a66' });
const oilMat = new THREE.MeshStandardMaterial({ color: '#3a1d04', emissive: '#ff6a00', emissiveIntensity: 0.55, roughness: 0.08, metalness: 0.3 });
const cauldronMat = new THREE.MeshStandardMaterial({ color: '#2a2622', metalness: 0.85, roughness: 0.55, emissive: '#3a0a00' });
const fireMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 1.4, 0.2), toneMapped: false, transparent: true, opacity: 0.85 });
const lavaMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(3.5, 0.8, 0.1), toneMapped: false, transparent: true, opacity: 0.8 });
const stoneMat = new THREE.MeshStandardMaterial({ color: '#56504a', roughness: 0.95 });
const woodMat = new THREE.MeshStandardMaterial({ color: '#5a3420', roughness: 0.85 });
const ropeMat = new THREE.MeshStandardMaterial({ color: '#8a6a3a', roughness: 1 });
const mirrorMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 0.25, 0.2), toneMapped: false });
const chainMat = new THREE.MeshStandardMaterial({ color: '#3a3a3e', metalness: 0.9, roughness: 0.45 });
const poolMat = new THREE.MeshStandardMaterial({ color: '#5a0006', emissive: '#2a0003', roughness: 0.1, metalness: 0.2 });
const cutMat = new THREE.MeshStandardMaterial({ color: '#4a0004', emissive: '#1a0000', roughness: 0.2 });

const ease = (x: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);
const jit = (e: number, a: number, f = 47) => Math.sin(e * f) * a;
const tmp = new THREE.Vector3();

/** Phun máu / hơi / tia lửa tại một điểm (toạ độ cục bộ của cụm) */
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

const RED = new THREE.Color('#ff3020'), BLACK = new THREE.Color('#140806'), ICE = new THREE.Color('#9ad8ff'), EMBER = new THREE.Color('#ff4010');

/** Đặt tư thế giãy giụa theo tầng. */
export function applyPose(level: number, pain: Pain, p: Parts) {
  for (const m of p.mats) if (!savedMat.has(m)) savedMat.set(m, { color: m.color.clone(), emissive: m.emissive.clone(), opacity: m.opacity });
  const { e, k } = pain;
  const fade = Math.min(1, (pain.dur - e) / 0.4); // hồi lại ở cuối
  const P = p.pose;
  // mặc định: run rẩy, há miệng kêu
  P.rotation.z = jit(e, 0.06);
  P.position.x = jit(e, 0.04, 53);
  p.mouth.scale.set(BASE.mouth[0] * 1.3, BASE.mouth[1] * (2.2 + 1.2 * Math.sin(e * 9)), BASE.mouth[2]);
  p.head.rotation.x = -0.35 + jit(e, 0.08, 23); // ngửa cổ kêu la
  p.legL.rotation.x = Math.sin(e * 11) * 0.35; // giãy đạp
  p.legR.rotation.x = -Math.sin(e * 11) * 0.35;
  p.armL.position.y = BASE.arm[1] + 0.35 + Math.sin(e * 14) * 0.2;
  p.armR.position.y = BASE.arm[1] + 0.35 + Math.cos(e * 14) * 0.2;
  const tint = (c: THREE.Color, em: THREE.Color, a: number) => {
    for (const m of p.mats) {
      const o = savedMat.get(m)!;
      m.color.copy(o.color).lerp(c, a);
      m.emissive.copy(o.emissive).lerp(em, a);
    }
  };

  switch (level) {
    case 1: // kéo lưỡi: bị lôi chúi về phía trước
      P.rotation.x = 0.35 + jit(e, 0.05);
      P.position.z = 0.25 + Math.max(0, Math.sin(e * 3)) * 0.35;
      break;
    case 2: { // kéo cắt: tay bị cắt rồi mọc lại
      const ph = (e % 0.7) / 0.7;
      const s = ph < 0.15 ? 1 - ph / 0.15 : Math.min(1, (ph - 0.5) / 0.5);
      p.armL.scale.setScalar(Math.max(0.05, s));
      p.armR.scale.setScalar(Math.max(0.05, ph > 0.35 ? s : 1));
      break;
    }
    case 3: // treo lên cây sắt
      P.position.y = 2.4 * ease(e * 1.5) * fade;
      P.position.z = -0.35;
      P.rotation.z = Math.sin(e * 2.2) * 0.25 + jit(e, 0.04);
      break;
    case 4: // co rúm trước Gương Nghiệt
      P.position.z = -0.6 * ease(e);
      P.scale.setScalar(1 - 0.12 * Math.abs(Math.sin(e * 6)));
      P.rotation.x = -0.25;
      break;
    case 5: // hấp chín
      tint(RED, RED, ease(e / 2) * 0.8 * fade);
      P.scale.y = 1 - 0.08 * Math.abs(Math.sin(e * 8));
      break;
    case 6: // ôm cột đồng nung đỏ
      P.position.z = -0.35;
      P.rotation.x = -0.15;
      tint(BLACK, EMBER, ease(e / 2.5) * 0.75 * fade);
      p.armL.position.set(-0.55, 1.05, -0.45);
      p.armR.position.set(0.55, 1.05, -0.45);
      break;
    case 7: // bị đao xuyên nhấc bổng
      P.position.y = 1.5 * ease((e - 0.25) * 5) * fade;
      P.rotation.x = 0.2 + jit(e, 0.08, 61);
      break;
    case 8: // đóng băng
      tint(ICE, ICE, ease(e / 1.5) * 0.85 * fade);
      P.rotation.z = jit(e, 0.03, 80);
      p.armL.position.y = p.armR.position.y = BASE.arm[1] + 0.1;
      break;
    case 9: { // thả vào vạc dầu: nhấc lên rồi chìm, chỉ còn đầu ngóc lên
      const up = e < 0.7 ? ease(e / 0.7) * 2.6 : 2.6 - ease((e - 0.7) / 0.5) * 3.1;
      P.position.y = (e < 1.2 ? up : -0.5 + Math.max(0, Math.sin(e * 4)) * 0.4) * fade;
      tint(RED, EMBER, Math.min(1, e / 3) * 0.5 * fade);
      break;
    }
    case 10: { // trâu húc tung lên
      const ph = e % 1.6;
      const air = ph > 0.8 ? (ph - 0.8) / 0.8 : 0;
      P.position.y = Math.sin(air * Math.PI) * 3.2;
      P.position.x = air * 2.2;
      P.rotation.x = air * Math.PI * 2;
      break;
    }
    case 11: { // đá đè bẹp
      const sq = ease((e - 0.45) * 6) * fade;
      P.scale.set(1 + 0.45 * sq, 1 - 0.72 * sq, 1 + 0.45 * sq);
      p.armL.position.x = -BASE.arm[0] - 0.4 * sq;
      p.armR.position.x = BASE.arm[0] + 0.4 * sq;
      break;
    }
    case 12: { // chày giã
      const ph = (e % 0.7) / 0.7;
      const sq = ph < 0.12 ? ph / 0.12 : Math.max(0, 1 - (ph - 0.12) / 0.4);
      P.scale.set(1 + 0.3 * sq, 1 - 0.5 * sq, 1 + 0.3 * sq);
      P.position.y = 0.2;
      break;
    }
    case 13: // dìm xuống ao máu
      P.position.y = (-1.0 * ease(e) + Math.sin(e * 3) * 0.25) * fade;
      tint(RED, RED, Math.min(1, e / 2) * 0.6 * fade);
      p.armL.position.y = BASE.arm[1] + 0.9 + Math.sin(e * 10) * 0.35;
      p.armR.position.y = BASE.arm[1] + 0.9 + Math.cos(e * 10) * 0.35;
      break;
    case 14: // xích lôi đi, mờ dần
      P.position.x = Math.sin(e * 1.4) * 1.2;
      P.rotation.x = 0.3;
      for (const m of p.mats) m.opacity = savedMat.get(m)!.opacity * (0.35 + 0.35 * Math.abs(Math.sin(e * 5)) + 0.3 * (1 - fade));
      break;
    case 15: { // phanh thây: tứ chi bị kéo căng
      const pull = ease(e / 1.2) * (0.8 + 0.2 * Math.sin(e * 12)) * fade;
      p.head.position.y = BASE.head + 0.9 * pull;
      p.armL.position.x = -BASE.arm[0] - 1.1 * pull;
      p.armR.position.x = BASE.arm[0] + 1.1 * pull;
      p.armL.position.y = p.armR.position.y = BASE.arm[1] + 0.3 * pull;
      p.body.position.y = BASE.body - 0.15 * pull;
      P.position.y = 0.8 * pull;
      break;
    }
    case 16: // thiêu thành than
      tint(BLACK, EMBER, ease(e / 1.8) * 0.9 * fade);
      P.rotation.z = jit(e, 0.1, 35);
      break;
    case 17: { // kẹp giữa hai cối xay
      const sq = ease(e / 1.2) * fade;
      P.rotation.y = e * 6 * sq;
      P.scale.set(1 + 0.25 * sq, 1 - 0.55 * sq, 1 + 0.25 * sq);
      P.position.y = 0.35;
      break;
    }
    case 18: { // cưa xẻ: hai nửa người tách dần
      const cut = ease(e / (pain.dur * 0.8)) * fade;
      p.armL.position.x = -BASE.arm[0] - 0.35 * cut;
      p.armR.position.x = BASE.arm[0] + 0.35 * cut;
      P.rotation.z = jit(e, 0.05, 30) + Math.sin(e * 5) * 0.08 * cut;
      break;
    }
  }
  // tay "nhấc lên" theo độ cao → xoay quanh khớp vai cho ra dáng vùng vẫy
  const lift = (y: number) => THREE.MathUtils.clamp((y - BASE.arm[1]) * 2.6, 0, 2.8);
  p.armL.rotation.z = -lift(p.armL.position.y);
  p.armR.rotation.z = lift(p.armR.position.y);
  p.armL.position.y = Math.min(p.armL.position.y, BASE.arm[1] + 0.25);
  p.armR.position.y = Math.min(p.armR.position.y, BASE.arm[1] + 0.25);
}

/* ---------- Dụng cụ tra tấn: hiện ra quanh hồn đang chịu hình ---------- */
export function TortureRig({ id, level, sin }: { id: string; level: number; sin?: string }) {
  const root = useRef<THREE.Group>(null);
  const a = useRef<THREE.Group>(null); // bộ phận chuyển động chính
  const b = useRef<THREE.Group>(null); // bộ phận phụ
  const mirrorTex = useMemo(() => (level === 4 ? textTexture(['NGHIỆT KÍNH ĐÀI', (sin || 'Tội lỗi không giấu được').slice(0, 40)], { w: 1024, h: 512, size: 84, color: '#fff2e0', glow: '#ff2010' }) : null), [level, sin]);

  useFrame(() => {
    const g = root.current;
    if (!g) return;
    const pain = painOf(id);
    g.visible = !!pain;
    if (!pain) return;
    const { e, dur } = pain;
    const out = Math.min(1, (dur - e) / 0.35); // thu dụng cụ về ở cuối
    const A = a.current, B = b.current;
    const mine = id === useGame.getState().myId;
    const near = mine ? 1 : 0;

    switch (level) {
      case 1: { // kìm kéo lưỡi
        const pull = 0.3 + Math.max(0, Math.sin(e * 3)) * 1.8 * out;
        if (A) A.scale.set(1, 1, pull);
        if (B) B.position.z = 0.45 + pull;
        every(id, 0.7, () => {
          spray(g, 0, 1.55, 0.2 + pull, 'blood');
          if (near) sfx.squelch();
        });
        break;
      }
      case 2: { // kéo sắt cắt phập
        const ph = (e % 0.7) / 0.7;
        const open = ph < 0.15 ? 0.05 : 0.05 + Math.min(1, (ph - 0.15) / 0.5) * 0.7;
        if (A) A.rotation.y = open;
        if (B) B.rotation.y = -open;
        every(id, 0.7, () => {
          spray(g, -0.35, 0.85, 0.2, 'blood');
          if (near) sfx.snip();
        });
        break;
      }
      case 3:
      case 7: { // cây sắt / đao mọc lên
        const up = ease((e - (level === 7 ? 0.1 : 0)) * 4) * out;
        if (A) A.scale.set(1, Math.max(0.01, up), 1);
        every(id, 0.9, () => {
          spray(g, 0, level === 7 ? 2.2 : 3.4, 0, 'blood');
          if (near) sfx.stab();
        });
        break;
      }
      case 4: { // gương nghiệt chớp đỏ
        mirrorMat.color.setRGB(1.2 + Math.abs(Math.sin(e * 7)) * 1.6, 0.25, 0.2);
        if (A) A.scale.setScalar(ease(e * 2.5) * out);
        every(id, 1.1, () => near && sfx.heartbeat());
        break;
      }
      case 5: { // lồng hấp sập xuống
        if (A) A.position.y = 7 * (1 - ease(e * 2)) + (1 - out) * 7 + jit(e, 0.04, 30);
        every(id, 0.25, () => spray(g, 0, 3, 0, 'white'));
        if (near && Math.random() < 0.05) sfx.sizzle();
        break;
      }
      case 6: // cột đồng nung
        if (A) A.scale.set(1, Math.max(0.01, ease(e * 3) * out), 1);
        every(id, 0.3, () => {
          spray(g, 0, 1.4, -0.5, 'smoke');
          if (near && Math.random() < 0.4) sfx.sizzle();
        });
        break;
      case 8: // khối băng
        if (A) A.scale.setScalar(Math.max(0.01, ease(e * 1.5) * out));
        every(id, 0.6, () => {
          spray(g, 0, 1.5, 0, 'blue');
          if (near) sfx.crack();
        });
        break;
      case 9: { // vạc dầu sôi
        if (A) A.scale.setScalar(Math.max(0.01, ease(e * 3) * out));
        if (B) B.position.y = 1.15 + Math.sin(e * 9) * 0.04;
        every(id, 0.2, () => spray(g, (Math.random() - 0.5) * 2, 1.4, (Math.random() - 0.5) * 2, 'gold'));
        if (near && Math.random() < 0.08) sfx.sizzle();
        break;
      }
      case 10: { // trâu điên lao tới
        const ph = e % 1.6;
        if (A) {
          A.position.x = ph < 0.8 ? -9 + (ph / 0.8) * 8.4 : -0.6 + (ph - 0.8) * 3;
          A.visible = e < dur - 0.3;
        }
        if (ph > 0.78 && ph < 0.84) every(id, 1, () => {
          spray(g, 0, 1.2, 0, 'blood');
          if (near) sfx.crunch();
        });
        break;
      }
      case 11: { // tảng đá rơi
        const fall = ease((e - 0.1) * 3);
        if (A) {
          A.position.y = 9 - fall * (9 - 1.1) + Math.max(0, Math.sin(e * 5)) * 0.2 + (1 - out) * 6;
          A.rotation.z = Math.sin(e * 3) * 0.15;
        }
        if (e > 0.42 && e < 0.5) every(id, 1, () => {
          spray(g, 0, 0.5, 0, 'blood');
          if (near) sfx.crunch();
        });
        break;
      }
      case 12: { // chày giã
        const ph = (e % 0.7) / 0.7;
        if (A) A.position.y = ph < 0.12 ? 3.6 - (ph / 0.12) * 2.4 : 1.2 + Math.min(1, (ph - 0.12) / 0.5) * 2.4;
        every(id, 0.7, () => {
          spray(g, 0, 1, 0, 'blood');
          if (near) sfx.crunch();
        });
        break;
      }
      case 13: // ao máu sủi bọt
        if (A) A.scale.setScalar(Math.max(0.01, ease(e * 2) * out));
        every(id, 0.25, () => spray(g, (Math.random() - 0.5) * 2.5, 0.2, (Math.random() - 0.5) * 2.5, 'blood'));
        if (near && Math.random() < 0.05) sfx.bubble();
        break;
      case 14: // xích sắt
        if (A) A.position.x = Math.sin(e * 1.4) * 1.2;
        if (A) A.scale.set(1, 1, out);
        every(id, 0.8, () => near && sfx.chain());
        break;
      case 15: { // thừng kéo tứ chi
        const pull = ease(e / 1.2) * (0.8 + 0.2 * Math.sin(e * 12)) * out;
        if (A) A.scale.setScalar(0.6 + pull * 0.6);
        every(id, 0.5, () => {
          spray(g, (Math.random() < 0.5 ? -1 : 1) * 1.3, 1.6, 0, 'blood');
          if (near) sfx.squelch();
        });
        break;
      }
      case 16: // cột dung nham
        if (A) A.scale.set(1, Math.max(0.01, ease(e * 2.5) * out * (1 + Math.sin(e * 13) * 0.1)), 1);
        every(id, 0.15, () => spray(g, (Math.random() - 0.5) * 1.6, 0.5, (Math.random() - 0.5) * 1.6, 'gold'));
        if (near && Math.random() < 0.07) sfx.sizzle();
        break;
      case 17: // cối xay nghiến
        if (A) {
          A.rotation.y = e * 6;
          A.position.y = 3.6 - ease(e / 1.2) * 1.8 + (1 - out) * 4;
        }
        every(id, 0.4, () => {
          spray(g, 1.4, 1, 0, Math.random() < 0.5 ? 'blood' : 'white'); // máu lẫn bột xương
          if (near) sfx.grind();
        });
        break;
      case 18: { // trói cột, cưa từ dưới lên
        const cut = ease(e / (dur * 0.8));
        const y = 0.25 + cut * 2.3;
        if (A) {
          A.position.y = y;
          A.position.x = Math.sin(e * 16) * 0.5;
        }
        if (B) B.scale.set(1, Math.max(0.01, cut), 1);
        every(id, 0.35, () => {
          spray(g, 0, y, 0.4, 'blood');
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

/** Ngưu Đầu / Mã Diện đứng hành hình */
function Demon({ position, rotY = 0 }: { position: [number, number, number]; rotY?: number }) {
  return (
    <group position={position} rotation-y={rotY}>
      <mesh material={demonMat} position-y={1.1} castShadow>
        <boxGeometry args={[1.1, 1.6, 0.7]} />
      </mesh>
      <mesh material={demonMat} position-y={2.25}>
        <boxGeometry args={[0.8, 0.7, 0.75]} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} material={hornMat} position={[s * 0.45, 2.7, 0]} rotation-z={-s * 0.6}>
          <coneGeometry args={[0.1, 0.55, 8]} />
        </mesh>
      ))}
      <mesh position={[0, 2.35, 0.38]}>
        <boxGeometry args={[0.5, 0.08, 0.02]} />
        <meshBasicMaterial color={new THREE.Color(4, 0.3, 0.1)} toneMapped={false} />
      </mesh>
    </group>
  );
}

function Rig({ level, a, b, mirrorTex }: { level: number; a: R; b: R; mirrorTex: THREE.Texture | null }) {
  switch (level) {
    case 1:
      return (
        <>
          <group ref={a} position={[0, 1.6, 0.18]}>
            {/* lưỡi kéo dài theo trục z */}
            <mesh material={tongueMat} position-z={0.5}>
              <boxGeometry args={[0.2, 0.06, 1]} />
            </mesh>
          </group>
          <group ref={b} position={[0, 1.6, 1.0]}>
            <mesh material={iron} rotation-x={Math.PI / 2}>
              <cylinderGeometry args={[0.05, 0.05, 0.9, 8]} />
            </mesh>
          </group>
          <Demon position={[0, 0, 3.4]} rotY={Math.PI} />
        </>
      );
    case 2:
      return (
        <group position={[-0.35, 0.85, 0.3]} rotation-y={0.5}>
          <group ref={a}>
            <mesh material={blade} position-x={-1.1}>
              <boxGeometry args={[2.2, 0.08, 0.3]} />
            </mesh>
          </group>
          <group ref={b}>
            <mesh material={blade} position-x={-1.1}>
              <boxGeometry args={[2.2, 0.08, 0.3]} />
            </mesh>
          </group>
          <mesh material={iron}>
            <cylinderGeometry args={[0.12, 0.12, 0.3, 12]} />
          </mesh>
        </group>
      );
    case 3:
      return (
        <group ref={a}>
          <mesh material={iron} position={[0, 2.5, -0.8]} castShadow>
            <cylinderGeometry args={[0.2, 0.35, 5, 8]} />
          </mesh>
          {Array.from({ length: 10 }, (_, i) => {
            const ang = i * 2.4, y = 1.6 + (i % 5) * 0.55;
            return (
              <mesh key={i} material={blade} position={[Math.cos(ang) * 0.55, y, -0.4 + Math.sin(ang) * 0.55]} rotation={[Math.sin(ang) * 1.2, 0, -Math.cos(ang) * 1.2]}>
                <coneGeometry args={[0.07, 1.2, 4]} />
              </mesh>
            );
          })}
        </group>
      );
    case 4:
      return (
        <group ref={a} position={[0, 2.2, 2.6]} rotation-y={Math.PI}>
          <mesh material={bronzeHot}>
            <torusGeometry args={[1.6, 0.14, 12, 40]} />
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
        <group ref={a}>
          <mesh material={bamboo} position-y={1.2}>
            <cylinderGeometry args={[1.25, 1.25, 2.4, 20, 1, true]} />
          </mesh>
          <mesh material={bamboo} position-y={2.55}>
            <coneGeometry args={[1.35, 0.6, 20]} />
          </mesh>
          {[0.3, 1.2, 2.1].map((y) => (
            <mesh key={y} material={woodMat} position-y={y} rotation-x={Math.PI / 2}>
              <torusGeometry args={[1.27, 0.06, 6, 24]} />
            </mesh>
          ))}
        </group>
      );
    case 6:
      return (
        <group ref={a}>
          <mesh material={bronzeHot} position={[0, 1.8, -0.95]} castShadow>
            <cylinderGeometry args={[0.45, 0.5, 3.6, 16]} />
          </mesh>
          {[0.8, 1.5].map((y) => (
            <mesh key={y} material={chainMat} position={[0, y, -0.55]} rotation-x={Math.PI / 2}>
              <torusGeometry args={[0.7, 0.05, 6, 20]} />
            </mesh>
          ))}
        </group>
      );
    case 7:
      return (
        <group ref={a}>
          {Array.from({ length: 9 }, (_, i) => {
            const r = i === 0 ? 0 : 0.5 + (i % 2) * 0.5, ang = i * 0.8;
            return (
              <mesh key={i} material={blade} position={[Math.cos(ang) * r, 1.1, Math.sin(ang) * r]}>
                <coneGeometry args={[0.12, 2.2 + (i === 0 ? 0.8 : 0), 4]} />
              </mesh>
            );
          })}
        </group>
      );
    case 8:
      return (
        <group ref={a}>
          <mesh material={iceMat} position-y={1.3}>
            <boxGeometry args={[1.9, 2.6, 1.9]} />
          </mesh>
          {[-0.7, 0.6].map((x) => (
            <mesh key={x} material={iceMat} position={[x, 0.3, 0.9]} rotation-z={x}>
              <coneGeometry args={[0.25, 0.9, 5]} />
            </mesh>
          ))}
        </group>
      );
    case 9:
      return (
        <group ref={a}>
          <mesh material={cauldronMat} position-y={0.75} castShadow>
            <cylinderGeometry args={[1.5, 1.1, 1.5, 24, 1, true]} />
          </mesh>
          <mesh material={cauldronMat} position-y={1.5} rotation-x={Math.PI / 2}>
            <torusGeometry args={[1.5, 0.09, 8, 32]} />
          </mesh>
          <group ref={b} position-y={1.15}>
            <mesh material={oilMat} rotation-x={-Math.PI / 2}>
              <circleGeometry args={[1.42, 24]} />
            </mesh>
          </group>
          {[0, 2.1, 4.2].map((a2) => (
            <mesh key={a2} material={fireMat} position={[Math.cos(a2) * 0.7, 0.1, Math.sin(a2) * 0.7]}>
              <coneGeometry args={[0.4, 0.9, 8]} />
            </mesh>
          ))}
        </group>
      );
    case 10:
      return (
        <group ref={a} position={[-9, 0, 0]}>
          <mesh material={demonMat} position-y={1.1} castShadow>
            <boxGeometry args={[2.2, 1.3, 1.1]} />
          </mesh>
          <mesh material={demonMat} position={[1.3, 1.4, 0]}>
            <boxGeometry args={[0.8, 0.8, 0.8]} />
          </mesh>
          {[-1, 1].map((s) => (
            <mesh key={s} material={hornMat} position={[1.7, 1.9, s * 0.45]} rotation-x={s * 0.9}>
              <coneGeometry args={[0.1, 0.8, 8]} />
            </mesh>
          ))}
          {[-0.7, 0.7].flatMap((x) => [-0.4, 0.4].map((z) => (
            <mesh key={`${x}${z}`} material={demonMat} position={[x, 0.3, z]}>
              <boxGeometry args={[0.25, 0.6, 0.25]} />
            </mesh>
          )))}
        </group>
      );
    case 11:
      return (
        <group ref={a} position-y={9}>
          <mesh material={stoneMat} castShadow>
            <dodecahedronGeometry args={[1.4, 0]} />
          </mesh>
        </group>
      );
    case 12:
      return (
        <>
          <mesh material={stoneMat} position-y={0.45}>
            <cylinderGeometry args={[1.3, 1.0, 0.9, 20, 1, true]} />
          </mesh>
          <group ref={a} position-y={3.6}>
            <mesh material={woodMat} castShadow>
              <cylinderGeometry args={[0.45, 0.55, 1.4, 14]} />
            </mesh>
            <mesh material={woodMat} position-y={1.5}>
              <cylinderGeometry args={[0.1, 0.1, 2, 8]} />
            </mesh>
          </group>
        </>
      );
    case 13:
      return (
        <group ref={a}>
          <mesh material={poolMat} rotation-x={-Math.PI / 2} position-y={0.06}>
            <circleGeometry args={[2.3, 32]} />
          </mesh>
        </group>
      );
    case 14:
      return (
        <group ref={a}>
          {[-1, 1].map((s) => (
            <group key={s}>
              {Array.from({ length: 7 }, (_, i) => (
                <mesh key={i} material={chainMat} position={[s * (0.6 + i * 0.32), 1.0 + i * 0.05, 0]} rotation={[i % 2 ? Math.PI / 2 : 0, Math.PI / 2, 0]}>
                  <torusGeometry args={[0.15, 0.04, 6, 12]} />
                </mesh>
              ))}
            </group>
          ))}
        </group>
      );
    case 15:
      return (
        <group ref={a}>
          {[[-1, 1.1], [1, 1.1], [0, 2.4]].map(([x, y], i) => (
            <mesh key={i} material={ropeMat} position={[x * 1.6, y + (i === 2 ? 0.6 : 0), 0]} rotation-z={i === 2 ? 0 : Math.PI / 2}>
              <cylinderGeometry args={[0.04, 0.04, 2, 6]} />
            </mesh>
          ))}
          {[-2.8, 2.8].map((x) => (
            <mesh key={x} material={woodMat} position={[x, 0.9, 0]}>
              <cylinderGeometry args={[0.15, 0.2, 1.8, 8]} />
            </mesh>
          ))}
        </group>
      );
    case 16:
      return (
        <group ref={a}>
          {Array.from({ length: 6 }, (_, i) => (
            <mesh key={i} material={i % 2 ? fireMat : lavaMat} position={[Math.cos(i) * 0.7, 1.4, Math.sin(i) * 0.7]}>
              <coneGeometry args={[0.45, 2.8 + (i % 3) * 0.4, 8]} />
            </mesh>
          ))}
          <mesh material={lavaMat} rotation-x={-Math.PI / 2} position-y={0.05}>
            <circleGeometry args={[1.6, 24]} />
          </mesh>
        </group>
      );
    case 17:
      return (
        <>
          <mesh material={stoneMat} position-y={0.2}>
            <cylinderGeometry args={[1.6, 1.6, 0.4, 24]} />
          </mesh>
          <group ref={a} position-y={3.6}>
            <mesh material={stoneMat} castShadow>
              <cylinderGeometry args={[1.6, 1.6, 0.6, 24]} />
            </mesh>
            <mesh material={woodMat} position={[1.9, 0, 0]} rotation-z={Math.PI / 2}>
              <cylinderGeometry args={[0.1, 0.1, 1, 8]} />
            </mesh>
          </group>
        </>
      );
    case 18:
      return (
        <>
          {/* cột trói sau lưng + dây thừng */}
          <mesh material={woodMat} position={[0, 1.8, -0.75]} castShadow>
            <cylinderGeometry args={[0.22, 0.26, 3.6, 10]} />
          </mesh>
          {[0.55, 1.05, 1.35].map((y) => (
            <mesh key={y} material={ropeMat} position={[0, y, -0.32]} rotation-x={Math.PI / 2}>
              <torusGeometry args={[0.56, 0.035, 6, 20]} />
            </mesh>
          ))}
          <group ref={a} position-y={0.25}>
            <mesh material={blade} rotation-z={Math.PI / 2}>
              <boxGeometry args={[0.08, 3.2, 0.5]} />
            </mesh>
            {Array.from({ length: 12 }, (_, i) => (
              <mesh key={i} material={blade} position={[-1.5 + i * 0.27, -0.27, 0]} rotation-z={Math.PI}>
                <coneGeometry args={[0.08, 0.14, 3]} />
              </mesh>
            ))}
          </group>
          {/* vết cưa đỏ lòm chạy từ dưới lên */}
          <group ref={b} position-y={0.2}>
            <mesh material={cutMat} position-y={1.4}>
              <boxGeometry args={[0.06, 2.8, 1.5]} />
            </mesh>
          </group>
        </>
      );
    default:
      return null;
  }
}
