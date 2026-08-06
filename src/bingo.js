/**
 * Music bingo.
 *
 * You play tracks from your DJ app. Every phone gets its own card of track
 * titles. When a player hears one on their card they tap it. Complete a line
 * and they hit the BINGO button.
 *
 * THE ANTI-CHEAT RULE, which drives the whole design:
 *
 *   A card is generated ON THE SERVER when a phone joins, and stored against
 *   that player for the whole round. The phone never generates anything, so
 *   there is nothing to "regenerate" — refreshing, reopening the link, or
 *   clearing the browser all return the same card. There is deliberately no
 *   endpoint that hands out a new card.
 *
 * Claims are checked against what you actually played. A player can mark
 * whatever they like on their own card, but a line only counts if every track
 * in it has genuinely been called. Wrong calls are recorded rather than
 * silently ignored, because a false alarm is half the fun in a room.
 */

import { cleanTeamName, isSafeId, newId, rememberRemoved, wasRemoved, forgetRemoved } from './engine.js';

export const BINGO_PHASES = {
  LOBBY: 'lobby',
  PLAYING: 'playing',
  WON: 'won',
  FINISHED: 'finished',
};

/**
 * The most squares a card may have.
 *
 * Not an arbitrary number: 5x5 is 25 and a 3-across strip of 8 is 24, so this
 * leaves room for a 6x6 and stops anything that would be unreadable on the
 * phone in somebody's hand in a dark pub.
 */
export const MAX_SQUARES = 36;

/** What a full card has to look like to win. */
export const TARGETS = {
  LINE: 'line',
  FULL: 'full',
};

export class BingoGame {
  /**
   * @param {object} opts
   * @param {object} opts.pack  a bingo pack (see bingo/*.json)
   * @param {function(): number} [opts.now]
   * @param {object} [opts.state]
   * @param {function(BingoGame): void} [opts.onChange]
   */
  constructor({ pack, now = () => Date.now(), state = null, onChange = null }) {
    this.pack = pack;
    this.now = now;
    this.onChange = onChange;
    this.state = state || BingoGame.freshState(pack);
  }

  static freshState(pack) {
    return {
      kind: 'bingo',
      packId: pack.id,
      phase: BINGO_PHASES.LOBBY,
      version: 0,
      target: TARGETS.LINE,
      // Bumped whenever cards should all be reissued (a new round).
      round: 1,
      players: {},
      called: [], // track ids, in the order you played them
      calledAt: {}, // trackId -> timestamp
      claims: [], // every BINGO press, right or wrong
      winners: { line: [], full: [] },
      startedAt: null,
      finishedAt: null,
    };
  }

  changed() {
    this.state.version++;
    if (this.onChange) this.onChange(this);
  }

  // ------------------------------------------------------------------- cards

  /**
   * The card's shape.
   *
   * A pack may say `cardSize: 4` (square, and every pack said this until
   * strips arrived) or `cardRows`/`cardCols`. `cardShape()` reads either, so
   * nothing that was already on disk has to be rewritten.
   */
  get shape() {
    return cardShape(this.pack);
  }

  /** Kept for everything that only ever wanted "how wide is it". */
  get size() {
    return this.shape.cols;
  }

  get squareCount() {
    const { rows, cols } = this.shape;
    return rows * cols;
  }

  get tracks() {
    return this.pack.tracks || [];
  }

  track(id) {
    return this.tracks.find((t) => t.id === id) || null;
  }

  /**
   * Build a card for one player. Deterministic from the player id, the pack
   * and the round number, so the same phone always rebuilds the same card even
   * if the state file were lost — but it is stored anyway, which is what makes
   * it unregeneratable.
   */
  makeCard(playerId, salt = 0) {
    const ids = this.tracks.map((t) => t.id);
    const seed = hashString(`${this.pack.id}:${this.state.round}:${playerId}:${salt}`);
    const shuffled = shuffle(ids, seed);
    return shuffled.slice(0, this.squareCount);
  }

