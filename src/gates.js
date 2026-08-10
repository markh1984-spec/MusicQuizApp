/**
 * Which routes are the owner's, as two lists.
 *
 * This lives in its own file rather than inside the request handler for the
 * same reason `plans.js` and `looks.js` do: it is a policy, it is the sort of
 * thing that is got wrong quietly, and a rule you cannot import is a rule you
 * cannot write a test for. It was inside the handler, it was wrong twice, and
 * both times the only way to find out was to fire a real request at it.
 */

/**
 * Routes only an OWNER ever uses, which therefore have to skip the broad
 * `FEATURES.QUIZ` gate as well as pass their own.
 *
 * The owner deliberately has no quiz features — an owner account writes and
 * sells packs and manages subscribers, it does not run nights. So anything
 * only an owner does gets a 403 from the broad gate unless it is listed here.
 * That trap has now caught generation, the corrections book and importing.
 */
export const OWNER_ONLY = ['/api/generate/', '/api/owner/', '/api/reports/'];

/**
 * Does this request WRITE to the shared pack library?
 *
 * Reading the library is `FEATURES.LIBRARY`, which every quizmaster has — they
 * play the packs, that is the arrangement. Saving, deleting, renaming,
 * importing and annotating one are `FEATURES.CATALOGUE`, which only the owner
 * has: the packs are written to a house style and sold, and three people
 * editing them is how that style stops being one.
 *
 * **Match the bare path as well as the prefix.** The first version of this
 * tested `startsWith('/api/quiz/')` — with the trailing slash — so DELETE and
 * PUT were shut and `POST /api/quiz`, which takes the id in the BODY, was
 * wide open. A signed-in quizmaster could still overwrite any quiz in the
 * library with one request, and in the sweep that found it the Madonna pack
 * came back titled "ROBOROB WAS HERE". `POST /api/bingo` had the identical gap.
 * (RoboRob is the throwaway account the sweep signs in as. Rob is a real
 * quizmaster who had nothing to do with it — see CLAUDE.md.)
 *
 * Import, the playlist builder and the no-repeats memory are here too. None of
 * them looks like "saving a pack", and all three are the catalogue: importing
 * IS how bingo packs are made now, the playlist step writes to the owner's own
 * Spotify account, and forgetting the history is what brings a song back in
 * front of a room months early.
 *
 * ADVERT SETS ARE NO LONGER HERE, and that was a promise this file made.
 *
 * They were owner-only as a holding position, for one reason only: they were
 * shared between quizmasters, so one person deleting the set for The Crown
 * landed on somebody else's projector. They are per room now — `pathsFor()` in
 * rooms.js — so that reason has gone, and under the host's own tier rule the
 * feature is Basic anyway, since a slide costs nothing to run. A quizmaster
 * writes their own venue's slides and cannot reach anybody else's.
 *
 * @param {string} route   the pathname, no query
 * @param {string} method  the HTTP method
 */
export function changesTheLibrary(route, method) {
  if (method !== 'PUT' && method !== 'DELETE' && method !== 'POST') return false;
  // Both of these check a pasted pack against the rules and save nothing.
  if (route === '/api/quiz/__validate' || route === '/api/bingo/__validate') return false;
  const pack = (base) => route === base || route.startsWith(`${base}/`);
  return pack('/api/quiz') || pack('/api/bingo')
    || pack('/api/import') || pack('/api/playlist') || pack('/api/history');
}
