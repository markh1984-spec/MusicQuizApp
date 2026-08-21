/**
 * The control view — your phone or laptop, nobody else's.
 *
 * This is the only screen that ever sees the answer key, the host notes and
 * the round 3 "play this now" cue. That is not enforced by hiding things in
 * CSS: the server builds a completely different payload for this connection,
 * and the big screen's payload simply does not contain those fields.
 *
 * Laid out for use in the dark while talking: one big primary button that
 * always does the obvious next thing, in the same place every time.
 */

import {
  esc, node, ServerClock, Live, postJson, brandLink, binIcon, paintNav, paintIdentity, menuRights,
  rewardsEditorPopover,
} from './client.js';
import { paintScheme } from './schemes.js';
import { bingoPanels, bingoActions } from './host-bingo.js';
import { cueOffsetMs, formatOffset } from './cue.js';
import { phonesAre } from './phones.js';

const KEY_STORE = 'musicquiz.hostkey';

const mainEl = document.getElementById('main');
const actionsEl = document.getElementById('actions');
const whereEl = document.getElementById('where');
const phonesEl = document.getElementById('phonesAre');
const clockEl = document.getElementById('clock');
const connEl = document.getElementById('connText');

const clock = new ServerClock();
const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

let hostKey = new URL(location.href).searchParams.get('key') || localStorage.getItem(KEY_STORE) || '';

/**
 * The key to put in a LINK, which is not the same as the key to send.
 *
 * `hostKey` is how this page proves who it is, and it is remembered from
 * localStorage — but a key that was remembered rather than typed has no
 * business going back into the address bar. Written into a link it appears on
 * screen, in browser history and over anybody's shoulder, and on the console
 * it is self-sustaining: a remembered key is only forgotten when there is
 * NOT one in the URL, so following a keyed link is what stops it going.
 *
 * So: only if this visit genuinely arrived with `?key=`. Nothing is lost by
 * dropping it — every page reads the remembered key out of localStorage on
 * its way in — and a `?key=` bookmark still works exactly as it did.
 */
const navKey = new URL(location.href).searchParams.get('key') || '';
const withKey = (path) => (navKey ? `${path}${path.includes('?') ? '&' : '?'}key=${encodeURIComponent(navKey)}` : path);

/*
 * The menu, worked out from `/api/me` like every other page rather than
 * assumed here. This page used to guess — control true because you are
 * obviously driving a night, owner false because it never asked — and that
 * guess is exactly why the chips moved as you walked between pages: the same
 * account got a different row on every one.
 *
 * `control: true` until the answer lands, because on the control view it is
 * the safe way round: a chip that appears is better than the page you are
 * standing on being missing from its own menu for a moment.
 */
let rights = { control: true, packs: true, owner: false };
function drawNav() {
  paintNav(document.getElementById('navSlot'), { current: 'control', key: navKey, ...rights });
}
/*
 * ASKED WITH `hostKey`, NOT `navKey`, and the difference is the whole of the
 * comment above: the key to put in a LINK is not the key to SEND. This is a
 * request — the server has to be told who is asking — so it takes the real
 * key, remembered one included. Sent with the link key it went out bare
 * whenever the key had been remembered rather than typed, `/api/me` answered
 * "nobody is signed in", and the menu collapsed to a single Console chip on
 * the one page you drive a gig from.
 */
fetch(hostKey ? `/api/me?key=${encodeURIComponent(hostKey)}` : '/api/me',
  { headers: hostKey ? { 'X-Host-Key': hostKey } : {} })
  .then((r) => r.json())
  .then((who) => {
    rights = menuRights(who);
    drawNav();
    /*
     * The hat switch and Sign out, here as well — the host wants the same
     * topbar on every page he drives. It replaces the yellow "wearing your
     * quizmaster hat" bar this page used to carry: that bar was an INDICATOR
     * beside a switch that was somewhere else, and now the switch is here the
     * bar would be a second way to do one job.
     *
     * Taking the hat off from HERE lands on /owner, not on a reloaded /host:
     * an owner holds no quiz features, so the control view is a page they
     * cannot use, and sending somebody to one is the fault this file keeps
     * recording. That used to be an `onSwitch` written out on this page alone;
     * it is what the switch does everywhere now, so the override is gone
     * rather than being a second copy of one rule.
     */
    paintIdentity(who);
  })
  .catch(() => { /* the menu keeps the safe default */ });
let state = null;

if (hostKey) localStorage.setItem(KEY_STORE, hostKey);

// ------------------------------------------------------------------ actions

/*
 * The double-tap guard.
 *
 * This is a phone, held in one hand, in the dark, usually while talking. A
 * button that does something irreversible-looking on the second of two
 * accidental taps is a button that will eventually reveal an answer to a room
 * that has not answered yet — which is exactly what happened.
 *
 * So the same action twice inside a second is treated as one press. Nothing is
 * queued and nothing is undone; the second tap simply never happened.
 */
const DOUBLE_TAP_MS = 900;
let lastAct = { action: '', at: 0 };

async function act(action, body = {}) {
  const at = Date.now();
  if (action === lastAct.action && at - lastAct.at < DOUBLE_TAP_MS) return;
  lastAct = { action, at };
  try {
    await postJson(`/api/host/${action}`, body, { 'X-Host-Key': hostKey });
  } catch (err) {
    toast(whyRefused(err));
  }
}

/*
 * WHAT A REFUSAL ACTUALLY MEANS, said in words.
 *
 * This said "Wrong host key" on every 401, and that is only ever right when
 * there IS a key. A signed-in quizmaster has never been given one — so on the
 * night a deploy dropped the session, every button on the control view sent
 * the host looking for a key that does not exist and has nothing to do with
 * it. "Failure messages have to name the cause", on the one screen where the
 * cause is being read with a mic in the other hand.
 *
 * The three cases want three different things doing about them, which is the
 * whole reason to tell them apart: retype the key, sign in again, or nothing
 * at all because the network had a moment.
 */
function whyRefused(err) {
  if (err.status !== 401) return `Failed: ${err.message}`;
  if (hostKey) return 'That host key is no longer right — check your host’s startup log.';
  return 'You have been signed out. Open /login in another tab, sign in, then press again.';
}

/**
 * How long the question on screen has been up, in milliseconds.
 *
 * Used to refuse a reveal in the first few seconds. Nobody has ever meant to
 * reveal an answer two seconds after asking it, and the clock reveals it by
 * itself when the twenty seconds are up — so the button is only ever for
 * "everybody has answered, do not make them wait", which cannot be true yet.
 */
const TOO_SOON_MS = 3000;

function questionAge() {
  if (!state || state.phase !== 'question' || !state.clock) return Infinity;
  return clock.now() - state.clock.startedAt;
}

function toast(message) {
  const el = node(`<div class="toast">${esc(message)}</div>`);
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2200);
}

// -------------------------------------------------------------------- draw

let brandPainted = false;
function draw(next) {
  state = next;
  clock.sync(state.serverNow);
  if (!brandPainted && state.brand) {
    const slot = document.getElementById('brandSlot');
    if (slot) slot.innerHTML = brandLink(state.brand, { key: navKey, size: 26, appName: state.appName || '' });
    document.title = `Control — ${state.brand}`;
    brandPainted = true;
  }
  drawNav();
  // Your own two colours on your own control view, so the phone in your hand
  // matches the projector you are driving. Not gated on `brandPainted`: the
  // colours can change mid-night from the console, the name cannot.
  paintScheme(state.scheme);
  whereEl.textContent = whereLabel(state);
  /*
   * Painted here rather than in a card, because it has to follow every state
   * push — the phones change with the phase, and a line that only refreshed
   * when something was rebuilt would tell the host the wrong thing at exactly
   * the moment they were about to say it out loud.
   */
  if (phonesEl) {
    const doing = phonesAre(state);
    phonesEl.hidden = !doing;
    phonesEl.textContent = doing ? `On their phones: ${doing}` : '';
  }
  /*
   * THE JOIN CODE, on the screen the host is actually holding.
   *
   * It was on the projector behind them and two taps away on My account, and
   * nowhere on the one thing in their hand — so "what's the code?" from the
   * back of the room meant turning round to read their own big screen. The
   * house room has none, so it simply says the player count as before.
   */
  connEl.textContent = state.joinCode
    ? `${state.playerCount} playing · code ${state.joinCode}`
    : `${state.playerCount} playing`;
  mainEl.replaceChildren(...restartNotice(state), ...advertPanel(state), ...voucherPanel(state), ...buildPanels(state), ...photoPanel(state));
  actionsEl.replaceChildren(...buildActions(state));
}

