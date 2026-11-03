// Kịch bản Chánh Điện (bản hài): từng hồn lần lượt lên trước án Diêm Vương khai tội.
// Mỗi lượt = 1 kịch bản cái chết (rút ngẫu nhiên) + 2 câu hỏi tội (rút ngẫu nhiên từ kho).
// Tội nặng nhất quyết định tầng bị đày; chết oan / chết vì nghĩa thì được xử nhẹ hơn.
import { FLOORS, hasSin, judge, normalize } from './game.ts';

export type Who = 'diem' | 'phan' | 'hac' | 'bach' | 'me';

export interface Opt {
  t: string; // lời khai
  floor?: number; // tội ứng với tầng nào
  oan?: boolean; // chết oan — được xử nhẹ
  nghia?: boolean; // chết vì việc nghĩa — được xử nhẹ
  self?: boolean; // không biết quý thân mình (thức trắng, bỏ bữa…) → Uổng Tử
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
    death: 'sặc trân châu khi hút trà sữa size XL quá mạnh',
    ask: { who: 'diem', q: 'Ly trà sữa thứ mấy trong ngày rồi? Khai mau, vì sao ngươi sặc?', opts: [
      { t: 'Bạn con chọc cười đúng lúc con đang hút', oan: true },
      { t: 'Ly thứ năm rồi ạ, con uống cho đỡ phí', floor: 12 },
      { t: 'Con hút giùm ly của bạn kẻo bạn bị béo', nghia: true },
      { t: 'Con thức trắng ba đêm chơi game, uống trà sữa thay cơm', self: true },
    ] },
    hidden: [12, 13, 1],
  },
  {
    death: 'trượt vỏ chuối ngay trước cổng nhà, ngã một cú lộn ba vòng',
    ask: { who: 'diem', q: 'Vỏ chuối ấy là của ai vứt? Nói thật!', opts: [
      { t: 'Thằng em con vứt rồi chối', oan: true },
      { t: 'Chính con vứt, quên mất là mình vứt', floor: 4 },
      { t: 'Con ăn vụng nải chuối cúng trên bàn thờ', floor: 15 },
      { t: 'Con chạy ra nhặt giùm kẻo cụ già trượt', nghia: true },
    ] },
    hidden: [4, 9, 1],
  },
  {
    death: 'ăn liền mười tô bún đậu mắm tôm trong cuộc thi ăn nhanh',
    ask: { who: 'phan', q: 'Mười tô bún đậu! Ngươi thi ăn vì vinh quang hay vì cái gì?', opts: [
      { t: 'Bạn con đăng ký giùm, con bị lừa', oan: true },
      { t: 'Con ăn một nửa rồi bỏ mứa lén lén', floor: 12 },
      { t: 'Con ăn vụng phần của đội bạn', floor: 9 },
    ] },
    hidden: [12, 9, 5],
  },
  {
    death: 'cười quá đà khi xem clip mèo té ghế, cười tới tắt thở',
    ask: { who: 'diem', q: 'Clip gì mà buồn cười dữ vậy? Ngươi có chia sẻ cho ai xem không?', opts: [
      { t: 'Con xem một mình, tự cười rồi tự đi', oan: true },
      { t: 'Con đăng lên mạng kèm tin đồn con mèo nhà hàng xóm', floor: 5 },
      { t: 'Chính con đẩy ghế cho con mèo té để quay clip', floor: 10 },
      { t: 'Con chia sẻ cho bà ngoại đang buồn xem cho vui', nghia: true },
    ] },
    hidden: [5, 10, 1],
  },
  {
    death: 'ngủ gục trong cuộc họp online, bị sếp gọi tên giật mình ngã khỏi ghế',
    ask: { who: 'phan', q: 'Họp online mà ngủ? Camera ngươi bật hay tắt?', opts: [
      { t: 'Con bị sếp bắt họp lúc nửa đêm', oan: true },
      { t: 'Con để ảnh đại diện rồi đi ngủ, giả vờ đang nghe', floor: 4 },
      { t: 'Con đang họp thì nói xấu sếp mà quên tắt mic', floor: 1 },
    ] },
    hidden: [4, 1, 17],
  },
  {
    death: 'bị con ngỗng nhà hàng xóm rượt chạy ba cây số',
    ask: { who: 'diem', q: 'Con ngỗng hiền lành vì sao lại rượt ngươi?', opts: [
      { t: 'Con chỉ đi ngang qua thôi, ngỗng tự rượt', oan: true },
      { t: 'Con chọc nó trước, kéo đuôi nó', floor: 10 },
      { t: 'Con trèo rào hái trộm xoài nhà người ta', floor: 9 },
      { t: 'Con đứng ra che cho đám con nít chạy trước', nghia: true },
    ] },
    hidden: [10, 9, 3],
  },
  {
    death: 'thọ chín mươi tuổi, đi ngủ trưa rồi quên dậy',
    ask: { who: 'diem', q: 'Sống thọ chín mươi là phúc lớn. Nhưng cả đời ấy, ngươi sống ra sao?', opts: [
      { t: 'Con sống vui vẻ, con cháu đầy nhà', deny: true },
      { t: 'Con cho cả xóm vay rồi tính lãi gấp đôi', floor: 17 },
      { t: 'Con chỉ thương cháu trai, cháu gái không cho kẹo', floor: 11 },
    ] },
    hidden: [17, 11, 13],
  },
  {
    death: 'nói quá to khi livestream bán hàng lúc ba giờ sáng, hụt hơi xỉu luôn',
    ask: { who: 'phan', q: 'Ba giờ sáng còn hét "chốt đơn"? Hàng ngươi bán là hàng thật hay hàng giả?', opts: [
      { t: 'Hàng thật, con chỉ hét hơi quá sức', deny: true },
      { t: 'Hàng chợ mà con nói là hàng xách tay', floor: 18 },
      { t: 'Con nói xấu shop bên cạnh để câu khách', floor: 5 },
      { t: 'Con bị chủ shop ép live xuyên đêm', oan: true },
    ] },
    hidden: [18, 5, 1],
  },
  {
    death: 'đứng giữa đồng hét "trời ơi" thì bị sét đánh xém tóc',
    ask: { who: 'diem', q: 'Người ta bảo nói dối bị trời đánh. Ngươi vừa thề gì vậy?', opts: [
      { t: 'Con chỉ đi thả diều, xui thôi', oan: true },
      { t: 'Con vừa thề "con mà ăn vụng thì trời đánh"', floor: 1 },
      { t: 'Con vừa vẽ bậy lên tường miếu đầu làng', floor: 7 },
    ] },
    hidden: [7, 1, 10],
  },
  {
    death: 'thức trắng năm đêm cày phim, ngủ một giấc dài không dậy',
    ask: { who: 'diem', q: 'Thân thể cha mẹ cho mà không biết giữ! Ngươi có hối hận không?', opts: [
      { t: 'Con hối hận, xin Đại Vương cho đi ngủ bù', self: true },
      { t: 'Phim hay quá, con lỡ xem hết ba trăm tập', self: true },
      { t: 'Con bị bạn rủ cày phim, con không cưỡng nổi', self: true, oan: true },
    ] },
    hidden: [8, 14],
  },
  {
    death: 'bị con dê húc bay khi đang chọc nó để quay TikTok',
    ask: { who: 'phan', q: 'Con dê đang gặm cỏ yên lành, vì sao lại húc ngươi?', opts: [
      { t: 'Con chọc nó cho vui để lấy view', floor: 10 },
      { t: 'Con kéo râu nó để quay cảnh hài', floor: 10 },
      { t: 'Dê nhà khác xổng chuồng húc con', oan: true },
    ] },
    hidden: [10, 7],
  },
  {
    death: 'đêm rằm lén ăn vụng mâm cúng, nghẹn xôi gấc',
    ask: { who: 'diem', q: 'Mâm cúng ông bà mà ngươi dám ăn trước! Ngươi định lấy gì nữa?', opts: [
      { t: 'Con ăn hết đĩa xôi với con gà luộc', floor: 15 },
      { t: 'Ông bà báo mộng bảo con ăn đi', floor: 15, oan: true },
      { t: 'Con chỉ dọn mâm giùm thôi ạ', deny: true },
    ] },
    hidden: [15, 9],
  },
  {
    death: 'ăn mì cay cấp bảy khi bị cảm, hắt hơi bay luôn hồn',
    ask: { who: 'diem', q: 'Lúc ốm đau, ai chăm sóc ngươi? Ngươi đã chăm sóc ai?', opts: [
      { t: 'Con cái bận chơi game, không ai nấu cháo', oan: true },
      { t: 'Con từng lờ đi khi mẹ bị cảm y như vậy', floor: 13 },
      { t: 'Con lấy tiền quỹ lớp mua mì cay', floor: 16 },
      { t: 'Con sống tử tế, chỉ là ham ăn cay', deny: true },
    ] },
    hidden: [13, 16, 12],
  },
  {
    death: 'bị người yêu bắt quả tang nhắn tin với người khác, xỉu tại chỗ',
    ask: { who: 'phan', q: 'Bị bắt quả tang ư? Ngươi là người bị phản bội hay là kẻ bắt cá hai tay?', opts: [
      { t: 'Con bắt cá hai tay, à không, ba tay', floor: 8 },
      { t: 'Con nhắn với mẹ mà bị hiểu lầm', oan: true },
      { t: 'Con xúi bạn chia tay để con được tán', floor: 2 },
    ] },
    hidden: [8, 3, 2],
  },
];

