import { forwardRef, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { useGame } from '../store.ts';
import { fx } from '../fx.ts';
import { blobShadow, textTexture } from './textures.ts';

// Hình học dùng chung cho mọi hồn ma
const headGeo = new THREE.SphereGeometry(0.6, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2);
const bodyGeo = (() => {
  const g = new THREE.CylinderGeometry(0.6, 0.76, 1.0, 32, 2, true);
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    if (pos.getY(i) < -0.49) {
      const a = Math.atan2(pos.getZ(i), pos.getX(i));
      pos.setY(i, pos.getY(i) + Math.sin(a * 7) * 0.1);
    }
  }
  g.computeVertexNormals();
  return g;
})();
const eyeGeo = new THREE.SphereGeometry(0.1, 16, 12);
const armGeo = new THREE.SphereGeometry(0.17, 16, 12);
const eyeMat = new THREE.MeshBasicMaterial({ color: '#160606' });
const glintMat = new THREE.MeshBasicMaterial({ color: '#ffffff' });
const mouthMat = new THREE.MeshBasicMaterial({ color: '#5a1010' });
const strawMat = new THREE.MeshStandardMaterial({ color: '#d8b56a', roughness: 0.9 });
const goldMat = new THREE.MeshStandardMaterial({ color: '#f5c04a', emissive: '#f5a020', emissiveIntensity: 0.8, metalness: 0.7, roughness: 0.3 });
const redEyeMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 0.3, 0.1), toneMapped: false });

export interface GhostProps {
  hue: number;
  id?: string;
  name?: string;
  me?: boolean;
  hat?: 'non' | 'crown' | 'tall' | 'bun';
  /** Màu thân tuỳ chỉnh (VD Hắc Vô Thường đen, Bạch Vô Thường trắng) */
  body?: string;
  hatColor?: string;
  hatText?: string;
  tongue?: boolean;
  angryEyes?: boolean;
  scale?: number;
  pale?: boolean;
}

