// Bản đồ riêng cho từng tầng trong 18 tầng địa ngục. Vật thể động đọc từ `objects` (Colyseus).
import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { CuboidCollider, CylinderCollider, RigidBody, type RapierRigidBody } from '@react-three/rapier';
import * as THREE from 'three';
import {
  ARENA_Z, BLADE_STEPS, PATROL_HIT_R, BRIDGE_PLANKS, HAZARD_W, IRON_TREES, PLATE_R, POND, SAW_HANDLE, floorDef,
} from '../../../shared/game.ts';
import { objects, players } from '../net.ts';
import { useGame } from '../store.ts';
import { fx, onBurst } from '../fx.ts';
import { Ghost } from './Ghost.tsx';
import { Burner, Flame, GuardModel, Torch, FloatingLanterns, Ground, Mill, bronze, darkStone, stone, wood, type Look } from './World.tsx';
import { textTexture } from './textures.ts';

type SceneProps = { level: number; look: Look };
const glow = (r: number, g: number, b: number) => new THREE.MeshBasicMaterial({ color: new THREE.Color(r, g, b), toneMapped: false });
const steel = new THREE.MeshStandardMaterial({ color: '#c8d0d8', metalness: 0.95, roughness: 0.2 });
// gai kẹo (núi đao thành núi kẹo nhọn — chạm vẫn bị trừ điểm nhưng trông như đồ chơi)
const candySpikes = ['#ff7ac0', '#7ad0ff', '#ffd04a', '#8aff7a'].map((color) => new THREE.MeshStandardMaterial({ color, roughness: 0.3 }));
const iron = new THREE.MeshStandardMaterial({ color: '#8a90a8', metalness: 0.5, roughness: 0.4 });
const copperHot = new THREE.MeshStandardMaterial({ color: '#b0602a', metalness: 0.7, roughness: 0.35, emissive: '#ff3a00' });
const ice = new THREE.MeshStandardMaterial({ color: '#bfefff', roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.75, emissive: '#2a8aff', emissiveIntensity: 0.35 });
const paper = new THREE.MeshStandardMaterial({ color: '#c8a050', roughness: 0.9 });
const warnMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.5, 0.1, 0.1), toneMapped: false, transparent: true, opacity: 0.4, depthWrite: false });
const fireMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 1.4, 0.2), toneMapped: false, transparent: true, opacity: 0.9 });
const bladeGeo = new THREE.ConeGeometry(0.12, 1.4, 4);
const TOMB_COLORS = ['#ff4a4a', '#4aa0ff', '#ffd04a', '#4aff8a', '#c04aff', '#ff8a2a'];

/** Danh sách id vật thể theo loại (chỉ render lại khi thêm/bớt vật thể). */
function useObjIds(kind: string) {
  const ids = useGame((s) => s.objIds);
  return ids.filter((id) => objects.get(id)?.kind === kind);
}

function Label({ position, children }: { position: [number, number, number]; children: React.ReactNode }) {
  return (
    <Html position={position} center pointerEvents="none" zIndexRange={[10, 0]}>
      <div className="spot-tag">{children}</div>
    </Html>
  );
}

function GroundRing({ x, z, r, color = [2.5, 1.5, 0.4] }: { x: number; z: number; r: number; color?: [number, number, number] }) {
  const m = useMemo(() => glow(...color), [color.join()]);
  return (
    <mesh rotation-x={-Math.PI / 2} position={[x, 0.06, z]} material={m}>
      <torusGeometry args={[r, 0.07, 6, 64]} />
    </mesh>
  );
}

/* ================= Vật phẩm mang theo (collect) ================= */
function ItemModel({ level, hp }: { level: number; hp: number }) {
  const tex = useMemo(() => (level === 1 ? textTexture(['妄'], { w: 256, h: 384, color: '#2a0000', bg: '#e8c040', size: 220, glow: '#000' }) : null), [level]);
  switch (level) {
    case 1:
      return (
        <mesh>
          <planeGeometry args={[0.9, 1.35]} />
          <meshStandardMaterial map={tex!} emissive="#ff4a10" emissiveIntensity={0.5} side={THREE.DoubleSide} />
        </mesh>
      );
    case 6:
      return (
        <group>
          <mesh material={wood}><cylinderGeometry args={[0.45, 0.38, 0.7, 14]} /></mesh>
          <mesh position-y={0.36} rotation-x={-Math.PI / 2} material={glow(0.3, 1, 2.5)}><circleGeometry args={[0.42, 14]} /></mesh>
        </group>
      );
    case 13:
      return <mesh material={wood} rotation-y={0.3}><boxGeometry args={[2.4, 0.15, 0.6]} /></mesh>;
    case 14:
      return (
        <group>
          <mesh scale={[1, 1.3, 1]} material={glow(3, 1.6, 0.6)}><sphereGeometry args={[0.32, 14, 10]} /></mesh>
          <mesh position-y={0.5} material={wood}><cylinderGeometry args={[0.03, 0.03, 0.4, 6]} /></mesh>
        </group>
      );
    default: {
      const c = TOMB_COLORS[hp % TOMB_COLORS.length];
      return (
        <mesh>
          <cylinderGeometry args={[0.25, 0.4, 0.8, 14]} />
          <meshStandardMaterial color={c} emissive={c} emissiveIntensity={0.8} roughness={0.3} />
        </mesh>
      );
    }
  }
}

function Item({ id, level }: { id: string; level: number }) {
  const ref = useRef<THREE.Group>(null);
  const ph = useMemo(() => Math.random() * 10, []);
  const hp = objects.get(id)?.hp ?? 0;
  useFrame(({ clock }, dt) => {
    const o = objects.get(id), g = ref.current;
    if (!o || !g) return;
    let tx = o.x, ty = o.y, tz = o.z;
    if (o.owner) {
      const p = players.get(o.owner);
      if (p) { tx = p.x; ty = p.y + 3.1; tz = p.z; }
    }
    if (!g.userData.init) { g.position.set(tx, ty, tz); g.userData.init = true; }
    const k = 1 - Math.exp(-12 * Math.min(dt, 0.05));
    g.position.x += (tx - g.position.x) * k;
    g.position.z += (tz - g.position.z) * k;
    g.position.y += (ty + Math.sin(clock.elapsedTime * 3 + ph) * 0.15 - g.position.y) * k;
    g.rotation.y = clock.elapsedTime * 0.8 + ph;
  });
  return (
    <group ref={ref}>
      <ItemModel level={level} hp={hp} />
    </group>
  );
}

function Items({ level }: { level: number }) {
  const ids = useObjIds('item');
  return <>{ids.map((id) => <Item key={id} id={id} level={level} />)}</>;
}

