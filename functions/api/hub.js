import { hubContent, json } from '../_lib/auth.js';

// the home page's content: the admin console's saved copy, else hub.json
export async function onRequestGet(ctx) {
  return json(await hubContent(ctx));
}
