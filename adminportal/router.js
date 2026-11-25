// Hash routes: #<screen>[/<part>...][?query], e.g. #jobs/j1, #closings/new?date=2026-12-24,
// #holiday/thanksgiving/2026-11-26?remind=holiday:holiday%23thanksgiving%232026
export const SCREENS = ['banners', 'closings', 'hours', 'insurance', 'jobs', 'applications', 'changes', 'reminders', 'people', 'holiday', 'doctors', 'profile', 'themes'];
export const DEFAULT_SCREEN = 'banners';

export function parseHash(hash) {
  const raw = String(hash || '').replace(/^#/, '');
  const qi = raw.indexOf('?');
  const path = qi === -1 ? raw : raw.slice(0, qi);
  const qs = qi === -1 ? '' : raw.slice(qi + 1);
  const segs = path.split('/').filter(Boolean).map((s) => { try { return decodeURIComponent(s); } catch { return s; } });
  const screen = segs[0];
  if (!SCREENS.includes(screen)) return { screen: DEFAULT_SCREEN, parts: [], query: {} };
  return { screen, parts: segs.slice(1), query: Object.fromEntries(new URLSearchParams(qs)) };
}

// Clickjacking guard (GitHub Pages can't send frame-ancestors / X-Frame-Options).
export function isFramed(win) {
  try { return win.top !== win.self; } catch { return true; }
}
