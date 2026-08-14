# Gigs — venues, prizes, the diary, past nights and getting paid

The reasoning behind the gigs rules in CLAUDE.md.

**The rules themselves live in CLAUDE.md and are the short version.**
This is the why: what was tried, what it cost, and what must not be
unpicked. Read the relevant part before changing anything here.

---

## The winner's prize, on their phone

`state.reward` and `state.vouchers` in `src/engine.js`, the `/v` page, and the
**The prize** panel on the control view. Set **What they win** at launch — "A
free drink at the bar", "£50 bar tab" — and when the final scores go up the
winner's own phone shows a card with a QR on it. The bar scans it with their
own phone, gets a page saying *"Give them a free drink at the bar"*, and presses
one button.

**FIRST, SECOND AND THIRD**, each with its own prize or the same one. The
launch form shows ONE box and the next appears when you fill it, so a one-prize
night looks exactly as it did and nobody counts empty fields on the page whose
job is "find tonight's pack and press Launch".

**THE PRIZE IS SET ON THE VENUE AND NOWHERE ELSE**, and there is no "What they
win" box on a pack card at all. The host's own reasoning, and it is the right
cut: *"the prizes sit in the venue tab and are revealed at the end, it's not
relevant to the pack."* Look, Where and Playing are facts about the EVENING;
a prize is the venue's standing arrangement — the same drink every week at one
pub and something else entirely at another.

It went through a launch-form version first (three boxes, the next appearing as
you filled the one above) and that was wrong twice over: it asked at the moment
you least want to be typing, and it put a fact about the venue on the card of a
pack that could be played anywhere.

**The SERVER reads them off the venue record**, not the browser — so one source
of truth, and a stale console cannot launch a night playing for something the
venue never agreed to. A request that carries `rewards` still wins, so a curl
call and every test keep working.

**THE VENUES ARE READ OFF THE INVOICE BOOK, SO THE LIBRARY ROUTE HAS TO
RESTORE IT.** Rooms are made lazily and `data/` is empty after every deploy, so
the book only exists once it has come back from the private repo — and that was
triggered by the invoice routes alone. The Venues tab reads `venueRecords` out
of the LIBRARY payload, so a console opened after a deploy said *"no venues
yet"* until somebody happened to visit the Invoices tab, at which point they
reappeared. Somebody's venues looking deleted is not a thing to leave to a
lucky click. This is the same class of trap as a route being added without
being put on `OWNER_ONLY`: the mechanism exists and the new caller did not know
to ask for it.

**AND THE PACK CARD SAYS WHAT TONIGHT IS PLAYING FOR, INCLUDING WHEN IT IS
NOTHING.** `paintPrizes()` inside `wireVenue()` in `console.js`: pick a venue
and the line under it reads *"Playing for: **1st** A free drink at the bar ·
**2nd** …"*, read-only, at the only moment it can still be changed.

**It exists because the first real night ended with no voucher at all and
nothing anywhere said why.** The server reading the prizes off the venue record
is right and stays — but it meant the only place the arrangement was ever
stated was the venue record itself, on a different tab, and the night's venue
had not matched one. **An app that says nothing looks exactly like an app that
is working**, which is the same fault as the Spotify 403 coming back as an
empty success.

So the half that matters is the NONE case, and it is worded to say which of the
two it is: *"this venue is not on your Venues tab"* when the name matches no
record — which is what a free-text venue always gets, and worth saying rather
than leaving somebody to find out at the final scores — and *"set them on the
Venues tab"* when the record exists and is empty. It is a quiet dashed box, not
a warning: a night with no prize is an ordinary night.

**AND THE LAUNCH BAR KNOWS WHOSE NIGHT TONIGHT IS.** `usualNight` on the venue
record, `tonightsVenue()` in `console.js`. Asked for as *"the quick launch
should remember what you did the previous week"*, then sharpened by the host
himself — *"or perhaps know which venue from the diary?"*

