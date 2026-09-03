/**
 * A SHOW — the whole evening, built in advance and dragged onto Tonight.
 *
 * Asked for on 16 August 2026, and the diagnosis is the host's own: *"the
 * launch bar is launching nights — but we're frankensteining nights instead of
 * having a nights section. You build a night in advance and then just drag it
 * in onto the launch console."* He is right, and the fault he is naming is
 * that the console composes a night AT THE MOMENT OF LAUNCHING IT, which is
 * the worst time in the whole week to be composing anything.
 *
 * ---
 *
 * **A SHOW IS A SAVED LAUNCH. That is the entire model, and it is why this
 * file is small.** `doLaunch()` in `console.js` already sends one object —
 * `{ game, packId, order, venue, look, lobbyGame, lobbySound, teamPlay,
 * online, shape, prizes }` — and that object already IS the whole evening:
 * what is played, in what order, where, what it looks like, what the phones do
 * while the room fills up. Nothing new had to be invented; a show is that
 * payload with a name on it.
 *
 * Which means dragging a show onto Tonight is not a translation step. It is
 * the same fields going back into the same bar.
 *
 * ---
 *
 * **IT STORES REFERENCES AND NEVER COPIES, WHICH IS WHAT KEEPS RULE 11 TRUE.**
 * A show holds pack IDS and round INDEXES — never a question, never an answer,
 * never a track. So a correction saved to a pack tomorrow is simply in every
 * show that uses it, because there is nothing here to go stale. This is the
 * same reasoning `running-order.js` is built on, and it is the reason a show
 * is not allowed to become "a copy of tonight's quiz".
 *
 * The cost of that is a show can go BROKEN — the pack it names gets deleted —
 * and the answer is the same one the composer already gives: **say so, by
 * name, in advance.** `composeQuiz()` throws *"There is no pack called X any
 * more"* at launch, which is correct but late; `showProblems()` below answers
 * the same question on the card, days earlier, which is the whole point of
 * building a night in advance.
 *
 * ---
 *
 * **A SHOW IS NOT A GATE, AND MUST NEVER BECOME ONE.** Nothing here is
 * trusted at launch: the launch route re-checks the tier, re-checks that every
 * pack in the order is one they hold, re-checks the lobby game against the
 * tier, and still refuses to wipe a running night without `replace`. A show
 * saved on Gold and launched after a downgrade is refused exactly as a fresh
 * launch would be.
 *
 * That is worth stating because the opposite is the obvious shortcut and it is
 * a gate that runs backwards: *"it was allowed when they saved it"* is how a
 * subscription gets walked round by a file somebody wrote last month.
 *
 * ---
 *
 * **PER ROOM, like everything a quizmaster owns.** `paths` comes from
 * `rooms.pathsFor()`, so this file never learns that rooms exist — and because
 * no route takes a room parameter, there is no id anybody can send that
 * reaches another quizmaster's shows. Same enforcement as own-packs.
 */

import { cleanPlan } from '../public/assets/break-parts.js';
import fs from 'node:fs';
import path from 'node:path';

import { MAX_ROUNDS } from './running-order.js';
import { itemsOf } from '../public/assets/show-parts.js';

/**
 * How many a room may keep.
 *
 * A show is a few hundred bytes, so this is not about disk — it is about the
 * shelf staying a shelf. Forty is already more than a full year of a weekly
 * residency at four pubs, and somebody with more than that wants folders,
 * which is a different feature to have a conversation about rather than to
 * guess at.
 */
export const MAX_SHOWS = 40;

/** The two games one PART of a show can be — see `normaliseItem`. */
export const SHOW_KINDS = ['quiz', 'bingo'];

/**
 * The id, from the name.
 *
 * The same alphabet `safeId()` uses in `quizzes.js`, for the same reason:
 * this ends up in a filename-shaped key and in a URL, and anything outside
 * it is somebody else's path. Not imported from there because a show is not
 * a pack and the two having one id rule by coincidence is how a shared
 * helper quietly acquires a second caller's requirements.
 */
export function showId(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

function readAll(paths = {}) {
  const file = paths.shows;
  if (!file) return [];
  try {
    const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
    return Array.isArray(raw) ? raw : [];
  } catch {
    // No file yet, or one somebody has edited into nonsense. An empty shelf is
    // the right answer to both — a quizmaster ten minutes before a gig needs
    // the console to load, not a stack trace about JSON.
    return [];
  }
}

function writeAll(paths, shows) {
  const file = paths.shows;
  if (!file) throw new Error('This account has nowhere to keep its shows.');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  // Atomically, like the game state: a half-written shelf found after a crash
  // is worse than an old one.
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(shows, null, 2));
  fs.renameSync(tmp, file);
}

