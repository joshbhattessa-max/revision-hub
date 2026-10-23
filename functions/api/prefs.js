// The signed-in person's settings, kept with their account so they follow them to every device and subject site.
//   GET /api/prefs   {theme, look, csLang, t}
//   PUT /api/prefs   any of {theme, look, csLang}: saves those, leaves the rest
// look.js (on every page of the hub and the subject sites) copies them into the browser's own keys (hub-theme,
// jbr-look, jbr-cs-lang) and saves a change made with the light/dark or look button; Settings (/settings) edits them all.
import { json } from '../_lib/auth.js';

const OK = {
  theme: ['light', 'dark', 'device'],
  look: ['soft', 'bold'],
  csLang: ['cs', 'py', 'vb', 'java'],
};
const key = s => 'prefs:' + s.accountId;

export async function onRequestGet(ctx) {
  const s = ctx.data.session;
  if (!s.accountId) return json({});
  return json((await ctx.env.HUB_KV.get(key(s), 'json')) || {});
}

export async function onRequestPut(ctx) {
  const s = ctx.data.session;
  if (!s.accountId) return json({ error: 'Sign in with your username and password to save settings.' }, 403);
  const body = await ctx.request.json().catch(() => ({}));
  const prefs = (await ctx.env.HUB_KV.get(key(s), 'json')) || {};
  let changed = false;
  for (const [k, allowed] of Object.entries(OK)) {
    if (body[k] === undefined) continue;
    if (!allowed.includes(body[k])) return json({ error: 'Unknown ' + k + '.' }, 400);
    if (prefs[k] !== body[k]) { prefs[k] = body[k]; changed = true; }
  }
  if (changed) { prefs.t = Date.now(); await ctx.env.HUB_KV.put(key(s), JSON.stringify(prefs)); }
  return json(prefs);
}
