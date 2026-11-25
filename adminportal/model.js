// Pure logic for the admin screens: Banners, Closings, Hours, Insurance, Jobs, Applications, Change log
// (no DOM; tested in node).
import { knownName } from './names.js';
import {
  centralToUtc, utcToCentral, expandRange, formatDate, formatTime, formatWhen, addDays,
  todayCentral, weekdayOf, timeOptions,
} from './time.js';

export const BANNER_MAX = 250; // server warns above this
export const BANNER_TYPES = [
  { id: 'notice', label: 'Notice' },
  { id: 'holiday', label: 'Holiday' },
  { id: 'weather', label: 'Weather' },
];
export const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
export const DAY_NAMES = { mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday', thu: 'Thursday', fri: 'Friday', sat: 'Saturday', sun: 'Sunday' };

const iso = (ms) => new Date(ms).toISOString();
const ms = (s) => Date.parse(s);

// Client-made ids: 32 hex chars (server allows [A-Za-z0-9_-]{1,64}).
export function newId() { return crypto.randomUUID().replace(/-/g, ''); }

// ---- banners ----

export function groupBanners(banners, now = Date.now()) {
  const live = [], scheduled = [], ended = [];
  for (const b of banners || []) {
    const s = ms(b.startsAt), e = b.endsAt ? ms(b.endsAt) : null;
    if (e != null && e <= now) ended.push(b);
    else if (s > now) scheduled.push(b);
    else live.push(b);
  }
  live.sort((a, b) => ms(b.startsAt) - ms(a.startsAt)); // newest start shows (server rule)
  scheduled.sort((a, b) => ms(a.startsAt) - ms(b.startsAt));
  ended.sort((a, b) => ms(b.endsAt) - ms(a.endsAt));
  return { live, scheduled, ended, showing: live[0] ? live[0].id : null };
}

export function emptyBannerForm() {
  return { type: 'notice', weather: 'snow', message: '', start: 'now', startDate: '', startTime: '', end: 'until', endDate: '', endTime: '', v: '' };
}

// Item -> editor values. duplicate: same words and type, starting now, new item.
export function bannerToForm(b, { duplicate = false, now = Date.now() } = {}) {
  const f = { ...emptyBannerForm(), type: b.type || 'notice', weather: b.weather === 'ice' ? 'ice' : 'snow', message: b.message || '' };
  if (!duplicate) {
    const s = utcToCentral(b.startsAt);
    Object.assign(f, { start: 'at', startDate: s ? s.date : '', startTime: s ? s.time : '', v: String(b.version ?? '') });
  }
  // A duplicate keeps a future end; a past end becomes "until I turn it off" (never a blank error).
  if (b.endsAt && (!duplicate || ms(b.endsAt) > now)) {
    const e = utcToCentral(b.endsAt);
    Object.assign(f, { end: 'at', endDate: e.date, endTime: e.time });
  }
  return f;
}

// Editor values -> { item, errors }. `original` keeps exact saved times for untouched fields.
export function formToBanner(f, { id, now = Date.now(), original = null } = {}) {
  const errors = [];
  const same = (field, d, t) => {
    if (!original || !original[field]) return null;
    const c = utcToCentral(original[field]);
    return c && c.date === d && c.time === t ? original[field] : null;
  };
  let startsAt = null, endsAt = null;
  if (f.start === 'at') {
    startsAt = same('startsAt', f.startDate, f.startTime) || centralToUtc(f.startDate, f.startTime);
    if (!startsAt) errors.push('Choose a start date and time');
  } else startsAt = iso(now);
  if (f.end === 'at') {
    endsAt = same('endsAt', f.endDate, f.endTime) || centralToUtc(f.endDate, f.endTime);
    if (!endsAt) errors.push('Choose an end date and time, or "Until I turn it off"');
  }
  if (errors.length) return { item: null, errors };
  const item = { id, type: f.type, message: String(f.message || '').trim(), startsAt, endsAt };
  if (f.type === 'weather') item.weather = f.weather === 'ice' ? 'ice' : 'snow';   // snow or ice characters on the site
  return { item, errors };
}

// Only the fields the API stores for a banner.
export function bannerItem(b) {
  const out = { id: b.id, type: b.type, message: b.message, startsAt: b.startsAt, endsAt: b.endsAt ?? null };
  if (b.type === 'weather') out.weather = b.weather === 'ice' ? 'ice' : 'snow';
  return out;
}

export function endNowItem(b, now = Date.now()) { return { ...bannerItem(b), endsAt: iso(now) }; }

export function bannerSpanText(b, now = Date.now()) {
  if (!b.endsAt) return `From ${formatWhen(b.startsAt, now)} · until turned off`;
  return `${formatWhen(b.startsAt, now)} → ${formatWhen(b.endsAt, now)}`;
}

// ---- closings ----

export function closingDates({ mode, date, from, to }) {
  if (mode !== 'range') return date ? { dates: [date], errors: [] } : { dates: [], errors: ['Choose a date'] };
  if (!from || !to) return { dates: [], errors: ['Choose the first and last day'] };
  if (to < from) return { dates: [], errors: ['The last day must be on or after the first day'] };
  const dates = expandRange(from, to);
  if (dates.length > 366) return { dates: [], errors: ['Choose a range of a year or less'] };
  return { dates, errors: [] };
}

// Consecutive runs become "Thu, Nov 26 – Fri, Nov 27"; separate pieces are joined with "and".
export function formatDateList(dates, now = Date.now()) {
  const sorted = [...dates].sort();
  const runs = [];
  for (const d of sorted) {
    const last = runs.at(-1);
    if (last && addDays(last[1], 1) === d) last[1] = d;
    else runs.push([d, d]);
  }
  const parts = runs.map(([a, b]) => (a === b ? formatDate(a, now) : `${formatDate(a, now)} – ${formatDate(b, now)}`));
  return parts.length < 2 ? (parts[0] || '') : `${parts.slice(0, -1).join(', ')} and ${parts.at(-1)}`;
}

export const REASON_MAX = 40; // server rule; the reason is public (shown on the website)
export const DEFAULT_LATE = '10:00';
export const DEFAULT_EARLY = '12:00';

// One row per picked date, with that weekday's normal hours (null = normally closed).
export function dayRows(dates, hours) {
  return dates.map((date) => ({ date, normal: (hours && hours[weekdayOf(date)]) || null }));
}

// Form values for fresh rows: open days default to closed all day, normally-closed days are skipped.
export function rowDefaults(rows) {
  const v = {};
  for (const { date, normal } of rows) {
    v[`mode_${date}`] = normal ? 'allDay' : 'skip';
    v[`late_${date}`] = [];
    v[`early_${date}`] = [];
    v[`openAt_${date}`] = DEFAULT_LATE;
    v[`closeAt_${date}`] = DEFAULT_EARLY;
  }
  return v;
}

const on = (x) => (Array.isArray(x) ? x.includes('on') : !!x);

// 11:59 PM Central on the last date.
export function endOfLastDay(dates) {
  const last = [...dates].sort().at(-1);
  return last ? new Date(centralToUtc(last, '23:59')) : null;
}

// Add-closings form -> { body for PUT /admin/closings ({days, alsoBanner?}), errors }.
// bannerEnd: 'lastDay' (default, 11:59 PM of the last day) | 'reopen' (reopenAt, else last day) | 'until'.
export function formToClosings(v, rows, now = Date.now(), { reopenAt = null } = {}) {
  const errors = [];
  const reason = String(v.reason || '').trim();
  const note = String(v.note || '').trim();
  if (reason.length > REASON_MAX) errors.push(`Reason must be ${REASON_MAX} characters or fewer`);
  const days = [];
  for (const { date } of rows) {
    const mode = v[`mode_${date}`];
    if (!mode || mode === 'skip') continue;
    let day;
    if (mode === 'allDay') day = { date, allDay: true };
    else {
      const late = on(v[`late_${date}`]), early = on(v[`early_${date}`]);
      if (!late && !early) { errors.push(`${formatDate(date, now)}: choose “Opens late” or “Closes early”`); continue; }
      day = { date, allDay: false, openAt: late ? v[`openAt_${date}`] : null, closeAt: early ? v[`closeAt_${date}`] : null };
    }
    if (reason) day.reason = reason;
    if (note) day.note = note;
    days.push(day);
  }
  if (!days.length && !errors.length) errors.push('Choose at least one day to change');
  const message = String(v.bannerMessage || '').trim();
  if (on(v.banner) && !message) errors.push('Write the banner message');
  if (errors.length) return { body: null, errors };
  const body = { days };
  if (on(v.banner)) {
    const last = endOfLastDay(days.map((d) => d.date)).toISOString();
    const endsAt = v.bannerEnd === 'until' ? null : v.bannerEnd === 'reopen' && reopenAt ? reopenAt : last;
    body.alsoBanner = { type: v.bannerType === 'weather' ? 'weather' : 'holiday', message, startsAt: iso(now), endsAt };
    if (body.alsoBanner.type === 'weather') body.alsoBanner.weather = v.bannerWeather === 'ice' ? 'ice' : 'snow';
  }
  return { body, errors: [] };
}

// "Thanksgiving hours: we close at 12:00 PM on Wed, Nov 25 and we're closed Thu, Nov 26 – Fri, Nov 27."
export function closingBannerMessage(days, { reason = '' } = {}, now = Date.now()) {
  const groups = new Map(); // same change -> its dates, in first-date order
  for (const d of [...days].sort((a, b) => a.date.localeCompare(b.date))) {
    const key = d.allDay ? 'closed'
      : d.openAt && d.closeAt ? `open ${formatTime(d.openAt)} – ${formatTime(d.closeAt)}`
      : d.openAt ? `opens ${formatTime(d.openAt)}` : `closes ${formatTime(d.closeAt)}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(d.date);
  }
  const parts = [...groups].map(([key, dates]) => {
    const when = formatDateList(dates, now);
    if (key === 'closed') return `we're closed ${when}`;
    if (key.startsWith('open ')) return `we're ${key} on ${when}`;
    if (key.startsWith('opens ')) return `we open at ${key.slice(6)} on ${when}`;
    return `we close at ${key.slice(7)} on ${when}`;
  });
  if (!parts.length) return '';
  const text = parts.length < 2 ? parts[0] : `${parts.slice(0, -1).join(', ')} and ${parts.at(-1)}`;
  const r = String(reason || '').trim();
  return r ? `${r} hours: ${text}.` : `${text.charAt(0).toUpperCase()}${text.slice(1)}.`;
}

