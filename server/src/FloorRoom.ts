import { Room, type Client } from '@colyseus/core';
import { BOUNDS, FLOORS, MAX_STRIKES, REBIRTHS, SPAWN, floorDef } from '../../shared/game.ts';
import { createActivity, type Activity } from './activities.ts';
import { FloorState, Player } from './schema.ts';
import { addFeed, consumeTicket, countSoul, hub, issueTicket, stats, type Soul } from './hub.ts';

const clean = (s: unknown, n: number) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, n);
const num = (v: unknown, fb: number) => (Number.isFinite(Number(v)) ? Number(v) : fb);

export class FloorRoom extends Room<{ state: FloorState }> {
  maxClients = 40;
  state = new FloorState();

  private last = new Map<string, Record<string, number>>();
  private off: (() => void)[] = [];
  private activity!: Activity;

  onCreate(options: { level: number }) {
    const level = Math.max(1, Math.min(FLOORS.length, Math.floor(num(options?.level, 1))));
    this.state.level = level;
    const def = floorDef(level);
    this.state.need = def.need;
    this.state.progress = 0;
    this.patchRate = 1000 / 20;
    this.activity = createActivity(def, this);
    this.activity.init();
    this.setSimulationInterval((ms) => this.activity.tick(ms / 1000), 100);

    // Chuyển tin toàn cục (Sổ Sinh Tử, số hồn mỗi tầng) xuống client của phòng này
    const onFeed = (item: unknown) => this.broadcast('feed', item);
    const onStats = (s: number[]) => this.broadcast('stats', s);
    hub.on('feed', onFeed);
    hub.on('stats', onStats);
    this.off.push(() => hub.off('feed', onFeed), () => hub.off('stats', onStats));

    this.onMessage('move', (client, d: any) => {
      const p = this.state.players.get(client.sessionId);
      if (!p) return;
      p.x = Math.max(-BOUNDS.x, Math.min(BOUNDS.x, num(d?.x, p.x)));
      p.z = Math.max(-BOUNDS.z, Math.min(BOUNDS.z, num(d?.z, p.z)));
      p.y = Math.max(-20, Math.min(14, num(d?.y, 0)));
      p.r = num(d?.r, p.r);
      this.activity.onMove(client, p);
    });

    this.onMessage('chat', (client, text) => {
      const t = clean(text, 80);
      if (!t || !this.throttle(client, 'chat', 700)) return;
      this.broadcast('chat', { id: client.sessionId, text: t });
    });

    this.onMessage('act', (client) => {
      const p = this.state.players.get(client.sessionId);
      if (!p || !this.throttle(client, 'act', 110)) return;
      this.activity.onAct(client, p);
    });


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
    this.state.players.set(client.sessionId, p);
    countSoul(this.state.level, +1);
    client.send('stats', stats());
    this.activity.onRoster();
  }

  onLeave(client: Client) {
    if (this.state.players.delete(client.sessionId)) countSoul(this.state.level, -1);
    this.last.delete(client.sessionId);
    this.activity.onLeave(client.sessionId);
    this.activity.onRoster();
  }

  onDispose() {
    this.off.forEach((f) => f());
  }

  /* ---------- luật chơi ---------- */
  private throttle(client: Client, key: string, ms: number) {
    const rec = this.last.get(client.sessionId) ?? {};
    this.last.set(client.sessionId, rec);
    const now = Date.now();
    if (now - (rec[key] ?? 0) < ms) return false;
    rec[key] = now;
    return true;
  }

  addProgress(n: number) {
    this.state.progress = Math.max(0, Math.min(this.state.need, this.state.progress + n));
    if (this.state.progress >= this.state.need) this.pardon();
  }

  /** Ghi một lần vi phạm; đủ MAX_STRIKES thì bị đày xuống tầng sâu hơn. */
  strike(client: Client, msg: string, soft = false) {
    const p = this.state.players.get(client.sessionId);
    if (!p) return;
    p.strikes++;
    const level = this.state.level;
    if (p.strikes < MAX_STRIKES) {
      client.send('hit', { msg: `${msg} (vi phạm ${p.strikes}/${MAX_STRIKES})`, soft });
      return;
    }
    if (level >= FLOORS.length) {
      p.strikes = 0;
      client.send('hit', { msg: `${msg} — đã ở tầng sâu nhất, không thể đày thêm!`, soft });
      return;
    }
    const soul = client.auth as Soul;
    const ticket = issueTicket({ ...soul, level: level + 1 });
    addFeed({ kind: 'judge', name: soul.name, text: `vi phạm ${MAX_STRIKES} lần, bị đày xuống tầng ${level + 1}` });
    client.send('banished', { level: level + 1, ticket, msg });
  }

  private pardon() {
    const level = this.state.level;
    this.state.progress = 0;
    const souls = this.clients.length;
    if (level === 1) {
      addFeed({ kind: 'pardon', name: 'Tầng 1', text: `sám hối xong, ${souls} hồn qua cầu Nại Hà đi đầu thai!` });
      [...this.clients].forEach((c) => this.rebirth(c));
      return;
    }
    addFeed({ kind: 'pardon', name: `Tầng ${level}`, text: `được ân xá! ${souls} hồn lên tầng ${level - 1}` });
    for (const c of this.clients) {
      const soul = c.auth as Soul;
      const ticket = issueTicket({ ...soul, level: level - 1 });
      c.send('pardoned', { level: level - 1, ticket });
    }
  }

  private rebirth(client: Client) {
    const soul = client.auth as Soul;
    const as = REBIRTHS[Math.floor(Math.random() * REBIRTHS.length)];
    client.send('reborn', { as });
    addFeed({ kind: 'reborn', name: soul.name, text: `đã đầu thai thành ${as}` });
  }
}
