/* The two links for changing an account's email address by email (/api/confirm): the first, opened from the current
   address, sends the second to the new address; the second makes the change. Nothing happens until the link is used. */
(function () {
  'use strict';
  var sub = document.querySelector('.login-sub'), text = document.querySelector('.verify-text');
  var t = new URLSearchParams(location.search).get('t') || '';
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  // the link is used up as soon as it's checked, so take it out of the address bar (and history)
  history.replaceState(null, '', location.pathname);
  fetch('/api/confirm', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ t: t }) })
    .then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { if (!r.ok) throw new Error(d.error || 'Something went wrong.'); return d; }); })
    .then(function (d) {
      if (d.stage === 'sent') {
        sub.textContent = 'Nearly done';
        text.innerHTML = 'We\'ve emailed a second link to <b>' + esc(d.to) + '</b>. Open it within the next hour to finish changing your address.';
      } else {
        sub.textContent = 'Email address changed';
        text.innerHTML = 'Your account now uses <b>' + esc(d.email) + '</b> <span class="em-ok">✓ checked</span>';
      }
    })
    .catch(function (e) { sub.textContent = 'That link didn\'t work'; text.textContent = e.message; });
})();