export function groupClosings(closings, today) {
  const upcoming = [], past = [];
  for (const c of closings || []) (c.date >= today ? upcoming : past).push(c);
  upcoming.sort((a, b) => a.date.localeCompare(b.date));
  past.sort((a, b) => b.date.localeCompare(a.date));
  return { upcoming, past };
}

export function closingLabel(c) {
  if (c.allDay) return 'Closed all day';
  if (c.openAt && c.closeAt) return `Open ${formatTime(c.openAt)} – ${formatTime(c.closeAt)}`;
  return c.openAt ? `Opens at ${formatTime(c.openAt)}` : `Closes at ${formatTime(c.closeAt)}`;
}

// ---- hours ----

const short = (hhmm) => { // '08:30' -> '8:30', '17:00' -> '5' (same as rules._fmt_time)
  const [h, m] = hhmm.split(':').map(Number);
  return m === 0 ? `${h % 12 || 12}` : `${h % 12 || 12}:${String(m).padStart(2, '0')}`;
};
const label = (d) => d.charAt(0).toUpperCase() + d.slice(1);

// The site's hours line. Mirrors rules.hours_line on the server (the server is the source of truth).
export function hoursLine(hours) {
  const groups = [];
  DAYS.forEach((d, i) => {
    const h = hours && hours[d];
    if (!h) return;
    const key = `${h.open}-${h.close}`;
    const g = groups.at(-1);
    if (g && g.key === key && g.last === DAYS[i - 1]) g.last = d;
    else groups.push({ first: d, last: d, key, h });
  });
  if (!groups.length) return 'Closed';
  return 'Open ' + groups.map((g) => `${g.first === g.last ? label(g.first) : `${label(g.first)}–${label(g.last)}`} ${short(g.h.open)}–${short(g.h.close)}`).join(' · ');
}

