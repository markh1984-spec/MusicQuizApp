/**
 * Who is allowed to do what.
 *
 * Two kinds of account, and they are not the same shape at all:
 *
 *  - the **owner** — one account, the app dev. Writes and generates quiz packs,
 *    sells them, and manages everybody else. Does not run quiz nights from
 *    here; that is what the owner's own quizmaster account is for.
 *  - a **quizmaster** — a subscriber. Runs nights, keeps their own library,
 *    buys packs from the owner's catalogue.
 *
 * THE RULE THAT DECIDES WHICH TIER SOMETHING GOES IN, and it is the host's own:
 * **anything that costs the owner money every time it is used is not in Basic.**
 * Not "is it impressive" and not "would people pay for it" — does a subscriber
 * using it put a line on the owner's bill?
 *
 * So a new round type, a new game, a new seasonal look and a new picture effect
 * are all Basic the day they are written, because they cost nothing to run.
 * Generating a quiz with Claude, generating artwork with OpenAI and streaming
 * video all cost real money per use, so they are either owner-only or a paid
 * add-on that covers the cost. Follow that rule for anything added later and
 * the tiers stay honest without a meeting about it.
 */

/**
 * Every gate in the app, in one list.
 *
 * A feature name is checked with `can(account, feature)`. Names are grouped by
 * prefix so it is obvious at a glance which side of the paywall one sits on.
 */
