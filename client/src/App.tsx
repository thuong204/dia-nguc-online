import { lazy, Suspense, useEffect, useState } from 'react';
import { FLOORS } from '../../shared/game.ts';
import { devJump, fetchOverview } from './net.ts';
import { ambience, isMuted, onMuteChange, setMuted, sfx, speak, stopSpeak } from './audio.ts';
import { toast, useGame } from './store.ts';
import { Feed } from './ui/Feed.tsx';
import { Leaderboard } from './ui/Leaderboard.tsx';
import { Hud } from './ui/Hud.tsx';
import { canFullscreen, enterFullscreen, exitFullscreen, isFullscreen, isStandalone, isTouch, onFullscreenChange } from './ui/fullscreen.ts';

const Game = lazy(() => import('./game/Game.tsx'));
const Tribunal = lazy(() => import('./game/Tribunal.tsx'));

function Judge() {
  const [name, setName] = useState(() => {
    try {
      return localStorage.getItem('dn-name') ?? '';
    } catch {
      return '';
    }
  });
  useEffect(() => {
    fetchOverview();
    const t = setInterval(fetchOverview, 4000);
    return () => clearInterval(t);
  }, []);
  return (
    <section className="screen judge">
      <div className="card">
        <div className="seal">閻</div>
        <h1>Địa Ngục Online</h1>
        <p className="sub">
          Ối, bạn vừa "lên đường" vì một lý do hết sức lãng xẹt! Hắc Bạch Vô Thường sẽ dắt bạn qua Quỷ Môn Quan, lên trình diện Diêm La Vương. Khai thật hay khai xạo, Gương Nghiệt đều có hình Full HD.
          <br />
          Mười tám tầng địa ngục, mỗi tầng một tội, một hình phạt dở khóc dở cười: lưỡi lò xo, đầu nấm, cù lét lông gà, tắm nước mắm… <b>chịu đủ hình phạt mới được lên tầng trên</b>. Xong tầng 1 thì qua cầu Nại Hà, uống canh Mạnh Bà vị trà sữa rồi đi đầu thai.
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            try {
              localStorage.setItem('dn-name', name);
            } catch {
              /* bỏ qua */
            }
            if (isTouch() && canFullscreen()) enterFullscreen(); // điện thoại: vào toàn màn hình, xoay ngang luôn
            useGame.getState().set({ soulName: name.trim().slice(0, 18) || 'Hồn Vô Danh', screen: 'tribunal' });
          }}
        >
          <label>
            Tên hồn ma
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={18} placeholder="VD: Nguyễn Văn A" required />
          </label>
          <button type="submit" className="primary">Ra trình diện Diêm Vương</button>
          <p className="small">🔊 Nên bật loa để nghe Diêm Vương "hỏi cung" cho vui.</p>
        </form>
        {import.meta.env.DEV && (
          <label style={{ marginTop: 12, display: 'block' }}>
            [DEV] Vào thẳng tầng
            <select defaultValue="" onChange={(e) => e.target.value && devJump(Number(e.target.value))}>
              <option value="">-- chọn tầng --</option>
              {FLOORS.map((f) => (
                <option key={f.level} value={f.level}>{f.level}. {f.name}</option>
              ))}
            </select>
          </label>
        )}
      </div>
      <aside className="card feed-card">
        <h3>🏆 Chịu phạt nhiều tầng nhất</h3>
        <p className="small">Đã đầu thai xếp trước, sau đó theo số tầng đã chịu xong.</p>
        <Leaderboard />
        <h3 style={{ marginTop: 18 }}>📜 Sổ Sinh Tử (trực tiếp)</h3>
        <Feed />
      </aside>
    </section>
  );
}

function Reborn() {
  const as = useGame((s) => s.rebornAs);
  const set = useGame((s) => s.set);
  const [drunk, setDrunk] = useState(false);
  const offer = 'Phạt đủ rồi đó con. Canh hôm nay vị trà sữa trân châu đường đen, uống đi rồi quên hết, đi đầu thai nè.';
  useEffect(() => {
    ambience(0);
    const t = setTimeout(() => speak(offer, 'manh'), 600);
    return () => {
      clearTimeout(t);
      stopSpeak();
    };
  }, []);
  return (
    <section className="screen reborn">
      <div className="card center">
        <div className="big">🌉</div>
        <p className="small">Cầu Nại Hà · sông Vong Xuyên</p>
        {!drunk ? (
          <>
            <p className="sub"><b>Mạnh Bà:</b> “{offer}”</p>
            <button
              className="primary"
              onClick={() => {
                setDrunk(true);
                sfx.pardon();
                speak(`Kiếp sau, con sẽ là ${as}. Sống cho đàng hoàng nha con!`, 'manh');
              }}
            >
              🧋 Uống canh Mạnh Bà vị trà sữa
            </button>
          </>
        ) : (
          <>
            <p className="small">Ực ực… quên sạch kiếp trước rồi! Kiếp sau bạn là...</p>
            <h2>{as}</h2>
            <button className="primary" onClick={() => set({ screen: 'judge' })}>Chơi thêm một kiếp nữa</button>
          </>
        )}
      </div>
    </section>
  );
}

