// Shared UI pieces for the admin screens. Nothing here touches the DOM at import time
// (so node tests can import formDraft).
import * as drafts from './drafts.js';
import { REMIND_CHOICES, remindAnswerPath, remindOutcome, remindLabel, answeredText } from './model.js';

export const TABS = [
  { id: 'banners', label: 'Banners' },
  { id: 'closings', label: 'Closings' },
  { id: 'hours', label: 'Hours' },
  { id: 'insurance', label: 'Insurance' },
  { id: 'jobs', label: 'Jobs' },
  { id: 'applications', label: 'Applications' },
  { id: 'themes', label: 'Themes' },
];

export const MENU = [
  { id: 'profile', label: 'My profile' },
  { id: 'doctors', label: 'Doctors' },
  { id: 'applications', label: 'Applications' },
  { id: 'changes', label: 'Change log' },
  { id: 'reminders', label: 'Reminders' },
  { id: 'people', label: 'People' },
];

// Small element helper: h('button', {class:'btn', onclick}, 'Save')
export function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (k === 'class') el.className = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat()) {
    if (kid == null || kid === false) continue;
    el.append(kid instanceof Node ? kid : document.createTextNode(String(kid)));
  }
  return el;
}

// Marks the active tab in both tab bars (top on wide screens, bottom on phones).
export function renderTabs(active) {
  document.querySelectorAll('[data-tab]').forEach((a) => {
    if (a.dataset.tab === active) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
}

// Shows only the tabs and menu links this role can use (index.html lists them all).
// role null: no tab bars and no menu links (Sign out stays).
export function applyNav(role, canSee) {
  document.querySelectorAll('[data-tab]').forEach((a) => { a.hidden = !canSee(role, a.dataset.tab); });
  for (const id of ['topTabs', 'bottomTabs']) {
    const bar = document.getElementById(id);
    if (bar) bar.hidden = !role;
  }
  document.body.classList.toggle('no-tabs', !role);
}

// Route typed for a screen this role can't use.
export function noAccess() {
  return h('section', { class: 'card' },
    h('h1', {}, 'No access'),
    h('p', {}, "You don't have access to this."),
    h('p', {}, h('a', { href: '#banners' }, 'Go to Banners')));
}

// Signed in, but the login has no role yet. onRetry: re-check with a fresh token.
export function noRoleCard(email, onRetry, onSignOut) {
  const retry = h('button', { type: 'button', class: 'btn wide' }, 'Check again');
  retry.addEventListener('click', async () => { retry.disabled = true; try { await onRetry(); } finally { retry.disabled = false; } });
  return h('section', { class: 'card signin' },
    h('h1', {}, 'Website admin'),
    email ? h('p', { class: 'soft' }, `Signed in as ${email}`) : null,
    h('p', {}, "Your login doesn't have access yet. Ask Dr. Gray."),
    retry,
    h('button', { type: 'button', class: 'btn ghost wide', style: 'margin-top:8px', onclick: onSignOut }, 'Sign out'));
}

let toastTimer = null;
export function toast(text, { ms = 3500 } = {}) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = text;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, ms);
}

// Resolves true (OK) or false (Cancel / Esc).
export function confirmDialog(text, { ok = 'OK', cancel = 'Cancel', danger = false } = {}) {
  return new Promise((resolve) => {
    const dlg = h('dialog', { class: 'confirm' },
      h('p', {}, text),
      h('div', { class: 'row end' },
        h('button', { type: 'button', class: 'btn ghost', value: 'cancel' }, cancel),
        h('button', { type: 'button', class: danger ? 'btn danger' : 'btn', value: 'ok' }, ok)));
    dlg.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (b) dlg.close(b.value);
    });
    dlg.addEventListener('close', () => { resolve(dlg.returnValue === 'ok'); dlg.remove(); });
    document.body.append(dlg);
    dlg.showModal();
  });
}

