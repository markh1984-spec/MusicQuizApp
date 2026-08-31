/**
 * Bits every screen needs: a live connection, a clock that agrees with the
 * server, and a couple of DOM helpers. Deliberately tiny and framework-free.
 */

import { quizMark } from './brandmark.js';

/**
 * The logo: a record. The drawing lives in brandmark.js because the server
 * serves the very same one as the tab icon, and two copies would be a logo
 * that changes in one place and not the other.
 *
 * Each one on a page gets its own gradient id — two sharing one would fight.
 */
let markCount = 0;
export function brandMark(size = 30) {
  return quizMark({ size, id: `bm${++markCount}`, cls: 'brand-mark' });
}

/**
 * The logo and the name, as a link back to the console — the way the top left
 * of any website behaves. Keeps the host key on the link so it does not ask
 * for it again.
 */
export function brandLink(name, { key = '', size = 30, appName = '' } = {}) {
  const href = '/console' + (key ? '?key=' + encodeURIComponent(key) : '');
  return `<a class="brand" href="${href}" title="Back to the console">
    ${brandMark(size)}${brandWords(name, appName)}
  </a>`;
}

/**
 * The menu — the same doors, in the same order, on every page that has one.
 *
 * It lives here rather than on any one page because four copies of a menu is
 * four menus that disagree within a month, which is the reason `plans.js` and
 * `looks.js` are shared too. Each page passes only what it can honestly know
 * about itself; the ORDER and the labels are decided once, here.
 *
 * `current` lights the page you are on rather than dropping it. A menu with a
 * hole where you are standing makes you count the items to work out where that
 * is; lit, it answers "where am I" as well as "where can I go", which is half
 * of what a menu is for.
 *
 * THE KEY IS PASSED IN, NEVER READ FROM HERE, and it is the URL key rather
 * than the remembered one — see `linkTo` in `console.js`. A menu that quietly
 * appended a remembered key would put it back in the address bar on every
 * page at once, which is the thing that was just taken out.
 *
 * The projector and a player's phone deliberately have NO menu. One is
 * pointed at a room and the other belongs to somebody in it; neither has any
 * business carrying a door into the quizmaster's console.
 */
export function navMenu({
  current = '', key = '', control = true, packs = true, owner = false, acting = false,
} = {}) {
  // `?` OR `&`, because two of the doors already carry a `door=` — appending a
  // second `?` makes the key part of the door's value and the page loses it.
  const at = (path) => path + (key ? `${path.includes('?') ? '&' : '?'}key=${encodeURIComponent(key)}` : '');
  /*
   * CONSOLE CARRIES THE HAT NOW, because Control used to and Control is no
   * longer a door.
   *
   * An owner pressing the night door is asking for their own console, and they
   * have one — it is behind the quizmaster hat. Making them find the switch
   * first is a step that exists only because of how the code is arranged,
   * which is the exact reason Control carried `hatOn` before this.
   */
  const items = [{ id: 'console', label: 'Console', href: at('/console'), hatOn: owner && !acting }];
  /*
   * THE SAME FOUR DOORS IN THE SAME ORDER, WHICHEVER HAT IS ON.
   *
   * The owner holds no quiz features, so Control used to disappear on the
   * owner page and the whole row shuffled left — which is the "it changes
   * every time" complaint, and it is a fair one: a menu that reorders itself
   * is not a menu, it is four bars that happen to look alike.
   *
   * So the door is always there, and it CHANGES HAT ON THE WAY THROUGH — the
   * exact mirror of Owner doing it in the other direction. An owner pressing
   * Control is asking for their control view, and they have one; it is behind
   * the hat, and making them find the switch first is a step that exists only
   * because of how the code is arranged. `data-hat-on` is that press.
   */
  /*
   * CONSOLE · WORKSHOP · POST GIG — the three doors, ordered by the gig.
   *
   * Named by the host on 15 August 2026: *"this section needs to say Console,
   * Workshop and Post gig and function like that."* They replace Console ·
   * Control · Packs, which named TOOLS; these name MOMENTS, which is how
   * somebody actually thinks about a night — before it, during it, after it.
   *
   * **Console keeps its name and means the night itself**, which is what makes
   * the launch guarantee survive the change: the one thing everybody already
   * knows is that Console is where you go to start a quiz, and it still is.
   *
   * **CONTROL IS NO LONGER A DOOR.** Driving the quiz is something you do
   * DURING, not a different kind of tool, so it belongs inside Console — where
   * "Take control" already sits on the running panel. The route back must stay
   * short: two predictable taps is fine, hunting is not, and relaunching to
   * get back would destroy a running game in front of a room.
   *
   * They are all `/console` with a `door` on it rather than three pages: the
   * tab bar filters itself by the door, which means Music Quiz can be the
   * shelf behind Console and the writing panels behind Workshop.
   */
  if (packs) items.push({ id: 'workshop', label: 'Workshop', href: at('/console?door=workshop') });
  items.push({ id: 'post', label: 'Post gig', href: at('/console?door=post') });
  /*
   * AND MY ACCOUNT, the fourth — asked for as *"we need a fourth pill at the
   * top: My Account. Then Calendar, Help and Shop all live there."*
   *
   * The first three name MOMENTS of a night — before it, during it, after it.
   * This one names the one thing that is not a night at all, which is why it
   * goes on the end rather than in the sequence: your calendar, your
   * subscription, the support box and the shop are all about YOU, and none of
   * them is a step in an evening.
   *
   * Ungated like the tab it leads to, and for the same reason: this is where
   * somebody goes when something is wrong, including when the thing that is
   * wrong is their subscription. A door that disappears at the moment you need
   * it is worse than not having one.
   */
  /*
   * COMMUNITY, THE FIFTH — asked for by name: *"a fifth menu pill at the top
   * entitled 'community', which is for things like quiz leagues."*
   *
   * **Fourth in the row, before My account**, because it is work rather than
   * housekeeping: the first three are the moments of a night and this is the
   * thing that spans them — a league belongs to the ROOM, over a season, which
   * is why it fits under none of the other four and had been living as a block
   * on a venue card.
   *
   * **Ungated, like the door it sits beside.** What is behind it is gated in
   * the ordinary way (`needs: FEATURES.LEAGUE` on the tab, drawn greyed with
   * the tier it wants), which is the pattern that lets somebody SEE a thing
   * they could buy. A door that vanishes sells nothing and explains nothing.
   */
  items.push({ id: 'community', label: 'Community', href: at('/console?door=community') });
  items.push({ id: 'account', label: 'My account', href: at('/console?door=account') });
  /*
   * THERE IS NO OWNER DOOR ON THIS MENU, and taking it off was the host's
   * call: *"only my account has two owner links now — defunct. The other QMs
   * don't need any owner links, so I'll keep the top right one and lose the
   * menu one."*
   *
   * There was one, and it was correct at the time — but the hat switch's own
   * Owner half sits four inches away on the same bar, and both said the word
   * "Owner". Two controls with one word on them is the fault this file keeps
   * recording: you end up using the worse one out of habit. The switch wins
   * because it is the SIGN as well as the switch — it says which hat is on,
   * which a chip in a row of pages cannot.
   *
   * So this menu is now literally identical for every account: Console,
   * Control, Packs, and nothing that depends on who is reading it. The doors
   * between the two SIDES are the hat switch's job alone.
   *
   * `owner` and `acting` are still taken, because Control uses them to know
   * whether to put the hat ON on the way through.
   */
  return items.map((i) => `<a class="${i.id === current ? 'here' : ''}" href="${esc(i.href)}"${
    i.hatOff ? ' data-hat="off"' : ''}${i.hatOn ? ' data-hat="on"' : ''}${
    i.id === current ? ' aria-current="page"' : ''}>${esc(i.label)}</a>`).join('');
}

