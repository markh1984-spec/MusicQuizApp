/**
 * THE FAQ — written once, drawn in three places.
 *
 * ---
 *
 * **IT EXISTS SO THE APP CAN STAY SHORT.** Every blurb in this app is one line
 * by rule — *"Invoicing — bill a venue before you leave the car park"* — because
 * fourteen features at three sentences each is a wall, and a wall gets scrolled
 * past. That only works if the detail lives somewhere, and until now it did not:
 * the rule in CLAUDE.md said *"the detail goes in an FAQ, not on the control"*
 * and pointed at a page nobody had written.
 *
 * **IT IS NOT A MANUAL.** The app should not need one. This is the page
 * somebody reads before they pay, and the page they are pointed at when a
 * one-line blurb was not enough. If an answer here is the only way to
 * understand a control, the control is wrong — that is the house rule, and this
 * file must not become the place it goes to hide.
 *
 * ---
 *
 * **ONE LIST, THREE RENDERINGS, AND THAT IS THE WHOLE POINT.** The sales page
 * already carried four hand-typed questions; the console had none. Two
 * hand-written copies of an answer is two answers that drift, and the one that
 * drifts is the one nobody is looking at. So:
 *
 *  - `/faq` draws the lot, folded;
 *  - `home.html` draws the five marked `home`, folded, under a link to the rest;
 *  - the console's Help tab draws the lot, OPEN.
 *
 * **THE CONSOLE'S COPY IS NOT FOLDED, and that is a fault this repo has already
 * paid for.** `render()` replaces the whole page on every state push, so a
 * `<details>` somebody had just opened would shut itself the moment a phone
 * joined — the same shape as the bingo card's *My prizes* fold, which is why
 * that one lives in a module binding. There is nothing here worth holding state
 * for, so the console simply prints the answers.
 *
 * **THE NUMBERS ARE IMPORTED, NEVER TYPED.** A price or a trial length written
 * out here is one that goes stale silently on the page whose whole job is being
 * believed. What cannot be imported — `MAX_PLAYERS` lives in `src/`, which a
 * browser module may not reach — is pinned by `test/faq.test.js` instead.
 *
 * **AND NOTHING HERE RESTATES A LEGAL PAGE.** Refunds, privacy and the terms
 * have their own pages and their own wording; a second statement of a refund
 * policy is a second policy. These answers LINK.
 */

import { PACK_PENCE, TRIAL_DAYS, REFERRAL_BONUS_DAYS } from './plans.js';

/**
 * The ceiling on one room, and it is `MAX_PLAYERS` in `src/engine.js`.
 *
 * Written out because a browser module cannot import from `src/` — and pinned
 * by a test, so raising the engine's ceiling fails rather than leaving a number
 * here that used to be true.
 */
export const ROOM_CEILING = 600;

const pounds = (pence) => (pence % 100 ? `£${(pence / 100).toFixed(2)}` : `£${pence / 100}`);

/**
 * Every answer, grouped.
 *
 * `a` is a list of paragraphs. A link is written `[words](/path)` and nothing
 * else in the string is treated as markup — see `paragraph()`.
 *
 * `home: true` marks the five the sales page shows — a shop window rather than a
 * reference, with the other twelve one link away.
 */
