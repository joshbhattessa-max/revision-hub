/* Study progress, shared with the subject sites (same browser store, synced to your account through /api/progress).
   Used by the home page's campus and the revision planner. */
window.JBR_PROGRESS = (function () {
  'use strict';
  var KEY = 'jbr-progress-v1';
  function blank() { return { v: 1, items: {}, rag: {}, mocks: [], plan: null, t: 0 }; }
  function load() {
    try { var p = JSON.parse(localStorage.getItem(KEY)); return p && p.v === 1 ? p : blank(); } catch (e) { return blank(); }
  }
  // newest wins, item by item, so two devices or tabs never undo each other's work
  function merge(a, b) {
    var out = blank();
    [a, b].forEach(function (x) {
      if (!x) return;
      Object.keys(x.items || {}).forEach(function (k) { var v = x.items[k]; if (!out.items[k] || v.t > out.items[k].t) out.items[k] = v; });
      Object.keys(x.rag || {}).forEach(function (k) { var v = x.rag[k]; if (!out.rag[k] || v.t > out.rag[k].t) out.rag[k] = v; });
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
    if (!dirty) return;
    dirty = false;
    var body = JSON.stringify(P);
    fetch('/api/progress', { method: 'PUT', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: body, keepalive: body.length < 60000 })
      .then(function (r) { if (!r.ok) dirty = true; }, function () { dirty = true; });
  }
  function save(soon) { P.t = Date.now(); writeLocal(); dirty = true; clearTimeout(timer); timer = setTimeout(push, soon ? 3000 : 30000); }
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') push(); });
  function pull(done) {
    fetch('/api/progress', { credentials: 'same-origin', cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (remote) { if (remote && remote.v === 1) { P = merge(load(), remote); try { localStorage.setItem(KEY, JSON.stringify(P)); } catch (e) { /* blocked */ } } done && done(P); },
        function () { done && done(P); });
  }
  // how secure each topic of a subject is: share of marks over the latest 8 attempts that touched it
  function mastery(subj) {
    var by = {};
    Object.keys(P.items).forEach(function (k) {
      var v = P.items[k];
      if (v.s !== subj) return;
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
  function level(ms) {
    if (!ms) return 'none';
    if (ms.pct >= 0.75 && ms.n >= 3) return 'secure';
    return ms.pct >= 0.5 ? 'developing' : 'weak';
  }
  return { get: function () { return P; }, save: save, pull: pull, mastery: mastery, level: level, flush: push };
})();
