/**
 * WHERE THE NIGHT IS, AS ONE STRING — shared by the control view and the
 * server, so the two can agree about whether a press still applies.
 *
 * TWO DEVICES, ONE QUIZ. The host runs the control view on a phone AND on the
 * laptop with the HDMI in it, and `Next` pressed on both within a second is
 * two questions gone, one of them never asked. The per-device double-tap
 * guard in `host.js` cannot see the other device. So every move carries the
 * cursor the device was looking at, and the server refuses a move whose
 * cursor has already moved on — handing back the fresh view rather than an
 * error, because the other device DID do it and the room is fine.
 *
 * A cursor is the things a MOVE changes and nothing a phone can change: the
 * phase, which question, whether it is revealed, which bingo round and stage,
 * how many tracks have been called. NOT the state version — that bumps on
 * every answer, and a Next after sixty answers is not stale.
 *
 * Imported by `server.js` like `break-parts.js`: one definition, or the two
 * sides disagree about what "moved" means and every press is refused.
 */
export function hostCursor(view) {
  if (!view) return '';
  const q = view.question || {};
  const stage = view.stage || {};
  const called = Array.isArray(view.tracks) ? view.tracks.filter((t) => t.called).length : '';
  return [
    view.phase ?? '',
    view.roundIndex ?? '',
    view.questionIndex ?? '',
    q.revealedAt ? 'r' : '',
    view.round ?? '',
    stage.index ?? '',
    called,
  ].join('/');
}

/** The presses that MOVE the night — the only ones a stale cursor refuses. */
/*
 * THESE ARE ACTION NAMES — what the control view POSTS — never engine method
 * names, and the two are not the same word.
 *
 * `skipQuestion` and `redoQuestion` are the ENGINE's methods; the actions are
 * `skip` and `redo` (`session.js`'s dispatch). `HOST_MOVES.has(action)` was
 * therefore false for both, so **Skip and Ask again took a stale press with no
 * refusal at all** — the two controls drawn at `question` and `reveal`, which
 * are the phases two control views are most often one press apart. A stale
 * Skip drops the question the room is answering; a stale Ask again wipes its
 * answers and restarts its clock. Both tooltips say *"this question"*, which
 * is exactly what the host believes they are acting on.
 *
 * `undoLastCall` was dead the same way — the action is `undoCall`, already
 * here — so it is gone rather than left looking load-bearing.
 *
 * `two-devices.mjs` only ever pressed `next` and `reveal`, so it never walked
 * this list. `test/host-moves.test.js` now asserts every name here is a real
 * action, which is the check that stops the whole class.
 */
export const MOVES = new Set([
  'start', 'next', 'back', 'reveal', 'skip', 'redo',
  'playOn', 'newRound', 'finish', 'advanceOrder', 'draw', 'undoCall',
]);
