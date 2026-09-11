/**
 * THE SOUNDBOARD — six noises the quizmaster fires at the room, synthesised.
 *
 * Asked for on 11 September 2026: *"a little sound board that I can access as
 * the quiz master… if someone puts an answer that's a bit silly I can have a
 * comedy wrong answer sound, and then maybe a crowd's clapping sound, a few
 * other things… that I could access while running a quiz and music bingo."*
 *
 * ---
 *
 * **IT PLAYS ON THE PROJECTOR, NOT ON THE HOST'S PHONE, and that is the whole
 * design.** His own words on the kit: *"my sound outputs via my dj decks which
 * is picked up as a sound card on my laptop."* The laptop with the HDMI in it
 * IS the machine wired to the PA, so a page on that laptop plays down the same
 * path as the music. A phone speaker held up to a microphone is quiet, feeds
 * back, and puts the host's hand where the mic should be.
 *
 * **SYNTHESISED, NEVER SHIPPED.** No `.mp3` in a public repo, nothing to load
 * on a venue's wifi, nothing to 404 mid-gig — the same rule `qrcode.js`,
 * `brandmark.js`, `stickers.js` and `lobby-sound.js` already follow. A sad
 * trombone is a pitch slide with vibrato; applause is a few hundred noise
 * bursts. Both are a dozen lines of Web Audio.
 *
 * **AND THAT IS WHY THERE IS NO BOO AND NO LAUGHTER.** A convincing human
 * crowd noise cannot be synthesised — what comes out is a kazoo, which is the
 * lesson `lobby-sound.js` already learned about the yeehaw. Applause is the
 * exception and only because it genuinely IS filtered noise: hundreds of
 * uncorrelated claps with no pitch in them. Anything needing a human voice is
 * an asset, and an asset is the thing this file exists to avoid.
 *
 * **THESE ARE LONGER AND LOUDER THAN THE LOBBY'S**, deliberately. Those are
 * garnish on a phone in a pocket and stay under a fifth of a second; these
 * have to carry across a pub over a PA, so a trombone runs a second and a half
 * and applause two and a half. The gate is different too: there is no
 * preference to respect, because **the host pressing the button IS the
 * decision**.
 *
 * **NOTHING HERE TOUCHES THE GAME.** A sting changes no phase, no score and no
 * state file — it is an event, not a flag, and the quiz underneath carries on
 * exactly as it was. That is stricter than rule 9's scoreboard and advert,
 * which at least put something on a screen.
 */

import { audio, env, noise } from './audio-kit.js';

/**
 * How loud, relative to the lobby's 0.18.
 *
 * A PA carries this rather than a phone speaker, so the ceiling is the room's
 * amplifier and not ours — but it still goes through a mixer channel beside
 * the music, and a sting that clips is a sting the host stops using. Left with
 * headroom on purpose: the decks have a gain knob and this does not.
 */
const VOL = 0.5;

/**
 * THE SAD TROMBONE — *womp womp womp waaamp*.
 *
 * Four descending notes, the last one bent down and wobbled. A sawtooth
 * through a low-pass is a passable brass: the filter is what stops it reading
 * as a synth, and the vibrato on the last note is what makes it funny rather
 * than merely sad.
 */
function trombone(c) {
  const at = c.currentTime;
  const notes = [[233.08, 0.22], [220.00, 0.22], [207.65, 0.22], [185.00, 0.75]];
  let t = at;
  notes.forEach(([hz, len], i) => {
    const o = c.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(hz, t);
    // The last note slides away, which is the whole joke.
    if (i === notes.length - 1) o.frequency.exponentialRampToValueAtTime(hz * 0.74, t + len);
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(1100, t);
    lp.Q.value = 2;
    o.connect(lp);
    env(lp, t, VOL * 0.55, len);
    // A little wobble on the long one — a trombonist's hand, not a synth.
    if (i === notes.length - 1) {
      const lfo = c.createOscillator();
      const depth = c.createGain();
      lfo.frequency.value = 5.5;
      depth.gain.value = 6;
      lfo.connect(depth);
      depth.connect(o.frequency);
      lfo.start(t + 0.15);
      lfo.stop(t + len);
    }
    o.start(t);
    o.stop(t + len + 0.02);
    t += len * 0.92;
  });
}

