/**
 * READY FOR TONIGHT — one line on the launch bar that goes green.
 *
 * Asked for as a structural change rather than a feature: *"once it's running
 * I want it to be flawless and never fail in the night."* Every guard in
 * `scripts/` proves the app works in a container; nothing told the quizmaster
 * at the venue at seven o'clock, with the room filling up, that it works HERE
 * — the server is answering, a projector is open on their room, and the venue
 * has prizes on it. Those three are most of what has cost a gig so far, and
 * each is silent until it is too late: a projector nobody opened is a lobby
 * nobody can join, and no prizes is a winner with a blank phone.
 *
 * **IT IS A LIGHT, NOT A GATE.** It never stands Launch down and nothing reads
 * it but the person looking. The prize gate that does stand Launch down is
 * `noPrizesReason()` next door, with its own fail-open reasoning; this line
 * repeats the ANSWER, never the decision. A light that is wrong must not stop
 * a night, so a poll that fails says so in words and changes nothing else.
 *
 * **THE FACTS ONLY THE SERVER HOLDS COME FROM `/api/host/ready`**, polled
 * while the console is open and the tab is visible. The bar is rebuilt on
 * every render, so the line registers itself as it is built and the poll
 * repaints whichever one is on the page — there is one interval, ever, and it
 * costs one small request every few seconds, on the quiet list.
 *
 * A leaf, like `console-warnings.js`: no state module, no page boot code.
 */

import { node } from './client.js';
import { keyed, screenLink } from './console.js';

const POLL_MS = 5_000;

let latest = null;       // { screens, phones } from the last poll, or an error
let current = null;      // the line on the page right now, if any
let facts = null;        // what the builder was last handed, for a repaint
let timer = null;

/**
 * Build the line. `prizesOk` is the console's own answer (it has the venue
 * records); `venueName` is for the words. Both may be unknown while the
 * library is loading, which reads as "checking" rather than as a fault.
 */
export function readyLine({ venueName, prizesOk }) {
  facts = { venueName, prizesOk };
  current = node('<div class="lb-say lb-ready" role="status"></div>');
  paint();
  startPolling();
  return current;
}

function paint() {
  if (!current) return;
  const { venueName, prizesOk } = facts || {};
  const parts = [];
  let allGood = true;
  let down = false;
  if (!latest) {
    parts.push('checking the server…');
    allGood = false;
  } else if (latest.error) {
    parts.push('the server is not answering');
    allGood = false;
    down = true;
  } else if (latest.screens > 0) {
    parts.push(latest.screens > 1 ? `${latest.screens} projectors open` : 'projector open');
  } else {
    parts.push(`no projector open yet — <a href="${screenLink()}" target="_blank" rel="noopener">open it</a>`);
    allGood = false;
  }
  if (prizesOk === true) parts.push(`${venueName ? venueName + ' — ' : ''}prizes set`);
  else if (prizesOk === false) { parts.push(venueName ? `no prizes on ${venueName}` : 'no venue picked'); allGood = false; }
  else parts.push('checking the prizes…');
  if (latest && !latest.error && latest.phones > 0) parts.push(`${latest.phones} phone${latest.phones === 1 ? '' : 's'} in`);

  current.classList.toggle('lb-ready-ok', allGood);
  current.classList.toggle('lb-ready-down', down);
  current.innerHTML = `<b>${allGood ? 'Ready for tonight' : 'Not ready yet'}</b> — ${parts.join(' · ')}`;
}

function startPolling() {
  if (timer) return;
  const tick = async () => {
    /*
     * STOP WHEN THE LINE HAS LEFT THE PAGE and nothing has rebuilt it — but
     * not on the first tick. `readyLine()` hands its node BACK to the caller,
     * who attaches it, so at the moment this first runs the node is still
     * detached: the first build checked `isConnected` here, cleared its own
     * interval before ever asking the server, and the light sat on "checking
     * the server…" for ever. Found by the screenshot, with every unit test
     * green — *a test that the payload is right proves nothing about whether
     * anybody drew it.* `scripts/ready-light.mjs` waits for the green now.
     */
    if (current && !current.isConnected && latest !== null) { latest = null; clearInterval(timer); timer = null; return; }
    if (document.visibilityState !== 'visible') return;
    try {
      const res = await fetch(keyed('/api/host/ready'), { cache: 'no-store' });
      latest = res.ok ? await res.json() : { error: `HTTP ${res.status}` };
    } catch (err) {
      latest = { error: err.message || 'no reply' };
    }
    paint();
  };
  timer = setInterval(tick, POLL_MS);
  // After the caller has attached the node, never before.
  setTimeout(tick, 0);
}
