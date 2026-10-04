// The 404 page: a giant face-on "404" built from stone blocks. The 0 swings from a tower crane above its
// empty slot, one builder hammers on the scaffolding and another checks the plans, puzzled.
import { LOGO_PATHS } from './scene.js';
import { ICON_LINKS } from './icons.js';

// oblique projection: x right, y up, z into the page (so we see each block's front, top and right side)
const G = 700, DX = .55, DY = .38;
const P = (x, y, z = 0) => [x + z * DX, G - y - z * DY];
const f = n => n.toFixed(1);
const pts = a => a.map(p => P(...p).map(f).join(',')).join(' ');
const poly = (a, fill, extra = '') => `<polygon points="${pts(a)}" fill="${fill}"${extra}/>`;

const U = 44, D = 34;  // block size and depth
const STONE = { front: '#e9dfcc', top: '#f6f0e4', side: '#cdbfa5', joint: '#d6c9b1' };
function block(x, y, c = STONE) {
  return poly([[x, y + U, 0], [x + U, y + U, 0], [x + U, y + U, D], [x, y + U, D]], c.top) +
    poly([[x + U, y, 0], [x + U, y, D], [x + U, y + U, D], [x + U, y + U, 0]], c.side) +
    poly([[x, y, 0], [x + U, y, 0], [x + U, y + U, 0], [x, y + U, 0]], c.front, ` stroke="${c.joint}" stroke-width="1.6"`) +
    `<path d="M${f(P(x + 7, y + U - 9)[0])} ${f(P(x + 7, y + U - 9)[1])}h${U * .32}" stroke="#fffaf0" stroke-width="2.2" stroke-linecap="round" opacity=".55"/>`;
}
const GLYPH = {
  4: ['...#.', '..##.', '.#.#.', '#..#.', '#####', '...#.', '...#.'],
  0: ['.###.', '#...#', '#..##', '#.#.#', '##..#', '#...#', '.###.'],
};
function digit(ch, x0, y0) {
  const cells = [];
  GLYPH[ch].forEach((row, r) => [...row].forEach((c, i) => { if (c === '#') cells.push([x0 + i * U, y0 + (6 - r) * U]); }));
  cells.sort((a, b) => (a[0] * DX + a[1] * DY) - (b[0] * DX + b[1] * DY));
  return cells.map(([x, y]) => block(x, y)).join('');
}

// a builder seen from the front; (x, y) is between the feet on the ground line, s scales
function builder(x, y, s, arms) {
  const t = `translate(${f(x)} ${f(y)}) scale(${s})`;
  return `<g transform="${t}">
<ellipse cx="0" cy="1" rx="17" ry="3.6" fill="#2b2620" opacity=".16"/>
<rect x="-10" y="-6" width="9" height="6" rx="2" fill="#3b2f25"/><rect x="1" y="-6" width="9" height="6" rx="2" fill="#3b2f25"/>
<rect x="-9" y="-30" width="8" height="25" rx="2.5" fill="#2f3a4a"/><rect x="1" y="-30" width="8" height="25" rx="2.5" fill="#28323f"/>
<path d="M-12 -58 q0 -4 4 -4 h16 q4 0 4 4 v29 h-24z" fill="#f26b21"/>
<rect x="-12" y="-46" width="24" height="3" fill="#eef0f2"/><rect x="-12" y="-38" width="24" height="3" fill="#eef0f2"/>
<rect x="-1" y="-62" width="2" height="33" fill="#d4561a" opacity=".6"/>
${arms}
<rect x="-3.2" y="-66" width="6.4" height="5" fill="#d9a77d"/>
<circle cx="0" cy="-73" r="9" fill="url(#nf-skin)"/>
<circle cx="-3.2" cy="-72.5" r="1.1" fill="#3a2a20"/><circle cx="3.2" cy="-72.5" r="1.1" fill="#3a2a20"/>
<path d="M-2.6 -68.6 q2.6 1.8 5.2 0" stroke="#8a5a40" stroke-width="1" fill="none" stroke-linecap="round"/>
<path d="M-10.5 -76 a10.5 10 0 0 1 21 0z" fill="url(#nf-hat)"/><rect x="-13.5" y="-77" width="27" height="3.2" rx="1.6" fill="#e9a917"/>
<path d="M-5 -83 q3 -3 7 -2" stroke="#fff6c8" stroke-width="1.6" fill="none" stroke-linecap="round" opacity=".8"/>
</g>`;
}

