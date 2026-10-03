// Maintenance mode: while it's on, everyone except admins sees a "down for maintenance" page instead of the site.
// It's on when the admin console turns it on (KV key "maintenance") or when maintenance.json in the site says so
// (switched on by an update while it deploys).

let cache = { at: 0, state: null };

export async function maintenance(ctx, fresh = false) {
  if (!fresh && cache.state && Date.now() - cache.at < 15000) return cache.state;
  let kv = null, file = null;
  try { kv = await ctx.env.HUB_KV.get('maintenance', 'json'); } catch (e) { /* treat as off */ }
  try {
    const r = await ctx.env.ASSETS.fetch(new URL('/maintenance.json', ctx.request.url));
    if (r.ok) file = await r.json();
  } catch (e) { /* no file: off */ }
  const byAdmin = !!(kv && kv.on), byUpdate = !!(file && file.on);
  const state = {
    on: byAdmin || byUpdate, byAdmin, byUpdate,
    message: (byAdmin && kv.message) || (byUpdate && file.message) || '',
    since: (byAdmin && kv.since) || null,
  };
  cache = { at: Date.now(), state };
  return state;
}

export function forgetMaintenance() { cache = { at: 0, state: null }; }

const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// a gear outline centred on 0,0
function gear(teeth, outer, inner, hole) {
  const pts = [];
  for (let i = 0; i < teeth; i++) {
    const a = (i / teeth) * Math.PI * 2, step = Math.PI * 2 / teeth;
    for (const [da, r] of [[0, inner], [step * .18, outer], [step * .5, outer], [step * .68, inner]]) {
      pts.push(`${(Math.cos(a + da) * r).toFixed(2)},${(Math.sin(a + da) * r).toFixed(2)}`);
    }
  }
  return `<path d="M${pts.join('L')}Z M${hole},0 A${hole},${hole} 0 1 0 ${-hole},0 A${hole},${hole} 0 1 0 ${hole},0Z" fill-rule="evenodd"/>`;
}

// a sheet of paper writing itself, beside two turning gears
const ART = `<svg class="art" viewBox="0 0 220 130" aria-hidden="true">
<g class="sheet"><rect x="22" y="14" width="88" height="108" rx="7"/><path class="fold" d="M90 14v16h20"/>
<line class="w w1" x1="36" y1="44" x2="96" y2="44"/><line class="w w2" x1="36" y1="58" x2="88" y2="58"/>
<line class="w w3" x1="36" y1="72" x2="96" y2="72"/><line class="w w4" x1="36" y1="86" x2="78" y2="86"/>
<line class="w w5" x1="36" y1="100" x2="92" y2="100"/></g>
<g transform="translate(150 72)"><g class="g1">${gear(12, 34, 27, 9)}</g></g>
<g transform="translate(186 37)"><g class="g2">${gear(8, 21, 15.5, 6)}</g></g>
</svg>`;

export function maintenancePage(state) {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex"><meta name="color-scheme" content="light dark">
<title>Down for maintenance · Josh B Revision</title>
<script>try { var t = localStorage.getItem('hub-theme'); if (t) document.documentElement.setAttribute('data-theme', t); } catch (e) {}</script>
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<style>
:root { --bg: #f7f7f5; --card: #fff; --ink: #33312e; --muted: #6b6862; --line: #e4e2dd; }
:root[data-theme="dark"] { --bg: #17171a; --card: #222226; --ink: #ecebe8; --muted: #a3a09a; --line: #34343a; }
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) { --bg: #17171a; --card: #222226; --ink: #ecebe8; --muted: #a3a09a; --line: #34343a; }
}
* { box-sizing: border-box; }
body { margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 24px 16px; background: var(--bg); color: var(--ink);
  font-family: Inter, "Segoe UI", system-ui, -apple-system, Roboto, Helvetica, Arial, sans-serif; }
main { width: min(400px, 100%); background: var(--card); border: 1px solid var(--line); border-radius: 16px; padding: 26px 24px; }
.art { display: block; width: 100%; max-width: 230px; margin: 0 auto 18px; fill: var(--card); stroke: var(--ink); stroke-width: 2.4;
  stroke-linecap: round; stroke-linejoin: round; }
.art .w { stroke: var(--muted); stroke-width: 3; stroke-dasharray: 62; stroke-dashoffset: 62; animation: write 6s ease-in-out infinite; }
.art .w2 { animation-delay: .5s; } .art .w3 { animation-delay: 1s; } .art .w4 { animation-delay: 1.5s; } .art .w5 { animation-delay: 2s; }
.art .g1, .art .g2 { transform-box: fill-box; transform-origin: center; }
.art .g1 { animation: spin 9s linear infinite; }
.art .g2 { animation: spin 6s linear infinite reverse; }
@keyframes write { 0% { stroke-dashoffset: 62; } 22%, 75% { stroke-dashoffset: 0; opacity: 1; } 90%, 100% { stroke-dashoffset: 0; opacity: 0; } }
@keyframes spin { to { transform: rotate(360deg); } }
@media (prefers-reduced-motion: reduce) { .art .w { animation: none; stroke-dashoffset: 0; } .art .g1, .art .g2 { animation: none; } }
h1 { font-size: 1.3rem; line-height: 1.3; margin: 0 0 8px; letter-spacing: -.2px; }
p { color: var(--muted); line-height: 1.5; margin: 0 0 12px; font-size: .95rem; }
.note { color: var(--ink); background: var(--bg); border: 1px solid var(--line); border-radius: 10px; padding: 10px 12px; }
button { display: block; width: 100%; margin-top: 10px; font: inherit; font-weight: 600; background: var(--ink); color: var(--bg); border: 0;
  padding: 11px 14px; border-radius: 10px; cursor: pointer; }
button:hover { opacity: .9; }
.admin { display: block; text-align: center; margin-top: 12px; font-size: .85rem; color: var(--muted); }
.admin:hover { color: var(--ink); }
a:focus-visible, button:focus-visible { outline: 2px solid var(--ink); outline-offset: 2px; }
</style></head>
<body><main>
${ART}
<h1>Down for maintenance</h1>
<p>Josh B Revision is being updated with new questions and fixes. It'll be back in a few minutes, and this page will reload by itself when it is.</p>
${state.message ? `<p class="note">${esc(state.message)}</p>` : ''}
<button type="button" onclick="location.reload()">Try again</button>
<a class="admin" href="/login?admin=1">Admin sign-in</a>
</main>
<script>
setInterval(function () {
  fetch('/api/status', { cache: 'no-store' }).then(function (r) { return r.json(); })
    .then(function (s) { if (!s.maintenance) location.reload(); }).catch(function () {});
}, 30000);
</script>
</body></html>`;
}
