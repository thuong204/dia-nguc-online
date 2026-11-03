// Dữ liệu & luật chơi dùng chung cho cả server và client.
// 18 tầng địa ngục theo quan niệm dân gian (Ngọc Lịch Chí Bảo Sao).

export const BOUNDS = { x: 25, z: 17 };
export const REACH = 4.5;
export const SPOTS = { mill: { x: 0, z: -2 }, burner: { x: -15, z: 7 } } as const;
export const SPAWN = { x: 0, z: 13.5 };
export const ARENA_Z = 11; // phía nam z > 11 là bãi an toàn (nơi xuất hiện)

type XZ = { x: number; z: number };
type Target = XZ & { r: number };

export type Mech = 'collect' | 'hazard' | 'climb' | 'plates' | 'whack' | 'push' | 'rhythm' | 'mill' | 'saw' | 'quiz';

export interface FloorDef {
  mech: Mech;
  task: string;
  need: number;
  collect?: { source?: XZ; targets: Target[]; match?: boolean; drift?: boolean; max: number; gain: number };
  hazard?: { shape: 'row' | 'col' | 'circle'; per: [number, number] };
  climb?: { goal: Target & { y: number }; gain: number };
  spots?: XZ[]; // plates / whack / rhythm / saw
  push?: { from: XZ; to: XZ };
  hp?: number;
}

export interface Floor {
  level: number;
  name: string; // tên Việt
  han: string; // chữ Hán
  sin: string; // tội
  punishment: string;
  keywords: string[];
  def: FloorDef;
}

const ring = (n: number, r: number, cz = 0, a0 = Math.PI / 2): XZ[] =>
  Array.from({ length: n }, (_, i) => ({ x: Math.cos(a0 + (i / n) * Math.PI * 2) * r, z: cz + Math.sin(a0 + (i / n) * Math.PI * 2) * r }));

