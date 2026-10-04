// The deployment log: a row for every time Cloudflare deployed the main site, a subject site or the email Worker, with
// what went out. Cloudflare marks each commit it builds with a GitHub "check run" (holding that deployment's own
// address), so GitHub is the record: sync() looks at the repositories every so often (whenever the log is read, at most
// every 10 minutes) and adds any new deployments. Everything from before the log existed (the first deployment was on
// 3 October 2026) was imported from the same check runs, with the files each deployment changed (admin API, POST
// deploylog). The owner's Google Sheet reads it as CSV (/deploys/<key>/log.csv), each row linking to a PDF record of
// that deployment (/deploys/<key>/<n>.pdf) and to the version itself (/v/<n>/, admins only).
// KV: deploylog = {next, entries: [short entries], gh: {repo: {etag, done: [shas already looked at]}}}
//     deploylog:b:<n> = {id: {c: commits, f: files}} for entries n*50+1 ... n*50+50
//     deploylog:sync = {at, error, added, calls}     deploylog:key = SHA-256 of the key in the sheet's links
import { sha256 } from './keys.js';
import { Pdf, PAGE, textWidth } from './pdf.js';

export const OWNER = 'joshbhattessa-max';
export const SOURCES = [
  { repo: 'revision-hub', branch: 'main', id: 'hub', name: 'Main site', color: '#33312e' },
  { repo: 'examq_cop', branch: 'claude/sweet-fermat-99vh9o', id: 'chemistry', name: 'ChemQ (Chemistry)', color: '#17a398' },
  { repo: 'bioq', branch: 'main', id: 'biology', name: 'BioQ (Biology)', color: '#2e9e4f' },
  { repo: 'physq', branch: 'main', id: 'physics', name: 'PhysQ (Physics)', color: '#067bc2' },
  { repo: 'mathsq', branch: 'main', id: 'maths', name: 'MathsQ (Maths)', color: '#6750d5' },
  { repo: 'geoq', branch: 'main', id: 'geography', name: 'GeoQ (Geography)', color: '#c2711a' },
  { repo: 'csq', branch: 'main', id: 'computer-science', name: 'CSQ (Computer Science)', color: '#5b5852' },
  { repo: 'spanishq', branch: 'main', id: 'spanish', name: 'SpanishQ (Spanish)', color: '#e0453a' },
];
const BLOCK = 50;
const EVERY = 10 * 60 * 1000;
const RELEASE = /^Release( \d{8}-\d{6})?(:|$)/;

// what a check run deployed: {proj, site}, or null for checks that aren't deployments
export function project(repo, check) {
  const src = SOURCES.find(s => s.repo === repo);
  if (check === 'Cloudflare Pages' && src) return { proj: src.id, site: src.name };
  const m = /^(Workers Builds|Cloudflare Pages): (.+)$/.exec(check || '');
  if (!m) return null;
  if (m[1] === 'Workers Builds' && m[2] === 'jbr-mail') return { proj: 'worker:jbr-mail', site: 'Email Worker (jbr-mail)' };
  const worker = m[1] === 'Workers Builds';
  return { proj: (worker ? 'worker:' : 'pages:') + m[2], site: `${m[2]} (${worker ? 'Worker' : 'Pages project'})` };
}
export const isSite = proj => SOURCES.some(s => s.id === proj);

export async function load(env) {
  const log = (await env.HUB_KV.get('deploylog', 'json')) || {};
  return { next: log.next || 1, entries: log.entries || [], gh: log.gh || {} };
}
const blockKey = id => 'deploylog:b:' + Math.floor((id - 1) / BLOCK);
export async function details(env, id) {
  const b = await env.HUB_KV.get(blockKey(id), 'json');
  return (b && b[id]) || null;
}
export async function keyOk(env, key) {
  if (!/^[A-Za-z0-9_-]{20,80}$/.test(key || '')) return false;
  const h = await env.HUB_KV.get('deploylog:key');
  return !!h && h === await sha256(key);
}

