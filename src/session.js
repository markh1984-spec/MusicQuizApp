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

import { Engine, PHASES, MAX_WINNERS, isSafeId, ownsPlayer, newToken } from './engine.js';
import { JoinGate } from './joins.js';
import { BingoGame, BINGO_PHASES, normaliseBingoPack, validateBingoPack, shapeFields, stagePlan, maxPrizes } from './bingo.js';
// ONE cap on how many prizes a night can carry, shared with the venue record
// that authors them — two copies of a number like this drift, and the one that
// drifts is the one nobody is looking at.
import { MAX_REWARDS } from './invoices.js';
import { listQuizzes } from './quizzes.js';
import { listBingoPacks, recordLaunch, archiveResults, updateArchivedNight, listArchive, HOUSE_ROOM } from './library.js';
import { mergeGigs } from './past-gigs.js';
import { leagueTable } from './league.js';
import { findSlide, listAdvertPacks, loadAdvertPack } from './adverts.js';
import { cleanPlan } from '../public/assets/break-parts.js';
import { readPack, listOwn } from './own-packs.js';
import { cleanComeBack } from './comeback.js';
import { composeQuiz } from './running-order.js';
// Shared with the browser, so the list of looks cannot drift between the server
// deciding one and the screens drawing it.
import { LOOKS, DEFAULT_LOOK } from '../public/assets/looks.js';
import { lobbyGameFor } from '../public/assets/lobby-games.js';

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

/**
 * How many PARTS one night's running order may hold — quiz → bingo → quiz is
 * two, and a night alternating four times is already an unusual evening. Not
 * a technical limit, the same as `MAX_ROUNDS` in `running-order.js`: a guard
 * against a stuck drag or a script, not a ceiling anybody is expected to hit.
 */
const MAX_ORDER_PARTS = 8;

/**
 * Turn whatever the console sent into a list this file trusts.
 *
 * The console is reloadable and editable behind the host key, so this is the
 * same defence in depth as every other launch field — a malformed entry is
 * dropped rather than trusted, and `launch()`'s own checks (a pack that no
 * longer exists, a round that is not there) still run per part exactly as
 * they do for an ordinary launch.
 */
function normaliseSegments(segments) {
  const list = Array.isArray(segments) ? segments : [];
  return list.map((s) => {
    if (s && s.kind === 'bingo') {
      const packId = String((s && s.packId) || '').trim();
      if (!packId) return null;
      const shape = s.shape && Number(s.shape.rows) && Number(s.shape.cols)
        ? { rows: Number(s.shape.rows), cols: Number(s.shape.cols) }
        : null;
      const prizes = Math.max(0, Math.min(5, Number(s.prizes) || 0));
      return { kind: 'bingo', packId, shape, prizes };
    }
    const order = Array.isArray(s && s.order) ? s.order : [];
    if (!order.length) return null;
    return { kind: 'quiz', order };
  }).filter(Boolean);
}

/**
 * What stays true for the WHOLE night, read off whichever part is currently
 * running rather than kept a second way — the venue, the prizes, the look,
 * every one of them was already written onto the state at the part's own
 * launch, so re-reading it here is the same trick `boot()` uses to restore a
 * running order after a restart: the state already has the answer.
 */