/**
 * ONE THING THE APP PLAYS — a quiz, or a bingo game.
 *
 * **The running order is QUIZ-ONLY WITHIN AN ITEM**, exactly as at launch: a
 * bingo pack has no rounds inside it on disk — it is a title and a track list
 * — so an order against one is a field that could only ever confuse the thing
 * reading it. That is a fact about bingo packs, not a limit on the evening,
 * which is why it lives down here on the item rather than on the show.
 */
function normaliseItem(raw = {}) {
  const kind = SHOW_KINDS.includes(raw.kind) ? raw.kind : 'quiz';
  const order = (kind === 'quiz' && Array.isArray(raw.order))
    ? raw.order
      .map((r) => ({ packId: String((r && r.packId) || ''), round: Number(r && r.round) }))
      .filter((r) => r.packId && Number.isInteger(r.round) && r.round >= 0)
      /*
       * THE SAME CEILING THE LAUNCH ENFORCES, imported rather than written out
       * again. A show allowed to hold more rounds than a night can play is a
       * show that saves cleanly on a Monday and is refused in a venue on a
       * Thursday — the limit stated in two places that disagree within a
       * month, which is the fault `MAX_NIGHT_ROUNDS` in the console already
       * has a test guarding against.
       */
      .slice(0, MAX_ROUNDS)
    : [];
  const packId = String(raw.packId || (order[0] && order[0].packId) || '').trim();
  if (!packId) return null;
  return { kind, packId, ...(order.length ? { order } : {}) };
}

/**
 * How many things one evening may be built from.
 *
 * A quiz, a bingo game, and room to change your mind. Not a technical limit —
 * a guard against a stuck drag, exactly like `MAX_ROUNDS`.
 */
export const MAX_ITEMS = 6;

/**
 * What a show is allowed to contain — a WHITELIST, field by field.
 *
 * The same shape as the two-screens rule's payload builders and for the same
 * reason: this object is written by a browser and read back into a launch, so
 * anything not named here is somebody adding a field to a request body and
 * hoping the launch route reads it. Spreading the input would opt every
 * future field in silently.
 */
export function normalise(raw = {}, now = Date.now()) {
  const name = String(raw.name || '').trim().slice(0, 60);
  if (!name) throw new Error('A show needs a name.');
  const id = String(raw.id || '').trim() || showId(name);
  if (!id) throw new Error('That name has no letters or numbers in it.');

  /*
   * A SHOW IS A LIST OF THINGS TO PLAY, AND THAT IS WHAT MAKES IT AN EVENING.
   *
   * It held ONE game to begin with, and the host killed that in a sentence:
   * *"defeats the point — you need to be able to save a show with all of the
   * rounds, venue info, and drop it onto the launch. Say you want to swap out
   * the music bingo after, you need to be able to do that independent of
   * removing the venue or other rounds."* He is right, and the failure is
   * exact: a "whole evening" that cannot hold the bingo that follows the quiz
   * is not the whole evening, it is the first half of one.
   *
   * **The venue and the settings stay on the SHOW; only what is played is a
   * list.** That is the whole of his second sentence — swapping the bingo must
   * not disturb the venue, the prizes or the quiz rounds, and it cannot,
   * because those are not in the item being swapped.
   *
   * **THE OLD ONE-GAME SHAPE STILL READS**, as a list of one. There is no
   * migration step and nothing to run: a show saved this morning has `kind`
   * and `packId` at the top level and arrives here as a single item.
   */
  const items = (Array.isArray(raw.items) && raw.items.length ? raw.items : [raw])
    .map(normaliseItem)
    .filter(Boolean)
    .slice(0, MAX_ITEMS);
  if (!items.length) throw new Error('A show needs something to play.');

  const shape = raw.shape && Number(raw.shape.rows) && Number(raw.shape.cols)
    ? { rows: Number(raw.shape.rows), cols: Number(raw.shape.cols) }
    : null;

  return {
    id,
    name,
    /*
     * THE FIRST ITEM IS ALSO WRITTEN AT THE TOP LEVEL, deliberately.
     *
     * Not a duplicate to keep in step — it is DERIVED here, on every save, so
     * it cannot drift. What it buys is that everything written against the
     * one-game shape keeps working unchanged, including a console that has not
     * been reloaded since the last deploy. The evening is `items`; `kind` and
     * `packId` are what it opens with.
     */
    kind: items[0].kind,
    packId: items[0].packId,
    ...(items[0].order ? { order: items[0].order } : {}),
    items,
    venue: String(raw.venue || '').trim().slice(0, 80),
    look: String(raw.look || '').slice(0, 40),
    lobbyGame: String(raw.lobbyGame || '').slice(0, 40),
    lobbySound: raw.lobbySound !== false,
    teamPlay: Boolean(raw.teamPlay),
    // Cleaned the same way `session.launch()` cleans it, so a saved night and
    // an accepted launch can never disagree about what the word means.
    teamMode: raw.teamMode === 'random' ? 'random' : 'assigned',
    online: Boolean(raw.online),
    shape,
    prizes: Math.max(0, Math.min(5, Number(raw.prizes) || 0)),
    /*
     * How many places the night recognises. Cleaned exactly as
     * `session.launch()` cleans it, for the reason `teamMode` above says: two
     * normalisers is how a saved night comes to carry a setting the engine
     * then silently drops. A show saved before this existed has none, and 0
     * means "not asked for", which the launch reads as the default of three.
     */
    winners: Math.max(0, Math.min(3, Number(raw.winners) || 0)),
    /*
     * WHAT HAPPENS IN THE GAPS — cleaned by the SAME function the launch
     * cleans it with, so a plan that a show would restore is exactly a plan a
     * launch would accept. Two normalisers is how a saved night comes to
     * carry a setting the engine then silently drops.
     */
    breaks: cleanPlan(raw.breaks),
    updated: now,
  };
}

