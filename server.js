/**
 * The game server.
 *
 * One small always-on Node process. No framework, no build step, no database:
 * game packs are JSON files, live state is one JSON file, and the realtime
 * channel is server-sent events. Fewer moving parts is the whole point —
 * every dependency is something that can break on a Wednesday night.
 *
 * It runs one game at a time — a music quiz or music bingo — chosen from the
 * console. The Session object hides which, so everything below this point
 * works the same either way.
 */

import { HOST_KEY, HOUSE, WARN_DAYS, accounts, brandFor, can, config, daysLeft, dueEnded, dueWarning, emailConfigured, emailProvider, flight, hostKeyIsTemporary, http, hub, keepKeyAlive, rooms, sendEmail, trialEndedEmail, trialEndingEmail } from './src/http/context.js';
import { runSelfTest } from './src/self-test.js';
import { send, sendJson } from './src/http/plumbing.js';
import { brandForRoom } from './src/http/identity.js';
import { supportGuard } from './src/http/support-log.js';
import { backUpAccounts, restoreFromBackup } from './src/http/helpers.js';
import { startPhotoSweep } from './src/http/photo-filing.js';
import { getPages } from './src/http/get-pages.js';
import { getStaticFiles } from './src/http/get-static-files.js';
import { getQrAndVouchers } from './src/http/get-qr-and-vouchers.js';
import { getStream } from './src/http/get-stream.js';
import { getInfo } from './src/http/get-info.js';
import { getMe } from './src/http/get-me.js';
import { getLibrary } from './src/http/get-library.js';
import { getPacks } from './src/http/get-packs.js';
import { getInvoices } from './src/http/get-invoices.js';
import { getPastGigs } from './src/http/get-past-gigs.js';
import { getGallery } from './src/http/get-gallery.js';
import { getRest } from './src/http/get-rest.js';
import { writeStripe } from './src/http/write-stripe.js';
import { writePhotos } from './src/http/write-photos.js';
import { writeShows } from './src/http/write-shows.js';
import { writePastGigs } from './src/http/write-past-gigs.js';
import { writeSignIn } from './src/http/write-sign-in.js';
import { writeMeAndSignup } from './src/http/write-me-and-signup.js';
import { writeSuggestions } from './src/http/write-suggestions.js';
import { writeGroup } from './src/http/write-group.js';
import { writeSettings } from './src/http/write-settings.js';
import { writeInvoices } from './src/http/write-invoices.js';
import { writeVoucher } from './src/http/write-voucher.js';
import { writePlayers } from './src/http/write-players.js';
import { writeOwnPacks } from './src/http/write-own-packs.js';
import { writeOwner } from './src/http/write-owner.js';
import { writeDj } from './src/http/write-dj.js';
import { writeHost } from './src/http/write-host.js';
import { writeEditor } from './src/http/write-editor.js';
import { writeGenerate } from './src/http/write-generate.js';
import { writeBingoPacks } from './src/http/write-bingo-packs.js';

// ------------------------------------------------------------------ routing

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const route = url.pathname;

  try {
    // Everything done inside somebody else's account is written down for them,
    // and some of it is refused outright. One place, so a route added later is
    // covered without anybody remembering to.
    if (!supportGuard(req, res, url, route)) return;

    if (req.method === 'GET' || req.method === 'HEAD') {
      if (await handleGet(req, res, url, route)) return;
    } else if (req.method === 'POST' || req.method === 'PUT' || req.method === 'DELETE') {
      if (await handleWrite(req, res, url, route)) return;
    }
    send(res, 404, 'Not found');
  } catch (err) {
    // A malformed body is the CALLER's fault, not a fault here — answering 500
    // makes a phone on bad wifi look like a broken server, and buries a real
    // fault among the noise on the one night something actually goes wrong.
    if (err.badRequest) {
      if (!res.headersSent) sendJson(res, 400, { error: err.message });
      else res.end();
      return;
    }
    console.error('[http]', req.method, route, err.message);
    if (!res.headersSent) sendJson(res, 500, { error: err.message });
    else res.end();
  }
});


/*
 * THE ROUTES, IN THE ORDER THEY USED TO SIT IN ONE FUNCTION. Each is a
 * family in `src/http/`, tried in turn; the first that answers `true` has
 * handled the request. Order is load-bearing in two places and both are
 * documented where they live: the Stripe webhook is first in the writes
 * because it needs the raw bytes, and `report.pdf` is matched before the
 * `/api/past-gigs/` prefix.
 */