function scene() {
  const s = [];
  s.push(`<defs>
<radialGradient id="nf-skin" cx="38%" cy="35%"><stop offset="0" stop-color="#f6d2ae"/><stop offset="1" stop-color="#cf966b"/></radialGradient>
<radialGradient id="nf-hat" cx="35%" cy="25%"><stop offset="0" stop-color="#ffe27a"/><stop offset="1" stop-color="#e9a917"/></radialGradient>
<linearGradient id="nf-ground" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--nf-ground-top)"/><stop offset="1" stop-color="var(--nf-ground-bottom)"/></linearGradient>
<filter id="nf-soft" x="-10%" y="-50%" width="120%" height="200%"><feGaussianBlur stdDeviation="9"/></filter>
</defs>`);
  // ground, running past both edges of the picture so it reaches the sides of any screen
  s.push(`<rect x="-3000" y="${G}" width="7440" height="900" fill="url(#nf-ground)"/>`);
  s.push(`<rect x="-3000" y="${G}" width="7440" height="3" fill="var(--nf-ground-line)"/>`);

  // tower crane: mast on the right, jib right across the top
  const mx = 1236;
  s.push(`<rect x="${mx - 30}" y="${G - 16}" width="92" height="16" fill="#b3afa7"/><rect x="${mx - 30}" y="${G - 20}" width="92" height="5" fill="#c9c6bf"/>`);
  s.push(`<rect x="${mx}" y="118" width="32" height="${G - 134}" fill="#e8a92c"/><rect x="${mx + 32}" y="124" width="12" height="${G - 140}" fill="#cc8f1c"/>`);
  let lat = '';
  for (let y = 130; y < G - 30; y += 32) lat += `M${mx + 2} ${y}L${mx + 30} ${y + 32}M${mx + 30} ${y}L${mx + 2} ${y + 32}`;
  s.push(`<path d="${lat}" stroke="#c48a16" stroke-width="2.4"/>`);
  s.push(`<rect x="${mx - 8}" y="78" width="48" height="40" rx="4" fill="#f2b33a"/><rect x="${mx - 2}" y="86" width="20" height="16" rx="2" fill="#5c6f80"/>`);
  s.push(`<path d="M${mx + 16} 78 L${mx + 16} 22" stroke="#cc8f1c" stroke-width="7"/>`);
  s.push(`<path d="M${mx + 16} 24 L520 100 M${mx + 16} 24 L1420 100" stroke="#8f979e" stroke-width="2"/>`);
  let jib = `M500 100H1440M500 128H1440`;
  for (let x = 500; x < 1440; x += 28) jib += `M${x} 128L${x + 14} 100L${x + 28} 128`;
  s.push(`<path d="${jib}" stroke="#e2a12a" stroke-width="5" fill="none" stroke-linejoin="round"/>`);
  s.push(`<rect x="1350" y="128" width="80" height="54" rx="3" fill="#b3afa7"/><rect x="1350" y="128" width="80" height="8" fill="#c9c6bf"/>`);

  // scaffolding on the left of the first 4
  const sx0 = 236, sx1 = 312;
  s.push(`<g stroke="#8f979e" stroke-width="7" stroke-linecap="round">
<path d="M${sx0} ${G} V${G - 300}M${sx1} ${G} V${G - 300}"/>
<path d="M${sx0} ${G - 8} L${sx1} ${G - 150} M${sx1} ${G - 158} L${sx0} ${G - 290}" stroke-width="3.5"/></g>`);
  for (const h of [150, 290]) s.push(`<rect x="${sx0 - 22}" y="${G - h}" width="${sx1 - sx0 + 104}" height="12" rx="2" fill="#d9a35f"/><rect x="${sx0 - 22}" y="${G - h + 12}" width="${sx1 - sx0 + 104}" height="5" fill="#ad7a3e"/>`);

  // the 4 _ 4, with the slot for the 0 outlined on the ground
  const x4a = 330, x0 = 616, x4b = 902;
  s.push(`<g filter="url(#nf-soft)" opacity=".18"><rect x="${x4a - 10}" y="${G - 14}" width="${x4b + 5 * U - x4a + 50}" height="24" rx="12" fill="#2b2620"/></g>`);
  s.push(`<polygon points="${pts([[x0, 0, 0], [x0 + 5 * U, 0, 0], [x0 + 5 * U, 0, D], [x0, 0, D]])}" fill="none" stroke="#b9ad98" stroke-width="2.4" stroke-dasharray="9 7"/>`);
  s.push(digit(4, x4a, 0));
  s.push(digit(4, x4b, 0));

  // builder on the scaffold, hammering the 4
  const hx = 286, hy = G - 290;
  s.push(builder(hx, hy, 1.15, `<path d="M-12 -55 q-7 9 -6 22" stroke="#f26b21" stroke-width="7" fill="none" stroke-linecap="round"/><circle cx="-18" cy="-32" r="3.6" fill="url(#nf-skin)"/>
<g><animateTransform attributeName="transform" type="rotate" values="-70 11 -55;12 11 -55;-70 11 -55" keyTimes="0;.32;1" calcMode="spline" keySplines=".5 0 .9 .4;.3 .1 .4 1" dur=".95s" repeatCount="indefinite"/>
<path d="M11 -55 q12 2 20 10" stroke="#f26b21" stroke-width="7" fill="none" stroke-linecap="round"/><circle cx="31" cy="-45" r="3.6" fill="url(#nf-skin)"/>
<path d="M31 -45 L46 -33" stroke="#8a5a2b" stroke-width="3.4" stroke-linecap="round"/><rect x="41" y="-41" width="10" height="16" rx="2" fill="#6b737a" transform="rotate(40 46 -33)"/></g>`));
  s.push(`<g stroke="#ffcf4a" stroke-width="3" stroke-linecap="round" opacity="0"><animate attributeName="opacity" values="0;0;1;0;0" keyTimes="0;.3;.34;.52;1" dur=".95s" repeatCount="indefinite"/>
<path d="M${hx + 60} ${hy - 30} l10 -8 M${hx + 62} ${hy - 22} l13 1 M${hx + 58} ${hy - 38} l3 -12"/></g>`);

  // the 0, swinging from the crane above its slot
  const tx = x0 + 2.5 * U + D * DX / 2, ty = 128, topY = G - (130 + 7 * U);
  s.push(`<rect x="${tx - 24}" y="${ty}" width="48" height="16" rx="3" fill="#55606b"/><circle cx="${tx - 12}" cy="${ty}" r="5" fill="#3d4650"/><circle cx="${tx + 12}" cy="${ty}" r="5" fill="#3d4650"/>`);
  s.push(`<g><animateTransform attributeName="transform" type="rotate" values="-3 ${tx} ${ty};3 ${tx} ${ty};-3 ${tx} ${ty}" keyTimes="0;.5;1" calcMode="spline" keySplines=".45 0 .55 1;.45 0 .55 1" dur="3.6s" repeatCount="indefinite"/>
<g><animateTransform attributeName="transform" type="translate" values="0 0;0 -10;0 0" keyTimes="0;.5;1" calcMode="spline" keySplines=".45 0 .55 1;.45 0 .55 1" dur="5s" repeatCount="indefinite"/>
<path d="M${tx - 4} ${ty + 16} V${topY - 52} M${tx + 4} ${ty + 16} V${topY - 52}" stroke="#33312e" stroke-width="2.4"/>
<path d="M${tx} ${topY - 46} L${x0 + 18} ${topY - 4} M${tx} ${topY - 46} L${x0 + 5 * U - 2} ${topY - 4}" stroke="#55606b" stroke-width="3"/>
<rect x="${tx - 14}" y="${topY - 58}" width="28" height="14" rx="3" fill="#f2b33a"/><path d="M${tx} ${topY - 44} v8 a6 6 0 1 1 -6 6" stroke="#3d4650" stroke-width="4" fill="none" stroke-linecap="round"/>
${digit(0, x0, 130)}</g></g>`);

  // puzzled builder under the gap, with the plans and a question mark
  const bx = x0 + 2.5 * U, by = G + 6;
  s.push(builder(bx, by, 1.25, `<g><animateTransform attributeName="transform" type="rotate" values="0 11 -55;-16 11 -55;0 11 -55;-16 11 -55;0 11 -55;0 11 -55" keyTimes="0;.12;.24;.36;.48;1" dur="2.8s" repeatCount="indefinite"/>
<path d="M11 -55 q12 -8 4 -24" stroke="#f26b21" stroke-width="7" fill="none" stroke-linecap="round"/><circle cx="14" cy="-80" r="3.6" fill="url(#nf-skin)"/></g>
<path d="M-12 -55 q-8 6 -4 16" stroke="#f26b21" stroke-width="7" fill="none" stroke-linecap="round"/>
<g transform="rotate(-8 -16 -38)"><rect x="-44" y="-52" width="34" height="24" rx="2" fill="#4f86c6"/>
<path d="M-40 -46h18M-40 -40h24M-40 -34h14" stroke="#d8e7f7" stroke-width="1.6"/><rect x="-22" y="-44" width="9" height="9" fill="none" stroke="#d8e7f7" stroke-width="1.4"/></g>
<circle cx="-15" cy="-38" r="3.6" fill="url(#nf-skin)"/>`));
  s.push(`<g><animateTransform attributeName="transform" type="translate" values="0 0;0 -6;0 0" keyTimes="0;.5;1" calcMode="spline" keySplines=".45 0 .55 1;.45 0 .55 1" dur="2.4s" repeatCount="indefinite"/>
<circle cx="${bx + 34}" cy="${by - 150}" r="21" fill="#fff" stroke="#e1dace" stroke-width="2"/><path d="M${bx + 20} ${by - 134} l-8 13 l16 -7z" fill="#fff"/>
<text x="${bx + 34}" y="${by - 140}" text-anchor="middle" font-family="Inter, system-ui, sans-serif" font-size="28" font-weight="800" fill="#33312e">?</text></g>`);

  // site sign with the JBR logo, cones, a barrier and a pallet of spare blocks
  s.push(`<rect x="118" y="${G - 120}" width="8" height="120" fill="#8f979e"/><rect x="190" y="${G - 120}" width="8" height="120" fill="#7a8289"/>
<rect x="96" y="${G - 186}" width="124" height="84" rx="6" fill="#fbf9f4" stroke="#d9d1c2" stroke-width="2"/>
<svg x="108" y="${G - 174}" width="44" height="44" viewBox="0 0 248 248" overflow="visible">${LOGO_PATHS}</svg>
<rect x="160" y="${G - 168}" width="44" height="7" rx="3.5" fill="#d6ccb9"/><rect x="160" y="${G - 154}" width="34" height="7" rx="3.5" fill="#d6ccb9"/>
<rect x="108" y="${G - 122}" width="96" height="7" rx="3.5" fill="#f26b21"/>`);
  const cone = (x, h = 46) => `<ellipse cx="${x}" cy="${G}" rx="${h * .42}" ry="${h * .1}" fill="#c24d16"/><path d="M${x - h * .3} ${G - 2} L${x - 4} ${G - h} h8 L${x + h * .3} ${G - 2}z" fill="#f26b21"/><path d="M${x - h * .2} ${G - h * .4} h${h * .4}" stroke="#fff" stroke-width="${h * .11}"/>`;
  s.push(cone(560) + cone(1190, 40) + cone(40, 38));
  s.push(`<rect x="1150" y="${G - 70}" width="7" height="70" fill="#8f979e"/><rect x="1300" y="${G - 70}" width="7" height="70" fill="#8f979e"/>`);
  let bar = '';
  for (let i = 0; i < 9; i++) bar += `<rect x="${1136 + i * 20}" y="${G - 76}" width="20" height="16" fill="${i % 2 ? '#fff' : '#e55a4e'}"/>`;
  s.push(bar + `<rect x="1136" y="${G - 76}" width="180" height="16" fill="none" stroke="#c9c1b3" stroke-width="1.5"/>`);
  s.push(`<rect x="1370" y="${G - 12}" width="120" height="12" fill="#c99453"/>` + block(1376, 12) + block(1424, 12) + block(1400, 56));
  return s.join('\n');
}

