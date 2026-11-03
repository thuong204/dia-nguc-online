// Điện Diêm Vương: Hắc Bạch Vô Thường dẫn hồn vào, Diêm La Vương hỏi tội rồi phán tầng.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Bloom, EffectComposer, ToneMapping, Vignette } from '@react-three/postprocessing';
import { ToneMappingMode } from 'postprocessing';
import * as THREE from 'three';
import { FLOORS } from '../../../shared/game.ts';
import { ambience, sfx, speak, stopSpeak, type Speaker } from '../audio.ts';
import { enterWithTicket, requestJudgement } from '../net.ts';
import { toast, useGame } from '../store.ts';
import { NAMES, opening, questions, react, verdict, type Line } from '../tribunal.ts';
import { Ghost } from './Ghost.tsx';
import { Flame, darkStone } from './World.tsx';
import { textTexture } from './textures.ts';

/* ---------------- Cảnh 3D ---------------- */
const SPOT: Record<Speaker | 'me', [number, number, number]> = {
  diem: [0, 3.6, -6],
  phan: [-3.6, 2.4, -5],
  hac: [-2.4, 1.5, 1],
  bach: [2.4, 1.5, 1],
  manh: [0, 1.5, 0],
  me: [0, 1.2, 2.2],
};

const lacquer = new THREE.MeshStandardMaterial({ color: '#5a0d0a', roughness: 0.4, metalness: 0.2 });
const gold = new THREE.MeshStandardMaterial({ color: '#c8902a', metalness: 0.85, roughness: 0.3, emissive: '#3a2000' });

function Hall() {
  const sign = useMemo(() => textTexture(['閻羅殿'], { w: 1024, h: 300, size: 220, color: '#ffd27a', bg: '#2a0505', glow: '#ff6a00' }), []);
  const mirror = useRef<THREE.MeshBasicMaterial>(null);
  useFrame(({ clock }) => mirror.current?.color.setRGB(0.6 + Math.sin(clock.elapsedTime * 1.3) * 0.2, 1.4, 2.2));
  return (
    <>
      <mesh rotation-x={-Math.PI / 2} receiveShadow material={darkStone}><planeGeometry args={[40, 40]} /></mesh>
      {/* thảm đỏ dẫn tới ngai */}
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.02, 0]}><planeGeometry args={[3, 22]} /><meshStandardMaterial color="#4a0606" /></mesh>
      {[-6.5, 6.5].map((x) =>
        [-9, -4, 1, 6].map((z) => (
          <group key={`${x}${z}`} position={[x, 0, z]}>
            <mesh material={lacquer} position-y={5} castShadow><cylinderGeometry args={[0.5, 0.55, 10, 16]} /></mesh>
            <mesh material={gold} position-y={0.2}><cylinderGeometry args={[0.8, 0.9, 0.4, 16]} /></mesh>
            <Flame position={[x > 0 ? -0.7 : 0.7, 3.2, 0]} scale={0.6} light={8} />
          </group>
        )),
      )}
      {/* bệ và ngai */}
      <mesh material={darkStone} position={[0, 0.6, -7]}><boxGeometry args={[9, 1.2, 5]} /></mesh>
      <mesh material={gold} position={[0, 1.25, -4.55]}><boxGeometry args={[9, 0.1, 0.1]} /></mesh>
      <mesh material={lacquer} position={[0, 2.2, -5.3]} castShadow><boxGeometry args={[5, 1.6, 1.4]} /></mesh>
      <mesh material={gold} position={[0, 3.02, -5.3]}><boxGeometry args={[5.1, 0.06, 1.5]} /></mesh>
      {/* Sổ Sinh Tử mở trên bàn */}
      <mesh position={[0.9, 3.08, -5.1]} rotation-x={-Math.PI / 2}><planeGeometry args={[1.2, 0.8]} /><meshStandardMaterial color="#e8d8a8" /></mesh>
      <mesh material={lacquer} position={[0, 4.5, -8.8]}><boxGeometry args={[4, 6, 0.6]} /></mesh>
      <mesh position={[0, 9, -8.4]}><planeGeometry args={[6, 1.75]} /><meshBasicMaterial map={sign} toneMapped={false} /></mesh>
      {/* Gương Nghiệt */}
      <group position={[5, 3.4, -6.5]} rotation-y={-0.5}>
        <mesh material={gold}><torusGeometry args={[1.3, 0.15, 10, 40]} /></mesh>
        <mesh><circleGeometry args={[1.25, 40]} /><meshBasicMaterial ref={mirror} toneMapped={false} /></mesh>
        <mesh material={darkStone} position-y={-2.2}><boxGeometry args={[0.4, 2.4, 0.4]} /></mesh>
      </group>
      <pointLight color="#ff5a20" intensity={60} distance={30} position={[0, 7, -3]} />
      <pointLight color="#4aa0ff" intensity={14} distance={10} position={[4.5, 3.4, -5.5]} />
    </>
  );
}

