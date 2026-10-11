// POST /api/activity {k: "view" | "beat", p: path, h: hash, t: title}: sent by activity.js on every page of the main
// site and the subject sites while you're signed in. "view" is a page opened (a row in the timeline and the page
// you're on now); "beat" says the page is still open and on screen (last activity only). See functions/_lib/activity.js.
import { json } from '../_lib/auth.js';
import { db, paperOf, schema, siteOf } from '../_lib/activity.js';

const str = (v, n) => typeof v === 'string' ? v.slice(0, n) : '';

export async function onRequestPost(ctx) {
  const d = db(ctx.env), s = ctx.data.session;
  if (!d || !s) return json({ ok: false }, 202);
  const body = await ctx.request.json().catch(() => null);
  if (!body || !['view', 'beat'].includes(body.k)) return json({ error: 'Nothing to record.' }, 400);
  const path = str(body.p, 200), hash = str(body.h, 200), title = str(body.t, 200).trim();
  if (!path.startsWith('/')) return json({ error: 'Nothing to record.' }, 400);
  const site = siteOf(path), page = path + hash, now = Date.now();
  const device = (ctx.request.headers.get('user-agent') || '').slice(0, 160);
  await schema(d);
  if (body.k === 'view') {
    await d.batch([
      d.prepare('INSERT INTO events (account, username, t, site, page, title, paper, device) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
        .bind(s.accountId, s.username, now, site, page, title, paperOf(hash, title), device),
      d.prepare(`INSERT INTO presence (account, username, t, since, site, page, title, device) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT (account) DO UPDATE SET username = excluded.username, t = excluded.t, since = excluded.since, site = excluded.site,
        page = excluded.page, title = excluded.title, device = excluded.device`)
        .bind(s.accountId, s.username, now, now, site, page, title, device),
    ]);
  } else {
    // a heartbeat only moves "last active" on, unless it comes from a different page (another tab), which becomes current
    await d.prepare(`INSERT INTO presence (account, username, t, since, site, page, title, device) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT (account) DO UPDATE SET t = excluded.t,
        since = CASE WHEN presence.page = excluded.page THEN presence.since ELSE excluded.since END,
        site = excluded.site, page = excluded.page, title = CASE WHEN excluded.title = '' THEN presence.title ELSE excluded.title END,
        device = excluded.device`)
      .bind(s.accountId, s.username, now, now, site, page, title, device).run();
  }
  return json({ ok: true });
}
