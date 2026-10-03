// The signed-in person's own account (the menu under their name on the home page).
//   POST   /api/account   {current, password}   change password; signs out their other devices
//   DELETE /api/account   {password}            delete the account and sign it out everywhere
import { clearCookie, endSessions, getAccounts, hashPassword, json, noteFailure, saveAccounts, tooManyFailures, verifyPassword } from '../_lib/auth.js';

async function mine(ctx, password) {
  const { env, request, data } = ctx;
  if (await tooManyFailures(env, request)) return { error: json({ error: 'Too many attempts. Try again in 15 minutes.' }, 429) };
  const list = await getAccounts(env);
  const account = list.find(a => a.id === data.session.accountId);
  if (!account) return { error: json({ error: 'This account no longer exists.' }, 404) };
  if (!await verifyPassword(account, password)) {
    await noteFailure(env, request);
    return { error: json({ error: 'Your current password is wrong.' }, 403) };
  }
  return { list, account };
}

export async function onRequestPost(ctx) {
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

export async function onRequestDelete(ctx) {
  const body = await ctx.request.json().catch(() => ({}));
  const { error, list, account } = await mine(ctx, body.password);
  if (error) return error;
  if (account.role === 'admin' && list.filter(a => a.role === 'admin').length < 2)
    return json({ error: "This is the only admin account, so it can't be deleted." }, 400);
  await saveAccounts(ctx.env, list.filter(a => a.id !== account.id));
  await endSessions(ctx.env, s => s.accountId === account.id);
  return json({ ok: true }, 200, { 'set-cookie': clearCookie() });
}
