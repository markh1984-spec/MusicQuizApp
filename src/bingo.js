/**
 * Music bingo.
 *
 * You play tracks from your DJ app. Every phone gets its own card of track
 * titles. When a player hears one on their card they tap it. Complete a line
 * and they hit the BINGO button.
 *
 * THE ANTI-CHEAT RULE, which drives the whole design:
 *
 *   A card is generated ON THE SERVER when a phone joins, and stored against
 *   that player for the whole round. The phone never generates anything, so
 *   there is nothing to "regenerate" — refreshing, reopening the link, or
 *   clearing the browser all return the same card. There is deliberately no
 *   endpoint that hands out a new card.
 *
 * Claims are checked against what you actually played. A player can mark
 * whatever they like on their own card, but a line only counts if every track
 * in it has genuinely been called. Wrong calls are recorded rather than
 * silently ignored, because a false alarm is half the fun in a room.
 */

import { cleanTeamName, faceKey, isSafeId, newId, newToken, newVoucherCode, ownsPlayer, MAX_PLAYERS, rememberRemoved, wasRemoved, forgetRemoved } from './engine.js';
import { comeBackView } from './comeback.js';
import { recordArcadeScore, arcadeBoard, arcadeFields } from './arcade.js';
import { breakNow, offersGame, offersPhotos } from '../public/assets/break-parts.js';

import { noteForPlayer, notesForHost } from './notes.js';

export const BINGO_PHASES = {
  LOBBY: 'lobby',
  PLAYING: 'playing',
  WON: 'won',
  FINISHED: 'finished',
};

/**
 * The most squares a card may have.
 *
 * Not an arbitrary number: 5x5 is 25 and a 3-across strip of 8 is 24, so this
 * leaves room for a 6x6 and stops anything that would be unreadable on the
 * phone in somebody's hand in a dark pub.
 */
export const MAX_SQUARES = 36;

/** What a full card has to look like to win. */
export const TARGETS = {
  LINE: 'line',
  FULL: 'full',
};

/**
 * The prizes in a round, in the order they are won.
 *
 * A stage is either a NUMBER — how many complete lines it takes — or the
 * string 'full', a full house. `[1, 'full']` is one line then a full house,
 * which is what every round did before this and is still the default.
 *
 * Traditional pub bingo is one line, two lines, full house, and that is the
 * shape this follows: the line stages count up from one and the last prize is
 * always the full card. Predictable matters more than clever here — the room
 * already knows how bingo works, and the host has to say it out loud.
 */
export const DEFAULT_STAGES = [1, TARGETS.FULL];

/** The stages for a given number of prizes: 1, 2, 3 … then a full house. */
export function stagePlan(prizes = 2) {
  const n = Math.max(1, Math.floor(prizes));
  return [...Array(n - 1).keys()].map((i) => i + 1).concat(TARGETS.FULL);
}

/**
 * How many prizes a card of this shape can carry.
 *
 * Capped by how many lines it has, because the last line stage has to be
 * winnable BEFORE the full house — on a 3-across strip there are only three
 * lines, and completing all three is a full house, so two line stages is the
 * most that leaves the last prize meaning anything.
 */
export function maxPrizes(shape) {
  return Math.max(1, Math.min(5, cardLines(shape).length));
}

/** "a line", "3 lines", "a full house" — one wording, used on every screen. */
export function stageLabel(stage) {
  if (stage === TARGETS.FULL) return 'a full house';
  return stage === 1 ? 'a line' : `${stage} lines`;
}

export class BingoGame {
  /**
   * @param {object} opts
   * @param {object} opts.pack  a bingo pack (see bingo/*.json)
   * @param {function(): number} [opts.now]
   * @param {object} [opts.state]
   * @param {function(BingoGame): void} [opts.onChange]
   */
  constructor({ pack, now = () => Date.now(), state = null, onChange = null }) {
    this.pack = pack;
    this.now = now;
    this.onChange = onChange;
    this.state = state || BingoGame.freshState(pack);
  }

  static freshState(pack) {
    return {
      kind: 'bingo',
      packId: pack.id,
      // The card shape is part of THIS GAME, not of the pack — it is chosen at
      // launch and can differ from what the file says. Writing it here is what
      // makes it survive a restart: the state is the record of the night, and
      // the pack on disk is only the default it started from.
      //
      // It has to be here. When it lived only on the in-memory pack, a crash
      // brought the game back as whatever the file said — twenty-four squares
      // on every phone and a 4x4's idea of a line on the server, which handed
      // somebody a win they had not got.
      ...shapeFields(cardShape(pack)),
      phase: BINGO_PHASES.LOBBY,
      version: 0,
      // Whether anybody launched this, or it is just the pack the server had
      // loaded at boot. The quiz's own `freshState()` carries the full note;
      // both engines need it because either can be the thing on the projector,
      // and `resetAll()` on either one builds a state exactly like this.
      launched: false,
      // The prizes, and which one is being played for. Chosen at launch beside
      // the card shape and, like the shape, written here so a restart brings
      // the same night back rather than the default.
      stages: [...DEFAULT_STAGES],
      stageIndex: 0,
      // Derived from the stage above, and kept in the state because the phone,
      // the projector and the control view have always read it.
      target: TARGETS.LINE,
      // Bumped whenever cards should all be reissued (a new round).
      round: 1,
      players: {},
      called: [], // track ids, in the order you played them
      calledAt: {}, // trackId -> timestamp
      claims: [], // every BINGO press, right or wrong
      winners: { line: [], full: [] },
      /*
       * WHEN THE NEXT ONE IS — the last slide of the night, same field and
       * same shape as the quiz's, because a night is a night whichever game
       * happened to end it. Set at launch from the venue's usual night and
       * the diary (`src/comeback.js`), null when there is nothing true to
       * say, and here rather than on the pack for the reason the card shape
       * is: a restart must bring the night back as it was.
       */
      comeBack: null,
      /*
       * THE LOBBY GAME — a bingo night gets Rally, a quiz night gets Maze
       * Mouth, and both read the same two fields.
       *
       * `gameSeed` is overwritten by `session.launch()`, which is what makes
       * every phone in the room play the identical game — the host's own catch
       * that a scoreboard of different games means nothing. It is declared
       * here so a state saved before this existed still comes back with
       * something rather than `undefined`, exactly as the quiz's does.
       */
      gameSeed: 1,
      // The games a room may choose between, when the quizmaster left it open.
      // `null` is "no choice, play the one in `lobbyGame`" — which is every
      // night before this existed, and what a restored old state reads as.
      lobbyGames: null,
      arcade: {},
      /*
       * WHAT HAPPENS IN THE GAPS — `src/breaks.js`, the same field the quiz
       * engine carries. A bingo game has no rounds, so its only break is its
       * own lobby; the plan is still night-wide and keyed by PART, so a
       * bingo interlude in a running order reads `p1:lobby` and cannot
       * collide with the quiz either side of it.
       */
      breakPlan: {},
      startedAt: null,
      finishedAt: null,
    };
  }

  changed() {
    this.state.version++;
    if (this.onChange) this.onChange(this);
  }

  // ------------------------------------------------------------------- cards

  /**
   * The card's shape.
   *
   * A pack may say `cardSize: 4` (square, and every pack said this until
   * strips arrived) or `cardRows`/`cardCols`. `cardShape()` reads either, so
   * nothing that was already on disk has to be rewritten.
   */
  get shape() {
    // The state first: it is where the shape chosen at launch lives, and the
    // only copy that survives a restart. The pack is the fallback for a game
    // saved before shapes existed.
    return this.state && this.state.cardCols ? cardShape(this.state) : cardShape(this.pack);
  }

  /** Kept for everything that only ever wanted "how wide is it". */
  get size() {
    return this.shape.cols;
  }

  get squareCount() {
    const { rows, cols } = this.shape;
    return rows * cols;
  }

  // ------------------------------------------------------------------ prizes

  /** The prizes for this round, oldest games included. */
  get stages() {
    const list = this.state.stages;
    return Array.isArray(list) && list.length ? list : [...DEFAULT_STAGES];
  }

