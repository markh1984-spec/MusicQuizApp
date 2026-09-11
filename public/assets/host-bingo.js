/**
 * The caller's view for bingo.
 *
 * You play a track in your DJ app, then tap it here. That is the whole job.
 * Search is at the top because forty tracks is too many to scroll past while
 * a record is playing.
 */

import {
  esc, node, rewardsEditorPopover, joinQueuePanel, noteMark, askAndSendNote,
} from './client.js';

let filter = '';
/*
 * THE CAP ON THE PLAYER LIST, AND THE WAY PAST IT.
 *
 * Module level rather than inside the panel, because this view is rebuilt on
 * every state push — during a round that is every mark from every phone, so a
 * fold held in the function would shut itself the moment anybody tapped a
 * square. The same reasoning `host.js` records for `whoPicked`'s open lists.
 */
let showEveryPhone = false;

export function bingoPanels(s, act) {
  const panels = [];

  if (s.win) panels.push(winPanel(s, act));
  panels.push(callerPanel(s, act));
  panels.push(playersPanel(s, act));
  if (s.claims && s.claims.length) panels.push(claimsPanel(s));

  return panels;
}

export function bingoActions(s, act, minor) {
  const out = [];

  // What the next prize is, by name, rather than "a full house" whatever it
  // actually is. With three prizes the host is announcing "now play on for two
  // lines", and the button has to agree with what they are about to say.
  const stage = s.stage || { index: 0, total: 2, label: 'a line', last: false };
  const nextLabel = (s.prizes && s.prizes[stage.index + 1] && s.prizes[stage.index + 1].label) || 'a full house';

  /*
   * TONIGHT AS MORE THAN ONE GAME — this bingo interlude is not the whole
   * night, so the moment that would ordinarily FINISH it (the last prize
   * just won) must not archive it early or hand out a quiz's prizes before
   * the true end. `s.runningOrder.nextKind` is only present when the server
   * genuinely has another part queued (see `session.js`'s `advanceOrder`) —
   * absent, this whole file behaves exactly as it always has.
   */
  const order = s.runningOrder;
  const continuing = Boolean(order && order.nextKind);
  const continueWord = continuing && order.nextKind === 'bingo' ? 'the bingo' : 'the quiz';

  const primaryLabel = s.phase === 'lobby'
    ? 'Start — then call your first track'
    : s.win
      ? (stage.last
        ? (continuing ? `Continue to ${continueWord}` : 'Finish the game')
        : `Play on for ${nextLabel}`)
      : 'Tap a track above as you play it';

  const primary = node(`<button class="primary" ${!s.win && s.phase !== 'lobby' ? 'disabled' : ''}>${esc(primaryLabel)}</button>`);
  primary.addEventListener('click', () => {
    if (s.phase === 'lobby') act('start');
    else if (s.win) {
      if (stage.last && continuing) act('advanceOrder');
      else act(stage.last ? 'finish' : 'playOn');
    }
  });
  out.push(primary);

  out.push(minor('Undo call', () => act('undoCall')));
  // Same control as the quiz's own — see the comment beside it in host.js.
  // One shared popover, one shared `setRewards` action, for either game.
  out.push(minor('Prizes', () => rewardsEditorPopover(s, act)));
  out.push(minor('New round', () => {
    if (confirm('New cards for everyone and nothing called. Carry on?')) act('newRound');
  }));
  out.push(minor('Console', () => { location.href = '/console' + location.search; }));
  /*
   * A DELIBERATE WAY TO MOVE ON EARLY — before the last configured prize is
   * won — without it being mistaken for ending the whole night.
   *
   * **And only while the primary is not already offering it.** At the last
   * stage with a win on the board the big button says *"Continue to the
   * quiz"* and this one said *"Continue to the quiz now"* three inches below
   * it: two controls, one word apart, both calling `advanceOrder`. That is the
   * label collision this repo keeps recording — and here it is not even two
   * things sharing a word, it is one thing drawn twice. `earlyExit` is what is
   * left: the case this button was actually built for.
   */
  const earlyExit = continuing && !(s.win && stage.last);
  if (earlyExit) {
    out.push(minor(`Continue to ${continueWord} now`, () => {
      if (confirm(`Move on to ${continueWord} now? Nobody's scores or cards are lost.`)) act('advanceOrder');
    }));
  }
  /*
   * FINISH STAYS — it is a deliberate escape hatch and `CLAUDE.md` says so.
   * What it must not be is silent about what it costs: pressing it mid-order
   * files the evening on the BINGO's results and leaves the rest of the night
   * out of Past gigs, the league and the landlord's report. The quiz hides its
   * own Stop mid-order because that confirm promised Back would undo it and
   * Back does not undo an archive; this one has no such promise to break, so
   * the honest fix is to say what happens rather than to take the hatch away.
   */
  out.push(minor('Finish', () => {
    const question = continuing
      ? `End the whole night here? ${continueWord === 'the quiz' ? 'The quiz' : 'The bingo'} still to come `
        + 'will not be played, and tonight is filed on the bingo alone.'
      : 'End the game and save the result?';
    if (confirm(question)) act('finish');
  }, true));

  return out;
}

