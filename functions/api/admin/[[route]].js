// Admin console API (admin accounts only; the middleware checks the role).
//   GET    /api/admin/sessions               who is signed in
//   POST   /api/admin/sessions/end           {id} | {accountId} | {everyoneElse: true}
//   GET    /api/admin/accounts
//   POST   /api/admin/accounts               {username, password, role}
//   PATCH  /api/admin/accounts/:id           {username?, password?, role?}
//   DELETE /api/admin/accounts/:id
//   GET    /api/admin/hub    PUT /api/admin/hub {content}    DELETE /api/admin/hub (back to hub.json)
//   POST   /api/admin/media                  raw image body -> {url}
import { endSessions, getAccounts, hashPassword, hubContent, json, listSessions, randomToken, saveAccounts } from '../../_lib/auth.js';

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

  if (route === 'accounts' && method === 'GET') {
    const sessions = await listSessions(env);
    return json((await getAccounts(env)).map(a => ({ id: a.id, username: a.username, role: a.role, label: label(a),
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
    await saveAccounts(env, list);
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
    return json({ ok: true });
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
  return json({ error: 'Not found' }, 404);
}

function clean(s) { return String(s || '').trim().slice(0, 40); }
function label(a) {
  return a.username + (a.role === 'admin' ? ' (admin)' : '');
}
