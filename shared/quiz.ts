// Tầng 1 — Rút Lưỡi: Phán Quan đối chất. Đáp án đúng luôn ở vị trí 0, server sẽ xáo trộn.
export interface Question {
  q: string;
  opts: [string, string, string, string];
}

export const QUESTIONS: Question[] = [
  // — Tình huống: chọn lời thật —
  { q: 'Lỡ tay làm vỡ bình hoa của mẹ. Con nói gì?', opts: ['Nhận lỗi và xin lỗi mẹ', 'Đổ cho con mèo', 'Giấu mảnh vỡ dưới gầm giường', 'Bảo tự nó rơi'] },
  { q: 'Nghe đồn đồng nghiệp làm chuyện xấu, chưa rõ thật giả. Nên làm gì?', opts: ['Không truyền tai khi chưa rõ', 'Kể cho cả phòng nghe', 'Thêm mắm muối cho hấp dẫn', 'Đăng lên nhóm chat'] },
  { q: 'Thu ngân thối dư cho bạn 200 nghìn. Bạn sẽ…', opts: ['Trả lại phần dư', 'Lặng lẽ cầm về', 'Coi như lộc trời cho', 'Đi nhanh kẻo bị gọi lại'] },
  { q: 'Hẹn bạn 7 giờ nhưng chắc chắn sẽ trễ. Nên…', opts: ['Báo trước và xin lỗi', 'Nói dối là kẹt xe', 'Im lặng tới khi bị hỏi', 'Tắt máy luôn'] },
  { q: 'Nhặt được chiếc ví có tiền và giấy tờ. Nên…', opts: ['Tìm cách trả lại cho chủ', 'Lấy tiền, vứt ví', 'Giữ lại chờ chủ hậu tạ', 'Bỏ lại chỗ cũ'] },
  { q: 'Làm sai việc ở công ty, sếp hỏi ai làm. Bạn…', opts: ['Nhận là mình', 'Chỉ sang người mới', 'Đổ tại máy tính', 'Giả vờ không biết'] },
  { q: 'Bạn nhờ điểm danh hộ vì ngủ quên. Bạn…', opts: ['Từ chối, khuyên bạn đi học', 'Ký hộ luôn', 'Ký hộ rồi đòi tiền', 'Ký hộ cả lớp'] },
  { q: 'Bạn thân hỏi áo mới có đẹp không, mà thật ra không hợp. Nói sao?', opts: ['Nói thật nhẹ nhàng, gợi ý màu khác', 'Khen lấy lệ cho xong', 'Chê thẳng là xấu', 'Chụp gửi người khác cùng chê'] },
  { q: 'Bán hàng online, sản phẩm có lỗi nhỏ. Nên…', opts: ['Ghi rõ lỗi cho khách biết', 'Chụp góc khác che lỗi', 'Ghi "hàng mới 100%"', 'Khách hỏi thì chặn'] },
  { q: 'Hai người bạn giận nhau, một người kể xấu người kia với bạn. Bạn…', opts: ['Không đem lời đó kể lại', 'Kể lại cho người kia nghe', 'Thêm vài câu cho to chuyện', 'Đứng giữa kiếm lợi'] },
  // — Âm phủ: hỏi để thử lòng thành —
  { q: 'Địa Ngục Rút Lưỡi trừng phạt tội gì?', opts: ['Nói dối, vu khống, đặt điều', 'Ăn trộm', 'Bất hiếu', 'Lười biếng'] },
  { q: 'Chuộc tội xong, vong hồn qua cây cầu nào?', opts: ['Cầu Nại Hà', 'Cầu Ô Thước', 'Cầu Long Biên', 'Cầu Trường Tiền'] },
  { q: 'Ai múc canh quên lãng ở đầu cầu?', opts: ['Mạnh Bà', 'Thị Mầu', 'Hằng Nga', 'Bà Chúa Kho'] },
  { q: 'Hai quỷ sứ canh cổng địa ngục là…', opts: ['Ngưu Đầu và Mã Diện', 'Thần Tài và Thổ Địa', 'Tôn Ngộ Không và Trư Bát Giới', 'Chú Cuội và Chị Hằng'] },
  { q: 'Âm phủ có bao nhiêu vị Diêm Vương (Thập Điện)?', opts: ['10', '1', '7', '18'] },
  { q: 'Tấm gương soi rõ tội lỗi kiếp trước gọi là…', opts: ['Nghiệt Kính', 'Gương Thần', 'Kính Vạn Hoa', 'Gương Bát Quái'] },
  { q: 'Cổng vào âm phủ tên là…', opts: ['Quỷ Môn Quan', 'Ngọ Môn', 'Cổng Trời', 'Khuê Văn Các'] },
  { q: 'Con sông chảy dưới cầu Nại Hà là…', opts: ['Sông Vong Xuyên', 'Sông Hồng', 'Sông Hương', 'Ngân Hà'] },
  // — Ca dao, tục ngữ về lời nói —
  { q: '“Một lần bất tín…”', opts: ['…vạn lần bất tin', '…vạn lần được tin', '…trăm lần may mắn', '…chẳng sao cả'] },
  { q: '“Mất lòng trước…”', opts: ['…được lòng sau', '…mất lòng sau', '…mất luôn bạn', '…khỏi lo sau'] },
  { q: '“Lời nói chẳng mất tiền mua…”', opts: ['…lựa lời mà nói cho vừa lòng nhau', '…nói bao nhiêu cũng được', '…cứ nói cho sướng miệng', '…im lặng là vàng'] },
  { q: '“Uốn lưỡi … lần trước khi nói”', opts: ['bảy', 'một', 'ba', 'trăm'] },
  { q: '“Nói dối như…”', opts: ['…cuội', '…sáo', '…vẹt', '…rồng'] },
  { q: '“Thuốc đắng dã tật, sự thật…”', opts: ['…mất lòng', '…dễ nghe', '…ngọt ngào', '…vô ích'] },
];

export const QUIZ_SPOTS = [-13.5, -4.5, 4.5, 13.5].map((x) => ({ x, z: 0 }));
export const QUIZ_R = 3.2;
export const QUIZ_TIME = { ask: 13, reveal: 4.5 };
export const LETTERS = ['A', 'B', 'C', 'D'];

/** Dữ liệu câu hỏi hiện tại, server gửi xuống dưới dạng JSON trong state.quiz */
export interface QuizView {
  n: number; // số thứ tự câu
  q: string;
  opts: string[];
  phase: 'wait' | 'ask' | 'reveal';
  left: number; // giây còn lại
  counts: number[]; // số hồn đứng ở mỗi ô
  ans: number; // -1 khi chưa lộ đáp án
  whisper: number; // ô mà Quỷ Dối Trá xúi chọn
}
