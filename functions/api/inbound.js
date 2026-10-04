// Emails to contact@jbrevision.co.uk arrive here from the jbr-mail Worker (mail-worker/), which Cloudflare Email Routing
// hands them to. Every email is logged (KV "mail:…", kept a year, shown in the admin console's Inbox tab). The assistant
// (_lib/assistant.js) works out what the sender wants, then fixed rules decide what happens:
//   - plain questions about the site: answered from the site's facts
//   - forgotten password or username, change of email, deleting an account: only for a sender whose address is the
//     checked email of an account, and only ever by emailing that same address (a reset link, a link to confirm the
//     change from the old address, then the new one), so a forged "From" can't take over an account
//   - bugs, complaints, data requests, anything unclear, or a sender with no checked account: a short "passed on"
//     reply, and an email to the owner with a summary (Reply goes straight to the sender)
//   - spam, automatic emails and our own: logged only
// Requests must carry the shared MAIL_SECRET (a secret on both the Pages project and the Worker).
import { getAccounts, json, randomToken } from '../_lib/auth.js';
import { readEmail, newPart } from '../_lib/mime.js';
import { readIntent } from '../_lib/assistant.js';
import { canSend, cleanEmail, overLimit, sendMail, validEmail } from '../_lib/email.js';

const SITE = 'https://jbrevision.co.uk';
const KEEP = 365 * 86400;          // the log keeps each email for a year
const PER_SENDER = 5;              // automatic replies to one address a day
const LINK_SECONDS = 3600;         // reset and change-of-email links work for an hour
const FOOT = '\n\n— JB Revision\'s automatic assistant. Reply to this email if you need a person.';

