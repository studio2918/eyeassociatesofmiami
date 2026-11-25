// Insurance: intro line, plan groups (in website order) and the explainer boxes.
// Tap a part -> side/bottom sheet with a live preview; edits collect on this screen and the whole
// insurance object saves as ONE PUT (version from state). Unsaved edits are kept as a draft.
import { cleanInsurance, formToInsurance, sameInsurance, moveItem, boxBlocks, inlineParts } from '../model.js';
import * as drafts from '../drafts.js';

const KEY = '#insurance';
const PATH = '/admin/insurance/current';
const clone = (x) => JSON.parse(JSON.stringify(x));
// index.html's built-in intro: the website keeps it when the saved intro is empty.
const SITE_INTRO = 'Plans change, so call us with your card handy. We do our best to verify your coverage before your visit.';

// ---- the website's insurance markup (same as index.html showInsurance), from an editable copy ----

function groupNode(h, g) {
  const name = g.name.trim();
  if (!name) return null; // the website skips a group with no name
  const hint = g.hint.trim();
  const note = g.note.trim();
  return h('div', { class: 'grp' },
    h('h3', {}, name, hint ? ' ' : null, hint ? h('span', { class: 'hint' }, hint) : null),
    h('ul', {}, g.plans.map((p) => p.trim()).filter(Boolean).map((p) => h('li', {}, p))),
    note ? h('p', { class: 'fine' }, note) : null);
}

const inline = (h, parts) => parts.map((p) => (p.bold ? h('b', {}, p.text) : p.text));

function boxNode(h, b) {
  const title = b.title.trim();
  const blocks = boxBlocks(b.text);
  if (!title && !blocks.length) return null;
  return h('div', { class: b.style === 'why' ? 'ins-note why' : 'ins-note' },
    title ? h('h3', {}, title) : null,
    blocks.map((x) => (x.type === 'ul'
      ? h('ul', {}, x.items.map((it) => h('li', {}, inline(h, it))))
      : h('p', {}, inline(h, x.parts)))));
}

// part: undefined = whole section; {group: i} | {box: i} | {intro: true} = just that piece.
export function insurancePreview(h, ins, part = {}) {
  const w = cleanInsurance(ins);
  if (part.group != null) return h('div', { class: 'site-ins' }, groupNode(h, w.groups[part.group]) || h('p', { class: 'preview-empty' }, 'Type a group name to see it.'));
  if (part.box != null) return h('div', { class: 'site-ins' }, boxNode(h, w.boxes[part.box]) || h('p', { class: 'preview-empty' }, 'Type a title or text to see the box.'));
  const head = [h('h2', {}, 'Insurance'), h('p', { class: 'sub' }, inline(h, inlineParts(w.intro.trim() || SITE_INTRO)))];
  if (part.intro) return h('div', { class: 'site-ins' }, head);
  return h('div', { class: 'site-ins' }, head, w.groups.map((g) => groupNode(h, g)), w.boxes.map((b) => boxNode(h, b)));
}

// Plain-text copy of the edits, shown after a stale reload so nothing typed is lost.
function asText(w) {
  const out = [];
  if (w.intro.trim()) out.push(w.intro.trim(), '');
  for (const g of w.groups) {
    out.push(`${g.name.trim()}${g.hint.trim() ? ` (${g.hint.trim()})` : ''}: ${g.plans.map((p) => p.trim()).filter(Boolean).join(', ')}`);
    if (g.note.trim()) out.push(`  Note: ${g.note.trim()}`);
  }
  for (const b of w.boxes) out.push('', b.title.trim(), b.text.trim());
  return out.join('\n').trim();
}