// a commit as the log keeps it: {h, at, s: first line, b: the rest, without the Co-Authored-By/Claude-Session lines}
export function commitOf(sha, at, message) {
  const lines = String(message || '').replace(/\r/g, '').split('\n');
  const body = lines.slice(1).filter(l => !/^(Co-Authored-By|Claude-Session|Signed-off-by):/i.test(l)).join('\n').trim();
  return { h: sha, at, s: lines[0].trim().slice(0, 300), b: body.slice(0, 3000) };
}
// the newest release the deployment included
export function release(commits) {
  for (const c of [...(commits || [])].reverse()) { const m = /^Release (\d{8}-\d{6})/.exec(c.s); if (m) return m[1]; }
  return '';
}
// one line for the sheet: the real changes, or what the release steps did
export function summary(commits, first) {
  const real = (commits || []).map(c => c.s).filter(s => !RELEASE.test(s));
  if (first) return real.length > 6 ? `First deployment: everything up to then (${commits.length} commits)` : clip('First deployment: ' + (real.join('; ') || 'the project as it was'), 400);
  if (real.length) return clip(real.join('; '), 400);
  const s = (commits || []).map(c => c.s).join(' ');
  if (!s) return 'The same code built again (no new changes)';
  const parts = [];
  if (/tests failed/.test(s)) parts.push('Checks failed, so the maintenance page stayed up');
  else if (/maintenance mode on/.test(s)) parts.push('Maintenance page up with the countdown while the release went live');
  if (/maintenance mode off/.test(s)) parts.push('Maintenance page off (all checks passed)');
  if (/tidy up maintenance file/.test(s)) parts.push('Leftover maintenance file removed');
  if (/^Release \d{8}-\d{6}$/m.test((commits || []).map(c => c.s).join('\n'))) parts.push('Release stamp (version.json)');
  return parts.join('; ') || clip(s, 400);
}
const clip = (s, n) => s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s;

// adds entries, or fills in ones already there (matched by project and commit); returns how many were new
export async function upsert(env, log, items) {
  const byKey = new Map(log.entries.map(e => [e.k, e]));
  const blocks = {};
  let added = 0;
  // oldest first, so the numbers follow the order things happened
  for (const it of [...items].sort((a, b) => a.at - b.at)) {
    const k = it.proj + '@' + it.sha;
    let e = byKey.get(k);
    if (!e) { e = { id: log.next++, k }; log.entries.push(e); byKey.set(k, e); added++; }
    const bk = blockKey(e.id);
    if (!blocks[bk]) blocks[bk] = (await env.HUB_KV.get(bk, 'json')) || {};
    const old = blocks[bk][e.id] || {};
    const files = it.files || old.f || null;
    const first = !log.entries.some(x => x !== e && x.proj === it.proj && x.at < it.at);
    Object.assign(e, { proj: it.proj, site: it.site, repo: it.repo, sha: it.sha, at: it.at, ok: it.ok, url: it.url || '', dash: it.dash || '',
      rel: release(it.commits), t: summary(it.commits, first), n: it.commits.length, f: files ? files.n : -1 });
    blocks[bk][e.id] = { c: it.commits, f: files };
  }
  log.entries.sort((a, b) => a.at - b.at);
  for (const [bk, b] of Object.entries(blocks)) await env.HUB_KV.put(bk, JSON.stringify(b));
  await env.HUB_KV.put('deploylog', JSON.stringify(log));
  return added;
}

async function gh(env, path, etag) {
  const headers = { accept: 'application/vnd.github+json', 'user-agent': 'jbrevision-deploy-log', 'x-github-api-version': '2022-11-28' };
  if (etag) headers['if-none-match'] = etag;
  if (env.GITHUB_TOKEN) headers.authorization = 'Bearer ' + env.GITHUB_TOKEN;
  const r = await fetch('https://api.github.com' + path, { headers });
  if (r.status === 304) return { status: 304 };
  if (!r.ok) {
    const limited = r.status === 429 || (r.status === 403 && r.headers.get('x-ratelimit-remaining') === '0');
    throw Object.assign(new Error(limited ? 'GitHub is limiting requests for now (it tries again later)' : 'GitHub answered ' + r.status),
      { status: r.status, limited });
  }
  return { status: 200, etag: r.headers.get('etag') || '', data: await r.json() };
}
const previewUrl = summary => ((/href='(https:\/\/[0-9a-f]{8}\.[a-z0-9-]+\.pages\.dev)'/.exec(summary || '') || [])[1] || '');

