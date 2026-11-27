/*
  Office hours, banner, closings, jobs and insurance — the ONE reader of the admin feed.
  Used by the homepage and after-hours.html.

  Source: site-content.json "feedUrl" (the admin portal's GET /site), with a 2-second timeout.
  If the feed is blank, slow, down or malformed, the built-in copy in site-content.json "fallback"
  (same shape, refreshed by scripts/snapshot-content.py at publish time) is used instead.
  Hours or insurance that don't look right in the feed are taken from the fallback, and if
  site-content.json itself can't be read, the regular weekly hours below (DEFAULT) are used.

  Open/closed: weekly hours from the feed, minus closings (all-day or early close),
  minus any day with a live Weather banner. All times are Central (America/Chicago).
  Testing: add ?test=open or ?test=closed to the page address.
*/
(function () {
  var FEED_TIMEOUT_MS = 2000;
  var DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  // Last resort when site-content.json itself can't be read: regular weekly hours, nothing else.
  var DEFAULT = {
    hours: { mon: { open: '08:30', close: '17:00' }, tue: { open: '08:30', close: '17:00' },
             wed: { open: '08:30', close: '17:00' }, thu: { open: '08:30', close: '17:00' },
             fri: { open: '08:30', close: '16:00' }, sat: null, sun: null },
    hoursLine: 'Open Mon–Thu 8:30–5 · Fri 8:30–4',
    banner: null, closings: [], jobs: [], insurance: null
  };

  function central() { return new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Chicago' })); }
  function ymd(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function mins(hhmm) {   // "08:30" -> 510, else null
    var m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm || '').trim());
    return m ? +m[1] * 60 + +m[2] : null;
  }

  function looksLikeFeed(f) { return !!f && typeof f === 'object' && !!f.hours && typeof f.hours === 'object'; }
  // At least one day with a real open < close
  function validHours(h) {
    return !!h && typeof h === 'object' && DAY_KEYS.some(function (k) {
      var o = h[k] && mins(h[k].open), c = h[k] && mins(h[k].close);
      return o != null && c != null && c > o;
    });
  }
  function validInsurance(ins) { return !!ins && Array.isArray(ins.groups) && ins.groups.length > 0; }
  // Meet the doctors: at least one doctor with a name (the admin feed lists only the ones shown on the site)
  function validDoctors(list) { return Array.isArray(list) && list.length > 0 && list.every(function (d) { return d && typeof d.name === 'string' && d.name.trim(); }); }

  // Resolves with the feed, or rejects after FEED_TIMEOUT_MS / on any error.
  function getFeed(url) {
    return new Promise(function (resolve, reject) {
      var ctl = typeof AbortController === 'function' ? new AbortController() : null;
      var timer = setTimeout(function () { if (ctl) ctl.abort(); reject(new Error('timeout')); }, FEED_TIMEOUT_MS);
      fetch(url, ctl ? { signal: ctl.signal } : undefined)
        .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
        .then(function (f) { if (!looksLikeFeed(f)) throw new Error('bad feed'); resolve(f); })
        .catch(reject)
        .then(function () { clearTimeout(timer); });
    });
  }

  // A banner is live until its endsAt (the feed already drops old ones; the fallback is a snapshot).
  function liveBanner(b) {
    if (!b || !b.message) return null;
    if (b.endsAt && Date.parse(b.endsAt) <= Date.now()) return null;
    var out = { type: String(b.type || 'notice').toLowerCase(), message: b.message, endsAt: b.endsAt || null };
    if (out.type === 'weather') out.weather = b.weather === 'ice' ? 'ice' : 'snow';   // snow or ice characters
    return out;
  }

  // The last content this phone saw (public hours / banner / jobs only), so the next visit can paint the
  // banner and the hiring card at once instead of popping them in after the download. Two weeks max.
  var CACHE_KEY = 'eaom-last-content', CACHE_MAX_MS = 14 * 864e5;
  // A first visit (nothing saved yet) paints from the copy built into the page (scripts/snapshot-content.py), so the
  // banner doesn't pop in after the download and push the page down.
  function readSeed() {
    try {
      var el = document.getElementById('eaom-seed'), c = el && JSON.parse(el.textContent || 'null');
      return c && validHours(c.hours) ? Object.assign({ at: Date.now() }, c) : null;
    } catch (e) { return null; }
  }
  function readCache() {
    try {
      var c = null;
      try { c = JSON.parse(window.localStorage.getItem(CACHE_KEY) || 'null'); } catch (e) { c = null; }
      if (!c || !validHours(c.hours) || !(Date.now() - c.at < CACHE_MAX_MS)) c = readSeed();
      if (!c) return null;
      return { hours: c.hours, hoursLine: c.hoursLine || '', banner: liveBanner(c.banner), closings: c.closings || [], jobs: c.jobs || [],
               doctors: validDoctors(c.doctors) ? c.doctors : null, themes: Array.isArray(c.themes) ? c.themes : null };
    } catch (e) { return null; }
  }
  function writeCache(info) {
    try {
      window.localStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), hours: info.hours, hoursLine: info.hoursLine,
        banner: info.banner, closings: info.closings, jobs: info.jobs, doctors: info.doctors, themes: info.themes }));
    } catch (e) { /* private mode: no head start next time */ }
  }

  var ready = fetch('site-content.json', { cache: 'no-store' })
    .then(function (r) { return r.json(); })
    .catch(function () { return {}; })
    .then(function (cfg) {
      cfg = cfg || {};
      var fallback = looksLikeFeed(cfg.fallback) ? cfg.fallback : DEFAULT;
      if (!validHours(fallback.hours)) fallback = Object.assign({}, fallback, { hours: DEFAULT.hours, hoursLine: DEFAULT.hoursLine });
      var got = cfg.feedUrl
        ? getFeed(cfg.feedUrl).then(function (f) { return { data: f, source: 'feed' }; },
                                     function () { return { data: fallback, source: 'fallback' }; })
        : Promise.resolve({ data: fallback, source: 'fallback' });
      return got.then(function (g) {
        var d = g.data, banner = liveBanner(d.banner);
        // Per field: a feed with broken hours or insurance borrows that part from the fallback
        var hoursOk = validHours(d.hours);
        return {
          cfg: cfg,
          source: g.source,
          hours: hoursOk ? d.hours : fallback.hours,
          hoursLine: (hoursOk ? d.hoursLine : fallback.hoursLine) || '',
          banner: banner,
          closings: d.closings || [],
          jobs: d.jobs || [],
          insurance: validInsurance(d.insurance) ? d.insurance : (validInsurance(fallback.insurance) ? fallback.insurance : null),
          doctors: validDoctors(d.doctors) ? d.doctors : (validDoctors(fallback.doctors) ? fallback.doctors : null),
          themes: Array.isArray(d.themes) ? d.themes : (Array.isArray(fallback.themes) ? fallback.themes : null),   // holiday character dates
          weatherClosedToday: !!banner && banner.type === 'weather'
        };
      });
    })
    .then(function (info) { writeCache(info); return withReopen(preview(info)); });

  // Preview links show that day's whole picture, not today's real notes: ?weather=snow|ice = closed today with a
  // weather banner; ?holiday=christmas|preview = no real banner or closings (e.g. Thanksgiving's). Never cached.
  function previewKind() {
    var s = typeof location !== 'undefined' ? location.search : '', w = /[?&]weather=(snow|ice)\b/.exec(s);
    return w ? w[1] : /[?&]holiday=(christmas|preview)\b/.test(s) ? 'holiday' : null;
  }
  function preview(info) {
    var k = previewKind();
    if (!info || !k) return info;
    var out = Object.assign({}, info, { banner: null, closings: [], weatherClosedToday: k !== 'holiday' });
    if (k !== 'holiday') out.banner = { type: 'weather', weather: k, endsAt: null, message: "We're closed today because of " + (k === 'ice' ? 'icy roads' : 'snow') + '. Stay safe!' };
    return out;
  }

  // [openMinutes, closeMinutes] for that Central date, or null when closed all day
  function dayHours(d, info) {
    var h = (info.hours || {})[DAY_KEYS[d.getDay()]];
    var open = h && mins(h.open), close = h && mins(h.close);
    if (open == null || close == null) return null;
    var key = ymd(d), c = (info.closings || []).filter(function (x) { return x && x.date === key; })[0];
    if (c) {
      if (c.allDay) return null;
      var late = mins(c.openAt), early = mins(c.closeAt);
      if (late != null) open = Math.max(open, late);     // opens late: closed before openAt
      if (early != null) close = Math.min(close, early);
    }
    return close > open ? [open, close] : null;
  }

  function isOpenNow(info) {
    var t = /[?&]test=(open|closed)/.exec(location.search);
    if (t) return t[1] === 'open' && !info.weatherClosedToday;   // a weather day stays closed
    var now = central(), m = now.getHours() * 60 + now.getMinutes(), h = dayHours(now, info);
    if (info.weatherClosedToday || !h) return false;
    return m >= h[0] && m < h[1];
  }

  // The next Central day that opens (today if it still opens later), with its hours; null if none in 60 days
  function nextOpenDay(info) {
    var now = central(), d = new Date(now), m = now.getHours() * 60 + now.getMinutes(), h = dayHours(now, info);
    if (h && !info.weatherClosedToday && m < h[0]) return { d: d, h: h, today: true };
    for (var i = 0; i < 60; i++) {
      d.setDate(d.getDate() + 1);
      h = dayHours(d, info);
      if (h) return { d: d, h: h, today: false };
    }
    return null;
  }

  // "this morning", "tomorrow morning", or "Monday morning"
  function nextOpenLabel(info) {
    var n = nextOpenDay(info);
    if (!n) return 'when we reopen';
    if (n.today) return 'this morning';
    var tomorrow = central(); tomorrow.setDate(tomorrow.getDate() + 1);
    if (n.d.toDateString() === tomorrow.toDateString()) return 'tomorrow morning';
    return ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][n.d.getDay()] + ' morning';
  }

  // When the office next opens, as a real timestamp (ms). Used to lock the after-hours check until then.
  function nextOpenAt(info) {
    var now = central(), n = nextOpenDay(info);
    if (!n) return Date.now() + 12 * 3600e3;
    var d = new Date(n.d); d.setHours(0, n.h[0], 0, 0);
    return Date.now() + (d - now);
  }

  // "Coming up": closings in the next 60 days, consecutive identical days grouped.
  // -> [{ when: 'Thu, Nov 26 – Fri, Nov 27', what: 'Closed · Thanksgiving' }]. Plain text only.
  var DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  function dateOf(s) { var p = s.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function dayLabel(s) { var d = dateOf(s); return DOW[d.getDay()] + ', ' + MON[d.getMonth()] + ' ' + d.getDate(); }
  function time12(hhmm) {
    var m = mins(hhmm); if (m == null) return '';
    var h = Math.floor(m / 60), mm = m % 60;
    return (h % 12 || 12) + ':' + String(mm).padStart(2, '0') + ' ' + (h < 12 ? 'AM' : 'PM');
  }
  function closingText(c) {
    var t = c.allDay ? 'Closed'
      : c.openAt && c.closeAt ? 'Open ' + time12(c.openAt) + ' – ' + time12(c.closeAt)
      : c.openAt ? 'Opens at ' + time12(c.openAt) : 'Closes at ' + time12(c.closeAt);
    return c.reason ? t + ' · ' + String(c.reason) : t;
  }
  function comingUp(info) {
    var today = central(); today.setHours(0, 0, 0, 0);
    var last = new Date(today); last.setDate(last.getDate() + 60);
    var from = ymd(today), to = ymd(last), out = [], prev = null;
    (info.closings || []).filter(function (c) {
      return c && /^\d{4}-\d{2}-\d{2}$/.test(c.date) && c.date >= from && c.date <= to && (c.allDay || c.openAt || c.closeAt);
    }).sort(function (a, b) { return a.date < b.date ? -1 : 1; }).forEach(function (c) {
      var what = closingText(c);
      if (prev) {
        var next = dateOf(prev.last); next.setDate(next.getDate() + 1);
        if (ymd(next) === c.date && prev.what === what) { prev.last = c.date; return; }
      }
      prev = { first: c.date, last: c.date, what: what };
      out.push(prev);
    });
    return out.map(function (g) {
      return { when: g.first === g.last ? dayLabel(g.first) : dayLabel(g.first) + ' – ' + dayLabel(g.last), what: g.what };
    });
  }

  // Hours card: the regular week as rows, consecutive days with the same hours grouped (Mon first).
  // -> [{ days: 'Mon – Thu', time: '8:30 AM – 5:00 PM' }, { days: 'Friday', ... }, { days: 'Sat – Sun', time: 'Closed' }]
  var WEEK = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
  var SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  var LONG = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  function weekRows(info) {
    var rows = [];
    WEEK.forEach(function (k, i) {
      var h = (info.hours || {})[k];
      var time = h && mins(h.open) != null && mins(h.close) != null ? time12(h.open) + ' – ' + time12(h.close) : 'Closed';
      var last = rows[rows.length - 1];
      if (last && last.time === time) { last.to = i; return; }
      rows.push({ from: i, to: i, time: time });
    });
    return rows.map(function (r) {
      return { days: r.from === r.to ? LONG[r.from] : SHORT[r.from] + ' – ' + SHORT[r.to], time: r.time };
    });
  }

  // 'today' / 'tomorrow' / 'Monday, Nov 30' for a nextOpenDay() result
  function dayWords(n) {
    var tomorrow = central(); tomorrow.setDate(tomorrow.getDate() + 1);
    return n.today ? 'today' : n.d.toDateString() === tomorrow.toDateString() ? 'tomorrow'
      : ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][n.d.getDay()] + ', ' + MON[n.d.getMonth()] + ' ' + n.d.getDate();
  }

  // Weather banner's second line: "We plan to reopen tomorrow at 8:30 AM. Check back here for updates!" Fridays and
  // holidays name the real next clinic day: "...reopen Monday, Nov 30 at 8:30 AM..."
  function reopenLine(info) {
    var n = nextOpenDay(info);
    if (!n) return '';
    var t = n.h[0];
    return 'We plan to reopen ' + dayWords(n) + ' at ' + time12(String(Math.floor(t / 60)).padStart(2, '0') + ':' + String(t % 60).padStart(2, '0')) + '. Check back here for updates!';
  }
  function withReopen(info) {
    if (!info || !info.banner || info.banner.type !== 'weather') return info;
    return Object.assign({}, info, { banner: Object.assign({}, info.banner, { after: reopenLine(info) }) });
  }

  // "Open now · until 5:00 PM" / "Closed · opens tomorrow at 8:30 AM" (closings and weather included).
  function nowStatus(info) {
    var now = central(), m = now.getHours() * 60 + now.getMinutes(), h = dayHours(now, info);
    var t = function (x) { return time12(String(Math.floor(x / 60)).padStart(2, '0') + ':' + String(x % 60).padStart(2, '0')); };
    if (isOpenNow(info) && h) return { open: true, text: 'Open now · until ' + t(h[1]) };
    var n = nextOpenDay(info);
    if (!n) return { open: false, text: 'Closed' };
    var when = dayWords(n);
    // Closed because of a closing (a holiday, weather...)? Name it: the first closing with a reason from today
    // up to the day before we reopen -> "Closed for Thanksgiving · opens Monday, Nov 30 at 8:30 AM"
    var why = '', d = new Date(now); d.setHours(0, 0, 0, 0);
    var stop = new Date(n.d); stop.setHours(0, 0, 0, 0);
    for (var k = 0; k < 60 && !why && (d < stop || k === 0); k++, d.setDate(d.getDate() + 1)) {
      var key = ymd(d), c = (info.closings || []).filter(function (x) { return x && x.date === key; })[0];
      // today's short day only counts once it has cut in: closed early and it's past that time, or opening late
      // (before the regular opening on an early-close day we're simply "Closed · opens today", not closed for it)
      var cut = !c || c.allDay || k > 0 || mins(c.openAt) != null || (mins(c.closeAt) != null && m >= mins(c.closeAt));
      if (c && c.reason && cut) why = String(c.reason).trim();
    }
    if (!why && info.weatherClosedToday) why = 'weather';
    return { open: false, text: (why ? 'Closed for ' + why : 'Closed') + ' · opens ' + when + ' at ' + t(n.h[0]) };
  }

  // Automatic banner: when no admin banner is live and there are closings in the next 14 days
  // (today included), a short strip made from them, e.g. "Closing at noon Wed, Nov 25 · Closed Thu–Fri,
  // Nov 26–27." + greeting "Happy Thanksgiving! 🍽️ 🦃" for a known holiday, or
  // "Winter weather hours: opening at 10 AM Mon, Dec 7." otherwise. Gone after the last of those days.
  // (The admin's pre-filled banner, adminportal/model.js closingBannerMessage, still uses "<reason> hours: ...".)
  var AUTO_DAYS = 14;
  function dateList(dates) {   // consecutive runs joined with "–", pieces with ", " and " and "
    var runs = [];
    dates.forEach(function (d) {
      var last = runs[runs.length - 1];
      if (last) { var n = dateOf(last[1]); n.setDate(n.getDate() + 1); if (ymd(n) === d) { last[1] = d; return; } }
      runs.push([d, d]);
    });
    var parts = runs.map(function (r) {
      if (r[0] === r[1]) return dayLabel(r[0]);
      var a = dateOf(r[0]), b = dateOf(r[1]);
      return a.getMonth() === b.getMonth()     // same month: "Thu–Fri, Nov 26–27" (short, so the banner stays small)
        ? DOW[a.getDay()] + '–' + DOW[b.getDay()] + ', ' + MON[a.getMonth()] + ' ' + a.getDate() + '–' + b.getDate()
        : dayLabel(r[0]) + ' – ' + dayLabel(r[1]);
    });
    return parts.length < 2 ? (parts[0] || '') : parts.slice(0, -1).join(', ') + ' and ' + parts[parts.length - 1];
  }
  // Holidays get a little greeting under the closing line
  var GREETINGS = [
    [/thanksgiving/i, 'Happy Thanksgiving! \uD83C\uDF7D\uFE0F \uD83E\uDD83'],
    [/christmas/i, 'Merry Christmas! \uD83C\uDF84'],
    [/new year/i, 'Happy New Year! \uD83C\uDF89'],
    [/independence|fourth of july|july 4/i, 'Happy Fourth of July! \uD83C\uDF86']
  ];
  function holidayGreeting(reason) {
    for (var i = 0; reason && i < GREETINGS.length; i++) if (GREETINGS[i][0].test(reason)) return GREETINGS[i][1];
    return '';
  }
  function shortTime(hhmm) {   // "noon", "10 AM", "4:30 PM"
    var m = mins(hhmm); if (m == null) return '';
    if (m === 720) return 'noon';
    var h = Math.floor(m / 60), mm = m % 60;
    return (h % 12 || 12) + (mm ? ':' + String(mm).padStart(2, '0') : '') + ' ' + (h < 12 ? 'AM' : 'PM');
  }
  function autoBanner(info) {
    if (info.banner) return null;  // a live admin banner always wins
    var today = central(); today.setHours(0, 0, 0, 0);
    var last = new Date(today); last.setDate(last.getDate() + AUTO_DAYS);
    var from = ymd(today), to = ymd(last);
    var days = (info.closings || []).filter(function (c) {
      return c && /^\d{4}-\d{2}-\d{2}$/.test(c.date) && c.date >= from && c.date <= to && (c.allDay || c.openAt || c.closeAt);
    }).sort(function (a, b) { return a.date < b.date ? -1 : 1; });
    if (!days.length) return null;
    var order = [], groups = {};
    days.forEach(function (c) {
      var key = c.allDay ? 'closed'
        : c.openAt && c.closeAt ? 'both|' + c.openAt + '|' + c.closeAt
        : c.openAt ? 'opens|' + c.openAt : 'closes|' + c.closeAt;
      if (!groups[key]) { groups[key] = { c: c, dates: [] }; order.push(key); }
      groups[key].dates.push(c.date);
    });
    var parts = order.map(function (key) {
      var g = groups[key], when = dateList(g.dates), c = g.c;
      if (key === 'closed') return 'closed ' + when;
      if (c.openAt && c.closeAt) return 'open ' + shortTime(c.openAt) + '–' + shortTime(c.closeAt) + ' ' + when;
      if (c.openAt) return 'opening at ' + shortTime(c.openAt) + ' ' + when;
      return 'closing at ' + shortTime(c.closeAt) + ' ' + when;
    });
    // short pieces joined with " · ": "Closing at noon Wed, Nov 25 · Closed Thu–Fri, Nov 26–27"
    var text = parts.map(function (x, i) { return i ? x.charAt(0).toUpperCase() + x.slice(1) : x; }).join(' · ');
    var reasons = days.map(function (c) { return c.reason ? String(c.reason).trim() : ''; }).filter(Boolean);
    var reason = reasons.length && reasons.every(function (r) { return r === reasons[0]; }) ? reasons[0] : '';
    var greeting = holidayGreeting(reason);
    // A holiday says it plainly and wishes them well on a second line; other reasons ("Winter weather") lead the sentence
    var message = reason && !greeting ? reason + ' hours: ' + text + '.' : text.charAt(0).toUpperCase() + text.slice(1) + '.';
    var weather = reasons.some(function (r) { return /weather/i.test(r); });
    var out = { type: weather ? 'weather' : 'holiday', message: message };
    if (greeting) out.greeting = greeting;
    return out;
  }

  window.EAOMHours = {
    autoBanner: autoBanner,       // (info) -> {type, message} | null (null when an admin banner is live)
    comingUp: comingUp,
    weekRows: weekRows,           // (info) -> [{days, time}] the regular week, grouped
    nowStatus: nowStatus,         // (info) -> {open, text}           // (info) -> [{when, what}] closings in the next 60 days
    cached: withReopen(preview(readCache())),          // last visit's {hours, hoursLine, banner, closings, jobs}, or null
    ready: ready,                 // Promise<{cfg, source, hours, hoursLine, banner, closings, jobs, insurance, doctors, themes, weatherClosedToday}>
    isOpenNow: isOpenNow,         // (info) -> boolean
    nextOpenLabel: nextOpenLabel, // (info) -> string
    nextOpenAt: nextOpenAt        // (info) -> ms timestamp
  };
})();
