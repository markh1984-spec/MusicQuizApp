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

import { esc, node, ServerClock, Live, postJson, brandLink, binIcon, actingBar, navMenu } from './client.js';
import { paintScheme } from './schemes.js';
import { bingoPanels, bingoActions } from './host-bingo.js';

const KEY_STORE = 'musicquiz.hostkey';

const mainEl = document.getElementById('main');
const actionsEl = document.getElementById('actions');
const whereEl = document.getElementById('where');
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
    toast(err.status === 401 ? 'Wrong host key' : `Failed: ${err.message}`);
  }
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
  /*
   * The menu. Rebuilt every push rather than once, because the projector and
   * the join page have to carry this room's join code and that arrives with
   * the state.
   *
   * `control` is simply true here: you are on the control view, so whatever
   * else is true you can plainly run a night. `owner` is left false because
   * this page never asks who you are — an owner runs no nights, so they are
   * barely ever here, and a menu guessing wrong is worse than one item short.
   */
  const nav = document.getElementById('navSlot');
  if (nav) {
    nav.innerHTML = navMenu({
      current: 'control', key: navKey, joinCode: state.joinCode || '',
    });
  }
  // Your own two colours on your own control view, so the phone in your hand
  // matches the projector you are driving. Not gated on `brandPainted`: the
  // colours can change mid-night from the console, the name cannot.
  paintScheme(state.scheme);
  whereEl.textContent = whereLabel(state);
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
  mainEl.replaceChildren(...restartNotice(state), ...advertPanel(state), ...buildPanels(state), ...photoPanel(state));
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
    case 'round_intro': return `Round ${s.roundIndex + 1} intro`;
    case 'question': return `R${s.roundIndex + 1} Q${s.questionIndex + 1} — live`;
    case 'reveal': return `R${s.roundIndex + 1} Q${s.questionIndex + 1} — revealed`;
    case 'round_board': return `Round ${s.roundIndex + 1} scores`;
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
  return node(`
    <div class="panel secret">
      <h3>${esc(title)}</h3>
      <div class="cue">
        <div class="track">${esc(cue.title || '')}</div>
        <div class="artist">${esc(cue.artist || '')}</div>
        ${cue.from ? `<div class="from">From ${esc(cue.from)}</div>` : ''}
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

function questionPanel(s) {
  const q = s.question;
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

function toolsPanel(s) {
  const el = node(`
    <div class="panel">
      <h3>Setup</h3>
      <div class="row">
        <select id="quizPick"><option>Loading quizzes…</option></select>
        <button class="minor" id="loadQuiz">Load</button>
        <a class="minor" style="text-decoration:none;display:inline-block" href="${withKey('/editor')}">Edit questions</a>
      </div>
      <div class="row" style="margin-top:10px">
        <a class="minor" style="text-decoration:none;display:inline-block" href="${s.joinCode ? `/screen?g=${encodeURIComponent(s.joinCode)}` : '/screen'}" target="_blank" rel="noopener">Open big screen</a>
        <a class="minor" style="text-decoration:none;display:inline-block" href="/api/results.csv?key=${encodeURIComponent(hostKey)}">Download results</a>
        <button class="minor danger" id="resetScores">Reset scores</button>
        <button class="minor danger" id="resetAll">Clear everything</button>
      </div>
      <div class="tiny" style="margin-top:10px">Loaded: ${esc(s.quizTitle)}</div>
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
  const label = {
    lobby: 'Start the quiz',
    rules: 'On to round 1',
    round_intro: 'First question',
    question: 'Reveal the answer',
    reveal: 'Next question',
    round_board: s.roundIndex >= s.roundCount - 1 ? 'Show the winner' : 'Next round',
    final: 'Finished',
  }[s.phase] || 'Next';

  const primary = node(`<button class="primary" ${s.phase === 'final' ? 'disabled' : ''}>${esc(label)}</button>`);
  primary.addEventListener('click', () => {
    // The one press worth being fussy about. Everything else Back undoes
    // quietly; this one the room has already seen.
    if (s.phase === 'question' && questionAge() < TOO_SOON_MS) {
      toast('Too soon — the question only just went up');
      return;
    }
    act('next');
  });

  const out = [primary];

  const minor = (text, handler, danger = false) => {
    const b = node(`<button class="minor ${danger ? 'danger' : ''}">${esc(text)}</button>`);
    b.addEventListener('click', handler);
    return b;
  };

  out.push(minor('Back', () => act('back')));

  if (s.phase === 'question' || s.phase === 'reveal') {
    out.push(minor('Redo', () => act('redo')));
    out.push(minor('Skip', () => act('skip'), true));
  } else {
    // ?g= or it opens the HOUSE room's projector rather than this one — see
    // screenLink() in console.js for what that cost.
    out.push(minor('Big screen', () => window.open(
      s.joinCode ? `/screen?g=${encodeURIComponent(s.joinCode)}` : '/screen', '_blank')));
    out.push(minor('Edit', () => { location.href = withKey('/editor'); }));
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
  const board = s.scoreboard || {};
  const showing = Boolean(board.on);
  const boardBtn = minor(showing ? 'Hide the scores' : 'Scores on screen', () => act('scoreboard', { on: !showing }));
  boardBtn.classList.toggle('on', showing);
  if (!board.allowed && !showing) {
    boardBtn.disabled = true;
    boardBtn.title = 'Not while a question is live — the room needs to see it';
  }
  out.push(boardBtn);

  // The host's own copy, on their phone, which is a different thing from
  // putting it on the projector.
  out.push(minor('My scores', () => showScores()));

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
    if (s.mayAdvert) out.push(minor('Advert', () => showAdvertPicker()));
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
    }, true));
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
  try {
    const res = await fetch(`/api/library?key=${encodeURIComponent(hostKey)}`);
    sets = (await res.json()).adverts || [];
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
  for (const set of usable) {
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
    fetch('/api/me').then((r) => r.json()).then((who) => actingBar(who)).catch(() => {});
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
