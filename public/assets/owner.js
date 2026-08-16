/**
 * The owner console.
 *
 * Deliberately not the quiz console with extra buttons. This account runs no
 * nights — it manages the people who do, and writes the packs they buy. Keeping
 * it a separate page means the subscriber list can never be one mis-tap away
 * from the Next button during somebody's gig.
 */

import { esc, node, brandLink, paintNav, paintIdentity, menuRights, postJson } from './client.js';
import { TIERS, tierFor, findTier, KINDS, KIND_LABEL, kindOf,
  FEATURE_TIER, FEATURE_META, tierOf, setTierOverrides, NOT_BUILT } from './plans.js';
import { photosSection } from './photos-tab.js';

const mainEl = document.getElementById('main');
const whoEl = document.getElementById('whoami');

let me = null;
let subscribers = [];
/*
 * Who is running what, what the catalogue is worth, and what the AI has cost.
 *
 * One fetch, because the page draws all three and three fetches is three ways
 * for it to be half drawn. Never fatal — the quizmaster list must still appear
 * if this route has a bad moment, which is the same rule the reports and the
 * suggestion box already follow.
 */
let overview = { rooms: [], packs: [], spend: null, spendBackedUp: false };
/* Which tab. Module level so answering something does not send you back to
 * the top of a different one. */
let ownerTab = 'people';
/*
 * Whether the accounts are being backed up.
 *
 * Module level for the same reason the tab is, and it was NOT: every redraw
 * except the first passed `backupReady: true` as a literal, so the "accounts
 * are not being backed up" warning appeared on the first paint and then
 * vanished the moment you touched a tab. That is a worse version of the fault
 * its own comment describes — a warning you have to have been looking at the
 * right moment to see.
 */
let backupReady = true;

async function api(path, options) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (res.status === 401) { location.href = '/login?next=/owner'; throw new Error('Sign in'); }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data;
}

async function boot() {
  const who = await api('/api/me');
  if (!who.signedIn) { location.href = '/login?next=/owner'; return; }
  me = who.account;
  /*
   * THE LIVE LADDER, BEFORE THE TIERS TAB DRAWS ITSELF.
   *
   * `plans.js` runs in this page too and its overrides start empty, so without
   * this the buckets would open showing the tiers the app SHIPS with — the
   * owner would move something, see it move, reload, and find it back where it
   * started. The server had stored it correctly the whole time; this page was
   * simply never told.
   */
  setTierOverrides(who.featureTiers || {});

  const brand = await api('/api/brand');
  // `brandLink`, like every other page — the bare mark-and-words came out ten
  // pixels narrower, which moved the menu beside it.
  document.getElementById('brandSlot').innerHTML =
    brandLink(brand.name, { size: 26, appName: brand.appName || '' });
  // Nothing in the menu lights on this page, and that is right rather than a
  // miss: the menu carries the three QUIZMASTER pages and this is not one of
  // them. Which side you are on is the hat switch's job, and it says Owner.
  paintNav(document.getElementById('navSlot'), { current: 'owner', ...menuRights(who) });
  whoEl.textContent = me.role === 'owner' ? `Owner — ${me.email}` : `Signed in as ${me.email}`;

  // The switch into your own quizmaster account, in the same corner it sits in
  // on the console — so it is one control in one place rather than a button
  // buried in a panel halfway down this page.
  // The owner page has no key of its own to forget, but pass one anyway so the
  // switch behaves identically wherever it is drawn.
  paintIdentity(who, {
    forgetKey: () => { try { localStorage.removeItem('musicquiz.hostkey'); } catch { /* private */ } },
  });

  /*
   * THE OWNER, WEARING THEIR OWN QUIZMASTER HAT, ON THIS PAGE.
   *
   * Wearing the hat your role IS quizmaster — that is the whole point of it —
   * so this page refuses you, and it used to refuse you with a sentence
   * written for somebody else entirely: *"your account runs quiz nights"*,
   * said to the person who owns the app. Which is not a wrong permission, it
   * is a wrong SENTENCE, and it reads as a fault in the account.
   *
   * It was unreachable until the menu's Owner chip was taken off. That chip
   * carried `data-hat="off"` and took the hat off on the way through, so the
   * only route here always arrived with it off. Now the only route is the hat
   * switch — and any OTHER way in (a bookmark, the back button, typing the
   * address) lands on a page that cannot open, with nothing on it that opens
   * it. Found by the host doing exactly that.
   *
   * So: say which of the two it is, and put the way through ON the refusal
   * rather than expecting somebody to notice a switch in the corner. One tap,
   * and safe mid-night for the reason the switch already is — the two hats are
   * two rooms, and nothing being played is touched.
   */
  if (me.role !== 'owner') {
    const acting = Boolean(who.actingAs);
    const panel = node(`
      <div class="problems">
        ${acting ? `
          <strong>Your quizmaster hat is on.</strong>
          The owner console needs it off — that is what the hat does.
          <button class="btn" id="hatOff" style="margin-left:10px">Take it off and show me</button>`
        : `
          <strong>This is the owner console.</strong>
          Your account runs quiz nights — <a href="/console">that way</a>.`}
      </div>`);
    panel.querySelector('#hatOff')?.addEventListener('click', async (ev) => {
      const button = ev.currentTarget;
      button.disabled = true;
      button.textContent = 'One moment…';
      try {
        await postJson('/api/owner/act-as', { on: false });
      } catch { /* reload anyway — the page says plainly what it wants */ }
      location.reload();
    });
    mainEl.replaceChildren(panel);
    return;
  }
  await load();
}

let reports = [];
let suggestions = [];
let canDraft = false;
let houseNotes = '';
// Which pile you are looking at. Module level so working through the list does
// not throw you back to the top every time you answer one.
let inboxShow = 'open';

async function load() {
  const data = await api('/api/owner/accounts');
  subscribers = data.accounts || [];
  // Never fatal. A quizmaster list that will not draw because the reports
  // route had a bad moment is a worse outcome than no reports panel.
  try {
    reports = (await api('/api/reports')).reports || [];
  } catch {
    reports = [];
  }
  // Never fatal either, and for the same reason: a quizmaster list that will
  // not draw because the suggestion box had a bad moment is a worse outcome.
  try {
    const box = await api('/api/suggestions');
    suggestions = box.suggestions || [];
    canDraft = Boolean(box.canDraft);
    houseNotes = box.house || '';
  } catch {
    suggestions = [];
  }
  try {
    overview = await api('/api/owner/overview');
  } catch {
    overview = { rooms: [], packs: [], spend: null, spendBackedUp: false };
  }
  /*
   * `backupReady`, not `backedUp` — two different facts, and reading the wrong
   * one is why this warning was permanently on.
   *
   * GET /api/owner/accounts answers `backupReady`: is a private repository
   * configured at all. The WRITE routes answer `backedUp`: did that particular
   * save reach it. This warning says "set PHOTO_REPO", so it is the first one;
   * `data.backedUp` is simply absent here, which read as false, which is how
   * the owner page told Mark his accounts were not being backed up while they
   * sat in the repository.
   */
  backupReady = Boolean(data.backupReady);
  redraw();
}

/**
 * Corrections sent in from a night.
 *
 * At the top, above the quizmaster list, because it is the only thing on this
 * page that somebody is waiting on. Each one carries a COPY of the question as
 * it was on screen — the pack may well have been edited since, and a report
 * that only pointed at "round 2 question 7" would send you confidently to the
 * wrong question.
 */
