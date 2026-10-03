# Revision hub

One web address for everything: a home page with all the subject sites, plus your own links, pictures and notes.

- `https://<your-hub>.pages.dev/` is the home page.
- `https://<your-hub>.pages.dev/chemistry/` is ChemQ. The same goes for `/biology/`, `/physics/`, `/maths/`, `/geography/`, `/computer-science/` and `/spanish/`.

The subject sites stay as separate Cloudflare Pages projects. The hub quietly fetches them for you (`functions/[[path]].js`), so you only ever use the hub's address. Your notes and handwriting in each subject are kept separately, as before.

## Putting it online (Cloudflare Pages)

Before you start, the seven subject sites should already be on Cloudflare (chemq, bioq, physq, mathsq, geoq, csq, spanishq).

1. Go to *Workers & Pages* → *Create* → *Pages* → *Connect to Git*, then pick this repository.
2. Production branch `main`, framework preset *None*, build command empty, output directory `/`.
3. Click *Save and Deploy*. Your hub is at `https://<project-name>.pages.dev`.
4. If any subject site ended up with a different address (e.g. `bioq-7x3.pages.dev`), open the hub, click **Edit page**, then **Edit** on that subject, and paste in its real address. Then publish (see below).

## Changing the page

1. Click **Edit page**. You can rename the title, add sections, and add links or pictures (paste an image address or upload a photo). You can also reorder or delete cards, recolour subjects, or hide one.
2. Click **Done**. Changes show at once on that device, with a yellow *not on the live site yet* bar.
3. To put them online for every device, click **Publish…**. This downloads `hub.json`. On GitHub, open this repository, click **Add file** → **Upload files**, drag in the file and click **Commit changes**. The live page updates within a couple of minutes.

You can also edit `hub.json` directly on GitHub (click the file, then the pencil icon).

## Adding a login (Cloudflare Access, free for up to 50 people)

The hub and all seven subject sites go behind one login. You type your email and get a one-time code, and only the emails you list can get in.

1. In the Cloudflare dashboard open **Zero Trust**. The first time, pick a team name and the **Free** plan.
2. **Access → Service Auth → Service Tokens → Create Service Token**, named `hub`. Copy the **Client ID** and **Client Secret** (the secret is only shown once).
3. **Access → Applications → Add an application → Self-hosted**:
   - Name: `Revision`
   - Domains: add your hub (e.g. `my-revision.pages.dev`) and every subject site
     (`chemq.pages.dev`, `bioq.pages.dev`, `physq.pages.dev`, `mathsq.pages.dev`, `geoq.pages.dev`, `csq.pages.dev`, `spanishq.pages.dev`)
   - Policy 1: action **Allow**, include **Emails** → your email address(es)
   - Policy 2: action **Service Auth**, include **Service Token** → `hub`
   - Login method: **One-time PIN**
4. In the hub's Pages project, open **Settings → Variables and Secrets** and add two secrets:
   `ACCESS_CLIENT_ID` (the Client ID) and `ACCESS_CLIENT_SECRET` (the Client Secret).
5. **Deployments → Retry deployment** on the hub, so it picks up the secrets.

To let someone else in later, add their email to Policy 1.

## Your own domain (optional)

You can buy a domain such as `myrevision.co.uk` (about £5–10 a year, e.g. through Cloudflare Registrar). Then in the hub's Pages project go to *Custom domains* → *Set up a domain*. Every subject is then at `myrevision.co.uk/chemistry/` and so on. The free `*.pages.dev` address keeps working either way.

## Limits

The hub's forwarding runs on Cloudflare's free plan, which allows 100,000 requests a day. One question page is about 5–15 requests, so that's thousands of pages a day.
