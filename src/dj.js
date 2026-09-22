/**
 * A DJ SET — the photo wall, and a request queue only the DJ sees.
 *
 * ---
 *
 * Asked for as a separate app: *"when I'm DJing, I just have a QR code on the
 * screen. People upload their photos, and then that unlocks the ability for
 * them to give requests."*
 *
 * **IT IS A GAME KIND, NOT A SECOND APP** — the same `LAUNCHERS` contract
 * `engine.js` and `bingo.js` answer (`screenView`/`playerView`/`hostView`/
 * `join`/`results`), so the room, the join code, the token identity, the flood
 * gate, SSE, crash recovery and the whole photo pipeline are had for nothing.
 * **`POST /api/photo` needed no change whatsoever**: it resolves the ROOM
 * rather than the game and asks the engine only for `state.players`, which is
 * the evidence that this belongs here rather than in a second codebase.
 *
 * It is a standalone app to the people who use it — its own front door, its own
 * name, its own address. What it does not duplicate is the code.
 *
 * ---
 *
 * **A REQUEST IS HOST-ONLY. NEVER THE BIG SCREEN — that is rule 1**, and here
 * it matters more than it does on a quiz: a request queue on the wall is a list
 * of songs the room can see you not playing, and the first rude one somebody
 * types is six feet wide. `screenView()` has no requests in it and there is a
 * test on that.
 *
 * **THE SPELLING COMES OFF SPOTIFY, NOT OFF A THUMB.** A request is picked from
 * a search rather than typed, so what reaches the queue is a real artist and a
 * real title — `import-intro.js`'s rule, for the same reason: a song typed
 * twice is two songs. Typing is the FALLBACK when search finds nothing or is
 * not configured, marked as such (`source`), because a queue that refuses an
 * obscure record is worse than one with a typo in it.
 *
 * **AND WHAT COMES OUT IS WORDS, because the DJ software reads titles** —
 * *"my DJ app reads off of title rather than Spotify"*. The artist and the
 * title are stored apart so the host's list can print `Artist — Title` and
 * copy it; no Spotify id is kept, because nothing draws one and a field on a
 * view is a promise that something draws it.
 *
 * **THE PHOTO IS THE KEY, AND THE ENGINE HOLDS THE LOCK.** `notePhoto()` is
 * called by the upload route only when a photo actually landed, so the unlock
 * is in the state file and survives the restart every deploy causes. Asking
 * the photo folder instead would have made the unlock a thing that could
 * disagree with itself after a wipe.
 */

import {
  cleanTeamName, faceKey, isSafeId, newId, newToken, ownsPlayer,
  MAX_PLAYERS, rememberRemoved, wasRemoved, forgetRemoved,
} from './engine.js';
import { castVote, closeVote, dropVote, openVote, voteForHost, voteForPlayer, voteForScreen } from './photo-vote.js';

/**
 * A set has one phase, and that is the point.
 *
 * A quiz moves through lobby → question → reveal and a bingo game through its
 * stages; a DJ set is one long moment that ends when the DJ says so. Named
 * anyway, because `phonesAre()` and every screen in this app branch on a phase
 * and a game with none would be the one that draws a blank line.
 */
export const DJ_PHASES = { SET: 'set', FINISHED: 'finished' };

/**
 * How many a phone may have WAITING at once.
 *
 * Not how many it may send all night — a played or binned request frees the
 * slot, so somebody who asks for something every half hour is never refused.
 * It stops one phone filling the list, which is the only thing worth stopping:
 * three is a person with taste, thirty is somebody having a laugh.
 */
export const REQUESTS_EACH = 3;

/**
 * And a ceiling on the whole queue — a SAFETY number like `MAX_TEAMS`, not a
 * design one. Nothing a room of two hundred does reaches it; a script would.
 */
export const MAX_REQUESTS = 500;

/** Long enough for "Everything Everything — No Reptiles", short of an essay. */
const MAX_FIELD = 120;

