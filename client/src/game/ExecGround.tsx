// Pháp Trường: một cọc hành hình trước bãi xuất hiện — có ở mọi tầng, mang màu sắc riêng của tầng,
// có đao phủ đứng canh và ra tay khi hồn trên cọc chịu hình.
import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { EXEC_SPOTS, EXEC_WAIT, EXEC_ZONE, FLOORS, HEADSMAN } from '../../../shared/game.ts';
import { players } from '../net.ts';
import { Torch, wood, type Look } from './World.tsx';

const edgeMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 1.8, 0.4), toneMapped: false }); // viền sân khấu vàng
const skinMat = new THREE.MeshStandardMaterial({ color: '#f0b890', roughness: 0.6 });
const robeMat = new THREE.MeshStandardMaterial({ color: '#ff5aa0', roughness: 0.7 }); // áo hồng chấm bi kiểu chú hề
const sashMat = new THREE.MeshStandardMaterial({ color: '#3a8aff', roughness: 0.8 });
const toyRed = new THREE.MeshStandardMaterial({ color: '#ff3a4a', roughness: 0.35 });
const toyYellow = new THREE.MeshStandardMaterial({ color: '#ffd02a', roughness: 0.4 });
const dusterMat = new THREE.MeshStandardMaterial({ color: '#ff9ad8', roughness: 0.95 });
const ironMat = new THREE.MeshStandardMaterial({ color: '#a8b0c0', metalness: 0.5, roughness: 0.35 });
const eyeMat = new THREE.MeshBasicMaterial({ color: '#111111' });
const noseMat = new THREE.MeshStandardMaterial({ color: '#ff2a2a', roughness: 0.3 });

/** "Vũ khí" đao phủ đổi theo tầng: búa hơi đồ chơi / chổi lông gà / cá cao su */
function Weapon({ level }: { level: number }) {
  const k = level % 3;
  if (k === 1)
    return (
      <group position-y={-0.9}>
        <mesh material={toyYellow}><cylinderGeometry args={[0.05, 0.05, 1.6, 8]} /></mesh>
        <mesh material={toyRed} position={[0, -0.85, 0]} rotation-z={Math.PI / 2}><cylinderGeometry args={[0.25, 0.25, 0.65, 14]} /></mesh>
      </group>
    );
  if (k === 2)
    return (
      <group position-y={-0.9}>
        <mesh material={wood}><cylinderGeometry args={[0.04, 0.05, 1.4, 8]} /></mesh>
        <mesh material={dusterMat} position-y={-0.85} scale={[1, 1.4, 1]}><sphereGeometry args={[0.28, 10, 8]} /></mesh>
      </group>
    );
  return (
    <group position-y={-0.9}>
      <mesh material={toyYellow} position={[0, -0.35, 0]} scale={[0.35, 1, 0.15]}><sphereGeometry args={[0.55, 12, 8]} /></mesh>
      <mesh material={toyYellow} position={[0, -0.95, 0]} rotation-z={Math.PI}><coneGeometry args={[0.2, 0.3, 4]} /></mesh>
      {[-0.06, 0.06].map((x) => <mesh key={x} material={eyeMat} position={[x, -0.05, 0.08]}><sphereGeometry args={[0.03, 6, 4]} /></mesh>)}
    </group>
  );
}

/** Đao phủ: vạm vỡ, đầu trọc, khăn đỏ, cầm vũ khí; giơ lên bổ xuống khi hồn trên cọc chịu hình. */
function Headsman({ level }: { level: number }) {
  const root = useRef<THREE.Group>(null);
  const arm = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const victim = [...players.values()].find((p) => p.slot === 0);
    const busy = !!victim && victim.pain > 0;
    const a = arm.current;
    if (a) {
      // chịu hình: bổ liên hồi; có người trên cọc: giơ sẵn; không ai: chống vũ khí đứng chờ
      const target = busy ? -2.6 + Math.max(0, Math.sin(t * 5)) * 2.2 : victim ? -2.4 : -0.3;
      a.rotation.x += (target - a.rotation.x) * 0.25;
    }
    if (root.current) {
      root.current.position.y = Math.sin(t * 1.4) * 0.03;
      const face = Math.atan2(EXEC_SPOTS[0].x - HEADSMAN.x, EXEC_SPOTS[0].z - HEADSMAN.z);
      root.current.rotation.y = victim ? face : face + 0.9; // rảnh thì quay ra nhìn đám hồn
    }
  });
  return (
    <group position={[HEADSMAN.x, 0, HEADSMAN.z]}>
      <group ref={root} scale={1.25}>
        {[-0.16, 0.16].map((x) => <mesh key={x} material={sashMat} position={[x, 0.45, 0]}><cylinderGeometry args={[0.11, 0.09, 0.9, 8]} /></mesh>)}
        <mesh material={robeMat} position-y={1.25} castShadow><cylinderGeometry args={[0.42, 0.34, 0.9, 12]} /></mesh>
        <mesh material={sashMat} position-y={0.92}><torusGeometry args={[0.36, 0.06, 6, 20]} /></mesh>
        <mesh material={skinMat} position-y={1.62}><sphereGeometry args={[0.36, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2]} /></mesh>
        <group position-y={1.98}>
          <mesh material={skinMat} castShadow><sphereGeometry args={[0.24, 16, 12]} /></mesh>
          <mesh material={robeMat} position-y={0.05} rotation-x={Math.PI / 2}><torusGeometry args={[0.235, 0.04, 6, 20]} /></mesh>
          {[-0.08, 0.08].map((x) => <mesh key={x} material={eyeMat} position={[x, 0.04, 0.21]}><sphereGeometry args={[0.035, 6, 4]} /></mesh>)}
          <mesh material={noseMat} position={[0, -0.03, 0.24]}><sphereGeometry args={[0.07, 10, 8]} /></mesh>
        </group>
        <mesh material={skinMat} position={[-0.46, 1.3, 0]} rotation-z={0.25}><cylinderGeometry args={[0.09, 0.08, 0.7, 8]} /></mesh>
        <group ref={arm} position={[0.46, 1.6, 0]}>
          <mesh material={skinMat} position-y={-0.35}><cylinderGeometry args={[0.1, 0.08, 0.7, 8]} /></mesh>
          <Weapon level={level} />
        </group>
      </group>
      <Html position={[0, 3.3, 0]} center pointerEvents="none" zIndexRange={[10, 0]}>
        <div className="tag">🤡 Đao phủ (tập sự)</div>
      </Html>
    </group>
  );
}

