// Admin fixes to an account's handed-in mocks (Admin console → accounts → manage → mocks): a mock handed in by
// accident removed, or its score or grade corrected. The subject sites keep a copy of your progress in the browser and
// merge it with the stored one (the browser's copy wins), so a fix made only to the stored copy would come straight
// back. So each fix is also kept under mockfix:<account> and applied
//   - to the stored progress every time it's read or saved (functions/api/progress.js), and
//   - to the browser's copy, by a small script put at the top of every page while the account's sessions carry the
//     `mockfix` flag (functions/_middleware.js), before the subject site's own script reads it.
// mockfix:<account> = { t, gone: { <mockId>: removedAt }, edit: { <mockId>: { got, max, pct, grade } }, clear? }
// clear (Admin console → manage → clear progress) is when the account's progress was wiped: every question marked and
// mock handed in (or started) before then is dropped, wherever a copy of it turns up.
import { listSessions } from './auth.js';

export const fixKey = id => 'mockfix:' + id;

export function applyFix(prog, fix) {
  if (!prog || !fix || !Array.isArray(prog.mocks)) return prog;
  if (fix.clear) {
    for (const k of Object.keys(prog.items || {})) if (!prog.items[k] || prog.items[k].t <= fix.clear) delete prog.items[k];
    prog.mocks = prog.mocks.filter(m => m && m.t > fix.clear);
    if (prog.plan && (prog.plan.t || 0) <= fix.clear) prog.plan = null;
  }
  prog.mocks = prog.mocks.filter(m => m && !(fix.gone || {})[m.id]);
  for (const m of prog.mocks) if ((fix.edit || {})[m.id]) Object.assign(m, fix.edit[m.id]);
  return prog;
}

// the same as applyFix, for the browser's copy (localStorage jbr-progress-v1:<who>, _lib/who.js), as an inline script;
// a clear also drops the mock papers started before it (jbr-mocks-<subject>:<who>)
export function fixScript(fix, who) {
  const data = JSON.stringify({ gone: fix.gone || {}, edit: fix.edit || {}, clear: fix.clear || 0 }).replace(/</g, '\\u003c');
  return '<script>(function(){try{var f=' + data + ',w=' + JSON.stringify(':' + who) + ',k="jbr-progress-v1"+w,p=JSON.parse(localStorage.getItem(k));' +
    'if(f.clear)for(var i=localStorage.length-1;i>=0;i--){var q=localStorage.key(i);if(q&&q.indexOf("jbr-mocks-")===0&&q.slice(-w.length)===w){' +
    'var l=JSON.parse(localStorage.getItem(q))||[],r=l.filter(function(m){return m&&(m.created||0)>f.clear});if(r.length!==l.length)localStorage.setItem(q,JSON.stringify(r))}}' +
    'if(!p||!p.mocks)return;var n=JSON.stringify(p);' +
    'if(f.clear){for(var x in p.items)if(!p.items[x]||p.items[x].t<=f.clear)delete p.items[x];p.mocks=p.mocks.filter(function(m){return m&&m.t>f.clear});if(p.plan&&(p.plan.t||0)<=f.clear)p.plan=null}' +
    'p.mocks=p.mocks.filter(function(m){return m&&!f.gone[m.id]});' +
    'p.mocks.forEach(function(m){var e=f.edit[m.id];if(e)for(var y in e)m[y]=e[y]});' +
    'var o=JSON.stringify(p);if(o!==n)localStorage.setItem(k,o)}catch(e){}})()</script>';
}

// the account's sessions on every device pick the fix up on their next page
export async function setFixFlag(env, accountId, t) {
  for (const s of await listSessions(env)) {
    if (s.accountId !== accountId || s.mockfix === t) continue;
    const { token, ...info } = s;
    info.mockfix = t;
    await env.HUB_KV.put('sess:' + token, JSON.stringify(info), { expiration: Math.floor(info.expires / 1000), metadata: info });
  }
}

// wipe an account's progress (Admin console → manage → clear progress, or Settings → Clear my progress). Its browsers
// keep a copy and sync it back, so the time of the wipe is kept with its mock fixes and everything from before it is
// dropped from every copy, stored or in a browser. Returns how much there was.
export async function wipeProgress(env, id) {
  const fix = (await env.HUB_KV.get(fixKey(id), 'json')) || { t: 0, gone: {}, edit: {} };
  const prog = await env.HUB_KV.get('prog:' + id, 'json');
  const was = { questions: Object.keys((prog && prog.items) || {}).length, mocks: ((prog && prog.mocks) || []).length };
  // their mocks' share codes stop working too
  for (const m of (prog && prog.mocks) || []) {
    if (m && m.share) await env.HUB_KV.delete('share:' + m.share);
    if (m && m.id) await env.HUB_KV.delete('shared:' + id + ':' + String(m.id).slice(0, 40));
  }
  fix.clear = fix.t = Date.now();
  await env.HUB_KV.put(fixKey(id), JSON.stringify(fix));
  await env.HUB_KV.put('prog:' + id, JSON.stringify({ v: 1, items: {}, mocks: [], plan: null, t: fix.t }));
  await setFixFlag(env, id, fix.t);
  return was;
}
