/**
 * Who is knocking, and whether to open the door.
 *
 * The join code is printed on the projector and read out on the mic, so
 * everybody in the room has it — that is the design. But joining is an
 * ordinary web request, so anybody bored can fire a few hundred from a phone
 * browser and fill the scoreboard with junk teams. Measured: **300 joins
 * landed in half a second.**
 *
 * ---
 *
 * **IT HOLDS, IT NEVER REFUSES.** A control that says no in front of a room is
 * the mistake this codebase keeps recording, and a hard limit set from a guess
 * is a lockout you cannot undo mid-gig. So over the threshold new phones are
 * asked to wait, the host's board says *"18 phones waiting to join — Let them
 * in"*, and one tap lets the lot through.
 *
 * **The NUMBER is what tells the host which it is.** Eighteen waiting is a
 * room; three hundred is somebody messing about. That judgement needs a human
 * and takes them a second, which is why it is not automated.
 *
 * ---
 *
 * **A PHONE THAT CAN PROVE WHO IT IS NEVER QUEUES.** Only joins that would
 * create a NEW player are counted. A rejoin carries a token (see
 * `ownsPlayer`), so it is provably somebody already in the game coming back —
 * and coming back en masse is exactly what happens after a redeploy, a
 * restart on a host with no disk, or a wifi blip. Two hundred phones
 * reconnecting at once looks precisely like a flood, and holding them would be
 * a self-inflicted outage in the middle of a night.
 *
 * ---
 *
 * **Why not per-IP.** It is the obvious answer and it is wrong here: a pub
 * puts the whole room behind one router, so a per-address rule refuses the
 * actual customers first. Online it would half-work — home broadband, mobile —
 * but an office puts a dozen people behind one address too, and one rule that
 * holds in both modes is worth more than two that each work in one.
 */

/** How long a burst is measured over. Short enough to notice, long enough to average out a room. */
export const WINDOW_MS = 10_000;

/**
 * New phones per window before the door is held. **Twelve a second.**
 *
 * **Err LOOSE, and the asymmetry is the whole reason.** The first version of
 * this was tight, on the theory that a wrong guess costs one tap. It does not:
 *
 * - Too tight and a real room gets a "just a moment" screen while the host is
 *   on a mic and not looking at their phone. Players are stuck, the show
 *   stops, and it is this app's fault.
 * - Too loose and some junk teams reach the scoreboard. Nobody playing is
 *   affected, the host sees it, and "remove the ones who answered nothing" is
 *   one tap.
 *
 * One of those is a gig going wrong and the other is tidying up, so the
 * threshold sits well above anything a room can physically do.
 *
 * The gap makes that free. Sixty people told to scan take twenty to sixty
 * seconds — they have to find the camera and type a name — so a pub peaks
 * around two to six a second. Two hundred clicking a link in a Teams channel
 * is five to ten. A script does six hundred. Twelve a second clears every real
 * burst and is still fifty times below the thing it is for.
 */
export const BURST = 120;

/** How long one tap holds the door open. Long enough for a whole room to get through. */
export const LET_IN_MS = 60_000;

export class JoinGate {
  constructor(now = () => Date.now()) {
    this.now = now;
    /** When each NEW player joined. Rejoins are never in here. */
    this.recent = [];
    /*
     * Phones held since the host last looked, keyed so ten retries by one
     * phone count as one person rather than ten.
     *
     * **The key is the phone's own `tryId`** — a random string it keeps in
     * localStorage, sent with every attempt. A caller that sends none gets a
     * near-enough anonymous key instead, and several of those collapse
     * together: measured, a script firing 300 joins shows the host about 40
     * rather than 180.
     *
     * That is worth knowing and is deliberately NOT fixed by counting attempts,
     * because it errs the way this whole file errs. An inflated number makes a
     * host hesitate over a real room while they are on a mic, which is the show
     * stopping; a deflated one makes them let some junk teams through, which is
     * one tap to tidy up afterwards. Real phones send a `tryId` — it is how
     * they remember who they are at all — so a genuine room counts correctly
     * and it is only a script that reads low.
     */
    this.waiting = new Map();
    this.openUntil = 0;
  }

  /** Trim the window. Everything here works on "new joins in the last few seconds". */
  #trim(at) {
    const since = at - WINDOW_MS;
    while (this.recent.length && this.recent[0] < since) this.recent.shift();
    // A phone that gave up and went away should stop being counted as waiting,
    // or the host is shown a number that only ever grows.
    for (const [id, seen] of this.waiting) {
      if (seen < at - 60_000) this.waiting.delete(id);
    }
  }

  /**
   * @param {boolean} known  this phone proved it is already a player
   * @param {string} [who]   something stable per phone, so ten retries are one person
   * @returns {{ok: true} | {ok: false, waiting: number}}
   */
  ask({ known = false, who = '' } = {}) {
    const at = this.now();
    this.#trim(at);

    // Provably already in the game. Never counted, never held — this is the
    // reconnection storm after a restart, and it must not look like a flood.
    if (known) return { ok: true };

    if (at < this.openUntil) {
      this.recent.push(at);
      return { ok: true };
    }

    if (this.recent.length >= BURST) {
      this.waiting.set(who || `anon:${at}:${Math.round(this.recent.length)}`, at);
      return { ok: false, waiting: this.waiting.size };
    }

    this.recent.push(at);
    return { ok: true };
  }

  /** What the host's board says. Zero means there is nothing to show at all. */
  waitingCount() {
    this.#trim(this.now());
    return this.waiting.size;
  }

  /** One tap: everybody knocking gets in, and so does anybody arriving for the next minute. */
  letThemIn() {
    const at = this.now();
    this.openUntil = at + LET_IN_MS;
    this.recent = [];
    const let_in = this.waiting.size;
    this.waiting.clear();
    return { ok: true, letIn: let_in, until: this.openUntil };
  }

  /** A fresh game starts with nobody knocking and nothing counted against it. */
  reset() {
    this.recent = [];
    this.waiting.clear();
    this.openUntil = 0;
  }
}