function reportsPanel() {
  const open = reports.filter((r) => r.status === 'open');
  if (!reports.length) return [];

  const when = (at) => {
    const days = Math.floor((Date.now() - at) / 86400000);
    return days < 1 ? 'today' : days === 1 ? 'yesterday' : `${days} days ago`;
  };

  const el = node(`
    <div class="game-section">
      <div class="game-head">
        <div>
          <h2>Reported questions</h2>
          <div class="tiny">${open.length} to look at${reports.length - open.length ? ` · ${reports.length - open.length} dealt with` : ''}</div>
        </div>
      </div>
      <div class="reports"></div>
    </div>`);

  const list = el.querySelector('.reports');
  const shown = open.length ? open : reports.slice(0, 5);
  for (const r of shown) {
    const row = node(`
      <div class="rep-row${r.status === 'done' ? ' done' : ''}">
        <div class="rep-main">
          <div class="rep-q">${esc(r.prompt || '(no question text)')}</div>
          <div class="tiny">${esc(r.packId)}${r.roundIndex !== null ? ` · round ${r.roundIndex + 1} question ${r.questionIndex + 1}` : ''}
            ${r.answer ? ` · answer: ${esc(r.answer)}` : ''}</div>
          <div class="tiny">reported by ${esc(r.by || 'somebody')} ${esc(when(r.at))}${r.note ? ` — ${esc(r.note)}` : ''}</div>
        </div>
        <div class="rep-acts">
          <a class="minor" href="/editor?quiz=${encodeURIComponent(r.packId)}">Open</a>
          ${r.status === 'open' ? '<button class="minor fixed">Dealt with</button>' : '<button class="minor reopen">Reopen</button>'}
        </div>
      </div>`);
    const set = async (status) => {
      await api(`/api/reports/${encodeURIComponent(r.id)}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }),
      });
      load();
    };
    row.querySelector('.fixed')?.addEventListener('click', () => set('done'));
    row.querySelector('.reopen')?.addEventListener('click', () => set('open'));
    list.appendChild(row);
  }
  return [el];
}

/**
 * The suggestion box, from the reading end.
 *
 * Ideas, irritations and bugs about the APP — deliberately a different list
 * from the reported questions above, because a report is answered by editing a
 * pack and a suggestion is answered by a decision. One pile of both would be a
 * page you skim rather than work through.
 *
 * Open ones first. A suggestion nobody has closed is somebody who took the
 * trouble to tell you something and has heard nothing back.
 */
const SUGG_LABEL = {
  idea: 'Idea',
  annoying: 'Got in the way',
  broken: 'Broken',
  // Gold only, and a different job from the rest of this list: the others need
  // a decision, this one needs the generator pressing and twenty minutes of
  // reading. It gets its own pile below for exactly that reason.
  pack: 'Wants a pack',
};

function suggestionsPanel() {
  if (!suggestions.length) return [];
  const open = suggestions.filter((s) => s.status === 'open');
  const done = suggestions.filter((s) => s.status !== 'open');
  /*
   * Pack requests get a pile of their own, because they are a different JOB.
   *
   * Everything else here needs a decision and a reply. A pack request needs
   * the generator pressed and twenty minutes of reading — and the host does
   * that on his admin day, all in one go. A list where those are scattered
   * among the ideas is one you work through twice.
   */
  const packs = open.filter((s) => s.kind === 'pack');
  const shown = inboxShow === 'packs' ? packs : inboxShow === 'open' ? open : done;

  const when = (at) => {
    const days = Math.floor((Date.now() - at) / 86400000);
    return days < 1 ? 'today' : days === 1 ? 'yesterday' : `${days} days ago`;
  };

  const el = node(`
    <div class="game-section">
      <div class="game-head">
        <div>
          <h2>Inbox</h2>
          <div class="tiny">${open.length ? `${open.length} to deal with` : 'Nothing waiting — the list is clear.'}${
            packs.length ? ` · <b>${packs.length} pack${packs.length === 1 ? '' : 's'} to write</b>` : ''}</div>
        </div>
        <div class="row">
          <button class="minor pile ${inboxShow === 'open' ? 'on' : ''}" data-show="open">To deal with (${open.length})</button>
          ${packs.length ? `<button class="minor pile packs ${inboxShow === 'packs' ? 'on' : ''}" data-show="packs">Packs to write (${packs.length})</button>` : ''}
          <button class="minor pile ${inboxShow === 'done' ? 'on' : ''}" data-show="done">Cleared (${done.length})</button>
        </div>
      </div>
      <div class="suggs"></div>
      ${canDraft ? `
        <details class="house">
          <summary class="tiny">What the drafting model knows about your business</summary>
          <div class="tiny house-note">It is not trained on anything — it is told this, fresh, every
            time you press Draft. Add a line whenever a draft says something wrong and it will stop
            saying it. It is also given who wrote in and how you have answered before, so it gets
            closer to your voice the more you use it.</div>
          <textarea class="house-text" rows="6"
            placeholder="e.g. Bronze does not include invoicing. I deploy on Sundays. Never offer a phone call.">${esc(houseNotes)}</textarea>
          <div class="row" style="margin-top:8px;align-items:center;gap:10px">
            <button class="minor house-save">Save these notes</button>
            <span class="tiny house-said"></span>
          </div>
        </details>` : ''}
    </div>`);

  const houseBox = el.querySelector('.house-text');
  el.querySelector('.house-save')?.addEventListener('click', async () => {
    const said = el.querySelector('.house-said');
    try {
      await api('/api/suggestions/house', {
        method: 'PUT', body: JSON.stringify({ house: houseBox.value }),
      });
      houseNotes = houseBox.value;
      said.textContent = 'Saved.';
      setTimeout(() => { said.textContent = ''; }, 4000);
    } catch (err) {
      said.textContent = err.message;
    }
  });

  for (const b of el.querySelectorAll('.pile')) {
    b.addEventListener('click', () => { inboxShow = b.dataset.show; redraw(); });
  }

  const list = el.querySelector('.suggs');
  if (!shown.length) {
    list.appendChild(node(`<div class="tiny">${inboxShow === 'packs' ? 'No packs waiting to be written.' : inboxShow === 'open'
      ? 'Nothing waiting. Anything they send lands here.'
      : 'Nothing cleared yet.'}</div>`));
  }

  for (const s of shown) {
    const row = node(`
      <div class="sugg-item${s.status === 'done' ? ' done' : ''}">
        <div class="sugg-head">
          <span class="sugg-kind-tag ${esc(s.kind)}">${esc(SUGG_LABEL[s.kind] || s.kind)}</span>
          <b>${esc(s.by || 'somebody')}</b>
          <span class="tiny">#${esc(s.ref || '????')}${s.where ? ` · from the ${esc(s.where)} tab` : ''} · ${esc(when(s.at))}</span>
        </div>
        <div class="sugg-said">${esc(s.text)}</div>
        ${(s.replies || []).map((r) => `
          <div class="sugg-reply">
            <span class="tiny">${esc(r.by || 'You')} replied ${esc(when(r.at))}
              · <span class="seen ${r.seenAt ? 'yes' : 'no'}">${r.seenAt
                ? `opened ${esc(when(r.seenAt))}`
                : 'not opened yet'}</span></span>
            <div>${esc(r.text)}</div></div>`).join('')}
        <div class="sugg-acts">
          ${canDraft ? '<button class="minor draft">Draft a reply</button>' : ''}
          <button class="minor write">${(s.replies || []).length ? 'Reply again' : 'Write a reply'}</button>
          ${s.status === 'open'
            ? '<button class="minor clear">Clear it without replying</button>'
            : '<button class="minor reopen">Put it back</button>'}
          <button class="minor danger bin">Bin</button>
        </div>
        <div class="sugg-compose" hidden>
          <textarea rows="4" class="sugg-draft" placeholder="Your reply…"></textarea>
          <div class="row" style="margin-top:8px;align-items:center;gap:10px">
            <button class="go send">Send it</button>
            <button class="minor cancel">Cancel</button>
            <span class="tiny note"></span>
          </div>
        </div>
      </div>`);

    const compose = row.querySelector('.sugg-compose');
    const box = row.querySelector('.sugg-draft');
    const note = row.querySelector('.note');
    const show = () => { compose.hidden = false; box.focus(); };

    row.querySelector('.write').addEventListener('click', show);
    row.querySelector('.cancel').addEventListener('click', () => { compose.hidden = true; });

    /*
     * Draft, never send. A reply that goes out unread is the one that goes
     * publicly wrong, so this only ever fills the box — the Send button is
     * still a separate, deliberate press.
     */
    row.querySelector('.draft')?.addEventListener('click', async (e) => {
      const button = e.currentTarget;
      button.disabled = true;
      button.textContent = 'Drafting…';
      show();
      try {
        const data = await api(`/api/suggestions/${encodeURIComponent(s.id)}/draft`, { method: 'POST' });
        box.value = data.draft || '';
        // Kept so the server can tell how much of it you actually rewrote —
        // see mostlyMine(). A draft sent as it came must not become an example
        // of your voice, or the thing ends up learning from itself.
        box.dataset.draft = data.draft || '';
        note.textContent = 'A draft — read it before you send it.';
      } catch (err) {
        note.textContent = err.message;
      }
      button.disabled = false;
      button.textContent = 'Draft a reply';
    });

    row.querySelector('.send').addEventListener('click', async () => {
      const words = box.value.trim();
      if (!words) { box.focus(); return; }
      try {
        await api(`/api/suggestions/${encodeURIComponent(s.id)}/reply`, {
          method: 'POST', body: JSON.stringify({ text: words, draft: box.dataset.draft || '' }),
        });
        load();
      } catch (err) {
        note.textContent = err.message;
      }
    });

    const set = async (status) => {
      await api(`/api/suggestions/${encodeURIComponent(s.id)}`, {
        method: 'POST', body: JSON.stringify({ status }),
      });
      load();
    };
    row.querySelector('.clear')?.addEventListener('click', () => set('done'));
    row.querySelector('.reopen')?.addEventListener('click', () => set('open'));
    row.querySelector('.bin').addEventListener('click', async () => {
      if (!confirm('Bin this? Somebody took the trouble to send it.')) return;
      await api(`/api/suggestions/${encodeURIComponent(s.id)}`, { method: 'DELETE' });
      load();
    });
    list.appendChild(row);
  }
  return [el];
}

/**
 * Put the quizmaster hat on.
 *
 * One login, two hats. The host key gives the owner every feature at once, so
 * anything that irritates a real quizmaster is invisible from behind it — this
 * is the only way to see the app the way a subscriber does. It is a downgrade
 * and nothing else: the owner's own linked account, its permissions, its room.
 */


// ====================================================================== money

/**
 * £ from pence, for a page that talks in both subscriptions and API calls.
 *
 * A subscription is whole pounds and a checker batch is a fraction of a penny,
 * and one format cannot read well for both — "£0" next to a real cost is a
 * number people stop trusting. So anything under a pound keeps its pence.
 */
function money(pence) {
  const n = Number(pence) || 0;
  if (n && Math.abs(n) < 100) return `${n < 10 ? n.toFixed(2).replace(/0$/, '') : Math.round(n)}p`;
  return `£${(n / 100).toFixed(Math.abs(n) % 100 ? 2 : 0)}`;
}

function monthName(iso) {
  const [y, m] = String(iso).split('-');
  const names = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];
  return `${names[Number(m) - 1] || iso} ${y}`;
}

/**
 * What is coming in, what has stopped, and what the AI is costing.
 *
 * These were three things you could only work out by opening the accounts file
 * and the card statement side by side. The point of putting them on one panel
 * is the comparison: the tier structure exists to cover the second number with
 * the first, and until now neither was written down anywhere.
 *
 * **Everything here is what HAS happened, never a forecast.** Monthly recurring
 * is what the tiers say the paying accounts are worth today — not what they
 * might be worth if the lapsed ones came back, and not annualised. A number on
 * this page that turned out to be a projection is one nobody would trust again.
 */
/**
 * THE TIER BUCKETS — which rung each feature is sold on.
 *
 * Asked for as *"assign gold, silver and bronze features to the bronze, silver
 * and gold buckets."* Until this existed, moving one was a one-word edit in
 * `plans.js` and a deploy — so the ladder, which is the pricing of the whole
 * business, was the one thing the owner could not change from the app.
 *
 * **THREE COLUMNS, ONE SELECT PER FEATURE — not a drag.** A drag reads better
 * in a mock-up and is worse here for two reasons this file already knows:
 * HTML5 drag never fires on touch, and the owner page is read on a phone; and
 * a mis-aimed drop would move a feature nobody meant to move, which on this
 * page changes what every subscriber is entitled to. A select cannot be
 * mis-aimed.
 *
 * **IT SAYS WHAT THE MOVE DID, EVERY TIME.** Dragging a feature from Bronze to
 * Gold must not silently imply that Bronze accounts lose it — they do not, and
 * the panel says so at the moment of the change, with the number of accounts
 * that kept it. That was written into the decision before the control existed,
 * precisely because a control that quietly does the kind thing is one nobody
 * trusts the second time.
 *
 * **`NOT_BUILT` features are shown and marked.** They are on the ladder, so
 * they are part of what a tier is worth; hiding them would make Gold look
 * thinner than it is sold as.
 */
function tiersPanel() {
  /*
   * RETURNS AN ARRAY, because `renderTab()` spreads what a body gives it.
   *
   * The first version returned the element itself and the whole tab threw
   * *"Spread syntax requires ...iterable[Symbol.iterator] to be a function"* —
   * so clicking Tiers did nothing at all and left you looking at People, with
   * the failure only visible in a console nobody has open. Every other tab
   * body returns a list; this is the contract, and it is not written down
   * anywhere except in the shape of the others.
   */
  const el = node('<div class="panel"></div>');

  /*
   * WHAT THE LAST MOVE DID, HELD OUTSIDE THE RENDER.
   *
   * The first version wrote the sentence into `.tier-said` and then called
   * `draw()`, which rebuilds the panel synchronously — so the message was
   * replaced by a fresh empty element before the browser painted once, and
   * the confirmation was never seen at all.
   *
   * That matters more here than a missing message usually would: the whole
   * point of saying it is that moving a feature to Gold must not silently
   * imply Bronze accounts lose it. A control that quietly does the kind thing
   * is one nobody trusts the second time. So the text lives outside the thing
   * being redrawn, exactly like `lastDone` on the console.
   */
  let said = '';

  const draw = () => {
    const rows = Object.keys(FEATURE_TIER);
    el.replaceChildren(node(`
      <div>
        <h3>What each tier includes</h3>
        <div class="tiny">Move a feature and it applies to NEW sign-ups.
          Anybody already using it keeps it for as long as they stay
          subscribed &mdash; nobody loses something mid-season.</div>
        <div class="tier-buckets">
          ${TIERS.map((tier) => {
    const mine = rows.filter((f) => tierOf(f) === tier.id);
    return `
            <div class="tier-bucket" data-tier="${esc(tier.id)}">
              <div class="tier-bucket-head">
                <b class="tier-name tier-${esc(tier.id)}">${esc(tier.label || tier.id)}</b>
                <span class="tiny">${mine.length} feature${mine.length === 1 ? '' : 's'}</span>
              </div>
              ${!mine.length ? '<div class="tiny">Nothing on this rung.</div>' : mine.map((f) => {
      const meta = FEATURE_META[f] || { label: f, blurb: '' };
      return `
                <div class="tier-row">
                  <span class="tier-row-what">
                    <b>${esc(meta.label || f)}</b>
                    ${NOT_BUILT.includes(f) ? '<span class="tiny tier-soon">not built yet</span>' : ''}
                    <span class="tiny">${esc(meta.blurb || '')}</span>
                  </span>
                  <select class="tier-move" data-feature="${esc(f)}" aria-label="Which tier ${esc(meta.label || f)} is on">
                    ${TIERS.map((t) => `<option value="${esc(t.id)}" ${
        t.id === tier.id ? 'selected' : ''}>${esc(t.label || t.id)}</option>`).join('')}
                  </select>
                </div>`;
    }).join('')}
            </div>`;
  }).join('')}
        </div>
        <div class="tiny tier-said">${esc(said)}</div>
      </div>`));

    for (const pick of el.querySelectorAll('.tier-move')) {
      pick.addEventListener('change', async () => {
        const feature = pick.dataset.feature;
        pick.disabled = true;
        try {
          const done = await postJson('/api/owner/tiers', { feature, tier: pick.value });
          /*
           * The live ladder is updated from what the SERVER stored rather than
           * from what was asked for — the two can differ (a move back to the
           * default stores no override at all), and a page working off its own
           * optimism is the console-and-projector fault in another room.
           */
          setTierOverrides(done.featureTiers || {});
          const label = (FEATURE_META[feature] || {}).label || feature;
          const to = findTier(done.to).label || done.to;
          said = done.kept
            ? `${label} is on ${to} for new sign-ups. ${done.kept} account${done.kept === 1 ? '' : 's'} already using it kept it.`
            : `${label} is on ${to}.`;
          draw();
        } catch (err) {
          pick.disabled = false;
          alert(err.message || 'Could not move that.');
        }
      });
    }
  };
  draw();
  return [el];
}

function moneyTab() {
  const paying = subscribers.filter((a) => !a.comped && (a.status === 'active' || a.status === 'trialing'));
  const comped = subscribers.filter((a) => a.comped);
  const lapsed = subscribers.filter((a) => !a.comped && (a.status === 'past_due' || a.status === 'cancelled'));
  const monthly = paying.reduce((n, a) => n + (findTier(tierFor(a)).pence || 0), 0);
  /* What the lapsed ones were worth. Not added to the total — it is what is
   * NOT arriving, which is the useful half of knowing about them. */
  const lost = lapsed.reduce((n, a) => n + (findTier(tierFor(a)).pence || 0), 0);

  const spend = overview.spend || { total: 0, claude: 0, image: 0, months: [], packs: [], perPack: 0, rows: 0 };
  const thisMonth = spend.months[0];

  const parts = [];

  parts.push(node(`
    <div class="game-section">
      <div class="game-head"><div>
        <h2>Money</h2>
        <div class="tiny">What is coming in, and what the AI is costing you.</div>
      </div></div>
      <div class="own-figures">
        <div class="own-fig">
          <b>${esc(money(monthly))}</b>
          <span>a month, from ${paying.length} paying account${paying.length === 1 ? '' : 's'}</span>
        </div>
        <div class="own-fig">
          <b>${esc(money(spend.total))}</b>
          <span>spent on AI in the last year</span>
        </div>
        <div class="own-fig ${thisMonth && thisMonth.pence > monthly ? 'bad' : ''}">
          <b>${esc(money(thisMonth ? thisMonth.pence : 0))}</b>
          <span>spent this month${thisMonth && thisMonth.pence > monthly ? ' — more than is coming in' : ''}</span>
        </div>
        <div class="own-fig">
          <b>${esc(money(spend.perPack))}</b>
          <span>the average pack, written and drawn</span>
        </div>
      </div>
      ${lapsed.length ? `<div class="tiny warn" style="margin-top:10px">
        <b>${lapsed.length} lapsed</b> — ${lapsed.map((a) => esc(a.name || a.email)).join(', ')}.
        ${lost
          // Only when there is money in it. On a free tier the honest thing to
          // say is what they cannot do, not "£0 is not arriving", which reads
          // as a bug in the sum.
          ? `That is ${esc(money(lost))} a month not arriving.`
          : 'Nothing is missing from the total, but they cannot start a new night until it is sorted.'}
      </div>` : ''}
      ${comped.length ? `<div class="tiny" style="margin-top:8px">${comped.length} comped
        (${comped.map((a) => esc(a.name || a.email)).join(', ')}) — they cost you what they generate and pay nothing,
        which is the arrangement, not a problem.</div>` : ''}
      ${overview.spendBackedUp ? '' : `<div class="tiny warn" style="margin-top:8px">
        <b>The ledger is not backed up.</b> Set <b>PHOTO_REPO</b> and it survives a deploy like the accounts do.</div>`}
    </div>`));

  // What each tier is bringing in. The lever the whole ladder is, as a number.
  const byTier = TIERS.map((tier) => ({
    tier,
    on: paying.filter((a) => tierFor(a) === tier.id).length,
  }));
  parts.push(node(`
    <div class="panel">
      <h3>Where it comes from</h3>
      <div class="own-rows">
        ${byTier.map(({ tier, on }) => `
          <div class="own-row">
            <div class="own-row-main"><b>${esc(tier.label)}</b> <span class="tiny">${esc(tier.plan)} · ${esc(money(tier.pence))} each</span></div>
            <div class="own-row-num">${on} × = <b>${esc(money(on * tier.pence))}</b></div>
          </div>`).join('')}
      </div>
      <div class="tiny" style="margin-top:10px">Moving somebody's tier is on the People tab. The prices
        are in <code>plans.js</code> and are still provisional.</div>
    </div>`));

  parts.push(budgetPanel(spend.budget || { state: 'none', spent: 0, budget: 0 }, monthly));

  if (spend.months.length) {
    parts.push(node(`
      <div class="panel">
        <h3>What the AI has cost, by month</h3>
        <div class="tiny">${spend.rows} call${spend.rows === 1 ? '' : 's'} recorded ·
          ${esc(money(spend.claude))} writing and checking · ${esc(money(spend.image))} drawing.</div>
        <div class="own-rows" style="margin-top:10px">
          ${spend.months.map((m) => `
            <div class="own-row">
              <div class="own-row-main">${esc(monthName(m.month))}</div>
              <div class="own-row-num"><b>${esc(money(m.pence))}</b></div>
            </div>`).join('')}
        </div>
      </div>`));
  }

  /*
   * What the money went ON, which is the cut that says what to do about it.
   *
   * By pack says which quiz was dear and by month says whether it is going up;
   * only this says why. Every row has carried a `what` since the ledger was
   * written and nothing showed it, so the one number anybody would act on —
   * that the checking pass is most of a pack's bill — could only be got at by
   * reading the file.
   */
  if (spend.jobs && spend.jobs.length) {
    parts.push(node(`
      <div class="panel">
        <h3>What the money went on</h3>
        <div class="tiny">Every call is filed under what it was doing. The share is of everything in the
          last year, so it says where to look rather than just what things cost.</div>
        <div class="own-rows" style="margin-top:10px">
          ${spend.jobs.map((j) => `
            <div class="own-row">
              <div class="own-row-main">
                <b>${esc(j.what)}</b>
                <span class="tiny">${j.rows} call${j.rows === 1 ? '' : 's'}</span>
                <div class="job-bar"><span style="width:${(Math.min(1, j.share) * 100).toFixed(1)}%"></span></div>
              </div>
              <div class="own-row-num"><b>${esc(money(j.pence))}</b>
                <span class="tiny">${Math.round(j.share * 100)}%</span></div>
            </div>`).join('')}
        </div>
      </div>`));
  }

  if (spend.packs.length) {
    parts.push(node(`
      <div class="panel">
        <h3>What each pack cost to make</h3>
        <div class="tiny">Dearest first. A picture round is filed against the quiz that paid for the portrait —
          the next quiz wanting that musician gets it free, which is the saving the shared library exists for.</div>
        <div class="own-rows" style="margin-top:10px">
          ${spend.packs.slice(0, 20).map((p) => `
            <div class="own-row">
              <div class="own-row-main">${esc(p.packId)}</div>
              <div class="own-row-num"><b>${esc(money(p.pence))}</b></div>
            </div>`).join('')}
        </div>
      </div>`));
  }

  if (!spend.rows) {
    parts.push(node(`
      <div class="panel">
        <h3>Nothing recorded yet</h3>
        <div class="tiny">Every Claude call and every OpenAI picture is written down from now on,
          with what it cost and which pack it was for. Generate something and it appears here.</div>
      </div>`));
  }

  return parts;
}

/**
 * A ceiling for the month, and how close this month is to it.
 *
 * **It warns and never refuses**, which is the whole design and worth reading
 * before anybody is tempted to wire it into the generator. A budget that
 * stopped a job would stop it halfway, with the money already spent and only
 * the pack left to lose — the same reason launching an expired topical pack
 * warns and goes ahead.
 *
 * It is also the only number here that counts BOTH suppliers. Google's own
 * budget alerts see the pictures and nothing else; Anthropic's see the writing
 * and nothing else. Neither can tell you what a pack cost.
 */
function budgetPanel(state, monthly) {
  const set = state.state !== 'none';
  const pct = Math.min(1, state.pct || 0);
  const bar = set ? `
    <div class="budget-bar ${esc(state.state)}">
      <span style="width:${(pct * 100).toFixed(1)}%"></span>
    </div>
    <div class="tiny" style="margin-top:6px">
      ${esc(money(state.spent))} of ${esc(money(state.budget))} this month
      ${state.state === 'over'
        ? `— <b>${esc(money(-state.left))} over</b>`
        : `· ${esc(money(state.left))} left`}
    </div>` : '';

  const el = node(`
    <div class="panel">
      <h3>A ceiling for the month</h3>
      <div class="tiny">What you are happy for the AI to cost in a calendar month, counting Claude
        and the pictures together. <b>Nothing is ever refused because of it</b> — it is a number to
        look at, not a lock. Set it to nothing to turn it off.</div>
      ${bar}
      <div class="budget-set">
        <label class="tiny">Budget <input type="number" class="budget-input" min="0" step="1"
          value="${set ? (state.budget / 100).toFixed(2).replace(/\.00$/, '') : ''}" placeholder="none"></label>
        <button class="btn small budget-save">Save</button>
        <span class="tiny budget-said"></span>
      </div>
      ${monthly ? `<div class="tiny" style="margin-top:8px">For comparison, ${esc(money(monthly))} a month
        is coming in from subscriptions.</div>` : ''}
    </div>`);

  const input = el.querySelector('.budget-input');
  const said = el.querySelector('.budget-said');
  el.querySelector('.budget-save').addEventListener('click', async () => {
    said.textContent = 'Saving…';
    try {
      // Pounds in the box, pence on the wire — the same split the invoices use,
      // because a float that has been through a text field is how 0.1 + 0.2
      // gets into the accounts.
      const pounds = input.value.trim();
      const pence = pounds === '' ? 0 : Math.round(Number(pounds) * 100);
      if (!Number.isFinite(pence) || pence < 0) throw new Error('That is not an amount');
      await api('/api/owner/budget', { method: 'PUT', body: JSON.stringify({ pence }) });
      await load();
    } catch (err) {
      said.textContent = err.message;
    }
  });
  return el;
}

// ==================================================================== tonight

/**
 * Every room with a game in it, and what is on its projector right now.
 *
 * The point is not to drive anything — you cannot, and deliberately: one place
 * that moves a quiz, and it is the control view. The point is to be able to
 * look before you deploy. "Is anybody mid-question" is a question the owner
 * page could not answer at all, and the answer decides whether a push waits
 * twenty minutes.
 *
 * It says nothing about a pack somebody wrote themselves beyond that it is one
 * of theirs. The owner cannot read it, so the owner cannot be told its name.
 */
function tonightTab() {
  const live = overview.rooms.filter((r) => r.live);
  const idle = overview.rooms.filter((r) => !r.live);

  const parts = [node(`
    <div class="game-section">
      <div class="game-head"><div>
        <h2>Tonight</h2>
        <div class="tiny">${live.length
          ? `${live.length} game${live.length === 1 ? '' : 's'} actually running — do not deploy over them.`
          : 'Nothing is mid-game. A deploy right now costs nobody anything.'}</div>
      </div></div>
      <div class="own-rows"></div>
    </div>`)];

  const list = parts[0].querySelector('.own-rows');
  const rows = [...live, ...idle];
  if (!rows.length) {
    list.appendChild(node(`<div class="tiny">No rooms have been opened since the last restart.
      A quizmaster's room appears here the first time they open their console.</div>`));
  }
  for (const room of rows) {
    list.appendChild(node(`
      <div class="own-row ${room.live ? 'live' : ''}">
        <div class="own-row-main">
          <b>${esc(room.who || room.label || room.id)}</b>
          ${room.code ? `<span class="own-code">${esc(room.code)}</span>` : '<span class="tiny">no code — the house room</span>'}
          <div class="tiny">${esc(room.pack || 'nothing loaded')}${room.own ? '' : ''} ·
            ${esc(room.where || room.phase || '')} · ${room.players} in</div>
        </div>
        <div class="own-row-num">${room.live
          ? '<span class="own-live">Running</span>'
          : `<span class="tiny">${esc(room.phase === 'lobby' ? 'waiting in the lobby' : 'idle')}</span>`}</div>
      </div>`));
  }
  return parts;
}

// ================================================================== catalogue

/**
 * The packs as a product: what gets played, what nobody has ever run, and what
 * has a correction sitting against it.
 *
 * "Never played by ANYBODY" is the line that could not be drawn before. A
 * quizmaster's own console says "never played" meaning THEY have not played it,
 * which is the right question for deciding what to run tonight; this means
 * nobody has, which is a fact about the pack and is what decides whether it was
 * worth writing.
 */
function catalogueTab() {
  const packs = overview.packs || [];
  const played = packs.filter((p) => p.plays);
  /*
   * "Never run by anybody" is about the WRITING, so a pack that was meant to
   * expire and did is not evidence of anything. Without this the list fills
   * with six-week-old topical packs and stops being a signal at all.
   */
  const never = packs.filter((p) => !p.plays && !p.stale);
  const expired = packs.filter((p) => p.stale);
  const flagged = packs.filter((p) => p.openReports || p.problems || p.broken);

  const row = (p) => `
    <div class="own-row">
      <div class="own-row-main">
        <b>${esc(p.title)}</b>
        <span class="tiny">${esc(p.kind === 'bingo' ? 'bingo' : 'quiz')}</span>
        ${p.openReports ? `<span class="own-flag">${p.openReports} reported</span>` : ''}
        ${p.broken ? '<span class="own-flag bad">broken</span>' : ''}
        ${!p.broken && p.problems ? `<span class="own-flag bad">${p.problems} to fix</span>` : ''}
        <div class="tiny">${p.plays
          ? `${p.plays} night${p.plays === 1 ? '' : 's'} · ${p.rooms} quizmaster${p.rooms === 1 ? '' : 's'}`
          : 'nobody has run this'}</div>
      </div>
      <div class="own-row-num"><a class="minor" href="/console?read=${esc(p.kind)}:${encodeURIComponent(p.id)}">Read</a></div>
    </div>`;

  const parts = [node(`
    <div class="game-section">
      <div class="game-head"><div>
        <h2>The catalogue</h2>
        <div class="tiny">${packs.length} pack${packs.length === 1 ? '' : 's'} ·
          ${played.length} played by somebody · ${never.length} never run by anybody${
  expired.length ? ` · ${expired.length} topical and out of date` : ''}</div>
      </div></div>
    </div>`)];

  if (flagged.length) {
    parts.push(node(`
      <div class="panel">
        <h3>Worth looking at</h3>
        <div class="tiny">A reported question, or something that does not validate. These are the
          ones with somebody waiting on them.</div>
        <div class="own-rows" style="margin-top:10px">${flagged.map(row).join('')}</div>
      </div>`));
  }

  if (played.length) {
    parts.push(node(`
      <div class="panel">
        <h3>What gets played</h3>
        <div class="tiny">Across every quizmaster, most first. This is the only place the counts are
          added up — on a console they are always just yours.</div>
        <div class="own-rows" style="margin-top:10px">${played.map(row).join('')}</div>
      </div>`));
  }

  if (never.length) {
    parts.push(node(`
      <div class="panel">
        <h3>Never run by anybody</h3>
        <div class="tiny">Written and not used. Worth knowing before writing another like it —
          though a new pack nobody has got to yet belongs here too, so read the dates before drawing a conclusion.</div>
        <div class="own-rows" style="margin-top:10px">${never.map(row).join('')}</div>
      </div>`));
  }

  return parts;
}

// ===================================================================== people

/**
 * One quizmaster, opened up.
 *
 * Everything about one person in one place: what they pay, where their room is,
 * what they have written in about, and the support door. It was spread over
 * three panels and a tab, so answering "what is going on with Rob" meant
 * reading the whole page and holding it in your head.
 *
 * **It says nothing about their own packs, not even how many.** The owner
 * cannot read them; a count is not content, but a page that quietly reported
 * on somebody's private work would undercut the promise the rest of that
 * feature makes. If you need to see it, ask them to open the door.
 */
function personPanel(account) {
  const theirs = suggestions.filter((s) => s.byId === account.id);
  const openTheirs = theirs.filter((s) => s.status === 'open');
  const tier = findTier(tierFor(account));
  const log = (account.support && account.support.log) || [];
  const joined = account.createdAt
    ? new Date(account.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
    : 'unknown';

  const el = node(`
    <div class="panel person">
      <h3>${esc(account.name || account.email)}</h3>
      <div class="tiny">${esc(account.email)} · joined ${esc(joined)} ·
        ${esc(tier.label)} (${esc(tier.plan)})${account.comped ? ', comped' : ''}</div>
      <div class="own-rows" style="margin-top:12px">
        <div class="own-row">
          <div class="own-row-main"><b>Their room</b>
            <div class="tiny">${account.joinCode
              ? `Join code <b>${esc(account.joinCode)}</b> — their phones use <code>/play?g=${esc(account.joinCode)}</code>.
                 It changes on a deploy until there is a permanent disk.`
              : 'No code yet.'}</div>
          </div>
        </div>
        <div class="own-row">
          <div class="own-row-main"><b>What they have written in</b>
            <div class="tiny">${theirs.length
              ? `${theirs.length} message${theirs.length === 1 ? '' : 's'}, ${openTheirs.length} still open. On the Inbox tab.`
              : 'Nothing yet.'}</div>
          </div>
        </div>
        <div class="own-row">
          <div class="own-row-main"><b>Support access</b>
            <div class="tiny">${account.supportOpen
              ? 'Open right now. Everything you do in there goes in the log below, which they can read.'
              : 'Shut. Only they can open it, from My Account on their console — you cannot open it for them.'}</div>
          </div>
          <div class="own-row-num">${account.supportOpen ? '<button class="minor go-in">Go in</button>' : ''}</div>
        </div>
      </div>
      ${log.length ? `
        <details class="support-log" style="margin-top:10px">
          <summary class="tiny">What you have done in their account (${log.length})</summary>
          ${log.slice(-30).reverse().map((e) => `<div class="tiny">${esc(new Date(e.at).toLocaleString('en-GB'))} — ${esc(e.what)}</div>`).join('')}
        </details>` : ''}
      <div class="acct-links" style="margin-top:12px">
        <button class="minor reset-pw">Reset their password</button>
      </div>
    </div>`);

  el.querySelector('.go-in')?.addEventListener('click', () => goIn(account));
  el.querySelector('.reset-pw').addEventListener('click', () => resetPassword(account));
  return el;
}

async function goIn(account) {
  try {
    const data = await api('/api/owner/act-as', {
      method: 'POST', body: JSON.stringify({ accountId: account.id }),
    });
    if (!data.ok) throw new Error(data.error || 'Could not go in');
    location.href = '/console';
  } catch (err) {
    alert(err.message);
  }
}

/**
 * A new password for somebody who is locked out.
 *
 * You cannot read theirs — only a hash is stored, which is the honest version
 * of "your account is private from me" — so setting a new one and telling them
 * is the only help there is. It signs them out everywhere, which is right: a
 * reset is usually somebody worried, and half-logged-out is no use.
 */
async function resetPassword(account) {
  const suggested = suggestPassword();
  const password = prompt(`A new password for ${account.email}?\n\nThey are signed out everywhere and can change it once they are in.`, suggested);
  if (!password) return;
  try {
    const data = await api(`/api/owner/accounts/${encodeURIComponent(account.id)}/password`, {
      method: 'POST', body: JSON.stringify({ password }),
    });
    subscribers = data.accounts;
    redraw();
    alert(`Done.\n\nSend them:\n\n  ${location.origin}/login\n  ${account.email}\n  ${password}\n\nThis is not stored anywhere you can read it again, so copy it now.`);
  } catch (err) {
    alert(err.message);
  }
}

/**
 * The owner page, as tabs.
 *
 * It was one scroll: reports, then the suggestion box, then a link, then the
 * quizmaster list. That was the minimum it needed to exist rather than what it
 * should be, and four sections down one page is a page you scroll past rather
 * than work through.
 *
 * The split is by QUESTION, which is the same principle that put the catalogue
 * on the console and the business here:
 *
 *   Tonight   — can I deploy? is anybody mid-question?
 *   People    — what is going on with one subscriber?
 *   Money     — is this paying for itself?
 *   Catalogue — is what I write worth writing?
 *   Inbox     — who is waiting to hear back from me?
 *
 * Inbox wears a badge, because it is the only tab where somebody is waiting.
 */
const OWNER_TABS = [
  { id: 'tonight', label: 'Tonight', body: () => tonightTab(), count: () => overview.rooms.filter((r) => r.live).length },
  { id: 'people', label: 'People', body: () => peopleTab(), count: () => 0 },
  { id: 'money', label: 'Money', body: () => moneyTab(), count: () => 0 },
  /*
   * TIERS — what each rung includes, and the one place it can be changed.
   *
   * Beside Money rather than inside it, and that is the same test the console
   * uses for Account against Settings: Money is what HAS come in, this is what
   * a tier is WORTH. One is read, one is operated.
   */
  { id: 'tiers', label: 'Tiers', body: () => tiersPanel(), count: () => 0 },
  { id: 'catalogue', label: 'Catalogue', body: () => catalogueTab(), count: () => 0 },
  /*
   * Getting a night's photos out and onto social media.
   *
   * Here rather than on the console, and asked for that way: it is one person's
   * morning-after workflow on one person's own room, so drawing it for every
   * subscriber is one more control to read past. A quizmaster's own record of
   * their nights and the pictures from them is Past gigs on their console, read
   * only — and the switch and the bin for something that should not be on the
   * projector are on the control view, where they are wanted with a mic in one
   * hand rather than on a page.
   */
  { id: 'photos', label: 'Photos', body: () => [photosSection()], count: () => 0 },
  {
    id: 'inbox',
    label: 'Inbox',
    body: () => [...reportsPanel(), ...suggestionsPanel()],
    // Both piles, because both are somebody waiting — a reported question and
    // a suggestion want different things doing about them, which is why they
    // are two panels, but "how many people am I keeping waiting" is one number.
    count: () => reports.filter((r) => r.status === 'open').length
      + suggestions.filter((x) => x.status === 'open').length,
  },
];

function ownerTabBar() {
  const bar = node('<div class="tabbar" role="tablist"></div>');
  for (const tab of OWNER_TABS) {
    const count = tab.count();
    const button = node(`
      <button class="tab ${tab.id === ownerTab ? 'on' : ''}" role="tab" data-tab="${tab.id}">
        ${esc(tab.label)}${count ? `<span class="tabcount">${count}</span>` : ''}
      </button>`);
    button.addEventListener('click', () => {
      ownerTab = tab.id;
      redraw();
      window.scrollTo({ top: 0 });
    });
    bar.appendChild(button);
  }
  return bar;
}

/**
 * The quizmaster list, and one of them opened up.
 *
 * The list is what it always was — name, tier, the three tier buttons, comp,
 * close — because those are the things you change in one tap and should not
 * have to open anything to reach. Tapping a name opens everything else about
 * them underneath, which is where the join code, the support log and the
 * password reset now live rather than being four more columns on a row.
 */
let openPerson = '';

function peopleTab() {
  const parts = [];

  parts.push(node(`
    <div class="game-section">
      <div class="game-head">
        <div>
          <h2>Quizmasters</h2>
          <div class="tiny">${subscribers.length} account${subscribers.length === 1 ? '' : 's'} ·
            ${subscribers.filter((a) => a.status === 'active' || a.status === 'trialing').length} paying ·
            ${subscribers.filter((a) => a.comped).length} on the house ·
            tap a name for their room, their messages and the support log</div>
        </div>
        <div class="row"><button class="role-make add">Add a quizmaster</button></div>
      </div>
      <div class="subs"></div>
    </div>`));

  const section = parts[0];
  const list = section.querySelector('.subs');
  section.querySelector('.subs').before(peopleFilters());

  const shown = visiblePeople();
  if (!subscribers.length) {
    list.appendChild(node('<div class="tiny">Nobody yet. Your own quizmaster account goes here too.</div>'));
  } else if (!shown.length) {
    list.appendChild(node('<div class="tiny">Nobody matches that. <button class="minor" id="clearFilters">Show everybody</button></div>'));
  }
  for (const account of shown) {
    list.appendChild(subscriberRow(account));
    if (openPerson === account.id) list.appendChild(personPanel(account));
  }
  section.querySelector('#clearFilters')?.addEventListener('click', () => {
    peopleFind = ''; peopleTier = ''; peopleMoney = ''; peopleKind = ''; redraw();
  });
  section.querySelector('.add').addEventListener('click', addSubscriber);

  /*
   * The way to the catalogue, kept on this tab because it is the one somebody
   * lands on. Writing and generating packs lives on the console — this page is
   * the BUSINESS, that one is the PRODUCT, and there is one link between them.
   */
  parts.push(node(`
    <div class="panel">
      <h3>The packs</h3>
      <div class="tiny">Writing, generating, importing and reading through every quiz and
        bingo game — all on the console. You cannot launch one from there; that is a
        quizmaster's job, and yours is on the switch above.</div>
      <div class="acct-links" style="margin-top:12px">
        <a class="own-open" href="/console">Open the catalogue</a>
      </div>
    </div>`));

  return parts;
}

/** Redraw from what is already in hand — no fetch, no state reset. */
function redraw() {
  draw();
}

function draw() {
  /*
   * There used to be a "Become a quizmaster" panel here, with a button that did
   * exactly what the Owner | Quizmaster switch in the topbar now does. Two ways
   * to do one job is how you end up using the worse one out of habit — and the
   * worse one was this, because it only existed on this page, so getting back
   * meant finding a bar at the top of a different one.
   */
  const parts = [];

  /*
   * The backup warning stays ABOVE the tabs.
   *
   * Every account and every password disappearing on the next redeploy is not
   * a fact about one tab, and a warning you have to be on the right tab to see
   * is one you find out about afterwards.
   */
  if (!backupReady) {
    parts.push(node(`
      <div class="pv-warn pv-broken" style="margin-bottom:14px">
        <b class="pv-warn-head">Accounts are not being backed up</b>
        <div class="tiny" style="margin-top:6px">
          This server has no permanent disk, so every account and every password
          disappears on the next redeploy. Set <b>PHOTO_REPO</b> to a <b>private</b>
          repository on Render. It has to be private: this file holds email
          addresses and password hashes.
        </div>
      </div>`));
  }

  /*
   * And so does the budget warning, for the same reason.
   *
   * "This month has cost more than I said I was happy with" is a fact about the
   * business rather than about the Money tab, and one you would find out about
   * afterwards if you had to go looking. It is also why this is NOT a badge on
   * the tab: only Inbox wears one, because Inbox is the only tab where somebody
   * is waiting, and a second badge would cost the first one its meaning.
   *
   * Nothing here stops anything. It is the number, said where it will be seen.
   */
  const budget = (overview.spend && overview.spend.budget) || null;
  if (budget && (budget.state === 'over' || budget.state === 'close')) {
    const over = budget.state === 'over';
    parts.push(node(`
      <div class="pv-warn ${over ? 'pv-broken' : ''}" style="margin-bottom:14px">
        <b class="pv-warn-head">${over
          ? `This month is ${esc(money(-budget.left))} over your AI budget`
          : `This month has used ${Math.round(budget.pct * 100)}% of your AI budget`}</b>
        <div class="tiny" style="margin-top:6px">
          ${esc(money(budget.spent))} of ${esc(money(budget.budget))} for ${esc(monthName(budget.month))},
          counting Claude and the pictures together. Nothing is being refused — generation carries on
          exactly as it did. The ceiling is on the Money tab if it wants changing.
        </div>
      </div>`));
  }

  parts.push(ownerTabBar());

  const tab = OWNER_TABS.find((t) => t.id === ownerTab) || OWNER_TABS[0];
  const body = tab.body();
  if (!body.length) {
    parts.push(node(`<div class="panel"><h3>Nothing here yet</h3>
      <div class="tiny">Nobody has reported a question or sent a suggestion.</div></div>`));
  }
  parts.push(...body);

  mainEl.replaceChildren(...parts);
}

const STATUS_LABEL = {
  trialing: 'Trial', active: 'Paying', past_due: 'Payment failed', cancelled: 'Closed',
};

/**
 * WHERE AN ACCOUNT STANDS ON MONEY — a £ in a coloured box.
 *
 * It replaced two controls that between them said neither thing well: a badge
 * reading **COMPED** and a button reading **Comp** / **Charge them**. Both
 * failed the app's first rule the moment the host asked what they meant —
 * "comp" is hospitality jargon, and "charge them" describes taking a payment,
 * which this app cannot do because there is no processor wired up. It only
 * ever stopped giving something away.
 *
 * Four states, and the colour is the whole point: you are looking down a list
 * to find the one that needs doing something about, not reading each row.
 *
 *   GREEN   paying — and this is the state most accounts will be in
 *   ORANGE  free right now: on the house, or inside a trial
 *   RED     should be paying and is not
 *   GREY    closed
 *
 * **Orange covers a comp AND a trial deliberately**, because from this page
 * they are one fact — somebody is getting it for nothing today. What ends
 * them differs (a switch here, or a date passing), and that is the tooltip's
 * job rather than a fifth colour.
 *
 * **It goes orange → green ON ITS OWN once payments exist.** A trial ending is
 * a status change from the processor's webhook, which `billing.js` already
 * applies, so this needs nothing new when that lands. Until then nothing moves
 * a status automatically and the honest thing is to say so, which the tooltip
 * does — a badge implying an automatic transition that is not built yet would
 * be a promise this page cannot keep.
 *
 * Tapping it toggles the free pass, which is the only part of this the owner
 * sets by hand. Green or red → put them on the house; orange → take them off
 * it.
 */
function moneyState(account) {
  if (account.status === 'cancelled') return { kind: 'closed', word: 'Closed', why: 'This account is closed.' };
  if (account.comped) {
    return { kind: 'free', word: 'On the house', why: 'Free until you switch it off. Tap to start charging.' };
  }
  if (account.status === 'trialing') {
    return { kind: 'free', word: 'Trial', why: 'Inside their free month. It turns green on its own once the first payment lands. Tap to put them on the house instead.' };
  }
  if (account.status === 'past_due') {
    return { kind: 'owing', word: 'Payment failed', why: 'They should be paying and are not. Their night still runs — that rule does not bend. Tap to put them on the house.' };
  }
  return { kind: 'paying', word: 'Paying', why: 'Paying their subscription. Tap to put them on the house.' };
}

function moneyBadge(account) {
  const state = moneyState(account);
  return `<button class="money-badge ${state.kind}" title="${esc(state.word)} — ${esc(state.why)}"
            aria-label="${esc(state.word)}">£</button>`;
}

/*
 * FINDING ONE ACCOUNT AMONG MANY.
 *
 * Deliberately three controls and not a table of sortable columns. At the size
 * this list will be for a long time — tens, not thousands — the questions
 * somebody actually asks are "who is on Bronze", "who is not paying" and
 * "where is Rob", and a column-sorting grid answers those slower than three
 * chips do while costing far more screen. The sort is one dropdown for the
 * same reason.
 *
 * Module level, like the tab and the open person, so working through the list
 * does not throw the filter away every time something is saved.
 */
let peopleFind = '';
let peopleTier = '';
let peopleMoney = '';
let peopleKind = '';
let peopleSort = 'name';

/** The list as it should appear: filtered, then sorted. */
function visiblePeople() {
  const find = peopleFind.trim().toLowerCase();
  const rows = subscribers.filter((a) => {
    if (peopleKind && kindOf(a) !== peopleKind) return false;
    if (peopleTier && tierFor(a) !== peopleTier) return false;
    if (peopleMoney && moneyState(a).kind !== peopleMoney) return false;
    if (!find) return true;
    return `${a.name || ''} ${a.email || ''}`.toLowerCase().includes(find);
  });
  const by = {
    name: (a, b) => String(a.name || a.email).localeCompare(String(b.name || b.email)),
    // Down the ladder, so the ones worth the most are at the top.
    tier: (a, b) => TIERS.findIndex((t) => t.id === tierFor(b)) - TIERS.findIndex((t) => t.id === tierFor(a)),
    // The ones needing something doing about them first, which is the whole
    // point of ordering by money at all.
    money: (a, b) => ORDER_MONEY.indexOf(moneyState(a).kind) - ORDER_MONEY.indexOf(moneyState(b).kind),
    joined: (a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')),
  };
  return rows.sort(by[peopleSort] || by.name);
}
const ORDER_MONEY = ['owing', 'free', 'paying', 'closed'];

function peopleFilters() {
  const counts = (kind) => subscribers.filter((a) => moneyState(a).kind === kind).length;
  const el = node(`
    <div class="people-filters">
      <input type="search" id="peopleFind" placeholder="Find a name or an email" value="${esc(peopleFind)}">
      <select id="peopleKind" title="Quizmasters or venues">
        <option value="">Everybody</option>
        ${KINDS.map((k) => `<option value="${esc(k)}" ${peopleKind === k ? 'selected' : ''}>${esc(KIND_LABEL[k])}s (${subscribers.filter((a) => kindOf(a) === k).length})</option>`).join('')}
      </select>
      <select id="peopleTier" title="Which rung">
        <option value="">Every tier</option>
        ${TIERS.map((t) => `<option value="${esc(t.id)}" ${peopleTier === t.id ? 'selected' : ''}>${esc(t.label)}</option>`).join('')}
      </select>
      <select id="peopleMoney" title="Where they stand on money">
        <option value="">Paying or not</option>
        <option value="paying" ${peopleMoney === 'paying' ? 'selected' : ''}>Paying (${counts('paying')})</option>
        <option value="free" ${peopleMoney === 'free' ? 'selected' : ''}>Free — comp or trial (${counts('free')})</option>
        <option value="owing" ${peopleMoney === 'owing' ? 'selected' : ''}>Payment failed (${counts('owing')})</option>
        <option value="closed" ${peopleMoney === 'closed' ? 'selected' : ''}>Closed (${counts('closed')})</option>
      </select>
      <select id="peopleSort" title="What order">
        <option value="name" ${peopleSort === 'name' ? 'selected' : ''}>By name</option>
        <option value="tier" ${peopleSort === 'tier' ? 'selected' : ''}>By tier</option>
        <option value="money" ${peopleSort === 'money' ? 'selected' : ''}>Needing attention first</option>
        <option value="joined" ${peopleSort === 'joined' ? 'selected' : ''}>Newest first</option>
      </select>
    </div>`);
  /*
   * The box does NOT redraw the page on every keystroke.
   *
   * `redraw()` rebuilds this input, which takes the focus and the cursor with
   * it — so typing "rob" gave you "r", then a fight for the caret. It filters
   * the rows in place instead and only rebuilds when a dropdown changes.
   */
  const find = el.querySelector('#peopleFind');
  find.addEventListener('input', () => {
    peopleFind = find.value;
    const list = document.querySelector('.subs');
    if (!list) return;
    const shown = new Set(visiblePeople().map((a) => a.id));
    for (const row of list.querySelectorAll('[data-account]')) {
      row.hidden = !shown.has(row.dataset.account);
    }
  });
  for (const id of ['peopleKind', 'peopleTier', 'peopleMoney', 'peopleSort']) {
    el.querySelector('#' + id).addEventListener('change', (ev) => {
      if (id === 'peopleKind') peopleKind = ev.target.value;
      if (id === 'peopleTier') peopleTier = ev.target.value;
      if (id === 'peopleMoney') peopleMoney = ev.target.value;
      if (id === 'peopleSort') peopleSort = ev.target.value;
      redraw();
    });
  }
  return el;
}

function subscriberRow(account) {
  const row = node(`
    <div class="inv-row status-${account.status === 'active' || account.status === 'trialing' ? 'paid' : ''}" data-account="${esc(account.id)}">
      <div class="inv-main open-person" role="button" tabindex="0" title="Everything about them">
        <div class="inv-top">
          <b>${esc(account.name || account.email)}</b>
          <span class="inv-who">${esc(account.email)}</span>
          ${account.supportOpen ? '<span class="inv-status" style="background:rgba(255,210,63,.2);color:var(--gold)">Support open</span>' : ''}
        </div>
        <div class="tiny">
          ${kindOf(account) === 'venue' ? 'Venue · ' : ''}${esc(findTier(tierFor(account)).label)} — ${esc(findTier(tierFor(account)).plan)}
          · ${esc(moneyState(account).word)}
        </div>
      </div>
      <div class="inv-actions">
        <span class="tier-pick">
          ${TIERS.map((t) => `
            <button class="minor tierbtn ${tierFor(account) === t.id ? 'on' : ''}" data-tier="${t.id}"
                    title="${esc(t.blurb)}">${esc(t.label)}</button>`).join('')}
        </span>
        ${moneyBadge(account)}
        <button class="minor danger close">Close</button>
      </div>
    </div>`);

  const save = async (patch) => {
    try {
      const data = await api(`/api/owner/accounts/${encodeURIComponent(account.id)}`, {
        method: 'PUT', body: JSON.stringify(patch),
      });
      subscribers = data.accounts;
      redraw();
    } catch (err) {
      alert(err.message);
    }
  };

  // The tier IS the subscription. One choice of three rather than a row of
  // add-ons to remember the combination of.
  for (const button of row.querySelectorAll('.tierbtn')) {
    button.addEventListener('click', () => save({ tier: button.dataset.tier }));
  }
  /*
   * Tapping the name opens everything else about them underneath.
   *
   * "Go in" used to sit on this row as well, which meant two ways into their
   * account from one screen — and the one on the row had no log next to it, so
   * it was the worse of the two. One place, in the panel, beside the log it
   * writes to.
   */
  const toggle = () => {
    openPerson = openPerson === account.id ? '' : account.id;
    redraw();
  };
  row.querySelector('.open-person').addEventListener('click', toggle);
  row.querySelector('.open-person').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); }
  });
  row.querySelector('.money-badge').addEventListener('click', () => save({ comped: !account.comped }));
  row.querySelector('.close').addEventListener('click', async () => {
    if (!confirm(`Close ${account.email}?\n\nThey are signed out and cannot run a night. Nothing is deleted — their packs and invoices are kept in case they come back.`)) return;
    try {
      const data = await api(`/api/owner/accounts/${encodeURIComponent(account.id)}`, { method: 'DELETE' });
      subscribers = data.accounts;
      redraw();
    } catch (err) {
      alert(err.message);
    }
  });
  return row;
}