function freshState(now) {
  return {
    kind: 'dj',
    phase: DJ_PHASES.SET,
    startedAt: now,
    players: {},
    requests: [],
    removed: {},
    /*
     * THE FUNNIEST PHOTOGRAPH, PUT TO THE ROOM — `src/photo-vote.js`.
     *
     * **AND IT BELONGS ON A DJ SET MORE THAN ANYWHERE**, which is why this is
     * here rather than behind a kind check: on a quiz the photographs are a
     * side-show, and here a photograph is the TICKET — it is the entire
     * currency of the game. The one thing it does not get is a voucher:
     * `photoVotePrize()` has no reward list to read, so the winner is named on
     * the wall and the DJ hands over whatever they were going to hand over.
     * Silence beats minting a code no bar has agreed to honour.
     */
    photoVote: null,
    // Written EXPLICITLY, so ABSENT can mean launched — the same reasoning
    // `state.launched` carries on the quiz.
    launched: false,
  };
}

const clean = (s) => cleanTeamName(String(s == null ? '' : s)).slice(0, MAX_FIELD);

export class DjSet {
  constructor({ state = null, now = () => Date.now(), onChange = () => {} } = {}) {
    this.now = now;
    this.onChange = onChange;
    this.state = state && state.kind === 'dj' ? state : freshState(this.now());
    // An older state file, from before a field existed, must not arrive half
    // built — the whitelist trap this repo records six times, answered by
    // filling gaps rather than by destructuring.
    if (!this.state.players) this.state.players = {};
    if (!Array.isArray(this.state.requests)) this.state.requests = [];
    if (!this.state.removed) this.state.removed = {};
  }

  changed() {
    this.onChange();
  }

  // ------------------------------------------------------------- the phones

  /**
   * The same join contract as the other two engines, and deliberately so —
   * `session.js` patches a token onto a carried roster at a part boundary and
   * must not have to know which game it is handing over to.
   */
  join({ playerId, name, token = '' }) {
    const at = this.now();
    if (playerId) forgetRemoved(this.state, playerId);
    const claimed = playerId && this.state.players[playerId];
    const existing = claimed && ownsPlayer(claimed, token) ? claimed : null;

    if (existing) {
      if (!existing.token) existing.token = newToken();
      existing.connected = true;
      existing.lastSeenAt = at;
      const want = cleanTeamName(name);
      if (want && want !== existing.name) existing.name = want;
      this.changed();
      return existing;
    }

    if (Object.keys(this.state.players).length >= MAX_PLAYERS) {
      return { id: '', name: '', full: true };
    }

    const id = playerId && isSafeId(playerId) && !this.state.players[playerId] ? playerId : newId();
    const player = {
      id,
      token: newToken(),
      // A DJ night has no teams, so the default is a person rather than
      // "Team 4" — the label names what it is, which is this app's own rule.
      name: cleanTeamName(name) || `Guest ${Object.keys(this.state.players).length + 1}`,
      joinedAt: at,
      lastSeenAt: at,
      connected: true,
      photos: 0,
    };
    this.state.players[id] = player;
    this.changed();
    return player;
  }

  /**
   * A PHOTO LANDED, SO THE REQUESTS OPEN.
   *
   * Called by the upload route, and only when a photograph genuinely saved —
   * the count is what unlocks, so a refused upload must not.
   *
   * **The method existing is the whole integration.** The route calls it only
   * if the engine has one, so `engine.js` and `bingo.js` are untouched and a
   * pub night's payload is byte-for-byte what it was.
   */
  notePhoto(playerId) {
    const player = this.state.players[String(playerId || '')];
    if (!player) return false;
    player.photos = (player.photos || 0) + 1;
    this.changed();
    return true;
  }

  /** Has this phone earned the request box? */
  unlocked(playerId) {
    const player = this.state.players[String(playerId || '')];
    return Boolean(player && (player.photos || 0) > 0);
  }

  /** What this phone has waiting — played and binned ones free their slot. */
  waitingFor(playerId) {
    return this.state.requests.filter((r) => r.by === playerId && !r.playedAt && !r.binnedAt);
  }

