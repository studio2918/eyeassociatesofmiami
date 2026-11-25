/*
  Which characters the site shows today (one place decides; holiday.js and index.html use it):
    1. a preview on the page address (?weather=snow|ice, ?holiday=thanksgiving|christmas|preview|off) — looking only;
    2. a live Weather banner -> snow or ice characters (the holiday stays off while it's up);
    3. a switched-on holiday whose dates (MM-DD, every year, inclusive) include today in Central time (no list known:
       the built-in dates);
    4. otherwise none.
  pick({search, banner, themes, now}) -> {theme: 'weather'|'thanksgiving'|'christmas'|null, kind: 'snow'|'ice'|null, preview}
*/
(function () {
  'use strict';
  var IDS = { thanksgiving: 1, christmas: 1 };
  // the built-in dates, used whenever no list is known (first visit, feed and backup copy both missing):
  // Thanksgiving all of November, Christmas all of December
  var DEFAULTS = [{ id: 'thanksgiving', on: true, start: '11-01', end: '11-30' }, { id: 'christmas', on: true, start: '12-01', end: '12-31' }];
  var md = /^\d{2}-\d{2}$/;
  function centralMD(now) {   // 'MM-DD' of today in Miami, OK
    var parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Chicago', month: '2-digit', day: '2-digit' }).formatToParts(now);
    var get = function (t) { for (var i = 0; i < parts.length; i++) if (parts[i].type === t) return parts[i].value; return ''; };
    return get('month') + '-' + get('day');
  }
  function pick(o) {
    o = o || {};
    var search = String(o.search || ''), now = o.now || new Date();
    var w = /[?&]weather=(snow|ice)\b/.exec(search), hol = /[?&]holiday=(preview|christmas|thanksgiving|off)\b/.exec(search);
    if (hol && hol[1] === 'off') return { theme: null, kind: null, preview: true };
    if (w) return { theme: 'weather', kind: w[1], preview: true };
    if (hol) return { theme: hol[1] === 'thanksgiving' ? 'thanksgiving' : 'christmas', kind: null, preview: true };
    var b = o.banner;
    if (b && b.type === 'weather') return { theme: 'weather', kind: b.weather === 'ice' ? 'ice' : 'snow', preview: false };
    var list = Array.isArray(o.themes) ? o.themes : DEFAULTS, today = centralMD(now);
    for (var i = 0; i < list.length; i++) {
      var t = list[i];
      if (!t || !IDS[t.id] || t.on !== true || !md.test(t.start) || !md.test(t.end)) continue;
      if (t.start <= today && today <= t.end) return { theme: t.id, kind: null, preview: false };
    }
    return { theme: null, kind: null, preview: false };
  }
  // same look? (holiday.js picks at load from last visit's copy; index.html compares with the live feed)
  function same(a, b) { return (a && a.theme || null) === (b && b.theme || null) && (a && a.kind || null) === (b && b.kind || null); }
  window.EAOMThemePick = { pick: pick, same: same, DEFAULTS: DEFAULTS };
})();
