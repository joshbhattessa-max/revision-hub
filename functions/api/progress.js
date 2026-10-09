// Study progress for the signed-in account: the questions you've done (and your marks), the mock papers you've
// submitted, and the revision plan. Nothing else is kept. The subject sites keep a copy in the browser and sync it
// here, so it follows you between devices.
// Each save is merged with what's stored (newest wins, item by item), so two tabs or devices never undo each other.
import { json } from '../_lib/auth.js';

const MAX_BYTES = 600 * 1024;
const key = s => 'prog:' + s.accountId;
const blank = () => ({ v: 1, items: {}, mocks: [], plan: null, t: 0 });

function merge(a, b) {
  const out = blank();
  for (const x of [a, b]) {
    if (!x || x.v !== 1) continue;
    for (const [k, v] of Object.entries(x.items || {})) if (v && (!out.items[k] || v.t > out.items[k].t)) out.items[k] = v;
    for (const m of x.mocks || []) {
      if (!m) continue;
      const had = out.mocks.find(y => y.id === m.id);
      if (!had) out.mocks.push(m);
      else if (!had.grade && m.grade) had.grade = m.grade;   // a grade worked out later fills the gap
    }
    if (x.plan && (!out.plan || (x.plan.t || 0) > (out.plan.t || 0))) out.plan = x.plan;
    out.t = Math.max(out.t, x.t || 0);
  }
  out.mocks.sort((m, n) => m.t - n.t);
  if (out.mocks.length > 200) out.mocks = out.mocks.slice(-200);
  return out;
}

export async function onRequestGet(ctx) {
  const stored = await ctx.env.HUB_KV.get(key(ctx.data.session), 'json');
  return json(stored || blank(), 200, { 'cache-control': 'no-store' });
}

export async function onRequestPut(ctx) {
  const text = await ctx.request.text();
  if (text.length > MAX_BYTES) return json({ error: 'Your progress is too big to save. Ask Josh to have a look.' }, 413);
  let incoming;
  try { incoming = JSON.parse(text); } catch (e) { return json({ error: 'That wasn\'t valid progress data.' }, 400); }
  if (!incoming || incoming.v !== 1 || typeof incoming.items !== 'object') return json({ error: 'That wasn\'t valid progress data.' }, 400);
  const k = key(ctx.data.session);
  const merged = merge(await ctx.env.HUB_KV.get(k, 'json'), incoming);
  const out = JSON.stringify(merged);
  if (out.length > MAX_BYTES) return json({ error: 'Your progress is too big to save. Ask Josh to have a look.' }, 413);
  await ctx.env.HUB_KV.put(k, out);
  return json({ ok: true, t: merged.t });
}
