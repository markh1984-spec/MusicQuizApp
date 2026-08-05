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

import { esc, node, ServerClock, Live, postJson, brandLink } from './client.js';
import { bingoPanels, bingoActions } from './host-bingo.js';

const KEY_STORE = 'musicquiz.hostkey';

const mainEl = document.getElementById('main');
const actionsEl = document.getElementById('actions');
const whereEl = document.getElementById('where');
const clockEl = document.getElementById('clock');
const connEl = document.getElementById('connText');

const clock = new ServerClock();
const LETTERS = ['A', 'B', 'C', 'D'];

let hostKey = new URL(location.href).searchParams.get('key') || localStorage.getItem(KEY_STORE) || '';
let state = null;

if (hostKey) localStorage.setItem(KEY_STORE, hostKey);

// ------------------------------------------------------------------ actions

async function act(action, body = {}) {
  try {
    await postJson(`/api/host/${action}`, body, { 'X-Host-Key': hostKey });
  } catch (err) {
    toast(err.status === 401 ? 'Wrong host key' : `Failed: ${err.message}`);
  }
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
    if (slot) slot.innerHTML = brandLink(state.brand, { key: hostKey, size: 26 });
    document.title = `Control — ${state.brand}`;
    brandPainted = true;
  }
  whereEl.textContent = whereLabel(state);
  connEl.textContent = `${state.playerCount} ${state.playerCount === 1 ? 'team' : 'teams'} in`;
  mainEl.replaceChildren(...restartNotice(state), ...buildPanels(state));
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
      nobody has to scan again. Tap a team name to put their points back.</div>
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
  switch (s.phase) {
    case 'lobby': return 'Lobby — waiting to start';
    case 'round_intro': return `Round ${s.roundIndex + 1} intro`;
    case 'question': return `R${s.roundIndex + 1} Q${s.questionIndex + 1} — live`;
    case 'reveal': return `R${s.roundIndex + 1} Q${s.questionIndex + 1} — revealed`;
    case 'round_board': return `Round ${s.roundIndex + 1} scores`;
    case 'final': return 'Final results';
    default: return 'Control';
  }
}

