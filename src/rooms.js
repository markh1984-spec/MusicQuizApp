/**
 * A room per quizmaster: one running game each, and nothing of theirs on
 * anybody else's projector.
 *
 * Until now the app ran exactly one game. One state file, one photo wall, one
 * join code, one `session` module-level singleton. That was right while there
 * was one host, and it is the single thing that made handing a second
 * quizmaster a login unsafe: Rob pressing Launch would have thrown Mark's room
 * out mid-question, and a photo Rob's tester sent would have landed six feet
 * wide on Mark's projector.
 *
 * So everything that belongs to ONE NIGHT now lives in a room:
 *
 *   - the session (which game is running, and its engine)
 *   - the store   (its own state file, so a crash restores the right night)
 *   - the photos  (its own folder and its own kill switch)
 *   - a join code (so a phone reaches the right game)
 *
 * What is deliberately NOT in here, because it is shared on purpose:
 *
 *   - **the pack library.** The owner writes the quizzes and sells them; a
 *     quizmaster plays them and never generates. One library read by everybody
 *     IS the product, not a shortcut. Whether you may EDIT one is a plans.js
 *     question, not a rooms question.
 *   - **the portrait library**, for the same reason it exists at all: one
 *     picture per musician, paid for once.
 *
 * ---
 *
 * **The house room keeps the old paths, and that is not tidiness.** Mark has
 * gigs in the diary and may well deploy between rounds. If the default room
 * moved to `data/rooms/house/state.json`, the first restart after this shipped
 * would come back with no game, no scores and an empty photo wall in front of a
 * room of sixty people. So room `house` reads and writes exactly where the
 * single-game version did, and only additional rooms get a folder of their own.
 */

import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';

import { Session } from './session.js';
import { Store } from './store.js';
import { Photos } from './photos.js';
import { Invoices } from './invoices.js';
import { HOUSE_ROOM } from './library.js';

/**
 * The room the app has always had. Anyone signed in as the owner gets it.
 *
 * Defined in `library.js` and re-exported here rather than written out twice.
 * The play counts are filed under it, so two copies of this string would mean
 * a room whose launches were recorded somewhere nothing ever read — and the
 * only symptom would be a count that stayed on zero.
 */
export const HOUSE = HOUSE_ROOM;

/**
 * Codes a phone can be told down a microphone and typed without a question.
 *
 * No vowels, so it cannot spell anything; no 0/O/1/I/L, which are the pairs
 * people mistype off a projector at the back of a pub.
 */
const CODE_ALPHABET = '23456789BCDFGHJKMNPQRSTVWXYZ';

export function newCode(length = 4) {
  const bytes = crypto.randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i++) out += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  return out;
}

/**
 * Same shape whatever a phone typed: trimmed, upper case, letters and digits.
 *
 * Deliberately NO guessing at confusables. Mapping a typed O onto some other
 * character would silently send somebody to the wrong quizmaster's game, which
 * is far worse than telling them the code was not recognised. The alphabet
 * above already leaves out the characters people get wrong, so a stray O means
 * they misread it and should look again.
 */
export function tidyCode(raw) {
  return String(raw || '').toUpperCase().replace(/[^0-9A-Z]/g, '').slice(0, 8);
}

export class Room {
  constructor({ id, code, label, config, paths, onPush, now }) {
    this.id = id;
    this.code = code;
    this.label = label || '';
    this.store = new Store(paths.state);
    this.photos = new Photos(paths.photos);
    /*
     * A quizmaster's own business, their own record of their own nights, and
     * their own venue slides.
     *
     * `paths` is what decides where these live, and the house room deliberately
     * keeps the original locations — `data/invoicing.json`, `data/archive/` and
     * the top-level `adverts/` folder — so nothing Mark already has moves. Only
     * an additional room gets a folder of its own.
     */
    this.paths = paths;
    this.invoices = new Invoices(paths.invoices);
    this.session = new Session({
      config,
      store: this.store,
      onPush: () => onPush(this),
      now,
      // So a launch is counted against THIS quizmaster's nights rather than
      // against the pack, which everybody shares.
      roomId: id,
      // And so the night is archived, and the venue slides read, from this
      // room's own folders rather than one set shared by the whole server.
      paths,
    }).boot();
  }

  /** Is a game actually being played right now, as opposed to sitting idle? */
  get live() {
    const phase = this.session.engine?.state?.phase;
    return Boolean(phase) && phase !== 'lobby' && phase !== 'final' && phase !== 'finished';
  }

  summary() {
    const engine = this.session.engine;
    return {
      id: this.id,
      code: this.code,
      label: this.label,
      game: this.session.kind,
      pack: this.session.pack?.title || '',
      // The id as well as the title, because the owner's overview has to be
      // able to ask "is this one of THEIRS" — and it can only ask that with an
      // id. See own-packs.js.
      packId: this.session.pack?.id || '',
      phase: engine?.state?.phase || '',
      players: Object.keys(engine?.state?.players || {}).length,
      live: this.live,
      where: typeof engine?.where === 'function' ? engine.where() : '',
    };
  }
}

