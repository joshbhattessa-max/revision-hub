/* Offline mode (Settings → Offline): downloads the subjects you pick (their pages, questions, mark schemes, pictures
   and what mocks need) into this browser's "jbr-offline" cache, so the site works with no internet, on a flight say.
   sw.js (the hub) and each subject's sw.js serve them from there through offline-sw.js. Marks made offline stay in
   the browser's own copy of your progress and sync to your account the next time a subject page opens online
   (study.js pushes when its copy is newer than the account's). */
window.JBR_OFFLINE = (function () {
  'use strict';
  var CACHE = 'jbr-offline', STATE = '/__offline/state';
  var ok = 'serviceWorker' in navigator && !!window.caches && window.isSecureContext;

  // each subject's exam boards at Josh's school (SCHOOL in the subject sites' app.js): what "Your school's boards"
  // downloads. Sizes are the pictures in MB (school boards / every board), measured 2026-10-25, plus ~4 MB of pages.
  var SUBJ = {
    'chemistry': ['Edexcel-IGCSE', 118, 857], 'biology': ['Edexcel-IGCSE', 125, 907], 'physics': ['Edexcel-IGCSE', 107, 831],
    'maths': ['Edexcel-IGCSE', 226, 838], 'geography': ['AQA', 93, 944], 'computer-science': ['AQA', 45, 279],
    'spanish': ['Edexcel-IGCSE', 24, 41], 'french': ['Edexcel-IGCSE', 27, 60], 'english-language': ['Edexcel-IGCSE', 68, 160],
    'english-literature': ['Edexcel-IGCSE', 228, 438], 'history': ['CIE', 221, 581], 'religious-studies': ['Edexcel', 27, 183],
    'pe': ['AQA', 22, 59], 'design-technology': ['AQA', 17, 89]
  };
  // the hub's own pages, and the answers they need to draw themselves
  var HUB_PAGES = ['/', '/settings', '/progress'];
  var HUB_FILES = ['/api/me', '/api/hub', '/api/prefs', '/api/account', '/study-meta.json', '/favicon.svg', '/favicon-32.png', '/offline.js'];
  // what a subject page only asks for later: the mock PDF maker and its fonts, the resource pages, the spec points
  var LATER = ['assets/js/vendor/jspdf.umd.min.js?v=4.2.1', 'assets/js/mockpdf.js?v=3', 'data/spec-points.js?v=3', 'favicon.svg',
    'assets/fonts/exam-sans-regular.ttf?v=1', 'assets/fonts/exam-sans-bold.ttf?v=1', 'assets/fonts/exam-sans-italic.ttf?v=1',
    'assets/fonts/exam-sans-bolditalic.ttf?v=1', 'assets/fonts/barlow-regular.ttf?v=1', 'assets/fonts/barlow-medium.ttf?v=1',
    'assets/resources/periodic-table.png', 'assets/resources/maths-formulae.png'];

  function state() {
    if (!ok) return Promise.resolve(null);
    return caches.open(CACHE).then(function (c) { return c.match(STATE); }).then(function (r) { return r ? r.json() : null; }).catch(function () { return null; });
  }
  function setState(s) {
    return caches.open(CACHE).then(function (c) { return c.put(STATE, new Response(JSON.stringify(s), { headers: { 'content-type': 'application/json' } })); })
      .then(tellWorker);
  }
  function tellWorker() {
    if (!navigator.serviceWorker) return;
    navigator.serviceWorker.getRegistrations().then(function (regs) {
      regs.forEach(function (r) { [r.active, r.waiting, r.installing].forEach(function (w) { if (w) w.postMessage({ type: 'jbr-offline' }); }); });
    }).catch(function () {});
  }
  function register() {
    return navigator.serviceWorker.register('/sw.js', { scope: '/' }).then(function () { return navigator.serviceWorker.ready; });
  }

  // only the type is kept (the body is already unpacked, so its compression and length no longer apply)
  function kept(r) { return { 'content-type': r.headers.get('content-type') || 'application/octet-stream' }; }
  function SignedOut() { this.message = 'You were signed out. Sign in again, then download.'; }
  // one file into the cache; the size it took
  function grab(cache, url, optional) {
    return fetch(url, { credentials: 'same-origin', cache: 'no-store' }).then(function (r) {
      if (r.redirected && /\/login(\?|$)/.test(new URL(r.url).pathname + '?')) throw new SignedOut();
      if (!r.ok) { if (optional) return 0; throw new Error(url + ' ' + r.status); }
      return r.blob().then(function (b) {
        // stored without the "redirected" mark (a redirected answer can't be used for a page)
        return cache.put(url, new Response(b, { status: 200, headers: kept(r) })).then(function () { return b.size; });
      });
    });
  }
  function text(cache, url) {
    return fetch(url, { credentials: 'same-origin', cache: 'no-store' }).then(function (r) {
      if (r.redirected && /\/login/.test(r.url)) throw new SignedOut();
      if (!r.ok) throw new Error(url + ' ' + r.status);
      return r.text().then(function (t) {
        return cache.put(url, new Response(t, { status: 200, headers: kept(r) })).then(function () { return t; });
      });
    });
  }
  // the files a page or style sheet refers to, on this site
  function refs(src, base, css) {
    var out = [], re = css ? /url\(\s*['"]?([^'")]+)['"]?\s*\)/g : /\s(?:src|href)="([^"#]+)"/g, m;
    while ((m = re.exec(src))) {
      try {
        var u = new URL(m[1], base);
        if (u.origin === location.origin && !/^\/api\//.test(u.pathname) && !/^\/(login|logout)/.test(u.pathname)) out.push(u.pathname + u.search);
      } catch (e) { /* not an address */ }
    }
    return out;
  }
  // every picture a subject's questions use (as app.js builds them), for the boards asked for
  function pictures(js, boards) {
    var d = JSON.parse(js.slice(js.indexOf('=') + 1).trim().replace(/;\s*$/, ''));
    var out = {}, papers = {};
    (d.q || []).forEach(function (a) {
      var p = d.papers[a[0]];
      if (boards && boards.indexOf(p[1]) < 0) return;
      var base = 'img/' + p[0] + '/';
      papers[p[0]] = 1;
      out[base + 'q' + a[6] + '.webp'] = 1;
      out[base + 't' + a[11] + '.webp'] = 1;
      if (a[15]) out[base + 'm' + a[15] + '.webp'] = 1;
      (a[26] || []).forEach(function (f) { out[base + 'f' + f[0] + '.webp'] = 1; });
    });
    return { pics: Object.keys(out), papers: Object.keys(papers) };
  }

  // download: paths = the subjects (hub.json paths); all = every exam board, not just the school's
  function download(paths, all, progress, stop) {
    var cache, list = [], done = 0, bytes = 0, failed = 0, seen = {};
    function add(url, optional, keep) { if (!seen[url]) { seen[url] = 1; list.push([url, optional, keep]); } }
    function report(stage) { progress && progress({ stage: stage, done: done, total: list.length, bytes: bytes }); }
    report('Getting ready…');
    return register().then(function () {
      if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(function () {});
      return caches.open(CACHE);
    }).then(function (c) {
      cache = c;
      HUB_FILES.forEach(function (u) { add(u, true); });
      // the pages first, to find what they need
      var pages = HUB_PAGES.map(function (p) { return { url: p }; }).concat(paths.map(function (p) { return { url: '/' + p + '/', subj: p }; }));
      return pages.reduce(function (chain, pg) {
        return chain.then(function () {
          if (stop.now) throw new Error('stopped');
          report('Looking at ' + (pg.subj ? pg.subj.replace(/-/g, ' ') : 'the main pages') + '…');
          return text(cache, pg.url).then(function (html) {
            var base = new URL(pg.url, location.href), qjs = null, css = [];
            refs(html, base).forEach(function (r) {
              if (/\/data\/questions\.js/.test(r)) qjs = r;
              else if (/\.css(\?|$)/.test(r)) css.push(r);
              else add(r, true);
            });
            var steps = css.map(function (u) {
              return text(cache, u).then(function (t) { refs(t, new URL(u, location.href), true).forEach(function (r) { add(r, true, true); }); }, function () {});
            });
            if (pg.subj) {
              LATER.forEach(function (u) { add(new URL(u, base).pathname + (u.indexOf('?') > 0 ? u.slice(u.indexOf('?')) : ''), true); });
              if (qjs) steps.push(text(cache, qjs).then(function (js) {
                var boards = all ? null : [(SUBJ[pg.subj] || [])[0]].filter(Boolean);
                var got = pictures(js, boards && boards.length ? boards : null);
                got.pics.forEach(function (u) { add(new URL(u, base).pathname, true, true); });
                got.papers.forEach(function (p) { add(new URL('data/examiner/' + encodeURIComponent(p) + '.json', base).pathname, true); });
              }));
            }
            return Promise.all(steps);
          });
        });
      }, Promise.resolve());
    }).then(function () {
      // then everything, a few at a time; pictures already here are kept (they never change at one address)
      var i = 0, lock = null;
      try { if (navigator.wakeLock) navigator.wakeLock.request('screen').then(function (l) { lock = l; }, function () {}); } catch (e) { /* no wake lock */ }
      function worker() {
        if (stop.now) return Promise.reject(new Error('stopped'));
        if (i >= list.length) return Promise.resolve();
        var it = list[i++];
        var go = it[2] ? cache.match(it[0], { ignoreSearch: true }).then(function (r) { return r ? 0 : grab(cache, it[0], it[1]); }) : grab(cache, it[0], it[1]);
        return go.then(function (n) { bytes += n; }, function (e) { if (e instanceof SignedOut) throw e; failed++; })
          .then(function () { done++; if (done % 10 === 0 || done === list.length) report('Downloading…'); return worker(); });
      }
      var workers = [];
      for (var w = 0; w < 6; w++) workers.push(worker());
      return Promise.all(workers).then(function (x) { if (lock) lock.release().catch(function () {}); return x; },
        function (e) { if (lock) lock.release().catch(function () {}); throw e; });
    }).then(function () {
      // subjects no longer picked are taken off this device
      return cache.keys().then(function (keys) {
        var drop = keys.filter(function (k) {
          var p = new URL(k.url).pathname.split('/')[1];
          return SUBJ[p] && paths.indexOf(p) < 0;
        });
        return Promise.all(drop.map(function (k) { return cache.delete(k); }));
      });
    }).then(function () {
      var s = { on: true, t: Date.now(), all: !!all, subjects: paths, files: list.length, failed: failed };
      return setState(s).then(function () { return s; });
    });
  }

  function remove() {
    return caches.delete(CACHE).then(tellWorker);
  }
  function free() {
    if (!navigator.storage || !navigator.storage.estimate) return Promise.resolve(null);
    return navigator.storage.estimate().then(function (e) { return { used: e.usage || 0, free: Math.max(0, (e.quota || 0) - (e.usage || 0)) }; }).catch(function () { return null; });
  }

  // ------------------------------------------------------------------ the Settings section
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function mb(n) { return n >= 1000 ? (n / 1000).toFixed(1).replace(/\.0$/, '') + ' GB' : Math.round(n) + ' MB'; }
  function when(t) { var d = new Date(t); return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) + ', ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }); }

  function mount(sec, toast) {
    if (!ok) {
      sec.innerHTML = '<h2>Offline</h2><div class="set-row"><div class="set-what"><b>Use the site offline</b><p>This browser can\'t keep the site for offline use. Try Safari or Chrome.</p></div></div>';
      return;
    }
    Promise.all([state(), fetch('/api/hub', { credentials: 'same-origin' }).then(function (r) { return r.json(); }).catch(function () { return {}; }), free()]).then(function (r) {
      var st = r[0], sites = ((r[1] && r[1].sites) || []).filter(function (s) { return SUBJ[s.path]; }), room = r[2];
      var picked = {}, all = !!(st && st.all), busy = null;
      ((st && st.subjects) || []).forEach(function (p) { picked[p] = 1; });

      function size() { var n = 0; Object.keys(picked).forEach(function (p) { n += (SUBJ[p] || [0, 0, 0])[all ? 2 : 1]; }); return n + (n ? 3 : 0); }
      function draw() {
        var names = st && st.on ? sites.filter(function (s) { return st.subjects.indexOf(s.path) >= 0; }).map(function (s) { return s.subject || s.name; }) : [];
        var h = '<h2>Offline</h2>';
        if (st && st.on) h += '<div class="set-row"><div class="set-what"><b>' + (st.partial ? 'Partly downloaded <span class="set-tag">On</span>' : 'Ready offline <span class="set-tag ok">On</span>') + '</b><p>' +
          esc(names.join(', ') || 'The main pages') + '. ' + (st.all ? 'Every exam board.' : "Your school's exam boards.") + ' Downloaded ' + esc(when(st.t)) + '.</p></div>' +
          '<div class="set-ctl"><button type="button" class="set-btn warn" data-off="remove">Remove</button></div></div>';
        h += '<div class="set-row set-col"><div class="set-what"><b>' + (st && st.on ? 'Change or update what\'s offline' : 'Download for offline') + '</b>' +
          '<p>Keeps the questions, mark schemes and mocks of the subjects you pick on this device, so they work with no internet (on a flight, say). ' +
          'Marks you make offline are saved here and sync to your account the next time you open a subject online. Listening audio and the boards\' own PDFs still need the internet.</p></div>' +
          '<div class="off-subj" role="group" aria-label="Subjects">' + sites.map(function (s) {
            var on = !!picked[s.path];
            return '<button type="button" class="off-chip" role="checkbox" aria-checked="' + on + '" data-p="' + esc(s.path) + '" style="--c:' + esc(s.color || '#888') + '">' +
              '<i aria-hidden="true"></i><b>' + esc(s.subject || s.name) + '</b><small>' + mb(SUBJ[s.path][all ? 2 : 1]) + '</small></button>';
          }).join('') + '</div>' +
          '<div class="off-opts"><div class="set-seg" role="radiogroup" data-name="boards"><button type="button" role="radio" aria-checked="' + !all + '" data-v="school">Your school\'s boards</button>' +
          '<button type="button" role="radio" aria-checked="' + all + '" data-v="all">Every board</button></div>' +
          '<button type="button" class="off-all">' + (sites.every(function (s) { return picked[s.path]; }) ? 'Clear all' : 'Pick all') + '</button></div>' +
          '<p class="off-sum">' + (size() ? 'About ' + mb(size()) : 'Pick the subjects you want') + (room && room.free ? ' · ' + mb(room.free / 1e6) + ' free for this site' : '') + '</p>' +
          '<div class="off-bar" hidden><div class="off-track"><span></span></div><p class="off-msg" role="status"></p></div>' +
          '<div class="set-ctl"><button type="button" class="set-btn off-go" data-off="go"' + (size() ? '' : ' disabled') + '>' + (st && st.on ? 'Download again' : 'Download') + '</button>' +
          '<button type="button" class="set-btn" data-off="stop" hidden>Stop</button></div></div>';
        sec.innerHTML = h;
      }
      draw();

      sec.addEventListener('click', function (e) {
        var b = e.target.closest('button'); if (!b || busy && !b.matches('[data-off=stop]')) return;
        if (b.classList.contains('off-chip')) { var p = b.getAttribute('data-p'); if (picked[p]) delete picked[p]; else picked[p] = 1; draw(); return; }
        if (b.classList.contains('off-all')) {
          var every = sites.every(function (s) { return picked[s.path]; });
          picked = {}; if (!every) sites.forEach(function (s) { picked[s.path] = 1; }); draw(); return;
        }
        if (b.closest('[data-name=boards]')) { all = b.getAttribute('data-v') === 'all'; draw(); return; }
        var act = b.getAttribute('data-off');
        if (act === 'stop' && busy) { busy.now = true; return; }
        if (act === 'remove') {
          if (!confirm('Remove the offline copy from this device? The site will need the internet again. Your marks are kept.')) return;
          remove().then(function () { st = null; picked = {}; draw(); toast('Offline copy removed.'); });
          return;
        }
        if (act === 'go') go();
      });

      function go() {
        var paths = sites.map(function (s) { return s.path; }).filter(function (p) { return picked[p]; });
        var est = size();
        if (room && room.free && est * 1e6 > room.free * 0.9) { toast('Not enough room on this device for ' + mb(est) + '. Pick fewer subjects.', true); return; }
        busy = { now: false };
        sec.querySelector('.off-bar').hidden = false;
        sec.querySelector('[data-off=stop]').hidden = false;
        sec.querySelector('.off-go').disabled = true;
        var bar = sec.querySelector('.off-track span'), msg = sec.querySelector('.off-msg');
        msg.textContent = 'Getting ready… Keep this page open until it finishes.';
        download(paths, all, function (p) {
          var pct = p.total ? Math.round(p.done / p.total * 100) : 0;
          bar.style.width = (p.stage === 'Downloading…' ? pct : 2) + '%';
          msg.textContent = p.stage === 'Downloading…'
            ? pct + '% · ' + p.done.toLocaleString() + ' of ' + p.total.toLocaleString() + ' files · ' + mb(p.bytes / 1e6) + ' new. Keep this page open until it finishes.'
            : p.stage;
        }, busy).then(function (s) {
          busy = null; st = s;
          return free().then(function (f) { room = f; draw(); toast(s.failed ? 'Ready offline (' + s.failed + ' files didn\'t download, try Download again).' : 'Ready offline.'); });
        }, function (er) {
          var stopped = busy && busy.now; busy = null;
          // what did download still works offline
          setState({ on: true, t: Date.now(), all: all, subjects: paths, partial: true }).then(function () { return state(); }).then(function (s) { st = s; draw(); });
          toast(stopped ? 'Stopped. What downloaded is kept; press Download to carry on.' : er instanceof SignedOut ? er.message : "The download didn't finish (" + (er.message || 'no connection') + '). Press Download to carry on.', !stopped);
        });
      }
    });
  }

  return { ok: ok, state: state, download: download, remove: remove, mount: mount };
})();