function buildPanels(s) {
  if (s.game === 'bingo') return bingoPanels(s, act);
  const panels = [];

  // The cue comes first when it matters: on the intro round you need to know
  // what to play before the question is even on screen.
  if (s.phase === 'round_intro' || s.phase === 'reveal' || s.phase === 'lobby') {
    const up = s.upcoming;
    if (up && up.cue) panels.push(cuePanel(up.cue, `Coming up — R${up.roundIndex + 1} Q${up.questionIndex + 1}`, up.playlist));
  }
  if ((s.phase === 'question' || s.phase === 'reveal') && s.question && s.question.cue) {
    panels.push(cuePanel(s.question.cue, 'Play this now', s.question.playlist));
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

function cuePanel(cue, title, playlist) {
  return node(`
    <div class="panel secret">
      <h3>${esc(title)}</h3>
      <div class="cue">
        <div class="track">${esc(cue.title || '')}</div>
        <div class="artist">${esc(cue.artist || '')}</div>
        ${cue.from ? `<div class="from">From ${esc(cue.from)}</div>` : ''}
        ${cue.hint ? `<div class="from">${esc(cue.hint)}</div>` : ''}
      </div>
      ${cue.spotifyUri || playlist ? `
        <div class="cue-links">
          ${cue.spotifyUri ? `<a class="cue-open" href="${esc(cue.spotifyUri)}">Open this track</a>` : ''}
          ${playlist ? `<a class="cue-open ghost" href="${esc(playlist.uri || playlist.url)}">Whole playlist</a>` : ''}
        </div>` : ''}
    </div>
  `);
}

function questionPanel(s) {
  const q = s.question;
  const tally = s.tally || [];
  const el = node(`
    <div class="panel">
      <h3>Round ${s.roundIndex + 1}, question ${s.questionIndex + 1} of ${s.questionCount} — answer key</h3>
      <p class="prompt">${esc(q.prompt)}</p>
      <div class="keylist">
        ${q.options.map((opt, i) => `
          <div class="keyrow ${i === q.correctIndex ? 'is-correct' : ''}">
            <span class="letter">${LETTERS[i]}</span>
            <span>${esc(opt)}</span>
            <span class="n">${tally[i] || 0}</span>
          </div>`).join('')}
      </div>
      ${q.note ? `<div class="tiny" style="margin-top:10px">Note: ${esc(q.note)}</div>` : ''}
      ${q.answerNote ? `<div class="tiny" style="margin-top:6px">${esc(q.answerNote)}</div>` : ''}
      <div class="tiny" style="margin-top:10px">
        ${s.answeredCount || 0} of ${s.playerCount} answered${s.fastest ? ` — fastest ${esc(s.fastest.name)} at ${s.fastest.seconds.toFixed(1)}s` : ''}
      </div>
    </div>
  `);
  return el;
}

function nextUpPanel(s) {
  const up = s.upcoming;
  if (!up) return node('<div class="panel"><h3>Next up</h3><div class="tiny">Nothing queued.</div></div>');
  return node(`
    <div class="panel">
      <h3>Next up — R${up.roundIndex + 1} Q${up.questionIndex + 1}</h3>
      <p class="prompt">${esc(up.prompt)}</p>
      <div class="keylist">
        ${up.options.map((opt, i) => `
          <div class="keyrow ${i === up.correctIndex ? 'is-correct' : ''}">
            <span class="letter">${LETTERS[i]}</span><span>${esc(opt)}</span>
          </div>`).join('')}
      </div>
    </div>
  `);
}

function playersPanel(s) {
  const el = node(`
    <div class="panel">
      <h3>Teams — tap a name to fix a score or remove</h3>
      <div class="plist">
        ${(s.players || []).map((p) => `
          <div class="prow" data-id="${esc(p.id)}">
            <span class="pos">${p.position}</span>
            <span class="nm">${esc(p.name)}</span>
            ${p.answeredThisQuestion ? '<span class="tick">✓</span>' : ''}
            ${p.connected ? '' : '<span class="off">off</span>'}
            <span class="sc">${p.score.toLocaleString('en-GB')}</span>
            <button data-act="menu">···</button>
          </div>`).join('') || '<div class="tiny">Nobody has joined yet.</div>'}
      </div>
    </div>
  `);

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
      const newName = prompt('New team name', name);
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
        <a class="minor" style="text-decoration:none;display:inline-block" href="/editor?key=${encodeURIComponent(hostKey)}">Edit questions</a>
      </div>
      <div class="row" style="margin-top:10px">
        <a class="minor" style="text-decoration:none;display:inline-block" href="/screen" target="_blank" rel="noopener">Open big screen</a>
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
    if (id && confirm('Load this quiz? Scores and teams will be cleared.')) await act('loadQuiz', { quizId: id });
  });
  el.querySelector('#resetScores').addEventListener('click', async () => {
    if (confirm('Set every score back to zero? Teams stay in.')) await act('resetScores');
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
    round_intro: 'First question',
    question: 'Reveal the answer',
    reveal: 'Next question',
    round_board: s.roundIndex >= s.roundCount - 1 ? 'Show the winner' : 'Next round',
    final: 'Finished',
  }[s.phase] || 'Next';

  const primary = node(`<button class="primary" ${s.phase === 'final' ? 'disabled' : ''}>${esc(label)}</button>`);
  primary.addEventListener('click', () => act('next'));

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
    out.push(minor('Big screen', () => window.open('/screen', '_blank')));
    out.push(minor('Edit', () => { location.href = `/editor?key=${encodeURIComponent(hostKey)}`; }));
  }

  out.push(minor(s.phase === 'reveal' ? 'Leaderboard' : 'Scores', () => showScores()));
  return out;
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

if (!hostKey) {
  askForKey();
} else {
  // Check the key before opening a live connection, so a wrong one asks to be
  // retyped instead of silently never connecting.
  fetch(`/api/state?role=host&key=${encodeURIComponent(hostKey)}`).then((res) => {
    if (res.status === 401) {
      localStorage.removeItem(KEY_STORE);
      askForKey('That key was not accepted. It may have changed \u2014 check your host\u2019s startup log.');
      return;
    }
    new Live(`/api/stream?role=host&key=${encodeURIComponent(hostKey)}`, {
      onState: draw,
      onStatus: (status) => {
        if (status !== 'online') connEl.textContent = 'Reconnecting…';
      },
    });
  }).catch(() => {
    new Live(`/api/stream?role=host&key=${encodeURIComponent(hostKey)}`, {
      onState: draw,
      onStatus: (status) => {
        if (status !== 'online') connEl.textContent = 'Reconnecting…';
      },
    });
  });
  // Keep the control view awake: a locked phone mid-round is a bad moment.
  if ('wakeLock' in navigator) {
    const keepAwake = () => navigator.wakeLock.request('screen').catch(() => {});
    keepAwake();
    document.addEventListener('visibilitychange', () => { if (!document.hidden) keepAwake(); });
  }
}