  /**
   * Every card in the room is different. With a decent track list a collision
   * is vanishingly unlikely, but "vanishingly unlikely" is not "impossible",
   * and two teams with the same card would be a row at the bar.
   */
  uniqueCardFor(playerId) {
    const taken = new Set(
      Object.values(this.state.players).map((p) => cardSignature(p.card)),
    );
    for (let salt = 0; salt < 50; salt++) {
      const card = this.makeCard(playerId, salt);
      if (!taken.has(cardSignature(card))) return card;
    }
    return this.makeCard(playerId, Math.floor(this.now() % 1000));
  }

  // ----------------------------------------------------------------- players

  join({ playerId, name }) {
    const at = this.now();
    // Same reasoning as the quiz: joining again clears a previous removal.
    if (playerId) forgetRemoved(this.state, playerId);
    const existing = playerId && this.state.players[playerId];

    if (existing) {
      // Same phone, same card. There is no path here that issues a new one.
      existing.connected = true;
      existing.lastSeenAt = at;
      const clean = cleanTeamName(name);
      if (clean && clean !== existing.name) existing.name = clean;
      this.changed();
      return existing;
    }

    const id = playerId && isSafeId(playerId) ? playerId : newId();
    const player = {
      id,
      name: cleanTeamName(name) || 'Team ' + (Object.keys(this.state.players).length + 1),
      card: this.uniqueCardFor(id),
      marks: new Array(this.squareCount).fill(false),
      joinedAt: at,
      lastSeenAt: at,
      connected: true,
      cardRound: this.state.round,
      falseCalls: 0,
    };
    this.state.players[id] = player;
    this.changed();
    return player;
  }

  touch(playerId) {
    const p = this.state.players[playerId];
    if (!p) return null;
    p.lastSeenAt = this.now();
    p.connected = true;
    return p;
  }

  removePlayer(playerId) {
    if (!this.state.players[playerId]) return false;
    delete this.state.players[playerId];
    rememberRemoved(this.state, playerId);
    this.changed();
    return true;
  }

  renamePlayer(playerId, name) {
    const p = this.state.players[playerId];
    const clean = cleanTeamName(name);
    if (!p || !clean) return false;
    p.name = clean;
    this.changed();
    return true;
  }

  playerList() {
    return Object.values(this.state.players);
  }

  // ------------------------------------------------------------------ the go

  start() {
    if (!this.tracks.length) return false;
    this.state.phase = BINGO_PHASES.PLAYING;
    this.state.startedAt = this.now();
    this.changed();
    return true;
  }

  /** You played a track. Mark it called. */
  call(trackId) {
    if (!this.track(trackId)) return false;
    if (this.state.called.includes(trackId)) return false;
    if (this.state.phase === BINGO_PHASES.LOBBY) this.start();
    this.state.called.push(trackId);
    this.state.calledAt[trackId] = this.now();
    this.changed();
    return true;
  }

  /** Pressed the wrong one. Take it back. */
  uncall(trackId) {
    const i = this.state.called.indexOf(trackId);
    if (i < 0) return false;
    this.state.called.splice(i, 1);
    delete this.state.calledAt[trackId];
    this.changed();
    return true;
  }

  undoLastCall() {
    const last = this.state.called[this.state.called.length - 1];
    return last ? this.uncall(last) : false;
  }

  /** A player taps a square on their own card. */
  mark({ playerId, index, marked }) {
    const p = this.state.players[playerId];
    if (!p) return { ok: false, reason: 'unknown_player' };
    if (this.state.phase === BINGO_PHASES.FINISHED) return { ok: false, reason: 'finished' };
    const i = Number(index);
    if (!Number.isInteger(i) || i < 0 || i >= p.card.length) return { ok: false, reason: 'bad_square' };
    p.marks[i] = marked === undefined ? !p.marks[i] : Boolean(marked);
    p.lastSeenAt = this.now();
    this.changed();
    return { ok: true, marks: p.marks };
  }

  // ------------------------------------------------------------------ claims

  /** Every winning line on a card of this shape — see cardLines(). */
  lines() {
    return cardLines(this.shape);
  }

  /** A square counts only if the player marked it AND you actually played it. */
  isGood(player, index) {
    return Boolean(player.marks[index]) && this.state.called.includes(player.card[index]);
  }

