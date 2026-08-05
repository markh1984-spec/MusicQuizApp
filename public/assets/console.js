/**
 * The console: where a night starts.
 *
 * Pick a game, pick a pack, launch. Everything you have ever saved is here,
 * so a quiz you wrote for a Harry Potter night in March is one tap away in
 * November — that is the whole point of packs being files rather than
 * something typed in fresh each time.
 */

import { esc, node, postJson } from './client.js';

const mainEl = document.getElementById('main');
const runningEl = document.getElementById('runningNow');

const hostKey = new URL(location.href).searchParams.get('key')
  || localStorage.getItem('musicquiz.hostkey')
  || '';
if (hostKey) localStorage.setItem('musicquiz.hostkey', hostKey);

const keyed = (path) => path + (path.includes('?') ? '&' : '?') + 'key=' + encodeURIComponent(hostKey);
const linkTo = (path) => keyed(path);

let library = null;

async function load() {
  const res = await fetch(keyed('/api/library'));
  if (!res.ok) throw new Error(res.status === 401 ? 'Wrong host key' : 'Could not load the library');
  library = await res.json();
  render();
}

function render() {
  const running = library.running;
  runningEl.textContent = running
    ? `Now: ${running.title} (${running.playerCount} in)`
    : '';

  mainEl.replaceChildren(
    runningPanel(running),
    generatePanel(library.generation || {}),
    gameSection('quiz', 'Music Quiz', 'Three rounds, twenty seconds a question, fastest fingers win.', library.quizzes),
    gameSection('bingo', 'Music Bingo', 'You play the tracks. Every phone gets its own card.', library.bingo),
    archiveSection(library.archive || []),
  );
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
      <h3>New bingo round</h3>
      <div class="gen-row">
        <input type="text" id="theme" placeholder="A theme — 1990s indie, Motown, Christmas number ones…" autocomplete="off">
        <button class="go" id="genGo" ${gen.claude ? '' : 'disabled'}>Build it</button>
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
        if (!line) continue;
        if (line.startsWith('DONE ')) done = JSON.parse(line.slice(5));
        else if (line.startsWith('ERROR ')) failed = line.slice(6);
        else say(line);
      }
    }

    if (failed) {
      say('');
      status.appendChild(node(`<div class="gen-bad">${esc(failed)}</div>`));
      button.disabled = false;
      button.textContent = 'Build it';
      return;
    }

    status.appendChild(node(`
      <div class="gen-good">
        Built <b>${esc(done.title)}</b> — ${done.trackCount} tracks.
        ${done.playlist ? `<a href="${esc(done.playlist)}" target="_blank" rel="noopener">Open the Spotify playlist</a>` : 'No Spotify playlist.'}
      </div>`));
    button.textContent = 'Built';
    await load(); // refresh the library so the new pack is there to launch
  } catch (err) {
    status.appendChild(node(`<div class="gen-bad">${esc(err.message)}</div>`));
    button.disabled = false;
    button.textContent = 'Build it';
  }
}

function runningPanel(running) {
  if (!running) return node('<div></div>');
  const live = running.phase !== 'lobby' && running.phase !== 'finished';
  return node(`
    <div class="panel running ${live ? 'live' : ''}">
      <h3>${live ? 'Running now' : 'Loaded and waiting'}</h3>
      <div class="running-row">
        <div>
          <div class="running-title">${esc(running.title)}</div>
          <div class="tiny">${esc(running.game === 'bingo' ? 'Music bingo' : 'Music quiz')} — ${running.playerCount} team${running.playerCount === 1 ? '' : 's'} in</div>
        </div>
        <div class="running-links">
          <a class="minor" href="${linkTo('/host')}">Control view</a>
          <a class="minor" href="/screen" target="_blank" rel="noopener">Big screen</a>
        </div>
      </div>
    </div>`);
}

function gameSection(kind, title, blurb, packs) {
  const el = node(`
    <div class="game-section">
      <div class="game-head">
        <div>
          <h2>${esc(title)}</h2>
          <div class="tiny">${esc(blurb)}</div>
        </div>
        <a class="minor" href="${linkTo('/editor')}">${kind === 'quiz' ? 'Edit questions' : 'Edit track lists'}</a>
      </div>
      <div class="pack-grid"></div>
    </div>`);

  const grid = el.querySelector('.pack-grid');
  if (!packs || !packs.length) {
    grid.appendChild(node('<div class="tiny">Nothing saved yet.</div>'));
    return el;
  }

  for (const pack of packs) {
    grid.appendChild(packCard(kind, pack));
  }
  return el;
}

