/**
 * The console: where a night starts.
 *
 * Pick a game, pick a pack, launch. Everything you have ever saved is here,
 * so a quiz you wrote for a Harry Potter night in March is one tap away in
 * November — that is the whole point of packs being files rather than
 * something typed in fresh each time.
 */

import { esc, node, postJson, brandLink, binIcon } from './client.js';
import { balanceAnswers } from './balance.js';

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
 * The rounds the quiz generator can write, and how many of each by default.
 *
 * A count each rather than one number for the lot: "fifteen general knowledge,
 * five pictures and ten of the first-letter round" is what a night actually
 * looks like, and "ten of everything" is what the generator used to insist on.
 *
 * [id, label, default count, on by default, tooltip]
 */
const QUIZ_ROUNDS = [
  ['text', 'General knowledge', 10, true, ''],
  ['image', 'Whose face', 10, true, 'An illustrated portrait that pulls back as the clock runs down'],
  ['intro', 'Name that intro', 10, true, 'You play the first few seconds off your own music app'],
  ['multi', 'Pick them all', 10, false, 'Several answers are right — the room locks in all of them'],
  ['alphabet', 'First letter', 10, false, 'No options: they get a keyboard and only the first letter of the answer has to be right'],
];

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
    id: 'adverts',
    label: 'Adverts',
    blurb: 'Slides for between rounds. One set per venue, reused every week.',
    count: () => (library.adverts || []).length,
    render: () => advertsSection(library.adverts || []),
  },
  {
    id: 'photos',
    label: 'Photos',
    blurb: 'Everything the room sent, foldered by night.',
    count: () => 0,
    render: () => photosSection(),
  },
  {
    id: 'invoices',
    label: 'Invoices',
    blurb: 'Bill for a night before you have left the car park.',
    // The badge is what you are still owed, not how many you have ever sent —
    // the number worth seeing without opening anything.
    count: () => (library.invoicing || {}).unpaidCount || 0,
    render: () => invoicesSection(),
  },
  {
    id: 'past',
    label: 'Past nights',
    blurb: 'Results are saved when a game finishes.',
    count: () => (library.archive || []).length,
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

/**
 * What the last job said, kept outside the panel that said it.
 *
 * A finished import or generation calls load(), which rebuilds the whole page
 * from the library — and took the result with it. You pressed Import, watched
 * it work, and were left looking at an empty form with no word either way. The
 * pack WAS there, in the grid below, but nothing said so.
 *
 * So the result is held here and drawn at the top on every render. It stays up
 * until you dismiss it or start another job, which is right for something you
 * might walk away from mid-generation.
 */
let lastDone = null;

function showDone(tone, html) {
  lastDone = { tone, html };
}

function doneBanner() {
  if (!lastDone) return [];
  const el = node(`
    <div class="panel done-banner ${lastDone.tone}">
      <div class="done-text">${lastDone.html}</div>
      <button class="minor done-close" title="Dismiss">Close</button>
    </div>`);
  el.querySelector('.done-close').addEventListener('click', () => { lastDone = null; render(); });
  return [el];
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
    ...doneBanner(),
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
    // Each tab says how to count itself. It used to fall back to the archive
    // length, which was right for one tab by accident and wrong for any other.
    const count = tab.count ? tab.count() : (tab.packs() || []).length;
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
      <div class="gen-rounds">
        ${QUIZ_ROUNDS.map(([id, label, count, checked, hint]) => `
          <label class="gen-round ${checked ? '' : 'off'}" ${hint ? `title="${esc(hint)}"` : ''}>
            <input type="checkbox" data-round="${id}" ${checked ? 'checked' : ''}>
            <span class="gen-round-name">${esc(label)}</span>
            <input type="number" data-count="${id}" value="${count}" min="1" max="30" ${checked ? '' : 'disabled'}>
          </label>`).join('')}
      </div>
      <div class="gen-opts">
        <label><input type="checkbox" id="qHard"> Harder than usual</label>
        <span class="tiny">A number each — fifteen general knowledge and five pictures is a normal night. Every question is checked by a second pass before you see it.</span>
      </div>
      <div class="gen-status" id="qStatus"></div>
      ${gen.claude ? '' : '<div class="tiny warn">Set ANTHROPIC_API_KEY to write quizzes.</div>'}
    </div>`);

  // Unticking a round greys its number out rather than hiding it, so the
  // count you had typed is still there when you tick it back on.
  el.querySelectorAll('[data-round]').forEach((box) => {
    box.addEventListener('change', () => {
      const row = box.closest('.gen-round');
      row.classList.toggle('off', !box.checked);
      row.querySelector('[data-count]').disabled = !box.checked;
    });
  });

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

  // In the order they are listed, each with its own count.
  const rounds = [...panel.querySelectorAll('[data-round]')]
    .filter((box) => box.checked)
    .map((box) => ({
      type: box.dataset.round,
      count: Number(panel.querySelector(`[data-count="${box.dataset.round}"]`).value) || 10,
    }));
  if (!rounds.length) {
    status.textContent = 'Pick at least one round.';
    return;
  }

  button.disabled = true;
  button.textContent = 'Writing…';
  lastDone = null; // a new job supersedes the last one's banner
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
    const said = `
        Written <b>${esc(done.title)}</b> — ${done.questionCount} questions across
        ${done.rounds} round${done.rounds === 1 ? '' : 's'}.
        <br>Checked over — ${done.rejected} question${done.rejected === 1 ? '' : 's'} thrown out and replaced.
        ${(done.unchecked || []).length
          ? `<br><b>Round${done.unchecked.length === 1 ? '' : 's'} ${done.unchecked.join(', ')} could NOT be checked</b> — the second pass was unreachable. Read ${done.unchecked.length === 1 ? 'that round' : 'those rounds'} line by line.`
          : ''}
        ${done.backedUp ? '<br>Backed up to GitHub — this one is permanent.' : '<br><b>Not backed up</b> — this will be lost when the app restarts.'}
        <br><b>Now read it.</b> <a href="${linkTo('/editor')}">Open the editor</a> and
        check every question before anyone else sees it.
        ${done.needsImages ? '<br><span class="tiny">The face round has no pictures yet — it will use placeholders until you generate them. See TODO.md part 6.</span>' : ''}`;
    status.appendChild(node(`<div class="gen-good">${said}</div>`));
    // A quiz has no song history, so backup is the only thing that can be amiss.
    showDone(done.backedUp && !(done.unchecked || []).length ? 'good' : 'warn', said);
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
      if (!line || line === 'PING') continue;   // keep-alive, nothing to show
      if (line.startsWith('DONE ')) done = JSON.parse(line.slice(5));
      else if (line.startsWith('ERROR ')) error = line.slice(6);
      else say(line);
    }
  }

  // Neither a result nor a reason means the connection went away mid-job. The
  // server carries on regardless, so say that rather than leaving somebody
  // thinking it failed — and never hand a null back to the caller, which is
  // how this first showed up: "Cannot read properties of null".
  if (!done && !error) {
    error = 'The connection dropped before it finished. It may still have completed — reload and look at your packs before running it again.';
  }
  return { done, error };
}

/**
 * Whether the no-repeats list actually made it to GitHub.
 *
 * Said separately from the pack's own backup, because they can differ and when
 * they do it is this one that bites. Claude in the browser reads the PUSHED
 * history to decide what not to pick, so a history that only made it as far as
 * this server means next week's round can hand the room the same songs — and
 * nothing about the pack you are looking at would suggest anything was wrong.
 */
function historyLine(done) {
  if (done.historyBackedUp) {
    return '<br>These songs are now in the no-repeats list on GitHub, so the next round will avoid them.';
  }
  return `<br><b>These songs did NOT reach the no-repeats list on GitHub.</b>
    They are recorded here, but anything reading the list from GitHub — Claude in your
    browser — will not see them, and could pick them again. Import it again once backup is working.`;
}

/**
 * Bring in a list you already have.
 *
 * This is how a bingo round gets made now: Claude in a browser reads the
 * no-repeats list off this repository, picks the songs, builds the Spotify
 * playlist, and prints the tracks. This box is where they land.
 *
 * The paste box is open and first because it is the route, not the fallback.
 * It was behind a "or paste a track list instead" fold, from when a Spotify
 * playlist link was the main way in — and a panel that hides the thing you
 * came to do is a panel you use wrong.
 */
function importPanel(gen) {
  const el = node(`
    <div class="panel import">
      <h3>Or bring in a list you already have</h3>
      <div class="tiny">Paste what Claude printed — one track per line. It goes into the no-repeats list too, so next week's round avoids it.</div>
      <textarea id="impText" rows="7" placeholder="One per line — any of these work:&#10;&#10;Billie Jean — Michael Jackson&#10;1. Take On Me - a-ha&#10;Blue Monday by New Order"></textarea>
      <div class="gen-row">
        <input type="text" id="impUrl" placeholder="…or a Spotify playlist link instead" autocomplete="off">
        <button class="go" id="impGo">Import</button>
      </div>
      <div class="gen-opts">
        <label>Card <select id="impSize"><option value="3">3×3</option><option value="4" selected>4×4</option><option value="5">5×5</option></select></label>
        <label>Call it <input type="text" id="impTitle" placeholder="optional" style="width:150px"></label>
        <label title="Off by default — you probably built this list on purpose."><input type="checkbox" id="impAvoid"> Skip songs played recently</label>
        <span class="tiny" id="impFit"></span>
      </div>
      <div class="gen-status" id="impStatus"></div>
      ${gen.spotify ? '' : '<div class="tiny warn">Spotify is not set up, so playlist links will not work — paste a list instead.</div>'}
    </div>`);

  el.querySelector('#impGo').addEventListener('click', () => runImport(el));
  el.querySelector('#impUrl').addEventListener('keydown', (e) => { if (e.key === 'Enter') runImport(el); });
  fitCardSize(el);
  return el;
}

/**
 * Size the card from the list you just pasted.
 *
 * A round of 42 is a 5x5 round, and pasting one into a box that always said
 * 4x4 quietly made it a 4x4 — sixteen squares out of forty-two songs, so a
 * line lands early and most of the round never reaches anybody's card. It was
 * a dropdown you had to know to change, defaulting to the wrong answer for the
 * list in front of it.
 *
 * So it moves itself to the biggest card the list will carry, and says what it
 * did. Biggest rather than smallest because more squares is a longer game, and
 * a list of that size was written for a longer game.
 *
 * It stops adjusting the moment you touch the dropdown yourself. A control
 * that overrules you is worse than one that never helped.
 */
function fitCardSize(panel) {
  const text = panel.querySelector('#impText');
  const select = panel.querySelector('#impSize');
  const note = panel.querySelector('#impFit');
  // Straight from minimumTracks() on the server, so this cannot drift from the
  // rule the import will actually apply.
  const sizes = (library && library.cardSizes) || [];
  if (!sizes.length) return;

  let yours = false;
  select.addEventListener('change', () => { yours = true; note.textContent = ''; });

  const paint = () => {
    const count = text.value.split('\n').filter((l) => l.trim()).length;
    if (!count) { note.textContent = ''; return; }

    const fits = sizes.filter((s) => count >= s.minimum);
    if (!fits.length) {
      const smallest = sizes[0];
      note.innerHTML = `<b>${count} tracks — too few.</b> The smallest card (${smallest.size}×${smallest.size}) needs ${smallest.minimum}.`;
      return;
    }
    const best = fits[fits.length - 1];
    if (!yours) select.value = String(best.size);
    const named = fits.map((s) => `${s.size}×${s.size}`);
    const listed = named.length === 1 ? named[0] : `${named.slice(0, -1).join(', ')} or ${named[named.length - 1]}`;
    note.textContent = yours
      ? `${count} tracks — ${listed} would work.`
      : `${count} tracks, so a ${best.size}×${best.size} card. Change it if you would rather.`;
  };

  text.addEventListener('input', paint);
  // Pasting fires input on every browser worth worrying about, but a paste
  // handler runs before the value lands, so this one waits a tick.
  text.addEventListener('paste', () => setTimeout(paint, 0));
  paint();
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
  lastDone = null; // a new job supersedes the last one's banner
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

    // Said here AND in the banner: here while you are still looking at the
    // panel, and in the banner because load() below rebuilds this panel and
    // would otherwise take the only word you got with it.
    const said = `Imported <b>${esc(done.title)}</b> — ${done.trackCount} tracks.
      ${done.backedUp ? 'Backed up to GitHub — this one is permanent.' : '<b>Not backed up</b>, so it will be lost when the app restarts.'}
      ${historyLine(done)}`;
    status.appendChild(node(`<div class="gen-good">${said}</div>`));
    button.textContent = 'Imported';
    // Amber rather than green when something in it is a warning. A green box
    // you have to read to the end to discover a problem is a box you stop
    // reading to the end of.
    showDone(done.backedUp && done.historyBackedUp ? 'good' : 'warn', said);
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
  lastDone = null; // a new job supersedes the last one's banner
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
        if (!line || line === 'PING') continue;   // keep-alive, nothing to show
        if (line.startsWith('DONE ')) done = JSON.parse(line.slice(5));
        else if (line.startsWith('ERROR ')) failed = line.slice(6);
        else say(line);
      }
    }

    if (!done && !failed) {
      failed = 'The connection dropped before it finished. It may still have completed — reload and look at your packs before running it again.';
    }
    if (failed) {
      say('');
      status.appendChild(node(`<div class="gen-bad">${esc(failed)}</div>`));
      button.disabled = false;
      button.textContent = 'Build it';
      return;
    }

    const said = `
        Built <b>${esc(done.title)}</b> — ${done.trackCount} tracks.
        ${done.playlist
          ? `<a href="${esc(done.playlist)}" target="_blank" rel="noopener">Open the Spotify playlist</a>`
          : done.playlistError
            ? `<br><b>No Spotify playlist:</b> ${esc(done.playlistError)}<br>The pack itself is fine — build the playlist by hand from the call sheet.`
            : 'No Spotify playlist — build one yourself from the call sheet.'}
        ${done.backedUp ? '<br>Backed up to GitHub — this one is permanent.' : '<br><b>Not backed up</b> — this will be lost when the app restarts.'}
        ${historyLine(done)}`;
    status.appendChild(node(`<div class="gen-good">${said}</div>`));
    showDone(done.backedUp && done.historyBackedUp ? 'good' : 'warn', said);
    button.textContent = 'Built';
    await load(); // refresh the library so the new pack is there to launch
  } catch (err) {
    status.appendChild(node(`<div class="gen-bad">${esc(err.message)}</div>`));
    button.disabled = false;
    button.textContent = 'Build it';
  }
}

/**
 * What is on the projector right now, and the two things you might want to do
 * about it: drive it, or stop it.
 *
 * "Control view" used to be a small grey link between "Big screen" and "Stop",
 * which reads as a footnote rather than as the way you run the night. It is the
 * one button on this panel that does the actual job, so it looks like it —
 * everything else on the panel is a link or a warning.
 *
 * The line underneath says where the game has got to, from the engine itself,
 * because "a quiz is running" and "they are twelve seconds into round 2
 * question 4" are very different things to walk in on.
 */
function runningPanel(running) {
  if (!running) return node('<div></div>');
  const live = running.phase !== 'lobby' && running.phase !== 'finished';
  const what = running.game === 'bingo' ? 'Music bingo' : 'Music quiz';
  const who = `${running.playerCount} playing`;
  const el = node(`
    <div class="panel running ${live ? 'live' : ''}">
      <h3>${live ? 'Running now' : 'Loaded and waiting'}</h3>
      <div class="running-row">
        <div>
          <div class="running-title">${esc(running.title)}</div>
          <div class="tiny">${esc(what)} — ${who}</div>
          ${running.at ? `<div class="running-at">${esc(running.at)}</div>` : ''}
        </div>
        <div class="running-links">
          <a class="go control-link" href="${linkTo('/host')}">${live ? 'Take control' : 'Open the controls'}</a>
          <a class="minor" href="/screen" target="_blank" rel="noopener">Big screen</a>
          ${running.finished ? '<button class="minor invoice-it" title="Bill for this one">Invoice this</button>' : ''}
          <button class="minor danger stop-running" title="Clear it and go back to waiting">Stop</button>
        </div>
      </div>
    </div>`);

  /*
   * Bill for the night that has just finished, from where you already are.
   *
   * It appears only once a game has actually ended, and it fills the venue and
   * the date in from the night itself — so the usual case is picking the
   * customer, checking a number you already agreed weeks ago, and pressing
   * send. This is the whole point of the feature: at half eleven, an invoice
   * that needs ten minutes of typing is an invoice that gets sent on Sunday, or
   * not at all.
   */
  el.querySelector('.invoice-it')?.addEventListener('click', async () => {
    try {
      book = await invoiceApi('/api/invoices');
    } catch (err) {
      alert('Could not open the invoices: ' + err.message);
      return;
    }
    openInvoiceForm({
      event: { title: running.game === 'bingo' ? 'Music bingo night' : 'Music quiz night', date: new Date().toISOString().slice(0, 10) },
      description: running.game === 'bingo' ? 'Music bingo night' : 'Music quiz night',
    }, () => load());
  });

  /*
   * Stop whatever is running, from here.
   *
   * The control view can end a game, but you have to know that and go there.
   * From the console the only way out was to launch something else over the
   * top of it, which is a odd way to say "I am finished with this one".
   *
   * It clears scores, cards and players and leaves the pack loaded and
   * waiting — the same state as just after a launch. Nothing is deleted.
   */
  el.querySelector('.stop-running')?.addEventListener('click', async () => {
    const n = running.playerCount;
    const alsoKicks = n
      ? `\n\n${n} ${n === 1 ? 'phone is' : 'phones are'} in, and will have to scan and join again.`
      : '';
    if (!confirm(`Stop "${running.title}"?\n\nScores and cards are cleared and it goes back to waiting.${alsoKicks}`)) return;

    const button = el.querySelector('.stop-running');
    button.disabled = true;
    button.textContent = 'Stopping…';
    try {
      await postJson('/api/host/resetAll', {}, { 'X-Host-Key': hostKey });
      await load();
    } catch (err) {
      alert(`Could not stop it: ${err.message}`);
      button.disabled = false;
      button.textContent = 'Stop';
    }
  });

  return el;
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

/**
 * The card shapes this pack has enough tracks for, ready to launch with.
 *
 * The shape belongs to the NIGHT, not to the pack: the same forty-two songs are
 * a quick game on a 3x3 and a long one on a strip, and which you want depends
 * on how much of the evening is left — something you know when you press
 * Launch, not when you filed the songs weeks ago. So it is chosen here, and
 * never written back to the file.
 *
 * Shapes the list cannot fill are left out rather than shown and refused.
 */
function shapeOptions(pack) {
  const shapes = (library && library.cardShapes) || [];
  const fits = shapes.filter((s) => pack.trackCount >= s.minimum);
  const usable = fits.length ? fits : shapes.slice(0, 1);
  // The pack's own shape is the default, if it is one of the ones on offer.
  const own = usable.find((s) => s.rows === pack.cardRows && s.cols === pack.cardCols)
    || usable.find((s) => s.rows === s.cols && s.rows === pack.cardSize)
    || usable[usable.length - 1];
  // "line of 8" is the number that actually decides how long the game runs —
  // on a square it is the side, on a strip it is the long way.
  return usable.map((s) => `<option value='{"rows":${s.rows},"cols":${s.cols}}' ${s === own ? 'selected' : ''}>${esc(s.label)} — line of ${Math.max(s.rows, s.cols)}</option>`).join('');
}

function packCard(kind, pack) {
  const detail = kind === 'quiz'
    ? `${pack.questionCount} questions · ${(pack.rounds || []).length} rounds`
    : `${pack.trackCount} tracks`;

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
      ${kind === 'bingo' && !pack.broken ? `
        <label class="pack-shape">Cards
          <select class="shape-pick">${shapeOptions(pack)}</select>
        </label>
        <label class="pack-shape">Prizes
          <select class="prize-pick"></select>
        </label>` : ''}
      <div class="pack-actions">
        <button class="pack-read" title="Read it through">Read</button>
        <button class="pack-rename" ${pack.broken ? 'disabled' : ''} title="Change what it is called">Rename</button>
        ${pack.playlist ? `<a class="pack-spotify" href="${esc(pack.playlist)}" target="_blank" rel="noopener" title="Open it in Spotify">Playlist</a>` : ''}
        ${hasPictureRound(pack) ? '<button class="pack-pics" title="Make the round 2 portraits">Pictures</button>' : ''}
        ${hasIntroRound(pack) ? '<button class="pack-playlist" title="Build the Spotify playlist for the intro round">Playlist</button>' : ''}
        <button class="pack-del" title="Delete this pack">Delete</button>
      </div>
      <button class="go launch" ${pack.broken ? 'disabled' : ''}>Launch</button>
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

  /*
   * How many prizes, and what each one is.
   *
   * It depends on the card: a 3-across strip has only three lines, so two line
   * prizes and a full house is all it can carry, and offering four would be
   * offering one nobody could win. So the list is rebuilt whenever the shape
   * changes rather than written out once.
   */
  const shapePick = el.querySelector('.shape-pick');
  const prizePick = el.querySelector('.prize-pick');
  const paintPrizes = () => {
    if (!shapePick || !prizePick) return;
    const chosen = JSON.parse(shapePick.value);
    const shapes = (library && library.cardShapes) || [];
    const found = shapes.find((s) => s.rows === chosen.rows && s.cols === chosen.cols);
    if (!found) return;
    const wanted = Number(prizePick.value) || 2;
    prizePick.innerHTML = found.plans.map((plan, i) => {
      const n = i + 1;
      return `<option value="${n}" ${n === Math.min(wanted, found.maxPrizes) ? 'selected' : ''}>${n} — ${esc(plan.join(', then '))}</option>`;
    }).join('');
  };
  shapePick?.addEventListener('change', paintPrizes);
  paintPrizes();

  /*
   * Rename without opening the pack.
   *
   * The title is the only thing you ever want to change from out here — a pack
   * called "1980s Music Bingo" is fine until the night you run two of them.
   *
   * The id is deliberately left alone. It is what the play counts, the song
   * history and the backup file are all keyed on, so renaming the file to
   * match would quietly orphan all three. What the pack is called and what it
   * is filed under are different things.
   */
  el.querySelector('.pack-rename')?.addEventListener('click', async () => {
    const answer = prompt('What should this be called?', pack.title);
    if (answer === null) return;
    const title = answer.trim();
    if (!title || title === pack.title) return;

    const button = el.querySelector('.pack-rename');
    button.disabled = true;
    button.textContent = 'Saving…';
    try {
      const url = keyed(`/api/${kind}/` + encodeURIComponent(pack.id));
      const res = await fetch(url, { headers: { 'X-Host-Key': hostKey } });
      if (!res.ok) throw new Error('Could not read that pack');
      const full = await res.json();
      delete full.reviewWarnings;   // added by the server when reading, not part of the pack
      full.title = title;

      const saved = await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'X-Host-Key': hostKey },
        body: JSON.stringify(full),
      });
      const data = await saved.json().catch(() => ({}));
      if (!saved.ok) throw new Error((data.problems || []).join('; ') || data.error || 'Could not save it');
      await load();
    } catch (err) {
      alert(`Could not rename it: ${err.message}`);
      button.disabled = false;
      button.textContent = 'Rename';
    }
  });

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
      const who = `${joined} ${joined === 1 ? 'person' : 'people'}`;
      const doing = running.phase === 'lobby'
        ? `${who} ${joined === 1 ? 'has' : 'have'} already joined "${running.title}"`
        : `"${running.title}" is still running with ${who} in`;
      if (!confirm(`${doing}.\n\nLaunching this will remove them and they will have to scan and join again. Carry on?`)) return;
    }
    const button = el.querySelector('.launch');
    button.disabled = true;
    button.textContent = 'Launching…';
    try {
      const picked = el.querySelector('.shape-pick');
      const shape = picked ? JSON.parse(picked.value) : null;
      const prizes = Number(el.querySelector('.prize-pick')?.value) || 0;
      await postJson('/api/host/launch', { game: kind, packId: pack.id, shape, prizes }, { 'X-Host-Key': hostKey });
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
  // Redrawn rather than left as it was after a save, so the summary line at the
  // top stops saying "press Save" once you have. Keeping the scroll matters:
  // this is a list you read down, and being thrown back to the top after
  // renaming a round in the middle of it is the sort of small rudeness that
  // makes you stop using a panel.
  const drawPreview = () => {
    const y = body.scrollTop;
    if (kind === 'bingo') renderBingoPreview(body, sub, loaded, markDirty);
    else renderQuizPreview(body, sub, loaded, markDirty);
    body.scrollTop = y;
  };
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
      drawPreview();
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
    drawPreview();
  } catch (err) {
    sub.textContent = '';
    body.replaceChildren(node(`<div class="tiny" style="color:var(--bad)">${esc(err.message)}</div>`));
  }
}

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];
const ROUND_LABELS = {
  text: 'General knowledge',
  image: 'Whose face is this?',
  intro: 'Name that intro',
  multi: 'Pick them all',
  alphabet: 'First letter only',
};
const REVEAL_LABELS = {
  zoom: 'zooms out',
  pixelate: 'pixelates',
  blur: 'comes into focus',
  tiles: 'tiles come away',
  mix: 'a different effect each question',
};

/** The letter an alphabet answer turns on. Mirrors answerLetter in src/quizzes.js. */
function firstLetter(answer) {
  const found = String(answer || '').trim().match(/[a-z]/i);
  return found ? found[0].toUpperCase() : '';
}

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
  // A first-letter question has no options and no letter to lean on, so it is
  // left out of this entirely — counted in, it would water the lean down and
  // stop a genuinely lopsided pack being flagged.
  const lettered = all.filter((q) => (q.options || []).length);
  // Long enough for the widest round in the pack: four for most, six for a
  // pick-them-all round.
  const spread = new Array(Math.max(4, ...lettered.map((q) => q.options.length))).fill(0);
  // A pick-them-all question has several right answers, so it contributes to
  // several slots — otherwise the "answers land A x3 B x1" line would treat
  // one of them as the answer and call the round lopsided when it is not.
  for (const q of lettered) {
    const right = q.correctIndexes && q.correctIndexes.length ? q.correctIndexes : [q.correctIndex];
    for (const i of right) if (spread[i] !== undefined) spread[i]++;
  }
  // Four is the fewest that can lean; below that "A x1 B x0 — lopsided" is
  // just arithmetic being rude about a question that has to be somewhere.
  const lopsided = lettered.length >= 4 && spread.some((n) => n > lettered.length * 0.5);
  const noNotes = all.filter((q) => !q.answerNote).length;

  sub.innerHTML = `${all.length} questions across ${quiz.rounds.length} round${quiz.rounds.length === 1 ? '' : 's'}
    ${lettered.length ? `· answers land ${spread.map((n, i) => `${LETTERS[i]}&times;${n}`).join(' ')}` : ''}
    ${lopsided ? '<b style="color:var(--gold)"> — lopsided</b>' : ''}
    ${noNotes ? ` · ${noNotes} with no fact to read out` : ''}`;
  sub.appendChild(evenerButton(body, sub, quiz, markDirty, lopsided));

  const parts = [];

  // The questions most likely to cause an argument, listed first so they are
  // the ones you actually look at.
  // Real errors first: these stop the quiz being played and stop the editor
  // saving, so they come above the hunches and read differently. Without this
  // the only sign was an alert saying "Quiz is not valid" with no clue which
  // question was at fault.
  const problems = quiz.problems || [];
  if (problems.length) {
    parts.push(node(`
      <div class="pv-warn pv-broken">
        <b class="pv-warn-head">${problems.length} thing${problems.length === 1 ? '' : 's'} to fix before this can be played</b>
        <ul class="pv-flags">
          ${problems.map((p) => `<li class="pv-flag"><span class="pv-flag-text">${esc(p)}</span></li>`).join('')}
        </ul>
        <div class="tiny" style="margin-top:8px">Fix ${problems.length === 1 ? 'this' : 'these'} in the editor. Ticking the notes below still works meanwhile.</div>
      </div>`));
  }

  const warnings = quiz.reviewWarnings || [];
  if (warnings.length) parts.push(warningPanel(quiz, warnings));
  for (const round of quiz.rounds) {
    const head = node(`
      <div class="pv-round">
        <div class="pv-round-head">
          <input class="pv-round-name" value="${esc(round.title)}" title="Click to rename this round">
          <span class="tiny">${esc(ROUND_LABELS[round.type] || round.type)}${
            // Which effect the pictures use, because it is set in the editor
            // and there is otherwise nowhere that says so at a glance.
            round.type === 'image' ? ` · ${esc(REVEAL_LABELS[round.reveal || 'zoom'] || round.reveal)}` : ''}</span>
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
            ${round.type === 'alphabet'
              // No options to read through — the whole answer key is the answer
              // and the letter it turns on, so show exactly that.
              ? `<div class="pv-opt right"><span class="pv-letter">${esc(firstLetter(q.answer) || '?')}</span>${esc(q.answer || '')}</div>`
              : (q.options || []).map((o, oi) => `
                  <div class="pv-opt ${(q.correctIndexes && q.correctIndexes.length ? q.correctIndexes : [q.correctIndex]).includes(oi) ? 'right' : ''}">
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

/**
 * The button that does something about a lopsided quiz.
 *
 * The read-through has always said "answers land A x15 B x10 — lopsided" and
 * then left you looking at it: the only way to move an answer was to open the
 * editor and retype four options in a different order, twenty times.
 *
 * It rearranges here and leaves Save lit rather than writing straight away, so
 * you can look at what it did, press it again if you do not like the look of
 * it, and close without saving if you would rather it had not.
 *
 * NOT while that quiz is live in front of a room. Saving a quiz reloads it in
 * the running game, so this would swap the options under sixty people who are
 * mid-question — the answer would still be right, but on a different letter to
 * the one on the projector when they read it. It is offered again the moment
 * the game is over.
 */
function evenerButton(body, sub, quiz, markDirty, lopsided) {
  const running = (library && library.running) || null;
  const live = running && running.game === 'quiz' && running.packId === quiz.id
    && running.phase !== 'lobby' && running.phase !== 'finished';

  if (live) {
    return node('<span class="pv-even off" title="Saving a quiz reloads it in the running game">Even out the answers — not while this one is live</span>');
  }

  const button = node(`<button class="pv-even ${lopsided ? 'urge' : ''}" type="button">Even out the answers</button>`);
  button.addEventListener('click', () => {
    const moved = balanceAnswers(quiz);
    if (!moved) {
      button.textContent = 'Nothing to move';
      return;
    }
    markDirty();
    renderQuizPreview(body, sub, quiz, markDirty);
    // Say what happened where the eye already is — the spread line one line up
    // has just changed, and this explains why.
    const again = sub.querySelector('.pv-even');
    if (again) again.textContent = `Moved ${moved} — press Save`;
  });
  return button;
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
        <span class="tiny">${night.playerCount} playing</span>
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

/* ================================================================= ADVERTS
 *
 * Slides for between rounds. This is a revenue feature, not decoration: the
 * host sells himself to venues on shifting their pizzas and their gig tickets,
 * so a set belongs to a VENUE and gets reused every week rather than being
 * written fresh each night.
 *
 * Kept deliberately plain — a heading, a line of words, an optional QR — because
 * a slide has to be readable from the back of a pub in three seconds, and
 * because he will be typing these in between other jobs.
 */
function advertsSection(sets) {
  const el = node(`
    <div class="game-section">
      <div class="game-head">
        <div>
          <h2>Advert slides</h2>
          <div class="tiny">One set per venue. Put one up from your control view, between rounds.</div>
        </div>
        <button class="go new-set">New set</button>
      </div>
      <div class="pack-grid"></div>
    </div>`);

  el.querySelector('.new-set').addEventListener('click', () => editAdvertSet(null));

  const grid = el.querySelector('.pack-grid');
  if (!sets.length) {
    grid.appendChild(node(`
      <div class="tiny">Nothing yet. A set might be "The Crown" with a slide for the
      Tuesday pizza deal and one for the band on the 28th, with a QR to tickets.</div>`));
    return el;
  }

  for (const set of sets) {
    const card = node(`
      <div class="pack-card ${set.broken ? 'broken' : ''}">
        <button class="pack-title">${esc(set.title)}</button>
        <div class="tiny">${esc(set.venue || 'No venue set')}</div>
        <div class="tiny played">${set.slideCount} slide${set.slideCount === 1 ? '' : 's'}</div>
        ${set.broken ? `<div class="tiny" style="color:var(--bad)">Broken: ${esc(set.broken)}</div>` : ''}
        <div class="pack-actions">
          <button class="go edit">Edit</button>
          <button class="pack-del">Delete</button>
        </div>
      </div>`);
    const open = () => editAdvertSet(set.id);
    card.querySelector('.pack-title').addEventListener('click', open);
    card.querySelector('.edit').addEventListener('click', open);
    card.querySelector('.pack-del').addEventListener('click', async () => {
      if (!confirm(`Delete "${set.title}" and its ${set.slideCount} slide${set.slideCount === 1 ? '' : 's'}?`)) return;
      await fetch(keyed('/api/advert/' + encodeURIComponent(set.id)), {
        method: 'DELETE', headers: { 'X-Host-Key': hostKey },
      });
      await load();
    });
    grid.appendChild(card);
  }
  return el;
}

function editAdvertSet(id) {
  const overlay = node(`
    <div class="sheet-overlay">
      <div class="sheet">
        <div class="sheet-head">
          <div>
            <input class="sheet-title" id="adTitle" placeholder="What to call this set">
            <input class="tiny ad-venue-in" id="adVenue" placeholder="Venue — e.g. The Crown, Chelmsford">
          </div>
          <div class="row">
            <button class="go" id="adSave">Save</button>
            <button class="minor" id="adClose">Close</button>
          </div>
        </div>
        <div class="sheet-body" id="adBody"></div>
      </div>
    </div>`);
  document.body.appendChild(overlay);

  const body = overlay.querySelector('#adBody');
  const close = () => overlay.remove();
  overlay.querySelector('#adClose').addEventListener('click', close);

  let pack = { id: '', title: '', venue: '', slides: [] };

  const draw = () => {
    overlay.querySelector('#adTitle').value = pack.title;
    overlay.querySelector('#adVenue').value = pack.venue;
    const parts = pack.slides.map((slide, i) => slideEditor(slide, i, pack, draw));
    const add = node('<button class="minor" style="margin-top:12px">Add a slide</button>');
    add.addEventListener('click', () => {
      pack.slides.push({ id: 's' + (pack.slides.length + 1), heading: '', body: '', say: '' });
      draw();
    });
    parts.push(add);
    body.replaceChildren(...parts);
  };

  overlay.querySelector('#adTitle').addEventListener('input', (e) => { pack.title = e.target.value; });
  overlay.querySelector('#adVenue').addEventListener('input', (e) => { pack.venue = e.target.value; });

  overlay.querySelector('#adSave').addEventListener('click', async () => {
    const btn = overlay.querySelector('#adSave');
    btn.disabled = true;
    btn.textContent = 'Saving…';
    // A new set gets its filename from the venue, or the title if there is no
    // venue — the same way a quiz is named after its theme.
    const slug = (pack.id || pack.venue || pack.title || 'adverts')
      .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'adverts';
    try {
      const res = await fetch(keyed('/api/advert/' + encodeURIComponent(slug)), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'X-Host-Key': hostKey },
        body: JSON.stringify({ ...pack, id: slug }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data.problems || [data.error]).join('\n'));
      close();
      await load();
    } catch (err) {
      alert(err.message);
      btn.disabled = false;
      btn.textContent = 'Save';
    }
  });

  if (!id) { pack.title = 'New advert set'; draw(); return; }
  fetch(keyed('/api/advert/' + encodeURIComponent(id)))
    .then((r) => r.json())
    .then((loaded) => { pack = loaded; draw(); })
    .catch(() => { body.replaceChildren(node('<div class="tiny">Could not open it.</div>')); });
}

function slideEditor(slide, i, pack, redraw) {
  const el = node(`
    <div class="ad-slide">
      <div class="ad-slide-head">
        <b>Slide ${i + 1}</b>
        <button class="minor danger small ad-del">Delete</button>
      </div>
      <label class="tiny">On the screen, big</label>
      <input class="ad-h" maxlength="60" placeholder="PIZZA — 2 FOR 1 TONIGHT" value="${esc(slide.heading || '')}">
      <label class="tiny">Underneath, smaller</label>
      <input class="ad-b" maxlength="160" placeholder="Kitchen open till 10. Ask at the bar." value="${esc(slide.body || '')}">
      <label class="tiny">A link to put a QR code on the slide — tickets, a booking page</label>
      <input class="ad-l" placeholder="https://..." value="${esc(slide.link || '')}">
      <input class="ad-ll" maxlength="40" placeholder="What the QR is for — e.g. Tickets for the 28th" value="${esc(slide.linkLabel || '')}">
      <label class="tiny">Your line for the mic — never goes on the screen</label>
      <input class="ad-say" maxlength="160" placeholder="Mention the pizza deal while this is up" value="${esc(slide.say || '')}">
    </div>`);

  const bind = (sel, key) => el.querySelector(sel).addEventListener('input', (e) => { slide[key] = e.target.value; });
  bind('.ad-h', 'heading');
  bind('.ad-b', 'body');
  bind('.ad-l', 'link');
  bind('.ad-ll', 'linkLabel');
  bind('.ad-say', 'say');

  el.querySelector('.ad-del').addEventListener('click', () => {
    pack.slides.splice(i, 1);
    redraw();
  });
  return el;
}

/* ================================================================== PHOTOS
 *
 * Everything the room sent, foldered by night.
 *
 * The job this does is the one KaraFun does badly: getting a night's photos
 * from where they were taken to Instagram without them sitting in an inbox.
 * So the two things it has to do well are BIN a dud and SHARE a good one, and
 * both are one tap.
 *
 * Sharing uses the browser's own share sheet, which on a phone puts Instagram
 * in the list directly — nothing has to go via the camera roll. On a laptop
 * there is no share sheet, so it falls back to a download.
 */
function photosSection() {
  const el = node(`
    <div class="game-section">
      <div class="game-head">
        <div>
          <h2>Photos</h2>
          <div class="tiny status">Loading…</div>
        </div>
        <div class="row">
          <button class="minor file-rest" hidden>File the rest away</button>
          <button class="minor danger clear-all" hidden>Clear all</button>
        </div>
      </div>
      <div class="nights"></div>
    </div>`);

  const status = el.querySelector('.status');
  const nightsEl = el.querySelector('.nights');
  const fileBtn = el.querySelector('.file-rest');
  const clearBtn = el.querySelector('.clear-all');

  const refresh = async () => {
    let data;
    try {
      const res = await fetch(keyed('/api/photos/list'));
      data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not load them');
    } catch (err) {
      status.textContent = err.message;
      return;
    }

    // The one thing worth being loud about: on the free tier the server's disk
    // is wiped on every restart, so an unfiled photo is one restart from gone.
    if (!data.repoReady || data.repoProblem) {
      // Say which variable, not just that something is wrong. On a host whose
      // settings page has a project level and a service level that look the
      // same, "I set it" and "the app can see it" are different things.
      const seen = data.seen || {};
      const detail = data.repoProblem
        ? `<b style="color:var(--bad)">${esc(data.repoProblem)}</b>`
        : `The app cannot see <b>${esc((data.missing || []).join(' or '))}</b>.`;
      status.innerHTML = `<b style="color:var(--gold)">These are temporary.</b> ${detail}
        <br><span class="tiny">What this app can actually see right now:
        PHOTO_REPO ${seen.PHOTO_REPO ? '✓ set' : '✗ not set'} ·
        PHOTO_TOKEN ${seen.PHOTO_TOKEN ? '✓ set' : '✗ not set'} ·
        GITHUB_TOKEN ${seen.GITHUB_TOKEN ? '✓ set' : '✗ not set'} ·
        branch ${esc(String(seen.PHOTO_BRANCH || ''))}.
        Set them on the <b>service</b> page (/web/srv-…), not the project page —
        see TODO.md part 7f.</span>`;
    } else if (data.unfiled) {
      status.innerHTML = `${data.count} photo${data.count === 1 ? '' : 's'} ·
        <b style="color:var(--gold)">${data.unfiled} not filed away yet</b> ·
        going to ${esc(data.repo)}`;
    } else if (!data.count) {
      // "0 photos, all filed" is true and says nothing. Before the first one
      // arrives, what you want to know is that it is pointed at the right
      // place and working.
      status.innerHTML = `<b style="color:var(--good)">Ready.</b>
        Photos will be filed to ${esc(data.repo)} as they arrive.`;
    } else {
      status.innerHTML = `${data.count} photo${data.count === 1 ? '' : 's'} ·
        <b style="color:var(--good)">all filed to ${esc(data.repo)}</b>`;
    }

    fileBtn.hidden = !(data.repoReady && data.unfiled);
    clearBtn.hidden = !data.count;

    if (!data.count) {
      nightsEl.replaceChildren(node('<div class="tiny">Nothing yet. They arrive as the room sends them.</div>'));
      return;
    }
    nightsEl.replaceChildren(...data.nights.map((n) => nightBlock(n, refresh)));
  };

  fileBtn.addEventListener('click', async () => {
    fileBtn.disabled = true;
    fileBtn.textContent = 'Filing…';
    const res = await postJson('/api/host/photosFile', {}, { 'X-Host-Key': hostKey }).catch(() => ({}));
    fileBtn.disabled = false;
    fileBtn.textContent = 'File the rest away';
    if (res.failed) alert(`${res.filed} filed, ${res.failed} could not be. Check the token can write to the photo repo.`);
    refresh();
  });

  clearBtn.addEventListener('click', async () => {
    if (!confirm('Delete every photo from this server?\n\nOnes already filed away stay in the repository.')) return;
    await postJson('/api/host/photosClear', {}, { 'X-Host-Key': hostKey }).catch(() => {});
    refresh();
  });

  refresh();
  return el;
}

function nightBlock(night, refresh) {
  const when = new Date(night.night + 'T12:00:00');
  const label = when.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
  const el = node(`
    <div class="night">
      <div class="night-head">
        <h3>${esc(label)}</h3>
        <span class="tiny">${night.photos.length} photo${night.photos.length === 1 ? '' : 's'}</span>
        <button class="minor share-night">Share the lot</button>
      </div>
      <div class="night-grid"></div>
    </div>`);

  const grid = el.querySelector('.night-grid');
  for (const p of night.photos) {
    const fig = node(`
      <figure class="cphoto ${p.filed ? 'filed' : ''}">
        <img src="${esc(p.url)}" alt="" loading="lazy">
        <figcaption>${esc(p.teamName || '')}</figcaption>
        <div class="cphoto-acts">
          <button class="share" title="Share this one">Share</button>
          <button class="bin" title="Delete it">${binIcon(15)} Bin</button>
        </div>
      </figure>`);

    fig.querySelector('.share').addEventListener('click', () => sharePhotos([p]));
    fig.querySelector('.bin').addEventListener('click', async () => {
      if (!confirm(`Bin this photo${p.teamName ? ` from ${p.teamName}` : ''}?`)) return;
      await postJson('/api/host/photoRemove', { id: p.id }, { 'X-Host-Key': hostKey }).catch(() => {});
      refresh();
    });
    grid.appendChild(fig);
  }

  el.querySelector('.share-night').addEventListener('click', () => sharePhotos(night.photos));
  return el;
}

/**
 * Hand photos to the phone's own share sheet, where Instagram is waiting.
 *
 * This is the whole point of the tab: no inbox, no camera roll, no laptop.
 * Falls back to downloading on anything without a share sheet, which is every
 * desktop browser.
 */
async function sharePhotos(list) {
  const files = [];
  for (const p of list) {
    try {
      const res = await fetch(p.url);
      const blob = await res.blob();
      files.push(new File([blob], p.file || `${p.id}.jpg`, { type: blob.type || 'image/jpeg' }));
    } catch {
      /* skip one that will not load rather than failing the lot */
    }
  }
  if (!files.length) return alert('Could not read those photos.');

  if (navigator.canShare && navigator.canShare({ files })) {
    try {
      await navigator.share({ files, title: 'Quiz night' });
      return;
    } catch (err) {
      if (err.name === 'AbortError') return; // they changed their mind
    }
  }

  // No share sheet — download instead, which is what a laptop wants anyway.
  for (const file of files) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(file);
    a.download = file.name;
    a.click();
    URL.revokeObjectURL(a.href);
  }
}

/* ==========================================================================
 * Invoicing.
 *
 * The night ends, the room empties, and the thing most likely not to happen is
 * the invoice — because by then it is half eleven and everything is in the car.
 * So this sits one tap from the end of a game and fills itself in.
 *
 * Sending it is deliberately the phone's own share sheet rather than the app
 * emailing it: it goes out from your address, so replies come to you and it
 * does not land in a spam folder addressed from nobody. The app's job is to
 * keep the record of who was invoiced and who has paid, which it does whether
 * you send it from here, from a laptop, or not at all.
 */

let book = null;   // { settings, customers, invoices, summary, backupReady }

async function invoiceApi(path, options) {
  const res = await fetch(keyed(path), {
    headers: { 'Content-Type': 'application/json', 'X-Host-Key': hostKey },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data;
}

function invoicesSection() {
  const el = node(`
    <div class="game-section">
      <div class="game-head">
        <div>
          <h2>Invoices</h2>
          <div class="tiny status">Loading…</div>
        </div>
        <div class="row">
          <button class="minor who-to">Customers</button>
          <button class="minor my-details">Your details</button>
          <button class="go new-invoice">New invoice</button>
        </div>
      </div>
      <div class="inv-warn"></div>
      <div class="inv-body"></div>
    </div>`);

  const status = el.querySelector('.status');
  const body = el.querySelector('.inv-body');
  const warn = el.querySelector('.inv-warn');

  const refresh = async () => {
    try {
      book = await invoiceApi('/api/invoices');
    } catch (err) {
      status.textContent = err.message;
      return;
    }
    const s = book.summary;
    status.innerHTML = s.count
      ? `${s.count} invoice${s.count === 1 ? '' : 's'} · <b>${esc(money(s.outstanding))}</b> outstanding`
        + (s.overdueCount ? ` · <b style="color:var(--bad)">${esc(money(s.overdue))} overdue</b>` : '')
      : 'Nothing invoiced yet.';

    /*
     * The one warning that matters, and it is the same shape as the song
     * history's: there is no permanent disk, so without the private repo an
     * invoice lives until the next deploy. An invoice you think you have a
     * record of and do not is worse than no record at all.
     */
    warn.replaceChildren(...(book.backupReady ? [] : [node(`
      <div class="pv-warn pv-broken" style="margin-bottom:12px">
        <b class="pv-warn-head">Invoices are not being backed up</b>
        <div class="tiny" style="margin-top:6px">
          They are saved here, and this server has no permanent disk — so everything on
          this page disappears the next time the app redeploys, including the invoice
          numbering. Set <b>PHOTO_REPO</b> and <b>GITHUB_TOKEN</b> on Render to a
          <b>private</b> repository and they become permanent. It must be private:
          this file has your customers' addresses and your own bank details in it.
        </div>
      </div>`)]));

    drawList(body, refresh);
  };

  el.querySelector('.new-invoice').addEventListener('click', () => openInvoiceForm({}, refresh));
  el.querySelector('.my-details').addEventListener('click', () => openSettings(refresh));
  el.querySelector('.who-to').addEventListener('click', () => openCustomers(refresh));
  refresh();
  return el;
}

/** Pence to "£350.00", the same sum the server did. Never adds anything up. */
function money(pence) {
  const n = Math.round(Number(pence) || 0);
  const abs = Math.abs(n);
  const pounds = String(Math.floor(abs / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${n < 0 ? '-' : ''}£${pounds}.${String(abs % 100).padStart(2, '0')}`;
}

const STATUS_LABEL = { draft: 'Draft', sent: 'Awaiting payment', paid: 'Paid', cancelled: 'Cancelled' };

function drawList(body, refresh) {
  if (!book.invoices.length) {
    body.replaceChildren(node(`
      <div class="tiny" style="padding:18px 0">
        Nothing yet. Fill in <b>Your details</b> once, add the venues you work for under
        <b>Customers</b>, and an invoice is then two taps at the end of a night.
      </div>`));
    return;
  }

  const rows = book.invoices.map((invoice) => {
    const row = node(`
      <div class="inv-row status-${esc(invoice.status)}">
        <div class="inv-main">
          <div class="inv-top">
            <b>${esc(invoice.number)}</b>
            <span class="inv-who">${esc(invoice.to.name)}</span>
            <span class="inv-status">${esc(STATUS_LABEL[invoice.status] || invoice.status)}</span>
          </div>
          <div class="tiny">${esc(invoice.lines.map((l) => l.description).join(' · '))}</div>
        </div>
        <div class="inv-amount">${esc(money(invoice.totals.due))}</div>
        <div class="inv-actions">
          <a class="minor" href="${esc(keyed('/api/invoices/' + encodeURIComponent(invoice.number) + '.pdf'))}" target="_blank" rel="noopener">Open</a>
          <button class="minor send">Send</button>
          ${invoice.status === 'paid'
            ? '<button class="minor unpaid">Not paid</button>'
            : invoice.status === 'cancelled' ? '' : '<button class="go paid">Mark paid</button>'}
        </div>
      </div>`);

    row.querySelector('.send').addEventListener('click', () => share(invoice));
    row.querySelector('.paid')?.addEventListener('click', async () => {
      await invoiceApi(`/api/invoices/${encodeURIComponent(invoice.number)}`, { method: 'POST', body: JSON.stringify({ status: 'paid' }) });
      refresh();
    });
    row.querySelector('.unpaid')?.addEventListener('click', async () => {
      await invoiceApi(`/api/invoices/${encodeURIComponent(invoice.number)}`, { method: 'POST', body: JSON.stringify({ status: 'sent' }) });
      refresh();
    });
    return row;
  });
  body.replaceChildren(...rows);
}

/**
 * Send it.
 *
 * The share sheet where the phone has one, which puts the PDF straight into
 * Mail or WhatsApp from your own account. On a laptop there is no share sheet,
 * so it opens the customer's email with the subject and body written and the
 * PDF in another tab to attach — clumsier, but a laptop is where you have the
 * patience for it.
 */
async function share(invoice) {
  const url = keyed(`/api/invoices/${encodeURIComponent(invoice.number)}.pdf`);
  const subject = `Invoice ${invoice.number} — ${invoice.from.name || 'Quiz night'}`;
  const lines = [
    `Hi${invoice.to.contact ? ' ' + invoice.to.contact : ''},`,
    '',
    `Thanks for having us. Invoice ${invoice.number} is attached — ${money(invoice.totals.due)}, ${invoice.terms || 'payable on receipt'}.`,
    '',
    'Best,',
    invoice.from.contact || invoice.from.name || '',
  ].join('\n');

  try {
    const res = await fetch(url, { headers: { 'X-Host-Key': hostKey } });
    const blob = await res.blob();
    const file = new File([blob], invoice.number + '.pdf', { type: 'application/pdf' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: subject, text: lines });
      return;
    }
  } catch (err) {
    // A cancelled share sheet throws too. Falling through to the email draft
    // would then open a window they did not ask for, so only carry on if the
    // share genuinely was not available.
    if (err && err.name === 'AbortError') return;
  }

  window.open(url, '_blank', 'noopener');
  if (invoice.to.email) {
    location.href = `mailto:${encodeURIComponent(invoice.to.email)}`
      + `?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(lines)}`;
  }
}

/** A plain sheet with a title, a body and a Save. Escape and the backdrop close it. */
function sheet(title, buildBody, onSave, { saveLabel = 'Save' } = {}) {
  const overlay = node(`
    <div class="overlay">
      <div class="sheet">
        <div class="sheet-head">
          <div style="min-width:0;flex:1 1 auto"><b>${esc(title)}</b><div class="tiny inv-sheet-note"></div></div>
          <div class="sheet-actions">
            <button class="go inv-save">${esc(saveLabel)}</button>
            <button class="minor inv-close">Close</button>
          </div>
        </div>
        <div class="sheet-body inv-form"></div>
      </div>
    </div>`);
  const close = () => { overlay.remove(); document.removeEventListener('keydown', onKey); };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);
  overlay.querySelector('.inv-close').addEventListener('click', close);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

  const form = overlay.querySelector('.inv-form');
  const note = overlay.querySelector('.inv-sheet-note');
  buildBody(form, { close, note });

  overlay.querySelector('.inv-save').addEventListener('click', async (e) => {
    e.target.disabled = true;
    try {
      await onSave(form, { close, note });
    } catch (err) {
      note.textContent = err.message;
      note.style.color = 'var(--bad)';
      e.target.disabled = false;
    }
  });
  document.body.appendChild(overlay);
  return overlay;
}

const field = (label, name, value = '', { type = 'text', placeholder = '', wide = false } = {}) => `
  <label class="inv-field ${wide ? 'wide' : ''}">
    <span>${esc(label)}</span>
    ${type === 'textarea'
      ? `<textarea name="${name}" rows="3" placeholder="${esc(placeholder)}">${esc(value)}</textarea>`
      : `<input type="${type}" name="${name}" value="${esc(value)}" placeholder="${esc(placeholder)}">`}
  </label>`;

const valuesOf = (form) => {
  const out = {};
  for (const el of form.querySelectorAll('[name]')) out[el.name] = el.type === 'checkbox' ? el.checked : el.value.trim();
  return out;
};

/** Your own details. Typed once, printed on every invoice from then on. */
function openSettings(refresh) {
  const s = book.settings;
  sheet('Your details', (form) => {
    form.innerHTML = `
      <div class="inv-group"><h4>Who the invoice is from</h4>
        ${field('Trading name', 'name', s.business.name, { placeholder: "Mark's Music Madness" })}
        ${field('Your name', 'contact', s.business.contact)}
        ${field('Address', 'address', s.business.address, { type: 'textarea', wide: true })}
        ${field('Email', 'email', s.business.email)}
        ${field('Phone', 'phone', s.business.phone)}
      </div>
      <div class="inv-group"><h4>How they pay you</h4>
        ${field('Account name', 'bankName', s.bank.name)}
        ${field('Sort code', 'sortCode', s.bank.sortCode, { placeholder: '00-00-00' })}
        ${field('Account number', 'accountNumber', s.bank.accountNumber)}
        ${field('Payment reference', 'reference', s.bank.reference, { placeholder: 'Leave blank to use the invoice number' })}
      </div>
      <div class="inv-group"><h4>The small print</h4>
        ${field('Payment terms', 'terms', s.terms, { type: 'textarea', wide: true })}
        ${field('Invoice number prefix', 'prefix', s.prefix, { placeholder: 'INV' })}
        <div class="tiny" style="align-self:end">Next invoice will be <b>${esc(s.prefix)}-${String(s.nextNumber).padStart(4, '0')}</b></div>
      </div>
      <div class="inv-group"><h4>VAT</h4>
        <label class="inv-field"><span>Registered for VAT</span>
          <input type="checkbox" name="vatRegistered" ${s.vat.registered ? 'checked' : ''}>
        </label>
        ${field('VAT number', 'vatNumber', s.vat.number, { placeholder: 'GB123456789' })}
        ${field('Rate %', 'vatRate', String(s.vat.ratePercent), { type: 'number' })}
        <div class="tiny wide">
          Leave this off unless you are actually registered. An invoice from somebody who
          is not registered must not mention VAT at all — so while this is off, nothing
          on the page says the word. Turning it on later does not change any invoice you
          have already sent.
        </div>
      </div>`;
  }, async (form, { close }) => {
    const v = valuesOf(form);
    await invoiceApi('/api/invoices/settings', {
      method: 'PUT',
      body: JSON.stringify({
        business: { name: v.name, contact: v.contact, address: v.address, email: v.email, phone: v.phone },
        bank: { name: v.bankName, sortCode: v.sortCode, accountNumber: v.accountNumber, reference: v.reference },
        vat: { registered: v.vatRegistered, number: v.vatNumber, ratePercent: Number(v.vatRate) || 20 },
        terms: v.terms,
        prefix: v.prefix || 'INV',
      }),
    });
    close();
    refresh();
  });
}

/** The venues you work for, so an invoice is a pick rather than a retype. */
function openCustomers(refresh) {
  sheet('Customers', (form) => {
    const draw = () => {
      form.innerHTML = `<div class="inv-customers">${book.customers.map((c) => `
        <div class="inv-cust" data-id="${esc(c.id)}">
          <div><b>${esc(c.name)}</b>${c.contact ? ` · ${esc(c.contact)}` : ''}
            <div class="tiny">${esc((c.address || '').replace(/\n/g, ', '))}${c.usualFeePence != null ? ` · usually ${esc(money(c.usualFeePence))}` : ''}</div>
          </div>
          <button class="minor danger del">Remove</button>
        </div>`).join('') || '<div class="tiny">Nobody yet.</div>'}</div>
        <div class="inv-group"><h4>Add a customer</h4>
          ${field('Name', 'name', '', { placeholder: 'The Crown' })}
          ${field('Contact', 'contact', '', { placeholder: 'Dave' })}
          ${field('Address', 'address', '', { type: 'textarea', wide: true })}
          ${field('Email', 'email', '')}
          ${field('Usual fee', 'usualFee', '', { placeholder: '350' })}
        </div>`;
      for (const row of form.querySelectorAll('.inv-cust')) {
        row.querySelector('.del').addEventListener('click', async () => {
          await invoiceApi(`/api/invoices/customers/${encodeURIComponent(row.dataset.id)}`, { method: 'DELETE' });
          book = await invoiceApi('/api/invoices');
          draw();
          refresh();
        });
      }
    };
    draw();
  }, async (form, { close }) => {
    const v = valuesOf(form);
    if (!v.name) throw new Error('A customer needs a name.');
    await invoiceApi('/api/invoices/customers', { method: 'POST', body: JSON.stringify(v) });
    close();
    refresh();
  });
}

/**
 * The invoice itself.
 *
 * Pre-filled from the customer and from the night that has just finished, so
 * the usual case is: check the number, press Issue, press Send.
 */
function openInvoiceForm(prefill, refresh) {
  sheet('New invoice', (form, { note }) => {
    if (!book.settings.business.name) {
      note.textContent = 'Fill in "Your details" first — an invoice with no name on it is not much use.';
    }
    // The first line describes itself from the event, and keeps doing so until
    // you type over it. Left blank it produced an invoice with a charge on it
    // and nothing saying what the charge was for, which is the one line that
    // gets an invoice queried.
    const lines = prefill.lines && prefill.lines.length
      ? prefill.lines
      : [{ description: prefill.description || 'Music quiz night', amount: '' }];

    form.innerHTML = `
      <div class="inv-group"><h4>Who it is for</h4>
        <label class="inv-field wide"><span>Customer</span>
          <select name="customerId">
            <option value="">Someone not on the list…</option>
            ${book.customers.map((c) => `<option value="${esc(c.id)}" ${prefill.customerId === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}
          </select>
        </label>
        <div class="inv-oneoff" hidden>
          ${field('Name', 'toName', '')}
          ${field('Contact', 'toContact', '')}
          ${field('Address', 'toAddress', '', { type: 'textarea', wide: true })}
          ${field('Email', 'toEmail', '')}
        </div>
      </div>
      <div class="inv-group"><h4>The event</h4>
        ${field('What it was', 'eventTitle', prefill.event?.title || 'Music quiz night')}
        ${field('Venue', 'eventVenue', prefill.event?.venue || '')}
        ${field('Date', 'eventDate', prefill.event?.date || new Date().toISOString().slice(0, 10), { type: 'date' })}
      </div>
      <div class="inv-group wide"><h4>What they owe</h4>
        <div class="inv-lines"></div>
        <button class="minor add-line" type="button">Add a line</button>
      </div>
      <div class="inv-group">
        ${field('Deposit already paid', 'deposit', prefill.deposit || '', { placeholder: '0' })}
        ${field('Anything else on the invoice', 'notes', '', { type: 'textarea', wide: true })}
      </div>
      <div class="inv-total tiny"></div>`;

    const linesEl = form.querySelector('.inv-lines');
    const totalEl = form.querySelector('.inv-total');

    // The running total is worked out here only to show you what you typed.
    // The invoice's own figures come back from the server, which is the one
    // place money is ever added up.
    const retotal = () => {
      let pence = 0;
      let bad = false;
      for (const row of linesEl.querySelectorAll('.inv-line')) {
        const raw = row.querySelector('[data-amount]').value.trim();
        if (!raw) continue;
        const parsed = readMoney(raw);
        if (parsed === null) bad = true;
        else pence += parsed;
      }
      const deposit = readMoney(form.querySelector('[name=deposit]').value.trim() || '0');
      totalEl.innerHTML = bad || deposit === null
        ? '<b style="color:var(--bad)">That does not look like an amount — try 350 or 350.00</b>'
        : `Amount due <b>${esc(money(pence - (deposit || 0)))}</b>`;
    };

    const addLine = (line = { description: '', amount: '' }) => {
      const row = node(`
        <div class="inv-line">
          <input type="text" data-desc placeholder="Music quiz night" value="${esc(line.description || '')}">
          <input type="text" data-amount placeholder="350" value="${esc(line.amount || '')}" inputmode="decimal">
          <button class="minor danger" type="button">×</button>
        </div>`);
      row.querySelector('button').addEventListener('click', () => { row.remove(); retotal(); });
      row.querySelector('[data-amount]').addEventListener('input', retotal);
      linesEl.appendChild(row);
      retotal();
    };
    for (const line of lines) addLine(line);
    form.querySelector('.add-line').addEventListener('click', () => addLine());
    form.querySelector('[name=deposit]').addEventListener('input', retotal);

    /*
     * Keep the first line reading like the night it is for, until it is edited.
     * "Music quiz night — The Crown" writes itself as you fill the form in;
     * touch the box and it stops, because from then on it is yours.
     */
    const firstDesc = () => linesEl.querySelector('.inv-line [data-desc]');
    let autoDesc = firstDesc() ? firstDesc().value : '';
    const describe = () => {
      const box = firstDesc();
      if (!box || box.value !== autoDesc) return;
      const bits = [form.querySelector('[name=eventTitle]').value.trim(), form.querySelector('[name=eventVenue]').value.trim()];
      autoDesc = bits.filter(Boolean).join(' — ');
      box.value = autoDesc;
    };
    for (const name of ['eventTitle', 'eventVenue']) {
      form.querySelector(`[name=${name}]`).addEventListener('input', describe);
    }

    // A one-off booking should not have to become a saved customer first.
    const picker = form.querySelector('[name=customerId]');
    const oneOff = form.querySelector('.inv-oneoff');
    const togglePicker = () => { oneOff.hidden = Boolean(picker.value); };
    picker.addEventListener('change', () => {
      togglePicker();
      const customer = book.customers.find((c) => c.id === picker.value);
      const first = linesEl.querySelector('[data-amount]');
      if (customer && customer.usualFeePence != null && first && !first.value) {
        first.value = money(customer.usualFeePence).replace('£', '');
        retotal();
      }
      // A venue you already know the name of should not have to be typed twice.
      const venue = form.querySelector('[name=eventVenue]');
      if (customer && !venue.value) {
        venue.value = customer.name;
        describe();
      }
    });
    togglePicker();
    picker.dispatchEvent(new Event('change'));
  }, async (form, { close }) => {
    const v = valuesOf(form);
    const lines = [...form.querySelectorAll('.inv-line')].map((row) => ({
      description: row.querySelector('[data-desc]').value.trim(),
      amount: row.querySelector('[data-amount]').value.trim() || '0',
    })).filter((l) => l.description || l.amount !== '0');

    const done = await invoiceApi('/api/invoices', {
      method: 'POST',
      body: JSON.stringify({
        customerId: v.customerId,
        toName: v.toName, toContact: v.toContact, toAddress: v.toAddress, toEmail: v.toEmail,
        event: { title: v.eventTitle, venue: v.eventVenue, date: v.eventDate },
        lines,
        deposit: v.deposit || '0',
        notes: v.notes,
      }),
    });
    close();
    refresh();
    // Straight into sending it, because that is what you opened this to do.
    share(done.invoice);
  // "Save" is ambiguous on an invoice — saved as a draft, or sent? This one
  // hands out a number and cannot be taken back, so it says so.
  }, { saveLabel: 'Issue and send' });
}

/** Mirrors toPence in src/invoices.js — same rules, so the same things are refused. */
function readMoney(input) {
  const cleaned = String(input ?? '').trim().replace(/[£,\s]/g, '');
  if (!cleaned) return null;
  if (!/^-?\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const negative = cleaned.startsWith('-');
  const [pounds, pence = ''] = cleaned.replace('-', '').split('.');
  const total = Number(pounds) * 100 + Number(pence.padEnd(2, '0'));
  return negative ? -total : total;
}
