/**
 * PUB PRIX ON THE NIGHT — the race as a flag over a break, shared by both
 * engines. The physics are in `public/assets/race-track.js`; this file is who
 * is racing, who tapped what and when, and who won.
 *
 * Asked for on 9 October 2026 — *"each player is racing around a track but the
 * track is on the main screen"* — with three choices made off options: tap a
 * LANE (the karts drive themselves), the name **Pub Prix**, and **the winner
 * gets the last drink on the list**, like the funniest photograph.
 *
 * **IT IS `photo-vote.js`'S SHAPE, ON PURPOSE.** A flag, never a phase (rule
 * 9): it goes over a break without moving the night, it is refused over a live
 * question, and **a move SETTLES it rather than throwing it away** — the host
 * pressing on pays whoever is leading, because sixty people just raced. State
 * in, result out; neither engine's `changed()` is called from here.
 *
 * **A TAP IS NOT A STATE PUSH.** Sixty phones steering every second would
 * be sixty full rebuilds of every payload in the room, every second. So a tap
 * is written into the state (and saved, debounced — a lost tap costs a turn,
 * not a night), answered to the phone that sent it, and sent on to the
 * PROJECTOR alone as a `race` event. The phones are only pushed when the race
 * starts and when it ends.
 *
 * **THE SERVER STAMPS EVERY TAP (rule 2).** A phone sends a steer and nothing
 * else; the time is `now()`. The phone draws itself slightly ahead of the
 * server so a tap at the last moment on the phone still lands in time here —
 * see `race-phone.js` — but what is decided is decided on this clock.
 *
 * **NOBODY'S PLAYER ID GOES ON A WIRE (rule 3).** A kart is a NUMBER on the
 * projector and in every event; the id lives in the state and is used for
 * exactly two things, the tap's owner and the drink's.
 */
import {
  COUNTDOWN_MS, MAX_RACE_MS, AFTER_WINNER_MS, MIN_TAP_MS, MAX_TAPS, LAPS, LANES,
  courseFor, kartAt, standings, clampSteer, kartColour,
} from '../public/assets/race-track.js';
import { faceKey } from './engine.js';

/**
 * Two phones at least — one kart is a lap of honour, not a race, and a drink
 * for driving round on your own would be the draw's fault again: a prize
 * nobody chose to give.
 */
export const MIN_KARTS = 2;
/** The projector can draw this many; past it, a room is a crowd, not a grid. */
export const MAX_KARTS = 80;

/**
 * Open a race. `players` is `[{ id, name }]`, everybody on the board right
 * now; somebody who joins mid-race waits for the next one.
 */
export function openRace(state, players, { now, random = Math.random, seed = 0 } = {}) {
  const list = (Array.isArray(players) ? players : []).filter((p) => p && p.id).slice(0, MAX_KARTS);
  if (list.length < MIN_KARTS) return { ok: false, reason: 'too_few' };
  const openedAt = now;
  state.race = {
    id: `r${openedAt.toString(36)}`,
    // A Pub Prix PART names its seed (`RaceGame`), so the track drawn on the
    // grid while the room joins is the track they race on.
    seed: seed > 0 ? Math.floor(seed) : Math.floor(random() * 2147483647) + 1,
    openedAt,
    startsAt: openedAt + COUNTDOWN_MS,
    phase: 'racing',
    entrants: list.map((p, i) => ({
      playerId: String(p.id),
      name: String(p.name || `Kart ${i + 1}`).slice(0, 40),
      lane: i % LANES,
      // A dead heat is broken by this, drawn once, here, so every screen and
      // every restart breaks it the same way.
      tie: random(),
      taps: [],
    })),
    endedAt: null,
    results: null,
    winner: null,
  };
  return { ok: true, karts: list.length, startsAt: state.race.startsAt };
}

