/** Writing a pack — the generator, the import box, and the job that runs. */

import { esc, node } from './client.js';
import { sheet } from './console-invoices.js';
import { library, setLastDone } from './console-state.js';
import { night } from './console-tonight.js';
import { QUIZ_ROUNDS, can, hostKey, keyed, linkTo, load, ownPacksNote, showDone } from './console.js';

/**
 * Build a whole quiz from a theme.
 *
 * Same shape as the bingo generator below it, so there is one place on this
 * page for "make me something new" rather than a button for one game and a
 * terminal command for the other.
 */
export function quizGeneratePanel(gen) {
  const el = node(`
    <div class="panel generate quiz-generate">
      <h3>New quiz</h3>
      <div class="gen-row">
        <input type="text" id="qTheme" placeholder="A theme — the 1990s, Motown, Christmas number ones, Britpop…" autocomplete="off">
        <button class="role-make" id="qGo" ${gen.claude ? '' : 'disabled'}>Write it</button>
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
      <div class="gen-topical">
        <button class="go ghost" id="qTopical" ${gen.claude ? '' : 'disabled'}>The month just gone</button>
        <span class="tiny">
          Forty questions off the news, no theme needed: <b>20</b> general knowledge and
          <b>10</b> music from the last month, read off the web, then <b>10</b> music from any era so
          it is not all one thing. It is named after today and marked as current for a fortnight.
          Costs more than an ordinary quiz — it does the reading as well as the writing.
        </span>
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
  el.querySelector('#qTopical')?.addEventListener('click', () => generateTopicalQuiz(el));
  el.querySelector('#qTheme')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') generateQuiz(el);
  });
  return el;
}

async function generateQuiz(panel) {
  const theme = panel.querySelector('#qTheme').value.trim();
  const status = panel.querySelector('#qStatus');
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

  return runQuizJob(panel, '#qGo', 'Write it', {
    theme,
    rounds,
    hard: panel.querySelector('#qHard').checked,
  });
}

/**
 * The topical quiz — one button, no form.
 *
 * It sends a flag and the difficulty tickbox and nothing else. The SHAPE lives
 * on the server (TOPICAL_ROUNDS in src/generate-quiz.js) rather than being
 * assembled here, so a curl call and a button press cannot produce different
 * quizzes and there is one place to change what a topical night looks like.
 *
 * It ignores the theme box on purpose. The theme of this one is "the last
 * month", it is named after the date, and a half-typed theme sitting in the
 * box above is not an instruction — it is something somebody started and did
 * not finish.
 */
async function generateTopicalQuiz(panel) {
  return runQuizJob(panel, '#qTopical', 'The month just gone', {
    topical: true,
    hard: panel.querySelector('#qHard').checked,
  });
}

/**
 * Everything both quiz buttons do once they know what they are asking for.
 *
 * One copy, because the reporting is the part that has been wrong before —
 * the round that came back short, the pack that was not backed up, the
 * generation that ended with neither a result nor an error. A second button
 * with its own copy of that is a second button where those get fixed once.
 */
async function runQuizJob(panel, buttonSel, buttonWords, payload) {
  const status = panel.querySelector('#qStatus');
  const button = panel.querySelector(buttonSel);
  // Both buttons go down: two generations at once is two bills and a log that
  // interleaves into nonsense.
  const buttons = [...panel.querySelectorAll('#qGo, #qTopical')];
  buttons.forEach((b) => { b.disabled = true; });
  button.textContent = 'Writing…';
  setLastDone(null); // a new job supersedes the last one's banner
  status.innerHTML = '<div class="gen-log"></div>';
  const logEl = status.querySelector('.gen-log');
  const say = (line) => {
    logEl.appendChild(node(`<div>${esc(line)}</div>`));
    logEl.scrollTop = logEl.scrollHeight;
  };

  try {
    const result = await streamGeneration('/api/generate/quiz', payload, say);

    if (result.error) {
      status.appendChild(node(`<div class="gen-bad">${esc(result.error)}</div>`));
      buttons.forEach((b) => { b.disabled = false; });
      button.textContent = buttonWords;
      return;
    }

    const done = result.done;
    const problems = done.problems || [];
    const said = `
        Written <b>${esc(done.title)}</b> — ${done.questionCount} questions across
        ${done.rounds} round${done.rounds === 1 ? '' : 's'}.
        <br>Checked over — ${done.rejected} question${done.rejected === 1 ? '' : 's'} thrown out and replaced.
        ${(done.short || []).length
          ? `<br><b style="color:var(--bad)">Round${done.short.length === 1 ? '' : 's'} ${done.short.map((r) => `${r.round} came back with only ${r.got} of ${r.wanted}`).join(', ')}.</b>
             That is the WRITER running out of questions it was confident about, not the checker throwing them away.
             Try a broader theme, or ask for fewer.`
          : ''}
        ${(done.unchecked || []).length
          ? `<br><b>Round${done.unchecked.length === 1 ? '' : 's'} ${done.unchecked.join(', ')} could NOT be checked</b> — the second pass was unreachable. Read ${done.unchecked.length === 1 ? 'that round' : 'those rounds'} line by line.`
          : ''}
        ${done.backedUp ? '<br>Backed up to GitHub — this one is permanent.' : '<br><b>Not backed up</b> — this will be lost when the app restarts.'}
        <br><b>Now read it.</b> <a href="${linkTo('/editor')}${done.id ? (linkTo('/editor').includes('?') ? '&' : '?') + 'quiz=' + encodeURIComponent(done.id) : ''}">Open the editor</a> and
        check every question before anyone else sees it.
        ${done.freshUntil
          ? `<br>This one is <b>topical</b> — ${done.searches} web search${done.searches === 1 ? '' : 'es'}${(done.sources || []).length ? ` across ${done.sources.length} site${done.sources.length === 1 ? '' : 's'}` : ''}.
             Worth running until <b>${esc(new Date(done.freshUntil).toLocaleDateString('en-GB', { day: 'numeric', month: 'long' }))}</b>, after which the room has stopped talking about it.`
          : ''}
        ${!done.needsImages ? '' : done.drew && !done.drew.error
    /*
     * The pictures are drawn as part of writing now, so this says what
     * happened rather than telling you to go and do it. The reused count is
     * worth showing: it is the shared portrait library paying for itself, and
     * "6 already drawn" is the difference between a free round and a paid one.
     */
    ? `<br><span class="tiny">Pictures: <b>${done.drew.made}</b> drawn${
  done.drew.reused ? `, ${done.drew.reused} already in your library` : ''}${
  (done.drew.failed || []).length ? ` — <b>${done.drew.failed.length} could not be drawn</b>, those keep a placeholder` : ''}.</span>`
    : `<br><span class="tiny"><b>The pictures could not be drawn${done.drew && done.drew.error ? ': ' + esc(done.drew.error) : ''}</b>
        — the round works on placeholders. Open the pack and press Pictures to try again.</span>`}`;
    status.appendChild(node(`<div class="gen-good">${said}</div>`));
    // A quiz has no song history, so backup is the only thing that can be amiss.
    showDone(done.backedUp && !(done.unchecked || []).length && !(done.short || []).length ? 'good' : 'warn', said);
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
    buttons.forEach((b) => { b.disabled = false; });
    button.textContent = buttonWords;
  }
}

/**
 * Read a streaming generation response, calling `say` for each progress line.
 * Both generators send plain lines, then one final DONE or ERROR line.
 */
export async function streamGeneration(path, body, say) {
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
 * This is how a bingo game gets made now: Claude in a browser reads the
 * no-repeats list off this repository, picks the songs, builds the Spotify
 * playlist, and prints the tracks. This box is where they land.
 *
 * The paste box is open and first because it is the route, not the fallback.
 * It was behind a "or paste a track list instead" fold, from when a Spotify
 * playlist link was the main way in — and a panel that hides the thing you
 * came to do is a panel you use wrong.
 */
/**
 * @param {object} [opts]
 * @param {boolean} [opts.own]  file it in THEIR library rather than the
 *   catalogue. The no-repeats memory is left out of it in both directions —
 *   that is the owner's generator's record of what it has used, and neither
 *   half of that is true of a list somebody else pasted.
 */
export function importPanel(gen, { own = false } = {}) {
  const el = node(`
    <div class="panel import">
      <h3>${own ? 'Make a bingo game of your own' : 'Or bring in a list you already have'}</h3>
      <div class="tiny">${own
        ? `Paste a track list — one per line — and it becomes a bingo game only you can see.
           Everything else works exactly as it does with a pack from the catalogue.`
        : `Paste what Claude printed — one track per line. It goes into the no-repeats list too, so next week's round avoids it.`}</div>
      <textarea id="impText" rows="7" placeholder="One per line — any of these work:&#10;&#10;Billie Jean — Michael Jackson&#10;1. Take On Me - a-ha&#10;Blue Monday by New Order"></textarea>
      <div class="gen-row">
        <input type="text" id="impUrl" placeholder="…or a Spotify playlist link instead" autocomplete="off">
        <button class="role-make" id="impGo">Import</button>
      </div>
      <div class="gen-opts">
        <label>Card <select id="impSize"><option value="3">3×3</option><option value="4" selected>4×4</option><option value="5">5×5</option></select></label>
        <label>Call it <input type="text" id="impTitle" placeholder="optional" style="width:150px"></label>
        ${own ? '' : '<label title="Off by default — you probably built this list on purpose."><input type="checkbox" id="impAvoid"> Skip songs played recently</label>'}
        <span class="tiny" id="impFit"></span>
      </div>
      <div class="gen-status" id="impStatus"></div>
      ${gen.spotify ? '' : '<div class="tiny warn">Spotify is not set up, so playlist links will not work — paste a list instead.</div>'}
    </div>`);

  if (own) {
    el.dataset.own = 'yes';
    // Inside the panel rather than under it: a loose warning between a panel
    // and the pack grid reads as a caption on the grid, which is not what it
    // is about.
    const warning = ownPacksNote();
    if (warning) el.appendChild(warning);
  }
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
  setLastDone(null); // a new job supersedes the last one's banner
  status.innerHTML = '<div class="gen-log"></div>';
  const logEl = status.querySelector('.gen-log');
  const say = (line) => {
    logEl.appendChild(node(`<div>${esc(line)}</div>`));
    logEl.scrollTop = logEl.scrollHeight;
  };

  const own = panel.dataset.own === 'yes';
  try {
    const { done, error } = await streamGeneration(own ? '/api/mine/import' : '/api/import/bingo', {
      playlistUrl,
      text,
      title: panel.querySelector('#impTitle').value.trim(),
      cardSize: Number(panel.querySelector('#impSize').value),
      avoidMonths: panel.querySelector('#impAvoid')?.checked ? 3 : 0,
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
      ${done.backedUp ? 'Backed up — this one is permanent.' : '<b>Not backed up</b>, so it will be lost when the app restarts.'}
      ${done.mine ? 'It is yours: nobody else can read it.' : historyLine(done)}`;
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
export function generatePanel(gen) {
  const el = node(`
    <div class="panel generate">
      <h3>New bingo game</h3>
      <div class="gen-row">
        <input type="text" id="theme" placeholder="A theme — 1990s indie, Motown, Christmas number ones…" autocomplete="off">
        <button class="role-make" id="genGo" ${gen.claude ? '' : 'disabled'}>Build it</button>
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

export async function generate(panel) {
  const theme = panel.querySelector('#theme').value.trim();
  const status = panel.querySelector('#genStatus');
  const button = panel.querySelector('#genGo');
  if (!theme) {
    status.textContent = 'Give it a theme first.';
    return;
  }

  button.disabled = true;
  button.textContent = 'Building…';
  setLastDone(null); // a new job supersedes the last one's banner
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

/**
 * TONIGHT — the launch section, at the top of every tab.
 *
 * **It was called "Quick launch", which said how FAST it is rather than what
 * it is for**, and it behaved that way: two shortcut buttons that took no
 * settings, with the look, the card shape and the venue living somewhere else
 * entirely — on a pack card, in a grid, further down whichever tab you
 * happened to be on. So the fast path and the fully-featured path were two
 * different controls in two different places, and you had to know which one
 * you were in.
 *
 * The host's own framing, and it is the whole brief: *"the second he gets to
 * his console it should be very obvious that the top of every page is a launch
 * section — wherever he is, he can launch from there, and it needs to be fully
 * featured. Sometimes you just don't want to think, you want to get in and go
 * and know it will work."*
 *
 * So: one section, one name, everything a night needs.
 *
 *  - **Tonight's pack is already chosen** — the same pick the two shortcut
 *    buttons used to offer, in a box you can type over. Nothing to find.
 *  - **Tonight's venue is already chosen**, and is printed at the top, so what
 *    the night will be filed as and play for is visible before the press
 *    rather than at the final scores.
 *  - **Set it up** opens the rest — look, card shape, prizes, teams, online.
 *    Shut by default, because a dropdown on the panic control defeats the
 *    panic control; one tap away, because "it is somewhere else" is what was
 *    wrong before.
 *
 * ONE gradient button on the section, which is the GUI rule: there were two
 * shortcut cards and a pack card's Launch, all of them the account's own
 * gradient, on one screen.
 *
 * **It carries the launch SETTINGS rather than skipping them**, and that is
 * the whole design problem it had to solve. A launch is not one button: a quiz
 * takes a look, and a bingo game takes a look, a card shape and how many
 * prizes — and the card shape is explicitly a decision about tonight rather
 * than a property of the pack. A big Launch that quietly used the pack's own
 * defaults would be wrong for every bingo night. So the controls appear IN the
 * bar for whichever pack is chosen, which is one copy in one place rather than
 * a second set living somewhere else.
 *
 * Launching itself goes through `doLaunch()`, the same function the pack cards
 * call, so the guard against launching over somebody's live game cannot be
 * fixed in one place and left rotting in the other.
 */
