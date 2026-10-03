/* Revision hub: the subject sites plus useful links, all read from hub.json. */
(function () {
  'use strict';

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function fmt(n) { return n ? Number(n).toLocaleString('en-GB') : ''; }

  function render(data) {
    document.title = data.title || 'Revision';
    var h = '<div class="wrap"><header class="top"><div class="brand">' + JBR_LOGO + '<div><h1>' + esc(data.title) + '</h1>' +
      (data.subtitle ? '<p class="subtitle">' + esc(data.subtitle) + '</p>' : '') + '</div></div>' + TOGGLE + '</header>';

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
          '<div class="body"><div class="title">' + esc(c.title) + '</div></div>';
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

  // Josh B Revision monogram (the B overlaps the J and the R the B, with negative space where they meet); colours come from hub.css
  var JBR_LOGO = '<svg class="jbr" viewBox="0 0 3981 3981" aria-hidden="true"><rect class="jbr-bg" width="3981" height="3981" rx="239"/><g transform="translate(468 2724) scale(1 -1)" class="jbr-fg"><path d="M561.8665771484375 -23.232177734375Q319.3839111328125 -23.232177734375 185.0712890625 103.0804443359375Q50.7586669921875 229.39306640625 50.7586669921875 464.4022216796875V575.10791015625H395.5997314453125V461.1700439453125Q395.5997314453125 376.30902099609375 437.88268085554535 330.8785095214844Q480.1656302657782 285.447998046875 556.2102661132812 285.447998046875Q631.6929133858267 285.447998046875 674.2568570835383 330.8785095214844Q716.82080078125 376.30902099609375 716.82080078125 461.1700439453125V1490H1087.519287109375V455.0405867551228Q1087.519287109375 224.5447998046875 949.5704650878906 100.65631103515625Q811.6216430664062 -23.232177734375 561.8665771484375 -23.232177734375Z"/><path transform="translate(820 0)" class="jbr-over" stroke-width="90" paint-order="stroke" d="M93.052978515625 0V1490H718.32177734375Q884.482666015625 1490 998.8510437011719 1441.9040222167969Q1113.2194213867188 1393.8080444335938 1171.9314880371094 1309.3482666015625Q1230.6435546875 1224.8884887695312 1230.6435546875 1113.39306640625Q1230.6435546875 1027.5850219726562 1195.9872436523438 959.3327331542969Q1161.3309326171875 891.0804443359375 1098.8464660644531 846.1563110351562Q1036.3619995117188 801.232177734375 951.4735107421875 782.5045776367188V780.5045776367188Q1045.3619995117188 775.39306640625 1120.3263549804688 729.660888671875Q1195.2907104492188 683.9287109375 1239.0228881835938 605.2723999023438Q1282.7550659179688 526.6160888671875 1282.7550659179688 421.232177734375Q1282.7550659179688 298.27239990234375 1222.2349548339844 203.06033325195312Q1161.71484375 107.8482666015625 1046.0429992675781 53.92413330078125Q930.3711547851562 0 765.10791015625 0ZM454.054931640625 282.82275390625H702.0804443359375Q795.9323120117188 282.82275390625 849.6662902832031 327.3337097167969Q903.4002685546875 371.84466552734375 903.4002685546875 449.7861328125Q903.4002685546875 502.0804443359375 879.2531127929688 540.1672668457031Q855.10595703125 578.2540893554688 810.6196899414062 599.0374450683594Q766.1334228515625 619.82080078125 704 619.82080078125H454.054931640625ZM454.054931640625 887.71484375H681.6873779296875Q736.7092895507812 887.71484375 776.8518676757812 907.2102661132812Q816.9944458007812 926.7056884765625 838.6617126464844 962.8126220703125Q860.3289794921875 998.9195556640625 860.3289794921875 1047.446044921875Q860.3289794921875 1120.2357788085938 812.2266235351562 1163.7065124511719Q764.124267578125 1207.17724609375 681.6873779296875 1207.17724609375H454.054931640625Z"/><path transform="translate(1680 0)" class="jbr-over" stroke-width="90" paint-order="stroke" d="M93.052978515625 0V1490H710.696533203125Q884.4735107421875 1490 1011.3062438964844 1428.1316223144531Q1138.1389770507812 1366.2632446289062 1206.911376953125 1252.642578125Q1275.6837768554688 1139.0219116210938 1275.6837768554688 983.052978515625Q1275.6837768554688 831.124267578125 1203.7194213867188 720.2357788085938Q1131.7550659179688 609.3472900390625 1000.6142883300781 549.0950012207031Q869.4735107421875 488.84271240234375 690.232177734375 488.84271240234375H319.10791015625V779.7459106445312H684.8793334960938Q755.5575561523438 779.7459106445312 806.624267578125 805.1453552246094Q857.6909790039062 830.5447998046875 885.5703125 876.3436889648438Q913.4496459960938 922.142578125 913.4496459960938 983.052978515625Q913.4496459960938 1044.96337890625 885.4743347167969 1090.1662902832031Q857.4990234375 1135.3692016601562 806.4323120117188 1160.7686462402344Q755.3656005859375 1186.1680908203125 684.4954223632812 1186.1680908203125H463.75146484375V0ZM926.1151123046875 0 595.2047119140625 674.8482666015625H977.7825317382812L1316.3090209960938 0Z"/></g></svg>';

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
