/* Study progress, shared with the subject sites (same browser store, synced to your account through /api/progress).
   Used by the progress page. */
window.JBR_PROGRESS = (function () {
  'use strict';
  // the browser's copy is kept per account (the jbr_who cookie, functions/_lib/who.js), so two accounts used in one
  // browser never see or sync each other's work
  function who() { var m = /(?:^|;\s*)jbr_who=([0-9a-f]+)/.exec(document.cookie); return m ? m[1] : ''; }
  var WHO = who(), KEY = 'jbr-progress-v1:' + (WHO || 'none');
  // the copies from before that (one for the whole browser: progress, and each subject's mock papers) go to the first
  // account that opens a page here, in practice whoever was signed in when it changed, whose work is newest in them
  (function adoptOld() {
    if (!WHO) return;
    try {
      var keys = [];
      for (var i = 0; i < localStorage.length; i++) keys.push(localStorage.key(i));
      keys.forEach(function (k) {
        if (!/^jbr-(progress-v1|mocks-[\w-]+|mock-cur-[\w-]+|mock-config-[\w-]+|mock-(?!print-)[\w-]+)$/.test(k)) return;
        if (localStorage.getItem(k + ':' + WHO) === null) localStorage.setItem(k + ':' + WHO, localStorage.getItem(k));
        localStorage.removeItem(k);
      });
    } catch (e) { /* storage blocked */ }
  })();
  // another account signed in from another tab: this page shows the account it was opened with, so it starts again
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible' && who() !== WHO) location.reload(); });
  function blank() { return { v: 1, items: {}, mocks: [], plan: null, t: 0 }; }
  function load() {
    try { var p = JSON.parse(localStorage.getItem(KEY)); return p && p.v === 1 ? p : blank(); } catch (e) { return blank(); }
  }
  // newest wins, item by item, so two devices or tabs never undo each other's work
  function merge(a, b) {
    var out = blank();
    [a, b].forEach(function (x) {
      if (!x) return;
      Object.keys(x.items || {}).forEach(function (k) { var v = x.items[k]; if (!out.items[k] || v.t > out.items[k].t) out.items[k] = v; });
      (x.mocks || []).forEach(function (m) { if (!out.mocks.some(function (y) { return y.id === m.id; })) out.mocks.push(m); });
      if (x.plan && (!out.plan || (x.plan.t || 0) > (out.plan.t || 0))) out.plan = x.plan;
      out.t = Math.max(out.t, x.t || 0);
    });
    out.mocks.sort(function (m, n) { return m.t - n.t; });
    return out;
  }
  var P = load(), timer = null, dirty = false;
  function writeLocal() { try { P = merge(load(), P); localStorage.setItem(KEY, JSON.stringify(P)); } catch (e) { /* storage full or blocked */ } }
  function push() {
    if (!dirty || !WHO || who() !== WHO) return;
    dirty = false;
    var body = JSON.stringify(P);
    fetch('/api/progress', { method: 'PUT', credentials: 'same-origin', headers: { 'content-type': 'application/json', 'x-jbr-who': WHO }, body: body, keepalive: body.length < 60000 })
      .then(function (r) { if (!r.ok && r.status !== 409) dirty = true; }, function () { dirty = true; });
  }
  function save(soon) { P.t = Date.now(); writeLocal(); dirty = true; clearTimeout(timer); timer = setTimeout(push, soon ? 3000 : 30000); }
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') push(); });
  function pull(done) {
    if (!WHO) { done && done(P); return; }
    fetch('/api/progress', { credentials: 'same-origin', cache: 'no-store', headers: { 'x-jbr-who': WHO } })
      .then(function (r) { return r.ok && (r.headers.get('x-jbr-who') || WHO) === WHO && who() === WHO ? r.json() : null; })
      .then(function (remote) { if (remote && remote.v === 1) { P = merge(load(), remote); try { localStorage.setItem(KEY, JSON.stringify(P)); } catch (e) { /* blocked */ } } done && done(P); },
        function () { done && done(P); });
  }
  // computer science is done in one programming language (chosen on the subject site, C# unless changed): progress on
  // another language's programming papers doesn't count. AQA Paper 1A/1B/1C = C#/Python/VB.NET; Edexcel International
  // GCSE Paper 2A/2B/2C = Python/C#/Java; every other paper is for all.
  function lang() { try { var l = localStorage.getItem('jbr-cs-lang'); return /^(cs|py|vb|java)$/.test(l) ? l : 'cs'; } catch (e) { return 'cs'; } }
  function langOf(qid) {
    var m = /^aqan-1([abc])fh-/.exec(qid || '');
    if (m) return { a: 'cs', b: 'py', c: 'vb' }[m[1]];
    m = /^edigcse-2([abc])fh-/.exec(qid || '');
    return m ? { a: 'py', b: 'cs', c: 'java' }[m[1]] : null;
  }
  // does this record (key "<subject>|<question>[/<part>]") count for you?
  function mine(k) {
    if (k.indexOf('computer-science|') !== 0) return true;
    var l = langOf(k.slice(k.indexOf('|') + 1));
    return !l || l === lang();
  }
  // how secure each topic of a subject is: share of marks over the latest 8 attempts that touched it
  function mastery(subj) {
    var by = {};
    Object.keys(P.items).forEach(function (k) {
      var v = P.items[k];
      if (v.s !== subj || !mine(k)) return;
      (v.tp || []).forEach(function (t) { (by[t] = by[t] || []).push(v); });
    });
    var out = {};
    Object.keys(by).forEach(function (t) {
      var xs = by[t].sort(function (a, b) { return b.t - a.t; }).slice(0, 8), g = 0, m = 0;
      xs.forEach(function (x) { g += x.g; m += x.m; });
      out[t] = { pct: m ? g / m : 0, n: by[t].length, last: xs[0].t };
    });
    return out;
  }
  return { get: function () { return P; }, save: save, pull: pull, mastery: mastery, flush: push, mine: mine, langOf: langOf, lang: lang };
})();
