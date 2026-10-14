/* A message from the admin console for your account: the main site's middleware adds this script to your pages (the
   main site's and the subject sites') while one is waiting. It's shown once; pressing OK marks it read on every device. */
(function () {
  'use strict';
  if (window.JBR_NOTE) return;
  window.JBR_NOTE = true;
  var CSS = '' +
    '.jbr-note-bg{position:fixed;inset:0;z-index:2147483000;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;padding:16px}' +
    '.jbr-note{background:#fff;color:#1f1d1a;max-width:460px;width:100%;border-radius:14px;padding:22px 22px 18px;box-shadow:0 12px 40px rgba(0,0,0,.25);font:16px/1.5 Inter,system-ui,sans-serif}' +
    '.jbr-note h2{margin:0 0 8px;font-size:18px}' +
    '.jbr-note p{margin:0 0 18px;white-space:pre-wrap;overflow-wrap:anywhere;max-height:60vh;overflow:auto}' +
    '.jbr-note button{font:inherit;font-weight:600;border:0;border-radius:10px;padding:9px 22px;background:#1f1d1a;color:#fff;cursor:pointer;float:right}' +
    '@media (prefers-color-scheme:dark){.jbr-note{background:#262422;color:#eeeae4}.jbr-note button{background:#eeeae4;color:#1f1d1a}}';

  fetch('/api/note', { credentials: 'same-origin' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (n) {
    if (!n || !n.text) return;
    var st = document.createElement('style');
    st.textContent = CSS;
    document.head.appendChild(st);
    var bg = document.createElement('div');
    bg.className = 'jbr-note-bg';
    bg.innerHTML = '<div class="jbr-note" role="dialog" aria-modal="true" aria-labelledby="jbr-note-h"><h2 id="jbr-note-h">A message for you</h2><p></p><button type="button">OK</button></div>';
    bg.querySelector('p').textContent = n.text;
    var ok = bg.querySelector('button');
    ok.addEventListener('click', function () {
      bg.remove();
      fetch('/api/note', { method: 'POST', credentials: 'same-origin' }).catch(function () {});
    });
    document.body.appendChild(bg);
    ok.focus();
  }, function () {});
})();
