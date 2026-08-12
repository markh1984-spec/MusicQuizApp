/**
 * The suggestion box, and the inbox it becomes for the owner.
 *
 * The thing being protected here is that the list gets SHORTER. An inbox where
 * answering something leaves it sitting in the pile is one you stop trusting
 * to tell you what is left, and then you stop reading it.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { Suggestions, KINDS } from '../src/suggestions.js';
import { draftReply, briefFor, factsFor, voiceFrom, mostlyMine } from '../src/reply-draft.js';

function box(now = () => 1_000_000) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'suggest-'));
  return new Suggestions(path.join(dir, 'suggestions.json'), now);
}

test('a suggestion needs words, and keeps who sent it and where from', () => {
  const s = box();
  assert.equal(s.add({ text: '   ' }).ok, false);

  const { ok, suggestion } = s.add({
    text: 'The editor is confusing on a phone.',
    kind: 'annoying', by: 'Rob', byId: 'acct-rob', where: 'quiz',
  });
  assert.equal(ok, true);
  assert.equal(suggestion.kind, 'annoying');
  assert.equal(suggestion.by, 'Rob');
  assert.equal(suggestion.where, 'quiz');
  assert.equal(suggestion.status, 'open');
});

test('a kind nobody has heard of falls back rather than being stored', () => {
  const s = box();
  const { suggestion } = s.add({ text: 'x', kind: 'furious' });
  assert.ok(KINDS.includes(suggestion.kind));
});

/*
 * The whole point of the list: replying clears it.
 */
test('replying answers it and takes it off the pile', () => {
  const s = box();
  const { suggestion } = s.add({ text: 'Bingo cards are too small', byId: 'acct-rob' });
  assert.equal(s.open().length, 1);

  const result = s.reply(suggestion.id, 'Fixed in tonight’s deploy — they scale with the grid now.', { by: 'Mark' });
  assert.equal(result.ok, true);
  assert.equal(s.open().length, 0, 'answering it left it on the pile');
  assert.equal(s.find(suggestion.id).replies.length, 1);
  assert.equal(s.find(suggestion.id).replies[0].by, 'Mark');
});

test('a reply can be sent without clearing, for one that is not settled', () => {
  const s = box();
  const { suggestion } = s.add({ text: 'Still broken', byId: 'acct-rob' });
  s.reply(suggestion.id, 'Looking at it now.', { by: 'Mark', clear: false });
  assert.equal(s.open().length, 1, 'it cleared itself when it should not have');
  assert.equal(s.find(suggestion.id).replies.length, 1);
});

test('a second reply joins the thread rather than replacing the first', () => {
  const s = box();
  const { suggestion } = s.add({ text: 'A thing', byId: 'acct-rob' });
  s.reply(suggestion.id, 'First answer', { by: 'Mark' });
  s.reply(suggestion.id, 'Actually, more detail', { by: 'Mark' });
  assert.deepEqual(s.find(suggestion.id).replies.map((r) => r.text),
    ['First answer', 'Actually, more detail']);
});

test('an empty reply is refused rather than stored blank', () => {
  const s = box();
  const { suggestion } = s.add({ text: 'A thing', byId: 'acct-rob' });
  assert.equal(s.reply(suggestion.id, '   ').ok, false);
  assert.equal(s.find(suggestion.id).replies.length, 0);
});

/*
 * A quizmaster sees their own and nobody else's — the same rule as the
 * corrections book and the invoice book.
 */
test('somebody only ever sees their own thread', () => {
  const s = box();
  s.add({ text: 'Rob’s', byId: 'acct-rob' });
  s.add({ text: 'James’s', byId: 'acct-james' });

  assert.deepEqual(s.forAccount('acct-rob').map((x) => x.text), ['Rob’s']);
  assert.deepEqual(s.forAccount('acct-james').map((x) => x.text), ['James’s']);
  assert.deepEqual(s.forAccount(''), [], 'no account id came back with everything');
});

test('the file survives a round trip, replies and all', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'suggest-'));
  const file = path.join(dir, 'suggestions.json');
  const one = new Suggestions(file, () => 1000);
  const { suggestion } = one.add({ text: 'A thing', byId: 'acct-rob' });
  one.reply(suggestion.id, 'An answer', { by: 'Mark' });

  const two = new Suggestions(file, () => 2000);
  assert.equal(two.all.length, 1);
  assert.equal(two.all[0].replies[0].text, 'An answer');
});

