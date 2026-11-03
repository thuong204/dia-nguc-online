import { useEffect, useRef, useState } from 'react';
import { FLOORS } from '../../../shared/game.ts';
import { devJump, players, send } from '../net.ts';
import { PAIN, PAIN_DUR, TORMENTS } from '../../../shared/game.ts';
import { useGame } from '../store.ts';
import { fx, isTyping } from '../fx.ts';
import { Feed } from './Feed.tsx';
import { Joystick } from './Joystick.tsx';
import { Leaderboard } from './Leaderboard.tsx';

/** Cọc của mình ở Pháp Trường & số hiệp đã chịu (đọc thẳng từ schema). */
function useMeExec() {
  const [v, setV] = useState({ slot: -1, served: 0, esc: 0, left: 0 });
  useEffect(() => {
    const t = setInterval(() => {
      const st = useGame.getState();
      const p = players.get(st.myId);
      const slot = p?.slot ?? -1, served = p?.served ?? 0, esc = p?.esc ?? 0;
      const left = st.seizeAt && !esc && slot < 0 ? Math.max(0, Math.ceil((st.seizeAt - Date.now()) / 1000)) : 0;
      setV((o) => (o.slot === slot && o.served === served && o.esc === esc && o.left === left ? o : { slot, served, esc, left }));
    }, 150);
    return () => clearInterval(t);
  }, []);
  return v;
}

const accept = () => send('accept');

/** Màn hình khi chính mình đang chịu hình: viền máu, chữ to, thanh đếm ngược. */
function PainOverlay({ level, served }: { level: number; served: number }) {
  const pain = useGame((s) => s.pain);
  const seq = useGame((s) => s.painSeq);
  const need = useGame((s) => s.need);
  const round = Math.min(need, served + 1);
  if (!pain) return null;
  const dur = PAIN_DUR[pain] ?? 3;
  return (
    <div className="pain-veil" key={seq}>
      <div className="cine-bar top" />
      <div className="cine-bar bottom" />
      <div className="pain-box">
        <div className="pain-title">⛓️ Hình phạt · {FLOORS[level - 1].name}</div>
        <div className="pain-what">{TORMENTS[level - 1]}</div>
        <div className="pain-why">
          {pain === PAIN.enter ? 'Pháp Trường thi hành án — ' : ''}Hiệp {round}/{need}
          {round >= need ? (level === 1 ? ' · chịu xong là được đầu thai' : ` · chịu xong bị giải lên tầng ${level - 1}`) : ''}
        </div>
        <div className="pain-bar"><i style={{ animationDuration: `${dur}s` }} /></div>
      </div>
    </div>
  );
}