/**
 * Tell the host the app restarted, instead of leaving them to work it out.
 *
 * On a host with no permanent disk a restart takes the scores with it. Phones
 * put themselves back on their own, so from the front of the room the only
 * clue is that everybody is suddenly on nothing — which looks like a scoring
 * bug rather than what it is. Saying so plainly is the difference between
 * "the app is broken" and "we restarted, here is what I do about it".
 *
 * Only shown while it is still actionable: once the game has moved on there is
 * nothing to be done about it and it is just noise on a busy screen.
 */
function restartNotice(s) {
  const info = s.server;
  // Not shown on a plain fresh start — only when a phone has turned up holding
  // an id from a game this process never saw. That is proof a game was lost,
  // rather than a warning on every startup, which you would learn to ignore.
  if (!info || info.restored || !info.startedAt || !info.strandedPhones) return [];
  const mins = Math.floor((clock.now() - info.startedAt) / 60000);
  if (mins > 20) return [];
  const when = mins < 1 ? 'less than a minute ago' : `${mins} minute${mins === 1 ? '' : 's'} ago`;
  const n = info.strandedPhones;
  return [node(`
    <div class="panel warn">
      <h3>The app restarted ${esc(when)}</h3>
      <div class="tiny">It came back with no saved game, so scores from before then are gone.
      ${n} phone${n === 1 ? '' : 's'} that ${n === 1 ? 'was' : 'were'} already playing put ${n === 1 ? 'itself' : 'themselves'} back in —
      nobody has to scan again. Tap a name to put their points back.</div>
    </div>`)];
}

function whereLabel(s) {
  if (s.game === 'bingo') {
    return s.phase === 'lobby'
      ? 'Bingo — waiting to start'
      : s.phase === 'finished'
        ? 'Bingo — finished'
        : `Bingo round ${s.round} — ${s.target === 'full' ? 'full house' : 'one line'}`;
  }
  // What the projector is showing wins over where the quiz is, because that is
  // the thing you would otherwise have to turn round to check.
  if (s.advert && s.advert.showing && s.advert.heading) return `Advert: ${s.advert.heading}`;
  if (s.scoreboard && s.scoreboard.on) return 'Scores on the big screen';
  switch (s.phase) {
    case 'lobby': return 'Lobby — waiting to start';
    case 'rules': return 'The rules';
    // A breakout round is delivered like any other but scores nothing, so it
    // does not claim a round number here either — same rule as the projector.
    case 'round_intro': return s.roundType === 'breakout' ? 'Bonus round intro' : `Round ${s.scoreRoundNumber ?? s.roundIndex + 1} intro`;
    case 'question': return `R${s.roundIndex + 1} Q${s.questionIndex + 1} — live`;
    case 'reveal': return `R${s.roundIndex + 1} Q${s.questionIndex + 1} — revealed`;
    case 'round_board': return s.roundType === 'breakout' ? 'Bonus round scores' : `Round ${s.scoreRoundNumber ?? s.roundIndex + 1} scores`;
    case 'final': return 'Final results';
    default: return 'Control';
  }
}

/** What to say over the mic while a slide is up. Never on the projector. */
function advertPanel(s) {
  const ad = s.advert || {};
  if (!ad.showing || !ad.showing.packId) return [];
  return [node(`
    <div class="panel warn">
      <h3>On screen: ${esc(ad.heading || 'an advert')}</h3>
      ${ad.say ? `<div class="tiny" style="font-size:15px;color:var(--ink)">${esc(ad.say)}</div>` : ''}
      <div class="tiny" style="margin-top:8px">Press onwards when you are done — it comes down on its own.</div>
    </div>`)];
}

/**
 * The photo controls: a switch and a bin.
 *
 * Deliberately not an approval queue. The host decided that at the start and
 * for a good reason — the fun is that the room can do it without him, and he
 * would rather say "no naughtiness" over the mic than spend a quiz night
 * approving pictures. What he needs instead is to be able to kill it instantly
 * when something does go up, which is one switch and one tap per photo.
 *
 * The switch is a single control on purpose. "Stop accepting" and "hide the
 * ones already up" as separate settings is a thing to reason about in a dark
 * room with sixty people watching. Off means off: nothing new is taken, and
 * nothing already there is on the screen.
 *
 * The host keeps seeing them when it is off, because otherwise the offending
 * photo becomes invisible to the only person who can delete it.
 */
/**
 * THE PRIZE, AND WHO HAS TAKEN IT.
 *
 * Only ever drawn when a reward was set at launch and a voucher exists, which
 * is the end of a night rather than most of one — so an ordinary quiz has no
 * extra panel on the busiest screen in the app.
 *
 * Two controls, and neither is a dead end:
 *
 * NEITHER BUTTON IS RED. Red is destructive here and nothing on this panel
 * is: marking it used is the ordinary thing that happens to every voucher, and
 * putting it back undoes it. A red "Mark it used" would read as "careful, you
 * cannot undo this" — which is the opposite of true, and would make a host
 * hesitate over the one control the bar is standing there waiting for.
 *
 *   **Mark it used** — for when the bar's phone cannot reach us. Pub wifi is
 *   exactly the thing this app assumes will fail, so the code is readable on
 *   the winner's screen and the host can do it by hand.
 *
 *   **Put it back** — the host's override, and it is what makes burning it on
 *   the first scan safe rather than clever. The bar comes over and says it is
 *   not working; one tap. Same rule as `Back` undoing a reveal: the person in
 *   the room decides.
 *
 * THE REINSTATE COUNT SHOWS ONLY ABOVE ZERO, like the wander badge staying
 * quiet until three. Zero on every voucher all night is a number you learn to
 * skip, and then you miss the one that says three — which means either the
 * bar cannot reach us or somebody is working it, and both are worth knowing
 * before you tap it a fourth time.
 */
function voucherPanel(s) {
  // Down the board, first place at the top — the order the room saw and the
  // order the host will read them out in.
  const list = [...(s.vouchers || [])].sort((a, b) => (a.place || 1) - (b.place || 1));
  if (!list.length) return [];
  const when = (ms) => new Date(ms).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  const el = node(`
    <div class="panel">
      <h3>The prizes</h3>
      <div class="tiny">They show a code at the bar, the bar scans it on their own phone.</div>
      <div class="v-rows">
        ${list.map((v) => `
          <div class="v-row ${v.redeemedAt ? 'is-spent' : ''}">
            <div class="v-row-who">
              <span class="v-place v-place-${v.place || 1}">${v.place === 2 ? '2nd' : v.place === 3 ? '3rd' : '1st'}</span>
              <b>${esc(v.name)}</b>
              <span class="v-row-what">${esc(v.reward)}</span>
              <span class="v-row-code">${esc(v.code)}</span>
              ${v.reinstated ? `<span class="v-row-again" title="Put back by you ${v.reinstated} time${v.reinstated === 1 ? '' : 's'}">put back ×${v.reinstated}</span>` : ''}
            </div>
            <div class="v-row-state">${v.redeemedAt ? `Used at ${esc(when(v.redeemedAt))}` : 'Not used yet'}</div>
            <button class="minor" data-code="${esc(v.code)}" data-do="${v.redeemedAt ? 'reinstateVoucher' : 'redeemVoucher'}">
              ${v.redeemedAt ? 'Put it back' : 'Mark it used'}
            </button>
          </div>`).join('')}
      </div>
    </div>`);
  for (const button of el.querySelectorAll('button[data-code]')) {
    button.addEventListener('click', () => act(button.dataset.do, { code: button.dataset.code }));
  }
  return [el];
}

