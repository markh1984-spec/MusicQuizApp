/**
 * PUB PRIX AS A GAME OF ITS OWN — a part of the night, like card bingo.
 *
 * ---
 *
 * Asked for on 9 October 2026, the day the race went in as a flag over a
 * break: *"what would be good is if it was like a game type — you've got the
 * card bingo and then you've got the music bingo. These are game types that
 * give a free drink."* So a running order can hold a Pub Prix the way it holds
 * a bingo game: dragged onto Tonight between two quiz rounds, *Continue to Pub
 * Prix* at the boundary, a race (or several), *Continue to the quiz*.
 *
 * **THE RACE ITSELF IS `src/race.js`, UNCHANGED.** This engine is the part
 * around it — the room, the grid while they join, which drink a race pays —
 * and it answers the same methods the quiz and bingo engines do for the break
 * race (`openRace`/`steerRace`/`tickRace`/`closeRace`/`dropRace`). So the
 * session's shared dispatch, the phone's tap route, the projector's `race`
 * event and `armRaceTimer()` needed no change at all: they already ask for a
 * CAPABILITY, never a kind.
 *
 * **IT CARRIES WHAT IT DOES NOT USE.** A part boundary builds the next part's
 * options off the ENDING part's state (`nightWideOpts()`), so the venue, the
 * look, the break plan, the team map and the rest are written onto this state
 * by `launch()` and must survive here untouched — or the quiz after the race
 * comes back with no venue and no prizes. It is a plain object and nothing
 * here destructures it, which is the whole defence (the whitelist trap this
 * repo has recorded five times).
 *
 * **A RACE IS A GAME, AND A GAME PAYS ONE DRINK.** The first race pays the
 * part's first prize, the next race the second, and past the list the last
 * drink again — `rewardFor()`, bingo's rule for a round, for the same reason:
 * a game nobody expected to be free should not hand its winner a blank phone.
 */

import { faceKey, newVoucherCode } from './engine.js';
import { PartGame } from './part-game.js';
import { voteForHost, voteForPlayer, voteForScreen } from './photo-vote.js';
import {
  openRace, steerRace, raceIsOver, finishRace, dropRace,
  raceForScreen, raceForPlayer, raceForHost, MIN_KARTS, MAX_KARTS,
} from './race.js';
import { kartColour, LANES, pubPrixPack } from '../public/assets/race-track.js';

/**
 * LOBBY while the room joins and between races (the karts on the grid);
 * RACING while one is on; DONE with a result up; FINISHED when the host ends
 * the night here.
 *
 * **THE WAITING PHASE IS CALLED `lobby`, LIKE EVERY OTHER GAME'S.** It was
 * `grid`, and the console reads any phase but `lobby` as a night in full
 * swing: a race launched and waiting hid Tonight's launch bar altogether,
 * and `tonight-resolves.mjs` caught it. The app already knows what a waiting
 * room is; a game that names its own is a kind test waiting to happen.
 */
export const RACE_PHASES = { LOBBY: 'lobby', RACING: 'racing', DONE: 'done', FINISHED: 'finished' };

const newSeed = (random) => Math.floor(random() * 2147483647) + 1;

/**
 * The room, the drinks and the photo vote are `PartGame`'s, shared with Up or
 * Down; what is here is the race.
 */
export class RaceGame extends PartGame {
  constructor({ pack = null, state = null, now = () => Date.now(), onChange = () => {}, random = Math.random } = {}) {
    super({
      kind: 'race',
      pack: pack || pubPrixPack(),
      state,
      now,
      onChange,
      random,
      phases: Object.values(RACE_PHASES),
      // The track the grid shows is the track they race on.
      fresh: () => ({ race: null, nextSeed: newSeed(random) }),
    });
    if (!(this.state.nextSeed > 0)) this.state.nextSeed = newSeed(this.random);
    // A state from before the base kept its count as `races`.
    if (this.state.races && !this.state.games) this.state.games = this.state.races;
  }

  /** Everybody who has never started an engine in a race this part. */
  removeIdlePlayers() {
    const r = this.state.race;
    if (!r) return { ok: true, removed: 0 };
    const raced = new Set(r.entrants.filter((e) => e.taps.length).map((e) => e.playerId));
    const idle = this.playerList().filter((p) => !raced.has(p.id));
    for (const p of idle) this.removePlayer(p.id);
    return { ok: true, removed: idle.length };
  }

  /** Back to the grid: the room stays, the races go. */
  resetAll() {
    this.state.race = null;
    this.state.games = 0;
    this.state.podiums = [];
    this.state.phase = RACE_PHASES.LOBBY;
    this.state.nextSeed = newSeed(this.random);
    this.changed();
    return true;
  }

