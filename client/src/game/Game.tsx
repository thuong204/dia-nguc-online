import { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { KeyboardControls } from '@react-three/drei';
import { Physics } from '@react-three/rapier';
import { Bloom, EffectComposer, ToneMapping, Vignette } from '@react-three/postprocessing';
import { ToneMappingMode } from 'postprocessing';
import { useGame } from '../store.ts';
import { Player, type Controls } from './Player.tsx';
import { Others } from './Others.tsx';
import { Particles } from './Particles.tsx';
import { World } from './World.tsx';
import { floorLook } from './textures.ts';

const keyMap: { name: Controls; keys: string[] }[] = [
  { name: 'forward', keys: ['KeyW', 'ArrowUp'] },
  { name: 'back', keys: ['KeyS', 'ArrowDown'] },
  { name: 'left', keys: ['KeyA', 'ArrowLeft'] },
  { name: 'right', keys: ['KeyD', 'ArrowRight'] },
  { name: 'run', keys: ['ShiftLeft', 'ShiftRight'] },
  { name: 'jump', keys: ['Space'] },
];

export default function Game() {
  const level = useGame((s) => s.level);
  const roomKey = useGame((s) => s.roomKey);
  const meReady = useGame((s) => s.meReady);
  if (!level) return null;
  const look = floorLook(level);

  return (
    <KeyboardControls map={keyMap}>
      <Canvas shadows dpr={[1, 1.75]} camera={{ fov: 60, position: [0, 8, 28], near: 0.1, far: 260 }}>
        <color attach="background" args={[look.fog]} />
        <fogExp2 attach="fog" args={[look.fog, look.density]} />
        {/* ánh sáng nhuốm màu riêng của từng tầng */}
        {/* phiên bản hài: trời sáng sủa như công viên */}
        <hemisphereLight args={[look.crack, look.fog, 1.3]} />
        <ambientLight intensity={0.55} />
        <directionalLight
          castShadow
          position={[12, 24, 10]}
          intensity={1.8}
          color="#fff4e0"
          shadow-mapSize={[2048, 2048]}
          shadow-camera-left={-32}
          shadow-camera-right={32}
          shadow-camera-top={24}
          shadow-camera-bottom={-24}
        />
        <Suspense fallback={null}>
          <Physics gravity={[0, -24, 0]}>
            <World level={level} />
            {meReady && <Player key={roomKey} />}
          </Physics>
        </Suspense>
        <Others key={'o' + roomKey} />
        <Particles />
        <EffectComposer>
          <Bloom mipmapBlur luminanceThreshold={0.95} intensity={0.6} />
          <Vignette offset={0.35} darkness={0.3} />
          <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
        </EffectComposer>
      </Canvas>
    </KeyboardControls>
  );
}