function CameraRig({ who }: { who: Speaker | 'me' }) {
  const look = useRef(new THREE.Vector3(0, 3, -4));
  useFrame(({ camera, clock }, dt) => {
    const t = SPOT[who];
    const k = 1 - Math.exp(-2 * Math.min(dt, 0.05));
    look.current.lerp(new THREE.Vector3(t[0], t[1], t[2]), k);
    const goal = new THREE.Vector3(t[0] * 0.55 + Math.sin(clock.elapsedTime * 0.2) * 0.6, 3.4, 9.5);
    camera.position.lerp(goal, k * 0.6);
    camera.lookAt(look.current);
  });
  return null;
}

function Scene({ who, name, hue }: { who: Speaker | 'me'; name: string; hue: number }) {
  return (
    <Canvas shadows dpr={[1, 1.75]} camera={{ fov: 50, position: [0, 3.4, 14] }}>
      <color attach="background" args={['#0a0203']} />
      <fogExp2 attach="fog" args={['#0a0203', 0.045]} />
      <hemisphereLight args={['#ff8a5a', '#100303', 0.5]} />
      <Hall />
      <group position={[0, 1.3, -6]}><Ghost hue={20} body="#6a1410" hat="crown" angryEyes scale={2} /></group>
      <group position={[-3.6, 1.2, -5]} rotation-y={0.4}><Ghost hue={0} body="#2a2a4a" hat="non" scale={1.2} /></group>
      <group position={[-2.4, 0, 1]} rotation-y={0.5}><Ghost hue={0} body="#151515" hat="tall" hatColor="#111" hatText="天下太平" angryEyes scale={1.25} /></group>
      <group position={[2.4, 0, 1]} rotation-y={-0.5}><Ghost hue={0} body="#eeeeee" hat="tall" hatColor="#eeeeee" hatText="一見生財" tongue scale={1.25} /></group>
      <group position={[0, 0, 2.2]} rotation-y={Math.PI}><Ghost hue={hue} name={name} me /></group>
      <CameraRig who={who} />
      <EffectComposer>
        <Bloom mipmapBlur luminanceThreshold={0.9} intensity={0.9} />
        <Vignette offset={0.2} darkness={0.85} />
        <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      </EffectComposer>
    </Canvas>
  );
}