  /** What is being played for right now. */
  get stage() {
    return this.stages[Math.min(this.state.stageIndex || 0, this.stages.length - 1)];
  }

  /**
   * True once the round has REACHED its last prize — not once that prize has
   * been won. The comment here said "once the last prize has been won" for
   * months, which is a different fact and the one `allPrizesGone` below
   * actually answers. *A comment that claims the opposite is where the next
   * bug hides*, and this one nearly became it.
   */
  get onLastStage() {
    return (this.state.stageIndex || 0) >= this.stages.length - 1;
  }

  /**
   * EVERY PRIZE IN THIS ROUND HAS BEEN CLAIMED — the moment the night has a
   * natural break in it, and the whole point of the flag.
   *
   * Asked for in these words: *"they get it once they get the bingo, but I'd
   * prefer they all get them once the full house is claimed at the same time,
   * so there's an obvious break where they can all get their drinks at the
   * same time."*
   *
   * **IT IS NOT THE `WON` PHASE, and that is the trap this exists to avoid.**
   * `WON` is set by EVERY successful claim — three times on a three-prize
   * round — so a phone keying off the phase would announce the break after
   * the first line, twice too early, and send the room to the bar mid-game.
   * The round is over when the LAST stage has been taken, which is these two
   * facts together and neither on its own.
   */
  get allPrizesGone() {
    return this.onLastStage && this.stageTaken();
  }

  /**
   * Keep `target` in step with the stage.
   *
   * Everything that was written before prizes existed reads `state.target` and
   * expects 'line' or 'full'. Rather than change all of it, the stage decides
   * what target says, so an old screen still shows something true.
   */
  syncTarget() {
    this.state.target = this.stage === TARGETS.FULL ? TARGETS.FULL : TARGETS.LINE;
  }

  get tracks() {
    return this.pack.tracks || [];
  }

  track(id) {
    return this.tracks.find((t) => t.id === id) || null;
  }

  /**
   * Build a card for one player. Deterministic from the player id, the pack
   * and the round number, so the same phone always rebuilds the same card even
   * if the state file were lost — but it is stored anyway, which is what makes
   * it unregeneratable.
   */
  makeCard(playerId, salt = 0) {
    const ids = this.tracks.map((t) => t.id);
    const seed = hashString(`${this.pack.id}:${this.state.round}:${playerId}:${salt}`);
    const shuffled = shuffle(ids, seed);
    return shuffled.slice(0, this.squareCount);
  }

  /**
   * Every card in the room is different. With a decent track list a collision
   * is vanishingly unlikely, but "vanishingly unlikely" is not "impossible",
   * and two teams with the same card would be a row at the bar.
   */
  uniqueCardFor(playerId) {
    const taken = new Set(
      Object.values(this.state.players).map((p) => cardSignature(p.card)),
    );
    for (let salt = 0; salt < 50; salt++) {
      const card = this.makeCard(playerId, salt);
      if (!taken.has(cardSignature(card))) return card;
    }
    return this.makeCard(playerId, Math.floor(this.now() % 1000));
  }

  // ----------------------------------------------------------------- players

  join({ playerId, name, token = '' }) {
    const at = this.now();
    // Same reasoning as the quiz: joining again clears a previous removal.
    if (playerId) forgetRemoved(this.state, playerId);
    // And the same rule about proof: an id is not a credential. Here it also
    // guards the CARD — somebody else's id would otherwise hand over which
    // squares they have, which is the one thing bingo has to keep straight.
    const claimed = playerId && this.state.players[playerId];
    const existing = claimed && ownsPlayer(claimed, token) ? claimed : null;

    if (existing) {
      if (!existing.token) existing.token = newToken();
      // Same phone, same card. There is no path here that issues a new one.
      existing.connected = true;
      existing.lastSeenAt = at;
      const clean = cleanTeamName(name);
      if (clean && clean !== existing.name) existing.name = clean;
      this.changed();
      return existing;
    }

    if (Object.keys(this.state.players).length >= MAX_PLAYERS) {
      return { id: '', name: '', full: true };
    }

    const id = playerId && isSafeId(playerId) && !this.state.players[playerId] ? playerId : newId();
    const player = {
      id,
      token: newToken(),
      name: cleanTeamName(name) || 'Team ' + (Object.keys(this.state.players).length + 1),
      card: this.uniqueCardFor(id),
      marks: new Array(this.squareCount).fill(false),
      joinedAt: at,
      lastSeenAt: at,
      connected: true,
      cardRound: this.state.round,
      falseCalls: 0,
    };
    this.state.players[id] = player;
    this.changed();
    return player;
  }

  touch(playerId) {
    const p = this.state.players[playerId];
    if (!p) return null;
    p.lastSeenAt = this.now();
    p.connected = true;
    return p;
  }

  removePlayer(playerId) {
    if (!this.state.players[playerId]) return false;
    delete this.state.players[playerId];
    rememberRemoved(this.state, playerId);
    this.changed();
    return true;
  }

  /**
   * EVERYBODY WHO HAS JOINED AND THEN DONE NOTHING AT ALL — the quiz's own
   * tidy-up, on the engine that did not have it.
   *
   * `session.run('removeIdle')` calls `this.engine.removeIdlePlayers()` for
   * either game, so on a bingo night `POST /api/host/removeIdle` was a **500,
   * `this.engine.removeIdlePlayers is not a function`**. It matters here for
   * the same reason it matters on a quiz, and more: it is rule 4's other
   * remedy — the way a room gets cleaned up if a flood ever does get past the
   * door — and the panel offering it is shared between the two engines now.
   *
   * **"Done nothing" is MARKED NOTHING, which is bingo's own version of
   * "answered nothing".** Deliberately not "not connected recently": a phone
   * that locks its screen is still somebody sitting at a table, and throwing
   * them out would be the removal rule broken from the other side. A player
   * who has marked even one square is left alone.
   */
  removeIdlePlayers() {
    const idle = this.playerList().filter((p) => !(p.marks || []).some(Boolean));
    for (const p of idle) this.removePlayer(p.id);
    if (idle.length) this.changed();
    return { ok: true, removed: idle.length };
  }

  /**
   * A SCORE FROM RALLY, the lobby game a bingo night gets.
   *
   * The rules are `src/arcade.js` and are shared with the quiz engine, on
   * purpose: a bingo lobby must not accept a score a quiz lobby refuses. All
   * this adds is which phase counts as waiting.
   */
  arcadeScore(playerId, score, game = '') {
    /*
     * `game` IS WHAT THE PHONE SAYS IT WAS PLAYING — a LABEL, never a
     * permission, so there is nothing to win by lying about it. It is checked
     * against the real list inside `recordArcadeScore`, where the rest of the
     * scoreboard's rules live: validating it here and in the bingo engine
     * would be two copies of one rule, which is the fault `arcade.js` exists
     * to prevent.
     */
    const res = recordArcadeScore(this.state, playerId, score, {
      // "A break that offers a game", not "the lobby" — the same change the
      // quiz engine made, in the same words, because the whole point of
      // `arcade.js` is that a bingo night must not accept a score a quiz
      // night refuses.
      waiting: offersGame(breakNow(this.state)),
      game,
    });
    if (res.changed) this.changed();
    return res.ok ? { ok: true, best: res.best } : res;
  }

  /** Who is winning at it — see `arcadeBoard()` in `src/arcade.js`. */
  arcadeBoard(top = 5) {
    return arcadeBoard(this.state, top);
  }

  renamePlayer(playerId, name) {
    const p = this.state.players[playerId];
    const clean = cleanTeamName(name);
    if (!p || !clean) return false;
    p.name = clean;
    this.changed();
    return true;
  }

  playerList() {
    return Object.values(this.state.players);
  }

  /**
   * Everybody holding a phone — the same name the quiz engine uses, so a part
   * boundary can carry the roster without asking which game it came from.
   *
   * Bingo has no organiser concept of its own (there is no scoreboard to keep
   * somebody off), so the two lists are the same here. It exists because
   * `advanceOrder()` builds its carry from `everyone()`: `playerList()` on the
   * QUIZ filters organisers out by design, and building the carry from that
   * dropped the client's own contact at every boundary — rejoined as an
   * ordinary contestant, on the leaderboard and on the projector, with the
   * back channel gone mid-event.
   */
  everyone() {
    return Object.values(this.state.players);
  }

