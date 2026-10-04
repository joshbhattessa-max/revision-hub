/* Matches the lines of a revision checklist to a subject's topics: spec point numbers first (1.12, 3.2.1 …),
   then the words of each topic (its name and its specification wording). */
(function (root) {
  'use strict';
  var STOP = ('the and for with that this from into their them they are was were been being have has had can could should would will ' +
    'about between using use used how what which when where who why than then also each other such these those there here more most ' +
    'some any all not but its it our your you yes able know understand describe explain recall including include includes ' +
    'identify state give show students should candidates need make made way ways different example examples types type ' +
    'simple basic key main role term terms meaning meant work works like well one two three per ' +
    'paper papers revision revise checklist topic topics unit units name class date tick rag confident chemistry biology physics maths ' +
    'mathematics geography science sciences computer computing gcse igcse higher foundation spec specification student').split(' ');
  var STOPSET = {};
  STOP.forEach(function (w) { STOPSET[w] = 1; });
  function stem(w) {
    if (w.length > 5 && /ies$/.test(w)) return w.slice(0, -3) + 'y';
    if (w.length > 6 && /ing$/.test(w)) return w.slice(0, -3);
    if (w.length > 5 && /ed$/.test(w)) return w.slice(0, -2);
    if (w.length > 4 && /es$/.test(w) && !/(ses|ces)$/.test(w)) return w.slice(0, -2);
    if (w.length > 3 && /s$/.test(w) && !/ss$/.test(w)) return w.slice(0, -1);
    return w;
  }
  function tokens(s) {
    return (String(s).toLowerCase().match(/[a-záéíóúñü]+/g) || []).filter(function (w) { return w.length > 2 && !STOPSET[w]; }).map(stem);
  }

  // build once per subject: meta = { topics: [[code, name, area]], search: {code: words}, points: {"1.12": code} }
  function index(meta) {
    var docs = meta.topics.map(function (t) {
      var w = {};
      tokens(meta.search[t[0]] || '').forEach(function (x) { w[x] = 1; });
      tokens(t[1].replace(/^[\w.()-]+\s/, '')).forEach(function (x) { w[x] = 2.5; });
      return w;
    });
    var df = {}, N = docs.length;
    docs.forEach(function (d) { Object.keys(d).forEach(function (x) { df[x] = (df[x] || 0) + 1; }); });
    var idf = {};
    Object.keys(df).forEach(function (x) { idf[x] = Math.log(1 + N / df[x]); });
    // topic codes that are themselves spec references (maths 1.4, geography 3.1.2.1, computer science 3.2.1), ranges expanded
    var codes = {};
    meta.topics.forEach(function (t) {
      var m = t[0].match(/^(\d+)\.(\d+)-(\d+)$/);
      if (m) for (var i = +m[2]; i <= +m[3]; i++) codes[m[1] + '.' + i] = t[0];
      else if (/^\d+(\.\d+)+$/.test(t[0])) codes[t[0]] = t[0];
    });
    return { meta: meta, docs: docs, idf: idf, codes: codes, points: meta.points || {} };
  }

  function byNumber(ix, line) {
    var nums = line.match(/(?:^|[\s(])(\d{1,2}(?:\.\d{1,2}){1,4})[A-Za-z]?(?=[\s).:,-]|$)/g) || [];
    for (var i = 0; i < nums.length; i++) {
      var n = nums[i].replace(/^[\s(]/, '').replace(/[A-Za-z]$/, '');
      if (ix.points[n]) return ix.points[n];
      var parts = n.split('.');
      while (parts.length > 1) {
        var c = parts.join('.');
        if (ix.codes[c]) return ix.codes[c];
        parts.pop();
      }
    }
    return null;
  }

  function scoreLine(ix, line) {
    var toks = tokens(line), seen = {}, uniq = [];
    toks.forEach(function (x) { if (!seen[x]) { seen[x] = 1; uniq.push(x); } });
    var best = null, second = null;
    ix.docs.forEach(function (d, i) {
      var s = 0;
      uniq.forEach(function (x) { if (d[x]) s += d[x] * (ix.idf[x] || 0); });
      if (!best || s > best.s) { second = best; best = { i: i, s: s }; } else if (!second || s > second.s) second = { i: i, s: s };
    });
    return { best: best, second: second, n: uniq.length };
  }

  // one checklist line -> { topic, how: 'number' | 'words', sure } or null
  // Lines that aren't topics: the sheet's own title, "Name: / Class:", the test's details (week, term, duration, "topics
  // assessed"), lead-ins ending in a colon ("You should be able to:") and titles in capitals (unless the whole sheet is)
  var HEADING = /\b(check ?list|revision list|topic list|topic sheet|learning objectives)\b|\b(name|class|date|teacher|form)\s*:/i;
  var DETAILS = /\bweek \d+\b|\b(autumn|spring|summer) (term|half)\b|\bduration\b|\b\d+\s*(mins?|minutes|hours?)\b|\btopics? (assessed|covered|tested|included)\b|\bsummary sheet\b|\byou should be able to\b|\b(cross[- ]?set|end of (topic|unit)|mock) (test|exam)\b|\b(year|yr) \d{1,2}\b/i;
  function shouting(l) {
    var letters = l.replace(/[^A-Za-z]/g, '');
    return letters.length >= 6 && letters.replace(/[^A-Z]/g, '').length / letters.length > 0.85;
  }
  // capitals only mean a heading when most of the sheet isn't in capitals
  function capsAreHeadings(ls) { return ls.filter(shouting).length <= ls.length / 2; }
  function isHeading(l, caps) {
    return HEADING.test(l) || DETAILS.test(l) || /:\s*$/.test(l) || (caps !== false && shouting(l));
  }
  function matchLine(ix, line, caps) {
    if (isHeading(line, caps)) return null;
    var n = byNumber(ix, line);
    if (n) return { topic: n, how: 'number', sure: true };
    var r = scoreLine(ix, line);
    if (!r.best || r.n === 0) return null;
    var need = 2.2 + 0.25 * Math.min(r.n, 8);
    if (r.best.s < need) return null;
    return { topic: ix.meta.topics[r.best.i][0], how: 'words', sure: !r.second || r.best.s > r.second.s * 1.35 };
  }

  // split pasted or extracted text into checklist lines
  function lines(text) {
    return String(text).replace(/\r/g, '').split(/\n|•|●|▪|◦|•|(?=\s\d{1,2}\.\d{1,2}[A-Z]?\s+[A-Za-z])/)
      .map(function (s) { return s.replace(/\s+/g, ' ').replace(/^[\s\-–*·☐□✓✔✗✘○]+/, '').trim(); })
      .filter(function (s) { return s.length >= 4 && /[A-Za-z]{3}/.test(s); });
  }

  function match(meta, text) {
    var ix = meta._ix || (meta._ix = index(meta));
    var ls = lines(text), caps = capsAreHeadings(ls);
    return ls.map(function (l) { var m = matchLine(ix, l, caps); return { line: l, topic: m ? m.topic : null, how: m ? m.how : null, sure: m ? m.sure : false, heading: isHeading(l, caps) }; });
  }

  var api = { match: match, lines: lines, tokens: tokens, isHeading: isHeading, capsAreHeadings: capsAreHeadings };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.JBR_MATCH = api;
})(this);