export const FEATURES = {
  // ---- Basic. Free to run, so free to include.
  QUIZ: 'quiz.run',
  BINGO: 'bingo.run',
  // READING the pack library. Everybody has this — a quizmaster plays the
  // packs, and that is the arrangement. Writing to it is CATALOGUE, below:
  // saving, deleting, renaming, importing, annotating and the playlist step
  // are all the owner's, because the packs are written to a house style and
  // sold, and three people editing them is how that style stops being one.
  LIBRARY: 'library.own',
  // Whole quizzes and whole bingo games from the owner's catalogue. Never
  // individual rounds — a round is a part of a product, not a product.
  BUY_PACKS: 'packs.buy',
  /*
   * Their OWN packs — the ones they wrote, which are theirs and not the
   * owner's. A separate feature from LIBRARY on purpose: reading the catalogue
   * and keeping a library of your own are different arrangements, and only one
   * of them is a thing the owner can look at.
   *
   * Bronze, under the host's own rule: writing a JSON file costs nothing per
   * use, so there is no bill to cover. That is the rule doing its job rather
   * than a commercial decision, and moving it up is one word below — but note
   * what moving it would mean, which is a subscriber's own work becoming
   * unreachable the month their card fails.
   */
  OWN_PACKS: 'packs.own',
  LOOKS: 'looks',                // seasonal palettes and picture reveals
  /*
   * Venue slides between rounds — SILVER, and the only capability above Bronze.
   *
   * **The test is whether withholding it degrades the SHOW, and this is the
   * one thing that passes it.** Every other capability you hold back is
   * something a room can see is missing — a round type, a picture reveal, a
   * seasonal look — and a Bronze host running a venue's Christmas party is the
   * shop window, so a thinner projector is the product looking cheap rather
   * than the tier looking cheap. An advert slide is different in exactly the
   * way that matters: **the quiz app functions identically without it, and a
   * room that never sees one does not know it was possible.**
   *
   * So it is not quiz functionality at all — it is a lever for winning the
   * BOOKING in the first place, which is a business outcome for the
   * quizmaster rather than part of the night. That is what makes it safe to
   * put a price on, and it is why Silver needs it: without this, Silver is
   * content and nothing else, and a rung with no capability of its own is a
   * harder thing to sell than one with a reason to exist.
   *
   * It costs nothing to run, so the host's own per-use rule does not force it
   * out of Bronze; that rule only says what CANNOT be in Bronze, never that
   * everything cheap must be in it.
   *
   * The usual objection to withholding a capability does not apply here, and
   * that is what makes it safe. "Every capability you withhold looks broken in
   * front of a room" is about the GAME: a missing round type or a flat picture
   * reveal is the product looking cheap while sixty people watch. An advert
   * slide is not part of the game, and a room that never sees one does not
   * know it was possible. Nothing is worse on a Bronze night; there is simply
   * one fewer thing the quizmaster can sell.
   */
  ADVERTS: 'adverts',            // venue slides
  PHOTOS: 'photos',              // photos from the room

  /*
   * **The record of what they have run — BRONZE.**
   *
   * Every night that has ended, which pack it was, how many played and the
   * pictures the room sent. It costs nothing per use — it is reading back
   * something the app was already writing down — so under the house rule it is
   * Bronze, and there is a second reason to keep it there: this is what a
   * quizmaster shows a venue they are pitching to. Withholding the evidence
   * that somebody is good at their job from the rung where they are still
   * building the business is the wrong way round.
   *
   * It is READ ONLY on a quizmaster's console. Getting the pictures off and
   * onto social media is the owner's own tab, on the owner's own page.
   */
  PAST_GIGS: 'gigs.past',        // the nights already run, and their photos

  /*
   * **Asking for a pack that does not exist yet — GOLD.**
   *
   * "There is no One Direction quiz and I want one." The owner writes it and
   * it joins the catalogue for everybody, so the subscriber gets the pack and
   * the library gets bigger — which is why it is worth doing at all.
   *
   * The reason it is not in Bronze is NOT the per-use rule, and getting that
   * straight matters for the next feature: a request costs nothing until the
   * owner agrees to it, so the bill is never automatic. What it spends is
   * **the owner's writing time**, which is the one genuinely scarce thing in
   * this business — about £2 and twenty minutes of reading per pack, for one
   * person.
   *
   * And that is the same thing Gold already sells. Silver buys the owner's
   * BACK CATALOGUE; Gold buys the owner's TIME — a fresh topical quiz every
   * week, and now a pack written to order. Putting it anywhere else would
   * either give that time away or make the weekly promise undeliverable.
   *
   * One open request at a time, enforced in `suggestions.js`: worse than not
   * offering this is offering it and not delivering.
   */
  REQUEST_PACK: 'packs.request',

  /*
   * ---- Running a business rather than running a night. BRONZE, all of it.
   *
   * These were a paid add-on and the host moved them down, on a rule worth
   * writing out because it decides where the next feature goes too: **the
   * tiers separate on QUIZ-APP functionality, not on business tools.**
   *
   * Withholding invoicing creates no upgrade pressure — it just makes the app
   * less useful to the person you most want recommending it. It is a
   * nice-to-have that helps a quizmaster get paid, and a quizmaster who gets
   * paid faster because of this app is the best advertisement it has.
   *
   * Note this is the CONTENT-not-capability rule applied honestly rather than
   * a change of mind: the lever has always been the library, and every
   * capability held back is something that looks thin for no good reason.
   */
  INVOICES: 'admin.invoices',
  CALENDAR: 'admin.calendar',
  MARKETING: 'admin.marketing',  // not built yet

  // ---- The streaming add-on. Priced because egress is a real per-use cost.
  STREAM: 'stream.run',

  // ---- Owner only. Every one of these either costs money per use or is about
  // running the business that sells the app.
  GENERATE: 'owner.generate',    // Claude writes a quiz — pennies a time, his bill
  ARTWORK: 'owner.artwork',      // OpenAI portraits — likewise
  CATALOGUE: 'owner.catalogue',  // the packs offered for sale
  SUBSCRIBERS: 'owner.subscribers',
  /*
   * **Getting the pictures off a night and onto social media — the owner's,
   * and asked for that way.**
   *
   * Every quizmaster can see their own past nights and the photographs from
   * them; that is Bronze and it is their record of their own work. What is
   * here is the other half: filing the lot away, sharing them out and binning
   * the duds. It is Mark's own workflow on Mark's own room, and he asked for
   * it to live on the owner page rather than in the console every subscriber
   * sees — a control drawn for somebody who has no use for it is one more
   * thing to read past.
   *
   * Owner-only features are deliberately not on the ladder: they are not for
   * sale at any price, so putting one on a rung would be offering to sell it.
   */
  PHOTO_EXPORT: 'owner.photos',
};

/**
 * ============================================================== THE TIERS
 *
 * Three of them, and they STACK: Gold includes everything in Silver, which
 * includes everything in Bronze. That is the whole structure, and it is the
 * bit worth getting right before arguing about which feature goes where.
 *
 * `rank` is what the code actually compares — never the label, never the
 * price. Adding a fourth tier is one entry here with a rank between two
 * existing ones, and nothing else in the app has to know.
 *
 * **The prices are PROVISIONAL and so is every feature's tier.** The structure
 * is what is being built; where each feature lands is a commercial decision
 * still to be made, and moving one is a one-word edit in `FEATURE_TIER` below.
 */
