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
import { draftReply, briefFor } from '../src/reply-draft.js';

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
  const brief = briefFor({ appName: 'Quiztopia', ownerName: 'Mark' });
  assert.match(brief, /Quiztopia/);
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
