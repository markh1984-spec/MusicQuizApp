/**
 * A BINGO press, decided the way the old engine decided it on its own.
 *
 * Since 25 September 2026 a press only puts a claim in front of the host
 * (`claim()` in `src/bingo.js`) and `approveClaim()` / `rejectClaim()` settle
 * it. Most tests are about what happens AFTER a claim is decided — prizes,
 * vouchers, stand-downs — so this stands in for a host who approves every card
 * the app says checks out and turns down every one it does not, which is
 * exactly what a press did before the host was asked. The host's own choices
 * are tested directly in `test/host-approves.test.js`.
 */
export function claimNow(game, playerId) {
  const r = game.claim(playerId);
  if (!r || !r.pending || r.reason === 'waiting') return r;
  const p = game.state.players[playerId];
  return game.evaluate(p).won ? game.approveClaim(playerId) : game.rejectClaim(playerId);
}