// looks for deployments GitHub knows about and the log doesn't. A repository whose latest commits haven't changed
// costs nothing (GitHub doesn't count "not modified" answers); `max` caps the requests that do count. Private
// repositories (the subject sites') are only visible with a GITHUB_TOKEN secret; without one they're skipped, and
// their deployments come in through the import instead (POST deploylog, after each release).
export async function sync(env, max = 20) {
  const log = await load(env);
  const known = new Set(log.entries.map(e => e.k));
  const before = JSON.stringify(log.gh);
  const found = [], lists = {};
  let calls = 0, error = '';
  const hidden = [], failed = [];
  for (const src of SOURCES) {
    const st = log.gh[src.repo] || (log.gh[src.repo] = { etag: '', done: [] });
    // a repository GitHub wouldn't show is asked about again a day later (each "not found" counts against the limit)
    if (!env.GITHUB_TOKEN && st.hidden > Date.now()) { hidden.push(src.repo); continue; }
    try {
      const list = await gh(env, `/repos/${OWNER}/${src.repo}/commits?sha=${encodeURIComponent(src.branch)}&per_page=20`, st.etag);
      if (list.status === 304) continue;
      calls++;
      lists[src.repo] = new Map(list.data.map(c => [c.sha, c]));
      const done = new Set(st.done);
      let open = false;
      for (const c of list.data) {
        if (done.has(c.sha)) continue;
        if (calls >= max) { open = true; break; }
        calls++;
        const runs = (await gh(env, `/repos/${OWNER}/${src.repo}/commits/${c.sha}/check-runs?per_page=50`)).data.check_runs || [];
        const young = Date.now() - Date.parse(c.commit.committer.date) < 3600e3;
        // still building, or Cloudflare hasn't started yet: look again next time
        if (runs.some(r => r.status !== 'completed') || (!runs.length && young)) { open = true; continue; }
        for (const r of runs) {
          const p = project(src.repo, r.name);
          if (!p || !['success', 'failure'].includes(r.conclusion) || known.has(p.proj + '@' + c.sha)) continue;
          known.add(p.proj + '@' + c.sha);
          found.push({ ...p, repo: src.repo, sha: c.sha, at: Date.parse(r.completed_at || r.started_at), ok: r.conclusion === 'success',
            url: previewUrl(r.output && r.output.summary), dash: r.details_url || '' });
        }
        done.add(c.sha);
      }
      st.done = [...done].slice(-300);
      // until every recent commit is settled, fetch the list again next time rather than trusting "not modified"
      st.etag = open ? '' : list.etag;
    } catch (e) {
      if (e.limited) { error = e.message; break; }
      if (e.status === 404 && !env.GITHUB_TOKEN) { hidden.push(src.repo); st.hidden = Date.now() + 86400e3; }
      else failed.push(`${src.repo}: ${String(e && e.message || e).slice(0, 80)}`);
    }
  }
  if (!error) error = [...failed, hidden.length ? `not visible without a GITHUB_TOKEN: ${hidden.join(', ')}` : ''].filter(Boolean).join('; ');
  // what each new deployment included: its commits back to the one before it of the same project
  const last = {};
  for (const e of log.entries) if (e.ok) last[e.proj] = e.sha;
  for (const f of found.sort((a, b) => a.at - b.at)) {
    const commits = [], bySha = lists[f.repo];
    for (let sha = f.sha; sha && sha !== last[f.proj] && commits.length < 30 && bySha.has(sha); sha = (bySha.get(sha).parents[0] || {}).sha) {
      const c = bySha.get(sha);
      commits.push(commitOf(sha, Date.parse(c.commit.committer.date), c.commit.message));
    }
    f.commits = commits.reverse();
    f.files = null;
    if (f.ok) last[f.proj] = f.sha;
  }
  let added = 0;
  if (found.length) added = await upsert(env, log, found);
  else if (JSON.stringify(log.gh) !== before) await env.HUB_KV.put('deploylog', JSON.stringify(log));
  const result = { at: Date.now(), error, added, calls };
  await env.HUB_KV.put('deploylog:sync', JSON.stringify(result));
  return result;
}

// a sync if the last one was a while ago: waits up to `wait` ms for it, and lets the rest finish in the background
export async function maybeSync(ctx, wait = 5000) {
  const s = await ctx.env.HUB_KV.get('deploylog:sync', 'json');
  if (s && Date.now() - s.at < EVERY) return;
  await ctx.env.HUB_KV.put('deploylog:sync', JSON.stringify({ ...(s || {}), at: Date.now() }));  // claims this round
  const p = sync(ctx.env).catch(() => {});
  ctx.waitUntil(p);
  await Promise.race([p, new Promise(r => setTimeout(r, wait))]);
}

