/**
 * THE CONTEXT — what `server.js` used to hold at the top: every import the
 * routes need, and the singletons (the hub, the accounts book, the rooms).
 *
 * `server.js` was 9,600 lines and is a shell now, the way `console.js` is:
 * the routes live in `src/http/get-*.js` and `write-*.js`, the helpers in
 * the modules beside them, and THIS is the leaf they all import — it imports
 * nothing from `src/http/` itself, so nothing here can read a binding in its
 * temporal dead zone. The same reason `console-state.js` imports nothing.
 *
 * THE ROOMS REGISTRY IS BUILT WITH LATE-BOUND HOOKS. `Rooms` needs to push
 * state, back up an archive and back up the code book — three functions
 * defined in modules that import THIS one. Reaching back for them would be
 * the circular import; so they are looked up on `hooks` when a room calls
 * them, and each module sets its own the moment it loads.
 */


import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

import { config, paths, hostKey, hostKeyIsTemporary } from '../config.js';
import { looksBreached, BREACHED_SAID } from '../breached.js';
import { Store } from '../store.js';
import { Hub } from '../sse.js';
import {
  Photos, MAX_BYTES, extensionFor, showsOnGallery, showsByDefault, photoSource, galleryPhotosOf,
  coverPhotos, sniffType, nightOf,
} from '../photos.js';

/** How many photographs the fanned pile on a night's card shows. */
export const COVER_PHOTOS = 3;
import { Session, wholePackKind, packlessKind } from '../session.js';
import { saveQuiz, deleteQuiz, validateQuiz, normaliseQuiz, loadQuiz, reviewWarnings, setWarningChecked, ROUND_TYPES } from '../quizzes.js';
import { recueQuiz } from '../recue.js';
import { validateBingoPack, normaliseBingoPack, minimumTracks, CARD_SHAPES, shapeLabel, maxPrizes, defaultPrizes, stagePlan, stageLabel } from '../bingo.js';
import { fullLibrary, listArchive, venuesUsed, rewardsUsed, rewardsByVenue, serialiseArchive, restoreArchive, saveBingoPack, loadBingoPack, deleteBingoPack, readStats, statsReadable } from '../library.js';
import { findInArchive, redeemInArchive } from '../wallet.js';
import { generateBingoPack } from '../generate-bingo.js';
import { generateQuizPack, buildIntroPlaylists, claudeAsker, roundPlan, TOPICAL_ROUNDS, TOPICAL_DAYS, topicalNaming } from '../generate-quiz.js';
import { portraitPath } from '../portraits.js';
import { importBingoPack } from '../import-bingo.js';
import { importIntroRound } from '../import-intro.js';
import { listAdvertPacks, loadAdvertPack, saveAdvertPack, deleteAdvertPack, validateAdvertPack, normaliseAdvertPack, safeAdvertFile } from '../adverts.js';
import {
  generateImages, imageStatus, imageJobs, imagePlan,
  openaiConfigured, googleConfigured, artProvider, portraitLibrary,
} from '../generate-images.js';
import { STYLES, findStyle, QUALITIES, DEFAULT_QUALITY } from '../portraits.js';
import { recentTracks, forgetAll } from '../history.js';
import { spotifyConfigured, missingSpotifyConfig, playTrack, searchTracks } from '../spotify.js';
import { photoFolder, mergeGigs, safePhotoName, isNightFolder, nightOfGig, venueKeyOf, sameVenue, setNightVenue, noteNightVenue } from '../past-gigs.js';
import { venueHeadcounts, nightHeadcount } from '../headcounts.js';
import { galleryNumbers, bookingOf } from '../gallery-about.js';
import { playedByVenue } from '../heard.js';
import { nightReportPdf, nightReportFilename } from '../report-pdf.js';
import { leaguesByVenue, leagueAfter, teamKey } from '../league.js';
import {
  galleryPath, matchNightSlug, readVenuePath, venueSlug, sameVenueSlug,
} from '../../public/assets/slugs.js';
import { comeBackFor, nextNightAt, comeBackText } from '../comeback.js';
import { isComposed, MAX_ROUNDS } from '../running-order.js';
import { applyBilling, billingEmail } from '../billing.js';
import { PropUse, ENOUGH_TO_JUDGE } from '../prop-use.js';
import { moderationConfigured, scorePhoto } from '../moderation.js';
import { photoFlags, setPhotoFlag, flagKey } from '../photo-flags.js';
import { Flight } from '../flight.js';
// The prop list, shared with the phone exactly like schemes and break-parts —
// so the tally and the tray can never disagree about which props exist.
import { STICKERS } from '../../public/assets/stickers.js';
/*
 * The soundboard's own list, shared with the projector for the same reason.
 * **A sting id is one word in a request body**, which is the shape of trap
 * this file already records for pack ids and tier names, so the list the
 * browser draws from IS the list the route validates against.
 */
