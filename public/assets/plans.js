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
  LIBRARY: 'library.own',        // their own packs: write, edit, import
  BUY_PACKS: 'packs.buy',        // the owner's catalogue
  LOOKS: 'looks',                // seasonal palettes and picture reveals
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

const BASIC = [
  FEATURES.QUIZ, FEATURES.BINGO, FEATURES.LIBRARY,
  FEATURES.BUY_PACKS, FEATURES.LOOKS, FEATURES.ADVERTS, FEATURES.PHOTOS,
];

/** The add-ons, and what each one turns on. */
export const ADDONS = {
  admin: {
    id: 'admin',
    label: 'Admin',
    blurb: 'Invoicing, and a calendar of the nights you have booked.',
    features: [FEATURES.INVOICES, FEATURES.CALENDAR, FEATURES.MARKETING],
  },
  stream: {
    id: 'stream',
    label: 'Online quizzes',
    blurb: 'Run a night for a room that is not in the room.',
    features: [FEATURES.STREAM],
  },
};

/** The plans a quizmaster can be on. */
export const PLANS = {
  basic: {
    id: 'basic',
    label: 'Basic',
    blurb: 'Everything needed to run a night: both games, your own library, and the packs you buy.',
    features: BASIC,
  },
};

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
 * @param {object} account
 * @param {string} feature   one of FEATURES
 */
export function can(account, feature) {
  if (!account || !feature) return false;
  if (account.role === 'owner') return OWNER_FEATURES.includes(feature);

  // Everything else — comped, paying, or lapsed — is one question, asked in
  // one place. `featuresFor` already knows that a comped account needs no
  // subscription and a lapsed one has nothing.
  return featuresFor(account).includes(feature);
}

/** Everything an account is entitled to, as a flat list. */
export function featuresFor(account = {}) {
  if (account.role === 'owner') return [...OWNER_FEATURES];
  if (account.comped) {
    return [...new Set([...BASIC, ...Object.values(ADDONS).flatMap((a) => a.features)])];
  }
  if (!PAYING.has(account.status)) return [];
  const plan = PLANS[account.plan] || PLANS.basic;
  const addons = (account.addons || []).flatMap((id) => (ADDONS[id] ? ADDONS[id].features : []));
  return [...new Set([...plan.features, ...addons])];
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
  const addon = Object.values(ADDONS).find((a) => a.features.includes(feature));
  if (addon) return `${addon.label} is an add-on. ${addon.blurb}`;
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
  return {
    role: account.role,
    plan: account.role === 'owner' ? 'owner' : (account.plan || 'basic'),
    addons: account.addons || [],
    comped: Boolean(account.comped),
    status: account.status,
    features: held,
    // Everything they do NOT have, with the reason, so the console can offer it
    // rather than hide it. Something you can see and cannot use is a thing you
    // might buy; something invisible is a thing you never knew existed.
    missing: Object.values(FEATURES)
      .filter((f) => !held.includes(f))
      // Owner features are not for sale, so they are not offered.
      .filter((f) => !OWNER_FEATURES.includes(f))
      .map((f) => ({ feature: f, why: whyNot(account, f) })),
  };
}
