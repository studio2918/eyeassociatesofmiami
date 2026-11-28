/*
  Website visitor counts and button taps (Google Analytics 4). One file, loaded by every public page.

  TO TURN IT ON: paste the practice's GA4 Measurement ID (looks like G-XXXXXXXXXX) between the quotes below.
  Blank = nothing is loaded and nothing is sent.
*/
(function () {
  var GA_ID = 'G-BK7X528RTY';

  /*
  Privacy rules (healthcare site, HHS OCR tracking guidance):
  - Only page views and which button was tapped are sent. Never names, form contents, phone numbers typed,
    appointment details or anything a visitor writes.
  - The page address is sent without its query string or #part, except utm_ tags (they say "came from our Google
    Business Profile"), so nothing a URL carries can leak.
  - Google signals, ad personalization and all advertising storage are OFF. No Meta Pixel, no Tag Manager.
  - Never loaded on the Admin portal, the doctor portal or the after-hours page.
  - Loads only after the page has finished loading, so it never slows the first screen on a phone.
  - Counts only on eyeassociatesofmiami.com. On a preview (localhost) taps are logged to the console instead.
  - Visit any page with ?notrack=1 to stop counting your own phone or computer (?notrack=0 undoes it).

  Events (each tap is counted once):
    phone_click            any (918) 540-1929 link: header, sticky call bar, eye care tiles, "Ready for your next exam",
                           footer, eye care pages, office-status popups. A tap is NOT a completed call.
    directions_click       any Directions / address link, or picking Apple Maps / Google Maps / Waze on an iPhone
                           (the first iPhone tap only opens the chooser and is not counted, so no double count).
    email_click            scheduling@ email link (the site's only "schedule" path besides calling).
    contact_reorder_click  "Reorder your contacts online" (MARLO).
    review_click           "Leave us a Google review".
    share_click            "Share this site" / "Share this job".
    job_application_submit a job application was sent successfully (no applicant details).
  Each carries link_location (sticky_bar, header, footer, care, cta, find, urgent_box, popup, page ...).
  directions_click also carries map_app (apple, google, waze).
  */
  var HOST = 'eyeassociatesofmiami.com';
  var BLOCKED = /^\/(adminportal|doctorportal)(\/|$)|^\/after-hours\.html/;
  var loc = window.location;
  var live = loc.hostname === HOST;
  var preview = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(loc.hostname);

  function optOut() {
    try {
      var m = /[?&]notrack=([01])/.exec(loc.search);
      if (m) { if (m[1] === '1') localStorage.setItem('eaom-notrack', '1'); else localStorage.removeItem('eaom-notrack'); }
      return localStorage.getItem('eaom-notrack') === '1';
    } catch (e) { return false; }
  }

  var on = !!GA_ID && live && !BLOCKED.test(loc.pathname) && !optOut();
  var events = [];   // preview log, also handy for checking in the browser console

  // Page address with no query string or #, except utm_ tags.
  function cleanUrl() {
    var keep = [];
    loc.search.replace(/^\?/, '').split('&').forEach(function (kv) {
      if (/^utm_(source|medium|campaign|term|content)=/.test(kv)) keep.push(kv);
    });
    return loc.origin + loc.pathname + (keep.length ? '?' + keep.join('&') : '');
  }

  // The page the visitor came from, as just its site (https://www.google.com/), never its full address.
  function refClean() {
    try { var r = document.referrer ? new URL(document.referrer) : null; return r ? r.origin + '/' : ''; } catch (e) { return ''; }
  }

  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }

  function track(name, params) {
    params = params || {};
    if (preview) { events.push({ name: name, params: params }); if (window.console) console.info('[analytics]', name, params); }
    if (on) gtag('event', name, params);
  }
  window.EAOMAnalytics = { track: track, events: events, enabled: on };

  if (on) {
    gtag('consent', 'default', {
      ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied', analytics_storage: 'granted'
    });
    gtag('js', new Date());
    // 'set' (not only the config) so every hit, including Google's automatic ones (scroll, outbound click, form),
    // carries the cleaned address. Tested: with only the config value, Google still sent the full address.
    gtag('set', { page_location: cleanUrl(), page_referrer: refClean() });
    gtag('config', GA_ID, {
      page_location: cleanUrl(),
      allow_google_signals: false,
      allow_ad_personalization_signals: false
    });
    // Tested 2026-11-27: Google's tag sends each page's first page view by itself, from the settings in the
    // Analytics account, with the full page address (this site never puts anything private in an address: the
    // only extras are a job number, preview switches and utm_ tags). Every later hit (taps, scroll, outbound
    // links) carries the cleaned address set above. Google signals and ad sharing are switched off in the account too.
    var load = function () {
      var s = document.createElement('script');
      s.async = true;
      s.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(GA_ID);
      document.head.appendChild(s);
    };
    var later = function () { (window.requestIdleCallback || function (f) { setTimeout(f, 1); })(load, { timeout: 3000 }); };
    if (document.readyState === 'complete') later(); else window.addEventListener('load', later);
  }

  // Where on the page a link sits.
  function where(el) {
    if (el.closest('.callbar')) return 'sticky_bar';
    if (el.closest('header')) return 'header';
    if (el.closest('footer')) return 'footer';
    if (el.closest('.topic-alert')) return 'urgent_box';
    if (el.closest('.share-site')) return 'share_strip';
    if (el.closest('.hiring-strip')) return 'hiring_strip';
    var sec = el.closest('section');
    if (sec) return sec.id || (sec.classList[0] || 'section');
    if (el.closest('main')) return 'page';
    return 'popup';
  }
  function mapApp(href) {
    return /maps\.apple\.com/.test(href) ? 'apple' : /waze\.com/.test(href) ? 'waze' : 'google';
  }

  var pendingDirections = null;   // iPhone: where the tap that opened the maps chooser came from

  document.addEventListener('click', function (e) {
    var t = e.target && e.target.closest ? e.target : null;
    if (!t) return;
    var a = t.closest('a[href], button');
    if (!a) return;
    var href = a.getAttribute('href') || '';

    var app = a.closest('#maps-chooser [data-app]');
    if (app) {
      track('directions_click', { link_location: pendingDirections || 'map_chooser', map_app: app.getAttribute('data-app') });
      pendingDirections = null;
      return;
    }
    if (a.hasAttribute('data-directions')) {
      if (e.defaultPrevented) { pendingDirections = where(a); return; }   // chooser opened; counted on the pick
      track('directions_click', { link_location: where(a), map_app: mapApp(a.href) });
      return;
    }
    if (/^tel:/i.test(href)) { track('phone_click', { link_location: where(a) }); return; }
    if (/^mailto:/i.test(href)) { track('email_click', { link_location: where(a) }); return; }
    if (a.classList.contains('marlo-link') || /meetmarlo\.com/.test(href)) { track('contact_reorder_click', { link_location: where(a) }); return; }
    if (a.classList.contains('review-link') || /g\.page\/r\//.test(href)) { track('review_click', { link_location: where(a) }); return; }
    if (a.hasAttribute('data-share-site') || a.id === 'hiring-share') { track('share_click', { link_location: where(a) }); }
  });   // bubble phase, so directions.js has already decided whether the chooser opens
})();
