// /v/<n>/… : deployment n of the deployment log as it was (admin accounts only; the middleware checks).
// A subject site's deployment is fetched from the address Cloudflare keeps for every deployment, with the hub's
// secret, the way /chemistry/ etc. are. The main site's old deployments now only show the "we've moved" notice, so its
// pages come from GitHub at that commit instead (the pages as they were, talking to today's API).
// A past version only reads: whatever its pages try to save is refused, and what they keep in the browser stays in
// that tab, so an old page can't overwrite anything of today's.
import { OWNER, isSite, load, ukTime } from '../_lib/deploylog.js';

const TYPES = { html: 'text/html; charset=utf-8', css: 'text/css; charset=utf-8', js: 'text/javascript; charset=utf-8',
  mjs: 'text/javascript; charset=utf-8', json: 'application/json', svg: 'image/svg+xml', png: 'image/png', jpg: 'image/jpeg',
  jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif', avif: 'image/avif', ico: 'image/x-icon', woff2: 'font/woff2',
  woff: 'font/woff', ttf: 'font/ttf', pdf: 'application/pdf', mp3: 'audio/mpeg', m4a: 'audio/mp4', txt: 'text/plain; charset=utf-8',
  xml: 'application/xml', webmanifest: 'application/manifest+json', csv: 'text/csv; charset=utf-8' };
const PASS = ['accept', 'accept-encoding', 'accept-language', 'range', 'user-agent'];

export async function onRequestGet(ctx) {
  const url = new URL(ctx.request.url);
  const m = url.pathname.match(/^\/v\/(\d{1,6})(\/.*)?$/);
  if (!m) return new Response('Not found', { status: 404 });
  if (!m[2]) return Response.redirect(`${url.origin}/v/${m[1]}/`, 301);
  const e = (await load(ctx.env)).entries.find(x => x.id === Number(m[1]));
  if (!e) return new Response('There\'s no deployment ' + m[1] + ' in the log.', { status: 404 });
  let res;
  try {
    if (e.ok && e.proj === 'hub') res = await fromGitHub(e, m[2]);
    else if (e.ok && isSite(e.proj) && /^https:\/\/[0-9a-f]{8}\.[a-z0-9-]+\.pages\.dev$/.test(e.url)) res = await fromCloudflare(ctx, e, m[2] + url.search);
    else if (e.dash) return Response.redirect(e.dash, 302);
    else return new Response('This deployment can\'t be opened.', { status: 404 });
  } catch (err) {
    return new Response('That version couldn\'t be reached just now. Try again in a minute.', { status: 502, headers: { 'content-type': 'text/plain; charset=utf-8' } });
  }
  return pastVersion(res, e);
}

async function fromGitHub(e, path) {
  let p;
  try { p = decodeURIComponent(path).replace(/^\/+/, ''); } catch (err) { return new Response('Not found', { status: 404 }); }
  if (p.split('/').some(s => s === '..' || s.startsWith('.')) || /^(functions|mail-worker|node_modules)(\/|$)/.test(p)) {
    return new Response('Not found', { status: 404 });
  }
  const tries = !p || p.endsWith('/') ? [p + 'index.html'] : /\.[a-z0-9]+$/i.test(p) ? [p] : [p + '.html', p + '/index.html'];
  for (const t of tries) {
    const r = await fetch(`https://raw.githubusercontent.com/${OWNER}/${e.repo}/${e.sha}/${t.split('/').map(encodeURIComponent).join('/')}`,
      { cf: { cacheTtl: 86400, cacheEverything: true } });
    if (r.ok) return new Response(r.body, { headers: { 'content-type': TYPES[t.split('.').pop().toLowerCase()] || 'application/octet-stream' } });
  }
  return new Response('That page isn\'t in this version.', { status: 404, headers: { 'content-type': 'text/plain; charset=utf-8' } });
}