/**
 * Draw the menu into a slot and wire it up. One call per page, so the
 * hat-off handler cannot be remembered on three pages and forgotten on the
 * fourth. Does nothing at all if the page has no menu slot.
 */
export function paintNav(slot, opts = {}) {
  if (!slot) return;
  slot.innerHTML = navMenu(opts);
  /*
   * SCROLL THE LIT CHIP INTO VIEW, the same as the console's own tab bar.
   *
   * On the control view the menu is a 96px window onto 237px of chips, so at
   * 320px the chip saying where you are can easily be off the right-hand edge
   * — and a menu you cannot find yourself in is the fault lighting the chip
   * was meant to fix, moved along by two inches.
   *
   * `scrollLeft` on the bar itself and never `scrollIntoView`, which scrolls
   * every ancestor and would jump the page down to the topbar — the same
   * reason `showActiveTab()` does it this way.
   *
   * Measured off the RECTS rather than `offsetLeft`: that is relative to the
   * nearest positioned ancestor, which is the bar rather than this nav, so
   * the arithmetic was out by the logo's width and scrolled straight past the
   * chip it was aiming at. And the chip is put at the LEFT of the window with
   * a small peek behind it, not centred — centring a 76px chip in a 96px
   * window has nowhere to put the other 20px, so it overshot and showed the
   * tail of the lit chip with the next one whole beside it.
   */
  const here = slot.querySelector('a.here');
  if (here && slot.scrollWidth > slot.clientWidth) {
    const PEEK = 12;
    const delta = here.getBoundingClientRect().left - slot.getBoundingClientRect().left;
    slot.scrollLeft = Math.max(0, slot.scrollLeft + delta - PEEK);
  }
  for (const chip of slot.querySelectorAll('a[data-hat]')) {
    const wanted = chip.getAttribute('data-hat') === 'on';
    chip.addEventListener('click', async (e) => {
      e.preventDefault();
      // Change hat, then go. If the call fails, go anyway — the page you land
      // on says plainly what it wants, which beats a chip that silently does
      // nothing when pressed.
      try {
        await fetch('/api/owner/act-as', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ on: wanted }),
        });
      } catch { /* go anyway */ }
      location.href = chip.getAttribute('href');
    });
  }
}

/**
 * The right-hand end of the topbar: which hat is on, and the way out.
 *
 * Shared for the same reason `navMenu` is. It was written once inside
 * `console.js`, so the console had a hat switch and a Sign out and the control
 * view, the editor and the owner page each had some subset of neither — which
 * is the "the top section changes every time" complaint at the other end of
 * the bar from the menu.
 *
 * `hatSwitch` decides for itself whether anybody may see it, and answers null
 * for a real quizmaster — that refusal is tested, and this must not second
 * guess it.
 */
