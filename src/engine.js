/**
 * The quiz engine: players, phases, answers and scores.
 *
 * Design rules that everything else depends on:
 *
 *  1. THE SERVER OWNS THE CLOCK. Every timestamp used for scoring comes from
 *     `now()`, injected here. Phones never tell us how fast they were.
 *  2. NOTHING SENSITIVE LEAVES IN THE WRONG PAYLOAD. The answer key, the host
 *     notes and the round 3 "play this now" cue exist only in hostView().
 *     screenView() and playerView() build their objects field by field, so a
 *     new sensitive field cannot leak by accident.
 *  3. THE WHOLE THING IS SERIALISABLE. `this.state` is plain JSON, so crash
 *     recovery is just writing it to disk and reading it back.
 *
 * Rounds are plugins: a round has a `type` (`text`, `image`, `intro`, `multi`,
 * `alphabet`) and the only thing the engine does differently per type is decide
 * what there is to pick from, which of those picks are right, and which extra
 * fields the big screen and the host get. Those are `optionsFor`, `correctSet`
 * and `screenQuestionExtras` / `hostQuestionExtras`. Everything else — the
 * clock, the scoring, the tally, who picked what — works on indexes into a list
 * and does not know one round type from another.
 */

import {
  scoreAnswer, scoreMultiAnswer, responseSeconds, rankPlayers, teamScores,
  POINTS_CORRECT, POINTS_PER_WHOLE_SECOND, POINTS_FIRST_CORRECT,
} from './scoring.js';
import { ALPHABET, answerLetter, answerLetterIndex, revealMode } from './quizzes.js';
import * as chat from './chat.js';
// For faceKey — a player's public handle, derived one way from their id.
import { createHash } from 'node:crypto';

export const PHASES = {
  LOBBY: 'lobby',
  // How it works and how it scores, before anything is asked. Every room has
  // people who have never played this, and "why did they get more than us for
  // the same answer" is a question you want to answer once, up front, on the
  // screen — not six times at the bar.
  RULES: 'rules',
  ROUND_INTRO: 'round_intro',
  QUESTION: 'question',
  REVEAL: 'reveal',
  ROUND_BOARD: 'round_board',
  FINAL: 'final',
};

const DEFAULT_QUESTION_SECONDS = 20;

export class Engine {
  /**
   * @param {object} opts
   * @param {object} opts.quiz   a quiz pack (see quizzes/*.json)
   * @param {function(): number} [opts.now]  injectable clock, ms since epoch
   * @param {object} [opts.state] restored state from disk
   * @param {function(Engine): void} [opts.onChange] called after every mutation
   */
  constructor({ quiz, now = () => Date.now(), state = null, onChange = null }) {
    this.quiz = quiz;
    this.now = now;
    this.onChange = onChange;
    this.state = state || Engine.freshState(quiz);
    // Worked out on demand and thrown away by every mutation. See leaderboard().
    this.forgetBoard();
    // A restored state can point at a quiz that has since been edited; clamp
    // the pointers so we never crash on a missing question.
    this.clampPointers();
  }

  static freshState(quiz) {
    return {
      quizId: quiz.id,
      phase: PHASES.LOBBY,
      roundIndex: 0,
      questionIndex: 0,
      // Monotonic counter bumped on every change, so clients can spot a
      // missed update and the screen can re-key its animations.
      version: 0,
      question: null, // { startedAt, endsAt, seconds, closed }
      /*
       * ONLINE MODE — nobody is in the same room, so there is no projector to
       * look up at.
       *
       * It lives in the STATE and is set at launch, exactly like the look, the
       * card shape and the prizes, and for the reason those taught the hard
       * way: a SIGKILL mid-round must not bring the night back as the other
       * kind of night. What it actually changes is `playerView` — see rule 8
       * and the exception to it there.
       */
      online: false,
      // roomId -> messages. Only ever written on an online night; see `say()`.
      chat: {},
      /*
       * WHERE TONIGHT IS, as a name.
       *
       * A fact about this evening rather than about the pack, so it lives here
       * beside the look and the card shape and is set at launch — and it
       * survives a restart for the same reason they do: a night that came back
       * without its venue would be filed under nothing, and the archive is the
       * only record that it happened at all.
       *
       * Deliberately a plain NAME and not an id. Almost no venue is a
       * Quizporium account and almost none ever will be, so free text is the
       * common case and has to be the cheap one — "The Dog and Duck", typed
       * once and offered back next time. A linked venue account is an upgrade
       * that hangs off this later without changing what is stored today.
       */
      venue: '',
      /*
       * WHAT THE WINNER GETS — free text, set at launch, and empty by default.
       *
       * "A free drink at the bar", "£50 bar tab". A fact about tonight like the
       * venue, so it lives here and survives a restart: a voucher that came
       * back after a crash saying nothing is worse than no voucher at all.
       *
       * `reward` and NOT `prize`, deliberately. Bingo already has PRIZES — how
       * many lines pay out before the full house — and a second control called
       * Prize next to that one is the label collision this codebase has just
       * written a whole sweep category about. On the launch form it is "What
       * they win", which cannot be mistaken for a count.
       */
      reward: '',
      /*
       * THE VOUCHERS THEMSELVES, code -> record. Empty on an ordinary night.
       *
       * Issued once, when the final scores go up, and only if a reward was set.
       * In the STATE rather than a file for the same reason the marks are: a
       * `SIGKILL` at the end of a night must not lose the thing somebody is
       * about to take to the bar.
       */
      vouchers: {},
      /*
       * TEAM PLAY — several phones, one team, and the score is the AVERAGE.
       *
       * Off unless the host asked for it at launch, exactly like the look and
       * the card shape, so an ordinary night has an empty `teams` and takes
       * every code path it always did. With no teams the leaderboard is the
       * same function it has always been, which is what makes this safe to
       * ship the night before a gig.
       */
      teamPlay: false,
      teams: {},   // id -> { id, name, createdAt }
      players: {}, // id -> player
      answers: {}, // "roundIndex:questionIndex" -> { playerId -> answer }
      history: [], // one entry per completed question, for the recap
      startedAt: null,
      finishedAt: null,
    };
  }

  // ---------------------------------------------------------------- helpers

  changed() {
    this.state.version++;
    this.forgetBoard();
    if (this.onChange) this.onChange(this);
  }

  get rounds() {
    return this.quiz.rounds || [];
  }

  round(i = this.state.roundIndex) {
    return this.rounds[i] || null;
  }

  questions(i = this.state.roundIndex) {
    const r = this.round(i);
    return (r && r.questions) || [];
  }

  question(ri = this.state.roundIndex, qi = this.state.questionIndex) {
    return this.questions(ri)[qi] || null;
  }

  questionSeconds(ri = this.state.roundIndex) {
    const r = this.round(ri);
    return (r && r.questionSeconds) || this.quiz.questionSeconds || DEFAULT_QUESTION_SECONDS;
  }

  answerKey(ri = this.state.roundIndex, qi = this.state.questionIndex) {
    return `${ri}:${qi}`;
  }

  answersFor(ri = this.state.roundIndex, qi = this.state.questionIndex) {
    return this.state.answers[this.answerKey(ri, qi)] || {};
  }

  clampPointers() {
    const lastRound = Math.max(0, this.rounds.length - 1);
    this.state.roundIndex = Math.min(Math.max(0, this.state.roundIndex), lastRound);
    const lastQuestion = Math.max(0, this.questions().length - 1);
    this.state.questionIndex = Math.min(Math.max(0, this.state.questionIndex), lastQuestion);
  }

  /**
   * Where the quiz has got to, in one line, for somebody not looking at it.
   *
   * The console knew a quiz was running and nothing else, which reads as a
   * label rather than a live game — you cannot tell from it whether the room
   * is between rounds or twelve seconds into a question, and that decides
   * whether you touch anything.
   */
  where() {
    const s = this.state;
    const round = this.round();
    const roundName = round ? (round.title || `Round ${s.roundIndex + 1}`) : `Round ${s.roundIndex + 1}`;
    const n = this.questions().length;
    switch (s.phase) {
      case PHASES.LOBBY: return 'Waiting in the lobby';
      case PHASES.RULES: return 'The rules slide is up';
      case PHASES.ROUND_INTRO: return `${roundName} — about to start`;
      case PHASES.QUESTION: return `${roundName} — question ${s.questionIndex + 1} of ${n}`;
      case PHASES.REVEAL: return `${roundName} — question ${s.questionIndex + 1} of ${n}, answer showing`;
      case PHASES.ROUND_BOARD: return `Scores after ${roundName}`;
      case PHASES.FINAL: return 'Finished — the final scores are up';
      default: return '';
    }
  }

  /** Milliseconds left on the clock, or null when no question is running. */
  msRemaining() {
    if (this.state.phase !== PHASES.QUESTION || !this.state.question) return null;
    return Math.max(0, this.state.question.endsAt - this.now());
  }

  /** True once the clock has run out on the current question. */
  isExpired() {
    const left = this.msRemaining();
    return left !== null && left <= 0;
  }

  // ---------------------------------------------------------------- players