  // ------------------------------------------------------------------ the go

  start() {
    if (!this.tracks.length) return false;
    this.state.phase = BINGO_PHASES.PLAYING;
    this.state.startedAt = this.now();
    this.changed();
    return true;
  }

  /** You played a track. Mark it called. */
  call(trackId) {
    if (!this.track(trackId)) return false;
    if (this.state.called.includes(trackId)) return false;
    if (this.state.phase === BINGO_PHASES.LOBBY) this.start();
    this.state.called.push(trackId);
    this.state.calledAt[trackId] = this.now();
    this.changed();
    return true;
  }

  /** Pressed the wrong one. Take it back. */
  uncall(trackId) {
    const i = this.state.called.indexOf(trackId);
    if (i < 0) return false;
    this.state.called.splice(i, 1);
    delete this.state.calledAt[trackId];
    this.changed();
    return true;
  }

  undoLastCall() {
    const last = this.state.called[this.state.called.length - 1];
    return last ? this.uncall(last) : false;
  }

  /** A player taps a square on their own card. */
  mark({ playerId, index, marked }) {
    const p = this.state.players[playerId];
    if (!p) return { ok: false, reason: 'unknown_player' };
    if (this.state.phase === BINGO_PHASES.FINISHED) return { ok: false, reason: 'finished' };
    const i = Number(index);
    if (!Number.isInteger(i) || i < 0 || i >= p.card.length) return { ok: false, reason: 'bad_square' };
    p.marks[i] = marked === undefined ? !p.marks[i] : Boolean(marked);
    p.lastSeenAt = this.now();
    this.changed();
    return { ok: true, marks: p.marks };
  }

  // ------------------------------------------------------------------ claims

  /** Every winning line on a card of this shape — see cardLines(). */
  lines() {
    return cardLines(this.shape);
  }

  /** A square counts only if the player marked it AND you actually played it. */
  isGood(player, index) {
    return Boolean(player.marks[index]) && this.state.called.includes(player.card[index]);
  }

  /** Which of the card's lines this player has completed, as indexes into lines(). */
  completedLines(player) {
    const out = [];
    this.lines().forEach((line, i) => { if (line.every((sq) => this.isGood(player, sq))) out.push(i); });
    return out;
  }

  /**
   * Check a card against the prize currently being played for. Returns the
   * winning squares so the big screen can show exactly which line it was.
   */
  evaluate(player) {
    const stage = this.stage;
    if (stage === TARGETS.FULL) {
      const all = player.card.map((_, i) => i);
      return all.every((i) => this.isGood(player, i)) ? { won: true, pattern: 'full', squares: all } : { won: false };
    }
    const done = this.completedLines(player);
    if (done.length < stage) return { won: false };
    // Every square in the lines they have finished, so the projector can light
    // up the whole win rather than an arbitrary one of them.
    const all = this.lines();
    const squares = [...new Set(done.flatMap((i) => all[i]))].sort((a, b) => a - b);
    return { won: true, pattern: 'line', squares, lines: done.length };
  }

  /**
   * A player pressed BINGO. Checked properly: a line where they have marked
   * squares you never played is a false alarm, and is recorded as one.
   */
  claim(playerId) {
    const p = this.state.players[playerId];
    if (!p) return { ok: false, reason: 'unknown_player' };
    if (this.state.phase !== BINGO_PHASES.PLAYING && this.state.phase !== BINGO_PHASES.WON) {
      return { ok: false, reason: 'not_playing' };
    }

    const result = this.evaluate(p);
    const at = this.now();
    const record = {
      playerId,
      name: p.name,
      at,
      valid: result.won,
      pattern: result.won ? result.pattern : this.state.target,
      squares: result.won ? result.squares : [],
    };
    this.state.claims.push(record);

    if (!result.won) {
      p.falseCalls++;
      this.changed();
      return { ok: true, valid: false, reason: 'not_yet' };
    }

    /*
     * ONE PRIZE EACH PER ROUND, WHILE ANYBODY ELSE IS STILL IN.
     *
     * Reported off a live night: *"I had one person win three of the four
     * music bingo prizes yesterday… it looks really bad on me if one guy wins
     * all the prizes."* It is not luck going wrong, it is the shape of the
     * game — the person holding the best card wins the line, and that same
     * card is then nearest to two lines and nearest to the house. Whoever
     * takes the first prize is the FAVOURITE for every prize after it.
     *
     * **THE CLAIM IS STILL RIGHT, AND IS RECORDED AS RIGHT.** They are not
     * charged a false call and their card is not wrong — the prize simply
     * passes to somebody who has not had one. That distinction is the whole
     * design: a room that hears a shout and sees the app call it a mistake is
     * worse than the problem this fixes.
     *
     * **AND IT LIFTS THE MOMENT EVERYBODY HAS ONE**, which is what stops a
     * small room stalling: with four prizes and three players, the fourth is
     * open to all of them again. The test is "is there anybody left who has
     * not won", never a count of prizes, so it holds at any room size.
     *
     * It does not need a setting. A venue wanting one person to take the lot
     * is not a thing anybody has asked for, and this is one line to invert if
     * it ever is.
     */
    /*
     * AND A STAGE CAN ONLY BE TAKEN ONCE — checked BEFORE anything is
     * recorded.
     *
     * Alpha claims the line: projector says "Alpha", voucher to Alpha. Bravo's
     * button is still live, because Bravo holds no prize and so stands down
     * for nothing. Bravo has a genuine line a beat later — the ordinary thing
     * that happens in a pub — presses, and the guard below stopped the second
     * VOUCHER while everything after it ran anyway: `state.lastWin` was
     * overwritten unconditionally, so **the projector changed the winner's
     * name to Bravo while the prize stayed with Alpha**, Alpha's phone
     * reverted to "Press BINGO!", and `results()` filed BOTH as winners — into
     * Past gigs and the landlord's report.
     *
     * The third outcome is the one the phone already has wording for:
     * *"Correct — that one has gone"*. Their call was right and is recorded as
     * right; the prize simply went a moment earlier. **`tooLate` rather than
     * `standDown` alone**, so the host's claim list can say which of the two
     * happened — "had one" is a fact about the player and would be a lie here.
     */
    if (this.stageTaken()) {
      record.standDown = true;
      record.tooLate = true;
      this.changed();
      return { ok: true, valid: true, prize: false, reason: 'stage_gone' };
    }

    /*
     * ONE PRIZE PER PHONE PER ROUND, AND IT NEVER LIFTS.
     *
     * It used to lift the moment everybody in the room held a prize —
     * `stillWithoutAPrize()`, now deleted. The reasoning was that the rule
     * had done its job by then, and it is the wrong reasoning: **from the
     * room's side that is a BINGO button that goes live, dead, then live
     * again, with nothing on screen explaining either change.** Reported off
     * a real night as *"it has weird block midway through and its not as
     * smooth as I'd like"*, which is that exactly.
     *
     * So a phone that has won is out of the running for the rest of the
     * round, full stop — one state change, forwards only, and the phone is
     * given something to look at instead of a dead button (`view.tookOne`).
     *
     * **THE COST IS A ROUND THAT CANNOT PAY OUT, and it is not automated
     * away.** Five prizes among three phones now leaves prizes four and five
     * unwinnable, so `view.stalled` tells the host and the host decides —
     * *Play on*, *New round*, *Finish*. Lifting a rule the room was told
     * about is the rig running backwards; saying nothing is the fault
     * `stalled` was built for.
     */
    if (this.holdsAPrize(playerId)) {
      record.standDown = true;
      this.changed();
      return { ok: true, valid: true, prize: false, reason: 'already_won' };
    }

    const list = this.state.winners[result.pattern];
    if (!list.includes(playerId)) list.push(playerId);
    // Who won which prize, so the projector can list them at the end. Keyed by
    // stage rather than by pattern, because "2 lines" and "3 lines" are both
    // 'line' and are different prizes.
    if (!Array.isArray(this.state.prizeWinners)) this.state.prizeWinners = [];
    const stageIndex = this.state.stageIndex || 0;
    if (!this.state.prizeWinners.some((w) => w.stageIndex === stageIndex)) {
      this.state.prizeWinners.push({ stageIndex, playerId, name: p.name, stage: this.stage, at });
      /*
       * AND AGAINST THE WHOLE GAME, which is the list `newRound()` keeps.
       * `prizeWinners` answers "has THIS prize gone"; this answers "has this
       * phone had one tonight" and must outlive a fresh set of cards.
       */
      if (!Array.isArray(this.state.wonThisGame)) this.state.wonThisGame = [];
      if (!this.state.wonThisGame.includes(playerId)) this.state.wonThisGame.push(playerId);
      this.issueVoucher(stageIndex, playerId, p.name);
    }
    this.state.phase = BINGO_PHASES.WON;
    this.state.lastWin = {
      playerId, name: p.name, pattern: result.pattern, squares: result.squares, at,
      stage: this.stage, stageIndex, label: stageLabel(this.stage),
    };
    this.changed();
    return { ok: true, valid: true, pattern: result.pattern, stage: this.stage };
  }