  /**
   * Check a card against the current target. Returns the winning squares so
   * the big screen can show exactly which line it was.
   */
  evaluate(player) {
    if (this.state.target === TARGETS.FULL) {
      const all = player.card.map((_, i) => i);
      return all.every((i) => this.isGood(player, i)) ? { won: true, pattern: 'full', squares: all } : { won: false };
    }
    for (const line of this.lines()) {
      if (line.every((i) => this.isGood(player, i))) return { won: true, pattern: 'line', squares: line };
    }
    return { won: false };
  }

  /**
   * A player pressed BINGO. Checked properly: a line where they have marked
   * squares you never played is a false alarm, and is recorded as one.
   */
  claim(playerId) {
    const p = this.state.players[playerId];
    if (!p) return { ok: false, reason: 'unknown_player' };
    if (this.state.phase !== BINGO_PHASES.PLAYING && this.state.phase !== BINGO_PHASES.WON) {
      return { ok: false, reason: 'not_playing' };
    }

    const result = this.evaluate(p);
    const at = this.now();
    const record = {
      playerId,
      name: p.name,
      at,
      valid: result.won,
      pattern: result.won ? result.pattern : this.state.target,
      squares: result.won ? result.squares : [],
    };
    this.state.claims.push(record);

    if (!result.won) {
      p.falseCalls++;
      this.changed();
      return { ok: true, valid: false, reason: 'not_yet' };
    }

    const list = this.state.winners[result.pattern];
    if (!list.includes(playerId)) list.push(playerId);
    this.state.phase = BINGO_PHASES.WON;
    this.state.lastWin = { playerId, name: p.name, pattern: result.pattern, squares: result.squares, at };
    this.changed();
    return { ok: true, valid: true, pattern: result.pattern };
  }

  /** Carry on after a line has been won — now they are playing for a full house. */
  playOn(target = TARGETS.FULL) {
    this.state.target = target;
    this.state.phase = BINGO_PHASES.PLAYING;
    this.state.lastWin = null;
    this.changed();
    return true;
  }

  finish() {
    this.state.phase = BINGO_PHASES.FINISHED;
    this.state.finishedAt = this.now();
    this.changed();
    return true;
  }

  /**
   * A fresh round: new cards for everyone, nothing called. Teams stay in, so
   * nobody has to scan the code again between rounds.
   */
  newRound() {
    this.state.round++;
    this.state.called = [];
    this.state.calledAt = {};
    this.state.claims = [];
    this.state.winners = { line: [], full: [] };
    this.state.lastWin = null;
    this.state.target = TARGETS.LINE;
    this.state.phase = BINGO_PHASES.PLAYING;
    for (const p of this.playerList()) {
      p.card = this.uniqueCardFor(p.id);
      p.marks = new Array(this.squareCount).fill(false);
      p.cardRound = this.state.round;
      p.falseCalls = 0;
    }
    this.changed();
    return true;
  }

  resetAll() {
    this.state = BingoGame.freshState(this.pack);
    this.changed();
    return true;
  }

  // ------------------------------------------------------------------ views

  /** How many squares a player still needs on their best line. */
  squaresAway(player) {
    if (this.state.target === TARGETS.FULL) {
      return player.card.filter((_, i) => !this.isGood(player, i)).length;
    }
    let best = Infinity;
    for (const line of this.lines()) {
      const missing = line.filter((i) => !this.isGood(player, i)).length;
      if (missing < best) best = missing;
    }
    return best === Infinity ? this.size : best;
  }

  /** The tension metric: how many teams need one more track. */
  onesAway() {
    return this.playerList().filter((p) => this.squaresAway(p) === 1).length;
  }

  baseView() {
    return {
      kind: 'bingo',
      version: this.state.version,
      phase: this.state.phase,
      serverNow: this.now(),
      title: this.pack.title,
      target: this.state.target,
      round: this.state.round,
      // Both spellings: cardSize for anything that only knows squares, and the
      // shape for the phone, which lays the grid out from it.
      cardSize: this.shape.cols,
      cardRows: this.shape.rows,
      cardCols: this.shape.cols,
      trackCount: this.tracks.length,
      calledCount: this.state.called.length,
      playerCount: this.playerList().length,
    };
  }