export function paintIdentity(who, { forgetKey = null, onSwitch = null } = {}) {
  const outSlot = document.getElementById('outSlot');
  // No Sign out on the host key: there is no session to end, and a button that
  // says there is would be a lie that lands you on a sign-in page you do not
  // need. Same test the console has always used.
  if (outSlot && who && who.signedIn && !who.bootstrap) {
    const out = node('<button class="minor topbar-out">Sign out</button>');
    out.addEventListener('click', async () => {
      await fetch('/api/sign-out', { method: 'POST' });
      location.href = '/login';
    });
    outSlot.replaceChildren(out);
  }
  const slot = document.getElementById('hatSlot');
  if (slot) {
    const el = hatSwitch(who, { forgetKey, onSwitch });
    /*
     * ON THE HOST KEY WITH NOTHING SIGNED IN, SAY SO.
     *
     * The hat switch is the sign as well as the switch — but on the bare key
     * it returns null, and Sign out is hidden too, so the topbar went silent
     * on the one identity that looks least like the others. The host lost ten
     * minutes to exactly that: *"where's my hat selector?"*, on a console that
     * was working perfectly and was simply somewhere else.
     *
     * It names the ROOM rather than the credential, because the room is the
     * part that actually matters — the house room is the plain `/play` one
     * with no join code, and a night started in the room you did not mean is
     * a room full of people who cannot join.
     *
     * Only when the switch drew nothing: with an owner signed in underneath,
     * the switch grows a third position and says it better than a chip could.
     */
    if (el) slot.replaceChildren(el);
    else if (who && who.bootstrap) {
      slot.replaceChildren(node(
        '<span class="mode-chip" title="Signed in with the host key rather than as an account, so this is the house room — the plain /play one with no join code. Sign in as your quizmaster account for your own room.">'
        + '<span class="mc-how">Host key <b>·</b> </span>the house room</span>',
      ));
    } else slot.replaceChildren();
  }
  // A gold hairline under the topbar while the hat is on, so even a screenshot
  // of the middle of a page says which hat it was taken in.
  document.body.classList.toggle('wearing-hat', Boolean(who && who.actingAs));
}

/**
 * What goes in the menu, worked out ONE way from `/api/me`.
 *
 * The chips were jumping about between pages, and the cause was every page
 * deciding for itself: the console read its own feature list, the editor
 * guessed from whether it held the catalogue, and the control view assumed.
 * So the same account got Console·Control·Packs on one page and
 * Console·Packs·Owner on the next — which is not a menu, it is four bars that
 * happen to look alike. One function, one answer, every page.
 *
 * The order in `navMenu` never changes either, so a chip does not move when an
 * item beside it is missing.
 */
export function menuRights(who) {
  const account = (who && who.signedIn && who.account) || null;
  const features = (account && account.entitlements && account.entitlements.features) || [];
  const has = (id) => features.includes(id);
  return {
    /*
     * An owner holds no quiz features — but they have a quizmaster hat, and
     * behind it a control view of their own. Reading `quiz.run` alone made the
     * door vanish on the owner page and the whole row shuffle left, which is
     * the "the top section changes every time" complaint. `tiers` is what the
     * server sends to anybody who can WEAR the hat, so it is the honest test
     * for "is there a control view on the other side of this".
     */
    control: has('quiz.run') || has('bingo.run') || Boolean(who && who.tiers && who.tiers.length),
    packs: has('owner.catalogue') || has('packs.own'),
    /*
     * Three ways to be the owner, and only the first is obvious.
     *
     * `role` is the plain case. `alsoSignedIn` is the HOST KEY, where the
     * server answers as the bootstrap identity — whose role is "quizmaster" —
     * with the real cookie reported underneath. And `actingAs` is the owner
     * WEARING THE QUIZMASTER HAT, which is the case that went missing: the
     * whole point of the hat is that your role becomes quizmaster, so a check
     * on `role` alone hides the way back on exactly the account that needs it
     * most. Mark is one person with two hats and one laptop.
     */
    acting: Boolean(who && who.actingAs),
    owner: Boolean((account && account.role === 'owner')
      || (who && who.actingAs)
      || (who && who.alsoSignedIn && who.alsoSignedIn.role === 'owner')),
  };
}

/**
 * "Mark's" on top, "Quizporium" underneath and doing the underlining.
 *
 * Two lines rather than one because the two halves are different things: whose
 * night it is, and what the thing is called. Stacked, the longer product name
 * sits under the shorter possessive and rules it off, which is the shape a
 * pub-quiz logo wants — and it takes half the width in a topbar that also has
 * to hold a hat switch.
 *
 * SPLIT ON THE APP NAME, never on the last word. `BRAND_NAME` can be set to
 * anything at all — "The Crown Quiz League" — and splitting on the last word
 * would stack that as "The Crown Quiz" over "League", which is nonsense. A
 * name that does not end in the product name is simply left as one line, which
 * is exactly right for somebody who has overridden it.
 */
export function brandWords(name, appName = '') {
  const full = String(name || '');
  const tail = appName ? ` ${appName}` : '';
  if (!tail || !full.endsWith(tail) || full.length === tail.length) {
    return `<span class="brand-name">${esc(full)}</span>`;
  }
  const who = full.slice(0, -tail.length);
  return `<span class="brand-name stacked">
    <span class="brand-who">${esc(who)}</span><span class="brand-app">${esc(appName)}</span>
  </span>`;
}

/**
 * A bin, drawn rather than written out as a word or an emoji.
 *
 * Emoji bins are a different picture on every phone and some of them are a
 * cheerful little basket. This is the same everywhere, sharp at any size, and
 * inherits its colour — which matters, because the whole point is that the
 * host can see what a tap is about to do before it does it.
 */
export function binIcon(size = 18) {
  return `
    <svg class="bin-icon" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none"
         stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
         aria-hidden="true">
      <path d="M3 6h18"/>
      <path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2"/>
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
      <path d="M10 11v6M14 11v6"/>
    </svg>`;
}

/**
 * A DRAWING PIN — "this one goes on the night's card".
 *
 * Drawn rather than fetched, like every other mark in this app. The head is
 * filled and the needle is a stroke, so the shape still reads at 15px on a
 * thumbnail: an all-stroke pin at that size is a smudge, and an all-filled one
 * is a blob. `fill="currentColor"` on the head is what lets one icon serve both
 * states — the button's own colour says whether it is pinned, so there is no
 * second drawing to keep in step.
 */
export function pinIcon(size = 18) {
  return `
    <svg class="pin-icon" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none"
         stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
         aria-hidden="true">
      <circle cx="12" cy="9" r="4.4" fill="currentColor" stroke="none"/>
      <path d="M12 3.2a5.8 5.8 0 0 0-5.8 5.8c0 1.9 1.1 3.6 2.4 5"/>
      <path d="M12 13.4V21"/>
    </svg>`;
}