  /**
   * What is on offer, tidied — see the same method in `engine.js`. Set on the
   * NIGHT at launch (`session.launch()` writes `state.rewards` for either
   * game), so a bingo night reads the venue's prizes exactly as a quiz does;
   * this only exists here so bingo does not have to reach into the quiz
   * engine to ask.
   */
  rewardList() {
    const list = Array.isArray(this.state.rewards) ? this.state.rewards : [];
    const out = list.map((r) => String(r || '').trim());
    while (out.length && !out[out.length - 1]) out.pop();
    return out;
  }

  /**
   * Change what tonight is playing for, mid-game — see the same method on
   * `engine.js`'s Engine class, and the same catch-up for the same reason.
   *
   * **A LINE WON BEFORE THE PRIZE WAS TYPED IN STILL GETS ITS VOUCHER.** This
   * used to say the change "only ever affects a prize not yet handed out",
   * which was true and was the bug: bingo mints a voucher at the instant a
   * stage is claimed, so on a night launched with nothing on the venue record
   * the line winner got no QR — and pressing **Prizes** afterwards, which is
   * exactly what a host does about it, changed nothing they could see.
   */
  setRewards(list) {
    if (!Array.isArray(list)) return false;
    this.state.rewards = list.slice(0, 10).map((r) => String(r ?? '').trim().slice(0, 200));
    this.payWinnersOwed();
    this.changed();
    return true;
  }

  /**
   * Anybody who has already won a stage this round and holds no voucher for it.
   *
   * **KEYED ON THE ROUND, NOT JUST THE STAGE, because `newRound()` clears
   * `prizeWinners` and `stageIndex` and deliberately does NOT clear
   * `vouchers`** — the line prize from round one is still live in somebody's
   * hand at the bar. So a guard that only asked "is there a voucher for stage
   * 1" would refuse to pay round two's line winner. The win's own timestamp is
   * what tells them apart: a voucher for THIS win cannot have been issued
   * before the win happened.
   *
   * `at` is missing on a state written before `prizeWinners` carried one, and
   * the fallback is to pay: an unpaid winner standing at the bar costs more
   * than a duplicate code the host can void.
   */
  /**
   * Has the prize being played for already gone?
   *
   * Keyed on `stageIndex` — the same key `prizeWinners` is written under, and
   * for the same reason: "2 lines" and "3 lines" are both the `line` pattern
   * and are different prizes. It goes false again the moment the host presses
   * on (`playOn()` advances the index) and on a fresh round.
   */
  stageTaken() {
    const stageIndex = this.state.stageIndex || 0;
    return (this.state.prizeWinners || []).some((w) => w.stageIndex === stageIndex);
  }

  /**
   * Has this player already taken a prize in this BINGO GAME?
   *
   * **THE SCOPE IS THE GAME, NOT THE ROUND — asked for after a live night:**
   * *"when I run, say, a quiz and a music bingo … the same person can't win
   * multiple prizes per quiz or music bingo."* It was per-round, and
   * `newRound()` clears `prizeWinners`, so the table that took the line in
   * round one was fully eligible again in round two — which is the same
   * person hoovering up prizes across an evening, the complaint this whole
   * area exists for, arriving one level up.
   *
   * So it reads `wonThisGame`, which `newRound()` deliberately does NOT
   * clear. `prizeWinners` is still consulted because a state written before
   * this existed has no `wonThisGame`, and the safe direction is to
   * REMEMBER a win rather than forget one.
   *
   * A fresh bingo PART is a fresh game and starts empty — two bingo games in
   * one evening are two games, which is what "per music bingo" says.
   */
  holdsAPrize(playerId) {
    if ((this.state.wonThisGame || []).includes(playerId)) return true;
    return (this.state.prizeWinners || []).some((w) => w.playerId === playerId);
  }

  payWinnersOwed() {
    const rewards = this.rewardList();
    const held = Object.values(this.state.vouchers || {});
    for (const w of this.state.prizeWinners || []) {
      const mine = held.find((v) => v.winnerId === w.playerId
        && v.place === w.stageIndex + 1
        && (!w.at || v.issuedAt >= w.at));
      if (!mine) { this.issueVoucher(w.stageIndex, w.playerId, w.name); continue; }
      /*
       * AND A PRIZE CORRECTED AFTER IT WAS WON REACHES THE CODE ALREADY IN
       * SOMEBODY'S HAND.
       *
       * "Paid" was decided from winner + place + time and never compared the
       * WORDS. So the venue changes what the line is worth, the host presses
       * *Prizes* — the one control that exists for exactly this — and nothing
       * happened: the winner's phone went on showing the old prize and the bar
       * went on reading it out. This is the same fault the quiz's own
       * *"takes effect from the next prize onward"* wording used to describe,
       * which both engines were changed to stop doing.
       *
       * **UPDATED IN PLACE, never a second voucher** — two live codes in one
       * hand is the thing `issueVoucher()`'s idempotency exists to prevent,
       * and the code they are holding stays the one that scans.
       *
       * **A REDEEMED ONE IS LEFT ALONE.** The drink has gone; rewriting what
       * it said afterwards is editing history rather than correcting a
       * promise.
       */
      const now = rewards[w.stageIndex];
      if (now && !mine.redeemedAt && mine.reward !== now) mine.reward = now;
    }
  }

  /**
   * One prize, one voucher, the moment it is actually won — never at the end
   * of the night, because bingo hands prizes out AS it goes rather than once
   * at a final scoreboard. The Nth prize on the venue's list goes with the
   * Nth stage: a night with "a line" then "full house" pays out the first
   * reward for the line and the second for the house, in the order a pub
   * actually reads them off a card behind the bar.
   *
   * Silent when the venue put up fewer prizes than there are stages — a stage
   * nobody is paying for is a real thing (a free extra line before the house)
   * and must not mint a voucher for nothing.
   */
  issueVoucher(stageIndex, playerId, name) {
    const reward = this.rewardList()[stageIndex];
    if (!reward) return;
    if (!this.state.vouchers) this.state.vouchers = {};
    let code = newVoucherCode();
    while (this.state.vouchers[code]) code = newVoucherCode();
    this.state.vouchers[code] = {
      code,
      winnerId: playerId,
      name,
      // Reused as the same "1st / 2nd / 3rd" badge the quiz's voucher panel
      // already draws — the FIRST prize won is the one a room sees first,
      // exactly as it is for a quiz's finishing positions.
      place: stageIndex + 1,
      stage: this.state.stages[stageIndex],
      reward,
      venue: this.state.venue || '',
      /*
       * WHICH ROUND IT WAS WON IN — so a phone can be told to sit on it until
       * the round is over without ever holding one back from a round that has
       * already finished. `newRound()` bumps `state.round` and deliberately
       * does NOT clear `vouchers`, so without this stamp a code won in round
       * one would be held back for ever by round two.
       *
       * A voucher written before this existed has no `round`, which reads as
       * "not this one" and shows — the safe direction: a code nobody can see
       * is a drink nobody gets.
       */
      round: this.state.round,
      issuedAt: this.now(),
      redeemedAt: null,
      reinstated: 0,
      history: [],
    };
  }

