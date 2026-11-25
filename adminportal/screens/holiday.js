// Holiday question: #holiday/<id>/<YYYY-MM-DD>?remind=holiday:<key> (from the push notification).
// "Are we open on Thanksgiving (Thu, Nov 26)?" -> Open — normal hours (asks first) | Closed all day | Open, closing early.
// Closed / early adds that closing on the server (same rules as Closings, in the change log, undoable).
import {
  holidayRoute, holidayQuestion, holidayAnswerPath, holidayAnswerBody, holidayOutcome, HOLIDAY_ANSWER_TEXT,
  earlyCloseTimes, holidayBannerHash, cleanHours, closingLabel, REASON_MAX, DEFAULT_EARLY,
  holidayOpenConfirm, answeredText, holidayKeyFor,
} from '../model.js';
import { formatDate, formatTime, todayCentral, weekdayOf } from '../time.js';

export async function render(root, ctx) {
  const { ui, api, route } = ctx;
  const { h } = ui;
  const r = holidayRoute(route.parts, route.query);
  const head = (...kids) => root.replaceChildren(h('div', { class: 'screen-head' }, h('h1', {}, 'Holiday hours')), ...kids);
  if (!r) { head(h('p', { class: 'error', role: 'alert' }, 'That holiday link is broken.'), backLink()); return; }

  head(h('p', { class: 'soft' }, 'Loading…'));
  const state = await api.get('/admin/state');
  const holiday = (state.holidays || []).find((x) => x.id === r.id);
  if (!holiday) { head(h('p', { class: 'error', role: 'alert' }, 'That holiday was not found — it may have been removed.'), backLink()); return; }
  r.key = holidayKeyFor(holiday.rule, r.id, r.date, r.key); // e.g. fixed:12-31+1 on Jan 1 -> last year's key
  const name = String(holiday.name || '').trim() || 'this holiday';
  const hours = cleanHours(state.hours);
  const normal = hours[weekdayOf(r.date)] || null;
  const question = h('p', { class: 'question' }, holidayQuestion(name, r.date));

  const existing = (state.closings || []).find((c) => c.date === r.date);
  if (existing) { head(question, hasClosing(existing)); return; }
  if (r.date < todayCentral()) { head(question, h('p', { class: 'notice' }, 'That day has already passed.'), backLink()); return; }

  // ---- the question ----
  const box = h('div', { 'aria-live': 'polite' });
  const big = (answer, label, hint) => h('button', { type: 'button', class: 'btn ghost big-choice', 'aria-pressed': 'false', 'data-answer': answer },
    h('span', {}, label), hint ? h('span', { class: 'choice-desc' }, hint) : null);
  const openBtn = big('open', HOLIDAY_ANSWER_TEXT.open, normal ? `${formatTime(normal.open)} – ${formatTime(normal.close)}` : 'Normally closed that day');
  const closedBtn = big('closed', HOLIDAY_ANSWER_TEXT.closed);
  const times = earlyCloseTimes(normal);
  const earlyBtn = big('early', HOLIDAY_ANSWER_TEXT.early, times.length ? 'Pick the closing time' : 'Not possible: no normal hours that day');
  earlyBtn.disabled = !times.length;

  const reason = h('input', { type: 'text', name: 'reason', id: 'holidayReason', maxlength: String(REASON_MAX), value: name.slice(0, REASON_MAX) });
  const closeAt = times.length ? ui.timeSelect('closeAt', times, times.includes(DEFAULT_EARLY) ? DEFAULT_EARLY : times[Math.floor(times.length / 2)], formatTime, { id: 'holidayCloseAt' }) : null;
  const timeField = closeAt ? h('div', { class: 'field' }, h('label', { for: 'holidayCloseAt' }, 'We close at'), closeAt) : null;
  const confirmBtn = h('button', { type: 'submit', class: 'btn wide' }, 'Save');
  const panel = h('form', { class: 'subform', hidden: true, novalidate: true },
    timeField,
    h('div', { class: 'field' }, h('label', { for: 'holidayReason' }, 'Reason (shown on website)'), reason),
    confirmBtn);
  let chosen = null;

  async function choose(answer) {
    // Open isn't undoable on the server: one-line confirm first.
    if (answer === 'open' && !(await ui.confirmDialog(holidayOpenConfirm(r.date), { ok: 'Yes, open' }))) return;
    chosen = answer;
    for (const b of [openBtn, closedBtn, earlyBtn]) b.setAttribute('aria-pressed', String(b.dataset.answer === answer));
    box.replaceChildren();
    if (answer === 'open') { panel.hidden = true; send('open'); return; }
    panel.hidden = false;
    if (timeField) timeField.hidden = answer !== 'early';
    confirmBtn.textContent = answer === 'early' ? 'Save early close' : 'Save: closed all day';
  }
  openBtn.addEventListener('click', () => choose('open'));
  closedBtn.addEventListener('click', () => choose('closed'));
  earlyBtn.addEventListener('click', () => choose('early'));
  panel.addEventListener('submit', (e) => { e.preventDefault(); if (chosen) send(chosen); });

  const buttons = [openBtn, closedBtn, earlyBtn];
  let busy = false;
  async function send(answer) {
    if (busy) return;
    busy = true;
    buttons.forEach((b) => { b.disabled = true; });
    confirmBtn.disabled = true;
    box.replaceChildren(h('p', { class: 'checking' }, 'Saving…'));
    const body = holidayAnswerBody(answer, { closeAt: closeAt ? closeAt.value : null, reason: reason.value, name });
    try {
      const res = await api.post(holidayAnswerPath(r.key), body);
      const out = holidayOutcome(answer, res);
      const w = (res && res.warnings) || [];
      if (w.length) ui.toast(w.join(' '), { ms: 6000 });
      if (out.already) head(question, alreadyAnswered(out.answer, res));
      else head(question, done(answer, body));
    } catch (err) {
      busy = false;
      buttons.forEach((b) => { b.disabled = false; });
      earlyBtn.disabled = !times.length;
      confirmBtn.disabled = false;
      if (err && err.name === 'StaleError' && err.body && err.body.error === 'exists') {
        const fresh = await api.get('/admin/state').catch(() => null);
        const c = fresh && (fresh.closings || []).find((x) => x.date === r.date);
        head(question, hasClosing(c || null));
        return;
      }
      if (err && err.status === 404) { box.replaceChildren(h('p', { class: 'error', role: 'alert' }, 'That holiday was not found — it may have been removed.')); return; }
      box.replaceChildren(...ui.saveErrorNodes(err));
    }
  }

  head(question,
    h('div', { class: 'big-choices' }, openBtn, closedBtn, earlyBtn),
    panel, box);

  // ---- results ----
  function done(answer, body) {
    const day = formatDate(r.date);
    if (answer === 'open') {
      return h('section', { class: 'result' },
        h('p', { class: 'result-title' }, `Got it — open normal hours on ${day}.`),
        h('p', { class: 'soft' }, 'Nothing changes on the website. The question is cleared for everyone.'),
        backLink());
    }
    const what = answer === 'early' ? `closing at ${formatTime(body.closeAt)}` : 'closed all day';
    const link = holidayBannerHash({ date: r.date, allDay: answer === 'closed', closeAt: body.closeAt || null, reason: body.reason },
      { hours, closings: state.closings || [], now: Date.now() });
    return h('section', { class: 'result' },
      h('p', { class: 'result-title' }, `Saved: ${what} on ${day}.`),
      h('p', { class: 'soft' }, 'It shows on the website under Coming up. You can undo it from the Change log.'),
      h('p', {}, 'The website will show an automatic banner 2 weeks before. Want to write your own instead?'),
      h('div', { class: 'row' },
        h('a', { class: 'btn', href: link }, 'Write my own banner'),
        h('a', { class: 'btn ghost', href: '#closings' }, 'No, thanks')));
  }

  function alreadyAnswered(answer, res) {
    const by = (res && (res.answeredBy || res.by)) || null;
    const dn = api.displayName || ((e) => e || 'Someone else');
    return h('section', { class: 'result' },
      h('p', { class: 'result-title' }, answeredText(by, HOLIDAY_ANSWER_TEXT[answer] || answer, dn)),
      h('p', { class: 'soft' }, 'Nothing else was changed.'),
      h('div', { class: 'row' }, h('a', { class: 'btn ghost', href: '#closings' }, 'See closings')));
  }

  function hasClosing(c) {
    return h('section', { class: 'result' },
      h('p', { class: 'result-title' }, 'That day already has a closing.'),
      c ? h('p', { class: 'soft' }, `${formatDate(c.date)}: ${closingLabel(c)}${c.reason ? ` · ${c.reason}` : ''}`) : null,
      h('div', { class: 'row' }, h('a', { class: 'btn', href: c ? `#closings/${c.date}` : '#closings' }, 'Open that closing')));
  }

  function backLink() {
    return h('p', {}, h('a', { href: '#closings' }, 'Go to Closings'));
  }
}
