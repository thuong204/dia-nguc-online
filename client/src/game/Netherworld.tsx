// Điện Sâm La — nơi Diêm La Vương xét xử. Hình tượng theo tranh thờ, tuồng cổ dân gian:
// long bào, mũ miện rèm ngọc, Phán Quan mũ ô sa, Hắc Bạch Vô Thường, Ngưu Đầu Mã Diện.
import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { GuardModel } from './World.tsx';
import { dotTexture, textTexture } from './textures.ts';

/* ================= Vật liệu & hoạ tiết vẽ bằng canvas ================= */
function canvasTex(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void, repeat?: [number, number]) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d')!);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(...repeat);
  }
  t.anisotropy = 4;
  return t;
}

/** Gấm thêu: nền màu, hoạ tiết mây cuộn & chấm vàng. */
function brocade(base: string, motif: string) {
  return canvasTex(256, 256, (g) => {
    g.fillStyle = base;
    g.fillRect(0, 0, 256, 256);
    g.strokeStyle = motif;
    g.lineWidth = 5;
    for (let i = 0; i < 4; i++)
      for (let j = 0; j < 4; j++) {
        const x = i * 64 + (j % 2) * 32 + 16, y = j * 64 + 16;
        g.beginPath();
        g.arc(x, y, 14, Math.PI * 0.2, Math.PI * 1.7);
        g.stroke();
        g.beginPath();
        g.arc(x + 12, y + 4, 7, Math.PI, Math.PI * 2.4);
        g.stroke();
      }
    g.fillStyle = motif;
    for (let i = 0; i < 40; i++) g.fillRect((i * 53) % 256, (i * 97) % 256, 3, 3);
  }, [2, 2]);
}

const floorTex = () =>
  canvasTex(512, 512, (g) => {
    g.fillStyle = '#1a1210';
    g.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 4; i++)
      for (let j = 0; j < 4; j++) {
        const v = 26 + ((i * 7 + j * 13) % 9);
        g.fillStyle = `rgb(${v + 8},${v},${v - 4})`;
        g.fillRect(i * 128 + 3, j * 128 + 3, 122, 122);
      }
    for (let k = 0; k < 900; k++) {
      g.fillStyle = `rgba(0,0,0,${Math.random() * 0.25})`;
      g.fillRect(Math.random() * 512, Math.random() * 512, 2, 2);
    }
  }, [10, 10]);

/** Bình phong "hải thuỷ triều dương": sóng nước & mặt trời đỏ. */
const screenTex = () =>
  canvasTex(1024, 512, (g) => {
    const sky = g.createLinearGradient(0, 0, 0, 512);
    sky.addColorStop(0, '#2a0806');
    sky.addColorStop(0.55, '#5a1208');
    sky.addColorStop(1, '#0a1a24');
    g.fillStyle = sky;
    g.fillRect(0, 0, 1024, 512);
    const sun = g.createRadialGradient(512, 200, 10, 512, 200, 150);
    sun.addColorStop(0, '#ffdf8a');
    sun.addColorStop(0.35, '#ff4a1a');
    sun.addColorStop(1, 'rgba(255,60,20,0)');
    g.fillStyle = sun;
    g.fillRect(300, 40, 424, 330);
    // mây vàng
    g.strokeStyle = '#d8a040';
    g.lineWidth = 6;
    [[180, 120], [820, 110], [300, 260], [740, 250]].forEach(([x, y]) => {
      for (let k = 0; k < 3; k++) {
        g.beginPath();
        g.arc(x + k * 34, y, 18, Math.PI, Math.PI * 2);
        g.stroke();
      }
    });
    // sóng nước nhiều lớp
    for (let row = 0; row < 7; row++) {
      const y = 320 + row * 30;
      g.strokeStyle = row % 2 ? '#3a7a8a' : '#d8e0d0';
      g.lineWidth = 4;
      for (let x = -40; x < 1064; x += 64) {
        g.beginPath();
        g.arc(x + (row % 2) * 32, y, 30, Math.PI * 1.05, Math.PI * 1.95);
        g.stroke();
      }
    }
    g.strokeStyle = '#c8902a';
    g.lineWidth = 18;
    g.strokeRect(9, 9, 1006, 494);
  });

