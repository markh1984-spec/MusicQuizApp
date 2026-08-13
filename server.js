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
import { Photos, MAX_BYTES } from './src/photos.js';
import { Session } from './src/session.js';
import { saveQuiz, deleteQuiz, validateQuiz, normaliseQuiz, loadQuiz, reviewWarnings, setWarningChecked, ROUND_TYPES } from './src/quizzes.js';
import { validateBingoPack, normaliseBingoPack, minimumTracks, CARD_SHAPES, shapeLabel, maxPrizes, stagePlan, stageLabel } from './src/bingo.js';
import { fullLibrary, listArchive, venuesUsed, rewardsUsed, rewardsByVenue, loadArchived, serialiseArchive, restoreArchive, saveBingoPack, loadBingoPack, deleteBingoPack, readStats } from './src/library.js';
import { generateBingoPack } from './src/generate-bingo.js';
import { generateQuizPack, buildIntroPlaylists, roundPlan, TOPICAL_ROUNDS, TOPICAL_DAYS, topicalNaming } from './src/generate-quiz.js';
import { importBingoPack } from './src/import-bingo.js';
import { listAdvertPacks, loadAdvertPack, saveAdvertPack, deleteAdvertPack, validateAdvertPack, normaliseAdvertPack, safeAdvertFile } from './src/adverts.js';
import {
  generateImages, imageStatus, imageJobs, imagePlan,
  openaiConfigured, googleConfigured, artProvider, portraitLibrary,
} from './src/generate-images.js';
import { STYLES, findStyle, QUALITIES, DEFAULT_QUALITY } from './src/portraits.js';
import { recentTracks, forgetAll } from './src/history.js';
import { spotifyConfigured, missingSpotifyConfig, playTrack } from './src/spotify.js';
import { photoFolder, mergeGigs, safePhotoName, isNightFolder } from './src/past-gigs.js';
import { getFile, listDir, listDirs, githubConfigured, missingGithubConfig, putFile, deleteFile, checkAccess, photosRepoConfigured, photosRepoName, missingPhotoConfig, photoRepoProblem, privateRepoConfigured, packsRepoConfigured, packsRepoName } from './src/github.js';
import { Invoices, totals, toPence, money } from './src/invoices.js';
import { invoicePdf, invoiceFilename } from './src/invoice-pdf.js';
import { toSvg } from './src/qrcode.js';
import { LOOKS } from './public/assets/looks.js';
import { Accounts } from './src/accounts.js';
import { Reports } from './src/reports.js';
import { randomBytes } from 'node:crypto';
import { Rooms, HOUSE, tidyCode } from './src/rooms.js';
import { FEATURES, TIERS, TIER_PACKS, tierFor, whyNot, entitlements, packsFor, packFilter, canPlayPack, can, switchedOn, PACK_PENCE } from './public/assets/plans.js';
import { sendEmail, emailConfigured, emailProvider, keepKeyAlive, resetEmail } from './src/email.js';
import { Suggestions, KINDS, PACK_REQUEST_KIND } from './src/suggestions.js';
import { Spend, spendRecorder, imagePrices } from './src/spend.js';
// The pack id a generation is going to produce, so a cost has a subject from
// the moment it is spent rather than only once the pack lands.
import { themeSlug } from './src/theme.js';
import { draftReply, briefFor, mostlyMine } from './src/reply-draft.js';
import { OWNER_ONLY, changesTheLibrary } from './src/gates.js';
import { listOwn, readPack, saveOwn, deleteOwn, isOwnPack, countOwn, backupPath, MAX_OWN } from './src/own-packs.js';
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
 */
