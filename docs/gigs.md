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
**2nd** …"* — read-only there, which used to mean launch was the only moment
it could be changed at all.

**IT NO LONGER IS.** Asked for on 20 August 2026, after a real gig: a landlord
changing what's behind the bar mid-night, or a host who typed the wrong thing
at launch, used to have no way back short of stopping the game and relaunching
it — which throws every phone back into a lobby to fix a sentence. **Prizes**,
a button on the control view's action bar for either game, opens a popover onto
`state.rewards` directly — `setRewards()` on `Engine`/`BingoGame`, one shared
`session.js` action for both. Safe to just overwrite: `issueVouchers()` and
`drawLuckyDip()` (quiz) and `issueVoucher()` (bingo) all call `rewardList()`
fresh at the moment a prize is actually won, never a copy taken earlier, so an
edit only ever reaches the NEXT prize handed out — one already on somebody's
phone stays exactly as it was, the same rule every voucher in this app follows.

**Deliberately NOT folded into the Setup panel**, which only draws at the
lobby and at the end precisely so it never sits across the control view
mid-round — see the comment on `prizeLine()` in `host.js`. A popover keeps
that promise: present at every phase via one more button, taking no space at
all until it is pressed.

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

- **TWO VENUES CLAIMING TONIGHT MEANS NEITHER GETS IT.** Not a double booking,
  and the words matter: one quizmaster is in one room, so at most one of the
  two is where they actually are. It is the APP holding two answers for one
  night — two residencies on a Friday in December, say — and picking whichever
  sorted first would put one pub's prizes in front of another pub's room.
  Nothing is offered and the picker is left blank, which is exactly what
  happened before this existed.
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

---

## THE MONTH IS ON THE LEFT AND WHAT YOU DO ABOUT A DATE IS ON THE RIGHT

`diarySection()` in `console.js`, `.cal-wrap` / `.cal-side` in `style.css`.
Asked for directly: *"perhaps the calendar needs to sit off to the left in the
section to allow room for the right to populate?"*

**It fixes a real fault rather than only looking tidier.** Full width, the
month was seven columns of mostly-empty boxes, and what answered a date was a
thin strip UNDER it — so picking the 23rd pushed the answer below the fold and
the form it sent you to was below that again. Beside it, a date and what you
can do about it are one glance. Two columns from 900px only: below that the
month is the tight thing — seven columns of a 320px phone is 38px a day — so
the panel goes underneath and **the picker scrolls it into view**, because
that is the same below-the-fold fault arriving on the device this is most
often held on.

**The panel is the diary when no date is picked and that date when one is.**
Two jobs in one column rather than two columns of their own: what is coming up
is what you READ and a date is what you ACT on, and they are never both
wanted.

**THERE IS ONE PLACE A NIGHT IS ADDED, AND IT IS THE DATE YOU PICKED.** The
bottom of the tab used to carry its own date box, venue and *Add a night* —
a second control for a job the month already does, which is exactly how a
booking lands on the date the other one happened to be showing. **Book a
quiz** now opens the whole form against the date in the heading, at the host's
own instruction: *"perhaps when you click 'book a quiz' it just asks for all
quiz info like venue, time etc."* The date is the heading rather than a field,
because it is the thing you clicked to get here and a box repeating it is a
second place for it to be wrong.

**A NIGHT CAN CARRY A START TIME NOW, and it is optional on purpose.** A
residency has none — the venue's arrangement lives in no record here — so
demanding one would make somebody invent a fact in order to save a booking.
Given, `src/ics.js` writes a real timed appointment instead of a day-long
block, **floating**: no `Z` and no `TZID`, so "8pm" means 8pm where the
quizmaster is rather than wherever the server guessed. The two-hour length is
a stated DEFAULT, because every calendar client needs an end and an event with
no length is not an appointment. **The end date moves with the clock** — half
eleven ends at half one the NEXT day, and writing that against the same date
is an event ending twenty-two hours before it starts, which a calendar either
refuses or draws across the whole day. Tested.

**"NOT ON" IS NOW TWO LABELS, AND THE OLD ONE WAS INVISIBLE RATHER THAN
WRONG.** Asked directly — *"not sure what 'not on' would be useful for"* —
and the honest answer is that the button did the right thing and nothing on
screen could teach it: it writes one week of a residency off, the night then
vanishes from the diary and from the calendar feed, and nothing said so or
offered a way back. **A control whose entire effect is something disappearing
is a control nobody can learn.** Three changes, and none of them is the
behaviour:

- **"Not on this week"** on a residency, which is what it always did. It was
  *"Not on"* — a verb with no object, which is the label collision this file's
  sweep already looks for.
- **"Delete this booking"** on a one-off, because that is a real row somebody
  typed and the thing you want is for it to be gone. One label used to cover
  both acts on both objects.
- **A written-off night is SHOWN on its own date**, named, with **Put it
  back** on it — `removeBooking`, because forgetting the exception is what
  returns a residency to being an ordinary one.

**A NIGHT IN THE LIST IS SOMETHING YOU READ, NOT TEN THINGS YOU DO — and the
first build of this got it wrong in a way the host spotted immediately.** The
"coming up" list used the same card as the day panel, buttons and all, so
**Invoice it** and **Not on this week** appeared on every one of ten rows. Two
faults, and the second is already a rule in this file:

- **A WALL OF RED.** *"Don't want a wall of red either"* — his own line, set
  when three tinted button options were turned down. Ten outlined-red buttons
  in a column is louder than one filled one, and it made an ordinary diary
  read as ten things that had gone wrong, on a page whose only other colour
  was a pink underline on the button beside it.
- **It contradicted the panel's own split.** What is coming up is what you
  READ; a date is what you ACT on. Actions in both halves meant the day panel
  was not *the* place a night is dealt with, it was one of two.

So a list row is the date, the place and what it plays for, and **the whole row
picks that date** — landing you in the day panel where the actions are, with
the month moved to the right month on the way. *"No prizes set"* went with
them: printed ten times it is noise, and it is still said in the day panel,
which is where it can be acted on.

**And the month is STICKY beside it** at 900px and up. A month is five rows and
the list is however many nights you have, so the left column ran out a long way
above the right one and the bottom half of the section was a black void with a
list floating in it. Sticky, the calendar is still there to click when you
reach the end of the list — which is exactly when you want it.

