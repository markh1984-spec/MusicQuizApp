/**
 * The big screen, in bingo mode.
 *
 * Shows the track you just played, everything played so far, and how many
 * teams are one square away — which is the bit that makes a room noisy.
 *
 * It never shows the tracks you have NOT played yet. The whole game is not
 * knowing what is coming, and half the room would sit reading the screen
 * instead of listening.
 */

import { esc, node } from './client.js';

const cards = {
  lobby: { key: () => 'bingo:lobby', render: renderLobby, update: updateLobby },
  playing: { key: (s) => `bingo:playing:${s.round}`, render: renderPlaying, update: updatePlaying },
  won: { key: (s) => `bingo:won:${s.win && s.win.at}`, render: renderWin },
  finished: { key: () => 'bingo:finished', render: renderFinished },
};

export function bingoCard(state) {
  return cards[state.phase] || cards.lobby;
}

export function bingoTopbar(state) {
  return state.phase === 'lobby'
    ? 'Join now'
    : state.target === 'full'
      ? 'Playing for a full house'
      : `Round ${state.round} — one line`;
}

// ------------------------------------------------------------------- lobby

function renderLobby(s, joinUrl) {
  return node(`
    <div class="lobby" style="display:flex;flex-direction:column;height:100%">
      <div class="lobby-grid" style="flex:1 1 auto;min-height:0">
        <div>
          <h1 class="grad-text">${esc(s.title)}</h1>
          <div class="sub">Scan the code. Your card appears on your phone.</div>
          <ol class="join-steps">
            <li><span class="n">1</span><span>Point your camera at the code</span></li>
            <li><span class="n">2</span><span>Type in a team name</span></li>
            <li><span class="n">3</span><span>Tap a song when you hear it</span></li>
          </ol>
          <div class="muted" style="font-size:2.1vh;margin-top:2.5vh">
            Every card is different, and it is yours for the whole round.
          </div>
        </div>
        <div class="qr-panel">
          <img src="/join-qr.svg" alt="Scan to get your bingo card">
          <div class="url" id="joinUrl">${esc(joinUrl || '')}</div>
        </div>
      </div>
      <div class="player-strip" id="playerStrip"></div>
    </div>
  `);
}

function updateLobby(s) {
  const strip = document.getElementById('playerStrip');
  if (!strip) return;
  const wanted = (s.lobby && s.lobby.players) || [];
  const have = new Set([...strip.children].map((c) => c.dataset.id));
  for (const p of wanted) {
    if (!have.has(p.id)) strip.prepend(node(`<div class="player-chip" data-id="${esc(p.id)}">${esc(p.name)}</div>`));
  }
  const ids = new Set(wanted.map((p) => p.id));
  for (const child of [...strip.children]) if (!ids.has(child.dataset.id)) child.remove();
}

// ----------------------------------------------------------------- playing

function renderPlaying(s) {
  return node(`
    <div class="bingo-play">
      <div class="now-playing" id="nowPlaying"></div>
      <div class="called-wrap">
        <div class="called-head">
          <span class="pill">Call sheet — played so far <b id="calledCount">${s.calledCount}</b></span>
          <span class="pill tension" id="tension"></span>
        </div>
        <div class="called-list" id="calledList"></div>
      </div>
    </div>
  `);
}

function updatePlaying(s) {
  const now = document.getElementById('nowPlaying');
  if (now) {
    const t = s.lastCalled;
    now.innerHTML = t
      ? `<div class="np-label">Just played</div>
         <div class="np-title">${esc(t.title)}</div>
         <div class="np-artist">${esc(t.artist || '')}</div>`
      : `<div class="np-label">Get ready</div><div class="np-title grad-text">First one coming up</div>`;
    // Re-run the entrance animation whenever the track changes.
    if (now.dataset.track !== (t ? t.id : '')) {
      now.dataset.track = t ? t.id : '';
      now.classList.remove('pop-in');
      void now.offsetWidth;
      now.classList.add('pop-in');
    }
  }

  const count = document.getElementById('calledCount');
  if (count) count.textContent = s.calledCount;

  const tension = document.getElementById('tension');
  if (tension) {
    tension.textContent = s.onesAway > 0
      ? `${s.onesAway} team${s.onesAway === 1 ? '' : 's'} one away`
      : `${s.playerCount} playing`;
    tension.classList.toggle('hot', s.onesAway > 0);
  }

  const list = document.getElementById('calledList');
  if (list) {
    // ALPHABETICAL, not in the order they were played. Half the room is here
    // for a drink and is scanning for "have they done Africa yet?" — hunting
    // through play order for that is exactly the bit that puts people off.
    // The one they just played is called out separately above anyway.
    const called = [...(s.called || [])].sort((a, b) => a.title.localeCompare(b.title, 'en-GB'));
    const newestId = s.lastCalled ? s.lastCalled.id : null;
    if (list.dataset.n !== String(called.length)) {
      list.dataset.n = String(called.length);
      list.replaceChildren(...called.map((t) => node(
        `<div class="called-chip ${t.id === newestId ? 'newest' : ''}">
           <span class="ct">${esc(t.title)}</span>
           <span class="ca">${esc(t.artist || '')}</span>
         </div>`)));
    }
  }
}

// --------------------------------------------------------------------- win

function renderWin(s) {
  const win = s.win || {};
  const falseAlarm = s.falseAlarm;
  return node(`
    <div class="winner">
      <div class="kicker">${win.pattern === 'full' ? 'Full house' : 'Bingo'}</div>
      <h1 class="grad-text">${esc(win.name || 'Somebody')}</h1>
      <div class="score">${win.pattern === 'full' ? 'Full card' : 'A full line'}</div>
      ${falseAlarm ? `<div class="runners"><span>Honourable mention to ${esc(falseAlarm.name)} for the false alarm</span></div>` : ''}
    </div>
  `);
}

function renderFinished(s) {
  const line = (s.winners && s.winners.line) || [];
  const full = (s.winners && s.winners.full) || [];
  return node(`
    <div class="winner">
      <div class="kicker">That is your lot</div>
      <h1 class="grad-text">${esc(s.title)}</h1>
      <div class="runners" style="flex-direction:column;gap:1.4vh">
        ${line.length ? `<span>Line: ${line.map(esc).join(', ')}</span>` : ''}
        ${full.length ? `<span>Full house: ${full.map(esc).join(', ')}</span>` : ''}
      </div>
    </div>
  `);
}
