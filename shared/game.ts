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
    name: 'Bạt Thiệt Địa Ngục', han: '拔舌地獄', sin: 'Nói dối, phỉ báng, thêu dệt chuyện, chia rẽ người khác',
    punishment: 'Kéo lưỡi — quỷ sai banh miệng, dùng kìm kéo lưỡi dài ra.',
    keywords: ['noi doi', 'vu khong', 'dat dieu', 'bia chuyen', 'noi lao', 'xao lol', 'noi xau', 'phi bang', 'theu det', 'chia re'],
    def: { mech: 'quiz', task: 'Phán Quan đối chất: chạy tới ô đáp án thật (A/B/C/D) trước khi hết giờ. Đừng tin Quỷ Dối Trá!', need: 40 },
  },
  {
    name: 'Tiễn Đao Địa Ngục', han: '剪刀地獄', sin: 'Xúi giục góa phụ tái giá, làm chuyện trái đạo đức',
    punishment: 'Cắt ngón tay — kéo sắt cắt đứt mười ngón tay.',
    keywords: ['xui giuc', 'pha dam', 'chia uyen re thuy', 'xui bay', 'trai dao duc', 'vo dao duc', 'xui ga', 'tai gia'],
    def: { mech: 'hazard', task: 'Kéo sắt quét ngang từng dải. Né dải đỏ! Mỗi lượt sống sót +1.', need: 30, hazard: { shape: 'row', per: [2, 3] } },
  },
  {
    name: 'Thiết Thụ Địa Ngục', han: '鐵樹地獄', sin: 'Làm phân ly cốt thịt, chia rẽ gia đình người khác',
    punishment: 'Cắm vào cây dao nhọn — treo lên cây sắt mọc đầy lưỡi dao.',
    keywords: ['ly gian', 'bat hoa', 'chia re anh em', 'gay go', 'gay chia re', 'chia re gia dinh', 'pha gia dinh', 'phan ly'],
    def: { mech: 'climb', task: 'Luồn qua rừng cây sắt, không chạm lưỡi dao, đến rung Chuông Sám Hối.', need: 30,
      climb: { goal: { x: 0, z: -14.5, y: 0, r: 2.6 }, gain: 3 } },
  },
  {
    name: 'Nghiệt Kính Địa Ngục', han: '孽鏡地獄', sin: 'Che giấu tội lỗi, chạy tội khi còn sống',
    punishment: 'Soi gương thấy tội trạng — mọi tội đã làm hiện rõ trong gương.',
    keywords: ['che giau', 'tron toi', 'choi toi', 'khong nhan', 'chui toi', 'giau giem', 'chay toi'],
    def: { mech: 'plates', task: 'Mỗi hồn đứng trước một tấm gương. Tất cả gương phải cùng sáng!', need: 60, spots: ring(8, 9, -2) },
  },
  {
    name: 'Chưng Lung Địa Ngục', han: '蒸籠地獄', sin: 'Tung tin đồn thất thiệt, vu khống, bôi nhọ người khác',
    punishment: 'Hấp trong lồng lớn — hấp chín rồi lại hấp.',
    keywords: ['buon chuyen', 'thi phi', 'drama', 'hong chuyen', 'ngoi le', 'tin don', 'tung tin', 'boi nho', 'fake news'],
    def: { mech: 'whack', task: 'Lồng hấp đang phun hơi! Lại gần, bấm E liên tục để khoá van.', need: 40, hp: 5,
      spots: [...[-15, -5, 5, 15].flatMap((x) => [{ x, z: -9 }, { x, z: 0 }]), { x: -10, z: 7 }, { x: 10, z: 7 }] },
  },
  {
    name: 'Đồng Trụ Địa Ngục', han: '銅柱地獄', sin: 'Giết người, phóng hỏa',
    punishment: 'Ôm cột đồng nung đỏ — da thịt cháy xèo xèo.',
    keywords: ['phong hoa', 'dot nha', 'pha hoai', 'dot pha', 'giet nguoi', 'sat nhan', 'an mang'],
    def: { mech: 'collect', task: 'Múc nước ở giếng (trái), gánh đến dội nguội các cột đồng.', need: 40,
      collect: { source: { x: -18, z: 8 }, targets: [{ x: -6, z: -7, r: 2.8 }, { x: 6, z: -7, r: 2.8 }, { x: -6, z: 2, r: 2.8 }, { x: 6, z: 2, r: 2.8 }], max: 6, gain: 2 } },
  },
  {
    name: 'Đao Sơn Địa Ngục', han: '刀山地獄', sin: 'Sát sinh, coi thường thần linh',
    punishment: 'Trèo núi dao — leo núi cắm đầy đao nhọn.',
    keywords: ['sat sinh', 'giet vat', 'san ban', 'cau ca', 'bat kinh than', 'pha chua', 'coi thuong than linh', 'bang bo'],
    def: { mech: 'climb', task: 'Nhảy (Space) theo bậc đá, leo lên đỉnh Núi Đao.', need: 32, climb: { goal: { x: 0, z: -8, y: 8.5, r: 2.4 }, gain: 4 } },
  },
  {
    name: 'Băng Sơn Địa Ngục', han: '冰山地獄', sin: 'Ngoại tình, phá thai ác ý, cờ bạc, bất hiếu',
    punishment: 'Trèo núi băng — bị đày lên núi băng giá buốt.',
    keywords: ['ngoai tinh', 'pha thai', 'co bac', 'danh bac', 'ca do', 'bat hieu', 'phu bac', 'cam sung', 'bo nguoi yeu'],
    def: { mech: 'push', task: 'Cùng nhau đẩy khối băng (E) vào hố lửa phía bắc.', need: 50, push: { from: { x: 0, z: 8 }, to: { x: 0, z: -11 } } },
  },
  {
    name: 'Dầu Oa Địa Ngục', han: '油鍋地獄', sin: 'Trộm cắp, tàn ác, phỉ báng',
    punishment: 'Ném vào chảo dầu sôi — dầu sôi sùng sục.',
    keywords: ['trom', 'cuop', 'an cap', 'moc tui', 'an trom', 'cuop giat', 'tan ac', 'doc ac'],
    def: { mech: 'whack', task: 'Lửa dưới vạc dầu bùng lên! Lại gần, bấm E liên tục để dập.', need: 40, hp: 6,
      spots: [-12, 0, 12].flatMap((x) => [{ x, z: -8 }, { x, z: 2 }]) },
  },
  {
    name: 'Ngưu Khanh Địa Ngục', han: '牛坑地獄', sin: 'Sát hại, ngược đãi súc vật để làm trò vui',
    punishment: 'Trâu bò húc giẫm — thả vào hố cho trâu húc, trâu giẫm.',
    keywords: ['nguoc dai', 'danh cho', 'danh meo', 'bo roi thu cung', 'dam cho', 'hanh ha thu', 'giet cho', 'giet meo'],
    def: { mech: 'hazard', task: 'Trâu điên lao dọc từng làn. Né làn đỏ! Mỗi lượt sống sót +1.', need: 30, hazard: { shape: 'col', per: [2, 4] } },
  },
  {
    name: 'Thạch Áp Địa Ngục', han: '石壓地獄', sin: 'Giết con vì trọng nam khinh nữ, bỏ rơi trẻ tàn tật',
    punishment: 'Tảng đá đè — đá nghìn cân đè bẹp.',
    keywords: ['bo con', 'bo roi con', 'hat hui', 'bo mac', 'giet con', 'trong nam khinh nu', 'bo roi tre'],
    def: { mech: 'push', task: 'Tảng đá đang đè các vong hồn. Cùng nhau đẩy (E) lăn nó đi!', need: 50, push: { from: { x: -13, z: -2 }, to: { x: 14, z: -2 } } },
  },
  {
    name: 'Thung Cữu Địa Ngục', han: '舂臼地獄', sin: 'Lãng phí lương thực, chà đạp ngũ cốc, ăn nói thô tục',
    punishment: 'Giã trong cối lớn — chày đá giã liên hồi.',
    keywords: ['phi pham', 'lang phi', 'bo com', 'an thua', 'do com', 'vut do an', 'chui tuc', 'noi tuc', 'chui bay', 'tho tuc'],
    def: { mech: 'rhythm', task: 'Đứng cạnh cối, bấm E ĐÚNG NHỊP trống. Càng nhiều người cùng nhịp càng nhanh.', need: 50,
      spots: [{ x: -5, z: -6 }, { x: 5, z: -6 }, { x: -5, z: 2 }, { x: 5, z: 2 }] },
  },
  {
    name: 'Huyết Trì Địa Ngục', han: '血池地獄', sin: 'Bất hiếu với cha mẹ, gian trá, không giữ lòng ngay thẳng',
    punishment: 'Dìm trong bể máu — ngụp lặn trong máu tanh hôi.',
    keywords: ['bat hieu voi cha me', 'cai bo', 'cai me', 'gian tra', 'bat chinh', 'vo le', 'bat kinh', 'xuc pham'],
    def: { mech: 'collect', task: 'Vác ván gỗ (góc trái) đến bờ ao để bắc cầu qua Ao Máu.', need: 40,
      collect: { source: { x: -19, z: 10 }, targets: [{ x: 0, z: 7.5, r: 3.2 }], max: 6, gain: 2 } },
  },
  {
    name: 'Uổng Tử Địa Ngục', han: '枉死城', sin: 'Tự sát, không trân trọng sinh mệnh cha mẹ ban cho',
    punishment: 'Giam giữ không được đầu thai — xiềng xích trong thành u tối.',
    keywords: ['tu sat', 'tu tu', 'muon chet', 'uong tu', 'chet oan', 'chet uong', 'coi thuong mang song'],
    def: { mech: 'collect', task: 'Mang đèn từ miếu (trái) thắp lên các đèn đá, dẫn lối cho vong hồn.', need: 36,
      collect: { source: { x: -18, z: 9 }, targets: ring(6, 11, -3).map((p) => ({ ...p, r: 2.4 })), max: 6, gain: 2 } },
  },
  {
    name: 'Trách Hình Địa Ngục', han: '磔刑地獄', sin: 'Đào trộm mộ, xâm phạm người đã khuất',
    punishment: 'Phanh thây xẻ thịt — bốn sợi thừng kéo căng tứ chi.',
    keywords: ['dao mo', 'trom mo', 'pha mo', 'boc mo', 'xam pham mo'],
    def: { mech: 'collect', task: 'Nhặt đồ tuỳ táng, trả về ĐÚNG ngôi mộ cùng màu.', need: 36,
      collect: { targets: [-14, 0, 14].flatMap((x) => [{ x, z: -11, r: 2.6 }, { x, z: -3, r: 2.6 }]), match: true, max: 8, gain: 3 } },
  },
  {
    name: 'Hỏa Sơn Địa Ngục', han: '火山地獄', sin: 'Tham nhũng, cướp bóc, đốt phá, tu sĩ phá giới',
    punishment: 'Thiêu trong núi lửa — dung nham thiêu thành than.',
    keywords: ['tham o', 'hoi lo', 'tham nhung', 'an hoi lo', 'phong bi', 'cuop boc', 'pha gioi'],
    def: { mech: 'hazard', task: 'Đá lửa rơi từ trời! Né vòng đỏ. Mỗi lượt sống sót +1.', need: 30, hazard: { shape: 'circle', per: [5, 9] } },
  },
  {
    name: 'Thạch Ma Địa Ngục', han: '石磨地獄', sin: 'Tham quan ô lại, ức hiếp dân lành, lãng phí thực phẩm',
    punishment: 'Nghiền nát thành bột — bỏ vào cối đá mà xay.',
    keywords: ['uc hiep', 'bat nat', 'an hiep', 'tham quan', 'o lai', 'cuop com', 'an cap gao', 'an bam'],
    def: { mech: 'mill', task: 'Cùng kéo cối xay đá (E). Đốt vàng mã ở lò bên trái được tính gấp 3.', need: 80 },
  },
  {
    name: 'Đao Cư Địa Ngục', han: '刀鋸地獄', sin: 'Gian lận buôn bán, ăn bớt vật liệu, lừa gạt phụ nữ và trẻ em',
    punishment: 'Trói cột và cưa từ dưới lên.',
    keywords: ['gian thuong', 'lua dao', 'buon lau', 'ban gian', 'scam', 'hang gia', 'lua dao online', 'deploy', 'an bot', 'rut ruot', 'lua gat', 'lua phu nu', 'lua tre em'],
    def: { mech: 'saw', task: 'Kéo cưa: đứng ở đầu cưa đang sáng, bấm E — rồi tới lượt đầu bên kia.', need: 50,
      spots: [{ x: -10, z: -4 }, { x: 0, z: -4 }, { x: 10, z: -4 }] },
  },
];
export const FLOORS: Floor[] = RAW.map((f, i) => ({ ...f, level: i + 1 }));
/** Bố cục bản đồ của tầng (vị trí cảnh vật) */
export const floorDef = (level: number) => FLOORS[level - 1].def;