const GET_ROUTES = [getPages, getStaticFiles, getQrAndVouchers, getStream, getInfo, getMe, getLibrary, getPacks, getInvoices, getPastGigs, getGallery, getRest];
const WRITE_ROUTES = [writeStripe, writePhotos, writeShows, writePastGigs, writeSignIn, writeMeAndSignup, writeSuggestions, writeGroup, writeSettings, writeInvoices, writeVoucher, writePlayers, writeOwnPacks, writeOwner, writeDj, writeHost, writeEditor, writeGenerate, writeBingoPacks];

async function handleGet(req, res, url, route) {
  for (const family of GET_ROUTES) if (await family(req, res, url, route)) return true;
  return false;
}

async function handleWrite(req, res, url, route) {
  for (const family of WRITE_ROUTES) if (await family(req, res, url, route)) return true;
  return false;
}


// ------------------------------------------------------------------ startup

/*
 * Read the backups back before anything else happens.
 *
 * Before listening rather than after: a request that arrives in the gap would
 * be told there are no accounts, and the login page would offer to set the app
 * up from scratch on a server that already has subscribers.
 */
await restoreFromBackup();

server.listen(config.port, () => {
  const local = `http://localhost:${config.port}`;
  console.log('');
  console.log('  ┌───────────────────────────────────────────────┐');
  const banner = config.brandName
    || brandFor(accounts.owner ? (accounts.owner.name || accounts.owner.email) : '', { appName: config.appName });
  console.log(`  │  ${banner.padEnd(43).slice(0, 43)}│`);
  console.log('  └───────────────────────────────────────────────┘');
  console.log('');
  console.log(`  Big screen   ${local}/screen`);
  console.log(`  Players      ${local}/play`);
  console.log(`  Your control ${local}/host?key=${HOST_KEY}`);
  console.log(`  Editor       ${local}/editor?key=${HOST_KEY}`);
  console.log('');
  console.log(`  Console      ${local}/console?key=${HOST_KEY}`);
  console.log('');
  console.log(`  Loaded:      ${rooms.get(HOUSE).session.pack.title} (${rooms.get(HOUSE).session.kind})`);
  console.log(`  Host key:    ${HOST_KEY}`);
  if (hostKeyIsTemporary()) {
    console.log('');
    console.log('  ** HOST_KEY is not set, so this key was invented just now. **');
    console.log('  It is kept in data/, which a host with no permanent disk wipes');
    console.log('  on every deploy — so the next deploy will invent a different');
    console.log('  one and every bookmark you have will stop working. Set HOST_KEY');
    console.log('  as an environment variable to any long phrase and it stops.');
  }
  /*
   * Keep the mail key alive.
   *
   * Brevo expires an API key after 90 days of INACTIVITY whatever expiry was
   * set on it, and this app sends about five password resets a year — so the
   * key would die quietly and be discovered on the evening somebody is locked
   * out. One trivial authenticated call at boot and once a week after it is
   * activity without sending anything.
   *
   * `unref()` so it can never hold the process open, and nothing is awaited or
   * reported: a mail provider having a bad morning has nothing to do with
   * whether a quiz can run tonight. The reset page still names the cause if
   * the key has gone anyway, which is the backstop that actually matters.
   */
  if (emailProvider() === 'brevo') {
    keepKeyAlive().catch(() => {});
    setInterval(() => { keepKeyAlive().catch(() => {}); }, 7 * 86_400_000).unref();
  }

  /*
   * AND TELL ANYBODY WHOSE TRIAL IS ABOUT TO RUN OUT — see `sweepTrials()`.
   *
   * `unref()` for the same reason as above: it may never hold the process open,
   * and a mail provider is nothing to do with whether tonight's quiz runs.
   * Nothing awaited here either — boot must not wait on an outbound request.
   */
  sweepTrials().catch((err) => console.warn('[trials] sweep failed:', err.message));
  setInterval(() => {
    sweepTrials().catch((err) => console.warn('[trials] sweep failed:', err.message));
  }, TRIAL_SWEEP_MS).unref();

  // AND RETRY ANY PHOTOGRAPH THAT DID NOT REACH THE STORE — see `startPhotoSweep()`.
  startPhotoSweep();

  /*
   * THE FLIGHT RECORDER SEES THE BOOT, then the server plays a night against
   * itself — `src/self-test.js`. A second after listen, so a room reconnecting
   * after the deploy is served first; `unref()`, so it can never hold the
   * process open. The verdict goes on `/health` and into the recorder, and a
   * failure is said in the log too — Render shows that page, the pub does not.
   */
  flight.note('boot', `Server up on :${config.port}, ${rooms.all().length} rooms, ${accounts.all.length} accounts`);
  setTimeout(() => {
    runSelfTest({ config, port: config.port }).then((result) => {
      if (result.ok) flight.note('selftest', `passed ${result.steps} steps in ${result.ms}ms`);
      else {
        flight.note('selftest', `FAILED: ${result.failed.join('; ')}`, { level: 'fail' });
        console.error('[selftest] FAILED:', result.failed.join('; '));
      }
    }).catch((err) => flight.note('selftest', `could not run: ${err.message}`, { level: 'fail' }));
  }, 1000).unref();

  if (!accounts.all.length) {
    console.log('');
    console.log('  No accounts yet. The host key above is the way in, and it can');
    console.log('  make the first owner from the Console — everything else about');
    console.log('  accounts is owner-only once that exists.');
  }
  console.log('');
});