function winPanel(s, act) {
  return node(`
    <div class="panel secret">
      <h3>${esc(((s.win.label || 'a line').charAt(0).toUpperCase() + (s.win.label || 'a line').slice(1)))} claimed — and it checks out</h3>
      <div class="cue">
        <div class="track">${esc(s.win.name)}</div>
        <div class="from">Verified against what you actually played.</div>
      </div>
    </div>`);
}

/**
 * The call sheet: forty tracks, alphabetical, as many on screen at once as fit.
 *
 * It was one track per row in pack order, which is wrong twice over. Pack order
 * means hunting for the song you have just played — the one thing you are doing
 * here, with a record running and a room in front of you. And a full-width row
 * per track puts forty of them over three screenfuls with the middle of every
 * row empty, so the answer to "have I done Africa?" is a scroll rather than a
 * glance.
 *
 * Alphabetical by title, same as the big screen's called list, so the two agree
 * when somebody at the bar asks. Called tracks stay exactly where they are and
 * go green with a tick — a list that reorders itself under your thumb mid-gig
 * is how you tap the wrong song.
 */
function callerPanel(s, act) {
  const el = node(`
    <div class="panel">
      <h3>Tap a track when you have played it — ${s.calledCount} of ${s.trackCount} called</h3>
      <input type="text" id="trackFilter" placeholder="Search the list…" value="${esc(filter)}" style="width:100%;margin-bottom:10px">
      <div class="trackgrid" id="trackList"></div>
    </div>`);

  const list = el.querySelector('#trackList');
  const paint = () => {
    const needle = filter.trim().toLowerCase();
    const shown = (s.tracks || [])
      .filter((t) => !needle || t.title.toLowerCase().includes(needle) || (t.artist || '').toLowerCase().includes(needle))
      .sort((a, b) => a.title.localeCompare(b.title, 'en-GB', { sensitivity: 'base' }));

    list.replaceChildren(...shown.map((t) => {
      const box = node(`
        <button class="trackbox ${t.called ? 'called' : ''}" data-id="${esc(t.id)}">
          <span class="tick">${t.called ? '✓' : ''}</span>
          <span class="tt">${esc(t.title)}</span>
          <span class="ta">${esc(t.artist || '')}</span>
        </button>`);
      box.addEventListener('click', () => act(t.called ? 'uncall' : 'call', { trackId: t.id }));
      return box;
    }));
    if (!shown.length) list.appendChild(node('<div class="tiny">Nothing matches that.</div>'));
  };

  const input = el.querySelector('#trackFilter');
  input.addEventListener('input', (e) => { filter = e.target.value; paint(); });
  paint();
  return el;
}

/*
 * RULE 4 EXISTS ON A BINGO NIGHT TOO, AND IT USED TO DRAW NOTHING.
 *
 * `joinsWaiting` is computed by `session.joins` and delivered in every payload
 * whichever game is running — 80 held phones confirmed — and this panel never
 * looked at it. So the door was held, every held phone read *"The host is
 * letting everybody in"*, and the host had no number and no button: rule 4
 * without its one control.
 *
 * The panel is shared with the quiz rather than copied, which is also what
 * keeps its wording and its reasoning in one place.
 */
