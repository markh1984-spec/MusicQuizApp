/**
 * The console: where a night starts.
 *
 * Pick a game, pick a pack, launch. Everything you have ever saved is here,
 * so a quiz you wrote for a Harry Potter night in March is one tap away in
 * November — that is the whole point of packs being files rather than
 * something typed in fresh each time.
 */

import { esc, node, postJson, brandLink } from './client.js';

const mainEl = document.getElementById('main');
const runningEl = document.getElementById('runningNow');

/**
 * The key is remembered on this device once you have arrived with it in the
 * address, so you can bookmark plain /console and never think about it again.
 */
const hostKey = new URL(location.href).searchParams.get('key')
  || localStorage.getItem('musicquiz.hostkey')
  || '';
if (hostKey) localStorage.setItem('musicquiz.hostkey', hostKey);

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

const keyed = (path) => path + (path.includes('?') ? '&' : '?') + 'key=' + encodeURIComponent(hostKey);
const linkTo = (path) => keyed(path);

let library = null;

async function load() {
  const res = await fetch(keyed('/api/library'));
  if (res.status === 401) {
    // The remembered key is no longer right. Forget it and ask again rather
    // than leaving them staring at an error.
    localStorage.removeItem('musicquiz.hostkey');
    askForKey('That key was not accepted. It may have changed — check your host\u2019s startup log.');
    return;
  }
  if (!res.ok) throw new Error('Could not load the library');
  library = await res.json();
  render();
}

/**
 * The tabs.
 *
 * One entry per thing you can run. Adding a third game means adding one entry
 * here and nothing else on this page — the tab bar, the panel and the pack
 * grid are all built from this list.
 */
const TABS = [
  {
    id: 'quiz',
    label: 'Music Quiz',
    blurb: 'Three rounds, twenty seconds a question, fastest fingers win.',
    editLabel: 'Edit questions',
    packs: () => library.quizzes,
    generator: () => quizGeneratePanel(library.generation || {}),
  },
  {
    id: 'bingo',
    label: 'Music Bingo',
    blurb: 'You play the tracks. Every phone gets its own card.',
    editLabel: 'Edit track lists',
    packs: () => library.bingo,
    generator: () => {
      const wrap = document.createDocumentFragment();
      wrap.appendChild(generatePanel(library.generation || {}));
      wrap.appendChild(importPanel(library.generation || {}));
      return wrap;
    },
  },
  {
    id: 'past',
    label: 'Past nights',
    blurb: 'Results are saved when a game finishes.',
    render: () => archiveSection(library.archive || []),
  },
];

const TAB_STORE = 'musicquiz.consoletab';

/** Logo and name, top left, linking home — as any website does. */
function paintBrand(name) {
  const slot = document.getElementById('brandSlot');
  if (!slot || !name) return;
  slot.innerHTML = brandLink(name, { key: hostKey, size: 30 });
  document.title = `Console — ${name}`;
}

function currentTab() {
  const wanted = new URL(location.href).searchParams.get('tab')
    || localStorage.getItem(TAB_STORE)
    || 'quiz';
  return TABS.some((t) => t.id === wanted) ? wanted : 'quiz';
}

function render() {
  paintBrand(library.brand);
  const running = library.running;
  runningEl.textContent = running
    ? `Now: ${running.title} (${running.playerCount} in)`
    : '';

  const active = currentTab();

  mainEl.replaceChildren(
    ...(backupWarning(library.generation || {}) || []),
    runningPanel(running),
    tabBar(active),
    tabBody(active),
  );
}

/**
 * The one warning worth putting at the top of the page.
 *
 * Without backup, everything made here is temporary — and nothing looks wrong
 * until the day it has gone. That is exactly the kind of failure that deserves
 * to be loud.
 */