/* ================= Vùng nguy hiểm (hazard) ================= */
function BullModel() {
  return (
    <group>
      <mesh material={iron} position-y={1.3}><boxGeometry args={[1.4, 1.3, 2.6]} /></mesh>
      <mesh material={iron} position={[0, 1.6, 1.6]}><boxGeometry args={[0.9, 0.9, 0.9]} /></mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} material={paper} position={[s * 0.6, 2.1, 1.7]} rotation-z={-s * 1}><coneGeometry args={[0.12, 0.8, 8]} /></mesh>
      ))}
      {[-0.25, 0.25].map((x) => <mesh key={x} material={glow(4, 0.3, 0.1)} position={[x, 1.75, 2.06]}><sphereGeometry args={[0.08, 8, 6]} /></mesh>)}
      {[[-0.5, 0.9], [0.5, 0.9], [-0.5, -0.9], [0.5, -0.9]].map(([x, z], i) => (
        <mesh key={i} material={iron} position={[x, 0.35, z]}><boxGeometry args={[0.3, 0.7, 0.3]} /></mesh>
      ))}
    </group>
  );
}

function Zone({ id, level }: { id: string; level: number }) {
  const o = objects.get(id)!;
  const fxRef = useRef<THREE.Group>(null);
  const plane = useRef<THREE.Mesh>(null);
  const strikeT = useRef<number | null>(null);
  const shape = o.hp; // 0 dải ngang, 1 làn dọc, 2 vòng tròn
  const arenaD = ARENA_Z + 17, arenaCz = (ARENA_Z - 17) / 2;
  useFrame(({ clock }) => {
    const cur = objects.get(id);
    if (!cur || !plane.current) return;
    const t = clock.elapsedTime;
    warnMat.opacity = 0.25 + (Math.sin(t * 14) + 1) * 0.18;
    plane.current.visible = cur.s === 1;
    if (cur.s === 2 && strikeT.current === null) {
      strikeT.current = t;
      if (level === 16) setTimeout(() => onBurst(cur.x, 0.5, cur.z, 'gold'), 380);
    }
    const g = fxRef.current;
    if (!g) return;
    g.visible = strikeT.current !== null;
    if (strikeT.current === null) return;
    const k = Math.min(1, (t - strikeT.current) / 0.45);
    if (level === 2) {
      // hai lưỡi kéo khép lại
      g.children[0].position.z = (1 - k) * (HAZARD_W / 2 + 0.6);
      g.children[1].position.z = -(1 - k) * (HAZARD_W / 2 + 0.6);
    } else if (level === 10) {
      g.position.z = 14 - k * 32; // trâu lao từ nam lên bắc
    } else {
      g.position.y = 22 * (1 - k); // đá lửa rơi
      g.visible = k < 1;
    }
  });
  return (
    <group position={[shape === 0 ? 0 : o.x, 0, shape === 1 ? arenaCz : o.z]}>
      <mesh ref={plane} rotation-x={-Math.PI / 2} position-y={0.08} material={warnMat}>
        {shape === 2 ? <circleGeometry args={[o.y, 32]} /> : <planeGeometry args={shape === 0 ? [54, HAZARD_W] : [HAZARD_W, arenaD]} />}
      </mesh>
      <group ref={fxRef} visible={false} position-z={shape === 1 ? -arenaCz : 0}>
        {level === 2 && (
          <>
            <mesh material={steel} position-y={1.2} rotation-x={0.25}><boxGeometry args={[54, 0.12, 1.4]} /></mesh>
            <mesh material={steel} position-y={1.2} rotation-x={-0.25}><boxGeometry args={[54, 0.12, 1.4]} /></mesh>
          </>
        )}
        {level === 10 && <BullModel />}
        {level === 16 && (
          <mesh material={glow(4, 1.2, 0.2)}><dodecahedronGeometry args={[Math.min(1.6, o.y * 0.5), 0]} /></mesh>
        )}
      </group>
    </group>
  );
}

function Zones({ level }: { level: number }) {
  const ids = useObjIds('zone');
  return <>{ids.map((id) => <Zone key={id} id={id} level={level} />)}</>;
}

function SafeZoneMark() {
  return <Label position={[0, 3.5, ARENA_Z + 1]}>⛓️ Nơi quỷ sai áp giải hồn xuống tầng</Label>;
}

/* ================= Tầng 1 — Rút Lưỡi ================= */
function Stocks({ x, z, r }: { x: number; z: number; r: number }) {
  return (
    <group position={[x, 0, z]} rotation-y={r}>
      <RigidBody type="fixed" colliders={false}><CuboidCollider args={[1.3, 1, 0.3]} position-y={1} /></RigidBody>
      {[-1.1, 1.1].map((px) => <mesh key={px} material={wood} position={[px, 1, 0]} castShadow><boxGeometry args={[0.3, 2, 0.3]} /></mesh>)}
      <mesh material={wood} position-y={1.6}><boxGeometry args={[2.6, 0.35, 0.35]} /></mesh>
      <group position={[0, 2.3, 0]}>
        <mesh material={iron} rotation-z={0.3}><boxGeometry args={[0.1, 1.1, 0.1]} /></mesh>
        <mesh material={iron} rotation-z={-0.3}><boxGeometry args={[0.1, 1.1, 0.1]} /></mesh>
      </group>
    </group>
  );
}

/** Phán Quan ngồi bàn án, cầm Sổ Sinh Tử */
function Judge() {
  return (
    <group position={[0, 0, -9]}>
      <RigidBody type="fixed" colliders={false}><CuboidCollider args={[3.2, 0.8, 1]} position-y={0.8} /></RigidBody>
      <mesh material={wood} position-y={0.8} castShadow><boxGeometry args={[6.4, 1.6, 2]} /></mesh>
      <mesh position={[0, 1.62, 0.2]} rotation-x={-Math.PI / 2}><planeGeometry args={[1.6, 1.1]} /><meshStandardMaterial color="#e8d8a8" /></mesh>
      <mesh position={[0, 0.9, 1.01]}><planeGeometry args={[5.6, 1]} /><meshBasicMaterial color={new THREE.Color(1.6, 0.25, 0.1)} toneMapped={false} /></mesh>
      <group position={[0, 1.1, -1.4]}>
        <Ghost hue={20} hat="crown" scale={1.5} />
      </group>
      <Torch x={-4.2} z={0} />
      <Torch x={4.2} z={0} />
    </group>
  );
}

function Floor1({ level, look }: SceneProps) {
  return (
    <>
      <Ground level={level} look={look} />
      <Judge />
      {[-12, -6, 0, 6].map((z, i) => (
        <group key={i}>
          <Stocks x={-22} z={z} r={Math.PI / 2} />
          <Stocks x={22} z={z} r={-Math.PI / 2} />
        </group>
      ))}
    </>
  );
}

