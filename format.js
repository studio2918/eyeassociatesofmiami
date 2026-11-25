/*
  Simple text formatting for text typed in the admin (insurance boxes, job details), shared by
  index.html and careers.html. Builds DOM nodes only; no HTML from the feed is ever parsed.
    - each line is its own paragraph
    - a line starting "- " is a bullet (a blank line ends the list)
    - **two stars** around words make them bold
*/
(function () {
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text) e.textContent = text;
    return e;
  }
  // "Some **bold** words" -> text nodes + <b> elements
  function inline(parent, text) {
    String(text).split(/\*\*(.+?)\*\*/).forEach(function (part, i) {
      if (!part) return;
      parent.appendChild(i % 2 ? el('b', '', part) : document.createTextNode(part));
    });
    return parent;
  }
  function boxBody(box, text) {
    var ul = null;
    String(text || '').split('\n').forEach(function (line) {
      line = line.trim();
      if (!line) { ul = null; return; }
      if (line.indexOf('- ') === 0) {
        if (!ul) ul = box.appendChild(el('ul'));
        ul.appendChild(inline(el('li'), line.slice(2)));
      } else {
        ul = null;
        box.appendChild(inline(el('p'), line));
      }
    });
    return box;
  }
  window.EAOMFormat = { el: el, inline: inline, boxBody: boxBody };
})();
