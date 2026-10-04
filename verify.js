/* Your email address: add or change it by typing in the 6-digit code emailed to it (/api/email/*). New accounts are
   sent here until they've done it; everyone else comes from the menu under their name or the reminder on the home page. */
(function () {
  'use strict';
  var form = document.querySelector('form'), sub = document.querySelector('.login-sub'), text = document.querySelector('.verify-text');
  var fEmail = document.querySelector('.v-email'), fCode = document.querySelector('.v-code'), err = document.querySelector('.login-error');
  var btn = form.querySelector('button'), links = document.querySelector('.verify-links');
  var next = new URLSearchParams(location.search).get('next') || '/';
  if (!/^\/(?!\/)/.test(next) || /^\/verify/.test(next)) next = '/';
  var st = {}, step = null, timer = null, lastEmail = '';

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
  }
  function api(method, path, body) {
    return fetch('/api/email/' + path, { method: method, credentials: 'same-origin', headers: body ? { 'content-type': 'application/json' } : {},
      body: body ? JSON.stringify(body) : undefined })
      .then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (d) {
          if (r.status === 401) { location.replace('/login'); throw new Error('Signed out.'); }
          if (!r.ok) throw new Error(d.error || 'Something went wrong. Try again.');
          return d;
        });
      });
  }
  function show(o) {
    clearInterval(timer);
    sub.textContent = o.sub;
    text.hidden = !o.text; text.innerHTML = o.text || '';
    fEmail.hidden = !o.email; fCode.hidden = !o.code;
    btn.hidden = !o.button; btn.textContent = o.button || ''; btn.disabled = false;
    links.hidden = !o.links; links.innerHTML = o.links || '';
    err.textContent = '';
  }
  // new accounts can only leave by logging out; everyone else can come back later
  function leave() {
    return st.mustVerify ? '<a href="#" data-do="logout">Log out</a>' : '<a href="' + esc(next) + '">' + (st.verified ? 'Back to the site' : 'Not now') + '</a>';
  }

  function askEmail() {
    step = 'email';
    show({ sub: st.verified ? 'Change your email address' : 'Add your email address',
      text: st.mustVerify ? "New accounts need an email address that's theirs, so you can reset your password if you ever forget it. We'll send it a 6-digit code."
        : "So you can reset your password if you ever forget it. We'll send it a 6-digit code to check it's yours.",
      email: true, button: 'Send code',
      links: (st.verified ? '<a href="#" data-do="keep">Keep ' + esc(st.email) + '</a> · ' : '') + leave() });
    if (!form.email.value && st.email && !st.verified) form.email.value = st.email;
    form.email.focus();
  }
  function askCode(to, at) {
    step = 'code';
    show({ sub: 'Check your email', text: 'We sent a 6-digit code to <b>' + esc(to) + "</b>. It works for 15 minutes. If it isn't there, look in Spam.",
      code: true, button: 'Check code',
      links: '<a href="#" data-do="resend">Send a new code</a> · <a href="#" data-do="other">Use a different email</a> · ' + leave() });
    form.code.value = '';
    form.code.focus();
    // "Send a new code" waits 30 seconds after the last one
    var a = links.querySelector('[data-do="resend"]');
    function tick() {
      var left = Math.ceil((at + 30000 - Date.now()) / 1000);
      a.classList.toggle('wait', left > 0);
      a.textContent = left > 0 ? 'Send a new code (' + left + ' s)' : 'Send a new code';
      if (left <= 0) clearInterval(timer);
    }
    tick(); timer = setInterval(tick, 1000);
  }
  function showChecked(email, leaving) {
    step = 'done';
    show({ sub: leaving ? 'Email checked' : 'Your email address',
      text: '<b>' + esc(email) + '</b> <span class="em-ok">✓ checked</span><br>' +
        (leaving ? 'Taking you back…' : 'You can use it to reset your password from the sign-in page.'),
      links: leaving ? '' : '<a href="#" data-do="other">Change it</a> · <a href="' + esc(next) + '">Back to the site</a>' });
  }

  function send(email) {
    btn.disabled = true; btn.textContent = 'Sending…';
    return api('POST', 'send', { email: email }).then(function (d) { lastEmail = email; askCode(d.to, Date.now()); })
      .catch(function (e2) { err.textContent = e2.message; btn.disabled = false; btn.textContent = step === 'code' ? 'Check code' : 'Send code'; });
  }
  function check() {
    var code = form.code.value.replace(/\D/g, '');
    if (code.length !== 6) { err.textContent = 'Type the 6 digits from the email.'; return; }
    btn.disabled = true; btn.textContent = 'Checking…';
    api('POST', 'verify', { code: code }).then(function (d) {
      st.email = d.email; st.verified = true; st.mustVerify = false;
      showChecked(d.email, true);
      setTimeout(function () { location.replace(next); }, 1200);
    }).catch(function (e2) { err.textContent = e2.message; btn.disabled = false; btn.textContent = 'Check code'; form.code.select(); });
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    err.textContent = '';
    if (step === 'email') {
      var email = form.email.value.trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) { err.textContent = "That doesn't look like an email address."; return; }
      send(email);
    } else if (step === 'code') check();
  });
  // six digits typed (or pasted from the email): check straight away
  form.code.addEventListener('input', function () { if (step === 'code' && !btn.disabled && form.code.value.replace(/\D/g, '').length === 6) check(); });

  links.addEventListener('click', function (e) {
    var a = e.target.closest('[data-do]');
    if (!a) return;
    e.preventDefault();
    var act = a.getAttribute('data-do');
    if (act === 'logout') fetch('/api/logout', { method: 'POST', credentials: 'same-origin' }).then(function () { location.replace('/login'); });
    else if (act === 'other') { form.email.value = ''; askEmail(); }
    else if (act === 'keep') showChecked(st.email);
    else if (act === 'resend' && !a.classList.contains('wait')) {
      if (lastEmail) send(lastEmail);
      else askEmail();
    }
  });

  api('GET', 'status').then(function (d) {
    st = d;
    if (!d.canSend) {
      show({ sub: 'Your email address', text: "Emails aren't set up on this site yet, so there's nothing to do here for now.",
        links: '<a href="' + esc(next) + '">Back to the site</a>' });
      return;
    }
    if (d.verified && !d.mustVerify) return showChecked(d.email);
    if (d.sent) { lastEmail = d.sent.email; return askCode(d.sent.to, d.sent.at); }
    askEmail();
  }).catch(function (e) { show({ sub: 'Your email address', text: esc(e.message) }); });
})();
