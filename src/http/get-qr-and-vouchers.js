/**
 * GET ROUTES — qr-and-vouchers. Moved whole out of `handleGet()` in server.js;
 * the body is unchanged, it is one of the functions the shell tries in order.
 */
import { FEATURES, findInArchive, missingPhotoConfig, photoRepoProblem, photosRepoConfigured, photosRepoName, toSvg } from './context.js';
import { joinUrlFor, publicOrigin, send, sendJson } from './plumbing.js';
import { roomForHost, roomForPhone } from './identity.js';
import { allowed } from './gates.js';

export async function getQrAndVouchers(req, res, url, route) {
  /*
   * Everything on this server, foldered by night — the owner's tab.
   *
   * **`PHOTO_EXPORT`, not `PHOTOS`, and the difference is who it is for.** Every
   * quizmaster has photos from the room; what is here is getting them off and
   * onto social media afterwards, which is Mark's own workflow on Mark's own
   * room and was asked for on the owner's page rather than in the console every
   * subscriber sees. A quizmaster sees their nights and the pictures from them
   * on Past gigs, read only — the switch and the bin are on the control view,
   * where they are needed with a mic in one hand.
   *
   * It is `/api/owner/…` so it skips the broad quiz gate — an owner holds no
   * quiz features by design, which is the trap this file has recorded six times.
   */
  if (route === '/api/owner/photos') {
    if (!allowed(req, res, url, FEATURES.PHOTO_EXPORT)) return true;
    const { photos } = roomForHost(req, url);
    return sendJson(res, 200, {
      enabled: photos.enabled,
      count: photos.count(),
      unfiled: photos.unfiled().length,
      repo: photosRepoName(),
      repoReady: photosRepoConfigured(),
      // Which variable is actually missing, and whether one that IS set looks
      // wrong. "It says temporary" is not something anybody can act on.
      missing: missingPhotoConfig(),
      repoProblem: photoRepoProblem(),
      // Proof the app can see a value at all, without printing a token.
      seen: {
        PHOTO_REPO: Boolean(process.env.PHOTO_REPO),
        PHOTO_BRANCH: process.env.PHOTO_BRANCH || '(default: main)',
        PHOTO_TOKEN: Boolean(process.env.PHOTO_TOKEN),
        GITHUB_TOKEN: Boolean(process.env.GITHUB_TOKEN),
      },
      nights: photos.nights(),
    }), true;
  }

  // ---- the join QR
  if (route === '/api/voucher' && req.method === 'GET') {
    const room = roomForPhone(req, url);
    const code = String(url.searchParams.get('c') || '').toUpperCase();
    /*
     * TONIGHT'S GAME FIRST, THEN THE NIGHTS ALREADY FILED.
     *
     * A drink is won on one night and collected whenever the person fancies
     * it — and the live state is replaced the moment the next night launches,
     * so a code from last week used to come back "not a voucher here" while
     * the pub still owed the drink. See `src/wallet.js`; nothing new is
     * stored, the codes have been in the archive all along.
     *
     * The live lookup is untouched and runs first, so a scan on the night
     * takes exactly the path it always took.
     */
    const found = (room.session.engine?.state?.vouchers || {})[code]
      || findInArchive(room.paths.archive, code)?.voucher;
    // Says nothing about the room, the night or any other voucher — a bad code
    // is simply not a voucher here.
    if (!found) return sendJson(res, 404, { error: 'That code is not a voucher here.' }), true;
    return sendJson(res, 200, {
      code: found.code,
      name: found.name,
      reward: found.reward,
      venue: found.venue,
      issuedAt: found.issuedAt,
      redeemedAt: found.redeemedAt,
      // So the bar can see it has been put back rather than wondering.
      reinstated: found.reinstated || 0,
    }), true;
  }

  if (route === '/join-qr.svg') {
    // The code of the room asking for it, so a phone that scans Rob's
    // projector joins Rob's game. The house room has no code and its QR is the
    // plain /play it has always been, so every printed card still works.
    const room = roomForPhone(req, url) ;
    const target = joinUrlFor(publicOrigin(req), room.code);
    send(res, 200, toSvg(target, { margin: 2, dark: '#0b0b12', light: '#ffffff' }), {
      'Content-Type': 'image/svg+xml; charset=utf-8',
    });
    return true;
  }
  // A general-purpose QR, ready for the Instagram code on the lobby screen.
  if (route === '/qr.svg') {
    const text = url.searchParams.get('text') || publicOrigin(req);
    send(res, 200, toSvg(text, { margin: 2, dark: url.searchParams.get('dark') || '#0b0b12', light: url.searchParams.get('light') || '#ffffff' }), {
      'Content-Type': 'image/svg+xml; charset=utf-8',
    });
    return true;
  }

  return false;
}