  /**
   * Join, or rejoin with an existing id. Rejoining keeps the score: phones
   * lock, people refresh, someone drops off wifi.
   */
  join({ playerId, name, token = '' }) {
    const at = this.now();
    // Joining again clears a previous removal — the host removes a team to tidy
    // up a duplicate or a name they regret, not to bar a phone for the night.
    if (playerId) forgetRemoved(this.state, playerId);
    /*
     * Rejoining as somebody needs their TOKEN, not just their id.
     *
     * Without this, knowing an id was enough to rename another team — and the
     * name goes on the projector, where there is deliberately no filter. A
     * request that cannot prove it falls through to the branch below and gets
     * a team of its own, which is what an honest new phone gets anyway: the
     * attacker gains nothing and nobody legitimate is ever refused.
     */
    const claimed = playerId && this.state.players[playerId];
    const existing = claimed && ownsPlayer(claimed, token) ? claimed : null;

    if (existing) {
      // Bind a phone that joined before tokens existed. First one wins, and
      // from then on the id alone proves nothing.
      if (!existing.token) existing.token = newToken();
      existing.connected = true;
      existing.lastSeenAt = at;
      const cleanName = cleanTeamName(name);
      // Only take a new name if they actually typed one (a reconnect posts
      // the stored name back, and we do not want a blank to wipe it).
      if (cleanName && cleanName !== existing.name) existing.name = cleanName;
      this.changed();
      return existing;
    }

    // The backstop. A room this size is not a real night — see MAX_PLAYERS.
    if (Object.keys(this.state.players).length >= MAX_PLAYERS) {
      return { id: '', name: '', full: true };
    }

    const player = {
      id: playerId && isSafeId(playerId) && !this.state.players[playerId] ? playerId : newId(),
      token: newToken(),
      name: cleanTeamName(name) || 'Team ' + (Object.keys(this.state.players).length + 1),
      score: 0,
      correctCount: 0,
      answeredCount: 0,
      totalResponseMs: 0,
      joinedAt: at,
      lastSeenAt: at,
      connected: true,
      // Latecomers are marked so the host knows why their score is low.
      joinedDuringQuiz: this.state.phase !== PHASES.LOBBY,
      // How many questions this phone has left the app during. See wandered().
      wanderedCount: 0,
    };
    this.state.players[player.id] = player;
    this.changed();
    return player;
  }

  touch(playerId) {
    const p = this.state.players[playerId];
    if (!p) return null;
    p.lastSeenAt = this.now();
    p.connected = true;
    // Deliberately no `changed()` — a phone saying hello is not news the room
    // needs pushing to it. But the board holds copies, so it does have to be
    // dropped or the host's list would keep showing this phone as away.
    this.forgetBoard();
    return p;
  }

  /**
   * This phone left the app while a question was up.
   *
   * **It is a note for the host, never a penalty, and it is never on the
   * projector or the phone.** You cannot lock a browser out of its other tabs,
   * and anything claiming to is theatre that fails in front of a room. What you
   * CAN see is that a phone went to the background mid-question — and once is
   * meaningless, because a phone call, a notification and the screen locking
   * all look exactly like this. Every question is not.
   *
   * So the app counts and the host decides. Deducting points automatically
   * would punish somebody whose mum rang, which on a Wednesday night is worse
   * than a cheat getting away with it.
   *
   * Once per player per question: the tab flicking in and out five times is one
   * person who left, not five offences.
   */
  wandered(playerId) {
    if (this.state.phase !== PHASES.QUESTION) return { ok: false, reason: 'not_a_question' };
    const player = this.state.players[playerId];
    if (!player) return { ok: false, reason: 'no_player' };

    const key = this.answerKey();
    this.state.wandered = this.state.wandered || {};
    const forQuestion = (this.state.wandered[key] = this.state.wandered[key] || {});
    if (forQuestion[playerId]) return { ok: true, already: true };

    forQuestion[playerId] = true;
    player.wanderedCount = (player.wanderedCount || 0) + 1;
    // Not `changed()`: the room does not need a push because somebody's screen
    // went dark, and pushing one would tell every phone that something
    // happened. The host sees it on the next state they get anyway.
    this.forgetBoard();
    return { ok: true };
  }

  /**
   * Say something in one of your rooms.
   *
   * ONLINE ONLY, and that is a deliberate second branch on the mode rather
   * than an accident of where it was written. A pub already has a room: sixty
   * people are looking at each other, and the whole app is arranged to keep
   * them looking UP. Putting a chat window on the phone in a pub is the one
   * change that would make an in-person night worse rather than the same, so
   * it does not exist there — which also means a Wednesday cannot be affected
   * by a bug in any of it.
   *
   * The rules about WHO may say WHAT live in `chat.js`, so this stays the
   * plumbing: check the mode, ask, stamp, keep.
   */
  say(playerId, room, text) {
    if (!this.state.online) return { ok: false, reason: 'not_online' };
    const player = this.state.players[playerId];
    const questionLive = this.state.phase === PHASES.QUESTION && !this.state.question?.closed;
    const verdict = chat.mayPost({ player, room, text, questionLive });
    if (!verdict.ok) return verdict;

    this.state.chat = this.state.chat || {};
    const message = chat.append(this.state.chat, room, {
      // Enough to key a list on and to sort by; never anything derived from
      // the player id, which is a bearer credential (rule 3).
      id: `${this.state.version}-${Object.keys(this.state.players).length}-${this.now()}`,
      at: this.now(),
      by: player.faceKey || faceKey(player.id),
      name: player.name,
      text: verdict.text,
    });
    this.changed();
    return { ok: true, message };
  }

  /**
   * Mark somebody as an organiser — the client's own contact, and their IT
   * person.
   *
   * They are in the back channel and they are NOT in the quiz: `answer()`
   * refuses them and `leaderboard()` leaves them out, or the person who booked
   * you ends up winning their own event, which is a story that gets told.
   */
  setOrganiser(playerId, on = true) {
    const player = this.state.players[playerId];
    if (!player) return { ok: false, reason: 'no_player' };
    player.organiser = Boolean(on);
    this.changed();
    return { ok: true };
  }

  /** Who left the app during the question now on screen. Host view only. */
  wanderedNow() {
    const forQuestion = (this.state.wandered || {})[this.answerKey()] || {};
    return Object.keys(forQuestion)
      .map((id) => this.state.players[id])
      .filter(Boolean)
      .map((p) => p.name);
  }

  /**
   * Everybody who has joined and then done nothing at all.
   *
   * Tidying a lobby is the everyday use — duplicates, somebody who joined
   * twice, a phone that wandered off before the first question — and it is
   * also how a room gets cleaned up if a flood ever gets past the door.
   *
   * "Done nothing" is deliberately answered NOTHING rather than "not connected
   * recently": a phone that locks its screen is still somebody sitting at a
   * table, and throwing them out would be the removal rule broken from the
   * other side.
   */
  removeIdlePlayers() {
    const idle = this.playerList().filter((p) => !p.answeredCount);
    for (const p of idle) this.removePlayer(p.id);
    if (idle.length) this.changed();
    return { ok: true, removed: idle.length };
  }

