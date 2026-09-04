/**
 * SOUND FOR THE LOBBY GAMES — synthesised, never shipped, and the host's to
 * switch off.
 *
 * Asked for on 15 August 2026 for Quick Draw: *"when you shoot an outlaw
 * there's, like, a sound, and then, like, random yeehaws and that kind of
 * stuff."*
 *
 * ---
 *
 * **IT IS SYNTHESISED, LIKE EVERYTHING IN THIS APP IS DRAWN.** No `.mp3`, no
 * `.wav`, no audio library — the same reasoning as `qrcode.js`, `brandmark.js`
 * and `stickers.js`, and for the same three reasons: nothing to 404 on a
 * venue's wifi, no bytes over the one connection that must not stutter, and no
 * dependency that can break on a gig night. A gunshot is a burst of filtered
 * noise with a fast decay and a ricochet is a frequency sweep; both are a
 * dozen lines of Web Audio, which is in every browser this app supports.
 *
 * **AND THAT IS WHY THERE IS NO YEEHAW.** A convincing human whoop cannot be
 * synthesised — what comes out is a kazoo — and a recorded one is an asset,
 * which is the thing this file exists to avoid. So the western noises are the
 * ones that ARE a waveform: the ricochet *pee-yow*, a jaw-harp twang and a
 * saloon-piano plink. The ricochet in particular is the sound everybody
 * actually pictures when they think of a western, and it is a pure sweep.
 * Better a real ricochet than a bad yeehaw.
 *
 * **ON BY DEFAULT, and the first version had that wrong.** It shipped off, on
 * the argument that sixty phones making noises while the host is on a
 * microphone is this app talking over its own quizmaster's show. The host
 * corrected it and he is right: **the game only exists in the LOBBY.** It is
 * torn down on every phase change, the seed is sent at the lobby and nowhere
 * else, and a score is refused at any other phase — so a noise during a
 * question is not unlikely, it is impossible. The blast radius is the dead
 * time before kick-off, which is the one stretch of an evening where a bit of
 * noise off sixty phones is atmosphere rather than interruption.
 *
 * Off by default also had a cost that was easy to miss: a garnish behind a
 * small speaker icon is a garnish almost nobody ever finds, so the work is
 * spent and never heard.
 *
 * **WHAT MAKES ON-BY-DEFAULT SAFE IS THAT THE HOST CAN TURN IT OFF** — under
 * Set it up, beside the game picker, written into the game state at launch
 * like the look and the card shape. A quiet gastropub and a rowdy Friday are
 * not the same room, and that is a decision about TONIGHT. Without it the only
 * remedy would be asking sixty people to mute their phones from the stage,
 * which is not a remedy.
 *
 * **THE HOST'S SWITCH WINS.** Off from the console means silent whatever a
 * phone thinks; on means the phone's own preference decides. A quizmaster
 * saying "not tonight" must not be overridden by a setting somebody left on
 * last week.
 *
 * **REMEMBERED ON THE DEVICE, unlike almost everything else here.** The look,
 * the card shape and which game tonight are all facts about the EVENING and
 * live in the game state. Whether this particular phone makes a noise is a
 * fact about the phone and the person holding it, so it belongs in
 * `localStorage` — the same distinction the fold state and the online switch
 * are already split along.
 *
 * **IT NEVER CARRIES INFORMATION.** Every game here must be completely
 * playable in silence, and most of the room IS silent: a phone on a pub table
 * is usually on silent, and on iOS the hardware switch mutes Web Audio in
 * Safari outright. So a sound may confirm something the screen already said
 * and may never be the only way to know it.
 *
 * **NOTHING IS EVER ON A TIMER.** "Random yeehaws" is the version that
 * annoys — sixty phones chirping at nobody, forever. A noise is tied to
 * something the player DID, which self-limits beautifully: only somebody
 * actually playing well makes any, and a phone in a pocket is silent.
 */

const KEY = 'qp.lobbySound';

let ctx = null;
let on = null;
/*
 * Whether the NIGHT allows it at all — the host's switch, off the game state.
 * Defaults to allowed so a night launched before this existed, or by an older
 * deploy, behaves as it always did rather than going silent.
 */