export function Hud() {
  const level = useGame((s) => s.level);
  const need = useGame((s) => s.need);
  const stats = useGame((s) => s.stats);
  const fading = useGame((s) => s.fading);
  const painNow = useGame((s) => s.pain);
  const ex = useMeExec();
  const mine = ex.slot >= 0;
  const led = !mine && ex.esc > 0;
  const done = !mine && !led && ex.served >= need; // chịu xong, đang chờ bấm E để đi tiếp
  const nextTxt = level === 1 ? 'qua cầu Nại Hà đầu thai' : `lên tầng ${level - 1}`;
  const [topMin, setTopMin] = useState(false);
  const [sideOpen, setSideOpen] = useState(false);
  const chat = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTyping()) {
        if (e.key === 'Escape') (document.activeElement as HTMLElement).blur();
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        chat.current?.focus();
      }
      if (e.code === 'KeyE') accept();
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
  // đang chịu hình: ẩn hết giao diện, chỉ còn khung phim + phụ đề
  if (painNow)
    return (
      <>
        <div id="fade" className={fading ? 'show' : ''} />
        <PainOverlay level={level} served={ex.served} />
      </>
    );
  const f = FLOORS[level - 1];
  const noFocus = (e: React.PointerEvent) => e.preventDefault();

  return (
    <>
      <div id="fade" className={fading ? 'show' : ''} />
      <PainOverlay level={level} served={ex.served} />
      {topMin ? (
        <button className="pill top-pill" onClick={() => setTopMin(false)}>
          Tầng {level} · {mine ? `⛓️ hiệp ${ex.served}/${need}` : done ? `✅ bấm E ${nextTxt}` : led ? '⛓️ đang bị áp giải' : '🙏 bấm E nhận tội'} ▾
        </button>
      ) : (
      <header className="hud-top">
        <button className="close-x" onClick={() => setTopMin(true)} aria-label="Thu gọn">✕</button>
        <div className="floor-title">Tầng {level} · {f.name} <span className="han">{f.han}</span></div>
        <div className="floor-pun">Tội: {f.sin} — {f.punishment}</div>
        <div className="task">
          {mine
            ? `⛓️ Bạn đã bị trói lên cọc Pháp Trường. Chịu đủ ${need} hiệp → ${level === 1 ? 'qua cầu Nại Hà đầu thai' : `giải lên tầng ${level - 1}`}.`
            : done
              ? `✅ Đã chịu đủ ${need} hiệp hình phạt. Bạn được tự do đi lại — bấm E khi sẵn sàng ${nextTxt}.`
              : led
              ? `⛓️ ${ex.esc === 2 ? 'Ngươi chống cự — b' : 'B'}ị Ngưu Đầu Mã Diện áp giải ra Pháp Trường. Cọc bận thì đứng chờ tới lượt.`
              : `🙏 Bấm E (hoặc nút “Nhận tội”) ở bất cứ đâu — quỷ sai sẽ áp giải bạn ra cọc. Chịu đủ ${need} hiệp → ${level === 1 ? 'được đầu thai' : `lên tầng ${level - 1}`}.`}
        </div>
        {mine && (
          <>
            <div className="prog-label">
              <span>⛓️ Hình phạt đã chịu</span>
              <span>{ex.served}/{need} hiệp</span>
            </div>
            <div className="prog"><div className="prog-bar" style={{ width: `${(ex.served / need) * 100}%` }} /></div>
          </>
        )}
      </header>
      )}

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
                <span className="nm">{fl.name.replace(' Địa Ngục', '')}</span>
                <span>👻 {stats[fl.level - 1] ?? 0}</span>
              </li>
            ))}
          </ol>
        </div>
        <div className="panel">
          <h3>🏆 Chịu hình nhiều tầng nhất</h3>
          <Leaderboard limit={5} />
        </div>
        <div className="panel feed-card">
          <h3>📜 Sổ Sinh Tử</h3>
          <Feed />
        </div>
      </aside>

      <Joystick />
      <div className="hud-bottom">
        {!mine && !led && !done && ex.left > 0 && <div className="hint">⏳ Còn {ex.left}s — không nhận tội sẽ bị coi là chống cự, quỷ sai tới lôi đi!</div>}
        {led && <div className="hint">⛓️ {ex.esc === 2 ? 'Chống cự vô ích! ' : ''}Đang bị áp giải ra Pháp Trường…</div>}
        <div className="actions">
          {!mine && !led && (
            <button className="act use ready" onPointerDown={(e) => { noFocus(e); accept(); }}>
              {done ? (level === 1 ? '🌸 Đi đầu thai' : `⬆️ Lên tầng ${level - 1}`) : '🙏 Nhận tội'} <kbd>E</kbd>
            </button>
          )}
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
        <p className="tip touch-tip">Giữa các hiệp được nghỉ: kéo cần bên trái để đi · vuốt màn hình xoay camera</p>
        <p className="tip"><kbd>WASD</kbd> di chuyển · <kbd>Shift</kbd> chạy · <kbd>Space</kbd> nhảy · kéo chuột xoay camera · cuộn để zoom · bấm xuống đất để đi tới</p>
      </div>
    </>
  );
}
