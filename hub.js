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
    var h = (me && me.maintenance ? '<div class="maint-bar">Maintenance mode is on: only admins can use the site right now. <a href="/admin#maintenance">Turn it off</a></div>' : '') +
      '<div class="wrap"><header class="top"><div class="brand">' + JBR_LOGO + '<div><h1>' + esc(data.title) + '</h1>' +
      (data.subtitle ? '<p class="subtitle">' + esc(data.subtitle) + '</p>' : '') + '</div></div>' +
      '<div class="top-actions">' + (me ? '<a class="btn-quiet" href="/progress">Your progress</a><a class="btn-quiet" href="/planner">Revision planner</a>' : '') +
      (me && me.role === 'admin' ? '<a class="btn-quiet admin-link" href="/admin">Admin console</a>' : '') +
      (me ? userMenu(me) : '') + TOGGLE + '</div></header>';

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
    h += '<footer>Past papers and mark schemes are © their exam boards. For personal revision.</footer></div>';
    document.getElementById('app').innerHTML = h;
    if (me) { wireUserMenu(); hello(me); }
    var btn = document.querySelector('.theme-toggle');
    btn.addEventListener('click', function () { toggleTheme(btn); });
    syncToggle();
  }

  // Josh B Revision logo (heavy JBR running past a ring that breaks where the letters cross it); colours come from hub.css
  var JBR_LOGO = '<svg class="jbr" viewBox="0 0 248 248" aria-hidden="true"><defs><mask id="jbr-ring-gap" maskUnits="userSpaceOnUse" x="0" y="0" width="248" height="248"><rect width="248" height="248" fill="#fff"/><g transform="translate(26.00 164.25) scale(0.05402 -0.05402)" fill="#000" stroke="#000" stroke-width="222" stroke-linejoin="round"><path transform="translate(-45 0)" d="M573 -24Q319 -24 182.0 105.0Q45 234 45 474V592H429V470Q429 398 464.37254901960785 359.0Q499.7450980392157 320 566 320Q631.6929133858267 320 667.3464566929133 359.0Q703 398 703 470V1490H1119V462.3348982785603Q1119 228 977.5 102.0Q836 -24 573 -24Z"/><path transform="translate(1034 0)" d="M80 0V1490H726Q896 1490 1012.0 1442.0Q1128 1394 1187.0 1310.5Q1246 1227 1246 1118Q1246 1032 1210.0 962.5Q1174 893 1109.5 847.5Q1045 802 958 785V783Q1054 780 1130.5 733.5Q1207 687 1251.5 607.0Q1296 527 1296 422Q1296 300 1235.0 204.5Q1174 109 1059.0 54.5Q944 0 782 0ZM484 312H704Q780 312 825.0 352.0Q870 392 870 459Q870 504 849.5 537.0Q829 570 792.0 588.0Q755 606 704 606H484ZM484 900H679Q725 900 759.0 917.0Q793 934 811.5 965.5Q830 997 830 1039Q830 1102 789.0 1140.0Q748 1178 679 1178H484Z"/><path transform="translate(2290 0)" d="M80 0V1490H713Q891 1490 1021.0 1426.5Q1151 1363 1221.5 1246.5Q1292 1130 1292 970Q1292 815 1218.5 702.0Q1145 589 1010.5 527.5Q876 466 691 466H336V788H682Q745 788 790.5 811.0Q836 834 861.0 875.0Q886 916 886 970Q886 1025 861.0 1065.5Q836 1106 790.5 1129.0Q745 1152 682 1152H496V0ZM905 0 581 676H1006L1338 0Z"/></g></mask></defs><circle cx="124" cy="124" r="92" fill="none" stroke-width="6.5" mask="url(#jbr-ring-gap)" class="jbr-ring"/><g class="jbr-ink"><g transform="translate(26.00 164.25) scale(0.05402 -0.05402)"><path transform="translate(-45 0)" d="M573 -24Q319 -24 182.0 105.0Q45 234 45 474V592H429V470Q429 398 464.37254901960785 359.0Q499.7450980392157 320 566 320Q631.6929133858267 320 667.3464566929133 359.0Q703 398 703 470V1490H1119V462.3348982785603Q1119 228 977.5 102.0Q836 -24 573 -24Z"/><path transform="translate(1034 0)" d="M80 0V1490H726Q896 1490 1012.0 1442.0Q1128 1394 1187.0 1310.5Q1246 1227 1246 1118Q1246 1032 1210.0 962.5Q1174 893 1109.5 847.5Q1045 802 958 785V783Q1054 780 1130.5 733.5Q1207 687 1251.5 607.0Q1296 527 1296 422Q1296 300 1235.0 204.5Q1174 109 1059.0 54.5Q944 0 782 0ZM484 312H704Q780 312 825.0 352.0Q870 392 870 459Q870 504 849.5 537.0Q829 570 792.0 588.0Q755 606 704 606H484ZM484 900H679Q725 900 759.0 917.0Q793 934 811.5 965.5Q830 997 830 1039Q830 1102 789.0 1140.0Q748 1178 679 1178H484Z"/><path transform="translate(2290 0)" d="M80 0V1490H713Q891 1490 1021.0 1426.5Q1151 1363 1221.5 1246.5Q1292 1130 1292 970Q1292 815 1218.5 702.0Q1145 589 1010.5 527.5Q876 466 691 466H336V788H682Q745 788 790.5 811.0Q836 834 861.0 875.0Q886 916 886 970Q886 1025 861.0 1065.5Q836 1106 790.5 1129.0Q745 1152 682 1152H496V0ZM905 0 581 676H1006L1338 0Z"/></g></g></svg>';

  // ------------------------------------------------------------------ the menu under your name (top right)
  var CHEVRON = '<svg class="user-chev" viewBox="0 0 12 12" aria-hidden="true"><path d="M3 4.5 6 7.5 9 4.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  function userMenu(me) {
    var until = new Date(me.expires).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    return '<div class="user">' +
      '<button type="button" class="user-chip" aria-haspopup="true" aria-expanded="false">' +
      '<span class="user-av" aria-hidden="true">' + esc(me.username.charAt(0).toUpperCase()) + '</span>' +
      '<span class="user-name">' + esc(me.username) + '</span>' + CHEVRON + '</button>' +
      '<div class="user-pop"><div class="user-card" role="menu">' +
      '<div class="user-head"><b>' + esc(me.username) + '</b><span>Signed in until ' + until + '</span></div>' +
      (me.role === 'admin' ? '<a role="menuitem" href="/admin">Admin console</a>' : '') +
      (me.viaKey ? '' : '<button type="button" role="menuitem" data-act="password">Change password</button>') +
      '<button type="button" role="menuitem" data-act="logout">Log out</button>' +
      (me.viaKey ? '' : '<button type="button" role="menuitem" data-act="delete" class="danger">Delete account</button>') +
      '</div></div></div>';
  }

  function wireUserMenu() {
    var box = document.querySelector('.user'), chip = box.querySelector('.user-chip');
    function setOpen(on) { box.classList.toggle('open', on); chip.setAttribute('aria-expanded', on ? 'true' : 'false'); }
    // hover opens it on a computer; a tap (or Enter) opens it on a phone
    chip.addEventListener('click', function () { setOpen(!box.classList.contains('open')); });
    document.addEventListener('click', function (e) { if (!box.contains(e.target)) setOpen(false); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') { setOpen(false); box.classList.add('shut'); chip.focus(); } });
    box.addEventListener('mouseleave', function () { box.classList.remove('shut'); });
    box.querySelector('.user-card').addEventListener('click', function (e) {
      var b = e.target.closest('[data-act]');
      if (!b) return;
      setOpen(false); box.classList.add('shut');
      ({ password: changePassword, logout: logOut, delete: deleteAccount })[b.getAttribute('data-act')]();
    });
  }

  function logOut() {
    fetch('/api/logout', { method: 'POST', credentials: 'same-origin' }).then(function () { location.replace('/login'); });
  }

  // one small dialog for both account forms; resolves when the server says yes
  function dialog(opts) {
    var d = document.createElement('dialog');
    d.className = 'acct-dlg';
    d.innerHTML = '<form method="dialog" novalidate><h3>' + esc(opts.title) + '</h3>' + (opts.text ? '<p>' + opts.text + '</p>' : '') +
      opts.fields.map(function (f) {
        return '<label>' + esc(f.label) + '<input type="password" name="' + f.name + '" autocomplete="' + f.auto + '" required></label>';
      }).join('') +
      '<p class="acct-err" role="alert"></p><div class="acct-btns"><button type="button" class="acct-cancel">Cancel</button>' +
      '<button type="submit" class="acct-go' + (opts.danger ? ' danger' : '') + '">' + esc(opts.button) + '</button></div></form>';
    document.body.appendChild(d);
    var form = d.querySelector('form'), err = d.querySelector('.acct-err'), go = d.querySelector('.acct-go');
    d.querySelector('.acct-cancel').addEventListener('click', function () { d.close(); });
    d.addEventListener('close', function () { d.remove(); });
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      err.textContent = '';
      var v = {};
      opts.fields.forEach(function (f) { v[f.name] = form[f.name].value; });
      var problem = opts.check(v);
      if (problem) { err.textContent = problem; return; }
      go.disabled = true;
      fetch('/api/account', { method: opts.method, credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify(opts.body(v)) })
        .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { return { ok: r.ok, j: j }; }); })
        .then(function (res) {
          if (!res.ok) throw new Error(res.j.error || 'Something went wrong. Try again.');
          opts.done(d, res.j);
        })
        .catch(function (e2) { err.textContent = e2.message; go.disabled = false; });
    });
    d.showModal();
    form.querySelector('input').focus();
  }

  function changePassword() {
    dialog({
      title: 'Change password', button: 'Change password', method: 'POST',
      fields: [{ name: 'current', label: 'Current password', auto: 'current-password' },
               { name: 'password', label: 'New password', auto: 'new-password' },
               { name: 'again', label: 'New password again', auto: 'new-password' }],
      check: function (v) {
        if (!v.current || !v.password) return 'Fill in every box.';
        if (v.password.length < 6) return 'New passwords need at least 6 characters.';
        if (v.password !== v.again) return "The new passwords don't match.";
      },
      body: function (v) { return { current: v.current, password: v.password }; },
      done: function (d) { d.close(); toast('Password changed.'); }
    });
  }

  function deleteAccount() {
    dialog({
      title: 'Delete your account?', button: 'Delete my account', method: 'DELETE', danger: true,
      text: "This can't be undone. You'll be signed out on every device. Type your password to confirm.",
      fields: [{ name: 'password', label: 'Password', auto: 'current-password' }],
      check: function (v) { if (!v.password) return 'Type your password to confirm.'; },
      body: function (v) { return { password: v.password }; },
      done: function () { location.replace('/login'); }
    });
  }

  function toast(text) {
    var t = document.createElement('div');
    t.className = 'toast'; t.setAttribute('role', 'status'); t.textContent = text;
    document.body.appendChild(t);
    setTimeout(function () { t.classList.add('out'); }, 2200);
    setTimeout(function () { t.remove(); }, 2700);
  }

  // ------------------------------------------------------------------ "Hello, name" just after signing in
  // the greeting fades in, then the name flies up into the corner where it stays
  function hello(me) {
    var flag;
    try { flag = sessionStorage.getItem('jbr-hello'); sessionStorage.removeItem('jbr-hello'); } catch (e) { /* storage blocked */ }
    if (!flag) return;
    var chipName = document.querySelector('.user-name'), chip = document.querySelector('.user-chip');
    var o = document.createElement('div');
    o.className = 'hello';
    o.innerHTML = '<div class="hello-line"><span class="hello-wave" aria-hidden="true">👋</span>' +
      '<span class="hello-word">Hello,</span> <b class="hello-name">' + esc(me.username) + '</b></div>';
    document.body.appendChild(o);
    var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    var line = o.querySelector('.hello-line'), name = o.querySelector('.hello-name');
    var finished = false;
    function finish() {
      if (finished) return;
      finished = true;
      o.remove();
      chipName.style.visibility = '';
      chip.classList.add('pop');
      setTimeout(function () { chip.classList.remove('pop'); }, 700);
    }
    o.addEventListener('click', finish);
    if (reduce || !o.animate) { setTimeout(function () { o.classList.add('fade'); }, 1100); setTimeout(finish, 1500); return; }

    chipName.style.visibility = 'hidden';
    line.animate([{ opacity: 0, transform: 'translateY(14px)' }, { opacity: 1, transform: 'none' }],
      { duration: 520, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'both' });
    o.querySelector('.hello-wave').animate(
      [{ transform: 'rotate(0)' }, { transform: 'rotate(18deg)' }, { transform: 'rotate(-8deg)' }, { transform: 'rotate(16deg)' }, { transform: 'rotate(0)' }],
      { duration: 900, delay: 300, easing: 'ease-in-out' });
    setTimeout(function () {
      if (finished) return;
      // fly the name from the middle of the screen to the chip
      var a = name.getBoundingClientRect(), b = chipName.getBoundingClientRect();
      var k = b.height / a.height;
      var dx = b.left - a.left, dy = (b.top + b.height / 2) - (a.top + a.height / 2);
      [o.querySelector('.hello-wave'), o.querySelector('.hello-word')].forEach(function (el) {
        el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 220, fill: 'forwards' });
      });
      o.animate([{ backgroundColor: getComputedStyle(o).backgroundColor }, { backgroundColor: 'transparent' }],
        { duration: 650, delay: 120, easing: 'ease', fill: 'forwards' });
      name.style.transformOrigin = 'left center';
      name.animate([{ transform: 'none' }, { transform: 'translate(' + dx + 'px,' + dy + 'px) scale(' + k + ')' }],
        { duration: 700, delay: 120, easing: 'cubic-bezier(.65,0,.25,1)', fill: 'forwards' }).onfinish = finish;
    }, 1500);
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