let allowed = true;

/**
 * Told what tonight says, on every rebuild of the card. Separate from the
 * phone's own preference on purpose: turning it off for the room must not wipe
 * what somebody chose for themselves, or they have to set it again next week.
 */
export function allowSound(yes) {
  allowed = yes !== false;
}

/** Is the sound on, here, tonight? On unless this phone has said otherwise. */
export function soundOn() {
  if (on === null) {
    // Default ON — anything but an explicit '0' counts as yes, so a phone that
    // has never been asked gets sound and one that opted out stays out.
    try { on = localStorage.getItem(KEY) !== '0'; } catch { on = true; }
  }
  return allowed && on;
}

/** Flip it, and remember. Returns the new state, for the button's label. */
export function toggleSound() {
  // Flips THIS PHONE's preference. Not `!soundOn()`, which also answers to the
  // host's switch — with the room muted that would read as off and one press
  // would silently flip the phone's own setting to something nobody asked for.
  on = !(on === null ? true : on);
  try { localStorage.setItem(KEY, on ? '1' : '0'); } catch { /* private mode */ }
  if (on) resume();
  return on;
}

/**
 * A browser will not make a sound until the person has touched the page, and
 * on iOS it will not even build the context. So this is called from inside a
 * real tap — never on load — and everything else checks `ctx` before assuming.
 */
function resume() {
  try {
    if (!ctx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      ctx = new Ctx();
    }
    if (ctx.state === 'suspended') ctx.resume();
  } catch { ctx = null; }
}

/** Called on the game's first tap, so the context is alive before it is used. */
export function wakeSound() {
  if (soundOn()) resume();
}

/**
 * Everything below is deliberately SHORT — under a fifth of a second each.
 *
 * A long sting is a sound you hear over the top of the host; a short one is a
 * click somebody two tables away does not register. Kept quiet for the same
 * reason: this is garnish on a phone in a room, not a sound system.
 */
const VOL = 0.18;

function env(node, at, peak, len) {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(peak, at + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, at + len);
  node.connect(g);
  g.connect(ctx.destination);
  return g;
}

