// Chánh Điện: các oan hồn quỳ ở các ô trong điện, lần lượt lên trước án Diêm Vương khai tội.
// Cả điện cùng nghe từng lượt khai; chỉ người đang khai mới được chọn lời khai.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Bloom, EffectComposer, Noise, ToneMapping, Vignette } from '@react-three/postprocessing';
import { BlendFunction, ToneMappingMode } from 'postprocessing';
import type { Room } from '@colyseus/sdk';
import * as THREE from 'three';
import { FLOORS, type JudgeResponse } from '../../../shared/game.ts';
import { CONFESS_SPOT, HALL_CELLS, type CourtLine, type Who } from '../../../shared/court.ts';
import { ambience, hushAnnouncer, sfx, speak, stopSpeak, type Speaker } from '../audio.ts';
import { enterHall, enterWithTicket, hallSouls } from '../net.ts';
import { toast, useGame } from '../store.ts';
import { NAMES } from '../tribunal.ts';
import { Convict } from './Convict.tsx';
import { Court, SamLaHall } from './Netherworld.tsx';

/* ---------------- Cảnh 3D ---------------- */
const EXIT = { x: 0, z: 22 };

/** Một khung hình cố định: thấy cả ngai Diêm Vương, chỗ khai tội và mọi hồn đang quỳ. */
const CAM_POS = new THREE.Vector3(0, 11.5, 24);
const CAM_LOOK = new THREE.Vector3(0, 1.5, -1);
function CameraRig() {
  const { camera, size } = useThree();
  // đẩy khung hình lên trên để hàng oan hồn không bị khung thoại ở dưới che mất
  useEffect(() => {
    const cam = camera as THREE.PerspectiveCamera;
    cam.setViewOffset(size.width, size.height, 0, size.height * 0.15, size.width, size.height);
    return () => cam.clearViewOffset();
  }, [camera, size.width, size.height]);
  useFrame(() => {
    camera.position.copy(CAM_POS);
    camera.lookAt(CAM_LOOK);
  });
  return null;
}

/** Một hồn trong điện: quỳ ở ô của mình, tới lượt thì đi lên trước án, khai xong thì bị áp giải ra cổng. */
function HallFigure({ id, me }: { id: string; me: boolean }) {
  const ref = useRef<THREE.Group>(null);
  const s = hallSouls.get(id);
  useFrame((_, rawDt) => {
    const g = ref.current, cur = hallSouls.get(id);
    if (!g || !cur) return;
    const cell = HALL_CELLS[cur.cell] ?? HALL_CELLS[0];
    const tgt = cur.state === 'up' ? CONFESS_SPOT : cur.state === 'done' ? EXIT : cell;
    if (!g.userData.init) {
      g.userData.init = true;
      g.position.set(cell.x, 0, cell.z);
      g.rotation.y = Math.PI;
    }
    const dx = tgt.x - g.position.x, dz = tgt.z - g.position.z, d = Math.hypot(dx, dz);
    const step = Math.min(d, 2.6 * Math.min(rawDt, 0.05));
    if (d > 0.05) {
      g.position.x += (dx / d) * step;
      g.position.z += (dz / d) * step;
    }
    const walking = d > 0.15;
    g.userData.kneel = !walking;
    g.userData.lean = walking ? 0.5 : 0;
    const face = walking ? Math.atan2(dx, dz) : Math.PI; // quỳ thì quay mặt về phía ngai Diêm Vương
    g.rotation.y += (((face - g.rotation.y + Math.PI * 3) % (Math.PI * 2)) - Math.PI) * 0.15;
  });
  if (!s) return null;
  return <Convict ref={ref} id={id} hue={s.hue} name={s.name} me={me} />;
}