export async function render(root, ctx) {
  const { ui, api } = ctx;
  const { h } = ui;
  let base = null;     // saved insurance (editable shape)
  let version = 0;     // saved version (0 = seed, never edited)
  let working = null;  // what's on screen
  let workingV = 0;    // version the edits started from
  let restored = false;
  let kept = null;     // { text, mine, v } after a stale reload
  let saveNodes = [];
  let stale = false;   // after a 409, Save stays off until Reload (or Undo)
  let focusKey = null; // re-focus this control after a repaint (reorder buttons)

  root.replaceChildren(h('p', { class: 'soft' }, 'Loading…'));

  async function load({ keep = true } = {}) {
    const state = await api.get('/admin/state');
    base = cleanInsurance(state.insurance);
    version = state.insurance && state.insurance.version != null ? state.insurance.version : 0;
    const d = keep ? drafts.load(KEY) : null;
    if (d && d.ins) { working = cleanInsurance(d.ins); workingV = d.v; restored = !sameInsurance(working, base); } else { working = clone(base); workingV = version; restored = false; }
  }

  const changed = () => !sameInsurance(working, base) || workingV !== version;
  const remember = () => { if (!sameInsurance(working, base)) drafts.save(KEY, { ins: working, v: workingV }); else drafts.clear(KEY); };
  ui.leaveGuard('insurance', () => !sameInsurance(working, base),
    { text: 'You have unsaved insurance changes. Leave anyway? They stay saved on this device until you come back.' });

  const box = h('div', { 'aria-live': 'polite' });
  const checking = h('p', { class: 'checking' });
  const save = h('button', { type: 'button', class: 'btn', disabled: true }, 'Save insurance');
  const undo = h('button', { type: 'button', class: 'btn ghost' }, 'Undo changes');
  const bar = h('div', { class: 'savebar' }, undo, save);
  let checkState = { pending: false, errors: [], warnings: [] };

  const check = ui.liveCheck(() => {
    const { item, errors, warnings } = formToInsurance(working);
    if (errors.length) return { errors, warnings };
    return Promise.resolve(api.put(PATH, { item, version: workingV }, { dryRun: true }))
      .then((r) => ({ errors: (r && r.errors) || [], warnings: [...warnings, ...((r && r.warnings) || [])] }));
  }, (s) => { checkState = s; paintStatus(); });

  function paintStatus() {
    const s = checkState;
    const dirty = !sameInsurance(working, base);
    checking.textContent = dirty && s.pending ? 'Checking…' : '';
    save.disabled = stale || !dirty || s.pending || s.errors.length > 0;
    undo.hidden = !dirty;
    bar.classList.toggle('sticky', dirty);
    const issues = !dirty ? [] : s.failed ? ui.saveErrorNodes(s.failed) : ui.issues(s.errors, s.warnings);
    box.replaceChildren(...saveNodes, ...issues);
  }

  const moves = (label, i, n, onMove, k) => h('span', { class: 'row-side moves' },
    h('button', { type: 'button', class: 'icon-btn', 'data-k': `${k}-up-${i}`, disabled: i === 0, 'aria-label': `Move ${label} up`, onclick: () => onMove(i, -1) }, '↑'),
    h('button', { type: 'button', class: 'icon-btn', 'data-k': `${k}-down-${i}`, disabled: i === n - 1, 'aria-label': `Move ${label} down`, onclick: () => onMove(i, 1) }, '↓'));

  function moveGroup(i, dir) {
    const j = i + dir;
    working.groups = moveItem(working.groups, i, dir);
    focusKey = [`g-${dir < 0 ? 'up' : 'down'}-${j}`, `g-${dir < 0 ? 'down' : 'up'}-${j}`];
    edited();
  }

  function paint() {
    const w = working;
    const n = w.groups.length;
    root.replaceChildren(
      h('div', { class: 'screen-head' }, h('h1', {}, 'Insurance')),
      h('p', { class: 'soft screen-intro' }, 'Tap a part to change it. Nothing changes on the website until you tap Save insurance.'),
      restored ? h('p', { class: 'hint' }, 'We kept your unsaved changes from before. Save them, or tap Undo changes.') : '',
      kept ? ui.keptText(kept.text, useMine) : '',
      h('h2', { class: 'group' }, 'Intro line'),
      h('ul', { class: 'list' }, h('li', {},
        h('button', { type: 'button', class: 'row-main', onclick: () => openIntro() },
          h('span', { class: 'row-title clamp' }, w.intro.trim() || 'Empty — the website shows its built-in intro'),
          h('span', { class: 'row-meta' }, 'Shows under the “Insurance” heading')))),
      h('h2', { class: 'group' }, 'Plan groups'),
      h('p', { class: 'hint screen-intro' }, 'In the order they show on the website. Use ↑ ↓ to move a group.'),
      n ? h('ul', { class: 'list' }, w.groups.map((g, i) => {
        const plans = g.plans.filter((p) => p.trim()).length;
        const name = g.name.trim() || `Group ${i + 1}`;
        return h('li', {},
          h('button', { type: 'button', class: 'row-main', onclick: () => openGroup(i) },
            h('span', { class: 'row-title' }, name),
            h('span', { class: 'row-meta' }, [g.hint.trim(), `${plans} plan${plans === 1 ? '' : 's'}`, g.note.trim() ? 'has a note' : ''].filter(Boolean).join(' · '))),
          moves(name, i, n, moveGroup, 'g'));
      })) : h('p', { class: 'empty' }, 'No groups yet.'),
      h('div', { class: 'add-row' }, h('button', { type: 'button', class: 'btn ghost', onclick: () => openGroup(null) }, 'Add a group')),
      h('h2', { class: 'group' }, 'Explainer boxes'),
      w.boxes.length ? h('ul', { class: 'list' }, w.boxes.map((b, i) => h('li', {},
        h('button', { type: 'button', class: 'row-main', onclick: () => openBox(i) },
          h('span', { class: 'row-title' }, b.title.trim() || `Box ${i + 1}`),
          h('span', { class: 'row-meta' }, (b.text.trim().split('\n')[0] || '').replace(/\*\*/g, '')))))) : h('p', { class: 'empty' }, 'No boxes.'),
      ui.previewFrame('insurance', insurancePreview(h, w)),
      checking, box, bar);
    paintStatus();
    if (focusKey) {
      const el = focusKey.map((k) => root.querySelector(`[data-k="${k}"]`)).find((x) => x && !x.disabled);
      if (el) el.focus();
      focusKey = null;
    }
  }

  function edited() { if (!stale) saveNodes = []; restored = restored && !sameInsurance(working, base); remember(); paint(); check.schedule(); }

  // One part in a sheet. get/set read and write that part of `working`; body(part, changed) builds the fields
  // around a mutable copy. Cancel puts the part back as it was; Done keeps it (validate() may block).
  function partSheet({ title, get, set, body, preview, validate, isNew = false, onRemove = null, onDiscardNew = null }) {
    const before = clone(get());
    const part = clone(before);
    const previewBox = h('div');
    const msg = h('div', { 'aria-live': 'polite' });
    const done = h('button', { type: 'submit', class: 'btn' }, 'Done');
    const cancel = h('button', { type: 'button', class: 'btn ghost' }, 'Cancel');
    const paintPreview = () => previewBox.replaceChildren(preview());
    const changedPart = () => { set(clone(part)); remember(); paintPreview(); if (msg.firstChild) msg.replaceChildren(); };
    const fields = body(part, changedPart);
    const form = h('form', { class: 'sheet-form', novalidate: true },
      h('div', { class: 'sheet-body' },
        ui.previewFrame('insurance', previewBox, { sticky: true }),
        fields, msg,
        onRemove ? h('div', { class: 'more' }, h('button', { type: 'button', class: 'btn danger-ghost small', onclick: async () => { if (await onRemove()) { sheet.close(); edited(); } } }, 'Remove group')) : null),
      h('footer', { class: 'sheet-foot' }, cancel, done));
    const isSame = () => JSON.stringify(get()) === JSON.stringify(before);
    function putBack() { if (isNew && onDiscardNew) onDiscardNew(); else set(clone(before)); remember(); }
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const errors = validate ? validate(get()) : [];
      if (errors.length) { msg.replaceChildren(...ui.issues(errors)); return; }
      sheet.close();
      edited();
    });
    cancel.addEventListener('click', () => sheet.request());
    const sheet = ui.sheet({
      title,
      content: form,
      onClose: async () => {
        if (!isNew && isSame()) return true;
        if (!(isNew && isSame()) && !(await ui.confirmDialog('Discard your changes to this part?', { ok: 'Discard', danger: true }))) return false;
        putBack();
        paint();
        check.schedule();
        return true;
      },
    });
    paintPreview();
    return sheet;
  }

  const field = (label, id, input, hint) => h('div', { class: 'field' }, h('label', { for: id }, label), input, hint ? h('p', { class: 'hint' }, hint) : null);

  function openIntro() {
    partSheet({
      title: 'Intro line',
      get: () => ({ intro: working.intro }),
      set: (v) => { working.intro = v.intro; },
      preview: () => insurancePreview(h, working, { intro: true }),
      body: (part, changed) => {
        const ta = h('textarea', { id: 'insIntro', rows: '3', maxlength: '600' }, part.intro);
        ta.addEventListener('input', () => { part.intro = ta.value; changed(); });
        return field('Intro line', 'insIntro', ta, 'One or two sentences under the heading. Put **two stars** around words to make them bold.');
      },
    });
  }

  function openGroup(i) {
    const isNew = i == null;
    if (isNew) { working.groups.push({ name: '', hint: '', note: '', plans: [''] }); i = working.groups.length - 1; }
    const at = i;
    partSheet({
      title: isNew ? 'New group' : 'Edit group',
      isNew,
      get: () => working.groups[at],
      set: (g) => { working.groups[at] = g; },
      preview: () => insurancePreview(h, working, { group: at }),
      validate: (g) => {
        const errs = [];
        if (!g.name.trim()) errs.push('Write the group name');
        return errs;
      },
      onDiscardNew: () => { working.groups.splice(at, 1); },
      onRemove: isNew ? null : async () => {
        const g = working.groups[at];
        const n = g.plans.filter((p) => p.trim()).length;
        if (!(await ui.confirmDialog(`Remove the “${g.name.trim() || 'unnamed'}” group and its ${n} plan${n === 1 ? '' : 's'}? It comes off the website when you tap Save insurance.`, { ok: 'Remove', danger: true }))) return false;
        working.groups.splice(at, 1);
        return true;
      },
      body: (g, changed) => {
        const name = h('input', { type: 'text', id: 'grpName', value: g.name, maxlength: '80', autocomplete: 'off' });
        const hint = h('input', { type: 'text', id: 'grpHint', value: g.hint, maxlength: '120', autocomplete: 'off' });
        const note = h('textarea', { id: 'grpNote', rows: '3', maxlength: '600' }, g.note);
        name.addEventListener('input', () => { g.name = name.value; changed(); });
        hint.addEventListener('input', () => { g.hint = hint.value; changed(); });
        note.addEventListener('input', () => { g.note = note.value; changed(); });
        const rows = h('ul', { class: 'plan-rows' });
        const label = (k) => g.plans[k].trim() || `plan ${k + 1}`;
        function paintPlans(focus) {
          const n = g.plans.length;
          rows.replaceChildren(...g.plans.map((p, k) => {
            const input = h('input', { type: 'text', value: p, maxlength: '120', autocomplete: 'off', 'aria-label': `Plan ${k + 1}`, 'data-k': `p-${k}` });
            input.addEventListener('input', () => { g.plans[k] = input.value; changed(); });
            input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); addPlan(k + 1); } });
            return h('li', { class: 'plan-row' }, input,
              h('button', { type: 'button', class: 'icon-btn', 'data-k': `p-up-${k}`, disabled: k === 0, 'aria-label': `Move ${label(k)} up`, onclick: () => movePlan(k, -1) }, '↑'),
              h('button', { type: 'button', class: 'icon-btn', 'data-k': `p-down-${k}`, disabled: k === n - 1, 'aria-label': `Move ${label(k)} down`, onclick: () => movePlan(k, 1) }, '↓'),
              h('button', { type: 'button', class: 'icon-btn danger', 'data-k': `p-x-${k}`, 'aria-label': `Remove ${label(k)}`, onclick: () => removePlan(k) }, '×'));
          }));
          if (focus) { const el = focus.map((k) => rows.querySelector(`[data-k="${k}"]`)).find((x) => x && !x.disabled); if (el) el.focus(); }
        }
        function movePlan(k, dir) {
          g.plans = moveItem(g.plans, k, dir);
          const j = k + dir;
          paintPlans([`p-${dir < 0 ? 'up' : 'down'}-${j}`, `p-${dir < 0 ? 'down' : 'up'}-${j}`]);
          changed();
        }
        function removePlan(k) {
          g.plans.splice(k, 1);
          paintPlans([`p-x-${Math.min(k, g.plans.length - 1)}`]);
          if (!g.plans.length) addBtn.focus();
          changed();
        }
        function addPlan(at = g.plans.length) {
          g.plans.splice(at, 0, '');
          paintPlans([`p-${at}`]);
          changed();
        }
        const addBtn = h('button', { type: 'button', class: 'btn ghost small', onclick: () => addPlan() }, 'Add a plan');
        paintPlans();
        return [
          field('Group name', 'grpName', name),
          field('Small line next to the name (optional)', 'grpHint', hint, 'For example: “through work or bought on your own”.'),
          h('fieldset', { class: 'field' }, h('legend', {}, 'Plans'),
            h('p', { class: 'hint', style: 'margin:0 0 8px' }, 'In website order. Blank plans are left out.'),
            rows, addBtn),
          field('Note under the plans (optional)', 'grpNote', note),
        ];
      },
    });
    if (isNew) setTimeout(() => document.getElementById('grpName')?.focus(), 0);
  }

  function openBox(i) {
    partSheet({
      title: 'Edit box',
      get: () => working.boxes[i],
      set: (b) => { working.boxes[i] = b; },
      preview: () => insurancePreview(h, working, { box: i }),
      body: (b, changed) => {
        const title = h('input', { type: 'text', id: 'boxTitle', value: b.title, maxlength: '120', autocomplete: 'off' });
        const text = h('textarea', { id: 'boxText', rows: '8', maxlength: '2000' }, b.text);
        title.addEventListener('input', () => { b.title = title.value; changed(); });
        text.addEventListener('input', () => { b.text = text.value; changed(); });
        return [
          field('Title', 'boxTitle', title),
          field('Text', 'boxText', text, 'Each line is its own paragraph. Start a line with “- ” (dash, space) for a bullet. Put **two stars** around words to make them bold.'),
        ];
      },
    });
  }

  // After a stale reload: put my edits back on top of the newer version (replaces the other person's changes).
  async function useMine() {
    if (!kept) return;
    if (!(await ui.confirmDialog('Put your changes back? This replaces the newer version when you save.', { ok: 'Use my changes' }))) return;
    working = clone(kept.mine);
    workingV = version;
    kept = null;
    edited();
  }

  undo.addEventListener('click', () => { working = clone(base); workingV = version; kept = null; saveNodes = []; stale = false; restored = false; edited(); });
  save.addEventListener('click', async () => {
    const { item, errors } = formToInsurance(working);
    if (errors.length) { box.replaceChildren(...ui.issues(errors)); return; }
    save.disabled = true;
    check.stop();
    checking.textContent = 'Saving…';
    try {
      const res = await api.put(PATH, { item, version: workingV });
      drafts.clear(KEY);
      kept = null;
      saveNodes = [];
      stale = false;
      const w = (res && res.warnings) || [];
      ui.toast(w.length ? `Insurance saved. Note: ${w.join(' ')}` : 'Insurance saved. The website updates within a minute.', { ms: w.length ? 6000 : 3500 });
      // Clean from the PUT's own answer, so a failed refetch can't show a false error or keep a stale base.
      const saved = res && res.item;
      base = cleanInsurance(saved || item);
      version = saved && saved.version != null ? saved.version : workingV + 1;
      working = clone(base);
      workingV = version;
      restored = false;
      checkState = { pending: false, errors: [], warnings: [] };
      paint();
      try { await load({ keep: false }); paint(); } catch { /* keep the saved copy; the next Save still has the right version */ }
    } catch (err) {
      checking.textContent = '';
      stale = !!err && err.name === 'StaleError';
      saveNodes = ui.saveErrorNodes(err, { onReload: reloadKeeping });
      checkState = { pending: false, errors: [], warnings: [] };
      paintStatus();
    }
  });

  async function reloadKeeping() {
    const mine = clone(working);
    stale = false;
    saveNodes = [];
    drafts.clear(KEY);
    await load({ keep: false });
    kept = { text: asText(mine), mine };
    checkState = { pending: false, errors: [], warnings: [] };
    paint();
  }

  await load();
  paint();
  if (changed()) check.now();
}