/** White noise, which is the raw material of anything percussive. */
function noise(len) {
  const n = Math.max(1, Math.floor(ctx.sampleRate * len));
  const buf = ctx.createBuffer(1, n, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  return src;
}

/**
 * A SHOT. A short burst of noise through a low-pass that shuts as it decays,
 * which is what makes a crack rather than a hiss.
 */
export function playShot() {
  if (!soundOn() || !ctx) return;
  const at = ctx.currentTime;
  const src = noise(0.16);
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.setValueAtTime(2200, at);
  lp.frequency.exponentialRampToValueAtTime(220, at + 0.14);
  src.connect(lp);
  env(lp, at, VOL, 0.16);
  src.start(at);
  src.stop(at + 0.18);
}

/**
 * THE RICOCHET — *pee-yow*. The sound everybody actually pictures when they
 * think of a western, and a pure downward sweep, so it is the one that
 * synthesises best. Kept for a STREAK rather than every hit: a noise that
 * happens every time is wallpaper, and one that means "you are on a run" is a
 * reward.
 */
export function playRicochet() {
  if (!soundOn() || !ctx) return;
  const at = ctx.currentTime;
  const o = ctx.createOscillator();
  o.type = 'sine';
  o.frequency.setValueAtTime(1800, at);
  o.frequency.exponentialRampToValueAtTime(420, at + 0.19);
  env(o, at, VOL * 0.8, 0.2);
  o.start(at);
  o.stop(at + 0.22);
}

/**
 * THE WRONG ONE. A jaw-harp style twang, low and sour, so it is unmistakably
 * "no" without being a buzzer — this app does not tell people off.
 */
export function playOops() {
  if (!soundOn() || !ctx) return;
  const at = ctx.currentTime;
  const o = ctx.createOscillator();
  o.type = 'sawtooth';
  o.frequency.setValueAtTime(180, at);
  o.frequency.exponentialRampToValueAtTime(70, at + 0.22);
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 900;
  o.connect(lp);
  env(lp, at, VOL, 0.24);
  o.start(at);
  o.stop(at + 0.26);
}

/**
 * THE BURP, after a chaser has swallowed somebody whole.
 *
 * Synthesised like everything else here — a low sawtooth wobbled hard and
 * dragged downwards through a lowpass, which is a burp the same way the
 * jaw-harp above is a "no": recognisably the thing without being a recording
 * of one. **That distinction is the no-yeehaw rule**: a synthesised noise is
 * fine, a sampled human one would break the no-assets rule on purpose.
 *
 * It carries no information — a phone on a pub table is on silent and iOS
 * mutes Web Audio outright, so the death still reads with the sound off. It is
 * only there to make somebody laugh at losing a life.
 */
export function playBurp() {
  if (!soundOn() || !ctx) return;
  const at = ctx.currentTime;
  const o = ctx.createOscillator();
  o.type = 'sawtooth';
  o.frequency.setValueAtTime(105, at);
  o.frequency.exponentialRampToValueAtTime(48, at + 0.34);
  // The wobble is what makes it a burp rather than a groan.
  const wob = ctx.createOscillator();
  wob.type = 'square';
  wob.frequency.value = 22;
  const depth = ctx.createGain();
  depth.gain.value = 34;
  wob.connect(depth).connect(o.frequency);
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 620;
  o.connect(lp);
  env(lp, at, VOL * 0.85, 0.36);
  o.start(at);
  wob.start(at);
  o.stop(at + 0.4);
  wob.stop(at + 0.4);
}

/** A saloon-piano plink, for eating something or picking something up. */
export function playPlink(step = 0) {
  if (!soundOn() || !ctx) return;
  const at = ctx.currentTime;
  const o = ctx.createOscillator();
  o.type = 'triangle';
  // Up a pentatonic run as a streak builds, which is the oldest trick there is
  // for making a repeated noise feel like progress rather than repetition.
  const semis = [0, 2, 4, 7, 9, 12][Math.min(step, 5)];
  o.frequency.value = 523.25 * (2 ** (semis / 12));
  env(o, at, VOL * 0.7, 0.13);
  o.start(at);
  o.stop(at + 0.15);
}

/** A life gone. Two falling notes — the shortest way to say it without a buzzer. */
export function playLost() {
  if (!soundOn() || !ctx) return;
  const at = ctx.currentTime;
  [330, 247].forEach((hz, i) => {
    const o = ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.value = hz;
    env(o, at + i * 0.11, VOL * 0.75, 0.12);
    o.start(at + i * 0.11);
    o.stop(at + i * 0.11 + 0.14);
  });
}

/**
 * The control, as markup — a speaker on the game itself rather than a setting
 * somewhere else, because the moment somebody wants it is the moment they are
 * looking at the game.
 */
export function soundButton() {
  /*
   * NOTHING AT ALL WHEN THE ROOM IS MUTED.
   *
   * The first version drew the button anyway, which meant a player could press
   * it, watch it turn to 🔊, and hear nothing — a control that lies about what
   * it did. The host's switch is not this phone's business to argue with, so
   * when tonight says no there is simply no button, which is also the rule
   * about controls that do nothing.
   */
  if (!allowed) return '';
  return `<button class="arcade-sound" type="button" aria-pressed="${soundOn()}"
    title="Sound on this phone">${soundOn() ? '🔊' : '🔇'}</button>`;
}

/** Wire that button up. Returns nothing; the label keeps itself in step. */
export function wireSoundButton(root) {
  const btn = root.querySelector('.arcade-sound');
  if (!btn) return;
  btn.addEventListener('click', (ev) => {
    // Stop it reaching the canvas underneath — on Quick Draw that would be a
    // shot at whatever is behind the button, which is a life if it is the
    // sheriff.
    ev.stopPropagation();
    ev.preventDefault();
    const now = toggleSound();
    btn.textContent = now ? '🔊' : '🔇';
    btn.setAttribute('aria-pressed', String(now));
    // A sound the instant you turn it on, so the button proves itself — and
    // nothing at all when you turn it off, which would be absurd.
    if (now) playRicochet();
  });
}