const M = {
  lacquer: new THREE.MeshStandardMaterial({ color: '#6a0e0a', roughness: 0.35, metalness: 0.15 }),
  gold: new THREE.MeshStandardMaterial({ color: '#d4a03a', metalness: 0.9, roughness: 0.28, emissive: '#3a2400' }),
  stone: new THREE.MeshStandardMaterial({ color: '#3a302c', roughness: 0.9 }),
  darkWood: new THREE.MeshStandardMaterial({ color: '#2a1008', roughness: 0.6 }),
  bronze: new THREE.MeshStandardMaterial({ color: '#5a4020', metalness: 0.85, roughness: 0.4, emissive: '#1a0c00' }),
  beam: new THREE.MeshStandardMaterial({ color: '#1f4a4a', roughness: 0.6 }),
  black: new THREE.MeshStandardMaterial({ color: '#0c0c0e', roughness: 0.5 }),
  ivory: new THREE.MeshStandardMaterial({ color: '#efe6cc', roughness: 0.6 }),
  paper: new THREE.MeshStandardMaterial({ color: '#e8d8a8', roughness: 0.8 }),
  white: new THREE.MeshBasicMaterial({ color: '#f6f2ea' }),
  pupil: new THREE.MeshBasicMaterial({ color: '#0a0505' }),
  tongue: new THREE.MeshStandardMaterial({ color: '#c0101a', emissive: '#500008', roughness: 0.4 }),
  iron: new THREE.MeshStandardMaterial({ color: '#4a4a50', metalness: 0.9, roughness: 0.35 }),
  ghostFire: new THREE.MeshBasicMaterial({ color: new THREE.Color(0.5, 1.8, 2.8), toneMapped: false }),
  lantern: new THREE.MeshStandardMaterial({ color: '#c01a10', emissive: '#ff3a10', emissiveIntensity: 1.6, roughness: 0.6 }),
};

/* ================= Nhân vật ================= */
type Hat = 'mian' | 'wusha' | 'tall';
interface OfficialProps {
  robe: THREE.Material;
  trim: THREE.Material;
  skin: string;
  hat: Hat;
  hatColor?: string;
  hatText?: string;
  beard?: 'long' | 'short' | 'none';
  brows?: 'fierce' | 'calm';
  seated?: boolean;
  tongue?: boolean;
  hold?: 'hot' | 'brush' | 'chain' | 'staff';
  slim?: boolean;
}

const beadGeo = new THREE.SphereGeometry(0.028, 6, 5);
const beadMat = new THREE.MeshStandardMaterial({ color: '#9ab0c8', metalness: 0.5, roughness: 0.3 });

/** Rèm chuỗi ngọc (旒) rủ trước & sau mũ miện. */
function Beads() {
  const ref = useRef<THREE.InstancedMesh>(null);
  const N = 2 * 9 * 5;
  useLayoutEffect(() => {
    const m = new THREE.Matrix4();
    let k = 0;
    for (const side of [1, -1])
      for (let s = 0; s < 9; s++)
        for (let b = 0; b < 5; b++) {
          m.makeTranslation(-0.34 + s * 0.085, -0.07 - b * 0.075, side * 0.24);
          ref.current!.setMatrixAt(k++, m);
        }
    ref.current!.instanceMatrix.needsUpdate = true;
  }, []);
  return <instancedMesh ref={ref} args={[beadGeo, beadMat, N]} />;
}

