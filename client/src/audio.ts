// Âm thanh tự tổng hợp bằng WebAudio (không cần file) + giọng đọc tiếng Việt của trình duyệt.
let ac: AudioContext | null = null;
let master: GainNode | null = null;
/** Vang âm phủ: tiếng kêu khóc dội lại như trong hang sâu */
let verb: GainNode | null = null;
let muted = (() => {
  try {
    return localStorage.getItem('dn-mute') === '1';
  } catch {
    return false;
  }
})();
const listeners = new Set<(m: boolean) => void>();

function ctx() {
  if (!ac) {
    try {
      ac = new AudioContext();
      master = ac.createGain();
      master.gain.value = muted ? 0 : 0.8;
      master.connect(ac.destination);
      // xung phản hồi tự tạo: nhiễu tắt dần ~3.5s
      const len = Math.floor(ac.sampleRate * 3.5), ir = ac.createBuffer(2, len, ac.sampleRate);
      for (let c = 0; c < 2; c++) {
        const d = ir.getChannelData(c);
        for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6);
      }
      const conv = ac.createConvolver();
      conv.buffer = ir;
      verb = ac.createGain();
      verb.gain.value = 0.9;
      verb.connect(conv).connect(master);
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
    master.gain.setTargetAtTime(m ? 0 : 0.8, ac.currentTime, 0.05);
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

/** Một nốt có đường bao âm lượng */
function tone(f: number, dur: number, vol: number, type: OscillatorType = 'sine', at = 0, slideTo?: number) {
  const a = ctx();
  if (!a || !master) return;
  const t = a.currentTime + at;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + dur + 0.05);
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


/* ---------- Giọng người tổng hợp (thét, khóc, rên) ---------- */
type Vowel = 'a' | 'o' | 'u' | 'e' | 'i';
const FORMANT: Record<Vowel, [number, number, number]> = {
  a: [800, 1150, 2900], o: [450, 800, 2830], u: [325, 700, 2530], e: [400, 1600, 2700], i: [350, 2000, 2900],
};
let shaper: Float32Array | null = null;
function roughCurve() {
  if (!shaper) {
    shaper = new Float32Array(1024);
    for (let i = 0; i < 1024; i++) {
      const x = (i / 1023) * 2 - 1;
      shaper[i] = Math.tanh(x * 3.2);
    }
  }
  return shaper;
}

interface VocalOpts {
  f0: number;
  dur: number;
  vol: number;
  vowel?: Vowel;
  /** đường cao độ: các cặp [thời điểm 0..1, hệ số nhân f0] */
  pitch?: [number, number][];
  vib?: number; // độ rung giọng (tỉ lệ f0)
  rough?: boolean; // khàn, rè (xé họng)
  breath?: number; // lượng hơi thở
  at?: number;
  far?: boolean; // văng vẳng từ xa: nhỏ, đục, vang nhiều
  pan?: number;
}

function vocal(o: VocalOpts) {
  const a = ctx();
  if (!a || !master) return;
  const t = a.currentTime + (o.at ?? 0), dur = o.dur;
  const src = a.createGain();
  // hai sóng răng cưa lệch nhẹ cho dày giọng
  const oscs = [1, 1.012].map((m) => {
    const osc = a.createOscillator();
    osc.type = 'sawtooth';
    const pts = o.pitch ?? [[0, 1], [1, 1]];
    osc.frequency.setValueAtTime(o.f0 * m * pts[0][1], t);
    for (const [x, k] of pts.slice(1)) osc.frequency.linearRampToValueAtTime(o.f0 * m * k, t + x * dur);
    osc.connect(src);
    return osc;
  });
  // rung giọng + run rẩy ngẫu nhiên
  const lfo = a.createOscillator(), lg = a.createGain();
  lfo.frequency.value = 5 + Math.random() * 4;
  lg.gain.value = o.f0 * (o.vib ?? 0.04);
  lfo.connect(lg);
  oscs.forEach((x) => lg.connect(x.frequency));
  let chain: AudioNode = src;
  if (o.rough) {
    const ws = a.createWaveShaper();
    ws.curve = roughCurve() as Float32Array<ArrayBuffer>;
    src.gain.value = 1.6;
    chain = src.connect(ws);
  }
  const env = a.createGain();
  env.gain.setValueAtTime(0.0001, t);
  env.gain.exponentialRampToValueAtTime(o.vol, t + Math.min(0.08, dur * 0.2));
  env.gain.setValueAtTime(o.vol, t + dur * 0.6);
  env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  const [F1, F2, F3] = FORMANT[o.vowel ?? 'a'];
  [[F1, 6, 1], [F2, 8, 0.6], [F3, 10, 0.3]].forEach(([f, q, g]) => {
    const bp = a.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = f;
    bp.Q.value = q;
    const gg = a.createGain();
    gg.gain.value = g * 2.2;
    chain.connect(bp).connect(gg).connect(env);
  });
  // hơi thở / tiếng rít
  if (o.breath) {
    const n = noise(a), nb = a.createBiquadFilter(), ng = a.createGain();
    nb.type = 'bandpass';
    nb.frequency.value = 2200;
    nb.Q.value = 0.8;
    ng.gain.value = o.breath;
    n.connect(nb).connect(ng).connect(env);
    n.start(t, Math.random());
    n.stop(t + dur + 0.05);
  }
  // xa thì đục, nhỏ, vang nhiều; gần thì rõ và chỉ vang chút
  const pan = a.createStereoPanner();
  pan.pan.value = o.pan ?? (o.far ? Math.random() * 1.6 - 0.8 : 0);
  let out: AudioNode = env;
  if (o.far) {
    const lp = a.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 1300;
    out = env.connect(lp);
  }
  out.connect(pan);
  const dry = a.createGain(), wet = a.createGain();
  dry.gain.value = o.far ? 0.25 : 1;
  wet.gain.value = o.far ? 1 : 0.35;
  pan.connect(dry).connect(master);
  if (verb) pan.connect(wet).connect(verb);
  [...oscs, lfo].forEach((x) => {
    x.start(t);
    x.stop(t + dur + 0.05);
  });
}

/** Hít vào giật cục giữa tiếng khóc */
function gasp(at: number, vol: number, far = false) {
  const a = ctx();
  if (!a || !master) return;
  const t = a.currentTime + at;
  const n = noise(a), f = a.createBiquadFilter(), g = a.createGain();
  f.type = 'bandpass';
  f.Q.value = 2;
  f.frequency.setValueAtTime(900, t);
  f.frequency.exponentialRampToValueAtTime(2600, t + 0.28);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol * (far ? 0.4 : 1), t + 0.12);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.32);
  n.connect(f).connect(g).connect(master);
  if (verb && far) g.connect(verb);
  n.start(t, Math.random());
  n.stop(t + 0.4);
}

