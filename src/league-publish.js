/**
 * WHAT THIS ROOM HAS DECIDED ABOUT PUBLISHING — which venues' tables are up,
 * and which team names a human has overruled the filter on.
 *
 * The gate for `/league`, and the exact shape of `src/gallery.js` one door
 * along — deliberately, because the question is the same question and a second
 * answer to it is a second thing that can be got wrong.
 *
 * ---
 *
 * **A LEAGUE IS PRIVATE UNTIL IT IS PUBLISHED.** A team name was typed on a
 * phone to be a team name for one night; a table on a public web page is a
 * different audience and a much longer time. Publishing every venue the moment
 * the feature exists would apply the weakest consent in the app to the largest
 * audience it has — the same sentence the gallery is built on, and it holds
 * here for the same reason.
 *
 * **PER VENUE, NOT PER NIGHT**, and that is the one real difference. A league
 * IS a venue's season — a page per pub, put up once and left up, which is what
 * a table on a wall is. There is no per-night decision to make because there
 * is no per-night page.
 *
 * **THE LIST LIVES IN THE PRIVATE REPO, not on disk.** Render's free tier
 * wipes `data/` on every deploy — a fact this codebase has been bitten by more
 * than once, and the reason the archive this table is BUILT from is backed up
 * there too. A flag kept in `data/` would silently unpublish every venue the
 * next time anything shipped, and nobody would know until a regular mentioned
 * the page had gone.
 *
 * **IT FAILS CLOSED.** Unreachable, unconfigured or unparseable means nothing
 * is published. A page that shows nothing is a disappointment; a page that
 * shows every team in every pub because a fetch failed is a disclosure.
 *
 * ---
 *
 * **NO FACES HERE, AND THAT IS DECIDED IN THE VIEW RATHER THAN LEFT TO
 * TASTE.** `leagueTable()` carries a `faceKey` per team so the console can
 * draw one; the public page prints names, played, won and points and nothing
 * else. A face is a photograph of somebody in a pub, and the consent it was
 * given under is the big screen — see the gallery's own note.
 */

import { getFile, putFile, photosRepoConfigured } from './github.js';
import { photoFolder } from './past-gigs.js';
import { teamKey } from './league.js';

/**
 * Beside the gallery's own list, in the same private repo.
 *
 * `photoFolder()` names the room's folder rather than anything photographic —
 * it is where a room's private things live, and putting this somewhere else
 * would mean a second folder to configure for no gain.
 */
function listPath(roomId) {
  return `${photoFolder(roomId)}/leagues-published.json`;
}

/**
 * A venue key is `venueKeyOf()`'s output — an id or a lowercased name.
 *
 * Validated on the way in AND on the way out, because this file sits in a
 * repository a human can open and edit: a bad line in it must never become a
 * path, a lookup against something it was not meant to match, or markup.
 */
export function isVenueKey(key) {
  const k = String(key || '');
  return Boolean(k) && k.length <= 200 && !/[<>\n\r]/.test(k);
}

/**
 * The whole decision file, once.
 *
 * Both halves live in ONE json — the venues that are up and the names a human
 * has ruled on — because they are one question ("what does this room publish")
 * asked at one moment, and two files would be two GitHub round trips on a page
 * that already waits for one. Fails closed to the empty answer, which for both
 * halves means "the machine decides and nothing is published".
 */
const NOTHING = { venues: [], names: {}, running: [] };

async function readDecisions(roomId) {
  if (!photosRepoConfigured()) return { ...NOTHING };
  let raw = null;
  try {
    raw = await getFile(listPath(roomId), 'private');
  } catch {
    return { ...NOTHING };
  }
  if (!raw) return { ...NOTHING };
  try {
    const parsed = JSON.parse(raw.toString('utf8'));
    // An ARRAY is the original shape, from before names could be overruled.
    // Read it rather than migrating it: a rewrite over everybody's file is a
    // one-shot script on a disk that gets wiped, which this repo already knows
    // better than to write.
    const venues = Array.isArray(parsed) ? parsed : parsed.venues;
    const names = (!Array.isArray(parsed) && parsed.names) || {};
    const running = (!Array.isArray(parsed) && parsed.running) || [];
    const keys = (list) => [...new Set((list || []).map((v) => String(v || '')).filter(isVenueKey))].sort();
    return {
      venues: keys(venues),
      // Validated on the way OUT: this file is in a repository a human can
      // edit, and an unknown verdict must not become a third behaviour.
      names: Object.fromEntries(Object.entries(names)
        .filter(([k, v]) => k && (v === 'allow' || v === 'hide'))),
      running: keys(running),
    };
  } catch {
    return { ...NOTHING };
  }
}

/**
 * WHICH VENUES ACTUALLY RUN A LEAGUE — and it is OFF until somebody says so.
 *
 * Asked for on 31 August 2026: *"quiz leagues should be turn on and offable as
 * well — it's useful to have the information regardless, but from the point of
 * view of showing a page that is quiz league format it might be misleading if
 * this app just had that as standard even in venues that don't have a quiz
 * league."*
 *
 * **THE TABLE IS ARITHMETIC AND THE LEAGUE IS A THING YOU RUN.** Every venue
 * with two filed nights HAS a table, because the app can always add up
 * finishing positions — but a pub where nobody has ever mentioned a league
 * does not have one, and printing a season table in that landlord's report
 * says it does. That is the app asserting something about somebody else's
 * night, which is worse than saying nothing.
 *
 * **SO IT GATES WHAT LEAVES, AND NOTHING THE QUIZMASTER SEES.** The console
 * draws every venue's table either way — *"it's useful to have the information
 * regardless"* — and this decides whether it reaches the landlord's report and
 * whether it can go on a public page at all.
 *
 * **OFF BY DEFAULT, which is a change of behaviour and the point of the
 * request.** Erring the other way puts a league table in front of a venue that
 * never asked for one; erring this way costs one tap on the venues that did.
 *
 * @returns {Promise<string[]>} venue keys, sorted. Empty on any doubt.
 */
