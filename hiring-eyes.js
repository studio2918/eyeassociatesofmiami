/*
  The little eyes that peek over the main page's "We're hiring" card (demo option M1, Dr. Gray 2026-11-21).
    - peek up over the card's top-right edge (only the eyes show; the head stays tucked)
    - watch the job name type itself in, then look at "Join our team"
    - follow the cursor; each eye aims on its own, so they cross when it's between them
      (phones: they look where you tap)
    - "Share this job": happy squint + eyebrows lift + a little bounce
    - "Join our team": pupils dilate + a little bounce + hearts float up (computer: they keep coming
      while the cursor is on the button, until it's clicked; after ~2 s they look at the visitor,
      nod, and look back at the cursor)
      (phones: a tap plays it for a moment; Join waits ~0.65 s before opening the Careers page)
    - blink now and then; every so often duck down and pop back up
  Once the hiring card scrolls completely off the screen, he roams: ducks out and peeks over something else on
  screen (Eye care, the doctors, the insurance boxes, Come see us), only where he covers no words, then goes
  home when the card comes back. Runs only while the card is showing. "Reduce motion": the eyes sit still.
*/
(function () {
  var activeFn = null;   // set in start(): is he busy answering a call / hopping (see active() at the bottom)
  // Holiday outfits (holiday.js sets EAOMHoliday.theme, and picks EAOMHoliday.outfit at random each visit):
  // christmas = any of the holiday characters (Santa hat, elf, tree); thanksgiving = turkey in a pilgrim hat /
  // plain turkey / pilgrim. A themed guy is taller (feathers / hat), so his box gets extra headroom (.hire-eyes.themed).
  var THEME = window.EAOMHoliday && EAOMHoliday.theme;
  var OUTFIT = THEME ? (EAOMHoliday.outfit || (THEME === 'thanksgiving' ? 'turkey' : 'santa')) : '';
  var TURKEY = OUTFIT === 'turkey' || OUTFIT === 'turkeyplain';
  var BODY = TURKEY ? '#8a5a3b' : OUTFIT === 'tree' ? '#2f7d4f' : '#12364d';
  var EDGE = '', LINE = '#fff';   // (outline / dark happy-eye lines: for a light-colored guy, none right now)
  var NO_HEADSET = /^(snow|ice)$/.test(OUTFIT);   // buried in snow / frozen in ice: answers without a headset
  // the tree: the same tiered tree the section characters use (holiday.js), with his eyes in its upper tiers
  var TR = OUTFIT === 'tree' ? {"body": "<g transform=\"translate(0 5)\"><g transform=\"rotate(12 33 -33)\"><path class=\"star\" d=\"M33 -41 L35.4 -35 L41.8 -35 L36.7 -31.2 L38.6 -25 L33 -28.8 L27.4 -25 L29.3 -31.2 L24.2 -35 L30.6 -35 Z\" fill=\"#f1c40f\"/></g><path d=\"M33 -28 C36 -22 42 -14 44 -11 C43 -10 42 -10 41 -9.5 C46 -3 52 5 56 10 C54 11 52 11.5 50 12 C56 19 61 26 65 33 Q33 40 1 33 C5 26 10 19 16 12 C14 11.5 12 11 10 10 C14 5 20 -3 25 -9.5 C24 -10 23 -10 22 -11 C24 -14 30 -22 33 -28 Z\" fill=\"#2f7d4f\" stroke=\"#256a41\" stroke-width=\"1.4\" stroke-linejoin=\"round\"/><path d=\"M27 -16 Q33 -12 40 -17\" fill=\"none\" stroke=\"#1d2730\" stroke-width=\".8\" opacity=\".5\"/><path d=\"M6 27 Q33 37 60 26\" fill=\"none\" stroke=\"#1d2730\" stroke-width=\".8\" opacity=\".5\"/><circle class=\"bulb b0\" cx=\"27\" cy=\"-15\" r=\"2.1\" fill=\"#e74c3c\"/><circle class=\"bulb b1\" cx=\"33\" cy=\"-13\" r=\"2.1\" fill=\"#f1c40f\"/><circle class=\"bulb b2\" cx=\"39\" cy=\"-16\" r=\"2.1\" fill=\"#3498db\"/><circle class=\"bulb b0\" cx=\"7\" cy=\"28\" r=\"2.1\" fill=\"#2ecc71\"/><circle class=\"bulb b1\" cx=\"15\" cy=\"31\" r=\"2.1\" fill=\"#e74c3c\"/><circle class=\"bulb b2\" cx=\"24\" cy=\"33\" r=\"2.1\" fill=\"#f1c40f\"/><circle class=\"bulb b0\" cx=\"33\" cy=\"33.5\" r=\"2.1\" fill=\"#3498db\"/><circle class=\"bulb b1\" cx=\"42\" cy=\"33\" r=\"2.1\" fill=\"#2ecc71\"/><circle class=\"bulb b2\" cx=\"51\" cy=\"30\" r=\"2.1\" fill=\"#e74c3c\"/><circle class=\"bulb b0\" cx=\"59\" cy=\"27\" r=\"2.1\" fill=\"#f1c40f\"/></g>", "front": "<g transform=\"translate(0 5)\"><ellipse cx=\"15\" cy=\"9\" rx=\"3.2\" ry=\"2\" fill=\"#e8798b\" opacity=\".7\"/><ellipse cx=\"51\" cy=\"9\" rx=\"3.2\" ry=\"2\" fill=\"#e8798b\" opacity=\".7\"/><path d=\"M28 9 Q33 14 38 9\" fill=\"none\" stroke=\"#1d2730\" stroke-width=\"1.8\" stroke-linecap=\"round\"/><path d=\"M11 13 Q33 21 55 12 L57 18 Q33 27 9 19 Z\" fill=\"#c0392b\"/><path d=\"M14 15 l2 5 M20 17 l2 5 M26 18 l2 5 M32 19 l2 5 M38 18 l2 5 M44 17 l2 5 M50 15 l2 5\" stroke=\"#a93226\" stroke-width=\"1\"/><path d=\"M46 19 L50 33 L56 32 L52 18 Z\" fill=\"#c0392b\"/><path d=\"M47 30 h9\" stroke=\"#fff\" stroke-width=\"1.4\"/></g>", "browp": "<path d=\"M19 -6.6 q5 -3.4 10 0\"/><path d=\"M37 -6.6 q5 -3.4 10 0\"/>"} : null;
  // eye spots: the tree's sit up in his branches
  var EX1 = TR ? 24 : 21, EX2 = TR ? 42 : 45, EYC = TR ? 7 : 19, ER = TR ? 7 : 9.5, EK = ER / 9.5;
  var BACK = TURKEY ? '<g class="he-fan"><ellipse cx="1.1" cy="13.5" rx="7.5" ry="16" fill="#c0392b" transform="rotate(285 1.1 13.5)"/><ellipse cx="7.7" cy="0.8" rx="7.5" ry="16" fill="#e67e22" transform="rotate(310 7.7 0.8)"/><ellipse cx="19.1" cy="-7.9" rx="7.5" ry="16" fill="#f1c40f" transform="rotate(335 19.1 -7.9)"/><ellipse cx="33.0" cy="-11.0" rx="7.5" ry="16" fill="#e67e22" transform="rotate(360 33.0 -11.0)"/><ellipse cx="46.9" cy="-7.9" rx="7.5" ry="16" fill="#c0392b" transform="rotate(385 46.9 -7.9)"/><ellipse cx="58.3" cy="0.8" rx="7.5" ry="16" fill="#8a5a3b" transform="rotate(410 58.3 0.8)"/><ellipse cx="64.9" cy="13.5" rx="7.5" ry="16" fill="#e67e22" transform="rotate(435 64.9 13.5)"/></g>'
    : '';
  var BEAK = '<path d="M28 28 L38 28 L33 35 Z" fill="#f39c12"/><path d="M35 31 q5 3 3 10 q-4 -2 -4 -7 Z" fill="#d62f2f"/>';
  var FRONT = {
    turkey: BEAK + '<g class="he-hat"><rect x="23" y="-10" width="20" height="12" rx="2" fill="#1d2730"/><rect x="23" y="-2" width="20" height="3" fill="#5b3a26"/><rect x="30" y="-3" width="6" height="5" rx="1" fill="none" stroke="#e3b341" stroke-width="1.4"/><rect x="16" y="1" width="34" height="3.6" rx="1.8" fill="#1d2730"/></g>',   // beak + wattle, and a little pilgrim hat sitting just above his brows
    turkeyplain: BEAK,
    pilgrim: '<g class="he-hat"><path d="M15 -34 H51 L54 2 H12 Z" fill="#1d2730"/><rect x="12" y="-9" width="42" height="6.5" fill="#5b3a26"/><rect x="27.5" y="-10" width="11" height="8.5" rx="1" fill="none" stroke="#e3b341" stroke-width="2.2"/><rect x="1" y="-0.5" width="64" height="6" rx="3" fill="#1d2730"/></g>',
    santa: '<g class="he-hat"><path d="M3 3 C6 -22 40 -32 60 -20 C55 -17 53 -10 63 3 Z" fill="#c0392b"/><path d="M30 -17 C40 -21 50 -22 60 -20" fill="none" stroke="#a93226" stroke-width="2"/><circle cx="60" cy="-20" r="5.5" fill="#fff"/><path d="M-1 15 C-1 3 12 -3 33 -3 C54 -3 67 3 67 15 C67 18 64 18 62 16 C56 9 46 6 33 6 C20 6 10 9 4 16 C2 18 -1 18 -1 15 Z" fill="#fff"/></g>',
    elfhat: '<g class="he-hat"><path d="M3 3 C8 -24 36 -36 61 -28 C53 -21 47 -10 63 3 Z" fill="#2f7d4f"/><circle cx="61" cy="-28" r="4.2" fill="#e3b341"/><circle cx="60" cy="-29.5" r="1.3" fill="#fff6d6"/><path d="M-1 15 C-1 3 12 -3 33 -3 C54 -3 67 3 67 15 C67 18 64 18 62 16 C56 9 46 6 33 6 C20 6 10 9 4 16 C2 18 -1 18 -1 15 Z" fill="#c0392b"/><g fill="#fff" opacity=".9"><circle cx="8" cy="9" r="1.4"/><circle cx="19" cy="3.5" r="1.4"/><circle cx="33" cy="1.8" r="1.4"/><circle cx="47" cy="3.5" r="1.4"/><circle cx="58" cy="9" r="1.4"/></g></g>',
    tree: TR ? TR.front : '',
    // weather closed (weather-art.js): snow piled over him with a window for his face, or a block of ice
    snow: window.EAOMWeatherArt ? EAOMWeatherArt.front.snow : '',
    ice: window.EAOMWeatherArt ? EAOMWeatherArt.front.ice : '',
  }[OUTFIT] || '';
  var WEATHER = OUTFIT === 'snow' || OUTFIT === 'ice';
  var BROW = TURKEY ? '#4a2d1c' : OUTFIT === 'tree' ? '#173f27' : '#12364d';
  var BROWS =
    TR ? '<g transform="translate(0 5)"><g class="he-brow" stroke="#173f27" stroke-width="2.2" stroke-linecap="round" fill="none">' + TR.browp + '</g></g>' :
    /^(santa|elfhat|pilgrim|snow|ice)$/.test(OUTFIT) ? '' :   // a hat sits snug on his head where the brows would be (snow/ice: no brows)
    (OUTFIT === 'turkey' ? '<g transform="translate(0 7.5)">' : '<g>') +   // turkey: brows tucked under the hat brim
    '<g class="he-brow" stroke="' + BROW + '" stroke-width="2.8" stroke-linecap="round" fill="none"><path d="M14 -2.5q7-3.5 14 0"/><path d="M38 -2.5q7-3.5 14 0"/></g></g>';
  var SVG = '<svg viewBox="' + (WEATHER ? '-22 -48 140 94' : THEME ? '-22 -42 110 88' : '0 -8 66 46') + '" aria-hidden="true" focusable="false"><g>' + BACK +
    (TR ? TR.body :
    '<rect x="1" y="2" width="64" height="40" rx="18" fill="' + BODY + '"' + EDGE + '/>') +
    '<g class="he-open">' + [EX1, EX2].map(function (x) { return '<circle cx="' + x + '" cy="' + EYC + '" r="' + ER + '" fill="#fff"' + EDGE + '/>'; }).join('') +
    [EX1, EX2].map(function (x) { return '<g class="he-pup"><circle class="he-iris" cx="' + x + '" cy="' + (EYC + EK) + '" r="' + (4 * EK) + '" fill="#1d2730"/><circle cx="' + (x + 1.3 * EK) + '" cy="' + (EYC - .5 * EK) + '" r="' + (1.2 * EK) + '" fill="#fff"/></g>'; }).join('') +
    '<g class="he-lid">' + [EX1, EX2].map(function (x) { return '<circle cx="' + x + '" cy="' + EYC + '" r="' + (ER + .5) + '" fill="' + BODY + '"/>'; }).join('') + '</g></g>' +
    '<g class="he-happy" fill="none" stroke="' + LINE + '" stroke-width="3" stroke-linecap="round">' + [EX1, EX2].map(function (x) { return '<path d="M' + (x - 8 * EK) + ' ' + (EYC + 2 * EK) + 'q' + (8 * EK) + ' ' + (-9 * EK) + ' ' + (16 * EK) + ' 0"/>'; }).join('') + '</g>' +
    (TURKEY || TR || WEATHER ? '' :   // no grin on the turkey (his beak is there), the tree (his own smile) or snow/ice (frozen)
    '<path class="he-smile" d="M26 29.5 Q33 35.5 40 29.5" fill="none" stroke="' + LINE + '" stroke-width="2.6" stroke-linecap="round"/>') +
    FRONT +
    BROWS +
    '</g></svg>';

  function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  // card = his home (the hiring card, or the Hours card when no job is posted); name/join/share only on the
  // hiring card; info = the office hours (EAOMHours) for his mood.
  function start(card, name, join, share, info) {
    var box = document.createElement('div');
    box.className = 'hire-eyes';
    box.innerHTML = SVG;
    if (THEME) { box.classList.add('themed'); card.classList.add('themed-room'); }
    if (WEATHER) box.classList.add('wx');   // snow/ice: a wider box for his CLOSED sign
    card.classList.add('has-eyes');
    card.appendChild(box);
    var pups = box.querySelectorAll('.he-pup');
    var whites = Array.prototype.slice.call(box.querySelectorAll('.he-open > circle'), 0, 2);
    var mode = 'intro', busy = false;
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) { box.classList.add('up'); return; }

    // Natural gaze: each eye aims at the point with one smooth rule (no switching), so far away they look
    // the same way and close-up/between them they converge. Pupils glide toward the target each frame.
    var R = 4.4, RY = 3.4, FOCUS = 14, cur = [], tgt = [], raf = 0;
    function settle() {
      var moving = false;
      pups.forEach(function (p, i) {
        var c = cur[i] || (cur[i] = { x: 0, y: 0 }), t = tgt[i] || c;
        c.x += (t.x - c.x) * 0.22; c.y += (t.y - c.y) * 0.22;
        if (Math.abs(t.x - c.x) > 0.02 || Math.abs(t.y - c.y) > 0.02) moving = true;
        p.style.transform = 'translate(' + c.x.toFixed(2) + 'px,' + c.y.toFixed(2) + 'px)';
      });
      raf = moving ? requestAnimationFrame(settle) : 0;
    }
    function lookAt(x, y) {
      pups.forEach(function (p, i) {
        var r = (whites[i] || whites[0]).getBoundingClientRect();
        var dx = x - (r.left + r.width / 2), dy = y - (r.top + r.height / 2);
        var d = Math.hypot(dx, dy) || 1, m = d / Math.sqrt(d * d + FOCUS * FOCUS);   // 0 at the eye, toward 1 far away
        tgt[i] = { x: dx / d * R * m, y: dy / d * RY * m };
      });
      if (!raf) raf = requestAnimationFrame(settle);
    }
    var lastX = 0, lastY = 0;
    document.addEventListener('pointermove', function (e) { lastX = e.clientX; lastY = e.clientY; }, { passive: true });
    function lookAhead() { pups.forEach(function (p, i) { tgt[i] = { x: 0, y: 0 }; }); if (!raf) raf = requestAnimationFrame(settle); }
    function lookAtEl(el) { var r = el.getBoundingClientRect(); lookAt(r.left + r.width / 2, r.top + r.height / 2); }
    function flag(c, ms) { box.classList.add(c); setTimeout(function () { box.classList.remove(c); }, ms); }
    function blink() { flag('blink', 140); }

    // The intro (peek up, type the job name) can be cut short the moment someone interacts: hovering Share/Join or
    // tapping Call shouldn't have to wait for it.
    var skipped = false, introText = null;
    function skipIntro() {
      if (mode !== 'intro') return;
      skipped = true;
      if (name && introText != null) { name.textContent = name.dataset.next || introText; name.style.minWidth = ''; delete name.dataset.typing; delete name.dataset.next; }
      box.classList.add('up'); mode = 'idle'; applyMood(); setTimeout(roam, 50);   // (they may have scrolled during the intro)
    }
    function swait(ms) { return skipped ? Promise.reject('skip') : wait(ms).then(function () { if (skipped) throw 'skip'; }); }
    (async function intro() { try {
      if (!name) {                       // Hours-card home: just peek up and settle in
        await swait(500); box.classList.add('up'); flag('lift', 900);
        await swait(700); blink(); await swait(500);
        mode = 'idle'; applyMood(); setTimeout(roam, 50);   // (they may have scrolled during the intro)
        return;
      }
      // Real typing: one letter at a time, the cursor right after the last letter, the eyes following it.
      // The name keeps its full width the whole time, so nothing around it shifts.
      var text = introText = name.textContent;
      name.dataset.typing = '1';
      name.style.minWidth = name.getBoundingClientRect().width + 'px';
      name.textContent = '';
      var typed = document.createElement('span'), caret = document.createElement('span');
      caret.className = 'he-cursor';
      name.appendChild(typed); name.appendChild(caret);
      // the live copy may bring a different name while he types: keep the letters that match, type the rest
      function newer(i) {
        var nx = name.dataset.next; if (!nx || nx === text) return i;
        var keep = 0; while (keep < i - 1 && keep < nx.length && nx.charAt(keep) === text.charAt(keep)) keep++;
        text = introText = nx;
        name.style.minWidth = ''; typed.textContent = text; name.style.minWidth = name.getBoundingClientRect().width + 'px';
        typed.textContent = text.slice(0, keep);
        return keep + 1;
      }
      await swait(500); box.classList.add('up'); flag('lift', 900);
      await swait(600); blink(); await swait(300);
      for (var i = 1; i <= text.length; i++) {
        i = newer(i);
        if (i > text.length) break;
        typed.textContent = text.slice(0, i);
        var c = caret.getBoundingClientRect();
        lookAt(c.left, c.top + c.height / 2);
        await swait(text.charAt(i - 1) === ' ' ? 60 : 80 + Math.random() * 60);   // a little uneven, like real typing
      }
      await swait(500);
      newer(text.length + 1);
      name.textContent = text;          // back to plain text; the cursor goes away
      name.style.minWidth = ''; delete name.dataset.typing; delete name.dataset.next;
      await swait(400); lookAtEl(join); await swait(700); blink(); await swait(700);
      mode = 'idle'; applyMood(); setTimeout(roam, 50);   // (they may have scrolled during the intro)
    } catch (e) { /* skipped: skipIntro() already settled him */ } })();

    document.addEventListener('pointermove', function (e) { if (mode === 'idle' && !busy && mood !== 'sleep' && !lastStar) lookAt(e.clientX, e.clientY); }, { passive: true });   // (pointing at a review star: he keeps his eyes on the star)
    document.addEventListener('pointerdown', function (e) { if (mode !== 'idle') return; if (mood === 'sleep') { stir(e); return; } lookAt(e.clientX, e.clientY); }, { passive: true });
    function hearts() {
      var b = box.getBoundingClientRect(), c = card.getBoundingClientRect();
      for (var i = 0; i < 4; i++) {
        var h = document.createElement('span');
        h.className = 'he-heart'; h.textContent = '\u2665'; h.setAttribute('aria-hidden', 'true');
        h.style.left = (b.left - c.left + 16 + i * 10) + 'px';
        h.style.top = (b.top - c.top + 14) + 'px';
        h.style.setProperty('--hx', ((i - 1.5) * 10) + 'px');
        h.style.animationDelay = (i * 0.1) + 's';
        card.appendChild(h);
        setTimeout(function (el) { el.remove(); }, 1600, h);
      }
    }
    // If he happens to be ducked down (or mid-duck), pop him straight back up; resolves once he's visible
    function popUp() {
      if (box.classList.contains('up')) return Promise.resolve();
      box.classList.add('up'); return wait(450);
    }
    function bounceNow() { box.classList.remove('bob'); void box.offsetWidth; box.classList.add('bob'); }
    function shareFace(ms) { lookAtEl(share); if (ms) { flag('glad', ms); flag('lift', ms); } else box.classList.add('glad', 'lift'); bounceNow(); }
    function joinFace(ms) { lookAtEl(join); if (ms) { flag('wide', ms); flag('lift', ms); } else box.classList.add('wide', 'lift'); bounceNow(); hearts(); }
    var touch = false;   // the last press was a finger (phones): play the reaction on the tap itself
    document.addEventListener('pointerdown', function (e) { touch = e.pointerType !== 'mouse'; }, { passive: true, capture: true });

    if (share) share.addEventListener('pointerenter', function (e) { skipIntro(); if (mode !== 'idle' || e.pointerType !== 'mouse') return; busy = true; popUp().then(function () { if (busy) shareFace(); }); });
    if (share) share.addEventListener('pointerleave', function () { busy = false; box.classList.remove('glad', 'lift'); });
    if (share) share.addEventListener('click', function () { skipIntro(); if (mode !== 'idle' || !touch) return; busy = true; popUp().then(function () { shareFace(1500); setTimeout(function () { busy = false; }, 1500); }); });   // the page opens the share menu a beat later, after his smile
    // Computer: hearts keep coming while the cursor is on Join, until they click or leave. After ~2 s of
    // hovering the eyes look straight ahead at the visitor, nod twice, then look back at the cursor
    // (again every ~6 s while they stay).
    var heartTimer = 0, nodTimer = 0, nodding = false;
    function stopHearts() { clearInterval(heartTimer); heartTimer = 0; clearTimeout(nodTimer); clearInterval(nodTimer); nodTimer = 0; }
    async function nod() {
      if (nodding || !heartTimer) return;
      nodding = true;
      lookAhead(); await wait(450);
      box.classList.remove('bob', 'lift');
      // a real "yes" nod: head tips straight down and back up, twice, eyes dipping a little further (no hop)
      pups.forEach(function (p, i) { tgt[i] = { x: 0, y: 2.5 }; }); if (!raf) raf = requestAnimationFrame(settle);
      nodYes(); await wait(950);
      lookAhead(); await wait(250);
      if (heartTimer) lookAt(lastX, lastY);
      nodding = false;
    }
    if (join) join.addEventListener('pointerenter', function (e) {
      skipIntro();
      if (mode !== 'idle' || e.pointerType !== 'mouse') return;
      busy = true; stopHearts();
      popUp().then(function () { if (!busy) return; joinFace(); heartTimer = setInterval(hearts, 700); });
      nodTimer = setTimeout(function () { nod(); nodTimer = setInterval(nod, 6000); }, 2000);
    });
    if (join) join.addEventListener('pointermove', function (e) { if (heartTimer && !nodding) lookAt(e.clientX, e.clientY); });
    if (join) join.addEventListener('pointerleave', function () { busy = false; stopHearts(); nodding = false; box.classList.remove('wide', 'lift', 'nod'); });
    // Tapping any Call link (header, bottom bar, the eye care tiles...): if he's on screen he answers like the front
    // desk (headset + speech bubble), then the call starts.
    // Call reaction: he slips on a front-desk headset and answers, "Eye Associates! How can I help you? 😊"
    // two parts: the band over his head goes UNDER a holiday hat; the ear cups + mic go on top
    var HEADSET_BAND = '<g class="he-headset he-band"><path d="M1 16 C1 -6.5 65 -6.5 65 16" fill="none" stroke="#dfe6eb" stroke-width="3.2" stroke-linecap="round"/></g>';
    var HEADSET = '<g class="he-headset">' +
      '<rect x="-2.75" y="11" width="7.5" height="14" rx="3.75" fill="#7a2a3c"/><rect x="61.25" y="11" width="7.5" height="14" rx="3.75" fill="#7a2a3c"/>' +   // on the sides of his head
      '<path d="M0.8 24 C0.8 31 10 32.5 18 31" fill="none" stroke="#dfe6eb" stroke-width="2.2" stroke-linecap="round"/><circle cx="19.5" cy="31" r="2.8" fill="#7a2a3c"/></g>';
    // What he says when someone taps Call: open = the front desk; closed = leave a message (holiday closings say
    // which holiday), with where to go for an eye emergency; at night he's a little sleepy about it.
    function todayReason() {
      if (!info) return '';
      var today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Chicago' });   // YYYY-MM-DD
      var c = (info.closings || []).filter(function (x) { return x && x.date === today && x.reason; })[0];
      return c ? String(c.reason).trim() : '';
    }
    function callLine() {
      // closed for weather (a live Weather banner, or the ?weather= preview): say so plainly
      var wx = (info && info.weatherClosedToday) || (window.EAOMHoliday && EAOMHoliday.theme === 'weather');
      if (wx) {
        var ice = (window.EAOMHoliday && EAOMHoliday.kind === 'ice') || (info && info.banner && info.banner.weather === 'ice');
        return { closed: true, text: "Sorry, we're closed due\u00a0to\u00a0weather!\nTap Call again for voicemail." + (ice ? ' 🧊' : ' ❄️'), sub: 'er' };
      }
      var open = !info || !window.EAOMHours || EAOMHours.isOpenNow(info);
      if (open && mood !== 'sleep') return { text: CALL_LINE };
      var reason = todayReason(), night = mood === 'sleep';
      var icon = /thanksgiving/i.test(reason) ? ' \uD83E\uDD83' : /christmas/i.test(reason) ? ' \uD83C\uDF84' : '';
      return {
        closed: true,
        text: (night ? '*Yawn* ' : '') + (reason ? 'Closed for ' + reason + '!' : "We're closed right now!") + '\nTap Call again for voicemail.' + icon + (night ? ' zzz' : ''),
        sub: 'er'   // "Eye emergency? Go to the nearest urgent care or ER." with map links (fillBubble)
      };
    }
    function placeBubble(bub) {
      var b = box.getBoundingClientRect(), c = bub.offsetParent.getBoundingClientRect(), w = bub.offsetWidth, h = bub.offsetHeight;
      var hd = document.querySelector('header'), menu = (hd ? hd.getBoundingClientRect().bottom : 0) + 6;
      var cb = document.querySelector('.callbar'), floor = cb && cb.getClientRects().length ? cb.getBoundingClientRect().top - 8 : window.innerHeight - 8;
      bub.classList.remove('right', 'above', 'below');
      var perched = window.innerWidth > 860 && box.parentNode.classList.contains('eyes-perch');   // computer, on a tile's perch: below him, off the tile's words
      if (!perched && b.left - w - 10 >= 8) {                      // room on his left: beside him
        bub.style.left = (b.left - c.left - w - 10) + 'px';
        bub.style.top = (b.top - c.top + b.height - 12 - h / 2) + 'px';   // the tail points at his mouth (John), just above the edge he peeks over
        keepBelowMenu(bub); return;
      }
      var x = Math.min(Math.max(8, b.right - w), window.innerWidth - 8 - w);   // otherwise over or under him, never on him
      var y = perched && b.bottom + 10 + h <= floor ? b.bottom + 10 : b.top - h - 10 >= menu ? b.top - h - 10 : b.bottom + 10;
      if (y + h > floor) y = b.top - h - 10;
      bub.classList.add(y < b.top ? 'above' : 'below');
      bub.style.setProperty('--tail', Math.min(w - 24, Math.max(12, b.left + b.width / 2 - x - 7)) + 'px');
      bub.style.left = (x - c.left) + 'px'; bub.style.top = (y - c.top) + 'px';
    }
    // While his line is up, scrolling re-places the bubble (beside / over / under him), so it never ends up under the
    // top menu or the bottom bar.
    function followScroll(bub) {
      var tick = false;
      function on() { if (tick) return; tick = true; requestAnimationFrame(function () { tick = false; if (bub.isConnected) placeBubble(bub); }); }
      window.addEventListener('scroll', on, { passive: true }); window.addEventListener('resize', on);
      return function () { window.removeEventListener('scroll', on); window.removeEventListener('resize', on); };
    }
    function keepBelowMenu(bub) {   // never tuck the bubble under the sticky top menu
      var hd = document.querySelector('header'), min = (hd ? hd.getBoundingClientRect().bottom : 0) + 6;
      var t = bub.offsetParent.getBoundingClientRect().top + parseFloat(bub.style.top);   // layout position (it's mid pop-in animation)
      if (t < min) { bub.style.top = (parseFloat(bub.style.top) + (min - t)) + 'px'; t = min; }
      var cb = document.querySelector('.callbar'), max = cb && cb.getClientRects().length ? cb.getBoundingClientRect().top - 8 : window.innerHeight - 8;
      if (t + bub.offsetHeight > max) bub.style.top = (parseFloat(bub.style.top) - (t + bub.offsetHeight - max)) + 'px';   // nor behind the phone's bottom bar
    }
    function fillLine(bub, line) { fillBubble(bub, line); }
    function answerCall(line) {
      var g = box.querySelector('svg > g');
      if (!NO_HEADSET && !g.querySelector('.he-headset')) {
        var hat = g.querySelector('.he-hat');
        if (TR) {   // the tree: a smaller headset on the sides of his upper tiers, the band tucked behind him
          var fit = function (h) { return '<g transform="translate(13.4 -3.7) scale(.594)">' + h + '</g>'; };
          g.insertAdjacentHTML('afterbegin', fit(HEADSET_BAND)); g.insertAdjacentHTML('beforeend', fit(HEADSET));
        } else {
          if (hat) hat.insertAdjacentHTML('beforebegin', HEADSET_BAND); else g.insertAdjacentHTML('beforeend', HEADSET_BAND);
          g.insertAdjacentHTML('beforeend', HEADSET);
        }
      }
      var hs = { parts: g.querySelectorAll('.he-headset'),
        classList: { add: function () { var a = arguments; hs.parts.forEach(function (e) { e.classList.add.apply(e.classList, a); }); },
                     remove: function () { var a = arguments; hs.parts.forEach(function (e) { e.classList.remove.apply(e.classList, a); }); } } };
      hs.classList.remove('on', 'off'); void g.getBoundingClientRect(); hs.classList.add('on'); box.classList.add('talk', 'glad');   // big smile (happy ^ ^ eyes + a grin) while he's on the line
      var b = box.getBoundingClientRect(), c = box.parentNode.getBoundingClientRect();
      var bub = document.createElement('span');
      bub.className = 'he-say'; bub.setAttribute('aria-hidden', 'true');
      fillLine(bub, line || CALL_LINE);
      box.parentNode.appendChild(bub);
      // beside him on the left (so it never slides under the top menu), pointing at him
      placeBubble(bub);
      var stopFollow = function () {};   // (it scrolls with the page, like he does)
      var done = false;
      return function hangUp() {          // headset + line stay up until the visitor is back from the call sheet
        if (done) return; done = true; stopFollow();
        bub.classList.add('out'); hs.classList.add('off'); box.classList.remove('talk', 'glad');
        setTimeout(function () { bub.remove(); hs.classList.remove('on', 'off'); }, 300);
      };
    }
    // Directions: brows wiggle, a happy bounce and "See you soon! Drive safely. ❤️". Maps opens in another app/tab, so
    // the line stays up until they're back (then a couple more seconds) so they actually see it.
    function sayLine(text) {
      var b = box.getBoundingClientRect(), c = box.parentNode.getBoundingClientRect();
      var bub = document.createElement('span');
      bub.className = 'he-say'; bub.setAttribute('aria-hidden', 'true'); fillLine(bub, text);
      box.parentNode.appendChild(bub);
      placeBubble(bub);
      var stopFollow = function () {};
      return function () { stopFollow(); bub.classList.add('out'); setTimeout(function () { bub.remove(); }, 300); };
    }
    var CALL_LINE = 'Eye Associates! How can I help you? 😊', DIR_LINE = 'See you soon! Drive safely. ❤️';
    // If he isn't on screen, a holiday character that is (holiday.js) answers instead.
    var otherBusy = false;
    function other() { return window.EAOMHoliday && EAOMHoliday.responder ? EAOMHoliday.responder() : null; }
    // all of him fits on screen where he is (below the top menu, above the bottom Call bar), counting his full height
    // once he's popped up (even if he's ducked down for a moment): otherwise a tap on Call / Directions sends him to a
    // spot where you can see all of him and his speech bubble (John: not half under the menu)
    function onScreen() {
      var r = box.getBoundingClientRect(), hd = document.querySelector('header'), top = hd ? hd.getBoundingClientRect().bottom : 0;
      var cb = document.querySelector('.callbar'), bottom = cb && cb.getClientRects().length ? cb.getBoundingClientRect().top : window.innerHeight;
      var sv = box.querySelector('svg'), head = Math.min(r.top, r.bottom - (sv ? sv.getBoundingClientRect().height : 0) + 4);
      return !moving && head >= top + 2 && r.bottom <= bottom + 2;
    }

    // He's off screen and nobody else is around: where he hops in to answer a tap on `a`: the perch in its tile (Eye
    // exams / Urgent eye care), else the spot that holds it (e.g. the Find us card), else the nearest clear spot.
    function comeSpot(a) {
      if (mode !== 'idle' || busy) return null;
      var lines = textLines(), tile = a.closest('.tile'), perch = tile && tile.querySelector('.eyes-perch');
      var pp = perch && visible(perch) ? placeOn(perch, lines) : null;
      if (pp) return { el: perch, place: pp };
      for (var i = 0; i < SPOTS.length; i++) {
        var el = document.querySelector(SPOTS[i]);
        if (el && el.contains(a) && visible(el)) { var q = placeOn(el, lines); if (q) return { el: el, place: q }; }
      }
      return pickSpot();
    }
    // Nowhere clear on the page: he peeks over the bottom Call bar (phones) or up from the bottom-right corner of the
    // screen (computers), so a Call / Directions tap never goes off without him.
    var dock = null;
    function dockSpot() {
      var cb = document.querySelector('.callbar');
      if (cb && cb.getClientRects().length && getComputedStyle(cb).display !== 'none') return { el: cb, place: null };
      if (!dock) { dock = document.createElement('div'); dock.className = 'eyes-dock'; dock.setAttribute('aria-hidden', 'true'); document.body.appendChild(dock); }
      return { el: dock, place: { side: 'right', off: 28 } };
    }
    function whenStill() {   // he's mid-hop: wait for him to land (at most ~1.5 s)
      return new Promise(function (ok) { var n = 0; (function t() { if (!moving || n++ > 15) ok(); else setTimeout(t, 100); })(); });
    }
    function comeBack() { setTimeout(function () { if (window.EAOMHoliday && EAOMHoliday.on) moveTo(card, null); else roam(); }, 600); }   // holidays: back home
    // Directions: the line stays up while they're off in the map app, and a couple of seconds after they're back.
    function stayUntilBack(stop) {
      var left = false, done = false;
      function finish() { if (done) return; done = true; cleanup(); stop(); }
      function onHide() { if (document.visibilityState === 'hidden') left = true; else if (left) setTimeout(finish, 2500); }
      function onBlur() { left = true; }
      function onFocus() { if (left) setTimeout(finish, 2500); }
      function cleanup() { document.removeEventListener('visibilitychange', onHide); window.removeEventListener('blur', onBlur); window.removeEventListener('focus', onFocus); clearTimeout(t); }
      document.addEventListener('visibilitychange', onHide); window.addEventListener('blur', onBlur); window.addEventListener('focus', onFocus);
      var t = setTimeout(function () { if (!left) finish(); }, 3500);   // stayed on the page (e.g. the app chooser): 3.5 s
    }
    document.addEventListener('click', function (e) {
      var a = e.target.closest && e.target.closest('[data-directions]');
      if (!a) return;
      skipIntro();
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button) return;
      // iPhone's first tap asks which maps app (directions.js): that dialog opens right away, he just says his line.
      var D = window.EAOMDirections, asks = !!(D && document.getElementById('maps-chooser') && D.platform(navigator.userAgent, navigator.maxTouchPoints || 0) === 'ios' && !D.saved());
      var href = a.href, held = false;
      function hold() { if (asks) return; e.preventDefault(); held = true; }
      // After a beat to read his line, open the map (a new tab, like the link would; same tab if that's blocked),
      // and keep the line up until they're back.
      function go(stop) {
        if (!held) { stayUntilBack(stop); return; }
        setTimeout(function () {
          var w = null;
          if (a.target === '_blank') { try { w = window.open(href, '_blank'); if (w) w.opener = null; } catch (x) { w = null; } }
          if (!w) location.href = href;
          stayUntilBack(stop);
        }, 1600);
      }
      function drive(came) {
        box.classList.add('up'); lookAtEl(a); box.classList.add('glad', 'talk');
        flag('lift', 300); setTimeout(function () { flag('lift', 300); }, 650);
        setTimeout(function () { lookAhead(); bounceNow(); }, 400);
        var close = sayLine(DIR_LINE);
        go(function () { close(); box.classList.remove('glad', 'talk'); busy = false; if (came) comeBack(); });
      }
      if (mode === 'idle' && mood !== 'sleep' && !busy && onScreen()) { hold(); busy = true; drive(false); return; }
      if (otherBusy) return;
      var r = other();
      if (!r) {
        var come = !onScreen() ? (comeSpot(a) || (mode === 'idle' && !busy ? dockSpot() : null)) : null;
        if (come) { hold(); busy = true; whenStill().then(function () { return moveTo(come.el, come.place); }).then(function () { drive(true); }); }
        return;
      }
      hold(); otherBusy = true; var c = r.talk(DIR_LINE, false);
      go(function () { c(); otherBusy = false; });
    }, true);

    // Calls: a beat to read the line, then the phone's own "Call / Cancel" sheet; the headset and line stay up until
    // they come back from it (Call or Cancel), then he hangs up.
    function placeCall(href, hangUp, delay) {
      setTimeout(function () {
        var away = false, t0 = Date.now();
        function back() { if (Date.now() - t0 < 400) return; cleanup(); hangUp(); }
        function gone() { away = true; }
        function onVis() { if (document.visibilityState === 'hidden') gone(); else if (away) back(); }
        function onFocus() { if (away) back(); }
        function onTap() { back(); }
        function cleanup() {
          window.removeEventListener('blur', gone); window.removeEventListener('focus', onFocus);
          document.removeEventListener('visibilitychange', onVis); document.removeEventListener('pointerdown', onTap, true);
          clearTimeout(safety);
        }
        window.addEventListener('blur', gone); window.addEventListener('focus', onFocus);
        document.addEventListener('visibilitychange', onVis); document.addEventListener('pointerdown', onTap, true);
        var safety = setTimeout(function () { cleanup(); hangUp(); }, 20000);   // never leave it up forever
        location.href = href;
      }, delay == null ? 2000 : delay);
    }
    // After hours the first tap on Call only shows his line ("Tap Call again for voicemail");
    // the next tap on any Call button dials right away. The line goes away after 15 s or a tap anywhere else.
    var armed = null, armedT = 0;
    activeFn = function () { return busy || !!armed || moving; };
    // While his voicemail line is up, the Call buttons pulse (a soft ring) so people see where to tap again.
    function armLook(on) { document.documentElement.classList.toggle('call-armed', !!on); }
    function disarm() { if (!armed) return; var h = armed; armed = null; armLook(false); clearTimeout(armedT); document.removeEventListener('pointerdown', offTap, true); h(); }
    function offTap(e) { if (!(e.target.closest && e.target.closest('a[href^="tel:"], .he-say'))) disarm(); }
    function armIt(hang) { armed = hang; armLook(true); armedT = setTimeout(disarm, 15000); setTimeout(function () { document.addEventListener('pointerdown', offTap, true); }, 0); }
    function then(line, href, hang) { if (line.closed) armIt(hang); else placeCall(href, hang); }
    document.addEventListener('click', function (e) {
      var a = e.target.closest && e.target.closest('a[href^="tel:"]');
      if (!a) return;
      skipIntro();
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button) return;
      var href = a.href;
      if (armed) {                          // second tap after hours: call now (voicemail), hang up when they're back
        e.preventDefault();
        var h = armed; armed = null; armLook(false); clearTimeout(armedT); document.removeEventListener('pointerdown', offTap, true);
        placeCall(href, h, 0);
        return;
      }
      var line = callLine(), come = null;
      if (!(mode === 'idle' && onScreen())) {
        if (otherBusy) return;
        var r = other();
        if (r) {
          e.preventDefault(); otherBusy = true;
          var c = r.talk(line, true);
          then(line, href, function () { c(); otherBusy = false; });
          return;
        }
        // He's off screen and nobody else is around: he hops over to answer, to the perch in the tile that was
        // tapped (Eye exams / Urgent eye care) or else the nearest clear spot on screen.
        come = comeSpot(a) || (mode === 'idle' && !busy ? dockSpot() : null);
        if (!come) return;
      }
      e.preventDefault();
      busy = true;
      // On a computer, if he's on the hiring card he hops over to the Hours card (where the phone number lives) to
      // take the call, and goes back home after.
      var hc = document.querySelector('.hours-card'), hr = hc && hc.getBoundingClientRect();
      var hd = document.querySelector('header'), menuB = hd ? hd.getBoundingClientRect().bottom : 0;
      var jump = !come && hc && card !== hc && box.parentNode === card && window.innerWidth > 860 && hr.top - 70 > menuB && hr.top < window.innerHeight;   // room for him above the card, below the menu
      function goHome() { box.classList.remove('up'); setTimeout(function () { box.getAnimations().forEach(function (an) { an.cancel(); }); card.appendChild(box); box.style.left = box.style.right = box.style.marginLeft = ''; box.classList.add('up'); }, 320); }
      function talk() {
        box.classList.add('up');   // pop up if he was ducked
        lookAtEl(a);
        var slept = box.classList.contains('asleep'); box.classList.remove('asleep');   // at night he wakes up to answer
        var hangUp0 = answerCall(line);
        setTimeout(function () { lookAhead(); flag('lift', 900); bounceNow(); }, 380);
        then(line, href, function () {
          busy = false; hangUp0();
          if (slept && mood === 'sleep') setTimeout(function () { lookAhead(); box.classList.add('asleep'); }, 400);
          if (jump) setTimeout(goHome, 350);
          else if (come) comeBack();
        });
      }
      if (come) whenStill().then(function () { return moveTo(come.el, come.place); }).then(talk);
      else if (jump) {
        box.classList.remove('up', 'glad', 'lift', 'wide');
        setTimeout(function () {
          hc.appendChild(box); box.style.left = ''; box.style.right = '';
          requestAnimationFrame(function () { box.classList.add('up'); });
          setTimeout(talk, 460);
        }, 320);
      } else talk();
    });
    if (join) join.addEventListener('click', function (e) {
      stopHearts(); skipIntro();
      if (mode !== 'idle' || e.metaKey || e.ctrlKey || e.shiftKey || e.button) return;
      // Pop up if he's ducked, show the big eyes + two bursts of hearts, then go to the Careers page
      e.preventDefault();
      var href = join.href;
      busy = true;
      popUp().then(function () {
        joinFace(1600);
        setTimeout(hearts, 650);
        setTimeout(function () { location.href = href; }, 1400);
      });
    });

    window.addEventListener('pageshow', function (e) { if (e.persisted) { busy = false; box.classList.remove('wide', 'lift', 'glad'); } });   // back from Careers
    setInterval(function () { if (mode === 'idle' && mood !== 'sleep' && Math.random() < .6) blink(); }, 2600);
    setInterval(async function () {    // now and then: duck down, then pop back up
      if (mode !== 'idle' || busy || moving || mood === 'sleep' || lastStar || onReview()) return;   // (never on the review card: he stays up there)
      box.classList.remove('up'); await wait(1100); box.classList.add('up'); await wait(450); blink();
    }, 13000);

    // ---- Mood, from the office hours and the time of day (Central):
    //   open           -> fully awake and interactive (everything above)
    //   closed (day)   -> relaxed: eyes wide open, his gaze drifts around on its own; still follows you
    //   night 9 PM-6 AM -> asleep: eyes shut, little "z"s float up; a tap or the cursor on him wakes him for a
    //                      moment (he blinks and looks at you), then he dozes off again
    // ?eyes=open|closed|sleep on the page address forces a mood (for checking).
    var mood = 'open', zTimer = 0, wakeTimer = 0;
    function centralHour() { return new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Chicago' })).getHours(); }
    // Dr. Gray 2026-11-21: no sleeping or drowsy looks on any of the little guys: always awake. (The after-hours
    // voicemail line still comes from the office hours, in callLine.) The sleepy moods below are kept but unused.
    function moodNow() { return 'open'; }
    function zzz() {
      var b = box.getBoundingClientRect(), host = box.parentNode, h0 = host.getBoundingClientRect();
      var z = document.createElement('span');
      z.className = 'he-z'; z.textContent = 'z'; z.setAttribute('aria-hidden', 'true');
      z.style.left = (b.right - h0.left - 10) + 'px';
      z.style.top = (b.top - h0.top + 10) + 'px';
      host.appendChild(z);
      setTimeout(function () { z.remove(); }, 2600);
    }
    function applyMood() {
      var m = moodNow();
      if (m === mood && box.dataset.mood) return;
      mood = m; box.dataset.mood = m;
      clearInterval(zTimer); zTimer = 0;
      box.classList.toggle('asleep', m === 'sleep');
      // closed (daytime): no droopy lids; he just lets his gaze wander (below)
      if (m === 'sleep') { lookAhead(); zTimer = setInterval(function () { if (box.classList.contains('up') && box.classList.contains('asleep')) zzz(); }, 1400); }
    }
    function stir(e) {                   // asleep: a tap or the cursor wakes him for a moment
      if (!box.classList.contains('asleep') && !box.classList.contains('stirred')) return;
      box.classList.remove('asleep'); box.classList.add('stirred');
      lookAt(e.clientX, e.clientY); blink();
      clearTimeout(wakeTimer);
      wakeTimer = setTimeout(function () {
        box.classList.remove('stirred');
        if (mood === 'sleep') { lookAhead(); box.classList.add('asleep'); }
      }, 2600);
    }
    box.addEventListener('pointerenter', function (e) { if (mood === 'sleep' && mode === 'idle') stir(e); });
    setInterval(function () { if (mode === 'idle') applyMood(); }, 60000);   // hours change during the visit
    // relaxed: every few seconds his gaze drifts somewhere new on its own (he still follows you, lazily)
    setInterval(function () {
      if (mood !== 'closed' || mode !== 'idle' || busy) return;
      var r = box.getBoundingClientRect();
      lookAt(r.left + r.width / 2 + (Math.random() - .5) * 400, r.top + 40 + (Math.random() - .3) * 200);
    }, 3800);

    // ---- Roaming: once the hiring card has scrolled completely off the screen, the same little guy ducks
    // out there and pops up peeking over something else that's on screen; back home when the card returns.
    // He only hops when his current spot leaves the screen (and only after scrolling settles), and there is
    // only ever one of him.
    // phones also have two little perches at the bottom right of the Eye exams and Urgent eye care tiles
    // (no spot over the doctor cards: right under them, the review card is his spot there)
    var SPOTS = ['#care .tile:nth-child(1) .eyes-perch', '#care .tile:nth-child(3) .eyes-perch', '#care .grid', '.ins-notes', '.find-card', '.cta .box'];
    function onReview() { var p = box.parentNode; return !!(p && p.classList && p.classList.contains('rc-go')); }
    function inView(el) {   // any of it between the top menu and the bottom bar
      var r = el.getBoundingClientRect(), hd = document.querySelector('header'), top = hd ? hd.getBoundingClientRect().bottom : 0;
      var cb = document.querySelector('.callbar'), bottom = cb && cb.getClientRects().length ? cb.getBoundingClientRect().top : window.innerHeight;
      return r.width > 0 && r.bottom > top && r.top < bottom;
    }
    var moving = false, settleTimer = 0;
    function visible(el) {
      if (!el || !el.getClientRects().length || getComputedStyle(el).display === 'none') return false;
      var r = el.getBoundingClientRect();
      return r.top > 70 && r.top < window.innerHeight * 0.85 && r.width > 0;   // room for him above its top edge
    }
    function homeOnScreen() { var r = card.getBoundingClientRect(); return r.bottom > 0 && r.top < window.innerHeight; }
    // Never cover words: measure the real lines of text on the page (not whole paragraphs) and only use a
    // position where his peeking area touches none of them.
    var W = 66, H = 50;
    function textLines() {
      var out = [], walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
        acceptNode: function (n) {
          if (!n.data.trim() || box.contains(n.parentNode)) return NodeFilter.FILTER_REJECT;
          var el = n.parentNode.closest('.callbar, script, style, [hidden], dialog');
          return el ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT;
        }
      }), r = document.createRange(), n;
      while ((n = walk.nextNode())) {
        r.selectNodeContents(n);
        Array.prototype.forEach.call(r.getClientRects(), function (q) {
          if (q.width && q.height && q.bottom > -60 && q.top < window.innerHeight + 60) out.push(q);
        });
      }
      return out;
    }
    function clearAt(rect, lines) {
      return !lines.some(function (q) { return q.left < rect.right + 4 && q.right > rect.left - 4 && q.top < rect.bottom && q.bottom > rect.top + 2; });
    }
    // where he'd sit on this spot without covering text: {side:'right'|'left', off:px} or null
    function placeOn(spot, lines) {
      var s = spot.getBoundingClientRect(), tries = [['right', 26], ['right', 8], ['left', 26], ['left', 8]];
      for (var i = 0; i < tries.length; i++) {
        var side = tries[i][0], off = tries[i][1];
        var left = side === 'right' ? s.right - off - W : s.left + off;
        if (clearAt({ left: left, right: left + W, top: s.top - H + 8, bottom: s.top }, lines)) return { side: side, off: off };
      }
      return null;
    }
    // The "Loved your visit?" review card wins whenever it's in view: he hops over and hints at 5 stars.
    function footballInView() { var f = document.querySelector('.hol-field'); if (!f) return false; var r = f.getBoundingClientRect(); return r.bottom > 0 && r.top < window.innerHeight; }
    function reviewSpot() {   // (not while the Thanksgiving football is on screen: one character at a time)
      if (document.querySelector('.rc-guy.themed')) return null;   // holidays: the card has its own little guy; don't land on him
      var g = document.querySelector('#review-cta:not([hidden]) .rc-go'); return visible(g) && !footballInView() ? g : null;
    }
    // On the review card he hops from the middle over to the 5th star and looks down at it (no big eyes, no words).
    function hintReview(g) {
      var five = g.querySelectorAll('.rc-star')[4]; if (!five) return;
      var gr = g.getBoundingClientRect(), fr = five.getBoundingClientRect();
      var to = fr.left - gr.left + fr.width / 2 - 33, from = to;   // lands right over the 5th star (no hop across: John 2026-11-24)
      box.style.marginLeft = '0'; box.style.left = from + 'px';
      var sv = box.querySelector('svg');
      var hop = box.animate([{ left: from + 'px' }, { left: to + 'px' }], { duration: 560, easing: 'cubic-bezier(.4,0,.2,1)' });
      box.style.left = to + 'px';   // end position lives in his style, not in a held animation (so it can't stick later)
      hop.finished.then(function () { hop.cancel(); }, function () {});
      sv.animate([{ transform: 'none' }, { transform: 'translateY(3px) scale(1.05,.93)', offset: .12 }, { transform: 'translateY(-12px)', offset: .5 }, { transform: 'translateY(2px) scale(1.04,.95)', offset: .85 }, { transform: 'none' }], { duration: 560, easing: 'ease-in-out' });
      setTimeout(function () { lookAtEl(five); flag('lift', 900); five.classList.add('wish'); }, 600);
      setTimeout(nodYes, 1100);   // a "yes, that one" nod over the 5th star
      setTimeout(function () { five.classList.remove('wish'); }, 3400);
      setTimeout(function () { if (mode === 'idle' && !busy) { lookAhead(); blink(); } }, 2700);   // then back up at you
    }
    // While he's on the review card he keeps it lively (the card's star sweep, index.html): his eyes follow the
    // stars lighting up, at the 5th he nods and the star sparkles, then he looks back at you and blinks; every third
    // sweep he adds a happy hop.
    var rcCard = document.getElementById('review-cta');
    function onCard() { return rcCard && rcCard.contains(box) && mode === 'idle' && !busy && box.classList.contains('up'); }
    if (rcCard) {
      rcCard.addEventListener('rc-star', function (e) {   // his eyes land on each star as it lights
        var st = rcCard.querySelectorAll('.rc-star')[e.detail.i];
        if (!onCard() || !st || lastStar) return;   // (pointing at a star: his eyes stay on yours)
        // the stars are just below him, so plain "look at" barely moves his eyes side to side: aim mostly sideways
        // (how far left the star is), a little down
        var k = (e.detail.i - 4) / 4;   // he sits over star 5: star 1 = far left ... star 5 = straight down
        pups.forEach(function (p, i) { tgt[i] = { x: k * R, y: RY * .75 }; });
        if (!raf) raf = requestAnimationFrame(settle);
      });
      rcCard.addEventListener('rc-hop', function (e) {   // he hops 1 -> 3 -> 5 and looks down at each (5: rc-sweep5 nods)
        var st = rcCard.querySelectorAll('.rc-star')[e.detail.i];
        if (!onCard() || !st || lastStar || e.detail.i === 4) return;
        rcSlide(box.parentNode, st).then(function () { if (onCard()) lookAtEl(st); });
      });
      rcCard.addEventListener('rc-nod', function () {   // resting on 5: another nod, then back up at you
        var five = rcCard.querySelectorAll('.rc-star')[4];
        if (!onCard() || lastStar || !five) return;
        rcSlide(box.parentNode, five).then(function () { if (!onCard() || lastStar) return; lookAtEl(five); nodYes(); });   // (only ever over the 5th star: hops back first)
        setTimeout(function () { if (onCard()) { lookAhead(); blink(); } }, 1000);
      });
      rcCard.addEventListener('rc-sweep5', function (e) {
        if (!onCard() || lastStar) return;
        var five = rcCard.querySelectorAll('.rc-star')[4];
        if (five) { five.classList.add('wish'); setTimeout(function () { five.classList.remove('wish'); }, 1400); }
        // the "yes" nod is only ever over the 5th star: if a hover left him over another one, he hops back first
        (five ? rcSlide(box.parentNode, five) : Promise.resolve()).then(function () { if (onCard()) { flag('lift', 600); nodYes(); } });
        setTimeout(function () { if (onCard() && !lastStar) { lookAhead(); blink(); } }, 1100);
        if (e.detail.n % 3 === 0) setTimeout(function () { if (onCard()) bounceNow(); }, 1500);
      });
    }
    // Hovering the review stars (computer): stars 1-3 get a "no" head-shake; on 4 he glances over at 5, hops over to
    // it and nods; on 5 he nods.
    function rcSlide(g, star) {
      var gr = g.getBoundingClientRect(), fr = star.getBoundingClientRect();
      var from = parseFloat(box.style.left); if (isNaN(from)) from = gr.width / 2 - 33;
      var to = fr.left - gr.left + fr.width / 2 - 33;
      if (Math.abs(to - from) < 3) return Promise.resolve();
      box.style.marginLeft = '0'; box.style.left = to + 'px';
      var a = box.animate([{ left: from + 'px' }, { left: to + 'px' }], { duration: 480, easing: 'cubic-bezier(.4,0,.2,1)' });
      box.querySelector('svg').animate([{ transform: 'none' }, { transform: 'translateY(3px) scale(1.05,.93)', offset: .12 }, { transform: 'translateY(-11px)', offset: .5 }, { transform: 'translateY(2px)', offset: .85 }, { transform: 'none' }], { duration: 480, easing: 'ease-in-out' });
      return a.finished.then(function () { a.cancel(); }, function () {});
    }
    // a real "no": his head turns side to side (body slides a little, his eyes swing further, like turning)
    // ms: how long the shake takes (slower further right: star 1 a quick "no", star 3 a slow, unsure one)
    function shakeNo(ms) {
      ms = ms || 760;
      var turn = [{ transform: 'none' }, { transform: 'translateX(-5px)' }, { transform: 'translateX(5px)' }, { transform: 'translateX(-4px)' }, { transform: 'translateX(3px)' }, { transform: 'none' }];
      var eyes = [{ transform: 'none' }, { transform: 'translateX(-5px)' }, { transform: 'translateX(5px)' }, { transform: 'translateX(-4px)' }, { transform: 'translateX(3px)' }, { transform: 'none' }];
      box.querySelector('svg').animate(turn, { duration: ms, easing: 'ease-in-out' });
      var open = box.querySelector('.he-open'); if (open) open.animate(eyes, { duration: ms, easing: 'ease-in-out' });
    }
    // a real "yes": his head tips down and back up, twice (his eyes dip a little further, like looking down)
    function nodYes() {
      var head = [{ transform: 'none' }, { transform: 'translateY(6px)' }, { transform: 'translateY(-1px)' }, { transform: 'translateY(6px)' }, { transform: 'none' }];
      var eyes = [{ transform: 'none' }, { transform: 'translateY(3px)' }, { transform: 'none' }, { transform: 'translateY(3px)' }, { transform: 'none' }];
      box.querySelector('svg').animate(head, { duration: 900, easing: 'ease-in-out' });
      var open = box.querySelector('.he-open'); if (open) open.animate(eyes, { duration: 900, easing: 'ease-in-out' });
    }
    // Tapping a review star: a big smile (like Share this job), long enough to see, then Google reviews opens
    // (a new tab like the link would; the same tab if the browser blocks a late one).
    document.addEventListener('click', function (e) {
      var st = e.target.closest && e.target.closest('.rc-star');
      if (!st || e.metaKey || e.ctrlKey || e.shiftKey || e.button) return;
      if (!onReview() || !box.parentNode.contains(st) || mode !== 'idle' || busy || !box.classList.contains('up')) return;
      var all = box.parentNode.querySelectorAll('.rc-star');
      if (st !== all[all.length - 1]) return;   // smile only for 5 stars (1-4 open the review page as a plain link)
      e.preventDefault(); busy = true; clearTimeout(starTimer); lastStar = null;
      var href = st.href;
      lookAhead(); flag('glad', 1600); flag('lift', 1600); bounceNow();
      setTimeout(function () {
        var w = null;
        try { w = window.open(href, '_blank'); if (w) w.opener = null; } catch (x) { w = null; }
        if (!w) location.href = href;
        busy = false;
      }, 1500);
    }, true);
    var starTimer = 0, lastStar = null, SHAKE_MS = [650, 1000, 1400];   // the "no" shake on stars 1, 2, 3
    // On 5 stars, like a person would: a nod down at the star, then he looks up at you and nods again ("yes, that
    // one"), then just waits; if you stay a while longer he does it once more.
    function keepNodding(st) {
      if (lastStar !== st || busy) return;
      var five = box.parentNode.querySelectorAll('.rc-star')[4];
      if (five) lookAtEl(five);
      nodYes();
      starTimer = setTimeout(function () {
        if (lastStar !== st || busy) return;
        lookAhead(); flag('lift', 700);
        starTimer = setTimeout(function () {
          if (lastStar !== st || busy) return;
          nodYes(); blink();
          starTimer = setTimeout(function () { keepNodding(st); }, 4200);
        }, 450);
      }, 1150);
    }
    document.addEventListener('pointerover', function (e) {
      if (e.pointerType !== 'mouse') return;
      var st = e.target.closest && e.target.closest('.rc-star');
      var g = box.parentNode;
      if (!st || st === lastStar || !g.classList || !g.classList.contains('rc-go') || !g.contains(st) || mode !== 'idle' || busy || moving) return;
      lastStar = st; clearTimeout(starTimer);
      var stars = g.querySelectorAll('.rc-star'), i = Array.prototype.indexOf.call(stars, st), five = stars[4];
      // he hops over to the star you're on, his eyes on it the whole way (John): 1-3 a "no" head-shake; 4 he looks at
      // it, then over at 5, hops to it and nods; 5 a nod
      lookAtEl(st);
      rcSlide(g, st).then(function () {
        if (lastStar !== st) return;
        lookAtEl(st);
        if (i < 3) {   // (John) he looks straight ahead at you and shakes his head "no", looks back down at the star, and a
          // little later does it again, for as long as you're pointing at it
          var ms = SHAKE_MS[i];
          (function noAgain(wait) {
            starTimer = setTimeout(function () {
              if (lastStar !== st || busy) return;
              lookAhead();
              starTimer = setTimeout(function () {
                if (lastStar !== st || busy) return;
                shakeNo(ms);
                starTimer = setTimeout(function () { if (lastStar !== st || busy) return; lookAtEl(st); noAgain(3200); }, ms);
              }, 300);
            }, wait);
          })(500);
        }
        else if (i === 3) {
          starTimer = setTimeout(function () {
            if (lastStar !== st) return;
            lookAtEl(five); flag('lift', 600);
            starTimer = setTimeout(function () { if (lastStar !== st) return; rcSlide(g, five).then(function () { lookAtEl(five); keepNodding(st); }); }, 400);
          }, 350);
        } else { lookAtEl(five); keepNodding(st); }
      });
    });
    document.addEventListener('pointerout', function (e) {
      if (!(e.target.closest && e.target.closest('.rc-stars') && !(e.relatedTarget && e.relatedTarget.closest && e.relatedTarget.closest('.rc-star')))) return;
      lastStar = null;
      setTimeout(function () { var five = onCard() && !lastStar && box.parentNode.querySelectorAll('.rc-star')[4]; if (five) rcSlide(box.parentNode, five); }, 900);   // off the stars: back home over 5
    });
    function pickSpot() {
      var rv = reviewSpot(); if (rv) return { el: rv, place: { side: 'center' } };
      var best = null, bestD = Infinity, mid = window.innerHeight * 0.45, lines = textLines();
      SPOTS.forEach(function (sel) {
        var el = document.querySelector(sel);
        if (!visible(el)) return;
        var place = placeOn(el, lines);
        if (!place) return;                // every position would cover words: skip this spot
        var d = Math.abs(el.getBoundingClientRect().top - mid);
        if (d < bestD) { bestD = d; best = { el: el, place: place }; }
      });
      return best;
    }
    async function moveTo(spot, place) {
      if (moving || !spot || box.parentNode === spot) return;
      moving = true;
      box.classList.remove('up', 'glad', 'lift', 'wide');
      await wait(spot.classList.contains('rc-go') ? 160 : 380);   // ducked out of sight at the old spot (quicker to the review card)
      spot.classList.add('eyes-spot');
      if (spot.classList.contains('rc-go') && !spot.querySelector('.rc-guy.themed'))   // the card's own spare guy (if he popped up first) steps aside
        spot.classList.remove('up', 'lift', 'five', 'back', 'nod', 'talk', 'no', 'lookl', 'lookr', 'track');
      box.getAnimations().forEach(function (an) { an.cancel(); });   // nothing left over from the last spot
      spot.appendChild(box);
      var center = place && place.side === 'center';
      box.style.left = center ? '50%' : place && place.side === 'left' ? place.off + 'px' : '';   // home and right-side spots use the stylesheet
      box.style.right = center || (place && place.side === 'left') ? 'auto' : (place ? place.off + 'px' : '');
      box.style.marginLeft = center ? '-33px' : '';
      if (spot.classList.contains('rc-go')) {   // the review card: he comes up right over the 5th star (no hop across)
        var f5 = spot.querySelectorAll('.rc-star')[4];
        if (f5) { var sr = spot.getBoundingClientRect(), fr = f5.getBoundingClientRect(); box.style.marginLeft = '0'; box.style.right = 'auto'; box.style.left = (fr.left - sr.left + fr.width / 2 - 33) + 'px'; }
      }
      await wait(60);
      box.classList.add('up');
      await wait(450); blink(); lookAt(lastX || window.innerWidth / 2, lastY || window.innerHeight / 2);
      if (spot.classList.contains('rc-go')) { await wait(300); hintReview(spot); }
      moving = false;
      roam();                            // the page may have scrolled on while he was hopping: check again
    }
    function roam() {
      if (window.EAOMHoliday && EAOMHoliday.on) return;   // December: the holiday peekers have the page; he stays home
      if (mode !== 'idle' || busy) return;   // not while he's on a call / talking
      if (homeOnScreen()) { if (box.parentNode !== card) moveTo(card, null); return; }
      var here = box.parentNode, rv = reviewSpot();
      if (rv && here !== rv) { moveTo(rv, { side: 'center' }); return; }   // the review card always wins
      if (here !== card && (onReview() ? inView(here) && !footballInView() : visible(here))) return;   // still a good spot (the review card: as long as it's on screen at all)
      var next = pickSpot();
      if (next) { if (next.el !== here) moveTo(next.el, next.place); }
      else if (box.classList.contains('up') && here !== card) box.classList.remove('up');   // nowhere clear: stay hidden
    }
    window.addEventListener('scroll', function () {
      if (mode === 'intro' && !homeOnScreen()) skipIntro();   // scrolled away mid-intro: stop typing, go where they are
      clearTimeout(settleTimer);
      if (!homeOnScreen() && box.parentNode === card && box.classList.contains('up')) box.classList.remove('up');   // duck as home leaves
      settleTimer = setTimeout(roam, reviewSpot() && box.parentNode !== reviewSpot() ? 90 : 260);   // the review card: go right away
    }, { passive: true });
    window.addEventListener('resize', function () { clearTimeout(settleTimer); settleTimer = setTimeout(roam, 260); });
  }

  // Speech-bubble contents (also used by holiday.js). sub 'er' = the after-hours line, where "urgent care or ER" is
  // one link that opens a near-me search for both in their maps app (underlined, with a little directions arrow).
  var ARROW = '<svg aria-hidden="true" viewBox="0 0 24 24" width="13" height="13"><path fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round" d="M20.5 3.5 3.5 10.6l7 2.9 2.9 7z"/></svg>';
  function mapLink(label, query) {
    var a = document.createElement('a');
    a.className = 'he-map'; a.target = '_blank'; a.rel = 'noopener';
    a.href = window.EAOMDirections && EAOMDirections.searchHere ? EAOMDirections.searchHere(query) : 'https://www.google.com/maps/search/' + encodeURIComponent(query + ' near me');
    a.appendChild(document.createTextNode(label)); a.insertAdjacentHTML('beforeend', ARROW);   // icon after the words
    return a;
  }
  function fillBubble(bub, line) {
    line = typeof line === 'string' ? { text: line } : line;
    bub.textContent = '';
    String(line.text).split('\n').forEach(function (t, i) {   // "\n" = a new line in the bubble ("Tap the call button..." on its own line)
      if (i) bub.appendChild(document.createElement('br'));
      bub.appendChild(document.createTextNode(t));
    });
    if (!line.sub) return;
    var sm = document.createElement('small');
    if (line.sub === 'er') {
      sm.appendChild(document.createTextNode('Eye emergency? Go to the'));
      sm.appendChild(document.createElement('br'));   // the map link gets its own line (a clean tap target)
      sm.appendChild(mapLink('nearest urgent care or ER', 'urgent care emergency room'));   // one search that finds both
    } else sm.textContent = line.sub;
    bub.appendChild(sm);
  }

  // active(): he's busy with a call / hopping somewhere (holiday.js keeps the other characters still meanwhile)
  window.EAOMHiringEyes = { start: start, fillBubble: fillBubble, active: function () { return !!(activeFn && activeFn()); } };
})();
