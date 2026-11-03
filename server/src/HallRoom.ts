// Chánh Điện: các oan hồn quỳ ở các ô trong điện, lần lượt từng người lên trước án khai tội.
// Diêm Vương / Phán Quan hỏi theo kịch bản (shared/court.ts), phán tầng theo mức độ tội rồi cấp vé xuống tầng.
import { Room, type Client } from '@colyseus/core';
import { schema, t } from '@colyseus/schema';
import { randomUUID } from 'node:crypto';
import { FLOORS } from '../../shared/game.ts';
import { ANSWER_TIME, BOT_FILL, BOT_NAMES, HALL_CELLS, classify, drawTurn, floorName, sentence, type CourtLine, type Opt, type Who } from '../../shared/court.ts';
import { addFeed, issueTicket } from './hub.ts';

const Soul = schema({ name: t.string(), hue: t.uint16(), cell: t.int8(), at: t.float64(), state: t.string(), bot: t.boolean() }, 'HallSoul');
type Soul = InstanceType<typeof Soul>;
const HallState = schema({ souls: t.map(Soul), turn: t.string(), line: t.string() }, 'HallState');
type HallState = InstanceType<typeof HallState>;

const clean = (s: unknown, n: number) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, n);
const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];
/** Thời gian đọc một dòng thoại (ms) — đủ cho giọng đọc và người xem livestream */
const readMs = (text: string) => Math.min(7500, Math.max(2600, 1300 + text.length * 55));

class Abort extends Error {}

export class HallRoom extends Room<{ state: HallState }> {
  maxClients = HALL_CELLS.length;
  state = new HallState();
  private n = 0;
  private running = false;
  private answer: ((i: number | Opt) => void) | null = null;
  private ids = new Map<string, string>(); // sessionId -> id hồn (dùng cho Sổ Sinh Tử / bảng xếp hạng)
  private botSeq = 0;

  onCreate() {
    this.state.turn = '';
    this.state.line = '';
    this.onMessage('answer', (client, i) => {
      if (client.sessionId === this.state.turn && this.answer && Number.isInteger(i)) this.answer(i as number);
    });
    // tự khai bằng lời (gõ tay)
    this.onMessage('answerText', (client, text) => {
      const msg = clean(text, 90);
      if (msg && client.sessionId === this.state.turn && this.answer) this.answer(classify(msg));
    });
    this.setSimulationInterval(() => {
      this.fillBots();
      this.next();
    }, 500);
  }

  private freeCell() {
    const taken = new Set([...this.state.souls.values()].map((s) => s.cell));
    return HALL_CELLS.findIndex((_, i) => !taken.has(i));
  }

  /** Giữ điện luôn có khoảng BOT_FILL hồn quỳ (thêm hồn ảo khi vắng). */
  private fillBots() {
    if (!this.clients.length) return; // không ai xem thì thôi
    const used = new Set([...this.state.souls.values()].map((s) => s.name));
    while (this.state.souls.size < BOT_FILL) {
      const cell = this.freeCell();
      if (cell < 0) return;
      const free = BOT_NAMES.filter((n) => !used.has(n));
      const name = free[Math.floor(Math.random() * free.length)] ?? `Oan hồn ${this.botSeq + 1}`;
      used.add(name);
      const s = new Soul();
      Object.assign(s, { name, hue: Math.floor(Math.random() * 360), cell, at: Date.now() + Math.random() * 1000, state: 'kneel', bot: true });
      this.state.souls.set(`bot${++this.botSeq}`, s);
    }
  }

  onJoin(client: Client, options: { name?: string; hue?: number }) {
    let cell = this.freeCell();
    if (cell < 0) {
      // hết ô: một hồn ảo đang quỳ nhường chỗ cho người thật
      const bot = [...this.state.souls.entries()].find(([, s]) => s.bot && s.state === 'kneel');
      if (bot) {
        cell = bot[1].cell;
        this.state.souls.delete(bot[0]);
      }
    }
    const s = new Soul();
    s.name = clean(options?.name, 18) || 'Hồn Vô Danh';
    s.hue = Number.isFinite(options?.hue) ? Math.floor(Number(options.hue)) % 360 : Math.floor(Math.random() * 360);
    s.cell = cell;
    s.at = Date.now();
    s.state = 'kneel';
    s.bot = false;
    this.state.souls.set(client.sessionId, s);
    this.ids.set(client.sessionId, randomUUID());
  }

