// The old address (josh-b-revision.pages.dev) no longer serves the site: every page there is this popup, saying
// the site has moved to jbrevision.co.uk. Its picture is an isometric scene of someone carrying boxes from a small
// house to a skyscraper with the JBR logo on its roof; each box they carry in lights up more of the skyscraper.
// Built from simple 3D boxes projected to SVG, like the maintenance picture (scene.js), and animated with SMIL.
import { LOGO_PATHS } from './scene.js';
import { ICON_SVG } from './icons.js';

export const NEW_SITE = 'https://jbrevision.co.uk';

// the old address and its per-deployment addresses (<id>.josh-b-revision.pages.dev)
export const isOldAddress = host => host === 'josh-b-revision.pages.dev' || host.endsWith('.josh-b-revision.pages.dev');

const C = Math.cos(Math.PI / 6), S = 0.5, K = 1.22, OX = 150, OY = 66;
const B = { x0: 1e9, y0: 1e9, x1: -1e9, y1: -1e9 }; // extent of everything drawn, for the viewBox
const P = (x, y, z) => {
  const p = [(x - y) * C * K + OX, ((x + y) * S - z) * K + OY];
  B.x0 = Math.min(B.x0, p[0]); B.x1 = Math.max(B.x1, p[0]); B.y0 = Math.min(B.y0, p[1]); B.y1 = Math.max(B.y1, p[1]);
  return p;
};
const f1 = v => v.toFixed(1);
const pt = p => `${f1(p[0])},${f1(p[1])}`;
const poly = (pts, fill, extra = '') => `<polygon points="${pts.map(p => pt(P(...p))).join(' ')}" fill="${fill}" stroke="${fill}" stroke-width=".35" stroke-linejoin="round"${extra}/>`;

// palettes: [top, left face (+y), right face (+x)]
const PAL = {
  ground: ['#dfe8d0', '#c5d3b2', '#adbd98'],
  path: ['#f1ece2', '#ddd5c6', '#cbc1ae'],
  wall: ['#fbf3e6', '#f2dfc6', '#ddc6a6'],
  brick: ['#c97a5d', '#b4644a', '#9c523b'],
  tower: ['#e3e9ee', '#9fb3c3', '#7f95a8'],
  trim: ['#f7f8f9', '#e1e6ea', '#c9d0d6'],
  metal: ['#aab2b9', '#8f979e', '#7a8289'],
  sign: ['#ffffff', '#f4f2ee', '#dedad3'],
  card: ['#ecc58f', '#d8a96a', '#bf8f52'],
  trunk: ['#a5774d', '#8c6240', '#755134'],
};

function box(x, y, z, w, d, h, pal, extra = '') {
  const [t, l, r] = PAL[pal] || pal;
  return poly([[x, y, z + h], [x + w, y, z + h], [x + w, y + d, z + h], [x, y + d, z + h]], t, extra) +
    poly([[x, y + d, z], [x + w, y + d, z], [x + w, y + d, z + h], [x, y + d, z + h]], l, extra) +
    poly([[x + w, y, z], [x + w, y + d, z], [x + w, y + d, z + h], [x + w, y, z + h]], r, extra);
}
const line = (a, b, stroke, w = .8, extra = '') => { const p = P(...a), q = P(...b); return `<line x1="${f1(p[0])}" y1="${f1(p[1])}" x2="${f1(q[0])}" y2="${f1(q[1])}" stroke="${stroke}" stroke-width="${w}" stroke-linecap="round"${extra}/>`; };
// SVG transforms that lay flat artwork onto a wall, top-left corner at (x, Y, z): plane y = Y (faces +y; across is +x)
// or plane x = X (faces +x; across is -y)
const onY = (x, Y, z) => { const o = P(x, Y, z); return `matrix(${(C * K).toFixed(4)},${(S * K).toFixed(4)},0,${K},${o[0].toFixed(2)},${o[1].toFixed(2)})`; };
const onX = (X, y, z) => { const o = P(X, y, z); return `matrix(${(C * K).toFixed(4)},${(-S * K).toFixed(4)},0,${K},${o[0].toFixed(2)},${o[1].toFixed(2)})`; };