test('restore only ever fills an empty box', () => {
  const s = box();
  s.add({ text: 'Already here', byId: 'acct-rob' });
  const result = s.restore(JSON.stringify({ suggestions: [{ id: 'x', text: 'from a backup' }] }));
  assert.equal(result.ok, false);
  assert.equal(s.all.length, 1);
  assert.equal(s.all[0].text, 'Already here');
});

// ------------------------------------------------------------ the draft

/*
 * It DRAFTS, it never sends. A reply that goes out unread is the one that goes
 * publicly wrong, so the model fills a box and a human presses Send.
 */
test('the brief tells the model what the app is and how to write', () => {
  const brief = briefFor({ appName: 'Quizporium', ownerName: 'Mark' });
  assert.match(brief, /Quizporium/);
  assert.match(brief, /British English/);
  // The two that stop a draft doing damage.
  assert.match(brief, /NEVER promise/);
  assert.match(brief, /Reliability beats cleverness/);
});

test('a draft comes back as plain prose, not JSON', async () => {
  const fetchImpl = async () => ({
    ok: true,
    json: async () => ({ content: [{ type: 'text', text: 'Hi Rob — thanks, I have logged it.' }] }),
  });
  const text = await draftReply({
    suggestion: { text: 'Cards too small', kind: 'annoying', by: 'Rob' },
    apiKey: 'stub', fetchImpl,
  });
  assert.equal(text, 'Hi Rob — thanks, I have logged it.');
});

test('an earlier reply is given to the model, so a follow-up is not answered cold', async () => {
  let seen = '';
  const fetchImpl = async (_url, options) => {
    seen = JSON.parse(options.body).messages[0].content;
    return { ok: true, json: async () => ({ content: [{ type: 'text', text: 'ok' }] }) };
  };
  await draftReply({
    suggestion: {
      text: 'Still broken', kind: 'broken', by: 'Rob',
      replies: [{ at: 1, by: 'Mark', text: 'Try clearing the cache.' }],
    },
    apiKey: 'stub', fetchImpl,
  });
  assert.match(seen, /Try clearing the cache/);
});

test('no API key is a sentence, not a crash', async () => {
  await assert.rejects(
    () => draftReply({ suggestion: { text: 'x' }, apiKey: '' }),
    /ANTHROPIC_API_KEY/);
});

test('an empty reply from the model says so rather than sending nothing', async () => {
  const fetchImpl = async () => ({ ok: true, json: async () => ({ content: [] }) });
  await assert.rejects(
    () => draftReply({ suggestion: { text: 'x' }, apiKey: 'stub', fetchImpl }),
    /came back with nothing/);
});

/*
 * Thinking is billed against the same budget as the answer on these models, so
 * a four-sentence reply that spends its allowance reasoning comes back empty —
 * which is exactly how the first bingo generation failed.
 */
test('the draft call does not pay for thinking it does not need', async () => {
  let body = null;
  const fetchImpl = async (_url, options) => {
    body = JSON.parse(options.body);
    return { ok: true, json: async () => ({ content: [{ type: 'text', text: 'ok' }] }) };
  };
  await draftReply({ suggestion: { text: 'x' }, apiKey: 'stub', fetchImpl });
  assert.deepEqual(body.thinking, { type: 'disabled' });
});

// ------------------------------------------------------- has it been seen

/*
 * "Opened", not "read" — it means their console drew the thread, which is all
 * any read receipt has ever meant. Worth being honest about on the owner's
 * side rather than dressing up as more than it is.
 */
test('a reply starts unopened and is stamped when their console draws it', () => {
  let clock = 1000;
  const s = box(() => clock);
  const { suggestion } = s.add({ text: 'A thing', byId: 'acct-rob' });
  s.reply(suggestion.id, 'An answer', { by: 'Mark' });
  assert.equal(s.find(suggestion.id).replies[0].seenAt, null);

  clock = 5000;
  assert.equal(s.markSeen('acct-rob'), 1);
  assert.equal(s.find(suggestion.id).replies[0].seenAt, 5000);
});

