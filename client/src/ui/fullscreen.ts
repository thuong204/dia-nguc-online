// Toàn màn hình + khoá xoay ngang (Android Chrome hỗ trợ; iPhone chỉ có khi "Thêm vào MH chính").
type FsDoc = Document & { webkitFullscreenElement?: Element; webkitExitFullscreen?: () => Promise<void> };
type FsEl = HTMLElement & { webkitRequestFullscreen?: () => Promise<void> };
type Orient = ScreenOrientation & { lock?: (o: string) => Promise<void> };

const doc = () => document as FsDoc;
export const isTouch = () => typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches;
export const canFullscreen = () => {
  const el = document.documentElement as FsEl;
  return !!(el.requestFullscreen || el.webkitRequestFullscreen);
};
export const isFullscreen = () => !!(doc().fullscreenElement || doc().webkitFullscreenElement);
/** Đang chạy dạng app cài trên màn hình chính (đã toàn màn hình sẵn) */
export const isStandalone = () => matchMedia('(display-mode: fullscreen), (display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true;

/** Phải gọi trong sự kiện bấm/chạm của người dùng. */
export async function enterFullscreen(landscape = true) {
  const el = document.documentElement as FsEl;
  try {
    if (!isFullscreen()) await (el.requestFullscreen ? el.requestFullscreen({ navigationUI: 'hide' }) : el.webkitRequestFullscreen?.());
  } catch {
    /* trình duyệt từ chối */
  }
  if (landscape) {
    try {
      await (screen.orientation as Orient | undefined)?.lock?.('landscape');
    } catch {
      /* không khoá được xoay (VD iPhone) — người chơi tự xoay */
    }
  }
}

export async function exitFullscreen() {
  try {
    (screen.orientation as Orient | undefined)?.unlock?.();
    if (isFullscreen()) await (document.exitFullscreen ? document.exitFullscreen() : doc().webkitExitFullscreen?.());
  } catch {
    /* bỏ qua */
  }
}

export function onFullscreenChange(f: () => void) {
  document.addEventListener('fullscreenchange', f);
  document.addEventListener('webkitfullscreenchange', f);
  return () => {
    document.removeEventListener('fullscreenchange', f);
    document.removeEventListener('webkitfullscreenchange', f);
  };
}

// chặn chụm 2 ngón phóng to trang trên iPhone (Safari bỏ qua user-scalable=no)
if (typeof document !== 'undefined') {
  document.addEventListener('gesturestart', (e) => e.preventDefault());
  let last = 0;
  document.addEventListener('touchend', (e) => {
    const now = Date.now();
    if (now - last < 300 && !(e.target as HTMLElement)?.closest?.('input, textarea')) e.preventDefault(); // chạm đúp không phóng to
    last = now;
  }, { passive: false });
}
