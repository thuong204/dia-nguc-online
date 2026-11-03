// Kịch bản điện Diêm Vương — soạn sẵn, không dùng AI.
import { FLOORS, hasSin } from '../../shared/game.ts';
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

const FIRST = { text: 'Kiếp trước, điều trái lương tâm nhất ngươi từng làm là gì?', chips: ['Nói dối', 'Ăn trộm', 'Lừa đảo', 'Bắt nạt người khác', 'Không có gì cả'] };
const POOL = [
  { text: 'Ngươi đối đãi với cha mẹ ra sao? Có từng bất hiếu?', chips: ['Bất hiếu, cãi lời', 'Phụ bạc người thân', 'Luôn hiếu thảo'] },
  { text: 'Có ai từng chịu oan vì lời nói của ngươi?', chips: ['Vu khống người khác', 'Hay buôn chuyện', 'Xúi giục chia rẽ', 'Chưa từng'] },
  { text: 'Ngươi làm ăn, làm việc có ngay thẳng không?', chips: ['Tham ô, nhận hối lộ', 'Bán hàng giả', 'Lười biếng', 'Ngay thẳng'] },
  { text: 'Ngươi đối xử với muôn loài thế nào?', chips: ['Sát sinh', 'Ngược đãi chó mèo', 'Thương yêu muôn loài'] },
  { text: 'Cơm gạo, của cải trời cho, ngươi có trân trọng?', chips: ['Phí phạm, lãng phí', 'Đổ cơm thừa', 'Có trân trọng'] },
  { text: 'Có điều gì ngươi che giấu, chưa dám nhận?', chips: ['Che giấu tội lỗi', 'Trốn tội', 'Không có'] },
];

const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];

export function opening(name: string): Line[] {
  return [
    { who: 'bach', text: `Hồn ${name}… dương thọ đã tận. Ta là Bạch Vô Thường, phụng lệnh đến dẫn ngươi.`, sfx: 'chain' },
    { who: 'hac', text: 'Còn đứng đó làm gì! Qua Quỷ Môn Quan, quỳ xuống trước Diêm Vương!', sfx: 'chain' },
    { who: 'diem', text: 'Ta là Diêm La Vương. Gương Nghiệt đã soi, Sổ Sinh Tử đã mở. Ta hỏi, ngươi phải khai thật.', sfx: 'gong' },
  ];
}

/** Ba câu hỏi: câu đầu cố định, hai câu sau rút ngẫu nhiên */
export function questions(): Line[] {
  const rest = [...POOL].sort(() => Math.random() - 0.5).slice(0, 2);
  return [FIRST, ...rest].map((q) => ({ who: 'diem' as const, text: q.text, chips: q.chips, ask: true }));
}

/** Diêm Vương / quỷ sai phản ứng theo câu trả lời */
export function react(answer: string): Line {
  if (hasSin(answer))
    return pick<Line>([
      { who: 'diem', text: 'Hừm… tội này không nhẹ. Phán Quan, chép vào sổ!' },
      { who: 'phan', text: 'Bẩm, hạ quan đã ghi lại từng chữ.' },
      { who: 'hac', text: 'Hê… lại thêm một kẻ có tội.', sfx: 'chain' },
    ]);
  return pick<Line>([
    { who: 'diem', text: 'Ngươi chắc chứ? Gương Nghiệt sẽ nói thay ngươi.', sfx: 'heartbeat' },
    { who: 'bach', text: 'Hi hi… chối cũng vô ích thôi.' },
    { who: 'diem', text: 'Hừ. Ta tạm tin, nhưng Sổ Sinh Tử không biết nói dối.' },
  ]);
}

export function verdict(name: string, level: number): Line[] {
  const f = FLOORS[level - 1];
  return [
    { who: 'phan', text: 'Bẩm Đại Vương, Gương Nghiệt đã soi rõ, Sổ Sinh Tử đã đối chiếu xong.', sfx: 'whoosh' },
    { who: 'diem', text: `Phán! Hồn ${name} phạm tội: ${f.sin.toLowerCase()}. Đày xuống Tầng ${level}, ${f.name}!`, sfx: 'gong' },
    { who: 'diem', text: `Hình phạt: ${f.punishment} Muốn được ân xá thì cùng các vong hồn trong tầng mà sám hối.` },
    { who: 'hac', text: 'Đi! Ngưu Đầu, Mã Diện đang chờ ngươi ở cổng.', sfx: 'chain' },
  ];
}