function photoPanel(s) {
  const info = s.photos;
  if (!info) return [];

  const el = node(`
    <div class="panel photos ${info.enabled ? '' : 'off'}">
      <div class="photo-head">
        <h3>Photos on the big screen</h3>
        <button class="minor ${info.enabled ? 'danger' : ''}" data-a="toggle">${info.enabled ? 'Switch off' : 'Switch on'}</button>
      </div>
      <div class="tiny">${info.enabled
        ? `${info.count} up. They go straight to the screen — tap the bin on one to delete it.`
        : `Off. Nothing new is accepted and the screen is showing none of the ${info.count}.`}</div>
      <div class="photo-grid"></div>
      ${info.count ? '<button class="minor danger clear" style="margin-top:10px">Clear all photos</button>' : ''}
    </div>`);

  el.querySelector('[data-a="toggle"]').addEventListener('click', () => act('photosOn', { on: !info.enabled }));
  el.querySelector('.clear')?.addEventListener('click', () => {
    if (confirm(`Delete all ${info.count} photos?\n\nThis cannot be undone.`)) act('photosClear', {});
  });

  const grid = el.querySelector('.photo-grid');
  for (const p of info.items) {
    // The bin badge is the only thing that says what tapping does. Without it
    // this was a grid of pictures that deleted one when you touched it.
    const fig = node(`
      <button class="host-photo" title="Bin this one">
        <img src="${esc(p.url)}" alt="">
        <span class="bin-badge">${binIcon(16)}</span>
        <span class="who">${esc(p.teamName || '')}</span>
      </button>`);
    fig.addEventListener('click', () => {
      if (confirm(`Bin this photo${p.teamName ? ` from ${p.teamName}` : ''}?`)) act('photoRemove', { id: p.id });
    });
    grid.appendChild(fig);
  }

  return [el];
}

function buildPanels(s) {
  // Bingo's call sheet wants the whole screen — forty tracks in a grid rather
  // than forty rows down a 720px column. The quiz's panels are read, not
  // scanned, so they keep the narrower measure.
  document.body.classList.toggle('bingo', s.game === 'bingo');
  if (s.game === 'bingo') return bingoPanels(s, act);
  const panels = [];

  // The cue comes first when it matters: on the intro round you need to know
  // what to play before the question is even on screen.
  if (s.phase === 'round_intro' || s.phase === 'reveal' || s.phase === 'lobby') {
    const up = s.upcoming;
    if (up && up.cue) panels.push(cuePanel(up.cue, `Coming up — R${up.roundIndex + 1} Q${up.questionIndex + 1}`, up.playlist));
  }
  if ((s.phase === 'question' || s.phase === 'reveal') && s.question && s.question.cue) {
    panels.push(cuePanel(s.question.cue, 'Play this now', s.question.playlist, s.introPlay));
  }

  if (s.question && (s.phase === 'question' || s.phase === 'reveal')) {
    panels.push(questionPanel(s));
  }

  if (s.phase === 'lobby' || s.phase === 'round_intro') {
    panels.push(nextUpPanel(s));
  }

  panels.push(playersPanel(s));

  if (s.phase === 'lobby' || s.phase === 'final') {
    panels.push(toolsPanel(s));
  }

  return panels;
}

/**
 * @param {object} [failed]  auto-play could not start it — say so and why, so
 *                           the host taps the link instead of wondering. The
 *                           question is already up either way.
 */
function cuePanel(cue, title, playlist, failed = null) {
  // The offset rather than the raw text, and only when there IS one: every
  // pack on disk says "0:00", so the old line printed "From 0:00" on every
  // intro question in the app and told the host nothing.
  //
  // It is still worth printing when it is set, and the reason is the failure
  // case directly below it: auto-play starts at the offset, but "Open this
  // track" opens at the top of the file, so this line is the instruction for
  // the night Spotify is asleep.
  const skip = cueOffsetMs(cue.from);
  return node(`
    <div class="panel secret">
      <h3>${esc(title)}</h3>
      <div class="cue">
        <div class="track">${esc(cue.title || '')}</div>
        <div class="artist">${esc(cue.artist || '')}</div>
        ${skip ? `<div class="from">Skip the first ${esc(formatOffset(skip))}</div>` : ''}
        ${cue.hint ? `<div class="from">${esc(cue.hint)}</div>` : ''}
        ${failed ? `<div class="cue-failed">Did not start on its own — tap below. <span class="tiny">${esc(failed.why)}</span></div>` : ''}
      </div>
      ${cue.spotifyUri || playlist ? `
        <div class="cue-links">
          ${cue.spotifyUri ? `<a class="cue-open" href="${esc(cue.spotifyUri)}">Open this track</a>` : ''}
          ${playlist ? `<a class="cue-open ghost" href="${esc(playlist.uri || playlist.url)}">Whole playlist</a>` : ''}
        </div>` : ''}
    </div>
  `);
}

/*
 * WHO picked this one, by name — folded away behind the count.
 *
 * The counts already say nine had A and three had B. This says which three,
 * which is the difference between "most of you had that" and naming them on
 * the microphone. It is the whole reason the host asked for it.
 *
 * LIVE as well as on the reveal. The worry was that a control view gets
 * mirrored or glanced at, so names would give the popular answer away — but
 * the counts are already on this screen and give it away first, so hiding the
 * names bought nothing. Folded away by default while the clock is running so
 * it is not a moving list to read, and open by default on the reveal, which is
 * when you are talking about it.
 *
 * The open ones are remembered OUT HERE, because this panel is rebuilt on
 * every state push — which during a question is every time somebody answers.
 * Kept in the render, a list you had just opened would shut itself the moment
 * the next team pressed a button.
 */
const opened = new Map();

/*
 * The phase is part of the key on purpose.
 *
 * A list you opened while the clock was running used to shut itself the moment
 * you pressed reveal, and one you had never touched sprang open — because the
 * remembered state was "the opposite of the default" and the default changes
 * at the reveal. Keyed by phase, each half of the question starts from its own
 * default and remembers only what you did to it there.
 */
function pickKey(s, i) {
  return `${s.phase}:${s.roundIndex}:${s.questionIndex}:${i}`;
}

function picked(s) {
  return (s.whoPicked && s.whoPicked.options) || [];
}

function isOpen(s, i) {
  // Open by default on the reveal, closed while the question is live — and
  // either way, what the host last tapped wins.
  const key = pickKey(s, i);
  return opened.has(key) ? opened.get(key) : s.phase === 'reveal';
}

/** The row of names under one option, and the caret that shows and hides it. */
function whoRow(s, i, list) {
  if (!list.length) return null;
  const el = node(`
    <div class="keywho ${isOpen(s, i) ? '' : 'shut'}">
      ${list.map((n) => `<span class="${n.correct ? 'right' : ''}">${esc(n.name)}</span>`).join('')}
    </div>`);
  return el;
}

/**
 * Which rows the answer key shows, in order.
 *
 * Every option, normally. On the first-letter round that would be twenty-six
 * rows on a phone, most of them empty — so it shows the right letter plus
 * whichever others somebody actually pressed, which is exactly the list you
 * would read out. The index stays the real one, so the names underneath still
 * line up with what the server sent.
 */
function keyRows(q, tally) {
  const options = q.options || [];
  if (!q.alphabet) return options.map((opt, i) => [i, LETTERS[i], opt]);
  return options
    .map((letter, i) => [i, letter, ''])
    .filter(([i]) => rightSet(q).has(i) || (tally[i] || 0) > 0);
}

