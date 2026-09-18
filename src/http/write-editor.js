/**
 * WRITE ROUTES — editor. Moved whole out of `handleWrite()` in server.js;
 * the body is unchanged, it is one of the functions the shell tries in order.
 */
import { config, deleteAdvertPack, deleteFile, deleteQuiz, githubConfigured, loadQuiz, normaliseAdvertPack, normaliseQuiz, recueQuiz, reviewWarnings, saveAdvertPack, saveQuiz, setWarningChecked, validateAdvertPack, validateQuiz } from './context.js';
import { readJson, sendJson } from './plumbing.js';
import { roomForHost } from './identity.js';
import { backUp, backUpAdverts, changesTheLiveQuestion, deleteAdvertBackup, packInUse, reloadPackEverywhere } from './helpers.js';

export async function writeEditor(req, res, url, route) {
  // ---- the editor
  // Check a quiz without saving it, so problems can be seen mid-edit.
  if (route === '/api/quiz/__validate' && req.method === 'POST') {
    const body = await readJson(req, 4 * 1024 * 1024);
    return sendJson(res, 200, { problems: validateQuiz(normaliseQuiz(body, body.id)) }), true;
  }

  /*
   * Advertising slides: save and delete a venue's set.
   *
   * Backed up like a quiz pack, because a venue's offer is worth having again
   * next week and losing it to a redeploy would make the feature useless as a
   * thing to sell.
   */
  if (route.startsWith('/api/advert/') && (req.method === 'PUT' || req.method === 'DELETE')) {
    const id = decodeURIComponent(route.slice('/api/advert/'.length));
    const advertRoom = roomForHost(req, url);
    if (req.method === 'DELETE') {
      try {
        deleteAdvertPack(advertRoom.paths.adverts, id);
      } catch (err) {
        return sendJson(res, 404, { error: err.message }), true;
      }
      await deleteAdvertBackup(advertRoom, id);
      return sendJson(res, 200, { ok: true }), true;
    }

    const body = await readJson(req, 512 * 1024);
    const problems = validateAdvertPack(body);
    if (problems.length) return sendJson(res, 400, { error: 'Advert set is not valid', problems }), true;
    saveAdvertPack(advertRoom.paths.adverts, id, body);
    const backup = await backUpAdverts(
      advertRoom,
      id,
      JSON.stringify(normaliseAdvertPack(body, id), null, 2) + '\n',
    );
    return sendJson(res, 200, { ok: true, backedUp: backup.ok, backupError: backup.error }), true;
  }

  // Ticking a review flag off as you read a quiz through. Deliberately its own
  // endpoint rather than part of the Save button: a tick records that YOU have
  // looked at something, and losing it because you shut the panel would mean
  // reading the same twenty flags again.
  if (route.startsWith('/api/quiz/') && route.endsWith('/checked') && req.method === 'POST') {
    const id = decodeURIComponent(route.slice('/api/quiz/'.length, -'/checked'.length));
    const body = await readJson(req, 16 * 1024);
    let quiz;
    try {
      quiz = loadQuiz(config.quizDir, id);
    } catch {
      return sendJson(res, 404, { error: 'No such quiz' }), true;
    }
    const found = setWarningChecked(quiz, String(body.questionId || ''), String(body.warning || ''), body.checked !== false);
    if (!found) return sendJson(res, 409, { error: 'That question is not in this quiz any more. Reopen it.' }), true;

    // Annotating, not editing — see saveQuiz. A broken question elsewhere in
    // the quiz must not stop you recording that you have read this one.
    saveQuiz(config.quizDir, id, quiz, { allowProblems: true });
    // Back up in the background — a tick is not worth making you wait for
    // GitHub, and the next save will carry it anyway if this one misses.
    const backup = await backUp(`quizzes/${id}.json`, JSON.stringify(normaliseQuiz(quiz, id), null, 2) + '\n', `Review notes: ${quiz.title || id}`);
    return sendJson(res, 200, { ok: true, backedUp: backup.ok, warnings: reviewWarnings(quiz) }), true;
  }

  if (route.startsWith('/api/quiz/')) {
    const id = decodeURIComponent(route.slice('/api/quiz/'.length));
    if (req.method === 'PUT') {
      const body = await readJson(req, 4 * 1024 * 1024);
      const problems = validateQuiz(body);
      if (problems.length) return sendJson(res, 400, { error: 'Quiz is not valid', problems }), true;
      /*
       * NOT A REFUSAL — a question asked once. Somebody telling the host a
       * question is wrong DURING a night is the case this whole feature
       * exists for, so blocking would break the thing it is meant to serve.
       * It asks only about the question on the screen at this exact second,
       * and only when the save actually changes it.
       */
      const clash = body.confirmLive ? null : changesTheLiveQuestion('quiz', id, body);
      if (clash) return sendJson(res, 409, { error: 'onScreenNow', live: clash }), true;
      delete body.confirmLive;
      saveQuiz(config.quizDir, id, body);
      // If a running quiz was the one just edited, pick up the changes live —
      // in every room playing it, not just the editor's own.
      reloadPackEverywhere(id);
      const backup = await backUp(`quizzes/${id}.json`, JSON.stringify(normaliseQuiz(body, id), null, 2) + '\n', `Edit quiz: ${body.title || id}`);
      return sendJson(res, 200, { ok: true, backedUp: backup.ok, backupError: backup.error }), true;
    }
    if (req.method === 'DELETE') {
      if (packInUse('quiz', id)) {
        return sendJson(res, 400, { error: 'That quiz is loaded in a game right now.' }), true;
      }
      // A pack that is not there is a 404, not a 500 with the server's own
      // filesystem path in the message. Two people deleting the same pack from
      // two consoles is the ordinary way to arrive here.
      try {
        deleteQuiz(config.quizDir, id);
      } catch {
        return sendJson(res, 404, { error: 'No such quiz' }), true;
      }
      if (githubConfigured()) await deleteFile(`quizzes/${id}.json`, `Delete quiz: ${id}`);
      return sendJson(res, 200, { ok: true }), true;
    }
  }

  if (route === '/api/quiz' && req.method === 'POST') {
    const body = await readJson(req, 4 * 1024 * 1024);
    const quizToSave = normaliseQuiz(body, body.id);
    const problems = validateQuiz(quizToSave);
    if (problems.length) return sendJson(res, 400, { error: 'Quiz is not valid', problems }), true;
    /*
     * A CREATE MAY NOT LAND ON A PACK THAT ALREADY EXISTS.
     *
     * This is the CREATE route — an edit comes back through
     * `PUT /api/quiz/<id>` — so a POST naming an id already on disk is somebody
     * typing a title that slugs to it, which the editor's *New quiz* did with a
     * one-round, one-question stub in hand. One press of Save and rule 11 ran
     * backwards: there is exactly one file per catalogue pack and every
     * subscriber reads it, so a three-round distributed quiz became a single
     * blank question for everyone holding it, with `reloadPackEverywhere()`
     * pushing the wreck into a game already running.
     *
     * The browser refuses it first, off the picker it already has. This is the
     * belt to that pair of braces, because the browser's list is what the
     * browser was told and the file on disk is the truth.
     *
     * `replace: true` is the way through, for a caller that means it — and
     * nothing in the app sends it today.
     */
    // `loadQuiz()` THROWS when the file is not there, which is the ordinary
    // case here — a create — so it is asked inside a try rather than tested
    // for truthiness.
    let already = false;
    try { already = Boolean(loadQuiz(config.quizDir, quizToSave.id)); } catch { already = false; }
    if (!body.replace && already) {
      return sendJson(res, 409, {
        error: `There is already a pack called ${quizToSave.id}. Give yours a different name.`,
      }), true;
    }
    /*
     * RE-POINT ANY CUE WHOSE TRACK WAS EDITED, before it is written.
     *
     * The words and the `spotifyUri` are two halves of one fact, and the
     * editor only ever wrote the words — so a corrected track read right and
     * played the old song. See `src/recue.js`. It reads the version on disk to
     * work out what actually changed, and never fails the save.
     */
    let cued = { matched: [], missed: [], skipped: '' };
    try {
      cued = await recueQuiz(quizToSave, loadQuiz(config.quizDir, quizToSave.id));
    } catch { /* a save is never lost over a lookup */ }
    saveQuiz(config.quizDir, quizToSave.id, quizToSave);
    return sendJson(res, 200, { ok: true, id: quizToSave.id, cued }), true;
  }

  return false;
}
