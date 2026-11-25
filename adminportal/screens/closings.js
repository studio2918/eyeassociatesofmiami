// Closings: upcoming list (past folded). Add one date or a range in a sheet: one row per day
// (Closed all day | Opens late at … | Closes early at …, or both), a public reason, a private note
// and an optional banner — all in ONE save (PUT /admin/closings, all-or-nothing).
// Change or remove a single closing in a centered popup. Deep links: #closings/new?date=YYYY-MM-DD,
// #closings/YYYY-MM-DD (opens that day's closing).
import {
  closingDates, closingBannerMessage, formToClosings, groupClosings, closingLabel, BANNER_MAX,
  suggestBannerEnd, cleanHours, dayRows, rowDefaults, endOfLastDay, REASON_MAX, DEFAULT_LATE, DEFAULT_EARLY,
} from '../model.js';
import { todayCentral, timeOptions, formatTime, formatDate, formatWhen, weekdayOf } from '../time.js';
import * as drafts from '../drafts.js';
import { canEditWeather } from '../roles.js';
import { bannerStrip } from './banners.js';

const KEY = '#closings/new';
const toMin = (t) => { const [a, b] = t.split(':').map(Number); return a * 60 + b; };
const toHm = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

// Times strictly inside the normal day, 15-minute steps (server rule). keep = a saved value.
function insideDay(normal, keep) {
  if (!normal) return timeOptions({ from: '06:00', to: '21:00', keep });
  return timeOptions({ from: toHm(toMin(normal.open) + 15), to: toHm(toMin(normal.close) - 15), keep });
}
const pick = (list, want) => (list.includes(want) ? want : list[Math.floor(list.length / 2)]);

