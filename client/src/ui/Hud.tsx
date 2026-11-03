import { useEffect, useRef, useState } from 'react';
import { FLOORS } from '../../../shared/game.ts';
import { devJump, players, send } from '../net.ts';
import { MAX_STRIKES, PATROLS } from '../../../shared/game.ts';
import { sfx } from '../audio.ts';
import { useGame } from '../store.ts';
import { fx, isTyping } from '../fx.ts';
import { Feed } from './Feed.tsx';
import { Joystick } from './Joystick.tsx';
import { Leaderboard } from './Leaderboard.tsx';
import { LETTERS } from '../../../shared/quiz.ts';

/** Công đức riêng + số lần vi phạm của chính mình (đọc thẳng từ schema). */
function useMe() {
  const [me, setMe] = useState({ merit: 0, strikes: 0 });
  useEffect(() => {
    const t = setInterval(() => {
      const p = players.get(useGame.getState().myId);
      const next = { merit: p?.merit ?? 0, strikes: p?.strikes ?? 0 };
      setMe((m) => (m.merit === next.merit && m.strikes === next.strikes ? m : next));
    }, 200);
    return () => clearInterval(t);
  }, []);
  return me;
}

function Strikes({ n }: { n: number }) {
  return (
    <div className={n >= MAX_STRIKES - 1 ? 'strikes danger' : 'strikes'} title="Vi phạm 3 lần sẽ bị đày xuống tầng sâu hơn">
      ⛓️ Vi phạm {Array.from({ length: MAX_STRIKES }, (_, i) => (i < n ? '●' : '○')).join(' ')}
      <span>{n >= MAX_STRIKES - 1 ? ' — thêm 1 lần là bị đày!' : ` (${MAX_STRIKES} lần → đày xuống tầng dưới)`}</span>
    </div>
  );
}

function QuizPanel() {
  const qz = useGame((s) => s.quiz);
  const phase = qz?.phase;
  const left = qz?.left ?? 0;
  const [min, setMin] = useState(false);
  const n = qz?.n;
  useEffect(() => {
    if (phase === 'ask' && left > 0 && left <= 3) sfx.countdown();
  }, [phase, left]);
  useEffect(() => setMin(false), [n]); // câu hỏi mới thì tự mở lại
  if (!qz || qz.phase === 'wait') return null;
  const reveal = qz.phase === 'reveal';
  if (min)
    return (
      <button className="pill quiz-pill" onClick={() => setMin(false)}>
        ⚖️ Câu {qz.n} · {reveal ? `Đáp án ${LETTERS[qz.ans]}` : `${qz.left}s`} ▸
      </button>
    );
  return (
    <div className={reveal ? 'quiz reveal' : 'quiz'}>
      <button className="close-x" onClick={() => setMin(true)} aria-label="Thu gọn câu hỏi">✕</button>
      <div className="quiz-head">
        <span>⚖️ Phán Quan hỏi · Câu {qz.n}</span>
        <span className={!reveal && qz.left <= 3 ? 'quiz-time hurry' : 'quiz-time'}>{reveal ? 'Đáp án' : `${qz.left}s`}</span>
      </div>
      <div className="quiz-q">{qz.q}</div>
      <ol className="quiz-opts">
        {qz.opts.map((o, i) => (
          <li key={i} className={reveal ? (i === qz.ans ? 'right' : 'wrong') : ''}>
            <b>{LETTERS[i]}</b>
            <span>{o}</span>
            <em>👻 {qz.counts[i]}</em>
          </li>
        ))}
      </ol>
      {!reveal && <div className="quiz-whisper">👺 Quỷ Dối Trá thì thầm: “Đứng ô {LETTERS[qz.whisper]} đi, chắc chắn đúng!”</div>}
    </div>
  );
}

function interact() {
  send('act');
}

/** Giữ nút Tương tác là tự bấm liên tục (server giới hạn ~9 lần/giây). */
let holdTimer: ReturnType<typeof setInterval> | undefined;
function holdStart(e: React.PointerEvent) {
  e.preventDefault();
  interact();
  clearInterval(holdTimer);
  holdTimer = setInterval(interact, 130);
}
function holdEnd() {
  clearInterval(holdTimer);
}

