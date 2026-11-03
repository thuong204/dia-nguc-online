// Kịch bản Chánh Điện: từng oan hồn lần lượt lên trước án Diêm Vương khai tội.
// Mỗi lượt = 1 kịch bản cái chết (rút ngẫu nhiên) + 2 câu hỏi tội (rút ngẫu nhiên từ kho).
// Tội nặng nhất quyết định tầng bị đày; chết oan / chết vì nghĩa thì được xử nhẹ hơn.
import { FLOORS, hasSin, judge, normalize } from './game.ts';

export type Who = 'diem' | 'phan' | 'hac' | 'bach' | 'me';

export interface Opt {
  t: string; // lời khai
  floor?: number; // tội ứng với tầng nào
  oan?: boolean; // chết oan — được xử nhẹ
  nghia?: boolean; // chết vì việc nghĩa — được xử nhẹ
  self?: boolean; // tự vẫn → Uổng Tử
  deny?: boolean; // chối "không có tội" — Gương Nghiệt có thể soi ra
}
export interface Ask {
  who: Who;
  q: string;
  opts: Opt[];
}
export interface Scenario {
  death: string; // Phán Quan đọc từ Sổ Sinh Tử
  ask: Ask; // Diêm Vương hỏi về cái chết
  hidden: number[]; // tội giấu kín Gương Nghiệt có thể soi ra
}

/** Dòng thoại đang diễn ra ở Chánh Điện (server phát cho mọi người) */
export interface CourtLine {
  n: number; // số thứ tự (để client biết dòng mới)
  who: Who;
  name?: string; // tên hồn khi who = 'me'
  text: string;
  opts?: string[]; // đang hỏi: các lời khai để chọn
  left?: number; // giây còn lại để trả lời
}

export const HALL_CELLS = (() => {
  const out: { x: number; z: number }[] = [];
  // 8 cột × 6 hàng = 48 chỗ quỳ, chừa lối thảm đỏ ở giữa
  for (const z of [3.6, 5.4, 7.2, 9, 10.8, 12.6]) for (const x of [-9.2, -7, -4.8, -2.6, 2.6, 4.8, 7, 9.2]) out.push({ x, z });
  return out;
})();
/** Chỗ quỳ trước án khi khai tội */
export const CONFESS_SPOT = { x: 0, z: -1.4 };
export const ANSWER_TIME = 20;

