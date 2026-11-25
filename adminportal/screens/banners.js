// Banners: Live now / Scheduled / Ended lists; editor in a side (bottom) sheet.
// Routes: #banners, #banners/new, #banners/<id> (the sheet's hash, so a sign-in round trip reopens it).
// #banners/new?type=&message=&endsAt= opens New prefilled (from the holiday question).
// #banners/<id>?remind=weather:<key> | bannerEnd:<key> (reminders): End it / Keep it up, or OK, above the lists.
import {
  groupBanners, emptyBannerForm, bannerToForm, formToBanner, endNowItem, bannerSpanText, newId,
  BANNER_MAX, BANNER_TYPES, bannerEnds, cleanHours, bannerPrefill, remindFor, remindKind,
} from '../model.js';
import { timeOptions, formatTime, utcToCentral, centralToUtc, formatWhen, nextQuarter, todayCentral } from '../time.js';
import * as drafts from '../drafts.js';
import { canEditWeather } from '../roles.js';

const TYPE_LABEL = Object.fromEntries(BANNER_TYPES.map((t) => [t.id, t.label]));
const NOTICE_CLASS = { weather: 'weather', holiday: 'holiday', notice: 'notice-info' };

// The patient site's banner strip (same classes/colors as index.html's .notice).
export function bannerStrip(h, type, message) {
  if (!String(message || '').trim()) return h('p', { class: 'preview-empty' }, 'Type a message to see the banner.');
  return h('div', { class: `site-notice ${NOTICE_CLASS[type] || 'notice-info'}` },
    h('div', { class: 'wrap' }, h('span', {}, String(message).trim()), h('span', { class: 'x', 'aria-hidden': 'true' }, '×')));
}