  /**
   * ASK FOR A SONG.
   *
   * @param {object} what  `{ artist, title }` off a Spotify search, or typed
   * @returns {{ok: boolean, reason?: string, request?: object}}
   */
  request({ playerId, token, artist, title, source = 'typed' }) {
    const player = this.state.players[String(playerId || '')];
    // Rule 3: an id is not a credential. A request carries a name to the DJ,
    // so one anybody could post is one anybody could put words in front of.
    if (!player || !ownsPlayer(player, token)) return { ok: false, reason: 'not_you' };
    if (this.state.phase === DJ_PHASES.FINISHED) return { ok: false, reason: 'over' };
    if (!this.unlocked(playerId)) return { ok: false, reason: 'locked' };

    const gotArtist = clean(artist);
    const gotTitle = clean(title);
    // A title alone is a real request — plenty of people know the song and not
    // who did it. An empty one is refused rather than silently dropped, which
    // is `notes.js`'s rule for the same reason.
    if (!gotTitle) return { ok: false, reason: 'empty' };
    if (this.state.requests.length >= MAX_REQUESTS) return { ok: false, reason: 'full' };
    if (this.waitingFor(playerId).length >= REQUESTS_EACH) return { ok: false, reason: 'enough' };

    const at = this.now();
    const request = {
      id: `r${at.toString(36)}${this.state.requests.length}`,
      artist: gotArtist,
      title: gotTitle,
      // Which way it arrived, and it is DRAWN: a typed one may be misspelt and
      // the DJ is the person who has to find it in their own library.
      source: source === 'spotify' ? 'spotify' : 'typed',
      by: player.id,
      who: player.name,
      at,
    };
    this.state.requests.push(request);
    this.changed();
    return { ok: true, request };
  }

  // --------------------------------------------------------------- the desk

  /** Played it. The queue shrinks as the set goes, which is the whole job. */
  played(id) {
    const request = this.state.requests.find((r) => r.id === id);
    if (!request || request.playedAt) return false;
    request.playedAt = this.now();
    this.changed();
    return true;
  }

  /**
   * Not playing that. **Binned, never deleted** — the same decision the photo
   * bin and the room's asks both take: a list you can empty by accident is one
   * nobody trusts, and the count of what was asked for is worth keeping.
   */
  bin(id) {
    const request = this.state.requests.find((r) => r.id === id);
    if (!request || request.binnedAt) return false;
    request.binnedAt = this.now();
    this.changed();
    return true;
  }

  removePlayer(id) {
    if (!this.state.players[id]) return false;
    delete this.state.players[id];
    // Rule 5: a removal is WRITTEN DOWN, never inferred from absence.
    rememberRemoved(this.state, id);
    this.changed();
    return true;
  }

  wasRemoved(id) {
    return wasRemoved(this.state, id);
  }

  /**
   * THE FUNNIEST PHOTOGRAPH — the same five calls both other engines answer.
   *
   * They are on the shared contract (`test/engine-contract.test.js`) rather
   * than behind a kind check, and this file is why the test exists: *a kind
   * test written when there were two games is a bug waiting for the third.*
   * The model is `src/photo-vote.js`, shared, so all of this is plumbing.
   *
   * **NO PRIZE, AND THEREFORE NO VOUCHER.** A set has no reward list and no
   * `state.vouchers`, so `closeVote()` names a winner and mints nothing — the
   * documented degrade rather than a special case.
   */
  openPhotoVote(photos) {
    const out = openVote(this.state, photos, this.now());
    if (out.ok) this.changed();
    return out;
  }

  /** Nothing to read a prize off. Stated rather than absent — see above. */
  photoVotePrize() { return ''; }

  closePhotoVote() {
    const v = this.state.photoVote;
    if (!v) return { ok: false, reason: 'no_vote' };
    if (!v.open) return { ok: true, winner: v.winner };
    const out = closeVote(this.state, { now: this.now(), venue: this.state.venue || '' });
    this.changed();
    return out;
  }

  settlePhotoVote() {
    if (this.state.photoVote && this.state.photoVote.open) this.closePhotoVote();
  }

  dropPhotoVote() {
    const out = dropVote(this.state);
    this.changed();
    return out;
  }

  castPhotoVote(playerId, photoId) {
    return castVote(this.state, playerId, photoId);
  }

  finish() {
    this.settlePhotoVote();
    this.state.phase = DJ_PHASES.FINISHED;
    this.changed();
    return true;
  }

  // ------------------------------------- what the shared dispatch also asks

  /*
   * EVERY ACTION `Session.run()` SHARES BETWEEN ENGINES HAS TO EXIST HERE,
   * AND THIS REPO HAS ALREADY PAID FOR FORGETTING IT ONCE: `removeIdle` is
   * one dispatch for both engines, `bingo.js` had no `removeIdlePlayers()`,
   * and the host's button was a **500**.
   *
   * The control view a DJ drives is its own page, so none of this is on the
   * path anybody presses on purpose. What reaches it is a QUIZ control view
   * left open in another tab — same account, same room, every button still
   * drawn — which is exactly how a night once got filed two hours early. So
   * each one either does the obvious thing or REFUSES IN WORDS; none of them
   * throws, and none of them silently reports success it did not have.
   */

