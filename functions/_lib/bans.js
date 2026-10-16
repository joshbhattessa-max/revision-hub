// Banned accounts (Admin → Accounts → Ban). A banned account is signed out everywhere and can't sign in again. If the
// person behind it tries to make a new account (recognised by the email address, or by this browser having been used
// with the banned account), the sign-up is refused and their internet address can't make new accounts for 30 days.
// Everyone else there, even on that same device, can still sign in to their own accounts and use the site as normal.
//
// Kept in HUB_KV as one value, 'bans':
//   { accounts: { [accountId]: { t, username, email, devs: [device ids], tries: [{t, ip, what}] } },
//     ips: { [ip]: { t, until, acct } } }
// Device ids come from the jbr_dev cookie: a random number this site gives each browser, nothing else.
import { randomToken, readCookie } from './auth.js';

export const DEV_COOKIE = 'jbr_dev';
const DEV_SECONDS = 2 * 365 * 86400;
export const IP_DAYS = 30;
const MAX_DEVS = 40, MAX_TRIES = 30;

export const getBans = async env => (await env.HUB_KV.get('bans', 'json')) || { accounts: {}, ips: {} };
export const saveBans = (env, b) => env.HUB_KV.put('bans', JSON.stringify(b));

// this browser's device id, or null if it hasn't been given one yet
export function deviceOf(request) {
  const d = readCookie(request, DEV_COOKIE);
  return d && /^[0-9a-f]{32}$/.test(d) ? d : null;
}
export const newDevice = () => randomToken(16);
export const deviceCookie = id => `${DEV_COOKIE}=${id}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${DEV_SECONDS}`;

const ipOf = request => request.headers.get('cf-connecting-ip') || '';
const add = (list, v, max) => { if (v && !list.includes(v)) list.push(v); if (list.length > max) list.splice(0, list.length - max); };

// ban: remember the account's email address and the browsers it was signed in on (its sessions are ended by the caller)
export async function ban(env, account, sessions) {
  const b = await getBans(env);
  const rec = b.accounts[account.id] || { devs: [], tries: [] };
  Object.assign(rec, { t: Date.now(), username: account.username, email: account.email || '' });
  for (const s of sessions) add(rec.devs, s.dev, MAX_DEVS);
  b.accounts[account.id] = rec;
  await saveBans(env, b);
}

// unban: forget the account's ban, and lift the internet-address blocks its attempts caused
export async function unban(env, accountId) {
  const b = await getBans(env);
  if (!b.accounts[accountId]) return false;
  delete b.accounts[accountId];
  for (const [ip, x] of Object.entries(b.ips)) if (x.acct === accountId) delete b.ips[ip];
  await saveBans(env, b);
  return true;
}

export async function liftIp(env, ip) {
  const b = await getBans(env);
  delete b.ips[ip];
  await saveBans(env, b);
}

// the banned account this email address or browser belongs to, if any
export function bannedBy(b, { email, dev }) {
  const e = String(email || '').toLowerCase();
  for (const [id, r] of Object.entries(b.accounts)) {
    if (e && r.email && r.email.toLowerCase() === e) return id;
    if (dev && r.devs.includes(dev)) return id;
  }
  return null;
}

export function ipBlocked(b, request) {
  const x = b.ips[ipOf(request)];
  return !!(x && x.until > Date.now());
}

// a banned person tried again: note it for the console, remember this browser, and (for a new account) block new
// accounts from their internet address for IP_DAYS
export async function noteTry(env, b, accountId, request, dev, what) {
  const r = b.accounts[accountId];
  if (!r) return;
  const ip = ipOf(request), now = Date.now();
  add(r.devs, dev, MAX_DEVS);
  r.tries.push({ t: now, ip, what });
  if (r.tries.length > MAX_TRIES) r.tries.splice(0, r.tries.length - MAX_TRIES);
  if (what === 'signup' && ip) b.ips[ip] = { t: now, until: now + IP_DAYS * 86400000, acct: accountId };
  for (const [k, x] of Object.entries(b.ips)) if (x.until <= now) delete b.ips[k];
  await saveBans(env, b);
}

// sessions from before device ids (or a browser that lost its cookie) get one on their next request, once, so a ban
// still knows the browsers that account was signed in on. Returns the cookie to set, if the browser needs a new one.
export async function tagSession(env, request, session) {
  if (session.viaKey || session.dev) return null;
  const had = deviceOf(request), dev = had || newDevice();
  const { token, ...info } = session;
  info.dev = dev;
  await env.HUB_KV.put('sess:' + token, JSON.stringify(info), { expiration: Math.floor(info.expires / 1000), metadata: info });
  return had ? null : deviceCookie(dev);
}
