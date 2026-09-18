/**
 * THE VIEWS AND THE PUSH — what each screen is told, and how it is told. Moved whole from server.js.
 */
import { FEATURES, HOUSE, STING_TTL_MS, accounts, can, config, cueOffsetMs, hooks, hub, playTrack, rooms, spotifyConfigured, switchedOn, flight } from './context.js';
import { brandForRoom, schemeForRoom } from './identity.js';

// ------------------------------------------------------------- broadcasting

/**
 * Does this room take photos at all?
 *
 * TWO SWITCHES, and they answer different questions. `photos.enabled` is the
 * kill switch on the CONTROL VIEW — mid-gig, mic in hand, "stop that now", and
 * it lives on the night. This is the quizmaster's standing preference on My
 * account: "I do not run this feature." Both have to be on.
 *
 * It is deliberately NOT the usual `switchedOn` cosmetic toggle. Everywhere
 * else a feature switch only tidies the console and the server still answers,
 * because a switch that could 403 you mid-gig is a reliability risk for no
 * benefit. Photos are the exception and have to be: the whole meaning of "off"
 * here is that nobody in the room can put a picture on the wall, and a switch
 * that only hid the button would be a promise the app does not keep.
 */
export function photosWanted(room) {
  if (!room.photos.enabled) return false;
  const account = accounts.find(room.id);
  // No account (the house room on a host key) keeps the old behaviour.
  return account ? switchedOn(account, FEATURES.PHOTOS) : true;
}

/**
 * THE SECOND SCREEN — a QR to send a photograph, and the photographs.
 *
 * Asked for on 16 September 2026: *"if I'm doing karaoke, then the karaoke
 * screen uses one of the output screens. But then if I'm trying to get photo
 * uploads during the night as well, I would need a second screen for that
 * second QR code and photo uploads."*
 *
 * **IT IS A ROOM VIEW, NOT A GAME VIEW, AND THAT IS THE WHOLE DESIGN.**
 * Photographs belong to the ROOM rather than to whatever is running (the reason
 * a DJ set got the camera, the wall and the gallery for free), so a screen that
 * only wants the code and the pictures needs to know nothing whatever about the
 * quiz. It is built here beside `photosWanted()` rather than in any engine, for
 * the identical reason `photosOpen` is.
 *
 * **SO IT CANNOT SHOW THE QUIZ, STRUCTURALLY.** Not hidden with CSS and not a
 * branch anybody has to keep right — the payload has no question, no answer, no
 * scoreboard and no phase in it, because this function does not build them.
 * That is rule 1's own machinery pointed at a new problem: a second output is
 * likely to end up somewhere the host cannot see, on a stand by the door or a
 * telly behind the bar, and *the projector and the host's phone show different
 * things* has to hold for a third screen the moment one exists.
 *
 * **AND IT DELIBERATELY TAKES NO STING.** `room.sting` is `role === 'screen'`
 * only, so the soundboard still plays out of exactly one laptop — the one wired
 * to the PA. A second screen joining the noise would double every press, and on
 * a karaoke night the main output is not even this app's.
 *
 * **THE PHOTO SWITCH IS ANSWERED HERE TOO** (`open`), because a QR inviting a
 * room to send photographs at a night where the feature is off is a control
 * that does nothing, six feet wide.
 */
export function wallView(room) {
  const state = room.session.engine && room.session.engine.state;
  return {
    kind: 'wall',
    open: photosWanted(room),
    /*
     * TONIGHT'S LOOK, because `/snap` puts the same props on a photograph that
     * a player's phone does — and the tray is dressed for the season the room
     * is dressed for. One look was chosen at launch; the bar's camera offering
     * a different one would be the app disagreeing with itself in the same
     * room.
     *
     * **IT SAYS NOTHING ABOUT THE GAME**, which is what keeps this view what
     * it is: the look is already six feet wide on the projector and on every
     * phone in the building. A field here has to pass that test — see the
     * sweep in `second-screen.mjs`, which asserts the rest of rule 1 for this
     * payload rather than naming fields it thought of.
     */
    look: (state && state.look) || '',
    // The photographs themselves are hung on by `viewFor()`, on the SAME line
    // the projector's are — see there for why that sharing is the point.
  };
}

