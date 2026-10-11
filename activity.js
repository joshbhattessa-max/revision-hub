/* Activity, on every page of the main site and the subject sites it serves while you're signed in (the main site's
   middleware adds this script). It tells /api/activity which page you open (its address and title) and, once a minute
   while the page is on screen, that you're still there. The admin console's Activity tab shows it; see the Privacy
   Policy. Nothing you type and none of your answers are sent. */
(function () {
  'use strict';
  if (window.JBR_ACTIVITY) return;
  window.JBR_ACTIVITY = true;
  var BEAT = 60000, last = '', wait = null;

  function send(kind) {
    var body = JSON.stringify({ k: kind, p: location.pathname, h: location.hash.slice(0, 200), t: (document.title || '').slice(0, 200) });
    var ok = false;
    try { ok = navigator.sendBeacon && navigator.sendBeacon('/api/activity', new Blob([body], { type: 'application/json' })); } catch (e) { ok = false; }
    if (!ok) { try { fetch('/api/activity', { method: 'POST', credentials: 'same-origin', keepalive: true, headers: { 'content-type': 'application/json' }, body: body }).catch(function () {}); } catch (e) { /* offline */ } }
  }
  // a moment after the address changes, so the page has drawn and set its title (a question page's title names the paper)
  function view() {
    clearTimeout(wait);
    wait = setTimeout(function () {
      var here = location.pathname + location.hash;
      if (here === last || document.visibilityState === 'hidden') return;
      last = here;
      send('view');
    }, 1000);
  }
  function start() {
    view();
    window.addEventListener('hashchange', view);
    setInterval(function () { if (document.visibilityState === 'visible') send('beat'); }, BEAT);
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState !== 'visible') return;
      if (location.pathname + location.hash !== last) view(); else send('beat');
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
