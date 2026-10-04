// jbr-mail: Cloudflare Email Routing gives this Worker every email sent to contact@jbrevision.co.uk. It passes each one
// to the main site (/api/inbound), which logs it, lets the assistant answer or fix what it can and emails the owner the
// rest. If the main site can't take it (down, or not set up yet), the email is forwarded to the owner unchanged, so
// nothing is ever lost.
// Secrets on this Worker (Settings → Variables and Secrets): MAIL_SECRET (the same value as on the Pages project) and
// OWNER_EMAIL (where emails the assistant can't deal with go; it must be a verified Email Routing destination address).
const SITE = 'https://jbrevision.co.uk/api/inbound';
const MAX = 2 * 1024 * 1024; // the text is all the assistant needs; big attachments are cut off

export default {
  async email(message, env) {
    let ok = false;
    try {
      const raw = new Uint8Array(await new Response(message.raw).arrayBuffer());
      const r = await fetch(env.SITE || SITE, {
        method: 'POST',
        body: raw.byteLength > MAX ? raw.slice(0, MAX) : raw,
        headers: { 'content-type': 'message/rfc822', 'x-mail-secret': env.MAIL_SECRET || '', 'x-mail-from': message.from,
          'x-mail-to': message.to, 'x-owner': env.OWNER_EMAIL || '' },
      });
      ok = r.ok;
    } catch (e) {
      ok = false;
    }
    if (!ok && env.OWNER_EMAIL) await message.forward(env.OWNER_EMAIL);
  },
};