// one loop of the story: three trips of 4 s (a box each), then a moment with the skyscraper all lit up
const T = 15;
const loop = pts => `values="${pts.map(p => p[1]).join(';')}" keyTimes="${pts.map(p => (p[0] / T).toFixed(4)).join(';')}" dur="${T}s" repeatCount="indefinite"`;
const fade = pts => `<animate attributeName="opacity" ${loop(pts)}/>`;
const RESET = [14.3, 14.9]; // everything goes back to the start here
const lightAt = t => fade([[0, 0], [t, 0], [t + .45, 1], [RESET[0], 1], [RESET[1], 0], [T, 0]]);
const darkAt = t => fade([[0, 1], [t, 1], [t + .45, 0], [RESET[0], 0], [RESET[1], 1], [T, 1]]);

// where the walker goes: out of the house door, along the path, in at the skyscraper door
const HOUSE_DOOR = 17, TOWER_DOOR = 86, LANE = 44.5;
const TRIP = [[0, [HOUSE_DOOR, 39]], [.45, [HOUSE_DOOR, LANE]], [3.05, [TOWER_DOOR, LANE]], [3.5, [TOWER_DOOR, 39.5]]];

function tree(x, y, h, r) {
  const g = P(x, y, 0), c = P(x, y, h);
  return `<ellipse cx="${f1(g[0])}" cy="${f1(g[1])}" rx="${f1(r * .9)}" ry="${f1(r * .45)}" fill="#3a352d" opacity=".12"/>` +
    box(x - .8, y - .8, 0, 1.6, 1.6, h * .7, 'trunk') +
    `<circle cx="${f1(c[0])}" cy="${f1(c[1])}" r="${f1(r)}" fill="url(#mv-leaf)"/>` +
    `<circle cx="${f1(c[0] - r * .3)}" cy="${f1(c[1] - r * .35)}" r="${f1(r * .45)}" fill="#a9d18e" opacity=".55"/>`;
}
const bush = (x, y, r) => { const c = P(x, y, r * .6); return `<circle cx="${f1(c[0])}" cy="${f1(c[1])}" r="${f1(r)}" fill="url(#mv-leaf)"/>`; };

// the person carrying a box, drawn in screen units with their feet at 0,0
function walker() {
  // a small cardboard box held in front, as an isometric cube in screen units
  const q = (x, y, z) => `${f1((x - y) * C + 1.4)},${f1((x + y) * S - z - 10.4)}`;
  const a = 4.6, face = pts => pts.map(p => q(...p)).join(' ');
  const carton = `<polygon points="${face([[0, 0, a], [a, 0, a], [a, a, a], [0, a, a]])}" fill="${PAL.card[0]}"/>` +
    `<polygon points="${face([[0, a, 0], [a, a, 0], [a, a, a], [0, a, a]])}" fill="${PAL.card[1]}"/>` +
    `<polygon points="${face([[a, 0, 0], [a, a, 0], [a, a, a], [a, 0, a]])}" fill="${PAL.card[2]}"/>` +
    `<polyline points="${face([[a / 2, 0, a], [a / 2, a, a], [a / 2, a, a * .55]])}" fill="none" stroke="#f6e3c1" stroke-width=".7"/>`;
  return `<ellipse cx="0" cy="0" rx="3.8" ry="1.3" fill="#3a352d" opacity=".2"/>
<line x1="0" y1="-8" x2="0" y2="-.7" stroke="#26303d" stroke-width="2.4" stroke-linecap="round"><animateTransform attributeName="transform" type="rotate" values="24 0 -8;-24 0 -8;24 0 -8" dur=".6s" repeatCount="indefinite"/></line>
<line x1="0" y1="-8" x2="0" y2="-.7" stroke="#2f3a4a" stroke-width="2.4" stroke-linecap="round"><animateTransform attributeName="transform" type="rotate" values="-24 0 -8;24 0 -8;-24 0 -8" dur=".6s" repeatCount="indefinite"/></line>
<g><animateTransform attributeName="transform" type="translate" values="0 0;0 -.7;0 0" dur=".3s" repeatCount="indefinite"/>
<rect x="-3.6" y="-16.6" width="7.2" height="9.4" rx="2.2" fill="#17a398"/>
<circle cx="0" cy="-19.5" r="2.8" fill="url(#mv-skin)"/>
<path d="M-2.9 -19.9a2.9 2.9 0 0 1 5.8 0q-1.3-1.2-2.9-1q-1.6.1-2.9 1z" fill="#4a3426"/>
${carton}
<circle cx="-1.7" cy="-9.6" r="1.1" fill="url(#mv-skin)"/><circle cx="5.6" cy="-9.9" r="1.1" fill="url(#mv-skin)"/></g>`;
}

