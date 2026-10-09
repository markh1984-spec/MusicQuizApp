/**
 * UP OR DOWN — higher or lower, the last one standing gets a drink.
 *
 * ---
 *
 * Picked off five ideas on 9 October 2026: *"up or down sounds good"*. The
 * rules are `public/assets/updown-rules.js`; the room, the drinks and the
 * photo vote are `PartGame`'s, shared with Pub Prix.
 *
 * A game: a card goes up. Every phone still in says HIGHER or LOWER before
 * the clock runs out (`VOTE_MS`, the SERVER's clock — rule 2). The host turns
 * the next card. Wrong is out, and so is a phone that never said — a game you
 * can win by leaving your phone in your pocket is not one.
 *
 * **NOBODY CAN GO OUT ON A PAIR, AND THE ROOM CANNOT ALL GO OUT AT ONCE.** A
 * card the same rank as the last is nobody's fault, so everybody stays; and a
 * card that would knock out every phone still in knocks out none of them —
 * *nobody guessing right is not nobody winning*, the photo vote's rule turned
 * round. So a game always ends with exactly one person holding the drink.
 *
 * **A VOTE IS HOST-ONLY UNTIL THE CARD TURNS** — the projector says how many
 * have voted, never which way, or the back of the room just follows the
 * front. After the turn, the split is the joke, so it goes up.
 */
import { faceKey } from './engine.js';
import { PartGame } from './part-game.js';
import { voteForHost, voteForPlayer, voteForScreen } from './photo-vote.js';
import { VOTE_MS, MIN_PLAYERS, compare, shuffled, cardAt, upDownPack } from '../public/assets/updown-rules.js';

/**
 * LOBBY before a game and between games; GUESSING with a card up and the clock
 * running (and after it has run, until the host turns); SHOWN with the next
 * card turned; DONE with a winner; FINISHED when the night ends here.
 */
export const UPDOWN_PHASES = { LOBBY: 'lobby', GUESSING: 'guessing', SHOWN: 'shown', DONE: 'done', FINISHED: 'finished' };

const newSeed = (random) => Math.floor(random() * 2147483647) + 1;

export class UpDownGame extends PartGame {
  constructor({ pack = null, state = null, now = () => Date.now(), onChange = () => {}, random = Math.random } = {}) {
    super({
      kind: 'updown',
      pack: pack || upDownPack(),
      state,
      now,
      onChange,
      random,
      phases: Object.values(UPDOWN_PHASES),
      fresh: () => ({ game: null }),
    });
  }

  // ------------------------------------------------------------- one game

  /** Deal a game: everybody here right now is in it; a late phone waits for the next. */
  startUpDown() {
    const phase = this.state.phase;
    if (phase === UPDOWN_PHASES.GUESSING || phase === UPDOWN_PHASES.SHOWN) return { ok: false, reason: 'playing' };
    if (phase === UPDOWN_PHASES.FINISHED) return { ok: false, reason: 'finished' };
    const alive = this.playerList().map((p) => p.id);
    if (alive.length < MIN_PLAYERS) return { ok: false, reason: 'too_few' };
    const at = this.now();
    const seed = newSeed(this.random);
    if (this.state.photoVote && this.state.photoVote.open) this.closePhotoVote();
    this.state.photoVote = null;
    this.state.game = {
      id: `u${at.toString(36)}`,
      seed,
      order: shuffled(seed),
      at: 0,
      turn: 1,
      alive,
      entrants: alive.length,
      out: {},
      votes: {},
      closesAt: at + VOTE_MS,
      last: null,
      winner: null,
    };
    this.state.phase = UPDOWN_PHASES.GUESSING;
    this.changed();
    return { ok: true, players: alive.length };
  }

  /** One phone says which way. It may change its mind until the clock runs out. */
  voteUpDown(playerId, choice) {
    const g = this.state.game;
    if (!g || this.state.phase !== UPDOWN_PHASES.GUESSING) return { ok: false, reason: 'not_guessing' };
    const id = String(playerId || '');
    if (!g.alive.includes(id)) return { ok: false, reason: g.out[id] ? 'out' : 'not_in' };
    if (this.now() > g.closesAt) return { ok: false, reason: 'too_late' };
    const way = choice === 'up' ? 'up' : choice === 'down' ? 'down' : null;
    if (!way) return { ok: false, reason: 'bad_choice' };
    if (g.votes[id] === way) return { ok: true, vote: way, same: true };
    g.votes[id] = way;
    this.changed();
    return { ok: true, vote: way };
  }

