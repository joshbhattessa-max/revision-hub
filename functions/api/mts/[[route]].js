// MTS Resources for the signed-in account (functions/_lib/mts.js):
//   GET  /api/mts            { state: 'granted', open }   (only the admin gives access; without it, all of this is 404)
//   POST /api/mts/unlock     { password }  the account's own password, once per sign-in, after access is granted
//   GET  /api/mts/content    what's inside (only once granted and opened)
import { getAccounts, json, noteFailure, tooManyFailures, verifyPassword } from '../../_lib/auth.js';
import { getMts, setMtsFlags } from '../../_lib/mts.js';

// the school's subjects and papers go here once they're added (kept off the public site; see the README)
const CONTENT = { subjects: [] };

export async function onRequest(ctx) {
  const { request, env, params, data } = ctx;
  const route = (params.route || []).join('/');
  const method = request.method;
  const me = data.session;
  if (me.viaKey) return json({ error: 'Sign in with your username and password to use MTS Resources.' }, 403);
  const rec = await getMts(env, me.accountId);
  const state = rec && rec.state === 'granted' ? 'granted' : 'none';
  if (state !== 'granted') return json({ error: 'Not found' }, 404);
  const open = state === 'granted' && !!me.mtsOpen;

  if (route === '' && method === 'GET') return json({ state, open, asked: rec ? rec.asked : null });

  if (route === 'unlock' && method === 'POST') {
    if (state !== 'granted') return json({ error: "You don't have access to MTS Resources yet." }, 403);
    const who = 'mts:' + me.accountId;
    if (await tooManyFailures(env, request, who)) return json({ error: 'Too many attempts. Try again in 15 minutes.' }, 429);
    const body = await request.json().catch(() => ({}));
    const a = (await getAccounts(env)).find(x => x.id === me.accountId);
    if (!a || !await verifyPassword(a, body.password)) {
      await noteFailure(env, request, who);
      return json({ error: "That isn't your password." }, 401);
    }
    await setMtsFlags(env, me.accountId, { mts: true, mtsOpen: true }, me.token);
    return json({ ok: true, open: true });
  }

  if (route === 'content' && method === 'GET') {
    if (!open) return json({ error: state === 'granted' ? 'Type your password to open MTS Resources.' : 'No access.' }, 403);
    return json(CONTENT);
  }

  return json({ error: 'Not found' }, 404);
}