/**
 * One phone steers — -1 left, 0 straight, +1 right. Answered with the
 * SERVER's time, which the phone
 * puts in place of its own guess.
 *
 * Refused rather than queued when it is too soon after the last (`MIN_TAP_MS`)
 * or past `MAX_TAPS` — a phone mashing the screen gains nothing, and a script
 * cannot fill the state file.
 */
export function steerRace(state, playerId, steer, now) {
  const r = state.race;
  if (!r || r.phase !== 'racing') return { ok: false, reason: 'no_race' };
  if (now > r.startsAt + MAX_RACE_MS) return { ok: false, reason: 'over' };
  const index = r.entrants.findIndex((e) => e.playerId === String(playerId || ''));
  if (index < 0) return { ok: false, reason: 'not_racing' };
  const e = r.entrants[index];
  const want = clampSteer(steer);
  const last = e.taps[e.taps.length - 1];
  if (last && now - last[0] < MIN_TAP_MS) return { ok: false, reason: 'too_fast' };
  if (e.taps.length >= MAX_TAPS) return { ok: false, reason: 'too_many' };
  // The same steer again changes nothing — except the FIRST tap, which is what
  // starts the engine (`stepKart()`: a kart sits on the grid until then).
  if (last && last[1] === want) return { ok: true, at: last[0], steer: want, index, same: true };
  e.taps.push([now, want]);
  return { ok: true, at: now, steer: want, index };
}

/** Every kart, stepped to `t`, with what the standings need beside it. */
function rowsAt(r, t) {
  const course = courseFor(r.seed);
  return r.entrants.map((e, index) => ({
    index,
    name: e.name,
    tie: e.tie,
    kart: kartAt(course, e.taps, e.lane, r.startsAt, t),
  }));
}

/**
 * Is it over? Asked every half-second by the session's race timer. Pure: it
 * decides, and `finishRace()` writes.
 *
 * Over when every kart that has started is home, or ten seconds after the
 * first one, or at the hard cap — whichever comes first.
 */
export function raceIsOver(state, now) {
  const r = state.race;
  if (!r || r.phase !== 'racing') return false;
  if (now < r.startsAt) return false;
  if (now >= r.startsAt + MAX_RACE_MS) return true;
  const rows = rowsAt(r, now);
  const started = rows.filter((x) => x.kart.startedAt !== null);
  const home = started.filter((x) => x.kart.finishedAt !== null);
  if (!home.length) return false;
  if (home.length === started.length) return true;
  const first = Math.min(...home.map((x) => x.kart.finishedAt));
  return now >= first + AFTER_WINNER_MS;
}

/**
 * Close it, name the winner, mint the drink. Called when the race is over and
 * on any move (the photo vote's rule), so whoever is in front when the host
 * presses on is the winner — never nobody because the host was quick.
 *
 * **A KART THAT NEVER STARTED CANNOT WIN**, and nobody started means nobody
 * won — the photo vote's *nobody voting is not somebody winning*.
 */
export function finishRace(state, { now, reward = '', venue = '', newCode = null, owner = null } = {}) {
  const r = state.race;
  if (!r) return { ok: false, reason: 'no_race' };
  if (r.phase === 'done') return { ok: true, winner: r.winner };
  const at = Math.min(now, r.startsAt + MAX_RACE_MS);
  const order = standings(rowsAt(r, at));
  r.phase = 'done';
  r.endedAt = now;
  r.results = order.map((x, i) => ({
    index: x.index,
    name: x.name,
    place: i + 1,
    // Seconds after GO, to a tenth — the projector's podium prints it.
    time: x.kart.finishedAt !== null ? Math.round((x.kart.finishedAt - r.startsAt) / 100) / 10 : null,
    lap: Math.min(LAPS, Math.floor(x.kart.d / 1000) + 1),
    started: x.kart.startedAt !== null,
  }));
  const top = order.find((x) => x.kart.startedAt !== null);
  if (!top) {
    r.winner = null;
    return { ok: true, winner: null };
  }
  const entrant = r.entrants[top.index];
  r.winner = { index: top.index, name: entrant.name };
  /*
   * THE DRINK — minted here and nowhere else, exactly as the funniest photo's
   * is: the LAST prize on the list, named on the host's button before the
   * race starts, `place: null` so no phone tells the winner they won the QUIZ,
   * and no `round` stamp so a bingo night never holds it back. Minted to
   * whoever holds the winner's ROW (`owner`), or a team night's phone would
   * never see it.
   */
  if (reward && typeof newCode === 'function') {
    if (!state.vouchers) state.vouchers = {};
    let code = newCode();
    while (state.vouchers[code]) code = newCode();
    const holder = typeof owner === 'function' ? owner(entrant.playerId) : null;
    state.vouchers[code] = {
      code,
      winnerId: (holder && holder.id) || entrant.playerId,
      name: (holder && holder.name) || entrant.name,
      place: null,
      race: true,
      reward,
      venue,
      issuedAt: now,
      redeemedAt: null,
      reinstated: 0,
      history: [],
    };
    r.winner.code = code;
  }
  return { ok: true, winner: r.winner };
}

