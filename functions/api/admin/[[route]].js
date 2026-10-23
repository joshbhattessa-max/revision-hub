// Admin console API (admin accounts only; the middleware checks the role).
//   GET    /api/admin/sessions               who is signed in
//   POST   /api/admin/sessions/end           {id} | {accountId} | {everyoneElse: true}
//   GET    /api/admin/accounts
//   POST   /api/admin/accounts               {username, password, role}
//   PATCH  /api/admin/accounts/:id           {username?, password?, role?, excuse?: true, email?: ''}
//   DELETE /api/admin/accounts/:id
//   POST   /api/admin/accounts/:id/ban    DELETE /api/admin/accounts/:id/ban    ban or unban an account
//   GET    /api/admin/bans                   banned accounts (deleted ones too), their attempts, blocked internet addresses
//   DELETE /api/admin/bans/ip/:ip             let that internet address make new accounts again
//   POST   /api/admin/notes                  {ids, title, logo, html} one message to many accounts    POST /api/admin/notes/clear {ids}
//   GET    /api/admin/updates                the update list, what each account has read, the notes sent, deploys since the last
//   PUT    /api/admin/updates/subs {ids}      who is on the update list    POST /api/admin/updates {bullets} sends a note to them
//   PUT    /api/admin/updates/auto {on}       whether the notes are written and sent by themselves after each update
//   GET    /api/admin/hub    PUT /api/admin/hub {content}    DELETE /api/admin/hub (back to hub.json)
//   POST   /api/admin/media                  raw image body -> {url}
//   GET    /api/admin/maintenance    PUT /api/admin/maintenance {on, message}
//   GET    /api/admin/takedown       PUT /api/admin/takedown {on}  (stays on until turned off)
//   GET    /api/admin/sys                     build and runtime details for the console's header and footer
//   GET    /api/admin/keys    POST /api/admin/keys {label} -> {key} (shown once)    DELETE /api/admin/keys/:id
//   GET    /api/admin/usage?days=30           usage statistics (from visitors who accepted them) and cookie choices
//   GET    /api/admin/accounts/:id/mocks          its handed-in mocks
//   PATCH  /api/admin/accounts/:id/mocks/:mid {got, max, grade}    DELETE /api/admin/accounts/:id/mocks/:mid   (_lib/mockfix.js)
//   POST   /api/admin/accounts/:id/clear-progress   wipe its progress: questions marked, mocks (handed in or started)
//   GET    /api/admin/activity                 each account: the page it's on now and when it was last active
//   GET    /api/admin/activity/:id?days=7       one account: its timeline, the exam papers it opened, its handed-in mocks
//   GET    /api/admin/deploylog                  the deployment log: how many, the last sync, the latest few
//   POST   /api/admin/deploylog                  {entries: [...], done: {repo: [shas]}} adds or fills in deployments
//   POST   /api/admin/deploylog/sync             checks GitHub for new deployments now
//   POST   /api/admin/deploylog/key              -> {key} (shown once) for the Google Sheet's links; the old one stops working
import { forgetMaintenance, maintenance } from '../../_lib/maintenance.js';
import { forgetTakedown, takedownState } from '../../_lib/takedown.js';
import { getKeys, newKey, saveKeys, sha256 } from '../../_lib/keys.js';
import { SOURCES, load as loadDeploys, sync as syncDeploys, upsert as upsertDeploys } from '../../_lib/deploylog.js';
import { KEEP_DAYS, SITES, db as activityDb, forget as forgetActivity, schema as activitySchema } from '../../_lib/activity.js';
import { cleanHtml } from '../../_lib/richtext.js';
import { applyFix, fixKey, setFixFlag, wipeProgress } from '../../_lib/mockfix.js';
import { MAX_BULLETS, MAX_LEN, forgetUpd, getAuto, getLog, getSubs, listUpd, saveSubs, sendUpdate, setAuto, sinceLast, writeBullets } from '../../_lib/updates.js';
import { ban, getBans, liftIp, unban } from '../../_lib/bans.js';
import { changeAccounts, clearVerifyFlag, endSessions, getAccounts, hashPassword, hubContent, json, listSessions, randomToken, refreshNoteFlag, saveAccounts, setNoteFlag } from '../../_lib/auth.js';