function backupWarning(gen) {
  if (gen.backup) return null;

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

function tabBar(active) {
  const bar = node('<div class="tabbar" role="tablist"></div>');
  for (const tab of TABS) {
    const count = tab.packs ? (tab.packs() || []).length : (library.archive || []).length;
    const button = node(`
      <button class="tab ${tab.id === active ? 'on' : ''}" role="tab" data-tab="${tab.id}">
        ${esc(tab.label)}${count ? `<span class="tabcount">${count}</span>` : ''}
      </button>`);
    button.addEventListener('click', () => {
      localStorage.setItem(TAB_STORE, tab.id);
      render();
      window.scrollTo({ top: 0 });
    });
    bar.appendChild(button);
  }
  return bar;
}

function tabBody(active) {
  const tab = TABS.find((t) => t.id === active) || TABS[0];
  const wrap = node('<div class="tabbody"></div>');

  // A tab is either a game (generator + its saved packs) or a one-off panel.
  if (tab.render) {
    wrap.appendChild(tab.render());
    return wrap;
  }

  if (tab.generator) wrap.appendChild(tab.generator());
  wrap.appendChild(gameSection(tab.id, tab.label, tab.blurb, tab.packs(), tab.editLabel));
  return wrap;
}

/**
 * Build a whole quiz from a theme.
 *
 * Same shape as the bingo generator below it, so there is one place on this
 * page for "make me something new" rather than a button for one game and a
 * terminal command for the other.
 */
function quizGeneratePanel(gen) {
  const el = node(`
    <div class="panel generate quiz-generate">
      <h3>New quiz</h3>
      <div class="gen-row">
        <input type="text" id="qTheme" placeholder="A theme — the 1990s, Motown, Christmas number ones, Britpop…" autocomplete="off">
        <button class="go" id="qGo" ${gen.claude ? '' : 'disabled'}>Write it</button>
      </div>
      <div class="gen-opts">
        <label>Questions per round <input type="number" id="qPer" value="10" min="3" max="20" style="width:60px"></label>
        <label><input type="checkbox" id="qText" checked> General knowledge</label>
        <label><input type="checkbox" id="qImage" checked> Whose face</label>
        <label><input type="checkbox" id="qIntro" checked> Name that intro</label>
        <label><input type="checkbox" id="qHard"> Harder than usual</label>
        <span class="tiny">Every question is checked by a second pass before you see it.</span>
      </div>
      <div class="gen-status" id="qStatus"></div>
      ${gen.claude ? '' : '<div class="tiny warn">Set ANTHROPIC_API_KEY to write quizzes.</div>'}
    </div>`);

  el.querySelector('#qGo')?.addEventListener('click', () => generateQuiz(el));
  el.querySelector('#qTheme')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') generateQuiz(el);
  });
  return el;
}

async function generateQuiz(panel) {
  const theme = panel.querySelector('#qTheme').value.trim();
  const status = panel.querySelector('#qStatus');
  const button = panel.querySelector('#qGo');
  if (!theme) {
    status.textContent = 'Give it a theme first.';
    return;
  }

  const rounds = [];
  if (panel.querySelector('#qText').checked) rounds.push('text');
  if (panel.querySelector('#qImage').checked) rounds.push('image');
  if (panel.querySelector('#qIntro').checked) rounds.push('intro');
  if (!rounds.length) {
    status.textContent = 'Pick at least one round.';
    return;
  }

  button.disabled = true;
  button.textContent = 'Writing…';
  status.innerHTML = '<div class="gen-log"></div>';
  const logEl = status.querySelector('.gen-log');
  const say = (line) => {
    logEl.appendChild(node(`<div>${esc(line)}</div>`));
    logEl.scrollTop = logEl.scrollHeight;
  };

  try {
    const result = await streamGeneration('/api/generate/quiz', {
      theme,
      rounds,
      perRound: Number(panel.querySelector('#qPer').value),
      hard: panel.querySelector('#qHard').checked,
    }, say);

    if (result.error) {
      status.appendChild(node(`<div class="gen-bad">${esc(result.error)}</div>`));
      button.disabled = false;
      button.textContent = 'Write it';
      return;
    }

    const done = result.done;
    const problems = done.problems || [];
    status.appendChild(node(`
      <div class="gen-good">
        Written <b>${esc(done.title)}</b> — ${done.questionCount} questions across
        ${done.rounds} round${done.rounds === 1 ? '' : 's'}.
        <br>Checked over — ${done.rejected} question${done.rejected === 1 ? '' : 's'} thrown out and replaced.
        ${done.backedUp ? '<br>Backed up to GitHub — this one is permanent.' : '<br><b>Not backed up</b> — this will be lost when the app restarts.'}
        <br><b>Now read it.</b> <a href="${linkTo('/editor')}">Open the editor</a> and
        check every question before anyone else sees it.
        ${done.needsImages ? '<br><span class="tiny">The face round has no pictures yet — it will use placeholders until you generate them. See TODO.md part 6.</span>' : ''}
      </div>`));
    if (problems.length) {
      status.appendChild(node(`
        <div class="gen-bad">${problems.length} thing${problems.length === 1 ? '' : 's'} to fix in the editor:
          <ul style="margin:6px 0 0 18px">${problems.slice(0, 8).map((p) => `<li>${esc(p)}</li>`).join('')}</ul>
        </div>`));
    }
    button.textContent = 'Written';
    await load();
  } catch (err) {
    status.appendChild(node(`<div class="gen-bad">${esc(err.message)}</div>`));
    button.disabled = false;
    button.textContent = 'Write it';
  }
}