import { isSting } from '../../public/assets/stings.js';
/*
 * The fifty-two cards, so the artwork folder can be read against the ids the
 * game itself mints rather than against whatever somebody named a file.
 */
import { DECK } from '../../public/assets/deck.js';

/**
 * How long a pressed sting stays in the projector's payload.
 *
 * Long enough that a push already in flight, or a projector a second behind,
 * still gets it; short enough that a screen opened late never plays a noise
 * the room has forgotten. Four seconds is the longest sting (the drum roll)
 * plus room to spare.
 */
export const STING_TTL_MS = 4000;
import {
  checkoutSession, packCheckoutSession, portalSession, sellableTiers, stripeConfigured,
  toBillingEvent, toPackPurchase, verifySignature, webhookSecret,
} from '../stripe.js';
import { listShows, saveShow, deleteShow, showProblems } from '../shows.js';
import { pickIdeas, ideaLabel } from '../round-ideas.js';
import { getFile, tryGetFile, listDir, tryListDir, listDirs, githubConfigured, missingGithubConfig, putFile, putFiles, deleteFile, checkAccess, photosRepoConfigured, photosRepoName, missingPhotoConfig, photoRepoProblem, privateRepoConfigured, packsRepoConfigured, packsRepoName } from '../github.js';
import { Invoices, totals, toPence, money } from '../invoices.js';
import { invoicePdf, invoiceFilename } from '../invoice-pdf.js';
import { toSvg } from '../qrcode.js';
import { LOOKS } from '../../public/assets/looks.js';
import { cueOffsetMs } from '../../public/assets/cue.js';
import { Accounts, safe } from '../accounts.js';
import { Reports } from '../reports.js';
import { randomBytes } from 'node:crypto';
import { Rooms, HOUSE, GALLERY_NONE, tidyCode } from '../rooms.js';
// The one proof a phone has. Same rule as answering: an id is not a
// credential, the token is — see rule 3.
import { ownsPlayer, PHASES } from '../engine.js';
import { upcoming } from '../../public/assets/diary.js';
import { calendarIcs } from '../ics.js';
import { FEATURES, TIERS, TIER_PACKS, tierFor, whyNot, entitlements, packsFor, packFilter, canPlayPack, can, switchedOn, PAYING, PACK_PENCE, TRIAL_DAYS, REFERRAL_BONUS_DAYS } from '../../public/assets/plans.js';
import { lobbyGameFor, lobbyGamesFor, ANY_LOBBY_GAME } from '../../public/assets/lobby-games.js';
import { hostCursor, MOVES as HOST_MOVES } from '../../public/assets/host-cursor.js';
import {
  publishedNights, isPublished, setPublished, postedNights, isPosted, setPosted, readableNight,
  photoDecisions, photoKey, setPhotoDecision, photoPins, setPhotoPin, MAX_PINS,
} from '../gallery.js';
import {
  publishedVenues, setVenuePublished, nameDecisions, setNameDecision,
  leaguesRunning, setLeagueRunning, isVenueKey,
} from '../league-publish.js';
import { publicTable, publicName, isCleanForPublic } from '../clean-names.js';
import {
  sendEmail, emailConfigured, emailProvider, keepKeyAlive, resetEmail, magicEmail, welcomeEmail,
  trialEndingEmail, trialEndedEmail,
} from '../email.js';
import { dueWarning, dueEnded, daysLeft, WARN_DAYS } from '../trials.js';
import { Suggestions, KINDS, PACK_REQUEST_KIND } from '../suggestions.js';
import { Spend, spendRecorder, imagePrices } from '../spend.js';
// The pack id a generation is going to produce, so a cost has a subject from
// the moment it is spent rather than only once the pack lands.
import { themeSlug } from '../theme.js';
import { draftReply, briefFor, mostlyMine } from '../reply-draft.js';
import { CHECKS_ONLY, OWNER_ONLY, changesTheLibrary } from '../gates.js';
import { listOwn, readPack, saveOwn, deleteOwn, isOwnPack, inCatalogue, countOwn, backupPath, MAX_OWN } from '../own-packs.js';
import { brandFor } from '../branding.js';
// Picture bytes, held briefly so the fiftieth person to open one night does not
// spend a fiftieth page's worth of GitHub calls on it — see the file's own note.
import {
  cachedPhoto, keepPhoto, dropPhoto, cachedNight, keepNight, dropNight,
  diskPhoto, keepPhotoOnDisk, dropPhotoFromDisk,
} from '../photo-cache.js';
import { findScheme, DEFAULT_SCHEME, SCHEMES } from '../../public/assets/schemes.js';
// The logo, shared with the browser so the tab icon and the on-screen mark are
// one drawing rather than two that look alike today.
import { faviconSvg } from '../../public/assets/brandmark.js';