const RAW: Omit<Floor, 'level'>[] = [
  {
    name: 'Địa Ngục Rút Lưỡi', han: '拔舌地獄', sin: 'Nói dối, vu khống, đặt điều',
    punishment: 'Quỷ sai banh miệng, kéo lưỡi dài ra.',
    keywords: ['noi doi', 'vu khong', 'dat dieu', 'bia chuyen', 'noi lao', 'xao lol', 'noi xau'],
    def: { mech: 'quiz', task: 'Phán Quan đối chất: chạy tới ô đáp án thật (A/B/C/D) trước khi hết giờ. Đừng tin Quỷ Dối Trá!', need: 40 },
  },
  {
    name: 'Địa Ngục Cắt Kéo', han: '剪刀地獄', sin: 'Xúi giục, chia rẽ gia đình người khác',
    punishment: 'Kéo sắt cắt đứt mười ngón tay.',
    keywords: ['xui giuc', 'chia re', 'pha dam', 'chia uyen re thuy', 'xui bay'],
    def: { mech: 'hazard', task: 'Kéo sắt quét ngang từng dải. Né dải đỏ! Mỗi lượt sống sót +1.', need: 30, hazard: { shape: 'row', per: [2, 3] } },
  },
  {
    name: 'Địa Ngục Cây Sắt', han: '鐵樹地獄', sin: 'Ly gián anh em, ruột thịt',
    punishment: 'Treo lên cây sắt mọc đầy lưỡi dao.',
    keywords: ['ly gian', 'bat hoa', 'chia re anh em', 'gay go', 'gay chia re'],
    def: { mech: 'climb', task: 'Luồn qua rừng cây sắt, không chạm lưỡi dao, đến rung Chuông Sám Hối.', need: 30,
      climb: { goal: { x: 0, z: -14.5, y: 0, r: 2.6 }, gain: 3 } },
  },
  {
    name: 'Địa Ngục Gương Nghiệt', han: '孽鏡地獄', sin: 'Che giấu tội lỗi, chối tội',
    punishment: 'Soi gương nghiệt, thấy rõ mọi tội đã làm.',
    keywords: ['che giau', 'tron toi', 'choi toi', 'khong nhan', 'chui toi', 'giau giem'],
    def: { mech: 'plates', task: 'Mỗi hồn đứng trước một tấm gương. Tất cả gương phải cùng sáng!', need: 60, spots: ring(8, 9, -2) },
  },
  {
    name: 'Địa Ngục Lồng Hấp', han: '蒸籠地獄', sin: 'Buôn chuyện, đơm đặt thị phi',
    punishment: 'Bỏ vào lồng hấp, hấp chín rồi lại hấp.',
    keywords: ['buon chuyen', 'thi phi', 'drama', 'hong chuyen', 'ngoi le', 'loi ra loi vao'],
    def: { mech: 'whack', task: 'Lồng hấp đang phun hơi! Lại gần, bấm E liên tục để khoá van.', need: 40, hp: 5,
      spots: [...[-15, -5, 5, 15].flatMap((x) => [{ x, z: -9 }, { x, z: 0 }]), { x: -10, z: 7 }, { x: 10, z: 7 }] },
  },
  {
    name: 'Địa Ngục Cột Đồng', han: '銅柱地獄', sin: 'Phóng hoả, đốt phá, phá hoại',
    punishment: 'Ôm cột đồng nung đỏ.',
    keywords: ['phong hoa', 'dot nha', 'pha hoai', 'dap pha', 'dot pha'],
    def: { mech: 'collect', task: 'Múc nước ở giếng (trái), gánh đến dội nguội các cột đồng.', need: 40,
      collect: { source: { x: -18, z: 8 }, targets: [{ x: -6, z: -7, r: 2.8 }, { x: 6, z: -7, r: 2.8 }, { x: -6, z: 2, r: 2.8 }, { x: 6, z: 2, r: 2.8 }], max: 6, gain: 2 } },
  },
  {
    name: 'Địa Ngục Núi Đao', han: '刀山地獄', sin: 'Sát sinh, bất kính thần thánh',
    punishment: 'Trèo núi cắm đầy đao nhọn.',
    keywords: ['sat sinh', 'giet', 'san ban', 'cau ca', 'bat kinh than', 'pha chua'],
    def: { mech: 'climb', task: 'Nhảy (Space) theo bậc đá, leo lên đỉnh Núi Đao.', need: 32, climb: { goal: { x: 0, z: -8, y: 8.5, r: 2.4 }, gain: 4 } },
  },
  {
    name: 'Địa Ngục Núi Băng', han: '冰山地獄', sin: 'Bất hiếu, phụ bạc, ngoại tình',
    punishment: 'Bị đày lên núi băng giá buốt.',
    keywords: ['bat hieu', 'phu bac', 'ngoai tinh', 'cai bo', 'cai me', 'bo nguoi yeu', 'ca dua'],
    def: { mech: 'push', task: 'Cùng nhau đẩy khối băng (E) vào hố lửa phía bắc.', need: 50, push: { from: { x: 0, z: 8 }, to: { x: 0, z: -11 } } },
  },
  {
    name: 'Địa Ngục Vạc Dầu', han: '油鍋地獄', sin: 'Trộm cắp, cướp giật, lừa gạt',
    punishment: 'Thả vào vạc dầu sôi.',
    keywords: ['trom', 'cuop', 'an cap', 'lua gat', 'moc tui', 'an trom', 'cuop giat'],
    def: { mech: 'whack', task: 'Lửa dưới vạc dầu bùng lên! Lại gần, bấm E liên tục để dập.', need: 40, hp: 6,
      spots: [-12, 0, 12].flatMap((x) => [{ x, z: -8 }, { x, z: 2 }]) },
  },
  {
    name: 'Địa Ngục Trâu Húc', han: '牛坑地獄', sin: 'Ngược đãi súc vật',
    punishment: 'Thả vào hố cho trâu húc, trâu giẫm.',
    keywords: ['nguoc dai', 'danh cho', 'danh meo', 'hanh ha', 'bo roi thu cung', 'dam cho'],
    def: { mech: 'hazard', task: 'Trâu điên lao dọc từng làn. Né làn đỏ! Mỗi lượt sống sót +1.', need: 30, hazard: { shape: 'col', per: [2, 4] } },
  },
  {
    name: 'Địa Ngục Đá Đè', han: '石壓地獄', sin: 'Bỏ rơi, hắt hủi con cái',
    punishment: 'Bị đá tảng đè lên người.',
    keywords: ['bo con', 'bo roi con', 'hat hui', 'bo mac', 'pha thai'],
    def: { mech: 'push', task: 'Tảng đá đang đè các vong hồn. Cùng nhau đẩy (E) lăn nó đi!', need: 50, push: { from: { x: -13, z: -2 }, to: { x: 14, z: -2 } } },
  },
  {
    name: 'Địa Ngục Cối Giã', han: '舂臼地獄', sin: 'Phí phạm của trời, đổ bỏ thức ăn',
    punishment: 'Bỏ vào cối đá mà giã.',
    keywords: ['phi pham', 'lang phi', 'bo com', 'an thua', 'do com', 'vut do an'],
    def: { mech: 'rhythm', task: 'Đứng cạnh cối, bấm E ĐÚNG NHỊP trống. Càng nhiều người cùng nhịp càng nhanh.', need: 50,
      spots: [{ x: -5, z: -6 }, { x: 5, z: -6 }, { x: -5, z: 2 }, { x: 5, z: 2 }] },
  },
  {
    name: 'Địa Ngục Ao Máu', han: '血池地獄', sin: 'Bất kính, bất chính, vô lễ',
    punishment: 'Dìm trong ao máu tanh hôi.',
    keywords: ['bat chinh', 'vo le', 'khong ton trong', 'bat kinh', 'xuc pham'],
    def: { mech: 'collect', task: 'Vác ván gỗ (góc trái) đến bờ ao để bắc cầu qua Ao Máu.', need: 40,
      collect: { source: { x: -19, z: 10 }, targets: [{ x: 0, z: 7.5, r: 3.2 }], max: 6, gain: 2 } },
  },
  {
    name: 'Thành Uổng Tử', han: '枉死城', sin: 'Chết oan, chết uổng',
    punishment: 'Lang thang trong thành u tối, chưa được siêu sinh.',
    keywords: ['uong tu', 'chet oan', 'oan uc', 'chet uong'],
    def: { mech: 'collect', task: 'Mang đèn từ miếu (trái) thắp lên các đèn đá, dẫn lối cho vong hồn.', need: 36,
      collect: { source: { x: -18, z: 9 }, targets: ring(6, 11, -3).map((p) => ({ ...p, r: 2.4 })), max: 6, gain: 2 } },
  },
  {
    name: 'Địa Ngục Phanh Thây', han: '磔刑地獄', sin: 'Đào mộ, trộm mộ',
    punishment: 'Bị phanh thây xé xác.',
    keywords: ['dao mo', 'trom mo', 'pha mo', 'boc mo'],
    def: { mech: 'collect', task: 'Nhặt đồ tuỳ táng, trả về ĐÚNG ngôi mộ cùng màu.', need: 36,
      collect: { targets: [-14, 0, 14].flatMap((x) => [{ x, z: -11, r: 2.6 }, { x, z: -3, r: 2.6 }]), match: true, max: 8, gain: 3 } },
  },
  {
    name: 'Địa Ngục Núi Lửa', han: '火山地獄', sin: 'Tham ô, nhận hối lộ',
    punishment: 'Đày vào núi lửa thiêu đốt.',
    keywords: ['tham o', 'hoi lo', 'tham nhung', 'an hoi lo', 'phong bi'],
    def: { mech: 'hazard', task: 'Đá lửa rơi từ trời! Né vòng đỏ. Mỗi lượt sống sót +1.', need: 30, hazard: { shape: 'circle', per: [5, 9] } },
  },
  {
    name: 'Địa Ngục Cối Xay Đá', han: '石磨地獄', sin: 'Ăn cắp lương thực, ức hiếp dân lành',
    punishment: 'Bỏ vào cối đá mà xay.',
    keywords: ['uc hiep', 'bat nat', 'an hiep', 'cuop com', 'an cap gao', 'luoi', 'an bam'],
    def: { mech: 'mill', task: 'Cùng kéo cối xay đá (E). Đốt vàng mã ở lò bên trái được tính gấp 3.', need: 80 },
  },
  {
    name: 'Địa Ngục Cưa Xẻ', han: '刀鋸地獄', sin: 'Gian thương, lừa đảo, buôn gian bán lận',
    punishment: 'Bị cưa xẻ làm đôi.',
    keywords: ['gian thuong', 'lua dao', 'buon lau', 'ban gian', 'scam', 'hang gia', 'lua dao online', 'deploy'],
    def: { mech: 'saw', task: 'Kéo cưa: đứng ở đầu cưa đang sáng, bấm E — rồi tới lượt đầu bên kia.', need: 50,
      spots: [{ x: -10, z: -4 }, { x: 0, z: -4 }, { x: 10, z: -4 }] },
  },
];
export const FLOORS: Floor[] = RAW.map((f, i) => ({ ...f, level: i + 1 }));
export const floorDef = (level: number) => FLOORS[level - 1].def;

