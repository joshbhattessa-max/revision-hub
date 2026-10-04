// The deployment log for the owner's Google Sheet (see _lib/deploylog.js):
//   GET /deploys/<key>/log.csv   every deployment, newest first (the sheet's IMPORTDATA formula reads it)
//   GET /deploys/<key>/<n>.pdf   the record of deployment n: what it included and the links to it
// They open without signing in, because Google fetches the CSV, so the key in the address is what protects them
// (only its SHA-256 is kept; admin API POST deploylog/key makes a new one). Reading the CSV also checks GitHub for
// deployments the log doesn't have yet, at most every 10 minutes.
import { csv, details, fileName, keyOk, load, maybeSync, recordPdf } from '../_lib/deploylog.js';

const HIDE = { 'x-robots-tag': 'noindex', 'cache-control': 'private, no-store' };

export async function onRequestGet(ctx) {
  const url = new URL(ctx.request.url);
  const m = url.pathname.match(/^\/deploys\/([A-Za-z0-9_-]{20,80})\/(?:log\.csv|(\d{1,6})\.pdf)$/);
  if (!m || !await keyOk(ctx.env, m[1])) return new Response('Not found', { status: 404, headers: HIDE });
  if (!m[2]) {
    await maybeSync(ctx);
    const log = await load(ctx.env);
    return new Response(csv(log, url.origin, m[1]), { headers: { ...HIDE, 'content-type': 'text/csv; charset=utf-8' } });
  }
  const log = await load(ctx.env);
  const e = log.entries.find(x => x.id === Number(m[2]));
  if (!e) return new Response('Not found', { status: 404, headers: HIDE });
  const pdf = recordPdf(log, e, await details(ctx.env, e.id), url.origin);
  return new Response(pdf, { headers: { ...HIDE, 'content-type': 'application/pdf',
    'content-disposition': `inline; filename="${fileName(e)}"` } });
}