export async function leaguesRunning(roomId) {
  return (await readDecisions(roomId)).running;
}

/** Does this venue run a league? The question the report and `/league` ask. */
export async function isLeagueRunning(roomId, key) {
  if (!isVenueKey(key)) return false;
  return (await leaguesRunning(roomId)).includes(String(key));
}

/**
 * Say that a venue runs a league, or that it does not.
 *
 * **SWITCHING IT OFF TAKES THE PUBLIC TABLE DOWN WITH IT.** A venue that does
 * not run a league cannot have a published one — leaving the page up while the
 * switch says otherwise is the app disagreeing with itself in public, on the
 * one surface where that is expensive.
 */
export async function setLeagueRunning(roomId, key, on) {
  if (!isVenueKey(key)) return { ok: false, error: 'That is not a venue.' };
  if (!photosRepoConfigured()) {
    return { ok: false, error: 'The private repository is not set up, so there is nowhere to record this.' };
  }
  const held = await readDecisions(roomId);
  const running = on
    ? [...new Set([...held.running, String(key)])].sort()
    : held.running.filter((v) => v !== String(key));
  const venues = on ? held.venues : held.venues.filter((v) => v !== String(key));
  const same = running.length === held.running.length && venues.length === held.venues.length;
  if (same) return { ok: true, running: held.running, venues: held.venues };

  const res = await putFile(
    listPath(roomId),
    JSON.stringify({ venues, names: held.names, running }, null, 2),
    `${on ? 'Run' : 'Stop'} the league at ${key}`,
    'private',
  );
  if (res && res.ok === false) return { ok: false, error: res.error || 'Could not save that.' };
  return { ok: true, running, venues };
}

/**
 * The names this room has overruled the filter on, keyed by `teamKey()`.
 *
 * @returns {Promise<Record<string, 'allow'|'hide'>>} empty on any doubt, which
 *   means the word list decides — the cautious default the override sits on
 *   top of rather than replaces.
 */
export async function nameDecisions(roomId) {
  return (await readDecisions(roomId)).names;
}

/**
 * Overrule the filter on one name, or take the ruling back.
 *
 * @param {string} name        as typed on the night; keyed by `teamKey()`
 * @param {'allow'|'hide'|''} decision  '' clears it back to the word list
 */
export async function setNameDecision(roomId, name, decision) {
  const key = teamKey(name);
  if (!key) return { ok: false, error: 'That is not a name.' };
  if (!['allow', 'hide', ''].includes(decision)) {
    return { ok: false, error: 'That is not a decision.' };
  }
  if (!photosRepoConfigured()) {
    return { ok: false, error: 'The private repository is not set up, so there is nowhere to record this.' };
  }
  const have = await readDecisions(roomId);
  const names = { ...have.names };
  if (decision) names[key] = decision; else delete names[key];
  if (JSON.stringify(names) === JSON.stringify(have.names)) return { ok: true, names: have.names };

  const res = await putFile(
    listPath(roomId),
    JSON.stringify({ venues: have.venues, names, running: have.running }, null, 2),
    decision ? `${decision === 'allow' ? 'Allow' : 'Hide'} the team name ${key}` : `Clear the ruling on ${key}`,
    'private',
  );
  if (res && res.ok === false) return { ok: false, error: res.error || 'Could not save that.' };
  return { ok: true, names };
}

/**
 * Which venues this room has published.
 *
 * @returns {Promise<string[]>} venue keys, sorted. Empty on any doubt.
 */
export async function publishedVenues(roomId) {
  // Fails closed through `readDecisions` — see the note at the top. A network
  // wobble must not put anybody's team name on a public page.
  return (await readDecisions(roomId)).venues;
}

/** Is this one venue's table public? The question the public route asks first. */
export async function isVenuePublished(roomId, key) {
  if (!isVenueKey(key)) return false;
  return (await publishedVenues(roomId)).includes(String(key));
}

/**
 * Publish a venue's table, or take it back down.
 *
 * **Taking it down is as important as putting it up.** A team will ask, and
 * the only honest answer on a page with no contact details on it is a
 * quizmaster who can unpublish the venue in one tap. That is why the console
 * draws the two controls with equal weight rather than hiding the second.
 *
 * @returns {Promise<{ok: boolean, venues?: string[], error?: string}>}
 */
export async function setVenuePublished(roomId, key, on) {
  if (!isVenueKey(key)) return { ok: false, error: 'That is not a venue.' };
  if (!photosRepoConfigured()) {
    return { ok: false, error: 'The private repository is not set up, so there is nowhere to record this.' };
  }
  const decided = await readDecisions(roomId);
  const have = decided.venues;
  const want = on
    ? [...new Set([...have, String(key)])]
    : have.filter((v) => v !== String(key));
  // A second tap on an already-published venue should not make a commit.
  if (want.length === have.length && want.every((v) => have.includes(v))) {
    return { ok: true, venues: have };
  }
  const sorted = [...want].sort();
  const res = await putFile(
    listPath(roomId),
    // The names ride along untouched — writing only the venues would wipe
    // every ruling a human had made, which is the shape of bug that only
    // shows up weeks later when somebody notices a name has come back.
    JSON.stringify({ venues: sorted, names: decided.names, running: decided.running }, null, 2),
    `${on ? 'Publish' : 'Unpublish'} the league table for ${key}`,
    'private',
  );
  if (res && res.ok === false) return { ok: false, error: res.error || 'Could not save that.' };
  return { ok: true, venues: sorted };
}
