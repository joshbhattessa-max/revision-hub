// Takedown mode: while it's on, everyone except a signed-in admin gets a plain "This site has been taken down" page
// for every address on the site (pages, subject sites, API). It has no name, logo, icon or colours, and it stays on
// until an admin turns it off in the admin console (KV key "takedown"): no countdown, and an update never ends it.
// The "w" in "down" is a hidden link: clicking it shows a sign-in form that only lets admin accounts in.

let cache = { at: 0, on: false };

export async function takedown(env, fresh = false) {
  if (!fresh && cache.at && Date.now() - cache.at < 15000) return cache.on;
  let on = false;
  try { const v = await env.HUB_KV.get('takedown', 'json'); on = !!(v && v.on); } catch (e) { /* treat as off */ }
  cache = { at: Date.now(), on };
  return on;
}

export function forgetTakedown() { cache = { at: 0, on: false }; }

export async function takedownState(env) {
  let v = null;
  try { v = await env.HUB_KV.get('takedown', 'json'); } catch (e) { /* off */ }
  return { on: !!(v && v.on), since: (v && v.on && v.since) || null };
}

export const TAKEDOWN_PAGE = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex, nofollow"><meta name="referrer" content="no-referrer">
<link rel="icon" href="data:,">
<title>Site taken down</title>
<style>
body { margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 24px 16px; box-sizing: border-box;
  background: #fff; color: #222; font: 17px/1.5 Arial, Helvetica, sans-serif; }
p { margin: 0; text-align: center; }
#k { cursor: text; }
form { display: grid; gap: 8px; width: min(260px, 100%); margin: 28px auto 0; }
form[hidden] { display: none; }
input, button { font: inherit; font-size: 15px; padding: 7px 9px; border: 1px solid #bbb; border-radius: 3px; background: #fff; color: #222; }
button { cursor: pointer; background: #f2f2f2; }
#e { min-height: 1.4em; font-size: 14px; color: #a00; text-align: center; }
</style></head>
<body><main>
<p>This site has been taken do<span id="k">w</span>n.</p>
<form id="f" hidden autocomplete="on">
<input name="username" autocomplete="username" placeholder="Username" aria-label="Username" required>
<input name="password" type="password" autocomplete="current-password" placeholder="Password" aria-label="Password" required>
<button type="submit">Sign in</button>
<div id="e" role="status"></div>
</form>
</main>
<script>
var f = document.getElementById('f');
document.getElementById('k').addEventListener('click', function () { f.hidden = false; f.username.focus(); });
f.addEventListener('submit', function (ev) {
  ev.preventDefault();
  var e = document.getElementById('e'); e.textContent = '';
  fetch('/api/login', { method: 'POST', headers: { 'content-type': 'application/json' }, credentials: 'same-origin',
    body: JSON.stringify({ username: f.username.value, password: f.password.value }) })
    .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
    .then(function (x) { if (x.ok) location.reload(); else e.textContent = x.j.error || 'No.'; })
    .catch(function () { e.textContent = 'Try again.'; });
});
</script>
</body></html>`;