/* ================= Tầng 2 — Cắt Kéo ================= */
function GiantScissors({ x, z, r }: { x: number; z: number; r: number }) {
  return (
    <group position={[x, 0, z]} rotation-y={r}>
      {[0.5, -0.5].map((a) => (
        <group key={a} rotation-z={a}>
          <mesh material={steel} position-y={6}><boxGeometry args={[0.25, 9, 1.1]} /></mesh>
          <mesh material={iron} position-y={0.8}><torusGeometry args={[0.9, 0.22, 8, 20]} /></mesh>
        </group>
      ))}
      <mesh material={bronze} position-y={2.5}><sphereGeometry args={[0.35, 12, 10]} /></mesh>
    </group>
  );
}

function Floor2({ level, look }: SceneProps) {
  return (
    <>
      <Ground level={level} look={look} />
      <GiantScissors x={-23.5} z={-6} r={Math.PI / 2} />
      <GiantScissors x={23.5} z={-6} r={-Math.PI / 2} />
      <GiantScissors x={-23.5} z={6} r={Math.PI / 2} />
      <GiantScissors x={23.5} z={6} r={-Math.PI / 2} />
      <SafeZoneMark />
      <Zones level={2} />
    </>
  );
}

/* ================= Tầng 3 — Cây Sắt ================= */
function IronTree({ x, z, seed }: { x: number; z: number; seed: number }) {
  const branches = useMemo(() => Array.from({ length: 7 }, (_, i) => ({ y: 1 + i * 0.55, a: seed + i * 2.1, tilt: 0.9 + (i % 3) * 0.2 })), [seed]);
  return (
    <group position={[x, 0, z]}>
      <mesh material={iron} position-y={2.4} castShadow><cylinderGeometry args={[0.22, 0.38, 4.8, 8]} /></mesh>
      {branches.map((b, i) => (
        <group key={i} position-y={b.y} rotation-y={b.a}>
          <mesh geometry={bladeGeo} material={steel} position-x={0.6} rotation-z={-b.tilt} />
        </group>
      ))}
    </group>
  );
}

function Bell({ x, z }: { x: number; z: number }) {
  const ref = useRef<THREE.Group>(null);
  useFrame(() => {
    const t = performance.now() / 1000 - fx.bellAt;
    if (ref.current) ref.current.rotation.z = t < 2 ? Math.sin(t * 10) * 0.25 * (1 - t / 2) : 0;
  });
  return (
    <group position={[x, 0, z]}>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[0.3, 3, 0.3]} position={[-2.2, 3, 0]} />
        <CuboidCollider args={[0.3, 3, 0.3]} position={[2.2, 3, 0]} />
      </RigidBody>
      {[-2.2, 2.2].map((px) => <mesh key={px} material={wood} position={[px, 3, 0]} castShadow><boxGeometry args={[0.5, 6, 0.5]} /></mesh>)}
      <mesh material={wood} position-y={6}><boxGeometry args={[5.4, 0.5, 0.6]} /></mesh>
      <group ref={ref} position-y={5.75}>
        <mesh material={bronze} position-y={-1.3} castShadow><cylinderGeometry args={[0.9, 1.25, 2.4, 24, 1, true]} /></mesh>
        <mesh material={bronze} position-y={-0.1}><sphereGeometry args={[0.9, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2]} /></mesh>
      </group>
    </group>
  );
}

function Floor3({ level, look }: SceneProps) {
  const g = floorDef(3).climb!.goal;
  return (
    <>
      <Ground level={level} look={look} />
      <RigidBody type="fixed" colliders={false}>
        {IRON_TREES.map((t, i) => <CylinderCollider key={i} args={[2.4, 0.35]} position={[t.x, 2.4, t.z]} />)}
      </RigidBody>
      {IRON_TREES.map((t, i) => <IronTree key={i} x={t.x} z={t.z} seed={i * 1.7} />)}
      <Bell x={g.x} z={g.z - 1.5} />
      <GroundRing x={g.x} z={g.z} r={g.r} />
    </>
  );
}

/* ================= Tầng 4 — Gương Nghiệt ================= */
function Mirror({ id }: { id: string }) {
  const o = objects.get(id)!;
  const face = useRef<THREE.MeshStandardMaterial>(null);
  const ringMat = useRef<THREE.MeshBasicMaterial>(null);
  const ang = Math.atan2(o.x, o.z + 2); // hướng ra ngoài từ tâm (0,-2)
  useFrame(({ clock }) => {
    const cur = objects.get(id);
    if (!cur || !face.current) return;
    const on = cur.s === 1;
    face.current.emissiveIntensity = THREE.MathUtils.lerp(face.current.emissiveIntensity, on ? 2.2 : 0.15 + Math.sin(clock.elapsedTime * 2) * 0.05, 0.1);
    ringMat.current?.color.setRGB(on ? 0.6 : 2.4, on ? 2.6 : 0.4, on ? 1.2 : 0.8);
  });
  return (
    <group>
      <group position={[o.x + Math.sin(ang) * 2, 0, o.z + Math.cos(ang) * 2]} rotation-y={ang + Math.PI}>
        <RigidBody type="fixed" colliders={false}><CuboidCollider args={[1.1, 1.8, 0.2]} position-y={1.8} /></RigidBody>
        <mesh material={bronze} position-y={2.2}><torusGeometry args={[1.1, 0.14, 10, 40]} /></mesh>
        <mesh position-y={2.2} position-z={0.02}>
          <circleGeometry args={[1.05, 40]} />
          <meshStandardMaterial ref={face} color="#c8c0e8" metalness={1} roughness={0.08} emissive="#e8e0ff" emissiveIntensity={0.15} />
        </mesh>
        <mesh material={bronze} position-y={0.55}><cylinderGeometry args={[0.15, 0.4, 1.1, 10]} /></mesh>
      </group>
      <mesh rotation-x={-Math.PI / 2} position={[o.x, 0.06, o.z]}>
        <torusGeometry args={[PLATE_R, 0.08, 6, 40]} />
        <meshBasicMaterial ref={ringMat} toneMapped={false} />
      </mesh>
    </group>
  );
}

function Floor4({ level, look }: SceneProps) {
  const ids = useObjIds('plate');
  return (
    <>
      <Ground level={level} look={look} />
      {ids.map((id) => <Mirror key={id} id={id} />)}
      <group position={[0, 0, -2]}>
        <mesh material={bronze} position-y={4.5}><torusGeometry args={[2.4, 0.3, 12, 48]} /></mesh>
        <mesh position-y={4.5}>
          <circleGeometry args={[2.3, 48]} />
          <meshStandardMaterial color="#a8a0d8" metalness={1} roughness={0.05} emissive="#8a6aff" emissiveIntensity={0.6} side={THREE.DoubleSide} />
        </mesh>
        <mesh material={darkStone} position-y={1.2}><cylinderGeometry args={[0.6, 1, 2.4, 12]} /></mesh>
        <RigidBody type="fixed" colliders={false}><CylinderCollider args={[1.2, 1]} position-y={1.2} /></RigidBody>
        <Label position={[0, 7.6, 0]}>孽鏡臺 Nghiệt Kính Đài</Label>
      </group>
    </>
  );
}

