/* "Your campus" on the home page: an isometric campus with a building for each subject that grows a floor as you
   make its topics secure. The subject you've worked on most recently has the crane; a finished building flies a
   flag; a tree is planted for every mock paper. Drawn from your progress (progress.js) and study-meta.json. */
window.JBR_CAMPUS = (function () {
  'use strict';
  var S = window.JBR_PROGRESS;
  var FLOORS = 8;
  var C = Math.cos(Math.PI / 6), SN = 0.5, K = 14;
  var B;
  function P(x, y, z) {
    var p = [(x - y) * C * K, ((x + y) * SN - z) * K];
    B.x0 = Math.min(B.x0, p[0]); B.x1 = Math.max(B.x1, p[0]); B.y0 = Math.min(B.y0, p[1]); B.y1 = Math.max(B.y1, p[1]);
    return p;
  }
  function pt(p) { return p[0].toFixed(1) + ',' + p[1].toFixed(1); }
  function poly(pts, fill, extra) {
    return '<polygon points="' + pts.map(function (p) { return pt(P(p[0], p[1], p[2])); }).join(' ') + '" fill="' + fill + '" stroke="' + fill + '" stroke-width=".4" stroke-linejoin="round"' + (extra || '') + '/>';
  }
  function box(x, y, z, w, d, h, pal, extra) {
    return poly([[x, y, z + h], [x + w, y, z + h], [x + w, y + d, z + h], [x, y + d, z + h]], pal[0], extra) +
      poly([[x, y + d, z], [x + w, y + d, z], [x + w, y + d, z + h], [x, y + d, z + h]], pal[1], extra) +
      poly([[x + w, y, z], [x + w, y + d, z], [x + w, y + d, z + h], [x + w, y, z + h]], pal[2], extra);
  }
  function line(a, b, stroke, w) {
    var p = P(a[0], a[1], a[2]), q = P(b[0], b[1], b[2]);
    return '<line x1="' + p[0].toFixed(1) + '" y1="' + p[1].toFixed(1) + '" x2="' + q[0].toFixed(1) + '" y2="' + q[1].toFixed(1) + '" stroke="' + stroke + '" stroke-width="' + (w || 1) + '" stroke-linecap="round"/>';
  }
  function hex(c) { return [parseInt(c.substr(1, 2), 16), parseInt(c.substr(3, 2), 16), parseInt(c.substr(5, 2), 16)]; }
  function mix(c, to, a) { var x = hex(c), y = hex(to); return 'rgb(' + x.map(function (v, i) { return Math.round(v * (1 - a) + y[i] * a); }).join(',') + ')'; }
  function shades(c) { return [mix(c, '#ffffff', 0.35), mix(c, '#ffffff', 0.08), mix(c, '#000000', 0.18)]; }
  function hash(s) { var h = 2166136261; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0) / 4294967295; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function isDark() {
    var t = document.documentElement.getAttribute('data-theme');
    return t ? t === 'dark' : !!(window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches);
  }

  // how built each subject is: secure topics count fully, developing 0.6, weak 0.3
  function stats(meta) {
    var P0 = S.get(), now = Date.now(), out = {};
    Object.keys(meta.subjects).forEach(function (s) {
      var M = S.mastery(s), ts = meta.subjects[s].topics, sum = 0, secure = 0;
      ts.forEach(function (t) { var l = S.level(M[t[0]]); sum += { secure: 1, developing: 0.6, weak: 0.3, none: 0 }[l]; if (l === 'secure') secure++; });
      out[s] = { built: ts.length ? sum / ts.length : 0, secure: secure, topics: ts.length, recent: 0, last: 0, marked: 0 };
    });
    var days = {};
    Object.keys(P0.items).forEach(function (k) {
      var v = P0.items[k], o = out[v.s];
      if (!o) return;
      days[new Date(v.t).toDateString()] = 1;
      o.marked++;
      if (now - v.t < 7 * 864e5) o.recent++;
      o.last = Math.max(o.last, v.t);
    });
    var streak = 0, d = new Date();
    if (!days[d.toDateString()]) d.setDate(d.getDate() - 1);  // today not started yet doesn't break the streak
    while (days[d.toDateString()]) { streak++; d.setDate(d.getDate() - 1); }
    return { subjects: out, marked: Object.keys(out).reduce(function (n, s) { return n + out[s].marked; }, 0), mocks: (P0.mocks || []).length, streak: streak };
  }

  function draw(meta, st) {
    B = { x0: 1e9, y0: 1e9, x1: -1e9, y1: -1e9 };
    var dark = isDark();
    var G = dark ? { grass: ['#3c4a3a', '#2f3a2e', '#263025'], path: ['#5a5650', '#4a4742', '#3e3b37'], slab: ['#6b6760', '#57534d', '#4a4641'], text: '#d8d5cf', sub: '#a3a09a', win: '#1d2228', lit: '#ffd77a' }
      : { grass: ['#cfe0c3', '#b5c9a8', '#9fb592'], path: ['#ebe5d8', '#d8d0bf', '#c6bca8'], slab: ['#e7e1d4', '#d2c9b6', '#bdb29c'], text: '#33312e', sub: '#6b6862', win: '#5d6b78', lit: '#ffd166' };
    var keys = Object.keys(meta.subjects);
    var SP = 6.2, W = 3.2;
    var plots = keys.map(function (s, i) { var row = i < 4 ? 0 : 1, col = row ? i - 4 + 0.5 : i; return { s: s, x: col * SP, y: row * SP }; });
    var crane = null;
    keys.forEach(function (s) { var o = st.subjects[s]; if (o.last && Date.now() - o.last < 14 * 864e5 && (!crane || o.last > st.subjects[crane].last)) crane = s; });
    var h = '';
    // ground and paths
    var gx = -2.2, gy = -2.2, gw = 4 * SP - SP + W + 4.4, gd = SP + W + 4.4;
    h += box(gx, gy, -0.6, gw, gd, 0.6, G.grass);
    h += poly([[gx, SP - 1.5, 0.01], [gx + gw, SP - 1.5, 0.01], [gx + gw, SP - 0.3, 0.01], [gx, SP - 0.3, 0.01]], G.path[0]);
    for (var c = 0; c < 4; c++) h += poly([[c * SP + W + 0.9, gy, 0.01], [c * SP + W + 1.9, gy, 0.01], [c * SP + W + 1.9, gy + gd, 0.01], [c * SP + W + 0.9, gy + gd, 0.01]], G.path[0]);
    // trees (one per mock paper, up to 14), behind and between the buildings
    var spots = [[-1.3, -1.3], [SP - 1.2, -1.4], [2 * SP - 1.2, -1.4], [3 * SP - 1.2, -1.4], [3 * SP + W + 1.2, 0.6], [3 * SP + W + 1.2, SP + 1.5],
      [-1.3, SP + 2], [-1.4, SP - 2.4], [SP * 3.5 + W - 0.6, SP + W + 1.4], [SP * 0.4, SP + W + 1.5], [SP * 1.6, -1.5], [SP * 2.6, -1.5], [SP * 1.1, SP - 2.6], [SP * 2.3, SP - 2.6]];
    var items = [];
    spots.slice(0, Math.min(st.mocks, spots.length)).forEach(function (sp) { items.push({ k: sp[0] + sp[1], svg: tree(sp[0], sp[1]) }); });
    plots.forEach(function (pl) { items.push({ k: pl.x + pl.y + W, svg: building(pl) }); });
    items.sort(function (a, b) { return a.k - b.k; }).forEach(function (it) { h += it.svg; });
    function tree(x, y) {
      var r = 0.55 + hash(x + ',' + y) * 0.25;
      return box(x - 0.12, y - 0.12, 0, 0.24, 0.24, 0.7, ['#9a7a55', '#8a6a48', '#765a3c']) +
        box(x - r, y - r, 0.6, 2 * r, 2 * r, 1.1, dark ? ['#4f7a4a', '#41663d', '#365633'] : ['#8cc084', '#73a96b', '#5e925a']) +
        box(x - r * 0.6, y - r * 0.6, 1.7, 1.2 * r, 1.2 * r, 0.55, dark ? ['#5b8a55', '#4b7546', '#3f623b'] : ['#9ccc93', '#82b77a', '#6ca266']);
    }
    function building(pl) {
      var sm = meta.subjects[pl.s], o = st.subjects[pl.s], x = pl.x, y = pl.y, out = '';
      var floors = Math.min(FLOORS, Math.round(o.built * FLOORS)), FH = 1.05, pal = shades(sm.color);
      out += '<g><title>' + esc(sm.subject) + ': ' + o.secure + ' of ' + o.topics + ' topics secure, ' + floors + ' of ' + FLOORS + ' floors</title>';
      out += box(x - 0.3, y - 0.3, 0, W + 0.6, W + 0.6, 0.22, G.slab);
      if (!floors) {
        // an empty plot: stakes and a sign
        [[x, y], [x + W, y], [x, y + W], [x + W, y + W]].forEach(function (c) { out += line([c[0], c[1], 0.22], [c[0], c[1], 0.9], '#c98b3c', 1.4); });
        out += line([x + W / 2, y + W, 0.22], [x + W / 2, y + W, 1.4], '#8a6a48', 1.4) + box(x + W / 2 - 0.6, y + W - 0.02, 1.2, 1.2, 0.04, 0.6, ['#fff', '#f4efe4', '#e2dccd']);
        return out + '</g>';
      }
      var top = 0.22 + floors * FH, mh = top + FH + 2.6, mx = x - 0.9, my = y - 0.9;
      if (pl.s === crane) {
        out += box(mx - 0.18, my - 0.18, 0.22, 0.36, 0.36, mh, ['#f7c04a', '#e8a92c', '#cc8f1c']);
        out += box(mx - 1.2, my - 0.3, mh - 0.5, 0.7, 0.6, 0.5, ['#aab2b9', '#8f979e', '#7a8289']);
        out += box(mx - 1.2, my - 0.12, mh, W + 2.6, 0.24, 0.24, ['#f7c04a', '#e8a92c', '#cc8f1c']);
      }
      var lit = Math.min(1, o.recent / 15);
      for (var f = 0; f < floors; f++) {
        var z = 0.22 + f * FH;
        out += box(x, y, z, W, W, FH, f === 0 ? [pal[0], mix(sm.color, '#000000', 0.05), mix(sm.color, '#000000', 0.25)] : pal);
        for (var i = 0; i < 3; i++) {
          var a = x + 0.35 + i * 1.0, on1 = hash(pl.s + f + 'l' + i) < lit, on2 = hash(pl.s + f + 'r' + i) < lit;
          out += poly([[a, y + W + 0.01, z + 0.3], [a + 0.55, y + W + 0.01, z + 0.3], [a + 0.55, y + W + 0.01, z + 0.8], [a, y + W + 0.01, z + 0.8]], on1 ? G.lit : G.win);
          var b2 = y + 0.35 + i * 1.0;
          out += poly([[x + W + 0.01, b2, z + 0.3], [x + W + 0.01, b2 + 0.55, z + 0.3], [x + W + 0.01, b2 + 0.55, z + 0.8], [x + W + 0.01, b2, z + 0.8]], on2 ? G.lit : G.win);
        }
      }
      out += box(x - 0.08, y - 0.08, top, W + 0.16, W + 0.16, 0.18, [mix(sm.color, '#ffffff', 0.55), mix(sm.color, '#ffffff', 0.3), mix(sm.color, '#000000', 0.05)]);
      if (floors === FLOORS) {
        out += line([x + W / 2, y + W / 2, top + 0.18], [x + W / 2, y + W / 2, top + 2.4], dark ? '#ddd' : '#555', 1.2) +
          poly([[x + W / 2, y + W / 2, top + 2.4], [x + W / 2 + 1.1, y + W / 2, top + 2.1], [x + W / 2, y + W / 2, top + 1.8]], sm.color);
      }
      if (pl.s === crane) {
        // scaffolding round the next floor and a crane lowering a block onto it
        if (floors < FLOORS) {
          [[x, y], [x + W, y], [x, y + W], [x + W, y + W]].forEach(function (c) { out += line([c[0], c[1], top], [c[0], c[1], top + FH], '#c98b3c', 1); });
          out += line([x, y + W, top + FH], [x + W, y + W, top + FH], '#c98b3c', 1) + line([x + W, y, top + FH], [x + W, y + W, top + FH], '#c98b3c', 1);
        }
        var hx = x + W / 2, hy = my, cp = P(hx, hy, mh), bp = P(hx, hy, top + FH + 0.5);
        out += '<g class="cm-hook"><line x1="' + cp[0].toFixed(1) + '" y1="' + cp[1].toFixed(1) + '" x2="' + bp[0].toFixed(1) + '" y2="' + bp[1].toFixed(1) + '" stroke="#555" stroke-width=".9"/>' +
          box(hx - 0.35, hy - 0.35, top + FH, 0.7, 0.7, 0.5, ['#efe6d4', '#dacdb5', '#c4b598']) +
          '<animateTransform attributeName="transform" type="translate" values="0 -6;0 0;0 -6" dur="5s" repeatCount="indefinite"/></g>';
      }
      return out + '</g>';
    }
    var pad = 10, vb = [B.x0 - pad, B.y0 - pad, B.x1 - B.x0 + 2 * pad, B.y1 - B.y0 + 2 * pad];
    return '<svg class="campus-art" viewBox="' + vb.map(function (v) { return v.toFixed(1); }).join(' ') + '" role="img" aria-label="Your revision campus" font-family="Inter, Segoe UI, Roboto, Helvetica, Arial, sans-serif">' + h + '</svg>';
  }

  function savePicture(svg) {
    var vb = svg.viewBox.baseVal, scale = 3;
    var copy = svg.cloneNode(true);
    copy.setAttribute('width', vb.width * scale); copy.setAttribute('height', vb.height * scale);
    copy.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    var bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    bg.setAttribute('x', vb.x); bg.setAttribute('y', vb.y); bg.setAttribute('width', vb.width); bg.setAttribute('height', vb.height);
    bg.setAttribute('fill', isDark() ? '#17171a' : '#f7f7f5');
    copy.insertBefore(bg, copy.firstChild);
    Array.prototype.forEach.call(copy.querySelectorAll('animate, animateTransform'), function (a) { a.remove(); });
    var img = new Image();
    img.onload = function () {
      var cv = document.createElement('canvas');
      cv.width = vb.width * scale; cv.height = vb.height * scale;
      cv.getContext('2d').drawImage(img, 0, 0);
      cv.toBlob(function (b) {
        var a = document.createElement('a');
        a.href = URL.createObjectURL(b); a.download = 'my-revision-campus.png';
        document.body.appendChild(a); a.click(); a.remove();
      });
    };
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(new XMLSerializer().serializeToString(copy));
  }

  function nextUp(meta) {
    var p = S.get().plan, today = new Date(); today.setHours(0, 0, 0, 0);
    if (!p || !p.events) return '';
    var up = p.events.filter(function (e) { return e.date && new Date(e.date + 'T00:00') >= today; }).sort(function (a, b) { return a.date < b.date ? -1 : 1; })[0];
    if (!up) return '';
    var n = Math.round((new Date(up.date + 'T00:00') - today) / 864e5);
    return '<span class="cm-next">Next: <b>' + esc(up.title) + '</b> ' + (n === 0 ? 'today' : n === 1 ? 'tomorrow' : 'in ' + n + ' days') + '</span>';
  }

  function mount(host) {
    Promise.all([
      fetch('/study-meta.json', { credentials: 'same-origin' }).then(function (r) { if (!r.ok) throw new Error('meta'); return r.json(); }),
      new Promise(function (ok) { S.pull(ok); })
    ]).then(function (r) {
      var meta = r[0];
      function paint() {
        var st = stats(meta), total = 0;
        Object.keys(st.subjects).forEach(function (s) { total += st.subjects[s].built; });
        var pct = Math.round(total / Object.keys(st.subjects).length * 100);
        host.innerHTML = '<div class="cm-card"><div class="cm-hud">' +
          '<span><b>' + pct + '%</b>campus built</span><span><b>' + st.marked + '</b>questions marked</span>' +
          '<span><b>' + st.mocks + '</b>mock papers</span><span><b>' + st.streak + '</b>day streak</span></div>' +
          draw(meta, st) +
          '<div class="cm-legend">' + Object.keys(meta.subjects).map(function (s) {
            var o = st.subjects[s], f = Math.min(FLOORS, Math.round(o.built * FLOORS));
            return '<a href="/' + s + '/#/topics" style="--c:' + meta.subjects[s].color + '"><i></i><span>' + esc(meta.subjects[s].subject) + '</span><em>' +
              (f === FLOORS ? 'finished' : f + ' of ' + FLOORS + ' floors') + '</em></a>';
          }).join('') + '</div>' +
          '<div class="cm-foot">' + (st.marked ? '' : '<span class="cm-tip">Mark yourself on any question to lay your first floor. Every secure topic builds higher; mock papers plant trees.</span>') +
          nextUp(meta) + '<span class="cm-btns"><a class="btn-quiet" href="/planner">Revision planner</a><button type="button" class="btn-quiet cm-save">Save picture</button></span></div></div>';
        host.querySelector('.cm-save').addEventListener('click', function () { savePicture(host.querySelector('.campus-art')); });
        if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) { var sv = host.querySelector('.campus-art'); if (sv.pauseAnimations) sv.pauseAnimations(); }
      }
      paint();
      // repaint when the theme changes so the ground matches the page
      new MutationObserver(paint).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    }).catch(function () { host.innerHTML = ''; });
  }
  return { mount: mount };
})();