export const TIERS = [
  {
    id: 'bronze',
    label: 'Bronze',
    plan: 'Basic',
    rank: 0,
    pence: 1000,
    blurb: 'The whole app, and eight packs to start.',
    content: { label: 'Eight packs to start', blurb: 'Four quizzes and four bingo games. Buy more at £3.' },
  },
  {
    id: 'silver',
    label: 'Silver',
    plan: 'Elite',
    rank: 1,
    pence: 2000,
    blurb: 'Every pack there is, and every new one free.',
    content: { label: 'The whole catalogue', blurb: 'The lot, included. Nothing left to buy.' },
  },
  {
    id: 'gold',
    label: 'Gold',
    plan: 'Pro',
    rank: 2,
    pence: 3000,
    blurb: 'All of Silver, plus a fresh quiz every week.',
    content: { label: 'A topical quiz every week', blurb: 'The month just gone, while it is still news.' },
  },
];

export const DEFAULT_TIER = 'bronze';

/*
 * **THERE IS NO FREE TIER, and that is the host's own decision.** Bronze is
 * £10 rather than £0. A free rung would be a shop window that never asks for
 * anything, and the machine is the same at every level — so somebody could run
 * a paying gig on it forever.
 *
 * Note what "no free tier" does NOT mean: `status: 'trialing'` still exists and
 * is treated as paying, so a month on the house is a status rather than a rung.
 * Do not add a fourth tier at £0 to get a trial — that is a permanent hole in
 * the ladder to solve a temporary problem.
 */

/**
 * ====================================================== WHAT YOU CAN PLAY
 *
 * The other half of a tier, and it is CONTENT rather than capability.
 *
 * The upsell is deliberately not a greyed-out button. Every capability you
 * withhold is something that looks broken in front of a room — and a Bronze
 * host running a venue's Christmas party is the shop window, so a thinner
 * projector is the product looking cheap rather than the tier looking cheap.
 * It also cuts against the first rule in this codebase: nothing should be
 * surprising on a Wednesday night, and a control that refuses is a small
 * version of exactly that.
 *
 * So the lever is the library. A Bronze host gets the whole machine and a
 * starter set of packs; the pressure to move up arrives on its own, at the
 * fourth month in the same pub when the room has heard them all. Nobody has to
 * be told what they are missing — they hit it while doing well, and it never
 * interrupts a night.
 *
 * Three scopes: `'all'` is the whole catalogue, `'evergreen'` is everything
 * that is not tied to a date, and an ARRAY means only those pack ids.
 */

/**
 * ================================================ CAPEX AND OPEX, AS A LADDER
 *
 * **`'evergreen'` is the whole reason Gold is worth buying, and the
 * distinction behind it is the host's own.**
 *
 * An evergreen pack is an ASSET. It costs about £1.90 of API to write, once,
 * and then it sells to every subscriber for ever — the cost is behind you the
 * day it exists. How much of that library somebody gets is a fair thing to
 * meter, because there is a finite pile of it and writing more is optional.
 *
 * A topical pack is a SERVICE. "The month just gone" has to be written every
 * week or it is not topical, which makes it the only recurring cost in the
 * whole product — about £18 a month for the two of them, for as long as
 * anybody holds the tier. It also cannot be bought once and reused, which is
 * exactly what makes it the strongest subscription argument there is.
 *
 * So the ladder is built on that split rather than on how many files somebody
 * can see: **the evergreen catalogue is the Bronze-to-Silver axis, and topical
 * is what Gold is.** Two things follow and both matter:
 *
 * - **It is a FIXED cost, not a per-use one.** A topical pack costs the same
 *   whether one subscriber runs it or a hundred do, so ONE Gold subscriber
 *   pays for the entire weekly programme and every one after that is nearly
 *   all margin. Note this is why the house rule about per-use costs does not
 *   reach it: generating is per-WRITE, not per-play.
 * - **The gradient works out.** Bronze at £10 plus four topical packs at £3 is
 *   £22, and Gold at £30 hands them the whole catalogue too. Silver at £20
 *   plus the same four is £32 — MORE than Gold — so a Silver subscriber who
 *   wants topical weekly has an unambiguous reason to climb, and it arrives
 *   every week rather than in month four.
 *
 * **What this commits the owner to is not money, it is a WEEKLY DEADLINE.**
 * The writing is a button press and about £2; the read-through is twenty
 * minutes, every week, for as long as one Gold subscription exists. Miss a
 * week and a Gold subscriber notices immediately. That is the first rule in
 * this codebase pointed at the business rather than at the app, and it is the
 * one part of this that cannot be undone by editing a line here.
 */
