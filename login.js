/* Sign in (POST /api/login), create an account (POST /api/signup) or reset a forgotten password (POST /api/reset), then
   back to the page that asked for it. New accounts give an email address; once the site can send emails they go on to
   /verify to type in the code sent to it. "Forgot your password?" only shows when emails can be sent (/api/status). */
(function () {
  'use strict';
  var form = document.querySelector('form'), err = document.querySelector('.login-error'), btn = form.querySelector('button');
  var sub = document.querySelector('.login-sub'), sw = document.querySelector('.login-switch'), hint = document.querySelector('.login-hint');
  var forgot = document.querySelector('.login-forgot'), canReset = false;
  var F = {};
  ['user', 'email', 'pass', 'code', 'acct', 'new', 'again'].forEach(function (k) { F[k] = form.querySelector('.f-' + k); });
  var MODES = {
    signin: { title: 'Sign in', button: 'Sign in', busy: 'Signing in…', ask: 'New here?', link: 'Create an account', href: '#signup',
      fields: ['user', 'pass'] },
    signup: { title: 'Create an account', button: 'Create account', busy: 'Creating…', ask: 'Already have an account?', link: 'Sign in', href: '#',
      fields: ['user', 'email', 'pass'] },
    forgot: { title: 'Reset your password', button: 'Send code', busy: 'Sending…', ask: 'Remembered it?', link: 'Sign in', href: '#',
      fields: ['email'] }
  };
  var name, mode, reset = {};  // reset: {email, token, accounts} as "Forgot your password?" goes along

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
  }
  function fields(list) { Object.keys(F).forEach(function (k) { F[k].hidden = list.indexOf(k) < 0; }); }
  function say(text) { hint.hidden = !text; hint.textContent = text || ''; }
  function busy(on, label) { btn.disabled = on; btn.textContent = label; }

  function setMode(m, message) {
    name = m; mode = MODES[m]; reset = {};
    sub.textContent = mode.title;
    busy(false, mode.button);
    sw.querySelector('span').textContent = mode.ask;
    var a = sw.querySelector('a'); a.textContent = mode.link; a.setAttribute('href', mode.href);
    fields(mode.fields);
    form.password.setAttribute('autocomplete', m === 'signup' ? 'new-password' : 'current-password');
    form.password.placeholder = m === 'signup' ? 'At least 6 characters' : '';
    form.querySelector('.login-agree').hidden = m !== 'signup';
    forgot.hidden = m !== 'signin' || !canReset;
    say(message || (m === 'forgot' ? "Type the email address on your account and we'll send it a code." :
      m === 'signup' && canReset ? "We'll email you a 6-digit code to check the address is yours." : ''));
    document.title = m === 'signup' ? 'Create an account · JB Revision' : m === 'forgot' ? 'Reset your password · JB Revision'
      : 'JB Revision · GCSE and IGCSE past-paper questions';
    err.textContent = '';
    (m === 'forgot' ? form.email : form.username).focus();
  }
  function fromHash() { setMode(location.hash === '#signup' ? 'signup' : location.hash === '#forgot' && canReset ? 'forgot' : 'signin'); }
  window.addEventListener('hashchange', fromHash);
  fromHash();
  fetch('/api/status', { credentials: 'same-origin' }).then(function (r) { return r.json(); }).then(function (s) {
    canReset = !!s.email;
    if (canReset && (location.hash === '#forgot' || name === 'signup')) fromHash();
    else if (name === 'signin') forgot.hidden = !canReset;
  }).catch(function () { /* offline: no "Forgot your password?" */ });

  function post(url, body) {
    return fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify(body) })
      .then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (d) {
          if (!r.ok) throw new Error(d.error || 'Something went wrong. Try again.');
          return d;
        });
      });
  }
  var looksLikeEmail = function (s) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s); };

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    err.textContent = '';
    if (name === 'forgot') { forgotStep(); return; }
    var signup = name === 'signup', m = mode;
    if (!form.username.value.trim() || !form.password.value) { err.textContent = 'Enter a username and password.'; return; }
    if (signup && !looksLikeEmail(form.email.value.trim())) { err.textContent = 'Enter your email address.'; return; }
    busy(true, m.busy);
    post(signup ? '/api/signup' : '/api/login', { username: form.username.value, password: form.password.value,
      email: signup ? form.email.value.trim() : undefined })
      .then(function (d) {
        var next = new URLSearchParams(location.search).get('next') || '/';
        if (!/^\/(?!\/)/.test(next)) next = '/';
        // a new account checks its email address first
        if (d.verify) { location.replace('/verify?next=' + encodeURIComponent(next)); return; }
        // the home page says hello once, just after signing in
        if (next === '/') try { sessionStorage.setItem('jbr-hello', '1'); } catch (e3) { /* storage blocked */ }
        location.replace(next);
      })
      .catch(function (e2) {
        err.textContent = e2.message || 'Something went wrong. Try again.';
        busy(false, m.button);
        form.password.value = ''; form.password.focus();
      });
  });

  // "Forgot your password?": email address -> code from the email -> new password
  function forgotStep() {
    if (!reset.email) {
      var email = form.email.value.trim();
      if (!looksLikeEmail(email)) { err.textContent = "That doesn't look like an email address."; return; }
      busy(true, 'Sending…');
      post('/api/reset', { step: 'send', email: email }).then(function (d) {
        reset.email = email;
        say(d.message + " It works for 15 minutes. If it isn't there, look in Spam.");
        fields(['code']);
        busy(false, 'Check code');
        form.code.value = ''; form.code.focus();
      }).catch(function (e2) { err.textContent = e2.message; busy(false, 'Send code'); });
    } else if (!reset.token) {
      var code = form.code.value.replace(/\D/g, '');
      if (code.length !== 6) { err.textContent = 'Type the 6 digits from the email.'; return; }
      busy(true, 'Checking…');
      post('/api/reset', { step: 'check', email: reset.email, code: code }).then(function (d) {
        reset.token = d.token;
        chooseNew(d.accounts, 'Code checked.');
      }).catch(function (e2) { err.textContent = e2.message; busy(false, 'Check code'); form.code.select(); });
    } else {
      if (form.newpass.value.length < 6) { err.textContent = 'Passwords need at least 6 characters.'; return; }
      if (form.newpass.value !== form.again.value) { err.textContent = "The passwords don't match."; return; }
      busy(true, 'Saving…');
      post('/api/reset', { step: 'set', token: reset.token, id: form.acct.value || reset.accounts[0].id, password: form.newpass.value })
        .then(function (d) {
          history.replaceState(null, '', location.pathname + location.search);
          setMode('signin', 'Password changed. Sign in with your new password.');
          form.username.value = d.username; form.password.value = ''; form.newpass.value = ''; form.again.value = '';
          form.password.focus();
        })
        .catch(function (e2) { err.textContent = e2.message; busy(false, 'Set new password'); });
    }
  }
  // the last step: pick the account (if the address has more than one) and type the new password twice
  function chooseNew(accounts, lead) {
    if (!accounts.length) { setMode('signin', 'No account uses that email address any more.'); return; }
    reset.accounts = accounts;
    form.acct.innerHTML = accounts.map(function (a) {
      return '<option value="' + esc(a.id) + '">' + esc(a.username) + (a.role === 'admin' ? ' (admin)' : '') + '</option>';
    }).join('');
    say(lead + ' Choose a new password' + (accounts.length > 1 ? ' for one of your accounts.' : ' for ' + accounts[0].username + '.'));
    fields(accounts.length > 1 ? ['acct', 'new', 'again'] : ['new', 'again']);
    busy(false, 'Set new password');
    form.newpass.focus();
  }
  // a one-time link from an email (…/login?reset=…) goes straight to choosing a new password
  var link = new URLSearchParams(location.search).get('reset') || '';
  if (/^[0-9a-f]{64}$/.test(link)) {
    history.replaceState(null, '', location.pathname);
    post('/api/reset', { step: 'peek', token: link }).then(function (d) {
      setMode('forgot');
      reset = { email: '-', token: link };
      chooseNew(d.accounts, 'Reset link checked.');
    }).catch(function (e2) { setMode('signin', e2.message); });
  }

  // six digits typed (or pasted from the email): check straight away
  form.code.addEventListener('input', function () {
    if (name === 'forgot' && reset.email && !reset.token && !btn.disabled && form.code.value.replace(/\D/g, '').length === 6) forgotStep();
  });
})();
