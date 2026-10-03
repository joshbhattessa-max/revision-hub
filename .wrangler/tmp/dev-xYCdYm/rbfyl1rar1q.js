var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// .wrangler/tmp/pages-3GkTIM/functionsWorker-0.09749357073798248.mjs
var __defProp2 = Object.defineProperty;
var __name2 = /* @__PURE__ */ __name((target, value) => __defProp2(target, "name", { value, configurable: true }), "__name");
var SESSION_SECONDS = 6 * 60 * 60;
var COOKIE = "jbr_session";
var ITER = 1e5;
var SEED_ACCOUNTS = [
  {
    "id": "a1",
    "username": "JoshB",
    "role": "admin",
    "salt": "7aCUT5XzQmtlcdGqtuUZEw==",
    "hash": "5RvYjbXDpKsyhRiG4U/dawMxWeBobFoHAhlhcnGtUXU="
  },
  {
    "id": "a2",
    "username": "JoshB",
    "role": "user",
    "salt": "A7VeG/rG/Yc/JoqyhQdOdQ==",
    "hash": "o3ZCmg5N22kQMTBOfVr/bggo6ht279qKxtGpsddpufU="
  },
  {
    "id": "a3",
    "username": "test",
    "role": "user",
    "salt": "QnO6JgKoAPN9RHVKVx6S6Q==",
    "hash": "CCNKtAaf2NXz74oMtWm9MlTAxFmtUq2P34BYsucuUMg="
  }
];
var enc = new TextEncoder();
var b64 = /* @__PURE__ */ __name2((buf) => btoa(String.fromCharCode(...new Uint8Array(buf))), "b64");
var unb64 = /* @__PURE__ */ __name2((s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0)), "unb64");
async function hashPassword(password, saltB64) {
  const salt = saltB64 ? unb64(saltB64) : crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations: ITER }, key, 256);
  return { salt: b64(salt), hash: b64(bits) };
}
__name(hashPassword, "hashPassword");
__name2(hashPassword, "hashPassword");
function sameBytes(a, b) {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}
__name(sameBytes, "sameBytes");
__name2(sameBytes, "sameBytes");
function randomToken(bytes = 32) {
  return [...crypto.getRandomValues(new Uint8Array(bytes))].map((b) => b.toString(16).padStart(2, "0")).join("");
}
__name(randomToken, "randomToken");
__name2(randomToken, "randomToken");
async function getAccounts(env) {
  const list = await env.HUB_KV.get("accounts", "json");
  if (list) return list;
  await env.HUB_KV.put("accounts", JSON.stringify(SEED_ACCOUNTS));
  return SEED_ACCOUNTS;
}
__name(getAccounts, "getAccounts");
__name2(getAccounts, "getAccounts");
var saveAccounts = /* @__PURE__ */ __name2((env, list) => env.HUB_KV.put("accounts", JSON.stringify(list)), "saveAccounts");
async function checkLogin(env, username, password) {
  const name = String(username || "").trim().toLowerCase();
  for (const a of await getAccounts(env)) {
    if (a.username.toLowerCase() !== name) continue;
    const { hash } = await hashPassword(String(password || ""), a.salt);
    if (sameBytes(hash, a.hash)) return a;
  }
  return null;
}
__name(checkLogin, "checkLogin");
__name2(checkLogin, "checkLogin");
function readCookie(request, name) {
  const m = (request.headers.get("cookie") || "").match(new RegExp("(?:^|;\\s*)" + name + "=([^;]+)"));
  return m ? decodeURIComponent(m[1]) : null;
}
__name(readCookie, "readCookie");
__name2(readCookie, "readCookie");
function sessionCookie(token, maxAge) {
  return `${COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}
__name(sessionCookie, "sessionCookie");
__name2(sessionCookie, "sessionCookie");
async function createSession(env, account, request) {
  const token = randomToken();
  const now = Date.now();
  const info = {
    accountId: account.id,
    username: account.username,
    role: account.role,
    created: now,
    expires: now + SESSION_SECONDS * 1e3,
    ip: request.headers.get("cf-connecting-ip") || "",
    country: request.cf && request.cf.country || "",
    device: (request.headers.get("user-agent") || "").slice(0, 160)
  };
  await env.HUB_KV.put("sess:" + token, JSON.stringify(info), { expiration: Math.floor(info.expires / 1e3), metadata: info });
  return token;
}
__name(createSession, "createSession");
__name2(createSession, "createSession");
async function getSession(env, request) {
  const token = readCookie(request, COOKIE);
  if (!token || !/^[0-9a-f]{64}$/.test(token)) return null;
  const s = await env.HUB_KV.get("sess:" + token, "json");
  if (!s || s.expires < Date.now()) return null;
  return { token, ...s };
}
__name(getSession, "getSession");
__name2(getSession, "getSession");
async function listSessions(env) {
  const out = [];
  let cursor;
  do {
    const page = await env.HUB_KV.list({ prefix: "sess:", cursor });
    for (const k of page.keys) {
      const m = k.metadata || {};
      if (m.expires && m.expires > Date.now()) out.push({ token: k.name.slice(5), ...m });
    }
    cursor = page.list_complete ? null : page.cursor;
  } while (cursor);
  return out.sort((a, b) => b.created - a.created);
}
__name(listSessions, "listSessions");
__name2(listSessions, "listSessions");
async function endSessions(env, test) {
  let n = 0;
  for (const s of await listSessions(env)) {
    if (test(s)) {
      await env.HUB_KV.delete("sess:" + s.token);
      n++;
    }
  }
  return n;
}
__name(endSessions, "endSessions");
__name2(endSessions, "endSessions");
async function tooManyFailures(env, request) {
  const ip = request.headers.get("cf-connecting-ip") || "unknown";
  const n = parseInt(await env.HUB_KV.get("fail:" + ip) || "0", 10);
  return n >= 10;
}
__name(tooManyFailures, "tooManyFailures");
__name2(tooManyFailures, "tooManyFailures");
async function noteFailure(env, request) {
  const ip = request.headers.get("cf-connecting-ip") || "unknown";
  const n = parseInt(await env.HUB_KV.get("fail:" + ip) || "0", 10) + 1;
  await env.HUB_KV.put("fail:" + ip, String(n), { expirationTtl: 900 });
}
__name(noteFailure, "noteFailure");
__name2(noteFailure, "noteFailure");
var json = /* @__PURE__ */ __name2((data, status = 200, headers = {}) => new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json", "cache-control": "no-store", ...headers } }), "json");
async function hubContent(ctx) {
  const saved = ctx.env.HUB_KV && await ctx.env.HUB_KV.get("hub", "json");
  if (saved) return saved;
  const res = await ctx.env.ASSETS.fetch(new URL("/hub.json", ctx.request.url));
  return res.json();
}
__name(hubContent, "hubContent");
__name2(hubContent, "hubContent");
var ROLES = ["admin", "user"];
var MAX_IMAGE = 5 * 1024 * 1024;
async function onRequest(ctx) {
  const { request, env, params, data } = ctx;
  const route = (params.route || []).join("/");
  const method = request.method;
  const me = data.session;
  const body = ["POST", "PUT", "PATCH"].includes(method) && !route.startsWith("media") ? await request.json().catch(() => ({})) : null;
  if (route === "sessions" && method === "GET") {
    const accounts = await getAccounts(env);
    return json((await listSessions(env)).map((s) => ({
      id: s.token.slice(0, 16),
      username: s.username,
      role: s.role,
      accountId: s.accountId,
      account: label(accounts.find((a) => a.id === s.accountId) || s),
      created: s.created,
      expires: s.expires,
      ip: s.ip,
      country: s.country,
      device: s.device,
      current: s.token === me.token
    })));
  }
  if (route === "sessions/end" && method === "POST") {
    let n = 0;
    if (body.id) n = await endSessions(env, (s) => s.token.slice(0, 16) === String(body.id) && s.token !== me.token);
    else if (body.accountId) n = await endSessions(env, (s) => s.accountId === body.accountId && s.token !== me.token);
    else if (body.everyoneElse) n = await endSessions(env, (s) => s.token !== me.token);
    return json({ ended: n });
  }
  if (route === "accounts" && method === "GET") {
    const sessions = await listSessions(env);
    return json((await getAccounts(env)).map((a) => ({
      id: a.id,
      username: a.username,
      role: a.role,
      label: label(a),
      signedIn: sessions.filter((s) => s.accountId === a.id).length,
      you: a.id === me.accountId
    })));
  }
  if (route === "accounts" && method === "POST") {
    const username = clean(body.username), role = ROLES.includes(body.role) ? body.role : "user";
    if (!username) return json({ error: "Enter a username." }, 400);
    if (!body.password || String(body.password).length < 4) return json({ error: "Passwords need at least 4 characters." }, 400);
    const list = await getAccounts(env);
    const { salt, hash } = await hashPassword(String(body.password));
    list.push({ id: "a" + randomToken(6), username, role, salt, hash });
    await saveAccounts(env, list);
    return json({ ok: true });
  }
  const acct = route.match(/^accounts\/([\w-]+)$/);
  if (acct && method === "PATCH") {
    const list = await getAccounts(env);
    const a = list.find((x) => x.id === acct[1]);
    if (!a) return json({ error: "No such account." }, 404);
    if (body.username !== void 0) {
      const u = clean(body.username);
      if (!u) return json({ error: "Enter a username." }, 400);
      a.username = u;
    }
    if (body.role !== void 0) {
      if (!ROLES.includes(body.role)) return json({ error: "Unknown role." }, 400);
      if (a.role === "admin" && body.role !== "admin" && list.filter((x) => x.role === "admin").length < 2)
        return json({ error: "There must always be at least one admin account." }, 400);
      a.role = body.role;
    }
    if (body.password !== void 0) {
      if (String(body.password).length < 4) return json({ error: "Passwords need at least 4 characters." }, 400);
      Object.assign(a, await hashPassword(String(body.password)));
    }
    await saveAccounts(env, list);
    if (body.password !== void 0 || body.role !== void 0 || body.username !== void 0)
      await endSessions(env, (s) => s.accountId === a.id && s.token !== me.token);
    return json({ ok: true });
  }
  if (acct && method === "DELETE") {
    const list = await getAccounts(env);
    const a = list.find((x) => x.id === acct[1]);
    if (!a) return json({ error: "No such account." }, 404);
    if (a.id === me.accountId) return json({ error: "You can't delete the account you're signed in with." }, 400);
    if (a.role === "admin" && list.filter((x) => x.role === "admin").length < 2)
      return json({ error: "There must always be at least one admin account." }, 400);
    await saveAccounts(env, list.filter((x) => x.id !== a.id));
    await endSessions(env, (s) => s.accountId === a.id);
    return json({ ok: true });
  }
  if (route === "hub" && method === "GET") return json(await hubContent(ctx));
  if (route === "hub" && method === "PUT") {
    const c = body && body.content;
    if (!c || typeof c.title !== "string" || !Array.isArray(c.sites) || !Array.isArray(c.sections))
      return json({ error: "That content is not in the expected shape." }, 400);
    await env.HUB_KV.put("hub", JSON.stringify(c));
    return json({ ok: true });
  }
  if (route === "hub" && method === "DELETE") {
    await env.HUB_KV.delete("hub");
    return json({ ok: true });
  }
  if (route === "media" && method === "POST") {
    const type = (request.headers.get("content-type") || "").split(";")[0];
    if (!/^image\/(png|jpeg|gif|webp|svg\+xml|avif)$/.test(type)) return json({ error: "Upload a PNG, JPEG, GIF, WebP, AVIF or SVG image." }, 400);
    const buf = await request.arrayBuffer();
    if (buf.byteLength > MAX_IMAGE) return json({ error: "Images can be up to 5 MB." }, 400);
    const id = randomToken(12);
    await env.HUB_KV.put("media:" + id, buf, { metadata: { type, size: buf.byteLength, at: Date.now() } });
    return json({ url: "/media/" + id });
  }
  return json({ error: "Not found" }, 404);
}
__name(onRequest, "onRequest");
__name2(onRequest, "onRequest");
function clean(s) {
  return String(s || "").trim().slice(0, 40);
}
__name(clean, "clean");
__name2(clean, "clean");
function label(a) {
  return a.username + (a.role === "admin" ? " (admin)" : "");
}
__name(label, "label");
__name2(label, "label");
async function onRequestGet(ctx) {
  return json(await hubContent(ctx));
}
__name(onRequestGet, "onRequestGet");
__name2(onRequestGet, "onRequestGet");
async function onRequestPost({ env, request }) {
  if (await tooManyFailures(env, request)) return json({ error: "Too many attempts. Try again in 15 minutes." }, 429);
  let body = {};
  try {
    body = await request.json();
  } catch (e) {
  }
  const account = await checkLogin(env, body.username, body.password);
  if (!account) {
    await noteFailure(env, request);
    return json({ error: "Wrong username or password." }, 401);
  }
  const token = await createSession(env, account, request);
  return json({ ok: true }, 200, { "set-cookie": sessionCookie(token, SESSION_SECONDS) });
}
__name(onRequestPost, "onRequestPost");
__name2(onRequestPost, "onRequestPost");
async function onRequestPost2({ env, data }) {
  if (data.session) await env.HUB_KV.delete("sess:" + data.session.token);
  return json({ ok: true }, 200, { "set-cookie": `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0` });
}
__name(onRequestPost2, "onRequestPost2");
__name2(onRequestPost2, "onRequestPost");
function onRequestGet2({ data }) {
  const s = data.session;
  return json({ username: s.username, role: s.role, expires: s.expires });
}
__name(onRequestGet2, "onRequestGet2");
__name2(onRequestGet2, "onRequestGet");
var MAX_PER_HOUR = 5;
async function onRequestPost3({ env, request }) {
  const ip = request.headers.get("cf-connecting-ip") || "unknown";
  const made = parseInt(await env.HUB_KV.get("signup:" + ip) || "0", 10);
  if (made >= MAX_PER_HOUR) return json({ error: "Too many new accounts from here. Try again in an hour." }, 429);
  let body = {};
  try {
    body = await request.json();
  } catch (e) {
  }
  const username = String(body.username || "").trim();
  const password = String(body.password || "");
  if (!/^[A-Za-z0-9 _.-]{3,30}$/.test(username))
    return json({ error: "Usernames need 3\u201330 letters, numbers, spaces, dots, dashes or underscores." }, 400);
  if (password.length < 6) return json({ error: "Passwords need at least 6 characters." }, 400);
  if (password.length > 200) return json({ error: "That password is too long." }, 400);
  const list = await getAccounts(env);
  if (list.some((a) => a.username.toLowerCase() === username.toLowerCase()))
    return json({ error: "That username is taken. Pick another one." }, 409);
  const account = { id: "a" + randomToken(6), username, role: "user", ...await hashPassword(password) };
  list.push(account);
  await saveAccounts(env, list);
  await env.HUB_KV.put("signup:" + ip, String(made + 1), { expirationTtl: 3600 });
  const token = await createSession(env, account, request);
  return json({ ok: true }, 200, { "set-cookie": sessionCookie(token, SESSION_SECONDS) });
}
__name(onRequestPost3, "onRequestPost3");
__name2(onRequestPost3, "onRequestPost");
async function onRequestGet3({ env, params }) {
  if (!/^[0-9a-f]{24}$/.test(params.id)) return new Response("Not found", { status: 404 });
  const { value, metadata } = await env.HUB_KV.getWithMetadata("media:" + params.id, "arrayBuffer");
  if (!value) return new Response("Not found", { status: 404 });
  return new Response(value, { headers: {
    "content-type": metadata && metadata.type || "application/octet-stream",
    "cache-control": "private, max-age=86400"
  } });
}
__name(onRequestGet3, "onRequestGet3");
__name2(onRequestGet3, "onRequestGet");
var cache = { at: 0, sites: [] };
async function sites(ctx) {
  if (Date.now() - cache.at < 6e4) return cache.sites;
  try {
    const cfg = await hubContent(ctx);
    cache = { at: Date.now(), sites: (cfg.sites || []).filter((s) => s.path && s.origin) };
  } catch (e) {
    cache = { at: Date.now(), sites: [] };
  }
  return cache.sites;
}
__name(sites, "sites");
__name2(sites, "sites");
var PASS_HEADERS = ["accept", "accept-encoding", "accept-language", "range", "if-none-match", "if-modified-since", "user-agent"];
async function onRequest2(ctx) {
  const url = new URL(ctx.request.url);
  const m = url.pathname.match(/^\/([A-Za-z0-9_-]+)(\/.*)?$/);
  if (!m || !["GET", "HEAD"].includes(ctx.request.method)) return ctx.next();
  const site = (await sites(ctx)).find((s) => s.path === m[1]);
  if (!site) return ctx.next();
  if (!m[2]) return Response.redirect(`${url.origin}/${site.path}/${url.search}`, 301);
  const origin = site.origin.replace(/\/+$/, "");
  const headers = new Headers();
  for (const h of PASS_HEADERS) {
    const v = ctx.request.headers.get(h);
    if (v) headers.set(h, v);
  }
  if (ctx.env.HUB_SECRET) headers.set("x-hub-secret", ctx.env.HUB_SECRET);
  if (ctx.env.ACCESS_CLIENT_ID && ctx.env.ACCESS_CLIENT_SECRET) {
    headers.set("CF-Access-Client-Id", ctx.env.ACCESS_CLIENT_ID);
    headers.set("CF-Access-Client-Secret", ctx.env.ACCESS_CLIENT_SECRET);
  }
  const upstream = await fetch(origin + m[2] + url.search, { method: ctx.request.method, headers, redirect: "manual" });
  const out = new Headers(upstream.headers);
  const loc = out.get("location");
  if (loc) {
    const target = new URL(loc, origin + "/");
    if (target.origin === new URL(origin).origin) out.set("location", `/${site.path}${target.pathname}${target.search}`);
  }
  return new Response(upstream.body, { status: upstream.status, statusText: upstream.statusText, headers: out });
}
__name(onRequest2, "onRequest2");
__name2(onRequest2, "onRequest");
var OPEN = /* @__PURE__ */ new Set([
  "/login",
  "/login.html",
  "/login.js",
  "/hub.css",
  "/fonts.css",
  "/favicon.svg",
  "/favicon-32.png",
  "/apple-touch-icon.png",
  "/api/login",
  "/api/signup"
]);
var ADMIN = /* @__PURE__ */ __name2((p) => p === "/admin" || p === "/admin.html" || p === "/admin.js" || p.startsWith("/api/admin/"), "ADMIN");
var SETUP = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Setup needed</title><body style="font:16px/1.5 system-ui,sans-serif;max-width:560px;margin:60px auto;padding:0 16px">
<h1>Sign-in isn't set up yet</h1><p>This site needs a Cloudflare KV namespace bound as <code>HUB_KV</code>
(Pages project \u2192 Settings \u2192 Bindings). See the README.</p></body>`;
async function onRequest3(ctx) {
  const url = new URL(ctx.request.url);
  const path = url.pathname.replace(/\/+$/, "") || "/";
  if (!ctx.env.HUB_KV) return new Response(SETUP, { status: 503, headers: { "content-type": "text/html; charset=utf-8" } });
  const session = await getSession(ctx.env, ctx.request);
  if (OPEN.has(path) || path.startsWith("/fonts/")) {
    if (session && (path === "/login" || path === "/login.html")) return Response.redirect(url.origin + safeNext(url), 302);
    return ctx.next();
  }
  if (!session) {
    if (path.startsWith("/api/")) return json({ error: "Signed out" }, 401);
    return Response.redirect(`${url.origin}/login?next=${encodeURIComponent(url.pathname + url.search)}`, 302);
  }
  if (ADMIN(path) && session.role !== "admin") {
    return path.startsWith("/api/") ? json({ error: "Admin only" }, 403) : Response.redirect(url.origin + "/", 302);
  }
  ctx.data.session = session;
  const res = await ctx.next();
  const out = new Response(res.body, res);
  out.headers.set("cache-control", "private, no-store");
  return out;
}
__name(onRequest3, "onRequest3");
__name2(onRequest3, "onRequest");
function safeNext(url) {
  const n = url.searchParams.get("next") || "/";
  return /^\/(?!\/)/.test(n) ? n : "/";
}
__name(safeNext, "safeNext");
__name2(safeNext, "safeNext");
var routes = [
  {
    routePath: "/api/admin/:route*",
    mountPath: "/api/admin",
    method: "",
    middlewares: [],
    modules: [onRequest]
  },
  {
    routePath: "/api/hub",
    mountPath: "/api",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet]
  },
  {
    routePath: "/api/login",
    mountPath: "/api",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost]
  },
  {
    routePath: "/api/logout",
    mountPath: "/api",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost2]
  },
  {
    routePath: "/api/me",
    mountPath: "/api",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet2]
  },
  {
    routePath: "/api/signup",
    mountPath: "/api",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost3]
  },
  {
    routePath: "/media/:id",
    mountPath: "/media",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet3]
  },
  {
    routePath: "/:path*",
    mountPath: "/",
    method: "",
    middlewares: [],
    modules: [onRequest2]
  },
  {
    routePath: "/",
    mountPath: "/",
    method: "",
    middlewares: [onRequest3],
    modules: []
  }
];
function lexer(str) {
  var tokens = [];
  var i = 0;
  while (i < str.length) {
    var char = str[i];
    if (char === "*" || char === "+" || char === "?") {
      tokens.push({ type: "MODIFIER", index: i, value: str[i++] });
      continue;
    }
    if (char === "\\") {
      tokens.push({ type: "ESCAPED_CHAR", index: i++, value: str[i++] });
      continue;
    }
    if (char === "{") {
      tokens.push({ type: "OPEN", index: i, value: str[i++] });
      continue;
    }
    if (char === "}") {
      tokens.push({ type: "CLOSE", index: i, value: str[i++] });
      continue;
    }
    if (char === ":") {
      var name = "";
      var j = i + 1;
      while (j < str.length) {
        var code = str.charCodeAt(j);
        if (
          // `0-9`
          code >= 48 && code <= 57 || // `A-Z`
          code >= 65 && code <= 90 || // `a-z`
          code >= 97 && code <= 122 || // `_`
          code === 95
        ) {
          name += str[j++];
          continue;
        }
        break;
      }
      if (!name)
        throw new TypeError("Missing parameter name at ".concat(i));
      tokens.push({ type: "NAME", index: i, value: name });
      i = j;
      continue;
    }
    if (char === "(") {
      var count = 1;
      var pattern = "";
      var j = i + 1;
      if (str[j] === "?") {
        throw new TypeError('Pattern cannot start with "?" at '.concat(j));
      }
      while (j < str.length) {
        if (str[j] === "\\") {
          pattern += str[j++] + str[j++];
          continue;
        }
        if (str[j] === ")") {
          count--;
          if (count === 0) {
            j++;
            break;
          }
        } else if (str[j] === "(") {
          count++;
          if (str[j + 1] !== "?") {
            throw new TypeError("Capturing groups are not allowed at ".concat(j));
          }
        }
        pattern += str[j++];
      }
      if (count)
        throw new TypeError("Unbalanced pattern at ".concat(i));
      if (!pattern)
        throw new TypeError("Missing pattern at ".concat(i));
      tokens.push({ type: "PATTERN", index: i, value: pattern });
      i = j;
      continue;
    }
    tokens.push({ type: "CHAR", index: i, value: str[i++] });
  }
  tokens.push({ type: "END", index: i, value: "" });
  return tokens;
}
__name(lexer, "lexer");
__name2(lexer, "lexer");
function parse(str, options) {
  if (options === void 0) {
    options = {};
  }
  var tokens = lexer(str);
  var _a = options.prefixes, prefixes = _a === void 0 ? "./" : _a, _b = options.delimiter, delimiter = _b === void 0 ? "/#?" : _b;
  var result = [];
  var key = 0;
  var i = 0;
  var path = "";
  var tryConsume = /* @__PURE__ */ __name2(function(type) {
    if (i < tokens.length && tokens[i].type === type)
      return tokens[i++].value;
  }, "tryConsume");
  var mustConsume = /* @__PURE__ */ __name2(function(type) {
    var value2 = tryConsume(type);
    if (value2 !== void 0)
      return value2;
    var _a2 = tokens[i], nextType = _a2.type, index = _a2.index;
    throw new TypeError("Unexpected ".concat(nextType, " at ").concat(index, ", expected ").concat(type));
  }, "mustConsume");
  var consumeText = /* @__PURE__ */ __name2(function() {
    var result2 = "";
    var value2;
    while (value2 = tryConsume("CHAR") || tryConsume("ESCAPED_CHAR")) {
      result2 += value2;
    }
    return result2;
  }, "consumeText");
  var isSafe = /* @__PURE__ */ __name2(function(value2) {
    for (var _i = 0, delimiter_1 = delimiter; _i < delimiter_1.length; _i++) {
      var char2 = delimiter_1[_i];
      if (value2.indexOf(char2) > -1)
        return true;
    }
    return false;
  }, "isSafe");
  var safePattern = /* @__PURE__ */ __name2(function(prefix2) {
    var prev = result[result.length - 1];
    var prevText = prefix2 || (prev && typeof prev === "string" ? prev : "");
    if (prev && !prevText) {
      throw new TypeError('Must have text between two parameters, missing text after "'.concat(prev.name, '"'));
    }
    if (!prevText || isSafe(prevText))
      return "[^".concat(escapeString(delimiter), "]+?");
    return "(?:(?!".concat(escapeString(prevText), ")[^").concat(escapeString(delimiter), "])+?");
  }, "safePattern");
  while (i < tokens.length) {
    var char = tryConsume("CHAR");
    var name = tryConsume("NAME");
    var pattern = tryConsume("PATTERN");
    if (name || pattern) {
      var prefix = char || "";
      if (prefixes.indexOf(prefix) === -1) {
        path += prefix;
        prefix = "";
      }
      if (path) {
        result.push(path);
        path = "";
      }
      result.push({
        name: name || key++,
        prefix,
        suffix: "",
        pattern: pattern || safePattern(prefix),
        modifier: tryConsume("MODIFIER") || ""
      });
      continue;
    }
    var value = char || tryConsume("ESCAPED_CHAR");
    if (value) {
      path += value;
      continue;
    }
    if (path) {
      result.push(path);
      path = "";
    }
    var open = tryConsume("OPEN");
    if (open) {
      var prefix = consumeText();
      var name_1 = tryConsume("NAME") || "";
      var pattern_1 = tryConsume("PATTERN") || "";
      var suffix = consumeText();
      mustConsume("CLOSE");
      result.push({
        name: name_1 || (pattern_1 ? key++ : ""),
        pattern: name_1 && !pattern_1 ? safePattern(prefix) : pattern_1,
        prefix,
        suffix,
        modifier: tryConsume("MODIFIER") || ""
      });
      continue;
    }
    mustConsume("END");
  }
  return result;
}
__name(parse, "parse");
__name2(parse, "parse");
function match(str, options) {
  var keys = [];
  var re = pathToRegexp(str, keys, options);
  return regexpToFunction(re, keys, options);
}
__name(match, "match");
__name2(match, "match");
function regexpToFunction(re, keys, options) {
  if (options === void 0) {
    options = {};
  }
  var _a = options.decode, decode = _a === void 0 ? function(x) {
    return x;
  } : _a;
  return function(pathname) {
    var m = re.exec(pathname);
    if (!m)
      return false;
    var path = m[0], index = m.index;
    var params = /* @__PURE__ */ Object.create(null);
    var _loop_1 = /* @__PURE__ */ __name2(function(i2) {
      if (m[i2] === void 0)
        return "continue";
      var key = keys[i2 - 1];
      if (key.modifier === "*" || key.modifier === "+") {
        params[key.name] = m[i2].split(key.prefix + key.suffix).map(function(value) {
          return decode(value, key);
        });
      } else {
        params[key.name] = decode(m[i2], key);
      }
    }, "_loop_1");
    for (var i = 1; i < m.length; i++) {
      _loop_1(i);
    }
    return { path, index, params };
  };
}
__name(regexpToFunction, "regexpToFunction");
__name2(regexpToFunction, "regexpToFunction");
function escapeString(str) {
  return str.replace(/([.+*?=^!:${}()[\]|/\\])/g, "\\$1");
}
__name(escapeString, "escapeString");
__name2(escapeString, "escapeString");
function flags(options) {
  return options && options.sensitive ? "" : "i";
}
__name(flags, "flags");
__name2(flags, "flags");
function regexpToRegexp(path, keys) {
  if (!keys)
    return path;
  var groupsRegex = /\((?:\?<(.*?)>)?(?!\?)/g;
  var index = 0;
  var execResult = groupsRegex.exec(path.source);
  while (execResult) {
    keys.push({
      // Use parenthesized substring match if available, index otherwise
      name: execResult[1] || index++,
      prefix: "",
      suffix: "",
      modifier: "",
      pattern: ""
    });
    execResult = groupsRegex.exec(path.source);
  }
  return path;
}
__name(regexpToRegexp, "regexpToRegexp");
__name2(regexpToRegexp, "regexpToRegexp");
function arrayToRegexp(paths, keys, options) {
  var parts = paths.map(function(path) {
    return pathToRegexp(path, keys, options).source;
  });
  return new RegExp("(?:".concat(parts.join("|"), ")"), flags(options));
}
__name(arrayToRegexp, "arrayToRegexp");
__name2(arrayToRegexp, "arrayToRegexp");
function stringToRegexp(path, keys, options) {
  return tokensToRegexp(parse(path, options), keys, options);
}
__name(stringToRegexp, "stringToRegexp");
__name2(stringToRegexp, "stringToRegexp");
function tokensToRegexp(tokens, keys, options) {
  if (options === void 0) {
    options = {};
  }
  var _a = options.strict, strict = _a === void 0 ? false : _a, _b = options.start, start = _b === void 0 ? true : _b, _c = options.end, end = _c === void 0 ? true : _c, _d = options.encode, encode = _d === void 0 ? function(x) {
    return x;
  } : _d, _e = options.delimiter, delimiter = _e === void 0 ? "/#?" : _e, _f = options.endsWith, endsWith = _f === void 0 ? "" : _f;
  var endsWithRe = "[".concat(escapeString(endsWith), "]|$");
  var delimiterRe = "[".concat(escapeString(delimiter), "]");
  var route = start ? "^" : "";
  for (var _i = 0, tokens_1 = tokens; _i < tokens_1.length; _i++) {
    var token = tokens_1[_i];
    if (typeof token === "string") {
      route += escapeString(encode(token));
    } else {
      var prefix = escapeString(encode(token.prefix));
      var suffix = escapeString(encode(token.suffix));
      if (token.pattern) {
        if (keys)
          keys.push(token);
        if (prefix || suffix) {
          if (token.modifier === "+" || token.modifier === "*") {
            var mod = token.modifier === "*" ? "?" : "";
            route += "(?:".concat(prefix, "((?:").concat(token.pattern, ")(?:").concat(suffix).concat(prefix, "(?:").concat(token.pattern, "))*)").concat(suffix, ")").concat(mod);
          } else {
            route += "(?:".concat(prefix, "(").concat(token.pattern, ")").concat(suffix, ")").concat(token.modifier);
          }
        } else {
          if (token.modifier === "+" || token.modifier === "*") {
            throw new TypeError('Can not repeat "'.concat(token.name, '" without a prefix and suffix'));
          }
          route += "(".concat(token.pattern, ")").concat(token.modifier);
        }
      } else {
        route += "(?:".concat(prefix).concat(suffix, ")").concat(token.modifier);
      }
    }
  }
  if (end) {
    if (!strict)
      route += "".concat(delimiterRe, "?");
    route += !options.endsWith ? "$" : "(?=".concat(endsWithRe, ")");
  } else {
    var endToken = tokens[tokens.length - 1];
    var isEndDelimited = typeof endToken === "string" ? delimiterRe.indexOf(endToken[endToken.length - 1]) > -1 : endToken === void 0;
    if (!strict) {
      route += "(?:".concat(delimiterRe, "(?=").concat(endsWithRe, "))?");
    }
    if (!isEndDelimited) {
      route += "(?=".concat(delimiterRe, "|").concat(endsWithRe, ")");
    }
  }
  return new RegExp(route, flags(options));
}
__name(tokensToRegexp, "tokensToRegexp");
__name2(tokensToRegexp, "tokensToRegexp");
function pathToRegexp(path, keys, options) {
  if (path instanceof RegExp)
    return regexpToRegexp(path, keys);
  if (Array.isArray(path))
    return arrayToRegexp(path, keys, options);
  return stringToRegexp(path, keys, options);
}
__name(pathToRegexp, "pathToRegexp");
__name2(pathToRegexp, "pathToRegexp");
var escapeRegex = /[.+?^${}()|[\]\\]/g;
function* executeRequest(request) {
  const requestPath = new URL(request.url).pathname;
  for (const route of [...routes].reverse()) {
    if (route.method && route.method !== request.method) {
      continue;
    }
    const routeMatcher = match(route.routePath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const mountMatcher = match(route.mountPath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const matchResult = routeMatcher(requestPath);
    const mountMatchResult = mountMatcher(requestPath);
    if (matchResult && mountMatchResult) {
      for (const handler of route.middlewares.flat()) {
        yield {
          handler,
          params: matchResult.params,
          path: mountMatchResult.path
        };
      }
    }
  }
  for (const route of routes) {
    if (route.method && route.method !== request.method) {
      continue;
    }
    const routeMatcher = match(route.routePath.replace(escapeRegex, "\\$&"), {
      end: true
    });
    const mountMatcher = match(route.mountPath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const matchResult = routeMatcher(requestPath);
    const mountMatchResult = mountMatcher(requestPath);
    if (matchResult && mountMatchResult && route.modules.length) {
      for (const handler of route.modules.flat()) {
        yield {
          handler,
          params: matchResult.params,
          path: matchResult.path
        };
      }
      break;
    }
  }
}
__name(executeRequest, "executeRequest");
__name2(executeRequest, "executeRequest");
var pages_template_worker_default = {
  async fetch(originalRequest, env, workerContext) {
    let request = originalRequest;
    const handlerIterator = executeRequest(request);
    let data = {};
    let isFailOpen = false;
    const next = /* @__PURE__ */ __name2(async (input, init) => {
      if (input !== void 0) {
        let url = input;
        if (typeof input === "string") {
          url = new URL(input, request.url).toString();
        }
        request = new Request(url, init);
      }
      const result = handlerIterator.next();
      if (result.done === false) {
        const { handler, params, path } = result.value;
        const context = {
          request: new Request(request.clone()),
          functionPath: path,
          next,
          params,
          get data() {
            return data;
          },
          set data(value) {
            if (typeof value !== "object" || value === null) {
              throw new Error("context.data must be an object");
            }
            data = value;
          },
          env,
          waitUntil: workerContext.waitUntil.bind(workerContext),
          passThroughOnException: /* @__PURE__ */ __name2(() => {
            isFailOpen = true;
          }, "passThroughOnException")
        };
        const response = await handler(context);
        if (!(response instanceof Response)) {
          throw new Error("Your Pages function should return a Response");
        }
        return cloneResponse(response);
      } else if ("ASSETS") {
        const response = await env["ASSETS"].fetch(request);
        return cloneResponse(response);
      } else {
        const response = await fetch(request);
        return cloneResponse(response);
      }
    }, "next");
    try {
      return await next();
    } catch (error) {
      if (isFailOpen) {
        const response = await env["ASSETS"].fetch(request);
        return cloneResponse(response);
      }
      throw error;
    }
  }
};
var cloneResponse = /* @__PURE__ */ __name2((response) => (
  // https://fetch.spec.whatwg.org/#null-body-status
  new Response(
    [101, 204, 205, 304].includes(response.status) ? null : response.body,
    response
  )
), "cloneResponse");
var drainBody = /* @__PURE__ */ __name2(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
__name2(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name2(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    const body = JSON.stringify(error);
    const headers = {
      "Content-Type": "application/json",
      "MF-Experimental-Error-Stack": "true"
    };
    const encoded = encodeURIComponent(body);
    if (encoded.length <= 8192) {
      headers["MF-Experimental-Error-Stack-Payload"] = encoded;
    }
    return new Response(body, { status: 500, headers });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = pages_template_worker_default;
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
__name2(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
__name2(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");
__name2(__facade_invoke__, "__facade_invoke__");
var __Facade_ScheduledController__ = class ___Facade_ScheduledController__ {
  static {
    __name(this, "___Facade_ScheduledController__");
  }
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  scheduledTime;
  cron;
  static {
    __name2(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name2(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name2(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
__name2(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name2((request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name2((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
__name2(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;

// ../../../tmp/claude-0/-home-user/6ca00525-99ca-5dee-8001-26f247bb52cf/scratchpad/wr/node_modules/wrangler/templates/pages-dev-util.ts
function isRoutingRuleMatch(pathname, routingRule) {
  if (!pathname) {
    throw new Error("Pathname is undefined.");
  }
  if (!routingRule) {
    throw new Error("Routing rule is undefined.");
  }
  const ruleRegExp = transformRoutingRuleToRegExp(routingRule);
  return pathname.match(ruleRegExp) !== null;
}
__name(isRoutingRuleMatch, "isRoutingRuleMatch");
function transformRoutingRuleToRegExp(rule) {
  let transformedRule;
  if (rule === "/" || rule === "/*") {
    transformedRule = rule;
  } else if (rule.endsWith("/*")) {
    transformedRule = `${rule.substring(0, rule.length - 2)}(/*)?`;
  } else if (rule.endsWith("/")) {
    transformedRule = `${rule.substring(0, rule.length - 1)}(/)?`;
  } else if (rule.endsWith("*")) {
    transformedRule = rule;
  } else {
    transformedRule = `${rule}(/)?`;
  }
  transformedRule = `^${transformedRule.replaceAll(/\./g, "\\.").replaceAll(/\*/g, ".*")}$`;
  return new RegExp(transformedRule);
}
__name(transformRoutingRuleToRegExp, "transformRoutingRuleToRegExp");

// .wrangler/tmp/pages-3GkTIM/rbfyl1rar1q.js
var define_ROUTES_default = {
  version: 1,
  include: ["/*"],
  exclude: []
};
var routes2 = define_ROUTES_default;
var pages_dev_pipeline_default = {
  fetch(request, env, context) {
    const { pathname } = new URL(request.url);
    for (const exclude of routes2.exclude) {
      if (isRoutingRuleMatch(pathname, exclude)) {
        return env.ASSETS.fetch(request);
      }
    }
    for (const include of routes2.include) {
      if (isRoutingRuleMatch(pathname, include)) {
        const workerAsHandler = middleware_loader_entry_default;
        if (workerAsHandler.fetch === void 0) {
          throw new TypeError("Entry point missing `fetch` handler");
        }
        return workerAsHandler.fetch(request, env, context);
      }
    }
    return env.ASSETS.fetch(request);
  }
};

// ../../../tmp/claude-0/-home-user/6ca00525-99ca-5dee-8001-26f247bb52cf/scratchpad/wr/node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody2 = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default2 = drainBody2;

// ../../../tmp/claude-0/-home-user/6ca00525-99ca-5dee-8001-26f247bb52cf/scratchpad/wr/node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError2(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError2(e.cause)
  };
}
__name(reduceError2, "reduceError");
var jsonError2 = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError2(e);
    const body = JSON.stringify(error);
    const headers = {
      "Content-Type": "application/json",
      "MF-Experimental-Error-Stack": "true"
    };
    const encoded = encodeURIComponent(body);
    if (encoded.length <= 8192) {
      headers["MF-Experimental-Error-Stack-Payload"] = encoded;
    }
    return new Response(body, { status: 500, headers });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default2 = jsonError2;

// .wrangler/tmp/bundle-cDwLqz/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__2 = [
  middleware_ensure_req_body_drained_default2,
  middleware_miniflare3_json_error_default2
];
var middleware_insertion_facade_default2 = pages_dev_pipeline_default;

// ../../../tmp/claude-0/-home-user/6ca00525-99ca-5dee-8001-26f247bb52cf/scratchpad/wr/node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__2 = [];
function __facade_register__2(...args) {
  __facade_middleware__2.push(...args.flat());
}
__name(__facade_register__2, "__facade_register__");
function __facade_invokeChain__2(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__2(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__2, "__facade_invokeChain__");
function __facade_invoke__2(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__2(request, env, ctx, dispatch, [
    ...__facade_middleware__2,
    finalMiddleware
  ]);
}
__name(__facade_invoke__2, "__facade_invoke__");

// .wrangler/tmp/bundle-cDwLqz/middleware-loader.entry.ts
var __Facade_ScheduledController__2 = class ___Facade_ScheduledController__2 {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  scheduledTime;
  cron;
  static {
    __name(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__2)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler2(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__2 === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__2.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__2) {
    __facade_register__2(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__2(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__2(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler2, "wrapExportedHandler");
function wrapWorkerEntrypoint2(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__2 === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__2.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__2) {
    __facade_register__2(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name((request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__2(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__2(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint2, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY2;
if (typeof middleware_insertion_facade_default2 === "object") {
  WRAPPED_ENTRY2 = wrapExportedHandler2(middleware_insertion_facade_default2);
} else if (typeof middleware_insertion_facade_default2 === "function") {
  WRAPPED_ENTRY2 = wrapWorkerEntrypoint2(middleware_insertion_facade_default2);
}
var middleware_loader_entry_default2 = WRAPPED_ENTRY2;
export {
  __INTERNAL_WRANGLER_MIDDLEWARE__2 as __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default2 as default
};
//# sourceMappingURL=rbfyl1rar1q.js.map