// "How it looks on the website" box. kind = banner | closing | hours | insurance | jobs.
// content: a Node or plain text. Tasks 11-14 build the per-kind content.
// sticky: stays at the top of a scrolling sheet so it's visible while typing.
export function previewFrame(kind, content, { sticky = false } = {}) {
  return h('section', { class: `preview preview-${kind}${sticky ? ' sticky' : ''}`, 'aria-label': 'Preview on the website' },
    h('div', { class: 'preview-label' }, 'Preview — how it looks on the website'),
    h('div', { class: 'preview-body' }, content == null ? '' : content));
}

const SKIP = new Set(['submit', 'button', 'reset', 'file', 'password', 'hidden']);

// Current values of a form, as formDraft stores them (checkbox groups are arrays).
export function readForm(formEl) { return read(formEl); }

function read(formEl) {
  const out = {};
  for (const el of formEl.elements) {
    if (!el.name || SKIP.has(el.type)) continue;
    if (el.type === 'radio') { if (el.checked) out[el.name] = el.value; } else if (el.type === 'checkbox') {
      out[el.name] = out[el.name] || [];
      if (el.checked) out[el.name].push(el.value);
    } else out[el.name] = el.value;
  }
  return out;
}

function write(formEl, data) {
  for (const el of formEl.elements) {
    if (!el.name || SKIP.has(el.type) || !(el.name in data)) continue;
    const v = data[el.name];
    if (el.type === 'radio') el.checked = v === el.value;
    else if (el.type === 'checkbox') el.checked = Array.isArray(v) && v.includes(el.value);
    else el.value = v;
  }
}

// Keeps a form's typing in localStorage draft:<key> (debounced) and restores it on load.
// Returns { restored, flush(), clear(), stop() }. Call clear() after a successful save.
// Screens pass ctx.draftKey (the current location.hash) so a sign-in round trip restores it.
export function formDraft(formEl, key, { delay = 400 } = {}) {
  let timer = null;
  let pending = false;
  const saved = drafts.load(key);
  if (saved && typeof saved === 'object') write(formEl, saved);

  const handle = {
    restored: !!saved,
    flush() {
      clearTimeout(timer);
      if (pending) { pending = false; drafts.save(key, read(formEl)); }
    },
    clear() { clearTimeout(timer); pending = false; drafts.clear(key); },
    stop() {
      handle.flush(); // keep typing that hasn't hit the debounce yet
      formEl.removeEventListener('input', onChange);
      formEl.removeEventListener('change', onChange);
      drafts.unregister(handle);
    },
  };
  function onChange() {
    pending = true;
    clearTimeout(timer);
    timer = setTimeout(() => handle.flush(), delay);
  }
  formEl.addEventListener('input', onChange);
  formEl.addEventListener('change', onChange);
  drafts.register(handle);
  return handle;
}

// ---- Editing primitives (Task 11+) ----

// Side sheet on wide screens, bottom sheet on phones; kind 'popup' = centered (quick changes).
// content: the sheet's form (use class sheet-form with .sheet-body + .sheet-foot inside).
// onClose (optional, may be async) returns false to keep it open. Closes itself on a route change.
// onDispose (optional) runs once on every close, including a route change (screen teardown).
export function sheet({ title, content, onClose, onDispose, kind = 'sheet' }) {
  const x = h('button', { type: 'button', class: 'sheet-x', 'aria-label': 'Close' }, '×');
  const dlg = h('dialog', { class: kind === 'popup' ? 'popup' : 'sheet', 'aria-label': title },
    h('header', { class: 'sheet-head' }, h('h2', {}, title), x), content);
  let open = true;
  const handle = {
    el: dlg,
    get open() { return open; },
    close() {
      if (!open) return;
      open = false;
      removeEventListener('hashchange', onRoute);
      if (dlg.open) dlg.close();
      dlg.remove();
      if (onDispose) onDispose();
    },
    async request() { if (onClose && (await onClose()) === false) return; handle.close(); },
  };
  function onRoute() { handle.close(); }
  x.addEventListener('click', () => handle.request());
  dlg.addEventListener('cancel', (e) => { e.preventDefault(); handle.request(); });
  addEventListener('hashchange', onRoute);
  document.body.append(dlg);
  dlg.showModal();
  return handle;
}