export function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

export function html(strings, ...values) {
  return strings.reduce((out, s, i) => out + s + (i < values.length ? values[i] : ''), '');
}

export function node(markup) {
  const t = document.createElement('template');
  t.innerHTML = markup.trim();
  /*
   * IT RETURNS ONE ELEMENT, AND ANYTHING AFTER THE FIRST IS LOST — which is
   * silent, and had cost two things by the time anybody noticed.
   *
   * The gallery's *"All nights"* link, under a night's photographs, has never
   * rendered: the markup was a grid AND a paragraph, so the paragraph was
   * dropped and somebody who opened a night had no way back but the browser's
   * own button. And on My account, the whole list of suggestions a quizmaster
   * had sent — with Mark's replies in it — was dropped under its own heading,
   * on the panel whose entire job is *"you send something into the dark and
   * never learn whether it landed"*.
   *
   * **A GREP CANNOT FIND THESE.** The markup is a template literal with
   * template literals nested inside it, so a regex looking for the closing
   * backtick stops in the middle of the first `.map()` — a scanner written for
   * exactly this found one of the two and missed the other, which is worse
   * than none.
   *
   * So it says so instead, at the moment it happens, on whatever page it
   * happens on. `console.error` rather than a warning because it is ALWAYS a
   * mistake — every browser check in this repo fails on a console error, so
   * the next one is caught by a check somebody already runs rather than by
   * somebody eventually noticing a link that was never there.
   */
  if (t.content.children.length > 1) {
    console.error('node() was given more than one top-level element and kept only the first:',
      markup.trim().slice(0, 120));
  }
  return t.content.firstElementChild;
}

/**
 * Change what tonight is playing for, from the control view, mid-game.
 *
 * Lives here rather than in `host.js` because `host-bingo.js` needs it too,
 * and `host.js` is a PAGE module with its own top-level boot code — importing
 * from a page's own module runs that page's boot code on whatever imports it,
 * which is exactly the fault that once hung the whole console on "Loading
 * your library…". `client.js` has no page and no boot code, so this is the
 * one place both can share it from.
 *
 * `s.rewards` and `act` are passed in rather than read from a module-level
 * store, so this stays usable from either host.js's own closure or
 * host-bingo.js's — neither of which shares state with the other.
 */
export function rewardsEditorPopover(s, act) {
  const rows = (s.rewards && s.rewards.length ? s.rewards : ['']).slice();
  const el = node(`
    <div class="panel" style="position:fixed;left:12px;right:12px;bottom:150px;z-index:40;max-width:696px;margin:0 auto;background:#161626;max-height:60vh;overflow:auto">
      <h3>Prizes</h3>
      <div class="tiny" style="margin-bottom:10px">What tonight is playing for — 1st, then 2nd, then 3rd.
        Changes apply to the next prize handed out; one already given stays as it was.</div>
      <div class="rw-rows"></div>
      <button class="minor" type="button" style="margin-top:6px" id="rwAdd">+ Add a prize</button>
      <div class="row" style="margin-top:14px;gap:8px">
        <button class="go" type="button" id="rwSave">Save</button>
        <button class="minor" type="button" id="rwClose">Close</button>
      </div>
    </div>`);

  const list = el.querySelector('.rw-rows');
  const places = ['1st', '2nd', '3rd'];
  const addRow = (value = '') => {
    const row = node(`
      <div class="row rw-row" style="gap:6px;margin-top:6px;align-items:center">
        <span class="tiny" style="width:32px">${esc(places[list.children.length] || `${list.children.length + 1}th`)}</span>
        <input type="text" maxlength="200" value="${esc(value)}" style="flex:1">
        <button class="minor danger rw-del" type="button" aria-label="Remove this prize" title="Remove this prize">${binIcon(16)}</button>
      </div>`);
    row.querySelector('.rw-del').addEventListener('click', () => {
      row.remove();
      // Places are read off POSITION, so a removed middle row has to renumber
      // the ones below it rather than leave a gap the label no longer means.
      [...list.children].forEach((r, i) => {
        r.querySelector('span').textContent = places[i] || `${i + 1}th`;
      });
    });
    list.appendChild(row);
  };
  rows.forEach((r) => addRow(r));

  el.querySelector('#rwAdd').addEventListener('click', () => addRow());
  el.querySelector('#rwClose').addEventListener('click', () => el.remove());
  el.querySelector('#rwSave').addEventListener('click', async () => {
    const values = [...list.querySelectorAll('input')].map((i) => i.value.trim()).filter(Boolean);
    const btn = el.querySelector('#rwSave');
    btn.disabled = true;
    btn.textContent = 'Saving…';
    await act('setRewards', { rewards: values });
    el.remove();
  });

  document.body.appendChild(el);
  return el;
}

/**
 * Keeps a running estimate of the gap between this device's clock and the
 * server's, so a countdown shown on a phone whose clock is ten minutes out
 * still matches the projector. Scoring never uses this — only the display.
 */
export class ServerClock {
  constructor() {
    this.offset = 0;
    this.samples = [];
  }

  sync(serverNow) {
    if (!Number.isFinite(serverNow)) return;
    this.samples.push(serverNow - Date.now());
    if (this.samples.length > 9) this.samples.shift();
    // Median, so one slow response does not drag the clock about.
    const sorted = [...this.samples].sort((a, b) => a - b);
    this.offset = sorted[Math.floor(sorted.length / 2)];
  }

  now() {
    return Date.now() + this.offset;
  }
}

/**
 * A live connection that reconnects itself. EventSource already retries, but
 * we also watch for a stream that has gone quiet (a phone waking from sleep
 * often keeps a dead connection open) and rebuild it.
 */
