// MTS Resources' subjects (/mts/<subject>/...), served from the private mtsq site (its own Cloudflare Pages project,
// MTS_ORIGIN, default https://mtsq.pages.dev). The middleware only lets accounts the admin gave access to, and that
// have typed their password on /mts this sign-in, get this far (functions/_lib/mts.js).
const PASS_HEADERS = ['accept', 'accept-encoding', 'accept-language', 'range', 'user-agent'];

export async function onRequest(ctx) {
  const url = new URL(ctx.request.url);
  const rest = url.pathname.replace(/^\/mts/, '');
  // /mts itself is the hub's own page (mts.html)
  if (!rest || rest === '/' || !['GET', 'HEAD'].includes(ctx.request.method)) return ctx.next();
  const s = ctx.data.session;
  if (!s || !s.mts || !s.mtsOpen) return Response.redirect(url.origin + '/mts', 302);
  const origin = (ctx.env.MTS_ORIGIN || 'https://mtsq.pages.dev').replace(/\/+$/, '');
  const headers = new Headers();
  for (const h of PASS_HEADERS) {
    const v = ctx.request.headers.get(h);
    if (v) headers.set(h, v);
  }
  if (ctx.env.HUB_SECRET) headers.set('x-hub-secret', ctx.env.HUB_SECRET);
  const upstream = await fetch(origin + rest + url.search, { method: ctx.request.method, headers, redirect: 'manual' });
  const out = new Headers(upstream.headers);
  const loc = out.get('location');
  if (loc) {
    const target = new URL(loc, origin + '/');
    if (target.origin === new URL(origin).origin) out.set('location', '/mts' + target.pathname + target.search);
  }
  out.set('cache-control', 'private, no-store');
  return new Response(upstream.body, { status: upstream.status, statusText: upstream.statusText, headers: out });
}
