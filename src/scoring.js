/**
 * Scoring maths. Kept pure and dependency-free so it can be tested with
 * injected timestamps rather than by waiting on a real clock.
 *
 * The rules, exactly as specified:
 *   - 100 points for a correct answer
 *   - plus 10 points for every WHOLE second left on the clock when they answered
 *   - plus a 100 point bonus for the FIRST CORRECT answer of that question
 *
 * A fast wrong answer must never take the first-correct bonus, otherwise
 * button-mashers win.
 */

export const POINTS_CORRECT = 100;
export const POINTS_PER_WHOLE_SECOND = 10;
export const POINTS_FIRST_CORRECT = 100;

/**
 * Whole seconds left on the clock at the moment the answer landed.
 * Answers that arrive after the clock has run out score no time bonus.
 */
export function wholeSecondsRemaining(answeredAt, endsAt) {
  const remainingMs = endsAt - answeredAt;
  if (!(remainingMs > 0)) return 0;
  return Math.floor(remainingMs / 1000);
}

/**
 * Points for a single answer.
 *
 * @param {object} a
 * @param {boolean} a.correct        did they pick the right option
 * @param {number}  a.answeredAt     server timestamp (ms) the answer landed
 * @param {number}  a.endsAt         server timestamp (ms) the clock runs out
 * @param {boolean} a.isFirstCorrect is this the first correct answer of the question
 * @returns {number} points, always an integer >= 0
 */
export function scoreAnswer({ correct, answeredAt, endsAt, isFirstCorrect = false }) {
  if (!correct) return 0;
  return (
    POINTS_CORRECT +
    POINTS_PER_WHOLE_SECOND * wholeSecondsRemaining(answeredAt, endsAt) +
    (isFirstCorrect ? POINTS_FIRST_CORRECT : 0)
  );
}

/**
 * Points for a "pick exactly N" question, where part marks are on offer.
 *
 * The share of the answer they got right is applied to what the question was
 * worth to them at that moment — the base AND the seconds they had left. Two
 * of three right does not earn a full speed bonus; it earns two thirds of the
 * whole thing. Anything else would pay more for a fast, mostly-wrong lock-in
 * than for a slower right one.
 *
 * The first-correct bonus is only ever for a complete answer. Part marks are
 * there so nobody walks away with nothing, not so that a lucky third of an
 * answer can take the bonus off somebody who knew all three.
 *
 * @param {object} a
 * @param {number} a.gotRight     how many of their picks were correct
 * @param {number} a.totalCorrect how many correct answers the question has
 * @param {number} a.answeredAt
 * @param {number} a.endsAt
 * @param {boolean} a.isFirstCorrect  first player to get the whole set
 * @returns {number} points, always an integer >= 0
 */
export function scoreMultiAnswer({ gotRight, totalCorrect, answeredAt, endsAt, isFirstCorrect = false }) {
  if (!(totalCorrect > 0) || !(gotRight > 0)) return 0;
  const share = Math.min(1, gotRight / totalCorrect);
  const earned = POINTS_CORRECT + POINTS_PER_WHOLE_SECOND * wholeSecondsRemaining(answeredAt, endsAt);
  return Math.round(share * earned) + (share === 1 && isFirstCorrect ? POINTS_FIRST_CORRECT : 0);
}

/**
 * How long they took to answer, in seconds, for the "Fastest finger" line.
 * Rounded to one decimal place because that is how it is read out.
 */
export function responseSeconds(answeredAt, startedAt) {
  return Math.round(Math.max(0, answeredAt - startedAt) / 100) / 10;
}

/**
 * Leaderboard ordering: most points first, then whoever got there first on
 * total response time (a tiebreak the room understands), then name.
 */
export function rankPlayers(players) {
  const sorted = [...players].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const aMs = a.totalResponseMs ?? 0;
    const bMs = b.totalResponseMs ?? 0;
    if (aMs !== bMs) return aMs - bMs;
    return String(a.name).localeCompare(String(b.name));
  });

  // Equal scores share a position (1, 2, 2, 4) so the screen never lies.
  const ranked = [];
  for (let i = 0; i < sorted.length; i++) {
    const tiedWithPrevious = i > 0 && sorted[i].score === sorted[i - 1].score;
    const position = tiedWithPrevious ? ranked[i - 1].position : i + 1;
    ranked.push({ ...sorted[i], position });
  }
  return ranked;
}
