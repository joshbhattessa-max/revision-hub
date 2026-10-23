// Update notes (Admin → updates): a short note, one or two bullet points, about each update to the site, sent to the
// accounts on the update list. It shows in the same popup as the admin's messages (note.js). Someone who hasn't read
// the earlier ones yet gets them all together: the newest at the top, then the older ones under their dates.
// KV: updates:subs = [account ids on the list]
//     updates:log  = [{t, by, bullets, sent, skipped}] the notes sent, oldest first (the last 100)
//     upd:<accountId> = {items: [{t, bullets}] oldest first, seen}  what that account has been sent; once it's read
//                       (seen is set), the next note starts the list again
//     updates:auto = {off, since, ran}  writing and sending them by itself (on unless switched off): see autoUpdate()
import { details, load as loadDeploys, maybeSync } from './deploylog.js';
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
  return { last, deploys: await withTitles(env, list) };
}
async function withTitles(env, list) {
  const out = [];
  for (const e of list) {
    const d = await details(env, e.id);
    const cs = (d && d.c) || [], prs = cs.filter(c => /^Merge pull request #\d+/.test(c.s));
    // with pull requests, their titles say it better than the commits inside them
    const titles = (prs.length ? prs.map(c => (c.b || '').split('\n')[0].trim()) : cs.map(c => c.s))
      .filter(s => s && !/^Merge (branch|remote-tracking)/.test(s) && !/^Release( \d{8}-\d{6})?(:|$)/.test(s));
    out.push({ id: e.id, at: e.at, site: e.site, titles: [...new Set(titles)].slice(-8) });
  }
  return out;
}

// ---------------------------------------------------------------- written by itself
// After each update (a burst of deployments, once nothing new has gone live for QUIET), the note is written from the
// pull requests' titles and sent to the list. Changes only the admin sees (the console, the deploy log, tests...) are
// left out, and a deployment with nothing left says nothing. The first check only marks where to start from, so the
// updates from before it was switched on aren't sent.
const QUIET = 15 * 60 * 1000, EVERY = 10 * 60 * 1000;
const INTERNAL = /\b(admin|console|deploy ?log|deployments?|readme|claude\.md|refactor|tests?|lint|ci|workflow|bump|typo|takedown|maintenance)\b/i;

export const getAuto = async env => (await env.HUB_KV.get('updates:auto', 'json')) || {};
export async function setAuto(env, on) {
  const a = await getAuto(env);
  // switched back on: starts from now, so what went live while it was off isn't sent late
  const next = on ? { since: a.off || !a.since ? Date.now() : a.since, ran: a.ran || 0 } : { ...a, off: true };
  await env.HUB_KV.put('updates:auto', JSON.stringify(next));
  return next;
}

// "Chemistry", "Main site"... from the deploy log's site name ("ChemQ (Chemistry)")
const place = site => { const m = /\(([^)]+)\)/.exec(site || ''); return m ? m[1] : site || ''; };
function tidy(t) {
  t = String(t).replace(/\s*\((?:[A-Z][a-z]*Q|hub)\)$/, '').replace(/^(\w+(?:-\w+)?):\s+/, (m, w) => /^(feat|fix|chore|docs|style)$/i.test(w) ? '' : m)
    .replace(/[.\s]+$/, '').trim();
  return t.charAt(0).toUpperCase() + t.slice(1);
}
function places(list) {
  if (list.length >= 7) return 'Every subject';
  return list.length > 1 ? list.slice(0, -1).join(', ') + ' and ' + list[list.length - 1] : list[0];
}
// one or two bullet points from the deployments (newest first): the same change on several sites is one point
export function writeBullets(deploys) {
  const byTitle = new Map();
  for (const d of [...deploys].reverse()) {
    for (const raw of d.titles) {
      const t = tidy(raw);
      if (!t || INTERNAL.test(t)) continue;
      const k = t.toLowerCase();
      if (!byTitle.has(k)) byTitle.set(k, { t, sites: [] });
      const p = place(d.site), x = byTitle.get(k);
      if (!x.sites.includes(p)) x.sites.push(p);
    }
  }
  // the change that reached the most sites first, then the newest
  const items = [...byTitle.values()].reverse().sort((a, b) => b.sites.length - a.sites.length);
  const line = x => (x.sites.length === 1 && x.sites[0] === 'Main site' ? '' : places(x.sites.filter(s => s !== 'Main site').length ? x.sites.filter(s => s !== 'Main site') : x.sites) + ': ') + x.t;
  const out = items.slice(0, MAX_BULLETS).map(x => line(x).slice(0, MAX_LEN));
  const rest = items.length - out.length;
  if (rest > 0) out[out.length - 1] = (out[out.length - 1] + ` (and ${rest} smaller ${rest === 1 ? 'change' : 'changes'})`).slice(0, MAX_LEN);
  return out;
}

// called in the background by the middleware (at most every 10 minutes per server): checks for new deployments and,
// once an update has settled, writes the note and sends it
export async function autoUpdate(ctx) {
  const env = ctx.env, now = Date.now();
  const a = await getAuto(env);
  if (a.off || now - (a.ran || 0) < EVERY) return null;
  await env.HUB_KV.put('updates:auto', JSON.stringify({ ...a, ran: now }));  // claims this round
  if (!a.since) { await env.HUB_KV.put('updates:auto', JSON.stringify({ since: now, ran: now })); return null; }
  await maybeSync(ctx, 20000);
  const log = await getLog(env), from = Math.max(a.since, log.length ? log[log.length - 1].t : 0);
  const fresh = (await loadDeploys(env)).entries.filter(e => e.ok && e.at > from);
  if (!fresh.length || now - Math.max(...fresh.map(e => e.at)) < QUIET) return null;
  const bullets = writeBullets(await withTitles(env, [...fresh].reverse()));
  let sent = null;
  if (bullets.length && (await getSubs(env)).length) [sent] = await sendUpdate(env, { bullets }, 'auto');
  // nothing worth telling anyone (or nobody on the list): those deployments are passed over all the same
  await env.HUB_KV.put('updates:auto', JSON.stringify({ since: Math.max(...fresh.map(e => e.at)), ran: now }));
  return { bullets, sent };
}
