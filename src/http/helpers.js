/**
 * BACKUPS, RESTORES AND THE HELPERS THAT SAT BETWEEN THE TWO ROUTE HANDLERS. Moved whole from server.js — the backup/restore machinery (restoreOnce and the four ensure*Restored move together, with their Sets), and the domain helpers for invoices, owner money, adverts and pack liveness that were interleaved with them. Cut per function into their own homes when there is a reason to.
 */
import { FEATURES, HOUSE, PHASES, accounts, backupPath, can, checkAccess, config, countOwn, deleteFile, dropNight, flagKey, fs, fullLibrary, getFile, githubConfigured, hooks, moderationConfigured, scorePhoto, setPhotoFlag, spendRecorder, isCleanForPublic, isComposed, leaguesRunning, listAdvertPacks, listArchive, loadQuiz, mergeGigs, packsRepoConfigured, path, paths, photoFolder, photosRepoConfigured, privateRepoConfigured, propUse, putFile, putFiles, readPack, readStats, statsReadable, reports, restoreArchive, rooms, safeAdvertFile, serialiseArchive, spend, suggestions, sameVenue, teamKey, toPence, totals, tryGetFile, tryListDir, venueKeyOf, venueKeysFor } from './context.js';
import { whoIs } from './identity.js';
import { pushState } from './views.js';

/**
 * Whether the GitHub backup actually works, not just whether it is configured.
 * Checked at most every five minutes so the console can say "token rejected"
 * up front rather than letting you find out after generating a quiz.
 */
export let backupCheck = { at: 0, result: null };
export async function backupStatus() {
  if (!githubConfigured()) return { ok: false, error: 'not set up' };
  /*
   * A GOOD ANSWER IS KEPT FOR FIVE MINUTES, A BAD ONE FOR ONE. It used to
   * keep only the good one, so with GitHub gone quiet every console load
   * paid a full read deadline to be told the same thing — on the request the
   * console cannot draw without. A minute is long enough that a bad hour
   * costs one wait, and short enough that "backup working again" is not an
   * hour late. `scripts/github-down.mjs`.
   */
  const keepFor = backupCheck.result && backupCheck.result.ok ? 5 * 60 * 1000 : 60 * 1000;
  if (backupCheck.result && Date.now() - backupCheck.at < keepFor) return backupCheck.result;
  let result;
  try {
    result = await checkAccess();
  } catch (err) {
    result = { ok: false, error: err.message };
  }
  backupCheck = { at: Date.now(), result };
  return result;
}


/**
 * File a pack into the repository so it survives a restart.
 *
 * Never throws and never blocks what you were doing — a failed backup is
 * reported and moved on from, because losing the pack you just made because
 * the backup failed would be daft.
 */
/**
 * Open a streaming progress response, and keep it open.
 *
 * Generation spends a minute or more inside one Claude call with nothing to
 * report. Write nothing for that long and something between here and the
 * browser — a proxy, a load balancer, the free tier — is entitled to hang up,
 * and then the console is left holding a stream that ended with no result.
 * That is exactly what it looked like from the host's side: the log stopped at
 * "writing 15 questions…" and never said another word.
 *
 * So a PING goes down the wire every fifteen seconds. The console skips them.
 */
export function progressStream(res) {
  res.writeHead(200, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    'X-Accel-Buffering': 'no',
  });
  const write = (line) => { try { res.write(line + '\n'); } catch { /* client left */ } };
  const beat = setInterval(() => write('PING'), 15_000);
  if (beat.unref) beat.unref();
  return {
    log: write,
    end() { clearInterval(beat); res.end(); },
  };
}

export async function backUp(relPath, contents, message, log = () => {}) {
  if (!githubConfigured()) {
    log(`not backed up — GitHub backup is not set up, so this will be lost when the app restarts`);
    return { ok: false };
  }
  const result = await putFile(relPath, contents, message);
  log(result.ok
    ? `backed up to GitHub — this one is permanent`
    : `saved here, but NOT backed up: ${result.error}`);
  return result;
}

/**
 * Back a whole batch up as one commit.
 *
 * **The point is what it is NOT: a commit per file inside the loop that made
 * them.** That is what stopped a picture round at seven of ten — every
 * portrait was two sequential GitHub round trips wedged in between the Google
 * calls, so the backup took longer than the drawing and the whole job ran long
 * enough for something in between to hang up.
 *
 * Nothing to file is silent rather than reassuring: "backed up 0 pictures" is
 * a line that means nothing on a quiz with no picture round.
 */
export async function backUpMany(files, message, log = () => {}) {
  const list = (files || []).filter(Boolean);
  if (!list.length) return { ok: true, count: 0 };
  if (!githubConfigured()) {
    log('NOT backed up — GitHub backup is not set up, so these are lost when the app restarts');
    return { ok: false };
  }
  const result = await putFiles(list, message);
  log(result.ok
    ? `${result.count} backed up to GitHub — they will survive a restart`
    : `saved here, but NOT backed up: ${result.error}`);
  return result;
}

/**
 * Back up the no-repeats memory.
 *
 * It matters as much as the pack it came with. Without it the rule quietly
 * forgets everything on the next restart, and the app then cheerfully hands a
 * regular the same forty songs it gave them last month — with nothing on screen
 * to say anything went wrong.
 *
 * Every route that adds to the history calls this. Generating did; IMPORTING
 * DID NOT, which was invisible right up until importing became the main way
 * packs get made.
 *
 * Never throws: the pack is already saved by this point and a GitHub problem
 * must not turn a finished job into a failed one.
 */
/**
 * Back up the invoice book.
 *
 * To the PRIVATE repository, never the main one. The main one is public, and
 * this file holds customer addresses and the host's own sort code and account
 * number — committing that to a public repo is not something you can undo,
 * because git history is forever. Same reasoning as the photos, same repo.
 *
 * There is no persistent disk on the free tier, so without this an invoice
 * survives exactly until the next deploy. That is why every route that changes
 * anything reports `backedUp` and the console says so out loud: an invoice you
 * think you have a record of and do not is worse than no record at all.
 */
/**
 * The file one room's invoice book is backed up as.
 *
 * The house keeps the original name, so the backup Mark already has in the
 * private repo carries on being read and written exactly as before. Only an
 * additional quizmaster gets a file of their own — and it has to BE their own,
 * because an invoice book holds customer addresses and a sort code.
 */
export function invoiceBackupName(room) {
  return room.id === HOUSE ? 'invoicing.json' : `invoicing-${room.id}.json`;
}

/**
 * A REQUEST WAITS FOR A BACKUP THIS LONG AND NO LONGER.
 *
 * Sign-in, every invoice write and publishing a night all `await` their
 * backup before answering, and each had a reason (the sign-in's is written
 * above its call). What none of them meant was *and if GitHub has gone quiet,
 * hold the browser for the whole deadline* — `scripts/github-down.mjs`
 * measured a sign-in at one full timeout and a venue save at two, ten
 * minutes before a gig being exactly when somebody does both. So the write
 * is still started, still finishes in the background, and still logs; the
 * REQUEST stops waiting for it after this long and answers `ok: false`,
 * which every caller already handles as "not confirmed". On a good day
 * GitHub answers in well under a second and nothing changes.
 */
