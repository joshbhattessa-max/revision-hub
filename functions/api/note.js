// GET /api/note: the message the admin console left for your account, if you haven't read it yet.
// POST /api/note: you've read it, so it isn't shown again on any device (the admin console shows when you read it).
import { json, setNoteFlag } from '../_lib/auth.js';

export async function onRequestGet(ctx) {
  const id = ctx.data.session.accountId;
  const note = await ctx.env.HUB_KV.get('note:' + id, 'json');
  return json(note && !note.seen ? { text: note.text, t: note.t } : null);
}

export async function onRequestPost(ctx) {
  const id = ctx.data.session.accountId;
  const note = await ctx.env.HUB_KV.get('note:' + id, 'json');
  if (note && !note.seen) {
    note.seen = Date.now();
    await ctx.env.HUB_KV.put('note:' + id, JSON.stringify(note), { metadata: { t: note.t, seen: note.seen, len: note.text.length } });
  }
  await setNoteFlag(ctx.env, id, false);
  return json({ ok: true });
}
