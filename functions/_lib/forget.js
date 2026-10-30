// Everything kept for one account, deleted together when the account is deleted (by its owner, /api/account, or by
// the admin console), so the Privacy Policy's "deleted straight away" is true. Bans (functions/_lib/bans.js) are kept
// on purpose until the ban is lifted. Leaderboard rows (board:<code>:<id>) are left to expire: they're only shown for
// accounts that still exist (functions/api/share.js).
import { forget as forgetActivity } from './activity.js';
import { fixKey } from './mockfix.js';
import { forgetUpd } from './updates.js';

async function dropPrefix(kv, prefix, also) {
  let cursor;
  do {
    const r = await kv.list({ prefix, cursor });
    for (const k of r.keys) {
      if (also) await also(k.name);
      await kv.delete(k.name);
    }
    cursor = r.list_complete ? null : r.cursor;
  } while (cursor);
}

export async function forgetAccount(env, id) {
  const kv = env.HUB_KV;
  for (const k of ['prog:', 'prefs:', 'consent:', 'ecode:', 'note:']) await kv.delete(k + id);
  await kv.delete(fixKey(id));
  await forgetUpd(env, id);
  await dropPrefix(kv, 'reply:' + id + ':');   // its answers to admin messages
  // the mocks it shared: the codes stop working, so its username isn't shown on them any more
  await dropPrefix(kv, 'shared:' + id + ':', async name => {
    const code = await kv.get(name);
    if (code) await kv.delete('share:' + code);
  });
  await forgetActivity(env, id);
}
