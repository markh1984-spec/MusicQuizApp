# THE PHOTOGRAPHS' STORE — off GitHub, into a bucket

Split out of [`photos.md`](photos.md) on 18 September 2026, by section and
unreworded. That file is the record of who may see a photograph and how a night
is published; this one is where the bytes actually are.

## WHERE THE BYTES ACTUALLY LIVE — the move off GitHub, 18 September 2026

**The private repository was an honest store for a year and it has one fault
that cannot be fixed from inside it.** `CLAUDE.md` already records the sentence:
*a deleted photo leaves the repo but NOT git history — never imply otherwise.*
That is version control keeping its promise, and for pictures of the public in a
pub it is the wrong promise:

- the bin takes a photograph off the projector, the wall, the gallery and the
  night's folder, and leaves the bytes in the history for ever — so *"I deleted
  it"* is true about the page and false about the storage, which is not a
  sentence a quizmaster should have to say to somebody who asked;
- the same joke uploaded eleven times in one night is eleven copies nothing can
  reclaim, so the repository only ever grows — the host's own words were
  *"I don't want to be storing 60 versions of Sean's fake six pack"*;
- and a repository big enough to hold years of Thursdays is one GitHub starts
  warning about, for a store whose entire job is to be dull.

**An object store has no history. A delete is a delete.** That is the feature
being bought. It fixes the rate limit as a side effect — the Contents API allows
5,000 calls an hour on a token shared with the packs, the accounts book and every
backup, and a gallery is read by a room full of people at once — but the limit
was already survivable behind two caches. The history was not survivable at all.

### It is S3's API, not a supplier

`src/r2.js` speaks the ordinary S3 REST interface with SigV4 signing and names
no supplier anywhere in it. Cloudflare R2, Backblaze B2, MinIO on a box, Amazon
itself: one endpoint variable apart. **This app has been moved off a supplier
before and will be again**, and the cost of keeping that true here was zero.

**And it takes no dependency**, which the whole codebase turns on. SigV4 is
SHA-256 and HMAC-SHA256 over strings in a fixed order; `node:crypto` does both,
and this app already computes an HMAC by hand to verify the Stripe webhook. An
SDK would be twenty megabytes to avoid sixty lines, plus a supply chain, on a
project whose first rule is *no dependencies at all*.

### The swap is at one choke point, and twenty call sites never found out

Twenty places pass `which === 'photos'` to `github.js`. None of them changed.
`github.js` delegates those calls to the store when one is configured, which is
`accounts.effective()`'s shape exactly — **the substitution happens at a single
choke point, so every reader downstream needed no change.**

What that costs is discipline about the return shapes. `tryGetFile()` and
`tryListDir()` exist to keep *"there is nothing there"* apart from *"I could not
find out"*, and this file already records what collapsing them did: one 403 on
the first visit to a published night gave every visitor after it an empty page,
for the whole process lifetime, cached. **The store answers in the same shapes,
and the guard drives a real gallery over HTTP to prove it.**

### Reads fall back; writes do not; listings are unioned

This is the whole migration story, and it is why there is no migration STEP:

- **a write goes to the store and only the store**, so the repository stops
  growing the moment the four variables are set;
- **a read tries the store and falls through to the repository on a MISS**, so
  every night already filed goes on working whether the script is run today,
  next month or never;
- **a listing is the UNION of both.** This is the rule `CLAUDE.md` already sets
  for the two archives — *they are UNIONED, never swapped: both are his, and
  picking one moves his history* — applied to a half-done move. Without it, the
  day a variable is typed, half of somebody's nights vanish off Past gigs, out
  of the league and out of the headcounts, with nothing thrown.

**The fallback happens on a miss and never on a failure**, and that distinction
is load-bearing rather than fussy. A store that is failing would otherwise push
its entire read load straight back onto the rate limit this move exists to
escape, silently, for as long as the old repository still answered — a broken
store hiding behind a slow one is worse than a broken store.

**And the bin reaches both while both exist.** Deleting only from the store
would mean a binned photograph came back the next time the store missed and the
read fell through exactly as designed: the fallback, working correctly, against
the one press that must be final.