export class Live {
  constructor(url, { onState, onStatus } = {}) {
    this.url = url;
    this.onState = onState || (() => {});
    this.onStatus = onStatus || (() => {});
    this.source = null;
    this.lastMessageAt = 0;
    this.stopped = false;
    this.timers = [];
    this.connect();
    this.timers.push(setInterval(() => this.checkAlive(), 5000));
    this.onVisible = () => { if (!document.hidden) this.checkAlive(true); };
    document.addEventListener('visibilitychange', this.onVisible);

    /*
     * Keep the server awake.
     *
     * Hosts that sleep idle apps (Render's free tier does, after 15 minutes)
     * count INBOUND requests. Our live connection is outbound-only once it is
     * open — the server pushes to it and the browser never sends anything —
     * so a quiet lobby or a long gap between rounds could look like no
     * traffic at all and put the app to sleep with the room watching.
     *
     * One tiny request every four minutes is enough to stop that. It costs
     * nothing and it removes a whole category of gig-night disaster.
     */
    this.timers.push(setInterval(() => {
      fetch('/health', { cache: 'no-store' }).catch(() => {});
    }, 4 * 60 * 1000));
  }

  /**
   * Shut this connection down for good — stream closed, timers cleared.
   *
   * Without this, replacing a connection left the old one alive: its stream
   * was closed but its keep-alive timer was not, so forty seconds later it
   * reopened itself and started delivering state again under the OLD player
   * id. The server rightly said it did not know that id, and the phone threw
   * the player out — a player who was, by then, perfectly happily rejoined
   * under a new one. One stray disconnection turned into being kicked over
   * and over for the rest of the night.
   */
  stop() {
    this.stopped = true;
    for (const t of this.timers) clearInterval(t);
    this.timers = [];
    document.removeEventListener('visibilitychange', this.onVisible);
    if (this.source) {
      try { this.source.close(); } catch { /* already gone */ }
      this.source = null;
    }
  }

  connect() {
    if (this.stopped) return;
    if (this.source) this.source.close();
    this.source = new EventSource(this.url);
    this.source.addEventListener('open', () => {
      this.lastMessageAt = Date.now();
      this.onStatus('online');
    });
    this.source.addEventListener('state', (event) => {
      this.lastMessageAt = Date.now();
      this.onStatus('online');
      try {
        this.onState(JSON.parse(event.data));
      } catch (err) {
        console.error('bad state payload', err);
      }
    });
    this.source.addEventListener('error', () => this.onStatus('offline'));
  }

  /** Heartbeats arrive every 15s; 40s of silence means the link is dead. */
  checkAlive(force = false) {
    if (this.stopped) return;
    const quietFor = Date.now() - this.lastMessageAt;
    if (force || quietFor > 40000) {
      if (quietFor > 20000 || force) {
        this.onStatus('offline');
        this.connect();
      }
    }
  }
}

export async function postJson(url, body, headers = {}) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body || {}),
  });
  const text = await res.text();
  let data = {};
  try { data = text ? JSON.parse(text) : {}; } catch { data = { error: text }; }
  if (!res.ok) throw Object.assign(new Error(data.error || res.statusText), { data, status: res.status });
  return data;
}

/*
 * Which game this browser belongs to.
 *
 * One place, imported by the phone, the bingo card and the projector, because
 * three copies of "where do I read the code from" is three chances to disagree
 * — and disagreeing means a phone answering into somebody else's question.
 *
 * Read from the page's URL (`?g=XXXX`) and then REMEMBERED, for the same reason
 * the player id is remembered: a phone that locks, refreshes or drops off wifi
 * has to come back to the same game rather than landing somewhere else with no
 * score. No code anywhere means the house game, which is what every QR made
 * before rooms existed says — that fallback is why nothing had to be reprinted.
 */
const ROOM_KEY = 'musicquiz.room';

export function roomCode() {
  let fromUrl = '';
  try {
    fromUrl = new URL(location.href).searchParams.get('g') || '';
  } catch { /* no window: a test importing this for something else */ }
  if (fromUrl) {
    try { localStorage.setItem(ROOM_KEY, fromUrl); } catch { /* private browsing */ }
    return fromUrl;
  }
  try { return localStorage.getItem(ROOM_KEY) || ''; } catch { return ''; }
}

/** `&g=…` for a query string that already has something in it, or nothing. */
export function roomParam(prefix = '&') {
  const code = roomCode();
  return code ? `${prefix}g=${encodeURIComponent(code)}` : '';
}

export function rememberRoom(code) {
  if (code === undefined || code === null) return;
  try {
    if (code) localStorage.setItem(ROOM_KEY, code);
    else localStorage.removeItem(ROOM_KEY);
  } catch { /* private browsing */ }
}

/**
 * A bar across the top saying which hat is on.
 *
 * Only ever shown to an owner who has switched into their own quizmaster
 * account. Being unsure which hat you are wearing is worse than either hat —
 * especially minutes before a gig, where "why is there no Launch button" and
 * "why can I see everybody's invoices" are both alarming for the wrong reason.
 *
 * It goes at the very top and pushes the page down rather than floating over
 * it, because something that covers a control is a bug of its own.
 */
export function actingBar(me) {
  if (!hatOn(me)) return null;
  const el = node(`
    <div class="acting-bar">
      <span>Wearing your <b>quizmaster</b> hat — this is exactly what a subscriber sees.</span>
      <button type="button">Back to owner</button>
    </div>`);
  el.querySelector('button').addEventListener('click', async () => {
    await postJson('/api/owner/act-as', { on: false });
    location.href = '/owner';
  });
  document.body.prepend(el);
  return el;
}

/*
 * Two shapes reach these helpers and both are legitimate: the whole `/api/me`
 * payload (which is what the control view has) and the `account` off it (which
 * is what the console keeps). `actingAs` and `bootstrap` are set on BOTH by
 * `whoIs()` in server.js, so accept either rather than making every caller
 * remember which it is holding.
 */