  /**
   * A PHONE SAYING HELLO, AND THE LIVE CONNECTION ITSELF DEPENDS ON IT.
   *
   * `/api/stream` calls this for every phone that opens a stream, on every
   * engine — so without it the SSE route threw and every phone on a DJ set got
   * a **500 instead of a connection**. Not a control anybody presses: the
   * whole game was dead, silently, with every payload correct when asked for
   * directly. Found by opening the page in a real browser, which is the only
   * thing that would have.
   *
   * Deliberately no `changed()`, exactly as both other engines have it: a
   * phone reconnecting is not news to push to the room.
   */
  touch(id) {
    const player = this.state.players[String(id || '')];
    if (!player) return null;
    player.lastSeenAt = this.now();
    player.connected = true;
    return player;
  }

  /**
   * WHO IS IN THE ROOM — what `inProgress()` counts before it lets anything
   * launch over the top of a running set.
   *
   * Without it, pressing start on a set that is already running threw inside
   * `session.inProgress()` — and so did launching a QUIZ over one, which is
   * the protected launch path reaching into a game it knows nothing about.
   *
   * A DJ set has no organisers and nobody is filtered out, so this and
   * `everyone()` are the same list; they are both here because the two names
   * mean different things elsewhere and a caller that asks for the right one
   * should not have to know this engine cannot tell them apart.
   */
  playerList() {
    return Object.values(this.state.players);
  }

  everyone() {
    return Object.values(this.state.players);
  }

  /** Where the night has got to, for the "this would end what is running" line. */
  where() {
    return this.state.phase === DJ_PHASES.FINISHED ? 'requests closed' : 'taking requests';
  }

  renamePlayer(id, name) {
    const player = this.state.players[id];
    if (!player) return false;
    player.name = cleanTeamName(name) || player.name;
    this.changed();
    return true;
  }

  /** Everybody who joined and then never sent a photograph or asked for a song. */
  removeIdlePlayers() {
    const idle = Object.values(this.state.players)
      .filter((p) => !p.photos && !this.state.requests.some((r) => r.playerId === p.id));
    for (const p of idle) this.removePlayer(p.id);
    /*
     * THE SAME SHAPE THE OTHER TWO ENGINES RETURN — `{ ok, removed }`, not a
     * bare number.
     *
     * `removeIdle` is ONE dispatch for every engine (`session.js`), and this
     * was the only one answering differently: a DJ set replied `{"ok":1}`
     * where a quiz and a bingo reply `{"ok":{"ok":true,"removed":0}}`. Nothing
     * broke, because the one caller ignores the reply — which is exactly how
     * this kind of drift survives until somebody reads it.
     *
     * It is the shape of the original fault, too: `removeIdle` is the method
     * that once existed on one engine and not the other and made every phone
     * take a 500. `engine-contract.test.js` asserts a method EXISTS and cannot
     * see what it returns.
     */
    return { ok: true, removed: idle.length };
  }

  /** A fresh set: the room stays, what they asked for goes. */
  resetAll() {
    this.state.requests = [];
    this.state.phase = DJ_PHASES.SET;
    this.changed();
    return true;
  }

  /*
   * A DJ SET HAS NO PRIZES AND MINTS NO VOUCHERS, so these three say so
   * rather than pretending. A refusal the host can read beats a 500, and
   * beats `{ ok: true }` about a drink nobody can collect.
   */
  setRewards() { return { ok: false, reason: 'no_prizes' }; }

  redeemVoucher() { return { ok: false, reason: 'no_prizes' }; }

  reinstateVoucher() { return { ok: false, reason: 'no_prizes' }; }

  /** No lobby game on a DJ night — the phone's job is the camera. */
  arcadeScore() { return { ok: false, reason: 'no_game' }; }

  // -------------------------------------------------------------- the views