  /**
   * The projector.
   *
   * Deliberately does NOT include the full track list — only what has already
   * been played. The uncalled tracks are the whole game, and half the room
   * would be reading them off the screen instead of listening.
   */
  screenView() {
    const view = this.baseView();
    const called = this.state.called.map((id) => this.track(id)).filter(Boolean);
    view.called = called.map((t) => ({ id: t.id, title: t.title, artist: t.artist }));
    view.lastCalled = called.length ? called[called.length - 1] : null;
    view.onesAway = this.onesAway();

    if (this.state.phase === BINGO_PHASES.LOBBY) {
      view.lobby = {
        players: this.playerList().sort((a, b) => b.joinedAt - a.joinedAt).map((p) => ({ id: p.id, name: p.name })),
      };
    }

    if (this.state.lastWin) {
      view.win = {
        name: this.state.lastWin.name,
        pattern: this.state.lastWin.pattern,
        at: this.state.lastWin.at,
      };
    }

    // The most recent false alarm, because the room loves it.
    const lastClaim = this.state.claims[this.state.claims.length - 1];
    if (lastClaim && !lastClaim.valid) {
      view.falseAlarm = { name: lastClaim.name, at: lastClaim.at };
    }

    view.winners = {
      line: this.state.winners.line.map((id) => this.state.players[id]?.name).filter(Boolean),
      full: this.state.winners.full.map((id) => this.state.players[id]?.name).filter(Boolean),
    };

    return view;
  }

  /** One phone: its own card, its own marks, and nobody else's. */
  playerView(playerId) {
    const view = this.baseView();
    const p = this.state.players[playerId];
    if (!p) {
      // Only a team the host actually removed gets thrown out. Anything else
      // — a restart, a relaunch over a full lobby — is a silent rejoin, which
      // for bingo also means the same card comes back rather than a new one.
      if (wasRemoved(this.state, playerId)) view.kicked = true;
      else view.rejoin = true;
      return view;
    }

    view.you = {
      id: p.id,
      name: p.name,
      squaresAway: this.squaresAway(p),
      falseCalls: p.falseCalls,
    };
    view.card = p.card.map((trackId, i) => {
      const t = this.track(trackId);
      return {
        index: i,
        title: t ? t.title : '—',
        artist: t ? t.artist : '',
        marked: Boolean(p.marks[i]),
        // Told only after you played it, so the phone confirms a good mark
        // rather than giving anything away in advance.
        called: this.state.called.includes(trackId),
      };
    });
    // Can they legitimately press BINGO? They may still be wrong — this only
    // stops the button being mashed when no line is even marked.
    view.canClaim = this.hasMarkedPattern(p);
    view.won = this.state.winners.line.includes(playerId) || this.state.winners.full.includes(playerId);
    if (this.state.lastWin) view.win = { name: this.state.lastWin.name, pattern: this.state.lastWin.pattern };
    return view;
  }

  /** Marked a full line, regardless of whether those tracks were really played. */
  hasMarkedPattern(player) {
    if (this.state.target === TARGETS.FULL) return player.marks.every(Boolean);
    return this.lines().some((line) => line.every((i) => player.marks[i]));
  }

  /** Where the game has got to, in one line — see Engine.where(). */
  where() {
    const called = this.state.called.length;
    const total = this.tracks.length;
    switch (this.state.phase) {
      case BINGO_PHASES.LOBBY: return 'Waiting in the lobby';
      case BINGO_PHASES.PLAYING:
        return `Round ${this.state.round} — ${called} of ${total} played, going for ${this.state.target === TARGETS.FULL ? 'a full house' : 'a line'}`;
      case BINGO_PHASES.WON:
        return `Round ${this.state.round} — ${this.state.target === TARGETS.FULL ? 'full house' : 'a line'} claimed, ${called} of ${total} played`;
      case BINGO_PHASES.FINISHED: return 'Finished — the winners are up';
      default: return '';
    }
  }