/* ---- Pháp Trường: mỗi tầng có một dãy cọc hành hình ngay trước bãi xuất hiện ----
   Hồn tự đi tới, bấm "Chấp nhận sám hối" thì bị trói vào cọc (mỗi tầng một cọc, ai tới trước chịu trước) và bị hành hình
   ngay (EXEC_DELAY giây sau), mỗi người một lượt riêng, không chờ ai: PAIN_ROUNDS hiệp,
   nghỉ PAIN_REST giây giữa các hiệp. Chịu xong thì bị giải lên tầng trên; xong tầng 1 thì đầu thai. */
export const EXEC_SPOTS: XZ[] = [{ x: 0, z: 8.5 }]; // mỗi tầng chỉ một cọc
export const EXEC_ZONE = { x0: -3, x1: 3, z0: 6.5, z1: 10.5 };
export const EXEC_DELAY = 2;
/* Áp giải: bấm E ở bất cứ đâu là nhận tội, Ngưu Đầu Mã Diện tới lôi ra cọc.
   Ai lì không nhận tội sau RESIST_SEC giây thì bị coi là chống cự và bị cưỡng chế áp giải. */
export const RESIST_SEC = 25;
export const ESCORT_SPEED = 3.2; // đơn vị/giây
/** Chỗ đứng chờ khi cọc đang có người (xếp hàng hai bên Pháp Trường) */
export const EXEC_WAIT: XZ[] = [{ x: -4.6, z: 11.6 }, { x: 4.6, z: 11.6 }, { x: -6.4, z: 12.6 }, { x: 6.4, z: 12.6 }, { x: -8.2, z: 13.4 }, { x: 8.2, z: 13.4 }];
/** Đao phủ đứng cạnh cọc */
export const HEADSMAN = { x: 1.9, z: 8.1 };
export const nearExec = (x: number, z: number) =>
  x > EXEC_ZONE.x0 - 1.5 && x < EXEC_ZONE.x1 + 1.5 && z > EXEC_ZONE.z0 - 1.5 && z < EXEC_ZONE.z1 + 2.5;

