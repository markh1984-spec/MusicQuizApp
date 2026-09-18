/**
 * WHAT THE APP SAW TONIGHT — the flight recorder, on the Help tab, with a
 * Copy button.
 *
 * Asked for after a night the launch would not go and the diagnosis took an
 * hour: *"literally anything that goes wrong, you can have a report so you
 * can action it straight away."* The server keeps the record
 * (`src/flight.js`); this is the one place a quizmaster reads it back. A
 * paragraph pasted into the chat is the whole bug report — the boot, the
 * self-test, every refusal with its reason, every phase the night reached,
 * and what the phones and the console saw throw.
 *
 * A LEAF, like `console-ready.js`: it imports `node` and `esc` and nothing
 * from the console, so it cannot land in anybody's temporal dead zone. It is
 * handed nothing and fetches for itself, because the report is read on
 * demand and never rides in `/api/me`.
 *
 * COPY IS THE POINT. `navigator.clipboard` needs a secure context and a
 * user gesture, both of which a Copy button on an https console has; where
 * it is refused the text is SELECTED instead and the line says so, exactly
 * as the referral link's copy does one panel up.
 */

import { esc, node } from './client.js';

const LINES = 80;

/**
 * `account` names whose record to draw — the owner's page passes an account
 * id, or `'all'` for the whole server; a quizmaster passes nothing and gets
 * their own. The words say whose it is, because the owner's picker sits
 * above the same panel.
 */
export function flightPanel({ account = '', who = '' } = {}) {
  const query = account === 'all' ? '?all=1' : account ? `?account=${encodeURIComponent(account)}` : '';
  const subject = account === 'all' ? 'the whole server' : who ? `${who}'s room` : 'this room';
  const el = node(`
    <div class="panel flight-panel">
      <h3>What the app saw tonight</h3>
      <div class="tiny">The server's own record of ${esc(subject)}: the boot, its self-test, every refusal and what each screen reported. Paste it into the chat and the fault is usually named on the first read.${account ? '' : ' The owner can read this record too, to help with a problem.'}</div>
      <div class="tiny flight-self"></div>
      <pre class="flight-text" tabindex="0">Loading…</pre>
      <div class="row">
        <button class="minor flight-copy" type="button">Copy</button>
        <button class="minor flight-refresh" type="button">Refresh</button>
        <span class="tiny flight-said"></span>
      </div>
    </div>`);
  const pre = el.querySelector('.flight-text');
  const self = el.querySelector('.flight-self');
  const said = el.querySelector('.flight-said');
  let text = '';

  async function refresh() {
    try {
      const res = await fetch(`/api/flight${query}`, { cache: 'no-store' });
      if (!res.ok) throw new Error(`answered ${res.status}`);
      const data = await res.json();
      const lines = String(data.text || '').split('\n').filter(Boolean);
      text = lines.slice(-LINES).join('\n');
      pre.textContent = text || 'Nothing recorded yet.';
      const st = data.selfTest;
      self.textContent = !st ? 'Self-test: not run yet.'
        : st.ok ? `Self-test at boot: passed ${st.steps} steps in ${st.ms}ms.`
          : `Self-test at boot FAILED: ${st.failed.join('; ')}`;
      self.classList.toggle('bad', Boolean(st && !st.ok));
    } catch (err) {
      pre.textContent = `Could not read the record: ${err.message}`;
    }
  }

  el.querySelector('.flight-refresh').addEventListener('click', () => { said.textContent = ''; refresh(); });
  el.querySelector('.flight-copy').addEventListener('click', async () => {
    const stamp = `Quizporium — what the app saw (${subject}), ${new Date().toLocaleString('en-GB')}, ${location.host}\n${self.textContent}\n\n`;
    try {
      await navigator.clipboard.writeText(stamp + text);
      said.textContent = 'Copied.';
    } catch {
      const range = document.createRange();
      range.selectNodeContents(pre);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
      said.textContent = 'Selected — copy it from there.';
    }
  });
  refresh();
  return el;
}