/* ---------------- Hộp thoại ---------------- */
export default function Tribunal() {
  const name = useGame((s) => s.soulName);
  const hue = useMemo(() => Math.floor(Math.random() * 360), []);
  const [lines, setLines] = useState<Line[]>(() => opening(name));
  const [i, setI] = useState(0);
  const [shown, setShown] = useState(0);
  const [answer, setAnswer] = useState('');
  const [busy, setBusy] = useState(false);
  const qs = useRef<Line[]>(questions());
  const answers = useRef<string[]>([]);
  const result = useRef<{ level: number; ticket: string; at: number } | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const line = lines[i];
  const typing = !!line && shown < line.text.length;
  const finished = i === lines.length - 1 && !!result.current && !typing;

  useEffect(() => {
    ambience(0);
    return () => stopSpeak();
  }, []);

  // Mỗi dòng mới: hiệu ứng, giọng đọc, chạy chữ
  useEffect(() => {
    if (!line) return;
    setShown(0);
    if (line.sfx) sfx[line.sfx]();
    if (line.who !== 'me') speak(line.text, line.who);
    let n = 0;
    const t = setInterval(() => {
      n += 1;
      if (n % 3 === 0) sfx.tick();
      setShown(n);
      if (n >= line.text.length) clearInterval(t);
    }, 26);
    return () => clearInterval(t);
  }, [line]);

  useEffect(() => {
    if (line?.ask && !typing) input.current?.focus();
  }, [line, typing]);

  async function advance() {
    if (!line || busy) return;
    if (typing) return setShown(line.text.length);
    if (line.ask) return;
    if (finished) return descend();
    if (i < lines.length - 1) return setI(i + 1);
    // hết đoạn hiện tại → câu hỏi tiếp theo hoặc phán quyết
    const next = qs.current[answers.current.length];
    if (next) {
      setLines((l) => [...l, next]);
      setI(i + 1);
    } else {
      setBusy(true);
      try {
        const r = await requestJudgement(name, answers.current.join('. '));
        result.current = { ...r, at: Date.now() };
        setLines((l) => [...l, ...verdict(name, r.level)]);
        setI(i + 1);
      } catch {
        toast('Âm phủ đang quá tải, thử lại sau nhé!');
      }
      setBusy(false);
    }
  }

  function submit(text: string) {
    const a = text.trim().slice(0, 90);
    if (!a || !line?.ask) return;
    answers.current.push(a);
    setAnswer('');
    setLines((l) => [...l, { who: 'me', text: a }, react(a)]);
    setI(i + 1);
  }

  async function descend() {
    const r = result.current!;
    setBusy(true);
    sfx.banish();
    try {
      // vé chỉ có hạn 60 giây — xin vé mới nếu người chơi đọc lâu
      const t = Date.now() - r.at > 50_000 ? await requestJudgement(name, answers.current.join('. ')) : r;
      await enterWithTicket(t.level, t.ticket);
      useGame.getState().set({ screen: 'game' });
    } catch {
      toast('Lạc đường xuống tầng... thử lại nhé');
      setBusy(false);
    }
  }

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if ((e.key === 'Enter' || e.key === ' ') && document.activeElement?.tagName !== 'INPUT') {
        e.preventDefault();
        advance();
      }
    };
    addEventListener('keydown', k);
    return () => removeEventListener('keydown', k);
  });

  const who = line?.who ?? 'diem';
  const isMe = who === 'me';
  const level = result.current?.level;

  return (
    <section className="tribunal">
      <div className="view">
        <Scene who={who} name={name} hue={hue} />
      </div>
      {line && (
        <div className={`dialog ${isMe ? 'me' : who}`} onClick={advance}>
          <div className="dialog-name">{who === 'me' ? name : NAMES[who]}</div>
          <div className="dialog-text">{isMe ? `“${line.text}”` : line.text.slice(0, shown)}</div>
          {line.ask && !typing ? (
            <form
              className="dialog-answer"
              onClick={(e) => e.stopPropagation()}
              onSubmit={(e) => {
                e.preventDefault();
                submit(answer);
              }}
            >
              <div className="chips">
                {line.chips?.map((c) => (
                  <button type="button" key={c} onClick={() => submit(c)}>{c}</button>
                ))}
              </div>
              <div className="row">
                <input ref={input} value={answer} onChange={(e) => setAnswer(e.target.value)} maxLength={90} placeholder="Hoặc tự khai bằng lời của ngươi…" />
                <button className="primary" type="submit">Khai</button>
              </div>
            </form>
          ) : finished ? (
            <button className="primary descend" disabled={busy} onClick={(e) => (e.stopPropagation(), descend())}>
              ⛓️ Nhận án & xuống Tầng {level} · {FLOORS[level! - 1].name}
            </button>
          ) : (
            <div className="dialog-next">{busy ? 'Diêm Vương đang lật Sổ Sinh Tử…' : typing ? '' : 'Bấm hoặc Enter ▶'}</div>
          )}
        </div>
      )}
    </section>
  );
}
