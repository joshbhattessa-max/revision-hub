// Anyone on the login page can make a standard account (never an admin) and is signed straight in.
import { createSession, getAccounts, hashPassword, json, randomToken, saveAccounts, sessionCookie, SESSION_SECONDS } from '../_lib/auth.js';

const MAX_PER_HOUR = 5; // new accounts per address

export async function onRequestPost({ env, request }) {
  const ip = request.headers.get('cf-connecting-ip') || 'unknown';
  const made = parseInt(await env.HUB_KV.get('signup:' + ip) || '0', 10);
  if (made >= MAX_PER_HOUR) return json({ error: 'Too many new accounts from here. Try again in an hour.' }, 429);

  let body = {};
  try { body = await request.json(); } catch (e) { /* empty body */ }
  const username = String(body.username || '').trim();
  const password = String(body.password || '');
  if (!/^[A-Za-z0-9 _.-]{3,30}$/.test(username))
    return json({ error: 'Usernames need 3–30 letters, numbers, spaces, dots, dashes or underscores.' }, 400);
  if (password.length < 6) return json({ error: 'Passwords need at least 6 characters.' }, 400);
  if (password.length > 200) return json({ error: 'That password is too long.' }, 400);

  const list = await getAccounts(env);
  if (list.some(a => a.username.toLowerCase() === username.toLowerCase()))
    return json({ error: 'That username is taken. Pick another one.' }, 409);
  const account = { id: 'a' + randomToken(6), username, role: 'user', ...(await hashPassword(password)) };
  list.push(account);
  await saveAccounts(env, list);
  await env.HUB_KV.put('signup:' + ip, String(made + 1), { expirationTtl: 3600 });

  const token = await createSession(env, account, request);
  return json({ ok: true }, 200, { 'set-cookie': sessionCookie(token, SESSION_SECONDS) });
}
