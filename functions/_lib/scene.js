// The maintenance page's picture: an isometric "3D" university building with the JBR logo on its pediment,
// a tower crane lowering a stone block onto the roof, a worker hammering on the scaffolding and windows
// lighting up one by one. Built once from simple 3D boxes projected to SVG; animated with SMIL and CSS.

const C = Math.cos(Math.PI / 6), S = 0.5, K = 1.22, OX = 150, OY = 66;
const B = { x0: 1e9, y0: 1e9, x1: -1e9, y1: -1e9 }; // extent of everything drawn, for the viewBox
const P = (x, y, z) => {
  const p = [(x - y) * C * K + OX, ((x + y) * S - z) * K + OY];
  B.x0 = Math.min(B.x0, p[0]); B.x1 = Math.max(B.x1, p[0]); B.y0 = Math.min(B.y0, p[1]); B.y1 = Math.max(B.y1, p[1]);
  return p;
};
const pt = p => `${p[0].toFixed(1)},${p[1].toFixed(1)}`;
const poly = (pts, fill, extra = '') => `<polygon points="${pts.map(p => pt(P(...p))).join(' ')}" fill="${fill}" stroke="${fill}" stroke-width=".35" stroke-linejoin="round"${extra}/>`;

// palettes: [top, left face (+y), right face (+x)]
const PAL = {
  ground: ['#e6e2d8', '#d3cdc0', '#bfb8a9'],
  stone: ['#f1ebdf', '#ddd3c0', '#c9bda6'],
  trim: ['#f8f4ec', '#e9e2d4', '#d6ccb9'],
  column: ['#fbf9f4', '#ece7dc', '#d8d1c3'],
  roof: ['#7d8a96', '#66727e', '#55606b'],
  crane: ['#f7c04a', '#e8a92c', '#cc8f1c'],
  concrete: ['#c9c6bf', '#b3afa7', '#9d998f'],
  metal: ['#aab2b9', '#8f979e', '#7a8289'],
  wood: ['#e0ac68', '#c99453', '#ad7a3e'],
  cone: ['#ff8a3d', '#f26b21', '#d4561a'],
  block: ['#efe6d4', '#dacdb5', '#c4b598'],
};

function box(x, y, z, w, d, h, pal, extra = '') {
  const [t, l, r] = PAL[pal] || pal;
  return poly([[x, y, z + h], [x + w, y, z + h], [x + w, y + d, z + h], [x, y + d, z + h]], t, extra) +
    poly([[x, y + d, z], [x + w, y + d, z], [x + w, y + d, z + h], [x, y + d, z + h]], l, extra) +
    poly([[x + w, y, z], [x + w, y + d, z], [x + w, y + d, z + h], [x + w, y, z + h]], r, extra);
}
const line = (a, b, stroke, w = .8, extra = '') => `<line x1="${P(...a)[0].toFixed(1)}" y1="${P(...a)[1].toFixed(1)}" x2="${P(...b)[0].toFixed(1)}" y2="${P(...b)[1].toFixed(1)}" stroke="${stroke}" stroke-width="${w}" stroke-linecap="round"${extra}/>`;
// SVG transforms that lay flat artwork onto a wall: plane y = Y (faces +y) or plane x = X (faces +x)
const onY = (x, Y, z) => { const o = P(x, Y, z); return `matrix(${(C * K).toFixed(4)},${(S * K).toFixed(4)},0,${K},${o[0].toFixed(2)},${o[1].toFixed(2)})`; };
const onX = (X, y, z) => { const o = P(X, y, z); return `matrix(${(C * K).toFixed(4)},${(-S * K).toFixed(4)},0,${K},${o[0].toFixed(2)},${o[1].toFixed(2)})`; };