export function viewFor(client) {
  // A client that arrived before its room existed, or whose room was never
  // booted, is shown the house game rather than nothing — the same silent
  // fallback a phone with no code gets.
  const room = client.room || rooms.get(HOUSE);
  const { session, photos } = room;
  const view = client.role === 'host' ? session.hostView()
    : client.role === 'player' ? session.playerView(client.playerId)
    // The second screen, which is told about the ROOM and never about the game
    // — see `wallView()`. Above the screen fallback deliberately: an unknown
    // role still lands on the projector's view, which is what it has always
    // done and what `roomForPhone()` already guards.
    : client.role === 'wall' ? wallView(room)
    : session.screenView();
  // The wall of photos rides along with whatever else is on screen, so it
  // survives every phase change and every game without each card knowing.
  /*
   * ONE BUCKET, AND THE TWO SCREENS SHARE THIS LINE TO SAY SO.
   *
   * Asked directly: *"the permanent photos screen and the photo screen that
   * pops up between rounds — could they both feed into the same thing? I don't
   * want two buckets of photos."* They always did, and the way to keep it that
   * way is for there to be nothing to keep in step: ONE store on the room, ONE
   * `forScreen()`, both roles on one line rather than two that could drift.
   *
   * It is also what makes the host's bin mean what it says. `photoRemove` acts
   * on the store, so a picture binned mid-quiz leaves the projector AND the
   * second screen on the next push — if the wall ever grew a list of its own,
   * the one control for taking a photograph down would only work on one of the
   * two screens showing it, which on a night where somebody has asked is the
   * worst possible half-measure.
   *
   * **THE `wall` ROLE MUST STAY NAMED HERE**, not left to fall through: the
   * `else` at the bottom is the PHONE's, and a role that lands there is handed
   * facts about a handset that has joined a game.
   */
  if (client.role === 'screen' || client.role === 'wall') view.photos = photos.forScreen();
  else if (client.role === 'host') {
    // `enabled` here is what the room ACTUALLY does, not just the kill switch —
    // otherwise the control view shows photos on while the account preference
    // has them off, and the host reports the camera button as broken.
    view.photos = { enabled: photosWanted(room), count: photos.count(), items: photos.forHost() };
    // Who is knocking. Host only — the number is the whole point, because it
    // is what tells a room apart from somebody messing about.
    view.joinsWaiting = session.joins.waitingCount();
    /*
     * Whether this account actually HAS advert slides.
     *
     * The control view drew an Advert button for everybody. On Bronze, where
     * adverts are a Silver feature, pressing it said "make some on the Adverts
     * tab" — a tab that is greyed out with a `+` on it. A control that can
     * never do anything, pointing at a door that is locked.
     *
     * A room id IS an account id, so the answer is one lookup rather than
     * anything the browser has to be told.
     */
    view.mayAdvert = can(accounts.find(room.id) || null, FEATURES.ADVERTS);
  }
  else {
    view.photosOpen = photosWanted(room);
    /*
     * HAS THIS PHONE ALREADY TAKEN ITS ONE, so the lobby can stop asking.
     *
     * **SPREAD IN ONLY WHEN IT IS TRUE**, like the draw and the comeback band:
     * a night where nobody has sent a photograph is byte-for-byte the payload
     * it always was, so `pub-unchanged` still says IDENTICAL with no
     * `--ignore`.
     *
     * **ON THE ROOM RATHER THAN THE GAME**, which is why it is here beside
     * `photosOpen` and not in either engine. Photographs belong to the room —
     * that is the whole reason the DJ set got the camera, the wall and the
     * gallery for free — so a fact about them cannot be an engine's to answer,
     * and putting it in one engine is how a rule ends up living in one of two.
     *
     * **AND IT IS THE SERVER'S ANSWER, NOT THE PHONE'S.** A phone that
     * reloads mid-lobby — a wifi blip, a backgrounded tab — must not be asked
     * again for something it has already done, and a flag it kept itself would
     * be gone.
     */
    if (photos.cameraShotBy(client.playerId)) view.photoDone = true;
  }
  // Whose night this is — the name AND the two colours — travels with every
  // payload, so a page never has to ask for it separately or flash the wrong
  // thing while it loads. Taken from the ROOM, never from whoever is looking:
  // a phone at Rob's night says Rob's Quizporium in Rob's colours even while
  // the owner has the console open in the next tab.
  view.brand = brandForRoom(room);
  // The product half of the name, so a page can stack "Mark's" over
  // "Quizporium" instead of splitting on the last word and getting it wrong the
  // moment BRAND_NAME is set to something else. See `brandWords` in client.js.
  view.appName = config.appName;
  view.scheme = schemeForRoom(room);
  // Auto-play could not start the track. Host view only — it is a note to tap
  // the link, and it is nobody else's business.
  if (client.role === 'host' && room.introPlay) view.introPlay = room.introPlay;
  /*
   * THE SOUNDBOARD — the projector's, and only for a few seconds.
   *
   * It rides on the ordinary state push rather than a channel of its own,
   * because that stream already carries the question clock and is therefore
   * the fastest thing this app has: a comedy sting that lands two seconds
   * after the laugh is worse than no sting at all.
   *
   * **HELD IN MEMORY ON THE ROOM, NEVER IN THE GAME STATE.** `room.introPlay`
   * three lines up is the same shape and the same reasoning. A sting changes
   * no phase and no score, so writing it to `state.json` would put an event
   * into a crash-recovery file — and a restart would then replay a noise from
   * an hour ago into a quiet room.
   *
   * **AND IT EXPIRES**, which is the half that matters. A projector opened
   * late, or reconnecting after a wifi blip, gets whatever the current payload
   * says — so without a fuse it would blast the last sting on arrival. The
   * projector ALSO remembers the last `at` it played, so the two halves
   * together mean exactly one noise per press.
   */
  if (client.role === 'screen' && room.sting && Date.now() - room.sting.at < STING_TTL_MS) {
    view.sting = room.sting;
  }
  // Which game this is, so a phone that was handed a code can tell it reached
  // the right one and the projector can print it for latecomers.
  view.joinCode = room.code;
  return view;
}