/** Hồn ma: vỏ ngoài do cha điều khiển vị trí; bên trong tự nhấp nhô & nghiêng. */
export const Ghost = forwardRef<THREE.Group, GhostProps>(function Ghost({ hue, id, name, me, hat, angryEyes, scale = 1, pale, body, hatColor = '#111', hatText, tongue }, ref) {
  const inner = useRef<THREE.Group>(null);
  const phase = useMemo(() => Math.random() * 10, []);
  const hatTex = useMemo(() => (hatText ? textTexture(hatText.split(''), { w: 128, h: 512, size: 96, color: hatColor === '#111' ? '#f0e0c0' : '#300', glow: '#000' }) : null), [hatText, hatColor]);
  const mat = useMemo(() => {
    if (body) {
      const c = new THREE.Color(body);
      return new THREE.MeshStandardMaterial({ color: c, emissive: c.clone().multiplyScalar(0.35), roughness: 0.5, transparent: true, opacity: 0.95, side: THREE.DoubleSide });
    }
    const c = new THREE.Color().setHSL(hue / 360, pale ? 0.08 : 0.75, 0.82);
    return new THREE.MeshStandardMaterial({
      color: c,
      emissive: new THREE.Color().setHSL(hue / 360, pale ? 0.1 : 0.85, 0.45),
      emissiveIntensity: me ? 0.75 : pale ? 0.35 : 0.55,
      roughness: 0.35,
      transparent: true,
      opacity: pale ? 0.5 : 0.92,
      side: THREE.DoubleSide,
    });
  }, [hue, me, pale, body]);
  const bubble = useGame((s) => (id ? s.bubbles[id] : undefined));

  useFrame((state) => {
    const g = inner.current;
    if (!g) return;
    const t = state.clock.elapsedTime;
    const outer = g.parent as THREE.Group;
    const lean: number = outer?.userData.lean ?? 0;
    const pushed = id ? fx.pushes.get(id) : undefined;
    const pushAmt = pushed ? Math.max(0, 1 - (performance.now() / 1000 - pushed) / 0.3) : 0;
    g.position.y = 0.3 + Math.sin(t * 3 + phase) * 0.12;
    g.rotation.x = THREE.MathUtils.lerp(g.rotation.x, lean * 0.25 + pushAmt * 0.5, 0.2);
    g.rotation.z = Math.sin(t * 1.7 + phase) * 0.05;
  });

  return (
    <group ref={ref} scale={scale}>
      <mesh rotation-x={-Math.PI / 2} position-y={0.03}>
        <planeGeometry args={[1.8, 1.8]} />
        <meshBasicMaterial map={blobShadow()} transparent depthWrite={false} />
      </mesh>
      <group ref={inner}>
        <mesh geometry={headGeo} material={mat} position-y={1.35} castShadow />
        <mesh geometry={bodyGeo} material={mat} position-y={0.85} castShadow />
        <mesh geometry={armGeo} material={mat} position={[-0.68, 1.0, 0.12]} />
        <mesh geometry={armGeo} material={mat} position={[0.68, 1.0, 0.12]} />
        {[-0.21, 0.21].map((x) => (
          <group key={x} position={[x, 1.48, 0.54]}>
            <mesh geometry={eyeGeo} material={angryEyes ? redEyeMat : eyeMat} scale={[1, 1.4, 0.6]} />
            {!angryEyes && <mesh geometry={eyeGeo} material={glintMat} scale={0.3} position={[0.03, 0.05, 0.05]} />}
          </group>
        ))}
        <mesh geometry={eyeGeo} material={mouthMat} position={[0, 1.22, 0.58]} scale={[0.9, 0.55, 0.4]} />
        {hat === 'non' && (
          <mesh material={strawMat} position-y={2.05} castShadow>
            <coneGeometry args={[0.95, 0.5, 32]} />
          </mesh>
        )}
        {hat === 'crown' && (
          <group position-y={1.95}>
            <mesh material={goldMat}>
              <cylinderGeometry args={[0.45, 0.5, 0.3, 24, 1, true]} />
            </mesh>
            {[0, 1, 2, 3, 4].map((i) => (
              <mesh key={i} material={goldMat} position={[Math.sin((i / 5) * Math.PI * 2) * 0.45, 0.28, Math.cos((i / 5) * Math.PI * 2) * 0.45]}>
                <coneGeometry args={[0.1, 0.3, 8]} />
              </mesh>
            ))}
          </group>
        )}
        {hat === 'tall' && (
          <group position-y={2.15}>
            <mesh castShadow>
              <cylinderGeometry args={[0.32, 0.55, 1.5, 4, 1]} />
              <meshStandardMaterial color={hatColor} roughness={0.8} />
            </mesh>
            {hatTex && (
              <mesh position={[0, 0, 0.31]} rotation-x={-0.16}>
                <planeGeometry args={[0.3, 1.2]} />
                <meshBasicMaterial map={hatTex} transparent toneMapped={false} />
              </mesh>
            )}
          </group>
        )}
        {hat === 'bun' && (
          <mesh position-y={1.95} material={strawMat}>
            <sphereGeometry args={[0.3, 16, 12]} />
          </mesh>
        )}
        {tongue && (
          <mesh position={[0, 0.95, 0.66]} rotation-x={0.25}>
            <boxGeometry args={[0.14, 0.6, 0.04]} />
            <meshStandardMaterial color="#c01020" emissive="#600010" />
          </mesh>
        )}
        {me && (
          <mesh position-y={2.15} rotation-x={Math.PI / 2}>
            <torusGeometry args={[0.32, 0.04, 8, 32]} />
            <meshBasicMaterial color={new THREE.Color(3, 2.4, 0.8)} toneMapped={false} />
          </mesh>
        )}
      </group>
      {name && (
        <Html position={[0, 2.75, 0]} center pointerEvents="none" zIndexRange={[20, 0]}>
          <div className={me ? 'tag me' : 'tag'}>{name}</div>
        </Html>
      )}
      {bubble && (
        <Html position={[0, 3.5, 0]} center pointerEvents="none" zIndexRange={[30, 21]}>
          <div className="bubble">{bubble}</div>
        </Html>
      )}
    </group>
  );
});