const SCENE = scene();

const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function notFoundPage(path) {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex"><meta name="color-scheme" content="light dark">
<title>Page not found · JB Revision</title>
<script>try { var t = localStorage.getItem('hub-theme'); if (t) document.documentElement.setAttribute('data-theme', t); } catch (e) {}</script>
${ICON_LINKS}
<link rel="stylesheet" href="/fonts.css?v=2">
<style>
:root { --bg: #f4f1ea; --ink: #2b2925; --muted: #6b6862; --nf-ground-top: #ddd6c8; --nf-ground-bottom: #e9e4da; --nf-ground-line: #cbc2b1; }
:root[data-theme="dark"] { --bg: #17171a; --ink: #ecebe8; --muted: #a3a09a; --nf-ground-top: #2a2a2f; --nf-ground-bottom: #1d1d21; --nf-ground-line: #3a3a41; }
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) { --bg: #17171a; --ink: #ecebe8; --muted: #a3a09a; --nf-ground-top: #2a2a2f; --nf-ground-bottom: #1d1d21; --nf-ground-line: #3a3a41; }
}
* { box-sizing: border-box; }
html, body { margin: 0; height: 100%; overflow: hidden; }
body { background: var(--bg); color: var(--ink); font-family: Inter, "Segoe UI", system-ui, -apple-system, Roboto, Helvetica, Arial, sans-serif; }
.stage { position: fixed; inset: 0; }
.stage > svg { width: 100%; height: 100%; display: block; overflow: visible; }
.copy { position: fixed; top: clamp(20px, 5vh, 56px); left: clamp(20px, 4vw, 64px); max-width: 420px; z-index: 2; }
.kicker { font-size: .8rem; font-weight: 600; letter-spacing: .14em; text-transform: uppercase; color: var(--muted); margin: 0 0 10px; }
h1 { font-size: clamp(1.7rem, 3.4vw, 2.6rem); line-height: 1.1; letter-spacing: -.8px; margin: 0 0 12px; }
p { color: var(--muted); line-height: 1.5; margin: 0 0 20px; font-size: 1rem; }
.path { font-family: ui-monospace, Menlo, Consolas, monospace; font-size: .85em; color: var(--ink); overflow-wrap: anywhere; }
.btns { display: flex; gap: 10px; flex-wrap: wrap; }
.btns a, .btns button { font: inherit; font-weight: 600; font-size: .95rem; padding: 11px 18px; border-radius: 10px; text-decoration: none; cursor: pointer; }
.go { background: var(--ink); color: var(--bg); border: 0; }
.back { background: transparent; color: var(--ink); border: 1.5px solid currentColor; }
.go:hover, .back:hover { opacity: .88; }
a:focus-visible, button:focus-visible { outline: 3px solid var(--ink); outline-offset: 2px; }
.jbr-ink { fill: #3a3530; } .jbr-ring { stroke: #3a3530; }
@media (max-width: 700px) {
  .copy { position: relative; top: auto; left: auto; padding: 24px 20px 0; max-width: none; }
  .stage { top: auto; height: 62vh; }
}
@media (prefers-reduced-motion: reduce) { .stage * { animation: none !important; } }
</style></head>
<body>
<div class="copy">
<p class="kicker">Error 404</p>
<h1>This page hasn't been built yet</h1>
<p>We couldn't find <span class="path">${esc(path)}</span>. It may have moved, or the link might be wrong.</p>
<div class="btns"><a class="go" href="/">Back to the home page</a><button class="back" type="button" onclick="history.length > 1 ? history.back() : location.assign('/')">Go back</button></div>
</div>
<div class="stage"><svg viewBox="0 0 1480 820" preserveAspectRatio="xMidYMax meet" role="img" aria-label="A crane lowering the 0 of a giant 404 made of stone blocks while one builder hammers and another checks the plans">${SCENE}</svg></div>
<script>
// on narrow screens, frame the 404 itself
(function () {
  var sv = document.querySelector(".stage > svg");
  function frame() { sv.setAttribute('viewBox', innerWidth < 700 ? '290 250 880 500' : '0 0 1480 820'); }
  frame(); addEventListener('resize', frame);
  if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches && sv.pauseAnimations) sv.pauseAnimations();
})();
</script>
</body></html>`;
}
