/**
 * The session: whichever game is running right now.
 *
 * The app can run more than one kind of game — a music quiz or music bingo,
 * with room for more — so this holds the active one and gives the server a
 * single, identical shape to talk to whichever it is:
 *
 *   session.screenView() / playerView() / hostView()
 *   session.run(action, body)
 *
 * Adding another game means writing an engine with those methods and adding
 * it to LAUNCHERS. The server, the live connections and the screens do not
 * need to know what games exist.
 */

import { Engine, PHASES, isSafeId } from './engine.js';
import { BingoGame, BINGO_PHASES, normaliseBingoPack, validateBingoPack, shapeFields, stagePlan, maxPrizes } from './bingo.js';
import { listQuizzes, loadQuiz } from './quizzes.js';
import { listBingoPacks, loadBingoPack, recordLaunch, archiveResults } from './library.js';
import { findSlide } from './adverts.js';
// Shared with the browser, so the list of looks cannot drift between the server
// deciding one and the screens drawing it.
import { LOOKS, DEFAULT_LOOK } from '../public/assets/looks.js';

const LAUNCHERS = {
  quiz: {
    load: (config, id) => loadQuiz(config.quizDir, id),
    list: (config) => listQuizzes(config.quizDir),
    make: (pack, opts) => new Engine({ quiz: pack, ...opts }),
    /** What counts as "worth writing to disk this instant". */
    milestone: (s) => `${s.phase}:${s.roundIndex}:${s.questionIndex}:${Object.keys(s.players).length}`,
    isOver: (s) => s.phase === PHASES.FINAL,
    empty: { id: 'empty', title: 'No quiz loaded', rounds: [] },
  },
  bingo: {
    load: (config, id) => normaliseBingoPack(loadBingoPack(config.bingoDir, id), id),
    list: (config) => listBingoPacks(config.bingoDir),
    make: (pack, opts) => new BingoGame({ pack, ...opts }),
    // Marks count as a milestone, unlike quiz answers. A lost quiz answer is
    // recoverable — you press Redo and ask again. A player who loses the ten
    // squares they had ticked cannot get them back, because they would have
    // to remember every song of the last half hour. So every tap goes
    // straight to disk.
    milestone: (s) => {
      let marks = 0;
      for (const p of Object.values(s.players)) {
        for (const m of p.marks) if (m) marks++;
      }
      return `${s.phase}:${s.round}:${s.called.length}:${Object.keys(s.players).length}:${marks}`;
    },
    isOver: (s) => s.phase === BINGO_PHASES.FINISHED,
    empty: { id: 'empty', title: 'No bingo pack loaded', tracks: [], cardSize: 4 },
  },
};

export class Session {
  /**
   * @param {object} opts
   * @param {object} opts.config
   * @param {import('./store.js').Store} opts.store
   * @param {function(): void} opts.onPush   tell the live connections something changed
   * @param {function(): number} [opts.now]
   */
  constructor({ config, store, onPush, now = () => Date.now() }) {
    this.config = config;
    this.store = store;
    this.onPush = onPush;
    this.now = now;
    this.kind = 'quiz';
    this.engine = null;
    this.lastMilestone = '';
    this.autoTimer = null;
    this.archivedThisGame = false;
  }

  get launcher() {
    return LAUNCHERS[this.kind];
  }

