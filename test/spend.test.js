/**
 * What the AI has cost.
 *
 * This is the number the whole tier structure rests on — *anything that costs
 * the owner money every time it is used is not in Bronze* — and until this
 * file existed it was being applied from memory against a bill that turns up a
 * month later with no idea which pack it was for.
 *
 * So the tests are mostly about the ledger telling the truth rather than about
 * arithmetic: a price change must not rewrite history, a failed call still
 * costs, an unknown model must never look cheap, and a bookkeeping problem must
 * never take a generation down with it.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { Spend, PRICES, claudePence, imagePence, spendRecorder } from '../src/spend.js';

function ledger(now = () => 1_700_000_000_000) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'spend-'));
  return { spend: new Spend(path.join(dir, 'spend.json'), now), dir };
}

test('a Claude call is priced from its tokens', () => {
  const rate = PRICES.claude['claude-sonnet-5'];
  const pence = claudePence({ model: 'claude-sonnet-5', tokensIn: 1000, tokensOut: 1000 });
  assert.equal(pence, rate.in + rate.out);
});

/*
 * A model nobody has priced yet must come out DEARER than it is, never
 * cheaper. An under-estimate looks like a healthy margin right up until the
 * card statement, which is the one direction this number must not fail in.
 */
test('an unknown model is priced as the dearest one there is', () => {
  const unknown = claudePence({ model: 'claude-something-6', tokensIn: 1000, tokensOut: 1000 });
  const dearest = Math.max(...Object.entries(PRICES.claude)
    .filter(([id]) => id !== 'default')
    .map(([, r]) => r.in + r.out));
  assert.ok(unknown >= dearest, 'an unrecognised model priced below a known one');
});

/*
 * The three input counts do not overlap — `input_tokens` is the UNCACHED
 * remainder. Pricing a cached call as if every token were ordinary input is
 * what would make caching look like it saved nothing, on the one page whose
 * job is to say what the AI actually costs.
 */
test('cached tokens are a tenth of cold ones, and a write costs a quarter more', () => {
  const cold = claudePence({ model: 'claude-opus-5', tokensIn: 10000 });
  const read = claudePence({ model: 'claude-opus-5', cacheRead: 10000 });
  const write = claudePence({ model: 'claude-opus-5', cacheWrite: 10000 });

  assert.equal(Math.round(read * 100) / 100, Math.round(cold * 0.1 * 100) / 100);
  assert.equal(Math.round(write * 100) / 100, Math.round(cold * 1.25 * 100) / 100);
  assert.ok(read < cold && cold < write, 'the three rates are in the wrong order');
});

/*
 * A web search is charged per search, not per token, so it is the one line on
 * the bill that grows with how TOPICAL the writing is rather than with how
 * much of it there is. Worth its own number for exactly that reason.
 */
test('a web search costs the same whatever model made it', () => {
  const opus = claudePence({ model: 'claude-opus-5', searches: 10 });
  const sonnet = claudePence({ model: 'claude-sonnet-5', searches: 10 });
  assert.equal(opus, sonnet);
  assert.equal(opus, 8, 'ten searches should be 8p');
});

test('the summary counts the searches separately from the money', () => {
  const { spend } = ledger();
  spend.record({ kind: 'claude', what: 'read the last month', model: 'claude-sonnet-5', tokensIn: 1000, searches: 9, packId: 'topical' });
  spend.record({ kind: 'claude', what: 'wrote a round', model: 'claude-sonnet-5', tokensIn: 1000, packId: 'topical' });

  const sum = spend.summary();
  assert.equal(sum.searches, 9);
  assert.ok(sum.claude > 0);
});

test('a picture is priced from the quality that was actually asked for', () => {
  const g = PRICES.image.google;
  assert.equal(imagePence({ provider: 'google', quality: 'low', images: 10 }), g.low * 10);
  assert.equal(imagePence({ provider: 'google', quality: 'high', images: 2 }), g.high * 2);
  // An unrecognised quality falls to the middle rather than to nothing — a
  // free row is worse than an approximate one, because it looks like it did
  // not happen.
  assert.equal(imagePence({ provider: 'google', quality: 'nonsense', images: 1 }), g.medium);
});

test('the two suppliers are priced apart, and an unknown one is priced as the dearest', () => {
  /*
   * Imagen and gpt-image-1 are nothing like each other at the TOP of the
   * range — 5p against 14p — which is the whole reason these are two tables.
   * A single one would have reported whichever supplier you were not using.
   *
   * Note it is deliberately not "Google is cheaper everywhere": gpt-image-1's
   * bottom tier is genuinely under Imagen Fast. The saving is at high quality,
   * which is where a picture being sold on actually gets drawn.
   */
  assert.ok(PRICES.image.google.high < PRICES.image.openai.high / 2,
    'the high-quality gap is the reason for two tables');
  // Same rule as an unknown model: a row that reads high is a question, and a
  // row that reads low is a bill nobody saw coming.
  assert.equal(imagePence({ provider: 'not-a-supplier', quality: 'high', images: 1 }), PRICES.image.openai.high);
  assert.equal(imagePence({ quality: 'high', images: 1 }), PRICES.image.openai.high);
});

/*
 * The pence are STORED, not worked out again when somebody looks. Otherwise a
 * price rise would silently rewrite what last year cost, and "what did I
 * actually pay" is the one question this file exists to answer.
 */
