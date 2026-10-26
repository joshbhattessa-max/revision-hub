// Every request to the hub (its pages, the subject sites it serves and the API) needs a signed-in session.
import { getSession, json } from './_lib/auth.js';
import { maintenance, maintenancePage } from './_lib/maintenance.js';
import { notFoundPage } from './_lib/notfound.js';
import { keySession } from './_lib/keys.js';
import { NEW_SITE, isOldAddress, movedPage } from './_lib/moved.js';
import { canSend } from './_lib/email.js';
import { tagSession } from './_lib/bans.js';
import { TAKEDOWN_PAGE, takedown } from './_lib/takedown.js';
import { autoUpdate } from './_lib/updates.js';
import { fixKey, fixScript } from './_lib/mockfix.js';
import { whoCookie, whoTag } from './_lib/who.js';

// what anyone can open without signing in (the login page, the front page and "Try a few questions", Privacy, Terms)
const OPEN = new Set(['/login', '/login.html', '/login.js', '/hub.css', '/look.css', '/look.js', '/fonts.css', '/favicon.svg', '/favicon-32.png',
  '/apple-touch-icon.png', '/og.png', '/sitemap.xml', '/api/login', '/api/signup', '/api/status',
  '/privacy', '/privacy.html', '/terms', '/terms.html', '/consent.js', '/press.js', '/api/reset',
  '/welcome', '/welcome.html', '/welcome.css', '/look-landing.css', '/try', '/try.html', '/try.js']);
// the pictures for "Try a few questions" (try.js): three fixed questions and their mark schemes, plus the front page's
// screenshot
const TRY = p => /^\/try\/[a-z-]+\.webp$/.test(p);
// what still works for everyone during maintenance (so an admin can sign in)
const DURING_MAINTENANCE = new Set(['/press.js', '/og.png', '/sitemap.xml', '/login.js', '/hub.css', '/look.css', '/look.js', '/fonts.css', '/favicon.svg', '/favicon-32.png', '/apple-touch-icon.png',
  '/api/login', '/api/logout', '/api/status', '/privacy', '/privacy.html', '/terms', '/terms.html']);
const ADMIN = p => p === '/admin' || p === '/admin.html' || p === '/admin.js' || p === '/admin.css' || p.startsWith('/api/admin/') || p.startsWith('/v/');
// the deployment log's CSV and PDF records for the owner's Google Sheet: no sign-in (Google fetches them), the key in
// the address protects them (functions/deploys/)
const SHEET = p => p.startsWith('/deploys/');
// a printed mock paper kept for an hour (functions/print/): a phone's PDF viewer fetches it without the site's cookies;
// its random address protects it
const PRINT = p => /^\/print\/[0-9a-f]{32}(\.pdf)?$/.test(p);
// all a new account can reach until it has checked its email address (the page that does it, and leaving)
const UNCHECKED = p => ['/verify', '/verify.html', '/verify.js', '/api/me', '/api/logout'].includes(p) || p.startsWith('/api/email/');

