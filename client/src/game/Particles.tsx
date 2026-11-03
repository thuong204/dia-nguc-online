import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { SPOTS } from '../../../shared/game.ts';
import { fx } from '../fx.ts';
import { objects } from '../net.ts';
import { useGame } from '../store.ts';
import { dotTexture, floorLook } from './textures.ts';

const MAX = 2500;
type P = { x: number; y: number; z: number; vx: number; vy: number; vz: number; life: number; max: number; r: number; g: number; b: number; grav: number };

/** Một hệ hạt chung: tàn lửa, lửa lò vàng mã, hơi canh, tia lửa cối xay. */
const BURST: Record<string, [number, number, number]> = {
  gold: [2.5, 1.7, 0.4], blue: [0.4, 1.2, 3], white: [2, 2, 2.2], green: [0.4, 2.6, 0.8],
};

export function Particles() {
  const level = useGame((s) => s.level);
  const ember = useMemo(() => {
    const c = new THREE.Color(floorLook(level).crack);
    return [c.r * 1.4, c.g * 1.4, c.b * 1.4] as [number, number, number];
  }, [level]);
  const pts = useRef<THREE.Points>(null);
  const pool = useRef<P[]>([]);
  const { geo, pos, col } = useMemo(() => {
    const pos = new Float32Array(MAX * 3), col = new Float32Array(MAX * 3);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3).setUsage(THREE.DynamicDrawUsage));
    return { geo, pos, col };
  }, []);

  const emit = (x: number, y: number, z: number, vx: number, vy: number, vz: number, life: number, r: number, g: number, b: number, grav = 0) => {
    if (pool.current.length < MAX) pool.current.push({ x, y, z, vx, vy, vz, life, max: life, r, g, b, grav });
  };
  const rnd = (a: number) => (Math.random() - 0.5) * a;

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    // tàn lửa bay khắp nơi
    const [er, eg, eb] = ember;
    const n = 40 * dt;
    for (let i = 0; i < Math.floor(n) + (Math.random() < n % 1 ? 1 : 0); i++) emit(rnd(70), -1, rnd(50), rnd(0.5), 1 + Math.random() * 2, rnd(0.5), 6, er, eg, eb);
    // lửa lò vàng mã (tầng cối xay)
    const B = SPOTS.burner;
    if (level === 17) for (let i = 0; i < 3; i++) emit(B.x + rnd(1.2), 1.9, B.z + rnd(1.2), rnd(0.6), 2 + Math.random() * 2.5, rnd(0.6), 0.7 + Math.random() * 0.4, 2.2, 0.9, 0.2);
    // trạm đang bùng: hơi lồng hấp (tầng 5) / lửa dưới vạc dầu (tầng 9)
    for (const o of objects.values()) {
      if (o.kind !== 'station' || o.s !== 1) continue;
      if (level === 5) for (let i = 0; i < 3; i++) emit(o.x + rnd(1.5), 3.3, o.z + rnd(1.5), rnd(1.5), 3 + Math.random() * 3, rnd(1.5), 1.2, 0.7, 0.7, 0.68);
      else for (let i = 0; i < 2; i++) emit(o.x + rnd(2.5), 0.4, o.z + rnd(2.5), rnd(0.5), 1.5 + Math.random() * 2, rnd(0.5), 0.6, 2.4, 0.9, 0.15);
    }
    // khói núi lửa (tầng 16)
    if (level === 16 && Math.random() < 0.6) emit(rnd(6), 11, -42 + rnd(6), rnd(1), 3 + Math.random() * 2, rnd(1), 6, 1.6, 0.5, 0.15);

    // sự kiện
    for (const ev of fx.queue.splice(0)) {
      if (ev.kind === 'burst') {
        const [r, g, b] = BURST[ev.c ?? 'gold'] ?? BURST.gold;
        for (let i = 0; i < 40; i++) emit((ev.x ?? 0) + rnd(1), ev.y ?? 2, (ev.z ?? 0) + rnd(1), rnd(7), 2 + Math.random() * 6, rnd(7), 0.9 + Math.random() * 0.5, r, g, b, -9);
      } else if (ev.kind === 'burn') {
        for (let i = 0; i < 90; i++) emit(B.x + rnd(1.5), 2, B.z + rnd(1.5), rnd(6), 4 + Math.random() * 7, rnd(6), 1.6 + Math.random(), 2.5, 1.7, 0.4, -6);
      } else {
        const a = Math.random() * Math.PI * 2;
        for (let i = 0; i < 8; i++) emit(SPOTS.mill.x + Math.cos(a) * 2.6, 1.6, SPOTS.mill.z + Math.sin(a) * 2.6, rnd(4), 2 + Math.random() * 3, rnd(4), 0.5, 2.5, 1.2, 0.3, -9);
      }
    }

    const arr = pool.current;
    for (let i = arr.length - 1; i >= 0; i--) {
      const p = arr[i];
      p.life -= dt;
      if (p.life <= 0) {
        arr[i] = arr[arr.length - 1];
        arr.pop();
        continue;
      }
      p.vy += p.grav * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
    }
    for (let i = 0; i < arr.length; i++) {
      const p = arr[i], f = Math.min(1, p.life / p.max) * Math.min(1, (p.max - p.life) * 6);
      pos[i * 3] = p.x;
      pos[i * 3 + 1] = p.y;
      pos[i * 3 + 2] = p.z;
      col[i * 3] = p.r * f;
      col[i * 3 + 1] = p.g * f;
      col[i * 3 + 2] = p.b * f;
    }
    geo.setDrawRange(0, arr.length);
    geo.attributes.position.needsUpdate = true;
    geo.attributes.color.needsUpdate = true;
  });

  return (
    <points ref={pts} geometry={geo} frustumCulled={false}>
      <pointsMaterial size={0.32} map={dotTexture()} vertexColors transparent depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} sizeAttenuation />
    </points>
  );
}
