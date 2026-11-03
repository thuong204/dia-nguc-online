// Luật chơi của 18 tầng — 9 kiểu cơ chế, mỗi tầng cấu hình riêng trong shared/game.ts.
import type { Client } from '@colyseus/core';
import {
  ARENA_Z, BOUNDS, HAZARD_COLS, HAZARD_ROWS, HAZARD_W, IRON_TREES, PLATE_R, PUSH_R, REACH, RHYTHM,
  SAW_HANDLE, SPOTS, TREE_HIT_R, WHACK_R, type FloorDef,
} from '../../shared/game.ts';
import { QUESTIONS, QUIZ_R, QUIZ_SPOTS, QUIZ_TIME, type QuizView } from '../../shared/quiz.ts';
import { Obj, type Player } from './schema.ts';
import type { FloorRoom } from './FloorRoom.ts';

type P = { x: number; z: number };
const dist = (a: P, b: P) => Math.hypot(a.x - b.x, a.z - b.z);
const rand = (a: number, b: number) => a + Math.random() * (b - a);
let seq = 0;
const nid = (p: string) => `${p}${++seq}`;

export abstract class Activity {
  constructor(protected room: FloorRoom, protected def: FloorDef) {}
  get state() { return this.room.state; }
  protected obj(id: string, kind: string, x: number, z: number, extra: Partial<Obj> = {}) {
    const o = new Obj();
    Object.assign(o, { kind, x, y: 0, z, s: 0, hp: 0, owner: '', ...extra });
    this.state.objects.set(id, o);
    return o;
  }
  init() {}
  tick(_dt: number) {}
  onAct(_c: Client, _p: Player) {}
  onMove(_c: Client, _p: Player) {}
  onRoster() {}
  onLeave(_id: string) {}
}

/* ---------- Kéo cối xay (tầng 17) ---------- */
class Mill extends Activity {
  private lastBurn = new Map<string, number>();
  onAct(c: Client, p: Player) {
    if (dist(p, SPOTS.mill) <= REACH + 0.5) {
      this.room.broadcast('fx', { k: 'push', id: c.sessionId });
      this.room.addProgress(1);
      this.room.credit(c, 1);
    } else if (dist(p, SPOTS.burner) <= REACH + 0.5) {
      const now = Date.now();
      if (now - (this.lastBurn.get(c.sessionId) ?? 0) < 1500) return;
      this.lastBurn.set(c.sessionId, now);
      this.room.broadcast('fx', { k: 'burn', id: c.sessionId });
      this.room.addProgress(3);
      this.room.credit(c, 3);
    }
  }
}

