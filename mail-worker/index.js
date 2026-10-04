// jbr-mail: Cloudflare Email Routing gives this Worker every email sent to contact@jbrevision.co.uk. It passes each one
// to the main site (/api/inbound), which logs it, lets the assistant answer or fix what it can and emails the owner the
// rest. It tries jbrevision.co.uk, then the site's pages.dev address (a Worker's requests to a domain on its own account
// don't always reach the site). If the site can't take it, the email is forwarded to the owner unchanged, with an
// X-JBR-Assistant header saying why; if it can't be forwarded either, it's bounced to the sender with the reason, so it
// never vanishes. Each outcome is written to the Worker's logs (Workers & Pages → jbr-mail → Logs).
// Secrets on this Worker (Settings → Variables and Secrets): MAIL_SECRET (the same value as on the Pages project) and
// OWNER_EMAIL (where emails the assistant can't deal with go; it must be a verified Email Routing destination address).
const SITES = ['https://jbrevision.co.uk/api/inbound', 'https://josh-b-revision.pages.dev/api/inbound'];
const MAX = 2 * 1024 * 1024; // the text is all the assistant needs; big attachments are cut off

export default {
  async email(message, env) {
    const problems = [];
    let raw = null;
    try {
      raw = new Uint8Array(await new Response(message.raw).arrayBuffer());
    } catch (e) {
      problems.push('reading the email: ' + (e && e.message || e));
    }
    if (!env.MAIL_SECRET) problems.push('MAIL_SECRET is missing on the jbr-mail Worker');
    else if (raw) {
      for (const url of env.SITE ? [env.SITE] : SITES) {
        const host = new URL(url).host;
        try {
          const r = await fetch(url, {
            method: 'POST',
            body: raw.byteLength > MAX ? raw.slice(0, MAX) : raw,
            headers: { 'content-type': 'message/rfc822', 'user-agent': 'jbr-mail', 'x-mail-secret': env.MAIL_SECRET,
              'x-mail-from': message.from, 'x-mail-to': message.to, 'x-owner': env.OWNER_EMAIL || '' },
          });
          if (r.ok) { console.log(`passed to ${host}: ${message.from}`); return; }
          problems.push(`${host} answered ${r.status}` + (r.status === 401 ? ' (MAIL_SECRET differs from the Pages project)' : ''));
          if (r.status === 401) break;  // the other address would say the same
        } catch (e) {
          problems.push(`${host}: ${String(e && e.message || e).slice(0, 100)}`);
        }
      }
    }
    const why = problems.join('; ').slice(0, 300);
    if (env.OWNER_EMAIL) {
      try {
        await message.forward(env.OWNER_EMAIL, new Headers({ 'X-JBR-Assistant': ('not answered: ' + why).slice(0, 200) }));
        console.log(`forwarded to the owner (${why})`);
        return;
      } catch (e) {
        problems.push('forwarding to OWNER_EMAIL: ' + String(e && e.message || e).slice(0, 100));
      }
    } else problems.push('OWNER_EMAIL is missing on the jbr-mail Worker');
    const all = problems.join('; ').slice(0, 400);
    console.log('bounced: ' + all);
    message.setReject(`JB Revision could not take this email just now (${all}). Please try again later.`);
  },
};
