/**
 * WRITE ROUTES — own-packs. Moved whole out of `handleWrite()` in server.js;
 * the body is unchanged, it is one of the functions the shell tries in order.
 */
import { FEATURES, MAX_OWN, config, countOwn, deleteOwn, importBingoPack, normaliseBingoPack, normaliseQuiz, paths, portraitPath, readPack, recueQuiz, roundPlan, saveOwn, validateBingoPack, validateQuiz } from './context.js';
import { readJson, sendJson } from './plumbing.js';
import { roomForHost } from './identity.js';
import { allowed } from './gates.js';
import { backUpOwnPack, changesTheLiveQuestion, packInUse, progressStream, reloadPackEverywhere, removeOwnPackBackup } from './helpers.js';

export async function writeOwnPacks(req, res, url, route) {
  /*
   * ---- a quizmaster's OWN packs
   *
   * Separate routes from `/api/quiz` and `/api/bingo` on purpose, and that is
   * the load-bearing bit. `changesTheLibrary()` in gates.js is a PATH test —
   * it cannot look inside a request and work out which of two libraries a pack
   * id belongs to. Sharing one route would mean either loosening the rule that
   * keeps subscribers out of the catalogue, or writing a second copy of it
   * somewhere with no test on it. Two prefixes, two rules, both testable.
   *
   * So: `/api/quiz` and `/api/bingo` write the CATALOGUE and stay the owner's.
   * `/api/mine/*` writes the room's own folder and can never touch the
   * catalogue — `saveOwn` and `deleteOwn` in own-packs.js take the room's own
   * directory and nothing else.
   *
   * They still do not GENERATE. There is no Claude call anywhere under here;
   * that is the owner's bill and the owner's house style.
   */
  /*
   * LAY OUT AN EMPTY QUIZ, in the shape they picked.
   *
   * The same rounds and counts the generator asks for, answered by hand — so a
   * quizmaster writing their own starts with the structure already right and
   * only has the words left to do. Building that shape in the editor by hand
   * is add-a-round, set-its-type, name-it, add-ten-questions before writing a
   * single question.
   *
   * **The placeholders are REAL TEXT, not blanks**, because `validateQuiz`
   * refuses a question with no prompt, a blank option or two identical ones —
   * and rightly, since those are the faults that reach a room. A quiz that
   * cannot be saved until it is finished could not be saved at all, so the
   * scaffold is valid from the first press and every line of it is meant to be
   * overwritten. An alphabet round takes no options at all, which is why it is
   * built from `answer` instead.
   */
  if (route === '/api/mine/quiz/scaffold' && req.method === 'POST') {
    if (!allowed(req, res, url, FEATURES.OWN_PACKS)) return true;
    const room = roomForHost(req, url);
    const body = await readJson(req, 64 * 1024);
    const title = String(body.title || '').trim().slice(0, 60);
    if (!title) return sendJson(res, 400, { error: 'A quiz needs a name.' }), true;

    // `roundPlan` is the whitelist and the clamp, in one place — the same one
    // the generator uses, so a typo cannot quietly become a round of general
    // knowledge here and not there.
    const plan = roundPlan(body.rounds);
    if (!plan.length) return sendJson(res, 400, { error: 'Pick at least one round.' }), true;

    const quiz = {
      /*
       * The id is the title slugged, the same as every generated pack — so a
       * quiz called "The Crown, Christmas 2026" files itself sensibly and
       * `saveOwn` refuses anything that would not make a filename.
       */
      id: title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'my-quiz',
      title,
      mine: true,
      rounds: plan.map((r, ri) => ({
        id: `r${ri + 1}`,
        type: r.type,
        title: {
          image: 'Whose face is this?',
          intro: 'Name that intro',
          multi: 'Pick them all',
          alphabet: 'First letter',
          breakout: 'Bonus round',
        }[r.type] || `Round ${ri + 1}`,
        ...(r.type === 'image' ? { reveal: 'mix' } : {}),
        questions: Array.from({ length: r.count }, (_, qi) => ({
          id: `r${ri + 1}q${qi + 1}`,
          prompt: `Question ${qi + 1} — write it here`,
          // A breakout question has no answer key at all — see
          // `isBreakoutPack()` in `src/quizzes.js` — so it is a prompt and
          // nothing else, same as `alphabet` is an answer and nothing else.
          ...(r.type === 'breakout'
            ? {}
            : r.type === 'alphabet'
            ? { answer: `Answer ${qi + 1}` }
            : {
              // Six for a pick-them-all round, four for everything else —
              // that is the round type, not a preference. See optionsFor().
              options: Array.from({ length: r.type === 'multi' ? 6 : 4 },
                (_, oi) => `Option ${'ABCDEF'[oi]}`),
              ...(r.type === 'multi' ? { correctIndexes: [0, 1] } : { correctIndex: 0 }),
              /*
               * A picture question is invalid without an image, so the
               * scaffold names one the same way the generator does — off the
               * right answer. It resolves to a lettered placeholder card
               * today, and once the real name is written in, "Make the
               * pictures" repoints the pack as it draws. Same path either way,
               * which is what makes a pack rehearsable before a penny is
               * spent.
               */
              ...(r.type === 'image' ? { image: portraitPath(`Option A ${ri + 1}-${qi + 1}`) } : {}),
            }),
        })),
      })),
    };

    const clean = normaliseQuiz(quiz, quiz.id);
    const problems = validateQuiz(clean);
    if (problems.length) return sendJson(res, 400, { error: 'Could not lay that out', problems }), true;
    try {
      saveOwn('quiz', clean.id, clean, { config, paths: room.paths });
    } catch (err) {
      return sendJson(res, 400, { error: err.message }), true;
    }
    await backUpOwnPack(room, 'quiz', clean.id, clean);
    return sendJson(res, 200, { ok: true, id: clean.id }), true;
  }

  if (route === '/api/mine/quiz' && req.method === 'POST') {
    if (!allowed(req, res, url, FEATURES.OWN_PACKS)) return true;
    const room = roomForHost(req, url);
    const body = await readJson(req, 4 * 1024 * 1024);
    const quiz = normaliseQuiz(body, body.id);
    const problems = validateQuiz(quiz);
    if (problems.length) return sendJson(res, 400, { error: 'Quiz is not valid', problems }), true;
    /*
     * The same question a quizmaster's own pack deserves — and MORE likely
     * here, because the person editing it is the person holding the phone
     * that is running it. Scoped to their own room, so it can never report
     * anything about somebody else's night.
     */
    const clash = body.confirmLive ? null : changesTheLiveQuestion('quiz', quiz.id, quiz, room);
    if (clash) return sendJson(res, 409, { error: 'onScreenNow', live: clash }), true;
    // The same re-pointing as the catalogue save — see the note there. It runs
    // AFTER the live-question check, so a refused save costs no lookups.
    let cued = { matched: [], missed: [], skipped: '' };
    try {
      cued = await recueQuiz(quiz, readPack('quiz', quiz.id, { config, paths: room.paths }));
    } catch { /* a save is never lost over a lookup */ }
    try {
      saveOwn('quiz', quiz.id, quiz, { config, paths: room.paths });
    } catch (err) {
      return sendJson(res, 400, { error: err.message }), true;
    }
    // If they were playing it, pick the edit up live — same as the catalogue.
    reloadPackEverywhere(quiz.id);
    const backup = await backUpOwnPack(room, 'quiz', quiz.id, JSON.stringify(quiz, null, 2) + '\n');
    return sendJson(res, 200, {
      ok: true, id: quiz.id, backedUp: backup.ok, backupError: backup.error, cued,
    }), true;
  }

  if (route.startsWith('/api/mine/quiz/') && req.method === 'DELETE') {
    if (!allowed(req, res, url, FEATURES.OWN_PACKS)) return true;
    const room = roomForHost(req, url);
    const id = decodeURIComponent(route.slice('/api/mine/quiz/'.length));
    // Only THEIR room — two quizmasters can each have one called `christmas`,
    // and one of them playing theirs is no reason to refuse the other.
    if (packInUse('quiz', id, room)) {
      return sendJson(res, 400, { error: 'That quiz is loaded in a game right now.' }), true;
    }
    try {
      deleteOwn('quiz', id, { config, paths: room.paths });
    } catch (err) {
      return sendJson(res, 404, { error: err.message }), true;
    }
    await removeOwnPackBackup(room, 'quiz', id);
    return sendJson(res, 200, { ok: true }), true;
  }

  if (route === '/api/mine/bingo' && req.method === 'POST') {
    if (!allowed(req, res, url, FEATURES.OWN_PACKS)) return true;
    const room = roomForHost(req, url);
    const body = await readJson(req, 4 * 1024 * 1024);
    const pack = normaliseBingoPack(body, body.id);
    const problems = validateBingoPack(pack);
    if (problems.length) return sendJson(res, 400, { error: 'That pack is not valid', problems }), true;
    try {
      saveOwn('bingo', pack.id, pack, { config, paths: room.paths });
    } catch (err) {
      return sendJson(res, 400, { error: err.message }), true;
    }
    const backup = await backUpOwnPack(room, 'bingo', pack.id, JSON.stringify(pack, null, 2) + '\n');
    return sendJson(res, 200, {
      ok: true, id: pack.id, backedUp: backup.ok, backupError: backup.error,
    }), true;
  }

  if (route.startsWith('/api/mine/bingo/') && req.method === 'DELETE') {
    if (!allowed(req, res, url, FEATURES.OWN_PACKS)) return true;
    const room = roomForHost(req, url);
    const id = decodeURIComponent(route.slice('/api/mine/bingo/'.length));
    if (packInUse('bingo', id, room)) {
      return sendJson(res, 400, { error: 'That pack is loaded in a game right now. Launch something else first.' }), true;
    }
    try {
      deleteOwn('bingo', id, { config, paths: room.paths });
    } catch (err) {
      return sendJson(res, 404, { error: err.message }), true;
    }
    await removeOwnPackBackup(room, 'bingo', id);
    return sendJson(res, 200, { ok: true }), true;
  }

  /*
   * Pasting a track list into a bingo game of their own.
   *
   * The same importer the owner's catalogue uses, pointed at their folder —
   * with the no-repeats memory switched OFF in both directions. That history is
   * the owner's generator's record of what IT has already used: reading it here
   * would silently drop songs out of a list a subscriber pasted deliberately,
   * and writing to it would make the owner's next generated pack avoid tracks
   * it has never played.
   */
  if (route === '/api/mine/import' && req.method === 'POST') {
    if (!allowed(req, res, url, FEATURES.OWN_PACKS)) return true;
    const room = roomForHost(req, url);
    /*
     * Bigger than it was, because a set can now carry a picture per slide.
     * Each is capped at 300KB by `cleanSlideImage`, so this is the envelope
     * for several of them plus the words rather than a licence for one huge
     * one.
     */
    const body = await readJson(req, 4 * 1024 * 1024);
    const stream = progressStream(res);
    const log = stream.log;
    try {
      if (countOwn(room.paths) >= MAX_OWN) {
        throw new Error(`You have ${MAX_OWN} of your own packs, which is as many as an account holds. Delete one first.`);
      }
      const result = await importBingoPack({
        config,
        dir: room.paths.ownBingo,
        remember: false,
        avoidMonths: 0,
        playlistUrl: String(body.playlistUrl || ''),
        text: String(body.text || ''),
        title: String(body.title || '').slice(0, 80) || undefined,
        cardSize: [3, 4, 5].includes(Number(body.cardSize)) ? Number(body.cardSize) : 4,
        log,
      });
      const backup = await backUpOwnPack(room, 'bingo', result.pack.id, JSON.stringify(result.pack, null, 2) + '\n');
      log(backup.ok
        ? 'backed up — this one survives a restart'
        : `saved here, but NOT backed up: ${backup.error || 'no packs repository set up'}`);
      log('DONE ' + JSON.stringify({
        id: result.pack.id,
        title: result.pack.title,
        trackCount: result.pack.tracks.length,
        mine: true,
        backedUp: backup.ok,
      }));
    } catch (err) {
      log('ERROR ' + err.message);
    }
    stream.end();
    return true;
  }

  return false;
}