function Official({ robe, trim, skin, hat, hatColor = '#111', hatText, beard = 'none', brows = 'calm', seated, tongue, hold, slim }: OfficialProps) {
  const skinMat = useMemo(() => new THREE.MeshStandardMaterial({ color: skin, roughness: 0.65 }), [skin]);
  const hatMat = useMemo(() => new THREE.MeshStandardMaterial({ color: hatColor, roughness: 0.7 }), [hatColor]);
  const hatTex = useMemo(
    () => (hatText ? textTexture(hatText.split(''), { w: 128, h: 512, size: 100, serif: true, color: hatColor === '#111' ? '#f0e0c0' : '#2a0000', glow: 'rgba(0,0,0,0)' }) : null),
    [hatText, hatColor],
  );
  const up = seated ? -0.5 : 0; // ngồi thì nửa trên hạ xuống
  const w = slim ? 0.8 : 1; // Vô Thường cao gầy
  const fierce = brows === 'fierce';
  return (
    <group>
      {/* nửa dưới: vạt áo dài hoặc dáng ngồi */}
      {!seated ? (
        <>
          <mesh material={robe} position-y={0.6} castShadow><cylinderGeometry args={[0.42 * w, 0.66 * w, 1.2, 20]} /></mesh>
          <mesh material={trim} position={[0, 0.6, 0.5 * w]} rotation-x={-0.2}><boxGeometry args={[0.22, 1.18, 0.02]} /></mesh>
          <mesh material={trim} position-y={0.04}><torusGeometry args={[0.65 * w, 0.03, 6, 28]} /></mesh>
        </>
      ) : (
        <>
          <mesh material={robe} position={[0, 0.5, 0.3]} castShadow><boxGeometry args={[0.95, 0.32, 0.85]} /></mesh>
          <mesh material={robe} position={[0, 0.22, 0.7]}><boxGeometry args={[0.95, 0.5, 0.12]} /></mesh>
          <mesh material={trim} position={[0, 0.22, 0.77]}><boxGeometry args={[0.3, 0.48, 0.02]} /></mesh>
        </>
      )}
      {/* thân, vai, đai ngọc */}
      <mesh material={robe} position-y={1.55 + up} castShadow><cylinderGeometry args={[0.36 * w, 0.42 * w, 0.72, 20]} /></mesh>
      <mesh material={robe} position-y={1.86 + up} scale={[0.6 * w, 0.24, 0.38]}><sphereGeometry args={[1, 20, 12]} /></mesh>
      <mesh material={trim} position-y={1.25 + up}><torusGeometry args={[0.42 * w, 0.05, 8, 28]} /></mesh>
      <mesh material={trim} position={[0, 1.78 + up, 0.22]} rotation-x={0.5}><torusGeometry args={[0.2, 0.035, 6, 20, Math.PI]} /></mesh>
      {/* tay áo rộng chắp trước ngực */}
      {[-1, 1].map((sx) => (
        <group key={sx} position={[sx * 0.46 * w, 1.82 + up, 0]} rotation={[-0.95, 0, sx * 0.35]}>
          <mesh material={robe} position-y={-0.38} castShadow><cylinderGeometry args={[0.13, 0.27, 0.78, 14, 1, true]} /></mesh>
          <mesh material={trim} position-y={-0.77}><torusGeometry args={[0.26, 0.03, 6, 20]} /></mesh>
          <mesh material={skinMat} position-y={-0.8}><sphereGeometry args={[0.085, 10, 8]} /></mesh>
        </group>
      ))}
      {/* đồ cầm tay */}
      <group position={[0, 1.42 + up, 0.62]}>
        {hold === 'hot' && <mesh material={M.ivory} position-y={0.22} rotation-x={-0.2}><boxGeometry args={[0.1, 0.62, 0.03]} /></mesh>}
        {hold === 'brush' && (
          <>
            <mesh material={M.darkWood} position={[0.12, 0.2, 0]} rotation-z={-0.4}><cylinderGeometry args={[0.018, 0.018, 0.5, 6]} /></mesh>
            <mesh material={M.black} position={[0.22, 0.42, 0]} rotation-z={-0.4}><coneGeometry args={[0.03, 0.1, 6]} /></mesh>
            <mesh material={M.paper} position={[-0.12, 0.02, 0.02]} rotation-x={-0.6}><boxGeometry args={[0.32, 0.03, 0.42]} /></mesh>
          </>
        )}
        {hold === 'chain' &&
          Array.from({ length: 7 }, (_, i) => (
            <mesh key={i} material={M.iron} position={[0.05 * Math.sin(i), -i * 0.11, 0]} rotation-y={i % 2 ? Math.PI / 2 : 0}>
              <torusGeometry args={[0.05, 0.014, 6, 12]} />
            </mesh>
          ))}
        {hold === 'staff' && (
          <>
            <mesh material={M.white} position-y={0.1}><cylinderGeometry args={[0.025, 0.025, 1.7, 6]} /></mesh>
            {Array.from({ length: 5 }, (_, i) => (
              <mesh key={i} material={M.white} position={[0, 0.85 - i * 0.07, 0.05]} rotation-z={(i - 2) * 0.3}>
                <boxGeometry args={[0.015, 0.4, 0.04]} />
              </mesh>
            ))}
          </>
        )}
      </group>
      {/* cổ & đầu */}
      <mesh material={skinMat} position-y={2.02 + up}><cylinderGeometry args={[0.1, 0.12, 0.16, 12]} /></mesh>
      <group position-y={2.28 + up}>
        <mesh material={skinMat} scale={[0.95, 1.08, 0.95]}><sphereGeometry args={[0.27, 24, 18]} /></mesh>
        {[-1, 1].map((sx) => (
          <group key={sx}>
            <mesh material={skinMat} position={[sx * 0.27, 0, 0]} scale={[0.4, 1, 0.7]}><sphereGeometry args={[0.07, 8, 6]} /></mesh>
            <mesh material={M.white} position={[sx * 0.1, 0.03, 0.235]} scale={[1.3, fierce ? 0.85 : 0.7, 0.5]}><sphereGeometry args={[0.042, 10, 8]} /></mesh>
            <mesh material={M.pupil} position={[sx * 0.1, 0.03, 0.258]}><sphereGeometry args={[0.022, 8, 6]} /></mesh>
            <mesh material={M.black} position={[sx * 0.11, 0.11, 0.24]} rotation-z={sx * (fierce ? -0.45 : -0.1)}><boxGeometry args={[0.13, fierce ? 0.04 : 0.025, 0.02]} /></mesh>
          </group>
        ))}
        <mesh material={skinMat} position={[0, -0.03, 0.27]} rotation-x={Math.PI / 2}><coneGeometry args={[0.035, 0.09, 8]} /></mesh>
        {beard !== 'none' && (
          <>
            {[-1, 1].map((sx) => (
              <mesh key={sx} material={M.black} position={[sx * 0.07, -0.1, 0.25]} rotation-z={sx * 1.1}><boxGeometry args={[0.12, 0.022, 0.02]} /></mesh>
            ))}
            <mesh material={M.black} position={[0, beard === 'long' ? -0.5 : -0.32, 0.2]} rotation-x={Math.PI}>
              <coneGeometry args={[beard === 'long' ? 0.16 : 0.1, beard === 'long' ? 0.72 : 0.36, 10]} />
            </mesh>
            {beard === 'long' &&
              [-1, 1].map((sx) => (
                <mesh key={sx} material={M.black} position={[sx * 0.19, -0.36, 0.13]} rotation={[Math.PI, 0, sx * 0.15]}>
                  <coneGeometry args={[0.07, 0.5, 8]} />
                </mesh>
              ))}
          </>
        )}
        {tongue && <mesh material={M.tongue} position={[0, -0.42, 0.27]} rotation-x={0.12}><boxGeometry args={[0.1, 0.62, 0.035]} /></mesh>}
        {/* mũ */}
        {hat === 'mian' && (
          <group position-y={0.26}>
            <mesh material={M.gold}><cylinderGeometry args={[0.22, 0.25, 0.26, 20]} /></mesh>
            <mesh material={M.black} position-y={0.16} rotation-x={0.08}><boxGeometry args={[0.8, 0.045, 0.5]} /></mesh>
            <mesh material={M.gold} position-y={0.135} rotation-x={0.08}><boxGeometry args={[0.82, 0.015, 0.52]} /></mesh>
            <mesh material={M.gold} position-y={0.02} rotation-z={Math.PI / 2}><cylinderGeometry args={[0.015, 0.015, 0.7, 6]} /></mesh>
            <group position-y={0.14}><Beads /></group>
          </group>
        )}
        {hat === 'wusha' && (
          <group position-y={0.14}>
            <mesh material={M.black} scale={[1, 0.75, 1]}><sphereGeometry args={[0.29, 18, 12, 0, Math.PI * 2, 0, Math.PI / 2]} /></mesh>
            <mesh material={M.black} position={[0, 0.16, -0.12]}><boxGeometry args={[0.36, 0.26, 0.2]} /></mesh>
            {[-1, 1].map((sx) => (
              <mesh key={sx} material={M.black} position={[sx * 0.38, 0.14, -0.16]}><boxGeometry args={[0.46, 0.11, 0.015]} /></mesh>
            ))}
          </group>
        )}
        {hat === 'tall' && (
          <group position-y={0.72}>
            <mesh material={hatMat}><cylinderGeometry args={[0.17, 0.3, 1.15, 4]} /></mesh>
            {hatTex && (
              <mesh position={[0, 0, 0.22]} rotation-x={-0.11}>
                <planeGeometry args={[0.22, 0.95]} />
                <meshBasicMaterial map={hatTex} transparent toneMapped={false} />
              </mesh>
            )}
          </group>
        )}
      </group>
    </group>
  );
}

