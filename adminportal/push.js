// Web Push for the Reminders screen: which reminders a role can get, whether this phone can get them,
// and turning them on / off. Pure parts are tested in node; the browser parts take `win` (default: the
// page's window) so tests and the dev mock can pass fakes.
//
// iPhone: notifications work only from the installed app (Add to Home Screen, iOS 16.4+), and
// Notification.requestPermission must run straight from a tap (turnOn asks before any other await).
//
// Server (push.py): POST /admin/push/subscribe {subscription, kinds} (kinds [] = off, the row stays);
// GET /admin/push/me -> {subscriptions:[{origin, kinds}]} for this login; POST /admin/push/test.
// The server only shows each subscription's push-service origin, so "on for THIS phone" also needs
// a local marker: the last characters of this phone's endpoint, kept in localStorage.

export const ALL_KINDS = ['hiring', 'holiday', 'weather', 'bannerEnd', 'app', 'bio']; // roles.ALL_PUSH_KINDS
const EDITOR_KINDS = ['holiday', 'bannerEnd']; // roles.EDITOR_PUSH_KINDS (weather banners: owner/doctor only)

export const KIND_LABELS = {
  hiring: 'Still hiring? (Mondays 9 AM)',
  holiday: 'Holiday hours check (2 weeks before)',
  weather: 'Weather banner follow-up (7 AM next day)',
  bannerEnd: 'Banner ends tonight (3 PM)',
  app: 'New job application',
  bio: 'Doctor bios (answers in, ready to approve, approved)',
};

export function kindsFor(role) {
  if (role === 'owner' || role === 'doctor') return [...ALL_KINDS];
  if (role === 'editor') return [...EDITOR_KINDS];
  return [];
}

export const kindOptions = (role) => kindsFor(role).map((id) => ({ id, label: KIND_LABELS[id] }));

// Allowed kinds for the role, canonical order, no duplicates.
export function cleanKinds(kinds, role) {
  const want = new Set(Array.isArray(kinds) ? kinds : []);
  return kindsFor(role).filter((k) => want.has(k));
}

// ---- this device ----

export function isIos(win = globalThis) {
  const nav = (win && win.navigator) || {};
  const ua = String(nav.userAgent || '');
  return /iPhone|iPad|iPod/.test(ua) || (nav.platform === 'MacIntel' && Number(nav.maxTouchPoints) > 1);
}

export function isStandalone(win = globalThis) {
  const nav = (win && win.navigator) || {};
  if (nav.standalone === true) return true;
  try { return !!(win.matchMedia && win.matchMedia('(display-mode: standalone)').matches); } catch { return false; }
}

// 'install' (iPhone/iPad, not opened from the Home Screen icon) | 'unsupported' | 'ok'
export function pushSupport(win = globalThis) {
  if (isIos(win) && !isStandalone(win)) return 'install';
  const nav = (win && win.navigator) || {};
  if (!('serviceWorker' in nav) || !win.PushManager || !win.Notification) return 'unsupported';
  return 'ok';
}

export const MARKER_KEY = 'eaom_admin_push';
const TAIL = 24;

export function endpointOrigin(endpoint) {
  try { return new URL(endpoint).origin; } catch { return null; }
}

// last: the last non-empty kinds, so turning reminders back on offers the same ones again.
export function makeMarker(endpoint, kinds, last = kinds) {
  return { origin: endpointOrigin(endpoint), tail: String(endpoint || '').slice(-TAIL), kinds: [...(kinds || [])], last: [...(last || [])] };
}

export function saveMarker(endpoint, kinds) {
  const prev = loadMarker();
  const last = kinds && kinds.length ? kinds : (prev && prev.last) || [];
  try { localStorage.setItem(MARKER_KEY, JSON.stringify(makeMarker(endpoint, kinds, last))); } catch { /* blocked storage */ }
}

// Kinds pre-ticked in the "off" state: the last ones this phone had (for this role), else all.
export function startKinds(role) {
  const m = loadMarker();
  const last = cleanKinds(m && (m.last && m.last.length ? m.last : m.kinds), role);
  return last.length ? last : kindsFor(role);
}

export function loadMarker() {
  try {
    const m = JSON.parse(localStorage.getItem(MARKER_KEY) || 'null');
    return m && typeof m.tail === 'string' && Array.isArray(m.kinds) ? m : null;
  } catch { return null; }
}