export const FAQ = [
  {
    section: 'Running a night',
    items: [
      {
        q: 'What do I actually need on the night?',
        home: true,
        a: [
          'A laptop with an HDMI lead into the venue\'s screen or projector, and wifi — '
          + 'a phone hotspot is fine. Nothing is installed: the console, the big screen '
          + 'and every player\'s phone all run in a browser.',
          'Sound comes out of whatever you already use. The laptop with the HDMI in it is '
          + 'the one wired to the PA, so that is where the app plays anything it plays.',
        ],
      },
      {
        q: 'Do players need an app, or an account?',
        home: true,
        a: [
          'Neither. They scan the QR on the big screen, or type the four-character join '
          + 'code, and they are in. No download, no sign-up, no email address.',
          'Their phone remembers them, so a team that played last month comes back with '
          + 'the same name and any drinks they have not collected yet.',
        ],
      },
      {
        q: 'How many people can play?',
        a: [
          `The app stops at ${ROOM_CEILING} phones in one room. That is a backstop rather `
          + 'than a target — it is there so that nothing can flood a room with junk teams — '
          + 'and it is well past the biggest pub night anybody has run on it.',
          'A room joining all at once is normal and expected: two hundred phones arriving '
          + 'in a few seconds is held at the door rather than refused, and your own screen '
          + 'says how many are waiting with one button to let them in.',
        ],
      },
      {
        q: 'What counts as one night?',
        a: [
          'Everything you run at one venue between six in the morning and six the next '
          + 'morning. A quiz and the bingo after it are one night, not two.',
          'That is what Past gigs files, what the headcounts count, and what a lapsed '
          + 'subscription\'s last night means. Six rather than midnight, so a second game '
          + 'at ten past twelve is still the night you are standing in.',
        ],
      },
      {
        q: 'What if the wifi drops, or the laptop restarts mid-quiz?',
        a: [
          'The scores, the team names and the question you were on are written to disk as '
          + 'the night moves, so the game comes back where it was. Phones reconnect on '
          + 'their own and get their own team back — nobody is thrown out and nobody has '
          + 'to rejoin by hand.',
          'Bingo marks are written the moment they are tapped, because nobody can re-tap '
          + 'ten songs they heard half an hour ago.',
        ],
      },
      {
        q: 'Can I use my own music?',
        a: [
          'Yes, and most people do. Music bingo is always your own DJ app — you play a '
          + 'chorus and move on, and the app just deals the cards and marks them.',
          'A music intro round can start the track for you if you connect Spotify; if you '
          + 'do not, it puts the question up and you play the record yourself off whatever '
          + 'you already have open.',
        ],
      },
    ],
  },
  {
    section: 'Quizzes and packs',
    items: [
      {
        q: 'What is a pack?',
        a: [
          'A whole product: one quiz — a night\'s worth, several rounds of questions — or '
          + 'one bingo game. You launch a pack.',
          'A round is part of one, and you can switch rounds off, reorder them, or build a '
          + 'night out of rounds from two different packs. What is bought and sold is '
          + 'always the whole thing, never a single round.',
        ],
      },
      {
        q: 'Can I write my own quizzes?',
        home: true,
        a: [
          'Yes — write and edit your own packs in the editor, and they are yours. What the '
          + 'app will not do is write one for you: the Quizporium catalogue is where '
          + 'written quizzes come from, and that is what the price includes.',
        ],
      },
      {
        q: `What does a single pack cost, and why ${pounds(PACK_PENCE)}?`,
        a: [
          `${pounds(PACK_PENCE)} buys one Quizporium pack outright, and it stays bought — `
          + 'it is for when you want one more rather than a different tier.',
          'Bronze comes with a starter set. Silver includes the whole catalogue and every '
          + 'new one, so there is nothing left to buy on it. Gold adds a fresh topical quiz '
          + 'every week. The ladder on [the shop](/signup) has the prices.',
        ],
      },
      {
        q: 'Can you read the quizzes I have written?',
        a: [
          'No, and it is worth saying how rather than just saying no. There is no route in '
          + 'the app that takes somebody else\'s account as a parameter, so a request from '
          + 'the Quizporium account resolves to the Quizporium account and finds nothing of '
          + 'yours. Your own packs are your intellectual property and are treated as it.',
          'If you ask for help with something, you can switch support access on from your '
          + 'own account page. It expires on its own, you can revoke it, and everything '
          + 'done while it is on is written into a log on that same page in plain words. '
          + 'The honest version is that the app will not let anybody in unless you let them '
          + 'in, and it shows you what they did.',
        ],
      },
      {
        q: 'If a question turns out to be wrong, does the fix reach me?',
        a: [
          'Immediately, including on a night that is already running. There is exactly one '
          + 'file per Quizporium pack and every console reads that same file, so there are '
          + 'no copies to go stale — a correction saved at nine o\'clock reaches a quiz on '
          + 'question four.',
          'Tell us the question and the answer and it gets fixed for everybody.',
        ],
      },
    ],
  },
  {
    section: 'Paying',
    items: [
      {
        q: 'Is there a free trial?',
        home: true,
        a: [
          `Signing up starts one straight away — a name and an email, no card. It runs for `
          + `${TRIAL_DAYS} days, or ${TRIAL_DAYS + REFERRAL_BONUS_DAYS} if another `
          + 'quizmaster referred you.',
          'You are told before it ends, and told again when it has.',
        ],
      },
      {
        q: 'What happens if a payment fails, or I am late paying?',
        a: [
          'You get one more night, and you are warned before it rather than after. A quiz '
          + 'already running is never interrupted by a billing problem, and nothing is '
          + 'deleted.',
          'After that the app stops starting new nights until the subscription is back. '
          + 'Everything you have made is still there when it is.',
        ],
      },
      {
        q: 'What happens to my packs if I cancel?',
        home: true,
        a: [
          'Your own quizzes, bingo games, past gigs, photographs and invoices stay on your '
          + 'account, and it all works again if you come back. Packs you bought outright '
          + 'stay bought.',
          'A Quizporium pack\'s licence ends with the tier that included it, the same as '
          + 'any other feature. The full wording is on [the refund policy](/refunds).',
        ],
      },
    ],
  },
  {
    section: 'The people in the room',
    items: [
      {
        q: 'Do photographs from a night go public?',
        a: [
          'Not unless you put them there. Photos a room sends go on the big screen on the '
          + 'night and nowhere else; a public gallery page is a deliberate press, one night '
          + 'at a time, and you can take a night down or bin a single photograph in one tap.',
          'Individual pictures can be switched off before a night goes up, and the control '
          + 'sits under the photographs themselves so nothing is published unseen.',
        ],
      },
      {
        q: 'What stops a rude team name going on the projector?',
        a: [
          'Nothing, deliberately. The room can see the screen and the room polices it, and '
          + 'a filter that eats "Scunthorpe" in front of sixty people is worse than the '
          + 'problem. You can rename or remove a team from your own screen in a second.',
          'Anything that leaves the room is different: the public league page and the '
          + 'report a venue is handed both mask names that should not be on them, and you '
          + 'can overrule that either way.',
        ],
      },
      {
        q: 'What do you do with players\' data?',
        a: [
          'As little as possible. A phone is remembered by a code it stores itself; there '
          + 'is no account, no email address and no password anywhere in the room. '
          + '[The privacy policy](/privacy) is the full answer.',
        ],
      },
    ],
  },
];

