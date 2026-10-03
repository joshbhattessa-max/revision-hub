import { clearCookie, json } from '../_lib/auth.js';
import { KEY_COOKIE } from '../_lib/keys.js';

export async function onRequestPost({ env, data }) {
  if (data.session && data.session.token) await env.HUB_KV.delete('sess:' + data.session.token);
  const headers = new Headers({ 'content-type': 'application/json', 'cache-control': 'no-store' });
  headers.append('set-cookie', clearCookie());
  headers.append('set-cookie', `${KEY_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`);
  return new Response(JSON.stringify({ ok: true }), { headers });
}