**AND "INVOICE FOR THIS DATE" GOES TO THE INVOICES TAB** rather than opening a
form over the calendar, at the host's own reading: *"'invoice for this date'
goes to the invoice section with that date pre-filled"*. He is right, and the
reason is what happens AFTER you press send — over the calendar you are left
standing on a month with no sight of the invoice you just raised, its number
or whether it is still a draft. Landing on the tab that owns them means the
thing you made is on the page behind the form. The date crosses as a
`pendingInvoice`, consumed once by `invoicesSection()` after its own book has
loaded — which is also what turns the venue NAME into a customer id, so the
calendar raises an invoice without fetching the invoice book at all.

---

## The last slide of the night — "Back here Thursday 20th"

`src/comeback.js`, `state.comeBack`, the band in `comeBackBand()` in
`client.js`, and **Where to send them** on the Venues tab.

The winner is up, the room has a drink and every phone in the place is out.
**That moment used to be spent on a scoreboard nobody needs any more** — it is
the one point in the evening when the whole room is looking at the screen with
nothing to do, and telling them when the next one is costs nothing. It is the
cheapest thing this app can do for the venue's takings, which is what gets the
quizmaster booked again.

**IT WRITES ITSELF, and that is the decision worth keeping.** TODO.md said "a
line of text and a link, typed at launch", and that was right before the Venues
tab existed. It does now: a venue carries its USUAL NIGHT and the diary already
projects those forward. So the date is derived, there is nothing to type at the
moment the host is most rushed, and it cannot go stale — the same reasoning
that shaped the diary itself. A "what to say at the end" box on the launch form
is a box that is blank by the third week and then puts a wrong date in front of
sixty people.

**A NIGHT WRITTEN OFF AND A ONE-OFF BOTH WIN, for free**, because it asks
`upcoming()` rather than doing weekday arithmetic of its own. Saying "back here
Thursday" on the Thursday you are not coming is the one failure that would make
the slide untrustworthy for good, and the diary had already solved it.

Six things that are load-bearing, all tested:

- **Resolved at LAUNCH, on the server, into the game state** — like the prizes
  it sits beside, and for the reason the look and the card shape taught: the
  room is looking at this slide at half eleven, which is exactly when a free
  host restarts. A stale console also cannot promise a room a date that was
  cancelled this morning.
- **UNDER the winner and the podium, never over them.** Somebody has just won
  a quiz in front of a room; next week's date has no business being the biggest
  thing on that screen. It is a band, in the same place and shape as the draw.
- **At the FINAL and nowhere else** — never over a round board, and in bingo
  never over a call sheet somebody is marking. Two things on one projector is
  the fault this app refuses everywhere else.
- **The host sees it from the LOBBY on.** They are the only person who knows
  they are not doing the 20th, and a wrong date is worse than no slide — seen
  early there is still time to fix the diary. It is also the line they say into
  the mic, which is this app's shape everywhere: the app prepares, the human
  reads it out.
- **A QR may only ever carry http(s)** (`safeLink`, shared with the venue
  record). Everything else on that slide can be read from the back of the room
  and checked; a QR is the one thing sixty strangers point a camera at without
  being able to see where it goes. A link with no scheme typed is assumed
  https rather than thrown away, because that is how somebody copies one off a
  card.
- **Silence when there is nothing true to say.** No usual night and no link
  means no band at all, rather than a slide with a hole in it. A link with no
  usual night still gets one — that is a pub with an events page and an
  irregular quiz, which is a real arrangement.

**It is NOT on anybody's phone**, deliberately. The room is looking up for
this, the QR is scanned off the big screen, and rule 8 keeps a phone to the
job it has.

**The link lives on the VENUE record** — the invoice book's customer, the same
one that holds the prizes and the usual night — because a second list of one
real-world thing disagrees with the first within a month. It is the VENUE's
page rather than the quizmaster's: the room is being sent back to the pub,
which is what the pub is paying for.

---

## Headcount per venue — the app finally says a number it always knew

`src/headcounts.js`, `library.headcounts` in the console payload, and the
`heads-*` block drawn on a venue card and on the Gigs tab.

**"The Crown went from 22 on a Thursday to 58" is the most persuasive sentence
a quizmaster owns**, and every one of those numbers has been on disk since the
app was written. The archive files a headcount every night; Past gigs printed
it once on the night's own row and **nobody had ever seen it twice.** Nothing
new is collected here, nothing is asked of anybody, and there is no consent
question — this is arithmetic over a record that already existed.

**ONE FUNCTION TAKES A SET OF NIGHTS AND RETURNS THE NUMBERS ACROSS THEM.**
`venueHeadcounts()` is worked out once on the server and sent once; Venues
opens one place and Gigs shows all of them, out of the same record. That is
this file's own rule about stats across a group of accounts, applied to
venues, and it is here for the identical reason: shipping "the trend for one
venue" and later "across all venues" as two features is how the card and the
panel end up disagreeing about a number somebody is showing a landlord.

It takes what `mergeGigs()` returns rather than the raw archive, which buys
the **6am roll-over** and the quiz-plus-bingo grouping for nothing — so the
summary can never think a night was a different day from Past gigs.

Five decisions that are load-bearing, all tested:

- **A night's headcount is the MAX across its games, never the sum.** A quiz
  and the bingo after it are the same room and mostly the same phones, so
  adding them reports a 58-person night as 116 — on the one page whose whole
  job is being evidence. Past gigs already printed the max; this is that rule
  in a function so the two cannot drift.
- **A night nobody played is left out.** A launch that was tested and
  abandoned files an empty leaderboard, and counted it puts a 0 in the middle
  of somebody's trend for a night that never happened.
- **A night with no venue is COUNTED AND SAID**, in a line under the panel.
  Every night filed before venues existed has none; dropping them in silence
  means somebody with forty nights sees twelve and believes the app lost the
  rest.
- **One venue typed in two cases is one venue**, keyed lowercase and spelt as
  it was typed most recently — the same rule `venuesUsed` already follows.
- **No red for a night that went down.** Red means wrong or destructive
  everywhere in this app, and a quieter Tuesday in February is neither. The
  numbers are stated plainly and the app does not editorialise about
  somebody's own work.

**The bars are a picture of numbers that are all written out anyway**, so they
are `aria-hidden` and nothing is carried by a shape alone — the same reasoning
as a control whose only explanation is a `title`. They are the account's own
colour at half strength with the LATEST night at full, and deliberately **not
a filled gradient**: that is what "press this" looks like here, and a block of
it that does nothing when pressed costs the real buttons their meaning.

**And the library payload now reads the archive ONCE.** Three things in it are
worked out from those files — the nights badge, the unbilled count and these —
and each used to walk the whole folder for itself. They have to agree with each
other anyway: a badge saying 40 above a panel that summarises 39 is a page
nobody trusts.