function same(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

export async function onRequestPost(ctx) {
  const { env, request } = ctx;
  if (!env.MAIL_SECRET) return json({ error: 'Not set up.' }, 503);
  if (!same(request.headers.get('x-mail-secret') || '', env.MAIL_SECRET)) return json({ error: 'No.' }, 401);
  const owner = cleanEmail(request.headers.get('x-owner'));
  const mail = readEmail(new Uint8Array(await request.arrayBuffer()));
  mail.from = mail.from || cleanEmail(request.headers.get('x-mail-from'));
  const at = Date.now();
  const entry = { at, from: mail.from, name: mail.fromName, to: cleanEmail(request.headers.get('x-mail-to')), subject: mail.subject.slice(0, 300),
    text: mail.text.slice(0, 20000), intent: '', summary: '', outcome: '', replies: [], toOwner: false };

  try {
    await handle(env, mail, entry, owner);
  } catch (e) {
    // whatever went wrong, the owner still hears about it
    entry.outcome = 'error';
    entry.error = String(e && e.message || e).slice(0, 300);
    if (!entry.toOwner) await tellOwner(env, owner, mail, entry, 'The assistant hit a problem with this email: ' + entry.error);
  }
  await log(env, entry);
  return json({ ok: true, outcome: entry.outcome, toOwner: entry.toOwner });
}

async function handle(env, mail, entry, owner) {
  const h = mail.headers;
  // automatic mail, mailing lists, bounces and our own messages: never answer (that's how email loops start)
  const robot = /^(mailer-daemon|postmaster|no-?reply|do-?not-?reply|bounces?)[@+.-]/i.test(mail.from) || /@(.+\.)?jbrevision\.co\.uk$/i.test(mail.from) ||
    (h.get('auto-submitted') && !/^no\b/i.test(h.get('auto-submitted'))) || /bulk|junk|list/i.test(h.get('precedence') || '') || h.has('list-id') || h.has('list-unsubscribe');
  if (!mail.from || robot) { entry.intent = 'automatic'; entry.summary = 'An automatic email (no reply sent).'; entry.outcome = 'ignored'; return; }

  const r = await readIntent(env, { from: mail.from, subject: mail.subject, text: newPart(mail.text) });
  Object.assign(entry, { intent: r.intent, summary: r.summary, confidence: r.confidence, by: r.by });
  if (r.intent === 'spam' && r.confidence >= 0.6) { entry.outcome = 'ignored'; return; }

  // too many automatic replies to this address today: log it and let the owner decide
  if (await overLimit(env, 'mail-reply:' + mail.from, PER_SENDER, 86400)) {
    if (await overLimit(env, 'mail-told:' + mail.from, 1, 86400)) { entry.outcome = 'ignored'; entry.summary += ' (over today\'s limit for this address)'; return; }
    entry.outcome = 'to-owner';
    await tellOwner(env, owner, mail, entry, 'This address has had ' + PER_SENDER + ' automatic replies today, so the assistant has stopped answering it until tomorrow. Further emails from it today are only logged (admin console → Inbox).');
    return;
  }

  const mine = (await getAccounts(env)).filter(a => a.email === mail.from && a.emailVerified);
  const names = mine.map(a => a.username + (a.role === 'admin' ? ' (admin)' : '')).join(', ');
  const noAccount = 'There isn\'t an account with this email address checked on it, so I can\'t change anything from here. If you can still sign in, add your email address from the menu under your name on the home page. ';

  if (r.intent === 'password' || r.intent === 'username') {
    if (mine.length) {
      const link = await resetLink(env, mine);
      entry.outcome = 'sent-reset-link';
      await reply(env, mail, entry, (r.intent === 'username' ? 'Your username' + (mine.length > 1 ? 's are: ' : ' is: ') + names + '.\n\n' : '') +
        'To choose a new password, open this link within the next hour (it works once):\n' + link +
        '\n\nIf you didn\'t ask for this, you can ignore this email: nothing changes unless the link is used.');
      return;
    }
    entry.outcome = 'to-owner';
    await reply(env, mail, entry, noAccount + 'I\'ve passed your email to Josh, who runs the site, to sort out.');
    await tellOwner(env, owner, mail, entry, 'Asked for password or username help, but no account has this address checked. You can reset the password in the admin console (Accounts).');
    return;
  }

  if (r.intent === 'change_email') {
    // the new address the assistant found, or else the first other address written in the email
    const written = (newPart(mail.text).match(/[^\s<>"',;:()\[\]]+@[^\s<>"',;:()\[\]]+\.[a-z]{2,}/gi) || []).map(cleanEmail);
    const to = [cleanEmail(r.newEmail), ...written].find(e => validEmail(e) && e !== mail.from) || '';
    if (mine.length && validEmail(to) && to !== mail.from) {
      const t = randomToken();
      await env.HUB_KV.put('mchg:' + t, JSON.stringify({ stage: 'old', ids: mine.map(a => a.id), from: mail.from, to }), { expirationTtl: LINK_SECONDS });
      entry.outcome = 'sent-email-change-link';
      await reply(env, mail, entry, 'To change the email address on ' + names + ' to ' + to + ', open this link within the next hour:\n' + SITE + '/confirm?t=' + t +
        '\n\nThen we\'ll email ' + to + ' a second link, to check that address is yours too. If you didn\'t ask for this, ignore this email and nothing changes.');
      return;
    }
    entry.outcome = 'answered';
    await reply(env, mail, entry, mine.length ? 'I couldn\'t find the new email address in your message. Reply with just the new address, or sign in and use "Change email" in the menu under your name.'
      : noAccount + 'Once you\'re signed in, "Change email" in that menu changes it.');
    return;
  }

  if (r.intent === 'delete_account') {
    if (mine.length) {
      const link = await resetLink(env, mine);
      entry.outcome = 'answered';
      await reply(env, mail, entry, 'You can delete ' + names + ' yourself: sign in, open the menu under your name at the top right of the home page and choose "Delete account". It deletes the account and all its progress straight away.\n\n' +
        'If you can\'t sign in, this link lets you choose a new password first (it works once, for the next hour):\n' + link);
      return;
    }
    entry.outcome = 'to-owner';
    await reply(env, mail, entry, 'You can delete your account yourself: sign in, open the menu under your name at the top right of the home page and choose "Delete account". If you can\'t sign in, I\'ve passed your email to Josh, who runs the site, to delete it for you.');
    await tellOwner(env, owner, mail, entry, 'Asked for an account to be deleted, but no account has this address checked, so they may need you to do it (admin console → Accounts).');
    return;
  }

  if (r.intent === 'question' && r.reply && r.confidence >= 0.6 && !r.needsHuman) {
    entry.outcome = 'answered';
    await reply(env, mail, entry, r.reply);
    return;
  }

  // a bug, a complaint, something unclear or anything the facts don't cover: a person is needed
  entry.outcome = 'to-owner';
  const status = r.intent === 'bug' ? await siteCheck() : '';
  await reply(env, mail, entry, 'Thanks for your email. I\'ve passed it to Josh, who runs the site, and you\'ll get a reply as soon as possible.' +
    (r.intent === 'bug' ? ' ' + status.forSender : ''));
  await tellOwner(env, owner, mail, entry, r.intent === 'bug' ? 'Reported a problem. ' + status.forOwner : 'The assistant couldn\'t answer this one itself.');
}

async function resetLink(env, accounts) {
  const t = randomToken();
  await env.HUB_KV.put('rtok:' + t, JSON.stringify({ ids: accounts.map(a => a.id) }), { expirationTtl: LINK_SECONDS });
  return SITE + '/login?reset=' + t;
}

// is the site up right now? (for "the site's broken" emails)
async function siteCheck() {
  try {
    const s = await (await fetch(SITE + '/api/status', { cf: { cacheTtl: 0 } })).json();
    return s.maintenance ? { forSender: 'The site is being updated right now and will be back in a few minutes.', forOwner: 'The site was in maintenance when it arrived.' }
      : { forSender: '', forOwner: 'The site was up when it arrived.' };
  } catch (e) {
    return { forSender: '', forOwner: 'The site didn\'t answer when it arrived.' };
  }
}

async function reply(env, mail, entry, text) {
  const to = mail.replyTo && validEmail(mail.replyTo) && entry.outcome !== 'sent-reset-link' && entry.outcome !== 'sent-email-change-link' ? mail.replyTo : mail.from;
  const body = (mail.fromName ? 'Hi ' + mail.fromName.split(/\s+/)[0] + ',\n\n' : 'Hi,\n\n') + text + FOOT;
  const refs = [mail.references, mail.messageId].filter(Boolean).join(' ');
  const ok = await sendMail(env, { to, subject: /^re:/i.test(mail.subject) ? mail.subject : 'Re: ' + (mail.subject || 'your email'), text: body,
    from: 'JB Revision <contact@jbrevision.co.uk>', headers: mail.messageId ? { 'In-Reply-To': mail.messageId, References: refs } : undefined });
  // links aren't kept in the log, so the log can't be used to take over an account
  entry.replies.push({ to, ok, text: body.replace(/https:\/\/jbrevision\.co\.uk\/(login\?reset|confirm\?t)=[0-9a-f]+/g, '[one-time link]') });
}

async function tellOwner(env, owner, mail, entry, why) {
  entry.toOwner = true;
  if (!owner || !canSend(env)) return;
  const text = why + '\n\nFrom: ' + (mail.fromName ? mail.fromName + ' <' + mail.from + '>' : mail.from) + '\nSubject: ' + (mail.subject || '(none)') +
    '\nWhat they want: ' + (entry.summary || '?') + '\n' + (entry.replies.length ? '\nThe assistant replied:\n' + entry.replies.map(r => r.text).join('\n---\n') + '\n' : '') +
    '\nPress Reply to answer them directly. Every email is also in the admin console: ' + SITE + '/admin (Inbox).\n\n——— Their email ———\n\n' + mail.text.slice(0, 8000);
  const ok = await sendMail(env, { to: owner, subject: 'Needs you: ' + (mail.subject || 'an email to contact@'), text,
    from: 'JB Revision assistant <assistant@jbrevision.co.uk>', replyTo: mail.replyTo || mail.from });
  entry.ownerEmailed = ok;
}

async function log(env, entry) {
  const key = 'mail:' + String(9999999999999 - entry.at).padStart(13, '0') + ':' + randomToken(3);
  const meta = { at: entry.at, from: entry.from, subject: entry.subject.slice(0, 80), intent: entry.intent, outcome: entry.outcome, toOwner: entry.toOwner };
  await env.HUB_KV.put(key, JSON.stringify(entry), { expirationTtl: KEEP, metadata: meta });
}
