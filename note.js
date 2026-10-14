/* A message from the admin console for your account: the main site's middleware adds this script to your pages (the
   main site's and the subject sites') while one is waiting. It's shown once; pressing OK marks it read on every device. */
(function () {
  'use strict';
  if (window.JBR_NOTE) return;
  window.JBR_NOTE = true;
  var CSS = '' +
    '.jbr-note-bg{position:fixed;inset:0;z-index:2147483000;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;padding:16px}' +
    '.jbr-note{background:#fff;color:#1f1d1a;max-width:480px;width:100%;max-height:calc(100vh - 32px);overflow:auto;box-sizing:border-box;border-radius:14px;padding:22px 22px 18px;box-shadow:0 12px 40px rgba(0,0,0,.25);font:16px/1.5 Inter,system-ui,sans-serif;text-align:left}' +
    '.jbr-note .jbr-note-logo{display:block;width:56px;height:56px;margin:0 auto 10px}' +
    '.jbr-note h2{margin:0 0 10px;font-size:20px;line-height:1.3}' +
    '.jbr-note-body{margin:0 0 18px;overflow-wrap:anywhere}' +
    '.jbr-note-body.plain{white-space:pre-wrap}' +
    '.jbr-note-body h2,.jbr-note-body h3{margin:12px 0 6px;line-height:1.3}.jbr-note-body p{margin:0 0 8px}.jbr-note-body ul,.jbr-note-body ol{margin:0 0 8px;padding-left:22px}' +
    '.jbr-note-body a{color:inherit;text-decoration:underline}' +
    '.jbr-note button{font:inherit;font-weight:600;border:0;border-radius:10px;padding:9px 22px;background:#1f1d1a;color:#fff;cursor:pointer;display:block;margin-left:auto}' +
    '@media (prefers-color-scheme:dark){.jbr-note{background:#262422;color:#eeeae4}.jbr-note button{background:#eeeae4;color:#1f1d1a}}';

  fetch('/api/note', { credentials: 'same-origin' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (n) {
    if (!n || !(n.title || n.html || n.text)) return;
    var st = document.createElement('style');
    st.textContent = CSS;
    document.head.appendChild(st);
    var bg = document.createElement('div');
    bg.className = 'jbr-note-bg';
    bg.innerHTML = '<div class="jbr-note" role="dialog" aria-modal="true" aria-label="A message for you">' +
      (n.logo ? '<img class="jbr-note-logo" src="/favicon.svg" alt="JB Revision">' : '') +
      (n.title ? '<h2></h2>' : '') + '<div class="jbr-note-body"></div><button type="button">OK</button></div>';
    if (n.title) bg.querySelector('h2').textContent = n.title;
    // (the message's formatting was cleaned to a short list of safe tags when it was saved: functions/_lib/richtext.js)
    var body = bg.querySelector('.jbr-note-body');
    if (n.html) body.innerHTML = n.html;
    else { body.className += ' plain'; body.textContent = n.text || ''; }
    var ok = bg.querySelector('button');
    ok.addEventListener('click', function () {
      bg.remove();
      fetch('/api/note', { method: 'POST', credentials: 'same-origin' }).catch(function () {});
    });
    document.body.appendChild(bg);
    ok.focus();
  }, function () {});
})();