  /** Restore whatever was running, or fall back to the first pack we can find. */
  boot() {
    const saved = this.store.load();
    const kind = saved && LAUNCHERS[saved.kind] ? saved.kind : 'quiz';
    const packId = saved ? saved.packId || saved.quizId : null;

    const pack = this.pickPack(kind, packId);
    // A saved state only makes sense against the pack it was recorded for.
    const packMatches = saved && (saved.packId || saved.quizId) === pack.id && (saved.kind || 'quiz') === kind;
    const state = packMatches ? saved : null;

    this.build(kind, pack, state);

    /*
     * Say out loud what happened, including the boring case.
     *
     * This used to log only when it restored something, so the expensive case
     * — starting with no memory of a game that was running — left no trace at
     * all. That is the case worth knowing about: on a host with no permanent
     * disk, a restart means everyone's scores are gone, and the first anyone
     * hears of it is confused players. Now the log says which of the three
     * things happened, and the control view can show it.
     */
    this.startedAt = this.now();
    this.restoredOnBoot = Boolean(state);
    this.strandedPhones = 0;

    if (state) {
      const players = Object.keys(state.players || {}).length;
      console.log(`[session] restored ${kind} "${pack.title}" in progress: ${players} teams, phase ${state.phase}`);
    } else if (saved) {
      console.warn(`[session] STARTED FRESH — the saved game was for a different pack (saved "${saved.packId || saved.quizId}", loaded "${pack.id}"). Scores and teams from it are gone.`);
    } else {
      console.warn(`[session] STARTED FRESH — no saved game on disk. If a game was running before this restart, its scores and teams are gone.`);
    }
    return this;
  }

  pickPack(kind, wantedId) {
    const launcher = LAUNCHERS[kind];
    const available = launcher.list(this.config).filter((p) => !p.broken);
    const id = wantedId || this.config.defaultQuizId || (available[0] && available[0].id);
    if (!id) {
      console.error(`[session] no ${kind} packs found`);
      return launcher.empty;
    }
    try {
      return launcher.load(this.config, id);
    } catch (err) {
      console.error(`[session] could not load ${kind} "${id}": ${err.message}`);
      return launcher.empty;
    }
  }

  /** Wire up an engine and start watching it. */
  build(kind, pack, state = null) {
    this.kind = kind;
    this.pack = pack;
    const launcher = LAUNCHERS[kind];
    this.lastMilestone = state ? launcher.milestone(state) : '';
    this.archivedThisGame = false;

    this.engine = launcher.make(pack, {
      state,
      now: this.now,
      onChange: () => this.handleChange(),
    });
    /*
     * How the engine reads an advertising slide.
     *
     * The engine holds only which slide is up, and asks for the words when it
     * builds a view. That way editing a venue's offer changes what is on the
     * projector immediately — you do not have to take the slide down and put
     * it back to pick up a corrected price.
     *
     * Handed in rather than imported so the engine keeps knowing nothing about
     * the filesystem, which is what makes it testable with an injected clock
     * and no disk at all.
     */
    this.engine.advertLookup = (ref) => {
      if (!ref || !ref.packId) return null;
      try {
        return findSlide(this.config.advertDir, ref.packId, ref.slideId);
      } catch {
        return null; // the set was deleted while it was on screen
      }
    };
    // Games do not all record their pack the same way; make sure the state
    // always says what it is, so a restart can pick the right one back up.
    this.engine.state.kind = kind;
    this.engine.state.packId = pack.id;

    this.armTimer();
    return this.engine;
  }

  handleChange() {
    const state = this.engine.state;
    state.kind = this.kind;
    state.packId = this.pack.id;

    this.store.save(state);
    const milestone = this.launcher.milestone(state);
    if (milestone !== this.lastMilestone) {
      this.lastMilestone = milestone;
      // Anything that moves the game forward goes to disk this instant, so a
      // crash never brings us back on the wrong question or the wrong track.
      this.store.flush();
    }

    // Keep a copy of the night the moment it finishes, before anything else
    // can clear it.
    if (this.launcher.isOver(state) && !this.archivedThisGame) {
      this.archivedThisGame = true;
      try {
        archiveResults(this.config.dataDir, this.engine.results(), this.now());
      } catch (err) {
        console.error('[session] could not archive results:', err.message);
      }
    }

    this.onPush();
    this.armTimer();
  }