export function Hud() {
  const level = useGame((s) => s.level);
  const progress = useGame((s) => s.progress);
  const need = useGame((s) => s.need);
  const near = useGame((s) => s.near);
  const stats = useGame((s) => s.stats);
  const fading = useGame((s) => s.fading);
  const goal = useGame((s) => s.goal);
  const me = useMe();
  const [topMin, setTopMin] = useState(false);
  const [sideOpen, setSideOpen] = useState(false);
  const chat = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTyping()) {
        if (e.key === 'Escape') (document.activeElement as HTMLElement).blur();
        return;
      }
      if (e.code === 'KeyE') interact();
      if (e.key === 'Enter') {
        e.preventDefault();
        chat.current?.focus();
      }
      if (e.code === 'Space') e.preventDefault();
      if (import.meta.env.DEV) {
        const lv = useGame.getState().level;
        if (e.code === 'BracketRight') devJump(lv + 1); // ] xuống tầng sâu hơn
        if (e.code === 'BracketLeft') devJump(lv - 1); // [ lên tầng trên
      }
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, []);

  if (!level) return null;
  const f = FLOORS[level - 1];
  const noFocus = (e: React.PointerEvent) => e.preventDefault();

  return (
    <>
      <div id="fade" className={fading ? 'show' : ''} />
      {topMin ? (
        <button className="pill top-pill" onClick={() => setTopMin(false)}>
          Tầng {level} · 🪷 {me.merit}/{need} · ⛓️ {me.strikes}/{MAX_STRIKES} ▾
        </button>
      ) : (
      <header className="hud-top">
        <button className="close-x" onClick={() => setTopMin(true)} aria-label="Thu gọn">✕</button>
        <div className="floor-title">Tầng {level} · {f.name} <span className="han">{f.han}</span></div>
        <div className="floor-pun">Tội: {f.sin} — {f.punishment}</div>
        <div className="task">🎯 {f.def.task}</div>
        {PATROLS[level] && <div className="task danger-tip">⚠ Né Ngưu Đầu, Mã Diện đi tuần — đụng phải là vi phạm{level === 13 ? '; rơi xuống Ao Máu cũng vậy' : ''}.</div>}
        {goal && <div className="goal">{goal}</div>}
        <div className="prog-label">
          <span>🪷 Công đức của bạn</span>
          <span>{me.merit}/{need} → {level === 1 ? 'qua cầu Nại Hà' : `lên tầng ${level - 1}`}</span>
        </div>
        <div className="prog"><div className="prog-bar" style={{ width: `${(me.merit / need) * 100}%` }} /></div>
        <div className="prog-label shared">
          <span>Cả tầng cùng làm: {progress}/{need}</span>
          <span>ai làm nấy hưởng</span>
        </div>
        <Strikes n={me.strikes} />
      </header>
      )}

      <QuizPanel />
      <button className="side-toggle" onClick={() => setSideOpen((v) => !v)} aria-label="Mở bảng">☰</button>
      <aside className={sideOpen ? 'side open' : 'side'}>
        <button className="close-x" onClick={() => setSideOpen(false)} aria-label="Đóng bảng">✕</button>
        <div className="panel">
          <h3>🏯 18 tầng địa ngục</h3>
          <ol className="floors">
            {FLOORS.map((fl) => (
              <li
                key={fl.level}
                className={fl.level === level ? 'cur' : ''}
                title={`${fl.sin} — ${fl.punishment}`}
                style={import.meta.env.DEV ? { cursor: 'pointer' } : undefined}
                onClick={import.meta.env.DEV ? () => devJump(fl.level) : undefined}
              >
                <span className="n">{fl.level}</span>
                <span className="nm">{fl.name.replace('Địa Ngục ', '')}</span>
                <span>👻 {stats[fl.level - 1] ?? 0}</span>
              </li>
            ))}
          </ol>
        </div>
        <div className="panel">
          <h3>🏆 Sám hối nhiều nhất</h3>
          <Leaderboard limit={5} />
        </div>
        <div className="panel feed-card">
          <h3>📜 Sổ Sinh Tử</h3>
          <Feed />
        </div>
      </aside>

      <Joystick />
      <div className="hud-bottom">
        {near && <div className="hint">{near}</div>}
        <div className="actions">
          <button
            className={near ? 'act use ready' : 'act use'}
            onPointerDown={holdStart}
            onPointerUp={holdEnd}
            onPointerLeave={holdEnd}
            onPointerCancel={holdEnd}
            onContextMenu={(e) => e.preventDefault()}
          >
            ✋ Tương tác <kbd>E</kbd>
          </button>
          <button
            className="act jump"
            onPointerDown={(e) => {
              noFocus(e);
              fx.jumpRequested = true;
            }}
          >
            ⤴ Nhảy <kbd>Space</kbd>
          </button>
          <form
            className="chat"
            onSubmit={(e) => {
              e.preventDefault();
              const v = chat.current!.value.trim();
              if (v) send('chat', v);
              chat.current!.value = '';
              chat.current!.blur();
            }}
          >
            <input ref={chat} maxLength={80} placeholder="Enter để nói với các hồn cùng tầng..." autoComplete="off" />
          </form>
        </div>
        <p className="tip touch-tip">Kéo cần bên trái để đi · giữ ✋ để làm liên tục · vuốt màn hình xoay camera</p>
        <p className="tip"><kbd>WASD</kbd> di chuyển · <kbd>Shift</kbd> chạy · <kbd>Space</kbd> nhảy · kéo chuột xoay camera · cuộn để zoom · bấm xuống đất để đi tới</p>
      </div>
    </>
  );
}
