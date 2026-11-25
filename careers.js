/*
  Careers page (careers.html): the open jobs from the admin feed, each with
    - Apply now: the application page (apply.html?job=<id>) with that job picked
    - Share: the phone's share menu (Messages, email, Facebook...), or "Link copied" on a computer
  A shared job link is careers.html?job=<id>: the page opens at the top (Join our team) with that job highlighted.
  No jobs on: "We're not hiring right now."
*/
(function () {
  function anchorFor(job) { return 'job-' + encodeURIComponent(String(job.id || job.position || '')); }
  // pageUrl = the Careers page's address; job null = share the whole page (several jobs open)
  function shareFor(job, pageUrl) {
    var base = String(pageUrl || '').split('#')[0].split('?')[0];
    // Worded for the person who receives it (a friend is usually the one sending it):
    // "Eye Associates of Miami is hiring a Patient Flow Coordinator. You should apply!"
    if (!job) return { title: 'Careers — Eye Associates of Miami', text: 'Eye Associates of Miami is hiring!', url: base };
    var pos = String(job.position).trim(), an = /^[aeiou]/i.test(pos) ? 'an ' : 'a ';
    return {
      title: pos + ' — Eye Associates of Miami',
      text: 'Eye Associates of Miami is hiring ' + an + pos + '. You should apply!',
      url: base + '?job=' + encodeURIComponent(String(job.id || job.position || ''))
    };
  }
  function openJobs(jobs) {
    return (jobs || []).filter(function (j) { return j && typeof j.position === 'string' && j.position.trim(); });
  }

  window.EAOMCareers = { anchorFor: anchorFor, shareFor: shareFor, openJobs: openJobs };
  if (typeof document === 'undefined' || !window.EAOMHours || !window.EAOMFormat) return;

  var F = window.EAOMFormat, el = F.el;

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(text);
    return new Promise(function (ok, fail) {   // older browsers
      var t = el('textarea'); t.value = text; t.setAttribute('readonly', ''); t.style.position = 'fixed'; t.style.opacity = '0';
      document.body.appendChild(t); t.select();
      try { document.execCommand('copy') ? ok() : fail(); } catch (e) { fail(e); } finally { t.remove(); }
    });
  }

  // The Careers page's address, from this page or from the main page
  function careersUrl() { return new URL('careers.html', location.href).href; }

  function share(job, msg) { sendShare(shareFor(job, careersUrl()), msg); }

  // "Share this site" (bottom of every page): the home page
  function shareSite(msg) {
    sendShare({ title: 'Eye Associates of Miami', text: 'Our hometown eye doctors on North Main in Miami, OK.', url: new URL('./', location.href).href }, msg);
  }
  document.addEventListener('click', function (e) {     // any "Share this site" button, wherever it is on the page
    var b = e.target.closest && e.target.closest('[data-share-site]');
    if (b) shareSite(b.parentNode.querySelector('.share-site-msg'));
  });

  function toast() {
    var t = document.getElementById('share-toast');
    if (!t) { t = el('div', 'share-toast'); t.id = 'share-toast'; t.setAttribute('role', 'status'); document.body.appendChild(t); }
    return t;
  }

  // phones: the share sheet; computers: copy the link
  function sendShare(data, msg) {
    if (navigator.share) {
      navigator.share(data).catch(function () { /* closed the share menu: nothing to do */ });
      return;
    }
    if (!msg) msg = toast();          // e.g. the phone bottom bar: a small pop-up note above it
    copyText(data.url).then(function () {
      msg.textContent = 'Link copied. Paste it in a text or email.';
    }, function () {
      msg.textContent = 'Copy this link: ' + data.url;
    });
    clearTimeout(msg._t);
    msg._t = setTimeout(function () { msg.textContent = ''; }, 6000);
  }
  window.EAOMCareers.share = share;   // the main page's hiring strip uses it too

  // careers.html?job=<id> (a shared link, or the main page's "Join our team"): highlight it, but start at the top.
  // careers.html#job-<id> (older shared links): jump to that job and highlight it.
  function lightUp() {
    var hash = decodeURIComponent((location.hash || '').slice(1));
    var q = new URLSearchParams(location.search).get('job');
    var id = hash || (q ? decodeURIComponent(anchorFor({ id: q })) : '');
    document.querySelectorAll('.job.lit').forEach(function (j) { j.classList.remove('lit'); });
    var card = id && document.getElementById(id);
    if (card && card.classList.contains('job')) { card.classList.add('lit'); if (hash) card.scrollIntoView({ block: 'start' }); }
  }

  window.EAOMHours.ready.then(function (info) {
    var jobs = /[?&]hiring=off/.test(location.search) ? [] : openJobs(info.jobs), list = document.getElementById('jobs');   // ?hiring=off previews "not hiring"
    if (!jobs.length && document.getElementById('no-jobs')) document.getElementById('no-jobs').hidden = false;   // Careers or Apply page
    var how = document.getElementById('apply');   // Apply page: the in-person option under the form
    if (how && jobs.length) how.textContent = (info.cfg || {}).howToApply || 'Prefer to apply in person? Stop by the front desk or call (918) 540-1929.';
    if (!list) return;   // not the Careers page
    if (!jobs.length) { document.getElementById('no-jobs').hidden = false; return; }
    jobs.forEach(function (j) {
      var card = el('article', 'job');
      card.id = decodeURIComponent(anchorFor(j));
      card.appendChild(el('h2', '', j.position));
      if (j.hours) card.appendChild(el('span', 'hours', j.hours));
      if (j.details) F.boxBody(card.appendChild(el('div', 'job-details')), j.details);
      var actions = card.appendChild(el('div', 'job-actions'));
      var go = actions.appendChild(el('a', 'btn', 'Apply now'));
      go.href = 'apply.html?job=' + encodeURIComponent(j.id || '');
      var sh = actions.appendChild(el('button', 'btn ghost', 'Share this job'));
      sh.type = 'button';
      var msg = actions.appendChild(el('span', 'share-msg'));
      msg.setAttribute('role', 'status');
      sh.addEventListener('click', function () { share(j, msg); });
      list.appendChild(card);
    });
    lightUp();
    window.addEventListener('hashchange', lightUp);
    spotlight();
  });



  // Perk icons flip through their ideas only while their card is in the spotlight (about every 1.2 s).
  var stillMQ = window.matchMedia('(prefers-reduced-motion: reduce)');
  // Each icon stays up for its data-ms (default 1.25 s on phones, 0.85 s on computers, where the tour moves card
  // to card), so a frame like the driving car can take longer.
  var deskMQ = window.matchMedia('(min-width: 861px)');
  function iconMs(el) { return +(el && el.getAttribute('data-ms')) || (deskMQ.matches ? 850 : 1250); }
  function cycleMs(card) {              // one full pass through a card's icons
    return Array.prototype.reduce.call(card.querySelectorAll('.pi'), function (sum, el) { return sum + iconMs(el); }, 0);
  }
  // Start a card's icons at the first one and step through them. once=true: one full pass, then done() (the
  // desktop tour moves to the next card); otherwise it keeps looping (phones, or a hovered card).
  function iconsOn(card, once, done) {
    if (!card || stillMQ.matches) { if (done) setTimeout(done, 3000); return; }
    iconsOff(card);
    var icons = card.querySelectorAll('.pi');
    if (icons.length < 2) { if (done) card._flip = setTimeout(done, 3000); return; }
    Array.prototype.forEach.call(icons, function (x, k) { x.classList.toggle('on', k === 0); });
    var i = 0;
    function step() {
      card._flip = setTimeout(function () {
        if (once && i === icons.length - 1) { card._flip = 0; if (done) done(); return; }
        icons[i].classList.remove('on');
        i = (i + 1) % icons.length;
        icons[i].classList.add('on');
        step();
      }, iconMs(icons[i]));
    }
    step();
  }
  function iconsOff(card) { if (card && card._flip) { clearTimeout(card._flip); card._flip = 0; } }

  // Phones: as you scroll, the card nearest the middle of the screen comes forward (a touch bigger, lifted,
  // fully bright) and the others sit back a little; its icon flips.
  // Computers: the perk cards take turns coming forward for ~5 s each, flipping their icon; hovering a card
  // brings that one forward instead. Off for "reduce motion".
  function spotlight() {
    var phone = window.matchMedia('(max-width: 860px)');
    var cards = Array.prototype.slice.call(document.querySelectorAll('.perks li, .careers-list .job, .steps li'));
    var perks = Array.prototype.slice.call(document.querySelectorAll('.perks li'));
    if (!cards.length) return;
    var ticking = false, current = null, tour = 0, tourIdx = -1, hovered = null, touring = false;
    function focus(card, once, done) {
      if (card === current && !once) return;
      if (current) { current.classList.remove('spot'); iconsOff(current); }
      current = card;
      if (card) { card.classList.add('spot'); iconsOn(card, once, done); }
    }
    function stopTour() { var was = touring; clearTimeout(tour); tour = 0; touring = false; if (was && current) { current.classList.remove('spot'); iconsOff(current); current = null; } }
    // Computer: each card comes forward in turn, shows every one of its icons from the first, then the next card.
    function nextTour() {
      touring = true; clearTimeout(tour); tour = 0;
      if (hovered) return;                       // a hovered card holds the spotlight; the tour resumes on leave
      tourIdx = (tourIdx + 1) % perks.length;
      var me = perks[tourIdx];
      focus(me, true, function () { if (touring && current === me && !hovered) tour = setTimeout(nextTour, 250); });
    }
    function paint() {
      ticking = false;
      var still = stillMQ.matches;
      document.body.classList.toggle('spot-on', phone.matches && !still);
      document.body.classList.toggle('spot-desk', !phone.matches && !still);
      if (still) { stopTour(); focus(null); return; }
      if (!phone.matches) {            // computer: the tour
        if (!touring && perks.length) nextTour();
        return;
      }
      stopTour();
      // the "focus line" sits a bit above the middle, and slides down near the end of the page so the last cards get a turn
      var h = window.innerHeight, left = document.documentElement.scrollHeight - (window.scrollY + h);
      var near = Math.max(0, Math.min(1, 1 - left / (h * 0.6)));
      var mid = h * (0.45 + 0.4 * near), best = null, bestD = Infinity;
      cards.forEach(function (c) {
        var r = c.getBoundingClientRect();
        var d = r.top <= mid && r.bottom >= mid ? 0 : Math.min(Math.abs(r.top - mid), Math.abs(r.bottom - mid));
        if (d < bestD) { bestD = d; best = c; }
      });
      focus(best);
    }
    perks.forEach(function (c, i) {
      c.addEventListener('pointerenter', function (e) { if (e.pointerType !== 'mouse' || phone.matches || stillMQ.matches) return; hovered = c; tourIdx = i; clearTimeout(tour); focus(c, false); });
      c.addEventListener('pointerleave', function (e) { if (e.pointerType !== 'mouse' || hovered !== c) return; hovered = null; if (!phone.matches && !stillMQ.matches) { clearTimeout(tour); tour = setTimeout(nextTour, 600); } });
    });
    function ask() { if (!ticking) { ticking = true; requestAnimationFrame(paint); } }
    window.addEventListener('scroll', ask, { passive: true });
    window.addEventListener('resize', ask);
    if (phone.addEventListener) { phone.addEventListener('change', function () { focus(null); ask(); }); stillMQ.addEventListener('change', ask); }
    paint();
  }
})();