/**
 * APPLAUSE — a few hundred claps, each a tiny burst of band-passed noise.
 *
 * The shape is what sells it: a fast swell in, a long ragged tail, and every
 * clap at a random time and a random brightness. Evenly spaced claps read as a
 * machine; that randomness IS the crowd.
 */
function applause(c) {
  const at = c.currentTime;
  const len = 2.4;
  const out = c.createGain();
  out.gain.setValueAtTime(0.0001, at);
  out.gain.exponentialRampToValueAtTime(VOL, at + 0.28);
  out.gain.setValueAtTime(VOL, at + 0.9);
  out.gain.exponentialRampToValueAtTime(0.0001, at + len);
  out.connect(c.destination);

  const src = noise(len);
  const bp = c.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 1400;
  bp.Q.value = 0.7;
  src.connect(bp);

  /*
   * The individual claps ride ON TOP of that bed of noise rather than instead
   * of it: the bed is the far end of the room and the claps are the near
   * tables. Noise alone is rain; claps alone are a slow hand.
   */
  const bed = c.createGain();
  bed.gain.value = 0.35;
  bp.connect(bed);
  bed.connect(out);
  src.start(at);
  src.stop(at + len);

  for (let i = 0; i < 220; i++) {
    const when = at + 0.02 + Math.random() * (len - 0.5);
    const clap = noise(0.03);
    const hp = c.createBiquadFilter();
    hp.type = 'bandpass';
    hp.frequency.value = 900 + Math.random() * 2600;
    hp.Q.value = 1.1;
    clap.connect(hp);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(0.35 + Math.random() * 0.5, when + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, when + 0.03);
    hp.connect(g);
    g.connect(out);
    clap.start(when);
    clap.stop(when + 0.04);
  }
}

/** BA-DUM-TSS — two toms and a crash, for an answer that was a joke. */
function rimshot(c) {
  const at = c.currentTime;
  [[0, 190], [0.14, 150]].forEach(([off, hz]) => {
    const o = c.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(hz, at + off);
    o.frequency.exponentialRampToValueAtTime(hz * 0.6, at + off + 0.18);
    env(o, at + off, VOL * 0.7, 0.18);
    o.start(at + off);
    o.stop(at + off + 0.2);
  });
  const when = at + 0.3;
  const cym = noise(0.7);
  const hp = c.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 5200;
  cym.connect(hp);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, when);
  g.gain.exponentialRampToValueAtTime(VOL * 0.45, when + 0.006);
  g.gain.exponentialRampToValueAtTime(0.0001, when + 0.7);
  hp.connect(g);
  g.connect(c.destination);
  cym.start(when);
  cym.stop(when + 0.72);
}

/**
 * A DING — bright, short, unmistakably "yes". Two sines a fifth apart.
 *
 * **THE QUIETEST SETTINGS IN THE FILE, AND IT MEASURED THE LOUDEST.** Two pure
 * sines started at the same instant sum IN PHASE, and a sine carries all its
 * energy at one frequency where noise spreads it — so what looked like the
 * gentlest sound on the board peaked at 1.27 and clipped, which through a PA
 * is a crack rather than a chime. `soundboard.mjs` measures the peak of every
 * sting for exactly this, and a number over the ceiling fails.
 */
function ding(c) {
  const at = c.currentTime;
  [1318.51, 1975.53].forEach((hz, i) => {
    const when = at + i * 0.01;
    const o = c.createOscillator();
    o.type = 'sine';
    o.frequency.value = hz;
    env(o, when, VOL * (i ? 0.25 : 0.6), 1.1);
    /*
     * STARTED WHEN ITS ENVELOPE STARTS, and that is the whole fix.
     *
     * The harmonic was offset 10ms to soften the attack but still started at
     * `at` — so for those 10ms it played through a gain node nobody had
     * written to yet, which defaults to **1.0**. A sound set to 0.04 peaked at
     * 1.08 and clipped, and turning its gain down threefold barely moved the
     * number, because the spike was never the gain. See `env()` in
     * `audio-kit.js`.
     */
    o.start(when);
    o.stop(when + 1.2);
  });
}