// -> {state: 'install'|'unsupported'|'denied'|'off'|'on', kinds}
// sub: this browser's PushSubscription (or null); server: /admin/push/me subscriptions; marker: loadMarker().
export function deviceState({ support, permission, sub = null, server = [], marker = null, role = 'owner' }) {
  if (support !== 'ok') return { state: support === 'install' ? 'install' : 'unsupported', kinds: [] };
  if (permission === 'denied') return { state: 'denied', kinds: [] };
  const off = { state: 'off', kinds: [] };
  if (!sub || !sub.endpoint || permission !== 'granted') return off;
  const origin = endpointOrigin(sub.endpoint);
  const listed = (server || []).some((s) => s && s.origin === origin && Array.isArray(s.kinds) && s.kinds.length);
  const mine = marker && marker.origin === origin && marker.tail === makeMarker(sub.endpoint).tail;
  if (!listed || !mine) return off;
  const kinds = cleanKinds(marker.kinds, role);
  return kinds.length ? { state: 'on', kinds } : off;
}

export function keyToBytes(b64url) {
  const s = String(b64url).replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(s + '='.repeat((4 - (s.length % 4)) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

export function testResultText(res) {
  const n = Number(res && res.sent) || 0;
  if (!n) return 'Nothing was sent. Turn on reminders on this phone first, then try again.';
  return n === 1 ? 'Test sent. It should arrive in a few seconds.' : `Test sent to ${n} devices. It should arrive in a few seconds.`;
}

// ---- browser flows ----

export const READY_TIMEOUT_MS = 5000;

// serviceWorker.ready never settles when the worker can't install (e.g. storage blocked): give up.
async function registration(win, timeoutMs = READY_TIMEOUT_MS) {
  let timer;
  const late = new Promise((_, reject) => {
    timer = setTimeout(() => reject(Object.assign(new Error('The service worker did not start.'), { name: 'PhoneCheckTimeout' })), timeoutMs);
  });
  try { return await Promise.race([win.navigator.serviceWorker.ready, late]); } finally { clearTimeout(timer); }
}

async function currentSub(win) {
  try { return await (await registration(win)).pushManager.getSubscription(); } catch { return null; }
}

// Throws PhoneCheckTimeout when the service worker doesn't get ready in time.
export async function readDevice({ api, role, win = globalThis, timeoutMs = READY_TIMEOUT_MS }) {
  const support = pushSupport(win);
  if (support !== 'ok') return deviceState({ support });
  const permission = win.Notification.permission;
  if (permission === 'denied') return deviceState({ support, permission });
  const reg = await registration(win, timeoutMs);
  const [sub, me] = await Promise.all([reg.pushManager.getSubscription().catch(() => null), api.get('/admin/push/me')]);
  return deviceState({ support, permission, sub, server: (me && me.subscriptions) || [], marker: loadMarker(), role });
}

async function post(api, sub, kinds) {
  await api.post('/admin/push/subscribe', { subscription: sub.toJSON(), kinds });
  saveMarker(sub.endpoint, kinds);
  return kinds.length ? { state: 'on', kinds } : { state: 'off', kinds: [] };
}

// Call straight from the tap handler: the permission prompt is the first thing that happens.
export async function turnOn({ api, role, kinds, win = globalThis }) {
  const permission = await win.Notification.requestPermission();
  if (permission !== 'granted') return { state: permission === 'denied' ? 'denied' : 'off', kinds: [] };
  const reg = await registration(win);
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    const { publicKey } = await api.get('/push/key');
    sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyToBytes(publicKey) });
  }
  return post(api, sub, cleanKinds(kinds, role));
}

export async function setKinds({ api, role, kinds, win = globalThis }) {
  const sub = await currentSub(win);
  if (!sub) return { state: 'off', kinds: [] };
  return post(api, sub, cleanKinds(kinds, role));
}

// Keeps the browser subscription (the server keeps the row with no kinds, so nothing is sent).
export async function turnOff({ api, role, win = globalThis }) {
  return setKinds({ api, role, kinds: [], win });
}

export const sendTest = (api) => api.post('/admin/push/test', {});

// Sign-out: stop reminders for this device. Posts kinds [] then drops the browser subscription.
// Best effort and time-boxed: it never blocks or fails the sign-out.
export async function disableDevice({ api, role, win = globalThis, timeoutMs = 3000 }) {
  let timer;
  const work = (async () => {
    if (pushSupport(win) !== 'ok') return;
    const sub = await currentSub(win);
    if (!sub) return;
    try { await post(api, sub, []); } catch { /* offline or session gone */ }
    try { await sub.unsubscribe(); } catch { /* ignore */ }
  })().catch(() => {});
  const late = new Promise((resolve) => { timer = setTimeout(resolve, timeoutMs); });
  try { await Promise.race([work, late]); } finally { clearTimeout(timer); }
}