---

## A prize taken at the bar has to reach the filed night

`updateArchivedNight()` in `src/library.js`, and `state.archivedAs`.

A night is archived the instant it reaches the final scores — and the bar
scans the winner's QR several minutes later. So **every night in the record
said the prize was never taken, for ever.** The live panel on the control view
was right and the permanent record was wrong, which is the worst way round:
one is a screen you glance at, the other is the evidence a quizmaster shows a
venue.

An UPDATE rather than a second archive, and it needs no new hook —
`redeemVoucher()` and `reinstateVoucher()` both call `changed()`, which is
what the session watches. Compared against what was last filed before writing,
or a game left sitting on the final scores would rewrite the file on every
push. The updated record is pushed to the backup again, or the fix reaches
this disk and nothing else.

**IT ALSO FIXED A DUPLICATE NIGHT NOBODY HAD NOTICED.** The flag that stops an
evening being filed twice was `archivedThisGame` on the Session — set when the
night was archived and cleared by `build()`, **which runs on boot**. So a
restart while a game sat on the final scores filed the whole evening again,
and two copies turned up on Past gigs. On a host whose disk is wiped every
deploy that is not the unusual case. It is `state.archivedAs` now: the state
is the record of the night, so the fact that it has been filed belongs in it —
the same lesson as the bingo card shape and the look.


---

## PUTTING A NIGHT ON THE PUBLIC GALLERY

`galleryToggle()` in `console.js`, `/api/past-gigs/publish`, `src/gallery.js`.

**THE ROUTE EXISTED FROM THE DAY THE GALLERY WAS BUILT AND NOTHING EVER CALLED
IT.** A night could be published only by hand, which in practice means not at
all — on the feature whose entire purpose is putting a night up. The gate was
perfect and the gate had no handle.

That is the same class of miss as the projector's arcade board and the launch
route: the server was ready, the page was ready, the tests passed, and no
control joined them together. **A test that the route works proves nothing
about whether anybody can reach it**, so `test/gallery.test.js` now also
asserts that something under `public/` calls it. A text search is a weak check
and is the right weight, because the fault was not a broken caller — it was the
total absence of one.

**AND WHEN A CALLER WAS FINALLY WIRED UP, THE ROUTE 404ED.** It was defined
inside `handleGet`, which is only ever called for GET and HEAD — every POST
goes to `handleWrite` — so a POST to it fell through to the generic 404 and had
done since the day it was written. **Dead code that read as a working
feature**: the gate was tested, the page was built, this file described it, and
the one call that puts a night up could never have been answered.

Found by a browser agent posting to it and getting *"Not found"* where the
honest answer is *"there is nowhere to record this"*. The test now POSTs over
real HTTP and **asserts against the 404 rather than for the 400** — that
difference IS the bug, and it is invisible to anything that does not make the
request. Verified by putting the handler back in `handleGet` and watching it
fail.

**IT SITS UNDER THE PHOTOGRAPHS, AND THAT PLACEMENT IS THE SAFEGUARD.** It is
inside a night that has to be opened, below the pictures it would publish — so
nobody can put a night in front of the world without having just looked at
what is in it. A button on the collapsed row would be one tap from a stranger's
face going public, taken on a phone whose only promise was that it *"goes on
the big screen"*.

**IT SAYS WHAT PUBLISHING MEANS, in one line** — *"Anyone with the link can see
these."* The house style says a control gets a title and one short line, and
that warnings are the exception because they are read once at a moment that
matters. This is one, and it costs somebody something real if it is not said.
Not styled as a warning and not red: it is a plain statement read BEFORE
pressing, and red would say a mistake had already been made.

**TAKING IT DOWN IS AS PROMINENT AS PUTTING IT UP.** Somebody will ask for
their photograph to be removed, and the only honest answer on a page with no
contact details is a quizmaster who can do it in one tap while they are stood
there. Destructive-styled — outlined red, never filled.

**The published state rides on the call that is already made.** `/api/past-gigs/
<night>` carries `published`, rather than a second request: a button that has
to fetch before it knows its own label is a button that flickers.

## CHECKING THE PHOTOS IS THE NEXT PRESS, NOT A PAGE YOU GO AND FIND

Asked for on 17 August 2026, and the wording is the design: *"at the end of the
quiz it's showing the winner on the scoreboard, you do your well dones etc, and
then the next click takes you to a huge CHECK PHOTOS link that you can't dodge
— it's part of the flow."*

**It replaced two weaker answers, and both are worth knowing about because the
instinct to go back to them will return.**

The first was to publish the night automatically when the scoreboard went up.
That fails on a fact in the code rather than on taste: `PHOTO_PHASES` in
`screen.js` includes `final`, `won` and `finished`, and photo uploads are not
phase-gated at all — so the room is still sending pictures at the moment the
scoreboard appears. Auto-publishing there publishes a night that is not
finished arriving.

The second was a prompt on the console: finish the night, and the console
suggests checking the photos. **That is a page you go and find.** At half past
eleven, with the room emptying and kit to pack, a suggestion on another screen
is a suggestion that loses. What makes this happen at all is that it is the
next press in a sequence the host has been making all evening, in the same
position, at full size.

**AND IT IS THE LAST MOMENT THE ROOM IS STILL THERE.** Somebody who wants their
photograph out is stood in front of you now; on a Monday they are a message you
cannot answer with a bin. That is the argument for tonight rather than for a
tidier time.

### What the button actually did before

`buildActions()` set the primary at `final` to *Finished*, `disabled`. **A dead
control, in the one place the thumb has been all night, at the exact moment
there is still work to do.** This repo already has a rule about controls that
appear and disappear — *build the next one present and inert* — and this is its
other half: a control that is present and inert when there IS a next thing is
the same waste wearing the opposite hat.

### It opens the night. It does not publish it.

The press lands on Post gig → Past gigs with the night on the bench and **its
row already open**. The publish control is where it always was, underneath the
photographs, and it is still a deliberate press — the safeguard is that nobody
puts a night in front of the world without having just looked at what is in it,
and a button that arrives having skipped the looking would remove exactly that.

**Opening the row was the second half of the job and it is not cosmetic.**
Landing on the bench alone left an *Open its photos* button between the host
and the pictures, which is the tap that does not get made. It goes through the
row's own head — the same call the bench's own button makes — so there is one
implementation of "show me this night". A second one would drift, and the way
it would drift is into a gallery with no bin on the pictures.

### The two joins, and why each is where it is

