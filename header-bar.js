/*
  The info bar under the header on computers: the street address (opens directions), open/closed in the middle,
  and the fax number (a click copies it). On phones only the open/closed part shows (index page).
  On pages that don't paint open/closed themselves (#hdr-now[data-self]), it's filled from last visit's hours.
*/
(function () {
  var now = document.querySelector('#hdr-now[data-self]');
  if (now && window.EAOMHours && EAOMHours.cached) {
    try { var s = EAOMHours.nowStatus(EAOMHours.cached); now.textContent = s.text; now.classList.toggle('open', !!s.open); now.hidden = false; } catch (e) {}
  }
  document.querySelectorAll('.hb-fax').forEach(function (b) {
    var label = b.querySelector('.hb-fax-t'), orig = label.textContent, t = 0;
    b.addEventListener('click', function () {
      var num = b.getAttribute('data-copy');
      function done(ok) {
        label.textContent = ok ? 'Fax number copied' : orig;
        b.classList.toggle('copied', ok);
        clearTimeout(t); t = setTimeout(function () { label.textContent = orig; b.classList.remove('copied'); }, 1800);
      }
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(num).then(function () { done(true); }, function () { done(false); });
      else done(false);
    });
  });
})();