/**
 * A breakout round has no answer key — there is nothing right or wrong to
 * check an answer against, which is the whole point of the round. Instead
 * the host gets every answer as it lands, in the order it arrived, to read
 * out over the mic. No caret, no tally, nothing to fold away: reading them
 * out IS the feature.
 */
function breakoutPanel(s, q) {
  const answers = s.breakoutAnswers || [];
  const el = node(`
    <div class="panel">
      <h3>Round ${s.roundIndex + 1}, question ${s.questionIndex + 1} of ${s.questionCount} — breakout</h3>
      <p class="prompt">${esc(q.prompt)}</p>
      <div class="tiny" style="margin-bottom:8px;color:var(--cool)">No right answer — read the funny ones out.</div>
      <div class="keywho" id="breakoutList">
        ${answers.length
          ? answers.map((a) => `<span>${esc(a.name)}: ${esc(a.text)}</span>`).join('')
          : '<span class="tiny" style="opacity:.7">Nothing in yet.</span>'}
      </div>
      <div class="tiny" style="margin-top:10px">${answers.length} of ${s.playerCount} answered</div>
      <button class="report-q" type="button">Something wrong with this one?</button>
    </div>
  `);

  const reportBtn = el.querySelector('.report-q');
  if (reportBtn) {
    reportBtn.addEventListener('click', async () => {
      reportBtn.disabled = true;
      try {
        await postJson('/api/host/reportQuestion', {}, { 'X-Host-Key': hostKey });
        reportBtn.textContent = 'Noted — thanks';
        toast('Reported. Carry on; it is on the owner’s list.');
      } catch (err) {
        reportBtn.disabled = false;
        toast('Could not report it: ' + err.message);
      }
    });
  }
  return el;
}

function questionPanel(s) {
  const q = s.question;
  if (q.breakout) return breakoutPanel(s, q);
  const tally = s.tally || [];
  const rows = keyRows(q, tally);
  const el = node(`
    <div class="panel">
      <h3>Round ${s.roundIndex + 1}, question ${s.questionIndex + 1} of ${s.questionCount} — answer key</h3>
      <p class="prompt">${esc(q.prompt)}</p>
      ${q.alphabet ? `<div class="answer-said"><span class="answer-letter">${esc(q.correctLetter || '?')}</span><span class="answer-words">${esc(q.answer || '')}</span></div>` : ''}
      ${q.pickCount > 1 ? `<div class="tiny" style="margin-bottom:8px;color:var(--cool)">They lock in ${q.pickCount} — part marks for getting some.</div>` : ''}
      <div class="keylist">
        ${rows.map(([i, letter, opt]) => `
          <button class="keyrow ${rightSet(q).has(i) ? 'is-correct' : ''} ${(picked(s)[i] || []).length ? 'has-who' : ''}" data-opt="${i}">
            <span class="letter">${esc(letter)}</span>
            <span>${esc(opt)}</span>
            <span class="n">${tally[i] || 0}</span>
            ${(picked(s)[i] || []).length ? `<span class="caret ${isOpen(s, i) ? 'open' : ''}">\u25be</span>` : ''}
          </button>
          <div class="who-slot" data-slot="${i}"></div>`).join('')}
      </div>
      <div class="missing-slot"></div>
      <div class="wandered-slot"></div>
      ${q.note ? `<div class="tiny" style="margin-top:10px">Note: ${esc(q.note)}</div>` : ''}
      ${q.answerNote ? `<div class="tiny" style="margin-top:6px">${esc(q.answerNote)}</div>` : ''}
      <div class="tiny" style="margin-top:10px">
        ${s.answeredCount || 0} of ${s.playerCount} answered${s.fastest ? ` — fastest ${esc(s.fastest.name)} at ${s.fastest.seconds.toFixed(1)}s` : ''}
      </div>
      <button class="report-q" type="button">Something wrong with this one?</button>
    </div>
  `);

  /*
   * Fill the name slots, and let a tap open and shut them.
   *
   * Filled here rather than in the template so the toggle can redraw ONE row
   * instead of the whole panel — this thing rebuilds on every answer, and a
   * list that flickers every time somebody presses a button is unreadable.
   */
  const fill = () => {
    // Over the rows that were drawn, not every option — the first-letter round
    // draws a handful of the twenty-six, and the rest have no slot to fill.
    rows.forEach(([i]) => {
      const slot = el.querySelector(`.who-slot[data-slot="${i}"]`);
      const row = whoRow(s, i, picked(s)[i] || []);
      slot.replaceChildren(...(row ? [row] : []));
      const caret = el.querySelector(`.keyrow[data-opt="${i}"] .caret`);
      if (caret) caret.classList.toggle('open', isOpen(s, i));
    });

    const waiting = (s.whoPicked && s.whoPicked.missing) || [];
    const slot = el.querySelector('.missing-slot');
    slot.replaceChildren(...(waiting.length ? [node(`
      <div class="keywho none">
        <b>${s.phase === 'reveal' ? 'No answer:' : 'Still to answer:'}</b>${waiting.map((n) => `<span>${esc(n)}</span>`).join('')}
      </div>`)] : []));

    /*
     * Who left the app while this question was up.
     *
     * Worded as "left the app", not "cheated", because that is all it knows: a
     * call coming in, a notification and the screen locking look exactly the
     * same from here. Anyone worth mentioning on the mic will be on this line
     * question after question, and the running total beside their name on the
     * board is where you see that. On its own it means nothing.
     */
    const off = s.wandered || [];
    const wslot = el.querySelector('.wandered-slot');
    wslot.replaceChildren(...(off.length ? [node(`
      <div class="keywho none wandered">
        <b>Left the app:</b>${off.map((n) => `<span>${esc(n)}</span>`).join('')}
      </div>`)] : []));
  };

  /*
   * "That one's wrong" — one tap, and back to the room.
   *
   * The room has just told the host a question is wrong and sixty people are
   * waiting. Anything with typing in it does not get used mid-gig, so this
   * takes nothing: the server reads the question off the running game itself.
   *
   * Deliberately small, quiet, and nowhere near the primary button. It is not
   * an action anybody needs to find in a hurry, and a mis-tap next to Reveal is
   * exactly what the rest of this file exists to prevent.
   */
  const reportBtn = el.querySelector('.report-q');
  if (reportBtn) {
    reportBtn.addEventListener('click', async () => {
      reportBtn.disabled = true;
      try {
        await postJson('/api/host/reportQuestion', {}, { 'X-Host-Key': hostKey });
        reportBtn.textContent = 'Noted \u2014 thanks';
        toast('Reported. Carry on; it is on the owner\u2019s list.');
      } catch (err) {
        reportBtn.disabled = false;
        toast('Could not report it: ' + err.message);
      }
    });
  }

  el.querySelectorAll('.keyrow').forEach((row) => {
    row.addEventListener('click', () => {
      const i = Number(row.dataset.opt);
      opened.set(pickKey(s, i), !isOpen(s, i));
      fill();
    });
  });
  fill();
  return el;
}

/**
 * The right answers, however many there are. One shape for every round type so
 * the key rows do not have to know which kind they are showing.
 */
function rightSet(q) {
  return new Set(q.correctIndexes && q.correctIndexes.length ? q.correctIndexes : [q.correctIndex]);
}