export function cleanHours(h) {
  const out = {};
  for (const d of DAYS) out[d] = h && h[d] && h[d].open ? { open: h[d].open, close: h[d].close } : null;
  return out;
}

// Day popup values -> stored day value.
export function dayChoice({ state, open, close }) { return state === 'closed' ? null : { open, close }; }

export function dayText(h) { return h ? `${formatTime(h.open)} – ${formatTime(h.close)}` : 'Closed'; }

// ---- suggested banner end ----

const LOOKAHEAD_DAYS = 14;

// First time the office opens strictly after `afterMs`: weekly hours, skipping all-day closings.
// An early-close day still opens that morning. null if nothing opens within 60 days.
export function nextOpening(afterMs, hours, closings) {
  const byDate = new Map((closings || []).map((c) => [c.date, c]));
  let d = utcToCentral(afterMs).date;
  for (let i = 0; i < 60; i++, d = addDays(d, 1)) {
    const h = hours && hours[weekdayOf(d)];
    const c = byDate.get(d);
    if (!h || (c && c.allDay !== false)) continue;
    const open = Date.parse(centralToUtc(d, (c && c.openAt) || h.open)); // a late opening counts from its time
    if (open > afterMs) return new Date(open);
  }
  return null;
}

// When a banner should end. holiday: when we reopen after the closing period (closingDates, or the
// first closing within two weeks of `start`); weather: 11:59 PM today; notice: no suggestion.
export function suggestBannerEnd({ type, closingDates = null, hours, closings = [], now = Date.now(), start = null }) {
  if (type === 'weather') return new Date(centralToUtc(todayCentral(now), '23:59'));
  if (type !== 'holiday') return null;
  const byDate = new Map((closings || []).map((c) => [c.date, c]));
  let last;
  if (closingDates && closingDates.length) last = [...closingDates].sort().at(-1);
  else {
    const from = todayCentral(start ?? now);
    const limit = addDays(from, LOOKAHEAD_DAYS);
    const next = (closings || []).map((c) => c.date).filter((d) => d >= from && d <= limit).sort()[0];
    if (!next) return null;
    last = next; // nextOpening skips the all-day closings that follow it
  }
  const c = byDate.get(last);
  const closesAt = c && c.allDay === false && c.closeAt ? c.closeAt : '00:00';
  return nextOpening(Date.parse(centralToUtc(last, closesAt)), hours, closings);
}

// The closing period a holiday banner is about: the first closing within two weeks of `start`,
// extended through following closings (stepping over normally-closed days such as weekends).
export function closingRun(closings, hours, start = Date.now()) {
  const byDate = new Map((closings || []).map((c) => [c.date, c]));
  const from = todayCentral(start);
  const limit = addDays(from, LOOKAHEAD_DAYS);
  const first = [...byDate.keys()].filter((d) => d >= from && d <= limit).sort()[0];
  if (!first) return [];
  const run = [first];
  let probe = addDays(first, 1);
  for (let i = 0; i < LOOKAHEAD_DAYS; i++, probe = addDays(probe, 1)) {
    if (byDate.has(probe)) { run.push(probe); continue; }
    if (hours && !hours[weekdayOf(probe)]) continue; // weekend etc.
    break;
  }
  return run;
}

// End-time choices for a banner. holiday: lastDay (default: 11:59 PM of the closing's last day)
// and reopen (one-tap alternative); weather: today (11:59 PM, alternative to "until I turn it off").
export function bannerEnds({ type, closingDates = null, hours, closings = [], now = Date.now(), start = null }) {
  const out = { lastDay: null, reopen: null, today: null };
  if (type === 'weather') { out.today = new Date(centralToUtc(todayCentral(now), '23:59')); return out; }
  if (type !== 'holiday') return out;
  const dates = closingDates && closingDates.length ? closingDates : closingRun(closings, hours, start ?? now);
  if (!dates.length) return out;
  out.lastDay = endOfLastDay(dates);
  out.reopen = suggestBannerEnd({ type, closingDates: dates, hours, closings, now, start });
  return out;
}

// ---- reorder ----

// One step up (dir -1) or down (+1). Always a new array; at an edge it's an unchanged copy.
export function moveItem(list, i, dir) {
  const out = [...(list || [])];
  const j = i + dir;
  if (i < 0 || i >= out.length || j < 0 || j >= out.length) return out;
  [out[i], out[j]] = [out[j], out[i]];
  return out;
}

// ---- insurance ----

const str = (v) => (typeof v === 'string' ? v : '');
const lines = (t) => str(t).replace(/\r\n?/g, '\n');

// Stored insurance -> editable copy: every text field a string, no version/meta (a deep copy).
export function cleanInsurance(ins) {
  const i = ins && typeof ins === 'object' ? ins : {};
  return {
    intro: str(i.intro),
    groups: (Array.isArray(i.groups) ? i.groups : []).filter((g) => g && typeof g === 'object').map((g) => ({
      name: str(g.name), hint: str(g.hint), note: str(g.note),
      plans: (Array.isArray(g.plans) ? g.plans : []).filter((p) => typeof p === 'string'),
    })),
    boxes: (Array.isArray(i.boxes) ? i.boxes : []).filter((b) => b && typeof b === 'object').map((b) => ({
      title: str(b.title), style: b.style === 'why' ? 'why' : 'note', text: str(b.text),
    })),
  };
}

// Box text as stored: lines trimmed, no trailing blank lines, \n only.
function cleanBoxText(t) { return lines(t).split('\n').map((l) => l.trim()).join('\n').trim(); }

// Editable copy -> { item (the stored shape, one PUT), errors, warnings }. Blank plans are dropped.
// A group with no plans is allowed (as on the server) but warned about.
export function formToInsurance(w) {
  const errors = [], warnings = [];
  const c = cleanInsurance(w);
  const groups = c.groups.map((g, n) => {
    const name = g.name.trim();
    const plans = g.plans.map((p) => p.trim()).filter(Boolean);
    if (!name) errors.push(`Group ${n + 1} needs a name`);
    else if (!plans.length) warnings.push(`${name} has no plans yet`);
    const out = { name };
    if (g.hint.trim()) out.hint = g.hint.trim();
    out.plans = plans;
    if (g.note.trim()) out.note = g.note.trim();
    return out;
  });
  if (!groups.length) errors.push('Add at least one group');
  if (errors.length) return { item: null, errors, warnings };
  const boxes = c.boxes.map((b) => ({ title: b.title.trim(), style: b.style, text: cleanBoxText(b.text) }));
  return { item: { intro: c.intro.trim(), groups, boxes }, errors, warnings };
}

