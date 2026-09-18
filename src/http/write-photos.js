/**
 * WRITE ROUTES — photos. Moved whole out of `handleWrite()` in server.js;
 * the body is unchanged, it is one of the functions the shell tries in order.
 */
import { FEATURES, MAX_BYTES, deleteFile, dropNight, dropPhoto, dropPhotoFromDisk, extensionFor, isNightFolder, photoFolder, photosRepoConfigured, putFile, safePhotoName, setPhotoDecision, setPhotoPin, showsByDefault, sniffType } from './context.js';
import { readBody, readJson, sendJson } from './plumbing.js';
import { galleryRoomFor, photoBytes } from './identity.js';
import { allowed } from './gates.js';

export async function writePhotos(req, res, url, route) {
  /*
   * PUT A NIGHT ON THE PUBLIC GALLERY, or take it back down.
   *
   * IT LIVED IN `handleGet` AND WAS THEREFORE UNREACHABLE. That function is
   * only ever called for GET and HEAD — every POST comes here — so a POST to
   * this route fell through to the generic 404 and had done since the day the
   * gallery was written. It was dead code that read as a working feature: the
   * gate was tested, the page was built, and the one call that puts a night up
   * could never have been answered.
   *
   * Found by a browser agent posting to it and getting "Not found" instead of
   * the honest "there is nowhere to record this" — which is the third time in
   * this repo that something adjacent to the artefact was tested and the
   * artefact itself never was.
   */
  /*
   * TAKE ONE PHOTOGRAPH OUT OF A FILED NIGHT.
   *
   * Asked for before publishing anything: *"I need to remove some photos from
   * that section… a little bin icon so I can delete photos that shouldn't go
   * to the main gallery."* Which is the right order to want it in — the
   * gallery control publishes a whole night, so the only way to keep one
   * picture off it was to keep the night off it.
   *
   * **SCOPED BY THE ROOM, exactly like the route that serves them.** The path
   * is built from `roomForHost`, so a quizmaster can only ever delete out of
   * their own nights; there is no room parameter to tamper with, which is the
   * same shape `own-packs.js` relies on.
   *
   * **AND IT IS HONEST ABOUT WHAT DELETING MEANS.** This removes the file from
   * the repository, so it stops being served, stops appearing in Gigs and can
   * never reach the gallery. It does NOT rewrite git history — the blob is
   * still in the repo's past, as everything committed to git always is. That
   * matters if somebody ever asks for their photograph to be destroyed rather
   * than taken down, and the app must not imply otherwise.
   */
  /*
   * THE QUIZMASTER'S OWN PHOTOGRAPHS OF THE ROOM — asked for on 29 August
   * 2026: *"would be good to be able to add room photos to the gallery that
   * everyone sees, that I take from my own phone?"*
   *
   * ---
   *
   * **THE ROOM'S CAMERA IS SIXTY PHONES POINTED AT EACH OTHER, and none of
   * them is pointed at the room.** What a venue wants to be shown is the place
   * full — the bar three deep, forty heads looking at a projector — and that
   * is a picture only the person standing at the front takes. Every photo the
   * gallery has held until now came in through a PLAYER's phone, so the one
   * shot that actually sells the night was the one that could not get in.
   *
   * **IT GOES STRAIGHT INTO THE FILED NIGHT, never through the room's live
   * photo store**, and that is what makes it usable at all. `photos.add()`
   * dates a picture by the clock at the moment it lands, so anything sent on
   * the Friday would file itself under the Friday — a Thursday quiz, and a
   * photograph of it in a folder for a night that did not happen. Naming the
   * night in the URL is what lets him do this in the car park, or on Monday.
   *
   * **AND IT IS CAMERA-ELIGIBLE BY DEFINITION.** The marker exists to keep a
   * meme somebody picked off their camera roll off a venue's page; these are
   * the promotional photographs, taken by the person whose name is on the
   * page. The one thing they must never do is arrive marked and then silently
   * not appear.
   *
   * Host-only, scoped by `roomForHost` like every other write behind this
   * door: there is no night, folder or room anybody can send that reaches
   * another quizmaster's history.
   */
  if (route.startsWith('/api/past-photo/') && req.method === 'POST') {
    if (!allowed(req, res, url, FEATURES.PAST_GIGS)) return true;
    const night = decodeURIComponent(route.slice('/api/past-photo/'.length));
    if (!isNightFolder(night)) return sendJson(res, 404, { error: 'No night with that date.' }), true;
    if (!photosRepoConfigured()) {
      // Name the missing thing rather than saying "could not save that", which
      // would send somebody hunting through the app for a fault in an env var.
      return sendJson(res, 400, { error: 'The private photo repository is not set up, so there is nowhere to keep these.' }), true;
    }

    let bytes;
    try {
      bytes = await readBody(req, MAX_BYTES);
    } catch {
      return sendJson(res, 413, { error: 'That photo is too big. It should be scaled down before it is sent.' }), true;
    }
    /*
     * WHAT THE BYTES ACTUALLY ARE, rather than what the request claimed — the
     * same sniff `photos.add()` makes, and for the same reason: this file is
     * served straight back as an image on a public page, so a mislabelled one
     * would be a broken box in front of a venue.
     */
    const sniffed = sniffType(bytes);
    const ext = sniffed && extensionFor(sniffed);
    if (!ext) return sendJson(res, 415, { error: 'That is not a photo.' }), true;

    /*
     * `mine` IN THE NAME, so a photograph the quizmaster added is tellable
     * from one the room sent — for a bin, for a count, and for whatever wants
     * to know later. It carries no `-picked`, so `isCameraFile()` lets it
     * through to the gallery, which is the whole point of the feature.
     */
    const name = `mine${Date.now().toString(36)}${Math.floor(Math.random() * 1296).toString(36)}${ext}`;
    const mine = `${photoFolder(galleryRoomFor(req, url))}/${night}`;
    dropNight(mine);
    const done = await putFile(
      `${mine}/${name}`,
      bytes,
      `${night} — added by the quizmaster`,
      'photos',
    );
    if (done && done.ok === false) return sendJson(res, 502, { error: done.error || 'Could not save that.' }), true;
    return sendJson(res, 200, {
      // The same route every other filed photo is served through, so nothing
      // downstream has to know where this one came from.
      ok: true, night, name, url: `/past-photo/${night}/${name}`,
    }), true;
  }

  /*
   * ONE PHOTOGRAPH ON OR OFF THE PUBLIC GALLERY.
   *
   * Every photograph is on by default since 2 September 2026 — see
   * `showsByDefault()` — so in practice this is where one gets switched OFF.
   * It still works both ways, because a night can be tidied and then changed
   * back.
   *
   * A ruling that only restates the DEFAULT is CLEARED rather than stored, or
   * a later change to that default could never reach this photograph again.
   */
  if (route.startsWith('/api/gallery-photo/') && req.method === 'POST') {
    if (!allowed(req, res, url, FEATURES.PAST_GIGS)) return true;
    const parts = route.slice('/api/gallery-photo/'.length).split('/');
    const night = decodeURIComponent(parts[0] || '');
    const name = safePhotoName(decodeURIComponent(parts[1] || ''));
    if (parts.length !== 2 || !isNightFolder(night) || !name) {
      return sendJson(res, 404, { error: 'No photo there.' }), true;
    }
    const body = await readJson(req);
    const on = Boolean(body && body.on);
    /*
     * WHAT WOULD HAPPEN WITH NO RULING AT ALL, so a ruling that agrees with it
     * is cleared instead of stored. Otherwise a later change to the default
     * could never reach this photograph again.
     *
     * **IT MUST BE THE SAME FUNCTION `showsOnGallery()` FALLS BACK TO.** This
     * used to say `isCameraFile(name)` — the old default written out a second
     * time — and when the default was flipped, leaving this behind would have
     * been silent and nasty: pressing a lamp RED on a `-picked` photograph
     * computes "that agrees with the guess", clears the ruling, and the new
     * default puts the photograph straight back ON. A control that undoes
     * itself, with nothing thrown.
     */
    const decision = on === showsByDefault(name) ? '' : (on ? 'on' : 'off');
    // The gallery's room — this and the publish route write the SAME file, so
    // sending them to two rooms is two half-truths rather than one answer.
    const done = await setPhotoDecision(galleryRoomFor(req, url), night, name, decision);
    if (!done.ok) return sendJson(res, 400, { error: done.error || 'Could not save that.' }), true;
    return sendJson(res, 200, { ok: true, night, name, onGallery: on }), true;
  }

  /*
   * PIN A PHOTOGRAPH TO A NIGHT'S CARD, or take the pin off.
   *
   * *"A little icon on each photo where I can pin up to 3, so if I dislike one
   * of the random photos I can remove the pin from that one and give it to
   * something else."* Three is `MAX_PINS`; over it this answers 400 with the
   * reason rather than silently dropping the press.
   *
   * Scoped by `galleryRoomFor` like every other photo write — no room in the
   * URL, so a quizmaster cannot reach another's night.
   */
  if (route.startsWith('/api/gallery-pin/') && req.method === 'POST') {
    if (!allowed(req, res, url, FEATURES.PAST_GIGS)) return true;
    const parts = route.slice('/api/gallery-pin/'.length).split('/');
    const night = decodeURIComponent(parts[0] || '');
    const name = safePhotoName(decodeURIComponent(parts[1] || ''));
    if (parts.length !== 2 || !isNightFolder(night) || !name) {
      return sendJson(res, 404, { error: 'No photo there.' }), true;
    }
    const body = await readJson(req);
    const on = Boolean(body && body.on);
    const done = await setPhotoPin(galleryRoomFor(req, url), night, name, on);
    if (!done.ok) return sendJson(res, 400, { error: done.error || 'Could not save that.' }), true;
    return sendJson(res, 200, { ok: true, night, name, pinned: on, pins: done.pins }), true;
  }

  /*
   * A FILED PHOTOGRAPH TURNED A QUARTER TURN — the one edit a filed photo takes.
   *
   * Phones file some photographs on their side. The BROWSER rotates (a canvas,
   * the same code that frames one for the socials) and sends the new bytes
   * here, which write OVER the same name in the private repo — so every reader
   * (this console, the wall, the public gallery, the export) gets the turned
   * one without a ruling to remember and apply in five places. The name stays
   * the name, so the lamp, the star and the gallery's links all still hold.
   *
   * THE SECOND EVENT THAT CAN MAKE A CACHED PICTURE WRONG, after a delete —
   * the memory and disk copies go, and the console re-points its own <img>.
   * A browser that fetched the old one keeps it for up to a day (`/past-photo/`
   * says `max-age=86400`); that is the cost of forty thumbnails not being
   * forty fetches, and a rotation is not worth losing it over.
   */
  if (route.startsWith('/api/past-photo/') && req.method === 'PUT') {
    if (!allowed(req, res, url, FEATURES.PAST_GIGS)) return true;
    const parts = route.slice('/api/past-photo/'.length).split('/');
    const night = decodeURIComponent(parts[0] || '');
    const name = safePhotoName(decodeURIComponent(parts[1] || ''));
    if (!isNightFolder(night) || !name || parts.length !== 2) {
      return sendJson(res, 404, { error: 'No photo there.' }), true;
    }
    if (!photosRepoConfigured()) {
      return sendJson(res, 400, { error: 'The private photo repository is not set up, so there is nothing to change.' }), true;
    }
    let bytes;
    try {
      bytes = await readBody(req, MAX_BYTES);
    } catch {
      return sendJson(res, 413, { error: 'That photo is too big.' }), true;
    }
    // THE BYTES MUST BE THE KIND THE NAME SAYS. The name is what every reader
    // serves a Content-Type off, so a JPEG written under a .png name is a
    // picture that decodes by luck.
    const sniffed = sniffType(bytes);
    const ext = sniffed && extensionFor(sniffed);
    if (!ext || !name.toLowerCase().endsWith(ext)) {
      return sendJson(res, 415, { error: 'That is not the same kind of picture as the one it replaces.' }), true;
    }
    const key = `${photoFolder(galleryRoomFor(req, url))}/${night}/${name}`;
    // A name that is not on this night is a write that would CREATE a file the
    // listing has never heard of, under a name nobody chose.
    if (!(await photoBytes(key))) return sendJson(res, 404, { error: 'No photo there.' }), true;
    const done = await putFile(key, bytes, `${night} — a photo turned`, 'photos');
    if (done && done.ok === false) return sendJson(res, 502, { error: done.error || 'Could not save that.' }), true;
    dropPhoto(key);
    dropPhotoFromDisk(key);
    return sendJson(res, 200, { ok: true, night, name }), true;
  }

  if (route.startsWith('/api/past-photo/') && req.method === 'DELETE') {
    if (!allowed(req, res, url, FEATURES.PAST_GIGS)) return true;
    const parts = route.slice('/api/past-photo/'.length).split('/');
    const night = decodeURIComponent(parts[0] || '');
    const name = safePhotoName(decodeURIComponent(parts[1] || ''));
    if (!isNightFolder(night) || !name || parts.length !== 2) {
      return sendJson(res, 404, { error: 'No photo there.' }), true;
    }
    if (!photosRepoConfigured()) {
      // Say which thing is missing. "Could not delete that" would send
      // somebody hunting through the app for a fault in an env var.
      return sendJson(res, 400, { error: 'The private photo repository is not set up, so there is nothing to delete from.' }), true;
    }
    const gone = `${photoFolder(galleryRoomFor(req, url))}/${night}/${name}`;
    const done = await deleteFile(gone, `Remove a photo from ${night}`, 'photos');
    // THE ONE EVENT THAT CAN MAKE A CACHED PICTURE WRONG. A filed photograph is
    // immutable by name, so nothing else invalidates one — but somebody asking
    // for theirs to be removed must not be served it a moment later.
    dropPhoto(gone);
    dropPhotoFromDisk(gone);
    dropNight(gone.slice(0, gone.lastIndexOf('/')));
    if (done && done.ok === false) return sendJson(res, 502, { error: done.error || 'Could not delete that.' }), true;
    return sendJson(res, 200, { ok: true, night, name }), true;
  }

  return false;
}