**The diary is the right source and it is the one thing here that does not
exist** — `FEATURES.CALENDAR` is on Bronze and still says "Not built yet". But
the useful half of a diary is not a list of booked dates, it is WHICH VENUE HAS
YOU ON A THURSDAY, and that is one field on a record the quizmaster already
keeps. TODO.md had already reasoned to the same place: *"a usual night,
optionally, on the customer — which is what turns the list into a calendar"*.
So this is the cheapest possible diary and it needs no second list, which is
the thing that section warns hardest against.

Two sources, in order, and the order is the design:

1. **The venue whose usual night is tonight.** STATED rather than guessed, so
   it is right on the first week and right for somebody with two residencies —
   where "what you did last week" is wrong every other night.
2. **Otherwise the venue of your last night.** `venuesUsed()` is already
   ordered newest-first off the archive, so this is free, and it is the
   "remember last week" that was actually asked for. It carries a one-venue
   host who has set nothing up.

**A HABIT, NOT A BOOKING**, which is why it is one weekday rather than a date:
a residency is "Thursdays" and stays true for months, where a diary of dates is
a thing somebody has to keep up or it starts lying — and this app's fifth
constraint is that a feature's real price is the admin it creates on a Monday.

Four things that are load-bearing:

- **TWO VENUES CLAIMING TONIGHT MEANS NEITHER GETS IT.** A double booking is a
  real thing in December, and picking whichever sorted first would put one
  pub's prizes in front of another pub's room. Nothing is offered and the
  picker is left blank, which is exactly what happened before this existed.
- **NOTHING IS SILENT.** The quick-launch button prints *"at The Station Tap ·
  your usual night here"*, and the pack card's picker shows the name with the
  prize line underneath saying what that venue puts up. A guess nobody can see
  is worse than no guess, because the failure it produces — the wrong pub's
  prize on the winner's phone — surfaces at the final scores in front of a room.
- **6AM ROLL-OVER**, the same as the photos and Past gigs. A quiz running past
  midnight is still Thursday's night, so a host launching a second game at half
  twelve must not suddenly be handed Friday's pub. The weekday is stored as a
  NAME rather than a number, because `0` is Sunday in JavaScript and Monday in
  a diary.
- **THE VENUE IS THE ONLY THING REMEMBERED, and that is deliberate.** Look,
  card shape and prizes are per-night decisions the pack card exists for — and
  **online mode and team play change how the night is SCORED and what the
  phones show**, so a remembered "online" from a corporate Thursday would
  quietly invert rule 8 in a pub on the Saturday. A venue cannot do that: it is
  a label on the night and a set of prizes, and both are on screen before the
  press.

`setVenueDetails()` replaces `setRewards()` and writes only the fields it was
SENT, so saving prizes cannot clear a usual night or the other way round — the
same reason that method exists rather than being a call to `saveCustomer()`,
which writes the whole record and would blank the address and the fee. The
route is still `PUT …/rewards`: a route is not a label, and renaming it would
404 for any console still open in a tab when this deploys.

**The venue picker is a real `<select>` now**, with "Somewhere else" last,
swapping in a text box. It was an `<input list=…>`, which is both a box and a
list and therefore looks like neither: a datalist draws no chevron, so the
field said "type something" while quietly holding a list nobody could see. The
GUI rules already settled it — the chevron on its block of gradient is *the
affordance that says this opens*. A one-off venue still needs no record made
for it first, which is the promise the night's free-text `venue` was built on.

**They are never called gold, silver and bronze on screen.** Those are the
subscription tiers, and a quizmaster would be reading "Gold prize" on the same
page that tells them they are on Gold — the label collision the sweep looks
for, one level up. It is **1st / 2nd / 3rd** everywhere. The medal COLOURS are
fine and are what the cards are tinted with; gold already means first place
everywhere in this app.

**A TIE TAKES BOTH FIRST PRIZES AND THERE IS NO SECOND.** `rankPlayers` gives
1, 2, 2, 4 so the projector never lies, and the vouchers follow the POSITION
rather than the top three rows — so two people who finished level both get the
first prize, and the runner-up's drink is not quietly handed to somebody the
room watched finish equal. A gap in the middle cannot be expressed either:
trailing blanks are dropped and a blank second place stops the list, or third
place would collect what the board calls second.

