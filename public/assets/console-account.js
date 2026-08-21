/** MY ACCOUNT — who you are, what you pay for, the shop, and getting help. */

import { esc, node, postJson, binIcon } from './client.js';
import { generate } from './console-generate.js';
import { packCard, packPrice, preview } from './console-packs.js';
import { accountsExist, library, me, setAccountsExist } from './console-state.js';
import { night } from './console-tonight.js';
import { money } from './console-invoices.js';
import { TABS, can, currentTab, hostKey, keyed, load, render } from './console.js';
import { FEATURES, FEATURE_META, NOT_BUILT, SWITCHABLE } from './plans.js';
import { paintScheme } from './schemes.js';

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
export function helpSection() {
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

/**
 * ACCOUNT — what you HAVE. Read far more often than it is changed.
 *
 * **SPLIT FROM SETTINGS AGAIN, and this time the split holds, because the
 * third thing finally has somewhere to go.** They were one tab because both
 * halves had shrunk to almost nothing — but the reason each had shrunk was
 * that the SELL was in here too, and the host has now given the sell a room of
 * its own: *"shop will be the place they can buy packs and upgrade their
 * subscription."*
 *
 * So the old objection is gone. Three short pages about one subject on a
 * scrolling tab bar was the problem; three clearly different questions behind
 * one door is not:
 *
 *  - **Account** — what you have. Who you are, what you are on, your room.
 *  - **Shop** — what you could buy. Packs and the rungs, in one place.
 *  - **Settings** — what you have switched on.
 *
 * The tier comparison went to the Shop with the packs, which is the change
 * that makes this page short enough to be worth reading.
 */
export function accountSection() {
  const wrap = document.createDocumentFragment();
  // Who you are and what you are on, in one card at the top. They were two,
  // one under the other, both three short rows — which is two headings and two
  // borders around what is plainly one answer to "what is my account".
  wrap.appendChild(youPanel());
  wrap.appendChild(roomPanel());
  // Silent for the owner, who has no subscription of their own to refer
  // anybody into.
  const ref = referralPanel();
  if (ref) wrap.appendChild(ref);
  // Silent when the whole catalogue is in reach, which is everybody today —
  // so it genuinely returns nothing rather than an empty panel.
  const lib = libraryPanel();
  if (lib) wrap.appendChild(lib);
  // Silent for the owner, who runs no group of their own.
  const grp = groupPanel();
  if (grp) wrap.appendChild(grp);
  return wrap;
}

/**
 * YOUR GROUP — a company or a pub group, seats under a parent.
 *
 * A parent is DERIVED, never stored: any quizmaster becomes one the moment
 * they add a first seat, so there is no "create a group" step here, only
 * "add a seat". See CLAUDE.md's Owner/Parent/Child section and
 * `docs/business/groups.md`.
 *
 * Deliberately a small, self-contained panel rather than a tab or door of
 * its own — this is a first slice (accounts, entitlements, scoping), not
 * the full group-admin screen the design doc sketches (that reuses People
 * and Tonight, scoped, and is a bigger job for when it is actually needed).
 */
function groupPanel() {
  if (!me || me.role === 'owner') return null;
  const el = node(`
    <div class="panel">
      <h3>Your group</h3>
      <div class="tiny grp-note">Loading…</div>
      <div class="grp-seats"></div>
      <div class="grp-add" hidden>
        <div class="row" style="margin-top:10px;gap:8px">
          <input type="text" class="grp-add-name" placeholder="Their name" style="flex:1">
        </div>
        <div class="row" style="margin-top:8px;gap:8px">
          <input type="email" class="grp-add-email" placeholder="Their email" style="flex:1">
        </div>
        <div class="row" style="margin-top:8px;gap:8px">
          <input type="password" class="grp-add-password" placeholder="A password for them to start with" style="flex:1">
        </div>
        <div class="row" style="margin-top:10px;align-items:center;gap:12px">
          <button class="go grp-add-go">Add a seat</button>
          <span class="tiny grp-add-said"></span>
        </div>
      </div>
    </div>`);

  const note = el.querySelector('.grp-note');
  const seatsEl = el.querySelector('.grp-seats');
  const addBox = el.querySelector('.grp-add');

  const seatRow = (seat) => `
    <div class="grp-seat-row" data-id="${esc(seat.id)}">
      <div>
        <div><b>${esc(seat.name || seat.email)}</b></div>
        <div class="tiny">${esc(seat.email)}${seat.running
          ? ` · <b>Live now</b> — ${seat.running.playerCount} in, ${esc(seat.running.title)}`
          : ''}</div>
      </div>
      <button class="minor danger grp-seat-remove" type="button" aria-label="Remove this seat" title="Remove this seat">${binIcon(16)}</button>
    </div>`;

  const wireRemove = (row) => {
    row.querySelector('.grp-seat-remove').addEventListener('click', async () => {
      if (!confirm('Remove this seat? Their own account, room and packs are untouched — they simply go back to running on their own tier.')) return;
      await fetch(keyed(`/api/group/seats/${encodeURIComponent(row.dataset.id)}`), {
        method: 'DELETE', headers: { 'X-Host-Key': hostKey },
      });
      row.remove();
    });
  };

  fetch(keyed('/api/group')).then((r) => r.json()).then((d) => {
    if (d.isSeat) {
      note.textContent = 'You are a seat in somebody else’s group — your tier is set by whoever runs it.';
      return;
    }
    const seats = d.seats || [];
    note.textContent = seats.length
      ? 'Everyone here gets everything your own tier gives, except streaming — one bill instead of several.'
      : 'Running more than one quizmaster? Add them as a seat — they get everything your tier gives, except streaming, on one bill.';
    seatsEl.replaceChildren(...seats.map((s) => node(seatRow(s))));
    for (const row of seatsEl.querySelectorAll('.grp-seat-row')) wireRemove(row);
    addBox.hidden = false;
  }).catch(() => { note.textContent = 'Could not load your group right now.'; });

  el.querySelector('.grp-add-go').addEventListener('click', async () => {
    const said = el.querySelector('.grp-add-said');
    const name = el.querySelector('.grp-add-name').value.trim();
    const email = el.querySelector('.grp-add-email').value.trim();
    const password = el.querySelector('.grp-add-password').value;
    if (!email || !password) { said.textContent = 'An email and a password are needed.'; return; }
    try {
      const res = await fetch(keyed('/api/group/seats'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Host-Key': hostKey },
        body: JSON.stringify({ name, email, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not add that seat');
      el.querySelector('.grp-add-name').value = '';
      el.querySelector('.grp-add-email').value = '';
      el.querySelector('.grp-add-password').value = '';
      said.textContent = '';
      const row = node(seatRow(data.seat));
      seatsEl.appendChild(row);
      wireRemove(row);
    } catch (err) {
      said.textContent = err.message;
    }
  });

  return el;
}

/**
 * REFER A QUIZMASTER, KEEP 20% OF THEIR BILL — FOR LIFE, ONCE THEY PAY.
 *
 * The link is `/signup?ref=<accountId>` — the account's own id, not a
 * separate code to generate and keep straight. `accounts.create()` doubles
 * the new signup's trial when it carries a real referrer; this panel is only
 * the other half, showing what THIS account earns from having sent one.
 *
 * The credit is READ, never a control — there is nothing to switch on or
 * off, and it can only ever be zero until somebody it referred is actually
 * paying (`status: 'active'`, not `'trialing'`). And it is a NUMBER, not yet
 * a deduction: there is no live payment processor for it to come off a real
 * charge, so it says so rather than implying it already has.
 */
function referralPanel() {
  if (!me || me.role === 'owner') return null;
  const link = `${location.origin}/signup?ref=${encodeURIComponent(me.id)}`;
  const credit = money(me.referralCreditPence || 0);
  const el = node(`
    <div class="panel">
      <h3>Refer a quizmaster</h3>
      <div class="tiny">Send this link. Whoever signs up with it gets a
        four-week trial instead of two — and once they are paying, you keep
        20% of their bill for as long as they stay a subscriber.</div>
      <div class="row acct-refer-row">
        <input class="acct-refer-url" type="text" readonly aria-label="Your referral link" value="${esc(link)}">
        <button class="minor acct-refer-copy" type="button">Copy</button>
      </div>
      <div class="tiny acct-refer-said"></div>
      <div class="tiny acct-refer-credit">Referral credit so far: <b>${esc(credit)}/month</b>${
  Number(me.referralCreditPence || 0) > 0
    ? ' — shown here for now; there is no payment processor yet for it to come off a real bill.'
    : ''}</div>
    </div>`);
  el.querySelector('.acct-refer-copy').addEventListener('click', async () => {
    const box = el.querySelector('.acct-refer-url');
    const said = el.querySelector('.acct-refer-said');
    box.select();
    try {
      await navigator.clipboard.writeText(link);
      said.textContent = 'Copied.';
    } catch {
      said.textContent = 'Selected — copy it from there.';
    }
  });
  return el;
}

/**
 * SETTINGS — the things you OPERATE, and nothing you merely read.
 *
 * That is the whole test for what belongs here, and it is what stops this
 * becoming the bin the Workshop had become: **if it is a fact, it is on
 * Account; if it is a switch, it is here.**
 */
export function settingsSection() {
  const wrap = document.createDocumentFragment();
  wrap.appendChild(askRoundsPanel());
  wrap.appendChild(schemePanel()[0] || node('<span></span>'));
  wrap.appendChild(switchPanel());
  wrap.appendChild(demoPrizePanel());
  return wrap;
}

/**
 * THE SHOP — packs to buy, and the rung above the one you are on.
 *
 * *"Shop will be the place they can buy packs and upgrade their
 * subscription."* Both halves in one room, and that pairing is the point
 * rather than a filing convenience: **they are two ways to get the same
 * thing.** Six packs at three pounds each and a step up a tier are the same
 * decision asked twice, and answering it used to mean holding a price from the
 * bottom of one tab against a table on another.
 *
 * **IT LEFT THE PACK SHELF, and that is the bigger half of the change.** The
 * shop lived under the packs on the Workshop door — something to spend money
 * on at the bottom of the page somebody opens to work. A shop is a place you
 * go, not a thing that follows you around.
 *
 * **BOTH GAMES IN ONE GRID, because you are shopping rather than launching.**
 * On the shelf a quiz and a bingo game are different jobs and want different
 * tabs; here they are both "a pack I could buy", and splitting them would mean
 * checking two tabs to see what is new.
 */
export function shopSection() {
  const el = node(`
    <div class="game-section">
      <div class="game-head">
        <div>
          <h2>Quizporium packs</h2>
          <div class="tiny"><span class="shop-count"></span> — ${esc(packPrice())} each.
            Written and checked for you — every question read through twice, and
            every bingo chorus lands on its own.
            ${esc((library.catalogue && library.catalogue.blurb) || '')}</div>
        </div>
      </div>
      <div class="pack-grid shop-grid"></div>
      <div class="shop-tiers"></div>
      <div class="ask-slot"></div>
    </div>`);

  const grid = el.querySelector('.shop-grid');
  const paint = () => {
    /*
     * ONE LIST, both kinds, quizzes first — a stable order rather than one
     * that depends on which library happens to be longer, because a shelf that
     * reshuffles is worse than one with no order at all.
     */
    const forSale = [
      ...(library.quizzes || []).filter((p) => p.locked).map((p) => ({ kind: 'quiz', pack: p })),
      ...(library.bingo || []).filter((p) => p.locked).map((p) => ({ kind: 'bingo', pack: p })),
    ];
    grid.replaceChildren();
    el.querySelector('.shop-count').textContent = forSale.length
      ? `${forSale.length} to buy`
      : 'Nothing left to buy';
    if (!forSale.length) {
      // Everything is already theirs. Say so plainly rather than drawing an
      // empty grid, which reads as something that failed to load.
      grid.appendChild(node('<div class="tiny">You have all of them. Anything new turns up here.</div>'));
      return;
    }
    for (const { kind, pack } of forSale) grid.appendChild(packCard(kind, pack, paint));
  };
  paint();

  /*
   * THE RUNGS, UNDER THE PACKS. In that order because the packs are what
   * somebody came for — the tier is the answer to "is there a cheaper way to
   * get several of these", which is a question you have after looking at the
   * prices rather than before.
   */
  const compare = comparePanel();
  if (compare) el.querySelector('.shop-tiers').appendChild(compare);

  /*
   * "There is nothing here for the night I have booked" — under the shop,
   * because that is the moment the want actually arrives: you have scrolled
   * the catalogue and it has not got the thing.
   */
  el.querySelector('.ask-slot').appendChild(askForPackPanel('quiz'));
  return el;
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
  /*
   * PUT THEIR OWN PUB'S NAME ON IT.
   *
   * The demo's whole job is getting a landlord to picture this happening in
   * THEIR room, and a card footed with somebody else's venue — or with none —
   * leaves them doing that work themselves. `?at=` is read by `voucher.js` and
   * drawn straight onto the card. Nothing is stored and nothing is asked of
   * the server, so it still works at four in the afternoon on pub wifi.
   *
   * The venues they already have, because that is who they are pitching to
   * next; a free-text box would be a second way to spell a pub they have
   * already spelled once. Empty means the card simply has no venue on it,
   * exactly as before.
   */
  const venues = (library.venueRecords || []).map((v) => v.name).filter(Boolean);
  const linkFor = (venue) => `${location.origin}/v?c=DEMO${venue ? `&at=${encodeURIComponent(venue)}` : ''}`;

  const el = node(`
    <div class="panel">
      <h3>Show somebody the prize</h3>
      <div class="tiny">Selling a night to a venue? Let them scan this. They see
        exactly what their bar staff would see when a winner shows up. It is a
        demonstration — nothing is given away and it works as many times as you
        like.</div>
      ${venues.length ? `<label class="tiny demo-at">Put a venue on it
        <select class="demo-venue">
          <option value="">No venue</option>
          ${venues.map((v) => `<option value="${esc(v)}">${esc(v)}</option>`).join('')}
        </select></label>` : ''}
      <div class="demo-prize">
        <img class="demo-qr" alt="A demonstration prize code"
          src="/qr.svg?text=${encodeURIComponent(linkFor(''))}&dark=%230b0b12&light=%23ffffff">
        <div class="demo-side">
          <a class="minor demo-open" href="${linkFor('')}" target="_blank" rel="noopener">Open it yourself</a>
          <div class="tiny demo-link">${esc(linkFor(''))}</div>
        </div>
      </div>
    </div>`);

  // Repointed in place rather than re-rendered: the panel is on a tab somebody
  // is reading, and swapping the whole card under them to change one word in a
  // QR is a redraw they would notice for nothing.
  el.querySelector('.demo-venue')?.addEventListener('change', (ev) => {
    const link = linkFor(ev.target.value);
    el.querySelector('.demo-qr').src = `/qr.svg?text=${encodeURIComponent(link)}&dark=%230b0b12&light=%23ffffff`;
    el.querySelector('.demo-open').href = link;
    el.querySelector('.demo-link').textContent = link;
  });
  return el;
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
export function askForPackPanel(kind) {
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
  const bad = status === 'past_due' || status === 'cancelled' || ent.trialExpired;
  const daysLeft = status === 'trialing' && ent.trialEndsAt && !ent.trialExpired
    ? Math.max(1, Math.ceil((new Date(ent.trialEndsAt).getTime() - Date.now()) / 86_400_000))
    : 0;
  const statusWords = ent.trialExpired ? 'trial ended'
    : daysLeft ? `trialing — ${daysLeft} day${daysLeft === 1 ? '' : 's'} left`
    : status.replace('_', ' ');

  const el = node(`
    <div class="panel">
      <h3>Your account</h3>
      <div class="acct-grid">
        <div><div class="tiny">Name</div><div class="acct-val">${esc((me && me.name) || '—')}</div></div>
        <div><div class="tiny">Email</div><div class="acct-val">${esc((me && me.email) || '—')}</div></div>
        <div><div class="tiny">On your projector</div><div class="acct-val brand-preview">${esc(library.brand || '')}</div></div>
        <div><div class="tiny">Tier</div><div class="acct-val">${esc(tierName)}</div></div>
        <div><div class="tiny">Subscription</div>
          <div class="acct-val ${bad ? 'bad' : 'good'}">${esc(statusWords)}</div></div>
      </div>
      <div class="tiny acct-note">Your projector name is your first name and the app's, so it matches
        how you introduce yourself.</div>
      ${ent.trialExpired ? `<div class="tiny acct-note bad"><b>Your trial has ended.</b>
        Get in touch to keep going.</div>`
        : bad ? `<div class="tiny acct-note bad"><b>A lapsed subscription never interrupts a night.</b>
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
export function firstOwnerPanel() {
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
      setAccountsExist(true);
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
export function otherRoomsPanel(others) {
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
export function backupWarning(gen) {
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
