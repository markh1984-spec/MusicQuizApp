/**
 * PUB PRIX ON THE CONTROL VIEW — start it, end it, take it down.
 *
 * A LEAF, imported by `host.js`, whose panel list is shared by the quiz, both
 * bingos and the DJ desk in one line — so the race is drawn in one place.
 * **A page module may not be imported by another page**, which is why this is
 * its own file rather than a function in `host.js` or `host-bingo.js`.
 *
 * **PRESENT AND INERT OUTSIDE A BREAK, WITH THE REASON ON THE BUTTON** — the
 * rule this app keeps for every control: one that comes and goes is one a
 * thumb cannot learn the place of. The DJ desk is the exception, because a set
 * has no break and no prize list, so a race is not a thing it can ever do.
 *
 * **THE PRIZE IS NAMED ON THE BUTTON**, the funniest photo's rule: it is the
 * last drink on tonight's list, and the person holding the microphone is the
 * one who knows whether that is budgeted.
 */
import { esc, node, ordinal } from './client.js';

/** Where a race may start, per game — the engines refuse everywhere else. */
function atABreak(s) {
  if (s.game === 'quiz' || !s.game) return s.phase === 'round_board';
  return s.phase === 'won';
}

function whyNot(s) {
  if (s.game === 'quiz' || !s.game) return 'Between rounds — at the scores';
  return 'Between rounds — once the prize has gone';
}

export function racePanel(s, act) {
  if (s.game === 'dj') return [];
  if (s.game === 'race') return racePartPanel(s);
  const r = s.race;
  const prize = s.photoVotePrize || '';

  if (r && r.phase === 'racing') {
    const el = node(`
      <div class="panel racepanel live">
        <h3>Pub Prix — racing</h3>
        <div class="race-count"><b>${r.started}</b> of ${r.karts} karts moving</div>
        <div class="tiny">It ends itself ten seconds after the first kart home.
          Pressing on, or the scores, ends it now — the leader wins.</div>
        <div class="row"><button class="minor" data-race="close">End the race now</button></div>
      </div>`);
    el.querySelector('[data-race="close"]').addEventListener('click', () => act('raceClose'));
    return [el];
  }

  if (r && r.phase === 'done') {
    const w = r.winner;
    const podium = (r.results || []).map((x) => `
      <li><span class="race-place">${ordinal(x.place)}</span> ${esc(x.name)}${
        x.time !== null && x.time !== undefined ? ` <span class="tiny">${x.time.toFixed(1)}s</span>` : ''}</li>`).join('');
    const drink = !w ? 'Nobody started their engine, so nobody won.'
      : w.code ? `${esc(w.name)}'s drink is on their phone — <b>${esc(w.code)}</b>.`
        : 'Nothing on the prize list, so no drink was sent.';
    const el = node(`
      <div class="panel racepanel">
        <h3>Pub Prix — ${w ? `${esc(w.name)} won` : 'no winner'}</h3>
        ${podium ? `<ol class="race-podium">${podium}</ol>` : ''}
        <div class="tiny">${drink}</div>
        <div class="row"><button class="minor" data-race="drop">Take it off the big screen</button></div>
      </div>`);
    el.querySelector('[data-race="drop"]').addEventListener('click', () => act('raceDrop'));
    return [el];
  }

  const phones = s.phoneCount ?? s.playerCount ?? 0;
  const ready = atABreak(s);
  const enough = phones >= 2;
  const label = !ready ? whyNot(s)
    : !enough ? 'Needs two phones to race'
      : prize ? `Start Pub Prix — winner gets ${prize}` : 'Start Pub Prix — no prize on the list';
  const el = node(`
    <div class="panel racepanel">
      <h3>Pub Prix</h3>
      <div class="tiny">A kart race on the big screen. Every phone steers its own — tap a lane.</div>
      <div class="row"><button class="go" data-race="open" ${ready && enough ? '' : 'disabled'}>${esc(label)}</button></div>
    </div>`);
  el.querySelector('[data-race="open"]').addEventListener('click', () => act('raceOpen'));
  return [el];
}