async function addSubscriber() {
  const email = prompt('Their email address?');
  if (!email) return;
  const name = prompt('Their name?') || '';
  // Suggested rather than demanded: a password you invent for somebody is one
  // they will write down, so make it a decent one and let them change it.
  const suggested = suggestPassword();
  const password = prompt(`First password?\n\nThey can change it once they are in.`, suggested);
  if (!password) return;
  try {
    const data = await api('/api/owner/accounts', {
      method: 'POST',
      body: JSON.stringify({ email, name, password, status: 'trialing' }),
    });
    subscribers = data.accounts;
    // Deliberately NOT touching backupReady here. This route answers
    // `backedUp` — did THIS save reach the repository — which is a different
    // fact from whether backups are configured at all, and conflating the two
    // is what kept the warning permanently on.
    redraw();
    alert(`Done.\n\nSend them:\n\n  ${location.origin}/login\n  ${email}\n  ${password}\n\nThis password is not stored anywhere you can read it again, so copy it now.`);
  } catch (err) {
    alert(err.message);
  }
}

/** Four ordinary words. Long, memorable, and nothing to write on a laptop lid. */
function suggestPassword() {
  const words = ['amber', 'jukebox', 'marble', 'thistle', 'rocket', 'velvet', 'harbour', 'copper',
    'meadow', 'lantern', 'compass', 'walnut', 'ribbon', 'anchor', 'saffron', 'pebble'];
  const pick = () => words[Math.floor(Math.random() * words.length)];
  return `${pick()}-${pick()}-${pick()}-${pick()}`;
}

boot().catch((err) => {
  mainEl.replaceChildren(node(`<div class="problems"><strong>Could not load:</strong> ${esc(err.message)}</div>`));
});
