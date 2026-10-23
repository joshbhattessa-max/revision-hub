/* Admin console: edit the home page, see who is signed in, manage accounts. Talks to /api/admin/*. */
(function () {
  'use strict';
  var notice = document.querySelector('.notice');
  // the status line under the tabs: the result of the last thing you did. It's scrolled into view when it changes, so a
  // result is never missed at the bottom of a long list
  function say(msg, bad) {
    notice.innerHTML = '<samp>' + (msg ? '[' + iso(Date.now()) + '] ' + (bad ? '<b>ERR</b> ' : 'OK  ') + esc(msg) : 'status: ready') + '</samp>';
    notice.className = 'notice' + (bad ? ' err' : '');
    if (msg && notice.getBoundingClientRect().top < 0) notice.scrollIntoView({ block: 'start' });
  }
  // timestamps are ISO 8601 in UTC everywhere in the console
  function iso(t) { return t ? new Date(t).toISOString().replace(/\.\d{3}Z$/, 'Z') : '-'; }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function api(method, path, body, raw) {
    var opt = { method: method, credentials: 'same-origin', headers: {} };
    if (raw) { opt.body = raw; opt.headers['content-type'] = raw.type; }
    else if (body !== undefined) { opt.body = JSON.stringify(body); opt.headers['content-type'] = 'application/json'; }
    var t0 = performance.now(), rid = Math.random().toString(16).slice(2, 10);
    opt.headers['x-request-id'] = rid;
    return fetch('/api/admin/' + path, opt).then(function (r) {
      logReq(method, path, r.status, t0, r.headers.get('cf-ray') || rid, r.headers.get('content-length'));
      if (r.status === 401) { location.replace('/login?next=/admin'); throw new Error('401 Unauthorized: session expired'); }
      return r.json().then(function (d) { if (!r.ok) throw new Error('HTTP ' + r.status + ' ' + (d.error || 'internal error') + ' (req ' + (r.headers.get('cf-ray') || rid) + ')'); return d; });
    }, function (e) { logReq(method, path, 'ERR', t0, rid); throw new Error('network: ' + e.message + ' (req ' + rid + ')'); });
  }
  // every call this tab makes, newest first, in the footer
  var reqlog = document.getElementById('reqlog'), reqs = [];
  function logReq(method, path, status, t0, rid, bytes) {
    reqs.unshift(iso(Date.now()) + '  ' + (method + '      ').slice(0, 7) + String(status) + '  ' + ('     ' + Math.round(performance.now() - t0)).slice(-5) + 'ms  ' +
      ('       ' + (bytes || '-')).slice(-7) + 'B  ray=' + rid + '  /api/admin/' + path);
    reqs.length = Math.min(reqs.length, 200);
    reqlog.textContent = reqs.join('\n');
  }
  // small question box instead of the browser's prompt()
  var dlg = document.querySelector('.ask');
  function ask(question, value, type, okText, hint) {
    return new Promise(function (resolve) {
      dlg.querySelector('.ask-q').textContent = question;
      dlg.querySelector('.ask-ok').textContent = okText || 'ok';
      dlg.querySelector('.ask-hint').textContent = hint || '';
      var inp = dlg.querySelector('.ask-in');
      inp.type = type || 'text'; inp.value = value || '';
      dlg.onclose = function () { resolve(dlg.returnValue === 'ok' ? inp.value : null); };
      dlg.returnValue = ''; dlg.showModal(); inp.focus();
    });
  }
  // the message box for Accounts → Send message: a title, the JBR logo or not, and the message with simple formatting
  var mdlg = document.querySelector('.msgdlg'), med = mdlg.querySelector('.msg-ed');
  Array.prototype.forEach.call(mdlg.querySelectorAll('.msg-tools button'), function (b) {
    b.addEventListener('mousedown', function (e) { e.preventDefault(); });  // keep the selection in the message
    b.addEventListener('click', function () {
      var cmd = b.getAttribute('data-cmd'), arg = b.getAttribute('data-arg');
      if (cmd === 'createLink') { arg = prompt('Link address (https://…):', 'https://'); if (!arg || arg === 'https://') return; }
      med.focus();
      document.execCommand(cmd, false, arg ? (cmd === 'formatBlock' ? '<' + arg + '>' : arg) : null);
    });
  });
  var mcolor = mdlg.querySelector('.msg-color input'), msel = null;
  med.addEventListener('blur', function () { var s = getSelection(); msel = s.rangeCount ? s.getRangeAt(0) : null; });
  mcolor.addEventListener('input', function () {
    med.focus();
    if (msel) { var s = getSelection(); s.removeAllRanges(); s.addRange(msel); }
    document.execCommand('foreColor', false, mcolor.value);
  });
  mdlg.querySelector('.msg-title').addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); med.focus(); } });
  function writeMessage(question, n) {
    return new Promise(function (resolve) {
      mdlg.querySelector('.ask-q').textContent = question;
      mdlg.querySelector('.msg-title').value = (n && n.title) || '';
      mdlg.querySelector('.msg-logo input').checked = !!(n && n.logo);
      med.innerHTML = (n && (n.html || esc(n.text || '').replace(/\n/g, '<br>'))) || '<p><br></p>';  // never empty, or it has no height to click
      mdlg.onclose = function () {
        resolve(mdlg.returnValue === 'ok' ? { title: mdlg.querySelector('.msg-title').value.trim(), logo: mdlg.querySelector('.msg-logo input').checked, html: med.innerHTML } : null);
      };
      mdlg.returnValue = ''; mdlg.showModal(); med.focus();
    });
  }
  function when(t) { return iso(t); }
  function left(t) {
    var s = Math.max(0, Math.round((t - Date.now()) / 1000));
    return 'ttl=' + s + 's';
  }
  function device(ua) {
    ua = ua || '';
    var b = /Edg\//.test(ua) ? 'Edge' : /OPR\//.test(ua) ? 'Opera' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : 'Browser';
    var o = /iPhone/.test(ua) ? 'iPhone' : /iPad/.test(ua) ? 'iPad' : /Android/.test(ua) ? 'Android' : /Mac OS X/.test(ua) ? 'Mac' : /Windows/.test(ua) ? 'Windows' : /CrOS/.test(ua) ? 'Chromebook' : /Linux/.test(ua) ? 'Linux' : '';
    return b.toLowerCase() + '/' + (o || 'unknown').toLowerCase();
  }

  // ------------------------------------------------------------------ build and runtime details (header and footer)
  var sysSkew = 0;
  api('GET', 'sys').then(function (x) {
    sysSkew = x.now - Date.now();
    document.getElementById('sys-build').textContent = x.commit ? x.commit.slice(0, 12) : 'local';
    document.getElementById('sys-branch').textContent = x.branch || '-';
    document.getElementById('sys-colo').textContent = [x.colo, x.http, x.tls].filter(Boolean).join('/') || '-';
    document.getElementById('sys-op').textContent = x.operator;
    document.getElementById('sys-bind').textContent = 'bindings: ' + Object.keys(x.bindings).map(function (k) { return k + '=' + (x.bindings[k] ? 'ok' : 'unset'); }).join(' ');
  }).catch(function () {});
  (function tick() { document.getElementById('sys-utc').textContent = iso(Date.now() + sysSkew); setTimeout(tick, 1000); })();

  // ------------------------------------------------------------------ tabs
  var tabs = document.querySelectorAll('.tabs button');
  Array.prototype.forEach.call(tabs, function (b) {
    b.addEventListener('click', function () { show(b.getAttribute('data-tab')); });
  });
  var TABS = ['accounts', 'activity', 'sessions', 'content', 'updates', 'maintenance', 'usage'], current = null;
  // unsaved edits on hub.json or the update list: ask before leaving them
  function unsaved() { return current === 'content' ? dirty : current === 'updates' ? upDirty : false; }
  function show(name) {
    if (name !== current && unsaved() && !confirm('You have changes on this tab that are not saved yet. Leave without saving?')) return;
    if (name === 'content' && current !== 'content') loadContent();
    current = name;
    if (location.hash.slice(1) !== name) history.replaceState(null, '', '#' + name);
    Array.prototype.forEach.call(tabs, function (b) {
      var on = b.getAttribute('data-tab') === name;
      b.disabled = on; b.setAttribute('aria-selected', on);
      b.textContent = b.textContent.replace(/^[> ]+/, '').replace(/ <$/, '');
      if (on) b.textContent = '> ' + b.textContent + ' <';
    });
    TABS.forEach(function (n) { document.getElementById('tab-' + n).hidden = n !== name; });
    say('');
    if (name === 'sessions') loadSessions();
    if (name === 'activity') loadActivity(); else stopActivity();
    if (name === 'accounts') loadAccounts();
    if (name === 'updates') loadUpdates();
    if (name === 'maintenance') loadMaintenance();
    if (name === 'usage') loadUsage();
  }

  // keys 1-7 switch tab, unless you're typing in a box
  document.addEventListener('keydown', function (e) {
    var t = e.target, typing = t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName);
    if (typing || e.ctrlKey || e.metaKey || e.altKey || document.querySelector('dialog[open]')) return;
    var n = +e.key; if (n >= 1 && n <= TABS.length) show(TABS[n - 1]);
  });

  // on a phone each table row becomes a card, with the column name before each value
  function labelTables() {
    Array.prototype.forEach.call(document.querySelectorAll('.admin table:not([data-labelled])'), function (t) {
      var heads = Array.prototype.map.call(t.querySelectorAll('thead th'), function (th) { return th.textContent; });
      Array.prototype.forEach.call(t.querySelectorAll('tbody tr'), function (tr) {
        Array.prototype.forEach.call(tr.children, function (td, i) { if (heads[i]) td.setAttribute('data-label', heads[i]); });
      });
      t.setAttribute('data-labelled', '');
    });
  }
  new MutationObserver(labelTables).observe(document.querySelector('.admin'), { childList: true, subtree: true });

  // ------------------------------------------------------------------ activity
  // what each account opens and when (activity.js on every signed-in page -> /api/activity, kept in the ACTIVITY_DB
  // database); the list refreshes itself every 30 seconds while this tab is open
  var actbox = document.getElementById('tab-activity'), adays = 7, aopen = null, atimer = null, asites = {};
  function ago(t) {
    var s = Math.round((Date.now() - t) / 1000);
    if (s < 86400) return 't-' + s + 's';
    return when(t);
  }
  function hhmm(t) { return new Date(t).toISOString().slice(11, 19) + 'Z'; }
  function subjectName(k) { return asites[k] || { chemq: 'Chemistry' }[k] || k || ''; }
  // "ChemQ: GCSE Chemistry - AQA June 2023 - Paper 1 - 01.2" on /chemistry/ -> "Chemistry · GCSE Chemistry - AQA ..."
  function pageLabel(x) {
    var t = String(x.title || '').trim();
    if (!x.site && /^JB Revision( · .*)?$/.test(t)) t = 'Home page';
    t = t.replace(/ · JB Revision$/, '').replace(/^[A-Za-z]{2,12}Q\s*[:\-]\s*/, '').trim() || x.page || '';
    return x.site ? subjectName(x.site) + ' · ' + t : t;
  }
  function stopActivity() { clearInterval(atimer); atimer = null; }
  function loadActivity() {
    if (!actbox.querySelector('.act-list')) actbox.innerHTML = '<div class="act-list"><p class="muted">GET /api/admin/activity …</p></div><div class="act-detail"></div>';
    drawActivity();
    stopActivity();
    atimer = setInterval(function () { if (!document.hidden) drawActivity(); }, 30000);
  }
  function drawActivity() {
    var list = actbox.querySelector('.act-list');
    api('GET', 'activity').then(function (a) {
      if (!a.setup) {
        stopActivity();
        list.innerHTML = '<h2>E_NO_BINDING: ACTIVITY_DB</h2><p>It\'s kept in a free Cloudflare D1 database. Once:</p><ol>' +
          '<li>In the Cloudflare dashboard go to <i>Storage &amp; Databases</i> → <i>D1 SQL database</i> → <i>Create</i>, and name it <code>hub-activity</code>.</li>' +
          '<li>In the hub\'s Pages project go to <i>Settings</i> → <i>Bindings</i> → <i>Add</i> → <i>D1 database</i>. Name it <code>ACTIVITY_DB</code> and pick <code>hub-activity</code>.</li>' +
          '<li>Go to <i>Deployments</i> and press <i>Retry deployment</i> on the latest one.</li></ol><p class="muted">The tables are made by themselves the first time someone opens a page.</p>';
        return;
      }
      asites = a.sites || {};
      var people = a.people, on = people.filter(function (p) { return p.t && Date.now() - p.t < 3 * 60000; }).length;
      list.innerHTML = '<h2>activity_log [' + people.length + ']</h2><p class="muted">rows=' + people.length + ' active_3m=' + on + ' retention=' + a.keepDays + 'd poll=30s source=D1:ACTIVITY_DB</p>' +
        '<p>LIVE = on the site in the last 3 minutes. Press <i>trace</i> for one person\'s papers, mocks and every page they opened. <button type="button" class="act-refresh">refresh</button></p>' +
        '<div class="tablewrap"><table border="1" cellpadding="3"><thead><tr><th>account_id</th><th>username</th><th>last_page</th><th>last_seen</th><th class="num">hits_24h</th><th>ua</th><th></th></tr></thead><tbody>' +
        people.map(function (p) {
          var live = p.t && Date.now() - p.t < 3 * 60000;
          return '<tr' + (aopen === p.account ? ' class="act-sel"' : '') + '><td><code>' + esc(p.account) + '</code></td><td>' + esc(p.username) +
            (p.role === 'admin' ? ' <span class="muted">[admin]</span>' : p.role === 'key' ? ' <span class="muted">[key]</span>' : p.role === 'gone' ? ' <span class="muted">[deleted]</span>' : '') + '</td>' +
            '<td>' + (p.t ? '<a href="' + esc(p.page) + '" target="_blank" rel="noopener">' + esc(pageLabel(p)) + '</a>' +
              (live && p.since ? '<br><span class="muted">dwell=' + Math.max(1, Math.round((Date.now() - p.since) / 1000)) + 's</span>' : '') : '<span class="muted">null</span>') + '</td>' +
            '<td>' + (p.t ? (live ? '<span class="act-live">LIVE</span> ' : '') + esc(iso(p.t)) : '<span class="muted">null</span>') + '</td>' +
            '<td class="num">' + (p.today || 0) + '</td><td>' + (p.device ? '<span title="' + esc(p.device) + '">' + esc(device(p.device)) + '</span>' : '') + '</td>' +
            '<td>' + (p.t ? '<button type="button" class="act-open" data-id="' + esc(p.account) + '" data-name="' + esc(p.username) + '">trace</button>' : '') + '</td></tr>';
        }).join('') + '</tbody></table></div>';
      list.querySelector('.act-refresh').addEventListener('click', drawActivity);
      Array.prototype.forEach.call(list.querySelectorAll('.act-open'), function (b) {
        b.addEventListener('click', function () { openPerson(b.getAttribute('data-id'), b.getAttribute('data-name'), true); });
      });
    }).catch(function (e) { say(e.message, true); });
  }
  function openPerson(id, name, scroll) {
    aopen = id;
    Array.prototype.forEach.call(actbox.querySelectorAll('.act-open'), function (b) { b.closest('tr').classList.toggle('act-sel', b.getAttribute('data-id') === id); });
    var box = actbox.querySelector('.act-detail');
    box.innerHTML = '<p class="muted">GET /api/admin/activity/' + esc(id) + ' …</p>';
    api('GET', 'activity/' + encodeURIComponent(id) + '?days=' + adays).then(function (a) {
      var head = '<div class="row act-head"><h2 class="grow">trace: ' + esc(name) + ' <code class="muted">' + esc(id) + '</code></h2><label class="muted">window <select class="act-days">' +
        [1, 7, 30, 90].map(function (n) { return '<option value="' + n + '"' + (n === adays ? ' selected' : '') + '>' + n + 'd</option>'; }).join('') +
        '</select></label><button type="button" class="act-close">close trace</button></div>';
      var papers = '<h3>papers [' + a.papers.length + ']</h3>' + (a.papers.length ? '<div class="tablewrap"><table border="1" cellpadding="3"><thead><tr><th>paper</th><th>site</th><th class="num">q_opened</th><th>first_seen</th><th>last_seen</th></tr></thead><tbody>' +
        a.papers.map(function (p) { return '<tr><td>' + esc(p.paper) + '</td><td>' + esc(p.site) + '</td><td class="num">' + p.questions + '</td><td>' + esc(when(p.first)) + '</td><td>' + esc(when(p.last)) + '</td></tr>'; }).join('') +
        '</tbody></table></div>' : '<p class="muted">0 rows</p>');
      var mocks = '<h3>mocks_submitted [' + a.mocks.length + ']</h3>' + (a.mocks.length ? '<div class="tablewrap"><table border="1" cellpadding="3"><thead><tr><th>ts</th><th>site</th><th>board</th><th class="num">score</th><th class="num">pct</th><th>grade</th><th class="num">t_used</th></tr></thead><tbody>' +
        a.mocks.map(function (m) { return '<tr><td>' + esc(when(m.t)) + '</td><td>' + esc(m.s) + '</td><td>' + esc(m.board) + '</td><td class="num">' + esc(m.got) + '/' + esc(m.max) + '</td><td class="num">' + (m.pct != null ? esc(m.pct) : '-') + '</td><td>' + esc(m.grade || '-') + '</td><td class="num">' + (m.used != null ? esc(m.used) + (m.minutes ? '/' + esc(m.minutes) : '') + 'min' : '-') + '</td></tr>'; }).join('') +
        '</tbody></table></div>' : '<p class="muted">0 rows</p>');
      var subs = Object.keys(a.marked);
      var marked = '<h3>marked_total</h3>' + (subs.length ? '<p class="mono">' + subs.map(function (s) { return esc(s) + '=' + a.marked[s].n + (a.marked[s].last ? ' (last ' + esc(iso(a.marked[s].last)) + ')' : ''); }).join('<br>') + '</p>' : '<p class="muted">0 rows</p>');
      // the timeline, a day at a time, newest first
      var byDay = [], cur = null;
      a.events.forEach(function (e) {
        var d = new Date(e.t).toDateString();
        if (!cur || cur.d !== d) byDay.push(cur = { d: d, t: e.t, list: [] });
        cur.list.push(e);
      });
      var timeline = '<h3>events [' + a.events.length + ']</h3>' + (byDay.length ? byDay.map(function (g) {
        return '<h4>' + esc(new Date(g.t).toISOString().slice(0, 10)) + ' <span class="muted">n=' + g.list.length + '</span></h4>' +
          '<ol class="act-tl">' + g.list.map(function (e) { return '<li><time>' + esc(hhmm(e.t)) + '</time><a href="' + esc(e.page) + '" target="_blank" rel="noopener">' + esc(e.page) + '</a> <span class="muted">' + esc(pageLabel(e)) + '</span></li>'; }).join('') + '</ol>';
      }).join('') + (a.events.length >= 1000 ? '<p class="muted">truncated: limit=1000</p>' : '') : '<p class="muted">0 rows</p>');
      box.innerHTML = head + papers + mocks + marked + timeline;
      box.querySelector('.act-days').addEventListener('change', function (e) { adays = +e.target.value; openPerson(id, name); });
      box.querySelector('.act-close').addEventListener('click', function () { aopen = null; box.innerHTML = ''; drawActivity(); });
      if (scroll) box.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }).catch(function (e) { box.innerHTML = ''; say(e.message, true); });
  }

  // ------------------------------------------------------------------ usage statistics
  // only visitors who pressed "Accept all" in the cookie popup are counted, under a random number, never an account
  var ubox = document.getElementById('tab-usage'), udays = 30;
  function pageName(p) {
    var parts = p.split(':'), subj = { chemistry: 'Chemistry', biology: 'Biology', physics: 'Physics', maths: 'Maths', geography: 'Geography', 'computer-science': 'Computer Science', spanish: 'Spanish', 'english-language': 'English Language', 'english-literature': 'English Literature', history: 'History', 'religious-studies': 'Religion and Philosophy', pe: 'Sports Science (PE)', 'design-technology': 'Design and Technology', french: 'French' };
    var hub = { home: 'Home page', planner: 'Revision planner', progress: 'Your progress', admin: 'Admin console', privacy: 'Privacy Policy', terms: 'Terms and Conditions', login: 'Sign in' };
    var route = { home: 'question list', questions: 'question list', question: 'a question', topics: 'My topics', mock: 'mock paper', review: 'Review', practise: 'practising a topic', about: 'About' };
    return parts.length > 1 ? (subj[parts[0]] || parts[0]) + ' · ' + (route[parts[1]] || parts[1]) : (hub[p] || p);
  }
  function loadUsage() {
    ubox.innerHTML = '<p class="muted">GET /api/admin/usage?days=' + udays + ' …</p>';
    api('GET', 'usage?days=' + udays).then(function (u) {
      var days = Object.keys(u.byDay).sort().reverse(), views = days.reduce(function (a, d) { return a + u.byDay[d].views; }, 0);
      var maxV = Math.max.apply(null, days.map(function (d) { return u.byDay[d].views; }).concat([1]));
      var devTotal = u.devices.phone + u.devices.tablet + u.devices.computer || 1;
      var pct = function (n) { return Math.round(n / devTotal * 100) + '%'; };
      var pages = Object.keys(u.pages).sort(function (a, b) { return u.pages[b] - u.pages[a]; }).slice(0, 25);
      ubox.innerHTML = '<h2>telemetry</h2><p>Visitor numbers. Only people who pressed "Accept all" on the cookie popup are counted, and never linked to an account.</p>' +
        '<div class="row"><span class="muted grow">scope=consented_visitors (anonymous, not joined to accounts) retention=90d</span> ' +
        '<label class="muted">window <select class="udays">' + [7, 30, 90].map(function (n) { return '<option value="' + n + '"' + (n === udays ? ' selected' : '') + '>' + n + 'd</option>'; }).join('') + '</select></label></div>' +
        '<div class="u-tiles"><div><b>' + u.visitors + '</b>uniq_visitors</div><div><b>' + views + '</b>pageviews</div>' +
        '<div><b>' + u.devices.phone + '</b>ua.phone (' + pct(u.devices.phone) + ')</div><div><b>' + u.devices.tablet + '</b>ua.tablet (' + pct(u.devices.tablet) + ')</div><div><b>' + u.devices.computer + '</b>ua.desktop (' + pct(u.devices.computer) + ')</div></div>' +
        '<h2>by_day [' + days.length + ']</h2>' + (days.length ? '<div class="tablewrap"><table border="1" cellpadding="3"><thead><tr><th>date</th><th class="num">uniq</th><th>pageviews</th></tr></thead><tbody>' +
          days.map(function (d) { var x = u.byDay[d]; return '<tr><td>' + esc(d) + '</td><td class="num">' + x.visitors + '</td><td><progress max="100" value="' + Math.round(x.views / maxV * 100) + '"></progress> ' + x.views + '</td></tr>'; }).join('') +
          '</tbody></table></div>' : '<p class="muted">0 rows</p>') +
        '<h2>top_routes [' + pages.length + ']</h2>' + (pages.length ? '<div class="tablewrap"><table border="1" cellpadding="3"><thead><tr><th>route_key</th><th>resolved</th><th class="num">hits</th></tr></thead><tbody>' +
          pages.map(function (p) { return '<tr><td><code>' + esc(p) + '</code></td><td>' + esc(pageName(p)) + '</td><td class="num">' + u.pages[p] + '</td></tr>'; }).join('') + '</tbody></table></div>' : '<p class="muted">0 rows</p>') +
        '<h2>consent</h2><p class="mono">stats=' + u.consent.stats + ' essential_only=' + u.consent.essential +
        ' <span class="muted">(unanswered excluded)</span></p>';
      ubox.querySelector('.udays').addEventListener('change', function (e) { udays = +e.target.value; loadUsage(); });
    }).catch(function (e) { ubox.innerHTML = ''; say(e.message, true); });
  }

  // ------------------------------------------------------------------ content
  var content = null, dirty = false, sitesOpen = false;
  var box = document.getElementById('tab-content');
  function markDirty() {
    dirty = true;
    Array.prototype.forEach.call(box.querySelectorAll('.save, .undo'), function (b) { b.disabled = false; });
    Array.prototype.forEach.call(box.querySelectorAll('.savebar .state'), function (st) { st.textContent = 'state=dirty (not live yet) kv_key=hub'; });
  }
  window.addEventListener('beforeunload', function (e) { if (dirty || upDirty) { e.preventDefault(); e.returnValue = ''; } });

  function loadContent() {
    api('GET', 'hub').then(function (c) { content = c; dirty = false; drawContent(); }).catch(function (e) { say(e.message, true); });
  }
  function imageField(value, onSet) {
    var wrap = document.createElement('p');
    wrap.innerHTML = (value ? '<img class="thumb" width="64" height="40" alt="" src="' + esc(value) + '"> ' : '') +
      '<label>picture url <input type="url" size="36" placeholder="https://" value="' + esc(value) + '"></label> ' +
      '<label>or upload <input type="file" accept="image/*"></label>';
    wrap.querySelector('input[type=url]').addEventListener('input', function (e) { onSet(e.target.value.trim()); markDirty(); });
    wrap.querySelector('input[type=file]').addEventListener('change', function (e) {
      var f = e.target.files[0]; if (!f) return;
      say('POST /api/admin/media ' + f.name + ' (' + f.size + ' B, ' + f.type + ') …');
      api('POST', 'media', undefined, f).then(function (d) { onSet(d.url); markDirty(); drawContent(); say('201 stored ' + d.url + '; not live yet, press commit.'); })
        .catch(function (err) { say(err.message, true); });
    });
    return wrap;
  }
  function drawContent() {
    var c = content;
    box.innerHTML = '<h2>hub.json (home page)</h2><p>Edit below, then press <b>commit</b> to put it live. ' +
      'Until then nothing on the site changes, and <i>revert</i> throws your edits away.</p>';
    // the save buttons, at the top and again at the bottom so they're never a long scroll away
    function saveBar() {
      var bar = document.createElement('p'); bar.className = 'savebar';
      bar.innerHTML = '<button type="button" class="save"' + (dirty ? '' : ' disabled') + '>PUT /api/admin/hub: commit (go live)</button> ' +
        '<button type="button" class="undo"' + (dirty ? '' : ' disabled') + '>revert: throw away edits</button> ' +
        '<samp class="state">state=' + (dirty ? 'dirty (not live yet)' : 'clean') + ' kv_key=hub</samp>';
      bar.querySelector('.save').addEventListener('click', save);
      bar.querySelector('.undo').addEventListener('click', function () { if (confirm('Throw away your edits on this tab?')) loadContent(); });
      return bar;
    }
    box.appendChild(saveBar());

    var top = document.createElement('fieldset');
    top.innerHTML = '<legend>title</legend><label>page title <input type="text" class="title" size="40" value="' + esc(c.title) + '"></label>';
    top.querySelector('.title').addEventListener('input', function (e) { c.title = e.target.value; markDirty(); });
    box.appendChild(top);

    var sites = document.createElement('details');
    sites.innerHTML = '<summary>sites[' + (c.sites || []).length + ']: subject cards (name, colour, picture, hide)</summary>';
    sites.open = sitesOpen;
    sites.addEventListener('toggle', function () { sitesOpen = sites.open; });
    (c.sites || []).forEach(function (s) {
      var row = document.createElement('fieldset');
      row.innerHTML = '<legend><code>' + esc(s.path) + '</code> ' + esc(s.subject) + (s.hidden ? ' [hidden]' : '') + '</legend>' +
        '<label><input type="checkbox" class="hid"' + (s.hidden ? ' checked' : '') + '> hidden (not shown on the home page)</label><br>' +
        '<label>subject <input type="text" class="subj" value="' + esc(s.subject) + '"></label> ' +
        '<label>name <input type="text" class="nm" value="' + esc(s.name) + '"></label> ' +
        '<label>color <input type="text" class="col" size="9" value="' + esc(s.color) + '" placeholder="#17A398"></label>';
      row.querySelector('.hid').addEventListener('change', function (e) { s.hidden = e.target.checked; markDirty(); });
      row.querySelector('.subj').addEventListener('input', function (e) { s.subject = e.target.value; markDirty(); });
      row.querySelector('.nm').addEventListener('input', function (e) { s.name = e.target.value; markDirty(); });
      row.querySelector('.col').addEventListener('input', function (e) { s.color = e.target.value.trim(); markDirty(); });
      row.appendChild(imageField(s.image, function (v) { s.image = v; }));
      sites.appendChild(row);
    });
    box.appendChild(sites);

    var h = document.createElement('h3'); h.textContent = 'sections[' + (c.sections || []).length + ']: your own links, in groups'; box.appendChild(h);
    (c.sections || []).forEach(function (sec, si) {
      var fs = document.createElement('fieldset');
      fs.innerHTML = '<legend><code>sections[' + si + ']</code> ' + esc(sec.title) + '</legend>' +
        '<p><label>section title <input type="text" class="sec-title" size="30" value="' + esc(sec.title) + '"></label> ' +
        '<button type="button" class="up"' + (si ? '' : ' disabled') + '>↑ move up</button> <button type="button" class="down"' + (si < c.sections.length - 1 ? '' : ' disabled') + '>↓ move down</button> ' +
        '<button type="button" class="del">rm: remove section</button></p>';
      fs.querySelector('.sec-title').addEventListener('input', function (e) { sec.title = e.target.value; markDirty(); });
      fs.querySelector('.up').addEventListener('click', function () { move(c.sections, si, -1); });
      fs.querySelector('.down').addEventListener('click', function () { move(c.sections, si, 1); });
      fs.querySelector('.del').addEventListener('click', function () {
        if (confirm('Remove section "' + sec.title + '" and its ' + (sec.cards || []).length + ' link(s)? (Not live until you commit.)')) { c.sections.splice(si, 1); markDirty(); drawContent(); }
      });
      sec.cards = sec.cards || [];
      sec.cards.forEach(function (card, ci) {
        var row = document.createElement('fieldset');
        row.innerHTML = '<legend><code>cards[' + ci + ']</code> ' + esc(card.title || '(untitled)') + '</legend>' +
          '<label>title <input type="text" class="t" value="' + esc(card.title) + '"></label> ' +
          '<label>url <input type="url" class="u" size="36" value="' + esc(card.url) + '" placeholder="https://"></label>' +
          '<div class="img"></div><p><button type="button" class="up"' + (ci ? '' : ' disabled') + '>↑</button> <button type="button" class="down"' + (ci < sec.cards.length - 1 ? '' : ' disabled') + '>↓</button> ' +
          '<button type="button" class="del">rm: remove link</button></p>';
        row.querySelector('.t').addEventListener('input', function (e) { card.title = e.target.value; markDirty(); });
        row.querySelector('.u').addEventListener('input', function (e) { card.url = e.target.value.trim(); markDirty(); });
        row.querySelector('.img').appendChild(imageField(card.image, function (v) { card.image = v; }));
        row.querySelector('.up').addEventListener('click', function () { move(sec.cards, ci, -1); });
        row.querySelector('.down').addEventListener('click', function () { move(sec.cards, ci, 1); });
        row.querySelector('.del').addEventListener('click', function () {
          if (!card.title && !card.url || confirm('Remove link "' + (card.title || card.url) + '"? (Not live until you commit.)')) { sec.cards.splice(ci, 1); markDirty(); drawContent(); }
        });
        fs.appendChild(row);
      });
      var add = document.createElement('button'); add.type = 'button'; add.textContent = 'cards.push(): add a link to this section';
      add.addEventListener('click', function () { sec.cards.push({ title: '', url: '' }); markDirty(); drawContent(); });
      fs.appendChild(add);
      box.appendChild(fs);
    });
    var addSec = document.createElement('p');
    addSec.innerHTML = '<button type="button">sections.push(): add a section</button>';
    addSec.firstChild.addEventListener('click', function () { c.sections.push({ title: 'New section', cards: [] }); markDirty(); drawContent(); });
    box.appendChild(addSec);

    box.appendChild(document.createElement('hr'));
    box.appendChild(saveBar());
    var reset = document.createElement('details');
    reset.innerHTML = '<summary>advanced: restore the built-in hub.json</summary><p>Deletes every edit made here (all titles, links, pictures) and goes back to the version in the repository. ' +
      '<button type="button" class="reset">DELETE override (restore hub.json)</button></p>';
    reset.querySelector('.reset').addEventListener('click', function () {
      if (!confirm('DELETE kv:hub and go back to hub.json?\nEvery edit ever made on this tab is lost. This can\'t be undone.')) return;
      api('DELETE', 'hub').then(function () { say('kv:hub deleted; serving hub.json.'); loadContent(); }).catch(function (e) { say(e.message, true); });
    });
    box.appendChild(reset);
  }
  function move(list, i, d) {
    var j = i + d; if (j < 0 || j >= list.length) return;
    var t = list[i]; list[i] = list[j]; list[j] = t; markDirty(); drawContent();
  }
  function save() {
    // drop links left completely empty
    content.sections.forEach(function (s) { s.cards = (s.cards || []).filter(function (c) { return c.title || c.url || c.image; }); });
    var bad = [];
    content.sites.forEach(function (s) { s.subject = (s.subject || '').trim(); s.name = (s.name || '').trim(); if (!s.subject || !s.name) bad.push(s.path); });
    if (bad.length) { say('422 validation: sites[].subject and sites[].name required (path ' + bad[0] + ')', true); return; }
    content.sections.forEach(function (s) { s.cards.forEach(function (c) { if (!c.title) bad.push(c.url || 'a link'); }); });
    if (bad.length) { say('422 validation: cards[].title required (' + bad[0] + ')', true); return; }
    api('PUT', 'hub', { content: content }).then(function () { dirty = false; drawContent(); say('200 committed kv:hub; live on the home page now.'); })
      .catch(function (e) { say(e.message, true); });
  }

  // ------------------------------------------------------------------ sessions
  var sbox = document.getElementById('tab-sessions'), timer = null, autoLeft = 20;
  function loadSessions(auto) {
    clearTimeout(timer);
    if (auto !== true) autoLeft = 20;
    api('GET', 'sessions').then(function (list) {
      sbox.innerHTML = '<h2>sessions [' + list.length + ']</h2>' +
        '<p class="muted">active_sessions=' + list.length + ' max_ttl=21600s store=kv auto_refresh=60s (' + autoLeft + ' left)</p>' +
        '<p>Each row is one signed-in browser. A sign-in lasts 6 hours. <i>revoke</i> signs that browser out (they can sign back in).</p>' +
        '<p><button type="button" class="refresh">refresh</button> <button type="button" class="all"' + (list.length > 1 ? '' : ' disabled') + '>revoke --all --except-self: sign everyone else out</button></p>' +
        '<div class="tablewrap"><table border="1" cellpadding="3"><thead><tr><th>sid</th><th>account</th><th>iat</th><th>exp</th><th>ua</th><th>geo</th><th>ip</th><th></th></tr></thead><tbody>' +
        list.map(function (s) {
          return '<tr><td><code>' + esc(String(s.id).slice(0, 10)) + '…</code></td><td>' + esc(s.account) + '</td><td>' + when(s.created) + '</td><td>' + left(s.expires) + '</td><td><span title="' + esc(s.device) + '">' + esc(device(s.device)) +
            '</span></td><td>' + esc(s.country || '-') + '</td><td><code>' + esc(s.ip || '-') + '</code></td><td>' +
            (s.current ? '<span class="muted">self</span>' : '<button type="button" class="end" data-t="' + esc(s.id) + '" data-a="' + esc(s.account) + '">revoke</button>') + '</td></tr>';
        }).join('') + '</tbody></table></div>';
      sbox.querySelector('.refresh').addEventListener('click', loadSessions);
      sbox.querySelector('.all').addEventListener('click', function () {
        if (confirm('Sign out every other browser (' + (list.length - 1) + ')? You stay signed in here.')) api('POST', 'sessions/end', { everyoneElse: true }).then(function (d) { say('revoked=' + d.ended); loadSessions(); }).catch(function (e) { say(e.message, true); });
      });
      Array.prototype.forEach.call(sbox.querySelectorAll('.end'), function (b) {
        b.addEventListener('click', function () {
          if (!confirm('Sign ' + b.getAttribute('data-a') + ' out on this browser?')) return;
          api('POST', 'sessions/end', { id: b.getAttribute('data-t') }).then(function () { say('revoked=1'); loadSessions(); }).catch(function (e) { say(e.message, true); });
        });
      });
      // keep the list current while it's on screen (a limited number of times: Cloudflare's free plan allows 1,000 lookups a day)
      timer = setTimeout(function () {
        if (!sbox.hidden && !document.hidden && autoLeft-- > 0) loadSessions(true);
      }, 60000);
    }).catch(function (e) { say(e.message, true); });
  }

  // ------------------------------------------------------------------ maintenance
  var mtab = document.getElementById('tab-maintenance'), mbox = document.getElementById('maint-box');
  function loadMaintenance() {
    api('GET', 'maintenance').then(drawMaintenance).catch(function (e) { say(e.message, true); });
    api('GET', 'takedown').then(drawTakedown).catch(function (e) { say(e.message, true); });
  }

  // takedown: a plain "This site has been taken down" page for everyone but admins, until it's turned off here
  var tbox = document.getElementById('takedown-box');
  function drawTakedown(t) {
    tbox.innerHTML = '<fieldset><legend>takedown: whole site off (strongest)</legend>' +
      '<p><b><samp>TAKEDOWN = ' + (t.on ? '1 (ACTIVE: the site is down for everyone but admins)' : '0 (off, site is up)') + '</samp></b></p>' +
      '<p><button type="button" class="tflip">' + (t.on ? 'set takedown=0: bring the site back' : 'set takedown=1: take the whole site down') + '</button></p>' +
      '<p class="muted">effect: all routes (hub, /api/*, every subject proxy) return 503 with a bare page "This site has been taken down."; non-admin sessions are locked out. ' +
      'No TTL; persists until cleared here.</p>' +
      '<p class="muted">admin bypass: click the <b>w</b> in "down" to reveal the sign-in form (role=admin only).</p>' +
      (t.on && t.since ? '<p class="muted">since=' + iso(t.since) + (t.by ? ' by=' + esc(t.by) : '') + '</p>' : '') +
      '</fieldset>';
    tbox.querySelector('.tflip').addEventListener('click', function () {
      if (!t.on && !confirm('TAKE THE WHOLE SITE DOWN?\n\nEveryone except admins sees only "This site has been taken down." on every page, and is signed out, until you turn it off here.')) return;
      if (t.on && !confirm('Bring the site back for everyone?')) return;
      api('PUT', 'takedown', { on: !t.on }).then(function (s) {
        drawTakedown(s);
        say(s.on ? 'takedown=1; serving 503 to non-admins.' : 'takedown=0; site restored.');
      }).catch(function (e) { say(e.message, true); });
    });
  }
  // one-click switch in the header, on every tab (admins keep using the site while it's on)
  var quick = document.querySelector('.quick-maint');
  function drawQuick(m) {
    quick.hidden = false;
    quick.classList.toggle('on', m.on);
    quick.disabled = m.byUpdate && !m.byAdmin;
    quick.textContent = m.on ? 'MAINT=1' + (m.byAdmin && m.until ? ' until ' + iso(m.until) : '') + (quick.disabled ? ' (deploying)' : ' · click to turn off') : 'MAINT=0 · click for maintenance page';
    clearTimeout(quick.t);
    if (m.byAdmin && m.until) quick.t = setTimeout(function () { api('GET', 'maintenance').then(function (s) { drawQuick(s); if (!mtab.hidden) drawMaintenance(s); }); }, Math.max(1000, m.until - Date.now() + 1500));
    quick.title = quick.disabled ? 'Switched on by an update being deployed; it turns off when the update is finished'
      : m.on ? 'Click to open the site to everyone again' : 'Click to show everyone except admins the maintenance page';
    quick.onclick = function () {
      if (!m.byAdmin && !confirm('Turn maintenance on? Everyone except admins sees the "Down for maintenance" page until you turn it off.')) return;
      api('PUT', 'maintenance', { on: !m.byAdmin, message: m.message || '' }).then(function (s) {
        drawQuick(s); if (!mtab.hidden) drawMaintenance(s);
        say(s.on ? 'maintenance=1' : 'maintenance=0');
      }).catch(function (e) { say(e.message, true); });
    };
  }
  api('GET', 'maintenance').then(drawQuick).catch(function () {});

  function drawMaintenance(m) {
    drawQuick(m);
    mbox.innerHTML = '<fieldset><legend>maintenance: friendly "back soon" page</legend>' +
      '<p><b><samp>MAINTENANCE = ' + (m.on ? '1 (ON)' : '0 (off)') + '</samp></b> <span class="muted">src=' + (m.byAdmin ? 'admin' : m.byUpdate ? 'deploy' : 'none') + '</span></p>' +
      '<p><button type="button" class="flip">' + (m.byAdmin ? 'set maintenance=0: open the site again' : 'set maintenance=1: show the maintenance page') + '</button></p>' +
      '<p class="muted">effect: non-admins get the maintenance page (auto-reloads on recovery). Admin bypass via /login?admin.</p>' +
      (m.byUpdate ? '<p class="muted">LOCK held by deploy pipeline; released on deploy completion.</p>' : '') +
      '<p><label>message shown on the page (optional, max 300)<br><input type="text" class="msg" size="60" maxlength="300" value="' + esc(m.message || '') + '"></label></p>' +
      (m.byAdmin && m.until ? '<p class="muted">auto_clear_at=' + iso(m.until) + '</p>' : '') +
      '<p><label>ttl_minutes: turn itself off after this many minutes (blank or 0 = stay on)<br><input type="number" min="0" class="mins" placeholder="0" value="' +
      (m.until && m.until > Date.now() ? Math.ceil((m.until - Date.now()) / 60000) : '') + '"></label></p>' +
      '<p><button type="button" class="savemsg">PUT message+ttl: save message and timer</button> ' +
      '<a href="/" target="_blank" rel="noopener">[open / in new tab]</a></p></fieldset>';
    var msg = mbox.querySelector('.msg');
    function put(on) {
      return api('PUT', 'maintenance', { on: on, message: msg.value, minutes: parseInt(mbox.querySelector('.mins').value, 10) || 0 }).then(function (s) { drawMaintenance(s); say('maintenance=' + (s.on ? 1 : 0) + (s.until ? ' until=' + iso(s.until) : '')); })
        .catch(function (e) { say(e.message, true); });
    }
    mbox.querySelector('.flip').addEventListener('click', function () {
      if (!m.byAdmin && !confirm('Turn maintenance on? Everyone except admins sees the "Down for maintenance" page' + (parseInt(mbox.querySelector('.mins').value, 10) > 0 ? ' for ' + parseInt(mbox.querySelector('.mins').value, 10) + ' min.' : ' until you turn it off.'))) return;
      put(!m.byAdmin);
    });
    mbox.querySelector('.savemsg').addEventListener('click', function () { put(m.byAdmin); });
  }

  // ------------------------------------------------------------------ update notes
  // a line or two about each update for the accounts on the list (functions/_lib/updates.js); it pops up on their next
  // page, and anything they haven't read yet comes with it, under its own dates
  var upbox = document.getElementById('tab-updates'), upSubs = {}, upDirty = false;
  function upSite(site) { var m = /\(([^)]+)\)/.exec(site || ''); return m ? m[1] + ': ' : ''; }
  function loadUpdates() {
    api('GET', 'updates').then(drawUpdates).catch(function (e) { say(e.message, true); });
  }
  function drawUpdates(d) {
    upSubs = {}; upDirty = false;
    d.subs.forEach(function (id) { upSubs[id] = 1; });
    var byId = {};
    d.accounts.forEach(function (a) { byId[a.id] = a; });
    var onList = d.accounts.filter(function (a) { return upSubs[a.id]; }), reach = onList.filter(function (a) { return !a.banned; }).length;
    var deps = d.since.deploys;
    upbox.innerHTML = '<h2>update_notes</h2><p>A short "what\'s new" popup for the accounts on the list. ' +
      'It is written and sent by itself after each update (AUTO_WRITE), or you can write one yourself below.</p>' +
      '<p class="muted">list=' + onList.length + '/' + d.accounts.length + ' reachable=' + reach + ' notes_sent=' + d.log.length +
      ' store=kv:updates:subs,updates:log,upd:&lt;uid&gt; delivery=popup on next page load; unread notes stack newest-first under date headings</p>' +
      '<fieldset><legend>1. automatic notes</legend><p><b><samp>AUTO_WRITE = ' + (d.auto.off ? '0 (off)' : '1 (on)') + '</samp></b> ' +
      '<button type="button" class="up-auto">' + (d.auto.off ? 'set auto=1: turn on' : 'set auto=0: turn off') + '</button></p>' +
      '<p class="muted">' + (d.auto.off ? 'off: notes are only sent from compose below.' :
        'on: after each update (once nothing new has deployed for 15 min) the bullets are written from the PR titles and sent to the list; admin-only changes are skipped. ' +
        'checked ≤ every 10 min. since=' + (d.auto.since ? iso(d.auto.since) : 'first check') + ' last_check=' + (d.auto.ran ? iso(d.auto.ran) : '-')) + '</p>' +
      (!d.auto.off && d.draft.length ? '<p class="muted">next auto note (so far): ' + d.draft.map(function (b) { return '- ' + esc(b); }).join(' ') + '</p>' : '') + '</fieldset>' +
      '<fieldset><legend>2. write one yourself (optional)</legend>' +
      [0, 1].map(function (i) {
        return '<p><label>bullet[' + i + ']' + (i ? ' (optional)' : '') + '<br><input type="text" class="up-bul" size="60" data-i="' + i + '" maxlength="' + d.maxLen + '" autocomplete="off"></label></p>';
      }).join('') +
      '<div class="up-prev"><div class="muted">preview (newest block of the popup):</div><h4>Latest update · ' + esc(new Date().toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })) + '</h4><ul class="up-prev-ul"></ul></div>' +
      '<p><button type="button" class="up-draft"' + (d.draft.length ? '' : ' disabled') + '>draft from deploys: fill in from recent updates</button> ' +
      '<button type="button" class="up-send">POST /updates: send to ' + reach + ' account(s)</button> <samp class="up-why"></samp></p>' +
      '<h3>deploys since ' + (d.since.last ? 'last note (' + iso(d.since.last) + ')' : 'ever (last 10)') + ' [' + deps.length + ']</h3>' +
      (deps.length ? '<ul class="up-src mono">' + deps.map(function (x, di) {
        return '<li>' + esc(iso(x.at)) + ' ' + esc(x.site) + (x.titles.length ? '<ul>' + x.titles.map(function (t, ti) {
          return '<li>' + esc(t) + ' <button type="button" class="up-use" data-d="' + di + '" data-t="' + ti + '">use as bullet</button></li>';
        }).join('') + '</ul>' : ' <span class="muted">(no titles)</span>') + '</li>';
      }).join('') + '</ul>' : '<p class="muted">0 rows (nothing deployed since the last note, or the deploy log is empty)</p>') + '</fieldset>' +
      '<fieldset><legend>3. who gets them: list[' + onList.length + ']</legend><p>Tick accounts, then press <b>PUT list</b> to save.</p>' +
      '<p><label>filter <input type="search" class="up-find" placeholder="username" autocomplete="off"></label> ' +
      'tick: <button type="button" class="up-q" data-q="all">* all shown</button> <button type="button" class="up-q" data-q="user">role=user</button> ' +
      '<button type="button" class="up-q" data-q="none">none</button></p>' +
      '<div class="tablewrap"><table border="1" cellpadding="3"><thead><tr><th>on_list</th><th>uid</th><th>username</th><th>role</th><th>last_note</th></tr></thead><tbody>' +
      d.accounts.map(function (a) {
        var u = a.upd;
        return '<tr data-id="' + esc(a.id) + '"><td><input type="checkbox" class="up-cb"' + (upSubs[a.id] ? ' checked' : '') + ' aria-label="' + esc(a.username) + ' on the update list"></td>' +
          '<td><code>' + esc(a.id) + '</code></td><td>' + esc(a.username) + (a.banned ? ' <span class="ban-tag">BANNED (skipped)</span>' : '') + '</td><td>' + esc(a.role) + '</td><td class="muted">' +
          (u ? (u.seen ? 'read=' + when(u.seen) : 'unread=' + (u.n || 0) + ' since ' + when(u.t)) : '-') + '</td></tr>';
      }).join('') + '</tbody></table></div>' +
      '<p class="savebar"><button type="button" class="up-save" disabled>PUT list: save who gets notes</button> <samp class="up-state">state=clean kv_key=updates:subs</samp></p></fieldset>' +
      '<h3>sent_log[' + d.log.length + ']</h3>' + (d.log.length ? '<div class="tablewrap"><table border="1" cellpadding="3"><thead><tr><th>ts</th><th>by</th><th class="num">sent</th><th class="num">skipped</th><th>bullets</th></tr></thead><tbody>' +
        d.log.map(function (l) {
          return '<tr><td>' + esc(iso(l.t)) + '</td><td>' + esc(l.by) + '</td><td class="num">' + l.sent + '</td><td class="num">' + l.skipped + '</td><td>' + l.bullets.map(function (b) { return '- ' + esc(b); }).join('<br>') + '</td></tr>';
        }).join('') + '</tbody></table></div>' : '<p class="muted">0 rows</p>');

    var buls = upbox.querySelectorAll('.up-bul'), prev = upbox.querySelector('.up-prev-ul'), send = upbox.querySelector('.up-send');
    function bullets() { return Array.prototype.map.call(buls, function (b) { return b.value.trim(); }).filter(Boolean); }
    function preview() {
      prev.innerHTML = bullets().map(function (b) { return '<li>' + esc(b) + '</li>'; }).join('') || '<li class="muted">(empty)</li>';
      send.disabled = !bullets().length || !reach || upDirty;
      send.title = upDirty ? 'PUT the list first' : !reach ? 'Nobody on the list' : '';
      upbox.querySelector('.up-why').textContent = !bullets().length ? '(write a bullet first)' : upDirty ? '(save the list in 3 first)' : !reach ? '(nobody on the list yet)' : '';
    }
    Array.prototype.forEach.call(buls, function (b) { b.addEventListener('input', preview); });
    function put(text) {
      var empty = Array.prototype.filter.call(buls, function (b) { return !b.value.trim(); })[0];
      if (!empty) { say('both bullets are full; clear one first', true); return; }
      empty.value = text; preview();
    }
    Array.prototype.forEach.call(upbox.querySelectorAll('.up-use'), function (b) {
      b.addEventListener('click', function () { var x = deps[+b.getAttribute('data-d')]; put(upSite(x.site) + x.titles[+b.getAttribute('data-t')]); });
    });
    upbox.querySelector('.up-draft').addEventListener('click', function () {
      Array.prototype.forEach.call(buls, function (b, i) { b.value = d.draft[i] || ''; });
      preview(); say('drafted from ' + deps.length + ' deploys; edit the wording before sending');
    });
    upbox.querySelector('.up-auto').addEventListener('click', function () {
      api('PUT', 'updates/auto', { on: !!d.auto.off }).then(function (a) { say('auto_write=' + (a.off ? 0 : 1)); loadUpdates(); }).catch(function (e) { say(e.message, true); });
    });
    send.addEventListener('click', function () {
      var b = bullets();
      if (!confirm('Send this update note to ' + reach + ' account(s)? It pops up on their next page.\n\n' + b.map(function (x) { return '- ' + x; }).join('\n'))) return;
      api('POST', 'updates', { bullets: b }).then(function (r) { say('update note queued sent=' + r.sent + ' skipped=' + r.skipped); loadUpdates(); }).catch(function (e) { say(e.message, true); });
    });

    var rows = Array.prototype.map.call(upbox.querySelectorAll('tr[data-id]'), function (tr) {
      return { tr: tr, cb: tr.querySelector('.up-cb'), a: byId[tr.getAttribute('data-id')] };
    });
    function upMark() {
      upDirty = true;
      upbox.querySelector('.up-save').disabled = false;
      upbox.querySelector('.up-state').textContent = 'state=dirty (not saved) list=' + Object.keys(upSubs).length + ' kv_key=updates:subs';
      preview();
    }
    rows.forEach(function (r) {
      r.cb.addEventListener('change', function () { if (r.cb.checked) upSubs[r.a.id] = 1; else delete upSubs[r.a.id]; upMark(); });
    });
    upbox.querySelector('.up-find').addEventListener('input', function (e) {
      var q = e.target.value.trim().toLowerCase();
      rows.forEach(function (r) { r.tr.hidden = !!q && r.a.username.toLowerCase().indexOf(q) < 0; });
    });
    Array.prototype.forEach.call(upbox.querySelectorAll('.up-q'), function (b) {
      b.addEventListener('click', function () {
        var q = b.getAttribute('data-q');
        rows.forEach(function (r) {
          if (r.tr.hidden) return;
          var on = q === 'all' || (q === 'user' && r.a.role === 'user');
          r.cb.checked = on; if (on) upSubs[r.a.id] = 1; else delete upSubs[r.a.id];
        });
        upMark();
      });
    });
    upbox.querySelector('.up-save').addEventListener('click', function () {
      api('PUT', 'updates/subs', { ids: Object.keys(upSubs) }).then(function (r) { say('200 committed updates:subs list=' + r.subs.length); loadUpdates(); }).catch(function (e) { say(e.message, true); });
    });
    preview();
  }

  // ------------------------------------------------------------------ accounts
  var abox = document.getElementById('tab-accounts');
  // an account's email address: checked (typed in the code emailed to it), not checked yet, or none
  function emailCell(a) {
    if (!a.email) return '<span class="muted">null' + (a.mustVerify ? ' (required)' : '') + '</span>';
    return esc(a.email) + ' <span class="' + (a.emailVerified ? 'em-ok' : 'muted') + '">' + (a.emailVerified ? 'verified=1' : 'verified=0') + '</span>';
  }
  function loadAccounts() {
    api('GET', 'accounts').then(function (list) {
      // one "manage" drop-down per row (only one open at a time), its buttons grouped by what they touch
      abox.innerHTML = '<h2>accounts [' + list.length + ']</h2>' +
        '<p class="muted">rows=' + list.length + ' admins=' + list.filter(function (a) { return a.role === 'admin'; }).length +
        ' banned=' + list.filter(function (a) { return a.banned; }).length + ' sessions=' + list.reduce(function (n, a) { return n + (a.signedIn || 0); }, 0) + ' store=kv:accounts</p>' +
        '<p>To change one account, press <b>manage</b> on its row. To message several at once, tick them and use the box above the table. ' +
        'New accounts and agent keys are at the bottom (<a href="#acc-add">jump</a>).</p>' +
        '<div class="tablewrap"><table border="1" cellpadding="3"><thead><tr><th>uid</th><th>username</th><th>role</th><th>email</th><th class="num">sess</th><th>ops</th></tr></thead><tbody>' +
        list.map(function (a) {
          var pending = a.note && !a.note.seen;
          return '<tr data-id="' + esc(a.id) + '"><td><code>' + esc(a.id) + '</code></td><td>' + esc(a.username) + (a.you ? ' <span class="muted">[self]</span>' : '') +
            (a.banned ? '<br><b class="ban-tag">BANNED ' + when(a.banned) + '</b>' : '') +
            (a.note ? '<br><span class="muted">' + (a.note.seen ? 'msg.read=' + when(a.note.seen) : 'msg.pending since ' + when(a.note.t)) + '</span>' : '') + '</td>' +
            '<td>' + esc(a.role) + '</td><td>' + emailCell(a) + '</td><td class="num">' + (a.signedIn || 0) + '</td>' +
            '<td><details name="acct-ops"><summary>manage</summary>' +
            '<fieldset><legend>login</legend>' +
              '<button type="button" class="pw">passwd: set new password</button> ' +
              '<button type="button" class="rename">mv: rename</button><br>' +
              '<label>role <select class="role"' + (a.you ? ' disabled title="You can\'t change your own role"' : '') + '><option value="user"' + (a.role === 'user' ? ' selected' : '') + '>user (normal)</option>' +
              '<option value="admin"' + (a.role === 'admin' ? ' selected' : '') + '>admin (+ this console)</option></select></label>' +
            '</fieldset>' +
            '<fieldset><legend>sessions / email</legend>' +
              '<button type="button" class="out"' + (a.signedIn ? '' : ' disabled title="Not signed in anywhere"') + '>revoke_sessions: sign out everywhere (' + (a.signedIn || 0) + ')</button>' +
              (a.mustVerify ? '<br><button type="button" class="excuse" title="Let this account use the site without checking its email address">skip_verify: let in without checking email</button>' : '') +
              (a.email ? '<br><button type="button" class="noemail">email.unset: remove email address</button>' : '') +
            '</fieldset>' +
            '<fieldset><legend>message (popup on their next page)</legend>' +
              (a.banned ? '<span class="muted">banned accounts don\'t get messages</span>' :
                '<button type="button" class="msg">' + (pending ? 'msg.edit: change waiting message' : 'msg.send: write message') + '</button>') +
              (a.note ? ' <button type="button" class="nomsg">' + (a.note.seen ? 'msg.clear: forget read message' : 'msg.cancel: take back unread message') + '</button>' : '') +
            '</fieldset>' +
            (a.you ? '' : '<fieldset><legend>danger (asks first)</legend>' +
              '<button type="button" class="' + (a.banned ? 'unban">unban: let back in' : 'ban">ban: block account') + '</button> ' +
              '<button type="button" class="del">DELETE account</button></fieldset>') +
            '</details></td></tr>';
        }).join('') + '</tbody></table></div>' +
        '<h2 id="acc-add">useradd</h2><form class="addform"><fieldset><legend>add an account</legend>' +
        '<label>username <input type="text" class="nu" required autocomplete="off"></label> ' +
        '<label>password <input type="password" class="np" required minlength="6" autocomplete="new-password"></label> ' +
        '<label>role <select class="nr"><option value="user">user (normal)</option><option value="admin">admin (+ this console)</option></select></label> ' +
        '<button type="submit" class="add">POST: create account</button>' +
        '<p class="muted">role=user: full site access. role=admin: + /admin. Password min 6 chars.</p></fieldset></form>';
      Array.prototype.forEach.call(abox.querySelectorAll('tr[data-id]'), function (tr) {
        var id = tr.getAttribute('data-id'), a = list.filter(function (x) { return x.id === id; })[0];
        function patch(body, msg) { return api('PATCH', 'accounts/' + id, body).then(function () { say(msg); loadAccounts(); }).catch(function (e) { say(e.message, true); loadAccounts(); }); }
        tr.querySelector('.role').addEventListener('change', function (e) {
          var r = e.target.value;
          if (!confirm('Make ' + a.username + ' ' + (r === 'admin' ? 'an ADMIN (they can open this console)' : 'a normal user (no console)') + '?\nThey will be signed out everywhere.')) { e.target.value = a.role; return; }
          patch({ role: r }, 'role=' + r + ' uid=' + id + '; sessions revoked');
        });
        tr.querySelector('.pw').addEventListener('click', function () {
          ask('New password for ' + a.username + ' (uid ' + id + '):', '', 'password', 'set password',
            a.you ? 'At least 6 characters.' : 'At least 6 characters. They will be signed out everywhere.').then(function (v) {
            if (v) patch({ password: v }, 'password updated uid=' + id + (a.you ? '' : '; sessions revoked'));
          });
        });
        tr.querySelector('.rename').addEventListener('click', function () {
          ask('New username for ' + a.username + ':', a.username, 'text', 'rename').then(function (v) { if (v && v.trim() && v.trim() !== a.username) patch({ username: v.trim() }, 'username=' + v.trim() + ' uid=' + id); });
        });
        var ex = tr.querySelector('.excuse'), ne = tr.querySelector('.noemail');
        if (ex) ex.addEventListener('click', function () { patch({ excuse: true }, 'verify_required=0 uid=' + id); });
        if (ne) ne.addEventListener('click', function () {
          if (confirm('Remove the email address from ' + a.label + '?\n(They can add one again from their account menu.)')) patch({ email: '' }, 'email=null uid=' + id);
        });
        // a message shown to them once, on their next page (straight away if they're signed in now)
        var msgb = tr.querySelector('.msg');
        if (msgb) msgb.addEventListener('click', function () {
          (a.note && !a.note.seen ? api('GET', 'accounts/' + id + '/note') : Promise.resolve(null)).then(function (n) {
            return writeMessage('Message to ' + a.username + ' (uid ' + id + '). Shown once, as a popup on their next page:', n);
          }).then(function (m) {
            if (m) api('PUT', 'accounts/' + id + '/note', m).then(function () { say('msg queued uid=' + id); loadAccounts(); }).catch(function (e) { say(e.message, true); });
          });
        });
        var nomsg = tr.querySelector('.nomsg');
        if (nomsg) nomsg.addEventListener('click', function () {
          if (!a.note.seen && !confirm('Take back the message waiting for ' + a.username + '? They will never see it.')) return;
          api('DELETE', 'accounts/' + id + '/note').then(function () { say('msg deleted uid=' + id); loadAccounts(); }).catch(function (e) { say(e.message, true); });
        });
        tr.querySelector('.out').addEventListener('click', function () {
          if (!confirm('Sign ' + a.username + ' out on all ' + a.signedIn + ' device(s)? They can sign straight back in.')) return;
          api('POST', 'sessions/end', { accountId: id }).then(function (d) { say('revoked=' + d.ended + ' uid=' + id); loadAccounts(); }).catch(function (e) { say(e.message, true); });
        });
        // ban: signed out everywhere, can't sign in again or make a new account (functions/_lib/bans.js)
        var bn = tr.querySelector('.ban'), ub = tr.querySelector('.unban');
        if (bn) bn.addEventListener('click', function () {
          if (!confirm('BAN ' + a.label + ' (uid ' + id + ')?\n\n- signed out everywhere now\n- can\'t sign in again\n- can\'t make a new account with the same email or browser\n' +
            '- if they try, new sign-ups from that internet address are blocked for 30 days (existing accounts there still work)\n\nYou can unban later.')) return;
          api('POST', 'accounts/' + id + '/ban').then(function (d) { say('banned uid=' + id + ' revoked=' + (d.ended || 0)); loadAccounts(); }).catch(function (e) { say(e.message, true); });
        });
        if (ub) ub.addEventListener('click', function () {
          if (!confirm('Unban ' + a.username + '? They can sign in again.')) return;
          api('DELETE', 'accounts/' + id + '/ban').then(function () { say('unbanned uid=' + id); loadAccounts(); }).catch(function (e) { say(e.message, true); });
        });
        var del = tr.querySelector('.del');
        if (del) del.addEventListener('click', function () {
          // the one that can't be undone: type the username to go ahead
          ask('DELETE ' + a.label + ' (uid ' + id + ') for good? Type the username "' + a.username + '" to confirm:', '', 'text', 'DELETE account',
            'This can\'t be undone. Their progress and activity go too, and they are signed out everywhere.').then(function (v) {
            if (v == null) return;
            if (v.trim() !== a.username) { say('not deleted: typed name did not match "' + a.username + '"', true); return; }
            api('DELETE', 'accounts/' + id).then(function () { say('deleted uid=' + id + ' (' + a.username + ')'); loadAccounts(); }).catch(function (e) { say(e.message, true); });
          });
        });
      });
      abox.querySelector('.addform').addEventListener('submit', function (e) {
        e.preventDefault();
        var u = abox.querySelector('.nu').value.trim(), p = abox.querySelector('.np').value, r = abox.querySelector('.nr').value;
        api('POST', 'accounts', { username: u, password: p, role: r }).then(function () { say('201 created username=' + u + ' role=' + r); loadAccounts(); }).catch(function (e) { say(e.message, true); });
      });
      addPicker(list);
      loadBans();
      loadKeys();
    }).catch(function (e) { say(e.message, true); });
  }

  // pick several accounts (tick boxes, or the quick picks) and send them all one message, or cancel theirs
  var picked = {};
  function addPicker(list) {
    var table = abox.querySelector('table'), rows = abox.querySelectorAll('tr[data-id]'), byId = {};
    list.forEach(function (a) { byId[a.id] = a; });
    Object.keys(picked).forEach(function (id) { if (!byId[id] || byId[id].banned) delete picked[id]; });
    var bar = document.createElement('fieldset');
    bar.className = 'pickbar';
    bar.innerHTML = '<legend>find / tick several accounts</legend>' +
      '<p><label>filter <input type="search" class="pick-find" size="30" placeholder="username or email" autocomplete="off"></label></p>' +
      '<p>tick: <button type="button" class="pick-q" data-q="all">* all shown</button> <button type="button" class="pick-q" data-q="user">role=user</button> ' +
      '<button type="button" class="pick-q" data-q="on">sess&gt;0 (signed in)</button> <button type="button" class="pick-q" data-q="unread">msg.pending (unread message)</button> ' +
      '<button type="button" class="pick-q" data-q="none">none</button></p>' +
      '<p><samp class="pick-n"></samp> &rarr; <button type="button" class="pick-send">msg.send: message the ticked accounts</button> ' +
      '<button type="button" class="pick-clear">msg.clear: take back their messages</button></p>';
    table.parentNode.parentNode.insertBefore(bar, table.parentNode);
    var head = document.createElement('th'), all = document.createElement('input');
    all.type = 'checkbox'; all.setAttribute('aria-label', 'Tick every account shown');
    head.appendChild(all); table.querySelector('thead tr').insertBefore(head, table.querySelector('thead th'));
    var boxes = [];
    Array.prototype.forEach.call(rows, function (tr) {
      var id = tr.getAttribute('data-id'), a = byId[id], td = document.createElement('td'), cb = document.createElement('input');
      cb.type = 'checkbox'; cb.className = 'pick'; cb.checked = !!picked[id]; cb.disabled = !!a.banned;
      cb.setAttribute('aria-label', 'Tick ' + a.username); if (a.banned) cb.title = 'Banned accounts don\'t get messages';
      cb.addEventListener('change', function () { if (cb.checked) picked[id] = 1; else delete picked[id]; count(); });
      td.appendChild(cb); tr.insertBefore(td, tr.firstChild);
      boxes.push({ tr: tr, cb: cb, a: a });
    });
    function shown() { return boxes.filter(function (b) { return !b.tr.hidden && !b.cb.disabled; }); }
    function count() {
      var n = Object.keys(picked).length, s = shown();
      bar.querySelector('.pick-n').textContent = 'ticked=' + n + ' shown=' + s.length;
      bar.querySelector('.pick-send').disabled = bar.querySelector('.pick-clear').disabled = !n;
      all.checked = s.length > 0 && s.every(function (b) { return b.cb.checked; });
    }
    function set(b, on) { b.cb.checked = on; if (on) picked[b.a.id] = 1; else delete picked[b.a.id]; }
    all.addEventListener('change', function () { shown().forEach(function (b) { set(b, all.checked); }); count(); });
    bar.querySelector('.pick-find').addEventListener('input', function (e) {
      var q = e.target.value.trim().toLowerCase();
      boxes.forEach(function (b) { b.tr.hidden = !!q && (b.a.username + ' ' + (b.a.email || '')).toLowerCase().indexOf(q) < 0; });
      count();
    });
    Array.prototype.forEach.call(bar.querySelectorAll('.pick-q'), function (btn) {
      btn.addEventListener('click', function () {
        var q = btn.getAttribute('data-q');
        shown().forEach(function (b) {
          set(b, q === 'all' || (q === 'user' && b.a.role === 'user') || (q === 'on' && b.a.signedIn > 0) || (q === 'unread' && !!b.a.note && !b.a.note.seen));
        });
        count();
      });
    });
    function names(ids) {
      var n = ids.map(function (id) { return byId[id].username; });
      return n.length > 3 ? n.slice(0, 3).join(', ') + ' and ' + (n.length - 3) + ' more' : n.join(', ');
    }
    bar.querySelector('.pick-send').addEventListener('click', function () {
      var ids = Object.keys(picked);
      writeMessage('Message to ' + ids.length + ' account(s): ' + names(ids) + '. Shown once, as a popup on their next page' +
        (ids.some(function (id) { return byId[id].note && !byId[id].note.seen; }) ? ' (replaces any message still waiting for them)' : '') + ':', null).then(function (m) {
        if (!m) return;
        m.ids = ids;
        api('POST', 'notes', m).then(function (d) {
          picked = {};
          say('msg queued count=' + d.count + ' skipped=' + (d.skipped || 0));
          loadAccounts();
        }).catch(function (e) { say(e.message, true); });
      });
    });
    bar.querySelector('.pick-clear').addEventListener('click', function () {
      var ids = Object.keys(picked);
      if (confirm('Take back the messages for ' + ids.length + ' account(s): ' + names(ids) + '?'))
        api('POST', 'notes/clear', { ids: ids }).then(function (d) { picked = {}; say('msg cleared count=' + d.count); loadAccounts(); })
          .catch(function (e) { say(e.message, true); });
    });
    count();
  }

  // bans: banned accounts (deleted ones too, whose ban still stands), their attempts since, and internet addresses that
  // can't make new accounts for now because a banned person tried to make one there
  function loadBans() {
    var bbox = document.createElement('div');
    abox.appendChild(bbox);
    api('GET', 'bans').then(function (b) {
      if (!b.accounts.length && !b.ips.length) return;
      var tries = function (r) {
        if (!r.tries.length) return '<span class="muted">0</span>';
        var up = r.tries.filter(function (x) { return x.what === 'signup'; }).length;
        return 'signup=' + up + ' login=' + (r.tries.length - up) + '<br><span class="muted">last=' + when(r.tries[0].t) + '</span>';
      };
      bbox.innerHTML = '<h2>bans [' + b.accounts.length + ']</h2>' +
        '<p class="muted">match: email | jbr_dev cookie. signup attempt → ip signup block, ttl=30d (sign-in unaffected).</p>' +
        '<p>Banned accounts and what they have tried since. <i>unban</i> lets one back in; <i>lift</i> lets an internet address make new accounts again.</p>' +
        (b.accounts.length ? '<div class="tablewrap"><table border="1" cellpadding="3"><thead><tr><th>uid</th><th>username</th><th>banned_at</th><th>attempts</th><th></th></tr></thead><tbody>' +
          b.accounts.map(function (r) {
            return '<tr><td><code>' + esc(r.id) + '</code></td><td>' + esc(r.username) + (r.gone ? ' <span class="muted">[deleted]</span>' : '') + (r.email ? '<br><span class="muted">' + esc(r.email) + '</span>' : '') +
              '</td><td>' + when(r.t) + '</td><td>' + tries(r) + '</td><td><button type="button" class="bunban" data-id="' + esc(r.id) + '" data-name="' + esc(r.username) + '">unban: let back in</button></td></tr>';
          }).join('') + '</tbody></table></div>' : '') +
        (b.ips.length ? '<h3>ip_signup_blocks [' + b.ips.length + ']</h3><div class="tablewrap"><table border="1" cellpadding="3"><thead><tr><th>ip</th><th>trigger</th><th>expires</th><th></th></tr></thead><tbody>' +
          b.ips.map(function (x) {
            return '<tr><td><code>' + esc(x.ip) + '</code></td><td>' + esc(x.username) + ' @ ' + when(x.t) + '</td><td>' +
              iso(x.until) + '</td><td><button type="button" class="lift" data-ip="' + esc(x.ip) + '">lift: allow sign-ups again</button></td></tr>';
          }).join('') + '</tbody></table></div>' : '');
      Array.prototype.forEach.call(bbox.querySelectorAll('.bunban'), function (el) {
        el.addEventListener('click', function () {
          if (!confirm('Unban ' + el.getAttribute('data-name') + '? They can sign in (or sign up) again.')) return;
          api('DELETE', 'accounts/' + el.getAttribute('data-id') + '/ban').then(function () { say('unbanned uid=' + el.getAttribute('data-id')); loadAccounts(); }).catch(function (e) { say(e.message, true); });
        });
      });
      Array.prototype.forEach.call(bbox.querySelectorAll('.lift'), function (el) {
        el.addEventListener('click', function () {
          if (!confirm('Let ' + el.getAttribute('data-ip') + ' make new accounts again?')) return;
          api('DELETE', 'bans/ip/' + encodeURIComponent(el.getAttribute('data-ip'))).then(function () { say('ip block lifted ' + el.getAttribute('data-ip')); loadAccounts(); }).catch(function (e) { say(e.message, true); });
        });
      });
    }).catch(function (e) { say(e.message, true); });
  }

  // access keys: let an agent (e.g. a Claude agent) use the site as a standard account without the login form
  var pendingKey = null;
  function showKey(nb, key) {
    var link = location.origin + '/?key=' + key;
    nb.innerHTML = '<p><b>WARNING: secret shown once. Store it now.</b></p>' +
      '<p class="muted">browser agents: entry url</p><input type="text" class="grow keyout" size="80" readonly value="' + esc(link) + '">' +
      '<p class="muted">http clients: <code>?key=' + esc(key) + '</code> or header <code>Authorization: Bearer ' + esc(key) + '</code></p>' +
      '<button type="button" class="copy">copy link</button>';
    nb.querySelector('.copy').addEventListener('click', function () {
      nb.querySelector('.keyout').select();
      (navigator.clipboard ? navigator.clipboard.writeText(link) : Promise.reject()).then(function () { say('copied to clipboard'); }, function () { document.execCommand('copy'); say('copied to clipboard'); });
    });
  }
  function loadKeys() {
    var kbox = document.createElement('div');
    abox.appendChild(kbox);
    api('GET', 'keys').then(function (list) {
      var day = function (t) { return t ? iso(t) : 'null'; };
      kbox.innerHTML = '<h2>api_keys [' + list.length + ']</h2>' +
        '<p class="muted">bearer tokens for agents/scripts. scope=role:user (never admin). stored as sha256; revoke to invalidate.</p>' +
        '<p>A key lets an AI agent or script use the site like a normal account, without the login form.</p>' +
        (list.length ? '<div class="tablewrap"><table border="1" cellpadding="3"><thead><tr><th>kid</th><th>label</th><th>created</th><th>last_used</th><th></th></tr></thead><tbody>' +
          list.map(function (k) {
            return '<tr><td><code>' + esc(k.id) + '</code></td><td>' + esc(k.label) + '</td><td>' + day(k.created) + '</td><td>' + day(k.lastUsed) + '</td>' +
              '<td><button type="button" class="revoke" data-id="' + esc(k.id) + '">revoke: stop this key</button></td></tr>';
          }).join('') + '</tbody></table></div>' : '') +
        '<form class="mkform"><fieldset><legend>make a key</legend><label>label (who it is for) <input type="text" class="kl" placeholder="Claude agent" maxlength="40" autocomplete="off"></label> ' +
        '<button type="submit" class="mk">POST /keys: make key</button><div class="newkey"></div></fieldset></form>';
      if (pendingKey) showKey(kbox.querySelector('.newkey'), pendingKey);
      pendingKey = null;
      kbox.querySelector('.mkform').addEventListener('submit', function (e) {
        e.preventDefault();
        api('POST', 'keys', { label: kbox.querySelector('.kl').value.trim() || 'Claude agent' }).then(function (d) {
          pendingKey = d.key;  // shown once, in the refreshed list
          loadAccounts();
        }).catch(function (e) { say(e.message, true); });
      });
      Array.prototype.forEach.call(kbox.querySelectorAll('.revoke'), function (b) {
        b.addEventListener('click', function () {
          if (!confirm('Revoke key ' + b.getAttribute('data-id') + '? Anything using it is cut off immediately (401). This can\'t be undone.')) return;
          api('DELETE', 'keys/' + b.getAttribute('data-id')).then(function () { say('key revoked kid=' + b.getAttribute('data-id')); loadAccounts(); }).catch(function (e) { say(e.message, true); });
        });
      });
    }).catch(function (e) { say(e.message, true); });
  }

  // opens on the tab in the address (#accounts, #maintenance from the banner on the home page, …), else accounts
  show(TABS.indexOf(location.hash.slice(1)) >= 0 ? location.hash.slice(1) : 'accounts');
})();
