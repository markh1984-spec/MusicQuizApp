/**
 * Drafting a reply to a suggestion.
 *
 * **It drafts, it never sends.** A reply that goes out unread is the one that
 * goes publicly wrong — apologising for something that did not happen, or
 * promising a feature that is not being built. The owner reads it, edits it,
 * and presses Send; the model's job is to save the blank page, not to speak
 * for anybody.
 *
 * This is deliberately NOT the generator's `askClaude`: that one parses JSON
 * and is built around getting a fixed shape back. What is wanted here is a
 * short piece of prose, and asking for prose in a function designed to salvage
 * malformed JSON would be the wrong tool wearing the right name.
 */

const ANTHROPIC_API = 'https://api.anthropic.com/v1/messages';

/** Kept short on purpose — a long reply reads as a form letter. */
const MAX_TOKENS = 700;

/**
 * What the model needs to know to be useful rather than generic.
 *
 * Written out here rather than assembled from the app's own state, because a
 * brief that drifts with the code is a brief nobody trusts. It is only ever
 * used to draft a paragraph a human then reads.
 */
export function briefFor({ appName = 'Quizporium', ownerName = 'the owner', house = '' } = {}) {
  return `You are drafting a short reply on behalf of ${ownerName}, who runs
${appName} — an app for live pub and club quiz nights. Its users are
professional quiz hosts ("quizmasters") who run nights on their own kit in
someone else's venue, in front of a paying room.

What matters to them, and therefore to you:

- Reliability beats cleverness. If something is flaky on a Wednesday night with
  sixty people watching, it is worthless. Take any report of that seriously.
- They are running a business, not using a toy. Be practical, not chirpy.
- The packs are written for them and sold; they do not write their own yet.

How to write:

- British English. Plain words. No exclamation marks, no marketing voice.
- Short: three or four sentences at most. This is a message, not a letter.
- Address them by first name. Sign off as ${ownerName}.
- If it is a bug, say what you understand the problem to be and what happens
  next. If it is an idea, say honestly whether it is likely or not.
- NEVER promise a date, a feature or a refund. If the honest answer is "I do
  not know yet", write that.
- If the message does not give you enough to go on, ask one specific question
  rather than guessing.

Write only the reply itself. No subject line, no preamble, no quotation of
their message.${house ? `

${ownerName} has added these notes. Where they disagree with anything above,
follow them — EXCEPT the rule about never promising a date, a feature or a
refund, which stands whatever else is said:

${house}` : ''}`;
}

/**
 * Facts the app already knows about the person who wrote in.
 *
 * This is what moves a draft from plausible to "could only be about this
 * person". None of it is guessed — it is read off the account and the box at
 * the moment the button is pressed.
 *
 * Note what is NOT here: their email, their customers, anything from their
 * invoice book. A reply needs to know who it is talking to, not everything
 * about them.
 */
export function factsFor({ account = null, history = [] } = {}) {
  if (!account) return '';
  const lines = [];
  if (account.tier) lines.push(`They are on the ${account.tier} tier.`);
  if (account.comped) lines.push('Their account is comped.');
  if (account.status && account.status !== 'active') {
    lines.push(`Their subscription status is "${account.status}".`);
  }
  if (account.createdAt) {
    const days = Math.floor((Date.now() - Date.parse(account.createdAt)) / 86400000);
    if (Number.isFinite(days) && days >= 0) {
      lines.push(days < 31
        ? `They joined ${days} day${days === 1 ? '' : 's'} ago — still new.`
        : `They have been subscribed about ${Math.round(days / 30)} months.`);
    }
  }
  const earlier = history.filter((h) => h.text);
  if (earlier.length) {
    lines.push(`This is message number ${earlier.length + 1} from them. Earlier ones:`);
    for (const h of earlier.slice(0, 4)) {
      lines.push(`  - "${String(h.text).slice(0, 160)}"${(h.replies || []).length ? ' (answered)' : ' (never answered)'}`);
    }
  } else {
    lines.push('This is the first time they have written in.');
  }
  return lines.length ? `\nWhat you know about them:\n${lines.join('\n')}\n` : '';
}

/**
 * How the owner has answered before — the only part of this that gets better
 * on its own.
 *
 * Given as EXAMPLES OF VOICE, not as facts to reuse. That distinction is
 * load-bearing: a past reply may contain a promise made to one person about
 * one thing, and a model told to "be consistent with these" would happily
 * repeat it to somebody else. So they are labelled as style, and the rule
 * about never promising anything sits above them in the brief where it
 * outranks whatever they contain.
 *
 * Newest first and only a handful, because the point is the current voice
 * rather than the whole history.
 */
export function voiceFrom(suggestions = [], limit = 6) {
  const replies = [];
  for (const item of suggestions) {
    for (const reply of item.replies || []) {
      // Skip anything the MODEL largely wrote. See `mostlyMine` below: without
      // this, a draft sent almost unedited becomes an example for the next
      // draft, and the thing ends up imitating itself rather than the owner.
      if (reply.text && !reply.machine) replies.push(reply);
    }
  }
  if (!replies.length) return '';
  const recent = replies.sort((a, b) => (b.at || 0) - (a.at || 0)).slice(0, limit);
  return `\nHere are replies they have written before. Match the LENGTH, the
TONE and the way they open and sign off. Do NOT reuse anything specific from
them — a promise made to one person about one thing is not a promise to
anybody else:\n\n${recent.map((r) => `---\n${r.text}`).join('\n')}\n---\n`;
}