  /**
   * TURN THE CARD — the host's press, which also closes the vote if the clock
   * is still running (the room has said all it is going to).
   */
  turnCard() {
    const g = this.state.game;
    if (!g || this.state.phase !== UPDOWN_PHASES.GUESSING) return { ok: false, reason: 'not_guessing' };
    // Run out of deck: shuffle a fresh one under the current card.
    if (g.at + 1 >= g.order.length) {
      const top = g.order[g.at];
      g.seed = newSeed(this.random);
      g.order = [top, ...shuffled(g.seed).filter((i) => i !== top)];
      g.at = 0;
    }
    const card = cardAt(g.order, g.at);
    const next = cardAt(g.order, g.at + 1);
    const said = compare(card, next);
    const right = said === 'higher' ? 'up' : said === 'lower' ? 'down' : null;
    const up = g.alive.filter((id) => g.votes[id] === 'up').length;
    const down = g.alive.filter((id) => g.votes[id] === 'down').length;
    let goingOut = right === null ? [] : g.alive.filter((id) => g.votes[id] !== right);
    // The whole room wrong at once: nobody goes — there must be a winner.
    const everyoneWrong = goingOut.length === g.alive.length && g.alive.length > 0;
    if (everyoneWrong) goingOut = [];
    for (const id of goingOut) g.out[id] = g.turn;
    g.alive = g.alive.filter((id) => !goingOut.includes(id));
    g.at += 1;
    g.last = {
      card: card.title,
      next: next.title,
      said,
      up,
      down,
      out: goingOut.map((id) => this.nameOf(id)),
      everyoneWrong,
      pair: said === 'same',
    };
    if (g.alive.length === 1) {
      const id = g.alive[0];
      const name = this.nameOf(id);
      const code = this.mintDrink(id, name, this.rewardFor(this.state.games || 0), { updown: true });
      g.winner = { playerId: id, name, code };
      this.state.games = (this.state.games || 0) + 1;
      this.state.podiums.push({ at: this.now(), winner: name, cards: g.turn });
      this.state.phase = UPDOWN_PHASES.DONE;
    } else {
      this.state.phase = UPDOWN_PHASES.SHOWN;
    }
    this.changed();
    return { ok: true, said, out: goingOut.length, left: g.alive.length };
  }

  /** The next card: the one just turned is now the one to beat. */
  nextCard() {
    const g = this.state.game;
    if (!g || this.state.phase !== UPDOWN_PHASES.SHOWN) return { ok: false, reason: 'not_shown' };
    g.turn += 1;
    g.votes = {};
    g.last = null;
    g.closesAt = this.now() + VOTE_MS;
    this.state.phase = UPDOWN_PHASES.GUESSING;
    this.changed();
    return { ok: true, turn: g.turn };
  }

  /**
   * A MOVE SETTLES A GAME, it never throws one away (rule 9's shape): leaving
   * mid-game pays nobody — there is no leader to pay in a game of elimination
   * — but the cards already turned are kept for the record.
   */
  settleGame() {}

  /** Never over a card with the clock running. */
  busy() { return this.state.phase === UPDOWN_PHASES.GUESSING; }

  nameOf(id) {
    const p = this.state.players[id];
    return p ? p.name : 'Somebody';
  }

  /** Everybody who never voted on a card in the game on now. */
  removeIdlePlayers() {
    const g = this.state.game;
    if (!g) return { ok: true, removed: 0 };
    const idle = this.playerList().filter((p) => !g.votes[p.id] && !g.alive.includes(p.id) && !g.out[p.id]);
    for (const p of idle) this.removePlayer(p.id);
    return { ok: true, removed: idle.length };
  }

  /** Back to the start: the room stays, the games go. */
  resetAll() {
    this.state.game = null;
    this.state.games = 0;
    this.state.podiums = [];
    this.state.phase = UPDOWN_PHASES.LOBBY;
    this.changed();
    return true;
  }

  where() {
    const g = this.state.game;
    if (this.state.phase === UPDOWN_PHASES.FINISHED) return 'finished';
    if (this.state.phase === UPDOWN_PHASES.DONE) return 'the winner';
    if (g && (this.state.phase === UPDOWN_PHASES.GUESSING || this.state.phase === UPDOWN_PHASES.SHOWN)) {
      return `card ${g.turn}, ${g.alive.length} still in`;
    }
    return 'waiting to start';
  }

  // -------------------------------------------------------------- the views

  /** What every screen shares about the card on show. */
  cardView() {
    const g = this.state.game;
    if (!g) return null;
    const showing = this.state.phase === UPDOWN_PHASES.GUESSING ? cardAt(g.order, g.at).title : null;
    return {
      id: g.id,
      turn: g.turn,
      card: showing || (g.last ? g.last.card : cardAt(g.order, g.at).title),
      ...(g.last ? { next: g.last.next, said: g.last.said, pair: g.last.pair, everyoneWrong: g.last.everyoneWrong } : {}),
      closesAt: g.closesAt,
      alive: g.alive.length,
      entrants: g.entrants,
    };
  }

