// "Forgot your password?" on the sign-in page, for accounts with a checked email address. Open to everyone.
//   POST /api/reset {step: 'send', email}                emails a code if an account uses that address. It always
//                                                        answers the same way, so it can't be used to find out
//                                                        which addresses have accounts.
//   POST /api/reset {step: 'check', email, code}         -> {token, accounts: [{id, username, role}]}
//   POST /api/reset {step: 'set', token, id, password}   the new password; that account is signed out everywhere
//   POST /api/reset {step: 'peek', token}                 -> {accounts} for a reset link emailed by the assistant
import { endSessions, getAccounts, hashPassword, json, noteFailure, randomToken, saveAccounts, tooManyFailures } from '../_lib/auth.js';
import { canSend, checkCode, cleanEmail, emailCode, overLimit, validEmail } from '../_lib/email.js';
import { sha256 } from '../_lib/keys.js';

const SENT = { ok: true, message: "If an account uses that email address, we've sent it a code." };

export async function onRequestPost({ env, request }) {
  if (!canSend(env)) return json({ error: "Password resets by email aren't set up yet. Ask the person who runs the site." }, 503);
  const body = await request.json().catch(() => ({}));
  const ip = request.headers.get('cf-connecting-ip') || 'unknown';

  if (body.step === 'send') {
    const email = cleanEmail(body.email);
    if (!validEmail(email)) return json({ error: "That doesn't look like an email address." }, 400);
    if (await overLimit(env, 'reset-ip:' + ip, 5)) return json({ error: 'Too many requests from here. Try again in an hour.' }, 429);
    const who = (await getAccounts(env)).filter(a => a.email === email && a.emailVerified);
    if (!who.length || await overLimit(env, 'reset:' + await sha256(email), 3)) return json(SENT);
    const r = await emailCode(env, 'rcode:' + await sha256(email), email, email, true);
    if (!r.ok && r.status === 503) return json({ error: r.error }, 503);
    return json(SENT);
  }

  if (body.step === 'check') {
    if (await tooManyFailures(env, request)) return json({ error: 'Too many attempts. Try again in 15 minutes.' }, 429);
    const email = cleanEmail(body.email);
    const r = await checkCode(env, 'rcode:' + await sha256(email), email, body.code);
    if (!r.ok) { await noteFailure(env, request); return json({ error: r.error }, r.status); }
    const who = (await getAccounts(env)).filter(a => a.email === email && a.emailVerified);
    const token = randomToken();
    await env.HUB_KV.put('rtok:' + token, JSON.stringify({ ids: who.map(a => a.id) }), { expirationTtl: 600 });
    return json({ token, accounts: who.map(a => ({ id: a.id, username: a.username, role: a.role })) });
  }

  if (body.step === 'peek') {
    const t = /^[0-9a-f]{64}$/.test(String(body.token)) && await env.HUB_KV.get('rtok:' + body.token, 'json');
    if (!t) return json({ error: 'This link has already been used or has run out. Use "Forgot your password?" to get a new one.' }, 400);
    const list = await getAccounts(env);
    return json({ accounts: list.filter(a => t.ids.includes(a.id)).map(a => ({ id: a.id, username: a.username, role: a.role })) });
  }

  if (body.step === 'set') {
    const t = /^[0-9a-f]{64}$/.test(String(body.token)) && await env.HUB_KV.get('rtok:' + body.token, 'json');
    if (!t) return json({ error: 'That took too long. Start again with "Forgot your password?".' }, 400);
    const password = String(body.password || '');
    if (password.length < 6) return json({ error: 'Passwords need at least 6 characters.' }, 400);
    if (password.length > 200) return json({ error: 'That password is too long.' }, 400);
    const list = await getAccounts(env);
    const a = t.ids.includes(body.id) && list.find(x => x.id === body.id);
    if (!a) return json({ error: 'Pick your account.' }, 400);
    Object.assign(a, await hashPassword(password));
    await saveAccounts(env, list);
    await env.HUB_KV.delete('rtok:' + body.token);
    await endSessions(env, s => s.accountId === a.id);
    return json({ ok: true, username: a.username });
  }

  return json({ error: 'Unknown step.' }, 400);
}