  /**
   * Spend it and put it back — identical to the quiz engine's own methods,
   * because the redeem route (`/v`, `/api/voucher/redeem`) and the host's
   * "Mark it used" / "Put it back" buttons call whichever engine is running
   * without asking which game it is. Two copies rather than a shared mixin,
   * for the same reason the whole class is separate from `Engine`: a bingo
   * night and a quiz night must never be able to reach into each other by
   * accident through something they happen to share.
   */
  redeemVoucher(code, { by = 'scan' } = {}) {
    const v = (this.state.vouchers || {})[String(code || '').toUpperCase()];
    if (!v) return { ok: false, reason: 'unknown' };
    if (v.redeemedAt) return { ok: false, reason: 'already', voucher: v };
    v.redeemedAt = this.now();
    v.history.push({ what: 'redeemed', by, at: v.redeemedAt });
    this.changed();
    return { ok: true, voucher: v };
  }

  reinstateVoucher(code) {
    const v = (this.state.vouchers || {})[String(code || '').toUpperCase()];
    if (!v) return { ok: false, reason: 'unknown' };
    if (!v.redeemedAt) return { ok: false, reason: 'not_redeemed', voucher: v };
    v.history.push({ what: 'reinstated', by: 'host', at: this.now(), was: v.redeemedAt });
    v.redeemedAt = null;
    v.reinstated += 1;
    this.changed();
    return { ok: true, voucher: v };
  }

  /**
   * Carry on to the next prize.
   *
   * There is nothing to carry on to once the last one has gone, so this says
   * no rather than quietly restarting the round somebody has just won.
   */
  playOn() {
    if (this.onLastStage) return false;
    this.state.stageIndex = (this.state.stageIndex || 0) + 1;
    this.syncTarget();
    this.state.phase = BINGO_PHASES.PLAYING;
    this.state.lastWin = null;
    this.changed();
    return true;
  }

  finish() {
    this.state.phase = BINGO_PHASES.FINISHED;
    this.state.finishedAt = this.now();
    this.changed();
    return true;
  }

  /**
   * A fresh round: new cards for everyone, nothing called. Teams stay in, so
   * nobody has to scan the code again between rounds.
   */
  newRound() {
    this.state.round++;
    this.state.called = [];
    this.state.calledAt = {};
    this.state.claims = [];
    this.state.winners = { line: [], full: [] };
    this.state.prizeWinners = [];
    /*
     * `wonThisGame` IS NOT CLEARED HERE, AND THAT IS THE POINT OF IT.
     * One prize per phone per BINGO GAME, so the table that took round one's
     * line is out of the running for round two as well. Clearing it here
     * would quietly put the rule back to per-round — which is the thing that
     * was reported. `resetAll()` builds a fresh state and so starts empty,
     * which is correct: that is a new game.
     */
    this.state.lastWin = null;
    this.state.stageIndex = 0;
    this.syncTarget();
    this.state.phase = BINGO_PHASES.PLAYING;
    for (const p of this.playerList()) {
      p.card = this.uniqueCardFor(p.id);
      p.marks = new Array(this.squareCount).fill(false);
      p.cardRound = this.state.round;
      p.falseCalls = 0;
    }
    this.changed();
    return true;
  }

  resetAll() {
    this.state = BingoGame.freshState(this.pack);
    this.changed();
    return true;
  }

  // ------------------------------------------------------------------ views

  /**
   * How many more squares this player needs for the prize being played for.
   *
   * For one line that is the nearest line, as it always was. For several it is
   * the SMALLEST set of squares that finishes that many — worked out over
   * every combination of lines rather than by finishing the nearest ones one
   * at a time, because lines share squares: two lines that cross can be four
   * away together and three each. A card has at most a dozen lines, so trying
   * the combinations outright is both exact and instant, and this number is on
   * every phone in the room.
   */
  squaresAway(player) {
    const stage = this.stage;
    if (stage === TARGETS.FULL) {
      return player.card.filter((_, i) => !this.isGood(player, i)).length;
    }
    const missing = this.lines().map((line) => line.filter((i) => !this.isGood(player, i)));
    const wanted = Math.min(stage, missing.length);

    let best = Infinity;
    const pick = (from, left, union) => {
      if (union.size >= best) return;              // already worse than one we have
      if (left === 0) { best = union.size; return; }
      if (missing.length - from < left) return;    // not enough lines left to make it up
      for (let i = from; i < missing.length; i++) {
        pick(i + 1, left - 1, new Set([...union, ...missing[i]]));
      }
    };
    pick(0, wanted, new Set());
    return best === Infinity ? this.squareCount : best;
  }

  /** The tension metric: how many teams need one more track. */
  onesAway() {
    return this.playerList().filter((p) => this.squaresAway(p) === 1).length;
  }

  baseView() {
    return {
      kind: 'bingo',
      version: this.state.version,
      phase: this.state.phase,
      serverNow: this.now(),
      title: this.pack.title,
      target: this.state.target,
      // The prize being played for, in words, so no screen has to work it out
      // for itself and they cannot end up saying different things.
      stage: {
        index: this.state.stageIndex || 0,
        total: this.stages.length,
        needs: this.stage,
        label: stageLabel(this.stage),
        last: this.onLastStage,
      },
      prizes: this.stages.map((st, i) => ({
        needs: st,
        label: stageLabel(st),
        winner: (this.state.prizeWinners || []).find((w) => w.stageIndex === i)?.name || null,
      })),
      round: this.state.round,
      // Both spellings: cardSize for anything that only knows squares, and the
      // shape for the phone, which lays the grid out from it.
      cardSize: this.shape.cols,
      cardRows: this.shape.rows,
      cardCols: this.shape.cols,
      trackCount: this.tracks.length,
      calledCount: this.state.called.length,
      playerCount: this.playerList().length,
    };
  }

  /**
   * The projector.
   *
   * Deliberately does NOT include the full track list — only what has already
   * been played. The uncalled tracks are the whole game, and half the room
   * would be reading them off the screen instead of listening.
   */
  screenView() {
    const view = this.baseView();
    const called = this.state.called.map((id) => this.track(id)).filter(Boolean);
    view.called = called.map((t) => ({ id: t.id, title: t.title, artist: t.artist }));
    view.lastCalled = called.length ? called[called.length - 1] : null;
    view.onesAway = this.onesAway();

    if (this.state.phase === BINGO_PHASES.LOBBY) {
      view.lobby = {
        /*
         * THE DERIVED HANDLE, NEVER THE ID — and this is the same leak
         * `engine.js` closed, on the engine nobody went back to.
         *
         * This payload is public to anybody holding the join code, which is on
         * the projector and read out on the mic. An id was enough to read that
         * player back through `/api/state?role=player&playerId=…`, which takes
         * no token because reads never did — so a bored table got every card in
         * the room, every mark on it, and the winner's redeemable voucher CODE
         * before the winner reached the bar. The token is not in the payload, so
         * rule 3 held for ACTIONS; this was read access, and on bingo the cards
         * ARE the game.
         */
        players: this.playerList().sort((a, b) => b.joinedAt - a.joinedAt)
          .map((p) => ({ key: faceKey(p.id), name: p.name })),
      };
      /*
       * WHO IS WINNING AT RALLY — at the lobby only.
       *
       * Safe on the projector where an answer key never is, and the reason is
       * the two-screens rule read properly rather than waved at: this is not
       * secret, it is the point. NEVER at any other phase — a leaderboard for
       * a phone game on screen while a track is playing is two things on one
       * projector, and it would be telling a room to look down at the exact
       * moment they are meant to be listening.
       */
      const board = this.arcadeBoard();
      if (board.length) view.arcade = board;
      // Which game those scores are at — see the same block in `engine.js`.
      // One field, alongside the board, so the two projectors say the same
      // thing about the same night.
      if (board.length && this.state.lobbyGame) view.lobbyGame = this.state.lobbyGame;
    }

    if (this.state.lastWin) {
      view.win = {
        name: this.state.lastWin.name,
        pattern: this.state.lastWin.pattern,
        at: this.state.lastWin.at,
      };
    }

    // The most recent false alarm, because the room loves it.
    const lastClaim = this.state.claims[this.state.claims.length - 1];
    if (lastClaim && !lastClaim.valid) {
      view.falseAlarm = { name: lastClaim.name, at: lastClaim.at };
    }

    view.winners = {
      line: this.state.winners.line.map((id) => this.state.players[id]?.name).filter(Boolean),
      full: this.state.winners.full.map((id) => this.state.players[id]?.name).filter(Boolean),
    };

    /*
     * WHEN THE NEXT ONE IS, once the game is OVER and not before.
     *
     * Mid-game the projector is a call sheet somebody is scanning against a
     * card in their hand, and "back here Thursday" over the top of it is the
     * two-things-on-one-screen fault this app refuses everywhere else. At the
     * end it is the only thing on there.
     */
    if (this.state.phase === BINGO_PHASES.FINISHED && this.state.comeBack) {
      view.comeBack = comeBackView(this.state.comeBack);
    }

    return view;
  }

