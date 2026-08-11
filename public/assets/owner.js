/**
 * The owner console.
 *
 * Deliberately not the quiz console with extra buttons. This account runs no
 * nights — it manages the people who do, and writes the packs they buy. Keeping
 * it a separate page means the subscriber list can never be one mis-tap away
 * from the Next button during somebody's gig.
 */

import { esc, node, brandMark, brandWords, hatSwitch } from './client.js';
import { TIERS, tierFor, findTier } from './plans.js';

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

  const brand = await api('/api/brand');
  document.getElementById('brandSlot').innerHTML =
    `${brandMark(26)}${brandWords(brand.name, brand.appName || '')}`;
  whoEl.textContent = me.role === 'owner' ? `Owner — ${me.email}` : `Signed in as ${me.email}`;

  // The switch into your own quizmaster account, in the same corner it sits in
  // on the console — so it is one control in one place rather than a button
  // buried in a panel halfway down this page.
  const slot = document.getElementById('hatSlot');
  // The owner page has no key of its own to forget, but pass one anyway so the
  // switch behaves identically wherever it is drawn.
  const hat = hatSwitch(who, {
    forgetKey: () => { try { localStorage.removeItem('musicquiz.hostkey'); } catch { /* private */ } },
  });
  if (slot && hat) slot.replaceChildren(hat);

  if (me.role !== 'owner') {
    mainEl.replaceChildren(node(`
      <div class="problems">
        <strong>This is the owner console.</strong>
        Your account runs quiz nights — <a href="/console">that way</a>.
      </div>`));
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
  draw(data);
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
    b.addEventListener('click', () => { inboxShow = b.dataset.show; draw({ accounts: subscribers, backupReady: true }); });
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
              : 'Shut. Only they can open it, from My account on their console — you cannot open it for them.'}</div>
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
    draw({ accounts: subscribers, backupReady: true });
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
  { id: 'catalogue', label: 'Catalogue', body: () => catalogueTab(), count: () => 0 },
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
      draw({ accounts: subscribers, backupReady: true });
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
            ${subscribers.filter((a) => a.comped).length} comped ·
            tap a name for their room, their messages and the support log</div>
        </div>
        <div class="row"><button class="go add">Add a quizmaster</button></div>
      </div>
      <div class="subs"></div>
    </div>`));

  const section = parts[0];
  const list = section.querySelector('.subs');
  if (!subscribers.length) {
    list.appendChild(node('<div class="tiny">Nobody yet. Your own quizmaster account goes here too.</div>'));
  }
  for (const account of subscribers) {
    list.appendChild(subscriberRow(account));
    if (openPerson === account.id) list.appendChild(personPanel(account));
  }
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

function draw(data) {
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
  if (data && !data.backupReady) {
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

function subscriberRow(account) {
  const row = node(`
    <div class="inv-row status-${account.status === 'active' || account.status === 'trialing' ? 'paid' : ''}">
      <div class="inv-main open-person" role="button" tabindex="0" title="Everything about them">
        <div class="inv-top">
          <b>${esc(account.name || account.email)}</b>
          <span class="inv-who">${esc(account.email)}</span>
          <span class="inv-status">${esc(account.comped ? 'Comped' : STATUS_LABEL[account.status] || account.status)}</span>
          ${account.supportOpen ? '<span class="inv-status" style="background:rgba(255,210,63,.2);color:var(--gold)">Support open</span>' : ''}
        </div>
        <div class="tiny">
          ${esc(findTier(tierFor(account)).label)} — ${esc(findTier(tierFor(account)).plan)}
        </div>
      </div>
      <div class="inv-actions">
        <span class="tier-pick">
          ${TIERS.map((t) => `
            <button class="minor tierbtn ${tierFor(account) === t.id ? 'on' : ''}" data-tier="${t.id}"
                    title="${esc(t.blurb)}">${esc(t.label)}</button>`).join('')}
        </span>
        <button class="minor comp">${account.comped ? 'Charge them' : 'Comp'}</button>
        <button class="minor danger close">Close</button>
      </div>
    </div>`);

  const save = async (patch) => {
    try {
      const data = await api(`/api/owner/accounts/${encodeURIComponent(account.id)}`, {
        method: 'PUT', body: JSON.stringify(patch),
      });
      subscribers = data.accounts;
      draw({ accounts: subscribers, backupReady: true });
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
    draw({ accounts: subscribers, backupReady: true });
  };
  row.querySelector('.open-person').addEventListener('click', toggle);
  row.querySelector('.open-person').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); }
  });
  row.querySelector('.comp').addEventListener('click', () => save({ comped: !account.comped }));
  row.querySelector('.close').addEventListener('click', async () => {
    if (!confirm(`Close ${account.email}?\n\nThey are signed out and cannot run a night. Nothing is deleted — their packs and invoices are kept in case they come back.`)) return;
    try {
      const data = await api(`/api/owner/accounts/${encodeURIComponent(account.id)}`, { method: 'DELETE' });
      subscribers = data.accounts;
      draw({ accounts: subscribers, backupReady: true });
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
    draw({ accounts: subscribers, backupReady: data.backedUp });
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
