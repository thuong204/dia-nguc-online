import { Client, Callbacks, type Room } from '@colyseus/sdk';
import { floorDef, type BoardRow, type FeedItem, type JudgeResponse } from '../../shared/game.ts';
import type { CourtLine } from '../../shared/court.ts';
import { pushFeed, showBubble, toast, useGame } from './store.ts';
import { ambience, plead, sfx } from './audio.ts';
import { announceFeed } from './announcer.ts';

const endpoint = import.meta.env.DEV ? `${location.protocol}//${location.hostname}:2567` : location.origin;
const client = new Client(endpoint);

export interface NetPlayer {
  name: string;
  sin: string;
  hue: number;
  x: number;
  y: number;
  z: number;
  r: number;
  slot: number;
  served: number;
  pain: number;
  esc: number; // đang bị quỷ sai áp giải tới Pháp Trường (0 = không, 1 = tự nhận tội, 2 = chống cự nên bị cưỡng chế)
}

export interface NetObj {
  kind: string;
  x: number;
  y: number;
  z: number;
  s: number;
  hp: number;
  owner: string;
}

/** Đối tượng schema "sống" — Colyseus tự cập nhật, đọc trực tiếp trong useFrame. */
export const players = new Map<string, NetPlayer>();
/** Vật thể của bản đồ — không còn nhiệm vụ nên chỉ là cảnh vật tĩnh dựng sẵn theo tầng (lồng hấp, vạc dầu, cối, cưa…). */
export const objects = new Map<string, NetObj>();

/** Dựng cảnh vật riêng của tầng (trước đây do nhiệm vụ trên server sinh ra). Chừa trống Pháp Trường & bãi xuất hiện. */
function seedDecor(level: number) {
  objects.clear();
  const def = floorDef(level);
  const free = (x: number, z: number) => !(Math.abs(x) < 5.5 && z > 4);
  const add = (kind: string, x: number, z: number, s = 0, hp = 0) => {
    if (free(x, z)) objects.set(`d${objects.size}`, { kind, x, y: 0, z, s, hp, owner: '' });
  };
  const kind: Record<number, string> = { 4: 'plate', 5: 'station', 9: 'station', 12: 'mortar', 18: 'saw' };
  if (kind[level]) def.spots?.forEach((p) => add(kind[level], p.x, p.z, level === 4 ? 0 : 1, level === 9 ? 6 : 0));
  if (level === 8) add('block', 0, -3);
  if (level === 11 && def.push) add('block', def.push.from.x, def.push.from.z);
}
let room: Room | null = null;
const G = () => useGame.getState();

export const send = (type: string, msg?: unknown) => room?.send(type, msg);
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Gửi lời khai cho Diêm Vương, nhận số tầng + vé xuống tầng. */
export async function requestJudgement(name: string, sin: string): Promise<JudgeResponse> {
  const res = await fetch('/api/judge', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name, sin }),
  });
  if (!res.ok) throw new Error('judge failed');
  return res.json();
}

export const enterWithTicket = (level: number, ticket: string) => enterFloor(level, ticket);

/* ---------- Chánh Điện ---------- */
export interface HallSoul {
  name: string;
  hue: number;
  cell: number;
  at: number;
  state: 'kneel' | 'up' | 'done';
}
/** Các hồn đang quỳ trong điện (schema sống, đọc trong useFrame) */
export const hallSouls = new Map<string, HallSoul>();
export interface Hall {
  room: Room;
  ids: () => string[];
}

