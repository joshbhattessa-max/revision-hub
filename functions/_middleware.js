// Every request to the hub (its pages, the subject sites it serves and the API) needs a signed-in session.
import { getSession, json } from './_lib/auth.js';

// what the login page itself needs
const OPEN = new Set(['/login', '/login.html', '/login.js', '/hub.css', '/fonts.css', '/favicon.svg', '/favicon-32.png',
  '/apple-touch-icon.png', '/api/login', '/api/signup']);
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

  const session = await getSession(ctx.env, ctx.request);
  if (OPEN.has(path) || path.startsWith('/fonts/')) {
    if (session && (path === '/login' || path === '/login.html')) return Response.redirect(url.origin + safeNext(url), 302);
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
  const out = new Response(res.body, res);
  out.headers.set('cache-control', 'private, no-store');
  return out;
}

// only same-site paths, never another site
export function safeNext(url) {
  const n = url.searchParams.get('next') || '/';
  return /^\/(?!\/)/.test(n) ? n : '/';
}