### The script exists so the repository can be deleted

`scripts/photos-to-r2.mjs` copies what is in the working tree and leaves the
repository untouched. **Copying is not the prize; deleting the old repository
is** — its history is the thing being erased, and nothing is erased until it is
gone. So the script says what it will do and does nothing until told (`--go`),
proves the store takes a write before it reads a single photograph, verifies
every copy by reading the bytes back, and ends by saying out loud that the next
step is a human deleting a repository.

A binned photograph is not in the working tree, so it is never copied. It simply
stops existing when the repository goes, which is the sixty Seans, answered.

### What is not proven, said plainly

**The signature is not proven by the suite.** No test here holds keys and none
ever should — the same rule as `photo-repo-stub.mjs`, for the same reason. What
stands in for it is `checkAccess()`, which **writes and removes rather than
reading**: a key that can list but not put looks exactly like a working one from
a read, and the migration runs it before it touches anything. A signing fault is
then a 403 on the first call, said out loud, rather than a night that files into
nothing.

The one encoding trap is pinned instead, because it is the one that produces
that 403 while every variable is correct: **RFC 3986, not `encodeURIComponent`.**
They disagree on exactly five characters — `! ' ( ) *` — and S3 computes its
signature over ITS spelling of the path. `safePhotoName()` would not let one
through today; the signature must not depend on that staying true.

---

## THE BUCKET TOOK THE ACCOUNTS BOOK, AND THE GALLERY WENT BLANK — 18 September 2026

The same evening as the move, an hour after it. The migration itself was clean:
285 photographs copied, nothing failed, the bucket verified independently. Then
`PHOTO_REPO` and `PHOTO_TOKEN` were removed from Render — reasonably, since the
photographs no longer lived there — and the app came up logging *"No accounts
yet"*, the brand reverted from *Mark's Quizporium* to *Quizporium*, and
`/api/gallery` answered `{"nights":[],"preview":true}` to the signed-in owner
with five nights of photographs sitting in the bucket.

### One word in one function

`inStore()` read:

```js
const inStore = (which) => (which === 'photos' || which === 'private') && store.configured();
```

and the comment eight lines above it read *"takes over `which === 'photos'`, AND
NOTHING ELSE CHANGES."* **A comment that claims the opposite is where the next
bug hides** — this file's own rule, fourth sighting, and the most expensive one
so far.

`'private'` is not photographs. It is `accounts.json`, `room-codes.json`, the
invoice books and the night archives: small files, no faces, and git history is
exactly the right promise for them. *The backup IS the data* on a host that wipes
its disk every deploy. The store was bought because **a delete in a repository is
not a delete**, which is a decision about pictures of the public and about
nothing else.

### Why removing one variable could not be undone by putting it back

Three rules that are each correct on their own, composing into a trap:

1. `photosRepoConfigured()` answers *"is there somewhere to put a photograph"*,
   and a bucket is a complete answer — so with `PHOTO_REPO` unset it still said
   YES, and `readyFor('private')` asked it.
2. **A read tries the store and falls through to the repository on a MISS** —
   but with no repository configured there was nothing to fall through TO. The
   accounts book came back absent rather than unreachable, which is what *"No
   accounts yet"* means.
3. **A write goes to the store and only the store.** So the app, believing it was
   a fresh deployment, wrote its own freshly-created state up to the bucket:
   `accounts.json` and `room-codes.json`, at the root, beside `photos/`.

Restoring `PHOTO_REPO` then fixed nothing, because **the store is read FIRST**.
Those two files shadowed the good copies in the repository permanently and
silently, and one of them is the accounts book — which is what `publicRoomId()`
reads to decide whose room the public gallery is. With no owner-quizmaster
account in the book it falls back to the house room, whose folder holds other
rooms rather than nights, and `isNightFolder()` filters every one of them out.
**Zero nights, no error, every screen drawing perfectly.**

Nothing in the log, either, and that is by design at every step: a store listing
that fails returns `[]`, a repository read that 403s returns `{ok: false}` and is
passed through, a fallback happens on a miss and never on a failure. Each of
those is the right behaviour and the combination is undiagnosable from a log.