const LOGO_PATHS = '<defs><mask id="jbr-ring-gap-scene" maskUnits="userSpaceOnUse" x="0" y="0" width="248" height="248"><rect width="248" height="248" fill="#fff"/><g transform="translate(26.00 164.25) scale(0.05402 -0.05402)" fill="#000" stroke="#000" stroke-width="222" stroke-linejoin="round"><path transform="translate(-45 0)" d="M573 -24Q319 -24 182.0 105.0Q45 234 45 474V592H429V470Q429 398 464.37254901960785 359.0Q499.7450980392157 320 566 320Q631.6929133858267 320 667.3464566929133 359.0Q703 398 703 470V1490H1119V462.3348982785603Q1119 228 977.5 102.0Q836 -24 573 -24Z"/><path transform="translate(1034 0)" d="M80 0V1490H726Q896 1490 1012.0 1442.0Q1128 1394 1187.0 1310.5Q1246 1227 1246 1118Q1246 1032 1210.0 962.5Q1174 893 1109.5 847.5Q1045 802 958 785V783Q1054 780 1130.5 733.5Q1207 687 1251.5 607.0Q1296 527 1296 422Q1296 300 1235.0 204.5Q1174 109 1059.0 54.5Q944 0 782 0ZM484 312H704Q780 312 825.0 352.0Q870 392 870 459Q870 504 849.5 537.0Q829 570 792.0 588.0Q755 606 704 606H484ZM484 900H679Q725 900 759.0 917.0Q793 934 811.5 965.5Q830 997 830 1039Q830 1102 789.0 1140.0Q748 1178 679 1178H484Z"/><path transform="translate(2290 0)" d="M80 0V1490H713Q891 1490 1021.0 1426.5Q1151 1363 1221.5 1246.5Q1292 1130 1292 970Q1292 815 1218.5 702.0Q1145 589 1010.5 527.5Q876 466 691 466H336V788H682Q745 788 790.5 811.0Q836 834 861.0 875.0Q886 916 886 970Q886 1025 861.0 1065.5Q836 1106 790.5 1129.0Q745 1152 682 1152H496V0ZM905 0 581 676H1006L1338 0Z"/></g></mask></defs><circle cx="124" cy="124" r="92" fill="none" stroke-width="6.5" mask="url(#jbr-ring-gap-scene)" class="jbr-ring"/><g class="jbr-ink"><g transform="translate(26.00 164.25) scale(0.05402 -0.05402)"><path transform="translate(-45 0)" d="M573 -24Q319 -24 182.0 105.0Q45 234 45 474V592H429V470Q429 398 464.37254901960785 359.0Q499.7450980392157 320 566 320Q631.6929133858267 320 667.3464566929133 359.0Q703 398 703 470V1490H1119V462.3348982785603Q1119 228 977.5 102.0Q836 -24 573 -24Z"/><path transform="translate(1034 0)" d="M80 0V1490H726Q896 1490 1012.0 1442.0Q1128 1394 1187.0 1310.5Q1246 1227 1246 1118Q1246 1032 1210.0 962.5Q1174 893 1109.5 847.5Q1045 802 958 785V783Q1054 780 1130.5 733.5Q1207 687 1251.5 607.0Q1296 527 1296 422Q1296 300 1235.0 204.5Q1174 109 1059.0 54.5Q944 0 782 0ZM484 312H704Q780 312 825.0 352.0Q870 392 870 459Q870 504 849.5 537.0Q829 570 792.0 588.0Q755 606 704 606H484ZM484 900H679Q725 900 759.0 917.0Q793 934 811.5 965.5Q830 997 830 1039Q830 1102 789.0 1140.0Q748 1178 679 1178H484Z"/><path transform="translate(2290 0)" d="M80 0V1490H713Q891 1490 1021.0 1426.5Q1151 1363 1221.5 1246.5Q1292 1130 1292 970Q1292 815 1218.5 702.0Q1145 589 1010.5 527.5Q876 466 691 466H336V788H682Q745 788 790.5 811.0Q836 834 861.0 875.0Q886 916 886 970Q886 1025 861.0 1065.5Q836 1106 790.5 1129.0Q745 1152 682 1152H496V0ZM905 0 581 676H1006L1338 0Z"/></g></g>';

