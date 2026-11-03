import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useKeyboardControls } from '@react-three/drei';
import { CapsuleCollider, RigidBody, useRapier, type RapierRigidBody } from '@react-three/rapier';
import * as THREE from 'three';
import { SPAWN } from '../../../shared/game.ts';
import { players, send } from '../net.ts';
import { useGame } from '../store.ts';
import { nearHint } from '../interact.ts';
import { fx, isTyping } from '../fx.ts';
import { Ghost } from './Ghost.tsx';

export type Controls = 'forward' | 'back' | 'left' | 'right' | 'run' | 'jump';

const HALF = 1.1; // tâm capsule cách chân 1.1
const ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const tmpV = new THREE.Vector3();
const lookAt = new THREE.Vector3();
const ray = new THREE.Raycaster();

function lerpAngle(a: number, b: number, t: number) {
  const d = ((b - a + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
  return a + d * t;
}

/** Người chơi: thân vật lý Rapier + hồn ma + camera góc nhìn thứ ba. */
export function Player() {
  const myId = useGame((s) => s.myId);
  const level = useGame((s) => s.level);
  const me = players.get(myId)!;
  const body = useRef<RapierRigidBody>(null);
  const ghost = useRef<THREE.Group>(null);
  const { camera, gl } = useThree();
  const [, getKeys] = useKeyboardControls<Controls>();
  const { world, rapier } = useRapier();

  const cam = useRef({ yaw: 0, pitch: 0.42, dist: 11 });
  const target = useRef<THREE.Vector3 | null>(null);
  const facing = useRef(Math.PI);
  const jumpHeld = useRef(false);
  const sent = useRef({ t: 0, x: 0, y: 0, z: 0, r: 0 });

  // Kéo chuột xoay camera, bấm (không kéo) để đi tới, cuộn để zoom
  useEffect(() => {
    const el = gl.domElement;
    let down: { x: number; y: number; lx: number; ly: number; drag: boolean } | null = null;
    const onDown = (e: PointerEvent) => {
      down = { x: e.clientX, y: e.clientY, lx: e.clientX, ly: e.clientY, drag: false };
      el.setPointerCapture(e.pointerId);
    };
    const onMove = (e: PointerEvent) => {
      if (!down) return;
      const dx = e.clientX - down.lx, dy = e.clientY - down.ly;
      down.lx = e.clientX;
      down.ly = e.clientY;
      if (Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6) down.drag = true;
      if (down.drag) {
        cam.current.yaw -= dx * 0.006;
        cam.current.pitch = THREE.MathUtils.clamp(cam.current.pitch + dy * 0.004, 0.08, 1.25);
      }
    };
    const onUp = (e: PointerEvent) => {
      if (down && !down.drag) {
        const r = el.getBoundingClientRect();
        const ndc = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
        ray.setFromCamera(ndc, camera);
        const hit = ray.ray.intersectPlane(ground, new THREE.Vector3());
        if (hit) target.current = hit;
      }
      down = null;
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      cam.current.dist = THREE.MathUtils.clamp(cam.current.dist + e.deltaY * 0.01, 5, 22);
    };
    el.addEventListener('pointerdown', onDown);
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onUp);
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp);
      el.removeEventListener('wheel', onWheel);
    };
  }, [gl, camera]);

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const b = body.current, g = ghost.current;
    if (!b || !g) return;
    const keys = getKeys();
    const typing = isTyping();
    const pos = b.translation();

    // hướng đi theo camera
    let ix = 0, iz = 0;
    if (!typing) {
      if (keys.forward) iz += 1;
      if (keys.back) iz -= 1;
      if (keys.left) ix -= 1;
      if (keys.right) ix += 1;
    }
    const yaw = cam.current.yaw;
    let dx = -Math.sin(yaw) * iz + Math.cos(yaw) * ix;
    let dz = -Math.cos(yaw) * iz - Math.sin(yaw) * ix;
    if (dx || dz) target.current = null;
    else if (target.current) {
      const tx = target.current.x - pos.x, tz = target.current.z - pos.z, d = Math.hypot(tx, tz);
      if (d < 0.4) target.current = null;
      else {
        dx = tx / d;
        dz = tz / d;
      }
    }
    const len = Math.hypot(dx, dz);
    const speed = keys.run && !typing ? 10 : 6;
    const lv = b.linvel();
    const k = 1 - Math.exp(-12 * dt);
    const vx = len ? (dx / len) * speed : 0, vz = len ? (dz / len) * speed : 0;
    if (len) facing.current = Math.atan2(dx, dz);

    // chạm đất?
    const hit = world.castRay(new rapier.Ray({ x: pos.x, y: pos.y - HALF + 0.05, z: pos.z }, { x: 0, y: -1, z: 0 }), 0.2, true, undefined, undefined, undefined, b);
    const wantJump = (keys.jump && !typing) || fx.jumpRequested;
    let vy = lv.y;
    if (wantJump && !jumpHeld.current && hit) vy = 9;
    jumpHeld.current = wantJump;
    fx.jumpRequested = false;
    b.setLinvel({ x: lv.x + (vx - lv.x) * k, y: vy, z: lv.z + (vz - lv.z) * k }, true);

    if (pos.y < -8 || fx.respawn) {
      fx.respawn = false;
      b.setTranslation({ x: SPAWN.x + (Math.random() - 0.5) * 6, y: 2, z: SPAWN.z }, true);
      target.current = null;
      b.setLinvel({ x: 0, y: 0, z: 0 }, true);
    }

    // hình ảnh hồn ma
    const footY = pos.y - HALF;
    g.position.set(pos.x, footY, pos.z);
    g.rotation.y = lerpAngle(g.rotation.y, facing.current, 1 - Math.exp(-14 * dt));
    g.userData.lean = len ? speed / 10 : 0;

    // camera theo sau
    const { pitch, dist } = cam.current;
    lookAt.set(pos.x, footY + 1.8, pos.z);
    tmpV.set(Math.sin(yaw) * Math.cos(pitch) * dist, Math.sin(pitch) * dist, Math.cos(yaw) * Math.cos(pitch) * dist).add(lookAt);
    tmpV.y = Math.max(tmpV.y, 0.6);
    camera.position.lerp(tmpV, 1 - Math.exp(-10 * dt));
    camera.lookAt(lookAt);

    // đang đứng gần chỗ nào?
    const near = nearHint(level, pos.x, pos.z);
    if (useGame.getState().near !== near) useGame.getState().set({ near });

    // gửi vị trí ~15 lần/giây
    const s = sent.current;
    s.t += dt;
    if (s.t > 1 / 15) {
      s.t = 0;
      const r = Math.round(facing.current * 100) / 100;
      if (Math.abs(s.x - pos.x) + Math.abs(s.z - pos.z) + Math.abs(s.y - footY) > 0.02 || s.r !== r) {
        s.x = pos.x;
        s.y = footY;
        s.z = pos.z;
        s.r = r;
        send('move', { x: +pos.x.toFixed(2), y: +Math.max(0, footY).toFixed(2), z: +pos.z.toFixed(2), r });
      }
    }
  });

  return (
    <>
      <RigidBody ref={body} colliders={false} position={[me.x, HALF + 0.3, me.z]} enabledRotations={[false, false, false]} canSleep={false} ccd>
        <CapsuleCollider args={[0.5, 0.6]} friction={0} />
      </RigidBody>
      <Ghost ref={ghost} hue={me.hue} id={myId} name={me.name} me />
    </>
  );
}