**The night rides in the URL** (`?night=YYYY-MM-DD`) rather than `host.js`
writing the console's `localStorage` directly. Two pages writing one key is how
a contract drifts silently — the console is free to change how it remembers a
bench, and would take the control view down with it. A link can also be
followed twice, shared or bookmarked, which a storage write cannot.

**The key is the 6am roll-over**, identical to `nightOfGig()` and
`photos.nightOf()`. A quiz that ends at half past midnight would otherwise open
tomorrow, with nothing under it, on the one night the host most wants the thing
to just work.

**And the console sets the bench WITHOUT rendering.** `putNightOnBench()`
renders, and at boot that runs before `load()` has fetched anything — `library`
is still null and the first paint throws on `library.brand`. That is the third
boot-order fault of this work, after the moved `load()` call and `offerRoomId`:
**a thing that is entirely right once the page is up, run one step too early.**
The pattern is worth naming, because `node --check` cannot see any of them.

### THE BENCH'S PUBLISH BUTTON OPENS THE PHOTOGRAPHS, IT DOES NOT PUBLISH

Decided 19 August 2026, as one of a batch of decisions taken up front rather
than asked mid-build — the host answered by picking an option in a menu, and
the reasoning is worth keeping so the choice is not re-litigated.

**The bench's own "Put it on the gallery" button was a second door onto the
same route, and it skipped the safeguard the first door was built for.** The
control under the photographs works because it is inside a night you have
opened, below the pictures it would publish — nobody puts a stranger's face
in front of the world without having just looked at what is in it. The bench
does not have to be opened to reach its own copy of that button, so pressing
it published directly, with nothing looked at.

Three ways out were on the table: take the bench button off, make it open the
photographs first, or leave it on the theory that the bench only ever holds a
night you deliberately put there. **The middle one was chosen, because it
keeps the shortcut and cannot skip the looking.** The button now does exactly
what *Open its photos* next to it does — clicks the row's own head, through
the one implementation of "show me this night" that already exists rather
than a second one that could drift from it.

**Taking a night OFF the gallery stays direct, deliberately.** The safeguard
exists for publishing, not for withdrawing — removing a photograph from public
view is never the risky direction, and somebody asking for their photo down
while stood at the bar deserves the fast path, not an extra screen.

## THE POST-NIGHT REPORT — a PDF for the venue, out the share sheet

Decided 19 August 2026, in the same batch. TODO.md had held the entry for
days: *"every number it needs already exists, and the venue join is built, so
nothing blocks it now."* That was true, and the actual work was joining four
things that had never been read together — the headcount, the podium, the
photo count and the advert opens — because each had only ever been read on
its own.

**Where it lives settles a question the entry left open.** Two places were
possible: the Post gig bench, in the minutes after a quiz ends, or the Gigs
tab under the archived night. **The archived night won**, on the same
reasoning that separates Gigs from Calendar elsewhere in this file — Gigs is
evidence, and evidence is something you show somebody, which is a better fit
for the morning after than for the car park. A landlord reads a PDF at
half past eleven the way they read a text message at half past eleven: not at
all.

**It shares exactly like an invoice, and that is not a coincidence — it is
the same decision, asked a second time and answered the same way.** No email
service: the PDF goes through the share sheet, or a laptop gets a new tab with
the file in it. It goes from the quizmaster's own account, never from this
app's, which is the whole reason invoicing chose that shape in the first
place — a venue receiving a report from `quizporium.co.uk` about a
self-employed person's night is exactly as wrong as an invoice would be.

### The podium needed a read nothing else asks for

`listArchive()` only attaches a leaderboard when called with `{ boards: true
}`, and every existing caller of Past gigs — the list, the per-night photo
fetch, the publish route — asks without it, because none of them has ever
needed second or third place. The report route is the first one that does, so
it is the one place that cannot reuse another route's read of the archive
verbatim.

### The route has the same prefix trap the publish route already has

`/api/past-gigs/<night>` matches on `route.startsWith('/api/past-gigs/')` and
reads everything after the prefix as the night. A route for
`/api/past-gigs/<night>/report.pdf` added anywhere below that would have its
own path read as a night — `2026-08-19/report.pdf` is not a date, so it would
404 as "no night with that date" instead of building a report, which looks
exactly like a broken link rather than a routing mistake. It sits above the
generic handler for the same reason the publish route already does, and the
comment on it says so, because `node --check` cannot see a route ordered
wrong — the file still parses.

### What it does not attempt

**It does not try to attribute advert opens to one night.** An offer belongs
to a venue, not to an evening — the same fact `src/adverts.js` states about
slides generally — so there is no way to say "these eleven scans were from
Thursday's crowd" and the report does not pretend otherwise. It shows the
venue's running total instead, which is the honest version of the same number
and is still worth printing: it is one more thing the app already knew and had
never said out loud, the same argument `headcounts.js` makes for the room
size.

**It matches a venue to its adverts by NAME, the same limitation
`venueKeyOf()` already documents.** Advert packs carry a `venue` field, not a
`venueId` — the join is free text on both sides, lowercased. A venue renamed
after its slides were written reads as having none.

## THE ADVERT SLIDE EDITOR HOLDS THE OFFER, AND READS ITS OWN COUNT BACK

Decided 19 August 2026, in the same batch as the bench button and the report.
The counting itself was already finished and untouched by any of it —
`src/offers.js` records an open and totals them, `/o/<pack>/<slide>` records
one on every scan, and the projector already points its QR there whenever a
slide carries a code. **What was missing was entirely on the console, and it
had never been asked for as a separate feature — it fell out of finishing a
half-built path**, the same shape as the picture upload on a slide before it:
the mechanism worked and nobody had built the door onto it.

### The editor gets what the answer needs, not one field at a time

The host's own framing, when asked which fields to add: *"the advert slide
should be there for an image upload plus anything associated with the offer —
QR codes, dates etc."* **That is a description of the whole offer, not a list
of two fields**, and it settled the shape: `offerCode` and `offerWhen` sit
together, right where the link already was, because a code, when it is valid
and the link it drives are one decision a venue makes about one deal, not
three separate ones typed into three separate places.

### The count rides on the same fetch as the pack, deliberately

`editAdvertSet()` already fetches `/api/advert/<id>` to open a set for
editing — that is not new. What changes is what that route now answers with:
`{ ...pack, opens: room.offers.forPack(id) }`, so the editor opens the pack
and the count in one request rather than two that could arrive out of step,
or one that is simply forgotten. **The count is then held APART from `pack`
in the browser** — `const { opens, ...rest } = loaded` — because `pack` is
exactly the object `#adSave` PUTs back, and `opens` is not a field any
advert pack has ever had. `normaliseAdvertPack()` would drop it silently on
save regardless, since it builds the saved object from named fields rather
than spreading the input, but keeping it out of `pack` in the first place is
the honest version of that safety net rather than a reliance on it.

