// GET /print/<id>.pdf: a printed mock paper kept by /api/print, for an hour. No sign-in: a phone's PDF viewer or
// download manager fetches it without the site's cookies; the 128-bit random address is what keeps it private.
// ?download sends it as a file to save.
export async function onRequestGet({ env, params, request }) {
  const m = /^([0-9a-f]{32})(\.pdf)?$/.exec(params.id || '');
  if (!m) return new Response('Not found', { status: 404 });
  const { value, metadata } = await env.HUB_KV.getWithMetadata('print:' + m[1], 'arrayBuffer');
  if (!value) {
    return new Response('This printed paper has expired (they are kept for an hour). Go back to the mock paper and print it again.',
      { status: 404, headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' } });
  }
  const name = (metadata && metadata.name) || 'mock-paper.pdf';
  const download = new URL(request.url).searchParams.has('download');
  return new Response(value, { headers: { 'content-type': 'application/pdf', 'cache-control': 'private, no-store',
    'content-disposition': (download ? 'attachment' : 'inline') + '; filename="' + name.replace(/"/g, '') + '"',
    'x-robots-tag': 'noindex' } });
}