**A SCREENSHOT DOES NOT BREAK IT, because the phone is not what gets checked.**
The first instinct is that a picture of a code can be forwarded, so a voucher
can never be single-use — that is only true if the PHONE is the thing being
verified. Redemption happens on the SERVER: the first scan spends it and every
later one is told when it went. The copy is worthless because the copy is not
what is being asked.

**It does NOT redeem on load, and that is deliberate.** The winner will scan
their own code out of curiosity — everybody does — and a page that burns it on
sight costs them their drink for looking. So the page SHOWS it and the burning
is a deliberate press, worded at the person behind the bar.

**AND THE HOST CAN PUT IT BACK.** One tap on the control view, for when the bar
comes over and says it is not working. That is what makes burn-on-first-scan
safe rather than clever, and it is the same rule that makes `Back` undo a
reveal: nothing is a dead end, and the override belongs to the person actually
in the room. The reinstate COUNT shows only above zero, like the wander badge
staying quiet until three — three means either the bar cannot reach us or
somebody is working it, and both are worth knowing before a fourth tap.

Six things that are load-bearing, all tested:

- **The code is a CREDENTIAL, so it lives in one payload.** The bar has no
  login; holding the code is the whole proof. That is the same class as the
  answer key and it follows the same rule — never in `screenView()` (the
  projector is pointed at a room), never in anybody else's `playerView()`.
- **A TEAM gets one voucher between them.** It is issued to the BOARD ROW, not
  to a player, which is what makes teams free: `leaderboard()` already returns
  one row per team. Six members and six codes would be six drinks.
- **A TIE gets one each.** The room watched two names finish level, and an app
  that quietly picked whichever sorted first would be choosing a winner the
  projector did not.
- **Issuing is idempotent.** `Back` off the final and forward again is one
  press each way and a host will do it; a second code would leave the first one
  in somebody's hand looking perfectly valid.
- **An ordinary night gains NOTHING.** No reward means no voucher, no panel and
  not one new field in any payload. `pub-unchanged.mjs` reports 2,150 identical
  comparisons with `--ignore reward,voucher,vouchers`.
- **The name is on the card**, which stops nothing technically and works the
  way a paper voucher does: the bar can say "you are not Quizteam Aguilera"
  with no system at all.
- **It is the end of the QUIZ, never the end of a ROUND.** The host runs one
  round of twenty, so the round board after round one is the last stop before
  the final — and a prize appearing there would be handing out drinks with the
  quiz still running. Two things would both have to break: issuing happens on
  the way INTO `FINAL`, and the card is only in a payload at `FINAL`.
- **A game launched before this existed still works.** `rewardList()` reads the
  old single `reward` when the list is EMPTY — not when it is absent, which is
  the version that silently did nothing, because `freshState()` sets
  `rewards: []`. Same shape as `cardShape()` reading `cardSize` or `cardRows`.

**The word is REWARD, never PRIZE**, and the launch field says **What they
win**. Bingo already has PRIZES — how many lines pay out before the full house
— and two controls on one card both saying prize, one meaning a count and one a
thing, is exactly the label collision the sweep now looks for.

**Neither button on the host panel is red.** Nothing there is destructive:
marking it used is what happens to every voucher, and putting it back undoes
it. A red "Mark it used" would read as "you cannot undo this", which is the
opposite of true, on the one control the bar is standing there waiting for.

**THERE IS A DEMO ONE TO SHOW A VENUE**, on My account: a QR a landlord can
scan across a table to see exactly what their bar staff would see. The feature
is hard to describe and obvious once seen, which is the whole reason it is
worth a panel.

`/v?c=DEMO` is handled ENTIRELY in the browser — no request, nothing stored, a
fresh one on every reload and a "Show it again" button after it is spent — so
it can be shown to as many people as you like, with no game running, at four in
the afternoon. It draws through the same `drawn()` the real one uses, so a
venue is shown what they would GET rather than a mock-up that drifts from it.

