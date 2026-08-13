/**
 * Chat, for a room that is not in a room.
 *
 * A pub supplies the atmosphere for nothing: sixty people groaning at the same
 * moment is most of what a quiz night IS, and none of it survives a video
 * call. So online nights get a main room, a back channel for whoever is
 * running the thing, and — once teams exist — a room per team.
 *
 * Pure functions and plain data, like `scoring.js`. The engine owns the state
 * and the pushing; this owns what a room is, who is in it, and what may be
 * said while a clock is running.
 *
 * THREE THINGS DECIDE EVERYTHING HERE:
 *
 *  1. **A sub-room is a TEAM**, not a second concept. A team's chat is its
 *     members, so there is nothing to keep in sync and no second object to
 *     get wrong. The organisers' room is a team nobody scores.
 *
 *  2. **The main room is EMOJI ONLY while a question is live.** In a pub a
 *     table confers quietly and nobody else hears. Online, a main room during
 *     a question is a channel for broadcasting the answer to everybody at once
 *     — instant, social, and far worse than googling. Emoji keeps the
 *     atmosphere and loses the cheating, and nobody has to be told a rule.
 *     Team rooms stay wide open the whole time, because conferring is what a
 *     team is FOR.
 *
 *  3. **Two-screens applies here as hard as it does to the answer key.** A
 *     team's messages must never reach another team and the organisers' room
 *     must never reach a player. A chat leak is worse than an answer leak: it
 *     is somebody's private conversation rather than a question they were
 *     going to be told in twenty seconds anyway.
 */

export const MAIN = 'main';
export const ORGANISERS = 'organisers';

/** A team's room. One place builds this string so nothing can disagree. */
export const teamRoom = (teamId) => `team:${teamId}`;

/**
 * How many messages a room keeps.
 *
 * Chat is the definition of "high frequency, low stakes" under the crash
 * recovery rule — a lost line is a lost joke — so it is debounced to disk
 * rather than flushed. It is also the first thing in this app that grows
 * without limit during a night, and the whole state is one JSON object that
 * gets rewritten: at 200 players the serialising cost is already the next
 * scaling ceiling, and an unbounded transcript would arrive there first.
 *
 * Sixty is about a screenful and a half on a phone, which is as far back as
 * anybody scrolls mid-quiz.
 */
export const KEEP_PER_ROOM = 60;

/** As long as a message may be. A paragraph is not banter. */
export const MAX_LENGTH = 240;

/**
 * Is this nothing but emoji (and spaces)?
 *
 * Used for the main room while a question is live. Written out rather than
 * pulled from a package, like every other thing in this codebase, and it works
 * by ELIMINATION: strip whitespace, emoji presentation marks, joiners, skin
 * tones and flags, then anything left that is a letter, a digit or ordinary
 * punctuation means it is a message rather than a reaction.
 *
 * Deliberately generous. The cost of wrongly ALLOWING something is one team
 * getting a hint to a question they had twenty seconds left on; the cost of
 * wrongly REFUSING is somebody's reaction bouncing with no explanation while
 * the clock runs, which reads as the app being broken. So the test is "does
 * this contain words", not "is every character on an approved list".
 */
export function isJustEmoji(text) {
  const bare = String(text || '')
    // Whitespace, the variation selectors that make an emoji an emoji, the
    // zero-width joiner that builds the family ones, and skin tones.
    .replace(/\s/gu, '')
    .replace(/[\u200d\ufe0e\ufe0f]/gu, '')
    .replace(/[\u{1f3fb}-\u{1f3ff}]/gu, '');
  if (!bare) return false;
  // Anything with a letter or a number in it is words.
  return !/[\p{L}\p{N}]/u.test(bare);
}

/**
 * Tidy a message, or refuse it.
 *
 * Control characters out and a length cap, exactly like a team name — which
 * this file follows deliberately: **there is no word filtering**, because the
 * host asked for none on names and the same reasoning holds. The control is
 * that the host sees every room and can remove somebody.
 *
 * Returns the cleaned text, or '' if there is nothing left worth sending.
 */
export function cleanMessage(text) {
  return String(text || '')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_LENGTH);
}

/**
 * Which rooms this player may read and write.
 *
 * The ONE function that decides it, so a leak is a bug in a place with a test
 * on it rather than a condition somebody forgot at a call site. Order matters
 * only for display: main first, because it is the pub.
 */
export function roomsFor(player) {
  if (!player) return [];
  const rooms = [MAIN];
  if (player.organiser) rooms.push(ORGANISERS);
  if (player.teamId) rooms.push(teamRoom(player.teamId));
  return rooms;
}

/**
 * May this land right now?
 *
 * `{ ok }` or `{ ok: false, reason }` — a reason rather than a bare no,
 * because the phone has to say WHY without making it sound like a fault.
 */
export function mayPost({ player, room, text, questionLive }) {
  if (!player) return { ok: false, reason: 'unknown' };
  if (!roomsFor(player).includes(room)) return { ok: false, reason: 'not_your_room' };
  const clean = cleanMessage(text);
  if (!clean) return { ok: false, reason: 'empty' };
  /*
   * The one rule anybody notices, and only in the main room.
   *
   * The organisers' room is exempt because "the projector has frozen" is
   * exactly the thing somebody needs to say WHILE a question is up, and those
   * are the three people who are not competing. A team room is exempt because
   * conferring is the point of a team.
   */
  if (questionLive && room === MAIN && !isJustEmoji(clean)) {
    return { ok: false, reason: 'emoji_only' };
  }
  return { ok: true, text: clean };
}

/** Add a message to a room's list, keeping it capped. Returns the message. */
export function append(chat, room, message) {
  const list = chat[room] || (chat[room] = []);
  list.push(message);
  if (list.length > KEEP_PER_ROOM) list.splice(0, list.length - KEEP_PER_ROOM);
  return message;
}

/**
 * What one person may SEE — the whole of the two-screens rule for chat.
 *
 * Built by picking the rooms they are in, never by taking everything and
 * hiding some of it, so a new room cannot become visible by being forgotten.
 */
export function visibleTo(chat, player) {
  const out = {};
  for (const room of roomsFor(player)) out[room] = (chat && chat[room]) || [];
  return out;
}