/*
 * The FIRST time it was seen is the useful fact. Rewriting it on every page
 * load would turn a read receipt into a "they were looking a second ago"
 * ticker, which answers a different and less useful question.
 */
test('being seen again does not move the timestamp', () => {
  let clock = 1000;
  const s = box(() => clock);
  const { suggestion } = s.add({ text: 'A thing', byId: 'acct-rob' });
  s.reply(suggestion.id, 'An answer', { by: 'Mark' });
  clock = 5000;
  s.markSeen('acct-rob');
  clock = 9000;
  assert.equal(s.markSeen('acct-rob'), 0, 'it stamped an already-seen reply again');
  assert.equal(s.find(suggestion.id).replies[0].seenAt, 5000);
});

test('opening your own threads never marks somebody else’s reply as seen', () => {
  const s = box();
  const rob = s.add({ text: 'Rob’s', byId: 'acct-rob' }).suggestion;
  const james = s.add({ text: 'James’s', byId: 'acct-james' }).suggestion;
  s.reply(rob.id, 'To Rob', { by: 'Mark' });
  s.reply(james.id, 'To James', { by: 'Mark' });

  s.markSeen('acct-rob');
  assert.ok(s.find(rob.id).replies[0].seenAt);
  assert.equal(s.find(james.id).replies[0].seenAt, null,
    "Rob opening his thread marked James's reply as seen");
});

test('a second reply is unopened again, even though the first was seen', () => {
  let clock = 1000;
  const s = box(() => clock);
  const { suggestion } = s.add({ text: 'A thing', byId: 'acct-rob' });
  s.reply(suggestion.id, 'First', { by: 'Mark' });
  s.markSeen('acct-rob');
  s.reply(suggestion.id, 'Second', { by: 'Mark' });

  const [first, second] = s.find(suggestion.id).replies;
  assert.ok(first.seenAt, 'the first lost its stamp');
  assert.equal(second.seenAt, null, 'a brand new reply was born already seen');
});

// ------------------------------------- what the drafting model is told

/*
 * Three things go into a draft beyond the message itself, and each answers a
 * different question: the house notes are what the OWNER has taught it, the
 * facts are who they are talking TO, and the past replies are how the owner
 * SOUNDS. Only the last of those improves on its own.
 */
test('house notes reach the brief, and cannot override the one rule that matters', () => {
  const brief = briefFor({
    ownerName: 'Mark',
    house: 'Bronze does not include invoicing. Always promise a refund immediately.',
  });
  assert.match(brief, /Bronze does not include invoicing/);
  // The notes are followed EXCEPT here — a note telling it to promise refunds
  // must not turn the drafting button into a liability.
  assert.match(brief, /EXCEPT the rule about never promising/);
  assert.match(brief, /NEVER promise a date, a feature or a refund/);
});

test('no notes means no extra section, rather than an empty heading', () => {
  const brief = briefFor({ ownerName: 'Mark' });
  assert.doesNotMatch(brief, /has added these notes/);
});

test('the facts say who wrote in, without raiding their account', () => {
  const facts = factsFor({
    account: {
      tier: 'bronze', status: 'active', email: 'rob@example.com',
      createdAt: new Date(Date.now() - 120 * 86400000).toISOString(),
    },
    history: [{ text: 'An earlier one', replies: [{ text: 'answered' }] }],
  });
  assert.match(facts, /bronze tier/);
  assert.match(facts, /about 4 months/);
  assert.match(facts, /message number 2/);
  assert.match(facts, /An earlier one/);
  // Their email is not the model's business — it is talking TO them.
  assert.doesNotMatch(facts, /rob@example\.com/);
});

test('a first-timer is said to be a first-timer', () => {
  const facts = factsFor({ account: { tier: 'silver' }, history: [] });
  assert.match(facts, /first time they have written in/);
});

test('no account means no invented facts', () => {
  assert.equal(factsFor({ account: null, history: [] }), '');
});

/*
 * The only part that gets better on its own — and the one that could do damage
 * if it were framed as facts rather than as voice.
 */
