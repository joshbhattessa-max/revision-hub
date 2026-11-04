/* MTS Resources (/mts): school papers for the accounts the admin lets in (functions/api/mts/, functions/_lib/mts.js).
   No access yet: a button to ask for it. Asked: waiting for the admin. Approved: type your own password to open it
   (once per sign-in). Open: the subjects. */
(function () {
  'use strict';
  var app = document.getElementById('app');

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
  }
  function api(method, url, body) {
    return fetch(url, { method: method, credentials: 'same-origin', cache: 'no-store', headers: body ? { 'content-type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined })
      .then(function (r) {
        if (r.status === 401 && url === '/api/mts') { location.replace('/login?next=/mts'); throw new Error('Signed out'); }
        return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok) throw new Error(j.error || 'Something went wrong. Try again.'); return j; });
      });
  }
  function row(title, text, control) {
    return '<div class="set-row"><div class="set-what"><b>' + title + '</b>' + (text ? '<p>' + text + '</p>' : '') + '</div><div class="set-ctl">' + control + '</div></div>';
  }
  function page(body, sub) {
    app.innerHTML = '<div class="wrap pl set"><header class="top"><div class="brand"><div><a class="pl-back" href="/">← All subjects</a><h1>MTS Resources</h1>' +
      '<p class="subtitle">' + sub + '</p></div></div></header>' + body + '</div>';
  }

  function draw(st) {
    document.title = 'MTS Resources · JB Revision';
    if (st.state === 'none') {
      page('<section class="set-sec"><h2>Access</h2>' + row('Ask for access', 'Each request is checked by hand. Once yours is approved, MTS Resources appears in your top bar.',
        '<button type="button" class="set-btn" data-act="ask">Request access</button>') + '</section>', 'Questions from MTS school papers.');
    } else if (st.state === 'pending') {
      page('<section class="set-sec"><h2>Access</h2>' + row('Request sent', 'Waiting for approval' + (st.asked ? ' (asked ' + esc(new Date(st.asked).toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })) + ')' : '') +
        '. Once it\'s approved, MTS Resources appears in your top bar.', '') + '</section>', 'Questions from MTS school papers.');
    } else if (!st.open) {
      page('<section class="set-sec"><h2>Enter your password</h2><div class="set-row set-col"><div class="set-what"><b>Your account password</b><p>You have access. Type the password you sign in with to open MTS Resources. You\'ll be asked again next time you sign in.</p></div>' +
        '<form class="mts-pw" novalidate><input type="password" name="password" autocomplete="current-password" aria-label="Password"><button type="submit" class="set-btn">Open</button></form><p class="mts-err" role="alert"></p></div></section>',
        'Questions from MTS school papers.');
      app.querySelector('.mts-pw input').focus();
    } else {
      return api('GET', '/api/mts/content').then(drawOpen, fail);
    }
    bind();
  }

  function drawOpen(c) {
    var subs = c.subjects || [];
    page('<section class="set-sec"><h2>Subjects</h2>' + (subs.length
      ? '<div class="mts-subjects">' + subs.map(function (s) { return '<a class="set-btn" href="' + esc(s.href) + '">' + esc(s.name) + '</a>'; }).join('') + '</div>'
      : '<div class="mts-empty">School papers are being added. Each subject will show here, with its own question search and mock paper builder.</div>') + '</section>',
      'Questions from MTS school papers.');
  }

  function bind() {
    var ask = app.querySelector('[data-act="ask"]');
    if (ask) ask.addEventListener('click', function () {
      ask.disabled = true;
      api('POST', '/api/mts/request').then(load, function (e) { ask.disabled = false; alert(e.message); });
    });
    var f = app.querySelector('.mts-pw');
    if (f) f.addEventListener('submit', function (e) {
      e.preventDefault();
      var btn = f.querySelector('button'), err = app.querySelector('.mts-err'), pw = f.password.value;
      if (!pw) { err.textContent = 'Type your password.'; return; }
      btn.disabled = true; err.textContent = '';
      api('POST', '/api/mts/unlock', { password: pw }).then(load, function (x) { btn.disabled = false; err.textContent = x.message; f.password.select(); });
    });
  }

  function fail(e) { page('<section class="set-sec"><div class="mts-empty">' + esc(e.message) + '</div></section>', ''); }
  function load() { return api('GET', '/api/mts').then(draw, fail); }
  load();
})();