const hat = (me) => (me && me.account) || me || {};
const hatOn = (me) => Boolean(hat(me).actingAs || (me && me.actingAs));
const isOwner = (me) => hat(me).role === 'owner' || (me && me.account && me.account.role === 'owner');

/**
 * The hat switch: Owner | Quizmaster, in the top right, one tap either way.
 *
 * It is BOTH the switch and the sign saying which hat is on, which is why the
 * live half is a solid block of colour rather than a tick — pink for the owner,
 * gold for the quizmaster, so it is answered from across the room and not read.
 * "Being unsure which hat you are wearing is worse than either hat" was already
 * the rule; a sticky corner beats a bar you scroll past.
 *
 * **Only an owner ever sees it, and only their own two hats.** A real
 * quizmaster has nothing to switch to. Neither does the HOST KEY, which is not
 * an owner account at all — it is every hat at once by a different route, so a
 * toggle there would be a control that cannot mean anything.
 *
 * Switching cannot disturb a night in progress. The two hats are two ROOMS, and
 * a room keeps its own game, its own phones and its own state file — so the
 * worst a mis-tap does is show you the other room until you tap back. Nothing
 * is stopped and nothing is lost, which is why this needs no confirm step.
 */
export function hatSwitch(me, { onSwitch = null, forgetKey = null } = {}) {
  const on = hatOn(me);
  const keyed = Boolean(hat(me).bootstrap || (me && me.bootstrap));

  /*
   * On the host key, AND signed in as the owner in the same browser.
   *
   * The key beats the cookie on the server, which is right — that ordering is
   * what keeps a gig-night bookmark working whatever else is going on. But it
   * used to mean the switch simply vanished once a browser had seen `?key=…`,
   * so the one laptop that is both the dev machine and the gig machine could
   * never look at the quizmaster side at all.
   *
   * So: draw it anyway, and picking a hat FORGETS the remembered key. Nothing
   * about the server's ordering changes, and the bookmark still works because
   * the key is in its URL rather than only in storage.
   */
  const alsoOwner = keyed && me && me.alsoSignedIn && me.alsoSignedIn.role === 'owner';
  if (keyed && !alsoOwner) return null;
  if (!on && !keyed && !isOwner(me)) return null;

  /*
   * THREE states, not two, because the host key is a third thing.
   *
   * On the key you are every hat at once — which is neither of the two hats and
   * is worth saying so, since it is why the console looks different from what a
   * subscriber sees. It only appears while a key is actually in use, so nobody
   * who has never held one ever sees a third button.
   */
  const el = node(`
    <div class="hat-switch" role="group" aria-label="Which hat you are wearing"
         title="Switch between the owner console and your own quizmaster account. Same login, no second password — it is the only way to spot what annoys a quizmaster.">
      ${keyed ? '<button type="button" class="hat-half key live" aria-current="true" title="Signed in with the host key — every hat at once. This is not what a subscriber sees.">Host key</button>' : ''}
      <button type="button" class="hat-half owner ${!keyed && !on ? 'live' : ''}" ${!keyed && !on ? 'aria-current="true"' : ''}>Owner</button>
      <button type="button" class="hat-half qm ${!keyed && on ? 'live' : ''}" ${!keyed && on ? 'aria-current="true"' : ''}>Quizmaster</button>
    </div>`);

  const go = async (wanted) => {
    if (!keyed && wanted === on) return;             // already wearing it
    el.classList.add('working');
    for (const b of el.querySelectorAll('button')) b.disabled = true;
    try {
      // Picking a hat means "stop being the host key". The key still works —
      // it is in the bookmark's URL — but it stops being REMEMBERED, or it
      // would win again on the very next page load and the switch would look
      // like it had done nothing.
      if (keyed && forgetKey) forgetKey();
      await postJson('/api/owner/act-as', { on: wanted });
      if (onSwitch) return onSwitch(wanted);
      /*
       * OWNER TAKES YOU TO THE OWNER PAGE. Quizmaster leaves you where you
       * are.
       *
       * That looks lopsided and is not: the quizmaster side is three pages
       * with no single home, so "the same page with the other powers" is the
       * only sensible landing — while the owner side is exactly ONE page, so
       * there is no other place for it to mean.
       *
       * It also has to be this way now the menu's Owner chip has gone (see
       * `navMenu`): this is the only route to `/owner` in the app, and a
       * switch that took the hat off and sat still would leave that page
       * reachable only by typing the address. The cost is that pressing Owner
       * while in the editor leaves the editor — one tap on Packs to come back,
       * and the reverse has always behaved exactly like this.
       */
      const here = location.pathname;
      if (!wanted) return void (location.href = '/owner');
      location.href = here === '/owner' ? '/console' : here;
    } catch (err) {
      el.classList.remove('working');
      for (const b of el.querySelectorAll('button')) b.disabled = false;
      alert(err.message || 'Could not switch.');
    }
  };
  el.querySelector('.owner').addEventListener('click', () => go(false));
  el.querySelector('.qm').addEventListener('click', () => go(true));

  /*
   * The rungs, in EVERY state rather than only with the hat on.
   *
   * One menu wherever you are, so the switch is the same shape on the owner
   * page, the console and behind the key — you never have to work out why it
   * looks different here. Tapping a rung from any of them means "put the hat
   * on and show me that tier", which is what somebody pressing B actually
   * wants; making them press Quizmaster first was a step that only existed
   * because of how the code happened to be arranged.
   */
  const picker = tierPreview(me, { hatIsOn: on && !keyed, forgetKey: keyed ? forgetKey : null });
  if (picker) el.appendChild(picker);
  return el;
}

