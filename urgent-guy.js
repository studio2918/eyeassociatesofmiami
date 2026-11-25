// The little guy with the sore pink eye in the Urgent eye care tile (Dr. Gray picked him 2026-11-24).
// While the tile is on screen, on a loop: he pops up from the tile's bottom edge (left of his usual spot, sore eye),
// heads out past the tile's right side, stays out of sight a bit, comes back in from the right all better (both eyes
// fine, a big smile), then dips back down and starts over. How he travels is a "move" (MOVES below). His eyes follow
// the mouse (phones: they glance around / follow taps). Tap him: he blinks. Reduce motion: he's just there, happy.
// EAOMUrgentGuy.start(tile, {move}) puts one in any tile (options/urgent-moves.html shows the moves side by side).
(function () {
  var NAVY = '#12364d', INK = '#1d2730';
  // cls: the class he wears while traveling (site.css); pre: a wind-up before leaving (ms); out/back: travel times + easing
  var MOVES = {
    waddle: { cls: 'mv-waddle', out: [1100, 'ease-in'], back: [900, 'cubic-bezier(.2,.9,.3,1.15)'] },
    hop:    { cls: 'mv-hop', out: [1300, 'linear'], back: [1100, 'linear'] },
    glide:  { cls: 'mv-glide', out: [900, 'cubic-bezier(.5,0,.6,1)'], back: [1000, 'cubic-bezier(.2,.8,.3,1)'] },
    sneak:  { cls: 'mv-sneak', out: [1700, 'ease-in-out'], back: [1600, 'ease-in-out'] },
    dash:   { cls: 'mv-dash', pre: 380, out: [420, 'cubic-bezier(.6,0,.9,.5)'], back: [600, 'cubic-bezier(.1,.9,.3,1.25)'] },
    roll:   { cls: 'mv-roll', out: [1100, 'ease-in'], back: [1000, 'cubic-bezier(.2,.8,.3,1)'] },
    bounce: { cls: 'mv-bounce', out: [1400, 'linear'], back: [1200, 'linear'] }
  };
  var DEFAULT_MOVE = 'hop';   // Dr. Gray picked the hop 2026-11-24

  function eye(x, cls) {
    return '<circle class="' + cls + '" cx="' + x + '" cy="19" r="9.5" fill="#fff"/>' +
      '<g class="ug-pp"><circle cx="' + x + '" cy="20" r="4" fill="' + INK + '"/><circle cx="' + (x + 1.3) + '" cy="18.5" r="1.2" fill="#fff"/></g>';
  }
  var SVG = '<svg viewBox="-1 -9 68 56" focusable="false"><g class="ug-all">' +
    '<rect x="1" y="2" width="64" height="44" rx="18" fill="' + NAVY + '"/>' +
    '<g class="ug-sad" stroke="' + NAVY + '" stroke-width="2.8" stroke-linecap="round" fill="none"><path d="M14 -1 Q21 -3 28 -6"/><path d="M38 -6 Q45 -3 52 -1"/></g>' +
    '<g class="ug-glad" stroke="' + NAVY + '" stroke-width="2.8" stroke-linecap="round" fill="none"><path d="M14 -3.5q7-4 14 0"/><path d="M38 -3.5q7-4 14 0"/></g>' +
    '<g class="ug-open">' + eye(21, 'ug-sorei') + eye(45, '') +
    '<g class="ug-lid"><circle cx="21" cy="19" r="10" fill="' + NAVY + '"/><circle cx="45" cy="19" r="10" fill="' + NAVY + '"/></g></g>' +
    // the big closed-eye smile (like the hiring guy's when you tap Share this job)
    '<g class="ug-joy" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round"><path d="M13 21q8 -9 16 0"/><path d="M37 21q8 -9 16 0"/></g>' +
    '<path class="ug-flat" d="M28 37 h10" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/>' +
    '<path class="ug-smile" d="M25 33 q8 8 16 0" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round"/>' +
    '</g></svg>';

  var still = window.matchMedia('(prefers-reduced-motion: reduce)');
  var touch = window.matchMedia('(hover: none)');

  function start(tile, opts) {
    if (!tile || !('IntersectionObserver' in window)) return;
    var mv = MOVES[(opts && opts.move) || DEFAULT_MOVE] || MOVES[DEFAULT_MOVE];
    var strip = document.createElement('span');   // the bottom band of the tile; he's clipped by its bottom and sides
    strip.className = 'urg-strip';
    strip.setAttribute('aria-hidden', 'true');
    strip.innerHTML = '<span class="urg-guy sore">' + SVG + '</span>';
    tile.appendChild(strip);
    var guy = strip.firstChild, pups = guy.querySelectorAll('.ug-pp');

    function px(x, y, ms, ease) {
      guy.style.transition = ms ? 'transform ' + ms + 'ms ' + (ease || 'ease') : 'none';
      guy.style.transform = 'translate(' + x + 'px,' + y + 'px)';
    }
    function geo() {   // x positions inside the strip
      var w = strip.clientWidth, g = guy.offsetWidth, h = guy.offsetHeight, note = tile.querySelector('.note'), textRight = 0;
      if (note) {   // where the last line of "Call us right away. We'll get you in." ends, so he starts just past it
        var rg = document.createRange(); rg.selectNodeContents(note);
        var rs = rg.getClientRects(), sr = strip.getBoundingClientRect();
        if (rs.length) textRight = rs[rs.length - 1].right - sr.left;
      }
      var home = w - g - (window.innerWidth > 860 ? 22 : 16);
      var st = Math.max(Math.min(textRight + 22, home - 40), w * .3);
      return { start: Math.min(st, home), home: home, out: w + 12, down: h + 4 };
    }
    function face(f) { guy.classList.toggle('sore', f === 'sore'); guy.classList.toggle('happy', f === 'happy'); }
    // while he travels he looks where he's going (right on the way out, left on the way back), not at the mouse
    var heading = 0;
    function travel(on, back) {
      guy.classList.toggle(mv.cls, on); guy.classList.toggle('back', !!back);
      heading = on ? (back ? -1 : 1) : 0;
      if (heading) pups.forEach(function (q) { q.style.transform = 'translate(' + (heading * 3) + 'px,0)'; });
    }

    // One round. Repeats while the tile is on screen; starts over (sore) each time.
    var inView = false, running = false;
    function round() {
      if (!inView) { running = false; return; }
      running = true;
      var p = geo(), pre = mv.pre || 0;
      var leave = 2300, gone = leave + pre + mv.out[0], ret = gone + 2500, home = ret + mv.back[0], dip = home + 3000, next = dip + 3000;
      function at(ms, fn) { setTimeout(fn, ms); }
      face('sore'); guy.classList.remove('cheer', 'wind', 'joy'); px(p.start, p.down, 0);   // hidden under the bottom edge
      requestAnimationFrame(function () { requestAnimationFrame(function () {
        px(p.start, 0, 450, 'cubic-bezier(.3,1.5,.5,1)');                              // pop up, sore eye
        at(leave, function () { travel(true); if (pre) guy.classList.add('wind'); });   // off to the right
        at(leave + pre, function () { guy.classList.remove('wind'); px(p.out, 0, mv.out[0], mv.out[1]); });
        at(gone + 100, function () { face('happy'); travel(false); });   // (no tear: John 2026-11-24)   // out of sight: all better
        at(ret, function () { travel(true, true); px(p.home, 0, mv.back[0], mv.back[1]); });             // back in from the right
        at(home, function () { travel(false); guy.classList.add('cheer', 'joy'); });   // home: big eye smile, kept as he dips down
        at(dip, function () { guy.classList.remove('cheer'); px(p.home, p.down, 450, 'ease-in'); });      // dip back down
        at(next, round);                                                                                  // a pause under the edge, then again
      }); });
    }
    requestAnimationFrame(function () { var p = geo(); px(p.start, p.down, 0); });
    if (still.matches) requestAnimationFrame(function () { face('happy'); px(geo().home, 0, 0); });
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        inView = e.isIntersecting;
        if (inView && !running && !still.matches) setTimeout(function () { if (!running && inView) round(); }, 700);
      });
    }, { threshold: 1, rootMargin: '0px 0px ' + (window.innerWidth > 860 ? -20 : -96) + 'px 0px' });   // the bottom of the card (where he
    io.observe(strip);                                                                                    // pops up) fully on screen, above the phone Call bar
    window.addEventListener('resize', function () { if (still.matches) px(geo().home, 0, 0); });

    function lookAt(x, y) {
      var r = guy.getBoundingClientRect();
      if (!r.width || heading) return;
      var dx = x - (r.left + r.width / 2), dy = y - (r.top + r.height * .45), m = Math.hypot(dx, dy) || 1, k = Math.min(1, m / 60) * 2.6;
      var t = 'translate(' + (dx / m * k).toFixed(2) + 'px,' + (dy / m * k).toFixed(2) + 'px)';
      pups.forEach(function (q) { q.style.transform = t; });
    }
    document.addEventListener('pointermove', function (e) { if (e.pointerType === 'mouse') lookAt(e.clientX, e.clientY); }, { passive: true });
    document.addEventListener('pointerdown', function (e) { lookAt(e.clientX, e.clientY); }, { passive: true });
    function blink() { guy.classList.add('blink'); setTimeout(function () { guy.classList.remove('blink'); }, 320); }
    guy.addEventListener('click', blink);
    setInterval(function () {   // glance around (phones) and blink now and then while on screen
      var r = guy.getBoundingClientRect();
      if (r.bottom < 0 || r.top > window.innerHeight || still.matches) return;
      if (touch.matches) lookAt(r.left + r.width / 2 + (Math.random() - .5) * 400, r.top + (Math.random() - .5) * 400);
      if (Math.random() < .35) blink();
    }, 1800);
  }

  window.EAOMUrgentGuy = { start: start, moves: Object.keys(MOVES) };
  if (!window.EAOM_URGENT_GUY_MANUAL) start(document.querySelector('#care .tile:nth-child(3)'));   // (the options page places its own)
})();
