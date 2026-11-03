// Âm thanh hoạt hình tự tổng hợp bằng WebAudio (không cần file) + giọng đọc tiếng Việt của trình duyệt.
let ac: AudioContext | null = null;
let master: GainNode | null = null;
let muted = (() => {
  try {
    return localStorage.getItem('dn-mute') === '1';
  } catch {
    return false;
  }
})();
const listeners = new Set<(m: boolean) => void>();

/** Âm lượng tổng (trước đây 0.8 — nghe quá dữ) */
const VOL = 0.5;

function ctx() {
  if (!ac) {
    try {
      ac = new AudioContext();
      master = ac.createGain();
      master.gain.value = muted ? 0 : VOL;
      // nén đỉnh: tiếng kêu bất chợt không bị chói gắt
      const comp = ac.createDynamicsCompressor();
      comp.threshold.value = -20;
      comp.knee.value = 12;
      comp.ratio.value = 4;
      comp.attack.value = 0.005;
      comp.release.value = 0.25;
      master.connect(comp).connect(ac.destination);
    } catch {
      return null;
    }
  }
  if (ac.state === 'suspended' && !muted) ac.resume().catch(() => {});
  return ac;
}

// Trình duyệt chỉ cho phát âm thanh sau khi người dùng tương tác
if (typeof window !== 'undefined') {
  const unlock = () => {
    ctx();
    if (pendingAmb !== null) ambience(pendingAmb);
  };
  addEventListener('pointerdown', unlock);
  addEventListener('keydown', unlock);
}

// Khi sửa code lúc dev, Vite nạp lại module: đóng bộ âm thanh cũ để không còn nhạc "ma" phát mãi
if (import.meta.hot) import.meta.hot.dispose(() => {
  amb?.stop();
  ac?.close().catch(() => {});
  if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel();
});

export const isMuted = () => muted;
export function setMuted(m: boolean) {
  muted = m;
  try {
    localStorage.setItem('dn-mute', m ? '1' : '0');
  } catch {
    /* bỏ qua */
  }
  if (master && ac) {
    master.gain.setTargetAtTime(m ? 0 : VOL, ac.currentTime, 0.05);
    // dừng hẳn bộ âm thanh khi tắt (chắc chắn im lặng), bật lại thì chạy tiếp
    if (m) setTimeout(() => muted && ac?.suspend().catch(() => {}), 150);
    else ac.resume().then(() => pendingAmb !== null && ambience(pendingAmb)).catch(() => {});
  }
  if (m && typeof speechSynthesis !== 'undefined') speechSynthesis.cancel();
  listeners.forEach((f) => f(m));
}
export const onMuteChange = (f: (m: boolean) => void) => {
  listeners.add(f);
  return () => listeners.delete(f);
};

let noiseBuf: AudioBuffer | null = null;
function noise(a: AudioContext) {
  if (!noiseBuf) {
    noiseBuf = a.createBuffer(1, a.sampleRate * 2, a.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const s = a.createBufferSource();
  s.buffer = noiseBuf;
  return s;
}

function burst(dur: number, vol: number, filter: BiquadFilterType, freq: number, at = 0, q = 1) {
  const a = ctx();
  if (!a || !master) return;
  const t = a.currentTime + at;
  const s = noise(a);
  const f = a.createBiquadFilter();
  f.type = filter;
  f.frequency.value = freq;
  f.Q.value = q;
  const g = a.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f).connect(g).connect(master);
  s.start(t, Math.random());
  s.stop(t + dur + 0.05);
}


/* ---------- Âm thanh hoạt hình (tự tổng hợp) ---------- */
const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const pickOne = <T,>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)];