  /**
   * Start a different game. Everything about the old one is thrown away, so
   * this is only ever reached from the console behind the host key.
   */
  /**
   * @param {object} [opts]
   * @param {{rows:number, cols:number}} [opts.shape]  bingo card shape for tonight
   * @param {number} [opts.prizes]                     how many prizes to give out
   *
   * The card shape belongs to the NIGHT, not to the pack. The same forty-two
   * songs are a quick game on a 3x3 and a long one on a 3x8, and which you
   * want depends on how much of the evening you have — something you know when
   * you press Launch and not when you filed the songs weeks earlier. The pack's
   * own shape is the default; this overrides it for this game only and is never
   * written back to the file.
   */
  launch(kind, packId, { shape = null, prizes = 0, look = '' } = {}) {
    if (!LAUNCHERS[kind]) throw new Error(`Unknown game: ${kind}`);
    const pack = LAUNCHERS[kind].load(this.config, packId);
    const normalised = kind === 'bingo' ? normaliseBingoPack(pack, packId) : pack;
    if (kind === 'bingo' && shape) {
      const problems = validateBingoPack({ ...normalised, ...shapeFields(shape) });
      if (problems.length) throw new Error(problems[0]);
      Object.assign(normalised, shapeFields(shape));
    }
    this.build(kind, normalised, null);
    // How many prizes tonight, decided alongside the card shape and for the
    // same reason: it is a decision about this evening, not about the pack.
    if (kind === 'bingo' && prizes) {
      const wanted = Math.max(1, Math.min(maxPrizes(this.engine.shape), Math.floor(prizes)));
      this.engine.state.stages = stagePlan(wanted);
      this.engine.state.stageIndex = 0;
      this.engine.syncTarget();
    }
    /*
     * How it looks tonight.
     *
     * Written into the GAME STATE, not left on the in-memory pack — the same
     * lesson the card shape taught the hard way. A SIGKILL mid-round would
     * otherwise bring the game back wearing whatever the file said, and a room
     * that was black and orange five minutes ago would suddenly be pink.
     *
     * The pack carries a default (a Halloween quiz should look like one without
     * being asked) and the launch can override it, because "it is the fourteenth
     * of February" is a fact about tonight rather than about the pack.
     */
    this.engine.state.look = LOOKS.some((l) => l.id === look)
      ? look
      : (LOOKS.some((l) => l.id === normalised.look) ? normalised.look : DEFAULT_LOOK);

    recordLaunch(this.config.dataDir, kind, normalised.id, this.now());
    this.engine.changed();
    return { kind, id: normalised.id, title: normalised.title };
  }

  // -------------------------------------------------------------- the clock

  /**
   * The quiz needs a timer to close a question when the twenty seconds are up.
   * Bingo has no clock at all, so this is a no-op there.
   */
  armTimer() {
    if (this.autoTimer) {
      clearTimeout(this.autoTimer);
      this.autoTimer = null;
    }
    if (this.kind !== 'quiz') return;
    if (this.engine.state.phase !== PHASES.QUESTION) return;
    const left = this.engine.msRemaining();
    if (left === null) return;
    this.autoTimer = setTimeout(() => {
      this.autoTimer = null;
      if (this.engine.state.phase === PHASES.QUESTION && this.engine.isExpired()) this.engine.reveal();
    }, Math.max(0, left) + 50); // a beat of slack so a last-instant answer lands
    if (this.autoTimer.unref) this.autoTimer.unref();
  }

  // ------------------------------------------------------------------ views

  /**
   * How it looks, on every payload.
   *
   * All three, always — the option colours have to change on the projector and
   * on the phones at the same moment or "the pink one, bottom left" stops
   * meaning anything.
   */
  get look() {
    const chosen = this.engine.state && this.engine.state.look;
    return LOOKS.some((l) => l.id === chosen) ? chosen : DEFAULT_LOOK;
  }

  screenView() {
    return { ...this.engine.screenView(), game: this.kind, look: this.look };
  }

  playerView(playerId) {
    return { ...this.engine.playerView(playerId), game: this.kind, look: this.look };
  }

