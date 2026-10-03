/* Revision hub: the subject sites plus useful links, all read from hub.json. */
(function () {
  'use strict';

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function fmt(n) { return n ? Number(n).toLocaleString('en-GB') : ''; }

  function render(data, me) {
    document.title = data.title || 'Revision';
    var h = '<div class="wrap"><header class="top"><div class="brand">' + JBR_LOGO + '<div><h1>' + esc(data.title) + '</h1>' +
      (data.subtitle ? '<p class="subtitle">' + esc(data.subtitle) + '</p>' : '') + '</div></div>' +
      '<div class="top-actions">' + (me && me.role === 'admin' ? '<a class="btn-quiet" href="/admin">Admin console</a>' : '') +
      TOGGLE + '</div></header>';

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
      h += '<h2>' + esc(sec.title) + '</h2><div class="grid links">';
      sec.cards.forEach(function (c) {
        var inner = (c.image ? '<img src="' + esc(c.image) + '" alt="" loading="lazy">' : '') +
          '<div class="body"><div class="title">' + esc(c.title) + '</div></div>';
        h += c.url ? '<a class="card" href="' + esc(c.url) + '" target="_blank" rel="noopener">' + inner + '</a>' : '<div class="card">' + inner + '</div>';
      });
      h += '</div>';
    });
    h += '<footer>Past papers and mark schemes are © their exam boards. For personal revision.' +
      (me ? ' · <button type="button" class="signout">Sign out</button>' : '') + '</footer></div>';
    document.getElementById('app').innerHTML = h;
    var so = document.querySelector('.signout');
    if (so) so.addEventListener('click', function () {
      fetch('/api/logout', { method: 'POST', credentials: 'same-origin' }).then(function () { location.replace('/login'); });
    });
    var btn = document.querySelector('.theme-toggle');
    btn.addEventListener('click', function () { toggleTheme(btn); });
    syncToggle();
  }

  // Josh B Revision logo (heavy JBR running past a ring that breaks where the letters cross it); colours come from hub.css
  var JBR_LOGO = '<svg class="jbr" viewBox="0 0 248 248" aria-hidden="true"><defs><mask id="jbr-ring-gap" maskUnits="userSpaceOnUse" x="0" y="0" width="248" height="248"><rect width="248" height="248" fill="#fff"/><g transform="translate(26.00 164.25) scale(0.05402 -0.05402)" fill="#000" stroke="#000" stroke-width="222" stroke-linejoin="round"><path transform="translate(-45 0)" d="M573 -24Q319 -24 182.0 105.0Q45 234 45 474V592H429V470Q429 398 464.37254901960785 359.0Q499.7450980392157 320 566 320Q631.6929133858267 320 667.3464566929133 359.0Q703 398 703 470V1490H1119V462.3348982785603Q1119 228 977.5 102.0Q836 -24 573 -24Z"/><path transform="translate(1034 0)" d="M80 0V1490H726Q896 1490 1012.0 1442.0Q1128 1394 1187.0 1310.5Q1246 1227 1246 1118Q1246 1032 1210.0 962.5Q1174 893 1109.5 847.5Q1045 802 958 785V783Q1054 780 1130.5 733.5Q1207 687 1251.5 607.0Q1296 527 1296 422Q1296 300 1235.0 204.5Q1174 109 1059.0 54.5Q944 0 782 0ZM484 312H704Q780 312 825.0 352.0Q870 392 870 459Q870 504 849.5 537.0Q829 570 792.0 588.0Q755 606 704 606H484ZM484 900H679Q725 900 759.0 917.0Q793 934 811.5 965.5Q830 997 830 1039Q830 1102 789.0 1140.0Q748 1178 679 1178H484Z"/><path transform="translate(2290 0)" d="M80 0V1490H713Q891 1490 1021.0 1426.5Q1151 1363 1221.5 1246.5Q1292 1130 1292 970Q1292 815 1218.5 702.0Q1145 589 1010.5 527.5Q876 466 691 466H336V788H682Q745 788 790.5 811.0Q836 834 861.0 875.0Q886 916 886 970Q886 1025 861.0 1065.5Q836 1106 790.5 1129.0Q745 1152 682 1152H496V0ZM905 0 581 676H1006L1338 0Z"/></g></mask></defs><circle cx="124" cy="124" r="92" fill="none" stroke-width="6.5" mask="url(#jbr-ring-gap)" class="jbr-ring"/><g class="jbr-ink"><g transform="translate(26.00 164.25) scale(0.05402 -0.05402)"><path transform="translate(-45 0)" d="M573 -24Q319 -24 182.0 105.0Q45 234 45 474V592H429V470Q429 398 464.37254901960785 359.0Q499.7450980392157 320 566 320Q631.6929133858267 320 667.3464566929133 359.0Q703 398 703 470V1490H1119V462.3348982785603Q1119 228 977.5 102.0Q836 -24 573 -24Z"/><path transform="translate(1034 0)" d="M80 0V1490H726Q896 1490 1012.0 1442.0Q1128 1394 1187.0 1310.5Q1246 1227 1246 1118Q1246 1032 1210.0 962.5Q1174 893 1109.5 847.5Q1045 802 958 785V783Q1054 780 1130.5 733.5Q1207 687 1251.5 607.0Q1296 527 1296 422Q1296 300 1235.0 204.5Q1174 109 1059.0 54.5Q944 0 782 0ZM484 312H704Q780 312 825.0 352.0Q870 392 870 459Q870 504 849.5 537.0Q829 570 792.0 588.0Q755 606 704 606H484ZM484 900H679Q725 900 759.0 917.0Q793 934 811.5 965.5Q830 997 830 1039Q830 1102 789.0 1140.0Q748 1178 679 1178H484Z"/><path transform="translate(2290 0)" d="M80 0V1490H713Q891 1490 1021.0 1426.5Q1151 1363 1221.5 1246.5Q1292 1130 1292 970Q1292 815 1218.5 702.0Q1145 589 1010.5 527.5Q876 466 691 466H336V788H682Q745 788 790.5 811.0Q836 834 861.0 875.0Q886 916 886 970Q886 1025 861.0 1065.5Q836 1106 790.5 1129.0Q745 1152 682 1152H496V0ZM905 0 581 676H1006L1338 0Z"/></g></g></svg>';

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

  // content and who is signed in come from the hub's functions (signed-in only)
  var get = function (u) {
    return fetch(u, { cache: 'no-store', credentials: 'same-origin' }).then(function (r) {
      if (r.status === 401) { location.replace('/login'); throw new Error('signed out'); }
      return r.json();
    });
  };
  Promise.all([get('/api/hub'), get('/api/me')]).then(function (r) { render(r[0], r[1]); }).catch(function (e) {
    if (e.message !== 'signed out') document.getElementById('app').innerHTML = '<p class="loading">Could not load the page.</p>';
  });
})();
