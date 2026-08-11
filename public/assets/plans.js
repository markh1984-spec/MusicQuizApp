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
   * Venue slides between rounds — SILVER, and it is the one feature that is
   * up a rung for a reason other than cost.
   *
   * A slide costs nothing to run, so the host's own rule does not force it out
   * of Bronze. But that rule only says what CANNOT be in Bronze; it does not
   * say everything cheap must be. This one earns its rung a different way: it
   * makes the quizmaster more money. They sell the venue the pizza nobody is
   * buying this week, and a QR to tickets they take a cut of — so it pays for
   * the upgrade in the subscriber's own terms rather than in the owner's.
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

  // ---- The admin add-on. Running a business rather than running a night.
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
    blurb: 'The whole machine, and eight packs to start with. Buy more as you need them.',
  },
  {
    id: 'silver',
    label: 'Silver',
    plan: 'Elite',
    rank: 1,
    pence: 2000,
    blurb: 'Every pack included, and every new one as it is written — plus invoicing and a calendar.',
  },
  {
    id: 'gold',
    label: 'Gold',
    plan: 'Pro',
    rank: 2,
    pence: 3000,
    blurb: 'Everything in Silver, plus running a night for a room that is not in the room.',
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
 * `'all'` means the whole catalogue. An ARRAY means only those pack ids.
 *
 * **Every tier is `'all'` today and that is deliberate**: this is the mechanism
 * with nothing switched on, so today's subscribers see exactly what they saw
 * before. Making Bronze a starter set is changing one line here — or setting
 * `packs` on one account, below, which beats it.
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
  silver: 'all',
  gold: 'all',
};

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

/** Is this one pack in reach? The single question every caller actually asks. */
export function canPlayPack(account, packId) {
  const allowed = packsFor(account);
  return allowed === 'all' || allowed.includes(String(packId));
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

  [FEATURES.INVOICES]: 'silver',
  [FEATURES.CALENDAR]: 'silver',
  [FEATURES.MARKETING]: 'silver',

  [FEATURES.STREAM]: 'gold',
};

/**
 * What each feature is called and what it does, for the account page.
 *
 * Here rather than in the console because the browser and the server both want
 * it and two copies drift — the same reason the tiers and the looks live in
 * files like this one.
 */
export const FEATURE_META = {
  [FEATURES.QUIZ]: { label: 'Music Quiz', blurb: 'Rounds of twenty seconds a question, fastest fingers win.' },
  [FEATURES.BINGO]: { label: 'Music Bingo', blurb: 'You play the tracks. Every phone gets its own card.' },
  [FEATURES.LIBRARY]: { label: 'The pack library', blurb: 'Read and play every quiz and bingo game in the shop.' },
  [FEATURES.BUY_PACKS]: { label: 'Buying packs', blurb: 'Whole quizzes and whole bingo games from the catalogue.' },
  [FEATURES.OWN_PACKS]: { label: 'Your own packs', blurb: 'Quizzes and bingo games you write yourself. Nobody else can read them.' },
  [FEATURES.LOOKS]: { label: 'Seasonal looks', blurb: 'Halloween, Valentine’s, Christmas — a palette and some shapes.' },
  [FEATURES.ADVERTS]: { label: 'Advert slides', blurb: 'Sell the venue a slide between rounds — their offer, or a QR to tickets. One set per venue, reused every week.' },
  [FEATURES.PHOTOS]: { label: 'Photos from the room', blurb: 'The room sends pictures straight to the big screen.' },
  [FEATURES.INVOICES]: { label: 'Invoicing', blurb: 'Bill for a night before you have left the car park.' },
  [FEATURES.CALENDAR]: { label: 'Your calendar', blurb: 'The nights you have booked in.' },
  [FEATURES.MARKETING]: { label: 'Marketing', blurb: 'Not built yet.' },
  [FEATURES.STREAM]: { label: 'Online quizzes', blurb: 'Run a night for a room that is not in the room.' },
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
  return TIERS.map((tier) => ({
    ...tier,
    included: tier.rank <= mine,
    features: Object.keys(FEATURE_TIER)
      .filter((f) => FEATURE_TIER[f] === tier.id)
      .map((f) => ({ id: f, ...(FEATURE_META[f] || { label: f, blurb: '' }), held: held.has(f) })),
  }));
}

const OWNER_FEATURES = [
  FEATURES.GENERATE, FEATURES.ARTWORK, FEATURES.CATALOGUE, FEATURES.SUBSCRIBERS,
  // The owner also needs the library, because writing and fixing the packs that
  // get sold is the job.
  FEATURES.LIBRARY,
];

export const ROLES = ['owner', 'quizmaster'];

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
