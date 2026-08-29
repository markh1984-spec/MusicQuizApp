/**
 * The console: where a night starts.
 *
 * Pick a game, pick a pack, launch. Everything you have ever saved is here,
 * so a quiz you wrote for a Harry Potter night in March is one tap away in
 * November — that is the whole point of packs being files rather than
 * something typed in fresh each time.
 */

import { brandLink, brandMark, esc, menuRights, node, paintIdentity, paintNav, postJson } from './client.js';
import { accountSection, backupWarning, firstOwnerPanel, helpSection, otherRoomsPanel, settingsSection, shopSection } from './console-account.js';
import { diarySection } from './console-diary.js';
import { generatePanel, importPanel, quizGeneratePanel } from './console-generate.js';
import {
  asksSection, communityBench, leagueSection, photosSection,
} from './console-community.js';
import { asksPanel, fillNightDetail, gigsSection } from './console-gigs.js';
import { invoicesSection } from './console-invoices.js';
import { gameSection, packActionsMarkup, preview, wirePackActions } from './console-packs.js';
import { editPopover } from './console-editor-popover.js';
import { shelfFor, showsSection } from './console-shows.js';
import { BENCH_STORE, NIGHT_BENCH_STORE, bench, gigsSeen, lastDone, library, me, nightBench, nightDrag, packDrag, setAccountsExist, setBench, setGigsSeen, setLastDone, setLibrary, setMe, setNightBench, setNightDrag, setPackDrag } from './console-state.js';
import { aNightIsOn, dragging, launchBar, night, putNightOnBench, putOnBench, runningPanel, wantPackFromUrl } from './console-tonight.js';
import { advertsSection, editAdvertSet, forgetPanel, venuesSection } from './console-venues.js';
import { upcoming } from './diary.js';
import { packLookAttrs, shortTitle, isBreakoutPack } from './pack-look.js';
import { FEATURES, setTierOverrides, tierOf } from './plans.js';
import { paintScheme } from './schemes.js';

/**
 * PINNING A PACK — "keep this one where I can reach it".
 *
 * Asked for on 15 August 2026: *"a pin feature could be cool, just a little pin
 * in the corner that comes on and off"*, and the reason it earns its place is
 * the one the host gave for the six-pack shelf: **drag and drop only works
 * while the card and the slot are both on screen.** A pin is not decoration or
 * a favourite — it is the control that decides what is in REACH.
 *
 * **TOP LEFT, because every other corner is taken.** An own-pack carries its
 * *Yours* badge top right and the era word runs off the bottom right. Top left
 * is also where the eye starts, so it reads as a status rather than an
 * ornament.
 *
 * **PER ACCOUNT, NOT PER DEVICE** — `prefs.pinnedPacks`, saved through the
 * same `/api/me/prefs` the ask-the-room switch uses. A pin lost by opening the
 * console on the laptop instead of the phone is a setting nobody would trust.
 *
 * **AND A PIN IS NOT A LAUNCH.** It changes what is in reach and nothing else.
 * That matters on this screen specifically: a mis-aimed drop here used to
 * destroy a whole running order, so a second gesture in the corner of the same
 * card must not be able to start a night.
 */
/**
 * **NOT ON THE HOST KEY**, because there is nowhere to keep it.
 *
 * `whoIs()` prefers the key over any signed-in session, so `/api/me/prefs`
 * answers *"the host key is not an account, so there is nothing to remember
 * this against"* — correctly. Drawn anyway, the pin would alert on every
 * single press and never save, which is the one thing this file's rules
 * forbid outright: a control that ignores you.
 *
 * Hidden rather than disabled, unlike Launch and Set it up: those go inert
 * because they will work again in a moment, once a pack is chosen. This one
 * cannot work at all on this identity — the same reason `/api/me` sends
 * `tiers: []` to a real quizmaster rather than showing them a hat switch they
 * can never use.
 */
export const canPin = () => Boolean(me && !me.bootstrap);

/**
 * How many packs the shelf shows before you have to search or press See all.
 *
 * SIX, and it is one row on a laptop by construction — the grid is six columns
 * — which is the whole point: a drag needs the card and the Tonight slot on
 * screen at once, and a second row is a scroll away from the thing you are
 * dragging into.
 */
export const PACK_SHELF = 6;

export const pinnedPacks = () => (library && library.prefs && library.prefs.pinnedPacks) || [];
export const isPinned = (id) => pinnedPacks().includes(id);

/**
 * WHERE a pin sits, not merely THAT it is pinned.
 *
 * The shelf used to sort on `isPinned(b) - isPinned(a)`, a boolean, so six
 * pinned packs came back in whatever order the ranking underneath happened to
 * put them — the pin kept its membership and lost its arrangement. That is the
 * half of a pin that matters once only SIX are shown: the point is to decide
 * what is in REACH, and reach means position as well as presence.
 *
 * Unpinned packs sort after every pinned one rather than among them.
 */
export const pinRank = (id) => {
  const at = pinnedPacks().indexOf(id);
  return at === -1 ? Number.MAX_SAFE_INTEGER : at;
};

/** The drawn pin. Never an emoji — the same rule `binIcon()` follows. */
export function pinIcon() {
  return `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor"
    d="M14.5 2.6a1.4 1.4 0 0 1 2 0l4.9 4.9a1.4 1.4 0 0 1 0 2l-.5.5a3.4 3.4 0 0 1-3.6.8l-2.6 2.6.2 3.4a1.4 1.4 0 0 1-2.4 1.1l-3.3-3.3-4.3 4.3a1 1 0 0 1-1.4-1.4l4.3-4.3-3.3-3.3a1.4 1.4 0 0 1 1.1-2.4l3.4.2 2.6-2.6a3.4 3.4 0 0 1 .8-3.6z"/></svg>`;
}

