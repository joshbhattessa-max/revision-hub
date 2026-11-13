// Past papers served from this site (functions/_lib/papers.js). The middleware has already checked the sign-in.
import { servePaper } from '../_lib/papers.js';

export async function onRequest(ctx) {
  if (!['GET', 'HEAD'].includes(ctx.request.method)) return new Response(null, { status: 405, headers: { allow: 'GET, HEAD' } });
  return servePaper(ctx);
}
