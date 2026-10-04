/* Progress charts: your marks and the questions you've done over time, and your mock papers with the grade logged for
   each, drawn as SVG from your saved progress. Shared by the subject sites' My topics page and the main site's
   Progress page (the same file in both). Every chart can be saved as a picture. */
(function () {
  'use strict';
  var DAY = 864e5, WEEK = 7 * DAY, NS = 'http://www.w3.org/2000/svg';
  var FONT = "Inter, system-ui, -apple-system, 'Segoe UI', sans-serif";
  var RANGES = [['4w', '4 weeks', 28], ['3m', '3 months', 91], ['1y', '12 months', 365], ['all', 'All time', 0]];

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
  }
  function fmt(t, how) {
    return new Date(t).toLocaleDateString('en-GB', how === 'm' ? { month: 'short', year: '2-digit' } : how === 'y' ? { day: 'numeric', month: 'short', year: 'numeric' } : { day: 'numeric', month: 'short' });
  }

  // every attempt you've marked (each question keeps its last 8): { t, g, m, s, tp }
  function attempts(P, subj) {
    var out = [];
    Object.keys(P.items || {}).forEach(function (k) {
      var v = P.items[k];
      if (!v || (subj && v.s !== subj)) return;
      (v.h || [[v.t, v.g]]).forEach(function (x) { out.push({ t: x[0], g: x[1], m: v.m, s: v.s, tp: v.tp || [] }); });
    });
    return out.sort(function (a, b) { return a.t - b.t; });
  }

  // the time window for a range: from its start (or your first attempt, for all time) to now
  function window_(range, first) {
    var now = Date.now(), r = RANGES.filter(function (x) { return x[0] === range; })[0] || RANGES[1];
    var from = r[2] ? now - r[2] * DAY : Math.min(first || now, now - 28 * DAY);
    return { from: from, to: now };
  }
  // weeks (starting Monday) for up to 26 weeks, months beyond that
  function buckets(w) {
    var out = [], d;
    if (w.to - w.from <= 26 * WEEK) {
      d = new Date(w.from); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
      while (d.getTime() <= w.to) { var a = d.getTime(); d.setDate(d.getDate() + 7); out.push({ a: a, b: d.getTime(), label: fmt(a), unit: 'week' }); }
    } else {
      d = new Date(w.from); d.setHours(0, 0, 0, 0); d.setDate(1);
      while (d.getTime() <= w.to) { var a2 = d.getTime(); d.setMonth(d.getMonth() + 1); out.push({ a: a2, b: d.getTime(), label: fmt(a2, 'm'), unit: 'month' }); }
    }
    return out;
  }
  // per bucket: questions done, and the share of the marks you got
  function tally(list, bs) {
    return bs.map(function (b) {
      var n = 0, g = 0, m = 0;
      list.forEach(function (x) { if (x.t >= b.a && x.t < b.b) { n++; g += x.g; m += x.m; } });
      return { n: n, pct: m ? g / m : null, g: g, m: m };
    });
  }

  // ---------------------------------------------------------------- drawing
  // charts are drawn for the space they get: narrower and a little taller on a phone, so the text stays readable
  var W = 640, H = 230, L = 44, R = 16, T = 40, B = 34;
  function narrow() { return (window.innerWidth || 1000) < 600; }
  function size() { if (narrow()) { W = 360; H = 250; L = 38; R = 10; } else { W = 640; H = 230; L = 44; R = 16; } }
  // redraw when a phone turns sideways (or a window is resized) across the phone/desktop size
  var redraw = null, wasNarrow = null;
  function onResize(fn) {
    redraw = fn; wasNarrow = narrow();
    if (onResize.on) return;
    onResize.on = true;
    var t = null;
    window.addEventListener('resize', function () {
      clearTimeout(t);
      t = setTimeout(function () { if (redraw && narrow() !== wasNarrow) { wasNarrow = narrow(); redraw(); } }, 200);
    });
  }
  // the title, and the subtitle on one line or, if it's too long for the width (on a phone), two
  function frame(title, sub) {
    var lines = [sub || ''], fit = Math.floor(W / 5.6);
    if (sub && sub.length > fit) { var cut = sub.lastIndexOf(' ', fit); if (cut < 1) cut = fit; lines = [sub.slice(0, cut), sub.slice(cut + 1)]; }
    T = lines.length > 1 ? 54 : 40;
    return '<text x="0" y="16" font-size="14" font-weight="700" fill="currentColor">' + esc(title) + '</text>' +
      (sub ? lines.map(function (l, i) { return '<text x="0" y="' + (31 + i * 13) + '" font-size="10.5" fill="currentColor" fill-opacity=".6">' + esc(l) + '</text>'; }).join('') : '');
  }
  function xLabels(bs, X) {
    var step = Math.max(1, Math.ceil(bs.length / (W < 500 ? 4 : 8))), s = '', pick = [];
    bs.forEach(function (b, i) { if (!(i % step) || i === bs.length - 1) pick.push(i); });
    // the last label always shows; the one before it goes if they'd overlap
    if (pick.length > 1 && X(pick[pick.length - 1]) - X(pick[pick.length - 2]) < 46) pick.splice(pick.length - 2, 1);
    bs.forEach(function (b, i) {
      if (pick.indexOf(i) < 0) return;
      // labels at either end line up with the edge instead of hanging over it
      var x = X(i), anchor = x > W - 26 ? 'end' : x < L + 18 ? 'start' : 'middle';
      s += '<text x="' + (anchor === 'end' ? W - 2 : anchor === 'start' ? Math.max(2, x - 6) : x).toFixed(1) + '" y="' + (H - B + 16) + '" font-size="10" text-anchor="' + anchor + '" fill="currentColor" fill-opacity=".65">' + esc(b.label) + '</text>';
    });
    return s;
  }
  function yGrid(ticks, Y, label) {
    return ticks.map(function (v) {
      return '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + Y(v).toFixed(1) + '" y2="' + Y(v).toFixed(1) + '" stroke="currentColor" stroke-opacity=".12"/>' +
        '<text x="' + (L - 6) + '" y="' + (Y(v) + 3.5).toFixed(1) + '" font-size="10" text-anchor="end" fill="currentColor" fill-opacity=".65">' + esc(label(v)) + '</text>';
    }).join('');
  }
  function svg(body) {
    return '<svg xmlns="' + NS + '" viewBox="0 0 ' + W + ' ' + H + '" width="100%" role="img" style="font-family:' + FONT + ';display:block">' + body + '</svg>';
  }
  function niceMax(v) { var steps = [4, 8, 12, 20, 40, 60, 80, 100, 160, 200, 300, 400, 600, 800, 1000]; for (var i = 0; i < steps.length; i++) if (v <= steps[i]) return steps[i]; return Math.ceil(v / 500) * 500; }

  // lines: series = [{ name, color, vals: [0..1 or null per bucket], n: [count per bucket] }]
  function lineChart(title, sub, bs, series, refs) {
    size();
    var X = function (i) { return L + (W - L - R) * (bs.length === 1 ? 0.5 : i / (bs.length - 1)); };
    var Y = function (v) { return T + (H - T - B) * (1 - v); };
    var s = frame(title, sub) + yGrid([0, 0.25, 0.5, 0.75, 1], Y, function (v) { return Math.round(v * 100) + '%'; });
    (refs || []).forEach(function (r) {
      s += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + Y(r.v).toFixed(1) + '" y2="' + Y(r.v).toFixed(1) + '" stroke="currentColor" stroke-opacity=".35" stroke-dasharray="4 4"/>' +
        '<text x="' + (L + 4) + '" y="' + (Y(r.v) - 4).toFixed(1) + '" font-size="9.5" text-anchor="start" fill="currentColor" fill-opacity=".6">' + esc(r.label) + '</text>';
    });
    series.forEach(function (sr) {
      var seg = [], segs = [];
      sr.vals.forEach(function (v, i) { if (v == null) { if (seg.length) segs.push(seg); seg = []; } else seg.push([X(i), Y(v)]); });
      if (seg.length) segs.push(seg);
      segs.forEach(function (sg) {
        if (sg.length > 1) s += '<polyline points="' + sg.map(function (p) { return p[0].toFixed(1) + ',' + p[1].toFixed(1); }).join(' ') + '" fill="none" stroke="' + sr.color + '" stroke-width="2.4" stroke-linejoin="round"/>';
      });
      sr.vals.forEach(function (v, i) {
        if (v == null) return;
        s += '<circle cx="' + X(i).toFixed(1) + '" cy="' + Y(v).toFixed(1) + '" r="3.6" fill="' + sr.color + '"><title>' + esc((sr.name ? sr.name + ', ' : '') + bs[i].unit + ' of ' + bs[i].label + ': ' +
          Math.round(v * 100) + '% of the marks' + (sr.n ? ' on ' + sr.n[i] + ' question' + (sr.n[i] === 1 ? '' : 's') : '')) + '</title></circle>';
      });
    });
    return svg(s + xLabels(bs, X));
  }
  // stacked bars: series = [{ name, color, vals: [count per bucket] }]
  function barChart(title, sub, bs, series) {
    size();
    var tot = bs.map(function (b, i) { return series.reduce(function (a, sr) { return a + sr.vals[i]; }, 0); });
    var max = niceMax(Math.max.apply(null, tot.concat([4])));
    var slot = (W - L - R) / bs.length, bw = Math.min(34, slot * 0.7);
    var X = function (i) { return L + slot * (i + 0.5); };
    var Y = function (v) { return T + (H - T - B) * (1 - v / max); };
    var s = frame(title, sub) + yGrid([0, max / 4, max / 2, 3 * max / 4, max], Y, function (v) { return Math.round(v); });
    bs.forEach(function (b, i) {
      var y0 = 0;
      series.forEach(function (sr) {
        var v = sr.vals[i];
        if (!v) return;
        s += '<rect x="' + (X(i) - bw / 2).toFixed(1) + '" y="' + Y(y0 + v).toFixed(1) + '" width="' + bw.toFixed(1) + '" height="' + (Y(y0) - Y(y0 + v)).toFixed(1) + '" rx="2" fill="' + sr.color + '">' +
          '<title>' + esc((sr.name ? sr.name + ', ' : '') + b.unit + ' of ' + b.label + ': ' + v + ' question' + (v === 1 ? '' : 's')) + '</title></rect>';
        y0 += v;
      });
      if (tot[i] && series.length > 1) s += '<text x="' + X(i).toFixed(1) + '" y="' + (Y(tot[i]) - 4).toFixed(1) + '" font-size="9.5" text-anchor="middle" fill="currentColor" fill-opacity=".7">' + tot[i] + '</text>';
    });
    return svg(s + xLabels(bs, X));
  }
  // mock papers, placed by date: the % you got, with the grade logged when you saved it above each one
  function mockChart(title, sub, w, mocks, colorOf, refs) {
    size();
    var X = function (t) { return L + (W - L - R) * Math.max(0, Math.min(1, (t - w.from) / ((w.to - w.from) || 1))); };
    var Y = function (v) { return T + (H - T - B) * (1 - v); };
    var s = frame(title, sub) + yGrid([0, 0.25, 0.5, 0.75, 1], Y, function (v) { return Math.round(v * 100) + '%'; });
    (refs || []).forEach(function (r) {
      s += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + Y(r.v).toFixed(1) + '" y2="' + Y(r.v).toFixed(1) + '" stroke="currentColor" stroke-opacity=".35" stroke-dasharray="4 4"/>' +
        '<text x="' + (L + 4) + '" y="' + (Y(r.v) - 4).toFixed(1) + '" font-size="9.5" text-anchor="start" fill="currentColor" fill-opacity=".6">' + esc(r.label) + '</text>';
    });
    var by = {}, placed = [];
    mocks.forEach(function (m) { (by[m.s] = by[m.s] || []).push(m); });
    Object.keys(by).forEach(function (k) {
      var xs = by[k], c = colorOf(k);
      if (xs.length > 1) s += '<polyline points="' + xs.map(function (m) { return X(m.t).toFixed(1) + ',' + Y(m.pct).toFixed(1); }).join(' ') + '" fill="none" stroke="' + c + '" stroke-width="2" stroke-opacity=".55"/>';
      xs.forEach(function (m) {
        s += '<circle cx="' + X(m.t).toFixed(1) + '" cy="' + Y(m.pct).toFixed(1) + '" r="5" fill="' + c + '" stroke="#fff" stroke-width="1.5"><title>' +
          esc(fmt(m.t, 'y') + ': ' + m.got + '/' + m.max + ', ' + Math.round(m.pct * 100) + '%' + (m.grade ? ', grade ' + m.grade : '')) + '</title></circle>';
        var gx = X(m.t), ga = gx > W - 14 ? 'end' : 'middle', gy = Y(m.pct) - 9;
        // a grade that would sit on top of another one (mocks a few days apart) goes under its dot instead
        if (placed.some(function (q) { return Math.abs(q[0] - gx) < 16 && Math.abs(q[1] - gy) < 12; })) gy = Y(m.pct) + 18;
        placed.push([gx, gy]);
        if (m.grade) s += '<text x="' + (ga === 'end' ? W - 1 : gx).toFixed(1) + '" y="' + gy.toFixed(1) + '" font-size="10.5" font-weight="700" text-anchor="' + ga + '" fill="currentColor">' + esc(m.grade) + '</text>';
      });
    });
    var ticks = buckets(w), step = Math.max(1, Math.ceil(ticks.length / (W < 500 ? 4 : 7)));
    ticks.forEach(function (b, i) {
      if (i % step || b.a < w.from) return;
      var tx = X(b.a), ta = tx > W - 26 ? 'end' : 'middle';
      s += '<text x="' + (ta === 'end' ? W - 2 : tx).toFixed(1) + '" y="' + (H - B + 16) + '" font-size="10" text-anchor="' + ta + '" fill="currentColor" fill-opacity=".65">' + esc(b.label) + '</text>';
    });
    return svg(s);
  }

  // ---------------------------------------------------------------- a chart card with "Save as picture"
  function card(svgHtml, name, legend) {
    var d = document.createElement('figure');
    d.className = 'pc-card';
    d.innerHTML = svgHtml + (legend && legend.length > 1 ? '<figcaption class="pc-legend">' + legend.map(function (l) {
      return '<span><i style="background:' + l.color + '"></i>' + esc(l.name) + '</span>';
    }).join('') + '</figcaption>' : '') + '<button type="button" class="pc-save">Save as picture</button>';
    d.querySelector('.pc-save').addEventListener('click', function () { savePng(d.querySelector('svg'), name, legend); });
    return d;
  }
  function bgOf(el) {
    for (var n = el; n && n.nodeType === 1; n = n.parentNode) {
      var c = getComputedStyle(n).backgroundColor;
      if (c && c !== 'transparent' && !/rgba\(.*,\s*0\)$/.test(c)) return c;
    }
    return '#ffffff';
  }
  function savePng(el, name, legend) {
    var vb = el.viewBox.baseVal, extra = legend && legend.length > 1 ? 24 : 0, pad = 16, scale = 2;
    var clone = el.cloneNode(true);
    clone.setAttribute('width', vb.width); clone.setAttribute('height', vb.height);
    var color = getComputedStyle(el).color, bg = bgOf(el);
    var leg = '', x = pad;
    (extra ? legend : []).forEach(function (l) {
      leg += '<rect x="' + x + '" y="' + (pad + vb.height + 8) + '" width="10" height="10" rx="2" fill="' + l.color + '"/><text x="' + (x + 14) + '" y="' + (pad + vb.height + 17) + '" font-size="11" fill="' + color + '">' + esc(l.name) + '</text>';
      x += 26 + l.name.length * 6.2;
    });
    var outer = '<svg xmlns="' + NS + '" width="' + (vb.width + 2 * pad) + '" height="' + (vb.height + 2 * pad + extra) + '" style="font-family:' + FONT + '">' +
      '<rect width="100%" height="100%" fill="' + bg + '"/><g transform="translate(' + pad + ',' + pad + ')" style="color:' + color + '">' +
      new XMLSerializer().serializeToString(clone) + '</g>' + leg + '</svg>';
    var img = new Image();
    img.onload = function () {
      var c = document.createElement('canvas');
      c.width = (vb.width + 2 * pad) * scale; c.height = (vb.height + 2 * pad + extra) * scale;
      var g = c.getContext('2d'); g.scale(scale, scale); g.drawImage(img, 0, 0);
      c.toBlob(function (blob) {
        var a = document.createElement('a');
        a.href = URL.createObjectURL(blob); a.download = name.replace(/[^\w-]+/g, '-').toLowerCase() + '.png';
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
      }, 'image/png');
    };
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(outer);
  }

  // range buttons: 4 weeks / 3 months / 12 months / all time
  function rangeButtons(cur, onPick) {
    var d = document.createElement('div');
    d.className = 'pc-ranges'; d.setAttribute('role', 'group'); d.setAttribute('aria-label', 'Time range');
    RANGES.forEach(function (r) {
      var b = document.createElement('button');
      b.type = 'button'; b.textContent = r[1];
      if (r[0] === cur) b.className = 'on';
      b.setAttribute('aria-pressed', r[0] === cur ? 'true' : 'false');
      b.addEventListener('click', function () { onPick(r[0]); });
      d.appendChild(b);
    });
    return d;
  }

  window.JBR_CHARTS = { RANGES: RANGES, attempts: attempts, window: window_, buckets: buckets, tally: tally,
    lineChart: lineChart, barChart: barChart, mockChart: mockChart, card: card, rangeButtons: rangeButtons, savePng: savePng, onResize: onResize };
})();
