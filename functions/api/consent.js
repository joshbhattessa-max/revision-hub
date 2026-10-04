// POST /api/consent {stats, v}: a record of your cookie choice with your account (signed-in users only; the choice
// itself lives in the jbr_consent cookie). Kept until the account is deleted.
import { json } from '../_lib/auth.js';

export async function onRequestPost(ctx) {
  const body = await ctx.request.json().catch(() => null);
  if (!body || typeof body.stats !== 'boolean') return json({ error: 'Send your choice.' }, 400);
  const s = ctx.data.session;
  if (!s.accountId || String(s.accountId).startsWith('key:')) return json({ ok: true });
  const rec = { stats: body.stats, v: Number(body.v) || 1, t: Date.now() };
  await ctx.env.HUB_KV.put('consent:' + s.accountId, JSON.stringify(rec), { metadata: rec });
  return json({ ok: true });
}