**`DEMO` can never collide with a real code**, and that is a property rather
than a coincidence: the voucher alphabet has no vowels, so `E` and `O` cannot
appear in one `newVoucherCode()` produces. No reserved-word check is needed.

**Pub wifi is assumed to fail.** The short code is written under the QR, the
`/v` page tells a failed fetch apart from a bad code in words, and the host can
mark it used by hand. Same rule as everywhere else here: a network problem is
never the end of it.

## The diary — a calendar that maintains itself

`public/assets/diary.js`, the **Coming up** half of the **Gigs** tab, and
`bookings` in the invoice book. `FEATURES.CALENDAR` has been on Bronze saying
*"Not built yet"* since the ladder was written; this is it, and the blurb has
come off the not-built list along with its test.

**ALMOST ALL OF IT IS DERIVED, AND THAT IS THE WHOLE DESIGN.** A diary of dates
somebody has to keep up is a diary that starts lying the first week they are
busy — and this codebase's fifth constraint is that a feature's real price is
the admin it creates on a Monday. So the recurring nights come out of something
the quizmaster already maintains for a different reason: `usualNight` on the
venue record, which exists so the launch bar knows whose night tonight is. A
host with their residencies set up has a working diary having typed nothing.

What is left to type is only the part a pattern cannot express:

- a **one-off** — a Christmas party, a corporate booking, a stand-in Tuesday;
- a **night off** — the Thursday the pub has a darts match on.

Both are exceptions rather than the thing itself, which is the right way round:
the common case costs nothing and the rare one costs a tap.

**A NIGHT OFF WINS OVER EVERYTHING**, applied before either source that could
put a night on the page. The diary saying you are at The Crown on a Thursday
you are not is the one failure that makes the whole feature untrustworthy,
because it is believed. There is a test that a booking cannot beat a
cancellation.

**A booking on the usual night ANNOTATES it rather than duplicating it**, which
is what lets somebody write "they want bingo after" on an ordinary Thursday
without inventing a second entry for one night.

**IT LIVES IN `public/assets/` BECAUSE THE DATES ARE THE READER'S.** Same
arrangement as `plans.js`, `looks.js` and `balance.js` — the console imports it
in the browser and the test imports it in node. Projecting on the SERVER would
work the dates out in UTC, and the invoice code already records why that is
wrong: a night that ends at half past midnight in August is 23:30 the previous
day in UTC, so the server and the person who ran it would disagree about which
day it was. The browser is on the quizmaster's own device.

**FOUR WEEKS.** Six was built first and is a wall: two residencies print
thirteen rows and three print twenty, which pushes Past gigs a screen and a
half below its own heading. A booking further out is stored and appears as it
approaches — the right way round, because the alternative costs every reader
every day to serve the rarer case.

**The storage is the INVOICE BOOK, and it is not a second list of venues.** It
is a list of DATES pointing at venues already in there — the thing TODO.md
warns hardest against getting wrong. Same file because that file is already the
quizmaster's business record, already per room, already backed up to the
private repo and restored at boot. A file of its own would be four more
integration points for the same data, and one of them is the one somebody
eventually forgets — which is how the play counts went a year with no backup.

**`tonight()` is what the rest of the app asks it**, and a one-off beats a
residency: the Tuesday you are standing in somewhere has to win over the
Tuesday you normally do and are not doing this week. Two venues claiming
tonight still means neither, unchanged.

### Gigs — one tab, because it is one object

The calendar and Past gigs are the same thing at two points in its life:
booked, run, then billed. A tenth tab for "the same nights, earlier" would be
splitting by TENSE rather than by question, which is the opposite of the rule
that shaped the owner page — and the console's tab bar already scrolls sideways
on a phone.

**INVOICES DELIBERATELY DID NOT JOIN THEM**, and it was asked directly — *"so
date stuff in one tab and money stuff in another?"* Nearly, and the sharper
line is worth keeping because "dates versus money" would misfile the next
feature (an invoice is full of dates):