/*
 * ====================================================== TRIALS THAT RUN OUT
 *
 * A trial ended in total SILENCE until 13 September 2026: nothing told anybody,
 * the only sign was a line on My account, and then a launch simply refused — on
 * a day they had a gig booked, with no grace night, which an expired trial
 * deliberately does not get. It was the biggest hole in the funnel and it is two
 * emails and a clock.
 *
 * **`src/trials.js` decides WHO and this decides WHEN.** That file holds no clock
 * and sends nothing, so the whole of it is testable with an injected `now`.
 *
 * **Twice a day, and at boot.** Every push is a deploy and every deploy is a
 * boot, so the cadence barely matters for delivery — what matters is that the
 * mark is on the ACCOUNT (`markTrialNotice`), or a busy Monday sends one notice
 * per push. Twelve hours means a trial expiring overnight is answered by lunch
 * rather than a week later on a quiet stretch with no deploys.
 *
 * **Nothing is awaited and nothing throws upward.** A mail provider having a bad
 * morning has nothing to do with whether a quiz can run tonight — the same rule
 * `keepKeyAlive()` follows above.
 */
const TRIAL_SWEEP_MS = 12 * 3_600_000;

async function sweepTrials() {
  if (!emailConfigured()) return { warned: 0, ended: 0, skipped: 'no mail provider' };
  const base = (config.publicUrl || '').replace(/\/+$/, '') || 'https://musicquizapp.onrender.com';
  /*
   * STRAIGHT TO THE LADDER, not to the console's front door. The rungs on My
   * account are where a plan is picked — and since the rung you are ON became
   * buyable when nobody is paying for it, an expired trial pressing Bronze there
   * actually works. Before that fix this link led to a dead end, which is worth
   * remembering if anybody ever reverts it.
   */
  const link = `${base}/console?door=account&tab=account`;
  const brandName = brandForRoom(rooms.get(HOUSE));
  const now = Date.now();
  let warned = 0;
  let ended = 0;

  for (const account of dueWarning(accounts.all, now)) {
    const when = new Date(Date.parse(account.trialEndsAt))
      .toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
    // STAMPED FIRST — see the note on markTrialNotice. A duplicate is worse than
    // a miss, and only one of the two is recoverable by a human.
    accounts.markTrialNotice(account.id, 'warned');
    warned += 1;
    sendEmail({
      to: account.email,
      ...trialEndingEmail({ name: brandName, days: daysLeft(account, now), when, link }),
    }).catch((err) => console.warn('[trials] could not warn', account.email, err.message));
  }

  for (const account of dueEnded(accounts.all, now)) {
    accounts.markTrialNotice(account.id, 'ended');
    ended += 1;
    sendEmail({
      to: account.email,
      ...trialEndedEmail({ name: brandName, link }),
    }).catch((err) => console.warn('[trials] could not tell', account.email, err.message));
  }

  if (warned || ended) {
    // Said out loud, because it is the only place the owner finds out that a
    // trial ended at all — the Money tab counts them, this names the moment.
    console.log(`[trials] ${warned} warned (${WARN_DAYS} days out), ${ended} told it has ended`);
    await backUpAccounts();
  }
  return { warned, ended };
}

/** Save on the way out, so even a deliberate restart loses nothing. */
function shutdown(signal) {
  console.log(`\n[server] ${signal} — saving state and closing`);
  for (const room of rooms.all()) room.store.flush();
  hub.closeAll();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 2000).unref();
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('uncaughtException', (err) => {
  /*
   * Never take the quiz down over one bad request. Log it and carry on.
   *
   * THIS ALSO CATCHES AN UNHANDLED PROMISE REJECTION. Node's default
   * (`--unhandled-rejections=throw`, since 15) raises a rejection nobody
   * caught as an uncaught exception, so a background backup, a photo push or
   * an email send that fails without a `.catch()` lands HERE rather than
   * killing the process mid-quiz. That only holds while nothing sets
   * `--unhandled-rejections=strict`, which bypasses this handler and exits —
   * `test/rejection-survives.test.js` pins both halves.
   */
  console.error('[server] uncaught:', err);
  for (const room of rooms.all()) room.store.flush();
});

export { server, rooms };