/**
 * Look at the app as a Bronze / Silver / Gold subscriber would.
 *
 * The hat exists because every irritation a real quizmaster hits is invisible
 * from behind the host key. The linked quizmaster account is COMPED, though, so
 * wearing the hat has only ever shown the top of the ladder — and every
 * irritation a Bronze subscriber hits is invisible from there for exactly the
 * same reason. "Rob says the Invoices tab has gone" is not a question you can
 * answer from an account that has everything.
 *
 * It sits inside the hat switch rather than beside it because it only means
 * anything while the hat is on: three rungs, the live one filled, one tap each.
 * "All" is the linked account as it really is — comped, the whole ladder — and
 * is the one to come back to before doing anything real.
 *
 * ONLY EVER A DOWNGRADE, and only ever the owner's own account. The server
 * checks the same thing again; this is the control, not the rule.
 */
function tierPreview(me, { hatIsOn = true, forgetKey = null } = {}) {
  const tiers = (me && me.tiers) || [];
  if (!tiers.length) return null;
  // With the hat off there is no tier being previewed, so nothing is lit but
  // "All" — which is also what the hat shows when worn as itself.
  const now = (hatIsOn && me && me.previewTier) || '';

  const el = node(`
    <span class="tier-preview" title="Look at the console as a subscriber on this tier would see it">
      <button type="button" class="tier-half ${now ? '' : 'live'}" data-tier="">All</button>
      ${tiers.map((t) => `
        <button type="button" class="tier-half t-${esc(t.id)} ${now === t.id ? 'live' : ''}"
                data-tier="${esc(t.id)}" title="${esc(t.label)} — ${esc(t.plan)}">${esc(t.label[0])}</button>`).join('')}
    </span>`);

  for (const button of el.querySelectorAll('button')) {
    button.addEventListener('click', async (event) => {
      // The hat switch itself is two buttons in the same box; without this a
      // tap on a rung would also read as a tap on "Quizmaster".
      event.stopPropagation();
      for (const b of el.querySelectorAll('button')) b.disabled = true;
      try {
        if (forgetKey) forgetKey();
        // The hat has to be on for a tier to mean anything, so put it on first
        // if it is not. Two calls rather than one because they are two separate
        // decisions on the server and folding them together would make the
        // act-as route do two jobs.
        if (!hatIsOn) await postJson('/api/owner/act-as', { on: true });
        await postJson('/api/owner/act-as', { tier: button.dataset.tier });
        location.reload();
      } catch (err) {
        for (const b of el.querySelectorAll('button')) b.disabled = false;
        alert(err.message || 'Could not change tier.');
      }
    });
  }
  return el;
}

/**
 * THE LAST SLIDE OF THE NIGHT — "Back here Thursday 20th", with a QR.
 *
 * The winner is up, everyone has a drink and every phone in the room is out.
 * That moment used to be spent on a scoreboard nobody needs any more, and it
 * is the one moment all evening when the whole room is looking up with nothing
 * to do — so it is the cheapest thing this app can do for the venue's takings,
 * which is what gets the quizmaster booked again.
 *
 * **UNDER the winner and the podium, never over them.** Somebody has just won
 * a quiz in front of a room; an advert for next week has no business being the
 * biggest thing on that screen. It is a band, in the same place and the same
 * shape as the draw.
 *
 * The QR is drawn by the server's own encoder at `/qr.svg`, so this needs no
 * library and works with the venue's own link — the same route the advert
 * slides already use. No link means no QR and the line stands on its own: the
 * date is the half that matters and the scan is a bonus.
 */
export function comeBackBand(s) {
  if (!s.comeBack || !s.comeBack.text) return '';
  const { text, link } = s.comeBack;
  return `
    <div class="comeback ${link ? 'has-qr' : ''}">
      <div class="cb-words">
        <div class="cb-line">${esc(text)}</div>
        ${link ? '<div class="cb-note">Scan for what else is on</div>' : ''}
      </div>
      ${link ? `<div class="cb-qr"><img src="/qr.svg?text=${encodeURIComponent(link)}" alt=""></div>` : ''}
    </div>`;
}

/**
 * DRAG AND DROP, on the console's own terms — shared by the editor's round
 * and question reordering and the Workshop's pinned-pack arranger.
 *
 * The host drives this from the laptop that is plugged into the projector, so
 * a mouse is the input this has to serve. The arrow buttons in the editor
 * STAY regardless: drag is the faster way, not the only way — HTML5 drag
 * events do not fire on touch at all, and a control that simply does not
 * exist on a phone is worse than one that is merely slower.
 *
 * A GRIP, drawn, rather than making the whole row draggable: a row is often
 * full of text boxes, and `draggable` on their container stops you selecting
 * a word to retype it.
 *
 * **Lives here rather than in `editor.js`, and that placement is load-bearing
 * — found the expensive way.** `editor.js` has its OWN top-level boot code
 * that assumes it is running on `/editor.html`, reading `#quizPick` and
 * attaching a listener to it. Importing anything from `editor.js` runs that
 * code immediately, on every page that imports it — which broke `/console`
 * outright the first time these three functions were imported from there:
 * `#quizPick` does not exist on that page, so the listener attach threw
 * before `render()` ever ran, and the whole console hung on "Loading your
 * library…" for every account. `client.js` has no page of its own and no
 * boot code, so it is the only safe shared home for anything more than one
 * page needs.
 */
export function gripIcon() {
  return `<svg class="grip-icon" width="14" height="18" viewBox="0 0 14 18" aria-hidden="true">
    ${[3, 9, 15].map((y) => `<circle cx="4" cy="${y}" r="1.6" fill="currentColor"/>
      <circle cx="10" cy="${y}" r="1.6" fill="currentColor"/>`).join('')}
  </svg>`;
}

/**
 * What is being dragged right now.
 *
 * Module level because a drag crosses two elements and outlives any one
 * handler, and `dataTransfer` cannot be read during `dragover` — the one
 * moment you need to know whether the thing under the cursor is a valid
 * target. Cleared on `dragend` whatever happened, so an abandoned drag cannot
 * leave the next click thinking it is a drop.
 */
