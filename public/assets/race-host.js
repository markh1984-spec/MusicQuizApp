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