function playersPanel(s, act) {
  /*
   * TWELVE, AND A WAY PAST IT — because messaging one phone arrived on this
   * panel and the cap then hid people from a control rather than from a
   * readout.
   *
   * The twelve is right for what this panel is FOR: who is about to win,
   * closest first, readable at a glance while a record is playing. It was
   * wrong the moment the row grew a control, and *a cap with no way past it is
   * the only kind this app must not have* — the rule already written here for
   * the pack shelf. So the default is unchanged and the fold is one button.
   */
  const everyone = s.players || [];
  const closest = showEveryPhone ? everyone : everyone.slice(0, 12);
  const hidden = everyone.length - closest.length;
  /*
   * AND WHEN THE ROUND HAS STALLED, SAY SO. `stalled` is the engine's own
   * count of people who have completed the card and already hold a prize — so
   * nobody can claim this stage and it will wait for a card that may never
   * land. The host has *Play on*, *New round* and *Finish*; what they did not
   * have was knowing.
   */
  /*
   * `noneLeft` OUTRANKS `stalled`, AND IT MUST NOT SAY "play on".
   * One prize each is absolute now, so when every phone in the room holds one
   * this prize can never be claimed — and the advice that fits `stalled`
   * ("play on, a card may still land") is then a host calling songs at a room
   * that cannot answer. Two states, two sentences, one line drawn.
   */
  const stalled = s.noneLeft
    ? `<div class="tiny" style="color:var(--gold);padding:6px 0">Everybody has a prize, so
      nobody can claim this one — one each per round. Start a new round to open it up, or
      finish here.</div>`
    : s.stalled
      ? `<div class="tiny" style="color:var(--gold);padding:6px 0">${s.stalled} ${
        s.stalled === 1 ? 'card is' : 'cards are'} complete and already holding a prize — nobody
        else can claim this one. Play on, start a new round, or hand it over yourself.</div>`
      : '';
  const el = node(`
    <div>
    <div class="joinq-slot"></div>
    <div class="panel">
      <h3>${s.onesAway} one square away — closest first</h3>
      ${stalled}
      <div class="plist">
        ${closest.map((p) => `
          <div class="prow" data-id="${esc(p.id)}" data-name="${esc(p.name)}">
            <span class="nm">${esc(p.name)}</span>
            ${p.won ? '<span class="tick">WON</span>' : ''}
            ${p.falseCalls ? `<span class="off">${p.falseCalls} false</span>` : ''}
            ${noteMark(s, p)}
            <span class="sc ${p.away === 1 ? 'hot' : ''}">${p.away === 0 ? '✓' : p.away}</span>
            <button data-act="note" title="Send this phone a message — only they see it">✉</button>
          </div>`).join('') || '<div class="tiny">Nobody has joined yet.</div>'}
      </div>
      ${everyone.length > 12 ? `<button class="minor tidy" id="showEveryPhone">${hidden > 0
    ? `Show all ${everyone.length} phones` : 'Back to the closest twelve'}</button>` : ''}
    </div>
    </div>`);
  const queue = joinQueuePanel(s, act);
  if (queue) el.querySelector('.joinq-slot').replaceWith(queue);

  el.querySelector('#showEveryPhone')?.addEventListener('click', () => {
    showEveryPhone = !showEveryPhone;
    /*
     * REBUILT IN PLACE, because this panel is not the page's to re-render.
     * Waiting for the next state push would mean the fold opened whenever the
     * next phone happened to mark a square — which during a quiet stretch is
     * a control that does nothing when pressed, the exact fault this repo
     * records for the rail's own folds.
     */
    el.replaceWith(playersPanel(s, act));
  });

  /*
   * ONE BUTTON, NOT THE QUIZ'S WHOLE MENU. A bingo player has no score to
   * nudge and the quiz's menu is three quarters score buttons — so this row
   * gets the one action that means anything here, and the quiz keeps its menu.
   */
  el.querySelectorAll('[data-act="note"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const row = btn.closest('.prow');
      askAndSendNote(act, row.dataset.id, row.dataset.name);
    });
  });
  return el;
}

function claimsPanel(s) {
  return node(`
    <div class="panel">
      <h3>Calls</h3>
      <div class="plist">
        ${s.claims.map((c) => `
          <div class="prow">
            <span class="nm">${esc(c.name)}</span>
            <span class="sc" style="color:${c.valid ? 'var(--good)' : 'var(--bad)'}">${
  /*
   * FOUR OUTCOMES, NOT TWO — a correct call that took no prize has to be told
   * apart from both. The room heard the shout and is looking at the host, so
   * "GOOD" alone would have them handing over a prize that went elsewhere, and
   * "false alarm" would call a right answer wrong. See the one-prize-each rule
   * in `bingo.js`.
   *
   * And the two kinds of "took no prize" are different sentences, because one
   * is about the PLAYER and the other is about the CLOCK: "had one" is a fact
   * about them and is simply untrue of somebody beaten to a stage by a beat.
   */
  c.tooLate ? 'GOOD — just missed it'
    : (c.standDown ? 'GOOD — had one' : (c.valid ? 'GOOD' : 'false alarm'))}</span>
          </div>`).join('')}
      </div>
    </div>`);
}