/* ---------- Nhặt & mang về (tầng 1, 6, 13, 14, 15) ---------- */
class Collect extends Activity {
  private wrongWarned = new Set<string>();
  private vel = new Map<string, { vx: number; vz: number }>();
  private spawnT = 0;
  private get cfg() { return this.def.collect!; }
  init() {
    for (let i = 0; i < Math.min(6, this.cfg.max); i++) this.spawn();
    this.updateGoal();
  }
  private spawn() {
    const { source, targets, match, drift } = this.cfg;
    let x: number, z: number;
    if (source) {
      x = source.x + rand(-2, 2);
      z = source.z + rand(-2, 2);
    } else {
      do {
        x = rand(-BOUNDS.x + 2, BOUNDS.x - 2);
        z = rand(-BOUNDS.z + 2, ARENA_Z - 1);
      } while (targets.some((t) => dist({ x, z }, t) < t.r + 3));
    }
    const id = nid('i');
    this.obj(id, 'item', x, z, { y: drift ? 1.6 : 0.4, hp: match ? Math.floor(Math.random() * targets.length) : 255 });
    if (drift) {
      const a = Math.random() * Math.PI * 2, sp = rand(0.8, 2);
      this.vel.set(id, { vx: Math.cos(a) * sp, vz: Math.sin(a) * sp });
    }
  }
  private updateGoal() {
    let free = 0, carried = 0;
    this.state.objects.forEach((o) => (o.owner ? carried++ : free++));
    this.state.goal = `Còn ${free} vật chờ nhặt · ${carried} đang được mang`;
  }
  tick(dt: number) {
    this.spawnT += dt;
    if (this.spawnT > 1.6 && this.state.objects.size < this.cfg.max) {
      this.spawnT = 0;
      this.spawn();
      this.updateGoal();
    }
    this.state.objects.forEach((o, id) => {
      if (o.owner) {
        const p = this.state.players.get(o.owner);
        if (!p) { o.owner = ''; o.y = this.cfg.drift ? 1.6 : 0.4; return; }
        o.x = p.x; o.z = p.z; o.y = p.y + 3;
        return;
      }
      const v = this.vel.get(id);
      if (!v) return;
      o.x += v.vx * dt;
      o.z += v.vz * dt;
      if (Math.abs(o.x) > BOUNDS.x - 1) v.vx *= -1;
      if (o.z > ARENA_Z - 1 || o.z < -BOUNDS.z + 1) v.vz *= -1;
    });
  }
  onMove(c: Client, p: Player) {
    let carrying: string | null = null;
    this.state.objects.forEach((o, id) => { if (o.owner === c.sessionId) carrying = id; });
    if (carrying) {
      const o = this.state.objects.get(carrying)!;
      const ok = this.cfg.targets.some((t, i) => (!this.cfg.match || o.hp === i) && dist(p, t) <= t.r);
      if (!ok && this.cfg.match && !this.wrongWarned.has(carrying)) {
        const wrong = this.cfg.targets.some((t, i) => o.hp !== i && dist(p, t) <= t.r);
        if (wrong) {
          this.wrongWarned.add(carrying);
          this.room.strike(c, '⚰️ Trả nhầm mộ — quấy nhiễu vong linh', true);
        }
      }
      if (ok) {
        this.wrongWarned.delete(carrying);
        this.state.objects.delete(carrying);
        this.vel.delete(carrying);
        this.room.broadcast('fx', { k: 'burst', x: p.x, y: 2.5, z: p.z, c: 'gold' });
        this.room.addProgress(this.cfg.gain);
        this.room.credit(c, this.cfg.gain);
        this.updateGoal();
      }
      return;
    }
    if (p.y > 2.5) return;
    for (const o of this.state.objects.values()) {
      if (!o.owner && dist(p, o) <= 1.9) {
        o.owner = c.sessionId;
        this.room.broadcast('fx', { k: 'burst', x: o.x, y: 1.5, z: o.z, c: 'white' });
        this.updateGoal();
        break;
      }
    }
  }
  onLeave(id: string) {
    this.state.objects.forEach((o) => { if (o.owner === id) o.owner = ''; });
  }
}

