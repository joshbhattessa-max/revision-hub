// Sign-in for the whole hub: accounts, 6-hour sessions and login throttling, kept in the HUB_KV namespace.
// Passwords are stored only as salted PBKDF2-SHA256 hashes. 10,000 rounds keeps a sign-in inside the free plan's
// 10 ms of CPU per request (100,000 rounds took several times that and the request was cut off).

export const SESSION_SECONDS = 6 * 60 * 60;
export const COOKIE = 'jbr_session';
const ITER = 10000;
const OLD_ITER = 100000; // accounts saved before the change; upgraded at their next sign-in

// first-run accounts (hashes only); the admin console changes them from then on
const SEED_ACCOUNTS = [
  {
    "id": "a1",
    "username": "JoshB",
    "role": "admin",
    "iter": 10000,
    "salt": "3w8ioH5mmq7v+wNwIVTSjw==",
    "hash": "WZnfkGl0vYPaBrYuHRUzi4as6rQ3mGgjQYsJU11UlZs="
  },
  {
    "id": "a2",
    "username": "JoshB",
    "role": "user",
    "iter": 10000,
    "salt": "PGh3X8/AzKmN8ST/zTQLWA==",
    "hash": "2f99LC/yKD4//y7ONH8ZvvEuTFsyxPIhL3obFsjEq+0="
  },
  {
    "id": "a3",
    "username": "test",
    "role": "user",
    "iter": 10000,
    "salt": "NN71CNIuOhDYdzR9Awq3NA==",
    "hash": "sUkt1QE/7fgSxaUzt4daRzsePS8TXaphVhpHM/lDNcU="
  }
];
// the first version's seed hashes (100,000 rounds), swapped for the ones above wherever they're still stored
const OLD_SEED_HASHES = ["5RvYjbXDpKsyhRiG4U/dawMxWeBobFoHAhlhcnGtUXU=", "o3ZCmg5N22kQMTBOfVr/bggo6ht279qKxtGpsddpufU=", "CCNKtAaf2NXz74oMtWm9MlTAxFmtUq2P34BYsucuUMg="];

const enc = new TextEncoder();
const b64 = buf => btoa(String.fromCharCode(...new Uint8Array(buf)));
const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));

export async function hashPassword(password, saltB64, iter = ITER) {
  const salt = saltB64 ? unb64(saltB64) : crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: iter }, key, 256);
  return { salt: b64(salt), hash: b64(bits), iter };
}

function sameBytes(a, b) {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

export function randomToken(bytes = 32) {
  return [...crypto.getRandomValues(new Uint8Array(bytes))].map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function getAccounts(env) {
  const list = await env.HUB_KV.get('accounts', 'json');
  if (list) {
    // replace first-version seed accounts nobody has changed yet with the lighter hashes
    let changed = false;
    list.forEach((a, i) => {
      const seed = SEED_ACCOUNTS.find(x => x.id === a.id);
      if (seed && OLD_SEED_HASHES.includes(a.hash)) { list[i] = { ...seed, username: a.username, role: a.role }; changed = true; }
    });
    if (changed) await saveAccounts(env, list);
    return list;
  }
  await env.HUB_KV.put('accounts', JSON.stringify(SEED_ACCOUNTS));
  return SEED_ACCOUNTS;
}

export const saveAccounts = (env, list) => env.HUB_KV.put('accounts', JSON.stringify(list));

export async function verifyPassword(account, password) {
  const { hash } = await hashPassword(String(password || ''), account.salt, account.iter || OLD_ITER);
  return sameBytes(hash, account.hash);
}

// the same username may have several accounts (JoshB has an admin and a standard one): the password picks
export async function checkLogin(env, username, password) {
  const name = String(username || '').trim().toLowerCase();
  const list = await getAccounts(env);
  for (const a of list) {
    if (a.username.toLowerCase() !== name || !await verifyPassword(a, password)) continue;
    if (a.iter !== ITER) { Object.assign(a, await hashPassword(String(password))); await saveAccounts(env, list); }
    return a;
  }
  return null;
}

export function readCookie(request, name) {
  const m = (request.headers.get('cookie') || '').match(new RegExp('(?:^|;\\s*)' + name + '=([^;]+)'));
  return m ? decodeURIComponent(m[1]) : null;
}

export const clearCookie = () => `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;

export function sessionCookie(token, maxAge) {
  return `${COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}

export async function createSession(env, account, request) {
  const token = randomToken();
  const now = Date.now();
  const info = {
    accountId: account.id, username: account.username, role: account.role,
    created: now, expires: now + SESSION_SECONDS * 1000,
    ip: request.headers.get('cf-connecting-ip') || '', country: (request.cf && request.cf.country) || '',
    device: (request.headers.get('user-agent') || '').slice(0, 160),
  };
  // the key expires with the session; the metadata lets the admin console list sessions without reading each one
  await env.HUB_KV.put('sess:' + token, JSON.stringify(info), { expiration: Math.floor(info.expires / 1000), metadata: info });
  return token;
}

export async function getSession(env, request) {
  const token = readCookie(request, COOKIE);
  if (!token || !/^[0-9a-f]{64}$/.test(token)) return null;
  const s = await env.HUB_KV.get('sess:' + token, 'json');
  if (!s || s.expires < Date.now()) return null;
  return { token, ...s };
}

export async function listSessions(env) {
  const out = [];
  let cursor;
  do {
    const page = await env.HUB_KV.list({ prefix: 'sess:', cursor });
    for (const k of page.keys) {
      const m = k.metadata || {};
      if (m.expires && m.expires > Date.now()) out.push({ token: k.name.slice(5), ...m });
    }
    cursor = page.list_complete ? null : page.cursor;
  } while (cursor);
  return out.sort((a, b) => b.created - a.created);
}

export async function endSessions(env, test) {
  let n = 0;
  for (const s of await listSessions(env)) {
    if (test(s)) { await env.HUB_KV.delete('sess:' + s.token); n++; }
  }
  return n;
}

// at most 10 wrong passwords per address every 15 minutes
export async function tooManyFailures(env, request) {
  const ip = request.headers.get('cf-connecting-ip') || 'unknown';
  const n = parseInt(await env.HUB_KV.get('fail:' + ip) || '0', 10);
  return n >= 10;
}

export async function noteFailure(env, request) {
  const ip = request.headers.get('cf-connecting-ip') || 'unknown';
  const n = parseInt(await env.HUB_KV.get('fail:' + ip) || '0', 10) + 1;
  await env.HUB_KV.put('fail:' + ip, String(n), { expirationTtl: 900 });
}

export const json = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store', ...headers } });

// hub content: the admin console's saved copy, else the hub.json that ships with the site
export async function hubContent(ctx) {
  const saved = ctx.env.HUB_KV && await ctx.env.HUB_KV.get('hub', 'json');
  if (saved) return saved;
  const res = await ctx.env.ASSETS.fetch(new URL('/hub.json', ctx.request.url));
  return res.json();
}