function nextUpPanel(s) {
  const up = s.upcoming;
  if (!up) return node('<div class="panel"><h3>Next up</h3><div class="tiny">Nothing queued.</div></div>');
  return node(`
    <div class="panel">
      <h3>Next up — R${up.roundIndex + 1} Q${up.questionIndex + 1}</h3>
      <p class="prompt">${esc(up.prompt)}</p>
      ${up.pickCount > 1 ? `<div class="tiny" style="margin-bottom:8px;color:var(--cool)">Pick ${up.pickCount}</div>` : ''}
      ${up.alphabet
        // No options to read ahead — the answer and its letter is the whole
        // thing, and nobody has answered yet so there is no tally to show.
        ? `<div class="answer-said"><span class="answer-letter">${esc(up.correctLetter || '?')}</span><span class="answer-words">${esc(up.answer || '')}</span></div>`
        : up.breakout
          // No answer key to read ahead here either — just the prompt above.
          ? '<div class="tiny" style="color:var(--cool)">No right answer — read the funny ones out.</div>'
          : `<div class="keylist">
        ${up.options.map((opt, i) => `
          <div class="keyrow ${rightSet(up).has(i) ? 'is-correct' : ''}">
            <span class="letter">${LETTERS[i]}</span><span>${esc(opt)}</span>
          </div>`).join('')}
      </div>`}
    </div>
  `);
}

/*
 * How many questions this phone has left the app during.
 *
 * Shown from THREE, not from one. One is a phone call. Two is a phone call and
 * a text. The number here is meant to be ignorable until it is not, and a badge
 * against half the room on the first notification of the night would be noise
 * you learn to skip — which is the same as not having it.
 */
const WANDER_WORTH_SAYING = 3;

function wanderMark(p) {
  const n = p.wanderedCount || 0;
  if (n < WANDER_WORTH_SAYING) return '';
  // Text, not an emoji — same rule as the bin icon and the seasonal shapes.
  // This is read off a phone in a dark room and "away x4" cannot be rendered
  // as something else by somebody's handset.
  return `<span class="wandered-count" title="Left the app during ${n} questions">away x${n}</span>`;
}

/**
 * "18 phones waiting to join — Let them in."
 *
 * A lot of NEW phones arrived at once and the door is being held. **The NUMBER
 * is the whole point**: eighteen is a room, three hundred is somebody messing
 * about, and that judgement needs a human for about a second. So it is not
 * automated and it is not hidden — it sits above the player list, where you
 * are already looking while a room fills up.
 *
 * Nobody is ever refused. If this is never tapped the phones simply keep
 * asking, and a genuine room gets in as the burst dies down.
 */
function joinQueue(s) {
  const waiting = s.joinsWaiting || 0;
  if (!waiting) return '';
  return `
    <div class="panel joinq">
      <h3>${waiting} phone${waiting === 1 ? '' : 's'} waiting to join</h3>
      <div class="tiny">A lot at once. If that looks like your room, let them in — if it looks like
        somebody messing about, leave it and they never reach the scoreboard.</div>
      <button class="go" id="letThemIn">Let them in</button>
    </div>`;
}

function playersPanel(s) {
  const idle = (s.players || []).filter((p) => !p.answeredCount).length;
  const el = node(`
    <div>
    ${joinQueue(s)}
    <div class="panel">
      <h3>Playing — tap a name to fix a score or remove</h3>
      <div class="plist">
        ${(s.players || []).map((p) => `
          <div class="prow" data-id="${esc(p.id)}">
            <span class="pos">${p.position}</span>
            <span class="nm">${esc(p.name)}</span>
            ${p.answeredThisQuestion ? '<span class="tick">✓</span>' : ''}
            ${p.connected ? '' : '<span class="off">off</span>'}
            ${wanderMark(p)}
            <span class="sc">${p.score.toLocaleString('en-GB')}</span>
            <button data-act="menu">···</button>
          </div>`).join('') || '<div class="tiny">Nobody has joined yet.</div>'}
      </div>
      ${idle >= 3 ? `
        <button class="minor tidy" id="removeIdle">Remove the ${idle} who have answered nothing</button>
        <div class="tiny">Duplicates, somebody who joined twice, a phone that wandered off. Anybody who
          has answered even one question is left alone.</div>` : ''}
    </div>
    </div>
  `);

  el.querySelector('#letThemIn')?.addEventListener('click', () => act('letThemIn'));
  el.querySelector('#removeIdle')?.addEventListener('click', async () => {
    if (confirm(`Remove ${idle} who have answered nothing? Anybody who has answered is left alone.`)) {
      await act('removeIdle');
    }
  });

  el.querySelectorAll('[data-act="menu"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const row = btn.closest('.prow');
      openPlayerMenu(row.dataset.id, row.querySelector('.nm').textContent);
    });
  });
  return el;
}

function openPlayerMenu(playerId, name) {
  const el = node(`
    <div class="panel" style="position:fixed;left:12px;right:12px;bottom:150px;z-index:40;max-width:696px;margin:0 auto;background:#161626">
      <h3>${esc(name)}</h3>
      <div class="row">
        <button class="minor" data-a="-100">−100</button>
        <button class="minor" data-a="+100">+100</button>
        <button class="minor" data-a="+240">+240</button>
        <button class="minor" data-a="rename">Rename</button>
        <button class="minor danger" data-a="remove">Remove</button>
        <button class="minor" data-a="close">Close</button>
      </div>
    </div>
  `);
  el.addEventListener('click', async (e) => {
    const a = e.target.dataset && e.target.dataset.a;
    if (!a) return;
    if (a === 'remove') {
      if (confirm(`Remove ${name} from the quiz?`)) await act('removePlayer', { playerId });
    } else if (a === 'rename') {
      const newName = prompt('New name', name);
      if (newName) await act('renamePlayer', { playerId, name: newName });
    } else if (a !== 'close') {
      await act('adjustScore', { playerId, delta: Number(a) });
    }
    el.remove();
  });
  document.body.appendChild(el);
}

/**
 * WHAT TONIGHT IS PLAYING FOR, said in the lobby — including when it is
 * nothing.
 *
 * The prizes are resolved from the venue record at LAUNCH, so a night whose
 * venue did not match one carries none — and until now the first anybody knew
 * was the final scores going up with no QR on anybody's phone. That is exactly
 * how the first real night ended, and an app that says nothing looks exactly
 * like an app that is working.
 *
 * The pack card states it before the press, which is the right place and does
 * not cover every route in: the two quick-launch buttons deliberately take no
 * settings — a dropdown on the panic control defeats the panic control — so
 * they always launch with no venue, and they are the fastest path in the app.
 * This is the backstop for that: the lobby is the one moment where the host is
 * waiting, looking at their phone, and a relaunch still costs nothing.
 *
 * Only in Setup, which draws at the lobby and at the end and nowhere else — so
 * it is never a line sitting across the control view mid-round. And it is
 * plain text rather than a warning: a night with no prize is an ordinary
 * night, and most of them are.
 */
function prizeLine(s) {
  const rewards = (s.rewards || []).map((r) => String(r || '').trim()).filter(Boolean);
  if (!rewards.length) {
    return '<div class="tiny" style="margin-top:4px">No prizes tonight'
      + ' \u2014 they come from the venue you pick when you launch.</div>';
  }
  const places = ['1st', '2nd', '3rd'];
  return `<div class="tiny" style="margin-top:4px">Playing for: ${rewards
    .map((r, i) => `<b>${esc(places[i] || `${i + 1}th`)}</b> ${esc(r)}`).join(' \u00b7 ')}</div>`;
}

/**
 * WHAT THE LAST SLIDE WILL SAY, in the same panel as the prizes and for the
 * same reason.
 *
 * The date is derived from the venue's usual night and the diary, which is
 * what makes it free — and it is also why the host has to see it BEFORE the
 * end. They are the only person who knows they are not doing the 20th, and a
 * wrong date is the one thing on that slide worse than no slide at all. Seen
 * in the lobby there is still time to fix the diary or say something else over
 * the top of it.
 *
 * It is also the line they say into the microphone while it is up, which is
 * the shape this app uses everywhere: the app prepares, the human reads it out.
 *
 * Silent when there is none. "No last slide tonight" is a sentence about a
 * thing most nights never had, and the panel already carries one line about
 * what is missing.
 */
function comeBackLine(s) {
  if (!s.comeBack || !s.comeBack.text) return '';
  return `<div class="tiny" style="margin-top:4px">Ends on: <b>${esc(s.comeBack.text)}</b>${
    s.comeBack.link ? ' \u00b7 with a QR to their page' : ''}</div>`;
}

