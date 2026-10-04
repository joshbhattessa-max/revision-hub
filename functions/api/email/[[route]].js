// The signed-in person's email address: they add (or change) it by typing in a 6-digit code emailed to it.
// New accounts have to do this before they can use the site (see _middleware.js); older ones are only reminded.
//   GET  /api/email/status   {email, verified, mustVerify, canSend, sent: {to, at} | null}
//   POST /api/email/send     {email}   emails a code (one every 30 seconds, 5 an hour)
//   POST /api/email/verify   {code}    the code from the email (works once, for 15 minutes and 5 tries)
import { clearVerifyFlag, getAccounts, json, saveAccounts } from '../../_lib/auth.js';
import { canSend, checkCode, cleanEmail, emailCode, lastCode, mask, overLimit, validEmail } from '../../_lib/email.js';

export async function onRequest(ctx) {
  const { env, request, params, data } = ctx;
  const s = data.session, route = (params.route || []).join('/'), method = request.method;
  if (s.viaKey) return json({ error: 'Sign in with your password to change your email address.' }, 403);
  const list = await getAccounts(env);
  const a = list.find(x => x.id === s.accountId);
  if (!a) return json({ error: 'This account no longer exists.' }, 404);
  const key = 'ecode:' + a.id;

  if (route === 'status' && method === 'GET') {
    // checked on another device: this one can carry on too
    if (s.mustVerify && !a.mustVerify) await clearVerifyFlag(env, a.id);
    return json({ email: a.email || '', verified: !!a.emailVerified, mustVerify: !!a.mustVerify, canSend: canSend(env), sent: await lastCode(env, key) });
  }

  if (route === 'send' && method === 'POST') {
    if (!canSend(env)) return json({ error: "Emails aren't set up on this site yet." }, 503);
    const body = await request.json().catch(() => ({}));
    const email = cleanEmail(body.email);
    if (!validEmail(email)) return json({ error: "That doesn't look like an email address." }, 400);
    const last = await lastCode(env, key);
    if (last && Date.now() - last.at < 30000) return json({ error: 'Wait a few seconds before asking for another code.' }, 429);
    if (await overLimit(env, 'acct:' + a.id, 5)) return json({ error: 'Too many codes for now. Try again in an hour.' }, 429);
    const r = await emailCode(env, key, a.id, email);
    if (!r.ok) return json({ error: r.error }, r.status);
    return json({ ok: true, to: mask(email) });
  }

  if (route === 'verify' && method === 'POST') {
    const body = await request.json().catch(() => ({}));
    const r = await checkCode(env, key, a.id, body.code);
    if (!r.ok) return json({ error: r.error }, r.status);
    a.email = r.email;
    a.emailVerified = Date.now();
    delete a.mustVerify;
    await saveAccounts(env, list);
    await clearVerifyFlag(env, a.id);
    return json({ ok: true, email: a.email });
  }

  return json({ error: 'Not found.' }, 404);
}