| Tab | What it is | The unit |
|---|---|---|
| **Gigs** | the WORK — what is on, what happened | a night |
| **Invoices** | getting PAID | a document with a number that can never be reused |
| **Venues** | the ARRANGEMENT — who they are, which night, what they put up | a place |

Three more reasons Invoices stays its own: it has a tab's worth behind it (your
details, the bank, VAT, statuses, the PDF); its badge counts what you are still
owed, and a second badge on one tab costs the first its meaning; and on a
Monday "send the invoices" is a destination you want to land on rather than
scroll to.

**What keeps the chain intact instead is `Invoice this` on every past night**,
filled in from the night itself — the venue matched to a record so the address
and the usual fee come with it. It existed only on the running panel, in the
minutes after a game ends, so a night from a fortnight ago could only be billed
by typing it back in from memory. That is exactly the blank page this file's
own rule says is where the time goes.

**And a past night finally says WHERE it was.** `listArchive()` has carried
`venue` since a night learned one; `past-gigs.js` simply never passed it
through, so the page whose whole job is showing somebody your work never said
where any of it happened. On the NIGHT rather than on each game, like the badge
that counts nights and not games.

## Past gigs — the record of somebody's work, and who may take it away

`src/past-gigs.js`, the `/api/past-gigs` routes, and the **Past gigs** tab on
the console. Every night already run: the date, what was played, how many were
in, who won, and the photographs from it.

**It is a record of somebody's WORK rather than a feature of the game**, which
is the host's own framing: a quizmaster pitching for a Thursday at a new venue
gets asked what they have done, and one page with two years of nights, the
packs and the pictures answers it. Both halves were already being written down
— the archive when a game ends, the photos as they arrive — and neither was
being shown to anybody. The tab that existed was "Past nights", a list of
titles, gated on the invoicing add-on because that is where it happened to
live.

### Neither half survived a deploy, and that was the real job

Found before building any of it, and it is the reason the page is worth
anything: **the night archive and the photo files both live in `data/`**, which
on a host with no permanent disk is empty again after every push. A Past gigs
page built on top of that would have gone blank every time the app was
deployed, which on the one feature whose point is "here is my history" is worse
than not having it.

So, before the page:

- **The archive backs up to the private repo** (`archive.json` for the house,
  `archive-<roomId>.json` for everybody else) and is restored **only into an
  empty folder** — the same rule as the accounts, the invoice book and the play
  counts, because a disk that already has nights on it is ahead of any backup.
  A night in a backup whose id is not plain letters, digits and hyphens is
  **refused rather than scrubbed**: stripping the bad characters out would
  quietly invent a filename rather than saying no to something that has no
  business being in a backup.
- **A room TELLS somebody a night has been filed** — `onArchive`, defaulting to
  nothing, exactly like `onSpend` on the generators. `session.js` has no
  business knowing that GitHub exists, and every test and script that builds a
  Session carries on working.
- **Photos are read from the REPOSITORY, never from the disk**, and served back
  through this server because that repo is private and a browser cannot fetch
  from it. Listing the folders in it is what the night list is made of, so
  there is no photo index to keep in sync — the same reasoning that makes the
  packs the record for `question-history.js`.

### They are foldered per ROOM now, and were not

`photos/<roomId>/<night>/<file>`. **The house keeps the flat `photos/<night>/`
it has always used**, for the same reason every other house path is unchanged:
Mark already has nights filed under it and moving them would make his own
history disappear off the page that exists to show it. Without the room in the
path two quizmasters' nights land in one folder — on the one feature whose
whole point is "this is my work", showing somebody else's pictures is about as
wrong as it gets.

### Looking is Bronze. Getting them OUT is the owner's

Asked for explicitly: *"I only want the photos export feature on my account
please, perhaps in future if I want features that only I use put them in the
owner console and not the QM console."*

So the Photos tab — file the lot away, bin the duds, hand them to the phone's
share sheet — **moved off the console and onto `/owner`**, as
`public/assets/photos-tab.js` and `FEATURES.PHOTO_EXPORT`, which is owner-only
and therefore deliberately not on the ladder. What a quizmaster gets instead is
Past gigs, **read only**: no bin, no download, no share sheet.