/* ================= Tầng 5 & 9 — trạm bùng lên (whack) ================= */
const bamboo = new THREE.MeshStandardMaterial({ color: '#c8a060', roughness: 0.8 });

function Steamer({ id }: { id: string }) {
  const o = objects.get(id)!;
  const lid = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    const cur = objects.get(id);
    if (!cur || !lid.current) return;
    const t = clock.elapsedTime;
    lid.current.position.y = 3.05 + (cur.s === 1 ? Math.abs(Math.sin(t * 25)) * 0.25 : 0);
    lid.current.rotation.z = cur.s === 1 ? Math.sin(t * 19) * 0.08 : 0;
  });
  return (
    <group position={[o.x, 0, o.z]}>
      <RigidBody type="fixed" colliders={false}><CylinderCollider args={[1.5, 1.5]} position-y={1.5} /></RigidBody>
      {[0.5, 1.4, 2.3].map((y) => (
        <group key={y}>
          <mesh material={bamboo} position-y={y} castShadow><cylinderGeometry args={[1.5, 1.5, 0.8, 24]} /></mesh>
          <mesh material={wood} position-y={y + 0.35} rotation-x={Math.PI / 2}><torusGeometry args={[1.5, 0.06, 6, 24]} /></mesh>
        </group>
      ))}
      <mesh ref={lid} material={bamboo} position-y={3.05}><coneGeometry args={[1.55, 0.6, 24]} /></mesh>
      <mesh material={iron} position={[1.6, 0.6, 0]} rotation-z={Math.PI / 2}><cylinderGeometry args={[0.18, 0.18, 0.6, 10]} /></mesh>
    </group>
  );
}

function Cauldron({ id }: { id: string }) {
  const o = objects.get(id)!;
  const flames = useRef<THREE.Group>(null);
  const oil = useRef<THREE.MeshBasicMaterial>(null);
  useFrame(({ clock }) => {
    const cur = objects.get(id);
    if (!cur) return;
    const t = clock.elapsedTime;
    if (flames.current) {
      flames.current.visible = cur.s === 1;
      const k = 0.5 + (cur.hp / 6) * 0.9;
      flames.current.scale.set(k, k * (1 + Math.sin(t * 15) * 0.2), k);
    }
    oil.current?.color.setRGB(cur.s === 1 ? 3.5 : 1.4, cur.s === 1 ? 2 : 0.9, 0.2 + Math.sin(t * 6) * 0.1);
  });
  return (
    <group position={[o.x, 0, o.z]}>
      <RigidBody type="fixed" colliders={false}><CylinderCollider args={[1.3, 2]} position-y={1.3} /></RigidBody>
      {[0, 1, 2].map((i) => (
        <mesh key={i} material={iron} position={[Math.cos((i / 3) * Math.PI * 2) * 1.4, 0.5, Math.sin((i / 3) * Math.PI * 2) * 1.4]}>
          <cylinderGeometry args={[0.15, 0.2, 1, 8]} />
        </mesh>
      ))}
      <mesh material={iron} position-y={2} castShadow><sphereGeometry args={[2, 28, 14, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2]} /></mesh>
      <mesh material={iron} position-y={2.02} rotation-x={Math.PI / 2}><torusGeometry args={[2, 0.15, 8, 40]} /></mesh>
      <mesh position-y={1.85} rotation-x={-Math.PI / 2}>
        <circleGeometry args={[1.9, 32]} />
        <meshBasicMaterial ref={oil} toneMapped={false} />
      </mesh>
      <group ref={flames} position-y={0.1}>
        {Array.from({ length: 6 }, (_, i) => (
          <mesh key={i} material={fireMat} position={[Math.cos(i) * 0.8, 0.4, Math.sin(i) * 0.8]}><coneGeometry args={[0.35, 1.2, 8]} /></mesh>
        ))}
      </group>
    </group>
  );
}

function Floor5({ level, look }: SceneProps) {
  const ids = useObjIds('station');
  return (
    <>
      <Ground level={level} look={look} />
      {ids.map((id) => <Steamer key={id} id={id} />)}
    </>
  );
}

function Floor9({ level, look }: SceneProps) {
  const ids = useObjIds('station');
  return (
    <>
      <Ground level={level} look={look} />
      {ids.map((id) => <Cauldron key={id} id={id} />)}
    </>
  );
}

/* ================= Tầng 6 — Cột Đồng ================= */
function CopperPillar({ x, z, heat }: { x: number; z: number; heat: number }) {
  const mat = useMemo(() => copperHot.clone(), []);
  useFrame(({ clock }) => {
    mat.emissiveIntensity = heat * (1.4 + Math.sin(clock.elapsedTime * 3 + x) * 0.3);
  });
  return (
    <group position={[x, 0, z]}>
      <RigidBody type="fixed" colliders={false}><CylinderCollider args={[4, 0.8]} position-y={4} /></RigidBody>
      <mesh material={mat} position-y={4} castShadow><cylinderGeometry args={[0.75, 0.85, 8, 20]} /></mesh>
      {[1.5, 4, 6.5].map((y) => <mesh key={y} material={iron} position-y={y} rotation-x={Math.PI / 2}><torusGeometry args={[0.85, 0.1, 8, 24]} /></mesh>)}
    </group>
  );
}

function Well({ x, z, label }: { x: number; z: number; label: string }) {
  return (
    <group position={[x, 0, z]}>
      <RigidBody type="fixed" colliders={false}><CylinderCollider args={[0.5, 1.2]} position-y={0.5} /></RigidBody>
      <mesh material={stone} position-y={0.5}><cylinderGeometry args={[1.2, 1.3, 1, 20, 1, true]} /></mesh>
      <mesh position-y={0.7} rotation-x={-Math.PI / 2} material={glow(0.2, 0.6, 1.8)}><circleGeometry args={[1.1, 20]} /></mesh>
      {[-1, 1].map((s) => <mesh key={s} material={wood} position={[s * 1.1, 1.6, 0]}><boxGeometry args={[0.15, 2.2, 0.15]} /></mesh>)}
      <mesh material={wood} position-y={2.7}><boxGeometry args={[2.6, 0.18, 0.18]} /></mesh>
      <Label position={[0, 3.6, 0]}>{label}</Label>
    </group>
  );
}