interface NoteOpts {
  f: number;
  to?: number; // trượt cao độ tới
  dur: number;
  vol: number;
  type?: OscillatorType;
  at?: number;
  vib?: number; // độ rung (tỉ lệ f)
  vibRate?: number;
  lp?: number; // lọc thấp (Hz)
  bp?: [number, number]; // lọc dải [tần số, Q]
  pan?: number;
  attack?: number;
  dest?: AudioNode;
}
/** Một nốt linh hoạt: trượt cao độ, rung, lọc — đủ làm boing, còi trượt, kèn kazoo */
function note(o: NoteOpts) {
  const a = ctx();
  if (!a || !master) return;
  const t = a.currentTime + (o.at ?? 0);
  const osc = a.createOscillator();
  osc.type = o.type ?? 'sine';
  osc.frequency.setValueAtTime(o.f, t);
  if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t + o.dur);
  let lfo: OscillatorNode | null = null;
  if (o.vib) {
    lfo = a.createOscillator();
    const lg = a.createGain();
    lfo.frequency.value = o.vibRate ?? 6;
    lg.gain.value = o.f * o.vib;
    lfo.connect(lg).connect(osc.frequency);
  }
  let n: AudioNode = osc;
  if (o.lp) {
    const f = a.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = o.lp;
    n = n.connect(f);
  }
  if (o.bp) {
    const f = a.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = o.bp[0];
    f.Q.value = o.bp[1];
    n = n.connect(f);
  }
  const g = a.createGain();
  const atk = o.attack ?? 0.01;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(o.vol, t + atk);
  g.gain.setValueAtTime(o.vol, t + Math.max(atk, o.dur * 0.5));
  g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
  n.connect(g);
  let out: AudioNode = g;
  if (o.pan) {
    const p = a.createStereoPanner();
    p.pan.value = o.pan;
    out = g.connect(p);
  }
  out.connect(o.dest ?? master);
  for (const x of lfo ? [osc, lfo] : [osc]) {
    x.start(t);
    x.stop(t + o.dur + 0.05);
  }
}

/** xa thì nhỏ lại và lệch sang một bên */
const farOf = (vol: number, far: boolean) => (far ? { vol: vol * 0.4, pan: rnd(-0.7, 0.7) } : { vol, pan: 0 });

/** Boing lò xo */
function boing(vol: number, far = false, at = 0) {
  const v = farOf(vol, far);
  const f = rnd(140, 220);
  note({ f, to: f * 2.2, dur: 0.55, vol: 0.22 * v.vol, type: 'triangle', vib: 0.25, vibRate: rnd(14, 20), pan: v.pan, at });
}
/** Còi trượt lên / xuống */
function slideWhistle(up: boolean, vol: number, far = false, at = 0, dur = 0.55) {
  const v = farOf(vol, far);
  const lo = rnd(450, 600), hi = lo * rnd(2.4, 3);
  note({ f: up ? lo : hi, to: up ? hi : lo, dur, vol: 0.12 * v.vol, type: 'sine', vib: 0.02, vibRate: 7, pan: v.pan, at, attack: 0.04 });
}
/** Đồ chơi bóp kêu chít chít */
function squeak(vol: number, far = false, at = 0, n = 2) {
  const v = farOf(vol, far);
  for (let i = 0; i < n; i++)
    note({ f: rnd(1100, 1400), to: rnd(1600, 2000), dur: 0.09, vol: 0.09 * v.vol, type: 'square', bp: [1500, 3], pan: v.pan, at: at + i * 0.13 });
}
/** Kèn kazoo kiểu "ối dồi ôi" — mỗi phần tử là [hệ số cao độ, thời lượng] */
function kazoo(pattern: [number, number][], vol: number, far = false, at = 0, base = rnd(260, 340)) {
  const v = farOf(vol, far);
  let t = at;
  for (const [k, d] of pattern) {
    note({ f: base * k, to: base * k * 0.92, dur: d, vol: 0.1 * v.vol, type: 'sawtooth', bp: [1100, 1.5], vib: 0.04, vibRate: 9, pan: v.pan, at: t, attack: 0.03 });
    t += d + 0.03;
  }
}
const oiDoiOi = (vol: number, far = false, at = 0) => kazoo([[1.5, 0.22], [1.2, 0.2], [1.6, 0.5]], vol, far, at);
/** Tiếng bụp hoạt hình */
function pop(vol: number, at = 0) {
  note({ f: rnd(700, 1000), to: 180, dur: 0.08, vol: 0.2 * vol, type: 'sine', at });
}
/** Khúc khích */
function giggle(vol: number, far = false, at = 0) {
  const v = farOf(vol, far);
  const f = rnd(700, 900);
  for (let i = 0; i < 5; i++) note({ f: f * (1 - i * 0.05), to: f * (1 - i * 0.05) * 1.15, dur: 0.07, vol: 0.08 * v.vol, type: 'triangle', pan: v.pan, at: at + i * 0.11 });
}
/** Mõ gỗ */
const woodblock = (f = 1200, vol = 0.1, at = 0) => note({ f, dur: 0.05, vol, type: 'square', bp: [f, 6], at });

