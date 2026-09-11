/**
 * A DRINK OUTLIVES THE NIGHT IT WAS WON ON.
 *
 * Asked, after being told the drinks were "just for tonight": *"But the app
 * already remembers phones from previous weeks including their name, so I
 * don't understand why it can't just remember the drinks they've won as
 * well?"*
 *
 * **He is right, and the reason it did not was NOT that a phone has no
 * account.** A phone remembers itself perfectly well — its id, its token and
 * its team name sit in `localStorage` and come back weeks later, which is
 * exactly the mechanism being pointed at. The real reason was narrower and
 * fixable: **`/api/voucher` and `/api/voucher/redeem` read
 * `session.engine.state.vouchers`, and that state is replaced the moment the
 * next night launches.** The code was not forgotten; the only two routes that
 * could resolve one had stopped being able to see it.
 *
 * ---
 *
 * **NOTHING NEW IS COLLECTED, which is what makes this small.** `results()`
 * has filed `vouchers: Object.values(state.vouchers)` into every archived
 * night since the bar started scanning them, and `updateArchivedNight()`
 * already exists precisely because a drink is handed over minutes AFTER the
 * night is filed. The archive is backed up off the ephemeral disk, so it
 * already survives the deploys that wipe `data/`. The codes have been sitting
 * there the whole time with nothing able to look them up.
 *
 * **THE LIVE GAME IS ASKED FIRST, ALWAYS.** Tonight's scan takes exactly the
 * path it always took, through the engine, and reaches this file only when the
 * live game does not have the code. A pub night is the protected surface, and
 * a fallback that ran first would put a directory read in front of every scan
 * for a case that is rare on the night and normal a week later.
 *
 * **THE CODES ARE NOT SCATTERED THROUGH A LIST.** `listArchive()` deliberately
 * returns a count of redeemed vouchers and never the vouchers themselves — *"the
 * codes are somebody's to redeem rather than something to scatter through a
 * payload"*. That rule stands: this reads the night files one at a time looking
 * for ONE code somebody is holding, and never builds a list of them.
 *
 * **ONE ROOM, NEVER ACROSS ROOMS.** The directory is the room's own archive,
 * resolved by the caller from `roomForPhone()` exactly as the live lookup is.
 * A code from another quizmaster's pub is not a voucher here, which is the
 * answer `/api/voucher` has always given and the reason it says nothing about
 * which room, which night, or whether the code exists anywhere else.
 */

import fs from 'node:fs';
import path from 'node:path';
import { updateArchivedNight } from './library.js';

/**
 * The room's filed nights, newest first.
 *
 * Newest first because a code somebody is holding is overwhelmingly from the
 * last few weeks, and the scan stops at the first match — so the common case
 * is one file read rather than a walk of somebody's whole history. `mtimeMs`
 * rather than the filename: `updateArchivedNight()` rewrites a night when a
 * prize is taken, so the most recently TOUCHED night is also the most likely
 * to hold a live code.
 */
function nightsNewestFirst(dir) {
  let files = [];
  try {
    files = fs.readdirSync(dir).filter((f) => f.endsWith('.json'));
  } catch {
    return [];
  }
  return files
    .map((file) => {
      let at = 0;
      try { at = fs.statSync(path.join(dir, file)).mtimeMs; } catch { /* gone */ }
      return { file, at };
    })
    .sort((a, b) => b.at - a.at)
    .map((x) => x.file);
}

/**
 * Find one code among this room's filed nights.
 *
 * Returns `{ nightId, voucher }`, or null. **Null for anything unreadable**:
 * a night file that will not parse is not a reason for a bar's scanner to
 * throw, and the honest answer to "is this a voucher here" is then no.
 */
export function findInArchive(dir, code) {
  const want = String(code || '').toUpperCase();
  if (!want) return null;
  for (const file of nightsNewestFirst(dir)) {
    let record = null;
    try {
      record = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
    } catch {
      continue;
    }
    /* An ARRAY here and an OBJECT in the live state — `results()` files
       `Object.values()`. Reading it the wrong way finds nothing and says so
       quietly, which is why this is written down rather than assumed. */
    const found = (record.vouchers || []).find(
      (v) => v && String(v.code || '').toUpperCase() === want,
    );
    if (found) return { nightId: record.id || path.basename(file, '.json'), voucher: found };
  }
  return null;
}

/**
 * Take the drink, on a night that is already filed.
 *
 * **The same three answers the live path gives** — `unknown`, `already`, or
 * the redeemed voucher — so the two routes cannot disagree about what a scan
 * means. A voucher redeemed here is written back through
 * `updateArchivedNight()`, which is the function that exists for exactly this
 * and which puts the change on the backup.
 *
 * **The stamp is the SERVER's clock** (rule 2): a scanner is a phone, and the
 * time a drink was collected is evidence on somebody's filed night.
 */
export function redeemInArchive(dir, code, now = Date.now()) {
  const hit = findInArchive(dir, code);
  if (!hit) return { ok: false, reason: 'unknown' };
  if (hit.voucher.redeemedAt) return { ok: false, reason: 'already', voucher: hit.voucher };

  const file = path.join(dir, hit.nightId + '.json');
  let record = null;
  try {
    record = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return { ok: false, reason: 'unknown' };
  }
  const redeemed = { ...hit.voucher, redeemedAt: now, redeemedBy: 'scan' };
  const vouchers = (record.vouchers || []).map(
    (v) => (v && v.code === hit.voucher.code ? redeemed : v),
  );
  /* A night that cannot be written is NOT reported as redeemed — the bar
     would hand a drink over against a record that still says it is owed, and
     the next scan would hand over a second one. */
  if (!updateArchivedNight(dir, hit.nightId, { vouchers })) {
    return { ok: false, reason: 'unknown' };
  }
  return { ok: true, voucher: redeemed, nightId: hit.nightId };
}