/* ---------- Né nguy hiểm (tầng 2, 10, 16) ---------- */
class Hazard extends Activity {
  private t = 0;
  private round = 0;
  private phase: 'idle' | 'warn' | 'strike' = 'idle';
  private get cfg() { return this.def.hazard!; }
  init() { this.state.goal = 'Lượt đầu sắp bắt đầu... vào giữa sân!'; }
  private inZone(p: P, o: Obj) {
    if (this.cfg.shape === 'row') return Math.abs(p.z - o.z) <= HAZARD_W / 2 + 0.4;
    if (this.cfg.shape === 'col') return Math.abs(p.x - o.x) <= HAZARD_W / 2 + 0.4 && p.z < ARENA_Z;
    return dist(p, o) <= o.y + 0.4;
  }
  tick(dt: number) {
    this.t += dt;
    if (this.phase === 'idle' && this.t > 1.4) {
      this.phase = 'warn';
      this.t = 0;
      this.round++;
      this.state.objects.clear();
      const [a, b] = this.cfg.per;
      const n = Math.round(rand(a, b) + Math.min(2, this.round * 0.08));
      if (this.cfg.shape === 'circle') {
        for (let i = 0; i < n; i++) this.obj(nid('z'), 'zone', rand(-22, 22), rand(-15, ARENA_Z - 2), { y: rand(2.4, 4), s: 1, hp: 2 });
      } else {
        const lanes = [...(this.cfg.shape === 'row' ? HAZARD_ROWS : HAZARD_COLS)].sort(() => Math.random() - 0.5).slice(0, n);
        for (const v of lanes) {
          const row = this.cfg.shape === 'row';
          this.obj(nid('z'), 'zone', row ? 0 : v, row ? v : 0, { y: HAZARD_W, s: 1, hp: row ? 0 : 1 });
        }
      }
      this.state.goal = `Lượt ${this.round}: ${n} vùng đỏ sắp đánh xuống — tránh ra!`;
    } else if (this.phase === 'warn' && this.t > 1.5) {
      this.phase = 'strike';
      this.t = 0;
      const zones = [...this.state.objects.values()];
      zones.forEach((o) => (o.s = 2));
      let safe = 0;
      this.room.clients.forEach((c) => {
        const p = this.state.players.get(c.sessionId);
        if (!p || p.z > ARENA_Z) return; // đứng ở bãi an toàn thì không tính
        if (zones.some((o) => this.inZone(p, o))) this.room.strike(c, 'Trúng đòn! Quay về điểm xuất phát');
        else {
          safe++;
          this.room.credit(c, 1);
        }
      });
      if (safe) this.room.addProgress(safe);
      this.state.goal = `Lượt ${this.round}: ${safe} hồn sống sót, mỗi hồn +1`;
    } else if (this.phase === 'strike' && this.t > 1.2) {
      this.phase = 'idle';
      this.t = 0;
      this.state.objects.clear();
    }
  }
}

/* ---------- Vượt chướng ngại đến đích (tầng 3, 7) ---------- */
class Climb extends Activity {
  private lastHit = new Map<string, number>();
  private trees = this.room.state.level === 3;
  init() { this.state.goal = 'Chưa ai đến đích'; }
  private reached = 0;
  onMove(c: Client, p: Player) {
    const g = this.def.climb!.goal;
    if (dist(p, g) <= g.r && p.y >= g.y - 0.6) {
      this.reached++;
      c.send('reached', { msg: `Đến đích! +${this.def.climb!.gain}` });
      this.room.broadcast('fx', { k: 'burst', x: g.x, y: g.y + 2, z: g.z, c: 'gold' });
      this.room.broadcast('fx', { k: 'bell' });
      this.room.addProgress(this.def.climb!.gain);
      this.room.credit(c, this.def.climb!.gain);
      this.state.goal = `Đã có ${this.reached} lượt đến đích`;
      return;
    }
    if (this.trees && p.y < 2) {
      const now = Date.now();
      if (now - (this.lastHit.get(c.sessionId) ?? 0) < 1500) return;
      if (IRON_TREES.some((t) => dist(p, t) < TREE_HIT_R)) {
        this.lastHit.set(c.sessionId, now);
        this.room.strike(c, 'Chạm lưỡi dao cây sắt! Quay lại từ đầu');
      }
    }
  }
}