/** Lời van xin kiểu hài, đọc bằng giọng đọc (chỉ khi loa không bận đọc tin) */
const PLEAS = ['Ối giời ơi tha cho con!', 'Con xin chừa, con hứa không dám nữa!', 'Ui da ui da, nhẹ tay thôi các ngài ơi!', 'Thôi thôi con biết lỗi rồi mà!', 'Mẹ ơi cứu con, con hết dám rồi!', 'Cho con xin năm phút nghỉ giải lao!'];
/** Hồn van xin. `force` = chính mình đang chịu hình: ngắt loa âm phủ để lời van được nghe rõ. */
let pleading = false;
export function plead(text?: string, force = false) {
  if (muted || typeof speechSynthesis === 'undefined') return;
  const v = pickVoice();
  if (!v) {
    // không có giọng tiếng Việt → kêu "ối dồi ôi" bằng kèn kazoo thay lời van
    oiDoiOi(0.9);
    giggle(0.5, false, 1.1);
    return;
  }
  if (speechSynthesis.speaking) {
    if (!force || pleading) return; // đang van dở câu trước thì để nói hết
    speechSynthesis.cancel();
  }
  if (force) hushAnnouncer(5000);
  const u = new SpeechSynthesisUtterance(text ?? PLEAS[Math.floor(Math.random() * PLEAS.length)]);
  u.voice = v;
  u.lang = v.lang;
  u.pitch = 1.6 + Math.random() * 0.4; // giọng the thé, nhí nhố
  u.rate = 1.05;
  u.volume = 1;
  pleading = true;
  u.onend = u.onerror = () => (pleading = false);
  speechSynthesis.speak(u);
}