  onLeave(client: Client) {
    this.state.souls.delete(client.sessionId);
    this.ids.delete(client.sessionId);
  }

  /** Gọi hồn kế tiếp: người thật trước (đến trước lên trước), hết người thật mới tới hồn ảo. */
  private next() {
    if (this.running || !this.clients.length) return;
    const waiting = [...this.state.souls.entries()]
      .filter(([, s]) => s.state === 'kneel')
      .sort((a, b) => Number(a[1].bot) - Number(b[1].bot) || a[1].at - b[1].at);
    if (!waiting.length) return;
    const [id, soul] = waiting[0];
    this.running = true;
    this.trial(id, soul)
      .catch((e) => {
        if (!(e instanceof Abort)) console.error('Chánh Điện lỗi:', e);
      })
      .finally(() => {
        this.running = false;
        this.answer = null;
        this.state.turn = '';
        this.state.line = '';
      });
  }

  private wait(ms: number, id: string) {
    return new Promise<void>((res, rej) =>
      this.clock.setTimeout(() => (this.state.souls.has(id) ? res() : rej(new Abort())), ms),
    );
  }

  private async say(id: string, who: Who, text: string, name?: string) {
    const line: CourtLine = { n: ++this.n, who, text, name };
    this.state.line = JSON.stringify(line);
    await this.wait(readMs(text), id);
  }

  /** Hỏi và chờ hồn đang khai chọn lời khai; hết giờ thì coi như im lặng (chọn ngẫu nhiên). */
  private async ask(id: string, who: Who, q: string, opts: Opt[]): Promise<{ o: Opt; silent: boolean }> {
    const n = ++this.n;
    let left = ANSWER_TIME;
    const publish = () => (this.state.line = JSON.stringify({ n, who, text: q, opts: opts.map((o) => o.t), left } satisfies CourtLine));
    publish();
    return new Promise((res, rej) => {
      const tick = this.clock.setInterval(() => {
        if (!this.state.souls.has(id)) return done(-2);
        left--;
        if (left <= 0) return done(-1);
        publish();
      }, 1000);
      const done = (i: number | Opt) => {
        tick.clear();
        this.answer = null;
        if (typeof i === 'object') return res({ o: i, silent: false });
        if (i === -2) return rej(new Abort());
        if (i < 0 || i >= opts.length) res({ o: pick(opts), silent: true });
        else res({ o: opts[i], silent: false });
      };
      this.answer = done;
      // hồn ảo tự khai sau vài giây
      if (this.state.souls.get(id)?.bot) this.clock.setTimeout(() => this.answer === done && done(Math.floor(Math.random() * opts.length)), 2500 + Math.random() * 3000);
    });
  }