  /** One phone: its own card, its own marks, and nobody else's. */
  playerView(playerId) {
    const view = this.baseView();
    const p = this.state.players[playerId];
    if (!p) {
      // Only a team the host actually removed gets thrown out. Anything else
      // — a restart, a relaunch over a full lobby — is a silent rejoin, which
      // for bingo also means the same card comes back rather than a new one.
      if (wasRemoved(this.state, playerId)) view.kicked = true;
      else view.rejoin = true;
      return view;
    }

    view.you = {
      id: p.id,
      name: p.name,
      squaresAway: this.squaresAway(p),
    };
    view.card = p.card.map((trackId, i) => {
      const t = this.track(trackId);
      return {
        index: i,
        title: t ? t.title : '—',
        artist: t ? t.artist : '',
        marked: Boolean(p.marks[i]),
        // Told only after you played it, so the phone confirms a good mark
        // rather than giving anything away in advance.
        called: this.state.called.includes(trackId),
      };
    });
    // Can they legitimately press BINGO? They may still be wrong — this only
    // stops the button being mashed when no line is even marked.
    view.canClaim = this.hasMarkedPattern(p);
    /*
     * STOOD DOWN — they hold a prize and somebody else has not had one yet.
     *
     * The button is drawn PRESENT AND INERT with the reason on it rather than
     * being taken away: a control that vanishes is one you cannot learn the
     * position of, and this one vanishing at the exact moment somebody has
     * just won reads as the app breaking. It is also what stops the room
     * hearing a shout the screen then ignores.
     */
    /*
     * THE BUTTON STANDS DOWN FOR EVERYBODY ONCE THE PRIZE HAS GONE, not only
     * for the people who hold one. A live BINGO button on a prize already
     * taken is a promise the app cannot keep, and pressing it used to change
     * the name on the projector.
     */
    view.standDown = this.stageTaken() || this.holdsAPrize(playerId);
    /*
     * AND WHY, so the phone can draw something other than a dead button.
     * `standDown` is true for two different reasons — this prize has gone, or
     * you already hold one — and only the second one lasts the round. The
     * phone shows a card instead of the button for it; the first stays the
     * present-and-inert button it has always been, because that one lifts the
     * moment the host plays on.
     */
    if (this.holdsAPrize(playerId)) view.tookOne = true;
    /*
     * "You got it" means the prize ON THE TABLE, not one won earlier.
     *
     * With three prizes a player wins a line and then keeps playing for two
     * lines and a full house. Their phone used to say "You got it. Well done."
     * for the rest of the round, so the one person in the room who had proved
     * they were paying attention was the only one who could no longer see how
     * close they were.
     */
    /*
     * A WORD FROM THE HOST, to this phone and no other. Never in
     * `screenView()` — see `src/notes.js`, and rule 1.
     */
    const note = noteForPlayer(this.state, playerId);
    if (note) view.note = note;
    view.won = this.state.phase === BINGO_PHASES.WON
      && Boolean(this.state.lastWin) && this.state.lastWin.playerId === playerId;
    // What they have already taken, so the phone can keep score of their night.
    view.yourPrizes = (this.state.prizeWinners || [])
      .filter((w) => w.playerId === playerId)
      .map((w) => stageLabel(w.stage));
    /*
     * THE VOUCHERS THEMSELVES — every one this player holds, not just the
     * latest. A team that wins the line and then the full house is holding
     * two live prizes at once, both worth showing the bar, so this is an
     * ARRAY rather than the quiz's single `voucher` — the quiz only ever
     * issues one, at the very end; bingo hands them out as the night goes.
     */
    /*
     * BUILT FIELD BY FIELD, like the quiz's own — this was the ONE voucher in
     * the app that went out as a raw spread.
     *
     * It leaks nothing today, and that is exactly the problem: **a whitelist
     * is supposed to BE the decision**, so the next field added to a stored
     * voucher rides out to a phone without anybody choosing that it should.
     * The same argument as `hostView()` naming its clock fields rather than
     * spreading `s.question`, and the same list the quiz sends — with the
     * venue's logo, which the quiz's card already carries.
     */
    /*
     * THE CODES ALL APPEAR AT THE END OF THE ROUND, TOGETHER.
     *
     * Asked for after a live night, in these words: *"the QR codes should all
     * appear at the end."* A trickle of people getting up as each prize lands
     * is the thing the break is meant to replace, so a code won at the line
     * now waits until the last prize of that round has gone and the whole
     * room is sent to the bar in one go.
     *
     * **HELD, NEVER LOST — three ways out, and the round ending normally is
     * only one of them:**
     *
     *  - the round is OVER (`allPrizesGone`), which is the ordinary path;
     *  - the game is FINISHED, so a host who presses *Finish* on a round that
     *    can never pay out its last prize does not take a real drink off
     *    somebody;
     *  - it was won in an EARLIER round, or CARRIED in from another part of
     *    the night, so `newRound()` and *Continue to the quiz* both release
     *    what they inherit rather than swallowing it.
     *
     * A voucher with no `round` on it predates the stamp and is treated as an
     * earlier one — it shows. **Every unsure case shows**, because a held
     * code is a prize somebody standing at a bar cannot prove.
     *
     * The HOST's own panel is untouched and still lists every voucher the
     * moment it exists: they are the person a phone with nothing on it asks.
     */
    const roundOver = this.allPrizesGone || this.state.phase === BINGO_PHASES.FINISHED;
    const showsYet = (v) => roundOver || v.carried || v.round !== this.state.round;
    const mine = Object.values(this.state.vouchers || {})
      .filter((v) => v.winnerId === playerId)
      .filter(showsYet)
      .map((v) => ({
        code: v.code,
        name: v.name,
        place: v.place,
        stage: v.stage,
        reward: v.reward,
        venue: v.venue,
        // The words are still the prize; this is decoration on it, and a logo
        // that never arrives costs nothing at the bar.
        ...(this.state.venueLogo ? { logo: this.state.venueLogo } : {}),
        issuedAt: v.issuedAt,
        redeemedAt: v.redeemedAt,
      }));
    if (mine.length) view.vouchers = mine;
    /*
     * AND WHETHER THAT IS THE LOT — so the phone can turn the codes people are
     * already holding into one shared moment.
     *
     * **The codes are HELD until this is true** — see `showsYet` above. The
     * first build sent them the instant they were won and put this banner on
     * top, on an answer of *"both"* given before anybody had seen it; one
     * live night later the ask was *"the QR codes should all appear at the
     * end"*, so the banner and the codes now arrive together. *"You got it"*
     * still means the prize on the table — the phone says so the moment they
     * win (`view.tookOne`), it is only the CODE that waits.
     *
     * SPREAD IN ONLY WHEN TRUE, like the draw and the comeback band, so a
     * phone's payload during play is byte-for-byte what it was.
     */
    if (this.allPrizesGone) view.prizesAllGone = true;
    if (this.state.lastWin) view.win = { name: this.state.lastWin.name, pattern: this.state.lastWin.pattern, label: this.state.lastWin.label };
    /*
     * THE LOBBY GAME — only in the lobby, and only ever these two numbers.
     * Same fields, same rule and the same one function as the quiz's, so a
     * phone cannot be handed a seed at a moment the other game would not.
     */
    const gap = breakNow(this.state);
    if (gap) {
      view.gap = { photos: offersPhotos(gap), game: offersGame(gap) };
      if (offersGame(gap)) Object.assign(view, arcadeFields(this.state));
    }
    return view;
  }

