// Which account a browser's own copy of its study progress belongs to. The progress (and mock papers in progress) is
// kept in the browser under a name ending in this tag, so two accounts used in one browser never see, or sync, each
// other's work. The tag is a hash of the account id, not the id itself, and isn't secret: it only names storage.
import { readCookie } from './auth.js';

export const WHO_COOKIE = 'jbr_who';

export async function whoTag(accountId) {
  const bits = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('jbr-who:' + accountId));
  return [...new Uint8Array(bits)].slice(0, 8).map(b => b.toString(16).padStart(2, '0')).join('');
}

// the cookie to set when this browser's tag isn't the signed-in account's (a new sign-in, or another account)
export async function whoCookie(request, session) {
  const tag = await whoTag(session.accountId);
  return readCookie(request, WHO_COOKIE) === tag ? null : `${WHO_COOKIE}=${tag}; Path=/; Secure; SameSite=Lax; Max-Age=34560000`;
}

export const clearWhoCookie = () => `${WHO_COOKIE}=; Path=/; Secure; SameSite=Lax; Max-Age=0`;