export async function render(root, ctx) {
  const { ui, api, route, role } = ctx;
  const weatherOk = canEditWeather(role);   // weather banners: owner/doctor only (the server enforces it too)
  const { h } = ui;
  let state = null;
  let current = null; // the open editor: { close() }
  let remind = null; // reminder answer panel (kept across repaints)

  root.replaceChildren(h('p', { class: 'soft' }, 'Loading…'));

  async function load() {
    state = await api.get('/admin/state');
    paint();
  }
  const find = (id) => (state.banners || []).find((b) => b.id === id) || null;
  const path = (id) => `/admin/banners/${encodeURIComponent(id)}`;

  function row(b, g, action) {
    const pills = [];
    if (b.type === 'weather') pills.push(h('span', { class: 'pill weather' }, 'Weather'));
    if (g === 'live' && b.id !== groups.showing) pills.push(h('span', { class: 'pill hidden' }, 'Hidden by a newer banner'));
    return h('li', {},
      h('button', { type: 'button', class: 'row-main', onclick: () => openEditor(b) },
        h('span', { class: 'row-title clamp' }, b.message),
        h('span', { class: 'row-meta' }, `${TYPE_LABEL[b.type] || 'Notice'} · ${bannerSpanText(b)}`, pills)),
      action ? h('span', { class: 'row-side' }, action) : null);
  }

  let groups = { live: [], scheduled: [], ended: [], showing: null };
  function paint() {
    groups = groupBanners(state.banners || [], Date.now());
    const list = (items, g, empty, action) => (items.length
      ? h('ul', { class: 'list' }, items.map((b) => row(b, g, action && action(b))))
      : h('p', { class: 'empty' }, empty));
    root.replaceChildren(
      h('div', { class: 'screen-head' },
        h('h1', {}, 'Banners'),
        h('button', { type: 'button', class: 'btn', onclick: () => openEditor(null) }, 'New banner')),
      ...(remind ? [remind] : []),
      h('p', { class: 'soft screen-intro' }, 'One banner shows at a time across the top of the website. If two overlap, the newest start wins.'),
      weatherOk ? h('div', { class: 'quick-weather' },
        h('span', { class: 'soft' }, 'Closed for weather today?'),
        h('button', { type: 'button', class: 'btn ghost small', onclick: () => weatherDay('snow') }, '❄ Snow day'),
        h('button', { type: 'button', class: 'btn ghost small', onclick: () => weatherDay('ice') }, '🧊 Ice day')) : null,
      h('h2', { class: 'group' }, 'Live now'),
      list(groups.live, 'live', 'No banner is showing on the website.',
        (b) => h('button', { type: 'button', class: 'btn ghost small', onclick: () => endNow(b) }, 'End now')),
      h('h2', { class: 'group' }, 'Scheduled'),
      list(groups.scheduled, 'scheduled', 'Nothing scheduled.'),
      h('details', { class: 'fold' },
        h('summary', {}, h('h2', { class: 'group' }, `Ended (${groups.ended.length})`)),
        list(groups.ended, 'ended', 'No banners ended in the last 90 days.',
          (b) => h('button', { type: 'button', class: 'btn ghost small', onclick: () => openEditor(b, { duplicate: true }) }, 'Duplicate'))));
  }

  async function endNow(b) {
    if (!(await ui.confirmDialog('End this banner now? It comes off the website within a minute.', { ok: 'End now' }))) return;
    try {
      await api.put(path(b.id), { item: endNowItem(b, Date.now()), version: b.version ?? null });
      ui.toast('Banner ended.');
      await load();
    } catch (err) {
      if (err && err.name === 'StaleError') {
        if (await ui.confirmDialog(err.message, { ok: 'Reload' })) await load();
        return;
      }
      const nodes = ui.saveErrorNodes(err);
      if (nodes.length) ui.toast(nodes[0].textContent);
    }
  }

  async function remove(b) {
    if (!(await ui.confirmDialog('Remove this banner? You can restore it from the change log for 30 days.', { ok: 'Remove', danger: true }))) return false;
    try {
      await api.del(path(b.id));
      ui.toast('Banner removed.');
      return true;
    } catch (err) {
      const nodes = ui.saveErrorNodes(err);
      if (nodes.length) ui.toast(nodes[0].textContent);
      return false;
    }
  }

  // One tap: a Weather banner (snow or ice characters on the website) ending at 11:59 PM today. Opens the editor
  // filled in, so the message and end time can still be changed before posting.
  function weatherDay(kind) {
    const words = kind === 'ice' ? 'icy roads' : 'snow';
    openEditor(null, { values: { ...emptyBannerForm(), type: 'weather', weather: kind,
      message: `We're closed today because of ${words}. Stay safe!`, end: 'at', endDate: todayCentral(), endTime: '23:59' } });
  }

  // b: banner to edit, or null for new. opts: {duplicate, values, kept}
  function openEditor(b, opts = {}) {
    if (current) current.close();
    let sheet = null;
    const isNew = !b || opts.duplicate;
    const original = isNew ? null : b;
    const id = isNew ? newId() : b.id;
    const key = `#banners/${isNew ? 'new' : b.id}`;
    const now = Date.now();
    let values = opts.values || (b ? bannerToForm(b, { duplicate: !!opts.duplicate, now }) : emptyBannerForm());
    if (opts.duplicate || opts.values || opts.kept != null) drafts.clear(key); // start from these values, not an old draft

    const startTimes = timeOptions({ keep: values.startTime || null });
    const endTimes = timeOptions({ keep: values.endTime || null });
    const msg = h('textarea', { name: 'message', rows: '3', maxlength: '1000', id: 'bannerMsg' }, values.message);
    const count = h('p', { class: 'count', 'aria-live': 'polite' });
    const startAt = h('div', { class: 'pair' },
      h('input', { type: 'date', name: 'startDate', value: values.startDate, 'aria-label': 'Start date' }),
      ui.timeSelect('startTime', startTimes, values.startTime || '08:00', formatTime, { 'aria-label': 'Start time' }));
    const endAt = h('div', { class: 'pair' },
      h('input', { type: 'date', name: 'endDate', value: values.endDate, 'aria-label': 'End date' }),
      ui.timeSelect('endTime', endTimes, values.endTime || '17:00', formatTime, { 'aria-label': 'End time' }));
    const weatherHint = h('p', { class: 'hint' }, 'A weather banner also marks the office closed while it shows. The website adds "We plan to reopen …" with the next clinic day on its own.');
    const kindSeg = ui.seg('weather', [{ value: 'snow', label: 'Snow' }, { value: 'ice', label: 'Ice' }], values.weather || 'snow', { legend: 'Characters on the website' });
    const locked = !weatherOk && b && b.type === 'weather';   // staff editors can see a weather banner, not change it
    const lockNote = locked ? h('p', { class: 'hint' }, 'Only Dr. Gray or Dr. Walls can change or end a weather banner.') : null;
    const suggest = h('div'); // one-tap end times (holiday: end of last closing day / when we reopen; weather: end of today)
    let endTouched = !isNew || !!opts.values || values.end === 'at'; // until the user picks an end, a holiday banner defaults to end of the last closing day
    let stale = false; // after a 409, Save stays off until Reload
    const preview = h('div');
    const box = h('div', { 'aria-live': 'polite' });
    const checking = h('p', { class: 'checking' });
    const save = h('button', { type: 'submit', class: 'btn', disabled: true }, isNew ? 'Post banner' : 'Save');
    const cancel = h('button', { type: 'button', class: 'btn ghost' }, 'Cancel');
    const more = !isNew ? h('div', { class: 'more' },
      groups.live.some((x) => x.id === b.id) ? h('button', { type: 'button', class: 'btn ghost small', onclick: async () => { close(); await endNow(b); } }, 'End now') : null,
      h('button', { type: 'button', class: 'btn ghost small', onclick: () => { close(); openEditor(b, { duplicate: true }); } }, 'Duplicate'),
      h('button', { type: 'button', class: 'btn danger-ghost small', onclick: async () => { if (await remove(b)) { close(); await load(); } } }, 'Remove')) : null;

    const form = h('form', { class: 'sheet-form', novalidate: true },
      h('div', { class: 'sheet-body' },
        ui.previewFrame('banner', preview, { sticky: true }),
        opts.kept != null ? ui.keptText(opts.kept, () => { msg.value = opts.kept; changed(); }) : null,
        h('input', { type: 'text', name: 'v', value: values.v, hidden: true }),
        lockNote,
        ui.seg('type', BANNER_TYPES.filter((t) => weatherOk || t.id !== 'weather' || locked).map((t) => ({ value: t.id, label: t.label })), values.type, { legend: 'Type' }),
        weatherHint,
        kindSeg,
        h('div', { class: 'field' }, h('label', { for: 'bannerMsg' }, 'Message'), msg, count),
        ui.seg('start', [{ value: 'now', label: 'Now' }, { value: 'at', label: 'Pick a time' }], values.start, { legend: 'Starts' }),
        startAt,
        ui.seg('end', [{ value: 'until', label: 'Until I turn it off' }, { value: 'at', label: 'Pick a time' }], values.end, { legend: 'Ends' }),
        endAt,
        suggest,
        checking, box, more),
      h('footer', { class: 'sheet-foot' }, cancel, save));

    const draft = ui.formDraft(form, key);
    let dirty = draft.restored;
    let touched = !!(original || draft.restored || opts.duplicate || opts.values); // a blank new form shows no errors yet
    const read = () => ui.readForm(form);
    const version = () => { const v = read().v; return v === '' ? null : Number(v); };
    const build = () => formToBanner(read(), { id, now: Date.now(), original });

    function paintForm() {
      const v = read();
      startAt.hidden = v.start !== 'at';
      endAt.hidden = v.end !== 'at';
      weatherHint.hidden = v.type !== 'weather';
      kindSeg.hidden = v.type !== 'weather';
      if (locked) { save.hidden = true; if (more) more.hidden = true; }
      const n = v.message.trim().length;
      count.textContent = `${n} / ${BANNER_MAX}`;
      count.classList.toggle('over', n > BANNER_MAX);
      preview.replaceChildren(bannerStrip(h, v.type, v.message));
      paintEnds(v);
    }
    function setEnd(iso) {
      const c = utcToCentral(iso);
      const sel = form.elements.endTime;
      if (![...sel.options].some((o) => o.value === c.time)) {
        sel.replaceChildren(...timeOptions({ keep: c.time }).map((t) => h('option', { value: t }, formatTime(t))));
      }
      form.elements.end.value = 'at';
      form.elements.endDate.value = c.date;
      sel.value = c.time;
    }
    function endChoices(v) {
      const startMs = v.start === 'at' ? Date.parse(centralToUtc(v.startDate, v.startTime) || '') : Date.now();
      const e = bannerEnds({ type: v.type, hours: cleanHours(state.hours), closings: state.closings || [], now: Date.now(), start: Number.isFinite(startMs) ? startMs : null });
      const ok = (d) => d && (!Number.isFinite(startMs) || d.getTime() > startMs);
      return [
        ok(e.lastDay) && { key: 'lastDay', label: 'end of the last closing day', at: e.lastDay.toISOString() },
        ok(e.reopen) && { key: 'reopen', label: 'end when we reopen', at: e.reopen.toISOString() },
        ok(e.today) && { key: 'today', label: 'end of today', at: e.today.toISOString() },
      ].filter(Boolean);
    }
    function paintEnds(v) {
      const choices = endChoices(v);
      const chosen = v.end === 'at' ? centralToUtc(v.endDate, v.endTime) : null;
      const rows = choices.filter((c) => c.at !== chosen).map((c) => h('div', { class: 'suggest' },
        h('span', {}, `${chosen || v.end === 'until' ? 'Or' : 'Suggested'}: ${c.label} — ${formatWhen(c.at)}`),
        h('button', { type: 'button', class: 'btn ghost small', onclick: () => { endTouched = true; setEnd(c.at); changed(); } }, 'Use this')));
      suggest.replaceChildren(...rows);
    }
    // Holiday default (Dr. Gray): end of the last closing day, until the user picks an end.
    function applyDefaultEnd() {
      if (endTouched) return;
      const v = read();
      const last = v.type === 'holiday' && endChoices(v).find((c) => c.key === 'lastDay');
      if (last) setEnd(last.at);
      else form.elements.end.value = 'until';
    }
    const check = ui.liveCheck(() => {
      const { item, errors } = build();
      if (errors.length) return { errors, warnings: [] };
      return api.put(path(id), { item, version: version() }, { dryRun: true });
    }, (s) => {
      checking.textContent = s.pending ? 'Checking…' : '';
      save.disabled = stale || s.pending || s.errors.length > 0;
      if (stale) return; // keep the "changed this — reload?" notice on screen
      if (s.failed) box.replaceChildren(...ui.saveErrorNodes(s.failed));
      else box.replaceChildren(...ui.issues(touched ? s.errors : [], s.warnings));
    });
    function changed() { dirty = true; touched = true; paintForm(); check.schedule(); }

    // Picking a time fills sensible defaults once.
    form.addEventListener('change', (e) => {
      const v = read();
      if (e.target.name === 'start' && v.start === 'at' && !v.startDate) {
        const q = nextQuarter(Date.now()); // never in the past, even just before midnight
        form.elements.startDate.value = q.date;
        form.elements.startTime.value = q.time;
      }
      if (['end', 'endDate', 'endTime'].includes(e.target.name)) endTouched = true;
      if (e.target.name === 'end' && v.end === 'at' && !v.endDate) {
        form.elements.endDate.value = v.start === 'at' && v.startDate ? v.startDate : nextQuarter(Date.now()).date;
      }
      if (['type', 'start', 'startDate', 'startTime'].includes(e.target.name)) applyDefaultEnd();
    });
    form.addEventListener('input', changed);
    form.addEventListener('change', changed);
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const { item, errors } = build();
      if (errors.length) { box.replaceChildren(...ui.issues(errors)); return; }
      save.disabled = true;
      check.stop();
      checking.textContent = 'Saving…';
      try {
        const res = await api.put(path(id), { item, version: version() });
        close();
        const w = (res && res.warnings) || [];
        ui.toast(w.length ? `Saved. Note: ${w.join(' ')}` : 'Saved.', { ms: w.length ? 6000 : 3500 });
        await load();
      } catch (err) {
        checking.textContent = '';
        box.replaceChildren(...ui.saveErrorNodes(err, { onReload: () => reloadKeeping(read()) }));
        box.scrollIntoView?.({ block: 'nearest' });
        stale = !!err && err.name === 'StaleError';
        save.disabled = stale;
      }
    });

    async function reloadKeeping(typed) {
      close();
      await load();
      const fresh = isNew ? null : find(b.id);
      if (fresh) openEditor(fresh, { kept: typed.message });
      else openEditor(null, { values: { ...typed, v: '' }, kept: typed.message });
    }
    function close() { check.stop(); draft.clear(); draft.stop(); sheet.close(); setHash('#banners'); if (current === me) current = null; }
    const me = { close };
    current = me;
    cancel.addEventListener('click', () => sheet.request());

    sheet = ui.sheet({
      title: isNew ? (opts.duplicate ? 'Duplicate banner' : 'New banner') : 'Edit banner',
      content: form,
      onClose: async () => {
        if (dirty && !(await ui.confirmDialog('Discard your changes to this banner?', { ok: 'Discard', danger: true }))) return false;
        close(); // already closed here, so the sheet's own close is a no-op
        return true;
      },
      onDispose: () => check.stop(), // also on a route change
    });
    setHash(key);
    if (draft.restored) { box.before(h('p', { class: 'hint' }, 'We kept what you were typing.')); endTouched = true; }
    applyDefaultEnd();
    paintForm();
    check.now();
  }

  await load();
  const part = route.parts[0];
  if (part === 'new') {
    const values = bannerPrefill(route.query);
    openEditor(null, values ? { values } : {});
  }
  else if (part) {
    const b = find(part);
    const key = b ? remindFor(route.query, ['weather', 'bannerEnd'], b.id) : null;
    if (key) {
      const kind = remindKind(key);
      const msg = String(b.message || '').trim();
      const short = msg.length > 90 ? `${msg.slice(0, 90)}…` : msg;
      remind = ui.reminderPanel({ api, kind, key,
        question: kind === 'weather' ? 'Weather banner is still up — still closed?' : 'This banner ends tonight.',
        hint: `“${short}”${kind === 'bannerEnd' && b.endsAt ? ` · ends ${formatWhen(b.endsAt)}` : ''}`,
        done: (out) => (out.answer === 'end' ? load() : null) });
      paint();
    } else if (b) openEditor(b);
    else { setHash('#banners'); ui.toast('That banner was not found — it may have been removed.'); }
  }
}

function setHash(hash) {
  if (location.hash !== hash) history.replaceState(null, '', hash);
}
