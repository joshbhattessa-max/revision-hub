// Admin console API (admin accounts only; the middleware checks the role).
//   GET    /api/admin/sessions               who is signed in
//   POST   /api/admin/sessions/end           {id} | {accountId} | {everyoneElse: true}
//   GET    /api/admin/accounts
//   POST   /api/admin/accounts               {username, password, role}
//   PATCH  /api/admin/accounts/:id           {username?, password?, role?, excuse?: true, email?: ''}
//   DELETE /api/admin/accounts/:id
//   GET    /api/admin/hub    PUT /api/admin/hub {content}    DELETE /api/admin/hub (back to hub.json)
//   POST   /api/admin/media                  raw image body -> {url}
//   GET    /api/admin/maintenance    PUT /api/admin/maintenance {on, message}
//   GET    /api/admin/keys    POST /api/admin/keys {label} -> {key} (shown once)    DELETE /api/admin/keys/:id
//   GET    /api/admin/usage?days=30           usage statistics (from visitors who accepted them) and cookie choices
//   GET    /api/admin/inbox?cursor=            emails to contact@ and what the assistant did, newest first (50 at a time)
//   GET    /api/admin/inbox/:key    DELETE /api/admin/inbox/:key
//   GET    /api/admin/deploylog                  the deployment log: how many, the last sync, the latest few
//   POST   /api/admin/deploylog                  {entries: [...], done: {repo: [shas]}} adds or fills in deployments
//   POST   /api/admin/deploylog/sync             checks GitHub for new deployments now
//   POST   /api/admin/deploylog/key              -> {key} (shown once) for the Google Sheet's links; the old one stops working
import { forgetMaintenance, maintenance } from '../../_lib/maintenance.js';
import { getKeys, newKey, saveKeys, sha256 } from '../../_lib/keys.js';
import { SOURCES, load as loadDeploys, sync as syncDeploys, upsert as upsertDeploys } from '../../_lib/deploylog.js';
import { clearVerifyFlag, endSessions, getAccounts, hashPassword, hubContent, json, listSessions, randomToken, saveAccounts } from '../../_lib/auth.js';

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

  if (route === 'inbox' && method === 'GET') {
    const page = await env.HUB_KV.list({ prefix: 'mail:', limit: 50, cursor: new URL(request.url).searchParams.get('cursor') || undefined });
    return json({ items: page.keys.map(k => ({ key: k.name, ...(k.metadata || {}) })), cursor: page.list_complete ? null : page.cursor });
  }
  const mailKey = decodeURIComponent(route).match(/^inbox\/(mail:[\w:]+)$/);
  if (mailKey && method === 'GET') {
    const m = await env.HUB_KV.get(mailKey[1], 'json');
    return m ? json(m) : json({ error: 'Not found.' }, 404);
  }
  if (mailKey && method === 'DELETE') { await env.HUB_KV.delete(mailKey[1]); return json({ ok: true }); }
  if (route === 'usage' && method === 'GET') return json(await usage(env, Number(new URL(request.url).searchParams.get('days')) || 30));
  if (route === 'accounts' && method === 'GET') {
    const sessions = await listSessions(env);
    return json((await getAccounts(env)).map(a => ({ id: a.id, username: a.username, role: a.role, label: label(a),
      email: a.email || '', emailVerified: a.emailVerified || null, mustVerify: !!a.mustVerify,
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
    return json({ ok: true });
  }

  if (route === 'keys' && method === 'GET') return json((await getKeys(env)).map(({ hash, ...k }) => k));
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