function nightWideOpts(state) {
  return {
    venue: state.venue,
    venueId: state.venueId,
    rewards: state.rewards,
    venueLogo: state.venueLogo,
    comeBack: state.comeBack,
    // Night-wide like the comeback line beside it: the pub and the date do not
    // change between a quiz and the bingo after it, so neither does the
    // address their photographs will live at.
    photoLink: state.photoLink,
    look: state.look,
    questionSeconds: state.questionSeconds,
    /*
     * NOT `lobbyGame` — deliberately left out. "THE DEFAULT FOLLOWS THE
     * GAME: Maze Mouth before a quiz, Rally before a bingo" is a rule with
     * no stated exception for a running order, and `state.lobbyGame` holds
     * whatever the PREVIOUS part's launch already RESOLVED it to — which
     * `lobbyGameFor()` cannot tell apart from an explicit choice, because it
     * only ever sees an id, never why it was chosen. Carrying it forward
     * turned "the host asked for nothing in particular" into "the host
     * asked for Maze Mouth", permanently, the moment a quiz part handed it
     * to a bingo one — found live: a bingo interlude showed Maze Mouth
     * instead of Rally. Leaving it out lets every part re-resolve to its
     * own kind's default, exactly as an ordinary launch does.
     */
    lobbySound: state.lobbySound,
    /*
     * AND THE BREAK PLAN DOES CARRY, unlike `lobbyGame` directly above it.
     *
     * The reason `lobbyGame` cannot is that it holds a RESOLVED id which
     * `lobbyGameFor()` can no longer tell apart from an explicit choice, so
     * carrying it turns "no preference" into a permanent override. A break
     * plan has neither problem: it is keyed by PART (`p0:lobby`, `p1:r2`), so
     * an entry can only ever apply to the part it names, and it is stored
     * exactly as the host set it rather than resolved into something else.
     * Carrying it is what makes a plan a plan — a night's worth of decisions
     * rather than one part's.
     */
    breakPlan: state.breakPlan,
    league: state.leagueOn,
    online: state.online,
    teamPlay: state.teamPlay,
    teamMode: state.teamMode,
    askForRounds: state.askForRounds,
    roundIdeas: state.roundIdeas,
  };
}

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
    /*
     * A RUNNING ORDER SURVIVES A RESTART THE SAME WAY EVERYTHING ELSE ON THE
     * NIGHT DOES — it was written onto the state at the last part's launch
     * (see `startOrderSegment`), so a restart mid-bingo-interlude still knows
     * two more quiz rounds and a prize-giving are left, and "Continue" keeps
     * working rather than silently becoming a dead end.
     */
    this.runningOrder = (state && Array.isArray(state.runningOrder) && state.runningOrder.length)
      ? state.runningOrder : null;
    this.orderPos = (this.runningOrder && typeof state.orderPos === 'number') ? state.orderPos : 0;
    this.carriedScores = (this.runningOrder && state.carriedScores) || null;

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
    /*
     * EVERY SLIDE THIS VENUE HAS, for a break that asked for adverts.
     *
     * Handed in for the identical reason as `advertLookup` above — the engine
     * keeps knowing nothing about the filesystem — and READ AT VIEW TIME for
     * the identical reason too: a corrected price reaches the projector
     * without anybody taking a slide down.
     *
     * **MATCHED ON THE VENUE'S NAME**, because an advert pack has no
     * `venueId` — the same free-text join the post-gig report's advert-opens
     * count already uses, and keeping the two the same is what stops a venue
     * meaning one thing on a projector and another on a report.
     *
     * A night with no venue gets nothing rather than everything: showing one
     * pub's offers at another is worse than showing none.
     */
    this.engine.advertsForVenue = (venue) => {
      const want = String(venue || '').trim().toLowerCase();
      if (!want) return [];
      let listed;
      try {
        listed = listAdvertPacks(this.advertDir);
      } catch {
        return []; // no adverts folder yet — a break simply shows nothing
      }
      const out = [];
      for (const summary of listed) {
        if (String(summary.venue || '').trim().toLowerCase() !== want) continue;
        /*
         * **`listAdvertPacks()` RETURNS A SUMMARY, NOT THE PACK** — its
         * `slides` are `{ id, heading, hasImage, hasLink, offerCode }`, with
         * no body, no link and no image. Building a projector slide out of
         * those gives a heading over an empty card: nothing throws, the
         * count is right, and the screen is wrong. Found live, and it is the
         * same picks-fields trap `mergeGigs()` records twice and
         * `listArchive()` once — the third sighting this month.
         */
        let pack;
        try {
          pack = loadAdvertPack(this.advertDir, summary.id);
        } catch {
          continue; // deleted between the listing and here
        }
        for (const slide of pack.slides || []) {
          out.push({
            venue: pack.venue || '',
            heading: slide.heading,
            body: slide.body,
            image: slide.image ? `/quiz-images/${slide.image}` : null,
            link: slide.link || '',
            linkLabel: slide.linkLabel || '',
            offerCode: slide.offerCode || '',
            offerLink: slide.offerCode
              ? `/o/${encodeURIComponent(pack.id)}/${encodeURIComponent(slide.id)}`
              : '',
            // `say` is the host's mic line and stays off the projector, like
            // every other host-only field.
          });
        }
      }
      return out;
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
        const results = this.engine.results();
        // A running-order night: fold in every part, not just the one that
        // happens to be `this.engine` right now. `this.runningOrder` is set
        // for the whole night, restored on a restart the same way as
        // `orderPos`, so this is correct however the night ends.
        const withParts = this.runningOrder
          ? { ...results, parts: this.describeOrderParts(this.runningOrder) }
          : results;
        const record = archiveResults(this.archiveDir, withParts, this.now());
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

        /*
         * THE LEAGUE, WORKED OUT AFTER TONIGHT IS FILED — which is the whole
         * reason it happens here rather than at launch.
         *
         * The room is about to look at it, and a table that did not include
         * the night they have just played would be worse than no table: the
         * team who won ten minutes ago would not have moved, and every person
         * in the room would spot it.
         *
         * Into the STATE, like the prizes and the comeback slide, so a restart
         * on the final scores brings back the same table rather than
         * recomputing a different one — and so the projector needs no archive
         * access of its own.
         *
         * Wrapped on its own: a league is a nicety and filing the night is
         * not. If reading the archive throws, the night stays filed and the
         * final slide simply has no table on it.
         */
        try {
          // `leagueOn` is written at launch from the tier check at the route.
          // A night launched before this existed has no flag and gets no
          // table, which is the right way round: silence, never a Silver
          // feature appearing on a projector by default.
          if (state.leagueOn && state.venue) {
            const nights = mergeGigs(listArchive(this.archiveDir, { boards: true }), []);
            const mine = nights.filter((n) => String(n.venue || '').toLowerCase() === String(state.venue).toLowerCase());
            const league = leagueTable(mine, { now: this.now() });
            // The top five only. It is a band under a podium on a projector,
            // not the wall poster, and the count says how many are in it.
            if (league.nights > 1) {
              state.league = {
                venue: state.venue,
                nights: league.nights,
                teams: league.table.length,
                table: league.table.slice(0, 5),
              };
            }
          }
        } catch { /* a league is never worth losing a filed night over */ }
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

  launch(kind, packId, { shape = null, prizes = 0, winners = 0, look = '', questionSeconds = 0, lobbyGame = '', lobbySound = true, league = false, online = false, teamPlay = false, teamMode = 'assigned', venue = '', venueId = '', rewards = [], venueLogo = '', comeBack = null, photoLink = null, askForRounds = false, roundIdeas = [], order = null, breakPlan = null } = {}) {
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
    /*
     * HOW MANY PLACES TONIGHT RECOGNISES — the podium, and who gets a voucher.
     * Beside the prizes and the card shape because it is the same kind of
     * fact: a decision about THIS EVENING rather than about the pack. Zero
     * means "not asked for", which leaves `freshState()`'s default of three,
     * so nothing that does not send it changes at all.
     */
    if (winners) {
      this.engine.state.winners = Math.max(1, Math.min(MAX_WINNERS, Math.floor(winners)));
    }

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
     * HOW LONG EACH QUESTION RUNS TONIGHT, if the host chose to change it.
     *
     * Same reasoning as the look, in the same place: written into the STATE
     * rather than left on the pack, so a restart brings back the number the
     * room already played half the night on rather than whatever the file
     * says. 0 means "as the pack says" — the same "empty means as it was"
     * rule Look and the card shape already follow — and `questionSeconds()`
     * in engine.js is where a round's OWN override still wins over this.
     */
    this.engine.state.questionSeconds = Number(questionSeconds) > 0 ? Number(questionSeconds) : 0;

    /*
     * WHICH LOBBY GAME TONIGHT.
     *
     * In the game state for exactly the reason the look and the card shape
     * are: a restart at half nine must bring the night back as it was, and a
     * room handed one game before the crash and another after it is the
     * scoreboard comparing two different games — the fault the seed beside it
     * exists to prevent.
     *
     * **RESOLVED HERE RATHER THAN TRUSTED.** `lobbyGameFor` falls back to the
     * default for this kind of night, so a console that sent nothing, sent
     * rubbish, or sent a game above its tier gets the right one rather than a
     * card with nothing behind it. The tier check is done at the ROUTE, where
     * the account is known; by the time it reaches here the decision is made.
     */
    this.engine.state.lobbyGame = lobbyGameFor(kind, lobbyGame).id;
    /*
     * WHETHER THE PHONES MAY MAKE A NOISE TONIGHT.
     *
     * A decision about the ROOM rather than about the app: a quiet gastropub
     * and a rowdy Friday are not the same place. In the state beside the game
     * itself, so a restart brings the night back as it was — and defaulting to
     * true, so a night launched by an older console is not silently muted.
     */
    this.engine.state.lobbySound = lobbySound !== false;
    /*
     * WHAT HAPPENS IN THE GAPS — `src/breaks.js`.
     *
     * **CLEANED HERE RATHER THAN TRUSTED**, like the lobby game above: it
     * arrives from a browser, and `cleanPlan()` drops anything whose id is
     * not a real break position and anything that merely restates a default.
     * That second half is what keeps a night nobody configured genuinely
     * EMPTY — so its payloads are byte-for-byte the ones this app sent before
     * breaks existed, and the pub-night guard can still prove it.
     *
     * `null` means "leave whatever is there", which is what an advance
     * through a running order passes so the plan survives the part change
     * without being re-cleaned each time.
     */
    if (breakPlan !== null) this.engine.state.breakPlan = cleanPlan(breakPlan);
    /*
     * Whether tonight ends on a league table. Decided at the route, where the
     * account and its tier are known, and stored on the night like the lobby
     * game and the card shape — so a restart brings back the same night rather
     * than one that has quietly gained or lost a feature.
     */
    this.engine.state.leagueOn = league !== false;
    /*
     * WHICH venue, as an id — resolved at the route, where the invoice book
     * is. The NAME is still written separately and still what every screen
     * prints; this is the join, so a renamed pub keeps one history.
     */
    this.engine.state.venueId = String(venueId || '');

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
     * HOW THE TEAMS ARE MADE — `src/teams.js`. Only meaningful when the line
     * above is true, and cleaned here rather than trusted: anything that is
     * not the word `random` is `assigned`, so a console sending nothing, or
     * rubbish, or a value from a future version gets the behaviour every
     * night before this one had.
     */
    this.engine.state.teamMode = teamMode === 'random' ? 'random' : 'assigned';
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
     * WHERE TONIGHT'S PHOTOGRAPHS WILL LIVE — resolved by the SERVER at launch
     * and written in, like the comeback line above. A path only: the projector
     * turns it into a full address, so nothing here has to know the host name.
     */
    this.engine.state.photoLink = typeof photoLink === 'string' && photoLink.startsWith('/')
      ? photoLink
      : null;
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
    /*
     * A PLAIN LAUNCH IS NOT A RUNNING ORDER, even when one was running a
     * moment ago — the wrong pack going up and being relaunched must not
     * leave a stale "2 more parts" on the new night. `startOrderSegment` sets
     * these again, right after this call, for the case where it genuinely is
     * one.
     */
    this.runningOrder = null;
    this.orderPos = 0;
    this.carriedScores = null;

    recordLaunch(this.config.dataDir, kind, normalised.id, this.now(), this.roomId);
    this.engine.changed();
    return { kind, id: normalised.id, title: normalised.title };
  }

  // --------------------------------------------------------- running order

  /**
   * TONIGHT AS MORE THAN ONE GAME — quiz, then a bingo interlude, then quiz
   * again, with one set of teams and one running score across the whole
   * evening. Asked for directly: *"the quiz is broken up by two music
   * bingos and the quiz prizes are only given out at the end."*
   *
   * **`launch()` above stays exactly what it always was — one engine, thrown
   * away and rebuilt.** This does not change that; it calls it once per PART
   * and, between parts, carries the roster into the next one: `join()` on
   * the fresh engine for every carried player (which deals a real bingo
   * card or sets up a real quiz player exactly as an ordinary join does),
   * then this patches the two fields `join()` cannot be told — the TOKEN (or
   * a phone's already-stored one stops matching and it is treated as a
   * stranger, the exact rule 3 problem this exists to avoid) and, into a
   * quiz part only, the SCORE (`join()` always starts a new player at zero;
   * bingo has no equivalent to carry, since a line or a house is its own
   * separate prize, not points).
   *
   * **NO ENGINE CODE CHANGES AT ALL, DELIBERATELY.** The boundary between two
   * parts is the same natural pause every night already has: a composed
   * quiz's ROUND_BOARD after its last round does not advance to FINAL until
   * `next()` is pressed again (`isLastRound` in `engine.js`'s `next()`), and
   * bingo sits on WON/PLAYING until the host presses Finish. So an
   * intermediate part simply never reaches FINAL or FINISHED — the console
   * offers "Continue" there instead of the ordinary next/finish — which
   * means it is never archived and a quiz part never issues its prizes
   * early. Only the LAST part in the order goes through its own game's real
   * ending, exactly as an ordinary night does, and that is what makes "quiz
   * prizes only at the end" true for free rather than something this file
   * has to enforce.
   */
  launchRunningOrder(segments, opts = {}) {
    const list = normaliseSegments(segments);
    if (!list.length) throw new Error('A running order needs at least one part.');
    if (list.length > MAX_ORDER_PARTS) {
      throw new Error(`A night can have at most ${MAX_ORDER_PARTS} parts.`);
    }
    /*
     * EVERY PACK IN EVERY PART IS LOADED HERE, BEFORE ANYTHING LAUNCHES —
     * not just the first one, and not just when the host actually reaches
     * that part. Without this, a pack deleted between building tonight's
     * running order and pressing Launch would launch part one perfectly
     * happily and then throw when `advanceOrder()` tried to build part two
     * — in front of the room, at whatever time in the evening that happens
     * to be. `composeQuiz()` already validates a quiz part's own rounds this
     * way for a single-pack night; this does the same for every part of a
     * mixed one, and for bingo, which has no `composeQuiz` of its own.
     */
    for (const seg of list) {
      if (seg.kind === 'bingo') {
        try {
          LAUNCHERS.bingo.load(this.config, seg.packId, this.paths);
        } catch {
          throw new Error(`There is no bingo pack called ${seg.packId} any more.`);
        }
      } else {
        composeQuiz(seg.order, (id) => LAUNCHERS.quiz.load(this.config, id, this.paths));
      }
    }
    return this.startOrderSegment(list, 0, opts, null);
  }

  /**
   * Move on to the next part, carrying the roster — and, into a quiz, the
   * running score — with it. The night-wide facts (venue, prizes, look…) are
   * read off the part that is ENDING rather than kept a second way, which is
   * also what makes this survive a restart with no extra state to restore.
   */
  advanceOrder() {
    const list = this.runningOrder;
    if (!list || this.orderPos >= list.length - 1) return { ok: false, reason: 'no_more_parts' };
    const opts = nightWideOpts(this.engine.state);
    /*
     * THE RUNNING SCORE ONLY EXISTS ON A QUIZ ENGINE'S PLAYERS. Bingo has
     * nothing of its own to update it with — a line or a house is its own
     * separate prize, not points — so this refreshes the tally only when a
     * QUIZ part is the one ending, and simply carries the last one forward
     * unchanged through a bingo interlude. That is what makes "the score
     * survives the bingo interruption" true across TWO switches rather than
     * one: read it here, it would be gone the moment bingo's own players
     * (who have no `.score` field at all) became the source.
     */
    if (this.kind === 'quiz') {
      this.carriedScores = Object.fromEntries(this.engine.playerList().map((p) => [p.id, {
        score: p.score, correctCount: p.correctCount,
        answeredCount: p.answeredCount, totalResponseMs: p.totalResponseMs,
      }]));
    }
    const scores = this.carriedScores;
    const carry = this.engine.playerList().map((p) => ({
      id: p.id,
      token: p.token,
      name: p.name,
      ...(scores && scores[p.id] ? scores[p.id] : {}),
    }));
    return this.startOrderSegment(list, this.orderPos + 1, opts, carry, scores);
  }

  /**
   * What each part of a running order actually was, resolved FRESH rather
   * than trusted from whenever it launched — a pack can be deleted mid-
   * evening, and the archive should say so rather than throw or silently
   * drop the part.
   *
   * Only called once, at archive time, and only on a night that went through
   * `launchRunningOrder()` — an ordinary single-game night has no
   * `state.runningOrder` and never reaches this, so its archived record gains
   * no new field at all. This is what closes the gap `docs/console.md` and
   * `todo/console.md` flagged: `engine.results()` only ever knows about
   * whichever engine is live when the night ends, i.e. the LAST part, so a
   * quiz broken up by a bingo interlude used to lose the quiz's own pack
   * identity from Past gigs entirely the moment the bingo interlude replaced
   * it as `this.engine`.
   */
  describeOrderParts(list) {
    return (list || []).map((seg) => {
      try {
        if (seg.kind === 'bingo') {
          const pack = LAUNCHERS.bingo.load(this.config, seg.packId, this.paths);
          return { kind: 'bingo', id: pack.id, title: pack.title };
        }
        const pack = composeQuiz(seg.order, (id) => LAUNCHERS.quiz.load(this.config, id, this.paths));
        return { kind: 'quiz', id: pack.id, title: pack.title };
      } catch {
        // A pack deleted since this part was played — named as missing
        // rather than dropped silently, the same choice `composeQuiz` itself
        // makes when a round's own pack has gone.
        return { kind: seg.kind, id: seg.packId || null, title: null };
      }
    });
  }

  startOrderSegment(list, pos, opts, carry, scores = null) {
    const seg = list[pos];
    const started = seg.kind === 'bingo'
      ? this.launch('bingo', seg.packId, { ...opts, shape: seg.shape, prizes: seg.prizes })
      : this.launch('quiz', null, { ...opts, order: seg.order });
    /*
     * `launch()` above just cleared all three of these (`runningOrder`,
     * `orderPos`, `carriedScores`) — right for an ORDINARY launch, wrong
     * here, so they are set again now that the new part's engine actually
     * exists. `scores` has to arrive as a PARAMETER rather than be read back
     * off `this.carriedScores`: that field is exactly what `launch()` just
     * wiped, and reading it here would silently carry `null` forward instead
     * of the tally `advanceOrder()` computed a moment ago.
     */
    this.runningOrder = list;
    this.orderPos = pos;
    this.carriedScores = scores;
    this.engine.state.runningOrder = list;
    this.engine.state.orderPos = pos;
    this.engine.state.carriedScores = scores;
    if (carry && carry.length) this.seedCarriedPlayers(carry);
    this.engine.changed();
    return started;
  }

  /**
   * Put a roster from the part that just ended onto the fresh engine's own
   * players, keeping their identity — so a phone that already joined tonight
   * never has to rejoin for a kind switch it did not cause.
   */
  seedCarriedPlayers(carry) {
    for (const rec of carry) {
      const player = this.engine.join({ playerId: rec.id, name: rec.name });
      const p = player && player.id && this.engine.state.players[player.id];
      if (!p) continue;
      // `join()` always mints a fresh token for a brand-new player — right
      // for an honest new phone, wrong here: this player already proved who
      // they are for the rest of tonight, and a changed token is exactly the
      // "phone that cannot prove itself" case rule 3 exists to prevent.
      p.token = rec.token;
      if (this.kind === 'quiz' && typeof rec.score === 'number') {
        p.score = rec.score;
        p.correctCount = rec.correctCount || 0;
        p.answeredCount = rec.answeredCount || 0;
        p.totalResponseMs = rec.totalResponseMs || 0;
      }
    }
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
      /*
       * SO THE CONSOLE CAN OFFER "CONTINUE" AND SAY WHAT IS NEXT, even after a
       * restart wiped what it had in memory — `pos`/`total` say how far
       * through tonight's parts we are, and `nextKind` is enough to word the
       * button ("Continue to bingo") without this file knowing pack titles.
       */
      runningOrder: this.runningOrder ? {
        pos: this.orderPos,
        total: this.runningOrder.length,
        nextKind: this.orderPos < this.runningOrder.length - 1
          ? this.runningOrder[this.orderPos + 1].kind : null,
      } : null,
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
      // The bar's phone could not reach us, or it came over and said it was
      // not working. Both games mint vouchers the same way (see bingo.js's
      // issueVoucher/redeemVoucher, copied from the quiz's own), so this is
      // shared rather than duplicated per game — it was quiz-only at first
      // and a bingo night's "Put it back" button 404'd with "Unknown action".
      redeemVoucher: () => this.engine.redeemVoucher(body.code, { by: 'host' }),
      reinstateVoucher: () => this.engine.reinstateVoucher(body.code),
      // "Continue to bingo" / "Continue to the quiz" — the running order's
      // own button, standing in for the ordinary next/finish at exactly the
      // point those would otherwise end the part for real. Shared because
      // either game can be a part of one.
      advanceOrder: () => this.advanceOrder(),
      // What tonight is playing for, changed mid-game — the landlord changed
      // their mind, or the host typed the wrong thing at launch. Both games
      // keep the identical `state.rewards` shape (see `rewardList()` on
      // either engine), so one action serves both rather than two copies of
      // the same validation drifting apart.
      setRewards: () => this.engine.setRewards(body.rewards),
    };

    const perGame = this.kind === 'quiz' ? {
      start: () => this.engine.start(),
      next: () => this.engine.next(),
      back: () => this.engine.back(),
      reveal: () => this.engine.reveal(),
      // The scores on the big screen, without moving the quiz.
      scoreboard: () => this.engine.showScoreboard(body.on !== false),
      // Tonight's photographs, as a slide of their own at the final.
      photos: () => this.engine.showPhotoSlide(body.on !== false),
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
    /*
     * BOTH GAMES, because both have a lobby and both now have something to do
     * in it — Maze Mouth before a quiz, Rally before the bingo. It was quiz
     * only, which is why this is a `kind`-free line rather than a second one
     * beside it: each engine decides for itself which phase counts as waiting
     * (`src/arcade.js`), so there is nothing here to keep in step.
     */
    if (action === 'arcade') {
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
    // A breakout round's phones TYPE rather than pick, so it needed its own
    // action rather than reusing `answer` — see the note on `answerBreakout`
    // in engine.js for why that is a separate method rather than a branch
    // inside `answer()`.
    if (this.kind === 'quiz' && action === 'answer-breakout') {
      return this.engine.answerBreakout(body.playerId, body.text);
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