### Silent twice, for two different reasons

**No code, no line at all** — there is nothing to count, and a blank counter
under every slide would be furniture on the slides that do not use one.
**A code with nothing scanned yet says "No opens yet"** rather than staying
silent, which is a small but deliberate difference from the first case: once
a venue has committed to a code, the app should say where it stands even when
that answer is zero, the same instinct that put an unbilled badge on a night
with nothing invoiced yet rather than nothing at all.

## AND THE PREVIEW DID NOT WORK ON THE HOST KEY

The owner sees unpublished nights on `/gallery`, marked — asked for directly,
so the whole path can be proved before a single photograph becomes public. It
hangs on the server knowing who is asking, and **the page never sent the host
key with its own requests**. A signed-in account sends a cookie and needs
nothing; somebody arriving on a `?key=` link sent nothing at all, so the
preview silently did not work and the page looked empty — on the identity most
likely to be checking it.

The key is read **from the URL, never from localStorage**, which is the rule
this app already follows for links: a remembered key must not spread itself
onto new pages and into browser history. This one is already in the address bar
of the visit that is happening, so nothing new is exposed. A customer's link
carries no key and it is a no-op for them.

**It goes on the IMAGES as well as the listing**, because the photo route
re-checks for itself rather than trusting that the listing let you through —
without it a preview would be a page of broken pictures.

## "ADD A PAST GIG" WAS ASKED FOR AND THEN DELETED — do not re-propose it

Settled by the host on 17 August 2026: *"I only did this once to test some
functionality but I don't want QMs adding past gigs and I don't see the
point."*

**The reason it looked useful is that HE did it once**, filling a night in by
hand while testing — which is the classic route to a feature that serves the
person building the app and nobody else. The list has a rule for exactly this:
if it only ever helps Mark, it is not a product feature.

**And the cost is worse than the absence.** Past gigs, the headcounts and the
league are EVIDENCE — the numbers a quizmaster shows a landlord. Every one of
them is currently true by construction: the app recorded the night, counted the
phones and filed the leaderboard. A hand-typed night puts an unverifiable
figure into the same column as a measured one, with nothing on screen to tell
them apart, on the one page whose entire value is that it cannot be argued
with.

If it ever comes back, that is the thing to solve first: how a filed night says
whether the app measured it or somebody typed it.

## AUTO-PUBLISHING THE GALLERY WAS REPLACED BY A STEP — and that is better

Settled with the host on 17 August 2026, after three answers were tried and two
were wrong.

**The question was when a night counts as "over" so the gallery could publish
itself.** The calendar cannot say: a booking has a date and an optional start
and **no duration at all**, so "when the calendar thinks it is over" means
"start plus a made-up two hours". The host's own answer was better and matched
what the app already believes — *"the night is probably over once the
scoreboard goes up"* — and it is right: `isOver(state)` at the final phase is
exactly when a night is archived and `finishedAt` stamped.

**But publishing at that moment would have gone out too early**, for a reason
that only shows up in the code: **photo uploads are not phase-gated.**
`/api/photo` checks whether photos are switched on, not what phase the game is
in, and `PHOTO_PHASES` deliberately keeps photos on the projector at `final`,
`won` and `finished` — **the winner announcement is peak photo time.** So an
auto-publish at the scoreboard would publish a night before its last
photographs arrived, and those would land on an already-public page with
nobody having looked at them. That is the safeguard this file already records
— the publish control sits UNDER the photographs so nobody publishes a night
without having just seen what is in it — failing silently.

**So the host replaced the whole idea:** *"perhaps there should be an extra
step — you finish the night on the console, do your well dones and thank yous,
and the console prompts you to check the photos as the very next step?"*

That is the shape CLAUDE.md argues for everywhere: **the app prepares, the
human presses.** It keeps the looking and makes the app ASK for it, at the one
moment the room is still there to be asked about a picture. `runningPanel()`
shows it once `running.finished`, and it puts the night on the Post gig bench —
keyed by the same 6am roll-over as the photos, so a quiz that ended at half
past midnight lands on its own night rather than on tomorrow with nothing
under it.

**Do not re-propose auto-publishing** without answering the upload window
first.

---

## THE GALLERY ONLY HOLDS WHAT LOOKED LIKE A CAMERA TOOK IT

Asked for directly on 23 August 2026: *"if people upload photos for a bit of
a laugh on the night, I don't necessarily want those going into the gallery
for the night, but them appearing on the screen can be fun."* **Two things
were being asked for, not one, and the whole feature is keeping them
separate rather than tightening the upload itself.** The projector stays
exactly as loose as it always was — any image, camera or gallery, still goes
up between questions the moment somebody sends it. Only the PUBLIC page,
built afterward from the private repo, gets pickier.

**The obvious tool — EXIF's `Make`/`Model` tags — turned out to be
unreachable from where it looks reachable.** A camera photo carries that
metadata; a screenshot (near-universally PNG) or a downloaded meme almost
never does. But the upload in `play.js` redraws the chosen file onto a
canvas before it ever leaves the phone — filters, stickers, the square 1080
crop — and `canvas.toBlob`/`toDataURL` strips every byte of EXIF on the way
through. By the time bytes reach `/api/photo` there is nothing left to
read, camera or not. **The one moment the original file still has it is
between the file input's `change` event and the first `createImageBitmap`
call** — so `looksCameraTaken()` in `filters.js` runs there, on the raw
`File`, and the result travels to the server as `&camera=1` on the upload
URL rather than being re-derived from bytes that no longer carry the
answer.

**A DEPENDENCY-FREE JPEG/EXIF READER, in the spirit of `qrcode.js`.** It
walks the marker sequence from the SOI, stops at APP1 (`0xFFE1`), checks for
the `"Exif\0\0"` signature, parses the TIFF header (byte order, the 0x002A
sanity word, the IFD0 offset) and looks for tag `0x010F` (`Make`) in IFD0.
Nothing more elaborate: `Make` alone is what a phone's own camera app
writes essentially every time, and reading the whole EXIF tree for one tag
would be effort spent on precision this signal cannot actually offer — see
the false-negative paragraph below. Verified against real files, not only
hand-built byte arrays: a genuine PIL-generated JPEG with `Make: Apple` in
its EXIF reads `true`; the same image saved with no EXIF, and a plain PNG,
both read `false` — and the marker walk correctly steps past a real JFIF
APP0 segment to reach APP1, which a synthetic buffer alone would not have
proven.

