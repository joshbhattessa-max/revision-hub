# Revision hub

One web address for everything: a sign-in, then a home page with all the subject sites plus your own links and pictures.

- `https://jbrevision.co.uk/` is the home page.
- `https://jbrevision.co.uk/chemistry/` is ChemQ. The same goes for `/biology/`, `/physics/`, `/maths/`, `/geography/`, `/computer-science/` and `/spanish/`.

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

### Access keys for agents

For an AI agent (like a Claude agent) or a script, create a key in **Admin console → Accounts → Access keys for agents**. A key works like a standard account, never an admin one, and is shown once:

- Agents that browse web pages: give them the link `https://<your-hub>/?key=<key>`, which signs them in for 6 hours.
- Agents or scripts that fetch addresses: add `?key=<key>` to any address, or send `Authorization: Bearer <key>`.

Only a hash of each key is stored. Revoking a key cuts it off immediately.

### Maintenance mode

The **Maintenance mode** button at the top of the admin console (or its **Maintenance** tab) turns it on or off, with an optional message and countdown. If you set a countdown, the site reopens by itself when it ends. Admins keep using the site as normal while it's on. While it's on, everyone except admins gets a "Down for maintenance" page. That page reloads by itself when the site is back, and has an "Admin sign-in" link. Setting `"on": true` in `maintenance.json` does the same from the repository, which is useful while a big update deploys.

### Setting it up (once)

1. **Make the store.** In the Cloudflare dashboard go to *Storage & Databases* → *KV* → *Create a namespace*, and name it `hub`.
2. **Bind it to the hub.** In the hub's Pages project go to *Settings* → *Bindings* → *Add* → *KV namespace*. Name it `HUB_KV` and pick `hub`. Do this for Production (and Preview, if you use it).
3. **Make a shared secret.** Pick a long random string, e.g. from a password generator, at least 32 characters.
   - Hub: add it in *Settings* → *Variables and Secrets* → *Add* → type *Secret*, name `HUB_SECRET`.
   - Each of the seven subject projects (chemq, bioq, physq, mathsq, geoq, csq, spanishq): add the same secret, with the same name `HUB_SECRET`.

   The subject sites then refuse anyone who opens them directly. Only the hub can fetch them, so no one gets round the sign-in. Set the hub's secret first: until a subject has the secret it stays open, and once it has the secret it only answers the hub.
4. **Redeploy everything.** Run *Deployments* → *Retry deployment* on the hub and on each subject site, so they pick up the binding and secret.

Until `HUB_KV` is bound, the hub shows a "Sign-in isn't set up yet" page instead of the site. It fails closed, never open.

## Email addresses

New accounts give an email address when they sign up and have to type in a 6-digit code emailed to it before they can use the site (`/verify`). Older accounts are only reminded on the home page ("Add email", or "Not now" for 30 days). With a checked address, "Forgot your password?" on the sign-in page emails a code and lets you choose a new password. Codes work once, for 15 minutes and 5 tries; only a scrambled version is kept.

- Emails go through [Resend](https://resend.com) (free: 100 a day; the site stops at 90). Add the domain `jbrevision.co.uk` in Resend, then put an API key with *Sending access* in the Pages project as the secret `RESEND_API_KEY` (*Settings → Variables and Secrets*). It takes effect at the next deployment.
- Without that secret nothing is sent, nobody is made to check an address and "Forgot your password?" is hidden: the site works as before.
- The admin console's Accounts tab shows each address and whether it's checked, and can excuse an account from checking or remove its address.
- Code: `functions/_lib/email.js`, `functions/api/email/[[route]].js`, `functions/api/reset.js`, `verify.html`/`verify.js`, and the email box and "Forgot your password?" in `login.js`.

## Email assistant (contact@jbrevision.co.uk)

Email Routing sends every email for `contact@` to the **jbr-mail** Worker (`mail-worker/`, deployed by Cloudflare from this repository with root directory `mail-worker`), which passes it to `/api/inbound`. There, Cloudflare's AI (Workers AI, through the Pages project's `AI` binding; free up to a daily allowance) works out what the sender wants, and fixed rules decide what happens:

- **Questions about the site**: answered from the facts in `functions/_lib/assistant.js` (update them when the site changes).
- **Forgotten password or username**: if the sender's address is the checked email of an account, a one-time reset link (1 hour) is emailed to that same address. Deleting an account: how to do it, plus a reset link.
- **Change of email**: a link to the current address, then one to the new address (`/confirm`); both must be opened.
- **Bugs, complaints, data requests, anything unclear, or a sender without a checked account**: a short reply, and an email to the owner with a summary ("Needs you"); Reply goes straight to the sender.
- **Spam, automatic emails, mailing lists, our own address**: logged only. At most 5 automatic replies to one address a day.

Every email is logged in KV (`mail:…`, kept a year; one-time links are never stored) and shown in the admin console's **Inbox** tab. The AI only suggests; it can't make the site do anything else, and without it (or if it fails) simple word-matching sends anything unclear to the owner. If `/api/inbound` can't be reached, the Worker forwards the email to the owner unchanged.

Setup: the Pages project needs a Workers AI binding named `AI` and a secret `MAIL_SECRET`; the Worker needs the same `MAIL_SECRET` and `OWNER_EMAIL` (a verified Email Routing destination); the `contact` routing rule's action is *Send to a Worker → jbr-mail*.

## The address

The hub lives at `jbrevision.co.uk` (bought through Cloudflare Registrar and added under the Pages project's *Custom domains*, with `www.jbrevision.co.uk` as well). Every subject is at `jbrevision.co.uk/chemistry/` and so on.

- `www.jbrevision.co.uk` sends you to `jbrevision.co.uk` (the same page).
- The old address, `josh-b-revision.pages.dev` (and its per-deployment `<id>.josh-b-revision.pages.dev` addresses), no longer works: every page there is a "We've moved" popup linking to the same page on `jbrevision.co.uk`, and its API answers `410 Gone` (`functions/_lib/moved.js`).
- The subject sites point anyone who opens them directly to `jbrevision.co.uk` (their `MAIN_SITE`).

## Limits

The hub's forwarding and the subject sites' secret check run on Cloudflare's free plan, which allows 100,000 requests a day across the account. KV, which holds sign-ins, allows 100,000 reads and 1,000 writes a day. Each page in a subject is about 5–15 requests and each is counted twice (hub + subject), so that's still a few thousand pages a day, plenty for a school group.

## Study tools

Every subject site has **My topics** (a heatmap of how secure each topic is, from your self-marking, plus red/amber/green
ratings), **Mock paper** (a fresh paper from the school board's questions, timed on screen or printed with the mark
scheme at the back, with a grade estimate from the board's grade boundaries) and a "How many marks did you get?" row
under every mark scheme. On the main site, **Your campus** (home page) grows a building per subject as topics become
secure, and the **Revision planner** (`/planner`) holds exams, class tests and topic deadlines, reads revision
checklists (PDF or pasted text) to tick the topics they cover, picks question sets from past papers and lays out a
day-by-day plan (also as a calendar file).

- Progress lives in the browser and syncs to your account through `/api/progress` (KV key `prog:<account id>`; merged
  item by item, newest wins). Deleting an account deletes its progress.
- `study-meta.json` and `study/<subject>.json` are built from the subject sites by `examq_cop/tools/build_study_meta.py`;
  grade boundaries and examiner-report notes go into each subject's `data/` with `examq_cop/tools/build_study_data.py`.