const ROLES = ['admin', 'user'];
const MAX_IMAGE = 5 * 1024 * 1024;

export async function onRequest(ctx) {
  const { request, env, params, data } = ctx;
  const route = (params.route || []).join('/');
  const method = request.method;
  const me = data.session;
  const body = ['POST', 'PUT', 'PATCH'].includes(method) && !route.startsWith('media')
    ? await request.json().catch(() => ({})) : null;

  if (route === 'sessions' && method === 'GET') {
    const accounts = await getAccounts(env);
    return json((await listSessions(env)).map(s => ({
      id: s.token.slice(0, 16), username: s.username, role: s.role, accountId: s.accountId,
      account: label(accounts.find(a => a.id === s.accountId) || s), created: s.created, expires: s.expires,
      ip: s.ip, country: s.country, device: s.device, current: s.token === me.token,
    })));
  }
  if (route === 'sessions/end' && method === 'POST') {
    let n = 0;
    // sessions are named by the start of their token, so the full token never reaches a browser
    if (body.id) n = await endSessions(env, s => s.token.slice(0, 16) === String(body.id) && s.token !== me.token);
    else if (body.accountId) n = await endSessions(env, s => s.accountId === body.accountId && s.token !== me.token);
    else if (body.everyoneElse) n = await endSessions(env, s => s.token !== me.token);
    return json({ ended: n });
  }
  // one message for many accounts at once: each gets its own copy (so the console shows who has read it), shown once
  if (route === 'notes' && method === 'POST') return json(...await batchNotes(env, body));
  if (route === 'notes/clear' && method === 'POST') return json(...await batchNotes(env, body, true));

  // update notes: a line or two about each update, for the accounts on the list (functions/_lib/updates.js)
  if (route === 'updates' && method === 'GET') {
    const [accounts, subs, upd, log, since, auto] = await Promise.all([getAccounts(env), getSubs(env), listUpd(env), getLog(env), sinceLast(env), getAuto(env)]);
    return json({ subs, log: log.slice(-30).reverse(), since, draft: writeBullets(since.deploys), auto, maxBullets: MAX_BULLETS, maxLen: MAX_LEN,
      accounts: accounts.map(a => ({ id: a.id, username: a.username, role: a.role, banned: a.banned || null, upd: upd[a.id] || null })) });
  }
  if (route === 'updates/subs' && method === 'PUT') return json({ ok: true, subs: await saveSubs(env, body.ids) });
  if (route === 'updates' && method === 'POST') return json(...await sendUpdate(env, body, me.username));
  if (route === 'updates/auto' && method === 'PUT') return json(await setAuto(env, !!body.on));

  if (route === 'activity' && method === 'GET') return json(await activityList(env));
  const actRoute = route.match(/^activity\/([\w:-]+)$/);
  if (actRoute && method === 'GET') return json(await activityOf(env, actRoute[1], Number(new URL(request.url).searchParams.get('days')) || 7));
  if (route === 'usage' && method === 'GET') return json(await usage(env, Number(new URL(request.url).searchParams.get('days')) || 30));
  if (route === 'accounts' && method === 'GET') {
    const [sessions, notes] = await Promise.all([listSessions(env), listNotes(env)]);
    return json((await getAccounts(env)).map(a => ({ note: notes[a.id] || null, id: a.id, username: a.username, role: a.role, label: label(a),
      banned: a.banned || null, email: a.email || '', emailVerified: a.emailVerified || null, mustVerify: !!a.mustVerify,
      signedIn: sessions.filter(s => s.accountId === a.id).length, you: a.id === me.accountId })));
  }
  if (route === 'accounts' && method === 'POST') {
    const username = clean(body.username), role = ROLES.includes(body.role) ? body.role : 'user';
    if (!username) return json({ error: 'Enter a username.' }, 400);
    if (!body.password || String(body.password).length < 4) return json({ error: 'Passwords need at least 4 characters.' }, 400);
    const list = await getAccounts(env);
    list.push({ id: 'a' + randomToken(6), username, role, ...(await hashPassword(String(body.password))) });
    await saveAccounts(env, list);
    return json({ ok: true });
  }
  const acct = route.match(/^accounts\/([\w-]+)$/);
  if (acct && method === 'PATCH') {
    const list = await getAccounts(env);
    const a = list.find(x => x.id === acct[1]);
    if (!a) return json({ error: 'No such account.' }, 404);
    if (body.username !== undefined) {
      const u = clean(body.username);
      if (!u) return json({ error: 'Enter a username.' }, 400);
      a.username = u;
    }
    if (body.role !== undefined) {
      if (!ROLES.includes(body.role)) return json({ error: 'Unknown role.' }, 400);
      if (a.role === 'admin' && body.role !== 'admin' && list.filter(x => x.role === 'admin').length < 2)
        return json({ error: 'There must always be at least one admin account.' }, 400);
      a.role = body.role;
    }
    if (body.password !== undefined) {
      if (String(body.password).length < 4) return json({ error: 'Passwords need at least 4 characters.' }, 400);
      Object.assign(a, await hashPassword(String(body.password)));
    }
    // excuse a new account from checking its email address, or forget an account's address
    if (body.excuse) delete a.mustVerify;
    if (body.email === '') { delete a.email; delete a.emailVerified; }
    await saveAccounts(env, list);
    if (body.excuse) await clearVerifyFlag(env, a.id);
    // a new password or role signs that account out everywhere (except this browser, if it's your own)
    if (body.password !== undefined || body.role !== undefined || body.username !== undefined)
      await endSessions(env, s => s.accountId === a.id && s.token !== me.token);
    return json({ ok: true });
  }
  // a message shown to an account once, on its next page (or next sign-in): set it, or take it back
  const noteRoute = route.match(/^accounts\/([\w-]+)\/note$/);
  if (noteRoute && method === 'PUT') {
    const a = (await getAccounts(env)).find(x => x.id === noteRoute[1]);
    if (!a) return json({ error: 'No such account.' }, 404);
    // a title, the JBR logo or not, and the message with its formatting (only what richtext.js keeps)
    const title = String(body.title || '').trim().slice(0, 120), html = cleanHtml(body.html);
    if (!title && !html.replace(/<[^>]*>|&nbsp;|\s/g, '')) return json({ error: 'Write a message.' }, 400);
    const rec = { title, logo: !!body.logo, html, t: Date.now() };
    await env.HUB_KV.put('note:' + a.id, JSON.stringify(rec), { metadata: { t: rec.t, len: html.length } });
    await setNoteFlag(env, a.id, true);
    return json({ ok: true });
  }
  if (noteRoute && method === 'GET') return json(await env.HUB_KV.get('note:' + noteRoute[1], 'json'));
  if (noteRoute && method === 'DELETE') {
    await env.HUB_KV.delete('note:' + noteRoute[1]);
    await refreshNoteFlag(env, noteRoute[1]);  // stays on if update notes are waiting
    return json({ ok: true });
  }
  // ban: signed out everywhere, can't sign in, and can't make a new account (functions/_lib/bans.js); unban undoes it all
  const banRoute = route.match(/^accounts\/([\w-]+)\/ban$/);
  if (banRoute && (method === 'POST' || method === 'DELETE')) {
    const id = banRoute[1], on = method === 'POST';
    if (on && id === me.accountId) return json({ error: "You can't ban the account you're signed in with." }, 400);
    const found = (await getAccounts(env)).find(x => x.id === id);
    if (!found) {
      // an account deleted after it was banned: unbanning it still frees its email address and internet addresses
      if (!on && await unban(env, id)) return json({ ok: true });
      return json({ error: 'No such account.' }, 404);
    }
    const r = await changeAccounts(env, list => {
      const a = list.find(x => x.id === id);
      if (!a) return { stop: true };
      if (on && a.role === 'admin' && list.filter(x => x.role === 'admin' && !x.banned).length < 2) return { stop: true, lastAdmin: true };
      if (on) a.banned = Date.now(); else delete a.banned;
    }, list => { const a = list.find(x => x.id === id); return !!a && !!a.banned === on; });
    if (r.lastAdmin) return json({ error: 'There must always be at least one admin account that isn\'t banned.' }, 400);
    if (!r.ok) return json({ error: 'That didn\'t save. Try again.' }, 503);
    if (on) {
      await ban(env, found, (await listSessions(env)).filter(s => s.accountId === id));
      const ended = await endSessions(env, s => s.accountId === id);
      return json({ ok: true, ended });
    }
    await unban(env, id);
    return json({ ok: true });
  }
  if (route === 'bans' && method === 'GET') {
    const b = await getBans(env), accounts = await getAccounts(env), now = Date.now();
    return json({
      accounts: Object.entries(b.accounts).map(([id, r]) => ({ id, username: r.username, email: r.email, t: r.t,
        gone: !accounts.some(a => a.id === id), devices: r.devs.length, tries: r.tries.slice().reverse() })),
      ips: Object.entries(b.ips).filter(([, x]) => x.until > now).map(([ip, x]) => ({ ip, t: x.t, until: x.until,
        username: (b.accounts[x.acct] || {}).username || '' })),
    });
  }
  const ipRoute = route.match(/^bans\/ip\/(.+)$/);
  if (ipRoute && method === 'DELETE') {
    await liftIp(env, decodeURIComponent(ipRoute[1]));
    return json({ ok: true });
  }
  // an account's handed-in mocks: see them, correct a score or grade, or remove one handed in by accident
  const mocksRoute = route.match(/^accounts\/([\w-]+)\/mocks(?:\/([\w.:-]{1,60}))?$/);
  if (mocksRoute) return json(...await mockAdmin(env, mocksRoute[1], mocksRoute[2], method, body));
  const clearRoute = route.match(/^accounts\/([\w-]+)\/clear-progress$/);
  if (clearRoute && method === 'POST') return json(...await clearProgress(env, clearRoute[1]));
  if (acct && method === 'DELETE') {
    const list = await getAccounts(env);
    const a = list.find(x => x.id === acct[1]);
    if (!a) return json({ error: 'No such account.' }, 404);
    if (a.id === me.accountId) return json({ error: "You can't delete the account you're signed in with." }, 400);
    if (a.role === 'admin' && list.filter(x => x.role === 'admin').length < 2)
      return json({ error: 'There must always be at least one admin account.' }, 400);
    await saveAccounts(env, list.filter(x => x.id !== a.id));
    await endSessions(env, s => s.accountId === a.id);
    await env.HUB_KV.delete('prog:' + a.id);
    await env.HUB_KV.delete('consent:' + a.id);
    await env.HUB_KV.delete('ecode:' + a.id);
    await env.HUB_KV.delete('note:' + a.id);
    await env.HUB_KV.delete(fixKey(a.id));
    await forgetUpd(env, a.id);
    await forgetActivity(env, a.id);
    return json({ ok: true });
  }

  if (route === 'keys' && method === 'GET') {
    const list = await getKeys(env);
    const used = await Promise.all(list.map(k => env.HUB_KV.get('keyused:' + k.id)));
    return json(list.map(({ hash, ...k }, i) => ({ ...k, lastUsed: Number(used[i]) || k.lastUsed || null })));
  }
  if (route === 'keys' && method === 'POST') {
    const label = clean(body.label) || 'Agent';
    const key = newKey(), list = await getKeys(env);
    list.push({ id: randomToken(6), label, hash: await sha256(key), created: Date.now(), lastUsed: null });
    await saveKeys(env, list);
    return json({ key, label });
  }
  const keyRoute = route.match(/^keys\/([\w-]+)$/);
  if (keyRoute && method === 'DELETE') {
    const list = await getKeys(env);
    if (!list.some(k => k.id === keyRoute[1])) return json({ error: 'No such key.' }, 404);
    await saveKeys(env, list.filter(k => k.id !== keyRoute[1]));
    await env.HUB_KV.delete('keyused:' + keyRoute[1]);
    return json({ ok: true });
  }

  if (route === 'maintenance' && method === 'GET') return json(await maintenance(ctx, true));
  if (route === 'maintenance' && method === 'PUT') {
    const on = !!body.on, message = String(body.message || '').trim().slice(0, 300);
    const minutes = Math.min(Math.max(Number(body.minutes) || 0, 0), 24 * 60);
    await env.HUB_KV.put('maintenance', JSON.stringify({ on, message, since: on ? Date.now() : null,
      until: on && minutes ? Date.now() + minutes * 60000 : null }));
    forgetMaintenance();
    return json(await maintenance(ctx, true));
  }

  if (route === 'takedown' && method === 'GET') return json(await takedownState(env));
  if (route === 'takedown' && method === 'PUT') {
    if (body.on) await env.HUB_KV.put('takedown', JSON.stringify({ on: true, since: Date.now(), by: me.username }));
    else await env.HUB_KV.delete('takedown');
    forgetTakedown();
    return json(await takedownState(env));
  }

  if (route === 'sys' && method === 'GET') {
    const cf = request.cf || {};
    return json({ commit: env.CF_PAGES_COMMIT_SHA || null, branch: env.CF_PAGES_BRANCH || null, deployUrl: env.CF_PAGES_URL || null,
      colo: cf.colo || null, country: cf.country || null, tls: cf.tlsVersion || null, http: cf.httpProtocol || null, asn: cf.asn || null,
      ray: request.headers.get('cf-ray'), now: Date.now(), operator: me.username,
      bindings: { HUB_KV: !!env.HUB_KV, ACTIVITY_DB: !!env.ACTIVITY_DB, HUB_SECRET: !!env.HUB_SECRET, RESEND_API_KEY: !!env.RESEND_API_KEY, GITHUB_TOKEN: !!env.GITHUB_TOKEN } });  // set or not, never the values
  }

  if (route === 'hub' && method === 'GET') return json(await hubContent(ctx));
  if (route === 'hub' && method === 'PUT') {
    const c = body && body.content;
    if (!c || typeof c.title !== 'string' || !Array.isArray(c.sites) || !Array.isArray(c.sections))
      return json({ error: 'That content is not in the expected shape.' }, 400);
    await env.HUB_KV.put('hub', JSON.stringify(c));
    return json({ ok: true });
  }
  if (route === 'hub' && method === 'DELETE') {
    await env.HUB_KV.delete('hub');
    return json({ ok: true });
  }

  if (route === 'media' && method === 'POST') {
    const type = (request.headers.get('content-type') || '').split(';')[0];
    if (!/^image\/(png|jpeg|gif|webp|svg\+xml|avif)$/.test(type)) return json({ error: 'Upload a PNG, JPEG, GIF, WebP, AVIF or SVG image.' }, 400);
    const buf = await request.arrayBuffer();
    if (buf.byteLength > MAX_IMAGE) return json({ error: 'Images can be up to 5 MB.' }, 400);
    const id = randomToken(12);
    await env.HUB_KV.put('media:' + id, buf, { metadata: { type, size: buf.byteLength, at: Date.now() } });
    return json({ url: '/media/' + id });
  }
  if (route === 'deploylog' && method === 'GET') {
    const log = await loadDeploys(env);
    return json({ count: log.entries.length, sync: await env.HUB_KV.get('deploylog:sync', 'json'), key: !!(await env.HUB_KV.get('deploylog:key')),
      latest: log.entries.slice(-10) });
  }
  if (route === 'deploylog' && method === 'POST') {
    const log = await loadDeploys(env);
    for (const [repo, shas] of Object.entries(body.done || {})) {
      if (!SOURCES.some(s => s.repo === repo) || !Array.isArray(shas)) continue;
      const st = log.gh[repo] || (log.gh[repo] = { etag: '', done: [] });
      st.done = [...new Set([...st.done, ...shas.filter(h => /^[0-9a-f]{40}$/.test(h))])].slice(-300);
    }
    const items = (Array.isArray(body.entries) ? body.entries : []).map(deployItem);
    if (items.some(x => !x)) return json({ error: 'An entry is missing something.' }, 400);
    const added = await upsertDeploys(env, log, items);
    return json({ ok: true, added, count: log.entries.length });
  }
  if (route === 'deploylog/sync' && method === 'POST') return json(await syncDeploys(env));
  if (route === 'deploylog/key' && method === 'POST') {
    const key = randomToken(24);
    await env.HUB_KV.put('deploylog:key', await sha256(key));
    return json({ key });
  }
  return json({ error: 'Not found' }, 404);
}

