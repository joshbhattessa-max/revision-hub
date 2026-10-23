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
    var h = (me && me.takedown ? '<div class="maint-bar">The site is taken down: only admins can see it. <a href="/admin#maintenance">Bring it back</a></div>' : '') +
      (me && me.maintenance ? '<div class="maint-bar">Maintenance mode is on: only admins can use the site right now. <a href="/admin#maintenance">Turn it off</a></div>' : '') +
      '<div class="wrap"><header class="top"><div class="brand">' + JBR_LOGO + '<div><h1>' + esc(data.title) + '</h1>' +
      (data.subtitle ? '<p class="subtitle">' + esc(data.subtitle) + '</p>' : '') + '</div></div>' +
      (me ? '<nav class="top-links" aria-label="Your study"><a class="btn-quiet" href="/progress">Your progress</a>' +
        (me.role === 'admin' ? '<a class="btn-quiet admin-link" href="/admin">Admin console</a>' : '') + '</nav>' : '') +
      '<div class="top-actions">' +
      (me ? userMenu(me) : '') + TOGGLE + '</div></header>' + emailNudge(me);

    // a few words that change with what you've been doing (filled in by personal() once your progress is in)
    if (me) h += '<section class="hi" aria-live="polite"><p class="hi-date">' + esc(new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })) + '</p>' +
      '<p class="hi-title">' + esc(timeHello(me)) + '</p><p class="hi-line"></p><div class="hi-chips"></div></section>';
    h += '<h2>' + (me ? 'Your subjects' : 'Subjects') + '</h2><div class="grid">';
    // sites sharing a "pair" (English Language and Literature) share one card that asks which one to open
    var paired = {}, pairs = {}, no = 0;
    (data.sites || []).forEach(function (s) {
      if (s.hidden) return;
      if (s.pair) {
        if (paired[s.pair]) return;
        var halves = data.sites.filter(function (o) { return o.pair === s.pair && !o.hidden; });
        paired[s.pair] = true;
        pairs[s.pair] = halves;
        h += pairCard(s.pair, halves, ++no);
        return;
      }
      h += subjectCard(s, false, ++no);
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
    h += '<footer><p>Past papers and mark schemes are © their exam boards. For personal revision.</p><nav class="site-foot" aria-label="About this site"><a href="/privacy">Privacy Policy</a><a href="/terms">Terms and Conditions</a><a href="#" data-cookie-settings>Cookie settings</a><span class="foot-email">contact@jbrevision.co.uk</span></nav></footer></div>';
    document.getElementById('app').innerHTML = h;
    if (me) { wireUserMenu(); hello(me); wireNudge(); personal(me, data); }
    Array.prototype.forEach.call(document.querySelectorAll('.subject.pair'), function (b) {
      b.addEventListener('click', function () { pickHalf(pairs[b.getAttribute('data-pair')]); });
    });
    var btn = document.querySelector('.theme-toggle');
    btn.addEventListener('click', function () { toggleTheme(btn); });
    syncToggle();
  }

  function subjectCard(s, half, no) {
    var live = !!s.origin;
    var band = s.image ? 'background-image:linear-gradient(rgba(0,0,0,.15),rgba(0,0,0,.35)),url(' + esc(s.image) + ');' : '';
    var stats = s.questions ? fmt(s.questions) + ' questions' + (half ? '' : ' · ' + fmt(s.papers) + ' papers') : '';
    if (!live) stats += (stats ? ' · ' : '') + 'not online yet';
    var href = live ? '/' + esc(s.path) + '/' : '#', color = esc(s.color || '#33312e');
    if (!half) return '<a class="subject sc' + (live ? '' : ' off') + '" href="' + href + '" style="--c:' + color + '" data-subj="' + esc(s.path) + '">' +
      cardInside(no, s.name, s.subject, s.questions ? '<b>' + fmt(s.questions) + '</b> questions · ' + fmt(s.papers) + ' papers' + (live ? '' : ' · not online yet') : esc(stats)) + '</a>';
    // a half card names its subject in the band ("English" over "Language") and the site in the body
    var pre = s.pairName && s.subject.indexOf(s.pairName + ' ') === 0;
    var logo = pre ? '<span class="kicker">' + esc(s.pairName) + '</span>' + esc(s.subject.slice(s.pairName.length + 1)) : esc(s.subject);
    return '<a class="half' + (live ? '' : ' off') + '" href="' + href + '" style="--c:' + color + '">' +
      '<div class="band" style="' + band + '"><span class="logo">' + logo + '</span></div>' +
      '<div class="body"><div class="name">' + esc(s.name) + '</div>' +
      '<div class="stats">' + stats + '</div></div></a>';
  }
  // the inside of a subject card: its number and site name, the subject, its size, and how much of it you've tried
  function cardInside(no, key, name, stats) {
    return '<div class="sc-top"><span class="sc-no">' + (no < 10 ? '0' : '') + no + '</span><span class="sc-key">' + esc(key) + '</span></div>' +
      '<div class="name">' + esc(name) + '</div><div class="stats">' + stats + '</div>' +
      '<div class="sc-prog" hidden><span class="sc-bar"><i></i></span><span class="sc-pct"></span></div>';
  }

  // one card for a pair: named by the shared subject ("English"), coloured by its first site
  function pairCard(pair, halves, no) {
    var first = halves[0], name = first.pairName || pair;
    var qs = halves.reduce(function (n, o) { return n + (o.questions || 0); }, 0);
    return '<button type="button" class="subject sc pair" data-pair="' + esc(pair) + '" data-subj="' + esc(halves.map(function (o) { return o.path; }).join(' ')) + '" aria-haspopup="dialog" style="--c:' + esc(first.color || '#33312e') + '">' +
      cardInside(no, halves.map(function (o) { return o.name; }).join(' · '), name,
        esc(halves.map(function (o) { return o.subject.replace(name + ' ', ''); }).join(' or ')) + (qs ? ' · <b>' + fmt(qs) + '</b> questions' : '')) + '</button>';
  }

  // the popup a pair card opens: the two sites as half cards, pick one to go there
  function pickHalf(halves) {
    var d = document.createElement('dialog');
    d.className = 'acct-dlg pick-dlg';
    d.innerHTML = '<form method="dialog"><h3>Which ' + esc(halves[0].pairName || '') + '?</h3>' +
      '<div class="subject split">' + halves.map(function (o) { return subjectCard(o, true); }).join('') + '</div>' +
      '<div class="acct-btns"><button type="submit">Cancel</button></div></form>';
    document.body.appendChild(d);
    d.addEventListener('close', function () { d.remove(); });
    d.addEventListener('click', function (e) { if (e.target === d) d.close(); });
    d.showModal();
  }

  // JB Revision logo (heavy JBR running past a ring that breaks where the letters cross it); colours come from hub.css
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
      '<a role="menuitem" href="/settings">Settings</a>' +
      (me.role === 'admin' ? '<a role="menuitem" href="/admin">Admin console</a>' : '') +
      '<button type="button" role="menuitem" data-act="logout">Log out</button>' +
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
      ({ logout: logOut })[b.getAttribute('data-act')]();
    });
  }

  // a reminder for accounts made before email addresses were asked for; "Not now" hides it for 30 days
  var LATER = 'jbr-email-later';
  function emailNudge(me) {
    if (!me || !me.email || me.email.verified) return '';
    try { if (Date.now() - Number(localStorage.getItem(LATER) || 0) < 30 * 864e5) return ''; } catch (e) { /* storage blocked */ }
    return '<div class="email-nudge" role="note"><span>Add your email address so you can reset your password if you ever forget it.</span>' +
      '<a class="btn-quiet" href="/verify?next=/">Add email</a><button type="button" class="btn-quiet nudge-later">Not now</button></div>';
  }
  function wireNudge() {
    var b = document.querySelector('.nudge-later');
    if (b) b.addEventListener('click', function () {
      try { localStorage.setItem(LATER, String(Date.now())); } catch (e) { /* storage blocked */ }
      b.parentNode.remove();
    });
  }

  function logOut() {
    fetch('/api/logout', { method: 'POST', credentials: 'same-origin' }).then(function () { location.replace('/login'); });
  }

  // ------------------------------------------------------------------ the greeting above your subjects
  // It reacts to what you've been doing and suggests what to do next: a mock you've just handed in, a subject going
  // well, a streak, a weak or secure topic, or a long gap. Worked out in the browser from your
  // saved progress (progress.js); nothing new is stored.
  var DAY = 864e5;
  function first(me) { var n = String(me.username || ''); return n.charAt(0).toUpperCase() + n.slice(1); }
  function timeHello(me) {
    var n = first(me), hr = new Date().getHours();
    if (hr < 5 || hr >= 22) return 'Working late, ' + n + '.';
    if (hr < 12) return 'Good morning, ' + n + '.';
    if (hr < 18) return 'Good afternoon, ' + n + '.';
    return 'Good evening, ' + n + '.';
  }
  function dayKey(t) { var d = new Date(t); return d.getFullYear() + '-' + d.getMonth() + '-' + d.getDate(); }
  function topicName(meta, s, id) {
    var m = meta && meta.subjects && meta.subjects[s], t = m && (m.topics || []).filter(function (x) { return x[0] === id; })[0];
    return t ? String(t[1]).replace(/^[0-9][^\s]*\s+/, '') : '';
  }
  function subjName(meta, data, s) {
    var m = meta && meta.subjects && meta.subjects[s];
    if (m && m.subject) return m.subject;
    var o = (data.sites || []).filter(function (x) { return x.path === s; })[0];
    return o ? o.subject : s;
  }

  // what to say: the most interesting thing that's true right now
  function sayHello(me, P, meta, data) {
    var S = window.JBR_PROGRESS, now = Date.now(), n = first(me);
    var items = Object.keys(P.items || {}).filter(function (k) { return !S || S.mine(k); }).map(function (k) { return P.items[k]; });
    var mocks = (P.mocks || []).slice().sort(function (a, b) { return b.t - a.t; });
    var out = { title: timeHello(me), line: '', chips: [] };
    if (!items.length && !mocks.length) {
      out.line = 'Choose a subject below and answer a few questions. This space will then suggest what to work on next.';
      return out;
    }
    var week = items.filter(function (v) { return now - v.t < 7 * DAY; }), wg = 0, wm = 0;
    week.forEach(function (v) { wg += v.g || 0; wm += v.m || 0; });
    var days = {}; items.forEach(function (v) { days[dayKey(v.t)] = 1; }); mocks.forEach(function (m) { days[dayKey(m.t)] = 1; });
    var streak = 0, d = now;
    if (!days[dayKey(d)]) d -= DAY;
    while (days[dayKey(d)]) { streak++; d -= DAY; }
    var last = items.reduce(function (a, v) { return !a || v.t > a.t ? v : a; }, null);
    var lastT = Math.max(last ? last.t : 0, mocks.length ? mocks[0].t : 0), away = Math.floor((now - lastT) / DAY);
    // topics over the last fortnight: which one is fighting back, which one you've cracked
    var by = {};
    items.forEach(function (v) {
      if (now - v.t > 14 * DAY) return;
      (v.tp || []).forEach(function (t) { var k = v.s + '|' + t, b = by[k] = by[k] || { s: v.s, t: t, g: 0, m: 0, n: 0 }; b.g += v.g || 0; b.m += v.m || 0; b.n++; });
    });
    var tops = Object.keys(by).map(function (k) { var b = by[k]; b.pct = b.m ? b.g / b.m : 0; b.name = topicName(meta, b.s, b.t); return b; })
      .filter(function (b) { return b.n >= 3 && b.name; });
    var weak = tops.slice().sort(function (a, b) { return a.pct - b.pct; })[0], strong = tops.slice().sort(function (a, b) { return b.pct - a.pct; })[0];
    var mock = mocks[0] && now - mocks[0].t < 3 * DAY ? mocks[0] : null;
    var lines = [];
    // the subject going best this week (at least 5 questions and 70% of marks)
    var subj = {};
    week.forEach(function (v) { var b = subj[v.s] = subj[v.s] || { s: v.s, g: 0, m: 0, n: 0 }; b.g += v.g || 0; b.m += v.m || 0; b.n++; });
    var best = Object.keys(subj).map(function (k) { var b = subj[k]; b.pct = b.m ? b.g / b.m : 0; return b; })
      .filter(function (b) { return b.n >= 5 && b.pct >= .7; }).sort(function (a, b) { return b.pct - a.pct; })[0];

    if (mock) {
      var ms = subjName(meta, data, mock.s), sc = mock.got + '/' + mock.max + ' on ' + ms + (mock.grade ? ' (' + (/^(8|11|18|[AEFHILMNORSX]\b)/.test(String(mock.grade)) ? 'an ' : 'a ') + mock.grade + ')' : '');
      if (mock.pct >= .8) { out.title = 'Strong ' + ms + ' mock, ' + n + '.'; lines.push(sc + '. Check the few marks you dropped, then move on to a topic you know less well.'); }
      else if (mock.pct >= .6) { out.title = 'Good ' + ms + ' mock, ' + n + '.'; lines.push(sc + '. The quickest gains are in the questions you only half got.'); }
      else { out.title = ms + ' needs another look, ' + n + '.'; lines.push(mock.got + '/' + mock.max + ' on your last mock. Go through the questions you missed before trying another.'); }
    } else if (away >= 7) {
      out.title = 'Welcome back, ' + n + '.';
      lines.push('It has been ' + away + ' days.' + (last ? ' A short set of ' + subjName(meta, data, last.s) + ' questions is a good way back in.' : ''));
    } else if (best) {
      out.title = subjName(meta, data, best.s) + ' going well, ' + n + '.';
      lines.push(Math.round(best.pct * 100) + '% of marks across ' + best.n + ' questions this week.');
    } else if (streak >= 3) {
      out.title = streak + ' days in a row, ' + n + '.';
      lines.push('Steady practice like this is what moves grades.');
    }
    if (weak && weak.pct < .5 && lines.length < 2) lines.push('Suggested next: ' + weak.name + ' in ' + subjName(meta, data, weak.s) + ', at ' + Math.round(weak.pct * 100) + '% recently.');
    else if (strong && strong.pct >= .85 && lines.length < 2) lines.push(strong.name + ' looks secure at ' + Math.round(strong.pct * 100) + '%, so a less familiar topic is the better use of time.');
    if (!lines.length && last) {
      var tn = topicName(meta, last.s, (last.tp || [])[0]);
      lines.push('Last session: ' + (tn ? tn + ' in ' : '') + subjName(meta, data, last.s) + '. Carry on there, or choose a new topic below.');
    }
    out.line = lines.slice(0, 2).join(' ');
    if (week.length) out.chips.push(['' + week.length, week.length === 1 ? 'question this week' : 'questions this week']);
    if (wm) out.chips.push([Math.round(wg / wm * 100) + '%', 'of marks this week']);
    if (mocks.length) out.chips.push(['' + mocks.length, mocks.length === 1 ? 'mock' : 'mocks']);
    if (streak) out.chips.push(['' + streak, streak === 1 ? 'day in a row' : 'days in a row']);
    return out;
  }

  // fills the greeting and the cards' progress bars, first from this browser's copy, then again once your account's
  // copy has synced
  function personal(me, data) {
    var S = window.JBR_PROGRESS, meta = null;
    if (!S) return;
    function fill() {
      var P = S.get(), box = document.querySelector('.hi');
      if (!box) return;
      var say = sayHello(me, P, meta, data);
      box.querySelector('.hi-title').textContent = say.title;
      box.querySelector('.hi-line').textContent = say.line;
      box.querySelector('.hi-chips').innerHTML = say.chips.map(function (c) { return '<span class="hi-chip"><b>' + esc(c[0]) + '</b> ' + esc(c[1]) + '</span>'; }).join('');
      // each card: the share of its topics you've tried at least once
      Array.prototype.forEach.call(document.querySelectorAll('.sc[data-subj]'), function (card) {
        var subs = card.getAttribute('data-subj').split(' '), all = 0, seen = {};
        subs.forEach(function (s) { var m = meta && meta.subjects && meta.subjects[s]; all += m && m.topics ? m.topics.length : 0; });
        Object.keys(P.items || {}).forEach(function (k) {
          var v = P.items[k];
          if (subs.indexOf(v.s) < 0 || !S.mine(k)) return;
          (v.tp || []).forEach(function (t) { seen[v.s + '|' + t] = 1; });
        });
        var done = Object.keys(seen).length, bar = card.querySelector('.sc-prog');
        if (!all || !bar) return;
        var pct = Math.min(100, Math.round(done / all * 100));
        bar.hidden = false;
        bar.querySelector('i').style.width = pct + '%';
        bar.querySelector('.sc-pct').textContent = pct + '%';
        bar.title = done + ' of ' + all + ' topics tried';
      });
    }
    fetch('/study-meta.json', { credentials: 'same-origin' }).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; })
      .then(function (m) { meta = m; fill(); S.pull(fill); });
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
      // (on a small phone only your initial shows in the corner, so the name flies to that)
      var a = name.getBoundingClientRect(), b = (chipName.offsetWidth ? chipName : chip.querySelector('.user-av')).getBoundingClientRect();
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