/**
 * **This is the Bronze-to-Silver delineation, and it is the whole ladder.**
 *
 * The host's own reasoning, and it settles what each rung is FOR: *Bronze buys
 * packs, Silver gets them included.* That is also why a quizmaster never
 * generates — if they could write their own with Claude there would be nothing
 * on the ladder worth paying to climb, which is a stronger reason than the
 * bill and is recorded in CLAUDE.md.
 *
 * **Eight to start with: four quizzes and four bingo games.** A weekly host
 * gets one to two months out of that, which is the intended shape — the
 * ceiling arrives while they are doing well, at the fourth month in the same
 * pub when the room has heard them, and never mid-question.
 *
 * **Which eight is deliberate too.** The starter set is the packs that work in
 * ANY room — decades and genres — because a new subscriber needs to be able to
 * walk into any venue with them. The artist packs are held back, because those
 * are the ones you pick for a specific night, which is exactly when somebody
 * is willing to buy one.
 *
 * A note on the shape rather than the contents: this is a list of pack IDS, so
 * a new pack in the catalogue does NOT join Bronze on its own, which is the
 * point — Silver's promise is "and every new one as it is written". The cost
 * is that renaming a starter pack silently drops it out of Bronze, so change
 * this list in the same breath as a rename.
 */
export const TIER_PACKS = {
  bronze: [
    // Quizzes — three decade/genre packs and the broadest of the artist ones.
    '1980s-pop-music',
    '2000s-pop-rnb-and-chart',
    '2000s-metal',
    'madonna',
    // Bingo — all four general, none of them tied to a theme night.
    'disco-funk',
    'eighties-bingo',
    'pub-floor-fillers',
    'motown-soul',
  ],
  // Everything that is not tied to a date. See the note above: an evergreen
  // pack is written once, a topical one has to be written every week.
  silver: 'evergreen',
  gold: 'all',
};

/**
 * Is this pack tied to a date?
 *
 * Read off the pack's own `freshUntil` rather than guessed from its id. A
 * topical pack is named after the day it was written, so keying on the name
 * would work today and open the moment somebody renames one — and a gate that
 * depends on a naming convention is a gate that fails silently.
 */
export function isTopical(pack) {
  return Boolean(pack && pack.freshUntil);
}

/**
 * One question, asked of a pack SUMMARY rather than a bare id: may this
 * account have it?
 *
 * Returns a function because every caller has a list to filter, and building
 * the set once matters more than the shape being pretty.
 */
export function packFilter(account = {}) {
  const allowed = packsFor(account);
  if (allowed === 'all') return () => true;
  if (allowed === 'evergreen') return (pack) => !isTopical(pack);
  const set = new Set(allowed);
  return (pack) => set.has(String(pack && pack.id));
}

/**
 * What one pack costs, in PENCE.
 *
 * **This number is set to make the UPGRADE obvious, not to make money.** The
 * subscription is the business; a pack sale is the on-ramp. So the only
 * question it has to answer is when somebody should stop buying and move to
 * Silver — which makes it arithmetic rather than a judgement call.
 *
 * The floor is the Silver gap divided by how many packs a weekly host gets
 * through: £10 / 4 = £2.50. Below that a weekly host never has a reason to
 * climb and the Bronze-buys / Silver-includes structure quietly stops being a
 * ladder at all. £3 is the lowest price above that floor.
 *
 * The ceiling is about how it READS. A quizmaster charges a venue well over
 * £100 a night, so even £5 is about 3% of one fee — but it is HALF their
 * monthly subscription for one night's content, and that ratio is what
 * somebody reacts to. £3 is a fifth.
 *
 * A fortnightly host lands in the right place too: two packs is £6, so buying
 * stays cheaper than upgrading, which is correct — they should not be pushed
 * up a rung they would not use.
 *
 * One number here rather than a price per pack, because a catalogue where some
 * packs cost more is a catalogue somebody has to shop around in, and the whole
 * pitch is convenience. See CLAUDE.md, "What a pack costs".
 */
export const PACK_PENCE = 300;

