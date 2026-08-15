/**
 * The console: where a night starts.
 *
 * Pick a game, pick a pack, launch. Everything you have ever saved is here,
 * so a quiz you wrote for a Harry Potter night in March is one tap away in
 * November — that is the whole point of packs being files rather than
 * something typed in fresh each time.
 */

import { esc, node, postJson, brandLink, brandMark, binIcon, paintNav, paintIdentity, menuRights } from './client.js';
import { paintScheme } from './schemes.js';
import { balanceAnswers } from './balance.js';
import { FEATURES, FEATURE_TIER, FEATURE_META, SWITCHABLE, findTier, switchable, NOT_BUILT } from './plans.js';
import { lobbyGameChoices, lobbyGameFor } from './lobby-games.js';
import { inSeason } from './looks.js';
import { packLookAttrs } from './pack-look.js';

/**
 * THE ERA IN BIG LETTERS, BEHIND EVERYTHING ELSE ON THE CARD.
 *
 * Asked for on 15 August 2026 after cartoon figures were tried and did not
 * read: *"the backgrounds can just have the decades in big letters as a
 * background, so 80s just has a big colourful 80s in the background so its
 * readable but not competing with the information on the quiet pack itself"*.
 *
 * **It is the answer the figures were reaching for.** A drawing has to survive
 * being 90 pixels tall behind a title, and six of them did not — a whole
 * person came out as a blob. Type does not have that problem: it is designed
 * to be read at any size, it is already in the app, it needs no asset, and
 * "80s" is unambiguous in a way a cartoon of somebody in flares never quite is.
 *
 * `aria-hidden`, because it is the decade the title already names — a screen
 * reader announcing "80s" before "The 1980s Pop Music Quiz" is noise.
 */
function packWord(look) {
  if (!look.word) return '';
  return `<span class="pack-word" aria-hidden="true"
    style="--pk-word-size: ${look.wordSize}px">${esc(look.word)}</span>`;
}
import { upcoming, tonight, clashTonight, nightKey, WEEKDAY_LABELS } from './diary.js';

const mainEl = document.getElementById('main');
const runningEl = document.getElementById('runningNow');

/**
 * The key is remembered on this device once you have arrived with it in the
 * address, so you can bookmark plain /console and never think about it again.
 */
const hostKey = new URL(location.href).searchParams.get('key')
  || localStorage.getItem('musicquiz.hostkey')
  || '';
/*
 * Remembered only while it is the way you are actually getting in.
 *
 * A key put in `?key=…` once used to be kept for good, so a browser that had
 * touched a key link stayed on the key for ever — and the switch showed a third
 * position saying "Host key" long after there was any reason to. That reads as
 * a bug you have forgotten about, which is worse than the small convenience of
 * not retyping it.
 *
 * It is still remembered when the key is genuinely how you are getting in
 * (nobody signed in), because that is the case it exists for. The moment a
 * signed-in owner is found, `load()` drops it — see below.
 */
if (hostKey) localStorage.setItem('musicquiz.hostkey', hostKey);

/**
 * Stop using the host key in this browser.
 *
 * Called when the owner picks a hat on the switch. The key is not revoked and
 * not changed — it is simply no longer REMEMBERED here, and taken out of the
 * address bar so a reload does not put it straight back. Without both of those
 * the key would win again on the very next page load (it beats a cookie by
 * design) and the switch would look like it had done nothing at all.
 *
 * The bookmark still works, because the key is in its URL rather than only in
 * storage — so this is a way out, never a lock-out.
 */
function forgetKey() {
  try { localStorage.removeItem('musicquiz.hostkey'); } catch { /* private browsing */ }
  const url = new URL(location.href);
  if (url.searchParams.has('key')) {
    url.searchParams.delete('key');
    history.replaceState(null, '', url.toString());
  }
}

/**
 * Ask for the key.
 *
 * Also used when a remembered key stops working — which happens if HOST_KEY is
 * left unset on a host that wipes its filesystem, because the app then invents
 * a new one on each deploy. Without this you would be stuck on an error with
 * nothing to click.
 */
function askForKey(message = '') {
  mainEl.replaceChildren(node(`
    <div class="panel">
      <h3>Host key</h3>
      ${message ? `<p class="tiny" style="color:var(--bad)">${esc(message)}</p>` : ''}
      <p class="tiny">Set as HOST_KEY on your host. If you never set one, the app
        invents one and prints it in the startup log.</p>
      <div class="row" style="margin-top:10px;display:flex;gap:8px">
        <input type="text" id="keyIn" placeholder="host key" style="flex:1 1 auto;padding:11px;border-radius:10px;background:rgba(255,255,255,0.08);color:var(--ink);border:1px solid var(--panel-line)">
        <button class="minor" id="keyGo" style="cursor:pointer">Unlock</button>
      </div>
    </div>`));
  document.getElementById('keyGo').addEventListener('click', () => {
    const key = document.getElementById('keyIn').value.trim();
    if (!key) return;
    localStorage.setItem('musicquiz.hostkey', key);
    location.href = '/console?key=' + encodeURIComponent(key);
  });
  document.getElementById('keyIn').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') document.getElementById('keyGo').click();
  });
}

const keyed = (path) => path + (path.includes('?') ? '&' : '?') + 'key=' + encodeURIComponent(hostKey);

/**
 * A link to another PAGE. Carries the key only if THIS visit arrived with one.
 *
 * `keyed()` appends it unconditionally, which is right for an API call — the
 * server has to be told who is asking — and wrong for the address bar. A
 * browser that merely REMEMBERS a key was getting every link built as
 * `?key=…`, so the moment you followed one the key was on screen, in your
 * history and over anybody's shoulder. Worse, it is self-sustaining: `load()`
 * only forgets a remembered key when there is NOT one in the URL, so following
 * a keyed link is exactly what stops it being forgotten.
 *
 * Keyed on the URL rather than on "is anybody signed in", because `/api/me`
 * answers as the BOOTSTRAP identity when a key is in play — so `me` is truthy
 * on the key too and cannot tell the two apart. The URL can.
 *
 * Nothing is lost: every page here reads the remembered key out of
 * localStorage on its way in, and a `?key=` bookmark still works exactly as it
 * did — it just does not spread itself to every other link on the page.
 */
const keyInUrl = new URL(location.href).searchParams.get('key') || '';
const linkTo = (path) => (keyInUrl ? keyed(path) : path);

/**
 * The big screen — for THIS room.
 *
 * `linkTo` adds the host KEY, which says who you are; it says nothing about
 * which room's projector you want. So every "Big screen" link in the app was a
 * bare `/screen`, which is the HOUSE room — and a quizmaster pressing it got
 * somebody else's projector, or an empty lobby, at their own gig.
 *
 * Invisible to the owner, whose room IS the house room, which is exactly why
 * it survived: it is only ever wrong for the second login.
 *
 * The house room deliberately has no code, so a bare `/screen` stays right for
 * it and every printed card and bookmark carries on working.
 */
function screenLink() {
  const code = library && library.joinCode;
  return linkTo(code ? `/screen?g=${encodeURIComponent(code)}` : '/screen');
}

let library = null;
/**
 * What this account is allowed to do.
 *
 * Fetched once at boot and used to decide which tabs exist. The enforcement is
 * entirely server-side — this only decides what to draw, so a fiddled copy in
 * a browser gets a tab that answers 403.
 */
let me = null;
// What goes in the menu — worked out once, from /api/me, the same way on
// every page. See `menuRights` in client.js.
let rights = { control: false, packs: false, owner: false };
const can = (feature) => !me || !me.entitlements || me.entitlements.features.includes(feature);
/** Which tier a feature first appears on, for the markers that name it. */
const tierNeeded = (feature) => FEATURE_TIER[feature] || '';

const whyNotHere = (feature) => {
  const missing = (me && me.entitlements ? me.entitlements.missing : []).find((m) => m.feature === feature);
  return missing ? missing.why : '';
};

/**
 * Draw the Owner | Quizmaster switch into the topbar, if this account has two
 * hats to switch between. `hatSwitch` returns null for everybody else, so the
 * slot simply stays empty rather than the page having to know the rule.
 */
function paintHatSwitch(who) {
  /*
   * Sign out, top right, next to the hat.
   *
   * It was the last button of "Everything else", four panels down a tab called
   * My account — which is a fine place for it if you already know where it is
   * and nowhere at all if you do not. Signing out is not an account SETTING,
   * it is a thing you do to the window you are looking at, so it belongs in the
   * furniture rather than in a page.
   *
   * Not shown on the host key: there is no session to end, so the button would
   * do nothing and reading it would suggest otherwise.
   */
  paintIdentity(who, { forgetKey });
}


/** Does this app have accounts set up, or is it still host-key only? */
async function hasAccounts() {
  try {
    return Boolean((await (await fetch('/api/has-accounts')).json()).any);
  } catch {
    return false;
  }
}

async function load() {
  // Who is this? Asked first, because it decides which tabs exist at all.
  // A signed-in account needs no key; the key is the way in for anybody still
  // using a `?key=` link from before there were accounts.
  try {
    // Asked WITH the key, or the answer is wrong in the one case that matters:
    // signed in as the owner on the laptop you run gigs from. Without the key
    // the server sees only the cookie, says "owner", and the page draws itself
    // with no Launch button on any pack — while the API behind it would have
    // let the key launch perfectly well.
    const who = await (await fetch(keyed('/api/me'))).json();
    me = who.signedIn ? who.account : null;
    rights = menuRights(who);
    /*
     * An owner used to be bounced straight to /owner from here, which left
     * NOWHERE to generate or import a pack: the generator lives on this page
     * and the owner page has only subscribers and reported questions on it. So
     * the only way to write a quiz was the host key — an account was strictly
     * worse than the thing it replaced.
     *
     * The console is the CATALOGUE now, and the catalogue is the owner's job.
     * What an owner still cannot do here is run a night: the Launch buttons and
     * the running panel are gated on the game features, which an owner
     * deliberately has none of.
     *
     * And if a key is remembered from some earlier visit, forget it: an owner
     * signed in properly has no use for it, and a "Host key" tab hanging about
     * afterwards reads as a bug nobody can account for. The bookmark still
     * works — the key is in its URL, and using one deliberately still puts you
     * on it for that visit.
     */
    // NOT `me.role` — with a key in play the server answers as the bootstrap
    // identity, whose role is "quizmaster". `alsoSignedIn` is the cookie it
    // found underneath, which is the thing that says an owner is really here.
    // `keyInUrl` is the module-level one — the same question, asked once.
    if (who.alsoSignedIn && who.alsoSignedIn.role === 'owner' && hostKey && !keyInUrl) {
      forgetKey();
      location.reload();
      return;
    }
    // Which hat is on, and the way to change it — one control doing both, in
    // the top right, rather than a bar you scroll past and a button on another
    // page. Nothing is drawn at all for anybody with only one hat.
    paintHatSwitch(who);
  } catch {
    me = null;
  }

  accountsExist = await hasAccounts();

  const res = await fetch(keyed('/api/library'));
  if (res.status === 401) {
    // Nobody is signed in and the remembered key is no longer right. If there
    // are accounts on this app, the sign-in page is the answer; if there are
    // not, the key still is.
    localStorage.removeItem('musicquiz.hostkey');
    if (me) { location.href = '/login?next=/console'; return; }
    // No account and no working key. If this app has accounts on it at all,
    // signing in is the answer; the key box only helps somebody who has one.
    if (await hasAccounts()) { location.href = '/login?next=/console'; return; }
    askForKey(hostKey ? 'That key was not accepted. It may have changed — check your host\u2019s startup log.' : '');
    return;
  }
  if (res.status === 403) {
    const why = await res.json().catch(() => ({}));
    mainEl.replaceChildren(node(`<div class="problems"><strong>${esc(why.error || 'Not on your plan.')}</strong></div>`));
    return;
  }
  if (!res.ok) throw new Error('Could not load the library');
  library = await res.json();
  render();
  openRequestedRead();
  openRequestedSet();
}

/**
 * `?read=quiz:eighties` — open a pack's read-through straight from a link.
 *
 * There was no way to link one at all: the read-through only ever opened from
 * a click on its card, so "have a look at this pack" meant "open the console,
 * find it, press Read". On a phone, with the packs three to a row, that is the
 * difference between reading a quiz through on the train and not.
 *
 * Only ONCE per page load, tracked here rather than by tidying the URL —
 * `load()` runs again after every save, and a link that reopened the sheet
 * each time would trap you in it. Leaving the parameter in the address bar is
 * deliberate too: it is what makes the link worth sending, and pasting it a
 * second time should work exactly as it did the first.
 *
 * An id that is not there is IGNORED rather than an error. A pack can be
 * renamed or deleted between somebody sending a link and somebody opening it,
 * and landing on the console is the right outcome — not a page saying no.
 */
let readOpened = false;
/**
 * `?set=dogduck` — open an advert set's editor straight from a link.
 *
 * What the venue card's "Edit their slides" points at, so there is ONE editor
 * with two doors into it rather than two editors that can disagree. Same
 * shape and same rules as the read-through link above: once per page load
 * (`load()` runs again after every save and would otherwise trap you in the
 * sheet), and an id that is no longer there is ignored rather than an error.
 */
let setOpened = false;

function openRequestedSet() {
  if (setOpened) return;
  const wanted = new URL(location.href).searchParams.get('set');
  if (!wanted) return;
  setOpened = true;
  const found = (library.adverts || []).find((a) => a.id === wanted);
  if (found) editAdvertSet(found.id);
}

function openRequestedRead() {
  if (readOpened) return;
  const wanted = new URL(location.href).searchParams.get('read');
  if (!wanted) return;
  readOpened = true;

  const [head, ...rest] = String(wanted).split(':');
  const kind = (head === 'quiz' || head === 'bingo') ? head : '';
  const id = kind ? rest.join(':') : wanted;

  const find = (k) => (library[k === 'quiz' ? 'quizzes' : 'bingo'] || []).find((p) => p.id === id);
  // Unprefixed is allowed and looks in both, so a link can be written by hand.
  const found = kind ? { kind, pack: find(kind) } : (find('quiz')
    ? { kind: 'quiz', pack: find('quiz') }
    : { kind: 'bingo', pack: find('bingo') });
  if (!found.pack) return;

  // The pack is on a tab, and opening its read-through over a different one
  // would leave you somewhere unexpected when you close it. `?tab=` in the
  // link still wins, because that is somebody being explicit.
  if (!new URL(location.href).searchParams.get('tab')) {
    localStorage.setItem(TAB_STORE, found.kind);
    render();
  }
  preview(found.kind, found.pack);
}

/**
 * Their own packs — the half of the library that is theirs.
 *
 * It sits where the generator would be, because that is the honest shape of
 * the arrangement: the owner's packs are written FOR them, and this is what
 * they do instead of generating. Nothing here calls a model.
 *
 * The privacy line is said plainly and it is deliberately not a boast. What
 * the app promises is that it will not let the owner in unless they open the
 * door, and that what was done inside is written down for them to read — not
 * that the owner is incapable of reading a disk they own. Overstating it here
 * would be the one sentence a subscriber could later hold against the whole
 * feature.
 */
function ownQuizPanel() {
  /*
   * THE SAME QUESTIONS THE GENERATOR ASKS, ANSWERED BY HAND.
   *
   * "Write one" used to be a link straight into the editor with nothing
   * chosen, so the first job was building the shape of a quiz — add a round,
   * set its type, name it, add ten questions — before writing a single one.
   * The host's own framing: *"they need to be prompted on opening this with
   * the same options that I get when I generate one with AI — what is the
   * round type, how many questions. Essentially the same process but
   * manually."*
   *
   * So it is the same picker, off the same `QUIZ_ROUNDS`, and what changes is
   * only what happens when you press it: instead of asking Claude, it writes
   * the empty shape and drops you into the editor with the questions already
   * laid out to fill in. Their own packs then come out with the same house
   * structure as the written ones, which is most of what makes a pack feel
   * like one.
   */
  const el = node(`
    <div class="panel own-write">
      <h3>My packs</h3>
      <div class="tiny">Quizzes you write yourself, marked <b>Yours</b>. Nobody else can read them.</div>
      <div class="gen-row" style="margin-top:10px">
        <input type="text" class="own-title" maxlength="60" autocomplete="off"
          placeholder="What is it called — The Crown, Christmas 2026…">
        <button class="role-make own-go">Start writing</button>
      </div>
      <div class="gen-rounds">
        ${QUIZ_ROUNDS.map(([id, label, count, checked, hint]) => `
          <label class="gen-round ${checked ? '' : 'off'}" ${hint ? `title="${esc(hint)}"` : ''}>
            <input type="checkbox" data-round="${id}" ${checked ? 'checked' : ''}>
            <span class="gen-round-name">${esc(label)}</span>
            <input type="number" data-count="${id}" value="${count}" min="1" max="30" ${checked ? '' : 'disabled'}>
          </label>`).join('')}
      </div>
      <div class="tiny own-said">Pick the rounds and how many questions each. It lays them out
        empty and opens the editor — you fill in the words.</div>
    </div>`);

  // The count greys out with its tickbox rather than vanishing, so a number
  // you typed is still there when you tick it back on — same as the generator.
  for (const box of el.querySelectorAll('[data-round]')) {
    box.addEventListener('change', () => {
      const count = el.querySelector(`[data-count="${box.dataset.round}"]`);
      count.disabled = !box.checked;
      box.closest('.gen-round').classList.toggle('off', !box.checked);
    });
  }

  const said = el.querySelector('.own-said');
  el.querySelector('.own-go').addEventListener('click', async () => {
    const title = el.querySelector('.own-title').value.trim();
    if (!title) { said.textContent = 'Give it a name first.'; return; }
    const rounds = [...el.querySelectorAll('[data-round]')]
      .filter((b) => b.checked)
      .map((b) => ({
        type: b.dataset.round,
        count: Math.max(1, Math.min(30, Number(el.querySelector(`[data-count="${b.dataset.round}"]`).value) || 10)),
      }));
    if (!rounds.length) { said.textContent = 'Pick at least one round.'; return; }

    const button = el.querySelector('.own-go');
    button.disabled = true;
    said.textContent = 'Laying it out…';
    try {
      const made = await postJson('/api/mine/quiz/scaffold', { title, rounds }, { 'X-Host-Key': hostKey });
      location.href = linkTo('/editor') + (linkTo('/editor').includes('?') ? '&' : '?') + 'quiz=' + encodeURIComponent(made.id);
    } catch (err) {
      button.disabled = false;
      said.textContent = err.message || 'Could not start it.';
    }
  });

  const warning = ownPacksNote();
  if (warning) el.appendChild(warning);
  return el;
}

/**
 * Whether their own packs survive a restart, said in red when they do not.
 *
 * The same shape as the invoice book's warning and there for the same reason:
 * on a host with no permanent disk, a quiz somebody wrote and a quiz somebody
 * wrote once look identical until the day they differ. Silence would be the
 * app quietly deciding on their behalf that it did not matter.
 */
function ownPacksNote() {
  const own = (library && library.ownPacks) || null;
  if (!own || own.backedUp) return null;
  return node(`
    <div class="tiny warn">
      <b>Not backed up.</b> Your own packs are saved here but there is nowhere permanent to
      keep them yet, so a restart of the app loses them. Use <b>Download</b> on a pack card
      to keep a copy, and ask about turning the backup on.
    </div>`);
}

/**
 * The rounds the quiz generator can write, and how many of each by default.
 *
 * A count each rather than one number for the lot: "fifteen general knowledge,
 * five pictures and ten of the first-letter round" is what a night actually
 * looks like, and "ten of everything" is what the generator used to insist on.
 *
 * [id, label, default count, on by default, tooltip]
 */
const QUIZ_ROUNDS = [
  ['text', 'General knowledge', 10, true, ''],
  ['image', 'Whose face', 10, true, 'An illustrated portrait that pulls back as the clock runs down'],
  ['intro', 'Name that intro', 10, true, 'You play the first few seconds off your own music app'],
  ['multi', 'Pick them all', 10, false, 'Several answers are right — the room locks in all of them'],
  ['alphabet', 'First letter', 10, false, 'No options: they get a keyboard and only the first letter of the answer has to be right'],
];

/**
 * The tabs.
 *
 * One entry per thing you can run. Adding a third game means adding one entry
 * here and nothing else on this page — the tab bar, the panel and the pack
 * grid are all built from this list.
 *
 * **EVERY `label` IS TITLE CASE — every word capitalised, no exceptions.**
 * Set by the host on 14 August 2026, on spotting the one that was not: *"Music
 * Bingo has a capital M and a capital B, so My Account should have a capital M
 * and a capital A, and I want that to be a rule across the tabs."*
 *
 * He is right, and the reason it is worth a rule rather than a fix is that
 * these eight words sit in a row a few pixels apart. A row is read as ONE
 * object, so a single lower-case word in it does not read as a different
 * style — it reads as a mistake, and it is the sort that survives for months
 * because each label was written on a different day. Same fault as the three
 * font sizes within two pixels of each other in the Tonight head.
 *
 * It does not contradict the capitals rule in CLAUDE.md: that one is about
 * ALL CAPS being read as shouting. Title Case is a name, which is what a tab
 * is.
 */
const TABS = [
  {
    id: 'quiz',
    needs: FEATURES.LIBRARY,
    label: 'Music Quiz',
    blurb: 'Three rounds, twenty seconds a question, fastest fingers win.',
    editLabel: 'My packs',
    packs: () => library.quizzes,
    // Generating is the owner's, on the owner's bill. A quizmaster buys packs
    // — and writes their own, which is a different library and a different
    // panel rather than a cheaper generator.
    generator: () => {
      const wrap = document.createDocumentFragment();
      /*
       * WHAT THE ROOM ASKED FOR, above the generator and on this tab only.
       *
       * It is the answer to "what should I write next", so it belongs where
       * that is decided — and on ONE tab, because a queue drawn in two places
       * is two lists that disagree about what has been triaged.
       *
       * UNGATED, and it was gated on `owner.generate` for a day — which meant
       * a quizmaster could turn the switch on in My account, have their room
       * vote all night, and never be shown a single number. A switch whose
       * answer is invisible to the person who pressed it is worse than no
       * switch. Generating is the owner's; wanting to know what the room asked
       * for is everybody's, and what they do about it — write their own, buy
       * one, request one — is their business rather than this panel's.
       * `asksPanel()` draws nothing at all when there is nothing to say, so an
       * account that never turns it on never sees it.
       */
      wrap.appendChild(asksPanel());
      if (can(FEATURES.GENERATE)) wrap.appendChild(quizGeneratePanel(library.generation || {}));
      if (can(FEATURES.OWN_PACKS) && !can(FEATURES.CATALOGUE)) wrap.appendChild(ownQuizPanel());
      return wrap;
    },
  },
  {
    id: 'bingo',
    needs: FEATURES.LIBRARY,
    label: 'Music Bingo',
    blurb: 'You play the tracks. Every phone gets its own card.',
    editLabel: 'My packs',
    packs: () => library.bingo,
    generator: () => {
      const wrap = document.createDocumentFragment();
      if (can(FEATURES.GENERATE)) wrap.appendChild(generatePanel(library.generation || {}));
      // What the generator refuses to repeat, and the only way to clear it.
      if (can(FEATURES.GENERATE)) wrap.appendChild(forgetPanel());
      // Import writes a pack into the shared catalogue, so it is the owner's —
      // it was offered on LIBRARY, which every quizmaster has, and the server
      // now refuses it. A button that 403s is worse than no button.
      if (can(FEATURES.CATALOGUE)) wrap.appendChild(importPanel(library.generation || {}));
      else if (can(FEATURES.OWN_PACKS)) {
        // Their own track lists, filed in their own library. Same importer,
        // pointed somewhere else — see /api/mine/import.
        wrap.appendChild(importPanel(library.generation || {}, { own: true }));
      }
      return wrap;
    },
  },
  {
    id: 'adverts',
    needs: FEATURES.ADVERTS,
    label: 'Adverts',
    blurb: 'A set of slides per venue. Put any of them up between rounds.',
    count: () => (library.adverts || []).length,
    render: () => advertsSection(library.adverts || []),
  },
  {
    /*
     * GIGS — what is on, and what has been. ONE TAB, because it is one object.
     *
     * A booked night and a night you have run are the same thing at two points
     * in its life: booked, run, then billed. The console already carries nine
     * tabs whose bar scrolls sideways on a phone, and a tenth for "the same
     * nights, earlier" would be splitting by TENSE rather than by question —
     * which is the opposite of the rule that shaped the owner page.
     *
     * **INVOICES DELIBERATELY DID NOT JOIN THEM**, and that was asked. It is a
     * different question ("who owes me?") asked at a different moment, it has
     * a whole tab's worth behind it — your details, the bank, VAT, statuses,
     * the PDF — and its badge counts what you are still owed, which is a
     * number worth seeing without opening anything. A second badge on one tab
     * costs the first one its meaning. On a Monday "send the invoices" is a
     * destination you want to land on rather than scroll to.
     *
     * What keeps the chain intact instead is a one-tap **Invoice this** on
     * every past night, filled in from the night itself — so booked → run →
     * billed is still one press at each step without one enormous tab.
     *
     * The tab needs PAST_GIGS; the diary half asks for CALENDAR separately, so
     * an account holding one and not the other gets the half it holds rather
     * than a tab that half works.
     */
    /*
     * THE DIARY, ITS OWN TAB — left of Gigs, because the evening runs left to
     * right and what is BOOKED comes before what has been RUN.
     */
    id: 'diary',
    needs: FEATURES.CALENDAR,
    label: 'Calendar',
    blurb: 'What you have got coming, from your venues\u2019 usual nights.',
    // The same source the panel draws from, so the badge and the list can never
    // disagree — `upcoming()` projects the venues' usual nights forward and
    // folds in the one-offs.
    count: () => upcoming({
      venues: library.venueRecords || [],
      bookings: library.bookings || [],
    }).length,
    render: () => diarySection(),
  },
  {
    id: 'past',
    needs: FEATURES.PAST_GIGS,
    label: 'Gigs',
    blurb: 'What you have got coming, and every night you have run.',
    // NIGHTS, not games. A quiz and the bingo after it are one evening, and a
    // badge saying 5 above a list of four rows is a badge nobody trusts.
    count: () => library.archiveNights || 0,
    render: () => gigsSection(),
  },
  {
    id: 'invoices',
    needs: FEATURES.INVOICES,
    label: 'Invoices',
    blurb: 'Bill for a night before you have left the car park.',
    // The badge is what you are still owed, not how many you have ever sent —
    // the number worth seeing without opening anything.
    count: () => (library.invoicing || {}).unpaidCount || 0,
    // Red when any of what you are owed is past its terms — see the note where
    // the badge is drawn for why this is not a second badge.
    urgent: () => Boolean((library.invoicing || {}).overdueCount),
    render: () => invoicesSection(),
  },
  /*
   * THE TABS RUN LEFT TO RIGHT ALONG A QUIZMASTER'S EVENING, and that is what
   * decides this order rather than how often each is used.
   *
   * The host's own framing (14 August 2026): *"I want the flow to go from left
   * to right within the app, because there are some sections that hand over to
   * each other. When a quizmaster has done a job, that job goes into his past
   * gigs — and from past gigs he goes to invoices, because you don't have an
   * invoice for a gig you haven't done yet."*
   *
   * So: what you will PLAY (the two pack shelves), what goes between the
   * rounds, the NIGHT itself — coming up and already run — then getting PAID
   * for it, then the standing arrangements behind all of it, and finally the
   * two you touch twice a year.
   *
   * **VENUES MOVED RIGHT, past Invoices, and that is the one that looks
   * wrong.** Everything downstream depends on it, which makes it feel early —
   * but dependency is not sequence: a venue is set up ONCE, and after that you
   * do not open the tab again for months. What made it feel like a starting
   * point was that you used to need it to launch, and **Tonight** removed
   * that: the venue, its prizes and its usual night now arrive in the launch
   * bar without going anywhere.
   *
   * GIGS SITS AT BOTH ENDS OF THE JOURNEY and is the one tab a timeline cannot
   * place — it holds Coming up as well as Past gigs. Splitting it would make
   * the order honest and add a tenth tab to a bar that already scrolls
   * sideways on a phone, so it stays whole and sits where the NIGHT is.
   */
  {
    /*
     * VENUES — one record, not a fourth list.
     *
     * A venue was three things that did not know about each other: the invoice
     * book's customers (whose own comment calls them "the venues you work
     * for"), an advert set per venue, and a plain name typed at launch. A tab
     * holding only prizes would have been a fourth.
     *
     * So this edits the INVOICE BOOK's record — the one that already holds the
     * name, the contact and the usual fee — and adds what they put up. The
     * Invoices tab still has its own customer sheet for the billing details;
     * this is the same list seen from the side that matters on a gig night.
     *
     * IT SITS TO THE RIGHT OF INVOICES, which reads wrong until you notice
     * that dependency is not sequence. Everything else hangs off this record,
     * so it feels like a starting point — but a venue is set up ONCE and then
     * not opened for months, which is what the right-hand end of this bar is
     * for. It used to be the thing you had to visit before launching; the
     * Tonight bar now brings the venue, its prizes and its usual night with
     * it, so there is nothing on a gig night that sends you here.
     */
    id: 'venues',
    needs: FEATURES.INVOICES,
    label: 'Venues',
    blurb: 'The places you play, and what they put up as prizes.',
    count: () => (library.venueRecords || []).length,
    render: () => venuesSection(),
  },
  {
    id: 'help',
    label: 'Help',
    blurb: 'The support door, the suggestion box, and what you have heard back.',
    /*
     * No `needs`, deliberately, like My account.
     *
     * This is where somebody goes when something is wrong — including when the
     * thing that is wrong is their subscription. A help tab that disappears at
     * the moment you need help is worse than not having one.
     */
    render: () => helpSection(),
  },
  {
    /*
     * MY ACCOUNT AND SETTINGS ARE ONE TAB AGAIN.
     *
     * They were split because they answer different questions — what you HAVE
     * and what you have ON, one read and one operated — and that was sound
     * while Settings carried the whole ladder: three tier panels, prices,
     * locked rows and a switch against every held feature. Scrolling past six
     * rungs to change a colour is what forced the split.
     *
     * Both halves have since shrunk to almost nothing. The sell became a
     * comparison table, and the switches collapsed to five once a rule decided
     * which were worth having at all. What is left is two short pages about
     * one subject, on a tab bar that scrolls sideways on a phone.
     *
     * **HELP DELIBERATELY STAYS ITS OWN TAB.** It is where somebody goes when
     * something is wrong — including when the thing that is wrong is their
     * subscription — and burying it inside a page called My account makes it
     * hardest to find at the moment it matters most. Same reason it carries no
     * `needs` at all.
     */
    id: 'account',
    label: 'My Account',
    blurb: 'Who you are, what you are on, your colours and your room.',
    // Always here, whatever is switched off — it is where things are switched
    // back on, so it can never be one of the things that goes away.
    render: () => accountSection(),
  },
];

const TAB_STORE = 'musicquiz.consoletab';

/** Logo and name, top left, linking home — as any website does. */
function paintBrand(name) {
  const slot = document.getElementById('brandSlot');
  if (!slot || !name) return;
  // The logo is a link home like any other, so it follows the same rule as
  // `linkTo`: the key only if this visit arrived carrying one.
  slot.innerHTML = brandLink(name, {
    key: keyInUrl, size: 26, appName: (library && library.appName) || '',
  });
  document.title = `Console — ${name}`;
}

function currentTab() {
  const wanted = new URL(location.href).searchParams.get('tab')
    || localStorage.getItem(TAB_STORE)
    || 'quiz';
  // A tab that has since been put away must not leave the page on something
  // with no tab lit — the last thing you looked at is remembered, and hiding
  // it is exactly when you would land back here.
  const shown = visibleTabs();
  if (shown.some((t) => t.id === wanted)) return wanted;
  return shown.some((t) => t.id === 'quiz') ? 'quiz' : (shown[0] || { id: 'account' }).id;
}

/**
 * What the last job said, kept outside the panel that said it.
 *
 * A finished import or generation calls load(), which rebuilds the whole page
 * from the library — and took the result with it. You pressed Import, watched
 * it work, and were left looking at an empty form with no word either way. The
 * pack WAS there, in the grid below, but nothing said so.
 *
 * So the result is held here and drawn at the top on every render. It stays up
 * until you dismiss it or start another job, which is right for something you
 * might walk away from mid-generation.
 */
let lastDone = null;

function showDone(tone, html) {
  lastDone = { tone, html };
}

function doneBanner() {
  if (!lastDone) return [];
  const el = node(`
    <div class="panel done-banner ${lastDone.tone}">
      <div class="done-text">${lastDone.html}</div>
      <button class="minor done-close" title="Dismiss">Close</button>
    </div>`);
  el.querySelector('.done-close').addEventListener('click', () => { lastDone = null; render(); });
  return [el];
}

// Whether this app has any accounts. Asked once at boot rather than on every
// render, because `render` is synchronous — it runs on every state change and
// an await in it would make the whole page repaint asynchronously for a
// question nobody asks twice.
let accountsExist = true;

function render() {
  paintBrand(library.brand);
  // Your own colours on your own console, straight away — the picker at the
  // bottom is where they are changed, but this is what makes the page arrive
  // already wearing them.
  paintScheme(library.scheme);
  const running = library.running;
  runningEl.textContent = aNightIsOn(running)
    ? `Now: ${running.title} (${running.playerCount} in)`
    : '';
  // Rebuilt on every render rather than once: the join code arrives with the
  // library, and which links you get depends on the tier you are previewing.
  paintNav(document.getElementById('navSlot'), { current: 'console', key: keyInUrl, ...rights });

  const active = currentTab();
  const live = Boolean(running && running.phase !== 'lobby' && running.phase !== 'finished');

  mainEl.replaceChildren(
    ...(backupWarning(library.generation || {}) || []),
    ...doneBanner(),
    ...firstOwnerPanel(),
    ...otherRoomsPanel(library.otherRooms || []),
    /*
     * The launch bar sits ABOVE the running panel, and only when nothing is
     * live — because those two are the same slot answering opposite
     * questions. Mid-game the top of the page is "what is on the projector
     * and how do I drive it"; the rest of the time it is "get me started".
     *
     * This is also what fixes the complaint that Stop does not appear to do
     * anything. It always did — every player and every score is cleared — but
     * the same big panel stayed on screen with the pack's name on it, because
     * a session ALWAYS has a pack loaded (`boot()` falls back to one so the
     * projector is never blank). Nothing to unload; the panel was just
     * describing a loaded pack as though it were a running night.
     */
    live ? node('<div></div>') : launchBar(),
    runningPanel(running),
    tabBar(active),
    tabBody(active),
  );
  showActiveTab();
}

/**
 * Bring the lit tab into view on a phone.
 *
 * The tab bar scrolls sideways on a narrow screen, and the tabs on the end —
 * Past nights, My account — are off the right of it. Tapping one changed the
 * page underneath while the tab you had just pressed stayed out of sight, so
 * the bar still looked like it was showing Music Bingo. On a phone that reads
 * as "did that work?" and gets tapped again.
 *
 * The bar's own `scrollLeft` rather than `scrollIntoView`, which would also
 * scroll the PAGE — and jumping the whole console down to the tab bar on every
 * render is a worse fault than the one being fixed.
 */
function showActiveTab() {
  const bar = mainEl.querySelector('.tabbar');
  const on = bar && bar.querySelector('.tab.on');
  if (!bar || !on) return;
  const barBox = bar.getBoundingClientRect();
  const tabBox = on.getBoundingClientRect();
  if (tabBox.left >= barBox.left && tabBox.right <= barBox.right) return;   // already there
  // Centred when there is room, so the tabs either side of it are visible too
  // and it is obvious the bar scrolls at all.
  bar.scrollLeft += (tabBox.left - barBox.left) - (barBox.width - tabBox.width) / 2;
}

/**
 * PRESSING A TAB PUTS THE TAB BAR AT THE TOP OF THE SCREEN.
 *
 * Asked for directly: *"would be good if a click on a tab made the tabs appear
 * to be the top of the page, so you can always just scroll up from there to
 * get to the launch bit"* — and it is the better of the two answers. It used
 * to jump to `top: 0`, which puts Tonight back on screen every time you change
 * tab, so the thing you actually pressed for starts a section and a half down
 * and you scroll past the launch panel to reach it. The other way round, every
 * tab opens at its own first line and Tonight is exactly one flick UP, in the
 * same place on every tab — which is the whole reason that panel sits above
 * the bar rather than inside a tab.
 *
 * Measured off the sticky topbar rather than a written-out number: the bar
 * WRAPS on a phone, so its height is 54px on a laptop and a good deal more
 * with the doors on a line of their own. A constant would hide the tabs
 * underneath it on the device this is most often held on.
 *
 * After `render()`, deliberately — the bar is rebuilt on every one, so the
 * element measured has to be the new one.
 */

/**
 * CHANGING TAB DOES NOT MOVE THE PAGE. YOU STAY WHERE YOU WERE.
 *
 * Asked for in those words: *"can clicking across the tabs keep the page in
 * place? So if I'm scrolled 100 pixels down on one tab I click into another
 * tab and it loads scrolled 100 pixels down."*
 *
 * **This is the third arrangement of one behaviour, and the previous two are
 * worth recording, because each was right about the console it was written
 * for.** First it scrolled the TAB BAR to the top of the screen, which was a
 * way of hiding a launch panel too tall to want on screen — three rows, a
 * guessed pack, a dropdown and a search box. Then that panel became a line and
 * a drop zone, so there was nothing left to hide from and `top: 0` was the
 * honest version: every tab starts in the same place, no arithmetic.
 *
 * What changes it again is that BOTH of those move the page, and moving the
 * page is only ever worth it if there is something to get away from. There is
 * not any more. Standing still is what a set of tabs is supposed to do — they
 * are one page with the middle swapped, and a page that jumps to the top every
 * time you press one makes them feel like nine separate pages instead.
 *
 * **IT HAS TO HOLD THE SCROLL, NOT MERELY DECLINE TO CHANGE IT**, which is the
 * part that would look like a one-line deletion and would not work.
 * `render()` replaces the whole of `mainEl` — so for an instant the document
 * is short, the browser clamps `scrollY` to the new maximum, and putting the
 * content back does NOT put the scroll back. Reading the offset before and
 * writing it after is the whole job.
 *
 * A shorter tab still clamps, and that is correct rather than a case to
 * handle: there is nowhere else for it to go, and the browser lands on the
 * bottom of the new tab, which is a real place.
 */
function renderKeepingPlace() {
  const y = window.scrollY;
  render();
  window.scrollTo({ top: y });
}


/* ========================================================== MY ACCOUNT
 *
 * Everything about YOU, rather than about a pack or a night: your name, your
 * colours, what you are subscribed to, which tabs you want on screen, and the
 * links to the rest of the app that were otherwise scattered.
 *
 * **The rule this page is built around: nothing here grants anything.**
 *
 * "Which features do I want" is two different questions and they must not share
 * a switch. What you have PAID for is the plan and the add-ons, it is set by
 * the owner, and there is no payment processor wired up yet — so a tick box
 * that turned invoicing on would be the paywall being handed to the customer.
 * What you want to LOOK at is a preference, it can only ever take a tab away,
 * and it is stored under `prefs`. This page shows the first as a statement and
 * offers the second as a switch, and the two are visibly different things.
 */
/**
 * Where you go when something is wrong.
 *
 * It did not exist, and the pieces were scattered in a way only somebody who
 * had already been shown them could find: the support door and the suggestion
 * box were the last two panels of **My account**, under your name, your
 * colours, your plan and your library, and asking for a pack that does not
 * exist is a fourth thing on a different tab entirely.
 *
 * So a quizmaster with a problem had to already know where the answer was
 * kept, which is the opposite of what a help page is for.
 *
 * The pack request deliberately STAYS on the pack tabs, under the shop — that
 * is where the want actually arrives, when you have scrolled the catalogue and
 * the shelf and neither has the thing. This tab points at it rather than
 * drawing a second copy: two ways to do one job is how you end up using the
 * worse one out of habit.
 */
function helpSection() {
  const wrap = document.createDocumentFragment();
  /*
   * THE SUGGESTION BOX GOES FIRST, above the support door and the log.
   *
   * Asked for on 14 August 2026, and it is the right way round: an idea is
   * offered when somebody is in a good mood and will not be chased if it is
   * awkward to find, where a problem gets reported however far down the page
   * the box is — somebody with a broken night will scroll. Putting the
   * cheap-to-lose one first is the same reasoning as "friction is the feedback
   * least likely to be sent".
   */
  wrap.appendChild(suggestionPanel());
  wrap.appendChild(supportPanel());
  wrap.appendChild(supportLogPanel());
  return wrap;
}

/**
 * Which room is yours, and the address your players actually use.
 *
 * Asked for after an evening of confusion that came down to not knowing which
 * of two rooms a phone had landed in. Nothing on any page said, so "why does
 * the console say nobody is playing when my phone says I am" had no answer you
 * could look up.
 *
 * The house room has no code and that is correct — bare /play reaches it, which
 * is what every printed card from before rooms existed says. So this panel says
 * WHICH of the two you are, in words, rather than showing an empty box.
 */
function roomPanel() {
  const code = (library && library.joinCode) || '';
  const play = `${location.origin}${code ? `/play?g=${encodeURIComponent(code)}` : '/play'}`;

  const el = node(`
    <div class="panel">
      <h3>Your room</h3>
      ${code ? `
        <div class="room-code">${esc(code)}</div>
        <div class="tiny">Yours for good — every quiz and bingo game you run uses them.</div>
        <div class="tiny" style="margin-top:8px">Players go to <b>${esc(play)}</b>, or scan the QR on your
          big screen.</div>
      ` : `
        <div class="tiny"><b>You are the house room</b>, which has no code — players go to
          <b>${esc(play)}</b> with nothing after it. That is deliberate: it is what every card printed
          before join codes existed says, so none of them had to be reprinted.</div>
      `}
    </div>`);
  return el;
}

/**
 * The things you OPERATE: your two colours, and which features are on.
 *
 * The ladder lives here rather than on My account because every rung of it is
 * a row of switches. What tier you are on is a fact and belongs with the other
 * facts; what you have switched off is a preference, and preferences are a
 * different page.
 */
/**
 * The tabs you want on screen.
 *
 * Only the handful that earn a switch — see SWITCHABLE in plans.js for the
 * rule, which is that turning it off has to REMOVE something and somebody has
 * to plausibly want it gone. Held features only: this is a page about tidying
 * your own console, not a shop, and a locked row with a price on it belongs on
 * the comparison table.
 */
function switchPanel() {
  const off = new Set(((library.prefs || {}).featuresOff) || []);
  const rows = SWITCHABLE
    .filter((f) => can(f))
    .map((f) => ({ id: f, ...(FEATURE_META[f] || { label: f, blurb: '' }) }));

  if (!rows.length) {
    return node(`<div class="panel"><h3>What you use</h3>
      <div class="tiny">Nothing to switch off on your tier.</div></div>`);
  }

  const el = node(`
    <div class="panel">
      <!-- "What is on screen" was a LABEL COLLISION and a bad one: this panel
           decides which TABS appear in your console, and the words say the
           projector. Tonight now says "On the big screen now", so the app had
           two screen phrasings meaning different things — and a quizmaster
           reading this one mid-gig would think it was about the room. -->
      <h3>What you use</h3>
      <div class="tiny">Turn off anything you do not use and its tab goes away. Nothing is
        lost — switch it back on whenever you like.</div>
      <div class="acct-toggles">
        ${rows.map((f) => `
          <div class="acct-toggle">
            <span class="acct-toggle-what"><b>${esc(f.label)}</b><br><span class="tiny">${esc(f.blurb)}</span></span>
            <span class="hat-switch feat-switch" data-feature="${esc(f.id)}" data-on="${off.has(f.id) ? '0' : '1'}">
              <button class="hat-half ${off.has(f.id) ? '' : 'live'}" data-want="1">On</button>
              <button class="hat-half ${off.has(f.id) ? 'live' : ''}" data-want="0">Off</button>
            </span>
          </div>`).join('')}
      </div>
    </div>`);

  // The same control as the hat switch in the top right, deliberately: one
  // shape for "is this on" across the whole app is recognised rather than read.
  for (const sw of el.querySelectorAll('.feat-switch')) {
    for (const half of sw.querySelectorAll('.hat-half')) {
      half.addEventListener('click', () => {
        const want = half.dataset.want;
        if (sw.dataset.on === want) return;
        sw.dataset.on = want;
        for (const h of sw.querySelectorAll('.hat-half')) h.classList.toggle('live', h.dataset.want === want);
        saveFeaturesOff(el);
      });
    }
  }
  return el;
}

/**
 * ASK THE ROOM WHAT THEY WANT NEXT TIME — one switch, off by default.
 *
 * The host's own call: *"this is the sort of feature that should have an
 * on/off button in the QM's settings tab."* It is not a tier thing — it grants
 * nothing and costs nothing — it is a decision about how you run a room, and
 * a quizmaster who has never heard of it should not have their customers
 * asked anything.
 *
 * The same switch shape as everything else on this page and as the hat in the
 * top right, deliberately: one shape for "is this on" across the app is
 * recognised rather than read.
 */
function askRoundsPanel() {
  const on = Boolean((library.prefs || {}).askRounds);
  const el = node(`
    <div class="panel">
      <h3>Ask the room what they want next</h3>
      <div class="tiny">At the final scores, every phone that played is offered three
        rounds your library has not got. They tap one; you get the count. Nothing is
        typed, so there is nothing to read but the numbers.</div>
      <div class="acct-toggles">
        <div class="acct-toggle">
          <span class="acct-toggle-what"><b>Ask for a round</b><br>
            <span class="tiny">Off unless you turn it on.</span></span>
          <span class="hat-switch ask-switch" data-on="${on ? '1' : '0'}">
            <button class="hat-half ${on ? 'live' : ''}" data-want="1">On</button>
            <button class="hat-half ${on ? '' : 'live'}" data-want="0">Off</button>
          </span>
        </div>
      </div>
      <div class="tiny ask-switch-said"></div>
    </div>`);

  const sw = el.querySelector('.ask-switch');
  const said = el.querySelector('.ask-switch-said');
  for (const half of sw.querySelectorAll('.hat-half')) {
    half.addEventListener('click', async () => {
      const want = half.dataset.want;
      if (sw.dataset.on === want) return;
      sw.dataset.on = want;
      for (const h of sw.querySelectorAll('.hat-half')) h.classList.toggle('live', h.dataset.want === want);
      try {
        const res = await fetch(keyed('/api/me/prefs'), {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'X-Host-Key': hostKey },
          body: JSON.stringify({ askRounds: want === '1' }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'Could not save that');
        library.prefs = data.prefs;
        // It is read at LAUNCH, so a night already running keeps what it was
        // launched with — worth saying, because a switch that appears to do
        // nothing tonight looks broken.
        said.textContent = 'Saved. It takes effect on the next night you launch.';
      } catch (err) {
        said.style.color = 'var(--bad)';
        said.textContent = err.message;
      }
    });
  }
  return el;
}

function accountSection() {
  const wrap = document.createDocumentFragment();
  // Who you are and what you are on, in one card at the top. They were two,
  // one under the other, both three short rows — which is two headings and two
  // borders around what is plainly one answer to "what is my account".
  wrap.appendChild(youPanel());
  // What the rungs are, right under what you are on — the question "what would
  // Silver actually get me" asked and answered in one glance, rather than by
  // reading three panels of switches and holding them in your head.
  const compare = comparePanel();
  if (compare) wrap.appendChild(compare);
  wrap.appendChild(roomPanel());
  // Silent when the whole catalogue is in reach, which is everybody today —
  // so it genuinely returns nothing rather than an empty panel.
  const lib = libraryPanel();
  if (lib) wrap.appendChild(lib);
  /*
   * The two things you OPERATE, below the facts — because this page is read
   * far more often than anything on it is changed. Settings used to be a tab
   * of its own; see the note on the tab entry for why it is not any more.
   */
  wrap.appendChild(askRoundsPanel());
  wrap.appendChild(schemePanel()[0] || node('<span></span>'));
  wrap.appendChild(switchPanel());
  wrap.appendChild(demoPrizePanel());
  return wrap;
}

/**
 * A prize QR to SHOW somebody, across a table, when you are selling a night.
 *
 * The whole feature is hard to describe and obvious to see: hand a landlord
 * your phone, they scan it, and they are looking at exactly what their bar
 * staff would see. That is worth more than any sentence about it.
 *
 * **It cannot be spent**, which is the part that makes it usable more than
 * once. `/v?c=DEMO` is handled entirely in the browser — no request, nothing
 * stored, a fresh one on every reload — so it works with no game running, at
 * four in the afternoon, in a pub with no wifi worth the name. And it draws
 * through the same function the real one does, so what somebody is shown is
 * what they would get rather than a mock-up that drifts from it.
 *
 * On My account rather than a tab of its own: it is a thing you have, like
 * your room's join link, and it is used a few times a year.
 */
function demoPrizePanel() {
  const target = `${location.origin}/v?c=DEMO`;
  return node(`
    <div class="panel">
      <h3>Show somebody the prize</h3>
      <div class="tiny">Selling a night to a venue? Let them scan this. They see
        exactly what their bar staff would see when a winner shows up. It is a
        demonstration — nothing is given away and it works as many times as you
        like.</div>
      <div class="demo-prize">
        <img class="demo-qr" alt="A demonstration prize code"
          src="/qr.svg?text=${encodeURIComponent(target)}&dark=%230b0b12&light=%23ffffff">
        <div class="demo-side">
          <a class="minor" href="/v?c=DEMO" target="_blank" rel="noopener">Open it yourself</a>
          <div class="tiny">${esc(target)}</div>
        </div>
      </div>
    </div>`);
}

/**
 * The ladder: a section per tier, the features in it, and a switch on each.
 *
 * **Bronze, Silver, Gold, and they STACK** — Gold includes Silver includes
 * Bronze. Which section you can touch is your tier; a section above it is shown
 * with its price and nothing to press, because something you can see and cannot
 * use is a thing you might buy and something invisible is a thing you never
 * knew existed.
 *
 * The switches inside a section you HAVE are yours: they turn a feature off for
 * yourself and put it away. They can only ever subtract — turning one on that
 * your tier does not include is not something the switch can express, because
 * the switch is not drawn there at all, and the server would refuse it anyway
 * (`setPrefs` filters against the tier the account actually holds).
 *
 * The list of tiers and which feature is in which comes from `plans.js`, so
 * this page cannot invent a tier and moving a feature is a one-word edit there.
 */
/**
 * WHAT YOU GET FOR GOING UP — a comparison table, not a settings page.
 *
 * The ladder used to do both jobs and did neither well: fourteen rows of
 * switches, most of which changed nothing, arranged so you had to read three
 * panels and hold them in your head to answer "what would Silver actually get
 * me". The host's own reading: *"I wanted a section where it's very obvious
 * what the value was in increasing your account, but I think a comparison
 * table would do the job better than a settings section."*
 *
 * So the two questions are split the way the tabs already split them —
 * **My account is what you HAVE and is read; Settings is what you have ON and
 * is operated.** This is the first one.
 *
 * **IT SHOWS ONLY WHAT DIFFERS**, which turns out to be three rows. Everything
 * else is Bronze — both games, every round type, your own packs, photos, past
 * gigs, invoicing and the diary — so a table listing them would be eleven rows
 * of three identical ticks, which is a table nobody reads and which makes
 * Bronze look thin when the whole point is that it is the entire app. The line
 * underneath says so instead, in one sentence.
 *
 * Built from `ladderFor()` rather than written out, so a tier moving in
 * `FEATURE_TIER` moves here too and the page cannot quietly start lying about
 * what is on which rung.
 */
function comparePanel() {
  const ladder = (me && me.entitlements && me.entitlements.ladder) || [];
  if (ladder.length < 2) return null;

  /*
   * A capability is worth a ROW only if some rung has it and some rung does
   * not. Anything on the bottom rung is on every rung above it, so it can
   * never differ — that is what `rank` means.
   */
  const bottom = ladder[0];
  const onBottom = new Set(bottom.features.map((f) => f.id));
  const rows = [];
  for (const tier of ladder) {
    for (const f of tier.features) {
      if (onBottom.has(f.id)) continue;
      rows.push({ id: f.id, label: f.label, from: tier.rank, soon: NOT_BUILT.includes(f.id) });
    }
  }

  const cell = (tier, row) => {
    if (tier.rank < row.from) return '<span class="cmp-no" aria-label="not included">—</span>';
    if (row.soon) return '<span class="cmp-soon">not yet</span>';
    return '<span class="cmp-yes" aria-label="included">&#10003;</span>';
  };

  /*
   * "YOURS" GOES ON EXACTLY ONE COLUMN — the highest rung you hold.
   *
   * `included` is true of every rung at or below yours, so labelling all of
   * them said "yours" three times and the word stopped meaning anything. It is
   * worst on a comped or bootstrap account, which holds the lot: every column
   * claimed to be the one you are on. The shading still marks everything you
   * hold; the label says where you ARE.
   */
  const yours = ladder.reduce((best, t, i) => (t.included ? i : best), -1);

  /*
   * The packs row carries each rung's own label and nothing is spliced on.
   *
   * Stitching "the one below, plus this one" was tried and is wrong, because
   * the rungs do not all ADD: Silver's whole catalogue SUPERSEDES Bronze's
   * eight, where Gold's weekly quiz genuinely is extra. It printed "Eight
   * packs to start, plus the whole catalogue", which is a sentence about a
   * subset. `TIER_PACKS` says the same thing — a list, then `evergreen`, then
   * `all`.
   *
   * So the cells say what each rung IS, and one line under the table carries
   * the cumulative fact once. The capability rows already read cumulatively on
   * their own, because the ticks repeat down the columns.
   */
  return node(`
    <div class="panel">
      <h3>The tiers</h3>
      <div class="cmp-scroll">
        <table class="cmp">
          <thead>
            <tr>
              <th></th>
              ${ladder.map((t, i) => `
                <th class="${t.included ? 'mine' : ''}">
                  <span class="cmp-tier tier-${esc(t.id)}">${esc(t.label)}</span>
                  <span class="cmp-price">${esc(priceLabel(t.pence))}</span>
                  ${i === yours ? '<span class="cmp-yours">yours</span>' : ''}
                </th>`).join('')}
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row">Packs</th>
              ${ladder.map((t) => `<td class="${t.included ? 'mine' : ''}">${
  esc((t.content && t.content.label) || 'Every pack')}</td>`).join('')}
            </tr>
            ${rows.map((row) => `
              <tr>
                <th scope="row">${esc(row.label)}</th>
                ${ladder.map((t) => `<td class="${t.included ? 'mine' : ''}">${cell(t, row)}</td>`).join('')}
              </tr>`).join('')}
          </tbody>
        </table>
      </div>
      <div class="tiny acct-note"><b>Each tier includes the one before it.</b>
        Every tier is the whole app — both games, all five round types, your own packs,
        photos from the room, past gigs, invoicing and your diary. What changes is how
        much of the catalogue you get.</div>
    </div>`);
}

/** £30 a month, £15 a month, or "included". Pence in, words out. */
function priceLabel(pence) {
  if (!pence) return 'included';
  return `£${(pence / 100).toFixed(pence % 100 ? 2 : 0)} a month`;
}

/**
 * Collect every switch across every tier section and save the ones that are
 * off, in one go.
 *
 * All of them rather than just the one that moved, so the stored list is always
 * the whole truth — a patch per tick would leave the file disagreeing with the
 * page the first time one of them failed.
 */
async function saveFeaturesOff(inPanel) {
  /*
   * EVERY switch on the page, not `.tier-panel .feat-switch`.
   *
   * That selector was written when the switches lived inside the ladder's tier
   * panels. Settings draws one flat list now, so it matched NOTHING — and this
   * function saves whatever it finds, so the first tap would have posted an
   * empty list and quietly switched every feature back on. A save that undoes
   * itself, with no error anywhere.
   */
  const switches = [...document.querySelectorAll('.feat-switch')];
  const featuresOff = switches.filter((s) => s.dataset.on === '0').map((s) => s.dataset.feature);
  try {
    const res = await fetch(keyed('/api/me/prefs'), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'X-Host-Key': hostKey },
      body: JSON.stringify({ featuresOff }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Could not save that');
    library.prefs = data.prefs;
    // Reload rather than re-render: turning a feature off changes which TABS
    // exist, and those come from `/api/me`, which has to be asked again.
    await load();
  } catch (err) {
    alert(err.message);
    void inPanel;
    await load();
  }
}

/**
 * The suggestion box.
 *
 * The same shape as "Something wrong with this one?" on the answer key, and it
 * works for the same reason: it catches the thought at the moment it happens.
 * A scheduled support hour asks somebody to remember at 7pm on a Tuesday what
 * annoyed them at 9:40pm mid-gig, and the good ones do not survive that trip.
 *
 * Three kinds, because they want completely different things doing about them
 * — an idea goes on a list, an irritation is a design question, a bug is a job
 * — and because three is what somebody can pick from without reading.
 *
 * Not gated on a tier, deliberately: the people most worth hearing from are
 * the ones having the worst time, who are the least likely to be on the top
 * rung.
 */
/**
 * Ask for a pack that does not exist yet — Gold.
 *
 * It posts into the suggestion box as a `pack` kind rather than to a route of
 * its own, so it arrives in the inbox the owner already reads, gets a reply
 * that clears it, and can be drafted like anything else. One list, one place
 * to look.
 *
 * **A rung above yours gets the offer rather than nothing**, which is the same
 * shape the tab bar and the account page already use: something you can see
 * and cannot use is a thing you might buy, where a control that is simply
 * absent is a feature nobody knows exists.
 */
function askForPackPanel(kind) {
  const may = can(FEATURES.REQUEST_PACK);
  const what = kind === 'bingo' ? 'bingo game' : 'quiz';

  if (!may) {
    return node(`
      <div class="panel ask-pack locked">
        <h3>Nothing here for the night you have booked?</h3>
        <div class="tiny">On <b>Gold</b>: name a theme, get a ${esc(what)} written. One a month.</div>
      </div>`);
  }

  /*
   * The deal, stated BEFORE anybody types.
   *
   * Being refused after writing three sentences is the version that annoys
   * people. "You have had this month's, the next is from the 1st" is a
   * sentence somebody can plan around — and naming the DAY is worth more than
   * the limit is, because a request with no stated turnaround is a promise
   * broken by silence.
   */
  const state = library.packRequest || { mayAsk: true, day: 'Monday' };
  const day = (d) => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'long' });
  const promise = `Written on <b>${esc(state.day || 'Monday')}s</b> — ask before then and it is in your library on
    <b>${esc(day(state.writtenOn))}</b>.`;

  if (!state.mayAsk) {
    return node(`
      <div class="panel ask-pack waiting">
        <h3>Your ${esc(what)} is on the list</h3>
        <div class="tiny">
          ${state.open ? `“${esc(state.open.text.slice(0, 120))}”<br>` : ''}
          ${state.position > 1
            ? `<b>${state.position}${state.position === 2 ? 'nd' : state.position === 3 ? 'rd' : 'th'} in the queue.</b> `
            : (state.open ? '<b>Next up.</b> ' : '')}
          ${state.open ? promise : `That is this month's — you can ask for the next one from <b>${esc(day(state.nextAllowedAt))}</b>.`}
        </div>
      </div>`);
  }

  /*
   * THE ANSWER SITS ABOVE THE BOX YOU ASKED FROM.
   *
   * The request is made here because this is where the want arrives — you
   * have scrolled the catalogue and the shelf and neither has the thing. But
   * the reply only ever showed on the Help tab, so you asked in one place and
   * heard back in another, and this panel reverted to an empty box as though
   * nothing had happened. Moving the whole thing to Help would have been the
   * wrong fix: then you would have to remember it exists.
   */
  const answered = state.lastAnswered;
  const heard = answered ? `
    <div class="ask-heard">
      <div class="tiny ask-heard-q">You asked: “${esc(answered.text.slice(0, 120))}”</div>
      <div class="ask-heard-a">${esc(answered.reply)}</div>
    </div>` : '';

  const el = node(`
    <div class="panel ask-pack">
      <h3>Ask for a ${esc(what)}</h3>
      ${heard}
      <div class="tiny">Name a theme, and anything about the room that would help.
        <br>${promise} <b>One a month.</b></div>
      <textarea class="ask-text" rows="3" maxlength="1200"
        placeholder="A One Direction ${esc(what)} — it is a hen night at The Crown, mostly late twenties…"></textarea>
      <div class="row" style="margin-top:8px">
        <!-- ROLE-MAKE, NOT THE GRADIENT. It wore the full account gradient,
             which put TWO "press this" fills on the Music Quiz tab — Launch in
             Tonight and this, a section below it — and the GUI rules allow
             exactly one a screen, because the moment there are two neither is
             the thing to press. Green is right rather than merely quieter: for
             a quizmaster this button ends with a pack in their library, which
             is what "makes something" means here, and it is the same green as
             Write it, which is the owner's version of this exact panel. -->
        <button class="role-make ask-send">Ask for it</button>
        <span class="tiny ask-said"></span>
      </div>
    </div>`);

  const said = el.querySelector('.ask-said');
  el.querySelector('.ask-send').addEventListener('click', async () => {
    const text = el.querySelector('.ask-text').value.trim();
    if (!text) { said.textContent = 'Say what you are after first.'; return; }
    const button = el.querySelector('.ask-send');
    button.disabled = true;
    try {
      await postJson('/api/suggestions', { text, kind: 'pack', where: `${kind} packs` }, { 'X-Host-Key': hostKey });
      el.querySelector('.ask-text').value = '';
      said.textContent = 'Asked. You will get a yes or a no — not silence.';
      // Redraw, so the panel becomes the queue position rather than an empty
      // box you could type into again.
      await load();
    } catch (err) {
      // The one refusal worth wording properly: they already have one waiting,
      // which is not a failure, it is the queue working.
      said.textContent = err.message;
    }
    button.disabled = false;
  });
  return el;
}

function suggestionPanel() {
  const el = node(`
    <div class="panel">
      <h3>Suggestion box</h3>
      <!-- The turnaround is stated, and it is the SAME line whichever kind is
           picked. A request with no stated turnaround is a promise broken by
           silence — the same reason the pack panel names its day. There is
           deliberately no faster route for "something broken": see the
           suggestion-box notes in CLAUDE.md, where that was argued and turned
           down. -->
      <div class="tiny">Straight to Mark, and changes get made on Mondays.</div>
      <div class="row sugg-kinds" style="margin-top:12px">
        <button class="minor sugg-kind on" data-kind="idea">An idea</button>
        <button class="minor sugg-kind" data-kind="annoying">Got in my way</button>
        <button class="minor sugg-kind" data-kind="broken">Something broken</button>
      </div>
      <textarea class="sugg-text" rows="3" maxlength="1200"
        placeholder="What happened, or what would make it better?"></textarea>
      <div class="row" style="margin-top:8px;align-items:center;gap:12px">
        <button class="go sugg-send">Send it</button>
        <span class="tiny sugg-said"></span>
      </div>
      <div class="sugg-mine"></div>
      <!-- A POINTER, not a second copy of the form. Asking for a pack belongs
           where the want arrives — under the shop, once the catalogue and the
           shelf have both failed you — but somebody on a help page should not
           have to already know that. -->
      <div class="tiny acct-note">Want a whole quiz that does not exist yet? Ask at the bottom of the
        <b>Music Quiz</b> or <b>Music Bingo</b> tab, under the catalogue, where you can see what is
        already there first.</div>
    </div>`);

  /*
   * What you have sent, and anything that came back.
   *
   * Without this the box is one-way: you send something into the dark and
   * never learn whether it landed, which is how a feedback route stops being
   * used after the second time. Fetched rather than pushed, because it changes
   * about once a week and the console holds no live connection.
   */
  const mine = el.querySelector('.sugg-mine');
  fetch(keyed('/api/suggestions/mine')).then((r) => r.json()).then((d) => {
    const sent = d.suggestions || [];
    if (!sent.length) return;
    mine.appendChild(node(`
      <div class="tiny" style="margin-top:16px"><b>What you have sent</b></div>
      ${sent.slice(0, 8).map((s) => `
        <div class="sugg-mine-row">
          <div>${esc(s.text)}</div>
          ${(s.replies || []).map((r) => `
            <div class="sugg-reply"><span class="tiny">${esc(r.by || 'Mark')} replied</span>
              <div>${esc(r.text)}</div></div>`).join('')
            || '<div class="tiny">Not answered yet — it is on the list.</div>'}
        </div>`).join('')}`));
  }).catch(() => { /* never worth an error on this panel */ });

  let kind = 'idea';
  for (const b of el.querySelectorAll('.sugg-kind')) {
    b.addEventListener('click', () => {
      kind = b.dataset.kind;
      for (const other of el.querySelectorAll('.sugg-kind')) other.classList.toggle('on', other === b);
    });
  }

  const text = el.querySelector('.sugg-text');
  const said = el.querySelector('.sugg-said');
  el.querySelector('.sugg-send').addEventListener('click', async () => {
    const words = text.value.trim();
    if (!words) { text.focus(); return; }
    try {
      const res = await fetch(keyed('/api/suggestions'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Host-Key': hostKey },
        // Which tab they were on. Sent rather than guessed, and it is the
        // difference between "the editor is confusing" being actionable and
        // being a shrug.
        body: JSON.stringify({ text: words, kind, where: currentTab() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not send that');
      // Cleared and acknowledged in place. No reload: a panel that rebuilt the
      // whole page would lose anything else half-typed on it.
      text.value = '';
      said.textContent = 'Sent — thank you.';
      setTimeout(() => { said.textContent = ''; }, 6000);
    } catch (err) {
      said.textContent = err.message;
    }
  });
  return el;
}

/**
 * What was done while the door was open.
 *
 * Its own panel rather than a tail on the switch: the switch is a thing you
 * OPERATE and the log is a thing you READ, and a record of what somebody did
 * in your account is not a footnote to a toggle.
 *
 * It shows READS as well as writes, because "did you look at my quizzes" is
 * the question it exists to answer and a writes-only log would be silent about
 * exactly that. It is what the OWNER did, never a diary of your own use.
 */
function supportLogPanel() {
  const support = (me && me.support) || null;
  const log = (support && support.log) || [];
  return node(`
    <div class="panel">
      <h3>The support log</h3>
      ${log.length ? `
        <div class="tiny">Everything the owner has done in your account, most recent first.</div>
        <div class="support-log">
          ${log.slice(-40).reverse().map((row) => `
            <div class="support-row">
              <span class="tiny">${esc(new Date(row.at).toLocaleString('en-GB'))}</span>
              <span>${esc(row.what)}</span>
            </div>`).join('')}
        </div>`
        : '<div class="tiny">Nothing to show — nobody has been in.</div>'}
    </div>`);
}

/**
 * Letting the owner into your account — your switch, and your log.
 *
 * A quizmaster's own material is their work, and "only when you let me in, it
 * shuts itself off, and here is everything I did" is a better answer than a
 * promise. So this is the whole feature from their side: one switch, the same
 * On | Off pill as everything else on this page, and the record underneath it.
 *
 * The log is the point. It shows READS as well as writes, because "did you
 * look at my quizzes" is the question it exists to answer, and a writes-only
 * log would be silent about exactly that.
 */
function supportPanel() {
  /*
   * `me` IS the account here — `load()` does `me = who.signedIn ? who.account
   * : null` — so the grant hangs straight off it.
   *
   * Worth saying, because it looks wrong from the outside: `/api/me` answers
   * `{ signedIn, account, ... }`, so anybody reading the raw payload concludes
   * this is looking in the wrong place, "corrects" it one level deeper, and
   * silently empties the log without breaking anything else on the page.
   */
  const support = (me && me.support) || null;
  const until = support ? Date.parse(support.expiresAt) : 0;
  const open = Boolean(until > Date.now());
  const log = (support && support.log) || [];

  const el = node(`
    <div class="panel">
      <h3>Support</h3>
      <div class="tiny">Off unless you need help. Everything done while it is on is in your support log.</div>
      <div class="acct-toggle" style="margin-top:10px">
        <span class="acct-toggle-what">
          <b>Support access</b><br>
          <span class="tiny support-say">${open
            ? 'Open. They can look at your account and fix things — but not run a night.'
            : 'Shut. Nobody can open your account but you — not the owner, not a key.'}</span>
        </span>
        <span class="hat-switch feat-switch" data-on="${open ? '1' : '0'}">
          <button class="hat-half ${open ? 'live' : ''}" data-want="1">On</button>
          <button class="hat-half ${open ? '' : 'live'}" data-want="0">Off</button>
        </span>
      </div>
      <div class="support-still" hidden></div>
      <div class="tiny acct-note support-note"></div>
    </div>`);

  const set = async (want) => {
    try {
      const res = await fetch(keyed('/api/me/support'), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'X-Host-Key': hostKey },
        body: JSON.stringify({ open: want }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not change that');
      await load();
    } catch (err) {
      alert(err.message);
    }
  };

  for (const half of el.querySelectorAll('.hat-half')) {
    half.addEventListener('click', () => {
      const want = half.dataset.want === '1';
      if (want !== open) set(want);
    });
  }

  /*
   * The dead man's switch, drawn.
   *
   * It runs down in half an hour and the app asks whether help is still needed
   * as it gets close. Saying yes resets it; saying nothing at all closes it,
   * which is the right outcome for somebody who has been called away — and
   * reopening is one tap, so being shut out early costs almost nothing.
   *
   * A local timer rather than anything live: the console holds no connection,
   * and this is a clock counting down, which the browser can do on its own.
   * Cleared on every render (see `supportTimer`) or each one would leave
   * another behind and they would all fight over the same panel.
   */
  const note = el.querySelector('.support-note');
  const still = el.querySelector('.support-still');
  const tick = () => {
    const left = until - Date.now();
    if (!open) {
      note.textContent = 'While it is off, your packs cannot be opened and your game cannot be touched.';
      return;
    }
    if (left <= 0) {
      // It ran out while they were looking at it. Redraw from the server
      // rather than guess, so the log comes back with it.
      clearInterval(supportTimer);
      load();
      return;
    }
    const mins = Math.floor(left / 60000);
    const secs = Math.floor((left % 60000) / 1000);
    note.textContent = `It switches itself off in ${mins}:${String(secs).padStart(2, '0')} unless you say you still need help. Switching it off yourself is instant.`;
    // Asked while there is still time to answer, not at the moment it dies.
    if (left < 5 * 60000 && still.hidden) {
      still.hidden = false;
      still.className = 'support-still';
      still.innerHTML = '<b>Still need help?</b> <button class="minor keep">Yes, keep it open</button>';
      still.querySelector('.keep').addEventListener('click', () => set(true));
    }
  };
  clearInterval(supportTimer);
  tick();
  if (open) supportTimer = setInterval(tick, 1000);

  return el;
}

// Module level, so a re-render replaces the countdown rather than adding one.
let supportTimer = 0;

/**
 * What you can play — the CONTENT half of a tier.
 *
 * The ladder below lists capabilities, and every one of them is already
 * yours on Bronze, so the page had nothing on it that said what a higher tier
 * would actually get you. The library is the lever, and this is where it shows.
 *
 * **A statement, never a switch, and never a shop.** It says what is in reach
 * and — only when something is not — what a tier above holds. That is the whole
 * upsell: it arrives while somebody is doing well, at the point they go looking
 * for something new to run, rather than as a button that interrupts them.
 *
 * Silent when the whole catalogue is in reach, which is everybody today. A
 * panel saying "you have all 15 of 15" is a line nobody needs to read, and a
 * page that congratulates you on owning everything is one you learn to skip.
 */
function libraryPanel() {
  const mine = (library.quizzes || []).length;
  const mineBingo = (library.bingo || []).length;
  // Sent by /api/library, which is the side that can actually count the files.
  const total = library.catalogue || null;

  /*
   * NOTHING AT ALL WHEN THE WHOLE CATALOGUE IS IN REACH — which is everybody
   * today, and which is what this file's own note has always said it should
   * do: *"a page that congratulates you on owning everything is one you learn
   * to skip, and the line has to still be worth reading on the day it
   * changes."* It was drawing a panel saying "every pack is yours to run"
   * above two numbers the tab badges already carry, so it said nothing twice.
   *
   * The panel exists for the day a tier holds three of nine. Until then it is
   * quiet, and the first time it appears it will mean something.
   */
  const restricted = total && (total.quizzes > mine || total.bingo > mineBingo);
  if (!restricted) return null;

  return node(`
    <div class="panel">
      <h3>Your library</h3>
      <div class="acct-grid">
        <div><div class="tiny">Quizzes</div><div class="acct-val">${mine} <span class="tiny">of ${total.quizzes}</span></div></div>
        <div><div class="tiny">Bingo games</div><div class="acct-val">${mineBingo} <span class="tiny">of ${total.bingo}</span></div></div>
      </div>
      <div class="tiny acct-note">${esc(total.blurb || 'A higher tier includes every pack in the catalogue, and each new one as it is written.')}</div>
    </div>`);
}

/** Who you are, and what the room sees when you run a night. */
function youPanel() {
  const name = (me && (me.name || me.email)) || 'the host key';

  // Your plan, folded in. It was its own card directly underneath — two
  // headings and two borders around what is plainly one answer to "what is my
  // account".
  const ent = (me && me.entitlements) || { features: [], missing: [] };
  const tier = (ent.ladder || []).filter((t) => t.included).slice(-1)[0];
  const tierName = ent.comped ? 'Everything, comped'
    : ent.role === 'owner' ? 'Owner'
    : tier ? `${tier.label} — ${tier.plan}` : 'None';
  const status = ent.status || 'active';
  const bad = status === 'past_due' || status === 'cancelled';

  const el = node(`
    <div class="panel">
      <h3>Your account</h3>
      <div class="acct-grid">
        <div><div class="tiny">Name</div><div class="acct-val">${esc((me && me.name) || '—')}</div></div>
        <div><div class="tiny">Email</div><div class="acct-val">${esc((me && me.email) || '—')}</div></div>
        <div><div class="tiny">On your projector</div><div class="acct-val brand-preview">${esc(library.brand || '')}</div></div>
        <div><div class="tiny">Tier</div><div class="acct-val">${esc(tierName)}</div></div>
        <div><div class="tiny">Subscription</div>
          <div class="acct-val ${bad ? 'bad' : 'good'}">${esc(status.replace('_', ' '))}</div></div>
      </div>
      <div class="tiny acct-note">Your projector name is your first name and the app's, so it matches
        how you introduce yourself.</div>
      ${bad ? `<div class="tiny acct-note bad"><b>A lapsed subscription never interrupts a night.</b>
        It is starting a NEW one that stops.</div>` : ''}
      ${me && !me.bootstrap ? '<div class="row acct-actions"><button class="minor" id="acctPw">Change your password</button></div>' : ''}
    </div>`);

  el.querySelector('#acctPw')?.addEventListener('click', async () => {
    const current = prompt('Your current password');
    if (!current) return;
    const next = prompt('Your new password — 10 characters or more');
    if (!next) return;
    try {
      const res = await fetch('/api/me/password', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ current, password: next }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not change it');
      // Changing a password signs every other session out, this one included.
      alert('Changed. You will need to sign in again.');
      location.href = '/login';
    } catch (err) {
      alert(err.message);
    }
  });
  void name;
  return el;
}

/**
 * What you are on. READ ONLY, and that is deliberate.
 *
 * Turning an add-on on for yourself would be the shop with no till. When
 * payments are wired up this is where "add it" goes, and it will talk to a
 * processor rather than to `accounts.update()`.
 */
/*
 * The reasons, not the feature ids.
 *
 * `missing` is one entry per FEATURE, so the admin add-on arrives three times
 * (invoices, calendar, marketing) with the same sentence on each — and the
 * sentence already names the add-on and says what it does. Printing
 * "admin.invoices" in front of it is an internal identifier on a page a
 * customer reads, three times over.
 */
const dedupe = (list) => [...new Set(list)];


/*
 * There was a "What you see" panel here that hid whole TABS. The tier sections
 * above do the same job better — they switch the FEATURE off, which takes its
 * tab with it, and they say which tier the feature is on while they are at it.
 * Two ways to do one thing is how you end up using the worse one out of habit.
 */

/**
 * Everywhere else in the app, in one place.
 *
 * These existed already but were scattered — two on the running panel, one in
 * a tab header, and the join link nowhere at all unless a game was up. A hub
 * is worth having precisely because you do not want to remember which page
 * each of them was on five minutes before a gig.
 */
/**
 * The other screens, in the topbar, on every tab.
 *
 * This replaces an "Everything else" panel that did the same job at the bottom
 * of My account — which is the right list in the wrong place: you want it five
 * minutes before a gig, and it was four taps and a scroll away on the tab you
 * visit least. One bar, next to the logo, present wherever you are.
 *
 * WHAT IT DELIBERATELY DOES NOT REPLACE is "Take control" on the running
 * panel. That one is not navigation — it only exists when a night is on, it is
 * the primary button, and it is the thing that was reported missing twice for
 * being a small grey link. A chip in a bar is "go there"; that button is "your
 * night is running, take it". Losing the second to tidy up the first would be
 * the same mistake in a new place.
 *
 * `screenLink()` rather than `linkTo()` for the projector, because the key
 * says who you are and says nothing about whose projector you want — see the
 * note on that function. Both it and the join page open in a NEW TAB: they are
 * the other windows of the same night, not somewhere you go instead.
 */


/**
 * Pick your two colours.
 *
 * On the My account tab, because it is a thing about YOU rather than about a
 * pack or a night. It spent a while at the bottom of every tab, which is a
 * setting following you around asking to be changed.
 *
 * The swatches are the colours themselves rather than their names. "Orchid"
 * means nothing until you have seen it, and the whole point is choosing
 * something you like the look of. Same reasoning as the photo filters being
 * shown rather than listed.
 *
 * It saves on the tap and repaints everything at once — the projector and every
 * phone in your room, over the connection they already have. There is no Save
 * button because there is nothing to lose: tap another one if you liked the
 * last better.
 */
function schemePanel() {
  const list = library.schemes || [];
  // The host key has no account to save a colour against, so it is told that
  // rather than shown a picker that quietly does nothing.
  if (!list.length) return [];
  const mine = library.scheme || list[0].id;
  const keyOnly = Boolean(hostKey) && !me;

  const el = node(`
    <div class="panel scheme-panel">
      <h3>Your colours</h3>
      <div class="tiny">Behind your logo, your buttons and your big screen.
        ${keyOnly
          ? '<b>Sign in to pick one</b> — the host key is a way in, not an account.'
          : 'A themed night still wins over them.'}</div>
      <div class="scheme-row">
        ${list.map((s) => `
          <button type="button" class="scheme-swatch ${s.id === mine ? 'live' : ''}"
                  data-scheme="${esc(s.id)}" title="${esc(s.blurb)}" ${keyOnly ? 'disabled' : ''}>
            <span class="scheme-blob" data-swatch="${esc(s.id)}"></span>
            <span class="scheme-label">${esc(s.label)}</span>
          </button>`).join('')}
      </div>
    </div>`);

  for (const button of el.querySelectorAll('.scheme-swatch')) {
    button.addEventListener('click', async () => {
      const wanted = button.dataset.scheme;
      if (wanted === mine) return;
      // Repaint before the round trip. It is a colour: if the save fails we put
      // it back, and waiting on the network to see a colour feels broken.
      paintScheme(wanted);
      for (const other of el.querySelectorAll('.scheme-swatch')) {
        other.classList.toggle('live', other === button);
      }
      try {
        const res = await fetch(keyed('/api/me/scheme'), {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'X-Host-Key': hostKey },
          body: JSON.stringify({ scheme: wanted }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'Could not save that');
        library.scheme = data.scheme;
      } catch (err) {
        paintScheme(mine);
        render();
        alert(err.message);
      }
    });
  }
  return [el];
}

/**
 * Make the very first owner account, from here.
 *
 * Only ever shown when the app has NO accounts at all, and only to somebody
 * holding the host key — which already grants everything, so this gives away
 * nothing new. It exists because the alternative was the command line, and
 * Render's free tier has no shell: there was simply no way to create the first
 * login on the live app.
 *
 * It disappears the moment it succeeds. Everything after this is owner-only.
 */
function firstOwnerPanel() {
  if (accountsExist) return [];

  const el = node(`
    <div class="panel warn">
      <h3>No accounts yet — make yours</h3>
      <div class="tiny">
        Right now the only way in is the key in your address bar. An owner account
        lets you sign in properly and hand a login to another quizmaster, who gets
        their own game, their own join code and their own photo wall.
      </div>
      <div class="row" style="margin-top:10px">
        <input class="ow-name" placeholder="Your name" autocomplete="off">
        <input class="ow-email" type="email" placeholder="you@example.com" autocomplete="off">
        <input class="ow-pass" type="password" placeholder="Password (10+ characters)" autocomplete="new-password">
        <button class="role-make ow-make">Create the owner account</button>
      </div>
      <div class="tiny ow-said"></div>
    </div>`);

  const said = el.querySelector('.ow-said');
  el.querySelector('.ow-make').addEventListener('click', async (e) => {
    const name = el.querySelector('.ow-name').value.trim();
    const email = el.querySelector('.ow-email').value.trim();
    const password = el.querySelector('.ow-pass').value;
    if (!email || password.length < 10) {
      said.textContent = 'An email address and a password of at least 10 characters.';
      said.style.color = 'var(--bad)';
      return;
    }
    e.target.disabled = true;
    e.target.textContent = 'Making it…';
    try {
      const res = await fetch(keyed('/api/owner/accounts'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password, status: 'active', comped: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not make it');
      said.style.color = '';
      said.textContent = 'Done. Sign in at /login and you land on the owner page.';
      accountsExist = true;
      // Not a redirect: the password was just typed and a page that vanishes
      // under you is how you end up not sure whether it worked.
      e.target.textContent = 'Made';
    } catch (err) {
      said.textContent = err.message;
      said.style.color = 'var(--bad)';
      e.target.disabled = false;
      e.target.textContent = 'Create the owner account';
    }
  });
  return [el];
}

/**
 * What everybody else's night is doing. Owner only, and read-only on purpose.
 *
 * Not so another room can be driven from here — it cannot, and deliberately:
 * one place moves a quiz. It is so that before you deploy, or clear something
 * out, you can see that somebody is halfway through a question.
 */
function otherRoomsPanel(others) {
  if (!others.length) return [];
  return [node(`
    <div class="panel">
      <h3>Other quizmasters</h3>
      ${others.map((r) => `
        <div class="tiny" style="display:flex;gap:10px;align-items:baseline;padding:3px 0">
          <b style="min-width:120px">${esc(r.label || r.id)}</b>
          <span style="color:var(--gold)">${esc(r.code)}</span>
          <span>${r.live ? esc(r.where || 'mid-game') : 'not playing'}</span>
          <span class="muted">${r.players} in</span>
        </div>`).join('')}
    </div>`)];
}

/**
 * The one warning worth putting at the top of the page.
 *
 * Without backup, everything made here is temporary — and nothing looks wrong
 * until the day it has gone. That is exactly the kind of failure that deserves
 * to be loud.
 */
function backupWarning(gen) {
  if (gen.backup) return null;
  /*
   * The OWNER's warning, about the OWNER's repository.
   *
   * It talks about generating packs and names two environment variables only
   * the owner can set, so a subscriber was being shown a setup instruction for
   * somebody else's server and told, in the loudest panel on the page, that
   * nothing they did was being kept. Their own version of this is
   * `ownPacksNote()`, which is about their packs and says what THEY can do.
   */
  if (!can(FEATURES.CATALOGUE)) return null;

  // Configured but broken is a different problem from never set up, and needs
  // a different fix, so say which.
  const detail = gen.backupConfigured
    ? `<b>GitHub backup is set up but not working:</b> ${esc(gen.backupError || 'unknown problem')}.
       Check GITHUB_TOKEN has <b>Contents: read and write</b> on
       ${esc(process_repo(gen))}, and that GITHUB_REPO looks like <code>owner/name</code>.`
    : `Set <b>GITHUB_TOKEN</b> and <b>GITHUB_REPO</b> to have packs filed into your
       repository automatically. See TODO.md part 2c.`;

  return [node(`
    <div class="panel backup-warn">
      <h3>Nothing here is being saved permanently</h3>
      <p class="tiny">
        Packs you generate or edit live on this server only, and the server is
        wiped every time it restarts — which on the free tier includes waking
        from sleep.
        <br><br>${detail}
      </p>
    </div>`)];
}

function process_repo(gen) {
  return gen.backupRepo || 'your repository';
}

/**
 * The tabs this account can see.
 *
 * A tab it has NOT paid for is still shown, greyed, with the reason on it —
 * something you can see and cannot use is a thing you might buy, and something
 * invisible is a thing you never knew existed. A tab its plan will never
 * include at all is simply absent.
 */
function visibleTabs() {
  /*
   * Three states, and telling the middle one from the last is the point.
   *
   *  - ON — `can()` reads `entitlements.features`, the tier's features MINUS
   *    anything switched off. Drawn normally.
   *  - ABOVE YOUR TIER — drawn greyed with a `+`, because something you can see
   *    and cannot use is a thing you might buy.
   *  - SWITCHED OFF BY YOU — gone completely. A `+` on it would be the shop
   *    trying to sell somebody the thing they just put away, which is both
   *    wrong and annoying.
   */
  return TABS.filter((tab) => {
    if (!tab.needs) return true;
    if (can(tab.needs)) return true;
    if (switchedOff(tab.needs)) return false;
    // An owner is not a customer, so nothing is dangled at them. A tab they do
    // not hold is simply absent rather than greyed with a price on it.
    if (me && me.role === 'owner') return false;
    return Boolean(whyNotHere(tab.needs));
  });
}

/** Entitled to it, but you turned it off yourself on the My account tab. */
function switchedOff(feature) {
  const ent = (me && me.entitlements) || {};
  return Boolean(ent.entitled && ent.entitled.includes(feature) && !(ent.features || []).includes(feature));
}

function tabBar(active) {
  const bar = node('<div class="tabbar" role="tablist"></div>');
  for (const tab of visibleTabs()) {
    if (tab.needs && !can(tab.needs)) {
      /*
       * The badge says WHICH tier, in that tier's own colour.
       *
       * A bare gold "+" on everything says "there is more" and nothing else.
       * Silver and Gold are the two rungs somebody is deciding between, so the
       * marker may as well answer the question rather than raise it — and the
       * colour does it before the words are read.
       */
      const needs = tierNeeded(tab.needs);
      const locked = node(`
        <button class="tab locked" role="tab" data-tab="${tab.id}" title="${esc(whyNotHere(tab.needs))}">
          ${esc(tab.label)}<span class="tabcount lock lock-${esc(needs || 'any')}">+</span>
        </button>`);
      locked.addEventListener('click', () => alert(whyNotHere(tab.needs)));
      bar.appendChild(locked);
      continue;
    }
    // Each tab says how to count itself. It used to fall back to the archive
    // length, which was right for one tab by accident and wrong for any other.
    // A tab with NEITHER — My account — simply wears no badge, rather than the
    // whole page dying on `tab.packs is not a function`, which is how the
    // account tab arrived.
    /*
     * The badge is what you can RUN, never what is on the shelf.
     *
     * Counting the shop in it would say "Music Quiz 7" to somebody holding
     * four, which reads as a fault in their account rather than as a shelf
     * they have not bought from. The grid gets the whole list and splits it
     * itself — see gameSection.
     */
    const count = tab.count
      ? tab.count()
      : (tab.packs ? (tab.packs() || []).filter((p) => !p.locked).length : 0);
    /*
     * ONE BADGE, TWO STATES — never a second badge.
     *
     * Invoices already counts what you are still owed. Somebody being LATE is
     * a different fact and a more urgent one, and the obvious move is a second
     * badge beside the first — which is exactly what this file's own rule
     * refuses, because a second badge costs the first one its meaning.
     *
     * So the badge stays the same number and turns red when any of it is
     * overdue. Nothing new to read, and the one thing worth acting on is
     * visible without opening the tab.
     */
    const urgent = tab.urgent ? tab.urgent() : false;
    const button = node(`
      <button class="tab ${tab.id === active ? 'on' : ''}" role="tab" data-tab="${tab.id}">
        ${esc(tab.label)}${count ? `<span class="tabcount ${urgent ? 'late' : ''}">${count}</span>` : ''}
      </button>`);
    button.addEventListener('click', () => {
      localStorage.setItem(TAB_STORE, tab.id);
      renderKeepingPlace();
    });
    bar.appendChild(button);
  }
  return bar;
}

function tabBody(active) {
  const usable = visibleTabs().filter((t) => !t.needs || can(t.needs));
  const tab = usable.find((t) => t.id === active) || usable[0];
  if (!tab) {
    return node(`
      <div class="problems">
        <strong>Nothing to show.</strong>
        ${esc((me && me.entitlements && me.entitlements.status === 'past_due')
          ? 'Your subscription needs a payment before your quizzes come back.'
          : 'Your subscription has ended.')}
      </div>`);
  }
  const wrap = node('<div class="tabbody"></div>');

  /*
   * EVERY TAB OPENS WITH ONE BIG HEADING, AND IT IS DRAWN HERE.
   *
   * The top of the page used to change shape as you moved along the bar:
   * Music Quiz gave you one 22px heading and two small ones inside cards,
   * Calendar and Gigs opened with a 22px heading, and Venues, Adverts, Help
   * and My account had none at all — a bare stack of panels. That is most of
   * what "everything is all over the place" was, and it is the one fault a
   * tab bar exists to prevent.
   *
   * IN ONE PLACE rather than in nine render functions, which is the whole
   * point: a heading each was exactly the arrangement that let four of them
   * go missing. It takes the tab's own label, so the heading and the lit chip
   * cannot disagree and a renamed tab renames its heading for free.
   *
   * It repeats the lit tab, and that is deliberate rather than an oversight.
   * A chip in a row of nine says which is on; a heading says what the page
   * you have landed on IS, at the size everything below it is measured
   * against — and without one the first thing on four tabs was a small bold
   * word inside a card, which reads as a subheading of nothing.
   */
  /*
   * THE MARK SITS BESIDE IT — asked for as *"a sub logo in every tab"*.
   *
   * The SAME drawing as the topbar logo and the favicon, out of
   * `brandmark.js`, because this file's oldest rule about the logo is that
   * there is exactly one of it: two copies is one that gets changed in one
   * place and not the other and goes unnoticed for a month. `brandMark()`
   * hands each one its own gradient id, which matters here more than
   * anywhere — nine of them on a page sharing one id would fight, and the
   * loser draws in the wrong colours.
   *
   * 26px, which is inside the range this mark is drawn at everywhere else
   * (22 on a phone, 26 on the projector, 30 on the console's own topbar) and
   * therefore inside the range the sound arcs stay off for. It follows the
   * account's scheme for free: the gradient stops are CSS custom properties.
   *
   * `aria-hidden`, because the heading beside it already says the word. A
   * screen reader announcing "Quizporium, Music Bingo" on every tab is the
   * same fault as a control whose only explanation is a `title`.
   */
  wrap.appendChild(node(`
    <div class="game-head tab-head">
      <div class="tab-head-name">
        <span class="tab-head-mark" aria-hidden="true">${brandMark(26)}</span>
        <h2>${esc(tab.label)}</h2>
      </div>
    </div>`));

  // A tab is either a game (generator + its saved packs) or a one-off panel.
  if (tab.render) {
    wrap.appendChild(tab.render());
    return wrap;
  }

  /*
   * WHOSE JOB IS THIS TAB FOR?
   *
   * For the owner it is writing, so the generator goes above the shelf. For a
   * quizmaster it is "find tonight's pack and press Launch", and everything
   * between the tabs and the library is in the way of it — a panel explaining
   * that packs are written for them, and a panel about writing their own, both
   * sitting above the only thing they came for.
   */
  const writing = can(FEATURES.GENERATE) || can(FEATURES.CATALOGUE);
  if (tab.generator && writing) wrap.appendChild(tab.generator());
  wrap.appendChild(gameSection(tab.id, tab.label, tab.blurb, tab.packs(), tab.editLabel));
  if (tab.generator && !writing) wrap.appendChild(tab.generator());
  return wrap;
}

/**
 * Build a whole quiz from a theme.
 *
 * Same shape as the bingo generator below it, so there is one place on this
 * page for "make me something new" rather than a button for one game and a
 * terminal command for the other.
 */
function quizGeneratePanel(gen) {
  const el = node(`
    <div class="panel generate quiz-generate">
      <h3>New quiz</h3>
      <div class="gen-row">
        <input type="text" id="qTheme" placeholder="A theme — the 1990s, Motown, Christmas number ones, Britpop…" autocomplete="off">
        <button class="role-make" id="qGo" ${gen.claude ? '' : 'disabled'}>Write it</button>
      </div>
      <div class="gen-rounds">
        ${QUIZ_ROUNDS.map(([id, label, count, checked, hint]) => `
          <label class="gen-round ${checked ? '' : 'off'}" ${hint ? `title="${esc(hint)}"` : ''}>
            <input type="checkbox" data-round="${id}" ${checked ? 'checked' : ''}>
            <span class="gen-round-name">${esc(label)}</span>
            <input type="number" data-count="${id}" value="${count}" min="1" max="30" ${checked ? '' : 'disabled'}>
          </label>`).join('')}
      </div>
      <div class="gen-opts">
        <label><input type="checkbox" id="qHard"> Harder than usual</label>
        <span class="tiny">A number each — fifteen general knowledge and five pictures is a normal night. Every question is checked by a second pass before you see it.</span>
      </div>
      <div class="gen-topical">
        <button class="go ghost" id="qTopical" ${gen.claude ? '' : 'disabled'}>The month just gone</button>
        <span class="tiny">
          Forty questions off the news, no theme needed: <b>20</b> general knowledge and
          <b>10</b> music from the last month, read off the web, then <b>10</b> music from any era so
          it is not all one thing. It is named after today and marked as current for a fortnight.
          Costs more than an ordinary quiz — it does the reading as well as the writing.
        </span>
      </div>
      <div class="gen-status" id="qStatus"></div>
      ${gen.claude ? '' : '<div class="tiny warn">Set ANTHROPIC_API_KEY to write quizzes.</div>'}
    </div>`);

  // Unticking a round greys its number out rather than hiding it, so the
  // count you had typed is still there when you tick it back on.
  el.querySelectorAll('[data-round]').forEach((box) => {
    box.addEventListener('change', () => {
      const row = box.closest('.gen-round');
      row.classList.toggle('off', !box.checked);
      row.querySelector('[data-count]').disabled = !box.checked;
    });
  });

  el.querySelector('#qGo')?.addEventListener('click', () => generateQuiz(el));
  el.querySelector('#qTopical')?.addEventListener('click', () => generateTopicalQuiz(el));
  el.querySelector('#qTheme')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') generateQuiz(el);
  });
  return el;
}

async function generateQuiz(panel) {
  const theme = panel.querySelector('#qTheme').value.trim();
  const status = panel.querySelector('#qStatus');
  if (!theme) {
    status.textContent = 'Give it a theme first.';
    return;
  }

  // In the order they are listed, each with its own count.
  const rounds = [...panel.querySelectorAll('[data-round]')]
    .filter((box) => box.checked)
    .map((box) => ({
      type: box.dataset.round,
      count: Number(panel.querySelector(`[data-count="${box.dataset.round}"]`).value) || 10,
    }));
  if (!rounds.length) {
    status.textContent = 'Pick at least one round.';
    return;
  }

  return runQuizJob(panel, '#qGo', 'Write it', {
    theme,
    rounds,
    hard: panel.querySelector('#qHard').checked,
  });
}

/**
 * The topical quiz — one button, no form.
 *
 * It sends a flag and the difficulty tickbox and nothing else. The SHAPE lives
 * on the server (TOPICAL_ROUNDS in src/generate-quiz.js) rather than being
 * assembled here, so a curl call and a button press cannot produce different
 * quizzes and there is one place to change what a topical night looks like.
 *
 * It ignores the theme box on purpose. The theme of this one is "the last
 * month", it is named after the date, and a half-typed theme sitting in the
 * box above is not an instruction — it is something somebody started and did
 * not finish.
 */
async function generateTopicalQuiz(panel) {
  return runQuizJob(panel, '#qTopical', 'The month just gone', {
    topical: true,
    hard: panel.querySelector('#qHard').checked,
  });
}

/**
 * Everything both quiz buttons do once they know what they are asking for.
 *
 * One copy, because the reporting is the part that has been wrong before —
 * the round that came back short, the pack that was not backed up, the
 * generation that ended with neither a result nor an error. A second button
 * with its own copy of that is a second button where those get fixed once.
 */
async function runQuizJob(panel, buttonSel, buttonWords, payload) {
  const status = panel.querySelector('#qStatus');
  const button = panel.querySelector(buttonSel);
  // Both buttons go down: two generations at once is two bills and a log that
  // interleaves into nonsense.
  const buttons = [...panel.querySelectorAll('#qGo, #qTopical')];
  buttons.forEach((b) => { b.disabled = true; });
  button.textContent = 'Writing…';
  lastDone = null; // a new job supersedes the last one's banner
  status.innerHTML = '<div class="gen-log"></div>';
  const logEl = status.querySelector('.gen-log');
  const say = (line) => {
    logEl.appendChild(node(`<div>${esc(line)}</div>`));
    logEl.scrollTop = logEl.scrollHeight;
  };

  try {
    const result = await streamGeneration('/api/generate/quiz', payload, say);

    if (result.error) {
      status.appendChild(node(`<div class="gen-bad">${esc(result.error)}</div>`));
      buttons.forEach((b) => { b.disabled = false; });
      button.textContent = buttonWords;
      return;
    }

    const done = result.done;
    const problems = done.problems || [];
    const said = `
        Written <b>${esc(done.title)}</b> — ${done.questionCount} questions across
        ${done.rounds} round${done.rounds === 1 ? '' : 's'}.
        <br>Checked over — ${done.rejected} question${done.rejected === 1 ? '' : 's'} thrown out and replaced.
        ${(done.short || []).length
          ? `<br><b style="color:var(--bad)">Round${done.short.length === 1 ? '' : 's'} ${done.short.map((r) => `${r.round} came back with only ${r.got} of ${r.wanted}`).join(', ')}.</b>
             That is the WRITER running out of questions it was confident about, not the checker throwing them away.
             Try a broader theme, or ask for fewer.`
          : ''}
        ${(done.unchecked || []).length
          ? `<br><b>Round${done.unchecked.length === 1 ? '' : 's'} ${done.unchecked.join(', ')} could NOT be checked</b> — the second pass was unreachable. Read ${done.unchecked.length === 1 ? 'that round' : 'those rounds'} line by line.`
          : ''}
        ${done.backedUp ? '<br>Backed up to GitHub — this one is permanent.' : '<br><b>Not backed up</b> — this will be lost when the app restarts.'}
        <br><b>Now read it.</b> <a href="${linkTo('/editor')}${done.id ? (linkTo('/editor').includes('?') ? '&' : '?') + 'quiz=' + encodeURIComponent(done.id) : ''}">Open the editor</a> and
        check every question before anyone else sees it.
        ${done.freshUntil
          ? `<br>This one is <b>topical</b> — ${done.searches} web search${done.searches === 1 ? '' : 'es'}${(done.sources || []).length ? ` across ${done.sources.length} site${done.sources.length === 1 ? '' : 's'}` : ''}.
             Worth running until <b>${esc(new Date(done.freshUntil).toLocaleDateString('en-GB', { day: 'numeric', month: 'long' }))}</b>, after which the room has stopped talking about it.`
          : ''}
        ${!done.needsImages ? '' : done.drew && !done.drew.error
    /*
     * The pictures are drawn as part of writing now, so this says what
     * happened rather than telling you to go and do it. The reused count is
     * worth showing: it is the shared portrait library paying for itself, and
     * "6 already drawn" is the difference between a free round and a paid one.
     */
    ? `<br><span class="tiny">Pictures: <b>${done.drew.made}</b> drawn${
  done.drew.reused ? `, ${done.drew.reused} already in your library` : ''}${
  (done.drew.failed || []).length ? ` — <b>${done.drew.failed.length} could not be drawn</b>, those keep a placeholder` : ''}.</span>`
    : `<br><span class="tiny"><b>The pictures could not be drawn${done.drew && done.drew.error ? ': ' + esc(done.drew.error) : ''}</b>
        — the round works on placeholders. Open the pack and press Pictures to try again.</span>`}`;
    status.appendChild(node(`<div class="gen-good">${said}</div>`));
    // A quiz has no song history, so backup is the only thing that can be amiss.
    showDone(done.backedUp && !(done.unchecked || []).length && !(done.short || []).length ? 'good' : 'warn', said);
    if (problems.length) {
      status.appendChild(node(`
        <div class="gen-bad">${problems.length} thing${problems.length === 1 ? '' : 's'} to fix in the editor:
          <ul style="margin:6px 0 0 18px">${problems.slice(0, 8).map((p) => `<li>${esc(p)}</li>`).join('')}</ul>
        </div>`));
    }
    button.textContent = 'Written';
    await load();
  } catch (err) {
    status.appendChild(node(`<div class="gen-bad">${esc(err.message)}</div>`));
    buttons.forEach((b) => { b.disabled = false; });
    button.textContent = buttonWords;
  }
}

/**
 * Read a streaming generation response, calling `say` for each progress line.
 * Both generators send plain lines, then one final DONE or ERROR line.
 */
async function streamGeneration(path, body, say) {
  const res = await fetch(keyed(path), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Host-Key': hostKey },
    body: JSON.stringify(body),
  });

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let done = null;
  let error = null;

  for (;;) {
    const chunk = await reader.read();
    if (chunk.done) break;
    buffer += decoder.decode(chunk.value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop();
    for (const line of lines) {
      if (!line || line === 'PING') continue;   // keep-alive, nothing to show
      if (line.startsWith('DONE ')) done = JSON.parse(line.slice(5));
      else if (line.startsWith('ERROR ')) error = line.slice(6);
      else say(line);
    }
  }

  // Neither a result nor a reason means the connection went away mid-job. The
  // server carries on regardless, so say that rather than leaving somebody
  // thinking it failed — and never hand a null back to the caller, which is
  // how this first showed up: "Cannot read properties of null".
  if (!done && !error) {
    error = 'The connection dropped before it finished. It may still have completed — reload and look at your packs before running it again.';
  }
  return { done, error };
}

/**
 * Whether the no-repeats list actually made it to GitHub.
 *
 * Said separately from the pack's own backup, because they can differ and when
 * they do it is this one that bites. Claude in the browser reads the PUSHED
 * history to decide what not to pick, so a history that only made it as far as
 * this server means next week's round can hand the room the same songs — and
 * nothing about the pack you are looking at would suggest anything was wrong.
 */
function historyLine(done) {
  if (done.historyBackedUp) {
    return '<br>These songs are now in the no-repeats list on GitHub, so the next round will avoid them.';
  }
  return `<br><b>These songs did NOT reach the no-repeats list on GitHub.</b>
    They are recorded here, but anything reading the list from GitHub — Claude in your
    browser — will not see them, and could pick them again. Import it again once backup is working.`;
}

/**
 * Bring in a list you already have.
 *
 * This is how a bingo game gets made now: Claude in a browser reads the
 * no-repeats list off this repository, picks the songs, builds the Spotify
 * playlist, and prints the tracks. This box is where they land.
 *
 * The paste box is open and first because it is the route, not the fallback.
 * It was behind a "or paste a track list instead" fold, from when a Spotify
 * playlist link was the main way in — and a panel that hides the thing you
 * came to do is a panel you use wrong.
 */
/**
 * @param {object} [opts]
 * @param {boolean} [opts.own]  file it in THEIR library rather than the
 *   catalogue. The no-repeats memory is left out of it in both directions —
 *   that is the owner's generator's record of what it has used, and neither
 *   half of that is true of a list somebody else pasted.
 */
function importPanel(gen, { own = false } = {}) {
  const el = node(`
    <div class="panel import">
      <h3>${own ? 'Make a bingo game of your own' : 'Or bring in a list you already have'}</h3>
      <div class="tiny">${own
        ? `Paste a track list — one per line — and it becomes a bingo game only you can see.
           Everything else works exactly as it does with a pack from the catalogue.`
        : `Paste what Claude printed — one track per line. It goes into the no-repeats list too, so next week's round avoids it.`}</div>
      <textarea id="impText" rows="7" placeholder="One per line — any of these work:&#10;&#10;Billie Jean — Michael Jackson&#10;1. Take On Me - a-ha&#10;Blue Monday by New Order"></textarea>
      <div class="gen-row">
        <input type="text" id="impUrl" placeholder="…or a Spotify playlist link instead" autocomplete="off">
        <button class="role-make" id="impGo">Import</button>
      </div>
      <div class="gen-opts">
        <label>Card <select id="impSize"><option value="3">3×3</option><option value="4" selected>4×4</option><option value="5">5×5</option></select></label>
        <label>Call it <input type="text" id="impTitle" placeholder="optional" style="width:150px"></label>
        ${own ? '' : '<label title="Off by default — you probably built this list on purpose."><input type="checkbox" id="impAvoid"> Skip songs played recently</label>'}
        <span class="tiny" id="impFit"></span>
      </div>
      <div class="gen-status" id="impStatus"></div>
      ${gen.spotify ? '' : '<div class="tiny warn">Spotify is not set up, so playlist links will not work — paste a list instead.</div>'}
    </div>`);

  if (own) {
    el.dataset.own = 'yes';
    // Inside the panel rather than under it: a loose warning between a panel
    // and the pack grid reads as a caption on the grid, which is not what it
    // is about.
    const warning = ownPacksNote();
    if (warning) el.appendChild(warning);
  }
  el.querySelector('#impGo').addEventListener('click', () => runImport(el));
  el.querySelector('#impUrl').addEventListener('keydown', (e) => { if (e.key === 'Enter') runImport(el); });
  fitCardSize(el);
  return el;
}

/**
 * Size the card from the list you just pasted.
 *
 * A round of 42 is a 5x5 round, and pasting one into a box that always said
 * 4x4 quietly made it a 4x4 — sixteen squares out of forty-two songs, so a
 * line lands early and most of the round never reaches anybody's card. It was
 * a dropdown you had to know to change, defaulting to the wrong answer for the
 * list in front of it.
 *
 * So it moves itself to the biggest card the list will carry, and says what it
 * did. Biggest rather than smallest because more squares is a longer game, and
 * a list of that size was written for a longer game.
 *
 * It stops adjusting the moment you touch the dropdown yourself. A control
 * that overrules you is worse than one that never helped.
 */
function fitCardSize(panel) {
  const text = panel.querySelector('#impText');
  const select = panel.querySelector('#impSize');
  const note = panel.querySelector('#impFit');
  // Straight from minimumTracks() on the server, so this cannot drift from the
  // rule the import will actually apply.
  const sizes = (library && library.cardSizes) || [];
  if (!sizes.length) return;

  let yours = false;
  select.addEventListener('change', () => { yours = true; note.textContent = ''; });

  const paint = () => {
    const count = text.value.split('\n').filter((l) => l.trim()).length;
    if (!count) { note.textContent = ''; return; }

    const fits = sizes.filter((s) => count >= s.minimum);
    if (!fits.length) {
      const smallest = sizes[0];
      note.innerHTML = `<b>${count} tracks — too few.</b> The smallest card (${smallest.size}×${smallest.size}) needs ${smallest.minimum}.`;
      return;
    }
    const best = fits[fits.length - 1];
    if (!yours) select.value = String(best.size);
    const named = fits.map((s) => `${s.size}×${s.size}`);
    const listed = named.length === 1 ? named[0] : `${named.slice(0, -1).join(', ')} or ${named[named.length - 1]}`;
    note.textContent = yours
      ? `${count} tracks — ${listed} would work.`
      : `${count} tracks, so a ${best.size}×${best.size} card. Change it if you would rather.`;
  };

  text.addEventListener('input', paint);
  // Pasting fires input on every browser worth worrying about, but a paste
  // handler runs before the value lands, so this one waits a tick.
  text.addEventListener('paste', () => setTimeout(paint, 0));
  paint();
}

async function runImport(panel) {
  const playlistUrl = panel.querySelector('#impUrl').value.trim();
  const text = panel.querySelector('#impText').value.trim();
  const status = panel.querySelector('#impStatus');
  const button = panel.querySelector('#impGo');

  if (!playlistUrl && !text) {
    status.textContent = 'Paste a playlist link, or a track list.';
    return;
  }

  button.disabled = true;
  button.textContent = 'Importing…';
  lastDone = null; // a new job supersedes the last one's banner
  status.innerHTML = '<div class="gen-log"></div>';
  const logEl = status.querySelector('.gen-log');
  const say = (line) => {
    logEl.appendChild(node(`<div>${esc(line)}</div>`));
    logEl.scrollTop = logEl.scrollHeight;
  };

  const own = panel.dataset.own === 'yes';
  try {
    const { done, error } = await streamGeneration(own ? '/api/mine/import' : '/api/import/bingo', {
      playlistUrl,
      text,
      title: panel.querySelector('#impTitle').value.trim(),
      cardSize: Number(panel.querySelector('#impSize').value),
      avoidMonths: panel.querySelector('#impAvoid')?.checked ? 3 : 0,
    }, say);

    if (error) {
      status.appendChild(node(`<div class="gen-bad">${esc(error)}</div>`));
      button.disabled = false;
      button.textContent = 'Import';
      return;
    }

    // Said here AND in the banner: here while you are still looking at the
    // panel, and in the banner because load() below rebuilds this panel and
    // would otherwise take the only word you got with it.
    const said = `Imported <b>${esc(done.title)}</b> — ${done.trackCount} tracks.
      ${done.backedUp ? 'Backed up — this one is permanent.' : '<b>Not backed up</b>, so it will be lost when the app restarts.'}
      ${done.mine ? 'It is yours: nobody else can read it.' : historyLine(done)}`;
    status.appendChild(node(`<div class="gen-good">${said}</div>`));
    button.textContent = 'Imported';
    // Amber rather than green when something in it is a warning. A green box
    // you have to read to the end to discover a problem is a box you stop
    // reading to the end of.
    showDone(done.backedUp && done.historyBackedUp ? 'good' : 'warn', said);
    await load();
  } catch (err) {
    status.appendChild(node(`<div class="gen-bad">${esc(err.message)}</div>`));
    button.disabled = false;
    button.textContent = 'Import';
  }
}

/**
 * The one button.
 *
 * Type a theme, press go: Claude picks the songs while avoiding anything you
 * have played recently, Spotify gets a playlist your DJ app can open, and the
 * bingo pack lands in your library ready to launch.
 */
function generatePanel(gen) {
  const el = node(`
    <div class="panel generate">
      <h3>New bingo game</h3>
      <div class="gen-row">
        <input type="text" id="theme" placeholder="A theme — 1990s indie, Motown, Christmas number ones…" autocomplete="off">
        <button class="role-make" id="genGo" ${gen.claude ? '' : 'disabled'}>Build it</button>
      </div>
      <div class="gen-opts">
        <label>Tracks <input type="number" id="genCount" value="40" min="16" max="90" style="width:64px"></label>
        <label>Card <select id="genSize"><option value="3">3×3</option><option value="4" selected>4×4</option><option value="5">5×5</option></select></label>
        <label>No repeats for
          <select id="genMonths">
            <option value="0">no limit</option>
            <option value="1">1 month</option>
            <option value="2">2 months</option>
            <option value="3" selected>3 months</option>
            <option value="6">6 months</option>
            <option value="12">a year</option>
          </select>
        </label>
        <span class="tiny" id="histLine"></span>
      </div>
      <div class="gen-status" id="genStatus"></div>
      ${gen.claude ? '' : '<div class="tiny warn">Set ANTHROPIC_API_KEY to build track lists.</div>'}
      ${gen.claude && !gen.spotify ? `<div class="tiny warn">No Spotify playlist will be made — missing ${esc((gen.spotifyMissing || []).join(', '))}. See DEPLOY.md.</div>` : ''}
    </div>`);

  const hist = el.querySelector('#histLine');
  if (hist) {
    hist.innerHTML = gen.recentCount
      ? `<a href="${linkTo('/api/history')}" target="_blank" rel="noopener">${gen.recentCount} tracks currently blocked</a>`
      : 'Nothing played recently';
  }

  el.querySelector('#genGo')?.addEventListener('click', () => generate(el));
  el.querySelector('#theme')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') generate(el);
  });
  return el;
}

async function generate(panel) {
  const theme = panel.querySelector('#theme').value.trim();
  const status = panel.querySelector('#genStatus');
  const button = panel.querySelector('#genGo');
  if (!theme) {
    status.textContent = 'Give it a theme first.';
    return;
  }

  button.disabled = true;
  button.textContent = 'Building…';
  lastDone = null; // a new job supersedes the last one's banner
  status.innerHTML = '<div class="gen-log"></div>';
  const logEl = status.querySelector('.gen-log');
  const say = (line) => {
    logEl.appendChild(node(`<div>${esc(line)}</div>`));
    logEl.scrollTop = logEl.scrollHeight;
  };

  try {
    const res = await fetch(keyed('/api/generate/bingo'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Host-Key': hostKey },
      body: JSON.stringify({
        theme,
        trackCount: Number(panel.querySelector('#genCount').value),
        cardSize: Number(panel.querySelector('#genSize').value),
        avoidMonths: Number(panel.querySelector('#genMonths').value),
      }),
    });

    // Progress arrives a line at a time while it works.
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let done = null;
    let failed = null;

    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) break;
      buffer += decoder.decode(chunk.value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop();
      for (const line of lines) {
        if (!line || line === 'PING') continue;   // keep-alive, nothing to show
        if (line.startsWith('DONE ')) done = JSON.parse(line.slice(5));
        else if (line.startsWith('ERROR ')) failed = line.slice(6);
        else say(line);
      }
    }

    if (!done && !failed) {
      failed = 'The connection dropped before it finished. It may still have completed — reload and look at your packs before running it again.';
    }
    if (failed) {
      say('');
      status.appendChild(node(`<div class="gen-bad">${esc(failed)}</div>`));
      button.disabled = false;
      button.textContent = 'Build it';
      return;
    }

    const said = `
        Built <b>${esc(done.title)}</b> — ${done.trackCount} tracks.
        ${done.playlist
          ? `<a href="${esc(done.playlist)}" target="_blank" rel="noopener">Open the Spotify playlist</a>`
          : done.playlistError
            ? `<br><b>No Spotify playlist:</b> ${esc(done.playlistError)}<br>The pack itself is fine — build the playlist by hand from the call sheet.`
            : 'No Spotify playlist — build one yourself from the call sheet.'}
        ${done.backedUp ? '<br>Backed up to GitHub — this one is permanent.' : '<br><b>Not backed up</b> — this will be lost when the app restarts.'}
        ${historyLine(done)}`;
    status.appendChild(node(`<div class="gen-good">${said}</div>`));
    showDone(done.backedUp && done.historyBackedUp ? 'good' : 'warn', said);
    button.textContent = 'Built';
    await load(); // refresh the library so the new pack is there to launch
  } catch (err) {
    status.appendChild(node(`<div class="gen-bad">${esc(err.message)}</div>`));
    button.disabled = false;
    button.textContent = 'Build it';
  }
}

/**
 * What is on the projector right now, and the two things you might want to do
 * about it: drive it, or stop it.
 *
 * "Control view" used to be a small grey link between "Big screen" and "Stop",
 * which reads as a footnote rather than as the way you run the night. It is the
 * one button on this panel that does the actual job, so it looks like it —
 * everything else on the panel is a link or a warning.
 *
 * The line underneath says where the game has got to, from the engine itself,
 * because "a quiz is running" and "they are twelve seconds into round 2
 * question 4" are very different things to walk in on.
 */

/**
 * TONIGHT — the launch section, at the top of every tab.
 *
 * **It was called "Quick launch", which said how FAST it is rather than what
 * it is for**, and it behaved that way: two shortcut buttons that took no
 * settings, with the look, the card shape and the venue living somewhere else
 * entirely — on a pack card, in a grid, further down whichever tab you
 * happened to be on. So the fast path and the fully-featured path were two
 * different controls in two different places, and you had to know which one
 * you were in.
 *
 * The host's own framing, and it is the whole brief: *"the second he gets to
 * his console it should be very obvious that the top of every page is a launch
 * section — wherever he is, he can launch from there, and it needs to be fully
 * featured. Sometimes you just don't want to think, you want to get in and go
 * and know it will work."*
 *
 * So: one section, one name, everything a night needs.
 *
 *  - **Tonight's pack is already chosen** — the same pick the two shortcut
 *    buttons used to offer, in a box you can type over. Nothing to find.
 *  - **Tonight's venue is already chosen**, and is printed at the top, so what
 *    the night will be filed as and play for is visible before the press
 *    rather than at the final scores.
 *  - **Set it up** opens the rest — look, card shape, prizes, teams, online.
 *    Shut by default, because a dropdown on the panic control defeats the
 *    panic control; one tap away, because "it is somewhere else" is what was
 *    wrong before.
 *
 * ONE gradient button on the section, which is the GUI rule: there were two
 * shortcut cards and a pack card's Launch, all of them the account's own
 * gradient, on one screen.
 *
 * **It carries the launch SETTINGS rather than skipping them**, and that is
 * the whole design problem it had to solve. A launch is not one button: a quiz
 * takes a look, and a bingo game takes a look, a card shape and how many
 * prizes — and the card shape is explicitly a decision about tonight rather
 * than a property of the pack. A big Launch that quietly used the pack's own
 * defaults would be wrong for every bingo night. So the controls appear IN the
 * bar for whichever pack is chosen, which is one copy in one place rather than
 * a second set living somewhere else.
 *
 * Launching itself goes through `doLaunch()`, the same function the pack cards
 * call, so the guard against launching over somebody's live game cannot be
 * fixed in one place and left rotting in the other.
 */
/*
 * Remembered OUTSIDE the render, both of them, because this panel is rebuilt
 * on every state push — which during a lobby is every time a phone joins. A
 * pack chosen inside the function, or a Set it up opened inside it, would be
 * thrown away by the next person to type their team name.
 */
let lbOpen = false;
let currentPack = null;

/*
 * IS THE WHOLE SECTION OPEN, and it is remembered on the DEVICE rather than in
 * a variable.
 *
 * The host's own sequence, and it is the reason this is not just a toggle:
 * *"I get to the venue, the launch thing is right there. I don't need it yet —
 * the venue wants me to change the prizes, so I collapse it, go to the Venues
 * tab and do my thing. Then when I am ready to launch I open it again."* So
 * the state has to survive changing TAB, which re-renders the whole page, and
 * it has to survive coming back to the console later.
 *
 * `localStorage` for the same reason the compact pack grid uses it: this is a
 * preference about how somebody works, not about this visit. Open is the
 * default, because the section exists to be the first thing you see.
 */
const TONIGHT_STORE = 'musicquiz.tonightopen';
let tonightOpen = localStorage.getItem(TONIGHT_STORE) !== '0';

/*
 * WHICH VENUE, once somebody has said.
 *
 * `null` means "nobody has chosen", which is not the same as "nowhere" — it is
 * what lets the app keep offering tonight's own answer (`tonightsVenue()`)
 * while a pick, once made, sticks through every re-render. It is deliberately
 * NOT remembered on the device like the fold state: the venue is a fact about
 * one evening, and a remembered one would file next Tuesday's night under last
 * Thursday's pub.
 */
let lbVenue = null;
let lbVenueOpen = false;

/*
 * IN THE ROOM, OR ONLINE — up in the head, beside the venue.
 *
 * It was a dropdown behind Set it up, filed with the look and the card shape,
 * and it is not the same kind of decision as those. Getting the look wrong
 * costs a night some colours; getting THIS wrong sends the question to sixty
 * phones in a pub, which breaks rule 8 in front of a paying room and cannot be
 * undone mid-question. A setting whose wrong value ruins the night belongs
 * where it is READ, not where it is hunted for.
 *
 * A two-state switch rather than a `<select>`, and that is the app's own shape
 * for "is this on" — the hat in the top right and every feature row use it, so
 * it is recognised rather than read. It is also the one control here with
 * exactly two answers; a dropdown for two answers hides one of them.
 *
 * NOT remembered on the device, the same reasoning as the venue: online is a
 * fact about one evening, and a remembered one would put a pub's question on
 * sixty phones because of a Zoom quiz three weeks ago. Off is the default and
 * off is almost every night.
 */
let lbOnline = false;

/*
 * The pack being dragged, if any. Module level because a drag crosses two
 * elements and `dataTransfer` cannot be read during `dragover` — the one
 * moment the bar needs to know whether what is over it is a pack.
 */
let packDrag = null;

/**
 * THE EXTRA PACKS IN TONIGHT — pack ids beyond the first, or an empty list.
 *
 * The night is `currentPack` followed by these. Holding only the EXTRAS is
 * what keeps an ordinary night ordinary: one pack means this is empty, which
 * means `doLaunch` sends no running order at all and the server takes exactly
 * the route it took last week. A composed night only exists once somebody has
 * deliberately dropped a second pack in.
 *
 * Pack IDS and nothing else — no titles, no rounds, no questions. What gets
 * played is read off the packs on disk at launch, so a question corrected at
 * nine o'clock is in the night that starts at nine fifteen. Copying rounds in
 * here would be the one thing rule 11 exists to prevent: a second copy, in a
 * browser tab, going quietly stale.
 */
let lbExtra = [];

/**
 * ROUNDS SWITCHED OFF — a Set of `packId:roundIndex`.
 *
 * The host's own design, and it replaced dragging rounds between packs:
 * *"have the rounds in the quiz pack with a green tick each, and to turn one
 * off you click the green tick and it turns into a cross — removes the need
 * to drag and drop sections of a quiz pack."*
 *
 * He is right, and the reason is bigger than tidiness. **A round-level drag is
 * a laptop-only gesture**: HTML5 drag events are never delivered on touch, so
 * that half of the feature did not exist on a phone at all — and this file's
 * own rule has the console measured at 320px. A tick is a tap, so the same
 * job now works on both, with no second way of doing it to keep in step.
 *
 * Keyed by pack AND index rather than by round title: two packs can have a
 * round called "Round one", and a title is a thing somebody renames.
 */
let lbOff = new Set();

/** Which round chip is being dragged within the strip, if any. */
let roundDrag = null;

/**
 * How many rounds one night may be built from.
 *
 * **The SERVER is the authority** — `MAX_ROUNDS` in `src/running-order.js`,
 * which refuses anything longer whatever this page thinks. This copy exists
 * only so the strip can say no before somebody drags a fourth pack in and
 * finds out at Launch, in a venue. A test asserts the two agree, because a
 * limit stated in two places is a limit that disagrees with itself within a
 * month — the same reason `plans.js` and `looks.js` are shared rather than
 * copied. They cannot be shared here: `running-order.js` imports the quiz
 * validator, which is server-only.
 */
const MAX_NIGHT_ROUNDS = 12;
/** True while the CHOSEN pack is being dragged out of the section. */
let offDrag = false;

/**
 * A VENUE being dragged up to Tonight, from the Venues tab.
 *
 * Same gesture as a pack and the same target, because they are the two facts
 * that place a night: which room, and what is being played in it. The venue
 * picker in the head stays exactly as it was — drag is the mouse's way and
 * that is the thumb's, and HTML5 drag events do not fire on touch at all.
 *
 * ADVERTS ARE DELIBERATELY NOT DRAGGABLE. Slides belong to a VENUE by design
 * (`src/adverts.js` — *"your Tuesday pizza deal goes up between every round,
 * every week"*), so dropping the venue in brings its adverts with it and
 * there is nothing left to drag. And a slide is chosen LIVE on the control
 * view between rounds, not at launch, so there is no "tonight's advert" to
 * drop into without inventing one. What was actually awkward — the picker
 * offering every venue's slides mid-gig — is fixed where it happens, in
 * `host.js`, by putting tonight's venue first.
 */
let venueDrag = null;

/**
 * TONIGHT GOES STICKY WHILE SOMETHING IS BEING DRAGGED.
 *
 * The section lives at the top of the tab and a venue card can be most of a
 * page below it. HTML5 drag has no dependable auto-scroll, so without this the
 * gesture is "pick the card up, discover the target is off-screen, give up" —
 * which on a trackpad is worse again. Pinned to the top for the length of the
 * drag, the target is always where the cursor can reach it.
 */
function dragging(on) {
  if (on) pinTonightWhereItIs();
  document.body.classList.toggle('is-dragging-card', Boolean(on));
}

/**
 * AND IT PINS WHERE IT ALREADY IS, RATHER THAN JUMPING TO THE TOP.
 *
 * Reported from a real console with a screenshot either side of the gesture:
 * *"still acting weird when you grab a pack"* — the whole Tonight panel moved
 * about ninety pixels down the instant a card was picked up.
 *
 * The cause is what the pinning is for. Going sticky at `--topbar-h` only
 * moves an element that has ALREADY scrolled past that line — and it always
 * has, because you scroll DOWN to reach the library you are dragging from. So
 * the fix for "the target is off-screen" created "the target moves the moment
 * you aim at it", which is worse: the drop tiles slide out from under the
 * cursor at the one moment the cursor is committed to them.
 *
 * **A sticky top can be NEGATIVE, which is the whole trick.** Pinning at the
 * panel's current offset freezes it exactly where the eye last saw it — it
 * still cannot scroll away for the rest of the drag, which is all the pinning
 * was ever for, and it does not move a pixel to do it.
 *
 * Three cases and all of them fall out of one clamp:
 *
 *  - **partly scrolled under the topbar** (the common one): pin at the current
 *    offset, so nothing moves;
 *  - **fully below the topbar**: `--topbar-h` is already the smaller number, so
 *    it pins there and does not move either — sticky does nothing until you
 *    scroll;
 *  - **scrolled so far up that the drop tiles are gone**: pinning where it is
 *    would leave nothing to aim at, so it comes down just far enough to put the
 *    tiles under the topbar. That is the one case where moving is the point,
 *    and it is the case the original rule was written for.
 *
 * Measured rather than assumed, because the topbar WRAPS on a phone — a written
 * out number is a panel pinned behind the logo at 390px.
 */
function pinTonightWhereItIs() {
  const bar = document.querySelector('.launchbar');
  if (!bar) return;
  const topbar = document.querySelector('.topbar');
  const topbarH = topbar ? topbar.getBoundingClientRect().height : 56;
  const barTop = bar.getBoundingClientRect().top;

  /*
   * The drop tiles are the thing that has to stay reachable; the venue row and
   * the describer line above them are worth losing to keep them.
   *
   * **ENOUGH OF THE ROW, NOT ALL OF IT** — and the first version asked for all
   * of it, which measured as a 13px shift at 1280 and 33px at 390. Insisting
   * the tiles be fully clear of the topbar makes the safe zone narrower than
   * the scroll somebody actually does to reach their library, so the panel
   * still twitched on the common gesture. A tile is 76px tall and 44 of them
   * is a target nobody misses, so the top of the row is allowed to slide under
   * the bar and the panel holds still across the whole range that matters.
   */
  const tiles = bar.querySelector('.lb-tiles');
  let floor = topbarH;
  if (tiles) {
    const box = tiles.getBoundingClientRect();
    // Never more than the row is tall — on a phone a tile is 58px, and an
    // allowance bigger than the thing it is measuring would let the whole row
    // disappear.
    const mayHide = Math.max(0, box.height - Math.min(KEEP_OF_DROP_ROW, box.height));
    floor = topbarH - (box.top - barTop) - mayHide;
  }

  bar.style.setProperty('--lb-pin', `${Math.max(Math.min(barTop, topbarH), floor)}px`);
}

/** How much of the drop row has to stay under the topbar — see above. */
const KEEP_OF_DROP_ROW = 44;

/*
 * A DRAG THAT ENDS ANYWHERE AT ALL UN-PINS TONIGHT.
 *
 * `dragging(false)` is called by each drop handler, which is right when a drop
 * lands somewhere we own — and does nothing for a drag abandoned over the
 * page, dropped on the browser chrome, or cancelled with Escape. The panel
 * then stayed pinned and overlapping the page underneath it, which is half of
 * what the post-drag screenshot showed.
 *
 * `dragend` always fires on the source, whatever happened to the drop, so it
 * is the one event that can promise this. Once, on the window, rather than per
 * card: the cards are rebuilt on every render and a listener each would be a
 * new one every time anybody joined.
 */
window.addEventListener('dragend', () => {
  dragging(false);
  packDrag = null;
  venueDrag = null;
});

function launchBar() {
  // An owner runs no nights, so there is nothing here for them — same reason
  // the running panel hides itself.
  if (!can(FEATURES.QUIZ) && !can(FEATURES.BINGO)) return node('<div></div>');

  // Only the games this account can actually run, so the dropdown never offers
  // something that would be refused. It is a dropdown rather than two boxes
  // because a third game is a matter of time — see LAUNCHERS in session.js.
  const games = TABS
    .filter((t) => t.packs && t.needs && can(t.needs))
    .map((t) => ({ id: t.id, label: t.label, packs: (t.packs() || []).filter((p) => !p.locked && !p.broken) }))
    .filter((g) => g.packs.length);
  if (!games.length) return node('<div></div>');

  const el = node(`
    <div class="panel launchbar">
      <div class="lb-head">
        <!-- WHERE, at the top, because it decides the prizes, the voucher and
             what the night is filed under — and it used to be visible only on
             a button label. -->
        <!-- ONE CELL, both facts. They are two spans in a single grid child
             rather than two children, or the grid has four items in three
             columns the moment the shut line appears and the way back in
             drops onto a row of its own. -->
        <div class="lb-what">
          <!-- THE VENUE IS THE CONTROL, not a caption. It decides the prizes,
               the voucher and what the night is filed under, so it belongs at
               the top where it is read — and it has to be changeable there,
               because covering somebody else's night is a thirty-second job
               that used to mean opening Set it up and hunting a dropdown. -->
          <button class="lb-where" type="button" aria-expanded="false"></button>
          <!-- SHUT, IT IS STILL A SENTENCE. A collapsed panel that says only
               "Tonight" makes you open it to find out what it is set to,
               which is the tap this is meant to save. -->
          <span class="tiny lb-shut-what" hidden></span>
        </div>
        <!-- WHERE THEY ARE, beside the fold rather than on a row of its own.
             Two pills at the right-hand end: what kind of night it is, and
             whether the panel is open. Moved there on the host's own reading
             — on its own line it was a third row in a bar that is meant to be
             glanceable, and it is one of the two facts that place a night, so
             it belongs beside the other one rather than under it.
             "Venue" rather than "In the room": the word matches the control
             directly to its left, which names the venue, so the pair reads as
             one question with two answers. -->
        <div class="lb-right">
          <div class="lb-mode">
            <span class="hat-switch lb-mode-switch" data-on="0">
              <button class="hat-half live" type="button" data-online="0">Venue</button>
              <button class="hat-half" type="button" data-online="1">Online</button>
            </span>
          </div>
          <button class="lb-fold" type="button" aria-expanded="true">
            <span class="lb-fold-word"></span>
          </button>
        </div>
      </div>
      <!-- SEARCHABLE, because a quizmaster with fifteen residencies scrolling a
           dropdown in a dark pub is the thing this replaces. It draws from the
           Venues tab and from where you have actually played, and it keeps the
           way out for a pub that is not on either list — that is the promise a
           night's free-text venue was built on. -->
      <div class="lb-venues" hidden>
        <input class="lb-venue-search" type="search" autocomplete="off" placeholder="Search your venues…">
        <div class="lb-venue-list"></div>
        <div class="lb-venue-foot">
          <button class="minor lb-venue-other" type="button">Somewhere else…</button>
          <a class="minor lb-venue-add" href="?tab=venues">Add a venue</a>
        </div>
      </div>
      <!-- WHAT IS ACTUALLY ON THE PROJECTOR, which is a different question
           from what the box is set to. Reported from a real night: the two
           disagreed and nothing said which was which. -->
      <div class="tiny lb-live" hidden></div>
      <!-- THE PICKER IS BEHIND THE DROP ZONE NOW, not standing in front of it.
           The bar used to open with a game dropdown, a search box and a pack
           already chosen for you — three controls answering a question that
           dragging a pack up answers in one gesture. It is still here because
           HTML5 drag does not fire on touch AT ALL, so a drag-only bar is a
           dead panel on a phone: tapping the dotted cutout opens this. -->
      <div class="lb-find" hidden>
        ${games.length > 1 ? `<select class="lb-game">
          ${games.map((g) => `<option value="${esc(g.id)}">${esc(g.label)}</option>`).join('')}
        </select>` : ''}
        <div class="lb-search">
          <input class="lb-text" type="search" autocomplete="off" placeholder="Start typing a pack name…">
          <div class="lb-hits" hidden></div>
        </div>
      </div>
      <div class="tiny lb-why" hidden></div>
      <!-- THE TWO SMALL BUTTONS SHARE A ROW. Launch keeps the full width
           under them: it is the one "press this" on the section, and a
           primary button squeezed in beside two minor ones stops looking
           like one. -->
      <!--
           SET IT UP IS ALWAYS HERE, DISABLED UNTIL THERE IS A NIGHT TO SET UP.

           It used to be created hidden and unhidden by pick(), so dragging a
           pack in made a button appear out of nothing and everything below it
           jumped — reported as clunky, and it is the SAME FAULT as the one
           three comments down that Launch was already fixed for. A control
           that comes and goes is a control you cannot learn the position of,
           and this bar is driven with a thumb in a dark pub.

           NO BACKTICKS IN THIS COMMENT, and that is not a style note: it is
           inside the template literal this whole panel is built from, so one
           stray backtick ends the string early and the console does not load
           AT ALL. Which is how this very comment was written the first time.

           Disabled rather than working-with-nothing, because the panel behind
           it is genuinely about a pack: the card shape and the look are read
           off the one you chose. Launch directly underneath is the thing
           saying what the bar is waiting for, so this does not have to.
      -->
      <div class="lb-row">
        <div class="lb-alt" hidden></div>
        <button class="minor lb-more" type="button" aria-expanded="false" disabled>Set it up</button>
      </div>
      <!-- TONIGHT'S RUNNING ORDER — the place packs are dropped and where
           they appear, asked for in those words. Along the bottom rather than
           off to the right: this bar is already three stacked rows and a
           fourth column would make the one "press this" on the section share
           its line with a list. It sits directly ABOVE Launch because it is
           what Launch is about to run. -->
      <div class="lb-order" hidden></div>
      <div class="lb-chosen" hidden></div>
      <!-- LAUNCH IS ALWAYS HERE, hollow until there is something to launch.
           It used to be created and destroyed with the chosen pack, so the
           bar changed height the moment anything was dragged in or out and
           everything below it jumped — reported as clunky, and it is the same
           fault as a row that reflows under your hand. Hollow it also says
           what it is waiting for, which an absent button cannot. -->
      <button class="go lb-go" type="button" disabled>Drag a pack in to launch</button>
    </div>`);

  const gamePick = el.querySelector('.lb-game');
  const text = el.querySelector('.lb-text');
  const hits = el.querySelector('.lb-hits');
  const alt = el.querySelector('.lb-alt');
  const whyEl = el.querySelector('.lb-why');
  const where = el.querySelector('.lb-where');
  const venues = el.querySelector('.lb-venues');
  const venueList = el.querySelector('.lb-venue-list');
  const venueSearch = el.querySelector('.lb-venue-search');
  const liveEl = el.querySelector('.lb-live');
  // Called through an arrow rather than passed directly: both of these are
  // `const`s declared further down, so handing the function over here reads
  // them before they exist. By the time anybody clicks, they do.
  where.addEventListener('click', () => toggleVenues());
  venueSearch.addEventListener('input', () => paintVenueList());
  /*
   * SOMEWHERE ELSE, kept — a one-off venue must not need a record made for it
   * first, which is the promise the night's free-text venue was built on. It
   * asks rather than swapping in a box, because this picker is a sheet you are
   * already inside and a prompt is one tap where a fourth control is furniture.
   */
  el.querySelector('.lb-venue-other').addEventListener('click', () => {
    const typed = prompt('Where are you tonight?', venueNow() || '');
    if (typed === null) return;
    chooseVenue(typed.trim());
  });
  const fold = el.querySelector('.lb-fold');
  const moreBtn = el.querySelector('.lb-more');
  moreBtn.addEventListener('click', () => {
    lbOpen = !lbOpen;
    const set = el.querySelector('.lb-set');
    if (set) set.hidden = !lbOpen;
    moreBtn.setAttribute('aria-expanded', lbOpen ? 'true' : 'false');
  });
  const shutWhat = el.querySelector('.lb-shut-what');
  const modeRow = el.querySelector('.lb-mode');
  const modeSwitch = modeRow.querySelector('.lb-mode-switch');
  /*
   * ONLINE SAYS WHAT IT WILL DO; the room says nothing.
   *
   * The whole risk here is switching it on by accident and putting the
   * question on sixty phones in a pub, so the ON side states the consequence
   * in the words that matter — and the OFF side, which is almost every night,
   * stays silent rather than explaining the normal case back to somebody.
   */
  function paintMode() {
    modeSwitch.dataset.on = lbOnline ? '1' : '0';
    for (const half of modeSwitch.querySelectorAll('.hat-half')) {
      half.classList.toggle('live', (half.dataset.online === '1') === lbOnline);
    }
  }
  for (const half of modeSwitch.querySelectorAll('.hat-half')) {
    half.addEventListener('click', () => {
      const want = half.dataset.online === '1';
      if (want === lbOnline) return;
      lbOnline = want;
      paintMode();
      paintFold();
    });
  }
  const chosen = el.querySelector('.lb-chosen');
  const gameOf = () => games.find((g) => g.id === (gamePick ? gamePick.value : games[0].id)) || games[0];

  /*
   * TWO PACKS AND NO TYPING, for the quizmaster who is late.
   *
   * A search box does nothing until you type, and somebody walking in with the
   * room already sitting down does not want to type — they want to see the
   * thing and hit it. So the empty state of this panel is up to two packs
   * ready to go, and it disappears the moment you start typing, because at
   * that point you are browsing and they are in the way.
   *
   * A PRIORITY LIST RATHER THAN TWO FIXED SLOTS, and that is the bit that
   * matters: topical packs are what GOLD is, so a Bronze or Silver quizmaster
   * has none at all and a "this month's" slot would be permanently empty for
   * most of the ladder. Filling two slots from an order degrades on its own —
   * Gold gets the dated one and a fresh one, everybody else gets two fresh
   * ones, and nobody sees a gap where a feature they do not hold would be.
   *
   * NO SETTINGS ON THESE BUTTONS. Look, card shape and prizes are what the
   * pack card is for; a dropdown on the panic control defeats the panic
   * control. It launches on the pack's own defaults.
   */
  function quickPicks(packs) {
    const out = [];
    /*
     * 1. The dated one, soonest to expire — because it is the only pack on the
     *    shelf that is worth LESS tomorrow. An expired one is never offered
     *    here: a "week that just went past" quiz run three months late is the
     *    exact hazard `freshUntil` exists to flag, and doing it by accident on
     *    the fast path is the worst possible way to do it. It stays in the
     *    library with its warning, where launching it is a decision.
     */
    const dated = packs
      .filter((p) => { const f = freshness(p); return f.topical && !f.expired; })
      .sort((a, b) => freshness(a).until - freshness(b).until);
    if (dated[0]) out.push({ pack: dated[0], why: freshLabel(dated[0]) });

    /*
     * 2. The one this room is least likely to have heard — never played first,
     *    then longest ago. The app cannot know which venue tonight is (a night
     *    does not carry one yet), so "not played recently" is the closest
     *    honest answer to "will not be a repeat".
     */
    const rest = packs
      .filter((p) => !out.some((o) => o.pack.id === p.id))
      .filter((p) => !freshness(p).expired)
      .sort((a, b) => playedAt(a.lastPlayedAt) - playedAt(b.lastPlayedAt));
    for (const p of rest) {
      if (out.length >= 2) break;
      out.push({ pack: p, why: p.lastPlayedAt ? `Last played ${whenShort(p.lastPlayedAt)}` : 'Never played' });
    }
    return out;
  }

  /*
   * WHOSE NIGHT IT IS, said at the top of the section.
   *
   * `tonightsVenue()` is the same answer the venue picker inside the settings
   * starts on, from the same function — so the line at the top and the box
   * that decides it can never disagree. It says when there is NO answer as
   * well, because a night filed under nothing plays for no prizes and hands
   * out no vouchers, and an app that says nothing looks exactly like an app
   * that is working.
   */
  /** Where tonight is: what somebody chose, or the app's own best answer. */
  const venueNow = () => (lbVenue !== null ? lbVenue : ((tonightsVenue() || {}).name || ''));

  /*
   * WHAT THIS VENUE PUTS UP, under the picker and not inside Set it up.
   *
   * It moved with the venue it describes: a prize line three taps away from
   * the name it belongs to is a line nobody reads, and the whole reason it
   * exists is that the first real night ended with no voucher and nothing on
   * screen having said so.
   */

  const paintWhere = () => {
    const chosenName = lbVenue !== null ? lbVenue : '';
    if (chosenName) {
      // Somebody has said where they are, so the app stops explaining itself.
      where.textContent = chosenName;
      where.classList.remove('lb-warn');
      return;
    }
    if (lbVenue === '') {
      where.textContent = 'Nowhere in particular';
      where.classList.remove('lb-warn');
      return;
    }
    const v = tonightsVenue();
    if (v) {
      /*
       * THE NAME, WITHOUT THE REASON. It read "The Station Tap, Wokingham —
       * where you played last", which is the app explaining its own working
       * on the line somebody is trying to read a venue off. The reason
       * mattered when this was a guess you had to audit; it is a starting
       * point you change in one tap, and the tail made a long pub name longer
       * than the bar.
       */
      where.textContent = v.name;
      where.classList.remove('lb-warn');
      return;
    }
    /*
     * TWO ANSWERS FOR ONE NIGHT ARE SAID OUT LOUD, not left as a blank.
     *
     * Two venues can both claim tonight — two residencies on a Thursday, or
     * two dates typed into the diary — and there is nothing here that could
     * tell them apart, so nothing is chosen. That much is right. What was
     * wrong is that it looked identical to having no venues at all, on the one
     * field that decides the prizes, the voucher and what the night is filed
     * under. Naming both is what turns it into a decision somebody can make in
     * one tap.
     */
    const clash = clashTonight({
      venues: library.venueRecords || [],
      bookings: library.bookings || [],
    });
    where.classList.toggle('lb-warn', clash.length > 1);
    where.textContent = clash.length > 1
      ? `${clash.join(' and ')} both claim tonight — pick one`
      : 'No venue — pick one';
  };

  /*
   * THE PICKER. Venues you have SET UP and venues you have PLAYED, in one
   * list — a venue added on the Venues tab has hosted nothing yet, and one
   * played before venues existed was never added, so either list alone leaves
   * somebody hunting for a pub they know is there.
   */
  const paintVenueList = () => {
    const q = (venueSearch.value || '').trim().toLowerCase();
    const setUp = (library.venueRecords || []).map((v) => v.name);
    const played = library.venues || [];
    const seen = [];
    for (const name of [...setUp, ...played]) {
      const clean = String(name || '').trim();
      if (!clean || seen.some((n) => n.toLowerCase() === clean.toLowerCase())) continue;
      seen.push(clean);
    }
    const list = q ? seen.filter((n) => n.toLowerCase().includes(q)) : seen;
    venueList.replaceChildren(...(list.length ? list.map((name) => {
      const row = node(`<button class="lb-venue-hit" type="button">${esc(name)}</button>`);
      row.addEventListener('click', () => chooseVenue(name));
      return row;
    }) : [node(`<div class="tiny">${seen.length
      ? `Nothing matches “${esc(venueSearch.value.trim())}”.`
      : 'No venues yet — add one on the Venues tab.'}</div>`)]));
  };

  /*
   * CHANGING THE VENUE RE-RESOLVES A NIGHT THAT IS UP BUT EMPTY.
   *
   * The fault this closes was introduced the moment picking a pack started
   * launching it, and it is silent — which is what makes it worth the code.
   * The prizes, the voucher and the come-back slide are read off the venue AT
   * LAUNCH and copied into the game state, exactly like the look and the card
   * shape. So the sequence somebody would actually use — drag the pack in,
   * notice the venue is last week's, drag the right one in — launched the
   * night under the wrong pub and then left it there. The bar said The Dog &
   * Duck; the winner's phone would have shown the Sheep & Hound's voucher.
   *
   * Fixing it forwards rather than blocking the launch: relaunch quietly, so
   * the running night picks the venue's own prizes up. Safe for exactly the
   * same reason the auto-launch is — `switchIfFree` goes through the server's
   * ordinary guard, so the instant a single team has joined this does nothing
   * at all and the choice simply applies to the next launch.
   *
   * Only when the pack is unchanged and already up. If nothing is running
   * there is nothing to re-resolve, and Launch will read the new venue anyway.
   */
  function chooseVenue(name) {
    lbVenue = String(name || '');
    lbVenueOpen = false;
    venues.hidden = true;
    where.setAttribute('aria-expanded', 'false');
    paintWhere();
    const running = (library && library.running) || {};
    if (currentPack && running.packId === currentPack.id) {
      switchIfFree(currentPack, gameOf().id);
    }
  }

  const toggleVenues = () => {
    lbVenueOpen = !lbVenueOpen;
    venues.hidden = !lbVenueOpen;
    where.setAttribute('aria-expanded', lbVenueOpen ? 'true' : 'false');
    if (lbVenueOpen) { paintVenueList(); venueSearch.focus(); }
  };

  /*
   * THE OTHER PACK WORTH OFFERING, as a chip rather than a second big button.
   *
   * There used to be two shortcut cards, both wearing the account's gradient,
   * which is two "press this" buttons on one screen — and the second one was
   * never the one you wanted more than half the time. The first pick is
   * already in the box; this is the runner-up, one tap away, and it looks like
   * what it is.
   */
  const paintAlt = () => {
    /*
     * "Typing" cannot be "the box has something in it" any more — the box
     * ARRIVES holding tonight's pack. It means the box no longer says what is
     * chosen, which is the moment somebody is browsing and a suggestion is in
     * the way.
     */
    const typed = text.value.trim();
    const browsing = Boolean(typed) && typed !== (currentPack && currentPack.title);
    const picks = quickPicks(gameOf().packs);
    const second = picks[1];
    const showing = !browsing && second && second.pack.id !== (currentPack && currentPack.id);
    alt.hidden = !showing;
    alt.replaceChildren(...(showing ? [(() => {
      const chip = node(`<button class="minor lb-alt-go" type="button">or ${esc(second.pack.title)}</button>`);
      chip.addEventListener('click', () => pick(second.pack));
      return chip;
    })()] : []));
  };

  /*
   * Matches on the TITLE only, unlike the pack-tab search which looks inside
   * the questions. Different job: that one is "find me a pack with Madonna in
   * it", this one is "I know what it is called, get me there". Searching the
   * contents here would put four packs under "198" because one of them has a
   * question about 1984.
   */
  const paintHits = () => {
    const q = text.value.trim().toLowerCase();
    const list = q ? gameOf().packs.filter((p) => (p.title || '').toLowerCase().includes(q)).slice(0, 6) : [];
    hits.hidden = !list.length;
    hits.replaceChildren(...list.map((p) => {
      const row = node(`<button class="lb-hit" type="button">${esc(p.title)}</button>`);
      row.addEventListener('click', () => pick(p));
      return row;
    }));
  };

  /*
   * WHICH PACK IS CHOSEN, remembered outside the render.
   *
   * Module-level for the same reason `openPack` is: this panel is rebuilt on
   * every state push, and a choice stored inside the function would be thrown
   * away the moment a phone joined.
   */
  /*
   * PICKING A PACK PUTS IT ON THE BIG SCREEN — when nothing would be lost.
   *
   * The host's own complaint, from a real night: *"the quiz in the launch bit
   * after I pressed launch didn't say what the big screen said"*, and then the
   * conclusion — *"changing quiz packs should change the console and the big
   * screen."* He is right that the two disagreeing is the fault. The console
   * and the projector should agree every time it is possible for them to.
   *
   * **BUT PICKING IS NOT LAUNCHING WHEN THERE IS A NIGHT TO LOSE.** A tap on
   * a search result that silently ends a running quiz and wipes every score
   * would be the most dangerous control in the app, on the protected path, in
   * a dark pub. So the rule is: switch instantly when it costs nothing, stage
   * it when it would cost somebody their night.
   *
   * **THE SERVER DECIDES WHICH, NOT THIS PAGE.** It is the ordinary launch
   * call without `replace` — which already answers 409 when a night is in
   * progress, with the game and the player count in it, and that guard is the
   * one this codebase has already learned cannot live in the browser. So
   * there is no new rule here and no second definition of "in progress" to
   * drift: a 200 means it was free to switch, a 409 means it was not.
   *
   * **A 409 is SILENT here** — no dialog. Pressing Launch is what asks that
   * question, and it still does, with the same warning it always gave. All a
   * 409 means at this point is that the choice stays staged and the red line
   * under the box tells you the projector is showing something else, which is
   * exactly the state that line exists for.
   *
   * Nothing is set up on a quiet switch — no look, no card shape, no prizes,
   * no venue. It is the pack going up on an idle projector, and everything
   * else is what Set it up and Launch are for.
   */
  async function switchIfFree(pack, kind) {
    try {
      await postJson('/api/host/launch',
        { game: kind, packId: pack.id, venue: venueNow(), online: lbOnline },
        { 'X-Host-Key': hostKey });
      /*
       * It went up. Ask the SERVER what is running rather than assuming it
       * worked — the line under this box exists precisely because the console
       * and the projector can disagree, so filling it in from our own
       * optimism would be the original fault wearing a new hat.
       */
      const res = await fetch(keyed('/api/library'));
      if (res.ok) library = await res.json();
      paintLive();
    } catch {
      // 409 (a night is running) or anything else: the choice stays staged and
      // paintLive says so. Never a dialog — Launch is where that is asked.
      paintLive();
    }
  }

  function pick(pack, { quiet = false } = {}) {
    const switching = !quiet && currentPack?.id !== pack.id;
    /*
     * CHOOSING A DIFFERENT PACK STARTS THE NIGHT AGAIN.
     *
     * Picking one out of the box or dropping it on the bar is somebody saying
     * "we are playing THIS" — so a running order built round the last pack has
     * to go, or you would launch a night whose name says one thing and whose
     * rounds are mostly another. Adding to an order is the strip's job and it
     * is a different gesture, which is the whole reason the two are split.
     */
    if (currentPack && currentPack.id !== pack.id) { lbExtra = []; lbOff = new Set(); }
    currentPack = pack;
    text.value = pack.title;
    /*
     * WHY THIS ONE, kept from the shortcut buttons it replaces. "Never played"
     * and "Last played in March" are what make an offered pack trustworthy —
     * without it the box just asserts a title and you have to go and check
     * whether the room heard it a fortnight ago.
     */
    if (liveEl) paintLive();
    const why = (quickPicks(gameOf().packs).find((q) => q.pack.id === pack.id) || {}).why
      || (pack.lastPlayedAt ? `Last played ${whenShort(pack.lastPlayedAt)}` : 'Never played');
    whyEl.textContent = why;
    hits.hidden = true;
    const kind = gameOf().id;
    const bingo = kind === 'bingo';
    chosen.hidden = false;
    // ONE root element. `node()` returns the first child, so a template with a
    // sibling after it silently loses the sibling — which here was the Launch
    // button, the only thing on the panel that does anything.
    chosen.replaceChildren(node(`
      <div>
      <div class="lb-set" ${lbOpen ? '' : 'hidden'}>
        ${bingo ? `
          <label class="pack-shape">Card
            <select class="shape-pick">${shapeOptions(pack)}</select>
          </label>
          <label class="pack-shape">Prizes
            <select class="prize-pick"></select>
          </label>` : ''}
        <label class="pack-shape">Look
          <select class="look-pick">${lookOptions(pack)}</select>
        </label>
        <!-- WHILE THEY WAIT. A decision about TONIGHT, so it sits with the
             look and the card shape rather than being an account setting: a
             quiz night and a bingo night want different games, which is the
             whole reason the default follows the game type. The ones above
             this tier are SHOWN AND LOCKED rather than missing — somebody who
             cannot have a game should still know it exists, and on this ladder
             the locked ones are the argument for moving up. -->
        <label class="pack-shape">While they wait
          <select class="game-pick">${lobbyGameOptions(bingo ? 'bingo' : 'quiz')}</select>
        </label>
        <!-- WHETHER THE PHONES MAY MAKE A NOISE. On by default: the game only
             exists in the lobby, so it cannot interrupt a question — and a
             garnish behind a toggle nobody finds is a garnish nobody hears.
             It is here because a quiet gastropub and a rowdy Friday are not
             the same room, which makes it a decision about TONIGHT. -->
        <label class="pack-shape">Game sound
          <select class="sound-pick">
            <option value="on">On</option>
            <option value="off">Off</option>
          </select>
        </label>
        <!-- WHERE IS NOT IN HERE ANY MORE. It is the switch up in the head,
             beside the venue, and it is deliberately not in two places: two
             controls for one field is how a night gets launched with the
             setting the other one was showing. Same reasoning that took the
             venue picker out of here. -->
        <label class="pack-shape">Playing
          <select class="play-pick">${playingOptions()}</select>
        </label>
      </div>
      </div>`));

    /*
     * SET IT UP is shut by default and REMEMBERED once opened.
     *
     * Shut, because the common job is "this pack, this pub, go" and a wall of
     * dropdowns in front of it is the panic control defeating itself. Open, it
     * stays open — a quizmaster setting up a bingo night touches three of
     * these in a row, and this panel is rebuilt every time somebody joins.
     */
    // The toggle lives in the row above and outlives this render; only the
    // panel it opens is rebuilt here, so it is re-pointed rather than rewired.
    // It is never hidden — see the comment on `.lb-row` — only switched on.
    moreBtn.disabled = false;
    moreBtn.setAttribute('aria-expanded', lbOpen ? 'true' : 'false');

    // The same prize list the pack card builds, from the shape actually picked.
    const shapePick = chosen.querySelector('.shape-pick');
    const prizePick = chosen.querySelector('.prize-pick');
    const paintPrizes = () => {
      if (!shapePick || !prizePick) return;
      const want = JSON.parse(shapePick.value);
      const found = ((library && library.cardShapes) || [])
        .find((sh) => sh.rows === want.rows && sh.cols === want.cols);
      if (!found) return;
      prizePick.innerHTML = found.plans
        .map((plan, i) => `<option value="${i + 1}">${i + 1} — ${esc(plan.join(', then '))}</option>`).join('');
    };
    shapePick?.addEventListener('change', paintPrizes);
    paintPrizes();

    goBtn.onclick = async (ev) => {
      const button = ev.currentTarget;
      await doLaunch(kind, pack.id, {
        shape: shapePick ? JSON.parse(shapePick.value) : null,
        prizes: Number(prizePick?.value) || 0,
        look: chosen.querySelector('.look-pick')?.value || '',
        lobbyGame: chosen.querySelector('.game-pick')?.value || '',
        lobbySound: chosen.querySelector('.sound-pick')?.value !== 'off',
        // ONE source for whether tonight is online — the switch in the head,
        // which is the only place it can be set now.
        online: lbOnline,
        teamPlay: chosen.querySelector('.play-pick')?.value === 'teams',
        // ONE source for where tonight is — the picker at the top, which is
        // the only place it can be set now. Two controls for one field is how
        // a night gets filed under the pub you were at last week.
        venue: venueNow(),
        // Empty unless a second pack has actually been dropped in — see
        // `lbExtra`. An ordinary night sends nothing at all and takes exactly
        // the route it always did.
        order: nightOrder(),
      }, button);
    };

    paintOrder();

    // A DELIBERATE CHOICE puts it up; a re-render does not. `startOn()` calls
    // `pick` on every state push to keep the box filled, and that must never
    // launch anything — hence both the `quiet` flag and the id comparison.
    if (switching) switchIfFree(pack, kind);
  }

  const onType = () => { paintHits(); paintAlt(); };
  text.addEventListener('input', onType);
  /*
   * The box arrives holding tonight's pack, so tapping it to search would
   * otherwise mean deleting a title first. Selecting it means the first thing
   * typed replaces it, which is what somebody expects of a box that is already
   * full.
   */
  text.addEventListener('focus', () => { text.select(); paintHits(); });
  // Enter takes the top match, because a keyboard is faster than a thumb and
  // somebody in a hurry will press it.
  text.addEventListener('keydown', (ev) => {
    if (ev.key !== 'Enter') return;
    const first = hits.querySelector('.lb-hit');
    if (first) { ev.preventDefault(); first.click(); }
  });
  gamePick?.addEventListener('change', () => {
    // A different game means a different shelf, so whatever was chosen is not
    // on it any more. Start again on that game's own best pick — and a running
    // order built out of quiz rounds means nothing on the bingo shelf.
    currentPack = null;
    lbExtra = [];
    chosen.hidden = true;
    text.value = '';
    startOn();
  });

  /*
   * ARRIVE READY, which is the whole point of the section.
   *
   * The panel used to open on an empty search box and two shortcut buttons —
   * so the fully-featured path began with typing. It now starts on the pack
   * this room is least likely to have heard (`quickPicks`, unchanged), with
   * the venue and the settings already filled in behind it. One press.
   *
   * A room with no packs at all falls through to the empty box, which is what
   * it always was.
   */
  function startOn() {
    paintWhere();
    /*
     * A CHOICE STICKS. THE APP ONLY CHOOSES WHEN NOBODY HAS.
     *
     * This used to re-pick on every render, and `render()` runs on every state
     * push — so the bar quietly changed its mind whenever anything happened.
     * The worst version of that was reported from a real night: **launch a
     * pack, and the launched pack now has a play time, so `quickPicks` sorts
     * it away and the bar starts offering a DIFFERENT quiz from the one on the
     * big screen.** The console and the projector disagreed, with nothing
     * saying which was right.
     *
     * So the auto-pick is the empty state and nothing else: it fills the box
     * when there is no choice yet, or when the choice is not on this game's
     * shelf (changing game, or a pack that has since been deleted).
     */
    const shelf = gameOf().packs;
    const stillThere = currentPack && shelf.some((p) => p.id === currentPack.id);
    // QUIET: this runs on every state push, and a re-render is not somebody
    // choosing a pack. Without it the bar would relaunch the projector every
    // time a phone joined.
    if (stillThere) { pick(currentPack, { quiet: true }); }
    else {
      /*
       * WITH NOTHING CHOSEN, IT STARTS ON WHAT IS ON THE BIG SCREEN.
       *
       * This is the other half of the same report, and it is the half a page
       * reload produced: the box was filled from `quickPicks`, whose order
       * changes the moment a pack is launched (it now has a play time and
       * sorts away) — so coming back to the console after launching showed a
       * DIFFERENT quiz from the one the room was looking at. Panel said one
       * thing, projector said another, and pressing the big button would have
       * replaced a running night with a pack nobody chose.
       *
       * The running pack is the honest default: it is what the screen says,
       * it is almost always what you want to relaunch or carry on with, and
       * anything else is one tap away in the box.
       */
      /*
       * NOTHING IS CHOSEN FOR YOU ANY MORE, and that reverses the paragraph
       * above rather than contradicting it. All of that was the cost of the
       * bar guessing: it guessed, the guess went stale as soon as a pack was
       * launched, and the console and the projector ended up naming different
       * quizzes on a real night. The answer was to make the guess cleverer.
       *
       * Dragging a pack up is faster than reading a guess and correcting it,
       * so the guess is gone — *"don't need the autoloaded pack in the launch
       * bit now since dragging a pack is so fast"*. **A bar that chooses
       * nothing cannot choose wrongly**, which retires that whole class of
       * fault rather than managing it. What is on the big screen is still
       * SAID, by `paintLive()` below, which is the half that was actually
       * wanted: a statement of fact rather than a suggestion that competes
       * with one.
       */
      chosen.hidden = true;
    }
    paintOrder();
    paintLive();
    paintFold();
  }

  /*
   * WHAT THE BIG SCREEN IS SHOWING, said on the console — always.
   *
   * The host's report, after a night: *"the quiz in the launch bit after I
   * pressed launch didn't say what the big screen said — they need to be
   * consistent, always."* The chooser is a chooser: it says what the NEXT
   * press would start, which is not the same question as what is on the
   * projector right now, and the two are only ever the same by luck.
   *
   * So the running pack is stated in its own line, off `library.running` —
   * the server's own view of the loaded session, so it cannot drift — and it
   * goes GOLD when it differs from what is in the box, which is the moment
   * somebody is about to be surprised.
   */
  function paintLive() {
    const running = (library && library.running) || {};
    const title = String(running.title || '');
    if (!title) { liveEl.hidden = true; return; }
    liveEl.hidden = false;
    /*
     * NOTHING CHOSEN IS NOT A DISAGREEMENT.
     *
     * This was `!currentPack || currentPack.title !== title`, which was right
     * while the bar auto-picked a pack — there was always something in the box
     * to compare. Now the bar starts EMPTY, so `currentPack` is null on every
     * arrival and the red drift warning fired on a console that had not been
     * touched, about a difference that did not exist. A warning that is on by
     * default is a warning nobody reads by the second week, which would cost
     * exactly the fault it was added to catch.
     *
     * Chosen nothing, the line still SAYS what is on the projector — that is
     * information somebody wants — it simply says it quietly.
     */
    const packDiffers = Boolean(currentPack) && currentPack.title !== title;
    /*
     * THE VENUE CAN DRIFT TOO, and it is the more dangerous of the two.
     *
     * Once a team has joined, the bar can no longer re-resolve the running
     * night — that is the guard doing its job. But the bar would then show the
     * new venue's PRIZES while the room is being shown the old venue's, which
     * is precisely the console-and-projector disagreement this section exists
     * to end, wearing a different hat. A wrong pack name is embarrassing; a
     * wrong prize is somebody at the bar being refused a drink.
     *
     * So it is named. Only when a venue has actually been chosen — with none
     * picked the bar is showing the night's own answer and there is nothing to
     * disagree about.
     */
    const runVenue = String(running.venue || '').trim();
    const barVenue = String(lbVenue == null ? runVenue : lbVenue).trim();
    const venueDiffers = Boolean(lbVenue != null && barVenue.toLowerCase() !== runVenue.toLowerCase());
    liveEl.classList.toggle('lb-warn', packDiffers || venueDiffers);
    liveEl.textContent = !currentPack
      ? `On the big screen now: ${title}`
      : packDiffers
        ? `On the big screen now: ${title}`
      : venueDiffers
        ? `On the big screen now — this one, but filed under ${runVenue || 'nowhere'}. Launch again to move it.`
        : 'On the big screen now — this one';
  }

  /*
   * OPEN OR A THIN LINE, and the line still says what it is set to.
   *
   * Collapsed it is one row — "Tonight · The Crown · The 1980s Pop Quiz" and a
   * chevron — which is findable from anywhere on the page and one tap from
   * launching. Everything below the head is hidden rather than removed, so
   * reopening it is instant and nothing has to be rebuilt or re-chosen.
   *
   * THE WHOLE HEAD IS THE TARGET when it is shut. A thin bar with one small
   * chevron on the end of it is a thing you miss with a thumb in a dark pub;
   * shut, the entire row opens it.
   */
  function paintFold() {
    el.classList.toggle('shut', !tonightOpen);
    fold.setAttribute('aria-expanded', tonightOpen ? 'true' : 'false');
    /*
     * HIDE / SHOW — one pair, both describing the same act on the same thing.
     * It said "Hide" open and "Launch a night" shut, which are answers to two
     * different questions: one is what the button does to the panel, the other
     * is what the panel is for. A control that changes its own meaning when
     * pressed is a control you have to read twice.
     */
    el.querySelector('.lb-fold-word').textContent = tonightOpen ? 'Hide' : 'Show';
    /*
     * The mode switch is NOT in this list any more: it lives in the head row
     * now, beside the fold, so folding the panel must not take it with it —
     * which is the whole reason it was worth moving. Shut, the one setting
     * that can put a question on sixty phones in a pub is still on screen and
     * still changeable.
     */
    for (const part of [el.querySelector('.lb-find'), whyEl, el.querySelector('.lb-row'),
      chosen, venues, liveEl, orderEl]) {
      if (part) part.classList.toggle('lb-tucked', !tonightOpen);
    }
    shutWhat.hidden = tonightOpen;
    /*
     * SHUT, THE LINE STILL SAYS IT IS ONLINE — and that is most of why the
     * switch was worth moving. Folded away is exactly the state somebody
     * launches from without opening the panel, so the one setting that can put
     * a question on sixty phones in a pub has to survive the fold.
     *
     * Only when it is ON. Adding "In the room" to every shut line would print
     * the normal case on a row that has to stay one row, and a label that is
     * always there is a label nobody reads.
     */
    shutWhat.textContent = [lbOnline ? 'Online' : '', currentPack ? currentPack.title : '']
      .filter(Boolean).join(' · ');
  }

  /*
   * THE SECTION TAKES A PACK, and gives it back.
   *
   * Drop one on Tonight and it becomes tonight's pack, whichever game it
   * belongs to — a bingo pack dropped on a bar set to Music Quiz switches the
   * bar over rather than being quietly refused.
   *
   * AND DRAGGING THE CHOSEN PACK OFF TAKES IT OUT OF THE SECTION AND NOWHERE
   * ELSE. The host's own words: *"say you drag the wrong quiz pack, you can
   * just drag it off again quickly and easily."* It is a CHOICE being undone,
   * not a delete — the pack is untouched on disk and still on its shelf — so
   * the bar simply falls back to offering what is on the big screen, which is
   * the same empty state it arrives in.
   */
  /*
   * IT ACCEPTS A DROP WHILE SHUT, and springs open on the way.
   *
   * Collapsed, this is one thin row — which is exactly the state somebody is
   * in when they arrive at a venue and start setting the night up, so a target
   * that only worked when open would be missing at the moment it is wanted.
   * Opening on hover also gives the drop somewhere to land that is big enough
   * to aim at.
   */
  const openForDrop = () => {
    if (tonightOpen) return;
    tonightOpen = true;
    localStorage.setItem(TONIGHT_STORE, '1');
    paintFold();
  };
  /*
   * ============================================================ THE STRIP
   *
   * TONIGHT'S RUNNING ORDER: the rounds that will be played, in order, and
   * the place a pack is dropped to add its own.
   *
   * **DROPPING ON THE STRIP ADDS; DROPPING ANYWHERE ELSE IN TONIGHT
   * REPLACES.** One rule, and it is the one somebody would guess: the strip
   * is the night, so a pack landing in it joins the night, and a pack landing
   * on the bar is the bar's own "what are we playing" answered again. Without
   * the split there is no way to say "no, THAT one instead" once an order has
   * been built, which is the more common mistake of the two.
   */
  const orderEl = el.querySelector('.lb-order');
  const goBtn = el.querySelector('.lb-go');

  /** The rounds a pack contributes, as the strip stores them. */
  const roundsOf = (pack) => (pack && pack.rounds ? pack.rounds : [])
    .map((_, i) => ({ packId: pack.id, round: i }));

  /** A pack off the shelf by id. Never stored — see `lbExtra`. */
  const packOf = (id) => (gameOf().packs || []).find((p) => p.id === id);

  /** Tonight, in order: the chosen pack and anything dropped in after it. */
  const lbPacks = () => [currentPack, ...lbExtra.map(packOf)].filter(Boolean);

  /**
   * The running order to send, or null for an ordinary night.
   *
   * Null on one pack, deliberately: a night that is one pack played as
   * written is the night this app has always run, and spelling its own rounds
   * out would be the same evening by a longer road, through code that did not
   * exist last week, on the protected path.
   */
  const offKey = (packId, round) => `${packId}:${round}`;
  const isOff = (packId, round) => lbOff.has(offKey(packId, round));

  /** Tonight's rounds, in order, with the switched-off ones left out. */
  const activeRounds = () => lbPacks().flatMap(roundsOf).filter((r) => !isOff(r.packId, r.round));

  /**
   * DOES TONIGHT EVEN HAVE ROUNDS TO SWITCH OFF?
   *
   * **A BINGO PACK HAS NO ROUNDS ON DISK, and that is by design** — it is a
   * title and a track list, and the rounds are a thing that happens while it
   * is being played. So `roundsOf()` rightly returns nothing for one, and the
   * round count is not a measure of whether there is anything to launch.
   *
   * Read as one, it was: dragging any bingo pack onto Tonight disabled Launch
   * for ever, saying *"Every round is switched off"* about a pack that has
   * none to switch. Nothing threw and the pack card's own Launch still worked,
   * so it only showed up on the drag path — which is the one CLAUDE.md added
   * most recently and the one nobody had pressed in a browser.
   */
  const hasRounds = () => lbPacks().some((p) => p && p.rounds && p.rounds.length);

  function nightOrder() {
    const packs = lbPacks();
    const rounds = activeRounds();
    /*
     * NULL FOR AN ORDINARY NIGHT — one pack, played as written. That is the
     * night this app has always run, and spelling its own rounds out would be
     * the same evening by a longer road, through code that did not exist last
     * week, on the protected path.
     *
     * The moment a round is switched OFF it stops being that night, even with
     * one pack — which is why this asks whether anything is off rather than
     * only counting packs.
     */
    if (packs.length < 2 && rounds.length === roundsOf(packs[0]).length) return null;
    return rounds;
  }

  /**
   * Switch a round off, or back on.
   *
   * **THE LAST ONE CANNOT BE SWITCHED OFF.** A night with no rounds is not a
   * night, the server refuses it, and being refused at Launch — in a venue,
   * with a room in front of you — is the wrong place to find out.
   */
  function toggleRound(packId, round) {
    /*
     * ANY ROUND CAN BE SWITCHED OFF, INCLUDING THE LAST ONE.
     *
     * This used to refuse the last tick, which was a special case guarding
     * something real — the server will not launch a night with no rounds — in
     * the wrong place. The host's own fix: *"the launch console should just
     * treat a pack with all red crosses as an empty pack."*
     *
     * That is better for two reasons. A tick that will not toggle is a control
     * that ignores you, and this file's rule is that nothing on screen should
     * need explaining. And the constraint already had a home: Launch is hollow
     * when there is nothing to launch, so "every round is off" is simply
     * another way of having nothing — said in the one place that was built to
     * say it, rather than by a tap that does nothing.
     *
     * A pack with every round crossed off is an empty pack: it sits there
     * dimmed, contributes nothing, and one tap brings it back. Nobody has to
     * drag it out and find it again.
     */
    const key = offKey(packId, round);
    if (lbOff.has(key)) lbOff.delete(key);
    else lbOff.add(key);
    paintOrder();
  }

  /** Take a pack out. Taking the FIRST one out clears the night. */
  function dropPack(at) {
    if (at === 0) {
      currentPack = null;
      lbExtra = [];
      lbOff = new Set();
      chosen.hidden = true;
      /*
       * AND SET IT UP GOES BACK TO SLEEP WITH IT. `pick()` switches that
       * button on and nothing switched it off, so clearing the night left a
       * control offering to configure a night that no longer existed — it
       * opened a panel with nothing in it to set. A fresh page load has it
       * disabled, so the two states of "nothing chosen" disagreed depending on
       * how you got there, which is the leftover-state fault this file keeps
       * recording in other forms.
       *
       * Disabled rather than hidden, so the row does not change height on the
       * way out any more than it does on the way in.
       */
      moreBtn.disabled = true;
      lbOpen = false;
      moreBtn.setAttribute('aria-expanded', 'false');
      paintOrder();
      paintLive();
      return;
    }
    lbExtra.splice(at - 1, 1);
    paintOrder();
  }

  /** Reorder. Moving something into first place makes it the night's pack. */
  function movePack(from, to) {
    const ids = lbPacks().map((p) => p.id);
    const [moved] = ids.splice(from, 1);
    // The source is already out of the list, so an index after it has shifted
    // down by one — the off-by-one that makes a drag "not move" when you drop
    // it one place along.
    ids.splice(from < to ? to - 1 : to, 0, moved);
    const first = packOf(ids[0]);
    lbExtra = ids.slice(1);
    if (first && (!currentPack || currentPack.id !== first.id)) pick(first);
    else paintOrder();
  }

  /**
   * THE BAR STARTS EMPTY AND FILLS UP.
   *
   * Asked for directly once the drag existed: *"don't need the autoloaded
   * pack in the launch bit now since dragging a pack is so fast"*, and the
   * same for the game dropdown and the search box. He is right, and the
   * reason is worth writing down because it reverses an earlier decision in
   * this same file. **The auto-pick existed to answer "what are we playing"
   * before you had said** — three controls and a guess, on the panel that is
   * meant to be the fast one. Dragging a pack up answers it in one gesture
   * and cannot be wrong, so the guess stopped earning its place the moment
   * the gesture landed.
   *
   * It also removes the fault this file already records at length: the bar
   * re-picking itself on every state push, and the console and the projector
   * ending up naming different quizzes on a real night. A bar that chooses
   * nothing cannot choose wrongly.
   *
   * **THE EMPTY STATE IS THE CONTROL**, not a message about a missing one —
   * *"it needs to just be empty with those little dotted cutouts until stuff
   * is dragged up and it fills the space"*. So the cutout is a real button:
   * a drop target for a mouse and, because HTML5 drag does not fire on touch
   * at all, the way in on a phone.
   */
  /**
   * TONIGHT AS A ROW OF SQUARES.
   *
   * Asked for once the drag existed: *"can we make the packs square shaped so
   * they drop in the console and there's like 3 cut out squares to drop them
   * into? perhaps a couple of other squares that give other info like venue,
   * time, prizes or whatever."*
   *
   * **The unit is a PACK, not a round**, and that is the change this made.
   * The first build listed every round as a chip, which is the truthful view
   * of what gets played and the wrong one to hand somebody five minutes
   * before a gig: twelve chips is a list you read, three squares is a night
   * you see. Rounds are still what the server composes — a square simply
   * stands for all of its pack's.
   *
   * **THE EMPTY SLOTS ARE PART OF THE PICTURE.** Every square is always
   * drawn, filled or not, so the bar has the same shape whether the night is
   * set up or not — and an empty one is a dotted cutout that says what to do
   * with it. A row that grows a box each time you drop something reflows the
   * whole bar under your hand.
   *
   * **THE INFO SQUARES ARE READ, NOT PRESSED** (except the venue, which was
   * already a control). They restate the three facts a night is filed under —
   * where, when, what it plays for — at a glance, in the place the decision is
   * made. Nothing is duplicated: each one is a view of something set
   * elsewhere, and the venue tile drives the same `chooseVenue` the head does.
   */
  /**
   * SIX, ASKED FOR ON 15 AUGUST 2026 — *"need 6 pack slots imo"*.
   *
   * It was three, with a note in TODO.md saying not to make it four or five:
   * *"three is a quiz, a bingo and one spare, which is the shape of the host's
   * own Thursday."* **That reasoning was about PACKS and the night has since
   * stopped being made of packs** — it is a running order of elements, and a
   * quiz split either side of a breakout is three items on its own before a
   * bingo game is anywhere near it. Six is two of those nights.
   *
   * The old worry still stands and is answered by the WIDTH rather than the
   * count: a row that needs reordering and scrolling is the thing to avoid, so
   * the tiles came down to 160px, which puts six on one row of a laptop inside
   * the same space three used to take at 200.
   */
  const PACK_SLOTS = 6;

  /**
   * THE SHELF SHOWS THE GAP. A pack that is in tonight is drawn as an outline
   * of itself in the library, so the card has visibly LEFT rather than been
   * copied — which is what makes the flight read as a move. It is only a
   * look: the pack is untouched on disk and taking it out of the night puts
   * the card straight back.
   */
  function paintInTonight() {
    const ids = new Set(lbPacks().map((p) => p.id));
    for (const card of document.querySelectorAll('.pack-card[data-pack]')) {
      card.classList.toggle('in-tonight', ids.has(card.dataset.pack));
    }
  }

  function paintOrder() {
    orderEl.hidden = false;
    const packs = lbPacks();
    const tiles = [];

    packs.forEach((pack, at) => {
      const rounds = (pack.rounds || []).length;
      /*
       * THE PACK CARRIES ITS COLOUR INTO THE HOLE. Same function as the shelf,
       * so a pack cannot look like one thing on the card and another in the
       * slot — which is the whole payoff for making the two the same shape.
       * With three slots filled it also says what is in each one without
       * reading three titles.
       */
      // The KIND comes from the pack itself rather than from the tab you are
      // on: Tonight can hold a quiz and a bingo game at once, so the tab would
      // paint the wrong edge on one of them.
      const look = packLookAttrs(pack, rounds ? 'quiz' : 'bingo');
      const tile = node(`
        <div class="lb-tile is-pack ${look.cls} ${rounds && (pack.rounds || []).every((_, i) => isOff(pack.id, i)) ? 'is-spent' : ''}" style="${look.style}" draggable="true" title="${esc(pack.title)}">
          ${packWord(look)}
          <button class="lb-tile-off" type="button" aria-label="Take this pack out">&times;</button>
          <span class="lb-tile-n">${at + 1}</span>
          <b class="lb-tile-name">${esc(pack.title)}</b>
          ${rounds
    ? `<div class="lb-rounds">${(pack.rounds || []).map((r, i) => `
          <button class="lb-rd ${isOff(pack.id, i) ? 'off' : 'on'}" type="button"
            data-round="${i}" title="${esc(r.title || `Round ${i + 1}`)}"
            aria-label="${esc(r.title || `Round ${i + 1}`)} — ${isOff(pack.id, i) ? 'off' : 'on'}">
            ${isOff(pack.id, i) ? '&times;' : '&check;'}
          </button>`).join('')}</div>`
    : '<span class="tiny lb-tile-sub">bingo</span>'}
        </div>`);
      /*
       * A TICK PER ROUND, and turning one off is a tap on it. The count it
       * replaces said "3 rounds", which is the same information with nothing
       * you can do about it — these say which three and let you drop one.
       *
       * `stopPropagation` on the mousedown as well as the click: the tile
       * itself is draggable, and without it a press on a tick starts dragging
       * the pack instead of switching a round off.
       */
      for (const dot of tile.querySelectorAll('.lb-rd')) {
        dot.addEventListener('mousedown', (ev) => ev.stopPropagation());
        dot.addEventListener('click', (ev) => {
          ev.stopPropagation();
          toggleRound(pack.id, Number(dot.dataset.round));
        });
      }
      tile.querySelector('.lb-tile-off').addEventListener('click', () => dropPack(at));
      // Reordering, same shape as the editor's: which HALF of the target the
      // cursor is in decides before or after, or a list can only ever be
      // reordered one way and the last position is unreachable.
      tile.addEventListener('dragstart', (ev) => {
        roundDrag = at;
        ev.dataTransfer.effectAllowed = 'move';
        ev.dataTransfer.setData('text/plain', String(at));
        tile.classList.add('is-lifting');
      });
      tile.addEventListener('dragend', (ev) => {
        tile.classList.remove('is-lifting');
        /*
         * DRAGGED BACK OUT. A pack lifted off the row and let go anywhere
         * outside the section leaves the night — the same gesture the chosen
         * pack box has always had, now on the object it belongs to. It reads
         * as putting it back on the shelf, which is exactly what the library
         * card does at the same moment: the dashed "In tonight" outline goes
         * and the card is solid again.
         *
         * `elementFromPoint` rather than `dropEffect`, which browsers disagree
         * about — this is the same check the box already uses, so the two
         * cannot behave differently.
         */
        const inside = el.contains(document.elementFromPoint(ev.clientX, ev.clientY));
        roundDrag = null;
        if (!inside) dropPack(at);
      });
      tile.addEventListener('dragover', (ev) => {
        if (roundDrag === null) return;
        ev.preventDefault(); ev.stopPropagation();
        const box = tile.getBoundingClientRect();
        const after = ev.clientX > box.left + box.width / 2;
        tile.classList.toggle('drop-after', after);
        tile.classList.toggle('drop-before', !after);
      });
      tile.addEventListener('dragleave', () => tile.classList.remove('drop-before', 'drop-after'));
      tile.addEventListener('drop', (ev) => {
        if (roundDrag === null) return;
        ev.preventDefault(); ev.stopPropagation();
        const after = tile.classList.contains('drop-after');
        tile.classList.remove('drop-before', 'drop-after');
        movePack(roundDrag, at + (after ? 1 : 0));
        roundDrag = null;
      });
      tiles.push(tile);
    });

    /*
     * The empty slots. Always drawn up to three, and one extra beyond that so
     * a fourth pack is still possible without the row implying a limit that
     * is really twelve ROUNDS rather than three packs.
     *
     * **A BINGO NIGHT GETS EXACTLY ONE**, and none once it is filled. A bingo
     * pack is a track list with no rounds in it on disk, so there is nothing
     * to compose — three slots would be three invitations to do a thing that
     * cannot be done, which is the clutter rule wearing its worst face: a
     * control that looks available and is not.
     */
    const composes = gameOf().id === 'quiz';
    const slots = composes
      ? Math.max(PACK_SLOTS - packs.length, packs.length ? 1 : PACK_SLOTS)
      : (packs.length ? 0 : 1);
    for (let i = 0; i < slots; i++) {
      /*
       * THE SLOTS ARE NUMBERED, asked for directly — "add pack 1 pack 2 pack
       * 3". It matters more than it looks: the filled tiles already carry a
       * position badge, so unnumbered slots made the row read 1, 2, then three
       * identical boxes, and where the next one would land was a guess. Now
       * the row counts straight across whether a square is full or empty.
       *
       * The FIRST slot of an empty night teaches the gesture instead —
       * nothing else on the page suggests a pack card can be picked up, and
       * that is the one moment somebody needs telling. Every other slot says
       * what it is.
       */
      const n = packs.length + i + 1;
      const label = !composes
        ? 'Drag a bingo game here'
        : (!packs.length && i === 0 ? 'Drag pack 1 here' : `Add pack ${n}`);
      const empty = node(`
        <button class="lb-tile lb-drop" type="button">
          <span class="lb-tile-n is-empty">${n}</span>
          <span class="lb-drop-plus" aria-hidden="true">+</span>
          <span class="tiny">${esc(label)}</span>
        </button>`);
      empty.addEventListener('click', () => {
        /*
         * TAPPING OPENS THE PICKER. The drag is the fast path on the laptop
         * this console is driven from; this is the one that exists on a phone,
         * where a drag event is never delivered at all. Same list, same
         * `pick()`, so the two cannot drift.
         */
        const find = el.querySelector('.lb-find');
        find.hidden = !find.hidden;
        if (!find.hidden) text.focus();
      });
      tiles.push(empty);
    }

    /*
     * TWO ROWS, NOT ONE GRID.
     *
     * The packs and the three facts were one `auto-fit` grid, so they wrapped
     * INTO each other: "Where" ended up sitting on the end of the pack row and
     * "Playing for" dropped to a line of its own underneath pack 1. They are
     * different kinds of thing — the packs are the night, the facts are what
     * is true about it — and a row that mixes them at one width and separates
     * them at another is the layout deciding something the content should.
     *
     * Their own grids also let each be sized for what it holds: three facts
     * always fit one row, and the packs wrap among themselves when there are
     * four.
     */
    const row = node('<div class="lb-tiles"></div>');
    row.append(...tiles);
    orderEl.replaceChildren(row, infoLine());
    paintGo(packs);
    paintInTonight();
  }

  /**
   * THE BUTTON HAS TO NAME WHAT IT WILL ACTUALLY LAUNCH.
   *
   * It says "Launch <title>", built from the pack `pick()` was given — which
   * is right for a night that is one pack and a lie the moment a second one
   * is dropped in: two packs in the row above and one pack's name on the
   * button. That is the console-and-projector disagreement this bar exists to
   * end, in miniature and one step earlier, and it is the version somebody
   * would actually press without reading.
   *
   * Composed, it names the EVENING and how long it is, which is the honest
   * summary and the same thing the projector will be filed under —
   * `composeQuiz()` titles a mixed night for the evening too, so the button,
   * the archive and the big screen all say one thing.
   */
  function paintGo(packs) {
    /*
     * HOLLOW UNTIL IT CAN LAUNCH — asked for directly after the appearing and
     * disappearing button was reported as clunky. It is the same fault as a
     * grid that reflows under your hand: the bar changed height the instant
     * anything was dragged in or out, and everything below it jumped.
     *
     * Disabled AND saying what it wants, rather than merely greyed: a control
     * that is off without saying why is the thing this file keeps recording.
     */
    const rounds = activeRounds().length;
    /*
     * HOLLOW WHEN THERE IS NOTHING TO LAUNCH, and that now covers two ways of
     * having nothing: no pack at all, and a pack with every round switched
     * off. Both are said here rather than by a control that refuses to move,
     * and each says WHICH it is — a button that is off without saying why is
     * the fault this file keeps recording.
     */
    // "Nothing to launch" is two different things, and a pack with no rounds
    // AT ALL is neither of them — see `hasRounds()`.
    const emptied = hasRounds() && !rounds;
    goBtn.disabled = !packs.length || emptied;
    if (!packs.length) {
      goBtn.textContent = 'Drag a pack in to launch';
      return;
    }
    if (emptied) {
      goBtn.textContent = 'Every round is switched off';
      return;
    }
    if (packs.length < 2) {
      // It has to name what will actually be PLAYED — "Launch The 1980s Pop
      // Music Quiz" over a pack with two of its three rounds switched off is
      // the console and the projector disagreeing before the night has even
      // started.
      goBtn.textContent = rounds === roundsOf(packs[0]).length
        ? `Launch ${packs[0].title}`
        : `Launch ${packs[0].title} — ${rounds} round${rounds === 1 ? '' : 's'}`;
      return;
    }
    goBtn.textContent = `Launch tonight — ${packs.length} packs, ${rounds} round${rounds === 1 ? '' : 's'}`;
  }

  /**
   * WHERE, WHEN AND WHAT FOR — the three facts a night is filed under, as
   * squares beside the packs.
   *
   * Each is a VIEW of something set elsewhere rather than a second place to
   * set it, which is the rule this bar already follows for the venue: two
   * controls for one field is how a night gets launched with the setting the
   * other one was showing. The venue square opens the same picker the head
   * does; the other two are read.
   */
  /**
   * ONE LINE THAT SAYS EVERYTHING ELSE — where, when, and what for.
   *
   * It was three squares the same size as the pack slots above, which said
   * they were the same KIND of thing: something you drag onto. They are not —
   * they are three short facts somebody READS, and dressed as targets they
   * took as much room as the targets while doing none of the work.
   *
   * Tonight sits at the top of EVERY tab, so its height is charged to every
   * page in the console. Slots, a line, a button — that is the whole section,
   * and it now fits in a glance rather than a scroll.
   *
   * **THE VENUE STAYS A BUTTON.** It is the only way into the venue picker
   * from here, and CLAUDE.md is explicit that the venue is chosen in one place
   * and nowhere else. Losing it to a tidy-up would take the choice with it.
   */
  function infoLine() {
    const name = venueNow();
    const record = (library.venueRecords || [])
      .find((v) => (v.name || '').toLowerCase() === String(name).toLowerCase());
    const prizes = ((record && record.rewards) || []).map((r) => String(r || '').trim()).filter(Boolean);

    // What time tonight starts, if the diary says. A residency carries none —
    // the venue's arrangement lives in no record here — so this is silent
    // rather than inventing one.
    const on = upcoming({
      venues: library.venueRecords || [],
      bookings: library.bookings || [],
      weeks: 1,
    }).find((n) => n.date === nightKey() && (!name || n.venue.toLowerCase() === String(name).toLowerCase()));

    const prizeSaid = prizes.length
      ? `${prizes[0]}${prizes.length > 1 ? ` +${prizes.length - 1}` : ''}`
      : 'no prizes';

    const el = node(`
      <div class="lb-say">
        <button class="lb-say-venue" type="button" title="Pick where tonight is">
          ${esc(name || 'Pick a venue')}
        </button>
        <span class="lb-say-bit">${esc(record && record.usualNight ? 'your usual night' : (name ? 'one-off' : 'sets the prizes'))}</span>
        <span class="lb-say-bit">${esc(on && on.time ? `starts ${saidTime(on.time)}` : 'start when you like')}</span>
        <span class="lb-say-bit">${esc(`for ${prizeSaid}`)}</span>
      </div>`);
    el.querySelector('.lb-say-venue').addEventListener('click', () => toggleVenues());
    return el;
  }


  /*
   * A PACK DROPPED ON THE STRIP JOINS THE NIGHT.
   *
   * `stopPropagation` on both, or the section's own handler underneath would
   * also fire and REPLACE the night with the pack that was just added to it.
   */
  orderEl.addEventListener('dragover', (ev) => {
    if (!packDrag || packDrag.kind === 'bingo') return;
    ev.preventDefault();
    ev.stopPropagation();
    ev.dataTransfer.dropEffect = 'copy';
    orderEl.classList.add('drop-here');
  });
  orderEl.addEventListener('dragleave', (ev) => {
    if (!orderEl.contains(ev.relatedTarget)) orderEl.classList.remove('drop-here');
  });
  orderEl.addEventListener('drop', (ev) => {
    if (!packDrag || packDrag.kind === 'bingo') return;
    ev.preventDefault();
    ev.stopPropagation();
    orderEl.classList.remove('drop-here');
    const dropped = packDrag;
    packDrag = null;
    dragging(false);
    const from = packOf(dropped.id);
    if (!from) return;
    /*
     * THE FIRST PACK IS THE NIGHT; the rest are added to it. With nothing
     * chosen there is no Launch button and no settings yet — `pick()` builds
     * both — so the first drop goes through the ordinary path and only the
     * second one composes. That also means a night made of one pack is a
     * completely ordinary night, sending no running order at all.
     */
    if (!currentPack) {
      pick(from);
      return;
    }
    // The same pack twice is a mis-drop rather than an intention — a night
    // does not play the same ten questions in rounds two and four.
    if (lbPacks().some((p) => p.id === from.id)) { paintOrder(); return; }
    const rounds = activeRounds().length + (from.rounds || []).length;
    if (rounds > MAX_NIGHT_ROUNDS) {
      alert(`A night can have at most ${MAX_NIGHT_ROUNDS} rounds — that would make ${rounds}.`);
      return;
    }
    lbExtra.push(from.id);
    paintOrder();
  });

  el.addEventListener('dragover', (ev) => {
    if (!packDrag && !venueDrag) return;
    ev.preventDefault();
    ev.dataTransfer.dropEffect = 'copy';
    el.classList.add('drop-here');
    openForDrop();
  });
  el.addEventListener('dragleave', (ev) => {
    // Only when the cursor has actually left the section, not when it crosses
    // from one child of it to another — which fires dragleave on the way.
    if (!el.contains(ev.relatedTarget)) el.classList.remove('drop-here');
  });
  el.addEventListener('drop', (ev) => {
    if (!packDrag && !venueDrag) return;
    ev.preventDefault();
    el.classList.remove('drop-here');
    openForDrop();

    /*
     * A VENUE DROPPED IN GOES THROUGH `chooseVenue`, which is the same path
     * the picker in the head uses — one way for a venue to be set, so the two
     * cannot end up meaning different things.
     */
    if (venueDrag) {
      const name = venueDrag.name;
      venueDrag = null;
      dragging(false);
      if (name) chooseVenue(name);
      return;
    }

    const dropped = packDrag;
    packDrag = null;
    dragging(false);
    // A pack from the other game switches the picker first, or `pick()` would
    // look for it on the wrong shelf and find nothing.
    if (gamePick && dropped.kind && gamePick.value !== dropped.kind) {
      gamePick.value = dropped.kind;
      currentPack = null;
    }
    const found = gameOf().packs.find((p) => p.id === dropped.id);
    if (found) { pick(found); }
  });

  /*
   * TAKING IT BACK OUT. The chosen pack is itself draggable, and a drag that
   * ends anywhere outside the section clears the choice. Nothing is deleted:
   * `currentPack = null` is the state the bar arrives in, so it goes straight
   * back to offering what is on the big screen.
   */
  text.setAttribute('draggable', 'true');
  text.addEventListener('dragstart', (ev) => {
    if (!currentPack) { ev.preventDefault(); return; }
    offDrag = true;
    ev.dataTransfer.effectAllowed = 'move';
    ev.dataTransfer.setData('text/plain', currentPack.title);
  });
  text.addEventListener('dragend', (ev) => {
    if (!offDrag) return;
    offDrag = false;
    // Dropped back on the section itself? Then nothing was asked for.
    if (el.contains(document.elementFromPoint(ev.clientX, ev.clientY))) return;
    currentPack = null;
    text.value = '';
    chosen.hidden = true;
    whyEl.textContent = '';
    paintLive();
    paintAlt();
  });

  const toggleFold = () => {
    tonightOpen = !tonightOpen;
    localStorage.setItem(TONIGHT_STORE, tonightOpen ? '1' : '0');
    paintFold();
  };
  fold.addEventListener('click', (ev) => { ev.stopPropagation(); toggleFold(); });
  el.querySelector('.lb-head').addEventListener('click', () => { if (!tonightOpen) toggleFold(); });

  paintMode();
  startOn();
  return el;
}

/**
 * "March", "last year" — short enough to sit on a button.
 *
 * Deliberately vague past a few months: the question this answers is "have
 * they heard it recently", and to a decimal place that is not a question
 * anybody asks.
 */
/**
 * When a pack was last played, as a NUMBER, whatever was written down.
 *
 * `library.js` stores `lastPlayedAt` as epoch milliseconds and this file was
 * reading it with `Date.parse`, which takes a STRING — `Date.parse(1786…)` is
 * NaN. Two things fell out of that and neither showed up as an error:
 *
 * - the quick-launch chip read **"Last played"** with nothing after it, on
 *   every pack that had actually been played;
 * - and worse, the whole quick-pick PRIORITY was inert. `Date.parse(…) || 0`
 *   made every pack sort as 0, so "never played first, then longest ago"
 *   never happened and the pack you ran last night could be the first thing
 *   offered. The list still looked perfectly plausible, which is why it
 *   survived.
 *
 * One reader, used by both, so they cannot disagree again. It takes a string
 * too, because a pack file written before the counts were numbers may still
 * carry one and quietly dropping it would put an old pack at the front of a
 * list that means "least likely to have been heard".
 */
function playedAt(at) {
  if (typeof at === 'number') return Number.isFinite(at) ? at : 0;
  const then = Date.parse(at || '');
  return Number.isFinite(then) ? then : 0;
}

function whenShort(at) {
  const then = playedAt(at);
  if (!then) return '';
  const days = Math.floor((Date.now() - then) / 86400000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 14) return `${days} days ago`;
  if (days < 365) return new Date(then).toLocaleDateString('en-GB', { month: 'long' });
  return 'over a year ago';
}

/*
 * A LOADED PACK IS NOT A NIGHT.
 *
 * A session always has a pack — `boot()` falls back to one so the projector is
 * never blank — so the console said "Now: The 1980s Pop Music Quiz (0 in)" in
 * the topbar and drew a panel underneath saying "Loaded, nobody playing", with
 * a Stop button, over a quiz the account had never launched. On a
 * quizmaster's very first sign-in that is the first thing they read.
 *
 * A night is on once it is LIVE, or once somebody has joined. Before that the
 * launch bar has the top of the page to itself, which is also what a first
 * sign-in should be about. One test, used by the topbar and the panel, or the
 * two of them disagree about whether anything is happening.
 */
function aNightIsOn(running) {
  return Boolean(running) && (running.phase !== 'lobby' || running.playerCount > 0);
}

function runningPanel(running) {
  if (!aNightIsOn(running)) return node('<div></div>');
  // An owner runs no nights, so there is no night of theirs to show or stop.
  // Their room is the house one, and driving it from here would be a Stop
  // button over a game somebody else is in the middle of.
  if (!can(FEATURES.QUIZ) && !can(FEATURES.BINGO)) return node('<div></div>');
  const live = running.phase !== 'lobby' && running.phase !== 'finished';
  const what = running.game === 'bingo' ? 'Music bingo' : 'Music quiz';
  const who = `${running.playerCount} playing`;
  const el = node(`
    <div class="panel running ${live ? 'live' : ''}">
      <h3>${live ? 'Running now' : 'Loaded, nobody playing'}</h3>
      <div class="running-row">
        <div>
          <div class="running-title">${esc(running.title)}</div>
          <div class="tiny">${esc(what)} — ${who}</div>
          ${running.at ? `<div class="running-at">${esc(running.at)}</div>` : ''}
          ${nowNextRows(running)}
        </div>
        <div class="running-links">
          <a class="go control-link" href="${linkTo('/host')}">${live ? 'Take control' : 'Open the controls'}</a>
          <a class="minor" href="${screenLink()}" target="_blank" rel="noopener">Big screen</a>
          ${running.finished ? '<button class="minor invoice-it" title="Bill for this one">Invoice this</button>' : ''}
          <button class="minor danger stop-running" title="Clear it and go back to waiting">Stop</button>
        </div>
      </div>
    </div>`);

  /*
   * Bill for the night that has just finished, from where you already are.
   *
   * It appears only once a game has actually ended, and it fills the venue and
   * the date in from the night itself — so the usual case is picking the
   * customer, checking a number you already agreed weeks ago, and pressing
   * send. This is the whole point of the feature: at half eleven, an invoice
   * that needs ten minutes of typing is an invoice that gets sent on Sunday, or
   * not at all.
   */
  el.querySelector('.invoice-it')?.addEventListener('click', async () => {
    try {
      book = await invoiceApi('/api/invoices');
    } catch (err) {
      alert('Could not open the invoices: ' + err.message);
      return;
    }
    openInvoiceForm({
      event: { title: running.game === 'bingo' ? 'Music bingo night' : 'Music quiz night', date: new Date().toISOString().slice(0, 10) },
      description: running.game === 'bingo' ? 'Music bingo night' : 'Music quiz night',
    }, () => load());
  });

  /*
   * Stop whatever is running, from here.
   *
   * The control view can end a game, but you have to know that and go there.
   * From the console the only way out was to launch something else over the
   * top of it, which is a odd way to say "I am finished with this one".
   *
   * It clears scores, cards and players and leaves the pack loaded and
   * waiting — the same state as just after a launch. Nothing is deleted.
   */
  el.querySelector('.stop-running')?.addEventListener('click', async () => {
    const n = running.playerCount;
    const alsoKicks = n
      ? `\n\n${n} ${n === 1 ? 'phone is' : 'phones are'} in, and will have to scan and join again.`
      : '';
    if (!confirm(`Stop "${running.title}"?\n\nScores and cards are cleared and it goes back to waiting.${alsoKicks}`)) return;

    const button = el.querySelector('.stop-running');
    button.disabled = true;
    button.textContent = 'Stopping…';
    try {
      await postJson('/api/host/resetAll', {}, { 'X-Host-Key': hostKey });
      await load();
    } catch (err) {
      alert(`Could not stop it: ${err.message}`);
      button.disabled = false;
      button.textContent = 'Stop';
    }
  });

  return el;
}

/*
 * Finding a pack when there are eighty of them.
 *
 * A search box and a compact toggle. Both are about the same problem: the grid
 * was fine at eight packs and is unusable at eighty, and eighty is where this
 * is going the moment packs are something to sell.
 *
 * SEARCH LOOKS INSIDE THE PACK, not just at its title. "Madonna" should find
 * the Madonna quiz AND the 80s pack with three Madonna questions in it, because
 * the second is what you actually cannot find any other way — and it is the
 * thing you want when a venue asks for a Madonna round.
 *
 * COMPACT is remembered, per tab, because it is a preference about how you
 * work rather than about this visit.
 */
const DENSE_STORE = 'musicquiz.compactpacks';
let packQuery = { quiz: '', bingo: '' };

/**
 * What one pack costs, said the way a price is said.
 *
 * `money()` on this page is the INVOICE formatter — it prints £3.00, because an
 * invoice line with a bare £3 on it looks like somebody forgot the pence. A
 * shop price is the other way round: £3.00 reads as a form, £3 reads as a
 * price. Same number, different job, so it gets its own two lines rather than
 * an option on the other one.
 *
 * Read off the library payload, never written out here, so the card and the
 * server cannot disagree about what a purchase would charge.
 */
/**
 * Is this pack topical, and has it gone off?
 *
 * A DATE rather than a `topical: true` flag, and that is the whole point: a
 * boolean says a pack is dated but not whether it is STALE, and stale is the
 * only part anybody needs telling about. A pack with no date is evergreen.
 *
 * Read in the browser as well as on the server because the console has to sort
 * and label on it, and a second copy of the rule is exactly what `freshness()`
 * in quizzes.js exists to prevent — so the shape is identical and this one only
 * ever draws.
 */
function freshness(pack) {
  const until = Date.parse(pack.freshUntil || '');
  if (!Number.isFinite(until)) return { topical: false, expired: false, until: null };
  return { topical: true, expired: Date.now() > until, until };
}

/** "for the week of 12 August", the way somebody would say it out loud. */
function freshLabel(pack) {
  const { topical, expired, until } = freshness(pack);
  if (!topical) return '';
  const when = new Date(until).toLocaleDateString('en-GB', { day: 'numeric', month: 'long' });
  return expired ? `Was current to ${when}` : `Current until ${when}`;
}

function packPrice() {
  const pence = Number((library && library.packPence) || 0) || 300;
  return pence % 100 ? `£${(pence / 100).toFixed(2)}` : `£${pence / 100}`;
}

function gameSection(kind, title, blurb, packs, editLabel = 'Edit') {
  const dense = localStorage.getItem(DENSE_STORE) === '1';
  const query = packQuery[kind] || '';

  const el = node(`
    <div class="game-section">
      <div class="game-head">
        <div>
          <h2>Your library</h2>
          <div class="tiny">${esc(blurb)}</div>
        </div>
        <div class="pack-tools">
          <input class="pack-search" type="search" placeholder="Search ${(packs || []).filter((p) => !p.locked).length}…"
                 value="${esc(query)}" aria-label="Search packs">
          <button class="minor pack-dense" title="${dense ? 'Show the full cards' : 'Squeeze more on screen'}"
                  aria-pressed="${dense}">${dense ? 'Cards' : 'Compact'}</button>
          ${can(FEATURES.CATALOGUE) || can(FEATURES.OWN_PACKS) ? `<a class="minor" href="${linkTo('/editor')}">${esc(editLabel)}</a>` : ''}
        </div>
      </div>
      <div class="pack-grid ${dense ? 'dense' : ''}"></div>
      <div class="game-head shop-head" hidden>
        <div>
          <h2>Quizporium packs</h2>
          <div class="tiny"><span class="shop-count"></span> — ${esc(packPrice())} each.
            ${kind === 'bingo'
              ? 'Put together for you — every chorus lands on its own, no song twice in three months.'
              : 'Written and checked for you — every question read through twice.'}
            ${esc((library.catalogue && library.catalogue.blurb) || '')}</div>
        </div>
        <!-- THE OTHER WAY TO GET THEM, which the blurb has always mentioned and
             never linked to. One per SECTION rather than one per card: a
             second money control on every pack would be the same offer printed
             nine times, and the card already carries its own price. -->
        <a class="minor shop-up" href="?tab=account">See the tiers</a>
      </div>
      <div class="pack-grid shop-grid ${dense ? 'dense' : ''}"></div>
      <div class="ask-slot"></div>
    </div>`);

  /*
   * "There is nothing here for the night I have booked."
   *
   * It goes UNDER the shop, because that is the moment the want actually
   * arrives: you have scrolled the catalogue, you have scrolled the shelf, and
   * neither has the thing. Putting it in the suggestion box on another tab
   * would mean remembering it later, which is exactly what that box exists to
   * avoid needing.
   */
  el.querySelector('.ask-slot').appendChild(askForPackPanel(kind));

  const grid = el.querySelector('.pack-grid');
  const shop = el.querySelector('.shop-grid');
  const shopHead = el.querySelector('.shop-head');
  const search = el.querySelector('.pack-search');

  /*
   * Yours first, then the shop, with a heading between them.
   *
   * One mixed grid was the first attempt and it is wrong: a padlocked card
   * three rows down among ones you can launch reads as a fault in your account
   * rather than as something for sale. Separated, the shop is a shelf you
   * choose to look at, and the packs you can actually run tonight are all
   * above it — which is what somebody opening this page ten minutes before a
   * gig is looking for.
   */
  /*
   * ONE PACK IS OPEN AT A TIME, and the rest are just names.
   *
   * Asked for after the first weeks of real use: *"we don't need all the
   * options for launch on every pack in the list — just the selected one, the
   * rest can be compacted into a card with their name only."* He is right, and
   * it is the third design rule doing the work: the common job on this tab is
   * FIND TONIGHT'S PACK AND PRESS LAUNCH, and nine cards each carrying four
   * dropdowns, a prize line, five buttons and a Launch is a wall you read
   * rather than a shelf you scan.
   *
   * The settings are per-night decisions about ONE pack, so they belong to the
   * one you have chosen and nowhere else. Closed, a card is its name and a line
   * of what it is — which is what you choose BY.
   *
   * `repaint` is handed to each card so opening one can redraw the grid
   * without the whole page reloading. `load()` would work and is far heavier:
   * it refetches the library, and on a tab whose whole point is being quick
   * that is a visible stutter for a purely local change.
   */
  const paint = () => {
    const found = matchPacks(packs || [], packQuery[kind]);
    grid.replaceChildren();
    shop.replaceChildren();
    shopHead.hidden = true;

    if (!packs || !packs.length) {
      grid.appendChild(node('<div class="tiny">Nothing saved yet — build one above.</div>'));
      return;
    }
    if (!found.length) {
      grid.appendChild(node(`<div class="tiny">Nothing matches “${esc(packQuery[kind])}”.</div>`));
      return;
    }

    /*
     * Fresh topical packs first, expired ones last.
     *
     * A "week that just went past" pack is only worth anything this week, so
     * it belongs at the top while it is — and an expired one in the middle of
     * the grid in November is somebody scrolling past six dead packs to find
     * the quiz they wanted. It is NOT hidden: a pack that vanished would read
     * as lost work, and last month's news round is a perfectly good thing to
     * run on purpose.
     */
    const shelf = (p) => (freshness(p).expired ? 2 : freshness(p).topical ? 0 : 1);
    const inOrder = [...found].sort((a, b) => shelf(a) - shelf(b));
    const yours = inOrder.filter((p) => !p.locked);
    const buyable = inOrder.filter((p) => p.locked);

    if (!yours.length) {
      grid.appendChild(node(`<div class="tiny">None of the ones you have match “${esc(packQuery[kind])}”.</div>`));
    }
    for (const pack of yours) grid.appendChild(packCard(kind, pack, paint));

    if (buyable.length) {
      shopHead.hidden = false;
      shopHead.querySelector('.shop-count').textContent =
        `${buyable.length} more ${kind === 'quiz' ? (buyable.length === 1 ? 'quiz' : 'quizzes') : (buyable.length === 1 ? 'bingo game' : 'bingo games')}`;
      for (const pack of buyable) shop.appendChild(packCard(kind, pack, paint));
    }
  };

  // Redrawn in place rather than through render(), so the box keeps focus and
  // the caret does not jump to the end after every letter.
  search.addEventListener('input', () => { packQuery[kind] = search.value; paint(); });

  el.querySelector('.pack-dense').addEventListener('click', () => {
    localStorage.setItem(DENSE_STORE, dense ? '0' : '1');
    render();
  });

  paint();
  return el;
}

/**
 * Which packs match what was typed.
 *
 * Every word has to appear SOMEWHERE in the pack — title, id, round names,
 * question text, answers, artists, track titles — so "abba disco" finds the
 * disco pack with Abba on it rather than nothing at all. Words rather than the
 * whole phrase, because nobody types a title in the order it was saved.
 */
function matchPacks(packs, query) {
  const words = String(query || '').toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return packs;
  return packs.filter((pack) => {
    const hay = searchText(pack);
    return words.every((w) => hay.includes(w));
  });
}

/*
 * `pack.search` is built SERVER-SIDE — every question, answer, artist and track
 * title, deduplicated down to words. The console only ever receives a summary
 * of a pack, so without it a search could match a title and nothing else, and
 * "which pack has the Wham question in it" is precisely the search you cannot
 * do any other way. See `searchBlob` in src/quizzes.js.
 */
function searchText(pack) {
  return `${pack.title || ''} ${pack.id || ''} ${pack.search || ''}`.toLowerCase();
}

function hasPictureRound(pack) {
  return (pack.rounds || []).some((r) => r.type === 'image');
}

/**
 * Round 2 artwork, from the console.
 *
 * Two buttons rather than one, because they are not the same decision.
 * Placeholders are free and instant and exist so the round is rehearsable;
 * real portraits cost money per press. The panel says which questions still
 * have a stand-in before you spend anything, and never quietly replaces a
 * real picture — one you have already paid for, or redrawn by hand, has to be
 * asked for again explicitly.
 *
 * The style and the quality are both here rather than on the pack, because
 * both are decisions about what you are willing to spend today. Changing the
 * style re-reads the plan, so "as a superhero" says out loud that it is a
 * fresh set of ten and what that costs — a picture library is only shared
 * within a style.
 */
function picturePanel(pack) {
  const el = node(`
    <div class="panel pics">
      <div class="tiny status">Checking what round 2 has…</div>
      <div class="row pic-opts" style="margin-top:8px">
        <label class="tiny">Style
          <select class="style"></select>
        </label>
        <label class="tiny">Quality
          <select class="quality"></select>
        </label>
      </div>
      <div class="tiny style-hint"></div>
      <div class="row" style="margin-top:8px">
        <button class="minor draw">Draw stand-ins</button>
        <button class="role-make make">Make real portraits</button>
        <label class="tiny redo"><input type="checkbox" class="force"> replace ones already there</label>
      </div>
      <div class="tiny note"></div>
      <details class="pic-lib" hidden>
        <summary class="tiny"></summary>
        <div class="lib-names"></div>
      </details>
      <pre class="gen-log" hidden></pre>
    </div>`);

  const status = el.querySelector('.status');
  const note = el.querySelector('.note');
  const logEl = el.querySelector('.gen-log');
  const makeBtn = el.querySelector('.make');
  const drawBtn = el.querySelector('.draw');
  const styleSel = el.querySelector('.style');
  const qualitySel = el.querySelector('.quality');
  const styleHint = el.querySelector('.style-hint');

  // Roughly what OpenAI charges for one 1024x1024, in pence. Only ever used to
  // put a figure in front of the host before he presses a button that spends
  // money — so it is deliberately on the high side of what it might be.
  // The prices come from the server, which reads them off the ledger's own
  // table. There was a second copy of them here, so the quote before the press
  // and the record after it could disagree — which is the one thing the price
  // table's own comment says it exists to prevent. This is only the fallback
  // for a payload from an older server.
  let pence = { low: 1, medium: 4, high: 14 };
  let supplier = '';
  let filled = false;

  const refresh = async () => {
    try {
      const chosen = styleSel.value ? `?style=${encodeURIComponent(styleSel.value)}` : '';
      const res = await fetch(keyed(`/api/images/${encodeURIComponent(pack.id)}${chosen}`));
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Could not read it');

      if (!filled) {
        filled = true;
        styleSel.innerHTML = d.styles
          .map((st) => `<option value="${esc(st.id)}"${st.id === d.style ? ' selected' : ''}>${esc(st.label)}</option>`).join('');
        qualitySel.innerHTML = d.qualities
          .map((q) => `<option value="${esc(q)}"${q === d.defaultQuality ? ' selected' : ''}>${esc(q)}</option>`).join('');
      }
      const picked = d.styles.find((st) => st.id === styleSel.value);
      styleHint.textContent = picked ? picked.hint : '';

      const bits = [`${d.total} picture${d.total === 1 ? '' : 's'} in round 2`];
      if (d.real) bits.push(`${d.real} real`);
      if (d.placeholder) bits.push(`${d.placeholder} stand-in${d.placeholder === 1 ? '' : 's'}`);
      if (d.missing) bits.push(`${d.missing} with nothing yet`);
      status.textContent = bits.join(' · ');

      if (d.pence) pence = d.pence;
      supplier = { google: 'Google', openai: 'OpenAI' }[d.art] || '';
      if (!d.art) {
        makeBtn.disabled = true;
        note.textContent = 'Set GOOGLE_API_KEY to make real portraits. Stand-ins work without it.';
        note.style.color = 'var(--gold)';
      } else {
        makeBtn.disabled = false;
        // The plan, not the pack: what this press costs given what the shared
        // library already holds. "6 already drawn" is the whole point of the
        // library, so it is the first thing on the line.
        const { reused, toDraw } = d.plan;
        const cost = (toDraw * (pence[qualitySel.value || d.defaultQuality] ?? 0)) / 100;
        const parts = [];
        if (reused) parts.push(`${reused} already in the library, free`);
        parts.push(toDraw
          ? `${toDraw} to draw — about ${cost < 0.1 ? `${Math.round(cost * 100)}p` : `£${cost.toFixed(2)}`}`
          : 'nothing left to draw');
        note.textContent = parts.join(' · ') + (toDraw ? '' : '. Tick the box to redo any.');
        note.style.color = '';
      }

      /*
       * Everybody already drawn, folded away behind a caret.
       *
       * The filename IS the index — the key is the answer text — so "Michael
       * Jackson" and "Michael Jackson (Jacko)" are two people as far as the app
       * is concerned, and you pay for both. Nothing catches that and a fuzzy
       * warning would be worse than the problem: it cannot tell "The Jacksons"
       * from "Michael Jackson", and the remedy for a true positive is editing
       * an answer a player sees rather than a filename.
       *
       * So it just shows the list, sorted, where two near-identical names end
       * up next to each other and the eye does the rest. Shut by default,
       * because on the common press this is not what you came for.
       */
      const lib = d.library || [];
      const box = el.querySelector('.pic-lib');
      box.hidden = !lib.length;
      if (lib.length) {
        const drawn = lib.filter((r) => r.real).length;
        box.querySelector('summary').textContent =
          `The library — ${drawn} ${drawn === 1 ? 'person' : 'people'} drawn, free to reuse`;
        box.querySelector('.lib-names').replaceChildren(...lib.map((r) => node(
          `<span class="lib-name ${r.real ? '' : 'stand-in'}" title="${esc(r.file)}">${esc(r.slug)}</span>`)));
      }
    } catch (err) {
      status.textContent = err.message;
    }
  };
  refresh();
  styleSel.addEventListener('change', refresh);
  qualitySel.addEventListener('change', refresh);

  const run = async (provider, button) => {
    const force = el.querySelector('.force').checked;
    const real = provider !== 'placeholder';
    if (real && !confirm(`Generate with ${supplier || 'the picture service'} at ${qualitySel.value} quality? ${note.textContent}`)) return;
    for (const b of [makeBtn, drawBtn]) b.disabled = true;
    button.textContent = real ? 'Making…' : 'Drawing…';
    logEl.hidden = false;
    logEl.textContent = '';
    const say = (line) => { logEl.textContent += line + '\n'; logEl.scrollTop = logEl.scrollHeight; };

    try {
      const { done, error } = await streamGeneration('/api/generate/images', {
        quizId: pack.id, provider, force,
        style: styleSel.value, quality: qualitySel.value,
      }, say);
      if (error) say('\n' + error);
      else if (done) {
        say(`\n${done.made} made, ${done.reused} from the library${done.failed ? `, ${done.failed} failed` : ''}.`);
        if (!done.backedUp && done.made) say('These are on this server only — generate at home and commit them to keep them.');
      }
    } catch (err) {
      say('\n' + err.message);
    }
    for (const b of [makeBtn, drawBtn]) b.disabled = false;
    makeBtn.textContent = 'Make real portraits';
    drawBtn.textContent = 'Draw stand-ins';
    refresh();
  };

  // "real" rather than a supplier name: which one gets billed is the server's
  // decision, from which key is set. See /api/generate/images.
  makeBtn.addEventListener('click', () => run('real', makeBtn));
  drawBtn.addEventListener('click', () => run('placeholder', drawBtn));
  return el;
}

function hasIntroRound(pack) {
  return (pack.rounds || []).some((r) => r.type === 'intro');
}

/**
 * The Spotify playlist for a "name that intro" round.
 *
 * Its own button rather than only a step inside generation, because you can
 * easily have an intro round before you have a Spotify login — and because a
 * playlist deleted by accident should not mean regenerating the quiz and
 * getting a different set of questions.
 *
 * Building it also writes Spotify's own spelling and a track link back onto
 * each cue, so the control view can offer a tap to open the track instead of
 * leaving you searching for it with a room waiting.
 */
function playlistPanel(pack) {
  const gen = library.generation || {};
  const el = node(`
    <div class="panel pics">
      <div class="tiny status">Builds a Spotify playlist in question order — track one is question one.</div>
      <div class="row" style="margin-top:8px">
        <button class="role-make build">Make the playlist</button>
      </div>
      <div class="tiny note"></div>
      <details class="pic-lib" hidden>
        <summary class="tiny"></summary>
        <div class="lib-names"></div>
      </details>
      <pre class="gen-log" hidden></pre>
    </div>`);

  const note = el.querySelector('.note');
  const button = el.querySelector('.build');
  const logEl = el.querySelector('.gen-log');

  if (!gen.spotify) {
    button.disabled = true;
    note.style.color = 'var(--gold)';
    note.textContent = `Spotify is not set up — run \`npm run spotify:login\`. Missing: ${(gen.spotifyMissing || []).join(', ')}`;
  } else {
    note.textContent = 'Spotify cannot make folders through its API, so every playlist is named the same way and they sort together — drag them into a folder in one go.';
  }

  button.addEventListener('click', async () => {
    button.disabled = true;
    button.textContent = 'Building…';
    logEl.hidden = false;
    logEl.textContent = '';
    const say = (line) => { logEl.textContent += line + '\n'; logEl.scrollTop = logEl.scrollHeight; };
    try {
      const { done, error } = await streamGeneration('/api/playlist/intro', { quizId: pack.id }, say);
      if (error) say('\n' + error);
      else if (done) {
        for (const p of done.playlists) {
          say(`\n${p.round}: ${p.url}${p.missing ? ` (${p.missing} not found on Spotify)` : ''}`);
        }
        if (!done.playlists.length) say('\nNo playlist made.');
        /*
         * Hold the result above everything BEFORE reloading.
         *
         * `load()` rebuilds the page from the library, which tears down this
         * card and takes the panel — and the link it just printed — with it.
         * From the outside that is a button that says "Building…" and then
         * closes, with nothing to show for a playlist that was in fact made.
         * Exactly the fault the generators had, and the same fix.
         */
        const failed = done.failed || [];
        for (const f of failed) say(`\n${f.round}: ${f.error}`);
        /*
         * Say WHICH round failed and WHY. "No playlist made" on its own was
         * the same message for a Spotify permission being refused and for a
         * quiz whose tracks are all misspelt — and those want completely
         * different things doing about them.
         */
        const built = done.playlists.length
          ? `<b>Playlist built.</b> ${done.playlists.map((p) => `<a href="${esc(p.url)}" target="_blank" rel="noopener">${esc(p.round)}</a>${p.missing ? ` <span class="tiny">(${p.missing} not found on Spotify)</span>` : ''}`).join(' · ')}`
          : '';
        const broke = failed.length
          ? `<b>Could not build ${failed.length === 1 ? 'it' : 'them'}.</b> ${failed.map((f) => `${esc(f.round)} — ${esc(f.error)}`).join(' · ')}`
          : '';
        showDone(built && !broke ? 'good' : broke ? 'bad' : 'warn',
          [built, broke].filter(Boolean).join('<br>')
            || '<b>No playlist made.</b> This quiz has no intro round with tracks on it.');
        await load();
      }
    } catch (err) {
      say('\n' + err.message);
    }
    button.disabled = false;
    button.textContent = 'Make the playlist';
  });

  return el;
}

/**
 * The card shapes this pack has enough tracks for, ready to launch with.
 *
 * The shape belongs to the NIGHT, not to the pack: the same forty-two songs are
 * a quick game on a 3x3 and a long one on a strip, and which you want depends
 * on how much of the evening is left — something you know when you press
 * Launch, not when you filed the songs weeks ago. So it is chosen here, and
 * never written back to the file.
 *
 * Shapes the list cannot fill are left out rather than shown and refused.
 */
function shapeOptions(pack) {
  const shapes = (library && library.cardShapes) || [];
  const fits = shapes.filter((s) => pack.trackCount >= s.minimum);
  const usable = fits.length ? fits : shapes.slice(0, 1);
  // The pack's own shape is the default, if it is one of the ones on offer.
  const own = usable.find((s) => s.rows === pack.cardRows && s.cols === pack.cardCols)
    || usable.find((s) => s.rows === s.cols && s.rows === pack.cardSize)
    || usable[usable.length - 1];
  // "line of 8" is the number that actually decides how long the game runs —
  // on a square it is the side, on a strip it is the long way.
  return usable.map((s) => `<option value='{"rows":${s.rows},"cols":${s.cols}}' ${s === own ? 'selected' : ''}>${esc(s.label)} — line of ${Math.max(s.rows, s.cols)}</option>`).join('');
}

/**
 * How it looks tonight.
 *
 * The pack carries a default — a Halloween quiz should look like one without
 * being asked — and this overrides it for this evening only, the same as the
 * card shape and the number of prizes. Nothing about how a round plays changes;
 * it is a palette and some drawn shapes down the sides.
 */
/**
 * The look picker, with the time of year marked.
 *
 * A quizmaster running a Halloween quiz on the 30th of October should not have
 * to hunt down a list for the Halloween look — so the one that suits today is
 * SAID ("in season now") and moved to the top, directly under "The usual".
 *
 * IT IS NEVER SELECTED FOR THEM. The pack's own look still wins, and a
 * corporate booking in late October is not quietly given skulls because the
 * calendar said so. The date suggests; the person who knows the room decides.
 */
/**
 * The lobby games, for the picker under Set it up.
 *
 * Locked ones are `disabled` and say which tier they are on, rather than being
 * filtered out — the subtle upsell the Adverts tab already uses. The default
 * for THIS kind of night is the one selected, so somebody who never opens this
 * gets exactly what they got before the picker existed.
 */
function lobbyGameOptions(kind) {
  const tier = (me && me.entitlements && me.entitlements.tier) || '';
  const fallback = lobbyGameFor(kind, '').id;
  return lobbyGameChoices(tier).map((g) => {
    const label = g.held ? `${g.name} — ${g.blurb}` : `${g.name} — ${(findTier(g.tier) || {}).label || g.tier} and up`;
    return `<option value="${esc(g.id)}" ${g.held ? '' : 'disabled'} ${g.id === fallback ? 'selected' : ''}>${esc(label)}</option>`;
  }).join('');
}

function lookOptions(pack) {
  const looks = library.looks || [];
  const current = pack.look || 'default';
  const now = new Date();
  const timely = looks.find((l) => inSeason(l, now));
  const order = timely
    ? [...looks.filter((l) => l.id === 'default'), timely, ...looks.filter((l) => l.id !== 'default' && l.id !== timely.id)]
    : looks;
  return order
    .map((l) => {
      const mark = timely && l.id === timely.id ? ' — in season now' : '';
      return `<option value="${esc(l.id)}" ${l.id === current ? 'selected' : ''} title="${esc(l.blurb || '')}">${esc(l.label)}${mark}</option>`;
    })
    .join('');
}

function venueBox() {
  /*
   * A REAL DROPDOWN once there are venues, and a plain box when there are not.
   *
   * It was an `<input list=…>`, which is both at once and therefore looks like
   * neither: a datalist draws no chevron, so the field said "type something"
   * while quietly holding a list nobody could see. The GUI rules already
   * settle it — the chevron on its block of gradient is *the affordance that
   * says this opens* — so a control that opens has to look like one.
   *
   * Both lists behind it: venues you have SET UP and venues you have PLAYED. A
   * venue added on the Venues tab has hosted nothing yet, so reading only the
   * archive would offer back nothing on the one occasion somebody had just
   * gone to the trouble of adding it.
   *
   * "Somewhere else" is last and swaps in a text box, because a one-off venue
   * must not need a record made for it first — that is the promise the night's
   * free-text `venue` was built on and it has not changed.
   */
  const played = (library && library.venues) || [];
  const setUp = ((library && library.venueRecords) || []).map((v) => v.name);
  const seen = [...new Set([...setUp, ...played].filter(Boolean))];
  if (!seen.length) {
    return '<input class="venue-pick venue-free" type="text" maxlength="60" autocomplete="off" placeholder="The Dog and Duck">';
  }
  /*
   * TONIGHT'S IS ALREADY CHOSEN, rather than the picker starting blank.
   *
   * The venue whose usual night is today, or the one you played last — see
   * `tonightsVenue()`. This is the same answer the quick-launch buttons use,
   * from the same function, so the fast path and the deliberate one cannot
   * disagree about where you are.
   *
   * Safe to preselect precisely because it is VISIBLE: the dropdown shows the
   * name and the prize line directly underneath says what that venue puts up,
   * so a wrong one is one glance away rather than a surprise at the final
   * scores. Changing it is what the picker was always for. And the fallback
   * is unchanged — no venues, no history, nothing selected.
   */
  const tonight = tonightsVenue();
  const pick = tonight && seen.find((v) => v.toLowerCase() === tonight.name.toLowerCase());
  return `
    <select class="venue-select">
      <option value="" ${pick ? '' : 'selected'}>Where is it?</option>
      ${seen.map((v) => `<option value="${esc(v)}" ${v === pick ? 'selected' : ''}>${esc(v)}</option>`).join('')}
      <option value="__other">Somewhere else…</option>
    </select>
    <input class="venue-pick venue-free" type="text" maxlength="60" autocomplete="off"
           placeholder="The Dog and Duck" hidden>`;
}

/**
 * Which venue was chosen, whichever control said so.
 *
 * One reader, because two call sites already ask and a launch that read the
 * wrong control would file a night under nothing at all.
 */
function wireVenue(el) {
  /*
   * "Somewhere else" swaps the dropdown for a text box.
   *
   * A one-off venue must not need a record made for it first — that is the
   * promise the night's free-text `venue` was built on. This lived inside the
   * prize wiring until the prizes moved onto the venue itself, so it has a
   * function of its own now rather than being a passenger in one.
   */
  const select = el.querySelector('.venue-select');
  const free = el.querySelector('.venue-free');
  const line = el.querySelector('.prize-line');

  /*
   * WHAT TONIGHT IS PLAYING FOR, BEFORE THE PRESS.
   *
   * The prizes are read off the venue record by the SERVER at launch, which is
   * right — one source of truth — but it meant nothing on this card said what
   * they were, or that there were none. The first real night ended with no
   * voucher and no explanation: the venue had not matched, so there were no
   * prizes, and an app that says nothing looks exactly like an app that is
   * working.
   *
   * So it is stated here, read-only, at the only moment it can still be
   * changed. **And it says when there are NONE**, because nothing on screen is
   * indistinguishable from not having looked.
   */
  const paintPrizes = () => {
    if (!line) return;
    const name = venueFrom(el);
    if (!name) { line.hidden = true; return; }
    line.hidden = false;
    const record = (library.venueRecords || [])
      .find((v) => v.name.toLowerCase() === name.toLowerCase());
    const prizes = ((record && record.rewards) || []).map((r) => String(r || '').trim());
    while (prizes.length && !prizes[prizes.length - 1]) prizes.pop();
    if (!prizes.length) {
      /*
       * A venue typed as free text can never match a record, so it can never
       * carry prizes — worth saying here rather than leaving somebody to find
       * out at the final scores.
       */
      line.className = 'prize-line none';
      line.innerHTML = record
        ? 'No prizes tonight — set them on the Venues tab.'
        : 'No prizes tonight — this venue is not on your Venues tab.';
      return;
    }
    line.className = 'prize-line';
    line.innerHTML = 'Playing for: '
      + prizes.map((r, i) => `<b class="prize-place p${i + 1}">${['1st', '2nd', '3rd'][i]}</b> ${esc(r)}`).join(' · ');
  };

  if (select) {
    select.addEventListener('change', () => {
      const other = select.value === '__other';
      if (free) {
        free.hidden = !other;
        if (other) free.focus();
      }
      paintPrizes();
    });
  }
  if (free) free.addEventListener('input', paintPrizes);
  paintPrizes();
}

function venueFrom(el) {
  const select = el.querySelector('.venue-select');
  const free = el.querySelector('.venue-free');
  if (!select) return (free && free.value.trim()) || '';
  if (select.value === '__other') return (free && free.value.trim()) || '';
  return select.value.trim();
}

function whereOptions() {
  return `
    <option value="room" selected>In the room</option>
    <option value="online">Online — the question goes on their phones</option>`;
}

/**
 * One phone each, or several phones to a team.
 *
 * Beside Where and Look, and the same kind of decision: the room that turns up
 * tonight is either a set of individuals or a set of tables, and the pack has
 * no idea which.
 *
 * **Teams are scored on the AVERAGE**, which is the whole reason it works
 * without pens: six chancers cannot out-score two people who know their stuff,
 * because a member who answers nothing is a zero in the mean. That is worth
 * saying on the control itself rather than leaving to be discovered on a
 * scoreboard in front of a room.
 */
function playingOptions() {
  return `
    <option value="solo" selected>One phone each</option>
    <option value="teams">Teams — several phones, scores averaged</option>`;
}

/** Can this account actually RUN this game? An owner writes packs, never plays. */
const canRun = (kind) => can(kind === 'bingo' ? FEATURES.BINGO : FEATURES.QUIZ);

/**
 * WHICH PACK IS OPEN, per tab, remembered outside the render.
 *
 * Module level for the same reason the control view keeps its open answer
 * panels there: this grid is rebuilt whenever anything on the page changes —
 * a save, a launch, a rename — and a selection stored inside the render would
 * close itself the moment you touched the card you had just opened.
 *
 * Keyed by TAB, so opening a bingo pack does not close the quiz you were
 * looking at, and each tab comes back where you left it.
 */
const openPack = new Map();

function packCard(kind, pack, repaint = () => {}) {
  /*
   * A quizmaster READS a pack and LAUNCHES it, and that is the arrangement —
   * the packs are written to a house style and sold. Renaming, deleting,
   * drawing the portraits and building the playlist all write to the shared
   * catalogue, so they are the owner's alone and the server refuses them.
   * Drawing them anyway is how you get a Delete button that says 403.
   *
   * A pack they WROTE is the other way round entirely. It is theirs, so they
   * rename it, edit it, delete it and take a copy of it away — and the OWNER is
   * the one with nothing to press, because it is not in the catalogue and not
   * the owner's to touch. So the question is never "who is looking", it is
   * "whose pack is this", asked per card.
   */
  /*
   * A pack they do not hold: a shop card, and NOTHING else.
   *
   * Returned early rather than threaded through the ordinary card as a pile of
   * conditionals — every control below this line is something a locked pack
   * must not have, and "hide eight buttons" is how one of them survives a
   * refactor and starts returning 403s. It carries no Read either: the server
   * refuses that now, and a button that refuses is worse than no button.
   */
  if (pack.locked) return shopCard(kind, pack);

  const ownPack = Boolean(pack.mine);
  const mine = ownPack ? can(FEATURES.OWN_PACKS) : can(FEATURES.CATALOGUE);
  // Portraits cost the owner money at OpenAI and the playlist step writes to
  // the owner's own Spotify account, so both stay the owner's whoever wrote
  // the pack.
  const ownersJob = can(FEATURES.CATALOGUE);

  const roundCount = (pack.rounds || []).length;
  const detail = kind === 'quiz'
    ? `${pack.questionCount} question${pack.questionCount === 1 ? '' : 's'} · ${roundCount} round${roundCount === 1 ? '' : 's'}`
    : `${pack.trackCount} track${pack.trackCount === 1 ? '' : 's'}`;

  const played = pack.playCount
    ? `Played ${pack.playCount} time${pack.playCount === 1 ? '' : 's'}${pack.lastPlayedAt ? ` · last ${whenish(pack.lastPlayedAt)}` : ''}`
    : 'Never played';

  const open = openPack.get(kind) === pack.id;

  /*
   * WHAT A CLOSED CARD KEEPS, and it is not quite "the name only".
   *
   * The ask was a card with the name on it. The size and when it was last
   * played stay, in one small line, because they are what you CHOOSE by:
   * "never played" and "last played 3 days ago" is how you avoid running the
   * same quiz at the same venue two weeks running, and it is the exact signal
   * the quick-launch priority is built out of. Dropping them would make the
   * grid tidier and the choice harder, which is the wrong trade on the tab
   * whose job is choosing.
   *
   * WARNINGS ALWAYS STAY, open or closed. A broken pack, a question to fix and
   * an expired topical one are read once at a moment that matters, and the
   * house style makes those the exception to being short. A pack that looked
   * fine closed and turned out to be broken when opened would be the app
   * saying nothing again.
   */
  /*
   * ITS OWN COLOUR, FROM ITS OWN SUBJECT — see `pack-look.js`. A wash behind
   * the card, never a fill: `broken` is still the only red on this shelf that
   * means anything, and it is still on the border where it always was.
   */
  const look = packLookAttrs(pack, kind);
  const el = node(`
    <div class="pack-card ${open ? 'open' : 'shut'} ${look.cls} ${pack.broken ? 'broken' : ''} ${ownPack ? 'own' : ''} ${freshness(pack).expired ? 'stale' : ''}"
      style="${look.style}"
      draggable="${pack.broken ? 'false' : 'true'}" data-pack="${esc(pack.id)}" data-kind="${esc(kind)}">
      ${packWord(look)}
      <button class="pack-title" title="${open ? 'Close it' : 'Open it to set tonight up and launch'}"
        aria-expanded="${open ? 'true' : 'false'}">${esc(pack.title)}</button>
      ${ownPack ? '<div class="pack-yours" title="You wrote this one. Nobody else can read it.">Yours</div>' : ''}
      <div class="tiny">${esc(detail)} · ${esc(played)}</div>
      ${freshLabel(pack) ? `<div class="tiny fresh ${freshness(pack).expired ? 'gone' : ''}">${esc(freshLabel(pack))}</div>` : ''}
      ${pack.broken ? `<div class="tiny" style="color:var(--bad)">Broken: ${esc(pack.broken)}</div>` : ''}
      ${pack.problems ? `<div class="tiny" style="color:var(--bad)">${pack.problems} thing${pack.problems === 1 ? '' : 's'} to fix</div>` : ''}
      ${!open ? '' : `
      <div class="pack-set">
      ${kind === 'bingo' && !pack.broken ? `
        <label class="pack-shape">Cards
          <select class="shape-pick">${shapeOptions(pack)}</select>
        </label>
        <label class="pack-shape">Prizes
          <select class="prize-pick"></select>
        </label>` : ''}
      ${pack.broken ? '' : `
        <label class="pack-shape">Look
          <select class="look-pick">${lookOptions(pack)}</select>
        </label>
        <!-- The same picker as the launch bar's, because a pack card can still
             launch a night — and a setting that exists on one route and not the
             other is a night that comes out different depending on which button
             was nearer. -->
        <label class="pack-shape">While they wait
          <select class="game-pick">${lobbyGameOptions(kind)}</select>
        </label>
        <label class="pack-shape">Game sound
          <select class="sound-pick">
            <option value="on">On</option>
            <option value="off">Off</option>
          </select>
        </label>
        <label class="pack-shape">Where
          <select class="where-pick">${whereOptions()}</select>
        </label>
        <label class="pack-shape">Playing
          <select class="play-pick">${playingOptions()}</select>
        </label>
        <label class="pack-shape venue-wrap">Venue
          ${venueBox()}
        </label>
`}
      </div>
      ${pack.broken ? '' : '<div class="prize-line" hidden></div>'}
      <div class="pack-actions">
        <button class="pack-read" title="Read it through">Read</button>
        ${mine ? `<button class="pack-rename" ${pack.broken ? 'disabled' : ''} title="Change what it is called">Rename</button>` : ''}
        ${pack.playlist ? `<a class="pack-spotify" href="${esc(pack.playlist)}" target="_blank" rel="noopener" title="Open it in Spotify">Playlist</a>` : ''}
        ${ownPack ? '<button class="pack-save" title="Download it as a file you keep">Download</button>' : ''}
        ${ownersJob && hasPictureRound(pack) ? '<button class="pack-pics" title="Make the round 2 portraits">Pictures</button>' : ''}
        ${ownersJob && hasIntroRound(pack) ? (pack.playlist
          // Once one exists, the green button beside this one is already called
          // Playlist — two buttons with the same word on one card is a card you
          // have to try to understand. This one says what it does instead, and
          // its tooltip is honest that Spotify gets a second playlist rather
          // than an updated one.
          ? '<button class="pack-playlist" title="Build it again. Spotify gets a NEW playlist — the existing one is left alone.">Rebuild</button>'
          // AND BEFORE ONE EXISTS IT SAYS "MAKE", NOT "PLAYLIST".
          //
          // The two never appear together — the green link only exists once
          // there is something to open — so this read as one word meaning two
          // opposite things a week apart: press Playlist on Monday and you
          // build one, press it on Friday and you are in Spotify. A collision
          // separated in time is still a collision, and it is the worse kind
          // because nothing on screen shows you both at once.
          //
          // A verb also puts it in the same family as "Make real portraits"
          // beside it, which is the other thing on this row that makes
          // something rather than opening something.
          : '<button class="pack-playlist" title="Build the Spotify playlist for the intro round">Make playlist</button>') : ''}
        ${mine ? '<button class="pack-del" title="Delete this pack">Delete</button>' : ''}
      </div>
      ${canRun(kind) ? `<button class="go launch" ${pack.broken ? 'disabled' : ''}>Launch</button>` : ''}
      <div class="pics-slot"></div>
      `}
    </div>`);

  /*
   * DRAG IT UP TO TONIGHT.
   *
   * The console is driven from the laptop that is plugged into the projector,
   * so a mouse is the input this serves — and dragging a pack onto the launch
   * section is the gesture somebody reaches for once the section is a place
   * rather than a button. The card's own Launch stays exactly as it was: this
   * is a second way to choose, not a replacement for the way that works on a
   * phone, where drag events do not fire at all.
   *
   * It carries the pack ID and the GAME, because a bingo pack dropped on a bar
   * that is set to Music Quiz has to switch the bar over rather than be
   * silently ignored.
   */
  el.addEventListener('dragstart', (ev) => {
    if (pack.broken) return;
    /*
     * WHERE IT WAS PICKED UP FROM, kept so it can be seen to LAND somewhere.
     * A rectangle taken now rather than looked up on drop: by then the shelf
     * may have re-rendered and the card may not be where it was.
     */
    const box = el.getBoundingClientRect();
    packDrag = { id: pack.id, kind, title: pack.title, from: { x: box.left, y: box.top, w: box.width, h: box.height } };
    ev.dataTransfer.effectAllowed = 'copy';
    ev.dataTransfer.setData('text/plain', pack.title);
    el.classList.add('is-dragging');
    // Pin Tonight to the top for the length of the drag — see `dragging()`.
    dragging(true);
  });
  el.addEventListener('dragend', () => {
    packDrag = null;
    dragging(false);
    el.classList.remove('is-dragging');
    document.querySelector('.launchbar')?.classList.remove('drop-here');
  });

  /*
   * The title OPENS the card; Read is in the row below.
   *
   * It used to open the read-through, which was the only thing it could
   * sensibly do when every card was already fully open. Now the first thing
   * you want from a pack is "set tonight up and launch it", so that is what
   * the biggest target on the card does. Read is one tap further in, on the
   * card you have already chosen, which is when you actually want to read it.
   */
  el.querySelector('.pack-title').addEventListener('click', () => {
    if (open) openPack.delete(kind);
    else openPack.set(kind, pack.id);
    repaint();
  });

  /*
   * How many actions this card ended up with, so the stylesheet can lay them
   * out in an even block rather than leaving a ragged last row.
   *
   * A card carries between one and five of these depending on what the pack
   * is and who is looking, and "as many as fit per row" put four out as three
   * and a lonely one — which reads as a button that has come loose rather than
   * as a row. Counting them here is the only place that knows.
   */
  const actions = el.querySelector('.pack-actions');
  if (actions) actions.dataset.count = actions.children.length;

  const openIt = () => preview(kind, pack);
  const toggle = (build) => {
    const slot = el.querySelector('.pics-slot');
    const already = slot.dataset.which === build.name;
    slot.replaceChildren();
    slot.dataset.which = already ? '' : build.name;
    if (!already) slot.appendChild(build(pack));
  };
  el.querySelector('.pack-pics')?.addEventListener('click', () => toggle(picturePanel));
  el.querySelector('.pack-playlist')?.addEventListener('click', () => toggle(playlistPanel));
  // NOT the title — that opens and closes the card now. Wiring both here is
  // how you get a tap that opens the read-through AND collapses the card
  // underneath it, which reads as the page jumping.
  el.querySelector('.pack-read')?.addEventListener('click', openIt);

  /*
   * Take a copy away.
   *
   * On their own packs only, and it is not a nicety: this is their work. It is
   * the one thing that makes "kept on somebody else's server" acceptable —
   * whatever happens to the app, to the backup or to the subscription, the file
   * is a file and they can hold it. It is also how a pack moves between
   * accounts, which is the honest answer to "what if I leave".
   */
  el.querySelector('.pack-save')?.addEventListener('click', async () => {
    try {
      const res = await fetch(keyed(`/api/${kind}/` + encodeURIComponent(pack.id)), { headers: { 'X-Host-Key': hostKey } });
      if (!res.ok) throw new Error('Could not read that pack');
      const full = await res.json();
      delete full.reviewWarnings;
      delete full.problems;
      delete full.mine;
      const blob = new Blob([JSON.stringify(full, null, 2) + '\n'], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `${pack.id}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    } catch (err) {
      alert('Could not download it: ' + err.message);
    }
  });

  /*
   * How many prizes, and what each one is.
   *
   * It depends on the card: a 3-across strip has only three lines, so two line
   * prizes and a full house is all it can carry, and offering four would be
   * offering one nobody could win. So the list is rebuilt whenever the shape
   * changes rather than written out once.
   */
  const shapePick = el.querySelector('.shape-pick');
  const prizePick = el.querySelector('.prize-pick');
  const paintPrizes = () => {
    if (!shapePick || !prizePick) return;
    const chosen = JSON.parse(shapePick.value);
    const shapes = (library && library.cardShapes) || [];
    const found = shapes.find((s) => s.rows === chosen.rows && s.cols === chosen.cols);
    if (!found) return;
    const wanted = Number(prizePick.value) || 2;
    prizePick.innerHTML = found.plans.map((plan, i) => {
      const n = i + 1;
      return `<option value="${n}" ${n === Math.min(wanted, found.maxPrizes) ? 'selected' : ''}>${n} — ${esc(plan.join(', then '))}</option>`;
    }).join('');
  };
  shapePick?.addEventListener('change', paintPrizes);
  paintPrizes();
  wireVenue(el);

  /*
   * Rename without opening the pack.
   *
   * The title is the only thing you ever want to change from out here — a pack
   * called "1980s Music Bingo" is fine until the night you run two of them.
   *
   * The id is deliberately left alone. It is what the play counts, the song
   * history and the backup file are all keyed on, so renaming the file to
   * match would quietly orphan all three. What the pack is called and what it
   * is filed under are different things.
   */
  el.querySelector('.pack-rename')?.addEventListener('click', async () => {
    const answer = prompt('What should this be called?', pack.title);
    if (answer === null) return;
    const title = answer.trim();
    if (!title || title === pack.title) return;

    const button = el.querySelector('.pack-rename');
    button.disabled = true;
    button.textContent = 'Saving…';
    try {
      const url = keyed(`/api/${kind}/` + encodeURIComponent(pack.id));
      const res = await fetch(url, { headers: { 'X-Host-Key': hostKey } });
      if (!res.ok) throw new Error('Could not read that pack');
      const full = await res.json();
      delete full.reviewWarnings;   // added by the server when reading, not part of the pack
      delete full.mine;             // likewise: which library it came from, not part of it
      full.title = title;

      // One of theirs goes back to their own library, never to the catalogue —
      // two prefixes, because a path test cannot tell which library a pack id
      // belongs to. See the note on /api/mine in server.js.
      const saved = ownPack
        ? await fetch(keyed(`/api/mine/${kind}`), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Host-Key': hostKey },
          body: JSON.stringify(full),
        })
        : await fetch(url, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'X-Host-Key': hostKey },
          body: JSON.stringify(full),
        });
      const data = await saved.json().catch(() => ({}));
      if (!saved.ok) throw new Error((data.problems || []).join('; ') || data.error || 'Could not save it');
      await load();
    } catch (err) {
      alert(`Could not rename it: ${err.message}`);
      button.disabled = false;
      button.textContent = 'Rename';
    }
  });

  el.querySelector('.pack-del')?.addEventListener('click', async () => {
    if (!confirm(`Delete "${pack.title}"?\n\nThis removes it from your library for good.`)) return;
    const button = el.querySelector('.pack-del');
    button.disabled = true;
    button.textContent = 'Deleting…';
    try {
      const base = ownPack ? `/api/mine/${kind}/` : `/api/${kind}/`;
      const res = await fetch(keyed(base + encodeURIComponent(pack.id)), {
        method: 'DELETE',
        headers: { 'X-Host-Key': hostKey },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not delete it');
      await load();
    } catch (err) {
      button.disabled = false;
      button.textContent = 'Delete';
      alert(err.message);
    }
  });

  el.querySelector('.launch')?.addEventListener('click', async () => {
    // Warn whenever anybody has joined — including in the lobby, which used to
    // be treated as safe. The lobby is exactly when a room full of people has
    // just scanned the code, so it is the worst moment to wipe them, not the
    // best. Launching over the top throws every one of them out.
    /*
     * An expired topical pack WARNS and does not refuse.
     *
     * A control that refuses in front of a room is the mistake this codebase
     * keeps recording, and there are good reasons to run last month's news
     * round on purpose. But running one by accident is a quizmaster reading
     * out "who won on Saturday" about a Saturday three months ago, which is
     * exactly the thing the ages-out flags exist to prevent — so it has to be
     * said once, plainly, before it goes on a projector.
     */
    const off = freshness(pack);
    if (off.expired) {
      const when = new Date(off.until).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
      if (!confirm(`"${pack.title}" was written to be current to ${when}.\n\nSome of the answers will have moved on. Run it anyway?`)) return;
    }

    const button = el.querySelector('.launch');

    const picked = el.querySelector('.shape-pick');
    const shape = picked ? JSON.parse(picked.value) : null;
    const prizes = Number(el.querySelector('.prize-pick')?.value) || 0;
    const look = el.querySelector('.look-pick')?.value || '';
    const lobbyGame = el.querySelector('.game-pick')?.value || '';
    const lobbySound = el.querySelector('.sound-pick')?.value !== 'off';
    const online = el.querySelector('.where-pick')?.value === 'online';
    const teamPlay = el.querySelector('.play-pick')?.value === 'teams';
    const venue = venueFrom(el);
    await doLaunch(kind, pack.id, { shape, prizes, look, lobbyGame, lobbySound, online, teamPlay, venue }, button);
  });
  return el;
}

/**
 * Actually launch — the ONE path, whichever button was pressed.
 *
 * There are two ways in now (a pack card, and the launch bar at the top) and
 * there must not be two ways OUT, or the 409-and-confirm dance gets fixed in
 * one of them and quietly rots in the other.
 */
async function doLaunch(kind, packId, { shape = null, prizes = 0, look = '', lobbyGame = '', lobbySound = true, online = false, teamPlay = false, venue = '', order = null }, button) {
    const send = (replace) => postJson(
      '/api/host/launch',
      {
        game: kind, packId, shape, prizes, look, lobbyGame, lobbySound, online, teamPlay, venue,
        /*
         * TONIGHT'S RUNNING ORDER, and only when there IS one.
         *
         * An ordinary launch sends no `order` at all rather than sending the
         * chosen pack's own rounds spelled out — which would be the same night
         * by a longer road, through code that did not exist last week, on the
         * protected path. The server composes only when it is given something,
         * so a night nobody has rearranged goes down exactly the route it
         * always did.
         */
        ...(order && order.length ? { order } : {}),
        ...(replace ? { replace: true } : {}),
      },
      { 'X-Host-Key': hostKey },
    );
    /*
     * PUT THE BUTTON BACK AS IT WAS, not as the word "Launch".
     *
     * The three launch buttons do not say the same thing: a pack card's says
     * "Launch", the launch bar's says "Launch <title>", and a quick pick is
     * two spans — the pack's name and why it is being offered. Writing the
     * literal string back turned a quick pick into a bare **Launch** with no
     * indication of what it runs, sitting next to another one that still said.
     *
     * And it happens at the worst possible moment: the only way to get here
     * is the 409 — two devices on one login, a night already running, which is
     * exactly when somebody is under pressure and reading fast.
     *
     * So the markup is kept and restored. `innerHTML` rather than a clone
     * because the click handler is bound to the button itself and only its
     * contents are being replaced.
     *
     * **"Launching…" is set HERE and nowhere else**, which is the half that
     * makes it work: the three call sites each used to write it themselves,
     * so by the time this function ran the original label was already gone and
     * there was nothing left to put back. One place that changes the button is
     * also one place that can change it back.
     */
    const wasHtml = button.innerHTML;
    button.disabled = true;
    button.textContent = 'Launching…';
    const back = () => {
      button.disabled = false;
      button.innerHTML = wasHtml;
    };

    /*
     * **The SERVER decides whether a night is in progress, not this page.**
     *
     * This used to check `library.running`, which is a snapshot taken when the
     * console was loaded. That works for one person on one device and is blind
     * to the case that actually costs somebody their night: two people on one
     * login, where this console was opened before the other one launched. It
     * reported nothing running and went straight ahead.
     *
     * Same lesson as the tier lever — a guard that only exists in the browser
     * is decoration. The server answers with what is live right now, and this
     * asks once, deliberately, with the game and the player count in the
     * question.
     */
    try {
      await send(false);
      location.href = linkTo('/host');
    } catch (err) {
      if (err.status === 409 && err.data && err.data.replace) {
        if (!confirm(`${err.data.error}\n\nEnd it and launch this instead?`)) return back();
        try {
          await send(true);
          location.href = linkTo('/host');
        } catch (second) {
          back();
          alert('Could not launch: ' + second.message);
        }
        return;
      }
      back();
      alert('Could not launch: ' + err.message);
    }
}

/**
 * A pack on the shelf rather than in the library.
 *
 * It shows the title, how big it is and what it costs — and deliberately not a
 * word of what is inside. That is enforced on the SERVER, which strips the
 * search blob and the playlist link out of a locked summary before it is sent,
 * because a padlock drawn over a payload that still contained every question
 * and answer would be decoration rather than a lever.
 *
 * **Buy takes no money yet and says so plainly.** There is no payment flow
 * wired up, and a button that looked like it charged you and then did nothing
 * is a worse first impression than an honest one. This is here so the shop can
 * be LOOKED at before a processor is committed to — whether it reads as fair
 * or as grabby is a judgement about wording and layout, and it is much cheaper
 * to change now than after the money is plumbed in.
 */
function shopCard(kind, pack) {
  const roundCount = (pack.rounds || []).length;
  const detail = kind === 'quiz'
    ? `${pack.questionCount} question${pack.questionCount === 1 ? '' : 's'} · ${roundCount} round${roundCount === 1 ? '' : 's'}`
    : `${pack.trackCount} track${pack.trackCount === 1 ? '' : 's'}`;

  /*
   * A dated pack says so on the shelf, and that is the one thing the shop
   * window genuinely needs to tell you.
   *
   * Every other locked card is worth the same in a month's time; a topical one
   * is worth the most this week and nothing much after it. Leaving that off
   * makes the strongest card in the shop look like the weakest — an unfamiliar
   * title with no theme anybody recognises.
   */
  const { topical, expired } = freshness(pack);

  const el = node(`
    <div class="pack-card locked">
      <div class="pack-title">${esc(pack.title)}</div>
      <div class="tiny">${esc(detail)}</div>
      ${topical ? `<div class="tiny fresh ${expired ? 'gone' : ''}">${esc(freshLabel(pack))}</div>` : ''}
      <!-- GREEN, because money is green everywhere in this app — the same
           language as "paying" on an account and "makes something" on a
           button. It is a marker rather than a control: the whole card is
           already about buying, and a price you can press as well as a Buy
           button underneath it is two controls for one job. -->
      <div class="shop-price">${esc(packPrice())}</div>
      <button class="go buy">Buy it</button>
    </div>`);

  el.querySelector('.buy').addEventListener('click', () => {
    alert(`There is no way to pay yet.\n\n"${pack.title}" would be ${packPrice()}, and it would be in your library straight away — same as the ones you already have.\n\nOr Silver includes every pack in the catalogue and each new one as it is written — the tiers are on My Account.\n\nThis is here so the shop can be looked at before the payments are wired up.`);
  });
  return el;
}

/**
 * Read a pack through without leaving the console.
 *
 * The point is answering "is this any good?" in the thirty seconds before you
 * decide to run it — so the correct answer is obvious at a glance, and there is
 * a summary at the top flagging the things that make a quiz feel cheap: the
 * answer always being in the same slot, or a round with no interesting facts to
 * read out.
 */
async function preview(kind, pack) {
  // Reading a pack through is everybody's; changing a word in it is not.
  const mine = can(FEATURES.CATALOGUE);
  const overlay = node(`
    <div class="overlay">
      <div class="sheet">
        <div class="sheet-head">
          <div style="min-width:0;flex:1 1 auto">
            <input class="sheet-title" id="sheetTitle" value="${esc(pack.title)}" title="${mine ? 'Click to rename' : 'These packs are read-only'}" ${mine ? '' : 'readonly'}>
            <div class="tiny" id="sheetSub">Loading…</div>
          </div>
          <div class="sheet-actions">
            <button class="role-make" id="sheetSave" hidden>Save</button>
            ${mine ? `<a class="minor" href="${linkTo('/editor')}">Edit questions</a>` : ''}
            <button class="minor" id="sheetClose">Close</button>
          </div>
        </div>
        <div class="sheet-body" id="sheetBody"></div>
      </div>
    </div>`);

  document.body.appendChild(overlay);
  const close = () => overlay.remove();
  overlay.querySelector('#sheetClose').addEventListener('click', close);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  const onKey = (e) => { if (e.key === 'Escape') { close(); document.removeEventListener('keydown', onKey); } };
  document.addEventListener('keydown', onKey);

  const body = overlay.querySelector('#sheetBody');
  const sub = overlay.querySelector('#sheetSub');
  const saveBtn = overlay.querySelector('#sheetSave');
  const titleInput = overlay.querySelector('#sheetTitle');

  // Renaming happens here rather than in the editor, because reading a pack
  // through is when you notice a round is called the wrong thing.
  let loaded = null;
  let dirty = false;
  // Redrawn rather than left as it was after a save, so the summary line at the
  // top stops saying "press Save" once you have. Keeping the scroll matters:
  // this is a list you read down, and being thrown back to the top after
  // renaming a round in the middle of it is the sort of small rudeness that
  // makes you stop using a panel.
  const drawPreview = () => {
    const y = body.scrollTop;
    if (kind === 'bingo') renderBingoPreview(body, sub, loaded, markDirty);
    else renderQuizPreview(body, sub, loaded, markDirty);
    body.scrollTop = y;
  };
  const markDirty = () => {
    dirty = true;
    saveBtn.hidden = false;
    saveBtn.textContent = 'Save';
    saveBtn.disabled = false;
  };

  titleInput.addEventListener('input', () => {
    if (loaded) { loaded.title = titleInput.value; markDirty(); }
  });

  saveBtn.addEventListener('click', async () => {
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving…';
    try {
      const res = await fetch(keyed(`/api/${kind}/` + encodeURIComponent(pack.id)), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'X-Host-Key': hostKey },
        body: JSON.stringify(loaded),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not save');
      dirty = false;
      saveBtn.textContent = data.backedUp ? 'Saved and backed up' : 'Saved here only';
      drawPreview();
      await load();
    } catch (err) {
      saveBtn.disabled = false;
      saveBtn.textContent = 'Save';
      alert(err.message);
    }
  });

  // Do not let a click outside quietly bin a rename.
  const guardedClose = () => {
    if (dirty && !confirm('You have unsaved changes. Close anyway?')) return;
    close();
  };
  overlay.querySelector('#sheetClose').removeEventListener('click', close);
  overlay.querySelector('#sheetClose').addEventListener('click', guardedClose);

  try {
    const res = await fetch(keyed(`/api/${kind}/` + encodeURIComponent(pack.id)));
    if (!res.ok) throw new Error('Could not open it');
    loaded = await res.json();
    drawPreview();
  } catch (err) {
    sub.textContent = '';
    body.replaceChildren(node(`<div class="tiny" style="color:var(--bad)">${esc(err.message)}</div>`));
  }
}

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];
const ROUND_LABELS = {
  text: 'General knowledge',
  image: 'Whose face is this?',
  intro: 'Name that intro',
  multi: 'Pick them all',
  alphabet: 'First letter only',
};
const REVEAL_LABELS = {
  zoom: 'zooms out',
  pixelate: 'pixelates',
  blur: 'comes into focus',
  tiles: 'tiles come away',
  mix: 'a different effect each question',
};

/** The letter an alphabet answer turns on. Mirrors answerLetter in src/quizzes.js. */
function firstLetter(answer) {
  const found = String(answer || '').trim().match(/[a-z]/i);
  return found ? found[0].toUpperCase() : '';
}

/**
 * The flags, with a way to tick each one off.
 *
 * Reading twenty of these is a job, and a job you can lose your place in. So a
 * checked flag drops out of the list into a folded-away pile at the bottom,
 * leaving only what you have not looked at yet — and it stays checked next
 * time, because it is saved on the question rather than in this browser.
 *
 * They are never removed outright: a flag you dismissed by mistake, or one on
 * a question you later rewrote, has to be gettable back.
 */
function warningPanel(quiz, warnings) {
  const el = node(`
    <div class="pv-warn">
      <b class="pv-warn-head"></b>
      <ul class="pv-flags"></ul>
      <div class="pv-cleared" hidden>
        <button class="pv-cleared-toggle" type="button"></button>
        <ul class="pv-flags done" hidden></ul>
      </div>
      <div class="tiny" style="margin-top:8px">These are hunches, not errors — the app cannot tell whether a fact is true. Read them and decide.</div>
    </div>`);

  const head = el.querySelector('.pv-warn-head');
  const openList = el.querySelector('.pv-flags');
  const clearedBox = el.querySelector('.pv-cleared');
  const clearedToggle = el.querySelector('.pv-cleared-toggle');
  const clearedList = el.querySelector('.pv-flags.done');
  let showCleared = false;

  const draw = () => {
    const open = warnings.filter((w) => !w.cleared);
    const done = warnings.filter((w) => w.cleared);

    head.textContent = open.length
      ? `${open.length} thing${open.length === 1 ? '' : 's'} worth a second look`
      : 'All checked — nothing left to look at';
    head.classList.toggle('all-clear', open.length === 0);
    el.classList.toggle('all-clear', open.length === 0);

    openList.replaceChildren(...open.map((w) => row(w, false)));
    clearedBox.hidden = done.length === 0;
    clearedToggle.textContent = `${showCleared ? 'Hide' : 'Show'} ${done.length} you have checked`;
    clearedList.hidden = !showCleared;
    clearedList.replaceChildren(...done.map((w) => row(w, true)));
  };

  const row = (w, done) => {
    // A tick is written into the pack itself, so it is the owner's — a
    // quizmaster reads the hunches and reports anything wrong from the
    // control view instead.
    const li = node(`
      <li class="pv-flag ${done ? 'done' : ''}">
        <span class="pv-flag-text">${esc(w.text)}</span>
        ${can(FEATURES.CATALOGUE) ? `<button class="pv-tick" type="button">${done ? 'Undo' : 'Checked'}</button>` : ''}
      </li>`);
    const button = li.querySelector('.pv-tick');
    button?.addEventListener('click', async () => {
      button.disabled = true;
      const wanted = !w.cleared;
      try {
        const res = await fetch(keyed(`/api/quiz/${encodeURIComponent(quiz.id)}/checked`), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Host-Key': hostKey },
          body: JSON.stringify({ questionId: w.questionId, warning: w.id, checked: wanted }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'Could not save that');
        // Trust the server's list over the local one — it has just written it.
        if (Array.isArray(data.warnings)) {
          const fresh = new Map(data.warnings.map((x) => [`${x.questionId}|${x.id}`, x.cleared]));
          for (const other of warnings) {
            const state = fresh.get(`${other.questionId}|${other.id}`);
            if (state !== undefined) other.cleared = state;
          }
        } else {
          w.cleared = wanted;
        }
        draw();
      } catch (err) {
        button.disabled = false;
        alert(err.message);
      }
    });
    return li;
  };

  clearedToggle.addEventListener('click', () => { showCleared = !showCleared; draw(); });
  draw();
  return el;
}

function renderQuizPreview(body, sub, quiz, markDirty = () => {}) {
  const all = quiz.rounds.flatMap((r) => r.questions);
  // A first-letter question has no options and no letter to lean on, so it is
  // left out of this entirely — counted in, it would water the lean down and
  // stop a genuinely lopsided pack being flagged.
  const lettered = all.filter((q) => (q.options || []).length);
  // Long enough for the widest round in the pack: four for most, six for a
  // pick-them-all round.
  const spread = new Array(Math.max(4, ...lettered.map((q) => q.options.length))).fill(0);
  // A pick-them-all question has several right answers, so it contributes to
  // several slots — otherwise the "answers land A x3 B x1" line would treat
  // one of them as the answer and call the round lopsided when it is not.
  for (const q of lettered) {
    const right = q.correctIndexes && q.correctIndexes.length ? q.correctIndexes : [q.correctIndex];
    for (const i of right) if (spread[i] !== undefined) spread[i]++;
  }
  // Four is the fewest that can lean; below that "A x1 B x0 — lopsided" is
  // just arithmetic being rude about a question that has to be somewhere.
  const lopsided = lettered.length >= 4 && spread.some((n) => n > lettered.length * 0.5);
  const noNotes = all.filter((q) => !q.answerNote).length;

  sub.innerHTML = `${all.length} questions across ${quiz.rounds.length} round${quiz.rounds.length === 1 ? '' : 's'}
    ${lettered.length ? `· answers land ${spread.map((n, i) => `${LETTERS[i]}&times;${n}`).join(' ')}` : ''}
    ${lopsided ? '<b style="color:var(--gold)"> — lopsided</b>' : ''}
    ${noNotes ? ` · ${noNotes} with no fact to read out` : ''}`;
  // Rearranging the options rewrites the pack, so it is the owner's — the
  // complaint about a lopsided quiz still shows, it just has nothing to press.
  if (can(FEATURES.CATALOGUE)) sub.appendChild(evenerButton(body, sub, quiz, markDirty, lopsided));

  const parts = [];

  // The questions most likely to cause an argument, listed first so they are
  // the ones you actually look at.
  // Real errors first: these stop the quiz being played and stop the editor
  // saving, so they come above the hunches and read differently. Without this
  // the only sign was an alert saying "Quiz is not valid" with no clue which
  // question was at fault.
  const problems = quiz.problems || [];
  if (problems.length) {
    parts.push(node(`
      <div class="pv-warn pv-broken">
        <b class="pv-warn-head">${problems.length} thing${problems.length === 1 ? '' : 's'} to fix before this can be played</b>
        <ul class="pv-flags">
          ${problems.map((p) => `<li class="pv-flag"><span class="pv-flag-text">${esc(p)}</span></li>`).join('')}
        </ul>
        <div class="tiny" style="margin-top:8px">Fix ${problems.length === 1 ? 'this' : 'these'} in the editor. Ticking the notes below still works meanwhile.</div>
      </div>`));
  }

  const warnings = quiz.reviewWarnings || [];
  if (warnings.length) parts.push(warningPanel(quiz, warnings));
  for (const round of quiz.rounds) {
    const head = node(`
      <div class="pv-round">
        <div class="pv-round-head">
          <input class="pv-round-name" value="${esc(round.title)}" title="Click to rename this round">
          <span class="tiny">${esc(ROUND_LABELS[round.type] || round.type)}${
            // Which effect the pictures use, because it is set in the editor
            // and there is otherwise nowhere that says so at a glance.
            round.type === 'image' ? ` · ${esc(REVEAL_LABELS[round.reveal || 'zoom'] || round.reveal)}` : ''}</span>
        </div>
        ${round.spotifyPlaylist ? `<a class="pv-playlist" href="${esc(round.spotifyPlaylist.url)}" target="_blank" rel="noopener">Spotify playlist for this round</a>` : ''}
      </div>`);
    head.querySelector('.pv-round-name').addEventListener('input', (e) => {
      round.title = e.target.value;
      markDirty();
    });
    parts.push(head);

    round.questions.forEach((q, i) => {
      parts.push(node(`
        <div class="pv-q">
          <div class="pv-prompt"><span class="pv-num">${i + 1}</span>${esc(q.prompt)}</div>
          ${pictureFor(round, q)}
          <div class="pv-opts">
            ${round.type === 'alphabet'
              // No options to read through — the whole answer key is the answer
              // and the letter it turns on, so show exactly that.
              ? `<div class="pv-opt right"><span class="pv-letter">${esc(firstLetter(q.answer) || '?')}</span>${esc(q.answer || '')}</div>`
              : (q.options || []).map((o, oi) => `
                  <div class="pv-opt ${(q.correctIndexes && q.correctIndexes.length ? q.correctIndexes : [q.correctIndex]).includes(oi) ? 'right' : ''}">
                    <span class="pv-letter">${LETTERS[oi]}</span>${esc(o)}
                  </div>`).join('')}
          </div>
          ${q.cue ? `<div class="pv-cue">Play: <b>${esc(q.cue.title)}</b> — ${esc(q.cue.artist)}${q.cue.hint ? ` · ${esc(q.cue.hint)}` : ''}</div>` : ''}
          ${q.answerNote ? `<div class="pv-note">${esc(q.answerNote)}</div>` : ''}
          ${q.note ? `<div class="pv-note">Your note: ${esc(q.note)}</div>` : ''}
        </div>`));
    });
  }
  body.replaceChildren(...parts);
}

/**
 * THE PICTURE, on the read-through.
 *
 * A picture round cannot be checked by reading it. The whole question is
 * "whose face is this", so four names with no face above them tells you
 * nothing about the only part that can be wrong — and the drawing is the half
 * made by a different supplier, costing money, that occasionally comes back as
 * somebody else entirely.
 *
 * **It does not try to say whether the picture is real or a placeholder**, and
 * that is deliberate rather than lazy: `/quiz-images/` falls back to an SVG of
 * the same name when the artwork has not been made, so the URL is identical
 * either way and any guess here would be a guess. The Pictures panel on the
 * pack card is where that question is answered properly — it counts them — and
 * a placeholder is obvious on sight anyway, being a lettered card rather than
 * a face.
 *
 * Small, with a link to the full size: judging a likeness at 120px is not
 * judging it.
 */
function pictureFor(round, q) {
  if (round.type !== 'image' || !q.image) return '';
  const src = `/quiz-images/${q.image}`;
  return `
    <div class="pv-pic">
      <a href="${esc(src)}" target="_blank" rel="noopener" title="Open it full size">
        <img class="pv-pic-img" src="${esc(src)}" alt="" loading="lazy"
          onerror="this.closest('.pv-pic').innerHTML='&lt;div class=&quot;pv-pic-none&quot;&gt;No picture for this one yet.&lt;/div&gt;'">
      </a>
    </div>`;
}

/**
 * The button that does something about a lopsided quiz.
 *
 * The read-through has always said "answers land A x15 B x10 — lopsided" and
 * then left you looking at it: the only way to move an answer was to open the
 * editor and retype four options in a different order, twenty times.
 *
 * It rearranges here and leaves Save lit rather than writing straight away, so
 * you can look at what it did, press it again if you do not like the look of
 * it, and close without saving if you would rather it had not.
 *
 * NOT while that quiz is live in front of a room. Saving a quiz reloads it in
 * the running game, so this would swap the options under sixty people who are
 * mid-question — the answer would still be right, but on a different letter to
 * the one on the projector when they read it. It is offered again the moment
 * the game is over.
 */
function evenerButton(body, sub, quiz, markDirty, lopsided) {
  const running = (library && library.running) || null;
  const live = running && running.game === 'quiz' && running.packId === quiz.id
    && running.phase !== 'lobby' && running.phase !== 'finished';

  if (live) {
    return node('<span class="pv-even off" title="Saving a quiz reloads it in the running game">Even out the answers — not while this one is live</span>');
  }

  const button = node(`<button class="pv-even ${lopsided ? 'urge' : ''}" type="button">Even out the answers</button>`);
  button.addEventListener('click', () => {
    const moved = balanceAnswers(quiz);
    if (!moved) {
      button.textContent = 'Nothing to move';
      return;
    }
    markDirty();
    renderQuizPreview(body, sub, quiz, markDirty);
    // Say what happened where the eye already is — the spread line one line up
    // has just changed, and this explains why.
    const again = sub.querySelector('.pv-even');
    if (again) again.textContent = `Moved ${moved} — press Save`;
  });
  return button;
}

function renderBingoPreview(body, sub, pack, markDirty = () => {}) {
  const size = pack.cardSize || 4;
  sub.innerHTML = `${pack.tracks.length} tracks · ${size}&times;${size} card
    ${pack.spotifyPlaylist ? ` · <a href="${esc(pack.spotifyPlaylist.url)}" target="_blank" rel="noopener">Spotify playlist</a>` : ''}`;

  body.replaceChildren(node(`
    <div class="pv-tracks">
      ${pack.tracks.map((t, i) => `
        <div class="pv-track">
          <span class="pv-num">${i + 1}</span>
          <span class="pv-tt">${esc(t.title)}</span>
          <span class="pv-ta">${esc(t.artist || '')}</span>
        </div>`).join('')}
    </div>`));
}

/* =============================================================== PAST GIGS
 *
 * Everything you have run: the date, what you played, how many were in and the
 * photographs from that night.
 *
 * **It is a record of somebody's WORK rather than a feature of the game**, and
 * that is what it is for. A quizmaster pitching for a Thursday at a new venue
 * gets asked what they have done; one page with two years of nights, the packs
 * and the pictures answers it. Both halves were already being written down —
 * the archive when a game ends, the photos as they arrive — and neither was
 * being shown to anybody.
 *
 * **Read only, deliberately.** No bin, no download, no share sheet. Getting
 * pictures out and onto social media is the owner's own tab on the owner's own
 * page; a photo that should not be on the projector is binned from the control
 * view, with a mic in your hand, which is when that actually matters. This is
 * the shelf you look along.
 *
 * The photos come from the private repository through the server, one night at
 * a time and only when a night is opened — a page that fetched every picture of
 * every gig would be several hundred requests to draw a list of dates.
 */
/**
 * THE VENUES YOU PLAY, and what they put up.
 *
 * This is the invoice book's customer list seen from the gig-night side. One
 * record, edited in two places for two jobs: here it is the name and the
 * prizes, on the Invoices tab it is the address and the fee. Two lists of one
 * real-world thing would disagree within a month, which is why this is not a
 * store of its own.
 *
 * Deliberately small. Everything a venue needs for a NIGHT is the name and
 * what they are putting behind the bar — the postal address belongs on an
 * invoice and has no business on a page opened ten minutes before a quiz.
 */
/**
 * WHOSE NIGHT IS TONIGHT — the cheapest diary there is.
 *
 * Asked for as *"the quick launch should remember what you did the previous
 * week"*, and then better: *"or perhaps know which venue from the diary?"*
 * The diary is the right source and is the one thing here that does not exist
 * — `FEATURES.CALENDAR` is on Bronze and still says "Not built yet". But the
 * useful half of a diary is not a list of dates, it is **which venue has you
 * on a Thursday**, and that is one field on a record the quizmaster already
 * keeps. TODO.md had already reasoned to the same place: *"a usual night,
 * optionally, on the customer — which is what turns the list into a
 * calendar"*.
 *
 * Two sources, in this order, and the order is the whole design:
 *
 * 1. **The venue whose usual night is tonight.** Stated by the quizmaster
 *    rather than guessed from history, so it is right on the first week and
 *    right for somebody with two residencies — where "last week" would be
 *    wrong every other night.
 * 2. **Otherwise the venue of your most recent night.** `library.venues` is
 *    already ordered newest-first off the archive, so this is free and it is
 *    the "remember last week" that was asked for. It carries a one-venue host
 *    who has set nothing up at all.
 *
 * **TWO VENUES CLAIMING TONIGHT MEANS NEITHER GETS IT.** Not a double booking
 * — one quizmaster is in one room, so at most one of them is real. It is the
 * APP holding two answers for one night, and picking whichever sorted first
 * would put one pub's prizes in front of another pub's room. Nothing is
 * offered and the picker is left alone, which is exactly what happens today.
 *
 * **6AM ROLL-OVER**, the same as the photos and Past gigs. A quiz that runs
 * past midnight is still Thursday's night, so a host launching a second game
 * at half twelve must not suddenly be offered Friday's pub.
 *
 * Nothing here is silent: the launch bar prints the venue on the button and
 * the pack card shows it in the picker with the prizes underneath. A guess
 * nobody can see is worse than no guess, because the failure it produces —
 * the wrong pub's prize on the winner's phone — surfaces at the end of the
 * night in front of the room.
 */
function tonightsVenue() {
  /*
   * The diary answers this now, which means a ONE-OFF beats a residency: the
   * Tuesday you are standing in somewhere has to win over the Tuesday you
   * normally do and are not doing this week. When this lived here it could
   * only see usual nights, so a diary entry for tonight was invisible to the
   * one control that most needed it.
   */
  return tonight({
    venues: library.venueRecords || [],
    bookings: library.bookings || [],
    playedVenues: library.venues || [],
  });
}

/* ==================================================== HEADCOUNT PER VENUE
 *
 * *"The Crown went from 22 on a Thursday to 58"* — the most persuasive
 * sentence a quizmaster owns, and until now the app knew it and never said it.
 * Every night's headcount has been in the archive since the app was written;
 * nobody had ever seen the number twice.
 *
 * **ONE RECORD, DRAWN TWO WAYS, and the summary line is the same function on
 * both.** `library.headcounts` is worked out once on the server (see
 * `venueHeadcounts`), so the Venues tab and the Gigs tab cannot arrive at two
 * different answers about a number somebody is showing a landlord.
 *
 *  - **A venue card** opens on its own whole history — every night, its
 *    number, and the bar that shows the shape of it.
 *  - **The Gigs tab** puts every venue side by side, because that is where the
 *    work lives and comparing places is what you do there.
 *
 * The bars are `aria-hidden` on purpose: every number they draw is written out
 * next to them, so nothing is carried by a shape alone.
 */

/** This venue's numbers, out of the one record. */
function headsFor(venue) {
  const want = String(venue || '').trim().toLowerCase();
  if (!want) return null;
  return ((library.headcounts || {}).venues || [])
    .find((v) => (v.venue || '').toLowerCase() === want) || null;
}

/**
 * The sentence, and it is deliberately the whole of what the numbers say.
 *
 * "22 → 58" first and loudest, because the growth is the argument. The rest is
 * the supporting detail somebody quotes when a landlord pushes back — and it
 * is left off a venue with one night, where "best" and "on average" are three
 * ways of printing the same number.
 */
function headcountLine(entry) {
  if (entry.nights < 2) {
    return `<div class="heads-line"><b class="heads-big">${entry.latest.players} playing</b>
      <span class="tiny">one night so far</span></div>`;
  }
  return `<div class="heads-line">
    <b class="heads-big">${entry.first.players} <span class="heads-arrow">→</span> ${entry.latest.players}</b>
    <span class="tiny">across ${entry.nights} nights · best ${entry.best} · ${entry.average} on average</span>
  </div>`;
}

/** The last dozen nights as a shape, newest on the right, for the Gigs tab. */
function headcountSpark(entry) {
  if (entry.nights < 2) return '';
  const shown = entry.series.slice(-12);
  return `<div class="heads-spark" aria-hidden="true">${shown.map((n) => `
    <span style="height:${Math.max(8, Math.round((n.players / entry.best) * 100))}%"></span>`).join('')}</div>`;
}

/**
 * EVERY NIGHT AT ONE VENUE, newest first.
 *
 * Newest first like every other list of nights in this app, and the bar is
 * what makes it a trend rather than a column of numbers. It scrolls past a
 * dozen rather than being cut off at one: a residency of two years is a
 * hundred nights, and "and 88 earlier" on the page whose whole job is showing
 * somebody your work is the wrong half to keep.
 */
function headcountHistory(entry) {
  const rows = [...entry.series].reverse();
  return `<div class="heads-nights">${rows.map((n) => `
    <div class="heads-night">
      <span class="hn-when">${esc(shortNight(n.night))}</span>
      <span class="hn-bar" aria-hidden="true"><i style="width:${Math.max(4, Math.round((n.players / entry.best) * 100))}%"></i></span>
      <span class="hn-num">${n.players}</span>
    </div>`).join('')}</div>`;
}

/** "Thu 13 Aug", and the year only when it is not this one. */
function shortNight(date) {
  const when = new Date(date + 'T12:00:00');
  const opts = { weekday: 'short', day: 'numeric', month: 'short' };
  if (when.getFullYear() !== new Date().getFullYear()) opts.year = 'numeric';
  return when.toLocaleDateString('en-GB', opts);
}

/** What a venue card shows about how many have played there. */
function headcountBlock(venue) {
  const entry = headsFor(venue);
  if (!entry) {
    return `<div class="heads">
      <div class="heads-tag">Headcount</div>
      <div class="tiny">No nights recorded here yet.</div>
    </div>`;
  }
  return `<div class="heads">
    <div class="heads-tag">Headcount</div>
    ${headcountLine(entry)}
    ${headcountHistory(entry)}
  </div>`;
}

/**
 * THE GIGS TAB'S PANEL — every venue, and which way each is going.
 *
 * Between the diary and Past gigs: what is coming is the thing you act on,
 * this is the thing you show somebody, and the long list of nights sits under
 * both. Not drawn at all when there is nothing to say, because an empty panel
 * on a tab is the clutter this app's own rules argue against.
 */
function headcountsSection() {
  const heads = library.headcounts || { venues: [], unplaced: 0 };
  if (!heads.venues.length && !heads.unplaced) return document.createDocumentFragment();
  return node(`
    <div class="game-section">
      <div class="game-head">
        <div>
          <h2>Headcount</h2>
          <div class="tiny">How many played at each venue, and which way it is going.</div>
        </div>
      </div>
      <div class="heads-list">
        ${heads.venues.map((v) => `
          <div class="heads-venue">
            <div class="heads-who"><b>${esc(v.venue)}</b>${headcountLine(v)}</div>
            ${headcountSpark(v)}
          </div>`).join('')}
      </div>
      ${!heads.unplaced ? '' : `<div class="tiny heads-unplaced">${heads.unplaced}
        night${heads.unplaced === 1 ? ' is' : 's are'} not filed under a venue.
        Type one at launch and ${heads.unplaced === 1 ? 'it counts' : 'they count'} here.</div>`}
    </div>`);
}

/**
 * WHAT THE ROOM ASKED FOR — yes or no, and no is a delete.
 *
 * The people who played, asking for what they want next time, from their own
 * phones at the end of the night. A separate box from the quizmasters' one:
 * that is subscribers writing to the owner and is read as a work queue with
 * somebody waiting for a reply, and strangers' one-liners from a pub would
 * bury it.
 *
 * **THE TRIAGE IS THE FEATURE.** The host's own shape: a bad idea is one tap
 * and gone for ever, a good one moves to the list of things worth writing.
 * That is this file's Monday rule applied — a queue that shrinks as you work
 * it costs a fraction of one that only grows — and it is why there is no
 * "rejected" state to browse.
 *
 * Grouped by idea, most-asked first, because four people wanting reggae is a
 * different fact from one person asking four times, and it is the number that
 * decides whether it is worth a pack.
 */
function asksPanel() {
  const el = node('<div></div>');
  const draw = (data) => {
    const asked = data.asked || [];
    const kept = data.kept || [];
    if (!asked.length && !kept.length) { el.replaceChildren(); return; }
    el.replaceChildren(node(`
      <div class="panel asks">
        <h3>What the room asked for</h3>
        <div class="tiny">From the phones that played. Yes keeps it on the list; No bins it.</div>
        ${!asked.length ? '' : `<div class="ask-rows">
          ${asked.map((a) => `
            <div class="ask-row" data-ids="${esc(a.ids.join(','))}">
              <div class="ask-what">
                <b>${esc(a.text)}</b>
                ${a.count > 1 ? `<span class="ask-count">×${a.count}</span>` : ''}
                ${a.venues.length ? `<div class="tiny">${esc(a.venues.join(' · '))}</div>` : ''}
              </div>
              <div class="ask-do">
                <button class="minor ask-yes">Yes</button>
                <button class="minor danger ask-no">No</button>
              </div>
            </div>`).join('')}
        </div>`}
        ${!kept.length ? '' : `
          <div class="tiny asks-kept-head">Worth doing</div>
          <div class="ask-rows kept">
            ${kept.map((k) => `
              <div class="ask-row" data-ids="${esc(k.ids.join(','))}">
                <div class="ask-what"><b>${esc(k.text)}</b>${
  k.count > 1 ? `<span class="ask-count">×${k.count}</span>` : ''}</div>
                <div class="ask-do"><button class="minor ask-done" title="Written — take it off the list">Done</button></div>
              </div>`).join('')}
          </div>`}
      </div>`));

    for (const row of el.querySelectorAll('.ask-row')) {
      const ids = (row.dataset.ids || '').split(',').filter(Boolean);
      const send = async (method, path) => {
        // A grouped row is several rows underneath — all of them move together,
        // because saying yes to "a reggae round" twice is not two decisions.
        let latest = data;
        for (const id of ids) {
          const res = await fetch(keyed(`/api/asks/${encodeURIComponent(id)}${path}`), { method });
          if (res.ok) latest = await res.json();
        }
        draw(latest);
      };
      row.querySelector('.ask-yes')?.addEventListener('click', () => send('POST', '/keep'));
      row.querySelector('.ask-no')?.addEventListener('click', () => send('DELETE', ''));
      row.querySelector('.ask-done')?.addEventListener('click', () => send('DELETE', ''));
    }
  };

  (async () => {
    try {
      const res = await fetch(keyed('/api/asks'));
      if (res.ok) draw(await res.json());
    } catch (err) {
      // Say why. A swallowed error here is a panel that silently is not there,
      // which is exactly the fault this file records about the console's own
      // loader: failure messages have to name the cause.
      console.error('[asks] could not load them:', err);
    }
  })();
  return el;
}

/**
 * WHICH VENUE IS OPEN, remembered outside the render.
 *
 * Module level for the same reason `openPack` is: this list is redrawn after
 * every save, and a selection stored inside `draw()` would close the card you
 * had just opened the moment you typed a prize into it.
 */
let openVenue = '';
let venueQuery = '';

/**
 * SHRINK A LOGO IN THE BROWSER, before it is ever sent.
 *
 * A venue's logo arrives as whatever they had — a 3MB PNG off their website is
 * the normal case. It is stored as a data URL on the venue record, which is
 * what makes it need no upload endpoint, no file store and no new backup path;
 * and that is only affordable while it is SMALL, because the record travels in
 * every console payload.
 *
 * So the browser does the work: draw it onto a canvas no bigger than 128px on
 * its longest side and read it back. The same approach `filters.js` already
 * uses for photos, and for the same reason — no dependency, and it works on
 * the phones this app actually meets.
 *
 * PNG rather than JPEG: a logo is flat colour with hard edges, which JPEG
 * turns to soup at small sizes, and transparency has to survive or a
 * transparent PNG comes back with a black square behind it.
 *
 * It refuses rather than silently sending something too big — the server caps
 * it too and would drop it, and a logo that vanishes without a word is worse
 * than one that says why.
 */
/* Shared with src/invoices.js, which caps it on the way in. */
const MAX_REWARDS = 20;

const LOGO_PX = 128;
const MAX_LOGO_BYTES = 64 * 1024;
/*
 * An advert picture is going on a PROJECTOR rather than a phone, so it gets a
 * bigger allowance — but still a capped one, because the slide's image travels
 * in the screen payload for as long as the advert is up. It is only ever shown
 * between rounds, when nothing is pushing state every second, which is what
 * makes a few hundred kilobytes affordable here and not on a question.
 */
const ADVERT_PX = 900;
const MAX_ADVERT_BYTES = 300 * 1024;

/**
 * One shrink, two sizes.
 *
 * PNG when the source is a PNG, JPEG otherwise, and that is not fussiness: an
 * advert slide sits on a DARK background, so a graphic with transparency
 * flattened onto white would arrive as a white box six feet wide. Photographs
 * are the common case for a venue's slide and JPEG is right for those.
 */
function shrinkImage(file, { px, maxBytes, tooBig }) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read that file.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('That does not look like an image.'));
      img.onload = () => {
        const scale = Math.min(1, px / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        // No fill, so transparency survives where the format keeps it.
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        const png = String(file.type || '').includes('png');
        const out = png ? canvas.toDataURL('image/png') : canvas.toDataURL('image/jpeg', 0.82);
        if (out.length > maxBytes) { reject(new Error(tooBig)); return; }
        resolve(out);
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

const shrinkLogo = (file) => shrinkImage(file, {
  px: LOGO_PX, maxBytes: MAX_LOGO_BYTES,
  tooBig: 'That logo is too detailed to store. A simpler or smaller one will work.',
});

const shrinkAdvertImage = (file) => shrinkImage(file, {
  px: ADVERT_PX, maxBytes: MAX_ADVERT_BYTES,
  tooBig: 'That picture is too big to put on the screen. A smaller one will work.',
});



/**
 * THEIR ADVERTS, on the venue's own card — as a DOOR, never a second editor.
 *
 * Asked for directly: *"the venues need to have adverts in the venues tab as
 * well because those adverts are gonna be venue specific."* Right, and the
 * shape matters — two places that EDIT one thing is how they end up
 * disagreeing, which is the same fault that took the venue picker out of Set
 * it up. So this says what the venue has and takes you to the one editor.
 *
 * Silent when the venue has none rather than showing an empty box with an
 * invitation in it: most venues have no slides, and a permanent "no adverts
 * yet" on every card is a wall you scroll past.
 *
 * Matched on the venue NAME, lowercased, which is how a slide set records
 * which venue it belongs to — the same key `venuesUsed` and the headcounts
 * already use, so a venue typed in two cases is still one venue.
 */
function advertsForVenue(name) {
  if (!can(FEATURES.ADVERTS)) return '';
  const key = String(name || '').trim().toLowerCase();
  if (!key) return '';
  const sets = (library.adverts || []).filter(
    (a) => String(a.venue || '').trim().toLowerCase() === key);
  if (!sets.length) return '';
  const slides = sets.flatMap((a) => a.slides || []);
  return `
    <div class="venue-ads">
      <div class="venue-ads-tag">Their adverts</div>
      ${slides.slice(0, 4).map((sl) => `
        <div class="tiny venue-ads-line">${esc(sl.heading || '(no heading)')}</div>`).join('')}
      ${slides.length > 4 ? `<div class="tiny venue-ads-line">and ${slides.length - 4} more</div>` : ''}
      <a class="minor" href="?tab=adverts&amp;set=${encodeURIComponent(sets[0].id)}">Edit their slides</a>
    </div>`;
}

/**
 * "1st", "2nd", "3rd", "11th", "21st" — for a prize list of any length.
 *
 * Written out rather than a lookup because a venue may put up twenty, and the
 * three that used to be hard-coded were a lookup table with exactly three
 * entries in it.
 */
function placeLabel(n) {
  const v = n % 100;
  const suffix = (v >= 11 && v <= 13) ? 'th' : (['th', 'st', 'nd', 'rd'][n % 10] || 'th');
  return `${n}${suffix}`;
}

function venuesSection() {
  const el = node('<div></div>');
  const draw = () => {
    const all = library.venueRecords || [];
    /*
     * SEARCH AND COLLAPSE, for the same reason the pack grid got them: a
     * quizmaster with fifteen residencies had fifteen cards each carrying a
     * usual-night dropdown and three prize boxes, which is a wall you scroll
     * rather than a list you use. Closed, a venue is its name and the two
     * facts you scan for — which night it has you, and what it puts up.
     *
     * The search matches the NAME only. A venue list is short enough that
     * matching anything else would only ever surprise somebody — unlike the
     * pack search, which looks inside the questions because "the one with
     * Madonna in it" is a real way to look for a quiz.
     */
    const q = venueQuery.trim().toLowerCase();
    const venues = q ? all.filter((v) => (v.name || '').toLowerCase().includes(q)) : all;
    el.replaceChildren(node(`
      <div class="panel">
        <h3>Venues</h3>
        <div class="tiny">Set the prizes here and they fill themselves in when you
          launch a night at this venue. Give a venue its usual night and the
          launch bar knows whose night tonight is — and the big screen ends the
          night with “Back here Thursday 20th”, worked out from it. The billing
          details for the same venues are on the Invoices tab.</div>
        ${all.length > 4 ? `
          <div class="venue-tools">
            <input class="pack-search venue-search" type="search" placeholder="Search ${all.length}…"
              value="${esc(venueQuery)}" aria-label="Search venues">
          </div>` : ''}
        <div class="venue-list">
          ${!all.length ? '<div class="tiny">No venues yet. Add one below, or on the Invoices tab.</div>'
    : !venues.length ? `<div class="tiny">Nothing matches “${esc(venueQuery)}”.</div>`
      : venues.map((v) => {
        const open = openVenue === v.id;
        const night = (WEEKDAY_LABELS.find(([id]) => id === v.usualNight) || [])[1] || '';
        const prizes = (v.rewards || []).filter(Boolean);
        return `
            <div class="venue-card ${open ? 'open' : 'shut'}" data-id="${esc(v.id)}">
              <div class="venue-top">
                <button class="venue-name" aria-expanded="${open ? 'true' : 'false'}">${esc(v.name)}</button>
                ${open ? '<button class="minor danger v-del">Remove</button>' : ''}
              </div>
              ${open ? '' : `<div class="tiny venue-gist">${
  esc([night || 'No usual night', prizes.length ? prizes[0] : 'No prizes set'].join(' · '))}</div>`}
              ${!open ? '' : `
              <label class="venue-night">Usual night
                <select class="v-night">
                  <option value="">No usual night</option>
                  ${WEEKDAY_LABELS.map(([id, label]) => `
                    <option value="${id}" ${v.usualNight === id ? 'selected' : ''}>${esc(label)}</option>`).join('')}
                </select>
              </label>
              <!--
                WHERE TO SEND THE ROOM at the end of the night, as a QR on the
                last slide. Labelled by the JOB rather than by the field —
                "Link" would need a sentence under it explaining what it is
                for, and a control that needs explaining is the wrong control.
              -->
              <label class="venue-night venue-link">Where to send them
                <input class="v-link" type="url" inputmode="url" maxlength="300"
                  value="${esc(v.link || '')}" placeholder="thecrown.co.uk/whats-on">
              </label>
              <!-- THE VENUE'S OWN LOGO, for the winner's voucher. Beside the
                   prizes because it is the same kind of thing: the venue's
                   standing arrangement rather than a decision about tonight.
                   Its blurb says WHERE it appears, because a picture upload
                   with no stated destination is a control nobody trusts. -->
              <div class="venue-logo-row">
                <span class="venue-logo-what">
                  <b>Their logo</b><br>
                  <!-- IT SAYS YOU CAN PHOTOGRAPH IT, because you always could
                       and nothing said so: accept=image/* offers Take
                       Photo alongside the library on every phone. The host's
                       own case is the one worth naming — a new venue that
                       cannot be bothered to send artwork, and a picture of the
                       front of the pub does the job until they do. It is also
                       TRUE in a way a generated wordmark would not be, which
                       is why there is no auto-filled placeholder: a logo the
                       pub never approved, printed on a credential, is worse
                       than a clean card with no picture on it. -->
                  <span class="tiny">Goes on the winner&rsquo;s phone, above the code,
                    so the voucher looks like the pub&rsquo;s own. No artwork yet?
                    Photograph the front of the pub &mdash; it does the job until
                    they send you something better.</span>
                </span>
                <span class="venue-logo-side">
                  ${v.logo ? `<img class="venue-logo-pic" alt="" src="${esc(v.logo)}">` : ''}
                  <label class="minor venue-logo-pick">${v.logo ? 'Change' : 'Add or take one'}
                    <input class="v-logo" type="file" accept="image/*" hidden>
                  </label>
                  ${v.logo ? '<button class="minor danger v-logo-off">Remove</button>' : ''}
                </span>
              </div>
              ${advertsForVenue(v.name)}
              <!-- AS MANY PRIZES AS THE VENUE ACTUALLY PUTS UP.
                   It was three fixed boxes, because a pub quiz pays first,
                   second and third — the common case mistaken for the rule.
                   A charity night hands out a table of them and a quiet
                   Tuesday puts up one, so the list is whatever length it needs
                   with a row added and taken away by hand.
                   A venue with none still shows ONE empty box: nought boxes
                   and an "Add a prize" button makes you press something before
                   you can type, on the field this card exists for. -->
              <div class="venue-prizes">
                ${(((v.rewards || []).length ? v.rewards : ['']).map((prize, i) => `
                  <label class="reward-row" data-place="${i + 1}">
                    <span class="reward-place">${esc(placeLabel(i + 1))}</span>
                    <input class="v-reward" data-i="${i}" type="text" maxlength="80"
                      value="${esc(prize || '')}"
                      placeholder="${i === 0 ? 'A free drink at the bar' : 'Nothing for this place'}">
                    <button class="reward-off" type="button" aria-label="Remove this prize">&times;</button>
                  </label>`)).join('')}
              </div>
              <button class="minor v-reward-add" type="button">Add a prize</button>
              <button class="minor v-save" hidden>Save it</button>
              ${can(FEATURES.PAST_GIGS) ? headcountBlock(v.name) : ''}`}
            </div>`;
      }).join('')}
        </div>
        <div class="venue-add">
          <input class="venue-new" type="text" maxlength="60" placeholder="The Station Tap, Wokingham">
          <button class="role-make venue-add-go">Add a venue</button>
        </div>
      </div>`));

    // Save only appears once something has changed, so a page of venues is not
    // a page of buttons waiting to be pressed for no reason.
    /*
     * The search box, and the name that opens a card.
     *
     * `venueQuery` and `openVenue` are module-level, so both survive the
     * redraw that every save triggers — the same reason the pack grid keeps
     * its selection outside the render.
     */
    const search = el.querySelector('.venue-search');
    if (search) {
      search.addEventListener('input', () => {
        venueQuery = search.value;
        draw();
        // Redrawn from scratch, so the box the thumb is in has to be found
        // again and the caret put back at the end of what was typed.
        const again = el.querySelector('.venue-search');
        if (again) { again.focus(); again.setSelectionRange(again.value.length, again.value.length); }
      });
    }

    for (const card of el.querySelectorAll('.venue-card')) {
      card.querySelector('.venue-name').addEventListener('click', () => {
        openVenue = openVenue === card.dataset.id ? '' : card.dataset.id;
        draw();
      });
      /*
       * DRAG A VENUE UP TO TONIGHT. Same gesture as a pack card, same target.
       *
       * Only a SHUT card is draggable: an open one is full of prize boxes and
       * a usual-night dropdown, and `draggable` on their container stops you
       * selecting a word to retype it — the same reason a pack card is dragged
       * by a grip rather than by the whole card.
       */
      const shut = card.classList.contains('shut');
      card.draggable = shut;
      if (shut) {
        const record = venues.find((v) => v.id === card.dataset.id) || {};
        card.addEventListener('dragstart', (ev) => {
          venueDrag = { id: card.dataset.id, name: record.name || '' };
          ev.dataTransfer.effectAllowed = 'copy';
          ev.dataTransfer.setData('text/plain', record.name || '');
          card.classList.add('is-dragging');
          dragging(true);
        });
        card.addEventListener('dragend', () => {
          venueDrag = null;
          card.classList.remove('is-dragging');
          dragging(false);
          document.querySelector('.launchbar')?.classList.remove('drop-here');
        });
      }
      const save = card.querySelector('.v-save');
      // A shut card has no controls to wire — its name and its one line are
      // the whole of it.
      if (!save) continue;
      for (const box of card.querySelectorAll('.v-reward, .v-night, .v-link')) {
        box.addEventListener('input', () => { save.hidden = false; });
        box.addEventListener('change', () => { save.hidden = false; });
      }
      /*
       * ADDING AND REMOVING A PRIZE, in the page rather than by re-rendering.
       *
       * The card is redrawn from the RECORD, so a redraw here would throw away
       * everything typed since the last save — and adding a fourth prize is
       * exactly the moment somebody has three unsaved boxes in front of them.
       * The rows are renumbered afterwards, or removing the second leaves a
       * list reading 1st, 3rd, 4th.
       */
      const prizes = card.querySelector('.venue-prizes');
      const renumber = () => {
        [...prizes.querySelectorAll('.reward-row')].forEach((row, i) => {
          row.dataset.place = String(i + 1);
          row.querySelector('.reward-place').textContent = placeLabel(i + 1);
          row.querySelector('.v-reward').dataset.i = String(i);
        });
      };
      prizes.addEventListener('click', (ev) => {
        const off = ev.target.closest('.reward-off');
        if (!off) return;
        // Never nought rows: the last one empties rather than disappearing, so
        // the card cannot end up with nothing to type in.
        if (prizes.querySelectorAll('.reward-row').length <= 1) {
          prizes.querySelector('.v-reward').value = '';
        } else {
          off.closest('.reward-row').remove();
          renumber();
        }
        save.hidden = false;
      });
      card.querySelector('.v-reward-add')?.addEventListener('click', () => {
        const rows = prizes.querySelectorAll('.reward-row').length;
        if (rows >= MAX_REWARDS) return;
        const at = rows + 1;
        const row = node(`
          <label class="reward-row" data-place="${at}">
            <span class="reward-place">${esc(placeLabel(at))}</span>
            <input class="v-reward" data-i="${at - 1}" type="text" maxlength="80"
              placeholder="Nothing for this place">
            <button class="reward-off" type="button" aria-label="Remove this prize">&times;</button>
          </label>`);
        prizes.appendChild(row);
        const box = row.querySelector('.v-reward');
        box.addEventListener('input', () => { save.hidden = false; });
        box.focus();
        save.hidden = false;
      });
      /*
       * The logo saves ON ITS OWN rather than waiting for "Save it".
       *
       * Picking a file is a finished act — there is nothing to type afterwards
       * and nothing to get right — so making somebody press a second button
       * for it is a step that only exists to be forgotten. The prizes and the
       * usual night are different: those are typed, and a save button is what
       * says the typing has landed.
       */
      const logoPick = card.querySelector('.v-logo');
      const saveLogo = async (logo) => {
        try {
          await invoiceApi(`/api/invoices/customers/${encodeURIComponent(card.dataset.id)}/rewards`, {
            method: 'PUT',
            // ONLY the logo. `setVenueDetails` writes what it is sent, so this
            // cannot touch prizes somebody is halfway through editing.
            body: JSON.stringify({ logo }),
          });
          await load();
        } catch (err) {
          alert(err.message || 'Could not save that.');
        }
      };
      logoPick?.addEventListener('change', async () => {
        const file = logoPick.files && logoPick.files[0];
        if (!file) return;
        try {
          await saveLogo(await shrinkLogo(file));
        } catch (err) {
          alert(err.message || 'Could not use that image.');
        }
      });
      card.querySelector('.v-logo-off')?.addEventListener('click', () => saveLogo(''));
      save.addEventListener('click', async () => {
        save.disabled = true;
        save.textContent = 'Saving…';
        const id = card.dataset.id;
        /*
         * Trailing blanks are dropped: an empty row somebody added and did not
         * fill in is not a prize, and storing it would put a nameless 4th place
         * on the lobby slide. A blank in the MIDDLE is kept, because "nothing
         * for second, something for third" is a real arrangement — the same
         * rule `rewardList()` in the engine already follows.
         */
        const rewards = [...card.querySelectorAll('.v-reward')].map((b) => b.value.trim());
        while (rewards.length && !rewards[rewards.length - 1]) rewards.pop();
        const usualNight = card.querySelector('.v-night').value;
        const link = card.querySelector('.v-link').value.trim();
        try {
          await invoiceApi(`/api/invoices/customers/${encodeURIComponent(id)}/rewards`, {
            method: 'PUT',
            // All three every time from THIS card, which is safe because the
            // card was drawn from the record — `setVenueDetails` only writes
            // what it is sent, and what it is sent here is what is on screen.
            body: JSON.stringify({ rewards, usualNight, link }),
          });
          await load();
        } catch (err) {
          save.disabled = false;
          save.textContent = 'Save it';
          alert(err.message || 'Could not save that.');
        }
      });
      card.querySelector('.v-del')?.addEventListener('click', async () => {
        if (!confirm('Remove this venue? Invoices already sent keep their own copy.')) return;
        await invoiceApi(`/api/invoices/customers/${encodeURIComponent(card.dataset.id)}`, { method: 'DELETE' });
        await load();
      });
    }

    const add = el.querySelector('.venue-add-go');
    add.addEventListener('click', async () => {
      const name = el.querySelector('.venue-new').value.trim();
      if (!name) return;
      add.disabled = true;
      try {
        await invoiceApi('/api/invoices/customers', { method: 'POST', body: JSON.stringify({ name, rewards: [] }) });
        await load();
      } catch (err) {
        add.disabled = false;
        alert(err.message || 'Could not add that.');
      }
    });
  };
  draw();
  return el;
}

/**
 * GIGS — what is coming, then what has been.
 *
 * Coming up FIRST, because it is the one you act on: a night you have not run
 * yet can still be moved, cancelled or prepared for, where a night you have
 * run is a record. Past gigs is also the half somebody scrolls at length when
 * they are showing a venue their work, and a long list belongs under a short
 * one rather than over it.
 */

/**
 * WHAT THE GENERATOR REFUSES TO REPEAT — and the only way to clear it.
 *
 * `src/history.js` remembers every track the bingo generator has ever used, so
 * a room never gets the same song twice in three months. `/api/history/forget`
 * empties it and has existed since that was written **with no button anywhere
 * in the app** — found by walking every route against every caller in the
 * browser code. A function nothing can reach is a function that does not
 * exist.
 *
 * It matters after a year or two rather than on day one: the list grows, the
 * generator starts dropping more and more as "played recently", and eventually
 * a fresh venue or a new season wants a clean slate. Until now the only way
 * was to delete a file on the server.
 *
 * **THE OWNER'S ONLY, because the memory is GLOBAL** — one file for the whole
 * app, not one per room, since the generator is the owner's and runs on the
 * owner's bill. A quizmaster clearing it would be clearing everybody's.
 *
 * Behind a confirm that says what is lost, because the cost is real and
 * invisible: nothing looks different afterwards, and the next few packs
 * quietly start repeating songs a room heard last month.
 */

/**
 * WHAT IS ON THE SCREEN, AND WHAT IS NEXT.
 *
 * The running panel already said where the night had got to. This says what
 * the room is looking at and what pressing onwards would put in front of them
 * — a different question, and the one you want answered before you walk back
 * to the laptop.
 *
 * Quiz only: bingo's next track is picked off a call sheet by hand, so there
 * is nothing to predict and a guess would be worse than silence. The server
 * sends `null` for it and this draws nothing.
 *
 * The question and the answer are here because this is the HOST'S own page —
 * the same reason the control view carries them. Rule 1 is about the projector
 * and a player's phone.
 */
function nowNextRows(running) {
  const at = running.onScreen;
  if (!at || !at.now) return '';
  const row = (tag, label, text) => `
    <div class="nn-row">
      <span class="nn-tag">${tag}</span>
      <span class="nn-what"><b>${esc(label)}</b>${text ? `<br><span class="tiny">${esc(text)}</span>` : ''}</span>
    </div>`;
  return `<div class="now-next">
    ${row('Now', at.now, at.nowText)}
    ${at.next ? row('Next', at.next, at.nextText) : ''}
  </div>`;
}

function forgetPanel() {
  const el = node(`
    <div class="panel">
      <h3>Songs it will not repeat</h3>
      <div class="tiny">Every track the generator has used is remembered, so no room
        hears the same song twice in three months. Clearing it starts that memory
        again \u2014 useful for a new venue or a new year, and nothing else changes.</div>
      <button class="minor danger forget-go">Clear the memory</button>
      <div class="tiny forget-said"></div>
    </div>`);
  const said = el.querySelector('.forget-said');
  el.querySelector('.forget-go').addEventListener('click', async (ev) => {
    if (!confirm('Clear what the generator remembers?\n\nEvery track becomes fair game again, '
      + 'so a room could hear a song it heard last month. This cannot be undone.')) return;
    const btn = ev.currentTarget;
    btn.disabled = true;
    try {
      await postJson('/api/history/forget', {}, { 'X-Host-Key': hostKey });
      said.textContent = 'Cleared. The next pack can use anything.';
    } catch (err) {
      said.style.color = 'var(--bad)';
      said.textContent = err.message || 'Could not clear it.';
    }
    btn.disabled = false;
  });
  return el;
}

function gigsSection() {
  const wrap = document.createDocumentFragment();
  /*
   * THE DIARY MOVED OUT, and the reason is the host not being able to find it.
   *
   * This file used to record a deliberate decision to keep Gigs whole — it
   * sits at both ends of the journey, holding what is coming and what has
   * been, and splitting it added a tenth tab to a bar that already scrolls on
   * a phone. That reasoning was sound and the outcome was still wrong: *"we
   * need to have a calendar added because I don't know where to find the
   * calendar right now."* It was built, it worked, and it was invisible.
   *
   * A tab bar is a list of places somebody looks for things. Being tidy is
   * worth less than being findable, and the person who wrote the tidy version
   * could not find his own diary.
   */
  /*
   * The numbers sit BETWEEN the two, and the order is the same argument the
   * rest of this tab is built on: what is coming is what you act on, the
   * headcounts are what you show a landlord, and the night-by-night list is
   * the long thing you scroll — so it goes under both.
   */
  wrap.appendChild(headcountsSection());
  wrap.appendChild(pastGigsSection());
  return wrap;
}

/**
 * The diary.
 *
 * **ALMOST ALL OF IT IS DERIVED AND THAT IS THE POINT.** The recurring nights
 * come out of the usual nights already set on the Venues tab, projected six
 * weeks forward by `upcoming()` — so a quizmaster with their residencies set
 * up has a working diary having typed nothing, and it can never go stale
 * because there is nothing to keep up. A feature's real price here is the
 * admin it creates on a Monday, and a diary of dates somebody has to maintain
 * is the most expensive shape this could have taken.
 *
 * So the only things typed are the two a pattern cannot express: a one-off
 * somewhere, and a night off.
 *
 * ---
 *
 * **THE MONTH SITS LEFT AND EVERYTHING ELSE HAPPENS ON THE RIGHT**, asked for
 * directly: *"perhaps the calendar needs to sit off to the left in the section
 * to allow room for the right to populate?"* It is the right shape, and it
 * fixes a real fault rather than only looking tidier. Full width, the month
 * was seven columns of mostly-empty boxes across a laptop, and what answered a
 * date was a thin strip UNDER it — so picking the 23rd pushed the thing you
 * wanted below the fold, and the form it sent you to was below that again.
 * Beside it, a date and what you can do about it are one glance.
 *
 * **THERE IS ONE PLACE A NIGHT IS ADDED, AND IT IS THE DATE YOU PICKED.** The
 * bottom of this tab used to carry its own date box, venue and Add a night —
 * a second control for a job the month already does, which is exactly how a
 * booking lands on the date the other one happened to be showing. **Book a
 * quiz** now opens the whole form against the date in the heading: *"perhaps
 * when you click 'book a quiz' it just asks for all quiz info like venue, time
 * etc."*
 */
function diarySection() {
  const el = node(`
    <div class="game-section">
      <div class="game-head">
        <div>
          <h2>Coming up</h2>
          <div class="tiny">The next four weeks, from the usual nights on your Venues tab.
            Pick a date to book anything that is not your usual.</div>
        </div>
      </div>
      <!-- THE MONTH, because "book a quiz on the 23rd" needs a 23rd to click.
           The panel beside it answers a different question — what is next — and
           both were rendered side by side before choosing: a list can only
           ever offer actions on nights that ALREADY exist. -->
      <div class="cal-wrap">
        <div class="cal-left">
          <div class="cal-head">
            <button class="minor cal-prev" type="button" aria-label="The month before">&larr;</button>
            <b class="cal-month"></b>
            <button class="minor cal-next" type="button" aria-label="The month after">&rarr;</button>
            <button class="minor cal-today" type="button">Today</button>
          </div>
          <div class="cal-days"></div>
          <div class="cal-grid"></div>
        </div>
        <div class="cal-side"></div>
      </div>
      <!-- YOUR NIGHTS IN YOUR OWN CALENDAR. A residency that exists only in
           this app is a residency you double-book yourself over. -->
      <div class="cal-feed">
        <div class="tiny"><b>Put these in your own calendar.</b>
          Subscribe once and every night keeps itself up to date — in Google,
          Apple or Outlook, on your phone and your laptop.</div>
        <div class="cal-feed-row">
          <input class="cal-url" type="text" readonly aria-label="Your calendar address">
          <button class="minor cal-copy" type="button">Copy</button>
          <button class="minor danger cal-roll" type="button" title="Stop every calendar that has this address">New address</button>
        </div>
        <div class="tiny cal-feed-said"></div>
      </div>
    </div>`);

  /*
   * THE MONTH GRID.
   *
   * `upcoming()` already knows how to turn residencies plus one-offs minus
   * nights off into a list of nights — it simply starts from today. Asked for
   * an arbitrary month it does the same job: hand it the first of the month
   * and six weeks, then keep what falls inside. One source, so the grid, the
   * panel beside it and Tonight can never disagree about whose night a
   * Thursday is.
   */
  const gridEl = el.querySelector('.cal-grid');
  const daysEl = el.querySelector('.cal-days');
  const sideEl = el.querySelector('.cal-side');
  const monthEl = el.querySelector('.cal-month');
  const today = new Date();
  let shown = new Date(today.getFullYear(), today.getMonth(), 1);
  let picked = '';
  /*
   * Whether the booking form is open in the right-hand panel. Held out here
   * rather than read off the DOM because the panel is rebuilt every time
   * anything is saved — a form that shut itself the moment you added a night
   * would make adding a second one a hunt for the button again.
   */
  let booking = false;
  // What the month grid worked out, so the panel beside it reads the SAME
  // answer rather than asking `upcoming()` a second question with a second
  // clock in it.
  let onByDate = new Map();

  const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  const drawMonth = () => {
    const first = new Date(shown.getFullYear(), shown.getMonth(), 1);
    const last = new Date(shown.getFullYear(), shown.getMonth() + 1, 0);
    monthEl.textContent = first.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });

    // Monday first, which is how a week reads to anybody working in a pub.
    daysEl.replaceChildren(...['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
      .map((d) => node(`<span class="cal-day">${d}</span>`)));

    const nights = upcoming({
      venues: library.venueRecords || [],
      bookings: library.bookings || [],
      now: first.getTime(),
      weeks: 6,
    });
    onByDate = new Map();
    for (const n of nights) {
      if (!onByDate.has(n.date)) onByDate.set(n.date, []);
      onByDate.get(n.date).push(n);
    }

    const cells = [];
    // getDay() is 0 for Sunday; Monday-first means Sunday sits at the end.
    const lead = (first.getDay() + 6) % 7;
    for (let i = 0; i < lead; i++) cells.push(node('<div class="cal-cell is-blank"></div>'));
    for (let d = 1; d <= last.getDate(); d++) {
      const date = iso(new Date(shown.getFullYear(), shown.getMonth(), d));
      const on = onByDate.get(date) || [];
      const cell = node(`
        <button class="cal-cell ${on.length ? 'has' : ''} ${date === iso(today) ? 'is-today' : ''} ${date === picked ? 'open' : ''}"
          type="button" data-date="${date}">
          <span class="cal-num">${d}</span>
          ${on.slice(0, 2).map((n) => `<span class="cal-dot ${n.why === 'booked' ? 'one' : ''}">${esc(n.venue)}</span>`).join('')}
          ${on.length > 2 ? `<span class="cal-dot more">and ${on.length - 2} more</span>` : ''}
        </button>`);
      cell.addEventListener('click', () => {
        picked = picked === date ? '' : date;
        // A different date is a different question, so a half-filled form for
        // the 23rd must not be handed to the 24th with a venue still in it.
        booking = false;
        drawMonth();
        /*
         * ON A PHONE THE PANEL IS UNDER THE MONTH, so picking a date puts the
         * answer off the bottom of the screen — the exact fault the two
         * columns fix on a laptop, arriving on the device this is most often
         * held on. Only while it is stacked: side by side it is already next
         * to your thumb, and scrolling would be the page moving for nothing.
         */
        if (picked && window.matchMedia('(max-width: 899px)').matches) {
          sideEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }
      });
      cells.push(cell);
    }
    gridEl.replaceChildren(...cells);
    drawSide();
  };

  /*
   * THE RIGHT-HAND PANEL — the diary when no date is picked, and that date
   * when one is.
   *
   * Two things in one column rather than two columns of their own, because
   * they are never both wanted: what is coming up is what you READ, and a date
   * is what you ACT on. Nothing picked is the resting state and shows the
   * list, which is what this tab was before the month existed.
   */
  function drawSide() {
    sideEl.replaceChildren(...(picked ? dayPanel() : comingUp()));
  }

  function comingUp() {
    const head = node(`
      <div class="cal-side-head">
        <b>The next four weeks</b>
        <span class="tiny">Pick a date to book one.</span>
      </div>`);
    const nights = upcoming({
      venues: library.venueRecords || [],
      bookings: library.bookings || [],
    });
    if (!nights.length) {
      return [head, node(`<div class="tiny">Nothing coming up.
        ${(library.venueRecords || []).some((v) => v.usualNight)
    ? 'Pick a date on the left to add a one-off.'
    : 'Give a venue its usual night on the Venues tab and its weeks fill themselves in.'}</div>`)];
    }
    const list = node('<div class="diary-list"></div>');
    list.replaceChildren(...nights.map(comingRow));
    return [head, list];
  }

  /**
   * A NIGHT IN THE LIST IS SOMETHING YOU READ, NOT TEN THINGS YOU DO.
   *
   * It was `diaryRow()` — the same card as the day panel, buttons and all —
   * which put **Invoice it** and **Not on this week** on every one of ten
   * rows. Two faults, and the second is a rule this project already has in
   * writing:
   *
   * - **A WALL OF RED.** *"Don't want a wall of red either"* is the host's
   *   own line, set when three tinted button options were turned down. Ten
   *   outlined-red buttons in a column is louder than one filled one, and it
   *   made a perfectly ordinary diary read as ten things that had gone wrong
   *   — on a page whose only other colour was a pink underline on the button
   *   beside it.
   * - **It contradicted the panel's own split.** What is coming up is what you
   *   READ; a date is what you ACT on. Putting the actions in both halves
   *   meant the day panel was not the place a night is dealt with, it was one
   *   of two.
   *
   * So the row is the date, the place and what it plays for — and **the whole
   * row picks that date**, which lands you in the day panel where the actions
   * live. One tap, no buttons, and the month moves to the right month on the
   * way so you can see where you are.
   */
  function comingRow(night) {
    const when = new Date(night.date + 'T12:00:00');
    const prizes = (night.rewards || []).filter(Boolean);
    const row = node(`
      <button class="diary-row is-pick ${night.why === 'booked' ? 'is-booked' : ''}" type="button">
        <div class="d-when">
          <b>${esc(when.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }))}</b>
          <span class="tiny">${esc(whenAway(night.date))}</span>
        </div>
        <div class="d-what">
          <b>${esc(night.venue)}</b>
          ${night.why === 'booked' ? '<span class="d-tag">one-off</span>' : ''}
          ${night.time ? `<span class="d-time">${esc(saidTime(night.time))}</span>` : ''}
          ${night.note ? `<div class="tiny">${esc(night.note)}</div>` : ''}
          ${prizes.length ? `<div class="tiny">Playing for ${esc(prizes[0])}</div>` : ''}
        </div>
      </button>`);
    row.addEventListener('click', () => {
      const [y, m] = night.date.split('-').map(Number);
      shown = new Date(y, m - 1, 1);
      picked = night.date;
      booking = false;
      drawMonth();
    });
    return row;
  }

  /*
   * ONE DATE, AND EVERYTHING THAT CAN BE DONE TO IT — deliberately a LIST
   * pushed onto rather than a fixed set. The host's own framing: *"maybe just
   * build that in at the start so we can add to it later"*. So another action
   * is a line here rather than a redesign.
   */
  function dayPanel() {
    const when = new Date(picked + 'T12:00:00');
    const said = when.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
    const out = [];

    const head = node(`
      <div class="cal-side-head">
        <b>${esc(said)}</b>
        <button class="minor cal-shut" type="button">Back to the list</button>
      </div>`);
    head.querySelector('.cal-shut').addEventListener('click', () => {
      picked = ''; booking = false; drawMonth();
    });
    out.push(head);

    const on = onByDate.get(picked) || [];
    if (on.length) {
      const list = node('<div class="diary-list"></div>');
      list.replaceChildren(...on.map(diaryRow));
      out.push(list);
    } else {
      out.push(node('<div class="tiny">Nothing on this night.</div>'));
    }

    /*
     * WHAT "NOT ON THIS WEEK" ACTUALLY DID, and the way back from it.
     *
     * Asked directly — *"not sure what 'not on' would be useful for"* — and
     * the honest answer is that the button was right and INVISIBLE. It writes
     * one week of a residency off; the night then vanishes from the diary and
     * from the calendar feed, and nothing anywhere said so or offered to undo
     * it. A control whose entire effect is something disappearing is a control
     * nobody can learn. So a written-off night is now shown on its own date,
     * named, with **Put it back** on it.
     */
    for (const b of (library.bookings || []).filter((x) => x.off && x.date === picked)) {
      out.push(offRow(b));
    }

    if (booking) {
      out.push(bookForm(said));
    } else {
      const go = node('<button class="role-make cal-add" type="button">Book a quiz</button>');
      go.addEventListener('click', () => { booking = true; drawSide(); });
      out.push(go);
    }

    /*
     * NOT WHILE THE FORM IS OPEN. Under a half-filled booking it reads as one
     * more field in it, and pressing it would leave the tab for the invoices
     * with what you had typed still on screen behind you.
     */
    if (!booking && can(FEATURES.INVOICES)) {
      const bill = node('<button class="minor cal-bill" type="button">Invoice for this date</button>');
      bill.addEventListener('click', () => billFor((on[0] && on[0].venue) || '', picked));
      out.push(bill);
    }
    return out;
  }

  /**
   * A night written off, and the way to put it back.
   *
   * `removeBooking` rather than another `setBooking` — FORGETTING the
   * exception is what returns a residency to being an ordinary one, which is
   * exactly what "I cancelled that by mistake" means. Writing a second record
   * over it would leave the app holding two opinions about one Thursday.
   */
  function offRow(b) {
    const row = node(`
      <div class="diary-row is-off">
        <div class="d-what">
          <b>${esc(b.venue)}</b>
          <span class="d-tag off">not on</span>
          <div class="tiny">Written off, so it is not in your diary or your calendar feed.</div>
        </div>
        <div class="d-acts"><button class="minor d-back" type="button">Put it back</button></div>
      </div>`);
    row.querySelector('.d-back').addEventListener('click', async () => {
      try {
        const data = await invoiceApi(`/api/invoices/bookings/${encodeURIComponent(b.id)}`, { method: 'DELETE' });
        library.bookings = data.bookings || [];
        drawMonth();
      } catch (err) {
        alert(err.message || 'Could not put it back.');
      }
    });
    return row;
  }

  /**
   * BOOK A QUIZ — the whole night, against the date already picked.
   *
   * *"perhaps when you click 'book a quiz' it just asks for all quiz info like
   * venue, time etc."* The date is the HEADING rather than a field, because it
   * is the thing you clicked to get here and a box repeating it is a second
   * place for it to be wrong.
   *
   * Only the venue is required. A time is genuinely optional — a residency has
   * none, and demanding one would make somebody invent a fact in order to save
   * a booking — but given, it reaches their real calendar as an appointment
   * rather than a day-long block. See `src/ics.js`.
   */
  function bookForm(said) {
    const form = node(`
      <div class="cal-book">
        <b>Book a quiz — ${esc(said)}</b>
        <label class="cal-f"><span>Where</span>
          <!-- WRAPPED, because venueBox() is TWO elements: a select and the
               free-text box that replaces it for a one-off. wireVenue and
               venueFrom both use querySelector, which searches descendants,
               so nesting costs nothing. -->
          <div class="d-venue">${venueBox()}</div>
        </label>
        <label class="cal-f"><span>Starts at</span>
          <input class="d-time" type="time">
        </label>
        <label class="cal-f"><span>Note</span>
          <input class="d-note" type="text" maxlength="120" placeholder="Anything worth remembering">
        </label>
        <div class="tiny">Only the venue is needed. A start time goes into your own calendar as a real appointment.</div>
        <div class="cal-book-acts">
          <button class="minor cal-book-off" type="button">Cancel</button>
          <button class="role-make d-go" type="button">Add it</button>
        </div>
      </div>`);

    form.querySelector('.cal-book-off').addEventListener('click', () => { booking = false; drawSide(); });

    const add = form.querySelector('.d-go');
    add.addEventListener('click', async () => {
      const venue = venueFrom(form);
      if (!venue) { alert('A night needs a venue.'); return; }
      add.disabled = true;
      await save({
        date: picked,
        venue,
        time: form.querySelector('.d-time').value,
        note: form.querySelector('.d-note').value.trim(),
      });
      add.disabled = false;
    });
    wireVenue(form);
    return form;
  }

  /*
   * THE SUBSCRIPTION ADDRESS.
   *
   * Fetched rather than built here, because the key lives on the account and
   * this page must not invent one. Shown in full and copyable: pasting a URL
   * into Google Calendar is the actual job, and a button that says "subscribe"
   * cannot do it for you — every calendar app wants the address typed into its
   * own box.
   *
   * NEW ADDRESS is destructive and says so: it stops every calendar already
   * subscribed, which is exactly what you want if the old one went somewhere
   * it should not, and exactly what you do not want by accident.
   */
  const urlBox = el.querySelector('.cal-url');
  const feedSaid = el.querySelector('.cal-feed-said');
  const showFeed = async (roll) => {
    try {
      const data = roll
        ? await postJson('/api/calendar/link', {}, { 'X-Host-Key': hostKey })
        : await (await fetch(keyed('/api/calendar/link'))).json();
      if (data.error) throw new Error(data.error);
      urlBox.value = location.origin + data.path;
      if (roll) feedSaid.textContent = 'New address. Any calendar using the old one has stopped.';
    } catch (err) {
      feedSaid.textContent = err.message || 'Could not fetch your calendar address.';
    }
  };
  el.querySelector('.cal-copy').addEventListener('click', async () => {
    urlBox.select();
    try {
      await navigator.clipboard.writeText(urlBox.value);
      feedSaid.textContent = 'Copied. Paste it into your calendar as a subscription.';
    } catch {
      // Clipboard is refused without a gesture on some phones; the text is
      // already selected, so there is still a way through.
      feedSaid.textContent = 'Selected — copy it and paste it into your calendar.';
    }
  });
  el.querySelector('.cal-roll').addEventListener('click', () => {
    if (!confirm('Make a new address?\n\nEvery calendar already subscribed to the old one stops updating.')) return;
    showFeed(true);
  });
  showFeed(false);

  el.querySelector('.cal-prev').addEventListener('click', () => {
    shown = new Date(shown.getFullYear(), shown.getMonth() - 1, 1); picked = ''; booking = false; drawMonth();
  });
  el.querySelector('.cal-next').addEventListener('click', () => {
    shown = new Date(shown.getFullYear(), shown.getMonth() + 1, 1); picked = ''; booking = false; drawMonth();
  });
  el.querySelector('.cal-today').addEventListener('click', () => {
    shown = new Date(today.getFullYear(), today.getMonth(), 1); picked = ''; booking = false; drawMonth();
  });

  /*
   * A night, and the three things you can do to it.
   *
   * **"NOT ON THIS WEEK" AND "DELETE THIS BOOKING" ARE DIFFERENT ACTS ON
   * DIFFERENT OBJECTS, and one label used to cover both.** It said "Not on",
   * which is a verb with no object — the collision this project's sweep
   * already looks for. A residency is not a row that can be removed: it is
   * generated from the venue's usual night, so the only way to say "not that
   * Thursday" is to RECORD the exception. A one-off is a real row somebody
   * typed, and the thing you want is for it to be gone.
   */
  function diaryRow(night) {
    const when = new Date(night.date + 'T12:00:00');
    const said = when.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
    const oneOff = night.why === 'booked';
    // The typed row behind this night, if there is one. A residency has none.
    const typed = (library.bookings || []).find((b) => !b.off && b.date === night.date
      && String(b.venue || '').toLowerCase() === String(night.venue || '').toLowerCase());
    const row = node(`
      <div class="diary-row ${oneOff ? 'is-booked' : ''}">
        <div class="d-when">
          <b>${esc(when.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }))}</b>
          <span class="tiny">${esc(whenAway(night.date))}</span>
        </div>
        <div class="d-what">
          <b>${esc(night.venue)}</b>
          ${oneOff ? '<span class="d-tag">one-off</span>' : ''}
          ${night.time ? `<span class="d-time">${esc(saidTime(night.time))}</span>` : ''}
          ${night.note ? `<div class="tiny">${esc(night.note)}</div>` : ''}
          ${night.rewards && night.rewards.filter(Boolean).length
    ? `<div class="tiny">Playing for ${esc(night.rewards.filter(Boolean)[0])}</div>`
    : '<div class="tiny">No prizes set</div>'}
        </div>
        <div class="d-acts">
          ${can(FEATURES.INVOICES) ? '<button class="minor d-bill">Invoice it</button>' : ''}
          <button class="minor danger d-off">${oneOff ? 'Delete this booking' : 'Not on this week'}</button>
        </div>
      </div>`);
    /*
     * INVOICE A NIGHT BEFORE IT HAPPENS.
     *
     * "Past and future" — the past half already worked, from Invoice this on a
     * finished night and from the unbilled list. The future half did not exist
     * at all: a booking you had taken could only be billed after you had run
     * it, which is the wrong way round for anybody who invoices on booking
     * rather than on delivery. Some venues pay a deposit; some want the
     * paperwork before their month end.
     *
     * **IT GOES TO THE INVOICES TAB rather than opening a form over the
     * diary**, at the host's own reading: *"'invoice for this date' goes to
     * the invoice section with that date pre-filled"*. He is right, and the
     * reason is what happens AFTER you press Send — you are left standing on
     * the calendar with no sight of the invoice you just raised, its number or
     * whether it is a draft. Landing on the tab that owns them means the thing
     * you made is on the page behind the form.
     *
     * It opens a DRAFT rather than issuing: a number is handed out at issue,
     * and handing one out for a night that might get cancelled is the sort of
     * hole in a sequence HMRC asks about.
     */
    row.querySelector('.d-bill')?.addEventListener('click', () => billFor(night.venue, night.date));
    row.querySelector('.d-off').addEventListener('click', async () => {
      if (oneOff && typed) {
        if (!confirm(`Delete the booking at ${night.venue} on ${said}?`)) return;
        try {
          const data = await invoiceApi(`/api/invoices/bookings/${encodeURIComponent(typed.id)}`, { method: 'DELETE' });
          library.bookings = data.bookings || [];
          drawMonth();
        } catch (err) {
          alert(err.message || 'Could not delete that.');
        }
        return;
      }
      if (!confirm(`Not doing ${night.venue} on ${said}?\n\nIt comes off your diary and your calendar feed. Pick the date and book it again to put it back.`)) return;
      await save({ date: night.date, venue: night.venue, off: true });
    });
    return row;
  }

  async function save(body) {
    try {
      const data = await invoiceApi('/api/invoices/bookings', { method: 'POST', body: JSON.stringify(body) });
      // The route hands the new list straight back, so the page does not have
      // to reload the whole library to show what it just wrote.
      library.bookings = data.bookings || [];
      drawMonth();
    } catch (err) {
      alert(err.message || 'Could not save that.');
    }
  }

  drawMonth();
  return el;
}

/**
 * A DATE HANDED FROM THE CALENDAR TO THE INVOICES TAB.
 *
 * Held here rather than passed, because the two are different tabs and the
 * only thing between them is `render()`. The invoices tab consumes it once,
 * after its own book has loaded — which is also what resolves the venue NAME
 * to a customer id, so the calendar never has to fetch the invoice book to
 * offer the button.
 */
let pendingInvoice = null;

function billFor(venue, date) {
  pendingInvoice = {
    venueName: venue || '',
    event: { title: 'Music quiz night', venue: venue || '', date },
    description: 'Music quiz night',
  };
  goToTab('invoices');
}

/**
 * Move to another tab from inside a panel.
 *
 * The remembered tab is what `currentTab()` reads — **unless there is a
 * `?tab=` in the address bar, which wins**. A link that landed somebody here
 * would otherwise drag them straight back the moment the page redrew, so the
 * URL is moved along with the memory when it is carrying one.
 */
function goToTab(id) {
  localStorage.setItem(TAB_STORE, id);
  const url = new URL(location.href);
  if (url.searchParams.get('tab')) {
    url.searchParams.set('tab', id);
    history.replaceState(null, '', url.toString());
  }
  // The same landing as pressing the tab yourself, because that is what this
  // is — arriving somewhere different depending on how you got there is how a
  // page stops feeling like one place.
  renderKeepingPlace();
}

/** "20:00" as somebody says it out loud. */
function saidTime(time) {
  const [h, m] = String(time || '').split(':').map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return '';
  const hour = h % 12 || 12;
  return `${hour}${m ? ':' + String(m).padStart(2, '0') : ''}${h < 12 ? 'am' : 'pm'}`;
}

/** "tonight", "in 3 days", "in 2 weeks" — how far off, not a second date. */
function whenAway(date) {
  const days = Math.round((new Date(date + 'T12:00:00') - new Date(nightKey() + 'T12:00:00')) / 86400000);
  if (days <= 0) return 'tonight';
  if (days === 1) return 'tomorrow';
  if (days < 14) return `in ${days} days`;
  return `in ${Math.round(days / 7)} weeks`;
}

function pastGigsSection() {
  const el = node(`
    <div class="game-section">
      <div class="game-head">
        <div>
          <h2>Past gigs</h2>
          <div class="tiny">Every night you have run. Saved automatically when a game finishes.</div>
        </div>
      </div>
      <div class="tiny gig-note"></div>
      <div class="gig-list">Loading…</div>
    </div>`);

  const list = el.querySelector('.gig-list');
  const note = el.querySelector('.gig-note');

  (async () => {
    let data;
    try {
      const res = await fetch(keyed('/api/past-gigs'));
      data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not load them');
    } catch (err) {
      list.replaceChildren(node(`<div class="tiny">${esc(err.message)}</div>`));
      return;
    }

    if (!data.nights.length) {
      list.replaceChildren(node('<div class="tiny">Nothing yet. Finish a game and the night appears here.</div>'));
      return;
    }
    // Said once, at the top, rather than against every night: without the photo
    // repository set up the pictures are on this server only, and this server
    // forgets them on the next deploy. A quiet gap would read as "nobody took
    // any", which is the wrong thing to believe about your own gig.
    if (!data.photosKept) {
      note.innerHTML = '<b style="color:var(--gold)">Photos are not being kept permanently yet.</b> '
        + 'Nights still appear here; the pictures from them will not survive a restart.';
    }
    list.replaceChildren(...data.nights.map(gigRow));
  })();

  return el;
}

function gigRow(night) {
  const when = new Date(night.night + 'T12:00:00');
  const label = when.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const played = night.games.length
    ? night.games.map((g) => esc(g.title || (g.kind === 'bingo' ? 'Music bingo' : 'Music quiz'))).join(' · ')
    : 'No results saved';
  const heads = night.games.reduce((n, g) => Math.max(n, g.players || 0), 0);

  const el = node(`
    <div class="gig">
      <button class="gig-head" type="button">
        <span class="an">${esc(label)}</span>
        <span class="tiny">${played}</span>
        <span class="tiny">${[night.venue, heads ? `${heads} playing` : ''].filter(Boolean).join(' · ')}</span>
        <!-- Its OWN span, not inside .gig-more: that one is rewritten with
             "Loading…" and then the photo count the moment the night is
             opened, which would wipe this. -->
        ${night.unbilled ? '<span class="gig-unbilled">Not invoiced</span>' : ''}
        <span class="tiny gig-more">${night.hasPhotos ? 'Photos ▸' : ''}</span>
      </button>
      <div class="gig-body" hidden></div>
    </div>`);

  const body = el.querySelector('.gig-body');
  const more = el.querySelector('.gig-more');
  let loaded = false;

  el.querySelector('.gig-head').addEventListener('click', async () => {
    body.hidden = !body.hidden;
    if (body.hidden || loaded) return;
    loaded = true;

    // Who won, which is on the archive and never on a photo.
    for (const game of night.games) {
      body.appendChild(node(`<div class="tiny">${esc(game.title || '')} —
        ${esc(game.winner ? 'won by ' + game.winner : 'no winner recorded')}</div>`));
    }

    /*
     * BILL FOR THIS ONE, from the night itself.
     *
     * This is what lets Invoices stay a tab of its own rather than being
     * swallowed into this one. "Invoice this" already existed on the running
     * panel — but only in the minutes after a game ends, so a night from a
     * fortnight ago could only be billed by typing the venue and the date back
     * in from memory. That is precisely the blank page this app's own rule
     * says is where the time goes.
     *
     * The venue is matched to a record so the address and the usual fee come
     * with it; an unmatched name still fills the night's own details in, which
     * is the free-text venue keeping its promise. Only where they hold the
     * feature — a quizmaster without invoicing gets no button rather than one
     * that 403s.
     */
    if (can(FEATURES.INVOICES)) {
      const bill = node('<button class="minor gig-bill">Invoice this</button>');
      bill.addEventListener('click', async () => {
        bill.disabled = true;
        try {
          book = await invoiceApi('/api/invoices');
        } catch (err) {
          bill.disabled = false;
          alert('Could not open the invoices: ' + err.message);
          return;
        }
        const match = book.customers.find(
          (c) => (c.name || '').toLowerCase() === String(night.venue || '').toLowerCase());
        const what = night.games.some((g) => g.kind === 'bingo') && night.games.every((g) => g.kind === 'bingo')
          ? 'Music bingo night' : 'Music quiz night';
        openInvoiceForm({
          customerId: match ? match.id : '',
          // `nightId` has been a field on every invoice since invoicing was
          // written and was never once set. It is the stable handle back to
          // the night — what tells the two apart for "have I billed this" is
          // the venue and the date together, but the id is what anything
          // later will want and it costs nothing to record now.
          event: { title: what, venue: night.venue || '', date: night.night, nightId: night.night },
          description: what,
        }, () => load());
        bill.disabled = false;
      });
      body.appendChild(bill);
    }

    if (!night.hasPhotos) return;

    more.textContent = 'Loading…';
    let data;
    try {
      const res = await fetch(keyed('/api/past-gigs/' + encodeURIComponent(night.night)));
      data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not load them');
    } catch (err) {
      more.textContent = '';
      body.appendChild(node(`<div class="tiny">${esc(err.message)}</div>`));
      return;
    }
    more.textContent = `${data.photos.length} photo${data.photos.length === 1 ? '' : 's'}`;
    const grid = node('<div class="night-grid"></div>');
    for (const p of data.photos) {
      /*
       * `filed`, always — and this was stamping "NOT FILED" on every one.
       *
       * The badge belongs to the owner's Photos tab, where a photo genuinely
       * can be sitting on a disk that the next restart wipes. Past gigs reads
       * the photo list OUT of the repository, so anything shown here is filed
       * by definition. Without the class the CSS `:not(.filed)` rule fired on
       * all of them — telling a quizmaster their night's pictures were about
       * to be lost, on the one page whose whole job is "here is my work".
       */
      grid.appendChild(node(`<figure class="cphoto filed"><img src="${esc(p.url)}" alt="" loading="lazy"></figure>`));
    }
    body.appendChild(grid);
    body.appendChild(galleryToggle(night.night, data.published));
  });

  return el;
}

/**
 * PUT THIS NIGHT ON THE PUBLIC GALLERY, or take it back down.
 *
 * The route for this has existed since the gallery was built and **nothing
 * ever called it** — so a night could be published only by hand, which means
 * in practice not at all. Same class of miss as the projector's arcade board:
 * the server was ready, the page was ready, and no control joined them up.
 *
 * ---
 *
 * **IT SITS UNDER THE PHOTOGRAPHS, and that placement is the safeguard.** It
 * is inside a night that has to be opened, below the pictures it would publish
 * — so nobody can put a night in front of the world without having just looked
 * at what is in it. A button on the collapsed row would be one tap from a
 * stranger's face going public, taken on a phone whose only promise was that
 * it *"goes on the big screen"*.
 *
 * **IT SAYS WHAT PUBLISHING MEANS, in a sentence.** The house style says a
 * control gets a title and one short line — and that warnings are the
 * exception, because they are read once at a moment that matters. This is one:
 * *anyone with the link* is the whole fact, and it costs somebody something
 * real if it is not said.
 *
 * **TAKING IT DOWN IS AS PROMINENT AS PUTTING IT UP.** Somebody will ask for
 * their photograph to be removed, and the only honest answer on a page with no
 * contact details is a quizmaster who can do it in one tap while they are
 * stood there. It is destructive-styled — outlined red, never filled — like
 * everything else that takes something away.
 *
 * @param {string} night `YYYY-MM-DD`
 * @param {boolean} on   whether it is already published
 */
function galleryToggle(night, on) {
  const wrap = node('<div class="gig-gallery"></div>');

  const paint = (live) => {
    wrap.replaceChildren(node(live
      ? `<div class="tiny gig-gal-live">On the gallery —
           <a href="/gallery?n=${encodeURIComponent(night)}" target="_blank" rel="noopener">see it</a></div>`
      // Not a warning wrapper and not red: it is a plain statement of what the
      // button does, read before pressing rather than after something went
      // wrong. Red here would say a mistake had been made.
      : '<div class="tiny gig-gal-note">Anyone with the link can see these.</div>'));

    const btn = node(live
      ? '<button class="minor danger gig-gal-off" type="button">Take it off the gallery</button>'
      : '<button class="minor gig-gal-on" type="button">Put these on the gallery</button>');
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      try {
        const res = await fetch(keyed('/api/past-gigs/publish'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ night, on: !live }),
        });
        const out = await res.json();
        // SAY WHAT WENT WRONG. The likeliest failure by far is that the
        // private photo repository is not configured, and "could not save
        // that" would send somebody hunting through the app for a fault that
        // is in an environment variable.
        if (!res.ok) throw new Error(out.error || 'Could not change that.');
        paint(!live);
      } catch (err) {
        btn.disabled = false;
        wrap.appendChild(node(`<div class="tiny" style="color:var(--bad)">${esc(err.message)}</div>`));
      }
    });
    wrap.appendChild(btn);
  };

  paint(Boolean(on));
  return wrap;
}

/** "3 days ago" reads better than a timestamp when you are scanning a list. */
function whenish(ts) {
  const days = Math.floor((Date.now() - ts) / 86400000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 14) return `${days} days ago`;
  if (days < 60) return `${Math.round(days / 7)} weeks ago`;
  return new Date(ts).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
}

/*
 * Getting in.
 *
 * Try to load first, whatever we do or do not have. `load()` asks who is
 * signed in before anything else, so a real account never sees the host key
 * box — that box is now only for somebody still using a `?key=` link from
 * before there were accounts, and only when there is no session either.
 *
 * The order used to be the other way round, which meant a signed-in quizmaster
 * was asked for a key they had never been given and could not get.
 */
load().catch((err) => {
  // Say what actually went wrong, always. This used to swallow the error and
  // draw the host-key box, so a bug anywhere in the page looked exactly like a
  // wrong key — which sent me hunting through the server for a 401 that was
  // never there. Failure messages have to name the cause.
  console.error('[console] could not load:', err);
  if (!hostKey) return askForKey(err && err.message ? `Something went wrong loading the console: ${err.message}` : '');
  mainEl.replaceChildren(node(`<div class="panel"><h3>Could not load</h3><div class="tiny">${esc(err.message)}</div></div>`));
});

/* ================================================================= ADVERTS
 *
 * Slides for between rounds. This is a revenue feature, not decoration: the
 * host sells himself to venues on shifting their pizzas and their gig tickets,
 * so a set belongs to a VENUE and gets reused every week rather than being
 * written fresh each night.
 *
 * Kept deliberately plain — a heading, a line of words, an optional QR — because
 * a slide has to be readable from the back of a pub in three seconds, and
 * because he will be typing these in between other jobs.
 */
function advertsSection(sets) {
  /*
   * WHOEVER IS ON THIS TAB MAY WRITE ON IT — and for a while nobody could.
   *
   * This was `can(FEATURES.CATALOGUE)`, which is the OWNER, under a comment
   * saying advert sets were shared between quizmasters and therefore unsafe to
   * let anybody else edit. **That stopped being true and the gate never
   * moved.** The server writes to `advertRoom.paths.adverts` — the room's own
   * folder — with no owner check on the route, and restores them per room on
   * boot. So the sets were scoped and the button was not.
   *
   * What that added up to is the fault this codebase keeps recording in other
   * forms: **a tab with no way in.** Adverts is a Silver feature, it appears on
   * the tab bar for exactly the people it is sold to, and every one of them
   * saw a page they could read and not write — with nothing on screen saying
   * why, because the reason had stopped existing.
   *
   * The tab itself needs `FEATURES.ADVERTS` to render at all, so anybody who
   * can see this holds it. There is no second question to ask.
   */
  const mine = true;
  const el = node(`
    <div class="game-section">
      <div class="game-head">
        <div>
          <h2>Advert slides</h2>
          <!-- "One set per venue" read as ONE ADVERT per venue, and the host
               asked what happens if a pub wants to advertise twice across
               three rounds. They already can — a set holds as many slides as
               you like and the picker on the control view chooses which goes
               up, as often as you like. The words were describing the STORAGE
               rather than what you can do with it. -->
          <div class="tiny">A set of slides per venue — as many as you like. Put any of them up
            between rounds from your control view, as often as the night needs.</div>
        </div>
        <div class="row">
          <!-- WHAT A VENUE ACTUALLY SENDS is a picture of their offer — a
               poster, a photo of the specials board, the flyer for a band.
               Asked for as "import from a file… they might get emailed it
               over". So the file IS the slide: pick one and it arrives as a
               slide with the picture already on it, waiting for a heading.
               Not a JSON importer: nobody is emailed one of those. -->
          ${mine ? '<label class="minor import-ad">Bring in a picture<input class="ad-file" type="file" accept="image/*" multiple hidden></label>' : ''}
          ${mine ? '<button class="role-make new-set">New set</button>' : ''}
        </div>
      </div>
      <div class="pack-grid"></div>
    </div>`);

  el.querySelector('.new-set')?.addEventListener('click', () => editAdvertSet(null));

  /*
   * A picture, or several, becoming slides.
   *
   * It opens the editor on a NEW set rather than saving one behind your back:
   * a slide with a picture and no words is refused by the validator anyway
   * (`validateAdvertPack` — a slide has to say something), and more to the
   * point the words are the half a venue is paying for. So the file gets you
   * past the fiddly part and leaves you at the keyboard.
   *
   * Shrunk on the way in like every other picture here, so a 4MB photo off
   * somebody's phone does not end up in the screen payload.
   */
  const filePick = el.querySelector('.ad-file');
  filePick?.addEventListener('change', async () => {
    const files = [...(filePick.files || [])];
    if (!files.length) return;
    const slides = [];
    for (const file of files) {
      try {
        slides.push({ id: 's' + (slides.length + 1), heading: '', body: '', say: '',
          image: await shrinkAdvertImage(file) });
      } catch (err) {
        alert(`${file.name}: ${err.message || 'could not be used'}`);
      }
    }
    filePick.value = '';
    if (slides.length) editAdvertSet(null, { slides });
  });

  const grid = el.querySelector('.pack-grid');
  if (!sets.length) {
    grid.appendChild(node(`
      <div class="tiny">Nothing yet. A set might be "The Crown" with a slide for the
      Tuesday pizza deal and one for the band on the 28th, with a QR to tickets.</div>`));
    return el;
  }

  for (const set of sets) {
    const card = node(`
      <div class="pack-card ${set.broken ? 'broken' : ''}">
        <button class="pack-title">${esc(set.title)}</button>
        <div class="tiny">${esc(set.venue || 'No venue set')}</div>
        <div class="tiny played">${set.slideCount} slide${set.slideCount === 1 ? '' : 's'}</div>
        ${set.broken ? `<div class="tiny" style="color:var(--bad)">Broken: ${esc(set.broken)}</div>` : ''}
        <div class="pack-actions">
          <!-- ORDINARY, not the night. It wore the "go" class — the account's gradient —
               which by the five roles means Launch and Take control, and
               editing a slide set is not that. Delete beside it is already
               outlined and "New set" above is green for "makes something", so
               this was the only one borrowing a meaning it does not have. -->
          <button class="minor edit">Edit</button>
          ${mine ? '<button class="pack-del">Delete</button>' : ''}
        </div>
      </div>`);
    const open = () => editAdvertSet(set.id);
    card.querySelector('.pack-title').addEventListener('click', open);
    card.querySelector('.edit').addEventListener('click', open);
    card.querySelector('.pack-del')?.addEventListener('click', async () => {
      if (!confirm(`Delete "${set.title}" and its ${set.slideCount} slide${set.slideCount === 1 ? '' : 's'}?`)) return;
      await fetch(keyed('/api/advert/' + encodeURIComponent(set.id)), {
        method: 'DELETE', headers: { 'X-Host-Key': hostKey },
      });
      await load();
    });
    grid.appendChild(card);
  }
  return el;
}

function editAdvertSet(id, seed = null) {
  const overlay = node(`
    <div class="sheet-overlay">
      <div class="sheet">
        <div class="sheet-head">
          <div>
            <input class="sheet-title" id="adTitle" placeholder="What to call this set">
            <input class="tiny ad-venue-in" id="adVenue" placeholder="Venue — e.g. The Crown, Chelmsford">
          </div>
          <div class="row">
            <button class="role-make" id="adSave">Save</button>
            <button class="minor" id="adClose">Close</button>
          </div>
        </div>
        <div class="sheet-body" id="adBody"></div>
      </div>
    </div>`);
  document.body.appendChild(overlay);

  const body = overlay.querySelector('#adBody');
  const close = () => overlay.remove();
  overlay.querySelector('#adClose').addEventListener('click', close);

  // Seeded when the set is being started FROM files — see the picture import
  // on the adverts tab. Everything else about the sheet is identical, so there
  // is one editor rather than a second one for imports.
  let pack = { id: '', title: '', venue: '', slides: [], ...(seed || {}) };

  const draw = () => {
    overlay.querySelector('#adTitle').value = pack.title;
    overlay.querySelector('#adVenue').value = pack.venue;
    const parts = pack.slides.map((slide, i) => slideEditor(slide, i, pack, draw));
    const add = node('<button class="minor" style="margin-top:12px">Add a slide</button>');
    add.addEventListener('click', () => {
      pack.slides.push({ id: 's' + (pack.slides.length + 1), heading: '', body: '', say: '' });
      draw();
    });
    parts.push(add);
    body.replaceChildren(...parts);
  };

  overlay.querySelector('#adTitle').addEventListener('input', (e) => { pack.title = e.target.value; });
  overlay.querySelector('#adVenue').addEventListener('input', (e) => { pack.venue = e.target.value; });

  overlay.querySelector('#adSave').addEventListener('click', async () => {
    const btn = overlay.querySelector('#adSave');
    btn.disabled = true;
    btn.textContent = 'Saving…';
    // A new set gets its filename from the venue, or the title if there is no
    // venue — the same way a quiz is named after its theme.
    const slug = (pack.id || pack.venue || pack.title || 'adverts')
      .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'adverts';
    try {
      const res = await fetch(keyed('/api/advert/' + encodeURIComponent(slug)), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'X-Host-Key': hostKey },
        body: JSON.stringify({ ...pack, id: slug }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data.problems || [data.error]).join('\n'));
      close();
      await load();
    } catch (err) {
      alert(err.message);
      btn.disabled = false;
      btn.textContent = 'Save';
    }
  });

  if (!id) { pack.title = 'New advert set'; draw(); return; }
  fetch(keyed('/api/advert/' + encodeURIComponent(id)))
    .then((r) => r.json())
    .then((loaded) => { pack = loaded; draw(); })
    .catch(() => { body.replaceChildren(node('<div class="tiny">Could not open it.</div>')); });
}

function slideEditor(slide, i, pack, redraw) {
  const el = node(`
    <div class="ad-slide">
      <div class="ad-slide-head">
        <b>Slide ${i + 1}</b>
        <button class="minor danger small ad-del">Delete</button>
      </div>
      <label class="tiny">On the screen, big</label>
      <input class="ad-h" maxlength="60" placeholder="PIZZA — 2 FOR 1 TONIGHT" value="${esc(slide.heading || '')}">
      <label class="tiny">Underneath, smaller</label>
      <input class="ad-b" maxlength="160" placeholder="Kitchen open till 10. Ask at the bar." value="${esc(slide.body || '')}">
      <!-- A PICTURE FOR THE SLIDE. The projector has always been able to draw
           one — screen.js has an advert has-image layout — and there has
           never been a way to add one, so the only route was hand-editing the
           JSON. This is finishing a half-built path rather than adding one.
           Shrunk in the browser to 900px, like the venue logo, because it
           rides in the screen payload while the slide is up. -->
      <label class="tiny">A picture for the slide — a photo of the food, the band, the offer</label>
      <div class="ad-pic-row">
        ${slide.image ? `<img class="ad-pic" alt="" src="${esc(slide.image)}">` : ''}
        <label class="minor ad-pic-pick">${slide.image ? 'Change' : 'Add or take one'}
          <input class="ad-img" type="file" accept="image/*" hidden>
        </label>
        ${slide.image ? '<button class="minor danger ad-pic-off">Remove</button>' : ''}
      </div>
      <label class="tiny">A link to put a QR code on the slide — tickets, a booking page</label>
      <input class="ad-l" placeholder="https://..." value="${esc(slide.link || '')}">
      <input class="ad-ll" maxlength="40" placeholder="What the QR is for — e.g. Tickets for the 28th" value="${esc(slide.linkLabel || '')}">
      <label class="tiny">Your line for the mic — never goes on the screen</label>
      <input class="ad-say" maxlength="160" placeholder="Mention the pizza deal while this is up" value="${esc(slide.say || '')}">
    </div>`);

  const bind = (sel, key) => el.querySelector(sel).addEventListener('input', (e) => { slide[key] = e.target.value; });
  /*
   * The picture saves onto the slide OBJECT, like every other field here — the
   * set is written as a whole when you press Save, so there is nothing to
   * upload separately and nothing to leave half-done.
   */
  const pick = el.querySelector('.ad-img');
  pick?.addEventListener('change', async () => {
    const file = pick.files && pick.files[0];
    if (!file) return;
    try {
      slide.image = await shrinkAdvertImage(file);
      redraw();
    } catch (err) {
      alert(err.message || 'Could not use that image.');
    }
  });
  el.querySelector('.ad-pic-off')?.addEventListener('click', () => {
    delete slide.image;
    redraw();
  });

  bind('.ad-h', 'heading');
  bind('.ad-b', 'body');
  bind('.ad-l', 'link');
  bind('.ad-ll', 'linkLabel');
  bind('.ad-say', 'say');

  el.querySelector('.ad-del').addEventListener('click', () => {
    pack.slides.splice(i, 1);
    redraw();
  });
  return el;
}


/* ==========================================================================
 * Invoicing.
 *
 * The night ends, the room empties, and the thing most likely not to happen is
 * the invoice — because by then it is half eleven and everything is in the car.
 * So this sits one tap from the end of a game and fills itself in.
 *
 * Sending it is deliberately the phone's own share sheet rather than the app
 * emailing it: it goes out from your address, so replies come to you and it
 * does not land in a spam folder addressed from nobody. The app's job is to
 * keep the record of who was invoiced and who has paid, which it does whether
 * you send it from here, from a laptop, or not at all.
 */

let book = null;   // { settings, customers, invoices, summary, backupReady }

async function invoiceApi(path, options) {
  const res = await fetch(keyed(path), {
    headers: { 'Content-Type': 'application/json', 'X-Host-Key': hostKey },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data;
}

function invoicesSection() {
  const el = node(`
    <div class="game-section">
      <div class="game-head">
        <div>
          <h2>Invoices</h2>
          <div class="tiny status">Loading…</div>
        </div>
        <div class="row">
          <button class="minor who-to">Venues</button>
          <button class="minor my-details">Your details</button>
          <button class="role-make new-invoice">New invoice</button>
        </div>
      </div>
      <div class="inv-warn"></div>
      <div class="inv-body"></div>
    </div>`);

  const status = el.querySelector('.status');
  const body = el.querySelector('.inv-body');
  const warn = el.querySelector('.inv-warn');

  const refresh = async () => {
    try {
      book = await invoiceApi('/api/invoices');
    } catch (err) {
      status.textContent = err.message;
      return;
    }
    const s = book.summary;
    status.innerHTML = s.count
      ? `${s.count} invoice${s.count === 1 ? '' : 's'} · <b>${esc(money(s.outstanding))}</b> outstanding`
        + (s.overdueCount ? ` · <b style="color:var(--bad)">${esc(money(s.overdue))} overdue</b>` : '')
      : 'Nothing invoiced yet.';

    /*
     * The one warning that matters, and it is the same shape as the song
     * history's: there is no permanent disk, so without the private repo an
     * invoice lives until the next deploy. An invoice you think you have a
     * record of and do not is worse than no record at all.
     *
     * It used to name PHOTO_REPO and GITHUB_TOKEN and tell the reader to set
     * them on Render — which is the owner's dashboard, on the one tab that is
     * a quizmaster's own business. Same fault as the "nothing here is being
     * saved permanently" banner that was being shown to subscribers. It says
     * what it means to them and what to do about it, like the own-packs one.
     */
    warn.replaceChildren(...(book.backupReady ? [] : [node(`
      <div class="pv-warn pv-broken" style="margin-bottom:12px">
        <b class="pv-warn-head">Invoices are not being backed up</b>
        <div class="tiny" style="margin-top:6px">
          They are saved here, and this server has nowhere permanent to keep them — so
          everything on this page disappears the next time the app restarts, including
          the invoice numbering. Download anything you have sent out, and ask about
          turning the backup on.
        </div>
      </div>`)]));

    drawList(body, refresh);

    /*
     * A DATE THE CALENDAR SENT OVER — see `billFor()`.
     *
     * Consumed HERE rather than acted on there, because this is the first
     * moment the invoice book exists: the venue arrives as a NAME, and turning
     * it into a customer id needs `book.customers`. Doing it this way round
     * also means the calendar raises an invoice without fetching the book at
     * all.
     *
     * Taken once and cleared, or the form would reopen on every refresh — and
     * `refresh()` runs after every save, which would trap somebody inside it.
     */
    if (pendingInvoice) {
      const want = pendingInvoice;
      pendingInvoice = null;
      const named = String(want.venueName || '').trim().toLowerCase();
      const customer = named
        ? (book.customers || []).find((c) => String(c.name || '').trim().toLowerCase() === named)
        : null;
      openInvoiceForm({ ...want, customerId: customer ? customer.id : '' }, refresh);
    }
  };

  el.querySelector('.new-invoice').addEventListener('click', () => openInvoiceForm({}, refresh));
  el.querySelector('.my-details').addEventListener('click', () => openSettings(refresh));
  el.querySelector('.who-to').addEventListener('click', () => openCustomers(refresh));
  refresh();
  return el;
}

/** Pence to "£350.00", the same sum the server did. Never adds anything up. */
function money(pence) {
  const n = Math.round(Number(pence) || 0);
  const abs = Math.abs(n);
  const pounds = String(Math.floor(abs / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${n < 0 ? '-' : ''}£${pounds}.${String(abs % 100).padStart(2, '0')}`;
}

const STATUS_LABEL = { draft: 'Draft', sent: 'Awaiting payment', paid: 'Paid', cancelled: 'Cancelled' };

function drawList(body, refresh) {
  if (!book.invoices.length) {
    body.replaceChildren(node(`
      <div class="tiny" style="padding:18px 0">
        Nothing yet. Fill in <b>Your details</b> once, add the places you play under
        <b>Venues</b>, and an invoice is then two taps at the end of a night.
      </div>`));
    return;
  }

  const rows = book.invoices.map((invoice) => {
    /*
     * HOW LATE, in whole days past the terms — 0 when it is not.
     *
     * Worked out here rather than sent, because the browser has the issue date
     * and the terms already and a number computed on a page that reloads is
     * one that cannot go stale. It decides both the chase button and the line
     * under the row.
     */
    const late = daysLate(invoice, book.settings);
    const row = node(`
      <div class="inv-row status-${esc(invoice.status)} ${late ? 'is-late' : ''}">
        <div class="inv-main">
          <div class="inv-top">
            <b>${esc(invoice.number)}</b>
            <span class="inv-who">${esc(invoice.to.name)}</span>
            <span class="inv-status">${esc(STATUS_LABEL[invoice.status] || invoice.status)}</span>
          </div>
          <div class="tiny">${esc(invoice.lines.map((l) => l.description).join(' · '))}</div>
          ${late ? `<div class="tiny inv-late">${late} day${late === 1 ? '' : 's'} past its terms</div>` : ''}
        </div>
        <div class="inv-amount">${esc(money(invoice.totals.due))}</div>
        <div class="inv-actions">
          <a class="minor" href="${esc(keyed('/api/invoices/' + encodeURIComponent(invoice.number) + '.pdf'))}" target="_blank" rel="noopener">Open</a>
          <button class="minor send">Send</button>
          ${late ? '<button class="minor chase">Chase it</button>' : ''}
          ${invoice.status === 'paid'
            ? '<button class="minor unpaid">Not paid</button>'
            : invoice.status === 'cancelled' ? '' : '<button class="go paid">Mark paid</button>'}
        </div>
      </div>`);

    row.querySelector('.send').addEventListener('click', () => share(invoice));
    row.querySelector('.chase')?.addEventListener('click', () => chase(invoice, late));
    row.querySelector('.paid')?.addEventListener('click', async () => {
      await invoiceApi(`/api/invoices/${encodeURIComponent(invoice.number)}`, { method: 'POST', body: JSON.stringify({ status: 'paid' }) });
      refresh();
    });
    row.querySelector('.unpaid')?.addEventListener('click', async () => {
      await invoiceApi(`/api/invoices/${encodeURIComponent(invoice.number)}`, { method: 'POST', body: JSON.stringify({ status: 'sent' }) });
      refresh();
    });
    return row;
  });
  body.replaceChildren(...rows);
}

/**
 * HOW LATE AN INVOICE IS, in whole days past its terms.
 *
 * Mirrors `daysLate` in `src/invoices.js` — same rule, so the browser and the
 * server can never disagree about whether somebody is late. Only ever true of
 * a SENT one: a draft is not late, and a paid or cancelled one is finished.
 */
function daysLate(invoice, settings = {}) {
  if (!invoice || invoice.status !== 'sent') return 0;
  const issued = Date.parse(invoice.issuedAt);
  if (!Number.isFinite(issued)) return 0;
  const terms = Number(settings.termDays) || 14;
  return Math.max(0, Math.floor((Date.now() - (issued + terms * 86400000)) / 86400000));
}

/**
 * CHASE IT — the most disliked admin job there is, drafted.
 *
 * The blank page is where the time goes, not the pressing of send. So this
 * writes the awkward sentence and hands it to the share sheet; the quizmaster
 * reads it and presses send, exactly like `reply-draft.js` and for the same
 * reason. **It never sends on its own.** A chase that went out unread is the
 * one that nags somebody who paid last Tuesday, on the relationship they are
 * being paid to keep.
 *
 * The words are deliberately mild and they do NOT threaten anything — no
 * interest, no late fees, no "final notice". A quizmaster wants the money AND
 * the booking next month, and a stiff letter costs the second to get the
 * first a week earlier. It also gives them the out ("if it has already gone,
 * ignore this"), because the usual reason an invoice is unpaid is that
 * somebody forgot.
 *
 * The PDF goes with it. Chasing an invoice somebody has to go and find is
 * half a chase.
 */
async function chase(invoice, late) {
  const url = keyed(`/api/invoices/${encodeURIComponent(invoice.number)}.pdf`);
  const subject = `Invoice ${invoice.number} — a gentle reminder`;
  const signOff = invoice.from.contact || invoice.from.name || '';
  const lines = [
    `Hi${invoice.to.contact ? ' ' + invoice.to.contact : ''},`,
    '',
    `Hope all is well. Just a nudge on invoice ${invoice.number} for ${money(invoice.totals.due)}`
      + `${invoice.event && invoice.event.venue ? ` — ${invoice.event.venue}` : ''}`
      + `${invoice.event && invoice.event.date
        // Noon, so no timezone can pull the date back a day — the same trap
        // the invoice code itself records for a night that ends after midnight.
        ? `, ${new Date(invoice.event.date + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })}`
        : ''}.`,
    // "It IS now N days past", not "it went out N days past" — the first
    // version said the invoice was sent late, which is the opposite of the
    // point and would read as an apology.
    `It is now ${late} day${late === 1 ? '' : 's'} past its terms, so I thought I would check it reached the right person.`,
    '',
    'If it has already gone through, please ignore this — and thanks again for having us.',
    '',
    // A dangling "Best," with nothing under it is worse than no sign-off, and
    // it happens on any book where the business details are not filled in yet.
    ...(signOff ? ['Best,', signOff] : ['Thanks!']),
  ].join('\n');

  try {
    const res = await fetch(url, { headers: { 'X-Host-Key': hostKey } });
    const blob = await res.blob();
    const file = new File([blob], invoice.number + '.pdf', { type: 'application/pdf' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: subject, text: lines });
      return;
    }
  } catch (err) {
    // A cancelled share sheet throws too — the same trap `share()` records.
    if (err && err.name === 'AbortError') return;
  }

  window.open(url, '_blank', 'noopener');
  if (invoice.to.email) {
    location.href = `mailto:${encodeURIComponent(invoice.to.email)}`
      + `?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(lines)}`;
  }
}

/**
 * Send it.
 *
 * The share sheet where the phone has one, which puts the PDF straight into
 * Mail or WhatsApp from your own account. On a laptop there is no share sheet,
 * so it opens the customer's email with the subject and body written and the
 * PDF in another tab to attach — clumsier, but a laptop is where you have the
 * patience for it.
 */
async function share(invoice) {
  const url = keyed(`/api/invoices/${encodeURIComponent(invoice.number)}.pdf`);
  const subject = `Invoice ${invoice.number} — ${invoice.from.name || 'Quiz night'}`;
  const lines = [
    `Hi${invoice.to.contact ? ' ' + invoice.to.contact : ''},`,
    '',
    `Thanks for having us. Invoice ${invoice.number} is attached — ${money(invoice.totals.due)}, ${invoice.terms || 'payable on receipt'}.`,
    '',
    'Best,',
    invoice.from.contact || invoice.from.name || '',
  ].join('\n');

  try {
    const res = await fetch(url, { headers: { 'X-Host-Key': hostKey } });
    const blob = await res.blob();
    const file = new File([blob], invoice.number + '.pdf', { type: 'application/pdf' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: subject, text: lines });
      return;
    }
  } catch (err) {
    // A cancelled share sheet throws too. Falling through to the email draft
    // would then open a window they did not ask for, so only carry on if the
    // share genuinely was not available.
    if (err && err.name === 'AbortError') return;
  }

  window.open(url, '_blank', 'noopener');
  if (invoice.to.email) {
    location.href = `mailto:${encodeURIComponent(invoice.to.email)}`
      + `?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(lines)}`;
  }
}

/** A plain sheet with a title, a body and a Save. Escape and the backdrop close it. */
function sheet(title, buildBody, onSave, { saveLabel = 'Save' } = {}) {
  const overlay = node(`
    <div class="overlay">
      <div class="sheet">
        <div class="sheet-head">
          <div style="min-width:0;flex:1 1 auto"><b>${esc(title)}</b><div class="tiny inv-sheet-note"></div></div>
          <div class="sheet-actions">
            <button class="role-make inv-save">${esc(saveLabel)}</button>
            <button class="minor inv-close">Close</button>
          </div>
        </div>
        <div class="sheet-body inv-form"></div>
      </div>
    </div>`);
  const close = () => { overlay.remove(); document.removeEventListener('keydown', onKey); };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);
  overlay.querySelector('.inv-close').addEventListener('click', close);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

  const form = overlay.querySelector('.inv-form');
  const note = overlay.querySelector('.inv-sheet-note');
  buildBody(form, { close, note });

  overlay.querySelector('.inv-save').addEventListener('click', async (e) => {
    e.target.disabled = true;
    try {
      await onSave(form, { close, note });
    } catch (err) {
      note.textContent = err.message;
      note.style.color = 'var(--bad)';
      e.target.disabled = false;
    }
  });
  document.body.appendChild(overlay);
  return overlay;
}

const field = (label, name, value = '', { type = 'text', placeholder = '', wide = false } = {}) => `
  <label class="inv-field ${wide ? 'wide' : ''}">
    <span>${esc(label)}</span>
    ${type === 'textarea'
      ? `<textarea name="${name}" rows="3" placeholder="${esc(placeholder)}">${esc(value)}</textarea>`
      : `<input type="${type}" name="${name}" value="${esc(value)}" placeholder="${esc(placeholder)}">`}
  </label>`;

const valuesOf = (form) => {
  const out = {};
  for (const el of form.querySelectorAll('[name]')) out[el.name] = el.type === 'checkbox' ? el.checked : el.value.trim();
  return out;
};

/** Your own details. Typed once, printed on every invoice from then on. */
function openSettings(refresh) {
  const s = book.settings;
  sheet('Your details', (form) => {
    form.innerHTML = `
      <div class="inv-group"><h4>Who the invoice is from</h4>
        ${field('Trading name', 'name', s.business.name, { placeholder: 'Quizporium' })}
        ${field('Your name', 'contact', s.business.contact)}
        ${field('Address', 'address', s.business.address, { type: 'textarea', wide: true })}
        ${field('Email', 'email', s.business.email)}
        ${field('Phone', 'phone', s.business.phone)}
      </div>
      <div class="inv-group"><h4>How they pay you</h4>
        ${field('Account name', 'bankName', s.bank.name)}
        ${field('Sort code', 'sortCode', s.bank.sortCode, { placeholder: '00-00-00' })}
        ${field('Account number', 'accountNumber', s.bank.accountNumber)}
        ${field('Payment reference', 'reference', s.bank.reference, { placeholder: 'Leave blank to use the invoice number' })}
      </div>
      <div class="inv-group"><h4>The small print</h4>
        ${field('Payment terms', 'terms', s.terms, { type: 'textarea', wide: true })}
        ${field('Invoice number prefix', 'prefix', s.prefix, { placeholder: 'INV' })}
        <div class="tiny" style="align-self:end">Next invoice will be <b>${esc(s.prefix)}-${String(s.nextNumber).padStart(4, '0')}</b></div>
      </div>
      <div class="inv-group"><h4>VAT</h4>
        <label class="inv-field"><span>Registered for VAT</span>
          <input type="checkbox" name="vatRegistered" ${s.vat.registered ? 'checked' : ''}>
        </label>
        ${field('VAT number', 'vatNumber', s.vat.number, { placeholder: 'GB123456789' })}
        ${field('Rate %', 'vatRate', String(s.vat.ratePercent), { type: 'number' })}
        <div class="tiny wide">
          Leave this off unless you are actually registered. An invoice from somebody who
          is not registered must not mention VAT at all — so while this is off, nothing
          on the page says the word. Turning it on later does not change any invoice you
          have already sent.
        </div>
      </div>`;
  }, async (form, { close }) => {
    const v = valuesOf(form);
    await invoiceApi('/api/invoices/settings', {
      method: 'PUT',
      body: JSON.stringify({
        business: { name: v.name, contact: v.contact, address: v.address, email: v.email, phone: v.phone },
        bank: { name: v.bankName, sortCode: v.sortCode, accountNumber: v.accountNumber, reference: v.reference },
        vat: { registered: v.vatRegistered, number: v.vatNumber, ratePercent: Number(v.vatRate) || 20 },
        terms: v.terms,
        prefix: v.prefix || 'INV',
      }),
    });
    close();
    refresh();
  });
}

/**
 * The venues you work for, so an invoice is a pick rather than a retype.
 *
 * IT SAYS "VENUE", not "customer", and that is the whole reason this comment
 * is longer than it was. One record was wearing two nouns: the Venues tab
 * called it a venue, this sheet called it a customer, the launch picker and
 * the pack card and the archive all said venue — and the Venues tab had to
 * carry a sentence explaining that they were the same list, which by the house
 * rule is the tell that it is a design problem rather than a copy one.
 *
 * The wire is untouched (`/api/invoices/customers`, `book.customers`): a route
 * is not a label, and renaming one to tidy a word is how you break a backup.
 * Invoices already issued are untouched too — they carry their own copy of
 * everything, which is the point of them.
 */
function openCustomers(refresh) {
  sheet('Venues', (form) => {
    const draw = () => {
      form.innerHTML = `<div class="inv-customers">${book.customers.map((c) => `
        <div class="inv-cust" data-id="${esc(c.id)}">
          <div><b>${esc(c.name)}</b>${c.contact ? ` · ${esc(c.contact)}` : ''}
            <div class="tiny">${esc((c.address || '').replace(/\n/g, ', '))}${c.usualFeePence != null ? ` · usually ${esc(money(c.usualFeePence))}` : ''}</div>
          </div>
          <button class="minor danger del">Remove</button>
        </div>`).join('') || '<div class="tiny">Nobody yet.</div>'}</div>
        <div class="inv-group"><h4>Add a venue</h4>
          ${field('Name', 'name', '', { placeholder: 'The Crown' })}
          ${field('Contact', 'contact', '', { placeholder: 'Dave' })}
          ${field('Address', 'address', '', { type: 'textarea', wide: true })}
          ${field('Email', 'email', '')}
          ${field('Usual fee', 'usualFee', '', { placeholder: '350' })}
        </div>`;
      for (const row of form.querySelectorAll('.inv-cust')) {
        row.querySelector('.del').addEventListener('click', async () => {
          /*
           * The SAME confirm the Venues tab shows, because it is the same act
           * on the same record — `DELETE /api/invoices/customers/:id`. This
           * one had none at all: one tap and a venue's address, contact, usual
           * fee and prizes were gone, with no undo. A destructive act that
           * asks on one screen and not on the other teaches you that it does
           * not ask, which is the worse of the two ways to be inconsistent.
           */
          if (!confirm('Remove this venue? Invoices already sent keep their own copy.')) return;
          await invoiceApi(`/api/invoices/customers/${encodeURIComponent(row.dataset.id)}`, { method: 'DELETE' });
          book = await invoiceApi('/api/invoices');
          draw();
          refresh();
        });
      }
    };
    draw();
  }, async (form, { close }) => {
    const v = valuesOf(form);
    if (!v.name) throw new Error('A venue needs a name.');
    await invoiceApi('/api/invoices/customers', { method: 'POST', body: JSON.stringify(v) });
    close();
    refresh();
  });
}

/**
 * The invoice itself.
 *
 * Pre-filled from the customer and from the night that has just finished, so
 * the usual case is: check the number, press Issue, press Send.
 */
function openInvoiceForm(prefill, refresh) {
  sheet('New invoice', (form, { note }) => {
    if (!book.settings.business.name) {
      note.textContent = 'Fill in "Your details" first — an invoice with no name on it is not much use.';
    }
    // The first line describes itself from the event, and keeps doing so until
    // you type over it. Left blank it produced an invoice with a charge on it
    // and nothing saying what the charge was for, which is the one line that
    // gets an invoice queried.
    const lines = prefill.lines && prefill.lines.length
      ? prefill.lines
      : [{ description: prefill.description || 'Music quiz night', amount: '' }];

    form.innerHTML = `
      <div class="inv-group"><h4>Who it is for</h4>
        <label class="inv-field wide"><span>Venue</span>
          <select name="customerId">
            <option value="">Someone not on the list…</option>
            ${book.customers.map((c) => `<option value="${esc(c.id)}" ${prefill.customerId === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}
          </select>
        </label>
        <div class="inv-oneoff" hidden>
          ${field('Name', 'toName', '')}
          ${field('Contact', 'toContact', '')}
          ${field('Address', 'toAddress', '', { type: 'textarea', wide: true })}
          ${field('Email', 'toEmail', '')}
        </div>
      </div>
      <div class="inv-group"><h4>The event</h4>
        ${field('What it was', 'eventTitle', prefill.event?.title || 'Music quiz night')}
        ${field('Venue', 'eventVenue', prefill.event?.venue || '')}
        ${field('Date', 'eventDate', prefill.event?.date || new Date().toISOString().slice(0, 10), { type: 'date' })}
      </div>
      <div class="inv-group wide"><h4>What they owe</h4>
        <div class="inv-lines"></div>
        <button class="minor add-line" type="button">Add a line</button>
      </div>
      <div class="inv-group">
        ${field('Deposit already paid', 'deposit', prefill.deposit || '', { placeholder: '0' })}
        ${field('Anything else on the invoice', 'notes', '', { type: 'textarea', wide: true })}
      </div>
      <div class="inv-total tiny"></div>`;

    const linesEl = form.querySelector('.inv-lines');
    const totalEl = form.querySelector('.inv-total');

    // The running total is worked out here only to show you what you typed.
    // The invoice's own figures come back from the server, which is the one
    // place money is ever added up.
    const retotal = () => {
      let pence = 0;
      let bad = false;
      for (const row of linesEl.querySelectorAll('.inv-line')) {
        const raw = row.querySelector('[data-amount]').value.trim();
        if (!raw) continue;
        const parsed = readMoney(raw);
        if (parsed === null) bad = true;
        else pence += parsed;
      }
      const deposit = readMoney(form.querySelector('[name=deposit]').value.trim() || '0');
      totalEl.innerHTML = bad || deposit === null
        ? '<b style="color:var(--bad)">That does not look like an amount — try 350 or 350.00</b>'
        : `Amount due <b>${esc(money(pence - (deposit || 0)))}</b>`;
    };

    const addLine = (line = { description: '', amount: '' }) => {
      const row = node(`
        <div class="inv-line">
          <input type="text" data-desc placeholder="Music quiz night" value="${esc(line.description || '')}">
          <input type="text" data-amount placeholder="350" value="${esc(line.amount || '')}" inputmode="decimal">
          <button class="minor danger" type="button">×</button>
        </div>`);
      row.querySelector('button').addEventListener('click', () => { row.remove(); retotal(); });
      row.querySelector('[data-amount]').addEventListener('input', retotal);
      linesEl.appendChild(row);
      retotal();
    };
    for (const line of lines) addLine(line);
    form.querySelector('.add-line').addEventListener('click', () => addLine());
    form.querySelector('[name=deposit]').addEventListener('input', retotal);

    /*
     * Keep the first line reading like the night it is for, until it is edited.
     * "Music quiz night — The Crown" writes itself as you fill the form in;
     * touch the box and it stops, because from then on it is yours.
     */
    const firstDesc = () => linesEl.querySelector('.inv-line [data-desc]');
    let autoDesc = firstDesc() ? firstDesc().value : '';
    const describe = () => {
      const box = firstDesc();
      if (!box || box.value !== autoDesc) return;
      const bits = [form.querySelector('[name=eventTitle]').value.trim(), form.querySelector('[name=eventVenue]').value.trim()];
      autoDesc = bits.filter(Boolean).join(' — ');
      box.value = autoDesc;
    };
    for (const name of ['eventTitle', 'eventVenue']) {
      form.querySelector(`[name=${name}]`).addEventListener('input', describe);
    }

    // A one-off booking should not have to become a saved customer first.
    const picker = form.querySelector('[name=customerId]');
    const oneOff = form.querySelector('.inv-oneoff');
    const togglePicker = () => { oneOff.hidden = Boolean(picker.value); };
    /*
     * THE VENUE'S USUAL FEE IS THE TEMPLATE — and it was only ever applied
     * when you CHANGED the venue by hand.
     *
     * This lived inside the picker's `change` listener, which does not fire
     * when the form opens with a venue already chosen. So every invoice raised
     * the way the app actually offers — "Invoice this" on a finished night,
     * "Invoice it" on a booking, anything arriving with a customer — came up
     * with an empty amount and "Amount due £0.00", next to a box whose grey
     * PLACEHOLDER says 350. That reads as a filled-in figure at a glance,
     * which is the worst version of the fault: it looks done and is not.
     *
     * The venue's usual fee is exactly the per-venue template — it is what
     * `draft()` on the server has always used. The form simply never asked.
     */
    const fillFromCustomer = () => {
      togglePicker();
      const customer = book.customers.find((c) => c.id === picker.value);
      const first = linesEl.querySelector('[data-amount]');
      if (customer && customer.usualFeePence != null && first && !first.value) {
        first.value = money(customer.usualFeePence).replace('£', '');
        retotal();
      }
      // A venue you already know the name of should not have to be typed twice.
      const venue = form.querySelector('[name=eventVenue]');
      if (customer && !venue.value) {
        venue.value = customer.name;
        describe();
      }
    };
    picker.addEventListener('change', fillFromCustomer);
    // …and once on the way in, for a form that arrives already knowing whose
    // night it is.
    if (picker.value) fillFromCustomer();
    togglePicker();
    picker.dispatchEvent(new Event('change'));
  }, async (form, { close }) => {
    const v = valuesOf(form);
    const lines = [...form.querySelectorAll('.inv-line')].map((row) => ({
      description: row.querySelector('[data-desc]').value.trim(),
      amount: row.querySelector('[data-amount]').value.trim() || '0',
    })).filter((l) => l.description || l.amount !== '0');

    const done = await invoiceApi('/api/invoices', {
      method: 'POST',
      body: JSON.stringify({
        customerId: v.customerId,
        toName: v.toName, toContact: v.toContact, toAddress: v.toAddress, toEmail: v.toEmail,
        event: { title: v.eventTitle, venue: v.eventVenue, date: v.eventDate },
        lines,
        deposit: v.deposit || '0',
        notes: v.notes,
      }),
    });
    close();
    refresh();
    // Straight into sending it, because that is what you opened this to do.
    share(done.invoice);
  // "Save" is ambiguous on an invoice — saved as a draft, or sent? This one
  // hands out a number and cannot be taken back, so it says so.
  }, { saveLabel: 'Issue and send' });
}

/** Mirrors toPence in src/invoices.js — same rules, so the same things are refused. */
function readMoney(input) {
  const cleaned = String(input ?? '').trim().replace(/[£,\s]/g, '');
  if (!cleaned) return null;
  if (!/^-?\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const negative = cleaned.startsWith('-');
  const [pounds, pence = ''] = cleaned.replace('-', '').split('.');
  const total = Number(pounds) * 100 + Number(pence.padEnd(2, '0'));
  return negative ? -total : total;
}