/**
 * Read a streaming generation response, calling `say` for each progress line.
 * Both generators send plain lines, then one final DONE or ERROR line.
 */
async function streamGeneration(path, body, say) {
  const res = await fetch(keyed(path), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Host-Key': hostKey },
    body: JSON.stringify(body),
  });

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let done = null;
  let error = null;

  for (;;) {
    const chunk = await reader.read();
    if (chunk.done) break;
    buffer += decoder.decode(chunk.value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop();
    for (const line of lines) {
      if (!line) continue;
      if (line.startsWith('DONE ')) done = JSON.parse(line.slice(5));
      else if (line.startsWith('ERROR ')) error = line.slice(6);
      else say(line);
    }
  }
  return { done, error };
}

/**
 * Bring in a list you already have.
 *
 * There is more than one good way to end up with forty songs — a playlist you
 * built over months, or Claude in your browser with its own instructions and a
 * Spotify connector. None of that should have to be redone here.
 */
function importPanel(gen) {
  const el = node(`
    <div class="panel import">
      <h3>Or bring in a list you already have</h3>
      <div class="gen-row">
        <input type="text" id="impUrl" placeholder="Paste a Spotify playlist link…" autocomplete="off">
        <button class="go" id="impGo">Import</button>
      </div>
      <details class="import-paste">
        <summary>or paste a track list instead</summary>
        <textarea id="impText" rows="7" placeholder="One per line — any of these work:&#10;&#10;Billie Jean — Michael Jackson&#10;1. Take On Me - a-ha&#10;Blue Monday by New Order"></textarea>
      </details>
      <div class="gen-opts">
        <label>Card <select id="impSize"><option value="3">3×3</option><option value="4" selected>4×4</option><option value="5">5×5</option></select></label>
        <label>Call it <input type="text" id="impTitle" placeholder="optional" style="width:150px"></label>
        <label title="Off by default — you probably built this list on purpose."><input type="checkbox" id="impAvoid"> Skip songs played recently</label>
      </div>
      <div class="gen-status" id="impStatus"></div>
      ${gen.spotify ? '' : '<div class="tiny warn">Spotify is not set up, so playlist links will not work — paste a list instead.</div>'}
    </div>`);

  el.querySelector('#impGo').addEventListener('click', () => runImport(el));
  el.querySelector('#impUrl').addEventListener('keydown', (e) => { if (e.key === 'Enter') runImport(el); });
  return el;
}