export const SCENARIOS: Scenario[] = [
  {
    death: 'chết đuối dưới sông lúc nửa đêm',
    ask: { who: 'diem', q: 'Nửa đêm ra bờ sông làm gì? Khai mau, vì sao ngươi chết đuối?', opts: [
      { t: 'Con bị kẻ thù xô xuống sông', oan: true },
      { t: 'Con say rượu nên trượt chân', floor: 12 },
      { t: 'Con nhảy xuống cứu một đứa trẻ', nghia: true },
      { t: 'Con buồn đời nên tự gieo mình', self: true },
    ] },
    hidden: [12, 13, 1],
  },
  {
    death: 'tai nạn xe máy trên quốc lộ, xe nát, người không qua khỏi',
    ask: { who: 'diem', q: 'Ngươi phóng xe như bay. Là ngươi gây ra hay kẻ khác hại ngươi?', opts: [
      { t: 'Con bị xe tải vượt ẩu tông phải', oan: true },
      { t: 'Con đua xe, vượt đèn đỏ', floor: 4 },
      { t: 'Con uống rượu rồi còn lái xe', floor: 12 },
      { t: 'Con vội chở mẹ đi viện', nghia: true },
    ] },
    hidden: [4, 9, 1],
  },
  {
    death: 'trúng độc mà chết sau bữa cơm tối',
    ask: { who: 'phan', q: 'Bát canh ấy do ai nấu? Ngươi có biết kẻ bỏ độc không?', opts: [
      { t: 'Do kẻ tranh gia tài với con hạ độc', oan: true },
      { t: 'Con tự ăn nấm lạ hái trong rừng', floor: 7 },
      { t: 'Chính con định đầu độc người khác, rồi uống nhầm', floor: 6 },
    ] },
    hidden: [6, 16, 5],
  },
  {
    death: 'bị cướp đâm chết trên đường về nhà',
    ask: { who: 'diem', q: 'Kẻ nào ra tay? Ngươi có làm gì để chuốc lấy họa này?', opts: [
      { t: 'Con chẳng làm gì, bị cướp giết oan', oan: true },
      { t: 'Con nợ nần cờ bạc, bị đòi nợ', floor: 8 },
      { t: 'Con lao vào đỡ dao cho người khác', nghia: true },
      { t: 'Con cũng là kẻ đi cướp, bị đồng bọn phản', floor: 9 },
    ] },
    hidden: [9, 8, 17],
  },
  {
    death: 'ngã từ giàn giáo công trường cao mười tầng',
    ask: { who: 'phan', q: 'Giàn giáo vì sao lại sập? Ngươi là thợ hay là chủ thầu?', opts: [
      { t: 'Con là thợ, chủ thầu ăn bớt sắt thép', oan: true },
      { t: 'Con là chủ thầu, ăn bớt vật liệu', floor: 18 },
      { t: 'Con lười đeo dây an toàn', floor: 12 },
    ] },
    hidden: [18, 17, 16],
  },
  {
    death: 'chết cháy trong căn nhà bốc lửa',
    ask: { who: 'diem', q: 'Ngọn lửa ấy từ đâu mà ra? Nói thật!', opts: [
      { t: 'Hàng xóm thù hằn phóng hỏa', oan: true },
      { t: 'Con đốt nhà để lấy tiền bảo hiểm', floor: 6 },
      { t: 'Con quay lại cứu con mèo trong nhà', nghia: true },
      { t: 'Con để quên bếp lửa khi say rượu', floor: 12 },
    ] },
    hidden: [6, 16, 3],
  },
  {
    death: 'già yếu, qua đời trong giấc ngủ năm tám mươi tuổi',
    ask: { who: 'diem', q: 'Thọ đến tám mươi là phúc. Nhưng cả đời ấy, ngươi sống ra sao?', opts: [
      { t: 'Con sống lương thiện, con cháu đầy đàn', deny: true },
      { t: 'Con giàu có nhờ cho vay nặng lãi', floor: 17 },
      { t: 'Con đối xử tệ với con dâu, trọng nam khinh nữ', floor: 11 },
    ] },
    hidden: [17, 11, 13],
  },
  {
    death: 'đột quỵ khi đang livestream bán hàng lúc ba giờ sáng',
    ask: { who: 'phan', q: 'Ba giờ sáng còn livestream? Hàng ngươi bán là hàng thật hay hàng giả?', opts: [
      { t: 'Hàng thật, con chỉ làm quá sức', deny: true },
      { t: 'Hàng giả, nói là hàng xách tay', floor: 18 },
      { t: 'Con nói xấu đối thủ để câu khách', floor: 5 },
      { t: 'Con bị chủ ép làm đêm, không cho nghỉ', oan: true },
    ] },
    hidden: [18, 5, 1],
  },
  {
    death: 'bị sét đánh giữa cánh đồng',
    ask: { who: 'diem', q: 'Người ta nói kẻ ác bị trời đánh. Ngươi nghĩ vì sao trời đánh ngươi?', opts: [
      { t: 'Con chỉ đi gặt lúa, chết oan', oan: true },
      { t: 'Con vừa thề độc mà nói dối', floor: 1 },
      { t: 'Con vừa đập phá miếu thờ ở đầu làng', floor: 7 },
    ] },
    hidden: [7, 1, 10],
  },
  {
    death: 'tự kết liễu đời mình sau khi vỡ nợ',
    ask: { who: 'diem', q: 'Thân người khó được, sao ngươi lại tự vứt bỏ? Ngươi có hối hận không?', opts: [
      { t: 'Con hối hận, xin Đại Vương thương xót', self: true },
      { t: 'Con nợ cờ bạc, không còn đường thoát', self: true },
      { t: 'Con bị kẻ khác lừa sạch gia sản', self: true, oan: true },
    ] },
    hidden: [8, 14],
  },
  {
    death: 'bị trâu húc chết khi đang đánh đập nó',
    ask: { who: 'phan', q: 'Con trâu hiền lành vì sao lại húc ngươi?', opts: [
      { t: 'Con đánh nó cho vui, nó nổi điên', floor: 10 },
      { t: 'Con bắt nó cày quá sức, đánh đập nó', floor: 10 },
      { t: 'Trâu nhà khác xổng chuồng húc con', oan: true },
    ] },
    hidden: [10, 7],
  },
  {
    death: 'chết trong lúc đào trộm một ngôi mộ cổ, bị đất sập vùi lấp',
    ask: { who: 'diem', q: 'Đêm hôm ra nghĩa địa đào bới — ngươi định lấy gì của người đã khuất?', opts: [
      { t: 'Con đào trộm vàng bạc tùy táng', floor: 15 },
      { t: 'Con bị người ta thuê đào, con không biết', floor: 15, oan: true },
      { t: 'Con đi sửa mộ cho ông bà', deny: true },
    ] },
    hidden: [15, 9],
  },
  {
    death: 'bệnh nặng nằm viện nửa năm rồi mất',
    ask: { who: 'diem', q: 'Lúc bệnh tật, ai chăm sóc ngươi? Ngươi đã chăm sóc ai?', opts: [
      { t: 'Con cái bỏ mặc, con chết cô đơn', oan: true },
      { t: 'Con từng bỏ mặc cha mẹ già y như vậy', floor: 13 },
      { t: 'Con dùng tiền công quỹ chữa bệnh cho mình', floor: 16 },
      { t: 'Con sống tử tế, chỉ là số mệnh', deny: true },
    ] },
    hidden: [13, 16, 12],
  },
  {
    death: 'bị đánh ghen, ngã đập đầu mà chết',
    ask: { who: 'phan', q: 'Đánh ghen ư? Ngươi là người bị phụ hay là kẻ phá hoại gia đình người ta?', opts: [
      { t: 'Con là kẻ phá hoại gia đình người ta', floor: 8 },
      { t: 'Con bị vu oan là người thứ ba', oan: true },
      { t: 'Con xúi người ta bỏ chồng theo con', floor: 2 },
    ] },
    hidden: [8, 3, 2],
  },
];