function packCard(kind, pack) {
  const detail = kind === 'quiz'
    ? `${pack.questionCount} questions · ${(pack.rounds || []).length} rounds`
    : `${pack.trackCount} tracks · ${pack.cardSize}×${pack.cardSize} card`;

  const played = pack.playCount
    ? `Played ${pack.playCount} time${pack.playCount === 1 ? '' : 's'}${pack.lastPlayedAt ? ` · last ${whenish(pack.lastPlayedAt)}` : ''}`
    : 'Never played';

  const el = node(`
    <div class="pack-card ${pack.broken ? 'broken' : ''}">
      <div class="pack-title">${esc(pack.title)}</div>
      <div class="tiny">${esc(detail)}</div>
      <div class="tiny played">${esc(played)}</div>
      ${pack.broken ? `<div class="tiny" style="color:var(--bad)">Broken: ${esc(pack.broken)}</div>` : ''}
      ${pack.problems ? `<div class="tiny" style="color:var(--bad)">${pack.problems} thing${pack.problems === 1 ? '' : 's'} to fix</div>` : ''}
      <button class="go launch" ${pack.broken ? 'disabled' : ''}>Launch</button>
    </div>`);

  el.querySelector('.launch')?.addEventListener('click', async () => {
    const running = library.running;
    const live = running && running.phase !== 'lobby' && running.phase !== 'finished';
    if (live && !confirm(`"${running.title}" is still running with ${running.playerCount} teams in. Launching this will clear it. Carry on?`)) {
      return;
    }
    const button = el.querySelector('.launch');
    button.disabled = true;
    button.textContent = 'Launching…';
    try {
      await postJson('/api/host/launch', { game: kind, packId: pack.id }, { 'X-Host-Key': hostKey });
      location.href = linkTo('/host');
    } catch (err) {
      button.disabled = false;
      button.textContent = 'Launch';
      alert('Could not launch: ' + err.message);
    }
  });
  return el;
}

function archiveSection(archive) {
  const el = node(`
    <div class="game-section">
      <div class="game-head">
        <div>
          <h2>Past nights</h2>
          <div class="tiny">Results are saved when a game finishes.</div>
        </div>
      </div>
      <div class="archive-list"></div>
    </div>`);

  const list = el.querySelector('.archive-list');
  if (!archive.length) {
    list.appendChild(node('<div class="tiny">Nothing yet. Finish a game and it will appear here.</div>'));
    return el;
  }

  for (const night of archive.slice(0, 20)) {
    list.appendChild(node(`
      <a class="archive-row" href="${linkTo('/api/archive/' + encodeURIComponent(night.id))}" target="_blank" rel="noopener">
        <span class="an">${esc(night.title)}</span>
        <span class="tiny">${esc(night.winner ? 'Won by ' + night.winner : 'No winner recorded')}</span>
        <span class="tiny">${night.playerCount} team${night.playerCount === 1 ? '' : 's'}</span>
        <span class="tiny">${night.archivedAt ? whenish(night.archivedAt) : ''}</span>
      </a>`));
  }
  return el;
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

if (!hostKey) {
  mainEl.replaceChildren(node(`
    <div class="panel">
      <h3>Host key</h3>
      <p class="tiny">This is printed in the server log when the app starts.</p>
      <div class="row" style="margin-top:10px">
        <input type="text" id="keyIn" placeholder="host key" style="flex:1 1 auto">
        <button class="minor" id="keyGo">Unlock</button>
      </div>
    </div>`));
  document.getElementById('keyGo').addEventListener('click', () => {
    const key = document.getElementById('keyIn').value.trim();
    localStorage.setItem('musicquiz.hostkey', key);
    location.href = '/console?key=' + encodeURIComponent(key);
  });
} else {
  load().catch((err) => {
    mainEl.replaceChildren(node(`<div class="panel"><h3>Could not load</h3><div class="tiny">${esc(err.message)}</div></div>`));
  });
}