Two things that makes true, and neither is a compromise:

- **A quizmaster loses nothing operationally.** The kill switch and the
  per-photo bin are on the CONTROL VIEW, which is where they are wanted — with
  a mic in one hand, while the thing is on the projector. A page is the wrong
  place for that and always was.
- **Filing still happens for everybody.** A photo is pushed to the repo as it
  arrives, and `photosFile` (the retry, for when GitHub was having a bad
  evening) is still a host action. If it were the owner's, every subscriber's
  past gigs would be empty.

Be honest about what read-only means: there is no bin and no share button, and
a browser can still save an image. The point is that this is a shelf to look
along rather than an export tool, not that the pixels are locked up.

**`FEATURES.PAST_GIGS` is Bronze**, and the second reason matters as much as
the per-use rule: this is what a quizmaster shows a venue they are pitching to,
and withholding the evidence that somebody is good at their job from the rung
where they are still building the business is the wrong way round.

**The owner holds `PAST_GIGS` too** — listed in `OWNER_FEATURES`, not special
cased in `allowed()`. The owner runs gigs, on the host key, in the house room,
so the record of them is theirs to read. That is the sixth-time trap avoided
rather than hit: an owner holds no quiz features by design, so anything reached
from the owner's own page must be on that list or it 403s.

### Two smaller things it turned up

- **`[hidden]` did not hide.** `.minor { display: inline-block }` beats the
  browser's own `[hidden] { display: none }` on specificity, so "File the rest
  away" and "Clear all" sat there on a night with no photos at all, and both
  would have failed if pressed. One `[hidden] { display: none !important }` at
  the top of the stylesheet rather than remembering it at every call site.
- **`GET /api/archive/<id>` passed `err.message` through on a miss**, which is
  an ENOENT carrying the server's absolute path — naming the directory layout
  and the room id it had just looked in. The same fault this file already
  records for the advert sets and `GET /api/quiz/<id>`, in a third place.

**The tab badge counts NIGHTS, not games.** A quiz and the bingo after it are
one evening's work, so counting games put a 5 on the tab above a list of four
rows. Worked out on the server (`archiveNights`) with the same 6am roll-over
the page uses — and the roll-over has to match the photos' own, or a gig that
finished at half past midnight appears twice: the games under one date and all
the pictures under another.

## Invoicing

`src/invoices.js` (what an invoice is), `src/invoice-pdf.js` (what it looks
like) and `src/pdf.js` (a small dependency-free PDF writer, written out for the
same reason `qrcode.js` was). Split three ways so changing the look can never
change the arithmetic, which is the only part a customer argues about.

**Three rules, all of them about not being embarrassed by somebody about to pay
you:**

1. **Money is integer pence, never a float.** Pounds exist only where a human
   types or reads a number. There is a test named after 0.1 + 0.2.
2. **An issued invoice never changes.** It carries its own copy of your details,
   the customer's details, the VAT position, the terms and the bank details, so
   correcting your address next month does not rewrite what somebody was sent in
   August. Only the status moves. Registering for VAT does not add a VAT line to
   last year's invoices, and there is a test for that.
3. **Numbers are sequential and never reused.** A number is handed out when an
   invoice is ISSUED, never when a draft is started, so an abandoned draft
   leaves no hole. Cancelling keeps the number and the record rather than
   deleting it — a missing number is a question you have to answer later.

**VAT is off, and while it is off the invoice does not contain the word.**
Charging VAT, or looking like you are, when you are not registered is an
offence. The fields all exist behind `settings.vat.registered`. The host is not
registered and does not know whether he will be; this is the ground prepared,
not a feature waiting to be switched on for fun.

**It backs up to the PRIVATE repo, never the main one.** The main repo is
public and this file has customer addresses and the host's own sort code and
account number in it. `putFile(..., 'private')` — the same repo as the photos,
under a second name, because one private repo is easier to explain than two.
Without it configured an invoice survives until the next deploy, so the tab says
so in red. That warning is the same shape as the song history's and exists for
the same reason.

