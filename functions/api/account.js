// The signed-in person's own account (Settings, and the menu under their name on the home page).
//   GET    /api/account   {username, email, verified, canEmail, role}
//   POST   /api/account   {current, password}   change password; signs out their other devices
//   PATCH  /api/account   {username}            change username (must not be taken)
//                         {signOutOthers: true}  sign out every other device
//                         {clearProgress: true, password}  wipe their questions marked and mocks (_lib/mockfix.js)
//   DELETE /api/account   {password}            delete the account and sign it out everywhere
import { forget as forgetActivity } from '../_lib/activity.js';
import { changeAccounts, clearCookie, endSessions, getAccounts, hashPassword, json, listSessions, noteFailure, saveAccounts, tooManyFailures, verifyPassword } from '../_lib/auth.js';
import { canSend } from '../_lib/email.js';
import { wipeProgress } from '../_lib/mockfix.js';

async function mine(ctx, password) {
  const { env, request, data } = ctx;
  if (await tooManyFailures(env, request, data.session.accountId)) return { error: json({ error: 'Too many attempts. Try again in 15 minutes.' }, 429) };
  const list = await getAccounts(env);
  const account = list.find(a => a.id === data.session.accountId);
  if (!account) return { error: json({ error: 'This account no longer exists.' }, 404) };
  if (!await verifyPassword(account, password)) {
    await noteFailure(env, request, data.session.accountId);
    return { error: json({ error: 'Your current password is wrong.' }, 403) };
  }
  return { list, account };
}

const keyOnly = s => s.viaKey ? json({ error: 'Sign in with your username and password to change this.' }, 403) : null;

export async function onRequestGet(ctx) {
  const s = ctx.data.session;
  if (s.viaKey) return json({ username: s.username, role: s.role, viaKey: true });
  const a = (await getAccounts(ctx.env)).find(x => x.id === s.accountId);
  if (!a) return json({ error: 'This account no longer exists.' }, 404);
  return json({ username: a.username, role: a.role, email: a.email || '', verified: !!a.emailVerified, canEmail: canSend(ctx.env) });
}

export async function onRequestPost(ctx) {
  const no = keyOnly(ctx.data.session); if (no) return no;
  const body = await ctx.request.json().catch(() => ({}));
  const password = String(body.password || '');
  if (password.length < 6) return json({ error: 'New passwords need at least 6 characters.' }, 400);
  if (password.length > 200) return json({ error: 'That password is too long.' }, 400);
  const { error, list, account } = await mine(ctx, body.current);
  if (error) return error;
  Object.assign(account, await hashPassword(password));
  await saveAccounts(ctx.env, list);
  const me = ctx.data.session.token;
  const others = await endSessions(ctx.env, s => s.accountId === account.id && s.token !== me);
  return json({ ok: true, signedOutElsewhere: others });
}

export async function onRequestPatch(ctx) {
  const { env, data } = ctx, s = data.session;
  const no = keyOnly(s); if (no) return no;
  const body = await ctx.request.json().catch(() => ({}));

  if (body.signOutOthers) {
    const n = await endSessions(env, x => x.accountId === s.accountId && x.token !== s.token);
    return json({ ok: true, signedOut: n });
  }

  if (body.clearProgress) {
    const { error } = await mine(ctx, body.password);
    if (error) return error;
    return json({ ok: true, ...await wipeProgress(env, s.accountId) });
  }

  if (body.username !== undefined) {
    const username = String(body.username || '').trim();
    // the same rule as signing up (functions/api/signup.js)
    if (!/^[A-Za-z0-9 _.-]{3,30}$/.test(username))
      return json({ error: 'Usernames are 3 to 30 letters, numbers, spaces, dots, dashes or underscores.' }, 400);
    const low = username.toLowerCase();
    const r = await changeAccounts(env, list => {
      const a = list.find(x => x.id === s.accountId);
      if (!a) return { stop: true, gone: true };
      if (list.some(x => x.id !== a.id && x.username.toLowerCase() === low)) return { stop: true, taken: true };
      a.username = username;
    }, list => (list.find(x => x.id === s.accountId) || {}).username === username);
    if (r.gone) return json({ error: 'This account no longer exists.' }, 404);
    if (r.taken) return json({ error: 'That username is taken. Pick another one.' }, 409);
    if (!r.ok) return json({ error: 'Something went wrong. Try again.' }, 500);
    // its sessions on every device show the new name straight away
    for (const x of await listSessions(env)) {
      if (x.accountId !== s.accountId || x.username === username) continue;
      const { token, ...info } = x;
      info.username = username;
      await env.HUB_KV.put('sess:' + token, JSON.stringify(info), { expiration: Math.floor(info.expires / 1000), metadata: info });
    }
    return json({ ok: true, username });
  }

  return json({ error: 'Nothing to change.' }, 400);
}

export async function onRequestDelete(ctx) {
  const no = keyOnly(ctx.data.session); if (no) return no;
  const body = await ctx.request.json().catch(() => ({}));
  const { error, list, account } = await mine(ctx, body.password);
  if (error) return error;
  if (account.role === 'admin' && list.filter(a => a.role === 'admin').length < 2)
    return json({ error: "This is the only admin account, so it can't be deleted." }, 400);
  await saveAccounts(ctx.env, list.filter(a => a.id !== account.id));
  await endSessions(ctx.env, s => s.accountId === account.id);
  await ctx.env.HUB_KV.delete('prog:' + account.id);  // and its study progress
  await ctx.env.HUB_KV.delete('prefs:' + account.id);  // and its settings
  await ctx.env.HUB_KV.delete('consent:' + account.id);  // and its cookie-choice record
  await ctx.env.HUB_KV.delete('ecode:' + account.id);  // and any email code waiting for it
  await forgetActivity(ctx.env, account.id);  // and its activity (the pages it opened)
  return json({ ok: true }, 200, { 'set-cookie': clearCookie() });
}
