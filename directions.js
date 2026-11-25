/*
  Directions links (every [data-directions] link: Find us button, the phone map, the call bar).

  - iPhone / iPad: the first tap asks which app to use (Apple Maps, Google Maps or Waze) and remembers
    the answer on that phone only (localStorage; nothing is sent anywhere). "Change" under Get directions
    asks again.
  - Mac: Apple Maps. Android and everything else: Google Maps. No question.
*/
(function () {
  var APPS = {
    apple: { name: 'Apple Maps', url: 'https://maps.apple.com/?daddr=2222+N+Main+St,+Miami,+OK+74354&q=Eye+Associates+of+Miami' },
    google: { name: 'Google Maps', url: 'https://www.google.com/maps/dir/?api=1&destination=Eye+Associates+of+Miami,+2222+N+Main+St,+Miami,+OK+74354' },
    waze: { name: 'Waze', url: 'https://waze.com/ul?ll=36.901029,-94.8771144&navigate=yes' }
  };
  var KEY = 'eaom-map-app';

  // 'ios' | 'mac' | 'android' | 'other'. iPadOS reports "Macintosh"; it is told apart by its touch screen.
  function platform(ua, touchPoints) {
    ua = String(ua || '');
    if (/Android/.test(ua)) return 'android';
    if (/iPhone|iPad|iPod/.test(ua)) return 'ios';
    if (/Macintosh/.test(ua)) return touchPoints > 1 ? 'ios' : 'mac';
    return 'other';
  }
  function saved() {
    try { var v = window.localStorage.getItem(KEY); return APPS[v] ? v : null; } catch (e) { return null; }
  }
  function save(app) {
    try { window.localStorage.setItem(KEY, app); } catch (e) { /* private mode: just don't remember */ }
  }
  // Which app a directions link opens right now (null on iOS before the first choice: ask).
  function appFor(p, choice) {
    if (p === 'ios') return choice || null;
    return p === 'mac' ? 'apple' : 'google';
  }

  // A "near me" search in the visitor's maps app (their saved choice on iPhone, Apple Maps there by default;
  // Apple Maps on a Mac; Google Maps elsewhere). The maps app finds where they are itself: the site never asks for
  // or sees their location.
  function searchUrl(query, p, choice) {
    var app = appFor(p, choice) || 'apple';
    if (app === 'apple') return 'https://maps.apple.com/?q=' + encodeURIComponent(query);
    if (app === 'waze') return 'https://waze.com/ul?q=' + encodeURIComponent(query);
    return 'https://www.google.com/maps/search/' + encodeURIComponent(query + ' near me');
  }
  function searchHere(query) {
    var nav = typeof navigator !== 'undefined' ? navigator : {};
    return searchUrl(query, platform(nav.userAgent, nav.maxTouchPoints || 0), saved());
  }

  window.EAOMDirections = { APPS: APPS, platform: platform, appFor: appFor, saved: saved, save: save, searchUrl: searchUrl, searchHere: searchHere };

  if (typeof document === 'undefined' || !document.querySelectorAll) return;
  var p = platform(navigator.userAgent, navigator.maxTouchPoints || 0);
  var links = document.querySelectorAll('[data-directions]');
  var dialog = document.getElementById('maps-chooser');
  var pref = document.getElementById('maps-pref');

  function apply() {
    var app = appFor(p, saved());
    links.forEach(function (a) { a.href = APPS[app || 'google'].url; });
    if (pref && p === 'ios') {
      pref.hidden = !app;
      if (app) pref.querySelector('b').textContent = APPS[app].name;
    }
  }
  apply();
  if (p !== 'ios' || !dialog || !dialog.showModal) return;

  links.forEach(function (a) {
    a.addEventListener('click', function (e) {
      if (saved()) return;            // already chosen: the link goes straight there
      e.preventDefault();
      dialog.showModal();
    });
  });
  dialog.querySelectorAll('[data-app]').forEach(function (a) {
    a.href = APPS[a.getAttribute('data-app')].url;
    a.addEventListener('click', function () {   // the tap itself opens the app; remember it for next time
      save(a.getAttribute('data-app'));
      apply();
      dialog.close();
    });
  });
  dialog.querySelector('[data-close]').addEventListener('click', function () { dialog.close(); });
  dialog.addEventListener('click', function (e) { if (e.target === dialog) dialog.close(); });   // tap outside
  if (pref) pref.querySelector('button').addEventListener('click', function () { dialog.showModal(); });
})();