export class Rooms {
  /**
   * @param {object} opts
   * @param {object} opts.config
   * @param {object} opts.paths            the app-wide paths, for the house room
   * @param {function(Room): void} opts.onPush
   * @param {function(): number} [opts.now]
   */
  constructor({ config, paths, onPush, now = () => Date.now() }) {
    this.config = config;
    this.paths = paths;
    this.onPush = onPush;
    this.now = now;
    this.rooms = new Map();
    this.codesFile = path.join(config.dataDir, 'room-codes.json');
    this.codes = this.loadCodes();
  }

  /*
   * The codes are written down rather than derived from the room id.
   *
   * A derived code would change the day anybody changed how it was derived, and
   * a join code changing under a room that is already scanning it is the one
   * failure this whole feature cannot have. Written down, it is the same code
   * tonight, after a restart, and next Wednesday.
   */
  loadCodes() {
    try {
      return JSON.parse(fs.readFileSync(this.codesFile, 'utf8')) || {};
    } catch {
      return {};
    }
  }

  saveCodes() {
    try {
      fs.mkdirSync(this.config.dataDir, { recursive: true });
      const tmp = this.codesFile + '.tmp';
      fs.writeFileSync(tmp, JSON.stringify(this.codes, null, 2), 'utf8');
      fs.renameSync(tmp, this.codesFile);
    } catch (err) {
      console.error('[rooms] could not save the join codes:', err.message);
    }
  }

  codeFor(roomId) {
    if (roomId === HOUSE) return '';   // the default room needs no code — see below
    if (this.codes[roomId]) return this.codes[roomId];
    const taken = new Set(Object.values(this.codes));
    let code = newCode();
    while (taken.has(code)) code = newCode();
    this.codes[roomId] = code;
    this.saveCodes();
    return code;
  }

  /**
   * Where a room's files live.
   *
   * `house` keeps the original locations so an upgrade mid-season does not lose
   * a game that is being played while it deploys.
   */
  pathsFor(roomId) {
    if (roomId === HOUSE) {
      // Each falls back to where the single-game version put it, so a caller
      // that only knows about the state file and the photos — a test, or any
      // older code — still gets a working room rather than a crash.
      return {
        state: this.paths.state || path.join(this.config.dataDir, 'state.json'),
        photos: this.paths.photos || path.join(this.config.dataDir, 'photos'),
        invoices: this.paths.invoices || path.join(this.config.dataDir, 'invoicing.json'),
        archive: this.paths.archive || path.join(this.config.dataDir, 'archive'),
        adverts: this.paths.adverts || this.config.advertDir,
        /*
         * The house room's OWN packs, as opposed to the catalogue.
         *
         * The owner has no such thing — they write the catalogue, which is the
         * whole arrangement — so in practice nothing is ever filed here. It
         * exists so every room answers the same question the same way, and so
         * the host key (which resolves to this room and grants everything) has
         * somewhere to put one rather than a route that half works.
         */
        ownQuizzes: this.paths.ownQuizzes || path.join(this.config.dataDir, 'own', 'quizzes'),
        ownBingo: this.paths.ownBingo || path.join(this.config.dataDir, 'own', 'bingo'),
      };
    }
    const dir = path.join(this.config.dataDir, 'rooms', roomId);
    return {
      state: path.join(dir, 'state.json'),
      photos: path.join(dir, 'photos'),
      /*
       * Everything below here used to be one shared copy for the whole server.
       *
       * That was safe only while one person had a login. The invoice book holds
       * a quizmaster's own customers and their bank details; the archive is a
       * record of THEIR nights; and a venue advert set belongs to whoever sells
       * that venue. One shared advert folder is the loudest of the three: a
       * second quizmaster tidying up what looks like their own venue list would
       * have deleted The Crown's slides off Mark's projector.
       */
      invoices: path.join(dir, 'invoicing.json'),
      archive: path.join(dir, 'archive'),
      adverts: path.join(dir, 'adverts'),
      /*
       * The packs this quizmaster wrote themselves, which are THEIRS.
       *
       * Under the room, like everything else here, and that placement is the
       * enforcement rather than a filing preference: no route takes a room
       * parameter, so there is no id anybody can send that reaches another
       * room's folder. The owner asking for one of these resolves against the
       * house room, finds nothing, and gets the catalogue. See own-packs.js.
       */
      ownQuizzes: path.join(dir, 'quizzes'),
      ownBingo: path.join(dir, 'bingo'),
    };
  }

  /** The room for this id, booted from its own saved state the first time. */
  get(roomId = HOUSE, label = '') {
    const id = String(roomId || HOUSE);
    if (this.rooms.has(id)) {
      const room = this.rooms.get(id);
      if (label && !room.label) room.label = label;
      return room;
    }
    const room = new Room({
      id,
      code: this.codeFor(id),
      label,
      config: this.config,
      paths: this.pathsFor(id),
      onPush: this.onPush,
      now: this.now,
    });
    this.rooms.set(id, room);
    return room;
  }

  /** The room a phone reached for, by the code on the projector. */
  byCode(raw) {
    const code = tidyCode(raw);
    if (!code) return null;
    for (const room of this.rooms.values()) if (room.code === code) return room;
    // Not booted yet — a phone can easily arrive before its quizmaster's
    // console has been opened since the last restart.
    for (const [id, c] of Object.entries(this.codes)) if (c === code) return this.get(id);
    return null;
  }

  all() {
    return [...this.rooms.values()];
  }

  /** Every room that has a game worth knowing about, for the owner's overview. */
  summaries() {
    return this.all().map((r) => r.summary());
  }
}
