// Tội nhân: hình người cho hồn người chơi (thay cho hồn ma hoạt hình).
// Áo tù vải thô, da tái nhợt, tóc rối, thẻ bài chữ 罪 sau lưng; dải vải màu riêng để nhận ra nhau.
import { forwardRef, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { PAIN_ROUNDS } from '../../../shared/game.ts';
import { players } from '../net.ts';
import { useGame } from '../store.ts';
import { blobShadow, textTexture } from './textures.ts';
import { BASE, applyPose, painOf, resetPose, TortureRig, type Parts } from './torment.tsx';
import { GuardModel } from './World.tsx';

/** Ngưu Đầu & Mã Diện kè hai bên, nắm vai lôi hồn ra Pháp Trường khi đang bị áp giải. */
function EscortGuards({ id }: { id: string }) {
  const ref = useRef<THREE.Group>(null);
  const L = useRef<THREE.Group>(null);
  const R = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    const p = players.get(id), g = ref.current;
    if (!g) return;
    const on = !!p && (p.esc ?? 0) > 0 && (p.slot ?? -1) < 0;
    g.visible = on;
    if (!on) return;
    const t = clock.elapsedTime, rough = p!.esc === 2; // chống cự: lôi giật cục
    const sw = Math.sin(t * (rough ? 11 : 8)) * (rough ? 0.12 : 0.06);
    if (L.current) L.current.rotation.z = sw;
    if (R.current) R.current.rotation.z = -sw;
  });
  return (
    <group ref={ref} visible={false}>
      <group ref={L} position={[-1.05, 0, -0.25]} scale={0.62}><GuardModel kind="bull" label={null} /></group>
      <group ref={R} position={[1.05, 0, -0.25]} scale={0.62}><GuardModel kind="horse" label={null} /></group>
    </group>
  );
}

const headGeo = new THREE.SphereGeometry(0.17, 24, 16);
const hairGeo = new THREE.SphereGeometry(0.185, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.55);
const torsoGeo = new THREE.CylinderGeometry(0.25, 0.21, 0.72, 16);
const skirtGeo = (() => {
  // vạt áo dài rách tua ở gấu
  const g = new THREE.CylinderGeometry(0.22, 0.3, 0.42, 18, 2, true);
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) if (pos.getY(i) < -0.2) pos.setY(i, pos.getY(i) - Math.abs(Math.sin(Math.atan2(pos.getZ(i), pos.getX(i)) * 5)) * 0.08);
  g.computeVertexNormals();
  return g;
})();
const upperGeo = new THREE.CylinderGeometry(0.075, 0.065, 0.36, 10);
const foreGeo = new THREE.CylinderGeometry(0.06, 0.05, 0.32, 10);
const handGeo = new THREE.SphereGeometry(0.06, 10, 8);
const legGeo = new THREE.CylinderGeometry(0.09, 0.07, 0.86, 10);
const footGeo = new THREE.BoxGeometry(0.11, 0.06, 0.22);
const scleraGeo = new THREE.SphereGeometry(0.042, 14, 10);
const pupilGeo = new THREE.SphereGeometry(0.024, 10, 8);
const glintGeo = new THREE.SphereGeometry(0.008, 6, 4);
const browGeo = new THREE.BoxGeometry(0.075, 0.016, 0.02);
const earGeo = new THREE.SphereGeometry(0.045, 10, 8);
const noseGeo = new THREE.SphereGeometry(0.03, 10, 8);
const neckGeo = new THREE.CylinderGeometry(0.07, 0.085, 0.16, 10);
const tuftGeo = new THREE.ConeGeometry(0.04, 0.16, 5);
const tearGeo = new THREE.SphereGeometry(0.014, 8, 6);
const streakGeo = new THREE.PlaneGeometry(0.018, 0.1);
const bruiseGeo = new THREE.CircleGeometry(0.035, 12);
const shackleGeo = new THREE.TorusGeometry(0.075, 0.022, 6, 14);
const ankleGeo = new THREE.TorusGeometry(0.1, 0.025, 6, 14);
const lipGeo = new THREE.TorusGeometry(0.035, 0.009, 4, 12, Math.PI);
const patchGeo = new THREE.PlaneGeometry(0.12, 0.1);
const mouthGeo = new THREE.SphereGeometry(0.04, 10, 8);
const plankGeo = new THREE.BoxGeometry(0.16, 0.9, 0.03);
const poolGeo = new THREE.CircleGeometry(1, 32);