/**
 * TELL THE ROOM ROUGHLY WHEN IT STARTS.
 *
 * The code goes up at ten to and the quiz kicks off at nine, and until this
 * the phone said "hang tight" and gave anybody who had just joined nothing to
 * look at. Now the projector and every phone carry the same countdown off the
 * same server clock.
 *
 * **MINUTES FROM NOW, NEVER A WALL-CLOCK TIME.** "Nine o'clock" on a projector
 * is a commitment the app has made on the host's behalf — run four minutes
 * late and the big screen has told sixty people so. A duration is an
 * intention, and pressing 10 again pushes it back with one tap.
 *
 * **IT NEVER STARTS THE QUIZ.** The host presses the button, exactly as
 * before. A quiz that began on a timer would begin while they were at the bar
 * getting a drink in, which is the sort of thing this codebase exists to
 * prevent. At zero the countdown says "any moment now" and stops.
 *
 * Three presets and Off, rather than a number to type: this is set with one
 * thumb while carrying a microphone, and five, ten or fifteen minutes covers
 * every version of "we are nearly ready".
 */
function startsRow(s) {
  const mins = [5, 10, 15];
  return `
    <div class="starts-row">
      <span class="tiny">Tell the room</span>
      ${mins.map((m) => `<button class="minor starts-set" data-mins="${m}">${m} min</button>`).join('')}
      ${s.startsAt ? '<button class="minor starts-off">Off</button>' : ''}
    </div>`;
}

function toolsPanel(s) {
  /*
   * THE BIG SCREEN AND THE EDITOR ARE ON THE BUTTON BAR, so they are not here
   * as well.
   *
   * This panel had "Open big screen" and "Edit questions" while the bar four
   * inches below had "Big screen" and "Edit" — the same two acts, twice, on
   * one screen, in two pairs of words. Two ways to do one job is how you end
   * up using the worse one out of habit, and here the worse one is this: the
   * bar carries them at every phase that has no question up, including the
   * round boards, where this panel does not exist at all. So the bar keeps
   * them and Setup keeps only what has no other home — which quiz is loaded,
   * the results, and the two things that clear a night.
   */
  const el = node(`
    <div class="panel">
      <h3>Setup</h3>
      <div class="row">
        <select id="quizPick"><option>Loading quizzes…</option></select>
        <button class="minor" id="loadQuiz">Load</button>
      </div>
      <div class="row" style="margin-top:10px">
        <a class="minor" style="text-decoration:none;display:inline-block" href="/api/results.csv?key=${encodeURIComponent(hostKey)}">Download results</a>
        <button class="minor danger" id="resetScores">Reset scores</button>
        <button class="minor danger" id="resetAll">Clear everything</button>
      </div>
      <div class="tiny" style="margin-top:10px">Loaded: ${esc(s.quizTitle)}</div>
      ${prizeLine(s)}
      ${comeBackLine(s)}
      ${startsRow(s)}
    </div>
  `);

  fetch(`/api/quizzes?key=${encodeURIComponent(hostKey)}`)
    .then((r) => r.json())
    .then((d) => {
      const sel = el.querySelector('#quizPick');
      sel.replaceChildren(...(d.quizzes || []).map((q) =>
        node(`<option value="${esc(q.id)}" ${q.id === d.loaded ? 'selected' : ''}>${esc(q.title)} (${q.questionCount})</option>`)));
    })
    .catch(() => {});

  el.querySelector('#loadQuiz').addEventListener('click', async () => {
    const id = el.querySelector('#quizPick').value;
    if (id && confirm('Load this quiz? Scores and players will be cleared.')) await act('loadQuiz', { quizId: id });
  });
  el.querySelector('#resetScores').addEventListener('click', async () => {
    if (confirm('Set every score back to zero? Everyone stays in.')) await act('resetScores');
  });
  el.querySelector('#resetAll').addEventListener('click', async () => {
    if (confirm('Clear everything and go back to an empty lobby?')) await act('resetAll');
  });
  // No confirm on any of these: setting a countdown starts nothing and takes
  // nothing away, and pressing another one just moves it.
  for (const b of el.querySelectorAll('.starts-set')) {
    b.addEventListener('click', () => act('startsIn', { minutes: Number(b.dataset.mins) }));
  }
  el.querySelector('.starts-off')?.addEventListener('click', () => act('startsIn', { minutes: null }));
  return el;
}

// ----------------------------------------------------------- primary button

function minorButton(text, handler, danger = false) {
  const b = node(`<button class="minor ${danger ? 'danger' : ''}">${esc(text)}</button>`);
  b.addEventListener('click', handler);
  return b;
}

