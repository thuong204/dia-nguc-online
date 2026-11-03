// Tên các nhân vật ở Chánh Điện. Kịch bản khai tội nằm ở shared/court.ts (server điều khiển).
import type { Speaker } from './audio.ts';

export interface Line {
  who: Speaker | 'me';
  text: string;
  sfx?: 'gong' | 'chain' | 'whoosh' | 'heartbeat';
  ask?: boolean; // dòng hỏi — chờ người chơi trả lời
  chips?: string[];
}

export const NAMES: Record<Speaker, string> = {
  diem: 'Diêm La Vương',
  hac: 'Hắc Vô Thường',
  bach: 'Bạch Vô Thường',
  manh: 'Mạnh Bà',
  phan: 'Phán Quan',
};

