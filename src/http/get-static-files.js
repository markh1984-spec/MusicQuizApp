/**
 * GET ROUTES — static-files. Moved whole out of `handleGet()` in server.js;
 * the body is unchanged, it is one of the functions the shell tries in order.
 */
import { HOUSE, config, faviconSvg, fs, hub, path, rooms } from './context.js';
import { selfTestResult } from '../self-test.js';
import { secure, send, sendJson } from './plumbing.js';
import { MIME, serveFile } from './static.js';
import { roomForPhone } from './identity.js';

export async function getStaticFiles(req, res, url, route) {
  /*
   * The tab icon: the same record that is in the top left of every screen,
   * from the same drawing, so the two cannot drift apart.
   *
   * SVG rather than a .ico because there is no build step here to make one,
   * and every browser worth worrying about has taken SVG favicons since 2022.
   * A browser that has not simply shows its default, which is what it showed
   * before this existed.
   */
  if (route === '/favicon.svg') {
    return send(res, 200, faviconSvg(), {
      'Content-Type': 'image/svg+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=86400',
    }), true;
  }
  if (route === '/health') {
    const house = rooms.get(HOUSE);
    // `streams` and `rss` are for `scripts/long-night.mjs`, which watches
    // both across sixty phones and forty questions: a stream that is not let
    // go of when a phone leaves, or a heap that only ever grows, is a server
    // that falls over at half past ten on a busy Thursday.
    // `selfTest` is the boot-time run-through in `src/self-test.js`: null
    // until it has run, then ok/at/ms and the names of any failed steps.
    const st = selfTestResult();
    /*
     * `pid` IS HOW A CHECK KNOWS THE SERVER ANSWERING IS THE ONE IT STARTED.
     * A port is asked for, freed, and only bound by the app seconds later, after
     * the restore — so under a busy suite another test's server can take it in
     * between and answer every request, and a check then measures somebody
     * else's process with nothing to say so. `bootApp()` in
     * `test/helpers/live-server.mjs` compares this against its child's own.
     * A process id says nothing an attacker can use.
     */
    return sendJson(res, 200, {
      ok: true, pid: process.pid, game: house.session.kind, phase: house.session.engine.state.phase, rooms: rooms.all().length,
      streams: hub.count(), rss: process.memoryUsage().rss,
      selfTest: st ? { ok: st.ok, at: st.at, ms: st.ms, steps: st.steps, failed: st.failed } : null,
    }), true;
  }

  // ---- static
  if (route.startsWith('/assets/')) {
    return serveFile(res, config.publicDir, route), true;
  }
  /*
   * A PICTURE BY ITS POSITION — `/quiz-images/q/<round>/<question>[?g=CODE]`.
   *
   * The file's name is the answer (`portraits/chris-martin.png`), and it used
   * to ride in the projector's payload and `<img src>` while the room was
   * still watching the zoom — readable by anyone with the join code, which is
   * on the wall. Rule 1, broken for every picture round (R2 of the 23
   * September 2026 sweep). So the projector names the QUESTION and this
   * answers with the file — and ONLY for a question the room has been asked
   * (`Engine.pictureAsked()`): the one live or revealed now, or one already
   * in the recap. Anything else is 404, so the round cannot be read ahead by
   * counting. A capability check, never a kind test: a bingo engine has no
   * pictures and simply lacks the method. `no-cache`, never an hour — the
   * same address is a different picture on a different night.
   */
  const asked = route.match(/^\/quiz-images\/q\/(\d{1,3})\/(\d{1,3})$/);
  if (asked) {
    let file = '';
    try {
      const engine = roomForPhone(req, url).session.engine;
      if (engine && typeof engine.pictureAsked === 'function') file = engine.pictureAsked(Number(asked[1]), Number(asked[2]));
    } catch { file = ''; }
    if (!file) return send(res, 404, 'Not found'), true;
    const swap = file.replace(/\.(png|jpg|jpeg|webp)$/i, '.svg');
    return serveFile(res, config.imageDir, fs.existsSync(path.join(config.imageDir, file)) ? file : swap), true;
  }
  if (route.startsWith('/quiz-images/')) {
    const rel = decodeURIComponent(route.slice('/quiz-images/'.length));
    // If the real artwork is not there yet, fall back to a placeholder of the
    // same name. That way a quiz pack can name its final .png files from the
    // start and still be rehearsable before any images have been made.
    const swap = rel.replace(/\.(png|jpg|jpeg|webp)$/i, '.svg');
    const exists = fs.existsSync(path.join(config.imageDir, rel));
    return serveFile(res, config.imageDir, exists ? rel : swap, { cache: true }), true;
  }

  /*
   * Serving a photo. Only a filename the app itself issued is ever looked up,
   * so nothing from the request reaches the filesystem as a path.
   *
   * No key on this one — it has to load on the projector, which has no key,
   * and the whole point is that the room can see them.
   */
  if (route.startsWith('/photos/')) {
    /*
     * Every room's wall, because the URL carries only the filename the app
     * itself issued and a projector has no session to tell us whose it is.
     *
     * THIS IS SAFE ONLY BECAUSE THE NAME IS UNIQUE ACROSS ROOMS, and it used
     * to say so while the id could not deliver it — the counter in it is a
     * count of one room's own photographs. It carries random characters now;
     * see `Photos.add()` for why the timestamp and the counter were not
     * enough.
     */
    const wanted = decodeURIComponent(route.slice('/photos/'.length));
    let full = null;
    for (const room of rooms.all()) {
      full = room.photos.fileFor(wanted);
      if (full) break;
    }
    if (!full) return send(res, 404, 'Not found'), true;
    return fs.readFile(full, (err, data) => {
      if (err) return send(res, 404, 'Not found');
      res.writeHead(200, secure({
        'Content-Type': MIME[path.extname(full).toLowerCase()] || 'image/jpeg',
        'Cache-Control': 'public, max-age=3600',
      }));
      res.end(data);
    }), true;
  }

  return false;
}
