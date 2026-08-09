/**
 * What the app is called, and whose it is.
 *
 * The app is **Quiztopia**. A night belongs to one quizmaster, so what goes on
 * their projector is **"Mark's Quiztopia"** or **"Rob's Quiztopia"** — the room
 * carries the host's name, not the name of whoever happens to be looking at the
 * page. A player scanning a code at the back of a pub is at Mark's night; that
 * the owner is signed in on a laptop somewhere is not information the room
 * wants.
 *
 * It is FIRST NAMES only, deliberately. "Mark's Quiztopia" is how he introduces
 * himself on the mic, and a surname on a projector reads like a letterhead.
 *
 * `BRAND_NAME` still wins over all of it, unchanged and on purpose: it is the
 * documented way to put a different name on the whole app, and somebody who has
 * set it has said what they want called what.
 */

/** The product. `APP_NAME` is here so a white-label deploy is one variable. */
export const APP_NAME = process.env.APP_NAME || 'Quiztopia';

/**
 * The name somebody goes by, from whatever the account has.
 *
 * Falls back to the local part of an email address, because an account made in
 * a hurry may have no name on it and "Rob's Quiztopia" beats "Quiztopia" —
 * `rob@example.com` is still somebody telling you they are Rob. Anything after
 * a dot or an underscore is dropped for the same reason a surname is.
 */
export function firstName(who = '') {
  const raw = String(who || '').trim();
  if (!raw) return '';
  // An email address: take the local part, then its first word.
  const base = raw.includes('@') ? raw.slice(0, raw.indexOf('@')) : raw;
  const first = base.split(/[\s._+-]+/).filter(Boolean)[0] || '';
  if (!first) return '';
  // Only touch the case when it is given to us flat, so "McFly" survives.
  const cased = first === first.toLowerCase()
    ? first.charAt(0).toUpperCase() + first.slice(1)
    : first;
  return cased.slice(0, 24);
}

/**
 * The name on the projector, the console and the tab.
 *
 * @param {string} who        the account's name, or its email
 * @param {object} [opts]
 * @param {string} [opts.appName]   the product name
 * @param {string} [opts.override]  BRAND_NAME, which beats everything
 */
export function brandFor(who = '', { appName = APP_NAME, override = '' } = {}) {
  if (override) return String(override);
  const first = firstName(who);
  // Always 's, including after an s — "James's Quiztopia" is how it is said out
  // loud, and this name is read aloud far more than it is written down.
  return first ? `${first}'s ${appName}` : appName;
}