// Would these two save the same thing? (whitespace and blank plans don't count)
export function sameInsurance(a, b) {
  const norm = (w) => {
    const c = cleanInsurance(w);
    return JSON.stringify({
      intro: c.intro.trim(),
      groups: c.groups.map((g) => [g.name.trim(), g.hint.trim(), g.note.trim(), g.plans.map((p) => p.trim()).filter(Boolean)]),
      boxes: c.boxes.map((x) => [x.title.trim(), x.style, cleanBoxText(x.text)]),
    });
  };
  return norm(a) === norm(b);
}

// "Some **bold** words" -> [{text, bold}] (same split as the website's inline()).
export function inlineParts(text) {
  return String(text ?? '').split(/\*\*(.+?)\*\*/).map((t, i) => ({ text: t, bold: i % 2 === 1 })).filter((p) => p.text);
}

// Box text -> blocks, the same way the website reads it: plain lines are paragraphs,
// lines starting "- " are bullets, a blank line ends a list.
export function boxBlocks(text) {
  const out = [];
  let ul = null;
  for (const raw of lines(text).split('\n')) {
    const line = raw.trim();
    if (!line) { ul = null; continue; }
    if (line.startsWith('- ')) {
      if (!ul) { ul = { type: 'ul', items: [] }; out.push(ul); }
      ul.items.push(inlineParts(line.slice(2)));
    } else {
      ul = null;
      out.push({ type: 'p', parts: inlineParts(line) });
    }
  }
  return out;
}

const partsText = (parts) => parts.map((p) => (p.bold ? `**${p.text}**` : p.text)).join('');

// Blocks -> box text (inverse of boxBlocks for stored text).
export function blocksToText(blocks) {
  const out = [];
  (blocks || []).forEach((b, i) => {
    if (b.type === 'ul') {
      if (i > 0 && blocks[i - 1].type === 'ul') out.push(''); // keep two lists apart
      for (const it of b.items) out.push('- ' + partsText(it));
    } else out.push(partsText(b.parts));
  });
  return out.join('\n');
}

// ---- jobs ----

export function emptyJobForm() { return { position: '', hours: '', details: '', v: '' }; }

export function jobToForm(j) {
  return { position: str(j.position), hours: str(j.hours), details: str(j.details), v: String(j.version ?? '') };
}

// Only the fields the API stores for a job.
export function jobItem(j) {
  return { id: j.id, position: str(j.position), hours: str(j.hours), details: str(j.details), show: j.show === true };
}

// Editor values -> { item, errors }. `show` comes from the list switch (its one edit path).
export function formToJob(v, { id, show = false }) {
  const position = str(v.position).trim();
  if (!position) return { item: null, errors: ['Write the position'] };
  return { item: { id, position, hours: str(v.hours).trim(), details: lines(v.details).trim(), show: !!show }, errors: [] };
}

export function jobSwitchItem(j, show) { return { ...jobItem(j), show: !!show }; }

// On the website first, then by position (A-Z, any case).
export function sortJobs(jobs) {
  return [...(jobs || [])].sort((a, b) => (b.show === true) - (a.show === true)
    || str(a.position).localeCompare(str(b.position), 'en', { sensitivity: 'base' }) || str(a.id).localeCompare(str(b.id)));
}

// What the website shows, in feed order (server: feed.py keeps jobs with show; site needs a position).
export function shownJobs(jobs) { return (jobs || []).filter((j) => j && j.show === true && str(j.position).trim()); }

// ---- applications ----
// Applicant data (names, contact, answers, notes) is shown with textContent only and never goes
// into the page URL, logs or localStorage. The hash carries only the application id.

