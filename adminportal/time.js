// Central (America/Chicago) wall time <-> UTC ISO, plus the admin's display formats.
// Everything is shown and typed in Central; the API stores UTC ISO-8601.
const TZ = 'America/Chicago';
const DOW = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const DOW_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MON_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

let fmt = null;
function wall(ms) { // UTC ms -> Central wall clock parts
  fmt ||= new Intl.DateTimeFormat('en-US', {
    timeZone: TZ, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
  const p = {};
  for (const { type, value } of fmt.formatToParts(new Date(ms))) p[type] = +value;
  return p;
}
const pad = (n) => String(n).padStart(2, '0');
const ymdOf = (p) => `${p.year}-${pad(p.month)}-${pad(p.day)}`;

function offsetAt(ms) { // Central wall time minus UTC, in ms
  const p = wall(ms);
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - Math.floor(ms / 1000) * 1000;
}

function parseYmd(ymd) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(ymd || ''));
  if (!m) return null;
  const [y, mo, d] = [+m[1], +m[2], +m[3]];
  const t = Date.UTC(y, mo - 1, d);
  const back = new Date(t);
  return back.getUTCMonth() === mo - 1 && back.getUTCDate() === d ? { y, mo, d, t } : null;
}
function parseHm(hhmm) {
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(String(hhmm || ''));
  return m ? { h: +m[1], mi: +m[2] } : null;
}

// 'YYYY-MM-DD' + 'HH:MM' Central -> UTC ISO. A time skipped by spring-forward moves an hour
// later; a time repeated at fall-back uses the first (daylight) one. Bad input -> null.
export function centralToUtc(ymd, hhmm) {
  const d = parseYmd(ymd), t = parseHm(hhmm);
  if (!d || !t) return null;
  const target = Date.UTC(d.y, d.mo - 1, d.d, t.h, t.mi);
  const ok = (ms) => { const c = utcToCentral(ms); return c && c.date === ymd && c.time === hhmm; };
  const first = target - offsetAt(target);
  if (ok(first)) return new Date(first).toISOString();
  const second = target - offsetAt(first);
  if (ok(second)) return new Date(second).toISOString();
  return new Date(first).toISOString(); // nonexistent wall time (DST gap)
}

// UTC ISO (or ms) -> { date: 'YYYY-MM-DD', time: 'HH:MM' } in Central. Bad input -> null.
export function utcToCentral(iso) {
  const ms = typeof iso === 'number' ? iso : Date.parse(iso);
  if (!Number.isFinite(ms)) return null;
  const p = wall(ms);
  return { date: ymdOf(p), time: `${pad(p.hour)}:${pad(p.minute)}` };
}

export function todayCentral(now = Date.now()) { return utcToCentral(now).date; }

export function addDays(ymd, n) {
  const d = parseYmd(ymd);
  if (!d) return null;
  const x = new Date(d.t + n * 86400e3);
  return `${x.getUTCFullYear()}-${pad(x.getUTCMonth() + 1)}-${pad(x.getUTCDate())}`;
}

export function weekdayOf(ymd) { const d = parseYmd(ymd); return d ? DOW[new Date(d.t).getUTCDay()] : null; }

// Midnight Central at the end of a date (the start of the next day), as UTC ISO.
export function endOfDayUtc(ymd) { return centralToUtc(addDays(ymd, 1), '00:00'); }

// '17:00' -> '5:00 PM'
export function formatTime(hhmm) {
  const t = parseHm(hhmm);
  if (!t) return String(hhmm || '');
  return `${t.h % 12 || 12}:${pad(t.mi)} ${t.h < 12 ? 'AM' : 'PM'}`;
}

// '2026-11-25' -> 'Wed, Nov 25' (year added when it isn't this year in Central)
export function formatDate(ymd, now = Date.now()) {
  const d = parseYmd(ymd);
  if (!d) return String(ymd || '');
  const base = `${DOW_SHORT[new Date(d.t).getUTCDay()]}, ${MON_SHORT[d.mo - 1]} ${d.d}`;
  return String(d.y) === todayCentral(now).slice(0, 4) ? base : `${base}, ${d.y}`;
}

// UTC ISO -> 'Wed, Nov 25 · 12:00 PM'
export function formatWhen(iso, now = Date.now()) {
  const c = utcToCentral(iso);
  return c ? `${formatDate(c.date, now)} · ${formatTime(c.time)}` : '';
}

// 'HH:MM' choices in 15-minute steps; `keep` adds a saved off-step value in order.
export function timeOptions({ from = '00:00', to = '23:45', step = 15, keep = null } = {}) {
  const a = parseHm(from), b = parseHm(to);
  const out = [];
  for (let m = a.h * 60 + a.mi; m <= b.h * 60 + b.mi; m += step) out.push(`${pad(Math.floor(m / 60))}:${pad(m % 60)}`);
  if (keep && parseHm(keep) && !out.includes(keep)) { out.push(keep); out.sort(); }
  return out;
}

// Inclusive list of dates from..to; [] when either is missing or to < from.
export function expandRange(from, to) {
  const a = parseYmd(from), b = parseYmd(to);
  if (!a || !b || b.t < a.t) return [];
  const out = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

// The next 15-minute mark strictly after `now`, as Central {date, time}; rolls into tomorrow near midnight.
export function nextQuarter(now = Date.now()) {
  const q = 15 * 60e3;
  return utcToCentral((Math.floor(now / q) + 1) * q);
}
