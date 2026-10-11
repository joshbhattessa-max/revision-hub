// Sign-in for the whole hub: accounts, 6-hour sessions and login throttling, kept in the HUB_KV namespace.
// Passwords are stored only as salted PBKDF2-SHA256 hashes. 10,000 rounds keeps a sign-in inside the free plan's
// 10 ms of CPU per request (100,000 rounds took several times that and the request was cut off).

export const SESSION_SECONDS = 6 * 60 * 60;
export const COOKIE = 'jbr_session';
const ITER = 10000;
const OLD_ITER = 100000; // accounts saved before the change; upgraded at their next sign-in

// the first accounts (hashes only). Their passwords were published in the README, so while an account still has
// one of these hashes it can't sign in (see checkLogin); a new deployment starts with the admin one only.
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
  const first = SEED_ACCOUNTS.filter(a => a.role === 'admin');
  await env.HUB_KV.put('accounts', JSON.stringify(first));
  return first;
}

export const saveAccounts = (env, list) => env.HUB_KV.put('accounts', JSON.stringify(list));

// All accounts are one KV value, so two changes at the same moment (a class signing up together) could each save a
// list without the other's change. This applies a change, waits for anyone else's save to land, and checks the change
// is still there, applying it again if not. done(list) says whether the change is in a list.
export async function changeAccounts(env, change, done, tries = 6) {
  for (let i = 0; i < tries; i++) {
    const list = await getAccounts(env);
    if (!done(list)) {
      const r = await change(list);
      if (r && r.stop) return r;
      await saveAccounts(env, list);
    }
    await new Promise(ok => setTimeout(ok, 700 + Math.random() * 600));
    if (done(await getAccounts(env))) return { ok: true };
  }
  return { ok: false };
}

const startingPassword = a => SEED_ACCOUNTS.some(s => s.id === a.id && s.hash === a.hash);

export async function verifyPassword(account, password) {
  const { hash } = await hashPassword(String(password || ''), account.salt, account.iter || OLD_ITER);
  return sameBytes(hash, account.hash);
}

// the same username may have several accounts (JoshB has an admin and a standard one): the password picks
export async function checkLogin(env, username, password) {
  const name = String(username || '').trim().toLowerCase();
  const list = await getAccounts(env);
  for (const a of list) {
    if (a.username.toLowerCase() !== name) continue;
    if (startingPassword(a)) {
      // a published starting password never signs in; for the admin, the ADMIN_PASSWORD secret replaces it once
      const set = String(env.ADMIN_PASSWORD || '');
      if (a.role !== 'admin' || set.length < 8 || !sameBytes(String(password || ''), set)) continue;
      Object.assign(a, await hashPassword(set)); await saveAccounts(env, list);
      return a;
    }
    if (!await verifyPassword(a, password)) continue;
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
    // a new account that hasn't checked its email address yet can only reach the "check your email" page
    ...(account.mustVerify ? { mustVerify: true } : {}),
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

// once an account has checked its email address, its sessions (on every device) can use the whole site
export async function clearVerifyFlag(env, accountId) {
  for (const s of await listSessions(env)) {
    if (s.accountId !== accountId || !s.mustVerify) continue;
    const { token, mustVerify, ...info } = s;
    await env.HUB_KV.put('sess:' + token, JSON.stringify(info), { expiration: Math.floor(info.expires / 1000), metadata: info });
  }
}

export async function endSessions(env, test) {
  let n = 0;
  for (const s of await listSessions(env)) {
    if (test(s)) { await env.HUB_KV.delete('sess:' + s.token); n++; }
  }
  return n;
}

// Every 15 minutes, at most 10 wrong attempts at one account (who: its username, id or email) from one address,
// and 60 at any accounts from one address. A school shares one address, so one pupil's typos can't lock out the class.
const PER_ACCOUNT = 10, PER_ADDRESS = 60;
const failKeys = (request, who) => {
  const ip = request.headers.get('cf-connecting-ip') || 'unknown';
  return ['fail:' + ip, 'fail:' + ip + '|' + String(who || '').trim().toLowerCase().slice(0, 100)];
};

export async function tooManyFailures(env, request, who) {
  const [all, one] = failKeys(request, who);
  const [a, o] = await Promise.all([all, one].map(k => env.HUB_KV.get(k)));
  return parseInt(a || '0', 10) >= PER_ADDRESS || parseInt(o || '0', 10) >= PER_ACCOUNT;
}

export async function noteFailure(env, request, who) {
  for (const k of failKeys(request, who)) {
    const n = parseInt(await env.HUB_KV.get(k) || '0', 10) + 1;
    // KV takes one write a second per key, so a burst of wrong passwords mustn't turn into an error page
    await env.HUB_KV.put(k, String(n), { expirationTtl: 900 }).catch(() => {});
  }
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
