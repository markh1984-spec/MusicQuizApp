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

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

import { config, paths, hostKey, hostKeyIsTemporary } from './src/config.js';
import { Store } from './src/store.js';
import { Hub } from './src/sse.js';
import { Photos, MAX_BYTES, isCameraFile, extensionFor, showsOnGallery, sniffType } from './src/photos.js';
import { Session } from './src/session.js';
import { saveQuiz, deleteQuiz, validateQuiz, normaliseQuiz, loadQuiz, reviewWarnings, setWarningChecked, ROUND_TYPES } from './src/quizzes.js';
import { recueQuiz } from './src/recue.js';
import { validateBingoPack, normaliseBingoPack, minimumTracks, CARD_SHAPES, shapeLabel, maxPrizes, stagePlan, stageLabel } from './src/bingo.js';
import { fullLibrary, listArchive, venuesUsed, rewardsUsed, rewardsByVenue, loadArchived, serialiseArchive, restoreArchive, saveBingoPack, loadBingoPack, deleteBingoPack, readStats } from './src/library.js';
import { generateBingoPack } from './src/generate-bingo.js';
import { generateQuizPack, buildIntroPlaylists, roundPlan, TOPICAL_ROUNDS, TOPICAL_DAYS, topicalNaming } from './src/generate-quiz.js';
import { portraitPath } from './src/portraits.js';
import { importBingoPack } from './src/import-bingo.js';
import { listAdvertPacks, loadAdvertPack, saveAdvertPack, deleteAdvertPack, validateAdvertPack, normaliseAdvertPack, safeAdvertFile } from './src/adverts.js';
import {
  generateImages, imageStatus, imageJobs, imagePlan,
  openaiConfigured, googleConfigured, artProvider, portraitLibrary,
} from './src/generate-images.js';
import { STYLES, findStyle, QUALITIES, DEFAULT_QUALITY } from './src/portraits.js';
import { recentTracks, forgetAll } from './src/history.js';
import { spotifyConfigured, missingSpotifyConfig, playTrack } from './src/spotify.js';
import { photoFolder, mergeGigs, safePhotoName, isNightFolder, nightOfGig } from './src/past-gigs.js';
import { venueHeadcounts, nightHeadcount } from './src/headcounts.js';
import { playedByVenue } from './src/heard.js';
import { nightReportPdf, nightReportFilename } from './src/report-pdf.js';
import { leaguesByVenue, leagueAfter, teamKey } from './src/league.js';
import { comeBackFor, nextNightAt, comeBackText } from './src/comeback.js';
import { isComposed, MAX_ROUNDS } from './src/running-order.js';
import { listShows, saveShow, deleteShow, showProblems } from './src/shows.js';
import { pickIdeas, ideaLabel } from './src/round-ideas.js';
import { getFile, listDir, listDirs, githubConfigured, missingGithubConfig, putFile, putFiles, deleteFile, checkAccess, photosRepoConfigured, photosRepoName, missingPhotoConfig, photoRepoProblem, privateRepoConfigured, packsRepoConfigured, packsRepoName } from './src/github.js';
import { Invoices, totals, toPence, money } from './src/invoices.js';
import { invoicePdf, invoiceFilename } from './src/invoice-pdf.js';
import { toSvg } from './src/qrcode.js';
import { LOOKS } from './public/assets/looks.js';
import { cueOffsetMs } from './public/assets/cue.js';
import { Accounts } from './src/accounts.js';
import { Reports } from './src/reports.js';
import { randomBytes } from 'node:crypto';
import { Rooms, HOUSE, tidyCode } from './src/rooms.js';
// The one proof a phone has. Same rule as answering: an id is not a
// credential, the token is — see rule 3.
import { ownsPlayer, PHASES } from './src/engine.js';
import { upcoming } from './public/assets/diary.js';
import { calendarIcs } from './src/ics.js';
import { FEATURES, TIERS, TIER_PACKS, tierFor, whyNot, entitlements, packsFor, packFilter, canPlayPack, can, switchedOn, PACK_PENCE, TRIAL_DAYS, REFERRAL_BONUS_DAYS } from './public/assets/plans.js';
import { lobbyGameFor } from './public/assets/lobby-games.js';
import {
  publishedNights, isPublished, setPublished, readableNight,
  photoDecisions, photoKey, setPhotoDecision,
} from './src/gallery.js';
import { publishedVenues, setVenuePublished, nameDecisions, setNameDecision } from './src/league-publish.js';
import { publicTable, isCleanForPublic } from './src/clean-names.js';
import { sendEmail, emailConfigured, emailProvider, keepKeyAlive, resetEmail, welcomeEmail } from './src/email.js';
import { Suggestions, KINDS, PACK_REQUEST_KIND } from './src/suggestions.js';
import { Spend, spendRecorder, imagePrices } from './src/spend.js';
// The pack id a generation is going to produce, so a cost has a subject from
// the moment it is spent rather than only once the pack lands.
import { themeSlug } from './src/theme.js';
import { draftReply, briefFor, mostlyMine } from './src/reply-draft.js';
import { OWNER_ONLY, changesTheLibrary } from './src/gates.js';
import { listOwn, readPack, saveOwn, deleteOwn, isOwnPack, inCatalogue, countOwn, backupPath, MAX_OWN } from './src/own-packs.js';
import { brandFor } from './src/branding.js';
import { findScheme, DEFAULT_SCHEME, SCHEMES } from './public/assets/schemes.js';
// The logo, shared with the browser so the tab icon and the on-screen mark are
// one drawing rather than two that look alike today.
import { faviconSvg } from './public/assets/brandmark.js';

const HOST_KEY = hostKey();
const hub = new Hub();
const accounts = new Accounts(paths.accounts);
// Corrections on a question, from whoever was running it. Global rather than
// per-room: the packs are shared, so a fault Rob finds is a fault in the pack.
const reports = new Reports(paths.reports);
const suggestions = new Suggestions(paths.suggestions);
/*
 * What Claude and OpenAI have actually cost.
 *
 * Global rather than per room, because generating is the OWNER's — a
 * quizmaster never spends this money, which is the whole arrangement. It is a
 * business record like the invoice book, so it backs up to the private repo
 * and comes back only into an empty ledger.
 */
const spend = new Spend(paths.spend);

/*
 * One room per quizmaster.
 *
 * `session`, `store` and `photos` used to be module-level singletons, which is
 * exactly what made a second login unsafe: Rob pressing Launch would have
 * ended Mark's night mid-question. Everything that belongs to one night now
 * hangs off a room, and every request resolves which room it is talking about
 * before it touches a game. See src/rooms.js.
 *
 * The house room keeps the original file locations, so deploying this in the
 * middle of a season does not lose a game that is being played as it restarts.
 */
const rooms = new Rooms({
  config,
  paths,
  onPush: (room) => pushState(room),
  // A night has just been filed. Keep it, or the record of somebody's gigs
  // lasts exactly until the next deploy. Never awaited — see backUpArchive.
  onArchive: (room) => { backUpArchive(room).catch(() => {}); },
  // A join code has been minted. Keep it, or a quizmaster's printed QR sends a
  // room to a game that does not exist after the next deploy.
  onCodes: (serialised) => { backUpCodes(serialised).catch(() => {}); },
});
rooms.get(HOUSE);

/**
 * Whether the GitHub backup actually works, not just whether it is configured.
 * Checked at most every five minutes so the console can say "token rejected"
 * up front rather than letting you find out after generating a quiz.
 */
let backupCheck = { at: 0, result: null };
async function backupStatus() {
  if (!githubConfigured()) return { ok: false, error: 'not set up' };
  if (backupCheck.result && Date.now() - backupCheck.at < 5 * 60 * 1000) return backupCheck.result;
  const result = await checkAccess();
  backupCheck = { at: Date.now(), result };
  return result;
}

// ------------------------------------------------------------- broadcasting

/**
 * Does this room take photos at all?
 *
 * TWO SWITCHES, and they answer different questions. `photos.enabled` is the
 * kill switch on the CONTROL VIEW — mid-gig, mic in hand, "stop that now", and
 * it lives on the night. This is the quizmaster's standing preference on My
 * account: "I do not run this feature." Both have to be on.
 *
 * It is deliberately NOT the usual `switchedOn` cosmetic toggle. Everywhere
 * else a feature switch only tidies the console and the server still answers,
 * because a switch that could 403 you mid-gig is a reliability risk for no
 * benefit. Photos are the exception and have to be: the whole meaning of "off"
 * here is that nobody in the room can put a picture on the wall, and a switch
 * that only hid the button would be a promise the app does not keep.
 */
function photosWanted(room) {
  if (!room.photos.enabled) return false;
  const account = accounts.find(room.id);
  // No account (the house room on a host key) keeps the old behaviour.
  return account ? switchedOn(account, FEATURES.PHOTOS) : true;
}

function viewFor(client) {
  // A client that arrived before its room existed, or whose room was never
  // booted, is shown the house game rather than nothing — the same silent
  // fallback a phone with no code gets.
  const room = client.room || rooms.get(HOUSE);
  const { session, photos } = room;
  const view = client.role === 'host' ? session.hostView()
    : client.role === 'player' ? session.playerView(client.playerId)
    : session.screenView();
  // The wall of photos rides along with whatever else is on screen, so it
  // survives every phase change and every game without each card knowing.
  if (client.role === 'screen') view.photos = photos.forScreen();
  else if (client.role === 'host') {
    // `enabled` here is what the room ACTUALLY does, not just the kill switch —
    // otherwise the control view shows photos on while the account preference
    // has them off, and the host reports the camera button as broken.
    view.photos = { enabled: photosWanted(room), count: photos.count(), items: photos.forHost() };
    // Who is knocking. Host only — the number is the whole point, because it
    // is what tells a room apart from somebody messing about.
    view.joinsWaiting = session.joins.waitingCount();
    /*
     * Whether this account actually HAS advert slides.
     *
     * The control view drew an Advert button for everybody. On Bronze, where
     * adverts are a Silver feature, pressing it said "make some on the Adverts
     * tab" — a tab that is greyed out with a `+` on it. A control that can
     * never do anything, pointing at a door that is locked.
     *
     * A room id IS an account id, so the answer is one lookup rather than
     * anything the browser has to be told.
     */
    view.mayAdvert = can(accounts.find(room.id) || null, FEATURES.ADVERTS);
  }
  else view.photosOpen = photosWanted(room);
  // Whose night this is — the name AND the two colours — travels with every
  // payload, so a page never has to ask for it separately or flash the wrong
  // thing while it loads. Taken from the ROOM, never from whoever is looking:
  // a phone at Rob's night says Rob's Quizporium in Rob's colours even while
  // the owner has the console open in the next tab.
  view.brand = brandForRoom(room);
  // The product half of the name, so a page can stack "Mark's" over
  // "Quizporium" instead of splitting on the last word and getting it wrong the
  // moment BRAND_NAME is set to something else. See `brandWords` in client.js.
  view.appName = config.appName;
  view.scheme = schemeForRoom(room);
  // Auto-play could not start the track. Host view only — it is a note to tap
  // the link, and it is nobody else's business.
  if (client.role === 'host' && room.introPlay) view.introPlay = room.introPlay;
  // Which game this is, so a phone that was handed a code can tell it reached
  // the right one and the projector can print it for latecomers.
  view.joinCode = room.code;
  return view;
}

/*
 * Press play on an intro question, best effort, never in the way.
 *
 * **The question goes up whether this works or not, and that is the whole
 * design.** The host has pressed Next with a room waiting; nothing here is
 * awaited before they get their answer back, nothing here can throw into the
 * request, and a failure is a line on their own control view rather than an
 * error. If it does not play they tap the Spotify link exactly as before —
 * which is what they were doing five minutes ago anyway.
 *
 * Only ever on the way IN to a question. Not on a reveal, not on Back, not on
 * a re-render: restarting the track because somebody pressed Back to check
 * something would be worse than not playing it at all.
 *
 * **It starts where the AUDIO starts, not where the file starts.** The clock
 * goes with the question, so dead air at the front of a track costs the whole
 * room score on that question for reasons unrelated to knowing the answer —
 * see `cueOffsetMs`. An unreadable or absent offset sends no `position_ms` at
 * all, which is what every pack on disk does today.
 */
const introPlayed = new Map();
function startIntroTrack(room, view) {
  const cue = view && view.phase === 'question' && view.question && view.question.cue;
  const uri = cue && cue.spotifyUri;
  if (!uri || !spotifyConfigured()) return;

  // Once per question. `run` is called for every host action, and a Back and a
  // Next landing on the same question must not start it over.
  const at = `${room.id}:${view.roundIndex}:${view.questionIndex}`;
  if (introPlayed.get(room.id) === at) return;
  introPlayed.set(room.id, at);

  playTrack(uri, { positionMs: cueOffsetMs(cue.from) || 0 }).then((result) => {
    // Remembered on the ROOM so the control view can say what happened, rather
    // than the host wondering whether they mis-tapped. Cleared by the next one.
    room.introPlay = result.ok ? null : { why: result.why, at: Date.now() };
    if (!result.ok) {
      console.warn('[spotify] could not start the intro track:', result.why);
      pushState(room);
    }
  }).catch(() => { /* never the request's problem */ });
}

const pushQueued = new Set();
function pushState(room) {
  // Coalesce: sixty phones answering at once is one broadcast, not sixty.
  // Queued PER ROOM, so a busy game in one room cannot swallow the push that
  // another room's question needed.
  const id = room ? room.id : HOUSE;
  if (pushQueued.has(id)) return;
  pushQueued.add(id);
  queueMicrotask(() => {
    pushQueued.delete(id);
    // Only the phones and screens watching THIS room. Broadcasting to everyone
    // would put one quizmaster's question on another's projector.
    hub.broadcast('state', viewFor, (client) => (client.room ? client.room.id : HOUSE) === id);
  });
}

// ----------------------------------------------------------------- helpers

function send(res, status, body, headers = {}) {
  res.writeHead(status, { 'Cache-Control': 'no-store', ...headers });
  res.end(body);
}

function sendJson(res, status, data) {
  send(res, status, JSON.stringify(data), { 'Content-Type': 'application/json; charset=utf-8' });
}

/** Raw bytes, refused rather than truncated once they go over the limit. */
async function readBody(req, limitBytes) {
  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    total += chunk.length;
    if (total > limitBytes) throw new Error('Body too large');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

/**
 * A request body, and NOTHING here may throw its way to a 500.
 *
 * Every phone route is open by design — a phone has no login — so the bodies
 * arriving at them are whatever the room, a flaky mobile connection or a venue
 * proxy sends. A fuzz of 145 malformed bodies produced **26 unhandled 500s**:
 * `JSON.parse` throwing on a truncated body, and — the sneakier half — bodies
 * that are perfectly valid JSON but are not OBJECTS (`null`, `[]`, `42`), which
 * parse fine and then blow up on the first property read.
 *
 * A 500 is not fatal here (the top-level catch keeps the server up) but it is
 * the wrong answer: it tells a phone nothing, and it is indistinguishable in
 * the log from a real fault on a night when something IS wrong.
 */
async function readJson(req, limitBytes = 1024 * 1024) {
  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    total += chunk.length;
    if (total > limitBytes) throw Object.assign(new Error('That request was too big.'), { badRequest: true });
    chunks.push(chunk);
  }
  if (!total) return {};

  let parsed;
  try {
    parsed = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw Object.assign(new Error('That request was not valid JSON.'), { badRequest: true });
  }
  // Not an object means there are no fields to read, and every route here
  // reads fields. An empty one behaves exactly like a missing body.
  return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
}

/** The address the QR code should point at. */
function publicOrigin(req) {
  if (config.publicUrl) return config.publicUrl.replace(/\/+$/, '');
  const proto = (req.headers['x-forwarded-proto'] || '').split(',')[0].trim() || 'http';
  const host = (req.headers['x-forwarded-host'] || req.headers.host || `localhost:${config.port}`).split(',')[0].trim();
  return `${proto}://${host}`;
}

/**
 * Where a phone should go to join a particular room.
 *
 * The house room gets the bare `/play` it has always had. That is not a
 * cosmetic choice: there are printed cards and bookmarks and a QR that has been
 * scanned at gigs, and every one of them says `/play`. Only the extra rooms
 * carry a code.
 */
function joinUrlFor(origin, code) {
  return code ? `${origin}/play?g=${encodeURIComponent(code)}` : `${origin}/play`;
}

/**
 * The host key: the way in before there were accounts.
 *
 * Still works, and deliberately still works. There are gigs in the diary and
 * a printed `?key=…` on somebody's phone, so the day accounts arrived could not
 * be the day the old way stopped. A request carrying the key is treated as the
 * owner wearing every hat at once — see `whoIs`.
 *
 * It is transitional. Once the owner and quizmaster accounts are set up and
 * signed in, HOST_KEY can be retired by removing this and the branch in
 * `whoIs` that uses it. Nothing else knows about it.
 */
function isHostKey(req, url) {
  const supplied = req.headers['x-host-key'] || url.searchParams.get('key') || '';
  return timingSafeEqual(String(supplied), HOST_KEY);
}

const SESSION_COOKIE = 'mmm_session';

/*
 * The owner wearing their quizmaster hat.
 *
 * One login, two hats. Mark is the app dev AND a quizmaster, and switching
 * rather than keeping two logins is not a convenience — it is the only way he
 * ever experiences the app as a subscriber does. The host key gives him every
 * feature at once, so any irritation a real quizmaster hits is invisible from
 * behind it. Wearing the hat properly is what finds those.
 *
 * It is only ever a DOWNGRADE: an owner becomes one specific quizmaster, with
 * that account's permissions, that account's room and the same read-only packs
 * everybody else gets. It cannot be used the other way round, and it cannot
 * reach anybody else's account — acting as ROB is support access, which is his
 * to grant and is logged, and that is a different feature.
 */
const ACTING_COOKIE = 'mmm_acting';

/*
 * Which TIER the hat is being worn as.
 *
 * Its own cookie rather than a field on the acting one, because the two answer
 * different questions and are cleared at different times: taking the hat off
 * ends the acting session, but which tier you were last looking at is worth
 * keeping for the next time you put it on.
 *
 * Read ONLY inside the acting branch of `whoIs`, so it means nothing at all to
 * a real quizmaster or to anybody not signed in as the owner. See the note
 * there for why it can only ever be a downgrade.
 */
const TIER_COOKIE = 'mmm_tier';

/** One cookie, with the same rules as the session one. */
function cookieFor(req, name, value, days = 30) {
  const secure = (req.headers['x-forwarded-proto'] || '').split(',')[0].trim() === 'https';
  return [
    `${name}=${encodeURIComponent(value)}`,
    'Path=/', 'HttpOnly', 'SameSite=Lax', `Max-Age=${days * 86400}`,
    ...(secure ? ['Secure'] : []),
  ].join('; ');
}

/** One cookie out of a header, without pulling in a parser. */
function cookie(req, name) {
  const header = req.headers.cookie || '';
  for (const part of header.split(';')) {
    const at = part.indexOf('=');
    if (at < 0) continue;
    if (part.slice(0, at).trim() === name) return decodeURIComponent(part.slice(at + 1).trim());
  }
  return '';
}

/**
 * Who is asking.
 *
 * A signed-in account, or the bootstrap host key, or nobody. The bootstrap
 * account is not written to disk and cannot sign in — it exists only so the
 * old `?key=` links keep working while the accounts are being set up.
 */
/**
 * Who is making this request.
 *
 * **The host key beats a signed-in account, deliberately, and the order here
 * matters more than it looks.** The owner account has no quiz controls at all —
 * that is the design, the owner writes and sells packs and does not run nights.
 * So on the one laptop that is both the dev machine and the gig machine,
 * signing in as the owner would otherwise take the Launch button away from the
 * `?key=` bookmark that has been running quiz nights for months. Minutes before
 * a gig, with no way back except signing out.
 *
 * It gives nothing away: the key already grants every feature in the app, so
 * preferring it cannot widen what the holder can do. It just means the way in
 * that predates accounts keeps working no matter what else is going on in the
 * browser, which is the whole reason it is still here.
 */
function whoIs(req, url) {
  if (isHostKey(req, url)) return BOOTSTRAP;
  const account = accounts.fromToken(cookie(req, SESSION_COOKIE));
  if (!account) return null;
  /*
   * A GROUP SEAT'S BILLING FIELDS ARE ITS PARENT'S, from here on — the one
   * choke point every `can()`/`featuresFor()`/`entitlements()` call in this
   * file goes through, so nothing downstream had to change. `accounts.js`
   * cannot do this itself: `plans.js` only ever sees one account and cannot
   * look another one up, and this is the one place that already has both.
   * A no-op for the 99% of accounts with no `parentId` at all.
   */
  const effective = (a) => accounts.effective(a);

  // Wearing the quizmaster hat. Checked against the account book rather than
  // trusted from the cookie, and only ever the owner's OWN linked quizmaster —
  // so this can never become a way into somebody else's night.
  const actingId = cookie(req, ACTING_COOKIE);
  if (actingId && account.role === 'owner') {
    const hat = accounts.find(actingId);
    /*
     * Two quite different ways to be inside a quizmaster account, and they are
     * deliberately not the same rule.
     *
     *  - YOUR OWN HAT: the owner's linked quizmaster, checked with `ownedBy`
     *    against the book rather than trusted from the cookie. Always allowed,
     *    because it is your own account.
     *  - SUPPORT ACCESS: somebody else's, and ONLY while they have opened the
     *    door. Checked on EVERY request rather than once on the way in, so a
     *    session cannot outlive the window — an hour later the same cookie
     *    stops working on its own, with nothing to remember to press.
     *
     * There is no third way in. The host key cannot reach here at all: it
     * returns BOOTSTRAP above and never reads this cookie, so holding the key
     * does not open a subscriber's account either. That is the promise, and
     * `test/support-access.test.js` is named after it.
     */
    const mine = hat && hat.ownedBy === account.id;
    const invited = hat && accounts.supportOpen(hat.id);
    if (hat && hat.role === 'quizmaster' && (mine || invited)) {
      const wearing = {
        ...hat,
        actingAs: true,
        realName: account.name || account.email,
        // Marked so every gate downstream can tell "the owner in their own
        // account" from "the owner inside somebody else's", which are not the
        // same thing and must not be allowed the same actions.
        /*
         * `inSupport`, not `support` — and the collision was a gig-night bug.
         *
         * This used to set `support: true`, which is ALSO the name of the
         * grant object every subscriber who has switched support access on
         * carries on their own account. So `supportGuard` read a truthy
         * `support` on Rob-signed-in-as-Rob and treated him as if he were the
         * owner inside his account: every `/api/host/*` route 403'd with
         * "support access cannot run a night", and his own Next and Reveal
         * were written into the log as though somebody else had tried them.
         * A quizmaster who left the door open could not run their own quiz.
         */
        ...(mine ? {} : { inSupport: true, supportFor: account.id }),
      };
      /*
       * …and, optionally, AS A PARTICULAR TIER.
       *
       * The linked quizmaster account is comped, so wearing the hat has always
       * shown the top of the ladder. That is the wrong half of the problem:
       * every irritation a real quizmaster hits is invisible behind the host
       * key, which is why the hat exists — and every irritation a BRONZE
       * quizmaster hits is invisible behind a comped account, for exactly the
       * same reason. "Rob says Invoices has gone" is not answerable from an
       * account that has everything.
       *
       * `comped` has to be cleared or the tier would mean nothing: a comped
       * account holds the whole ladder whatever tier it says. `status` is set
       * to active so a preview looks like a paying subscriber rather than a
       * lapsed one, which is a different thing worth being able to see on
       * purpose rather than by accident.
       *
       * ONLY EVER A DOWNGRADE. The account being previewed is the owner's own,
       * it already holds everything, and there is no tier above the top of the
       * ladder — so this can only ever show LESS than the hat already shows.
       */
      const preview = cookie(req, TIER_COOKIE);
      if (preview && TIERS.some((t) => t.id === preview)) {
        // A deliberate preview downgrade — see the comment above. Applied
        // AFTER effective(), or a seat's parent-derived tier would silently
        // win back over the preview the moment this runs.
        return { ...effective(wearing), previewTier: preview, tier: preview, comped: false, status: 'active' };
      }
      return effective(wearing);
    }
  }
  return effective(account);
}

/**
 * Which room this request is talking about.
 *
 * Two quite different questions, deliberately answered separately:
 *
 *  - A QUIZMASTER is working on their own room, always. It is decided by who
 *    they are signed in as and never by anything they send, so there is no
 *    parameter to tamper with and no way to drive somebody else's night.
 *  - A PHONE is told a code, off the projector. No code means the house room,
 *    which is what every QR printed before today says, so nothing Mark has
 *    already handed out or bookmarked stops working.
 */
/** Just enough about an account for the topbar to draw a switch. Never a hash. */
function summarise(account) {
  if (!account) return null;
  return { id: account.id, role: account.role, name: account.name || '', email: account.email || '' };
}

function roomIdFor(account) {
  // The owner and the host key both run the house room: it is Mark's, and it is
  // the game that was already running before rooms existed.
  if (!account || account.bootstrap || account.role === 'owner') return HOUSE;
  return account.id;
}

/*
 * Whose room is this, as an account?
 *
 * Looked up in the accounts book by room id rather than read off the room's own
 * `label`, and that is the load-bearing bit. A label is only set when somebody
 * who knows their own name touches the room — but the first thing to touch a
 * room after a restart is usually the PROJECTOR, which knows nothing. Branding
 * off the label would leave a big screen saying plain "Quizporium" until the
 * host happened to open a page, which is exactly the five minutes before a gig.
 *
 * A room id IS the account id (see `roomIdFor`), so the book always knows.
 */
function whoseRoom(room) {
  const id = room ? room.id : HOUSE;
  // The house room is the owner's own: it is the game that predates rooms and
  // it is what both the owner account and the host key drive.
  if (id === HOUSE) return accounts.owner;
  return accounts.find(id);
}

/** The name on this room's projector, phones and control view. */
/**
 * The packs this request is allowed to see.
 *
 * The console filters too, but this is the one that counts: a library that is
 * only trimmed in the browser is decoration, and the tier-preview work already
 * proved how quickly a page and its API drift apart. Same reasoning as the
 * Bronze preview returning a real 403 on invoices rather than just drawing
 * fewer tabs.
 *
 * `'all'` short-circuits, which is every account today — this is the mechanism
 * with nothing switched on.
 */
/**
 * The lowest tier that includes the whole catalogue, said in words.
 *
 * Worked out from `TIER_PACKS` rather than written out, so moving the line
 * between a starter set and everything cannot leave the account page quietly
 * naming the wrong tier at somebody who is being asked to pay for it.
 */
function fullLibraryTier(who) {
  const theirs = TIERS.find((t) => t.id === tierFor(who || {}));
  const rank = theirs ? theirs.rank : -1;

  /*
   * Only ever a tier ABOVE this one.
   *
   * The first version named the lowest tier holding the whole catalogue, which
   * today is Bronze — so a Bronze subscriber on a starter list was told that
   * Bronze includes every pack while looking at three of seven. That reads as
   * a bug in their account rather than as an offer.
   *
   * If their own tier already includes everything, the limit is an explicit
   * list on the account rather than the ladder, and there is no tier to sell
   * them — so it says nothing about tiers at all.
   */
  /*
   * The NEXT rung that widens the library, not the top one.
   *
   * Since Silver holds the evergreen catalogue and Gold adds the weekly
   * topical quizzes, "the lowest tier holding everything" is Gold — and
   * telling a Bronze subscriber on eight packs to jump two rungs skips the
   * step they should actually take. So it names the first rung that gives
   * them more than they have, and says what that rung is FOR.
   */
  const up = TIERS
    .filter((t) => t.rank > rank && (TIER_PACKS[t.id] === 'all' || TIER_PACKS[t.id] === 'evergreen'))
    .sort((a, b) => a.rank - b.rank)[0];
  if (!up) return 'Ask about the rest of the catalogue.';
  return TIER_PACKS[up.id] === 'all'
    ? `${up.label} includes every pack in the catalogue, and a fresh topical quiz every week.`
    : `${up.label} includes every pack in the catalogue, and each new one as it is written.`;
}

function onlyTheirPacks(library, who) {
  if (packsFor(who || {}) === 'all') return library;
  const may = packFilter(who || {});
  /*
   * A pack they WROTE is never filtered by a tier.
   *
   * The tier lever is the owner's catalogue — a starter set that runs out in
   * month four. Applying it to somebody's own work would mean their quiz
   * disappearing off their own console because of what they pay the owner,
   * which is not an upsell, it is taking their property away.
   */
  const keep = (p) => p.mine || may(p);
  return {
    ...library,
    quizzes: (library.quizzes || []).filter(keep),
    bingo: (library.bingo || []).filter(keep),
  };
}

/**
 * Everything this request may load a pack from: the shared catalogue, and the
 * room's own folder.
 *
 * The room comes from WHO YOU ARE, never from anything the request carries —
 * which is the whole enforcement for "the owner cannot read a subscriber's
 * packs". There is no id and no query string that reaches another room's
 * folder. See own-packs.js.
 */
function packCtx(req, url) {
  return { config, paths: roomForHost(req, url).paths };
}

/**
 * May this request READ the inside of this pack?
 *
 * **This is the gate the tier lever actually needs, and it was missing.**
 * Launching a pack outside your library was refused from the day the lever was
 * built — but READING one handed over every question and every answer, so a
 * starter library could be worked around by opening the other packs and typing
 * them out. A content lever with a hole in it is not a lever.
 *
 * Two things are always readable whatever the tier says: a pack they WROTE
 * (their own library is not the owner's catalogue and no tier reaches it), and
 * anything at all for an owner or the host key.
 */
function mayReadPack(req, url, kind, id) {
  const room = roomForHost(req, url);
  if (isOwnPack(kind, id, room.paths)) return true;
  return canPlayPack(whoIs(req, url), String(id), packDating(kind, id, room));
}

/**
 * Enough of a pack to tell a topical one from an evergreen one.
 *
 * The two id-only gates — reading a pack and launching one — have to know,
 * because Silver holds the whole evergreen catalogue and not the dated ones.
 * Read off the pack itself rather than inferred from its id: a topical pack is
 * named after the day it was written, so a gate keying on the name would work
 * today and open the moment somebody renamed one.
 *
 * A pack that is not there comes back bare, and the route below says so
 * properly — refusing here would turn "no such pack" into "not in your
 * library", which sends somebody to the shop looking for something that does
 * not exist.
 */
function packDating(kind, id, room) {
  try {
    // readPack hands back { pack, mine }, not the pack. Reading `freshUntil`
    // off the wrapper leaves every dated pack looking evergreen, which opens
    // this gate completely — and silently, because the shop card is drawn
    // from the library listing and still shows the padlock.
    const { pack } = readPack(kind, String(id), { config, paths: room.paths });
    return pack && pack.freshUntil ? { freshUntil: pack.freshUntil } : {};
  } catch {
    return {};
  }
}

/**
 * The catalogue as a SHOP: what they have, plus what they could buy.
 *
 * `onlyTheirPacks` above drops everything outside their library, which is
 * right for the control view's picker — you cannot launch what you do not
 * have, and offering it there is a button that refuses mid-gig. On the console
 * it is wrong: a library that silently omits two thirds of the catalogue tells
 * a subscriber nothing about what upgrading would get them.
 *
 * So the console gets both, and a locked one is **stripped down to what a shop
 * window may show**. That stripping is the load-bearing part, not decoration:
 * a pack summary carries `search`, which is every question and every answer
 * blobbed together for the search box, and a bingo summary carries a Spotify
 * link to the whole track list. Sending either would hand over the pack while
 * drawing a padlock on it.
 */
