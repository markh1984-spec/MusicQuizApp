/**
 * Reading the last month of the actual world, so a quiz can be about it.
 *
 * Every other question in this app is written from what the model already
 * knows, which is fine for "which Blur single reached number two" and useless
 * for "what happened last Tuesday". A topical round needs facts newer than the
 * model, so it needs the web — and the moment a question comes off a search
 * result, the way it goes wrong changes: not a half-remembered chart position
 * but a headline that was updated the next morning.
 *
 * ---
 *
 * **ONE digest, read ONCE, shared by the writer AND the checker. That is the
 * load-bearing decision and there are two separate reasons for it.**
 *
 * The first is correctness. If the writer searches and the checker searches
 * separately, they are working from two different sets of facts — so the
 * checker rejects true questions because its search turned up a different
 * article, and the log fills with rejections nobody can account for. Checking
 * is only meaningful against the same evidence the question was written from.
 *
 * The second is the bill. The checker runs in batches, several at a time, and
 * a search on each would be a search per batch — the same month of news read
 * ten times over, at 0.8p a search plus every token it drags in. One digest is
 * one read.
 *
 * ---
 *
 * **The digest carries DATES and SOURCES, in the prose.** The checker's whole
 * job is "are you sure", and it cannot be sure of a bare assertion. A line that
 * says when a thing happened and where it was reported is one the checker can
 * hold a question against; a line that says "the album went to number one" is
 * one it can only agree with.
 *
 * **A failure here refuses the job rather than carrying on.** Every other
 * fallback in this codebase leans the other way — a checker that cannot be
 * reached keeps the questions, because by then the generation is minutes and
 * real money deep. This one is the FIRST call of the job, before a penny has
 * been spent, and what carrying on would produce is a topical quiz written
 * from no news at all: forty questions of confidently invented current events,
 * which is the single worst thing this app can put in front of a room.
 */

const ANTHROPIC_API = 'https://api.anthropic.com/v1/messages';

/**
 * The tool identifier, and it matters which one.
 *
 * `web_search_20260209` does dynamic filtering — the results are narrowed
 * before they reach the model's context rather than after — which on a "what
 * happened last month" query is the difference between reading the news and
 * reading a page of search engine furniture. The older `web_search_20250305`
 * still works and does not.
 */
export const SEARCH_TOOL = 'web_search_20260209';

/** Reading and summarising, not judging. The writing model is the right tier. */
export const RESEARCH_MODEL = process.env.RESEARCH_MODEL || 'claude-sonnet-5';

/**
 * How far back a topical quiz reaches.
 *
 * A month rather than a week. A week is not enough material for thirty
 * questions a pub crowd would recognise — most weeks have three or four things
 * in them that everybody heard about — and "did you notice this in the last
 * month" is the question a quiz can actually ask.
 */
export const DEFAULT_DAYS = 31;

/**
 * A ceiling on how much of the web one digest may read.
 *
 * Not a cost control so much as a hang control: a server-side search loop with
 * no limit can go round for a very long time, and this call sits in front of
 * everything else in the job.
 */
export const MAX_SEARCHES = 12;

/**
 * The server runs its own search loop and pauses it after ten goes, handing
 * back `pause_turn` rather than an answer. Resuming is sending the same
 * conversation again with the assistant's half appended — no extra
 * instruction, the API sees the trailing search block and picks up.
 */
const MAX_RESUMES = 3;

/**
 * Roughly how many tokens a prompt has to be before it is worth caching.
 *
 * Anthropic will not cache a prefix below a minimum — 1024 tokens on Sonnet 5,
 * 512 on Opus 5 — and a cache WRITE costs a quarter more than the same tokens
 * cold. So a breakpoint on something too small is not free, it is a small
 * surcharge for nothing. 1200 clears the higher of the two minimums with room
 * to spare, and four characters to the token is the usual rough conversion.
 */
const CACHE_FLOOR_TOKENS = 1200;

