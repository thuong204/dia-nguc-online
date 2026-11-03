import { Client, Callbacks, type Room } from '@colyseus/sdk';
import type { BoardRow, FeedItem, JudgeResponse } from '../../shared/game.ts';
import { pushFeed, showBubble, toast, useGame } from './store.ts';
import { fx, onBurn, onBurst, onPush } from './fx.ts';
import { ambience, sfx } from './audio.ts';
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
  strikes: number;
  merit: number;
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
export const objects = new Map<string, NetObj>();
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
  await old?.leave();
  await enterFloor(j.level, j.ticket);
  G().set({ screen: 'game' });
  setTimeout(() => G().set({ fading: false }), 200);
  toast(`[DEV] Tầng ${j.level}`);
}

async function enterFloor(level: number, ticket: string) {
  const r = await client.joinOrCreate('floor', { level, ticket });
  room = r;
  players.clear();
  objects.clear();
  ambience(level);
  G().set({ level, myId: r.sessionId, roomKey: G().roomKey + 1, meReady: false, others: [], objIds: [], goal: '', quiz: null, bubbles: {}, progress: 0, near: null });

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
  cb.listen('progress', (v: number) => G().set({ progress: v }));
  cb.listen('need', (v: number) => G().set({ need: v }));
  cb.listen('goal', (v: string) => G().set({ goal: v }));
  cb.listen('quiz', (v: string) => G().set({ quiz: v ? JSON.parse(v) : null }));
  cb.onAdd('objects', (o: any, id: any) => {
    objects.set(id, o);
    G().set({ objIds: [...G().objIds, id] });
  });
  cb.onRemove('objects', (_o: any, id: any) => {
    objects.delete(id);
    G().set({ objIds: G().objIds.filter((o) => o !== id) });
  });

  r.onMessage('chat', ({ id, text }: { id: string; text: string }) => showBubble(id, text));
  r.onMessage('fx', (e: { k: string; id?: string; x?: number; y?: number; z?: number; c?: string }) => {
    if (e.k === 'push' && e.id) onPush(e.id);
    else if (e.k === 'burn' && e.id) onBurn(e.id);
    else if (e.k === 'burst') {
      onBurst(e.x ?? 0, e.y ?? 0, e.z ?? 0, e.c ?? 'gold');
      if (e.c === 'gold') sfx.ding();
    }
    else if (e.k === 'pound') {
      fx.pounds.set(`${e.x},${e.z}`, performance.now() / 1000);
      sfx.thud();
      onBurst(e.x ?? 0, 1.2, e.z ?? 0, 'white');
    } else if (e.k === 'bell') {
      fx.bellAt = performance.now() / 1000;
      sfx.bell();
    }
  });
  r.onMessage('hit', ({ msg, soft }: { msg: string; soft?: boolean }) => {
    toast(msg);
    sfx.hit();
    if (!soft) fx.respawn = true;
  });
  r.onMessage('reached', ({ msg }: { msg: string }) => {
    toast('🔔 ' + msg);
    sfx.bell();
    fx.respawn = true;
  });
  r.onMessage('beat', () => {
    fx.beatAt = performance.now() / 1000;
    sfx.drum();
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

  const moveTo = async (next: number, t: string, msg: string) => {
    G().set({ fading: true });
    room = null;
    await r.leave();
    await wait(450);
    try {
      await enterFloor(next, t);
      toast(msg);
    } catch {
      toast('Lạc đường giữa các tầng... hãy khai tội lại');
      G().set({ screen: 'judge' });
    }
    setTimeout(() => G().set({ fading: false }), 200);
  };
  r.onMessage('pardoned', ({ level: next, ticket: t }: { level: number; ticket: string }) => {
    sfx.pardon();
    moveTo(next, t, `🎉 Bạn đã đủ công đức, được ân xá lên tầng ${next}!`);
  });
  r.onMessage('banished', ({ level: next, ticket: t, msg }: { level: number; ticket: string; msg: string }) => {
    sfx.banish();
    moveTo(next, t, `⛓️ ${msg} — vi phạm 3 lần, bị đày xuống tầng ${next}!`);
  });

  r.onMessage('reborn', async ({ as }: { as: string }) => {
    room = null;
    await r.leave();
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
