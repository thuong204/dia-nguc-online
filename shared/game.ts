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
    name: 'Bạt Thiệt Địa Ngục', han: '拔舌地獄', sin: 'Nói dối không chớp mắt, bịa chuyện như thật, đặt điều nói xấu',
    punishment: 'Lưỡi lò xo — lưỡi bị kéo dài ra như lò xo, buông tay là kêu "boing boing".',
    keywords: ['noi doi', 'vu khong', 'dat dieu', 'bia chuyen', 'noi lao', 'xao lol', 'noi xau', 'phi bang', 'theu det', 'chia re'],
    def: { mech: 'quiz', task: 'Phán Quan đối chất: chạy tới ô đáp án thật (A/B/C/D) trước khi hết giờ. Đừng tin Quỷ Nói Phét!', need: 40 },
  },
  {
    name: 'Tiễn Đao Địa Ngục', han: '剪刀地獄', sin: 'Xúi bậy người khác làm chuyện tào lao, phá đám chuyện tình cảm',
    punishment: 'Đầu nấm — kéo khổng lồ cắt tóc thành kiểu đầu nấm, soi gương ngượng chín mặt.',
    keywords: ['xui giuc', 'pha dam', 'chia uyen re thuy', 'xui bay', 'trai dao duc', 'vo dao duc', 'xui ga', 'tai gia'],
    def: { mech: 'hazard', task: 'Kéo cắt tóc khổng lồ quét ngang từng dải. Né dải đỏ kẻo thành đầu nấm! Mỗi lượt sống sót +1.', need: 30, hazard: { shape: 'row', per: [2, 3] } },
  },
  {
    name: 'Thiết Thụ Địa Ngục', han: '鐵樹地獄', sin: 'Đâm bị thóc chọc bị gạo, làm anh em trong nhà cãi nhau',
    punishment: 'Cù lét lông gà — treo lên cây mọc đầy lông gà, bị cù tới cười chảy nước mắt.',
    keywords: ['ly gian', 'bat hoa', 'chia re anh em', 'gay go', 'gay chia re', 'chia re gia dinh', 'pha gia dinh', 'phan ly'],
    def: { mech: 'climb', task: 'Luồn qua rừng cây lông gà, chạm vào là bị cù, đến rung Chuông Sám Hối.', need: 30,
      climb: { goal: { x: 0, z: -14.5, y: 0, r: 2.6 }, gain: 3 } },
  },
  {
    name: 'Nghiệt Kính Địa Ngục', han: '孽鏡地獄', sin: 'Làm sai còn giấu, đổ hết lỗi cho con mèo',
    punishment: 'Ảnh dìm hàng — Gương Nghiệt chiếu toàn ảnh xấu nhất đời ngươi cho cả âm phủ xem.',
    keywords: ['che giau', 'tron toi', 'choi toi', 'khong nhan', 'chui toi', 'giau giem', 'chay toi'],
    def: { mech: 'plates', task: 'Mỗi hồn đứng trước một tấm gương. Tất cả gương phải cùng sáng!', need: 60, spots: ring(8, 9, -2) },
  },
  {
    name: 'Chưng Lung Địa Ngục', han: '蒸籠地獄', sin: 'Hóng drama, tung tin đồn nhảm, buôn chuyện cả xóm',
    punishment: 'Hấp thành bánh bao — nhốt vào xửng hấp, ra lò người tròn vo trắng phau.',
    keywords: ['buon chuyen', 'thi phi', 'drama', 'hong chuyen', 'ngoi le', 'tin don', 'tung tin', 'boi nho', 'fake news'],
    def: { mech: 'whack', task: 'Xửng bánh bao đang phun hơi phì phì! Lại gần, bấm E liên tục để khoá van.', need: 40, hp: 5,
      spots: [...[-15, -5, 5, 15].flatMap((x) => [{ x, z: -9 }, { x, z: 0 }]), { x: -10, z: 7 }, { x: 10, z: 7 }] },
  },
  {
    name: 'Đồng Trụ Địa Ngục', han: '銅柱地獄', sin: 'Gây hoạ to, nghịch lửa đốt phá lung tung',
    punishment: 'Cột điện tóc dựng — ôm cột tích điện, tóc dựng đứng như chổi lông gà.',
    keywords: ['phong hoa', 'dot nha', 'pha hoai', 'dot pha', 'giet nguoi', 'sat nhan', 'an mang'],
    def: { mech: 'collect', task: 'Múc nước ở giếng (trái), gánh đến dội cho các cột điện xì hơi.', need: 40,
      collect: { source: { x: -18, z: 8 }, targets: [{ x: -6, z: -7, r: 2.8 }, { x: 6, z: -7, r: 2.8 }, { x: -6, z: 2, r: 2.8 }, { x: 6, z: 2, r: 2.8 }], max: 6, gain: 2 } },
  },
  {
    name: 'Đao Sơn Địa Ngục', han: '刀山地獄', sin: 'Bắt nạt thú vật nhỏ, ăn nói xấc xược với thần linh',
    punishment: 'Leo núi Lego — trèo núi xếp toàn mảnh Lego, đạp phải là kêu oai oái.',
    keywords: ['sat sinh', 'giet vat', 'san ban', 'cau ca', 'bat kinh than', 'pha chua', 'coi thuong than linh', 'bang bo'],
    def: { mech: 'climb', task: 'Nhảy (Space) theo bậc Lego, leo lên đỉnh núi. Nhẹ chân thôi kẻo đau!', need: 32, climb: { goal: { x: 0, z: -8, y: 8.5, r: 2.4 }, gain: 4 } },
  },
  {
    name: 'Băng Sơn Địa Ngục', han: '冰山地獄', sin: 'Bắt cá hai tay, mê cờ bạc, cãi lời cha mẹ',
    punishment: 'Biến thành que kem — đày lên núi băng, đông cứng thành que kem vị sầu riêng.',
    keywords: ['ngoai tinh', 'pha thai', 'co bac', 'danh bac', 'ca do', 'bat hieu', 'phu bac', 'cam sung', 'bo nguoi yeu'],
    def: { mech: 'push', task: 'Cùng nhau đẩy khối băng (E) vào hố lửa phía bắc.', need: 50, push: { from: { x: 0, z: 8 }, to: { x: 0, z: -11 } } },
  },
  {
    name: 'Dầu Oa Địa Ngục', han: '油鍋地獄', sin: 'Ăn vụng, trộm vặt, chôm đồ hàng xóm',
    punishment: 'Gà rán chiên xù — lăn bột chiên xù rồi thả vào chảo, ra lò giòn rụm.',
    keywords: ['trom', 'cuop', 'an cap', 'moc tui', 'an trom', 'cuop giat', 'tan ac', 'doc ac'],
    def: { mech: 'whack', task: 'Lửa dưới chảo chiên bùng lên! Lại gần, bấm E liên tục để dập kẻo khét.', need: 40, hp: 6,
      spots: [-12, 0, 12].flatMap((x) => [{ x, z: -8 }, { x, z: 2 }]) },
  },
  {
    name: 'Ngưu Khanh Địa Ngục', han: '牛坑地獄', sin: 'Trêu chó chọc mèo, bắt nạt thú cưng để làm trò',
    punishment: 'Bò húc bay — thả vào chuồng bò, bị húc bay lên trời, đầu quay vòng sao.',
    keywords: ['nguoc dai', 'danh cho', 'danh meo', 'bo roi thu cung', 'dam cho', 'hanh ha thu', 'giet cho', 'giet meo'],
    def: { mech: 'hazard', task: 'Bò tót lao dọc từng làn. Né làn đỏ kẻo bị húc bay! Mỗi lượt sống sót +1.', need: 30, hazard: { shape: 'col', per: [2, 4] } },
  },
  {
    name: 'Thạch Áp Địa Ngục', han: '石壓地獄', sin: 'Trọng nam khinh nữ, bỏ bê con cái',
    punishment: 'Gối đè bánh tráng — gối bông khổng lồ đè dẹp lép như bánh tráng.',
    keywords: ['bo con', 'bo roi con', 'hat hui', 'bo mac', 'giet con', 'trong nam khinh nu', 'bo roi tre'],
    def: { mech: 'push', task: 'Cái gối khổng lồ đang đè bẹp các vong hồn. Cùng nhau đẩy (E) lăn nó đi!', need: 50, push: { from: { x: -13, z: -2 }, to: { x: 14, z: -2 } } },
  },
  {
    name: 'Thung Cữu Địa Ngục', han: '舂臼地獄', sin: 'Bỏ mứa cơm, phí phạm đồ ăn, ăn nói bậy bạ',
    punishment: 'Búa chít chít — chày cao su khổng lồ gõ đầu kêu "chít chít" liên hồi.',
    keywords: ['phi pham', 'lang phi', 'bo com', 'an thua', 'do com', 'vut do an', 'chui tuc', 'noi tuc', 'chui bay', 'tho tuc'],
    def: { mech: 'rhythm', task: 'Đứng cạnh cối, bấm E ĐÚNG NHỊP trống. Càng nhiều người cùng nhịp càng nhanh.', need: 50,
      spots: [{ x: -5, z: -6 }, { x: 5, z: -6 }, { x: -5, z: 2 }, { x: 5, z: 2 }] },
  },
  {
    name: 'Huyết Trì Địa Ngục', han: '血池地獄', sin: 'Cãi cha cãi mẹ, gian dối láu cá',
    punishment: 'Tắm bể nước mắm — ngâm trong bể nước mắm, thơm suốt trăm năm không phai.',
    keywords: ['bat hieu voi cha me', 'cai bo', 'cai me', 'gian tra', 'bat chinh', 'vo le', 'bat kinh', 'xuc pham'],
    def: { mech: 'collect', task: 'Vác ván gỗ (góc trái) đến bờ ao để bắc cầu qua Bể Nước Mắm.', need: 40,
      collect: { source: { x: -19, z: 10 }, targets: [{ x: 0, z: 7.5, r: 3.2 }], max: 6, gain: 2 } },
  },
  {
    name: 'Uổng Tử Địa Ngục', han: '枉死城', sin: 'Không biết quý thân mình: thức trắng, bỏ bữa, chẳng chịu chăm lo sức khoẻ',
    punishment: 'Nghe nhạc chờ tổng đài — "cuộc gọi của quý khách rất quan trọng", chờ mãi không ai bắt máy.',
    keywords: ['tu sat', 'tu tu', 'muon chet', 'uong tu', 'chet oan', 'chet uong', 'coi thuong mang song', 'thuc trang', 'bo bua', 'cay phim', 'cay game'],
    def: { mech: 'collect', task: 'Mang đèn từ miếu (trái) thắp lên các đèn đá, dẫn lối cho vong hồn.', need: 36,
      collect: { source: { x: -18, z: 9 }, targets: ring(6, 11, -3).map((p) => ({ ...p, r: 2.4 })), max: 6, gain: 2 } },
  },
  {
    name: 'Trách Hình Địa Ngục', han: '磔刑地獄', sin: 'Nghịch phá mồ mả, ăn vụng đồ cúng ông bà',
    punishment: 'Kéo thành kẹo kéo — bốn quỷ sai kéo tay chân dài thượt như kẹo kéo.',
    keywords: ['dao mo', 'trom mo', 'pha mo', 'boc mo', 'xam pham mo'],
    def: { mech: 'collect', task: 'Nhặt đồ tuỳ táng, trả về ĐÚNG ngôi mộ cùng màu.', need: 36,
      collect: { targets: [-14, 0, 14].flatMap((x) => [{ x, z: -11, r: 2.6 }, { x, z: -3, r: 2.6 }]), match: true, max: 8, gain: 3 } },
  },
  {
    name: 'Hỏa Sơn Địa Ngục', han: '火山地獄', sin: 'Ăn hối lộ, tham của chung, giữ phong bì không chia ai',
    punishment: 'Mì cay cấp 7 — ăn hết tô mì cay cấp 7, phun lửa phì phì như núi lửa.',
    keywords: ['tham o', 'hoi lo', 'tham nhung', 'an hoi lo', 'phong bi', 'cuop boc', 'pha gioi'],
    def: { mech: 'hazard', task: 'Ớt cay rơi từ trời! Né vòng đỏ. Mỗi lượt sống sót +1.', need: 30, hazard: { shape: 'circle', per: [5, 9] } },
  },
  {
    name: 'Thạch Ma Địa Ngục', han: '石磨地獄', sin: 'Cậy quyền bắt nạt người khác, giành phần cơm của bạn',
    punishment: 'Máy giặt vắt — bỏ vào máy giặt chế độ vắt cực mạnh, ra quay mòng mòng.',
    keywords: ['uc hiep', 'bat nat', 'an hiep', 'tham quan', 'o lai', 'cuop com', 'an cap gao', 'an bam'],
    def: { mech: 'mill', task: 'Cùng kéo cối xay đá (E). Đốt vàng mã ở lò bên trái được tính gấp 3.', need: 80 },
  },
  {
    name: 'Đao Cư Địa Ngục', han: '刀鋸地獄', sin: 'Buôn gian bán lận, livestream nói quá, lừa gạt khách hàng',
    punishment: 'Ảo thuật cưa đôi — ảo thuật gia cưa đôi rồi ghép lệch, đầu một nơi chân quay ngược.',
    keywords: ['gian thuong', 'lua dao', 'buon lau', 'ban gian', 'scam', 'hang gia', 'lua dao online', 'deploy', 'an bot', 'rut ruot', 'lua gat', 'lua phu nu', 'lua tre em'],
    def: { mech: 'saw', task: 'Kéo cưa ảo thuật: đứng ở đầu cưa đang sáng, bấm E — rồi tới lượt đầu bên kia.', need: 50,
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
  'Lưỡi bị kéo dài như lò xo, buông ra kêu boing boing!',
  'Kéo khổng lồ xoẹt xoẹt — tóc thành đầu nấm mất rồi!',
  'Lông gà cù khắp người, cười không thở nổi!',
  'Gương Nghiệt chiếu ảnh dìm hàng — cả âm phủ cười lăn!',
  'Bị nhốt vào xửng, ra lò thành bánh bao trắng tròn!',
  'Ôm cột điện, tóc dựng đứng như chổi lông gà!',
  'Leo núi Lego, đạp trúng mảnh nào kêu oai oái mảnh đó!',
  'Đông cứng thành que kem vị sầu riêng!',
  'Lăn bột chiên xù, thả vào chảo — giòn rụm!',
  'Bò tót húc bay lên trời, sao bay vòng vòng!',
  'Gối bông khổng lồ đè dẹp lép như bánh tráng!',
  'Búa cao su gõ đầu chít chít chít chít!',
  'Ngâm bể nước mắm, thơm phức trăm năm!',
  'Nhạc chờ tổng đài phát mãi không dứt… tít tít tít…',
  'Bị kéo dài thượt như kẹo kéo!',
  'Ăn mì cay cấp 7, phun lửa phì phì!',
  'Vào máy giặt vắt cực mạnh, quay mòng mòng!',
  'Bị cưa đôi ảo thuật, ghép lại lệch mất tiêu!',
];
/** Tiếng kêu ối giời của hồn đang chịu phạt */
export const SCREAMS = [
  'Ối giời ơi! Con biết lỗi rồi!', 'Tha cho con đi mà~', 'Hu hu, xấu hổ quá!', 'Con lạy các ngài!', 'Ui da ui da!', 'Lần sau con chừa!', 'Mẹ ơi cứu con!!!',
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
  'con mèo béo của bà bán xôi',
  'chú chó corgi chân ngắn',
  'con vịt bầu biết hát karaoke',
  'cây xương rồng trên bàn làm việc',
  'con cá vàng trí nhớ ba giây',
  'ông chủ quán trà sữa',
  'con gà trống gáy sai giờ',
  'chú chim sẻ hay hóng chuyện',
  'cục pin dự phòng luôn đầy',
  'con heo đất ăn mãi không no',
  'idol TikTok triệu follow',
  'cái wifi nhà hàng xóm không mật khẩu',
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
