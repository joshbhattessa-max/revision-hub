// Every request to the hub (its pages, the subject sites it serves and the API) needs a signed-in session.
import { getSession, json } from './_lib/auth.js';
import { maintenance, maintenancePage } from './_lib/maintenance.js';
import { notFoundPage } from './_lib/notfound.js';

// what the login page itself needs
const OPEN = new Set(['/login', '/login.html', '/login.js', '/hub.css', '/fonts.css', '/favicon.svg', '/favicon-32.png',
  '/apple-touch-icon.png', '/og.png', '/sitemap.xml', '/api/login', '/api/signup', '/api/status']);
// what still works for everyone during maintenance (so an admin can sign in)
const DURING_MAINTENANCE = new Set(['/og.png', '/sitemap.xml', '/login.js', '/hub.css', '/fonts.css', '/favicon.svg', '/favicon-32.png', '/apple-touch-icon.png',
  '/api/login', '/api/logout', '/api/status']);
const ADMIN = p => p === '/admin' || p === '/admin.html' || p === '/admin.js' || p.startsWith('/api/admin/');

const SETUP = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Setup needed</title><body style="font:16px/1.5 system-ui,sans-serif;max-width:560px;margin:60px auto;padding:0 16px">
<h1>Sign-in isn't set up yet</h1><p>This site needs a Cloudflare KV namespace bound as <code>HUB_KV</code>
(Pages project → Settings → Bindings). See the README.</p></body>`;

export async function onRequest(ctx) {
  const url = new URL(ctx.request.url);
  const path = url.pathname.replace(/\/+$/, '') || '/';
  // without its store the sign-in can't work, so nothing is served (fail closed)
  if (!ctx.env.HUB_KV) return new Response(SETUP, { status: 503, headers: { 'content-type': 'text/html; charset=utf-8' } });

  // Google Search Console ownership check: answered word for word, without a sign-in and even during maintenance
  // (Pages would otherwise redirect *.html to the address without .html, which Google doesn't accept)
  if (path === '/google4ee74d39786946b2.html') {
    return new Response('google-site-verification: google4ee74d39786946b2.html', { headers: { 'content-type': 'text/html; charset=utf-8' } });
  }
  const session = await getSession(ctx.env, ctx.request);
  const isLogin = path === '/login' || path === '/login.html';
  const m = await maintenance(ctx);
  if (m.on && !(session && session.role === 'admin')) {
    const adminLogin = isLogin && url.searchParams.has('admin');
    if (!adminLogin && !DURING_MAINTENANCE.has(path) && !path.startsWith('/fonts/')) {
      const headers = { 'cache-control': 'no-store', 'retry-after': '120' };
      if (path.startsWith('/api/')) return json({ error: 'Down for maintenance', maintenance: true }, 503, headers);
      return new Response(maintenancePage(m), { status: 503, headers: { ...headers, 'content-type': 'text/html; charset=utf-8' } });
    }
    if (adminLogin) return ctx.next();
  }
  if (OPEN.has(path) || path.startsWith('/fonts/')) {
    if (session && isLogin) return Response.redirect(url.origin + safeNext(url), 302);
    return ctx.next();
  }
  if (!session) {
    if (path.startsWith('/api/')) return json({ error: 'Signed out' }, 401);
    return Response.redirect(`${url.origin}/login?next=${encodeURIComponent(url.pathname + url.search)}`, 302);
  }
  if (ADMIN(path) && session.role !== 'admin') {
    return path.startsWith('/api/') ? json({ error: 'Admin only' }, 403) : Response.redirect(url.origin + '/', 302);
  }
  ctx.data.session = session;
  const res = await ctx.next();
  // pages that don't exist get the 404 page (404.html only makes Pages answer 404 instead of the home page)
  if (res.status === 404 && (ctx.request.headers.get('accept') || '').includes('text/html')) {
    return new Response(notFoundPage(url.pathname), { status: 404, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });
  }
  const out = new Response(res.body, res);
  out.headers.set('cache-control', 'private, no-store');
  return out;
}

// only same-site paths, never another site
export function safeNext(url) {
  const n = url.searchParams.get('next') || '/';
  return /^\/(?!\/)/.test(n) ? n : '/';
}
