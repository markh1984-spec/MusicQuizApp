/**
 * THE LAUNCH BAR SAYS "Bingo prizes", NOT "Prizes" — on the markup AND on
 * every repaint. The markup said the right word with a comment explaining
 * why, and `paintSettings()` wrote the bare word back over it on every state
 * push, so the bar a host launches from read "Prizes 3" an inch under the
 * drinks table. CLAUDE.md lists this rename among those not to rename back;
 * no guard read the label text, so this one does.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('../public/assets/console-tonight.js', import.meta.url), 'utf8');

test('the markup and the repaint agree on "Bingo prizes"', () => {
  assert.match(src, /<span class="set-word">Bingo prizes<\/span>/, 'the markup');
  assert.match(src, /\.set-word'\)\.textContent = 'Bingo prizes'/, 'the repaint');
  assert.doesNotMatch(src, /textContent = 'Prizes'/, 'the bare word must not be written back');
});