function Scene({ ids, myId }: { ids: string[]; myId: string }) {
  return (
    <Canvas shadows dpr={[1, 1.75]} camera={{ fov: 55, position: [0, 9.6, 23] }}>
      {/* đêm trăng âm phủ: lạnh, mờ, sương xanh */}
      <color attach="background" args={['#04060c']} />
      <fogExp2 attach="fog" args={['#0a0e1c', 0.016]} />
      <hemisphereLight args={['#8a9ad0', '#1a0c10', 0.75]} />
      <ambientLight color="#8090c0" intensity={0.3} />
      <SamLaHall />
      <Court />
      {/* các ô quỳ */}
      {HALL_CELLS.map((c, i) => (
        <mesh key={i} position={[c.x, 0.02, c.z]} rotation-x={-Math.PI / 2}>
          <planeGeometry args={[1.3, 1.3]} />
          <meshStandardMaterial color="#2a0c08" roughness={0.9} />
        </mesh>
      ))}
      <mesh position={[CONFESS_SPOT.x, 0.025, CONFESS_SPOT.z]} rotation-x={-Math.PI / 2}>
        <circleGeometry args={[0.9, 32]} />
        <meshStandardMaterial color="#3a0a06" emissive="#2a0400" roughness={0.6} />
      </mesh>
      {ids.map((id) => (
        <HallFigure key={id} id={id} me={id === myId} />
      ))}
      <CameraRig />
      <EffectComposer>
        <Bloom mipmapBlur luminanceThreshold={0.85} intensity={1} />
        <Vignette offset={0.2} darkness={0.85} />
        <Noise premultiply blendFunction={BlendFunction.OVERLAY} opacity={0.07} />
        <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      </EffectComposer>
    </Canvas>
  );
}

/* ---------------- Giao diện ---------------- */
function lineSfx(l: CourtLine) {
  if (l.text.startsWith('Phán!')) sfx.gong();
  else if (l.text.includes('Gương Nghiệt')) sfx.whoosh();
  else if (l.who === 'hac') sfx.chain();
  else if (l.opts) sfx.heartbeat();
}