### The fix, and the two halves that had to move with it

- **`inStore()` is `'photos'` alone.**
- **`readyFor('private')` asks `privateRepoConfigured()`, which is now the
  repository and not "somewhere to put a photograph".** That is what makes an
  unset variable SAY so: `restoreFromBackup()` already logs *"no accounts and no
  private repo configured — the host key is the only way in"*, a sentence nobody
  saw because the bucket had answered for it.
- **`leagues-published.json` moved the other way, to `'photos'`.** It lives
  INSIDE a room's photo folder, beside `published.json`, which has always been
  `'photos'`. Both words resolve to the same repository, so this is not a move —
  but an object store takes the photo FOLDER over, and two neighbours in one
  folder kept in two stores is *a read and a write that disagree about where
  something is*, which this repo already has three scars from.

### And two scripts, because a guard that cannot see the fault is the real fault

`photos-in-a-bucket.mjs` drove the whole gallery over HTTP against a fixture
bucket and passed throughout — it only ever looked at photographs. It now asserts
that **the bucket's root holds nothing but `photos/`** after a run that has
created an account, signed in and published a night. Verified by putting the
fault back: it names `accounts.json, photos, room-codes.json`, which is exactly
what the live bucket was found holding.

`why-no-nights.mjs` is the other half — a read-only diagnostic to run where the
variables are. Every step of this path degrades quietly, so it prints all of them
side by side: which variables the app can see, both books with their account ids
and roles, which room each book resolves the gallery to, and the night folders as
the bucket and the repository each list them. **It prints no token, no key, no
password hash and no email address**, so the output can be pasted into a chat,
which is where the diagnosis actually happens.

`private-out-of-the-bucket.mjs` is the repair. Whatever was written to the bucket
while the routing was wrong is the NEWEST copy of it, and the fix makes it
invisible — so it walks the bucket's root, prints each file beside the
repository's copy **counted in its own terms** (accounts, join codes, nights,
never bytes), and copies it back on `--go`. **It refuses to write over a richer
file**: the first thing that happened in this incident was the app writing a
nearly-empty book, and newer by time is not better. It reads back before it will
remove anything, because a delete after a write that did not land is the one
order that loses a file for good.

**The join-code book is the sharp one.** It exists ONLY in the bucket — the
repository never held a copy — and a lost code book is printed QR codes that stop
resolving in front of a room, which this file already records as the fault that
sent a whole pub into the owner's own game.

## AND THE GALLERY WAS EMPTY FOR A SECOND REASON — 19 September 2026

With the bucket sorted, `/api/gallery` still answered `nights: []`. The
diagnostic printed why in three lines:

```
bucket:     photos/ holds 2026-08-11, 2026-08-12, 3bLePiEIs6js
repository: photos/ holds 2026-08-05, 2026-08-06
the gallery reads: photos/0moNo5X5y6g9      <- empty in both
photos/3bLePiEIs6js -> 2026-08-13, 08-20, 09-03, 09-10, 09-17   <- the five nights
```

**Every photograph was exactly where it had always been.** The app was asking
for a room nobody had ever filed anything under.

### What `3bLePiEIs6js` is, and what it is not

Not a renamed account: the accounts book in the private repository has three
versions in its whole history — 9 August 19:07 (the owner alone), 9 August 21:07
(the owner and one quizmaster) and the rescue write on the 18th — and the
quizmaster's id is `0moNo5X5y6g9` in both of the older two. Not a live room
either: no `rooms/` folder on disk, no third account in the live book, and
`DATA_DIR` unset, so `data/` is wiped on every deploy as it always was.

So it is a room that the app was filing nights into for five weeks and which the
accounts book never named. **What that means is not settled and must not be
guessed at** — the repair below does not depend on knowing.

**One thing about it IS settled, and it narrows the question usefully.** It is
twelve characters of the base64url alphabet, which is exactly what `newId()` in
`accounts.js` mints — `crypto.randomBytes(9).toString('base64url')`. So it was
an ACCOUNT id, not a corrupted path, not a stray prefix and not a room the code
could ever have invented for itself. Whatever happened, something once signed in
as an account with that id and hosted five nights; the book has since stopped
naming it.

