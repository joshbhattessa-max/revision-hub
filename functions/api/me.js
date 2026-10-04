import { getAccounts, json } from '../_lib/auth.js';
import { canSend } from '../_lib/email.js';
import { maintenance } from '../_lib/maintenance.js';

export async function onRequestGet(ctx) {
  const s = ctx.data.session;
  const out = { username: s.username, role: s.role, expires: s.expires };
  if (s.viaKey) out.viaKey = true;  // signed in with an access key: no password to change, no account to delete
  else if (canSend(ctx.env)) {
    // for the account menu (Add or Change email) and the reminder on the home page
    const a = (await getAccounts(ctx.env)).find(x => x.id === s.accountId);
    out.email = { verified: !!(a && a.emailVerified) };
  }
  // admins can still use the site during maintenance, so tell them it's on
  if (s.role === 'admin') out.maintenance = (await maintenance(ctx)).on;
  return json(out);
}