  private async trial(id: string, soul: Soul) {
    const name = soul.name;
    const turn = drawTurn();
    const { sc, age } = turn;
    const asks = soul.bot ? turn.asks.slice(0, 1) : turn.asks; // hồn ảo khai ngắn hơn
    soul.state = 'up';
    this.state.turn = id;
    const chosen: Opt[] = [];

    await this.say(id, 'hac', pick([`Áp giải hồn ${name} lên trước án!`, `Hồn ${name}! Đứng dậy, lên quỳ trước Đại Vương!`, `Tới lượt ngươi, ${name}. Đi!`]));
    await this.say(id, 'phan', `Bẩm Đại Vương, theo Sổ Sinh Tử: hồn ${name}, dương thọ ${age} tuổi, ${sc.death}.`);

    const answerLine = async (a: { o: Opt; silent: boolean }) => {
      chosen.push(a.o);
      if (a.silent) await this.say(id, 'bach', pick(['Hi hi… im lặng à? Để Gương Nghiệt nói thay ngươi!', 'Không chịu khai? Sổ Sinh Tử đã ghi cả rồi.']));
      await this.say(id, 'me', a.o.t, name);
    };

    // 1. hỏi về cái chết — có oan không?
    await answerLine(await this.ask(id, sc.ask.who, sc.ask.q, sc.ask.opts));
    const last = chosen[chosen.length - 1];
    if (last.self) await this.say(id, 'diem', 'Thân người khó được, cha mẹ ban cho, sao lại tự vứt bỏ! Tội này không nhẹ.');
    else if (last.oan) await this.say(id, 'diem', 'Oan có đầu, nợ có chủ. Kẻ hại ngươi rồi sẽ có ngày quỳ ở đây. Ta sẽ xét nhẹ cho ngươi.');
    else if (last.nghia) await this.say(id, 'diem', 'Chết vì việc nghĩa, ta ghi nhận. Công này sẽ trừ bớt tội cho ngươi.');
    else if (last.floor) await this.say(id, pick(['diem', 'phan'] as Who[]), pick(['Hừm… tự chuốc lấy họa. Phán Quan, chép lại!', 'Gieo gió thì gặt bão. Ghi vào sổ!']));

    // 2. hỏi tội
    for (const a of asks) {
      await answerLine(await this.ask(id, a.who, a.q, a.opts));
      const o = chosen[chosen.length - 1];
      if (o.floor) await this.say(id, pick(['diem', 'phan', 'hac'] as Who[]), pick(['Tội này không nhẹ! Chép vào sổ!', 'Hạ quan đã ghi lại từng chữ.', 'Hê… lại thêm một tội.']));
    }

    // 3. Gương Nghiệt soi kẻ chối tội
    let revealed: number | undefined;
    const denied = chosen.filter((o) => o.deny).length;
    if (denied && Math.random() < 0.35 + denied * 0.2) {
      revealed = pick(sc.hidden);
      await this.say(id, 'phan', 'Khoan! Gương Nghiệt đang sáng lên…');
      await this.say(id, 'diem', `Ngươi chối ư? Gương Nghiệt soi rõ: ngươi từng ${FLOORS[revealed - 1].sin.toLowerCase()}! Khai gian trước điện, tội càng thêm nặng!`);
    } else if (denied === chosen.length) {
      await this.say(id, 'diem', 'Gương Nghiệt không soi ra tội lớn. Nhưng làm người, ai mà không có lỗi.');
    }

    // 4. phán
    const s = sentence(chosen, sc, revealed);
    const f = FLOORS[s.level - 1];
    await this.say(id, 'phan', 'Bẩm Đại Vương, Sổ Sinh Tử đã đối chiếu xong.');
    await this.say(id, 'diem', `Phán! Hồn ${name} phạm tội: ${f.sin.toLowerCase()}${s.lighter ? ', nhưng xét có tình tiết được giảm nhẹ' : ''}. Đày xuống Tầng ${s.level}, ${f.name}!`);
    soul.state = 'done';
    if (soul.bot) {
      // hồn ảo: bị áp giải ra cổng rồi biến mất, không ghi Sổ Sinh Tử
      await this.say(id, 'hac', `Đi! Ngưu Đầu, Mã Diện đang chờ ở cổng Tầng ${s.level}.`);
      this.clock.setTimeout(() => this.state.souls.delete(id), 6000);
      return;
    }
    const client = this.clients.find((c) => c.sessionId === id);
    const soulId = this.ids.get(id) ?? randomUUID();
    const ticket = issueTicket({ id: soulId, name, sin: chosen.map((o) => o.t).join('. '), hue: soul.hue, level: s.level });
    addFeed({ kind: 'judge', name, level: s.level, who: soulId, text: `bị đày xuống tầng ${s.level} (${floorName(s.level)}) — ${sc.death}` });
    client?.send('sentenced', { id: soulId, level: s.level, ticket, hue: soul.hue });
    await this.say(id, 'hac', `Đi! Ngưu Đầu, Mã Diện đang chờ ở cổng Tầng ${s.level}.`).catch(() => {});
  }
}
