/* Offline mode (Settings → Offline): the pages, questions, mark schemes and pictures that offline.js downloaded into
   the "jbr-offline" cache are served from this device when there's no internet. Used by the hub's own worker (sw.js)
   and, through importScripts, by each subject site's sw.js, so it works on every page of jbrevision.co.uk.
   With offline mode off, nothing is changed: every request goes to the network as normal. */
var JBR_OFF = 'jbr-offline';
var JBR_OFF_STATE = '/__offline/state';
// the answers the pages need to draw themselves (who's signed in, the hub's content, settings): kept up to date while
// online, so the last copy is there offline. Study progress isn't one: the pages keep their own copy of it.
var JBR_OFF_API = ['/api/me', '/api/hub', '/api/prefs', '/api/account'];
var jbrOffOn = null;   // null until read (just woken up)

function jbrOffRead() {
  return caches.open(JBR_OFF).then(function (c) { return c.match(JBR_OFF_STATE); })
    .then(function (r) { return r ? r.json() : null; })
    .then(function (s) { jbrOffOn = !!(s && s.on); return jbrOffOn; }, function () { jbrOffOn = false; return false; });
}
jbrOffRead();
// offline.js says when a download finishes or the copy is removed
self.addEventListener('message', function (e) { if (e.data && e.data.type === 'jbr-offline') e.waitUntil(jbrOffRead()); });

// pictures and fonts never change at the same address, so the downloaded copy is used even online (faster, no data)
function jbrOffKeeps(path) { return /\.(webp|png|jpe?g|svg|woff2?|ttf|pdf)$/.test(path); }

function jbrOffMatch(req, path) {
  return caches.open(JBR_OFF).then(function (c) {
    return c.match(req, { ignoreSearch: true, ignoreVary: true }).then(function (r) {
      if (r || req.mode !== 'navigate') return r;
      // a page: /chemistry and /chemistry/ (and /settings.html and /settings) are the same page
      var alt = /\/$/.test(path) ? path.replace(/\/+$/, '') || '/' : path + '/';
      return c.match(alt, { ignoreSearch: true }).then(function (r2) { return r2 || c.match(path.replace(/\.html$/, ''), { ignoreSearch: true }); });
    });
  });
}

function jbrOffPage(path) {
  return new Response('<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Offline</title>' +
    '<body style="font:16px/1.5 system-ui,sans-serif;max-width:520px;margin:60px auto;padding:0 16px;color:#222;background:#fff">' +
    '<h1 style="font-size:22px">You\'re offline</h1><p>This page isn\'t downloaded on this device, so it needs the internet.</p>' +
    '<p><a href="/">Go to the subjects you downloaded</a></p>',
    { status: 503, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });
}

// the network, but give up after a while (a plane's Wi-Fi often hangs rather than failing)
function jbrOffNet(req, ms) {
  return new Promise(function (ok, fail) {
    var t = setTimeout(function () { fail(new Error('timeout')); }, ms);
    fetch(req).then(function (r) { clearTimeout(t); ok(r); }, function (e) { clearTimeout(t); fail(e); });
  });
}

function jbrOffHandle(e, req, u) {
  var path = u.pathname, api = path.indexOf('/api/') === 0;
  if (api && JBR_OFF_API.indexOf(path) < 0) return fetch(req);
  return jbrOffMatch(req, path).then(function (cached) {
    if (cached && jbrOffKeeps(path)) return cached;
    if (!cached && !api) return fetch(req).catch(function (err) { if (req.mode === 'navigate') return jbrOffPage(path); throw err; });
    if (self.navigator && self.navigator.onLine === false && cached) return cached;
    return jbrOffNet(req, req.mode === 'navigate' ? 6000 : 8000).then(function (r) {
      // keep the offline copy fresh: only what was downloaded (or the few answers above), and only good answers
      if ((cached || api) && r.ok && r.type === 'basic' && !r.redirected) {
        var copy = r.clone();
        e.waitUntil(caches.open(JBR_OFF).then(function (c) { return c.put(api ? path : u.href, copy); }).catch(function () {}));
      }
      return r;
    }, function (err) {
      if (cached) return cached;
      if (req.mode === 'navigate') return jbrOffPage(path);
      return api ? new Response('{"error":"Offline"}', { status: 503, headers: { 'content-type': 'application/json' } }) : Promise.reject(err);
    });
  });
}

self.addEventListener('fetch', function (e) {
  var req = e.request, u = new URL(req.url);
  if (req.method !== 'GET' || u.origin !== self.location.origin || jbrOffOn === false) return;
  // printed mock papers are the subject sites' own (their sw.js), and the hub keeps its own on the server
  if (/\/print\/[^/]+\.pdf$/.test(u.pathname) || /\/sw\.js$|^\/offline-sw\.js$/.test(u.pathname)) return;
  if (jbrOffOn === true) { e.respondWith(jbrOffHandle(e, req, u)); return; }
  // just woken up: find out first
  e.respondWith(jbrOffRead().then(function (on) { return on ? jbrOffHandle(e, req, u) : fetch(req); }));
});