const scleraMat = new THREE.MeshStandardMaterial({ color: '#f0e8e0', roughness: 0.2 });
const pupilMat = new THREE.MeshStandardMaterial({ color: '#1a0e08', roughness: 0.1 });
const glintMat = new THREE.MeshBasicMaterial({ color: '#ffffff' });
const tearMat = new THREE.MeshStandardMaterial({ color: '#bfe4ff', roughness: 0, metalness: 0.2, transparent: true, opacity: 0.8 });
const streakMat = new THREE.MeshStandardMaterial({ color: '#a8d0f0', roughness: 0, transparent: true, opacity: 0.35, depthWrite: false });
const bruiseMat = new THREE.MeshStandardMaterial({ color: '#5a3050', roughness: 0.8, transparent: true, opacity: 0.55, depthWrite: false });
const ironMat = new THREE.MeshStandardMaterial({ color: '#3a3a3e', metalness: 0.85, roughness: 0.45 });
const patchMat = new THREE.MeshStandardMaterial({ color: '#6a5a44', roughness: 1, side: THREE.DoubleSide });
const mouthMat = new THREE.MeshBasicMaterial({ color: '#2a0505' });
const hairMat = new THREE.MeshStandardMaterial({ color: '#141010', roughness: 0.9 });
const pantsMat = new THREE.MeshStandardMaterial({ color: '#3a3530', roughness: 1 });
const plankMat = new THREE.MeshStandardMaterial({ color: '#6a4a2a', roughness: 0.9 });
const poolMat = new THREE.MeshStandardMaterial({ color: '#8ad8ff', emissive: '#1a4a6a', roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.7, depthWrite: false }); // vũng nước mắt
let plankTex: THREE.Texture | null = null;

export interface ConvictProps {
  id: string;
  hue: number;
  name?: string;
  me?: boolean;
  /** Quỳ chắp tay (ở Chánh Điện); đọc từ userData.kneel của nhóm cha nếu không truyền */
  kneel?: boolean;
}

