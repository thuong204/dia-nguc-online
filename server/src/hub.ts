// Trạng thái toàn cục dùng chung giữa các phòng (chạy trong 1 process).
import { EventEmitter } from 'node:events';
import { randomUUID } from 'node:crypto';
import { FLOORS, type BoardRow, type FeedItem } from '../../shared/game.ts';

export const hub = new EventEmitter();
hub.setMaxListeners(200);

/* ---- Sổ Sinh Tử ---- */
export const feed: FeedItem[] = [];
export function addFeed(item: Omit<FeedItem, 't'>) {
  const full = { ...item, t: Date.now() };
  feed.unshift(full);
  feed.length = Math.min(feed.length, 40);
  hub.emit('feed', full);
}

/* ---- Số hồn mỗi tầng ---- */
const counts = new Array(FLOORS.length).fill(0);
let statsTimer: NodeJS.Timeout | null = null;
export const stats = () => [...counts];
export function countSoul(level: number, delta: number) {
  counts[level - 1] = Math.max(0, counts[level - 1] + delta);
  if (!statsTimer) {
    statsTimer = setTimeout(() => {
      statsTimer = null;
      hub.emit('stats', stats());
    }, 300);
  }
}

/* ---- Vé vào tầng: chống tự chọn tầng ----
   Server cấp vé sau khi phán tội / ân xá; phòng chỉ nhận vé đúng tầng. */
export interface Soul {
  id: string; // giữ nguyên qua các tầng để tính bảng xếp hạng
  name: string;
  sin: string;
  hue: number;
  level: number;
}
const tickets = new Map<string, { soul: Soul; exp: number }>();
export function issueTicket(soul: Soul) {
  const id = randomUUID();
  tickets.set(id, { soul, exp: Date.now() + 60_000 });
  return id;
}
export function consumeTicket(id: unknown): Soul | null {
  if (typeof id !== 'string') return null;
  const t = tickets.get(id);
  tickets.delete(id);
  if (!t || t.exp < Date.now()) return null;
  return t.soul;
}
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of tickets) if (v.exp < now) tickets.delete(k);
}, 30_000).unref();

/* ---- Bảng xếp hạng sám hối: cộng dồn công đức của mỗi hồn qua mọi tầng ---- */
const board = new Map<string, BoardRow>();
let boardTimer: NodeJS.Timeout | null = null;
export function leaderboard(n = 10): BoardRow[] {
  return [...board.values()].sort((a, b) => b.merit - a.merit || b.pardons - a.pardons).slice(0, n);
}
function boardChanged() {
  if (boardTimer) return;
  boardTimer = setTimeout(() => {
    boardTimer = null;
    hub.emit('board', leaderboard());
  }, 1000);
}
function row(soul: Soul, level: number) {
  let r = board.get(soul.id);
  if (!r) {
    r = { id: soul.id, name: soul.name, hue: soul.hue, merit: 0, pardons: 0, level, reborn: false };
    board.set(soul.id, r);
    if (board.size > 500) {
      // bỏ bớt người ít công đức nhất cho nhẹ bộ nhớ
      const worst = [...board.values()].sort((a, b) => a.merit - b.merit)[0];
      board.delete(worst.id);
    }
  }
  r.level = level;
  return r;
}
export function addMerit(soul: Soul, level: number, n: number) {
  row(soul, level).merit += n;
  boardChanged();
}
export function notePardon(soul: Soul, level: number, reborn = false) {
  const r = row(soul, level);
  r.pardons++;
  if (reborn) r.reborn = true;
  boardChanged();
}
