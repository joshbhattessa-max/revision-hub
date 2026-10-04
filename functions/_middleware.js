// Every request to the hub (its pages, the subject sites it serves and the API) needs a signed-in session.
import { getSession, json } from './_lib/auth.js';
import { maintenance, maintenancePage } from './_lib/maintenance.js';
import { notFoundPage } from './_lib/notfound.js';
import { keySession } from './_lib/keys.js';
import { NEW_SITE, isOldAddress, movedPage } from './_lib/moved.js';

// what the login page itself needs
const OPEN = new Set(['/login', '/login.html', '/login.js', '/hub.css', '/fonts.css', '/favicon.svg', '/favicon-32.png',
  '/apple-touch-icon.png', '/og.png', '/sitemap.xml', '/api/login', '/api/signup', '/api/status',
  '/privacy', '/privacy.html', '/terms', '/terms.html', '/consent.js']);
// what still works for everyone during maintenance (so an admin can sign in)
const DURING_MAINTENANCE = new Set(['/og.png', '/sitemap.xml', '/login.js', '/hub.css', '/fonts.css', '/favicon.svg', '/favicon-32.png', '/apple-touch-icon.png',
  '/api/login', '/api/logout', '/api/status', '/privacy', '/privacy.html', '/terms', '/terms.html']);
const ADMIN = p => p === '/admin' || p === '/admin.html' || p === '/admin.js' || p.startsWith('/api/admin/');

const SETUP = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Setup needed</title><body style="font:16px/1.5 system-ui,sans-serif;max-width:560px;margin:60px auto;padding:0 16px">
<h1>Sign-in isn't set up yet</h1><p>This site needs a Cloudflare KV namespace bound as <code>HUB_KV</code>
(Pages project → Settings → Bindings). See the README.</p></body>`;

export async function onRequest(ctx) {
  const url = new URL(ctx.request.url);
  const path = url.pathname.replace(/\/+$/, '') || '/';
  // the site has moved to jbrevision.co.uk: www.jbrevision.co.uk goes to the address without www, and the old
  // address (josh-b-revision.pages.dev) no longer works: every page there is the "we've moved" popup and its API
  // answers 410 Gone
  if (url.hostname === 'www.jbrevision.co.uk') return Response.redirect(NEW_SITE + url.pathname + url.search, 301);
  if (isOldAddress(url.hostname)) {
    const headers = { 'cache-control': 'no-store', 'x-robots-tag': 'noindex' };
    if (path.startsWith('/api/')) return json({ error: 'This site has moved to ' + NEW_SITE, moved: NEW_SITE }, 410, headers);
    return new Response(movedPage(url), { status: 410, headers: { ...headers, 'content-type': 'text/html; charset=utf-8' } });
  }
  // without its store the sign-in can't work, so nothing is served (fail closed)
  if (!ctx.env.HUB_KV) return new Response(SETUP, { status: 503, headers: { 'content-type': 'text/html; charset=utf-8' } });

  // Google Search Console ownership check: answered word for word, without a sign-in and even during maintenance
  // (Pages would otherwise redirect *.html to the address without .html, which Google doesn't accept)
  if (path === '/google4ee74d39786946b2.html') {
    return new Response('google-site-verification: google4ee74d39786946b2.html', { headers: { 'content-type': 'text/html; charset=utf-8' } });
  }
  let session = await getSession(ctx.env, ctx.request), keyCookie = null;
  // agents can use an access key instead of the login form (a standard, non-admin sign-in)
  if (!session) {
    const ks = await keySession(ctx.env, ctx.request, url);
    if (ks) { session = ks.session; keyCookie = ks.setCookie; }
  }
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
    if (session && isLogin) return Response.redirect(url.origin + safeNext(url), 302);  // (a key's cookie is set on its next page)
    return withConsent(fresh(await ctx.next()));
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
    const nf = new Response(notFoundPage(url.pathname), { status: 404, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });
    if (keyCookie) nf.headers.append('set-cookie', keyCookie);
    return nf;
  }
  const out = new Response(res.body, res);
  out.headers.set('cache-control', 'private, no-store');
  if (keyCookie) out.headers.append('set-cookie', keyCookie);
  return withConsent(out);
}

// the pages, styles and scripts anyone can open (sign-in, Privacy Policy, Terms, hub.css...) are fetched fresh every
// time, like the rest of the site, so an update shows straight away. (On jbrevision.co.uk, Cloudflare would otherwise
// let browsers keep them for 4 hours; it leaves "private, no-store" alone.) Fonts and pictures still keep.
function fresh(res) {
  if (res.status !== 200 || !/text\/(html|css)|javascript|json|xml/.test(res.headers.get('content-type') || '')) return res;
  const out = new Response(res.body, res);
  out.headers.set('cache-control', 'private, no-store');
  return out;
}

// every page (the main site's and the subject sites' it serves) gets the cookie popup, consent.js
function withConsent(res) {
  if (res.status !== 200 || !(res.headers.get('content-type') || '').includes('text/html')) return res;
  return new HTMLRewriter().on('body', { element(e) { e.append('<script src="/consent.js?v=2" defer></script>', { html: true }); } }).transform(res);
}

// only same-site paths, never another site
export function safeNext(url) {
  const n = url.searchParams.get('next') || '/';
  return /^\/(?!\/)/.test(n) ? n : '/';
}
