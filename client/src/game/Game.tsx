import { Suspense, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { KeyboardControls } from '@react-three/drei';
import { Physics } from '@react-three/rapier';
import { Bloom, ChromaticAberration, EffectComposer, Noise, ToneMapping, Vignette } from '@react-three/postprocessing';
import { BlendFunction, ToneMappingMode, type ChromaticAberrationEffect, type NoiseEffect } from 'postprocessing';
import * as THREE from 'three';
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

/** Hạt nhiễu phim luôn có (cho cảm giác thước phim cũ); khi chính mình chịu hình thì nhoè màu, nhiễu dày. */
function PainFx() {
  const chroma = useRef<ChromaticAberrationEffect>(null);
  const noise = useRef<NoiseEffect>(null);
  const amt = useRef(0);
  useFrame((_, dt) => {
    const target = useGame.getState().pain ? 1 : 0;
    amt.current += (target - amt.current) * Math.min(1, dt * 4);
    const a = amt.current;
    const j = a * (0.001 + Math.random() * 0.002);
    chroma.current?.offset.set(j, j * 0.6);
    if (noise.current) noise.current.blendMode.opacity.value = 0.07 + a * 0.18;
  });
  return (
    <>
      <ChromaticAberration ref={chroma} offset={new THREE.Vector2(0, 0)} radialModulation={false} modulationOffset={0} />
      <Noise ref={noise} premultiply blendFunction={BlendFunction.OVERLAY} />
    </>
  );
}

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
        <hemisphereLight args={[look.crack, look.fog, 0.75]} />
        <ambientLight intensity={0.15} />
        <directionalLight
          castShadow
          position={[12, 24, 10]}
          intensity={1.1}
          color={look.crack}
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
          <Bloom mipmapBlur luminanceThreshold={0.9} intensity={0.9} />
          <Vignette offset={0.25} darkness={0.75} />
          <PainFx />
          <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
        </EffectComposer>
      </Canvas>
    </KeyboardControls>
  );
}