export const PAIN = { enter: 1, round: 2 } as const;
export const PAIN_DUR: Record<number, number> = { 1: 6, 2: 5 };
export const PAIN_ROUNDS = 3;
export const PAIN_REST = 3;
/** Cảnh hành hình của từng tầng (theo thứ tự tầng 1..18) */
export const TORMENTS: string[] = [
  'Ngưu Đầu banh miệng, dùng kìm sắt kéo lưỡi dài ra ba thước!',
  'Kéo sắt khổng lồ cắt phập từng ngón tay!',
  'Bị treo lên cây sắt, lưỡi dao xuyên khắp người!',
  'Gương Nghiệt chiếu rõ tội lỗi, không thể chối cãi!',
  'Bị nhốt vào lồng hấp, hơi nóng hấp chín cả người!',
  'Bị trói ôm cột đồng nung đỏ, da thịt cháy xèo xèo!',
  'Đao nhọn từ dưới đất đâm xuyên lên người!',
  'Bị đày lên núi băng, đông cứng trong giá buốt!',
  'Bị ném vào vạc dầu đang sôi sùng sục!',
  'Trâu điên lao tới húc tung lên trời!',
  'Tảng đá nghìn cân rơi xuống đè bẹp!',
  'Bị bỏ vào cối lớn, chày đá giã liên hồi!',
  'Bị dìm xuống bể máu tanh hôi, vùng vẫy không thoát!',
  'Xiềng xích giam cầm, không bao giờ được đầu thai!',
  'Bốn sợi thừng kéo căng tứ chi, phanh thây xé xác!',
  'Dung nham phun trào, thiêu cháy thành than!',
  'Bị cối đá nghiền nát thành bột!',
  'Bị trói vào cột, cưa sắt cưa từ dưới lên!',
];
/** Tiếng kêu của hồn đang chịu hình */
export const SCREAMS = [
  'Áaaaa! Con biết tội rồi!', 'Tha cho con!', 'Đau quá!!!', 'Con lạy các ngài!', 'Ối giời ơi!', 'Không dám nữa đâu!', 'Cứu với!!!',
];

/* ---- Bố cục tĩnh dùng chung ---- */
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
  level?: number; // tầng liên quan (để loa âm phủ đọc tên tầng, tội)
  who?: string; // id hồn — để không đọc lại tin của chính mình
  as?: string; // kiếp sau (khi đầu thai)
}

export interface BoardRow {
  id: string;
  name: string;
  hue: number;
  pardons: number; // số tầng đã chịu xong hình phạt
  level: number; // tầng hiện tại / gần nhất
  reborn: boolean; // đã qua cầu Nại Hà đầu thai
}

export interface JudgeResponse {
  id: string;
  level: number;
  ticket: string;
  hue: number;
}