/** Kho câu hỏi tội — mỗi lượt rút 2 câu */
export const SIN_ASKS: Ask[] = [
  { who: 'diem', q: 'Lời nói của ngươi có từng hại người?', opts: [
    { t: 'Con hay nói dối, thêu dệt chuyện', floor: 1 },
    { t: 'Con tung tin đồn, bôi nhọ người khác', floor: 5 },
    { t: 'Con đặt điều cho gia đình người ta tan nát', floor: 3 },
    { t: 'Con chưa từng', deny: true },
  ] },
  { who: 'diem', q: 'Ngươi đối đãi với cha mẹ ra sao?', opts: [
    { t: 'Con cãi lời, bỏ mặc cha mẹ già', floor: 13 },
    { t: 'Con lừa lấy hết tiền của cha mẹ', floor: 13 },
    { t: 'Con hiếu thảo', deny: true },
  ] },
  { who: 'phan', q: 'Ngươi làm ăn có ngay thẳng không?', opts: [
    { t: 'Con buôn gian bán lận, cân điêu', floor: 18 },
    { t: 'Con tham ô, nhận hối lộ', floor: 16 },
    { t: 'Con ức hiếp người làm công', floor: 17 },
    { t: 'Con làm ăn ngay thẳng', deny: true },
  ] },
  { who: 'diem', q: 'Ngươi đối xử với muôn loài thế nào?', opts: [
    { t: 'Con sát sinh không gớm tay', floor: 7 },
    { t: 'Con hành hạ chó mèo làm trò vui', floor: 10 },
    { t: 'Con thương yêu muôn loài', deny: true },
  ] },
  { who: 'phan', q: 'Cơm gạo trời cho, ngươi có trân trọng?', opts: [
    { t: 'Con ăn thừa đổ bỏ, phí phạm', floor: 12 },
    { t: 'Con chửi tục, ăn nói thô lỗ', floor: 12 },
    { t: 'Con trân trọng từng hạt cơm', deny: true },
  ] },
  { who: 'diem', q: 'Có điều gì ngươi che giấu, chưa dám nhận?', opts: [
    { t: 'Con từng gây tội rồi trốn tội', floor: 4 },
    { t: 'Con đổ tội cho người vô can', floor: 4 },
    { t: 'Con không giấu gì cả', deny: true },
  ] },
  { who: 'phan', q: 'Ngươi có từng lấy thứ không phải của mình?', opts: [
    { t: 'Con trộm cắp, móc túi', floor: 9 },
    { t: 'Con lừa gạt người nhẹ dạ', floor: 9 },
    { t: 'Con chưa từng', deny: true },
  ] },
  { who: 'diem', q: 'Chuyện vợ chồng, tình nghĩa của ngươi thế nào?', opts: [
    { t: 'Con ngoại tình, phụ bạc', floor: 8 },
    { t: 'Con cờ bạc, bỏ bê gia đình', floor: 8 },
    { t: 'Con chung thủy', deny: true },
  ] },
  { who: 'diem', q: 'Với con cái, ngươi có làm tròn bổn phận?', opts: [
    { t: 'Con bỏ rơi đứa con tật nguyền', floor: 11 },
    { t: 'Con trọng nam khinh nữ, hắt hủi con gái', floor: 11 },
    { t: 'Con thương con hết lòng', deny: true },
  ] },
  { who: 'phan', q: 'Ngươi có từng xúi giục người khác làm điều trái đạo?', opts: [
    { t: 'Con xúi người ta bỏ chồng bỏ vợ', floor: 2 },
    { t: 'Con xúi bạn bè làm chuyện xằng bậy', floor: 2 },
    { t: 'Con chưa từng', deny: true },
  ] },
  { who: 'diem', q: 'Ngươi có kính trọng trời đất, thần linh?', opts: [
    { t: 'Con đập phá chùa miếu, báng bổ thần linh', floor: 7 },
    { t: 'Con mượn danh thần thánh để lừa tiền', floor: 16 },
    { t: 'Con luôn kính trọng', deny: true },
  ] },
  { who: 'phan', q: 'Ngươi có ỷ mạnh hiếp yếu bao giờ?', opts: [
    { t: 'Con cậy quyền ức hiếp dân lành', floor: 17 },
    { t: 'Con bắt nạt người yếu thế', floor: 17 },
    { t: 'Con chưa từng', deny: true },
  ] },
];

