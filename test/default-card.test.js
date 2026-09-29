/**
 * MUSIC BINGO IS A 3×3 CARD WITH ONE PRIZE, UNLESS SOMEBODY CHOOSES OTHERWISE.
 *
 * The host, 29 September 2026: *"can I check that music bingo rounds are now
 * 3 x 3 grids and a single prize per round?"* — they were not: every pack
 * defaulted to the biggest card its track list could fill, a 5×5 paying five.
 * And *"I'm going to make the music bingo spotify files around 20 songs each"*
 * — which a 4×4 import default (24 songs at least) would have REFUSED.
 *
 * ONE default, `DEFAULT_CARD` on `CARD_SHAPES`, read by the server's launch,
 * its running order's deal and the bar's own picker (`bestBingoShape()`), so
 * the bar can never show one card and launch another. A bigger card is still
 * one choice away on the Card picker.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { CARD_SHAPES, DEFAULT_CARD, defaultCardFor, defaultPrizes, minimumTracks, shapeLabel } from '../src/bingo.js';
import { bestBingoShape } from '../public/assets/client.js';
import { importBingoPack } from '../src/import-bingo.js';
import { Session } from '../src/session.js';

const SHAPES = CARD_SHAPES.map((s) => ({ ...s, label: shapeLabel(s), minimum: minimumTracks(s) }));
const tracks = (n) => Array.from({ length: n }, (_, i) => ({ id: `t${i + 1}`, title: `Track ${i + 1}`, artist: `Artist ${i + 1}` }));

test('the default card is 3×3 and pays one prize, a full house', () => {
  assert.deepEqual(DEFAULT_CARD, { rows: 3, cols: 3 });
  assert.equal(defaultPrizes(DEFAULT_CARD), 1);
});

test('the bar starts every music bingo pack on it, whatever its size', () => {
  for (const n of [20, 40, 42]) assert.deepEqual(
    (({ rows, cols }) => ({ rows, cols }))(bestBingoShape(SHAPES, n)), { rows: 3, cols: 3 }, `${n} songs`);
});

test('and so does the server, for a pack that says 5×5 on disk', () => {
  assert.deepEqual(defaultCardFor({ cardSize: 5, tracks: tracks(40) }), { rows: 3, cols: 3 });
});

test('a launch that names no card deals 3×3 cards and plays for one prize', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'default-card-'));
  try {
    fs.writeFileSync(path.join(dir, 'b.json'), JSON.stringify({ id: 'b', title: 'B', cardSize: 5, tracks: tracks(40) }));
    const store = { load: () => null, save: () => {}, flush: () => {}, write: () => {} };
    const session = new Session({ config: { dataDir: dir, quizDir: dir, bingoDir: dir, advertDir: dir }, store, onPush: () => {}, now: () => 1_700_000_000_000 });
    session.launch('bingo', 'b', {});
    assert.deepEqual(session.engine.shape, { rows: 3, cols: 3 });
    const p = session.engine.join({ name: 'Ann' });
    assert.equal(session.engine.state.players[p.id].card.length, 9);
    assert.equal((session.engine.state.stages || []).length, 1, 'one prize: a full house');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('a 20-song list imports, where the old 4×4 default refused it', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'default-card-import-'));
  const config = { dataDir: path.join(root, 'data'), bingoDir: path.join(root, 'bingo'), quizDir: path.join(root, 'quizzes') };
  for (const d of Object.values(config)) fs.mkdirSync(d, { recursive: true });
  try {
    const text = Array.from({ length: 20 }, (_, i) => `Song ${i + 1} — Artist ${i + 1}`).join('\n');
    const { pack } = await importBingoPack({ config, text, title: 'Twenty', resolve: false });
    assert.equal(pack.tracks.length, 20);
    assert.equal(pack.cardSize, 3);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

/*
 * AND THE DEFAULT DOES NOT WARN ABOUT ITSELF — the host's call, 30 September
 * 2026. The Card label says "drags" below half the pack's songs, his own
 * line, so a 3×3 on his new twenty-song packs (9 of 20) would have carried
 * the warning on every night — about a choice he made knowing the cost. Any
 * other card below the line still says it.
 */
test('the Card label never says "drags" about the default card, and still does about another', async () => {
  const { bingoShapeLabel } = await import('../public/assets/client.js');
  const three = SHAPES.find((s) => s.rows === 3 && s.cols === 3);
  const four = SHAPES.find((s) => s.rows === 4 && s.cols === 4);
  assert.doesNotMatch(bingoShapeLabel(three, 20), /drags/);
  assert.doesNotMatch(bingoShapeLabel(three, 42), /drags/);
  assert.match(bingoShapeLabel(four, 42), /drags/, '16 of 42 is still below the line');
});