export const hooks = {};

export const HOST_KEY = hostKey();
export const hub = new Hub();
export const accounts = new Accounts(paths.accounts);
// Corrections on a question, from whoever was running it. Global rather than
// per-room: the packs are shared, so a fault Rob finds is a fault in the pack.
export const reports = new Reports(paths.reports);
export const suggestions = new Suggestions(paths.suggestions);
/*
 * What Claude and OpenAI have actually cost.
 *
 * Global rather than per room, because generating is the OWNER's — a
 * quizmaster never spends this money, which is the whole arrangement. It is a
 * business record like the invoice book, so it backs up to the private repo
 * and comes back only into an empty ledger.
 */
export const spend = new Spend(paths.spend);
/*
 * WHICH PROPS PEOPLE ACTUALLY REACH FOR — two integers each, global, never a
 * log. It answers "is this drawing worth keeping" with evidence rather than a
 * guess, and it is what makes the tray's popularity weighting safe: see
 * `src/prop-use.js` for why a count of uses alone would have been a feedback
 * loop that lied.
 */
export const propUse = new PropUse(paths.propUse);
/*
 * THE FLIGHT RECORDER — see `src/flight.js`. Built here so it exists before
 * any route or room does, and wrapping the console from this moment so every
 * `[backup]`/`[trials]`/`[http]` line the app prints is already an entry.
 * The tail of the last run is read back first: a crash's final lines are the
 * ones worth having after the restart that follows it.
 */
export const flight = new Flight(path.join(config.dataDir, 'flight.jsonl')).load();
flight.captureConsole();

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
export const rooms = new Rooms({
  config,
  paths,
  onPush: (room) => hooks.pushState(room),
  // A night has just been filed. Keep it, or the record of somebody's gigs
  // lasts exactly until the next deploy. Never awaited — see backUpArchive.
  onArchive: (room) => {
    /*
     * NEVER AWAITED — a night ends while the projector is showing a scoreboard
     * and nobody is waiting on the server. But the `.catch()` here swallowed a
     * THROW for six weeks while every backup was failing, so it says so now:
     * `backUpArchive` warns for itself, and this covers the one case it cannot
     * (never being wired at all, which would be a TypeError nobody would see).
     */
    Promise.resolve()
      .then(() => hooks.backUpArchive(room))
      .catch((err) => console.warn('[backup] a night was NOT backed up:', err.message));
  },
  // A join code has been minted. Keep it, or a quizmaster's printed QR sends a
  // room to a game that does not exist after the next deploy.
  onCodes: (serialised) => hooks.backUpCodesSoon(serialised),
});
rooms.get(HOUSE);

