/* Settings (/settings): your account (username, email, password), how the site looks (light/dark/device, Studio or
   Bubbly), study choices, and your data. Looks and study choices are kept with your account (functions/api/prefs.js)
   and copied into each browser by look.js, so they apply on every subject site and device. */
(function () {
  'use strict';
  var app = document.getElementById('app');

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
  }
  function api(method, url, body) {
    return fetch(url, { method: method, credentials: 'same-origin', cache: 'no-store', headers: body ? { 'content-type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined })
      .then(function (r) {
        if (r.status === 401) { location.replace('/login?next=/settings'); throw new Error('Signed out'); }
        return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok) throw new Error(j.error || 'Something went wrong. Try again.'); return j; });
      });
  }

  // a row: what it is on the left, the control on the right
  function row(title, text, control, id) {
    return '<div class="set-row"' + (id ? ' id="' + id + '"' : '') + '><div class="set-what"><b>' + title + '</b>' + (text ? '<p>' + text + '</p>' : '') + '</div><div class="set-ctl">' + control + '</div></div>';
  }
  // a choice of a few: Light · Dark · Device
  function seg(name, opts, on) {
    return '<div class="set-seg" role="radiogroup" data-name="' + name + '">' + opts.map(function (o) {
      return '<button type="button" role="radio" aria-checked="' + (o[0] === on) + '" data-v="' + o[0] + '">' + esc(o[1]) + '</button>';
    }).join('') + '</div>';
  }
  // the two looks, each drawn small in its own style
  function lookCard(v, name, text, on) {
    return '<button type="button" class="set-look set-look-' + v + '" role="radio" aria-checked="' + (v === on) + '" data-v="' + v + '">' +
      '<span class="set-pv" aria-hidden="true"><i></i><i></i><i></i></span><span class="set-ln"><b>' + name + '</b><span>' + text + '</span></span></button>';
  }

  var THEMES = [['light', 'Light'], ['dark', 'Dark'], ['device', 'Same as device']];
  var LANGS = [['cs', 'C#'], ['py', 'Python'], ['vb', 'VB.NET'], ['java', 'Java']];
  function theme() { return document.documentElement.getAttribute('data-theme') || 'device'; }
  function look() { return document.documentElement.getAttribute('data-look') === 'bold' ? 'bold' : 'soft'; }
  function lang() { try { return localStorage.getItem('jbr-cs-lang') || 'cs'; } catch (e) { return 'cs'; } }

  function render(me) {
    var key = !!me.viaKey, email = me.email
      ? esc(me.email) + ' <span class="set-tag' + (me.verified ? ' ok' : '') + '">' + (me.verified ? 'Checked' : 'Not checked') + '</span>'
      : 'None yet. Add one so you can reset your password if you forget it.';
    var h = '<div class="wrap pl set"><header class="top"><div class="brand"><div><a class="pl-back" href="/">← All subjects</a><h1>Settings</h1>' +
      '<p class="subtitle">Saved to your account, so they apply on every subject and every device you sign in on.</p></div></div></header>';

    h += '<section class="set-sec"><h2>Account</h2>' + (key
      ? row('Signed in with an access key', 'Sign in with a username and password to change account details.', '')
      : row('Username', 'What you sign in with, and the name the site greets you by.',
          '<form class="set-name" novalidate><input name="username" value="' + esc(me.username) + '" autocomplete="username" maxlength="30" aria-label="Username" spellcheck="false"><button type="submit" class="set-btn" disabled>Save</button></form>') +
        (me.canEmail ? row('Email', email, '<a class="set-btn" href="/verify?next=/settings">' + (me.email ? 'Change email' : 'Add email') + '</a>') : '') +
        row('Password', 'Changing it signs you out on your other devices.', '<button type="button" class="set-btn" data-act="password">Change password</button>')) +
      '</section>';

    h += '<section class="set-sec"><h2>Appearance</h2>' +
      row('Light or dark', 'Same as device follows your phone or computer setting.', seg('theme', THEMES, theme())) +
      '<div class="set-row set-col"><div class="set-what"><b>Style</b><p>The light/dark and look buttons at the top of each page change these too.</p></div>' +
      '<div class="set-looks" role="radiogroup" aria-label="Style">' + lookCard('soft', 'Studio', 'Clean and quiet, with thin lines.', look()) +
      lookCard('bold', 'Bubbly', 'Rounder and softer, with coloured cards.', look()) + '</div></div></section>';

    h += '<section class="set-sec"><h2>Study</h2>' +
      row('Programming language', 'For Computer Science: the questions, mocks and progress you see.', seg('csLang', LANGS, lang())) +
      '</section>';

    if (!key) h += '<section class="set-sec"><h2>Your data</h2>' +
      row('Download your data', 'Your account details, settings, every question you marked and every mock you handed in, as one file.', '<button type="button" class="set-btn" data-act="download">Download</button>') +
      row('Clear your progress', 'Removes every question you marked and every mock, on all subjects. Your account stays.', '<button type="button" class="set-btn warn" data-act="clear">Clear progress</button>') +
      '</section>' +
      '<section class="set-sec"><h2>Signing in</h2>' +
      row('Other devices', 'Signs you out everywhere except here.', '<button type="button" class="set-btn" data-act="others">Sign out other devices</button>') +
      row('Log out', 'Sign out on this device.', '<button type="button" class="set-btn" data-act="logout">Log out</button>') +
      row('Delete your account', "Removes your account and everything saved with it. This can't be undone.", '<button type="button" class="set-btn danger" data-act="delete">Delete account</button>') +
      '</section>';
    h += '</div>';
    app.innerHTML = h;
    wire(me);
  }

  function wire(me) {
    // light/dark, the programming language
    Array.prototype.forEach.call(app.querySelectorAll('.set-seg'), function (g) {
      g.addEventListener('click', function (e) {
        var b = e.target.closest('button'); if (!b) return;
        var p = {}; p[g.getAttribute('data-name')] = b.getAttribute('data-v');
        pick(g, b); keep(p);
      });
    });
    var looks = app.querySelector('.set-looks');
    looks.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      pick(looks, b); keep({ look: b.getAttribute('data-v') });
    });
    // the header buttons (or another tab) changed the theme or look: show it here
    new MutationObserver(function () {
      pick(app.querySelector('[data-name=theme]'), app.querySelector('[data-name=theme] [data-v=' + theme() + ']'));
      pick(looks, looks.querySelector('[data-v=' + look() + ']'));
    }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'data-look'] });

    var name = app.querySelector('.set-name');
    if (name) {
      var input = name.username, go = name.querySelector('button');
      input.addEventListener('input', function () { go.disabled = input.value.trim() === me.username || !input.value.trim(); });
      name.addEventListener('submit', function (e) {
        e.preventDefault();
        if (go.disabled) return;
        go.disabled = true;
        api('PATCH', '/api/account', { username: input.value.trim() }).then(function (j) {
          me.username = input.value = j.username; toast('Username changed. Sign in with ' + j.username + ' from now on.');
        }).catch(function (er) { toast(er.message, true); go.disabled = false; });
      });
    }
    Array.prototype.forEach.call(app.querySelectorAll('[data-act]'), function (b) {
      b.addEventListener('click', function () { ACTS[b.getAttribute('data-act')](b); });
    });
  }

  function pick(group, btn) {
    if (!group || !btn) return;
    Array.prototype.forEach.call(group.querySelectorAll('[role=radio]'), function (x) { x.setAttribute('aria-checked', x === btn ? 'true' : 'false'); });
  }
  function keep(p) {
    var P = window.JBR_PREFS;   // look.js (loaded after this script)
    if (!P) return;
    P.save(p).then(function (j) { if (j) toast('Saved'); else toast("Couldn't save to your account. It's set on this device.", true); });
  }

  var ACTS = {
    password: function () {
      dialog({ title: 'Change password', button: 'Change password', method: 'POST',
        fields: [['current', 'Current password', 'current-password'], ['password', 'New password', 'new-password'], ['again', 'New password again', 'new-password']],
        check: function (v) {
          if (!v.current || !v.password) return 'Fill in every box.';
          if (v.password.length < 6) return 'New passwords need at least 6 characters.';
          if (v.password !== v.again) return "The new passwords don't match.";
        },
        body: function (v) { return { current: v.current, password: v.password }; },
        done: function (d) { d.close(); toast('Password changed.'); } });
    },
    clear: function () {
      dialog({ title: 'Clear your progress?', button: 'Clear progress', method: 'PATCH', danger: true,
        text: "Every question you marked and every mock you handed in or started goes, on every subject and device. This can't be undone. Type your password to confirm.",
        fields: [['password', 'Password', 'current-password']],
        check: function (v) { if (!v.password) return 'Type your password to confirm.'; },
        body: function (v) { return { clearProgress: true, password: v.password }; },
        // reload so this browser's copy is cleared too (the page's first script drops everything older than the wipe)
        done: function () { location.reload(); } });
    },
    delete: function () {
      dialog({ title: 'Delete your account?', button: 'Delete my account', method: 'DELETE', danger: true,
        text: "This can't be undone. You'll be signed out on every device. Type your password to confirm.",
        fields: [['password', 'Password', 'current-password']],
        check: function (v) { if (!v.password) return 'Type your password to confirm.'; },
        body: function (v) { return { password: v.password }; },
        done: function () { location.replace('/login'); } });
    },
    others: function (b) {
      b.disabled = true;
      api('PATCH', '/api/account', { signOutOthers: true }).then(function (j) {
        toast(j.signedOut ? 'Signed out on ' + j.signedOut + ' other ' + (j.signedOut === 1 ? 'device.' : 'devices.') : 'You weren\'t signed in anywhere else.');
        b.disabled = false;
      }).catch(function (er) { toast(er.message, true); b.disabled = false; });
    },
    logout: function () { api('POST', '/api/logout').then(function () { location.replace('/login'); }, function () { location.replace('/login'); }); },
    download: function () {
      Promise.all([api('GET', '/api/account'), api('GET', '/api/prefs')]).then(function (r) {
        var S = window.JBR_PROGRESS;
        var out = { from: 'jbrevision.co.uk', saved: new Date().toISOString(), account: r[0], settings: r[1], progress: S ? S.get() : null };
        var a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([JSON.stringify(out, null, 2)], { type: 'application/json' }));
        a.download = 'jb-revision-' + String(r[0].username || 'data').replace(/[^\w.-]+/g, '-') + '.json';
        document.body.appendChild(a); a.click(); a.remove();
      }).catch(function (er) { toast(er.message, true); });
    }
  };

  // one small dialog for the forms that need your password; done() runs when the server says yes
  function dialog(o) {
    var d = document.createElement('dialog');
    d.className = 'acct-dlg';
    d.innerHTML = '<form method="dialog" novalidate><h3>' + esc(o.title) + '</h3>' + (o.text ? '<p>' + esc(o.text) + '</p>' : '') +
      o.fields.map(function (f) { return '<label>' + esc(f[1]) + '<input type="password" name="' + f[0] + '" autocomplete="' + f[2] + '" required></label>'; }).join('') +
      '<p class="acct-err" role="alert"></p><div class="acct-btns"><button type="button" class="acct-cancel">Cancel</button>' +
      '<button type="submit" class="acct-go' + (o.danger ? ' danger' : '') + '">' + esc(o.button) + '</button></div></form>';
    document.body.appendChild(d);
    var form = d.querySelector('form'), err = d.querySelector('.acct-err'), go = d.querySelector('.acct-go');
    d.querySelector('.acct-cancel').addEventListener('click', function () { d.close(); });
    d.addEventListener('close', function () { d.remove(); });
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      err.textContent = '';
      var v = {};
      o.fields.forEach(function (f) { v[f[0]] = form[f[0]].value; });
      var problem = o.check(v);
      if (problem) { err.textContent = problem; return; }
      go.disabled = true;
      api(o.method, '/api/account', o.body(v)).then(function (j) { o.done(d, j); }).catch(function (er) { err.textContent = er.message; go.disabled = false; });
    });
    d.showModal();
    form.querySelector('input').focus();
  }

  var toastAt = 0;
  function toast(text, bad) {
    var old = document.querySelector('.toast'); if (old) old.remove();
    var t = document.createElement('div'), mine = ++toastAt;
    t.className = 'toast' + (bad ? ' bad' : ''); t.setAttribute('role', 'status'); t.textContent = text;
    document.body.appendChild(t);
    setTimeout(function () { if (mine === toastAt) t.classList.add('out'); }, 2200);
    setTimeout(function () { t.remove(); }, 2700);
  }

  api('GET', '/api/account').then(render).catch(function (e) {
    if (e.message !== 'Signed out') app.innerHTML = '<p class="loading">Could not load your settings.</p>';
  });
})();