function sparkle(cx, cy, t) {
  return `<path d="M${f1(cx)} ${f1(cy - 3.2)}q.5 2.7 3.2 3.2q-2.7.5-3.2 3.2q-.5-2.7-3.2-3.2q2.7-.5 3.2-3.2z" fill="#ffd25a" opacity="0">` +
    `<animate attributeName="opacity" ${loop([[0, 0], [t, 0], [t + .3, 1], [t + 1, 0], [t + 1.4, 0], [t + 1.7, 1], [t + 2.3, 0], [T, 0]])}/></path>`;
}

function scene() {
  const s = [];
  s.push(`<defs>
<radialGradient id="mv-skin" cx="35%" cy="35%"><stop offset="0" stop-color="#f6d2ae"/><stop offset="1" stop-color="#cf966b"/></radialGradient>
<radialGradient id="mv-leaf" cx="35%" cy="30%"><stop offset="0" stop-color="#8cc46e"/><stop offset="1" stop-color="#4f8f45"/></radialGradient>
<linearGradient id="mv-glass" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4d6478"/><stop offset="1" stop-color="#34475a"/></linearGradient>
<linearGradient id="mv-lit" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffeab0"/><stop offset="1" stop-color="#f6c75a"/></linearGradient>
</defs>`);
  const clouds = s.length; // (clouds go here, once the size of the picture is known)

  // ground, the path between the two doors, and the trees behind it
  s.push(box(-12, 2, -5, 132, 54, 5, 'ground'));
  s.push(box(4, 41, 0, 92, 7, .5, 'path') + box(HOUSE_DOOR - 2.5, 38, 0, 5, 3, .5, 'path') + box(TOWER_DOOR - 3.5, 38, 0, 7, 3, .5, 'path'));
  s.push(tree(50, 10, 13, 6.5) + tree(42, 28, 9, 5));

  // the small house: walls, chimney (with smoke), pitched roof, door and windows that go dark as it empties
  s.push(box(2, 16, 0, 28, 22, 16, 'wall'));
  s.push(poly([[1, 15, 15.4], [31, 15, 15.4], [31, 27, 25], [1, 27, 25]], '#d9785a'));
  s.push(box(7, 19, 17, 4, 4, 12, 'brick'));
  const sm = P(9, 21, 29);
  for (let i = 0; i < 3; i++) {
    s.push(`<circle cx="${f1(sm[0])}" cy="${f1(sm[1])}" r="1.6" fill="#e3e1dc" opacity="0">` +
      `<animate attributeName="cy" values="${f1(sm[1])};${f1(sm[1] - 16)}" dur="3s" begin="${i}s" repeatCount="indefinite"/>` +
      `<animate attributeName="cx" values="${f1(sm[0])};${f1(sm[0] + 5)}" dur="3s" begin="${i}s" repeatCount="indefinite"/>` +
      `<animate attributeName="r" values="1.4;3.6" dur="3s" begin="${i}s" repeatCount="indefinite"/>` +
      `<animate attributeName="opacity" values="0;.85;0" dur="3s" begin="${i}s" repeatCount="indefinite"/></circle>`);
  }
  s.push(poly([[30, 16, 16], [30, 38, 16], [30, 27, 25]], PAL.wall[2]));
  s.push(poly([[1, 27, 25], [31, 27, 25], [31, 39, 15.4], [1, 39, 15.4]], '#c8664a'));
  s.push(line([1, 27, 25.2], [31, 27, 25.2], '#a9533b', .9));
  s.push(`<g transform="${onY(HOUSE_DOOR - 3, 38, 11)}"><rect width="6" height="11" rx=".8" fill="#7a4e33"/><circle cx="4.8" cy="6" r=".5" fill="#f1c76b"/></g>`);
  const houseWin = (tf, at) => `<g transform="${tf}"><rect width="6" height="5.5" rx=".6" fill="url(#mv-glass)"/>` +
    `<rect width="6" height="5.5" rx=".6" fill="url(#mv-lit)">${darkAt(at)}</rect>` +
    `<rect x="2.75" width=".5" height="5.5" fill="#fbf3e6"/><rect y="2.5" width="6" height=".5" fill="#fbf3e6"/></g>`;
  s.push(houseWin(onY(23, 38, 12), 4.3) + houseWin(onX(30, 30, 12), 8.3));

  // the boxes still to move, stacked by the door: the walker takes the top one each trip
  for (let i = 0; i < 3; i++) {
    const at = 4 * (2 - i) + .25;
    s.push(`<g>${fade([[0, 1], [at, 1], [at + .1, 0], [RESET[0], 0], [RESET[1], 1], [T, 1]])}${box(3.5, 39.5, i * 5.2, 6, 6, 5.2, 'card')}` +
      `${line([6.5, 39.5, i * 5.2 + 5.2], [6.5, 45.5, i * 5.2 + 5.2], '#f6e3c1', .6)}</g>`);
  }

  // the skyscraper: lobby with glass doors, then 15 floors of windows lighting up five floors per box carried in
  const X0 = 64, X1 = 96, Y0 = 10, Y1 = 38, H = 104;
  s.push(`<ellipse cx="${f1(P(X1, Y1, 0)[0] - 4)}" cy="${f1(P(X1, Y1, 0)[1] - 6)}" rx="40" ry="10" fill="#3a352d" opacity=".1"/>`);
  s.push(box(X0, Y0, 0, X1 - X0, Y1 - Y0, H, 'tower'));
  s.push(`<g transform="${onY(TOWER_DOOR - 6, Y1, 13)}"><rect width="12" height="13" rx=".6" fill="url(#mv-glass)"/>` +
    `<rect width="12" height="13" rx=".6" fill="url(#mv-lit)" opacity=".85"/><rect x="5.75" width=".5" height="13" fill="#e1e6ea"/></g>`);
  s.push(box(TOWER_DOOR - 7.5, Y1, 13, 15, 3.5, 1.2, 'trim'));
  for (let f = 0; f < 15; f++) {
    const z = 22 + f * 5.5, g = Math.floor(f / 5), at = 4 * g + 3.3 + (f % 5) * .12;
    const front = [], side = [];
    for (let i = 0; i < 6; i++) front.push(`<rect x="${(1.6 + i * 5.1).toFixed(1)}" width="3.6" height="3.4" rx=".4"/>`);
    for (let i = 0; i < 5; i++) side.push(`<rect x="${(1.6 + i * 5.1).toFixed(1)}" width="3.6" height="3.4" rx=".4"/>`);
    s.push(`<g transform="${onY(X0, Y1, z)}"><g fill="url(#mv-glass)">${front.join('')}</g><g fill="url(#mv-lit)" opacity="0">${lightAt(at)}${front.join('')}</g></g>`);
    s.push(`<g transform="${onX(X1, Y1, z)}"><g fill="url(#mv-glass)">${side.join('')}</g><g fill="url(#mv-lit)" opacity="0">${lightAt(at)}${side.join('')}</g></g>`);
  }
  for (const z of [16, H - 2]) s.push(line([X0, Y1, z], [X1, Y1, z], '#c9d0d6', .7) + line([X1, Y1, z], [X1, Y0, z], '#b4bec7', .7));

  // the roof: a parapet, an aerial with a blinking light and a sign with the JBR logo that glows once everyone's in
  s.push(box(X0 - .5, Y0 - .5, H, X1 - X0 + 1, Y1 - Y0 + 1, 1.6, 'trim'));
  const aer = P(X1 - 6, 16, H + 22);
  s.push(line([X1 - 6, 16, H + 1.6], [X1 - 6, 16, H + 22], '#7a8289', .9) +
    `<circle cx="${f1(aer[0])}" cy="${f1(aer[1])}" r="1.3" fill="#ff4d3d"><animate attributeName="opacity" values="1;.15;1" dur="1.4s" repeatCount="indefinite"/></circle>`);
  s.push(box(X0 + 7, 23, H + 1.6, 1, 1, 4, 'metal') + box(X0 + 24, 23, H + 1.6, 1, 1, 4, 'metal'));
  s.push(box(X0 + 5, 23.5, H + 5, 22, 1.2, 14, 'sign'));
  s.push(poly([[X0 + 5, 24.7, H + 5], [X0 + 27, 24.7, H + 5], [X0 + 27, 24.7, H + 19], [X0 + 5, 24.7, H + 19]], '#fff4c9', ` opacity="0"`).replace('/>', `>${lightAt(12.1)}</polygon>`));
  s.push(`<g class="mv-logo" transform="${onY(X0 + 10.5, 24.7, H + 17.5)}"><svg width="11" height="11" viewBox="0 0 248 248" overflow="visible">${LOGO_PATHS}</svg></g>`);
  const sg = P(X0 + 16, 24, H + 21);
  s.push(sparkle(sg[0] - 20, sg[1] + 2, 12.2) + sparkle(sg[0] + 21, sg[1] + 10, 12.6) + sparkle(sg[0] + 3, sg[1] - 8, 13));

  // in front of the path: the walker (one trip after another, appearing at the house door and going in at the
  // skyscraper's), then bushes and a tree
  const at = (x, y) => { const p = P(x, y, 0); return `${f1(p[0])} ${f1(p[1])}`; };
  const route = [], seen = [];
  for (let k = 0; k < 3; k++) {
    for (const [t, p] of TRIP) route.push([4 * k + t, at(...p)]);
    route.push([4 * k + 3.55, at(HOUSE_DOOR, 39)]);
    seen.push([4 * k, 0], [4 * k + .3, 1], [4 * k + 3.1, 1], [4 * k + 3.45, 0]);
  }
  route.push([T, at(HOUSE_DOOR, 39)]); seen.push([T, 0]);
  s.push(`<g class="mv-walker"><animateTransform attributeName="transform" type="translate" ${loop(route)}/>${fade(seen)}${walker()}</g>`);
  s.push(bush(30, 52, 3.4) + bush(35, 53, 2.6) + bush(62, 52, 3) + tree(110, 44, 11, 6) + bush(-6, 50, 3.2));

  // two clouds drifting across the sky
  const top = B.y0, left = B.x0, wide = B.x1 - B.x0;
  const cloud = (x, y, w, dur, delay) => `<g opacity=".9"><animateTransform attributeName="transform" type="translate" values="${-wide * .2} 0;${wide * .2} 0;${-wide * .2} 0" dur="${dur}s" begin="-${delay}s" repeatCount="indefinite"/>` +
    `<ellipse cx="${f1(x)}" cy="${f1(y)}" rx="${f1(w)}" ry="${f1(w * .3)}" fill="#e7edf2"/><circle cx="${f1(x - w * .25)}" cy="${f1(y - w * .2)}" r="${f1(w * .32)}" fill="#e7edf2"/>` +
    `<circle cx="${f1(x + w * .2)}" cy="${f1(y - w * .26)}" r="${f1(w * .4)}" fill="#e7edf2"/></g>`;
  s.splice(clouds, 0, cloud(left + wide * .22, top + 26, 13, 46, 10) + cloud(left + wide * .5, top + 8, 9, 38, 25));
  return s.join('\n');
}

