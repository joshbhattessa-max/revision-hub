/* Revision planner: your exams, class tests and topic deadlines; a day-by-day plan that favours the topics you're
   weakest at and the dates coming up soonest; topic sheets matched to topics; and question sets picked from the
   school's own exam board's past papers. Each line of a topic sheet (or a test's topics) is matched against the
   wording of every past-paper question, so the picks test that point; questions you got wrong come back in the
   sets when they're due for review.
   Saved with your progress, so it follows you between devices. */
(function () {
  'use strict';
  var S = window.JBR_PROGRESS, MATCH = window.JBR_MATCH;
  var META = null, PICK = {}, TEXT = {};
  var app = document.getElementById('app');
  var TYPES = { exam: 'Exam', test: 'Class test', topic: 'Topic deadline', list: 'Topic sheet' };
  // about how many marks a question set has (a mock paper for the date is its own thing, on the subject site)
  var MARKS = { exam: 50, test: 40, topic: 25, list: 40 };
  var MAX_ITEMS = 15;
  var showWeeks = false;

  // ------------------------------------------------------------------ small helpers
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function ymd(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function parse(s) { var p = s.split('-'); return new Date(+p[0], p[1] - 1, +p[2]); }
  function addDays(s, n) { var d = parse(s); d.setDate(d.getDate() + n); return ymd(d); }
  function daysBetween(a, b) { return Math.round((parse(b) - parse(a)) / 864e5); }
  var TODAY = ymd(new Date());
  function niceDate(s) { return parse(s).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }); }
  function inDays(s) {
    var n = daysBetween(TODAY, s);
    return n === 0 ? 'today' : n === 1 ? 'tomorrow' : n < 0 ? (-n === 1 ? 'yesterday' : -n + ' days ago') : 'in ' + n + ' days';
  }
  function el(html) { var d = document.createElement('div'); d.innerHTML = html.trim(); return d.firstElementChild; }
  function subj(s) { return META.subjects[s]; }
  function topicName(s, t) { var x = subj(s).topics.filter(function (y) { return y[0] === t; })[0]; return x ? x[1] : t; }
  function subjects() { return Object.keys(META.subjects); }

  function plan() {
    var P = S.get();
    if (!P.plan) P.plan = { t: 0 };
    var p = P.plan;
    p.events = p.events || []; p.sets = p.sets || []; delete p.done;
    p.settings = p.settings || { weekday: 1, weekend: 2, mins: 30 };
    return p;
  }
  function savePlan(soon) { plan().t = Date.now(); S.save(soon); }
  function topicsOf(e) { return e.topics && e.topics.length ? e.topics : subj(e.subj).topics.map(function (t) { return t[0]; }); }
  // how much a topic needs practice: more when you've got fewer of its marks, a little less when untried
  function need(ms) { return !ms ? 0.9 : ms.pct >= 0.75 && ms.n >= 3 ? 0.35 : ms.pct >= 0.5 ? 0.7 : 1; }

  // ------------------------------------------------------------------ the day-by-day plan
  // Each slot goes to the topic with the best mix of: a date coming up soon, low marks so far (or a red rating),
  // and not having been practised for a while. The day before a test or exam is a run-through of everything in it.
  function schedule(days) {
    var p = plan(), P = S.get(), evs = p.events.filter(function (e) { return e.date && e.date >= TODAY; });
    if (!evs.length) return [];
    var last = evs.reduce(function (m, e) { return Math.max(m, daysBetween(TODAY, e.date)); }, 0);
    var horizon = Math.min(days, last + 1);
    var M = {}, lastSeen = {};
    evs.forEach(function (e) { if (!M[e.subj]) M[e.subj] = S.mastery(e.subj); });
    Object.keys(P.items).forEach(function (k) {
      var v = P.items[k], d = -Math.floor((Date.now() - v.t) / 864e5);
      (v.tp || []).forEach(function (t) { var key = v.s + '|' + t; if (lastSeen[key] == null || d > lastSeen[key]) lastSeen[key] = d; });
    });
    var out = [];
    for (var d = 0; d < horizon; d++) {
      var date = addDays(TODAY, d), dow = parse(date).getDay();
      var slots = dow === 0 || dow === 6 ? +p.settings.weekend : +p.settings.weekday;
      var day = { date: date, events: evs.filter(function (e) { return e.date === date; }), sessions: [] }, used = {};
      evs.forEach(function (e) {
        if (e.type !== 'topic' && daysBetween(date, e.date) === 1 && day.sessions.length < Math.max(slots, 1)) {
          day.sessions.push({ kind: 'final', subj: e.subj, ev: e, key: date + '|final|' + e.id });
          topicsOf(e).forEach(function (t) { lastSeen[e.subj + '|' + t] = d; });
          used[e.subj] = 1;
        }
      });
      while (day.sessions.length < slots) {
        var best = null;
        evs.forEach(function (e) {
          var until = daysBetween(date, e.date);
          if (until < 1) return;
          var urgency = (e.type === 'test' ? 1.25 : 1) / (1 + until / 7);
          topicsOf(e).forEach(function (t, i) {
            var key = e.subj + '|' + t, since = lastSeen[key] == null ? 99 : d - lastSeen[key];
            if (since < 2) return;
            var score = urgency * need(M[e.subj][t]) * Math.min(1, since / 6) * (used[e.subj] ? 0.5 : 1) - i * 1e-6;
            if (!best || score > best.score) best = { score: score, subj: e.subj, t: t, ev: e, until: until };
          });
        });
        if (!best) break;
        var ms = M[best.subj][best.t];
        day.sessions.push({ kind: 'topic', subj: best.subj, t: best.t, ev: best.ev, key: date + '|' + best.subj + '|' + best.t,
          why: (best.ev.title || TYPES[best.ev.type]) + ' ' + (best.until === 1 ? 'tomorrow' : 'in ' + best.until + ' days') +
            (ms ? ' · ' + Math.round(ms.pct * 100) + '% of the marks so far' : '') });
        lastSeen[best.subj + '|' + best.t] = d; used[best.subj] = 1;
      }
      out.push(day);
    }
    return out;
  }

  // ------------------------------------------------------------------ picking questions
  function loadPick(s) {
    if (PICK[s]) return Promise.resolve(PICK[s]);
    return fetch('/study/' + s + '.json', { credentials: 'same-origin' }).then(function (r) {
      if (!r.ok) throw new Error('Could not load the ' + subj(s).subject + ' questions.');
      return r.json();
    }).then(function (j) { PICK[s] = j.q; return j.q; });
  }
  function hash(str) { var h = 2166136261; for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0) / 4294967295; }

  // The school board's questions on these topics: recent papers first, ones with a mark scheme, ones you haven't
  // done, spread across all the topics (weakest first) and across papers, until the marks add up.
  function pickSet(s, topics, target, avoid) {
    return loadPick(s).then(function (Q) {
      var T = {}, tl = subj(s).topics, P = S.get(), M = S.mastery(s), seed = String(Date.now());
      topics.forEach(function (t) { T[t] = 1; });
      var w = {};
      topics.forEach(function (t) { w[t] = need(M[t]); });
      var cands = Q.map(function (e) {
        if (avoid[e[0]]) return null;
        var rel = e[6].filter(function (p) { return p[3].some(function (i) { return tl[i] && T[tl[i][0]]; }); });
        if (!rel.length) return null;
        var tps = {};
        rel.forEach(function (p) { p[3].forEach(function (i) { if (tl[i] && T[tl[i][0]]) tps[tl[i][0]] = 1; }); });
        var mk = rel.reduce(function (a, p) { return a + (p[2] || 0); }, 0) || e[1];
        var tried = rel.filter(function (p) { return P.items[s + '|' + (p[0] ? e[0] + '/' + p[0] : e[0])]; }).length / rel.length;
        return { e: e, rel: rel, mk: mk, tps: Object.keys(tps), tried: tried, whole: rel.length === e[6].length };
      }).filter(Boolean);
      var covered = {}, perPaper = {}, chosen = [], total = 0, ideal = Math.max(3, Math.min(8, target / 8));
      while (total < target && cands.length) {
        var bi = -1, bs = -1e9;
        for (var i = 0; i < cands.length; i++) {
          var c = cands[i], paper = c.e[0].replace(/-q\d+$/, '');
          var cover = c.tps.reduce(function (a, t) { return a + w[t] / (1 + 1.5 * (covered[t] || 0)); }, 0);
          // questions of about an eighth of the set each (3 to 8 marks) keep it spread across the topics
          var sc = 1.4 * cover + 0.5 * Math.max(0, Math.min(1, (c.e[2] - 2012) / 12)) + 0.5 * c.e[3] + 0.6 * (1 - c.tried) +
            0.3 * (c.mk / c.e[1]) - 0.12 * Math.abs(c.mk - ideal) - 0.6 * (perPaper[paper] || 0) - (c.mk > target - total + 4 ? 1.2 : 0) + 0.35 * hash(c.e[0] + seed);
          if (sc > bs) { bs = sc; bi = i; }
        }
        var pick = cands.splice(bi, 1)[0];
        chosen.push(pick); total += pick.mk;
        pick.tps.forEach(function (t) { covered[t] = (covered[t] || 0) + 1; });
        var pp = pick.e[0].replace(/-q\d+$/, ''); perPaper[pp] = (perPaper[pp] || 0) + 1;
      }
      var order = {};
      tl.forEach(function (t, i) { order[t[0]] = i; });
      chosen.sort(function (a, b) { return (order[a.tps[0]] - order[b.tps[0]]) || (a.mk - b.mk); });
      return chosen.map(function (c) {
        var labels = c.whole ? '' : ' ' + c.rel.map(function (p) { return p[1]; }).join(', ');
        return { q: c.e[0], k: c.rel[0][0], parts: c.whole ? null : c.rel.map(function (p) { return p[0]; }), mk: c.mk, full: c.e[1],
          label: c.e[4] + ' · Q' + c.e[5] + labels, tp: c.tps };
      });
    });
  }
  // ------------------------------------------------------------------ questions you got wrong, due for review
  // (the same spaced-repetition rule as the subject sites' Review page), on this date's topics
  function reviewItems(s, topics, Q, maxMarks) {
    var T = {}, P = S.get(), byId = {}, out = [], total = 0;
    topics.forEach(function (t) { T[t] = 1; });
    Q.forEach(function (e) { byId[e[0]] = e; });
    var due = Object.keys(P.items).map(function (k) {
      var v = P.items[k];
      if (v.s !== s || !(v.tp || []).some(function (t) { return T[t]; })) return null;
      var r = S.review(v);
      return r && r.now ? { k: k, v: v, due: r.due } : null;
    }).filter(Boolean).sort(function (a, b) { return a.due - b.due; });
    due.forEach(function (d) {
      var id = d.k.slice(d.k.indexOf('|') + 1), q = id.split('/')[0], part = id.split('/')[1] || null, e = byId[q];
      if (!e || total + d.v.m > maxMarks && out.length) return;
      var pl = part ? (e[6].filter(function (x) { return x[0] === part; })[0] || [])[1] : '';
      out.push({ q: q, k: part, parts: part ? [part] : null, mk: d.v.m, full: e[1], label: e[4] + ' · Q' + e[5] + (pl ? ' ' + pl : ''),
        tp: (d.v.tp || []).filter(function (t) { return T[t]; }), review: true, last: d.v.g });
      total += d.v.m;
    });
    return out;
  }

  // ------------------------------------------------------------------ picking by the topic sheet's lines
  function loadText(s) {
    if (TEXT[s]) return Promise.resolve(TEXT[s]);
    return fetch('/study/text/' + s + '.json', { credentials: 'same-origin' }).then(function (r) { return r.ok ? r.json() : {}; })
      .catch(function () { return {}; }).then(function (j) { TEXT[s] = j; return j; });
  }
  var STOP = {};
  ('about above after again also among and any are as at be because been before being below between both but by can could ' +
   'describe did does doing down during each explain few for from further give had has have how including into its ' +
   'know more most must not now off once only other out over own same should some state such than that the their them ' +
   'then there these they this those through under understand until use using very was were what when where which while ' +
   'who why will with would your able candidates students should identify recall including different between ' +
   'topic topics lesson lessons week revise revision check list learning objectives').split(' ').forEach(function (w) { STOP[w] = 1; });
  function stem(w) { return w.replace(/(ies)$/, 'y').replace(/(ing|ed|es|s)$/, '').slice(0, 9); }
  function words(t) {
    var out = {};
    String(t || '').toLowerCase().replace(/[^a-z0-9+\- ]+/g, ' ').split(/\s+/).forEach(function (w) {
      if (w.length > 2 && !STOP[w] && !/^\d+$/.test(w)) out[stem(w)] = 1;
    });
    return out;
  }
  // the points to revise: the lines of the topic sheet (not its headings), or else the names of the date's topics
  function pointsOf(e) {
    var lines = e.checklist && e.checklist.lines ? e.checklist.lines.map(function (x) { return x.line; }) : [];
    var caps = MATCH.capsAreHeadings(lines);
    lines = lines.filter(function (l) { return !MATCH.isHeading(l, caps) && Object.keys(words(l)).length; });
    if (lines.length) return lines.slice(0, 120);
    return topicsOf(e).map(function (t) { return topicName(e.subj, t); }).slice(0, 120);
  }
  // A shortlist of question parts to choose from: for each point, the parts whose wording shares the most
  // words with it (on the date's topics, or anywhere if they share a lot), taken in turn so every point gets some.
  function shortlist(s, topics, points, Q, X, avoid) {
    var T = {}, tl = subj(s).topics, P = S.get(), M = 160;
    topics.forEach(function (t) { T[t] = 1; });
    var pw = points.map(words), parts = [];
    Q.forEach(function (e) {
      if (avoid[e[0]]) return;
      var tx = X[e[0]] || {}, list = e[6].length ? e[6] : [[null, '', e[1], []]];
      list.forEach(function (p) {
        var id = p[0] ? e[0] + '/' + p[0] : e[0], tps = (p[3] || []).map(function (i) { return tl[i] && tl[i][0]; }).filter(Boolean);
        var onTopic = tps.some(function (t) { return T[t]; }), wording = tx[p[0] || '*'] || (p[0] ? '' : tx['*']) || '';
        var stemText = tx['*'] ? tx['*'].split('(a)')[0].slice(0, 150) : '';
        if (p[0] && wording && stemText.length > 25 && wording.length < 200) wording = stemText + ' … ' + wording;
        var w = words(wording), done = P.items[s + '|' + id];
        parts.push({ id: id, e: e, p: p, tps: tps, on: onTopic, w: w, wording: wording,
          base: (onTopic ? 1 : 0) + 0.3 * Math.max(0, Math.min(1, (e[2] - 2012) / 12)) + 0.2 * e[3] - (done ? 0.6 : 0) });
      });
    });
    var ranked = pw.map(function (w) {
      var keys = Object.keys(w);
      return parts.map(function (c) {
        var hit = 0;
        keys.forEach(function (k) { if (c.w[k]) hit++; });
        if (!hit && !c.on) return null;
        if (!c.on && hit < 2) return null;
        return { c: c, sc: hit / Math.sqrt(keys.length || 1) * 2 + c.base };
      }).filter(Boolean).sort(function (a, b) { return b.sc - a.sc; }).slice(0, 40);
    });
    var seen = {}, out = [];
    for (var r = 0; out.length < M && r < 40; r++) {
      for (var i = 0; i < ranked.length && out.length < M; i++) {
        var x = ranked[i][r];
        if (x && !seen[x.c.id]) { seen[x.c.id] = 1; out.push(x.c); }
      }
    }
    // topping up with on-topic parts if the points were short on wording to go on
    parts.filter(function (c) { return c.on && !seen[c.id]; }).sort(function (a, b) { return b.base - a.base; }).slice(0, Math.max(0, 60 - out.length))
      .forEach(function (c) { seen[c.id] = 1; out.push(c); });
    return out.slice(0, M);
  }
  // Picks for each line of the topic sheet in turn: the part whose wording shares the most of that line's key words,
  // then the next best, until the marks add up. All in your browser, free.
  function linePick(e, target, avoid) {
    var s = e.subj, points = pointsOf(e), topics = topicsOf(e);
    return Promise.all([loadPick(s), loadText(s)]).then(function (r) {
      var cands = shortlist(s, topics, points, r[0], r[1], avoid), byId = {};
      if (!cands.length) return { items: [], uncovered: [] };
      cands.forEach(function (c) { byId[c.id] = c; });
      var ranked = points.map(function (pt) {
        var keys = Object.keys(words(pt)), need = Math.min(2, keys.length);
        return cands.map(function (c) {
          var hit = keys.filter(function (k) { return c.w[k]; }).length;
          return hit >= need && hit ? { c: c, sc: hit + c.base * 0.5 } : null;
        }).filter(Boolean).sort(function (x, y) { return y.sc - x.sc; });
      });
      var j = { picks: [], uncovered: [] }, used = {}, total = 0;
      ranked.forEach(function (rk, i) { if (!rk.length) j.uncovered.push(i + 1); });
      for (var round = 0; round < 6 && total < target; round++) {
        for (var i = 0; i < ranked.length && total < target; i++) {
          var x = ranked[i].filter(function (y) { return !used[y.c.id]; })[0];
          if (!x) continue;
          used[x.c.id] = 1; total += x.c.p[2] || x.c.e[1];
          var own = x.c.wording.split(' … ').pop().replace(/\s+/g, ' ').trim();
          j.picks.push({ id: x.c.id, point: i + 1, why: own.length > 110 ? own.slice(0, 107) + '…' : own });
        }
      }
      return (function () {
        // parts of the same question go together, in the order they were picked
          var items = [], byQ = {};
          (j.picks || []).forEach(function (pk) {
            var c = byId[pk.id];
            if (!c) return;
            var point = points[pk.point - 1] || '', it = byQ[c.e[0]];
            if (!it) {
              it = byQ[c.e[0]] = { q: c.e[0], k: c.p[0], parts: c.p[0] ? [] : null, mk: 0, full: c.e[1], label: c.e[4] + ' · Q' + c.e[5], tp: [], why: [], all: c.e[6] };
              items.push(it);
            }
            if (c.p[0]) it.parts.push(c.p[0]);
            it.mk += c.p[2] || c.e[1];
            c.tps.forEach(function (t) { if (it.tp.indexOf(t) < 0) it.tp.push(t); });
            it.why.push({ point: point.slice(0, 140), why: pk.why });
          });
          // every part picked means the whole question
          items.forEach(function (it) {
            if (it.parts) {
              var order = it.all.map(function (x) { return x[0]; });
              it.parts.sort(function (a, b) { return order.indexOf(a) - order.indexOf(b); });
              it.k = it.parts[0];
              if (it.parts.length < it.all.length) it.label += ' ' + it.parts.map(function (k) { return it.all[order.indexOf(k)][1]; }).join(', ');
              else it.parts = null;
            }
            delete it.all;
          });
          return { items: items, uncovered: (j.uncovered || []).map(function (n) { return points[n - 1]; }).filter(Boolean).slice(0, 20) };
      })();
    });
  }
  function makeSet(e, extra) {
    var p = plan(), avoid = {};
    p.sets.forEach(function (x) { if (x.ev === e.id) x.items.forEach(function (it) { avoid[it.q] = 1; }); });
    var target = MARKS[e.type] || 40;
    return loadPick(e.subj).then(function (Q) {
      // questions you got wrong that are due again come first, up to about a third of the set
      var rev = reviewItems(e.subj, topicsOf(e), Q, Math.round(target / 3));
      rev.forEach(function (it) { avoid[it.q] = 1; });
      var rest = Math.max(10, target - rev.reduce(function (a, it) { return a + it.mk; }, 0));
      busy('Picking questions…');
      return linePick(e, rest, avoid).then(function (r) {
        if (r.items.length) return { items: r.items, lines: true, uncovered: r.uncovered };
        return pickSet(e.subj, topicsOf(e), rest, avoid).then(function (items) { return { items: items }; });
      }).then(function (r) {
        var items = rev.concat(r.items).slice(0, MAX_ITEMS);
        if (!items.length) throw new Error('No ' + subj(e.subj).subject + ' questions left on those topics.');
        var n = p.sets.filter(function (x) { return x.ev === e.id; }).length;
        p.sets.unshift({ id: uid(), ev: e.id, subj: e.subj, title: (e.title || TYPES[e.type]) + (n ? ' (set ' + (n + 1) + ')' : ''), made: Date.now(),
          items: items, total: items.reduce(function (a, it) { return a + it.mk; }, 0), lines: !!r.lines, uncovered: r.uncovered || [], reviews: rev.length });
        savePlan(true);
        if (!extra) render();
        return p.sets[0];
      });
    });
  }
  // a set opens on its subject site, one question at a time (#/set/<id>, or #/set/<id>/<n> for its nth question)
  function setLink(set, n) { return '/' + set.subj + '/#/set/' + encodeURIComponent(set.id) + (n != null ? '/' + n : ''); }
  // done since the set was made (a review question you got wrong before only counts once you've had another go)
  function itemDone(set, it, P) {
    return (it.parts || [it.k]).every(function (k) { var r = P.items[set.subj + '|' + (k ? it.q + '/' + k : it.q)]; return r && r.t >= (set.made || 0); });
  }
  function setDone(set) {
    var P = S.get();
    return set.items.filter(function (it) {
      return itemDone(set, it, P);
    }).length;
  }
  // a mock paper for a date: the subject site builds it from the date's topics (timer, marking, printing are there)
  function mockFor(e) {
    try {
      localStorage.setItem('jbr-mock-preset-' + e.subj, JSON.stringify({ title: e.title || TYPES[e.type], topics: topicsOf(e),
        marks: { exam: 110, test: 50, topic: 30, list: 50 }[e.type] || 50, t: Date.now() }));
    } catch (x) { /* storage blocked: the mock page still works, with every topic */ }
    location.href = '/' + e.subj + '/#/mock';
  }

  // ------------------------------------------------------------------ reading a topic sheet
  var pdfjs = null;
  function loadPdfJs() {
    if (pdfjs) return pdfjs;
    pdfjs = new Promise(function (ok, fail) {
      var s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
      s.onload = function () {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        ok(window.pdfjsLib);
      };
      s.onerror = function () { pdfjs = null; fail(new Error('Could not load the PDF reader. Try pasting the text instead.')); };
      document.head.appendChild(s);
    });
    return pdfjs;
  }
  // the PDF's text, line by line (pieces on the same baseline joined left to right)
  function pdfText(file) {
    return Promise.all([loadPdfJs(), file.arrayBuffer()]).then(function (r) {
      return r[0].getDocument({ data: r[1] }).promise;
    }).then(function (doc) {
      var pages = [];
      for (var i = 1; i <= Math.min(doc.numPages, 30); i++) pages.push(doc.getPage(i).then(function (pg) { return pg.getTextContent(); }));
      return Promise.all(pages);
    }).then(function (contents) {
      return contents.map(function (c) {
        var rows = {};
        c.items.forEach(function (it) {
          if (!it.str || !it.str.trim()) return;
          var y = Math.round(it.transform[5] / 3) * 3;
          (rows[y] = rows[y] || []).push(it);
        });
        return Object.keys(rows).sort(function (a, b) { return b - a; }).map(function (y) {
          return rows[y].sort(function (a, b) { return a.transform[4] - b.transform[4]; }).map(function (it) { return it.str; }).join(' ');
        }).join('\n');
      }).join('\n');
    });
  }
  function readFile(file) {
    if (/\.pdf$/i.test(file.name) || file.type === 'application/pdf') return pdfText(file);
    if (/\.(docx?|pages|png|jpe?g|heic)$/i.test(file.name)) return Promise.reject(new Error('That file type can\'t be read here. Save it as a PDF, or copy the text and paste it in.'));
    return file.text();
  }

  // ------------------------------------------------------------------ add / edit a date
  function editor(existing) {
    var e = existing ? JSON.parse(JSON.stringify(existing)) : { id: uid(), type: 'test', subj: subjects()[0], title: '', date: addDays(TODAY, 14), topics: [] };
    var matched = existing && existing.checklist ? existing.checklist.lines || [] : [];
    var d = el('<dialog class="pl-dialog"><form method="dialog" class="pl-form"></form></dialog>');
    var f = d.querySelector('form');
    function draw() {
      var sm = subj(e.subj), chosen = {};
      e.topics.forEach(function (t) { chosen[t] = 1; });
      var byArea = {};
      sm.topics.forEach(function (t) { (byArea[t[2]] = byArea[t[2]] || []).push(t); });
      f.innerHTML = '<h2>' + (existing ? 'Edit “' + esc(existing.title) + '”' : 'Add a date') + '</h2>' +
        '<div class="pl-types" role="radiogroup">' + Object.keys(TYPES).map(function (k) {
          return '<label><input type="radio" name="type" value="' + k + '"' + (e.type === k ? ' checked' : '') + '><span>' + TYPES[k] + '</span></label>';
        }).join('') + '</div>' +
        '<div class="pl-row"><label>Subject<select name="subj">' + subjects().map(function (s) {
          return '<option value="' + s + '"' + (s === e.subj ? ' selected' : '') + '>' + esc(subj(s).subject) + '</option>';
        }).join('') + '</select></label>' +
        '<label>' + (e.type === 'list' ? 'Date (optional)' : 'Date') + '<input type="date" name="date" value="' + esc(e.date || '') + '"' + (e.type === 'list' ? '' : ' required') + '></label></div>' +
        '<label class="pl-wide">Name<input name="title" maxlength="80" value="' + esc(e.title) + '" placeholder="' +
          esc({ exam: sm.subject + ' Paper 1', test: sm.subject + ' end of topic test', topic: 'Finish revising…', list: sm.subject + ' topic sheet' }[e.type]) + '"></label>' +
        '<fieldset class="pl-check"><legend>Topic sheet</legend><p>Upload your topic sheet or checklist (PDF or text), or paste it below. The topics on it are ticked for you, and questions are picked whose wording matches each line.</p>' +
          '<div class="pl-row"><input type="file" name="file" accept=".pdf,.txt,.md,.csv,text/plain,application/pdf"><button type="button" class="pl-btn ghost read">Match pasted text</button></div>' +
          '<textarea name="paste" rows="3" placeholder="…or paste the topic sheet here"></textarea><div class="pl-matched"></div></fieldset>' +
        '<fieldset class="pl-topics"><legend>Topics' + (e.type === 'exam' ? ' (none ticked = the whole course)' : '') + '</legend>' +
          '<div class="pl-tbar"><button type="button" class="linkish all">Tick all</button> · <button type="button" class="linkish none">Clear</button> · <span class="pl-count"></span></div>' +
          Object.keys(byArea).map(function (a) {
            return '<div class="pl-area"><div class="pl-ah">' + esc(sm.areas[a] || a) + '</div>' + byArea[a].map(function (t) {
              return '<label><input type="checkbox" name="t" value="' + esc(t[0]) + '"' + (chosen[t[0]] ? ' checked' : '') + '> ' + esc(t[1]) + '</label>';
            }).join('') + '</div>';
          }).join('') + '</fieldset>' +
        (existing ? '' : '<label class="pl-also"><input type="checkbox" name="pick" checked> Pick practice questions for it straight away</label>') +
        '<p class="pl-err" role="alert"></p>' +
        '<div class="pl-actions">' + (existing ? '<button type="button" class="pl-btn ghost danger del">Delete this date</button>' : '') +
          '<button type="button" class="pl-btn ghost cancel">Cancel</button><button type="submit" class="pl-btn">Save</button></div>';
      drawMatched();
      count();
      f.querySelectorAll('[name=type]').forEach(function (r) { r.addEventListener('change', function () { keep(); e.type = r.value; draw(); }); });
      f.querySelector('[name=subj]').addEventListener('change', function (ev) { keep(); e.subj = ev.target.value; e.topics = []; matched = []; draw(); });
      f.querySelectorAll('[name=t]').forEach(function (c) { c.addEventListener('change', count); });
      f.querySelector('.all').addEventListener('click', function () { f.querySelectorAll('[name=t]').forEach(function (c) { c.checked = true; }); count(); });
      f.querySelector('.none').addEventListener('click', function () { f.querySelectorAll('[name=t]').forEach(function (c) { c.checked = false; }); count(); });
      f.querySelector('.cancel').addEventListener('click', function () { d.close(); });
      var del = f.querySelector('.del');
      if (del) del.addEventListener('click', function () {
        if (!confirm('Delete “' + (existing.title || TYPES[existing.type]) + '” and its question sets?')) return;
        var p = plan();
        p.events = p.events.filter(function (x) { return x.id !== existing.id; });
        p.sets = p.sets.filter(function (x) { return x.ev !== existing.id; });
        savePlan(true); d.close(); render();
      });
      f.querySelector('[name=file]').addEventListener('change', function (ev) {
        var file = ev.target.files[0];
        if (!file) return;
        status('Reading ' + file.name + '…');
        readFile(file).then(function (text) { useText(text, file.name); }, function (err) { status(err.message, true); });
      });
      f.querySelector('.read').addEventListener('click', function () {
        var t = f.querySelector('[name=paste]').value;
        if (t.trim()) useText(t, 'pasted text'); else status('Paste your topic sheet into the box first.', true);
      });
    }
    function keep() {
      e.title = f.querySelector('[name=title]').value.trim();
      e.date = f.querySelector('[name=date]').value;
      e.topics = Array.prototype.map.call(f.querySelectorAll('[name=t]:checked'), function (c) { return c.value; });
    }
    function count() {
      var n = f.querySelectorAll('[name=t]:checked').length, all = f.querySelectorAll('[name=t]').length;
      f.querySelector('.pl-count').textContent = n ? n + ' of ' + all + ' ticked' : e.type === 'exam' ? 'whole course' : 'none ticked';
    }
    function status(msg, bad) { var m = f.querySelector('.pl-matched'); m.innerHTML = '<p class="' + (bad ? 'pl-err' : 'pl-note') + '">' + esc(msg) + '</p>'; }
    function useText(text, from) {
      var r = MATCH.match(subj(e.subj), text);
      if (!r.length) { status('No lines were found in ' + from + '.', true); return; }
      matched = r.map(function (x) { return { line: x.line.slice(0, 200), topic: x.topic, sure: x.sure }; });
      var tick = {};
      matched.forEach(function (x) { if (x.topic) tick[x.topic] = 1; });
      f.querySelectorAll('[name=t]').forEach(function (c) { if (tick[c.value]) c.checked = true; });
      if (!f.querySelector('[name=title]').value && from !== 'pasted text') f.querySelector('[name=title]').value = from.replace(/\.[a-z]+$/i, '').replace(/[_-]+/g, ' ').slice(0, 80);
      count(); drawMatched();
    }
    // each line and the topic it went to; any of them can be changed
    function drawMatched() {
      var box = f.querySelector('.pl-matched');
      if (!matched.length) { box.innerHTML = ''; return; }
      var sm = subj(e.subj), hit = matched.filter(function (x) { return x.topic; }).length;
      var opts = '<option value="">not a topic</option>' + sm.topics.map(function (t) { return '<option value="' + esc(t[0]) + '">' + esc(t[1]) + '</option>'; }).join('');
      box.innerHTML = '<p class="pl-note"><b>' + hit + ' of ' + matched.length + ' lines</b> matched to topics, and those topics are ticked below. Check any marked “?”.</p>' +
        '<ol class="pl-lines">' + matched.map(function (x, i) {
          return '<li class="' + (x.topic ? (x.sure ? '' : 'unsure') : 'miss') + '"><span>' + esc(x.line) + '</span><select data-i="' + i + '">' + opts + '</select></li>';
        }).join('') + '</ol>';
      box.querySelectorAll('select').forEach(function (s) {
        var x = matched[+s.getAttribute('data-i')];
        s.value = x.topic || '';
        s.addEventListener('change', function () {
          x.topic = s.value || null; x.sure = true;
          if (x.topic) { var c = f.querySelector('[name=t][value="' + x.topic.replace(/"/g, '') + '"]'); if (c) c.checked = true; }
          s.parentNode.className = x.topic ? '' : 'miss'; count();
        });
      });
    }
    f.addEventListener('submit', function (ev) {
      ev.preventDefault();
      keep();
      var err = f.querySelector(':scope > .pl-err');
      if (e.type !== 'list' && !e.date) { err.textContent = 'Choose a date.'; return; }
      if (e.type !== 'exam' && !e.topics.length) { err.textContent = 'Tick at least one topic (or upload a topic sheet).'; return; }
      if (!e.title) e.title = { exam: subj(e.subj).subject + ' exam', test: subj(e.subj).subject + ' test', topic: topicName(e.subj, e.topics[0]), list: subj(e.subj).subject + ' topic sheet' }[e.type];
      if (matched.length) e.checklist = { lines: matched, t: Date.now() };
      var p = plan(), i = p.events.map(function (x) { return x.id; }).indexOf(e.id);
      if (i >= 0) p.events[i] = e; else p.events.push(e);
      var pick = !existing && f.querySelector('[name=pick]') && f.querySelector('[name=pick]').checked;
      savePlan(true);
      d.close();
      if (pick) { busy('Picking questions…'); makeSet(e).catch(function (x) { alert(x.message); render(); }); } else render();
    });
    draw();
    d.addEventListener('close', function () { d.remove(); });
    document.body.appendChild(d);
    d.showModal();
  }
  function busy(text) { var b = document.querySelector('.pl-busy'); if (b) b.textContent = text; }

  // ------------------------------------------------------------------ calendar file
  function ics() {
    var p = plan(), lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//JB Revision//Planner//EN', 'CALSCALE:GREGORIAN'];
    var stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
    function ev(id, date, title, desc) {
      var dt = date.replace(/-/g, ''), next = addDays(date, 1).replace(/-/g, '');
      lines.push('BEGIN:VEVENT', 'UID:' + id + '@josh-b-revision', 'DTSTAMP:' + stamp, 'DTSTART;VALUE=DATE:' + dt, 'DTEND;VALUE=DATE:' + next,
        'SUMMARY:' + title.replace(/[,;\\]/g, function (c) { return '\\' + c; }), desc ? 'DESCRIPTION:' + desc.replace(/[,;\\]/g, function (c) { return '\\' + c; }) : null, 'END:VEVENT');
    }
    p.events.forEach(function (e) { if (e.date) ev(e.id, e.date, TYPES[e.type] + ': ' + e.title, subj(e.subj).subject); });
    schedule(120).forEach(function (day) {
      day.sessions.forEach(function (s, i) {
        ev('s' + day.date + i, day.date, s.kind === 'final' ? 'Run-through: ' + s.ev.title : 'Revise ' + subj(s.subj).subject + ': ' + topicName(s.subj, s.t),
          s.kind === 'final' ? 'Everything on it, the day before' : s.why);
      });
    });
    lines.push('END:VCALENDAR');
    var blob = new Blob([lines.filter(Boolean).join('\r\n')], { type: 'text/calendar' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = 'revision-plan.ics';
    document.body.appendChild(a); a.click(); a.remove();
  }

  // ------------------------------------------------------------------ the page
  function readiness(e) {
    var M = S.mastery(e.subj), ts = topicsOf(e), g = 0, m = 0;
    ts.forEach(function (t) { var ms = M[t]; if (ms) { g += ms.pct * ms.n; m += ms.n; } });
    return { pct: m ? g / m : 0, done: m };
  }
  function plural(n, w) { return n + ' ' + w + (n === 1 ? '' : 's'); }
  // a date's sets, newest first, named by the order they were made ("Set 3")
  function setsOf(e) {
    var list = plan().sets.filter(function (x) { return x.ev === e.id; });
    var byAge = list.slice().sort(function (a, b) { return (a.made || 0) - (b.made || 0); });
    list.forEach(function (x) { x._n = byAge.indexOf(x) + 1; });
    return list;
  }
  function setName(set) { return /full matches/.test(set.title) ? 'Exact matches' : 'Set ' + (set._n || 1); }

  function eventCard(e) {
    var sm = subj(e.subj), r = readiness(e), ts = topicsOf(e), past = e.date && e.date < TODAY, whole = !e.topics || !e.topics.length;
    var chips = whole ? '<span class="pl-chip plain">The whole course</span>' : ts.slice(0, 6).map(function (t) {
      return '<a class="pl-chip" href="/' + e.subj + '/#/practise/' + encodeURIComponent(t) + '" title="Practise this topic">' + esc(topicName(e.subj, t)) + '</a>';
    }).join('') + (ts.length > 6 ? '<span class="pl-chip plain">+' + (ts.length - 6) + ' more</span>' : '');
    var c = el('<article class="pl-ev' + (past ? ' past' : '') + '" style="--c:' + esc(sm.color) + '">' +
      '<div class="pl-evhead"><div class="pl-evmeta"><span class="pl-type">' + TYPES[e.type] + '</span><span class="pl-subj">' + esc(sm.subject) + '</span></div>' +
      (e.date ? '<div class="pl-date"><b>' + niceDate(e.date) + '</b><span>' + inDays(e.date) + '</span></div>' : '') + '</div>' +
      '<h3>' + esc(e.title) + '</h3>' +
      '<div class="pl-ready"><div class="pl-bar" role="img" aria-label="' + Math.round(r.pct * 100) + '% of the marks"><i style="width:' + Math.round(r.pct * 100) + '%"></i></div>' +
        '<span>' + (r.done ? Math.round(r.pct * 100) + '% of the marks · ' + plural(r.done, 'part') + ' marked' : 'Nothing marked on these topics yet') + '</span></div>' +
      '<div class="pl-chips">' + chips + '</div>' +
      (past ? '' : '<div class="pl-evact"><button type="button" class="pl-btn newset">New question set</button><button type="button" class="pl-btn ghost mock">Mock paper</button>' +
        '<button type="button" class="pl-btn ghost edit">Edit</button></div>') +
      '<div class="pl-setlist"></div></article>');
    var box = c.querySelector('.pl-setlist'), sets = setsOf(e), showAll = false;
    function drawSets() {
      box.innerHTML = '';
      if (!sets.length) return;
      box.appendChild(el('<h4>Question sets</h4>'));
      (showAll ? sets : sets.slice(0, 3)).forEach(function (x) { box.appendChild(setRow(x)); });
      if (sets.length > 3) {
        var more = el('<button type="button" class="linkish pl-older">' + (showAll ? 'Show fewer' : 'Show ' + plural(sets.length - 3, 'older set')) + '</button>');
        more.addEventListener('click', function () { showAll = !showAll; drawSets(); });
        box.appendChild(more);
      }
    }
    drawSets();
    var ns = c.querySelector('.newset');
    if (ns) ns.addEventListener('click', function () {
      ns.disabled = true; ns.textContent = 'Picking questions…';
      makeSet(e, true).then(function () {
        busy(''); sets = setsOf(e); drawSets(); ns.disabled = false; ns.textContent = 'New question set';
        var row = box.querySelector('.pl-setrow');
        if (row) { row.classList.add('fresh'); row.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }
      }).catch(function (x) { busy(''); alert(x.message); ns.disabled = false; ns.textContent = 'New question set'; });
    });
    var mk = c.querySelector('.mock');
    if (mk) mk.addEventListener('click', function () { mockFor(e); });
    var ed = c.querySelector('.edit');
    if (ed) ed.addEventListener('click', function () { editor(e); });
    return c;
  }

  // one set under its date: progress, the way in, and (folded away) its questions
  function setRow(set) {
    var P = S.get(), done = setDone(set), n = set.items.length, all = done >= n;
    var row = el('<div class="pl-setrow"><div class="pl-setmain">' +
      '<div class="pl-setinfo"><b>' + esc(setName(set)) + '</b><span>' + plural(n, 'question') + ' · ' + set.total + ' marks</span></div>' +
      '<div class="pl-setprog"><div class="pl-bar"><i style="width:' + Math.round(done / Math.max(1, n) * 100) + '%"></i></div><span>' + done + '/' + n + '</span></div>' +
      '<a class="pl-btn small" href="' + setLink(set) + '">' + (all ? 'Go again' : done ? 'Continue' : 'Start') + '</a></div>' +
      '<details class="pl-setq"><summary>The questions</summary><ol>' + set.items.map(function (it, i) {
        var ok = itemDone(set, it, P);
        return '<li class="' + (ok ? 'ok' : '') + '"><a href="' + setLink(set, i) + '">' + esc(it.label) + '</a><span class="pl-mk">' + plural(it.mk, 'mark') + '</span>' +
          (it.review ? '<span class="pl-rv" title="You didn\'t get full marks last time, and it\'s due again">review</span>' : '') + '</li>';
      }).join('') + '</ol><button type="button" class="linkish pl-rm">Remove this set</button></details></div>');
    row.querySelector('.pl-rm').addEventListener('click', function () {
      if (!confirm('Remove ' + setName(set).toLowerCase() + ' of “' + set.title.replace(/ \(set \d+\)$|: full matches$/, '') + '”?')) return;
      plan().sets = plan().sets.filter(function (x) { return x.id !== set.id; });
      savePlan(true); render();
    });
    return row;
  }

  function planSection() {
    var p = plan(), days = schedule(showWeeks ? 42 : 14);
    var sec = el('<section class="pl-sec pl-plan"><div class="pl-h"><h2>Your plan</h2><div class="pl-set-row">' +
      '<label>Weekdays <select name="weekday">' + [0, 1, 2, 3, 4].map(function (n) { return '<option' + (+p.settings.weekday === n ? ' selected' : '') + '>' + n + '</option>'; }).join('') + '</select></label>' +
      '<label>Weekends <select name="weekend">' + [0, 1, 2, 3, 4, 5].map(function (n) { return '<option' + (+p.settings.weekend === n ? ' selected' : '') + '>' + n + '</option>'; }).join('') + '</select></label>' +
      '<label>Each <select name="mins">' + [20, 30, 45, 60].map(function (n) { return '<option value="' + n + '"' + (+p.settings.mins === n ? ' selected' : '') + '>' + n + ' min</option>'; }).join('') + '</select></label>' +
      '</div></div><p class="pl-note">Sessions a day, picked from the topics you\'re weakest at and the dates coming up soonest.</p><div class="pl-days"></div></section>');
    sec.querySelectorAll('select').forEach(function (x) {
      x.addEventListener('change', function () { p.settings[x.name] = +x.value; savePlan(); render(); });
    });
    var box = sec.querySelector('.pl-days');
    if (!days.length) {
      box.appendChild(el('<p class="pl-empty">Add a date coming up and your plan appears here.</p>'));
      return sec;
    }
    days.forEach(function (day) {
      if (!day.sessions.length && !day.events.length) return;
      var n = daysBetween(TODAY, day.date);
      var d = el('<div class="pl-day' + (n === 0 ? ' today' : '') + '"><div class="pl-dh">' + (n === 0 ? 'Today' : n === 1 ? 'Tomorrow' : niceDate(day.date)) + '</div><ul></ul></div>');
      var ul = d.querySelector('ul');
      day.events.forEach(function (e) {
        ul.appendChild(el('<li class="pl-s ev" style="--c:' + esc(subj(e.subj).color) + '"><span class="pl-dot"></span><span class="pl-st"><b>' + TYPES[e.type] + ': ' + esc(e.title) + '</b>Good luck!</span></li>'));
      });
      day.sessions.forEach(function (x) {
        var sm = subj(x.subj), final = x.kind === 'final';
        var set = final ? setsOf(x.ev).filter(function (y) { return setDone(y) < y.items.length; })[0] : null;
        var li = el('<li class="pl-s" style="--c:' + esc(sm.color) + '"><span class="pl-dot"></span>' +
          '<span class="pl-st"><b>' + (final ? 'Run-through: ' + esc(x.ev.title) : esc(sm.subject) + ': ' + esc(topicName(x.subj, x.t))) + '</b>' +
          (final ? 'Everything on it, the day before' : esc(x.why)) + '</span>' +
          '<span class="pl-min">' + p.settings.mins + ' min</span>' +
          (final ? (set ? '<a class="pl-go" href="' + setLink(set) + '">Do a set</a>' : '<button type="button" class="pl-go mk">Mock paper</button>') :
            '<a class="pl-go" href="/' + x.subj + '/#/practise/' + encodeURIComponent(x.t) + '">Practise</a>') + '</li>');
        var mk = li.querySelector('.mk');
        if (mk) mk.addEventListener('click', function () { mockFor(x.ev); });
        ul.appendChild(li);
      });
      box.appendChild(d);
    });
    var more = el('<button type="button" class="linkish pl-weeks">' + (showWeeks ? 'Show the next 2 weeks only' : 'Show the next 6 weeks') + '</button>');
    more.addEventListener('click', function () { showWeeks = !showWeeks; render(); });
    box.appendChild(more);
    return sec;
  }

  function render() {
    var p = plan(), y = window.scrollY;
    var up = p.events.filter(function (e) { return !e.date || e.date >= TODAY; }).sort(function (a, b) { return (a.date || '9999') < (b.date || '9999') ? -1 : 1; });
    var past = p.events.filter(function (e) { return e.date && e.date < TODAY; }).sort(function (a, b) { return a.date < b.date ? 1 : -1; }).slice(0, 4);
    var root = el('<div class="wrap pl"><header class="pl-head"><a class="pl-back" href="/">← All subjects</a>' +
      '<div class="pl-titlebar"><div><h1>Revision planner</h1><p class="subtitle">Your tests and exams, a plan to get ready for them, and question sets picked for each.</p></div>' +
      '<div class="pl-headact"><button type="button" class="pl-btn add">Add a date</button>' +
      (p.events.length ? '<button type="button" class="pl-btn ghost cal">Add to my calendar</button>' : '') + '</div></div></header>' +
      '<p class="pl-busy" aria-live="polite"></p>' +
      '<section class="pl-sec"><h2>Coming up</h2><div class="pl-evs"></div></section></div>');
    var evs = root.querySelector('.pl-evs');
    if (!up.length) evs.appendChild(el('<p class="pl-empty">Nothing yet. Add your exams and class tests (with their topics, or upload the topic sheet) and anything you want finished by a date.</p>'));
    up.forEach(function (e) { evs.appendChild(eventCard(e)); });
    root.appendChild(planSection());
    if (past.length) {
      var ps = el('<section class="pl-sec"><h2>Done</h2><div class="pl-evs"></div></section>');
      past.forEach(function (e) { ps.querySelector('.pl-evs').appendChild(eventCard(e)); });
      root.appendChild(ps);
    }
    root.appendChild(el('<footer><p>Saved to your account, so it\'s the same on every device. Past papers and mark schemes are © their exam boards.</p><nav class="site-foot" aria-label="About this site"><a href="/privacy">Privacy Policy</a><a href="/terms">Terms and Conditions</a><a href="#" data-cookie-settings>Cookie settings</a><span class="foot-email">contact@jbrevision.co.uk</span></nav></footer>'));
    root.querySelector('.add').addEventListener('click', function () { editor(null); });
    var cal = root.querySelector('.cal');
    if (cal) cal.addEventListener('click', ics);
    app.innerHTML = '';
    app.appendChild(root);
    window.scrollTo(0, y);
  }

  // ------------------------------------------------------------------ start
  Promise.all([
    fetch('/study-meta.json', { credentials: 'same-origin' }).then(function (r) {
      if (r.status === 401) { location.replace('/login'); throw new Error('signed out'); }
      return r.json();
    }),
    new Promise(function (ok) { S.pull(ok); })
  ]).then(function (r) { META = r[0]; render(); }).catch(function (e) {
    if (e.message !== 'signed out') app.innerHTML = '<p class="loading">Could not load the planner.</p>';
  });
  window.JBR_PLANNER = { schedule: function (n) { return schedule(n); }, pickSet: pickSet, plan: plan };
})();
