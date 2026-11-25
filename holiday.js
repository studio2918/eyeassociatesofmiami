/*
  Holiday peekers: in December, little holiday characters (Santa-hat guy, elf, tree)
  pop up from behind tiles down the page as each tile scrolls into view, look around, follow the
  cursor, blink, and duck back down when the tile leaves the screen. Never over words (same text check as the
  hiring-card eyes). The hiring-card eyes stay home (no roaming) while they're out.

  On: ?holiday=christmas (or =preview) / ?holiday=thanksgiving on the page address (for looking). Not switched on by date yet.
*/
(function () {
  'use strict';
  // Which look (theme-pick.js): a preview on the address, else last visit's copy of the feed (a live Weather banner,
  // the holiday dates), else the built-in default dates. index.html checks the live feed and reloads once if it differs.
  var cached = window.EAOMHours && EAOMHours.cached;
  var picked = window.EAOMThemePick ? EAOMThemePick.pick({ search: location.search, banner: cached && cached.banner,
    themes: cached && cached.themes, now: new Date() }) : { theme: null, kind: null };
  var theme = picked.theme, kind = picked.kind, on = !!theme, WX = theme === 'weather';
  window.EAOMHoliday = { on: on, theme: theme, kind: kind };
  if (!on) return;

  var VB = '0 -40 66 82';
  var C = {"santa": "<rect x=\"1\" y=\"2\" width=\"64\" height=\"40\" rx=\"18\" fill=\"#12364d\"/><circle cx=\"21\" cy=\"20\" r=\"9.5\" fill=\"#fff\"/><circle cx=\"45\" cy=\"20\" r=\"9.5\" fill=\"#fff\"/><g class=\"pp\"><circle cx=\"21\" cy=\"21\" r=\"4\" fill=\"#1d2730\"/><circle cx=\"22.3\" cy=\"19.5\" r=\"1.2\" fill=\"#fff\"/><circle cx=\"45\" cy=\"21\" r=\"4\" fill=\"#1d2730\"/><circle cx=\"46.3\" cy=\"19.5\" r=\"1.2\" fill=\"#fff\"/></g><path d=\"M3 3 C6 -22 40 -32 60 -20 C55 -17 53 -10 63 3 Z\" fill=\"#c0392b\"/><path d=\"M30 -17 C40 -21 50 -22 60 -20\" fill=\"none\" stroke=\"#a93226\" stroke-width=\"2\"/><circle cx=\"60\" cy=\"-20\" r=\"5.5\" fill=\"#fff\"/><path d=\"M-1 15 C-1 3 12 -3 33 -3 C54 -3 67 3 67 15 C67 18 64 18 62 16 C56 9 46 6 33 6 C20 6 10 9 4 16 C2 18 -1 18 -1 15 Z\" fill=\"#fff\"/>", "elfhat": "<rect x=\"1\" y=\"2\" width=\"64\" height=\"40\" rx=\"18\" fill=\"#12364d\"/><circle cx=\"21\" cy=\"20\" r=\"9.5\" fill=\"#fff\"/><circle cx=\"45\" cy=\"20\" r=\"9.5\" fill=\"#fff\"/><g class=\"pp\"><circle cx=\"21\" cy=\"21\" r=\"4\" fill=\"#1d2730\"/><circle cx=\"22.3\" cy=\"19.5\" r=\"1.2\" fill=\"#fff\"/><circle cx=\"45\" cy=\"21\" r=\"4\" fill=\"#1d2730\"/><circle cx=\"46.3\" cy=\"19.5\" r=\"1.2\" fill=\"#fff\"/></g><g class=\"jingle\" style=\"transform-origin:33px 2px\"><path d=\"M3 3 C8 -24 36 -36 61 -28 C53 -21 47 -10 63 3 Z\" fill=\"#2f7d4f\"/><circle cx=\"61\" cy=\"-28\" r=\"4.2\" fill=\"#e3b341\"/><circle cx=\"60\" cy=\"-29.5\" r=\"1.3\" fill=\"#fff6d6\"/></g><path d=\"M-1 15 C-1 3 12 -3 33 -3 C54 -3 67 3 67 15 C67 18 64 18 62 16 C56 9 46 6 33 6 C20 6 10 9 4 16 C2 18 -1 18 -1 15 Z\" fill=\"#c0392b\"/><g fill=\"#fff\" opacity=\".9\"><circle cx=\"8\" cy=\"9\" r=\"1.4\"/><circle cx=\"19\" cy=\"3.5\" r=\"1.4\"/><circle cx=\"33\" cy=\"1.8\" r=\"1.4\"/><circle cx=\"47\" cy=\"3.5\" r=\"1.4\"/><circle cx=\"58\" cy=\"9\" r=\"1.4\"/></g>"};
  C.turkey = { vb: '-16 -44 98 90', svg: "<g class=\"fan\"><ellipse cx=\"6.7\" cy=\"12.4\" rx=\"7\" ry=\"15\" fill=\"#c0392b\" transform=\"rotate(290 6.7 12.4)\"/><ellipse cx=\"12.6\" cy=\"2.8\" rx=\"7\" ry=\"15\" fill=\"#e67e22\" transform=\"rotate(313 12.6 2.8)\"/><ellipse cx=\"21.9\" cy=\"-3.7\" rx=\"7\" ry=\"15\" fill=\"#f1c40f\" transform=\"rotate(337 21.9 -3.7)\"/><ellipse cx=\"33.0\" cy=\"-6.0\" rx=\"7\" ry=\"15\" fill=\"#e67e22\" transform=\"rotate(360 33.0 -6.0)\"/><ellipse cx=\"44.1\" cy=\"-3.7\" rx=\"7\" ry=\"15\" fill=\"#c0392b\" transform=\"rotate(383 44.1 -3.7)\"/><ellipse cx=\"53.4\" cy=\"2.8\" rx=\"7\" ry=\"15\" fill=\"#8a5a3b\" transform=\"rotate(407 53.4 2.8)\"/><ellipse cx=\"59.3\" cy=\"12.4\" rx=\"7\" ry=\"15\" fill=\"#e67e22\" transform=\"rotate(430 59.3 12.4)\"/></g><rect x=\"5\" y=\"4\" width=\"56\" height=\"38\" rx=\"18\" fill=\"#8a5a3b\"/><rect x=\"20\" y=\"-14\" width=\"26\" height=\"16\" rx=\"2\" fill=\"#1d2730\"/><rect x=\"20\" y=\"-4\" width=\"26\" height=\"4\" fill=\"#5b3a26\"/><rect x=\"29\" y=\"-5\" width=\"8\" height=\"6\" rx=\"1\" fill=\"none\" stroke=\"#e3b341\" stroke-width=\"1.6\"/><rect x=\"13\" y=\"1\" width=\"40\" height=\"4\" rx=\"2\" fill=\"#1d2730\"/><circle cx=\"21\" cy=\"19\" r=\"9.5\" fill=\"#fff\"/><circle cx=\"45\" cy=\"19\" r=\"9.5\" fill=\"#fff\"/><g class=\"pp\"><circle cx=\"21\" cy=\"20\" r=\"4\" fill=\"#1d2730\"/><circle cx=\"22.3\" cy=\"18.5\" r=\"1.2\" fill=\"#fff\"/><circle cx=\"45\" cy=\"20\" r=\"4\" fill=\"#1d2730\"/><circle cx=\"46.3\" cy=\"18.5\" r=\"1.2\" fill=\"#fff\"/></g><path d=\"M28 28 L38 28 L33 35 Z\" fill=\"#f39c12\"/><path d=\"M35 31 q5 3 3 10 q-4 -2 -4 -7 Z\" fill=\"#d62f2f\"/>" };
  C.pilgrim = "<rect x=\"1\" y=\"2\" width=\"64\" height=\"40\" rx=\"18\" fill=\"#12364d\"/><path d=\"M15 -34 H51 L54 2 H12 Z\" fill=\"#1d2730\"/><rect x=\"12\" y=\"-9\" width=\"42\" height=\"6.5\" fill=\"#5b3a26\"/><rect x=\"27.5\" y=\"-10\" width=\"11\" height=\"8.5\" rx=\"1\" fill=\"none\" stroke=\"#e3b341\" stroke-width=\"2.2\"/><rect x=\"1\" y=\"-0.5\" width=\"64\" height=\"6\" rx=\"3\" fill=\"#1d2730\"/><circle cx=\"21\" cy=\"22\" r=\"9.5\" fill=\"#fff\"/><circle cx=\"45\" cy=\"22\" r=\"9.5\" fill=\"#fff\"/><g class=\"pp\"><circle cx=\"21\" cy=\"23\" r=\"4\" fill=\"#1d2730\"/><circle cx=\"22.3\" cy=\"21.5\" r=\"1.2\" fill=\"#fff\"/><circle cx=\"45\" cy=\"23\" r=\"4\" fill=\"#1d2730\"/><circle cx=\"46.3\" cy=\"21.5\" r=\"1.2\" fill=\"#fff\"/></g>";
  C.tree = { vb: '0 -44 66 86', svg: "<g transform=\"rotate(12 33 -33)\"><path class=\"star\" d=\"M33 -41 L35.4 -35 L41.8 -35 L36.7 -31.2 L38.6 -25 L33 -28.8 L27.4 -25 L29.3 -31.2 L24.2 -35 L30.6 -35 Z\" fill=\"#f1c40f\"/></g><path d=\"M33 -28 C36 -22 42 -14 44 -11 C43 -10 42 -10 41 -9.5 C46 -3 52 5 56 10 C54 11 52 11.5 50 12 C56 19 61 26 65 33 Q33 40 1 33 C5 26 10 19 16 12 C14 11.5 12 11 10 10 C14 5 20 -3 25 -9.5 C24 -10 23 -10 22 -11 C24 -14 30 -22 33 -28 Z\" fill=\"#2f7d4f\" stroke=\"#256a41\" stroke-width=\"1.4\" stroke-linejoin=\"round\"/><path d=\"M27 -16 Q33 -12 40 -17\" fill=\"none\" stroke=\"#1d2730\" stroke-width=\".8\" opacity=\".5\"/><path d=\"M6 27 Q33 37 60 26\" fill=\"none\" stroke=\"#1d2730\" stroke-width=\".8\" opacity=\".5\"/><circle class=\"bulb b0\" cx=\"27\" cy=\"-15\" r=\"2.1\" fill=\"#e74c3c\"/><circle class=\"bulb b1\" cx=\"33\" cy=\"-13\" r=\"2.1\" fill=\"#f1c40f\"/><circle class=\"bulb b2\" cx=\"39\" cy=\"-16\" r=\"2.1\" fill=\"#3498db\"/><circle class=\"bulb b0\" cx=\"7\" cy=\"28\" r=\"2.1\" fill=\"#2ecc71\"/><circle class=\"bulb b1\" cx=\"15\" cy=\"31\" r=\"2.1\" fill=\"#e74c3c\"/><circle class=\"bulb b2\" cx=\"24\" cy=\"33\" r=\"2.1\" fill=\"#f1c40f\"/><circle class=\"bulb b0\" cx=\"33\" cy=\"33.5\" r=\"2.1\" fill=\"#3498db\"/><circle class=\"bulb b1\" cx=\"42\" cy=\"33\" r=\"2.1\" fill=\"#2ecc71\"/><circle class=\"bulb b2\" cx=\"51\" cy=\"30\" r=\"2.1\" fill=\"#e74c3c\"/><circle class=\"bulb b0\" cx=\"59\" cy=\"27\" r=\"2.1\" fill=\"#f1c40f\"/><circle cx=\"24\" cy=\"2\" r=\"7\" fill=\"#fff\"/><circle cx=\"42\" cy=\"2\" r=\"7\" fill=\"#fff\"/><g class=\"pp\"><circle cx=\"24\" cy=\"3\" r=\"3.2\" fill=\"#1d2730\"/><circle cx=\"25\" cy=\"1.8\" r=\"1\" fill=\"#fff\"/><circle cx=\"42\" cy=\"3\" r=\"3.2\" fill=\"#1d2730\"/><circle cx=\"43\" cy=\"1.8\" r=\"1\" fill=\"#fff\"/></g><g class=\"brow\" stroke=\"#173f27\" stroke-width=\"2.2\" stroke-linecap=\"round\" fill=\"none\"><path d=\"M19 -6.6 q5 -3.4 10 0\"/><path d=\"M37 -6.6 q5 -3.4 10 0\"/></g><ellipse cx=\"15\" cy=\"9\" rx=\"3.2\" ry=\"2\" fill=\"#e8798b\" opacity=\".7\"/><ellipse cx=\"51\" cy=\"9\" rx=\"3.2\" ry=\"2\" fill=\"#e8798b\" opacity=\".7\"/><path d=\"M28 9 Q33 14 38 9\" fill=\"none\" stroke=\"#1d2730\" stroke-width=\"1.8\" stroke-linecap=\"round\"/><path d=\"M11 13 Q33 21 55 12 L57 18 Q33 27 9 19 Z\" fill=\"#c0392b\"/><path d=\"M14 15 l2 5 M20 17 l2 5 M26 18 l2 5 M32 19 l2 5 M38 18 l2 5 M44 17 l2 5 M50 15 l2 5\" stroke=\"#a93226\" stroke-width=\"1\"/><path d=\"M46 19 L50 33 L56 32 L52 18 Z\" fill=\"#c0392b\"/><path d=\"M47 30 h9\" stroke=\"#fff\" stroke-width=\"1.4\"/>" };
  C.turkeyplain = { vb: '-16 -44 98 90', svg: "<g class=\"fan\"><ellipse cx=\"4.8\" cy=\"9.7\" rx=\"7\" ry=\"15\" fill=\"#c0392b\" transform=\"rotate(290 4.8 9.7)\"/><ellipse cx=\"11.2\" cy=\"-0.6\" rx=\"7\" ry=\"15\" fill=\"#e67e22\" transform=\"rotate(313 11.2 -0.6)\"/><ellipse cx=\"21.1\" cy=\"-7.5\" rx=\"7\" ry=\"15\" fill=\"#f1c40f\" transform=\"rotate(337 21.1 -7.5)\"/><ellipse cx=\"33.0\" cy=\"-10.0\" rx=\"7\" ry=\"15\" fill=\"#e67e22\" transform=\"rotate(360 33.0 -10.0)\"/><ellipse cx=\"44.9\" cy=\"-7.5\" rx=\"7\" ry=\"15\" fill=\"#c0392b\" transform=\"rotate(383 44.9 -7.5)\"/><ellipse cx=\"54.8\" cy=\"-0.6\" rx=\"7\" ry=\"15\" fill=\"#8a5a3b\" transform=\"rotate(407 54.8 -0.6)\"/><ellipse cx=\"61.2\" cy=\"9.7\" rx=\"7\" ry=\"15\" fill=\"#e67e22\" transform=\"rotate(430 61.2 9.7)\"/></g><rect x=\"5\" y=\"4\" width=\"56\" height=\"38\" rx=\"18\" fill=\"#8a5a3b\"/><g stroke=\"#4a2d1c\" stroke-width=\"2.4\" stroke-linecap=\"round\" fill=\"none\"><path d=\"M15 7q6-3 12 0\"/><path d=\"M39 7q6-3 12 0\"/></g><circle cx=\"21\" cy=\"18\" r=\"9.5\" fill=\"#fff\"/><circle cx=\"45\" cy=\"18\" r=\"9.5\" fill=\"#fff\"/><g class=\"pp\"><circle cx=\"21\" cy=\"19\" r=\"4\" fill=\"#1d2730\"/><circle cx=\"22.3\" cy=\"17.5\" r=\"1.2\" fill=\"#fff\"/><circle cx=\"45\" cy=\"19\" r=\"4\" fill=\"#1d2730\"/><circle cx=\"46.3\" cy=\"17.5\" r=\"1.2\" fill=\"#fff\"/></g><path d=\"M28 27 L38 27 L33 34 Z\" fill=\"#f39c12\"/><path d=\"M35 30 q5 3 3 10 q-4 -2 -4 -7 Z\" fill=\"#d62f2f\"/>" };
  // which character peeks over which tile (different ones down the page)
  // Every refresh deals the characters out to different tiles at random (no fixed places). Rules: no
  // character twice in a row down the page, and the elf hat never takes the top spot. (Thanksgiving's three
  // characters take turns down the page too, so every tile gets one.)
  // The tree is drawn small inside its box, so it's scaled up to show its details.
  if (WX && window.EAOMWeatherArt) {   // weather closed: the snow or ice guy (weather-art.js) on every tile, holding a CLOSED sign
    C.snow = EAOMWeatherArt.snow; C.ice = EAOMWeatherArt.ice; C.snowFace = EAOMWeatherArt.snowFace; C.iceFace = EAOMWeatherArt.iceFace;
  }
  var BIG = { tree: 1.45, turkey: 1.3, turkeyplain: 1.3 };
  var TILES = ['#care .grid', '.ins-notes', '.cta .box'];   // a|b: b when a has no room. Only real tiles/cards (John's audit): none on the Our doctors tiles,
  // the insurance list (a thin line, he floated), above "Come see us", or over the map (John 2026-11-24).
  var POOL = WX ? [kind] : theme === 'thanksgiving'
    ? ['turkey', 'pilgrim', 'turkeyplain']
    : ['santa', 'elfhat', 'tree'];
  // The hiring card's guy (hiring-eyes.js) and the review card's guy wear a random outfit each visit too,
  // never the same one as each other.
  var OUTFITS = WX ? [kind] : theme === 'thanksgiving' ? ['turkey', 'turkeyplain', 'pilgrim'] : ['santa', 'elfhat', 'tree'];
  var CARD_POOL = WX ? [kind] : theme === 'thanksgiving' ? ['turkey', 'pilgrim', 'turkeyplain'] : ['santa', 'elfhat', 'tree'];
  var outfit, cardCh;   // picked after the tiles are dealt (below), so no two neighbors match
  function shuffle(a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function deal() {
    for (var tries = 0; tries < 50; tries++) {
      var picks = [];
      while (picks.length < TILES.length) picks = picks.concat(shuffle(POOL));
      picks = picks.slice(0, TILES.length);
      var ok = picks[0] !== 'elfhat';
      if (WX) return picks;   // one character everywhere (no "never twice in a row" rule)
      for (var k = 1; k < picks.length && ok; k++) if (picks[k] === picks[k - 1]) ok = false;
      if (ok) return picks;
    }
    return picks;
  }
  var dealt = deal();
  // Neighbors never match: the hiring guy (hero, just above the first tile) isn't the first tile's character, and
  // the review card's guy (under Come see us, just above the last tile) isn't either of theirs or the hiring guy.
  function pickFrom(pool, avoid) {
    for (var n = avoid.length; n >= 0; n--) {   // too few characters (Thanksgiving)? drop the farthest neighbor first
      var ok = pool.filter(function (x) { return avoid.slice(0, n).indexOf(x) < 0; });
      if (ok.length) return ok[Math.floor(Math.random() * ok.length)];
    }
  }
  outfit = pickFrom(OUTFITS, [dealt[0]]);
  cardCh = pickFrom(CARD_POOL, [dealt[TILES.length - 2], dealt[TILES.length - 1], outfit]);
  window.EAOMHoliday.outfit = outfit; window.EAOMHoliday.cardCh = cardCh;
  // each one also gets random places along its tile's top edge (fractions across the tile), tried in order,
  // so where he peeks out changes every visit too; the same list is reused when the page re-places him
  var SPOTS = TILES.map(function (sel, i) { return [sel, dealt[i], [Math.random(), Math.random(), Math.random(), Math.random(), Math.random(), Math.random()]]; });
  // Eye care section: one guy at a time takes turns popping up from a few of its tiles (3 of the 4, picked
  // at random each visit, never all of them): he ducks, then pops up from the next one.
  var CARE_N = document.querySelectorAll('#care .grid > .tile').length, careTiles = [], careAt = 0;
  for (var ci = 1; ci <= CARE_N; ci++) careTiles.push(ci);
  careTiles = shuffle(careTiles).slice(0, Math.max(1, CARE_N - 1));   // all but one (a tile with no room on phones just gets skipped)
  function careSel() {   // the current tile first, then the others in turn as backups (no room), then the grid
    var order = careTiles.slice(careAt).concat(careTiles.slice(0, careAt));
    return order.map(function (n) { return '#care .grid > .tile:nth-child(' + n + ')'; }).concat(['#care .grid']).join('|');
  }
  if (careTiles.length) SPOTS[0][0] = careSel();
  var small = function () { return window.innerWidth < 600; };   // phones: smaller characters (less room between tiles)
  var W = 58, H = 70, reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  function textLines() {
    var out = [], walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode: function (n) {
        if (!n.data.trim()) return NodeFilter.FILTER_REJECT;
        return n.parentNode.closest('.callbar, script, style, [hidden], dialog, .hol-peek') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT;
      }
    }), r = document.createRange(), n;
    while ((n = walk.nextNode())) {
      r.selectNodeContents(n);
      Array.prototype.forEach.call(r.getClientRects(), function (q) { if (q.width && q.height) out.push({ left: q.left + scrollX, right: q.right + scrollX, top: q.top + scrollY, bottom: q.bottom + scrollY }); });
    }
    return out;
  }
  function clear(rect, lines) {
    return !lines.some(function (q) { return q.left < rect.right + 4 && q.right > rect.left - 4 && q.top < rect.bottom && q.bottom > rect.top + 2; });
  }
  // other tiles/cards: he never pokes up into one (the narrow gap between two rows of eye care tiles had him
  // squeezed in with his hat over the tile above)
  var CARDS = '#care .tile, #doctors .grid > *, .ins-note, .map-box, .find-card, .cta .box, .hiring-strip, .review-cta';
  function cardRects(host) {
    return Array.prototype.filter.call(document.querySelectorAll(CARDS), function (c) { return c !== host && !c.contains(host) && !host.contains(c) && c.getClientRects().length; })
      .map(function (c) { var r = c.getBoundingClientRect(); return { left: r.left + scrollX, right: r.right + scrollX, top: r.top + scrollY, bottom: r.bottom + scrollY }; });
  }
  function offCards(rect, cards) {
    return !cards.some(function (q) { return q.left < rect.right && q.right > rect.left && q.top < rect.bottom - 2 && q.bottom > rect.top; });
  }

  var peeks = [];
  function place() {
    var lines = textLines();
    W = WX ? (small() ? 84 : 120) : small() ? 40 : 58; H = WX ? (small() ? 66 : 96) : small() ? 46 : 70;   // weather: wider, he holds a sign
    SPOTS.forEach(function (sp, idx) {
      // alternate sides down the page so they don't line up; fall back to whichever side is clear, then to the
      // spot's backup tile, then (for the scaled-up ones) to his regular size
      var tries = sp[2].map(function (f) { return ['at', f]; }).concat(idx % 2 ? [['left', 26], ['right', 26], ['left', 10], ['right', 10]] : [['right', 26], ['left', 26], ['right', 10], ['left', 10]]);
      var pick = null, el = null, scale = 1, sels = sp[0].split('|'), ks = BIG[sp[1]] ? [BIG[sp[1]], 1] : [1];
      for (var b = 0; b < sels.length && !pick; b++) for (var a = 0; a < ks.length && !pick; a++) {   // the spot's own tile first (shrinking a big one to fit), then its backups
        var e = document.querySelector(sels[b]);
        if (!e || !e.getClientRects().length) continue;
        var s = e.getBoundingClientRect(), top = s.top + scrollY, k = ks[a], grow = W * (k - 1) / 2, cards = cardRects(e);   // a scaled-up character takes more room: check all of it
        for (var i = 0; i < tries.length && !pick; i++) {
          var t = tries[i], left = t[0] === 'at' ? s.left + scrollX + 10 + grow + t[1] * Math.max(0, s.width - W - 20 - 2 * grow)
            : t[0] === 'right' ? s.right + scrollX - t[1] - W : s.left + scrollX + t[1];
          var area = { left: left - grow, right: left + W + grow, top: top - H * k + 6, bottom: top };
          if (clear(area, lines) && offCards(area, cards)) { pick = t[0] === 'at' ? ['left', Math.round(left - s.left - scrollX)] : t; el = e; scale = k; }
        }
      }
      if (!el) el = document.querySelector(sels[0]);
      if (!el || !el.getClientRects().length) { if (peeks[idx]) peeks[idx].box.style.display = 'none'; return; }
      var p = peeks[idx];
      if (!pick) { if (p) p.box.style.display = 'none'; return; }
      if (!p) {
        var c = C[sp[1]], box = document.createElement('span');
        box.className = WX ? 'hol-peek wx' : 'hol-peek'; box.setAttribute('aria-hidden', 'true'); box.dataset.ch = sp[1];
        // (anchored to the bottom: a wide drawing like the turkey sits down behind the tile instead of floating)
        box.innerHTML = '<svg viewBox="' + (c.vb || VB) + '" preserveAspectRatio="xMidYMax meet" focusable="false">' + (c.svg || c) + '</svg>';
        el.classList.add('eyes-spot');
        el.appendChild(box);
        p = peeks[idx] = { box: box, el: el, pups: box.querySelectorAll('.pp'), callOnly: idx === 0 && careTiles.length > 0 };   // the Eye care one only comes up to answer Call (John)
        io.observe(el);
      }
      if (p.el !== el || !el.contains(p.box)) {                 // the tile was rebuilt (the insurance list fills in after load): move him onto the new one
        io.unobserve(p.el); p.el = el; el.classList.add('eyes-spot'); el.appendChild(p.box); io.observe(el);
      }
      p.box.style.display = '';
      p.box.style.transform = scale !== 1 ? 'scale(' + scale + ')' : ''; p.box.style.transformOrigin = '50% 100%';
      p.box.style.left = pick[0] === 'left' ? pick[1] + 'px' : 'auto';
      p.box.style.right = pick[0] === 'right' ? pick[1] + 'px' : 'auto';
    });
  }

  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      var p = peeks.filter(function (x) { return x.el === e.target; })[0];
      if (!p) return;
      clearTimeout(p.t);
      if (p.callOnly) { p.want = false; if (!e.isIntersecting && !p.box.classList.contains('talking')) p.box.classList.remove('up'); return; }
      p.want = e.isIntersecting;
      if (e.isIntersecting) p.t = setTimeout(function () { popUp(p); }, 250 + Math.random() * 500);
      else p.box.classList.remove('up');
    });
  }, { rootMargin: '-12% 0px -12% 0px' });

  // ONE character on screen at a time, across the board (John: too many turkeys): a peeker waits while any other
  // character is showing (the hiring guy wherever he is, the review card's guy, or another peeker) and ducks if one
  // comes into view; when the screen is clear, the next one in view pops up. (The Thanksgiving football is separate.)
  function inView(el) {
    var r = el.getBoundingClientRect(), hd = document.querySelector('header'), top = hd ? hd.getBoundingClientRect().bottom : 0;
    var cb = document.querySelector('.callbar'), bottom = cb && cb.getClientRects().length ? cb.getBoundingClientRect().top : window.innerHeight;
    return r.width > 0 && r.bottom > top && r.top < bottom;
  }
  function hiringBusy() { return !!(window.EAOMHiringEyes && EAOMHiringEyes.active && EAOMHiringEyes.active()); }
  function cardsShowing() {   // the hiring guy (wherever he is, or busy hopping over to answer a call) or the review card's guy on screen
    if (hiringBusy()) return true;
    var hi = document.querySelector('.hire-eyes.up'), rc = document.querySelector('.rc-go.up .rc-guy');
    return !!(hi && inView(hi)) || !!(rc && rc.getClientRects().length && getComputedStyle(rc).display !== 'none' && inView(rc));
  }
  function othersShowing(p) {
    return cardsShowing() || peeks.some(function (q) { return q && q !== p && q.box.classList.contains('up') && inView(q.box); });
  }
  function popUp(p) {
    if (p.callOnly) return;   // only for Call (EAOMHoliday.responder)
    if (othersShowing(p) || !clearSince || Date.now() - clearSince < 1500) return;   // the referee pops him up once the screen is clear
    p.box.classList.add('up');
  }
  var clearSince = 0;   // the screen has to stay clear a moment before the next one pops up (no flicker while
                        // someone ducks and hops, e.g. tapping Call)
  function referee() {
    var shown = cardsShowing();
    peeks.forEach(function (q) {   // someone talking stays up; otherwise keep the first one up and duck the rest
      if (q && q.box.classList.contains('talking') && inView(q.box)) shown = true;
    });
    peeks.forEach(function (q) {
      if (!q || !q.box.classList.contains('up') || q.box.classList.contains('talking') || !inView(q.box)) return;
      if (shown) q.box.classList.remove('up'); else shown = true;
    });
    if (shown) { clearSince = 0; return; }
    if (!clearSince) clearSince = Date.now();
    if (Date.now() - clearSince < 1500) return;
    var next = peeks.filter(function (q) { return q && q.want && q.box.style.display !== 'none' && inView(q.box); })[0];
    if (next) next.box.classList.add('up');
  }
  var refT = 0;
  window.addEventListener('scroll', function () { clearTimeout(refT); refT = setTimeout(referee, 250); }, { passive: true });
  setInterval(referee, 900);

  // eyes follow the cursor (gently); without one, they glance around now and then
  var mx = null, my = null;
  document.addEventListener('pointermove', function (e) { mx = e.clientX; my = e.clientY; look(); }, { passive: true });
  function look() {
    peeks.forEach(function (p) {
      if (!p || mx == null) return;
      var r = p.box.getBoundingClientRect(), dx = mx - (r.left + r.width / 2), dy = my - (r.top + r.height / 2), d = Math.hypot(dx, dy) || 1;
      var k = Math.min(1, d / 160);
      p.pups.forEach(function (g) { g.style.transform = 'translate(' + (dx / d * 3.2 * k).toFixed(2) + 'px,' + (dy / d * 2.4 * k).toFixed(2) + 'px)'; });
    });
  }
  if (!reduce) setInterval(function () {
    peeks.forEach(function (p) {
      if (!p || !p.box.classList.contains('up')) return;
      if (Math.random() < .08 && !p.box.classList.contains('talking')) { p.box.classList.remove('up'); setTimeout(function () { popUp(p); }, 1200); }   // duck and pop back
    });
  }, 2400);
  if (!reduce && careTiles.length > 1) setInterval(function () {   // the eye care guy moves on to the next tile
    var p = peeks[0];
    if (!p || !p.box.classList.contains('up') || p.box.classList.contains('talking')) return;
    var vr = p.el.getBoundingClientRect();
    if (vr.bottom < 0 || vr.top > window.innerHeight) return;   // only while the section is on screen
    p.box.classList.remove('up');
    setTimeout(function () {
      careAt = (careAt + 1) % careTiles.length; SPOTS[0][0] = careSel();
      place();                                    // moves him onto the new tile; the tile watcher pops him up there
      setTimeout(function () { var r = p.el.getBoundingClientRect(); if (p.box.style.display !== 'none' && r.bottom > 0 && r.top < window.innerHeight) popUp(p); }, 900);   // (same tile, no room elsewhere: pop back up)
    }, 650);
  }, 6000);


  // ---- Thanksgiving football: near end on the footer's bottom line (under Reorder contacts / We're hiring /
  // Facebook), far end up high on the line above "Know someone...". Punted one way, thrown back in a spiral, near (bigger) on the left, far (smaller) on the
  // right, with a soft shadow on the line, a random little reaction each landing, and a short rest between throws.
  function football() {
    var host = document.querySelector('footer .foot-bottom');   // the footer's bottom line
    if (!host || theme !== 'thanksgiving') return;
    var BALL = '<svg viewBox="-4 -10 74 64" aria-hidden="true" focusable="false"><defs>' +
      '<radialGradient id="hfb-g" cx="32%" cy="28%" r="80%"><stop offset="0" stop-color="#c47a45"/><stop offset=".45" stop-color="#94481f"/><stop offset="1" stop-color="#5a2a10"/></radialGradient>' +
      '<filter id="hfb-blur" x="-20%" y="-60%" width="140%" height="220%"><feGaussianBlur class="sd" stdDeviation="0 0"/></filter></defs>' +
      '<path d="M-2 22 C8 -8 58 -8 68 22 C58 52 8 52 -2 22 Z" fill="url(#hfb-g)"/><path d="M8 4 Q4 22 8 40 M58 4 Q62 22 58 40" fill="none" stroke="#fff" stroke-width="2.2"/>' +
      '<g class="face" filter="url(#hfb-blur)"><path d="M23 1 h20 M26 -2 v6 M30 -2 v6 M34 -2 v6 M38 -2 v6 M42 -2 v6" stroke="#fff" stroke-width="1.8" stroke-linecap="round"/>' +
      '<g class="brw" stroke="#4a220e" stroke-width="2.3" stroke-linecap="round" fill="none"><path d="M16 11 q6 -3.4 12 0"/><path d="M38 11 q6 -3.4 12 0"/></g>' +
      '<circle class="ew" cx="22" cy="21" r="8" fill="#fff"/><circle class="ew" cx="44" cy="21" r="8" fill="#fff"/>' +
      '<g class="pu"><circle cx="22" cy="22" r="3.6" fill="#1d2730"/><circle cx="44" cy="22" r="3.6" fill="#1d2730"/></g>' +
      '<path class="grin" d="M27 32 Q33 37 39 32" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" opacity="0"/></g></svg>';
    var SW = '<svg viewBox="0 0 40 40"><path d="M4 34 C10 20 22 10 38 6" fill="none" stroke="#12364d" stroke-width="3" stroke-linecap="round" opacity=".45"/><path d="M2 26 C8 16 18 10 30 8" fill="none" stroke="#12364d" stroke-width="2" stroke-linecap="round" opacity=".3"/></svg>';
    var field = document.createElement('div'); footField = field;
    field.className = 'hol-field'; field.setAttribute('aria-hidden', 'true');
    field.innerHTML = '<div class="hf-shadow"></div><div class="hf-puff"></div><div class="hf-swoosh">' + SW + '</div><div class="hf-ball"><div class="hf-sz"><div class="hf-spin">' + BALL + '</div></div></div>';
    host.appendChild(field); host.classList.add('has-football');   // (makes room above the line for him)
    var ball = field.querySelector('.hf-ball'), sz = field.querySelector('.hf-sz'), spin = field.querySelector('.hf-spin'),
        face = field.querySelector('.face'), sd = field.querySelector('.sd'), pu = field.querySelector('.pu'), brw = field.querySelector('.brw'),
        grin = field.querySelector('.grin'), eyesW = field.querySelectorAll('.ew'), grad = field.querySelector('radialGradient'),
        shadow = field.querySelector('.hf-shadow'), puff = field.querySelector('.hf-puff'), swoosh = field.querySelector('.hf-swoosh');
    var size, BW, M = 8, dir = 1, pos, d, LIFT, curRot = 0;
    // the far (right) end lands up high, on the line above "Know someone who needs a good eye doctor?"
    // (phones hide that band: there it's the footer's top line, right above "Eye Associates of Miami")
    function farLift() {
      var sh = document.querySelector('.share-site'), top = sh && sh.offsetParent ? sh : host.closest('footer');
      return top ? Math.max(0, host.getBoundingClientRect().top - top.getBoundingClientRect().top) : 0;
    }
    function measure() { size = window.innerWidth < 600 ? .52 : .7; LIFT = farLift(); BW = 70 * size; sz.style.transform = 'scale(' + size + ')'; ball.style.transformOrigin = (BW / 2) + 'px ' + (58 - 58 * size / 2) + 'px'; }
    function W() { return field.clientWidth - BW * .55 - M; }
    function raf(dur, fn, done) { var t0 = null; function st(t) { if (!t0) t0 = t; var p = Math.min(1, (t - t0) / dur); fn(p); if (p < 1) requestAnimationFrame(st); else if (done) done(); } requestAnimationFrame(st); }
    function wait(ms, f) { setTimeout(f, ms); }
    // g (in flight): the height of the line under his path, blended from the line he left to the one he's headed for,
    // so the flight is one smooth arc (not bent by the ground's slope). The shadow stays on the ground under him.
    function place(x, y, rot, g) {
      var f = Math.max(0, Math.min(1, (x - M) / Math.max(1, W() - M))), s = 1.3 - .8 * f;   // near (big) on the left, far (small) on the right
      var lift = groundAt(x), abs = (g == null ? lift : g) + y * (.7 + .3 * s);
      var drop = size * (29 - 20.8 * s + 24 * Math.max(0, s - 1)) - 9 + 10 * Math.max(0, 1 - s);   // the far (right) end sits higher up the screen
      ball.style.transform = 'translate(' + x + 'px,' + (drop - abs) + 'px) rotate(' + rot + 'deg) scale(' + s + ')'; curRot = rot;
      var h = Math.max(0, abs - lift), cx = x + 35 * size + h * .25 - 31, sw = (70 * size * s * .92) / 62 * (1 + h / 220), shh = size * s * .75 * (1 + h / 400);
      shadow.style.transform = 'translate(' + cx.toFixed(1) + 'px,' + (-lift).toFixed(1) + 'px) scale(' + sw.toFixed(3) + ',' + shh.toFixed(3) + ')';
      shadow.style.opacity = Math.max(.25, .7 - h / 240); shadow.style.filter = 'blur(' + (.6 + h / 30).toFixed(1) + 'px)';
      grad.setAttribute('gradientTransform', 'rotate(' + (-rot) + ' .5 .5)');   // sunlight stays put while he spins
    }
    function faceReset() { face.removeAttribute('transform'); face.style.opacity = 1; sd.setAttribute('stdDeviation', '0 0'); spin.style.transform = ''; }
    // the ground: flat on each line near the ends (so a bounce back still sits on the line), sloping in between
    function groundAt(x) { var pad = 70; return Math.max(0, Math.min(1, (x - M - pad) / Math.max(1, W() - M - 2 * pad))) * LIFT; }
    function dust(x) { puff.style.left = (x + BW / 2 - 35) + 'px'; puff.style.bottom = (-4 + groundAt(x)) + 'px'; puff.classList.remove('go'); void puff.offsetWidth; puff.classList.add('go'); }
    function windup(x, done) {
      if (d === 'punt') {   // held out, dropped, swoosh, boot
        raf(500, function (p) { var e = 1 - Math.pow(1 - p, 3); place(x, e * 38 * size, -dir * e * 15); }, function () { wait(260, function () {
          raf(240, function (p) { place(x, 38 * size - p * p * 26 * size, -dir * (15 + p * 25)); }, function () {
            swoosh.style.left = (dir > 0 ? x - 30 * size : x + BW - 8 * size) + 'px'; swoosh.style.bottom = (6 + groundAt(x)) + 'px'; swoosh.style.transform = 'scale(' + (dir > 0 ? 1 : -1) * size + ',' + size + ')';
            swoosh.classList.remove('go'); void swoosh.offsetWidth; swoosh.classList.add('go');
            raf(110, function (p) { sz.style.transform = 'scale(' + size + ') scaleX(' + (1 - .16 * Math.sin(p * Math.PI)) + ')'; }, function () { sz.style.transform = 'scale(' + size + ')'; done({ x: x, y: 12 * size, rot: -dir * 40 }); }); }); }); });
      } else {   // scooped up, cocked back, thrown
        raf(450, function (p) { var e = 1 - Math.pow(1 - p, 3); place(x, e * 18 * size, 0); }, function () {
          raf(380, function (p) { var e = Math.sin(p * Math.PI / 2); place(x - dir * e * 10 * size, 18 * size + e * 4 * size, -dir * e * 38); }, function () {
            wait(200, function () { done({ x: x - dir * 10 * size, y: 22 * size, rot: -dir * 38 }); }); }); });
      }
    }
    function flight(st, done) {
      var x0 = st.x, y0 = st.y, r0 = st.rot, x1 = dir > 0 ? W() : M, punt = d === 'punt';
      // one clean arc from line to line: the kick rises well above the higher line; the throw is a flatter line drive
      var ph = window.innerWidth < 600 ? .72 : 1, g0 = groundAt(x0), g1 = groundAt(x1), D = g1 - g0,
          hd = document.querySelector('header'), room = host.getBoundingClientRect().top - Math.max(g0, g1) - (hd ? hd.getBoundingClientRect().bottom : 0) - 80 * size - 40,
          kick = Math.max(60 * ph, Math.min(170 * ph, room)),   // never up under the sticky header
          H = punt ? kick + Math.abs(D) / 2 + 20 : Math.abs(D) / 4 + Math.min(85 * ph, kick * .55), dur = punt ? 2700 : 2150;
      raf(dur, function (p) {
        var x = x0 + (x1 - x0) * p, y = y0 * (1 - p) + 4 * H * p * (1 - p), g = g0 + D * p, rot;
        if (punt) {
          rot = r0 + dir * 1260 * (1 - Math.pow(1 - p, 1.7));   // fast off the foot, slowing as it hangs
          var b = p > .04 && p < .9 ? (1.6 * (1 - p)).toFixed(2) : 0; sd.setAttribute('stdDeviation', b + ' ' + b);
        } else {
          var vy = -y0 + D + 4 * H * (1 - 2 * p), tan = Math.atan2(-vy, Math.abs(x1 - x0)) * 180 / Math.PI;
          rot = (dir > 0 ? tan : -tan); rot = r0 * (1 - Math.min(1, p * 6)) + rot * Math.min(1, p * 6);   // nose follows the path
          var ph = Math.PI * 2 * 22 * (p - .35 * p * p), c = Math.cos(ph), sn = Math.sin(ph), fast = 1 - .6 * p;
          spin.style.transform = 'scaleY(' + (.8 + .2 * Math.abs(c)) + ')';
          face.setAttribute('transform', 'translate(0 ' + (sn * 13).toFixed(1) + ') translate(0 21) scale(1 ' + Math.max(.12, Math.abs(c)).toFixed(2) + ') translate(0 -21)');
          face.style.opacity = c > 0 ? 1 : .1; sd.setAttribute('stdDeviation', (.4 * fast).toFixed(2) + ' ' + (p > .04 && p < .96 ? (1.2 + 2.4 * fast).toFixed(2) : 0));
        }
        place(x, y, rot, g);
      }, function () { faceReset(); done(x1); });
    }
    // How he lands (both the punt and the throw): 2 = thud + wobble, Dr. Gray's pick 2026-11-24 (the old bounces
    // looked unnatural). ?fbland=1 previews the old landings, 3..6 the other options he looked at.
    var LANDV = +((location.search.match(/[?&]fbland=(\d)/) || [])[1] || 2);
    function rock(p, a) { return a * Math.sin(p * Math.PI * 3.5) * Math.pow(1 - p, 2); }   // rocks side to side, settling
    function squish(sx, sy) { sz.style.transform = 'scale(' + size + ') scale(' + sx.toFixed(3) + ',' + sy.toFixed(3) + ')'; }
    function landAlt(x, done) {
      // start from however he came down (no snap), and turn the short way to upright (0 or a full turn)
      var r0 = ((curRot % 360) + 540) % 360 - 180, tgt = Math.abs(r0) > 90 ? (r0 > 0 ? 360 : -360) : 0;
      function lev(f) { f = Math.max(0, Math.min(1, f)); return r0 + (tgt - r0) * (1 - Math.pow(1 - f, 2)); }
      if (LANDV === 2) {   // thud + wobble: no bounce; a little squash, a short slide, rocks to a stop
        var e2 = Math.max(M, Math.min(W(), x + dir * 12));
        raf(1300, function (p) {
          var q = Math.min(1, p / .25), sq = p < .25 ? 1 - .16 * Math.sin(q * Math.PI) : 1;
          squish(1 + (1 - sq) * .8, sq);
          place(x + (e2 - x) * (1 - Math.pow(1 - Math.min(1, p * 2), 2)), 0, lev(p * 4) + rock(p, 14));
        }, function () { squish(1, 1); done(e2); });
      } else if (LANDV === 3) {   // one soft bounce: a small hop forward, tipping level, then a little rock
        var e3 = Math.max(M, Math.min(W(), x + dir * 22)), h = 12 * size;
        raf(1250, function (p) {
          var b = p < .45 ? Math.sin(p / .45 * Math.PI) * h : 0;
          place(x + (e3 - x) * Math.min(1, p / .45), b, p < .45 ? lev(p / .45) : tgt + rock((p - .45) / .55, 10));
        }, function () { done(e3); });
      } else if (LANDV === 4) {   // tumble: hits on its nose, flips end over end once (slowing), two small bounces, rocks still
        var e4 = Math.max(M, Math.min(W(), x + dir * 34)), h1 = 20 * size, h2 = 7 * size;
        var t4 = r0 + dir * (((360 - dir * r0) % 360 + 360) % 360); if (Math.abs(t4 - r0) < 160) t4 += dir * 360;   // on forward to the next upright, at least half a turn
        raf(1600, function (p) {
          var y = p < .4 ? Math.sin(p / .4 * Math.PI) * h1 : p < .62 ? Math.sin((p - .4) / .22 * Math.PI) * h2 : 0;
          var r = p < .62 ? r0 + (t4 - r0) * (1 - Math.pow(1 - p / .62, 2)) : t4 + rock((p - .62) / .38, 9);
          place(x + (e4 - x) * Math.min(1, p / .62), y, r);
        }, function () { done(e4); });
      } else if (LANDV === 5) {   // skip: two low skips forward along the ground, each smaller, then rocks still
        var e5 = Math.max(M, Math.min(W(), x + dir * 40)), a = 9 * size, b2 = 4 * size;
        raf(1400, function (p) {
          var y = p < .3 ? Math.sin(p / .3 * Math.PI) * a : p < .5 ? Math.sin((p - .3) / .2 * Math.PI) * b2 : 0;
          var r = p < .5 ? lev(p / .5) + Math.sin(p / .5 * Math.PI * 2) * 6 : tgt + rock((p - .5) / .5, 8);
          place(x + (e5 - x) * Math.min(1, p / .5), y, r);
        }, function () { done(e5); });
      } else {   // 6 · plop: lands upright, squashes, springs up a touch, settles (no travel)
        raf(1100, function (p) {
          var k = p < .2 ? Math.sin(p / .2 * Math.PI / 2) : p < .6 ? Math.cos((p - .2) / .4 * Math.PI) : 0;   // squash then stretch
          var sy = p < .2 ? 1 - .25 * k : p < .6 ? 1 - .25 * k * Math.pow(1 - (p - .2) / .4, 1.5) : 1;
          squish(1 + (1 - sy) * .6, sy);
          var hop = p > .25 && p < .6 ? Math.sin((p - .25) / .35 * Math.PI) * 6 * size : 0;
          place(x, hop, lev(p * 5) + (p > .6 ? rock((p - .6) / .4, 5) : 0));
        }, function () { squish(1, 1); done(x); });
      }
    }
    function land(x, done) {
      dust(x);
      if (LANDV >= 2) { landAlt(x, done); return; }
      if (d === 'punt') {   // a real football bounce: different every time, settles upright
        var h1 = (14 + Math.random() * 22) * size, h2 = (4 + Math.random() * 10) * size, back = Math.random() < .5 ? -1 : 1, drift = (10 + Math.random() * 24) * back;
        var end = Math.max(M, Math.min(W(), x + drift));
        raf(1000, function (p) { var y = p < .55 ? Math.sin(p / .55 * Math.PI) * h1 : Math.sin((p - .55) / .45 * Math.PI) * h2; place(x + (end - x) * p, y, dir * 360 * back * (1 - Math.pow(1 - p, 2))); }, function () { done(end); });
      } else {   // nose-first, skids, tips flat
        var end2 = Math.max(M, Math.min(W(), x + dir * 26));
        raf(800, function (p) { var e = 1 - Math.pow(1 - p, 2); place(x + (end2 - x) * e, Math.sin(Math.min(1, p * 3) * Math.PI) * 4 * size * (1 - p), (dir > 0 ? 35 : -35) * (1 - e) + Math.sin(p * Math.PI * 3) * 8 * (1 - p)); }, function () { done(end2); });
      }
    }
    var REACT = ['dizzy', 'dizzyback', 'cross', 'lookaround', 'blink', 'squint', 'lookup', 'surprise', 'grin'], lastR = null;
    function pupils(tx, ty) { pu.setAttribute('transform', 'translate(' + tx.toFixed(1) + ' ' + ty.toFixed(1) + ')'); }
    function squash(k) { eyesW.forEach(function (c) { c.setAttribute('transform', 'translate(0 21) scale(1 ' + k + ') translate(0 -21)'); }); pu.setAttribute('transform', 'translate(0 21) scale(1 ' + k + ') translate(0 -21)'); }
    function unsquash() { eyesW.forEach(function (c) { c.removeAttribute('transform'); }); pu.removeAttribute('transform'); }
    function react(done) {
      var a; do { a = REACT[Math.floor(Math.random() * REACT.length)]; } while (a === lastR); lastR = a;
      if (a === 'dizzy' || a === 'dizzyback') { var turns = (1.5 + Math.random() * 1.5) * (a === 'dizzy' ? 1 : -1); raf(1200, function (p) { var t = p * Math.PI * 2 * turns; pupils(Math.cos(t) * 2.6, Math.sin(t) * 2.6); }, function () { pu.removeAttribute('transform'); done(); }); }
      else if (a === 'cross') { pupils(0, 0); pu.children[0].setAttribute('cx', 25); pu.children[1].setAttribute('cx', 41); wait(1100, function () { pu.children[0].setAttribute('cx', 22); pu.children[1].setAttribute('cx', 44); pu.removeAttribute('transform'); done(); }); }
      else if (a === 'lookaround') { raf(1400, function (p) { pupils(p < .35 ? -3 * Math.min(1, p / .15) : p < .7 ? 3 * Math.min(1, (p - .35) / .15) : 3 * (1 - Math.min(1, (p - .7) / .15)), 0); }, function () { pu.removeAttribute('transform'); done(); }); }
      else if (a === 'blink') { raf(700, function (p) { squash((p < .2 || (p > .45 && p < .65)) ? .1 : 1); }, function () { unsquash(); done(); }); }
      else if (a === 'squint') { raf(1100, function (p) { squash(1 - .7 * Math.sin(Math.min(1, p * 1.4) * Math.PI)); }, function () { unsquash(); done(); }); }
      else if (a === 'lookup') { raf(1200, function (p) { var e = Math.sin(p * Math.PI); pupils(dir * 1.2 * e, -3.2 * e); }, function () { pu.removeAttribute('transform'); done(); }); }
      else if (a === 'surprise') { brw.setAttribute('transform', 'translate(0 -4)'); wait(700, function () { brw.removeAttribute('transform'); grin.setAttribute('opacity', '1'); wait(1000, function () { grin.setAttribute('opacity', '0'); done(); }); }); }
      else { grin.setAttribute('opacity', '1'); wait(1100, function () { grin.setAttribute('opacity', '0'); done(); }); }
    }
    var turn = 0, running = false;
    function loop() {
      if (!running) return;
      if (field.dataset.hold) { wait(400, loop); return; }   // talking (Call / Directions): stay put
      d = turn++ % 2 ? 'spiral' : 'punt'; LIFT = farLift();
      // his reaction (eye roll, look around, etc.) starts right as he lands, while he's still bouncing / rocking
      // (John: it came too late, after the landing finished); the next throw waits for both to finish
      windup(pos, function (st) { flight(st, function (x) {
        var left = 2, next = function () { if (--left === 0) wait(900, function () { dir = -dir; loop(); }); };
        land(x, function (x2) { pos = x2; next(); });
        wait(250, function () { react(next); });
      }); });
    }
    measure(); pos = M; place(M, 0, 0);
    if (reduce) return;   // "reduce motion": he just sits there
    // only play while the strip is on screen
    new IntersectionObserver(function (es) {
      var on = es[0].isIntersecting;
      if (on && !running) { running = true; wait(400, loop); } else if (!on) running = false;
    }).observe(field);
    var rt2 = 0;
    window.addEventListener('resize', function () { clearTimeout(rt2); rt2 = setTimeout(function () { measure(); }, 200); });
  }
  // ---- When someone taps Call or Directions and the hiring-card guy isn't on screen, the holiday character
  // nearest the middle of the screen answers instead (hiring-eyes.js asks for it): a speech bubble beside him,
  // and for calls a little front-desk headset on his head. talk() returns a function that puts it all away.
  var footField = null;
  // two parts: the band over his head goes UNDER any hat/antlers; the ear cups + mic go on top
  var HEADSET_BAND = '<g class="hol-headset"><path d="M4.5 16 C4.5 -6 61.5 -6 61.5 16" fill="none" stroke="#dfe6eb" stroke-width="3.2" stroke-linecap="round"/></g>';
  var HEADSET = '<g class="hol-headset">' +
    '<rect x="0.5" y="11" width="7.5" height="14" rx="3.75" fill="#7a2a3c"/><rect x="58" y="11" width="7.5" height="14" rx="3.75" fill="#7a2a3c"/>' +
    '<path d="M4 24 C4 30 10 32 18 31" fill="none" stroke="#dfe6eb" stroke-width="2.2" stroke-linecap="round"/><circle cx="19.5" cy="31" r="2.8" fill="#7a2a3c"/></g>';
  function onScreenRect(r) {   // really visible: below the sticky top menu and above the bottom of the screen
    var hd = document.querySelector('header'), top = hd ? hd.getBoundingClientRect().bottom : 0;
    return r.top >= top - 4 && r.bottom <= window.innerHeight - 10 && r.width > 0;
  }
  function bubbleBeside(host, target, text, scoot) {
    var b = target.getBoundingClientRect(), c = host.getBoundingClientRect();
    var bub = document.createElement('span');
    bub.className = 'he-say'; bub.setAttribute('aria-hidden', 'true');
    if (window.EAOMHiringEyes && EAOMHiringEyes.fillBubble) EAOMHiringEyes.fillBubble(bub, text);
    else bub.textContent = typeof text === 'string' ? text : text.text;
    host.appendChild(bub);
    // beside him, never on top of him: left if it fits, else right; if neither fits, the roomier side with the
    // bubble narrowed to fit (its text wraps)
    var vw = document.documentElement.clientWidth, roomL = b.left - 10 - 8, roomR = vw - 8 - (b.right + 10), w = bub.offsetWidth;
    // no side has room for the whole bubble (phones): he scoots over toward the edge while he talks, so the bubble
    // gets a full line instead of a chopped-up narrow column (John)
    if (scoot && w > Math.max(roomL, roomR)) {
      var goR = Math.min(w - roomL, vw - 14 - b.right), goL = Math.min(w - roomR, b.left - 14);
      var s = roomL + Math.max(goR, 0) >= roomR + Math.max(goL, 0) ? Math.max(goR, 0) : -Math.max(goL, 0);
      if (s) {
        target.style.translate = s + 'px 0';
        b = { left: b.left + s, right: b.right + s, top: b.top, height: b.height };
        roomL = b.left - 10 - 8; roomR = vw - 8 - (b.right + 10);
      }
    }
    var right = w > roomL && (w <= roomR || roomR > roomL);
    if (w > (right ? roomR : roomL) && Math.max(roomL, roomR) >= 120) { bub.style.maxWidth = Math.floor(right ? roomR : roomL) + 'px'; w = bub.offsetWidth; }
    if (right) bub.classList.add('right');
    var leftSide = right ? b.right - c.left + 10 : b.left - c.left - w - 10, x = c.left + leftSide;
    if (x < 8) leftSide += 8 - x;   // (only when there's really no room: a very narrow screen)
    bub.style.left = leftSide + 'px';
    var at = scoot ? b.height - Math.min(14, b.height * .25) : b.height / 2;   // characters: the tail points at the mouth (near the edge he peeks over), not his eyes (John)
    bub.style.top = (b.top - c.top + at - bub.offsetHeight / 2) + 'px';
    var hd = document.querySelector('header'), min = (hd ? hd.getBoundingClientRect().bottom : 0) + 6, t = c.top + parseFloat(bub.style.top);
    if (t < min) { bub.style.top = (parseFloat(bub.style.top) + (min - t)) + 'px'; t = min; }   // never under the top menu
    var cb = document.querySelector('.callbar'), max = cb && cb.getClientRects().length ? cb.getBoundingClientRect().top - 8 : window.innerHeight - 8;
    if (t + bub.offsetHeight > max) bub.style.top = (parseFloat(bub.style.top) - (t + bub.offsetHeight - max)) + 'px';   // nor behind the bottom bar
    return bub;
  }
  // Where the headset band goes so it sits UNDER a hat (or antlers) instead of over it: his head is the last shape
  // drawn before his eyes that covers his eye; a hat drawn after the head -> band just before the hat; a hat drawn
  // behind the head (pilgrim) -> band at the very back. No hat -> null (on top).
  function bbox(el) { try { return el.getBBox(); } catch (e) { return null; } }
  // his head: a shape drawn before his eyes that covers an eye. last = the last such shape (what's drawn just
  // under his face); otherwise the biggest one that doesn't reach up past his head (not the turkey's fan or the tree)
  function headIndex(svg, whites, last) {
    var kids = Array.prototype.slice.call(svg.children), first = whites.length ? kids.indexOf(whites[0]) : -1;
    if (first < 0) return -1;
    var eye = { x: +whites[0].getAttribute('cx'), y: +whites[0].getAttribute('cy') }, head = -1, area = 0;
    for (var i = 0; i < first; i++) {
      var b = bbox(kids[i]);
      if (!b || b.x > eye.x || b.x + b.width < eye.x || b.y > eye.y || b.y + b.height < eye.y) continue;
      if (last) head = i;
      else if (b.y >= -2 && b.width * b.height > area) { area = b.width * b.height; head = i; }
    }
    return head;
  }
  function bandSpot(svg, whites) {
    var kids = Array.prototype.slice.call(svg.children), head = headIndex(svg, whites, true), box = bbox;
    function up(el) { var b = box(el); return b && b.y < -2 && !(el.classList && el.classList.contains('snow')); }
    if (head < 0) return null;
    var hb = box(kids[head]);
    if (hb && hb.y < -2) return kids[0];   // a tall head (the tree): band behind him, only the ear cups + mic show
    for (var j = head + 1; j < kids.length; j++) if (up(kids[j])) return kids[j];
    for (var k = 0; k < head; k++) if (up(kids[k])) return kids[0];
    return null;
  }
  // Where each character's headset goes (in his own drawing): l/r = the ear cups' centers (on his ears when he
  // has ears; otherwise right on the sides of his head), t = how high the band reaches over his head, m = the tip of the mic (beside his mouth, below his eyes).
  var HS = {
    santa: { l: [1, 21], r: [65, 21], t: -1, m: [17, 35] },
    elfhat: { l: [1, 21], r: [65, 21], t: -1, m: [17, 35] },
    pilgrim: { l: [1, 23], r: [65, 23], t: -1, m: [16, 37] },
    turkey: { l: [5, 20], r: [61, 20], t: 1, m: [20, 35] },
    turkeyplain: { l: [5, 19], r: [61, 19], t: 1, m: [20, 34] },
    tree: { l: [15, 4], r: [51, 4], t: -10, m: [25, 13] },
  };
  // The headset for one character, drawn to those spots: [band (goes under a hat), ear cups + mic (on top)].
  function headsetFor(a) {
    var lx = a.l[0], ly = a.l[1], rx = a.r[0], ry = a.r[1], k = (rx - lx) / 57, f = function (n) { return (+n).toFixed(1); };
    var by = Math.min(ly, ry) - 2 * k, c = (a.t - .25 * by) / .75;   // a curve that peaks at t
    var band = '<path d="M' + f(lx) + ' ' + f(ly - 2 * k) + ' C' + f(lx) + ' ' + f(c) + ' ' + f(rx) + ' ' + f(c) + ' ' + f(rx) + ' ' + f(ry - 2 * k) + '" fill="none" stroke="#dfe6eb" stroke-width="' + f(3.2 * k) + '" stroke-linecap="round"/>';
    var cw = 7.5 * k, ch = 14 * k, cup = a.round ? function (x, y) { return '<circle cx="' + f(x) + '" cy="' + f(y) + '" r="' + f(a.round) + '" fill="#7a2a3c"/>'; } : function (x, y) { return '<rect x="' + f(x - cw / 2) + '" y="' + f(y - ch / 2) + '" width="' + f(cw) + '" height="' + f(ch) + '" rx="' + f(cw / 2) + '" fill="#7a2a3c"/>'; };
    var sx = lx - .25 * k, sy = ly + (a.round ? a.round * .8 : 6 * k), mx = a.m[0], my = a.m[1];
    var boom = '<path d="M' + f(sx) + ' ' + f(sy) + ' C' + f(sx) + ' ' + f(my) + ' ' + f((sx + mx) / 2) + ' ' + f(my + 1.2 * k) + ' ' + f(mx - 1.5 * k) + ' ' + f(my) + '" fill="none" stroke="#dfe6eb" stroke-width="' + f(2.2 * k) + '" stroke-linecap="round"/>';
    return [band, cup(lx, ly) + cup(rx, ry) + boom + '<circle cx="' + f(mx) + '" cy="' + f(my) + '" r="' + f(2.8 * k) + '" fill="#7a2a3c"/>'];
  }
  function peekTalker(p) {
    return {
      talk: function (text, headset) {
        var svg = p.box.querySelector('svg'), hs = null;
        p.box.classList.add('talking');
        if (headset && HS[p.ch || p.box.dataset.ch] === false) headset = false;   // this one answers without a headset
        if (WX) headset = false;   // buried in snow / frozen in ice: no headset (Dr. Gray)
        if (headset) {
          // fit the headset to his head (the headset is drawn for the main guy's head: x 1-65, y 2-42), so the ear
          // cups sit on the sides of his head and the band follows its top, whatever shape he is
          var whites = Array.prototype.filter.call(svg.querySelectorAll('circle'), function (c) {
            return /^#?f{3,6}$/i.test((c.getAttribute('fill') || '').replace('#', '')) && +c.getAttribute('r') >= 5
              && +c.getAttribute('cy') > -2;   // not a hat's white pompom
          });
          var tf, hi = headIndex(svg, whites), head = hi >= 0 ? svg.children[hi] : (whites.length ? null : svg.children[0]), hb = head && bbox(head);
          if (hb && hb.y >= -2 && hb.width > 20) {   // a normal head (not the tall tree)
            var kx = hb.width / 64, ky = hb.height / 40;
            tf = 'translate(' + (hb.x - kx).toFixed(1) + ' ' + (hb.y - 2 * ky).toFixed(1) + ') scale(' + kx.toFixed(3) + ' ' + ky.toFixed(3) + ')';
          } else if (whites.length >= 2) {           // the tree: fit it to his face (his eyes)
            var l = Infinity, r = -Infinity, cy = 0;
            whites.forEach(function (c) { var x = +c.getAttribute('cx'), rr = +c.getAttribute('r'); l = Math.min(l, x - rr); r = Math.max(r, x + rr); cy += +c.getAttribute('cy'); });
            cy /= whites.length;
            var k = (r - l) / 43;
            tf = 'translate(' + (l - 11.5 * k).toFixed(1) + ' ' + (cy - 19 * k).toFixed(1) + ') scale(' + k.toFixed(3) + ')';
          } else {
            var bb = svg.getBBox(), k2 = bb.width / 66;
            tf = 'translate(' + bb.x.toFixed(1) + ' ' + bb.y.toFixed(1) + ') scale(' + k2.toFixed(3) + ')';
          }
          var open = '<g class="hol-headset" transform="' + tf + '">', parts = null, a = HS[p.ch || p.box.dataset.ch];
          if (a) { parts = headsetFor(a); open = '<g class="hol-headset">'; }   // drawn to his own ears and mouth
          var band = parts ? open + parts[0] + '</g>' : HEADSET_BAND.replace('<g class="hol-headset">', open), spot = bandSpot(svg, whites);
          if (spot) spot.insertAdjacentHTML('beforebegin', band); else svg.insertAdjacentHTML('beforeend', band);
          svg.insertAdjacentHTML('beforeend', parts ? open + parts[1] + '</g>' : HEADSET.replace('<g class="hol-headset">', open));
          hs = svg.querySelectorAll('.hol-headset');
        }
        var bub = bubbleBeside(p.el, p.box, text, true);
        return function () { bub.classList.add('out'); p.box.classList.remove('talking'); p.box.style.translate = ''; setTimeout(function () { bub.remove(); if (hs) Array.prototype.forEach.call(hs, function (e) { e.remove(); }); }, 300); };
      }
    };
  }
  function footTalker() {
    var ball = footField.querySelector('.hf-ball');
    return { talk: function (text) {
      footField.dataset.hold = '1';           // finishes the throw it's in, then waits while it's talking
      var bub = bubbleBeside(footField, ball, text), live = true;
      (function follow() {                    // the bubble rides along with the ball
        if (!live) return;
        var b = ball.getBoundingClientRect(), c = footField.getBoundingClientRect(), right = bub.classList.contains('right');
        bub.style.left = (right ? b.right - c.left + 10 : b.left - c.left - bub.offsetWidth - 10) + 'px';
        var at = scoot ? b.height - Math.min(14, b.height * .25) : b.height / 2;   // characters: the tail points at the mouth (near the edge he peeks over), not his eyes (John)
    bub.style.top = (b.top - c.top + at - bub.offsetHeight / 2) + 'px';
        requestAnimationFrame(follow);
      })();
      return function () { live = false; delete footField.dataset.hold; bub.classList.add('out'); setTimeout(function () { bub.remove(); }, 300); };
    } };
  }
  // the holiday outfit for small extra characters elsewhere (the review card's little guy: a random one each visit)
  window.EAOMHoliday.character = function () {
    var c = C[cardCh];
    return typeof c === 'string' ? { vb: VB, svg: c } : c;
  };
  window.EAOMHoliday.responder = function () {
    var best = null, bd = Infinity, mid = window.innerHeight / 2;
    var cp = peeks[0];
    if (cp && cp.callOnly && !cp.box.classList.contains('talking') && !onScreenRect(cp.box.getBoundingClientRect())) {
      for (var k = 0; k < careTiles.length; k++) {   // the Eye care one answers from whichever of his tiles is on screen
        careAt = k; SPOTS[0][0] = careSel(); place();
        if (cp.box.style.display !== 'none' && onScreenRect(cp.box.getBoundingClientRect())) break;
      }
    }
    peeks.forEach(function (p) {
      if (!p || p.box.style.display === 'none' || (!p.box.classList.contains('up') && !p.callOnly)) return;
      var r = p.box.getBoundingClientRect();   // (the Eye care one: where he'd pop up, even while he's down)
      if (!onScreenRect(r)) return;
      var dd = Math.abs(r.top + r.height / 2 - mid);
      if (dd < bd) { bd = dd; best = p; }
    });
    var go = document.querySelector('#review-cta:not([hidden]) .rc-go'), rg = go && go.querySelector('.rc-guy.themed:not(.plain)');   // (weather: the plain guy there doesn't answer calls)
    if (rg) {   // the review card's own holiday guy (index.html) answers too (popping up if he'd ducked)
      var rr = rg.getBoundingClientRect();
      if (onScreenRect(rr) && Math.abs(rr.top + rr.height / 2 - mid) < bd) {
        var t = peekTalker({ box: rg, el: go, ch: cardCh });
        // he first hops over to the 5th star (the right end), so his speech bubble has room beside him instead of
        // covering him up when he was over star 1 or the middle (John)
        return { talk: function (text, headset) {
          var stars = go.querySelectorAll('.rc-star'), f = stars[stars.length - 1], stop = null, off = false;
          var gr = go.getBoundingClientRect(), fr = f.getBoundingClientRect();
          var to = fr.left + fr.width / 2 - (gr.left + gr.width / 2), was = go.classList.contains('five') ? parseFloat(go.style.getPropertyValue('--to5')) || 0 : 0;
          var wasUp = go.classList.contains('up'), hop = wasUp && Math.abs(to - was) > 4;
          go.classList.remove('lookl', 'lookr', 'no', 'nod', 'track');
          go.style.setProperty('--to5', to + 'px'); go.classList.add('up', 'five', 'back');
          var svg = rg.querySelector('svg');
          if (hop && svg && svg.animate) svg.animate([{ transform: 'none' }, { transform: 'translateY(3px) scale(1.05,.93)', offset: .12 }, { transform: 'translateY(-12px)', offset: .5 }, { transform: 'translateY(2px)', offset: .85 }, { transform: 'none' }], { duration: 560, easing: 'ease-in-out' });
          setTimeout(function () { if (!off) stop = t.talk(text, headset); }, hop || !wasUp ? 600 : 0);
          return function () { off = true; if (stop) stop(); };
        } };
      }
    }
    if (best && best.callOnly) {   // the Eye care one: pops up from behind his tile to answer, and ducks back down after
      var t0 = peekTalker(best);
      return { talk: function (text, headset) {
        var stop = null, off = false, was = best.box.classList.contains('up');
        best.box.classList.add('up');
        setTimeout(function () { if (!off) stop = t0.talk(text, headset); }, was ? 0 : 500);
        return function () { off = true; if (stop) stop(); setTimeout(function () { if (!best.box.classList.contains('talking')) best.box.classList.remove('up'); }, 350); };
      } };
    }
    if (best) return peekTalker(best);
    if (footField && onScreenRect(footField.getBoundingClientRect()) && footField.querySelector('.hf-ball').getBoundingClientRect().width) return footTalker();
    return null;
  };

  function start() { place(); football(); }
  if (document.readyState === 'complete') start(); else window.addEventListener('load', start);
  var rt = 0;
  window.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(place, 200); });
  // content (insurance list, hiring card) fills in after load: re-place once it settles
  setTimeout(place, 1500); setTimeout(place, 4000);
})();