/** A DRUM ROLL — snare buzz swelling into a hit, for before a reveal. */
function drumroll(c) {
  const at = c.currentTime;
  const len = 1.6;
  for (let t = 0; t < len; t += 0.028) {
    const when = at + t;
    const hit = noise(0.02);
    const bp = c.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 2400;
    bp.Q.value = 0.8;
    hit.connect(bp);
    const g = c.createGain();
    // Swelling, so it reads as building rather than simply going on.
    const grow = 0.12 + (t / len) * 0.5;
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(VOL * grow, when + 0.003);
    g.gain.exponentialRampToValueAtTime(0.0001, when + 0.025);
    bp.connect(g);
    g.connect(c.destination);
    hit.start(when);
    hit.stop(when + 0.03);
  }
  // And the hit it was building to, or it just stops.
  const when = at + len;
  const crash = noise(0.9);
  const hp = c.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 3800;
  crash.connect(hp);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, when);
  g.gain.exponentialRampToValueAtTime(VOL * 0.7, when + 0.006);
  g.gain.exponentialRampToValueAtTime(0.0001, when + 0.9);
  hp.connect(g);
  g.connect(c.destination);
  crash.start(when);
  crash.stop(when + 0.92);
}

/** A FANFARE — four notes up to the octave, for a winner. */
function fanfare(c) {
  const at = c.currentTime;
  const notes = [[523.25, 0.14], [659.25, 0.14], [783.99, 0.14], [1046.50, 0.6]];
  let t = at;
  notes.forEach(([hz, len]) => {
    [1, 2].forEach((mult, i) => {
      const o = c.createOscillator();
      o.type = i ? 'triangle' : 'square';
      o.frequency.value = hz * mult;
      const lp = c.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 3200;
      o.connect(lp);
      env(lp, t, VOL * (i ? 0.16 : 0.4), len);
      o.start(t);
      o.stop(t + len + 0.02);
    });
    t += len * 0.95;
  });
}

/**
 * THE BOARD ITSELF — id, what the button says, and what it draws.
 *
 * **The SERVER reads this list too**, to refuse an id it does not know: a
 * sting id is one word in a request body, which is the shape of trap this
 * repo already records for pack ids and tiers. So the list is the whitelist.
 *
 * Order is the order they appear on the control view, and it is grouped by
 * what they are FOR rather than by how they sound: the two you reach for when
 * somebody has said something daft come first, because that is the moment the
 * host asked about.
 */
export const STINGS = [
  { id: 'trombone', label: 'Sad trombone', icon: '🎺', play: trombone },
  { id: 'rimshot', label: 'Ba-dum-tss', icon: '🥁', play: rimshot },
  { id: 'applause', label: 'Applause', icon: '👏', play: applause },
  { id: 'ding', label: 'Ding', icon: '🔔', play: ding },
  { id: 'drumroll', label: 'Drum roll', icon: '🪘', play: drumroll },
  { id: 'fanfare', label: 'Fanfare', icon: '🎉', play: fanfare },
];

/** Is this a sting this app actually makes? The server's whitelist. */
export function isSting(id) {
  return STINGS.some((s) => s.id === String(id || ''));
}

/**
 * Make the noise. Safe to call with anything — an unknown id is silence
 * rather than a throw, because this runs on the PROJECTOR and an exception
 * there is a blank screen in front of a room.
 */
export function playSting(id) {
  const found = STINGS.find((s) => s.id === id);
  if (!found) return false;
  const c = audio();
  if (!c) return false;
  try { found.play(c); } catch { return false; }
  return true;
}
