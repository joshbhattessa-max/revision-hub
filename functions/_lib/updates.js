// Update notes (Admin → updates): a short note, one or two bullet points, about each update to the site, sent to the
// accounts on the update list. It shows in the same popup as the admin's messages (note.js). Someone who hasn't read
// the earlier ones yet gets them all together: the newest at the top, then the older ones under their dates.
// KV: updates:subs = [account ids on the list]
//     updates:log  = [{t, by, bullets, sent, skipped}] the notes sent, oldest first (the last 100)
//     upd:<accountId> = {items: [{t, bullets}] oldest first, seen}  what that account has been sent; once it's read
//                       (seen is set), the next note starts the list again
import { details, load as loadDeploys } from './deploylog.js';
import { getAccounts, listSessions } from './auth.js';

export const MAX_BULLETS = 2, MAX_LEN = 240;
const MAX_LOG = 100, MAX_UNREAD = 20;

export const getSubs = async env => (await env.HUB_KV.get('updates:subs', 'json')) || [];
export const getLog = async env => (await env.HUB_KV.get('updates:log', 'json')) || [];

export async function saveSubs(env, ids) {
  const known = new Set((await getAccounts(env)).map(a => a.id));
  const subs = [...new Set((Array.isArray(ids) ? ids : []).map(String))].filter(id => known.has(id));
  await env.HUB_KV.put('updates:subs', JSON.stringify(subs));
  return subs;
}

// the bullet points as typed: trimmed, without a leading "-" or "•", empty lines dropped
export function cleanBullets(list) {
  return (Array.isArray(list) ? list : []).map(b => String(b || '').replace(/^\s*[-*•]\s*/, '').replace(/\s+/g, ' ').trim().slice(0, MAX_LEN)).filter(Boolean);
}

// sends one note to everyone on the list (banned accounts are skipped); returns [body, status] for json()
export async function sendUpdate(env, body, by) {
  const bullets = cleanBullets(body && body.bullets);
  if (!bullets.length) return [{ error: 'Write one or two bullet points.' }, 400];
  if (bullets.length > MAX_BULLETS) return [{ error: 'Keep it to ' + MAX_BULLETS + ' bullet points.' }, 400];
  const subs = new Set(await getSubs(env));
  const accounts = (await getAccounts(env)).filter(a => subs.has(a.id));
  const to = accounts.filter(a => !a.banned);
  if (!to.length) return [{ error: 'Nobody on the update list can get it (add accounts first).' }, 400];
  const t = Date.now(), item = { t, bullets };
  for (const a of to) {
    const old = await env.HUB_KV.get('upd:' + a.id, 'json');
    // unread notes are kept and the new one goes after them; once they've been read, the list starts again
    const items = old && !old.seen ? [...(old.items || []), item].slice(-MAX_UNREAD) : [item];
    await env.HUB_KV.put('upd:' + a.id, JSON.stringify({ items }), { metadata: { t, n: items.length } });
  }
  // their sessions show it on the next page (like setNoteFlag, with one pass over the sessions for everyone)
  const ids = new Set(to.map(a => a.id));
  for (const s of await listSessions(env)) {
    if (!ids.has(s.accountId) || s.note) continue;
    const { token, ...info } = s;
    info.note = true;
    await env.HUB_KV.put('sess:' + token, JSON.stringify(info), { expiration: Math.floor(info.expires / 1000), metadata: info });
  }
  const log = await getLog(env);
  log.push({ t, by: by || '', bullets, sent: to.length, skipped: accounts.length - to.length });
  await env.HUB_KV.put('updates:log', JSON.stringify(log.slice(-MAX_LOG)));
  return [{ ok: true, sent: to.length, skipped: accounts.length - to.length, t }];
}

// what each account has been sent: {id: {t, n, seen}} from the keys' metadata only
export async function listUpd(env) {
  const out = {};
  let cursor;
  do {
    const page = await env.HUB_KV.list({ prefix: 'upd:', cursor });
    for (const k of page.keys) out[k.name.slice(4)] = k.metadata || {};
    cursor = page.list_complete ? null : page.cursor;
  } while (cursor);
  return out;
}

// for the account itself (GET /api/note): its unread notes, newest first, or []
export async function unread(env, accountId) {
  const u = await env.HUB_KV.get('upd:' + accountId, 'json');
  return u && !u.seen && u.items ? [...u.items].reverse() : [];
}
export async function markRead(env, accountId) {
  const u = await env.HUB_KV.get('upd:' + accountId, 'json');
  if (!u || u.seen) return;
  u.seen = Date.now();
  const last = u.items && u.items.length ? u.items[u.items.length - 1].t : 0;
  await env.HUB_KV.put('upd:' + accountId, JSON.stringify(u), { metadata: { t: last, n: (u.items || []).length, seen: u.seen } });
}
// an account was deleted
export async function forgetUpd(env, accountId) {
  await env.HUB_KV.delete('upd:' + accountId);
  const subs = await getSubs(env);
  if (subs.includes(accountId)) await env.HUB_KV.put('updates:subs', JSON.stringify(subs.filter(id => id !== accountId)));
}

// the deployments since the last note was sent (the last 10 if none has been), each with what went out: the pull
// requests' titles, or the commits' first lines. The console offers them as a starting point for the bullets.
export async function sinceLast(env) {
  const log = await getLog(env), last = log.length ? log[log.length - 1].t : 0;
  const all = (await loadDeploys(env)).entries.filter(e => e.ok);
  const list = (last ? all.filter(e => e.at > last) : all.slice(-10)).slice(-25).reverse();
  const out = [];
  for (const e of list) {
    const d = await details(env, e.id);
    const cs = (d && d.c) || [], prs = cs.filter(c => /^Merge pull request #\d+/.test(c.s));
    // with pull requests, their titles say it better than the commits inside them
    const titles = (prs.length ? prs.map(c => (c.b || '').split('\n')[0].trim()) : cs.map(c => c.s))
      .filter(s => s && !/^Merge (branch|remote-tracking)/.test(s) && !/^Release( \d{8}-\d{6})?(:|$)/.test(s));
    out.push({ id: e.id, at: e.at, site: e.site, titles: [...new Set(titles)].slice(-8) });
  }
  return { last, deploys: out };
}