  /** Your caller's view: the full track list and who is close. */
  hostView() {
    const view = this.baseView();
    view.tracks = this.tracks.map((t) => ({
      id: t.id,
      title: t.title,
      artist: t.artist,
      called: this.state.called.includes(t.id),
      calledAt: this.state.calledAt[t.id] || null,
    }));
    view.called = this.state.called.map((id) => {
      const t = this.track(id);
      return t ? { id: t.id, title: t.title, artist: t.artist } : null;
    }).filter(Boolean);

    view.players = this.playerList()
      .map((p) => ({
        id: p.id,
        name: p.name,
        away: this.squaresAway(p),
        marked: p.marks.filter(Boolean).length,
        falseCalls: p.falseCalls,
        connected: p.connected,
        won: this.state.winners.line.includes(p.id) || this.state.winners.full.includes(p.id),
      }))
      .sort((a, b) => a.away - b.away || a.name.localeCompare(b.name));

    view.onesAway = view.players.filter((p) => p.away === 1).length;
    view.claims = this.state.claims.slice(-6).reverse();
    if (this.state.lastWin) view.win = this.state.lastWin;
    return view;
  }

  results() {
    return {
      kind: 'bingo',
      packId: this.pack.id,
      title: this.pack.title,
      startedAt: this.state.startedAt,
      finishedAt: this.state.finishedAt,
      rounds: this.state.round,
      called: this.state.called.map((id) => {
        const t = this.track(id);
        return t ? `${t.title} — ${t.artist}` : id;
      }),
      leaderboard: this.playerList()
        .map((p) => ({
          name: p.name,
          away: this.squaresAway(p),
          falseCalls: p.falseCalls,
          won: this.state.winners.line.includes(p.id) || this.state.winners.full.includes(p.id),
        }))
        .sort((a, b) => Number(b.won) - Number(a.won) || a.away - b.away),
    };
  }
}

// ------------------------------------------------------------------ helpers

/** A small, fast, deterministic PRNG. Same seed, same card, every time. */
function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashString(s) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

