/**
 * GET ROUTES — packs. Moved whole out of `handleGet()` in server.js;
 * the body is unchanged, it is one of the functions the shell tries in order.
 */
import { DEFAULT_QUALITY, FEATURES, PACK_PENCE, QUALITIES, STYLES, artProvider, config, findStyle, fs, googleConfigured, imageJobs, imagePlan, imagePrices, imageStatus, loadAdvertPack, loadQuiz, openaiConfigured, path, portraitLibrary, readPack, recentTracks } from './context.js';
import { sendJson } from './plumbing.js';
import { mayReadPack, packCtx, roomForHost } from './identity.js';
import { allowed } from './gates.js';

export async function getPacks(req, res, url, route) {
  if (route.startsWith('/api/advert/')) {
    if (!allowed(req, res, url, FEATURES.LIBRARY)) return true;
    const id = decodeURIComponent(route.slice('/api/advert/'.length));
    const advertRoom = roomForHost(req, url);
    try {
      const pack = loadAdvertPack(advertRoom.paths.adverts, id);
      /*
       * THE OPENS, ON THE SAME READ AS THE PACK — the editor already fetches
       * this exact route to open a set, so there is no second request for the
       * count to fall out of step with. Keyed by slide id, same as the pack's
       * own `slides` list, so the browser needs no join to show them together.
       */
      return sendJson(res, 200, { ...pack, opens: advertRoom.offers.forPack(id) }), true;
    } catch {
      /*
       * The reason is deliberately NOT passed through.
       *
       * Now that every quizmaster has their own folder, asking for somebody
       * else's set is an ordinary miss — and `err.message` on a miss is an
       * ENOENT carrying the server's absolute path, which told an unknown
       * caller the directory layout and the room id it was looking in.
       */
      return sendJson(res, 404, { error: 'No advert set with that name.' }), true;
    }
  }

  // What round 2 actually has on disk: real portraits, stand-ins, or nothing.
  // Read before spending anything, so the panel can say what it is about to do.
  if (route.startsWith('/api/images/')) {
    if (!allowed(req, res, url, FEATURES.LIBRARY)) return true;
    const id = decodeURIComponent(route.slice('/api/images/'.length));
    // It reports every question's ANSWER, so it is a read of the pack whatever
    // else it is.
    if (!mayReadPack(req, url, 'quiz', id)) {
      return sendJson(res, 403, { error: 'That pack is not in your library yet.', upgrade: true }), true;
    }
    const style = findStyle(url.searchParams.get('style') || '');
    try {
      const quiz = loadQuiz(config.quizDir, id);
      return sendJson(res, 200, {
        ...imageStatus(quiz, config.imageDir),
        // Which supplier will draw, and what it charges. The prices come from
        // the ledger's own table rather than a second copy in the browser —
        // the console had one, and a quoted price that disagrees with the
        // recorded one is the exact drift `src/spend.js` says it prevents.
        art: artProvider(),
        pence: imagePrices(artProvider()),
        /*
         * Everybody already drawn, so the shared library can be looked at.
         *
         * The filename is the whole index, which is what makes reuse free and
         * also what makes it quietly duplicable — the key is the ANSWER TEXT,
         * so "Michael Jackson" and "Michael Jackson (Jacko)" are two people as
         * far as the app is concerned. Nothing catches that, and a fuzzy
         * warning would be worse than the problem. Putting the two names next
         * to each other is all anybody needs.
         */
        library: portraitLibrary(config.imageDir),
        openai: openaiConfigured(),
        google: googleConfigured(),
        // What pressing the button would actually cost, given what the shared
        // library already holds. This is the number that shows the sharing
        // working, so it is read before anything is spent, not reported after.
        plan: imagePlan(quiz, config.imageDir, { style }),
        styles: Object.entries(STYLES).map(([sid, st]) => ({ id: sid, label: st.label, hint: st.hint })),
        style,
        qualities: QUALITIES,
        defaultQuality: DEFAULT_QUALITY,
        questions: imageJobs(quiz, { style }).map(({ q, musician, wants }) => ({
          id: q.id,
          answer: q.options[q.correctIndex],
          image: q.image,
          musician,
          wants,
          real: fs.existsSync(path.join(config.imageDir, q.image)),
          inLibrary: fs.existsSync(path.join(config.imageDir, wants)),
        })),
      }), true;
    } catch (err) {
      return sendJson(res, 404, { error: err.message }), true;
    }
  }
  if (route.startsWith('/api/bingo/')) {
    if (!allowed(req, res, url, FEATURES.LIBRARY)) return true;
    const id = decodeURIComponent(route.slice('/api/bingo/'.length));
    if (!mayReadPack(req, url, 'bingo', id)) {
      return sendJson(res, 403, {
        error: 'That pack is not in your library yet.', upgrade: true, pence: PACK_PENCE,
      }), true;
    }
    try {
      const { pack, mine } = readPack('bingo', id, packCtx(req, url));
      return sendJson(res, 200, { ...pack, mine }), true;
    } catch {
      return sendJson(res, 404, { error: 'No bingo pack with that name.' }), true;
    }
  }
  // What the generator is currently refusing to reuse.
  if (route === '/api/history') {
    if (!allowed(req, res, url, FEATURES.LIBRARY)) return true;
    const months = Number(url.searchParams.get('months')) || 3;
    return sendJson(res, 200, { months, tracks: recentTracks(config.dataDir, months) }), true;
  }
  return false;
}
