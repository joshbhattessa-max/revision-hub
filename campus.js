/* "Your campus" on the home page: Merchant Taylors' School in isometric 3D, built up by your revision.
   It follows the school's campus map and aerial photos: the 1933 red-brick ranges round the quads, the Great Hall
   with its arcaded loggia, the clock tower (showing the real time), the parade ground, the later flat-roofed blocks,
   the sports hall and pool, the courts and pitches, the playing fields and the lakes. Every question you do and
   every mock paper you hand in adds to it, one building at a time. Drawn from progress.js. */
window.JBR_CAMPUS = (function () {
  'use strict';
  var S = window.JBR_PROGRESS;
  var STAGES = 8;
  // the projection: measured from the aerial photo (walls along the Great Hall rise ~19° to the right, the ranges
  // across them fall ~11°, heights a little foreshortened); +x and +y faces are the ones you see
  var EX = [1, 0.19], EY = [-0.944, 0.331], EZ = 0.82, K = 16;
  var B;  // drawn extent, for the viewBox

  // ------------------------------------------------------------------ isometric drawing
  function P(x, y, z) {
    var p = [(x * EX[0] + y * EY[0]) * K, (x * EX[1] + y * EY[1] - z * EZ) * K];
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
  function onY(x, Y, z) { var o = P(x, Y, z); return 'matrix(' + (EX[0] * K).toFixed(3) + ',' + (EX[1] * K).toFixed(3) + ',0,' + (EZ * K).toFixed(3) + ',' + o[0].toFixed(1) + ',' + o[1].toFixed(1) + ')'; }
  function onX(X, y, z) { var o = P(X, y, z); return 'matrix(' + (-EY[0] * K).toFixed(3) + ',' + (-EY[1] * K).toFixed(3) + ',0,' + (EZ * K).toFixed(3) + ',' + o[0].toFixed(1) + ',' + o[1].toFixed(1) + ')'; }
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


  // ------------------------------------------------------------------ what builds it: questions done and mock papers
  // Only two things are tracked: each question you've done (and your mark), and each mock paper you've submitted.
  // Every question done is 1 point and every mock paper 15; the school goes up building by building, in order.
  function stats(meta) {
    var P0 = S.get(), keys = Object.keys(meta.subjects), done = 0;
    Object.keys(P0.items || {}).forEach(function (k) { if (keys.indexOf(P0.items[k].s) >= 0) done++; });
    var mocks = (P0.mocks || []).length;
    return { done: done, mocks: mocks, points: done + 15 * mocks };
  }

  // ------------------------------------------------------------------ Merchant Taylors' School
  // Footprints from the school's campus map (an isometric drawing: centre in map pixels, length along its two axes),
  // heights, roofs and materials from aerial photos. Drawn from the same side as the aerial photo (the map turned
  // round 180°), so the lakes are on the right, the playing fields on the left and the Great Hall faces you.
  // kind: hall · range (1933 brick, hipped tile roof) · house · tower · chapel · flat (later flat-roofed blocks) ·
  // slate (brick with a standing-seam metal roof) · octagon · sawtooth (roof lights) · sports (white roof) · pool · pavilion
  var SCHOOL = [
    // the 1933 heart of the school, built first
    { id: 'hall', name: 'The Great Hall', kind: 'hall', c: [1472, 645], lp: 58, lq: 168, h: 2.9 },
    { id: 'sixth', name: 'Sixth Form Common Room', kind: 'range', c: [1384, 676], lp: 62, lq: 52, h: 1.9 },
    { id: 'southrange', name: 'Classroom range (Economics, Computing, Chemistry)', kind: 'range', c: [1532, 752], lp: 236, lq: 36, h: 1.75 },
    { id: 'tower', name: 'The Clock Tower', kind: 'tower', c: [1808, 848], lp: 22, lq: 22, h: 5.4 },
    { id: 'northrange', name: 'Maths and Library range', kind: 'range', c: [1676, 690], lp: 186, lq: 40, h: 1.75 },
    { id: 'eastrange', name: 'English range', kind: 'range', c: [1852, 782], lp: 252, lq: 44, h: 1.75 },
    { id: 'exams', name: 'Exams', kind: 'range', c: [1694, 762], lp: 36, lq: 92, h: 1.75 },
    { id: 'quadrange', name: 'Range closing the Inner Quad', kind: 'range', c: [1724, 884], lp: 40, lq: 124, h: 1.75 },
    { id: 'admissions', name: 'Admissions', kind: 'house', c: [1650, 626], lp: 70, lq: 56, h: 2 },
    { id: 'head', name: "Head Master's Study", kind: 'house', c: [1740, 590], lp: 80, lq: 64, h: 2 },
    { id: 'chapel', name: 'Chaplaincy', kind: 'chapel', c: [1874, 862], lp: 60, lq: 40, h: 1.9 },
    { id: 'physics', name: 'Physics', kind: 'range', c: [1642, 926], lp: 200, lq: 58, h: 1.75 },
    { id: 'history', name: 'History', kind: 'range', c: [1478, 926], lp: 40, lq: 110, h: 1.6 },
    { id: 'geography', name: 'Geography', kind: 'range', c: [1350, 976], lp: 40, lq: 100, h: 1.6 },
    { id: 'dining', name: 'Dining Hall', kind: 'sawtooth', c: [1290, 752], lp: 40, lq: 250, h: 1.7 },
    { id: 'lockers', name: 'Locker Rooms and Studio Theatre', kind: 'range', c: [1200, 900], lp: 190, lq: 40, h: 1.6 },
    { id: 'lunch', name: 'Lunch Queue Corridor', kind: 'flat', c: [1214, 816], lp: 42, lq: 42, h: 1.2 },
    // the later buildings round the Beast and the lake road
    { id: 'design', name: 'Design Centre', kind: 'flat', c: [1104, 676], lp: 62, lq: 232, h: 1.7 },
    { id: 'lecture', name: 'Lecture Theatre', kind: 'octagon', c: [1182, 640], lp: 78, lq: 78, h: 1.9 },
    { id: 'classics', name: 'Classics and Art', kind: 'flat', c: [1120, 562], lp: 62, lq: 112, h: 1.7 },
    { id: 'languages', name: 'Modern Languages', kind: 'slate', c: [1202, 520], lp: 42, lq: 160, h: 1.75 },
    { id: 'biology', name: 'Biology', kind: 'slate', c: [1292, 542], lp: 52, lq: 120, h: 1.75 },
    { id: 'music', name: 'Music School', kind: 'octagon', c: [1242, 592], lp: 62, lq: 62, h: 1.8, roof: 'slate' },
    // sport
    { id: 'sportshall', name: 'Sports Hall', kind: 'sports', c: [990, 906], lp: 200, lq: 104, h: 2.3 },
    { id: 'pool', name: 'Swimming Pool', kind: 'pool', c: [1062, 1002], lp: 200, lq: 80, h: 1.6 },
    { id: 'ccf', name: 'CCF', kind: 'range', c: [880, 850], lp: 62, lq: 52, h: 1.3 },
    { id: 'omt', name: 'OMT War Memorial Club House', kind: 'pavilion', c: [894, 1186], lp: 74, lq: 52, h: 1.4 },
    { id: 'manor', name: 'Manor of the Rose', kind: 'house', c: [1946, 322], lp: 70, lq: 56, h: 1.9 },
    { id: 'depot', name: 'Delivery Depot', kind: 'flat', c: [1900, 496], lp: 50, lq: 42, h: 1.1 }
  ];
  // things on the ground: built in the same order (pitches, courts) or always there (lake, roads, fields)
  var PITCHES = [
    { id: 'tennis', name: 'Tennis Courts and MUGA', kind: 'courts', c: [1150, 1232], lp: 232, lq: 104 },
    { id: 'astro', name: 'Astroturf Hockey Pitches', kind: 'astro', c: [1452, 1446], lp: 280, lq: 160 }
  ];
  // the order the school goes up in, and the points (questions done + 15 per mock) each one needs
  var ORDER = ['hall', 'tower', 'sixth', 'southrange', 'northrange', 'exams', 'eastrange', 'quadrange', 'chapel', 'admissions', 'head',
    'physics', 'history', 'geography', 'dining', 'lunch', 'lockers', 'tennis', 'sportshall', 'design', 'lecture', 'classics', 'languages',
    'biology', 'music', 'pool', 'astro', 'ccf', 'omt', 'depot', 'manor'];
  var COST = (function () {   // gentle at first, steeper later: about 2,000 points finishes the school
    var out = {}, total = 0;
    ORDER.forEach(function (id, i) { total += Math.round(8 + i * 4.2); out[id] = total; });
    return out;
  })();

  // map pixels -> ground units (the map turned round, 18 map pixels a unit)
  var MAP = { s: 18, ox: 0, oy: 0 };
  function mapPQ(mx, my) { return [(mx + 2 * my) / 2, (mx - 2 * my) / 2]; }
  function toXY(mx, my) { var pq = mapPQ(mx, my); return [-pq[0] / MAP.s + MAP.ox, pq[1] / MAP.s + MAP.oy]; }
  function rect(b) {   // a footprint as x0, y0, w, d
    var pq = mapPQ(b.c[0], b.c[1]);
    var x0 = -(pq[0] + b.lp / 2) / MAP.s + MAP.ox, y0 = (pq[1] - b.lq / 2) / MAP.s + MAP.oy;
    return [x0, y0, b.lp / MAP.s, b.lq / MAP.s];
  }
  (function origin() {   // shift so the scene starts near 0,0
    var xs = [], ys = [];
    SCHOOL.concat(PITCHES).forEach(function (b) { var r = rect(b); xs.push(r[0]); ys.push(r[1]); });
    MAP.ox = -Math.min.apply(null, xs) + 4; MAP.oy = -Math.min.apply(null, ys) + 4;
  })();

  // ------------------------------------------------------------------ the picture
  var ROOF = ['#7a5244', '#654338', '#53372e'];          // the brown plain-tile roofs in the photos
  var BRICK33 = ['#b98066', '#a8694f', '#8a533e'];
  function draw(st) {
    B = { x0: 1e9, y0: 1e9, x1: -1e9, y1: -1e9 };
    var dark = isDark();
    var G = dark ? { grass: ['#33402f', '#28331f', '#212a1a'], lawn: '#3a4a33', stripe: '#41523a', field: '#2f3d2b', path: '#57534b', road: '#3b3c41', tarmac: '#46474c', water: '#24414c', water2: '#2b4c58', plan: 'rgba(255,255,255,.07)', planLine: 'rgba(255,255,255,.32)', line: '#cfd3c8', tree: [['#3f6b3a', '#345a30', '#2b4b28'], ['#5b5a35', '#4b4a2c', '#3d3c24']] }
      : { grass: ['#c4d6ae', '#a6ba90', '#90a57c'], lawn: '#b3cc96', stripe: '#bdd4a1', field: '#bfd3a4', path: '#e6dfcf', road: '#8e9095', tarmac: '#a2a3a6', water: '#a3cdd8', water2: '#b7dbe3', plan: 'rgba(80,60,40,.06)', planLine: 'rgba(80,60,40,.38)', line: '#ffffff', tree: [['#86b46f', '#6e9d5a', '#5b874a'], ['#c9a35a', '#b08a46', '#94733a']] };
    var built = {}, next = null;
    ORDER.forEach(function (id) { if (st.points >= COST[id]) built[id] = 1; else if (!next) next = id; });
    var nextFrac = next ? (st.points - (ORDER.indexOf(next) ? COST[ORDER[ORDER.indexOf(next) - 1]] : 0)) / (COST[next] - (ORDER.indexOf(next) ? COST[ORDER[ORDER.indexOf(next) - 1]] : 0)) : 0;
    var items = [], g = '';
    function add(r, svg) { items.push({ x0: r[0], y0: r[1], x1: r[0] + r[2], y1: r[1] + r[3], svg: svg }); }
    function gpoly(list, fill, z, extra) { return poly(list.map(function (m) { var p = toXY(m[0], m[1]); return [p[0], p[1], z || 0.02]; }), fill, extra); }

    // ---- the ground: estate, lake, fields, roads, lawns
    g += gpoly([[200, -200], [2800, -200], [2800, 2200], [200, 2200]], G.grass[0], 0);
    // the lakes (on the right and along the top, as in the photo), with wooded banks and an island
    g += gpoly([[200, 1500], [300, 900], [420, 600], [560, 380], [760, 230], [960, 160], [1060, 300], [985, 420], [930, 520], [880, 600], [820, 700],
      [770, 800], [730, 900], [690, 1000], [640, 1150], [560, 1300], [500, 1500]], G.water, 0.01);
    g += gpoly([[440, 700], [560, 520], [700, 380], [760, 400], [640, 560], [520, 760]], G.water2, 0.015);
    g += gpoly([[600, 900], [680, 820], [700, 860], [630, 940]], G.grass[0], 0.02);
    // playing fields with rugby posts (on the left), the sports fields beyond the English range
    g += gpoly([[1960, 620], [2600, 900], [2400, 1600], [1700, 1500], [1620, 1100]], G.field, 0.015);
    [[2010, 900], [1900, 1040], [1790, 1010]].forEach(function (m) {
      var p = toXY(m[0], m[1]);
      g += line([p[0] - 0.6, p[1], 0], [p[0] - 0.6, p[1], 1.5], G.line, 0.9) + line([p[0] + 0.6, p[1], 0], [p[0] + 0.6, p[1], 1.5], G.line, 0.9) + line([p[0] - 0.6, p[1], 0.55], [p[0] + 0.6, p[1], 0.55], G.line, 0.9);
    });
    // roads: the lake road round the west, Sir Thomas White Drive to the front, the drive to the sports fields
    function road(list, w) {
      var out = '';
      for (var i = 1; i < list.length; i++) {
        var a = toXY(list[i - 1][0], list[i - 1][1]), b = toXY(list[i][0], list[i][1]);
        var dx = b[0] - a[0], dy = b[1] - a[1], L = Math.sqrt(dx * dx + dy * dy), ux = -dy / L * w / 2, uy = dx / L * w / 2;
        out += poly([[a[0] + ux, a[1] + uy, 0.02], [b[0] + ux, b[1] + uy, 0.02], [b[0] - ux, b[1] - uy, 0.02], [a[0] - ux, a[1] - uy, 0.02]], G.road);
      }
      return out;
    }
    g += road([[1030, 440], [990, 520], [930, 600], [860, 700], [810, 820], [780, 950], [790, 1080], [860, 1150]], 1.1);
    g += road([[1030, 440], [1320, 460], [1560, 560], [1610, 610]], 1.0);
    g += road([[1560, 560], [1760, 470], [1980, 380]], 0.9);
    g += road([[1910, 860], [2060, 960]], 0.7);
    // tarmac: the parade ground, framed by the ranges
    g += gpoly([[1120, 820], [1420, 715], [1600, 860], [1290, 965]], G.tarmac, 0.025);
    // lawns: the Inner Quad (striped), the quad by the Great Hall, the front lawn
    g += gpoly([[1640, 800], [1790, 790], [1800, 870], [1690, 880]], G.lawn, 0.03);
    g += gpoly([[1500, 690], [1640, 680], [1660, 770], [1540, 780]], G.lawn, 0.03);
    g += gpoly([[1300, 560], [1420, 520], [1460, 600], [1340, 640]], G.lawn, 0.03);
    g += gpoly([[1360, 500], [1500, 460], [1560, 540], [1420, 590]], G.path, 0.025);

    // ---- buildings: built in order; the next one is going up; the rest are pencilled in on the plan
    SCHOOL.concat(PITCHES).forEach(function (b) {
      var r = rect(b), stage = built[b.id] ? 1 : b.id === next ? Math.max(0.12, nextFrac) : 0;
      var title = '<title>' + esc(b.name) + (built[b.id] ? '' : b.id === next ? ' (going up: ' + Math.round(nextFrac * 100) + '%)' : ' (planned)') + '</title>';
      if (!stage) {   // a pencilled outline on the ground
        g += poly([[r[0], r[1], 0.04], [r[0] + r[2], r[1], 0.04], [r[0] + r[2], r[1] + r[3], 0.04], [r[0], r[1] + r[3], 0.04]], G.plan, ' stroke="' + G.planLine + '" stroke-width="1" stroke-dasharray="4 3">' + title + '</polygon');
        return;
      }
      add(r, '<g>' + title + building(b, r, stage, dark, G) + '</g>');
    });

    // trees: woodland along the lake and round the playing fields; autumn colours as in the photo
    var TREES = [[1020, 470], [985, 560], [930, 640], [880, 730], [840, 860], [820, 1000], [990, 470], [905, 1060], [960, 1100], [1250, 1080], [1330, 1060],
      [1540, 1020], [1610, 1010], [1990, 560], [2040, 640], [1880, 600], [1820, 560], [1560, 1210], [1380, 1180], [1700, 1300], [1080, 1290], [2100, 760]];
    TREES.forEach(function (m, i) { var p = toXY(m[0], m[1]); add([p[0] - 0.8, p[1] - 0.8, 1.6, 1.6], tree(p[0], p[1], G.tree[i % 3 === 0 ? 1 : 0])); });

    var order = sortItems(items);
    var svg = g + order.map(function (it) { return it.svg; }).join('');
    var f0 = P.apply(null, toXY(860, 1010).concat([0])), f1 = P.apply(null, toXY(1990, 560).concat([0])), f2 = P.apply(null, toXY(1500, 1460).concat([0])), f3 = P.apply(null, toXY(1560, 380).concat([0]));
    var fx0 = Math.min(f1[0], f3[0]) - 12, fx1 = Math.max(f0[0], f2[0]) + 12, fy1 = Math.max(f0[1], f1[1], f3[1]) + 30;
    var fw = fx1 - fx0, fh = fw / 1.9, vb = [fx0, fy1 - fh, fw, fh];
    return { svg: '<svg class="campus-art" viewBox="' + vb.map(function (v) { return v.toFixed(1); }).join(' ') + '" role="img" aria-label="Your revision campus: Merchant Taylors\' School" font-family="Inter, Segoe UI, Roboto, Helvetica, Arial, sans-serif">' + svg + '</svg>', built: Object.keys(built).length, next: next, nextFrac: nextFrac };
  }

  // one building (or pitch), fully built (stage 1) or part way up (walls to a fraction of their height, scaffolding, crane)
  function building(b, r, stage, dark, G) {
    var x = r[0], y = r[1], w = r[2], d = r[3], k = b.kind, s = '';
    var building = stage < 1, h = b.h ? b.h * (building ? Math.max(0.25, stage) : 1) : 0;
    if (k === 'courts') {
      s += flat(x, y, w, d, '#4b8f55', 0.05);
      var n = 6, cw = w / 3, cd = d / 2;
      for (var i = 0; i < n; i++) {
        var cx = x + (i % 3) * cw + 0.15, cy = y + Math.floor(i / 3) * cd + 0.15;
        s += flat(cx, cy, cw - 0.3, cd - 0.3, '#3f74b5', 0.06) + box(cx + (cw - 0.3) / 2 - 0.02, cy + 0.1, 0.06, 0.04, cd - 0.5, 0.25, ['#fff', '#eee', '#d4d4d4']);
      }
      return s + (building ? '' : '');
    }
    if (k === 'astro') {
      s += flat(x, y, w, d, '#3c8a4c', 0.05) + poly([[x + 0.4, y + 0.4, 0.06], [x + w - 0.4, y + 0.4, 0.06], [x + w - 0.4, y + d - 0.4, 0.06], [x + 0.4, y + d - 0.4, 0.06]], 'none', ' fill="none" stroke="#fff" stroke-width=".8"') +
        line([x + w / 2, y + 0.4, 0.06], [x + w / 2, y + d - 0.4, 0.06], '#fff', 0.7);
      [[x, y], [x + w, y], [x, y + d], [x + w, y + d], [x + w / 2, y], [x + w / 2, y + d]].forEach(function (c) { s += line([c[0], c[1], 0], [c[0], c[1], 3.4], '#9aa1a6', 0.8) + box(c[0] - 0.25, c[1] - 0.1, 3.3, 0.5, 0.2, 0.22, ['#fff7c9', '#e9e1b0', '#d0c897']); });
      return s;
    }
    s += flat(x - 0.2, y - 0.2, w + 0.4, d + 0.4, dark ? '#4c4a45' : '#e2dccd', 0.035);   // footings
    var wall = k === 'flat' || k === 'slate' || k === 'octagon' || k === 'sports' || k === 'pool' ? BRICK_NEW : k === 'pavilion' ? ['#fbfaf5', '#f2efe6', '#dedad0'] : BRICK33;
    if (k === 'octagon') return s + octagon(x, y, w, d, h, b.roof === 'slate', building) + (building ? craneFor(x, y, w, d, h + 1) : '');
    if (k === 'tower') {
      s += box(x, y, 0, w, d, h, BRICK33) + arcadeY(x + 0.05, x + w - 0.05, y + d, 0, 1.1, 1, ARCH);
      if (!building) {
        s += box(x - 0.08, y - 0.08, h, w + 0.16, d + 0.16, 0.16, STONE);
        s += '<g transform="' + onY(x + w / 2, y + d + 0.01, h - 0.75) + '">' + clockFace() + '</g>';
        s += '<g transform="' + onX(x + w + 0.01, y + d / 2, h - 0.75) + '">' + clockFace() + '</g>';
        s += poly([[x - 0.05, y + d + 0.05, h + 0.16], [x + w + 0.05, y + d + 0.05, h + 0.16], [x + w / 2, y + d / 2, h + 0.95]], ROOF[0]) +
          poly([[x + w + 0.05, y - 0.05, h + 0.16], [x + w + 0.05, y + d + 0.05, h + 0.16], [x + w / 2, y + d / 2, h + 0.95]], ROOF[1]);
        s += line([x + w / 2, y + d / 2, h + 0.95], [x + w / 2, y + d / 2, h + 1.8], dark ? '#ccc' : '#5d5d5d', 0.8);
      } else s += scaffold(x, y, w, d, 0, h) + craneFor(x, y, w, d, h + 1);
      return s;
    }
    // walls and windows
    var storeys = k === 'hall' ? 1 : Math.max(1, Math.round(h / 0.85));
    s += box(x, y, 0, w, d, h, wall);
    if (k === 'hall') {   // round-arched loggia under six tall stone-framed windows, on the side facing you (as in the photos)
      s += band(x - 0.04, y - 0.04, 1.05, w + 0.08, d + 0.08, 0.12, STONE);
      s += arcadeX(y + 0.4, y + d - 0.4, x + w, 0, 0.95, 8, ARCH);
      if (!building) for (var j = 0; j < 7; j++) {
        var a = y + 0.9 + j * (d - 1.8) / 6.6;
        s += poly([[x + w + 0.01, a - 0.08, 1.35], [x + w + 0.01, a + 0.55, 1.35], [x + w + 0.01, a + 0.55, 2.55], [x + w + 0.01, a - 0.08, 2.55]], STONE[1]) +
          poly([[x + w + 0.02, a, 1.43], [x + w + 0.02, a + 0.47, 1.43], [x + w + 0.02, a + 0.47, 2.47], [x + w + 0.02, a, 2.47]], PANE);
      }
      s += winY(x + 0.4, x + w - 0.4, y + d, 1.3, 1, 1.3, 1.2, PANE, WHITE);
    } else if (k === 'sports') {
      s += winY(x + 0.3, x + w - 0.3, y + d, 0.3, 1, 0.9, 1.4, GLASS[2], STONE[0]);
    } else if (k === 'pavilion') {
      s += arcadeY(x + 0.1, x + w - 0.1, y + d, 0, h * 0.75, 4, '#6b625a');
    } else if (k !== 'pool') {
      var sh = h / storeys;
      s += winY(x + 0.15, x + w - 0.15, y + d, 0, storeys, sh, 0.8, PANE, WHITE) + winX(y + 0.15, y + d - 0.15, x + w, 0, storeys, sh, 0.8, PANE, WHITE);
    } else {
      s += winY(x + 0.2, x + w - 0.2, y + d, 0.2, 1, h - 0.2, 0.7, GLASS[2], WHITE);
    }
    if (building) return s + flat(x, y, w, d, mix(wall[0], '#000000', 0.15), h + 0.01) + scaffold(x, y, w, d, 0, h) + craneFor(x, y, w, d, h + 1.2);
    // roofs
    if (k === 'flat' || k === 'pool') {
      s += box(x - 0.06, y - 0.06, h, w + 0.12, d + 0.12, 0.14, FLATROOF);
      if (k === 'pool') s += poly([[x + 0.5, y + 0.5, h + 0.16], [x + w - 0.5, y + 0.5, h + 0.16], [x + w - 0.5, y + d - 0.5, h + 0.7], [x + 0.5, y + d - 0.5, h + 0.7]], GLASS[0]);
    } else if (k === 'sports') {
      s += box(x - 0.08, y - 0.08, h, w + 0.16, d + 0.16, 0.2, ['#f5f5f1', '#e4e4de', '#d0d0c9']);
      s += poly([[x - 0.08, y + d + 0.08, h + 0.2], [x + w + 0.08, y + d + 0.08, h + 0.2], [x + w + 0.08, y + d / 2, h + 0.75], [x - 0.08, y + d / 2, h + 0.75]], '#f7f7f4') +
        poly([[x + w + 0.08, y - 0.08, h + 0.2], [x + w + 0.08, y + d + 0.08, h + 0.2], [x + w + 0.08, y + d / 2, h + 0.75]], '#e2e2dc');
    } else if (k === 'sawtooth') {   // flat roof with rows of white roof lights (the block behind the Great Hall in the photo)
      s += box(x - 0.06, y - 0.06, h, w + 0.12, d + 0.12, 0.12, FLATROOF);
      var n = Math.max(2, Math.floor(d / 1.6));
      for (var t = 0; t < n; t++) {
        var y0 = y + 0.3 + t * (d - 0.6) / n, y1 = y0 + (d - 0.6) / n - 0.25;
        s += poly([[x + 0.3, y0, h + 0.12], [x + w - 0.3, y0, h + 0.12], [x + w - 0.3, y0, h + 0.55], [x + 0.3, y0, h + 0.55]], GLASS[2]) +
          poly([[x + 0.3, y0, h + 0.55], [x + w - 0.3, y0, h + 0.55], [x + w - 0.3, y1, h + 0.12], [x + 0.3, y1, h + 0.12]], '#f2f2ee') +
          poly([[x + w - 0.3, y0, h + 0.12], [x + w - 0.3, y0, h + 0.55], [x + w - 0.3, y1, h + 0.12]], '#dcdcd6');
      }
    } else if (k === 'slate') {
      s += hip(x - 0.08, y - 0.08, h, w + 0.16, d + 0.16, 0.7, [SLATE[0], SLATE[1], '#5d6870']);
    } else if (k === 'pavilion') {
      s += hip(x - 0.15, y - 0.15, h, w + 0.3, d + 0.3, 0.9, ['#a5473a', '#8a3a2f', '#702f26']);
    } else {   // 1933 brick: stone cornice and a brown plain-tile hipped roof, dormers on the big ones
      s += band(x - 0.05, y - 0.05, h - 0.12, w + 0.1, d + 0.1, 0.12, STONE);
      var rh = k === 'hall' ? 1.25 : k === 'house' || k === 'chapel' ? 1.15 : 0.85;
      s += hip(x - 0.08, y - 0.08, h, w + 0.16, d + 0.16, rh, ROOF);
      if (k === 'hall') for (var m = 0; m < 5; m++) s += box(x + w - 0.75, y + 1.2 + m * (d - 2.4) / 4, h + 0.25, 0.4, 0.5, 0.38, ['#efe9df', '#e0d8ca', '#cfc5b3']);
      if (k === 'house') s += box(x + w * 0.25, y + d * 0.3, h + 0.4, 0.3, 0.3, 0.9, BRICK33) + box(x + w * 0.65, y + d * 0.7, h + 0.4, 0.3, 0.3, 0.9, BRICK33);
      if (k === 'chapel') s += box(x + w / 2 - 0.15, y + d / 2 - 0.15, h + rh - 0.2, 0.3, 0.3, 0.8, STONE) + poly([[x + w / 2 - 0.2, y + d / 2 + 0.15, h + rh + 0.6], [x + w / 2 + 0.2, y + d / 2 + 0.15, h + rh + 0.6], [x + w / 2, y + d / 2, h + rh + 1.1]], ROOF[1]);
    }
    return s;
  }
  function octagon(x, y, w, d, h, slate, building) {
    var cx = x + w / 2, cy = y + d / 2, r = Math.min(w, d) / 2, ring = [], s = '';
    for (var i = 0; i < 8; i++) { var a = Math.PI / 8 + i * Math.PI / 4; ring.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); }
    for (var j = 0; j < 8; j++) {
      var p = ring[j], q = ring[(j + 1) % 8], nx = (p[0] + q[0]) / 2 - cx, ny = (p[1] + q[1]) / 2 - cy;
      if (nx + ny <= 0.05) continue;
      s += poly([[p[0], p[1], 0], [q[0], q[1], 0], [q[0], q[1], h], [p[0], p[1], h]], nx > ny ? BRICK_NEW[2] : BRICK_NEW[1]);
      if (!building) s += poly([[p[0] + (q[0] - p[0]) * 0.25, p[1] + (q[1] - p[1]) * 0.25, h * 0.35], [p[0] + (q[0] - p[0]) * 0.75, p[1] + (q[1] - p[1]) * 0.75, h * 0.35], [p[0] + (q[0] - p[0]) * 0.75, p[1] + (q[1] - p[1]) * 0.75, h * 0.75], [p[0] + (q[0] - p[0]) * 0.25, p[1] + (q[1] - p[1]) * 0.25, h * 0.75]], GLASS[2]);
    }
    if (building) return s + poly(ring.map(function (p) { return [p[0], p[1], h]; }), '#8a7a6c');
    if (slate) return s + poly(ring.map(function (p) { return [p[0], p[1], h]; }), SLATE[1]) + poly(ring.map(function (p) { return [cx + (p[0] - cx) * 0.2, cy + (p[1] - cy) * 0.2, h + 1]; }), SLATE[0]) +
      ring.map(function (p, k) { var q = ring[(k + 1) % 8]; return (p[0] + q[0] - 2 * cx) + (p[1] + q[1] - 2 * cy) > 0 ? poly([[p[0], p[1], h], [q[0], q[1], h], [cx + (q[0] - cx) * 0.2, cy + (q[1] - cy) * 0.2, h + 1], [cx + (p[0] - cx) * 0.2, cy + (p[1] - cy) * 0.2, h + 1]], k % 2 ? SLATE[1] : SLATE[0]) : ''; }).join('');
    return s + poly(ring.map(function (p) { return [p[0], p[1], h]; }), '#3d3a38') + poly(ring.map(function (p) { return [cx + (p[0] - cx) * 0.55, cy + (p[1] - cy) * 0.55, h + 0.35]; }), GLASS[1]);
  }
  function scaffold(x, y, w, d, z0, h) {
    var c = '#c98b3c', s = '';
    [[x - 0.15, y + d + 0.15], [x + w / 2, y + d + 0.15], [x + w + 0.15, y + d + 0.15], [x + w + 0.15, y + d / 2], [x + w + 0.15, y - 0.15]].forEach(function (p) { s += line([p[0], p[1], 0], [p[0], p[1], z0 + h + 0.3], c, 0.8); });
    [0.5, 1].forEach(function (f) { s += line([x - 0.15, y + d + 0.15, z0 + h * f], [x + w + 0.15, y + d + 0.15, z0 + h * f], c, 0.7) + line([x + w + 0.15, y - 0.15, z0 + h * f], [x + w + 0.15, y + d + 0.15, z0 + h * f], c, 0.7); });
    return s;
  }
  function craneFor(x, y, w, d, hookZ) {
    var mx = x - 0.7, my = y - 0.7, mh = hookZ + 2.4, Y = ['#f7c04a', '#e8a92c', '#cc8f1c'], s = '';
    s += box(mx - 0.16, my - 0.16, 0, 0.32, 0.32, mh, Y);
    s += box(mx - 1.4, my - 0.12, mh, Math.min(w, 4) + 2.8, 0.24, 0.22, Y) + box(mx - 1.4, my - 0.3, mh - 0.45, 0.7, 0.6, 0.45, ['#aab2b9', '#8f979e', '#7a8289']);
    var hx = x + Math.min(w, 4) * 0.6, cp = P(hx, my, mh), bp = P(hx, my, hookZ + 0.6);
    s += '<g class="cm-hook"><line x1="' + cp[0].toFixed(1) + '" y1="' + cp[1].toFixed(1) + '" x2="' + bp[0].toFixed(1) + '" y2="' + bp[1].toFixed(1) + '" stroke="#555" stroke-width=".8"/>' +
      box(hx - 0.35, my - 0.35, hookZ, 0.7, 0.7, 0.55, ['#efe6d4', '#dacdb5', '#c4b598']) +
      '<animateTransform attributeName="transform" type="translate" values="0 -6;0 0;0 -6" dur="5s" repeatCount="indefinite"/></g>';
    return s;
  }
  function sortItems(items) {
    var n = items.length, before = items.map(function () { return []; }), deg = items.map(function () { return 0; });
    for (var i = 0; i < n; i++) for (var j = 0; j < n; j++) {
      if (i === j) continue;
      var a = items[i], b = items[j];
      var behind = (a.x1 <= b.x0 + 1e-6 && a.y0 < b.y1 && b.y0 < a.y1) || (a.y1 <= b.y0 + 1e-6 && a.x0 < b.x1 && b.x0 < a.x1) || (a.x1 <= b.x0 + 1e-6 && a.y1 <= b.y0 + 1e-6);
      if (behind) { before[i].push(j); deg[j]++; }
    }
    var ready = [], out = [], key = function (i) { return items[i].x0 + items[i].x1 + items[i].y0 + items[i].y1; };
    for (var k = 0; k < n; k++) if (!deg[k]) ready.push(k);
    while (ready.length) {
      ready.sort(function (p, q) { return key(p) - key(q); });
      var c = ready.shift();
      out.push(items[c]);
      before[c].forEach(function (j) { if (--deg[j] === 0) ready.push(j); });
    }
    if (out.length < n) items.forEach(function (it) { if (out.indexOf(it) < 0) out.push(it); });
    return out;
  }
  function tree(x, y, pal) {
    var r = 0.6 + hash(x + ',' + y) * 0.35, h = 1.1 + hash(y + ':' + x) * 0.8;
    return box(x - 0.1, y - 0.1, 0, 0.2, 0.2, 0.7, ['#8d7253', '#7c6348', '#68523b']) +
      box(x - r, y - r, 0.6, 2 * r, 2 * r, h, pal) + box(x - r * 0.6, y - r * 0.6, 0.6 + h, 1.2 * r, 1.2 * r, 0.55, [mix(pal[0], '#ffffff', 0.12), pal[1], pal[2]]);
  }
  function clockFace() {
    var d = new Date(), m = d.getMinutes(), hr = (d.getHours() % 12) + m / 60, ticks = '';
    for (var i = 0; i < 12; i++) { var a = i * Math.PI / 6; ticks += '<line x1="' + (0.34 * Math.sin(a)).toFixed(3) + '" y1="' + (-0.34 * Math.cos(a)).toFixed(3) + '" x2="' + (0.41 * Math.sin(a)).toFixed(3) + '" y2="' + (-0.41 * Math.cos(a)).toFixed(3) + '" stroke="#2b2b2b" stroke-width=".04"/>'; }
    return '<circle r=".5" fill="#f4efe1" stroke="#c9bfa5" stroke-width=".07"/>' + ticks +
      '<line class="cm-hh" x1="0" y1="0" x2="0" y2="-.24" stroke="#222" stroke-width=".07" stroke-linecap="round" transform="rotate(' + (hr * 30).toFixed(1) + ')"/>' +
      '<line class="cm-mh" x1="0" y1="0" x2="0" y2="-.37" stroke="#222" stroke-width=".045" stroke-linecap="round" transform="rotate(' + (m * 6) + ')"/>' +
      '<circle r=".04" fill="#222"/>';
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
  function nameOf(id) { var b = SCHOOL.concat(PITCHES).filter(function (x) { return x.id === id; })[0]; return b ? b.name : id; }

  var clockTimer = null;
  function mount(host) {
    Promise.all([
      fetch('/study-meta.json', { credentials: 'same-origin' }).then(function (r) { if (!r.ok) throw new Error('meta'); return r.json(); }),
      new Promise(function (ok) { S.pull(ok); })
    ]).then(function (r) {
      var meta = r[0];
      function paint() {
        var st = stats(meta), pic = draw(st), all = ORDER.length;
        var need = pic.next ? COST[pic.next] - st.points : 0;
        host.innerHTML = '<div class="cm-card"><div class="cm-hud">' +
          '<span><b>' + pic.built + '/' + all + '</b>buildings</span><span><b>' + st.done + '</b>questions done</span>' +
          '<span><b>' + st.mocks + '</b>mock papers</span></div>' +
          pic.svg +
          (pic.next ? '<div class="cm-unlock"><b>Going up now</b><span><em>' + esc(nameOf(pic.next)) + '</em><i style="--p:' + Math.round(pic.nextFrac * 100) + '%"></i>' +
            need + ' more point' + (need === 1 ? '' : 's') + '</span><span class="cm-how">Every question you do is 1 point and every mock paper 15.</span></div>' : '<div class="cm-unlock"><b>The whole school is built.</b></div>') +
          '<div class="cm-foot">' + (st.done ? '' : '<span class="cm-tip">Merchant Taylors\' is on the drawing board. Every question you do and every mock paper you hand in builds it, starting with the Great Hall.</span>') +
          nextUp() + '<span class="cm-btns"><a class="btn-quiet" href="/planner">Revision planner</a><button type="button" class="btn-quiet cm-save">Save picture</button></span></div></div>';
        host.querySelector('.cm-save').addEventListener('click', function () { savePicture(host.querySelector('.campus-art')); });
        if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) { var sv = host.querySelector('.campus-art'); if (sv.pauseAnimations) sv.pauseAnimations(); }
      }
      paint();
      clearInterval(clockTimer);
      clockTimer = setInterval(function () {   // keep the clock tower on the real time
        var d = new Date(), m = d.getMinutes(), h = (d.getHours() % 12) + m / 60;
        Array.prototype.forEach.call(host.querySelectorAll('.cm-hh'), function (el) { el.setAttribute('transform', 'rotate(' + (h * 30).toFixed(1) + ')'); });
        Array.prototype.forEach.call(host.querySelectorAll('.cm-mh'), function (el) { el.setAttribute('transform', 'rotate(' + m * 6 + ')'); });
      }, 20000);
      new MutationObserver(paint).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    }).catch(function () { host.innerHTML = ''; });
  }
  return { mount: mount, _stats: stats, _order: ORDER, _cost: COST };
})();