export async function render(root, ctx) {
  const { ui, api, route, role } = ctx;
  const weatherOk = canEditWeather(role);   // weather banners: owner/doctor only
  const { h } = ui;
  let state = null;
  let current = null;

  root.replaceChildren(h('p', { class: 'soft' }, 'Loading…'));

  async function load() {
    state = await api.get('/admin/state');
    paint();
  }
  const hours = () => cleanHours(state.hours);

  function paint() {
    const g = groupClosings(state.closings || [], todayCentral());
    const row = (c, past) => h('li', {},
      h('button', { type: 'button', class: 'row-main', disabled: past, onclick: past ? null : () => openDay(c) },
        h('span', { class: 'row-title' }, formatDate(c.date)),
        h('span', { class: 'row-meta' }, closingLabel(c), c.reason ? ` · ${c.reason}` : '', c.note ? ` · Note: ${c.note}` : '')));
    root.replaceChildren(
      h('div', { class: 'screen-head' },
        h('h1', {}, 'Closings'),
        h('button', { type: 'button', class: 'btn', onclick: () => openAdd() }, 'Add closing')),
      h('p', { class: 'soft screen-intro' }, 'Days the office is closed, opens late or closes early. These show on the website under Coming up, and as a banner during the 2 weeks before.'),
      h('h2', { class: 'group' }, 'Upcoming'),
      g.upcoming.length ? h('ul', { class: 'list' }, g.upcoming.map((c) => row(c, false))) : h('p', { class: 'empty' }, 'No closings coming up.'),
      g.past.length ? h('details', { class: 'fold' },
        h('summary', {}, h('h2', { class: 'group' }, `Past (${g.past.length})`)),
        h('ul', { class: 'list' }, g.past.map((c) => row(c, true)))) : '');
  }

  // Controls for one day: Closed all day | Change hours (Opens late at / Closes early at).
  // Normally-closed days are greyed and skipped unless chosen.
  function dayControls(date, normal, v) {
    const n = (k) => `${k}_${date}`;
    const opens = insideDay(normal, v[n('openAt')]);
    const closes = insideDay(normal, v[n('closeAt')]);
    const times = h('div', { class: 'day-times' },
      h('label', { class: 'check' }, h('input', { type: 'checkbox', name: n('late'), value: 'on', checked: (v[n('late')] || []).includes('on') }), 'Opens late at'),
      ui.timeSelect(n('openAt'), opens, pick(opens, v[n('openAt')] || DEFAULT_LATE), formatTime, { 'aria-label': `${formatDate(date)} opens at` }),
      h('label', { class: 'check' }, h('input', { type: 'checkbox', name: n('early'), value: 'on', checked: (v[n('early')] || []).includes('on') }), 'Closes early at'),
      ui.timeSelect(n('closeAt'), closes, pick(closes, v[n('closeAt')] || DEFAULT_EARLY), formatTime, { 'aria-label': `${formatDate(date)} closes at` }));
    const options = normal
      ? [{ value: 'allDay', label: 'Closed all day' }, { value: 'hours', label: 'Change hours' }]
      : [{ value: 'skip', label: 'Skip' }, { value: 'allDay', label: 'Closed all day' }];
    const mode = v[n('mode')] || (normal ? 'allDay' : 'skip');
    const el = h('div', { class: `day-edit${normal ? '' : ' normally-closed'}`, 'data-date': date },
      h('div', { class: 'day-head' }, h('strong', {}, formatDate(date)),
        h('span', { class: 'soft' }, normal ? `Normally ${formatTime(normal.open)} – ${formatTime(normal.close)}` : 'Normally closed')),
      ui.seg(n('mode'), options, mode),
      normal ? times : null);
    el.paint = () => { times.hidden = el.querySelector(`input[name="${n('mode')}"]:checked`)?.value !== 'hours'; };
    return el;
  }

  // ---- change / remove one closing (centered popup) ----
  function openDay(c) {
    if (current) current.close();
    const path = `/admin/closings/${encodeURIComponent(c.date)}`;
    const normal = hours()[weekdayOf(c.date)];
    const v = {
      [`mode_${c.date}`]: c.allDay ? 'allDay' : 'hours',
      [`late_${c.date}`]: c.openAt ? ['on'] : [], [`openAt_${c.date}`]: c.openAt || DEFAULT_LATE,
      [`early_${c.date}`]: c.closeAt ? ['on'] : [], [`closeAt_${c.date}`]: c.closeAt || DEFAULT_EARLY,
    };
    const day = dayControls(c.date, normal, v);
    day.querySelector('.day-head').remove(); // the popup title already says the date
    const reason = h('input', { type: 'text', name: 'reason', maxlength: String(REASON_MAX), value: c.reason || '', id: 'dayReason', placeholder: 'e.g. Thanksgiving' });
    const box = h('div', { 'aria-live': 'polite' });
    const save = h('button', { type: 'submit', class: 'btn', disabled: true }, 'Save');
    const del = h('button', { type: 'button', class: 'btn danger-ghost' }, 'Remove');
    const cancel = h('button', { type: 'button', class: 'btn ghost' }, 'Cancel');
    const form = h('form', { class: 'sheet-form', novalidate: true },
      h('div', { class: 'sheet-body' }, day,
        h('div', { class: 'field' }, h('label', { for: 'dayReason' }, 'Reason (shown on website)'), reason),
        box),
      h('footer', { class: 'sheet-foot' }, del, cancel, save));
    let stale = false;
    const build = () => {
      const r = formToClosings({ ...ui.readForm(form), banner: [] }, [{ date: c.date, normal }], Date.now());
      if (r.errors.length) return { errors: r.errors };
      const it = { ...r.body.days[0] };
      if (!it.allDay) { it.openAt = it.openAt ?? null; it.closeAt = it.closeAt ?? null; }
      if (c.note) it.note = c.note;
      return { item: it };
    };
    const check = ui.liveCheck(() => {
      const b = build();
      return b.errors ? { errors: b.errors, warnings: [] } : api.put(path, { item: b.item, version: c.version ?? null }, { dryRun: true });
    }, (s) => {
      save.disabled = stale || s.pending || s.errors.length > 0;
      if (stale) return;
      box.replaceChildren(...(s.failed ? ui.saveErrorNodes(s.failed) : ui.issues(s.errors, s.warnings)));
    });
    const onEdit = () => { day.paint(); check.schedule(); };
    form.addEventListener('change', onEdit);
    form.addEventListener('input', onEdit);
    const reload = async () => { close(); await load(); const fresh = (state.closings || []).find((x) => x.date === c.date); if (fresh) openDay(fresh); };
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const b = build();
      if (b.errors) { box.replaceChildren(...ui.issues(b.errors)); return; }
      save.disabled = true;
      check.stop();
      try {
        await api.put(path, { item: b.item, version: c.version ?? null });
        close();
        ui.toast('Saved.');
        await load();
      } catch (err) {
        stale = !!err && err.name === 'StaleError';
        box.replaceChildren(...ui.saveErrorNodes(err, { onReload: reload }));
        save.disabled = stale;
      }
    });
    del.addEventListener('click', async () => {
      if (!(await ui.confirmDialog(`Remove the closing on ${formatDate(c.date)}? You can restore it from the change log for 30 days.`, { ok: 'Remove', danger: true }))) return;
      try {
        await api.del(path);
        close();
        ui.toast('Closing removed.');
        await load();
      } catch (err) {
        box.replaceChildren(...ui.saveErrorNodes(err, { onReload: reload }));
      }
    });
    cancel.addEventListener('click', () => close());
    const sheet = ui.sheet({ title: formatDate(c.date), content: form, kind: 'popup', onDispose: () => check.stop() });
    function close() { check.stop(); sheet.close(); if (current === me) current = null; }
    const me = { close };
    current = me;
    day.paint();
    check.now();
  }

  // ---- add closings (sheet): one row per day, optional banner, ONE save ----
  function openAdd({ date = null } = {}) {
    if (current) current.close();
    if (date) drafts.clear(KEY); // a reminder link starts fresh on its date
    const saved = drafts.load(KEY) || {};
    const today = todayCentral();
    const msg = h('textarea', { name: 'bannerMessage', rows: '3', maxlength: '1000', id: 'closingMsg' });
    const count = h('p', { class: 'count', 'aria-live': 'polite' });
    const one = h('div', { class: 'field' },
      h('label', { for: 'closingDate' }, 'Date'),
      h('input', { type: 'date', name: 'date', id: 'closingDate', min: today, value: date || saved.date || '' }));
    const range = h('div', { class: 'pair field' },
      h('div', {}, h('label', { for: 'closingFrom' }, 'First day'), h('input', { type: 'date', name: 'from', id: 'closingFrom', min: today, value: saved.from || '' })),
      h('div', {}, h('label', { for: 'closingTo' }, 'Last day'), h('input', { type: 'date', name: 'to', id: 'closingTo', min: today, value: saved.to || '' })));
    const daysBox = h('div', { class: 'days' });
    const reason = h('input', { type: 'text', name: 'reason', id: 'closingReason', maxlength: String(REASON_MAX), placeholder: 'e.g. Thanksgiving' });
    const reasonCount = h('p', { class: 'count' });
    const note = h('input', { type: 'text', name: 'note', id: 'closingNote', maxlength: '200' });
    const span = h('p', { class: 'hint' });
    const preview = h('div');
    const bannerKind = ui.seg('bannerWeather', [{ value: 'snow', label: 'Snow' }, { value: 'ice', label: 'Ice' }], 'snow', { legend: 'Characters on the website' });
    const bannerPart = h('div', { class: 'subform' },
      ui.previewFrame('banner', preview),
      weatherOk ? ui.seg('bannerType', [{ value: 'holiday', label: 'Holiday' }, { value: 'weather', label: 'Weather' }], 'holiday', { legend: 'Banner type' }) : null,
      bannerKind,
      h('div', { class: 'field' }, h('label', { for: 'closingMsg' }, 'Banner message'), msg, count),
      ui.seg('bannerEnd', [{ value: 'lastDay', label: 'End of last day' }, { value: 'reopen', label: 'When we reopen' }, { value: 'until', label: 'Until I turn it off' }], 'lastDay', { legend: 'Banner ends' }),
      span);
    const box = h('div', { 'aria-live': 'polite' });
    const checking = h('p', { class: 'checking' });
    const save = h('button', { type: 'submit', class: 'btn', disabled: true }, 'Save');
    const cancel = h('button', { type: 'button', class: 'btn ghost' }, 'Cancel');
    const form = h('form', { class: 'sheet-form', novalidate: true },
      h('div', { class: 'sheet-body' },
        ui.seg('mode', [{ value: 'one', label: 'One day' }, { value: 'range', label: 'Several days' }], saved.mode === 'range' && !date ? 'range' : 'one', { legend: 'When' }),
        one, range, daysBox,
        h('div', { class: 'field' }, h('label', { for: 'closingReason' }, 'Reason (shown on website)'), reason, reasonCount),
        h('div', { class: 'field' }, h('label', { for: 'closingNote' }, 'Private note (not shown on website)'), note),
        h('div', { class: 'field' },
          h('label', { class: 'check' }, h('input', { type: 'checkbox', name: 'banner', value: 'on' }), 'Write my own banner instead'),
          h('p', { class: 'hint' }, 'Otherwise the website shows an automatic banner for these days.')),
        bannerPart,
        checking, box),
      h('footer', { class: 'sheet-foot' }, cancel, save));

    const read = () => ui.readForm(form);
    let rows = [];
    let rowEls = [];
    let shownDates = '';
    // Rebuild the per-day rows when the picked dates change, keeping each day's choices.
    function syncRows(values) {
      const { dates } = closingDates(values);
      const key = dates.join(',');
      if (key === shownDates) return;
      shownDates = key;
      rows = dayRows(dates, hours());
      const v = { ...rowDefaults(rows), ...values };
      rowEls = rows.map((r) => dayControls(r.date, r.normal, v));
      daysBox.replaceChildren(...(rows.length ? [h('p', { class: 'field-label' }, rows.length > 1 ? 'Each day' : 'That day'), ...rowEls] : []));
    }
    syncRows({ ...saved, mode: saved.mode === 'range' && !date ? 'range' : 'one', date: date || saved.date || '' });

    const draft = ui.formDraft(form, KEY); // rows for the saved dates exist now, so their choices restore too
    let dirty = draft.restored;
    let touched = draft.restored || !!date;
    let stale = false;
    let reopenAt = null;
    let lastGen = null;

    function paintForm() {
      let v = read();
      syncRows(v);
      v = read();
      one.hidden = v.mode === 'range';
      range.hidden = v.mode !== 'range';
      bannerKind.hidden = v.bannerType !== 'weather';
      rowEls.forEach((el) => el.paint());
      bannerPart.hidden = !v.banner.includes('on');
      reasonCount.textContent = `${v.reason.trim().length} / ${REASON_MAX}`;
      const r = formToClosings({ ...v, banner: [] }, rows, Date.now());
      const days = r.body ? r.body.days : [];
      const gen = closingBannerMessage(days, { reason: v.reason }, Date.now());
      if (lastGen === null) lastGen = draft.restored ? gen : '';
      if (!msg.value.trim() || msg.value === lastGen) msg.value = gen; // follow the days until edited
      lastGen = gen;
      const n = msg.value.trim().length;
      count.textContent = `${n} / ${BANNER_MAX}`;
      count.classList.toggle('over', n > BANNER_MAX);
      preview.replaceChildren(bannerStrip(h, v.bannerType, msg.value));
      // Next opening counts these (unsaved) days plus the saved closings, weekends and hours.
      const dates = days.map((d) => d.date);
      const merged = (state.closings || []).filter((c) => !dates.includes(c.date)).concat(days);
      const sug = dates.length ? suggestBannerEnd({ type: 'holiday', closingDates: dates, hours: hours(), closings: merged, now: Date.now() }) : null;
      reopenAt = sug ? sug.toISOString() : null;
      const last = dates.length ? endOfLastDay(dates).toISOString() : null;
      span.textContent = !dates.length ? ''
        : v.bannerEnd === 'until' ? 'Shows from now until you end it on the Banners tab.'
        : v.bannerEnd === 'reopen' && reopenAt ? `Shows from now until we reopen — ${formatWhen(reopenAt)}.`
        : `Shows from now until the end of the last day — ${formatWhen(last)}.${reopenAt ? ` (We reopen ${formatWhen(reopenAt)}.)` : ''}`;
      save.textContent = days.length > 1 ? `Save ${days.length} days` : 'Save';
    }
    const check = ui.liveCheck(() => {
      const { body, errors } = formToClosings(read(), rows, Date.now(), { reopenAt });
      if (errors.length) return { errors, warnings: [] };
      return api.put('/admin/closings', body, { dryRun: true });
    }, (s) => {
      checking.textContent = s.pending ? 'Checking…' : '';
      save.disabled = stale || s.pending || s.errors.length > 0;
      if (stale) return;
      box.replaceChildren(...(s.failed ? ui.saveErrorNodes(s.failed) : ui.issues(touched ? s.errors : [], s.warnings)));
    });
    function changed() { dirty = true; touched = true; paintForm(); check.schedule(); }
    form.addEventListener('change', (e) => {
      // "Several days" starts from the single date already picked.
      if (e.target.name === 'mode') {
        const v = read();
        if (v.mode === 'range' && !v.from && v.date) form.elements.from.value = v.date;
        if (v.mode === 'one' && !v.date && v.from) form.elements.date.value = v.from;
      }
      if (e.target.name === 'from' && form.elements.to.value && form.elements.to.value < e.target.value) form.elements.to.value = e.target.value;
    });
    form.addEventListener('input', changed);
    form.addEventListener('change', changed);
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const { body, errors } = formToClosings(read(), rows, Date.now(), { reopenAt });
      if (errors.length) { touched = true; box.replaceChildren(...ui.issues(errors)); return; }
      save.disabled = true;
      check.stop();
      checking.textContent = 'Saving…';
      try {
        const res = await api.put('/admin/closings', body);
        close();
        const n = ((res && res.closings) || []).length;
        const w = (res && res.warnings) || [];
        const did = `Saved ${n} day${n === 1 ? '' : 's'}${res && res.banner ? ' and a banner' : ''}.`;
        ui.toast(w.length ? `${did} ${w.join(' ')}` : did, { ms: w.length ? 6000 : 3500 });
        await load();
      } catch (err) {
        checking.textContent = '';
        stale = !!err && err.name === 'StaleError';
        // Reload keeps this form's typing: it is saved as the draft and restored on reopen.
        box.replaceChildren(...ui.saveErrorNodes(err, { onReload: async () => { drafts.save(KEY, read()); close({ keep: true }); await load(); openAdd(); } }));
        box.scrollIntoView?.({ block: 'nearest' });
        save.disabled = stale;
      }
    });
    cancel.addEventListener('click', () => sheet.request());

    const sheet = ui.sheet({
      title: 'Add closing',
      content: form,
      onClose: async () => {
        if (dirty && !(await ui.confirmDialog('Discard this closing?', { ok: 'Discard', danger: true }))) return false;
        close();
        return true;
      },
      onDispose: () => check.stop(), // also on a route change
    });
    function close({ keep = false } = {}) {
      check.stop();
      if (keep) draft.flush(); else draft.clear();
      draft.stop();
      sheet.close();
      setHash('#closings');
      if (current === me) current = null;
    }
    const me = { close };
    current = me;
    setHash(KEY);
    if (draft.restored) box.before(h('p', { class: 'hint' }, 'We kept what you were typing.'));
    paintForm();
    check.now();
  }

  await load();
  if (route.parts[0] === 'new') {
    const d = /^\d{4}-\d{2}-\d{2}$/.test(route.query.date || '') ? route.query.date : null;
    openAdd({ date: d });
  } else if (/^\d{4}-\d{2}-\d{2}$/.test(route.parts[0] || '')) {
    // #closings/<date> (from the holiday question): open that day's closing.
    const c = (state.closings || []).find((x) => x.date === route.parts[0]);
    setHash('#closings');
    if (c) openDay(c); else ui.toast('That closing was not found — it may have been removed.');
  }
}

function setHash(hash) {
  if (location.hash !== hash) history.replaceState(null, '', hash);
}