let dragging = null;

/**
 * Wire one element as a drag source and a drop target.
 *
 * `onDrop(from, to, above)` gets the two descriptors and does the move;
 * everything else here is the plumbing and the line that shows where it
 * would land.
 */
export function dragRow(el, me, canTake, onDrop) {
  const grip = el.querySelector('.drag-grip');
  if (grip) {
    grip.addEventListener('dragstart', (ev) => {
      dragging = me;
      ev.dataTransfer.effectAllowed = 'move';
      // Firefox refuses to start a drag at all without data on the transfer.
      ev.dataTransfer.setData('text/plain', JSON.stringify(me));
      ev.dataTransfer.setDragImage(el, 20, 20);
      el.classList.add('is-dragging');
    });
    grip.addEventListener('dragend', () => {
      dragging = null;
      el.classList.remove('is-dragging');
      for (const n of document.querySelectorAll('.drop-above, .drop-below')) {
        n.classList.remove('drop-above', 'drop-below');
      }
    });
  }
  el.addEventListener('dragover', (ev) => {
    if (!dragging || !canTake(dragging)) return;
    ev.preventDefault();
    ev.dataTransfer.dropEffect = 'move';
    // Above or below, decided by which half of the row the cursor is in —
    // without it a list can only ever be reordered in one direction and the
    // last position is unreachable.
    const box = el.getBoundingClientRect();
    const above = ev.clientY < box.top + box.height / 2;
    el.classList.toggle('drop-above', above);
    el.classList.toggle('drop-below', !above);
  });
  el.addEventListener('dragleave', () => el.classList.remove('drop-above', 'drop-below'));
  el.addEventListener('drop', (ev) => {
    if (!dragging || !canTake(dragging)) return;
    ev.preventDefault();
    ev.stopPropagation();
    const box = el.getBoundingClientRect();
    const above = ev.clientY < box.top + box.height / 2;
    const from = dragging;
    dragging = null;
    el.classList.remove('drop-above', 'drop-below');
    onDrop(from, me, above);
  });
}

/** Move one item of a list to sit before or after another. */
export function moveWithin(list, from, to, above) {
  const [item] = list.splice(from, 1);
  // Taking it out shifts everything after it down one, so a target that was
  // after the source is now one index lower. Getting this wrong is the
  // classic off-by-one that makes a drag "not move" when you drop it one
  // place down.
  const at = to - (from < to ? 1 : 0) + (above ? 0 : 1);
  list.splice(Math.max(0, Math.min(list.length, at)), 0, item);
}

/*
 * A CARD DRAGS WHEN IT IS TOO SMALL FOR THE POOL, and nothing said so until
 * now. Reported live, in the host's own words: a 40-track pack on a 4×4 card
 * (16 squares) means a given player's card holds 16 of the 40 songs — 40% of
 * every call is theirs, well under half, which reads as the round dragging
 * even though the CLOCK is identical to a card that fits well. `minimumTracks()`
 * in `src/bingo.js` already enforces the other end (a pool at least 1.5× the
 * squares, so two cards do not look alike) — this is that same idea read the
 * other way: given how many tracks a pack actually has, which of the shapes
 * that are still valid uses the MOST of them.
 *
 * `cardShapes` is `library.cardShapes` (server-sent, from `CARD_SHAPES` +
 * `minimumTracks()`/`shapeLabel()` in `src/bingo.js`) — never recomputed
 * here, so the console cannot drift from the rule that actually runs the
 * game. Both stay pure, taking everything as a parameter, so a page with no
 * `library` of its own (there is more than one shape picker) can use them.
 */

/** The best-fitting shape for a pack this size — the most squares any valid shape offers, so the fewest calls are wasted on a player's own card. */
export function bestBingoShape(cardShapes, trackCount) {
  const usable = (cardShapes || []).filter((s) => trackCount >= s.minimum);
  const pick = usable.length ? usable : (cardShapes || []).slice(0, 1);
  return pick.reduce((best, s) => ((s.rows * s.cols > best.rows * best.cols) ? s : best), pick[0]) || null;
}

/**
 * A shape option's label, with the pacing a quizmaster is actually choosing
 * baked in — "line of N" already said how long a WIN takes; this says how
 * much of the pack a player actually holds.
 *
 * **IT COUNTS SONGS RATHER THAN QUOTING A PERCENTAGE**, reported directly:
 * *"'60% of your calls hit your card' is awkward wording, can we clarify
 * this and simplify it as well for the reading QM."* Three things were wrong
 * with it and the count fixes all three: **"your card" was ambiguous** on a
 * screen only the quizmaster ever reads (it is the PLAYER's card, not
 * theirs); **a percentage has to be converted** before it means anything,
 * where "16 of 40 songs" is the thing itself; and it buried the actual
 * decision, which is whether the round will drag.
 *
 * **So the warning is said in words, not left to be derived.** The host's own
 * report of the fault this exists to prevent was *"they're not even getting a
 * song fifty percent of the time… the round seems to drag"* — so under half
 * the pack, the label says `drags`. That is a judgement rather than a
 * measurement, which is the point: it is the one a quizmaster would have had
 * to work out from the percentage, and this app's rule is that a control
 * needing a paragraph is a design problem.
 */
export function bingoShapeLabel(shape, trackCount) {
  const line = `${shape.label} — line of ${Math.max(shape.rows, shape.cols)}`;
  if (!trackCount) return line;
  const squares = shape.rows * shape.cols;
  // Half is the line the host drew himself. At or above it a card keeps up
  // with the calls; below it most of what is played is on somebody else's.
  const drags = squares * 2 < trackCount;
  return `${line} · ${squares} of ${trackCount} songs on a card${drags ? ' — drags' : ''}`;
}
