/**
 * A WORD IN ONE PERSON'S EAR — one copy, shared by both engines.
 *
 * Asked for on 11 September 2026: *"Is it possible for me to send a message to
 * a specific phone? Say someone is being a bit cheeky I can send them a
 * message saying 'stop being a cheeky dickhead' and it appears on their bingo
 * screen?"*
 *
 * ---
 *
 * **ONE PHONE, AND NEVER THE PROJECTOR.** That is rule 1 doing its job: the
 * big screen's payload is built field by field from a whitelist, so a note
 * cannot reach it by accident. It is also the whole point — a quiet word is
 * quiet, and the same sentence six feet wide in front of sixty people is a
 * quizmaster humiliating a customer.
 *
 * **IT IS NOT FILTERED, DELIBERATELY**, and the request makes that plain. This
 * app has no profanity filter in the room by decision, and this is the host
 * speaking to one person on his own night — the one direction where the words
 * are entirely his. What IS done is a length cap and stripping control
 * characters, which is hygiene rather than judgement.
 *
 * **IT STAYS UNTIL THEY TAP IT AWAY, AND THE HOST IS TOLD WHEN THEY DID** —
 * his own answer: *"until they tap it away but also let me know when they
 * did."* That second half is what makes the feature worth having rather than
 * merely possible: a message you cannot tell has landed is one you send twice,
 * or one you assume worked while somebody's phone is face down on a table.
 *
 * **A SHARED FILE RATHER THAN A COPY IN EACH ENGINE — `arcade.js`'s shape
 * exactly.** Both engines keep players in `state.players` with the same
 * fields; two copies of this would be two rules, and the day one is fixed is
 * the day a bingo night behaves differently from a quiz night for no reason
 * anybody chose. State in, result out: neither engine's `changed()` is called
 * from here, because when to flush is the engine's business.
 */

/**
 * The longest note.
 *
 * Long enough for a sentence somebody reads at a glance on a phone in a dark
 * pub, short enough that it cannot become a wall over somebody's bingo card.
 * A constant with a note rather than a setting, per this repo's own rule.
 */
export const MAX_NOTE = 200;

/**
 * Tidy the text without judging it.
 *
 * Control characters and newlines come out — a note is one line on a card, and
 * a newline is the only way markup-free text can change the shape of what is
 * drawn. **The words themselves are untouched.**
 */
export function cleanNote(text) {
  return String(text == null ? '' : text)
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_NOTE);
}

/**
 * Send it.
 *
 * **A NEW NOTE REPLACES THE OLD ONE RATHER THAN QUEUING.** Two messages
 * stacked on a phone is a conversation this app is not, and the second one is
 * almost always a correction of the first — so the newest wins and the read
 * receipt is about that one. Sending also clears `seenAt`, or the host would
 * see the previous message's tick against a note nobody has looked at.
 *
 * An empty note after cleaning is a REFUSAL rather than a silent no-op: a Send
 * button that reports success it did not have is this repo's commonest fault.
 */
export function sendNote(state, playerId, text, now) {
  const p = (state.players || {})[String(playerId)];
  if (!p) return { ok: false, reason: 'unknown_player' };
  const words = cleanNote(text);
  if (!words) return { ok: false, reason: 'empty' };
  p.note = { text: words, at: now, seenAt: null };
  return { ok: true, note: { ...p.note } };
}

/**
 * They tapped it away.
 *
 * **IDEMPOTENT, and the first `seenAt` is the one kept.** A phone that
 * re-sends on a flaky connection must not move the time the host is reading,
 * and a second tap is not a second reading.
 */
export function markNoteRead(state, playerId, now) {
  const p = (state.players || {})[String(playerId)];
  if (!p || !p.note) return { ok: false };
  if (!p.note.seenAt) p.note.seenAt = now;
  return { ok: true, seenAt: p.note.seenAt };
}

/**
 * What the PHONE is told.
 *
 * Nothing once it has been read — the card comes down and stays down, and a
 * payload that went on carrying it would put it back up on the next state
 * push. The `at` rides so the phone can tell a NEW note from the one it is
 * already showing.
 */
export function noteForPlayer(state, playerId) {
  const p = (state.players || {})[String(playerId)];
  if (!p || !p.note || p.note.seenAt) return null;
  return { text: p.note.text, at: p.note.at };
}

/**
 * What the HOST is told — every note sent tonight and whether it has landed.
 *
 * Keyed by player id because that is what the control view's own rows are
 * keyed by. **The read one is KEPT** rather than dropped: *"let me know when
 * they did"* means the tick has to still be there a minute later when he looks
 * down, not vanish at the moment it becomes good news.
 */
export function notesForHost(state) {
  const out = {};
  for (const [id, p] of Object.entries(state.players || {})) {
    if (p && p.note) out[id] = { text: p.note.text, at: p.note.at, seenAt: p.note.seenAt || null };
  }
  return out;
}