const rnd = (a: number, b: number) => a + Math.random() * (b - a);

/** Lời van xin bằng giọng đọc, run rẩy nghẹn ngào (chỉ khi loa không bận đọc tin) */
const PLEAS = ['Tha cho con… con lạy các ngài…', 'Con biết tội rồi… xin tha cho con…', 'Đau quá… đau quá… cứu con với…', 'Xin dừng tay… con xin các ngài…', 'Mẹ ơi… cứu con…', 'Con không dám nữa đâu… tha cho con…'];
export function plead(text?: string) {
  if (muted || typeof speechSynthesis === 'undefined' || speechSynthesis.speaking) return;
  const v = pickVoice();
  if (!v) return;
  const u = new SpeechSynthesisUtterance(text ?? PLEAS[Math.floor(Math.random() * PLEAS.length)]);
  u.voice = v;
  u.lang = v.lang;
  u.pitch = 1.5 + Math.random() * 0.4; // giọng the thé, nghẹn
  u.rate = 0.78;
  u.volume = 1;
  speechSynthesis.speak(u);
}

/* ---------- Âm thanh ghi âm thật (client/public/sfx, nguồn & giấy phép: CREDITS.md) ---------- */
const SAMPLES = {
  scream: ['scream1', 'scream2', 'scream3', 'scream4', 'scream5', 'scream6', 'scream7'],
  cry: ['cry1', 'cry2', 'cry3', 'cry4', 'cry5', 'cry6', 'cry7', 'cry8', 'cry9'],
  moan: ['moan1'],
  thunder: ['thunder1', 'thunder2', 'thunder3', 'thunder4'],
} as const;
type Bank = keyof typeof SAMPLES;
const bufs = new Map<string, AudioBuffer>();
const pending = new Map<string, Promise<AudioBuffer | null>>();
/** Tải & giải mã một file trong /sfx (mỗi file một lần) */
function load(name: string): Promise<AudioBuffer | null> {
  const a = ctx();
  if (!a) return Promise.resolve(null);
  let p = pending.get(name);
  if (!p) {
    p = fetch(`/sfx/${name}.mp3`)
      .then((r) => r.arrayBuffer())
      .then((b) => a.decodeAudioData(b))
      .then((buf) => (bufs.set(name, buf), buf))
      .catch(() => null);
    pending.set(name, p);
  }
  return p;
}
let voicesLoaded = false;
function loadSamples() {
  if (voicesLoaded) return;
  voicesLoaded = true;
  Object.values(SAMPLES).flat().forEach((n) => load(n));
}
const lastPick = new Map<Bank, string>();

