/**
 * A quizmaster's OWN packs — the ones they wrote, which are theirs and not
 * yours.
 *
 * The catalogue in `quizzes/` and `bingo/` is the owner's: written to a house
 * style, checked, and sold. That does not change. What this adds is a second
 * library per room, holding whatever that quizmaster has written themselves.
 *
 * ---
 *
 * **THE OWNER CANNOT READ IT, AND THAT IS THE POINT.** A subscriber's own
 * material is their intellectual property, not stock in somebody else's shop,
 * and every other quizmaster will assume the worst about a competitor who can
 * read their questions. So this is not "the console does not draw it" — the
 * API has to refuse, which is the opposite direction to every other gate in
 * the app.
 *
 * The way it refuses is worth understanding, because it is what makes the rule
 * hard to break by accident later: **there is no room parameter anywhere.**
 * Every route works out the room from WHO YOU ARE (`roomForHost` in server.js,
 * which calls `roomIdFor`), and a room's own packs live under that room's own
 * folder. An owner asking for a pack id resolves against the HOUSE room, finds
 * nothing, and falls through to the catalogue. There is no id they can send,
 * and no query string they can add, that reaches somebody else's folder — the
 * same property that already stops one quizmaster driving another's game.
 *
 * The one way in is **support access**, which they switch on, which expires on
 * its own, and which writes down what was looked at for them to read. This is
 * the first feature that genuinely needed it.
 *
 * ---
 *
 * **What this honestly is, and is not.** The owner runs the server, the disk
 * and the backups, and the server has to be able to read a quiz to put it on a
 * projector — so it cannot be encrypted from the person hosting it, and saying
 * otherwise to a subscriber would be a lie with a log file next to it. This is
 * access control and an audit trail, which is what every hosted service has.
 * The honest pitch is "the app will not let me in unless you let me, and here
 * is the log", never "I cannot see it".
 *
 * ---
 *
 * **They still do not generate.** Claude writing a quiz is the owner's bill and
 * the owner's house style, and that is the arrangement. They write or paste;
 * the app stores, validates and plays. Nothing in this file calls a model.
 */

import fs from 'node:fs';
import path from 'node:path';

import { listQuizzes, loadQuiz, saveQuiz, deleteQuiz, safeQuizFile } from './quizzes.js';
import { listBingoPacks, loadBingoPack, saveBingoPack, deleteBingoPack, safePackFile } from './library.js';
import { normaliseBingoPack } from './bingo.js';

export const OWN_KINDS = ['quiz', 'bingo'];

/**
 * How many a quizmaster may keep.
 *
 * Not a tier lever and not meanness — it is a cap on how much of the owner's
 * disk one account can fill, which on a free instance is a real thing. It is
 * deliberately far above what anybody writes in a year: a host who has written
 * sixty of their own quizzes has a different conversation coming anyway.
 */
export const MAX_OWN = 60;

/**
 * Where a room keeps its own packs.
 *
 * `paths` comes from `rooms.pathsFor()`, so this file never has to know that
 * rooms exist or where they are — the same trick the archive and the advert
 * slides use.
 */
export function ownDir(paths = {}, kind) {
  if (kind === 'quiz') return paths.ownQuizzes || '';
  if (kind === 'bingo') return paths.ownBingo || '';
  return '';
}

function fileName(kind, id) {
  return kind === 'quiz' ? safeQuizFile(id) : safePackFile(id);
}

/** Is this id one of theirs, as opposed to one of the catalogue's? */
export function isOwnPack(kind, id, paths) {
  const dir = ownDir(paths, kind);
  if (!dir || !id) return false;
  try {
    return fs.existsSync(path.join(dir, fileName(kind, id)));
  } catch {
    // A bad id (path traversal, an empty string) throws rather than matching.
    return false;
  }
}

/** Is this id one of the CATALOGUE's? Asked before letting somebody use it. */
export function inCatalogue(kind, id, config) {
  const dir = kind === 'quiz' ? config.quizDir : config.bingoDir;
  try {
    return fs.existsSync(path.join(dir, fileName(kind, id)));
  } catch {
    return false;
  }
}