/** The host's "take it off the screen". The drink, if any, is already minted. */
export function dropRace(state) {
  state.race = null;
  return { ok: true };
}

/**
 * THE PROJECTOR'S HALF: every kart by NUMBER, its name, its starting lane and
 * its taps so far — enough to draw the whole race from scratch after a reload.
 * Taps that arrive later come as `race` events (`raceTapEvent()`).
 */
export function raceForScreen(state) {
  const r = state.race;
  if (!r) return null;
  const out = {
    id: r.id,
    seed: r.seed,
    startsAt: r.startsAt,
    phase: r.phase,
    // `face` is `faceKey()`, never the id (rule 3) — the key the photographs
    // on this same payload already carry, so the kart finds its driver's face.
    karts: r.entrants.map((e, n) => ({ n, name: e.name, lane: e.lane, colour: kartColour(n), taps: e.taps, face: faceKey(e.playerId) })),
  };
  if (r.phase === 'done') {
    out.endedAt = r.endedAt;
    out.results = (r.results || []).slice(0, 10);
    // The code never goes on the projector — it is a drink to whoever reads it.
    out.winner = r.winner ? { index: r.winner.index, name: r.winner.name } : null;
  }
  return out;
}

/** What goes to the projector the moment a tap lands. A number, a time, a steer. */
export function raceTapEvent(state, result) {
  const r = state.race;
  if (!r || !result || !result.ok || result.same) return null;
  return { id: r.id, n: result.index, at: result.at, steer: result.steer };
}

/** One phone: its own kart and nobody else's taps. */
export function raceForPlayer(state, playerId) {
  const r = state.race;
  if (!r) return null;
  const n = r.entrants.findIndex((e) => e.playerId === String(playerId || ''));
  const out = {
    id: r.id,
    seed: r.seed,
    startsAt: r.startsAt,
    phase: r.phase,
    karts: r.entrants.length,
  };
  if (n >= 0) {
    const e = r.entrants[n];
    out.you = { n, lane: e.lane, colour: kartColour(n), taps: e.taps };
  }
  if (r.phase === 'done') {
    const mine = n >= 0 ? (r.results || []).find((x) => x.index === n) : null;
    if (mine) out.place = mine.place;
    out.winner = r.winner ? { name: r.winner.name, you: r.winner.index === n } : null;
  }
  return out;
}

/** The host's panel: how many are in, how many have started, and the result. */
export function raceForHost(state) {
  const r = state.race;
  if (!r) return null;
  const out = {
    id: r.id,
    phase: r.phase,
    startsAt: r.startsAt,
    karts: r.entrants.length,
    started: r.entrants.filter((e) => e.taps.length).length,
  };
  if (r.phase === 'done') {
    out.results = (r.results || []).slice(0, 3);
    out.winner = r.winner ? { name: r.winner.name, code: r.winner.code || null } : null;
  }
  return out;
}
