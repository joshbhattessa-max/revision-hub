import { checkLogin, createSession, json, noteFailure, sessionCookie, SESSION_SECONDS, tooManyFailures } from '../_lib/auth.js';

export async function onRequestPost({ env, request }) {
  let body = {};
  try { body = await request.json(); } catch (e) { /* empty body */ }
  if (await tooManyFailures(env, request, body.username)) return json({ error: 'Too many attempts. Try again in 15 minutes.' }, 429);
  const account = await checkLogin(env, body.username, body.password);
  if (!account) {
    await noteFailure(env, request, body.username);
    return json({ error: 'Wrong username or password.' }, 401);
  }
  const token = await createSession(env, account, request);
  return json({ ok: true }, 200, { 'set-cookie': sessionCookie(token, SESSION_SECONDS) });
}