export const sfx = {
  /** Búa phán xử gõ "cốc cốc" + kèn đồng "pà-pà" */
  gong() {
    woodblock(700, 0.2);
    woodblock(700, 0.2, 0.18);
    [196, 247, 294].forEach((f) => note({ f, dur: 0.6, vol: 0.06, type: 'sawtooth', lp: 1400, at: 0.4, attack: 0.03 }));
  },
  /** Chuông xe đạp "kính coong" */
  bell() {
    for (let i = 0; i < 6; i++) note({ f: i % 2 ? 2600 : 2200, dur: 0.06, vol: 0.05, type: 'triangle', at: i * 0.05 });
  },
  ding() {
    note({ f: 1046, dur: 0.25, vol: 0.08, type: 'triangle' });
    note({ f: 1568, dur: 0.35, vol: 0.06, type: 'triangle', at: 0.07 });
  },
  /** Bốp! cú đánh hoạt hình */
  hit() {
    note({ f: 600, to: 150, dur: 0.18, vol: 0.2, type: 'triangle' });
    burst(0.06, 0.15, 'bandpass', 1500, 0, 2);
  },
  drum() {
    note({ f: 220, to: 120, dur: 0.18, vol: 0.25, type: 'sine' });
  },
  thud() {
    boing(0.6);
  },
  /** Leng keng như chuông tuần lộc */
  chain() {
    for (let i = 0; i < 6; i++) note({ f: rnd(3000, 4200), dur: 0.08, vol: 0.035, type: 'sine', at: i * 0.07 + Math.random() * 0.02 });
    burst(0.4, 0.04, 'highpass', 6000, 0, 1);
  },
  /** Còi trượt vút lên */
  whoosh() {
    slideWhistle(true, 1);
  },
  tick() {
    woodblock(1600, 0.04);
  },
  countdown() {
    woodblock(900, 0.1);
  },
  /** Kèn trombone buồn "oa oa oa oaaa" */
  banish() {
    sfx.chain();
    [[196, 0.35], [185, 0.35], [175, 0.35], [165, 1.1]].reduce((at, [f, d], i) => {
      note({ f, dur: d, vol: 0.12, type: 'sawtooth', lp: 1100, at, attack: 0.05, vib: i === 3 ? 0.03 : 0, vibRate: 5 });
      return at + d + 0.05;
    }, 0.2);
  },
  /** Kèn chiến thắng "tèn ten tèn tén" */
  pardon() {
    [[523, 0.12], [659, 0.12], [784, 0.12], [1046, 0.5]].reduce((at, [f, d]) => {
      note({ f, dur: d, vol: 0.08, type: 'square', lp: 2500, at });
      note({ f: f / 2, dur: d, vol: 0.06, type: 'triangle', at });
      return at + d + 0.03;
    }, 0);
  },
  /** Rón rén nhón chân (pizzicato) */
  heartbeat() {
    [392, 330, 392, 330].forEach((f, i) => note({ f, dur: 0.1, vol: 0.09, type: 'triangle', at: i * 0.18 }));
  },
  /* ---- tiếng phản ứng khi chịu phạt ---- */
  /** "Á!" kiểu hoạt hình: boing / còi tụt / ối dồi ôi */
  scream(vol = 1, far = false) {
    const r = Math.random();
    if (r < 0.35) boing(vol, far);
    else if (r < 0.65) slideWhistle(false, vol, far);
    else oiDoiOi(vol, far);
    if (!far && Math.random() < 0.4) pop(vol * 0.6, 0.5);
  },
  /** Mếu máo "hu hu" bằng kazoo */
  sob(vol = 1, far = false) {
    const n = 2 + Math.floor(Math.random() * 3);
    kazoo(Array.from({ length: n }, (_, i) => [1.3 - i * 0.08, 0.16] as [number, number]), vol, far);
  },
  /** Kêu dài "ối giời ơiii" (còi trượt rung) */
  wail(vol = 1, far = false) {
    slideWhistle(false, vol, far, 0, rnd(0.9, 1.3));
  },
  /** Càu nhàu "hừm hừm" */
  moan(vol = 1, far = false) {
    kazoo([[0.8, 0.25], [0.7, 0.35]], vol, far, 0, rnd(160, 200));
  },
  /** Một tiếng kêu bất kỳ (hồn đang chịu phạt) */
  cry(vol = 1, far = false) {
    const r = Math.random();
    if (r < 0.25) sfx.sob(vol, far);
    else if (r < 0.45) sfx.wail(vol, far);
    else if (r < 0.6) squeak(vol, far);
    else if (r < 0.75) giggle(vol, far);
    else sfx.scream(vol, far);
  },
  /** Bẹp! */
  squelch() {
    note({ f: 300, to: 90, dur: 0.15, vol: 0.18, type: 'sine' });
    burst(0.08, 0.1, 'lowpass', 600, 0, 3);
  },
  /** Kéo cắt "xoẹt xoẹt" chít chít */
  snip() {
    squeak(0.8, false, 0, 2);
  },
  /** Chọc lét: bụp + khúc khích */
  stab() {
    pop(0.8);
    giggle(0.6, false, 0.08);
  },
  /** Xèo xèo như nước ngọt có ga */
  sizzle() {
    burst(0.6, 0.05, 'highpass', 5000, 0, 0.7);
    for (let i = 0; i < 5; i++) note({ f: rnd(1200, 2200), to: rnd(2500, 3500), dur: 0.04, vol: 0.04, type: 'sine', at: rnd(0, 0.5) });
  },
  crack() {
    pop(1);
  },
  /** Nhai rộp rộp */
  crunch() {
    for (let i = 0; i < 3; i++) burst(0.05, 0.14, 'bandpass', rnd(1500, 2500), i * 0.1, 2);
  },
  bubble() {
    for (let i = 0; i < 4; i++) note({ f: 260 + Math.random() * 300, to: 700, dur: 0.08, vol: 0.07, type: 'sine', at: i * 0.07 });
  },
  /** Kèn kazoo rè rè */
  grind() {
    kazoo([[1, 0.2], [1.05, 0.2]], 0.6, false, 0, 150);
  },
  /** Cưa "dzít dzít" (còi trượt lên xuống nhanh) */
  saw() {
    slideWhistle(true, 0.6, false, 0, 0.15);
    slideWhistle(false, 0.6, false, 0.17, 0.15);
  },
};