/* ================= Kiến trúc điện ================= */
const dragonGeo = (() => {
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= 80; i++) {
    const t = i / 80, a = t * Math.PI * 5;
    pts.push(new THREE.Vector3(Math.cos(a) * 0.62, 1.4 + t * 6.8, Math.sin(a) * 0.62));
  }
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 200, 0.11, 8);
})();

function Pillar({ x, z, couplet }: { x: number; z: number; couplet?: string }) {
  const tex = useMemo(() => (couplet ? textTexture(couplet.split(''), { w: 160, h: 1280, size: 108, serif: true, color: '#ffd27a', bg: '#3a0505', glow: '#000' }) : null), [couplet]);
  return (
    <group position={[x, 0, z]}>
      <mesh material={M.stone} position-y={0.3}><cylinderGeometry args={[0.78, 0.86, 0.6, 16]} /></mesh>
      <mesh material={M.lacquer} position-y={5.3} castShadow><cylinderGeometry args={[0.5, 0.52, 9.8, 18]} /></mesh>
      <mesh material={M.gold} geometry={dragonGeo} />
      <mesh material={M.gold} position={[0.62, 8.3, 0]}><sphereGeometry args={[0.2, 10, 8]} /></mesh>
      <mesh material={M.gold} position-y={10.1}><boxGeometry args={[1.3, 0.35, 1.3]} /></mesh>
      {tex && (
        <mesh position={[x > 0 ? -0.53 : 0.53, 5.2, 0]} rotation-y={x > 0 ? -Math.PI / 2 : Math.PI / 2}>
          <planeGeometry args={[0.5, 4]} />
          <meshBasicMaterial map={tex} toneMapped={false} />
        </mesh>
      )}
    </group>
  );
}