/* ---------- Đứng kín các ô cùng lúc (tầng 4) ---------- */
class Plates extends Activity {
  private acc = 0;
  init() { this.onRoster(); }
  onRoster() {
    const spots = this.def.spots!;
    const n = Math.max(1, Math.min(spots.length, this.state.players.size));
    spots.forEach((s, i) => {
      const id = 'pl' + i;
      if (i < n && !this.state.objects.has(id)) this.obj(id, 'plate', s.x, s.z);
      else if (i >= n && this.state.objects.has(id)) this.state.objects.delete(id);
    });
  }
  tick(dt: number) {
    const players = [...this.state.players.values()];
    let occ = 0, total = 0;
    this.state.objects.forEach((o) => {
      total++;
      o.s = players.some((p) => p.y < 1.6 && dist(p, o) <= PLATE_R) ? 1 : 0;
      occ += o.s;
    });
    const all = total > 0 && occ === total;
    this.acc += dt;
    if (this.acc >= 0.5) {
      this.acc = 0;
      this.room.addProgress(all ? 1 : this.state.progress > 0 ? -1 : 0);
      // ai đang đứng trước gương khi cả dãy gương sáng thì được cộng công đức
      if (all)
        this.room.clients.forEach((c) => {
          const p = this.state.players.get(c.sessionId);
          if (p && p.y < 1.6 && [...this.state.objects.values()].some((o) => dist(p, o) <= PLATE_R)) this.room.credit(c, 1);
        });
    }
    this.state.goal = all ? `Cả ${total} tấm gương đều sáng — tội lỗi đang được soi rõ...` : `Gương sáng ${occ}/${total} — cần đủ người đứng trước gương`;
  }
}

/* ---------- Sửa/dập các trạm bùng lên (tầng 5, 9) ---------- */
class Whack extends Activity {
  private igniteT = 0;
  private downT = 0;
  init() {
    this.def.spots!.forEach((s, i) => this.obj('w' + i, 'station', s.x, s.z));
    this.ignite();
    this.ignite();
  }
  private active() {
    let n = 0;
    this.state.objects.forEach((o) => (n += o.s));
    return n;
  }
  private ignite() {
    const ok = [...this.state.objects.values()].filter((o) => o.s === 0);
    if (!ok.length) return;
    const o = ok[Math.floor(Math.random() * ok.length)];
    o.s = 1;
    o.hp = this.def.hp ?? 5;
  }
  tick(dt: number) {
    this.igniteT += dt;
    const cap = Math.min(this.def.spots!.length, 3 + this.state.players.size);
    if (this.igniteT > 2.2) {
      this.igniteT = 0;
      if (this.active() < cap) this.ignite();
    }
    const a = this.active(), total = this.def.spots!.length;
    this.downT += dt;
    if (a >= total - 2 && this.downT > 3) {
      this.downT = 0;
      this.room.addProgress(-2);
    }
    this.state.goal = `${a}/${total} đang bùng lên${a >= total - 2 ? ' — sắp mất kiểm soát!' : ''}`;
  }
  onAct(c: Client, p: Player) {
    let best: Obj | null = null, bd = WHACK_R + 0.5;
    this.state.objects.forEach((o) => {
      const d = dist(p, o);
      if (o.s === 1 && d < bd) { bd = d; best = o; }
    });
    const o = best as Obj | null;
    if (!o) return;
    o.hp = Math.max(0, o.hp - 1);
    this.room.credit(c, 1);
    this.room.broadcast('fx', { k: 'burst', x: o.x, y: 2, z: o.z, c: 'white' });
    if (o.hp === 0) {
      o.s = 0;
      this.room.broadcast('fx', { k: 'burst', x: o.x, y: 3, z: o.z, c: 'green' });
      this.room.addProgress(2);
    }
  }
}

/* ---------- Cùng đẩy vật nặng (tầng 8, 11) ---------- */
class Push extends Activity {
  private pushes = new Map<string, number>();
  private block!: Obj;
  init() {
    const f = this.def.push!.from;
    this.block = this.obj('block', 'block', f.x, f.z);
    this.state.goal = 'Lại gần, bấm E để đẩy';
  }
  tick() {
    const { from, to } = this.def.push!;
    const k = this.state.progress / this.state.need;
    this.block.x = from.x + (to.x - from.x) * k;
    this.block.z = from.z + (to.z - from.z) * k;
    const now = Date.now();
    const pushers = [...this.pushes.values()].filter((t) => now - t < 1200).length;
    const needP = Math.min(2, this.state.players.size);
    this.state.goal = `${pushers}/${needP} hồn đang đẩy${pushers < needP ? ' — cần thêm người!' : ' — đang lăn!'}`;
  }
  onAct(c: Client, p: Player) {
    if (dist(p, this.block) > PUSH_R) return;
    const now = Date.now();
    this.pushes.set(c.sessionId, now);
    const pushers = [...this.pushes.values()].filter((t) => now - t < 1200).length;
    if (pushers >= Math.min(2, this.state.players.size)) {
      this.room.broadcast('fx', { k: 'push', id: c.sessionId });
      this.room.addProgress(1);
      this.room.credit(c, 1);
    }
  }
  onLeave(id: string) { this.pushes.delete(id); }
}

