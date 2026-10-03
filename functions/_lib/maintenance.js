// Maintenance mode: while it's on, everyone except admins sees a "down for maintenance" page instead of the site.
// It's on when the admin console turns it on (KV key "maintenance") or when maintenance.json in the site says so
// (switched on by an update while it deploys).

import { SCENE, SCENE_CSS } from './scene.js';
import { ICON_LINKS } from './icons.js';

let cache = { at: 0, state: null };

export async function maintenance(ctx, fresh = false) {
  if (!fresh && cache.state && Date.now() - cache.at < 15000) return cache.state;
  let kv = null, file = null;
  try { kv = await ctx.env.HUB_KV.get('maintenance', 'json'); } catch (e) { /* treat as off */ }
  try {
    const r = await ctx.env.ASSETS.fetch(new URL('/maintenance.json', ctx.request.url));
    if (r.ok) file = await r.json();
  } catch (e) { /* no file: off */ }
  // a countdown ends maintenance by itself the moment it reaches 0, whether an admin set it or a release did
  const now = Date.now();
  const byAdmin = !!(kv && kv.on && !(kv.until && kv.until <= now));
  const byUpdate = !!(file && file.on && !(file.until && file.until <= now));
  const state = {
    on: byAdmin || byUpdate, byAdmin, byUpdate,
    message: (byAdmin && kv.message) || (byUpdate && file.message) || '',
    since: (byAdmin && kv.since) || null,
    // earliest the site comes back (ms since 1970); shown as a countdown on the maintenance page
    until: Math.max(Number(byAdmin && kv.until) || 0, Number(byUpdate && file.until) || 0) || null,
  };
  // never keep a cached "on" past the moment a countdown ends
  const ends = [byAdmin && kv.until, byUpdate && file.until].filter(Boolean).map(Number);
  const soonest = ends.length ? Math.min(...ends) : Infinity;
  cache = { at: now - Math.max(0, 15000 - (soonest - now)), state };
  return state;
}

export function forgetMaintenance() { cache = { at: 0, state: null }; }

const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function maintenancePage(state) {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex"><meta name="color-scheme" content="light dark">
<title>Down for maintenance · Josh B Revision</title>
<script>try { var t = localStorage.getItem('hub-theme'); if (t) document.documentElement.setAttribute('data-theme', t); } catch (e) {}</script>
${ICON_LINKS}
<style>
:root { --bg: #f7f7f5; --card: #fff; --ink: #33312e; --muted: #6b6862; --line: #e4e2dd; }
:root[data-theme="dark"] { --bg: #17171a; --card: #222226; --ink: #ecebe8; --muted: #a3a09a; --line: #34343a; }
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) { --bg: #17171a; --card: #222226; --ink: #ecebe8; --muted: #a3a09a; --line: #34343a; }
}
* { box-sizing: border-box; }
body { margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 24px 16px; background: var(--bg); color: var(--ink);
  font-family: Inter, "Segoe UI", system-ui, -apple-system, Roboto, Helvetica, Arial, sans-serif; }
main { width: min(440px, 100%); background: var(--card); border: 1px solid var(--line); border-radius: 16px; padding: 26px 24px; }
${SCENE_CSS}
h1 { font-size: 1.3rem; line-height: 1.3; margin: 0 0 8px; letter-spacing: -.2px; }
p { color: var(--muted); line-height: 1.5; margin: 0 0 12px; font-size: .95rem; }
.note { color: var(--ink); background: var(--bg); border: 1px solid var(--line); border-radius: 10px; padding: 10px 12px; }
button { display: block; width: 100%; margin-top: 10px; font: inherit; font-weight: 600; background: var(--ink); color: var(--bg); border: 0;
  padding: 11px 14px; border-radius: 10px; cursor: pointer; }
button:hover { opacity: .9; }
.admin { display: block; text-align: center; margin-top: 12px; font-size: .85rem; color: var(--muted); }
.admin:hover { color: var(--ink); }
.clock { position: fixed; top: 14px; right: 14px; display: flex; align-items: center; gap: 8px; background: var(--card); border: 1px solid var(--line);
  border-radius: 999px; padding: 6px 12px 6px 10px; font-size: .85rem; color: var(--muted); font-variant-numeric: tabular-nums; }
.clock b { color: var(--ink); font-weight: 600; }
.clock svg { width: 16px; height: 16px; fill: none; stroke: var(--ink); stroke-width: 2; stroke-linecap: round; }
.clock .hand { transform-origin: 8px 8px; animation: hand 4s linear infinite; }
@keyframes hand { to { transform: rotate(360deg); } }
@media (prefers-reduced-motion: reduce) { .clock .hand { animation: none; } }
a:focus-visible, button:focus-visible { outline: 2px solid var(--ink); outline-offset: 2px; }
</style></head>
<body>
${state.until ? `<div class="clock" role="timer" aria-live="off"><svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6.5"/><path class="hand" d="M8 8V4"/></svg><span class="clock-text">Back in about <b>--:--</b></span></div>` : ''}
<main>
${SCENE}
<h1>Down for maintenance</h1>
<p>Josh B Revision is being updated with new questions and fixes. It'll be back in a few minutes, and this page will reload by itself when it is.</p>
${state.message ? `<p class="note">${esc(state.message)}</p>` : ''}
<button type="button" onclick="location.reload()">Try again</button>
<a class="admin" href="/login?admin=1">Admin sign-in</a>
</main>
<script>
var until = ${state.until ? `Date.now() + ${Math.max(0, Number(state.until) - Date.now())}` : 'null'};  // server time, so a wrong device clock doesn't matter
function tick() {
  var el = document.querySelector('.clock-text');
  if (!el || !until) return;
  var left = Math.round((until - Date.now()) / 1000);
  if (left <= 0) { el.innerHTML = '<b>Back now…</b>'; if (!window.soon) { check(); window.soon = setInterval(check, 1000); } return; }
  el.innerHTML = 'Back in about <b>' + Math.floor(left / 60) + ':' + String(left % 60).padStart(2, '0') + '</b>';
}
tick(); setInterval(tick, 1000);
if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) { var sc = document.querySelector('.scene'); if (sc && sc.pauseAnimations) sc.pauseAnimations(); }
function check() {
  fetch('/api/status', { cache: 'no-store' }).then(function (r) { return r.json(); })
    .then(function (s) { if (!s.maintenance) location.reload(); }).catch(function () {});
}
setInterval(check, 30000);
</script>
</body></html>`;
}