/** Phát một đoạn ghi âm ngẫu nhiên trong nhóm; trả về false nếu chưa tải xong (để dùng tiếng tổng hợp thay). */
function sample(bank: Bank, vol: number, far = false, rate = 1) {
  const a = ctx();
  if (!a || !master) return false;
  loadSamples();
  const names = SAMPLES[bank].filter((n) => bufs.has(n) && (SAMPLES[bank].length < 2 || n !== lastPick.get(bank)));
  if (!names.length) return false;
  const n = names[Math.floor(Math.random() * names.length)];
  lastPick.set(bank, n);
  const src = a.createBufferSource();
  src.buffer = bufs.get(n)!;
  src.playbackRate.value = rate * (0.92 + Math.random() * 0.16); // đổi cao độ chút cho đỡ lặp
  const g = a.createGain();
  g.gain.value = vol;
  const pan = a.createStereoPanner();
  pan.pan.value = far ? Math.random() * 1.6 - 0.8 : 0;
  let node: AudioNode = src.connect(g);
  if (far) {
    const lp = a.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 1800;
    node = node.connect(lp);
  }
  node.connect(pan);
  const dry = a.createGain(), wet = a.createGain();
  dry.gain.value = far ? 0.35 : 1;
  wet.gain.value = far ? 0.8 : 0.25;
  pan.connect(dry).connect(master);
  if (verb) pan.connect(wet).connect(verb);
  src.start();
  return true;
}

