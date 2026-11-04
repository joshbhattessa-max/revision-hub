// MTS Resources (/mts): a section only some accounts can see. Only the admin gives access (admin console → Accounts →
// MTS Resources); nobody can ask for it, and for everyone else /mts is a missing page. With access, they type their own
// password again on /mts to open it.
//   KV mts:<accountId> = { state: 'granted', granted }   (the metadata holds the same, for listing)
//   sessions carry  mts: true   while the account has access (so every page shows the top-bar link, mts-nav.js)
//               and mtsOpen: true once the password was typed in that session (it lasts as long as the sign-in)
import { listSessions } from './auth.js';

export const mtsKey = id => 'mts:' + id;

export async function getMts(env, id) {
  return (await env.HUB_KV.get(mtsKey(id), 'json')) || null;
}

export async function putMts(env, id, rec) {
  await env.HUB_KV.put(mtsKey(id), JSON.stringify(rec), { metadata: rec });
}

export async function listMts(env) {
  const out = [];
  let cursor;
  do {
    const page = await env.HUB_KV.list({ prefix: 'mts:', cursor });
    for (const k of page.keys) out.push({ id: k.name.slice(4), ...(k.metadata || {}) });
    cursor = page.list_complete ? null : page.cursor;
  } while (cursor);
  return out;
}

// change the MTS flags on every session of one account (access given or taken away, or opened with the password)
export async function setMtsFlags(env, accountId, flags, onlyToken) {
  for (const s of await listSessions(env)) {
    if (s.accountId !== accountId || (onlyToken && s.token !== onlyToken)) continue;
    const { token, ...info } = s;
    for (const [k, v] of Object.entries(flags)) { if (v) info[k] = true; else delete info[k]; }
    if (Object.keys(flags).every(k => !!s[k] === !!flags[k])) continue;
    await env.HUB_KV.put('sess:' + token, JSON.stringify(info), { expiration: Math.floor(info.expires / 1000), metadata: info });
  }
}