function buildActions(s) {
  if (s.game === 'bingo') return bingoActions(s, act, minorButton);

  /*
   * TONIGHT AS MORE THAN ONE GAME — this quiz part is not the whole night,
   * so its own "Show the winner" (the last round's own ROUND_BOARD) must
   * not be allowed to run — that is the ordinary next/final path, and it
   * would file the night, hand out the quiz's prizes and end the evening
   * two parts early. `s.runningOrder.nextKind` is only present when the
   * server genuinely has another part queued (`session.js`'s
   * `advanceOrder`); absent, every phase below behaves exactly as it always
   * has.
   */
  const order = s.runningOrder;
  const atLastRoundBoard = s.phase === 'round_board' && s.roundIndex >= s.roundCount - 1;
  const continuing = Boolean(order && order.nextKind) && atLastRoundBoard;
  const continueWord = continuing && order.nextKind === 'bingo' ? 'the bingo' : 'the quiz';

  const label = continuing ? `Continue to ${continueWord}` : ({
    lobby: 'Start the quiz',
    rules: 'On to round 1',
    round_intro: 'First question',
    question: 'Reveal the answer',
    reveal: 'Next question',
    round_board: atLastRoundBoard ? 'Show the winner' : 'Next round',
    final: 'Finished',
  }[s.phase] || 'Next');

  /*
   * AT THE FINAL, THE BIG BUTTON BECOMES "CHECK THE PHOTOS".
   *
   * It used to read *Finished* and be DISABLED — a dead control in the one
   * place the host's thumb has been all night, at the exact moment there is
   * still one thing left to do. Asked for on 17 August 2026: *"at the end of
   * the quiz it's showing the winner, you do your well dones, and then the
   * next click takes you to a huge CHECK PHOTOS link that you can't dodge —
   * it's part of the flow."*
   *
   * **That is what makes it happen at all.** A prompt on the console is
   * something you go and find; this is the next press in a sequence somebody
   * has been making all evening, in the same position, at full size. It is
   * also the last moment the room is still there to be asked about a picture,
   * which is the whole reason the looking has to happen tonight rather than on
   * a Monday.
   *
   * It does NOT publish anything. It takes you to the night's photographs,
   * where the publish control already lives underneath them — the rule that
   * nobody publishes a night without having just seen what is in it is exactly
   * what this is serving.
   */
  const done = s.phase === 'final';
  const primary = node(`<button class="primary">${esc(done ? 'Check the photos' : label)}</button>`);
  primary.addEventListener('click', () => {
    if (done) {
      /*
       * The night's own key, on the same 6am roll-over as `nightOfGig()` and
       * the photos — so a quiz that ended at half past midnight opens its own
       * night rather than tomorrow with nothing under it. Handed over in the
       * URL rather than by writing the console's `localStorage` from here: two
       * pages writing one key is how a contract drifts, and a link can be
       * followed twice or bookmarked.
       */
      const night = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString().slice(0, 10);
      location.href = withKey(`/console?door=post&tab=past&night=${night}`);
      return;
    }
    if (continuing) {
      act('advanceOrder');
      return;
    }
    // The one press worth being fussy about. Everything else Back undoes
    // quietly; this one the room has already seen.
    if (s.phase === 'question' && questionAge() < TOO_SOON_MS) {
      toast('Too soon — the question only just went up');
      return;
    }
    act('next');
  });

  const out = [primary];

  /*
   * A `title` on each, and it is a BONUS rather than the answer.
   *
   * There are no tooltips on a phone, and this page is driven from one — so
   * the LABEL still has to say what the button does on its own. That is the
   * fault this file already records for "Control view" being a small grey
   * link with the reason hidden in a `title`. What a tooltip is genuinely
   * worth is the second sentence: "Skip" says what it does, and hovering it
   * on a laptop says what it COSTS.
   */
  const minor = (text, handler, danger = false, why = '') => {
    const b = node(`<button class="minor ${danger ? 'danger' : ''}"${why ? ` title="${esc(why)}"` : ''}>${esc(text)}</button>`);
    b.addEventListener('click', handler);
    return b;
  };

  /*
   * BACK IS AN ARROW; NOTHING ELSE ON THIS PAGE IS.
   *
   * It earns one where the primary button never could: back is the SAME act
   * at every phase — one move, scores kept — so an arrow is a complete
   * description of it. The primary is a different act each time ("Reveal the
   * answer" is not "Next question"), and an unlabelled arrow there is how you
   * reveal an answer to a room that has not answered yet.
   *
   * Drawn rather than the character "←", for the reason `binIcon()` is drawn:
   * phones and projectors render arrow glyphs at wildly different weights and
   * some fall back to a box. `aria-label` and a `title` so it is still called
   * Back to anything that reads the page out or hovers it.
   */
  const backIcon = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" aria-hidden="true">'
    + '<path d="M20 12H5M11 6l-6 6 6 6" stroke="currentColor" stroke-width="2.6"'
    + ' stroke-linecap="round" stroke-linejoin="round"/></svg>';
  /*
   * DEAD IN THE LOBBY, so it is drawn dead.
   *
   * `Engine.back()` falls through to `default: return false` at the lobby —
   * there is nothing before the lobby to go back to — so the arrow was a
   * control that quietly did nothing, on the one page somebody presses in a
   * dark pub to find out where they are. Disabled it says which it is, and
   * the title says why rather than leaving somebody pressing it twice.
   */
  const atStart = s.phase === 'lobby';
  const back = node(`<button class="minor back-btn" aria-label="Back" ${atStart ? 'disabled' : ''}`
    + ` title="${atStart
      ? 'Nothing to go back to yet \u2014 the quiz has not started.'
      : 'Back \u2014 one step back. Every score is kept, so this is the safe one.'}"`
    + `>${backIcon}</button>`);
  back.addEventListener('click', () => act('back'));
  out.push(back);

  /*
   * PRIZES, EDITABLE FROM WHEREVER YOU ARE — not just Setup, which only
   * appears at the lobby and the final scores. A landlord changing what's on
   * the bar mid-quiz, or a host who typed the wrong thing at launch, should
   * not have to wait for the round to end to fix it. A popover rather than a
   * permanent line keeps the promise in Setup's own comment: this never sits
   * across the control view mid-round on its own.
   */
  out.push(minor('Prizes', () => rewardsEditorPopover(s, act), false,
    'Change what tonight is playing for. Takes effect from the next prize onward.'));

  if (s.phase === 'question' || s.phase === 'reveal') {
    /*
     * "Ask again", not "Redo" and not "Reload". Redo is ambiguous about which
     * direction it goes, and Reload sits two inches under the browser's own
     * reload button on a laptop — where it reads as refreshing the page
     * rather than as running the question again and wiping its points.
     */
    out.push(minor('Ask again', () => act('redo'), false,
      'Ask this question again from the top — the clock restarts and the points it has already awarded are wiped.'));
    out.push(minor('Skip', () => act('skip'), true,
      'Drop this question and move on — its points are wiped. For one that is wrong, or that the room has already had.'));
  } else {
    // ?g= or it opens the HOUSE room's projector rather than this one — see
    // screenLink() in console.js for what that cost.
    out.push(minor('Big screen', () => window.open(
      s.joinCode ? `/screen?g=${encodeURIComponent(s.joinCode)}` : '/screen', '_blank')),
    );
    out.push(minor('Edit', () => { location.href = withKey('/editor'); }, false,
      'Open this pack in the editor. Saving reloads it in the running game.'));
  }

  /*
   * The scores on the big screen, on demand — roughly every five questions.
   *
   * A toggle rather than a phase, so it never has to be undone and cannot lose
   * your place. Pressing the big onwards button while it is up simply carries
   * on with the quiz and takes it down, which is what anybody would expect.
   *
   * Disabled while a question is live: the room cannot answer what it cannot
   * see, and the clock would keep running behind it.
   */
  /*
   * BOTH BUTTONS SAY WHO SEES IT, which is the whole difference between them.
   *
   * They were "Scores on screen" and "My scores", side by side — one puts the
   * board on the PROJECTOR for the room, the other shows it to the HOST alone.
   * Both said "scores", neither said who was looking, and "My scores" reads
   * like the host's own score in the quiz. It is the exemplar CLAUDE.md uses
   * for a label collision and the host's own test of it was: *"if it's not
   * obvious to me what it does, a fresh QM will have no idea."*
   *
   * So the noun stays and the AUDIENCE is what tells them apart: the room, or
   * just you. Nothing else on this bar needs saying that way, because nothing
   * else on it comes in two audiences.
   */
  const board = s.scoreboard || {};
  const showing = Boolean(board.on);
  const boardBtn = minor(showing ? 'Hide from the room' : 'Scores to the room', () => act('scoreboard', { on: !showing }),
    false, showing
      ? 'Take the scoreboard off the big screen. The quiz has not moved.'
      : 'Put the scoreboard on the big screen for the room to see. It does not move the quiz, and pressing onwards takes it down.');
  boardBtn.classList.toggle('on', showing);
  if (!board.allowed && !showing) {
    boardBtn.disabled = true;
    boardBtn.title = 'Not while a question is live — the room needs to see it';
  }
  out.push(boardBtn);

  // The host's own copy, on their phone, which is a different thing from
  // putting it on the projector — so it says so on the button rather than
  // only in a tooltip nobody on a phone will ever see.
  out.push(minor('Scores, just me', () => showScores(), false,
    'The scores on THIS screen, for you only \u2014 the room sees nothing.'));

  /*
   * The venue's advertising slides.
   *
   * Same rules as the scoreboard — a flag, refused over a live question, taken
   * down by pressing onwards — because they are the same kind of thing:
   * something shown over the quiz without moving it.
   */
  const ad = s.advert || {};
  if (ad.showing && ad.showing.packId) {
    const stop = minor('Take the advert down', () => act('advert', {}));
    stop.classList.add('on');
    out.push(stop);
  } else if (ad.allowed) {
    // Only where there are adverts to show. It used to be drawn for everybody,
    // so a Bronze quizmaster got a button whose only outcome was "make some on
    // the Adverts tab" — a tab greyed out with a `+` on it.
    if (s.mayAdvert) {
      out.push(minor('Advert', () => showAdvertPicker(), false,
        'Put one of the venue\u2019s slides on the big screen. Like the scoreboard, it does not move the quiz.'));
    }
  }

  /*
   * Stop here and show the winner.
   *
   * The Setup panel — with "Clear everything" in it — only appears in the
   * lobby and at the end, so until now a night that had to finish early left
   * no way out but pressing onwards through every remaining question.
   *
   * Behind a confirm, because it is one tap from the onwards button. Not
   * destructive though: it jumps to the final scores with everything intact,
   * and Back from there returns to the round board, so a mis-tap is one press
   * to undo.
   */
  if (s.phase !== 'lobby' && s.phase !== 'final') {
    out.push(minor('Stop the quiz', () => {
      if (confirm('Stop here and show the winner? The scores are kept, and Back undoes it.')) act('finish');
    }, true, 'End the night here and go straight to the winner. Every score is kept and Back undoes it.'));
  }
  return out;
}

