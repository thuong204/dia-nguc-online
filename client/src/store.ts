import { create } from 'zustand';
import type { BoardRow, FeedItem } from '../../shared/game.ts';

export type Screen = 'judge' | 'tribunal' | 'game' | 'reborn';

interface GameState {
  screen: Screen;
  soulName: string;
  soulId: string;
  board: BoardRow[];
  level: number;
  need: number;
  myId: string;
  roomKey: number;
  meReady: boolean;
  others: string[];
  bubbles: Record<string, string>;
  objIds: string[];
  feed: FeedItem[];
  stats: number[];
  toast: string | null;
  rebornAs: string;
  fading: boolean;
  /** Đang chờ server chuyển tầng: lời nhắn hiện trên màn chờ (null = không chờ) */
  travel: string | null;
  /** Mình đang chịu hình: loại (0 = không) & lượt (để chạy lại thanh đếm) */
  pain: number;
  painSeq: number;
  /** Đang đứng ở Pháp Trường (để hiện nút nhận tội) */
  nearExec: boolean;
  /** Thời điểm quỷ sai tới bắt nếu chưa nhận tội (ms, 0 = không) */
  seizeAt: number;
  set: (p: Partial<GameState>) => void;
}

export const useGame = create<GameState>((set) => ({
  screen: 'judge',
  soulName: '',
  soulId: '',
  board: [],
  level: 0,
  need: 1,
  myId: '',
  roomKey: 0,
  meReady: false,
  others: [],
  bubbles: {},
  objIds: [],
  feed: [],
  stats: new Array(18).fill(0),
  toast: null,
  rebornAs: '',
  fading: false,
  travel: null,
  pain: 0,
  painSeq: 0,
  nearExec: false,
  seizeAt: 0,
  set: (p) => set(p),
}));

const G = () => useGame.getState();

let toastTimer: ReturnType<typeof setTimeout> | undefined;
export function toast(msg: string) {
  G().set({ toast: msg });
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => G().set({ toast: null }), 3500);
}

const bubbleTimers = new Map<string, ReturnType<typeof setTimeout>>();
export function showBubble(id: string, text: string) {
  G().set({ bubbles: { ...G().bubbles, [id]: text } });
  clearTimeout(bubbleTimers.get(id));
  bubbleTimers.set(
    id,
    setTimeout(() => {
      const { [id]: _, ...rest } = G().bubbles;
      G().set({ bubbles: rest });
    }, 5000),
  );
}

export function pushFeed(item: FeedItem) {
  G().set({ feed: [item, ...G().feed].slice(0, 40) });
}