function Lantern({ x, y, z }: { x: number; y: number; z: number }) {
  const ref = useRef<THREE.Group>(null);
  const ph = useMemo(() => Math.random() * 6, []);
  useFrame(({ clock }) => ref.current && (ref.current.rotation.z = Math.sin(clock.elapsedTime * 0.8 + ph) * 0.05));
  return (
    <group ref={ref} position={[x, y, z]}>
      <mesh material={M.black} position-y={0.9}><cylinderGeometry args={[0.012, 0.012, 1.8, 4]} /></mesh>
      <mesh material={M.lantern} scale={[1, 0.85, 1]}><sphereGeometry args={[0.45, 16, 12]} /></mesh>
      {[0.36, -0.36].map((yy) => <mesh key={yy} material={M.gold} position-y={yy}><cylinderGeometry args={[0.22, 0.22, 0.08, 12]} /></mesh>)}
      <mesh material={M.lantern} position-y={-0.7}><cylinderGeometry args={[0.02, 0.06, 0.5, 6]} /></mesh>
    </group>
  );
}

/** Lư hương đồng ba chân, khói hương bốc lên. */
function Censer({ x, z }: { x: number; z: number }) {
  const pts = useRef<THREE.Points>(null);
  const N = 70;
  const data = useMemo(() => {
    const pos = new Float32Array(N * 3);
    const life = new Float32Array(N).map(() => Math.random());
    return { pos, life };
  }, []);
  useFrame((_, dt) => {
    const p = pts.current;
    if (!p) return;
    for (let i = 0; i < N; i++) {
      data.life[i] += dt * 0.25;
      if (data.life[i] > 1) data.life[i] = 0;
      const t = data.life[i];
      data.pos[i * 3] = Math.sin(t * 9 + i) * 0.25 * t * 3;
      data.pos[i * 3 + 1] = 1.6 + t * 5;
      data.pos[i * 3 + 2] = Math.cos(t * 7 + i) * 0.2 * t * 3;
    }
    p.geometry.attributes.position.needsUpdate = true;
  });
  return (
    <group position={[x, 0, z]}>
      <mesh material={M.stone} position-y={0.25}><cylinderGeometry args={[0.9, 1, 0.5, 8]} /></mesh>
      {[0, 1, 2].map((i) => (
        <mesh key={i} material={M.bronze} position={[Math.cos((i / 3) * Math.PI * 2) * 0.45, 0.75, Math.sin((i / 3) * Math.PI * 2) * 0.45]}>
          <cylinderGeometry args={[0.07, 0.05, 0.5, 6]} />
        </mesh>
      ))}
      <mesh material={M.bronze} position-y={1.25}><sphereGeometry args={[0.62, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.62]} /></mesh>
      <mesh material={M.bronze} position-y={1.32}><torusGeometry args={[0.6, 0.05, 6, 24]} /></mesh>
      {[-1, 1].map((sx) => <mesh key={sx} material={M.bronze} position={[sx * 0.62, 1.55, 0]} rotation-y={Math.PI / 2}><torusGeometry args={[0.14, 0.035, 6, 12]} /></mesh>)}
      {[-0.12, 0, 0.12].map((dx) => <mesh key={dx} position={[dx, 1.6, 0]}><cylinderGeometry args={[0.01, 0.01, 0.5, 4]} /><meshBasicMaterial color={new THREE.Color(3, 0.8, 0.2)} toneMapped={false} /></mesh>)}
      <points ref={pts}>
        <bufferGeometry><bufferAttribute attach="attributes-position" args={[data.pos, 3]} /></bufferGeometry>
        <pointsMaterial map={dotTexture()} size={0.9} color="#a89c90" transparent opacity={0.22} depthWrite={false} />
      </points>
      <pointLight color="#ff7a30" intensity={6} distance={6} position-y={2} />
    </group>
  );
}

