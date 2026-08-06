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
const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

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
        ? `${info.count} up. They go straight to the screen — tap one to bin it.`
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
    const fig = node(`<button class="host-photo" title="Bin this one"><img src="${esc(p.url)}" alt=""><span>${esc(p.teamName || '')}</span></button>`);
    fig.addEventListener('click', () => {
      if (confirm(`Bin this photo${p.teamName ? ` from ${p.teamName}` : ''}?`)) act('photoRemove', { id: p.id });
    });
    grid.appendChild(fig);
  }

  return [el];
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
      ${q.pickCount > 1 ? `<div class="tiny" style="margin-bottom:8px;color:var(--cool)">They lock in ${q.pickCount} — part marks for getting some.</div>` : ''}
      <div class="keylist">
        ${q.options.map((opt, i) => `
          <div class="keyrow ${rightSet(q).has(i) ? 'is-correct' : ''}">
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
      <div class="keylist">
        ${up.options.map((opt, i) => `
          <div class="keyrow ${rightSet(up).has(i) ? 'is-correct' : ''}">
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
    rules: 'On to round 1',
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
    out.push(minor('Advert', () => showAdvertPicker()));
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
