// Past papers (the subject sites' Papers tab, and every "Original paper" / "Mark scheme" link): served from this site at
// /papers/<host>/<path>, e.g. /papers/pmt.physicsandmathstutor.com/download/Chemistry/.../June%202024%20QP.pdf.
//
// Where the PDF comes from:
//   - with an R2 bucket bound as PAPERS (Pages project → Settings → Bindings → R2 bucket, variable name PAPERS), and the
//     admin console's papers switch on "host": from the bucket. A paper that isn't in it yet is copied in from where it
//     was found the first time anyone opens it (or all at once with the admin console's "copy every paper now").
//   - otherwise (no bucket, or the switch on "link"): a redirect to the place it was found, as before.
// Only the hosts below are ever fetched, so the address can't be used to fetch anything else.
export const HOSTS = ['pmt.physicsandmathstutor.com', 'qualifications.pearson.com', 'cdn.sanity.io', 'www.ocr.org.uk',
  'filestore.aqa.org.uk', 'www.aqa.org.uk', 'cdn.savemyexams.com'];
const MODE_KEY = 'papers:mode';
const MAX_BYTES = 60 * 1024 * 1024;

let modeCache = null, modeAt = 0;
export async function papersMode(env) {
  if (modeCache && Date.now() - modeAt < 30000) return modeCache;
  modeCache = (await env.HUB_KV.get(MODE_KEY)) === 'link' ? 'link' : 'host';
  modeAt = Date.now();
  return modeCache;
}
export async function setPapersMode(env, mode) {
  await env.HUB_KV.put(MODE_KEY, mode === 'link' ? 'link' : 'host');
  modeCache = null;
}

// /papers/<host>/<path> -> { host, key, source } or null. The key is the decoded path, so the same file always has one key
// however the address was spelled; the source keeps the address's own spelling.
export function parsePaper(pathname) {
  const m = /^\/papers\/([a-z0-9.-]+)(\/.+)$/i.exec(pathname);
  if (!m || !HOSTS.includes(m[1].toLowerCase())) return null;
  let decoded;
  try { decoded = decodeURIComponent(m[2]); } catch (e) { return null; }
  if (decoded.includes('..') || !/\.pdf$/i.test(decoded)) return null;
  const host = m[1].toLowerCase();
  return { host, key: host + decoded, source: 'https://' + host + m[2] };
}

function fileName(key) {
  return key.split('/').pop().replace(/[^\w .()&-]/g, '_') || 'paper.pdf';
}

function pdfHeaders(key, obj) {
  const h = new Headers({
    'content-type': 'application/pdf',
    'content-disposition': 'inline; filename="' + fileName(key) + '"',
    'cache-control': 'private, max-age=604800',
    'x-robots-tag': 'noindex, nofollow',
    'accept-ranges': 'bytes',
  });
  if (obj && obj.httpEtag) h.set('etag', obj.httpEtag);
  return h;
}

// copy one paper into the bucket from where it was found; true if it's there afterwards
export async function copyPaper(env, p) {
  const have = await env.PAPERS.head(p.key);
  if (have) return { ok: true, size: have.size, had: true };
  const r = await fetch(p.source, { headers: { 'user-agent': 'Mozilla/5.0 (compatible; JBRevision papers)' }, redirect: 'follow' });
  if (!r.ok) return { ok: false, status: r.status };
  const len = Number(r.headers.get('content-length')) || 0;
  if (len > MAX_BYTES) return { ok: false, status: 413 };
  const buf = await r.arrayBuffer();
  // only real PDFs go in (a site's "not found" page sometimes comes back as 200)
  const head = new Uint8Array(buf, 0, Math.min(1024, buf.byteLength));
  if (!String.fromCharCode(...head).includes('%PDF-')) return { ok: false, status: 415 };
  await env.PAPERS.put(p.key, buf, { httpMetadata: { contentType: 'application/pdf' }, customMetadata: { source: p.source, copied: String(Date.now()) } });
  return { ok: true, size: buf.byteLength };
}

function rangeOf(request) {
  const m = /^bytes=(\d*)-(\d*)$/.exec(request.headers.get('range') || '');
  if (!m || (m[1] === '' && m[2] === '')) return null;
  if (m[1] === '') return { suffix: Number(m[2]) };
  return m[2] === '' ? { offset: Number(m[1]) } : { offset: Number(m[1]), length: Number(m[2]) - Number(m[1]) + 1 };
}

export async function servePaper(ctx) {
  const { env, request } = ctx;
  const url = new URL(request.url);
  const p = parsePaper(url.pathname);
  if (!p) return new Response('Not a past paper this site knows about.', { status: 404, headers: { 'content-type': 'text/plain; charset=utf-8' } });
  if (!env.PAPERS || await papersMode(env) === 'link') {
    return new Response(null, { status: 302, headers: { location: p.source, 'cache-control': 'private, max-age=300' } });
  }
  const range = rangeOf(request);
  let obj = await env.PAPERS.get(p.key, range ? { range } : {});
  if (!obj) {
    const c = await copyPaper(env, p).catch(() => ({ ok: false }));
    // couldn't copy it (the source is down or moved it): send them to the source rather than a dead end
    if (!c.ok) return new Response(null, { status: 302, headers: { location: p.source, 'cache-control': 'no-store' } });
    obj = await env.PAPERS.get(p.key, range ? { range } : {});
    if (!obj) return new Response(null, { status: 302, headers: { location: p.source, 'cache-control': 'no-store' } });
  }
  const h = pdfHeaders(p.key, obj);
  if (request.method === 'HEAD') { h.set('content-length', String(obj.size)); return new Response(null, { headers: h }); }
  if (range && obj.range) {
    const off = obj.range.offset !== undefined ? obj.range.offset : obj.size - obj.range.suffix;
    const len = obj.range.length !== undefined ? obj.range.length : obj.size - off;
    h.set('content-range', `bytes ${off}-${off + len - 1}/${obj.size}`);
    h.set('content-length', String(len));
    return new Response(obj.body, { status: 206, headers: h });
  }
  h.set('content-length', String(obj.size));
  return new Response(obj.body, { headers: h });
}

// for the admin console: how many papers are in the bucket and how big they are (lists the whole bucket, ~13 calls)
export async function papersState(env) {
  const out = { bucket: !!env.PAPERS, mode: await papersMode(env), count: 0, bytes: 0 };
  if (!env.PAPERS) return out;
  let cursor;
  for (let i = 0; i < 40; i++) {
    const l = await env.PAPERS.list({ cursor, limit: 1000 });
    for (const o of l.objects) { out.count++; out.bytes += o.size; }
    if (!l.truncated) break;
    cursor = l.cursor;
  }
  return out;
}