// In list order (mirrors applications.STATUSES). "Keep for later" = good people to call for the next opening.
export const APP_STATUSES = ['New', 'Reviewed', 'Contacted', 'Interviewed', 'Keep for later', 'Job offered', 'Job accepted', 'Job declined', 'Not a fit'];
export const APP_STEPS = APP_STATUSES.slice(0, 4);     // the progress line (applications.STEPS)
export const APP_OUTCOMES = APP_STATUSES.slice(4);
// "19185338616" -> "(918) 533-8616"; anything that isn't a 10-digit US number stays as typed
export function phoneText(phone) {
  const d = String(phone || '').replace(/\D/g, '').replace(/^1(?=\d{10}$)/, '');
  return d.length === 10 ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` : String(phone || '');
}
// when a note was written: "Mon, Nov 23, 2:10 PM" (Central)
export function noteWhen(iso, now = Date.now()) {
  const c = utcToCentral(iso);
  return c ? `${formatDate(c.date, now)}, ${formatTime(c.time)}` : '';
}
const PAY_STATUSES = ['Job offered', 'Job accepted', 'Job declined'];
const TOLD_STATUSES = ['Keep for later', 'Job declined', 'Not a fit'];
export const showsPay = (status) => PAY_STATUSES.includes(status);    // pay shows next to the status for these
export const showsTold = (status) => TOLD_STATUSES.includes(status);  // the "We let them know" box
export function payText(pay) { return typeof pay === 'number' && pay > 0 ? `$${pay.toFixed(2)}/hr` : ''; }
// Who wrote a note: the admin's friendly name (config.adminNames), else the part of the email before @.
export function noteAuthor(n, names = {}) {
  if (!n || !n.by) return 'Earlier notes';
  const known = knownName(n.by, names);
  if (known) return known;
  const local = String(n.by).split('@')[0];
  return local.charAt(0).toUpperCase() + local.slice(1);
}
// Only the writer may edit or delete a note (the old "earlier notes": anyone). The server checks too.
export const canChangeNote = (n, me) => !!n && (!n.by || String(n.by).toLowerCase() === String(me || '').toLowerCase());

export function countNew(items) { return (items || []).filter((a) => a && a.status === 'New').length; }

// Mirrors applications.sort_applications: status order, newest first within each.
export function sortApplications(items) {
  const rank = (s) => { const i = APP_STATUSES.indexOf(s); return i === -1 ? APP_STATUSES.length : i; };
  return [...(items || [])].sort((a, b) => rank(a.status) - rank(b.status) || str(b.createdAt).localeCompare(str(a.createdAt)));
}

// Client-side filters over the loaded list: position, status, name search (any case).
export function filterApplications(items, { position = '', status = '', q = '' } = {}) {
  const needle = str(q).trim().toLowerCase();
  return (items || []).filter((a) => (!position || a.position === position) && (!status || a.status === status)
    && (!needle || str(a.name).toLowerCase().includes(needle)));
}

export function applicationPositions(items) {
  return [...new Set((items || []).map((a) => str(a.position).trim()).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' }));
}

// createdAt (UTC) -> 'Wed, Nov 25' on the Central calendar.
export function applicationDate(createdAt, now = Date.now()) {
  const c = utcToCentral(createdAt);
  return c ? formatDate(c.date, now) : '';
}

export function telHref(phone) {
  const s = str(phone).trim();
  const digits = s.replace(/\D/g, '');
  if (digits.length < 7) return null;
  return 'tel:' + (s.startsWith('+') ? '+' : '') + digits;
}

export function mailtoHref(email) {
  const m = /^([^@\s]+)@([^@\s]+\.[^@\s]+)$/.exec(str(email).trim());
  return m ? `mailto:${encodeURIComponent(m[1])}@${encodeURIComponent(m[2])}` : null;
}

export function experienceText(v) { return v === 'yes' ? 'Yes' : v === 'no' ? 'No' : 'Not answered'; }

// ---- change log / recently removed ----

const DAY = 86400e3;
const centralDayNumber = (ymd) => Date.parse(ymd + 'T00:00:00Z') / DAY;

// { relative: '5 minutes ago' | 'yesterday' | '3 days ago' | 'Sun, Nov 1', absolute: 'Thu, Nov 19 · 8:00 AM' }
// Older than ~a day counts Central calendar days.
export function changeWhen(at, now = Date.now()) {
  const t = Date.parse(at);
  const c = utcToCentral(t);
  if (!c) return { relative: '', absolute: '' };
  const absolute = formatWhen(at, now);
  const s = Math.max(0, (now - t) / 1000);
  let relative;
  if (s < 45) relative = 'just now';
  else if (s < 90) relative = 'a minute ago';
  else if (s < 45 * 60) relative = `${Math.round(s / 60)} minutes ago`;
  else if (s < 90 * 60) relative = 'an hour ago';
  else if (s < 22 * 3600) relative = `${Math.round(s / 3600)} hours ago`;
  else {
    const days = centralDayNumber(todayCentral(now)) - centralDayNumber(c.date);
    relative = days <= 1 ? 'yesterday' : days <= 6 ? `${days} days ago` : formatDate(c.date, now);
  }
  return { relative, absolute };
}

// Application entries carry no data (applicant privacy), so the server refuses to undo them.
export function isUndoable(c) {
  return !!(c && c.id && c.area !== 'application' && (c.before != null || c.after != null));
}

// Ids contain '#' and ':' (e.g. 2026-11-19T15:00:00.000000Z#a1b2c3); always encode.
export const undoPath = (id) => `/admin/changes/${encodeURIComponent(id)}/undo`;
export const restorePath = (id) => `/admin/removed/${encodeURIComponent(id)}/restore`;

const REMOVED_DAYS = 30;
// The Central date a removed item is deleted for good (DynamoDB TTL expiresAt, epoch seconds).
export function purgeDate(r, now = Date.now()) {
  const exp = r && Number.isFinite(r.expiresAt) ? r.expiresAt * 1000
    : r && Number.isFinite(Date.parse(r.removedAt)) ? Date.parse(r.removedAt) + REMOVED_DAYS * DAY : NaN;
  const c = utcToCentral(exp);
  return c ? formatDate(c.date, now) : '';
}

const AREA_NAMES = { banner: 'Banner', closing: 'Closing', job: 'Job', holiday: 'Holiday', application: 'Application', hours: 'Hours', insurance: 'Insurance' };
const singular = (area) => ({ banners: 'banner', closings: 'closing', jobs: 'job', holidays: 'holiday', applications: 'application' }[area] || str(area));

export function removedLabel(r, now = Date.now()) {
  const area = singular(r && r.area);
  const it = (r && r.item) || {};
  const what = area === 'banner' ? str(it.message)
    : area === 'job' ? str(it.position)
      : area === 'closing' ? formatDate(it.date || r.key, now)
        : area === 'holiday' ? str(it.name)
          : area === 'application' ? [str(it.name), str(it.position)].filter(Boolean).join(' · ')
            : '';
  return AREA_NAMES[area] ? `${AREA_NAMES[area]}: ${what}`.trim() : `${area} ${str(r && r.key)}`.trim();
}

// The presigned résumé link: https only (never http, javascript:, data: …), else null.
export function safeResumeUrl(url) {
  return typeof url === 'string' && /^https:\/\/[^\s]+$/.test(url) ? url : null;
}

export function restoreConflictText(area) {
  const a = singular(area);
  if (a === 'closing') return "There's already a closing on that date — remove or change it first.";
  if (a === 'application') return 'That application is already back in the list.';
  return `There's already ${/^[aeiou]/.test(a) ? 'an' : 'a'} ${a} with that name — remove or rename it first.`;
}

// ---- change log: short pages ----

// A staff editor's pages can come back short or empty (other areas are filtered out on the server)
// while `next` is still set: keep asking until there are `min` rows or no more pages.
// fetchPage(before) -> {items, next}. At most `maxPages` requests per call; Load more continues.
export async function fillChanges(fetchPage, { before = null, min = 20, maxPages = 10 } = {}) {
  let items = [];
  let next = before;
  for (let i = 0; i < maxPages; i++) {
    const r = (await fetchPage(next)) || {};
    items = items.concat(r.items || []);
    next = r.next || null;
    if (!next || items.length >= min) break;
  }
  return { items, next };
}

