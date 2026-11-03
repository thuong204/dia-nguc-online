import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { CuboidCollider, CylinderCollider, RigidBody } from '@react-three/rapier';
import * as THREE from 'three';
import { BOUNDS, SPOTS } from '../../../shared/game.ts';
import { FloorScene } from './maps.tsx';
import { ExecGround } from './ExecGround.tsx';
import { useGame } from '../store.ts';
import { fx } from '../fx.ts';
import { Ghost } from './Ghost.tsx';
import { drawSign, floorLook, groundTextures, lavaTexture, seeded } from './textures.ts';

export type Look = ReturnType<typeof floorLook>;
export const stone = new THREE.MeshStandardMaterial({ color: '#b8a4d0', roughness: 0.9 });
export const darkStone = new THREE.MeshStandardMaterial({ color: '#8a6ab0', roughness: 0.8 });
const lacquer = new THREE.MeshStandardMaterial({ color: '#ff5a7a', roughness: 0.45 });
const tile = new THREE.MeshStandardMaterial({ color: '#3ac0b0', roughness: 0.6 });
export const bronze = new THREE.MeshStandardMaterial({ color: '#e8b040', metalness: 0.5, roughness: 0.35 });
export const wood = new THREE.MeshStandardMaterial({ color: '#c08a50', roughness: 0.8 });
const flameMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 1.6, 0.3), toneMapped: false, transparent: true, opacity: 0.9 });
const goldGlow = new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 2, 0.6), toneMapped: false });
const dimRing = new THREE.MeshBasicMaterial({ color: '#ffd04a' });
const soupMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.6, 2.4, 1.3), toneMapped: false });
export const lanternMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.6, 1.4, 2.2), toneMapped: false }); // đèn lồng hồng như bóng bay

export function Flame({ position, scale = 1, light = 30 }: { position: [number, number, number]; scale?: number; light?: number }) {
  const m = useRef<THREE.Mesh>(null);
  const l = useRef<THREE.PointLight>(null);
  const ph = useMemo(() => Math.random() * 10, []);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime + ph;
    const f = 1 + Math.sin(t * 13) * 0.12 + Math.sin(t * 7.3) * 0.1;
    m.current?.scale.set(scale, scale * f * 1.2, scale);
    if (l.current) l.current.intensity = light * f;
  });
  return (
    <group position={position}>
      <mesh ref={m} material={flameMat}>
        <coneGeometry args={[0.35, 1.1, 12]} />
      </mesh>
      {light > 0 && <pointLight ref={l} color="#ff7a2a" distance={18} decay={2} position-y={0.5} />}
    </group>
  );
}

export function Torch({ x, z }: { x: number; z: number }) {
  return (
    <RigidBody type="fixed" colliders={false} position={[x, 0, z]}>
      <CylinderCollider args={[1.3, 0.3]} position-y={1.3} />
      <mesh material={darkStone} position-y={1.3} castShadow>
        <cylinderGeometry args={[0.18, 0.3, 2.6, 8]} />
      </mesh>
      <mesh material={bronze} position-y={2.65}>
        <cylinderGeometry args={[0.45, 0.2, 0.3, 12]} />
      </mesh>
      <Flame position={[0, 3.2, 0]} light={22} />
    </RigidBody>
  );
}

