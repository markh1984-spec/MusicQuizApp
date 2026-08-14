/**
 * TONIGHT'S RUNNING ORDER — rounds from more than one pack, for one night.
 *
 * Asked for as *"mix and match 1980s A and 1980s B without affecting the
 * master copies"*, and then reframed by the host in a way that decided what
 * this actually is: *"the only reason you would drag a round out of one quiz
 * into another is so that you can launch the night — so I think that happens
 * in the night section."*
 *
 * **That reframing is the whole design, and it is why this file is small.**
 * In the EDITOR the same feature is pack-authoring: it needs copy-on-write, a
 * name for the new pack, a decision about whether a borrowed question stays
 * linked to its source, and an answer to rule 11 about corrections reaching
 * every copy. In TONIGHT it is none of those things — it is a list of rounds
 * to play this evening, thrown away when the night ends, touching no file.
 *
 * ---
 *
 * **NOTHING IS COPIED ONTO DISK, WHICH IS WHAT KEEPS RULE 11 TRUE.** The
 * composed pack is built in memory at launch out of rounds read from the real
 * files at that moment. There is no second copy to go stale, no fork nobody
 * knows about, and a correction saved to a source pack tomorrow is simply in
 * the next night that uses it.
 *
 * **THE ROUNDS ARE DEEP-COPIED, and that is not a formality.** The engine
 * writes to what it is given — `clampPointers()`, the bingo shape fields, and
 * anything a future round type does — and the source packs are the SAME
 * objects `readPack` hands to every other caller. A shallow copy would mean a
 * night quietly editing the pack it borrowed from.
 *
 * **THE ID IS RESERVED AND CANNOT BE A FILE.** `safeId()` in `quizzes.js`
 * strips everything outside `[a-zA-Z0-9._-]`, so no pack on disk can ever be
 * called `~tonight`. That matters for one specific reason:
 * `reloadPackEverywhere()` in `server.js` finds a running game by comparing
 * `session.pack.id` against the id being saved, and re-reads that id from
 * disk. A composed pack has no file behind it — if its id could collide with
 * a real one, saving an unrelated pack would replace a running night with
 * something else mid-quiz. It cannot collide, and there is a test that says
 * so.
 */

import { validateQuiz } from './quizzes.js';

/**
 * The id a composed night carries. Reserved: see the note above on why it
 * begins with a character no pack file can contain.
 */
export const COMPOSED_ID = '~tonight';

/** Whether a pack is one of these rather than something off disk. */
export const isComposed = (id) => id === COMPOSED_ID;

/**
 * How many rounds one night may be built from.
 *
 * Not a technical limit — a guard against a stuck drag or a script. Twelve is
 * already twice the longest night this app has ever run, and a quiz with
 * forty rounds in it is a mistake somebody wants told about rather than
 * played.
 */
export const MAX_ROUNDS = 12;

/**
 * Build tonight's quiz out of rounds taken from packs already on the shelf.
 *
 * @param {Array} order     `[{ packId, round }]` — round is an INDEX into that
 *                          pack's own rounds, in the order they will be played
 * @param {Function} load   `(packId) => pack`, normally `readPack`'s loader.
 *                          Called once per distinct pack however many rounds
 *                          are taken from it.
 * @returns {object} a quiz pack, valid, with no file behind it
 */
export function composeQuiz(order = [], load) {
  const wanted = Array.isArray(order) ? order : [];
  if (!wanted.length) throw new Error('A running order needs at least one round.');
  if (wanted.length > MAX_ROUNDS) {
    throw new Error(`A night can have at most ${MAX_ROUNDS} rounds.`);
  }

  // One read per pack, not one per round — a night built of five rounds from
  // the same quiz should not read that file five times.
  const packs = new Map();
  const rounds = [];
  const from = [];

  for (const entry of wanted) {
    const packId = String((entry && entry.packId) || '').trim();
    if (!packId) throw new Error('A round in the running order has no pack.');
    if (!packs.has(packId)) {
      let pack;
      try {
        pack = load(packId);
      } catch {
        pack = null;
      }
      /*
       * A PACK THAT IS NO LONGER THERE IS NAMED, not skipped. Somebody built
       * a running order this morning and deleted a pack this afternoon; a
       * night that quietly launched with four rounds instead of five is the
       * kind of thing you notice at question one, in front of a room.
       */
      if (!pack) throw new Error(`There is no pack called ${packId} any more.`);
      packs.set(packId, pack);
    }
    const pack = packs.get(packId);
    const at = Number(entry.round);
    const round = Number.isInteger(at) ? (pack.rounds || [])[at] : null;
    if (!round) throw new Error(`${pack.title || packId} has no round ${Number(entry.round) + 1}.`);
    // Deep, because the engine writes to what it is handed and these objects
    // are the same ones every other caller of `readPack` is holding.
    rounds.push(JSON.parse(JSON.stringify(round)));
    from.push(pack);
  }

  /*
   * WHAT IT IS CALLED.
   *
   * All from one pack — which is what an ordinary launch looks like once it
   * goes through here — and it keeps that pack's own title, so nothing about
   * a normal night changes on screen or in the archive. Mixed, it is named
   * for the evening, because no source title is honest about the whole of it
   * and picking the first one would put "The 1980s Pop Music Quiz" on a
   * projector showing three rounds of Motown.
   */
  const only = packs.size === 1 ? [...packs.values()][0] : null;

  const pack = {
    id: COMPOSED_ID,
    title: only ? only.title : 'Tonight’s quiz',
    // The look follows the FIRST round's pack, so a Halloween quiz with one
    // borrowed round still arrives dressed. The launch can override it, as it
    // can for any pack.
    look: (from[0] && from[0].look) || '',
    rounds,
    /*
     * WHERE EACH ROUND CAME FROM, kept for the host's own screen rather than
     * for the engine — "round 3 · The Madonna Quiz" is what stops somebody
     * wondering which pack a question they are being challenged on came out
     * of. Never sent to a projector or a phone: the room has no use for it
     * and the two-screens rule says a payload carries what its reader needs.
     */
    sources: from.map((p, i) => ({ packId: wanted[i].packId, title: p.title || wanted[i].packId })),
  };

  const problems = validateQuiz(pack);
  if (problems.length) throw new Error(problems[0]);
  return pack;
}