/** Is a prompt of these parts big enough that a cache breakpoint pays? */
export function worthCaching(...parts) {
  const chars = parts.filter(Boolean).join('').length;
  return chars / 4 >= CACHE_FLOOR_TOKENS;
}

const DIGEST_SYSTEM = `
You are researching the last few weeks for a live pub quiz in the south east of
England. The host is a professional and the room is paying to be there.

You are NOT writing questions. You are writing a factual briefing that somebody
else will write questions from, and that a second person will check those
questions against. So every line has to be checkable.

Rules:

- BRITISH. What a pub crowd in Essex, Kent or Surrey would have seen, heard or
  been told about. UK charts, UK telly, UK sport, and world news big enough to
  have reached them.
- EVERY LINE CARRIES A DATE AND A SOURCE. Start with the date it happened in
  YYYY-MM-DD, and end with the domain you got it from. A line without both is
  no use to the person checking it and should not be written.
- FACTS, not summaries of coverage. "X won Y" is a fact. "X's win was widely
  praised" is not, and cannot be turned into a question with one right answer.
- Numbers where there are numbers: positions, scores, ages, totals. A question
  needs something to be exactly right about.
- Skip anything you are not confident is settled. A story that was still moving
  when it was reported is one that has probably changed since, and a quiz
  question about it is an argument the host loses in public.
- Skip grim material — deaths, crime, disasters, illness — and skip party
  politics. Neither is what a room came out for, and the second one starts a
  row at the bar. A famous person's milestone birthday is fine; their funeral
  is not.
`.trim();

/**
 * What to go and read.
 *
 * The date is passed in rather than left to the model. It does not reliably
 * know what day it is, and "the last month" against the wrong month is a
 * briefing about the wrong news that looks exactly like a good one.
 */
export function digestBrief({ days = DEFAULT_DAYS, today, areas = [] } = {}) {
  const from = new Date(Date.parse(today) - days * 86400000).toISOString().slice(0, 10);
  const list = areas.length ? areas : [
    'UK news big enough that most people heard about it',
    'world news the same',
    'music — releases, number ones, tours announced, awards, reunions, festivals',
    'television and streaming — what everybody watched, who won what',
    'film — what came out, what took money, awards',
    'sport — results, transfers, records, who won what',
    'science, technology and space',
    'the odd and the daft — the stories people actually repeat to each other',
  ];

  return `
Today is ${today}. Search for what happened between ${from} and ${today}.

Cover all of these, and keep them roughly even — a briefing that is all football
makes a quiz that is all football:

${list.map((a) => `- ${a}`).join('\n')}

Aim for about 40 facts in total. Write them as a plain list, one per line, in
this shape and nothing else:

${from} — Somebody did something specific, with the number or the name in it. (bbc.co.uk)

No headings, no commentary, no introduction, no closing line. Just the lines.
`.trim();
}

/**
 * Ask once, resume if the search loop pauses, and hand back the prose.
 *
 * @returns {Promise<{digest: string, searches: number, sources: string[], lines: number}>}
 * @throws if the digest cannot be had at all — see the note at the top of the
 *   file about why this one is allowed to refuse where nothing else here is.
 */
