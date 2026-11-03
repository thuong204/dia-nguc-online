// Gợi ý hành động theo vị trí người chơi & cơ chế của tầng.
import { PUSH_R, REACH, RHYTHM, SAW_HANDLE, SPOTS, WHACK_R, floorDef } from '../../shared/game.ts';
import { objects } from './net.ts';
import { LETTERS, QUIZ_R, QUIZ_SPOTS } from '../../shared/quiz.ts';

export function nearHint(level: number, x: number, z: number): string | null {
  const def = floorDef(level);
  const d = (o: { x: number; z: number }) => Math.hypot(x - o.x, z - o.z);
  switch (def.mech) {
    case 'mill':
      if (d(SPOTS.mill) <= REACH) return 'Giữ / bấm liên tục E để kéo cối xay đá';
      if (d(SPOTS.burner) <= REACH) return 'Bấm E để đốt vàng mã (gấp 3)';
      return null;
    case 'whack':
      for (const o of objects.values()) if (o.kind === 'station' && o.s === 1 && d(o) <= WHACK_R) return level === 5 ? 'Bấm E liên tục để khoá van hơi!' : 'Bấm E liên tục để dập lửa dưới vạc!';
      return null;
    case 'push':
      for (const o of objects.values()) if (o.kind === 'block' && d(o) <= PUSH_R) return 'Bấm E liên tục để cùng đẩy!';
      return null;
    case 'rhythm':
      for (const o of objects.values()) if (o.kind === 'mortar' && d(o) <= RHYTHM.r) return 'Bấm E đúng lúc trống đánh!';
      return null;
    case 'saw':
      for (const o of objects.values()) {
        if (o.kind !== 'saw') continue;
        const hx = o.x + (o.s === 0 ? -SAW_HANDLE : SAW_HANDLE);
        if (Math.hypot(x - hx, z - o.z) <= 1.9) return 'Bấm E kéo cưa! Sau đó tới lượt đầu bên kia';
        if (d(o) <= 4) return 'Ra đầu cưa đang sáng để kéo';
      }
      return null;
    case 'quiz': {
      const k = QUIZ_SPOTS.findIndex((s) => d(s) <= QUIZ_R);
      return k >= 0 ? `Bạn đang khai: ô ${LETTERS[k]}` : 'Chạy vào một ô đáp án A/B/C/D';
    }
    default:
      return null;
  }
}