async function runImport(panel) {
  const playlistUrl = panel.querySelector('#impUrl').value.trim();
  const text = panel.querySelector('#impText').value.trim();
  const status = panel.querySelector('#impStatus');
  const button = panel.querySelector('#impGo');

  if (!playlistUrl && !text) {
    status.textContent = 'Paste a playlist link, or a track list.';
    return;
  }

  button.disabled = true;
  button.textContent = 'Importing…';
  status.innerHTML = '<div class="gen-log"></div>';
  const logEl = status.querySelector('.gen-log');
  const say = (line) => {
    logEl.appendChild(node(`<div>${esc(line)}</div>`));
    logEl.scrollTop = logEl.scrollHeight;
  };

  try {
    const { done, error } = await streamGeneration('/api/import/bingo', {
      playlistUrl,
      text,
      title: panel.querySelector('#impTitle').value.trim(),
      cardSize: Number(panel.querySelector('#impSize').value),
      avoidMonths: panel.querySelector('#impAvoid').checked ? 3 : 0,
    }, say);

    if (error) {
      status.appendChild(node(`<div class="gen-bad">${esc(error)}</div>`));
      button.disabled = false;
      button.textContent = 'Import';
      return;
    }

    status.appendChild(node(`
      <div class="gen-good">
        Imported <b>${esc(done.title)}</b> — ${done.trackCount} tracks.
        ${done.backedUp ? '<br>Backed up to GitHub — this one is permanent.' : '<br><b>Not backed up.</b>'}
      </div>`));
    button.textContent = 'Imported';
    await load();
  } catch (err) {
    status.appendChild(node(`<div class="gen-bad">${esc(err.message)}</div>`));
    button.disabled = false;
    button.textContent = 'Import';
  }
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
        <br>Checked over — ${done.rejected} question${done.rejected === 1 ? '' : 's'} thrown out and replaced.
        ${done.backedUp ? '<br>Backed up to GitHub — this one is permanent.' : '<br><b>Not backed up</b> — this will be lost when the app restarts.'}
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

function gameSection(kind, title, blurb, packs, editLabel = 'Edit') {
  const el = node(`
    <div class="game-section">
      <div class="game-head">
        <div>
          <h2>Your saved ${kind === 'quiz' ? 'quizzes' : 'bingo packs'}</h2>
          <div class="tiny">${esc(blurb)}</div>
        </div>
        <a class="minor" href="${linkTo('/editor')}">${esc(editLabel)}</a>
      </div>
      <div class="pack-grid"></div>
    </div>`);

  const grid = el.querySelector('.pack-grid');
  if (!packs || !packs.length) {
    grid.appendChild(node(`<div class="tiny">Nothing saved yet — build one above.</div>`));
    return el;
  }

  for (const pack of packs) {
    grid.appendChild(packCard(kind, pack));
  }
  return el;
}

function hasPictureRound(pack) {
  return (pack.rounds || []).some((r) => r.type === 'image');
}

/**
 * Round 2 artwork, from the console.
 *
 * Two buttons rather than one, because they are not the same decision.
 * Placeholders are free and instant and exist so the round is rehearsable;
 * real portraits cost money per press. The panel says which questions still
 * have a stand-in before you spend anything, and never quietly replaces a
 * real picture — one you have already paid for, or redrawn by hand, has to be
 * asked for again explicitly.
 */
function picturePanel(pack) {
  const el = node(`
    <div class="panel pics">
      <div class="tiny status">Checking what round 2 has…</div>
      <div class="row" style="margin-top:8px">
        <button class="minor draw">Draw stand-ins</button>
        <button class="go make">Make real portraits</button>
        <label class="tiny redo"><input type="checkbox" class="force"> replace ones already there</label>
      </div>
      <div class="tiny note"></div>
      <pre class="gen-log" hidden></pre>
    </div>`);

  const status = el.querySelector('.status');
  const note = el.querySelector('.note');
  const logEl = el.querySelector('.gen-log');
  const makeBtn = el.querySelector('.make');
  const drawBtn = el.querySelector('.draw');

  const refresh = async () => {
    try {
      const res = await fetch(keyed(`/api/images/${encodeURIComponent(pack.id)}`));
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Could not read it');
      const bits = [`${d.total} picture${d.total === 1 ? '' : 's'} in round 2`];
      if (d.real) bits.push(`${d.real} real`);
      if (d.placeholder) bits.push(`${d.placeholder} stand-in${d.placeholder === 1 ? '' : 's'}`);
      if (d.missing) bits.push(`${d.missing} with nothing yet`);
      status.textContent = bits.join(' · ');

      if (!d.openai) {
        makeBtn.disabled = true;
        note.textContent = 'Set OPENAI_API_KEY to make real portraits. Stand-ins work without it.';
        note.style.color = 'var(--gold)';
      } else {
        const todo = d.questions.filter((q) => !q.real).length;
        note.textContent = todo
          ? `${todo} to make — roughly ${(todo * 4 / 100).toFixed(2)} pounds.`
          : 'All ten have real artwork. Tick the box to redo any.';
        note.style.color = '';
      }
    } catch (err) {
      status.textContent = err.message;
    }
  };
  refresh();

  const run = async (provider, button) => {
    const force = el.querySelector('.force').checked;
    if (provider === 'openai' && !confirm('Generate with OpenAI? This costs about 4p a picture.')) return;
    for (const b of [makeBtn, drawBtn]) b.disabled = true;
    button.textContent = provider === 'openai' ? 'Making…' : 'Drawing…';
    logEl.hidden = false;
    logEl.textContent = '';
    const say = (line) => { logEl.textContent += line + '\n'; logEl.scrollTop = logEl.scrollHeight; };

    try {
      const { done, error } = await streamGeneration('/api/generate/images', {
        quizId: pack.id, provider, force,
      }, say);
      if (error) say('\n' + error);
      else if (done) {
        say(`\n${done.made} made, ${done.skipped} skipped${done.failed ? `, ${done.failed} failed` : ''}.`);
        if (!done.backedUp && done.made) say('These are on this server only — generate at home and commit them to keep them.');
      }
    } catch (err) {
      say('\n' + err.message);
    }
    for (const b of [makeBtn, drawBtn]) b.disabled = false;
    makeBtn.textContent = 'Make real portraits';
    drawBtn.textContent = 'Draw stand-ins';
    refresh();
  };

  makeBtn.addEventListener('click', () => run('openai', makeBtn));
  drawBtn.addEventListener('click', () => run('placeholder', drawBtn));
  return el;
}

function hasIntroRound(pack) {
  return (pack.rounds || []).some((r) => r.type === 'intro');
}

/**
 * The Spotify playlist for a "name that intro" round.
 *
 * Its own button rather than only a step inside generation, because you can
 * easily have an intro round before you have a Spotify login — and because a
 * playlist deleted by accident should not mean regenerating the quiz and
 * getting a different set of questions.
 *
 * Building it also writes Spotify's own spelling and a track link back onto
 * each cue, so the control view can offer a tap to open the track instead of
 * leaving you searching for it with a room waiting.
 */
function playlistPanel(pack) {
  const gen = library.generation || {};
  const el = node(`
    <div class="panel pics">
      <div class="tiny status">Builds a Spotify playlist in question order — track one is question one.</div>
      <div class="row" style="margin-top:8px">
        <button class="go build">Build the playlist</button>
      </div>
      <div class="tiny note"></div>
      <pre class="gen-log" hidden></pre>
    </div>`);

  const note = el.querySelector('.note');
  const button = el.querySelector('.build');
  const logEl = el.querySelector('.gen-log');

  if (!gen.spotify) {
    button.disabled = true;
    note.style.color = 'var(--gold)';
    note.textContent = `Spotify is not set up — run \`npm run spotify:login\`. Missing: ${(gen.spotifyMissing || []).join(', ')}`;
  } else {
    note.textContent = 'Spotify cannot make folders through its API, so every playlist is named the same way and they sort together — drag them into a folder in one go.';
  }

  button.addEventListener('click', async () => {
    button.disabled = true;
    button.textContent = 'Building…';
    logEl.hidden = false;
    logEl.textContent = '';
    const say = (line) => { logEl.textContent += line + '\n'; logEl.scrollTop = logEl.scrollHeight; };
    try {
      const { done, error } = await streamGeneration('/api/playlist/intro', { quizId: pack.id }, say);
      if (error) say('\n' + error);
      else if (done) {
        for (const p of done.playlists) {
          say(`\n${p.round}: ${p.url}${p.missing ? ` (${p.missing} not found on Spotify)` : ''}`);
        }
        if (!done.playlists.length) say('\nNo playlist made.');
        await load();
      }
    } catch (err) {
      say('\n' + err.message);
    }
    button.disabled = false;
    button.textContent = 'Build the playlist';
  });

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
      <button class="pack-title" title="Read it">${esc(pack.title)}</button>
      <div class="tiny">${esc(detail)}</div>
      <div class="tiny played">${esc(played)}</div>
      ${pack.broken ? `<div class="tiny" style="color:var(--bad)">Broken: ${esc(pack.broken)}</div>` : ''}
      ${pack.problems ? `<div class="tiny" style="color:var(--bad)">${pack.problems} thing${pack.problems === 1 ? '' : 's'} to fix</div>` : ''}
      <div class="pack-actions">
        <button class="go launch" ${pack.broken ? 'disabled' : ''}>Launch</button>
        <button class="pack-read" title="Read it through">Read</button>
        ${hasPictureRound(pack) ? '<button class="pack-pics" title="Make the round 2 portraits">Pictures</button>' : ''}
        ${hasIntroRound(pack) ? '<button class="pack-playlist" title="Build the Spotify playlist for the intro round">Playlist</button>' : ''}
        <button class="pack-del" title="Delete this pack">Delete</button>
      </div>
      <div class="pics-slot"></div>
    </div>`);

  const openIt = () => preview(kind, pack);
  const toggle = (build) => {
    const slot = el.querySelector('.pics-slot');
    const already = slot.dataset.which === build.name;
    slot.replaceChildren();
    slot.dataset.which = already ? '' : build.name;
    if (!already) slot.appendChild(build(pack));
  };
  el.querySelector('.pack-pics')?.addEventListener('click', () => toggle(picturePanel));
  el.querySelector('.pack-playlist')?.addEventListener('click', () => toggle(playlistPanel));
  el.querySelector('.pack-title')?.addEventListener('click', openIt);
  el.querySelector('.pack-read')?.addEventListener('click', openIt);

  el.querySelector('.pack-del')?.addEventListener('click', async () => {
    if (!confirm(`Delete "${pack.title}"?\n\nThis removes it from your library for good.`)) return;
    const button = el.querySelector('.pack-del');
    button.disabled = true;
    button.textContent = 'Deleting…';
    try {
      const res = await fetch(keyed(`/api/${kind}/` + encodeURIComponent(pack.id)), {
        method: 'DELETE',
        headers: { 'X-Host-Key': hostKey },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not delete it');
      await load();
    } catch (err) {
      button.disabled = false;
      button.textContent = 'Delete';
      alert(err.message);
    }
  });

  el.querySelector('.launch')?.addEventListener('click', async () => {
    // Warn whenever anybody has joined — including in the lobby, which used to
    // be treated as safe. The lobby is exactly when a room full of people has
    // just scanned the code, so it is the worst moment to wipe them, not the
    // best. Launching over the top throws every one of them out.
    const running = library.running;
    const joined = (running && running.playerCount) || 0;
    const over = running && running.phase === 'finished';
    if (joined > 0 && !over) {
      const teams = `${joined} team${joined === 1 ? '' : 's'}`;
      const doing = running.phase === 'lobby'
        ? `${teams} have already joined "${running.title}"`
        : `"${running.title}" is still running with ${teams} in`;
      if (!confirm(`${doing}.\n\nLaunching this will remove them and they will have to scan and join again. Carry on?`)) return;
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

/**
 * Read a pack through without leaving the console.
 *
 * The point is answering "is this any good?" in the thirty seconds before you
 * decide to run it — so the correct answer is obvious at a glance, and there is
 * a summary at the top flagging the things that make a quiz feel cheap: the
 * answer always being in the same slot, or a round with no interesting facts to
 * read out.
 */
async function preview(kind, pack) {
  const overlay = node(`
    <div class="overlay">
      <div class="sheet">
        <div class="sheet-head">
          <div style="min-width:0;flex:1 1 auto">
            <input class="sheet-title" id="sheetTitle" value="${esc(pack.title)}" title="Click to rename">
            <div class="tiny" id="sheetSub">Loading…</div>
          </div>
          <div class="sheet-actions">
            <button class="go" id="sheetSave" hidden>Save</button>
            <a class="minor" href="${linkTo('/editor')}">Edit questions</a>
            <button class="minor" id="sheetClose">Close</button>
          </div>
        </div>
        <div class="sheet-body" id="sheetBody"></div>
      </div>
    </div>`);

  document.body.appendChild(overlay);
  const close = () => overlay.remove();
  overlay.querySelector('#sheetClose').addEventListener('click', close);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  const onKey = (e) => { if (e.key === 'Escape') { close(); document.removeEventListener('keydown', onKey); } };
  document.addEventListener('keydown', onKey);

  const body = overlay.querySelector('#sheetBody');
  const sub = overlay.querySelector('#sheetSub');
  const saveBtn = overlay.querySelector('#sheetSave');
  const titleInput = overlay.querySelector('#sheetTitle');

  // Renaming happens here rather than in the editor, because reading a pack
  // through is when you notice a round is called the wrong thing.
  let loaded = null;
  let dirty = false;
  const markDirty = () => {
    dirty = true;
    saveBtn.hidden = false;
    saveBtn.textContent = 'Save';
    saveBtn.disabled = false;
  };

  titleInput.addEventListener('input', () => {
    if (loaded) { loaded.title = titleInput.value; markDirty(); }
  });

  saveBtn.addEventListener('click', async () => {
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving…';
    try {
      const res = await fetch(keyed(`/api/${kind}/` + encodeURIComponent(pack.id)), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'X-Host-Key': hostKey },
        body: JSON.stringify(loaded),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not save');
      dirty = false;
      saveBtn.textContent = data.backedUp ? 'Saved and backed up' : 'Saved here only';
      await load();
    } catch (err) {
      saveBtn.disabled = false;
      saveBtn.textContent = 'Save';
      alert(err.message);
    }
  });

  // Do not let a click outside quietly bin a rename.
  const guardedClose = () => {
    if (dirty && !confirm('You have unsaved changes. Close anyway?')) return;
    close();
  };
  overlay.querySelector('#sheetClose').removeEventListener('click', close);
  overlay.querySelector('#sheetClose').addEventListener('click', guardedClose);

  try {
    const res = await fetch(keyed(`/api/${kind}/` + encodeURIComponent(pack.id)));
    if (!res.ok) throw new Error('Could not open it');
    loaded = await res.json();
    if (kind === 'bingo') renderBingoPreview(body, sub, loaded, markDirty);
    else renderQuizPreview(body, sub, loaded, markDirty);
  } catch (err) {
    sub.textContent = '';
    body.replaceChildren(node(`<div class="tiny" style="color:var(--bad)">${esc(err.message)}</div>`));
  }
}

const LETTERS = ['A', 'B', 'C', 'D'];

/**
 * The flags, with a way to tick each one off.
 *
 * Reading twenty of these is a job, and a job you can lose your place in. So a
 * checked flag drops out of the list into a folded-away pile at the bottom,
 * leaving only what you have not looked at yet — and it stays checked next
 * time, because it is saved on the question rather than in this browser.
 *
 * They are never removed outright: a flag you dismissed by mistake, or one on
 * a question you later rewrote, has to be gettable back.
 */
function warningPanel(quiz, warnings) {
  const el = node(`
    <div class="pv-warn">
      <b class="pv-warn-head"></b>
      <ul class="pv-flags"></ul>
      <div class="pv-cleared" hidden>
        <button class="pv-cleared-toggle" type="button"></button>
        <ul class="pv-flags done" hidden></ul>
      </div>
      <div class="tiny" style="margin-top:8px">These are hunches, not errors — the app cannot tell whether a fact is true. Read them and decide.</div>
    </div>`);

  const head = el.querySelector('.pv-warn-head');
  const openList = el.querySelector('.pv-flags');
  const clearedBox = el.querySelector('.pv-cleared');
  const clearedToggle = el.querySelector('.pv-cleared-toggle');
  const clearedList = el.querySelector('.pv-flags.done');
  let showCleared = false;

  const draw = () => {
    const open = warnings.filter((w) => !w.cleared);
    const done = warnings.filter((w) => w.cleared);

    head.textContent = open.length
      ? `${open.length} thing${open.length === 1 ? '' : 's'} worth a second look`
      : 'All checked — nothing left to look at';
    head.classList.toggle('all-clear', open.length === 0);
    el.classList.toggle('all-clear', open.length === 0);

    openList.replaceChildren(...open.map((w) => row(w, false)));
    clearedBox.hidden = done.length === 0;
    clearedToggle.textContent = `${showCleared ? 'Hide' : 'Show'} ${done.length} you have checked`;
    clearedList.hidden = !showCleared;
    clearedList.replaceChildren(...done.map((w) => row(w, true)));
  };

  const row = (w, done) => {
    const li = node(`
      <li class="pv-flag ${done ? 'done' : ''}">
        <span class="pv-flag-text">${esc(w.text)}</span>
        <button class="pv-tick" type="button">${done ? 'Undo' : 'Checked'}</button>
      </li>`);
    const button = li.querySelector('.pv-tick');
    button.addEventListener('click', async () => {
      button.disabled = true;
      const wanted = !w.cleared;
      try {
        const res = await fetch(keyed(`/api/quiz/${encodeURIComponent(quiz.id)}/checked`), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Host-Key': hostKey },
          body: JSON.stringify({ questionId: w.questionId, warning: w.id, checked: wanted }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'Could not save that');
        // Trust the server's list over the local one — it has just written it.
        if (Array.isArray(data.warnings)) {
          const fresh = new Map(data.warnings.map((x) => [`${x.questionId}|${x.id}`, x.cleared]));
          for (const other of warnings) {
            const state = fresh.get(`${other.questionId}|${other.id}`);
            if (state !== undefined) other.cleared = state;
          }
        } else {
          w.cleared = wanted;
        }
        draw();
      } catch (err) {
        button.disabled = false;
        alert(err.message);
      }
    });
    return li;
  };

  clearedToggle.addEventListener('click', () => { showCleared = !showCleared; draw(); });
  draw();
  return el;
}

function renderQuizPreview(body, sub, quiz, markDirty = () => {}) {
  const all = quiz.rounds.flatMap((r) => r.questions);
  const spread = [0, 0, 0, 0];
  for (const q of all) if (spread[q.correctIndex] !== undefined) spread[q.correctIndex]++;
  const noNotes = all.filter((q) => !q.answerNote).length;

  sub.innerHTML = `${all.length} questions across ${quiz.rounds.length} round${quiz.rounds.length === 1 ? '' : 's'}
    · answers land ${spread.map((n, i) => `${LETTERS[i]}&times;${n}`).join(' ')}
    ${spread.some((n) => n > all.length * 0.5) ? '<b style="color:var(--gold)"> — lopsided, worth shuffling</b>' : ''}
    ${noNotes ? ` · ${noNotes} with no fact to read out` : ''}`;

  const parts = [];

  // The questions most likely to cause an argument, listed first so they are
  // the ones you actually look at.
  const warnings = quiz.reviewWarnings || [];
  if (warnings.length) parts.push(warningPanel(quiz, warnings));
  for (const round of quiz.rounds) {
    const head = node(`
      <div class="pv-round">
        <div class="pv-round-head">
          <input class="pv-round-name" value="${esc(round.title)}" title="Click to rename this round">
          <span class="tiny">${esc({ text: 'General knowledge', image: 'Whose face is this?', intro: 'Name that intro' }[round.type] || round.type)}</span>
        </div>
        ${round.spotifyPlaylist ? `<a class="pv-playlist" href="${esc(round.spotifyPlaylist.url)}" target="_blank" rel="noopener">Spotify playlist for this round</a>` : ''}
      </div>`);
    head.querySelector('.pv-round-name').addEventListener('input', (e) => {
      round.title = e.target.value;
      markDirty();
    });
    parts.push(head);

    round.questions.forEach((q, i) => {
      parts.push(node(`
        <div class="pv-q">
          <div class="pv-prompt"><span class="pv-num">${i + 1}</span>${esc(q.prompt)}</div>
          <div class="pv-opts">
            ${q.options.map((o, oi) => `
              <div class="pv-opt ${oi === q.correctIndex ? 'right' : ''}">
                <span class="pv-letter">${LETTERS[oi]}</span>${esc(o)}
              </div>`).join('')}
          </div>
          ${q.cue ? `<div class="pv-cue">Play: <b>${esc(q.cue.title)}</b> — ${esc(q.cue.artist)}${q.cue.hint ? ` · ${esc(q.cue.hint)}` : ''}</div>` : ''}
          ${q.answerNote ? `<div class="pv-note">${esc(q.answerNote)}</div>` : ''}
          ${q.note ? `<div class="pv-note">Your note: ${esc(q.note)}</div>` : ''}
        </div>`));
    });
  }
  body.replaceChildren(...parts);
}

function renderBingoPreview(body, sub, pack, markDirty = () => {}) {
  const size = pack.cardSize || 4;
  sub.innerHTML = `${pack.tracks.length} tracks · ${size}&times;${size} card
    ${pack.spotifyPlaylist ? ` · <a href="${esc(pack.spotifyPlaylist.url)}" target="_blank" rel="noopener">Spotify playlist</a>` : ''}`;

  body.replaceChildren(node(`
    <div class="pv-tracks">
      ${pack.tracks.map((t, i) => `
        <div class="pv-track">
          <span class="pv-num">${i + 1}</span>
          <span class="pv-tt">${esc(t.title)}</span>
          <span class="pv-ta">${esc(t.artist || '')}</span>
        </div>`).join('')}
    </div>`));
}

function archiveSection(archive) {
  const el = node(`
    <div class="game-section">
      <div class="game-head">
        <div>
          <h2>Past nights</h2>
          <div class="tiny">Saved automatically when a game finishes.</div>
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
  askForKey();
} else {
  load().catch((err) => {
    mainEl.replaceChildren(node(`<div class="panel"><h3>Could not load</h3><div class="tiny">${esc(err.message)}</div></div>`));
  });
}
