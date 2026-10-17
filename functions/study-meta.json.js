// the planner's and progress page's subject list (study-meta.json), with the names and colours from the hub's
// content, so a subject renamed or recoloured in the admin console shows the same way there too
import { hubContent, json } from './_lib/auth.js';

export async function onRequestGet(ctx) {
  const res = await ctx.env.ASSETS.fetch(new URL('/study-meta.json', ctx.request.url));
  if (!res.ok) return res;
  const meta = await res.json();
  try {
    for (const s of (await hubContent(ctx)).sites || []) {
      const m = meta.subjects && meta.subjects[s.path];
      if (!m) continue;
      if (s.subject) m.subject = s.subject;
      if (s.name) m.name = s.name;
      if (s.color) m.color = s.color;
    }
  } catch (e) { /* the built-in names */ }
  return json(meta);
}