/**
 * Pick a slide to put up.
 *
 * A list rather than anything cleverer: it is used between rounds, in the
 * dark, with a room waiting, and the venue rarely has more than three or four
 * offers. The host's line for the mic is shown under each one so there is
 * something to say while it is up.
 */
async function showAdvertPicker() {
  let sets = [];
  let here = '';
  try {
    const res = await fetch(`/api/library?key=${encodeURIComponent(hostKey)}`);
    const lib = await res.json();
    sets = lib.adverts || [];
    here = String((lib.running || {}).venue || '').trim().toLowerCase();
  } catch {
    alert('Could not load the adverts.');
    return;
  }
  const usable = sets.filter((set) => !set.broken && set.slideCount);
  if (!usable.length) {
    alert('No advert slides yet. Make some on the Adverts tab in the console.');
    return;
  }

  const sheet = node(`
    <div class="cam-overlay">
      <div class="cam-sheet">
        <div class="cam-head"><b>Put an advert up</b><button class="cam-close">✕</button></div>
        <div class="ad-picks"></div>
      </div>
    </div>`);
  const close = () => sheet.remove();
  sheet.querySelector('.cam-close').addEventListener('click', close);
  sheet.addEventListener('click', (e) => { if (e.target === sheet) close(); });

  const list = sheet.querySelector('.ad-picks');
  /*
   * TONIGHT'S VENUE FIRST, and said out loud.
   *
   * A slide belongs to a venue (`src/adverts.js`), and a quizmaster with eight
   * pubs on the books has eight sets in here — so standing in the Dog & Duck,
   * between rounds, in the dark, with a room waiting, the list was a scroll
   * past seven other pubs' offers to reach the one that matters.
   *
   * Sorted rather than filtered, deliberately. A generic slide with no venue
   * on it — "follow me on Facebook", a sponsor, a charity night — is a real
   * thing somebody wants to put up anywhere, and a filter would hide it. The
   * order carries the answer and nothing is taken away.
   *
   * Silent when it would say nothing: with no venue on the night, or only one
   * set, the divider is a heading over the whole list explaining nothing.
   */
  const mine = (set) => here && String(set.venue || '').trim().toLowerCase() === here;
  const ordered = here ? [...usable.filter(mine), ...usable.filter((s) => !mine(s))] : usable;
  const split = here && ordered.some(mine) && ordered.some((s) => !mine(s));
  let saidRest = false;
  for (const set of ordered) {
    if (split && !mine(set) && !saidRest) {
      saidRest = true;
      list.appendChild(node('<div class="ad-set ad-set-rest">Everything else</div>'));
    }
    list.appendChild(node(`<div class="ad-set">${esc(set.venue || set.title)}</div>`));
    for (const slide of set.slides) {
      const row = node(`
        <button class="ad-pick">
          <span class="ad-pick-head">${esc(slide.heading || '(no heading)')}</span>
          ${slide.hasLink ? '<span class="ad-pick-tag">QR</span>' : ''}
        </button>`);
      row.addEventListener('click', async () => {
        await act('advert', { packId: set.id, slideId: slide.id });
        close();
      });
      list.appendChild(row);
    }
  }
  document.body.appendChild(sheet);
}

function showScores() {
  const rows = (state.players || []).slice(0, 12);
  const el = node(`
    <div class="panel" style="position:fixed;left:12px;right:12px;bottom:150px;z-index:40;max-width:696px;margin:0 auto;background:#161626;max-height:60vh;overflow:auto">
      <h3>Scores</h3>
      <div class="plist">
        ${rows.map((p) => `<div class="prow"><span class="pos">${p.position}</span><span class="nm">${esc(p.name)}</span><span class="sc">${p.score.toLocaleString('en-GB')}</span></div>`).join('')}
      </div>
      <button class="minor" style="margin-top:10px;width:100%">Close</button>
    </div>`);
  el.querySelector('button').addEventListener('click', () => el.remove());
  document.body.appendChild(el);
}

// ------------------------------------------------------------------- clock

function tick() {
  requestAnimationFrame(tick);
  if (!state) return;
  if (state.game === 'bingo') {
    clockEl.textContent = state.calledCount ?? '';
    clockEl.classList.remove('urgent');
    return;
  }
  if (state.phase !== 'question' || !state.clock) {
    clockEl.textContent = state.phase === 'reveal' ? '0' : '--';
    clockEl.classList.remove('urgent');
    return;
  }
  const left = Math.max(0, state.clock.endsAt - clock.now());
  clockEl.textContent = String(Math.ceil(left / 1000));
  clockEl.classList.toggle('urgent', left <= 5000);
}
requestAnimationFrame(tick);

// -------------------------------------------------------------------- boot

/**
 * Ask for the key. Also reached when a remembered key stops being accepted,
 * so a changed key is a box to type in rather than a dead end mid-gig.
 */
function askForKey(message = '') {
  mainEl.replaceChildren(node(`
    <div class="panel">
      <h3>Host key</h3>
      ${message ? `<p class="tiny" style="color:var(--bad)">${esc(message)}</p>` : ''}
      <p class="tiny">Set as HOST_KEY on your host. If you never set one, the app
        invents one and prints it in the startup log.</p>
      <div class="row" style="margin-top:10px">
        <input type="text" id="keyIn" placeholder="host key" style="flex:1 1 auto">
        <button class="minor" id="keyGo">Unlock</button>
      </div>
    </div>`));
  const go = () => {
    const key = document.getElementById('keyIn').value.trim();
    if (!key) return;
    hostKey = key;
    localStorage.setItem(KEY_STORE, hostKey);
    location.href = `/host?key=${encodeURIComponent(hostKey)}`;
  };
  document.getElementById('keyGo').addEventListener('click', go);
  document.getElementById('keyIn').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') go();
  });
}

/*
 * Getting in: a signed-in quizmaster, or the host key, or both.
 *
 * **The key is no longer required, and that was a blocker.** A quizmaster who
 * signed in and opened their control view was asked for a host key they have
 * never been given and have no way of getting — so Rob could launch a game from
 * his console and then not drive it. Their cookie already says who they are and
 * which room is theirs; that is enough.
 *
 * The key still works and still wins where both are present, for the same
 * reason it wins on the server: it is the way in that predates accounts and it
 * must keep working whatever else is going on in the browser.
 *
 * Asked once before opening a live connection, so a key that is no longer right
 * is a box to retype rather than a stream that silently never connects.
 */
const keyQuery = hostKey ? `&key=${encodeURIComponent(hostKey)}` : '';

function openStream() {
  new Live(`/api/stream?role=host${keyQuery}`, {
    onState: draw,
    onStatus: (status) => {
      if (status !== 'online') connEl.textContent = 'Reconnecting…';
    },
  });
}

{
  fetch(`/api/state?role=host${keyQuery}`).then((res) => {
    if (res.status === 401) {
      // Nobody signed in and no key that works. If a key was remembered it is
      // stale, so forget it rather than letting it fail silently for ever.
      if (hostKey) localStorage.removeItem(KEY_STORE);
      askForKey(hostKey
        ? 'That key was not accepted. It may have changed \u2014 check your host\u2019s startup log.'
        : 'Sign in at /login, or paste your host key here.');
      return;
    }
    openStream();
    // Which hat is on. Asked separately because the state payload is about the
    // game, not about who is looking at it.
  }).catch(() => {
    // The network had a moment. Opening the stream anyway is the right bet: it
    // reconnects on its own, and a control view that refuses to appear because
    // one fetch failed is worse than one that is briefly empty.
    openStream();
  });
  // Keep the control view awake: a locked phone mid-round is a bad moment.
  if ('wakeLock' in navigator) {
    const keepAwake = () => navigator.wakeLock.request('screen').catch(() => {});
    keepAwake();
    document.addEventListener('visibilitychange', () => { if (!document.hidden) keepAwake(); });
  }
}