/* ---------- Nhạc nền vui nhộn (tự tổng hợp), mỗi tầng một giọng ---------- */
let amb: { stop: () => void } | null = null;
let pendingAmb: number | null = null;

const MAJOR = [0, 2, 4, 7, 9]; // ngũ cung trưởng: tươi vui
const SNEAKY = [0, 3, 5, 7, 10]; // ngũ cung thứ: rón rén kiểu "phiên toà"
const hz = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12);

/** level 0 = điện Diêm Vương; 1..18 = các tầng. */
export function ambience(level: number) {
  const a = ctx();
  pendingAmb = level;
  if (!a || !master || a.state !== 'running') return;
  pendingAmb = null;
  amb?.stop();
  let alive = true;
  const out = a.createGain();
  out.gain.setValueAtTime(0.0001, a.currentTime);
  out.gain.exponentialRampToValueAtTime(0.55, a.currentTime + 2);
  out.connect(master);

  const trial = level === 0;
  const scale = trial ? SNEAKY : MAJOR;
  const root = trial ? 50 : 53 + ((level * 5) % 12); // mỗi tầng một giọng
  const bpm = trial ? 92 : 104 + (level % 4) * 6;
  const step = 60 / bpm / 2; // nốt móc đơn
  // giai điệu 2 ô nhịp (16 nốt móc đơn), lặp lại, thỉnh thoảng đổi
  const makeMotif = () => Array.from({ length: 16 }, (_, i) => (Math.random() < (i % 2 ? 0.35 : 0.6) ? Math.floor(Math.random() * 7) : -1));
  let motif = makeMotif();
  const chords = trial ? [0, 0, 3, 4] : [0, 3, 4, 0]; // bậc hợp âm theo ô nhịp
  const deg = (d: number) => Math.floor(d / 5) * 12 + scale[d % 5];

  let next = a.currentTime + 0.1;
  let i = 0;
  const schedule = () => {
    if (!alive) return;
    while (next < a.currentTime + 0.3) {
      const at = next - a.currentTime;
      const bar = Math.floor(i / 8) % 4;
      const ch = root + deg(chords[bar]);
      const beat = i % 8;
      if (!muted) {
        // "um": bass ở phách 1 & 3
        if (beat === 0 || beat === 4) note({ f: hz(ch - 12 + (beat === 4 ? 7 : 0)), dur: step * 1.6, vol: 0.09, type: 'triangle', at, dest: out });
        // "pa": hợp âm gảy ngắn ở phách 2 & 4
        if (beat === 2 || beat === 6)
          [0, 4, 7].forEach((k) => note({ f: hz(ch + (trial ? (k === 4 ? 3 : k) : k)), dur: step * 0.7, vol: 0.025, type: 'square', lp: 1800, at, dest: out }));
        // giai điệu gảy như đàn ukulele
        const m = motif[i % 16];
        if (m >= 0) note({ f: hz(root + 12 + deg(m)), dur: step * (trial ? 0.6 : 0.9), vol: 0.04, type: 'triangle', at, dest: out });
        // phiên toà: thêm tiếng mõ rón rén
        if (trial && beat % 2 === 1 && Math.random() < 0.5) woodblock(1400, 0.02, at);
      }
      next += step;
      i++;
      if (i % 64 === 0 && Math.random() < 0.5) motif = makeMotif();
    }
    timer = setTimeout(schedule, 100);
  };
  let timer: ReturnType<typeof setTimeout> = setTimeout(schedule, 0);

  // thỉnh thoảng một tiếng hài văng vẳng (khúc khích, boing, chít chít)
  let fx: ReturnType<typeof setTimeout>;
  const tick = () => {
    fx = setTimeout(() => {
      if (!alive) return;
      if (!muted) pickOne([() => giggle(0.5, true), () => boing(0.5, true), () => squeak(0.5, true), () => oiDoiOi(0.4, true)])();
      tick();
    }, rnd(trial ? 15000 : 9000, trial ? 28000 : 18000));
  };
  tick();

  amb = {
    stop() {
      alive = false;
      clearTimeout(timer);
      clearTimeout(fx);
      const t = a.currentTime;
      out.gain.cancelScheduledValues(t);
      out.gain.setValueAtTime(out.gain.value, t);
      out.gain.exponentialRampToValueAtTime(0.0001, t + 1.2);
      setTimeout(() => out.disconnect(), 1500);
    },
  };
}