/**
 * Did the owner actually write this, or did they send the draft as it came?
 *
 * **This is what stops the drafting model learning from itself.** The voice
 * examples are the only part that improves on its own, and they only improve
 * while they are examples of the OWNER. Send a draft unedited and store it as
 * an example, and the next draft imitates the last one: a little more generic
 * each time, and any phrase the owner would never use quietly amplified,
 * because it keeps being fed back in as evidence of how they write.
 *
 * So a reply only counts as theirs if enough of it changed. Measured on WORDS
 * rather than characters, because fixing a typo is not writing it yourself and
 * rewriting a sentence is — and word overlap tells those apart where a
 * character diff would not.
 *
 * The failure mode is deliberately one-sided: something wrongly judged
 * machine-written is merely not used as an example, which costs nothing.
 * Something wrongly judged human POISONS the examples, which is the whole
 * problem. So the threshold leans towards calling it machine.
 *
 * @returns {boolean} true if the owner's own words are what got sent
 */
export function mostlyMine(sent, draft) {
  const words = (t) => String(t || '').toLowerCase().match(/[a-z0-9']+/g) || [];
  const theirs = words(sent);
  const drafted = words(draft);
  if (!drafted.length) return true;      // no draft involved: they wrote it
  if (!theirs.length) return false;

  // How much of the draft survived, as a multiset — so repeated words have to
  // survive repeatedly rather than one match covering them all.
  const left = new Map();
  for (const w of drafted) left.set(w, (left.get(w) || 0) + 1);
  let kept = 0;
  for (const w of theirs) {
    const n = left.get(w) || 0;
    if (n > 0) { left.set(w, n - 1); kept++; }
  }
  const survived = kept / drafted.length;
  const lengthLike = Math.min(theirs.length, drafted.length) / Math.max(theirs.length, drafted.length);

  // Nearly all the draft's words still there AND about the same length: they
  // pressed Send. Anything less and there is real editing in it.
  return !(survived >= 0.8 && lengthLike >= 0.8);
}

/**
 * @param {object} opts
 * @param {object} opts.suggestion  what they sent
 * @param {string} opts.apiKey
 * @param {string} [opts.model]
 * @param {string} [opts.ownerName]
 * @param {string} [opts.appName]
 * @returns {Promise<string>} a draft, for a human to read and edit
 */
export async function draftReply({
  suggestion,
  apiKey,
  model = 'claude-sonnet-5',
  ownerName = 'Mark',
  appName = 'Quizporium',
  // Notes the owner has written for themselves, from the owner page.
  house = '',
  // Who wrote in, and what else they have sent.
  account = null,
  history = [],
  // Every reply the owner has written, for voice.
  past = [],
  // What the call cost, for the owner's own ledger. Small next to a
  // generation, and worth having in the same place: a drafting button pressed
  // forty times a month is still a line on the bill. See src/spend.js.
  onSpend = () => {},
  fetchImpl = fetch,
} = {}) {
  if (!apiKey) throw new Error('No ANTHROPIC_API_KEY is set, so there is nothing to draft with.');
  if (!suggestion || !suggestion.text) throw new Error('There is nothing to reply to.');

  const kind = {
    idea: 'an idea',
    annoying: 'something that got in their way',
    broken: 'something broken',
  }[suggestion.kind] || 'a message';

  const said = (suggestion.replies || [])
    .map((r) => `Earlier reply from ${ownerName}: ${r.text}`)
    .join('\n');

  const prompt = `${suggestion.by || 'A quizmaster'} sent ${kind}${
    suggestion.where ? `, from the ${suggestion.where} tab` : ''}:

"${suggestion.text}"
${said ? `\n${said}\n` : ''}${factsFor({ account, history })}${voiceFrom(past)}
Draft the reply.`;

  let res;
  try {
    res = await fetchImpl(ANTHROPIC_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: MAX_TOKENS,
        system: briefFor({ appName, ownerName, house }),
        messages: [{ role: 'user', content: prompt }],
        // Same reason the generators disable it: thinking is billed against
        // the same budget as the answer, and a four-sentence reply that spends
        // its allowance reasoning comes back empty.
        thinking: { type: 'disabled' },
        output_config: { effort: 'low' },
      }),
      // A call with no timeout hangs for as long as the socket stays open, and
      // from the console that looks like the button doing nothing at all.
      signal: AbortSignal.timeout(60_000),
    });
  } catch (err) {
    if (err.name === 'TimeoutError' || err.name === 'AbortError') {
      throw new Error('Claude took too long to answer. Try again, or just write it yourself.');
    }
    throw err;
  }

  if (!res.ok) {
    throw new Error(`Claude said ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
  const data = await res.json();
  const usage = data.usage || {};
  onSpend({
    kind: 'claude',
    what: 'drafted a reply',
    model,
    tokensIn: usage.input_tokens || 0,
    tokensOut: usage.output_tokens || 0,
  });
  const text = (data.content || [])
    .filter((c) => c.type === 'text')
    .map((c) => c.text)
    .join('')
    .trim();

  if (!text) throw new Error('Claude came back with nothing. Try again, or write it yourself.');
  return text;
}
