// Admin shell: sign-in gate, hash router, tab bars, menu, service worker.
import { handleRedirect, isSignedIn, signIn, signOut, signedInEmail, resetRedirect, currentToken, role } from './auth.js';
import { canSee } from './roles.js';
import * as api from './api.js';
import * as ui from './ui.js';
import * as drafts from './drafts.js';
import { disableDevice } from './push.js';
import { parseHash, isFramed } from './router.js';

const main = document.getElementById('main');
const menuWrap = document.getElementById('menuWrap');
const menuBtn = document.getElementById('menuBtn');
const menu = document.getElementById('menu');
let renderSeq = 0;

function showSignedOut(error) {
  document.body.classList.remove('signed-in');
  for (const id of ['topTabs', 'bottomTabs']) document.getElementById(id).hidden = true;
  menuWrap.hidden = true;
  const { h } = ui;
  main.replaceChildren(h('section', { class: 'card signin' },
    h('img', { src: '../img/logo-header-clear.png', alt: '', width: '200', height: '78' }),
    h('h1', {}, 'Website admin'),
    h('p', { class: 'soft' }, 'Change banners, closings, hours, insurance and jobs on the website.'),
    error ? h('p', { class: 'error', role: 'alert' }, error) : null,
    h('button', { type: 'button', class: 'btn wide', id: 'signInBtn', onclick: onSignIn }, 'Sign in')));
}

async function onSignIn(e) {
  const btn = e.currentTarget;
  btn.disabled = true;
  try { await signIn(location.hash || '#banners'); } catch {
    btn.disabled = false;
    ui.toast('Could not start sign-in. Please try again.');
  }
}

function showShell() {
  document.body.classList.add('signed-in');
  for (const id of ['topTabs', 'bottomTabs']) document.getElementById(id).hidden = false;
  menuWrap.hidden = false;
  document.getElementById('who').textContent = signedInEmail() ? 'Signed in as ' + signedInEmail() : 'Signed in';
}

// Signed in, but no role yet (or it was taken away): no tabs, no API calls.
function showNoRole() {
  ui.applyNav(null, canSee);
  main.replaceChildren(ui.noRoleCard(signedInEmail(), async () => {
    const tok = await currentToken({ force: true }).catch(() => undefined);
    if (tok === null) return showSignedOut('Please sign in again.');
    if (tok === undefined) { ui.toast("Couldn't reach the sign-in service. Check your connection and try again."); return; }
    if (role()) { route(); return; }
    ui.toast('Still no access. Ask Dr. Gray to add you.');
  }, () => signOut()));
}

function setMenu(open) {
  menu.hidden = !open;
  menuBtn.setAttribute('aria-expanded', String(open));
}
menuBtn.addEventListener('click', (e) => { e.stopPropagation(); setMenu(menu.hidden); });
document.addEventListener('click', (e) => { if (!menu.hidden && !menuWrap.contains(e.target)) setMenu(false); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !menu.hidden) { setMenu(false); menuBtn.focus(); } });
menu.addEventListener('click', (e) => { if (e.target.closest('a')) setMenu(false); });
document.getElementById('signOutBtn').addEventListener('click', async () => {
  setMenu(false);
  if (await ui.confirmDialog('Sign out on this device?', { ok: 'Sign out' })) {
    await disableDevice({ api, role: role() }); // best effort: this phone stops getting reminders
    await signOut();
  }
});

async function route() {
  if (!document.body.classList.contains('signed-in')) return;
  const seq = ++renderSeq;
  const r = parseHash(location.hash);
  setMenu(false);
  drafts.stopAll(); // flush + detach the previous screen's form (its draft stays saved)
  const me = role();
  if (!me) return showNoRole();
  ui.applyNav(me, canSee);
  ui.renderTabs(r.screen);
  if (!canSee(me, r.screen)) { main.replaceChildren(ui.noAccess()); window.scrollTo(0, 0); return; }
  try {
    const mod = await import(`./screens/${r.screen}.js`);
    if (seq !== renderSeq) return;
    const root = document.createElement('div');
    main.replaceChildren(root);
    await mod.render(root, { route: r, draftKey: location.hash, api, ui, role: me, me: signedInEmail(), navigate: (hash) => { location.hash = hash; } });
  } catch (err) {
    if (err instanceof api.SignInRejectedError) return showSignedOut(err.message);
    if (err instanceof api.AuthError || seq !== renderSeq) return;
    main.replaceChildren(ui.h('p', { class: 'error', role: 'alert' }, err && err.message ? err.message : 'Something went wrong.'));
  }
  window.scrollTo(0, 0);
}
window.addEventListener('hashchange', route);

async function start() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js', { scope: './' }).catch(() => { /* offline install only */ });
    // A tapped reminder when this window isn't controlled by the worker yet (sw.js notificationclick).
    navigator.serviceWorker.addEventListener('message', (e) => {
      const d = e.data;
      if (!d || d.type !== 'eaom:navigate' || typeof d.url !== 'string') return;
      let u;
      try { u = new URL(d.url, location.origin); } catch { return; }
      if (u.origin === location.origin && u.pathname.startsWith('/adminportal/')) location.href = u.href;
    });
  }
  // Back from Cognito can restore this page from bfcache: allow a fresh sign-in.
  addEventListener('pageshow', (e) => {
    if (!e.persisted) return;
    resetRedirect();
    const btn = document.getElementById('signInBtn');
    if (btn) btn.disabled = false;
  });
  // Never lose typing when the app is backgrounded or closed.
  addEventListener('pagehide', () => drafts.flushAll());
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') drafts.flushAll(); });
  // A sign-in that just finished was rejected by the API: stop here instead of looping.
  addEventListener('eaom:signin-rejected', (e) => showSignedOut(e.detail));

  let r = { signedIn: false };
  try { r = await handleRedirect(); } catch (e) { r = { signedIn: false, error: e.message }; }
  if (!isSignedIn()) return showSignedOut(r.error);
  // The role lives in the ID token: get a current one before choosing tabs (a new tab has only the refresh token).
  let tok;
  try { tok = await currentToken(); } catch {
    showSignedOut("Couldn't reach the sign-in service. Check your connection and try again.");
    return;
  }
  if (!tok) return showSignedOut(r.error || 'Please sign in again.');
  showShell();
  // Badge after the first screen (so token refresh isn't raced); the Applications screen sets it itself.
  route().then(() => {
    if (parseHash(location.hash).screen !== 'applications' && canSee(role(), 'applications')) ui.refreshAppsBadge(api);
  });
  if (r.error) ui.toast(r.error); // e.g. an old ?code= reopened from history; still signed in
}

// Clickjacking guard: inside someone else's frame, show nothing usable and never start sign-in.
if (isFramed(window)) {
  document.body.replaceChildren(Object.assign(document.createElement('p'), {
    textContent: 'Open this page directly: eyeassociatesofmiami.com/adminportal/',
  }));
} else {
  start();
}