const BODY = scene();
const VB = [B.x0 - 4, B.y0 - 8, B.x1 - B.x0 + 8, B.y1 - B.y0 + 12].map(v => v.toFixed(1)).join(' ');
const SCENE = `<svg class="mv-scene" viewBox="${VB}" role="img" aria-label="Someone carrying boxes from a small house into a skyscraper with the JBR logo on its roof, its windows lighting up as they move in">${BODY}</svg>`;

const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// the same page on the new site (the part after # is added in the browser, which never sends it)
export function newAddress(url) {
  return NEW_SITE + url.pathname + url.search;
}

export function movedPage(url) {
  const to = newAddress(url);
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex"><meta name="color-scheme" content="light dark">
<title>We've moved to jbrevision.co.uk · Josh B Revision</title>
<script>try { var t = localStorage.getItem('hub-theme'); if (t) document.documentElement.setAttribute('data-theme', t); } catch (e) {}</script>
<link rel="icon" href="${ICON_SVG}" type="image/svg+xml">
<link rel="icon" href="${NEW_SITE}/favicon-32.png" sizes="32x32" type="image/png">
<link rel="apple-touch-icon" href="${NEW_SITE}/apple-touch-icon.png">
<style>
:root { --bg: #ecebe7; --card: #fff; --ink: #33312e; --muted: #6b6862; --line: #e4e2dd; --accent: #17a398; --logo: #3a3530; }
:root[data-theme="dark"] { --bg: #0f0f11; --card: #222226; --ink: #ecebe8; --muted: #a3a09a; --line: #34343a; --logo: #3a3530; }
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) { --bg: #0f0f11; --card: #222226; --ink: #ecebe8; --muted: #a3a09a; --line: #34343a; }
}
* { box-sizing: border-box; }
html, body { overflow-x: hidden; }
body { margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 24px 16px; background: var(--bg); color: var(--ink);
  font-family: Inter, "Segoe UI", system-ui, -apple-system, Roboto, Helvetica, Arial, sans-serif; }
.moved { width: min(480px, 100%); background: var(--card); border: 1px solid var(--line); border-radius: 18px; padding: 22px 24px 24px;
  box-shadow: 0 24px 60px rgba(0, 0, 0, .16), 0 2px 8px rgba(0, 0, 0, .06); animation: pop .45s cubic-bezier(.2, .9, .3, 1.2) both; }
@keyframes pop { from { opacity: 0; transform: translateY(14px) scale(.96); } to { opacity: 1; transform: none; } }
.mv-scene { display: block; width: 100%; max-width: 360px; max-height: 46vh; margin: 0 auto 10px; }
.mv-scene .jbr-ink { fill: var(--logo); } .mv-scene .jbr-ring { stroke: var(--logo); }
.tag { display: inline-flex; align-items: center; gap: 6px; font-size: .8rem; font-weight: 600; color: var(--accent); margin: 0 0 6px; }
.tag::before { content: ""; width: 8px; height: 8px; border-radius: 50%; background: var(--accent); }
h1 { font-size: 1.35rem; line-height: 1.3; margin: 0 0 8px; letter-spacing: -.2px; }
p { color: var(--muted); line-height: 1.5; margin: 0 0 12px; font-size: .95rem; }
p b { color: var(--ink); }
.go { display: flex; align-items: center; justify-content: center; gap: 8px; min-height: 46px; margin-top: 16px; text-decoration: none; font-weight: 600;
  background: var(--ink); color: var(--card); padding: 11px 14px; border-radius: 12px; }
.go:hover { opacity: .9; }
.note { font-size: .85rem; margin: 12px 0 0; text-align: center; }
a:focus-visible { outline: 2px solid var(--ink); outline-offset: 2px; }
@media (prefers-reduced-motion: reduce) { .moved { animation: none; } }
</style></head>
<body>
<main class="moved" role="dialog" aria-modal="true" aria-labelledby="mv-title">
${SCENE}
<p class="tag">New address</p>
<h1 id="mv-title">We've moved!</h1>
<p>Josh B Revision has a new home at <b>jbrevision.co.uk</b>. This old address doesn't work any more, so please use the new one from now on and update your bookmarks.</p>
<a class="go" id="go" href="${esc(to)}">Go to jbrevision.co.uk <span aria-hidden="true">→</span></a>
<p class="note">You'll need to sign in once on the new site. Your progress is saved to your account, so it's all still there.</p>
</main>
<script>
var go = document.getElementById('go');
if (location.hash) go.href += location.hash;
if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) {
  var sc = document.querySelector('.mv-scene');
  if (sc && sc.pauseAnimations) { sc.setCurrentTime(6); sc.pauseAnimations(); }
}
</script>
</body></html>`;
}