/*
 * Press play on an intro question, best effort, never in the way.
 *
 * **The question goes up whether this works or not, and that is the whole
 * design.** The host has pressed Next with a room waiting; nothing here is
 * awaited before they get their answer back, nothing here can throw into the
 * request, and a failure is a line on their own control view rather than an
 * error. If it does not play they tap the Spotify link exactly as before —
 * which is what they were doing five minutes ago anyway.
 *
 * Only ever on the way IN to a question. Not on a reveal, not on Back, not on
 * a re-render: restarting the track because somebody pressed Back to check
 * something would be worse than not playing it at all.
 *
 * **It starts where the AUDIO starts, not where the file starts.** The clock
 * goes with the question, so dead air at the front of a track costs the whole
 * room score on that question for reasons unrelated to knowing the answer —
 * see `cueOffsetMs`. An unreadable or absent offset sends no `position_ms` at
 * all, which is what every pack on disk does today.
 */
export const introPlayed = new Map();
export function startIntroTrack(room, view) {
  const cue = view && view.phase === 'question' && view.question && view.question.cue;
  const uri = cue && cue.spotifyUri;
  if (!uri || !spotifyConfigured()) {
    /*
     * A QUESTION WE ARE NOT GOING TO PLAY STILL HAS TO CLEAR THE LAST ONE'S
     * FAILURE NOTICE.
     *
     * `room.introPlay` is only ever written inside the `then()` below, so a
     * question with no `spotifyUri` returned before it and left the previous
     * question's notice standing. Every catalogue intro round has cues with no
     * uri in it — three of ten on the pack booked for a real Thursday — so the
     * host's panel could read *"Did not start on its own — tap below"* over a
     * track that was never going to start, with the reason belonging to a
     * different song and NO link underneath it to tap. He would go looking for
     * a control that is not there while a room waits.
     *
     * Only on a question we have not already spoken about, or a genuine
     * failure would be wiped off the screen of the very question it happened
     * on by the next host action.
     */
    const here = view && view.phase === 'question'
      ? `${room.id}:${view.roundIndex}:${view.questionIndex}` : '';
    if (room.introPlay && here && introPlayed.get(room.id) !== here) {
      room.introPlay = null;
      pushState(room);
    }
    return;
  }

  // Once per question. `run` is called for every host action, and a Back and a
  // Next landing on the same question must not start it over.
  const at = `${room.id}:${view.roundIndex}:${view.questionIndex}`;
  if (introPlayed.get(room.id) === at) return;
  introPlayed.set(room.id, at);

  playTrack(uri, { positionMs: cueOffsetMs(cue.from) || 0 }).then((result) => {
    // Remembered on the ROOM so the control view can say what happened, rather
    // than the host wondering whether they mis-tapped. Cleared by the next one.
    room.introPlay = result.ok ? null : { why: result.why, at: Date.now() };
    if (!result.ok) {
      console.warn('[spotify] could not start the intro track:', result.why);
      pushState(room);
    }
  }).catch(() => { /* never the request's problem */ });
}

export const pushQueued = new Set();
export function pushState(room) {
  // Coalesce: sixty phones answering at once is one broadcast, not sixty.
  // Queued PER ROOM, so a busy game in one room cannot swallow the push that
  // another room's question needed.
  const id = room ? room.id : HOUSE;
  if (pushQueued.has(id)) return;
  pushQueued.add(id);
  queueMicrotask(() => {
    pushQueued.delete(id);
    if (room) notePhase(room);
    // Only the phones and screens watching THIS room. Broadcasting to everyone
    // would put one quizmaster's question on another's projector.
    hub.broadcast('state', viewFor, (client) => (client.room ? client.room.id : HOUSE) === id);
  });
}


hooks.pushState = pushState;

/*
 * WHERE THE NIGHT HAS GOT TO, once per change rather than once per push — a
 * push goes out on every answer. Read straight off the state, so it costs a
 * string compare on the busy path and nothing else.
 */
const lastPhaseOf = new Map();
function notePhase(room) {
  try {
    const s = room.session.engine.state;
    const where = s.phase === 'question' || s.phase === 'reveal'
      ? `${s.phase} r${(s.roundIndex ?? 0) + 1} q${(s.questionIndex ?? 0) + 1}`
      : s.phase;
    const key = `${room.session.kind}:${where}`;
    if (lastPhaseOf.get(room.id) === key) return;
    lastPhaseOf.set(room.id, key);
    const players = s.players ? Object.keys(s.players).length : 0;
    flight.note('phase', `${room.session.kind} → ${where}`, { room: room.id, data: `${players} phones` });
  } catch { /* the recorder must never be the thing that throws */ }
}