// ---- holiday question (#holiday/<id>/<YYYY-MM-DD>?remind=holiday:<key>) ----

// Same key as the server's reminders.py: holiday#<id>#<year>.
export const holidayKey = (id, date) => `holiday#${id}#${String(date).slice(0, 4)}`;
export const holidayAnswerPath = (key) => `/admin/reminders/holiday/${encodeURIComponent(key)}/answer`;

// Route parts + query -> {id, date, key}, or null when the link is broken.
export function holidayRoute(parts, query = {}) {
  const [id, date] = parts || [];
  if (!id || !/^[A-Za-z0-9_-]{1,64}$/.test(id) || !/^\d{4}-\d{2}-\d{2}$/.test(date || '')) return null;
  const key = holidayKey(id, date);
  const remind = String((query && query.remind) || '');
  // The notification carries the key; use it only when it names this holiday and the date's year, or the
  // year before (a "+N" rule like fixed:12-31+1 is asked under last year's key for Jan 1).
  const y = Number(String(date).slice(0, 4));
  const ok = [key, `holiday#${id}#${y - 1}`].map((k) => `holiday:${k}`);
  return { id, date, key: ok.includes(remind) ? remind.slice(8) : key };
}

// 'Thu, Nov 26' — no year, like the notification text.
const dayLabel = (ymd) => formatDate(ymd, Date.parse(`${ymd}T12:00:00Z`));
export function holidayQuestion(name, date) {
  return `Are we open on ${String(name || 'this holiday').trim()} (${dayLabel(date)})?`;
}

const toMin = (t) => { const [a, b] = String(t).split(':').map(Number); return a * 60 + b; };
const toHm = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

// Early-close choices: 15-minute steps strictly inside that day's normal hours (server rule).
export function earlyCloseTimes(normal) {
  if (!normal || !normal.open || !normal.close) return [];
  const from = toMin(normal.open) + 15, to = toMin(normal.close) - 15;
  if (to < from) return [];
  return timeOptions({ from: toHm(Math.ceil(from / 15) * 15), to: toHm(to) });
}

export const HOLIDAY_ANSWER_TEXT = { open: 'Open — normal hours', closed: 'Closed all day', early: 'Open, closing early' };

// Body for POST /admin/reminders/holiday/<key>/answer. reason defaults to the holiday name.
export function holidayAnswerBody(answer, { closeAt = null, reason = '', name = '' } = {}) {
  if (answer === 'open') return { answer };
  const r = (String(reason || '').trim() || String(name || '').trim()).slice(0, REASON_MAX).trim();
  const body = { answer };
  if (answer === 'early') body.closeAt = closeAt;
  body.reason = r;
  return body;
}

// The server returns the FIRST answer when the question was already answered. A closed/early
// answer that this call recorded also returns the closing it added.
export function holidayOutcome(sent, res) {
  const answer = (res && res.answer) || sent;
  const recordedNow = answer === sent && !(res && res.answeredAt) && (sent === 'open' || Array.isArray(res && res.closings));
  return { already: !recordedNow, answer };
}

// Link to Banners -> New, prefilled for the closing a holiday answer added (holiday type, ends at the
// end of that day, like the closing screen's default).
export function holidayBannerHash({ date, allDay, closeAt = null, reason = '' }, { hours, closings = [], now = Date.now() } = {}) {
  const day = allDay ? { date, allDay: true } : { date, allDay: false, closeAt };
  const message = closingBannerMessage([day], { reason }, now);
  const ends = bannerEnds({ type: 'holiday', closingDates: [date], hours, closings, now });
  const q = new URLSearchParams({ type: 'holiday', message });
  if (ends.lastDay) q.set('endsAt', ends.lastDay.toISOString());
  return `#banners/new?${q.toString()}`;
}

// #banners/new?type=&message=&endsAt= -> banner editor values (starts now), or null.
export function bannerPrefill(query = {}) {
  const message = typeof query.message === 'string' ? query.message.slice(0, 1000) : '';
  if (!message.trim()) return null;
  const f = { ...emptyBannerForm(), type: BANNER_TYPES.some((t) => t.id === query.type) ? query.type : 'notice', message };
  const e = query.endsAt ? utcToCentral(query.endsAt) : null;
  if (e) Object.assign(f, { end: 'at', endDate: e.date, endTime: e.time });
  return f;
}

// "Open — normal hours" can't be undone on the server, so it asks first.
export function holidayOpenConfirm(date) {
  return `Open normal hours on ${dayLabel(date)}? Nothing on the website changes.`;
}

// "Dr. Walls answered: Closed all day". displayName: api.displayName (adminNames, else the email name).
export function answeredText(by, label, displayName) {
  return `${displayName(by || null)} answered: ${label}`;
}

// ---- reminder answers on Jobs / Banners (#jobs/<id>?remind=hiring:<key>, #banners/<id>?remind=weather:<key>) ----

export const REMIND_CHOICES = {
  hiring: [{ answer: 'still', label: 'Still hiring' }, { answer: 'takedown', label: 'Take it down' }],
  weather: [{ answer: 'end', label: 'End it' }, { answer: 'keep', label: 'Keep it up' }],
  bannerEnd: [{ answer: 'ok', label: 'OK' }],
};
export const remindKind = (key) => String(key || '').split('#')[0];
export const remindAnswerPath = (kind, key) => `/admin/reminders/${encodeURIComponent(kind)}/${encodeURIComponent(key)}/answer`;
export const remindLabel = (kind, answer) => ((REMIND_CHOICES[kind] || []).find((c) => c.answer === answer) || {}).label || String(answer || '');

// The reminder key in ?remind=<kind>:<key>, only when it is one of `kinds` and names item `id`; else null.
export function remindFor(query, kinds, id) {
  const raw = String((query && query.remind) || '');
  const i = raw.indexOf(':');
  if (i < 1) return null;
  const kind = raw.slice(0, i), key = raw.slice(i + 1);
  const allowed = Array.isArray(kinds) ? kinds : [kinds];
  if (!allowed.includes(kind) || !REMIND_CHOICES[kind]) return null;
  const parts = key.split('#');
  if (parts[0] !== kind || parts[1] !== String(id) || key.length > 200) return null;
  return key;
}