/** Cọc hành hình */
function Stake() {
  const s = EXEC_SPOTS[0];
  return (
    <group position={[s.x, 0, s.z - 0.45]}>
      <mesh material={wood} position-y={1.4} castShadow><boxGeometry args={[0.28, 2.8, 0.28]} /></mesh>
      <mesh material={wood} position-y={2.3}><boxGeometry args={[1.5, 0.2, 0.22]} /></mesh>
      {[1.0, 1.7].map((y) => <mesh key={y} material={ironMat} position-y={y} rotation-x={Math.PI / 2}><torusGeometry args={[0.2, 0.035, 6, 16]} /></mesh>)}
    </group>
  );
}

function Status({ level }: { level: number }) {
  const f = FLOORS[level - 1];
  return (
    <div className="spot-tag exec-tag">
      🎪 SÂN KHẤU HÌNH PHẠT · {f.name.replace(' Địa Ngục', '')}
      <small>Bấm E nhận tội — quỷ sai sẽ áp giải tới đây</small>
    </div>
  );
}

export function ExecGround({ level, look }: { level: number; look: Look }) {
  const W = EXEC_ZONE.x1 - EXEC_ZONE.x0, D = EXEC_ZONE.z1 - EXEC_ZONE.z0;
  const cz = (EXEC_ZONE.z0 + EXEC_ZONE.z1) / 2;
  // nền Pháp Trường nhuốm màu của tầng
  const slabMat = useMemo(() => new THREE.MeshStandardMaterial({ color: new THREE.Color(look.lava).multiplyScalar(0.7), roughness: 0.7 }), [look.lava]);
  const ring = useMemo(() => new THREE.MeshBasicMaterial({ color: new THREE.Color(look.crack), toneMapped: false }), [look.crack]);
  const base = useMemo(() => new THREE.Color(look.crack).multiplyScalar(0.6), [look.crack]);
  const waitMat = useMemo(() => new THREE.MeshBasicMaterial({ color: new THREE.Color(look.crack).multiplyScalar(0.35), toneMapped: false }), [look.crack]);
  useFrame(({ clock }) => {
    const taken = [...players.values()].some((p) => p.slot === 0);
    const pulse = 1 + Math.sin(clock.elapsedTime * 6) * 0.35;
    if (taken) ring.color.setRGB(2.6 * pulse, 1.4 * pulse, 2.4 * pulse);
    else ring.color.copy(base);
  });
  const s = EXEC_SPOTS[0];
  return (
    <group>
      <mesh material={slabMat} position={[0, 0.02, cz]} rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[W, D]} />
      </mesh>
      {[EXEC_ZONE.z0, EXEC_ZONE.z1].map((z) => (
        <mesh key={z} material={edgeMat} position={[0, 0.04, z]} rotation-x={-Math.PI / 2}>
          <planeGeometry args={[W, 0.12]} />
        </mesh>
      ))}
      <mesh material={ring} position={[s.x, 0.05, s.z]} rotation-x={-Math.PI / 2}>
        <torusGeometry args={[1.1, 0.08, 6, 40]} />
      </mesh>
      {/* chỗ đứng chờ khi cọc đang bận */}
      {EXEC_WAIT.map((w, i) => (
        <mesh key={i} material={waitMat} position={[w.x, 0.04, w.z]} rotation-x={-Math.PI / 2}>
          <ringGeometry args={[0.45, 0.55, 24]} />
        </mesh>
      ))}
      <Stake />
      <Headsman level={level} />
      <Torch x={EXEC_ZONE.x0 - 0.8} z={cz} />
      <Torch x={EXEC_ZONE.x1 + 0.8} z={cz} />
      <Html position={[0, 5.2, EXEC_ZONE.z0]} center pointerEvents="none" zIndexRange={[9, 0]}>
        <Status level={level} />
      </Html>
    </group>
  );
}