function MuteButton() {
  const [m, setM] = useState(isMuted());
  useEffect(() => {
    const off = onMuteChange(setM);
    return () => void off();
  }, []);
  return (
    <button
      className="mute"
      onClick={() => {
        setMuted(!m);
        if (m) sfx.bell(); // vừa bật lại → kêu thử một tiếng
      }}
      aria-label={m ? 'Bật âm thanh' : 'Tắt âm thanh'}
    >
      {m ? '🔇' : '🔊'}
    </button>
  );
}

const IOS_TIP = 'iPhone: bấm nút Chia sẻ ⬆️ → “Thêm vào MH chính”, mở từ biểu tượng để chơi toàn màn hình, rồi xoay ngang máy.';

function FullscreenButton() {
  const [fs, setFs] = useState(isFullscreen());
  useEffect(() => onFullscreenChange(() => setFs(isFullscreen())), []);
  if (isStandalone()) return null;
  return (
    <button
      className="fs"
      onClick={() => {
        if (!canFullscreen()) return toast(IOS_TIP);
        if (fs) exitFullscreen();
        else enterFullscreen();
      }}
      aria-label={fs ? 'Thoát toàn màn hình' : 'Toàn màn hình'}
      title={fs ? 'Thoát toàn màn hình' : 'Toàn màn hình'}
    >
      {fs ? '🗗' : '⛶'}
    </button>
  );
}

/** Điện thoại cầm dọc: nhắc xoay ngang cho dễ chơi */
function RotateHint() {
  const [portrait, setPortrait] = useState(false);
  const [skip, setSkip] = useState(false);
  useEffect(() => {
    const mq = matchMedia('(orientation: portrait) and (pointer: coarse)');
    const f = () => setPortrait(mq.matches);
    f();
    mq.addEventListener('change', f);
    return () => mq.removeEventListener('change', f);
  }, []);
  if (!portrait || skip) return null;
  return (
    <div className="rotate-hint">
      <div className="rotate-phone">📱</div>
      <p>Xoay ngang điện thoại để chơi dễ hơn</p>
      {canFullscreen() ? (
        <button className="primary" onClick={() => enterFullscreen()}>⛶ Toàn màn hình &amp; xoay ngang</button>
      ) : (
        !isStandalone() && <p className="small">{IOS_TIP}</p>
      )}
      <button className="link" onClick={() => setSkip(true)}>Vẫn chơi màn dọc</button>
    </div>
  );
}

/** Màn chờ khi server đang chuyển tầng — đếm giây để người chơi biết game vẫn đang chạy. */
function Travel({ msg }: { msg: string }) {
  const [sec, setSec] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setSec((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="travel">
      <div className="travel-spin">🛗</div>
      <p>{msg}</p>
      <p className="small">{sec < 5 ? 'Xin chờ một chút…' : `Đã chờ ${sec} giây — thang máy âm phủ hơi chậm, đừng tắt trang nhé.`}</p>
    </div>
  );
}

export default function App() {
  const screen = useGame((s) => s.screen);
  const toastMsg = useGame((s) => s.toast);
  const travel = useGame((s) => s.travel);
  const inGame = screen === 'game';
  return (
    <>
      {inGame && (
        <section className="game">
          <div className="view">
            <Suspense fallback={<div className="loading">Đang mở cửa địa ngục...</div>}>
              <Game />
            </Suspense>
          </div>
          {screen === 'game' && <Hud />}
        </section>
      )}
      {screen === 'judge' && <Judge />}
      {screen === 'reborn' && <Reborn />}
      {screen === 'tribunal' && (
        <Suspense fallback={<div className="loading">Hắc Bạch Vô Thường đang tới…</div>}>
          <Tribunal />
        </Suspense>
      )}
      {travel && <Travel msg={travel} />}
      <MuteButton />
      <FullscreenButton />
      {(inGame || screen === 'tribunal') && <RotateHint />}
      {toastMsg && (
        <div className="toast" onClick={() => useGame.getState().set({ toast: null })} title="Bấm để đóng">
          {toastMsg}
        </div>
      )}
    </>
  );
}
