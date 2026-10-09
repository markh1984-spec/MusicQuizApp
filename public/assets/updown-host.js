/**
 * UP OR DOWN ON THE CONTROL VIEW — what the room is saying, and the one button
 * that moves the game on.
 *
 * A LEAF, imported by `host.js`: **a page module may not be imported by
 * another page.** The live split (how many said higher, how many lower) is
 * the HOST'S — the projector only says how many have voted, so the back of
 * the room cannot copy the front. **ONE FILLED BUTTON**, the next thing to do:
 * deal, turn the card, next card, carry on. Finish takes two presses, never a
 * native `confirm()`.
 */
import { esc, node } from './client.js';
import { saidAloud } from './deck.js';
import { nextPartWord } from './race-host.js';

const SAID = { higher: 'Higher', lower: 'Lower', same: 'A pair' };

export function upDownPanel(s) {
  const u = s.updown;
  if (!u) {
    return [node(`
      <div class="panel udpanel">
        <h3>${s.phase === 'finished' ? 'Finished' : 'Ready to deal'}</h3>
        <div class="race-count"><b>${s.playerCount}</b> ${s.playerCount === 1 ? 'phone' : 'phones'} in</div>
        <div class="tiny">A card goes up; every phone says higher or lower; wrong is out. Nobody goes out on a pair, and if everybody is wrong, nobody goes.</div>
      </div>`)];
  }
  if (s.phase === 'done' || (s.phase === 'finished' && u.winner)) {
    const w = u.winner || {};
    return [node(`
      <div class="panel udpanel">
        <h3>${esc(w.name || 'Nobody')} won</h3>
        <div class="tiny">${w.code ? `Their drink is on their phone — <b>${esc(w.code)}</b>.` : 'Nothing on the prize list, so no drink was sent.'}</div>
      </div>`)];
  }
  if (s.phase === 'shown') {
    return [node(`
      <div class="panel udpanel">
        <h3>${esc(SAID[u.said] || '')} — ${esc(saidAloud(u.next))}</h3>
        <div class="ud-split-host">${u.lastUp || 0} said higher · ${u.lastDown || 0} said lower</div>
        <div class="tiny">${u.pair ? 'A pair: nobody goes out.' : u.everyoneWrong ? 'Everybody was wrong, so nobody goes out.'
          : (u.outNames || []).length ? `Out: ${esc(u.outNames.join(', '))}.` : 'Nobody out.'} <b>${u.alive}</b> still in.</div>
      </div>`)];
  }
  return [node(`
    <div class="panel udpanel live">
      <h3>${esc(saidAloud(u.card))} — higher or lower?</h3>
      <div class="ud-split-host">${u.up} higher · ${u.down} lower · ${Math.max(0, u.alive - u.up - u.down)} yet to say</div>
      <div class="tiny">Card ${u.turn}. ${u.alive} of ${u.entrants} still in. Only you see the split.</div>
    </div>`)];
}

export function upDownActions(s, act, minorButton) {
  const u = s.updown;
  const order = s.runningOrder;
  const next = order && order.nextKind ? nextPartWord(order.nextKind) : '';
  const prize = s.nextPrize || '';
  const enough = (s.playerCount || 0) >= (s.minPlayers || 2);
  const deal = !enough ? 'Needs two phones to play'
    : `${s.gamesRun ? 'Play again' : 'Deal Up or Down'} — ${prize ? `winner gets ${prize}` : 'no prize on the list'}`;
  const out = [];
  const primary = (label, handler, disabled = false) => {
    const b = node(`<button class="primary" ${disabled ? 'disabled' : ''}>${esc(label)}</button>`);
    b.addEventListener('click', handler);
    out.push(b);
  };
  const finish = () => {
    let armed = false;
    const b = minorButton('Finish here', () => {
      if (!armed) { armed = true; b.textContent = 'Press again to finish the night'; return; }
      act('finish');
    }, true);
    return b;
  };
  if (s.phase === 'finished') return out;
  if (s.phase === 'guessing') { primary('Turn the card', () => act('updownTurn')); return out; }
  if (s.phase === 'shown') { primary('Next card', () => act('updownNext')); return out; }
  // The lobby, or a game just won.
  if (s.phase === 'done' && next) {
    primary(`Continue to ${next}`, () => act('advanceOrder'));
    out.push(minorButton(deal, () => act('updownStart')));
    return out;
  }
  primary(deal, () => act('updownStart'), !enough);
  if (next && !u) out.push(minorButton(`Skip to ${next}`, () => act('advanceOrder')));
  else if (!next) out.push(finish());
  return out;
}

export function upDownWhere(s) {
  const u = s.updown;
  if (s.phase === 'finished') return 'Up or Down — finished';
  if (s.phase === 'done') return 'Up or Down — a winner';
  if (u && (s.phase === 'guessing' || s.phase === 'shown')) return `Up or Down — card ${u.turn}, ${u.alive} still in`;
  return 'Up or Down — ready to deal';
}