const introPlayed = new Map();
function startIntroTrack(room, view) {
  const uri = view && view.phase === 'question' && view.question
    && view.question.cue && view.question.cue.spotifyUri;
  if (!uri || !spotifyConfigured()) return;

  // Once per question. `run` is called for every host action, and a Back and a
  // Next landing on the same question must not start it over.
  const at = `${room.id}:${view.roundIndex}:${view.questionIndex}`;
  if (introPlayed.get(room.id) === at) return;
  introPlayed.set(room.id, at);

  playTrack(uri).then((result) => {
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
        return { ...wearing, previewTier: preview, tier: preview, comped: false, status: 'active' };
      }
      return wearing;
    }
  }
  return account;
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
  if (route === '/host') return serveFile(res, config.publicDir, 'host.html'), true;
  if (route === '/editor') return serveFile(res, config.publicDir, 'editor.html'), true;
  if (route === '/console') return serveFile(res, config.publicDir, 'console.html'), true;
  if (route === '/login') return serveFile(res, config.publicDir, 'login.html'), true;
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
      account: { ...account, entitlements: entitlements(account) },
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
   * Whose night is this, and what does it look like.
   *
   * Open, because the join page needs it before anybody has joined — and it
   * answers for the ROOM the caller reached for, so a phone that scanned Rob's
   * projector gets Rob's name and Rob's colours without signing in to anything.
   * The console asks with `role=host` to get its own instead.
   */
  if (route === '/api/brand') {
    const room = url.searchParams.get('role') === 'host'
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
      archiveNights: mergeGigs(listArchive(roomForHost(req, url).paths.archive), []).length,
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
        .map((c) => ({ id: c.id, name: c.name, rewards: Array.isArray(c.rewards) ? c.rewards : [] })),
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
    try {
      return sendJson(res, 200, loadAdvertPack(roomForHost(req, url).paths.adverts, id)), true;
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
    return sendJson(res, 200, {
      nights: mergeGigs(listArchive(gigRoom.paths.archive), folders.map((f) => f.name)),
      // So the page can say why there are no pictures against an old night,
      // rather than implying nobody took any.
      photosKept: photosRepoConfigured(),
    }), true;
  }

  if (route.startsWith('/api/past-gigs/')) {
    if (!allowed(req, res, url, FEATURES.PAST_GIGS)) return true;
    const night = decodeURIComponent(route.slice('/api/past-gigs/'.length));
    if (!isNightFolder(night)) return sendJson(res, 404, { error: 'No night with that date.' }), true;
    const gigRoom = roomForHost(req, url);
    const files = photosRepoConfigured()
      ? await listDir(`${photoFolder(gigRoom.id)}/${night}`, 'photos')
      : [];
    return sendJson(res, 200, {
      night,
      photos: files
        .map((f) => safePhotoName(f.name))
        .filter(Boolean)
        // Served back through this server, because the photo repository is
        // private and a browser cannot fetch from it.
        .map((name) => ({ name, url: `/past-photo/${night}/${name}` })),
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
function invoiceState(books) {
  return {
    settings: books.settings,
    customers: books.customers,
    invoices: books.invoices.map(withTotals),
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
    if (session.kind !== 'quiz' || session.pack?.id !== id) continue;
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
function packInUse(kind, id, onlyRoom = null) {
  const where = onlyRoom ? [onlyRoom] : rooms.all();
  return where.some((r) => r.session.kind === kind && r.session.pack?.id === id);
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

    const base = (config.publicUrl || '').replace(/\/+$/, '')
      || `${(req.headers['x-forwarded-proto'] || 'https').split(',')[0].trim()}://${req.headers.host}`;
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
   * on the record — see `setRewards` for why that matters.
   */
  if (route.startsWith('/api/invoices/customers/') && route.endsWith('/rewards') && req.method === 'PUT') {
    if (!allowed(req, res, url, FEATURES.INVOICES)) return true;
    const room = roomForHost(req, url);
    const id = decodeURIComponent(route.slice('/api/invoices/customers/'.length, -'/rewards'.length));
    const body = await readJson(req);
    const saved = room.invoices.setRewards(id, body.rewards);
    if (!saved) return sendJson(res, 404, { error: 'No venue with that id.' }), true;
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
  if (['/api/answer', '/api/mark', '/api/claim', '/api/wandered', '/api/say', '/api/team'].includes(route) && req.method === 'POST') {
    const body = await readJson(req);
    const action = route.slice('/api/'.length);
    const result = roomForPhone(req, url, body).session.runPlayerAction(action, body);
    // 200 either way: the phone shows its own feedback, and a rejected action
    // is a normal thing (too late, already answered), not an error.
    return sendJson(res, 200, result), true;
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
  if (route === '/api/mine/quiz' && req.method === 'POST') {
    if (!allowed(req, res, url, FEATURES.OWN_PACKS)) return true;
    const room = roomForHost(req, url);
    const body = await readJson(req, 4 * 1024 * 1024);
    const quiz = normaliseQuiz(body, body.id);
    const problems = validateQuiz(quiz);
    if (problems.length) return sendJson(res, 400, { error: 'Quiz is not valid', problems }), true;
    try {
      saveOwn('quiz', quiz.id, quiz, { config, paths: room.paths });
    } catch (err) {
      return sendJson(res, 400, { error: err.message }), true;
    }
    // If they were playing it, pick the edit up live — same as the catalogue.
    reloadPackEverywhere(quiz.id);
    const backup = await backUpOwnPack(room, 'quiz', quiz.id, JSON.stringify(quiz, null, 2) + '\n');
    return sendJson(res, 200, {
      ok: true, id: quiz.id, backedUp: backup.ok, backupError: backup.error,
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
    const body = await readJson(req, 512 * 1024);
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
      const ownPack = isOwnPack(launchKind, String(body.packId), room.paths);
      if (!ownPack && !canPlayPack(whoIs(req, url), String(body.packId), packDating(launchKind, body.packId, room))) {
        return sendJson(res, 403, {
          error: 'That pack is not in your library.',
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
        // Whether anybody is in the room. Same shape of decision again: the
        // pack does not know, and tonight does.
        const online = Boolean(body.online);
        // Several phones, one team, scores averaged. Also a fact about tonight.
        const teamPlay = Boolean(body.teamPlay);
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
        const onFile = named
          ? (room.invoices.customers.find((c) => String(c.name || '').trim().toLowerCase() === named) || {}).rewards
          : null;
        const rewards = Array.isArray(body.rewards) ? body.rewards.map(String)
          : (body.reward ? [String(body.reward)] : (Array.isArray(onFile) ? onFile : []));
        const started = session.launch(String(body.game || 'quiz'), String(body.packId), { shape, prizes, look, online, teamPlay, venue, rewards });
        // Never awaited: a host pressing Launch with a room waiting does not
        // care whether GitHub is having a good day.
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
    saveQuiz(config.quizDir, quizToSave.id, quizToSave);
    return sendJson(res, 200, { ok: true, id: quizToSave.id }), true;
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
      log('DONE ' + JSON.stringify({
        id: result.quiz.id,
        title: result.quiz.title,
        rounds: result.quiz.rounds.length,
        questionCount: result.quiz.rounds.reduce((n, r) => n + r.questions.length, 0),
        problems: result.problems,
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

      const result = await generateImages({
        quiz,
        imageDir: config.imageDir,
        provider,
        only: String(body.only || ''),
        force: Boolean(body.force),
        style: String(body.style || ''),
        quality: String(body.quality || ''),
        log,
        onFile: async (name, bytes) => {
          await backUp(`images/${name}`, bytes, `Round 2 picture: ${name}`, () => {});
        },
        // Filed against the QUIZ that asked for the picture, even though the
        // portrait itself is shared. That is the honest attribution: this is
        // the pack that paid for it, and the next one to want that musician
        // gets it free — which is exactly the saving the ledger should show.
        onSpend: spendRecorder(spend, { packId: id }),
      });
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