export const BACKUP_WAIT_MS = Number(process.env.BACKUP_WAIT_MS) || 3_000;
export async function within(promise, ms = BACKUP_WAIT_MS) {
  let timer;
  /*
   * **`late` IS NOT A FAILURE, AND IT IS MARKED SO IT CANNOT BE READ AS ONE.**
   * The write is still running and will still land — that is this function's
   * whole design — so a warning here would say a night was not backed up about
   * a night that was, on any GitHub morning slower than the budget.
   * `github-down.mjs` has measured a sign-in at one full timeout and a venue
   * save at two, so it is a normal bad morning rather than a rare one. Callers
   * that only ask `ok` are unchanged; `saidSo()` reads `late` and stays quiet.
   */
  const late = new Promise((resolve) => { timer = setTimeout(() => resolve({ ok: false, late: true, error: `still writing after ${ms}ms` }), ms); });
  if (timer.unref) timer.unref();
  try {
    return await Promise.race([promise, late]);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * ---- A BACKUP THAT FAILED HAS TO SAY SO, AND FOR SIX WEEKS NONE OF THEM DID.
 *
 * Found on 19 September 2026. The private repository held **two `Update
 * accounts` commits from 9 August and nothing else** — not one `Update past
 * nights`, not one `Update invoices`, not one `Update join codes` — across six
 * weeks and five gigs, because `PHOTO_TOKEN` had stopped being able to write and
 * every one of these swallows its own answer: `backUpArchive()` catches and
 * returns `{ok:false}`, and `onArchive` in `context.js` calls it with
 * `.catch(() => {})`. Nothing asked. Nothing looked. `data/` is wiped on every
 * deploy and there is no disk, so **the backup IS the data** — and the record of
 * five nights, every venue, every prize and every photo overlay lasted exactly
 * until the next push.
 *
 * It surfaced as *"we seem to have lost the overlay"*, which is the smallest
 * possible symptom of the whole archive being gone.
 *
 * So every backup goes through here on its way back. `console.warn` is WRAPPED
 * by the flight recorder (`src/flight.js`), so a failure lands on the Help tab
 * with its reason and can be pasted into a chat — the mechanism this app already
 * has for *a broken night writes itself down*, pointed at the one class of
 * failure that had no voice at all.
 *
 * **It never changes the answer and never throws** — these run mid-night, and a
 * bad GitHub hour may not be felt by a room. Only whether anybody can find out.
 */
function saidSo(what, result) {
  // STILL WRITING IS NOT A FAILURE — see `within()`. Warning on it would fire on
  // nights that were backed up perfectly, which is how a line nobody trusts is
  // made: the host is taught to skim the one sentence he is meant to act on.
  if (result && result.late) return result;
  if (!result || result.ok === false) {
    console.warn(`[backup] ${what} was NOT backed up:`, (result && result.error) || 'unknown');
  }
  return result;
}

export async function backUpInvoices(room) {
  if (!privateRepoConfigured()) return saidSo('the invoice book', { ok: false, error: 'no private repo set up' });
  try {
    return saidSo('the invoice book', await within(putFile(invoiceBackupName(room), room.invoices.serialise(), 'Update invoices', 'private')));
  } catch (err) {
    return saidSo('the invoice book', { ok: false, error: err.message });
  }
}

/**
 * The file one room's night archive is backed up as.
 *
 * Same shape as the invoice book's, and the house keeps a plain name for the
 * same reason. It goes to the PRIVATE repo: an archive is a record of who
 * played somebody's nights and what they scored, which is theirs rather than
 * the public repo's.
 */
export function archiveBackupName(room) {
  return room.id === HOUSE ? 'archive.json' : `archive-${room.id}.json`;
}

/**
 * Keep a quizmaster's past nights.
 *
 * **Without this the archive is wiped on every deploy**, because it lives in
 * `data/` and the free tier has no permanent disk. That was tolerable while it
 * was a curiosity nothing pointed at. It is not tolerable now Past gigs is a
 * quizmaster's record of their own work — the thing they show a venue they are
 * pitching to — and "everything you have ever run" going blank because somebody
 * else pushed a commit is the worst version of a lost record: it looks like the
 * app forgot on purpose.
 *
 * Never awaited by anything a room can feel. It is called when a night ends,
 * which is the moment the projector is showing a scoreboard and nobody is
 * waiting on the server.
 */
export async function backUpArchive(room) {
  if (!privateRepoConfigured()) return saidSo('a night', { ok: false, error: 'no private repo set up' });
  try {
    return saidSo('a night', await within(putFile(archiveBackupName(room), serialiseArchive(room.paths.archive), 'Update past nights', 'private')));
  } catch (err) {
    return saidSo('a night', { ok: false, error: err.message });
  }
}

/**
 * Bring one room's past nights back, once per boot.
 *
 * Only into an EMPTY archive, the same rule as everything else here — a disk
 * that already has nights on it is ahead of any backup. Rooms are made lazily,
 * so for anybody but the house this happens the first time they open their
 * console, and it is awaited there: a Past gigs page drawn while this was still
 * running would show an empty shelf, which looks exactly like the work having
 * been lost.
 */
/**
 * ONCE PER ROOM PER BOOT — AND ONLY IF IT ACTUALLY WORKED.
 *
 * **All four restores latched BEFORE they awaited**, which turned one bad
 * morning at GitHub into permanent data loss: a single 403 on the first read
 * after a deploy marked the room restored with nothing restored, and the
 * public league came back empty, `report.pdf` 404'd and Past gigs showed zero
 * nights — for the whole process lifetime, with the backup intact and nothing
 * logged anywhere. It looks exactly like the app having forgotten on purpose,
 * which is the one thing the archive backup exists to prevent.
 *
 * Latching AFTER is not enough on its own: a console opening two tabs would
 * then run the restore twice at once and both would write. So a room in flight
 * holds its promise and later callers await the same one.
 *
 * **A 404 IS A SUCCESS.** There genuinely is no backup yet on a first boot,
 * and retrying that on every request would be a GitHub call per page open. The
 * distinction comes from `tryGetFile()`/`tryListDir()`, which is what those two
 * exist for.
 *
 * @param {Set} done   the module's own "restored" set, kept per kind
 * @param {Map} inFlight the in-flight promises, same key
 * @param {string} id  the room
 * @param {function} run  does the restore; RESOLVES only when it read cleanly
 */
/**
 * A RESTORE THAT FAILED IS TRIED AGAIN — BUT NOT ON EVERY REQUEST.
 *
 * "Never latched" is the rule above and it stands: a bad morning at GitHub
 * must not be remembered as "there were no past nights". But retried on
 * every request, a hung GitHub made every console load wait a full read
 * deadline for the same answer. So a failure is remembered for
 * `RESTORE_BACKOFF_MS` and the next request inside that window draws with
 * what is on disk; the one after it asks again. Keyed per latch set, per room.
 */
export const RESTORE_BACKOFF_MS = 60_000;
export const restoreFailedAt = new WeakMap();   // done Set -> Map<id, ms>
export async function restoreOnce(done, inFlight, id, run) {
  if (done.has(id)) return;
  if (inFlight.has(id)) { await inFlight.get(id); return; }
  if (!restoreFailedAt.has(done)) restoreFailedAt.set(done, new Map());
  const failed = restoreFailedAt.get(done);
  if (failed.has(id) && Date.now() - failed.get(id) < RESTORE_BACKOFF_MS) return;
  const going = (async () => {
    const ok = await run();
    // `undefined` from a restore that never says is treated as success, so a
    // future one that forgets to return cannot retry on every request.
    if (ok !== false) { done.add(id); failed.delete(id); } else failed.set(id, Date.now());
  })().finally(() => inFlight.delete(id));
  inFlight.set(id, going);
  await going;
}

export const archiveRestored = new Set();
export const archiveInFlight = new Map();
export async function ensureArchiveRestored(room) {
  await restoreOnce(archiveRestored, archiveInFlight, room.id, async () => {
    if (!privateRepoConfigured()) return true;
    const read = await tryGetFile(archiveBackupName(room), 'private');
    if (!read.ok) {
      // Never fatal. GitHub having a bad morning must not stop a quiz night —
      // but it must not be remembered as "there were no past nights" either.
      console.warn(`[archive] could not fetch the backup for ${room.id}:`, read.error);
      return false;
    }
    if (!read.body) return true;
    const result = restoreArchive(room.paths.archive, read.body.toString('utf8'));
    if (result.ok && result.nights) console.log(`[archive] restored ${result.nights} past night(s) for ${room.id}`);
    return true;
  });
}

/*
 * ---- A venue's slides, and the backup that was still shared
 *
 * **This is the loud one, and it was live.** Advert sets were moved to a folder
 * per room when rooms were built, and CLAUDE.md records why: one folder meant a
 * second quizmaster tidying what looked like their own venue list would delete
 * The Crown's set off Mark's projector. The DISK was fixed. **The BACKUP was
 * not** — every room's set was written to `adverts/<id>.json` in the MAIN repo,
 * with no room anywhere in the path. So the moment Rob saved a set whose id
 * matched one of Mark's:
 *
 *   - it overwrote Mark's file in the repository,
 *   - deleting his deleted Mark's,
 *   - and Rob's venue's offers and their ticket-sales QR went into a PUBLIC
 *     repository, where git history is forever.
 *
 * The house keeps `adverts/<id>.json` in the main repo, deliberately: those are
 * Mark's, they are committed on purpose (see the note in `.gitignore`), and the
 * live app builds from git. Everybody else goes to the PACKS repository under
 * their own room — the same boundary as their own quizzes, for the same reason.
 * Not the owner's private repo, which holds the owner's business records, and
 * obviously not the public one.
 */
export function advertBackup(room, id) {
  const file = safeAdvertFile(id);
  return room.id === HOUSE
    ? { path: `adverts/${file}`, which: 'app', ready: githubConfigured() }
    : { path: `adverts/${room.id}/${file}`, which: 'packs', ready: packsRepoConfigured() };
}

export async function backUpAdverts(room, id, contents) {
  const { path: at, which, ready } = advertBackup(room, id);
  if (!ready) {
    return { ok: false, error: room.id === HOUSE ? 'GitHub backup is not set up' : 'no packs repository set up' };
  }
  try {
    return await putFile(at, contents, `Adverts: ${id}`, which);
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

export async function deleteAdvertBackup(room, id) {
  const { path: at, which, ready } = advertBackup(room, id);
  if (!ready) return { ok: false };
  try {
    return await deleteFile(at, `Delete adverts: ${id}`, which);
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

/**
 * Bring one room's venue slides back, once per boot.
 *
 * Only the additional rooms: the house's live in the main repo and arrive with
 * the deploy, exactly as they always have. Only into an EMPTY folder, same rule
 * as everything else, and awaited where the console reads them so a quizmaster
 * is never shown an empty venue list that looks like lost work.
 */
export const advertsRestored = new Set();
export const advertsInFlight = new Map();
export async function ensureAdvertsRestored(room) {
  if (room.id === HOUSE || !packsRepoConfigured()) return;
  await restoreOnce(advertsRestored, advertsInFlight, room.id, async () => {
    if (listAdvertPacks(room.paths.adverts).length) return true;   // disk wins, always
    const listing = await tryListDir(`adverts/${room.id}`, 'packs');
    if (!listing.ok) {
      console.warn(`[adverts] could not list ${room.id}:`, listing.error);
      return false;
    }
    let missed = 0;
    for (const file of listing.files) {
      if (!file.name.endsWith('.json')) continue;
      const read = await tryGetFile(file.path, 'packs');
      // A file that could not be READ leaves the room half restored, so the
      // latch is withheld and the next console open tries the lot again —
      // `saveOwn()`'s "disk wins" rule then makes the retry a no-op for
      // whatever did land.
      if (!read.ok) { missed += 1; continue; }
      if (!read.body) continue;
      fs.mkdirSync(room.paths.adverts, { recursive: true });
      fs.writeFileSync(path.join(room.paths.adverts, safeAdvertFile(file.name)), read.body);
    }
    if (listing.files.length) console.log(`[adverts] restored ${listing.files.length - missed} venue set(s) for room ${room.id}`);
    return missed === 0;
  });
}

/**
 * Keep the join codes.
 *
 * **A code that changes is a printed QR that stops working**, and they lived in
 * `data/` with no backup at all — so every deploy silently reissued every
 * additional quizmaster's four letters. It could sit there unnoticed precisely
 * because the house room has no code: Mark's own card was always safe, and the
 * only person it broke was the second login, which nobody has yet.
 *
 * The private repo rather than the packs one: this is a mapping the OWNER
 * administers, like the accounts book it is keyed by, not somebody's own work.
 */
/*
 * ONE WRITE AT A TIME, AND THE NEWEST BOOK WINS.
 *
 * `saveCodes()` fires this on every mint, so one page load of the Subscribers
 * tab sent N concurrent unawaited PUTs of the same file — each carrying the
 * snapshot taken when IT was queued, each racing the others' shas, and every
 * failure swallowed by `.catch(() => {})`. Reproduced against a sha-conflict
 * stub: six codes minted, two backed up, and after a wipe-and-restart **four
 * of six quizmasters' printed QR codes had changed.**
 *
 * Queued, so two writes cannot conflict; and only the LATEST snapshot is sent,
 * which is safe precisely because each one is the WHOLE book — a later
 * snapshot contains every code an earlier one had. That is the half a plain
 * queue would get wrong.
 *
 * And a failure is said out loud. A silent one here is a printed QR that stops
 * working after a deploy, found by a room standing in front of a projector.
 */
export let codesWriting = Promise.resolve();
export let codesPending = null;
export function backUpCodesSoon(serialised) {
  codesPending = serialised;
  codesWriting = codesWriting.then(async () => {
    if (codesPending === null) return;
    const body = codesPending;
    codesPending = null;
    // `backUpCodes` says so for itself now, in `saidSo`'s one wording. Two
    // warnings for one failure reads as two failures.
    await backUpCodes(body);
  }, () => {});
  return codesWriting;
}

export async function backUpCodes(serialised) {
  /*
   * THE JOIN CODES WERE THE ONE THAT ALREADY SPOKE UP, and it is worth keeping
   * why: a code book that does not land is a printed QR that stops resolving in
   * front of a room. **Quiet where there is no private repo at all** — a dev box
   * is not a lost code — which is why the refusal below is the silent one.
   */
  if (!privateRepoConfigured()) return { ok: false, error: 'no private repo set up' };
  try {
    return saidSo('the join code book', await putFile('room-codes.json', serialised, 'Update join codes', 'private'));
  } catch (err) {
    return saidSo('the join code book', { ok: false, error: err.message });
  }
}

/**
 * Back up the accounts.
 *
 * To the PRIVATE repository, for the same reason as the invoices and more so:
 * this file is every subscriber's email address, their password hash and their
 * payment reference. The main repo is public and git history is forever.
 */
export async function backUpAccounts() {
  if (!privateRepoConfigured()) return saidSo('the accounts book', { ok: false, error: 'no private repo set up' });
  try {
    return saidSo('the accounts book', await within(putFile('accounts.json', accounts.serialise(), 'Update accounts', 'private')));
  } catch (err) {
    return saidSo('the accounts book', { ok: false, error: err.message });
  }
}

/**
 * Bring the accounts and the invoice book back from the private repository.
 *
 * This is the other half of a mechanism that was only ever half built: both
 * files were backed up faithfully and nothing ever read them again. On Render's
 * free tier there is no permanent disk, so `data/` is empty on every boot — the
 * login you made last week had quietly stopped existing, and the only clue was
 * being asked to sign in again.
 *
 * Only ever restores into an EMPTY file. Reading a backup over live data would
 * sign everybody out and could roll a password change back to the one before
 * it, so a disk that already has accounts on it always wins.
 *
 * Deliberately not fatal. A missing backup is the normal first boot, and a
 * GitHub that is having a bad morning must not stop a quiz night starting — the
 * host key still works either way.
 */
/**
 * EVERYTHING COMES BACK AT ONCE, AND A GITHUB THAT CANNOT BE REACHED IS
 * RETRIED RATHER THAN FORGOTTEN.
 *
 * This runs BEFORE `server.listen()`, deliberately (see the call site). It
 * used to be nine reads in a row, each awaited — so with GitHub hung the
 * boot took nine timeouts before the app answered a single request, and
 * before `GITHUB_TIMEOUT_MS` existed it took for ever. The reads are of
 * different files into different stores and none depends on another, so
 * they go out together: one round trip on a good day, one timeout on a bad
 * one. `scripts/github-down.mjs` measures exactly that.
 *
 * AND THE TWO THAT A NIGHT CANNOT RUN WITHOUT ARE ASKED AGAIN. `getFile()`
 * says `null` for "nothing there" and "could not look" alike — right for a
 * first boot, wrong for the accounts book: a deploy during a bad hour at
 * GitHub came up with no accounts, nobody could sign in, and NOTHING tried
 * again until the next restart. The accounts and the join codes are read
 * through `tryGetFile()`, which keeps the distinction, and a failed read
 * schedules another go a minute later, for as long as it keeps failing. Every
 * block only ever fills an EMPTY store, so a retry can never write a backup
 * over tonight's data.
 */
export async function restoreFromBackup() {
  if (!privateRepoConfigured()) {
    if (!accounts.all.length) {
      console.warn('[accounts] no accounts and no private repo configured — the host key is the only way in.');
    }
    return;
  }
  let unreachable = false;
  const restoreAccounts = async () => {
    if (accounts.all.length) return;
    const read = await tryGetFile('accounts.json', 'private');
    if (!read.ok) { unreachable = true; console.warn('[accounts] could not reach the backup:', read.error); return; }
    if (read.body) {
      const result = accounts.restore(read.body.toString('utf8'));
      if (result.ok) console.log(`[accounts] restored ${result.accounts} account(s) from the private repository`);
      else console.warn('[accounts] could not restore the backup:', result.reason);
    } else {
      console.log('[accounts] nothing backed up yet — this is a first boot, or nobody has been added.');
    }
  };
  const restoreStore = (name, store, file, label) => async () => {
    if (!store.isEmpty()) return;
    const saved = await getFile(file, 'private');
    if (!saved) return;
    const result = store.restore(saved.toString('utf8'));
    if (result.ok) console.log(`[${name}] restored ${label(result)}`);
  };
  /*
   * The join codes, before anybody's phone arrives.
   *
   * This one has to be at BOOT rather than lazily, and that is the whole point:
   * a phone scanning a printed QR is often the first thing to touch a room
   * after a restart, and by then it is too late to discover the code should
   * have been something else.
   */
  const restoreCodes = async () => {
    const read = await tryGetFile('room-codes.json', 'private');
    if (!read.ok) { unreachable = true; console.warn('[rooms] could not reach the join-code backup:', read.error); return; }
    if (!read.body) return;
    const result = rooms.restoreCodes(read.body.toString('utf8'));
    if (result.ok) console.log(`[rooms] restored ${result.codes} join code(s) from the private repository`);
  };
  /*
   * Play counts, and the same rule as everything else: only into an empty
   * file. A disk that already has counts on it is ahead of any backup, and
   * writing the backup over it would undo tonight's launches.
   */
  const restoreStats = async () => {
    // READABLE, NOT MERELY PRESENT: the guard was `existsSync`, which a
    // TRUNCATED file satisfies — so the one state this rescues was the one it
    // refused to act on, every boot, in silence. Reasoning in `library.js`.
    if (statsReadable(config.dataDir)) return;
    const saved = await getFile('library-stats.json', 'private');
    if (!saved) return;
    try {
      const text = saved.toString('utf8');
      JSON.parse(text); // refuse a corrupt backup rather than write it back
      fs.mkdirSync(config.dataDir, { recursive: true });
      fs.writeFileSync(statsFile, text, 'utf8');
      console.log('[library] restored play counts from the private repository');
    } catch (err) {
      console.warn('[library] could not restore play counts:', err.message);
    }
  };

  await Promise.all([
    restoreAccounts(),
    restoreStore('reports', reports, 'reports.json', (r) => `${r.reports} question report(s)`)(),
    restoreStore('suggestions', suggestions, 'suggestions.json', (r) => `${r.suggestions} suggestion(s)`)(),
    restoreStore('spend', spend, 'spend.json', (r) => `${r.rows} row(s) of what the AI has cost`)(),
    // The prop tally. `data/` is wiped on every deploy, so without this it
    // would reset several times a week and never reach the threshold where
    // its numbers mean anything — the backup IS the storage here.
    restoreStore('props', propUse, 'data/prop-use.json', (r) => `the tally for ${r.props} prop(s)`)(),
    // The house invoice book and past nights. Every other room's come back
    // the first time that quizmaster opens their console, because rooms are
    // created lazily and this runs once at boot — see ensureInvoicesRestored.
    ensureInvoicesRestored(rooms.get(HOUSE)),
    ensureArchiveRestored(rooms.get(HOUSE)),
    restoreCodes(),
    restoreStats(),
  ].map((p) => p.catch((err) => console.warn('[restore] failed:', err.message))));

  if (unreachable) {
    console.warn(`[restore] GitHub could not be reached — trying again in ${RESTORE_RETRY_MS / 1000}s`);
    setTimeout(() => { restoreFromBackup().catch(() => {}); }, RESTORE_RETRY_MS).unref();
  }
}
/** How long to wait before asking GitHub again for a backup it could not hand over. */
export const RESTORE_RETRY_MS = 60_000;
/**
 * Bring one room's invoice book back from the private repo, once.
 *
 * The care it needs is all inside `invoices.restore()`: the counter is rebuilt
 * from the invoices themselves rather than trusted from the file, so a backup
 * written a few minutes before the last invoice went out still cannot hand out
 * a number twice.
 *
 * Only ever into an EMPTY book, like the accounts — a disk that already has
 * invoices on it is ahead of any backup. And only once per room per boot,
 * tracked here rather than asking GitHub every time the tab is opened.
 */
export const invoicesRestored = new Set();
export const invoicesInFlight = new Map();
export async function ensureInvoicesRestored(room) {
  await restoreOnce(invoicesRestored, invoicesInFlight, room.id, async () => {
    if (!privateRepoConfigured() || !room.invoices.isEmpty()) return true;
    const read = await tryGetFile(invoiceBackupName(room), 'private');
    if (!read.ok) {
      // Never fatal, and never latched — see `restoreOnce()`.
      console.warn(`[invoices] could not fetch the backup for ${room.id}:`, read.error);
      return false;
    }
    if (!read.body) return true;
    const result = room.invoices.restore(read.body.toString('utf8'));
    if (result.ok) {
      console.log(`[invoices] restored ${result.invoices} invoice(s) and ${result.customers} customer(s) for ${room.id}; next number ${result.nextNumber}`);
    } else {
      console.warn(`[invoices] could not restore ${room.id}:`, result.reason);
    }
    return true;
  });
}

/**
 * THE VENUE'S FRAME FOR A PUBLISHED NIGHT, resolved server-side for the public
 * gallery, which cannot reach the owner-gated invoice route. The join is from
 * the night's archived venue — id first, then a lowercase name match
 * (`sameVenue()`) — so a visitor names a NIGHT, never a venue id. Returns the
 * overlay data URL, or '' when the night has no venue or the venue no overlay.
 * Full reasoning in `docs/gigs/gallery-page.md`.
 */
export async function venueOverlayFor(roomId, night) {
  const room = rooms.get(roomId);
  await ensureArchiveRestored(room);
  const rec = mergeGigs(listArchive(room.paths.archive), []).find((g) => g.night === night);
  if (!rec) return '';
  await ensureInvoicesRestored(room);
  const customers = (room.invoices && room.invoices.customers) || [];
  const named = String(rec.venue || '').trim().toLowerCase();
  const found = (rec.venueId && customers.find((c) => c.id === rec.venueId))
    || (named ? customers.find((c) => String(c.name || '').trim().toLowerCase() === named) : null);
  return (found && found.overlay) || '';
}

/**
 * Back up the reports.
 *
 * The private repo like everything else in data/, and for the ordinary reason:
 * without it a deploy loses every correction anybody has sent, which is worse
 * than not collecting them — somebody took the trouble to tell you.
 *
 * Never awaited by a request. A host tapping "wrong" mid-gig gets an instant
 * yes; whether GitHub is having a good day is not their problem.
 */
export function backUpReports() {
  if (!privateRepoConfigured()) return;
  /*
    * THROUGH `saidSo`, NOT A BARE `.catch()`. `putFile()` catches everything and
    * RESOLVES `{ok:false}`, so a `.catch()` can never fire for a failed write —
    * the exact shape that lost six weeks of backups. The catch stays for a throw
    * that is not a write (a serialise that blows up).
    */
  putFile('reports.json', reports.serialise(), 'Update question reports', 'private')
    .then((r) => saidSo('the question reports', r))
    .catch((err) => saidSo('the question reports', { ok: false, error: err.message }));
}

/**
 * The ledger, after a job that spent something.
 *
 * Once at the END of a generation rather than after every call. A quiz is
 * twenty-odd calls and pushing a commit for each would be twenty commits for
 * one press of one button — and the rows are already on disk, so the only
 * thing at risk between the call and the push is a restart mid-generation,
 * which loses the pack as well.
 *
 * Never awaited and never fatal: a host watching a generation finish does not
 * care whether GitHub is having a good morning, and the whole point of the
 * ledger is a number to look at later.
 */
export function backUpSpend() {
  if (!privateRepoConfigured()) return;
  putFile('spend.json', spend.serialise(), 'Update what the AI has cost', 'private')
    .then((r) => saidSo('the ledger', r))
    .catch((err) => saidSo('the ledger', { ok: false, error: err.message }));
}

/**
 * The suggestion box, same rules as the reports.
 *
 * Somebody took the trouble to tell you the app got in their way; losing that
 * on the next deploy is worse than never having asked. Private repo like the
 * rest of `data/` — these are people's words about their own experience, not
 * something for the public one.
 */
/**
 * How a message is signed in the inbox: a first name and a short reference.
 *
 * The owner CAN see email addresses elsewhere, so this is not secrecy — it is
 * that an inbox reads better as "Rob · #ZG5T" than as an address, and the
 * reference is something you can quote back at somebody without spelling out
 * their email. Taken from the account id, so it is stable for the life of the
 * account and needs nothing stored.
 */
export function accountRef(id) {
  return String(id || '').replace(/[^a-zA-Z0-9]/g, '').slice(0, 4).toUpperCase();
}

export function firstNameOf(account) {
  if (!account) return '';
  const name = String(account.name || '').trim();
  if (name) return name.split(/\s+/)[0];
  return String(account.email || '').split('@')[0];
}

/**
 * What a room asked for, backed up per quizmaster.
 *
 * Their own private repo path like the archive and the invoice book — these
 * are their customers' words about their nights, and they are no business of
 * the public repository.
 */
export function backUpAsks(room) {
  if (!privateRepoConfigured()) return;
  const name = room.id === HOUSE ? 'room-asks.json' : `rooms/${room.id}/room-asks.json`;
  putFile(name, room.asks.serialise(), 'Update what the room asked for', 'private')
    .then((r) => saidSo('what the room asked for', r))
    .catch((err) => saidSo('what the room asked for', { ok: false, error: err.message }));
}

export function backUpSuggestions() {
  if (!privateRepoConfigured()) return;
  putFile('suggestions.json', suggestions.serialise(), 'Update the suggestion box', 'private')
    .then((r) => saidSo('the suggestion box', r))
    .catch((err) => saidSo('the suggestion box', { ok: false, error: err.message }));
}

/**
 * How many times each pack has been run.
 *
 * This was the one thing in `data/` with no backup at all, so every deploy
 * reset the whole library to "Never played" — the counter looked broken rather
 * than empty, because nothing on screen distinguishes "never" from "forgotten".
 * It goes to the private repo like the rest: it is a record of somebody's
 * nights, not of the packs, which are the public repo's.
 */
export function backUpLibraryStats() {
  if (!privateRepoConfigured()) return;
  const file = path.join(config.dataDir, 'library-stats.json');
  let contents;
  try {
    contents = fs.readFileSync(file, 'utf8');
  } catch {
    return; // nothing has been launched yet
  }
  putFile('library-stats.json', contents, 'Update play counts', 'private')
    .then((r) => saidSo('the play counts', r))
    .catch((err) => saidSo('the play counts', { ok: false, error: err.message }));
}

/** What the owner console lists. Never a hash, and never a session token. */
export function subscriberList() {
  return accounts.all
    .filter((a) => a.role === 'quizmaster')
    .map((a) => ({
      ...accounts.view(a),
      supportOpen: accounts.supportOpen(a.id),
      /*
       * Their join code, so the owner page can answer "what do I tell them to
       * put on the projector" without going into their account.
       *
       * `codeFor` rather than `rooms.get(id).code`, because getting the room
       * would BOOT it — reading a state file and starting a session for
       * somebody who may not have opened their console since the last deploy.
       * A code is written down; a room is a running thing.
       */
      joinCode: rooms.codeFor(a.id),
    }));
}

/**
 * The catalogue as a product rather than as a shelf.
 *
 * Three facts per pack, and each answers something the owner page could not
 * answer at all before: how often it has been played across EVERY room (the
 * play counts are per quizmaster, deliberately — see library.js — so this is
 * the only place they are ever added up), how many different quizmasters have
 * run it, and whether anybody has reported a question in it.
 *
 * "Never played by ANYBODY" is the useful one. A quizmaster's own console says
 * "never played" meaning they have not played it, which is right for deciding
 * what to run tonight; this one means nobody has, which is a fact about the
 * pack and is what decides whether it was worth writing.
 */
export function cataloguePerformance() {
  const stats = readStats(config.dataDir);
  const perRoom = (stats && stats.rooms) || {};
  // Anything filed before rooms existed was the house's — the same reading
  // statsFor() gives it, applied here so an old count is not simply lost.
  const books = [...Object.values(perRoom)];
  const flat = Object.fromEntries(Object.entries(stats || {}).filter(([k]) => k.includes(':')));
  if (Object.keys(flat).length) books.push(flat);

  const open = new Map();
  for (const r of reports.all()) {
    if (r.status === 'done') continue;
    open.set(r.packId, (open.get(r.packId) || 0) + 1);
  }

  // The CATALOGUE only. A quizmaster's own packs are not the owner's product
  // and the owner cannot read them — see own-packs.js.
  const library = fullLibrary(config, HOUSE);
  const all = [...library.quizzes, ...library.bingo];

  return all.map((pack) => {
    // A pack that was MEANT to expire and did is not a fact about the writing.
    // Without this, "never played by anybody" fills with six-week-old topical
    // packs and stops being the signal it exists to be.
    const stale = Number.isFinite(Date.parse(pack.freshUntil || '')) && Date.now() > Date.parse(pack.freshUntil);
    const key = `${pack.kind}:${pack.id}`;
    let plays = 0;
    let rooms = 0;
    let last = 0;
    for (const book of books) {
      const seen = book[key];
      if (!seen || !seen.playCount) continue;
      plays += seen.playCount;
      rooms++;
      last = Math.max(last, seen.lastPlayedAt || 0);
    }
    return {
      id: pack.id,
      kind: pack.kind,
      title: pack.title,
      plays,
      rooms,
      lastPlayedAt: last || null,
      openReports: open.get(pack.id) || 0,
      problems: pack.problems || 0,
      broken: Boolean(pack.broken),
      topical: Boolean(pack.freshUntil),
      stale,
    };
  }).sort((a, b) => b.plays - a.plays || a.title.localeCompare(b.title));
}

/** Everything the invoices tab draws itself from, for ONE quizmaster's book. */
/**
 * How many nights have been run and not invoiced.
 *
 * Defensive on every side: a room whose invoice book has not been restored
 * yet, an account without the feature, or a broken archive must all come back
 * as zero rather than taking the library payload down with them — this is a
 * nice-to-know number on the page whose job is launching a quiz.
 */
export function unbilledFor(room, req, url, nights) {
  try {
    if (!billsThroughTheApp(req, url)) return 0;
    // The caller passes the nights when it has already read them — one console
    // load asks the archive three questions and there is no reason to walk the
    // folder three times to answer them.
    const all = nights || mergeGigs(listArchive(room.paths.archive), []);
    return room.invoices.unbilledNights(all).length;
  } catch {
    return 0;
  }
}

/**
 * Does whoever is asking actually invoice through the app?
 *
 * **ASKED OF THE REQUEST, not of `accounts.find(room.id)`** — which is the
 * trap this file has recorded before. On the bare HOST KEY there is no account
 * against the house room at all, so a lookup by room id comes back null and
 * `can(null, …)` is false: the feature would have been silently off on the one
 * console its author uses most. `whoIs()` is what every gate in this file
 * already asks, and it answers the bootstrap key as the owner with every hat
 * on.
 *
 * It exists so a quizmaster who does not bill through the app is never told
 * about "unbilled nights" — to them those are just nights.
 */
export function billsThroughTheApp(req, url) {
  const account = whoIs(req, url);
  if (!account) return false;
  return account.bootstrap ? true : can(account, FEATURES.INVOICES);
}

/**
 * May whoever is asking see their own record of what they have run?
 *
 * The same shape as `billsThroughTheApp` above and asked of the REQUEST for
 * the same reason: on the bare host key there is no account against the house
 * room, so a lookup by room id comes back null and the owner's own console
 * would quietly show no history at all.
 *
 * It decides whether the headcounts ride along in the library payload. A
 * quizmaster without Past gigs has no page to put them on, and a payload
 * carrying numbers for nobody is a payload that grows for nobody.
 */
export function seesTheirNights(req, url) {
  const account = whoIs(req, url);
  if (!account) return false;
  return account.bootstrap ? true : can(account, FEATURES.PAST_GIGS);
}

/**
 * THE OFFER PAGE ITSELF — one screen, in a pub, on a stranger's phone.
 *
 * Written out here rather than served from `public/` because it is one page
 * with no behaviour: no script, no fetch, nothing to go wrong on the wifi that
 * is already struggling with sixty phones. The whole thing is the code and the
 * words.
 *
 * **THE CODE IS THE BIGGEST THING ON IT**, for the reason the voucher card
 * puts the prize first: the person reading it is about to say a word to a
 * member of bar staff, and everything else is context. It is also why the code
 * is spelled out as text rather than shown only as a scan — staff can HEAR
 * "QUIZ40", and a phone held up in a dark bar is a slower transaction than the
 * discount is worth.
 *
 * **AND IT NEVER PRETENDS TO BE THE VENUE.** It says which venue's offer it is
 * and stops there — no logo, no colours borrowed. A page that dressed up as
 * the pub would be a page the pub did not approve, on a domain they do not
 * own.
 */
export function offerPage(pack, slide) {
  const esc = (v) => String(v ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const head = `<!doctype html><meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="robots" content="noindex, nofollow">
    <title>${slide ? esc(slide.heading || 'Tonight\u2019s offer') : 'Not found'}</title>
    <style>
      :root { color-scheme: dark; }
      body { margin: 0; min-height: 100vh; display: grid; place-items: center;
             background: #0b0b12; color: #f4f4f8; font: 16px/1.5 system-ui, -apple-system, sans-serif; padding: 24px; }
      .card { max-width: 26rem; text-align: center; }
      h1 { font-size: 1.5rem; margin: 0 0 8px; }
      .code { display: inline-block; margin: 18px 0 10px; padding: 14px 22px; border-radius: 999px;
              border: 2px dashed rgba(255,255,255,.35); font-size: 2rem; font-weight: 900; letter-spacing: .08em; }
      .say { margin: 0 0 18px; font-size: 1.05rem; }
      .where { color: #a9a9bb; font-size: .9rem; }
      a.go { display: inline-block; margin-top: 18px; color: #0b0b12; background: #f4f4f8;
             padding: 12px 20px; border-radius: 10px; font-weight: 800; text-decoration: none; }
    </style>`;

  if (!slide) {
    return `${head}<div class="card"><h1>Nothing here</h1>
      <p class="say">This offer has finished, or the code was mistyped.</p></div>`;
  }
  const code = String(slide.offerCode || '').trim();
  return `${head}<div class="card">
    <h1>${esc(slide.heading || 'Tonight\u2019s offer')}</h1>
    ${slide.body ? `<p class="say">${esc(slide.body)}</p>` : ''}
    ${code ? `<div class="code">${esc(code)}</div>
      <p class="say">Show this at the bar${slide.offerWhen ? `, ${esc(slide.offerWhen)}` : ''}.</p>` : ''}
    ${slide.link ? `<a class="go" href="${esc(slide.link)}" rel="noopener nofollow">${esc(slide.linkLabel || 'More')}</a>` : ''}
    ${pack && pack.venue ? `<p class="where">${esc(pack.venue)}</p>` : ''}
  </div>`;
}

/**
 * May whoever is asking see a LEAGUE?
 *
 * A sibling of `seesTheirNights` and the same shape for the same reason — the
 * bare host key has no account, so a lookup by room id would quietly hide the
 * owner's own leagues. Separate from Past gigs because the league is Silver
 * and the record it reads is Bronze: everybody keeps their nights, and the
 * table across them is what the tier buys.
 */
/**
 * The quizmaster's own league tables, with each row told whether its name is
 * publishable.
 *
 * The console shows the REAL name — the room's own view, and they were there —
 * and marks the ones a public page would hide, so nothing goes quietly missing
 * off a table they published and nobody has to guess which name did it. Asked
 * on the server so the console and the public page cannot disagree about what
 * counts.
 */
export function markHidden(leagues) {
  const out = {};
  for (const [key, league] of Object.entries(leagues)) {
    out[key] = {
      ...league,
      /*
       * THE FILTER'S VERDICT AND THE ROW'S KEY — and deliberately NOT the
       * quizmaster's own rulings, which live in the private repo and would
       * cost a GitHub round trip on every console load. The league tab
       * fetches those once when it opens (`/api/league/published`) and
       * combines the two there.
       *
       * **The key travels with the row so that combine cannot drift.** The
       * alternative was a copy of `teamKey()` in the browser, and two
       * implementations of one identity is how a ruling comes to land on the
       * wrong team six months from now.
       */
      table: league.table.map((t) => ({
        ...t, key: teamKey(t.name), nameHidden: !isCleanForPublic(t.name),
      })),
      // The same two fields on each night's own placings, so a name marked in
      // the season table is marked the same way when you open the night it was
      // typed on. One verdict, drawn wherever the name appears.
      evenings: (league.evenings || []).map((e) => ({
        ...e,
        top: e.top.map((t) => ({
          ...t, key: teamKey(t.name), nameHidden: !isCleanForPublic(t.name),
        })),
      })),
    };
  }
  return out;
}

/**
 * DOES THIS NIGHT'S VENUE RUN A LEAGUE — asked under BOTH of its keys.
 *
 * `venueKeyOf()` gives `id:xyz` when a night carries a venue id and the
 * lowercased name when it does not, and one pub often has both across a
 * season — which is the split `leaguesByVenue()` and `venueHeadcounts()` each
 * already fold. The switch is stored against whichever key the league itself
 * ended up under, so a reader that asks under one form alone finds nothing
 * roughly half the time. The rule this repo already has for that is to ask
 * under both; see `heard.js`.
 */
export async function leagueRunsAt(roomId, entry, nights = []) {
  const on = await leaguesRunning(roomId);
  if (!on.length) return false;
  // EVERY KEY THAT MEANS THIS PUB, not this night's own — see `venueKeysFor()`.
  const keys = venueKeysFor(entry, nights);
  return on.some((k) => keys.has(k));
}

/**
 * WHICH ROOM THE PUBLIC PAGES FALL BACK TO — the owner's own quizmaster room,
 * or the house room when nobody has made an account yet.
 *
 * The same answer `galleryRoomId()` gives with no `?q=`, lifted out so that
 * `/api/me` can tell the console whether a venue's own address will work for
 * it. Two copies of this lookup is how the console would come to print an
 * address that 404s.
 */
export function publicRoomId() {
  const owner = accounts.owner;
  const mine = owner ? accounts.ownQuizmasterFor(owner.id) : null;
  return mine ? mine.id : HOUSE;
}

/**
 * WHICH ROOM A ROOM'S PHOTO STORY IS FILED IN — the one answer, for a WRITE as
 * well as a read. `galleryRoomFor(req, url)` is this with a request in front.
 *
 * **A read and a write that disagree about the room is invisible**, and
 * `fileAway()` was the writer that had its own opinion — see
 * `docs/gigs/photos.md`.
 */
export function galleryRoomOf(roomId) {
  return String(roomId || HOUSE) === HOUSE ? publicRoomId() : String(roomId);
}

export function seesTheirLeague(req, url) {
  const account = whoIs(req, url);
  if (!account) return false;
  return account.bootstrap ? true : can(account, FEATURES.LEAGUE);
}

export function invoiceState(books) {
  return {
    settings: books.settings,
    customers: books.customers,
    invoices: books.invoices.map(withTotals),
    // The diary's exceptions, so a tab that just wrote one gets the new list
    // back rather than having to reload the whole library.
    bookings: books.bookings,
    summary: books.summary(),
    // Reported separately from anything else, because this is the one that
    // quietly loses a year of records on a redeploy.
    backupReady: privateRepoConfigured(),
  };
}

/** The sums travel with the invoice so the browser never adds money up. */
export function withTotals(invoice) {
  return { ...invoice, totals: totals(invoice) };
}

/**
 * Read a draft off the wire.
 *
 * Money arrives as whatever was typed into a box — "350", "£350.00", "1,250.50"
 * — and becomes integer pence here, at the edge, so nothing past this point
 * has to wonder. A line whose amount cannot be read is refused rather than
 * quietly counted as nothing.
 */
export function readDraft(body = {}) {
  const lines = (Array.isArray(body.lines) ? body.lines : []).map((line, i) => {
    const pence = toPence(line.amountPence ?? line.amount);
    if (pence === null) throw new Error(`Line ${i + 1}: "${line.amount ?? ''}" is not an amount.`);
    return { description: String(line.description || ''), amountPence: pence };
  });
  const deposit = body.deposit || body.depositPence ? toPence(body.depositPence ?? body.deposit) : 0;
  if (deposit === null) throw new Error(`"${body.deposit}" is not an amount.`);
  return {
    customerId: String(body.customerId || ''),
    toName: body.toName,
    toContact: body.toContact,
    toAddress: body.toAddress,
    toEmail: body.toEmail,
    event: body.event || {},
    lines,
    depositPence: deposit,
    notes: body.notes,
  };
}

/*
 * THE PROP TALLY, PUSHED — and without this the whole thing is pointless.
 *
 * `data/` is wiped on every deploy and every push IS a deploy, so a counter
 * that only lives there would reset itself several times a week and never
 * reach the threshold where its numbers mean anything. The backup is not a
 * safety net here, it is the storage.
 *
 * Coalesced rather than pushed per photograph: sixty phones in a break would
 * otherwise be sixty GitHub calls against an hourly quota shared with the
 * packs, the accounts book and the photographs themselves.
 */
export let propPush = null;
export function backUpPropUse() {
  if (propPush) return propPush;
  propPush = new Promise((resolve) => {
    setTimeout(async () => {
      propPush = null;
      try {
        resolve(await backUp('data/prop-use.json', propUse.contents(), 'Update prop use', () => {}));
      } catch (err) {
        resolve({ ok: false, error: err.message });
      }
    }, 60_000).unref?.();
  });
  return propPush;
}

export async function backUpHistory(log = () => {}) {
  try {
    const historyFile = path.join(config.dataDir, 'track-history.json');
    if (!fs.existsSync(historyFile)) return { ok: false };
    const result = await backUp('data/track-history.json', fs.readFileSync(historyFile, 'utf8'), 'Update song history', () => {});
    log(result.ok
      ? 'song history pushed to GitHub'
      : `song history NOT pushed: ${result.error || 'GitHub backup is not set up'}`);
    return result;
  } catch (err) {
    log('could not back up the song history: ' + err.message);
    return { ok: false, error: err.message };
  }
}

/**
 * Reload a quiz pack in every room that is currently playing it.
 *
 * The library is shared, so one save can affect more than one live game. It
 * used to reload "the" session because there was only ever one; missing a room
 * here would leave that quizmaster running the version from before the edit,
 * which is the sort of thing you only discover when the answer on the
 * projector disagrees with the one on the host's phone.
 */
export function reloadPackEverywhere(id, { clamp = true } = {}) {
  let touched = 0;
  for (const room of rooms.all()) {
    const { session } = room;
    /*
     * A COMPOSED NIGHT HAS NO FILE BEHIND IT, so it is skipped explicitly
     * rather than relying on its id not matching. It cannot match — `safeId()`
     * strips the character `COMPOSED_ID` starts with, so no pack on disk can
     * be called it, and there is a test that says so. The check is here
     * anyway because the cost of being wrong is the worst in the app: this
     * function REPLACES a running game's pack from disk, so a collision would
     * swap a room's quiz for something else at question four.
     */
    if (session.kind !== 'quiz' || isComposed(session.pack?.id) || session.pack?.id !== id) continue;
    // Resolved against THIS room, so a quizmaster editing one of their own
    // reloads theirs rather than blowing up looking for it in the catalogue.
    session.pack = readPack('quiz', id, { config, paths: room.paths }).pack;
    session.engine.quiz = session.pack;
    if (clamp) session.engine.clampPointers();
    session.engine.changed();
    touched++;
  }
  return touched;
}

/**
 * Is any room playing this pack right now?
 *
 * Global for a CATALOGUE pack, because everybody shares that file. Narrowed to
 * one room for a quizmaster's OWN pack: two subscribers can each have a pack
 * called `christmas`, and one of them playing theirs is no reason to stop the
 * other deleting theirs.
 */
/**
 * WHAT IS ON THE PROJECTOR, AND WHAT PRESSING ONWARDS WOULD PUT THERE.
 *
 * Asked for directly: *"would be useful to see a panel that shows what's on
 * the screen and the next screen in the console while the quiz is running."*
 * The running panel already said WHERE the night had got to — "Round 1,
 * question 3" — which answers a different question from "what am I about to
 * walk into".
 *
 * It is the console, which is the host's own page, so the question text and
 * the answer are allowed here for the same reason they are allowed on the
 * control view. Rule 1 is about the PROJECTOR and a PLAYER'S PHONE, and
 * neither of those is this.
 *
 * QUIZ ONLY. Bingo has no "next": the host picks the next track off a call
 * sheet, so there is nothing to predict and a panel guessing at one would be
 * worse than none.
 */
export function nowNext(session) {
  const engine = session.engine;
  if (!engine || session.kind !== 'quiz') return null;
  const s = engine.state;
  const round = engine.round();
  const qs = engine.questions();
  const q = engine.question();
  const roundName = round ? (round.title || `Round ${s.roundIndex + 1}`) : '';
  const nextRound = engine.rounds[s.roundIndex + 1];
  const nextRoundName = nextRound ? (nextRound.title || `Round ${s.roundIndex + 2}`) : '';
  const nextQ = qs[s.questionIndex + 1];
  const asked = (item) => String((item && item.prompt) || '').slice(0, 120);

  switch (s.phase) {
    case 'lobby':
      return { now: 'The lobby — teams joining', next: 'The rules slide' };
    case 'rules':
      return { now: 'The rules slide', next: roundName ? `${roundName} — the round board` : 'The first round' };
    case 'round_intro':
      return { now: `${roundName} — the round board`, next: 'Question 1', nextText: asked(qs[0]) };
    case 'question':
      return {
        now: `Question ${s.questionIndex + 1} of ${qs.length}`, nowText: asked(q),
        next: 'The answer',
        nextText: q ? engine.answerText(q, round) : '',
      };
    case 'reveal':
      return {
        now: 'The answer is up', nowText: q ? engine.answerText(q, round) : '',
        next: nextQ ? `Question ${s.questionIndex + 2} of ${qs.length}` : (nextRound ? `${nextRoundName} — the round board` : 'The final scores'),
        nextText: asked(nextQ),
      };
    case 'round_board':
      return {
        now: `Scores after ${roundName}`,
        next: nextRound ? `${nextRoundName} — question 1` : 'The final scores',
        nextText: nextRound ? asked((nextRound.questions || [])[0]) : '',
      };
    case 'final':
      return { now: 'The final scores and the winner', next: '' };
    default:
      return null;
  }
}

export function packInUse(kind, id, onlyRoom = null) {
  const where = onlyRoom ? [onlyRoom] : rooms.all();
  return where.some((r) => r.session.kind === kind && r.session.pack?.id === id);
}

/**
 * WHO IS PLAYING THIS PACK, AND WHICH QUESTION IS ON THE SCREEN.
 *
 * `packInUse` above answers "may I delete this" with a yes or a no. This
 * answers the editor's question, which is a different one: *which question
 * must I not touch right now.*
 *
 * **A save reaches a running night immediately** — `reloadPackEverywhere()`
 * swaps the pack under every room playing it, which is rule 11 and is the
 * whole point. Everything the room has done lives in `state` rather than in
 * the pack, so scores, the clock and the pointer are untouched and the room
 * sees nothing until the host presses Next. That makes correcting a question
 * they have not reached completely safe, and it makes correcting the one
 * they are LOOKING AT a change in front of sixty people mid-clock — the
 * answer key with it.
 *
 * So it reports two different facts and the editor treats them differently:
 * that somebody is playing it at all, and the exact round and question index
 * that is live.
 *
 * **It says how many rooms, never which quizmaster.** The owner has no
 * business learning that Rob is working tonight, and the count is what
 * actually changes the decision. A quizmaster asking about their own pack is
 * scoped to their own room anyway — `onlyRoom` — so one subscriber can never
 * learn anything about another's night from this.
 *
 * **`live` is deliberately only the QUESTION phase.** At a reveal, a round
 * board or the lobby nothing on screen comes out of a question, so an edit
 * costs nobody anything — and marking a card red when it is safe is how a
 * warning stops being read.
 */
/**
 * Has this save changed the question a room is LOOKING AT?
 *
 * The check runs at the moment of writing rather than when the editor was
 * opened, and that is the whole point: somebody opens the editor at seven and
 * types at nine, and a warning that was true two hours ago is worse than no
 * warning because it gets trusted. The banner on the page is a convenience;
 * this is the thing that cannot be stale.
 *
 * Compared against what is ON DISK rather than against what the editor loaded,
 * so it answers "is this write a change" rather than "did somebody type in a
 * box". Retyping the same words is not a change and must not be stopped.
 *
 * Everything else in the pack saves straight through — correcting question 6
 * while the room is on question 5 is exactly what this feature exists to
 * allow, and is safe: the pointer, the clock and every score live in `state`,
 * not in the pack.
 */
export function changesTheLiveQuestion(kind, id, incoming, onlyRoom = null) {
  const state = packPlayState(kind, id, onlyRoom);
  if (!state.live) return null;
  const { roundIndex, questionIndex } = state.live;
  let onDisk;
  try {
    onDisk = onlyRoom
      ? readPack(kind, id, { config, paths: onlyRoom.paths }).pack
      : loadQuiz(config.quizDir, id);
  } catch {
    return null;  // Cannot read it, so cannot claim it changed.
  }
  const at = (pack) => (((pack || {}).rounds || [])[roundIndex] || {}).questions?.[questionIndex] || null;
  const before = at(onDisk);
  const after = at(incoming);
  if (!before && !after) return null;
  if (JSON.stringify(before) === JSON.stringify(after)) return null;
  return {
    roundIndex,
    questionIndex,
    playing: state.playing,
    prompt: String((before && before.prompt) || '').slice(0, 120),
  };
}

export function packPlayState(kind, id, onlyRoom = null) {
  const where = onlyRoom ? [onlyRoom] : rooms.all();
  /*
   * `busy`, NOT merely "has this pack loaded" — which is what `packInUse`
   * above asks, correctly, for deleting. A server boots with a pack sitting in
   * the house room's session and nobody within a mile of it, so counting that
   * as "being played right now" puts a warning on the editor permanently. A
   * warning that is always on is a warning nobody reads, which would cost the
   * one below it its meaning too.
   *
   * `busy` is the standard the launch guard already uses: a game in progress,
   * OR a lobby with teams sitting in it who have typed their names.
   */
  const rooms_ = where.filter((r) => r.session.kind === kind && r.session.pack?.id === id && r.busy);
  if (!rooms_.length) return { playing: 0, live: null, phase: '' };
  // The first one is enough to point at a question. Two rooms on the same
  // pack at the same second is possible and vanishingly rare, and naming one
  // question is more useful than naming none.
  const first = rooms_.find((r) => r.session.engine?.state?.phase === PHASES.QUESTION) || rooms_[0];
  const state = first.session.engine?.state || {};
  const onQuestion = state.phase === PHASES.QUESTION;
  return {
    playing: rooms_.length,
    phase: state.phase || '',
    live: onQuestion
      ? { roundIndex: Number(state.roundIndex) || 0, questionIndex: Number(state.questionIndex) || 0 }
      : null,
  };
}

/*
 * ---------------------------------------------------- a quizmaster's own packs
 *
 * Filed one folder per room in their OWN repository (`PACKS_REPO`), never the
 * public one and never the owner's private one — that holds the owner's
 * accounts, invoices and customer records, and somebody else's work does not
 * belong in with them. See the note in src/github.js.
 *
 * Not configured is not fatal: the pack is saved and playable, and the console
 * says in red that it will not survive a restart. Same shape as the invoice
 * book's warning, and for the same reason — a record you think you have and do
 * not is worse than one you know you have not got.
 */
export async function backUpOwnPack(room, kind, id, contents) {
  if (!packsRepoConfigured()) return { ok: false, error: 'no packs repository set up' };
  try {
    return await putFile(backupPath(room.id, kind, id), contents, `Update ${kind} pack: ${id}`, 'packs');
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

export async function removeOwnPackBackup(room, kind, id) {
  if (!packsRepoConfigured()) return { ok: false };
  try {
    return await deleteFile(backupPath(room.id, kind, id), `Delete ${kind} pack: ${id}`, 'packs');
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

/**
 * Bring a room's own packs back after a restart.
 *
 * Once per room per boot, and — the same rule as the accounts and the invoice
 * book — **only into an empty folder**. A disk that already has packs on it is
 * ahead of any backup, and reading a backup over live files could roll an edit
 * back to the version before it.
 *
 * Rooms are made lazily, so this runs the first time that quizmaster opens
 * their console rather than at boot. It is awaited there, because a library
 * drawn while this was still running would show them an empty shelf, which
 * looks exactly like their work having been lost.
 */
export const ownPacksRestored = new Set();
export const ownPacksInFlight = new Map();

export async function ensureOwnPacksRestored(room) {
  if (!packsRepoConfigured()) return;
  await restoreOnce(ownPacksRestored, ownPacksInFlight, room.id, async () => {
    if (countOwn(room.paths)) return true;   // disk wins, always
    let missed = 0;
    // Both kinds at once — two listings in a row was two deadlines in a row
    // with GitHub gone quiet, on the console's first request after a deploy.
    await Promise.all(['quiz', 'bingo'].map(async (kind) => {
      const dir = kind === 'quiz' ? room.paths.ownQuizzes : room.paths.ownBingo;
      if (!dir) return;
      const listing = await tryListDir(`packs/${room.id}/${kind}`, 'packs');
      // A LISTING THAT FAILED IS NOT AN EMPTY LIBRARY. Latched, it meant a
      // quizmaster's own packs were gone for the process's lifetime with the
      // backup intact — their own writing, which is the worst thing here to
      // lose.
      if (!listing.ok) {
        console.warn(`[own-packs] could not list ${kind} for ${room.id}:`, listing.error);
        missed += 1;
        return;
      }
      for (const file of listing.files) {
        if (!file.name.endsWith('.json')) continue;
        const read = await tryGetFile(file.path, 'packs');
        if (!read.ok) { missed += 1; continue; }
        if (!read.body) continue;
        try {
          fs.mkdirSync(dir, { recursive: true });
          fs.writeFileSync(path.join(dir, file.name), read.body);
        } catch (err) {
          console.error(`[own-packs] could not restore ${file.path}:`, err.message);
        }
      }
      if (listing.files.length) console.log(`[own-packs] restored ${listing.files.length} ${kind} pack(s) for room ${room.id}`);
    }));
    return missed === 0;
  });
}

export function csvCell(value) {
  const s = String(value ?? '');
  return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}


hooks.backUpArchive = backUpArchive;
hooks.backUpCodesSoon = backUpCodesSoon;
