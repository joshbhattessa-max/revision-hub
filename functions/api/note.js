// GET /api/note: the message the admin console left for your account, if you haven't read it yet, and any update notes
// you haven't read (updates: newest first; functions/_lib/updates.js).
// POST /api/note: you've read the message, so it isn't shown again on any device (the admin console shows when you read
// it). POST /api/note {reply: '...'} also sends the answer when the message asked for one. POST /api/note {which: 'updates'}: the same for the update notes.
import { json, refreshNoteFlag } from '../_lib/auth.js';
import { saveReply } from '../_lib/replies.js';
import { markRead, unread } from '../_lib/updates.js';

export async function onRequestGet(ctx) {
  const id = ctx.data.session.accountId;
  const [note, updates] = await Promise.all([ctx.env.HUB_KV.get('note:' + id, 'json'), unread(ctx.env, id)]);
  const msg = note && !note.seen ? { title: note.title || '', logo: !!note.logo, html: note.html || '', text: note.html ? '' : note.text || '', t: note.t, ask: !!note.ask } : null;
  if (!msg && !updates.length) return json(null);
  return json({ ...(msg || {}), updates });
}

export async function onRequestPost(ctx) {
  const id = ctx.data.session.accountId;
  const body = await ctx.request.json().catch(() => ({}));
  if (body && typeof body.reply === 'string' && body.reply.trim()) {
    // the answer to a message that asked for one: kept for the admin console and emailed to the owner
    const note = await ctx.env.HUB_KV.get('note:' + id, 'json');
    if (note && note.ask && !note.seen) await saveReply(ctx.env, ctx.data.session, note, body.reply);
  }
  if (body && body.which === 'updates') await markRead(ctx.env, id);
  else {
    const note = await ctx.env.HUB_KV.get('note:' + id, 'json');
    if (note && !note.seen) {
      note.seen = Date.now();
      await ctx.env.HUB_KV.put('note:' + id, JSON.stringify(note), { metadata: { t: note.t, seen: note.seen, len: (note.html || note.text || '').length } });
    }
  }
  await refreshNoteFlag(ctx.env, id);
  return json({ ok: true });
}