const SETUP = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Setup needed</title><body style="font:16px/1.5 system-ui,sans-serif;max-width:560px;margin:60px auto;padding:0 16px">
<h1>Sign-in isn't set up yet</h1><p>This site needs a Cloudflare KV namespace bound as <code>HUB_KV</code>
(Pages project → Settings → Bindings). See the README.</p></body>`;

let lastAuto = 0;

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
  // takedown mode (admin console): every address is the plain "taken down" page, except for a signed-in admin. Only
  // signing in (the page's own hidden form, which lets admins in only) and out still work.
  if (await takedown(ctx.env) && !(session && session.role === 'admin') && !['/api/login', '/api/logout'].includes(path)) {
    const headers = { 'cache-control': 'no-store', 'x-robots-tag': 'noindex, nofollow' };
    if (path.startsWith('/api/')) return json({ error: 'Not available.' }, 503, headers);
    return new Response(ctx.request.method === 'HEAD' ? null : TAKEDOWN_PAGE, { status: 503, headers: { ...headers, 'content-type': 'text/html; charset=utf-8' } });
  }
  const isLogin = path === '/login' || path === '/login.html';
  const m = await maintenance(ctx);
  if (m.on && !(session && session.role === 'admin')) {
    const adminLogin = isLogin && url.searchParams.has('admin');
    if (!adminLogin && !DURING_MAINTENANCE.has(path) && !path.startsWith('/fonts/') && !path.startsWith('/look-fonts/') && !SHEET(path)) {
      const headers = { 'cache-control': 'no-store', 'retry-after': '120' };
      if (path.startsWith('/api/')) return json({ error: 'Down for maintenance', maintenance: true }, 503, headers);
      return new Response(maintenancePage(m), { status: 503, headers: { ...headers, 'content-type': 'text/html; charset=utf-8' } });
    }
    if (adminLogin) return ctx.next();
  }
  if (PRINT(path)) return ctx.next();
  // signed out, the front page is the welcome page (welcome.html, with "Try a few questions"); signed in, it's the hub
  if (!session && path === '/' && ['GET', 'HEAD'].includes(ctx.request.method)) {
    const res = await ctx.env.ASSETS.fetch(new URL('/welcome', url));
    const out = new Response(res.body, res);
    out.headers.set('cache-control', 'private, no-store');
    return withConsent(out);
  }
  if (OPEN.has(path) || path.startsWith('/fonts/') || path.startsWith('/look-fonts/') || SHEET(path) || TRY(path)) {
    if (session && isLogin) return Response.redirect(url.origin + safeNext(url), 302);  // (a key's cookie is set on its next page)
    return withConsent(await fresh(ctx, path));
  }
  if (!session) {
    if (path.startsWith('/api/')) return json({ error: 'Signed out' }, 401);
    return Response.redirect(`${url.origin}/login?next=${encodeURIComponent(url.pathname + url.search)}`, 302);
  }
  if (session.mustVerify && canSend(ctx.env) && !UNCHECKED(path)) {
    if (path.startsWith('/api/')) return json({ error: 'Check your email address first.', verify: true }, 403);
    return Response.redirect(`${url.origin}/verify?next=${encodeURIComponent(url.pathname + url.search)}`, 302);
  }
  if (ADMIN(path) && session.role !== 'admin') {
    return path.startsWith('/api/') ? json({ error: 'Admin only' }, 403) : Response.redirect(url.origin + '/', 302);
  }
  // the revision planner was removed: old links and bookmarks go to the home page
  if (path === '/planner' || path === '/planner.html') return Response.redirect(url.origin + '/', 302);
  // a past version of the site (/v/) only reads: nothing it sends can change anything
  if (!['GET', 'HEAD'].includes(ctx.request.method) && /^\/v\//.test(refererPath(ctx.request, url))) {
    return json({ error: 'This is a past version of the site, so nothing is saved.' }, 403);
  }
  ctx.data.session = session;
  // update notes write and send themselves after an update (_lib/updates.js): looked at in the background, at most
  // every 10 minutes by each server
  if (Date.now() - lastAuto > 10 * 60 * 1000) { lastAuto = Date.now(); ctx.waitUntil(autoUpdate(ctx).catch(() => {})); }
  const devCookie = await tagSession(ctx.env, ctx.request, session).catch(() => null);
  // which account this browser's copy of study progress belongs to (_lib/who.js)
  const who = await whoCookie(ctx.request, session).catch(() => null);
  const res = await ctx.next();
  // pages that don't exist get the 404 page (404.html only makes Pages answer 404 instead of the home page)
  if (res.status === 404 && (ctx.request.headers.get('accept') || '').includes('text/html')) {
    const nf = new Response(notFoundPage(url.pathname), { status: 404, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });
    if (keyCookie) nf.headers.append('set-cookie', keyCookie);
    if (devCookie) nf.headers.append('set-cookie', devCookie);
    if (who) nf.headers.append('set-cookie', who);
    return nf;
  }
  const out = new Response(res.body, res);
  out.headers.set('cache-control', 'private, no-store');
  if (keyCookie) out.headers.append('set-cookie', keyCookie);
  if (devCookie) out.headers.append('set-cookie', devCookie);
  if (who) out.headers.append('set-cookie', who);
  // (a past version keeps its own pages as they were, without today's cookie popup; the admin console stays bare HTML
  // with no CSS, so it gets none of the styled popups either)
  if (path.startsWith('/v/') || path === '/admin' || path === '/admin.html') return out;
  return session.mockfix ? withFix(withConsent(out, true, session.note), ctx.env, session.accountId) : withConsent(out, true, session.note);
}

// the admin removed or corrected one of this account's mocks: the page fixes the browser's copy of its progress first,
// at the very top, before the subject site's own script reads it (_lib/mockfix.js)
async function withFix(res, env, accountId) {
  if (res.status !== 200 || !(res.headers.get('content-type') || '').includes('text/html')) return res;
  const fix = await env.HUB_KV.get(fixKey(accountId), 'json');
  if (!fix) return res;
  const script = fixScript(fix, await whoTag(accountId));
  return new HTMLRewriter().on('head', { element(e) { e.prepend(script, { html: true }); } }).transform(res);
}

// the pages, styles and scripts anyone can open (sign-in, Privacy Policy, Terms, hub.css...) are fetched fresh every
// time, like the rest of the site, so an update shows straight away. (On jbrevision.co.uk, Cloudflare would otherwise
// let browsers keep them for 4 hours; it leaves "private, no-store" alone.) The whole file is always sent, never
// "not changed since your copy", so a copy Cloudflare kept from before is replaced too. Fonts and pictures still keep.
async function fresh(ctx, path) {
  if (path.startsWith('/fonts/') || /\.(png|webp|svg|ico|woff2?)$/.test(path)) return ctx.next();
  const headers = new Headers(ctx.request.headers);
  headers.delete('if-none-match');
  headers.delete('if-modified-since');
  const res = await ctx.next(new Request(ctx.request, { headers }));
  const out = new Response(res.body, res);
  out.headers.set('cache-control', 'private, no-store');
  return out;
}

// every page (the main site's and the subject sites' it serves) gets the cookie popup, consent.js; signed-in pages
// also get activity.js, which tells the admin console's Activity tab what's being opened (functions/api/activity.js),
// and note.js while a message from the admin console is waiting for them (functions/api/note.js)
function withConsent(res, signedIn, note) {
  if (res.status !== 200 || !(res.headers.get('content-type') || '').includes('text/html')) return res;
  const scripts = '<script src="/consent.js?v=2" defer></script><script src="/press.js?v=2" defer></script>' + (signedIn ? '<script src="/activity.js?v=1" defer></script>' : '') +
    (note ? '<script src="/note.js?v=4" defer></script>' : '');
  return new HTMLRewriter().on('body', { element(e) { e.append(scripts, { html: true }); } }).transform(res);
}

function refererPath(request, url) {
  try { const r = new URL(request.headers.get('referer') || ''); return r.origin === url.origin ? r.pathname : ''; } catch (e) { return ''; }
}

// only same-site paths, never another site
export function safeNext(url) {
  const n = url.searchParams.get('next') || '/';
  return /^\/(?!\/)/.test(n) ? n : '/';
}