type Piece = { x0: number; x1: number; z0: number; z1: number };
export function Ground({ level, look, pieces }: { level: number; look: Look; pieces?: Piece[] }) {
  const tex = useMemo(() => groundTextures(level), [level]);
  const mat = useRef<THREE.MeshStandardMaterial>(null);
  useEffect(() => () => { tex.map.dispose(); tex.emissive.dispose(); }, [tex]);
  useFrame(({ clock }) => {
    if (mat.current) mat.current.emissiveIntensity = 0.45 + Math.sin(clock.elapsedTime * 1.5) * 0.15;
  });
  const W = BOUNDS.x * 2 + 4, D = BOUNDS.z * 2 + 4;
  const parts: Piece[] = pieces ?? [{ x0: -W / 2, x1: W / 2, z0: -D / 2, z1: D / 2 }];
  return (
    <RigidBody type="fixed" colliders={false}>
      {parts.map((q, i) => (
        <CuboidCollider key={i} args={[(q.x1 - q.x0) / 2, 0.5, (q.z1 - q.z0) / 2]} position={[(q.x0 + q.x1) / 2, -0.5, (q.z0 + q.z1) / 2]} />
      ))}
      {/* tường vô hình chặn rơi xuống dung nham */}
      <CuboidCollider args={[0.5, 6, BOUNDS.z + 2]} position={[BOUNDS.x + 0.8, 6, 0]} />
      <CuboidCollider args={[0.5, 6, BOUNDS.z + 2]} position={[-BOUNDS.x - 0.8, 6, 0]} />
      <CuboidCollider args={[W / 2, 6, 0.5]} position={[0, 6, BOUNDS.z + 0.8]} />
      <CuboidCollider args={[W / 2, 6, 0.5]} position={[0, 6, -BOUNDS.z - 0.8]} />
      {parts.map((q, i) => (
        <mesh key={i} position={[(q.x0 + q.x1) / 2, -1, (q.z0 + q.z1) / 2]} receiveShadow>
          <boxGeometry args={[q.x1 - q.x0, 2, q.z1 - q.z0]} />
          <meshStandardMaterial attach="material-0" color="#7a5aa0" />
          <meshStandardMaterial attach="material-1" color="#7a5aa0" />
          <meshStandardMaterial ref={i === 0 ? mat : undefined} attach="material-2" map={tex.map} emissiveMap={tex.emissive} color={look.tint} emissive={look.crack} emissiveIntensity={1.1} roughness={0.9} />
          <meshStandardMaterial attach="material-3" color="#7a5aa0" />
          <meshStandardMaterial attach="material-4" color="#7a5aa0" />
          <meshStandardMaterial attach="material-5" color="#7a5aa0" />
        </mesh>
      ))}
    </RigidBody>
  );
}

function Lava({ look }: { look: Look }) {
  const tex = useMemo(() => lavaTexture(), []);
  const mat = useRef<THREE.MeshStandardMaterial>(null);
  useFrame(({ clock }, dt) => {
    tex.offset.x += dt * 0.01;
    tex.offset.y += dt * 0.006;
    if (mat.current) mat.current.emissiveIntensity = 0.9 + Math.sin(clock.elapsedTime * 0.8) * 0.2;
  });
  return (
    <mesh rotation-x={-Math.PI / 2} position-y={-1.4}>
      <planeGeometry args={[320, 320]} />
      {/* biển "dung nham" giờ như nước ngọt có ga sủi bọt */}
      <meshStandardMaterial ref={mat} color={look.lava} emissive={look.lava} emissiveMap={tex} roughness={0.3} />
    </mesh>
  );
}

function Rocks() {
  const rocks = useMemo(() => {
    const r = seeded(99);
    const out: { p: [number, number, number]; s: number; rot: number; spike: boolean }[] = [];
    for (let i = 0; i < 70; i++) {
      const a = r() * Math.PI * 2;
      const rad = 1 + r() * 0.9;
      const x = Math.cos(a) * (BOUNDS.x + 4) * rad, z = Math.sin(a) * (BOUNDS.z + 4) * rad;
      if (z < -16 && Math.abs(x) < 12) continue; // chừa chỗ cho cổng
      out.push({ p: [x, -1, z], s: 1 + r() * 3, rot: r() * 6, spike: r() < 0.45 });
    }
    return out;
  }, []);
  return (
    <>
      {rocks.map((k, i) =>
        k.spike ? (
          <mesh key={i} material={darkStone} position={[k.p[0], k.p[1] + k.s * 2, k.p[2]]} rotation-y={k.rot} castShadow>
            <coneGeometry args={[k.s * 0.7, k.s * 5, 6]} />
          </mesh>
        ) : (
          <mesh key={i} material={darkStone} position={k.p} rotation={[k.rot, k.rot, 0]} scale={k.s} castShadow>
            <dodecahedronGeometry args={[1, 0]} />
          </mesh>
        ),
      )}
    </>
  );
}