  where() {
    if (this.state.phase === RACE_PHASES.RACING) return 'racing';
    if (this.state.phase === RACE_PHASES.DONE) return 'the race result';
    if (this.state.phase === RACE_PHASES.FINISHED) return 'finished';
    return 'the grid';
  }

  /** The photo vote waits for the flag — never over a race in full flight. */
  busy() { return this.state.phase === RACE_PHASES.RACING; }

  settleGame() { this.settleRace(); }

  // ------------------------------------------------------------- the race

  /**
   * Lights out. From the grid, or straight after a result (*Race again*).
   * Everybody on the board right now is on the grid; a phone that joins
   * mid-race waits for the next.
   */
  openRace() {
    const phase = this.state.phase;
    if (phase === RACE_PHASES.RACING) return { ok: false, reason: 'racing' };
    if (phase === RACE_PHASES.FINISHED) return { ok: false, reason: 'finished' };
    const players = this.playerList().map((p) => ({ id: p.id, name: p.name }));
    const out = openRace(this.state, players, { now: this.now(), random: this.random, seed: this.state.nextSeed });
    if (!out.ok) return out;
    if (this.state.photoVote && this.state.photoVote.open) this.closePhotoVote();
    this.state.photoVote = null;
    this.state.phase = RACE_PHASES.RACING;
    this.changed();
    return out;
  }

  steerRace(playerId, steer) {
    return steerRace(this.state, playerId, steer, this.now());
  }

  tickRace() {
    if (!raceIsOver(this.state, this.now())) return false;
    this.closeRace();
    return true;
  }

  closeRace() {
    const r = this.state.race;
    if (!r) return { ok: false, reason: 'no_race' };
    if (r.phase === 'done') return { ok: true, winner: r.winner };
    const out = finishRace(this.state, {
      now: this.now(),
      reward: this.rewardFor(this.state.games || 0),
      venue: this.state.venue || '',
      newCode: newVoucherCode,
    });
    // A race nobody started is not a game played — the next one pays the
    // same drink, rather than a lap of nobody spending the first prize.
    if (out.winner) {
      this.state.games = (this.state.games || 0) + 1;
      this.state.podiums.push({
        at: this.now(),
        results: (r.results || []).slice(0, 3).map((x) => ({ name: x.name, place: x.place, time: x.time })),
      });
    }
    this.state.phase = RACE_PHASES.DONE;
    this.state.nextSeed = newSeed(this.random);
    this.changed();
    return out;
  }

  /** A move settles a race; it never throws one away. The result stays up. */
  settleRace() {
    if (this.state.race && this.state.race.phase === 'racing') this.closeRace();
  }

  /** Off the screen and back to the grid, for another race or to move on. */
  dropRace() {
    if (this.state.race && this.state.race.phase === 'racing') this.closeRace();
    const out = dropRace(this.state);
    if (this.state.phase !== RACE_PHASES.FINISHED) this.state.phase = RACE_PHASES.LOBBY;
    this.changed();
    return out;
  }

  // -------------------------------------------------------------- the views

  /**
   * THE GRID — everybody in the room, on the start line, on the track they are
   * about to race. Built from the players rather than stored, so a phone that
   * joins appears on the projector with the next push.
   */
  gridForScreen() {
    return {
      id: `grid${this.state.games || 0}`,
      seed: this.state.nextSeed,
      startsAt: null,
      phase: 'grid',
      karts: this.playerList().slice(0, MAX_KARTS).map((p, n) => ({
        n, name: p.name, lane: n % LANES, colour: kartColour(n), taps: [], face: faceKey(p.id),
      })),
    };
  }

  /** The race on, or the grid while there is none. */
  raceView(forWhom) {
    if (this.state.phase === RACE_PHASES.FINISHED) return forWhom.done();
    if (this.state.race) return forWhom.race();
    return forWhom.grid();
  }

  screenView() {
    const vote = voteForScreen(this.state);
    return {
      kind: 'race',
      phase: this.state.phase,
      title: this.pack.title,
      playerCount: this.playerList().length,
      race: this.raceView({
        race: () => raceForScreen(this.state),
        grid: () => this.gridForScreen(),
        // Ended on the grid: the track stays up, saying it is over.
        done: () => raceForScreen(this.state) || { ...this.gridForScreen(), over: true },
      }),
      ...(vote && this.state.phase !== RACE_PHASES.RACING ? { photoVote: vote } : {}),
    };
  }