  screenView() {
    const g = this.state.game;
    const vote = voteForScreen(this.state);
    const view = {
      kind: 'updown',
      phase: this.state.phase,
      title: this.pack.title,
      playerCount: this.playerList().length,
    };
    const c = this.cardView();
    if (c) {
      view.updown = {
        ...c,
        // How many have SAID, never which way — until the card turns.
        voted: Object.keys(g.votes).filter((id) => g.alive.includes(id)).length,
        ...(g.last ? { up: g.last.up, down: g.last.down, outNames: g.last.out.slice(0, 12), outCount: g.last.out.length } : {}),
        // The last few standing, by face — faceKey, never the id (rule 3).
        ...(g.alive.length <= 12 ? { standing: g.alive.map((id) => ({ name: this.nameOf(id), face: faceKey(id) })) } : {}),
        ...(g.winner ? { winner: { name: g.winner.name, face: faceKey(g.winner.playerId) } } : {}),
      };
    }
    if (vote && !this.busy()) view.photoVote = vote;
    return view;
  }

  playerView(playerId) {
    const p = this.state.players[String(playerId || '')];
    if (!p) return this.wasRemoved(playerId) ? { kind: 'updown', kicked: true } : { kind: 'updown', rejoin: true };
    const g = this.state.game;
    const view = {
      kind: 'updown',
      phase: this.state.phase,
      title: this.pack.title,
      you: { id: p.id, name: p.name },
      playerCount: this.playerList().length,
    };
    const c = this.cardView();
    if (c) {
      view.updown = {
        ...c,
        status: g.alive.includes(p.id) ? 'in' : g.out[p.id] ? 'out' : 'watching',
        ...(g.votes[p.id] ? { vote: g.votes[p.id] } : {}),
        ...(g.out[p.id] ? { outOn: g.out[p.id] } : {}),
        ...(g.winner ? { winner: { name: g.winner.name, you: g.winner.playerId === p.id } } : {}),
      };
    }
    const mine = this.phoneVouchers(p.id);
    if (mine.length) view.vouchers = mine;
    const vote = voteForPlayer(this.state, p.id);
    if (vote && !this.busy()) view.photoVote = vote;
    return view;
  }

  hostView() {
    const g = this.state.game;
    const vote = voteForHost(this.state);
    const c = this.cardView();
    return {
      kind: 'updown',
      phase: this.state.phase,
      title: this.pack.title,
      playerCount: this.playerList().length,
      players: this.everyone().map((p) => ({
        id: p.id, name: p.name, connected: Boolean(p.connected), faceKey: faceKey(p.id),
        ...(p.organiser ? { organiser: true } : {}),
      })),
      ...(c ? {
        updown: {
          ...c,
          // The live split is the HOST's — the room only sees how many.
          up: g.alive.filter((id) => g.votes[id] === 'up').length,
          down: g.alive.filter((id) => g.votes[id] === 'down').length,
          ...(g.last ? { lastUp: g.last.up, lastDown: g.last.down, outNames: g.last.out } : {}),
          ...(g.winner ? { winner: { name: g.winner.name, code: g.winner.code || null } } : {}),
        },
      } : {}),
      nextPrize: this.rewardFor(this.state.games || 0),
      gamesRun: this.state.games || 0,
      minPlayers: MIN_PLAYERS,
      rewards: this.rewardList(),
      vouchers: Object.values(this.state.vouchers || {}),
      ...(vote ? { photoVote: vote } : {}),
    };
  }

  /**
   * What is filed if the night ENDS here. `kind: 'updown'` so the league drops
   * it; a night that played a quiz first is filed as that quiz by
   * `scoresOfTheNight()`, exactly as a night ending on the bingo is.
   */
  results() {
    return {
      kind: 'updown',
      packId: this.pack.id,
      title: this.pack.title,
      venue: this.state.venue || '',
      venueId: this.state.venueId || '',
      rewards: this.rewardList(),
      vouchers: Object.values(this.state.vouchers || {}),
      startedAt: this.state.startedAt,
      finishedAt: this.state.finishedAt,
      games: this.state.games || 0,
      podiums: this.state.podiums.slice(),
      players: this.playerList().length,
      leaderboard: this.playerList().map((p) => ({ name: p.name, faceKey: faceKey(p.id) })),
    };
  }
}

/** The `LAUNCHERS` entry — see the table at the top of `session.js`. */
export const UPDOWN_LAUNCHER = {
  // BUILT IN, like the deck: no file, no shelf, nothing to own.
  builtIn: true,
  load: () => upDownPack(),
  list: () => [upDownPack()],
  make: (pack, opts) => new UpDownGame({ pack, ...opts }),
  /*
   * A card dealt or turned, a vote, a phone joining and a drink minted or
   * spent all move the night forward (rule 7) — a vote lost to a crash is a
   * phone told it is out for a guess it made.
   */
  milestone: (s) => {
    const g = s.game;
    const votes = g ? Object.keys(g.votes || {}).length : 0;
    return `${s.phase}:${g ? `${g.id}:${g.turn}:${g.alive.length}:${votes}` : '-'}:${Object.keys(s.players || {}).length}:${
      Object.values(s.vouchers || {}).map((v) => `${v.code}${v.redeemedAt ? '!' : ''}${v.reinstated || ''}${v.carried ? '~' : ''}`).join(',')}`;
  },
  isOver: (s) => s.phase === UPDOWN_PHASES.FINISHED,
  empty: upDownPack(),
};
