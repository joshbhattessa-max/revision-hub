/* "Your campus" on the home page: Merchant Taylors' School, drawn in isometric 3D and built by your revision.
   The 1933 red-brick core (Great Hall, quads, clock tower showing the real time, parade ground) is always there.
   Each subject has its own kind of building on its real site (labs with roof lights, a greenhouse, an observatory,
   a glass-roofed maths block, a modern computing block…) that grows through 8 stages as its topics become secure.
   Landmarks (library, dining hall, pitches, sports hall, pool, cricket centre…) unlock with good habits: questions
   marked, streaks, mock papers and the revision planner. Drawn from progress.js and study-meta.json. */
window.JBR_CAMPUS = (function () {
  'use strict';
  var S = window.JBR_PROGRESS;
  var STAGES = 8;
  var C = Math.cos(Math.PI / 6), SN = 0.5, K = 16;
  var B;  // drawn extent, for the viewBox

  // ------------------------------------------------------------------ isometric drawing
  function P(x, y, z) {
    var p = [(x - y) * C * K, ((x + y) * SN - z) * K];
    if (p[0] < B.x0) B.x0 = p[0]; if (p[0] > B.x1) B.x1 = p[0]; if (p[1] < B.y0) B.y0 = p[1]; if (p[1] > B.y1) B.y1 = p[1];
    return p;
  }
  function pts(list) { return list.map(function (q) { var p = P(q[0], q[1], q[2] || 0); return p[0].toFixed(1) + ',' + p[1].toFixed(1); }).join(' '); }
  function poly(list, fill, extra) {
    return '<polygon points="' + pts(list) + '" fill="' + fill + '" stroke="' + fill + '" stroke-width=".35" stroke-linejoin="round"' + (extra || '') + '/>';
  }
  function line(a, b, stroke, w, extra) {
    var p = P(a[0], a[1], a[2] || 0), q = P(b[0], b[1], b[2] || 0);
    return '<line x1="' + p[0].toFixed(1) + '" y1="' + p[1].toFixed(1) + '" x2="' + q[0].toFixed(1) + '" y2="' + q[1].toFixed(1) + '" stroke="' + stroke + '" stroke-width="' + (w || 1) + '" stroke-linecap="round"' + (extra || '') + '/>';
  }
  // a box: top, the +y face (front left) and the +x face (front right); the others are never seen
  function box(x, y, z, w, d, h, pal, extra) {
    return poly([[x, y, z + h], [x + w, y, z + h], [x + w, y + d, z + h], [x, y + d, z + h]], pal[0], extra) +
      poly([[x, y + d, z], [x + w, y + d, z], [x + w, y + d, z + h], [x, y + d, z + h]], pal[1], extra) +
      poly([[x + w, y, z], [x + w, y + d, z], [x + w, y + d, z + h], [x + w, y, z + h]], pal[2], extra);
  }
  // a thin horizontal band (stone string course, cornice) round a wall: just its two visible edges
  function band(x, y, z, w, d, h, pal) {
    return poly([[x, y + d, z], [x + w, y + d, z], [x + w, y + d, z + h], [x, y + d, z + h]], pal[1]) +
      poly([[x + w, y, z], [x + w, y + d, z], [x + w, y + d, z + h], [x + w, y, z + h]], pal[2]);
  }
  function flat(x, y, w, d, fill, z, extra) { return poly([[x, y, z || 0], [x + w, y, z || 0], [x + w, y + d, z || 0], [x, y + d, z || 0]], fill, extra); }
  // hipped roof: ridge along the longer side; pal = [front slope, side slope, ridge line]
  function hip(x, y, z, w, d, h, pal) {
    if (w >= d) {
      var r0 = x + d / 2, r1 = x + w - d / 2, ym = y + d / 2;
      return poly([[x, y + d, z], [x + w, y + d, z], [r1, ym, z + h], [r0, ym, z + h]], pal[0]) +
        poly([[x + w, y, z], [x + w, y + d, z], [r1, ym, z + h]], pal[1]) + line([r0, ym, z + h], [r1, ym, z + h], pal[2], 0.8);
    }
    var s0 = y + w / 2, s1 = y + d - w / 2, xm = x + w / 2;
    return poly([[x + w, y, z], [x + w, y + d, z], [xm, s1, z + h], [xm, s0, z + h]], pal[1]) +
      poly([[x, y + d, z], [x + w, y + d, z], [xm, s1, z + h]], pal[0]) + line([xm, s0, z + h], [xm, s1, z + h], pal[2], 0.8);
  }
  // SVG transforms that lay flat artwork on a wall: plane y = Y (faces +y) or plane x = X (faces +x); 1 unit = 1 grid unit
  function onY(x, Y, z) { var o = P(x, Y, z); return 'matrix(' + (C * K).toFixed(3) + ',' + (SN * K).toFixed(3) + ',0,' + K + ',' + o[0].toFixed(1) + ',' + o[1].toFixed(1) + ')'; }
  function onX(X, y, z) { var o = P(X, y, z); return 'matrix(' + (C * K).toFixed(3) + ',' + (-SN * K).toFixed(3) + ',0,' + K + ',' + o[0].toFixed(1) + ',' + o[1].toFixed(1) + ')'; }
  // rows of white sash windows along a face, storey by storey
  function winY(x0, x1, Y, z0, storeys, sh, step, glass, frame) {
    var out = '', n = Math.max(1, Math.floor((x1 - x0) / step));
    var gap = (x1 - x0) / n;
    for (var s = 0; s < storeys; s++) for (var i = 0; i < n; i++) {
      var a = x0 + gap * i + gap * 0.28, b = a + gap * 0.44, z = z0 + s * sh + sh * 0.28, t = z + sh * 0.5;
      out += poly([[a, Y + 0.01, z], [b, Y + 0.01, z], [b, Y + 0.01, t], [a, Y + 0.01, t]], frame) +
        poly([[a + 0.06, Y + 0.02, z + 0.06], [b - 0.06, Y + 0.02, z + 0.06], [b - 0.06, Y + 0.02, t - 0.06], [a + 0.06, Y + 0.02, t - 0.06]], glass);
    }
    return out;
  }
  function winX(y0, y1, X, z0, storeys, sh, step, glass, frame) {
    var out = '', n = Math.max(1, Math.floor((y1 - y0) / step));
    var gap = (y1 - y0) / n;
    for (var s = 0; s < storeys; s++) for (var i = 0; i < n; i++) {
      var a = y0 + gap * i + gap * 0.28, b = a + gap * 0.44, z = z0 + s * sh + sh * 0.28, t = z + sh * 0.5;
      out += poly([[X + 0.01, a, z], [X + 0.01, b, z], [X + 0.01, b, t], [X + 0.01, a, t]], frame) +
        poly([[X + 0.02, a + 0.06, z + 0.06], [X + 0.02, b - 0.06, z + 0.06], [X + 0.02, b - 0.06, t - 0.06], [X + 0.02, a + 0.06, t - 0.06]], glass);
    }
    return out;
  }
  // round-arched openings (the Great Hall's loggia) on a +x face
  function arcadeX(y0, y1, X, z, h, n, fill) {
    var out = '', gap = (y1 - y0) / n;
    for (var i = 0; i < n; i++) {
      var a = y0 + gap * (i + 0.18), b = y0 + gap * (i + 0.82), m = (a + b) / 2, r = (b - a) / 2, hs = h - r;
      var path = [[X + 0.01, a, z], [X + 0.01, b, z], [X + 0.01, b, z + hs]];
      for (var k = 1; k < 8; k++) { var t = Math.PI * k / 8; path.push([X + 0.01, m + r * Math.cos(t), z + hs + r * Math.sin(t)]); }
      path.push([X + 0.01, a, z + hs]);
      out += poly(path, fill);
    }
    return out;
  }
  function arcadeY(x0, x1, Y, z, h, n, fill) {
    var out = '', gap = (x1 - x0) / n;
    for (var i = 0; i < n; i++) {
      var a = x0 + gap * (i + 0.18), b = x0 + gap * (i + 0.82), m = (a + b) / 2, r = (b - a) / 2, hs = h - r;
      var path = [[a, Y + 0.01, z], [b, Y + 0.01, z], [b, Y + 0.01, z + hs]];
      for (var k = 1; k < 8; k++) { var t = Math.PI * k / 8; path.push([m + r * Math.cos(t), Y + 0.01, z + hs + r * Math.sin(t)]); }
      path.push([a, Y + 0.01, z + hs]);
      out += poly(path, fill);
    }
    return out;
  }
  function hex(c) { return [parseInt(c.substr(1, 2), 16), parseInt(c.substr(3, 2), 16), parseInt(c.substr(5, 2), 16)]; }
  function mix(c, to, a) { var x = hex(c), y = hex(to); return 'rgb(' + x.map(function (v, i) { return Math.round(v * (1 - a) + y[i] * a); }).join(',') + ')'; }
  function shades(c) { return [mix(c, '#ffffff', 0.3), mix(c, '#ffffff', 0.05), mix(c, '#000000', 0.2)]; }
  function hash(s) { var h = 2166136261; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0) / 4294967295; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function isDark() {
    var t = document.documentElement.getAttribute('data-theme');
    return t ? t === 'dark' : !!(window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches);
  }

  // ------------------------------------------------------------------ the school's materials (from photos of it)
  var BRICK = ['#b8775f', '#a95b42', '#8a4632'];        // 1933 red-brown brick: top, front-left, front-right
  var BRICK_NEW = ['#b98a6a', '#9c6a4b', '#7f533a'];     // the later flat-roofed blocks: a browner brick
  var TILE = ['#8b4a39', '#6f3a2c', '#5a2e23'];          // hipped plain-tile roofs
  var STONE = ['#f1e9da', '#e2d6bf', '#cbbd9f'];
  var SLATE = ['#9aa5ae', '#86919a', '#717c85'];         // the newer blocks' standing-seam metal roofs
  var FLATROOF = ['#dcdcd6', '#c6c6bf', '#b0b0a8'];
  var GLASS = ['#d9eef5', '#a9d2e3', '#86b8cf'];
  var CLAD = ['#6a737b', '#59626a', '#4a5259'];
  var WHITE = '#fbfaf6', PANE = '#3f4a55', PANE_LIT = '#ffd877', ARCH = '#4b3a33';

  // ------------------------------------------------------------------ progress -> campus
  function stats(meta) {
    var P0 = S.get(), now = Date.now(), out = {};
    Object.keys(meta.subjects).forEach(function (s) {
      var M = S.mastery(s), ts = meta.subjects[s].topics, sum = 0, secure = 0;
      ts.forEach(function (t) { var l = S.level(M[t[0]]); sum += { secure: 1, developing: 0.6, weak: 0.3, none: 0 }[l]; if (l === 'secure') secure++; });
      out[s] = { built: ts.length ? sum / ts.length : 0, secure: secure, topics: ts.length, recent: 0, last: 0, marked: 0 };
      out[s].stage = Math.min(STAGES, Math.round(out[s].built * STAGES));
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
    var plan = P0.plan || {};
    var keys = Object.keys(out);
    return {
      subjects: out, streak: streak, mocks: (P0.mocks || []).length,
      marked: keys.reduce(function (n, s) { return n + out[s].marked; }, 0),
      sessions: Object.keys(plan.done || {}).length, sets: (plan.sets || []).length,
      exam: (plan.events || []).some(function (e) { return e.type === 'exam'; }),
      finished: keys.filter(function (s) { return out[s].stage >= STAGES; }).length,
      allHalf: keys.every(function (s) { return out[s].stage >= 4; })
    };
  }

  // the landmarks and what unlocks each (n = how far along, need = target)
  function landmarks(st) {
    return [
      { id: 'library', name: 'Library', how: 'mark 25 questions', n: st.marked, need: 25 },
      { id: 'dining', name: 'Dining Hall', how: 'a 3-day streak', n: st.streak, need: 3 },
      { id: 'astro1', name: 'Astroturf pitch', how: 'finish a mock paper', n: st.mocks, need: 1 },
      { id: 'lecture', name: 'Lecture Theatre', how: 'pick a question set in the planner', n: st.sets, need: 1 },
      { id: 'exams', name: 'Exams Hall', how: 'add an exam to the planner', n: st.exam ? 1 : 0, need: 1 },
      { id: 'tennis', name: 'Tennis courts', how: 'tick off 5 planner sessions', n: st.sessions, need: 5 },
      { id: 'astro2', name: 'Floodlit astroturf', how: 'finish 3 mock papers', n: st.mocks, need: 3 },
      { id: 'music', name: 'Music School', how: 'a 7-day streak', n: st.streak, need: 7 },
      { id: 'sports', name: 'Sports Hall', how: 'finish 5 mock papers', n: st.mocks, need: 5 },
      { id: 'library2', name: 'Library extension', how: 'mark 250 questions', n: st.marked, need: 250 },
      { id: 'pool', name: 'Swimming Pool', how: 'finish 8 mock papers', n: st.mocks, need: 8 },
      { id: 'cricket', name: 'Indoor Cricket Centre', how: 'finish a subject (8 of 8)', n: st.finished, need: 1 },
      { id: 'manor', name: 'Manor of the Rose', how: 'get every subject to stage 4', n: st.allHalf ? 1 : 0, need: 1 },
      { id: 'water', name: 'Watersports Centre', how: 'a 30-day streak', n: st.streak, need: 30 }
    ].map(function (l) { l.on = l.n >= l.need; return l; });
  }

  // each subject's site on the campus map, and its kind of building
  var SITES = {
    chemistry: { x: 15.5, y: 2.6, w: 5.2, d: 2.8, kind: 'lab', label: 'Chemistry labs' },
    physics: { x: 21.4, y: 2.6, w: 5.2, d: 2.8, kind: 'observatory', label: 'Physics building' },
    maths: { x: 27.6, y: 6.2, w: 3, d: 5, kind: 'pyramid', label: 'Maths block' },
    biology: { x: 7.4, y: 6.6, w: 4.6, d: 2.8, kind: 'greenhouse', label: 'Biology building' },
    'computer-science': { x: 30.8, y: 15, w: 4.8, d: 3, kind: 'modern', label: 'Computing centre' },
    geography: { x: 25.6, y: 21, w: 4.6, d: 2.6, kind: 'weather', label: 'Geography building' },
    spanish: { x: 7.4, y: 11.6, w: 4.2, d: 2.8, kind: 'languages', label: 'Modern Languages' }
  };

  // ------------------------------------------------------------------ the picture
  function draw(meta, st, L) {
    B = { x0: 1e9, y0: 1e9, x1: -1e9, y1: -1e9 };
    var dark = isDark();
    var G = dark ? { grass: ['#33402f', '#28331f', '#212a1a'], grass2: '#2d3a29', stripe: '#36452f', path: '#56524b', road: '#3a3b40', tarmac: '#45464b', water: '#24414c', water2: '#2d4f5c', ghost: 'rgba(255,255,255,.4)', ghostFill: 'rgba(255,255,255,.06)', line: '#d9d6cf', tree: [['#3f6b3a', '#345a30', '#2b4b28'], ['#4b6e3a', '#3e5d30', '#334d28']] }
      : { grass: ['#c9dcb6', '#a9bf96', '#93a982'], grass2: '#bed3a8', stripe: '#c4d8af', path: '#e9e2d3', road: '#8f9196', tarmac: '#9b9ca0', water: '#9ecfdb', water2: '#b5dce5', ghost: 'rgba(60,50,40,.45)', ghostFill: 'rgba(60,50,40,.07)', line: '#ffffff', tree: [['#86b46f', '#6e9d5a', '#5b874a'], ['#9dbb6c', '#83a356', '#6e8b45']] };
    var on = {};
    L.forEach(function (l) { on[l.id] = l.on; });
    var items = [];  // {x0,y0,x1,y1, svg}: drawn back to front
    function add(x0, y0, x1, y1, svg) { items.push({ x0: x0, y0: y0, x1: x1, y1: y1, svg: svg }); }

    // ground: the estate, lake, roads, lawns
    var g = '';
    var EST = [[-3, -8], [44, -8], [44, 19], [37, 27.5], [-3, 27.5]];
    g += poly(EST.map(function (p) { return [p[0], p[1], 0]; }), G.grass[0]);
    for (var e = 1; e < EST.length; e++) {   // the estate's edge: only the sides facing us
      var a0 = EST[e - 1], a1 = EST[e];
      g += poly([[a0[0], a0[1], 0], [a1[0], a1[1], 0], [a1[0], a1[1], -0.7], [a0[0], a0[1], -0.7]], a1[0] < a0[0] ? G.grass[1] : G.grass[2]);
    }
    g += poly([[35.5, -8], [44, -8], [44, 15.5], [41.5, 13.5], [39, 14.5], [36.5, 11], [37.5, 7], [35, 4], [36.2, 0.5], [34.5, -3]].map(function (p) { return [p[0], p[1], 0.01]; }), G.water);
    g += poly([[39.5, -5.5], [43.6, -5.5], [43.6, 6], [41.5, 8.5], [40, 4], [38.6, 1]].map(function (p) { return [p[0], p[1], 0.02]; }), G.water2);
    g += poly([[37.2, 4.6], [39.2, 4], [39.6, 6], [38, 6.8]].map(function (p) { return [p[0], p[1], 0.03]; }), G.grass[0]);  // island
    // Long Drive from the main entrance (bottom right) along the lake to the school
    g += poly([[44, 18.2], [44, 19], [42.6, 20.7], [34.4, 25.2], [31.5, 21.5], [32.8, 21], [34.9, 23.7]].map(function (p) { return [p[0], p[1], 0.02]; }), G.road);
    g += poly([[31.5, 21.5], [32.8, 21], [33, 13.5], [31.8, 13.5]].map(function (p) { return [p[0], p[1], 0.02]; }), G.road);
    // paths and the parade ground (tarmac) behind the Great Hall
    g += flat(14.6, 5.8, 9.4, 5.6, G.tarmac, 0.02);
    g += flat(13, 19.6, 13, 1.1, G.path, 0.02) + flat(25.2, 11, 1, 10, G.path, 0.02) + flat(6.6, 10.2, 7.2, 0.9, G.path, 0.02);
    // the inner quad lawn (striped) and the front lawn with its flagpole
    g += flat(15.5, 12, 6, 6.4, G.grass2, 0.025);
    for (var q = 0; q < 6; q++) g += flat(15.5 + q, 12, 0.5, 6.4, G.stripe, 0.03);
    g += flat(26.6, 12, 3.6, 7.6, G.grass2, 0.025);
    // sports fields on the left: rugby/football pitches with white lines (always there)
    g += flat(-2, 19.6, 9.2, 7.6, G.stripe, 0.025);
    g += poly([[-1.5, 20.1, 0.04], [6.7, 20.1, 0.04], [6.7, 26.7, 0.04], [-1.5, 26.7, 0.04]], 'none', ' fill="none" stroke="' + G.line + '" stroke-width=".9" stroke-opacity=".8"');
    g += line([-1.5, 23.4, 0.04], [6.7, 23.4, 0.04], G.line, 0.8, ' stroke-opacity=".8"');
    [[2.6, 20.1], [2.6, 26.7]].forEach(function (p) { g += line([p[0] - 0.5, p[1], 0], [p[0] - 0.5, p[1], 1.4], G.line, 0.9) + line([p[0] + 0.5, p[1], 0], [p[0] + 0.5, p[1], 1.4], G.line, 0.9) + line([p[0] - 0.5, p[1], 0.6], [p[0] + 0.5, p[1], 0.6], G.line, 0.9); });

    // ---- the 1933 core: Great Hall, ranges round the quad, clock tower (always there)
    // Great Hall: tall hall, six stone-framed windows above a round-arched loggia, dormers in a long hipped roof
    add(22.2, 10.6, 25.6, 19.6, (function () {
      var x = 22.2, y = 10.6, w = 3.4, d = 9, h = 3.6, s = '';
      s += box(x, y, 0, w, d, h, BRICK);
      s += band(x - 0.05, y - 0.05, 1.25, w + 0.1, d + 0.1, 0.14, STONE);          // stone band over the loggia
      s += arcadeX(y + 0.4, y + d - 0.4, x + w, 0, 1.15, 7, ARCH);
      for (var i = 0; i < 6; i++) {                                                  // tall stone-framed windows
        var a = y + 0.95 + i * 1.32;
        s += poly([[x + w + 0.01, a - 0.08, 1.6], [x + w + 0.01, a + 0.62, 1.6], [x + w + 0.01, a + 0.62, 3.25], [x + w + 0.01, a - 0.08, 3.25]], STONE[1]) +
          poly([[x + w + 0.02, a, 1.7], [x + w + 0.02, a + 0.54, 1.7], [x + w + 0.02, a + 0.54, 3.15], [x + w + 0.02, a, 3.15]], PANE);
      }
      s += winY(x + 0.3, x + w - 0.3, y + d, 1.6, 1, 1.6, 1.1, PANE, WHITE);
      s += box(x - 0.08, y - 0.08, h, w + 0.16, d + 0.16, 0.16, STONE);           // cornice
      s += hip(x - 0.05, y - 0.05, h + 0.16, w + 0.1, d + 0.1, 1.6, TILE);
      for (var j = 0; j < 4; j++) s += box(x + w - 0.95, y + 1.6 + j * 2, h + 0.5, 0.45, 0.6, 0.45, ['#efe9df', '#e0d8ca', '#cfc5b3']); // dormers
      return '<g><title>The Great Hall (1933)</title>' + s + '</g>';
    })());
    // front range (two storeys) running left from the hall, facing the lawn; clock tower at its far end
    add(11.6, 18.4, 22.2, 20.6, (function () {
      var x = 11.6, y = 18.4, w = 10.6, d = 2.2, s = '';
      s += box(x, y, 0, w, d, 2.5, BRICK) + winY(x + 0.2, x + w - 0.2, y + d, 0, 2, 1.2, 0.95, PANE, WHITE);
      s += band(x - 0.04, y - 0.04, 1.2, w + 0.08, d + 0.08, 0.08, STONE) + hip(x - 0.05, y - 0.05, 2.5, w + 0.1, d + 0.1, 1.05, TILE);
      return s;
    })());
    // back range behind the quad, and the west range
    add(14.2, 9.4, 22.2, 11.4, box(14.2, 9.4, 0, 8, 2, 2.5, BRICK) + winY(14.4, 22, 11.4, 0, 2, 1.2, 0.95, PANE, WHITE) + hip(14.15, 9.35, 2.5, 8.1, 2.1, 1, TILE));
    add(13, 11.4, 15.2, 18.4, box(13, 11.4, 0, 2.2, 7, 2.5, BRICK) + winX(11.6, 18.2, 15.2, 0, 2, 1.2, 0.95, PANE, WHITE) + hip(12.95, 11.35, 2.5, 2.3, 7.1, 1, TILE));
    // clock tower: square brick tower with clock faces showing the real time and a small pyramid cap
    add(9.6, 18.6, 11.6, 20.6, (function () {
      var x = 9.8, y = 18.8, w = 1.6, s = '';
      s += box(x, y, 0, w, w, 6.4, BRICK);
      s += box(x - 0.08, y - 0.08, 6.4, w + 0.16, w + 0.16, 0.18, STONE);
      s += arcadeY(x + 0.1, x + w - 0.1, y + w, 0, 1.3, 1, ARCH);
      s += '<g transform="' + onY(x + w / 2, y + w + 0.01, 5.5) + '">' + clockFace() + '</g>';
      s += '<g transform="' + onX(x + w + 0.01, y + w / 2, 5.5) + '">' + clockFace() + '</g>';
      s += poly([[x - 0.05, y + w + 0.05, 6.58], [x + w + 0.05, y + w + 0.05, 6.58], [x + w / 2, y + w / 2, 7.6]], TILE[0]) +
        poly([[x + w + 0.05, y - 0.05, 6.58], [x + w + 0.05, y + w + 0.05, 6.58], [x + w / 2, y + w / 2, 7.6]], TILE[1]);
      s += line([x + w / 2, y + w / 2, 7.6], [x + w / 2, y + w / 2, 8.6], dark ? '#ccc' : '#5d5d5d', 0.9);
      return '<g><title>The Clock Tower (showing the time now)</title>' + s + '</g>';
    })());
    // front lawn flagpole
    add(28, 15.4, 28.2, 15.6, line([28.1, 15.5, 0], [28.1, 15.5, 4.2], dark ? '#ccc' : '#666', 0.9) +
      poly([[28.1, 15.5, 4.2], [29.2, 15.5, 3.9], [28.1, 15.5, 3.6]], '#3b5998'));
    // cricket pavilion by the pitches: white walls, red tile roof (from the photos)
    add(7.8, 22, 11.4, 24.2, box(7.8, 22, 0, 3.6, 2.2, 1.2, ['#fbfaf5', '#f2efe6', '#dedad0']) + arcadeY(7.9, 11.3, 24.2, 0, 0.9, 4, '#6b625a') +
      hip(7.65, 21.85, 1.2, 3.9, 2.5, 0.9, ['#a5473a', '#8a3a2f', '#702f26']));

    // ---- subject buildings
    var crane = null;
    Object.keys(SITES).forEach(function (s) {
      var o = st.subjects[s];
      if (o && o.stage < STAGES && o.last && Date.now() - o.last < 14 * 864e5 && (!crane || o.last > st.subjects[crane].last)) crane = s;
    });
    Object.keys(SITES).forEach(function (s) {
      if (!meta.subjects[s]) return;
      var site = SITES[s], o = st.subjects[s];
      var ext = site.kind === 'greenhouse' ? 1.8 : 0;  // the greenhouse sits on the +x end
      add(site.x - 0.4, site.y - 0.4, site.x + site.w + 0.4 + ext, site.y + site.d + 0.4,
        '<a href="/' + s + '/#/topics" class="cm-b"><title>' + esc(site.label) + ' · ' + esc(meta.subjects[s].subject) + ': stage ' + o.stage + ' of ' + STAGES +
        ' (' + o.secure + ' of ' + o.topics + ' topics secure). Tap for My topics.</title>' + subjectBuilding(s, site, o, meta.subjects[s].color, s === crane, dark) + '</a>');
    });

    // ---- landmarks: built when unlocked, otherwise a dashed outline of where they'll go
    function landmark(id, x0, y0, x1, y1, fn) {
      var l = L.filter(function (z) { return z.id === id; })[0];
      if (on[id]) { add(x0, y0, x1, y1, '<g><title>' + esc(l.name) + ' (unlocked)</title>' + fn() + '</g>'); return; }
      g += poly([[x0, y0, 0.05], [x1, y0, 0.05], [x1, y1, 0.05], [x0, y1, 0.05]], G.ghostFill, ' stroke="' + G.ghost + '" stroke-width="1.3" stroke-dasharray="5 4"><title>' +
        esc(l.name) + ': unlocks with ' + esc(l.how) + ' (' + Math.min(l.n, l.need) + ' of ' + l.need + ')</title></polygon');
    }
    landmark('library', 25.8, 6.4, 27.2, 10.8, function () {    // the library: tall windows, next to the hall
      return box(25.8, 6.4, 0, 1.4, 4.4, 3, BRICK) + winX(6.6, 10.6, 27.2, 0.4, 1, 2.2, 0.9, PANE, STONE[0]) + box(25.75, 6.35, 3, 1.5, 4.5, 0.14, STONE) + hip(25.75, 6.35, 3.14, 1.5, 4.5, 0.8, TILE);
    });
    landmark('library2', 22.4, 6.4, 25.4, 9.2, function () {
      return box(22.4, 6.4, 0, 3, 2.8, 2.4, BRICK) + winY(22.6, 25.2, 9.2, 0, 2, 1.1, 0.9, PANE, WHITE) + hip(22.35, 6.35, 2.4, 3.1, 2.9, 1, TILE) +
        box(23.55, 7.45, 3.3, 0.7, 0.7, 0.6, STONE) + poly([[23.5, 8.2, 3.9], [24.3, 8.2, 3.9], [23.9, 7.8, 4.4]], TILE[0]);   // lantern
    });
    landmark('dining', 11, 3.4, 14.6, 6.8, function () {
      return box(11, 3.4, 0, 3.6, 3.4, 2.2, BRICK) + arcadeY(11.2, 14.4, 6.8, 0, 1.1, 4, ARCH) + winX(3.6, 6.6, 14.6, 1.1, 1, 1, 0.8, PANE, WHITE) + hip(10.95, 3.35, 2.2, 3.7, 3.5, 1.3, TILE);
    });
    landmark('music', 7.4, 2.4, 10.4, 5.2, function () {
      return box(7.4, 2.4, 0, 3, 2.8, 1.9, BRICK) + winY(7.6, 10.2, 5.2, 0, 1, 1.9, 0.9, PANE, WHITE) + hip(7.35, 2.35, 1.9, 3.1, 2.9, 1.1, TILE) +
        '<text transform="' + onY(8.1, 5.21, 1.65) + '" font-size=".55" fill="#fbfaf6">♪</text>';
    });
    landmark('exams', 28, 1.4, 31.6, 4.6, function () {
      return box(28, 1.4, 0, 3.6, 3.2, 2.6, BRICK) + winY(28.2, 31.4, 4.6, 0.3, 1, 2, 1.2, PANE, STONE[0]) + winX(1.6, 4.4, 31.6, 0.3, 1, 2, 1, PANE, STONE[0]) +
        hip(27.95, 1.35, 2.6, 3.7, 3.3, 1.2, TILE);
    });
    landmark('lecture', 34.4, 18.4, 37.6, 21.6, function () {   // octagonal lecture theatre, slate roof (from the aerial photo)
      var cx = 36, cy = 20, r = 1.55, ring = [];
      for (var i = 0; i < 8; i++) { var a = Math.PI / 8 + i * Math.PI / 4; ring.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); }
      var s = '';
      for (var j = 0; j < 8; j++) {
        var p = ring[j], q = ring[(j + 1) % 8], nx = (p[0] + q[0]) / 2 - cx, ny = (p[1] + q[1]) / 2 - cy;
        if (nx + ny <= 0.1) continue;   // only the faces turned towards us
        s += poly([[p[0], p[1], 0], [q[0], q[1], 0], [q[0], q[1], 2.2], [p[0], p[1], 2.2]], nx > ny ? BRICK_NEW[2] : BRICK_NEW[1]);
      }
      return s + poly(ring.map(function (p) { return [p[0], p[1], 2.2]; }), SLATE[0]) + poly(ring.map(function (p) { return [cx + (p[0] - cx) * 0.45, cy + (p[1] - cy) * 0.45, 2.9]; }), SLATE[1]);
    });
    landmark('tennis', -1.6, 10.6, 5.4, 18.6, function () {     // blue courts in a green surround with nets
      var s = flat(-1.6, 10.6, 7, 8, '#4b8f55', 0.05);
      [[-1.1, 11.1], [2.2, 11.1], [-1.1, 14.9], [2.2, 14.9]].forEach(function (c) {
        s += flat(c[0], c[1], 2.9, 3.4, '#3f74b5', 0.06) + poly([[c[0] + 0.2, c[1] + 0.2, 0.07], [c[0] + 2.7, c[1] + 0.2, 0.07], [c[0] + 2.7, c[1] + 3.2, 0.07], [c[0] + 0.2, c[1] + 3.2, 0.07]], 'none', ' fill="none" stroke="#fff" stroke-width=".6"') +
          box(c[0] + 0.1, c[1] + 1.68, 0.06, 2.7, 0.04, 0.3, ['#fff', '#e8e8e8', '#d0d0d0']);
      });
      return s;
    });
    landmark('astro1', 0.6, 4.4, 6.6, 9.6, function () { return astro(0.6, 4.4, 6, 5.2, false); });
    landmark('astro2', -2.4, -2.6, 4.4, 3.6, function () { return astro(-2.4, -2.6, 6.8, 6.2, true); });
    landmark('sports', 20.6, -4.8, 27.2, 0.4, function () {      // big sports hall: brick base, white roof
      return box(20.6, -4.8, 0, 6.6, 5.2, 3, BRICK_NEW) + box(20.5, -4.9, 3, 6.8, 5.4, 0.25, ['#f3f3ef', '#e2e2dc', '#cfcfc8']) +
        winY(20.9, 27, 0.4, 0.4, 1, 1.4, 1.2, GLASS[2], STONE[0]);
    });
    landmark('pool', 13.8, -4.2, 19.6, 0.6, function () {
      return box(13.8, -4.2, 0, 5.8, 4.8, 2.2, BRICK_NEW) + box(13.7, -4.3, 2.2, 6, 5, 0.18, FLATROOF) +
        poly([[14.4, -3.6, 2.4], [19, -3.6, 2.4], [19, -0.2, 3.2], [14.4, -0.2, 3.2]], GLASS[0]) + winY(14, 19.4, 0.6, 0.2, 1, 1.6, 0.8, GLASS[2], WHITE);
    });
    landmark('cricket', 2.2, -7, 12.6, -2.4, function () {        // long building with a dark barrel roof (map no. 26)
      var s = box(2.2, -7, 0, 10.4, 4.6, 1.4, CLAD), prev = null;
      for (var i = 0; i <= 10; i++) {
        var t = Math.PI * i / 10, yy = -7 + 2.3 - 2.3 * Math.cos(t), zz = 1.4 + 1.6 * Math.sin(t);
        if (prev) {
          s += poly([[2.2, prev[0], prev[1]], [12.6, prev[0], prev[1]], [12.6, yy, zz], [2.2, yy, zz]], i > 5 ? '#4a4f55' : '#5c6268');
          s += poly([[12.6, prev[0], 1.4], [12.6, yy, 1.4], [12.6, yy, zz], [12.6, prev[0], prev[1]]], '#3f4449');
        }
        prev = [yy, zz];
      }
      return s;
    });
    landmark('manor', 14.4, 23.4, 18.8, 26.8, function () {        // Manor of the Rose: a gabled brick house
      return box(14.4, 23.4, 0, 4.4, 3.4, 2.3, BRICK) + winY(14.6, 18.6, 26.8, 0, 2, 1.1, 0.9, PANE, WHITE) + winX(23.6, 26.6, 18.8, 0, 2, 1.1, 0.9, PANE, WHITE) +
        hip(14.35, 23.35, 2.3, 4.5, 3.5, 1.6, TILE) + box(15, 24, 3.4, 0.4, 0.4, 0.9, BRICK) + box(17.6, 24.6, 3.3, 0.4, 0.4, 0.9, BRICK);
    });
    landmark('water', 33.2, 7.6, 36, 10, function () {             // boathouse on the lake, with boats out
      var s = box(33.2, 7.6, 0, 2.8, 2.4, 1.3, ['#e9e1d0', '#d8ccb3', '#c3b596']) + hip(33.1, 7.5, 1.3, 3, 2.6, 0.8, SLATE);
      [[37.5, 9.5], [38.6, 2.6], [41.2, 10]].forEach(function (b) {
        s += poly([[b[0], b[1], 0.05], [b[0] + 1.1, b[1], 0.05], [b[0] + 1.3, b[1] + 0.2, 0.05], [b[0] + 1.1, b[1] + 0.4, 0.05], [b[0], b[1] + 0.4, 0.05]], '#f3f0e8') +
          line([b[0] + 0.5, b[1] + 0.2, 0.05], [b[0] + 0.5, b[1] + 0.2, 0.9], '#666', 0.6) + poly([[b[0] + 0.5, b[1] + 0.2, 0.9], [b[0] + 1.1, b[1] + 0.2, 0.2], [b[0] + 0.5, b[1] + 0.2, 0.2]], '#ffffff');
      });
      return s;
    });
    function astro(x, y, w, d, lights) {
      var s = flat(x, y, w, d, '#3f8f4f', 0.05) + poly([[x + 0.3, y + 0.3, 0.06], [x + w - 0.3, y + 0.3, 0.06], [x + w - 0.3, y + d - 0.3, 0.06], [x + 0.3, y + d - 0.3, 0.06]], 'none', ' fill="none" stroke="#fff" stroke-width=".8"') +
        line([x + w / 2, y + 0.3, 0.06], [x + w / 2, y + d - 0.3, 0.06], '#fff', 0.7);
      if (lights) [[x, y], [x + w, y], [x, y + d], [x + w, y + d]].forEach(function (c) { s += line([c[0], c[1], 0], [c[0], c[1], 3.4], '#9aa1a6', 0.9) + box(c[0] - 0.25, c[1] - 0.1, 3.3, 0.5, 0.2, 0.25, ['#fff7c9', '#e9e1b0', '#d0c897']); });
      return s;
    }

    // trees: woodland by the lake and along the drive (always there)
    var TREES = [[33.5, -3], [34.6, 1.8], [33.8, 5.6], [35.4, 12.6], [36.6, 15.8], [38.8, 17.6], [41.6, 19], [44, 18.4], [37.4, 21.2], [40, 22.4], [36.6, 24.6],
      [12.6, 21.8], [19.6, 22.6], [23, 23.4], [29.8, 24.4], [6.4, 19.6], [-2, 7.6], [-1.6, 19.2], [12.2, 8.6], [31.2, 3.6], [27.8, 26.2], [10.4, 26.6]];
    TREES.forEach(function (t, i) { add(t[0] - 0.7, t[1] - 0.7, t[0] + 0.7, t[1] + 0.7, tree(t[0], t[1], G.tree[i % 2])); });

    // draw back to front: A is behind B when it lies wholly on B's far side along x or y
    var order = sortItems(items);
    var svg = g + order.map(function (it) { return it.svg; }).join('');
    var pad = 8, vb = [B.x0 - pad, B.y0 - pad, B.x1 - B.x0 + 2 * pad, B.y1 - B.y0 + 2 * pad];
    return '<svg class="campus-art" viewBox="' + vb.map(function (v) { return v.toFixed(1); }).join(' ') + '" role="img" aria-label="Your revision campus: Merchant Taylors\' School" font-family="Inter, Segoe UI, Roboto, Helvetica, Arial, sans-serif">' + svg + '</svg>';
  }

  function sortItems(items) {
    var n = items.length, before = items.map(function () { return []; }), deg = items.map(function () { return 0; });
    for (var i = 0; i < n; i++) for (var j = 0; j < n; j++) {
      if (i === j) continue;
      var a = items[i], b = items[j];
      // a must be drawn before b if a is entirely behind b on one axis and they overlap on the other
      var behind = (a.x1 <= b.x0 + 1e-6 && a.y0 < b.y1 && b.y0 < a.y1) || (a.y1 <= b.y0 + 1e-6 && a.x0 < b.x1 && b.x0 < a.x1) ||
        (a.x1 <= b.x0 + 1e-6 && a.y1 <= b.y0 + 1e-6);
      if (behind) { before[i].push(j); deg[j]++; }
    }
    var ready = [], out = [];
    for (var k = 0; k < n; k++) if (!deg[k]) ready.push(k);
    var key = function (i) { return items[i].x0 + items[i].x1 + items[i].y0 + items[i].y1; };
    while (ready.length) {
      ready.sort(function (p, q) { return key(p) - key(q); });
      var c = ready.shift();
      out.push(items[c]);
      before[c].forEach(function (j) { if (--deg[j] === 0) ready.push(j); });
    }
    if (out.length < n) items.forEach(function (it) { if (out.indexOf(it) < 0) out.push(it); });   // a cycle: fall back
    return out;
  }

  function tree(x, y, pal) {
    var r = 0.55 + hash(x + ',' + y) * 0.3, h = 1 + hash(y + ':' + x) * 0.6;
    return box(x - 0.1, y - 0.1, 0, 0.2, 0.2, 0.7, ['#8d7253', '#7c6348', '#68523b']) +
      box(x - r, y - r, 0.6, 2 * r, 2 * r, h, pal) + box(x - r * 0.6, y - r * 0.6, 0.6 + h, 1.2 * r, 1.2 * r, 0.5, [mix(pal[0], '#ffffff', 0.12), pal[1], pal[2]]);
  }

  // the clock face, drawn flat (unit = 1 grid unit); hands are set to the time now and kept moving by mount()
  function clockFace() {
    var d = new Date(), m = d.getMinutes(), hr = (d.getHours() % 12) + m / 60;
    var ticks = '';
    for (var i = 0; i < 12; i++) { var a = i * Math.PI / 6; ticks += '<line x1="' + (0.42 * Math.sin(a)).toFixed(3) + '" y1="' + (-0.42 * Math.cos(a)).toFixed(3) + '" x2="' + (0.5 * Math.sin(a)).toFixed(3) + '" y2="' + (-0.5 * Math.cos(a)).toFixed(3) + '" stroke="#2b2b2b" stroke-width=".05"/>'; }
    return '<circle r=".62" fill="#f4efe1" stroke="#c9bfa5" stroke-width=".08"/>' + ticks +
      '<line class="cm-hh" x1="0" y1="0" x2="0" y2="-.3" stroke="#222" stroke-width=".08" stroke-linecap="round" transform="rotate(' + (hr * 30).toFixed(1) + ')"/>' +
      '<line class="cm-mh" x1="0" y1="0" x2="0" y2="-.46" stroke="#222" stroke-width=".05" stroke-linecap="round" transform="rotate(' + (m * 6) + ')"/>' +
      '<circle r=".05" fill="#222"/>';
  }

  // ------------------------------------------------------------------ the subject buildings, stage by stage
  // 0 empty plot · 1 foundations · 2 ground-floor walls · 3 ground floor · 4 first-floor walls · 5 two storeys and roof
  // 6 its own feature (labs' roof lights and flues, greenhouse, observatory dome…) · 7 a new wing · 8 finished, with a flag
  function subjectBuilding(id, site, o, color, crane, dark) {
    var x = site.x, y = site.y, w = site.w, d = site.d, k = site.kind, st = o.stage, s = '';
    var wall = k === 'modern' ? CLAD : k === 'pyramid' || k === 'lab' || k === 'observatory' ? BRICK_NEW : BRICK;
    var SH = 1.25, lit = Math.min(1, o.recent / 15);
    var glass = function (i) { return hash(id + i) < lit ? PANE_LIT : PANE; };
    s += flat(x - 0.4, y - 0.4, w + 0.8 + (k === 'greenhouse' ? 1.8 : 0), d + 0.8, dark ? '#4c4a45' : '#ddd5c4', 0.04);
    if (st === 0) {
      [[x, y], [x + w, y], [x, y + d], [x + w, y + d]].forEach(function (c) { s += line([c[0], c[1], 0], [c[0], c[1], 0.7], '#c98b3c', 1.3); });
      s += poly([[x, y + d, 0.3], [x + w, y + d, 0.3]], 'none', ' fill="none" stroke="#e05a3a" stroke-width=".8" stroke-dasharray="3 2"');
      s += line([x + w / 2, y + d + 0.2, 0], [x + w / 2, y + d + 0.2, 1.5], '#8a6a48', 1.2) + box(x + w / 2 - 0.75, y + d + 0.18, 1.1, 1.5, 0.04, 0.7, ['#fff', '#f6f2e9', '#e2dccd']);
      return s;
    }
    s += box(x - 0.1, y - 0.1, 0, w + 0.2, d + 0.2, 0.18, STONE);  // foundations
    if (st === 1) return s + scaffold(x, y, w, d, 0.18, SH) + (crane ? craneFor(x, y, w, d, 1.6) : '');
    var storeys = st >= 5 ? 2 : 1;
    var wallsTo = st === 2 ? SH * 0.55 : st === 4 ? SH * 1.55 : storeys * SH;
    s += box(x, y, 0.18, w, d, wallsTo, wall);
    var fullStoreys = st === 2 ? 0 : st === 4 ? 1 : storeys;
    if (fullStoreys) {
      if (k === 'modern') {   // full-height glazing bands
        for (var f = 0; f < fullStoreys; f++) {
          s += poly([[x + 0.2, y + d + 0.01, 0.45 + f * SH], [x + w - 0.2, y + d + 0.01, 0.45 + f * SH], [x + w - 0.2, y + d + 0.01, 1.15 + f * SH], [x + 0.2, y + d + 0.01, 1.15 + f * SH]], hash(id + f) < lit ? PANE_LIT : GLASS[2]);
          s += poly([[x + w + 0.01, y + 0.2, 0.45 + f * SH], [x + w + 0.01, y + d - 0.2, 0.45 + f * SH], [x + w + 0.01, y + d - 0.2, 1.15 + f * SH], [x + w + 0.01, y + 0.2, 1.15 + f * SH]], GLASS[1]);
        }
      } else {
        s += winY(x + 0.15, x + w - 0.15, y + d, 0.18, fullStoreys, SH, 0.95, glass(1), WHITE) + winX(y + 0.15, y + d - 0.15, x + w, 0.18, fullStoreys, SH, 0.95, glass(2), WHITE);
      }
    }
    var top = 0.18 + wallsTo;
    if (st <= 4) {
      s += flat(x, y, w, d, mix(wall[0], '#000000', 0.15), top + 0.01);
      return s + scaffold(x, y, w, d, top - SH * 0.6, SH) + (crane ? craneFor(x, y, w, d, top + 1.6) : '');
    }
    // stage 5+: the roof, by kind of building
    if (k === 'lab' || k === 'observatory' || k === 'modern' || k === 'pyramid') {
      s += box(x - 0.06, y - 0.06, top, w + 0.12, d + 0.12, 0.16, k === 'modern' ? ['#e9ecee', '#d5d9dc', '#bfc4c8'] : FLATROOF);
      top += 0.16;
    } else {
      s += box(x - 0.05, y - 0.05, top, w + 0.1, d + 0.1, 0.1, STONE) + hip(x - 0.06, y - 0.06, top + 0.1, w + 0.12, d + 0.12, 1.1, TILE);
    }
    if (st >= 6) s += feature(k, x, y, w, d, top, id, dark);
    if (st >= 7) {   // a new wing at the back
      var wx = x + 0.4, wy = y - 2.2, ww = Math.min(w - 0.8, 3), wd = 2;
      s = box(wx, wy, 0, ww, wd, SH * 2 + 0.18, wall) + (k === 'modern' || k === 'lab' || k === 'observatory' || k === 'pyramid' ? box(wx - 0.05, wy - 0.05, SH * 2 + 0.18, ww + 0.1, wd + 0.1, 0.14, FLATROOF) : hip(wx - 0.05, wy - 0.05, SH * 2 + 0.18, ww + 0.1, wd + 0.1, 0.9, TILE)) + s;
    }
    if (st >= 8) {   // finished: the subject's flag and a clipped hedge
      var fx = x + w - 0.4, fy = y + 0.4, fz = top + (k === 'languages' || k === 'greenhouse' || k === 'weather' ? 0.6 : 0.2);
      s += line([fx, fy, fz], [fx, fy, fz + 1.8], dark ? '#ddd' : '#555', 0.9) + poly([[fx, fy, fz + 1.8], [fx + 1, fy, fz + 1.55], [fx, fy, fz + 1.3]], color);
      s += box(x - 0.3, y + d + 0.15, 0, w + 0.6, 0.35, 0.35, ['#5f8f4e', '#4f7d40', '#416a35']);
    }
    if (crane) s += craneFor(x, y, w, d, top + 2);
    return s;
  }
  function feature(k, x, y, w, d, top, id, dark) {
    var s = '';
    if (k === 'lab' || k === 'observatory') {   // sawtooth roof lights, like the science block in the aerial photos
      for (var i = 0; i < 3; i++) {
        var a = x + 0.35 + i * (w - 0.7) / 3, b = a + (w - 0.7) / 3 - 0.2;
        s += poly([[a, y + 0.4, top], [b, y + 0.4, top], [b, y + 0.4, top + 0.55], [a, y + 0.4, top + 0.55]], GLASS[2]) +
          poly([[a, y + 0.4, top + 0.55], [b, y + 0.4, top + 0.55], [b, y + d - 0.4, top], [a, y + d - 0.4, top]], '#eeeeea') +
          poly([[b, y + 0.4, top], [b, y + 0.4, top + 0.55], [b, y + d - 0.4, top]], '#d9d9d3');
      }
      if (k === 'lab') {   // fume-cupboard flues, gently steaming
        [[x + w - 0.5, y + d - 0.5], [x + 0.5, y + d - 0.5]].forEach(function (f, j) {
          s += box(f[0] - 0.12, f[1] - 0.12, top, 0.24, 0.24, 1.2, ['#c9ced2', '#aab1b7', '#8f979e']);
          var p = P(f[0], f[1], top + 1.4);
          s += '<circle cx="' + p[0].toFixed(1) + '" cy="' + p[1].toFixed(1) + '" r="4" fill="#ffffff" opacity=".7"><animate attributeName="cy" values="' + p[1].toFixed(1) + ';' + (p[1] - 14).toFixed(1) +
            '" dur="' + (3 + j) + 's" repeatCount="indefinite"/><animate attributeName="opacity" values=".7;0" dur="' + (3 + j) + 's" repeatCount="indefinite"/></circle>';
        });
      } else {             // a white observatory dome with its slit open
        var cx = x + w - 1.1, cy = y + d / 2, ring = [], r = 0.8;
        s += box(cx - 0.9, cy - 0.9, top, 1.8, 1.8, 0.5, BRICK_NEW);
        for (var t = 0; t <= 16; t++) { var ang = Math.PI * t / 16; ring.push([cx + r * Math.cos(ang - Math.PI / 4), cy + r * Math.sin(ang - Math.PI / 4)]); }
        var c0 = P(cx, cy, top + 0.5), rr = r * K * 1.05;
        s += '<path d="M' + (c0[0] - rr).toFixed(1) + ',' + c0[1].toFixed(1) + ' A' + rr.toFixed(1) + ',' + (rr * 0.95).toFixed(1) + ' 0 0 1 ' + (c0[0] + rr).toFixed(1) + ',' + c0[1].toFixed(1) +
          ' Z" fill="#f4f6f7" stroke="#c8cfd4" stroke-width=".6"/>';
        s += '<path d="M' + (c0[0] - 2).toFixed(1) + ',' + (c0[1] - rr * 0.95 + 1).toFixed(1) + ' L' + (c0[0] + 2).toFixed(1) + ',' + (c0[1] - rr * 0.95 + 1).toFixed(1) +
          ' L' + (c0[0] + 3).toFixed(1) + ',' + c0[1].toFixed(1) + ' L' + (c0[0] - 3).toFixed(1) + ',' + c0[1].toFixed(1) + 'Z" fill="#41505c"/>';
      }
    } else if (k === 'greenhouse') {   // a glasshouse on the end, plants inside
      var gx = x + w, gw = 1.8;
      s += box(gx, y + 0.3, 0, gw, d - 0.6, 1.3, ['rgba(214,238,245,.75)', 'rgba(170,215,229,.75)', 'rgba(140,195,214,.75)']);
      s += poly([[gx, y + d - 0.3, 1.3], [gx + gw, y + d - 0.3, 1.3], [gx + gw, y + d / 2, 1.9], [gx, y + d / 2, 1.9]], 'rgba(225,243,248,.85)') +
        poly([[gx + gw, y + 0.3, 1.3], [gx + gw, y + d - 0.3, 1.3], [gx + gw, y + d / 2, 1.9]], 'rgba(190,225,236,.85)');
      for (var p2 = 0; p2 < 3; p2++) s += box(gx + 0.3 + p2 * 0.5, y + d - 0.9, 0, 0.3, 0.3, 0.5 + p2 * 0.12, ['#79b866', '#5f9e4f', '#4d8640']);
      for (var g2 = 0; g2 <= 3; g2++) s += line([gx + g2 * gw / 3, y + d - 0.3, 0], [gx + g2 * gw / 3, y + d - 0.3, 1.3], '#ffffff', 0.5);
    } else if (k === 'pyramid') {      // a glass pyramid roof light
      var px = x + w / 2, py = y + d / 2, hw = Math.min(w, d) / 2 - 0.35;
      s += poly([[px - hw, py + hw, top], [px + hw, py + hw, top], [px, py, top + 1.1]], GLASS[1]) + poly([[px + hw, py - hw, top], [px + hw, py + hw, top], [px, py, top + 1.1]], GLASS[2]) +
        line([px - hw, py + hw, top], [px, py, top + 1.1], '#ffffff', 0.5) + line([px + hw, py + hw, top], [px, py, top + 1.1], '#ffffff', 0.5);
      s += '<text transform="' + onY(x + 0.3, y + d + 0.02, 0.75) + '" font-size=".7" font-weight="700" fill="#fbfaf6">π</text>';
    } else if (k === 'modern') {       // solar panels and a satellite dish
      for (var r2 = 0; r2 < 2; r2++) for (var c2 = 0; c2 < 3; c2++) {
        var sx = x + 0.4 + c2 * 1.3, sy = y + 0.4 + r2 * 1.1;
        s += poly([[sx, sy + 0.8, top + 0.05], [sx + 1.1, sy + 0.8, top + 0.05], [sx + 1.1, sy, top + 0.45], [sx, sy, top + 0.45]], '#2f4a6b');
      }
      var dx = x + w - 0.6, dy = y + d - 0.6, dp = P(dx, dy, top + 0.9);
      s += line([dx, dy, top], [dx, dy, top + 0.7], '#888', 1) + '<ellipse cx="' + dp[0].toFixed(1) + '" cy="' + dp[1].toFixed(1) + '" rx="6" ry="3.6" transform="rotate(-25 ' + dp[0].toFixed(1) + ' ' + dp[1].toFixed(1) + ')" fill="#f2f2f2" stroke="#bbb" stroke-width=".6"/>';
    } else if (k === 'weather') {      // a weather station: mast with anemometer and a white Stevenson screen
      var mx = x + w + 0.6, my = y + 0.4;
      s += line([mx, my, 0], [mx, my, 3.2], '#7d868d', 1);
      var ap = P(mx, my, 3.2);
      s += '<g transform="translate(' + ap[0].toFixed(1) + ' ' + ap[1].toFixed(1) + ')"><g><line x1="-5" y1="0" x2="5" y2="0" stroke="#666" stroke-width=".8"/><line x1="0" y1="-3" x2="0" y2="3" stroke="#666" stroke-width=".8"/>' +
        '<circle cx="-5" cy="0" r="1.3" fill="#e05a3a"/><circle cx="5" cy="0" r="1.3" fill="#e05a3a"/><circle cx="0" cy="-3" r="1.3" fill="#e05a3a"/><circle cx="0" cy="3" r="1.3" fill="#e05a3a"/>' +
        '<animateTransform attributeName="transform" type="rotate" values="0;360" dur="2.4s" repeatCount="indefinite"/></g></g>';
      s += box(x + w + 0.2, y + d - 0.9, 0.7, 0.7, 0.6, 0.6, ['#ffffff', '#f1f1ee', '#dddcd6']) + line([x + w + 0.35, y + d - 0.4, 0], [x + w + 0.35, y + d - 0.4, 0.7], '#999', 0.7);
    } else if (k === 'languages') {    // a row of flagpoles in front: Spain, France, Germany
      [['#c60b1e', '#ffc400', '#c60b1e'], ['#0055a4', '#ffffff', '#ef4135'], ['#000000', '#dd0000', '#ffce00']].forEach(function (fl, i) {
        var fx = x + 0.6 + i * 1.3, fy = y + d + 0.6, ph = 2.4;
        s += line([fx, fy, 0], [fx, fy, ph], '#777', 0.8);
        for (var b = 0; b < 3; b++) {
          var vertical = i === 1;
          s += vertical ? poly([[fx + b * 0.3, fy, ph], [fx + (b + 1) * 0.3, fy, ph], [fx + (b + 1) * 0.3, fy, ph - 0.6], [fx + b * 0.3, fy, ph - 0.6]], fl[b])
            : poly([[fx, fy, ph - b * 0.2], [fx + 0.9, fy, ph - b * 0.2], [fx + 0.9, fy, ph - (b + 1) * 0.2], [fx, fy, ph - (b + 1) * 0.2]], fl[b]);
        }
      });
    }
    return s;
  }
  function scaffold(x, y, w, d, z0, h) {
    var c = '#c98b3c', s = '';
    [[x - 0.15, y + d + 0.15], [x + w / 2, y + d + 0.15], [x + w + 0.15, y + d + 0.15], [x + w + 0.15, y + d / 2], [x + w + 0.15, y - 0.15]].forEach(function (p) { s += line([p[0], p[1], 0], [p[0], p[1], z0 + h], c, 0.8); });
    s += line([x - 0.15, y + d + 0.15, z0 + h * 0.5], [x + w + 0.15, y + d + 0.15, z0 + h * 0.5], c, 0.7) + line([x + w + 0.15, y - 0.15, z0 + h * 0.5], [x + w + 0.15, y + d + 0.15, z0 + h * 0.5], c, 0.7);
    s += line([x - 0.15, y + d + 0.15, z0 + h], [x + w + 0.15, y + d + 0.15, z0 + h], c, 0.7) + line([x + w + 0.15, y - 0.15, z0 + h], [x + w + 0.15, y + d + 0.15, z0 + h], c, 0.7);
    return s;
  }
  // a tower crane behind the building, lowering a block
  function craneFor(x, y, w, d, hookZ) {
    var mx = x - 0.7, my = y - 0.7, mh = hookZ + 2.4, Y = ['#f7c04a', '#e8a92c', '#cc8f1c'], s = '';
    s += box(mx - 0.16, my - 0.16, 0, 0.32, 0.32, mh, Y);
    s += box(mx - 1.4, my - 0.12, mh, w + 2.8, 0.24, 0.22, Y) + box(mx - 1.4, my - 0.3, mh - 0.45, 0.7, 0.6, 0.45, ['#aab2b9', '#8f979e', '#7a8289']);
    var hx = x + w * 0.6, cp = P(hx, my, mh), bp = P(hx, my, hookZ + 0.6);
    s += '<g class="cm-hook"><line x1="' + cp[0].toFixed(1) + '" y1="' + cp[1].toFixed(1) + '" x2="' + bp[0].toFixed(1) + '" y2="' + bp[1].toFixed(1) + '" stroke="#555" stroke-width=".8"/>' +
      box(hx - 0.35, my - 0.35, hookZ, 0.7, 0.7, 0.55, ['#efe6d4', '#dacdb5', '#c4b598']) +
      '<animateTransform attributeName="transform" type="translate" values="0 -6;0 0;0 -6" dur="5s" repeatCount="indefinite"/></g>';
    return s;
  }

  // ------------------------------------------------------------------ the card around it
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

  function nextUp() {
    var p = S.get().plan, today = new Date(); today.setHours(0, 0, 0, 0);
    if (!p || !p.events) return '';
    var up = p.events.filter(function (e) { return e.date && new Date(e.date + 'T00:00') >= today; }).sort(function (a, b) { return a.date < b.date ? -1 : 1; })[0];
    if (!up) return '';
    var n = Math.round((new Date(up.date + 'T00:00') - today) / 864e5);
    return '<span class="cm-next">Next: <b>' + esc(up.title) + '</b> ' + (n === 0 ? 'today' : n === 1 ? 'tomorrow' : 'in ' + n + ' days') + '</span>';
  }

  var clockTimer = null;
  function mount(host) {
    Promise.all([
      fetch('/study-meta.json', { credentials: 'same-origin' }).then(function (r) { if (!r.ok) throw new Error('meta'); return r.json(); }),
      new Promise(function (ok) { S.pull(ok); })
    ]).then(function (r) {
      var meta = r[0];
      function paint() {
        var st = stats(meta), L = landmarks(st), total = 0;
        Object.keys(st.subjects).forEach(function (s) { total += st.subjects[s].built; });
        var pct = Math.round(total / Object.keys(st.subjects).length * 100);
        var got = L.filter(function (l) { return l.on; }).length;
        var next = L.filter(function (l) { return !l.on; }).sort(function (a, b) { return (b.n / b.need) - (a.n / a.need); }).slice(0, 3);
        host.innerHTML = '<div class="cm-card"><div class="cm-hud">' +
          '<span><b>' + pct + '%</b>campus built</span><span><b>' + got + '/' + L.length + '</b>landmarks</span><span><b>' + st.marked + '</b>questions marked</span>' +
          '<span><b>' + st.mocks + '</b>mock papers</span><span><b>' + st.streak + '</b>day streak</span></div>' +
          draw(meta, st, L) +
          '<div class="cm-legend">' + Object.keys(meta.subjects).map(function (s) {
            var o = st.subjects[s], site = SITES[s];
            return '<a href="/' + s + '/#/topics" style="--c:' + meta.subjects[s].color + '"><i></i><span>' + esc(site ? site.label : meta.subjects[s].subject) + '</span><em>' +
              (o.stage === STAGES ? 'finished' : 'stage ' + o.stage + ' of ' + STAGES) + '</em></a>';
          }).join('') + '</div>' +
          (next.length ? '<div class="cm-unlock"><b>Next to unlock</b>' + next.map(function (l) {
            return '<span><em>' + esc(l.name) + '</em>' + esc(l.how) + '<i style="--p:' + Math.round(Math.min(1, l.n / l.need) * 100) + '%"></i></span>';
          }).join('') + '</div>' : '') +
          '<div class="cm-foot">' + (st.marked ? '' : '<span class="cm-tip">Mark yourself on any question to break ground on that subject\'s building. Secure topics build it up; streaks, mock papers and the planner unlock the rest of the school.</span>') +
          nextUp() + '<span class="cm-btns"><a class="btn-quiet" href="/planner">Revision planner</a><button type="button" class="btn-quiet cm-save">Save picture</button></span></div></div>';
        host.querySelector('.cm-save').addEventListener('click', function () { savePicture(host.querySelector('.campus-art')); });
        if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) { var sv = host.querySelector('.campus-art'); if (sv.pauseAnimations) sv.pauseAnimations(); }
      }
      paint();
      // keep the clock tower's hands on the real time
      clearInterval(clockTimer);
      clockTimer = setInterval(function () {
        var d = new Date(), m = d.getMinutes(), h = (d.getHours() % 12) + m / 60;
        Array.prototype.forEach.call(host.querySelectorAll('.cm-hh'), function (el) { el.setAttribute('transform', 'rotate(' + (h * 30).toFixed(1) + ')'); });
        Array.prototype.forEach.call(host.querySelectorAll('.cm-mh'), function (el) { el.setAttribute('transform', 'rotate(' + m * 6 + ')'); });
      }, 20000);
      // repaint when the theme changes so the ground matches the page
      new MutationObserver(paint).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    }).catch(function () { host.innerHTML = ''; });
  }
  return { mount: mount, _stats: stats, _landmarks: landmarks };
})();
