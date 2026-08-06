/**
 * The caller's view for bingo.
 *
 * You play a track in your DJ app, then tap it here. That is the whole job.
 * Search is at the top because forty tracks is too many to scroll past while
 * a record is playing.
 */

import { esc, node } from './client.js';

let filter = '';

export function bingoPanels(s, act) {
  const panels = [];

  if (s.win) panels.push(winPanel(s, act));
  panels.push(callerPanel(s, act));
  panels.push(playersPanel(s));
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
  const primaryLabel = s.phase === 'lobby'
    ? 'Start — then call your first track'
    : s.win
      ? (stage.last ? 'Finish the game' : `Play on for ${nextLabel}`)
      : 'Tap a track above as you play it';

  const primary = node(`<button class="primary" ${!s.win && s.phase !== 'lobby' ? 'disabled' : ''}>${esc(primaryLabel)}</button>`);
  primary.addEventListener('click', () => {
    if (s.phase === 'lobby') act('start');
    else if (s.win) act(stage.last ? 'finish' : 'playOn');
  });
  out.push(primary);

  out.push(minor('Undo call', () => act('undoCall')));
  out.push(minor('New round', () => {
    if (confirm('New cards for everyone and nothing called. Carry on?')) act('newRound');
  }));
  out.push(minor('Console', () => { location.href = '/console' + location.search; }));
  out.push(minor('Finish', () => {
    if (confirm('End the game and save the result?')) act('finish');
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

function playersPanel(s) {
  const closest = (s.players || []).slice(0, 12);
  return node(`
    <div class="panel">
      <h3>${s.onesAway} one square away — closest first</h3>
      <div class="plist">
        ${closest.map((p) => `
          <div class="prow">
            <span class="nm">${esc(p.name)}</span>
            ${p.won ? '<span class="tick">WON</span>' : ''}
            ${p.falseCalls ? `<span class="off">${p.falseCalls} false</span>` : ''}
            <span class="sc ${p.away === 1 ? 'hot' : ''}">${p.away === 0 ? '✓' : p.away}</span>
          </div>`).join('') || '<div class="tiny">Nobody has joined yet.</div>'}
      </div>
    </div>`);
}

function claimsPanel(s) {
  return node(`
    <div class="panel">
      <h3>Calls</h3>
      <div class="plist">
        ${s.claims.map((c) => `
          <div class="prow">
            <span class="nm">${esc(c.name)}</span>
            <span class="sc" style="color:${c.valid ? 'var(--good)' : 'var(--bad)'}">${c.valid ? 'GOOD' : 'false alarm'}</span>
          </div>`).join('')}
      </div>
    </div>`);
}