**Sending is the phone's own share sheet, not the app emailing.** It goes out
from the host's address, so replies reach him and it does not land in spam
addressed from nobody. On a laptop there is no share sheet, so it opens the PDF
and a pre-written email draft instead. The app's job is the RECORD — who was
invoiced, who has paid — which it keeps whether the sending happened here or
not. Do not add an email service without asking: it costs money, needs an
account, and sends from an address nobody replies to.

**Dates are formatted in Europe/London and assembled by hand.** A quiz that ends
at half past midnight in August is 23:30 the previous day in UTC, which is what
the server's clock says — and the invoice has to agree with the person who ran
the quiz. The pieces come from `formatToParts` rather than `toLocaleDateString`
so punctuation cannot change under a different ICU build. Same reasoning for the
thousands separator in `formatPence`.

**A charge with no description is refused.** It is the one line that gets an
invoice queried. A £0 line that explains itself ("Prizes — included") is fine.

---

## Getting paid: what you have not billed, and who has not paid

Two small features that share a shape — the app already held both halves of
each answer and never put them together. Both are **draft, read, send**: the
blank page is where the time goes, not the pressing of send.

### "Not invoiced" on a past night

`unbilledNights()` in `src/invoices.js`, marked onto `/api/past-gigs` and
counted on the library payload. The archive knows every night that was run and
the invoice book knows every invoice, and until this they never spoke — so
nobody was counting the nights that were played and never billed. It is money
left on the table, and it is the whole of "bill them before you leave the car
park" actually kept rather than offered.

- **A NIGHT IS A DATE AND A VENUE, so that pair is the match.** The archive's
  own key is only the date, so matching on `event.nightId` alone would be
  WEAKER rather than stronger — two venues on one date in December, and billing
  the first would mark the second done. `nightId` is written now when an
  invoice is raised from a night, because it is the stable handle anything
  later will want, but it is not what the question asks.
- **A night with no venue is never counted** — there is nobody to bill — and
  neither is anything older than eight weeks. *"You did not invoice a night in
  March"* is not a job, it is history, and a list carrying it is one somebody
  stops reading, which costs them the row that mattered.
- **A CANCELLED invoice does not count as billed.** It keeps its number and its
  record deliberately, but the night is still unpaid work.
- **Gold, not red.** It is not a fault and it is not urgent — half the nights in
  a history are ones somebody deliberately did not bill.
- **Its own span, not inside `.gig-more`** — that one is rewritten with
  "Loading…" and then the photo count the moment a night is opened, which would
  have wiped the marker.

**`billsThroughTheApp()` asks the REQUEST, not `accounts.find(room.id)`**, and
that is the trap this file keeps recording. On the bare host key there is no
account against the house room, so a lookup by room id comes back null and
`can(null, …)` is false — the feature would have been silently off on the one
console its author uses most. Found by looking at the payload rather than by a
test.

### "Chase it" on an invoice past its terms

`daysLate()` on both sides, and the button on the Invoices tab. The most
disliked admin job there is and the one most often not done.

**ONE BADGE, TWO STATES — never a second badge.** Invoices already counts what
you are still owed; somebody being LATE is a different and more urgent fact,
and the obvious move is a second badge beside the first. That is exactly what
this file's own rule refuses, because a second badge costs the first its
meaning. So the badge keeps its number and turns red.

**The words are mild and they threaten nothing** — no interest, no late fees,
no "final notice". A quizmaster wants the money AND the booking next month, and
a stiff letter costs the second to get the first a week earlier. It gives them
the out as well ("if it has already gone, please ignore this"), because the
usual reason an invoice is unpaid is that somebody forgot. The PDF goes with
it: chasing an invoice somebody has to go and find is half a chase.

**It never sends on its own**, same as `reply-draft.js`. A chase that went out
unread is the one that nags somebody who paid last Tuesday.

Two wording faults caught by reading the actual draft rather than the code:
it said *"it went out N days past its terms"*, which says the INVOICE was sent
late and reads as an apology; and an unfilled business name left a dangling
"Best," with nothing under it.
