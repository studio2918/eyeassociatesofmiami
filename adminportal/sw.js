/*
  EAOM Admin service worker.
  Shell only: network-first for this folder's own files, falling back to the last copy when offline.
  Never caches API responses, Cognito traffic, tokens, résumé (presigned) links, or any URL with a query
  (?code=... on sign-in return).
  Web Push: shows reminders (payload {title, body?, url, tag}); a tap opens the admin at that url, and
  only at a url inside /adminportal/ on this site (anything else just opens the admin home).
*/
const CACHE = 'eaom-admin-shell-v2';

self.addEventListener('install', () => { self.skipWaiting(); });

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k.startsWith('eaom-admin-') && k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

function cacheable(req) {
  if (req.method !== 'GET' || req.headers.has('Authorization')) return false;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || url.search) return false;
  // This folder's files, plus the shared font/logo/icons it uses from the site.
  return url.href.startsWith(self.registration.scope) || /^\/(fonts|img)\//.test(url.pathname);
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const isNav = req.mode === 'navigate' && new URL(req.url).href.startsWith(self.registration.scope);
  if (!cacheable(req) && !isNav) return; // let the browser handle it (API, Cognito, etc.)
  event.respondWith((async () => {
    try {
      const res = await fetch(req);
      if (res.ok && cacheable(req)) {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy));
      }
      return res;
    } catch (err) {
      const hit = await caches.match(isNav ? self.registration.scope : req);
      if (hit) return hit;
      throw err;
    }
  })());
});

// ---- Web Push ----

const FALLBACK_TITLE = 'Eye Associates admin';

// Absolute url when `raw` is on this origin and inside /adminportal/; otherwise null. Tested in node.
function safeNotificationUrl(raw, origin) {
  if (typeof raw !== 'string' || !raw) return null;
  let u;
  try { u = new URL(raw, origin); } catch { return null; }
  if (u.origin !== origin || !u.pathname.startsWith('/adminportal/')) return null;
  return u.href;
}

function notificationFrom(payload) {
  const p = payload && typeof payload === 'object' ? payload : {};
  const str = (v) => (typeof v === 'string' && v.trim() ? v.trim() : null);
  const options = {
    data: { url: safeNotificationUrl(p.url, self.location.origin) },
    icon: '../img/apple-touch-icon.png',
    badge: '../img/favicon-32.png',
  };
  if (str(p.body)) options.body = str(p.body);
  if (str(p.tag)) options.tag = str(p.tag);
  return { title: str(p.title) || FALLBACK_TITLE, options };
}

self.addEventListener('push', (event) => {
  let payload = null;
  try { payload = event.data ? event.data.json() : null; } catch { payload = null; }
  const { title, options } = notificationFrom(payload);
  // iPhone requires every push to show a notification, so this always shows one.
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  const url = safeNotificationUrl(data.url, self.location.origin);
  event.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const admin = wins.find((c) => typeof c.url === 'string' && c.url.startsWith(self.registration.scope));
    if (admin) {
      try { await admin.focus(); } catch { /* still try to navigate */ }
      if (!url) return;
      try {
        if (typeof admin.navigate !== 'function') throw new TypeError('no navigate');
        await admin.navigate(url);
      } catch {
        // Not controlled by this worker (e.g. first visit): the page navigates itself (app.js).
        if (typeof admin.postMessage === 'function') admin.postMessage({ type: 'eaom:navigate', url });
      }
      return;
    }
    await self.clients.openWindow(url || self.registration.scope);
  })());
});