function Gate({ level }: { level: number }) {
  const canvas = useMemo(() => document.createElement('canvas'), []);
  const tex = useMemo(() => {
    const t = new THREE.CanvasTexture(canvas);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, [canvas]);
  useEffect(() => {
    let alive = true;
    const paint = () => {
      if (!alive) return;
      drawSign(canvas, level);
      tex.needsUpdate = true;
    };
    paint();
    Promise.all([document.fonts.load('800 64px "Be Vietnam Pro"'), document.fonts.load('700 92px "Noto Serif TC"')]).then(paint).catch(() => {});
    return () => { alive = false; };
  }, [level, canvas, tex]);
  const z = -BOUNDS.z - 1.5;
  return (
    <group position={[0, 0, z]}>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[0.8, 6, 0.8]} position={[-7, 6, 0]} />
        <CuboidCollider args={[0.8, 6, 0.8]} position={[7, 6, 0]} />
      </RigidBody>
      {[-7, 7].map((x) => (
        <group key={x} position-x={x}>
          <mesh material={lacquer} position-y={6} castShadow>
            <boxGeometry args={[1.4, 12, 1.4]} />
          </mesh>
          <mesh material={stone} position-y={0.4}>
            <boxGeometry args={[2.2, 0.8, 2.2]} />
          </mesh>
        </group>
      ))}
      <mesh material={lacquer} position-y={10.2}>
        <boxGeometry args={[17, 0.9, 1.6]} />
      </mesh>
      <mesh material={tile} position-y={11.2}>
        <boxGeometry args={[19.5, 0.7, 3.2]} />
      </mesh>
      <mesh material={tile} position-y={11.75} scale={[1, 1, 0.6]}>
        <boxGeometry args={[16, 0.5, 3]} />
      </mesh>
      <mesh position={[0, 8, 0.9]}>
        <planeGeometry args={[9.5, 2.8]} />
        <meshBasicMaterial map={tex} toneMapped={false} />
      </mesh>
      <Flame position={[-7, 12.6, 0]} scale={1.4} light={0} />
      <Flame position={[7, 12.6, 0]} scale={1.4} light={0} />
      {/* Ngưu Đầu & Mã Diện canh cổng */}
      <Guard kind="bull" position={[-4.2, 0, 2.5]} />
      <Guard kind="horse" position={[4.2, 0, 2.5]} />
      {/* Diêm Vương ngồi sau cổng */}
      <group position={[0, 0.5, -9]}>
        <Ghost hue={2} hat="crown" scale={4.2} />
        <pointLight color="#ffd27a" intensity={80} distance={30} decay={2} position={[0, 6, 6]} />
      </group>
    </group>
  );
}

export function Mill() {
  const top = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (top.current) top.current.rotation.y += fx.millSpin * dt * 0.6 + dt * 0.05;
    fx.millSpin *= Math.pow(0.3, dt);
  });
  const { x, z } = SPOTS.mill;
  return (
    <group position={[x, 0, z]}>
      <RigidBody type="fixed" colliders={false}>
        <CylinderCollider args={[0.6, 2.6]} position-y={0.6} />
      </RigidBody>
      <mesh material={stone} position-y={0.6} castShadow receiveShadow>
        <cylinderGeometry args={[2.6, 2.8, 1.2, 40]} />
      </mesh>
      <group ref={top} position-y={1.55}>
        <mesh material={stone} castShadow>
          <cylinderGeometry args={[2.2, 2.2, 0.7, 40]} />
        </mesh>
        {[0, 1, 2, 3].map((i) => (
          <mesh key={i} material={darkStone} position-y={0.36} rotation-y={(i * Math.PI) / 4}>
            <boxGeometry args={[4.2, 0.04, 0.12]} />
          </mesh>
        ))}
        <mesh material={darkStone} position-y={0.4}>
          <cylinderGeometry args={[0.35, 0.35, 0.2, 16]} />
        </mesh>
        <mesh material={wood} position={[2.9, 0, 0]} castShadow>
          <boxGeometry args={[1.6, 0.25, 0.25]} />
        </mesh>
        <mesh material={wood} position={[3.6, 0.5, 0]} castShadow>
          <cylinderGeometry args={[0.12, 0.12, 1.2, 10]} />
        </mesh>
      </group>
      <mesh material={dimRing} rotation-x={-Math.PI / 2} position-y={0.06}>
        <torusGeometry args={[3.8, 0.12, 6, 96]} />
      </mesh>
      <Html position={[0, 3.6, 0]} center pointerEvents="none" zIndexRange={[10, 0]}>
        <div className="spot-tag">⚙️ Cối xay nghiệp</div>
      </Html>
      <Torch x={-6} z={-5} />
      <Torch x={6} z={-5} />
      <Torch x={-6} z={5} />
      <Torch x={6} z={5} />
    </group>
  );
}

