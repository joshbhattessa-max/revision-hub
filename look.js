// The look button: a small button beside the light/dark button that flips the site between the Studio look (default)
// and the Bubbly look (data-look="bold", the value kept from the older Bold look so saved choices still work). The choice is saved on this device as jbr-look and set before first paint by the inline
// script in the page head; the styles are in look.css.
(function () {
  var root = document.documentElement;
  if (!root.hasAttribute('data-look')) { var l0 = 'soft'; try { l0 = localStorage.getItem('jbr-look') || 'soft'; } catch (e) {} root.setAttribute('data-look', l0); }
  // two overlapping squares, one outlined and one filled: "change the look"
  var ICON = '<svg viewBox="0 0 20 20" aria-hidden="true"><rect x="2.5" y="2.5" width="9" height="9" rx="2.5" fill="none" stroke="currentColor" stroke-width="1.6"/><rect x="8.5" y="8.5" width="9" height="9" rx="2.5" fill="currentColor"/></svg>';
  function label() { return root.getAttribute('data-look') === 'bold' ? 'Switch to the clean look' : 'Switch to the bubbly look'; }
  function place() {
    var btn = '<button type="button" class="look-btn" title="' + label() + '" aria-label="' + label() + '">' + ICON + '</button>';
    var t = document.querySelector('.theme-toggle');
    if (!t) {   // the front page and "Try a few questions" have no light/dark button: it goes first in the top bar
      var nav = document.querySelector('.nav-r');
      if (nav && !nav.querySelector('.look-btn')) nav.insertAdjacentHTML('afterbegin', btn);
      return;
    }
    if (t.previousElementSibling && t.previousElementSibling.classList.contains('look-btn')) return;
    var old = document.querySelector('.look-btn'); if (old) old.remove();
    t.insertAdjacentHTML('beforebegin', btn);
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('.look-btn'); if (!b) return;
    var l = root.getAttribute('data-look') === 'bold' ? 'soft' : 'bold';
    root.setAttribute('data-look', l);
    try { localStorage.setItem('jbr-look', l); } catch (er) {}
    b.title = label(); b.setAttribute('aria-label', label());
  });
  // the header is drawn (and redrawn) by the app, so put the button back whenever it changes
  function start() { place(); new MutationObserver(place).observe(document.body, { childList: true, subtree: true }); }
  if (document.body) start(); else document.addEventListener('DOMContentLoaded', start);
})();