/** Fisher-Yates, driven by the seeded generator so it is reproducible. */
export function shuffle(list, seed) {
  const out = [...list];
  const rand = mulberry32(seed);
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function cardSignature(card) {
  return (card || []).join('|');
}

/**
 * How many tracks a pack really needs.
 *
 * Sixteen tracks fills a 4x4 card, but it fills every card with the same
 * sixteen — only the arrangement differs, so the room finishes together and
 * nobody feels they won anything. Half again gives enough spare for cards to
 * genuinely differ.
 */
/**
 * What shape a pack's cards are, from whichever way it says so.
 *
 * `cardSize: 4` means 4x4 and is what every pack said before strips existed.
 * `cardRows` / `cardCols` say it outright. Reading both here means no pack on
 * disk had to be rewritten, and nothing else in the app has to know there are
 * two spellings.
 */
export function cardShape(pack = {}) {
  const rows = Number(pack.cardRows) || Number(pack.cardSize) || 4;
  const cols = Number(pack.cardCols) || Number(pack.cardSize) || 4;
  return { rows, cols };
}

/**
 * Every winning line on a card.
 *
 * On a SQUARE card that is rows, columns and both diagonals — the traditional
 * grid, unchanged.
 *
 * On a STRIP — 3 rows of 8, the shape of a paper bingo ticket — it is the long
 * rows only. Not the short columns, and this is the whole point rather than a
 * simplification: a card whose lines are different lengths is not a fair game,
 * because somebody would call on a column of three while everybody else needs
 * eight. Diagonals do not exist on a strip at all.
 *
 * So: whichever axis is longer is the line. An 8x3 gives the same game as a
 * 3x8, just turned round.
 */
export function cardLines({ rows, cols }) {
  const at = (r, c) => r * cols + c;
  const out = [];
  const row = (r) => Array.from({ length: cols }, (_, c) => at(r, c));
  const col = (c) => Array.from({ length: rows }, (_, r) => at(r, c));

  if (rows === cols) {
    for (let r = 0; r < rows; r++) out.push(row(r));
    for (let c = 0; c < cols; c++) out.push(col(c));
    out.push(Array.from({ length: rows }, (_, i) => at(i, i)));
    out.push(Array.from({ length: rows }, (_, i) => at(i, cols - 1 - i)));
    return out;
  }

  if (cols > rows) for (let r = 0; r < rows; r++) out.push(row(r));
  else for (let c = 0; c < cols; c++) out.push(col(c));
  return out;
}

/**
 * How many tracks a card of this shape really wants.
 *
 * Half again as many as there are squares, so two cards drawn from the pool do
 * not come out looking like each other.
 */
export function minimumTracks(shape = 4) {
  const { rows, cols } = typeof shape === 'number' ? { rows: shape, cols: shape } : shape;
  return Math.ceil(rows * cols * 1.5);
}

/**
 * One spelling of a card's shape, used everywhere it is said.
 *
 * A square is "4×4" and needs no explaining. A strip is spelled out — "3 across
 * × 8 down" — because "3×8" is read both ways round by different people, and
 * getting it backwards is the difference between a portrait card that fits a
 * phone and a landscape one that does not.
 */
export function shapeLabel(shape) {
  const { rows, cols } = typeof shape === 'number' ? { rows: shape, cols: shape } : shape;
  return rows === cols ? `${rows}×${cols}` : `${cols} across × ${rows} down`;
}

/**
 * A shape as the fields a pack carries.
 *
 * A square one still writes `cardSize` as well, so a pack saved today is still
 * read correctly by anything that only knows the old spelling — including a
 * copy of the app that has not been redeployed yet.
 */
export function shapeFields({ rows, cols }) {
  return { cardRows: rows, cardCols: cols, ...(rows === cols ? { cardSize: rows } : {}) };
}

/**
 * The shapes offered when you launch a round, in the order they are shown.
 *
 * The strips are TALLER than they are wide, because a phone is: 3 across and 8
 * down, not the other way about. A line is the long way — eight — which is
 * what makes them longer games than a 5×5 despite having one fewer square.
 */
export const CARD_SHAPES = [
  { rows: 3, cols: 3 },
  { rows: 4, cols: 4 },
  { rows: 5, cols: 5 },
  { rows: 6, cols: 4 },
  { rows: 8, cols: 3 },
];

/** Same shape of checks as the quiz packs: catch it now, not on the night. */
export function validateBingoPack(pack) {
  const problems = [];
  if (!pack || typeof pack !== 'object') return ['That is not a bingo pack.'];
  if (!pack.title) problems.push('The pack needs a title.');

  const shape = cardShape(pack);
  const label = shapeLabel(shape);
  // Loose enough for a strip you typed in by hand, tight enough to catch a
  // card nobody could play: the limit is what fits on a phone and what a
  // sensible track list can fill.
  const sane = (n) => Number.isInteger(n) && n >= 2 && n <= 10;
  if (!sane(shape.rows) || !sane(shape.cols)) {
    problems.push(`Card shape must be between 2 and 10 each way (it is ${label}).`);
  } else if (shape.rows * shape.cols > MAX_SQUARES) {
    problems.push(`A ${label} card is ${shape.rows * shape.cols} squares — too many to read on a phone (${MAX_SQUARES} is the most).`);
  }

  const tracks = pack.tracks || [];
  const squares = shape.rows * shape.cols;
  if (tracks.length < squares) {
    problems.push(`Only ${tracks.length} tracks for a ${label} card — you need at least ${squares}.`);
  } else if (tracks.length < minimumTracks(shape)) {
    problems.push(`Only ${tracks.length} tracks for a ${label} card. Add more (${minimumTracks(shape)}+) or cards will look too alike.`);
  }

  const seen = new Set();
  tracks.forEach((t, i) => {
    if (!t.title || !String(t.title).trim()) problems.push(`Track ${i + 1} has no title.`);
    const key = `${String(t.title).toLowerCase()}|${String(t.artist || '').toLowerCase()}`;
    if (seen.has(key)) problems.push(`"${t.title}" appears twice.`);
    seen.add(key);
  });

  return problems;
}

export function normaliseBingoPack(pack, fallbackId = 'bingo') {
  return {
    id: pack.id || fallbackId,
    kind: 'bingo',
    title: pack.title || 'Music Bingo',
    subtitle: pack.subtitle || '',
    ...shapeFields(cardShape(pack)),
    notes: pack.notes || '',
    createdAt: pack.createdAt || null,
    tracks: (pack.tracks || []).map((t, i) => ({
      id: t.id || `t${i + 1}`,
      title: String(t.title || '').trim(),
      artist: String(t.artist || '').trim(),
      ...(t.year ? { year: t.year } : {}),
    })),
  };
}