  /**
   * Enough marked lines for THE PRIZE BEING PLAYED FOR, regardless of whether
   * those tracks were really played.
   *
   * This is `evaluate()`'s shape on MARKS rather than on `isGood()` — which is
   * the whole point of the two existing: the button lights up on what the
   * player has marked, and the claim is then checked against what was actually
   * called.
   *
   * **IT USED TO ASK FOR ONE LINE WHATEVER THE STAGE WAS.** On the 5x5 /
   * five-prize settings every 40-track pack ships with, that meant every phone
   * in the room lit up "BINGO!" the moment ONE line landed while the prize
   * needed two, three, four or the house — measured at **223.9 false calls a
   * round with sixty players**. Each press is recorded as a false alarm, which
   * puts an "honourable mention" on the win card and poisons `falseCalls`, the
   * only number the host has for telling a chancer from somebody who miscounted.
   * Only the 4x4 two-stage default escaped it.
   */
  hasMarkedPattern(player) {
    const stage = this.stage;
    if (stage === TARGETS.FULL) return player.marks.every(Boolean);
    const wanted = Math.max(1, Number(stage) || 1);
    const done = this.lines().filter((line) => line.every((i) => player.marks[i]));
    return done.length >= wanted;
  }

  /** Where the game has got to, in one line — see Engine.where(). */
  where() {
    const called = this.state.called.length;
    const total = this.tracks.length;
    switch (this.state.phase) {
      case BINGO_PHASES.LOBBY: return 'Waiting in the lobby';
      case BINGO_PHASES.PLAYING:
        return `Round ${this.state.round} — ${called} of ${total} played, going for ${stageLabel(this.stage)}${this.stages.length > 1 ? ` (prize ${(this.state.stageIndex || 0) + 1} of ${this.stages.length})` : ''}`;
      case BINGO_PHASES.WON:
        return `Round ${this.state.round} — ${stageLabel(this.stage)} claimed, ${called} of ${total} played`;
      case BINGO_PHASES.FINISHED: return 'Finished — the winners are up';
      default: return '';
    }
  }

  /** Your caller's view: the full track list and who is close. */
  hostView() {
    const view = this.baseView();
    // What the last slide will say, from the lobby on — the host says it into
    // a microphone, and the date is the half you cannot bluff. Same reasoning
    // as the quiz's, and the same field.
    if (this.state.comeBack) view.comeBack = comeBackView(this.state.comeBack);
    view.tracks = this.tracks.map((t) => ({
      id: t.id,
      title: t.title,
      artist: t.artist,
      called: this.state.called.includes(t.id),
      calledAt: this.state.calledAt[t.id] || null,
    }));
    view.called = this.state.called.map((id) => {
      const t = this.track(id);
      return t ? { id: t.id, title: t.title, artist: t.artist } : null;
    }).filter(Boolean);

    view.players = this.playerList()
      .map((p) => ({
        id: p.id,
        name: p.name,
        away: this.squaresAway(p),
        marked: p.marks.filter(Boolean).length,
        falseCalls: p.falseCalls,
        connected: p.connected,
        won: this.state.winners.line.includes(p.id) || this.state.winners.full.includes(p.id),
      }))
      .sort((a, b) => a.away - b.away || a.name.localeCompare(b.name));

    view.onesAway = view.players.filter((p) => p.away === 1).length;
    /*
     * THE ROUND CAN STALL, AND THE HOST IS THE ONE WHO CAN UNSTICK IT.
     *
     * One prize each holds while anybody is still without one — so if the only
     * people who have completed the card already hold a prize, nobody can
     * claim this stage and the round waits for a card that may never land. A
     * small room, or a round the night ran out of time for. The end-of-night
     * card then silently shows one prize where two were set up.
     *
     * **The rule itself is not touched**: lifting it automatically is the rig
     * running backwards, and the host already has *Play on*, *New round* and
     * *Finish*. What was missing is being TOLD — an app that has watched
     * somebody complete the card and says nothing is the one thing a host
     * cannot work out from the room.
     *
     * Host-only, and only when it is actually true.
     */
    const stuck = this.playerList().filter((p) => this.squaresAway(p) === 0);
    if (stuck.length && stuck.every((p) => this.holdsAPrize(p.id)) && !this.stageTaken()) {
      view.stalled = stuck.length;
    }
    /*
     * AND THE HARDER CASE, WHICH ONLY EXISTS NOW THE RULE IS ABSOLUTE: every
     * phone in the room already holds a prize, so this one can NEVER be
     * claimed however long the host keeps calling.
     *
     * It is a SEPARATE flag from `stalled` because the advice is different
     * and the wrong advice is worse than none. `stalled` means *the people
     * who could win have won* — playing on may still turn up a card. This
     * means *there is nobody left at all*, and "play on" is then a
     * quizmaster calling songs at a room that cannot answer. Five prizes
     * among three phones reaches it on prize four.
     *
     * **Still not automated.** Lifting the rule mid-round takes back
     * something the room was told; a new round is the honest move and it is
     * the host's to make.
     */
    const everyone = this.playerList();
    if (everyone.length && everyone.every((p) => this.holdsAPrize(p.id)) && !this.stageTaken()) {
      view.noneLeft = true;
    }
    // `standDown` rides with each row: a correct call that took no prize is a
    // third outcome and the control view has to say which — see `claimsPanel`.
    // What has been said to whom, and whether it landed. Host only.
    const notes = notesForHost(this.state);
    if (Object.keys(notes).length) view.notes = notes;
    view.claims = this.state.claims.slice(-6).reverse();
    if (this.state.lastWin) view.win = this.state.lastWin;
    // The prize panel — same shape as the quiz's, so host.js's existing
    // voucherPanel() draws it with no changes of its own. HOST-ONLY: a
    // voucher carries a real, scannable, one-use code, so this must never
    // reach screenView() — that would put a redeemable prize on a projector
    // sixty people are looking at.
    view.vouchers = Object.values(this.state.vouchers || {});
    /*
     * WHAT TONIGHT IS PLAYING FOR — the Prizes popover reads this to fill in
     * its fields, and its absence here was a live data-loss bug: an empty
     * payload looked like an empty night rather than a missing field, so the
     * popover showed one blank box, and Save overwrote every existing prize
     * with whatever got typed into it. `rewardList()` already existed and
     * was already correct (it feeds `results()` for the archived record) —
     * it was simply never put on the view a host's own control view reads.
     * Same field, same method, as `Engine.hostView()`'s own `view.rewards`.
     */
    view.rewards = this.rewardList();
    return view;
  }

  results() {
    return {
      kind: 'bingo',
      packId: this.pack.id,
      title: this.pack.title,
      // Where it happened, what was on offer, and who has taken it — same
      // three fields the quiz files, read by the same headcount and
      // rewards-taken code in library.js. A bingo night is a real night too.
      venue: this.state.venue || '',
      venueId: this.state.venueId || '',
      rewards: this.rewardList(),
      vouchers: Object.values(this.state.vouchers || {}),
      startedAt: this.state.startedAt,
      finishedAt: this.state.finishedAt,
      rounds: this.state.round,
      called: this.state.called.map((id) => {
        const t = this.track(id);
        return t ? `${t.title} — ${t.artist}` : id;
      }),
      leaderboard: this.playerList()
        .map((p) => ({
          name: p.name,
          // `faceKey`, never the id — see the same field in `engine.js`. A
          // filed night is read in public on the gallery, and an id is a
          // credential.
          faceKey: faceKey(p.id),
          away: this.squaresAway(p),
          falseCalls: p.falseCalls,
          won: this.state.winners.line.includes(p.id) || this.state.winners.full.includes(p.id),
        }))
        .sort((a, b) => Number(b.won) - Number(a.won) || a.away - b.away),
    };
  }
}

// ------------------------------------------------------------------ helpers

/** A small, fast, deterministic PRNG. Same seed, same card, every time. */
function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashString(s) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

