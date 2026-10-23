// Admin fixes to an account's handed-in mocks (Admin console → accounts → manage → mocks): a mock handed in by
// accident removed, or its score or grade corrected. The subject sites keep a copy of your progress in the browser and
// merge it with the stored one (the browser's copy wins), so a fix made only to the stored copy would come straight
// back. So each fix is also kept under mockfix:<account> and applied
//   - to the stored progress every time it's read or saved (functions/api/progress.js), and
//   - to the browser's copy, by a small script put at the top of every page while the account's sessions carry the
//     `mockfix` flag (functions/_middleware.js), before the subject site's own script reads it.
// mockfix:<account> = { t, gone: { <mockId>: removedAt }, edit: { <mockId>: { got, max, pct, grade } } }
import { listSessions } from './auth.js';

export const fixKey = id => 'mockfix:' + id;

export function applyFix(prog, fix) {
  if (!prog || !fix || !Array.isArray(prog.mocks)) return prog;
  prog.mocks = prog.mocks.filter(m => m && !(fix.gone || {})[m.id]);
  for (const m of prog.mocks) if ((fix.edit || {})[m.id]) Object.assign(m, fix.edit[m.id]);
  return prog;
}

// the same as applyFix, for the browser's copy (localStorage jbr-progress-v1), as an inline script
export function fixScript(fix) {
  const data = JSON.stringify({ gone: fix.gone || {}, edit: fix.edit || {} }).replace(/</g, '\\u003c');
  return '<script>(function(){try{var f=' + data + ',k="jbr-progress-v1",p=JSON.parse(localStorage.getItem(k));' +
    'if(!p||!p.mocks)return;var n=JSON.stringify(p);p.mocks=p.mocks.filter(function(m){return m&&!f.gone[m.id]});' +
    'p.mocks.forEach(function(m){var e=f.edit[m.id];if(e)for(var x in e)m[x]=e[x]});' +
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
