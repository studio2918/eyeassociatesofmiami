// Reminders: notifications on this phone (Web Push) + the holidays the office is asked about.
// iPhone: works only from the installed app (Add to Home Screen, iOS 16.4+). Kinds offered follow the
// role (staff editors: holiday, weather, banner-ends). Holidays list: owner/doctor edit, editors read-only.
// ctx.device: optional stand-in for `window` (the dev mock passes a fake phone).
import * as push from '../push.js';
import { canEditHolidays } from '../roles.js';
import {
  parseHolidayRule, holidayRuleString, holidayFormErrors, nextHolidayDate, holidayRuleText, holidayItem, holidayRuleEditable,
  upcomingHolidayQuestions, HOLIDAY_RULE_TYPES, MONTH_NAMES, DAYS, DAY_NAMES, newId,
} from '../model.js';
import { formatDate, todayCentral, weekdayOf } from '../time.js';

export async function render(root, ctx) {
  const { ui, api, role } = ctx;
  const { h } = ui;
  const win = ctx.device || globalThis;
  const phone = h('section', { class: 'card phone-card', 'aria-labelledby': 'phoneHead', 'aria-live': 'polite' });
  const questions = h('div');
  const holidays = h('div');
  root.replaceChildren(
    h('div', { class: 'screen-head' }, h('h1', {}, 'Reminders')),
    phone,
    h('h2', { class: 'group' }, 'Upcoming holiday questions'),
    questions,
    holidays);

  // ---------- this phone ----------
  let device = { state: 'loading', kinds: [] };
  let busy = false;
  const head = (text) => h('h2', { id: 'phoneHead', class: 'card-title' }, text);

  async function refresh() {
    paintPhone({ state: 'loading', kinds: [] });
    try {
      device = await push.readDevice({ api, role, win });
    } catch (err) {
      if (err && (err.name === 'AuthError' || err.name === 'SignInRejectedError')) return;
      if (err && err.name === 'PhoneCheckTimeout') {
        phone.replaceChildren(head('This phone'),
          h('p', { class: 'error', role: 'alert' }, 'Couldn’t check this phone — reload.'),
          h('button', { type: 'button', class: 'btn ghost', onclick: () => location.reload() }, 'Reload'));
        return;
      }
      phone.replaceChildren(head('This phone'), ...ui.saveErrorNodes(err),
        h('button', { type: 'button', class: 'btn ghost', onclick: refresh }, 'Try again'));
      return;
    }
    paintPhone(device);
  }

  function kindList(selected, onChange) {
    return h('ul', { class: 'kinds' }, push.kindOptions(role).map((o) => {
      const box = h('input', { type: 'checkbox', name: 'kind', value: o.id, checked: selected.includes(o.id) });
      if (onChange) box.addEventListener('change', onChange);
      return h('li', {}, h('label', {}, h('span', {}, o.label), box));
    }));
  }
  const chosen = () => [...phone.querySelectorAll('input[name="kind"]')].filter((x) => x.checked).map((x) => x.value);

  function paintPhone(d) {
    device = d;
    const box = h('div', { 'aria-live': 'polite' });
    if (d.state === 'loading') { phone.replaceChildren(head('This phone'), h('p', { class: 'soft' }, 'Checking this phone…')); return; }
    if (d.state === 'install') {
      phone.replaceChildren(head('Add to Home Screen first'),
        h('p', {}, 'On iPhone, reminders only work from the installed app (iOS 16.4 or newer).'),
        h('ol', { class: 'steps' },
          h('li', {}, 'In Safari, tap the Share button (the square with an arrow).'),
          h('li', {}, 'Tap Add to Home Screen, then Add.'),
          h('li', {}, 'Open EAOM Admin from the new icon on your Home Screen, then Menu → Reminders.')));
      return;
    }
    if (d.state === 'unsupported') {
      phone.replaceChildren(head('Reminders can’t work in this browser'),
        h('p', {}, 'On iPhone, use Safari (iOS 16.4 or newer), add this page to your Home Screen and open it from the icon.'),
        h('p', { class: 'soft' }, 'On a computer, use a recent Chrome, Edge, Firefox or Safari.'));
      return;
    }
    if (d.state === 'denied') {
      phone.replaceChildren(head('Notifications are blocked'),
        h('p', {}, 'This phone was told not to allow notifications from the admin. To allow them:'),
        h('ol', { class: 'steps' },
          h('li', {}, 'Open the iPhone Settings app.'),
          h('li', {}, 'Tap Notifications, then EAOM Admin.'),
          h('li', {}, 'Turn on Allow Notifications, then come back here.')),
        h('p', { class: 'soft' }, 'On a computer: allow notifications for this site in the browser’s site settings.'),
        h('button', { type: 'button', class: 'btn ghost', onclick: refresh }, 'Check again'));
      return;
    }
    if (d.state === 'off') {
      const on = h('button', { type: 'button', class: 'btn wide' }, 'Turn on reminders on this phone');
      on.addEventListener('click', () => {
        if (busy) return;
        const kinds = chosen();
        if (!kinds.length) { box.replaceChildren(h('p', { class: 'error', role: 'alert' }, 'Choose at least one reminder.')); return; }
        busy = true;
        on.disabled = true;
        box.replaceChildren(h('p', { class: 'checking' }, 'Turning on…'));
        // Straight from the tap: the permission question is the first thing turnOn does (iPhone needs that).
        push.turnOn({ api, role, kinds, win }).then((r) => {
          busy = false;
          paintPhone(r);
          if (r.state === 'on') ui.toast('Reminders are on for this phone.');
          if (r.state === 'off') ui.toast('Notifications weren’t allowed, so reminders are still off.');
        }, (err) => {
          busy = false;
          on.disabled = false;
          box.replaceChildren(...failed(err, 'Couldn’t turn on reminders.'));
        });
      });
      const start = push.startKinds(role);
      phone.replaceChildren(head('This phone'),
        h('p', { class: 'phone-state' }, 'Reminders are off on this phone.'),
        h('p', { class: 'soft' }, 'Choose what to get:'),
        kindList(start),
        on, box);
      return;
    }
    // on
    const testBtn = h('button', { type: 'button', class: 'btn' }, 'Send me a test');
    const offBtn = h('button', { type: 'button', class: 'btn ghost' }, 'Turn off reminders on this phone');
    async function change(e) {
      if (busy) { e.target.checked = !e.target.checked; return; }
      busy = true;
      const boxes = [...phone.querySelectorAll('input[name="kind"]')];
      boxes.forEach((x) => { x.disabled = true; });
      try {
        const r = await push.setKinds({ api, role, kinds: chosen(), win });
        busy = false;
        if (r.state === 'off') { paintPhone(r); ui.toast('All reminders are off on this phone.'); return; }
        device = r;
        boxes.forEach((x) => { x.disabled = false; });
        ui.toast('Saved.');
      } catch (err) {
        busy = false;
        e.target.checked = !e.target.checked;
        boxes.forEach((x) => { x.disabled = false; });
        box.replaceChildren(...failed(err, 'Couldn’t save that change.'));
      }
    }
    testBtn.addEventListener('click', async () => {
      if (busy) return;
      busy = true;
      testBtn.disabled = true;
      box.replaceChildren(h('p', { class: 'checking' }, 'Sending…'));
      try { box.replaceChildren(h('p', {}, push.testResultText(await push.sendTest(api)))); } catch (err) { box.replaceChildren(...failed(err, 'Couldn’t send the test.')); }
      busy = false;
      testBtn.disabled = false;
    });
    offBtn.addEventListener('click', async () => {
      if (busy) return;
      if (!(await ui.confirmDialog('Turn off all reminders on this phone?', { ok: 'Turn off' }))) return;
      busy = true;
      offBtn.disabled = true;
      try {
        paintPhone(await push.turnOff({ api, role, win }));
        ui.toast('Reminders are off on this phone.');
      } catch (err) {
        offBtn.disabled = false;
        box.replaceChildren(...failed(err, 'Couldn’t turn reminders off.'));
      }
      busy = false;
    });
    phone.replaceChildren(head('This phone'),
      h('p', { class: 'phone-state on' }, 'Reminders are on for this phone.'),
      kindList(d.kinds, change),
      h('div', { class: 'stack' }, testBtn, offBtn),
      box);
  }

  function failed(err, lead) {
    if (err && err.name === 'PhoneCheckTimeout') return [h('p', { class: 'error', role: 'alert' }, 'Couldn’t check this phone — reload.')];
    const nodes = ui.saveErrorNodes(err);
    if (err && err.name && /Error$/.test(err.name) && !('status' in err)) {
      // a browser error (subscribe refused, etc.), not the server's
      return [h('p', { class: 'error', role: 'alert' }, `${lead} Please try again.`)];
    }
    return nodes.length ? nodes : [h('p', { class: 'error', role: 'alert' }, lead)];
  }

  // ---------- holidays ----------
  const canEdit = canEditHolidays(role);
  let state = null;
  const pending = new Map(); // id -> wanted on, while saving
  const path = (id) => `/admin/holidays/${encodeURIComponent(id)}`;

  async function load() {
    state = await api.get('/admin/state');
    paintHolidays();
  }
  const list = () => state.holidays || [];
  const find = (id) => list().find((x) => x.id === id) || null;

  function paintHolidays() {
    const today = todayCentral();
    const qs = upcomingHolidayQuestions(list(), state.closings || [], today);
    questions.replaceChildren(qs.length
      ? h('ul', { class: 'list' }, qs.map((q) => h('li', {},
        h('a', { class: 'row-main', href: q.hash },
          h('span', { class: 'row-title' }, `${q.name} · ${formatDate(q.date)}`),
          h('span', { class: 'row-meta' }, 'Are we open? Tap to answer.')))))
      : h('p', { class: 'empty' }, 'No holiday questions in the next 30 days.'));

    const had = document.activeElement && document.activeElement.dataset ? document.activeElement.dataset.holiday : null;
    const rows = list().map((x) => ({ x, next: nextHolidayDate(x.rule, today) }))
      .sort((a, b) => String(a.next || '9999').localeCompare(String(b.next || '9999')));
    holidays.replaceChildren(...[
      h('div', { class: 'screen-head' },
        h('h2', { class: 'group' }, 'Holidays'),
        canEdit ? h('button', { type: 'button', class: 'btn ghost small', onclick: () => openEditor(null) }, 'Add holiday') : null),
      h('p', { class: 'soft screen-intro' }, 'Two weeks before each holiday that’s on (and on a weekday), everyone who can change closings is asked: are we open?'),
      canEdit ? null : h('p', { class: 'notice' }, 'Only Dr. Gray and Dr. Walls can change this list.'),
      h('ul', { class: 'list' }, rows.map(({ x, next }) => holidayRow(x, next)))].filter(Boolean));
    if (had) [...holidays.querySelectorAll('input[data-holiday]')].find((i) => i.dataset.holiday === had)?.focus();
  }

  function holidayRow(x, next) {
    const weekend = next && ['sat', 'sun'].includes(weekdayOf(next));
    const meta = [next ? formatDate(next) : 'Date rule not recognized', holidayRuleText(x.rule)];
    if (x.on && weekend) meta.push('weekend — no question');
    const on = pending.has(x.id) ? pending.get(x.id) : x.on === true;
    let side;
    if (canEdit) {
      const sw = h('input', { type: 'checkbox', role: 'switch', checked: on, 'aria-disabled': pending.has(x.id) ? 'true' : null, 'data-holiday': x.id, 'aria-label': `Ask about ${x.name}` });
      sw.addEventListener('change', () => {
        if (pending.has(x.id)) { sw.checked = pending.get(x.id); return; }
        toggle(x.id, sw.checked);
      });
      side = h('label', { class: 'switch' }, sw, h('span', { 'aria-hidden': 'true' }, 'Ask'));
    } else {
      side = h('span', { class: 'row-meta' }, on ? 'On' : 'Off');
    }
    return h('li', {},
      h('button', { type: 'button', class: 'row-main', disabled: !canEdit, onclick: canEdit ? () => openEditor(x) : null },
        h('span', { class: 'row-title' }, x.name),
        h('span', { class: 'row-meta' }, meta.join(' · '))),
      h('span', { class: 'row-side' }, side));
  }

  async function toggle(id, want) {
    const x = find(id);
    if (!x) return;
    pending.set(id, want);
    paintHolidays();
    try {
      const res = await api.put(path(id), { item: holidayItem(x, { on: want }), version: x.version ?? null });
      pending.delete(id);
      Object.assign(find(id) || x, (res && res.item) || { on: want });
      ui.toast(want ? `${x.name}: you’ll be asked two weeks before.` : `${x.name} is off: no holiday question for it.`);
      paintHolidays();
    } catch (err) {
      pending.delete(id);
      if (err && err.name === 'StaleError') {
        ui.toast(`${err.message.replace(/ — reload\?$/, '')}. Showing the latest — try again.`, { ms: 6000 });
        try { await load(); } catch { paintHolidays(); }
        return;
      }
      paintHolidays();
      const nodes = ui.saveErrorNodes(err);
      if (nodes.length) ui.toast(nodes[0].textContent);
    }
  }

  // x: holiday to edit, or null for a new one.
  function openEditor(x) {
    const isNew = !x;
    // A stored rule the form can't show as it is (5th weekday, Feb 29, unknown shape): say so, and Save
    // stays off until the date setting is changed (so it never silently saves a different date).
    const locked = !isNew && !holidayRuleEditable(x.rule);
    let unlocked = !locked;
    const parsed = x && parseHolidayRule(x.rule);
    const f0 = { type: 'fixed', month: 1, day: 1, n: 1, dow: 'mon', offset: 0, plus: 0, ...(parsed || {}) };
    if (f0.n > 4) f0.n = 4; // the form offers 1st-4th; Save stays off until the date setting is changed
    const opt = (v, label, sel) => h('option', { value: String(v), selected: String(v) === String(sel) }, label);
    const field = (label, id, input, hint) => h('div', { class: 'field' }, h('label', { for: id }, label), input, hint ? h('p', { class: 'hint' }, hint) : null);
    const name = h('input', { type: 'text', id: 'holName', name: 'name', maxlength: '60', value: x ? x.name : '', autocomplete: 'off' });
    const type = h('select', { id: 'holType', name: 'type' }, HOLIDAY_RULE_TYPES.map((t) => opt(t.id, t.label, f0.type)));
    const n = h('select', { id: 'holN', name: 'n' }, [1, 2, 3, 4].map((i) => opt(i, ['1st', '2nd', '3rd', '4th'][i - 1], f0.n)));
    const dow = h('select', { id: 'holDow', name: 'dow' }, DAYS.map((d) => opt(d, DAY_NAMES[d], f0.dow)));
    const month = h('select', { id: 'holMonth', name: 'month' }, MONTH_NAMES.map((m, i) => opt(i + 1, m, f0.month)));
    const day = h('input', { type: 'number', id: 'holDay', name: 'day', min: '1', max: '31', inputmode: 'numeric', value: String(f0.day) });
    const offset = h('input', { type: 'number', id: 'holOffset', name: 'offset', min: '-60', max: '60', inputmode: 'numeric', value: String(f0.offset) });
    const plus = h('input', { type: 'number', id: 'holPlus', name: 'plus', min: '0', max: '60', inputmode: 'numeric', value: String(f0.plus) });
    const fN = field('Which one', 'holN', n);
    const fDow = field('Weekday', 'holDow', dow);
    const fMonth = field('Month', 'holMonth', month);
    const fDay = field('Day', 'holDay', day);
    const fOffset = field('Days from Easter', 'holOffset', offset, 'Before Easter is negative: Good Friday is -2.');
    const fPlus = field('Plus days after (optional)', 'holPlus', plus, 'For example, Day after Thanksgiving is the 4th Thursday of November, plus 1.');
    const preview = h('p', { class: 'result-title', 'aria-live': 'polite' });
    const lockNote = locked ? h('p', { class: 'notice', role: 'status' }, `This rule can’t be edited here (${x.rule}). To change it, pick how the date is set again.`) : null;
    const box = h('div', { 'aria-live': 'polite' });
    const save = h('button', { type: 'submit', class: 'btn' }, isNew ? 'Add holiday' : 'Save');
    const cancel = h('button', { type: 'button', class: 'btn ghost' }, 'Cancel');
    const form = h('form', { class: 'sheet-form', novalidate: true },
      h('div', { class: 'sheet-body' },
        field('Name', 'holName', name),
        lockNote,
        field('How the date is set', 'holType', type),
        fN, fDow, fMonth, fDay, fOffset, fPlus,
        preview, box),
      h('footer', { class: 'sheet-foot' }, cancel, save));
    let dirty = false;

    const read = () => ({
      type: type.value, month: Number(month.value), day: day.value === '' ? '' : Number(day.value), n: Number(n.value), dow: dow.value,
      offset: offset.value === '' ? '' : Number(offset.value), plus: plus.value === '' ? 0 : Number(plus.value),
    });
    function errorsOf() {
      const errs = [];
      if (!name.value.trim()) errs.push('Name is required');
      return errs.concat(holidayFormErrors(read()));
    }
    function paint() {
      const t = type.value;
      fN.hidden = t !== 'nth';
      fDow.hidden = !(t === 'nth' || t === 'last');
      fMonth.hidden = t === 'easter';
      fDay.hidden = t !== 'fixed';
      fOffset.hidden = t !== 'easter';
      save.disabled = !unlocked;
      if (!unlocked) { preview.textContent = ''; return; }
      if (lockNote) lockNote.hidden = true;
      const ruleErrs = holidayFormErrors(read());
      if (ruleErrs.length) { preview.textContent = ''; return; }
      const rule = holidayRuleString(read());
      const next = nextHolidayDate(rule, todayCentral());
      preview.textContent = next ? `Next: ${formatDate(next)} (${holidayRuleText(rule)})` : '';
    }
    form.addEventListener('input', () => { dirty = true; box.replaceChildren(); paint(); });
    form.addEventListener('change', (e) => { dirty = true; if (e.target === type) unlocked = true; paint(); });
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!unlocked) return;
      const errs = errorsOf();
      if (errs.length) { box.replaceChildren(...ui.issues(errs)); return; }
      const id = isNew ? newId() : x.id;
      const item = holidayItem({ id, name: name.value, rule: holidayRuleString(read()), on: isNew ? true : x.on === true });
      save.disabled = true;
      box.replaceChildren(h('p', { class: 'checking' }, 'Saving…'));
      try {
        const res = await api.put(path(id), { item, version: isNew ? null : x.version ?? null });
        sheet.close();
        const w = (res && res.warnings) || [];
        ui.toast(w.length ? `Saved. Note: ${w.join(' ')}` : 'Saved.');
        await load();
      } catch (err) {
        save.disabled = false;
        box.replaceChildren(...ui.saveErrorNodes(err, { onReload: async () => { sheet.close(); await load(); } }));
      }
    });
    cancel.addEventListener('click', () => sheet.request());
    const sheet = ui.sheet({
      title: isNew ? 'Add holiday' : `Edit ${x.name}`,
      content: form,
      onClose: async () => !dirty || ui.confirmDialog('Discard your changes to this holiday?', { ok: 'Discard', danger: true }),
    });
    paint();
    if (isNew) setTimeout(() => name.focus(), 0);
  }

  // Both halves load on their own; the phone part never blocks the list.
  refresh();
  questions.replaceChildren(h('p', { class: 'soft' }, 'Loading…'));
  await load();
}
