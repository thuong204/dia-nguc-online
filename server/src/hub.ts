// Trạng thái toàn cục dùng chung giữa các phòng (chạy trong 1 process).
import { EventEmitter } from 'node:events';
import { randomUUID } from 'node:crypto';
import { FLOORS, type FeedItem } from '../../shared/game.ts';

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
