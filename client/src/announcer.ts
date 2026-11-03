// Biến tin Sổ Sinh Tử thành âm thanh + lời đọc của loa âm phủ.
import { FLOORS, type FeedItem } from '../../shared/game.ts';
import { announce, sfx } from './audio.ts';
import { useGame } from './store.ts';

export function announceFeed(it: FeedItem) {
  const me = useGame.getState().soulId;
  const f = it.level ? FLOORS[it.level - 1] : null;
  switch (it.kind) {
    case 'judge':
      if (it.who === me || !f) return; // chính mình vừa nghe Diêm Vương phán rồi
      sfx.chain();
      announce(`${it.name} bị đày xuống Tầng ${f.level}, ${f.name}, vì tội ${f.sin.toLowerCase()}.`);
      break;
    case 'banish':
      if (!f) return;
      sfx.banish();
      announce(`${it.name} vi phạm ba lần, bị đày xuống Tầng ${f.level}, ${f.name}!`, 'hac');
      break;
    case 'pardon':
      if (!f) return; // ân xá ở tầng 1 → đọc ở tin đầu thai
      sfx.bell();
      announce(`${it.name} đủ công đức, được ân xá lên Tầng ${f.level}.`);
      break;
    case 'reborn':
      sfx.pardon();
      announce(`${it.name} đã qua cầu Nại Hà, uống canh Mạnh Bà, đầu thai thành ${it.as ?? 'người mới'}.`, 'manh');
      break;
  }
}