// The server returns the FIRST answer, with answeredBy/answeredAt, when it was already answered.
export function remindOutcome(sent, res) {
  const answer = (res && res.answer) || sent;
  const already = !!(res && res.answeredAt) || answer !== sent;
  return { already, answer, by: already ? (res && res.answeredBy) || null : null };
}

// ---- holidays list (Reminders screen): rules exactly as rules.py holiday_date ----
// fixed:MM-DD | nth:N:dow:M | last:dow:M | easter:<-60..60>, any of them + "+N" (N 0..60, adds up).

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MONTH_DAYS = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const ORD = ['1st', '2nd', '3rd', '4th', '5th'];
export const HOLIDAY_RULE_TYPES = [
  { id: 'fixed', label: 'Same date every year' },
  { id: 'nth', label: 'A weekday of the month (like 4th Thursday)' },
  { id: 'last', label: 'Last weekday of the month' },
  { id: 'easter', label: 'Based on Easter' },
];
export const MONTH_NAMES = MONTHS;
const MAX_OFFSET = 60;
const p2 = (n) => String(n).padStart(2, '0');

function parseBase(rule) {
  let m = /^fixed:(\d{2})-(\d{2})$/.exec(rule);
  if (m) {
    const month = Number(m[1]), day = Number(m[2]);
    if (month < 1 || month > 12 || day < 1 || day > MONTH_DAYS[month - 1] || (month === 2 && day === 29)) return null;
    return { type: 'fixed', month, day };
  }
  m = /^nth:([1-5]):(mon|tue|wed|thu|fri|sat|sun):(\d{1,2})$/.exec(rule);
  if (m && Number(m[3]) >= 1 && Number(m[3]) <= 12) return { type: 'nth', n: Number(m[1]), dow: m[2], month: Number(m[3]) };
  m = /^last:(mon|tue|wed|thu|fri|sat|sun):(\d{1,2})$/.exec(rule);
  if (m && Number(m[2]) >= 1 && Number(m[2]) <= 12) return { type: 'last', dow: m[1], month: Number(m[2]) };
  m = /^easter:(-?\d{1,2})$/.exec(rule);
  if (m && Math.abs(Number(m[1])) <= MAX_OFFSET) return { type: 'easter', offset: Number(m[1]) };
  return null;
}

// rule -> form {type, month, day, n, dow, offset, plus}, or null when it isn't a rule the server takes.
export function parseHolidayRule(rule) {
  if (typeof rule !== 'string') return null;
  let plus = 0, base = rule;
  for (let m; (m = /^(.+)\+(\d{1,2})$/.exec(base));) {
    if (Number(m[2]) > MAX_OFFSET) return null;
    plus += Number(m[2]);
    base = m[1];
  }
  if (plus > MAX_OFFSET) return null;
  const b = parseBase(base);
  if (!b) return null;
  return { type: b.type, month: b.month ?? 1, day: b.day ?? 1, n: b.n ?? 1, dow: b.dow ?? 'mon', offset: b.offset ?? 0, plus };
}

export function holidayRuleString(f) {
  const t = f.type;
  const base = t === 'fixed' ? `fixed:${p2(f.month)}-${p2(f.day)}`
    : t === 'nth' ? `nth:${f.n}:${f.dow}:${Number(f.month)}`
    : t === 'last' ? `last:${f.dow}:${Number(f.month)}`
    : `easter:${Number(f.offset)}`;
  return Number(f.plus) ? `${base}+${Number(f.plus)}` : base;
}

export function holidayFormErrors(f) {
  const errors = [];
  const int = (v) => Number.isInteger(Number(v)) && String(v).trim() !== '';
  if (!HOLIDAY_RULE_TYPES.some((x) => x.id === f.type)) return ['Choose how the date is set'];
  if (f.type !== 'easter' && !(int(f.month) && f.month >= 1 && f.month <= 12)) errors.push('Choose a month');
  if (f.type === 'fixed' && !errors.length) {
    const max = MONTH_DAYS[f.month - 1];
    if (Number(f.month) === 2 && Number(f.day) === 29) errors.push('Choose a date that happens every year (not Feb 29)');
    else if (!(int(f.day) && f.day >= 1 && f.day <= max)) errors.push(`${MONTHS[f.month - 1]} has only ${max === 29 ? 28 : max} days`);
  }
  if (f.type === 'nth' && !(int(f.n) && f.n >= 1 && f.n <= 4)) errors.push('Choose 1st to 4th (or use Last)');
  if ((f.type === 'nth' || f.type === 'last') && !DAYS.includes(f.dow)) errors.push('Choose a weekday');
  if (f.type === 'easter' && !(int(f.offset) && Math.abs(f.offset) <= MAX_OFFSET)) errors.push('Days from Easter must be -60 to 60');
  if (!(int(f.plus || 0) && Number(f.plus || 0) >= 0 && Number(f.plus || 0) <= MAX_OFFSET)) errors.push('Days after must be 0 to 60');
  return errors;
}

function easterYmd(year) { // Anonymous Gregorian computus (rules.easter)
  const a = year % 19, b = Math.floor(year / 100), c = year % 100, d = Math.floor(b / 4), e = b % 4;
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const x = h + l - 7 * m + 114;
  return `${year}-${p2(Math.floor(x / 31))}-${p2((x % 31) + 1)}`;
}
const dowIndex = (ymd) => DAYS.indexOf(weekdayOf(ymd)); // mon = 0

// 'YYYY-MM-DD' for that year (the "+N" may roll into the next year), or null for a bad rule.
export function holidayDateFor(rule, year) {
  const f = parseHolidayRule(rule);
  if (!f) return null;
  let d;
  if (f.type === 'fixed') d = `${year}-${p2(f.month)}-${p2(f.day)}`;
  else if (f.type === 'easter') d = addDays(easterYmd(year), f.offset);
  else if (f.type === 'nth') {
    const first = `${year}-${p2(f.month)}-01`;
    d = addDays(first, ((DAYS.indexOf(f.dow) - dowIndex(first) + 7) % 7) + 7 * (f.n - 1));
    if (Number(d.slice(5, 7)) !== f.month) return null;
  } else {
    const last = addDays(`${f.month === 12 ? year + 1 : year}-${p2(f.month === 12 ? 1 : f.month + 1)}-01`, -1);
    d = addDays(last, -((dowIndex(last) - DAYS.indexOf(f.dow) + 7) % 7));
  }
  return f.plus ? addDays(d, f.plus) : d;
}

