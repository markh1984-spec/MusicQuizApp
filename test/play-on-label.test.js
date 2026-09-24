/**
 * "PLAY ON FOR THE SECOND PRIZE" — the button counts prizes the way the host
 * does on the mic, and only ever offers a prize the launch actually chose.
 *
 * Asked for in those words: *"if there's three prizes on a music bingo, after
 * the first bingo it should say 'play on for the second prize' and then 'play
 * on for the third prize' etc. but this MUST be conditional on the amount of
 * prizes selected at the start of the game."* The stage word (2 lines, a full
 * house) rides along after a dash, so the announcement and what the room needs
 * are one sentence. At the LAST stage there is nothing to play on for and the
 * label is null — the caller draws Finish or Continue instead — which is what
 * keeps a deck (one stage) from ever offering a second pint.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { playOnLabel, stageWord, defaultStages } from '../public/assets/prize-parts.js';

/** The host view's `stage`/`prizes` pair for a night with `count` prizes, `index` just won. */
function after(count, index) {
  const stages = defaultStages(count);
  return {
    stage: { index, total: stages.length, needs: stages[index], label: stageWord(stages[index]), last: index === stages.length - 1 },
    prizes: stages.map((st) => ({ needs: st, label: stageWord(st), winner: null })),
  };
}

test('three prizes: the second, then the third, then nothing', () => {
  let v = after(3, 0);
  assert.equal(playOnLabel(v.stage, v.prizes), 'Play on for the second prize — 2 lines');
  v = after(3, 1);
  assert.equal(playOnLabel(v.stage, v.prizes), 'Play on for the third prize — a full house');
  v = after(3, 2);
  assert.equal(playOnLabel(v.stage, v.prizes), null);
});

test('the count chosen at launch decides how far it goes', () => {
  assert.equal(playOnLabel(after(1, 0).stage, after(1, 0).prizes), null, 'one prize (a deck) never plays on');
  assert.equal(playOnLabel(after(2, 0).stage, after(2, 0).prizes), 'Play on for the second prize — a full house');
  assert.equal(playOnLabel(after(2, 1).stage, after(2, 1).prizes), null);
  assert.equal(playOnLabel(after(5, 2).stage, after(5, 2).prizes), 'Play on for the fourth prize — 4 lines');
  assert.equal(playOnLabel(after(5, 3).stage, after(5, 3).prizes), 'Play on for the fifth prize — a full house');
  assert.equal(playOnLabel(after(5, 4).stage, after(5, 4).prizes), null);
});

test('a missing stage word leaves the ordinal standing on its own', () => {
  assert.equal(playOnLabel({ index: 0, total: 3, last: false }, []), 'Play on for the second prize');
  assert.equal(playOnLabel(null, null), null, 'no stage at all offers nothing');
});

test('the control view draws it from here and nowhere else', () => {
  const src = readFileSync(new URL('../public/assets/host-bingo.js', import.meta.url), 'utf8');
  assert.match(src, /import \{[^}]*\bplayOnLabel\b[^}]*\} from '\.\/prize-parts\.js'/);
  assert.doesNotMatch(src, /Play on for \$\{/, 'the label is built in prize-parts.js, not inline');
  assert.doesNotMatch(src, /'a full house'/, 'the fallback stage word is prize-parts.js\'s, not a second copy');
});
