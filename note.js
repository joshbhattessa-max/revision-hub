/* A message from the admin console for your account: the main site's middleware adds this script to your pages (the
   main site's and the subject sites') while one is waiting. It's shown once; pressing OK marks it read on every device.
   Update notes (Admin → updates) come the same way, after the message if there's one: all the unread ones in one box. */
(function () {
  'use strict';
  if (window.JBR_NOTE) return;
  window.JBR_NOTE = true;
  var CSS = '' +
    '.jbr-note-bg{position:fixed;inset:0;z-index:2147483000;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;padding:16px}' +
    '.jbr-note{background:#fff;color:#1f1d1a;max-width:480px;width:100%;max-height:calc(100vh - 32px);overflow:auto;box-sizing:border-box;border-radius:14px;padding:22px 22px 18px;box-shadow:0 12px 40px rgba(0,0,0,.25);font:16px/1.5 Figtree,system-ui,sans-serif;text-align:left}' +
    '.jbr-note .jbr-note-logo{display:block;width:56px;height:56px;margin:0 auto 10px}' +
    '.jbr-note h2{margin:0 0 10px;font-size:20px;line-height:1.3}' +
    '.jbr-note-body{margin:0 0 18px;overflow-wrap:anywhere}' +
    '.jbr-note-body.plain{white-space:pre-wrap}' +
    '.jbr-note-body h2,.jbr-note-body h3{margin:12px 0 6px;line-height:1.3}.jbr-note-body p{margin:0 0 8px}.jbr-note-body ul,.jbr-note-body ol{margin:0 0 8px;padding-left:22px}' +
    '.jbr-note-body a{color:inherit;text-decoration:underline}' +
    '.jbr-upd h3{font-size:16px;margin:4px 0 6px}.jbr-upd h4{font-size:14px;margin:10px 0 4px;opacity:.75}' +
    '.jbr-upd .jbr-note-older{margin-top:18px;padding-top:12px;border-top:1px solid rgba(127,127,127,.35)}' +
    '.jbr-note button{font:inherit;font-weight:600;border:0;border-radius:10px;padding:9px 22px;background:#1f1d1a;color:#fff;cursor:pointer;display:block;margin-left:auto}' +
    '.jbr-note .jbr-ink{fill:#000}.jbr-note .jbr-ring{stroke:#000}' +
    // dark like the page it's on: the theme chosen with the toggle, or the device setting when nothing has been chosen
    ':root[data-theme="dark"] .jbr-note{background:#262422;color:#eeeae4}:root[data-theme="dark"] .jbr-note button{background:#eeeae4;color:#1f1d1a}' +
    ':root[data-theme="dark"] .jbr-note .jbr-ink{fill:#fff}:root[data-theme="dark"] .jbr-note .jbr-ring{stroke:#fff}' +
    '@media (prefers-color-scheme:dark){:root:not([data-theme="light"]) .jbr-note{background:#262422;color:#eeeae4}:root:not([data-theme="light"]) .jbr-note button{background:#eeeae4;color:#1f1d1a}' +
    ':root:not([data-theme="light"]) .jbr-note .jbr-ink{fill:#fff}:root:not([data-theme="light"]) .jbr-note .jbr-ring{stroke:#fff}}';

  // the JBR logo drawn in the box's own ink: black on the white box, white on the dark one
  var NOTE_LOGO = '<svg class="jbr-note-logo" viewBox="0 0 248 248" role="img" aria-label="JB Revision"><defs><mask id="jbr-note-gap" maskUnits="userSpaceOnUse" x="0" y="0" width="248" height="248"><rect width="248" height="248" fill="#fff"/><g transform="translate(26.00 164.25) scale(0.05402 -0.05402)" fill="#000" stroke="#000" stroke-width="222" stroke-linejoin="round"><path transform="translate(-45 0)" d="M573 -24Q319 -24 182.0 105.0Q45 234 45 474V592H429V470Q429 398 464.37254901960785 359.0Q499.7450980392157 320 566 320Q631.6929133858267 320 667.3464566929133 359.0Q703 398 703 470V1490H1119V462.3348982785603Q1119 228 977.5 102.0Q836 -24 573 -24Z"/><path transform="translate(1034 0)" d="M80 0V1490H726Q896 1490 1012.0 1442.0Q1128 1394 1187.0 1310.5Q1246 1227 1246 1118Q1246 1032 1210.0 962.5Q1174 893 1109.5 847.5Q1045 802 958 785V783Q1054 780 1130.5 733.5Q1207 687 1251.5 607.0Q1296 527 1296 422Q1296 300 1235.0 204.5Q1174 109 1059.0 54.5Q944 0 782 0ZM484 312H704Q780 312 825.0 352.0Q870 392 870 459Q870 504 849.5 537.0Q829 570 792.0 588.0Q755 606 704 606H484ZM484 900H679Q725 900 759.0 917.0Q793 934 811.5 965.5Q830 997 830 1039Q830 1102 789.0 1140.0Q748 1178 679 1178H484Z"/><path transform="translate(2290 0)" d="M80 0V1490H713Q891 1490 1021.0 1426.5Q1151 1363 1221.5 1246.5Q1292 1130 1292 970Q1292 815 1218.5 702.0Q1145 589 1010.5 527.5Q876 466 691 466H336V788H682Q745 788 790.5 811.0Q836 834 861.0 875.0Q886 916 886 970Q886 1025 861.0 1065.5Q836 1106 790.5 1129.0Q745 1152 682 1152H496V0ZM905 0 581 676H1006L1338 0Z"/></g></mask></defs><circle cx="124" cy="124" r="92" fill="none" stroke-width="6.5" mask="url(#jbr-note-gap)" class="jbr-ring"/><g class="jbr-ink"><g transform="translate(26.00 164.25) scale(0.05402 -0.05402)"><path transform="translate(-45 0)" d="M573 -24Q319 -24 182.0 105.0Q45 234 45 474V592H429V470Q429 398 464.37254901960785 359.0Q499.7450980392157 320 566 320Q631.6929133858267 320 667.3464566929133 359.0Q703 398 703 470V1490H1119V462.3348982785603Q1119 228 977.5 102.0Q836 -24 573 -24Z"/><path transform="translate(1034 0)" d="M80 0V1490H726Q896 1490 1012.0 1442.0Q1128 1394 1187.0 1310.5Q1246 1227 1246 1118Q1246 1032 1210.0 962.5Q1174 893 1109.5 847.5Q1045 802 958 785V783Q1054 780 1130.5 733.5Q1207 687 1251.5 607.0Q1296 527 1296 422Q1296 300 1235.0 204.5Q1174 109 1059.0 54.5Q944 0 782 0ZM484 312H704Q780 312 825.0 352.0Q870 392 870 459Q870 504 849.5 537.0Q829 570 792.0 588.0Q755 606 704 606H484ZM484 900H679Q725 900 759.0 917.0Q793 934 811.5 965.5Q830 997 830 1039Q830 1102 789.0 1140.0Q748 1178 679 1178H484Z"/><path transform="translate(2290 0)" d="M80 0V1490H713Q891 1490 1021.0 1426.5Q1151 1363 1221.5 1246.5Q1292 1130 1292 970Q1292 815 1218.5 702.0Q1145 589 1010.5 527.5Q876 466 691 466H336V788H682Q745 788 790.5 811.0Q836 834 861.0 875.0Q886 916 886 970Q886 1025 861.0 1065.5Q836 1106 790.5 1129.0Q745 1152 682 1152H496V0ZM905 0 581 676H1006L1338 0Z"/></g></g></svg>';

  // the update notes as one message: the newest at the top, then the older unread ones under their dates
  function day(t) { return new Date(t).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' }); }
  function list(bullets) {
    var ul = document.createElement('ul');
    bullets.forEach(function (b) { var li = document.createElement('li'); li.textContent = b; ul.appendChild(li); });
    return ul;
  }
  function head(tag, text, cls) { var h = document.createElement(tag); h.textContent = text; if (cls) h.className = cls; return h; }
  function updatesBody(items) {
    var f = document.createDocumentFragment();
    f.appendChild(head('h3', 'Latest update · ' + day(items[0].t)));
    f.appendChild(list(items[0].bullets));
    var older = items.slice(1);
    if (older.length) {
      f.appendChild(head('h3', 'Earlier updates you haven’t seen (' + older.length + ')', 'jbr-note-older'));
      var last = '';
      older.forEach(function (u) {
        var d = day(u.t);
        if (d !== last) f.appendChild(head('h4', d));
        last = d;
        f.appendChild(list(u.bullets));
      });
    }
    return f;
  }

  // one box at a time: the admin's message first, then the update notes
  function popup(p, done) {
    var bg = document.createElement('div');
    bg.className = 'jbr-note-bg';
    bg.innerHTML = '<div class="jbr-note" role="dialog" aria-modal="true" aria-label="' + p.label + '">' +
      (p.logo ? NOTE_LOGO : '') +
      (p.title ? '<h2></h2>' : '') + '<div class="jbr-note-body"></div><button type="button">OK</button></div>';
    if (p.title) bg.querySelector('h2').textContent = p.title;
    p.fill(bg.querySelector('.jbr-note-body'));
    var ok = bg.querySelector('button');
    ok.addEventListener('click', function () {
      bg.remove();
      fetch('/api/note', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ which: p.which }) }).catch(function () {});
      done();
    });
    document.body.appendChild(bg);
    ok.focus();
  }

  fetch('/api/note', { credentials: 'same-origin' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (n) {
    if (!n) return;
    var queue = [];
    if (n.title || n.html || n.text) queue.push({ which: 'note', label: 'A message for you', title: n.title, logo: n.logo, fill: function (body) {
      // (the message's formatting was cleaned to a short list of safe tags when it was saved: functions/_lib/richtext.js)
      if (n.html) body.innerHTML = n.html;
      else { body.className += ' plain'; body.textContent = n.text || ''; }
    } });
    if (n.updates && n.updates.length) queue.push({ which: 'updates', label: 'What’s new', title: 'What’s new on JB Revision', logo: true, fill: function (body) {
      body.className += ' jbr-upd';
      body.appendChild(updatesBody(n.updates));
    } });
    if (!queue.length) return;
    var st = document.createElement('style');
    st.textContent = CSS;
    document.head.appendChild(st);
    (function next() { var p = queue.shift(); if (p) popup(p, next); })();
  }, function () {});
})();