/* ---- Bố cục tĩnh dùng chung ---- */
/** Vi phạm đủ số lần này sẽ bị đày xuống tầng sâu hơn */
export const MAX_STRIKES = 3;

export const SAW_HANDLE = 2.6; // tay cưa cách tâm ±2.6 theo trục x
export const PLATE_R = 1.3;
export const WHACK_R = 3;
export const PUSH_R = 3.8;
export const RHYTHM = { period: 1.0, r: 2.8 };

function seeded(seed: number) {
  let s = seed;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

/** Tầng 3: rừng cây sắt (ô lưới, lấp ngẫu nhiên). */
export const IRON_TREES: XZ[] = (() => {
  const r = seeded(303);
  const out: XZ[] = [];
  for (let x = -22; x <= 22; x += 3.2)
    for (let z = -11; z <= 8; z += 3.2) {
      if (Math.abs(x) < 3 && z < -9) continue;
      if (r() < 0.62) out.push({ x: x + (r() - 0.5) * 0.8, z: z + (r() - 0.5) * 0.8 });
    }
  return out;
})();
export const TREE_HIT_R = 1.05;

/** Tầng 7: bậc đá xoắn ốc lên đỉnh Núi Đao (tâm núi x=0, z=-8). */
export const BLADE_STEPS = (() => {
  const out: { x: number; y: number; z: number; s: number }[] = [];
  for (let i = 0; i < 10; i++) {
    const a = Math.PI / 2 + i * 0.62, rad = 8 - i * 0.42;
    out.push({ x: Math.cos(a) * rad, y: 0.85 * (i + 1), z: -8 + Math.sin(a) * rad, s: 2.6 });
  }
  out.push({ x: 0, y: 8.5, z: -8, s: 4.2 });
  return out;
})();

/** Quỷ sai đi tuần ở các tầng không có chướng ngại riêng — đụng phải là vi phạm. */
export type PatrolPath = { circle: XZ & { r: number } } | { rect: { x0: number; x1: number; z0: number; z1: number } } | 'roam';
export const PATROLS: Record<number, { n: number; speed: number; path: PatrolPath }> = {
  4: { n: 2, speed: 2.6, path: 'roam' },
  5: { n: 2, speed: 3, path: 'roam' },
  6: { n: 2, speed: 3, path: 'roam' },
  7: { n: 2, speed: 3.4, path: { circle: { x: 0, z: -8, r: 10.5 } } },
  8: { n: 2, speed: 2.8, path: 'roam' },
  9: { n: 2, speed: 3, path: 'roam' },
  11: { n: 2, speed: 2.8, path: 'roam' },
  12: { n: 2, speed: 2.6, path: 'roam' },
  13: { n: 2, speed: 3.2, path: { rect: { x0: -11.5, x1: 11.5, z0: -15, z1: 8.2 } } },
  14: { n: 2, speed: 2.4, path: 'roam' },
  17: { n: 2, speed: 3, path: 'roam' },
  18: { n: 2, speed: 3, path: 'roam' },
};
export const PATROL_HIT_R = 1.5;

/** Tầng 13: ao máu (không có nền) & cây cầu. */
export const POND = { x0: -9, x1: 9, z0: -13, z1: 6 };
export const BRIDGE_PLANKS = 12;

/** Các vùng nguy hiểm của tầng dạng hazard. */
export const HAZARD_ROWS = [-12, -8, -4, 0, 4, 8];
export const HAZARD_COLS = [-20, -15, -10, -5, 0, 5, 10, 15, 20];
export const HAZARD_W = 3.6;

export const REBIRTHS = [
  'một đứa trẻ khoẻ mạnh trong gia đình hiền lành',
  'chú chim sẻ trên mái chùa',
  'con trâu cày ruộng chăm chỉ',
  'cây bồ đề trước sân chùa',
  'con cá chép dưới hồ sen',
  'người thầy thuốc cứu người',
  'chú chó giữ nhà trung thành',
  'con tằm nhả tơ',
  'người nông dân được mùa',
  'con mèo nhà phú hộ',
];

export function normalize(s: string) {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd');
}

/** Câu trả lời có nhắc tới tội nào trong 18 tầng không */
export function hasSin(text: string) {
  const t = ' ' + normalize(text).replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ') + ' ';
  return FLOORS.some((f) => f.keywords.some((k) => t.includes(' ' + k + ' ')));
}

/** Diêm Vương phán tội → số tầng (1..18). Khớp nhiều tầng thì lấy tầng sâu nhất. */
export function judge(sinText: string): number {
  const t = ' ' + normalize(sinText).replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ') + ' ';
  // Tầng nào khớp nhiều từ khoá nhất thì lấy; bằng nhau thì lấy tầng sâu hơn
  let best = 0, bestHits = 0;
  FLOORS.forEach((f, i) => {
    const hits = f.keywords.filter((k) => t.includes(' ' + k + ' ')).length;
    if (hits > 0 && hits >= bestHits) {
      best = i + 1;
      bestHits = hits;
    }
  });
  if (best) return best;
  let h = 0;
  for (const c of t) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return (h % FLOORS.length) + 1;
}

export interface FeedItem {
  kind: 'judge' | 'pardon' | 'reborn';
  name: string;
  text: string;
  t: number;
}

export interface BoardRow {
  id: string;
  name: string;
  hue: number;
  merit: number; // tổng công đức qua mọi tầng
  pardons: number; // số lần được ân xá lên tầng
  level: number; // tầng hiện tại / gần nhất
  reborn: boolean; // đã qua cầu Nại Hà đầu thai
}

export interface JudgeResponse {
  id: string;
  level: number;
  ticket: string;
  hue: number;
}
