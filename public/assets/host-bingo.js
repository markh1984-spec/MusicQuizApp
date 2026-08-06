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

  const primaryLabel = s.phase === 'lobby'
    ? 'Start — then call your first track'
    : s.win
      ? (s.target === 'full' ? 'Finish the game' : 'Play on for a full house')
      : 'Tap a track above as you play it';

  const primary = node(`<button class="primary" ${!s.win && s.phase !== 'lobby' ? 'disabled' : ''}>${esc(primaryLabel)}</button>`);
  primary.addEventListener('click', () => {
    if (s.phase === 'lobby') act('start');
    else if (s.win) act(s.target === 'full' ? 'finish' : 'playOn', { target: 'full' });
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
      <h3>${s.win.pattern === 'full' ? 'Full house' : 'Line'} claimed — and it checks out</h3>
      <div class="cue">
        <div class="track">${esc(s.win.name)}</div>
        <div class="from">Verified against what you actually played.</div>
      </div>
    </div>`);
}

function callerPanel(s, act) {
  const el = node(`
    <div class="panel">
      <h3>Tap a track when you have played it — ${s.calledCount} of ${s.trackCount} called</h3>
      <input type="text" id="trackFilter" placeholder="Search the list…" value="${esc(filter)}" style="width:100%;margin-bottom:10px">
      <div class="tracklist" id="trackList"></div>
    </div>`);

  const list = el.querySelector('#trackList');
  const paint = () => {
    const needle = filter.trim().toLowerCase();
    const shown = (s.tracks || []).filter((t) =>
      !needle || t.title.toLowerCase().includes(needle) || (t.artist || '').toLowerCase().includes(needle));

    list.replaceChildren(...shown.map((t) => {
      const row = node(`
        <button class="trackrow ${t.called ? 'called' : ''}" data-id="${esc(t.id)}">
          <span class="tick">${t.called ? '✓' : ''}</span>
          <span class="tt">${esc(t.title)}</span>
          <span class="ta">${esc(t.artist || '')}</span>
        </button>`);
      row.addEventListener('click', () => act(t.called ? 'uncall' : 'call', { trackId: t.id }));
      return row;
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