async function fromCloudflare(ctx, e, path) {
  const headers = new Headers();
  for (const h of PASS) { const v = ctx.request.headers.get(h); if (v) headers.set(h, v); }
  if (ctx.env.HUB_SECRET) headers.set('x-hub-secret', ctx.env.HUB_SECRET);
  if (ctx.env.ACCESS_CLIENT_ID && ctx.env.ACCESS_CLIENT_SECRET) {
    headers.set('CF-Access-Client-Id', ctx.env.ACCESS_CLIENT_ID);
    headers.set('CF-Access-Client-Secret', ctx.env.ACCESS_CLIENT_SECRET);
  }
  const up = await fetch(e.url + path, { headers, redirect: 'manual' });
  const out = new Headers(up.headers);
  const loc = out.get('location');
  if (loc) {
    const target = new URL(loc, e.url + '/');
    if (target.origin === e.url) out.set('location', `/v/${e.id}${target.pathname}${target.search}`);
  }
  return new Response(up.body, { status: up.status, statusText: up.statusText, headers: out });
}

// stops a past version saving anything: requests that would change something are answered "no" in the page, and
// localStorage/sessionStorage writes stay in memory (reads still see what's there)
const GUARD = `<script>(function(){var no=function(){return Promise.resolve(new Response('{"error":"This is a past version of the site, so nothing is saved."}',{status:403,headers:{'content-type':'application/json'}}))};
var f=window.fetch;window.fetch=function(i,o){var m=String((o&&o.method)||(i&&i.method)||'GET').toUpperCase();return m==='GET'||m==='HEAD'?f.apply(this,arguments):no()};
var X=XMLHttpRequest.prototype,op=X.open,se=X.send;X.open=function(m){this._jbrM=String(m).toUpperCase();return op.apply(this,arguments)};X.send=function(){if(this._jbrM!=='GET'&&this._jbrM!=='HEAD'){var x=this;setTimeout(function(){x.abort()});return}return se.apply(this,arguments)};
if(navigator.sendBeacon)navigator.sendBeacon=function(){return true};
function shim(real){var mine={},gone={};return{getItem:function(k){k=String(k);if(k in mine)return mine[k];if(gone[k])return null;try{return real.getItem(k)}catch(e){return null}},setItem:function(k,v){k=String(k);mine[k]=String(v);delete gone[k]},removeItem:function(k){k=String(k);delete mine[k];gone[k]=1},clear:function(){mine={};try{for(var i=0;i<real.length;i++)gone[real.key(i)]=1}catch(e){}},key:function(i){try{return real.key(i)}catch(e){return null}},get length(){try{return real.length}catch(e){return 0}}}}
['localStorage','sessionStorage'].forEach(function(n){try{var s=shim(window[n]);Object.defineProperty(window,n,{configurable:true,get:function(){return s}})}catch(e){}});})();</script>`;

function pastVersion(res, e) {
  const out = new Response(res.body, res);
  out.headers.set('cache-control', 'private, no-store');
  out.headers.set('x-robots-tag', 'noindex');
  out.headers.delete('content-security-policy');
  if (res.status !== 200 || !(out.headers.get('content-type') || '').includes('text/html')) return out;
  const when = ukTime(e.at);
  const bar = `<div id="jbr-past" style="position:fixed;left:12px;right:12px;bottom:12px;z-index:2147483647;margin:0 auto;max-width:640px;
background:#33312e;color:#fff;font:13px/1.4 system-ui,-apple-system,sans-serif;padding:9px 14px;border-radius:12px;box-shadow:0 4px 18px rgba(0,0,0,.25);
display:flex;gap:10px;align-items:center;flex-wrap:wrap">Past version: deployment ${e.id}, ${esc(e.site)}, ${when}. Nothing you do here is saved.
<a href="/" style="color:#9fe3d9;margin-left:auto">Current site</a><button type="button" onclick="this.parentNode.remove()"
style="background:none;border:0;color:#fff;font:inherit;cursor:pointer;padding:0 2px" aria-label="Hide">✕</button></div>`;
  return new HTMLRewriter()
    .on('head', { element(el) { el.prepend('<meta name="robots" content="noindex">' + GUARD, { html: true }); } })
    .on('body', { element(el) { el.append(bar, { html: true }); } })
    .transform(out);
}
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