/**
 * Which packs this account may see and launch.
 *
 * Order matters and it is the usual one: the owner and the host key see
 * everything, a comped account sees everything, an explicit list on the
 * account beats its tier, and otherwise the tier decides.
 *
 * An account-level list is an ENTITLEMENT, so it is set by the owner through
 * `accounts.update()` and never through `setPrefs()` — the same wall that
 * stops a preferences payload handing out a tier. That is also what makes a
 * shop possible later without a redesign: whether an id lands in that list
 * because of a tier or because somebody bought it is one line, and nothing
 * downstream cares which.
 */
export function packsFor(account = {}) {
  if (!account || account.bootstrap || account.role === 'owner' || account.comped) return 'all';
  if (Array.isArray(account.packs)) return account.packs.slice();
  const scope = TIER_PACKS[tierFor(account)];
  return scope === 'all' ? 'all' : (scope || []).slice();
}

/**
 * Is this one pack in reach?
 *
 * @param {object} [pack]  the pack itself, or anything carrying its
 *   `freshUntil`. Only needed to tell a topical pack from an evergreen one —
 *   without it a dated pack looks evergreen, so a caller that CAN read the
 *   pack should, and the two that cannot are the ones where it does not
 *   matter (an id that is not in the catalogue at all).
 */
export function canPlayPack(account, packId, pack = null) {
  return packFilter(account)({ ...(pack || {}), id: String(packId) });
}

/**
 * Which tier each feature belongs to.
 *
 * **PROVISIONAL — this is the list to argue about, and moving a feature is one
 * word.** What is NOT provisional is the rule that decides it, which is the
 * host's own: *anything that costs the owner money every time it is used is
 * not in Bronze.* Not "is it impressive" — does a subscriber using it put a
 * line on the owner's bill? So a new round type, a new game, a new look and a
 * new picture effect are Bronze the day they are written, because they cost
 * nothing to run. Streaming is Gold because egress is a real per-use cost.
 *
 * Owner-only features are deliberately absent: they are not on the ladder at
 * all, because they are not for sale at any tier.
 */
export const FEATURE_TIER = {
  [FEATURES.QUIZ]: 'bronze',
  [FEATURES.BINGO]: 'bronze',
  [FEATURES.LIBRARY]: 'bronze',
  [FEATURES.BUY_PACKS]: 'bronze',
  [FEATURES.OWN_PACKS]: 'bronze',
  [FEATURES.LOOKS]: 'bronze',
  [FEATURES.ADVERTS]: 'silver',
  [FEATURES.PHOTOS]: 'bronze',
  [FEATURES.PAST_GIGS]: 'bronze',
  [FEATURES.REQUEST_PACK]: 'gold',

  [FEATURES.INVOICES]: 'bronze',
  [FEATURES.CALENDAR]: 'bronze',
  [FEATURES.MARKETING]: 'bronze',

  [FEATURES.STREAM]: 'gold',
};

/**
 * What each feature is called and what it does, for the account page.
 *
 * Here rather than in the console because the browser and the server both want
 * it and two copies drift — the same reason the tiers and the looks live in
 * files like this one.
 */
/*
 * ONE SHORT LINE EACH, and that is a rule rather than a preference.
 *
 * These were two and three sentences, which on a page listing fourteen of them
 * is a wall nobody reads — so the ladder stopped saying what you get and
 * started being scrolled past. A blurb has one job: finish the sentence "this
 * gives me…" in a breath.
 *
 * Anything that genuinely needs explaining belongs in an FAQ, not here. If a
 * line will not fit, the feature needs a better name.
 */
export const FEATURE_META = {
  [FEATURES.QUIZ]: { label: 'Music Quiz', blurb: 'Twenty seconds a question, fastest fingers win.' },
  [FEATURES.BINGO]: { label: 'Music Bingo', blurb: 'You play the tracks, every phone gets a card.' },
  [FEATURES.LIBRARY]: { label: 'The pack library', blurb: 'Play anything in your library.' },
  [FEATURES.BUY_PACKS]: { label: 'Buying packs', blurb: 'Buy any pack in the catalogue, £3 each.' },
  [FEATURES.OWN_PACKS]: { label: 'Your own packs', blurb: 'Write your own. Nobody else can read them.' },
  [FEATURES.LOOKS]: { label: 'Seasonal looks', blurb: 'Halloween, Valentine’s, Christmas.' },
  [FEATURES.ADVERTS]: { label: 'Advert slides', blurb: 'Sell the venue a slide between rounds.' },
  [FEATURES.PHOTOS]: { label: 'Photos from the room', blurb: 'The room sends pictures to the big screen.' },
  [FEATURES.PAST_GIGS]: { label: 'Past gigs', blurb: 'Every night you have run. Proof for the next venue.' },
  [FEATURES.INVOICES]: { label: 'Invoicing', blurb: 'Bill a venue before you leave the car park.' },
  // Not built. It is on the ladder and drawn on the account page, so it has to
  // say so — the same honesty rule streaming gets. A rung that lists something
  // which does not exist is one nobody trusts the rest of.
  [FEATURES.CALENDAR]: { label: 'Your calendar', blurb: 'The nights you have booked. Not built yet.' },
  [FEATURES.MARKETING]: { label: 'Marketing', blurb: 'Not built yet.' },
  [FEATURES.REQUEST_PACK]: { label: 'Ask for a pack', blurb: 'Name a theme, get a quiz written. One a month.' },
  [FEATURES.STREAM]: { label: 'Online quizzes', blurb: 'Run a night for a room that is not there. Not built yet.' },
};