/* ---------- Giã cối theo nhịp (tầng 12) ---------- */
class Rhythm extends Activity {
  private t = 0;
  private beatAt = 0;
  private hitThisBeat = new Set<string>();
  private streak = 0;
  init() {
    this.def.spots!.forEach((s, i) => this.obj('m' + i, 'mortar', s.x, s.z));
    this.state.goal = 'Nghe trống, bấm E đúng nhịp';
  }
  tick(dt: number) {
    this.t += dt;
    if (this.t >= RHYTHM.period) {
      this.t -= RHYTHM.period;
      if (this.hitThisBeat.size === 0) this.streak = 0;
      this.hitThisBeat.clear();
      this.beatAt = Date.now();
      this.room.broadcast('beat');
    }
  }
  onAct(c: Client, p: Player) {
    const near = [...this.state.objects.values()].find((o) => dist(p, o) <= RHYTHM.r);
    if (!near || this.hitThisBeat.has(c.sessionId)) return;
    const since = (Date.now() - this.beatAt) / 1000;
    const onBeat = since < 0.42 || RHYTHM.period - since < 0.12;
    if (!onBeat) {
      c.send('hit', { msg: 'Lệch nhịp rồi!', soft: true });
      return;
    }
    this.hitThisBeat.add(c.sessionId);
    this.streak++;
    this.room.broadcast('fx', { k: 'pound', x: near.x, z: near.z, id: c.sessionId });
    this.room.addProgress(this.hitThisBeat.size >= 2 ? 2 : 1);
    this.room.credit(c, this.hitThisBeat.size >= 2 ? 2 : 1);
    this.state.goal = `Chuỗi đúng nhịp: ${this.streak} · ${this.hitThisBeat.size} hồn cùng nhịp`;
  }
}

/* ---------- Kéo cưa 2 đầu (tầng 18) ---------- */
class Saw extends Activity {
  init() {
    this.def.spots!.forEach((s, i) => this.obj('s' + i, 'saw', s.x, s.z));
    this.state.goal = 'Đứng ở đầu cưa đang sáng, bấm E';
  }
  onAct(c: Client, p: Player) {
    for (const o of this.state.objects.values()) {
      const hx = o.x + (o.s === 0 ? -SAW_HANDLE : SAW_HANDLE);
      if (Math.hypot(p.x - hx, p.z - o.z) <= 1.9) {
        o.s = o.s ? 0 : 1;
        o.hp = (o.hp + 1) % 250;
        this.room.broadcast('fx', { k: 'burst', x: o.x, y: 1.6, z: o.z, c: 'gold' });
        this.room.addProgress(1);
        this.room.credit(c, 1);
        return;
      }
    }
  }
}

/* ---------- Phán Quan đối chất (tầng 1) ---------- */
function shuffle<T>(a: T[]) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