export const Convict = forwardRef<THREE.Group, ConvictProps>(function Convict({ id, hue, name, me, kneel }, ref) {
  const level = useGame((s) => s.level);
  const bubble = useGame((s) => s.bubbles[id]);
  const pose = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const torso = useRef<THREE.Mesh>(null);
  const armL = useRef<THREE.Group>(null);
  const armR = useRef<THREE.Group>(null);
  const legL = useRef<THREE.Group>(null);
  const legR = useRef<THREE.Group>(null);
  const mouth = useRef<THREE.Mesh>(null);
  const pool = useRef<THREE.Mesh>(null);
  const tears = useRef<THREE.Group>(null);
  const pupils = useRef<THREE.Group>(null);
  const wasPain = useRef(false);
  const phase = useMemo(() => Math.random() * 10, []);
  if (!plankTex) plankTex = textTexture(['罪'], { w: 128, h: 256, size: 110, color: '#1a0000', glow: '#000', serif: true });

  // mỗi tội nhân một bộ vật liệu riêng (để đổi màu khi bị bỏng / đông cứng / mờ dần)
  const { skin, cloth, sash } = useMemo(() => {
    const skin = new THREE.MeshStandardMaterial({ color: '#b49a88', roughness: 0.75, transparent: true });
    const cloth = new THREE.MeshStandardMaterial({ color: '#a39a86', roughness: 1, transparent: true, side: THREE.DoubleSide });
    const sash = new THREE.MeshStandardMaterial({ color: new THREE.Color().setHSL(hue / 360, 0.55, 0.35), roughness: 0.9 });
    return { skin, cloth, sash };
  }, [hue]);

  useFrame((state) => {
    const P = pose.current, h = head.current, t0 = torso.current, aL = armL.current, aR = armR.current, lL = legL.current, lR = legR.current, m = mouth.current;
    if (!P || !h || !t0 || !aL || !aR || !lL || !lR || !m) return;
    const outer = P.parent as THREE.Group;
    const lean: number = outer?.userData.lean ?? 0;
    const t = state.clock.elapsedTime + phase;
    const parts: Parts = { pose: P, head: h, body: t0, armL: aL, armR: aR, legL: lL, legR: lR, mouth: m, mats: [skin, cloth] };
    const pain = painOf(id);
    const p = players.get(id);

    // khóc nhiều quá thành vũng nước mắt loang dần dưới chân khi đang ở Pháp Trường
    if (pool.current) {
      const bound = (p?.slot ?? -1) >= 0;
      const prog = ((p?.served ?? 0) + (pain ? pain.k : 0)) / PAIN_ROUNDS;
      pool.current.visible = bound && prog > 0.02;
      const r = 0.35 + prog * 1.5;
      pool.current.scale.set(r * 1.15, r, 1);
    }

    // nước mắt chảy ròng ròng, mắt đảo lấm lét
    if (tears.current) tears.current.children.forEach((d, i) => {
      const k = ((t * 0.7 + i * 0.37) % 1);
      d.position.y = 0.0 - k * 0.16;
      d.scale.setScalar(k < 0.9 ? 1 : 0.01);
    });
    if (pupils.current) pupils.current.position.x = Math.sin(t * 0.6) > 0.7 ? 0.012 : Math.sin(t * 0.6) < -0.7 ? -0.012 : 0;
    if (pain) {
      applyPose(level, pain, parts);
      wasPain.current = true;
      return;
    }
    if (wasPain.current) {
      resetPose(parts);
      wasPain.current = false;
    }
    // quỳ chắp tay, cúi đầu
    if (kneel ?? outer?.userData.kneel) {
      P.position.y = -0.46;
      P.rotation.x = 0.12;
      lL.rotation.x = lR.rotation.x = 1.3;
      aL.rotation.set(-0.95, 0, 0.38);
      aR.rotation.set(-0.95, 0, -0.38);
      h.rotation.x = 0.45 + Math.sin(t * 1.1) * 0.03;
      t0.scale.set(1, 1 + Math.sin(t * 1.8) * 0.012, 1);
      return;
    }
    // đi lại: lê chân, khom lưng, đầu gật gù; đứng yên: co ro ôm bụng, run cầm cập, thỉnh thoảng lau nước mắt
    const w = Math.min(1, lean * 1.4);
    const sw = Math.sin(t * 8) * 0.45 * w;
    const shiver = Math.sin(t * 31) * 0.012;
    P.rotation.x = 0.1 + w * 0.1; // khom
    P.rotation.z = shiver + Math.sin(t * 4) * 0.04 * w; // lảo đảo
    lL.rotation.x = sw;
    lR.rotation.x = -sw * 0.8; // chân què kéo lệt xệt
    if (w > 0.1) {
      aL.rotation.set(-sw * 0.5 - 0.2, 0, -0.15);
      aR.rotation.set(sw * 0.5 - 0.2, 0, 0.15);
    } else {
      const wipe = Math.sin(t * 0.9 + phase) > 0.93; // đưa tay lên dụi mắt
      aL.rotation.set(-0.55 + shiver * 4, 0, 0.42);
      aR.rotation.set(wipe ? -2.5 : -0.55 - shiver * 4, 0, wipe ? 0.5 : -0.42);
    }
    h.rotation.x = 0.32 + Math.sin(t * 1.3) * 0.04 + Math.abs(Math.sin(t * 2.6)) * 0.05 * (1 - w); // cúi gằm, sụt sịt
    h.rotation.z = Math.sin(t * 0.5 + phase) * 0.12; // nghiêng đầu ngơ ngác
    P.position.y = Math.abs(Math.sin(t * 8)) * 0.05 * w;
    t0.scale.set(1, 1 + Math.sin(t * 2.4) * 0.018, 1); // thở dốc
  });

  const arm = (side: 1 | -1) => (
    <group ref={side < 0 ? armL : armR} position={[side * BASE.arm[0], BASE.arm[1], BASE.arm[2]]}>
      <mesh geometry={upperGeo} material={cloth} position-y={-0.18} castShadow />
      <mesh geometry={foreGeo} material={skin} position-y={-0.52} castShadow />
      <mesh geometry={handGeo} material={skin} position-y={-0.7} />
      <mesh geometry={shackleGeo} material={ironMat} position-y={-0.63} rotation-x={Math.PI / 2} />
    </group>
  );
  const leg = (side: 1 | -1) => (
    <group ref={side < 0 ? legL : legR} position={[side * BASE.hip[0], BASE.hip[1], BASE.hip[2]]}>
      <mesh geometry={legGeo} material={pantsMat} position-y={-0.43} castShadow />
      <mesh geometry={footGeo} material={skin} position={[0, -0.86, 0.05]} />
      <mesh geometry={ankleGeo} material={ironMat} position-y={-0.76} rotation-x={Math.PI / 2} />
    </group>
  );

  return (
    <group ref={ref}>
      <mesh rotation-x={-Math.PI / 2} position-y={0.03}>
        <planeGeometry args={[1.4, 1.4]} />
        <meshBasicMaterial map={blobShadow()} transparent depthWrite={false} />
      </mesh>
      <mesh ref={pool} geometry={poolGeo} material={poolMat} rotation-x={-Math.PI / 2} position-y={0.035} visible={false} />
      <TortureRig id={id} level={level} sin={players.get(id)?.sin} />
      <EscortGuards id={id} />
      <group ref={pose}>
        {leg(-1)}
        {leg(1)}
        <mesh ref={torso} geometry={torsoGeo} material={cloth} position-y={BASE.body} castShadow />
        <mesh geometry={skirtGeo} material={cloth} position-y={0.78} castShadow />
        <mesh geometry={neckGeo} material={skin} position-y={1.6} />
        {/* miếng vá trên áo tù rách */}
        <mesh geometry={patchGeo} material={patchMat} position={[0.1, 1.28, 0.235]} rotation-z={0.3} />
        <mesh geometry={patchGeo} material={patchMat} position={[-0.14, 0.86, 0.27]} rotation-z={-0.5} scale={0.7} />
        <mesh material={sash} position-y={0.98}>
          <torusGeometry args={[0.235, 0.035, 6, 20]} />
        </mesh>
        <mesh geometry={plankGeo} material={plankMat} position={[0, 1.75, -0.27]} rotation-x={-0.08} castShadow>
          {/* thẻ bài tội nhân cắm sau lưng */}
        </mesh>
        <mesh position={[0, 1.85, -0.25]} rotation={[-0.08, Math.PI, 0]}>
          <planeGeometry args={[0.15, 0.3]} />
          <meshBasicMaterial map={plankTex} transparent />
        </mesh>
        {arm(-1)}
        {arm(1)}
        <group ref={head} position-y={BASE.head}>
          <mesh geometry={headGeo} material={skin} scale={[1, 1.08, 0.96]} castShadow />
          <mesh geometry={hairGeo} material={hairMat} position={[0, 0.03, -0.02]} rotation-x={-0.35} />
          {/* tóc rối bù xù */}
          {[[-0.1, 0.15, 0.02, 0.6], [0.06, 0.18, 0.05, -0.4], [0.13, 0.12, -0.04, -0.9], [-0.02, 0.19, -0.08, 0.2], [-0.14, 0.08, -0.06, 1.1]].map(([x, y, z, r], i) => (
            <mesh key={i} geometry={tuftGeo} material={hairMat} position={[x, y, z]} rotation={[-0.4, 0, r]} />
          ))}
          {[-1, 1].map((sx) => <mesh key={sx} geometry={earGeo} material={skin} position={[sx * 0.168, 0.0, 0]} scale={[0.5, 1, 0.8]} />)}
          <mesh geometry={noseGeo} material={skin} position={[0, -0.02, 0.175]} scale={[0.9, 1, 1.1]} />
          {/* mắt to ướt át, ngước nhìn lên tội nghiệp */}
          {[-0.065, 0.065].map((x) => (
            <group key={x} position={[x, 0.035, 0.14]}>
              <mesh geometry={scleraGeo} material={scleraMat} scale={[1, 1.1, 0.6]} />
            </group>
          ))}
          <group ref={pupils}>
            {[-0.065, 0.065].map((x) => (
              <group key={x} position={[x, 0.047, 0.163]}>
                <mesh geometry={pupilGeo} material={pupilMat} scale={[1, 1.1, 0.5]} />
                <mesh geometry={glintGeo} material={glintMat} position={[0.009, 0.01, 0.012]} />
              </group>
            ))}
          </group>
          {/* lông mày xếch hình chữ bát (八) — mặt mếu */}
          {[-1, 1].map((sx) => <mesh key={sx} geometry={browGeo} material={hairMat} position={[sx * 0.065, 0.098, 0.158]} rotation-z={sx * -0.45} />)}
          {/* vệt nước mắt + giọt lệ rơi */}
          {[-1, 1].map((sx) => <mesh key={sx} geometry={streakGeo} material={streakMat} position={[sx * 0.07, -0.025, 0.162]} />)}
          <group ref={tears} position={[0, 0, 0.165]}>
            {[-0.07, 0.07, -0.07, 0.07].map((x, i) => <mesh key={i} geometry={tearGeo} material={tearMat} position={[x, 0, 0]} scale={[0.8, 1.3, 0.8]} />)}
          </group>
          {/* má bầm tím, môi mếu */}
          <mesh geometry={bruiseGeo} material={bruiseMat} position={[0.1, -0.03, 0.14]} rotation-y={0.55} />
          <mesh geometry={lipGeo} material={mouthMat} position={[0, -0.11, 0.152]} />
          <mesh ref={mouth} geometry={mouthGeo} material={mouthMat} position={[0, -0.075, 0.15]} scale={BASE.mouth as unknown as [number, number, number]} />
        </group>
        {me && (
          <mesh position-y={2.25} rotation-x={Math.PI / 2}>
            <torusGeometry args={[0.2, 0.025, 8, 32]} />
            <meshBasicMaterial color={new THREE.Color(2.4, 1.9, 0.7)} toneMapped={false} />
          </mesh>
        )}
      </group>
      {name && (
        <Html position={[0, 2.55, 0]} center pointerEvents="none" zIndexRange={[20, 0]}>
          <div className={me ? 'tag me' : 'tag'}>{name}</div>
        </Html>
      )}
      {bubble && (
        <Html position={[0, 3.2, 0]} center pointerEvents="none" zIndexRange={[30, 21]}>
          <div className="bubble">{bubble}</div>
        </Html>
      )}
    </group>
  );
});
