// Điện Diêm Vương: Hắc Bạch Vô Thường dẫn hồn vào, Diêm La Vương hỏi tội rồi phán tầng.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Bloom, EffectComposer, ToneMapping, Vignette } from '@react-three/postprocessing';
import { ToneMappingMode } from 'postprocessing';
import * as THREE from 'three';
import { FLOORS } from '../../../shared/game.ts';
import { ambience, hushAnnouncer, sfx, speak, stopSpeak, type Speaker } from '../audio.ts';
import { enterWithTicket, requestJudgement } from '../net.ts';
import { toast, useGame } from '../store.ts';
import { NAMES, opening, questions, react, verdict, type Line } from '../tribunal.ts';
import { Ghost } from './Ghost.tsx';
import { Court, SamLaHall } from './Netherworld.tsx';

/* ---------------- Cảnh 3D ---------------- */
const SPOT: Record<Speaker | 'me', [number, number, number]> = {
  diem: [0, 4.9, -8.2],
  phan: [-3.3, 3.1, -6.6],
  hac: [-2.1, 2.5, 1.6],
  bach: [2.1, 2.5, 1.6],
  manh: [0, 1.5, 0],
  me: [0, 1.4, 2.8],
};

function CameraRig({ who }: { who: Speaker | 'me' }) {
  const look = useRef(new THREE.Vector3(0, 3, -4));
  useFrame(({ camera, clock }, dt) => {
    const t = SPOT[who];
    const k = 1 - Math.exp(-1.8 * Math.min(dt, 0.05));
    look.current.lerp(new THREE.Vector3(t[0], t[1], t[2]), k);
    // camera lùi về phía cửa điện, hơi lệch theo người đang nói
    const near = who === 'diem' ? 8.5 : who === 'phan' ? 7.5 : 6.5;
    const goal = new THREE.Vector3(t[0] * 0.5 + Math.sin(clock.elapsedTime * 0.15) * 0.5, 2.6 + t[1] * 0.35, Math.min(11, t[2] + near));
    camera.position.lerp(goal, k * 0.7);
    camera.lookAt(look.current);
  });
  return null;
}

function Scene({ who, hue }: { who: Speaker | 'me'; hue: number }) {
  return (
    <Canvas shadows dpr={[1, 1.75]} camera={{ fov: 48, position: [0, 3.2, 15] }}>
      <color attach="background" args={['#070203']} />
      <fogExp2 attach="fog" args={['#070203', 0.038]} />
      <hemisphereLight args={['#ff9a6a', '#140405', 0.45]} />
      <ambientLight intensity={0.12} />
      <SamLaHall />
      <Court />
      <group position={[0, 0, 2.8]} rotation-y={Math.PI}><Ghost hue={hue} me /></group>
      <CameraRig who={who} />
      <EffectComposer>
        <Bloom mipmapBlur luminanceThreshold={0.85} intensity={1} />
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
  const result = useRef<{ id: string; level: number; ticket: string; at: number } | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const line = lines[i];
  const typing = !!line && shown < line.text.length;
  const finished = i === lines.length - 1 && !!result.current && !typing;

  useEffect(() => {
    ambience(0);
    const hush = setInterval(() => hushAnnouncer(3000), 1000); // không cho loa đè lời Diêm Vương
    return () => {
      clearInterval(hush);
      stopSpeak();
    };
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
      useGame.getState().set({ soulId: t.id });
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
        <Scene who={who} hue={hue} />
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
