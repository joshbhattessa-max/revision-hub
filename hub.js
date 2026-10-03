/* Revision hub: the subject sites plus links, images and notes, all read from hub.json. */
(function () {
  'use strict';

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function host(u) { try { return new URL(u, location.href).hostname.replace(/^www\./, ''); } catch (e) { return ''; } }
  function fmt(n) { return n ? Number(n).toLocaleString('en-GB') : ''; }

  function render(data) {
    document.title = data.title || 'Revision';
    var h = '<div class="wrap"><header class="top"><div><h1>' + esc(data.title) + '</h1>' +
      '<p class="subtitle">' + esc(data.subtitle) + '</p></div>' + TOGGLE + '</header>';

    h += '<h2>Subjects</h2><div class="grid">';
    (data.sites || []).forEach(function (s) {
      if (s.hidden) return;
      var live = !!s.origin;
      var band = s.image ? 'background-image:linear-gradient(rgba(0,0,0,.15),rgba(0,0,0,.35)),url(' + esc(s.image) + ');' : '';
      h += '<a class="subject' + (live ? '' : ' off') + '" href="' + (live ? '/' + esc(s.path) + '/' : '#') + '" style="--c:' + esc(s.color || '#33312e') + '">' +
        '<div class="band" style="' + band + '"><span class="logo">' + esc(s.name) + '</span></div>' +
        '<div class="body"><div class="name">' + esc(s.subject) + '</div>' +
        '<div class="stats">' + (s.questions ? fmt(s.questions) + ' questions · ' + fmt(s.papers) + ' papers' : '') +
        (live ? '' : ' · not online yet') + '</div></div></a>';
    });
    h += '</div>';

    (data.sections || []).forEach(function (sec) {
      if (!sec.cards || !sec.cards.length) return;
      h += '<h2>' + esc(sec.title) + '</h2><div class="grid">';
      sec.cards.forEach(function (c) {
        var inner = (c.image ? '<img src="' + esc(c.image) + '" alt="" loading="lazy">' : '') +
          '<div class="body"><div class="title">' + esc(c.title) + '</div>' +
          (c.note ? '<div class="note">' + esc(c.note) + '</div>' : '') +
          (c.url ? '<div class="host">' + esc(host(c.url)) + '</div>' : '') + '</div>';
        h += c.url ? '<a class="card" href="' + esc(c.url) + '" target="_blank" rel="noopener">' + inner + '</a>' : '<div class="card">' + inner + '</div>';
      });
      h += '</div>';
    });
    h += '<footer>Past papers and mark schemes are © their exam boards. For personal revision.</footer></div>';
    document.getElementById('app').innerHTML = h;
    var btn = document.querySelector('.theme-toggle');
    btn.addEventListener('click', function () { toggleTheme(btn); });
    syncToggle();
  }

  // ------------------------------------------------------------------ light / dark
  var RAYS = [0, 45, 90, 135, 180, 225, 270, 315].map(function (a) {
    return '<line x1="12" y1="1.6" x2="12" y2="3.4" transform="rotate(' + a + ' 12 12)"/>';
  }).join('');
  var TOGGLE = '<button class="theme-toggle" type="button" data-mode="light">' +
    '<svg class="sun-moon" viewBox="0 0 24 24" aria-hidden="true">' +
    '<mask id="moon-mask"><rect width="24" height="24" fill="white"/><circle class="moon-cut" cx="30" cy="-2" r="7" fill="black"/></mask>' +
    '<circle class="sun-core" cx="12" cy="12" r="5" fill="currentColor" mask="url(#moon-mask)"/>' +
    '<g class="sun-rays" stroke="currentColor" stroke-width="2" stroke-linecap="round">' + RAYS + '</g>' +
    '<g class="stars" fill="currentColor"><circle cx="21" cy="4" r="1"/><circle cx="23" cy="10" r=".7"/><circle cx="17.5" cy="1.2" r=".6"/></g>' +
    '</svg></button>';
  var darkQuery = window.matchMedia ? matchMedia('(prefers-color-scheme: dark)') : { matches: false };

  function currentTheme() {
    return document.documentElement.getAttribute('data-theme') || (darkQuery.matches ? 'dark' : 'light');
  }
  function syncToggle() {
    var b = document.querySelector('.theme-toggle');
    if (!b) return;
    var mode = currentTheme(), label = mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode';
    b.setAttribute('data-mode', mode); b.setAttribute('aria-label', label); b.title = label;
  }
  function toggleTheme(btn) {
    var next = currentTheme() === 'dark' ? 'light' : 'dark';
    function apply() {
      document.documentElement.setAttribute('data-theme', next);
      try { localStorage.setItem('hub-theme', next); } catch (e) { /* storage blocked */ }
      syncToggle();
    }
    var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!document.startViewTransition || reduce) { apply(); return; }
    // the new theme grows out of the button as a circle
    var r = btn.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2;
    var end = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
    document.startViewTransition(apply).ready.then(function () {
      document.documentElement.animate(
        { clipPath: ['circle(0px at ' + x + 'px ' + y + 'px)', 'circle(' + end + 'px at ' + x + 'px ' + y + 'px)'] },
        { duration: 700, easing: 'cubic-bezier(.65, 0, .35, 1)', pseudoElement: '::view-transition-new(root)' });
    });
  }
  if (darkQuery.addEventListener) darkQuery.addEventListener('change', syncToggle);

  // drafts left over from the old editable version are no longer used
  try { localStorage.removeItem('hub-draft'); } catch (e) { /* storage blocked */ }

  fetch('hub.json', { cache: 'no-store' }).then(function (r) { return r.json(); }).then(render).catch(function () {
    document.getElementById('app').innerHTML = '<p class="loading">Could not load hub.json.</p>';
  });
})();
