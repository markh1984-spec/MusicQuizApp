/**
 * WRITE ROUTES — voucher. Moved whole out of `handleWrite()` in server.js;
 * the body is unchanged, it is one of the functions the shell tries in order.
 */
import { redeemInArchive } from './context.js';
import { readJson, sendJson } from './plumbing.js';
import { roomForPhone } from './identity.js';

export async function writeVoucher(req, res, url, route) {
  /*
   * ---- THE WINNER'S VOUCHER, and the bar redeeming it
   *
   * Open, with NO login, because the person scanning it is bar staff who have
   * never heard of this app. **The code IS the credential** — eight characters
   * of the join-code alphabet, so no vowels, nothing that spells a word and
   * none of the pairs people mistype. A wrong one finds nothing rather than a
   * near miss, exactly like a join code.
   *
   * The room comes from `?g=` like every other phone route, so nothing here
   * takes a room parameter it could be pointed at somebody else's night with.
   *
   * THE REDEMPTION IS THE WHOLE DESIGN. A phone screen can be screenshotted
   * and there is no fixing that on a device nobody controls — so the phone is
   * not what gets checked. The FIRST scan spends it here, on the server, and
   * every later one is told when it went. A copy is worthless because a copy
   * is not what is being verified.
   */
  if (route === '/api/voucher/redeem' && req.method === 'POST') {
    const body = await readJson(req);
    const room = roomForPhone(req, url, body);
    const live = room.session.engine?.redeemVoucher
      ? room.session.engine.redeemVoucher(String(body.code || ''), { by: 'scan' })
      : { ok: false, reason: 'unknown' };
    /*
     * The same fallback as the lookup above, and it must be the same ORDER:
     * the live game answers first, and the archive is asked only when it has
     * never heard of the code. Asking the archive first would let a stale
     * filed copy of tonight's voucher be taken while the live one still reads
     * as owed — two drinks for one win.
     *
     * `already` is NOT a reason to fall through: a voucher the live game has
     * already redeemed is answered by the live game.
     */
    const out = live.reason === 'unknown'
      ? redeemInArchive(room.paths.archive, String(body.code || ''), Date.now())
      : live;
    if (!out.ok && out.reason === 'unknown') {
      return sendJson(res, 404, { error: 'That code is not a voucher here.' }), true;
    }
    if (!out.ok && out.reason === 'already') {
      return sendJson(res, 409, {
        error: 'Already redeemed.',
        redeemedAt: out.voucher.redeemedAt,
      }), true;
    }
    return sendJson(res, 200, { ok: true, redeemedAt: out.voucher.redeemedAt }), true;
  }

  return false;
}
