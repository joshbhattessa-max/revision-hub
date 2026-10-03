/* Sign in (POST /api/login) or create an account (POST /api/signup), then back to the page that asked for it. */
(function () {
  'use strict';
  var form = document.querySelector('form'), err = document.querySelector('.login-error'), btn = form.querySelector('button');
  var sub = document.querySelector('.login-sub'), sw = document.querySelector('.login-switch');
  var MODES = {
    signin: { title: 'Sign in', button: 'Sign in', busy: 'Signing in…', url: '/api/login', ask: 'New here?', link: 'Create an account',
      href: '#signup', pw: 'current-password' },
    signup: { title: 'Create an account', button: 'Create account', busy: 'Creating…', url: '/api/signup', ask: 'Already have an account?',
      link: 'Sign in', href: '#', pw: 'new-password' }
  };
  var mode;

  function setMode(m) {
    mode = MODES[m];
    sub.textContent = mode.title;
    btn.textContent = mode.button;
    sw.querySelector('span').textContent = mode.ask;
    var a = sw.querySelector('a'); a.textContent = mode.link; a.setAttribute('href', mode.href);
    form.password.setAttribute('autocomplete', mode.pw);
    form.password.placeholder = m === 'signup' ? 'At least 6 characters' : '';
    document.title = mode.title + ' · Josh B Revision';
    err.textContent = '';
    form.username.focus();
  }
  function fromHash() { setMode(location.hash === '#signup' ? 'signup' : 'signin'); }
  window.addEventListener('hashchange', fromHash);
  fromHash();

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    err.textContent = '';
    if (!form.username.value.trim() || !form.password.value) { err.textContent = 'Enter a username and password.'; return; }
    var m = mode;
    btn.disabled = true; btn.textContent = m.busy;
    fetch(m.url, { method: 'POST', headers: { 'content-type': 'application/json' }, credentials: 'same-origin',
      body: JSON.stringify({ username: form.username.value, password: form.password.value }) })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { return { ok: r.ok, d: d }; }); })
      .then(function (res) {
        if (!res.ok) throw new Error(res.d.error || 'Something went wrong. Try again.');
        var next = new URLSearchParams(location.search).get('next') || '/';
        location.replace(/^\/(?!\/)/.test(next) ? next : '/');
      })
      .catch(function (e2) {
        err.textContent = e2.message || 'Something went wrong. Try again.';
        btn.disabled = false; btn.textContent = m.button;
        form.password.value = ''; form.password.focus();
      });
  });
})();