function Floor6({ level, look }: SceneProps) {
  const c = floorDef(6).collect!;
  const heat = 1; // cột đồng lúc nào cũng nung đỏ
  return (
    <>
      <Ground level={level} look={look} />
      <Well x={c.source!.x} z={c.source!.z} label="💧 Giếng — múc nước" />
      {c.targets.map((t, i) => (
        <group key={i}>
          <CopperPillar x={t.x} z={t.z} heat={heat} />
          <GroundRing x={t.x} z={t.z} r={t.r} color={[0.4, 1, 3]} />
        </group>
      ))}
      <Label position={[0, 9.5, -2.5]}>銅柱 Cột đồng nung đỏ</Label>
      <Items level={6} />
    </>
  );
}

/* ================= Tầng 7 — Núi Đao ================= */
function Floor7({ level, look }: SceneProps) {
  const spikes = useMemo(
    () =>
      Array.from({ length: 60 }, (_, i) => {
        const y = 0.5 + (i / 60) * 7.5, a = i * 2.4, r = 2.6 * (1 - y / 8.6) + 0.2;
        return { x: Math.cos(a) * r, y, z: -8 + Math.sin(a) * r, a };
      }),
    [],
  );
  const g = floorDef(7).climb!.goal;
  return (
    <>
      <Ground level={level} look={look} />
      <mesh material={darkStone} position={[0, 4.2, -8]} castShadow><coneGeometry args={[2.6, 8.4, 10]} /></mesh>
      {spikes.map((s, i) => (
        <mesh key={i} geometry={bladeGeo} material={candySpikes[i % 4]} position={[s.x, s.y, s.z]} rotation={[Math.sin(s.a) * 0.9, 0, -Math.cos(s.a) * 0.9]} scale={1.4} />
      ))}
      <RigidBody type="fixed" colliders={false}>
        {BLADE_STEPS.map((st, i) => <CuboidCollider key={i} args={[st.s / 2, 0.25, st.s / 2]} position={[st.x, st.y - 0.25, st.z]} />)}
      </RigidBody>
      {BLADE_STEPS.map((st, i) => (
        <group key={i} position={[st.x, st.y - 0.25, st.z]}>
          <mesh material={stone} castShadow receiveShadow><boxGeometry args={[st.s, 0.5, st.s]} /></mesh>
          {i < BLADE_STEPS.length - 1 &&
            [-1, 1].map((sx) => <mesh key={sx} geometry={bladeGeo} material={steel} position={[sx * (st.s / 2 - 0.15), 0.9, -st.s / 2 + 0.15]} />)}
        </group>
      ))}
      <group position={[g.x, g.y, g.z]}>
        <Flame position={[0, 0.6, 0]} scale={1.2} light={30} />
        <Label position={[0, 2.4, 0]}>⛰ Đỉnh Núi Đao</Label>
      </group>
    </>
  );
}

/* ================= Tầng 8 & 11 — cùng đẩy (push) ================= */
function PushBlock({ id, level }: { id: string; level: number }) {
  const rb = useRef<RapierRigidBody>(null);
  const mesh = useRef<THREE.Mesh>(null);
  const o = objects.get(id)!;
  const pos = useRef(new THREE.Vector3(o.x, 0, o.z));
  const size = level === 8 ? 1.6 : 2.2;
  useFrame((_, dt) => {
    const cur = objects.get(id);
    if (!cur) return;
    const k = 1 - Math.exp(-6 * Math.min(dt, 0.05));
    const ox = pos.current.x, oz = pos.current.z;
    pos.current.x += (cur.x - pos.current.x) * k;
    pos.current.z += (cur.z - pos.current.z) * k;
    rb.current?.setNextKinematicTranslation({ x: pos.current.x, y: size, z: pos.current.z });
    if (mesh.current && level === 11) {
      mesh.current.rotation.z -= (pos.current.x - ox) / 2.2;
      mesh.current.rotation.x += (pos.current.z - oz) / 2.2;
    }
  });
  return (
    <RigidBody ref={rb} type="kinematicPosition" colliders={false} position={[o.x, size, o.z]}>
      {level === 8 ? <CuboidCollider args={[1.6, 1.6, 1.6]} /> : <CylinderCollider args={[2, 2.1]} />}
      <mesh ref={mesh} material={level === 8 ? ice : stone} castShadow>
        {level === 8 ? <boxGeometry args={[3.2, 3.2, 3.2]} /> : <dodecahedronGeometry args={[2.3, 1]} />}
      </mesh>
    </RigidBody>
  );
}

function Floor8({ level, look }: SceneProps) {
  const ids = useObjIds('block');
  const to = floorDef(8).push!.to;
  const peaks = useMemo(() => Array.from({ length: 14 }, (_, i) => ({ x: (i % 2 ? 1 : -1) * (13 + ((i * 7) % 10)), z: -14 + i * 2.3, h: 4 + ((i * 13) % 6) })), []);
  return (
    <>
      <Ground level={level} look={look} />
      {peaks.map((p, i) => (
        <mesh key={i} material={ice} position={[p.x, p.h / 2, p.z]} castShadow><coneGeometry args={[1.6, p.h, 6]} /></mesh>
      ))}
      <group position={[to.x, 0, to.z - 3]}>
        <mesh rotation-x={-Math.PI / 2} position-y={0.07} material={glow(3, 0.9, 0.2)}><circleGeometry args={[3, 32]} /></mesh>
        <Flame position={[-1, 0.6, 0]} light={40} scale={1.6} />
        <Flame position={[1, 0.6, 0.5]} light={0} scale={1.4} />
        <Flame position={[0, 0.6, -1]} light={0} scale={1.8} />
        <Label position={[0, 4, 0]}>🔥 Hố Lửa</Label>
      </group>
      {ids.map((id) => <PushBlock key={id} id={id} level={8} />)}
    </>
  );
}

function Floor11({ level, look }: SceneProps) {
  const ids = useObjIds('block');
  const d = floorDef(11).push!;
  return (
    <>
      <Ground level={level} look={look} />
      {/* các vong hồn bị đá đè nằm dọc đường lăn */}
      {Array.from({ length: 5 }, (_, i) => (
        <group key={i} position={[d.from.x + 6 + i * 4.5, 0.3, d.from.z + (i % 2 ? 2.8 : -2.8)]} rotation-x={-1.2}>
          <Ghost hue={0} pale scale={0.8} />
        </group>
      ))}
      <mesh rotation-x={-Math.PI / 2} position={[(d.from.x + d.to.x) / 2, 0.05, d.from.z]} material={glow(1.2, 0.6, 0.3)}>
        <planeGeometry args={[d.to.x - d.from.x, 0.15]} />
      </mesh>
      {[[-18, -12, 2.4], [17, -11, 3], [-16, 6, 2], [18, 6, 2.6]].map(([x, z, s], i) => (
        <mesh key={i} material={stone} position={[x, s * 0.8, z]} scale={s} castShadow><dodecahedronGeometry args={[1, 0]} /></mesh>
      ))}
      {ids.map((id) => <PushBlock key={id} id={id} level={11} />)}
    </>
  );
}