// Server errors (block Save) and warnings (yellow, Save allowed).
export function issues(errors = [], warnings = []) {
  const out = [];
  if (errors.length) out.push(h('ul', { class: 'issues errors', role: 'alert' }, errors.map((t) => h('li', {}, t))));
  if (warnings.length) out.push(h('ul', { class: 'issues warnings' }, warnings.map((t) => h('li', {}, t))));
  return out;
}

// "Dr. Walls changed this a minute ago — reload?" + Reload.
export function staleNotice(message, onReload) {
  const btn = h('button', { type: 'button', class: 'btn small' }, 'Reload');
  btn.addEventListener('click', async () => { btn.disabled = true; try { await onReload(); } finally { btn.disabled = false; } });
  return h('div', { class: 'stale', role: 'alert' }, h('p', {}, message), btn);
}

// Read-only copy of what the user typed, shown after a reload so nothing is lost.
export function keptText(text, onUse) {
  return h('div', { class: 'kept' },
    h('p', {}, 'What you typed before reloading (copy what you need):'),
    h('textarea', { readonly: true, rows: '3', 'aria-label': 'What you typed before reloading' }, text),
    onUse ? h('div', { class: 'row', style: 'margin-top:8px' },
      h('button', { type: 'button', class: 'btn ghost small', onclick: onUse }, 'Use my text')) : null);
}

// Debounced dry-run check. check() returns {errors, warnings} or a promise of one.
// paint(state) gets {pending, errors, warnings, failed}. Stale answers are dropped.
export function liveCheck(check, paint, { delay = 450 } = {}) {
  let seq = 0, timer = null;
  let state = { pending: true, errors: [], warnings: [], failed: null };
  const set = (s) => { state = s; paint(state); };
  async function now() {
    clearTimeout(timer);
    const my = ++seq;
    set({ ...state, pending: true });
    let next;
    try {
      const r = (await check()) || {};
      next = { pending: false, errors: r.errors || [], warnings: r.warnings || [], failed: null };
    } catch (err) {
      next = { pending: false, errors: [], warnings: [], failed: err };
    }
    if (my === seq) set(next);
    return state;
  }
  return {
    now,
    // A newer edit makes any in-flight answer stale (it was for the old values).
    schedule() { clearTimeout(timer); seq++; set({ ...state, pending: true }); timer = setTimeout(now, delay); },
    stop() { clearTimeout(timer); seq++; },
    get state() { return state; },
  };
}

// What a failed save shows. Returns nodes for the screen's message box (empty = nothing to show).
export function saveErrorNodes(err, { onReload } = {}) {
  const name = err && err.name;
  if (name === 'AuthError' || name === 'SignInRejectedError') return []; // page is going to sign-in
  if (name === 'ForbiddenError') { toast(err.message); return []; }
  if (name === 'StaleError') return [staleNotice(err.message, onReload)];
  if (name === 'ValidationError') return issues(err.errors, err.warnings);
  return [h('p', { class: 'error', role: 'alert' }, (err && err.message) || 'Something went wrong.')];
}

// Segmented radio group: options [{value, label}]
export function seg(name, options, value, { legend, hint } = {}) {
  return h('fieldset', { class: 'field' },
    legend ? h('legend', {}, legend) : null,
    h('div', { class: 'seg' }, options.map((o) => h('label', {},
      h('input', { type: 'radio', name, value: o.value, checked: o.value === value }), o.label))),
    hint ? h('p', { class: 'hint' }, hint) : null);
}

// <select> of 'HH:MM' values shown as '12:00 PM'. labelFn formats each option.
export function timeSelect(name, values, value, labelFn, attrs = {}) {
  const sel = h('select', { name, ...attrs }, values.map((v) => h('option', { value: v, selected: v === value }, labelFn(v))));
  if (value != null) sel.value = value;
  return sel;
}