export async function researchDigest({
  apiKey,
  model = RESEARCH_MODEL,
  days = DEFAULT_DAYS,
  areas = [],
  log = () => {},
  onSpend = () => {},
  now = () => Date.now(),
  fetchImpl = fetch,
} = {}) {
  if (!apiKey) throw new Error('Set ANTHROPIC_API_KEY to write a topical quiz');
  const today = new Date(now()).toISOString().slice(0, 10);

  const messages = [{ role: 'user', content: digestBrief({ days, today, areas }) }];
  let searches = 0;
  const sources = new Set();
  let text = '';

  log(`reading the last ${days} days…`);

  for (let go = 0; go <= MAX_RESUMES; go++) {
    const body = {
      model,
      /*
       * Room for the search results, the thinking and forty lines of prose.
       *
       * Thinking is left ON here, unlike the writing pass. Deciding which of
       * two hundred results is a fact a pub crowd would recognise is exactly
       * the judgement it is for, and this is one call rather than one per
       * round — so it is the cheapest place in the job to think.
       */
      max_tokens: 12000,
      system: DIGEST_SYSTEM,
      messages,
      tools: [{ type: SEARCH_TOOL, name: 'web_search', max_uses: MAX_SEARCHES }],
    };

    let res;
    try {
      res = await fetchImpl(ANTHROPIC_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify(body),
        // Longer than any other call in the app: this one is waiting on the
        // web as well as on the model.
        signal: AbortSignal.timeout(300_000),
      });
    } catch (err) {
      if (err.name === 'TimeoutError' || err.name === 'AbortError') {
        throw new Error('Reading the news took too long (over five minutes)');
      }
      throw err;
    }

    if (!res.ok) throw new Error(`Claude said ${res.status}: ${(await res.text()).slice(0, 300)}`);
    const data = await res.json();

    // Recorded before anything is read out of it, same rule as every other
    // call in this app: a reply that turns out to be useless was still billed.
    const usage = data.usage || {};
    const ran = Number((usage.server_tool_use || {}).web_search_requests) || 0;
    searches += ran;
    onSpend({
      kind: 'claude',
      what: 'read the last month',
      model,
      tokensIn: usage.input_tokens || 0,
      tokensOut: usage.output_tokens || 0,
      cacheRead: usage.cache_read_input_tokens || 0,
      cacheWrite: usage.cache_creation_input_tokens || 0,
      searches: ran,
    });

    for (const block of data.content || []) {
      if (block.type === 'text') text += block.text;
      // Where it actually looked, for the log and for the pack's own notes.
      for (const found of (block.type === 'web_search_tool_result' && Array.isArray(block.content) ? block.content : [])) {
        try {
          if (found && found.url) sources.add(new URL(found.url).hostname.replace(/^www\./, ''));
        } catch { /* a result with no usable url is not worth a crash */ }
      }
    }

    if (data.stop_reason !== 'pause_turn') break;
    // Resume: the same conversation with the assistant's half on the end and
    // NO extra instruction. The API sees the trailing search block and carries
    // on by itself; a "continue" message would be read as a new request.
    messages.push({ role: 'assistant', content: data.content || [] });
    log('  (still reading)');
  }

  const digest = tidyDigest(text);
  const lines = digest ? digest.split('\n').filter(Boolean).length : 0;
  if (lines < 5) {
    throw new Error(`Only found ${lines} usable fact${lines === 1 ? '' : 's'} about the last ${days} days — not enough to write a topical quiz from`);
  }
  log(`  ${lines} facts from ${sources.size} source${sources.size === 1 ? '' : 's'}, ${searches} search${searches === 1 ? '' : 'es'}`);
  return { digest, searches, sources: [...sources], lines };
}

/**
 * Keep the lines that look like facts and throw the rest away.
 *
 * The brief asks for a bare list and usually gets one, but a model that has
 * just done twelve searches often cannot resist an opening sentence — and that
 * sentence then goes into the checker's cached prefix and into every writing
 * call, paid for over and over. A line with no date is also a line the checker
 * cannot check, which is the other half of the same rule.
 */
export function tidyDigest(text) {
  return String(text || '')
    .split('\n')
    .map((l) => l.trim().replace(/^[-*•]\s*/, ''))
    .filter((l) => /\d{4}-\d{2}-\d{2}/.test(l))
    .join('\n')
    .trim();
}

/**
 * How the digest appears in a prompt — the same words to the writer and to the
 * checker, so the two cannot end up believing different things.
 */
export function digestBlock(digest) {
  if (!digest) return '';
  return `
Here is what actually happened recently. It was gathered by searching the web,
and every line carries the date and where it was reported.

TREAT THIS AS THE ONLY THING YOU KNOW ABOUT RECENT EVENTS. Do not add anything
from memory: your memory of the last few weeks is older than this list and
where the two disagree, this list is right. If something is not in here, it is
not something to write a question about.

${digest}
`.trim();
}
