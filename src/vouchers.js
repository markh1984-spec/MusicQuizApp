/**
 * WHAT SOMEBODY WON, AND THE CODE THEY SHOW AT THE BAR — for BOTH games.
 *
 * Written on 16 August 2026, when bingo was given prizes: *"bingo should get
 * prizes as well — as defined by the venue."* The quiz has had vouchers since
 * they were invented and `src/bingo.js` had the word in it zero times.
 *
 * **ONE DEFINITION, FOR THE SAME REASON `src/arcade.js` IS ONE SCOREBOARD.**
 * Two copies is two rules, and the day one of them is fixed is the day a bar
 * scans a code that works on a quiz night and does not work on a bingo night —
 * in front of the customer, with the quizmaster's name on it. The redeem route
 * and the `/v` page call `session.engine.redeemVoucher()` and have never cared
 * which game is running; that stays true because both engines call the same
 * function underneath.
 *
 * The state each engine keeps is identical: `state.vouchers`, an object keyed
 * by code. Nothing here knows about rounds, questions, lines or scores — a
 * voucher is a name, a prize and a code, and which of those two games issued
 * it is not its business.
 *
 * **A VOUCHER COPIES ITS PRIZE AT THE MOMENT IT IS MADE**, rather than
 * pointing at wherever the prizes are kept. Somebody holding a phone that says
 * "a bottle of wine" must never be re-pointed at something cheaper because the
 * arrangement was edited later in the evening.
 */

/*
 * The alphabet a code is drawn from. No 0/O and no 1/I/L, because this gets
 * read aloud across a bar and typed by somebody who has had a few. Unlike a
 * join code this one is a CREDENTIAL, because the bar has no login and holding
 * the code is the whole proof. A wrong code finds nothing rather than a near
 * miss, exactly like a join code.
 */
const VOUCHER_ALPHABET = '23456789BCDFGHJKMNPQRSTVWXYZ';

export function newVoucherCode(length = 8) {
  const bytes = new Uint8Array(length);
  globalThis.crypto.getRandomValues(bytes);
  let out = '';
  for (let i = 0; i < length; i++) out += VOUCHER_ALPHABET[bytes[i] % VOUCHER_ALPHABET.length];
  return out;
}

/**
 * Mint one, unless this winner already holds one.
 *
 * `key` is what "already holds one" means, and the two games answer it
 * differently on purpose: a quiz issues to a BOARD ROW, so a team of six gets
 * one drink between them; bingo issues per STAGE, because winning a line and
 * later the full house is two prizes to the same person by design.
 *
 * Returns the voucher, or null when there was already one for that key.
 */
export function mintVoucher(state, {
  key, winnerId, name, place = 1, reward, venue = '', at, extra = {},
}) {
  if (!state.vouchers) state.vouchers = {};
  // `winnerId` is the fallback so vouchers minted before `key` existed still
  // count as held — a restored night must not mint a second code for somebody
  // already holding one.
  const held = Object.values(state.vouchers).some((v) => (v.key || v.winnerId) === key);
  if (held) return null;
  let code = newVoucherCode();
  while (state.vouchers[code]) code = newVoucherCode();
  const voucher = {
    code,
    // What makes it idempotent. Stored so a restart cannot mint a second.
    key,
    winnerId,
    name,
    place,
    reward,
    venue,
    issuedAt: at,
    redeemedAt: null,
    reinstated: 0,
    history: [],
    ...extra,
  };
  state.vouchers[code] = voucher;
  return voucher;
}

/**
 * Spend it.
 *
 * **THE FIRST SCAN WINS AND EVERY LATER ONE IS TOLD SO**, which is the whole
 * reason a screenshot does not break this: the phone is not what gets checked,
 * the server is. `by` is who did it — the bar scanning, or the host doing it by
 * hand when the bar's phone cannot reach us.
 */
export function redeemVoucher(state, code, { by = 'scan', at }) {
  const v = (state.vouchers || {})[String(code || '').toUpperCase()];
  if (!v) return { ok: false, reason: 'unknown' };
  if (v.redeemedAt) return { ok: false, reason: 'already', voucher: v };
  v.redeemedAt = at;
  v.history.push({ what: 'redeemed', by, at });
  return { ok: true, voucher: v };
}

/** The bar's phone could not reach us, or it was scanned by mistake. */
export function reinstateVoucher(state, code, { at }) {
  const v = (state.vouchers || {})[String(code || '').toUpperCase()];
  if (!v) return { ok: false, reason: 'unknown' };
  if (!v.redeemedAt) return { ok: false, reason: 'not_redeemed', voucher: v };
  v.history.push({ what: 'reinstated', by: 'host', at, was: v.redeemedAt });
  v.redeemedAt = null;
  v.reinstated += 1;
  return { ok: true, voucher: v };
}

/** The one a given winner holds, or null. Used to build a phone's payload. */
export function voucherFor(state, key) {
  return Object.values(state.vouchers || {}).find((v) => (v.key || v.winnerId) === key) || null;
}