export function Burner() {
  const { x, z } = SPOTS.burner;
  return (
    <group position={[x, 0, z]}>
      <RigidBody type="fixed" colliders={false}>
        <CylinderCollider args={[0.9, 1.3]} position-y={0.9} />
      </RigidBody>
      {[0, 1, 2].map((i) => (
        <mesh key={i} material={bronze} position={[Math.cos((i / 3) * Math.PI * 2) * 0.8, 0.4, Math.sin((i / 3) * Math.PI * 2) * 0.8]}>
          <cylinderGeometry args={[0.1, 0.14, 0.8, 8]} />
        </mesh>
      ))}
      <mesh material={bronze} position-y={1.3} castShadow>
        <cylinderGeometry args={[1.4, 0.8, 1.1, 24]} />
      </mesh>
      <Flame position={[0, 2.2, 0]} scale={1.6} light={50} />
      {[0, 1, 2].map((i) => (
        <mesh key={i} position={[1.8 + i * 0.1, 0.15 + i * 0.22, 0.8]} rotation-y={i * 0.4}>
          <boxGeometry args={[0.8, 0.2, 0.5]} />
          <meshStandardMaterial color="#e8b040" emissive="#a06010" emissiveIntensity={0.4} />
        </mesh>
      ))}
      <Html position={[0, 4, 0]} center pointerEvents="none" zIndexRange={[10, 0]}>
        <div className="spot-tag">🔥 Lò vàng mã</div>
      </Html>
    </group>
  );
}

export function FloatingLanterns() {
  const ref = useRef<THREE.Group>(null);
  const items = useMemo(() => {
    const r = seeded(5);
    return Array.from({ length: 16 }, () => ({ x: (r() - 0.5) * 60, y: 7 + r() * 6, z: (r() - 0.5) * 44, ph: r() * 6 }));
  }, []);
  useFrame(({ clock }) => {
    ref.current?.children.forEach((c, i) => {
      c.position.y = items[i].y + Math.sin(clock.elapsedTime * 0.6 + items[i].ph) * 0.6;
    });
  });
  return (
    <group ref={ref}>
      {items.map((l, i) => (
        <mesh key={i} material={lanternMat} position={[l.x, l.y, l.z]} scale={[1, 1.3, 1]}>
          <sphereGeometry args={[0.3, 12, 10]} />
        </mesh>
      ))}
    </group>
  );
}

const robe = new THREE.MeshStandardMaterial({ color: '#6a4ac0', roughness: 0.7 });
const bullSkin = new THREE.MeshStandardMaterial({ color: '#c0784a', roughness: 0.7 });
const horseSkin = new THREE.MeshStandardMaterial({ color: '#e0a868', roughness: 0.7 });
const horn = new THREE.MeshStandardMaterial({ color: '#e8dcc0', roughness: 0.5 });
const eyeGlow = new THREE.MeshBasicMaterial({ color: '#ffffff' }); // mắt tròn xoe ngây ngô
const pupil = new THREE.MeshBasicMaterial({ color: '#111111' });
const steel = new THREE.MeshStandardMaterial({ color: '#b8c0c8', metalness: 0.9, roughness: 0.25 });

/** Quỷ sai Ngưu Đầu (đầu trâu) / Mã Diện (mặt ngựa) cầm đinh ba. */
function Guard({ kind, position }: { kind: 'bull' | 'horse'; position: [number, number, number] }) {
  return (
    <group position={position}>
      <RigidBody type="fixed" colliders={false}>
        <CylinderCollider args={[1.6, 0.9]} position-y={1.6} />
      </RigidBody>
      <GuardModel kind={kind} />
    </group>
  );
}

