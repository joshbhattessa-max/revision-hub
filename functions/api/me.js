import { json } from '../_lib/auth.js';

export function onRequestGet({ data }) {
  const s = data.session;
  return json({ username: s.username, role: s.role, expires: s.expires });
}
