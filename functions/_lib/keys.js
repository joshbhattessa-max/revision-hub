// Access keys for agents (e.g. a Claude agent): a key works like a standard, non-admin sign-in.
//   ?key=<key> on any address   or   Authorization: Bearer <key>
// Only a SHA-256 hash of each key is stored. A key used in a link also sets a 6-hour cookie so a browsing agent
// can move around the site; that cookie is signed (no store write per visit) and stops working when the key is revoked.
import { SESSION_SECONDS } from './auth.js';

const enc = new TextEncoder();
const hex = buf => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
export const sha256 = async s => hex(await crypto.subtle.digest('SHA-256', enc.encode(s)));
export const KEY_COOKIE = 'jbr_key';

export const getKeys = async env => (await env.HUB_KV.get('keys', 'json')) || [];
export const saveKeys = (env, list) => env.HUB_KV.put('keys', JSON.stringify(list));

export function newKey() {
  return 'jbr_' + hex(crypto.getRandomValues(new Uint8Array(20)));
}

function keyFromRequest(request, url) {
  const auth = request.headers.get('authorization') || '';
  const m = auth.match(/^Bearer\s+(jbr_[0-9a-f]{40})$/);
  if (m) return m[1];
  const q = url.searchParams.get('key');
  return q && /^jbr_[0-9a-f]{40}$/.test(q) ? q : null;
}

async function hmac(env, data) {
  const key = await crypto.subtle.importKey('raw', enc.encode(env.HUB_SECRET || 'jbr-key-cookie'), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return hex(await crypto.subtle.sign('HMAC', key, enc.encode(data)));
}

function readCookie(request, name) {
  const m = (request.headers.get('cookie') || '').match(new RegExp('(?:^|;\\s*)' + name + '=([^;]+)'));
  return m ? decodeURIComponent(m[1]) : null;
}

const asSession = (k, expires) => ({ token: null, accountId: 'key:' + k.id, username: k.label, role: 'user', expires, viaKey: true });

// returns { session, setCookie } when the request carries a valid key (or a key cookie), else null
export async function keySession(env, request, url) {
  const raw = keyFromRequest(request, url);
  if (raw) {
    const list = await getKeys(env);
    const h = await sha256(raw);
    const k = list.find(x => x.hash === h);
    if (!k) return null;
    // note when it was last used (at most once an hour, to spare the store's daily write limit)
    if (!k.lastUsed || Date.now() - k.lastUsed > 3600e3) { k.lastUsed = Date.now(); await saveKeys(env, list); }
    const expires = Date.now() + SESSION_SECONDS * 1000;
    const payload = `${k.id}.${expires}`;
    const cookie = `${KEY_COOKIE}=${payload}.${await hmac(env, payload)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_SECONDS}`;
    return { session: asSession(k, expires), setCookie: cookie };
  }
  const c = readCookie(request, KEY_COOKIE);
  const m = c && c.match(/^([\w-]+)\.(\d+)\.([0-9a-f]{64})$/);
  if (!m || Number(m[2]) < Date.now() || m[3] !== await hmac(env, `${m[1]}.${m[2]}`)) return null;
  const k = (await getKeys(env)).find(x => x.id === m[1]);
  return k ? { session: asSession(k, Number(m[2])), setCookie: null } : null;
}
