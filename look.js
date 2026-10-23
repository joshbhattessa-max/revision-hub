// The look button: a small button beside the light/dark button that flips the site between the Studio look (default)
// and the Bubbly look (data-look="bold", the value kept from the older Bold look so saved choices still work). The choice is saved on this device as jbr-look and set before first paint by the inline
// script in the page head; the styles are in look.css.
(function () {
  var root = document.documentElement;
  // On phones and tablets the light/dark circle animation (a view transition) can stick halfway in Safari and leave the
  // page stuck between themes, so there the theme just switches; the pages fall back to that when this is missing.
  try { if (document.startViewTransition && matchMedia('(pointer: coarse)').matches) document.startViewTransition = null; } catch (e) {}
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
  // Your settings (/settings) are kept with your account, so they follow you to every subject site and device: the
  // saved ones are copied into this browser on each page (at most once a minute), and a change made here with the
  // light/dark or look button is saved back. Only while signed in (the jbr_who cookie).
  var KEYS = { theme: 'hub-theme', look: 'jbr-look', csLang: 'jbr-cs-lang' }, saved = null, timer = 0;
  function get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function set(k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) {} }
  function here() { return { theme: root.getAttribute('data-theme') || 'device', look: root.getAttribute('data-look') || 'soft' }; }
  function apply(p) {
    if (p.theme) { set(KEYS.theme, p.theme === 'device' ? null : p.theme); if (p.theme === 'device') root.removeAttribute('data-theme'); else root.setAttribute('data-theme', p.theme); }
    if (p.look) { set(KEYS.look, p.look); root.setAttribute('data-look', p.look); }
    if (p.csLang) set(KEYS.csLang, p.csLang);
  }
  function save(p) {
    return fetch('/api/prefs', { method: 'PUT', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify(p) })
      .then(function (r) { return r.ok ? r.json() : null; }).then(function (j) { if (j) { saved = j; keep(j); } return j; });
  }
  function keep(p) { try { sessionStorage.setItem('jbr-prefs-at', String(Date.now())); sessionStorage.setItem('jbr-prefs', JSON.stringify(p)); } catch (e) {} }
  function changed() {
    if (!saved) return;
    var now = here(), p = {};
    if (now.theme !== (saved.theme || 'device')) p.theme = now.theme;
    if (now.look !== (saved.look || 'soft')) p.look = now.look;
    if (!p.theme && !p.look) return;
    clearTimeout(timer); timer = setTimeout(function () { save(p); }, 400);
  }
  function sync() {
    if (!/(^|;\s*)jbr_who=/.test(document.cookie)) return;
    var last = 0; try { last = Number(sessionStorage.getItem('jbr-prefs-at')) || 0; saved = JSON.parse(sessionStorage.getItem('jbr-prefs') || 'null'); } catch (e) {}
    new MutationObserver(changed).observe(root, { attributes: true, attributeFilter: ['data-theme', 'data-look'] });
    // the programming language is picked on the computer science site, which saves it only in this browser
    var lang = get(KEYS.csLang), langMoved = saved && lang && lang !== saved.csLang;
    if (saved && Date.now() - last < 60000) { if (langMoved) save({ csLang: lang }); return; }
    fetch('/api/prefs', { credentials: 'same-origin', cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (p) {
      if (!p) return;
      keep(p);
      // nothing saved yet: this browser's choices become the account's
      if (!p.t) { saved = p; var first = { theme: get(KEYS.theme) || 'device', look: here().look }; if (lang) first.csLang = lang; save(first); return; }
      if (langMoved) { p.csLang = lang; save({ csLang: lang }); }
      saved = p; apply(p);
    }).catch(function () {});
  }
  window.JBR_PREFS = { apply: apply, save: function (p) { apply(p); return save(p); }, keys: KEYS };
  sync();

  // the header is drawn (and redrawn) by the app, so put the button back whenever it changes
  function start() { place(); new MutationObserver(place).observe(document.body, { childList: true, subtree: true }); }
  if (document.body) start(); else document.addEventListener('DOMContentLoaded', start);
})();
