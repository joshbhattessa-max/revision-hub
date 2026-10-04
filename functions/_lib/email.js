// Emails the site sends: a 6-digit code to check an email address is yours, and one to reset a forgotten password.
// They go through Resend (resend.com). Until the Pages project has a RESEND_API_KEY secret nothing is sent, nobody is
// asked to check an address and "Forgot your password?" stays hidden, so the site works exactly as before.
import { sha256 } from './keys.js';

export const canSend = env => !!(env && env.RESEND_API_KEY);
const FROM = 'JB Revision <no-reply@jbrevision.co.uk>';
const REPLY_TO = 'contact@jbrevision.co.uk';
const DAILY = 90;              // Resend's free plan sends 100 emails a day: leave some room
export const CODE_SECONDS = 900; // a code works for 15 minutes
const TRIES = 5;               // wrong guesses before a code stops working

export const cleanEmail = s => String(s || '').trim().toLowerCase();
export const validEmail = e => e.length <= 254 && /^[^\s@<>()",;:]+@[^\s@<>()",;:]+\.[a-z]{2,}$/i.test(e);
// "j•••a@gmail.com": enough to recognise your own address, not enough to read someone else's
export function mask(e) {
  const [u, d] = String(e).split('@');
  return u.slice(0, 1) + '•••' + (u.length > 2 ? u.slice(-1) : '') + '@' + d;
}

function newCode() {
  const a = new Uint32Array(1);
  crypto.getRandomValues(a);
  return String(a[0] % 1000000).padStart(6, '0');
}
const codeHash = (salt, code) => sha256(salt + ':' + String(code || '').replace(/\D/g, ''));

// at most `max` of something per `key` per hour, or per `seconds` (codes per account, resets per address...)
export async function overLimit(env, key, max, seconds = 3600) {
  const n = parseInt(await env.HUB_KV.get('elimit:' + key) || '0', 10);
  if (n >= max) return true;
  await env.HUB_KV.put('elimit:' + key, String(n + 1), { expirationTtl: seconds });
  return false;
}

// the whole site's emails for today, so a flood of requests can't use up the free plan
const today = () => 'emails:' + new Date().toISOString().slice(0, 10);
async function spentToday(env) { return parseInt(await env.HUB_KV.get(today()) || '0', 10) >= DAILY; }
async function spend(env) {
  const k = today();
  const n = parseInt(await env.HUB_KV.get(k) || '0', 10);
  if (n >= DAILY) return false;
  await env.HUB_KV.put(k, String(n + 1), { expirationTtl: 2 * 86400 });
  return true;
}

async function send(env, to, code, reset) {
  const what = reset ? 'reset your password' : 'check this is your email address';
  const subject = reset ? `${code} is your JB Revision password reset code` : `${code} is your JB Revision code`;
  const text = `Your JB Revision code is ${code}\n\nType it in to ${what}. It works for 15 minutes.\n\n` +
    `If you didn't ask for this, you can ignore this email: nothing changes unless the code is typed in.\n\nJB Revision · jbrevision.co.uk`;
  const html = `<div style="font-family:Inter,Segoe UI,Arial,sans-serif;max-width:420px;margin:0 auto;padding:24px;color:#33312e">` +
    `<p style="font-size:15px;margin:0 0 6px">Your JB Revision code is</p>` +
    `<p style="font-size:32px;font-weight:700;letter-spacing:6px;margin:0 0 14px">${code}</p>` +
    `<p style="font-size:15px;line-height:1.5;margin:0 0 14px">Type it in to ${what}. It works for 15 minutes.</p>` +
    `<p style="font-size:13px;line-height:1.5;color:#6b6862;margin:0">If you didn't ask for this, you can ignore this email: nothing changes unless the code is typed in.</p>` +
    `<p style="font-size:13px;color:#6b6862;margin:18px 0 0">JB Revision · <a href="https://jbrevision.co.uk" style="color:#6b6862">jbrevision.co.uk</a></p></div>`;
  return sendMail(env, { to, subject, text, html });
}

// any email from the site (codes, the assistant's replies, notes to the owner); counts towards the daily budget
export async function sendMail(env, { to, subject, text, html, from, replyTo, headers }) {
  if (!canSend(env)) return false;
  if (!await spend(env)) return false;
  try {
    const r = await fetch((env.RESEND_API_URL || 'https://api.resend.com') + '/emails', {
      method: 'POST',
      headers: { authorization: 'Bearer ' + env.RESEND_API_KEY, 'content-type': 'application/json' },
      body: JSON.stringify({ from: from || env.MAIL_FROM || FROM, to: [to], reply_to: replyTo || REPLY_TO, subject, text,
        html: html || plainHtml(text), ...(headers ? { headers } : {}) }),
    });
    return r.ok;
  } catch (e) {
    return false;
  }
}

// a plain-text email as simple HTML (links to the site stay clickable)
export function plainHtml(text) {
  const esc = String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/(https:\/\/jbrevision\.co\.uk[^\s<]*)/g, '<a href="$1" style="color:#33312e">$1</a>');
  return '<div style="font-family:Inter,Segoe UI,Arial,sans-serif;max-width:560px;font-size:15px;line-height:1.55;color:#33312e;white-space:pre-wrap">' + esc + '</div>';
}

// email a new code to `email` and keep its hash (never the code) under `key` for 15 minutes; `salt` ties the hash to
// one account or address. Returns {ok} or {error, status}.
export async function emailCode(env, key, salt, email, reset = false) {
  if (await spentToday(env)) return { error: 'The site has sent all the emails it can for today. Try again tomorrow.', status: 503 };
  const code = newCode();
  if (!await send(env, email, code, reset)) return { error: "The email couldn't be sent. Check the address and try again.", status: 502 };
  await env.HUB_KV.put(key, JSON.stringify({ email, hash: await codeHash(salt, code), tries: 0, at: Date.now() }), { expirationTtl: CODE_SECONDS });
  return { ok: true };
}

// check a typed code against the one kept under `key`; a code works once, for 15 minutes and 5 tries.
// Returns {ok, email} or {error, status}.
export async function checkCode(env, key, salt, code) {
  const p = await env.HUB_KV.get(key, 'json');
  if (!p || Date.now() - p.at > CODE_SECONDS * 1000) return { error: 'That code has run out. Ask for a new one.', status: 400 };
  if (await codeHash(salt, code) === p.hash) {
    await env.HUB_KV.delete(key);
    return { ok: true, email: p.email };
  }
  p.tries++;
  if (p.tries >= TRIES) {
    await env.HUB_KV.delete(key);
    return { error: 'Too many wrong codes. Ask for a new one.', status: 429 };
  }
  const left = Math.max(60, Math.ceil((p.at + CODE_SECONDS * 1000 - Date.now()) / 1000));
  await env.HUB_KV.put(key, JSON.stringify(p), { expirationTtl: left });
  return { error: "That code isn't right. Check the email and try again.", status: 400 };
}

// when the last code was sent under `key` (for "send a new code"), and to which address (only ever shown to the
// person who typed it in)
export async function lastCode(env, key) {
  const p = await env.HUB_KV.get(key, 'json');
  return p && Date.now() - p.at < CODE_SECONDS * 1000 ? { to: mask(p.email), email: p.email, at: p.at } : null;
}