/** Fisher-Yates, driven by the seeded generator so it is reproducible. */
export function shuffle(list, seed) {
  const out = [...list];
  const rand = mulberry32(seed);
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function cardSignature(card) {
  return (card || []).join('|');
}

/**
 * How many tracks a pack really needs.
 *
 * Sixteen tracks fills a 4x4 card, but it fills every card with the same
 * sixteen — only the arrangement differs, so the room finishes together and
 * nobody feels they won anything. Half again gives enough spare for cards to
 * genuinely differ.
 */
/**
 * What shape a pack's cards are, from whichever way it says so.
 *
 * `cardSize: 4` means 4x4 and is what every pack said before strips existed.
 * `cardRows` / `cardCols` say it outright. Reading both here means no pack on
 * disk had to be rewritten, and nothing else in the app has to know there are
 * two spellings.
 */
export function cardShape(pack = {}) {
  const rows = Number(pack.cardRows) || Number(pack.cardSize) || 4;
  const cols = Number(pack.cardCols) || Number(pack.cardSize) || 4;
  return { rows, cols };
}

/**
 * Every winning line on a card.
 *
 * On a SQUARE card that is rows, columns and both diagonals — the traditional
 * grid, unchanged.
 *
 * On a STRIP — 3 rows of 8, the shape of a paper bingo ticket — it is the long
 * rows only. Not the short columns, and this is the whole point rather than a
 * simplification: a card whose lines are different lengths is not a fair game,
 * because somebody would call on a column of three while everybody else needs
 * eight. Diagonals do not exist on a strip at all.
 *
 * So: whichever axis is longer is the line. An 8x3 gives the same game as a
 * 3x8, just turned round.
 */
export function cardLines({ rows, cols }) {
  const at = (r, c) => r * cols + c;
  const out = [];
  const row = (r) => Array.from({ length: cols }, (_, c) => at(r, c));
  const col = (c) => Array.from({ length: rows }, (_, r) => at(r, c));

  if (rows === cols) {
    for (let r = 0; r < rows; r++) out.push(row(r));
    for (let c = 0; c < cols; c++) out.push(col(c));
    out.push(Array.from({ length: rows }, (_, i) => at(i, i)));
    out.push(Array.from({ length: rows }, (_, i) => at(i, cols - 1 - i)));
    return out;
  }

  if (cols > rows) for (let r = 0; r < rows; r++) out.push(row(r));
  else for (let c = 0; c < cols; c++) out.push(col(c));
  return out;
}

/**
 * How many tracks a card of this shape really wants.
 *
 * Half again as many as there are squares, so two cards drawn from the pool do
 * not come out looking like each other.
 */
export function minimumTracks(shape = 4) {
  const { rows, cols } = typeof shape === 'number' ? { rows: shape, cols: shape } : shape;
  return Math.ceil(rows * cols * 1.5);
}

/**
 * One spelling of a card's shape, used everywhere it is said.
 *
 * A square is "4×4" and needs no explaining. A strip is spelled out — "3 across
 * × 8 down" — because "3×8" is read both ways round by different people, and
 * getting it backwards is the difference between a portrait card that fits a
 * phone and a landscape one that does not.
 */
export function shapeLabel(shape) {
  const { rows, cols } = typeof shape === 'number' ? { rows: shape, cols: shape } : shape;
  return rows === cols ? `${rows}×${cols}` : `${cols} across × ${rows} down`;
}

/**
 * A shape as the fields a pack carries.
 *
 * A square one still writes `cardSize` as well, so a pack saved today is still
 * read correctly by anything that only knows the old spelling — including a
 * copy of the app that has not been redeployed yet.
 */
export function shapeFields({ rows, cols }) {
  return { cardRows: rows, cardCols: cols, ...(rows === cols ? { cardSize: rows } : {}) };
}

/**
 * The shapes offered when you launch a round, in the order they are shown.
 *
 * The strips are TALLER than they are wide, because a phone is: 3 across and 8
 * down, not the other way about. A line is the long way — eight — which is
 * what makes them longer games than a 5×5 despite having one fewer square.
 */
export const CARD_SHAPES = [
  { rows: 3, cols: 3, prizes: 1 },
  { rows: 4, cols: 4, prizes: 2 },
  { rows: 5, cols: 5, prizes: 5 },
  { rows: 6, cols: 4, prizes: 4 },
  { rows: 8, cols: 3, prizes: 3 },
];

/**
 * How many prizes a shape starts on when nobody has chosen.
 *
 * **A NUMBER PER SHAPE, NOT A FORMULA — and it was a formula first, wrongly.**
 * The three the host named — *"a 3 x 8 grid DEFAULTS to 3 prizes, a 4 x 6 grid
 * DEFAULTS to 4 prizes and a 5 x 5 grid DEFAULTS to 5 prizes"* — are each
 * exactly `maxPrizes()`, so "the most that card can carry" looked like the one
 * rule behind all three. It is not: the two small squares came back as
 * *"3 x 3 should give one prize for a full house and 4 x 4 should give 2"*,
 * where the maximum is five. A 3x3 stopped four times before a full house is
 * a card that is over before the room has settled.
 *
 * So it lives BESIDE the shape rather than in the console, for the reason
 * `plans` and `minimum` already do: a sixth shape then has to name its own
 * default in the same line that adds it, instead of silently inheriting an
 * answer nobody chose for it.
 *
 * **Clamped, so the table can never promise a prize the geometry cannot pay.**
 */
export function defaultPrizes(shape) {
  const found = CARD_SHAPES.find((s) => s.rows === shape.rows && s.cols === shape.cols);
  return Math.max(1, Math.min(maxPrizes(shape), Math.floor(found?.prizes || maxPrizes(shape))));
}

/** Same shape of checks as the quiz packs: catch it now, not on the night. */
export function validateBingoPack(pack) {
  const problems = [];
  if (!pack || typeof pack !== 'object') return ['That is not a bingo pack.'];
  if (!pack.title) problems.push('The pack needs a title.');

  const shape = cardShape(pack);
  const label = shapeLabel(shape);
  // Loose enough for a strip you typed in by hand, tight enough to catch a
  // card nobody could play: the limit is what fits on a phone and what a
  // sensible track list can fill.
  const sane = (n) => Number.isInteger(n) && n >= 2 && n <= 10;
  if (!sane(shape.rows) || !sane(shape.cols)) {
    problems.push(`Card shape must be between 2 and 10 each way (it is ${label}).`);
  } else if (shape.rows * shape.cols > MAX_SQUARES) {
    problems.push(`A ${label} card is ${shape.rows * shape.cols} squares — too many to read on a phone (${MAX_SQUARES} is the most).`);
  }

  const tracks = pack.tracks || [];
  const squares = shape.rows * shape.cols;
  if (tracks.length < squares) {
    problems.push(`Only ${tracks.length} tracks for a ${label} card — you need at least ${squares}.`);
  } else if (tracks.length < minimumTracks(shape)) {
    problems.push(`Only ${tracks.length} tracks for a ${label} card. Add more (${minimumTracks(shape)}+) or cards will look too alike.`);
  }

  const seen = new Set();
  tracks.forEach((t, i) => {
    if (!t.title || !String(t.title).trim()) problems.push(`Track ${i + 1} has no title.`);
    const key = `${String(t.title).toLowerCase()}|${String(t.artist || '').toLowerCase()}`;
    if (seen.has(key)) problems.push(`"${t.title}" appears twice.`);
    seen.add(key);
  });

  return problems;
}

export function normaliseBingoPack(pack, fallbackId = 'bingo') {
  return {
    id: pack.id || fallbackId,
    kind: 'bingo',
    title: pack.title || 'Music Bingo',
    subtitle: pack.subtitle || '',
    ...(pack.look ? { look: pack.look } : {}),
    ...shapeFields(cardShape(pack)),
    notes: pack.notes || '',
    createdAt: pack.createdAt || null,
    tracks: (pack.tracks || []).map((t, i) => ({
      id: t.id || `t${i + 1}`,
      title: String(t.title || '').trim(),
      artist: String(t.artist || '').trim(),
      ...(t.year ? { year: t.year } : {}),
    })),
  };
}