/* ================= Tầng 10 — Trâu Húc ================= */
function Floor10({ level, look }: SceneProps) {
  return (
    <>
      <Ground level={level} look={look} />
      {[-24.5, 24.5].map((x) => (
        <group key={x} position-x={x}>
          {Array.from({ length: 9 }, (_, i) => <mesh key={i} material={wood} position={[0, 1, -16 + i * 3.6]}><boxGeometry args={[0.25, 2, 0.25]} /></mesh>)}
          {[0.7, 1.5].map((y) => <mesh key={y} material={wood} position={[0, y, -2]}><boxGeometry args={[0.15, 0.15, 30]} /></mesh>)}
        </group>
      ))}
      {[[-20, 14], [20, 14], [-12, 15], [13, 15.5]].map(([x, z], i) => (
        <mesh key={i} material={paper} position={[x, 0.8, z]}><cylinderGeometry args={[1, 1.3, 1.6, 12]} /></mesh>
      ))}
      <SafeZoneMark />
      <Zones level={10} />
    </>
  );
}

/* ================= Tầng 12 — Cối Giã ================= */
function MortarStation({ id }: { id: string }) {
  const o = objects.get(id)!;
  const lever = useRef<THREE.Group>(null);
  useFrame(() => {
    const t = performance.now() / 1000 - (fx.pounds.get(`${o.x},${o.z}`) ?? -10);
    // vừa giã: chày rơi xuống (-0.25) rồi nâng dần lên (0.35)
    if (lever.current) lever.current.rotation.x = t < 0.5 ? THREE.MathUtils.lerp(-0.25, 0.35, t / 0.5) : 0.35;
  });
  return (
    <group position={[o.x, 0, o.z]}>
      <RigidBody type="fixed" colliders={false}><CylinderCollider args={[0.5, 1]} position-y={0.5} /></RigidBody>
      <mesh material={stone} position-y={0.5} castShadow><cylinderGeometry args={[1, 0.8, 1, 20]} /></mesh>
      <mesh position-y={1.01} rotation-x={-Math.PI / 2}><circleGeometry args={[0.75, 20]} /><meshStandardMaterial color="#f4ecd0" /></mesh>
      <mesh material={wood} position={[0, 0.8, -2.2]}><boxGeometry args={[0.6, 1.6, 0.6]} /></mesh>
      <group ref={lever} position={[0, 1.6, -2.2]} rotation-x={0.35}>
        <mesh material={wood} position-z={1.4}><boxGeometry args={[0.3, 0.3, 4]} /></mesh>
        <mesh material={wood} position={[0, -0.6, 2.2]}><cylinderGeometry args={[0.25, 0.25, 1.3, 10]} /></mesh>
      </group>
    </group>
  );
}

function Drum() {
  const ref = useRef<THREE.Group>(null);
  const ring = useRef<THREE.Mesh>(null);
  const ringMat = useMemo(() => {
    const m = glow(3, 1.8, 0.4);
    m.transparent = true;
    return m;
  }, []);
  useFrame(() => {
    const t = performance.now() / 1000 - fx.beatAt;
    const k = Math.max(0, 1 - t / 0.25);
    ref.current?.scale.setScalar(1 + k * 0.12);
    if (ring.current) {
      ring.current.scale.setScalar(1 + Math.min(t, 1) * 8);
      ringMat.opacity = Math.max(0, 1 - t);
    }
  });
  return (
    <group position={[0, 0, -2]}>
      <RigidBody type="fixed" colliders={false}><CylinderCollider args={[1, 1.5]} position-y={1} /></RigidBody>
      <group ref={ref}>
        <mesh position-y={1.2} rotation-x={Math.PI / 2} castShadow>
          <cylinderGeometry args={[1.5, 1.5, 1.6, 24]} />
          <meshStandardMaterial color="#8a1010" roughness={0.6} />
        </mesh>
        {[-0.82, 0.82].map((z) => (
          <mesh key={z} position={[0, 1.2, z]} rotation-y={z > 0 ? 0 : Math.PI}><circleGeometry args={[1.45, 24]} /><meshStandardMaterial color="#e8d8b0" /></mesh>
        ))}
      </group>
      <mesh ref={ring} rotation-x={-Math.PI / 2} position-y={0.07} material={ringMat}><torusGeometry args={[1, 0.05, 6, 48]} /></mesh>
      <Label position={[0, 3.4, 0]}>🥁 Trống giã cối</Label>
    </group>
  );
}

function Floor12({ level, look }: SceneProps) {
  const ids = useObjIds('mortar');
  return (
    <>
      <Ground level={level} look={look} />
      {ids.map((id) => <MortarStation key={id} id={id} />)}
      <Drum />
      {[[-16, 8], [16, 8], [-17, -10], [17, -10]].map(([x, z], i) => (
        <group key={i} position={[x, 0, z]}>
          {[0, 1, 2].map((j) => <mesh key={j} material={paper} position={[j * 0.9 - 0.9, 0.5, 0]}><cylinderGeometry args={[0.45, 0.4, 1, 10]} /></mesh>)}
        </group>
      ))}
    </>
  );
}