export default function Tribunal() {
  const name = useGame((s) => s.soulName);
  const hue = useMemo(() => Math.floor(Math.random() * 360), []);
  const [ids, setIds] = useState<string[]>([]);
  const [turn, setTurn] = useState('');
  const [line, setLine] = useState<CourtLine | null>(null);
  const [verdict, setVerdict] = useState<(JudgeResponse & { at: number }) | null>(null);
  const [busy, setBusy] = useState(false);
  const [, tick] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const room = useRef<Room | null>(null);
  const lastN = useRef(0);

  // vào điện
  useEffect(() => {
    let alive = true;
    ambience(0);
    const hush = setInterval(() => hushAnnouncer(3000), 1000); // không cho loa đè lời Diêm Vương
    enterHall(name, hue, {
      souls: setIds,
      turn: setTurn,
      line: setLine,
      sentenced: (r) => {
        sfx.banish();
        setVerdict({ ...r, at: Date.now() });
      },
    })
      .then((r) => {
        if (!alive) return void r.leave();
        room.current = r;
      })
      .catch(() => {
        toast('Chánh Điện đang đóng cửa... thử lại sau');
        useGame.getState().set({ screen: 'judge' });
      });
    const t = setInterval(() => tick((n) => n + 1), 500); // cập nhật hàng chờ
    return () => {
      alive = false;
      clearInterval(hush);
      clearInterval(t);
      stopSpeak();
      room.current?.leave();
      room.current = null;
    };
  }, [name, hue]);

  // dòng thoại mới: âm thanh + giọng đọc; chữ hiện ngay cả câu (không chạy từng chữ).
  // Chỉ phát khi sang dòng mới (line.n) — server phát lại cùng dòng mỗi giây để đếm ngược.
  const lineN = line?.n ?? 0;
  useEffect(() => {
    if (!line || line.n === lastN.current) return;
    lastN.current = line.n;
    lineSfx(line);
    if (line.who !== 'me') speak(line.text, line.who as Speaker);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lineN]);

  // nhận án: tự xuống tầng sau vài giây
  useEffect(() => {
    if (!verdict) return;
    const t = setTimeout(descend, 9000);
    return () => clearTimeout(t);
  }, [verdict]);

  async function descend() {
    if (!verdict || busy) return;
    setBusy(true);
    try {
      useGame.getState().set({ soulId: verdict.id });
      await room.current?.leave();
      room.current = null;
      await enterWithTicket(verdict.level, verdict.ticket);
      useGame.getState().set({ screen: 'game' });
    } catch {
      toast('Lạc đường xuống tầng... hãy vào điện lại');
      useGame.getState().set({ screen: 'judge' });
    }
  }

  const myId = room.current?.sessionId ?? '';
  const mine = !!myId && turn === myId;
  const queue = ids
    .map((id) => ({ id, s: hallSouls.get(id)! }))
    .filter((q) => q.s && q.s.state !== 'done')
    // đúng thứ tự server gọi: người đang khai, rồi người thật (đến trước lên trước), rồi oan hồn ảo
    .sort((a, b) => Number(b.id === turn) - Number(a.id === turn) || Number(a.s.bot) - Number(b.s.bot) || a.s.at - b.s.at);
  const myPos = queue.findIndex((q) => q.id === myId);
  const confessor = hallSouls.get(turn);
  const answering = mine && !!line?.opts && !verdict;
  useEffect(() => {
    if (answering) input.current?.focus();
  }, [answering, line?.n]);
  const who = line?.who ?? null;
  const vf = verdict ? FLOORS[verdict.level - 1] : null;

  return (
    <section className="tribunal">
      <div className="view">
        <Scene ids={ids} myId={myId} />
      </div>

      <aside className="hall-queue">
        <h3>⚖️ Chánh Điện · Sâm La Điện</h3>
        <p className="small">Các oan hồn quỳ chờ. Lần lượt từng người lên trước án khai tội, Diêm Vương phán tầng theo mức độ tội.</p>
        <ol>
          {queue.map((q, i) => (
            <li key={q.id} className={q.id === turn ? 'cur' : q.id === myId ? 'me' : ''}>
              <span className="dot" style={{ background: `hsl(${q.s.hue} 55% 45%)` }} />
              <span className="nm">{q.s.name}{q.id === myId ? ' (bạn)' : q.s.bot ? ' · oan hồn' : ''}</span>
              <span className="st">{q.id === turn ? 'đang khai' : `#${i + 1}`}</span>
            </li>
          ))}
        </ol>
        {!verdict && myPos > 0 && !mine && <p className="small">Còn {myPos} hồn nữa mới tới lượt bạn. Hãy quỳ đợi…</p>}
      </aside>

      {verdict && vf ? (
        <div className="dialog verdict">
          <div className="dialog-name">Phán quyết</div>
          <div className="dialog-text">
            Bạn bị đày xuống <b>Tầng {verdict.level} · {vf.name}</b>.<br />
            <span className="small">Tội: {vf.sin} — {vf.punishment}</span>
          </div>
          <button className="primary descend" disabled={busy} onClick={descend}>
            ⛓️ Nhận án & xuống Tầng {verdict.level}
          </button>
        </div>
      ) : line ? (
        <div className={`dialog ${who === 'me' ? 'me' : who}`}>
          <div className="dialog-name">{who === 'me' ? line.name : NAMES[who as Speaker]}</div>
          <div className="dialog-text">{who === 'me' ? `“${line.text}”` : line.text}</div>
          {line.opts && (mine ? (
            // chỉ người đang khai mới được chọn lời khai
            <div className="dialog-answer">
              <div className="chips">
                {line.opts.map((o, i) => (
                  <button type="button" key={i} onClick={() => room.current?.send('answer', i)}>{o}</button>
                ))}
              </div>
              <div className="dialog-next">Tới lượt bạn — chọn gợi ý hoặc tự khai ở ô bên dưới · còn {line.left ?? 0}s</div>
            </div>
          ) : (
            // người khác chỉ nghe và nhìn
            <div className="dialog-next">⏳ {confessor?.name ?? 'Hồn'} đang khai…</div>
          ))}
        </div>
      ) : (
        <div className="dialog">
          <div className="dialog-text">{ids.length ? 'Hắc Bạch Vô Thường đang áp giải hồn kế tiếp…' : 'Đang vào Chánh Điện…'}</div>
        </div>
      )}
      {/* ô trả lời Diêm Vương: chỉ mở khi tới lượt mình bị hỏi */}
      {!verdict && (
        <form
          className={answering ? 'hall-input answering' : 'hall-input'}
          onSubmit={(e) => {
            e.preventDefault();
            const v = input.current!.value.trim();
            if (!v || !answering) return;
            room.current?.send('answerText', v);
            input.current!.value = '';
          }}
        >
          <input
            ref={input}
            maxLength={90}
            disabled={!answering}
            placeholder={answering ? 'Trả lời Diêm Vương bằng lời của ngươi…' : mine ? 'Nghe Diêm Vương hỏi…' : 'Chờ tới lượt bạn lên khai…'}
            autoComplete="off"
          />
          <button className="primary" type="submit" disabled={!answering}>Khai</button>
        </form>
      )}
    </section>
  );
}