function withShop(library, who) {
  if (packsFor(who || {}) === 'all') return library;
  const may = packFilter(who || {});

  const shelf = (pack) => {
    if (pack.mine || may(pack)) return pack;
    // Title, size and price. Nothing that is the thing itself.
    const { search, playlist, problems, broken, ...rest } = pack;
    return { ...rest, locked: true, pence: PACK_PENCE };
  };

  return {
    ...library,
    quizzes: (library.quizzes || []).map(shelf),
    bingo: (library.bingo || []).map(shelf),
  };
}

function brandForRoom(room) {
  const who = whoseRoom(room);
  return brandFor(who ? (who.name || who.email) : '', {
    appName: config.appName,
    override: config.brandName,
  });
}

/** The two colours this room's screens wear. */
function schemeForRoom(room) {
  const who = whoseRoom(room);
  return findScheme(who ? who.scheme : DEFAULT_SCHEME);
}

function roomForHost(req, url) {
  const account = whoIs(req, url);
  return rooms.get(roomIdFor(account), account ? account.name || account.email : '');
}

function roomForPhone(req, url, body = null) {
  const code = tidyCode((body && body.joinCode) || url.searchParams.get('g') || '');
  if (!code) return rooms.get(HOUSE);
  return rooms.byCode(code) || rooms.get(HOUSE);
}