export const sfx = {
  gong() {
    [73, 110, 147, 196, 277].forEach((f, i) => tone(f, 4.5 - i * 0.5, 0.28 / (i + 1), 'sine'));
    burst(0.6, 0.15, 'bandpass', 300, 0, 2);
  },
  bell() {
    [880, 1320, 2210].forEach((f, i) => tone(f, 2.2 - i * 0.5, 0.12 / (i + 1)));
  },
  ding() {
    tone(1046, 0.25, 0.08, 'triangle');
    tone(1568, 0.35, 0.06, 'triangle', 0.07);
  },
  hit() {
    tone(180, 0.45, 0.25, 'sawtooth', 0, 60);
    burst(0.25, 0.3, 'lowpass', 900);
  },
  drum() {
    tone(110, 0.35, 0.5, 'sine', 0, 45);
    burst(0.08, 0.2, 'lowpass', 400);
  },
  thud() {
    tone(80, 0.2, 0.3, 'sine', 0, 40);
  },
  chain() {
    for (let i = 0; i < 7; i++) burst(0.07, 0.18, 'highpass', 3500 + Math.random() * 2500, i * 0.06 + Math.random() * 0.03, 4);
  },
  whoosh() {
    const a = ctx();
    if (!a || !master) return;
    const s = noise(a);
    const f = a.createBiquadFilter();
    f.type = 'bandpass';
    f.Q.value = 1.5;
    f.frequency.setValueAtTime(200, a.currentTime);
    f.frequency.exponentialRampToValueAtTime(2000, a.currentTime + 0.5);
    const g = a.createGain();
    g.gain.setValueAtTime(0.0001, a.currentTime);
    g.gain.exponentialRampToValueAtTime(0.25, a.currentTime + 0.25);
    g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + 0.7);
    s.connect(f).connect(g).connect(master);
    s.start();
    s.stop(a.currentTime + 0.8);
  },
  tick() {
    tone(1800, 0.03, 0.025, 'square');
  },
  countdown() {
    tone(660, 0.12, 0.08, 'square');
  },
  banish() {
    sfx.chain();
    tone(98, 2.5, 0.3, 'sawtooth', 0.1, 40);
    sfx.gong();
  },
  pardon() {
    sfx.gong();
    [523, 659, 784, 1046].forEach((f, i) => tone(f, 1.6, 0.07, 'triangle', 0.25 + i * 0.12));
  },
  heartbeat() {
    tone(60, 0.18, 0.4, 'sine', 0, 40);
    tone(55, 0.2, 0.3, 'sine', 0.22, 38);
  },
  /* ---- tiếng hành hình ---- */
  /** Tiếng thét xé họng: vọt cao, rè khàn, rung giọng, tắt dần thành tiếng nấc */
  scream(vol = 1, far = false) {
    if (sample('scream', 0.9 * vol, far)) return;
    const f0 = rnd(520, 820), dur = rnd(1.3, 2.1);
    vocal({ f0, dur, vol: 0.34 * vol, vowel: Math.random() < 0.5 ? 'a' : 'e', rough: true, vib: 0.07, breath: 0.25, far,
      pitch: [[0, 0.8], [0.12, 1.25], [0.5, 1.1], [0.8, 0.85], [1, 0.55]] });
    // lớp thứ hai the thé hơn, lệch chút cho như hai họng cùng gào
    vocal({ f0: f0 * 1.5, dur: dur * 0.8, vol: 0.12 * vol, vowel: 'i', vib: 0.09, far, at: 0.05, pitch: [[0, 0.9], [0.2, 1.2], [1, 0.6]] });
    if (!far) gasp(dur + 0.1, 0.18 * vol);
  },
  /** Khóc nấc: từng tiếng "hu… hu…" rơi xuống, xen hít vào giật cục */
  sob(vol = 1, far = false) {
    if (sample('cry', 0.85 * vol, far)) return;
    const f0 = rnd(300, 420), n = 3 + Math.floor(Math.random() * 4);
    let at = 0;
    for (let i = 0; i < n; i++) {
      const d = rnd(0.22, 0.4);
      vocal({ f0: f0 * (1 - i * 0.03), dur: d, vol: 0.22 * vol, vowel: 'u', vib: 0.12, breath: 0.35, far, at, pitch: [[0, 1.15], [1, 0.8]] });
      at += d + rnd(0.05, 0.15);
      if (i % 2 === 1) {
        gasp(at, 0.12 * vol, far);
        at += 0.35;
      }
    }
  },
  /** Khóc than kéo dài, ai oán */
  wail(vol = 1, far = false) {
    if (sample('cry', 0.85 * vol, far, 0.9)) return;
    const f0 = rnd(380, 560);
    vocal({ f0, dur: rnd(2.2, 3.4), vol: 0.2 * vol, vowel: Math.random() < 0.5 ? 'o' : 'u', vib: 0.06, breath: 0.2, far,
      pitch: [[0, 0.9], [0.2, 1.15], [0.45, 1], [0.6, 1.12], [1, 0.62]] });
  },
  /** Rên rỉ trầm, đau đớn */
  moan(vol = 1, far = false) {
    if (Math.random() < 0.6 ? sample('moan', 0.8 * vol, far, 0.85) : sample('cry', 0.7 * vol, far, 0.8)) return;
    const f0 = rnd(110, 170);
    vocal({ f0, dur: rnd(1.6, 2.6), vol: 0.3 * vol, vowel: 'o', rough: Math.random() < 0.5, vib: 0.05, breath: 0.15, far,
      pitch: [[0, 1], [0.3, 1.18], [1, 0.8]] });
  },
  /** Một tiếng kêu khóc bất kỳ (dùng cho nhạc nền & hồn đang chịu hình) */
  cry(vol = 1, far = false) {
    const r = Math.random();
    if (r < 0.3) sfx.sob(vol, far);
    else if (r < 0.55) sfx.wail(vol, far);
    else if (r < 0.8) sfx.moan(vol, far);
    else sfx.scream(vol * 0.8, far);
  },
  squelch() {
    burst(0.18, 0.28, 'lowpass', 500, 0, 6);
    tone(140, 0.15, 0.12, 'sine', 0.02, 70);
  },
  snip() {
    burst(0.05, 0.3, 'highpass', 5000, 0, 3);
    tone(2600, 0.06, 0.08, 'square', 0, 1800);
    sfx.squelch();
  },
  stab() {
    tone(3200, 0.25, 0.06, 'triangle', 0, 2400);
    sfx.squelch();
  },
  sizzle() {
    burst(0.9, 0.12, 'highpass', 4000, 0, 0.7);
  },
  crack() {
    burst(0.08, 0.3, 'highpass', 2500, 0, 2);
    tone(1900, 0.12, 0.05, 'triangle', 0.02, 900);
  },
  crunch() {
    tone(70, 0.3, 0.45, 'sine', 0, 35);
    burst(0.22, 0.35, 'lowpass', 1400, 0, 1);
    burst(0.12, 0.2, 'bandpass', 600, 0.05, 4);
  },
  bubble() {
    for (let i = 0; i < 4; i++) tone(260 + Math.random() * 300, 0.08, 0.07, 'sine', i * 0.07, 700);
  },
  grind() {
    burst(0.45, 0.22, 'bandpass', 300, 0, 3);
    tone(55, 0.45, 0.15, 'sawtooth', 0, 50);
  },
  saw() {
    burst(0.15, 0.22, 'bandpass', 2200, 0, 5);
    burst(0.15, 0.22, 'bandpass', 1500, 0.17, 5);
  },
};

