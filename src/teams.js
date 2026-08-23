/**
 * HOW A ROOM IS DIVIDED UP — the three ways to play a night.
 *
 * ---
 *
 * Asked for on 23 August 2026: *"can we make the phones say 'individual, team
 * random and team assigned' — there may be some nights where people play as a
 * team and other nights it's just more fun to be random."*
 *
 * Two of the three already existed and had no names of their own. The bar
 * offered *"One phone each"* and *"Teams — several phones, scores averaged"*,
 * which describes the MECHANISM rather than the choice; naming them
 * **Individual** and **Team — you pick** makes room for the third and says
 * what each one is from the player's side rather than the engine's.
 *
 * | Mode | Who decides the team | What the phone shows |
 * |---|---|---|
 * | `solo` | nobody — every phone is its own | no team control at all |
 * | `assigned` | the players, by naming or joining one | the picker |
 * | `random` | the app, at the moment they join | who they are playing for |
 *
 * ---
 *
 * **`teamPlay` STAYS A BOOLEAN AND STAYS THE GATE.** It is read in six places
 * in the engine — the leaderboard, `boardIdFor`, `makeTeam`, `joinTeam`, and
 * two payload builders — and every one of them means "is this a team night",
 * which is true of both team modes. Adding a second value to that field would
 * have touched all six for a question none of them asks. So the mode lives
 * beside it in `state.teamMode`, both are set from ONE choice at launch, and
 * an ordinary solo night still takes the code path it has always taken —
 * which is what `pub-unchanged.mjs` exists to prove.
 *
 * **NOBODY IS EVER MOVED ONCE DEALT.** A team is decided at the moment a
 * phone joins and never again: re-dealing a room mid-night would take
 * somebody's score away from the people they have been sitting with, and
 * re-dealing at kick-off would mean the team you were told at the door is not
 * the team you end up on. It also makes the whole thing restart-proof for
 * free — the assignment is in the state like everything else.
 */

/**
 * The names dealt out, in order.
 *
 * **Colours, because they are the shortest thing a host can shout across a
 * pub** — "that's a point to the Blues" works from a microphone in a way that
 * an invented name does not, and nobody has to be told what they mean.
 *
 * Six is the ceiling for a reason: this list goes on the projector as a
 * leaderboard, and a board of ten rows read from the back of a dark room is
 * not a board anybody follows.
 *
 * Worth knowing rather than worth fixing: the option letters A–F carry fixed
 * colours of their own on the projector, so a team called Blues can sit near
 * a blue answer. They are in different places on different screens and one is
 * a word where the other is a swatch — but if a room ever reads them as
 * connected, this list is the thing to change.
 */
export const RANDOM_TEAM_NAMES = ['Reds', 'Blues', 'Greens', 'Yellows', 'Purples', 'Oranges'];

/**
 * How many people a team wants before another team is started, and the most
 * teams there can be.
 *
 * Four because that is a pub table, and six because of the board. Constants
 * rather than settings — the simplest version that works, and a number that
 * might want to be configurable is a constant with a note saying so rather
 * than a control nobody asked for.
 */
export const RANDOM_TEAM_TARGET = 4;
export const RANDOM_TEAM_MAX = RANDOM_TEAM_NAMES.length;

/**
 * WHERE THE NEXT PHONE GOES — an existing team to join, or a new one to make.
 *
 * **The teams GROW WITH THE ROOM rather than being fixed at launch**, which
 * they have to, because nobody knows at launch how many people will turn up.
 * Four arrive and they are one team; twenty-five arrive and they are six.
 * Fixing the count in advance would give a quiet Tuesday six teams of one and
 * a busy Friday six teams of ten.
 *
 * **The smallest team wins, and ties are broken at RANDOM.** The smallest-team
 * rule is what keeps them even without anybody ever being moved; the random
 * tie-break is what stops the deal being a queue, so two friends joining one
 * after the other are not reliably put together — which is the entire point of
 * this mode.
 *
 * **A team of one is not unfair, and that is why the lopsided moment is
 * allowed to exist.** Scores are AVERAGED, so a lone player is judged on the
 * same scale as a four; if anything a big team is the harder place to be,
 * because one person who knows nothing pulls the average down. Without
 * averaging this shape of dealing would need a shuffle at kick-off, and a
 * shuffle would break the promise directly above it.
 *
 * @param {Array} teamList `[{ id, size }]` — what `teamList()` returns
 * @param {function} random injected, like every other random in this engine
 * @returns {{join: string}|{create: string}}
 */
export function dealInto(teamList, random = Math.random) {
  const teams = Array.isArray(teamList) ? teamList : [];
  if (!teams.length) return { create: RANDOM_TEAM_NAMES[0] };
  const smallest = Math.min(...teams.map((t) => Number(t.size) || 0));
  if (smallest >= RANDOM_TEAM_TARGET && teams.length < RANDOM_TEAM_MAX) {
    /*
     * The next NAME, not "the next unused one" — the list is dealt in order,
     * so the second team on any night is always the Blues. A host who says
     * "Reds and Blues over here" is describing the same two teams every week.
     */
    return { create: RANDOM_TEAM_NAMES[teams.length] };
  }
  const level = teams.filter((t) => (Number(t.size) || 0) === smallest);
  return { join: level[Math.floor(random() * level.length)].id };
}
