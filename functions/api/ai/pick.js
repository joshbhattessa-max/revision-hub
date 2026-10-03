// POST /api/ai/pick — Claude picks past-paper questions for the specific points on a topic sheet, revision
// checklist or test's topic list (not just "a question on 2(a)"). Signed-in users only.
//   body: { subj, title, points: ["…", …], target: marks, cands: [{ id, mk, paper, topics, wording }, …] }
//   The planner shortlists the candidates in the browser (from the school board's questions and their wording), so
//   this stays light on the server's CPU allowance.
//   -> { picks: [{ id, mk, point, why }], uncovered: [point numbers], left: picks left today }
// Needs the ANTHROPIC_API_KEY secret on the Pages project; without it this answers 503 and the planner uses its
// own word-matching picker instead. Each account gets DAILY AI picks a day.
import Anthropic from '@anthropic-ai/sdk';
import { json } from '../../_lib/auth.js';

const SUBJECT_NAMES = {
  chemistry: 'Chemistry (Edexcel International GCSE 4CH1)', biology: 'Biology (Edexcel International GCSE 4BI1)',
  physics: 'Physics (Edexcel International GCSE 4PH1)', maths: 'Mathematics A (Edexcel International GCSE 4MA1, Higher)',
  geography: 'Geography (AQA GCSE 8035)', 'computer-science': 'Computer Science (AQA GCSE 8525)', spanish: 'Spanish (Edexcel International GCSE 4SP1)'
};
const DAILY = 25;
const MAX_CANDIDATES = 170;

const SCHEMA = {
  type: 'object',
  properties: {
    picks: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'The candidate question id, exactly as given' },
          point: { type: 'integer', description: 'The number of the point it tests' },
          why: { type: 'string', description: 'Under 15 words: what in the question tests that point' }
        },
        required: ['id', 'point', 'why'],
        additionalProperties: false
      }
    },
    uncovered: { type: 'array', items: { type: 'integer' }, description: 'Points no candidate really tests' }
  },
  required: ['picks', 'uncovered'],
  additionalProperties: false
};

const SYSTEM = `You choose past-paper exam questions for a GCSE student's revision.

You get the specific points the student has to revise (from their teacher's topic sheet, revision checklist or test list) and candidate questions from their exam board's past papers, with each question's wording.

Pick questions that directly test those specific points: the exact concept, process, calculation, practical or skill named, not questions that are only broadly in the same topic or spec section. Prefer questions whose main demand is the point itself. Cover as many of the points as you can, spread roughly evenly, before giving a point a second question; leave out points that no candidate really tests and list them as uncovered. Avoid near-duplicates (the same question asked in two papers). Aim for about the number of marks asked for.`;

export async function onRequestPost(ctx) {
  const { env, request } = ctx;
  if (!env.ANTHROPIC_API_KEY) return json({ error: "AI question picking isn't switched on yet.", code: 'not_configured' }, 503);
  const body = await request.json().catch(() => null);
  if (!body || !SUBJECT_NAMES[body.subj]) return json({ error: 'Choose a subject.' }, 400);
  const points = (Array.isArray(body.points) ? body.points : []).map(p => String(p).replace(/\s+/g, ' ').trim().slice(0, 300)).filter(p => p.length > 2).slice(0, 120);
  if (!points.length) return json({ error: 'Add the topics or points to revise.' }, 400);
  const target = Math.max(10, Math.min(120, Number(body.target) || 40));
  const shortlist = (Array.isArray(body.cands) ? body.cands : []).slice(0, MAX_CANDIDATES).map(c => ({
    id: String(c.id || '').slice(0, 80), mk: Math.max(1, Math.min(30, Number(c.mk) || 1)), paper: String(c.paper || '').slice(0, 80),
    topics: String(c.topics || '').slice(0, 200), wording: String(c.wording || '').replace(/\s+/g, ' ').slice(0, 400)
  })).filter(c => /^[\w.-]+-q\d+(\/[\w.()-]+)?$/.test(c.id));
  if (!shortlist.length) return json({ error: 'No questions on those topics.', code: 'no_candidates' }, 404);
  const byId = new Map(shortlist.map(c => [c.id, c]));

  // a daily allowance per account, so a runaway page can't run up a bill
  const s = ctx.data.session, day = new Date().toISOString().slice(0, 10), key = `ai:${s.accountId}:${day}`;
  const used = Number(await env.HUB_KV.get(key)) || 0;
  if (used >= DAILY) return json({ error: `You've used today's ${DAILY} AI picks. The word-matching picker still works.`, code: 'daily_limit' }, 429);

  const user = `Subject: ${SUBJECT_NAMES[body.subj]}
${body.title ? `For: ${String(body.title).slice(0, 120)}\n` : ''}Marks wanted: about ${target}

Points to revise:
${points.map((p, i) => `${i + 1}. ${p}`).join('\n')}

Candidate questions (id | marks | paper | topic | wording):
${shortlist.map(c => `${c.id} | ${c.mk} | ${c.paper} | ${c.topics} | ${c.wording || '(wording not available)'}`).join('\n')}`;

  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  let msg;
  try {
    msg = await client.beta.messages.create({
      model: 'claude-opus-5-5',
      max_tokens: 16000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',   // if a safety filter declines (a false positive), the API retries on its recommended model
      output_config: { effort: 'medium', format: { type: 'json_schema', schema: SCHEMA } },
      system: SYSTEM,
      messages: [{ role: 'user', content: user }]
    });
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) return json({ error: 'The AI is busy. Try again in a minute.', code: 'busy' }, 429);
    if (e instanceof Anthropic.AuthenticationError) return json({ error: "The AI key isn't valid.", code: 'not_configured' }, 503);
    if (e instanceof Anthropic.APIConnectionError) return json({ error: "Couldn't reach the AI.", code: 'ai_error' }, 502);
    if (e instanceof Anthropic.APIError) return json({ error: `The AI didn't answer (${e.status}).`, code: 'ai_error' }, 502);
    return json({ error: "Couldn't reach the AI.", code: 'ai_error' }, 502);
  }
  await env.HUB_KV.put(key, String(used + 1), { expirationTtl: 2 * 86400 });
  if (msg.stop_reason === 'refusal') return json({ error: 'The AI declined this one. Try rewording the list.', code: 'refused' }, 422);
  const textBlock = msg.content.find(b => b.type === 'text');
  let out;
  try { out = JSON.parse(textBlock ? textBlock.text : ''); } catch (e) { return json({ error: "The AI's answer was cut short. Try a shorter list.", code: 'ai_error' }, 502); }

  // keep only real candidates, each part once, up to about the marks wanted
  const picks = [], taken = new Set();
  let total = 0;
  for (const p of out.picks || []) {
    const c = byId.get(p.id);
    if (!c || taken.has(c.id) || total >= target + 6) continue;
    taken.add(c.id); total += c.mk;
    picks.push({ id: c.id, mk: c.mk, point: p.point, why: String(p.why || '').slice(0, 160) });
  }
  return json({ picks, uncovered: (out.uncovered || []).filter(n => Number.isInteger(n)), left: DAILY - used - 1 });
}
