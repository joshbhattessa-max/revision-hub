// Shared mock papers: a handed-in mock gets a 6-character code (like a Quizlet Live code) that anyone signed in can
// type on a subject's Mock paper page to sit the same questions. The code shows who shared it and, only if they
// ticked the box, the score they got. Codes last a year. Only the paper's questions (no answers) and that score are kept.
//   POST /api/share {id, s, board, qual, total, minutes, from, items, showScore, got, max, pct, grade} -> {code}
//     (sharing the same mock again gives the same code, and updates whether the score shows)
//   GET  /api/share?code=ABC123 -> {code, by, s, board, qual, total, minutes, from, items, score?, mine}
// Leaderboard: everyone who hands in a mock sat from a code is listed against that code (best attempt each), as is the
// sharer if they chose to show their score. Banned and deleted accounts are left out when it's read.
//   POST /api/share {board: true, code, got, max, pct, grade} -> {ok}
//   GET  /api/share?code=ABC123&board=1 -> {code, rows: [{by, got, max, pct, grade, t, me}]} best first
import { json, getAccounts } from '../_lib/auth.js';

// no 0/O, 1/I/L, so a code read off a phone or a board can't be mistyped
const ABC = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const TTL = 365 * 86400;
const MAX_BYTES = 16 * 1024;
const PER_DAY = 30;
const norm = c => String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
const ok = c => c.length === 6 && [...c].every(ch => ABC.includes(ch));

function newCode() {
  const b = crypto.getRandomValues(new Uint8Array(6));
  return [...b].map(x => ABC[x % ABC.length]).join('');
}

const rowKey = (code, id) => 'board:' + code + ':' + id;

async function putRow(kv, code, s, sc) {
  const key = rowKey(code, s.accountId), old = (await kv.getWithMetadata(key)).metadata;
  if (old && old.pct > sc.pct) return;   // keeps the best attempt
  await kv.put(key, '1', { expirationTtl: TTL, metadata: { by: s.username, got: sc.got, max: sc.max, pct: sc.pct, grade: sc.grade, t: Date.now() } });
}

async function board(ctx, code) {
  const kv = ctx.env.HUB_KV, me = ctx.data.session.accountId;
  if (!await kv.get('share:' + code)) return json({ error: 'There\'s no mock with that code.' }, 404);
  const prefix = 'board:' + code + ':', keys = [];
  let cursor;
  do {
    const r = await kv.list({ prefix, cursor });
    keys.push(...r.keys); cursor = r.list_complete ? null : r.cursor;
  } while (cursor && keys.length < 1000);
  const live = new Map((await getAccounts(ctx.env)).filter(a => !a.banned).map(a => [a.id, a]));
  const rows = keys.map(k => ({ id: k.name.slice(prefix.length), m: k.metadata })).filter(r => r.m && live.has(r.id))
    .sort((a, b) => b.m.pct - a.m.pct || a.m.t - b.m.t)
    .map(r => ({ by: live.get(r.id).username, got: r.m.got, max: r.m.max, pct: r.m.pct, grade: r.m.grade, t: r.m.t, me: r.id === me }));
  return json({ code, rows: rows.slice(0, 100), n: rows.length });
}

async function postBoard(ctx, b) {
  const code = norm(b.code), s = ctx.data.session;
  const sh = ok(code) && await ctx.env.HUB_KV.get('share:' + code, 'json');
  if (!sh) return json({ error: 'There\'s no mock with that code.' }, 404);
  const got = Number(b.got), max = Number(b.max);
  if (!(max > 0 && max <= 400 && got >= 0 && got <= max)) return json({ error: 'That score wasn\'t right.' }, 400);
  if (sh.owner !== s.accountId) await putRow(ctx.env.HUB_KV, code, s, { got, max, pct: got / max, grade: b.grade ? String(b.grade).slice(0, 4) : null });
  return json({ ok: true });
}

export async function onRequestGet(ctx) {
  const q = new URL(ctx.request.url).searchParams, code = norm(q.get('code'));
  if (ok(code) && q.get('board')) return board(ctx, code);
  if (!ok(code)) return json({ error: 'A code is 6 letters and numbers.' }, 400);
  const sh = await ctx.env.HUB_KV.get('share:' + code, 'json');
  if (!sh) return json({ error: 'There\'s no mock with that code. Check it and try again.' }, 404);
  const out = { code, by: sh.by, s: sh.s, board: sh.board, qual: sh.qual, total: sh.total, minutes: sh.minutes, from: sh.from, items: sh.items, t: sh.t,
    mine: sh.owner === ctx.data.session.accountId };
  if (sh.showScore && sh.score) out.score = sh.score;
  return json(out);
}

export async function onRequestPost(ctx) {
  const s = ctx.data.session, kv = ctx.env.HUB_KV;
  const text = await ctx.request.text();
  if (text.length > MAX_BYTES) return json({ error: 'That mock is too big to share.' }, 413);
  let b;
  try { b = JSON.parse(text); } catch (e) { return json({ error: 'That wasn\'t a mock paper.' }, 400); }
  if (b && b.board === true) return postBoard(ctx, b);
  const items = Array.isArray(b && b.items) ? b.items.slice(0, 80).map(x => {
    const it = { q: String(x && x.q || '').slice(0, 120) };
    if (Array.isArray(x.p)) it.p = x.p.slice(0, 30).map(k => String(k).slice(0, 20));
    if (Number.isFinite(x.mk)) it.mk = x.mk;
    return it;
  }).filter(x => x.q) : [];
  if (!b || typeof b.id !== 'string' || !/^[a-z]+(-[a-z]+)*$/.test(b.s || '') || !items.length) return json({ error: 'That wasn\'t a mock paper.' }, 400);
  const mineKey = 'shared:' + s.accountId + ':' + b.id.slice(0, 40);
  let code = await kv.get(mineKey), old = code ? await kv.get('share:' + code, 'json') : null;
  if (!old) {
    const day = 'sharecount:' + s.accountId + ':' + new Date().toISOString().slice(0, 10);
    const n = +(await kv.get(day)) || 0;
    if (n >= PER_DAY) return json({ error: 'You\'ve shared ' + PER_DAY + ' mocks today. Try again tomorrow.' }, 429);
    await kv.put(day, String(n + 1), { expirationTtl: 2 * 86400 });
    for (let i = 0; i < 5 && (!code || await kv.get('share:' + code)); i++) code = newCode();
  }
  const num = v => Number.isFinite(v) ? v : null;
  const sh = {
    owner: s.accountId, by: s.username, t: old ? old.t : Date.now(), s: String(b.s).slice(0, 30), board: String(b.board || '').slice(0, 40), qual: String(b.qual || '').slice(0, 40),
    total: num(b.total), minutes: num(b.minutes), from: String(b.from || '').slice(0, 160), items,
    showScore: !!b.showScore, score: num(b.got) != null && num(b.max) ? { got: b.got, max: b.max, pct: num(b.pct), grade: b.grade ? String(b.grade).slice(0, 4) : null } : null
  };
  await kv.put('share:' + code, JSON.stringify(sh), { expirationTtl: TTL });
  if (!old) await kv.put(mineKey, code, { expirationTtl: TTL });
  if (sh.showScore && sh.score) await putRow(kv, code, s, { ...sh.score, pct: sh.score.pct ?? sh.score.got / sh.score.max });
  else await kv.delete(rowKey(code, s.accountId));
  return json({ code });
}
