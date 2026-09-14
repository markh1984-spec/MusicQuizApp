/**
 * THE DESK — the request queue, and it is the only screen it is ever on.
 *
 * ---
 *
 * **RULE 1, AND ITS SHARPEST CASE.** The projector gets the join code and the
 * photographs; the queue is here and nowhere else. A list of requests on the
 * wall is a list of songs the room can watch the DJ not play, and the first
 * rude title somebody types would be six feet wide in front of everybody —
 * with no filter, because this app deliberately has none in the room.
 * `screenView()` in `src/dj.js` does not carry them, so the guarantee is
 * structural rather than a matter of remembering.
 *
 * **THE JOB IS COPY-AND-PLAY, AND THE COPY BUTTON IS THE FEATURE.** His DJ
 * software reads off the TITLE, so the useful act is getting `Artist — Title`
 * into a search box in somebody else's application with one press, in a dark
 * booth, with a record running out. That is why the line is worded on the
 * SERVER (`hostView()`), not here: the queue, a setlist and anything else
 * that ever prints a request cannot then word it two ways.
 *
 * **A REQUEST IS NEVER SILENTLY LOST.** Played and binned are two different
 * buttons with two different meanings — one frees the asker's slot as a
 * reward, the other as a refusal — and both are recorded, so the archive of
 * the night is honest about what was asked for and what went on.
 */

import { esc, node } from './client.js';

/** A brief "copied" that does not need a toast system or a state push. */
function flash(btn, word) {
  const was = btn.textContent;
  btn.textContent = word;
  btn.disabled = true;
  setTimeout(() => { btn.textContent = was; btn.disabled = false; }, 900);
}

/**
 * ONE PRESS, AND IT SAYS SO.
 *
 * `navigator.clipboard` needs a secure context, which a DJ on a laptop plugged
 * into a venue's screen may not have — so the fallback is a real one rather
 * than a silent failure, and the button says *Select* when that is what it
 * did, because a button claiming it copied when it has not is this repo's
 * commonest fault.
 */
function copyLine(btn, row, line) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(line).then(() => flash(btn, '✓ Copied'))
      .catch(() => selectInstead(btn, row));
    return;
  }
  selectInstead(btn, row);
}

function selectInstead(btn, row) {
  const what = row.querySelector('.dj-line');
  if (!what) return;
  const range = document.createRange();
  range.selectNodeContents(what);
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);
  flash(btn, 'Selected — copy it');
}

function requestRow(r, act) {
  const row = node(`
    <div class="djq-row">
      <div class="djq-what">
        <span class="dj-line">${esc(r.line)}</span>
        <span class="tiny djq-who">${esc(r.who || '')}${r.source === 'typed' ? ' · typed in' : ''}</span>
      </div>
      <div class="djq-buttons">
        <button class="minor djq-copy" type="button">Copy</button>
        <button class="minor djq-played" type="button">Played it</button>
        <button class="minor danger djq-bin" type="button" title="Not playing this">Bin</button>
      </div>
    </div>`);

  row.querySelector('.djq-copy').addEventListener('click', (e) => copyLine(e.currentTarget, row, r.line));
  row.querySelector('.djq-played').addEventListener('click', () => act('played', { id: r.id }));
  row.querySelector('.djq-bin').addEventListener('click', () => act('bin', { id: r.id }));
  return row;
}

export function djPanels(s, act) {
  const panels = [];
  const queue = s.requests || [];
  const done = s.played || [];

  /*
   * WHY THE QUEUE IS EMPTY, SAID ON THE PANEL. An empty list with no words is
   * the app looking broken at exactly the moment a DJ is deciding whether it
   * works — and the two reasons want different things doing about them: put
   * the code up, or wait.
   */
  const queuePanel = node(`
    <div class="panel">
      <h3>Requests${queue.length ? ` · ${queue.length}` : ''}</h3>
      <div class="djq-list"></div>
    </div>`);
  const list = queuePanel.querySelector('.djq-list');
  if (!queue.length) {
    list.replaceChildren(node(`<div class="tiny">${s.playerCount
      ? 'Nothing waiting. They send a photo first, then they can ask.'
      : 'Nobody has scanned the code yet.'}</div>`));
  } else {
    for (const r of queue) list.appendChild(requestRow(r, act));
  }
  panels.push(queuePanel);

  /*
   * WHAT HAS GONE, NEWEST FIRST — the opposite of the queue's own order, and
   * deliberately: a queue is worked from the oldest, a history is read from
   * the newest. It is what the DJ checks to answer "did you play mine?".
   */
  if (done.length) {
    const donePanel = node(`
      <div class="panel">
        <h3>Played · ${done.length}</h3>
        <div class="djq-done"></div>
      </div>`);
    const bin = donePanel.querySelector('.djq-done');
    for (const r of [...done].reverse()) {
      bin.appendChild(node(`
        <div class="djq-done-row">
          <span>${esc(r.line)}</span>
          <span class="tiny djq-who">${esc(r.who || '')}</span>
        </div>`));
    }
    panels.push(donePanel);
  }

  /*
   * HOW MANY PHONES, AND HOW MANY HAVE EARNED THE BOX. Two numbers rather
   * than one, because the gap between them IS the thing to act on: a room
   * that has scanned and not sent anything is a room to say something to.
   */
  panels.push(node(`
    <div class="panel">
      <h3>The room</h3>
      <div class="tiny">${s.playerCount} ${s.playerCount === 1 ? 'phone' : 'phones'} in ·
        ${s.unlockedCount} ${s.unlockedCount === 1 ? 'has' : 'have'} sent a photo</div>
    </div>`));

  return panels;
}

export function djActions(s, act, minor) {
  if (s.phase === 'finished') {
    return [node('<div class="tiny" style="padding:8px 4px">Requests are closed.</div>')];
  }
  /*
   * FINISHING IS A STATED ESCAPE HATCH AND ITS CONFIRM NAMES WHAT IT COSTS —
   * bingo's `Finish` exactly, and for the same reason: the person on the
   * decks is the only one who knows the set is over. Destructive, so outlined
   * red and never filled.
   */
  return [minor('Stop taking requests', () => {
    const waiting = (s.requests || []).length;
    const what = waiting
      ? `Stop taking requests? ${waiting} still waiting — you can still play them.`
      : 'Stop taking requests?';
    if (confirm(what)) act('finish');
  }, true)];
}

/** What the phones in the room have got — `phonesAre()`'s DJ answer. */
export function djPhonesAre(s) {
  if (s.phase === 'finished') return 'A thank-you — requests are closed';
  return 'The camera, and a box to ask for a song';
}

/** Where the night has got to, on the line above everything else. */
export function djWhere(s) {
  return s.phase === 'finished' ? 'DJ set — requests closed' : 'DJ set — requests open';
}
