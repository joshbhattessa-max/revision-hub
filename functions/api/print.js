// POST /api/print (signed in): a printed mock paper (the PDF made in the page, sent as the request body) kept for an
// hour at /print/<id>.pdf, so a phone can open it like any other PDF on the web: its browser or PDF app fetches it
// from that address (a blob: link or a copy in the page's own storage doesn't open on most phones).
import { json } from '../_lib/auth.js';

const MAX = 24 * 1024 * 1024;   // a KV value holds 25 MB

export async function onRequestPost(ctx) {
  const type = ctx.request.headers.get('content-type') || '';
  if (!type.startsWith('application/pdf')) return json({ error: 'Send the PDF.' }, 400);
  const body = await ctx.request.arrayBuffer();
  if (!body.byteLength || body.byteLength > MAX) return json({ error: 'The PDF is too big to keep.' }, 413);
  const head = new Uint8Array(body, 0, 5);
  if (String.fromCharCode(...head) !== '%PDF-') return json({ error: 'That isn\'t a PDF.' }, 400);
  const name = (ctx.request.headers.get('x-name') || 'mock-paper.pdf').replace(/[^\w .()-]/g, '').slice(0, 120) || 'mock-paper.pdf';
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  const id = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
  await ctx.env.HUB_KV.put('print:' + id, body, { expirationTtl: 3600, metadata: { name, size: body.byteLength } });
  return json({ url: '/print/' + id + '.pdf' });
}