const BOOTSTRAP = {
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
function allowed(req, res, url, feature, { live = false } = {}) {
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
function packStillThere(kind, id, room) {
  return isOwnPack(kind, id, room.paths) || inCatalogue(kind, id, config);
}

const problemsWith = (show, room) => showProblems(show, (kind, id) => packStillThere(kind, id, room));

/**
 * Their shows, each carrying what is wrong with it TODAY.
 *
 * Worked out here rather than in the browser because this is the check the
 * launch itself will make — the console knowing the answer to a slightly
 * different question is exactly how a card comes to say a night is ready and
 * the launch then says it is not.
 */
function showsFor(room) {
  return listShows(room.paths).map((show) => {
    const problems = problemsWith(show, room);
    return problems.length ? { ...show, problems } : show;
  });
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.ico': 'image/x-icon',
};

/**
 * A static file, with something the browser can CHECK it against.
 *
 * `no-cache` on its own says "ask before you use this" — but with no validator
 * there is nothing to ask about, so anything in the middle (a carrier proxy, a
 * venue's wifi box) is free to hand back whatever it kept. That is how a phone
 * ends up with a new `play.js` and an old `style.css`, which is not a blank
 * page you would notice: it is half the app quietly not working. It happened
 * to the prop tray, where the tiles came back with no box and collapsed to
 * nothing.
 *
 * So every file carries an ETag built from its size and mtime. A deploy
 * changes both, so a stale copy can never validate; an unchanged one answers
 * 304 and costs a header rather than the file. There is no build step here to
 * put a hash in a filename, and this needs none.
 */
function serveFile(res, baseDir, relPath, { cache = false } = {}) {
  // Resolve and then check we are still inside the directory we meant.
  const full = path.resolve(baseDir, '.' + path.posix.normalize('/' + relPath));
  if (!full.startsWith(path.resolve(baseDir))) return send(res, 403, 'Forbidden');
  fs.stat(full, (statErr, stat) => {
    if (statErr) return send(res, 404, 'Not found');
    const tag = `W/"${stat.size.toString(16)}-${Math.floor(stat.mtimeMs).toString(16)}"`;
    const headers = {
      'Content-Type': MIME[path.extname(full).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': cache ? 'public, max-age=3600' : 'no-cache',
      'ETag': tag,
      'Last-Modified': new Date(stat.mtimeMs).toUTCString(),
    };
    if (res.req && res.req.headers['if-none-match'] === tag) {
      res.writeHead(304, headers);
      return res.end();
    }
    fs.readFile(full, (err, data) => {
      if (err) return send(res, 404, 'Not found');
      res.writeHead(200, headers);
      res.end(data);
    });
  });
}

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
 * ---- what a support session may do, and what it writes down
 *
 * Both halves live here rather than on each route, so the next route somebody
 * adds is covered without them having to think about it.
 *
 * REFUSED: anything under /api/host/*. That is the running of a night — Next,
 * Back, Reveal, Launch — and the whole reason support access waits for the gig
 * to be over. Entry already refuses while their game is live; this is the
 * other half, for a game that starts WHILE somebody is inside.
 *
 * LOGGED: reads as well as writes, because "did you look at my quizzes" is the
 * question this log exists to answer, and a writes-only log is silent about
 * exactly that. What is skipped is the noise that would drown it — the state
 * poll, the live stream, health checks and static files — none of which says
 * anything a subscriber would want to read.
 */
/**
 * How long one stretch of support access lasts before the subscriber has to
 * say they still need it. A dead man's switch, not a booking — see
 * `openSupport()` in accounts.js.
 */
const SUPPORT_MINUTES = 30;

const SUPPORT_NEVER = ['/api/host/'];
const SUPPORT_QUIET = ['/api/state', '/api/live', '/health', '/api/me', '/api/brand', '/api/has-accounts'];

/**
 * What a support session did, in words a subscriber would use.
 *
 * The log is read by somebody deciding whether they trust you, so it has to
 * say what happened rather than which endpoint was called. "GET /api/library"
 * is developer-speak; "Looked at your pack library" is the same fact in a
 * sentence they can judge. Anything unmapped falls back to the raw route,
 * which is honest — better an ugly line than a missing one.
 */
function supportWords(method, route) {
  const read = method === 'GET';
  if (route.startsWith('/api/quiz/') || route.startsWith('/api/bingo/')) {
    const id = decodeURIComponent(route.split('/')[3] || '');
    return read ? `Opened your pack "${id}"` : `Changed your pack "${id}"`;
  }
  /*
   * Their OWN packs, which is the whole reason support access exists.
   *
   * Said in the plainest words in this list, because these are the lines
   * somebody scrolls back to when they are deciding whether they still trust
   * you with a key to their material.
   */
  if (route.startsWith('/api/mine/')) {
    const id = decodeURIComponent(route.split('/')[4] || '');
    if (route.startsWith('/api/mine/import')) return 'Imported a track list into your own packs';
    /*
     * **Looking is not changing, and this log said it was.**
     *
     * `read` was worked out at the top of this function and then ignored here,
     * so a GET of somebody's own pack was written down as "Changed your own
     * pack" and a GET of the list as "Saved one of your own packs". On the one
     * log whose entire job is telling a subscriber what was done to their
     * material, that accuses you of altering their work when you only opened
     * it — which is worse than a missing entry, because they will believe it.
     * The block above gets this right for the catalogue; this one did not.
     */
    if (id) return read ? `Opened your own pack "${id}"` : `Changed your own pack "${id}"`;
    return read ? 'Looked at your own packs' : 'Saved one of your own packs';
  }
  if (route.startsWith('/api/invoices')) {
    return read ? 'Looked at your invoices' : 'Changed something in your invoices';
  }
  if (route.startsWith('/api/advert')) {
    return read ? 'Looked at your venue slides' : 'Changed your venue slides';
  }
  if (route.startsWith('/api/archive')) return 'Looked at your past nights';
  if (route.startsWith('/api/photos')) return 'Looked at your photos';
  if (route === '/api/library') return 'Looked at your pack library';
  return `${method} ${route}`;
}

function supportGuard(req, res, url, route) {
  if (!route.startsWith('/api/')) return true;
  const who = whoIs(req, url);
  // The flag set by whoIs on an ACTING identity, never the grant object a
  // subscriber carries on their own account — see the note there.
  if (!who || !who.inSupport) return true;

  if (SUPPORT_NEVER.some((p) => route.startsWith(p))) {
    accounts.noteSupport(who.id, 'Tried to run your game — refused, support access cannot touch a night');
    sendJson(res, 403, {
      error: 'Support access cannot run a night. Ask them to close the game first, or come back when it is over.',
    });
    return false;
  }

  if (!SUPPORT_QUIET.some((p) => route === p || route.startsWith(p + '/'))) {
    accounts.noteSupport(who.id, supportWords(req.method, route));
  }
  return true;
}

async function handleGet(req, res, url, route) {
  // ---- pages
  /*
   * THE BARE DOMAIN IS THE QUIZMASTER'S FRONT DOOR, not the projector.
   *
   * It used to redirect to `/screen`, which meant typing quizporium.co.uk got
   * you a lobby slide with a QR on it — the one page that is opened once, on a
   * laptop plugged into a projector, from a link on the console. Nobody
   * arrives at the bare domain wanting that. The people who type it are the
   * quizmaster, and what they want is in.
   *
   * PLAYERS ARE UNAFFECTED: every QR, every printed card and every join link
   * says `/play`, never the bare domain — see `joinUrlFor`.
   *
   * `no-store`, because where this goes depends on WHO IS ASKING. A cached 302
   * to /login would follow a signed-in quizmaster around for as long as the
   * browser kept it, which is the kind of fault nobody thinks to look for.
   */
  if (route === '/') {
    const who = whoIs(req, url);
    const to = who ? (who.role === 'owner' ? '/owner' : '/console') : '/login';
    send(res, 302, '', { Location: to, 'Cache-Control': 'no-store' });
    return true;
  }
  if (route === '/screen') return serveFile(res, config.publicDir, 'screen.html'), true;
  if (route === '/play') return serveFile(res, config.publicDir, 'play.html'), true;
  // Where a scanned voucher lands. Open, like /play and the sign-in page:
  // it hands out nothing on its own, the code in the address has to be right.
  if (route === '/v') return serveFile(res, config.publicDir, 'voucher.html'), true;
  // The photo gallery. Open, like /play and /v — it is for the people who were
  // in the room, who have no account and never will. It shows only nights the
  // quizmaster has published; see src/gallery.js.
  /*
   * THE ADVERT OFFER PAGE — `/o/<pack>/<slide>`, and the QR points here.
   *
   * Public by necessity: it is scanned by whoever is in the room, on a phone
   * with no account and no key. It records ONE open and shows the offer.
   *
   * **The same room question the gallery has, answered the same way**, so the
   * two cannot drift: the app owner's own quizmaster room, falling back to the
   * house. **A second subscriber's offers need the same slug the gallery
   * needs** — one job fixes both, and inventing a parallel mechanism here
   * would mean fixing it twice.
   */
  if (route.startsWith('/o/')) {
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    const bits = route.slice(3).split('/').map((b) => decodeURIComponent(b));
    const room = rooms.get(offerRoomId());
    /*
     * `loadAdvertPack` THROWS on a pack that is not there, so this has to
     * catch: a mistyped or retired code is the ordinary case for a public
     * address printed on a projector, and it must land on the "nothing here"
     * page rather than a 500. Found by scanning a code that did not exist.
     */
    let pack = null;
    try { pack = bits[0] && bits[1] ? loadAdvertPack(room.paths.adverts, bits[0]) : null; } catch { pack = null; }
    const slide = pack ? (pack.slides || []).find((sl) => sl.id === bits[1]) : null;
    if (!slide) {
      return send(res, 404, offerPage(null, null), { 'Content-Type': 'text/html; charset=utf-8' }), true;
    }
    /*
     * COUNTED BEFORE IT IS DRAWN, and never awaited into the response beyond
     * the write itself: the person holding the phone is standing in a pub, and
     * a page that waits on bookkeeping is a page they close.
     */
    try { room.offers.opened(bits[0], bits[1]); } catch { /* a lost count is not worth a 500 */ }
    return send(res, 200, offerPage(pack, slide), { 'Content-Type': 'text/html; charset=utf-8' }), true;
  }

  if (route === '/gallery') {
    // NOT in a search result, published or not. Being findable is speculative
    // marketing value; a stranger's face in a search result is a concrete cost
    // that lands on the player. One header to change later if it earns it.
    res.setHeader('X-Robots-Tag', 'noindex, nofollow, noimageindex');
    return serveFile(res, config.publicDir, 'gallery.html'), true;
  }
  /*
   * THE PUBLIC LEAGUE TABLE — the same shape and the same header as the
   * gallery one door up, because it is the same kind of page: something the
   * people who were in the room come back to, holding names they typed on a
   * night rather than anything they signed up for. Not findable, published
   * or not.
   */
  if (route === '/league') {
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    return serveFile(res, config.publicDir, 'league.html'), true;
  }
  if (route === '/host') return serveFile(res, config.publicDir, 'host.html'), true;
  if (route === '/editor') return serveFile(res, config.publicDir, 'editor.html'), true;
  if (route === '/console') return serveFile(res, config.publicDir, 'console.html'), true;
  if (route === '/login') return serveFile(res, config.publicDir, 'login.html'), true;
  // The shop window — open to anybody, no key, no account. The place a
  // referral or a search result lands.
  if (route === '/home') return serveFile(res, config.publicDir, 'home.html'), true;
  if (route === '/signup') return serveFile(res, config.publicDir, 'signup.html'), true;
  // Legal pages — plain static HTML, same shell as /home. Linked from the
  // landing page footer and from account/signup so they are always one tap
  // away, never a page that only exists if you already know the URL.
  if (route === '/terms') return serveFile(res, config.publicDir, 'terms.html'), true;
  if (route === '/privacy') return serveFile(res, config.publicDir, 'privacy.html'), true;
  if (route === '/refunds') return serveFile(res, config.publicDir, 'refunds.html'), true;
  // Open, like the sign-in page. It hands out nothing on its own — the token
  // in the address is what has to be right, and the page asks the server.
  if (route === '/reset') return serveFile(res, config.publicDir, 'reset.html'), true;
  if (route === '/owner') return serveFile(res, config.publicDir, 'owner.html'), true;
  /*
   * The tab icon: the same record that is in the top left of every screen,
   * from the same drawing, so the two cannot drift apart.
   *
   * SVG rather than a .ico because there is no build step here to make one,
   * and every browser worth worrying about has taken SVG favicons since 2022.
   * A browser that has not simply shows its default, which is what it showed
   * before this existed.
   */
  if (route === '/favicon.svg') {
    return send(res, 200, faviconSvg(), {
      'Content-Type': 'image/svg+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=86400',
    }), true;
  }
  if (route === '/health') {
    const house = rooms.get(HOUSE);
    return sendJson(res, 200, { ok: true, game: house.session.kind, phase: house.session.engine.state.phase, rooms: rooms.all().length }), true;
  }

  // ---- static
  if (route.startsWith('/assets/')) {
    return serveFile(res, config.publicDir, route), true;
  }
  if (route.startsWith('/quiz-images/')) {
    const rel = decodeURIComponent(route.slice('/quiz-images/'.length));
    // If the real artwork is not there yet, fall back to a placeholder of the
    // same name. That way a quiz pack can name its final .png files from the
    // start and still be rehearsable before any images have been made.
    const swap = rel.replace(/\.(png|jpg|jpeg|webp)$/i, '.svg');
    const exists = fs.existsSync(path.join(config.imageDir, rel));
    return serveFile(res, config.imageDir, exists ? rel : swap, { cache: true }), true;
  }

  /*
   * Serving a photo. Only a filename the app itself issued is ever looked up,
   * so nothing from the request reaches the filesystem as a path.
   *
   * No key on this one — it has to load on the projector, which has no key,
   * and the whole point is that the room can see them.
   */
  if (route.startsWith('/photos/')) {
    // Every room's wall, because the URL carries only the filename the app
    // itself issued. The name is unique across rooms (it has the timestamp and
    // a counter in it), and a projector has no session to tell us whose it is.
    const wanted = decodeURIComponent(route.slice('/photos/'.length));
    let full = null;
    for (const room of rooms.all()) {
      full = room.photos.fileFor(wanted);
      if (full) break;
    }
    if (!full) return send(res, 404, 'Not found'), true;
    return fs.readFile(full, (err, data) => {
      if (err) return send(res, 404, 'Not found');
      res.writeHead(200, {
        'Content-Type': MIME[path.extname(full).toLowerCase()] || 'image/jpeg',
        'Cache-Control': 'public, max-age=3600',
      });
      res.end(data);
    }), true;
  }

  /*
   * Everything on this server, foldered by night — the owner's tab.
   *
   * **`PHOTO_EXPORT`, not `PHOTOS`, and the difference is who it is for.** Every
   * quizmaster has photos from the room; what is here is getting them off and
   * onto social media afterwards, which is Mark's own workflow on Mark's own
   * room and was asked for on the owner's page rather than in the console every
   * subscriber sees. A quizmaster sees their nights and the pictures from them
   * on Past gigs, read only — the switch and the bin are on the control view,
   * where they are needed with a mic in one hand.
   *
   * It is `/api/owner/…` so it skips the broad quiz gate — an owner holds no
   * quiz features by design, which is the trap this file has recorded six times.
   */
  if (route === '/api/owner/photos') {
    if (!allowed(req, res, url, FEATURES.PHOTO_EXPORT)) return true;
    const { photos } = roomForHost(req, url);
    return sendJson(res, 200, {
      enabled: photos.enabled,
      count: photos.count(),
      unfiled: photos.unfiled().length,
      repo: photosRepoName(),
      repoReady: photosRepoConfigured(),
      // Which variable is actually missing, and whether one that IS set looks
      // wrong. "It says temporary" is not something anybody can act on.
      missing: missingPhotoConfig(),
      repoProblem: photoRepoProblem(),
      // Proof the app can see a value at all, without printing a token.
      seen: {
        PHOTO_REPO: Boolean(process.env.PHOTO_REPO),
        PHOTO_BRANCH: process.env.PHOTO_BRANCH || '(default: main)',
        PHOTO_TOKEN: Boolean(process.env.PHOTO_TOKEN),
        GITHUB_TOKEN: Boolean(process.env.GITHUB_TOKEN),
      },
      nights: photos.nights(),
    }), true;
  }

  // ---- the join QR
  if (route === '/api/voucher' && req.method === 'GET') {
    const room = roomForPhone(req, url);
    const code = String(url.searchParams.get('c') || '').toUpperCase();
    const found = (room.session.engine?.state?.vouchers || {})[code];
    // Says nothing about the room, the night or any other voucher — a bad code
    // is simply not a voucher here.
    if (!found) return sendJson(res, 404, { error: 'That code is not a voucher here.' }), true;
    return sendJson(res, 200, {
      code: found.code,
      name: found.name,
      reward: found.reward,
      venue: found.venue,
      issuedAt: found.issuedAt,
      redeemedAt: found.redeemedAt,
      // So the bar can see it has been put back rather than wondering.
      reinstated: found.reinstated || 0,
    }), true;
  }

  if (route === '/join-qr.svg') {
    // The code of the room asking for it, so a phone that scans Rob's
    // projector joins Rob's game. The house room has no code and its QR is the
    // plain /play it has always been, so every printed card still works.
    const room = roomForPhone(req, url) ;
    const target = joinUrlFor(publicOrigin(req), room.code);
    send(res, 200, toSvg(target, { margin: 2, dark: '#0b0b12', light: '#ffffff' }), {
      'Content-Type': 'image/svg+xml; charset=utf-8',
    });
    return true;
  }
  // A general-purpose QR, ready for the Instagram code on the lobby screen.
  if (route === '/qr.svg') {
    const text = url.searchParams.get('text') || publicOrigin(req);
    send(res, 200, toSvg(text, { margin: 2, dark: url.searchParams.get('dark') || '#0b0b12', light: url.searchParams.get('light') || '#ffffff' }), {
      'Content-Type': 'image/svg+xml; charset=utf-8',
    });
    return true;
  }

  // ---- realtime
  if (route === '/api/stream') {
    const role = url.searchParams.get('role') || 'screen';
    // The projector and the phones are open by design; only the control view
    // is not. Asked with `live` set, because this is the connection a running
    // game hangs off and a failed payment must not cut it.
    if (role === 'host' && !allowed(req, res, url, FEATURES.QUIZ, { live: true })) return true;
    const playerId = url.searchParams.get('playerId') || null;
    // The control view drives the room of whoever is signed in; a projector or
    // a phone follows the code it was given.
    const room = role === 'host' ? roomForHost(req, url) : roomForPhone(req, url);
    if (playerId) room.session.engine.touch(playerId);
    const client = hub.add(res, { role, playerId, room });
    hub.send(client, 'state', viewFor(client));
    return true;
  }

  // ---- info
  if (route === '/api/join-url') {
    const room = roomForPhone(req, url);
    return sendJson(res, 200, {
      url: joinUrlFor(publicOrigin(req), room.code),
      code: room.code,
      brand: brandForRoom(room),
    }), true;
  }
  /*
   * ---- signing in
   *
   * Open, obviously — it is the way in. The token goes in an httpOnly cookie so
   * a script on the page cannot read it, and SameSite=Lax so another site
   * cannot spend it. `secure` only when the request actually arrived over
   * https, or a laptop on http://localhost could never sign in.
   */
  /*
   * The reports. Owner only — these are corrections to the owner's own packs,
   * and a quizmaster seeing everybody else's would be the same mistake as the
   * invoice book being shared.
   */
  if (route === '/api/reports') {
    if (!allowed(req, res, url, FEATURES.CATALOGUE)) return true;
    return sendJson(res, 200, { reports: reports.all(), ...reports.summary() }), true;
  }

  if (route === '/api/owner/accounts') {
    if (!allowed(req, res, url, FEATURES.SUBSCRIBERS)) return true;
    return sendJson(res, 200, { accounts: subscriberList(), backupReady: privateRepoConfigured() }), true;
  }

  /*
   * The three things the owner page could not answer before: what is on a
   * projector right now, what the catalogue is actually worth, and what the AI
   * has cost.
   *
   * One route rather than three, because the page draws them together and
   * three fetches means three ways for the page to be half drawn. None of it
   * is big — the rooms are already in memory, the play counts are one file,
   * and the ledger is summarised rather than sent.
   *
   * Nothing here reveals a quizmaster's own packs. Their rooms say which
   * CATALOGUE pack is loaded, which the owner wrote; a room playing one of
   * their own says so and names nothing.
   */
  if (route === '/api/owner/overview') {
    if (!allowed(req, res, url, FEATURES.SUBSCRIBERS)) return true;
    /*
     * Wake every room that has a saved game before answering.
     *
     * Rooms are made lazily, so after a restart only the house room is in
     * memory — and "nothing is running, safe to deploy" would have been a
     * confident lie told at exactly the moment it matters most, because a
     * quizmaster's phones have not reconnected yet. Reading their state file
     * is what happens the second they do; doing it here costs one file read
     * per subscriber and makes the answer true.
     *
     * Only accounts that still exist, so a closed one does not come back as a
     * room, and only ones with something saved — a subscriber who has never
     * run a night has nothing to restore and should not appear as idle.
     */
    for (const account of accounts.all) {
      if (account.role !== 'quizmaster') continue;
      if (rooms.rooms.has(account.id)) continue;
      try {
        if (fs.existsSync(rooms.pathsFor(account.id).state)) rooms.get(account.id, account.name || '');
      } catch { /* a room that will not boot is not worth taking this page down for */ }
    }
    const live = rooms.summaries().map((room) => {
      const who = whoseRoom({ id: room.id });
      const ownPack = room.id !== HOUSE
        && isOwnPack(room.game, room.packId || '', rooms.get(room.id).paths);
      return {
        ...room,
        who: (who && (who.name || who.email)) || '',
        /*
         * One of theirs is "one of their own" and nothing more.
         *
         * The ID goes as well as the title, and that is not fussiness: a pack
         * id is the title slugged, so leaving it would put "robs-secret-quiz"
         * on the owner's page under a line saying the owner cannot read it.
         */
        ...(ownPack ? { pack: 'One of their own', packId: '', own: true } : {}),
      };
    });
    return sendJson(res, 200, {
      rooms: live,
      packs: cataloguePerformance(),
      spend: spend.summary({ months: 12 }),
      spendBackedUp: privateRepoConfigured(),
    }), true;
  }

  /*
   * Are there accounts on this app at all?
   *
   * Open, and deliberately says nothing more than yes or no — it exists so the
   * console can tell "sign in" apart from "type the host key", which are very
   * different pieces of advice to give somebody locked out five minutes before
   * a gig. It reveals no email address and no count.
   */
  if (route === '/api/has-accounts') {
    return sendJson(res, 200, { any: accounts.all.length > 0 }), true;
  }

  if (route === '/api/me') {
    const account = whoIs(req, url);
    if (!account) return sendJson(res, 200, { signedIn: false }), true;
    return sendJson(res, 200, {
      signedIn: true,
      account: {
        ...account,
        entitlements: entitlements(account),
        // 20% of what everybody THIS account referred is paying, added up —
        // see referralCredit() in accounts.js. Nothing to compute for the
        // owner, who has no subscription of their own to credit. On the
        // account object, not a sibling of it, because the browser reads
        // `who.account` and drops everything else in the response.
        referralCreditPence: account.role === 'owner' ? 0 : accounts.referralCredit(account.id),
      },
      /*
       * THE LIVE LADDER, so the browser stops working off the shipped one.
       *
       * `plans.js` runs in both places and its overrides start empty in a
       * fresh page. Without this the console would draw a Silver lock badge on
       * something the owner moved to Gold — the app quoting a price that is
       * not the price.
       *
       * **CALLED `featureTiers`, NOT `tiers`, AND THAT IS A BUG FIX.** This
       * object literal ALREADY has a `tiers` key forty lines down — the rungs
       * the hat switch draws — so the first version of this silently lost to
       * it: a later duplicate key in an object literal simply wins, with no
       * error anywhere. The browser was handed an array of rungs where it
       * expected a feature map, `setTierOverrides` quietly ignored all of it,
       * and every page carried on drawing the SHIPPED ladder while the server
       * had stored the owner's. Nothing looked broken on either side.
       *
       * Only the DIFFERENCES: a few bytes on a payload every page fetches
       * anyway, rather than a route of its own.
       */
      featureTiers: accounts.featureTiers(),
      // Said out loud, because a bootstrap session looks exactly like a real
      // one until something it cannot do goes wrong.
      bootstrap: Boolean(account.bootstrap),
      // Wearing the quizmaster hat. Every page shows a bar saying so — being
      // unsure which hat is on is worse than either hat.
      actingAs: Boolean(account.actingAs),
      realName: account.realName || '',
      /*
       * Signed in AS WELL as holding the host key.
       *
       * The key deliberately beats the cookie (see `whoIs`), which is right on a
       * gig night — but it meant that once a browser had seen `?key=…`, the hat
       * switch vanished for good, because a bootstrap request has no owner
       * identity to switch between. You could never look at the quizmaster side
       * from the laptop you actually work on.
       *
       * So the browser is told the cookie is there too. It draws the switch,
       * and picking a hat forgets the remembered key — the server's ordering is
       * untouched, and the bookmark still works because the key is in its URL.
       */
      alsoSignedIn: account.bootstrap ? summarise(accounts.fromToken(cookie(req, SESSION_COOKIE))) : null,
      // Which rung of the ladder the hat is being worn as, if any. Empty means
      // "as the linked account really is", which is comped — the whole ladder.
      previewTier: account.previewTier || '',
      /*
       * The rungs to offer. Anybody who can WEAR the hat gets them, not only
       * somebody already wearing it — the switch is one menu in every state,
       * and tapping a rung with the hat off means "put it on and show me that".
       * A real quizmaster has nothing to preview and is sent nothing to draw.
       */
      tiers: (account.actingAs || account.role === 'owner' || account.bootstrap)
        ? TIERS.map(({ id, label, plan }) => ({ id, label, plan }))
        : [],
    }), true;
  }

  /*
   * Your own group — a company or a pub group, seats under a parent. See
   * the POST/DELETE routes in `handleWrite` for adding and removing a seat;
   * this is the read half, and it lives HERE rather than there because GET
   * requests are dispatched to `handleGet`, never to `handleWrite` — a
   * lesson this codebase has already paid for once, the hard way (the
   * gallery publish route, defined inside `handleGet` where a POST could
   * never reach it). A route in the wrong handler is dead code that reads
   * as a feature.
   */
  if (route === '/api/group' && req.method === 'GET') {
    const me = whoIs(req, url);
    if (!me) return sendJson(res, 401, { error: 'Sign in first' }), true;
    if (me.bootstrap || me.role === 'owner') return sendJson(res, 200, { seats: [], isSeat: false }), true;
    if (me.parentId) return sendJson(res, 200, { seats: [], isSeat: true }), true;
    const seats = accounts.groupStatus(me.id, (childId) => {
      const room = rooms.get(roomIdFor({ id: childId, role: 'quizmaster' }));
      const state = room.session.engine.state;
      const live = state.phase !== 'lobby' || room.session.engine.playerList().length > 0;
      if (!live) return null;
      return { phase: state.phase, playerCount: room.session.engine.playerList().length, title: room.session.pack.title };
    });
    return sendJson(res, 200, { seats, isSeat: false }), true;
  }

  /*
   * Whose night is this, and what does it look like.
   *
   * Open, because the join page needs it before anybody has joined — and it
   * answers for the ROOM the caller reached for, so a phone that scanned Rob's
   * projector gets Rob's name and Rob's colours without signing in to anything.
   * The console asks with `role=host` to get its own instead.
   */
  if (route === '/api/brand') {
    // The public gallery names whose photos these are the same way it picks
    // which room's — `?q=`, an account id, no more secret than the one
    // already in every `/signup?ref=` link. Checked before the role branch
    // below: a gallery visit carries neither `role=host` nor a join code.
    const galleryQ = String(url.searchParams.get('q') || '').trim();
    const room = galleryQ ? rooms.get(galleryQ)
      : url.searchParams.get('role') === 'host'
        ? roomForHost(req, url)
        : roomForPhone(req, url);
    return sendJson(res, 200, {
      name: brandForRoom(room),
      scheme: schemeForRoom(room),
      appName: config.appName,
    }), true;
  }
  if (route === '/api/state') {
    const role = url.searchParams.get('role') || 'screen';
    // The projector and the phones are open by design; only the control view
    // is not. Asked with `live` set, because this is the connection a running
    // game hangs off and a failed payment must not cut it.
    if (role === 'host' && !allowed(req, res, url, FEATURES.QUIZ, { live: true })) return true;
    const room = role === 'host' ? roomForHost(req, url) : roomForPhone(req, url);
    return sendJson(res, 200, viewFor({ role, playerId: url.searchParams.get('playerId'), room })), true;
  }

  // ---- host-only reads
  if (route === '/api/quizzes') {
    if (!allowed(req, res, url, FEATURES.LIBRARY)) return true;
    const room = roomForHost(req, url);
    const seen = onlyTheirPacks(fullLibrary(config, room.id, listOwn(room.paths)), whoIs(req, url));
    return sendJson(res, 200, { quizzes: seen.quizzes, loaded: room.session.pack.id }), true;
  }
  // The console's library: every quiz and every bingo pack you have saved.
  if (route === '/api/library') {
    if (!allowed(req, res, url, FEATURES.LIBRARY)) return true;
    const libRoom = roomForHost(req, url);
    /*
     * THE INVOICE BOOK HAS TO BE BACK BEFORE THE VENUES ARE READ OFF IT.
     *
     * Rooms are made lazily and `data/` is empty after every deploy, so the
     * book only exists once it has been restored from the private repo — and
     * that used to be triggered by the invoice routes alone. The Venues tab
     * reads `venueRecords` out of this payload, so a console opened after a
     * deploy showed "no venues yet" until somebody happened to visit the
     * Invoices tab, at which point they reappeared. Somebody's venues looking
     * deleted is not a thing to leave to a lucky click.
     */
    await ensureInvoicesRestored(libRoom);
    // Their own packs come back from the backup the first time they look, on a
    // host that wipes its disk every deploy. Awaited, because a library drawn
    // without them looks exactly like a library that has lost them.
    await ensureOwnPacksRestored(libRoom);
    // And their past nights, for the same reason and by the same rule.
    await ensureArchiveRestored(libRoom);
    // And their venue slides, which live in the packs repository under their
    // own room — the house's are in the main repo and arrive with the deploy.
    await ensureAdvertsRestored(libRoom);
    const everything = fullLibrary(config, libRoom.id, listOwn(libRoom.paths));
    // The console sees the whole catalogue: theirs to play, the rest to buy.
    // Everything they do not hold comes back stripped — see withShop.
    const library = withShop(everything, whoIs(req, url));
    /*
     * How big the whole catalogue is, so the account page can say "3 of 20".
     *
     * Sent always and compared in the browser, rather than the server deciding
     * whether somebody is missing anything: the console already has its own
     * count, and one side working it out from two numbers cannot disagree with
     * the other about what those numbers are.
     */
    const catalogue = {
      // The CATALOGUE's size, so "3 of 7" counts what is for sale. Packs they
      // wrote themselves are not part of what a tier holds, so they are not
      // part of what a tier is measured against either.
      quizzes: (everything.quizzes || []).filter((p) => !p.mine).length,
      bingo: (everything.bingo || []).filter((p) => !p.mine).length,
      blurb: fullLibraryTier(whoIs(req, url)),
    };
    const backup = await backupStatus();
    const { session } = roomForHost(req, url);
    const me = whoIs(req, url);
    /*
     * THE NIGHTS, READ ONCE.
     *
     * Three things in this payload are worked out from the archive — how many
     * nights there are, how many are unbilled, and the headcounts — and each
     * used to walk the whole folder and parse every night for itself. On a
     * quizmaster with two years of Thursdays that is three full reads of the
     * archive for one console load, and they must agree with each other
     * anyway, because a badge saying 40 above a panel that summarises 39 is a
     * page nobody trusts.
     */
    /*
     * WITH the leaderboards: the league is worked out here, on the server, and
     * only the finished table is sent. `/api/past-gigs` asks without them, so
     * the list of nights the Gigs tab draws stays the size it always was.
     */
    const gigNights = mergeGigs(listArchive(libRoom.paths.archive, { boards: true }), []);
    return sendJson(res, 200, {
      brand: brandForRoom(roomForHost(req, url)),
      appName: config.appName,
      scheme: schemeForRoom(roomForHost(req, url)),
      // What this account has chosen to look at. Cosmetic, and read ONLY by
      // the browser — nothing here decides what anybody is allowed to do.
      prefs: (me && me.prefs) || {},
      // Every colour on offer, so the console can draw the picker without
      // keeping its own copy of the list and drifting from the stylesheet.
      schemes: SCHEMES,
      ...library,
      // How big the whole catalogue is, next to what this account can reach.
      // The account page says "3 of 20" from these two, and stays quiet when
      // they match.
      catalogue,
      // What one costs, so the shop card never keeps its own copy of the price
      // and cannot drift from what a purchase would actually charge.
      packPence: PACK_PENCE,
      /*
       * Their own library, and whether it survives a restart.
       *
       * Said out loud rather than left to be discovered, because on a host with
       * no permanent disk the difference between "backed up" and "here for now"
       * is the difference between a quiz they wrote and a quiz they wrote once.
       * Same shape as the invoice book's warning and there for the same reason.
       */
      ownPacks: {
        count: countOwn(libRoom.paths),
        max: MAX_OWN,
        backedUp: packsRepoConfigured(),
        repo: packsRepoName(),
      },
      adverts: listAdvertPacks(roomForHost(req, url).paths.adverts),
      // How many tracks each card size wants, straight from the rule itself so
      // the console can size a pasted list without keeping its own copy of the
      // sum and drifting from it.
      // The card shapes on offer, with what each needs, straight from the rules
      // themselves so the console keeps no copy of the sum to drift from.
      cardShapes: CARD_SHAPES.map((shape) => ({
        ...shape,
        label: shapeLabel(shape),
        minimum: minimumTracks(shape),
        // How many prizes this shape can carry, and what each of them is, so
        // the console can offer the right ones without doing the sums itself.
        maxPrizes: maxPrizes(shape),
        plans: Array.from({ length: maxPrizes(shape) }, (_, i) => stagePlan(i + 1).map(stageLabel)),
      })),
      /*
       * Your room's code, whether or not a game is running.
       *
       * It used to ride on `running` only — so before a launch the console had
       * no idea which room it was, and every "Big screen" link fell back to the
       * HOUSE room's projector. A quizmaster opening the big screen five
       * minutes early, which is the documented routine, got somebody else's
       * game. The house room has no code and that is still correct for it.
       */
      joinCode: roomForHost(req, url).code,
      // Your own room, and only ever your own — Stop and Take control on this
      // panel must never reach somebody else's night.
      running: {
        room: roomIdFor(me),
        joinCode: roomForHost(req, url).code,
        game: session.kind,
        packId: session.pack.id,
        title: session.pack.title,
        /*
         * WHERE tonight is, as the running night itself understands it.
         *
         * Read off the game state rather than off the console's own picker,
         * because those are two different questions — the picker says what the
         * next launch would use and this says what the night that is actually
         * up was launched with. The control view's advert picker uses it to
         * put this venue's slides at the top: standing in the Dog & Duck,
         * scrolling past the Sheep & Hound's pizza deal to find yours, mid-gig
         * and in the dark, is the friction it removes.
         */
        venue: session.engine.state?.venue || '',
        // What is on the projector and what is next — see `nowNext` above.
        onScreen: nowNext(session),
        phase: session.engine.state.phase,
        // Optional on an engine — a new game that has not written one still
        // shows up in the console, it just says less about itself.
        at: typeof session.engine.where === 'function' ? session.engine.where() : '',
        playerCount: session.engine.playerList().length,
        // The console offers to invoice for a night that has actually ended,
        // and only then — an invoice raised in the middle of round two is a
        // mis-tap, not a decision.
        finished: session.engine.state.phase === 'final' || Boolean(session.engine.state.finishedAt),
      },
      // What every OTHER room is doing, owner only. Not so it can be driven
      // from here — it cannot, and deliberately — but so the owner can see at a
      // glance that somebody is mid-question before deploying over them.
      otherRooms: me && me.role === 'owner'
        ? rooms.summaries().filter((r) => r.id !== roomIdFor(me))
        : [],
      /*
       * How many NIGHTS, for the Past gigs badge — not how many games.
       *
       * A quiz and the bingo after it are one evening's work, so counting games
       * puts a 5 on the tab above a list of four rows. Worked out here, with
       * the same roll-over the page itself uses, rather than in the browser
       * from a list it would have to group a second way.
       */
      archiveNights: gigNights.length,
      /*
       * NIGHTS YOU HAVE RUN AND NOT BILLED — money left on the table.
       *
       * Worked out on the SERVER because it is the only side holding both
       * halves: the archive knows the nights and the invoice book knows the
       * invoices, and until now the two never spoke. Sent as a count rather
       * than a list, because the Gigs tab marks the rows itself and a number
       * is all anything else needs.
       *
       * Only when they actually hold invoicing — a quizmaster who does not
       * bill through the app has no unbilled nights, only nights.
       */
      unbilled: unbilledFor(libRoom, req, url, gigNights),
      /*
       * HOW MANY PLAYED AT EACH VENUE, and which way it is going.
       *
       * *"The Crown went from 22 to 58"* — the evidence that wins the next
       * booking and saves a residency in January. Nothing new is collected:
       * this is the count the archive has written down since the app was
       * written, added up per venue for the first time.
       *
       * ONE record, read by BOTH tabs. The Venues tab opens a place and shows
       * its own history; the Gigs tab shows every venue at once. Sent rather
       * than fetched separately so the two cannot disagree, and so a venue
       * card draws its numbers with no second request.
       *
       * Only for somebody who holds Past gigs — this is their record of what
       * they have run, read from the same archive that page is built from.
       */
      headcounts: seesTheirNights(req, url)
        ? venueHeadcounts(gigNights)
        : { venues: [], unplaced: 0 },
      /*
       * WHAT EACH VENUE HAS ALREADY HEARD — the last time it got each pack.
       *
       * Off the SAME `gigNights` the headcounts are, so the two cannot
       * disagree about which nights happened or where. It rides with the
       * library rather than being fetched when a venue is picked, because
       * the shelf re-ranks on every venue change and a fetch per change is a
       * spinner on the one panel that has to feel instant.
       *
       * Small: one timestamp per pack per venue actually played, so a busy
       * year of one residency is a few dozen numbers.
       */
      playedByVenue: seesTheirNights(req, url) ? playedByVenue(gigNights) : {},
      /*
       * THE QUIZ LEAGUE, per venue — who keeps coming back and who is winning
       * the season. Same record, same gate and the same reason as the
       * headcounts above: sent with the library so a venue card draws its
       * table with no second request, and so one calculation feeds every
       * place that shows it.
       *
       * The TABLE only. The leaderboards it was built from stay on the server.
       */
      /*
       * THE CONSOLE SEES THE REAL NAMES — it is the room's own view, and the
       * quizmaster was there. What it also gets is `nameHidden` per row, so
       * the table can say which names will not go on a public page without
       * the console having to run the filter itself and reach a different
       * answer from the server. One filter, asked once.
       */
      leagues: seesTheirLeague(req, url) ? markHidden(leaguesByVenue(gigNights)) : {},
      /*
       * Venues this room has played before, so the launch box offers them back
       * rather than asking for the same six words every week. A field you
       * retype gets left blank by the third week, and then the record is
       * holes — which is the whole point of having it.
       */
      venues: venuesUsed(roomForHost(req, url).paths.archive),
      // And what was given away, offered back the same way — plus what each
      // VENUE puts up, because the venue buys the prize.
      rewards: rewardsUsed(roomForHost(req, url).paths.archive),
      venueRewards: rewardsByVenue(roomForHost(req, url).paths.archive),
      // Offered on every pack card, so a night can be dressed up without
      // editing anything.
      looks: LOOKS.map(({ id, label, blurb, season }) => ({ id, label, blurb, season })),
      // Just the totals, so the Invoices tab can wear a badge saying how many
      // are still unpaid. The invoices themselves are never in this payload.
      invoicing: roomForHost(req, url).invoices.summary(),
      /*
       * THE VENUES, which are the invoice book's customers.
       *
       * One record rather than a second list: that book's own comment already
       * calls them "the venues you work for", and it holds the name, the
       * contact, the address and the usual fee. A separate venue store would
       * have to be reconciled with it forever.
       *
       * Only what a launch needs — the name and what they put up. The address,
       * the email and the fee stay on the Invoices side, because a pack card
       * has no business carrying somebody's postal address.
       */
      venueRecords: roomForHost(req, url).invoices.customers
        .map((c) => ({
          id: c.id,
          name: c.name,
          rewards: Array.isArray(c.rewards) ? c.rewards : [],
          // Which night they have you, so the console can work out whose night
          // tonight is without a second request — see `tonightsVenue()`.
          usualNight: c.usualNight || '',
          // Where the last slide of the night sends the room, drawn as a QR on
          // the projector. Here so the Venues tab can edit it; the launch
          // resolves it server-side and the browser never has to.
          link: c.link || '',
          /*
           * Their logo, so the Venues tab can show what is set and offer to
           * change it. It is capped at 64KB by `cleanLogo` on the way in,
           * which is what makes carrying it in this payload affordable — and
           * why it goes no further than the console: the winner's phone gets
           * it inside the voucher and the PROJECTOR never gets it at all, or
           * it would ride in every state push at a lobby.
           */
          logo: c.logo || '',
        })),
      /*
       * The diary's exceptions: one-offs and nights off.
       *
       * The RECURRING half is not sent because it is not stored — it comes out
       * of the usual nights above, projected forward in the browser. That is
       * the whole point of the design: a residency needs nothing typed and
       * nothing kept, so there is nothing here to go stale.
       */
      bookings: roomForHost(req, url).invoices.bookings,
      /*
       * THE NIGHTS THEY HAVE BUILT IN ADVANCE — see `src/shows.js`.
       *
       * In the library payload rather than behind a route of its own because
       * the console draws them on the same page as everything else here, and a
       * second fetch on the tab a gig starts from is a second thing that can
       * be slow on pub wifi. They are small: a show is references and
       * settings, never a question or a track.
       */
      shows: showsFor(roomForHost(req, url)),
      /*
       * Enough to draw "Ask for a pack" BEFORE somebody types into it: whether
       * they may, where they are in the queue, and which Monday it lands on.
       * Being refused after writing three sentences is the version that
       * annoys; being told the deal up front is the version somebody plans
       * around.
       */
      packRequest: me ? suggestions.packRequestStatus(me.id || '') : null,
      // Only a count here. The reports themselves are owner-only and come from
      // their own route.
      reports: me && me.role === 'owner' ? reports.summary() : { open: 0, total: 0 },
      generation: {
        claude: Boolean(process.env.ANTHROPIC_API_KEY),
        // `art` is the one that decides whether a button works; the two named
        // flags are only so a warning can say WHICH key is missing.
        art: artProvider(),
        openai: openaiConfigured(),
        google: googleConfigured(),
        spotify: spotifyConfigured(),
        spotifyMissing: missingSpotifyConfig(),
        recentCount: recentTracks(config.dataDir, 3).length,
        backup: backup.ok,
        backupConfigured: githubConfigured(),
        backupError: backup.ok ? null : backup.error,
        backupRepo: backup.repo || null,
        backupMissing: missingGithubConfig(),
      },
    }), true;
  }
  if (route.startsWith('/api/advert/')) {
    if (!allowed(req, res, url, FEATURES.LIBRARY)) return true;
    const id = decodeURIComponent(route.slice('/api/advert/'.length));
    const advertRoom = roomForHost(req, url);
    try {
      const pack = loadAdvertPack(advertRoom.paths.adverts, id);
      /*
       * THE OPENS, ON THE SAME READ AS THE PACK — the editor already fetches
       * this exact route to open a set, so there is no second request for the
       * count to fall out of step with. Keyed by slide id, same as the pack's
       * own `slides` list, so the browser needs no join to show them together.
       */
      return sendJson(res, 200, { ...pack, opens: advertRoom.offers.forPack(id) }), true;
    } catch {
      /*
       * The reason is deliberately NOT passed through.
       *
       * Now that every quizmaster has their own folder, asking for somebody
       * else's set is an ordinary miss — and `err.message` on a miss is an
       * ENOENT carrying the server's absolute path, which told an unknown
       * caller the directory layout and the room id it was looking in.
       */
      return sendJson(res, 404, { error: 'No advert set with that name.' }), true;
    }
  }

  // What round 2 actually has on disk: real portraits, stand-ins, or nothing.
  // Read before spending anything, so the panel can say what it is about to do.
  if (route.startsWith('/api/images/')) {
    if (!allowed(req, res, url, FEATURES.LIBRARY)) return true;
    const id = decodeURIComponent(route.slice('/api/images/'.length));
    // It reports every question's ANSWER, so it is a read of the pack whatever
    // else it is.
    if (!mayReadPack(req, url, 'quiz', id)) {
      return sendJson(res, 403, { error: 'That pack is not in your library yet.', upgrade: true }), true;
    }
    const style = findStyle(url.searchParams.get('style') || '');
    try {
      const quiz = loadQuiz(config.quizDir, id);
      return sendJson(res, 200, {
        ...imageStatus(quiz, config.imageDir),
        // Which supplier will draw, and what it charges. The prices come from
        // the ledger's own table rather than a second copy in the browser —
        // the console had one, and a quoted price that disagrees with the
        // recorded one is the exact drift `src/spend.js` says it prevents.
        art: artProvider(),
        pence: imagePrices(artProvider()),
        /*
         * Everybody already drawn, so the shared library can be looked at.
         *
         * The filename is the whole index, which is what makes reuse free and
         * also what makes it quietly duplicable — the key is the ANSWER TEXT,
         * so "Michael Jackson" and "Michael Jackson (Jacko)" are two people as
         * far as the app is concerned. Nothing catches that, and a fuzzy
         * warning would be worse than the problem. Putting the two names next
         * to each other is all anybody needs.
         */
        library: portraitLibrary(config.imageDir),
        openai: openaiConfigured(),
        google: googleConfigured(),
        // What pressing the button would actually cost, given what the shared
        // library already holds. This is the number that shows the sharing
        // working, so it is read before anything is spent, not reported after.
        plan: imagePlan(quiz, config.imageDir, { style }),
        styles: Object.entries(STYLES).map(([sid, st]) => ({ id: sid, label: st.label, hint: st.hint })),
        style,
        qualities: QUALITIES,
        defaultQuality: DEFAULT_QUALITY,
        questions: imageJobs(quiz, { style }).map(({ q, musician, wants }) => ({
          id: q.id,
          answer: q.options[q.correctIndex],
          image: q.image,
          musician,
          wants,
          real: fs.existsSync(path.join(config.imageDir, q.image)),
          inLibrary: fs.existsSync(path.join(config.imageDir, wants)),
        })),
      }), true;
    } catch (err) {
      return sendJson(res, 404, { error: err.message }), true;
    }
  }
  if (route.startsWith('/api/bingo/')) {
    if (!allowed(req, res, url, FEATURES.LIBRARY)) return true;
    const id = decodeURIComponent(route.slice('/api/bingo/'.length));
    if (!mayReadPack(req, url, 'bingo', id)) {
      return sendJson(res, 403, {
        error: 'That pack is not in your library yet.', upgrade: true, pence: PACK_PENCE,
      }), true;
    }
    try {
      const { pack, mine } = readPack('bingo', id, packCtx(req, url));
      return sendJson(res, 200, { ...pack, mine }), true;
    } catch {
      return sendJson(res, 404, { error: 'No bingo pack with that name.' }), true;
    }
  }
  // What the generator is currently refusing to reuse.
  if (route === '/api/history') {
    if (!allowed(req, res, url, FEATURES.LIBRARY)) return true;
    const months = Number(url.searchParams.get('months')) || 3;
    return sendJson(res, 200, { months, tracks: recentTracks(config.dataDir, months) }), true;
  }
  /*
   * ---- invoicing
   *
   * All of it behind the host key, and none of it in any player or screen
   * payload. Customer addresses and your own bank details have no business
   * being one mistyped URL away from a room full of phones.
   *
   * The PDF route comes first because the catch-all below it would otherwise
   * read "MMM-0001.pdf" as an invoice number.
   */
  if (route.startsWith('/api/invoices/') && route.endsWith('.pdf')) {
    // INVOICES, not LIBRARY. This asked for LIBRARY, which every quizmaster
    // has, so anybody with a login could download anybody's invoice — and an
    // invoice carries the host's own sort code and account number and the
    // customer's address. Found by a signed-in quizmaster fetching one.
    if (!allowed(req, res, url, FEATURES.INVOICES)) return true;
    const number = decodeURIComponent(route.slice('/api/invoices/'.length, -4));
    const room = roomForHost(req, url);
    await ensureInvoicesRestored(room);
    // Their own book. Looked up in a SHARED book, a number somebody guessed
    // would have handed them another quizmaster's invoice, complete with that
    // quizmaster's sort code — which is the whole reason these are now split.
    const invoice = room.invoices.find(number);
    if (!invoice) return sendJson(res, 404, { error: 'No invoice with that number' }), true;
    const pdf = invoicePdf(invoice);
    // `inline` so tapping it on a phone opens a preview to check before
    // sending, rather than dropping a file into Downloads unseen.
    res.writeHead(200, {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${invoiceFilename(invoice)}"`,
      'Cache-Control': 'no-store',
    });
    return res.end(pdf), true;
  }

  /*
   * The suggestion box.
   *
   * READING the list is the owner's — a quizmaster seeing everybody else's
   * complaints is the same mistake as a shared invoice book. SENDING one is
   * everybody's, and deliberately not gated on a tier: the whole point is to
   * hear from the people who are finding it hardest, who are the least likely
   * to be on the top rung.
   */
  /*
   * Their own thread. Without this the box is one-way — you send something into
   * the dark and never learn whether it landed, which is how a feedback route
   * stops being used after the second time.
   */
  /*
   * WHAT THE ROOM ASKED FOR — read, kept or binned.
   *
   * Behind the same owner check the launch uses, because the feature is his
   * alone for now. It is a quizmaster's own customers' words either way, so it
   * is read out of THEIR room and never pooled.
   */
  if (route === '/api/asks' && req.method === 'GET') {
    const me = whoIs(req, url);
    if (!me) return sendJson(res, 401, { error: 'Sign in first' }), true;
    const room = roomForHost(req, url);
    return sendJson(res, 200, {
      // Grouped: four people asking for reggae is one row with a 4 on it, not
      // four rows. That is what makes a Monday's worth of these one pass.
      asked: room.asks.grouped(),
      // Grouped as well, or one idea four people asked for turns into four
      // identical rows on the list of things worth writing — and then it looks
      // like four jobs.
      kept: room.asks.grouped(room.asks.kept),
    }), true;
  }

  if (route === '/api/suggestions/mine' && req.method === 'GET') {
    const me = whoIs(req, url);
    if (!me) return sendJson(res, 401, { error: 'Sign in first' }), true;
    const mine = suggestions.forAccount(me.id);
    /*
     * Drawing it counts as opening it.
     *
     * Marked AFTER the payload is built, so the reply they are being shown
     * right now is the one that gets stamped — and only if a real account is
     * asking, since the owner reading their own inbox must not mark somebody
     * else's reply as seen.
     */
    if (!me.actingAs && suggestions.markSeen(me.id)) backUpSuggestions();
    return sendJson(res, 200, { suggestions: mine }), true;
  }

  if (route === '/api/suggestions' && req.method === 'GET') {
    const me = whoIs(req, url);
    if (!me || (me.role !== 'owner' && !me.bootstrap)) {
      return sendJson(res, 403, { error: 'Owners only.' }), true;
    }
    return sendJson(res, 200, {
      suggestions: suggestions.all.map((x) => ({ ...x, ref: accountRef(x.byId) })),
      summary: suggestions.summary(),
      // What the owner has taught the drafting model, so they can edit it.
      house: suggestions.house,
      // Whether the Draft button can work at all. Said up front rather than
      // found out by pressing it and getting an error.
      canDraft: Boolean(process.env.ANTHROPIC_API_KEY),
    }), true;
  }

  if (route === '/api/invoices' && req.method === 'GET') {
    if (!allowed(req, res, url, FEATURES.INVOICES)) return true;
    // Their own book, worked out from who they are. This is the route the tab
    // actually loads from — the one in handleWrite only answers GET when the
    // request reaches it, which it does not.
    const room = roomForHost(req, url);
    await ensureInvoicesRestored(room);
    return sendJson(res, 200, invoiceState(room.invoices)), true;
  }

  if (route.startsWith('/api/archive/')) {
    // Past gigs, not invoicing. It asked for the invoicing add-on because that
    // is where the tab used to live; a record of somebody's own nights has
    // nothing to do with whether they bill for them.
    if (!allowed(req, res, url, FEATURES.PAST_GIGS)) return true;
    const id = decodeURIComponent(route.slice('/api/archive/'.length));
    try {
      return sendJson(res, 200, loadArchived(roomForHost(req, url).paths.archive, id)), true;
    } catch {
      // Never `err.message`: on a miss that is an ENOENT carrying the server's
      // absolute path, which names the directory layout and the room id it just
      // looked in. The same fault this codebase has already recorded twice.
      return sendJson(res, 404, { error: 'No night saved under that name.' }), true;
    }
  }

  /*
   * PAST GIGS — the nights, the packs and the pictures, in one list.
   *
   * Two records joined up: the archive on disk (what was played, by how many,
   * who won) and the photo repository (what the room sent). The photos are read
   * from the REPO rather than from `data/photos/`, because that folder is wiped
   * on every deploy — a page built from it would show tonight and swear nothing
   * else had ever happened.
   *
   * Which room's gigs these are comes from WHO YOU ARE, like every other host
   * route. There is no night, id or folder anybody can send that reaches
   * another quizmaster's history.
   */
  if (route === '/api/past-gigs') {
    if (!allowed(req, res, url, FEATURES.PAST_GIGS)) return true;
    const gigRoom = roomForHost(req, url);
    await ensureArchiveRestored(gigRoom);
    const folders = photosRepoConfigured()
      ? await listDirs(photoFolder(gigRoom.id), 'photos')
      : [];
    const nights = mergeGigs(listArchive(gigRoom.paths.archive), folders.map((f) => f.name));
    /*
     * WHICH OF THEM HAVE NOT BEEN BILLED.
     *
     * Marked here rather than worked out in the browser, because the answer
     * needs the invoice book and the page holds only the nights — and because
     * a room that has not opened the Invoices tab this boot has no book in
     * memory until `ensureInvoicesRestored` has run. Doing it in the browser
     * would mean shipping every invoice to a page that has no other use for
     * them.
     *
     * Only for somebody who actually bills through the app. A quizmaster
     * without invoicing has no unbilled nights, only nights.
     */
    let unbilled = new Set();
    if (billsThroughTheApp(req, url)) {
      await ensureInvoicesRestored(gigRoom);
      unbilled = new Set(gigRoom.invoices.unbilledNights(nights).map((n) => n.night));
    }
    return sendJson(res, 200, {
      nights: nights.map((n) => (unbilled.has(n.night) ? { ...n, unbilled: true } : n)),
      // So the page can say why there are no pictures against an old night,
      // rather than implying nobody took any.
      photosKept: photosRepoConfigured(),
    }), true;
  }

  /*
   * THE POST-NIGHT REPORT — a PDF for the venue, built from what the archive
   * and the photo repository already know.
   *
   * **IT HAS TO SIT ABOVE `/api/past-gigs/<night>`**, same trap as the
   * publish route below: that one matches any path under the prefix, and
   * would answer "that is not a night" to the word `report.pdf`.
   *
   * `{ boards: true }` is what makes the podium possible — every other read
   * of Past gigs asks `listArchive` without it, because the page has never
   * needed second and third place before.
   */
  if (route.startsWith('/api/past-gigs/') && route.endsWith('/report.pdf')) {
    if (!allowed(req, res, url, FEATURES.PAST_GIGS)) return true;
    const night = decodeURIComponent(route.slice('/api/past-gigs/'.length, -'/report.pdf'.length));
    if (!isNightFolder(night)) return sendJson(res, 404, { error: 'No night with that date.' }), true;
    const gigRoom = roomForHost(req, url);
    await ensureArchiveRestored(gigRoom);
    const folders = photosRepoConfigured() ? await listDirs(photoFolder(gigRoom.id), 'photos') : [];
    const nights = mergeGigs(listArchive(gigRoom.paths.archive, { boards: true }), folders.map((f) => f.name));
    const entry = nights.find((n) => n.night === night);
    if (!entry) return sendJson(res, 404, { error: 'No night with that date.' }), true;
    const photoFiles = photosRepoConfigured()
      ? await listDir(`${photoFolder(gigRoom.id)}/${night}`, 'photos')
      : [];
    const photoCount = photoFiles.map((f) => safePhotoName(f.name)).filter(Boolean).length;
    /*
     * ADVERT OPENS FOR THE VENUE, matched by NAME — the same free-text join
     * every other venue read uses, because an advert pack has no venueId.
     * All-time rather than "on this night": an offer belongs to the venue,
     * not to one evening, so there is no per-night count to read.
     */
    let opens = 0;
    let hasOffer = false;
    if (entry.venue) {
      const want = entry.venue.trim().toLowerCase();
      const packs = listAdvertPacks(gigRoom.paths.adverts).filter((p) => String(p.venue || '').trim().toLowerCase() === want);
      for (const pack of packs) {
        if (!pack.slides.some((s) => s.offerCode)) continue;
        hasOffer = true;
        const totals = gigRoom.offers.forPack(pack.id);
        for (const slideId of Object.keys(totals)) opens += totals[slideId].total;
      }
    }
    /*
     * THE SEASON, AS IT STOOD AFTER THIS NIGHT — not as it stands today.
     *
     * A report for the 14th handed over in March has to say what the room was
     * looking at on the 14th, or it is a snapshot that has moved on rather
     * than evidence. `leagueAfter()` winds both the night list and the season
     * window back to that evening.
     *
     * Gated exactly like the library's own copy (`seesTheirLeague`): a Bronze
     * account's report simply has no table on it, which is silence rather
     * than a locked panel — the same rule the projector band follows.
     */
    let league = null;
    if (entry.venue && seesTheirLeague(req, url)) {
      const want = entry.venue.trim().toLowerCase();
      const here = nights.filter((n) => String(n.venue || '').trim().toLowerCase() === want);
      const season = leagueAfter(here, night);
      // One night is not a league — it is tonight's scoreboard printed twice,
      // which is the rule `session.js` already applies to the projector band.
      /*
       * AND THE SAME FILTER ON THE REPORT. A landlord was in the room, but
       * the report is a document he can forward to a brewery or an area
       * manager who was not — so it is the far side of the same door.
       */
      if (season.nights > 1 && season.table.length) {
        const ruled = await nameDecisions(gigRoom.id);
        league = { ...season, table: publicTable(season.table, ruled, teamKey), teams: season.table.length };
      }
    }
    const pdf = nightReportPdf(entry, { headcount: nightHeadcount(entry), photoCount, opens, hasOffer, league });
    return send(res, 200, pdf, {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${nightReportFilename(entry)}"`,
    }), true;
  }

  /*
   * PUBLISH A NIGHT, or take it back down.
   *
   * Behind the same gate as the rest of Past gigs, and the room comes from WHO
   * YOU ARE — there is no room parameter, so this can only ever publish the
   * asker's own nights.
   *
   * **Taking it down matters as much as putting it up.** Somebody will ask for
   * their photo to be removed, and on a page with no contact details the only
   * honest answer is a quizmaster who can unpublish in one tap.
   *
   * **IT HAS TO SIT ABOVE `/api/past-gigs/<night>`**, which matches any path
   * under it and would answer "that is not a night" to the word `publish` —
   * a 404 that looks exactly like a working route refusing a bad date.
   */
  if (route.startsWith('/api/past-gigs/')) {
    if (!allowed(req, res, url, FEATURES.PAST_GIGS)) return true;
    const night = decodeURIComponent(route.slice('/api/past-gigs/'.length));
    if (!isNightFolder(night)) return sendJson(res, 404, { error: 'No night with that date.' }), true;
    const gigRoom = roomForHost(req, url);
    const files = photosRepoConfigured()
      ? await listDir(`${photoFolder(gigRoom.id)}/${night}`, 'photos')
      : [];
    const rulings = photosRepoConfigured() ? await photoDecisions(gigRoom.id) : {};
    return sendJson(res, 200, {
      night,
      // Whether this night is on the public gallery, so the control that puts
      // it there can say which way round it is. On THIS call rather than a
      // second one: it is already made the moment a night is opened, and a
      // button that has to fetch before it knows its own label is a button
      // that flickers.
      published: await isPublished(gigRoom.id, night),
      photos: files
        .map((f) => safePhotoName(f.name))
        .filter(Boolean)
        // Served back through this server, because the photo repository is
        // private and a browser cannot fetch from it.
        .map((name) => ({
          name,
          url: `/past-photo/${night}/${name}`,
          /*
           * WHETHER THIS ONE IS ON THE PUBLIC GALLERY, worked out HERE and
           * sent, rather than guessed in the browser from the filename.
           *
           * The console draws a pill per photo — *"a little green pill to show
           * it's on the public gallery for this night and a red one to show it
           * isn't"* — and the one thing that pill must never do is disagree
           * with the page it describes. `showsOnGallery()` is the single
           * function all three readers ask, so it cannot.
           */
          onGallery: showsOnGallery(name, rulings[photoKey(night, name)]),
          // WHY it is off, when nobody has ruled: so the pill can say the
          // difference between "we thought you uploaded this" and "you turned
          // it off", which are different things to want to change.
          ruled: rulings[photoKey(night, name)] || '',
        })),
    }), true;
  }

  /*
   * One photo out of the repository.
   *
   * A proxy rather than a redirect, and it has to be: that repo is private, so
   * a link to it is a 404 in anybody's browser. The room comes from the signed
   * in account, so this can only ever hand back pictures from the asker's own
   * nights.
   */
  /*
   * THE PUBLIC GALLERY — open, like `/play` and `/v`, and for the same reason:
   * it is for the people who were in the room, who have no account and never
   * will. It hands out nothing on its own — only nights the quizmaster has
   * PUBLISHED, and `src/gallery.js` fails closed on any doubt.
   *
   * It reads the PRIVATE REPO rather than `/photos/`, which reads the local
   * disk — and that disk is wiped on every deploy, so a gallery built on it
   * would show nothing older than the last thing that shipped.
   *
   * The house room, because this is the app owner's own page. A per-quizmaster
   * gallery wants a slug of its own and is a separate job.
   */
  /*
   * THE OWNER SEES IT BEFORE ANYBODY ELSE DOES.
   *
   * Asked for directly: *"I want to be able to see it live myself to know it
   * works, but won't advertise it until I know every photo has gone through
   * the flow properly."* So signed in, the page shows UNPUBLISHED nights too,
   * marked as such — which means the whole path can be proved end to end
   * without a single photograph becoming public.
   *
   * `whoIs` must be truthy as well as the room matching: an anonymous request
   * resolves to the house room anyway, so the room alone is not a check.
   */
  /**
   * WHOSE NIGHTS `/gallery` SHOWS.
   *
   * **It was the HOUSE room, and that was wrong in the only way that mattered:
   * the owner does not run nights in the house room.** Photos are filed per
   * room — the house keeps the flat `photos/` path, every other account gets
   * `photos/<room>/` — and Mark runs his gigs on his linked QUIZMASTER hat, so
   * every photograph he has ever taken is in the second kind of folder while
   * this page looked only in the first. The page said *"No photos are up yet"*
   * over a repository with a full night in it, and the Gigs tab three tabs
   * away was showing the same photographs quite happily.
   *
   * **The two halves disagreeing is the actual bug**: `/api/past-gigs` reads
   * `roomForHost`, this read `HOUSE`, and nothing made them agree. Publishing
   * would have failed the same way — the publish route writes to the caller's
   * room, so a night could have been published into a folder this page never
   * looked at, with no error anywhere.
   *
   * So it resolves to **the owner's own quizmaster room**, which is where the
   * app owner's nights actually happen, falling back to the house room when
   * there is no such account (a fresh install, or the host key before anybody
   * has signed up).
   *
   * **A gallery for OTHER quizmasters still needs a slug of its own** and is
   * still a separate job — this fixes whose nights the one public page shows,
   * not how a second person would get one.
   */
  /*
   * The same answer as `galleryRoomId()` and deliberately a separate name, so
   * that when a per-quizmaster slug arrives it is obvious both call sites want
   * it rather than one quietly keeping the old behaviour.
   */
  /*
   * A `function` rather than a `const` arrow, DELIBERATELY: the `/o/` route is
   * earlier in this handler than this line, and a const is in its temporal
   * dead zone until its own line runs — so the first scan of a QR answered 500
   * with "Cannot access 'offerRoomId' before initialization". A function
   * declaration hoists to the top of the scope and cannot.
   *
   * Exactly the fault the console split hit with its boot call, in a different
   * file on the same day. Worth the two extra words.
   */
  function offerRoomId() {
    const owner = accounts.owner;
    const mine = owner ? accounts.ownQuizmasterFor(owner.id) : null;
    return mine ? mine.id : HOUSE;
  }

  /*
   * A PUBLIC GALLERY PER QUIZMASTER, NOT ONLY THE OWNER'S OWN.
   *
   * This started as Mark's own tool — `/gallery` with no parameter always
   * meant HIS room — and every function in `src/gallery.js` was already
   * written generically, taking a `roomId`, so the single-tenant behaviour
   * was purely this one hardcoded lookup. `?q=<accountId>` asks for a
   * SPECIFIC quizmaster's gallery instead; account ids are not secret (the
   * referral link already puts one in a public URL — see `/signup?ref=`),
   * and an id that names nothing simply resolves to an empty room with no
   * published nights, never a crash or a 404 that would let somebody probe
   * which ids are real.
   *
   * `/gallery` with NO `?q=` is UNCHANGED — Mark's existing bookmark and any
   * marketing link he has already handed out keeps working exactly as it
   * always has.
   */
  const galleryTarget = String(url.searchParams.get('q') || '').trim();
  const galleryRoomId = () => {
    if (galleryTarget) return galleryTarget;
    const owner = accounts.owner;
    const mine = owner ? accounts.ownQuizmasterFor(owner.id) : null;
    return mine ? mine.id : HOUSE;
  };

  /*
   * THE OWNER SEES IT FIRST, ON EITHER HAT — but ONLY ON THEIR OWN GALLERY.
   *
   * One login holds two identities, and which one is worn should not decide
   * whether the preview works on MARK'S OWN gallery — checking the room
   * alone would hide it the moment he switched to the owner hat, on the page
   * he is checking BECAUSE he is the owner. The host key counts for the same
   * reason.
   *
   * **THAT SHORTCUT MUST NOT SURVIVE `?q=`.** Once this page can show any
   * quizmaster's gallery, letting the owner-check apply everywhere would
   * mean the owner previewing EVERY subscriber's unpublished, private
   * photos with nothing consented and nothing logged — precisely the
   * cross-room read the own-packs guarantee refuses elsewhere in this app.
   * So the owner shortcut applies only when nobody asked for anybody else's
   * gallery; asking by id always falls through to the one real rule —
   * "you see the drafts on a room you are actually signed in as."
   */
  const galleryPreview = () => {
    const who = whoIs(req, url);
    if (!who) return false;
    if (!galleryTarget && (who.role === 'owner' || who.bootstrap)) return true;
    return roomForHost(req, url).id === galleryRoomId();
  };

  /*
   * WHAT THE PUBLIC LEAGUE PAGE IS ALLOWED TO SAY.
   *
   * Every published venue's table for one quizmaster, plus when they are next
   * on. It reuses `galleryRoomId()` and `galleryPreview()` deliberately: the
   * two pages ask the identical question — *whose room, and may I see the
   * drafts* — and a second answer to it is a second thing that can be got
   * wrong, including the trap those functions already record about `?q=` and
   * the owner shortcut.
   *
   * **THE TABLE IS REBUILT HERE RATHER THAN READ OFF THE LIBRARY PAYLOAD**,
   * because a visitor has no account and gets no library. Same function, same
   * archive — `leaguesByVenue()`, exactly as the console's own copy — so the
   * public page and the quizmaster's cannot disagree about who is winning.
   *
   * **AND IT SENDS NAMES, NOT FACES.** `leagueTable()` carries a `faceKey`
   * per team for the console to draw; the fields are listed by name on the
   * way out rather than spread, which is the whitelist rule the engine's own
   * views follow — a spread quietly opts every future field in, and the next
   * one might be a photograph.
   */
  /*
   * WHICH OF MY TABLES ARE UP — asked when the league tab is OPENED, never
   * with the library.
   *
   * This is a GitHub round trip and the library payload is fetched on every
   * console render, including the ones a phone joining a lobby causes; putting
   * it there would spend a network call per push on a fact that changes twice
   * a season. Same rule as a night's photos — fetched when the thing is
   * opened, not up front.
   *
   * **IT IS A GET, SO IT LIVES UP HERE WITH THE OTHER GETs.** It was written
   * beside its own POST first and 404ed, because that half of the file only
   * ever runs for POST — the identical trap the gallery's publish route
   * records, found the same way: by calling it rather than by reading it.
   */
  if (route === '/api/league/published') {
    if (!allowed(req, res, url, FEATURES.LEAGUE)) return true;
    const lgId = roomForHost(req, url).id;
    // Both halves of one decision file, in the one round trip it costs.
    return sendJson(res, 200, {
      venues: await publishedVenues(lgId),
      names: await nameDecisions(lgId),
    }), true;
  }

  if (route === '/api/league') {
    const roomId = galleryRoomId();
    const preview = galleryPreview();
    const leagueRoom = rooms.get(roomId);
    await ensureArchiveRestored(leagueRoom);
    const live = await publishedVenues(roomId);
    // The quizmaster's own rulings, which overrule the word list either way.
    const ruled = await nameDecisions(roomId);
    const nights = mergeGigs(listArchive(leagueRoom.paths.archive, { boards: true }), []);
    const byVenue = leaguesByVenue(nights);
    const book = leagueRoom.invoices;
    const out = [];
    for (const [key, league] of Object.entries(byVenue)) {
      const published = live.includes(key);
      if (!published && !preview) continue;
      /*
       * WHEN THEY ARE NEXT ON — the host's own choice for what a team wants
       * off this page over their own faces, and it writes itself: the venue's
       * usual night through `upcoming()`, the same derivation the projector's
       * comeback slide uses. Silent when there is nothing true to say, which
       * is the rule that slide already follows.
       */
      const next = nextNightAt({
        venue: league.venue, venues: book.customers, bookings: book.bookings, now: Date.now(),
      });
      out.push({
        venue: league.venue,
        nights: league.nights,
        next: next ? comeBackText(next.date).replace(/^Back here /, 'Next quiz ') : '',
        /*
         * NAMES FILTERED ON THE WAY OUT — `clean-names.js`. A rude name goes
         * on the projector as typed and always will; this is the door, not
         * the room. Applied HERE rather than in the browser so a name that
         * cannot be published never leaves the server at all — a filter that
         * ships the word and hides it with CSS is not a filter, which is the
         * same reasoning the two-screens rule is built on.
         */
        // Named fields, never a spread — see the note above.
        table: publicTable(league.table, ruled, teamKey).map((t) => ({
          position: t.position, name: t.name, played: t.played, counted: t.counted,
          wins: t.wins, points: t.points,
        })),
        ...(published ? {} : { preview: true }),
      });
    }
    // Alphabetical, so a quizmaster with four pubs gets a stable page rather
    // than one that reshuffles with whichever venue was played last.
    out.sort((a, b) => a.venue.localeCompare(b.venue));
    // No name in here: the page already asks `/api/brand?q=` for it, which is
    // the one place that answer is worked out. Two sources for one string is
    // how a heading and a title come to disagree.
    return sendJson(res, 200, { leagues: out, preview }), true;
  }

  if (route === '/api/gallery') {
    const preview = galleryPreview();
    const live = await publishedNights(galleryRoomId());
    const nights = preview
      ? [...new Set([...live, ...(await listDirs(photoFolder(galleryRoomId()), 'photos')).map((f) => f.name).filter(isNightFolder)])]
        .sort().reverse()
      : live;
    const out = [];
    for (const night of nights) {
      const files = await listDir(`${photoFolder(galleryRoomId())}/${night}`, 'photos');
      // Only what would actually SHOW once this night is opened — see the
      // matching filter below. A count that included the ones held back
      // would read "6 photos" over a page that opens on 4.
      const count = (files || []).filter((f) => safePhotoName(f.name) && isCameraFile(f.name)).length;
      // A published night with nothing in it is a heading over a blank space.
      if (count) out.push({ night, when: readableNight(night), count, live: live.includes(night) });
    }
    return sendJson(res, 200, { nights: out, preview }), true;
  }

  if (route.startsWith('/api/gallery/')) {
    const night = decodeURIComponent(route.slice('/api/gallery/'.length));
    /*
     * ONE 404 FOR EVERY REFUSAL — not a night, not published, or nothing
     * there all answer the same way, exactly as `/api/voucher` does. Three
     * different messages would let anybody map which dates exist.
     */
    const preview = galleryPreview();
    if (!isNightFolder(night) || !(preview || await isPublished(galleryRoomId(), night))) {
      return sendJson(res, 404, { error: 'Nothing here.' }), true;
    }
    const files = await listDir(`${photoFolder(galleryRoomId())}/${night}`, 'photos');
    const said = await photoDecisions(galleryRoomId());
    return sendJson(res, 200, {
      night,
      when: readableNight(night),
      live: await isPublished(galleryRoomId(), night),
      preview,
      /*
       * ONLY WHAT LOOKED LIKE A CAMERA TOOK IT — asked for directly: a
       * photo picked from the gallery "for a laugh" is fine on the big
       * screen that night, and stays there, but does not belong on the
       * public page shown to a venue afterward. `isCameraFile()` reads the
       * one marker `add()` in photos.js ever wrote — see its own note for
       * why that is a filename rather than a second file to keep in step.
       */
      photos: (files || [])
        .map((f) => safePhotoName(f.name))
        .filter(Boolean)
        // THE FILENAME'S GUESS, UNLESS A HUMAN HAS SAID OTHERWISE — one
        // function, shared with the route below and with the console's pill,
        // so the three cannot drift into three answers.
        .filter((name) => showsOnGallery(name, said[photoKey(night, name)]))
        .map((name) => ({ name, url: `/gallery-photo/${night}/${encodeURIComponent(name)}` })),
    }), true;
  }

  /*
   * One photo, proxied. The repo is private, so a direct link is a 404 in
   * anybody's browser — and the published check is repeated HERE rather than
   * trusted from the listing, because a URL can be typed. `isCameraFile` is
   * repeated for the same reason: the listing already leaves a non-camera
   * photo off the page, but its name was on the projector all night and this
   * route must refuse it too, not just decline to advertise it.
   */
  if (route.startsWith('/gallery-photo/')) {
    const parts = route.slice('/gallery-photo/'.length).split('/');
    const night = decodeURIComponent(parts[0] || '');
    const name = safePhotoName(decodeURIComponent(parts[1] || ''));
    if (parts.length !== 2 || !name
      || !(galleryPreview() || await isPublished(galleryRoomId(), night))) {
      return sendJson(res, 404, { error: 'Nothing here.' }), true;
    }
    // RE-CHECKED HERE rather than trusted from the listing, because a URL can
    // be typed and this photo's name was on the projector all night.
    if (!showsOnGallery(name, (await photoDecisions(galleryRoomId()))[photoKey(night, name)])) {
      return sendJson(res, 404, { error: 'Nothing here.' }), true;
    }
    const bytes = await getFile(`${photoFolder(galleryRoomId())}/${night}/${name}`, 'photos');
    if (!bytes) return sendJson(res, 404, { error: 'Nothing here.' }), true;
    res.writeHead(200, {
      'Content-Type': name.endsWith('.png') ? 'image/png' : name.endsWith('.webp') ? 'image/webp' : 'image/jpeg',
      'Content-Length': bytes.length,
      // A filed photo is written once and never rewritten, so a page of forty
      // should not fetch forty every time somebody opens it.
      'Cache-Control': 'public, max-age=86400',
      // NOT in a search result. Being findable on Google is speculative
      // marketing value; a stranger's face turning up in a search is a
      // concrete cost, and it lands on the player rather than the business.
      'X-Robots-Tag': 'noindex, noimageindex',
    });
    return res.end(bytes), true;
  }

  if (route.startsWith('/past-photo/')) {
    if (!allowed(req, res, url, FEATURES.PAST_GIGS)) return true;
    const parts = route.slice('/past-photo/'.length).split('/');
    const night = decodeURIComponent(parts[0] || '');
    const name = safePhotoName(decodeURIComponent(parts[1] || ''));
    if (!isNightFolder(night) || !name || parts.length !== 2) {
      return sendJson(res, 404, { error: 'No photo there.' }), true;
    }
    const bytes = photosRepoConfigured()
      ? await getFile(`${photoFolder(roomForHost(req, url).id)}/${night}/${name}`, 'photos')
      : null;
    if (!bytes) return sendJson(res, 404, { error: 'No photo there.' }), true;
    res.writeHead(200, {
      'Content-Type': name.endsWith('.png') ? 'image/png' : name.endsWith('.webp') ? 'image/webp' : 'image/jpeg',
      'Content-Length': bytes.length,
      // A filed photo never changes — it is written once and never rewritten —
      // so a page of forty of them should not fetch forty every time it opens.
      'Cache-Control': 'private, max-age=86400',
    });
    return res.end(bytes), true;
  }
  /*
   * IS ANYBODY PLAYING THIS RIGHT NOW, AND WHERE HAVE THEY GOT TO?
   *
   * What the editor polls so its banner cannot be two hours old. It is only
   * the banner — the guard that actually matters runs inside the save, where
   * it cannot be stale. See `changesTheLiveQuestion`.
   *
   * A COUNT, NEVER A NAME. The owner has no business learning which
   * quizmaster is working tonight, and the number is what changes the
   * decision. A quizmaster asking about one of their own is scoped to their
   * own room by `packCtx`, so this can never leak across accounts either.
   */
  if (route.startsWith('/api/playing/')) {
    if (!allowed(req, res, url, FEATURES.LIBRARY)) return true;
    const rest = route.slice('/api/playing/'.length);
    const kind = rest.startsWith('bingo/') ? 'bingo' : 'quiz';
    const id = decodeURIComponent(rest.slice(kind.length + 1));
    if (!mayReadPack(req, url, kind, id)) return sendJson(res, 200, { playing: 0, live: null }), true;
    // Own packs are one room's; the catalogue is shared by everybody.
    const mine = isOwnPack(kind, id, roomForHost(req, url).paths);
    return sendJson(res, 200, packPlayState(kind, id, mine ? roomForHost(req, url) : null)), true;
  }

  if (route.startsWith('/api/quiz/')) {
    if (!allowed(req, res, url, FEATURES.LIBRARY)) return true;
    const id = decodeURIComponent(route.slice('/api/quiz/'.length));
    if (!mayReadPack(req, url, 'quiz', id)) {
      return sendJson(res, 403, {
        error: 'That pack is not in your library yet.', upgrade: true, pence: PACK_PENCE,
      }), true;
    }
    try {
      // Their own library first, the catalogue second. An owner asking resolves
      // against the house room, so there is no id that reaches a subscriber's.
      const { pack: quiz, mine } = readPack('quiz', id, packCtx(req, url));
      return sendJson(res, 200, { ...quiz, mine, reviewWarnings: reviewWarnings(quiz), problems: validateQuiz(quiz) }), true;
    } catch {
      // Never `err.message`: on a miss that is an ENOENT carrying the server's
      // own absolute path, which tells an unknown caller the directory layout
      // and which room it just looked in. The same fault the advert sets had.
      return sendJson(res, 404, { error: 'No quiz with that name.' }), true;
    }
  }
  /*
   * THE DIARY, FOR A REAL CALENDAR APP.
   *
   * Open by design and authenticated by the key IN THE URL, because that is
   * the only credential a calendar client can carry — Google, Apple and
   * Outlook subscribe to a plain address and send no cookie. See
   * `calendarKey` in accounts.js for why that is a key of its own: it reads
   * the diary and nothing else, and rolling it kills every old subscription.
   *
   * An unknown key is a 404 rather than a 401. A calendar client that gets a
   * 401 will pop an authentication box at somebody forever; a 404 makes it
   * stop, which is what a revoked feed should do.
   */
  /*
   * The subscription URL, and a way to kill it. Behind the ordinary account
   * gate, unlike the feed itself — knowing your own address is a signed-in
   * question, reading the feed cannot be.
   */
  if (route === '/api/calendar/link' && (req.method === 'GET' || req.method === 'POST')) {
    if (!allowed(req, res, url, FEATURES.CALENDAR)) return true;
    const who = whoIs(req, url);
    if (!who || !who.id) return sendJson(res, 403, { error: 'Sign in to get your calendar link.' }), true;
    const key = req.method === 'POST'
      ? accounts.rollCalendarKey(who.id)
      : accounts.calendarKey(who.id);
    await backUpAccounts();
    return sendJson(res, 200, { path: `/api/calendar.ics?key=${encodeURIComponent(key)}` }), true;
  }

  if (route === '/api/calendar.ics') {
    const account = accounts.byCalendarKey(url.searchParams.get('key') || '');
    if (!account) return send(res, 404, 'No calendar here.', { 'Content-Type': 'text/plain' }), true;
    const room = rooms.get(roomIdFor(account));
    await ensureInvoicesRestored(room);
    const nights = upcoming({
      venues: room.invoices.customers,
      bookings: room.invoices.bookings,
      // A calendar wants further ahead than a console panel does: the console
      // is answering "what is next", this is answering "what is my year".
      weeks: 26,
    });
    const body = calendarIcs(nights, {
      name: `${brandForRoom(room)} — quiz nights`,
      host: 'quizporium',
    });
    // Subscriptions are re-read often; an hour is what the feed itself asks
    // for in X-PUBLISHED-TTL and there is no reason to work harder. `send`
    // defaults to no-store, so the header is set explicitly here.
    return send(res, 200, body, {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Cache-Control': 'private, max-age=3600',
      'Content-Disposition': 'inline; filename="quiz-nights.ics"',
    }), true;
  }

  if (route === '/api/results.json') {
    if (!allowed(req, res, url, FEATURES.LIBRARY)) return true;
    return sendJson(res, 200, roomForHost(req, url).session.results()), true;
  }
  if (route === '/api/results.csv') {
    if (!allowed(req, res, url, FEATURES.LIBRARY)) return true;
    const { session } = roomForHost(req, url);
    const results = session.results();
    const rows = session.kind === 'bingo'
      ? [['Team', 'Squares away', 'False calls', 'Won'], ...results.leaderboard.map((p) => [p.name, p.away, p.falseCalls, p.won ? 'yes' : ''])]
      : [['Position', 'Team', 'Score', 'Correct', 'Answered'], ...results.leaderboard.map((p) => [p.position, p.name, p.score, p.correctCount, p.answeredCount])];
    const csv = rows.map((r) => r.map(csvCell).join(',')).join('\r\n');
    return send(res, 200, csv, {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="quiz-results.csv"`,
    }), true;
  }

  return false;
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
function progressStream(res) {
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

async function backUp(relPath, contents, message, log = () => {}) {
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
async function backUpMany(files, message, log = () => {}) {
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
function invoiceBackupName(room) {
  return room.id === HOUSE ? 'invoicing.json' : `invoicing-${room.id}.json`;
}

async function backUpInvoices(room) {
  if (!privateRepoConfigured()) return { ok: false, error: 'no private repo set up' };
  try {
    return await putFile(invoiceBackupName(room), room.invoices.serialise(), 'Update invoices', 'private');
  } catch (err) {
    return { ok: false, error: err.message };
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
function archiveBackupName(room) {
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
async function backUpArchive(room) {
  if (!privateRepoConfigured()) return { ok: false, error: 'no private repo set up' };
  try {
    return await putFile(archiveBackupName(room), serialiseArchive(room.paths.archive), 'Update past nights', 'private');
  } catch (err) {
    return { ok: false, error: err.message };
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
const archiveRestored = new Set();
async function ensureArchiveRestored(room) {
  if (archiveRestored.has(room.id)) return;
  archiveRestored.add(room.id);
  if (!privateRepoConfigured()) return;
  try {
    const saved = await getFile(archiveBackupName(room), 'private');
    if (!saved) return;
    const result = restoreArchive(room.paths.archive, saved.toString('utf8'));
    if (result.ok && result.nights) console.log(`[archive] restored ${result.nights} past night(s) for ${room.id}`);
  } catch (err) {
    // Never fatal. A GitHub having a bad morning must not stop a quiz night.
    console.warn(`[archive] could not fetch the backup for ${room.id}:`, err.message);
  }
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
function advertBackup(room, id) {
  const file = safeAdvertFile(id);
  return room.id === HOUSE
    ? { path: `adverts/${file}`, which: 'app', ready: githubConfigured() }
    : { path: `adverts/${room.id}/${file}`, which: 'packs', ready: packsRepoConfigured() };
}

async function backUpAdverts(room, id, contents) {
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

async function deleteAdvertBackup(room, id) {
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
const advertsRestored = new Set();
async function ensureAdvertsRestored(room) {
  if (room.id === HOUSE || advertsRestored.has(room.id) || !packsRepoConfigured()) return;
  advertsRestored.add(room.id);
  if (listAdvertPacks(room.paths.adverts).length) return;   // disk wins, always
  try {
    const files = await listDir(`adverts/${room.id}`, 'packs');
    for (const file of files) {
      if (!file.name.endsWith('.json')) continue;
      const body = await getFile(file.path, 'packs');
      if (!body) continue;
      fs.mkdirSync(room.paths.adverts, { recursive: true });
      fs.writeFileSync(path.join(room.paths.adverts, safeAdvertFile(file.name)), body);
    }
    if (files.length) console.log(`[adverts] restored ${files.length} venue set(s) for room ${room.id}`);
  } catch (err) {
    console.warn(`[adverts] could not restore ${room.id}:`, err.message);
  }
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
async function backUpCodes(serialised) {
  if (!privateRepoConfigured()) return { ok: false, error: 'no private repo set up' };
  try {
    return await putFile('room-codes.json', serialised, 'Update join codes', 'private');
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

/**
 * Back up the accounts.
 *
 * To the PRIVATE repository, for the same reason as the invoices and more so:
 * this file is every subscriber's email address, their password hash and their
 * payment reference. The main repo is public and git history is forever.
 */
async function backUpAccounts() {
  if (!privateRepoConfigured()) return { ok: false, error: 'no private repo set up' };
  try {
    return await putFile('accounts.json', accounts.serialise(), 'Update accounts', 'private');
  } catch (err) {
    return { ok: false, error: err.message };
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
async function restoreFromBackup() {
  if (!privateRepoConfigured()) {
    if (!accounts.all.length) {
      console.warn('[accounts] no accounts and no private repo configured — the host key is the only way in.');
    }
    return;
  }
  if (!accounts.all.length) {
    const saved = await getFile('accounts.json', 'private');
    if (saved) {
      const result = accounts.restore(saved.toString('utf8'));
      if (result.ok) console.log(`[accounts] restored ${result.accounts} account(s) from the private repository`);
      else console.warn('[accounts] could not restore the backup:', result.reason);
    } else {
      console.log('[accounts] nothing backed up yet — this is a first boot, or nobody has been added.');
    }
  }
  if (reports.isEmpty()) {
    const saved = await getFile('reports.json', 'private');
    if (saved) {
      const result = reports.restore(saved.toString('utf8'));
      if (result.ok) console.log(`[reports] restored ${result.reports} question report(s)`);
    }
  }

  if (suggestions.isEmpty()) {
    const saved = await getFile('suggestions.json', 'private');
    if (saved) {
      const result = suggestions.restore(saved.toString('utf8'));
      if (result.ok) console.log(`[suggestions] restored ${result.suggestions} suggestion(s)`);
    }
  }

  if (spend.isEmpty()) {
    const saved = await getFile('spend.json', 'private');
    if (saved) {
      const result = spend.restore(saved.toString('utf8'));
      if (result.ok) console.log(`[spend] restored ${result.rows} row(s) of what the AI has cost`);
    }
  }

  // The house invoice book. Every other room's is restored the first time that
  // quizmaster opens their Invoices tab, because rooms are created lazily and
  // this runs once at boot — see ensureInvoicesRestored below.
  await ensureInvoicesRestored(rooms.get(HOUSE));
  // And the house's past nights. Every other room's comes back the first time
  // that quizmaster opens their console, for the same lazy-rooms reason.
  await ensureArchiveRestored(rooms.get(HOUSE));

  /*
   * The join codes, before anybody's phone arrives.
   *
   * This one has to be at BOOT rather than lazily, and that is the whole point:
   * a phone scanning a printed QR is often the first thing to touch a room
   * after a restart, and by then it is too late to discover the code should
   * have been something else.
   */
  const restoredCodes = await getFile('room-codes.json', 'private').catch(() => null);
  if (restoredCodes) {
    const result = rooms.restoreCodes(restoredCodes.toString('utf8'));
    if (result.ok) console.log(`[rooms] restored ${result.codes} join code(s) from the private repository`);
  }

  /*
   * Play counts, and the same rule as everything else: only into an empty
   * file. A disk that already has counts on it is ahead of any backup, and
   * writing the backup over it would undo tonight's launches.
   */
  const statsFile = path.join(config.dataDir, 'library-stats.json');
  if (!fs.existsSync(statsFile)) {
    const saved = await getFile('library-stats.json', 'private');
    if (saved) {
      try {
        const text = saved.toString('utf8');
        JSON.parse(text); // refuse a corrupt backup rather than write it back
        fs.mkdirSync(config.dataDir, { recursive: true });
        fs.writeFileSync(statsFile, text, 'utf8');
        console.log('[library] restored play counts from the private repository');
      } catch (err) {
        console.warn('[library] could not restore play counts:', err.message);
      }
    }
  }
}

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
const invoicesRestored = new Set();
async function ensureInvoicesRestored(room) {
  if (invoicesRestored.has(room.id)) return;
  invoicesRestored.add(room.id);
  if (!privateRepoConfigured() || !room.invoices.isEmpty()) return;
  try {
    const saved = await getFile(invoiceBackupName(room), 'private');
    if (!saved) return;
    const result = room.invoices.restore(saved.toString('utf8'));
    if (result.ok) {
      console.log(`[invoices] restored ${result.invoices} invoice(s) and ${result.customers} customer(s) for ${room.id}; next number ${result.nextNumber}`);
    } else {
      console.warn(`[invoices] could not restore ${room.id}:`, result.reason);
    }
  } catch (err) {
    // Never fatal: GitHub having a bad morning must not stop a quiz night.
    console.warn(`[invoices] could not fetch the backup for ${room.id}:`, err.message);
  }
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
function backUpReports() {
  if (!privateRepoConfigured()) return;
  putFile('reports.json', reports.serialise(), 'Update question reports', 'private')
    .catch((err) => console.warn('[reports] could not back up:', err.message));
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
function backUpSpend() {
  if (!privateRepoConfigured()) return;
  putFile('spend.json', spend.serialise(), 'Update what the AI has cost', 'private')
    .catch((err) => console.warn('[spend] could not back up:', err.message));
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
function accountRef(id) {
  return String(id || '').replace(/[^a-zA-Z0-9]/g, '').slice(0, 4).toUpperCase();
}

function firstNameOf(account) {
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
function backUpAsks(room) {
  if (!privateRepoConfigured()) return;
  const name = room.id === HOUSE ? 'room-asks.json' : `rooms/${room.id}/room-asks.json`;
  putFile(name, room.asks.serialise(), 'Update what the room asked for', 'private')
    .catch((err) => console.warn('[asks] could not back up:', err.message));
}

function backUpSuggestions() {
  if (!privateRepoConfigured()) return;
  putFile('suggestions.json', suggestions.serialise(), 'Update the suggestion box', 'private')
    .catch((err) => console.warn('[suggestions] could not back up:', err.message));
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
function backUpLibraryStats() {
  if (!privateRepoConfigured()) return;
  const file = path.join(config.dataDir, 'library-stats.json');
  let contents;
  try {
    contents = fs.readFileSync(file, 'utf8');
  } catch {
    return; // nothing has been launched yet
  }
  putFile('library-stats.json', contents, 'Update play counts', 'private')
    .catch((err) => console.warn('[library] could not back up play counts:', err.message));
}

/** What the owner console lists. Never a hash, and never a session token. */
function subscriberList() {
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
function cataloguePerformance() {
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
function unbilledFor(room, req, url, nights) {
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
function billsThroughTheApp(req, url) {
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
function seesTheirNights(req, url) {
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
function offerPage(pack, slide) {
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
function markHidden(leagues) {
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

function seesTheirLeague(req, url) {
  const account = whoIs(req, url);
  if (!account) return false;
  return account.bootstrap ? true : can(account, FEATURES.LEAGUE);
}

function invoiceState(books) {
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
function withTotals(invoice) {
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
function readDraft(body = {}) {
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

async function backUpHistory(log = () => {}) {
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
 * Put one photo in the private repository, foldered by night.
 *
 * Never throws and never blocks a response: a failure here means the photo is
 * still on screen and still on this server, just not yet permanent. It is
 * retried by the "file the rest away" button rather than in a loop, because a
 * loop on a bad token would hammer GitHub all night for nothing.
 */
async function fileAway(room, photo) {
  if (!photosRepoConfigured()) return { ok: false };
  const { photos } = room;
  const read = photos.read(photo.id);
  if (!read) return { ok: false };
  const result = await putFile(
    // Foldered per room, so one quizmaster's night is never mixed in with
    // another's. The house keeps the flat path it has always used — Mark has
    // nights filed under it already and moving them would make his own history
    // vanish from the page this record exists to be.
    `${photoFolder(room.id)}/${photo.night}/${photo.file}`,
    read.bytes,
    `${photo.night}${photo.teamName ? ` — ${photo.teamName}` : ''}`,
    'photos',
  );
  if (result.ok) {
    photos.markFiled(photo.id);
    pushState(room);
  } else {
    console.warn('[photos] could not file one away:', result.error);
  }
  return result;
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
function reloadPackEverywhere(id, { clamp = true } = {}) {
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
function nowNext(session) {
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

function packInUse(kind, id, onlyRoom = null) {
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
function changesTheLiveQuestion(kind, id, incoming, onlyRoom = null) {
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

function packPlayState(kind, id, onlyRoom = null) {
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
async function backUpOwnPack(room, kind, id, contents) {
  if (!packsRepoConfigured()) return { ok: false, error: 'no packs repository set up' };
  try {
    return await putFile(backupPath(room.id, kind, id), contents, `Update ${kind} pack: ${id}`, 'packs');
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

async function removeOwnPackBackup(room, kind, id) {
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
const ownPacksRestored = new Set();

async function ensureOwnPacksRestored(room) {
  if (ownPacksRestored.has(room.id) || !packsRepoConfigured()) return;
  ownPacksRestored.add(room.id);
  if (countOwn(room.paths)) return;   // disk wins, always
  for (const kind of ['quiz', 'bingo']) {
    const dir = kind === 'quiz' ? room.paths.ownQuizzes : room.paths.ownBingo;
    if (!dir) continue;
    const files = await listDir(`packs/${room.id}/${kind}`, 'packs');
    for (const file of files) {
      if (!file.name.endsWith('.json')) continue;
      const body = await getFile(file.path, 'packs');
      if (!body) continue;
      try {
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(path.join(dir, file.name), body);
      } catch (err) {
        console.error(`[own-packs] could not restore ${file.path}:`, err.message);
      }
    }
    if (files.length) console.log(`[own-packs] restored ${files.length} ${kind} pack(s) for room ${room.id}`);
  }
}

function csvCell(value) {
  const s = String(value ?? '');
  return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

async function handleWrite(req, res, url, route) {
  /*
   * PUT A NIGHT ON THE PUBLIC GALLERY, or take it back down.
   *
   * IT LIVED IN `handleGet` AND WAS THEREFORE UNREACHABLE. That function is
   * only ever called for GET and HEAD — every POST comes here — so a POST to
   * this route fell through to the generic 404 and had done since the day the
   * gallery was written. It was dead code that read as a working feature: the
   * gate was tested, the page was built, and the one call that puts a night up
   * could never have been answered.
   *
   * Found by a browser agent posting to it and getting "Not found" instead of
   * the honest "there is nowhere to record this" — which is the third time in
   * this repo that something adjacent to the artefact was tested and the
   * artefact itself never was.
   */
  /*
   * TAKE ONE PHOTOGRAPH OUT OF A FILED NIGHT.
   *
   * Asked for before publishing anything: *"I need to remove some photos from
   * that section… a little bin icon so I can delete photos that shouldn't go
   * to the main gallery."* Which is the right order to want it in — the
   * gallery control publishes a whole night, so the only way to keep one
   * picture off it was to keep the night off it.
   *
   * **SCOPED BY THE ROOM, exactly like the route that serves them.** The path
   * is built from `roomForHost`, so a quizmaster can only ever delete out of
   * their own nights; there is no room parameter to tamper with, which is the
   * same shape `own-packs.js` relies on.
   *
   * **AND IT IS HONEST ABOUT WHAT DELETING MEANS.** This removes the file from
   * the repository, so it stops being served, stops appearing in Gigs and can
   * never reach the gallery. It does NOT rewrite git history — the blob is
   * still in the repo's past, as everything committed to git always is. That
   * matters if somebody ever asks for their photograph to be destroyed rather
   * than taken down, and the app must not imply otherwise.
   */
  /*
   * THE QUIZMASTER'S OWN PHOTOGRAPHS OF THE ROOM — asked for on 29 August
   * 2026: *"would be good to be able to add room photos to the gallery that
   * everyone sees, that I take from my own phone?"*
   *
   * ---
   *
   * **THE ROOM'S CAMERA IS SIXTY PHONES POINTED AT EACH OTHER, and none of
   * them is pointed at the room.** What a venue wants to be shown is the place
   * full — the bar three deep, forty heads looking at a projector — and that
   * is a picture only the person standing at the front takes. Every photo the
   * gallery has held until now came in through a PLAYER's phone, so the one
   * shot that actually sells the night was the one that could not get in.
   *
   * **IT GOES STRAIGHT INTO THE FILED NIGHT, never through the room's live
   * photo store**, and that is what makes it usable at all. `photos.add()`
   * dates a picture by the clock at the moment it lands, so anything sent on
   * the Friday would file itself under the Friday — a Thursday quiz, and a
   * photograph of it in a folder for a night that did not happen. Naming the
   * night in the URL is what lets him do this in the car park, or on Monday.
   *
   * **AND IT IS CAMERA-ELIGIBLE BY DEFINITION.** The marker exists to keep a
   * meme somebody picked off their camera roll off a venue's page; these are
   * the promotional photographs, taken by the person whose name is on the
   * page. The one thing they must never do is arrive marked and then silently
   * not appear.
   *
   * Host-only, scoped by `roomForHost` like every other write behind this
   * door: there is no night, folder or room anybody can send that reaches
   * another quizmaster's history.
   */
  if (route.startsWith('/api/past-photo/') && req.method === 'POST') {
    if (!allowed(req, res, url, FEATURES.PAST_GIGS)) return true;
    const night = decodeURIComponent(route.slice('/api/past-photo/'.length));
    if (!isNightFolder(night)) return sendJson(res, 404, { error: 'No night with that date.' }), true;
    if (!photosRepoConfigured()) {
      // Name the missing thing rather than saying "could not save that", which
      // would send somebody hunting through the app for a fault in an env var.
      return sendJson(res, 400, { error: 'The private photo repository is not set up, so there is nowhere to keep these.' }), true;
    }

    let bytes;
    try {
      bytes = await readBody(req, MAX_BYTES);
    } catch {
      return sendJson(res, 413, { error: 'That photo is too big. It should be scaled down before it is sent.' }), true;
    }
    /*
     * WHAT THE BYTES ACTUALLY ARE, rather than what the request claimed — the
     * same sniff `photos.add()` makes, and for the same reason: this file is
     * served straight back as an image on a public page, so a mislabelled one
     * would be a broken box in front of a venue.
     */
    const sniffed = sniffType(bytes);
    const ext = sniffed && extensionFor(sniffed);
    if (!ext) return sendJson(res, 415, { error: 'That is not a photo.' }), true;

    const room = roomForHost(req, url);
    /*
     * `mine` IN THE NAME, so a photograph the quizmaster added is tellable
     * from one the room sent — for a bin, for a count, and for whatever wants
     * to know later. It carries no `-picked`, so `isCameraFile()` lets it
     * through to the gallery, which is the whole point of the feature.
     */
    const name = `mine${Date.now().toString(36)}${Math.floor(Math.random() * 1296).toString(36)}${ext}`;
    const done = await putFile(
      `${photoFolder(room.id)}/${night}/${name}`,
      bytes,
      `${night} — added by the quizmaster`,
      'photos',
    );
    if (done && done.ok === false) return sendJson(res, 502, { error: done.error || 'Could not save that.' }), true;
    return sendJson(res, 200, {
      // The same route every other filed photo is served through, so nothing
      // downstream has to know where this one came from.
      ok: true, night, name, url: `/past-photo/${night}/${name}`,
    }), true;
  }

  /*
   * ONE PHOTOGRAPH ON OR OFF THE PUBLIC GALLERY.
   *
   * *"There may be some that were uploaded but are appropriate for a public
   * gallery that I can switch on."* The filename's camera guess decides by
   * default; this is where a human who was in the room overrules it, in either
   * direction — because the guess is wrong both ways. It misses a real
   * photograph whose EXIF a share sheet stripped, and it passes a screenshot
   * taken with somebody's own camera app.
   *
   * A ruling that only restates the guess is CLEARED rather than stored — see
   * `setPhotoDecision()`.
   */
  if (route.startsWith('/api/gallery-photo/') && req.method === 'POST') {
    if (!allowed(req, res, url, FEATURES.PAST_GIGS)) return true;
    const parts = route.slice('/api/gallery-photo/'.length).split('/');
    const night = decodeURIComponent(parts[0] || '');
    const name = safePhotoName(decodeURIComponent(parts[1] || ''));
    if (parts.length !== 2 || !isNightFolder(night) || !name) {
      return sendJson(res, 404, { error: 'No photo there.' }), true;
    }
    const body = await readJson(req);
    const on = Boolean(body && body.on);
    const room = roomForHost(req, url);
    /*
     * WHAT THE FILENAME WOULD HAVE SAID, so a ruling that agrees with it is
     * cleared instead of stored. Otherwise a later change to how the guess is
     * made could never reach this photo again.
     */
    const decision = on === isCameraFile(name) ? '' : (on ? 'on' : 'off');
    const done = await setPhotoDecision(room.id, night, name, decision);
    if (!done.ok) return sendJson(res, 400, { error: done.error || 'Could not save that.' }), true;
    return sendJson(res, 200, { ok: true, night, name, onGallery: on }), true;
  }

  if (route.startsWith('/api/past-photo/') && req.method === 'DELETE') {
    if (!allowed(req, res, url, FEATURES.PAST_GIGS)) return true;
    const parts = route.slice('/api/past-photo/'.length).split('/');
    const night = decodeURIComponent(parts[0] || '');
    const name = safePhotoName(decodeURIComponent(parts[1] || ''));
    if (!isNightFolder(night) || !name || parts.length !== 2) {
      return sendJson(res, 404, { error: 'No photo there.' }), true;
    }
    if (!photosRepoConfigured()) {
      // Say which thing is missing. "Could not delete that" would send
      // somebody hunting through the app for a fault in an env var.
      return sendJson(res, 400, { error: 'The private photo repository is not set up, so there is nothing to delete from.' }), true;
    }
    const room = roomForHost(req, url);
    const done = await deleteFile(
      `${photoFolder(room.id)}/${night}/${name}`,
      `Remove a photo from ${night}`,
      'photos',
    );
    if (done && done.ok === false) return sendJson(res, 502, { error: done.error || 'Could not delete that.' }), true;
    return sendJson(res, 200, { ok: true, night, name }), true;
  }

  /*
   * BUILD A NIGHT IN ADVANCE, AND THROW ONE AWAY — see `src/shows.js`.
   *
   * IN `handleWrite`, which is worth saying out loud because this repo has
   * already shipped a route defined in `handleGet` that could never answer a
   * POST and read as a working feature for months. The list comes back in
   * `/api/library` rather than from a GET here, so there is nothing of this
   * feature in the other function at all.
   *
   * **GATED ON THE GAME IT PLAYS, exactly as the launch is.** Saving a show is
   * not a way round a tier: a bingo show wants the bingo feature to save and
   * will want it again to launch, where every pack in it is re-checked. This
   * route deliberately does NOT verify the packs — that is the launch route's
   * job and duplicating it here would be a second definition of "in your
   * library" to drift. What it does instead is answer with what is WRONG with
   * the show, so the console can say so on the card days before the gig.
   */
  if (route === '/api/shows' && req.method === 'POST') {
    const body = await readJson(req);
    const kind = String(body.kind || 'quiz') === 'bingo' ? 'bingo' : 'quiz';
    if (!allowed(req, res, url, kind === 'bingo' ? FEATURES.BINGO : FEATURES.QUIZ)) return true;
    const room = roomForHost(req, url);
    try {
      const show = saveShow(room.paths, { ...body, kind });
      return sendJson(res, 200, { ok: true, show, problems: problemsWith(show, room) }), true;
    } catch (err) {
      return sendJson(res, 400, { error: err.message }), true;
    }
  }

  if (route.startsWith('/api/shows/') && req.method === 'DELETE') {
    /*
     * `live: true` rather than `mayStartSomething`: throwing away a show you
     * are not going to run is tidying up, and an account whose payment has
     * bounced should still be able to tidy up. The same reasoning as every
     * other mid-night action being asked with `live` set.
     */
    if (!allowed(req, res, url, FEATURES.QUIZ, { live: true })) return true;
    const room = roomForHost(req, url);
    try {
      deleteShow(room.paths, decodeURIComponent(route.slice('/api/shows/'.length)));
      return sendJson(res, 200, { ok: true }), true;
    } catch (err) {
      return sendJson(res, 404, { error: err.message }), true;
    }
  }

  if (route === '/api/past-gigs/publish' && req.method === 'POST') {
    if (!allowed(req, res, url, FEATURES.PAST_GIGS)) return true;
    const body = await readJson(req);
    const gigRoom = roomForHost(req, url);
    const done = await setPublished(gigRoom.id, String(body.night || ''), body.on !== false);
    return sendJson(res, done.ok ? 200 : 400, done), true;
  }

  /*
   * PUT A VENUE'S LEAGUE TABLE UP, or take it back down.
   *
   * Behind the LEAGUE gate rather than PAST_GIGS — it publishes a league —
   * and the room comes from WHO YOU ARE, so this can only ever publish your
   * own tables. There is no room parameter on purpose, the identical rule
   * `/api/host/*` and the gallery's own publish route both follow.
   *
   * The key is `venueKeyOf()`'s — an id where the nights have one, a
   * lowercased name where they do not — because that is what the table is
   * grouped by. Publishing by display name would put the wrong pub up the day
   * somebody renamed one.
   */
  /*
   * OVERRULE THE FILTER ON ONE NAME — in either direction.
   *
   * *"Can I get a manual override so we're erring on the side of caution but
   * I can override it."* The word list is a guess about intent; a quizmaster
   * who was in the room is not. So the list decides by default and this is
   * how a person overrides it — `allow` to publish a name it held back,
   * `hide` for one it let through, and an empty string to hand the decision
   * back to the list.
   *
   * Behind the LEAGUE gate and scoped to the signed-in room, exactly like the
   * publish route beside it: there is no room parameter, so this can only
   * ever rule on your own teams.
   */
  if (route === '/api/league/name' && req.method === 'POST') {
    if (!allowed(req, res, url, FEATURES.LEAGUE)) return true;
    const body = await readJson(req);
    const done = await setNameDecision(
      roomForHost(req, url).id, String(body.name || ''), String(body.decision || ''),
    );
    return sendJson(res, done.ok ? 200 : 400, done), true;
  }

  if (route === '/api/league/publish' && req.method === 'POST') {
    if (!allowed(req, res, url, FEATURES.LEAGUE)) return true;
    const body = await readJson(req);
    const lgRoom = roomForHost(req, url);
    const done = await setVenuePublished(lgRoom.id, String(body.venueKey || ''), body.on !== false);
    return sendJson(res, done.ok ? 200 : 400, done), true;
  }

  if (route === '/api/sign-in' && req.method === 'POST') {
    const body = await readJson(req);
    const session = accounts.signIn(body.email, body.password);
    // One message for a wrong password and for an address with no account —
    // otherwise this page will happily tell anybody who has an account here.
    if (!session) return sendJson(res, 401, { error: 'That email address and password do not match.' }), true;
    const secure = (req.headers['x-forwarded-proto'] || '').split(',')[0].trim() === 'https';
    res.setHeader('Set-Cookie', [
      `${SESSION_COOKIE}=${encodeURIComponent(session.token)}`,
      'Path=/',
      'HttpOnly',
      'SameSite=Lax',
      `Max-Age=${30 * 86400}`,
      ...(secure ? ['Secure'] : []),
    ].join('; '));
    /*
     * A SIGN-IN IS A THING TO BACK UP, and it was the one write that was not.
     *
     * A session is the SHA-256 of a token sitting in somebody's cookie, and it
     * lives in `data/accounts.json` — which on a host with no permanent disk is
     * empty again after every deploy. The accounts came back from the private
     * repo, but the backup was pushed the last time an ACCOUNT changed, which
     * is weeks before anybody signed in. So the cookie in the browser pointed
     * at a token the restored file had never heard of, and the whole app
     * answered 401 with nothing on screen saying why.
     *
     * It cost a live test mid-gig-day: a deploy landed between Launch and the
     * first press on the control view, and every button came back "wrong host
     * key" on a night that was running perfectly. `restore()` already keeps
     * sessions deliberately, for exactly this reason — the backup simply never
     * contained one.
     *
     * Awaited, because the whole point is that it is on disk in the repository
     * before the browser has the cookie. It can never throw: `backUpAccounts()`
     * catches everything and reports, so a GitHub having a bad morning makes a
     * sign-in slower and never refuses one.
     */
    await backUpAccounts();
    return sendJson(res, 200, {
      account: { ...session.account, entitlements: entitlements(session.account) },
    }), true;
  }

  /*
   * ---- "I have forgotten my password"
   *
   * Built because there was NO WAY BACK IN. A password is only ever stored as
   * a scrypt hash, so nobody can be told what theirs was; the reset route
   * needs an account id; an owner's own account is deliberately not in the
   * subscriber list, so even the host key cannot find the id; and Render's
   * free tier has no shell. A forgotten password was a locked door with
   * nothing behind it.
   *
   * IT ALWAYS ANSWERS THE SAME, whether or not that address has an account.
   * Otherwise this becomes the thing the sign-in page carefully refuses to be:
   * a way to ask who has a login here. The reply says what WILL happen if the
   * address is known, and promises nothing about whether it is.
   */
  if (route === '/api/reset/request' && req.method === 'POST') {
    const body = await readJson(req);
    const email = String(body.email || '').trim();
    const said = { ok: true, sent: 'If that address has an account, a link is on its way. It lasts 30 minutes.' };
    // Said plainly rather than pretending: without a key nothing is going to
    // arrive, and "check your inbox" for an email that will never come is the
    // worst answer there is.
    if (!emailConfigured()) {
      return sendJson(res, 200, { ...said, ok: false, unconfigured: true,
        error: 'Password reset by email is not set up on this server yet.' }), true;
    }
    const started = accounts.startReset(email);
    // Throttled or unknown: same reply, no email. A held-down button must not
    // post somebody a hundred emails at the owner's expense.
    if (!started || started.throttled || !started.token) return sendJson(res, 200, said), true;

    /*
     * NO PROXY HEADER MEANS THE CONNECTION REALLY IS PLAIN HTTP, not "assume
     * https and hope". Render terminates TLS and forwards plain HTTP with
     * `x-forwarded-proto: https` set, so that header is the only honest
     * source for the scheme — this process never speaks TLS itself. Defaulting
     * to https here produced a link nobody could open on a local run with no
     * proxy in front, which is exactly how this project's own setup runs it.
     * Found live: `curl`ing the route directly reproduced an unusable
     * `https://localhost:PORT/...` link on a server serving plain HTTP.
     */
    const base = (config.publicUrl || '').replace(/\/+$/, '')
      || `${(req.headers['x-forwarded-proto'] || 'http').split(',')[0].trim()}://${req.headers.host}`;
    const link = `${base}/reset?t=${encodeURIComponent(started.token)}`;
    // `brandForRoom`, not `brandFor` — the second takes a person's NAME and
    // returns a string, so `brandFor(rooms.house).name` was a room passed as a
    // name and then `.name` read off a string. It came out as "Set a new
    // password for undefined", which is a phishing email as far as anybody
    // reading it is concerned.
    const name = brandForRoom(rooms.get(HOUSE));
    const out = await sendEmail({ to: email, ...resetEmail({ name, link }) });
    /*
     * The failure is REPORTED rather than swallowed, and that is a weighed
     * trade-off rather than an oversight.
     *
     * It costs a narrow leak: while the mail service is broken, a known
     * address answers `ok: false` and an unknown one answers `ok: true`, so
     * the two can be told apart — which is the thing the identical sign-in
     * error goes to such trouble to prevent. The words never name the address;
     * only the flag differs, and only while sending is down.
     *
     * Kept anyway, because the other way round is worse where it matters: the
     * person asking is ALREADY LOCKED OUT, and "check your inbox" for an email
     * that never left the building is how somebody spends an evening before a
     * gig. A transient distinguisher on an app with a handful of accounts
     * against a real operational failure is not a close call — and "failure
     * messages have to name the cause" is the rule this codebase keeps
     * relearning. If the account list ever gets big enough for enumeration to
     * matter, the fix is to report send failures to the OWNER's console
     * instead, not to hide them from everybody.
     */
    if (!out.ok) return sendJson(res, 200, { ...said, ok: false, error: out.reason }), true;
    await backUpAccounts();
    return sendJson(res, 200, said), true;
  }

  /** Is this link still good? Asked by the page before it offers a box. */
  if (route === '/api/reset/check' && req.method === 'POST') {
    const body = await readJson(req);
    const who = accounts.whoseReset(String(body.token || ''));
    return sendJson(res, 200, { ok: Boolean(who), email: who ? who.email : '' }), true;
  }

  /** Spend the link and set the new password. Single use — see `useReset`. */
  if (route === '/api/reset/complete' && req.method === 'POST') {
    const body = await readJson(req);
    try {
      const account = accounts.useReset(String(body.token || ''), String(body.password || ''));
      if (!account) {
        return sendJson(res, 400, {
          error: 'That link has been used already or has run out. Ask for a new one.',
        }), true;
      }
      await backUpAccounts();
      return sendJson(res, 200, { ok: true, email: account.email }), true;
    } catch (err) {
      // A password that is too short, said in words rather than as a 500.
      return sendJson(res, 400, { error: err.message }), true;
    }
  }

  if (route === '/api/sign-out' && req.method === 'POST') {
    accounts.signOut(cookie(req, SESSION_COOKIE));
    res.setHeader('Set-Cookie', `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
    // The other half of backing a sign-in up: without this the next deploy
    // restores a backup that still holds the session somebody just ended, so
    // signing out would quietly un-sign-out on the following restart.
    await backUpAccounts();
    return sendJson(res, 200, { ok: true }), true;
  }

  /*
   * Your own two colours.
   *
   * Yours and only yours — the account is read off the cookie, and there is no
   * id in the request, so this cannot repaint anybody else's projector. It sits
   * up here with the other `/api/me` routes rather than behind a feature gate
   * because it is nobody's paid extra: it costs nothing to run, which under the
   * host's own tier rule makes it Basic, and an owner needs it too.
   *
   * The host key has no account to save it against, so it is told so plainly
   * rather than silently doing nothing.
   */
  if (route === '/api/me/scheme' && req.method === 'PUT') {
    const account = whoIs(req, url);
    if (!account) return sendJson(res, 401, { error: 'Sign in first' }), true;
    if (account.bootstrap) {
      return sendJson(res, 400, {
        error: 'The host key is not an account, so there is nothing to save a colour against. Sign in to pick one.',
      }), true;
    }
    const body = await readJson(req);
    const saved = accounts.setScheme(account.id, body.scheme);
    if (!saved) return sendJson(res, 404, { error: 'No such account' }), true;
    await backUpAccounts();
    // Everything already on a screen in this room, repainted where it stands —
    // the projector and every phone, without anybody reloading anything.
    pushState(rooms.get(roomIdFor(account)));
    return sendJson(res, 200, { ok: true, scheme: saved.scheme }), true;
  }

  /*
   * What you choose to LOOK at — never what you are allowed to do.
   *
   * A quizmaster who never invoices does not want an Invoices tab, and that is
   * all this is. It can only ever HIDE something the account already has:
   * `allowed()` does not read prefs and never will, so there is no way for a
   * setting on this page to hand anybody a feature. See `setPrefs()`.
   */
  /*
   * ---- the suggestion box
   *
   * One box, three kinds, no ceremony. Open to anybody signed in and to the
   * host key, because the people most worth hearing from are the ones having
   * the worst time — and a feedback route behind a paywall hears only from
   * people who are already happy enough to have paid for the top tier.
   */
  if (route === '/api/suggestions' && req.method === 'POST') {
    const me = whoIs(req, url);
    if (!me) return sendJson(res, 401, { error: 'Sign in first' }), true;
    const body = await readJson(req);
    const kind = KINDS.includes(String(body.kind)) ? String(body.kind) : 'idea';

    /*
     * Sending is open to anybody signed in and is deliberately NOT gated on a
     * tier — the people most worth hearing from are the ones having the worst
     * time, who are the least likely to be on the top rung.
     *
     * A pack request is the one exception, because it is a claim on the
     * owner's writing time rather than a message. Checked HERE and not left to
     * the console not drawing the option: a kind is one word in a request
     * body, which is exactly the shape of the hole `POST /api/quiz` had.
     */
    if (kind === PACK_REQUEST_KIND) {
      if (!allowed(req, res, url, FEATURES.REQUEST_PACK)) return true;
      const state = suggestions.packRequestStatus(me.id || '');
      if (!state.mayAsk) {
        const when = new Date(state.nextAllowedAt).toLocaleDateString('en-GB', {
          day: 'numeric', month: 'long', timeZone: 'Europe/London',
        });
        return sendJson(res, 409, {
          error: state.open
            ? `You already have one on the list — "${state.open.text.slice(0, 60)}". That one gets written first.`
            : `That is this month's. You can ask for the next one from ${when}.`,
          waiting: true,
          state,
        }), true;
      }
    }

    const result = suggestions.add({
      text: body.text,
      kind,
      by: me.name || me.email || 'the host key',
      byId: me.id || '',
      where: body.where,
    });
    if (!result.ok) return sendJson(res, 400, { error: result.error }), true;
    backUpSuggestions();
    return sendJson(res, 200, { ok: true, suggestion: result.suggestion }), true;
  }

  /*
   * ---- /signup — a REAL account, self-serve, public, no key.
   *
   * LOW FRICTION ON PURPOSE: a name and an email, nothing else. Everything
   * else a quizmaster might set up — a venue, their colours, their calendar —
   * is a job for the account itself, once they are in it, not a form standing
   * between a visitor and trying the app.
   *
   * There is still no live payment route (see `todo/marketing-app.md`), so
   * this cannot take money — it creates the account on Bronze, `trialing`,
   * exactly the shape `accounts.create()` already defaults to. THE PASSWORD
   * IS NEVER TYPED HERE: a random one is set at creation and immediately
   * thrown away, then the same magic-link mechanism a forgotten password
   * uses (`startReset` / `/reset`) sends them a link to set a real one. One
   * proven path for "prove you own this address and set a password", used by
   * both a reset and a signup, rather than a second one invented here that
   * could drift from it.
   */
  if (route === '/api/signup' && req.method === 'POST') {
    const body = await readJson(req);
    const name = String(body.name || '').trim();
    const email = String(body.email || '').trim();
    if (!name) return sendJson(res, 400, { error: 'A name is needed.' }), true;

    let made;
    try {
      made = accounts.create({
        email,
        password: randomBytes(24).toString('hex'),
        name,
        role: 'quizmaster',
        tier: 'bronze',
        status: 'trialing',
        // A bad or stale code is dropped rather than refused — see the note
        // in accounts.create(). This is a query-string param a stranger can
        // edit; it must never be able to fail a real signup.
        referredBy: String(body.ref || '').trim(),
      });
    } catch (err) {
      // "There is already an account with that email address" arrives here
      // in the same words `accounts.create()` already uses everywhere else.
      return sendJson(res, 400, { error: err.message }), true;
    }
    await backUpAccounts();

    // See the note on the same fallback in /api/reset/request — no proxy
    // header means the connection really is plain HTTP, so 'http' is the
    // honest default rather than 'https'.
    const base = (config.publicUrl || '').replace(/\/+$/, '')
      || `${(req.headers['x-forwarded-proto'] || 'http').split(',')[0].trim()}://${req.headers.host}`;
    const started = accounts.startReset(email);
    const link = started && started.token ? `${base}/reset?t=${encodeURIComponent(started.token)}` : '';

    if (link && emailConfigured()) {
      const brandName = brandForRoom(rooms.get(HOUSE));
      sendEmail({ to: email, ...welcomeEmail({ name: brandName, link }) })
        .catch((err) => console.warn('[signup] could not email the new account:', err.message));
    }
    // Best-effort only, and never lets a visitor's own signup fail on it —
    // the account already exists by this point regardless of whether Mark
    // gets told about it straight away.
    if (emailConfigured() && accounts.owner && accounts.owner.email) {
      sendEmail({
        to: accounts.owner.email,
        subject: `New signup — ${name}`,
        text: `${name} <${email}> just signed up on Bronze, trialing.`,
      }).catch((err) => console.warn('[signup] could not notify the owner:', err.message));
    }

    return sendJson(res, 200, {
      ok: true,
      referred: Boolean(made.referredBy),
      trialDays: made.referredBy ? TRIAL_DAYS + REFERRAL_BONUS_DAYS : TRIAL_DAYS,
      // Only when there is no email service to hand the link to somebody the
      // ordinary way — the same fallback the console's own dev setup relies
      // on elsewhere, and it is this visitor's own new account either way.
      ...(!emailConfigured() && link ? { devLink: link } : {}),
    }), true;
  }

  /*
   * Draft a reply, for a human to read and edit. It NEVER sends.
   *
   * An AI reply that goes out unread is the one that goes publicly wrong —
   * apologising for something that did not happen, or promising a feature that
   * is not being built. This saves the blank page and nothing else.
   */
  if (route.startsWith('/api/suggestions/') && route.endsWith('/draft') && req.method === 'POST') {
    const me = whoIs(req, url);
    if (!me || (me.role !== 'owner' && !me.bootstrap)) {
      return sendJson(res, 403, { error: 'Owners only.' }), true;
    }
    const id = decodeURIComponent(route.slice('/api/suggestions/'.length, -'/draft'.length));
    const item = suggestions.find(id);
    if (!item) return sendJson(res, 404, { error: 'No such suggestion' }), true;
    try {
      const text = await draftReply({
        suggestion: item,
        apiKey: process.env.ANTHROPIC_API_KEY,
        ownerName: firstNameOf(accounts.owner) || 'Mark',
        appName: config.appName,
        // 1. What the owner has taught it, from the box on their own page.
        house: suggestions.house,
        // 2. Who wrote in, and what else they have sent — the difference
        //    between a plausible reply and one that could only be about them.
        account: accounts.find(item.byId),
        history: suggestions.forAccount(item.byId).filter((x) => x.id !== item.id),
        // 3. How the owner has answered before. The only part that gets better
        //    on its own: every reply sent is another example of their voice.
        past: suggestions.everyReply(),
        onSpend: spendRecorder(spend, { packId: '' }),
      });
      backUpSpend();
      return sendJson(res, 200, { ok: true, draft: text }), true;
    } catch (err) {
      return sendJson(res, 400, { error: err.message }), true;
    }
  }

  // Sending it. Stored on the thread and shown to whoever wrote in, and it
  // clears the item by default — an inbox where answering something leaves it
  // sitting there is one you stop trusting.
  if (route.startsWith('/api/suggestions/') && route.endsWith('/reply') && req.method === 'POST') {
    const me = whoIs(req, url);
    if (!me || (me.role !== 'owner' && !me.bootstrap)) {
      return sendJson(res, 403, { error: 'Owners only.' }), true;
    }
    const id = decodeURIComponent(route.slice('/api/suggestions/'.length, -'/reply'.length));
    const body = await readJson(req);
    /*
     * Was this the owner's writing, or the draft sent as it came?
     *
     * The browser sends back the draft it was given, and the two are compared.
     * Anything largely machine-written is stored as such and kept OUT of the
     * voice examples — otherwise the drafting model learns from its own output
     * and drifts a little further from the owner every time.
     */
    const result = suggestions.reply(id, body.text, {
      by: firstNameOf(accounts.owner) || 'Mark',
      clear: body.clear !== false,
      machine: !mostlyMine(body.text, body.draft),
    });
    if (!result.ok) return sendJson(res, 400, { error: result.error }), true;
    backUpSuggestions();
    return sendJson(res, 200, {
      ok: true, suggestions: suggestions.all, summary: suggestions.summary(),
    }), true;
  }

  /*
   * The owner's notes for the drafting model.
   *
   * This is how the drafts actually improve: every time one says something
   * wrong, a line goes in here and it stops saying it. Nothing else in the app
   * teaches it anything, so it is worth being easy to edit.
   */
  if (route === '/api/suggestions/house' && req.method === 'PUT') {
    const me = whoIs(req, url);
    if (!me || (me.role !== 'owner' && !me.bootstrap)) {
      return sendJson(res, 403, { error: 'Owners only.' }), true;
    }
    const body = await readJson(req);
    const house = suggestions.setHouse(body.house);
    backUpSuggestions();
    return sendJson(res, 200, { ok: true, house }), true;
  }

  // Dealt with, reopened, or binned. The owner's, like reading them.
  if (route.startsWith('/api/suggestions/') && (req.method === 'POST' || req.method === 'DELETE')) {
    const me = whoIs(req, url);
    if (!me || (me.role !== 'owner' && !me.bootstrap)) {
      return sendJson(res, 403, { error: 'Owners only.' }), true;
    }
    const id = decodeURIComponent(route.slice('/api/suggestions/'.length));
    if (req.method === 'DELETE') {
      if (!suggestions.remove(id)) return sendJson(res, 404, { error: 'No such suggestion' }), true;
    } else {
      const body = await readJson(req);
      if (!suggestions.setStatus(id, String(body.status || ''))) {
        return sendJson(res, 400, { error: 'That is not a status.' }), true;
      }
    }
    backUpSuggestions();
    return sendJson(res, 200, { ok: true, suggestions: suggestions.all, summary: suggestions.summary() }), true;
  }

  /*
   * ---- group accounts: a company or a pub group, seats under a parent
   *
   * A parent is DERIVED, never stored — any quizmaster becomes one the
   * moment they add a first seat. So there is no "create a group" route,
   * only "add a seat" and "remove a seat". See CLAUDE.md's Owner/Parent/
   * Child section and `docs/business/groups.md`.
   *
   * EVERY ROUTE HERE RESOLVES FROM `whoIs()`, NEVER FROM AN ID IN THE
   * REQUEST — the identical rule `/api/host/*` follows for rooms. A group
   * id taken from the body would be a door into somebody else's seats; the
   * only door here is "my own account's own children".
   */
  if (route === '/api/group/seats' && req.method === 'POST') {
    const me = whoIs(req, url);
    if (!me) return sendJson(res, 401, { error: 'Sign in first' }), true;
    if (me.bootstrap) return sendJson(res, 400, { error: 'The host key is not an account, so there is no group to add a seat to.' }), true;
    if (me.role === 'owner') return sendJson(res, 400, { error: 'The owner account does not run a group.' }), true;
    if (me.parentId) return sendJson(res, 400, { error: 'You are a seat in somebody else’s group, so you cannot have seats of your own.' }), true;
    const body = await readJson(req);
    let created;
    try {
      /*
       * A SEAT CHOOSES ITS OWN PASSWORD — the identical mechanism `/api/signup`
       * already uses for exactly the same reason: a random one is set and
       * immediately thrown away, then the magic-link reset flow sends them
       * somewhere to set a real one. One proven "prove you own this address"
       * path, not a second one invented here that could drift from it — and
       * it means the parent adding a seat never sees, types or holds a
       * password that is not their own.
       */
      created = accounts.addChild(me.id, { email: body.email, password: randomBytes(24).toString('hex'), name: body.name });
    } catch (err) {
      return sendJson(res, 400, { error: err.message }), true;
    }
    await backUpAccounts();

    const base = (config.publicUrl || '').replace(/\/+$/, '')
      || `${(req.headers['x-forwarded-proto'] || 'http').split(',')[0].trim()}://${req.headers.host}`;
    const started = accounts.startReset(created.email);
    const link = started && started.token ? `${base}/reset?t=${encodeURIComponent(started.token)}` : '';
    if (link && emailConfigured()) {
      const brandName = brandForRoom(rooms.get(HOUSE));
      sendEmail({ to: created.email, ...welcomeEmail({ name: brandName, link }) })
        .catch((err) => console.warn('[group] could not email the new seat:', err.message));
    }
    return sendJson(res, 200, {
      seat: created,
      // Only when there is no email service to hand the link to the SEAT the
      // ordinary way — same fallback /api/signup already relies on. Shown to
      // the parent only because there is nobody else to show it to yet; once
      // email is configured this never reaches them.
      ...(!emailConfigured() && link ? { devLink: link } : {}),
    }), true;
  }

  if (route.startsWith('/api/group/seats/') && req.method === 'DELETE') {
    const me = whoIs(req, url);
    if (!me) return sendJson(res, 401, { error: 'Sign in first' }), true;
    const childId = decodeURIComponent(route.slice('/api/group/seats/'.length));
    // THE SCOPING CHECK: only ever a seat that is actually one of MINE.
    // Without this, any signed-in account could unlink any other account
    // from its group just by knowing its id.
    const parent = accounts.parentOf(childId);
    if (!parent || parent.id !== me.id) return sendJson(res, 404, { error: 'No such seat in your group.' }), true;
    accounts.removeChild(childId);
    await backUpAccounts();
    return sendJson(res, 200, { ok: true }), true;
  }

  /*
   * ---- support access: the subscriber's own door, and only theirs
   *
   * The one thing on this page that is not cosmetic. A quizmaster's own
   * material is their work, and other quizmasters will assume the worst about
   * a competitor who can read it — so "only when you let me in, it runs out on
   * its own, and here is everything I did" is the answer, rather than a promise.
   *
   * Only the account itself can open it. Not the owner, and not the host key:
   * `whoIs` returns BOOTSTRAP for a key and there is no account to write it
   * against, so the key cannot open a door for itself either.
   */
  if (route === '/api/me/support' && req.method === 'PUT') {
    const account = whoIs(req, url);
    if (!account) return sendJson(res, 401, { error: 'Sign in first' }), true;
    if (account.bootstrap) {
      return sendJson(res, 400, {
        error: 'The host key is not an account, so there is no door to open. Sign in as the account you want to grant access to.',
      }), true;
    }
    /*
     * And NOT while acting as somebody. Letting the owner open the door from
     * inside a support session would mean one grant could extend itself for
     * ever, which is the whole point of an expiry undone in one line.
     */
    if (account.actingAs) {
      return sendJson(res, 403, {
        error: 'Support access can only be changed by the account holder, signed in as themselves.',
      }), true;
    }
    /*
     * A SWITCH, not a duration to choose.
     *
     * Picking "1 hour or 8 or 24" is a decision at the worst possible moment —
     * they do not know yet how long the problem takes. On, then off the second
     * it is sorted, is the control they actually want, and off is instant.
     *
     * And it runs on a DEAD MAN'S SWITCH rather than a booking. Half an hour
     * at a time; the app asks whether help is still needed as it runs down,
     * and one tap keeps it alive. So nobody has to remember to close
     * anything — walking away closes it, which is the behaviour you actually
     * want from somebody who has been distracted by a phone call. Opening it
     * again costs one tap, so being shut out early is cheap and being left
     * open for a week is impossible.
     */
    const body = await readJson(req);
    const saved = body.open === false
      ? accounts.closeSupport(account.id)
      : accounts.openSupport(account.id, Number(body.minutes) || SUPPORT_MINUTES);
    if (!saved) return sendJson(res, 404, { error: 'No such account' }), true;
    await backUpAccounts();
    return sendJson(res, 200, {
      ok: true,
      support: saved.support || null,
      open: accounts.supportOpen(account.id),
    }), true;
  }

  if (route === '/api/me/prefs' && req.method === 'PUT') {
    const account = whoIs(req, url);
    if (!account) return sendJson(res, 401, { error: 'Sign in first' }), true;
    if (account.bootstrap) {
      return sendJson(res, 400, {
        error: 'The host key is not an account, so there is nothing to remember this against. Sign in to change it.',
      }), true;
    }
    const body = await readJson(req);
    const saved = accounts.setPrefs(account.id, body);
    if (!saved) return sendJson(res, 404, { error: 'No such account' }), true;
    await backUpAccounts();
    return sendJson(res, 200, { ok: true, prefs: saved.prefs || {} }), true;
  }

  // Your own password. The old one is required even though you are signed in:
  // a borrowed laptop should not be a way to take somebody's account.
  if (route === '/api/me/password' && req.method === 'PUT') {
    const account = whoIs(req, url);
    if (!account || account.bootstrap) return sendJson(res, 401, { error: 'Sign in first' }), true;
    const body = await readJson(req);
    try {
      accounts.setPassword(account.id, body.password, { requireOld: body.current ?? '' });
      await backUpAccounts();
      return sendJson(res, 200, { ok: true, signedOut: true }), true;
    } catch (err) {
      return sendJson(res, 400, { error: err.message }), true;
    }
  }

  /*
   * ---- invoicing, the parts that change something
   *
   * Split from the reads because the server routes GET and everything else
   * through different functions. Putting these on the GET side meant the PDF
   * worked and nothing could be saved, which is a confusing way to fail.
   */

  if (route === '/api/invoices') {
    if (!allowed(req, res, url, FEATURES.INVOICES)) return true;
    // Always your OWN book, worked out from who you are — the same rule as
    // /api/host/*. There is no room parameter on any of these on purpose.
    const room = roomForHost(req, url);
    await ensureInvoicesRestored(room);
    const books = room.invoices;

    if (req.method === 'GET') {
      return sendJson(res, 200, invoiceState(books)), true;
    }

    // Issue one. This is the only thing that hands out a number.
    if (req.method === 'POST') {
      const body = await readJson(req);
      try {
        const invoice = books.issue(readDraft(body));
        const backup = await backUpInvoices(room);
        return sendJson(res, 200, {
          invoice: withTotals(invoice),
          filename: invoiceFilename(invoice),
          backedUp: backup.ok,
          ...invoiceState(books),
        }), true;
      } catch (err) {
        return sendJson(res, 400, { error: err.message }), true;
      }
    }
  }

  if (route === '/api/invoices/settings' && req.method === 'PUT') {
    if (!allowed(req, res, url, FEATURES.INVOICES)) return true;
    const room = roomForHost(req, url);
    await ensureInvoicesRestored(room);
    const body = await readJson(req);
    room.invoices.saveSettings(body);
    const backup = await backUpInvoices(room);
    return sendJson(res, 200, { backedUp: backup.ok, ...invoiceState(room.invoices) }), true;
  }

  if (route === '/api/invoices/customers' && req.method === 'POST') {
    if (!allowed(req, res, url, FEATURES.INVOICES)) return true;
    const room = roomForHost(req, url);
    await ensureInvoicesRestored(room);
    const body = await readJson(req);
    try {
      room.invoices.saveCustomer(body);
    } catch (err) {
      return sendJson(res, 400, { error: err.message }), true;
    }
    const backup = await backUpInvoices(room);
    return sendJson(res, 200, { backedUp: backup.ok, ...invoiceState(room.invoices) }), true;
  }

  /*
   * What a venue puts up. A route of its own so it cannot touch anything else
   * on the record — see `setVenueDetails` for why that matters.
   */
  if (route.startsWith('/api/asks/') && (req.method === 'POST' || req.method === 'DELETE')) {
    const me = whoIs(req, url);
    if (!me) return sendJson(res, 401, { error: 'Sign in first' }), true;
    const room = roomForHost(req, url);
    const id = decodeURIComponent(route.slice('/api/asks/'.length).replace(/\/keep$/, ''));
    /*
     * YES KEEPS IT, NO DELETES IT — and there is deliberately no third state.
     * A list of things you have already said no to is a list you read twice,
     * which is the opposite of what this is for.
     */
    const done = req.method === 'DELETE' ? room.asks.drop(id) : room.asks.keep(id);
    if (!done) return sendJson(res, 404, { error: 'No such request.' }), true;
    backUpAsks(room);
    return sendJson(res, 200, {
      asked: room.asks.grouped(),
      kept: room.asks.grouped(room.asks.kept),
    }), true;
  }

  if (route.startsWith('/api/invoices/customers/') && route.endsWith('/rewards') && req.method === 'PUT') {
    if (!allowed(req, res, url, FEATURES.INVOICES)) return true;
    const room = roomForHost(req, url);
    // Same reason as every other invoice route: without this a PUT lands on an
    // empty book, finds no venue and 404s on one that plainly exists.
    await ensureInvoicesRestored(room);
    const id = decodeURIComponent(route.slice('/api/invoices/customers/'.length, -'/rewards'.length));
    const body = await readJson(req);
    /*
     * The body carries whichever of the two the Venues tab just changed, and
     * `setVenueDetails` writes only what it was sent — so saving prizes cannot
     * clear a usual night. The path still says `/rewards` because a route is
     * not a label, and renaming it would 404 for any console still open in a
     * tab when this deploys.
     */
    const saved = room.invoices.setVenueDetails(id, body);
    if (!saved) return sendJson(res, 404, { error: 'No venue with that id.' }), true;
    const backup = await backUpInvoices(room);
    return sendJson(res, 200, { backedUp: backup.ok, ...invoiceState(room.invoices) }), true;
  }

  /*
   * The diary — a night put in, or a night taken out.
   *
   * On the INVOICES feature like everything else that reads or writes this
   * book, rather than on `FEATURES.CALENDAR`: the two are both Bronze and the
   * data is the same file, so a second gate here would be a second thing to
   * get wrong for no difference in who may do it. The console decides whether
   * to DRAW the diary from `CALENDAR`, which is where that distinction is
   * worth anything.
   */
  if (route === '/api/invoices/bookings' && req.method === 'POST') {
    if (!allowed(req, res, url, FEATURES.INVOICES)) return true;
    const room = roomForHost(req, url);
    await ensureInvoicesRestored(room);
    const body = await readJson(req);
    try {
      room.invoices.setBooking(body);
    } catch (err) {
      // Said in words: a booking with no date or no venue is a mistake worth
      // naming rather than a silent no-op.
      return sendJson(res, 400, { error: err.message }), true;
    }
    const backup = await backUpInvoices(room);
    return sendJson(res, 200, { backedUp: backup.ok, ...invoiceState(room.invoices) }), true;
  }

  if (route.startsWith('/api/invoices/bookings/') && req.method === 'DELETE') {
    if (!allowed(req, res, url, FEATURES.INVOICES)) return true;
    const room = roomForHost(req, url);
    await ensureInvoicesRestored(room);
    room.invoices.removeBooking(decodeURIComponent(route.slice('/api/invoices/bookings/'.length)));
    const backup = await backUpInvoices(room);
    return sendJson(res, 200, { backedUp: backup.ok, ...invoiceState(room.invoices) }), true;
  }

  if (route.startsWith('/api/invoices/customers/') && req.method === 'DELETE') {
    // INVOICES, like every other route on this tab — see the PDF one above.
    if (!allowed(req, res, url, FEATURES.INVOICES)) return true;
    const room = roomForHost(req, url);
    await ensureInvoicesRestored(room);
    room.invoices.deleteCustomer(decodeURIComponent(route.slice('/api/invoices/customers/'.length)));
    const backup = await backUpInvoices(room);
    return sendJson(res, 200, { backedUp: backup.ok, ...invoiceState(room.invoices) }), true;
  }

  // Mark it sent, paid or cancelled. Status is the only thing that can move on
  // an invoice that has already gone out — see src/invoices.js.
  if (route.startsWith('/api/invoices/') && req.method === 'POST') {
    // INVOICES, like every other route on this tab — see the PDF one above.
    // On LIBRARY, anybody with a login could mark somebody else's invoice paid
    // or cancel it, which is the invoice book quietly telling you a lie.
    if (!allowed(req, res, url, FEATURES.INVOICES)) return true;
    const room = roomForHost(req, url);
    await ensureInvoicesRestored(room);
    const number = decodeURIComponent(route.slice('/api/invoices/'.length));
    const body = await readJson(req);
    try {
      const invoice = room.invoices.setStatus(number, String(body.status || ''));
      if (!invoice) return sendJson(res, 404, { error: 'No invoice with that number' }), true;
      const backup = await backUpInvoices(room);
      return sendJson(res, 200, { backedUp: backup.ok, ...invoiceState(room.invoices) }), true;
    } catch (err) {
      return sendJson(res, 400, { error: err.message }), true;
    }
  }

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
    const out = room.session.engine?.redeemVoucher
      ? room.session.engine.redeemVoucher(String(body.code || ''), { by: 'scan' })
      : { ok: false, reason: 'unknown' };
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

  // ---- players (open to anyone with the join link)
  if (route === '/api/join' && req.method === 'POST') {
    const body = await readJson(req);
    const room = roomForPhone(req, url, body);
    const player = room.session.joinPlayer({ playerId: body.playerId, token: body.token, name: body.name, tryId: body.tryId });
    // A game that will not hold any more phones. Says so rather than handing
    // back an empty team, which the phone would draw as a joined player with
    // no name — see MAX_PLAYERS.
    if (player.full) {
      return sendJson(res, 503, { error: 'This game is full.', full: true }), true;
    }
    /*
     * Held at the door, not refused. A lot of NEW phones are arriving at once,
     * so the host is being asked whether it is a room or somebody messing
     * about — see src/joins.js. 202 rather than an error: nothing has gone
     * wrong, it just has not happened yet, and the phone waits and asks again.
     */
    if (player.waiting) {
      return sendJson(res, 202, {
        waiting: true, ahead: player.ahead,
        error: 'Waiting for the host to let everybody in.',
      }), true;
    }
    /*
     * The code goes back with the player so the phone can keep hold of it and
     * reconnect to the same game after a lock, a refresh or a lost signal —
     * the same reason it keeps the player id.
     *
     * And the TOKEN, which is the only place it is ever sent. It is the proof
     * this phone is that player: without it here the phone cannot answer at
     * all, and with it anywhere else a player id becomes a credential again.
     */
    return sendJson(res, 200, {
      id: player.id, token: player.token || '', name: player.name, score: player.score ?? 0,
      game: room.session.kind, joinCode: room.code,
    }), true;
  }

  /*
   * A photo from somebody's phone, straight onto the big screen.
   *
   * There is no approval step, on purpose and by the host's explicit decision:
   * the fun is that it is theirs to do, and he handles the room with the mic.
   * What he has instead is a switch that stops the lot and a bin for one, both
   * on his control view and both one tap.
   *
   * The body is the image itself rather than a form or base64. A phone photo
   * is already scaled down before it is sent; wrapping it in base64 would add
   * a third again for nothing, on the worst wifi in the building.
   */
  if (route === '/api/photo' && req.method === 'POST') {
    const room = roomForPhone(req, url);
    const { photos, session } = room;
    if (!photosWanted(room)) return sendJson(res, 200, { ok: false, reason: 'off' }), true;

    const playerId = String(url.searchParams.get('playerId') || '');
    const player = session.engine.state.players[playerId];
    // Joined phones only. Not a security boundary — it stops a stray request
    // putting an unattributed picture on a projector.
    if (!player) return sendJson(res, 200, { ok: false, reason: 'not_playing' }), true;

    let bytes;
    try {
      bytes = await readBody(req, MAX_BYTES);
    } catch {
      return sendJson(res, 200, { ok: false, reason: 'too_big' }), true;
    }

    const result = photos.add(bytes, {
      contentType: req.headers['content-type'],
      playerId,
      teamName: player.name,
      filter: String(url.searchParams.get('filter') || ''),
      // Read client-side, from the raw file before it was redrawn onto a
      // canvas — see looksCameraTaken() in filters.js. Best-effort, never a
      // gate: every photo still goes up regardless, this only decides
      // whether it is eligible for the public gallery later.
      camera: url.searchParams.get('camera') === '1',
    });
    if (result.ok) {
      pushState(room);
      // File it away in the background. The phone gets its answer first —
      // nobody should watch a spinner while GitHub thinks about it — and the
      // photo is on screen either way. This is only about surviving the
      // restart that would otherwise wipe it.
      fileAway(room, result.photo);
    }
    return sendJson(res, 200, result.ok ? { ok: true, id: result.photo.id } : result), true;
  }

  // What a phone is allowed to do: answer a question, mark a bingo square and
  // call house, and — on an online night — say something in one of its own
  // rooms. Nothing else, and nothing that could hand out a new card.
  if (['/api/answer', '/api/answer-breakout', '/api/mark', '/api/claim', '/api/wandered', '/api/say', '/api/team', '/api/arcade'].includes(route) && req.method === 'POST') {
    const body = await readJson(req);
    const action = route.slice('/api/'.length);
    const result = roomForPhone(req, url, body).session.runPlayerAction(action, body);
    // 200 either way: the phone shows its own feedback, and a rejected action
    // is a normal thing (too late, already answered), not an error.
    return sendJson(res, 200, result), true;
  }

  /*
   * ASK FOR A ROUND — from a phone that played, at the end of the night.
   *
   * Its own route rather than a player action, because what is typed goes to
   * the ROOM'S box on disk and never into the game state: a quiz engine has no
   * business holding somebody's shopping list, and a state file that grew with
   * every request would be rewritten on every save all night.
   *
   * The TOKEN is the whole gate. It proves the sender was in this game, which
   * is what makes an open text endpoint safe to have at all — and it is the
   * same proof rule 3 uses for answering, so nothing new is trusted here.
   */
  if (route === '/api/ask' && req.method === 'POST') {
    const body = await readJson(req);
    const room = roomForPhone(req, url, body);
    const engine = room.session.engine;
    const state = engine && engine.state;
    // Off unless the night turned it on, and only once the night is over.
    if (!state || !state.askForRounds || state.phase !== 'final') {
      return sendJson(res, 200, { ok: false, reason: 'closed' }), true;
    }
    const player = state.players && state.players[String(body.playerId || '')];
    if (!ownsPlayer(player, body.token)) {
      return sendJson(res, 200, { ok: false, reason: 'unknown' }), true;
    }
    /*
     * AN ID, NEVER WORDS. The label is looked up from the server's own list,
     * so nothing a stranger types can reach the quizmaster — which is what
     * removes the moderation question rather than managing it.
     */
    const offered = (state.roundIdeas || []).some((i) => i.id === String(body.ideaId || ''));
    const label = offered ? ideaLabel(String(body.ideaId || '')) : '';
    if (!label) return sendJson(res, 200, { ok: false, reason: 'unknown' }), true;
    const saved = room.asks.vote({
      ideaId: String(body.ideaId),
      label,
      by: player.id,
      name: player.name,
      night: nightOfGig(Date.now()) || '',
      venue: state.venue || '',
    });
    if (saved.ok) backUpAsks(room);
    return sendJson(res, 200, saved.ok ? { ok: true } : saved), true;
  }

  /*
   * ---- everything below this line needs an account
   *
   * A broad gate first, so nothing new can be added below it and accidentally
   * be public. The routes that need MORE than "is a quizmaster" ask for it
   * themselves underneath — generating, in particular, is the owner's alone
   * because it spends the owner's money.
   *
   * Asked with `live` set: this covers /api/host/*, which is the control view,
   * and a failed payment must never take the Next button away in the middle of
   * a round. A new night cannot be launched on a lapsed subscription — that is
   * checked on `launch` itself, below.
   */
  //
  // Both lists live in `src/gates.js` — a rule you cannot import is a rule you
  // cannot write a test for, and this one has been wrong twice. Read the
  // comments there before adding a route to either.
  const changesLibrary = changesTheLibrary(route, req.method);
  if (changesLibrary) {
    if (!allowed(req, res, url, FEATURES.CATALOGUE)) return true;
  }

  /*
   * Advert sets have their own gate now that they are per room.
   *
   * They used to be owner-only, purely because one shared folder meant a
   * second quizmaster tidying their venue list could delete somebody else's
   * slides. That is fixed, and under the host's own tier rule a slide costs
   * nothing to run — so writing them is a quizmaster's, on their own set.
   *
   * Asked EXPLICITLY rather than left to the broad quiz gate below, so the
   * refusal names adverts instead of talking about quiz features. The owner
   * still cannot write one, and that is consistent rather than an oversight:
   * an owner runs no nights, so they have no projector to put a slide on.
   */
  const advertRoute = route === '/api/advert' || route.startsWith('/api/advert/');
  if (advertRoute && !changesLibrary) {
    if (!allowed(req, res, url, FEATURES.ADVERTS, { live: true })) return true;
  }

  // The owner has no quiz features by design, so anything they alone may do has
  // to skip the broad gate below — the third time that has caught something.
  if (!changesLibrary && !advertRoute && !OWNER_ONLY.some((prefix) => route.startsWith(prefix))) {
    if (!allowed(req, res, url, FEATURES.QUIZ, { live: true })) return true;
  }

  /*
   * ---- a quizmaster's OWN packs
   *
   * Separate routes from `/api/quiz` and `/api/bingo` on purpose, and that is
   * the load-bearing bit. `changesTheLibrary()` in gates.js is a PATH test —
   * it cannot look inside a request and work out which of two libraries a pack
   * id belongs to. Sharing one route would mean either loosening the rule that
   * keeps subscribers out of the catalogue, or writing a second copy of it
   * somewhere with no test on it. Two prefixes, two rules, both testable.
   *
   * So: `/api/quiz` and `/api/bingo` write the CATALOGUE and stay the owner's.
   * `/api/mine/*` writes the room's own folder and can never touch the
   * catalogue — `saveOwn` and `deleteOwn` in own-packs.js take the room's own
   * directory and nothing else.
   *
   * They still do not GENERATE. There is no Claude call anywhere under here;
   * that is the owner's bill and the owner's house style.
   */
  /*
   * LAY OUT AN EMPTY QUIZ, in the shape they picked.
   *
   * The same rounds and counts the generator asks for, answered by hand — so a
   * quizmaster writing their own starts with the structure already right and
   * only has the words left to do. Building that shape in the editor by hand
   * is add-a-round, set-its-type, name-it, add-ten-questions before writing a
   * single question.
   *
   * **The placeholders are REAL TEXT, not blanks**, because `validateQuiz`
   * refuses a question with no prompt, a blank option or two identical ones —
   * and rightly, since those are the faults that reach a room. A quiz that
   * cannot be saved until it is finished could not be saved at all, so the
   * scaffold is valid from the first press and every line of it is meant to be
   * overwritten. An alphabet round takes no options at all, which is why it is
   * built from `answer` instead.
   */
  if (route === '/api/mine/quiz/scaffold' && req.method === 'POST') {
    if (!allowed(req, res, url, FEATURES.OWN_PACKS)) return true;
    const room = roomForHost(req, url);
    const body = await readJson(req, 64 * 1024);
    const title = String(body.title || '').trim().slice(0, 60);
    if (!title) return sendJson(res, 400, { error: 'A quiz needs a name.' }), true;

    // `roundPlan` is the whitelist and the clamp, in one place — the same one
    // the generator uses, so a typo cannot quietly become a round of general
    // knowledge here and not there.
    const plan = roundPlan(body.rounds);
    if (!plan.length) return sendJson(res, 400, { error: 'Pick at least one round.' }), true;

    const quiz = {
      /*
       * The id is the title slugged, the same as every generated pack — so a
       * quiz called "The Crown, Christmas 2026" files itself sensibly and
       * `saveOwn` refuses anything that would not make a filename.
       */
      id: title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'my-quiz',
      title,
      mine: true,
      rounds: plan.map((r, ri) => ({
        id: `r${ri + 1}`,
        type: r.type,
        title: {
          image: 'Whose face is this?',
          intro: 'Name that intro',
          multi: 'Pick them all',
          alphabet: 'First letter',
          breakout: 'Bonus round',
        }[r.type] || `Round ${ri + 1}`,
        ...(r.type === 'image' ? { reveal: 'mix' } : {}),
        questions: Array.from({ length: r.count }, (_, qi) => ({
          id: `r${ri + 1}q${qi + 1}`,
          prompt: `Question ${qi + 1} — write it here`,
          // A breakout question has no answer key at all — see
          // `isBreakoutPack()` in `src/quizzes.js` — so it is a prompt and
          // nothing else, same as `alphabet` is an answer and nothing else.
          ...(r.type === 'breakout'
            ? {}
            : r.type === 'alphabet'
            ? { answer: `Answer ${qi + 1}` }
            : {
              // Six for a pick-them-all round, four for everything else —
              // that is the round type, not a preference. See optionsFor().
              options: Array.from({ length: r.type === 'multi' ? 6 : 4 },
                (_, oi) => `Option ${'ABCDEF'[oi]}`),
              ...(r.type === 'multi' ? { correctIndexes: [0, 1] } : { correctIndex: 0 }),
              /*
               * A picture question is invalid without an image, so the
               * scaffold names one the same way the generator does — off the
               * right answer. It resolves to a lettered placeholder card
               * today, and once the real name is written in, "Make the
               * pictures" repoints the pack as it draws. Same path either way,
               * which is what makes a pack rehearsable before a penny is
               * spent.
               */
              ...(r.type === 'image' ? { image: portraitPath(`Option A ${ri + 1}-${qi + 1}`) } : {}),
            }),
        })),
      })),
    };

    const clean = normaliseQuiz(quiz, quiz.id);
    const problems = validateQuiz(clean);
    if (problems.length) return sendJson(res, 400, { error: 'Could not lay that out', problems }), true;
    try {
      saveOwn('quiz', clean.id, clean, { config, paths: room.paths });
    } catch (err) {
      return sendJson(res, 400, { error: err.message }), true;
    }
    await backUpOwnPack(room, 'quiz', clean.id, clean);
    return sendJson(res, 200, { ok: true, id: clean.id }), true;
  }

  if (route === '/api/mine/quiz' && req.method === 'POST') {
    if (!allowed(req, res, url, FEATURES.OWN_PACKS)) return true;
    const room = roomForHost(req, url);
    const body = await readJson(req, 4 * 1024 * 1024);
    const quiz = normaliseQuiz(body, body.id);
    const problems = validateQuiz(quiz);
    if (problems.length) return sendJson(res, 400, { error: 'Quiz is not valid', problems }), true;
    /*
     * The same question a quizmaster's own pack deserves — and MORE likely
     * here, because the person editing it is the person holding the phone
     * that is running it. Scoped to their own room, so it can never report
     * anything about somebody else's night.
     */
    const clash = body.confirmLive ? null : changesTheLiveQuestion('quiz', quiz.id, quiz, room);
    if (clash) return sendJson(res, 409, { error: 'onScreenNow', live: clash }), true;
    // The same re-pointing as the catalogue save — see the note there. It runs
    // AFTER the live-question check, so a refused save costs no lookups.
    let cued = { matched: [], missed: [], skipped: '' };
    try {
      cued = await recueQuiz(quiz, readPack('quiz', quiz.id, { config, paths: room.paths }));
    } catch { /* a save is never lost over a lookup */ }
    try {
      saveOwn('quiz', quiz.id, quiz, { config, paths: room.paths });
    } catch (err) {
      return sendJson(res, 400, { error: err.message }), true;
    }
    // If they were playing it, pick the edit up live — same as the catalogue.
    reloadPackEverywhere(quiz.id);
    const backup = await backUpOwnPack(room, 'quiz', quiz.id, JSON.stringify(quiz, null, 2) + '\n');
    return sendJson(res, 200, {
      ok: true, id: quiz.id, backedUp: backup.ok, backupError: backup.error, cued,
    }), true;
  }

  if (route.startsWith('/api/mine/quiz/') && req.method === 'DELETE') {
    if (!allowed(req, res, url, FEATURES.OWN_PACKS)) return true;
    const room = roomForHost(req, url);
    const id = decodeURIComponent(route.slice('/api/mine/quiz/'.length));
    // Only THEIR room — two quizmasters can each have one called `christmas`,
    // and one of them playing theirs is no reason to refuse the other.
    if (packInUse('quiz', id, room)) {
      return sendJson(res, 400, { error: 'That quiz is loaded in a game right now.' }), true;
    }
    try {
      deleteOwn('quiz', id, { config, paths: room.paths });
    } catch (err) {
      return sendJson(res, 404, { error: err.message }), true;
    }
    await removeOwnPackBackup(room, 'quiz', id);
    return sendJson(res, 200, { ok: true }), true;
  }

  if (route === '/api/mine/bingo' && req.method === 'POST') {
    if (!allowed(req, res, url, FEATURES.OWN_PACKS)) return true;
    const room = roomForHost(req, url);
    const body = await readJson(req, 4 * 1024 * 1024);
    const pack = normaliseBingoPack(body, body.id);
    const problems = validateBingoPack(pack);
    if (problems.length) return sendJson(res, 400, { error: 'That pack is not valid', problems }), true;
    try {
      saveOwn('bingo', pack.id, pack, { config, paths: room.paths });
    } catch (err) {
      return sendJson(res, 400, { error: err.message }), true;
    }
    const backup = await backUpOwnPack(room, 'bingo', pack.id, JSON.stringify(pack, null, 2) + '\n');
    return sendJson(res, 200, {
      ok: true, id: pack.id, backedUp: backup.ok, backupError: backup.error,
    }), true;
  }

  if (route.startsWith('/api/mine/bingo/') && req.method === 'DELETE') {
    if (!allowed(req, res, url, FEATURES.OWN_PACKS)) return true;
    const room = roomForHost(req, url);
    const id = decodeURIComponent(route.slice('/api/mine/bingo/'.length));
    if (packInUse('bingo', id, room)) {
      return sendJson(res, 400, { error: 'That pack is loaded in a game right now. Launch something else first.' }), true;
    }
    try {
      deleteOwn('bingo', id, { config, paths: room.paths });
    } catch (err) {
      return sendJson(res, 404, { error: err.message }), true;
    }
    await removeOwnPackBackup(room, 'bingo', id);
    return sendJson(res, 200, { ok: true }), true;
  }

  /*
   * Pasting a track list into a bingo game of their own.
   *
   * The same importer the owner's catalogue uses, pointed at their folder —
   * with the no-repeats memory switched OFF in both directions. That history is
   * the owner's generator's record of what IT has already used: reading it here
   * would silently drop songs out of a list a subscriber pasted deliberately,
   * and writing to it would make the owner's next generated pack avoid tracks
   * it has never played.
   */
  if (route === '/api/mine/import' && req.method === 'POST') {
    if (!allowed(req, res, url, FEATURES.OWN_PACKS)) return true;
    const room = roomForHost(req, url);
    /*
     * Bigger than it was, because a set can now carry a picture per slide.
     * Each is capped at 300KB by `cleanSlideImage`, so this is the envelope
     * for several of them plus the words rather than a licence for one huge
     * one.
     */
    const body = await readJson(req, 4 * 1024 * 1024);
    const stream = progressStream(res);
    const log = stream.log;
    try {
      if (countOwn(room.paths) >= MAX_OWN) {
        throw new Error(`You have ${MAX_OWN} of your own packs, which is as many as an account holds. Delete one first.`);
      }
      const result = await importBingoPack({
        config,
        dir: room.paths.ownBingo,
        remember: false,
        avoidMonths: 0,
        playlistUrl: String(body.playlistUrl || ''),
        text: String(body.text || ''),
        title: String(body.title || '').slice(0, 80) || undefined,
        cardSize: [3, 4, 5].includes(Number(body.cardSize)) ? Number(body.cardSize) : 4,
        log,
      });
      const backup = await backUpOwnPack(room, 'bingo', result.pack.id, JSON.stringify(result.pack, null, 2) + '\n');
      log(backup.ok
        ? 'backed up — this one survives a restart'
        : `saved here, but NOT backed up: ${backup.error || 'no packs repository set up'}`);
      log('DONE ' + JSON.stringify({
        id: result.pack.id,
        title: result.pack.title,
        trackCount: result.pack.tracks.length,
        mine: true,
        backedUp: backup.ok,
      }));
    } catch (err) {
      log('ERROR ' + err.message);
    }
    stream.end();
    return true;
  }

  // ---- managing subscribers
  if (route.startsWith('/api/reports/') && (req.method === 'POST' || req.method === 'DELETE')) {
    if (!allowed(req, res, url, FEATURES.CATALOGUE)) return true;
    const id = decodeURIComponent(route.slice('/api/reports/'.length));
    if (req.method === 'DELETE') {
      const gone = reports.remove(id);
      if (gone) backUpReports();
      return sendJson(res, 200, { ok: gone, ...reports.summary() }), true;
    }
    const body = await readJson(req);
    const ok = reports.setStatus(id, String(body.status || 'done'));
    if (ok) backUpReports();
    return sendJson(res, 200, { ok, ...reports.summary() }), true;
  }

  /*
   * Put the quizmaster hat on, or take it off.
   *
   * Creates the linked account the first time. It is given a long random
   * password nobody ever sees, because it is not signed into directly — the
   * whole point is ONE login. That also means there is no second password to
   * lose, and no second account anybody could sign into if they got the address.
   */
  if (route === '/api/owner/act-as' && req.method === 'POST') {
    const me = accounts.fromToken(cookie(req, SESSION_COOKIE));
    if (!me || me.role !== 'owner') return sendJson(res, 403, { error: 'Owners only.' }), true;
    const body = await readJson(req);

    if (body.on === false) {
      // Both cookies. A preview tier left behind would silently apply the next
      // time the hat went on, which is exactly the kind of thing that has you
      // hunting for a bug in the app rather than in your own session.
      res.setHeader('Set-Cookie', [
        `${ACTING_COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`,
        `${TIER_COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`,
      ]);
      return sendJson(res, 200, { ok: true, acting: false }), true;
    }

    /*
     * Look at it as a Bronze / Silver / Gold subscriber would.
     *
     * The owner only, and only while the hat is on — a real quizmaster has
     * nothing to preview and this cookie means nothing to them. Sent as its own
     * little request rather than folded into `on: true` so changing tier does
     * not re-create the linked account or disturb the room.
     */
    if (body.tier !== undefined) {
      const wanted = String(body.tier || '');
      if (wanted && !TIERS.some((t) => t.id === wanted)) {
        return sendJson(res, 400, { error: `"${wanted}" is not a tier.` }), true;
      }
      res.setHeader('Set-Cookie', wanted
        ? cookieFor(req, TIER_COOKIE, wanted)
        : `${TIER_COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`);
      return sendJson(res, 200, { ok: true, acting: true, previewTier: wanted }), true;
    }

    /*
     * ---- into SOMEBODY ELSE's account, on their invitation
     *
     * Three refusals, and each is a different failure:
     *
     *  - no grant, or an expired one: the door is shut. This is the promise.
     *  - their game is LIVE: you would be one mis-tap from ending somebody's
     *    night in front of sixty people. Support is for between gigs, and the
     *    refusal says so rather than just failing.
     *  - not a quizmaster: there is nothing to act as.
     */
    if (body.accountId) {
      const them = accounts.find(String(body.accountId));
      if (!them || them.role !== 'quizmaster') {
        return sendJson(res, 404, { error: 'No such quizmaster.' }), true;
      }
      if (!accounts.supportOpen(them.id)) {
        return sendJson(res, 403, {
          error: 'They have not let you in. Ask them to switch support access on from their account page — it is theirs to grant and it expires on its own.',
        }), true;
      }
      /*
       * `busy`, not `live` — and the difference is forty people.
       *
       * `live` means "past the lobby", so a room with forty players sitting in
       * a lobby with their team names typed in did not count as a night in
       * progress and support access was let straight in. The launch guard uses
       * the opposite standard (any joined player counts, lobby or not), and two
       * guards with two definitions of "somebody is mid-night" is how one of
       * them quietly becomes wrong.
       */
      if (rooms.get(them.id).busy) {
        return sendJson(res, 409, {
          error: 'They have a game up with people in it. Support access waits until the night is over — going in mid-round is one mis-tap from ending it.',
        }), true;
      }
      accounts.noteSupport(them.id, `${me.name || me.email} came in`);
      await backUpAccounts();
      res.setHeader('Set-Cookie', cookieFor(req, ACTING_COOKIE, them.id));
      return sendJson(res, 200, {
        ok: true, acting: true, support: true, account: accounts.view(them),
      }), true;
    }

    let hat = accounts.ownQuizmasterFor(me.id);
    if (!hat) {
      const [name, domain] = String(me.email).split('@');
      hat = accounts.create({
        // A + alias of the owner's own address: it is theirs, it is obviously
        // theirs in the account list, and it cannot collide with a real one.
        email: `${name}+quizmaster@${domain}`,
        password: randomBytes(24).toString('hex'),
        name: `${me.name || 'You'} (quizmaster)`,
        comped: true,
        status: 'active',
        ownedBy: me.id,
      });
      await backUpAccounts();
    }
    res.setHeader('Set-Cookie', cookieFor(req, ACTING_COOKIE, hat.id));
    return sendJson(res, 200, { ok: true, acting: true, account: accounts.view(hat) }), true;
  }

  /*
   * MOVE A FEATURE BETWEEN THE TIERS — the owner's buckets.
   *
   * Owner-only twice over: the `/api/owner/` prefix is in `OWNER_ONLY`, and
   * `FEATURES.SUBSCRIBERS` is checked here as well. This decides what every
   * account in the app is entitled to, so it is the one route where belt and
   * braces is proportionate.
   *
   * **The grandfathering is `setFeatureTier`'s job, not this route's**, so
   * there is one place that knows the rule and it is the place with the
   * accounts in it. What comes back is what it DID — which feature, from
   * where, to where, and how many people it protected — because "moved
   * Adverts to Gold, 3 accounts keep it" is the sentence the owner needs and
   * a bare ok is not.
   *
   * **Backed up like any account change**, and for the same reason: on a host
   * whose disk is wiped by every deploy, an unbacked ladder reverts silently
   * while every login survives.
   */
  if (route === '/api/owner/tiers' && req.method === 'POST') {
    if (!allowed(req, res, url, FEATURES.SUBSCRIBERS)) return true;
    const body = await readJson(req);
    try {
      const done = accounts.setFeatureTier(String(body.feature || ''), String(body.tier || ''));
      await backUpAccounts();
      return sendJson(res, 200, { ok: true, ...done, featureTiers: accounts.featureTiers() }), true;
    } catch (err) {
      return sendJson(res, 400, { error: err.message }), true;
    }
  }

  if (route === '/api/owner/accounts' && req.method === 'POST') {
    /*
     * The very first account is a special case, and only this one.
     *
     * Making an owner needed the command line, and Render's free tier has no
     * shell — so there was no way to create the first login on the live app at
     * all. A "set up the first owner" page open to the world is the thing
     * CLAUDE.md rules out, and rightly: it is a door that only ever needs
     * opening once and can be walked through by whoever finds it first.
     *
     * Gated on the HOST KEY it is neither. The host key already grants every
     * feature in the app, so this hands out nothing that holding it did not
     * already give you. The moment one account exists it goes back to being
     * owner-only, so the door closes behind you.
     */
    const first = accounts.all.length === 0 && isHostKey(req, url);
    if (!first && !allowed(req, res, url, FEATURES.SUBSCRIBERS)) return true;
    const body = await readJson(req);
    try {
      const made = accounts.create({
        email: body.email,
        password: body.password,
        name: body.name,
        role: first ? 'owner' : 'quizmaster',
        plan: body.plan || 'basic',
        addons: body.addons || [],
        comped: Boolean(body.comped),
        status: body.status || 'trialing',
      });
      const backup = await backUpAccounts();
      return sendJson(res, 200, { account: made, backedUp: backup.ok, accounts: subscriberList() }), true;
    } catch (err) {
      return sendJson(res, 400, { error: err.message }), true;
    }
  }

  /*
   * Reset somebody's password.
   *
   * The owner cannot READ a password — only a scrypt hash is stored, which is
   * the honest version of "your account is private from me" — so the only help
   * possible is setting a new one and telling them what it is. It signs
   * everything of theirs out, which `setPassword` already does and which is
   * right: a reset is usually somebody worried, and half-logged-out is no use.
   *
   * Its own route rather than a field on `update()`, deliberately. That method
   * is what a payment webhook talks to, and a webhook payload that could carry
   * a password is a door nobody meant to leave open.
   */
  /*
   * What a month of AI is allowed to cost.
   *
   * **It only ever draws a warning.** Nothing reads it to refuse a generation,
   * and that is deliberate rather than unfinished: a ceiling that stopped a job
   * would stop it halfway, when the money is already spent and the only thing
   * left to lose is the pack. Same reasoning as the expired-topical launch,
   * which warns and goes ahead.
   *
   * `/api/owner/` is already on OWNER_ONLY, so this needs no list of its own —
   * which is the trap that has caught six other routes going the other way.
   */
  if (route === '/api/owner/budget' && req.method === 'PUT') {
    if (!allowed(req, res, url, FEATURES.SUBSCRIBERS)) return true;
    const body = await readJson(req);
    spend.setBudget(body.pence);
    backUpSpend();
    return sendJson(res, 200, { ok: true, budget: spend.budgetState() }), true;
  }

  if (route.startsWith('/api/owner/accounts/') && route.endsWith('/password') && req.method === 'POST') {
    if (!allowed(req, res, url, FEATURES.SUBSCRIBERS)) return true;
    const id = decodeURIComponent(route.slice('/api/owner/accounts/'.length, -'/password'.length));
    const body = await readJson(req);
    try {
      const changed = accounts.setPassword(id, String(body.password || ''));
      if (!changed) return sendJson(res, 404, { error: 'No account with that id' }), true;
      const backup = await backUpAccounts();
      return sendJson(res, 200, { ok: true, backedUp: backup.ok, accounts: subscriberList() }), true;
    } catch (err) {
      return sendJson(res, 400, { error: err.message }), true;
    }
  }

  if (route.startsWith('/api/owner/accounts/') && (req.method === 'PUT' || req.method === 'DELETE')) {
    if (!allowed(req, res, url, FEATURES.SUBSCRIBERS)) return true;
    const id = decodeURIComponent(route.slice('/api/owner/accounts/'.length));
    try {
      const changed = req.method === 'DELETE' ? accounts.close(id) : accounts.update(id, await readJson(req));
      if (!changed) return sendJson(res, 404, { error: 'No account with that id' }), true;
      const backup = await backUpAccounts();
      return sendJson(res, 200, { account: changed, backedUp: backup.ok, accounts: subscriberList() }), true;
    } catch (err) {
      return sendJson(res, 400, { error: err.message }), true;
    }
  }

  /*
   * The owner's own photo tab: file the rest away, bin one, clear the lot.
   *
   * The same three things the control view can do, reachable from a page rather
   * than from a running game — because the job here is the morning after, not
   * the night itself. They are separate routes rather than `/api/host/*` with a
   * wider gate on purpose: `/api/host/*` is the running of a night, an owner
   * runs none, and loosening that is how a guard quietly stops meaning what it
   * says.
   */
  if (route.startsWith('/api/owner/photos/') && req.method === 'POST') {
    if (!allowed(req, res, url, FEATURES.PHOTO_EXPORT)) return true;
    const what = route.slice('/api/owner/photos/'.length);
    const room = roomForHost(req, url);
    const { photos } = room;
    const body = await readJson(req);

    if (what === 'file') {
      if (!photosRepoConfigured()) return sendJson(res, 200, { ok: false, reason: 'no_repo' }), true;
      const todo = photos.unfiled();
      let filed = 0;
      for (const photo of todo) {
        const result = await fileAway(room, photo);
        if (result.ok) filed++;
      }
      return sendJson(res, 200, { ok: true, filed, failed: todo.length - filed }), true;
    }
    if (what === 'remove') {
      const removed = photos.remove(String(body.id || ''));
      if (removed) pushState(room);
      return sendJson(res, 200, { ok: removed }), true;
    }
    if (what === 'clear') {
      const n = photos.clear();
      pushState(room);
      return sendJson(res, 200, { ok: true, cleared: n }), true;
    }
    return sendJson(res, 404, { error: 'Unknown action: ' + what }), true;
  }

  if (route.startsWith('/api/host/') && req.method === 'POST') {
    const action = route.slice('/api/host/'.length);
    const body = await readJson(req);
    // Always your own room, worked out from who you are signed in as. There is
    // no room parameter on any of these on purpose: a control view that could
    // be pointed at somebody else's night is the whole thing rooms exist to
    // prevent.
    const room = roomForHost(req, url);
    const { session, photos } = room;

    // Launching a different game is the one action that replaces the engine.
    if (action === 'launch') {
      /*
       * The one host action a lapsed subscription DOES stop.
       *
       * Everything else under /api/host/ is asked with `live` set, because a
       * card that failed on Tuesday must not take the Next button away from
       * somebody mid-round on Wednesday. Starting a brand new night is the
       * other side of that line: it is not an interruption, it is a beginning,
       * and it is exactly where "you need to sort the payment out" belongs.
       */
      const wanted = String(body.game || 'quiz') === 'bingo' ? FEATURES.BINGO : FEATURES.QUIZ;
      if (!allowed(req, res, url, wanted)) return true;

      /*
       * And it has to be a pack they actually hold.
       *
       * Checked here rather than trusted to the console not drawing a Launch
       * button, because a pack id is one word in a request body — the same
       * hole `POST /api/quiz` had, where the id was in the body and the route
       * prefix never matched it. Refused as a 403 with the reason in words
       * rather than a bare no: on a starter library "that one is not in your
       * library" is a sentence somebody can act on, and a silent failure at
       * launch is the worst possible moment for one.
       */
      const launchKind = String(body.game || 'quiz') === 'bingo' ? 'bingo' : 'quiz';
      /*
       * EVERY PACK IN THE RUNNING ORDER IS CHECKED, not just the one in
       * `packId` — and getting this wrong would be a gate that runs backwards.
       * A night composed of rounds is still a night made of packs, so a Bronze
       * account could otherwise borrow one round from a Gold quiz and play it,
       * which is the whole subscription walked round in a drag.
       *
       * `order` is only honoured for a quiz: a bingo game is a track list with
       * no rounds in it on disk, so there is nothing to take one of.
       */
      const wantedOrder = (launchKind === 'quiz' && Array.isArray(body.order))
        ? body.order.slice(0, MAX_ROUNDS)
        : null;
      const needed = wantedOrder && wantedOrder.length
        ? [...new Set(wantedOrder.map((r) => String((r && r.packId) || '')))]
        : [String(body.packId)];
      for (const id of needed) {
        if (isOwnPack(launchKind, id, room.paths)) continue;
        if (canPlayPack(whoIs(req, url), id, packDating(launchKind, id, room))) continue;
        return sendJson(res, 403, {
          error: needed.length > 1
            ? `${id} is not in your library, so it cannot be part of tonight.`
            : 'That pack is not in your library.',
          upgrade: true,
        }), true;
      }
      /*
       * And it must not end a night somebody is in the middle of.
       *
       * `session.launch()` builds a fresh game unconditionally, so before this
       * two people on one login could wipe each other's game mid-question —
       * reachable today by password sharing, which is what happens the moment
       * anybody decides three subscriptions are too many.
       *
       * **It says what it is about to destroy rather than refusing outright.**
       * A control that simply says no in front of a room is the mistake this
       * codebase keeps recording, and there are real reasons to launch over a
       * live game — the wrong pack went up, or the night genuinely restarts.
       * So the first press comes back with the game, the player count and
       * where it has got to, and a second deliberate press carries `replace`.
       * Nobody does that by accident.
       */
      const live = session.inProgress();
      if (live && !body.replace) {
        return sendJson(res, 409, {
          error: `"${live.title}" is running right now — ${live.players} playing${live.at ? `, ${live.at}` : ''}.`
            + ' Launching something else ends it and wipes the scores.',
          live,
          replace: true,
        }), true;
      }

      try {
        // The card shape is chosen at launch, not stored on the pack: the same
        // forty-two songs are a quick game on a 3x3 and a long one on a strip,
        // and which you want is a decision about tonight.
        const shape = body.shape && Number(body.shape.rows) && Number(body.shape.cols)
          ? { rows: Number(body.shape.rows), cols: Number(body.shape.cols) }
          : null;
        const prizes = Math.max(0, Math.min(5, Number(body.prizes) || 0));
        // How it looks tonight. Same reasoning as the card shape: the pack
        // carries a default, and "it is the fourteenth of February" is a fact
        // about this evening rather than about the pack.
        const look = String(body.look || '');
        // How long each question runs tonight, if the host chose to change
        // it — the pack editor no longer offers this at all (Tonight is the
        // only place it is set, exactly like Look). 0 means "as the pack
        // says". Clamped to the same 5-120 range the editor's own field used
        // to enforce, so a stray value from a curl call cannot hand the room
        // a one-second question or a five-minute one.
        const questionSeconds = body.questionSeconds
          ? Math.max(5, Math.min(120, Number(body.questionSeconds) || 0)) : 0;
        /*
         * WHICH LOBBY GAME, and the TIER IS CHECKED HERE because this is where
         * the account is known. A console cannot be the gate — it is the thing
         * somebody would edit — so a game above this tier is dropped and the
         * night falls back to the default for its kind rather than being
         * refused. Losing a choice costs a game nobody has seen yet; refusing
         * the launch costs the night.
         */
        const lobbyGame = lobbyGameFor(
          String(body.game || 'quiz'),
          String(body.lobbyGame || ''),
          (entitlements(whoIs(req, url) || {}) || {}).tier || '',
        ).id;
        /*
         * WHETHER TONIGHT ENDS ON A LEAGUE TABLE, decided HERE.
         *
         * The tier is checked at the route and never in the console — the same
         * rule the lobby game above follows, and for the same reason: the
         * console can be reloaded, edited or simply stale, and a projector
         * showing a Silver feature to a Bronze account is a gate that runs
         * backwards.
         *
         * Losing it costs a slide at the end of the night, never the launch.
         */
        const league = seesTheirLeague(req, url);
        // Whether the phones may make a noise. Defaults to yes, so a console
        // that has not been reloaded since this landed does not mute the room.
        const lobbySound = body.lobbySound !== false;
        // Whether anybody is in the room. Same shape of decision again: the
        // pack does not know, and tonight does.
        const online = Boolean(body.online);
        // Several phones, one team, scores averaged. Also a fact about tonight.
        const teamPlay = Boolean(body.teamPlay);
        // Cleaned inside `session.launch()`, where the ordinary launch cleans
        // it too — one definition of what the word means.
        const teamMode = String(body.teamMode || '');
        // Where tonight is — a name, so it works before venue accounts exist.
        const venue = String(body.venue || '');
        /*
         * WHAT FIRST, SECOND AND THIRD GET — READ OFF THE VENUE, not sent.
         *
         * A prize is the VENUE'S standing arrangement rather than a decision
         * about tonight: the same drink every week at one pub and something
         * else entirely at another. So it is set once on the Venues tab and
         * the launch form does not carry it at all — which is why there is no
         * "What they win" box on a pack card. Look, Where and Playing are
         * facts about the evening; this is not.
         *
         * Resolved HERE rather than in the browser so there is one source of
         * truth and a stale console cannot launch a night playing for
         * something the venue never agreed to. A body that carries `rewards`
         * still wins, so a curl call and every test keep working.
         */
        const named = String(body.venue || '').trim().toLowerCase();
        const record = named
          ? (room.invoices.customers.find((c) => String(c.name || '').trim().toLowerCase() === named) || {})
          : {};
        /*
         * THE VENUE'S ID, WRITTEN ONTO THE NIGHT BESIDE ITS NAME.
         *
         * Everything that groups nights by venue has matched on the NAME
         * lowercased — the adverts, the headcounts, the league. That works
         * until a pub is renamed or typed differently, and then one venue
         * silently becomes two half-histories with no way to notice.
         *
         * The record is already resolved here for the prizes and the logo, so
         * the id costs nothing to carry. **The name stays** and is still
         * written: every night filed before today has only a name, and a join
         * that could not read those would throw away the entire history it
         * exists to keep together.
         */
        const venueId = String(record.id || '');
        const onFile = record.rewards || null;
        const rewards = Array.isArray(body.rewards) ? body.rewards.map(String)
          : (body.reward ? [String(body.reward)] : (Array.isArray(onFile) ? onFile : []));
        /*
         * The venue's logo, read off the same record as the prizes and for the
         * identical reason: it is the venue's standing arrangement rather than
         * a decision about tonight, so it is never sent by the console. It
         * ends up on the winner's phone above the code, so the voucher reads
         * as something the pub issued rather than a string.
         */
        const venueLogo = String(record.logo || '');
        /*
         * WHEN THE NEXT ONE IS — WORKED OUT HERE, not sent, exactly like the
         * prizes above and for the same reason.
         *
         * The last slide of the night says "Back here Thursday 20th", and the
         * date comes from the venue's usual night and the diary rather than
         * from a box somebody types at the moment they are most rushed. A
         * night written off in the diary is skipped and a one-off wins over a
         * residency, because `upcoming()` already decides all of that — see
         * src/comeback.js.
         *
         * Resolved on the SERVER so a stale console cannot promise a room a
         * date that was cancelled this morning.
         */
        const comeBack = comeBackFor({
          venue,
          venues: room.invoices.customers,
          bookings: room.invoices.bookings,
          now: Date.now(),
        });
        /*
         * DOES THIS ROOM ASK WHAT THEY WANT NEXT TIME?
         *
         * A SWITCH on My account rather than a gate on a tier, at the host's
         * own reading: it decides whether three buttons appear on a phone at
         * the end of a night, which is a preference about how somebody runs a
         * room. Off unless turned on — a quizmaster who has never heard of it
         * should not have their room asked anything.
         *
         * Resolved here and written into the state at launch, exactly like the
         * prizes: a phone must never be able to ask on a night that did not
         * turn it on, whatever the setting says by the time it taps.
         */
        const asker = whoIs(req, url);
        const askForRounds = Boolean(asker && asker.prefs && asker.prefs.askRounds);
        /*
         * The three on offer — from what this room's library has NOT got, so
         * a Madonna round is never suggested to somebody who owns the Madonna
         * quiz. Picked once, here, so every phone votes on the same three.
         */
        const askIdeas = askForRounds
          ? pickIdeas((fullLibrary(config, room.id, listOwn(room.paths)).quizzes || [])
            .map((q) => q.title))
          : [];
        const started = session.launch(String(body.game || 'quiz'), String(body.packId), { shape, prizes, look, questionSeconds, lobbyGame, lobbySound, league, online, teamPlay, teamMode, venue, venueId, rewards, venueLogo, comeBack, askForRounds, roundIdeas: askIdeas, order: wantedOrder, breakPlan: body.breakPlan || {} });
        // Never awaited: a host pressing Launch with a room waiting does not
        // care whether GitHub is having a good day.
        backUpLibraryStats();
        return sendJson(res, 200, { ok: true, started, view: session.hostView() }), true;
      } catch (err) {
        return sendJson(res, 400, { error: err.message }), true;
      }
    }

    /*
     * TONIGHT AS MORE THAN ONE GAME — quiz, a bingo interlude, quiz again,
     * with the same teams and one running score across the interruption. A
     * SEPARATE action from `launch` above rather than a flag on it, so the
     * ordinary single-pack path above — the one `launch-route.test.js`
     * guards as protected surface — is not touched by any of this.
     *
     * Every check `launch` makes, this makes too: the feature gate per kind
     * actually used, every referenced pack owned or licensed (not just the
     * first one), and the same "here is what you are about to destroy"
     * guard before replacing a live game.
     */
    if (action === 'launchOrder') {
      const rawSegments = Array.isArray(body.segments) ? body.segments : [];
      const segments = rawSegments.map((s) => {
        if (s && s.kind === 'bingo') {
          return { kind: 'bingo', packId: String((s && s.packId) || ''), shape: s.shape, prizes: s.prizes };
        }
        const order = Array.isArray(s && s.order) ? s.order.slice(0, MAX_ROUNDS) : [];
        return { kind: 'quiz', order };
      }).filter((s) => (s.kind === 'bingo' ? s.packId : s.order.length));

      // Every pack in every part, checked the same way `launch` checks its
      // one pack (or its own single-kind running order) — a Bronze account
      // must not be able to smuggle a Gold pack in as part 3 of a night.
      const neededQuiz = new Set();
      const neededBingo = new Set();
      for (const s of segments) {
        if (s.kind === 'bingo') neededBingo.add(s.packId);
        else for (const r of s.order) neededQuiz.add(String((r && r.packId) || ''));
      }
      for (const id of neededQuiz) {
        if (isOwnPack('quiz', id, room.paths)) continue;
        if (canPlayPack(whoIs(req, url), id, packDating('quiz', id, room))) continue;
        return sendJson(res, 403, { error: `${id} is not in your library, so it cannot be part of tonight.`, upgrade: true }), true;
      }
      for (const id of neededBingo) {
        if (isOwnPack('bingo', id, room.paths)) continue;
        if (canPlayPack(whoIs(req, url), id, packDating('bingo', id, room))) continue;
        return sendJson(res, 403, { error: `${id} is not in your library, so it cannot be part of tonight.`, upgrade: true }), true;
      }
      // Gate on whichever kinds tonight actually uses — a quiz-only account
      // running a quiz-only running order must not be asked about bingo.
      if (neededQuiz.size && !allowed(req, res, url, FEATURES.QUIZ)) return true;
      if (neededBingo.size && !allowed(req, res, url, FEATURES.BINGO)) return true;

      const live = session.inProgress();
      if (live && !body.replace) {
        return sendJson(res, 409, {
          error: `"${live.title}" is running right now — ${live.players} playing${live.at ? `, ${live.at}` : ''}.`
            + ' Launching something else ends it and wipes the scores.',
          live,
          replace: true,
        }), true;
      }

      try {
        // The FIRST part decides the lobby default — Maze Mouth before a
        // quiz, Rally before bingo — exactly like an ordinary launch.
        const firstKind = segments[0] && segments[0].kind === 'bingo' ? 'bingo' : 'quiz';
        const look = String(body.look || '');
        // Same clamp as an ordinary launch — one number for the whole night,
        // applied to every quiz part; see nightWideOpts() for how it carries
        // across a bingo interlude untouched.
        const questionSeconds = body.questionSeconds
          ? Math.max(5, Math.min(120, Number(body.questionSeconds) || 0)) : 0;
        const lobbyGame = lobbyGameFor(
          firstKind,
          String(body.lobbyGame || ''),
          (entitlements(whoIs(req, url) || {}) || {}).tier || '',
        ).id;
        const league = seesTheirLeague(req, url);
        const lobbySound = body.lobbySound !== false;
        const online = Boolean(body.online);
        const teamPlay = Boolean(body.teamPlay);
        // Cleaned inside `session.launch()`, where the ordinary launch cleans
        // it too — one definition of what the word means.
        const teamMode = String(body.teamMode || '');
        const venue = String(body.venue || '');
        const named = String(body.venue || '').trim().toLowerCase();
        const record = named
          ? (room.invoices.customers.find((c) => String(c.name || '').trim().toLowerCase() === named) || {})
          : {};
        const venueId = String(record.id || '');
        const onFile = record.rewards || null;
        const rewards = Array.isArray(body.rewards) ? body.rewards.map(String)
          : (body.reward ? [String(body.reward)] : (Array.isArray(onFile) ? onFile : []));
        const venueLogo = String(record.logo || '');
        const comeBack = comeBackFor({
          venue,
          venues: room.invoices.customers,
          bookings: room.invoices.bookings,
          now: Date.now(),
        });
        const asker = whoIs(req, url);
        const askForRounds = Boolean(asker && asker.prefs && asker.prefs.askRounds);
        const askIdeas = askForRounds
          ? pickIdeas((fullLibrary(config, room.id, listOwn(room.paths)).quizzes || [])
            .map((q) => q.title))
          : [];
        const started = session.launchRunningOrder(segments, {
          look, questionSeconds, lobbyGame, lobbySound, league, online, teamPlay, teamMode, venue, venueId,
          rewards, venueLogo, comeBack, askForRounds, roundIdeas: askIdeas,
          /*
           * WHAT HAPPENS IN THE GAPS — passed straight through and cleaned
           * inside `session.launch()`, exactly where the ordinary launch
           * cleans it, so a plan cannot be valid on one route and not the
           * other. `|| {}` rather than leaving it undefined: a launch that
           * sends no plan must CLEAR the previous night's, not inherit it.
           */
          breakPlan: body.breakPlan || {},
        });
        backUpLibraryStats();
        return sendJson(res, 200, { ok: true, started, view: session.hostView() }), true;
      } catch (err) {
        return sendJson(res, 400, { error: err.message }), true;
      }
    }

    /*
     * "That one's wrong."
     *
     * One tap, no typing, no dialog. The room has just told the host a question
     * is wrong and there are sixty people waiting — anything more than a tap
     * does not get used, and a correction that does not get reported is a
     * correction that reaches nobody.
     *
     * What is reported is read off the RUNNING GAME rather than sent by the
     * browser, so there is nothing to get out of step and nothing a stale page
     * can mis-report.
     */
    if (action === 'reportQuestion') {
      const engine = session.engine;
      const q = typeof engine.question === 'function' ? engine.question() : null;
      const round = typeof engine.round === 'function' ? engine.round() : null;
      if (!q) return sendJson(res, 200, { ok: false, reason: 'no_question' }), true;
      const me = whoIs(req, url);
      const result = reports.add({
        packId: session.pack?.id || '',
        packKind: session.kind,
        roundIndex: engine.state.roundIndex,
        questionIndex: engine.state.questionIndex,
        questionId: q.id || '',
        prompt: q.prompt || '',
        answer: typeof engine.answerText === 'function' ? engine.answerText(q, round) : '',
        note: String(body.note || ''),
        by: (me && (me.name || me.email)) || 'Host key',
      });
      if (result.ok) backUpReports();
      return sendJson(res, 200, result), true;
    }

    // The photo controls: the switch, and the bin. Deliberately as immediate
    // as every other button on that view — something on the projector that
    // should not be there is not a moment for a confirmation dialog.
    if (action === 'photosOn') {
      photos.setEnabled(body.on !== false);
      pushState(room);
      return sendJson(res, 200, { ok: true, enabled: photos.enabled }), true;
    }
    if (action === 'photoRemove') {
      const removed = photos.remove(String(body.id || ''));
      if (removed) pushState(room);
      return sendJson(res, 200, { ok: removed }), true;
    }
    // File everything that has not made it to the private repo yet. Used at
    // the end of a night, or after a spell where GitHub was unreachable.
    if (action === 'photosFile') {
      if (!photosRepoConfigured()) {
        return sendJson(res, 200, { ok: false, reason: 'no_repo' }), true;
      }
      const todo = photos.unfiled();
      let filed = 0;
      for (const photo of todo) {
        const result = await fileAway(room, photo);
        if (result.ok) filed++;
      }
      return sendJson(res, 200, { ok: true, filed, failed: todo.length - filed }), true;
    }
    if (action === 'photosClear') {
      const n = photos.clear();
      pushState(room);
      return sendJson(res, 200, { ok: true, cleared: n }), true;
    }

    const ok = session.run(action, body);
    if (ok === undefined) return sendJson(res, 404, { error: 'Unknown action: ' + action }), true;
    const view = session.hostView();
    // Start the track for an intro question, without making anybody wait for
    // it. The reply goes back first and the question is already on the
    // projector — see `startIntroTrack`.
    startIntroTrack(room, view);
    return sendJson(res, 200, { ok, view }), true;
  }

  // ---- the editor
  // Check a quiz without saving it, so problems can be seen mid-edit.
  if (route === '/api/quiz/__validate' && req.method === 'POST') {
    const body = await readJson(req, 4 * 1024 * 1024);
    return sendJson(res, 200, { problems: validateQuiz(normaliseQuiz(body, body.id)) }), true;
  }

  /*
   * Advertising slides: save and delete a venue's set.
   *
   * Backed up like a quiz pack, because a venue's offer is worth having again
   * next week and losing it to a redeploy would make the feature useless as a
   * thing to sell.
   */
  if (route.startsWith('/api/advert/') && (req.method === 'PUT' || req.method === 'DELETE')) {
    const id = decodeURIComponent(route.slice('/api/advert/'.length));
    const advertRoom = roomForHost(req, url);
    if (req.method === 'DELETE') {
      try {
        deleteAdvertPack(advertRoom.paths.adverts, id);
      } catch (err) {
        return sendJson(res, 404, { error: err.message }), true;
      }
      await deleteAdvertBackup(advertRoom, id);
      return sendJson(res, 200, { ok: true }), true;
    }

    const body = await readJson(req, 512 * 1024);
    const problems = validateAdvertPack(body);
    if (problems.length) return sendJson(res, 400, { error: 'Advert set is not valid', problems }), true;
    saveAdvertPack(advertRoom.paths.adverts, id, body);
    const backup = await backUpAdverts(
      advertRoom,
      id,
      JSON.stringify(normaliseAdvertPack(body, id), null, 2) + '\n',
    );
    return sendJson(res, 200, { ok: true, backedUp: backup.ok, backupError: backup.error }), true;
  }

  // Ticking a review flag off as you read a quiz through. Deliberately its own
  // endpoint rather than part of the Save button: a tick records that YOU have
  // looked at something, and losing it because you shut the panel would mean
  // reading the same twenty flags again.
  if (route.startsWith('/api/quiz/') && route.endsWith('/checked') && req.method === 'POST') {
    const id = decodeURIComponent(route.slice('/api/quiz/'.length, -'/checked'.length));
    const body = await readJson(req, 16 * 1024);
    let quiz;
    try {
      quiz = loadQuiz(config.quizDir, id);
    } catch {
      return sendJson(res, 404, { error: 'No such quiz' }), true;
    }
    const found = setWarningChecked(quiz, String(body.questionId || ''), String(body.warning || ''), body.checked !== false);
    if (!found) return sendJson(res, 409, { error: 'That question is not in this quiz any more. Reopen it.' }), true;

    // Annotating, not editing — see saveQuiz. A broken question elsewhere in
    // the quiz must not stop you recording that you have read this one.
    saveQuiz(config.quizDir, id, quiz, { allowProblems: true });
    // Back up in the background — a tick is not worth making you wait for
    // GitHub, and the next save will carry it anyway if this one misses.
    const backup = await backUp(`quizzes/${id}.json`, JSON.stringify(normaliseQuiz(quiz, id), null, 2) + '\n', `Review notes: ${quiz.title || id}`);
    return sendJson(res, 200, { ok: true, backedUp: backup.ok, warnings: reviewWarnings(quiz) }), true;
  }

  if (route.startsWith('/api/quiz/')) {
    const id = decodeURIComponent(route.slice('/api/quiz/'.length));
    if (req.method === 'PUT') {
      const body = await readJson(req, 4 * 1024 * 1024);
      const problems = validateQuiz(body);
      if (problems.length) return sendJson(res, 400, { error: 'Quiz is not valid', problems }), true;
      /*
       * NOT A REFUSAL — a question asked once. Somebody telling the host a
       * question is wrong DURING a night is the case this whole feature
       * exists for, so blocking would break the thing it is meant to serve.
       * It asks only about the question on the screen at this exact second,
       * and only when the save actually changes it.
       */
      const clash = body.confirmLive ? null : changesTheLiveQuestion('quiz', id, body);
      if (clash) return sendJson(res, 409, { error: 'onScreenNow', live: clash }), true;
      delete body.confirmLive;
      saveQuiz(config.quizDir, id, body);
      // If a running quiz was the one just edited, pick up the changes live —
      // in every room playing it, not just the editor's own.
      reloadPackEverywhere(id);
      const backup = await backUp(`quizzes/${id}.json`, JSON.stringify(normaliseQuiz(body, id), null, 2) + '\n', `Edit quiz: ${body.title || id}`);
      return sendJson(res, 200, { ok: true, backedUp: backup.ok, backupError: backup.error }), true;
    }
    if (req.method === 'DELETE') {
      if (packInUse('quiz', id)) {
        return sendJson(res, 400, { error: 'That quiz is loaded in a game right now.' }), true;
      }
      // A pack that is not there is a 404, not a 500 with the server's own
      // filesystem path in the message. Two people deleting the same pack from
      // two consoles is the ordinary way to arrive here.
      try {
        deleteQuiz(config.quizDir, id);
      } catch {
        return sendJson(res, 404, { error: 'No such quiz' }), true;
      }
      if (githubConfigured()) await deleteFile(`quizzes/${id}.json`, `Delete quiz: ${id}`);
      return sendJson(res, 200, { ok: true }), true;
    }
  }

  if (route === '/api/quiz' && req.method === 'POST') {
    const body = await readJson(req, 4 * 1024 * 1024);
    const quizToSave = normaliseQuiz(body, body.id);
    const problems = validateQuiz(quizToSave);
    if (problems.length) return sendJson(res, 400, { error: 'Quiz is not valid', problems }), true;
    /*
     * RE-POINT ANY CUE WHOSE TRACK WAS EDITED, before it is written.
     *
     * The words and the `spotifyUri` are two halves of one fact, and the
     * editor only ever wrote the words — so a corrected track read right and
     * played the old song. See `src/recue.js`. It reads the version on disk to
     * work out what actually changed, and never fails the save.
     */
    let cued = { matched: [], missed: [], skipped: '' };
    try {
      cued = await recueQuiz(quizToSave, loadQuiz(config.quizDir, quizToSave.id));
    } catch { /* a save is never lost over a lookup */ }
    saveQuiz(config.quizDir, quizToSave.id, quizToSave);
    return sendJson(res, 200, { ok: true, id: quizToSave.id, cued }), true;
  }

  // ---- one button: theme in, playable bingo game out.
  // Generation takes a while (Claude, then a Spotify lookup per track), so
  // this streams progress lines as it goes rather than leaving the console
  // staring at a spinner with no idea whether it is working.
  if (route === '/api/generate/bingo' && req.method === 'POST') {
    if (!allowed(req, res, url, FEATURES.GENERATE)) return true;
    const body = await readJson(req);
    const stream = progressStream(res);
    const log = stream.log;
    try {
      const result = await generateBingoPack({
        config,
        theme: String(body.theme || '').slice(0, 200),
        trackCount: Math.min(90, Math.max(9, Number(body.trackCount) || 40)),
        cardSize: [3, 4, 5].includes(Number(body.cardSize)) ? Number(body.cardSize) : 4,
        avoidMonths: Math.min(24, Math.max(0, Number(body.avoidMonths ?? 3))),
        log,
        // Filed against the pack id it is going to have, so a cost always has
        // a subject — "what did the Disco pack cost" is the question that
        // decides what a pack is worth.
        onSpend: spendRecorder(spend, { packId: body.id || themeSlug(String(body.theme || '')) }),
      });
      backUpSpend();
      const backup = await backUp(
        `bingo/${result.pack.id}.json`,
        JSON.stringify(result.pack, null, 2) + '\n',
        `Add bingo pack: ${result.pack.title}`,
        log,
      );
      const history = await backUpHistory(log);
      log('DONE ' + JSON.stringify({
        id: result.pack.id,
        title: result.pack.title,
        trackCount: result.pack.tracks.length,
        playlist: result.playlist ? result.playlist.url : null,
        playlistError: result.playlistError || null,
        backedUp: backup.ok,
        // Reported separately from the pack's own backup. They can differ, and
        // when they do it is this one that matters: Claude in the browser reads
        // the pushed history to decide what NOT to pick, so a history that
        // stayed here means the next round can repeat these songs.
        historyBackedUp: history.ok,
      }));
    } catch (err) {
      log('ERROR ' + err.message);
    }
    stream.end();
    return true;
  }

  // Same shape as the bingo generator: streams progress while it works,
  // because three rounds of Claude takes the best part of a minute.
  if (route === '/api/generate/quiz' && req.method === 'POST') {
    if (!allowed(req, res, url, FEATURES.GENERATE)) return true;
    const body = await readJson(req);
    const stream = progressStream(res);
    const log = stream.log;
    try {
      // Whitelisting is roundPlan's job now, and it is done against
      // ROUND_TYPES rather than a list written out here. It WAS written out
      // here, and "multi" was added to the app months later — so the console
      // offered the round, sent it, and this quietly dropped it on the floor.
      // A quiz came back with the tickbox ignored and nothing saying why.
      //
      // Each entry may be a bare type name or { type, count }: the console
      // sends a count per round now, because "fifteen general knowledge and
      // five pictures" is a normal quiz and "ten of everything" is not.
      const asked = roundPlan(body.rounds, Number(body.perRound) || 10);
      /*
       * The topical quiz is a SHAPE, decided here rather than in the browser.
       *
       * The console sends one flag and nothing else. Twenty news, ten music,
       * ten evergreen — plus the name, which is the date, and the fortnight it
       * is worth running for — all live in generate-quiz.js, so a curl call
       * and a button press produce the same pack and there is one thing to
       * test rather than two that can drift.
       */
      const topical = Boolean(body.topical);
      const hard = Boolean(body.hard);
      const naming = topical ? topicalNaming(Date.now(), { hard }) : null;
      const rounds = topical ? TOPICAL_ROUNDS : (asked.length ? asked : ['text', 'image', 'intro']);
      const result = await generateQuizPack({
        config,
        theme: topical ? naming.theme : String(body.theme || '').slice(0, 200),
        ...(topical ? { id: naming.id, title: naming.title, freshDays: TOPICAL_DAYS } : {}),
        rounds,
        perRound: Math.min(30, Math.max(1, Number(body.perRound) || 10)),
        hard,
        // Always checked. The console deliberately offers no way to skip it —
        // an option that only ever makes the questions worse is a footgun on a
        // panel used in a hurry.
        check: true,
        log,
        onSpend: spendRecorder(spend, { packId: topical ? naming.id : (body.id || themeSlug(String(body.theme || ''))) }),
      });
      backUpSpend();
      const backup = await backUp(
        `quizzes/${result.quiz.id}.json`,
        JSON.stringify(result.quiz, null, 2) + '\n',
        `Add quiz: ${result.quiz.title}`,
        log,
      );
      /*
       * THE PICTURES ARE DRAWN AS PART OF WRITING THE QUIZ.
       *
       * *"When I make an image round I want to click one button and have 10
       * images generated with varied effects without having to faff or find
       * another button. It just needs to work."* Right — a picture round is
       * not finished until it has pictures, and leaving them behind a second
       * press on a second panel is the app knowing what you want and making
       * you ask for it.
       *
       * **IT CAN NEVER LOSE THE QUIZ.** By the time this runs the generation
       * is minutes and real money deep, and the pack is already saved and
       * backed up above. So the whole thing is wrapped: a supplier having a
       * bad morning, a missing key or a refusal leaves the pack exactly as it
       * was, with placeholder art and a line in the log saying so. Same rule
       * as the Spotify playlist, which is the last and least important step of
       * a bingo pack and used to throw away sixty resolved tracks when it
       * failed.
       *
       * The effects are already varied without anything here: a generated
       * picture round carries `reveal: 'mix'`, so the four rotate by question
       * position. That is a separate fix and this does not touch it.
       */
      let drew = null;
      if (result.needsImages && artProvider()) {
        try {
          log('Drawing the pictures…');
          const saved = loadQuiz(config.quizDir, result.quiz.id);
          /*
           * COLLECTED HERE, PUSHED ONCE BELOW — never a commit per picture.
           * Ten portraits used to be ten commits threaded in between the ten
           * Google calls, at two round trips each, which is what stopped a
           * round at seven of ten. See `putFiles`.
           */
          const drawn = [];
          const art = await generateImages({
            quiz: saved,
            imageDir: config.imageDir,
            provider: artProvider(),
            log,
            onFile: (name, bytes) => { drawn.push({ path: `images/${name}`, contents: bytes }); },
            onSpend: spendRecorder(spend, { packId: saved.id }),
          });
          await backUpMany(drawn, `Round 2 pictures: ${saved.title}`, log);
          /*
           * `generateImages` REPOINTS the pack as it goes — a pack written
           * before the shared portrait library moves onto it here — so the
           * quiz has to be saved again when it does. `allowProblems`, the same
           * as ticking a review flag: one bad question elsewhere must not stop
           * the artwork being recorded.
           */
          if ((art.repointed || []).length) {
            saveQuiz(config.quizDir, saved.id, saved, { allowProblems: true });
            await backUp(`quizzes/${saved.id}.json`, JSON.stringify(saved, null, 2) + '\n',
              `Pictures: ${saved.title}`, () => {});
          }
          backUpSpend();
          drew = { made: (art.made || []).length, reused: (art.reused || []).length, failed: art.failed || [] };
        } catch (err) {
          // Said out loud rather than swallowed: a round of placeholders that
          // nobody mentioned is the app looking like it worked.
          log('The pictures could not be drawn: ' + err.message);
          drew = { made: 0, reused: 0, failed: [], error: err.message };
        }
      }

      log('DONE ' + JSON.stringify({
        id: result.quiz.id,
        title: result.quiz.title,
        rounds: result.quiz.rounds.length,
        questionCount: result.quiz.rounds.reduce((n, r) => n + r.questions.length, 0),
        problems: result.problems,
        // What was drawn, if anything. `needsImages` stays as it was so a pack
        // whose artwork failed still says it wants some.
        drew,
        needsImages: result.needsImages,
        backedUp: backup.ok,
        checked: result.checked,
        rejected: result.rejected.length,
        unchecked: result.unchecked || [],
        // Rounds the WRITER could not fill — a different failure from the
        // checker binning things, and the one that reads as success if it is
        // not said out loud.
        short: result.short || [],
        // A topical pack only. How much of the web it read, and how long it is
        // worth running — both of which the console says on the banner.
        searches: result.searches || 0,
        sources: result.sources || [],
        freshUntil: result.freshUntil || null,
      }));
    } catch (err) {
      log('ERROR ' + err.message);
    }
    stream.end();
    return true;
  }

  /*
   * Round 2 artwork.
   *
   * Streams like the other generators, because ten real portraits is the best
   * part of a minute and you are watching money being spent.
   *
   * Each picture is backed up the moment it lands rather than all at the end:
   * if the run dies halfway, the ones already paid for are safe.
   */
  if (route === '/api/generate/images' && req.method === 'POST') {
    if (!allowed(req, res, url, FEATURES.ARTWORK)) return true;
    const body = await readJson(req);
    const stream = progressStream(res);
    const log = stream.log;
    try {
      const id = String(body.quizId || '');
      const quiz = loadQuiz(config.quizDir, id);
      /*
       * "real" means whichever supplier is actually configured, worked out
       * HERE rather than taken from the browser.
       *
       * The console used to send the literal string "openai", which made a
       * request body the thing that chose who gets billed — the same shape of
       * hole `POST /api/quiz` had, and it would have quietly kept calling a
       * dead OpenAI account after the switch to Google. The old value is still
       * accepted so a stale page in somebody's tab does not stop working.
       */
      const asked = String(body.provider || '');
      const provider = asked === 'placeholder' || !asked ? 'placeholder' : (artProvider() || 'placeholder');

      const drawn = [];
      const result = await generateImages({
        quiz,
        imageDir: config.imageDir,
        provider,
        only: String(body.only || ''),
        force: Boolean(body.force),
        style: String(body.style || ''),
        quality: String(body.quality || ''),
        log,
        // Collected, then pushed as ONE commit below — see the note at the
        // other call site and `putFiles`.
        onFile: (name, bytes) => { drawn.push({ path: `images/${name}`, contents: bytes }); },
        // Filed against the QUIZ that asked for the picture, even though the
        // portrait itself is shared. That is the honest attribution: this is
        // the pack that paid for it, and the next one to want that musician
        // gets it free — which is exactly the saving the ledger should show.
        onSpend: spendRecorder(spend, { packId: id }),
      });
      await backUpMany(drawn, `Round 2 pictures: ${quiz.title || id}`, log);
      backUpSpend();

      // Questions moved onto the shared portrait library have to be written
      // back, or the pack still points at its old per-quiz filename and the
      // sharing buys nothing. `allowProblems` for the same reason ticking a
      // review flag has it: one bad question in round 2 must not stop the
      // pictures being filed.
      if (result.repointed.length) {
        saveQuiz(config.quizDir, id, quiz, { allowProblems: true });
        log(`${result.repointed.length} question${result.repointed.length === 1 ? '' : 's'} moved onto the shared picture library`);
        reloadPackEverywhere(id, { clamp: false });
      }

      const backedUp = githubConfigured();
      if (result.made.length) {
        log(backedUp
          ? `${result.made.length} backed up to GitHub — they will survive a restart`
          : 'NOT backed up — set GITHUB_TOKEN or these vanish when the app restarts');
      }
      log('DONE ' + JSON.stringify({
        quizId: id,
        provider,
        made: result.made.length,
        skipped: result.skipped.length,
        failed: result.failed.length,
        reused: result.skipped.length,
        style: result.style,
        quality: result.quality,
        status: imageStatus(quiz, config.imageDir),
        backedUp,
      }));
    } catch (err) {
      log('ERROR ' + err.message);
    }
    stream.end();
    return true;
  }

  /*
   * The playlist for a "name that intro" round, built after the fact.
   *
   * You can easily have an intro round before you have a Spotify login, and a
   * playlist deleted by accident should not mean regenerating the quiz and
   * getting different questions. So this is its own button rather than only
   * something that happens once, during generation.
   */
  if (route === '/api/playlist/intro' && req.method === 'POST') {
    const body = await readJson(req);
    const stream = progressStream(res);
    const log = stream.log;
    try {
      const id = String(body.quizId || '');
      const quiz = loadQuiz(config.quizDir, id);
      const results = await buildIntroPlaylists({ quiz, log });

      // The lookups rewrote the cues with Spotify's spelling and uris, so the
      // pack has to be saved or the control view still points at the guesses.
      saveQuiz(config.quizDir, id, quiz);
      reloadPackEverywhere(id, { clamp: false });
      const backup = await backUp(`quizzes/${id}.json`, JSON.stringify(normaliseQuiz(quiz, id), null, 2) + '\n', `Intro playlist: ${quiz.title}`, log);

      /*
       * Carry the FAILURES through, not just the successes.
       *
       * `buildIntroPlaylists` catches a per-round problem and returns a null
       * playlist with the reason on it, so filtering to the ones that worked
       * threw the reason away and reported `playlists: []` — a success
       * envelope with nothing in it. A Spotify 403 then looked exactly like a
       * quiz with no tracks, and the only account of what went wrong was a log
       * line the console tore down a moment later.
       *
       * That is the "failure messages have to name the cause" rule, and this
       * is the one place it had been missed.
       */
      log('DONE ' + JSON.stringify({
        quizId: id,
        playlists: results.filter((r) => r.playlist).map((r) => ({ round: r.round, url: r.playlist.url, missing: r.playlist.missing })),
        failed: results.filter((r) => !r.playlist).map((r) => ({
          round: r.round,
          // No error means the lookups simply found nothing to put in it.
          error: r.error || 'none of its tracks could be found on Spotify',
        })),
        backedUp: backup.ok,
      }));
    } catch (err) {
      log('ERROR ' + err.message);
    }
    stream.end();
    return true;
  }

  // Bring in a track list you already have — a Spotify playlist you built, or
  // one Claude made for you in a browser. Streams like the generators do.
  if (route === '/api/import/bingo' && req.method === 'POST') {
    const body = await readJson(req, 512 * 1024);
    const stream = progressStream(res);
    const log = stream.log;
    try {
      const result = await importBingoPack({
        config,
        playlistUrl: String(body.playlistUrl || ''),
        text: String(body.text || ''),
        title: String(body.title || '').slice(0, 80) || undefined,
        cardSize: [3, 4, 5].includes(Number(body.cardSize)) ? Number(body.cardSize) : 4,
        avoidMonths: Math.min(24, Math.max(0, Number(body.avoidMonths ?? 0))),
        log,
      });
      const backup = await backUp(
        `bingo/${result.pack.id}.json`,
        JSON.stringify(result.pack, null, 2) + '\n',
        `Import bingo pack: ${result.pack.title}`,
        log,
      );
      // The import writes every track into the no-repeats history too, so that
      // has to survive the next restart just as it does when generating.
      const history = await backUpHistory(log);
      log('DONE ' + JSON.stringify({
        id: result.pack.id,
        title: result.pack.title,
        trackCount: result.pack.tracks.length,
        playlist: result.playlist ? result.playlist.url : null,
        playlistError: result.playlistError || null,
        backedUp: backup.ok,
        // Reported separately from the pack's own backup. They can differ, and
        // when they do it is this one that matters: Claude in the browser reads
        // the pushed history to decide what NOT to pick, so a history that
        // stayed here means the next round can repeat these songs.
        historyBackedUp: history.ok,
      }));
    } catch (err) {
      log('ERROR ' + err.message);
    }
    stream.end();
    return true;
  }

  if (route === '/api/history/forget' && req.method === 'POST') {
    forgetAll(config.dataDir);
    return sendJson(res, 200, { ok: true }), true;
  }

  // ---- bingo packs, same shape as the quiz endpoints
  if (route === '/api/bingo/__validate' && req.method === 'POST') {
    const body = await readJson(req, 4 * 1024 * 1024);
    return sendJson(res, 200, { problems: validateBingoPack(normaliseBingoPack(body, body.id)) }), true;
  }

  if (route.startsWith('/api/bingo/') && req.method === 'DELETE') {
    const id = decodeURIComponent(route.slice('/api/bingo/'.length));
    if (packInUse('bingo', id)) {
      return sendJson(res, 400, { error: 'That pack is loaded in a game right now. Launch something else first.' }), true;
    }
    try {
      deleteBingoPack(config.bingoDir, id);
      if (githubConfigured()) await deleteFile(`bingo/${id}.json`, `Delete bingo pack: ${id}`);
      return sendJson(res, 200, { ok: true }), true;
    } catch (err) {
      return sendJson(res, 404, { error: err.message }), true;
    }
  }

  if (route.startsWith('/api/bingo/') && req.method === 'PUT') {
    const id = decodeURIComponent(route.slice('/api/bingo/'.length));
    const body = await readJson(req, 4 * 1024 * 1024);
    const pack = normaliseBingoPack(body, id);
    const problems = validateBingoPack(pack);
    if (problems.length) return sendJson(res, 400, { error: 'Bingo pack is not valid', problems }), true;
    saveBingoPack(config.bingoDir, id, pack);
    const backup = await backUp(`bingo/${id}.json`, JSON.stringify(pack, null, 2) + '\n', `Edit bingo pack: ${pack.title || id}`);
    return sendJson(res, 200, { ok: true, backedUp: backup.ok, backupError: backup.error }), true;
  }

  if (route === '/api/bingo' && req.method === 'POST') {
    const body = await readJson(req, 4 * 1024 * 1024);
    const pack = normaliseBingoPack(body, body.id);
    const problems = validateBingoPack(pack);
    if (problems.length) return sendJson(res, 400, { error: 'Bingo pack is not valid', problems }), true;
    saveBingoPack(config.bingoDir, pack.id, pack);
    return sendJson(res, 200, { ok: true, id: pack.id }), true;
  }

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

  if (!accounts.all.length) {
    console.log('');
    console.log('  No accounts yet. The host key above is the way in, and it can');
    console.log('  make the first owner from the Console — everything else about');
    console.log('  accounts is owner-only once that exists.');
  }
  console.log('');
});

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
  // Never take the quiz down over one bad request. Log it and carry on.
  console.error('[server] uncaught:', err);
  for (const room of rooms.all()) room.store.flush();
});

export { server, rooms };
