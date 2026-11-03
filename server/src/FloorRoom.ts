import { Room, type Client, type Delayed } from '@colyseus/core';
import { BOUNDS, ESCORT_SPEED, EXEC_DELAY, EXEC_SPOTS, EXEC_WAIT, FLOORS, PAIN, PAIN_DUR, PAIN_REST, PAIN_ROUNDS, REBIRTHS, RESIST_SEC, SPAWN } from '../../shared/game.ts';
import { FloorState, Player } from './schema.ts';
import { addFeed, consumeTicket, countSoul, hub, issueTicket, leaderboard, notePardon, stats, type Soul } from './hub.ts';

const clean = (s: unknown, n: number) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, n);
const num = (v: unknown, fb: number) => (Number.isFinite(Number(v)) ? Number(v) : fb);

/**
 * Một tầng địa ngục với một Pháp Trường (một cọc). Hồn bấm "Nhận tội" ở đâu cũng được: Ngưu Đầu
 * Mã Diện tới áp giải ra cọc (cọc bận thì đứng chờ). Lì không nhận sau RESIST_SEC giây là chống cự,
 * bị cưỡng chế lôi đi. Tới cọc thì bị trói và hành hình.
 * Chịu đủ PAIN_ROUNDS hiệp thì bị giải lên tầng trên (tầng 1 thì đầu thai).
 */
export class FloorRoom extends Room<{ state: FloorState }> {
  maxClients = 40;
  state = new FloorState();

  private last = new Map<string, Record<string, number>>();
  private off: (() => void)[] = [];
  /** Hẹn giờ bước kế tiếp của từng hồn đang ở Pháp Trường */
  private timers = new Map<string, Delayed>();
  /** Hẹn giờ cưỡng chế áp giải nếu hồn không chịu nhận tội */
  private seize = new Map<string, Delayed>();
  private released = new Set<string>();

  onCreate(options: { level: number }) {
    const level = Math.max(1, Math.min(FLOORS.length, Math.floor(num(options?.level, 1))));
    this.state.level = level;
    this.state.need = PAIN_ROUNDS;
    this.patchRate = 1000 / 20;

    // Chuyển tin toàn cục (Sổ Sinh Tử, số hồn mỗi tầng) xuống client của phòng này
    const onFeed = (item: unknown) => this.broadcast('feed', item);
    const onStats = (s: number[]) => this.broadcast('stats', s);
    const onBoard = (b: unknown) => this.broadcast('board', b);
    hub.on('feed', onFeed);
    hub.on('stats', onStats);
    hub.on('board', onBoard);
    this.off.push(() => hub.off('feed', onFeed), () => hub.off('stats', onStats), () => hub.off('board', onBoard));

    this.onMessage('move', (client, d: any) => {
      const p = this.state.players.get(client.sessionId);
      if (!p || p.slot >= 0 || p.esc) return; // bị trói vào cọc / đang bị áp giải thì không tự đi được
      p.x = Math.max(-BOUNDS.x, Math.min(BOUNDS.x, num(d?.x, p.x)));
      p.z = Math.max(-BOUNDS.z, Math.min(BOUNDS.z, num(d?.z, p.z)));
      p.y = Math.max(-20, Math.min(14, num(d?.y, 0)));
      p.r = num(d?.r, p.r);
    });

    this.onMessage('chat', (client, text) => {
      const t = clean(text, 80);
      if (!t || !this.throttle(client, 'chat', 700)) return;
      this.broadcast('chat', { id: client.sessionId, text: t });
    });

    this.onMessage('accept', (client) => this.accept(client));
    this.setSimulationInterval((dt) => this.march(dt / 1000), 50);
  }

  onAuth(_client: Client, options: any) {
    const soul = consumeTicket(options?.ticket);
    if (!soul || soul.level !== this.state.level) throw new Error('Vé xuống tầng không hợp lệ');
    return soul;
  }

  onJoin(client: Client) {
    const soul = client.auth as Soul;
    const p = new Player();
    p.name = soul.name;
    p.sin = soul.sin;
    p.hue = soul.hue;
    p.x = SPAWN.x - 4 + Math.random() * 8;
    p.z = SPAWN.z - 1 + Math.random() * 2;
    p.y = 0;
    p.r = Math.PI;
    p.slot = -1;
    p.served = 0;
    p.pain = 0;
    p.esc = 0;
    this.state.players.set(client.sessionId, p);
    client.send('resist', { sec: RESIST_SEC });
    this.seize.set(client.sessionId, this.clock.setTimeout(() => this.escort(client, true), RESIST_SEC * 1000));
    countSoul(this.state.level, +1);
    client.send('stats', stats());
    client.send('board', leaderboard());
  }

  onLeave(client: Client) {
    if (this.state.players.delete(client.sessionId)) countSoul(this.state.level, -1);
    this.last.delete(client.sessionId);
    this.timers.get(client.sessionId)?.clear();
    this.timers.delete(client.sessionId);
    this.seize.get(client.sessionId)?.clear();
    this.seize.delete(client.sessionId);
    this.released.delete(client.sessionId);
  }

  onDispose() {
    this.off.forEach((f) => f());
    this.timers.forEach((t) => t.clear());
    this.seize.forEach((t) => t.clear());
  }

  private throttle(client: Client, key: string, ms: number) {
    const rec = this.last.get(client.sessionId) ?? {};
    this.last.set(client.sessionId, rec);
    const now = Date.now();
    if (now - (rec[key] ?? 0) < ms) return false;
    rec[key] = now;
    return true;
  }

