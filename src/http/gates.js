/**
 * THE GATES — allowed(), the bootstrap identity, pack liveness checks. Moved whole from server.js.
 */
import { accounts, config, inCatalogue, isOwnPack, listShows, showProblems, whyNot } from './context.js';
import { sendJson } from './plumbing.js';
import { whoIs } from './identity.js';

export const BOOTSTRAP = {
  id: 'host-key',
  email: '',
  name: 'Host key',
  role: 'quizmaster',
  plan: 'basic',
  addons: ['admin', 'stream'],
  comped: true,
  status: 'active',
  bootstrap: true,
};

/**
 * The gate. Every route that is not for the room goes through here.
 *
 * Two answers rather than one: 401 means "sign in", 403 means "signed in, but
 * this is not on your plan" — and the 403 carries the reason in words, because
 * a locked door with no sign on it is how people decide an app is broken
 * rather than that they have not bought something.
 *
 * @param {boolean} [opts.live]  a running game rather than a new one. A failed
 *   payment must never black out a projector mid-question, so anything the
 *   control view and the live connection need asks with this set.
 */
export function allowed(req, res, url, feature, { live = false } = {}) {
  const account = whoIs(req, url);
  if (!account) {
    sendJson(res, 401, { error: 'Sign in first', signIn: '/login' });
    return null;
  }
  // The bootstrap key is the owner with every hat on. Deliberately one branch,
  // in one place, so retiring it later is deleting these two lines.
  if (account.bootstrap) return account;

  const ok = live ? accounts.mayCarryOn(account, feature) : accounts.mayStartSomething(account, feature);
  if (!ok) {
    sendJson(res, 403, { error: whyNot(account, feature), feature });
    return null;
  }
  return account;
}

/**
 * Is this pack still there for this room — theirs, or the catalogue's?
 *
 * Deliberately the same two questions `packDir()` asks and in the same order,
 * because a show's card must not say a pack is fine that the launch will then
 * refuse to find. It answers EXISTENCE only, never entitlement: whether they
 * are allowed to play it is the launch route's business and this file already
 * has one definition of that, which is where it stays.
 */
export function packStillThere(kind, id, room) {
  return isOwnPack(kind, id, room.paths) || inCatalogue(kind, id, config);
}

export const problemsWith = (show, room) => showProblems(show, (kind, id) => packStillThere(kind, id, room));

/**
 * Their shows, each carrying what is wrong with it TODAY.
 *
 * Worked out here rather than in the browser because this is the check the
 * launch itself will make — the console knowing the answer to a slightly
 * different question is exactly how a card comes to say a night is ready and
 * the launch then says it is not.
 */
export function showsFor(room) {
  return listShows(room.paths).map((show) => {
    const problems = problemsWith(show, room);
    return problems.length ? { ...show, problems } : show;
  });
}

export function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