/**
 * `[words](/path)` becomes a link and everything else is escaped.
 *
 * A tiny pass rather than raw HTML in the strings above: the content is ours and
 * static, but an answer that can carry markup is one somebody will paste into
 * later. Nothing else in the string is markup — a stray bracket is a bracket.
 */
function paragraph(text) {
  const safe = String(text)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
  return safe.replace(/\[([^\]]+)\]\((\/[a-z0-9/?=&_-]*)\)/gi,
    (_, words, href) => `<a href="${href}">${words}</a>`);
}

/**
 * The list as markup.
 *
 * @param {boolean} fold   `<details>` (a page somebody reads) or open headings
 *                         (the console, which redraws on every state push)
 * @param {boolean} onlyHome  just the ones the sales page carries
 */
export function faqHtml({ fold = true, onlyHome = false } = {}) {
  const sections = FAQ
    .map((s) => ({ ...s, items: s.items.filter((i) => !onlyHome || i.home) }))
    .filter((s) => s.items.length);
  return sections.map((s) => {
    const body = s.items.map((item) => {
      const answer = item.a.map((p) => `<p>${paragraph(p)}</p>`).join('');
      return fold
        ? `<details class="ld-faq-item"><summary>${paragraph(item.q)}</summary>${answer}</details>`
        : `<div class="faq-item"><h4>${paragraph(item.q)}</h4>${answer}</div>`;
    }).join('');
    // The section heading is dropped on the sales page's handful, which are picked
    // across sections and would otherwise print four headings over one question
    // each.
    const head = onlyHome ? '' : `<h3 class="faq-section">${paragraph(s.section)}</h3>`;
    return head + body;
  }).join('');
}

/**
 * THE HELP TAB'S PANEL — the whole list, open, inside the console.
 *
 * **BELOW THE SUGGESTION BOX AND ABOVE THE SUPPORT DOOR.** The box keeps first
 * place for its own recorded reason — an idea is cheap to lose and a problem
 * gets reported however far down the page it is — and this sits above the
 * heavier support machinery, because answering a question is what most people
 * open Help for.
 *
 * **OPEN, NEVER FOLDED.** The console redraws the whole tab on every state
 * push, so a `<details>` somebody had just opened would shut itself the moment
 * a phone joined. The bingo card's *My prizes* fold survives that by living in
 * a module binding; there is nothing here worth holding state for.
 *
 * A STRING rather than a node, so this file imports nothing but `plans.js` and
 * stays loadable in a test and on a page with no console on it.
 */
export function faqPanelHtml() {
  return `<div class="panel"><h3>Questions</h3>
    <div class="tiny">The things a one-line label could not say — also public at
      <a href="/faq" target="_blank" rel="noopener">/faq</a>.</div>
    <div class="faq-list">${faqHtml({ fold: false })}</div></div>`;
}