**BEST-EFFORT, NEVER A GATE, and the asymmetry is deliberate.** A photo
forwarded through WhatsApp, Instagram or Messages very often has its EXIF
stripped by that app before it ever reaches a phone's camera roll — so this
can UNDER-count (a real photograph, once shared, reading as "not a
camera"), but it cannot OVER-count: nothing manufactures a `Make` tag that
was never there. The projector never asks the question at all — every
photo still goes up regardless of the answer — and a corrupt or
unrecognised file falls through to `false` rather than blocking an upload
the guess was never meant to hold up.

**THE FLAG RIDES IN THE FILENAME, not a second file beside it.** The
private photo repository has no structured per-photo metadata today — a
photo is a name and the git commit message that filed it — and the gallery
route only ever reads a night's own directory listing. A separate manifest
(one JSON file per night, read-modify-written on every upload) would race
against itself the moment two people upload within the same second, which a
pub quiz does constantly, the same shape of problem `published.json`
avoids by being written once per publish tap rather than once per photo.
The filename cannot race: `photos.js`'s `add()` decides it once, at the
moment the id is minted, and appends `NOT_CAMERA_SUFFIX` (`-picked`) before
the extension when the photo was not camera-taken. Every later reader —
`isCameraFile()`, the gallery filter, the console's own badge — just looks
at the name it already has. `past-gigs.js`'s `safePhotoName()` was widened
by exactly one optional group, `(-picked)?`, to keep matching only names
this app itself could have issued — not an open door for arbitrary
hyphens, checked by a test that an unrelated hyphenated name still refuses.

**CHECKED TWICE ON THE WAY OUT, same reason `isPublished` is.**
`/api/gallery/<night>` filters the listing so a non-camera photo is never
offered a link; `/gallery-photo/<night>/<name>` refuses one directly too,
because its name was on the projector all night and a URL can be typed
without ever having seen the listing. The NIGHT-LEVEL photo count
(`/api/gallery`) filters the same way, or a night would say "6 photos" and
open on 4 — the exact "count says one thing, the page says another" fault
this file's own gallery-preview section already exists to avoid.

**THE HOST STILL SEES EVERYTHING, WITH A BADGE, before publishing.**
`/api/past-gigs/<night>` — the host's OWN review, gated by the host key,
completely separate from the public route — is deliberately NOT filtered:
every photo the night held is shown, and one that will not reach the public
gallery carries a quiet "Screen only" tag in the same corner `not filed`
already uses. Never hidden, because the whole point of reviewing photos
before publishing is not being surprised later by one that quietly is not
on the page. **No override was built** — there is no per-photo "include
anyway" toggle. The false-negative case (a genuine photo, re-shared and
therefore stripped of its EXIF before it reached this app) has no recovery
path beyond re-uploading through a fresh camera capture; if that turns out
to matter in practice, add the toggle then rather than guessing at it now.

## THE LEAGUE, EXPORTED — evidence for the landlord, a wall for the teams

Asked on 25 August 2026: *"What is our quiz league functionality looking like
and can that be exported to the landlord and the quiz teams to view?"*

The league itself had been built for a while — `src/league.js`, ten points for
a win down to one for turning up, a rolling twelve-week season per venue, out
of the archive with nothing new collected. What did not exist was any way to
get it out of the console: no PDF, no link, no page. That was a deliberate
park, recorded at the time, and this is it being unparked.

### First, the scoring changed: a team's best six nights count

Raised as soon as the export existed, and it is the more important half:
*"the quiz teams' best 6 scores averaged, so there's incentive to come every
week but also doesn't make it pointless to come if you had to miss 1-2 weeks
for holiday."*

**A running total punishes absence absolutely.** Two weeks away is twenty
points that can never be made up, so the team works out in week six that the
season is gone and stops coming — which is the retention argument this whole
feature exists to serve, running backwards.

**But a plain average breaks the other half.** Scored as mean points per
night, on a ten-night fixture:

```
team       played  total   mean   best6
Regulars      10      92    9.20      60
Holiday        8      70    8.75      54
Casuals        7      47    6.71      42
OneHit         1      10   10.00      10

by TOTAL : Regulars > Holiday > Casuals > OneHit
by MEAN  : OneHit   > Regulars > Holiday > Casuals     ← one lucky night wins
by BEST 6: Regulars > Holiday > Casuals > OneHit
```

A mean puts a team that played once and won above a team that won five of
ten. That removes the reason to come every week entirely, which is the half
the average was meant to protect.

**Best six does both.** The holiday costs nothing while six nights survive;
turning up every week is still worth it, because more nights mean more
chances at a big score *and* the right to drop the bad ones.

**Summed rather than divided — and the two are the same table.** "Best six
averaged" is this divided by a FIXED six, which scales every number equally
and therefore changes no position at all. Dividing by nights actually played
is the plain average again, with the one-hit problem back. So the order is
identical either way and whole points are what get shown, because "56 points"
is what gets read out in a pub and "9.33" is not.

Six because a rolling twelve-week season is ten to twelve weekly nights — 
comfortably half of them off, well past the one or two asked about, while
still needing a real run to win. A fortnightly venue runs about six, where
this is simply the total and costs nothing. And with fewer than six played it
IS the total, so an early season and a new team behave exactly as before: the
drop only begins once there is something to drop.

On the seeded nine-night season, scoring the same archive both ways:

```
EVERY NIGHT ADDED UP (before)        BEST SIX (now)
1. Quizzly Bears 74                  1. Norfolk Enchants 56
2. Brain Trust 67                    2. Quizzly Bears 54
3. Norfolk Enchants 62               3. Brain Trust 50
```

Norfolk Enchants missed two weeks. Before: third, twelve behind, out of it.
Now: top, on the strength of four wins in seven. **The tables say "9 (6)" in
the played column** once nights are being dropped, so a team adding up their
own weeks can see why the total is not the sum.

Wins stay counted across EVERY night rather than only the six that scored —
it is a plain fact about the team, it is only ever a tie-break, and the
honest number beats one that would need explaining.

### Then a point for every night played, on top of the best six

Asked the moment the rule was explained: *"Oh I see so we just add up the best
six weeks and add a point for each week you attend?"* That was a question
about how it worked, and the honest answer was no — the 1 was the FLOOR of the
position ladder, not an attendance payment. But the misreading was the better
rule, so it is the rule now.