  hostView() {
    return {
      ...this.engine.hostView(),
      game: this.kind,
      look: this.look,
      packId: this.pack.id,
      // So the control view can tell you the app restarted, rather than
      // leaving you to work it out from everyone's score being zero.
      server: {
        startedAt: this.startedAt,
        restored: this.restoredOnBoot,
        strandedPhones: this.strandedPhones,
      },
    };
  }

  results() {
    return this.engine.results();
  }

  // ---------------------------------------------------------------- actions

  /**
   * Every button on the control view lands here. Actions that both games
   * understand are shared; the rest are per game, and an action a game does
   * not have simply is not there.
   */
  run(action, body = {}) {
    const shared = {
      join: () => this.engine.join({ playerId: body.playerId, name: body.name }),
      removePlayer: () => this.engine.removePlayer(String(body.playerId)),
      renamePlayer: () => this.engine.renamePlayer(String(body.playerId), String(body.name)),
      resetAll: () => this.engine.resetAll(),
    };

    const perGame = this.kind === 'quiz' ? {
      start: () => this.engine.start(),
      next: () => this.engine.next(),
      back: () => this.engine.back(),
      reveal: () => this.engine.reveal(),
      // The scores on the big screen, without moving the quiz.
      scoreboard: () => this.engine.showScoreboard(body.on !== false),
      // An advertising slide, the same way.
      advert: () => this.engine.showAdvert(
        body.packId ? { packId: body.packId, slideId: body.slideId } : null,
      ),
      skip: () => this.engine.skipQuestion(),
      redo: () => this.engine.redoQuestion(),
      goto: () => this.engine.goTo(Number(body.roundIndex), Number(body.questionIndex)),
      adjustScore: () => this.engine.adjustScore(String(body.playerId), Number(body.delta)),
      resetScores: () => this.engine.resetScores(),
      // Stop here and show the winner. Bingo has always had this; the quiz
      // did not, which left no way to end a night early except pressing
      // onwards through every remaining question.
      finish: () => this.engine.finish(),
    } : {
      start: () => this.engine.start(),
      call: () => this.engine.call(String(body.trackId)),
      uncall: () => this.engine.uncall(String(body.trackId)),
      undoCall: () => this.engine.undoLastCall(),
      playOn: () => this.engine.playOn(body.target),
      newRound: () => this.engine.newRound(),
      finish: () => this.engine.finish(),
    };

    const handler = { ...shared, ...perGame }[action];
    return handler ? handler() : undefined;
  }

  /**
   * A phone joining. Goes through here rather than straight to the engine so
   * one thing can notice a phone arriving with an id we have never issued.
   *
   * That is proof, not a guess: it means the phone was in a game this process
   * has no memory of. On a first-ever start nobody has a stored id, so this
   * stays at zero and the control view keeps quiet. It only counts against
   * this boot — a game the host launched deliberately is not a lost one.
   */
  joinPlayer({ playerId, name }) {
    const known = playerId && this.engine.state.players[playerId];
    const stranded = Boolean(playerId && isSafeId(playerId) && !known && !this.restoredOnBoot);
    const player = this.engine.join({ playerId, name });
    if (stranded) {
      this.strandedPhones++;
      if (this.strandedPhones === 1) {
        console.warn('[session] a phone rejoined from a game this process never saw — the restart lost a game in progress');
      }
    }
    return player;
  }

  /** Actions a player's phone is allowed to trigger. */
  runPlayerAction(action, body = {}) {
    if (this.kind === 'bingo') {
      if (action === 'mark') return this.engine.mark({ playerId: body.playerId, index: body.index, marked: body.marked });
      if (action === 'claim') return this.engine.claim(String(body.playerId));
    }
    if (this.kind === 'quiz' && action === 'answer') {
      // optionIndexes is the pick-them-all round; optionIndex every other one.
      // Both are forwarded, and the engine decides which the round wants.
      return this.engine.answer({
        playerId: body.playerId,
        optionIndex: body.optionIndex,
        optionIndexes: body.optionIndexes,
      });
    }
    return { ok: false, reason: 'not_available' };
  }
}
