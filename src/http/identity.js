/**
 * COOKIES, WHO IS ASKING, AND WHICH ROOM — whoIs(), roomForHost(), roomForPhone(). Moved whole from server.js, plus three helpers that were declared inside the route handlers and used by more than one family (offerRoomId, refuseBreached, postALink): none closes over a handler local, so they lift unchanged.
 */
import { BREACHED_SAID, DEFAULT_SCHEME, GALLERY_NONE, HOUSE, PACK_PENCE, TIERS, TIER_PACKS, accounts, brandFor, cachedNight, cachedPhoto, canPlayPack, config, diskPhoto, emailConfigured, entitlements, findScheme, galleryPath, getFile, http, isOwnPack, keepNight, keepPhoto, keepPhotoOnDisk, lobbyGamesFor, looksBreached, nightOf, packFilter, packsFor, path, paths, readPack, rooms, safe, sendEmail, tidyCode, tierFor, tryListDir } from './context.js';
import { isHostKey, sendJson } from './plumbing.js';
import { BOOTSTRAP } from './gates.js';
import { backUpAccounts, galleryRoomOf, publicRoomId } from './helpers.js';

export const SESSION_COOKIE = 'mmm_session';

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
export const ACTING_COOKIE = 'mmm_acting';

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
export const TIER_COOKIE = 'mmm_tier';

/** One cookie, with the same rules as the session one. */
export function cookieFor(req, name, value, days = 30) {
  const secure = (req.headers['x-forwarded-proto'] || '').split(',')[0].trim() === 'https';
  return [
    `${name}=${encodeURIComponent(value)}`,
    'Path=/', 'HttpOnly', 'SameSite=Lax', `Max-Age=${days * 86400}`,
    ...(secure ? ['Secure'] : []),
  ].join('; ');
}

