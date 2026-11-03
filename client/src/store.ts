import { create } from 'zustand';
import type { FeedItem } from '../../shared/game.ts';
import type { QuizView } from '../../shared/quiz.ts';

/** Gợi ý hành động khi đang đứng gần một trạm (null nếu không có). */
export type Near = string | null;

export type Screen = 'judge' | 'tribunal' | 'game' | 'reborn';

interface GameState {
  screen: Screen;
  soulName: string;
  level: number;
  progress: number;
  need: number;
  myId: string;
  roomKey: number;
  meReady: boolean;
  others: string[];
  bubbles: Record<string, string>;
  near: Near;
  goal: string;
  quiz: QuizView | null;
  objIds: string[];
  feed: FeedItem[];
  stats: number[];
  toast: string | null;
  rebornAs: string;
  fading: boolean;
  set: (p: Partial<GameState>) => void;
}

export const useGame = create<GameState>((set) => ({
  screen: 'judge',
  soulName: '',
  level: 0,
  progress: 0,
  need: 1,
  myId: '',
  roomKey: 0,
  meReady: false,
  others: [],
  bubbles: {},
  near: null,
  goal: '',
  quiz: null,
  objIds: [],
  feed: [],
  stats: new Array(18).fill(0),
  toast: null,
  rebornAs: '',
  fading: false,
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