// Unsaved-changes guard for a whole-screen editor (e.g. Insurance). While dirty() is true, a tap on a
// tab or menu link asks first, and closing the page asks the browser's own question. The draft stays
// in localStorage either way. Removes itself once the route leaves `#<screen>`. Returns stop().
export function leaveGuard(screen, dirty, { text = 'You have unsaved changes. Leave this page anyway?' } = {}) {
  const here = () => { const s = location.hash.replace(/^#/, '').split(/[/?]/)[0]; return s === screen; };
  async function onClick(e) {
    const a = e.target.closest && e.target.closest('a[href^="#"]');
    if (!a || !dirty()) return;
    const to = a.getAttribute('href');
    if (to.replace(/^#/, '').split(/[/?]/)[0] === screen) return;
    e.preventDefault();
    e.stopPropagation();
    if (await confirmDialog(text, { ok: 'Leave', cancel: 'Stay' })) location.hash = to;
  }
  function onUnload(e) { if (dirty()) { e.preventDefault(); e.returnValue = ''; } }
  function onRoute() { if (!here()) stop(); }
  function stop() {
    document.removeEventListener('click', onClick, true);
    removeEventListener('beforeunload', onUnload);
    removeEventListener('hashchange', onRoute);
  }
  document.addEventListener('click', onClick, true);
  addEventListener('beforeunload', onUnload);
  addEventListener('hashchange', onRoute);
  return stop;
}

// ---- Applications badge (Task 13) ----

// Count of New applications on the Menu button and the Applications menu item (0 / unknown hides it).
export function setAppsBadge(n) {
  const count = Number.isInteger(n) && n > 0 ? n : 0;
  document.querySelectorAll('[data-badge="applications"]').forEach((el) => {
    el.hidden = !count;
    el.replaceChildren(count ? String(count) : '', count ? h('span', { class: 'vh' }, ' new') : '');
  });
}

// Fetches the count quietly; any failure (offline, no access) just hides the badge.
export async function refreshAppsBadge(api) {
  try {
    const r = await api.get('/admin/applications?view=current');
    setAppsBadge(r && r.newCount);
  } catch { setAppsBadge(0); }
}

// Answer buttons for a reminder opened from a notification (#jobs/<id>?remind=hiring:<key>, etc.).
// The server records the first answer only; a later tap shows "Dr. Walls answered: Still hiring".
// done(answer) after the answer is recorded (the screen reloads what changed). Returns the section.
const REMIND_DONE = {
  still: 'The job stays on the website.',
  takedown: 'The job is off the website within a minute.',
  end: 'The banner has ended. It comes off the website within a minute.',
  keep: 'The banner stays up. Remember to end it when you reopen.',
  ok: '',
};
export function reminderPanel({ api, kind, key, question, hint = '', done }) {
  const box = h('div', { 'aria-live': 'polite' });
  const choices = REMIND_CHOICES[kind] || [];
  const buttons = choices.map((c, i) => h('button', { type: 'button', class: i === 0 ? 'btn' : 'btn ghost', 'data-answer': c.answer }, c.label));
  const panel = h('section', { class: 'remind-card', 'aria-label': 'Reminder' },
    h('p', { class: 'question' }, question),
    hint ? h('p', { class: 'soft' }, hint) : null,
    h('div', { class: 'row' }, buttons),
    box);
  let busy = false;
  buttons.forEach((b) => b.addEventListener('click', async () => {
    if (busy) return;
    busy = true;
    buttons.forEach((x) => { x.disabled = true; });
    box.replaceChildren(h('p', { class: 'checking' }, 'Saving…'));
    const sent = b.dataset.answer;
    try {
      const res = await api.post(remindAnswerPath(kind, key), { answer: sent });
      const out = remindOutcome(sent, res);
      const label = remindLabel(kind, out.answer);
      const dn = api.displayName || ((e) => e || 'Someone else');
      panel.replaceChildren(
        h('p', { class: 'result-title' }, out.already ? answeredText(out.by, label, dn) : out.answer === 'ok' ? 'Got it.' : `Recorded: ${label}.`),
        h('p', { class: 'soft' }, out.already ? 'Nothing else was changed.' : REMIND_DONE[out.answer] || ''));
      panel.classList.add('answered');
      if (done) await done(out);
    } catch (err) {
      busy = false;
      buttons.forEach((x) => { x.disabled = false; });
      box.replaceChildren(...saveErrorNodes(err));
    }
  }));
  return panel;
}