**And the mechanism that let any room id at all reach a folder the readers do not
open was found the same day, on the other side of the same file** —
`fileAway()` filed under `room.id` raw while every reader asks
`galleryRoomFor()`. That is also what the two unexplained nights in the bucket's
FLAT folder are (`2026-08-11`, `2026-08-12`), and the two in the repository's
(`2026-08-05`, `2026-08-06`): nights hosted from the HOUSE room, filed where
nothing looks. Fixed by `galleryRoomOf()` — see
[`photos.md`](photos.md).

### The rule and the code disagree about which room a photograph is filed in

`CLAUDE.md` already carries *ONE ROOM FOR THE WHOLE PHOTO STORY —
`galleryRoomFor()`, never `HOUSE`*, and every READER obeys it: the gallery
index, a night's photographs, the bytes route, Past gigs' grid, the publish lamp,
the pins. **`fileAway()` does not.** It writes to `photoFolder(room.id)` — the
room the GAME is in — with a comment explaining that the house keeps the flat
path because there are nights filed under it already.

For an ordinary quizmaster the two are the same room and nothing is wrong. For
the OWNER they are two rooms, exactly as `gigRoomsFor()` records for the archive:
`roomForHost()` is HOUSE on the host key and under the owner hat, while
`galleryRoomFor()` is his own quizmaster room. Which is why
`photos/2026-08-11` and `photos/2026-08-12` — nights filed straight into the
house folder — have never appeared on the gallery and still do not.

**This needs a decision rather than a quick edit**, and it is written down here
rather than fixed at midnight: making `fileAway()` follow `galleryRoomFor()`
fixes every future night and leaves the house-folder ones where they are, so it
wants doing together with a move of those, and a move is the thing that has to
be got right once.

### The repair: copy, never move

`scripts/photos-into-the-right-room.mjs`, dry by default:

```
node scripts/photos-into-the-right-room.mjs 3bLePiEIs6js 0moNo5X5y6g9        # look
node scripts/photos-into-the-right-room.mjs 3bLePiEIs6js 0moNo5X5y6g9 --go   # do it
```

- **It copies and never moves.** The source folder is left alone, so a mistake
  costs disk rather than five nights of somebody's room. Deleting the old folder
  is a separate, deliberate act taken once the gallery is seen to be right.
- **It carries the files that sit BESIDE the nights** — `published.json` above
  all, which is what makes a night visible to a stranger and which lives at the
  root of the room's folder rather than inside a night. Move the pictures without
  it and the gallery is still empty, which reads as the repair having failed.
  `flags.json` and `leagues-published.json` ride along for the same reason.
- **It refuses to write over anything.** Nothing here is clever enough to merge
  two `published.json` files, and a guess would unpublish a night.

**AND THE TIDY-UP IS ITS OWN SCRIPT, WHICH REFUSES UNTIL THE COPY IS PROVEN** —
`scripts/photos-out-of-the-old-room.mjs`. A copy that never moves leaves a
duplicate behind, and a duplicate is not harmless: the next person to read the
bucket finds two folders holding the same five nights and no way to tell which
one the app reads. It is also the shape that started all of this.

```
node scripts/photos-out-of-the-old-room.mjs 3bLePiEIs6js 0moNo5X5y6g9        # look
node scripts/photos-out-of-the-old-room.mjs 3bLePiEIs6js 0moNo5X5y6g9 --go   # do it
```

Every file under the source has to exist under the destination — by name, night
by night, plus the sidecars — or nothing is deleted and the missing one is
named. **There is no `--force`**, deliberately: on the repository a delete leaves
git history behind, on the object store it leaves nothing at all, so this is the
one press in the photo story that cannot be taken back. The flat `photos/` folder
is refused as a source for the same reason. Both scripts are run for real by
`test/photo-repair-scripts.test.js`.
- **It goes through `github.js`**, so a read is the store then the repository and
  a write lands in whichever store is configured — the one choke point, unchanged.