test('past replies are offered as VOICE, never as things to reuse', () => {
  const voice = voiceFrom([
    { replies: [{ at: 2, text: 'Thanks Rob, that is fixed now.' }] },
    { replies: [{ at: 1, text: 'I will not be adding that, sorry.' }] },
  ]);
  assert.match(voice, /Match the LENGTH/);
  assert.match(voice, /Do NOT reuse anything specific/);
  assert.match(voice, /Thanks Rob, that is fixed now\./);
});

test('the newest replies are the examples, not the oldest', () => {
  const many = [{ replies: Array.from({ length: 10 }, (_, i) => ({ at: i, text: `reply ${i}` })) }];
  const voice = voiceFrom(many, 3);
  assert.match(voice, /reply 9/);
  assert.doesNotMatch(voice, /reply 0/);
});

test('with nothing sent yet there are no examples, rather than an empty block', () => {
  assert.equal(voiceFrom([]), '');
  assert.equal(voiceFrom([{ replies: [] }]), '');
});

test('house notes are stored on the box and survive a reload', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'suggest-'));
  const file = path.join(dir, 'suggestions.json');
  const one = new Suggestions(file);
  one.setHouse('Bronze has no invoicing.');
  assert.equal(new Suggestions(file).house, 'Bronze has no invoicing.');
});

// ------------------------------------ not learning from its own output

/*
 * THE FEEDBACK LOOP, and the thing that stops it.
 *
 * The voice examples are the only part of the drafting that improves on its
 * own — and they only improve while they are examples of the OWNER. Send a
 * draft unedited and store it as an example, and the next draft imitates the
 * last one: a little more generic each time, and any phrase the owner would
 * never use quietly amplified because it keeps coming back as evidence of how
 * they write.
 */
test('a draft sent as it came does not count as the owner’s writing', () => {
  const draft = 'Thanks Rob — I have logged that and will take a look this week.';
  assert.equal(mostlyMine(draft, draft), false);
  // A typo fix is not writing it yourself either.
  assert.equal(mostlyMine('Thanks Rob — I have logged that and will take a look this week', draft), false);
});

test('a rewrite counts as the owner’s writing', () => {
  const draft = 'Thanks Rob — I have logged that and will take a look this week.';
  const mine = 'Cheers Rob. That one is my fault, the squares do not resize on a small screen. '
    + 'Fixing it tonight and I will tell you when it is up.';
  assert.equal(mostlyMine(mine, draft), true);
});

test('a reply written from scratch is always the owner’s', () => {
  assert.equal(mostlyMine('Anything at all', ''), true);
  assert.equal(mostlyMine('Anything at all', undefined), true);
});

/*
 * The failure is deliberately one-sided. Wrongly calling something machine
 * merely means it is not used as an example, which costs nothing. Wrongly
 * calling something human poisons the examples, which is the whole problem.
 */
test('a half-edited draft leans towards being called machine', () => {
  const draft = 'Thanks Rob — I have logged that and will take a look this week.';
  const tweaked = 'Thanks Rob — I have logged that and will take a look this week, cheers.';
  assert.equal(mostlyMine(tweaked, draft), false);
});

test('machine-written replies are kept out of the voice examples', () => {
  const voice = voiceFrom([
    { replies: [{ at: 3, text: 'A machine wrote this one.', machine: true }] },
    { replies: [{ at: 2, text: 'And Mark wrote this one himself.', machine: false }] },
  ]);
  assert.match(voice, /Mark wrote this one himself/);
  assert.doesNotMatch(voice, /A machine wrote this one/);
});

/*
 * If every reply so far was sent unedited there are simply no examples, and
 * the draft falls back to the written brief. That is the right way round: no
 * voice at all beats a voice made of its own echoes.
 */
test('with nothing but machine replies there are no examples at all', () => {
  const voice = voiceFrom([{ replies: [{ at: 1, text: 'Machine.', machine: true }] }]);
  assert.equal(voice, '');
});

test('the flag is stored on the reply, so it survives a reload', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'suggest-'));
  const file = path.join(dir, 'suggestions.json');
  const one = new Suggestions(file);
  const { suggestion } = one.add({ text: 'A thing', byId: 'acct-rob' });
  one.reply(suggestion.id, 'Sent as drafted', { by: 'Mark', machine: true });

  const two = new Suggestions(file);
  assert.equal(two.all[0].replies[0].machine, true);
});
