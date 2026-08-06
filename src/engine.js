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
 * Rounds are plugins: a round has a `type` (`text`, `image`, `intro`) and the
 * only thing the engine does differently per type is decide which extra fields
 * the big screen and the host get. Adding a type means adding a case in
 * `screenQuestionExtras` / `hostQuestionExtras`, nothing else.
 */

import {
  scoreAnswer, scoreMultiAnswer, responseSeconds, rankPlayers,
  POINTS_CORRECT, POINTS_PER_WHOLE_SECOND, POINTS_FIRST_CORRECT,
} from './scoring.js';

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
  join({ playerId, name }) {
    const at = this.now();
    // Joining again clears a previous removal — the host removes a team to tidy
    // up a duplicate or a name they regret, not to bar a phone for the night.
    if (playerId) forgetRemoved(this.state, playerId);
    const existing = playerId && this.state.players[playerId];

    if (existing) {
      existing.connected = true;
      existing.lastSeenAt = at;
      const cleanName = cleanTeamName(name);
      // Only take a new name if they actually typed one (a reconnect posts
      // the stored name back, and we do not want a blank to wipe it).
      if (cleanName && cleanName !== existing.name) existing.name = cleanName;
      this.changed();
      return existing;
    }

    const player = {
      id: playerId && isSafeId(playerId) ? playerId : newId(),
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
    return p;
  }

  removePlayer(playerId) {
    if (!this.state.players[playerId]) return false;
    delete this.state.players[playerId];
    for (const key of Object.keys(this.state.answers)) {
      delete this.state.answers[key][playerId];
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
    return Object.values(this.state.players);
  }

  leaderboard() {
    return rankPlayers(this.playerList());
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
    const answers = this.answersFor();
    this.state.history = this.state.history.filter(
      (h) => !(h.roundIndex === this.state.roundIndex && h.questionIndex === this.state.questionIndex),
    );
    this.state.history.push({
      roundIndex: this.state.roundIndex,
      questionIndex: this.state.questionIndex,
      prompt: q ? q.prompt : '',
      correctIndex: q ? q.correctIndex : -1,
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
    this.changed();
    return true;
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
    if (s.phase !== PHASES.QUESTION || !s.question) return { ok: false, reason: 'not_open' };

    const at = this.now();
    if (at >= s.question.endsAt || s.question.closed) return { ok: false, reason: 'too_late' };

    const q = this.question();
    const round = this.round();
    if (!q || !round) return { ok: false, reason: 'no_question' };

    const isMulti = round.type === 'multi';
    const valid = (i) => Number.isInteger(i) && i >= 0 && i < q.options.length;

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
   * The right answers for a question, however many there are.
   *
   * One shape for both kinds so nothing downstream has to branch: a normal
   * question is a set of one.
   */
  correctSet(q, round) {
    if (round && round.type === 'multi') return new Set(q.correctIndexes || []);
    return new Set([q.correctIndex]);
  }

  /** How many they must lock in. The room is told this; which ones, never. */
  pickCount(q, round) {
    return round && round.type === 'multi' ? (q.correctIndexes || []).length : 1;
  }

  /** The "Fastest finger" line: first correct answer of the current question. */
  fastestFinger(ri = this.state.roundIndex, qi = this.state.questionIndex) {
    const answers = this.answersFor(ri, qi);
    let best = null;
    for (const [playerId, a] of Object.entries(answers)) {
      if (!a.correct) continue;
      if (!best || a.answeredAt < best.answeredAt) best = { ...a, playerId };
    }
    if (!best) return null;
    const p = this.state.players[best.playerId];
    return {
      playerId: best.playerId,
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
      playerCount: this.playerList().length,
    };
  }

  /**
   * Extra fields the big screen needs for this round type.
   * ROUND 3 RULE: the intro round deliberately returns nothing here. The track
   * title and artist live in `question.cue`, which only hostView() ever reads.
   */
  screenQuestionExtras(q, round) {
    switch (round.type) {
      case 'image':
        return {
          image: q.image ? `/quiz-images/${q.image}` : null,
          // The caption that makes clear these are illustrations, not photos.
          imageCaption: q.imageCaption || round.imageCaption || 'AI-generated illustration — not a real photograph',
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
          options: q.options,
          ...this.screenQuestionExtras(q, round),
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
        correctIndex: q ? q.correctIndex : -1,
        correctIndexes: right,
        correctText: q ? right.map((i) => q.options[i]).join(', ') : '',
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
        players: this.playerList()
          .sort((a, b) => b.joinedAt - a.joinedAt)
          .map((p) => ({ id: p.id, name: p.name })),
      };
    }

    return view;
  }

  /** How many picked each option — a nice reveal graphic, gives nothing away early. */
  optionTally() {
    const q = this.question();
    if (!q) return [];
    const tally = q.options.map(() => 0);
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
      you: player
        ? {
            id: player.id,
            name: player.name,
            score: player.score,
            correctCount: player.correctCount,
            position: this.leaderboard().find((p) => p.id === player.id)?.position ?? null,
            playerCount: this.playerList().length,
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
        view.options = q.options; // options only, never the prompt
        // How many to lock in. The count only; which ones is the answer key.
        view.pickCount = this.pickCount(q, round);
        view.multi = Boolean(round && round.type === 'multi');
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
            correctIndex: q.correctIndex,
            correctIndexes: right,
            correctText: right.map((i) => q.options[i]).join(', '),
            fastest: this.fastestFinger(),
          };
        }
      }
    }

    if (s.phase === PHASES.ROUND_BOARD || s.phase === PHASES.FINAL) {
      view.leaderboard = this.leaderboard().slice(0, 10).map(publicPlayer);
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
  hostQuestionExtras(q, round) {
    const right = [...this.correctSet(q, round)];
    const extras = {
      correctIndex: q.correctIndex,
      correctIndexes: right,
      correctText: right.map((i) => q.options[i]).join(', '),
      pickCount: this.pickCount(q, round),
      note: q.note || '',
      answerNote: q.answerNote || '',
    };
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

    if (q && round) {
      view.question = {
        id: q.id,
        prompt: q.prompt,
        options: q.options,
        ...this.hostQuestionExtras(q, round),
      };
      view.answeredCount = Object.keys(this.answersFor()).length;
      view.tally = this.optionTally();
      view.fastest = this.fastestFinger();
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
      options: q.options,
      ...this.hostQuestionExtras(q, round),
    };
  }

  /** Everything needed for an end-of-night results export. */
  results() {
    return {
      quizId: this.quiz.id,
      quizTitle: this.quiz.title,
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

function publicPlayer(p) {
  return { id: p.id, name: p.name, score: p.score, position: p.position, correctCount: p.correctCount };
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