/** Vào Chánh Điện: quỳ ở một ô, chờ tới lượt lên khai tội. */
export async function enterHall(name: string, hue: number, on: {
  souls: (ids: string[]) => void;
  turn: (id: string) => void;
  line: (l: CourtLine | null) => void;
  sentenced: (r: JudgeResponse) => void;
}) {
  const r = await client.joinOrCreate('hall', { name, hue });
  hallSouls.clear();
  const cb = Callbacks.get(r);
  const ids = () => [...hallSouls.keys()];
  cb.onAdd('souls', (s: any, id: any) => {
    hallSouls.set(id, s);
    on.souls(ids());
  });
  cb.onRemove('souls', (_s: any, id: any) => {
    hallSouls.delete(id);
    on.souls(ids());
  });
  cb.listen('turn', (v: string) => on.turn(v));
  cb.listen('line', (v: string) => on.line(v ? JSON.parse(v) : null));
  r.onMessage('feed', (item: FeedItem) => pushFeed(item));
  r.onMessage('sentenced', (m: JudgeResponse) => on.sentenced(m));
  return r;
}

/** Chỉ dùng khi dev: nhảy thẳng tới tầng bất kỳ để test. */
export async function devJump(level: number) {
  if (!import.meta.env.DEV || level < 1 || level > 18) return;
  let name = 'Tester';
  try {
    name = localStorage.getItem('dn-name') || name;
  } catch {
    /* bỏ qua */
  }
  const res = await fetch('/api/judge', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name, sin: `(test tầng ${level})`, level }),
  });
  const j: JudgeResponse = await res.json();
  G().set({ soulId: j.id });
  const old = room;
  room = null;
  G().set({ fading: true });
  if (old) await leaveRoom(old);
  await enterFloor(j.level, j.ticket);
  G().set({ screen: 'game' });
  setTimeout(() => G().set({ fading: false }), 200);
  toast(`[DEV] Tầng ${j.level}`);
}

/** Vào phòng của tầng; server chậm / mạng chập chờn thì cứ chờ và thử lại (vé còn hạn 5 phút). */
async function joinFloor(level: number, ticket: string) {
  for (let i = 0; ; i++) {
    try {
      return await client.joinOrCreate('floor', { level, ticket });
    } catch (e) {
      const msg = String((e as Error)?.message ?? e);
      if (msg.includes('không hợp lệ') || i >= 7) throw e; // vé hỏng thật / thử mãi không được
      G().set({ travel: `Âm phủ đông nghịt… đang thử lại lần ${i + 2}` });
      await wait(Math.min(1500 * (i + 1), 6000));
    }
  }
}

/** Rời phòng nhưng không đợi mãi nếu server chậm trả lời. */
const leaveRoom = (r: Room) => Promise.race([r.leave().catch(() => {}), wait(2500)]);

