// Cloudflare Pages Function: serve each subject site under one address.
//   https://<hub>.pages.dev/chemistry/...  ->  https://chemq.pages.dev/...
// The path -> site mapping comes from the "sites" list in hub.json, so adding or
// renaming a site only needs an edit to that file.

let cache = { at: 0, sites: [] };

async function sites(ctx, url) {
  if (Date.now() - cache.at < 60000) return cache.sites;
  try {
    const res = await ctx.env.ASSETS.fetch(new URL('/hub.json', url));
    const cfg = await res.json();
    cache = { at: Date.now(), sites: (cfg.sites || []).filter(s => s.path && s.origin) };
  } catch (e) {
    cache = { at: Date.now(), sites: [] };
  }
  return cache.sites;
}

const PASS_HEADERS = ['accept', 'accept-encoding', 'accept-language', 'range', 'if-none-match', 'if-modified-since', 'user-agent'];

export async function onRequest(ctx) {
  const url = new URL(ctx.request.url);
  const m = url.pathname.match(/^\/([A-Za-z0-9_-]+)(\/.*)?$/);
  if (!m || !['GET', 'HEAD'].includes(ctx.request.method)) return ctx.next();
  const site = (await sites(ctx, url)).find(s => s.path === m[1]);
  if (!site) return ctx.next();
  // the sites use relative links, so they must be opened as /chemistry/ (with the slash)
  if (!m[2]) return Response.redirect(`${url.origin}/${site.path}/${url.search}`, 301);

  const origin = site.origin.replace(/\/+$/, '');
  const headers = new Headers();
  for (const h of PASS_HEADERS) {
    const v = ctx.request.headers.get(h);
    if (v) headers.set(h, v);
  }
  // when the subject sites sit behind Cloudflare Access, the hub signs in with a service token
  if (ctx.env.ACCESS_CLIENT_ID && ctx.env.ACCESS_CLIENT_SECRET) {
    headers.set('CF-Access-Client-Id', ctx.env.ACCESS_CLIENT_ID);
    headers.set('CF-Access-Client-Secret', ctx.env.ACCESS_CLIENT_SECRET);
  }
  const upstream = await fetch(origin + m[2] + url.search, { method: ctx.request.method, headers, redirect: 'manual' });
  const out = new Headers(upstream.headers);
  const loc = out.get('location');
  if (loc) {
    // keep redirects inside this site's folder
    const target = new URL(loc, origin + '/');
    if (target.origin === new URL(origin).origin) out.set('location', `/${site.path}${target.pathname}${target.search}`);
  }
  return new Response(upstream.body, { status: upstream.status, statusText: upstream.statusText, headers: out });
}
