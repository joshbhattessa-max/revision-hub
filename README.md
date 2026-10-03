# Revision hub

One web address for everything: a sign-in, then a home page with all the subject sites plus your own links and pictures.

- `https://<your-hub>.pages.dev/` is the home page.
- `https://<your-hub>.pages.dev/chemistry/` is ChemQ. The same goes for `/biology/`, `/physics/`, `/maths/`, `/geography/`, `/computer-science/` and `/spanish/`.

The subject sites stay as separate Cloudflare Pages projects. The hub quietly fetches them for you (`functions/[[path]].js`), so you only ever use the hub's address. Your notes and handwriting in each subject are kept separately, as before.

## Putting it online (Cloudflare Pages)

Before you start, the seven subject sites should already be on Cloudflare (chemq, bioq, physq, mathsq, geoq, csq, spanishq).

1. Go to *Workers & Pages* → *Create* → *Pages* → *Connect to Git*, then pick this repository.
2. Production branch `main`, framework preset *None*, build command empty, output directory `/`.
3. Click *Save and Deploy*. Your hub is at `https://<project-name>.pages.dev`.
4. If any subject site ended up with a different address (e.g. `bioq-7x3.pages.dev`), change its `origin` in `hub.json`.

## Sign-in

Everything (the home page, every subject and the admin console) needs a sign-in. A sign-in lasts 6 hours.

- **Accounts to start with:** `JoshB` / `admin` (admin), `JoshB` / `normal` and `test` / `test` (standard). Change these weak passwords in the admin console once the site is up.
- **Sign-up:** anyone can make a standard account on the login page ("Create an account") with a username and a password of at least 6 characters. Each address can make at most 5 accounts an hour.
- **After signing in** the home page says "Hello, *name*", and the name then moves to the top right. Hover over it (tap on a phone) to change your password, log out or delete your account. Deleting needs your password, and the last admin account can't be deleted.
- **Standard accounts** see the site as normal.
- **Admin accounts** also get an **Admin console** button on the home page (`/admin`):
  - **Content:** change the title, subjects, links and pictures. Uploads are kept in Cloudflare. *Reset to the built-in version* goes back to `hub.json`.
  - **Signed in:** who is signed in now, from which device and country. You can sign out one session, or everyone except you.
  - **Accounts:** change a password, rename, make admin or standard, sign out everywhere, delete, or add an account.
- Passwords are stored only as salted PBKDF2 hashes. Ten wrong passwords from one address lock that address out for 15 minutes.

### Maintenance mode

The **Maintenance** tab in the admin console turns it on or off, with an optional message. While it's on, everyone except admins gets a "Down for maintenance" page. That page reloads by itself when the site is back, and has an "Admin sign-in" link. Setting `"on": true` in `maintenance.json` does the same from the repository, which is useful while a big update deploys.

### Setting it up (once)

1. **Make the store.** In the Cloudflare dashboard go to *Storage & Databases* → *KV* → *Create a namespace*, and name it `hub`.
2. **Bind it to the hub.** In the hub's Pages project go to *Settings* → *Bindings* → *Add* → *KV namespace*. Name it `HUB_KV` and pick `hub`. Do this for Production (and Preview, if you use it).
3. **Make a shared secret.** Pick a long random string, e.g. from a password generator, at least 32 characters.
   - Hub: add it in *Settings* → *Variables and Secrets* → *Add* → type *Secret*, name `HUB_SECRET`.
   - Each of the seven subject projects (chemq, bioq, physq, mathsq, geoq, csq, spanishq): add the same secret, with the same name `HUB_SECRET`.

   The subject sites then refuse anyone who opens them directly. Only the hub can fetch them, so no one gets round the sign-in. Set the hub's secret first: until a subject has the secret it stays open, and once it has the secret it only answers the hub.
4. **Redeploy everything.** Run *Deployments* → *Retry deployment* on the hub and on each subject site, so they pick up the binding and secret.

Until `HUB_KV` is bound, the hub shows a "Sign-in isn't set up yet" page instead of the site. It fails closed, never open.

## Your own domain (optional)

You can buy a domain such as `myrevision.co.uk` (about £5–10 a year, e.g. through Cloudflare Registrar). Then in the hub's Pages project go to *Custom domains* → *Set up a domain*. Every subject is then at `myrevision.co.uk/chemistry/` and so on. The free `*.pages.dev` address keeps working either way.

## Limits

The hub's forwarding and the subject sites' secret check run on Cloudflare's free plan, which allows 100,000 requests a day across the account. KV, which holds sign-ins, allows 100,000 reads and 1,000 writes a day. Each page in a subject is about 5–15 requests and each is counted twice (hub + subject), so that's still a few thousand pages a day, plenty for a school group.
