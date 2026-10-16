import { checkLogin, createSession, json, noteFailure, sessionCookie, SESSION_SECONDS, tooManyFailures } from '../_lib/auth.js';
import { deviceCookie, deviceOf, getBans, newDevice, noteTry } from '../_lib/bans.js';

export async function onRequestPost({ env, request }) {
  let body = {};
  try { body = await request.json(); } catch (e) { /* empty body */ }
  if (await tooManyFailures(env, request, body.username)) return json({ error: 'Too many attempts. Try again in 15 minutes.' }, 429);
  const account = await checkLogin(env, body.username, body.password);
  if (!account) {
    await noteFailure(env, request, body.username);
    return json({ error: 'Wrong username or password.' }, 401);
  }
  const dev = deviceOf(request) || newDevice();
  // a banned account (right password, so it is them): this browser is remembered as theirs
  if (account.banned) {
    await noteTry(env, await getBans(env), account.id, request, dev, 'signin');
    return json({ error: 'This account has been banned.', banned: true }, 403, { 'set-cookie': deviceCookie(dev) });
  }
  const token = await createSession(env, account, request, dev);
  const res = json({ ok: true }, 200, { 'set-cookie': sessionCookie(token, SESSION_SECONDS) });
  res.headers.append('set-cookie', deviceCookie(dev));
  return res;
}
