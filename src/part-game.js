/**
 * A DRINK GAME AS A PART OF THE NIGHT — what Pub Prix and Up or Down share.
 *
 * ---
 *
 * Both are a game of the night the way card bingo is: a tile on Tonight, a
 * part of a running order, one drink a game. Everything that is about the
 * ROOM rather than the game — who is in it and how a phone proves it, the
 * drinks in people's hands, the funniest photograph — is the same for both,
 * and lives here once. **Two copies of one rule is one rule that gets fixed
 * once**, the argument `src/arcade.js` was made on.
 *
 * **IT CARRIES WHAT IT DOES NOT USE.** A part boundary builds the next part's
 * options off the ENDING part's state (`nightWideOpts()`), so the venue, the
 * look, the break plan and the team map are written onto this state by
 * `launch()` and must survive untouched. The state is a plain object nothing
 * here destructures — the whitelist trap, avoided by having no whitelist.
 *
 * A subclass names its `kind`, adds its own fields in `fresh()`, and answers
 * the views, `results()`, `where()`, `resetAll()`, `removeIdlePlayers()` and
 * `settleGame()` (what a move does to a game in progress).
 */
import {
  cleanTeamName, isSafeId, newId, newToken, newVoucherCode, ownsPlayer,
  MAX_PLAYERS, rememberRemoved, wasRemoved, forgetRemoved,
} from './engine.js';
import { castVote, closeVote, dropVote, openVote } from './photo-vote.js';

export class PartGame {
  constructor({ kind, pack, state = null, now = () => Date.now(), onChange = () => {}, random = Math.random, phases, fresh }) {
    this.kind = kind;
    this.pack = pack;
    this.now = now;
    this.random = random;
    this.onChange = onChange;
    this.state = state && state.kind === kind ? state : {
      kind,
      phase: phases[0],
      startedAt: this.now(),
      finishedAt: null,
      players: {},
      removed: [],
      teams: {},
      // How many games have finished in this part — which drink the next pays.
      games: 0,
      // The top of every game in this part, for the filed night.
      podiums: [],
      vouchers: {},
      rewards: [],
      photoVote: null,
      arcade: {},
      // Written EXPLICITLY, so ABSENT can mean launched — see the quiz's.
      launched: false,
      ...fresh(),
    };
    // An older state must not arrive half built — fill gaps, never destructure.
    const s = this.state;
    if (!s.players) s.players = {};
    if (!Array.isArray(s.removed)) s.removed = [];
    if (!s.teams) s.teams = {};
    if (!s.vouchers) s.vouchers = {};
    if (!Array.isArray(s.podiums)) s.podiums = [];
    if (!(s.games >= 0)) s.games = 0;
    if (!phases.includes(s.phase)) s.phase = phases[0];
  }

  changed() {
    this.onChange();
  }

  // ------------------------------------------------------------- the phones

