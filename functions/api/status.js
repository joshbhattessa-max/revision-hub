// Open to everyone: lets the maintenance page reload itself once the site is back.
import { json } from '../_lib/auth.js';
import { maintenance } from '../_lib/maintenance.js';

export async function onRequestGet(ctx) {
  return json({ maintenance: (await maintenance(ctx)).on });
}