/**
 * Which folder this pack id lives in, for THIS room.
 *
 * Own first, catalogue second. That ordering is what lets every existing read
 * route carry on taking a bare id: a quizmaster asking for one of theirs gets
 * theirs, and everybody asking for a catalogue pack gets the same file they
 * always did.
 *
 * A pack that is in neither resolves to the catalogue, so the caller's own
 * "no such pack" error is what comes back rather than a confusing one from
 * here.
 */
export function packDir(kind, id, { config, paths = {} }) {
  const own = ownDir(paths, kind);
  if (own && isOwnPack(kind, id, paths)) return { dir: own, mine: true };
  return { dir: kind === 'quiz' ? config.quizDir : config.bingoDir, mine: false };
}

/** One of their own packs, or one of the catalogue's, whichever this id is. */
export function readPack(kind, id, ctx) {
  const { dir, mine } = packDir(kind, id, ctx);
  const pack = kind === 'quiz'
    ? loadQuiz(dir, id)
    : normaliseBingoPack(loadBingoPack(dir, id), id);
  return { pack, mine };
}

/**
 * Everything this room has written itself, summarised the same way the
 * catalogue is — so the console can put both in one grid and mark which is
 * which, rather than growing a second kind of pack card.
 */
export function listOwn(paths = {}) {
  const quizDir = ownDir(paths, 'quiz');
  const bingoDir = ownDir(paths, 'bingo');
  return {
    quizzes: quizDir ? listQuizzes(quizDir).map((q) => ({ ...q, kind: 'quiz', mine: true })) : [],
    bingo: bingoDir ? listBingoPacks(bingoDir).map((b) => ({ ...b, mine: true })) : [],
  };
}

export function countOwn(paths = {}) {
  const own = listOwn(paths);
  return own.quizzes.length + own.bingo.length;
}

/**
 * Save one of theirs.
 *
 * Two refusals, and both say why rather than failing quietly:
 *
 * - **An id already in the catalogue is refused.** Otherwise their pack would
 *   shadow it for them — `packDir` looks in their folder first — and a Launch
 *   that quietly played a different quiz from the one everybody else sees is
 *   exactly the sort of surprise this codebase exists to avoid. Renaming is
 *   one field; a silently shadowed pack is a mystery.
 * - **The cap.** Said as a number they can act on, not as a bare failure.
 *
 * @param {object} ctx  { config, paths }
 * @param {object} [opts]
 * @param {boolean} [opts.allowProblems]  write it even if it does not validate
 */
export function saveOwn(kind, id, pack, ctx, { allowProblems = false } = {}) {
  if (!OWN_KINDS.includes(kind)) throw new Error(`Unknown pack kind: ${kind}`);
  const dir = ownDir(ctx.paths, kind);
  if (!dir) throw new Error('This account has nowhere to keep its own packs.');

  const replacing = isOwnPack(kind, id, ctx.paths);
  if (!replacing && inCatalogue(kind, id, ctx.config)) {
    throw new Error(`There is already a pack called "${id}" in the catalogue. Give yours a different name.`);
  }
  if (!replacing && countOwn(ctx.paths) >= MAX_OWN) {
    throw new Error(`You have ${MAX_OWN} of your own packs, which is as many as an account holds. Delete one first.`);
  }

  if (kind === 'quiz') saveQuiz(dir, id, pack, { allowProblems });
  else saveBingoPack(dir, id, pack);
  return { dir, replacing };
}

/** Only ever one of theirs — this cannot reach the catalogue at all. */
export function deleteOwn(kind, id, ctx) {
  if (!isOwnPack(kind, id, ctx.paths)) {
    throw new Error('That is not one of your own packs.');
  }
  const dir = ownDir(ctx.paths, kind);
  if (kind === 'quiz') deleteQuiz(dir, id);
  else deleteBingoPack(dir, id);
  return true;
}

/**
 * Where this pack is filed in the backup.
 *
 * Under the ROOM, so one subscriber's material is one folder — which is what
 * makes "these are Rob's, and only Rob's" a thing you can see rather than a
 * thing you have to trust. See `backUpOwnPack` in server.js for which repo,
 * and why it is deliberately not the one holding the owner's own books.
 */
export function backupPath(roomId, kind, id) {
  return `packs/${String(roomId)}/${kind}/${fileName(kind, id)}`;
}
