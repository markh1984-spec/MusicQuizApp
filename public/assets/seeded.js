/**
 * ONE SEEDED RANDOM, SHARED BY EVERY LOBBY GAME.
 *
 * The host's catch about Maze Mouth applies to every game that ever goes in
 * the lobby: *"the game has to be consistent or else the scoreboard makes no
 * sense."* Two people on one leaderboard must have faced the same game, or the
 * higher score might only have been the luckier one.
 *
 * So each game takes its randomness from `state.gameSeed` — one number, set at
 * launch, living in the game state so a restart at half nine does not hand the
 * second half of the room a different game from the first. Exactly the
 * arrangement `roundIdeas` and the prize draw already use.
 *
 * **IT LIVES HERE RATHER THAN IN EACH GAME, and that is not tidiness.** Two
 * copies of a generator is two generators, and the day one of them is
 * "improved" is the day two games seeded from the same number stop being
 * comparable — silently, on a projector, in front of a room. Maze Mouth had
 * the only copy; Rally needed the identical thing, which is exactly the moment
 * to have one.
 *
 * Mulberry32 — eight lines, no dependency, and far better than good enough for
 * deciding which way a chaser turns or where a serve goes.
 */
export function seeded(seed) {
  let a = (Number(seed) || 1) >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