/** A tier by id, and its rank. An unknown one is the bottom of the ladder. */
export function findTier(id) {
  return TIERS.find((t) => t.id === String(id || '')) || TIERS[0];
}

export function tierRank(id) {
  return findTier(id).rank;
}

/**
 * Which tier is this account on?
 *
 * Reads `tier` when it is there, and works it out from the OLD plan-and-add-ons
 * shape when it is not — accounts made before the ladder existed are on disk
 * and in a backup, and a subscriber silently dropping to Bronze because the
 * field was renamed is not a migration, it is a bug with a bill attached.
 */
export function tierFor(account = {}) {
  if (account.tier) return findTier(account.tier).id;
  const addons = account.addons || [];
  if (addons.includes('stream')) return 'gold';
  if (addons.includes('admin')) return 'silver';
  return DEFAULT_TIER;
}

/** Everything at or below a tier, in ladder order. */
export function featuresAt(tierId) {
  const rank = tierRank(tierId);
  return Object.keys(FEATURE_TIER).filter((f) => tierRank(FEATURE_TIER[f]) <= rank);
}

/**
 * The ladder as the account page draws it: a section per tier, the features in
 * it, and whether this account has reached that far.
 *
 * Built here rather than in the console so the page cannot invent a tier the
 * rules do not have, and so the ordering is the ladder's rather than an
 * object's key order.
 */
export function ladderFor(account = {}) {
  const mine = tierRank(tierFor(account));
  const held = new Set(featuresFor(account));
  /*
   * **Comped holds every rung, whatever the tier field says.**
   *
   * A comped account — the owner's own quizmaster hat, and anybody they gift
   * it to — carries no tier, so it read as Bronze while `featuresFor` handed
   * it everything. The page then drew Silver and Gold as locked, with a price
   * on each and "ask the owner to move you up", to the owner. A shop selling
   * somebody what they already have reads as a fault in their account.
   *
   * It matters more now than it looked, because a Subscribe button belongs on
   * a rung that is NOT included — so without this the one account that must
   * never be billed would be the one being offered a subscription.
   *
   * Note this cannot leak into the tier preview: previewing a rung CLEARS
   * `comped` first, which is a rule that already has a test named after the
   * day it did not.
   */
  const everything = Boolean(account && (account.comped || account.bootstrap));
  return TIERS.map((tier) => ({
    ...tier,
    included: everything || tier.rank <= mine,
    /*
     * What PACKS this rung holds, drawn as a statement rather than a switch.
     *
     * The rows under it are capabilities, and each one carries an On | Off —
     * because what you have on is yours to decide. Content is not: it is what
     * you pay for, and a switch beside it would read as an offer to turn your
     * own library off. It also stops Gold's section listing one unbuilt
     * feature and nothing else, when the whole reason to be on Gold is the
     * weekly topical quiz.
     */
    content: tier.content || null,
    features: Object.keys(FEATURE_TIER)
      .filter((f) => FEATURE_TIER[f] === tier.id)
      .map((f) => ({ id: f, ...(FEATURE_META[f] || { label: f, blurb: '' }), held: held.has(f) })),
  }));
}