// a deployment sent to POST deploylog, checked and trimmed (null if something is missing)
function deployItem(x) {
  const str = (v, n) => typeof v === 'string' ? v.slice(0, n) : '';
  const link = v => /^https:\/\/[^\s"<>]+$/.test(v || '') ? v.slice(0, 400) : '';
  if (!x || !SOURCES.some(s => s.repo === x.repo) || !/^[0-9a-f]{40}$/.test(x.sha || '') || !/^[a-z]+:?[\w-]*$/.test(x.proj || '')
    || !Number.isFinite(x.at) || !Array.isArray(x.commits)) return null;
  const commits = x.commits.slice(0, 200).map(c => ({ h: /^[0-9a-f]{40}$/.test(c.h) ? c.h : '', at: Number(c.at) || 0, s: str(c.s, 300), b: str(c.b, 3000) }));
  const f = x.files;
  const files = f && Number.isFinite(f.n) ? { n: f.n, a: Number(f.a) || 0, m: Number(f.m) || 0, d: Number(f.d) || 0,
    list: (Array.isArray(f.list) ? f.list : []).slice(0, 80).map(([st, path]) => [str(st, 1), str(path, 300)]),
    dirs: (Array.isArray(f.dirs) ? f.dirs : []).slice(0, 20).map(([d, n]) => [str(d, 120), Number(n) || 0]) } : null;
  return { proj: x.proj.slice(0, 60), site: str(x.site, 80) || x.proj, repo: x.repo, sha: x.sha, at: x.at, ok: x.ok === true,
    url: link(x.url), dash: link(x.dash), commits, files };
}

// every account's message from the admin console in one listing: when it was set, and when it was read
async function listNotes(env) {
  const out = {};
  let cursor;
  do {
    const page = await env.HUB_KV.list({ prefix: 'note:', cursor });
    for (const k of page.keys) out[k.name.slice(5)] = k.metadata || {};
    cursor = page.list_complete ? null : page.cursor;
  } while (cursor);
  return out;
}

// POST /api/admin/notes {ids, title, logo, html} sends one message to each of those accounts (banned ones are skipped);
// POST /api/admin/notes/clear {ids} cancels or clears theirs. Returns [body, status] for json().
async function batchNotes(env, body, clear) {
  const want = new Set((Array.isArray(body.ids) ? body.ids : []).map(String));
  const accounts = (await getAccounts(env)).filter(a => want.has(a.id) && (clear || !a.banned));
  if (!accounts.length) return [{ error: 'Pick at least one account.' }, 400];
  if (accounts.length > 500) return [{ error: 'Pick 500 accounts or fewer at a time.' }, 400];
  const t = Date.now();
  let rec, len = 0;
  if (!clear) {
    const title = String(body.title || '').trim().slice(0, 120), html = cleanHtml(body.html);
    if (!title && !html.replace(/<[^>]*>|&nbsp;|\s/g, '')) return [{ error: 'Write a message.' }, 400];
    rec = JSON.stringify({ title, logo: !!body.logo, html, t }); len = html.length;
  }
  const ids = new Set(accounts.map(a => a.id)), keep = new Set();
  for (const a of accounts) {
    if (clear) await env.HUB_KV.delete('note:' + a.id);
    else await env.HUB_KV.put('note:' + a.id, rec, { metadata: { t, len } });
  }
  // after clearing, accounts with update notes waiting keep the flag (refreshNoteFlag, for many accounts at once)
  if (clear) for (const [id, u] of Object.entries(await listUpd(env))) if (ids.has(id) && !u.seen && u.n) keep.add(id);
  // the same as setNoteFlag, with one pass over the sessions for every account
  for (const s of await listSessions(env)) {
    const on = !clear || keep.has(s.accountId);
    if (!ids.has(s.accountId) || !!s.note === on) continue;
    const { token, note, ...info } = s;
    if (on) info.note = true;
    await env.HUB_KV.put('sess:' + token, JSON.stringify(info), { expiration: Math.floor(info.expires / 1000), metadata: info });
  }
  return [{ ok: true, count: accounts.length, skipped: want.size - accounts.length }];
}

function clean(s) { return String(s || '').trim().slice(0, 40); }
function label(a) {
  return a.username + (a.role === 'admin' ? ' (admin)' : '');
}

// usage statistics: per day, the visitors (one key each) and their page counts, read from the keys' metadata only;
// and how many accounts accepted usage statistics or chose essential cookies only
async function listAll(env, prefix, max = 5000) {
  const out = [];
  let cursor;
  do {
    const page = await env.HUB_KV.list({ prefix, cursor, limit: 1000 });
    out.push(...page.keys);
    cursor = page.list_complete ? null : page.cursor;
  } while (cursor && out.length < max);
  return out;
}
async function usage(env, days) {
  days = Math.max(1, Math.min(90, days));
  const from = new Date(Date.now() - (days - 1) * 86400000).toISOString().slice(0, 10);
  const byDay = {}, pages = {}, devices = { phone: 0, tablet: 0, computer: 0 }, visitors = new Set();
  for (const k of await listAll(env, 'use:')) {
    const [, d, vid] = k.name.split(':');
    if (d < from || !k.metadata) continue;
    const m = k.metadata, n = Object.values(m.pv || {}).reduce((a, b) => a + b, 0);
    const day = byDay[d] || (byDay[d] = { visitors: 0, views: 0 });
    day.visitors++; day.views += n;
    visitors.add(vid);
    if (devices[m.dev] != null) devices[m.dev]++;
    for (const [p, c] of Object.entries(m.pv || {})) pages[p] = (pages[p] || 0) + c;
  }
  const consent = { stats: 0, essential: 0 };
  for (const k of await listAll(env, 'consent:')) if (k.metadata) consent[k.metadata.stats ? 'stats' : 'essential']++;
  return { days, from, byDay, pages, devices, visitors: visitors.size, consent };
}

// Activity (functions/_lib/activity.js): every account with the page it's on now and when it was last active, newest
// first, then the accounts that haven't been seen yet
async function activityList(env) {
  const d = activityDb(env), accounts = await getAccounts(env);
  if (!d) return { setup: false, people: [] };
  await activitySchema(d);
  // old rows go once a day, when the console looks
  const today = new Date().toISOString().slice(0, 10);
  if ((await env.HUB_KV.get('activity:trimmed')) !== today) {
    await d.prepare('DELETE FROM events WHERE t < ?').bind(Date.now() - KEEP_DAYS * 86400000).run();
    await d.prepare('DELETE FROM presence WHERE t < ?').bind(Date.now() - KEEP_DAYS * 86400000).run();
    await env.HUB_KV.put('activity:trimmed', today, { expirationTtl: 2 * 86400 });
  }
  const since = Date.now() - 86400000;
  const [{ results: seen }, { results: counts }] = await d.batch([
    d.prepare('SELECT account, username, t, since, site, page, title, device FROM presence ORDER BY t DESC'),
    d.prepare('SELECT account, COUNT(*) AS n FROM events WHERE t >= ? GROUP BY account').bind(since),
  ]);
  const day = Object.fromEntries(counts.map(c => [c.account, c.n]));
  const people = seen.map(p => {
    const a = accounts.find(x => x.id === p.account);
    return { ...p, username: a ? a.username : p.username, role: a ? a.role : (p.account.startsWith('key:') ? 'key' : 'gone'), today: day[p.account] || 0 };
  });
  for (const a of accounts) if (!people.some(p => p.account === a.id)) people.push({ account: a.id, username: a.username, role: a.role, t: null, today: 0 });
  return { setup: true, sites: SITES, keepDays: KEEP_DAYS, people };
}

// one account: its pages in the last few days (newest first, up to 1,000), the exam papers it opened questions from,
// and, from its progress, the mocks it handed in and how many questions it marked in each subject
async function activityOf(env, account, days) {
  const d = activityDb(env);
  if (!d) return { setup: false };
  await activitySchema(d);
  days = Math.max(1, Math.min(KEEP_DAYS, days));
  const from = Date.now() - days * 86400000;
  const [{ results: events }, { results: papers }] = await d.batch([
    d.prepare('SELECT t, site, page, title, paper FROM events WHERE account = ? AND t >= ? ORDER BY t DESC LIMIT 1000').bind(account, from),
    d.prepare(`SELECT paper, site, COUNT(*) AS views, COUNT(DISTINCT page) AS questions, MIN(t) AS first, MAX(t) AS last
      FROM events WHERE account = ? AND t >= ? AND paper != '' GROUP BY paper, site ORDER BY last DESC`).bind(account, from),
  ]);
  const prog = account.startsWith('key:') ? null : await env.HUB_KV.get('prog:' + account, 'json');
  const marked = {};
  for (const v of Object.values((prog && prog.items) || {})) {
    if (!v || !v.s) continue;
    const m = marked[v.s] || (marked[v.s] = { n: 0, last: 0 });
    m.n++; m.last = Math.max(m.last, v.t || 0);
  }
  const mocks = ((prog && prog.mocks) || []).filter(m => m && m.t >= from).reverse().map(m => ({ t: m.t, s: m.s, board: m.board || '',
    qual: (m.paper && m.paper.qual) || '', got: m.got, max: m.max, pct: m.pct, grade: m.grade || '', used: m.used, minutes: m.minutes }));
  return { setup: true, days, events, papers, mocks, marked };
}

async function mockAdmin(env, id, mid, method, body) {
  const a = (await getAccounts(env)).find(x => x.id === id);
  if (!a) return [{ error: 'No such account.' }, 404];
  const [prog, fix0] = await Promise.all([env.HUB_KV.get('prog:' + id, 'json'), env.HUB_KV.get(fixKey(id), 'json')]);
  const fix = fix0 || { t: 0, gone: {}, edit: {} };
  applyFix(prog, fix);
  const mocks = (prog && prog.mocks) || [];
  if (!mid && method === 'GET') {
    return [{ username: a.username, mocks: mocks.slice().reverse().map(m => ({ id: m.id, s: m.s, board: m.board || '', t: m.t, got: m.got, max: m.max,
      pct: m.pct, grade: m.grade || '', minutes: m.minutes || null, used: m.used != null ? m.used : null, questions: m.paper && m.paper.items ? m.paper.items.length : null,
      share: m.share || '', fixed: !!fix.edit[m.id] })), removed: Object.keys(fix.gone).length }];
  }
  const m = mid && mocks.find(x => x.id === mid);
  if (!m) return [{ error: 'No such mock (it may have been removed already).' }, 404];
  if (method === 'PATCH') {
    const max = Number(body.max), got = Number(body.got);
    if (!Number.isFinite(max) || max <= 0 || max > 1000 || !Number.isFinite(got) || got < 0 || got > max) return [{ error: 'Marks must be a number from 0 to the total, and the total more than 0.' }, 400];
    const grade = String(body.grade == null ? '' : body.grade).trim().slice(0, 4);
    fix.edit[mid] = { got, max, pct: got / max, grade: grade || null };
  } else if (method === 'DELETE') {
    fix.gone[mid] = Date.now();
    delete fix.edit[mid];
    // its share code stops working too
    if (m.share) await env.HUB_KV.delete('share:' + m.share);
    await env.HUB_KV.delete('shared:' + id + ':' + mid.slice(0, 40));
  } else return [{ error: 'Not found' }, 404];
  fix.t = Date.now();
  await env.HUB_KV.put(fixKey(id), JSON.stringify(fix));
  await env.HUB_KV.put('prog:' + id, JSON.stringify(applyFix(prog, fix)));
  await setFixFlag(env, id, fix.t);
  return [{ ok: true }];
}

// wipe an account's progress (_lib/mockfix.js, shared with Settings → Clear my progress)
async function clearProgress(env, id) {
  if (!(await getAccounts(env)).find(x => x.id === id)) return [{ error: 'No such account.' }, 404];
  return [{ ok: true, ...await wipeProgress(env, id) }];
}