/* ---------- Giọng đọc (Web Speech, có sẵn trong trình duyệt) ---------- */
export type Speaker = 'diem' | 'hac' | 'bach' | 'manh' | 'phan';
const VOICE: Record<Speaker, { pitch: number; rate: number }> = {
  diem: { pitch: 0.6, rate: 0.9 }, // Diêm Vương: trầm, ra vẻ uy nghiêm
  hac: { pitch: 0.8, rate: 1.1 }, // Hắc Vô Thường: nhanh nhảu
  bach: { pitch: 1.5, rate: 1.05 }, // Bạch Vô Thường: cao, lém lỉnh
  manh: { pitch: 1.25, rate: 0.82 }, // Mạnh Bà: già, hiền
  phan: { pitch: 0.7, rate: 0.95 }, // Phán Quan
};
let viVoice: SpeechSynthesisVoice | null | undefined;
function pickVoice() {
  if (viVoice !== undefined && viVoice !== null) return viVoice;
  const vs = speechSynthesis.getVoices();
  if (!vs.length) return null;
  const vi = vs.filter((v) => v.lang.toLowerCase().replace('_', '-').startsWith('vi'));
  // ưu tiên giọng tự nhiên (Edge "Natural", Google) hơn giọng robot
  viVoice = vi.find((v) => /natural|online|google/i.test(v.name)) ?? vi[0] ?? null;
  return viVoice;
}
if (typeof speechSynthesis !== 'undefined') speechSynthesis.onvoiceschanged = () => (viVoice = undefined);

export const hasVoice = () => typeof speechSynthesis !== 'undefined' && !!pickVoice();

export function speak(text: string, who: Speaker) {
  if (muted || typeof speechSynthesis === 'undefined') return;
  const v = pickVoice();
  if (!v) return; // không có giọng tiếng Việt thì chỉ hiện chữ
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text.replace(/[“”"]/g, ''));
  u.voice = v;
  u.lang = v.lang;
  u.pitch = VOICE[who].pitch;
  u.rate = VOICE[who].rate;
  speechSynthesis.speak(u);
}
export function stopSpeak() {
  if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel();
}

/* ---------- Loa âm phủ: đọc lần lượt các tin trong Sổ Sinh Tử ---------- */
const queue: { text: string; who: Speaker }[] = [];
let talking = false;
let quietUntil = 0;

/** Tạm im loa (VD đang ở điện Diêm Vương — để không đè lời thoại). */
export const hushAnnouncer = (ms: number) => (quietUntil = Date.now() + ms);

export function announce(text: string, who: Speaker = 'phan') {
  if (muted || typeof speechSynthesis === 'undefined' || !pickVoice()) return;
  queue.push({ text, who });
  if (queue.length > 3) queue.splice(0, queue.length - 3); // đông quá thì bỏ tin cũ
  pump();
}
function pump() {
  if (talking || !queue.length) return;
  if (Date.now() < quietUntil || speechSynthesis.speaking) {
    setTimeout(pump, 800);
    return;
  }
  const { text, who } = queue.shift()!;
  const v = pickVoice();
  if (!v || muted) return;
  const u = new SpeechSynthesisUtterance(text);
  u.voice = v;
  u.lang = v.lang;
  u.pitch = VOICE[who].pitch;
  u.rate = 1.05;
  u.volume = 0.85;
  talking = true;
  const done = () => {
    talking = false;
    setTimeout(pump, 400);
  };
  u.onend = done;
  u.onerror = done;
  speechSynthesis.speak(u);
}

