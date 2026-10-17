// Activity: what each signed-in account opens on the site and when, for the admin console's Activity tab. Kept in a
// Cloudflare D1 database bound as ACTIVITY_DB (KV's free plan only allows 1,000 writes a day; D1 allows 100,000 rows).
// Without the binding nothing is recorded and the tab explains how to set it up.
//   events:   one row per page opened (the account, when, which subject site, the page's address and title, and the
//             exam paper when it's a question page). Kept 90 days.
//   presence: one row per account: the page it's on now and when it was last active (a heartbeat every minute while
//             a page is open and on screen).

export const KEEP_DAYS = 90;
export const SITES = { chemistry: 'Chemistry', biology: 'Biology', physics: 'Physics', maths: 'Maths', geography: 'Geography',
  'computer-science': 'Computer Science', spanish: 'Spanish',
  'english-language': 'English Language', 'english-literature': 'English Literature',
  history: 'History', 'religious-studies': 'Religion and Philosophy', pe: 'Sports Science (PE)', 'design-technology': 'Design and Technology', french: 'French' };

export const db = env => env.ACTIVITY_DB || null;

let ready = null;
// the tables are made the first time they're needed (once per worker)
export function schema(d) {
  if (!ready) {
    ready = d.batch([
      d.prepare(`CREATE TABLE IF NOT EXISTS events (id INTEGER PRIMARY KEY AUTOINCREMENT, account TEXT NOT NULL, username TEXT,
        t INTEGER NOT NULL, site TEXT, page TEXT, title TEXT, paper TEXT, device TEXT)`),
      d.prepare('CREATE INDEX IF NOT EXISTS events_account_t ON events (account, t)'),
      d.prepare('CREATE INDEX IF NOT EXISTS events_t ON events (t)'),
      d.prepare(`CREATE TABLE IF NOT EXISTS presence (account TEXT PRIMARY KEY, username TEXT, t INTEGER NOT NULL, since INTEGER,
        site TEXT, page TEXT, title TEXT, device TEXT)`),
    ]).catch(e => { ready = null; throw e; });
  }
  return ready;
}

// "/chemistry/" -> "chemistry"; the hub's own pages -> ""
export function siteOf(path) {
  const m = String(path || '').match(/^\/([a-z-]+)(\/|$)/);
  return m && SITES[m[1]] ? m[1] : '';
}

// a question page's title is "ChemQ: GCSE Chemistry - AQA June 2023 - Paper 1 - 01.2": the paper is everything but the
// site name and the question number
export function paperOf(hash, title) {
  if (!/^#\/question\//.test(hash || '')) return '';
  const parts = String(title || '').replace(/^[^:]{1,20}:\s*/, '').split(' - ');
  return parts.length >= 4 ? parts.slice(0, -1).join(' - ').slice(0, 200) : '';
}

export async function forget(env, accountId) {
  const d = db(env);
  if (!d) return;
  await schema(d);
  await d.batch([
    d.prepare('DELETE FROM events WHERE account = ?').bind(accountId),
    d.prepare('DELETE FROM presence WHERE account = ?').bind(accountId),
  ]);
}
