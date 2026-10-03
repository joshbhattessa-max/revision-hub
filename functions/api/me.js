import { json } from '../_lib/auth.js';
import { maintenance } from '../_lib/maintenance.js';

export async function onRequestGet(ctx) {
  const s = ctx.data.session;
  const out = { username: s.username, role: s.role, expires: s.expires };
  // admins can still use the site during maintenance, so tell them it's on
  if (s.role === 'admin') out.maintenance = (await maintenance(ctx)).on;
  return json(out);
}