**What it fixes:** under best six alone, a seventh night outside your six is
worth literally nothing. A team that finishes near the bottom every week is on
six points after six weeks and stays there for ever — which is a retention
hole in the feature built for retention. A point a night closes it: every week
you turn up moves you, however the night went.

**And it costs the holiday almost nothing**, which is the constraint it has to
live inside. Two weeks away is 2 points rather than the 20 a running total
charged.

**So the position ladder stops paying below seventh.** It used to award 1 from
eighth down as a floor; keeping that AND adding an attendance point would pay
the same point twice under two names, and "one for turning up" would mean two
different things in one sentence — the label collision this project's own
sweep mode hunts for. Eighth place is still worth exactly 1. It just arrives
as the attendance point now, and for *every* night rather than only the six
that scored.

The three rules on the same nine-night archive, with Norfolk Enchants away for
two of them:

```
team                P   every night   best six   best six + 1 a night
Norfolk Enchants     7           62         56                     63
Quizzly Bears        9           74         54                     63
Brain Trust          9           67         50                     59
Let Us Wine          7           37         32                     39
The Quizinarts       4           21         21                     25
```

- **Every night added up:** Quizzly Bears win by 12, and the team who took a
  fortnight off is third with nothing to play for.
- **Best six alone:** Norfolk go top by 2 — but Quizzly's two extra nights
  bought them nothing at all.
- **Best six plus one a night:** level on 63, decided on wins (4 v 3). The
  form team is still ahead, the ever-present team is right on their shoulder,
  and both had a reason to be there every week.

That last table is the whole design in one line: attendance pays, form pays
more, and a holiday is worth two points rather than a season.

### The two audiences want different things, so they got different things

**A landlord wants evidence, in a document he already receives.** The
post-night report PDF was carrying the headcount — *"how many came"* — and not
the league, which is *"are they coming back"*. The second is the question that
actually renews a booking, and the app had known the answer all along. Five
rows on the report, silent when there is no league.

**Teams want the table on the wall.** That is a public page, and a new public
surface, which is exactly why it was parked: team names go public with no way
to withdraw one. So it gets the gallery's safeguards rather than a lighter
version of them.

Building one thing for both would have served neither.

### A report says what the room saw THAT NIGHT

`leagueAfter(nights, night)` winds two things back: the night list, and the
season window, which is measured from that evening rather than from today. A
report for the 14th handed over in March therefore says what was on the
projector on the 14th.

It has to be `leagueTable()` itself doing the work with a different clock and
a shorter list — not a second calculation — or the report and the projector
would eventually disagree about who was winning. Same argument
`headcounts.js` records for taking a SET of nights.

Proved by generating every night's report off one seeded season:

```
2026-07-24: no league          (one night is not a league — it is the scoreboard twice)
2026-07-31: 2 nights · 1st Brain Trust 18 pts
2026-08-07: 3 nights · 1st Quizzly Bears 28 pts
2026-08-14: 4 nights · 1st Quizzly Bears 36 pts
2026-08-21: 5 nights · 1st Quizzly Bears 46 pts
```

The lead changes hands between the first two, which is the point: each report
is a different document, not the same table stamped five times.

### The public page is a publish, per venue, failing closed

`src/league-publish.js` is `src/gallery.js`'s shape one door along, because it
is the same question and a second answer to it is a second thing that can be
got wrong.

- **Per VENUE, not per night.** A league IS a season — a page per pub, put up
  once and left up, which is what a table on a wall is.
- **The list lives in the private repo**, beside the gallery's own and the
  archive this table is built from. A flag in `data/` would silently unpublish
  every venue on the next deploy and nobody would know until a regular
  mentioned the page had gone.
- **Unreachable, unconfigured or unparseable means nothing is published.** A
  page that shows nothing is a disappointment; a page that shows every team in
  every pub because a fetch failed is a disclosure.
- **The control is drawn UNDER the table it publishes**, says what publishing
  means in one line before you press it, and takes it down as prominently as
  it puts it up — outlined red. A team will ask.

**Names and points, never faces.** `leagueTable()` carries a `faceKey` per
team so the console can draw one; the public route lists the fields it sends
by name rather than spreading the row. A spread quietly opts every future
field in, and the next one might be a photograph — the same whitelist rule the
engine's own views follow, for the same reason.

**And the next quiz date is the loudest thing under each table**, chosen over
the faces: a team lying fourth wants to know when it can do something about
it. It writes itself from the venue's usual night through the same
`nextNightAt()` the projector's comeback slide uses, so there is nothing to
keep current and it is silent when there is nothing true to say.

### And then a filter — at the door, never in the room

Reported the day the page existed, off a live table with a racial slur ninth
in it: *"I don't mind there being swearing or risque stuff in the venue
itself, but when it comes to quiz leagues and people seeing from an external
source I need to have a certain filter."*

**This does not reverse "no profanity filter on team names". It scopes it.**
That decision is about the ROOM, and it still holds there: the projector, the
phones, the control view and the console all show exactly what was typed, and
`cleanTeamName()` is untouched. What changed is the two places a name reaches
somebody who was never in the pub — the public league page, and the report a
landlord can forward to a brewery. A slur on a wall for two hours and a slur
on a public web page under the quizmaster's brand are different objects.

`src/clean-names.js`, and five decisions inside it:

- **Filtered on the SERVER.** The word never reaches the wire — a filter that
  ships the name and hides it with CSS is not a filter, which is the same
  reasoning the two-screens rule is built on. Verified by grepping the actual
  HTTP payload and the PDF bytes: zero occurrences.
- **Masked, never dropped.** "Name hidden". Removing the row would move
  everybody below it up a place and make the table lie about the season, and
  the team would simply vanish rather than be able to find themselves by their
  points. Identity, position and points are untouched: this is a VIEW.
- **It errs strict.** A false positive hides one name on one page and the
  console says which; a false negative is a slur under somebody's brand found
  by a customer. Those are not equal, so where they conflict this hides.
- **Whole words for ordinary profanity.** The classic failure of a naive
  filter is the substring match, which hides Scunthorpe, Penistone,
  Cockermouth, Lightwater, "assassin", "classic" and "Dickens". Ordinary
  profanity is matched on whole words against a normalised form (accents
  folded, leetspeak undone, repeated letters collapsed), plus adjacent pairs
  joined so "Bell End" does not walk past. **The slur list alone gets a second
  pass with every space and symbol stripped**, which is what catches
  `n i g g a`, `N-I-G-G-A` and `n1gg4` — running that pass on the ordinary
  list would hide half of Britain.
