// Changing an account's email address from an email to contact@ (see api/inbound.js) takes two links, so that both
// addresses agree: the first goes to the account's current (checked) address; opening it sends the second to the new
// address; opening that one makes the change. Open to everyone: the link itself is the proof.
//   POST /api/confirm {t}  -> {stage: 'sent', to} after the first link, {stage: 'done', email} after the second
import { getAccounts, json, randomToken, saveAccounts } from '../_lib/auth.js';
import { mask, sendMail } from '../_lib/email.js';

export async function onRequestPost({ env, request }) {
  const body = await request.json().catch(() => ({}));
  const t = String(body.t || '');
  const c = /^[0-9a-f]{64}$/.test(t) && await env.HUB_KV.get('mchg:' + t, 'json');
  if (!c) return json({ error: 'This link has already been used or has run out. Email contact@jbrevision.co.uk again to start over.' }, 400);
  await env.HUB_KV.delete('mchg:' + t);

  if (c.stage === 'old') {
    const t2 = randomToken();
    await env.HUB_KV.put('mchg:' + t2, JSON.stringify({ ...c, stage: 'new' }), { expirationTtl: 3600 });
    const ok = await sendMail(env, { to: c.to, subject: 'Confirm your new JB Revision email address',
      text: 'Hi,\n\nTo use this address for your JB Revision account, open this link within the next hour:\nhttps://jbrevision.co.uk/confirm?t=' + t2 +
        '\n\nIf you didn\'t ask for this, ignore this email and nothing changes.\n\n— JB Revision' });
    if (!ok) return json({ error: 'The email to the new address couldn\'t be sent. Try again later.' }, 502);
    return json({ stage: 'sent', to: mask(c.to) });
  }

  const list = await getAccounts(env);
  let n = 0;
  for (const a of list) {
    // only if the account still has the address the request came from
    if (c.ids.includes(a.id) && a.email === c.from) { a.email = c.to; a.emailVerified = Date.now(); delete a.mustVerify; n++; }
  }
  if (!n) return json({ error: 'That account\'s email address has changed since, so nothing was changed.' }, 409);
  await saveAccounts(env, list);
  return json({ stage: 'done', email: c.to });
}
