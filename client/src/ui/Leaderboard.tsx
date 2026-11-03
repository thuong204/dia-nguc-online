import { useGame } from '../store.ts';

const MEDAL = ['🥇', '🥈', '🥉'];

/** Bảng xếp hạng: ai chịu xong nhiều tầng hình phạt nhất trên toàn âm phủ. */
export function Leaderboard({ limit = 10 }: { limit?: number }) {
  const board = useGame((s) => s.board);
  const myId = useGame((s) => s.soulId);
  if (!board.length) return <p className="small board-empty">Chưa có hồn nào chịu xong một tầng.</p>;
  return (
    <ol className="board">
      {board.slice(0, limit).map((r, i) => (
        <li key={r.id} className={r.id === myId ? 'me' : ''}>
          <span className="rank">{MEDAL[i] ?? i + 1}</span>
          <span className="dot" style={{ background: `hsl(${r.hue} 75% 70%)` }} />
          <span className="nm">{r.name}{r.id === myId ? ' (bạn)' : ''}</span>
          <span className="where">{r.reborn ? '🌉 đã đầu thai' : `Tầng ${r.level}`}</span>
          <b>⛓️ {r.pardons} tầng</b>
        </li>
      ))}
    </ol>
  );
}