/* ---------- Nhạc nền u ám (ghi âm thật), mỗi tầng một sắc ---------- */
let amb: { stop: () => void } | null = null;
let pendingAmb: number | null = null;

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
  out.gain.exponentialRampToValueAtTime(1, a.currentTime + 3);
  out.connect(master);
  const nodes: AudioScheduledSourceNode[] = [];

  /** Phát lặp một file nền */
  const loop = (name: string, vol: number, rate = 1, lowpass = 0) =>
    load(name).then((buf) => {
      if (!buf || !alive) return;
      const src = a.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      src.playbackRate.value = rate;
      const g = a.createGain();
      g.gain.value = vol;
      let n: AudioNode = src;
      if (lowpass) {
        const lp = a.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = lowpass;
        n = src.connect(lp);
      }
      n.connect(g).connect(out);
      src.start(a.currentTime, Math.random() * buf.duration);
      nodes.push(src);
    });

  if (level === 0) {
    loop('bed0', 0.55); // Điện Sâm La: không khí rờn rợn, tĩnh
    loop('wind', 0.15, 0.9, 1200);
  } else {
    // xen kẽ hai bản nhạc nền; tầng càng sâu càng trầm
    const rate = 1 - ((level - 1) / 17) * 0.12;
    loop(level % 2 ? 'bed1' : 'bed2', 0.6, rate);
    loop('wind', level === 8 ? 0.55 : 0.28, 0.95 + (level % 3) * 0.04, level === 8 ? 0 : 2500); // núi băng gió rít mạnh
  }
  loadSamples();

  const timers: ReturnType<typeof setTimeout>[] = [];
  const every = (min: number, max: number, f: () => void) => {
    const tick = () => {
      timers.push(setTimeout(() => {
        if (!alive) return;
        if (!muted) f();
        tick();
      }, rnd(min, max)));
    };
    tick();
  };
  // sấm rền xa
  every(level === 0 ? 30000 : 14000, level === 0 ? 60000 : 32000, () => sample('thunder', level === 0 ? 0.35 : 0.6, true));
  // văng vẳng tiếng vong hồn khóc than, rên rỉ, gào thét
  every(level === 0 ? 6000 : 4000, level === 0 ? 12000 : 9000, () => {
    if (level === 0) Math.random() < 0.6 ? sfx.sob(0.45, true) : sfx.moan(0.45, true);
    else sfx.cry(rnd(0.45, 0.8), true);
  });
  // thỉnh thoảng chuông xa / xích loảng xoảng
  every(9000, 16000, () => {
    if (Math.random() < 0.5) [440, 660].forEach((f, i) => tone(f * (0.5 + Math.random() * 0.2), 3, 0.025 / (i + 1)));
    else if (level !== 0) for (let i = 0; i < 4; i++) burst(0.06, 0.05, 'highpass', 4000, i * 0.08, 3);
  });

  amb = {
    stop() {
      alive = false;
      timers.forEach(clearTimeout);
      const t = a.currentTime;
      out.gain.cancelScheduledValues(t);
      out.gain.setValueAtTime(out.gain.value, t);
      out.gain.exponentialRampToValueAtTime(0.0001, t + 1.2);
      nodes.forEach((n) => n.stop(t + 1.3));
    },
  };
}

/* ---------- Giọng đọc (Web Speech, có sẵn trong trình duyệt) ---------- */
export type Speaker = 'diem' | 'hac' | 'bach' | 'manh' | 'phan';
const VOICE: Record<Speaker, { pitch: number; rate: number }> = {
  diem: { pitch: 0.3, rate: 0.85 }, // Diêm Vương: trầm, chậm, uy nghiêm
  hac: { pitch: 0.55, rate: 1.05 }, // Hắc Vô Thường: gắt
  bach: { pitch: 1.6, rate: 0.95 }, // Bạch Vô Thường: cao, rờn rợn
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

