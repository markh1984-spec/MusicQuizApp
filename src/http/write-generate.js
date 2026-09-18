/**
 * WRITE ROUTES — generate. Moved whole out of `handleWrite()` in server.js;
 * the body is unchanged, it is one of the functions the shell tries in order.
 */
import { FEATURES, TOPICAL_DAYS, TOPICAL_ROUNDS, artProvider, buildIntroPlaylists, claudeAsker, config, fs, generateBingoPack, generateImages, generateQuizPack, githubConfigured, imageStatus, importBingoPack, importIntroRound, loadQuiz, normaliseQuiz, path, roundPlan, saveQuiz, spend, spendRecorder, themeSlug, topicalNaming } from './context.js';
import { readJson } from './plumbing.js';
import { allowed } from './gates.js';
import { backUp, backUpHistory, backUpMany, backUpSpend, progressStream, reloadPackEverywhere } from './helpers.js';

export async function writeGenerate(req, res, url, route) {
  // ---- one button: theme in, playable bingo game out.
  // Generation takes a while (Claude, then a Spotify lookup per track), so
  // this streams progress lines as it goes rather than leaving the console
  // staring at a spinner with no idea whether it is working.
  if (route === '/api/generate/bingo' && req.method === 'POST') {
    if (!allowed(req, res, url, FEATURES.GENERATE)) return true;
    const body = await readJson(req);
    const stream = progressStream(res);
    const log = stream.log;
    try {
      const result = await generateBingoPack({
        config,
        theme: String(body.theme || '').slice(0, 200),
        trackCount: Math.min(90, Math.max(9, Number(body.trackCount) || 40)),
        cardSize: [3, 4, 5].includes(Number(body.cardSize)) ? Number(body.cardSize) : 4,
        avoidMonths: Math.min(24, Math.max(0, Number(body.avoidMonths ?? 3))),
        log,
        // Filed against the pack id it is going to have, so a cost always has
        // a subject — "what did the Disco pack cost" is the question that
        // decides what a pack is worth.
        onSpend: spendRecorder(spend, { packId: body.id || themeSlug(String(body.theme || '')) }),
      });
      backUpSpend();
      const backup = await backUp(
        `bingo/${result.pack.id}.json`,
        JSON.stringify(result.pack, null, 2) + '\n',
        `Add bingo pack: ${result.pack.title}`,
        log,
      );
      const history = await backUpHistory(log);
      log('DONE ' + JSON.stringify({
        id: result.pack.id,
        title: result.pack.title,
        trackCount: result.pack.tracks.length,
        playlist: result.playlist ? result.playlist.url : null,
        playlistError: result.playlistError || null,
        backedUp: backup.ok,
        // Reported separately from the pack's own backup. They can differ, and
        // when they do it is this one that matters: Claude in the browser reads
        // the pushed history to decide what NOT to pick, so a history that
        // stayed here means the next round can repeat these songs.
        historyBackedUp: history.ok,
      }));
    } catch (err) {
      log('ERROR ' + err.message);
    }
    stream.end();
    return true;
  }

  // Same shape as the bingo generator: streams progress while it works,
  // because three rounds of Claude takes the best part of a minute.
  if (route === '/api/generate/quiz' && req.method === 'POST') {
    if (!allowed(req, res, url, FEATURES.GENERATE)) return true;
    const body = await readJson(req);
    const stream = progressStream(res);
    const log = stream.log;
    try {
      // Whitelisting is roundPlan's job now, and it is done against
      // ROUND_TYPES rather than a list written out here. It WAS written out
      // here, and "multi" was added to the app months later — so the console
      // offered the round, sent it, and this quietly dropped it on the floor.
      // A quiz came back with the tickbox ignored and nothing saying why.
      //
      // Each entry may be a bare type name or { type, count }: the console
      // sends a count per round now, because "fifteen general knowledge and
      // five pictures" is a normal quiz and "ten of everything" is not.
      const asked = roundPlan(body.rounds, Number(body.perRound) || 10);
      /*
       * The topical quiz is a SHAPE, decided here rather than in the browser.
       *
       * The console sends one flag and nothing else. Twenty news, ten music,
       * ten evergreen — plus the name, which is the date, and the fortnight it
       * is worth running for — all live in generate-quiz.js, so a curl call
       * and a button press produce the same pack and there is one thing to
       * test rather than two that can drift.
       */
      const topical = Boolean(body.topical);
      const hard = Boolean(body.hard);
      const naming = topical ? topicalNaming(Date.now(), { hard }) : null;
      const rounds = topical ? TOPICAL_ROUNDS : (asked.length ? asked : ['text', 'image', 'intro']);
      const result = await generateQuizPack({
        config,
        theme: topical ? naming.theme : String(body.theme || '').slice(0, 200),
        ...(topical ? { id: naming.id, title: naming.title, freshDays: TOPICAL_DAYS } : {}),
        rounds,
        perRound: Math.min(30, Math.max(1, Number(body.perRound) || 10)),
        hard,
        // Always checked. The console deliberately offers no way to skip it —
        // an option that only ever makes the questions worse is a footgun on a
        // panel used in a hurry.
        check: true,
        log,
        onSpend: spendRecorder(spend, { packId: topical ? naming.id : (body.id || themeSlug(String(body.theme || ''))) }),
      });
      backUpSpend();
      const backup = await backUp(
        `quizzes/${result.quiz.id}.json`,
        JSON.stringify(result.quiz, null, 2) + '\n',
        `Add quiz: ${result.quiz.title}`,
        log,
      );
      /*
       * THE PICTURES ARE DRAWN AS PART OF WRITING THE QUIZ.
       *
       * *"When I make an image round I want to click one button and have 10
       * images generated with varied effects without having to faff or find
       * another button. It just needs to work."* Right — a picture round is
       * not finished until it has pictures, and leaving them behind a second
       * press on a second panel is the app knowing what you want and making
       * you ask for it.
       *
       * **IT CAN NEVER LOSE THE QUIZ.** By the time this runs the generation
       * is minutes and real money deep, and the pack is already saved and
       * backed up above. So the whole thing is wrapped: a supplier having a
       * bad morning, a missing key or a refusal leaves the pack exactly as it
       * was, with placeholder art and a line in the log saying so. Same rule
       * as the Spotify playlist, which is the last and least important step of
       * a bingo pack and used to throw away sixty resolved tracks when it
       * failed.
       *
       * The effects are already varied without anything here: a generated
       * picture round carries `reveal: 'mix'`, so the four rotate by question
       * position. That is a separate fix and this does not touch it.
       */
      let drew = null;
      if (result.needsImages && artProvider()) {
        try {
          log('Drawing the pictures…');
          const saved = loadQuiz(config.quizDir, result.quiz.id);
          /*
           * COLLECTED HERE, PUSHED ONCE BELOW — never a commit per picture.
           * Ten portraits used to be ten commits threaded in between the ten
           * Google calls, at two round trips each, which is what stopped a
           * round at seven of ten. See `putFiles`.
           */
          const drawn = [];
          const art = await generateImages({
            quiz: saved,
            imageDir: config.imageDir,
            provider: artProvider(),
            log,
            onFile: (name, bytes) => { drawn.push({ path: `images/${name}`, contents: bytes }); },
            onSpend: spendRecorder(spend, { packId: saved.id }),
          });
          await backUpMany(drawn, `Round 2 pictures: ${saved.title}`, log);
          /*
           * `generateImages` REPOINTS the pack as it goes — a pack written
           * before the shared portrait library moves onto it here — so the
           * quiz has to be saved again when it does. `allowProblems`, the same
           * as ticking a review flag: one bad question elsewhere must not stop
           * the artwork being recorded.
           */
          if ((art.repointed || []).length) {
            saveQuiz(config.quizDir, saved.id, saved, { allowProblems: true });
            await backUp(`quizzes/${saved.id}.json`, JSON.stringify(saved, null, 2) + '\n',
              `Pictures: ${saved.title}`, () => {});
          }
          backUpSpend();
          drew = { made: (art.made || []).length, reused: (art.reused || []).length, failed: art.failed || [] };
        } catch (err) {
          // Said out loud rather than swallowed: a round of placeholders that
          // nobody mentioned is the app looking like it worked.
          log('The pictures could not be drawn: ' + err.message);
          drew = { made: 0, reused: 0, failed: [], error: err.message };
        }
      }

      log('DONE ' + JSON.stringify({
        id: result.quiz.id,
        title: result.quiz.title,
        rounds: result.quiz.rounds.length,
        questionCount: result.quiz.rounds.reduce((n, r) => n + r.questions.length, 0),
        problems: result.problems,
        // What was drawn, if anything. `needsImages` stays as it was so a pack
        // whose artwork failed still says it wants some.
        drew,
        needsImages: result.needsImages,
        backedUp: backup.ok,
        checked: result.checked,
        rejected: result.rejected.length,
        unchecked: result.unchecked || [],
        // Rounds the WRITER could not fill — a different failure from the
        // checker binning things, and the one that reads as success if it is
        // not said out loud.
        short: result.short || [],
        // A topical pack only. How much of the web it read, and how long it is
        // worth running — both of which the console says on the banner.
        searches: result.searches || 0,
        sources: result.sources || [],
        freshUntil: result.freshUntil || null,
      }));
    } catch (err) {
      log('ERROR ' + err.message);
    }
    stream.end();
    return true;
  }

  /*
   * Round 2 artwork.
   *
   * Streams like the other generators, because ten real portraits is the best
   * part of a minute and you are watching money being spent.
   *
   * Each picture is backed up the moment it lands rather than all at the end:
   * if the run dies halfway, the ones already paid for are safe.
   */
  if (route === '/api/generate/images' && req.method === 'POST') {
    if (!allowed(req, res, url, FEATURES.ARTWORK)) return true;
    const body = await readJson(req);
    const stream = progressStream(res);
    const log = stream.log;
    try {
      const id = String(body.quizId || '');
      const quiz = loadQuiz(config.quizDir, id);
      /*
       * "real" means whichever supplier is actually configured, worked out
       * HERE rather than taken from the browser.
       *
       * The console used to send the literal string "openai", which made a
       * request body the thing that chose who gets billed — the same shape of
       * hole `POST /api/quiz` had, and it would have quietly kept calling a
       * dead OpenAI account after the switch to Google. The old value is still
       * accepted so a stale page in somebody's tab does not stop working.
       */
      const asked = String(body.provider || '');
      const provider = asked === 'placeholder' || !asked ? 'placeholder' : (artProvider() || 'placeholder');

      const drawn = [];
      const result = await generateImages({
        quiz,
        imageDir: config.imageDir,
        provider,
        only: String(body.only || ''),
        force: Boolean(body.force),
        style: String(body.style || ''),
        quality: String(body.quality || ''),
        log,
        // Collected, then pushed as ONE commit below — see the note at the
        // other call site and `putFiles`.
        onFile: (name, bytes) => { drawn.push({ path: `images/${name}`, contents: bytes }); },
        // Filed against the QUIZ that asked for the picture, even though the
        // portrait itself is shared. That is the honest attribution: this is
        // the pack that paid for it, and the next one to want that musician
        // gets it free — which is exactly the saving the ledger should show.
        onSpend: spendRecorder(spend, { packId: id }),
      });
      await backUpMany(drawn, `Round 2 pictures: ${quiz.title || id}`, log);
      backUpSpend();

      // Questions moved onto the shared portrait library have to be written
      // back, or the pack still points at its old per-quiz filename and the
      // sharing buys nothing. `allowProblems` for the same reason ticking a
      // review flag has it: one bad question in round 2 must not stop the
      // pictures being filed.
      if (result.repointed.length) {
        saveQuiz(config.quizDir, id, quiz, { allowProblems: true });
        log(`${result.repointed.length} question${result.repointed.length === 1 ? '' : 's'} moved onto the shared picture library`);
        reloadPackEverywhere(id, { clamp: false });
      }

      const backedUp = githubConfigured();
      if (result.made.length) {
        log(backedUp
          ? `${result.made.length} backed up to GitHub — they will survive a restart`
          : 'NOT backed up — set GITHUB_TOKEN or these vanish when the app restarts');
      }
      log('DONE ' + JSON.stringify({
        quizId: id,
        provider,
        made: result.made.length,
        skipped: result.skipped.length,
        failed: result.failed.length,
        reused: result.skipped.length,
        style: result.style,
        quality: result.quality,
        status: imageStatus(quiz, config.imageDir),
        backedUp,
      }));
    } catch (err) {
      log('ERROR ' + err.message);
    }
    stream.end();
    return true;
  }

  /*
   * The playlist for a "name that intro" round, built after the fact.
   *
   * You can easily have an intro round before you have a Spotify login, and a
   * playlist deleted by accident should not mean regenerating the quiz and
   * getting different questions. So this is its own button rather than only
   * something that happens once, during generation.
   */
  if (route === '/api/playlist/intro' && req.method === 'POST') {
    const body = await readJson(req);
    const stream = progressStream(res);
    const log = stream.log;
    try {
      const id = String(body.quizId || '');
      const quiz = loadQuiz(config.quizDir, id);
      const results = await buildIntroPlaylists({ quiz, log });

      // The lookups rewrote the cues with Spotify's spelling and uris, so the
      // pack has to be saved or the control view still points at the guesses.
      saveQuiz(config.quizDir, id, quiz);
      reloadPackEverywhere(id, { clamp: false });
      const backup = await backUp(`quizzes/${id}.json`, JSON.stringify(normaliseQuiz(quiz, id), null, 2) + '\n', `Intro playlist: ${quiz.title}`, log);

      /*
       * Carry the FAILURES through, not just the successes.
       *
       * `buildIntroPlaylists` catches a per-round problem and returns a null
       * playlist with the reason on it, so filtering to the ones that worked
       * threw the reason away and reported `playlists: []` — a success
       * envelope with nothing in it. A Spotify 403 then looked exactly like a
       * quiz with no tracks, and the only account of what went wrong was a log
       * line the console tore down a moment later.
       *
       * That is the "failure messages have to name the cause" rule, and this
       * is the one place it had been missed.
       */
      log('DONE ' + JSON.stringify({
        quizId: id,
        playlists: results.filter((r) => r.playlist).map((r) => ({ round: r.round, url: r.playlist.url, missing: r.playlist.missing })),
        failed: results.filter((r) => !r.playlist).map((r) => ({
          round: r.round,
          // No error means the lookups simply found nothing to put in it.
          error: r.error || 'none of its tracks could be found on Spotify',
        })),
        backedUp: backup.ok,
      }));
    } catch (err) {
      log('ERROR ' + err.message);
    }
    stream.end();
    return true;
  }

  // Bring in a track list you already have — a Spotify playlist you built, or
  // one Claude made for you in a browser. Streams like the generators do.
  /*
   * A SPOTIFY PLAYLIST BECOMES AN INTRO ROUND.
   *
   * The right answer and the cue are written from ONE Spotify track, so they
   * cannot disagree — see the head of `src/import-intro.js`. Claude is asked
   * only for the WRONG answers, and only if there is a key: without one the
   * decoys come from the other tracks in the playlist and the round is still
   * playable, which is why `claudeAsker` answers null rather than throwing.
   */
  if (route === '/api/import/intro' && req.method === 'POST') {
    if (!allowed(req, res, url, FEATURES.GENERATE)) return true;
    const body = await readJson(req);
    const stream = progressStream(res);
    const log = stream.log;
    try {
      const result = await importIntroRound({
        playlistUrl: String(body.playlistUrl || ''),
        count: Number(body.count) || undefined,
        title: String(body.title || '').slice(0, 80),
        // Null when there is no key. The import reads that as "fill the decoys
        // from the playlist" and says so in the log.
        // `spend` is the app's own ledger, not a local array — the decoy call
        // is billed like every other Claude call and shows on the Money tab.
        ask: claudeAsker({ what: 'intro round decoys', onSpend: spendRecorder(spend, { packId: themeSlug(String(body.title || '')) }) }),
        log,
      });

      /*
       * REFUSED RATHER THAN WRITTEN OVER — rule 11, running backwards.
       *
       * The id is slugged from the playlist's name, so importing the same
       * playlist twice lands on the same file. Writing it would replace a pack
       * somebody may have spent an evening editing, and
       * `reloadPackEverywhere()` would push the replacement into a game already
       * running. `saveOwn()` refuses this in its own words; so does this.
       */
      if (fs.existsSync(path.join(config.quizDir, result.id + '.json'))) {
        throw new Error(`There is already a pack called "${result.id}". Give the playlist a different name, or type a title for this one.`);
      }

      saveQuiz(config.quizDir, result.id, result.quiz, { allowProblems: true });
      log(`saved ${result.id}.json`);
      backUpSpend();
      const backup = await backUp(
        `quizzes/${result.id}.json`,
        JSON.stringify(result.quiz, null, 2) + '\n',
        `Import intro round: ${result.quiz.title}`,
        log,
      );
      log('DONE ' + JSON.stringify({
        id: result.id,
        title: result.quiz.title,
        count: result.count,
        playlist: result.playlist.url,
        playlistName: result.playlist.name,
        // Said out loud rather than left in the log: a round whose decoys all
        // came from the playlist is a DIFFERENT round to read through, and the
        // console has to be able to tell you which one you got.
        fellBack: result.fellBack,
        short: result.short,
        problems: result.problems,
        backedUp: backup.ok,
      }));
    } catch (err) {
      log('ERROR ' + err.message);
    }
    stream.end();
    return true;
  }

  if (route === '/api/import/bingo' && req.method === 'POST') {
    const body = await readJson(req, 512 * 1024);
    const stream = progressStream(res);
    const log = stream.log;
    try {
      const result = await importBingoPack({
        config,
        playlistUrl: String(body.playlistUrl || ''),
        text: String(body.text || ''),
        title: String(body.title || '').slice(0, 80) || undefined,
        cardSize: [3, 4, 5].includes(Number(body.cardSize)) ? Number(body.cardSize) : 4,
        avoidMonths: Math.min(24, Math.max(0, Number(body.avoidMonths ?? 0))),
        log,
      });
      const backup = await backUp(
        `bingo/${result.pack.id}.json`,
        JSON.stringify(result.pack, null, 2) + '\n',
        `Import bingo pack: ${result.pack.title}`,
        log,
      );
      // The import writes every track into the no-repeats history too, so that
      // has to survive the next restart just as it does when generating.
      const history = await backUpHistory(log);
      log('DONE ' + JSON.stringify({
        id: result.pack.id,
        title: result.pack.title,
        trackCount: result.pack.tracks.length,
        playlist: result.playlist ? result.playlist.url : null,
        playlistError: result.playlistError || null,
        backedUp: backup.ok,
        // Reported separately from the pack's own backup. They can differ, and
        // when they do it is this one that matters: Claude in the browser reads
        // the pushed history to decide what NOT to pick, so a history that
        // stayed here means the next round can repeat these songs.
        historyBackedUp: history.ok,
      }));
    } catch (err) {
      log('ERROR ' + err.message);
    }
    stream.end();
    return true;
  }

  return false;
}
