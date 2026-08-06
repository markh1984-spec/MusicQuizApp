/**
 * Spreading the right answers across the options.
 *
 * A generated quiz leans: Claude writes the true statement first and the
 * decoys after it, so the answer is A far more often than it should be. The
 * read-through has always SAID so ("answers land A x15 B x10 ... lopsided"),
 * and there was nothing to press. This is the something to press.
 *
 * It never touches the words. Every option keeps its exact text and every
 * question keeps the same right answer — only which letter it sits under
 * moves. That is why it is safe to run on a finished pack you have already
 * read through: the review flags are keyed on option TEXT, not position, so
 * every tick survives it.
 *
 * Kept out of console.js and free of the DOM so it can be tested in node.
 */

/**
 * Deal the correct answers out evenly, then shuffle the wrong ones around them.
 *
 * Least-loaded first: each question puts its right answer(s) in whichever
 * letters have had the fewest so far, ties broken at random. That beats a
 * plain shuffle, which on twenty questions leaves a visible lean about as
 * often as not — and a lean is the thing being fixed.
 *
 * It also copes with a quiz that mixes widths: a pick-them-all round has six
 * options where the others have four, so E and F start behind and the multi
 * round fills them first without being told to.
 *
 * @param {object} quiz     modified in place
 * @param {() => number} [rand]  injected for the tests, like every other clock here
 * @returns {number} how many questions actually moved
 */
export function balanceAnswers(quiz, rand = Math.random) {
  const rounds = (quiz && quiz.rounds) || [];
  const width = Math.max(4, ...rounds.flatMap((r) => (r.questions || []).map((q) => (q.options || []).length)));
  const tally = new Array(width).fill(0);
  let moved = 0;

  for (const round of rounds) {
    for (const q of round.questions || []) {
      const options = (q.options || []).slice();
      const n = options.length;
      if (n < 2) continue;

      const multi = Array.isArray(q.correctIndexes) && q.correctIndexes.length > 0;
      const wanted = multi ? q.correctIndexes : [q.correctIndex];
      const right = new Set(wanted.filter((i) => Number.isInteger(i) && i >= 0 && i < n));
      // A question with nothing marked, or everything marked, is broken in a
      // way the editor has to fix. Leave it exactly as it is rather than
      // rearranging a question whose answer nobody knows.
      if (right.size === 0 || right.size >= n) continue;

      // Shuffle first, then sort by how loaded each letter is: the sort is
      // stable, so equally loaded letters keep their random order and the
      // answer does not settle into A, B, C, D, A, B, C, D.
      const slots = shuffle([...options.keys()], rand)
        .sort((a, b) => tally[a] - tally[b])
        .slice(0, right.size)
        .sort((a, b) => a - b);

      const rightText = shuffle([...right].map((i) => options[i]), rand);
      const wrongText = shuffle(options.filter((_, i) => !right.has(i)), rand);

      const taken = new Set(slots);
      const next = new Array(n);
      slots.forEach((slot, k) => { next[slot] = rightText[k]; });
      let w = 0;
      for (let i = 0; i < n; i++) if (!taken.has(i)) next[i] = wrongText[w++];

      if (next.some((text, i) => text !== options[i])) moved++;
      for (const slot of slots) tally[slot]++;

      q.options = next;
      // correctIndex is meaningless on a pick-them-all question, but it is
      // always written out, so keep it pointing at a right answer rather than
      // leaving it aimed at whatever is now in the old slot.
      q.correctIndex = slots[0];
      if (multi) q.correctIndexes = slots;
    }
  }
  return moved;
}

/** Fisher-Yates on a copy. */
function shuffle(list, rand) {
  const out = list.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
