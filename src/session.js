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

import path from 'node:path';

import { Engine, PHASES, isSafeId, ownsPlayer, newToken } from './engine.js';
import { JoinGate } from './joins.js';
import { BingoGame, BINGO_PHASES, normaliseBingoPack, validateBingoPack, shapeFields, stagePlan, maxPrizes } from './bingo.js';
// ONE cap on how many prizes a night can carry, shared with the venue record
// that authors them — two copies of a number like this drift, and the one that
// drifts is the one nobody is looking at.
import { MAX_REWARDS } from './invoices.js';
import { listQuizzes } from './quizzes.js';
import { listBingoPacks, recordLaunch, archiveResults, updateArchivedNight, HOUSE_ROOM } from './library.js';
import { findSlide } from './adverts.js';
import { readPack, listOwn } from './own-packs.js';
import { cleanComeBack } from './comeback.js';
import { composeQuiz } from './running-order.js';
// Shared with the browser, so the list of looks cannot drift between the server
// deciding one and the screens drawing it.
import { LOOKS, DEFAULT_LOOK } from '../public/assets/looks.js';

/*
 * `load` and `list` take the ROOM'S PATHS as well as the config, because a
 * quizmaster's own packs are not in the catalogue folder — see own-packs.js.
 * `readPack` looks in their own library first and the catalogue second, so a
 * bare pack id still means one thing and every caller carries on passing one.
 */