export { http, fs, path, config, paths, hostKey, hostKeyIsTemporary, looksBreached, BREACHED_SAID, Store, Hub, Photos, MAX_BYTES, extensionFor, showsOnGallery, showsByDefault, photoSource, galleryPhotosOf, coverPhotos, sniffType, nightOf, Session, wholePackKind, packlessKind, saveQuiz, deleteQuiz, validateQuiz, normaliseQuiz, loadQuiz, reviewWarnings, setWarningChecked, ROUND_TYPES, recueQuiz, validateBingoPack, normaliseBingoPack, minimumTracks, CARD_SHAPES, shapeLabel, maxPrizes, defaultPrizes, stagePlan, stageLabel, fullLibrary, listArchive, venuesUsed, rewardsUsed, rewardsByVenue, serialiseArchive, restoreArchive, saveBingoPack, loadBingoPack, deleteBingoPack, readStats, statsReadable, findInArchive, redeemInArchive, generateBingoPack, generateQuizPack, buildIntroPlaylists, claudeAsker, roundPlan, TOPICAL_ROUNDS, TOPICAL_DAYS, topicalNaming, portraitPath, importBingoPack, importIntroRound, listAdvertPacks, loadAdvertPack, saveAdvertPack, deleteAdvertPack, validateAdvertPack, normaliseAdvertPack, safeAdvertFile, generateImages, imageStatus, imageJobs, imagePlan, openaiConfigured, googleConfigured, artProvider, portraitLibrary, STYLES, findStyle, QUALITIES, DEFAULT_QUALITY, recentTracks, forgetAll, spotifyConfigured, missingSpotifyConfig, playTrack, searchTracks, photoFolder, mergeGigs, safePhotoName, isNightFolder, nightOfGig, venueKeyOf, sameVenue, setNightVenue, noteNightVenue, venueHeadcounts, nightHeadcount, galleryNumbers, bookingOf, playedByVenue, nightReportPdf, nightReportFilename, leaguesByVenue, leagueAfter, teamKey, galleryPath, matchNightSlug, readVenuePath, venueSlug, sameVenueSlug, comeBackFor, nextNightAt, comeBackText, isComposed, MAX_ROUNDS, applyBilling, billingEmail, PropUse, ENOUGH_TO_JUDGE, STICKERS, isSting, DECK, checkoutSession, packCheckoutSession, portalSession, sellableTiers, stripeConfigured, toBillingEvent, toPackPurchase, verifySignature, webhookSecret, listShows, saveShow, deleteShow, showProblems, pickIdeas, ideaLabel, getFile, tryGetFile, listDir, tryListDir, listDirs, githubConfigured, missingGithubConfig, putFile, putFiles, deleteFile, checkAccess, photosRepoConfigured, photosRepoName, missingPhotoConfig, photoRepoProblem, privateRepoConfigured, packsRepoConfigured, packsRepoName, Invoices, totals, toPence, money, invoicePdf, invoiceFilename, toSvg, LOOKS, cueOffsetMs, Accounts, safe, Reports, randomBytes, Rooms, HOUSE, GALLERY_NONE, tidyCode, ownsPlayer, PHASES, upcoming, calendarIcs, FEATURES, TIERS, TIER_PACKS, tierFor, whyNot, entitlements, packsFor, packFilter, canPlayPack, can, switchedOn, PAYING, PACK_PENCE, TRIAL_DAYS, REFERRAL_BONUS_DAYS, lobbyGameFor, lobbyGamesFor, ANY_LOBBY_GAME, hostCursor, HOST_MOVES, publishedNights, isPublished, setPublished, postedNights, isPosted, setPosted, readableNight, photoDecisions, photoKey, setPhotoDecision, photoPins, setPhotoPin, MAX_PINS, publishedVenues, setVenuePublished, nameDecisions, setNameDecision, leaguesRunning, setLeagueRunning, isVenueKey, publicTable, publicName, isCleanForPublic, sendEmail, emailConfigured, emailProvider, keepKeyAlive, resetEmail, magicEmail, welcomeEmail, trialEndingEmail, trialEndedEmail, dueWarning, dueEnded, daysLeft, WARN_DAYS, Suggestions, KINDS, PACK_REQUEST_KIND, Spend, spendRecorder, imagePrices, themeSlug, draftReply, briefFor, mostlyMine, CHECKS_ONLY, OWNER_ONLY, changesTheLibrary, listOwn, readPack, saveOwn, deleteOwn, isOwnPack, inCatalogue, countOwn, backupPath, MAX_OWN, brandFor, cachedPhoto, keepPhoto, dropPhoto, cachedNight, keepNight, dropNight, diskPhoto, keepPhotoOnDisk, dropPhotoFromDisk, findScheme, DEFAULT_SCHEME, SCHEMES, faviconSvg, moderationConfigured, scorePhoto, photoFlags, setPhotoFlag, flagKey };