function GhostFires() {
  const ref = useRef<THREE.Group>(null);
  const seeds = useMemo(() => Array.from({ length: 10 }, (_, i) => ({ x: (i % 2 ? 1 : -1) * (7.5 + (i % 3)), z: -8 + i * 1.7, ph: i * 1.3 })), []);
  useFrame(({ clock }) => {
    ref.current?.children.forEach((c, i) => {
      const s = seeds[i];
      c.position.set(s.x + Math.sin(clock.elapsedTime * 0.5 + s.ph) * 0.6, 2.5 + Math.sin(clock.elapsedTime * 1.3 + s.ph) * 0.6, s.z);
      c.scale.setScalar(0.8 + Math.sin(clock.elapsedTime * 4 + s.ph) * 0.2);
    });
  });
  return (
    <group ref={ref}>
      {seeds.map((_, i) => <mesh key={i} material={M.ghostFire}><sphereGeometry args={[0.12, 8, 6]} /></mesh>)}
    </group>
  );
}

function Mist() {
  const ref = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    ref.current?.children.forEach((c, i) => (c.position.x = Math.sin(clock.elapsedTime * 0.07 + i * 2) * 6));
  });
  return (
    <group ref={ref}>
      {[-6, -1, 4, 8].map((z, i) => (
        <mesh key={i} rotation-x={-Math.PI / 2} position={[0, 0.35 + i * 0.05, z]}>
          <planeGeometry args={[22, 9]} />
          <meshBasicMaterial map={dotTexture()} color="#8a7a90" transparent opacity={0.13} depthWrite={false} />
        </mesh>
      ))}
    </group>
  );
}

function Desk() {
  const cloth = useMemo(() => brocade('#8a1010', '#e0a040'), []);
  const clothMat = useMemo(() => new THREE.MeshStandardMaterial({ map: cloth, roughness: 0.8 }), [cloth]);
  return (
    <group position={[0, 0.9, -6.5]}>
      <mesh material={M.lacquer} position-y={0.65} castShadow><boxGeometry args={[4.6, 0.12, 1.3]} /></mesh>
      <mesh material={M.gold} position-y={0.72}><boxGeometry args={[4.7, 0.03, 1.36]} /></mesh>
      <mesh material={clothMat} position={[0, 0.3, 0.62]}><boxGeometry args={[4.4, 0.62, 0.04]} /></mesh>
      {[-2.1, 2.1].map((x) => <mesh key={x} material={M.darkWood} position={[x, 0.3, 0]}><boxGeometry args={[0.2, 0.6, 1.2]} /></mesh>)}
      {/* Sổ Sinh Tử mở */}
      <group position={[0.6, 0.74, 0.1]}>
        {[-1, 1].map((s) => <mesh key={s} material={M.paper} position={[s * 0.3, 0.01, 0]} rotation-z={s * -0.08}><boxGeometry args={[0.58, 0.03, 0.75]} /></mesh>)}
        <mesh material={M.black} position-y={0.03}><boxGeometry args={[0.03, 0.02, 0.75]} /></mesh>
      </group>
      {/* ống thẻ lệnh, ấn, nghiên mực */}
      <group position={[-1.6, 0.74, 0]}>
        <mesh material={M.darkWood} position-y={0.25}><cylinderGeometry args={[0.16, 0.16, 0.5, 12]} /></mesh>
        {[-0.06, 0, 0.06].map((dx, i) => <mesh key={i} material={i === 1 ? M.lacquer : M.ivory} position={[dx, 0.7, 0]} rotation-z={dx * 2}><boxGeometry args={[0.05, 0.55, 0.015]} /></mesh>)}
      </group>
      <mesh material={M.gold} position={[-0.8, 0.86, 0.1]}><boxGeometry args={[0.2, 0.2, 0.2]} /></mesh>
      <mesh material={M.black} position={[1.6, 0.78, 0.15]}><boxGeometry args={[0.35, 0.06, 0.25]} /></mesh>
      {[-2.05, 2.05].map((x) => (
        <group key={x} position={[x, 0.74, -0.3]}>
          <mesh material={M.bronze} position-y={0.12}><cylinderGeometry args={[0.08, 0.12, 0.25, 8]} /></mesh>
          <mesh material={M.ivory} position-y={0.42}><cylinderGeometry args={[0.045, 0.045, 0.36, 8]} /></mesh>
          <mesh position-y={0.68}><coneGeometry args={[0.05, 0.16, 8]} /><meshBasicMaterial color={new THREE.Color(4, 1.6, 0.3)} toneMapped={false} /></mesh>
          <pointLight color="#ffb050" intensity={3} distance={4} position-y={0.75} />
        </group>
      ))}
    </group>
  );
}