function london(ms, opts) {
  return Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', hourCycle: 'h23', ...opts })
    .formatToParts(new Date(ms)).map(p => [p.type, p.value]));
}
export function ukTime(ms) {
  const p = london(ms, { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}`;
}
function longTime(ms) {
  const p = london(ms, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });
  return `${p.weekday} ${p.day} ${p.month} ${p.year} at ${p.hour}:${p.minute}:${p.second}`;
}
function shortTime(ms) {
  const p = london(ms, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  return `${p.day} ${p.month} ${p.hour}:${p.minute}`;
}

// where "This version" goes: the version itself for the sites (admins only), otherwise Cloudflare's page for that build
export function versionLink(e, origin) {
  if (e.ok && (e.proj === 'hub' || (isSite(e.proj) && e.url))) return `${origin}/v/${e.id}/`;
  return e.dash || '';
}
const commitLink = e => `https://github.com/${OWNER}/${e.repo}/commit/${e.sha}`;

export function csv(log, origin, key) {
  const rows = [['No.', 'When (UK time)', 'Site', 'Release', 'What was included', 'Result', 'PDF record', 'This version', 'Code']];
  for (const e of [...log.entries].sort((a, b) => b.at - a.at || b.id - a.id)) {
    rows.push([e.id, ukTime(e.at), e.site, e.rel || '', e.t, e.ok ? 'Deployed' : 'Failed', `${origin}/deploys/${key}/${e.id}.pdf`,
      versionLink(e, origin), commitLink(e)]);
  }
  const cell = v => {
    let s = String(v ?? '').replace(/\r?\n/g, ' ');
    if (/^[=+@]/.test(s)) s = ' ' + s;  // never read as a formula
    return /[",]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  return rows.map(r => r.map(cell).join(',')).join('\r\n') + '\r\n';
}

const MUTED = '#6b6862', INK = '#33312e', LINE = '#e4e2dd', LINK = '#0b62a8';
const STEPS = [[/maintenance mode on/, 'The maintenance page (with its 3-minute countdown) went up while this release went live.'],
  [/maintenance mode off/, 'All the checks passed, so the maintenance page came down.'],
  [/tests failed/, 'A check failed, so the maintenance page stayed up until it was fixed.'],
  [/tidy up maintenance file/, 'The maintenance page had already come down by itself; this removed the file that held it.'],
  [/^Release \d{8}-\d{6}$/, 'Stamps the release number into version.json, so the release checks can tell when this version is live.']];

// commit messages are wrapped at about 72 characters: join the lines of each paragraph back up (lists stay as they are)
function reflow(s) {
  return s.split(/\n{2,}/).map(p => p.split('\n').reduce((out, line) => {
    if (!out.length || /^\s*([-*•]|\d+[.)])\s/.test(line) || /^\s{2,}/.test(line)) out.push(line.trim());
    else out[out.length - 1] += ' ' + line.trim();
    return out;
  }, []).join('\n')).join('\n\n');
}

export function fileName(e) {
  return `JB Revision deployment ${e.id} - ${e.site.replace(/[^\w ()-]/g, '')} - ${ukTime(e.at).replace(':', '.')}.pdf`;
}

// the PDF record of one deployment
export function recordPdf(log, e, det, origin) {
  const src = SOURCES.find(s => s.id === e.proj);
  const color = src ? src.color : '#f38020';
  const prev = [...log.entries].filter(x => x.proj === e.proj && x.ok && x.at < e.at).pop();
  const doc = new Pdf({ title: `JB Revision deployment ${e.id}: ${e.site}, ${ukTime(e.at)}`, author: 'JB Revision' });
  const L = PAGE.left;

  // header band
  doc.box(0, PAGE.h - 118, PAGE.w, 118, INK);
  doc.box(0, PAGE.h - 123, PAGE.w, 5, color);
  doc.at(L, PAGE.h - 46, 'JB REVISION  ·  DEPLOYMENT RECORD', { font: 'B', size: 9, color: '#c9c6bf' });
  doc.at(L, PAGE.h - 78, e.site, { font: 'B', size: 24, color: '#ffffff' });
  doc.at(L, PAGE.h - 101, longTime(e.at) + ' (UK time)', { size: 11, color: '#e4e2dd' });
  doc.y = PAGE.h - 150;

  const facts = [
    ['Deployment', `Number ${e.id} of ${log.entries.length} in the log`],
    ['Result', e.ok ? 'Deployed successfully' : 'Failed: Cloudflare couldn\'t build it, so the version before stayed live'],
    ['Release', e.rel ? `Part of release ${e.rel}` : 'Not part of a numbered release'],
    ['Commit', e.sha.slice(0, 7) + ' on GitHub', commitLink(e)],
    ['This version', versionLink(e, origin) ? (e.proj === 'hub' || isSite(e.proj) ? 'Open it (admin sign-in needed)' : 'Cloudflare\'s page for this build') : 'Not available', versionLink(e, origin)],
    ['Before this', prev ? `Deployment ${prev.id}, ${shortTime(prev.at)}` : `None: this was the first deployment of ${e.site}`],
  ];
  for (const [label, value, link] of facts) {
    const y0 = doc.y;
    doc.at(L, doc.y - 11.5, label.toUpperCase(), { font: 'B', size: 8, color: MUTED });
    doc.y = y0;
    doc.text(value, { size: 10.5, indent: 110, color: link ? LINK : INK, link, lead: 1.5 });
    doc.gap(3);
  }

  const heading = t => {
    doc.need(60);
    doc.gap(14);
    doc.text(t, { font: 'B', size: 14, after: 4 });
    doc.rule();
    doc.gap(8);
  };

  heading('What was included');
  const all = (det && det.c) || [], commits = all.slice(-25);
  if (all.length > commits.length) {
    doc.text(`${prev ? 'This deployment' : 'As the first deployment of ' + e.site + ', this'} included ${all.length} commits. ` +
      `The latest ${commits.length} are below; the commit link above leads to the rest.`, { size: 9.5, color: MUTED, after: 8 });
  }
  if (!all.length) doc.text(e.ok ? 'No new changes: the same code was built again.' : 'No new changes.', { color: MUTED });
  for (const c of commits) {
    doc.need(40);
    const y0 = doc.y;
    doc.at(L + 2, y0 - 11, '•', { font: 'B', size: 11, color });
    doc.text(c.s, { font: 'B', size: 10.5, indent: 14, lead: 1.42 });
    doc.text(`${c.h.slice(0, 7)}  ·  ${shortTime(c.at)}`, { size: 8, indent: 14, color: MUTED, lead: 1.5 });
    const step = RELEASE.test(c.s) && STEPS.find(([re]) => re.test(c.s));
    if (step) doc.text(step[1], { size: 9.5, indent: 14, color: '#4a4844' });
    if (c.b) doc.text(reflow(c.b), { size: 9.5, indent: 14, color: '#4a4844' });
    doc.gap(9);
  }

  heading('Files changed');
  const f = det && det.f;
  if (!f) {
    doc.text('The list of files wasn\'t kept for this deployment (it was picked up automatically from GitHub). The commit link above shows them.', { color: MUTED });
  } else {
    const part = (n, w) => n ? `${n.toLocaleString('en-GB')} ${w}` : '';
    doc.text(`${f.n.toLocaleString('en-GB')} file${f.n === 1 ? '' : 's'}: ` + [part(f.a, 'added'), part(f.m, 'changed'), part(f.d, 'removed')].filter(Boolean).join(', ') + '.', { size: 10.5, after: 4 });
    if (f.dirs && f.dirs.length > 1) doc.text('By folder: ' + f.dirs.map(([d, n]) => `${d} (${n.toLocaleString('en-GB')})`).join(', '), { size: 9.5, color: '#4a4844', after: 6 });
    const word = { A: 'added', M: 'changed', D: 'removed' };
    for (const [st, path] of f.list || []) {
      doc.need(12);
      const y0 = doc.y;
      doc.at(L, y0 - 8.3, word[st] || st, { size: 7.5, color: st === 'D' ? '#b3261e' : st === 'A' ? '#2e7d32' : MUTED });
      doc.y = y0;
      doc.text(path, { font: 'C', size: 8, indent: 52, lead: 1.4 });
    }
    const more = f.n - (f.list || []).length;
    if (more > 0) doc.text(`…and ${more.toLocaleString('en-GB')} more.`, { size: 9, color: MUTED, indent: 52 });
  }

  return doc.bytes((d, i, n) => {
    d.page.ops.push(`${'0.89 0.886 0.867'} RG 0.75 w ${L} 46 m ${PAGE.w - PAGE.right} 46 l S`);
    d.at(L, 32, `JB Revision  ·  deployment ${e.id}  ·  ${e.site}`, { size: 8, color: MUTED });
    const right = `Page ${i} of ${n}`;
    d.at(PAGE.w - PAGE.right - textWidth(right, 'H', 8), 32, right, { size: 8, color: MUTED });
  });
}