  /**
   * THE BIG SCREEN, AND THERE ARE NO REQUESTS IN IT.
   *
   * Rule 1, and the sharpest case of it in the app: a queue on the wall is a
   * list of songs the room can watch you not play, and the first rude title
   * somebody types is six feet wide in front of everybody. The screen gets the
   * join code and the photographs, which is what it is for.
   */
  screenView() {
    return {
      kind: 'dj',
      phase: this.state.phase,
      // What the room is being asked to do, in the app's own words — the
      // screen draws the QR panel from this exactly as a lobby does.
      invite: 'Send a photo to ask for a song',
      playerCount: Object.keys(this.state.players).length,
      // The whitelist IS `voteForScreen()` — no sender id, no live counts.
      ...(voteForScreen(this.state) ? { photoVote: voteForScreen(this.state) } : {}),
    };
  }

  /**
   * ONE PHONE'S OWN VIEW — what it may do, and what it has asked for.
   *
   * Its OWN requests only. Somebody else's is not a secret worth guarding, but
   * it is not this phone's business either, and a list of everybody's on every
   * handset is a payload that grows with the room for no reason.
   */
  playerView(playerId) {
    const player = this.state.players[String(playerId || '')];
    if (!player) return { kind: 'dj', rejoin: true };
    const mine = this.state.requests.filter((r) => r.by === player.id && !r.binnedAt);
    return {
      kind: 'dj',
      phase: this.state.phase,
      you: { id: player.id, name: player.name },
      unlocked: this.unlocked(player.id),
      // The reason a control is off goes ON the control — so the phone can say
      // "send a photo first" rather than drawing a box that refuses.
      left: Math.max(0, REQUESTS_EACH - this.waitingFor(player.id).length),
      mine: mine.map((r) => ({
        id: r.id, artist: r.artist, title: r.title, played: Boolean(r.playedAt),
      })),
      ...(voteForPlayer(this.state, player.id) ? { photoVote: voteForPlayer(this.state, player.id) } : {}),
    };
  }

  /**
   * THE DESK — the queue, oldest first, with what has gone already underneath.
   *
   * Oldest first because a queue is worked from the top and somebody who asked
   * an hour ago has waited longest; newest-first would quietly bury them.
   */
  hostView() {
    const live = this.state.requests.filter((r) => !r.playedAt && !r.binnedAt);
    const done = this.state.requests.filter((r) => r.playedAt);
    const row = (r) => ({
      id: r.id,
      artist: r.artist,
      title: r.title,
      // What the DJ pastes into their own software. Built here rather than in
      // the browser so the queue, a future setlist and anything else that
      // prints a request cannot word it two ways.
      line: r.artist ? `${r.artist} — ${r.title}` : r.title,
      source: r.source,
      who: r.who,
      faceKey: faceKey(r.by),
      at: r.at,
    });
    return {
      kind: 'dj',
      phase: this.state.phase,
      playerCount: Object.keys(this.state.players).length,
      unlockedCount: Object.values(this.state.players).filter((p) => (p.photos || 0) > 0).length,
      requests: live.map(row),
      played: done.map(row),
      // The live counts, host only — the same arrangement on all three games.
      ...(voteForHost(this.state) ? { photoVote: voteForHost(this.state) } : {}),
    };
  }

  /**
   * What gets filed when the night ends.
   *
   * `kind: 'dj'` so the league drops it — a set has no scores and
   * `league.js` already refuses a night it cannot read a board from, which is
   * the behaviour bingo taught it. The headcount and the photographs are what
   * make it evidence, and those are exactly what Past gigs reads.
   */
  results() {
    return {
      kind: 'dj',
      players: Object.keys(this.state.players).length,
      requested: this.state.requests.length,
      played: this.state.requests.filter((r) => r.playedAt).length,
      leaderboard: [],
    };
  }
}

/** The `LAUNCHERS` entry — see the table at the top of `session.js`. */
export const DJ_LAUNCHER = {
  // A set has no pack: there is nothing to load and nothing to write. The
  // empty object keeps the launcher contract honest rather than special-casing
  // the dispatcher for one game.
  load: () => ({ id: 'dj', title: 'DJ set' }),
  list: () => [{ id: 'dj', title: 'DJ set' }],
  make: (pack, opts) => new DjSet(opts),
  /** Anything that moves the night forward, so it flushes — rule 7. */
  milestone: (s) => `${s.phase}:${(s.requests || []).length}:${Object.keys(s.players || {}).length}`,
  isOver: (s) => s.phase === DJ_PHASES.FINISHED,
  empty: { id: 'dj', title: 'DJ set' },
};
