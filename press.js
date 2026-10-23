// Button feedback for every page of the hub and the subject sites it serves (added by functions/_middleware.js, and by
// admin.html). Every button dips when pressed. A button that starts a request (save, send, delete...) shows a spinner
// until the request ends, then a small tick (or a "!" if it failed) beside it, so it's clear the click did something.
(function () {
  if (window.__jbrPress) return;
  window.__jbrPress = 1;
  var css = 'button:not(:disabled),[role=button],input[type=button],input[type=submit],summary{transition:transform .08s ease,filter .12s ease,opacity .12s ease}' +
    'button:not(:disabled):active,[role=button]:active,input[type=button]:active,input[type=submit]:active,summary:active{transform:scale(.96);filter:brightness(.88)}' +
    '[data-busy]{position:relative;opacity:.7;cursor:progress!important;pointer-events:none}' +
    '[data-busy]::after{content:"";display:inline-block;width:.8em;height:.8em;margin-left:.5em;vertical-align:-.1em;border:2px solid currentColor;border-right-color:transparent;border-radius:50%;animation:jbr-spin .7s linear infinite}' +
    '.jbr-tick{position:absolute;z-index:2147483000;width:20px;height:20px;border-radius:50%;background:#1f8a4c;color:#fff;font:700 13px/20px system-ui,sans-serif;text-align:center;pointer-events:none;box-shadow:0 1px 4px rgba(0,0,0,.3);animation:jbr-pop 1.5s ease forwards}' +
    '.jbr-tick.bad{background:#c0392b}' +
    '@keyframes jbr-spin{to{transform:rotate(360deg)}}' +
    '@keyframes jbr-pop{0%{transform:scale(.3);opacity:0}15%{transform:scale(1.15);opacity:1}25%{transform:scale(1)}80%{opacity:1}100%{opacity:0}}' +
    '@media (prefers-reduced-motion:reduce){button,[role=button],summary{transition:none}[data-busy]::after,.jbr-tick{animation-duration:0s}.jbr-tick{opacity:1}}';
  var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

  var last = null;   // the button that was just clicked, and when
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('button,[role=button],input[type=button],input[type=submit]');
    if (b && !b.disabled && !b.hasAttribute('data-busy')) last = { el: b, t: Date.now(), n: 0, done: false };
  }, true);

  function tick(el, ok) {
    if (!el.isConnected) return;
    var r = el.getBoundingClientRect();
    var s = document.createElement('span');
    s.className = 'jbr-tick' + (ok ? '' : ' bad');
    s.textContent = ok ? '✓' : '!';
    s.setAttribute('aria-hidden', 'true');
    s.style.left = Math.max(2, r.right + window.scrollX - 12) + 'px';
    s.style.top = Math.max(2, r.top + window.scrollY - 8) + 'px';
    document.body.appendChild(s);
    setTimeout(function () { s.remove(); }, 1500);
  }
  function finish(rec) {
    if (rec.done || rec.n > 0) return;
    rec.done = true;
    rec.el.removeAttribute('data-busy'); rec.el.removeAttribute('aria-busy');
    tick(rec.el, !rec.bad);
  }

  var realFetch = window.fetch;
  if (!realFetch) return;
  window.fetch = function (input) {
    var url = typeof input === 'string' ? input : (input && input.url) || '';
    var rec = last;
    if (!rec || rec.done || Date.now() - rec.t > 600 || /\/api\/(activity|note)\b/.test(url) || !rec.el.isConnected) return realFetch.apply(this, arguments);
    rec.n++; rec.el.setAttribute('data-busy', ''); rec.el.setAttribute('aria-busy', 'true');
    var p = realFetch.apply(this, arguments);
    var end = function (bad) { if (bad) rec.bad = true; rec.n--; setTimeout(function () { finish(rec); }, 0); };
    p.then(function (r) { end(!r.ok); }, function () { end(true); });
    return p;
  };
})();