  /** The same join contract as every other engine — see `DjSet.join()`. */
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
    if (Object.keys(this.state.players).length >= MAX_PLAYERS) return { id: '', name: '', full: true };
    const id = playerId && isSafeId(playerId) && !this.state.players[playerId] ? playerId : newId();
    const player = {
      id,
      token: newToken(),
      name: cleanTeamName(name) || `Player ${Object.keys(this.state.players).length + 1}`,
      joinedAt: at,
      lastSeenAt: at,
      connected: true,
    };
    this.state.players[id] = player;
    this.changed();
    return player;
  }

  touch(id) {
    const player = this.state.players[String(id || '')];
    if (!player) return null;
    player.lastSeenAt = this.now();
    player.connected = true;
    return player;
  }

  /** Everybody who PLAYS — an organiser holds a phone but is in nobody's game. */
  playerList() {
    return Object.values(this.state.players).filter((p) => !p.organiser);
  }

  everyone() {
    return Object.values(this.state.players);
  }

  removePlayer(id) {
    if (!this.state.players[id]) return false;
    delete this.state.players[id];
    rememberRemoved(this.state, id);
    this.changed();
    return true;
  }

  wasRemoved(id) {
    return wasRemoved(this.state, id);
  }

  renamePlayer(id, name) {
    const player = this.state.players[id];
    const clean = cleanTeamName(name);
    if (!player || !clean) return false;
    player.name = clean;
    this.changed();
    return true;
  }

  // ------------------------------------------------------------- the prizes

  rewardList() {
    const list = Array.isArray(this.state.rewards) ? this.state.rewards : [];
    const out = list.map((r) => String(r || '').trim());
    while (out.length && !out[out.length - 1]) out.pop();
    return out;
  }

  /** The Nth game's drink — and past the list, the last one again. */
  rewardFor(gameIndex) {
    const list = this.rewardList();
    if (list[gameIndex]) return list[gameIndex];
    return list.length ? list[list.length - 1] : '';
  }

  setRewards(list) {
    if (!Array.isArray(list)) return false;
    this.state.rewards = list.slice(0, 10).map((r) => String(r ?? '').trim().slice(0, 200));
    this.changed();
    return true;
  }

  redeemVoucher(code, { by = 'scan' } = {}) {
    const v = (this.state.vouchers || {})[String(code || '').toUpperCase()];
    if (!v) return { ok: false, reason: 'unknown' };
    if (v.redeemedAt) return { ok: false, reason: 'already', voucher: v };
    v.redeemedAt = this.now();
    v.history.push({ what: 'redeemed', by, at: v.redeemedAt });
    this.changed();
    return { ok: true, voucher: v };
  }

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

  /**
   * Mint one game's drink to one phone. `extra` marks what it was for, so no
   * phone tells the winner they won the QUIZ (`place: null`), and there is no
   * `round` stamp, so nothing holds it back.
   */
  mintDrink(playerId, name, reward, extra = {}) {
    if (!reward) return null;
    let code = newVoucherCode();
    while (this.state.vouchers[code]) code = newVoucherCode();
    this.state.vouchers[code] = {
      code,
      winnerId: playerId,
      name,
      place: null,
      ...extra,
      reward,
      venue: this.state.venue || '',
      issuedAt: this.now(),
      redeemedAt: null,
      reinstated: 0,
      history: [],
    };
    return code;
  }

  /** One phone's own drinks, as every phone draws them in My prizes. */
  phoneVouchers(playerId) {
    return Object.values(this.state.vouchers || {})
      .filter((v) => v.winnerId === playerId)
      .map((v) => ({
        code: v.code,
        name: v.name,
        place: v.place,
        ...(v.funny ? { funny: true } : {}),
        ...(v.race ? { race: true } : {}),
        ...(v.updown ? { updown: true } : {}),
        reward: v.reward,
        venue: v.venue,
        ...(this.state.venueLogo ? { logo: this.state.venueLogo } : {}),
        issuedAt: v.issuedAt,
        redeemedAt: v.redeemedAt,
      }));
  }

  /** The game IS the game — no lobby game beside it. */
  arcadeScore() { return { ok: false, reason: 'no_game' }; }

  // ------------------------------------------------- the funniest photograph

  /** Never over a game in full flight — the subclass says when that is. */
  busy() { return false; }

  openPhotoVote(photos) {
    if (this.busy()) return { ok: false, reason: 'busy' };
    const out = openVote(this.state, photos, this.now());
    if (out.ok) this.changed();
    return out;
  }

  /** The last prize on the table, like the other engines'. */
  photoVotePrize() {
    const prizes = this.rewardList();
    return prizes.length ? prizes[prizes.length - 1] : '';
  }

  closePhotoVote() {
    const v = this.state.photoVote;
    if (!v) return { ok: false, reason: 'no_vote' };
    if (!v.open) return { ok: true, winner: v.winner };
    const out = closeVote(this.state, {
      now: this.now(),
      random: this.random,
      reward: this.photoVotePrize(),
      venue: this.state.venue || '',
      newCode: newVoucherCode,
    });
    this.changed();
    return out;
  }

  /** A part boundary settles everything; it never throws a game away. */
  settlePhotoVote() {
    if (this.state.photoVote && this.state.photoVote.open) this.closePhotoVote();
    this.settleGame();
  }

  settleGame() {}

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
    this.state.phase = 'finished';
    this.state.finishedAt = this.now();
    this.changed();
    return true;
  }
}