  removePlayer(playerId) {
    if (!this.state.players[playerId]) return false;
    delete this.state.players[playerId];
    for (const key of Object.keys(this.state.answers)) {
      delete this.state.answers[key][playerId];
    }
    for (const key of Object.keys(this.state.wandered || {})) {
      delete this.state.wandered[key][playerId];
    }
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

  /** Host safety valve: nudge a score by hand when something goes wrong. */
  adjustScore(playerId, delta) {
    const p = this.state.players[playerId];
    if (!p) return false;
    const n = Math.round(Number(delta));
    if (!Number.isFinite(n)) return false;
    p.score += n;
    this.changed();
    return true;
  }

  playerList() {
    // Organisers are in the game's player list because they hold a phone, a
    // token and a chat room — and they are in nobody's scoreboard, nobody's
    // tally and nobody's fastest finger. Filtered HERE, in the one function
    // everything counting people goes through, rather than at each of them.
    return Object.values(this.state.players).filter((p) => !p.organiser);
  }

  /** Everybody holding a phone, organisers included. For chat and removal. */
  everyone() {
    return Object.values(this.state.players);
  }

  /**
   * The scores in order, worked out ONCE per change rather than once per phone.
   *
   * This is the hot path of the whole app. Every state push builds a separate
   * payload for every connected phone, and every one of those payloads used to
   * sort the entire room from scratch to find that one player's position — two
   * hundred sorts of two hundred people, for a single answer landing. The cost
   * of an update therefore grew with the SQUARE of the crowd, and so did the
   * number of updates, which is a bad pair of numbers to multiply together.
   *
   * Measured on a room of 200: 11.5ms an update, of which 7.3ms was this. With
   * the board worked out once it is under 4ms, and — the part that matters —
   * it now grows in a straight line rather than a curve, so a bigger room costs
   * proportionally more instead of catastrophically more.
   *
   * The cache is thrown away by `changed()`, which every mutation already calls,
   * so there is no way to leave a stale board behind by forgetting something.
   */
  leaderboard() {
    if (this._board) return this._board;
    /*
     * WITHOUT TEAM PLAY THIS IS THE FUNCTION IT HAS ALWAYS BEEN, character for
     * character, and that is the point rather than a nicety: an ordinary pub
     * night must not take a new code path because a feature it is not using
     * exists. `scripts/pub-unchanged.mjs` is what proves it.
     */
    if (!this.state.teamPlay) {
      this._board = rankPlayers(this.playerList());
      return this._board;
    }
    // A player on no team is a team of one, so the board is one kind of row.
    this._board = rankPlayers(teamScores(this.playerList(), this.state.teams || {}));
    return this._board;
  }

  /**
   * Which row on the board is THIS player's — their team's, if they are on one.
   *
   * The phone says "3rd of 12", and on a team night the honest answer is where
   * the TEAM is standing. A player's own position among individuals would be a
   * different number from the one on the projector, which is the exact fault
   * the two-screens rule exists to prevent.
   */
  boardIdFor(playerId) {
    const player = this.state.players[playerId];
    if (!player) return playerId;
    return this.state.teamPlay && player.teamId && this.state.teams?.[player.teamId]
      ? `team:${player.teamId}`
      : playerId;
  }

  /**
   * Make a team. Returns its id.
   *
   * Named by whoever starts it, tidied exactly like a team NAME already is —
   * control characters out, 28 characters, no word filtering. It goes on the
   * projector, and the rule about that has not changed.
   */
  makeTeam(name) {
    // Not on a night that is not a team night. Without this a phone could
    // write teams into the state of an ordinary quiz — harmless on the board,
    // which ignores them, and still the kind of thing that turns up in an
    // archive months later with nobody able to account for it.
    if (!this.state.teamPlay) return { ok: false, reason: 'not_team_play' };
    const clean = String(name || '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 28);
    if (!clean) return { ok: false, reason: 'no_name' };
    this.state.teams = this.state.teams || {};
    const existing = Object.values(this.state.teams).find((t) => t.name.toLowerCase() === clean.toLowerCase());
    // Two teams with one name is the same problem two players with one name
    // has, and here it is worse: you would not know which one to join.
    if (existing) return { ok: true, id: existing.id, already: true };
    const id = `t${Object.keys(this.state.teams).length + 1}-${this.now().toString(36)}`;
    this.state.teams[id] = { id, name: clean, createdAt: this.now() };
    this.changed();
    return { ok: true, id };
  }

  /** Join a team, or leave one by passing nothing. */
  joinTeam(playerId, teamId) {
    if (!this.state.teamPlay) return { ok: false, reason: 'not_team_play' };
    const player = this.state.players[playerId];
    if (!player) return { ok: false, reason: 'no_player' };
    if (teamId && !this.state.teams?.[teamId]) return { ok: false, reason: 'no_team' };
    /*
     * NOT MID-QUESTION.
     *
     * Otherwise somebody watches the tally, sees which team is doing well and
     * hops into it before the reveal — or worse, leaves a team just before it
     * scores badly. A team is who you were sitting with, so it is settled
     * between questions.
     */
    if (this.state.phase === PHASES.QUESTION && !this.state.question?.closed) {
      return { ok: false, reason: 'mid_question' };
    }
    player.teamId = teamId || null;
    this.changed();
    return { ok: true };
  }

  /** The teams, with how many are in each. For the phone's picker. */
  teamList() {
    const teams = Object.values(this.state.teams || {});
    const counts = new Map();
    for (const p of this.playerList()) {
      if (p.teamId) counts.set(p.teamId, (counts.get(p.teamId) || 0) + 1);
    }
    return teams.map((t) => ({ id: t.id, name: t.name, size: counts.get(t.id) || 0 }));
  }

  /**
   * Where one player stands, without walking the whole board to find them.
   *
   * Built alongside the board and thrown away with it. A `.find()` per phone is
   * the same quadratic shape as the sort was, just cheaper — worth closing at
   * the same time rather than leaving to be rediscovered.
   */
  positionOf(playerId) {
    if (!this._positions) {
      this._positions = new Map(this.leaderboard().map((p) => [p.id, p.position]));
    }
    // On a team night the row is the TEAM's, so the phone and the projector
    // report the same standing. `boardIdFor` is the one place that maps it.
    return this._positions.get(this.boardIdFor(playerId)) ?? null;
  }

  /** How many are playing. Free once the board is built. */
  playerCount() {
    return this.leaderboard().length;
  }

  forgetBoard() {
    this._board = null;
    this._positions = null;
  }

  // ----------------------------------------------------------------- phases

  start() {
    if (this.rounds.length === 0) return false;
    // The rules come first, unless a pack says otherwise.
    this.state.phase = this.quiz.showRules === false ? PHASES.ROUND_INTRO : PHASES.RULES;
    this.state.roundIndex = 0;
    this.state.questionIndex = 0;
    this.state.startedAt = this.now();
    this.state.finishedAt = null;
    this.changed();
    return true;
  }

  /**
   * Put the scores on the big screen, mid-round, without moving the quiz.
   *
   * Deliberately a flag rather than a phase. The host wants this every few
   * questions, and a phase change would have to be undone to get back — which
   * is one more thing to get wrong in front of a room, and the one failure
   * that would lose everybody's place. Nothing about where the quiz is changes
   * here; the screen simply shows something else for a minute.
   *
   * Refused while a question is live: the room cannot answer what it cannot
   * see, and the clock would keep running behind it.
   */
  showScoreboard(on = true) {
    const wanted = Boolean(on);
    if (wanted && this.state.phase === PHASES.QUESTION && !this.state.question?.closed) {
      return { ok: false, reason: 'question_live' };
    }
    if (this.state.scoreboard === wanted) return { ok: true, scoreboard: wanted };
    this.state.scoreboard = wanted;
    if (wanted) this.state.advert = null;
    this.changed();
    return { ok: true, scoreboard: wanted };
  }

  /**
   * Put an advertising slide on the big screen, between rounds.
   *
   * Same shape as the scoreboard and for the same reason: a flag, not a phase.
   * The quiz does not move, so there is nothing to undo and no way to lose
   * your place — and pressing onwards takes it down and carries on.
   *
   * Refused over a live question. A pizza offer over a question with the clock
   * running is the one thing that would make a venue slide feel like an
   * intrusion rather than part of the night.
   */
  showAdvert(ref) {
    if (!ref) {
      if (!this.state.advert) return { ok: true, advert: null };
      this.state.advert = null;
      this.changed();
      return { ok: true, advert: null };
    }
    if (this.state.phase === PHASES.QUESTION && !this.state.question?.closed) {
      return { ok: false, reason: 'question_live' };
    }
    this.state.advert = { packId: String(ref.packId || ''), slideId: String(ref.slideId || '') };
    // Two things cannot be on the projector at once.
    this.state.scoreboard = false;
    this.changed();
    return { ok: true, advert: this.state.advert };
  }

  /** Put the current question on the screen and start the clock. */
  askQuestion() {
    if (!this.question()) return false;
    // A question can never appear behind the scoreboard or an advert.
    this.state.scoreboard = false;
    this.state.advert = null;
    const seconds = this.questionSeconds();
    const startedAt = this.now();
    this.state.phase = PHASES.QUESTION;
    this.state.question = {
      startedAt,
      endsAt: startedAt + seconds * 1000,
      seconds,
      closed: false,
    };
    this.changed();
    return true;
  }

  /**
   * Close the question and show the answer. Called by the host, or
   * automatically when the clock runs out.
   */
  reveal() {
    if (this.state.phase !== PHASES.QUESTION) return false;
    this.state.question.closed = true;
    this.state.question.revealedAt = this.now();
    this.state.phase = PHASES.REVEAL;

    // Freeze a summary of the question for the recap and the export.
    const q = this.question();
    const round = this.round();
    const answers = this.answersFor();
    this.state.history = this.state.history.filter(
      (h) => !(h.roundIndex === this.state.roundIndex && h.questionIndex === this.state.questionIndex),
    );
    this.state.history.push({
      roundIndex: this.state.roundIndex,
      questionIndex: this.state.questionIndex,
      prompt: q ? q.prompt : '',
      correctIndex: q && round ? [...this.correctSet(q, round)][0] ?? -1 : -1,
      correctText: q && round ? this.answerText(q, round) : '',
      answerCount: Object.keys(answers).length,
      correctCount: Object.values(answers).filter((a) => a.correct).length,
      revealedAt: this.state.question.revealedAt,
    });
    this.changed();
    return true;
  }

  /**
   * The host's single "onwards" button. Moves through:
   * lobby -> round intro -> question -> reveal -> ... -> round board -> ... -> final
   */
  next() {
    const s = this.state;
    // Moving on always puts the quiz back on screen. Pressing onwards with the
    // scores or an advert up should do the obvious thing rather than need two
    // presses.
    s.scoreboard = false;
    s.advert = null;
    switch (s.phase) {
      case PHASES.LOBBY:
        return this.start();

      case PHASES.RULES:
        s.phase = PHASES.ROUND_INTRO;
        this.changed();
        return true;

      case PHASES.ROUND_INTRO:
        s.questionIndex = 0;
        return this.askQuestion();

      case PHASES.QUESTION:
        return this.reveal();

      case PHASES.REVEAL: {
        const isLastQuestion = s.questionIndex >= this.questions().length - 1;
        if (isLastQuestion) {
          s.phase = PHASES.ROUND_BOARD;
          s.question = null;
          this.changed();
          return true;
        }
        s.questionIndex++;
        return this.askQuestion();
      }

      case PHASES.ROUND_BOARD: {
        const isLastRound = s.roundIndex >= this.rounds.length - 1;
        if (isLastRound) {
          s.phase = PHASES.FINAL;
          s.finishedAt = this.now();
          s.question = null;
          this.issueVouchers();
          this.changed();
          return true;
        }
        s.roundIndex++;
        s.questionIndex = 0;
        s.phase = PHASES.ROUND_INTRO;
        s.question = null;
        this.changed();
        return true;
      }

      case PHASES.FINAL:
      default:
        return false;
    }
  }

  /**
   * End the quiz now, wherever it is.
   *
   * A night runs long, the kitchen wants the room back, or the pub empties —
   * and pressing onwards through eleven remaining questions to reach the
   * winner is not a thing anybody should have to do in front of people.
   *
   * Scores are kept and the final board is shown, so the night still ends
   * properly with a winner rather than just stopping. It is archived on the
   * way, like any finished game.
   *
   * Recoverable: Back from the final results returns to the round board, so a
   * mis-tap is one press to undo.
   */
  finish() {
    if (this.state.phase === PHASES.FINAL) return false;
    this.state.phase = PHASES.FINAL;
    this.state.finishedAt = this.now();
    this.state.question = null;
    this.state.scoreboard = false;
    this.state.advert = null;
    // A night stopped early still has a winner, so it still has a voucher.
    this.issueVouchers();
    this.changed();
    return true;
  }

  /**
   * The winner's voucher, made once when the final scores go up.
   *
   * **Nothing happens at all unless a reward was set at launch**, which is the
   * ordinary night: no reward, no vouchers, not one new field in any payload.
   *
   * It is issued to the BOARD ROW rather than to a player, which is what makes
   * teams free — `leaderboard()` already returns one row per team on a team
   * night and one per person otherwise, so a team of six gets ONE voucher
   * between them rather than six drinks.
   *
   * A TIE GETS ONE EACH. Two rows can share position 1, the room watched it
   * happen, and a voucher that silently went to whichever sorted first would
   * be the app picking a winner the projector did not.
   *
   * Idempotent: `back()` off the final and forward again must not mint a
   * second code for the same winner, which would leave the first one in
   * somebody's hand looking valid.
   */
  issueVouchers() {
    const s = this.state;
    if (!s.reward) return;
    if (!s.vouchers) s.vouchers = {};
    const already = new Set(Object.values(s.vouchers).map((v) => v.winnerId));
    for (const row of this.leaderboard()) {
      if (row.position !== 1) continue;
      if (already.has(row.id)) continue;
      let code = newVoucherCode();
      while (s.vouchers[code]) code = newVoucherCode();
      s.vouchers[code] = {
        code,
        winnerId: row.id,
        name: row.name,
        reward: s.reward,
        venue: s.venue || '',
        issuedAt: this.now(),
        redeemedAt: null,
        reinstated: 0,
        history: [],
      };
    }
  }

  /**
   * Spend it. Returns the voucher, or why not.
   *
   * **The FIRST scan wins and every later one is told so**, which is the whole
   * reason a screenshot does not break this: the phone is not what gets
   * checked, the server is. `by` is who did it — the bar scanning, or the host
   * doing it by hand when the bar's phone cannot reach us.
   */
  redeemVoucher(code, { by = 'scan' } = {}) {
    const v = (this.state.vouchers || {})[String(code || '').toUpperCase()];
    if (!v) return { ok: false, reason: 'unknown' };
    if (v.redeemedAt) return { ok: false, reason: 'already', voucher: v };
    v.redeemedAt = this.now();
    v.history.push({ what: 'redeemed', by, at: v.redeemedAt });
    this.changed();
    return { ok: true, voucher: v };
  }

  /**
   * Put it back, which only the HOST can do.
   *
   * The bar comes over and says it is not working; one tap and it is live
   * again. Nothing in this app is a dead end, and the override belongs to the
   * person actually in the room — the same rule that makes Back undo a reveal.
   *
   * The count is kept rather than the flag simply being cleared, because "this
   * one has been reinstated three times" is the thing worth knowing before you
   * do it a fourth time.
   */
  reinstateVoucher(code) {
    const v = (this.state.vouchers || {})[String(code || '').toUpperCase()];
    if (!v) return { ok: false, reason: 'unknown' };
    if (!v.redeemedAt) return { ok: false, reason: 'not_redeemed', voucher: v };
    v.history.push({ what: 'reinstated', by: 'host', at: this.now(), was: v.redeemedAt });
    v.redeemedAt = null;
    v.reinstated += 1;
    this.changed();
    return { ok: true, voucher: v };
  }

  /** Step backwards. Useful when the host overshoots in front of a room. */
  back() {
    const s = this.state;
    s.scoreboard = false;
    s.advert = null;
    switch (s.phase) {
      case PHASES.REVEAL:
        // Back from a reveal reopens the same question, cleared, from the top.
        return this.redoQuestion();
      case PHASES.QUESTION:
        // The usual reason for pressing Back here is pressing Next once too
        // often on the previous reveal. So go back to that reveal, with its
        // scores and its fastest finger intact, rather than anywhere clever.
        if (s.questionIndex > 0) {
          s.questionIndex--;
          s.phase = PHASES.REVEAL;
          const seconds = this.questionSeconds();
          const at = this.now();
          s.question = { startedAt: at - seconds * 1000, endsAt: at, seconds, closed: true, revealedAt: at };
          this.changed();
          return true;
        }
        s.phase = PHASES.ROUND_INTRO;
        s.question = null;
        this.changed();
        return true;
      case PHASES.ROUND_BOARD:
        s.questionIndex = Math.max(0, this.questions().length - 1);
        s.phase = PHASES.REVEAL;
        this.changed();
        return true;
      case PHASES.ROUND_INTRO:
        // Back from the very first round is back to the rules, which is where
        // it came from — usually because somebody walked in late and asked how
        // the scoring works.
        if (s.roundIndex === 0) {
          if (this.quiz.showRules === false) return false;
          s.phase = PHASES.RULES;
          this.changed();
          return true;
        }
        s.roundIndex--;
        s.phase = PHASES.ROUND_BOARD;
        this.changed();
        return true;
      case PHASES.RULES:
        s.phase = PHASES.LOBBY;
        this.changed();
        return true;
      case PHASES.FINAL:
        s.phase = PHASES.ROUND_BOARD;
        s.finishedAt = null;
        this.changed();
        return true;
      default:
        return false;
    }
  }

  /**
   * Skip the current question entirely: no scores, straight to the next one.
   * For when a question turns out to be wrong, or the room has heard it.
   */
  skipQuestion() {
    const s = this.state;
    if (s.phase !== PHASES.QUESTION && s.phase !== PHASES.REVEAL) return false;
    this.clearQuestionScores(s.roundIndex, s.questionIndex);
    s.history = s.history.filter(
      (h) => !(h.roundIndex === s.roundIndex && h.questionIndex === s.questionIndex),
    );

    const isLastQuestion = s.questionIndex >= this.questions().length - 1;
    if (isLastQuestion) {
      s.phase = PHASES.ROUND_BOARD;
      s.question = null;
      this.changed();
      return true;
    }
    s.questionIndex++;
    return this.askQuestion();
  }

  /**
   * Run the current question again from scratch: wipe the points it awarded
   * and restart the clock. For when the PA cut out or the projector dropped.
   */
  redoQuestion() {
    const s = this.state;
    if (s.phase !== PHASES.QUESTION && s.phase !== PHASES.REVEAL) return false;
    this.clearQuestionScores(s.roundIndex, s.questionIndex);
    s.history = s.history.filter(
      (h) => !(h.roundIndex === s.roundIndex && h.questionIndex === s.questionIndex),
    );
    return this.askQuestion();
  }

  /** Jump straight to a question. Used by the host view and the preview tool. */
  goTo(roundIndex, questionIndex) {
    if (!this.rounds[roundIndex]) return false;
    if (!this.questions(roundIndex)[questionIndex]) return false;
    this.state.roundIndex = roundIndex;
    this.state.questionIndex = questionIndex;
    return this.askQuestion();
  }

  /** Undo every point a single question awarded, and the per-player tallies. */
  clearQuestionScores(ri, qi) {
    const key = this.answerKey(ri, qi);
    const answers = this.state.answers[key];
    if (!answers) return;
    for (const [playerId, a] of Object.entries(answers)) {
      const p = this.state.players[playerId];
      if (!p) continue;
      p.score -= a.points;
      p.answeredCount = Math.max(0, p.answeredCount - 1);
      if (a.correct) p.correctCount = Math.max(0, p.correctCount - 1);
      p.totalResponseMs = Math.max(0, p.totalResponseMs - a.responseMs);
    }
    delete this.state.answers[key];
  }

  /** Wipe every score and answer but keep the players. Between-gig reset. */
  resetScores() {
    this.state.answers = {};
    this.state.history = [];
    for (const p of this.playerList()) {
      p.score = 0;
      p.correctCount = 0;
      p.answeredCount = 0;
      p.totalResponseMs = 0;
    }
    this.changed();
    return true;
  }

  /** Back to an empty lobby, ready for the next room. */
  resetAll() {
    this.state = Engine.freshState(this.quiz);
    this.changed();
    return true;
  }

  // ---------------------------------------------------------------- answers

  /**
   * Take an answer from a phone. The phone sends only which option it picked;
   * the timing and the scoring are entirely ours.
   *
   * @returns {{ok: boolean, reason?: string, points?: number}}
   */
  answer({ playerId, optionIndex, optionIndexes }) {
    const s = this.state;
    const player = s.players[playerId];
    if (!player) return { ok: false, reason: 'unknown_player' };
    /*
     * An ORGANISER is not a contestant.
     *
     * The client's contact and their IT person are in the back channel so the
     * host can be told the sound has gone — they did not come to compete, and
     * a room where the person who booked the night finishes second is a story
     * that gets told afterwards. Refused here as well as left off the board,
     * because a score that exists and is hidden is one that turns up later in
     * the archive.
     */
    if (player.organiser) return { ok: false, reason: 'organiser' };
    if (s.phase !== PHASES.QUESTION || !s.question) return { ok: false, reason: 'not_open' };

    const at = this.now();
    if (at >= s.question.endsAt || s.question.closed) return { ok: false, reason: 'too_late' };

    const q = this.question();
    const round = this.round();
    if (!q || !round) return { ok: false, reason: 'no_question' };

    const isMulti = round.type === 'multi';
    const options = this.optionsFor(q, round);
    const valid = (i) => Number.isInteger(i) && i >= 0 && i < options.length;

    // A phone sends which options it locked in, and nothing else. The timing
    // and the scoring stay here, exactly as they do for every other round.
    let picks;
    if (isMulti) {
      const wanted = this.pickCount(q, round);
      const raw = Array.isArray(optionIndexes) ? optionIndexes.map(Number) : [];
      picks = [...new Set(raw)];
      if (!picks.every(valid)) return { ok: false, reason: 'bad_option' };
      // Exactly N, refused rather than trimmed. Part marks only mean anything
      // against a fixed number of picks — allowing four when three were asked
      // for would let somebody cover the board and still score.
      if (picks.length !== wanted) return { ok: false, reason: 'wrong_count', wanted };
      picks.sort((a, b) => a - b);
    } else {
      const index = Number(optionIndex);
      if (!valid(index)) return { ok: false, reason: 'bad_option' };
      picks = [index];
    }

    const key = this.answerKey();
    if (!s.answers[key]) s.answers[key] = {};
    const answers = s.answers[key];
    // One answer per player per question. First one is final: no changing your
    // mind once it is in, which is what keeps the timing honest.
    if (answers[playerId]) return { ok: false, reason: 'already_answered' };

    const right = this.correctSet(q, round);
    const gotRight = picks.filter((i) => right.has(i)).length;
    // "Correct" means the whole set, on both kinds of question. Part marks
    // exist so nobody walks away with nothing, not as a second way of being
    // right — the bonus and the fastest-finger line both key off this.
    const correct = gotRight === right.size && picks.length === right.size;
    // The bonus goes to the first CORRECT answer, so a fast wrong guess
    // cannot take it off the player who actually knew.
    const isFirstCorrect = correct && !Object.values(answers).some((a) => a.correct);
    const points = isMulti
      ? scoreMultiAnswer({ gotRight, totalCorrect: right.size, answeredAt: at, endsAt: s.question.endsAt, isFirstCorrect })
      : scoreAnswer({ correct, answeredAt: at, endsAt: s.question.endsAt, isFirstCorrect });
    const responseMs = Math.max(0, at - s.question.startedAt);

    answers[playerId] = {
      optionIndex: picks[0],
      optionIndexes: picks,
      gotRight,
      outOf: right.size,
      answeredAt: at,
      responseMs,
      responseSeconds: responseSeconds(at, s.question.startedAt),
      correct,
      isFirstCorrect,
      points,
    };

    player.score += points;
    player.answeredCount++;
    player.totalResponseMs += responseMs;
    if (correct) player.correctCount++;
    player.lastSeenAt = at;

    this.changed();
    // "2 of 3" only means something on a pick-them-all question; on a normal
    // one it would be "0 of 1", which is just a noisier way of saying wrong.
    return { ok: true, points, correct, isFirstCorrect, ...(isMulti ? { gotRight, outOf: right.size } : {}) };
  }

  /**
   * What there is to pick from.
   *
   * Every round type answers with an index into a list, which is what lets one
   * `answer()`, one tally and one who-picked-what serve all of them. An
   * alphabet round's list is the twenty-six letters — it is not written into
   * the pack, so it is put back here.
   */
  optionsFor(q, round) {
    if (round && round.type === 'alphabet') return ALPHABET;
    return (q && q.options) || [];
  }

  /**
   * The right answers for a question, however many there are.
   *
   * One shape for every kind so nothing downstream has to branch: a normal
   * question is a set of one, and so is an alphabet question — the position of
   * its first letter in the keyboard.
   */
  correctSet(q, round) {
    if (round && round.type === 'multi') return new Set(q.correctIndexes || []);
    if (round && round.type === 'alphabet') return new Set([answerLetterIndex(q.answer)]);
    return new Set([q.correctIndex]);
  }

  /**
   * What to say the answer WAS, once the question is over.
   *
   * On an alphabet round this is the thing that matters: the room needs to hear
   * "Fleetwood Mac", not "F". The letter is only how they told you they knew it.
   */
  answerText(q, round) {
    if (round && round.type === 'alphabet') return q.answer || '';
    const options = this.optionsFor(q, round);
    return [...this.correctSet(q, round)].map((i) => options[i]).join(', ');
  }

  /** How many they must lock in. The room is told this; which ones, never. */
  pickCount(q, round) {
    return round && round.type === 'multi' ? (q.correctIndexes || []).length : 1;
  }

  /**
   * The "Fastest finger" line: first correct answer of the current question.
   *
   * @param {boolean} [withId]  include the real player id. **Host view only.**
   *   A player id is a bearer credential — see `faceKey` — so the screen and
   *   the phones get the derived handle and nothing else.
   */
  fastestFinger(ri = this.state.roundIndex, qi = this.state.questionIndex, { withId = false } = {}) {
    const answers = this.answersFor(ri, qi);
    let best = null;
    for (const [playerId, a] of Object.entries(answers)) {
      if (!a.correct) continue;
      if (!best || a.answeredAt < best.answeredAt) best = { ...a, playerId };
    }
    if (!best) return null;
    const p = this.state.players[best.playerId];
    return {
      // Safe anywhere. The real id rides along only for the host.
      faceKey: faceKey(best.playerId),
      ...(withId ? { playerId: best.playerId } : {}),
      name: p ? p.name : 'Unknown',
      seconds: best.responseSeconds,
      points: best.points,
    };
  }

  // ------------------------------------------------------------------ views
  //
  // Three payloads, built separately on purpose. The big screen payload is
  // assembled field by field from a whitelist, so nothing sensitive can ever
  // ride along in it.

  /** Shared, safe-for-anyone context. */
  baseView() {
    const s = this.state;
    const round = this.round();
    return {
      version: s.version,
      phase: s.phase,
      serverNow: this.now(),
      quizTitle: this.quiz.title,
      roundIndex: s.roundIndex,
      roundCount: this.rounds.length,
      questionIndex: s.questionIndex,
      questionCount: this.questions().length,
      roundTitle: round ? round.title : '',
      roundType: round ? round.type : null,
      playerCount: this.playerCount(),
    };
  }

  /**
   * Extra fields the big screen needs for this round type.
   * ROUND 3 RULE: the intro round deliberately returns nothing here. The track
   * title and artist live in `question.cue`, which only hostView() ever reads.
   */
  screenQuestionExtras(q, round, qi = 0) {
    switch (round.type) {
      case 'image':
        return {
          image: q.image ? `/quiz-images/${q.image}` : null,
          // The caption that makes clear these are illustrations, not photos.
          imageCaption: q.imageCaption || round.imageCaption || 'AI-generated illustration — not a real photograph',
          // How it gives itself away. Worked out here rather than on the screen
          // so `mix` rotates by the question's real position and the projector
          // is not left guessing where in the round it is.
          reveal: revealMode(round, q, qi),
          zoomFrom: q.zoomFrom ?? round.zoomFrom ?? 6,
          zoomTo: q.zoomTo ?? round.zoomTo ?? 1,
          zoomOriginX: q.zoomOriginX ?? 50,
          zoomOriginY: q.zoomOriginY ?? 40,
        };
      case 'intro':
        // Nothing. Not the title, not the artist, not the hint.
        return {};
      case 'multi':
        // How many to lock in, and nothing else. The count is the instruction
        // — without it the round is a guessing game about how long the answer
        // is. WHICH ones is the answer key and stays in the host view.
        return { pickCount: (q.correctIndexes || []).length };
      case 'alphabet':
        // A flag and nothing else. The options ARE the alphabet, which gives
        // nothing away; the answer and its letter are the answer key and stay
        // in the host view until the reveal.
        return { alphabet: true };
      case 'text':
      default:
        return {};
    }
  }

  /**
   * The rules slide.
   *
   * Built from the pack and from the scoring constants themselves, never
   * written out by hand. If the points ever change, this changes with them —
   * a rules slide that quietly disagrees with the scoring is worse than no
   * rules slide, because the room will hold you to what it said.
   *
   * The points and nothing else. There was a numbered list of how the night
   * works as well; the host took it off, because he says all of it on the mic
   * while the room is still getting a drink in, and a wall of text on the
   * slide the code is on is a wall of text nobody reads.
   *
   * "Team" is deliberately absent from the wording — this is played by
   * individuals for now. When team play lands, this is where the word comes
   * back.
   */
  rulesView() {
    const scoring = [
      { big: `${POINTS_CORRECT}`, text: 'for a correct answer' },
      { big: `+${POINTS_PER_WHOLE_SECOND}`, text: 'for every whole second left on the clock — answer fast' },
      { big: `+${POINTS_FIRST_CORRECT}`, text: 'for the first correct answer in' },
    ];

    return {
      title: this.quiz.title,
      subtitle: this.quiz.subtitle || '',
      scoring,
      // The bit that settles the argument before it starts.
      fastest: 'A fast wrong answer never takes the bonus off somebody who knew it.',
    };
  }

  /** What the projector shows. Never contains the answer key. */
  screenView() {
    const s = this.state;
    const view = this.baseView();
    const round = this.round();

    if (s.phase === PHASES.QUESTION || s.phase === PHASES.REVEAL) {
      const q = this.question();
      if (q && round) {
        view.question = {
          id: q.id,
          prompt: q.prompt,
          options: this.optionsFor(q, round),
          ...this.screenQuestionExtras(q, round, s.questionIndex),
        };
        view.clock = s.question
          ? {
              startedAt: s.question.startedAt,
              endsAt: s.question.endsAt,
              seconds: s.question.seconds,
              closed: s.question.closed,
            }
          : null;
        view.answeredCount = Object.keys(this.answersFor()).length;
      }
    }

    if (s.phase === PHASES.REVEAL) {
      const q = this.question();
      // Safe here and only here: the question is over, the room is meant to see it.
      const revealRound = this.round();
      const right = q && revealRound ? [...this.correctSet(q, revealRound)] : [];
      view.reveal = {
        // Kept for every round type so nothing downstream has to branch; a
        // normal question is a set of one.
        correctIndex: right[0] ?? -1,
        correctIndexes: right,
        correctText: q && revealRound ? this.answerText(q, revealRound) : '',
        // The letter, said out loud, so the big screen can show "F — Fleetwood
        // Mac" rather than leaving the room to count along the keyboard.
        ...(revealRound && revealRound.type === 'alphabet'
          ? { correctLetter: answerLetter(q && q.answer) }
          : {}),
        fastest: this.fastestFinger(),
        tally: this.optionTally(),
        answerNote: q ? q.answerNote || '' : '',
      };
    }

    if (s.phase === PHASES.RULES) view.rules = this.rulesView();

    // The scoreboard rides over whatever else is on screen, so the leaderboard
    // has to be there for it to draw.
    view.scoreboard = Boolean(s.scoreboard);
    if (s.scoreboard) view.leaderboard = this.leaderboard().map(publicPlayer);

    // An advert is looked up by the server rather than carried in state, so
    // editing a venue's slide changes what is on the projector without
    // anybody having to take it down and put it back up.
    if (s.advert && this.advertLookup) {
      const found = this.advertLookup(s.advert);
      if (found) {
        view.advert = {
          venue: found.pack.venue || '',
          heading: found.slide.heading,
          body: found.slide.body,
          image: found.slide.image ? `/quiz-images/${found.slide.image}` : null,
          link: found.slide.link || '',
          linkLabel: found.slide.linkLabel || '',
          // `say` is the host's line for the mic. Host view only, like a cue.
        };
      }
    }

    if (s.phase === PHASES.ROUND_INTRO && round) {
      view.roundIntro = {
        title: round.title,
        blurb: round.blurb || '',
        questionCount: this.questions().length,
        seconds: this.questionSeconds(),
        type: round.type,
      };
    }

    if (s.phase === PHASES.ROUND_BOARD || s.phase === PHASES.FINAL || s.phase === PHASES.LOBBY) {
      view.leaderboard = this.leaderboard().map(publicPlayer);
    }

    if (s.phase === PHASES.LOBBY) {
      view.lobby = {
        // The derived handle, for the same reason as the leaderboard: this
        // payload is public to anybody holding the join code, and the lobby is
        // where the whole room is listed at once.
        players: this.playerList()
          .sort((a, b) => b.joinedAt - a.joinedAt)
          .map((p) => ({ key: faceKey(p.id), name: p.name })),
      };
    }

    return view;
  }

  /** How many picked each option — a nice reveal graphic, gives nothing away early. */
  /**
   * Which teams picked each option, by name, and who did not answer at all.
   *
   * The counts already told the host that four got it wrong; this tells them
   * which four, which is the difference between "most of you had that" and
   * "Sofa King Good, what were you thinking". Named in the order they answered
   * so the first one in is the first one out of the host's mouth.
   *
   * A pick-them-all answer appears under every option it locked in — the same
   * as the tally, which is what makes the two agree.
   */
  whoPicked() {
    const q = this.question();
    if (!q) return null;
    const answers = this.answersFor();
    const byOption = this.optionsFor(q, this.round()).map(() => []);
    const answered = new Set();

    // In the order they answered, so the first one in is the first one out of
    // the host's mouth.
    const inOrder = Object.entries(answers)
      .sort(([, a], [, b]) => (a.answeredAt || 0) - (b.answeredAt || 0));

    for (const [playerId, a] of inOrder) {
      const player = this.state.players[playerId];
      if (!player) continue;
      answered.add(playerId);
      const picks = Array.isArray(a.optionIndexes) && a.optionIndexes.length
        ? a.optionIndexes
        : [a.optionIndex];
      for (const i of picks) {
        if (byOption[i]) byOption[i].push({ name: player.name, correct: Boolean(a.correct) });
      }
    }

    return {
      options: byOption,
      // Everyone still in the room who let it go by. Worth as much as the
      // wrong answers on a mic.
      missing: this.playerList()
        .filter((p) => !answered.has(p.id))
        .map((p) => p.name),
    };
  }

  optionTally() {
    const q = this.question();
    if (!q) return [];
    const tally = this.optionsFor(q, this.round()).map(() => 0);
    for (const a of Object.values(this.answersFor())) {
      // Every option they locked in counts, so the bars add up to the picks
      // made rather than the players who answered.
      const picks = a.optionIndexes || [a.optionIndex];
      for (const i of picks) if (tally[i] !== undefined) tally[i]++;
    }
    return tally;
  }

  /**
   * What one phone sees. Deliberately NOT the question text: the question is
   * on the big screen, which keeps the room looking up at the host and makes
   * googling harder.
   */
  playerView(playerId) {
    const s = this.state;
    const player = s.players[playerId];
    const round = this.round();
    const view = {
      version: s.version,
      phase: s.phase,
      serverNow: this.now(),
      quizTitle: this.quiz.title,
      roundIndex: s.roundIndex,
      roundCount: this.rounds.length,
      questionIndex: s.questionIndex,
      questionCount: this.questions().length,
      roundTitle: round ? round.title : '',
      // Not a secret — it is a fact about the night, and the phone has to lay
      // itself out differently for it.
      online: Boolean(s.online),
      /*
       * ONLY THE ROOMS THIS PERSON IS IN.
       *
       * Built by picking from `roomsFor()`, never by sending the lot and
       * hiding some of it — the same discipline as `whoPicked` being absent
       * from here rather than hidden with CSS. A chat leak is worse than an
       * answer-key leak: an answer is something they were going to be told in
       * twenty seconds anyway, and a team's messages are not.
       */
      chat: s.online ? chat.visibleTo(s.chat, player) : {},
      /*
       * Team play, and the list to pick from.
       *
       * Sent only when it is ON, so an ordinary night's payload does not grow
       * two empty fields — and `teamList()` is a handful of names and counts,
       * never anything about who answered what, which belongs to the host.
       */
      ...(s.teamPlay ? { teamPlay: true, teams: this.teamList(), yourTeam: player?.teamId || null } : {}),
      you: player
        ? {
            id: player.id,
            // Their own public handle, so the phone can find its own row on a
            // board that now carries keys rather than ids.
            key: faceKey(player.id),
            name: player.name,
            score: player.score,
            correctCount: player.correctCount,
            position: this.positionOf(player.id),
            playerCount: this.playerCount(),
          }
        : null,
    };
    if (!player) {
      // Two very different things used to land here. Telling them apart is the
      // whole point: only one of them should throw somebody out.
      if (wasRemoved(s, playerId)) view.kicked = true;
      else view.rejoin = true;
      return view;
    }

    if (s.phase === PHASES.QUESTION || s.phase === PHASES.REVEAL) {
      const q = this.question();
      if (q) {
        view.options = this.optionsFor(q, round); // options only, never the prompt
        /*
         * …EXCEPT ONLINE, WHERE THE PHONE IS THE ONLY SCREEN THERE IS.
         *
         * Rule 8 — phones never show the question text — is a PUB rule and it
         * is load-bearing there: it keeps the room looking up at the projector
         * and it makes googling harder. Online there is nothing to look up at.
         * The host is sharing a window in a video call, at whatever size
         * somebody's laptop decided, possibly behind a face, and a player who
         * cannot read the question cannot play at all.
         *
         * So online, and only online, a player gets what the SCREEN gets: the
         * prompt and the same per-type extras. It is deliberately
         * `screenQuestionExtras` rather than a second list — a new sensitive
         * field must not become visible here by being forgotten, so this can
         * only ever show what the projector already shows in front of a room.
         * The answer key is still nowhere near it.
         *
         * Known and accepted: googling is easier online. The clock is the same
         * twenty seconds, a corporate Christmas quiz is not the world
         * championship, and the alternative is a round nobody can read.
         */
        if (s.online) {
          view.prompt = q.prompt || '';
          const extras = this.screenQuestionExtras(q, round, s.questionIndex);
          /*
           * THE PICTURE IS HELD BACK, and this is a scoring decision rather
           * than an oversight.
           *
           * A round 2 picture is zoomed, pixelated, blurred or behind tiles for
           * most of its twenty seconds, and that reveal curve IS how many
           * points the question is worth. Handing the phone the finished image
           * would make the whole round a giveaway, and it would be worth
           * quietly more than every other round in the pack.
           *
           * The fields that DRIVE the effect are sent (`reveal`, the zoom
           * origin and range), so the day `play.js` can run the same animation
           * the projector does, this is one line. Until then an online picture
           * round wants the host's shared window, and that is worth saying out
           * loud rather than shipping a round that scores wrongly.
           */
          delete extras.image;
          Object.assign(view, extras);
        }
        // How many to lock in. The count only; which ones is the answer key.
        view.pickCount = this.pickCount(q, round);
        view.multi = Boolean(round && round.type === 'multi');
        // Which keyboard to draw. Not a secret — the alphabet is the alphabet.
        view.alphabet = Boolean(round && round.type === 'alphabet');
        view.clock = s.question
          ? { startedAt: s.question.startedAt, endsAt: s.question.endsAt, seconds: s.question.seconds, closed: s.question.closed }
          : null;
        const mine = this.answersFor()[playerId];
        view.yourAnswer = mine
          ? {
              optionIndex: mine.optionIndex,
              optionIndexes: mine.optionIndexes || [mine.optionIndex],
              // Never tell them whether they were right until the reveal.
              ...(s.phase === PHASES.REVEAL
                ? {
                    correct: mine.correct,
                    points: mine.points,
                    isFirstCorrect: mine.isFirstCorrect,
                    seconds: mine.responseSeconds,
                    // "You got 2 of 3" — the part-marks version of being told
                    // whether you were right.
                    ...(mine.outOf > 1 ? { gotRight: mine.gotRight, outOf: mine.outOf } : {}),
                  }
                : {}),
            }
          : null;
        if (s.phase === PHASES.REVEAL) {
          const right = [...this.correctSet(q, round)];
          view.reveal = {
            correctIndex: right[0] ?? -1,
            correctIndexes: right,
            correctText: this.answerText(q, round),
            ...(round && round.type === 'alphabet' ? { correctLetter: answerLetter(q.answer) } : {}),
            fastest: this.fastestFinger(),
          };
        }
      }
    }

    if (s.phase === PHASES.ROUND_BOARD || s.phase === PHASES.FINAL) {
      view.leaderboard = this.leaderboard().slice(0, 10).map(publicPlayer);
    }

    /*
     * THE WINNER'S VOUCHER, AND ONLY THEIRS.
     *
     * The code is a CREDENTIAL — the bar has no login, so holding it is the
     * whole proof — which makes this the same class of thing as the answer key
     * and it follows the same rule: built field by field into ONE role's
     * payload. It is never in `screenView()`, because the projector is pointed
     * at a room and a code on it is a code sixty people have; and never in
     * anybody else's `playerView()`.
     *
     * Matched on the BOARD ROW, so on a team night every member of the winning
     * team sees the one code they share.
     */
    if (s.phase === PHASES.FINAL && s.vouchers) {
      const mine = Object.values(s.vouchers).find((v) => v.winnerId === this.boardIdFor(playerId));
      if (mine) {
        view.voucher = {
          code: mine.code,
          name: mine.name,
          reward: mine.reward,
          venue: mine.venue,
          issuedAt: mine.issuedAt,
          redeemedAt: mine.redeemedAt,
        };
      }
    }

    return view;
  }

  /** What the host needs to work the scoreboard button. */
  scoreboardState() {
    return {
      on: Boolean(this.state.scoreboard),
      // Never over a live question: the room cannot answer what it cannot see.
      allowed: !(this.state.phase === PHASES.QUESTION && !this.state.question?.closed),
    };
  }

  /** Which advert is up, if any, and whether one could be. */
  advertState() {
    return {
      showing: this.state.advert || null,
      allowed: !(this.state.phase === PHASES.QUESTION && !this.state.question?.closed),
    };
  }

  /** Extra fields only the host gets. This is where the secrets live. */
  hostQuestionExtras(q, round, qi = 0) {
    const right = [...this.correctSet(q, round)];
    const extras = {
      correctIndex: right[0] ?? -1,
      correctIndexes: right,
      correctText: this.answerText(q, round),
      pickCount: this.pickCount(q, round),
      note: q.note || '',
      answerNote: q.answerNote || '',
    };
    if (round.type === 'alphabet') {
      // The answer in full and the letter it turns on. Host only until the
      // reveal, like every other answer key.
      extras.alphabet = true;
      extras.answer = q.answer || '';
      extras.correctLetter = answerLetter(q.answer);
    }
    if (round.type === 'intro' && q.cue) {
      // The round 3 "play this now" cue. Host phone only, never the projector.
      extras.cue = {
        title: q.cue.title || '',
        artist: q.cue.artist || '',
        from: q.cue.from || '',
        hint: q.cue.hint || '',
        // Tapping the cue opens the track, so there is nothing to search for
        // while a room waits. Host view only, like the rest of the cue.
        ...(q.cue.spotifyUri ? { spotifyUri: q.cue.spotifyUri } : {}),
        ...(q.cue.spotifyUrl ? { spotifyUrl: q.cue.spotifyUrl } : {}),
      };
    }
    if (round.type === 'image') {
      extras.image = q.image ? `/quiz-images/${q.image}` : null;
      // Which effect this one runs, so nothing on the projector is a surprise
      // to the person talking over it.
      extras.reveal = revealMode(round, q, qi);
    }
    if (round.spotifyPlaylist) extras.playlist = round.spotifyPlaylist;
    return extras;
  }

  /** The control view: everything, including the answer key. */
  hostView() {
    const s = this.state;
    const view = this.baseView();
    const round = this.round();
    const q = this.question();

    view.canStart = s.phase === PHASES.LOBBY && this.rounds.length > 0;
    /*
     * THE HOST SEES EVERY ROOM, and that is the whole moderation story.
     *
     * There is deliberately no word filtering here, exactly as there is none
     * on team names — the host asked for none and the reasoning is the same.
     * What replaces it is that nothing is said out of their sight and they can
     * already remove anybody, which is a person making a judgement rather than
     * a list of banned words making one badly.
     *
     * It is also the back channel: "the sound has gone" is said in the
     * organisers' room and has to reach the person holding the microphone.
     */
    view.chat = s.online ? (s.chat || {}) : {};
    if (s.teamPlay) view.teams = this.teamList();
    view.msRemaining = this.msRemaining();
    view.clock = s.question ? { ...s.question } : null;
    view.scoreboard = this.scoreboardState();
    view.advert = this.advertState();
    if (s.advert && this.advertLookup) {
      const found = this.advertLookup(s.advert);
      // What to say over the mic while it is up — the host's line, never the
      // projector's.
      if (found) view.advert.say = found.slide.say || '';
      if (found) view.advert.heading = found.slide.heading;
    }
    if (s.phase === PHASES.RULES) view.rules = this.rulesView();

    /*
     * THE VOUCHERS, host only, and the whole record of each — who won it, the
     * code, whether it has been spent, and every redeem and reinstate with a
     * time on it.
     *
     * Not on the projector and not on anybody else's phone: the code is the
     * credential. Empty on every night that set no reward, so the panel does
     * not exist rather than sitting there saying nothing.
     */
    view.vouchers = Object.values(s.vouchers || {});

    if (q && round) {
      view.question = {
        id: q.id,
        prompt: q.prompt,
        options: this.optionsFor(q, round),
        ...this.hostQuestionExtras(q, round, s.questionIndex),
      };
      view.answeredCount = Object.keys(this.answersFor()).length;
      view.tally = this.optionTally();
      view.fastest = this.fastestFinger(this.state.roundIndex, this.state.questionIndex, { withId: true });
      // WHO picked what, for the banter. Host view only, like the answer key
      // itself — putting names on the projector beside a wrong answer is a
      // different decision from the host reading one out, and not one to make
      // by accident.
      view.whoPicked = this.whoPicked();
      // Who left the app while this one was up. Host only, like the answer key
      // — a name on the projector under the heading "possibly cheating" is a
      // different decision from the host having a quiet word, and not one to
      // make by accident on the strength of a phone call coming in.
      view.wandered = this.wanderedNow();
    }

    // Always give the host the next question too, so they can read ahead and
    // cue up the track for round 3 before it goes on screen.
    const upcoming = this.peekNext();
    view.upcoming = upcoming;

    view.players = this.leaderboard().map((p) => ({
      id: p.id,
      name: p.name,
      score: p.score,
      position: p.position,
      correctCount: p.correctCount,
      answeredCount: p.answeredCount,
      connected: p.connected,
      joinedDuringQuiz: p.joinedDuringQuiz,
      wanderedCount: p.wanderedCount || 0,
      answeredThisQuestion: Boolean(this.answersFor()[p.id]),
      lastSeenAt: p.lastSeenAt,
    }));

    view.rounds = this.rounds.map((r, i) => ({
      index: i,
      title: r.title,
      type: r.type,
      questionCount: (r.questions || []).length,
      current: i === s.roundIndex,
    }));

    return view;
  }

  /** The question after this one, for the host's read-ahead panel. */
  peekNext() {
    const s = this.state;
    let ri = s.roundIndex;
    let qi = s.questionIndex;
    if (s.phase === PHASES.LOBBY || s.phase === PHASES.ROUND_INTRO) {
      qi = 0;
    } else if (qi >= this.questions(ri).length - 1) {
      ri++;
      qi = 0;
    } else {
      qi++;
    }
    const round = this.rounds[ri];
    const q = round && (round.questions || [])[qi];
    if (!q || !round) return null;
    return {
      roundIndex: ri,
      questionIndex: qi,
      roundTitle: round.title,
      roundType: round.type,
      prompt: q.prompt,
      options: this.optionsFor(q, round),
      ...this.hostQuestionExtras(q, round, qi),
    };
  }

  /** Everything needed for an end-of-night results export. */
  results() {
    return {
      quizId: this.quiz.id,
      quizTitle: this.quiz.title,
      // Where it happened. The whole reason a night is worth filing: a Past
      // gigs page that cannot say WHERE is a list of dates.
      venue: this.state.venue || '',
      // What was on offer and who has taken it. Part of the night's record, so
      // a queried bar tab has an answer rather than the quizmaster's word.
      reward: this.state.reward || '',
      vouchers: Object.values(this.state.vouchers || {}),
      startedAt: this.state.startedAt,
      finishedAt: this.state.finishedAt,
      leaderboard: this.leaderboard().map((p) => ({
        position: p.position,
        name: p.name,
        score: p.score,
        correctCount: p.correctCount,
        answeredCount: p.answeredCount,
      })),
      questions: this.state.history,
    };
  }
}

/**
 * A player as anybody in the room may see them.
 *
 * **`key`, never `id`, and this was a live leak.** The fastest finger was moved
 * onto `faceKey` when it turned out that a player id is a bearer credential —
 * but the LEADERBOARD was not, and the leaderboard is in the screen payload at
 * the round board, at the final, whenever the scoreboard flag is up and in the
 * lobby. So `/api/state?role=screen&g=CODE`, which anybody holding the code off
 * the projector can fetch, published an id for EVERY player all night rather
 * than for one of them at the reveal. The phone's own board carried everybody
 * else's too.
 *
 * The test that was supposed to stop this only looked at the reveal, which is
 * where the first one was found. It walks every phase now.
 *
 * `key` is still a stable handle, so the browser can use it to tell rows apart
 * and a photo still finds its person — it just gives nothing back.
 */
function publicPlayer(p) {
  return { key: faceKey(p.id), name: p.name, score: p.score, position: p.position, correctCount: p.correctCount };
}

export function cleanTeamName(name) {
  if (typeof name !== 'string') return '';
  // Strip control characters, collapse whitespace, cap the length so nobody
  // can blow up the projected leaderboard with a wall of text.
  return name
    .replace(/[\u0000-\u001f\u007f-\u009f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 28);
}

export function isSafeId(id) {
  return typeof id === 'string' && /^[A-Za-z0-9_-]{6,64}$/.test(id);
}

/**
 * Who the host actually threw out.
 *
 * A phone whose id the server does not recognise used to be told it had been
 * removed — which was true when the host removed it, and wrong every other
 * time. Every other time is a lost game: a redeploy, a restart on a host with
 * no permanent disk, or a fresh game launched over the top of a full lobby.
 *
 * Those all deserve a silent rejoin, not "you were removed from the quiz" and
 * a wiped team name. So removals are written down, and only a phone on this
 * list is ever told it was thrown out.
 *
 * The list is deliberately small — one entry per team the host removed by
 * hand, capped so a very long night cannot grow it without bound.
 */
const REMOVED_CAP = 200;

export function rememberRemoved(state, playerId) {
  if (!isSafeId(playerId)) return;
  const list = Array.isArray(state.removed) ? state.removed : [];
  state.removed = [...list.filter((id) => id !== playerId), playerId].slice(-REMOVED_CAP);
}

export function wasRemoved(state, playerId) {
  return Array.isArray(state.removed) && state.removed.includes(playerId);
}

/**
 * Rejoining after a removal is allowed — the host removes a team to clear a
 * duplicate or a name they have thought better of, not to ban a phone from the
 * building. Joining again just takes them off the list.
 */
export function forgetRemoved(state, playerId) {
  if (!Array.isArray(state.removed)) return;
  state.removed = state.removed.filter((id) => id !== playerId);
}

export function newId() {
  // Short, URL-safe, and unguessable enough that nobody hijacks a team.
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * A player's PUBLIC handle — safe to put on the projector, useless as a key.
 *
 * **A player id is a bearer credential.** There is no login for a phone: the id
 * IS the proof, so anything holding it can answer as that player and rename
 * them. It therefore must never appear in a payload anybody can fetch — and
 * the join code is printed on the projector and read out on the mic, so
 * `/api/state?role=screen&g=CODE` is exactly that.
 *
 * It used to carry the real id, on the "Fastest finger" line. So the person
 * winning was the person whose credential was published, and anyone in the
 * room could lock out their next answer with a deliberately wrong one, or
 * rename them to anything at all on the big screen.
 *
 * The screen still needs a STABLE key, because a photo is matched to the
 * fastest finger by id rather than by name — two teams picking the same name
 * is a thing that happens, and the wrong person's face six feet wide is not a
 * small mistake. So it gets a one-way derivation instead: the same player
 * always gives the same key, and the key gives nothing back.
 */
/**
 * The proof that this phone IS that player.
 *
 * **The id used to be the credential**, which meant anything that learned an
 * id could answer as that player and rename them — see `faceKey` above for how
 * one got published. `faceKey` stopped the leak; this stops the class, so the
 * next thing that prints a player id somewhere is a tidiness problem rather
 * than a way to sabotage the person winning.
 *
 * Issued at join, stored on the player, kept in the state file so it survives
 * a crash, and never in any payload but that player's own join reply.
 */
/**
 * A voucher code — short enough to read out, long enough not to be guessed.
 *
 * The same alphabet as a join code: no vowels, so it cannot spell a word, and
 * none of O/0/I/1/L, which are the pairs people mistype off a screen. Eight
 * characters of a 28-letter alphabet is about 3.8 x 10^11 — and unlike a join
 * code this one is a CREDENTIAL, because the bar has no login and holding the
 * code is the whole proof. A wrong code finds nothing rather than a near miss,
 * exactly like a join code.
 */
const VOUCHER_ALPHABET = '23456789BCDFGHJKMNPQRSTVWXYZ';

export function newVoucherCode(length = 8) {
  const bytes = new Uint8Array(length);
  globalThis.crypto.getRandomValues(bytes);
  let out = '';
  for (let i = 0; i < length; i++) out += VOUCHER_ALPHABET[bytes[i] % VOUCHER_ALPHABET.length];
  return out;
}

export function newToken() {
  const bytes = new Uint8Array(24);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Is this request allowed to act as this player?
 *
 * **A player with no token yet is trusted once and then bound.** Phones that
 * joined before this existed hold an id and nothing else, and a redeploy
 * mid-season must not lock a room out of its own game — that is the same rule
 * as "only a real removal throws a phone out". So the first request for a
 * tokenless player is accepted and issues one; every request after that has to
 * carry it.
 */
export function ownsPlayer(player, token) {
  if (!player) return false;
  if (!player.token) return true;
  return typeof token === 'string' && token.length >= 16 && token === player.token;
}

/**
 * How many phones one game will hold.
 *
 * Not a capacity claim — the documented number is 300 and the measured cost is
 * linear well past that. This is a backstop on the STATE FILE, which is one
 * JSON object rewritten as the night goes on: at a thousand players it is
 * 4.3MB and 33ms to serialise, several times a second, which would be felt in
 * the room. Set far enough above any real night that nobody honest meets it.
 *
 * It does NOT stop somebody in the room scripting joins with the code off the
 * projector — see TODO.md. The honest mitigations for that are the host's own
 * Remove and Clear everything, and per-IP limiting is not one of them, because
 * a pub puts the whole room behind one address.
 */
export const MAX_PLAYERS = 600;

export function faceKey(playerId) {
  const id = String(playerId || '');
  if (!id) return '';
  return createHash('sha256').update(`face:${id}`).digest('hex').slice(0, 16);
}