  private later(client: Client, sec: number, f: () => void) {
    this.timers.get(client.sessionId)?.clear();
    this.timers.set(
      client.sessionId,
      this.clock.setTimeout(() => {
        this.timers.delete(client.sessionId);
        if (this.state.players.has(client.sessionId)) f();
      }, sec * 1000),
    );
  }

  /* ---------- Pháp Trường ---------- */
  /** Hồn bấm nhận tội (ở bất cứ đâu): quỷ sai tới áp giải. */
  private accept(client: Client) {
    if (!this.throttle(client, 'accept', 500)) return;
    const p = this.state.players.get(client.sessionId);
    if (p && p.slot < 0 && p.served >= PAIN_ROUNDS) return this.release(client); // chịu xong rồi, đồng ý đi tiếp
    this.escort(client, false);
  }

  /** Bắt đầu áp giải hồn ra Pháp Trường; forced = chống cự nên bị cưỡng chế. */
  private escort(client: Client, forced: boolean) {
    const p = this.state.players.get(client.sessionId);
    this.seize.get(client.sessionId)?.clear();
    this.seize.delete(client.sessionId);
    if (!p || p.slot >= 0 || p.esc || p.served >= PAIN_ROUNDS) return;
    p.esc = forced ? 2 : 1;
    this.broadcast('escort', { id: client.sessionId, name: p.name, forced });
  }

  /** Mỗi nhịp: dắt các hồn đang bị áp giải. Ai tới trước lên cọc trước, còn lại đứng chờ. */
  private march(dt: number) {
    const stakeBusy = () => [...this.state.players.values()].some((q) => q.slot === 0);
    let wait = 0;
    for (const client of this.clients) {
      const p = this.state.players.get(client.sessionId);
      if (!p || !p.esc) continue;
      const free = !stakeBusy();
      const tgt = free ? EXEC_SPOTS[0] : EXEC_WAIT[wait++ % EXEC_WAIT.length];
      const dx = tgt.x - p.x, dz = tgt.z - p.z, d = Math.hypot(dx, dz);
      const step = ESCORT_SPEED * (p.esc === 2 ? 1.25 : 1) * dt; // chống cự thì bị lôi xềnh xệch
      if (d > step) {
        p.x += (dx / d) * step;
        p.z += (dz / d) * step;
        p.y = 0;
        p.r = Math.atan2(dx, dz);
      } else if (free) this.bind(client, p);
      else {
        p.x = tgt.x;
        p.z = tgt.z;
        p.r = Math.atan2(EXEC_SPOTS[0].x - tgt.x, EXEC_SPOTS[0].z - tgt.z);
      }
    }
  }

  /** Trói vào cọc rồi hành hình ngay. */
  private bind(client: Client, p: Player) {
    const s = EXEC_SPOTS[0];
    p.esc = 0;
    p.slot = 0;
    p.x = s.x;
    p.z = s.z;
    p.y = 0;
    p.r = 0; // quay mặt ra phía đám đông
    p.served = 0;
    this.broadcast('bound', { id: client.sessionId, name: p.name });
    this.later(client, EXEC_DELAY, () => this.torment(client, PAIN.enter));
  }

  /** Một hiệp hình phạt; xong thì nghỉ, hoặc được giải lên tầng nếu đã đủ hiệp. */
  private torment(client: Client, kind: number) {
    const p = this.state.players.get(client.sessionId)!;
    p.pain = kind;
    this.later(client, PAIN_DUR[kind], () => {
      p.pain = 0;
      p.served++;
      if (p.served >= PAIN_ROUNDS) {
        this.later(client, 1.2, () => this.unbind(client));
        return;
      }
      client.send('rest', { sec: PAIN_REST, next: p.served + 1 });
      this.later(client, PAIN_REST, () => this.torment(client, PAIN.round));
    });
  }

  /** Chịu đủ hình phạt: cởi trói, cho đứng lại tự do trên tầng; bấm E khi nào sẵn sàng thì đi tiếp. */
  private unbind(client: Client) {
    const p = this.state.players.get(client.sessionId);
    if (!p) return;
    p.slot = -1;
    p.x = EXEC_SPOTS[0].x + (Math.random() < 0.5 ? -3 : 3);
    p.z = EXEC_SPOTS[0].z + 2.6;
    const level = this.state.level;
    client.send('served', { next: level - 1 });
    this.broadcast('chat', { id: client.sessionId, text: 'Chịu xong rồi… 😮‍💨' }, { except: client });
  }

  /** Hồn đồng ý đi tiếp: lên tầng trên, hoặc đầu thai nếu đang ở tầng 1. */
  private release(client: Client) {
    // mạng chậm, bấm E nhiều lần → chỉ cho đi tiếp một lần (không phát nhiều vé / đầu thai nhiều lần)
    if (this.released.has(client.sessionId)) return;
    this.released.add(client.sessionId);
    const level = this.state.level;
    const soul = client.auth as Soul;
    notePardon(soul, level, level === 1);
    if (level === 1) {
      addFeed({ kind: 'pardon', name: soul.name, level: 0, who: soul.id, text: 'chịu xong hình phạt tầng cuối, qua cầu Nại Hà đi đầu thai!' });
      const as = REBIRTHS[Math.floor(Math.random() * REBIRTHS.length)];
      client.send('reborn', { as });
      addFeed({ kind: 'reborn', name: soul.name, as, who: soul.id, text: `đã đầu thai thành ${as}` });
      return;
    }
    addFeed({ kind: 'pardon', name: soul.name, level: level - 1, who: soul.id, text: `chịu đủ hình phạt, bị giải lên tầng ${level - 1}` });
    const ticket = issueTicket({ ...soul, level: level - 1 });
    client.send('pardoned', { level: level - 1, ticket });
  }
}
