// Replies to admin messages that asked for one ("ask for a reply" ticked in the console). The answer is kept in KV
// (`reply:<accountId>:<messageTime>`, one per message, newest 300 listed) and emailed to the owner through Resend
// (_lib/email.js) from "<account name> <replies@jbrevision.co.uk>", so it reads as from that person. The email goes to
// REPLY_TO_EMAIL (a Pages variable), or contact@jbrevision.co.uk, which Cloudflare Email Routing forwards to the owner.
import { canSend, sendMail } from './email.js';

const MAX = 2000;
const TO = 'contact@jbrevision.co.uk';
const FROM_ADDR = 'replies@jbrevision.co.uk';

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
// a display name that can't break out of the From header
const display = s => String(s || 'Student').replace(/[\r\n"<>\\,;:@()]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60) || 'Student';

export async function saveReply(env, session, note, text) {
  text = String(text).trim().slice(0, MAX);
  const name = display(session.username);
  const key = session.accountId + ':' + note.t;
  const rec = { accountId: session.accountId, username: session.username, title: note.title || '', text, t: Date.now(), mailed: false };
  const subject = 'Reply from ' + name + (note.title ? ': ' + note.title : '');
  const body = `${name} replied to your message${note.title ? ' "' + note.title + '"' : ''} on JB Revision:\n\n${text}\n\n(Account: ${session.username}. Hit reply to answer by email.)`;
  const html = `<div style="font-family:Figtree,Segoe UI,Arial,sans-serif;max-width:560px;color:#33312e"><p style="margin:0 0 10px;font-size:14px;color:#6b6862">` +
    `<b>${esc(name)}</b> replied to your message${note.title ? ' “' + esc(note.title) + '”' : ''} on JB Revision:</p>` +
    `<p style="font-size:16px;line-height:1.5;white-space:pre-wrap;margin:0">${esc(text)}</p></div>`;
  if (canSend(env))
    rec.mailed = await sendMail(env, { to: env.REPLY_TO_EMAIL || TO, subject, text: body, html, from: `${name} <${FROM_ADDR}>`, replyTo: env.REPLY_TO_EMAIL || TO });
  await env.HUB_KV.put('reply:' + key, JSON.stringify(rec), { metadata: { t: rec.t } });
  return rec;
}

export async function listReplies(env) {
  const keys = [];
  let cursor;
  do {
    const page = await env.HUB_KV.list({ prefix: 'reply:', cursor });
    keys.push(...page.keys);
    cursor = page.list_complete ? null : page.cursor;
  } while (cursor);
  keys.sort((a, b) => ((b.metadata || {}).t || 0) - ((a.metadata || {}).t || 0));
  const out = [];
  for (const k of keys.slice(0, 300)) {
    const r = await env.HUB_KV.get(k.name, 'json');
    if (r) out.push({ key: k.name.slice(6), ...r });
  }
  return out;
}