test('a row keeps the price it was written with', () => {
  const { spend } = ledger();
  const row = spend.record({ kind: 'claude', model: 'claude-sonnet-5', tokensIn: 1000, tokensOut: 1000 });
  assert.ok(row.pence > 0);
  const onDisk = JSON.parse(fs.readFileSync(spend.filePath, 'utf8')).rows[0];
  assert.equal(onDisk.pence, row.pence);
  assert.ok('tokensIn' in onDisk, 'the tokens are not kept, so a price cannot be checked later');
});

/*
 * Fractions of a penny matter here in a way they do not on an invoice. One
 * checker batch is a fraction of one, and rounding each row to a whole penny
 * would turn sixty of them into a number several times too big.
 */
test('a row keeps fractions of a penny', () => {
  const { spend } = ledger();
  const row = spend.record({ kind: 'claude', model: 'claude-haiku-4-5-20251001', tokensIn: 100, tokensOut: 50 });
  assert.ok(row.pence > 0 && row.pence < 1, `expected a fraction of a penny, got ${row.pence}`);
});

test('the summary splits Claude from the pictures, and adds up', () => {
  const { spend } = ledger();
  spend.record({ kind: 'claude', packId: 'madonna', model: 'claude-sonnet-5', tokensIn: 10000, tokensOut: 10000 });
  spend.record({ kind: 'image', packId: 'madonna', provider: 'google', quality: 'medium', images: 10 });

  const sum = spend.summary();
  assert.equal(sum.image, PRICES.image.google.medium * 10);
  assert.equal(Math.round((sum.claude + sum.image) * 100) / 100, sum.total);
  assert.equal(sum.packs.length, 1);
  assert.equal(sum.packs[0].packId, 'madonna');
  assert.equal(sum.perPack, sum.total, 'one pack, so the average is the total');
});

test('the dearest pack is first, because that is the one to look at', () => {
  const { spend } = ledger();
  spend.record({ kind: 'image', packId: 'cheap', quality: 'low', images: 1 });
  spend.record({ kind: 'image', packId: 'dear', quality: 'high', images: 10 });
  assert.equal(spend.summary().packs[0].packId, 'dear');
});

test('anything older than the window asked for is left out', () => {
  let clock = 1_700_000_000_000;
  const { spend } = ledger(() => clock);
  spend.record({ kind: 'image', packId: 'old', quality: 'high', images: 1 });
  clock += 400 * 86400000;
  spend.record({ kind: 'image', packId: 'new', quality: 'high', images: 1 });

  const sum = spend.summary({ months: 12, at: clock });
  assert.equal(sum.rows, 1);
  assert.equal(sum.packs[0].packId, 'new');
});

// ============================================================ never fatal

/*
 * A generation that died because the ACCOUNTING failed would be the tail
 * wagging the dog — several minutes and real money lost to a bookkeeping
 * error. The worst case here is a missing row.
 */
test('a bad row is dropped rather than thrown', () => {
  const { spend } = ledger();
  assert.doesNotThrow(() => spend.record());
  assert.doesNotThrow(() => spend.record({ kind: 'claude', tokensIn: 'lots', tokensOut: null }));
});

test('a generator handed no ledger at all still runs', () => {
  const record = spendRecorder(null, { packId: 'x' });
  assert.doesNotThrow(() => record({ kind: 'claude', tokensIn: 10, tokensOut: 10 }));
});

test('the recorder stamps the pack it was made for', () => {
  const { spend } = ledger();
  const record = spendRecorder(spend, { packId: 'metallica' });
  record({ kind: 'claude', model: 'claude-sonnet-5', tokensIn: 100, tokensOut: 100 });
  assert.equal(spend.rows[0].packId, 'metallica');
});

// ============================================================== the backup

/*
 * Only into an EMPTY ledger, the same rule as the accounts and the invoice
 * book — a disk with rows on it is ahead of any backup, and reading one over
 * the top would either double-count or lose a morning's generation depending
 * which way it went.
 */
test('a backup is never read over a ledger that already has rows', () => {
  const { spend } = ledger();
  spend.record({ kind: 'image', packId: 'today', quality: 'high', images: 1 });
  const result = spend.restore(JSON.stringify({ rows: [{ at: 1, kind: 'image', pence: 999 }] }));
  assert.equal(result.ok, false);
  assert.equal(spend.rows.length, 1);
  assert.equal(spend.rows[0].packId, 'today');
});

test('an empty ledger takes the backup', () => {
  const { spend } = ledger();
  const result = spend.restore(JSON.stringify({ rows: [{ at: 1, kind: 'image', pence: 12 }] }));
  assert.equal(result.ok, true);
  assert.equal(spend.rows.length, 1);
});

test('a corrupt backup is refused rather than believed', () => {
  const { spend } = ledger();
  assert.equal(spend.restore('not json at all').ok, false);
  assert.equal(spend.restore(JSON.stringify({ nope: true })).ok, false);
  assert.equal(spend.rows.length, 0);
});

/*
 * Same rule as the accounts, the invoices, the reports and the suggestion box:
 * a file that will not parse is set aside, never written over. A parse error
 * is not permission to bin a year of records.
 */
test('an unreadable ledger on disk is set aside, not overwritten', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'spend-'));
  const file = path.join(dir, 'spend.json');
  fs.writeFileSync(file, '{ this is not json', 'utf8');
  const spend = new Spend(file);
  assert.equal(spend.rows.length, 0);
  assert.ok(fs.existsSync(file + '.broken'), 'the unreadable ledger was thrown away');
});