class Quiz extends Activity {
  private deck: number[] = [];
  private view: QuizView = { n: 0, q: '', opts: [], phase: 'wait', left: 0, counts: [0, 0, 0, 0], ans: -1, whisper: -1 };
  private ans = 0;
  private t = 0;
  init() {
    QUIZ_SPOTS.forEach((s, i) => this.obj('a' + i, 'answer', s.x, s.z, { hp: i }));
    this.state.goal = 'Phán Quan sắp đặt câu hỏi…';
    this.publish();
  }
  private plateOf(p: Player) {
    if (p.y > 2.2) return -1;
    return QUIZ_SPOTS.findIndex((s) => dist(p, s) <= QUIZ_R);
  }
  private ask() {
    if (!this.deck.length) this.deck = shuffle(QUESTIONS.map((_, i) => i));
    const Q = QUESTIONS[this.deck.pop()!];
    const order = shuffle([0, 1, 2, 3]);
    this.ans = order.indexOf(0);
    // Quỷ Dối Trá: 3/4 số lần xúi sai, đôi khi lại nói thật cho khó đoán
    const wrong = [0, 1, 2, 3].filter((i) => i !== this.ans);
    const whisper = Math.random() < 0.75 ? wrong[Math.floor(Math.random() * 3)] : this.ans;
    this.view = { ...this.view, n: this.view.n + 1, q: Q.q, opts: order.map((k) => Q.opts[k]), phase: 'ask', ans: -1, whisper };
    this.t = QUIZ_TIME.ask;
    this.state.objects.forEach((o) => (o.s = 0));
    this.state.goal = `Câu ${this.view.n}: chạy tới ô đáp án đúng!`;
  }
  private reveal() {
    this.view.phase = 'reveal';
    this.view.ans = this.ans;
    this.t = QUIZ_TIME.reveal;
    this.state.objects.forEach((o) => (o.s = o.hp === this.ans ? 1 : 2));
    let right = 0;
    const winners: Client[] = [];
    const n = this.room.clients.length;
    for (const c of this.room.clients) {
      const p = this.state.players.get(c.sessionId);
      if (!p) continue;
      const k = this.plateOf(p);
      if (k === this.ans) {
        right++;
        winners.push(c);
        this.room.broadcast('fx', { k: 'burst', x: p.x, y: 1.5, z: p.z, c: 'gold' });
      } else if (k >= 0) this.room.strike(c, '👅 Khai gian! Ngưu Đầu kéo lưỡi', true);
      else c.send('hit', { msg: '🤐 Im lặng trước Phán Quan cũng là che giấu', soft: true });
    }
    const gain = right * 2 + (right === n && n > 0 ? 2 : 0);
    this.room.broadcast('fx', { k: 'bell' });
    const each = 2 + (right === n && n > 0 ? 2 : 0); // cả tầng cùng đúng thì mỗi người thêm +2
    this.state.goal = right === n && n > 0 ? `Cả tầng khai thật! Mỗi hồn +${each}` : `${right}/${n} hồn khai thật · ai đúng +${each}`;
    this.room.addProgress(gain);
    winners.forEach((c) => this.room.credit(c, each));
  }
  tick(dt: number) {
    if (this.room.clients.length === 0) {
      if (this.view.phase !== 'wait') {
        this.view.phase = 'wait';
        this.publish();
      }
      return;
    }
    if (this.view.phase === 'wait') this.ask();
    this.t -= dt;
    if (this.t <= 0) {
      if (this.view.phase === 'ask') this.reveal();
      else this.ask();
    }
    const counts = [0, 0, 0, 0];
    this.state.players.forEach((p) => {
      const k = this.plateOf(p);
      if (k >= 0) counts[k]++;
    });
    this.view.counts = counts;
    this.view.left = Math.max(0, Math.ceil(this.t));
    this.publish();
  }
  private publish() {
    const j = JSON.stringify(this.view);
    if (j !== this.state.quiz) this.state.quiz = j;
  }
}

export function createActivity(def: FloorDef, room: FloorRoom): Activity {
  switch (def.mech) {
    case 'collect': return new Collect(room, def);
    case 'hazard': return new Hazard(room, def);
    case 'climb': return new Climb(room, def);
    case 'plates': return new Plates(room, def);
    case 'whack': return new Whack(room, def);
    case 'push': return new Push(room, def);
    case 'rhythm': return new Rhythm(room, def);
    case 'saw': return new Saw(room, def);
    case 'quiz': return new Quiz(room, def);
    default: return new Mill(room, def);
  }
}
