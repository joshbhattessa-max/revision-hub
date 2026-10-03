/* Admin console: edit the home page, see who is signed in, manage accounts. Talks to /api/admin/*. */
(function () {
  'use strict';
  var notice = document.querySelector('.notice');
  function say(msg, bad) { notice.textContent = msg || ''; notice.className = 'notice' + (bad ? ' err' : ''); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function api(method, path, body, raw) {
    var opt = { method: method, credentials: 'same-origin', headers: {} };
    if (raw) { opt.body = raw; opt.headers['content-type'] = raw.type; }
    else if (body !== undefined) { opt.body = JSON.stringify(body); opt.headers['content-type'] = 'application/json'; }
    return fetch('/api/admin/' + path, opt).then(function (r) {
      if (r.status === 401) { location.replace('/login?next=/admin'); throw new Error('Signed out'); }
      return r.json().then(function (d) { if (!r.ok) throw new Error(d.error || 'Something went wrong.'); return d; });
    });
  }
  // small question box instead of the browser's prompt()
  var dlg = document.querySelector('.ask');
  function ask(question, value, type) {
    return new Promise(function (resolve) {
      dlg.querySelector('.ask-q').textContent = question;
      var inp = dlg.querySelector('.ask-in');
      inp.type = type || 'text'; inp.value = value || '';
      dlg.onclose = function () { resolve(dlg.returnValue === 'ok' ? inp.value : null); };
      dlg.returnValue = ''; dlg.showModal(); inp.focus();
    });
  }
  function when(t) { return new Date(t).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }); }
  function left(t) {
    var m = Math.max(0, Math.round((t - Date.now()) / 60000));
    return Math.floor(m / 60) + 'h ' + (m % 60 < 10 ? '0' : '') + (m % 60) + 'm';
  }
  function device(ua) {
    ua = ua || '';
    var b = /Edg\//.test(ua) ? 'Edge' : /OPR\//.test(ua) ? 'Opera' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : 'Browser';
    var o = /iPhone/.test(ua) ? 'iPhone' : /iPad/.test(ua) ? 'iPad' : /Android/.test(ua) ? 'Android' : /Mac OS X/.test(ua) ? 'Mac' : /Windows/.test(ua) ? 'Windows' : /CrOS/.test(ua) ? 'Chromebook' : /Linux/.test(ua) ? 'Linux' : '';
    return b + (o ? ' on ' + o : '');
  }

  // ------------------------------------------------------------------ tabs
  var tabs = document.querySelectorAll('.tabs button');
  Array.prototype.forEach.call(tabs, function (b) {
    b.addEventListener('click', function () { show(b.getAttribute('data-tab')); });
  });
  function show(name) {
    Array.prototype.forEach.call(tabs, function (b) { b.classList.toggle('on', b.getAttribute('data-tab') === name); });
    ['content', 'sessions', 'accounts', 'maintenance'].forEach(function (n) { document.getElementById('tab-' + n).hidden = n !== name; });
    say('');
    if (name === 'sessions') loadSessions();
    if (name === 'accounts') loadAccounts();
    if (name === 'maintenance') loadMaintenance();
  }

  // ------------------------------------------------------------------ content
  var content = null, dirty = false;
  var box = document.getElementById('tab-content');
  function markDirty() { dirty = true; var s = box.querySelector('.save'); if (s) s.disabled = false; }
  window.addEventListener('beforeunload', function (e) { if (dirty) { e.preventDefault(); e.returnValue = ''; } });

  function loadContent() {
    api('GET', 'hub').then(function (c) { content = c; dirty = false; drawContent(); }).catch(function (e) { say(e.message, true); });
  }
  function imageField(value, onSet) {
    var wrap = document.createElement('div'); wrap.className = 'row grow';
    wrap.innerHTML = (value ? '<img class="thumb" alt="" src="' + esc(value) + '">' : '') +
      '<input type="url" class="grow" placeholder="Picture: a web address, or upload one" value="' + esc(value) + '">' +
      '<label class="small btn-quiet" style="cursor:pointer">Upload<input type="file" accept="image/*" hidden></label>';
    wrap.querySelector('input[type=url]').addEventListener('input', function (e) { onSet(e.target.value.trim()); markDirty(); });
    wrap.querySelector('input[type=file]').addEventListener('change', function (e) {
      var f = e.target.files[0]; if (!f) return;
      say('Uploading ' + f.name + '…');
      api('POST', 'media', undefined, f).then(function (d) { onSet(d.url); markDirty(); drawContent(); say('Uploaded. Remember to save.'); })
        .catch(function (err) { say(err.message, true); });
    });
    return wrap;
  }
  function drawContent() {
    var c = content;
    box.innerHTML = '';
    var top = document.createElement('div'); top.className = 'box';
    top.innerHTML = '<label class="lbl">Page title<input type="text" class="title" value="' + esc(c.title) + '"></label>';
    top.querySelector('.title').addEventListener('input', function (e) { c.title = e.target.value; markDirty(); });
    box.appendChild(top);

    var h = document.createElement('h2'); h.textContent = 'Subjects'; box.appendChild(h);
    (c.sites || []).forEach(function (s) {
      var row = document.createElement('div'); row.className = 'box';
      row.innerHTML = '<div class="row"><strong class="grow">' + esc(s.name) + '</strong>' +
        '<label class="muted"><input type="checkbox" class="hid"' + (s.hidden ? ' checked' : '') + '> Hide on the home page</label></div>' +
        '<div class="row"><label class="lbl">Subject name<input type="text" class="subj" value="' + esc(s.subject) + '"></label>' +
        '<label class="lbl">Colour<input type="text" class="col" value="' + esc(s.color) + '" placeholder="#17A398"></label></div>';
      row.querySelector('.hid').addEventListener('change', function (e) { s.hidden = e.target.checked; markDirty(); });
      row.querySelector('.subj').addEventListener('input', function (e) { s.subject = e.target.value; markDirty(); });
      row.querySelector('.col').addEventListener('input', function (e) { s.color = e.target.value.trim(); markDirty(); });
      row.appendChild(imageField(s.image, function (v) { s.image = v; }));
      box.appendChild(row);
    });

    (c.sections || []).forEach(function (sec, si) {
      var hd = document.createElement('div'); hd.className = 'row'; hd.style.marginTop = '26px';
      hd.innerHTML = '<input type="text" class="grow sec-title" value="' + esc(sec.title) + '" aria-label="Section title" style="font-weight:600;font-size:1.05rem">' +
        '<button type="button" class="small up">↑</button><button type="button" class="small down">↓</button>' +
        '<button type="button" class="small danger del">Delete section</button>';
      hd.querySelector('.sec-title').addEventListener('input', function (e) { sec.title = e.target.value; markDirty(); });
      hd.querySelector('.up').addEventListener('click', function () { move(c.sections, si, -1); });
      hd.querySelector('.down').addEventListener('click', function () { move(c.sections, si, 1); });
      hd.querySelector('.del').addEventListener('click', function () {
        if (confirm('Delete the section "' + sec.title + '" and its ' + (sec.cards || []).length + ' links?')) { c.sections.splice(si, 1); markDirty(); drawContent(); }
      });
      box.appendChild(hd);
      sec.cards = sec.cards || [];
      sec.cards.forEach(function (card, ci) {
        var row = document.createElement('div'); row.className = 'box';
        row.innerHTML = '<div class="row"><label class="lbl">Title<input type="text" class="t" value="' + esc(card.title) + '"></label>' +
          '<label class="lbl">Link<input type="url" class="u" value="' + esc(card.url) + '" placeholder="https://"></label></div>' +
          '<div class="row img"></div><div class="row"><button type="button" class="small up">↑</button><button type="button" class="small down">↓</button>' +
          '<button type="button" class="small danger del">Remove</button></div>';
        row.querySelector('.t').addEventListener('input', function (e) { card.title = e.target.value; markDirty(); });
        row.querySelector('.u').addEventListener('input', function (e) { card.url = e.target.value.trim(); markDirty(); });
        row.querySelector('.img').appendChild(imageField(card.image, function (v) { card.image = v; }));
        row.querySelector('.up').addEventListener('click', function () { move(sec.cards, ci, -1); });
        row.querySelector('.down').addEventListener('click', function () { move(sec.cards, ci, 1); });
        row.querySelector('.del').addEventListener('click', function () { sec.cards.splice(ci, 1); markDirty(); drawContent(); });
        box.appendChild(row);
      });
      var add = document.createElement('button'); add.type = 'button'; add.className = 'small'; add.textContent = '+ Add a link';
      add.addEventListener('click', function () { sec.cards.push({ title: '', url: '' }); markDirty(); drawContent(); });
      box.appendChild(add);
    });
    var addSec = document.createElement('div'); addSec.className = 'row'; addSec.style.marginTop = '22px';
    addSec.innerHTML = '<button type="button" class="small">+ Add a section</button>';
    addSec.firstChild.addEventListener('click', function () { c.sections.push({ title: 'New section', cards: [] }); markDirty(); drawContent(); });
    box.appendChild(addSec);

    var bar = document.createElement('div'); bar.className = 'savebar';
    bar.innerHTML = '<button type="button" class="btn-main save"' + (dirty ? '' : ' disabled') + '>Save changes</button>' +
      '<button type="button" class="small undo">Discard changes</button>' +
      '<button type="button" class="small reset">Reset to the built-in version</button>';
    bar.querySelector('.save').addEventListener('click', save);
    bar.querySelector('.undo').addEventListener('click', function () { if (!dirty || confirm('Discard your unsaved changes?')) loadContent(); });
    bar.querySelector('.reset').addEventListener('click', function () {
      if (!confirm('Throw away every change made here and go back to the version in hub.json?')) return;
      api('DELETE', 'hub').then(function () { say('Back to the built-in version.'); loadContent(); }).catch(function (e) { say(e.message, true); });
    });
    box.appendChild(bar);
  }
  function move(list, i, d) {
    var j = i + d; if (j < 0 || j >= list.length) return;
    var t = list[i]; list[i] = list[j]; list[j] = t; markDirty(); drawContent();
  }
  function save() {
    // drop links left completely empty
    content.sections.forEach(function (s) { s.cards = (s.cards || []).filter(function (c) { return c.title || c.url || c.image; }); });
    var bad = [];
    content.sections.forEach(function (s) { s.cards.forEach(function (c) { if (!c.title) bad.push(c.url || 'a link'); }); });
    if (bad.length) { say('Every link needs a title (missing for ' + bad[0] + ').', true); return; }
    api('PUT', 'hub', { content: content }).then(function () { dirty = false; drawContent(); say('Saved. The home page shows it now.'); })
      .catch(function (e) { say(e.message, true); });
  }

  // ------------------------------------------------------------------ sessions
  var sbox = document.getElementById('tab-sessions'), timer = null, autoLeft = 20;
  function loadSessions(auto) {
    clearTimeout(timer);
    if (auto !== true) autoLeft = 20;
    api('GET', 'sessions').then(function (list) {
      sbox.innerHTML = '<div class="row"><span class="muted grow">' + list.length + ' signed in · sessions end 6 hours after signing in</span>' +
        '<button type="button" class="small refresh">Refresh</button><button type="button" class="small danger all">Sign out everyone else</button></div>' +
        '<div class="tablewrap"><table><thead><tr><th>Account</th><th>Signed in</th><th>Time left</th><th>Device</th><th>Where</th><th></th></tr></thead><tbody>' +
        list.map(function (s) {
          return '<tr><td>' + esc(s.account) + '</td><td>' + when(s.created) + '</td><td>' + left(s.expires) + '</td><td>' + esc(device(s.device)) +
            '</td><td>' + esc([s.country, s.ip].filter(Boolean).join(' · ')) + '</td><td>' +
            (s.current ? '<span class="muted">This browser</span>' : '<button type="button" class="small danger end" data-t="' + esc(s.id) + '">Sign out</button>') + '</td></tr>';
        }).join('') + '</tbody></table></div>';
      sbox.querySelector('.refresh').addEventListener('click', loadSessions);
      sbox.querySelector('.all').addEventListener('click', function () {
        if (confirm('Sign out everyone except you?')) api('POST', 'sessions/end', { everyoneElse: true }).then(function (d) { say(d.ended + ' signed out.'); loadSessions(); });
      });
      Array.prototype.forEach.call(sbox.querySelectorAll('.end'), function (b) {
        b.addEventListener('click', function () {
          api('POST', 'sessions/end', { id: b.getAttribute('data-t') }).then(function () { say('Signed out.'); loadSessions(); }).catch(function (e) { say(e.message, true); });
        });
      });
      // keep the list current while it's on screen (a limited number of times: Cloudflare's free plan allows 1,000 lookups a day)
      timer = setTimeout(function () {
        if (!sbox.hidden && !document.hidden && autoLeft-- > 0) loadSessions(true);
      }, 60000);
    }).catch(function (e) { say(e.message, true); });
  }

  // ------------------------------------------------------------------ maintenance
  var mbox = document.getElementById('tab-maintenance');
  function loadMaintenance() {
    api('GET', 'maintenance').then(drawMaintenance).catch(function (e) { say(e.message, true); });
  }
  // one-click switch in the header, on every tab (admins keep using the site while it's on)
  var quick = document.querySelector('.quick-maint');
  function drawQuick(m) {
    quick.hidden = false;
    quick.classList.toggle('on', m.on);
    quick.disabled = m.byUpdate && !m.byAdmin;
    quick.textContent = m.on ? 'Maintenance mode: ON' + (m.byAdmin && m.until ? ' until ' + new Date(m.until).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '') : 'Maintenance mode: off';
    clearTimeout(quick.t);
    if (m.byAdmin && m.until) quick.t = setTimeout(function () { api('GET', 'maintenance').then(function (s) { drawQuick(s); if (!mbox.hidden) drawMaintenance(s); }); }, Math.max(1000, m.until - Date.now() + 1500));
    quick.title = quick.disabled ? 'Switched on by an update being deployed; it turns off when the update is finished'
      : m.on ? 'Click to open the site to everyone again' : 'Click to show everyone except admins the maintenance page';
    quick.onclick = function () {
      if (!m.byAdmin && !confirm('Put the site into maintenance mode? Everyone except admins will see the maintenance page; you can still use the site.')) return;
      api('PUT', 'maintenance', { on: !m.byAdmin, message: m.message || '' }).then(function (s) {
        drawQuick(s); if (!mbox.hidden) drawMaintenance(s);
        say(s.on ? 'Maintenance mode is on. You can still use the site as normal.' : 'Maintenance mode is off. The site is open to everyone.');
      }).catch(function (e) { say(e.message, true); });
    };
  }
  api('GET', 'maintenance').then(drawQuick).catch(function () {});

  function drawMaintenance(m) {
    drawQuick(m);
    mbox.innerHTML = '<div class="box">' +
      '<div class="row"><b class="grow">Maintenance mode is ' + (m.on ? 'ON' : 'off') + '</b>' +
      '<button type="button" class="' + (m.byAdmin ? 'small' : 'btn-main') + ' flip">' + (m.byAdmin ? 'Turn off' : 'Turn on') + '</button></div>' +
      '<p class="muted">While it\'s on, everyone except admins sees a "Down for maintenance" page, and that page reloads by itself when the site is back. ' +
      'Admins can still sign in (the page has an "Admin sign-in" link) and use the site as normal.</p>' +
      (m.byUpdate ? '<p class="muted"><b>An update is being deployed</b> and has switched maintenance on by itself. It turns off when the update is finished.</p>' : '') +
      '<label class="lbl">Message on the maintenance page (optional)<input type="text" class="msg" maxlength="300" placeholder="e.g. Adding the 2026 papers. Back by 6pm." value="' + esc(m.message || '') + '"></label>' +
      (m.byAdmin && m.until ? '<p class="muted"><b>Reopens by itself at ' + new Date(m.until).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) + '</b>, when the countdown ends.</p>' : '') +
      '<label class="lbl">Countdown in minutes (optional): the site reopens by itself when it ends<input type="text" inputmode="numeric" class="mins" placeholder="e.g. 10" value="' +
      (m.until && m.until > Date.now() ? Math.ceil((m.until - Date.now()) / 60000) : '') + '"></label>' +
      '<div class="row"><button type="button" class="small savemsg">Save message and countdown</button>' +
      '<a class="small btn-quiet" href="/" target="_blank" rel="noopener">See the site</a></div></div>';
    var msg = mbox.querySelector('.msg');
    function put(on) {
      return api('PUT', 'maintenance', { on: on, message: msg.value, minutes: parseInt(mbox.querySelector('.mins').value, 10) || 0 }).then(function (s) { drawMaintenance(s); say(s.on ? 'Maintenance mode is on.' : 'Maintenance mode is off.'); })
        .catch(function (e) { say(e.message, true); });
    }
    mbox.querySelector('.flip').addEventListener('click', function () {
      if (!m.byAdmin && !confirm('Turn maintenance mode on? Everyone except admins will see the maintenance page.')) return;
      put(!m.byAdmin);
    });
    mbox.querySelector('.savemsg').addEventListener('click', function () { put(m.byAdmin); });
  }

  // ------------------------------------------------------------------ accounts
  var abox = document.getElementById('tab-accounts');
  function loadAccounts() {
    api('GET', 'accounts').then(function (list) {
      abox.innerHTML = '<div class="tablewrap"><table><thead><tr><th>Account</th><th>Role</th><th>Signed in now</th><th></th></tr></thead><tbody>' +
        list.map(function (a) {
          return '<tr data-id="' + esc(a.id) + '"><td>' + esc(a.username) + (a.you ? ' <span class="muted">(you)</span>' : '') + '</td>' +
            '<td><select class="role"' + (a.you ? ' disabled' : '') + '><option value="user"' + (a.role === 'user' ? ' selected' : '') + '>Standard</option>' +
            '<option value="admin"' + (a.role === 'admin' ? ' selected' : '') + '>Admin</option></select></td><td>' + a.signedIn + '</td><td><div class="row">' +
            '<button type="button" class="small pw">Change password</button><button type="button" class="small rename">Rename</button>' +
            '<button type="button" class="small out"' + (a.signedIn ? '' : ' disabled') + '>Sign out everywhere</button>' +
            (a.you ? '' : '<button type="button" class="small danger del">Delete</button>') + '</div></td></tr>';
        }).join('') + '</tbody></table></div>' +
        '<h2>Add an account</h2><div class="box"><div class="row"><input type="text" class="nu grow" placeholder="Username" autocomplete="off">' +
        '<input type="password" class="np grow" placeholder="Password" autocomplete="new-password"><select class="nr"><option value="user">Standard</option>' +
        '<option value="admin">Admin</option></select><button type="button" class="btn-main add">Add</button></div>' +
        '<p class="muted">Standard accounts can use the whole site. Admin accounts also get this console.</p></div>';
      Array.prototype.forEach.call(abox.querySelectorAll('tr[data-id]'), function (tr) {
        var id = tr.getAttribute('data-id'), a = list.filter(function (x) { return x.id === id; })[0];
        function patch(body, msg) { return api('PATCH', 'accounts/' + id, body).then(function () { say(msg); loadAccounts(); }).catch(function (e) { say(e.message, true); loadAccounts(); }); }
        tr.querySelector('.role').addEventListener('change', function (e) { patch({ role: e.target.value }, 'Role changed; that account was signed out.'); });
        tr.querySelector('.pw').addEventListener('click', function () {
          ask('New password for ' + a.username + ':', '', 'password').then(function (v) {
            if (v) patch({ password: v }, 'Password changed' + (a.you ? '.' : '; that account was signed out.'));
          });
        });
        tr.querySelector('.rename').addEventListener('click', function () {
          ask('New username for ' + a.username + ':', a.username).then(function (v) { if (v && v.trim()) patch({ username: v.trim() }, 'Renamed.'); });
        });
        tr.querySelector('.out').addEventListener('click', function () {
          api('POST', 'sessions/end', { accountId: id }).then(function (d) { say(d.ended + ' session(s) signed out.'); loadAccounts(); });
        });
        var del = tr.querySelector('.del');
        if (del) del.addEventListener('click', function () {
          if (confirm('Delete the account ' + a.label + '? Anyone using it is signed out.'))
            api('DELETE', 'accounts/' + id).then(function () { say('Deleted.'); loadAccounts(); }).catch(function (e) { say(e.message, true); });
        });
      });
      abox.querySelector('.add').addEventListener('click', function () {
        var u = abox.querySelector('.nu').value.trim(), p = abox.querySelector('.np').value, r = abox.querySelector('.nr').value;
        api('POST', 'accounts', { username: u, password: p, role: r }).then(function () { say('Account added.'); loadAccounts(); }).catch(function (e) { say(e.message, true); });
      });
    }).catch(function (e) { say(e.message, true); });
  }

  loadContent();
  // /admin#maintenance (from the banner on the home page) opens that tab
  if (location.hash === '#maintenance') show('maintenance');
})();