/*
 * ============================================ PUB PRIX AS A PART OF THE NIGHT
 *
 * `src/race-game.js`. The race IS the game here, so what the break panel
 * offers as a button lives in the action bar instead: ONE filled control,
 * the thing to press next — start, end, continue — exactly as the quiz's and
 * the bingo's bars work. This panel only says where the race has got to.
 */
function racePartPanel(s) {
  const r = s.race || {};
  if (r.phase === 'racing') {
    return [node(`
      <div class="panel racepanel live">
        <h3>Racing</h3>
        <div class="race-count"><b>${r.started}</b> of ${r.karts} karts moving</div>
        <div class="tiny">It ends itself ten seconds after the first kart home.</div>
      </div>`)];
  }
  if (r.phase === 'done') {
    const w = r.winner;
    const podium = (r.results || []).map((x) => `
      <li><span class="race-place">${ordinal(x.place)}</span> ${esc(x.name)}${
        x.time !== null && x.time !== undefined ? ` <span class="tiny">${x.time.toFixed(1)}s</span>` : ''}</li>`).join('');
    const drink = !w ? 'Nobody started their engine, so nobody won — the next race pays the same drink.'
      : w.code ? `${esc(w.name)}'s drink is on their phone — <b>${esc(w.code)}</b>.`
        : 'Nothing on the prize list, so no drink was sent.';
    return [node(`
      <div class="panel racepanel">
        <h3>${w ? `${esc(w.name)} won` : 'No winner'}</h3>
        ${podium ? `<ol class="race-podium">${podium}</ol>` : ''}
        <div class="tiny">${drink}</div>
      </div>`)];
  }
  const karts = r.karts || 0;
  return [node(`
    <div class="panel racepanel">
      <h3>${s.phase === 'finished' ? 'Finished' : 'The grid'}</h3>
      <div class="race-count"><b>${karts}</b> ${karts === 1 ? 'kart' : 'karts'} on the grid</div>
      <div class="tiny">Phones join with the code on the big screen. A selfie on the phone puts their face on their kart.</div>
    </div>`)];
}

/** What the next part is called on the Continue button. */
export function nextPartWord(kind) {
  return { quiz: 'the quiz', bingo: 'the music bingo', cards: 'the card bingo', race: 'Pub Prix' }[kind] || 'the next game';
}

/**
 * THE ACTION BAR ON A PUB PRIX PART. One filled button, the next thing to do:
 * start the race, end it, or carry on. Finish takes TWO presses (bingo's
 * `pressTwice()` rule — a native confirm can be silently suppressed).
 */
export function raceActions(s, act, minorButton) {
  const r = s.race || {};
  const order = s.runningOrder;
  const next = order && order.nextKind ? nextPartWord(order.nextKind) : '';
  const prize = s.nextPrize || '';
  const enough = (s.playerCount || 0) >= (s.minKarts || 2);
  const startLabel = !enough ? 'Needs two phones to race'
    : prize ? `${s.racesRun ? 'Race again' : 'Start the race'} — winner gets ${prize}`
      : `${s.racesRun ? 'Race again' : 'Start the race'} — no prize on the list`;
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
  if (r.phase === 'racing') {
    primary('End the race now', () => act('raceClose'));
    return out;
  }
  if (r.phase === 'done') {
    if (next) primary(`Continue to ${next}`, () => act('advanceOrder'));
    else primary(startLabel, () => act('raceOpen'), !enough);
    if (next) out.push(minorButton(startLabel, () => act('raceOpen')));
    if (!next) out.push(finish());
    return out;
  }
  primary(startLabel, () => act('raceOpen'), !enough);
  if (next) out.push(minorButton(`Skip to ${next}`, () => act('advanceOrder')));
  else out.push(finish());
  return out;
}

/** The status line's "where the game has got to". */
export function raceWhere(s) {
  const r = s.race || {};
  if (s.phase === 'finished') return 'Pub Prix — finished';
  if (r.phase === 'racing') return 'Pub Prix — racing';
  if (r.phase === 'done') return 'Pub Prix — result';
  return 'Pub Prix — on the grid';
}
