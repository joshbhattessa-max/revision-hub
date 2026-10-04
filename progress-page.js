/* Your progress: every subject together, over time. The questions you've done each week, the share of the marks you
   got, and your mock papers with the grade logged for each when you handed it in. Drawn by charts.js from the same
   saved progress the subject sites use. */
(function () {
  'use strict';
  var S = window.JBR_PROGRESS, C = window.JBR_CHARTS;
  var app = document.getElementById('app');
  var META = null, range = '3m', only = '';

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
  }
  function el(html) { var d = document.createElement('div'); d.innerHTML = html.trim(); return d.firstElementChild; }
  function subj(s) { return META.subjects[s] || { subject: s, color: '#888' }; }
  function fmt(t) { return new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }); }

  function render() {
    var P = S.get(), keys = Object.keys(META.subjects), y = window.scrollY;
    var all = C.attempts(P, only || null), mocks = (P.mocks || []).filter(function (m) { return !only || m.s === only; });
    var root = el('<div class="wrap pl pg"><header class="top"><div class="brand"><div><a class="pl-back" href="/">← All subjects</a><h1>Your progress</h1>' +
      '<p class="subtitle">How you\'re doing over time, from the questions you mark and the mock papers you hand in.</p></div></div></header>' +
      '<div class="pc-tools"></div><div class="pc-grid"></div></div>');
    var tools = root.querySelector('.pc-tools'), grid = root.querySelector('.pc-grid');
    tools.appendChild(C.rangeButtons(range, function (r) { range = r; render(); }));
    var sel = el('<select class="pc-pick" aria-label="Which subjects"><option value="">All subjects</option>' + keys.map(function (k) {
      return '<option value="' + esc(k) + '"' + (k === only ? ' selected' : '') + '>' + esc(subj(k).subject) + '</option>';
    }).join('') + '</select>');
    sel.addEventListener('change', function () { only = sel.value; render(); });
    tools.appendChild(sel);

    if (!all.length && !mocks.length) {
      grid.appendChild(el('<p class="pl-empty">Nothing yet. Mark yourself on a few questions on any subject site, or hand in a mock paper, and your charts appear here.</p>'));
    } else {
      var first = Math.min(all.length ? all[0].t : Date.now(), mocks.length ? mocks[0].t : Date.now());
      var w = C.window(range, first), bs = C.buckets(w), unit = bs[0].unit;
      var shown = (only ? [only] : keys).filter(function (k) { return all.some(function (x) { return x.s === k; }); });
      var per = shown.map(function (k) {
        var t = C.tally(all.filter(function (x) { return x.s === k; }), bs);
        return { name: subj(k).subject, color: subj(k).color, n: t.map(function (x) { return x.n; }), pct: t.map(function (x) { return x.pct; }) };
      });
      var legend = per.map(function (p) { return { name: p.name, color: p.color }; });
      var label = only ? subj(only).subject : 'All subjects';
      if (per.length) {
        grid.appendChild(C.card(C.barChart('Questions done', label + ' · question parts you marked, each ' + unit, bs,
          per.map(function (p) { return { name: p.name, color: p.color, vals: p.n }; })), label + ' questions', legend));
        grid.appendChild(C.card(C.lineChart('Marks you got', label + ' · your share of the marks, each ' + unit, bs,
          per.map(function (p) { return { name: p.name, color: p.color, vals: p.pct, n: p.n }; })), label + ' marks', legend));
      }
      var inRange = mocks.filter(function (m) { return m.t >= w.from; });
      var mockLegend = [];
      inRange.forEach(function (m) { if (!mockLegend.some(function (l) { return l.name === subj(m.s).subject; })) mockLegend.push({ name: subj(m.s).subject, color: subj(m.s).color }); });
      grid.appendChild(inRange.length ? C.card(C.mockChart('Mock papers', label + ' · your score on each, with the grade logged when you handed it in', w, inRange,
        function (k) { return subj(k).color; }), label + ' mocks', mockLegend) :
        el('<div class="pc-card pc-empty"><b>Mock papers</b><p>None in this time. Each subject site has a Mock paper button: when you hand one in, its grade is worked out and logged here.</p></div>'));
    }
    if (mocks.length) {
      root.appendChild(el('<section class="pg-log"><h2>Mock papers handed in</h2><table><thead><tr><th>Date</th><th>Subject</th><th>Marks</th><th>%</th><th>Grade</th></tr></thead><tbody>' +
        mocks.slice().reverse().map(function (m) {
          return '<tr><td>' + fmt(m.t) + '</td><td><span class="pg-dot" style="background:' + esc(subj(m.s).color) + '"></span>' + esc(subj(m.s).subject) + '</td><td>' + m.got + ' / ' + m.max +
            '</td><td>' + Math.round(m.pct * 100) + '%</td><td>' + esc(m.grade || '–') + '</td></tr>';
        }).join('') + '</tbody></table></section>'));
    }
    root.appendChild(el('<footer><p>Only the questions you\'ve done and the mock papers you\'ve handed in are saved, to your account. Each question keeps its last 8 attempts.</p><nav class="site-foot" aria-label="About this site"><a href="/privacy">Privacy Policy</a><a href="/terms">Terms and Conditions</a><a href="#" data-cookie-settings>Cookie settings</a></nav></footer>'));
    app.innerHTML = '';
    app.appendChild(root);
    window.scrollTo(0, y);
  }

  Promise.all([
    fetch('/study-meta.json', { credentials: 'same-origin' }).then(function (r) {
      if (r.status === 401) { location.replace('/login'); throw new Error('signed out'); }
      return r.json();
    }),
    new Promise(function (ok) { S.pull(ok); })
  ]).then(function (r) { META = r[0]; render(); C.onResize(render); }).catch(function (e) {
    if (e.message !== 'signed out') app.innerHTML = '<p class="loading">Could not load your progress.</p>';
  });
})();