/* ================= Tầng 13 — Ao Nước Mắm ================= */
function Floor13({ level, look }: SceneProps) {
  const c = floorDef(13).collect!;
  const built = BRIDGE_PLANKS; // cầu bắc sẵn qua ao nước mắm
  const W = 27, D = 19;
  const pieces = useMemo(
    () => [
      { x0: -W, x1: W, z0: POND.z1, z1: D },
      { x0: -W, x1: W, z0: -D, z1: POND.z0 },
      { x0: -W, x1: POND.x0, z0: POND.z0, z1: POND.z1 },
      { x0: POND.x1, x1: W, z0: POND.z0, z1: POND.z1 },
    ],
    [],
  );
  const plankD = (POND.z1 - POND.z0) / BRIDGE_PLANKS;
  const blood = useRef<THREE.MeshStandardMaterial>(null);
  useFrame(({ clock }) => {
    if (blood.current) blood.current.emissiveIntensity = 0.5 + Math.sin(clock.elapsedTime) * 0.15;
  });
  return (
    <>
      <Ground level={level} look={look} pieces={pieces} />
      <mesh rotation-x={-Math.PI / 2} position={[(POND.x0 + POND.x1) / 2, -0.7, (POND.z0 + POND.z1) / 2]}>
        <planeGeometry args={[POND.x1 - POND.x0, POND.z1 - POND.z0]} />
        <meshStandardMaterial ref={blood} color="#c07a1a" emissive="#6a3a00" roughness={0.1} metalness={0.2} />
      </mesh>
      <RigidBody type="fixed" colliders={false} key={built}>
        {Array.from({ length: built }, (_, i) => (
          <CuboidCollider key={i} args={[1.8, 0.15, plankD / 2]} position={[0, -0.15, POND.z1 - plankD * (i + 0.5)]} />
        ))}
      </RigidBody>
      {Array.from({ length: built }, (_, i) => (
        <mesh key={i} material={wood} position={[0, -0.15, POND.z1 - plankD * (i + 0.5)]} rotation-y={(i % 2 ? 1 : -1) * 0.03} receiveShadow castShadow>
          <boxGeometry args={[3.6, 0.3, plankD - 0.12]} />
        </mesh>
      ))}
      <group position={[c.source!.x, 0, c.source!.z]}>
        {[0, 1, 2, 3].map((i) => <mesh key={i} material={wood} position={[0, 0.2 + i * 0.32, 0]} rotation-y={i * 0.4}><boxGeometry args={[3, 0.3, 0.7]} /></mesh>)}
      </group>
      <Items level={13} />
    </>
  );
}

/* ================= Tầng 14 — Thành Uổng Tử ================= */
function StoneLamp({ x, z, lit }: { x: number; z: number; lit: boolean }) {
  const l = useRef<THREE.PointLight>(null);
  useFrame(({ clock }) => {
    if (l.current) l.current.intensity = lit ? 14 + Math.sin(clock.elapsedTime * 5 + x) * 3 : 0;
  });
  return (
    <group position={[x, 0, z]}>
      <RigidBody type="fixed" colliders={false}><CylinderCollider args={[1, 0.6]} position-y={1} /></RigidBody>
      <mesh material={stone} position-y={0.6}><cylinderGeometry args={[0.35, 0.6, 1.2, 8]} /></mesh>
      <mesh material={stone} position-y={1.5}><boxGeometry args={[1, 0.7, 1]} /></mesh>
      <mesh position-y={1.5} material={lit ? litMat : unlitMat}><boxGeometry args={[0.55, 0.45, 1.02]} /></mesh>
      <mesh material={stone} position-y={2.05}><coneGeometry args={[0.9, 0.5, 4]} /></mesh>
      <pointLight ref={l} color="#ffb060" distance={10} decay={2} position-y={1.6} intensity={0} />
    </group>
  );
}
const litMat = glow(3, 1.6, 0.5);
const unlitMat = glow(0.05, 0.05, 0.06);

function Wanderer({ i }: { i: number }) {
  const ref = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime * 0.12 + i * 1.3;
    const r = 6 + (i % 3) * 5;
    if (!ref.current) return;
    ref.current.position.set(Math.cos(t) * r, 0, -3 + Math.sin(t) * r * 0.7);
    ref.current.rotation.y = -t;
  });
  return (
    <group ref={ref}>
      <Ghost hue={200} pale />
    </group>
  );
}

function Floor14({ level, look }: SceneProps) {
  const c = floorDef(14).collect!;
  const lit = 0; // thành u tối, đèn không bao giờ sáng
  return (
    <>
      <Ground level={level} look={look} />
      {c.targets.map((t, i) => (
        <group key={i}>
          <StoneLamp x={t.x} z={t.z} lit={i < lit} />
          <GroundRing x={t.x} z={t.z} r={t.r} color={[1.5, 1, 0.4]} />
        </group>
      ))}
      <group position={[c.source!.x, 0, c.source!.z]}>
        <RigidBody type="fixed" colliders={false}><CuboidCollider args={[1.3, 1.2, 1]} position-y={1.2} /></RigidBody>
        <mesh material={stone} position-y={1.2}><boxGeometry args={[2.6, 2.4, 2]} /></mesh>
        <mesh material={darkStone} position-y={2.8} rotation-y={Math.PI / 4}><coneGeometry args={[2.2, 1.2, 4]} /></mesh>
        <mesh position={[0, 1.2, 1.01]} material={glow(2.5, 1.2, 0.4)}><planeGeometry args={[0.9, 1.2]} /></mesh>
      </group>
      {Array.from({ length: 7 }, (_, i) => <Wanderer key={i} i={i} />)}
      <Label position={[0, 6, -3]}>枉死城 Thành Uổng Tử</Label>
      <Items level={14} />
    </>
  );
}

/* ================= Tầng 15 — Phanh Thây ================= */
function Tomb({ x, z, color }: { x: number; z: number; color: string }) {
  const c = new THREE.Color(color);
  return (
    <group position={[x, 0, z]}>
      <RigidBody type="fixed" colliders={false}><CylinderCollider args={[0.6, 1.4]} position-y={0.4} /></RigidBody>
      <mesh material={darkStone} scale={[1, 0.55, 1]} castShadow><sphereGeometry args={[1.5, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2]} /></mesh>
      <mesh material={stone} position={[0, 1.2, -1.2]}><boxGeometry args={[1.1, 1.8, 0.3]} /></mesh>
      <mesh position={[0, 1.3, -1.04]}>
        <planeGeometry args={[0.6, 1]} />
        <meshBasicMaterial color={c.clone().multiplyScalar(2.5)} toneMapped={false} />
      </mesh>
      <GroundRing x={0} z={0} r={2.6} color={[c.r * 2, c.g * 2, c.b * 2]} />
    </group>
  );
}

function Floor15({ level, look }: SceneProps) {
  const c = floorDef(15).collect!;
  const holes = useMemo(() => Array.from({ length: 10 }, (_, i) => ({ x: ((i * 37) % 44) - 22, z: ((i * 23) % 22) - 6 })), []);
  return (
    <>
      <Ground level={level} look={look} />
      {c.targets.map((t, i) => <Tomb key={i} x={t.x} z={t.z} color={TOMB_COLORS[i]} />)}
      {holes.map((h, i) => (
        <mesh key={i} rotation-x={-Math.PI / 2} position={[h.x, 0.04, h.z]}><circleGeometry args={[1, 16]} /><meshBasicMaterial color="#3a2a4a" /></mesh>
      ))}
      <Items level={15} />
    </>
  );
}

