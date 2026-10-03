import { clearCookie, json } from '../_lib/auth.js';

export async function onRequestPost({ env, data }) {
  if (data.session) await env.HUB_KV.delete('sess:' + data.session.token);
  return json({ ok: true }, 200, { 'set-cookie': clearCookie() });
}