export async function togglePin(id, btn) {
  const have = ((library.prefs || {}).pinnedPacks) || [];
  const want = have.includes(id) ? have.filter((p) => p !== id) : [...have, id];
  btn.disabled = true;
  try {
    const res = await fetch(keyed('/api/me/prefs'), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'X-Host-Key': hostKey },
      body: JSON.stringify({ pinnedPacks: want }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Could not save that');
    library.prefs = data.prefs;
    render();
  } catch (err) {
    btn.disabled = false;
    // SAY SO. A pin that silently did not save is one somebody relies on
    // being there next week.
    alert('Could not pin that: ' + err.message);
  }
}

/**
 * REARRANGE THE PINS, without disturbing the other game's.
 *
 * `prefs.pinnedPacks` is ONE list holding both quiz and bingo ids together —
 * there has never been a reason to split it, because `pinRank()` only ever
 * compares two packs of the SAME kind (the shelf sorts one kind at a time).
 * So reordering quiz's pins can drop bingo's out and back in at the end
 * without changing what either shelf shows.
 *
 * @param {string[]} orderedIds  this kind's pins, in their new order
 * @param {string[]} otherIds    every OTHER kind's pins, untouched
 */
export async function reorderPins(orderedIds, otherIds) {
  const res = await fetch(keyed('/api/me/prefs'), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'X-Host-Key': hostKey },
    body: JSON.stringify({ pinnedPacks: [...otherIds, ...orderedIds] }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Could not save that order');
  library.prefs = data.prefs;
}

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
export function packWord(look) {
  if (!look.word) return '';
  return `<span class="pack-word" aria-hidden="true"
    style="--pk-word-size: ${look.wordSize}px">${esc(look.word)}</span>`;
}

const mainEl = document.getElementById('main');
const runningEl = document.getElementById('runningNow');

/**
 * The key is remembered on this device once you have arrived with it in the
 * address, so you can bookmark plain /console and never think about it again.
 */
export const hostKey = new URL(location.href).searchParams.get('key')
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

export const keyed = (path) => path + (path.includes('?') ? '&' : '?') + 'key=' + encodeURIComponent(hostKey);

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
export const keyInUrl = new URL(location.href).searchParams.get('key') || '';
export const linkTo = (path) => (keyInUrl ? keyed(path) : path);

/**
 * A LINK TO ANOTHER DOOR AND TAB — because a message that says "do it over
 * there" has to be able to take you there.
 *
 * Set as a standing rule: *"whenever a part of the site says 'you can't do X
 * here, you can do it there instead' it MUST link to that other place."*
 *
 * It is the *clarity beats everything* rule applied to prose rather than to a
 * control. Telling somebody the answer is on another tab and leaving them to
 * find it is a control that needs explaining, split across two screens — and
 * the empty states are exactly where it happens, because an empty state is
 * written by whoever built the panel and read by somebody who has never seen
 * it before.
 *
 * One helper rather than an anchor typed out per message, so the key rides
 * along every time (`linkTo`) and a renamed door is one edit.
 */
export function goTo(door, tab, words) {
  const q = [door && door !== 'console' ? `door=${door}` : '', tab ? `tab=${tab}` : ''].filter(Boolean);
  const path = `/console${q.length ? `?${q.join('&')}` : ''}`;
  return `<a href="${esc(linkTo(path))}">${esc(words)}</a>`;
}

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
export function screenLink() {
  const code = library && library.joinCode;
  return linkTo(code ? `/screen?g=${encodeURIComponent(code)}` : '/screen');
}

// What goes in the menu — worked out once, from /api/me, the same way on
// every page. See `menuRights` in client.js.
let rights = { control: false, packs: false, owner: false };
export const can = (feature) => !me || !me.entitlements || me.entitlements.features.includes(feature);
/** Which tier a feature first appears on, for the markers that name it. */
// `tierOf`, not the shipped default — the lock badge on a tab says WHICH tier
// buys it, and the owner can move a feature between them. A badge reading
// SILVER on something that is now Gold is the app quoting a price that is not
// the price.
const tierNeeded = (feature) => tierOf(feature) || '';

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

export async function load() {
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
    setMe(who.signedIn ? who.account : null);
    rights = menuRights(who);
    /*
     * THE LIVE LADDER, BEFORE ANYTHING DRAWS A LOCK BADGE.
     *
     * `plans.js` runs in this page too and its overrides start empty, so
     * without this the console would work off the tiers the app SHIPS with
     * rather than the ones the owner has arranged — a Silver badge on a
     * feature that is now Gold, which is the app quoting a price that is not
     * the price. Here rather than lower down because `visibleTabs()` and
     * `tierNeeded()` both read it on the very first render.
     */
    setTierOverrides(who.featureTiers || {});
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
    setMe(null);
  }

  setAccountsExist(await hasAccounts());

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
  setLibrary(await res.json());
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
        <!-- "LAY IT OUT EMPTY", NOT "START WRITING" — and the rename is a
             collision fix rather than a wording preference. This panel is the
             visual twin of the owner's AI generator: same theme box, same
             round tickboxes with counts, same green button. "Start writing" is
             precisely what the AI one does, so the host read this as an AI
             feature on a quizmaster's tab and said so. If it reads that way to
             the person who built it, a subscriber will press it expecting a
             written quiz and get twenty blank questions.

             The button now says what actually happens. The blurb underneath
             already did, but a blurb under a button is read after the press. -->
        <!-- "WRITE IT MYSELF" — third name, and this one says WHO DOES THE
             WRITING, which is the only thing anybody needs to know here.

             It was "Start writing", which is exactly what the owner's AI panel
             does, so the host read this as an AI feature on a quizmaster's
             tab. Then "Lay it out empty", which describes the MECHANISM rather
             than the act and reads like a chore. **"Compose"** is the host's
             own word and it is the best of the three: it is what a person does
             rather than what the software does, it carries no suggestion that
             anything is written FOR you, and it is one word on a button beside
             a text box, which is what this app's house style asks for. -->
        <button class="role-make own-go">Compose</button>
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
export function ownPacksNote() {
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
export const QUIZ_ROUNDS = [
  ['text', 'General knowledge', 10, true, ''],
  ['image', 'Whose face', 10, true, 'An illustrated portrait that pulls back as the clock runs down'],
  ['intro', 'Name that intro', 10, true, 'You play the first few seconds off your own music app'],
  ['multi', 'Pick them all', 10, false, 'Several answers are right — the room locks in all of them'],
  ['alphabet', 'First letter', 10, false, 'No options: they get a keyboard and only the first letter of the answer has to be right'],
  ['breakout', 'Breakout', 5, false, 'Nothing scored — the room types whatever they like and you read the funny ones out'],
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
export const TABS = [
  {
    id: 'quiz',
    doors: ['console', 'workshop'],
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
       * **AND IT MOVED TO THE COMMUNITY DOOR ON 23 AUGUST 2026.** The
       * reasoning above is still true — this answers "what should I write
       * next" and that is decided here — and it lost to a better one: it is
       * the players' own voice, and the players have a door now.
       *
       * **A LINK, NEVER A SECOND COPY.** The panel is a QUEUE: Yes keeps an
       * idea, No bins it, and a triage list drawn in two places is two lists
       * that disagree about what has been dealt with — which is what the note
       * above already says. So what stays here is one line, only when
       * something is actually waiting, which is this project's own rule that
       * "do it over there" must be a link to there.
       */
      wrap.appendChild(asksLink());
      if (can(FEATURES.GENERATE)) wrap.appendChild(quizGeneratePanel(library.generation || {}));
      if (can(FEATURES.OWN_PACKS) && !can(FEATURES.CATALOGUE)) wrap.appendChild(ownQuizPanel());
      return wrap;
    },
  },
  {
    id: 'bingo',
    doors: ['console', 'workshop'],
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
    /*
     * PREPARE A NIGHT — a whole evening, built in advance and dragged onto
     * Tonight.
     *
     * The host's own diagnosis: *"the launch bar is launching nights, but
     * we're frankensteining nights instead of having a nights section. You
     * build a night in advance and then just drag it in onto the launch
     * console."* The bar composes a night AT THE MOMENT OF LAUNCHING IT,
     * which is the worst time in the week to be composing anything.
     *
     * **THE TAB WAS CALLED "SHOWS", AND IT WAS MISTAKEN FOR PAST GIGS** — the
     * two are opposites (evidence versus organisation), but nothing about the
     * word said which. Renamed to **Prepare a night**, a verb phrase rather
     * than a noun, on the reasoning that this IS an action a quizmaster
     * takes, not a shelf of objects with a genre name. `id`, the code, the
     * data field and the file names all still say `show`/`shows` throughout
     * — an internal name and a displayed one are allowed to differ, and
     * renaming every function, file and API route to match would be a large,
     * separate risk for no visible benefit; only what a quizmaster reads
     * changed. **"NIGHT" WAS STILL AVOIDED AS A BARE NOUN** for the reason
     * below — Calendar's own things are bookings, Gigs' are the archived
     * record of one that happened — but a VERB PHRASE using the word is a
     * different collision risk than a third tab plainly labelled "Nights",
     * and the host chose it anyway, to see whether it reads clearly in
     * practice once it is actually on screen next to those other two.
     *
     * **BEHIND BOTH DOORS, like Venues, and for the same reason.** In the
     * Workshop it is a thing you build and tidy; on the Console it is a shelf
     * you drag off, ten minutes before a gig, with nothing else on it.
     */
    id: 'shows',
    doors: ['console', 'workshop'],
    needs: FEATURES.LIBRARY,
    label: 'Prepare a night',
    blurb: 'A whole evening, built in advance — packs, venue, prizes and settings.',
    count: () => (library.shows || []).length,
    render: () => showsSection(),
  },
  {
    id: 'adverts',
    doors: ['workshop'],
    needs: FEATURES.ADVERTS,
    label: 'Adverts',
    blurb: 'A set of slides per venue. Put any of them up between rounds.',
    count: () => (library.adverts || []).length,
    render: () => advertsSection(library.adverts || []),
  },
  {
    /*
     * THE DIARY, ITS OWN TAB — left of Past gigs, because the evening runs
     * left to right and what is BOOKED comes before what has been RUN.
     *
     * **INVOICES STAYS ITS OWN TAB TOO, DELIBERATELY.** It is a different
     * question ("who owes me?") asked at a different moment, it has a whole
     * tab's worth behind it — your details, the bank, VAT, statuses, the PDF
     * — and its badge counts what you are still owed, which is a number
     * worth seeing without opening anything. Past gigs' own bench does NOT
     * carry an "Invoice this" shortcut any more — it did once, and it was a
     * second entry point into the identical form Invoices already owns.
     * Bill from there; Past gigs is where you find the night, not where you
     * bill it.
     */
    id: 'diary',
    doors: ['account'],
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
    /*
     * THE LEAGUE FINALLY HAS A PAGE. It has existed since `src/league.js` was
     * written and its only home was a block on a venue card — one venue at a
     * time, behind the Workshop door, found by going looking. Nothing about
     * the arithmetic changed; it got somewhere to be read.
     */
    id: 'league',
    doors: ['community'],
    needs: FEATURES.LEAGUE,
    label: 'Quiz league',
    blurb: 'The same teams, ranked over a season, per venue.',
    // How many venues have a season running — not how many teams, which is a
    // number that means nothing until you know how many rooms it is spread
    // across, and not how many nights, which only ever goes up.
    count: () => Object.keys(library.leagues || {}).length,
    render: () => leagueSection(),
  },
  {
    /*
     * PHOTOS ARE ABOUT THE PEOPLE, and Past gigs keeps its own grid.
     *
     * The same pictures do two jobs: there a photo is EVIDENCE, beside the
     * headcount, the winner and the report a landlord is shown; here it is
     * the room itself. What is NOT duplicated is the code — the strip, the
     * bin, the "Screen only" badge and the publish control are `nightPhotos()`
     * in `console-gigs.js`, called from both.
     */
    id: 'photos',
    doors: ['community'],
    needs: FEATURES.PHOTOS,
    label: 'Photos',
    blurb: 'Every picture the room took, under the venue it was taken in.',
    render: () => photosSection(),
  },
  {
    /*
     * MOVED off the Music Quiz tab rather than copied — see `asksLink()`.
     * No `count`: the number that matters is on the rows themselves, and a
     * badge on a tab you visit to TRIAGE would only ever say "there is still
     * work", which the list says better.
     */
    id: 'asks',
    doors: ['community'],
    label: 'What they asked for',
    blurb: 'What the room voted for, from their own phones at the end of the night.',
    render: () => asksSection(),
  },
  {
    id: 'past',
    doors: ['post'],
    needs: FEATURES.PAST_GIGS,
    label: 'Past gigs',
    blurb: 'Every night you have run — the evidence you show a venue.',
    // NIGHTS, not games. A quiz and the bingo after it are one evening, and a
    // badge saying 5 above a list of four rows is a badge nobody trusts.
    count: () => library.archiveNights || 0,
    render: () => gigsSection(),
  },
  {
    id: 'invoices',
    doors: ['post'],
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
    /*
     * BEHIND BOTH DOORS, because a venue is two different things.
     *
     * In the Workshop it is a record you maintain — the address, the usual
     * fee, where to send them, the advert slides. On the Console it is a
     * DRAG SOURCE: pulling a venue card up to Tonight is what loads that
     * pub's prizes, its voucher and what the night gets filed under, and
     * `venueDrag` has done exactly that since the drop zones were built. The
     * cards were simply behind a door you would not be standing at ten
     * minutes before a gig.
     *
     * Asked for in those words: *"need to add venues to the console so you
     * can drag which venue you're at, as that will load up the venue
     * settings."*
     */
    doors: ['console', 'workshop'],
    needs: FEATURES.INVOICES,
    label: 'Venues',
    blurb: 'The places you play, and what they put up as prizes.',
    count: () => (library.venueRecords || []).length,
    render: () => venuesSection(),
  },
  {
    /*
     * ACCOUNT AND SETTINGS ARE TWO TABS AGAIN, and this time it holds.
     *
     * They were merged because both halves had shrunk to almost nothing — but
     * the reason each had shrunk is that the SELL was in here with them, and
     * the sell now has a room of its own. See `accountSection()`.
     *
     * **HELP STAYS ITS OWN TAB.** It is where somebody goes when something is
     * wrong — including when the thing that is wrong is their subscription —
     * and burying it inside a page called Account makes it hardest to find at
     * the moment it matters most. Same reason it carries no `needs` at all.
     */
    id: 'account',
    doors: ['account'],
    /*
     * CALLED "ACCOUNT" WHERE THE DOOR IS CALLED "MY ACCOUNT", and that is a
     * superset naming its first tab rather than the label collision this file
     * warns about. The door holds four tabs; this is the one about who you
     * ARE. If it ever reads as a duplicate, rename the TAB — the door is the
     * name the host chose.
     */
    label: 'Account',
    blurb: 'Who you are, what you are on, and your room.',
    // Always here, whatever is switched off — it is where things are switched
    // back on, so it can never be one of the things that goes away.
    render: () => accountSection(),
  },
  {
    /*
     * THE SHOP — packs and the rungs, in one room.
     *
     * *"Shop will be the place they can buy packs and upgrade their
     * subscription."* It used to be a section under the pack shelf on the
     * Workshop door, which put something to spend money on at the bottom of
     * the page somebody opens to work — and put the pack price a whole tab
     * away from the tier that is the other way to get the same packs.
     *
     * **`needs: BUY_PACKS`, so a quizmaster who cannot buy is not shown a
     * till.** That is the same rule the tab bar already follows everywhere:
     * above your tier is drawn greyed with a price, switched off by you is
     * gone. A shop nobody can buy from is the second of those.
     *
     * (This was `FEATURES.CATALOGUE` — the OWNER'S right to write the
     * catalogue, not a quizmaster's right to buy from it — which hid the
     * tab from every non-owner account on every tier. Found by a design
     * audit, not by anybody clicking around.)
     */
    id: 'shop',
    doors: ['account'],
    needs: FEATURES.BUY_PACKS,
    label: 'Shop',
    blurb: 'Packs to buy, and the tier above the one you are on.',
    count: () => [...(library.quizzes || []), ...(library.bingo || [])].filter((p) => p.locked).length,
    render: () => shopSection(),
  },
  {
    /*
     * SETTINGS — what you have switched ON, as opposed to what you HAVE.
     *
     * Asked for as its own tab, and the test for what belongs on it is that
     * one word: a fact goes on Account, a switch goes here. Without that line
     * this is the tab that slowly becomes a bin.
     *
     * No `needs`, like Account and Help: it is where things are switched back
     * on, so it can never be one of the things that goes away.
     */
    id: 'settings',
    doors: ['account'],
    label: 'Settings',
    blurb: 'Your colours, what the room may ask for, and which tabs you want.',
    render: () => settingsSection(),
  },
  {
    /*
     * HELP IS LAST BEHIND THIS DOOR, which is the *rarely-touched goes last*
     * rule and not a demotion: it is the one tab here you hope never to need,
     * and it is still one predictable tap from every page in the app.
     */
    id: 'help',
    doors: ['account'],
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
];

/**
 * THE DOORS — Console, Workshop, Post gig, My account.
 *
 * Asked for on 15 August 2026: *"this section needs to say Console, Workshop
 * and Post gig and function like that"*, and the names are better than the
 * before/during/after they replace — **Console keeps its name and means the
 * night**, so the one thing everybody already knows (Console is where you
 * start a quiz) does not have to be re-learned.
 *
 * **It is one page with a filtered tab bar, not three pages.** `TABS` already
 * drives the whole tab system, so a `doors` list on each entry is the entire
 * mechanism. That also solves the panel move for nothing: **Music Quiz appears
 * behind BOTH doors** — the shelf on the Console, the writing and buying
 * panels in the Workshop — same tab, different door, different body. Nothing
 * had to be extracted into a shared module, which was the expensive part of
 * the plan this replaces.
 *
 * **Console is the default**, so every existing link, bookmark and `?tab=`
 * still lands where it always did.
 */
/*
 * THE FOUR DOORS. Console · Workshop · Post gig · My account.
 *
 * The fourth was asked for once there was somewhere obvious for it to lead:
 * *"we need a fourth pill at the top — My Account. Then Calendar, Help and
 * Shop all live there."*
 *
 * **It is the door for things that are about YOU rather than about a night**,
 * which is what makes it the honest fourth rather than a bin. The Workshop had
 * become one: it held the packs you write, the adverts you sell, the venues
 * you play — and also your calendar, the support box and your subscription,
 * which have nothing to do with preparing a quiz.
 *
 * **And the Shop belongs here for a reason worth writing down.** It sat under
 * the pack shelf on the Workshop door, which put something to spend money on
 * at the bottom of the page somebody opens to WORK. A shop is a place you go,
 * not a thing that follows you around — and next to the tiers, which is the
 * other way to get the same packs, it is finally in the same room as its own
 * alternative.
 */
/*
 * AND A FIFTH, asked for on 23 August 2026: *"a fifth menu pill at the top
 * entitled 'community', which is for things like quiz leagues, and all the
 * controls for that functionality will live there."*
 *
 * **It goes FOURTH in the list and My account stays last.** The first three
 * name moments of a night; this names the thing that spans nights and belongs
 * to the ROOM rather than to the quizmaster — which is precisely why a league
 * had nowhere good to live and ended up as a block on a venue card, visible
 * one venue at a time and only if you went looking. My account keeps the end,
 * where an account link sits on every website anybody has ever used.
 */
const DOORS = ['console', 'workshop', 'post', 'community', 'account'];

export function doorNow() {
  const d = new URL(location.href).searchParams.get('door') || '';
  return DOORS.includes(d) ? d : 'console';
}

/** Which doors a tab is behind. Absent means the Workshop — a new tab is
 *  preparation until somebody says otherwise, never the launch page. */
const doorsOf = (tab) => (Array.isArray(tab.doors) && tab.doors.length ? tab.doors : ['workshop']);

export const TAB_STORE = 'musicquiz.consoletab';

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

export function currentTab() {
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

export function showDone(tone, html) {
  setLastDone({ tone, html });
}

function doneBanner() {
  if (!lastDone) return [];
  const el = node(`
    <div class="panel done-banner ${lastDone.tone}">
      <div class="done-text">${lastDone.html}</div>
      <button class="minor done-close" title="Dismiss">Close</button>
    </div>`);
  el.querySelector('.done-close').addEventListener('click', () => { setLastDone(null); render(); });
  return [el];
}

export function render() {
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
  // The lit door is the one you are behind, not always "console" — all three
  // are this same page, so the menu cannot work it out from the address alone.
  paintNav(document.getElementById('navSlot'), { current: doorNow(), key: keyInUrl, ...rights });

  const active = currentTab();
  /*
   * WHICH DOOR, ON THE BODY, so the stylesheet can answer it too.
   *
   * A handful of controls read differently behind different doors — the pack
   * card's caret says "this opens" and on the Console it puts the pack in
   * Tonight instead. Doing that in CSS off one attribute beats threading a
   * flag through every template, and it means a rule that gets it wrong is one
   * selector rather than a branch in a builder.
   */
  document.body.dataset.door = doorNow();
  const live = Boolean(running && running.phase !== 'lobby' && running.phase !== 'finished');

  /*
   * THE BACKUP WARNING IS NOT ON THE CONSOLE DOOR — same rule the pack shelf
   * itself follows: "nothing is between the console and the packs, remove
   * everything else." It renders unconditionally at the top of every render,
   * which puts it above the Tonight bar on the one door that exists to
   * launch fast — a touch-target audit found Launch pushed below ~900px of
   * scroll on a phone, partly by this. It loses no urgency: still full
   * prominence on every other door, which is where packs are actually
   * generated and edited — the thing the warning is about. Only its SCOPE
   * changes, not its loudness, and it is unbounded in TIME (any host who
   * never sets GITHUB_TOKEN sees it forever), unlike `firstOwnerPanel()`
   * below, which is a true one-time gate and stays exactly where it was —
   * `/console?key=...` with no `?door=` lands on the console door by
   * default, and that link is the ONLY way in on a fresh install with no
   * shell (Render's free tier). Hiding it there would remove the one way to
   * ever see it.
   */
  mainEl.replaceChildren(
    ...(doorNow() !== 'console' ? backupWarning(library.generation || {}) || [] : []),
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
    /*
     * TONIGHT AND THE RUNNING PANEL ARE ON THE CONSOLE DOOR ONLY.
     *
     * Tonight used to sit at the top of every tab so a night could be launched
     * from wherever you were. **That guarantee survives the doors and is
     * better served by them**: the promise was never "a launch panel on every
     * tab", it was *launching is always one predictable move away* — and
     * pressing Console is that move. What it buys back is a launch bar that is
     * no longer furniture on Invoices, Venues and Calendar, which is most of
     * the reason for the doors at all.
     */
    doorHead(
      (doorNow() !== 'console' ? node('<div></div>') : (live ? node('<div></div>') : launchBar())),
      doorNow() === 'console' ? runningPanel(running) : node('<div></div>'),
      doorNow() === 'workshop' ? workBench() : node('<div></div>'),
      doorNow() === 'post' ? nightBenchPanel() : node('<div></div>'),
      doorNow() === 'community' ? communityBench(active) : node('<div></div>'),
    ),
    consoleColumns(tabBar(active), tabBody(active)),
  );
}

/**
 * THE DOOR'S OWN AREA AT THE TOP, WHICH DOES NOT SCROLL.
 *
 * Asked for after the Console's layout was named as the thing that works:
 * *"everything I need is on the screen — no scrolling down and no BS before a
 * gig… I want each pill section to have their own area at the top that doesn't
 * scroll with the page, and the menu on the side doesn't scroll, but the
 * contents DO."*
 *
 * **The reason it matters is not tidiness, it is that the reason you opened a
 * door should still be on screen when you have scrolled to the thing you came
 * for.** On the Console that is Tonight, and a pack dragged from the bottom of
 * the shelf now always has its target in view — which is most of what
 * `pinTonightWhereItIs()` was invented to fake during a drag.
 *
 * It is one wrapper rather than a rule per panel, so a door that grows a panel
 * later inherits the behaviour instead of having to remember it.
 */
/**
 * THE WORKSHOP BENCH — the door's own section at the top, in the same place
 * and of the same weight as Tonight.
 *
 * *"I can then drag quiz packs there to edit them as a QM, or start a fresh
 * one — that's what that section is there to do."*
 *
 * **IT MIRRORS TONIGHT DELIBERATELY**: the same head line, the same dashed
 * drop area, the same one primary button at the bottom. Two doors that behave
 * the same way are one thing to learn rather than two, which is the whole
 * reason the shell exists — and it is why the drop zone is built from
 * `.lb-tile` and `.lb-drop`, the classes Tonight already uses, rather than a
 * second set that would drift.
 *
 * **THE PRIMARY IS GREEN, NOT THE ACCOUNT GRADIENT.** One filled gradient per
 * screen means "the night", and there is no night behind this door; making
 * something new is the green role. So the Console has exactly one Launch and
 * the Workshop has exactly one Write a new one, and neither can be mistaken
 * for the other in a dark pub.
 *
 * **A pack on the bench is NOT opened automatically.** Dropping is choosing,
 * pressing is doing — the same promise every other drop in this app makes.
 */
const WORK_BENCH_OPEN_STORE = 'musicquiz.workbenchopen';
const NIGHT_BENCH_OPEN_STORE = 'musicquiz.nightbenchopen';

/**
 * A SIMPLE FOLD, shared by the Workshop and Post gig benches — asked for as
 * *"all three benches need consistent functionality — hide/expand"*, Tonight
 * already having one. Same classes as Tonight's own `.lb-fold` (so it is one
 * visual language, not three), but not its per-element TUCKING — that exists
 * because Tonight has several named sub-sections (venue picker, mode switch,
 * running order) that each need their own fold behaviour. These two benches
 * hold one thing each, so one body wrapper hidden or shown whole is the
 * whole mechanism.
 *
 * Read from localStorage on every call rather than held in a module
 * variable — both benches rebuild their whole panel from scratch on every
 * redraw (`draw()` in `nightBenchPanel()`, `render()` on the workshop door),
 * so state that lived only in a closure would reset itself the moment
 * anything else on the page changed.
 */
function wireBenchFold(el, storeKey) {
  let open = localStorage.getItem(storeKey) !== '0';
  const fold = el.querySelector('.lb-fold');
  const body = el.querySelector('.bench-fold-body');
  const paint = () => {
    fold.setAttribute('aria-expanded', open ? 'true' : 'false');
    fold.querySelector('.lb-fold-word').textContent = open ? 'Hide' : 'Show';
    if (body) body.hidden = !open;
  };
  fold.addEventListener('click', () => {
    open = !open;
    localStorage.setItem(storeKey, open ? '1' : '0');
    paint();
  });
  paint();
}

function workBench() {
  const on = bench ? shelfFor(bench.kind).find((p) => p.id === bench.id) : null;
  // A pack that has been deleted since it was put on the bench leaves quietly
  // rather than drawing a tile for something that is not there.
  if (bench && !on) { setBench(null); localStorage.removeItem(BENCH_STORE); }

  const look = on ? packLookAttrs(on, bench.kind === 'quiz' && isBreakoutPack(on) ? 'breakout' : bench.kind) : null;

  const el = node(`
    <div class="panel launchbar bench">
      <div class="lb-head">
        <div class="lb-what">
          <span class="bench-where">On the bench</span>
          <span class="tiny lb-shut-what">${on ? esc(shortTitle(on.title)) : 'Nothing yet'}</span>
        </div>
        <div class="lb-right">
          <button class="lb-fold" type="button" aria-expanded="true"><span class="lb-fold-word"></span></button>
        </div>
      </div>
      <!-- THE SLOT ON THE LEFT, WHAT YOU DO WITH IT ON THE RIGHT.
           Reported as *"I don't want a tiny button taking up a whole row"* -
           and that was the fault: one small green button stretched across a
           panel, under a drop zone half its width. A button's width should say
           how big the action is, and "write a new one" is not a full-width
           decision the way Launch is. Two columns put the buttons beside the
           thing they act on and let each one be its own size. -->
      <div class="bench-body bench-fold-body">
        <div class="bench-slot">
          ${on ? `
            <div class="lb-tile is-pack ${look.cls}" style="${look.style}" title="${esc(on.title)}">
              ${packWord(look)}
              <button class="lb-tile-off bench-off" type="button" aria-label="Take it off the bench">&times;</button>
              <b class="lb-tile-name">${esc(shortTitle(on.title))}</b>
              <span class="tiny lb-tile-sub">${esc(bench.kind === 'bingo' ? 'bingo' : 'quiz')}</span>
            </div>` : `
            <div class="lb-drop bench-drop">
              <span class="lb-drop-plus">+</span>
              <span>Drag a pack here</span>
            </div>`}
        </div>
        <div class="bench-do">
          ${on ? `
            <button class="go bench-go role-make" type="button">Edit the questions</button>
            <button class="minor bench-read" type="button">Read it through</button>
            <a class="minor bench-tonight" href="${esc(linkTo(`/console?tonightPack=${encodeURIComponent(on.id)}&tonightKind=${bench.kind}`))}">Take it to Tonight</a>
            <p class="tiny">Saved as you go. Take it off when you are done with it.
              Set it up on Tonight and press <b>Keep this as a show</b> to save the
              whole evening — the venue, the prizes, the order — not just this pack.</p>`
    : `
            <a class="go bench-go role-make" href="${esc(linkTo('/editor'))}">Write a new one</a>
            <p class="tiny">Or drag a pack in from below to edit, rename or read
              one you already have.</p>`}
        </div>
        <!-- RENAME, DELETE, PICTURES, PLAYLIST, A COPY TO KEEP — everything a
             pack card itself used to open a caret to reach, before a tap
             started putting the pack here instead. bench-pack-actions is its
             own class rather than the Post gig bench's bench-actions, which
             already means "one row of buttons flexed to fit" — reusing it
             here would fight pack-actions' own grid for the same property,
             the exact label collision this app keeps a rule against.
             grid-column: 1 / -1 in the stylesheet is what spans it under both
             columns of the slot-and-buttons row above. -->
        ${on ? `<div class="bench-pack-actions">${packActionsMarkup(bench.kind, on)}</div>` : ''}
      </div>
    </div>`);

  el.querySelector('.bench-off')?.addEventListener('click', () => putOnBench(null));
  el.querySelector('.bench-read')?.addEventListener('click', () => preview(bench.kind, on));
  if (on) el.querySelector('.bench-go')?.addEventListener('click', () => editPopover(bench.kind, on));
  if (on) wirePackActions(el, bench.kind, on);
  wireBenchFold(el, WORK_BENCH_OPEN_STORE);

  /*
   * THE SAME DROP GESTURE AS TONIGHT, on the same kind of target — and it
   * takes a BINGO pack as readily as a quiz, because the editor does.
   */
  el.addEventListener('dragover', (ev) => {
    if (!packDrag) return;
    ev.preventDefault();
    ev.dataTransfer.dropEffect = 'copy';
    el.classList.add('drop-here');
  });
  el.addEventListener('dragleave', (ev) => {
    if (!el.contains(ev.relatedTarget)) el.classList.remove('drop-here');
  });
  el.addEventListener('drop', (ev) => {
    if (!packDrag) return;
    ev.preventDefault();
    el.classList.remove('drop-here');
    const dropped = packDrag;
    setPackDrag(null);
    dragging(false);
    putOnBench(shelfFor(dropped.kind).find((p) => p.id === dropped.id), dropped.kind);
  });
  return el;
}

/**
 * THE POST GIG BENCH — one night, and everything you do about it.
 *
 * *"I think I need a bench in the post gig bit as well."* Its cargo is a NIGHT,
 * which is what every job behind that door is about: bill it, show the venue,
 * put it on the gallery.
 *
 * **THE DETAIL LIVES HERE NOW, NOT IN A SECOND PLACE.** This used to be a
 * small tile with three buttons that clicked THROUGH to a row in the list
 * below — "Open its photos" found `.gig[data-night]` and pressed its head for
 * you. Past gigs then grew its own bay showing that same detail a second
 * time, and the host's own reading of the result was right: two places
 * showing the same thing is less visible than one, not more. So the bench
 * now builds the detail itself — `fillNightDetail()`, the exact function
 * Past gigs used to keep in its own bay — and Past gigs is a picker only:
 * choose a night there, see everything about it here.
 *
 * **IT FETCHES ITS OWN NIGHT RATHER THAN WAITING FOR THE LIST.** Past gigs
 * reads the archive when it renders, and this panel is built before that
 * finishes — so on a fresh load the bench would have nothing to look its
 * remembered night up in. Redrawing the whole page when the list arrives was
 * the obvious fix and is a LOOP: the render rebuilds Past gigs, which
 * fetches, which renders. It refills itself in place instead, which touches
 * nothing else.
 */
function nightBenchPanel() {
  const el = node('<div class="panel launchbar bench night-bench"></div>');

  const draw = async (night) => {
    const when = night ? new Date(night.night + 'T12:00:00') : null;
    el.replaceChildren(node(`
      <div>
        <div class="lb-head">
          <div class="lb-what">
            <span class="bench-where">On the bench</span>
            <span class="tiny lb-shut-what">${night
    ? esc(`${when.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}${night.venue ? ` · ${night.venue}` : ''}`)
    : 'Nothing yet'}</span>
          </div>
          <!-- reward-off, not lb-tile-off — that one is position: absolute,
               meant to sit inside an lb-tile chip it is positioned relative
               to. Bare in this grid head it had no such ancestor and escaped
               to the corner of the whole page. lb-right is the head's own
               third column, same as the launch bar's fold — both live in it
               together, same as Tonight's mode switch and its own fold. -->
          <div class="lb-right">
            ${night ? '<button class="reward-off bench-off" type="button" aria-label="Take it off the bench">&times;</button>' : ''}
            <button class="lb-fold" type="button" aria-expanded="true"><span class="lb-fold-word"></span></button>
          </div>
        </div>
        ${night ? '<div class="bench-detail bench-fold-body"></div>' : `
          <div class="bench-body bench-fold-body">
            <div class="bench-slot">
              <div class="lb-drop bench-drop">
                <span class="lb-drop-plus">+</span>
                <span>Drag a night here</span>
              </div>
            </div>
            <div class="bench-do">
              <p class="tiny">Or pick one in Past gigs, and the invoice, the
                photographs and whether the venue can show it off are all in
                one place, right here.</p>
            </div>
          </div>`}
      </div>`));

    el.querySelector('.bench-off')?.addEventListener('click', () => putNightOnBench(''));
    wireBenchFold(el, NIGHT_BENCH_OPEN_STORE);
    if (night) await fillNightDetail(el.querySelector('.bench-detail'), night);
  };

  const found = () => gigsSeen.find((n) => n.night === nightBench) || null;
  draw(nightBench ? found() : null);
  if (nightBench && !found()) {
    (async () => {
      try {
        const data = await (await fetch(keyed('/api/past-gigs'))).json();
        setGigsSeen(data.nights || []);
        const mine = found();
        // Filed under a night that is no longer there — it leaves quietly
        // rather than drawing a tile for something that has gone.
        if (!mine) { setNightBench(''); localStorage.removeItem(NIGHT_BENCH_STORE); }
        draw(mine);
      } catch { /* the list below will say so; the bench stays empty */ }
    })();
  }

  /*
   * DRAG WIRING STAYS OUTSIDE `draw()`, added ONCE — `el` itself is never
   * replaced, only its children, so listeners added inside `draw()` would
   * stack up a fresh copy on every redraw.
   */
  el.addEventListener('dragover', (ev) => {
    if (!nightDrag) return;
    ev.preventDefault();
    ev.dataTransfer.dropEffect = 'copy';
    el.classList.add('drop-here');
  });
  el.addEventListener('dragleave', (ev) => {
    if (!el.contains(ev.relatedTarget)) el.classList.remove('drop-here');
  });
  el.addEventListener('drop', (ev) => {
    if (!nightDrag) return;
    ev.preventDefault();
    el.classList.remove('drop-here');
    const key = nightDrag;
    setNightDrag(null);
    dragging(false);
    putNightOnBench(key);
  });
  return el;
}

function doorHead(...parts) {
  const el = node('<div class="doorhead"></div>');
  el.append(...parts);
  return el;
}

/**
 * THE TABS RUN DOWN THE LEFT AND THE TAB'S CONTENT SITS BESIDE THEM.
 *
 * Asked for as *"would it make sense to have the main menu at the top and the
 * submenu (the tabs) run down the left hand side?"* — three arrangements were
 * rendered from the real stylesheet before choosing, and this is B: **Tonight
 * keeps the full width above, and the column starts below it.** The launch bar
 * is the one panel that genuinely wants the whole page, and it is the reason
 * the sidebar does not simply run the full height.
 *
 * **THE SIDEBAR IS THE SAME SHAPE AT EVERY WIDTH — it goes full width on a
 * phone rather than turning back into a scrolling row.** Three collapses were
 * rendered at 390 and this is the one that was picked. It is also the one with
 * no mechanism in it: the horizontal bar needed `overflow-x`, a wrap rule at
 * 860, and a `showActiveTab()` that scrolled the lit chip back into view
 * because the tabs on the end were off the right-hand edge. A vertical list has
 * every tab visible, so all of that is gone rather than ported.
 *
 * It is one element wrapping the two that already existed, so nothing about a
 * tab's own markup changed and the doors, the badges and the locked chips are
 * untouched.
 */
function consoleColumns(bar, body) {
  const wrap = node('<div class="consolecols"></div>');
  wrap.append(bar, body);
  return wrap;
}

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
export function renderKeepingPlace() {
  /*
   * WHICHEVER THING IS ACTUALLY SCROLLING.
   *
   * It read `window.scrollY` and wrote it back, which was right while the
   * whole page scrolled. With the door shell the frame is a fixed height and
   * the tab body is its own scroll container, so the window's offset is always
   * 0 and holding it holds nothing — every tab change would jump to the top of
   * the content, which is the exact fault this function exists to prevent.
   *
   * Both are read and both are written, rather than branching on the
   * breakpoint: below 900px the page really does scroll and the body does not,
   * so one of the two is always 0 and putting a 0 back costs nothing. A branch
   * would be a second place to get the breakpoint wrong.
   */
  const y = window.scrollY;
  const pane = mainEl.querySelector('.tabbody');
  const inner = pane ? pane.scrollTop : 0;
  render();
  window.scrollTo({ top: y });
  const again = mainEl.querySelector('.tabbody');
  if (again) again.scrollTop = inner;
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
 * The tabs this account can see.
 *
 * A tab it has NOT paid for is still shown, greyed, with the reason on it —
 * something you can see and cannot use is a thing you might buy, and something
 * invisible is a thing you never knew existed. A tab its plan will never
 * include at all is simply absent.
 */
/**
 * "THE ROOM ASKED FOR THREE THINGS" — a line on the quiz tab, linking to the
 * door that holds the list.
 *
 * **Silent unless something is waiting**, which is what makes it a pointer
 * rather than furniture: the panel it replaced already drew nothing at all
 * when there was nothing to say, and an empty link on the page you open to
 * write a quiz would be a worse version of the thing that was moved.
 *
 * It counts what is ASKED, not what is kept. Kept ideas are a list you work
 * through when you feel like it; unanswered ones are the thing worth being
 * told about while you are deciding what to write.
 */
function asksLink() {
  const el = node('<div></div>');
  (async () => {
    let data;
    try {
      const res = await fetch(keyed('/api/asks'));
      data = await res.json();
      if (!res.ok) return;
    } catch { return; }
    const n = (data.asked || []).length;
    if (!n) return;
    // `goTo()` RETURNS AN ANCHOR — it is the house helper for "do it over
    // there", and it carries the host key with it so the link works from a
    // console that got in on one.
    el.replaceChildren(node(`
      <p class="tiny asks-link">The room asked for <b>${n} thing${n === 1 ? '' : 's'}</b>
        you have not answered — ${goTo('community', 'asks', 'have a look')}.</p>`));
  })();
  return el;
}

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
  const door = doorNow();
  return TABS.filter((tab) => doorsOf(tab).includes(door)).filter((tab) => {
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
        ${esc((me && me.entitlements && me.entitlements.trialExpired)
          ? 'Your trial has ended. Get in touch to keep going.'
          : (me && me.entitlements && me.entitlements.status === 'past_due')
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
  /*
   * NOTHING COMES BETWEEN THE LAUNCH BAR AND THE PACKS.
   *
   * The rule, set on 15 August 2026: *"on the console view the rule has to be
   * that nothing is between the console and the packs — remove everything
   * else."* The tab already says which game it is, an inch above, in a lit
   * chip; repeating it as a heading with the logo beside it is a second label
   * for the same fact, standing between the thing you launch from and the
   * thing you launch.
   *
   * It stays on the Workshop and Post gig doors, where a page has more than
   * one section on it and the heading is doing real work.
   */
  if (doorNow() !== 'console') {
    wrap.appendChild(node(`
      <div class="game-head tab-head">
        <div class="tab-head-name">
          <span class="tab-head-mark" aria-hidden="true">${brandMark(26)}</span>
          <h2>${esc(tab.label)}</h2>
        </div>
      </div>`));
  }

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
  /*
   * THE WRITING PANELS ARE WORKSHOP FURNITURE AND ONLY APPEAR THERE.
   *
   * *"These need to be removed from console view, they're workshop
   * features."* — Ask for a quiz, My packs, the bingo track-list paster, the
   * forget list. Every one of them makes or requests a pack, which is
   * preparation; none of them has any business between a quizmaster and the
   * thing they are about to launch.
   *
   * This is the whole point of the doors. The tab keeps its id and its packs,
   * and the BODY differs by which door you came through: the shelf on the
   * Console, the workbench in the Workshop.
   */
  const workshop = doorNow() !== 'console';
  const writing = can(FEATURES.GENERATE) || can(FEATURES.CATALOGUE);
  if (workshop && tab.generator && writing) wrap.appendChild(tab.generator());
  wrap.appendChild(gameSection(tab.id, tab.label, tab.blurb, tab.packs(), tab.editLabel));
  if (workshop && tab.generator && !writing) wrap.appendChild(tab.generator());
  return wrap;
}

/*
 * A NIGHT HANDED OVER IN THE URL — `?night=YYYY-MM-DD`.
 *
 * The control view's big **Check the photos** button at the final scores lands
 * here, and this is what makes it open the right night: the key goes onto the
 * Post gig bench, which is that door's own mechanism for "the night I am
 * working on".
 *
 * In the URL rather than written straight into `localStorage` from `host.js`:
 * two pages writing one key is how a contract drifts silently, and a link can
 * be followed twice, shared, or bookmarked. Read BEFORE `load()` so the first
 * render already has it.
 */
const wantedNight = new URL(location.href).searchParams.get('night') || '';
if (/^\d{4}-\d{2}-\d{2}$/.test(wantedNight)) {
  /*
   * The binding and the store, but NOT `putNightOnBench()` — which renders.
   * Rendering here runs before `load()` has fetched anything, so `library` is
   * still null and the first paint throws on `library.brand`. The same
   * boot-order fault the console split hit this morning, in a third place: a
   * thing that works perfectly once the page is up, run one step too early.
   *
   * `load()` paints straight afterwards and picks this up on its own.
   */
  setNightBench(wantedNight);
  localStorage.setItem(NIGHT_BENCH_STORE, wantedNight);
}

/*
 * A PACK HANDED OVER IN THE URL TOO — `?tonightPack=<id>&tonightKind=quiz`.
 *
 * The Workshop bench's own "Take it to Tonight" link is what sends one:
 * asked for directly — *"give the workshop bench a place to save so it goes
 * into a show"* — and the honest answer was that the bench cannot BUILD a
 * show itself (it holds one pack; a show also needs the venue, prizes, look
 * and lobby game, all of which already live on Tonight, and a second place
 * that could set them is the "second composer" this app's own rule already
 * refuses). So the bench hands the pack to the ONE place a show is actually
 * built, the same door and the same `Keep this as a show` button that
 * already exist, rather than inventing a second way to reach the same
 * result. Same reasoning as `?night=` just above: read before `load()`, so
 * `wantPackFromUrl()` only sets state and does not render.
 */
const tonightPackId = new URL(location.href).searchParams.get('tonightPack') || '';
const tonightKind = new URL(location.href).searchParams.get('tonightKind') || '';
if (tonightPackId && (tonightKind === 'quiz' || tonightKind === 'bingo')) {
  wantPackFromUrl(tonightPackId, tonightKind);
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