function Throne() {
  return (
    <group position={[0, 0.9, -8.4]}>
      <mesh material={M.lacquer} position-y={0.45}><boxGeometry args={[1.8, 0.9, 1.2]} /></mesh>
      <mesh material={M.lacquer} position={[0, 1.7, -0.55]}><boxGeometry args={[2.2, 2.6, 0.2]} /></mesh>
      <mesh material={M.gold} position={[0, 1.8, -0.44]}><torusGeometry args={[0.55, 0.06, 8, 32]} /></mesh>
      <mesh material={M.gold} position={[0, 1.8, -0.44]}><sphereGeometry args={[0.16, 12, 10]} /></mesh>
      <mesh material={M.gold} position={[0, 3.05, -0.55]}><boxGeometry args={[2.4, 0.16, 0.3]} /></mesh>
      {[-1, 1].map((sx) => (
        <group key={sx}>
          <mesh material={M.lacquer} position={[sx * 0.95, 0.95, 0]}><boxGeometry args={[0.18, 0.5, 1.1]} /></mesh>
          <mesh material={M.gold} position={[sx * 0.95, 1.22, 0.5]}><sphereGeometry args={[0.13, 10, 8]} /></mesh>
          <mesh material={M.gold} position={[sx * 1.2, 3.1, -0.55]} rotation-z={sx * -0.6}><coneGeometry args={[0.1, 0.4, 6]} /></mesh>
        </group>
      ))}
    </group>
  );
}

export function SamLaHall() {
  const fTex = useMemo(floorTex, []);
  const sTex = useMemo(screenTex, []);
  const plaque = useMemo(() => textTexture(['森羅殿'], { w: 1024, h: 320, size: 230, serif: true, color: '#ffd27a', bg: '#0e0606', glow: '#ff7a00' }), []);
  const carpet = useMemo(() => brocade('#5a0808', '#a06020'), []);
  return (
    <>
      <mesh rotation-x={-Math.PI / 2} receiveShadow><planeGeometry args={[44, 44]} /><meshStandardMaterial map={fTex} roughness={0.85} /></mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.015, 1]}><planeGeometry args={[2.8, 14]} /><meshStandardMaterial map={carpet} roughness={0.9} /></mesh>
      {/* bệ ba bậc */}
      {[0, 1, 2].map((i) => (
        <group key={i}>
          <mesh material={M.stone} position={[0, 0.15 + i * 0.3, -6.8 - i * 0.5]} receiveShadow><boxGeometry args={[13 - i * 1.4, 0.3, 7 - i]} /></mesh>
          <mesh material={M.gold} position={[0, 0.3 + i * 0.3, -3.3 - i * 0.5 - i * 0.5 + i * 0.5]}><boxGeometry args={[13 - i * 1.4, 0.03, 0.04]} /></mesh>
        </group>
      ))}
      <Throne />
      <Desk />
      {/* bình phong + biển "Sâm La Điện" */}
      <mesh material={M.darkWood} position={[0, 3.6, -10.6]}><boxGeometry args={[10.4, 5.6, 0.3]} /></mesh>
      <mesh position={[0, 3.7, -10.43]}><planeGeometry args={[10, 5]} /><meshStandardMaterial map={sTex} roughness={0.7} emissive="#ffffff" emissiveMap={sTex} emissiveIntensity={0.18} /></mesh>
      <mesh material={M.gold} position={[0, 7.75, -10.3]}><boxGeometry args={[5.4, 1.8, 0.2]} /></mesh>
      <mesh position={[0, 7.75, -10.18]}><planeGeometry args={[5.1, 1.6]} /><meshBasicMaterial map={plaque} toneMapped={false} /></mesh>
      {/* hàng cột rồng & câu đối dân gian */}
      {[-6.5, 6.5].map((x) =>
        [-9, -4.2, 0.6, 5.4].map((z, i) => (
          <Pillar key={`${x}${z}`} x={x} z={z} couplet={i === 1 ? (x < 0 ? '陽世奸雄違天害理皆由己' : '陰司報應古往今來放過誰') : undefined} />
        )),
      )}
      {/* xà ngang sơn màu */}
      {[-9, -4.2, 0.6, 5.4].map((z) => (
        <group key={z} position={[0, 10.3, z]}>
          <mesh material={M.beam}><boxGeometry args={[14, 0.6, 0.6]} /></mesh>
          <mesh material={M.gold} position-y={-0.31}><boxGeometry args={[14, 0.05, 0.62]} /></mesh>
          <mesh material={M.lacquer} position-y={0.36}><boxGeometry args={[14, 0.12, 0.64]} /></mesh>
        </group>
      ))}
      {[-6.5, 6.5].map((x) => <mesh key={x} material={M.beam} position={[x, 10.6, -1.8]}><boxGeometry args={[0.55, 0.5, 15]} /></mesh>)}
      {[[-3.4, -3], [3.4, -3], [-3.4, 3], [3.4, 3], [0, -1]].map(([x, z], i) => <Lantern key={i} x={x} y={7.6} z={z} />)}
      <Censer x={-3.4} z={-2.6} />
      <Censer x={3.4} z={-2.6} />
      {/* Gương Nghiệt bên cạnh bệ */}
      <group position={[5.2, 0.9, -7]} rotation-y={-0.6}>
        <mesh material={M.darkWood} position-y={1}><boxGeometry args={[0.3, 2, 0.3]} /></mesh>
        <mesh material={M.gold} position-y={2.9}><torusGeometry args={[1.05, 0.12, 10, 40]} /></mesh>
        <mesh position-y={2.9}><circleGeometry args={[1, 40]} /><meshStandardMaterial color="#1a3a5a" emissive="#3a7aaa" emissiveIntensity={0.8} metalness={0.9} roughness={0.1} /></mesh>
      </group>
      <GhostFires />
      <Mist />
      <pointLight color="#ff5a20" intensity={40} distance={22} position={[0, 6, -5]} />
      <pointLight color="#ffb070" intensity={5} distance={8} position={[0, 4, -5.2]} />
      <pointLight color="#3a8aff" intensity={14} distance={12} position={[5, 3.5, -6]} />
      <pointLight color="#3a6aff" intensity={8} distance={14} position={[-6, 3, 3]} />
    </>
  );
}