  playerView(playerId) {
    const p = this.state.players[String(playerId || '')];
    if (!p) return wasRemoved(this.state, playerId) ? { kind: 'race', kicked: true } : { kind: 'race', rejoin: true };
    const view = {
      kind: 'race',
      phase: this.state.phase,
      title: this.pack.title,
      you: { id: p.id, name: p.name },
      playerCount: this.playerList().length,
    };
    if (this.state.phase !== RACE_PHASES.FINISHED || this.state.race) {
      view.race = this.state.race ? raceForPlayer(this.state, p.id) : this.gridForPlayer(p.id);
    }
    const mine = this.phoneVouchers(p.id);
    if (mine.length) view.vouchers = mine;
    const vote = voteForPlayer(this.state, p.id);
    if (vote && this.state.phase !== RACE_PHASES.RACING) view.photoVote = vote;
    return view;
  }

  /** One phone on the grid: which kart is theirs, before the lights go. */
  gridForPlayer(playerId) {
    const list = this.playerList();
    const n = list.findIndex((p) => p.id === playerId);
    const out = { id: `grid${this.state.games || 0}`, phase: 'grid', startsAt: null, karts: list.length };
    if (n >= 0 && n < MAX_KARTS) out.you = { n, lane: n % LANES, colour: kartColour(n), taps: [] };
    return out;
  }

  hostView() {
    const vote = voteForHost(this.state);
    const r = this.state.race;
    return {
      kind: 'race',
      phase: this.state.phase,
      title: this.pack.title,
      playerCount: this.playerList().length,
      players: this.everyone().map((p) => ({
        id: p.id, name: p.name, connected: Boolean(p.connected), faceKey: faceKey(p.id),
        ...(p.organiser ? { organiser: true } : {}),
      })),
      race: r ? raceForHost(this.state) : { phase: 'grid', karts: this.playerList().length, started: 0 },
      // Which drink the next race pays, NAMED on the host's button.
      nextPrize: this.rewardFor(this.state.games || 0),
      racesRun: this.state.games || 0,
      minKarts: MIN_KARTS,
      rewards: this.rewardList(),
      vouchers: Object.values(this.state.vouchers || {}),
      ...(vote ? { photoVote: vote } : {}),
    };
  }

  /**
   * What is filed if the night ENDS on Pub Prix. `kind: 'race'` so the league
   * drops it — a race has no season score — and a night that played a quiz
   * first is filed as that quiz by `scoresOfTheNight()`, exactly as a night
   * ending on the bingo is.
   */
  results() {
    const last = this.state.race && this.state.race.results ? this.state.race.results : [];
    return {
      kind: 'race',
      packId: this.pack.id,
      title: this.pack.title,
      venue: this.state.venue || '',
      venueId: this.state.venueId || '',
      rewards: this.rewardList(),
      vouchers: Object.values(this.state.vouchers || {}),
      startedAt: this.state.startedAt,
      finishedAt: this.state.finishedAt,
      races: this.state.games || 0,
      podiums: this.state.podiums.slice(),
      players: this.playerList().length,
      leaderboard: this.playerList().map((p) => {
        const n = this.state.race ? this.state.race.entrants.findIndex((e) => e.playerId === p.id) : -1;
        const row = n >= 0 ? last.find((x) => x.index === n) : null;
        return { name: p.name, faceKey: faceKey(p.id), place: row ? row.place : null };
      }).sort((a, b) => (a.place || 999) - (b.place || 999)),
    };
  }
}

/** The `LAUNCHERS` entry — see the table at the top of `session.js`. */
export const RACE_LAUNCHER = {
  // BUILT IN, like the deck: no file, no shelf, nothing to own.
  builtIn: true,
  load: () => pubPrixPack(),
  list: () => [pubPrixPack()],
  make: (pack, opts) => new RaceGame({ pack, ...opts }),
  /*
   * A race opening or finishing, a phone joining and a drink minted or spent
   * all move the night forward (rule 7). A TAP is deliberately not here: it is
   * saved through the debounce, and a lost tap costs a lane, not a night.
   */
  milestone: (s) => `${s.phase}:${s.race ? `${s.race.id}:${s.race.phase}` : '-'}:${Object.keys(s.players || {}).length}:${
    Object.values(s.vouchers || {}).map((v) => `${v.code}${v.redeemedAt ? '!' : ''}${v.reinstated || ''}${v.carried ? '~' : ''}`).join(',')}`,
  isOver: (s) => s.phase === RACE_PHASES.FINISHED,
  empty: pubPrixPack(),
};