- **The console shows the real name and marks it.** The quizmaster was there,
  so nothing is masked on their own screen; a name that will not publish
  carries a quiet `hidden publicly` pill, or a name vanishes off a table they
  put up and there is no way to tell which one did it.

**One known false positive:** "The Pen Is Mightier" joins to a listed word on
the adjacent-pair pass and is hidden. **And one known miss:** spoonerisms like
"Cunning Stunts" publish, because catching them means guessing at intent and
that is where a filter starts renaming real teams.

### And a human overrules the list, in both directions

*"Can I get a manual override so we're erring on the side of caution but I can
override it."* Both halves of that sentence are the design: the list still
decides by default and still errs strict, and a person who was in the room can
say otherwise.

**Both directions, because the list is wrong both ways** — the two limits
above are one each. A one-way "allow" control would have fixed "The Pen Is
Mightier" and left the spoonerism with no answer at all.

- **Keyed by `teamKey()`**, the identity the league already groups by, so a
  ruling lands on exactly the row it was made on and follows that team across
  the season rather than being re-made every week.
- **A ruling that only restates the filter is CLEARED, not stored.** Pressing
  "hide" on a name the list would have hidden anyway records nothing —
  otherwise a later change to the word list could never reach that name, and
  nobody would know why. The gap dial's `cleanPlan()` makes the same call for
  the same reason.
- **One control per table, folded away.** Ten teams times several venues is
  thirty buttons on a page whose job is being read. It sits under the table
  beside the publish control, which is also the moment somebody wants it —
  checking the names before putting them up — and the opener carries the count
  ("Check the names — 1 held back") so the state is legible while it is shut.
- **The list says what WILL happen, not what the filter thought.** A name a
  human allowed reads "On the public table" like any other, with a quiet
  `your call` mark, so the page never argues with itself.
- **The row's key travels with the row.** The filter's verdict rides with the
  library (no I/O); the rulings come from the one GitHub read the tab makes;
  the console combines them. Sending the key rather than recomputing it in the
  browser is what stops a second copy of `teamKey()` existing — two
  implementations of one identity is how a ruling eventually lands on the
  wrong team.
- **The rulings live in the publish file**, so both halves of "what does this
  room publish" are one read and one write. Writing the venues alone would
  wipe every ruling, which is the kind of bug that only surfaces weeks later
  when a name comes back.

### Three things this cost, all found by running it

- **A GET route written beside its own POST 404s.** `/api/league/published`
  landed in the half of `server.js` that only runs for POST — the identical
  trap the gallery's publish route already records. Found by calling it.
- **An async paint must look where the thing IS.** The publish control queried
  the `DocumentFragment` it was built in; `render()` had already moved its
  children into the page and left the fragment empty, so two tables drew with
  no control on them and nothing threw.
- **A seed on the wrong shape proves nothing.** The first fixture wrote the
  MERGED night shape rather than the on-disk one, and then put both venues on
  the same dates — which `mergeGigs()` quite rightly folded into one night,
  losing a whole league. One quizmaster cannot be at two pubs on one evening.

---

## THE QUIZMASTER'S OWN ROOM PHOTOGRAPHS — 29 August 2026

> *"Would be good to be able to add room photos to the gallery that everyone
> sees, that I take from my own phone?"*

`POST /api/past-photo/<night>` in `server.js`, `myPhotos()` in
`console-community.js`, under the night showing in the Community bay.

### The room's camera is sixty phones pointed at each other

Every photograph the gallery has ever held arrived through a PLAYER's phone,
and a player's phone is pointed at their own table. What a venue actually wants
to be shown is the place full — the bar three deep, forty heads turned towards
a projector — and that picture can only be taken by the person standing at the
front.

So the one shot that genuinely sells the night was the one shot with no way in.
That is the gap, and it is a *Build what helps a quizmaster SELL* feature
rather than a convenience: the gallery is the evidence, and it was missing its
best exhibit.

### It is filed against the night in the URL, never against today

This is the load-bearing detail. `photos.add()` dates a picture by the clock at
the moment it lands — right for a phone in the room, and wrong for everything
else. A photograph sent on the Friday would file itself under the Friday: a
Thursday quiz, and a picture of it in a folder for a night that did not happen,
which the gallery would then show under the wrong date to a venue.

Naming the night in the URL is what makes the feature usable at all — in the
car park, on the drive home, or on the Monday with the rest of the admin.

It also means the write goes **straight into the private repository**, past the
room's live photo store. There is nothing to keep in step, because there is no
second copy.

### Camera-eligible by definition

The `-picked` marker exists to keep a meme somebody pulled off their camera
roll off a venue's public page. These are the opposite: the promotional
photographs, taken by the person whose name is at the top of that page.

So they carry no marker and `isCameraFile()` lets them straight through. The
one thing they must never do is arrive marked and then silently not appear —
which is exactly what would have happened if this had reused the player upload
path, since `camera` defaults to FALSE there and a phone's own share sheet
often strips the EXIF that would say otherwise.

The filename starts `mine`, so a photograph the quizmaster added is tellable
from one the room sent — for a bin, for a count, and for whatever wants to know
later.

### Scaled down in the browser, and not cropped square

A modern phone photograph is five to eight megabytes; the route caps at three,
and this is a quizmaster on pub wifi, which is the connection this app protects
above every other. So `drawFiltered()` redraws it to 1600px before it is sent —
1600 rather than a player's 1280, because this one is meant to be looked at on
a laptop.

**`square: false`, unlike a player's photo.** A picture of a room IS the room,
and cropping it to a square for a wall of thumbnails would throw away the half
that shows how full it was.

They are sent **one at a time, in order**, with the count going up as they
land: six at once is six writes racing on one folder, and a progress line that
only moves at the end reads as a page that has hung.

### The test asserts against the 404, not the 400

A new POST written beside its GET neighbours is the exact shape of a fault this
repo has already shipped: the gallery publish route lived inside `handleGet`,
which only ever runs for GET and HEAD, so every POST fell through to the
generic 404. It read as a working feature for months — the gate perfect, and no
handle on it.

So `test/own-photos-route.test.js` posts over real HTTP and asserts the answer
is **not 404**. A test written for the 400 would pass against a route that does
not exist. It was verified by renaming the route and watching it fail.

What it cannot reach is the write itself, which needs a repository token this
suite does not have and must not need — so the deepest assertion is that an
unconfigured repo is refused with a message that NAMES the missing thing. That
is the branch a fresh deployment actually hits, and a generic "could not save
that" would send somebody hunting through the app for a fault in an env var.
