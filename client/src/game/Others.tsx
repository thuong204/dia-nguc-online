import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { players } from '../net.ts';
import { useGame } from '../store.ts';
import { Ghost } from './Ghost.tsx';

function lerpAngle(a: number, b: number, t: number) {
  const d = ((b - a + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
  return a + d * t;
}

function Remote({ id }: { id: string }) {
  const ref = useRef<THREE.Group>(null);
  const p = players.get(id);
  useFrame((_, dt) => {
    const g = ref.current, n = players.get(id);
    if (!g || !n) return;
    if (!g.userData.init) {
      g.userData.init = true;
      g.position.set(n.x, n.y, n.z);
      g.rotation.y = n.r;
    }
    const k = 1 - Math.exp(-10 * Math.min(dt, 0.05));
    const ox = g.position.x, oz = g.position.z;
    g.position.x += (n.x - g.position.x) * k;
    g.position.y += (n.y - g.position.y) * k;
    g.position.z += (n.z - g.position.z) * k;
    g.rotation.y = lerpAngle(g.rotation.y, n.r, k);
    const speed = Math.hypot(g.position.x - ox, g.position.z - oz) / Math.max(dt, 1e-3);
    g.userData.lean = THREE.MathUtils.clamp(speed / 10, 0, 1);
  });
  if (!p) return null;
  return (
    <group>
      <Ghost ref={ref} hue={p.hue} id={id} name={p.name} />
    </group>
  );
}

export function Others() {
  const ids = useGame((s) => s.others);
  return (
    <>
      {ids.map((id) => (
        <Remote key={id} id={id} />
      ))}
    </>
  );
}