/** Kho câu hỏi tội — mỗi lượt rút 2 câu */
export const SIN_ASKS: Ask[] = [
  { who: 'diem', q: 'Cái miệng của ngươi có hay gây chuyện không?', opts: [
    { t: 'Con nói dối như cuội, bịa chuyện như thật', floor: 1 },
    { t: 'Con hóng drama rồi tung tin đồn khắp xóm', floor: 5 },
    { t: 'Con đặt điều cho hai anh em nhà kia cãi nhau', floor: 3 },
    { t: 'Con hiền như cục đất', deny: true },
  ] },
  { who: 'diem', q: 'Ngươi đối đãi với cha mẹ ra sao?', opts: [
    { t: 'Mẹ gọi mười lần con mới dạ một lần', floor: 13 },
    { t: 'Con lấy tiền chợ của mẹ đi mua trà sữa', floor: 13 },
    { t: 'Con hiếu thảo, rửa bát mỗi ngày', deny: true },
  ] },
  { who: 'phan', q: 'Ngươi buôn bán có ngay thẳng không?', opts: [
    { t: 'Con bán hàng order mà bảo hàng có sẵn', floor: 18 },
    { t: 'Con giữ tiền quỹ lớp, tiêu dần dần', floor: 16 },
    { t: 'Con bắt đàn em làm hết bài tập nhóm', floor: 17 },
    { t: 'Con buôn bán thật thà', deny: true },
  ] },
  { who: 'diem', q: 'Ngươi đối xử với chó mèo, gà vịt thế nào?', opts: [
    { t: 'Con hay giật đuôi mèo', floor: 10 },
    { t: 'Con vẽ râu lên mặt con chó đang ngủ', floor: 10 },
    { t: 'Con nuôi tám con mèo, con nào cũng béo', deny: true },
  ] },
  { who: 'phan', q: 'Cơm gạo trời cho, ngươi có trân trọng?', opts: [
    { t: 'Con gọi đồ ăn rồi bỏ mứa một nửa', floor: 12 },
    { t: 'Con ăn nói bậy bạ, văng tục như hát', floor: 12 },
    { t: 'Con vét sạch nồi, liếm cả muỗng', deny: true },
  ] },
  { who: 'diem', q: 'Có điều gì ngươi giấu, chưa dám nhận?', opts: [
    { t: 'Con làm vỡ bình hoa rồi đổ cho con mèo', floor: 4 },
    { t: 'Con giấu bài kiểm tra điểm kém dưới gầm giường', floor: 4 },
    { t: 'Con trong sáng như gương', deny: true },
  ] },
  { who: 'phan', q: 'Ngươi có từng lấy thứ không phải của mình?', opts: [
    { t: 'Con ăn vụng bánh trong tủ lạnh của em', floor: 9 },
    { t: 'Con dùng ké wifi hàng xóm, đoán được mật khẩu', floor: 9 },
    { t: 'Con chưa từng', deny: true },
  ] },
  { who: 'diem', q: 'Chuyện tình cảm của ngươi thế nào?', opts: [
    { t: 'Con nhắn "ngủ ngon" cho ba người một lúc', floor: 8 },
    { t: 'Con mê đánh bài, quên cả hẹn hò', floor: 8 },
    { t: 'Con một lòng một dạ', deny: true },
  ] },
  { who: 'diem', q: 'Với con cái, ngươi có làm tròn bổn phận?', opts: [
    { t: 'Con mải chơi điện thoại, bỏ con ngồi một mình', floor: 11 },
    { t: 'Con chỉ mua quà cho con trai', floor: 11 },
    { t: 'Con thương con hết lòng', deny: true },
  ] },
  { who: 'phan', q: 'Ngươi có từng xúi người khác làm chuyện tào lao?', opts: [
    { t: 'Con xúi bạn tỏ tình với crush giữa sân trường', floor: 2 },
    { t: 'Con xúi cả lớp trốn tiết đi ăn chè', floor: 2 },
    { t: 'Con chưa từng', deny: true },
  ] },
  { who: 'diem', q: 'Ngươi có kính trọng trời đất, thần linh?', opts: [
    { t: 'Con vẽ bậy lên tường đình làng', floor: 7 },
    { t: 'Con giả làm thầy bói lấy tiền lì xì', floor: 16 },
    { t: 'Con luôn kính trọng', deny: true },
  ] },
  { who: 'phan', q: 'Ngươi có ỷ mạnh bắt nạt ai bao giờ?', opts: [
    { t: 'Con giành hết đùi gà phần của em', floor: 17 },
    { t: 'Con bắt bạn nhỏ hơn xách cặp giùm', floor: 17 },
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
  if (has('tu tu', 'tu sat', 'tu van', 'tu ket lieu', 'gieo minh', 'treo co', 'uong thuoc doc', 'thuc trang', 'bo bua', 'cay phim', 'cay game')) o.self = true;
  if (has('oan', 'bi hai', 'bi giet', 'bi dau doc', 'bi lua', 'bi xo', 'bi tong', 'bi dam', 'bi cuop', 'vo toi', 'bi vu oan', 'bi hai chet')) o.oan = true;
  if (has('cuu nguoi', 'cuu con', 'cuu tre', 'cuu ban', 'xa than', 'hy sinh', 'cuu')) o.nghia = true;
  if (hasSin(text)) o.floor = judge(text);
  else if (!o.self && !o.oan && !o.nghia && has('khong', 'chua tung', 'khong co', 'vo toi', 'luong thien', 'tot', 'hieu thao')) o.deny = true;
  return o;
}