const OWNER_FEATURES = [
  FEATURES.GENERATE, FEATURES.ARTWORK, FEATURES.CATALOGUE, FEATURES.SUBSCRIBERS,
  FEATURES.PHOTO_EXPORT,
  // The owner also needs the library, because writing and fixing the packs that
  // get sold is the job.
  FEATURES.LIBRARY,
  // And their own past nights: the owner runs gigs too — on the host key, in
  // the house room — so the record of them is theirs to read. It is on the
  // ladder as well, because it is every quizmaster's own record; this line is
  // what stops an OWNER-signed-in browser being refused their own history.
  FEATURES.PAST_GIGS,
];

export const ROLES = ['owner', 'quizmaster'];

/**
 * WHAT KIND OF SUBSCRIBER THIS IS — and it is deliberately NOT a role.
 *
 * A role says what you may DO (an owner writes packs and runs no nights; a
 * quizmaster runs nights and cannot write to the catalogue). A kind says what
 * you ARE, and the two are independent: a venue and a quizmaster both hold the
 * quizmaster role, because both of them run a quiz night. Folding this into
 * `role` would mean every permission check in the app suddenly having a third
 * case to get wrong, for a distinction that is about USE rather than about
 * access.
 *
 * The host's own framing, and it is why this exists at all: *"the venue
 * accounts will probably act slightly differently to the QM accounts… from my
 * perspective it's probably no different, but the way they use the accounts
 * would be different. So we'd probably have to treat them differently even if
 * at this stage they'd be more or less the same."* Exactly right — the
 * distinction has to EXIST before the differences can be built, and making it
 * later means guessing which of a hundred existing accounts was which.
 *
 * What actually differs is written up in TODO.md under "Venue accounts". The
 * short version, and the two that are load-bearing:
 *
 *  - **A quizmaster's room follows the PERSON between venues. A venue's room
 *    belongs to the BUILDING**, and whoever is on the microphone changes with
 *    the rota. Those are the same structure inverted.
 *  - **Past gigs asks the opposite question.** For a quizmaster it is a
 *    portfolio shown to win the next booking; for a venue it is "is our
 *    Wednesday growing". Same data, opposite use.
 *
 * `quizmaster` is the default, so every account that already exists is one and
 * nothing has to be migrated.
 */
export const KINDS = ['quizmaster', 'venue'];
export const DEFAULT_KIND = 'quizmaster';

/** What to call one on screen. */
export const KIND_LABEL = { quizmaster: 'Quizmaster', venue: 'Venue' };

/** What kind an account is, tolerating everything written before kinds existed. */
export function kindOf(account) {
  const kind = account && account.kind;
  return KINDS.includes(kind) ? kind : DEFAULT_KIND;
}

/**
 * A subscription that has lapsed loses features — but see `can()`. Nothing in
 * here is allowed to interrupt a night that is already running.
 */
export const STATUSES = ['trialing', 'active', 'past_due', 'cancelled'];
const PAYING = new Set(['trialing', 'active']);

/**
 * Can this account do this thing?
 *
 * ENTITLEMENT ONLY, deliberately. This is what `allowed()` on the server asks,
 * and it does not consider what somebody has switched off for themselves —
 * because a switch on your own account page is about tidiness, and a switch
 * that could 403 you in the middle of a gig is a reliability risk for no
 * benefit at all. Nobody needs protecting from themselves here.
 *
 * The console draws itself from `entitlements.features`, which IS filtered by
 * the switches, so turning something off does make it disappear.
 *
 * @param {object} account
 * @param {string} feature   one of FEATURES
 */
export function can(account, feature) {
  if (!account || !feature) return false;
  // The host key is every hat at once — see `allowed()` in server.js, which
  // short-circuits on the same flag. Both have to agree or the page draws one
  // thing and the API does another; that has happened twice now, and the
  // second time the console showed "have a look in the shop" to the man who
  // writes the packs.
  if (account.bootstrap) return true;
  if (account.role === 'owner') return OWNER_FEATURES.includes(feature);

  // Everything else — comped, paying, or lapsed — is one question, asked in
  // one place. `featuresFor` already knows that a comped account needs no
  // subscription and a lapsed one has nothing.
  return featuresFor(account).includes(feature);
}

/**
 * Everything an account is ENTITLED to, as a flat list.
 *
 * Entitlement only. What somebody has chosen to switch off is a separate
 * question asked in a separate place (`prefs`, and `switchedOn()` below) —
 * because a preference must only ever be able to take something away, never to
 * add one. That is the line the whole My account page is drawn along.
 */