async function enterFloor(level: number, ticket: string) {
  const r = await joinFloor(level, ticket);
  room = r;
  players.clear();
  seedDecor(level);
  ambience(level);
  G().set({ level, myId: r.sessionId, roomKey: G().roomKey + 1, meReady: false, others: [], objIds: [...objects.keys()], seizeAt: 0, bubbles: {}, pain: 0, nearExec: false });

  const cb = Callbacks.get(r);
  cb.onAdd('players', (p: any, id: any) => {
    players.set(id, p);
    if (id === r.sessionId) G().set({ meReady: true });
    else G().set({ others: [...G().others, id] });
  });
  cb.onRemove('players', (_p: any, id: any) => {
    players.delete(id);
    G().set({ others: G().others.filter((o) => o !== id) });
  });
  cb.listen('need', (v: number) => G().set({ need: v }));

  r.onMessage('chat', ({ id, text }: { id: string; text: string }) => showBubble(id, text));
  r.onMessage('rest', ({ sec, next }: { sec: number; next: number }) => {
    toast(`😮‍💨 Được nghỉ ${sec} giây… hiệp hình phạt ${next}/${G().need} sắp tới!`);
    sfx.chain();
    sfx.heartbeat();
    sfx.sob(); // nghỉ giữa hiệp: khóc nấc, van xin
    setTimeout(() => plead(undefined, true), 600);
  });
  r.onMessage('bound', ({ id, name }: { id: string; name: string }) => {
    sfx.chain();
    if (id === r.sessionId) toast('⛓️ Bạn bị trói vào cọc — đao phủ chuẩn bị hành hình!');
    else toast(`⛓️ ${name} bị trói lên cọc Pháp Trường`);
  });
  r.onMessage('resist', ({ sec }: { sec: number }) => G().set({ seizeAt: Date.now() + sec * 1000 }));
  r.onMessage('escort', ({ id, name, forced }: { id: string; name: string; forced: boolean }) => {
    sfx.chain();
    if (id === r.sessionId) {
      G().set({ seizeAt: 0 });
      if (forced) {
        sfx.scream();
        setTimeout(() => plead('Buông ta ra! Ta không có tội! Tha cho ta…', true), 500);
      } else sfx.sob(0.8);
      toast(forced ? '⛓️ Ngươi dám chống cự! Ngưu Đầu Mã Diện tới lôi ngươi ra Pháp Trường!' : '🙏 Đã nhận tội — Ngưu Đầu Mã Diện áp giải bạn tới Pháp Trường…');
    } else {
      showBubble(id, forced ? 'Buông ta ra!!!' : 'Con xin nhận tội…');
      forced ? sfx.scream(0.6) : sfx.sob(0.6);
      toast(forced ? `⛓️ ${name} chống cự, bị quỷ sai lôi ra Pháp Trường` : `⛓️ ${name} nhận tội, đang bị áp giải ra Pháp Trường`);
    }
  });
  r.onMessage('served', ({ next }: { next: number }) => {
    sfx.bell();
    toast(next < 1 ? '✅ Chịu đủ hình phạt! Bấm E khi sẵn sàng qua cầu Nại Hà đầu thai.' : `✅ Chịu đủ hình phạt! Được tự do — bấm E khi sẵn sàng lên tầng ${next}.`);
  });
  r.onMessage('notice', ({ msg }: { msg: string }) => {
    toast(msg);
    sfx.bell();
  });
  r.onMessage('feed', (item: FeedItem) => {
    pushFeed(item);
    announceFeed(item);
  });
  r.onMessage('stats', (s: number[]) => G().set({ stats: s }));
  r.onMessage('board', (b: BoardRow[]) => G().set({ board: b }));

  let leaving = false; // đã nhận lệnh rời tầng — bỏ qua lệnh trùng
  const moveTo = async (next: number, t: string, msg: string) => {
    if (leaving) return;
    leaving = true;
    G().set({ fading: true, travel: next ? `Quỷ sai đang giải bạn lên tầng ${next}…` : null });
    room = null;
    await leaveRoom(r);
    await wait(450);
    try {
      await enterFloor(next, t);
      toast(msg);
    } catch {
      toast('Lạc đường giữa các tầng... hãy khai tội lại');
      G().set({ screen: 'judge' });
    }
    G().set({ travel: null });
    setTimeout(() => G().set({ fading: false }), 200);
  };
  r.onMessage('pardoned', ({ level: next, ticket: t }: { level: number; ticket: string }) => {
    sfx.pardon();
    moveTo(next, t, `⛓️ Chịu đủ hình phạt — bị giải lên tầng ${next}!`);
  });
  r.onMessage('reborn', async ({ as }: { as: string }) => {
    if (leaving) return;
    leaving = true;
    room = null;
    await leaveRoom(r);
    sfx.pardon();
    G().set({ screen: 'reborn', rebornAs: as, level: 0, meReady: false, others: [] });
  });

  r.onLeave(() => {
    if (room === r) {
      room = null;
      toast('Mất kết nối với âm phủ... hãy khai tội lại');
      G().set({ screen: 'judge', level: 0, meReady: false });
    }
  });
}

export async function fetchOverview() {
  try {
    const res = await fetch('/api/overview');
    const d = await res.json();
    G().set({ feed: d.feed, stats: d.stats, board: d.board ?? [] });
  } catch {
    /* server chưa chạy */
  }
}