/** Ngưu Đầu (bull) / Mã Diện (horse) — dùng ở cổng và cho quỷ sai đi tuần. */
export function GuardModel({ kind, label }: { kind: 'bull' | 'horse'; label?: string | null }) {
  const ref = useRef<THREE.Group>(null);
  const phase = useMemo(() => Math.random() * 10, []);
  useFrame(({ clock }) => {
    if (ref.current) ref.current.position.y = Math.sin(clock.elapsedTime * 1.2 + phase) * 0.05;
  });
  const skin = kind === 'bull' ? bullSkin : horseSkin;
  return (
    <group>
      <group ref={ref} scale={1.5}>
        <mesh material={robe} position-y={1.0} castShadow>
          <coneGeometry args={[0.85, 2.0, 12]} />
        </mesh>
        <mesh material={robe} position-y={1.9}>
          <sphereGeometry args={[0.5, 16, 12]} />
        </mesh>
        {kind === 'bull' ? (
          <group position-y={2.55}>
            <mesh material={skin}><boxGeometry args={[0.75, 0.7, 0.7]} /></mesh>
            <mesh material={skin} position={[0, -0.15, 0.42]}><boxGeometry args={[0.55, 0.4, 0.3]} /></mesh>
            {[-1, 1].map((sx) => (
              <mesh key={sx} material={horn} position={[sx * 0.55, 0.35, 0]} rotation-z={-sx * 0.9}>
                <coneGeometry args={[0.1, 0.6, 8]} />
              </mesh>
            ))}
            {[-0.18, 0.18].map((x) => <group key={x} position={[x, 0.08, 0.36]}><mesh material={eyeGlow}><sphereGeometry args={[0.11, 10, 8]} /></mesh><mesh material={pupil} position-z={0.09}><sphereGeometry args={[0.045, 8, 6]} /></mesh></group>)}
          </group>
        ) : (
          <group position-y={2.6}>
            <mesh material={skin}><boxGeometry args={[0.55, 0.65, 0.6]} /></mesh>
            <mesh material={skin} position={[0, -0.18, 0.5]} rotation-x={0.25}><boxGeometry args={[0.4, 0.35, 0.7]} /></mesh>
            {[-1, 1].map((sx) => (
              <mesh key={sx} material={skin} position={[sx * 0.2, 0.45, -0.05]}>
                <coneGeometry args={[0.08, 0.3, 6]} />
              </mesh>
            ))}
            {[-0.2, 0.2].map((x) => <group key={x} position={[x, 0.08, 0.31]}><mesh material={eyeGlow}><sphereGeometry args={[0.11, 10, 8]} /></mesh><mesh material={pupil} position-z={0.09}><sphereGeometry args={[0.045, 8, 6]} /></mesh></group>)}
          </group>
        )}
        <group position={[0.75, 1.6, 0.2]}>
          <mesh material={wood}><cylinderGeometry args={[0.05, 0.05, 3.4, 8]} /></mesh>
          {[-0.18, 0, 0.18].map((x) => (
            <mesh key={x} material={steel} position={[x, 1.85, 0]}><coneGeometry args={[0.05, 0.4, 6]} /></mesh>
          ))}
          <mesh material={steel} position-y={1.62}><boxGeometry args={[0.45, 0.06, 0.06]} /></mesh>
        </group>
      </group>
      {label !== null && (
        <Html position={[0, 5.4, 0]} center pointerEvents="none" zIndexRange={[10, 0]}>
          <div className="tag">{label ?? (kind === 'bull' ? 'Ngưu Đầu' : 'Mã Diện')}</div>
        </Html>
      )}
    </group>
  );
}

export function World({ level }: { level: number }) {
  const look = floorLook(level);
  return (
    <>
      <Lava look={look} />
      <Rocks />
      <Gate level={level} />
      <FloorScene level={level} look={look} />
      <ExecGround level={level} look={look} />
    </>
  );
}