/* ================= Các nhân vật đặt vào điện ================= */
export function Court() {
  const yanRobe = useMemo(() => new THREE.MeshStandardMaterial({ map: brocade('#7a0c0a', '#e8b040'), roughness: 0.55 }), []);
  const judgeRobe = useMemo(() => new THREE.MeshStandardMaterial({ map: brocade('#1d4636', '#7ab08a'), roughness: 0.6 }), []);
  const blackRobe = useMemo(() => new THREE.MeshStandardMaterial({ color: '#141416', roughness: 0.7 }), []);
  const whiteRobe = useMemo(() => new THREE.MeshStandardMaterial({ color: '#e6e4de', roughness: 0.7 }), []);
  const grey = useMemo(() => new THREE.MeshStandardMaterial({ color: '#5a5a60', roughness: 0.6 }), []);
  const yan = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (yan.current) yan.current.rotation.y = Math.sin(clock.elapsedTime * 0.3) * 0.06; // Diêm Vương khẽ quay đầu nhìn
  });
  return (
    <>
      {/* Diêm La Vương ngồi ngai */}
      <group ref={yan} position={[0, 1.35, -8.25]} scale={1.6}>
        <Official robe={yanRobe} trim={M.gold} skin="#8a3a22" hat="mian" beard="long" brows="fierce" seated hold="hot" />
      </group>
      {/* Phán Quan đứng cạnh án */}
      <group position={[-3.3, 0.9, -6.6]} rotation-y={0.45} scale={1.05}>
        <Official robe={judgeRobe} trim={M.gold} skin="#c08060" hat="wusha" beard="short" brows="fierce" hold="brush" />
      </group>
      {/* Ngưu Đầu, Mã Diện hầu hai bên */}
      <group position={[-5.2, 0.9, -5.4]} rotation-y={0.7} scale={0.85}><GuardModel kind="bull" /></group>
      <group position={[5.2, 0.9, -5.4]} rotation-y={-0.7} scale={0.85}><GuardModel kind="horse" /></group>
      {/* Hắc Bạch Vô Thường áp giải */}
      <group position={[-2.1, 0, 1.6]} rotation-y={0.55} scale={[1, 1.12, 1]}>
        <Official robe={blackRobe} trim={grey} skin="#2e2a2a" hat="tall" hatColor="#111" hatText="天下太平" brows="fierce" hold="chain" slim />
      </group>
      <group position={[2.1, 0, 1.6]} rotation-y={-0.55} scale={[1, 1.12, 1]}>
        <Official robe={whiteRobe} trim={grey} skin="#f2efe8" hat="tall" hatColor="#eeeeea" hatText="一見生財" tongue hold="staff" slim />
      </group>
    </>
  );
}
