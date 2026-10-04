// POST /api/usage {d, dev, pv: {"chemistry:question": 3, ...}}: page counts from a browser whose owner accepted usage
// statistics (the jbr_consent cookie says so). Stored per day under the random visitor number in the jbr_vid cookie,
// never with the account, and deleted after 90 days. One write per visitor every 10 minutes at most, so it stays far
// inside the free plan. The admin console adds them up (GET /api/admin/usage), reading only the keys' metadata.
import { json, readCookie } from '../_lib/auth.js';

const DAY = 86400000, KEEP = 90 * 86400;
const PAGE = /^[a-z-]{1,20}(:[a-z-]{1,20})?$/, DEVICES = ['phone', 'tablet', 'computer'];

export async function onRequestPost(ctx) {
  const consent = (readCookie(ctx.request, 'jbr_consent') || '').split('.');
  const vid = readCookie(ctx.request, 'jbr_vid') || '';
  if (consent[1] !== 's1' || !/^[a-z0-9]{16}$/.test(vid)) return json({ ok: false, reason: 'no consent' }, 202);
  const body = await ctx.request.json().catch(() => null);
  if (!body || typeof body.pv !== 'object' || !body.pv) return json({ error: 'Nothing to count.' }, 400);
  // the browser's day, if it's today or yesterday (UTC either side); otherwise today
  const today = new Date().toISOString().slice(0, 10), yesterday = new Date(Date.now() - DAY).toISOString().slice(0, 10);
  const tomorrow = new Date(Date.now() + DAY).toISOString().slice(0, 10);
  const d = [today, yesterday, tomorrow].includes(body.d) ? body.d : today;
  const dev = DEVICES.includes(body.dev) ? body.dev : 'computer';
  const add = {};
  for (const [k, n] of Object.entries(body.pv).slice(0, 60)) if (PAGE.test(k)) add[k] = Math.max(0, Math.min(500, Math.round(Number(n) || 0)));

  const key = `use:${d}:${vid}`;
  const old = (await ctx.env.HUB_KV.getWithMetadata(key)).metadata || { dev, pv: {} };
  const pv = { ...(old.pv || {}) };
  for (const [k, n] of Object.entries(add)) pv[k] = (pv[k] || 0) + n;
  // metadata is limited to 1 KB: keep the most-visited pages if it would go over
  let meta = { dev, pv };
  while (JSON.stringify(meta).length > 1000 && Object.keys(meta.pv).length) {
    const least = Object.keys(meta.pv).sort((a, b) => meta.pv[a] - meta.pv[b])[0];
    delete meta.pv[least];
  }
  await ctx.env.HUB_KV.put(key, '', { metadata: meta, expirationTtl: KEEP });
  return json({ ok: true });
}
