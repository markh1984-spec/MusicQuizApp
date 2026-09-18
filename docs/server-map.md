# `server.js` is a shell now — the split, 18 September 2026

Done the same day it was mapped, by a script cutting on line numbers (the
console's transform): `server.js` is 281 lines — the request dispatcher, the
two route lists and the boot tail — and everything else is in `src/http/`:

- `context.js` — every import the routes need and the singletons (`hub`,
  `accounts`, `rooms`…), re-exported. **It imports nothing from `src/http/`**,
  so it is the leaf; `Rooms` gets its three callbacks through `hooks`, which
  `views.js` and `helpers.js` fill in as they load, because reaching back
  for `pushState()` would be the circular import.
- `views.js`, `plumbing.js`, `identity.js`, `gates.js`, `static.js`,
  `support-log.js`, `card-art.js`, `helpers.js` — the helper families, each
  moved whole. `helpers.js` is the 1,400-line span that sat between the two
  handlers, still interleaving backups with domain helpers; cut it per
  function when there is a reason.
- `get-*.js` and `write-*.js` — one function per route family, the body
  lifted unchanged out of `handleGet()`/`handleWrite()`, ending `return
  false`. The shell tries them in the order they sat in the one function.

Three helpers had been declared INSIDE the handlers and used by more than one
family — `offerRoomId`, `refuseBreached`, `postALink`. None closes over a
handler local, so they lifted unchanged into `identity.js`. The first cut left
them behind and three routes answered 500 with the suite otherwise green;
`test/server-split.test.js` now refuses a function declared inside a family,
and checks every module either defines or imports every module-level name it
uses — the check that found `...trialEndingEmail(` being read as a property
access by the cut script and left out of the shell's imports.

Forty tests read the server as text; they read all of it now through
`test/server-source.js`, in the shell's order, so "matched before" still
means what it did.

The map below is what the cut was made from, kept for the next cut.

## What is different from the console split

The console's hazard was mutable shared bindings — `let`s written by more than
one module — and the fix was `console-state.js`. **`server.js` has none of
those.** Every top-level `let` (`backupCheck`, `cardArtSeen`, `codesWriting`,
`codesPending`, `propPush`) is read and reassigned only inside the one function
declared beside it, so each moves as a unit with its function. The `const`
Sets/Maps (`archiveRestored`/`InFlight`, `advertsRestored`/`InFlight`,
`invoicesRestored`/`InFlight`, `ownPacksRestored`/`InFlight`, `restoreFailedAt`,
`introPlayed`, `pushQueued`, `signupsSeen`) are mutated from more than one
function but never reassigned, so they can be imported and shared — as long as
`restoreOnce` and the four `ensure*Restored` move TOGETHER.

The real hazard is the 1,400-line helpers span between the two route handlers
(4140–5539), which interleaves true backup/restore infrastructure with domain
helpers for invoices, owner money, adverts and pack liveness, and the twenty-odd
scattered call sites of the four `ensure*Restored` functions in both handlers.
That span is cut per FUNCTION, not per line range.

## Top-level layout

| Lines | What |
|---|---|
| 14–141 | imports |
| 143–198 | singletons: `HOST_KEY`, `hub`, `accounts`, `reports`, `suggestions`, `spend`, `propUse`, `rooms` (ctor closes over `pushState`, `backUpArchive`, `backUpCodesSoon`), `backupCheck` |
| 221–507 | views and broadcast: `photosWanted`, `wallView`, `viewFor` (the rule-1 whitelists), `startIntroTrack`, `pushState` |
| 509–701 | HTTP plumbing: `send`, `sendJson`, `readBody`, `readJson`, `callerOf`, `isLocalRequest`, `publicOrigin`, `onDjHost`, `joinUrlFor`, `isHostKey` |
| 703–909 | cookies and identity: `cookieFor`, `cookie`, `whoIs`, `summarise` |
| 914–1346 | room and library resolution: `roomIdFor`, `whoseRoom`, `fullLibraryTier`, `onlyTheirPacks`, `withShop`, `brandForRoom`, `galleryRoomFrom`, `schemeForRoom`, `roomForHost`, `nightFiles`, `photoBytes`, `galleryRoomFor`, `gigRoomsFor`, `roomForPhone` |
| 1348–1425 | gates: `BOOTSTRAP`, `allowed`, `packStillThere`, `problemsWith`, `showsFor`, `timingSafeEqual` |
| 1427–1485 | static serving: `MIME`, `serveFile` |
| 1489–1518 | `server = http.createServer(...)` — dispatch to the two handlers |
| 1542–1657 | the support log: `SUPPORT_*`, `supportWords` (a third route table, in words), `supportGuard` |
| 1663–1698 | card art |
| 1700–4119 | `handleGet` |
| 4140–5539 | the helpers span (see above) |
| 5540–9499 | `handleWrite` |
| 9501–9674 | boot: `await restoreFromBackup()`, `server.listen`, `sweepTrials`, `shutdown`, the three `process.on` |

## Route families inside `handleGet`

| Lines | Family | Routes |
|---|---|---|
| 1701–1916 | pages | `/`, `/screen`, `/wall`, `/snap`, `/play`, `/v`, `/o/*`, `/gallery`, `/league`, `/host`, `/editor`, `/console`, `/login`, `/home`, `/signup`, `/terms`, `/privacy`, `/refunds`, `/faq`, `/dj`, `/magic`, `/reset`, `/owner` |
| 1905–1971 | static | `/favicon.svg`, `/health`, `/assets/*`, `/quiz-images/*`, `/photos/*` |
| 1972–2049 | owner photos, voucher read, QR images |
| 2050–2065 | `/api/stream` |
| 2066–2231 | info and owner reads: `/api/join-url`, `/api/reports`, `/api/owner/*`, `/api/prop-weights`, `/api/has-accounts` |
| 2232–2443 | identity and state: `/api/me`, `/api/group`, `/api/card-art`, `/api/brand`, `/api/state` |
| 2443–2502 | `/api/quizzes`, the invoice overlay, `/api/host/ready` |
| 2503–2880 | `/api/library` — the console's whole shelf, one route |
| 2881–2993 | `/api/advert/*`, `/api/images/*`, `/api/bingo/*`, `/api/history` |
| 2994–3109 | invoices reads, asks, suggestions |
| 3110–3572 | past gigs: the list, `report.pdf` (BEFORE the prefix route), the per-night read |
| 3573–3665 | league |
| 3666–4007 | gallery and photo serving |
| 4008–4118 | `/api/playing/*`, `/api/quiz/*` read, calendar, `/api/results.csv` |

## Route families inside `handleWrite`

| Lines | Family | Routes |
|---|---|---|
| 5557–5734 | Stripe: webhook (FIRST, raw bytes), subscribe, buy-pack, portal |
| 5816–6026 | photo writes: past-photo, gallery-photo, gallery-pin |
| 6027–6070 | shows |
| 6071–6182 | past gigs and league writes |
| 6183–6438 | sign-in, magic, reset, sign-out |
| 6439–6662 | scheme, suggestions POST, signup |
| 6663–6774 | suggestions admin |
| 6775–6874 | group seats |
| 6875–6990 | account settings, calendar link, password |
| 6991–7172 | invoices writes |
| 7173–7203 | voucher redeem |
| 7206–7270 | DJ phone routes |
| 7271–7319 | `/api/join` |
| 7320–7392 | `/api/photo` |
| 7396–7404 | the player-action dispatch (one `includes` gate to `session.runPlayerAction`) |
| 7408–7607 | `/api/snap`, `/api/ask` |
| 7608–7681 | advert and DJ shared write handling |
| 7682–7899 | own packs |
| 7899–8225 | reports, owner act-as, owner admin, owner photos |
| 8226–8279 | host-side DJ |
| 8280–8842 | **host actions**: `launch` (8291–8584), `launchOrder` (8585–8733), `reportQuestion`, `sting`, the photo switches, then `session.run(action)` |
| 8844–9001 | editor: validate, advert PUT/DELETE, quiz PUT, quiz POST (the 409) |
| 9002–9409 | generation, intro playlist and imports |
| 9410–9499 | history forget, bingo packs |

## What crosses families (goes in a shared module)

`whoIs`, `roomForHost`, `roomForPhone`, `galleryRoomFor`, `gigRoomsFor`,
`galleryRoomFrom`, `roomIdFor`, `whoseRoom`, `allowed`, `sendJson`, `send`,
`readJson`, `readBody`, `cookie`, `cookieFor`, `pushState` (every write that
moves a game), `startIntroTrack` (defined with the views, called from host
actions), `brandForRoom`, `schemeForRoom`, the library builders
(`fullLibrary`, `onlyTheirPacks`, `withShop`, `packFilter`), the pack-liveness
set (`packInUse`, `changesTheLiveQuestion`, `packPlayState`,
`packStillThere`, `reloadPackEverywhere` — used by the quiz editor, the own
packs and the bingo editor, far apart), the four `ensure*Restored`, `accountRef`
and `firstNameOf` (suggestions and the trial emails), `fileAway` (all three
photo writes), `backUp` and `backUpMany` (every pack write).

`server` is referenced only by its declaration, `listen` and `shutdown`.
`hub` only by `pushState`, `/api/stream`, `/api/host/ready` and `shutdown`.
`rooms.all()` by `shutdown`, the crash handler, and the owner overview.
`process.on` only in the boot tail.

## The likely cut

1. `src/http/support-log.js` — 1542–1657, self-contained.
2. `src/http/identity.js` — cookies, `whoIs`, room resolution (703–1346).
3. `src/http/gates.js` — 1348–1425.
4. `src/http/views.js` — 221–507; imported by the write handlers too.
5. `src/http/backups.js` — the true backup/restore functions from the helpers
   span, with `restoreOnce`, the four `ensure*Restored` and their Sets/Maps
   as ONE unit.
6. Domain helpers out of the same span into the module of the family that
   owns them (owner money, invoices, adverts, pack liveness).
7. One module per route family from the two tables, each importing 1–6.
8. `server.js` shrinks to imports, the singletons, `createServer` and the boot
   tail — the shell, the shape `console.js` has now.

The singletons are the one ordering hazard: `rooms` is built with callbacks
onto functions defined later (`pushState`, `backUpArchive`, `backUpCodesSoon`).
Either those move into a module the shell imports BEFORE building `rooms`, or
the shell builds `rooms` and hands it to the modules — never a circular import
that reads a binding in its temporal dead zone, which is the fault that hid the
Workshop door for a session.
