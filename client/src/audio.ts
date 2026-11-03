// Âm thanh tự tổng hợp bằng WebAudio (không cần file) + giọng đọc tiếng Việt của trình duyệt.
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

function ctx() {
  if (!ac) {
    try {
      ac = new AudioContext();
      master = ac.createGain();
      master.gain.value = muted ? 0 : 0.8;
      master.connect(ac.destination);
    } catch {
      return null;
    }
  }
  if (ac.state === 'suspended') ac.resume().catch(() => {});
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

export const isMuted = () => muted;
export function setMuted(m: boolean) {
  muted = m;
  try {
    localStorage.setItem('dn-mute', m ? '1' : '0');
  } catch {
    /* bỏ qua */
  }
  if (master && ac) master.gain.setTargetAtTime(m ? 0 : 0.8, ac.currentTime, 0.05);
  if (m) speechSynthesis?.cancel();
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
};

/* ---------- Nhạc nền u ám, mỗi tầng một sắc ---------- */
let amb: { stop: () => void } | null = null;
let pendingAmb: number | null = null;

/** level 0 = điện Diêm Vương; 1..18 = các tầng. */
export function ambience(level: number) {
  const a = ctx();
  pendingAmb = level;
  if (!a || !master || a.state !== 'running') return;
  pendingAmb = null;
  amb?.stop();
  const out = a.createGain();
  out.gain.setValueAtTime(0.0001, a.currentTime);
  out.gain.exponentialRampToValueAtTime(level === 0 ? 0.5 : 0.35, a.currentTime + 2.5);
  out.connect(master);
  const nodes: AudioScheduledSourceNode[] = [];

  // Tiếng ù trầm: hai sóng lệch nhau tạo cảm giác rung rợn
  const base = level === 0 ? 41 : [55, 49, 46, 52, 58, 44, 62, 39, 47, 51, 43, 57, 36, 33, 48, 65, 40, 37][level - 1];
  const lp = a.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = level === 8 ? 600 : 260;
  lp.connect(out);
  [1, 1.007, 1.5].forEach((m, i) => {
    const o = a.createOscillator();
    o.type = i === 2 ? 'sine' : 'sawtooth';
    o.frequency.value = base * m;
    const g = a.createGain();
    g.gain.value = i === 2 ? 0.12 : 0.18;
    o.connect(g).connect(lp);
    o.start();
    nodes.push(o);
  });

  // Gió âm phủ: tiếng ồn lọc dải, tần số trôi chậm
  const w = noise(a);
  w.loop = true;
  const bp = a.createBiquadFilter();
  bp.type = 'bandpass';
  bp.Q.value = 0.8;
  bp.frequency.value = 500;
  const lfo = a.createOscillator();
  lfo.frequency.value = 0.07;
  const lfoG = a.createGain();
  lfoG.gain.value = 350;
  lfo.connect(lfoG).connect(bp.frequency);
  const wg = a.createGain();
  wg.gain.value = level === 8 ? 0.35 : 0.18; // núi băng gió rít mạnh hơn
  w.connect(bp).connect(wg).connect(out);
  w.start();
  lfo.start();
  nodes.push(w, lfo);

  // Thỉnh thoảng một tiếng chuông xa / xích loảng xoảng
  const timer = setInterval(() => {
    if (Math.random() < 0.5) [440, 660].forEach((f, i) => tone(f * (0.5 + Math.random() * 0.2), 3, 0.025 / (i + 1)));
    else if (level !== 0) for (let i = 0; i < 4; i++) burst(0.06, 0.05, 'highpass', 4000, i * 0.08, 3);
  }, 9000);

  amb = {
    stop() {
      clearInterval(timer);
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
  viVoice = vs.find((v) => v.lang.toLowerCase().startsWith('vi')) ?? null;
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
