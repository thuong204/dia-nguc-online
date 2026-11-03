import { lazy, Suspense, useEffect, useState } from 'react';
import { FLOORS } from '../../shared/game.ts';
import { devJump, fetchOverview } from './net.ts';
import { ambience, isMuted, onMuteChange, setMuted, sfx, speak, stopSpeak } from './audio.ts';
import { useGame } from './store.ts';
import { Feed } from './ui/Feed.tsx';
import { Leaderboard } from './ui/Leaderboard.tsx';
import { Hud } from './ui/Hud.tsx';

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
          Hồn vừa lìa khỏi xác. Hắc Bạch Vô Thường sẽ dẫn bạn qua Quỷ Môn Quan, quỳ trước Diêm La Vương để bị tra hỏi. Khai thật hay khai gian, Gương Nghiệt đều soi thấy.
          <br />
          Mười tám tầng địa ngục, mỗi tầng một tội. Cùng các vong hồn sám hối — ai làm nấy hưởng công đức, đủ công đức thì được lên tầng trên. <b>Vi phạm 3 lần sẽ bị đày xuống tầng sâu hơn.</b> Qua hết tầng 1 thì tới cầu Nại Hà gặp Mạnh Bà.
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            try {
              localStorage.setItem('dn-name', name);
            } catch {
              /* bỏ qua */
            }
            useGame.getState().set({ soulName: name.trim().slice(0, 18) || 'Hồn Vô Danh', screen: 'tribunal' });
          }}
        >
          <label>
            Tên hồn ma
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={18} placeholder="VD: Nguyễn Văn A" required />
          </label>
          <button type="submit" className="primary">Ra trình diện Diêm Vương</button>
          <p className="small">🔊 Nên bật loa để nghe Diêm Vương tra hỏi.</p>
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
        <h3>🏆 Bảng sám hối</h3>
        <p className="small">Xếp theo tổng công đức tích được qua mọi tầng.</p>
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
  const offer = 'Tội nghiệp đã chuộc xong. Uống đi con, quên hết hồng trần, rồi đi đầu thai.';
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
                speak(`Kiếp sau, con sẽ là ${as}. Đi đi con.`, 'manh');
              }}
            >
              🍵 Uống canh Mạnh Bà
            </button>
          </>
        ) : (
          <>
            <p className="small">Bạn đã quên sạch kiếp trước. Kiếp sau bạn là...</p>
            <h2>{as}</h2>
            <button className="primary" onClick={() => set({ screen: 'judge' })}>Luân hồi thêm một kiếp</button>
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
    <button className="mute" onClick={() => setMuted(!m)} aria-label={m ? 'Bật âm thanh' : 'Tắt âm thanh'}>
      {m ? '🔇' : '🔊'}
    </button>
  );
}

export default function App() {
  const screen = useGame((s) => s.screen);
  const toastMsg = useGame((s) => s.toast);
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
      <MuteButton />
      {toastMsg && (
        <div className="toast" onClick={() => useGame.getState().set({ toast: null })} title="Bấm để đóng">
          {toastMsg}
        </div>
      )}
    </>
  );
}