function scene() {
  const s = [];
  s.push(`<defs>
<filter id="soft" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="3"/></filter>
<radialGradient id="skin" cx="35%" cy="35%"><stop offset="0" stop-color="#f6d2ae"/><stop offset="1" stop-color="#cf966b"/></radialGradient>
<radialGradient id="hat" cx="35%" cy="30%"><stop offset="0" stop-color="#ffe27a"/><stop offset="1" stop-color="#e9a917"/></radialGradient>
<linearGradient id="glass" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5c6f80"/><stop offset="1" stop-color="#3d4c59"/></linearGradient>
<linearGradient id="lit" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe9a8"/><stop offset="1" stop-color="#f6c75a"/></linearGradient>
</defs>`);

  // ground and the building's soft shadow
  s.push(box(-6, -4, -5, 156, 112, 5, 'ground'));
  s.push(`<g filter="url(#soft)" opacity=".22">${poly([[24, 34, 0], [128, 34, 0], [134, 92, 0], [26, 92, 0]], '#3a352d')}</g>`);

  // tower crane mast and counter-jib (behind the building)
  s.push(box(55, 2, 0, 12, 12, 4, 'concrete'));
  s.push(box(58, 5, 4, 6, 6, 112, 'crane'));
  for (let z = 8; z < 112; z += 8) {
    s.push(line([58, 11, z], [64, 11, z + 8], '#b47c14', .5) + line([64, 11, z], [64, 5, z + 8], '#a8720f', .5));
  }

  // main building
  s.push(box(20, 30, 0, 76, 50, 38, 'stone'));
  // windows on the long (+y) face: glass, then a warm light that comes on in turn
  let n = 0;
  for (const [z0, z1] of [[7, 17], [23, 33]]) {
    for (let x = 27; x < 92; x += 9.5) {
      const w = `<g transform="${onY(x, 80, z1)}"><rect width="5" height="${z1 - z0}" rx=".6" fill="url(#glass)"/>` +
        `<rect class="win" style="animation-delay:${(n * 0.37 % 4.4).toFixed(2)}s" width="5" height="${z1 - z0}" rx=".6" fill="url(#lit)"/>` +
        `<rect y="${(z1 - z0) / 2 - .3}" width="5" height=".6" fill="#e9e2d4"/></g>`;
      s.push(w); n++;
    }
  }
  s.push(box(18, 28, 38, 80, 54, 3, 'trim'));

  // clock tower with pyramid roof, clock and flag
  s.push(box(30, 46, 41, 14, 14, 20, 'stone'));
  s.push(box(29, 45, 61, 16, 16, 2, 'trim'));
  const apex = [37, 53, 76];
  s.push(poly([[29, 61, 63], [45, 61, 63], apex], PAL.roof[1]) + poly([[45, 45, 63], [45, 61, 63], apex], PAL.roof[2]));
  s.push(`<g transform="${onX(44, 57, 56)}"><circle cx="4" cy="3.6" r="3.4" fill="#fbf9f4" stroke="#55606b" stroke-width=".5"/>` +
    `<line x1="4" y1="3.6" x2="4" y2="1.2" stroke="#33312e" stroke-width=".5"><animateTransform attributeName="transform" type="rotate" from="0 4 3.6" to="360 4 3.6" dur="12s" repeatCount="indefinite"/></line>` +
    `<line x1="4" y1="3.6" x2="5.8" y2="3.6" stroke="#33312e" stroke-width=".5"><animateTransform attributeName="transform" type="rotate" from="0 4 3.6" to="360 4 3.6" dur="144s" repeatCount="indefinite"/></line></g>`);
  const fp = P(37, 53, 89);
  s.push(line(apex, [37, 53, 90], '#55606b', .6));
  s.push(`<path class="flag" d="M${fp[0].toFixed(1)} ${fp[1].toFixed(1)} l9 -1.5 l-1.2 3.4 l1.2 3.4 l-9 1.5z" fill="#17a398"/>`);

  // portico: steps, columns, entablature and the pediment with the JBR logo
  s.push(box(96, 28, 0, 26, 54, 2, 'trim') + box(96, 29.5, 2, 22, 51, 2, 'trim') + box(96, 31, 4, 18, 48, 2, 'trim'));
  for (const y of [33, 43.5, 54, 64.5, 74]) s.push(box(108, y, 6, 4, 4, 30, 'column') + box(107.5, y - .5, 35, 5, 5, 1.5, 'trim'));
  s.push(box(94, 31, 36.5, 20, 48, 4, 'trim'));
  s.push(poly([[94, 31, 40.5], [114, 31, 40.5], [114, 55, 53], [94, 55, 53]], PAL.roof[0]));
  s.push(poly([[94, 55, 53], [114, 55, 53], [114, 79, 40.5], [94, 79, 40.5]], PAL.roof[1]));
  s.push(poly([[114, 31, 40.5], [114, 79, 40.5], [114, 55, 53]], PAL.trim[2]));
  s.push(poly([[114, 35, 41.3], [114, 75, 41.3], [114, 55, 51.4]], PAL.stone[1]));
  s.push(`<g transform="${onX(114, 60.2, 50.6)}"><svg width="10.4" height="10.4" viewBox="0 0 248 248" overflow="visible">${LOGO_PATHS}</svg></g>`);

  // scaffolding against the long face, with a worker hammering on the top board
  for (const x of [24, 44, 64]) s.push(box(x, 82, 0, 1, 1, 34, 'metal'));
  s.push(box(22, 81, 15, 44, 8, 1.2, 'wood'));
  s.push(box(22, 81, 29, 44, 8, 1.2, 'wood'));
  const [ax, ay] = P(46, 85, 30.2);
  s.push(`<g class="worker">
<rect x="${(ax - 3.1).toFixed(1)}" y="${(ay - 7.5).toFixed(1)}" width="2.5" height="7.5" rx=".8" fill="#2f3a4a"/>
<rect x="${(ax + .6).toFixed(1)}" y="${(ay - 7.5).toFixed(1)}" width="2.5" height="7.5" rx=".8" fill="#26303d"/>
<rect x="${(ax - 4.2).toFixed(1)}" y="${(ay - 16).toFixed(1)}" width="8.4" height="9.4" rx="2" fill="#f26b21"/>
<rect x="${(ax - 4.2).toFixed(1)}" y="${(ay - 12.2).toFixed(1)}" width="8.4" height="1" fill="#eef0f2"/>
<rect x="${(ax - 4.2).toFixed(1)}" y="${(ay - 9.8).toFixed(1)}" width="8.4" height="1" fill="#eef0f2"/>
<g><animateTransform attributeName="transform" type="rotate" values="-38 ${(ax + 3).toFixed(1)} ${(ay - 14.5).toFixed(1)};18 ${(ax + 3).toFixed(1)} ${(ay - 14.5).toFixed(1)};-38 ${(ax + 3).toFixed(1)} ${(ay - 14.5).toFixed(1)}" keyTimes="0;.32;1" calcMode="spline" keySplines=".5 0 .9 .4;.3 .1 .4 1" dur=".9s" repeatCount="indefinite"/>
<line x1="${(ax + 3).toFixed(1)}" y1="${(ay - 14.5).toFixed(1)}" x2="${(ax + 8.5).toFixed(1)}" y2="${(ay - 17.5).toFixed(1)}" stroke="#f26b21" stroke-width="2.2" stroke-linecap="round"/>
<line x1="${(ax + 8.5).toFixed(1)}" y1="${(ay - 17.5).toFixed(1)}" x2="${(ax + 12.5).toFixed(1)}" y2="${(ay - 20).toFixed(1)}" stroke="#8a5a2b" stroke-width="1" stroke-linecap="round"/>
<rect x="${(ax + 11.2).toFixed(1)}" y="${(ay - 22.6).toFixed(1)}" width="2.6" height="4.4" rx=".5" fill="#6b737a" transform="rotate(-30 ${(ax + 12.5).toFixed(1)} ${(ay - 20.4).toFixed(1)})"/>
<circle cx="${(ax + 8.5).toFixed(1)}" cy="${(ay - 17.5).toFixed(1)}" r="1.15" fill="url(#skin)"/></g>
<circle cx="${ax.toFixed(1)}" cy="${(ay - 18.6).toFixed(1)}" r="2.8" fill="url(#skin)"/>
<path d="M${(ax - 3.3).toFixed(1)} ${(ay - 19.2).toFixed(1)} a3.3 3.2 0 0 1 6.6 0z" fill="url(#hat)"/>
<ellipse cx="${(ax + .3).toFixed(1)}" cy="${(ay - 19.2).toFixed(1)}" rx="4.2" ry=".9" fill="#e9a917"/>
<g stroke="#ffcf4a" stroke-width=".7" stroke-linecap="round" opacity="0">
<animate attributeName="opacity" values="0;0;1;0;0" keyTimes="0;.3;.34;.5;1" dur=".9s" repeatCount="indefinite"/>
<line x1="${(ax + 16).toFixed(1)}" y1="${(ay - 18).toFixed(1)}" x2="${(ax + 18.5).toFixed(1)}" y2="${(ay - 20).toFixed(1)}"/>
<line x1="${(ax + 16.2).toFixed(1)}" y1="${(ay - 16.4).toFixed(1)}" x2="${(ax + 19).toFixed(1)}" y2="${(ay - 16).toFixed(1)}"/>
<line x1="${(ax + 15.4).toFixed(1)}" y1="${(ay - 19.6).toFixed(1)}" x2="${(ax + 16.4).toFixed(1)}" y2="${(ay - 22.2).toFixed(1)}"/></g>
</g>`);
  // front scaffold poles and braces go in front of the worker
  for (const x of [24, 44, 64]) s.push(box(x, 88, 0, 1, 1, 34, 'metal'));
  s.push(line([24.5, 89, 1], [44.5, 89, 15], '#7a8289', .6) + line([44.5, 89, 16], [64.5, 89, 29], '#7a8289', .6));

  // site props: a pallet of blocks and two cones
  s.push(box(126, 86, 0, 12, 10, 1.5, 'wood') + box(127, 87, 1.5, 5, 4, 4, 'block') + box(132.5, 87, 1.5, 5, 4, 4, 'block') + box(127, 91.5, 1.5, 5, 4, 4, 'block') + box(129.5, 89, 5.5, 5, 4, 4, 'block'));
  for (const [x, y] of [[8, 96], [140, 70]]) {
    const b = P(x, y, 0), t = P(x, y, 7);
    s.push(`<ellipse cx="${b[0].toFixed(1)}" cy="${b[1].toFixed(1)}" rx="3.6" ry="1.6" fill="#d4561a"/>` +
      `<path d="M${(b[0] - 2.6).toFixed(1)} ${b[1].toFixed(1)} L${t[0].toFixed(1)} ${t[1].toFixed(1)} L${(b[0] + 2.6).toFixed(1)} ${b[1].toFixed(1)}z" fill="#f26b21"/>` +
      `<path d="M${(b[0] - 1.6).toFixed(1)} ${(b[1] - 3).toFixed(1)} L${(b[0] + 1.6).toFixed(1)} ${(b[1] - 3).toFixed(1)}" stroke="#fff" stroke-width="1"/>`);
  }

  // crane top: cab, jib, counterweight, then the trolley carrying a block (on top of everything)
  s.push(box(57, 4, 116, 8, 8, 6, 'crane'));
  s.push(box(56, -18, 117, 10, 7, 6, 'concrete'));
  const J0 = [61, -18, 123], J1 = [61, 96, 123], top = [61, 8, 136];
  s.push(line([61, 8, 122], top, '#cc8f1c', 1.2) + line(top, J0, '#8f979e', .45) + line(top, [61, 80, 123], '#8f979e', .45));
  s.push(line(J0, J1, '#e8a92c', 2.2) + line([61, -18, 121], [61, 96, 121], '#cc8f1c', 1));
  for (let y = -16; y < 94; y += 6) s.push(line([61, y, 121], [61, y + 3, 123], '#b47c14', .45) + line([61, y + 3, 123], [61, y + 6, 121], '#b47c14', .45));

  // trolley path along the jib (screen units) and the block's drop
  const T = y => P(61, y, 121), base = T(56);
  const dx = y => (T(y)[0] - base[0]).toFixed(1), dy = y => (T(y)[1] - base[1]).toFixed(1);
  const far = 22, high = 34, low = 0; // block bottom above the roof (z = 41 + value)
  const pos = (y, h) => `${dx(y)} ${(Number(dy(y)) - h * K).toFixed(1)}`;
  const kt = '0;.35;.55;.68;.72;.92;1';
  const blockAt = [`${pos(far, high)}`, `${pos(56, high)}`, `${pos(56, low)}`, `${pos(56, low)}`, `${pos(56, low)}`, `${pos(far, high)}`, `${pos(far, high)}`].join(';');
  const trolleyAt = [dx(far) + ' ' + dy(far), '0 0', '0 0', '0 0', '0 0', dx(far) + ' ' + dy(far), dx(far) + ' ' + dy(far)].join(';');
  const blockTop = P(61, 56, 41 + 6)[1], cableTop = base[1] + 1.5;
  const cableLen = h => (blockTop - h * K - cableTop).toFixed(1);
  s.push(`<g><animateTransform attributeName="transform" type="translate" values="${trolleyAt}" keyTimes="${kt}" dur="9s" repeatCount="indefinite"/>
<rect x="${(base[0] - 3).toFixed(1)}" y="${(base[1] - 1).toFixed(1)}" width="6" height="2.6" rx=".6" fill="#55606b"/>
<line x1="${base[0].toFixed(1)}" y1="${cableTop.toFixed(1)}" x2="${base[0].toFixed(1)}" y2="${(cableTop + Number(cableLen(high))).toFixed(1)}" stroke="#33312e" stroke-width=".5">
<animate attributeName="y2" values="${[high, high, low, low, low, high, high].map(h => (cableTop + Number(cableLen(h))).toFixed(1)).join(';')}" keyTimes="${kt}" dur="9s" repeatCount="indefinite"/></line></g>`);
  s.push(`<g><animateTransform attributeName="transform" type="translate" values="${blockAt}" keyTimes="${kt}" dur="9s" repeatCount="indefinite"/>
<animate attributeName="opacity" values="1;1;1;1;0;0;1" keyTimes="${kt}" dur="9s" repeatCount="indefinite"/>
${box(57, 52, 41, 8, 8, 6, 'block')}
${line([61, 56, 47], [61, 56, 49], '#33312e', .5)}</g>`);
  // the placed block appears on the roof as the crane lets go
  s.push(`<g opacity="0"><animate attributeName="opacity" values="0;0;0;0;1;1;0" keyTimes="${kt}" dur="9s" repeatCount="indefinite"/>${box(57, 52, 41, 8, 8, 6, 'block')}</g>`);
  return s.join('\n');
}

const BODY = scene();
const VB = [B.x0 - 4, B.y0 - 6, B.x1 - B.x0 + 8, B.y1 - B.y0 + 10].map(v => v.toFixed(1)).join(' ');
export const SCENE = `<svg class="scene" viewBox="${VB}" role="img" aria-label="A crane and a builder working on a university building with the JBR logo">${BODY}</svg>`;

export const SCENE_CSS = `
.scene { display: block; width: 100%; max-width: 360px; margin: 0 auto 14px; }
.scene .win { opacity: 0; animation: lit 4.4s ease-in-out infinite; }
@keyframes lit { 0%, 40% { opacity: 0; } 55%, 85% { opacity: .95; } 100% { opacity: 0; } }
.scene .flag { transform-box: fill-box; transform-origin: left center; animation: wave 1.6s ease-in-out infinite alternate; }
@keyframes wave { from { transform: skewY(-6deg) scaleX(.94); } to { transform: skewY(5deg) scaleX(1); } }
.scene .jbr-ink { fill: #3a3530; } .scene .jbr-ring { stroke: #3a3530; }
@media (prefers-reduced-motion: reduce) { .scene .win, .scene .flag { animation: none; } }`;
