// Hours: each weekday open/close or Closed. Tap a day -> centered popup (a quick time change).
// The website's hours line is made from these (server: rules.hours_line; shown here with the same rule).
import { DAYS, DAY_NAMES, cleanHours, dayChoice, dayText, hoursLine } from '../model.js';
import { timeOptions, formatTime } from '../time.js';
import * as drafts from '../drafts.js';

const KEY = '#hours';
const RANGE = { from: '06:00', to: '21:00' };

export async function render(root, ctx) {
  const { ui, api } = ctx;
  const { h } = ui;
  let base = null;     // saved hours
  let version = null;  // saved version (0 = never edited, seed)
  let working = null;  // what's on screen
  let workingV = null; // version the edits started from
  let kept = null;     // text kept after a stale reload
  let saveNodes = [];
  let stale = false; // after a 409, Save stays off until Reload (or Undo)

  root.replaceChildren(h('p', { class: 'soft' }, 'Loading…'));

  async function load({ keep = true } = {}) {
    const state = await api.get('/admin/state');
    base = cleanHours(state.hours);
    version = state.hours && state.hours.version != null ? state.hours.version : 0;
    const d = keep ? drafts.load(KEY) : null;
    if (d && d.hours) { working = cleanHours(d.hours); workingV = d.v; } else { working = cleanHours(base); workingV = version; }
  }

  const changed = () => JSON.stringify(working) !== JSON.stringify(base);
  const remember = () => { if (changed()) drafts.save(KEY, { hours: working, v: workingV }); else drafts.clear(KEY); };

  const box = h('div', { 'aria-live': 'polite' });
  const checking = h('p', { class: 'checking' });
  const save = h('button', { type: 'button', class: 'btn', disabled: true }, 'Save hours');
  const undo = h('button', { type: 'button', class: 'btn ghost' }, 'Undo changes');
  let checkState = { pending: true, errors: [], warnings: [] };

  const check = ui.liveCheck(
    () => api.put('/admin/hours/current', { item: working, version: workingV }, { dryRun: true }),
    (s) => { checkState = s; paintStatus(); });

  function paintStatus() {
    const s = checkState;
    checking.textContent = s.pending ? 'Checking…' : '';
    save.disabled = stale || !changed() || s.pending || s.errors.length > 0;
    undo.hidden = !changed();
    box.replaceChildren(...saveNodes, ...(s.failed ? ui.saveErrorNodes(s.failed) : ui.issues(s.errors, s.warnings)));
  }

  function paint() {
    root.replaceChildren(
      h('div', { class: 'screen-head' }, h('h1', {}, 'Hours')),
      h('p', { class: 'soft screen-intro' }, 'Tap a day to change it. The website’s hours line is made from these.'),
      kept ? ui.keptText(kept) : '',
      h('ul', { class: 'list' }, DAYS.map((d) => {
        const diff = JSON.stringify(working[d]) !== JSON.stringify(base[d]);
        return h('li', { class: diff ? 'day-row changed' : 'day-row' },
          h('button', { type: 'button', class: 'row-main', onclick: () => openDay(d), 'aria-label': `${DAY_NAMES[d]}: ${dayText(working[d])}. Change` },
            h('span', { class: 'row-title' }, DAY_NAMES[d]),
            h('span', { class: 'row-meta' }, dayText(working[d]))));
      })),
      ui.previewFrame('hours', h('div', { class: 'site-hours' }, h('strong', {}, hoursLine(working)), h('br'), '2222 N Main St, Miami, OK')),
      checking, box,
      h('div', { class: 'savebar' }, undo, save));
    paintStatus();
  }

  function edited() { if (!stale) saveNodes = []; remember(); paint(); check.schedule(); } // keep the reload notice while stale

  function openDay(d) {
    const cur = working[d];
    const open = ui.timeSelect('open', timeOptions({ ...RANGE, keep: cur && cur.open }), cur ? cur.open : '08:30', formatTime, { 'aria-label': 'Opens' });
    const close = ui.timeSelect('close', timeOptions({ ...RANGE, keep: cur && cur.close }), cur ? cur.close : '17:00', formatTime, { 'aria-label': 'Closes' });
    const times = h('div', { class: 'pair field' },
      h('div', {}, h('label', {}, 'Opens', open)),
      h('div', {}, h('label', {}, 'Closes', close)));
    const msg = h('div', { 'aria-live': 'polite' });
    const done = h('button', { type: 'submit', class: 'btn' }, 'Done');
    const cancel = h('button', { type: 'button', class: 'btn ghost' }, 'Cancel');
    const form = h('form', { class: 'sheet-form', novalidate: true },
      h('div', { class: 'sheet-body' },
        ui.seg('state', [{ value: 'open', label: 'Open' }, { value: 'closed', label: 'Closed' }], cur ? 'open' : 'closed'),
        times, msg),
      h('footer', { class: 'sheet-foot' }, cancel, done));
    const paintDay = () => {
      const v = ui.readForm(form);
      times.hidden = v.state === 'closed';
      const bad = v.state === 'open' && v.close <= v.open;
      done.disabled = bad;
      msg.replaceChildren(...ui.issues(bad ? ['Closing time must be after opening time'] : []));
    };
    form.addEventListener('change', paintDay);
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      working[d] = dayChoice(ui.readForm(form));
      sheet.close();
      edited();
    });
    cancel.addEventListener('click', () => sheet.close());
    const sheet = ui.sheet({ title: DAY_NAMES[d], content: form, kind: 'popup' });
    paintDay();
  }

  undo.addEventListener('click', () => { working = cleanHours(base); workingV = version; kept = null; saveNodes = []; stale = false; edited(); });
  save.addEventListener('click', async () => {
    save.disabled = true;
    check.stop();
    checking.textContent = 'Saving…';
    try {
      const res = await api.put('/admin/hours/current', { item: working, version: workingV });
      drafts.clear(KEY);
      kept = null;
      saveNodes = [];
      stale = false;
      const w = (res && res.warnings) || [];
      ui.toast(w.length ? `Hours saved. Note: ${w.join(' ')}` : 'Hours saved.', { ms: w.length ? 6000 : 3500 });
      await load({ keep: false });
      paint();
      check.now();
    } catch (err) {
      checking.textContent = '';
      stale = !!err && err.name === 'StaleError';
      saveNodes = ui.saveErrorNodes(err, { onReload: reloadKeeping });
      checkState = { pending: false, errors: [], warnings: [] };
      paintStatus();
    }
  });

  async function reloadKeeping() {
    stale = false;
    kept = 'Your unsaved hours: ' + DAYS.map((d) => `${DAY_NAMES[d].slice(0, 3)} ${dayText(working[d])}`).join(' · ');
    saveNodes = [];
    drafts.clear(KEY);
    await load({ keep: false });
    paint();
    check.now();
  }

  await load();
  paint();
  check.now();
}