const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];

export function drawTurn() {
  const sc = pick(SCENARIOS);
  const asks = [...SIN_ASKS].sort(() => Math.random() - 0.5).slice(0, 2);
  return { sc, asks, age: 18 + Math.floor(Math.random() * 60) };
}

export interface Sentence {
  level: number;
  lighter: boolean; // được xử nhẹ (chết oan / vì nghĩa)
  revealed?: number; // tội Gương Nghiệt soi ra
}

/** Phán tầng theo lời khai: tội nặng nhất (tầng sâu nhất) quyết định; oan / nghĩa thì lấy tội nhẹ nhất. */
export function sentence(chosen: Opt[], sc: Scenario, revealed?: number): Sentence {
  if (chosen.some((o) => o.self)) return { level: 14, lighter: false, revealed };
  const floors = chosen.filter((o) => o.floor).map((o) => o.floor!);
  if (revealed) floors.push(revealed);
  const lighter = chosen.some((o) => o.oan || o.nghia);
  if (!floors.length) return { level: lighter ? 1 : pick(sc.hidden.length ? sc.hidden : [1]), lighter, revealed };
  return { level: lighter ? Math.min(...floors) : Math.max(...floors), lighter, revealed };
}

export const floorName = (n: number) => FLOORS[n - 1]?.name ?? '';

/** Hiểu lời tự khai (gõ tay): tội gì → tầng nào, có oan / vì nghĩa / tự vẫn / chối tội không. */
export function classify(text: string): Opt {
  const t = ' ' + normalize(text).replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ') + ' ';
  const has = (...ks: string[]) => ks.some((k) => t.includes(' ' + k + ' '));
  const o: Opt = { t: text };
  if (has('tu tu', 'tu sat', 'tu van', 'tu ket lieu', 'gieo minh', 'treo co', 'uong thuoc doc')) o.self = true;
  if (has('oan', 'bi hai', 'bi giet', 'bi dau doc', 'bi lua', 'bi xo', 'bi tong', 'bi dam', 'bi cuop', 'vo toi', 'bi vu oan', 'bi hai chet')) o.oan = true;
  if (has('cuu nguoi', 'cuu con', 'cuu tre', 'cuu ban', 'xa than', 'hy sinh', 'cuu')) o.nghia = true;
  if (hasSin(text)) o.floor = judge(text);
  else if (!o.self && !o.oan && !o.nghia && has('khong', 'chua tung', 'khong co', 'vo toi', 'luong thien', 'tot', 'hieu thao')) o.deny = true;
  return o;
}