const LAUNCHERS = {
  quiz: {
    load: (config, id, paths) => readPack('quiz', id, { config, paths }).pack,
    list: (config, paths) => [...listQuizzes(config.quizDir), ...listOwn(paths).quizzes],
    make: (pack, opts) => new Engine({ quiz: pack, ...opts }),
    /** What counts as "worth writing to disk this instant". */
    milestone: (s) => `${s.phase}:${s.roundIndex}:${s.questionIndex}:${Object.keys(s.players).length}`,
    isOver: (s) => s.phase === PHASES.FINAL,
    empty: { id: 'empty', title: 'No quiz loaded', rounds: [] },
  },
  bingo: {
    load: (config, id, paths) => readPack('bingo', id, { config, paths }).pack,
    list: (config, paths) => [...listBingoPacks(config.bingoDir), ...listOwn(paths).bingo],
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
  constructor({ config, store, onPush, onArchive = () => {}, now = () => Date.now(), roomId = HOUSE_ROOM, paths = {} }) {
    this.config = config;
    this.store = store;
    this.onPush = onPush;
    /*
     * Told when a night has been filed, so somebody else can back it up.
     *
     * A callback rather than the backup itself, exactly like `onSpend` on the
     * generators: this file has no business knowing that GitHub exists, and
     * every test and script that builds a Session carries on working because
     * the default does nothing.
     */
    this.onArchive = onArchive;
    this.now = now;
    this.roomId = roomId;
    /*
     * Who is knocking. In memory rather than in the state file on purpose: a
     * restart is exactly when a room legitimately floods back in, so a counter
     * that survived one would hold the whole night at the door.
     */
    this.joins = new JoinGate(now);
    /*
     * Where THIS quizmaster's nights and venue slides live.
     *
     * Both used to come off `config`, which meant one archive and one advert
     * folder for the whole server. A second quizmaster tidying up what looked
     * like their own venue list would have deleted somebody else's set off a
     * projector. Defaults keep the old locations, so nothing moves for the
     * house room or for a Session built without a room in a test.
     */
    this.archiveDir = paths.archive || path.join(config.dataDir, 'archive');
    this.advertDir = paths.adverts || config.advertDir;
    // And where this quizmaster's OWN packs live, so a launch can play one.
    // Kept whole rather than picked apart, because own-packs.js is what knows
    // which field is which and this file should not learn.
    this.paths = paths;
    this.kind = 'quiz';
    this.engine = null;
    this.lastMilestone = '';
    this.autoTimer = null;
    // The vouchers as they were when the night was last written to the
    // archive, so a prize redeemed at the bar afterwards updates the filed
    // record and nothing else does. WHICH night was filed lives in the state
    // (`archivedAs`), so a restart cannot file the same evening twice.
    this.filedVouchers = null;
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
    /*
     * Has the host launched on purpose since this process came up?
     *
     * Set in `launch()` and NEVER here, because `build()` runs on boot as well
     * — the session always has a pack loaded so the projector is never blank,
     * and a loaded pack is not a night. Same distinction `aNightIsOn()` draws
     * on the console.
     */
    this.launchedSinceBoot = false;

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
    const available = launcher.list(this.config, this.paths).filter((p) => !p.broken);
    const id = wantedId || this.config.defaultQuizId || (available[0] && available[0].id);
    if (!id) {
      console.error(`[session] no ${kind} packs found`);
      return launcher.empty;
    }
    try {
      return launcher.load(this.config, id, this.paths);
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
    this.filedVouchers = null;

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
        return findSlide(this.advertDir, ref.packId, ref.slideId);
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
    if (this.launcher.isOver(state) && !state.archivedAs) {
      try {
        const record = archiveResults(this.archiveDir, this.engine.results(), this.now());
        /*
         * IN THE STATE, not on a flag on this object — and it fixes a second
         * fault as well as enabling the first.
         *
         * `archivedThisGame` was set here and cleared by `build()`, which runs
         * on BOOT with the restored state. So a restart while a game sat on
         * the final scores filed the whole night AGAIN on the next push, and
         * two copies of one evening turned up on the Past gigs page — on a
         * host whose disk is wiped every deploy, which is when a restart is
         * most likely. The state is the record of the night, so the fact that
         * it has been filed belongs in it.
         */
        state.archivedAs = record.id;
        this.filedVouchers = JSON.stringify(state.vouchers || {});
        // Never awaited. The night has ended and the room is looking at a
        // scoreboard; whether GitHub is having a good evening is not their
        // problem, and a backup that held up the final slide would be.
        try {
          this.onArchive(record);
        } catch (err) {
          console.error('[session] could not back up the archive:', err.message);
        }
      } catch (err) {
        console.error('[session] could not archive results:', err.message);
      }
    } else if (state.archivedAs) {
      /*
       * A VOUCHER MOVED AFTER THE NIGHT WAS FILED, which is the ordinary case
       * rather than an edge one: the night is archived at the final scores and
       * the bar scans the winner's QR several minutes later. Without this every
       * archived night said "not used" for every prize, for ever.
       *
       * Reached with no new hook because `redeemVoucher` and
       * `reinstateVoucher` both call `changed()`, which is what runs this.
       * Compared rather than written on every push, or a game left sitting on
       * the final scores would rewrite the file for nothing.
       */
      const now = JSON.stringify(state.vouchers || {});
      if (now !== this.filedVouchers) {
        this.filedVouchers = now;
        try {
          const record = updateArchivedNight(this.archiveDir, state.archivedAs, {
            vouchers: this.engine.results().vouchers,
          });
          // The permanent record is the whole point, so it goes back up too.
          if (record) {
            try {
              this.onArchive(record);
            } catch (err) {
              console.error('[session] could not back up the archive:', err.message);
            }
          }
        } catch (err) {
          console.error('[session] could not update the filed night:', err.message);
        }
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
  /**
   * What a launch is about to destroy, or null if there is nothing to lose.
   *
   * **`launch()` builds a fresh game unconditionally, and that used to be the
   * whole story.** Two people sharing one login — which is exactly what
   * happens when a company decides three subscriptions are too many — could
   * end each other's night mid-question: scores gone, every phone thrown back
   * into a lobby, in front of a paying room, with nothing anywhere saying why.
   * It is this codebase's first rule broken in the worst possible way.
   *
   * **ANY joined player counts, lobby or not.** The obvious version guards a
   * game that is past the lobby, but forty people who have typed a team name
   * and are waiting for the first question have something to lose too, and
   * "everybody type your name in again" is not a thing you say on a mic.
   *
   * Nobody joined means nothing to protect, which covers the ordinary case
   * this must not get in the way of: launching the wrong pack and launching
   * again ten seconds later.
   */
  inProgress() {
    if (!this.engine || !this.pack) return null;
    const players = this.engine.playerList().length;
    if (!players) return null;
    return {
      game: this.kind,
      packId: this.pack.id,
      title: this.pack.title,
      players,
      // Optional on an engine, like everywhere else it is asked for.
      at: typeof this.engine.where === 'function' ? this.engine.where() : '',
    };
  }

  launch(kind, packId, { shape = null, prizes = 0, look = '', online = false, teamPlay = false, venue = '', rewards = [], venueLogo = '', comeBack = null, askForRounds = false, roundIdeas = [], order = null } = {}) {
    if (!LAUNCHERS[kind]) throw new Error(`Unknown game: ${kind}`);
    /*
     * TONIGHT'S RUNNING ORDER, when one was built — rounds from more than one
     * pack, composed in memory and never written anywhere. See
     * `running-order.js` for why that is the whole of it.
     *
     * It goes through the SAME loader, so an own-pack still resolves
     * own-first and a catalogue pack still resolves to the one file everybody
     * reads. Quiz only: a bingo game is a track list with no rounds in it on
     * disk, so there is nothing to take one of.
     */
    const pack = (order && order.length && kind === 'quiz')
      ? composeQuiz(order, (id) => LAUNCHERS.quiz.load(this.config, id, this.paths))
      : LAUNCHERS[kind].load(this.config, packId, this.paths);
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
    /*
     * THE LOBBY GAME'S SEED, decided once, here, and written into the state.
     *
     * Every phone in the room reads it and plays the identical game, which is
     * the only thing that makes a scoreboard of it mean anything — the host's
     * own catch. In the state rather than generated per phone so a restart at
     * half nine does not hand the second half of the room a different game
     * from the first, exactly like the look, the card shape and the three
     * round ideas beside it.
     *
     * Off the injected clock, so a test gets a stated seed rather than a
     * surprise — the same reason `random` is injected for the prize draw.
     */
    this.engine.state.gameSeed = (this.now() % 1000000) + 1;
    this.engine.state.arcade = {};

    this.engine.state.look = LOOKS.some((l) => l.id === look)
      ? look
      : (LOOKS.some((l) => l.id === normalised.look) ? normalised.look : DEFAULT_LOOK);

    /*
     * Whether anybody is in the room tonight.
     *
     * In the state for exactly the reason the look and the card shape are: a
     * restart mid-round must not bring the night back as the other kind of
     * night, with the question suddenly missing off every phone. And it is a
     * decision about TONIGHT rather than about the pack — the same quiz runs
     * in a pub on Wednesday and over a video call on Thursday — so it is never
     * read off the pack and never written back to it.
     */
    this.engine.state.online = Boolean(online);
    /*
     * Several phones, one team. Off unless asked for at launch, and in the
     * state for the same reason everything else here is — a restart must not
     * bring the night back as individuals with every team gone.
     */
    this.engine.state.teamPlay = Boolean(teamPlay);
    /*
     * Where tonight is. Tidied exactly like a team name — control characters
     * out, a length cap, and NO word filtering, which is the rule everywhere
     * a human types something that ends up on a screen.
     */
    this.engine.state.venue = String(venue || '')
      .replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60);
    /*
     * What the winner gets, tidied exactly like the venue — and it goes on a
     * voucher rather than on the projector, so the no-word-filtering rule
     * applies for the same reason it does everywhere a human types something.
     * Longer than a venue because "£50 behind the bar, redeemable tonight" is
     * a real answer.
     */
    /*
     * First, second and third — tidied exactly like the venue, and capped at
     * three because that is what a pub quiz pays and a fourth box is a
     * question nobody has asked. Trailing blanks are dropped by `rewardList()`
     * rather than here, so what was typed survives a restart.
     */
    this.engine.state.rewards = (Array.isArray(rewards) ? rewards : [rewards])
      .slice(0, MAX_REWARDS)
      .map((r) => String(r || '')
        .replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80));

    /*
     * The venue's own logo, for the winner's voucher. Beside the prizes
     * because it is the same kind of thing — the venue's standing arrangement,
     * read off their record at launch and copied into the night so a restart
     * at half eleven brings it back.
     */
    this.engine.state.venueLogo = String(venueLogo || '');

    /*
     * WHEN THE NEXT ONE IS — the last slide of the night.
     *
     * Handed in already worked out (see `src/comeback.js`), so the session and
     * the engine keep knowing nothing about diaries or venue records. It lives
     * in the state like the look and the prizes: the room is looking at this
     * slide at half eleven, which is exactly when a free host gets restarted.
     *
     * Tidied like the venue — control characters out and a cap — because the
     * link half is typed by a human and ends up on a projector as a QR code.
     * A link that is not http(s) is DROPPED rather than shown: `javascript:`
     * in a QR is somebody else's phone, and a QR nobody can check by looking
     * at it is the one place to be strict.
     */
    this.engine.state.comeBack = cleanComeBack(comeBack);
    /*
     * Whether the room may ask for a round at the end. In the state like
     * everything else decided at launch, so a restart cannot turn it on for a
     * night that was not meant to have it.
     */
    this.engine.state.askForRounds = Boolean(askForRounds);
    // The three on offer, chosen once here — see round-ideas.js for why they
    // are the same all night and where they come from.
    this.engine.state.roundIdeas = (Array.isArray(roundIdeas) ? roundIdeas : [])
      .slice(0, 3)
      .map(({ id, label }) => ({ id: String(id || ''), label: String(label || '') }))
      .filter((i) => i.id && i.label);

    /*
     * A DELIBERATE LAUNCH ANSWERS THE RESTART NOTICE.
     *
     * "The app restarted — scores from before are gone, tap a name to put
     * their points back" is true and useful for the case it was written for: a
     * crash mid-round, phones putting themselves back, and everybody suddenly
     * on nothing. It is FALSE the moment the host launches on purpose — the
     * new night started at zero because that is what launching means, there is
     * nothing to put back, and the notice sits across the top of the control
     * view for twenty minutes telling a working game it has lost something.
     *
     * Seen on a gig day, on a night that was running perfectly. The banner's
     * own comment says it should only show "while it is still actionable" —
     * this is the half of that which was only ever a timer.
     *
     * Cleared rather than made conditional in `restartNotice()`, because the
     * count is what the sentence is BUILT from: "1 phone that was already
     * playing put itself back in" is a claim about a game that no longer
     * exists.
     *
     * AND THE FLAG IS THE HALF THAT ACTUALLY MATTERS. Clearing the count alone
     * fixed nothing and was watched failing on a live server: the phones come
     * back a few seconds AFTER the launch, not before, so the count was reset
     * to zero and then immediately counted back up to one by the very rejoin
     * the launch was supposed to account for. `launchedSinceBoot` is what
     * `joinPlayer()` reads, so a phone returning to a night that was started
     * on purpose is never stranded in the first place.
     */
    this.launchedSinceBoot = true;
    this.strandedPhones = 0;

    recordLaunch(this.config.dataDir, kind, normalised.id, this.now(), this.roomId);
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
      resetAll: () => { this.joins.reset(); return this.engine.resetAll(); },
      // "18 phones waiting to join — Let them in." One tap, and the number on
      // the button is what tells the host whether it is a room or mischief.
      letThemIn: () => { const done = this.joins.letThemIn(); this.engine.changed(); return done; },
      // Tidying a lobby: everybody who has joined and then done nothing at
      // all. Useful on any night — duplicates, somebody who joined twice, a
      // phone that wandered off — and it is also how a flood gets cleared up
      // if one ever gets past the door.
      removeIdle: () => this.engine.removeIdlePlayers(),
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
      /*
       * Tell the room roughly when it starts. Advisory only — nothing reads it
       * to begin a quiz, because a quiz that started on a timer would start
       * while the host was at the bar.
       */
      startsIn: () => this.engine.setStartsIn(body.minutes),
      goto: () => this.engine.goTo(Number(body.roundIndex), Number(body.questionIndex)),
      /*
       * Mark somebody as an organiser — the client's contact and their IT
       * person, on an online night.
       *
       * A host action rather than something a phone claims about itself, for
       * the obvious reason: "I am an organiser" as a request field would be a
       * way into the back channel and out of the scoreboard, chosen by
       * whoever fancied it. One tap on the host's own player list.
       */
      organiser: () => this.engine.setOrganiser(String(body.playerId), body.on !== false),
      // Putting somebody on a team from the host's own list — for the room
      // that turns up already knowing who is sitting with whom.
      setTeam: () => this.engine.joinTeam(String(body.playerId), body.teamId ? String(body.teamId) : null),
      makeTeam: () => this.engine.makeTeam(String(body.name || '')),
      adjustScore: () => this.engine.adjustScore(String(body.playerId), Number(body.delta)),
      resetScores: () => this.engine.resetScores(),
      // Stop here and show the winner. Bingo has always had this; the quiz
      // did not, which left no way to end a night early except pressing
      // onwards through every remaining question.
      finish: () => this.engine.finish(),
      // The bar's phone could not reach us, or it came over and said it was
      // not working. Both are one tap, and neither is a dead end.
      redeemVoucher: () => this.engine.redeemVoucher(body.code, { by: 'host' }),
      reinstateVoucher: () => this.engine.reinstateVoucher(body.code),
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
  joinPlayer({ playerId, token = '', name, tryId = '' }) {
    this.pendingWho = String(tryId || '').slice(0, 64);
    const known = playerId && this.engine.state.players[playerId];
    const stranded = Boolean(
      playerId && isSafeId(playerId) && !known
      && !this.restoredOnBoot
      // …and only until the host launches on purpose. After that a phone
      // carrying an id from before is just somebody rejoining a night that
      // was deliberately started fresh — which is what a launch MEANS — and
      // there are no scores to offer to put back.
      && !this.launchedSinceBoot,
    );

    /*
     * Hold the door if a lot of NEW phones are arriving at once.
     *
     * A phone that can prove it is already a player goes straight through —
     * that is `ownsPlayer`, and it is what stops a reconnection storm after a
     * restart being mistaken for a flood. See src/joins.js.
     */
    const proven = Boolean(known && ownsPlayer(known, token));
    const door = this.joins.ask({
      known: proven,
      // A phone that has joined before is keyed on its id; one that has not
      // sends a scratch id it keeps in localStorage, so retries are one person.
      who: String(playerId || '') || String(this.pendingWho || ''),
    });
    if (!door.ok) return { id: '', name: '', waiting: true, ahead: door.waiting };

    const player = this.engine.join({ playerId, token, name });
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
    /*
     * **Prove it is your phone before anything else.**
     *
     * These four routes are open — a phone has no login — and the id used to
     * be the whole proof. So anybody holding one could answer as that player:
     * the wrong answer lands first and their real one comes back "already
     * answered", which costs them the question. Found by joining a game as two
     * phones and playing one against the other.
     *
     * `ownsPlayer` trusts a player who has no token yet and binds them, so a
     * phone that joined before this existed is not thrown out of a night in
     * progress — the same rule as "only a real removal throws a phone out".
     */
    const player = this.engine.state.players?.[String(body.playerId || '')];
    if (!ownsPlayer(player, body.token)) return { ok: false, reason: 'not_yours' };
    if (player && !player.token) player.token = newToken();

    if (this.kind === 'bingo') {
      if (action === 'mark') return this.engine.mark({ playerId: body.playerId, index: body.index, marked: body.marked });
      if (action === 'claim') return this.engine.claim(String(body.playerId));
    }
    // "This phone went to the background while a question was up." A note for
    // the host and nothing else — see Engine.wandered().
    /*
     * A SCORE FROM THE LOBBY GAME. Behind the same token check as everything
     * else on this path — it goes on a projector with a name beside it, so a
     * phone that could post as somebody else could put another team's name
     * against a score they did not get.
     */
    if (this.kind === 'quiz' && action === 'arcade') {
      return this.engine.arcadeScore(String(body.playerId || ''), body.score);
    }
    if (this.kind === 'quiz' && action === 'wandered') {
      return this.engine.wandered(String(body.playerId || ''));
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
    /*
     * Chat. Behind the same token check as everything else on this path — and
     * that matters more here than for an answer, because an answer somebody
     * forges costs a question while a MESSAGE somebody forges is words on
     * another person's screen with your team's name on them.
     *
     * Quiz only for now: bingo's own engine has no chat and asking it would be
     * a method that does not exist. It is the same shape of addition when it
     * wants one.
     */
    /*
     * Picking a team is a PLAYER action, unlike being made an organiser.
     *
     * A team is who you are sitting with and the person who knows that is the
     * person holding the phone — asking the host to assign sixty people is the
     * opposite of "the common job is the fast one". The engine refuses it
     * mid-question so nobody can watch the tally and hop into whichever team
     * is doing well.
     */
    if (this.kind === 'quiz' && action === 'team') {
      if (body.name) {
        const made = this.engine.makeTeam(String(body.name));
        if (!made.ok) return made;
        return this.engine.joinTeam(String(body.playerId || ''), made.id);
      }
      return this.engine.joinTeam(String(body.playerId || ''), body.teamId ? String(body.teamId) : null);
    }
    if (this.kind === 'quiz' && action === 'say') {
      return this.engine.say(String(body.playerId || ''), String(body.room || ''), body.text);
    }
    return { ok: false, reason: 'not_available' };
  }
}