// The next time it happens on or after `today` (Central 'YYYY-MM-DD').
// -> {date, year}: year is the rule-year that produced the date (the server's reminder key uses it).
export function nextHolidayOccurrence(rule, today) {
  const y = Number(String(today).slice(0, 4));
  for (const year of [y - 1, y, y + 1]) { // "+N" can carry last year's into January
    const d = holidayDateFor(rule, year);
    if (d && d >= today) return { date: d, year };
  }
  return null;
}
export function nextHolidayDate(rule, today) {
  const o = nextHolidayOccurrence(rule, today);
  return o ? o.date : null;
}

// The reminder key for this holiday on `date`: `fallback` when its year produces that date, else the
// date's year or the year before, whichever the rule produces; else `fallback` (the server validates).
export function holidayKeyFor(rule, id, date, fallback) {
  const yearOf = (k) => Number(String(k || '').split('#')[2]);
  const y = Number(String(date).slice(0, 4));
  for (const year of [yearOf(fallback), y, y - 1]) {
    if (Number.isInteger(year) && holidayDateFor(rule, year) === date) return `holiday#${id}#${year}`;
  }
  return fallback;
}

// Whether the edit form can show this rule as it is (n 1-4, a real every-year date, a known shape).
export function holidayRuleEditable(rule) {
  const f = parseHolidayRule(rule);
  return !!f && holidayFormErrors(f).length === 0;
}

export function holidayRuleText(rule) {
  const f = parseHolidayRule(rule);
  if (!f) return 'Rule not recognized';
  const days = (n) => `${n} day${n === 1 ? '' : 's'}`;
  const wd = DAY_NAMES[f.dow];
  let base;
  if (f.type === 'fixed') base = `${MONTHS[f.month - 1]} ${f.day}`;
  else if (f.type === 'nth') base = `${ORD[f.n - 1]} ${wd} of ${MONTHS[f.month - 1]}`;
  else if (f.type === 'last') base = `Last ${wd} of ${MONTHS[f.month - 1]}`;
  else {
    const o = f.offset + f.plus; // "easter:-2+1" reads as one offset
    return o === 0 ? 'Easter Sunday' : o < 0 ? `${days(-o)} before Easter` : `${days(o)} after Easter`;
  }
  if (f.plus) {
    const lower = f.type === 'nth' ? `the ${base}` : f.type === 'last' ? `the ${base.charAt(0).toLowerCase()}${base.slice(1)}` : base;
    return `${days(f.plus)} after ${lower}`;
  }
  return f.type === 'fixed' ? `${base} every year` : base;
}

// PUT /admin/holidays/<id> item (no version/meta fields).
export function holidayItem(h, changes = {}) {
  const x = { ...h, ...changes };
  return { id: x.id, name: String(x.name || '').trim(), rule: x.rule, on: x.on === true };
}

// Holidays coming up in `days` that the server will ask about (on, weekday, no closing that day).
export function upcomingHolidayQuestions(holidays, closings, today, { days = 30 } = {}) {
  const closed = new Set((closings || []).map((c) => c && c.date));
  const end = addDays(today, days);
  const out = [];
  for (const h of holidays || []) {
    if (!h || h.on !== true) continue;
    const o = nextHolidayOccurrence(h.rule, today);
    const d = o && o.date;
    if (!d || d > end || closed.has(d) || ['sat', 'sun'].includes(weekdayOf(d))) continue;
    const key = `holiday#${h.id}#${o.year}`;
    out.push({ id: h.id, name: String(h.name || '').trim(), date: d, year: o.year, key,
      hash: `#holiday/${encodeURIComponent(h.id)}/${d}?remind=holiday:${encodeURIComponent(key)}` });
  }
  return out.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

// ---- themes (dates the website's holiday characters show; Owner/Doctor) ----

export const themesPath = '/admin/themes/current';
export const THEME_MONTHS = MONTHS.map((label, i) => ({ value: String(i + 1).padStart(2, '0'), label }));
export const daysInMonth = (mm) => new Date(Date.UTC(2024, Number(mm), 0)).getUTCDate();   // leap year: Feb 29 allowed

// 'MM-DD' -> [month, day] or null (a real date in a leap year)
function md(s) {
  if (typeof s !== 'string' || !/^\d{2}-\d{2}$/.test(s)) return null;
  const m = Number(s.slice(0, 2)), d = Number(s.slice(3));
  return m >= 1 && m <= 12 && d >= 1 && d <= daysInMonth(m) ? [m, d] : null;
}
const cmp = (a, b) => a[0] - b[0] || a[1] - b[1];

export function mdLabel(s) { const v = md(s); return v ? `${MONTHS[v[0] - 1]} ${v[1]}` : ''; }

// Same rules as the server (rules._validate_themes).
export function themeErrors(holidays) {
  const errors = [], spans = [];
  for (const h of holidays || []) {
    const s = md(h.start), e = md(h.end);
    if (!s || !e) { errors.push(`${h.name}: pick a real start and end date`); continue; }
    if (cmp(e, s) < 0) { errors.push(`${h.name}: the end date must be on or after the start date (within one year)`); continue; }
    if (h.on) spans.push({ s, e, name: h.name });
  }
  spans.sort((a, b) => cmp(a.s, b.s));
  for (let i = 1; i < spans.length; i++) if (cmp(spans[i].s, spans[i - 1].e) <= 0) errors.push(`${spans[i - 1].name} and ${spans[i].name} overlap; change the dates or switch one off`);
  return errors;
}

// Is this holiday's theme showing on the website today? todayIso = Central 'YYYY-MM-DD'.
export function themeShowingNow(h, todayIso) {
  if (!h || !h.on) return false;
  const t = String(todayIso).slice(5);
  return h.start <= t && t <= h.end;
}