/* ================= Tầng 16 — Núi Lửa ================= */
function Floor16({ level, look }: SceneProps) {
  const crater = useRef<THREE.MeshBasicMaterial>(null);
  useFrame(({ clock }) => {
    crater.current?.color.setRGB(4 + Math.sin(clock.elapsedTime * 2), 1.2, 0.2);
  });
  return (
    <>
      <Ground level={level} look={look} />
      <group position={[0, -2, -42]}>
        <mesh material={darkStone}><coneGeometry args={[22, 26, 16, 1, true]} /></mesh>
        <mesh position-y={12.5} rotation-x={-Math.PI / 2}><circleGeometry args={[5, 24]} /><meshBasicMaterial ref={crater} toneMapped={false} /></mesh>
      </group>
      <pointLight color="#ffb04a" intensity={160} distance={70} decay={1.5} position={[0, 14, -30]} />
      <SafeZoneMark />
      <Zones level={16} />
    </>
  );
}

/* ================= Tầng 17 — Cối Xay Đá ================= */
function Floor17({ level, look }: SceneProps) {
  return (
    <>
      <Ground level={level} look={look} />
      <Mill />
      <Burner />
      <FloatingLanterns />
    </>
  );
}

/* ================= Tầng 18 — Cưa Xẻ ================= */
const sawOn = glow(3, 2.2, 0.4);
const sawOff = glow(0.3, 0.15, 0.1);

function SawStation({ id }: { id: string }) {
  const o = objects.get(id)!;
  const blade = useRef<THREE.Group>(null);
  const ringA = useRef<THREE.Mesh>(null);
  const ringB = useRef<THREE.Mesh>(null);
  useFrame((_, dt) => {
    const cur = objects.get(id);
    if (!cur || !blade.current) return;
    const tx = cur.s === 0 ? 0.9 : -0.9;
    blade.current.position.x += (tx - blade.current.position.x) * (1 - Math.exp(-14 * Math.min(dt, 0.05)));
    if (ringA.current) ringA.current.material = cur.s === 0 ? sawOn : sawOff;
    if (ringB.current) ringB.current.material = cur.s === 1 ? sawOn : sawOff;
  });
  return (
    <group position={[o.x, 0, o.z]}>
      <RigidBody type="fixed" colliders={false}><CuboidCollider args={[1.8, 0.9, 0.7]} position-y={0.9} /></RigidBody>
      {[-1.4, 1.4].map((x) => (
        <group key={x} position-x={x}>
          <mesh material={wood} position-y={0.5} rotation-z={0.3}><boxGeometry args={[0.2, 1.1, 1.2]} /></mesh>
          <mesh material={wood} position-y={0.5} rotation-z={-0.3}><boxGeometry args={[0.2, 1.1, 1.2]} /></mesh>
        </group>
      ))}
      <mesh material={wood} position-y={1.3} rotation-z={Math.PI / 2} castShadow><cylinderGeometry args={[0.65, 0.65, 4, 16]} /></mesh>
      <group ref={blade} position-y={1.9}>
        <mesh material={steel}><boxGeometry args={[4.6, 0.5, 0.05]} /></mesh>
        {[-1, 1].map((s) => <mesh key={s} material={wood} position-x={s * 2.45}><boxGeometry args={[0.25, 0.9, 0.25]} /></mesh>)}
      </group>
      <mesh ref={ringA} rotation-x={-Math.PI / 2} position={[-SAW_HANDLE, 0.07, 0]} material={sawOn}><torusGeometry args={[0.9, 0.08, 6, 32]} /></mesh>
      <mesh ref={ringB} rotation-x={-Math.PI / 2} position={[SAW_HANDLE, 0.07, 0]} material={sawOff}><torusGeometry args={[0.9, 0.08, 6, 32]} /></mesh>
    </group>
  );
}

function Floor18({ level, look }: SceneProps) {
  const ids = useObjIds('saw');
  return (
    <>
      <Ground level={level} look={look} />
      {ids.map((id) => <SawStation key={id} id={id} />)}
      {[[-18, -12], [18, -12], [-19, 6], [19, 6]].map(([x, z], i) => (
        <group key={i} position={[x, 0, z]}>
          {[0, 1, 2].map((j) => <mesh key={j} material={wood} position={[0, 0.6 + j * 1.1, 0]} rotation-z={Math.PI / 2}><cylinderGeometry args={[0.55, 0.55, 5, 12]} /></mesh>)}
        </group>
      ))}
    </>
  );
}

const SCENES: Record<number, (p: SceneProps) => React.ReactElement> = {
  1: Floor1, 2: Floor2, 3: Floor3, 4: Floor4, 5: Floor5, 6: Floor6, 7: Floor7, 8: Floor8, 9: Floor9,
  10: Floor10, 11: Floor11, 12: Floor12, 13: Floor13, 14: Floor14, 15: Floor15, 16: Floor16, 17: Floor17, 18: Floor18,
};

/* ================= Quỷ sai đi tuần (chướng ngại chung) ================= */
const dangerMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 0.15, 0.1), toneMapped: false, transparent: true, opacity: 0.5, depthWrite: false });

function PatrolGuard({ id }: { id: string }) {
  const ref = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const o = objects.get(id)!;
  const prev = useRef({ x: o.x, z: o.z });
  useFrame(({ clock }, dt) => {
    const g = ref.current, cur = objects.get(id);
    if (!g || !cur) return;
    const k = 1 - Math.exp(-10 * Math.min(dt, 0.05));
    g.position.x += (cur.x - g.position.x) * k;
    g.position.z += (cur.z - g.position.z) * k;
    const dx = cur.x - prev.current.x, dz = cur.z - prev.current.z;
    if (Math.hypot(dx, dz) > 0.01) {
      const target = Math.atan2(dx, dz);
      let d = target - g.rotation.y;
      d = ((d + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
      g.rotation.y += d * k;
    }
    prev.current = { x: cur.x, z: cur.z };
    if (body.current) body.current.rotation.z = Math.sin(clock.elapsedTime * 7) * 0.06; // dáng đi lắc lư
    dangerMat.opacity = 0.35 + Math.abs(Math.sin(clock.elapsedTime * 3)) * 0.25;
  });
  return (
    <group ref={ref} position={[o.x, 0, o.z]}>
      <mesh rotation-x={-Math.PI / 2} position-y={0.06} material={dangerMat}>
        <ringGeometry args={[PATROL_HIT_R - 0.15, PATROL_HIT_R, 32]} />
      </mesh>
      <group ref={body}>
        <GuardModel kind={o.hp === 0 ? 'bull' : 'horse'} label={o.hp === 0 ? '⚠ Ngưu Đầu tuần tra' : '⚠ Mã Diện tuần tra'} />
      </group>
    </group>
  );
}

function Patrols() {
  const ids = useObjIds('patrol');
  return <>{ids.map((id) => <PatrolGuard key={id} id={id} />)}</>;
}

export function FloorScene({ level, look }: SceneProps) {
  const Scene = SCENES[level] ?? Floor17;
  return (
    <>
      <Scene level={level} look={look} />
      <Patrols />
    </>
  );
}