/** One cookie out of a header, without pulling in a parser. */
export function cookie(req, name) {
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
export function whoIs(req, url) {
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
    /*
     * `safe()`, BECAUSE `find()` HANDS BACK THE STORED RECORD AND `fromToken()`
     * DOES NOT — and this branch was the one place that used the first.
     *
     * Every ordinary request comes through `fromToken()`, which strips the
     * password hash, the salt, the scrypt parameters, the calendar key and any
     * live reset token before anything downstream sees them. Wearing a hat
     * went round it: `{ ...hat }` spread the raw account into `whoIs()`, so
     * `GET /api/me` — which spreads the account straight into its reply —
     * handed back **hash, salt and scrypt**. Reproduced end to end over HTTP.
     *
     * The support case is the bad one: an owner inside a subscriber's account
     * with the door open was being given that subscriber's password hash to
     * take away. `test/support-access.test.js` is 99 regexes over this file
     * and could not see it, which is the whole reason a guard has to make the
     * request.
     *
     * Nothing downstream wants those fields. The calendar key already has to
     * be re-read from the book by `/api/calendar/link`, precisely because
     * `fromToken()` has always stripped it.
     */
    const hat = safe(accounts.find(actingId));
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
export function summarise(account) {
  if (!account) return null;
  return { id: account.id, role: account.role, name: account.name || '', email: account.email || '' };
}

export function roomIdFor(account) {
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
export function whoseRoom(room) {
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
export function fullLibraryTier(who) {
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

export function onlyTheirPacks(library, who) {
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
export function packCtx(req, url) {
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
export function mayReadPack(req, url, kind, id) {
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
export function packDating(kind, id, room) {
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
export function withShop(library, who) {
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

export function brandForRoom(room) {
  const who = whoseRoom(room);
  return brandFor(who ? (who.name || who.email) : '', {
    appName: config.appName,
    override: config.brandName,
  });
}

/**
 * WHICH ROOM A PUBLIC `?q=` MAY NAME — and the answer is "an account, or nobody".
 *
 * `?q=` is documented as an account id and is not a secret; `/signup?ref=` has
 * put one in a public URL for months. What it was never allowed to be is an
 * arbitrary string handed to `rooms.get()`, which files a room under it — see
 * `isRoomId()` in rooms.js for what that cost.
 *
 * **An id that names nothing still answers as an empty gallery**, which is the
 * behaviour the comment over `galleryRoomId()` asks for: never a 404, so nobody
 * can probe which ids are real. It just lands on ONE reserved empty room now
 * rather than minting a fresh one per string.
 */
export function galleryRoomFrom(q) {
  const want = String(q || '').trim();
  if (!want) return '';
  if (want === HOUSE) return HOUSE;
  return accounts.find(want) ? want : GALLERY_NONE;
}

/** The two colours this room's screens wear. */
export function schemeForRoom(room) {
  const who = whoseRoom(room);
  return findScheme(who ? who.scheme : DEFAULT_SCHEME);
}

export function roomForHost(req, url) {
  const account = whoIs(req, url);
  const room = rooms.get(roomIdFor(account), account ? account.name || account.email : '');
  /*
   * AND A ROOM NOBODY HAS LAUNCHED STILL OFFERS THIS ACCOUNT'S OWN GAMES.
   *
   * The tier is known HERE and nowhere below this, which is the same reason
   * the launch route resolves it rather than the console. `offerLobbyGames()`
   * refuses to touch a night that was actually launched, so this can only ever
   * fill in the gap a boot fallback leaves — see the note on it in
   * `session.js` for why that gap is the normal state of a room on a host with
   * no permanent disk.
   */
  if (account) {
    room.session.offerLobbyGames(
      lobbyGamesFor(room.session.kind, (entitlements(account) || {}).tierInUse || ''),
    );
  }
  return room;
}

/**
 * WHICH ROOM'S PHOTOGRAPHS THE PUBLIC GALLERY WILL SHOW FOR THIS CALLER.
 *
 * **ONE ROOM FOR THE WHOLE PHOTO STORY, and it had two.** The console read and
 * wrote through `roomForHost()` — the HOUSE room for the owner and for the host
 * key — while the public gallery has read the owner's OWN QUIZMASTER room ever
 * since a full night came out as an empty page. So a night could be published
 * into a folder the public page never looks at, be told it worked, and read
 * back as "Not published" on the page itself, with no error anywhere.
 *
 * That was written down as a hazard in the note above `galleryRoomId()` — in
 * as many words, *"a night could have been published into a folder this page
 * never looked at"* — and left. It then turned up as a bug report with a
 * screenshot, which is what a written-down hazard becomes.
 *
 * **IT CHANGES NOTHING FOR AN ORDINARY QUIZMASTER.** Their room id is their
 * account id, which is never `HOUSE`, and their gallery is read with that same
 * id — so this returns exactly what `roomForHost()` did. It redirects only the
 * two identities that drive the house room, to the room their own nights are
 * actually filed in.
 *
 * `publicRoomId()` falls back to `HOUSE` when there is no owner's quizmaster
 * account, so a fresh install is unchanged too.
 */
/**
 * WHAT IS IN A NIGHT'S FOLDER, from memory if it is there.
 *
 * The gallery index asks this once per night, so on a season's worth it was
 * twenty-odd GitHub calls a page open — see `photo-cache.js`. Dropped wherever
 * a photograph lands in or leaves a folder, which is the only thing that can
 * change the answer.
 */
export async function nightFiles(folder) {
  const held = cachedNight(folder);
  if (held) return held;
  /*
   * A READ THAT FAILED IS NOT AN EMPTY FOLDER, AND IT MUST NOT BE REMEMBERED
   * AS ONE.
   *
   * `listDir()` answers `[]` for a 403, a 500 and a dropped connection alike,
   * and this cache has no expiry — so one rate-limited moment on the first
   * visit to a published night gave EVERY visitor after it an empty page, for
   * the whole process lifetime. The index then drops a night with nothing
   * showing, so it did not look thin: it vanished. And the burst that produces
   * the 403 is exactly the burst this cache was built for — he reads the
   * gallery address out to sixty people at once.
   *
   * So the failure is not cached and the next visitor tries again. No TTL,
   * because a TTL would still serve the wrong answer for its length.
   */
  const read = await tryListDir(folder, 'photos');
  if (!read.ok) {
    console.warn(`[gallery] could not list ${folder}:`, read.error);
    return [];
  }
  keepNight(folder, read.files);
  return read.files;
}

/**
 * A filed photograph — memory, then disk, then GitHub. See `photo-cache.js`.
 *
 * **THE THIRD STEP IS THE ONE WITH A LIMIT ON IT**: every photograph served
 * from GitHub is one of 5,000 calls an hour shared with the packs, the
 * accounts book and the backups. The first two steps exist to make the third
 * rare, and the disk one exists because the memory one is empty after every
 * deploy — which is the moment a gallery is most likely to be being read.
 */
export async function photoBytes(at) {
  const held = cachedPhoto(at);
  if (held) return held;
  const onDisk = diskPhoto(at);
  if (onDisk) { keepPhoto(at, onDisk); return onDisk; }
  const bytes = await getFile(at, 'photos');
  if (bytes) { keepPhoto(at, bytes); keepPhotoOnDisk(at, bytes); }
  return bytes;
}

/**
 * WHERE TONIGHT'S PHOTOGRAPHS WILL LIVE — resolved at LAUNCH, like the
 * comeback line, and written into the game state.
 *
 * **THE ADDRESS EXISTS BEFORE THE PHOTOGRAPHS DO, and that is the whole
 * mechanism.** It is derived from the pub and the date rather than stored, so
 * the projector can carry a QR of it at eleven o'clock while the gallery
 * itself is still private — publishing is deliberately something the
 * quizmaster does afterwards, having looked at what is in it. The link people
 * photograph tonight is the link that works on Tuesday.
 *
 * **`galleryPath()` IS SHARED WITH THE BROWSER** (`public/assets/slugs.js`),
 * because the console prints this same address under a night's photographs —
 * two implementations of one URL is a link that works in one place and 404s in
 * the other, which is the fault that file exists to prevent.
 *
 * The 6am roll-over is `nightOf()` — the photo store's OWN dating function
 * rather than a second copy of the arithmetic, so
 * a quiz that ends at half past midnight points at its own night rather than
 * tomorrow's empty one.
 */
export function photoLinkFor(req, url, venue) {
  const room = galleryRoomFor(req, url);
  return galleryPath(nightOf(Date.now()), venue, {
    // The pretty `/the-crown/gallery/20-august` form only works for the room
    // the public pages fall back to — the same fact `/api/me` sends as
    // `ownAddress`. Everybody else gets the plain form, which always works.
    pretty: room === publicRoomId(),
    room,
  });
}

export function galleryRoomFor(req, url) {
  // One definition, shared with `fileAway()`, which had its own and disagreed.
  return galleryRoomOf(roomForHost(req, url).id);
}

/**
 * EVERY ROOM THIS ACCOUNT'S NIGHTS ARE FILED IN — and for almost everybody
 * that is exactly one.
 *
 * **A NIGHT'S VENUE COMES OFF THE ARCHIVE AND ITS PHOTOGRAPHS COME OFF THE
 * REPOSITORY, AND FOR THE OWNER THOSE WERE TWO DIFFERENT ROOMS.** `/api/past-
 * gigs` joins them BY DATE: the archive from `roomForHost()` — HOUSE for the
 * owner and the host key — and the photo folders from `galleryRoomFor()`,
 * which for those two identities is the owner's own QUIZMASTER room. So a
 * night hosted under the quizmaster hat filed its archive in one room and its
 * pictures in the other, the join found no record for that date, and the
 * night came out with **no pub on it** — reported as *"all of these were
 * taken at the same venue but the last ones have no venue attached"*.
 *
 * Nothing threw, and every row was real. It is the third sighting of **a read
 * and a write that disagree about the room**, which this codebase already
 * records for `leagues-published.json` and for the gallery publish control.
 *
 * **THE ARCHIVES ARE UNIONED, NEVER SWAPPED.** Picking one room instead would
 * move his whole history to whichever hat he happened not to be wearing; both
 * of these are his, and the split is a fact about nights already on disk that
 * no migration is going to tidy — this file's own standing rule.
 *
 * **THE PHOTO FOLDERS ARE DELIBERATELY NOT UNIONED WITH THEM.** The per-night
 * read, the lamps, the pins and the published flag are all ONE room by design,
 * so listing a night whose pictures the opener cannot fetch would put a row on
 * the rail that opens empty — a worse answer than the row not being there.
 *
 * **AN ORDINARY QUIZMASTER IS UNTOUCHED**: their room id is their account id,
 * never HOUSE, so the two resolve to the same room and this returns the one it
 * always did.
 */
export function gigRoomsFor(req, url) {
  const here = roomForHost(req, url);
  const galleryId = galleryRoomFor(req, url);
  return galleryId === here.id ? [here] : [here, rooms.get(galleryId)];
}

/**
 * WHICH ROOM A PHONE IS TALKING TO — and a code that does not resolve is
 * REFUSED, never quietly swapped for the house room.
 *
 * `rooms.byCode(code) || rooms.get(HOUSE)` meant `/play?g=ZZZZ` said *"You're
 * in"* under the owner's branding, `POST /api/join` returned a real id and
 * token, and the player appeared in the OWNER'S room —
 * `/api/state?role=screen&g=ZZZZ` then served the owner's loaded quiz to
 * anybody who asked. Nothing 404'd and nothing logged.
 *
 * It has a real trigger, not just a typed URL: join codes lived in
 * `data/room-codes.json` and their backup raced, so a code could change across
 * a deploy — and then every phone scanning a subscriber's PRINTED QR joined
 * the owner's game and was told it was in.
 *
 * **`rooms.get()` already refuses exactly this for room ids**, with a note
 * saying a house fallback is *"the same fault wearing a friendlier face"*. A
 * `badRequest` is the shape the one top-level catch answers with a 400, so
 * every caller is covered without twelve of them learning to handle a null.
 *
 * **NO CODE AT ALL still means the house room** — that is the owner's own
 * projector and every bookmark and printed card made before rooms existed.
 */
export function roomForPhone(req, url, body = null) {
  const code = tidyCode((body && body.joinCode) || url.searchParams.get('g') || '');
  if (!code) return rooms.get(HOUSE);
  const room = rooms.byCode(code);
  if (room) return room;
  const err = new Error('That code is not a game here.');
  err.badRequest = true;
  throw err;
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
export function offerRoomId() {
  const owner = accounts.owner;
  const mine = owner ? accounts.ownQuizmasterFor(owner.id) : null;
  return mine ? mine.id : HOUSE;
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
/*
 * ---- POST SOMEBODY A ONE-TIME LINK ---------------------------------------
 *
 * The half `/api/reset/request` and `/api/magic/request` share, lifted out
 * when the second one arrived rather than copied into it: the refusal when
 * no mail provider is set, the identical reply for a known and an unknown
 * address, the throttle, the honest scheme, and reporting a send failure
 * instead of swallowing it. Every one of those is a decision with a reason
 * written against it, and **two copies is one of them getting fixed.**
 *
 * What differs is three things and they are the arguments: which KIND of
 * link it is (checked when it is spent), which page it lands on, and what
 * the email says.
 */
/*
 * A PASSWORD ALREADY ON A PUBLIC BREACH LIST IS REFUSED — at every route
 * that sets one, and nowhere else.
 *
 * This is what the minimum length came down to eight IN EXCHANGE FOR. Length
 * on its own is a poor proxy: `Password1` is nine characters and has been in
 * every wordlist for twenty years, while a password nobody has used before
 * is fine at eight. What actually takes an account is REUSE, and this is the
 * check that catches it.
 *
 * **IT FAILS OPEN.** `looksBreached()` answers "could not tell" as `false`,
 * so an outage at the other end lets the password through rather than
 * locking out somebody who is, very often, already locked out. The trade is
 * deliberate and is the same shape as every other one on this path.
 *
 * **AT THE ROUTE, NEVER IN `accounts.js`.** The rule about the SHAPE of a
 * password is pure and synchronous and belongs with the book; the thing that
 * can time out does not — the reason `applyBilling()` has no send in it.
 */
export async function refuseBreached(res, password) {
  if (!(await looksBreached(String(password ?? '')))) return false;
  return sendJson(res, 400, { error: BREACHED_SAID }), true;
}

export async function postALink(req, res, { email, kind, path, template }) {
  const said = { ok: true, sent: 'If that address has an account, a link is on its way. It lasts 30 minutes.' };
  // Said plainly rather than pretending: without a key nothing is going to
  // arrive, and "check your inbox" for an email that will never come is the
  // worst answer there is.
  if (!emailConfigured()) {
    return sendJson(res, 200, { ...said, ok: false, unconfigured: true,
      error: 'Email is not set up on this server yet.' }), true;
  }
  const started = accounts.startReset(email, { kind });
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
  const link = `${base}${path}?t=${encodeURIComponent(started.token)}`;
  // `brandForRoom`, not `brandFor` — the second takes a person's NAME and
  // returns a string, so `brandFor(rooms.house).name` was a room passed as a
  // name and then `.name` read off a string. It came out as "Set a new
  // password for undefined", which is a phishing email as far as anybody
  // reading it is concerned.
  const name = brandForRoom(rooms.get(HOUSE));
  const out = await sendEmail({ to: email, ...template({ name, link }) });
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
