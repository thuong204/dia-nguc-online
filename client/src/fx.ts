// Trạng thái hiệu ứng thay đổi theo từng khung hình — để ngoài React cho mượt.
export type FxEvent = { kind: 'burn' | 'push' | 'burst'; id?: string; x?: number; y?: number; z?: number; c?: string };

export const fx = {
  millSpin: 0,
  pushes: new Map<string, number>(), // id -> thời điểm (giây) kéo cối gần nhất
  queue: [] as FxEvent[],
  jumpRequested: false,
  respawn: false,
  beatAt: 0, // performance.now()/1000 của nhịp trống gần nhất
  pounds: new Map<string, number>(), // vị trí cối "x,z" -> thời điểm giã
  bellAt: 0,
  joy: { x: 0, y: 0 }, // cần điều khiển ảo trên điện thoại (-1..1, y dương là kéo xuống)
};

export function onPush(id: string) {
  fx.millSpin = Math.min(fx.millSpin + 2.4, 10);
  fx.pushes.set(id, performance.now() / 1000);
  fx.queue.push({ kind: 'push', id });
}

export function onBurn(id: string) {
  fx.queue.push({ kind: 'burn', id });
}

export const isTyping = () => {
  const el = document.activeElement;
  return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA');
};

export function onBurst(x: number, y: number, z: number, c: string) {
  fx.queue.push({ kind: 'burst', x, y, z, c });
}
