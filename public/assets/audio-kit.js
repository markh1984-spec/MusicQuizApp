/**
 * THE WEB AUDIO PRIMITIVES, IN ONE PLACE — the context, an envelope and a
 * noise source.
 *
 * Extracted on 11 September 2026 when the host asked for a soundboard:
 * *"a comedy wrong answer sound… maybe a crowd's clapping sound, a few other
 * things in, like, a sound board."* That is a second set of synthesised
 * sounds in this app, and **two copies of an audio layer is two layers that
 * get fixed once** — the same argument `src/arcade.js` exists for.
 *
 * What is HERE is the plumbing every synthesised sound needs. What is NOT
 * here is policy, and the two callers have opposite policy:
 *
 * - **`lobby-sound.js`** is sixty phones in a room. It is gated on this
 *   phone's own remembered preference AND the host's switch for tonight, it
 *   never carries information, and everything it makes is under a fifth of a
 *   second.
 * - **`stings.js`** is ONE laptop wired into the PA, fired deliberately by
 *   the quizmaster. There is no preference to respect — a press IS the
 *   decision — and the sounds are long enough to land in a room.
 *
 * So the gates stay with their own module and only the waveform machinery is
 * shared.
 *
 * **IT IS SYNTHESISED, LIKE EVERYTHING IN THIS APP IS DRAWN.** No `.mp3`, no
 * `.wav`, no library — nothing to 404 on a venue's wifi, no bytes over the one
 * connection that must not stutter, and no dependency that can break on a gig
 * night.
 */

let ctx = null;

/**
 * The shared context, made on first use and resumed if the browser suspended
 * it.
 *
 * **A BROWSER WILL NOT MAKE A SOUND UNTIL THE PAGE HAS BEEN TAPPED ONCE**, and
 * every modern one starts an `AudioContext` in `suspended`. That is why
 * `resume()` is called from a real gesture rather than at load: a context
 * created without one is silent for ever and reports no error at all.
 */
export function audio() {
  try {
    if (!ctx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return null;
      ctx = new Ctx();
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  } catch { ctx = null; return null; }
}

/** Is there a live context — asked by anything that must not throw. */
export function audioReady() {
  return Boolean(ctx && ctx.state === 'running');
}

/**
 * An attack-and-decay gain stage, connected to the output.
 *
 * `exponentialRampToValueAtTime` cannot reach zero, which is why both ends are
 * 0.0001 rather than 0 — a real zero throws and takes the whole sound with it.
 *
 * **NEVER START THE NODE BEFORE `at`.** A `GainNode` defaults to 1.0 and this
 * only pins it from `at` onwards, so anything sounding earlier goes out at
 * FULL VOLUME until the envelope catches up. It cost a clipping ding: the
 * quietest sting in the soundboard measured the loudest, and turning its gain
 * down threefold barely moved it, because the spike was a ten-millisecond
 * window and not the gain at all. `soundboard.mjs` measures a peak ceiling
 * for exactly this.
 */
export function env(node, at, peak, len, out) {
  const c = ctx;
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(peak, at + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, at + len);
  node.connect(g);
  g.connect(out || c.destination);
  return g;
}

/** White noise, which is the raw material of anything percussive. */
export function noise(len) {
  const c = ctx;
  const n = Math.max(1, Math.floor(c.sampleRate * len));
  const buf = c.createBuffer(1, n, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource();
  src.buffer = buf;
  return src;
}
