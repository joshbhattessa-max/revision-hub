// Anyone on the login page can make a standard account (never an admin) and is signed straight in. New accounts give
// an email address and, once the site can send emails, have to type in the code emailed to it before using the site.
import { changeAccounts, createSession, hashPassword, json, randomToken, sessionCookie, SESSION_SECONDS } from '../_lib/auth.js';
import { bannedBy, deviceCookie, deviceOf, getBans, ipBlocked, newDevice, noteTry } from '../_lib/bans.js';
import { canSend, cleanEmail, emailCode, validEmail } from '../_lib/email.js';

const MAX_PER_HOUR = 40; // new accounts per address (a school shares one, so a class must fit)

export async function onRequestPost({ env, request }) {
  const ip = request.headers.get('cf-connecting-ip') || 'unknown';
  const made = parseInt(await env.HUB_KV.get('signup:' + ip) || '0', 10);
  if (made >= MAX_PER_HOUR) return json({ error: 'Too many new accounts from here. Try again in an hour.' }, 429);

  let body = {};
  try { body = await request.json(); } catch (e) { /* empty body */ }
  const username = String(body.username || '').trim();
  const password = String(body.password || '');
  const email = cleanEmail(body.email);
  if (!/^[A-Za-z0-9 _.-]{3,30}$/.test(username))
    return json({ error: 'Usernames need 3–30 letters, numbers, spaces, dots, dashes or underscores.' }, 400);
  if (password.length < 6) return json({ error: 'Passwords need at least 6 characters.' }, 400);
  if (password.length > 200) return json({ error: 'That password is too long.' }, 400);
  if (!validEmail(email)) return json({ error: "Enter your email address. We'll send it a code to check it's yours." }, 400);

  // someone whose account was banned can't make another one; when they try, their internet address can't make new
  // accounts for a while either (functions/_lib/bans.js). Other people there can still sign in to their own accounts.
  const dev = deviceOf(request) || newDevice(), bans = await getBans(env);
  const bannedId = bannedBy(bans, { email, dev });
  if (bannedId) await noteTry(env, bans, bannedId, request, dev, 'signup');
  if (bannedId || ipBlocked(bans, request))
    return json({ error: "New accounts can't be made from here. If you already have an account, sign in to it." }, 403,
      { 'set-cookie': deviceCookie(dev) });

  const account = { id: 'a' + randomToken(6), username, role: 'user', email, mustVerify: true, ...(await hashPassword(password)) };
  const saved = await changeAccounts(env, list => {
    if (list.some(a => a.username.toLowerCase() === username.toLowerCase())) return { stop: true, taken: true };
    list.push(account);
  }, list => list.some(a => a.id === account.id));
  if (saved.taken) return json({ error: 'That username is taken. Pick another one.' }, 409);
  if (!saved.ok) return json({ error: "Lots of people are signing up right now. Try again in a minute." }, 503);
  await env.HUB_KV.put('signup:' + ip, String(made + 1), { expirationTtl: 3600 });

  const token = await createSession(env, account, request, dev);
  // the first code goes straight away; the "check your email" page can send another
  const verify = canSend(env);
  const sent = verify && !!(await emailCode(env, 'ecode:' + account.id, account.id, email)).ok;
  const res = json({ ok: true, verify, sent }, 200, { 'set-cookie': sessionCookie(token, SESSION_SECONDS) });
  res.headers.append('set-cookie', deviceCookie(dev));
  return res;
}