/** Everything this room has built, most recently touched first. */
export function listShows(paths = {}) {
  return readAll(paths).slice().sort((a, b) => (b.updated || 0) - (a.updated || 0));
}

export function readShow(paths, id) {
  return readAll(paths).find((s) => s.id === String(id)) || null;
}

/**
 * Save one, replacing a show of the same id.
 *
 * The cap is checked only when this is a NEW show — editing the fortieth must
 * not be refused for being the fortieth.
 */
export function saveShow(paths, raw, now = Date.now()) {
  const show = normalise(raw, now);
  const all = readAll(paths);
  const at = all.findIndex((s) => s.id === show.id);
  if (at < 0 && all.length >= MAX_SHOWS) {
    throw new Error(`You have ${MAX_SHOWS} shows, which is as many as an account holds. Delete one first.`);
  }
  if (at < 0) all.push(show);
  else all[at] = show;
  writeAll(paths, all);
  return show;
}

export function deleteShow(paths, id) {
  const all = readAll(paths);
  const left = all.filter((s) => s.id !== String(id));
  if (left.length === all.length) throw new Error('There is no show by that name.');
  writeAll(paths, left);
  return true;
}

/**
 * What is wrong with this show TODAY — asked on the card, not at launch.
 *
 * The whole value of building a night in advance is finding out in advance
 * that it will not run, so this answers the one question a stored reference
 * can get wrong: is the pack still there. It takes a `has` function rather
 * than reading the library itself, because who owns what is the launch
 * route's business and this file must not grow a second opinion about it.
 *
 * @param {object} show
 * @param {Function} has  `(kind, packId) => boolean`
 * @returns {string[]} plain sentences, empty when it is fine
 */
export function showProblems(show, has) {
  // EVERY ITEM, not just the one it opens with — a show whose bingo has been
  // deleted is broken even though its quiz is fine, and finding that out at
  // half ten is exactly what building a night in advance is meant to prevent.
  const gone = [];
  for (const item of itemsOf(show)) {
    const ids = (item.order && item.order.length)
      ? [...new Set(item.order.map((r) => r.packId))]
      : [item.packId];
    for (const id of ids) if (!has(item.kind, id) && !gone.includes(id)) gone.push(id);
  }
  if (!gone.length) return [];
  return gone.length === 1
    ? [`There is no pack called ${gone[0]} any more.`]
    : [`These packs are gone: ${gone.join(', ')}.`];
}

// Re-exported so the one reader has one import path per runtime — the
// server asks shows.js, the browser asks show-parts.js, and there is still
// only one function.
export { itemsOf };