export function featuresFor(account = {}) {
  // Everything, for the same reason `can()` says yes to everything: the key
  // already grants the lot server-side, so reporting less here only ever
  // hides a button that would have worked.
  if (account.bootstrap) return [...new Set([...Object.values(FEATURES)])];
  if (account.role === 'owner') return [...OWNER_FEATURES];
  // The owner's own quizmaster account: everything on the ladder, for nothing.
  if (account.comped) return featuresAt(TIERS[TIERS.length - 1].id);
  if (!PAYING.has(account.status)) return [];
  return featuresAt(tierFor(account));
}

/**
 * Has this account switched this feature off for itself?
 *
 * **Subtractive only, and that is the whole safety property.** A switch can
 * take away something the tier includes; it can never reach one the tier does
 * not. So this is asked AFTER `featuresFor`, never instead of it, and
 * `allowed()` on the server does not ask it at all — see the note on
 * `setPrefs()` in accounts.js.
 */
export function switchedOn(account = {}, feature) {
  const off = (account.prefs && account.prefs.featuresOff) || [];
  return !off.includes(feature);
}

/**
 * What this account actually has ON: entitled to, and not switched off.
 *
 * This is what the console draws itself from. It can only ever be a subset of
 * `featuresFor`, which is the thing the tests pin down.
 */
export function activeFeatures(account = {}) {
  return featuresFor(account).filter((f) => switchedOn(account, f));
}

/**
 * Why something is not available, in words a subscriber can act on.
 *
 * A greyed-out button with no explanation is how people decide an app is
 * broken rather than that they have not paid for something.
 */
export function whyNot(account, feature) {
  if (!account) return 'You are not signed in.';
  if (account.role === 'owner') {
    return 'That is on your quizmaster account, not the owner console.';
  }
  if (!account.comped && !PAYING.has(account.status)) {
    return account.status === 'past_due'
      ? 'Your subscription needs a payment before this comes back.'
      : 'Your subscription has ended. Renew it to use this again.';
  }
  // Above your tier: say which tier it is on, because "not on your plan" is a
  // dead end and "that is on Silver" is something you can act on.
  const needs = FEATURE_TIER[feature];
  if (needs && tierRank(needs) > tierRank(tierFor(account))) {
    const tier = findTier(needs);
    return `${(FEATURE_META[feature] || {}).label || 'That'} is on ${tier.label} (${tier.plan}). ${tier.blurb}`;
  }
  // On your tier, but you have switched it off yourself. Worth telling apart
  // from not having bought it — one is a shop and one is a switch you flicked.
  if (needs && !switchedOn(account, feature)) {
    return `${(FEATURE_META[feature] || {}).label || 'That'} is turned off on your account. Turn it back on under My account.`;
  }
  if (OWNER_FEATURES.includes(feature)) {
    // The generator is the one people ask about, so it says why rather than
    // just no: the packs are written by the owner and sold, and that is the
    // whole arrangement.
    return feature === FEATURES.GENERATE || feature === FEATURES.ARTWORK
      ? 'Quiz packs are written for you rather than generated here — have a look in the shop.'
      : 'That is not part of a quizmaster account.';
  }
  return 'That is not included on your plan.';
}

/**
 * What the console needs to draw itself: which tabs to show, and what to say
 * about the ones it is not showing.
 */
export function entitlements(account) {
  const held = featuresFor(account);
  const on = activeFeatures(account);
  return {
    role: account.role,
    // The ladder is the plan now. `plan` is kept as the tier id so anything
    // still reading it gets something sensible rather than undefined.
    tier: account.role === 'owner' ? 'owner' : tierFor(account),
    plan: account.role === 'owner' ? 'owner' : tierFor(account),
    addons: account.addons || [],
    comped: Boolean(account.comped),
    status: account.status,
    // What is ON — entitled to AND not switched off. This is what the console
    // draws tabs from, and it can only ever be a subset of `entitled`.
    features: on,
    // What the tier includes, whether or not it is switched on. The account
    // page needs both to draw a switch in the right position.
    entitled: held,
    ladder: account.role === 'owner' ? [] : ladderFor(account),
    // Everything they do NOT have, with the reason, so the console can offer it
    // rather than hide it. Something you can see and cannot use is a thing you
    // might buy; something invisible is a thing you never knew existed.
    missing: Object.values(FEATURES)
      .filter((f) => !on.includes(f))
      // Owner features are not for sale, so they are not offered.
      .filter((f) => !OWNER_FEATURES.includes(f))
      .map((f) => ({ feature: f, why: whyNot(account, f) })),
  };
}
