// Open to everyone: lets the maintenance page reload itself once the site is back, and tells the sign-in page whether
// "Forgot your password?" can work (it needs emails).
import { json } from '../_lib/auth.js';
import { canSend } from '../_lib/email.js';
import { maintenance } from '../_lib/maintenance.js';

export async function onRequestGet(ctx) {
  return json({ maintenance: (await maintenance(ctx)).on, ...(canSend(ctx.env) ? { email: true } : {}) });
}
