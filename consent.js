/* The cookie popup, on every page of the main site and the subject sites it serves (the main site's middleware adds
   this script to each page). Essential cookies (staying signed in, remembering this choice) need no permission;
   usage statistics happen only if you press "Accept all", and stop (and their visitor number is deleted) the moment
   you choose "Essential only". "Cookie settings" anywhere on the site (data-cookie-settings) opens it again.

   With permission, each page you open is counted for the day: which part of the site it is (for example
   "chemistry: question") and what kind of device. It's kept in this browser and sent at most every 10 minutes to
   /api/usage under a random visitor number (the jbr_vid cookie), never with your username. */
(function () {
  'use strict';
  if (window.JBR_CONSENT) return;
  var VERSION = 1, YEAR = 365 * 86400, QUEUE = 'jbr-usage', SEND_EVERY = 10 * 60000;

  // ------------------------------------------------------------------ cookies
  function getCookie(name) {
    var m = document.cookie.match(new RegExp('(?:^|;\\s*)' + name + '=([^;]*)'));
    return m ? decodeURIComponent(m[1]) : null;
  }
  function setCookie(name, value, maxAge) {
    document.cookie = name + '=' + encodeURIComponent(value) + '; Path=/; Max-Age=' + maxAge + '; SameSite=Lax' + (location.protocol === 'https:' ? '; Secure' : '');
  }
  // "v1.s1.<time>": version, usage statistics on (s1) or off (s0), when you chose
  function choice() {
    var c = getCookie('jbr_consent'), p = c ? c.split('.') : [];
    return p[0] === 'v' + VERSION ? { stats: p[1] === 's1', t: +p[2] || 0 } : null;
  }
  function visitor() {
    var v = getCookie('jbr_vid');
    if (v && /^[a-z0-9]{16}$/.test(v)) return v;
    var a = new Uint8Array(8);
    (window.crypto || window.msCrypto).getRandomValues(a);
    v = Array.prototype.map.call(a, function (b) { return ('0' + b.toString(16)).slice(-2); }).join('');
    setCookie('jbr_vid', v, YEAR);
    return v;
  }
  function choose(stats) {
    setCookie('jbr_consent', 'v' + VERSION + '.' + (stats ? 's1' : 's0') + '.' + Date.now(), YEAR);
    if (stats) visitor();
    else { setCookie('jbr_vid', '', 0); try { localStorage.removeItem(QUEUE); } catch (e) { /* blocked */ } }
    record();
    close();
    if (stats) count();
  }

  // a record of the choice with your account: sent when you choose, or on the first page after you sign in if you
  // chose on the sign-in page (once per choice, so it costs almost nothing)
  function record() {
    var c = getCookie('jbr_consent'), done;
    if (!c || /^\/login/.test(location.pathname)) return;
    try { done = localStorage.getItem('jbr-consent-sent'); } catch (e) { done = null; }
    if (done === c) return;
    try {
      fetch('/api/consent', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ stats: choice().stats, v: VERSION }) })
        .then(function (r) { if (r.ok) try { localStorage.setItem('jbr-consent-sent', c); } catch (e) { /* blocked */ } }, function () {});
    } catch (e) { /* offline */ }
  }

  // ------------------------------------------------------------------ the popup
  var CSS = '' +
    '.jbr-ck{--ck-bg:#fff;--ck-ink:#1d1d1f;--ck-muted:#5f5f5f;--ck-line:rgba(0,0,0,.14);--ck-btn:#1d1d1f;--ck-on:#fff;' +
    'position:fixed;left:12px;right:12px;bottom:12px;z-index:2147483000;max-width:560px;margin:0 auto;background:var(--ck-bg);color:var(--ck-ink);' +
    'border:1px solid var(--ck-line);border-radius:14px;box-shadow:0 10px 40px rgba(0,0,0,.18);padding:16px 18px;' +
    'font:14px/1.45 Inter,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;box-sizing:border-box;max-height:calc(100vh - 24px);overflow-y:auto}' +
    '.jbr-ck *{box-sizing:border-box}' +
    '.jbr-ck h2{font-size:15px;font-weight:700;margin:0 0 6px;color:inherit}' +
    '.jbr-ck p{margin:0 0 12px;color:var(--ck-muted)}' +
    '.jbr-ck a{color:inherit}' +
    '.jbr-ck-btns{display:flex;flex-wrap:wrap;gap:8px}' +
    '.jbr-ck button{font:inherit;font-size:14px;font-weight:600;cursor:pointer;border-radius:999px;padding:9px 16px;border:1px solid var(--ck-btn);' +
    'background:var(--ck-btn);color:var(--ck-on);flex:1 1 140px}' +
    '.jbr-ck button.alt{background:transparent;color:var(--ck-ink)}' +
    '.jbr-ck button.link{flex:0 0 auto;border-color:transparent;background:none;color:var(--ck-muted);text-decoration:underline;font-weight:500;padding:9px 6px}' +
    '.jbr-ck-opts{margin:0 0 12px;display:grid;gap:8px}' +
    '.jbr-ck-opt{display:flex;gap:10px;align-items:flex-start;border:1px solid var(--ck-line);border-radius:10px;padding:10px 12px}' +
    '.jbr-ck-opt input{margin:3px 0 0;width:18px;height:18px;flex:none;accent-color:var(--ck-btn)}' +
    '.jbr-ck-opt b{display:block;font-size:14px}' +
    '.jbr-ck-opt span{color:var(--ck-muted);font-size:13px}' +
    ':root[data-theme="dark"] .jbr-ck{--ck-bg:#222226;--ck-ink:#ecebe8;--ck-muted:#a8a59f;--ck-line:rgba(255,255,255,.16);--ck-btn:#ecebe8;--ck-on:#17171a}' +
    '@media (prefers-color-scheme:dark){:root:not([data-theme="light"]) .jbr-ck{--ck-bg:#222226;--ck-ink:#ecebe8;--ck-muted:#a8a59f;--ck-line:rgba(255,255,255,.16);--ck-btn:#ecebe8;--ck-on:#17171a}}' +
    '@media print{.jbr-ck{display:none!important}}';
  var box = null;
  function close() { if (box) { box.remove(); box = null; } }
  function open(settings) {
    close();
    if (!document.getElementById('jbr-ck-css')) {
      var st = document.createElement('style'); st.id = 'jbr-ck-css'; st.textContent = CSS; document.head.appendChild(st);
    }
    var cur = choice();
    box = document.createElement('section');
    box.className = 'jbr-ck';
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-label', 'Cookies');
    box.innerHTML = settings ?
      '<h2>Cookie settings</h2>' +
      '<div class="jbr-ck-opts">' +
      '<label class="jbr-ck-opt"><input type="checkbox" checked disabled><div><b>Essential</b><span>Keep you signed in and remember this choice. The site can\'t work without them, so they\'re always on.</span></div></label>' +
      '<label class="jbr-ck-opt"><input type="checkbox" class="jbr-ck-stats"' + (cur && cur.stats ? ' checked' : '') + '><div><b>Usage statistics</b><span>Count which parts of the site are used and on what kind of device, under a random visitor number, never your name. Kept for 90 days.</span></div></label>' +
      '</div><div class="jbr-ck-btns"><button type="button" class="save">Save my choices</button><button type="button" class="alt all">Accept all</button></div>' :
      '<h2>Cookies on Josh B Revision</h2>' +
      '<p>Essential cookies keep you signed in and save your progress. With your permission, we\'d also like to count which parts of the site are used, and on what kind of device, to make it better. That\'s anonymous: never your name or your answers. <a href="/privacy#cookies">Privacy Policy</a></p>' +
      '<div class="jbr-ck-btns"><button type="button" class="all">Accept all</button><button type="button" class="alt ess">Essential only</button><button type="button" class="link set">Settings</button></div>';
    document.body.appendChild(box);
    var on = function (sel, fn) { var b = box.querySelector(sel); if (b) b.addEventListener('click', fn); };
    on('.all', function () { choose(true); });
    on('.ess', function () { choose(false); });
    on('.set', function () { open(true); });
    on('.save', function () { choose(box.querySelector('.jbr-ck-stats').checked); });
    var first = box.querySelector('button');
    if (settings && first) first.focus();
  }
  document.addEventListener('click', function (e) {
    var t = e.target && e.target.closest && e.target.closest('[data-cookie-settings]');
    if (t) { e.preventDefault(); open(true); }
  });

  // ------------------------------------------------------------------ usage statistics (only with permission)
  var SUBJECTS = /^\/(chemistry|biology|physics|maths|geography|computer-science|spanish)(\/|$)/;
  function pageKey() {
    var p = location.pathname.replace(/\/index\.html$/, '/').replace(/\.html$/, ''), m = p.match(SUBJECTS);
    if (m) {
      var r = (location.hash.replace(/^#\/?/, '').split('/')[0] || 'home').replace(/[^a-z-]/g, '');
      if (r === 'qualification') r = 'questions';
      return m[1] + ':' + (r || 'home');
    }
    var top = p.split('/')[1] || 'home';
    return /^[a-z-]{1,20}$/.test(top) ? top : 'other';
  }
  function device() { var w = window.innerWidth || 1000; return w < 600 ? 'phone' : w < 1024 ? 'tablet' : 'computer'; }
  function today() { var d = new Date(); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
  function load() { try { return JSON.parse(localStorage.getItem(QUEUE)) || null; } catch (e) { return null; } }
  function store(q) { try { localStorage.setItem(QUEUE, JSON.stringify(q)); } catch (e) { /* blocked */ } }
  var lastKey = null;
  function count() {
    var c = choice();
    if (!c || !c.stats || pageKey() === lastKey) return;
    lastKey = pageKey();
    var q = load();
    if (!q || q.d !== today()) { if (q && q.pv && Object.keys(q.pv).length) send(q, true); q = { d: today(), pv: {}, sent: q && q.d === today() ? q.sent : 0 }; }
    q.dev = device();
    q.pv[lastKey] = (q.pv[lastKey] || 0) + 1;
    store(q);
    if (Date.now() - (q.sent || 0) > SEND_EVERY) send(q);
  }
  function send(q, old) {
    var c = choice();
    if (!c || !c.stats || !q || !q.pv || !Object.keys(q.pv).length) return;
    var body = JSON.stringify({ d: q.d, dev: q.dev, pv: q.pv, v: VERSION });
    var ok = false;
    try { ok = navigator.sendBeacon && navigator.sendBeacon('/api/usage', new Blob([body], { type: 'application/json' })); } catch (e) { ok = false; }
    if (!ok) { try { fetch('/api/usage', { method: 'POST', credentials: 'same-origin', keepalive: true, headers: { 'content-type': 'application/json' }, body: body }).catch(function () {}); } catch (e) { /* offline */ } }
    if (!old) { q.pv = {}; q.sent = Date.now(); store(q); }
  }
  // what's still waiting goes when you leave the page (at most every 10 minutes)
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState !== 'hidden') return;
    var q = load();
    if (q && Date.now() - (q.sent || 0) > SEND_EVERY) send(q);
  });

  function start() {
    if (!choice() && !/^\/(privacy|terms)/.test(location.pathname)) open(false);
    else if (choice()) record();
    count();
    window.addEventListener('hashchange', count);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
  window.JBR_CONSENT = { open: function () { open(true); }, choice: choice };
})();
