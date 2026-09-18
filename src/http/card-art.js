/**
 * CARD ART — the dropped-in playing card pictures. Moved whole from server.js.
 */
import { DECK, config, fs, path } from './context.js';

/*
 * The pictures somebody has dropped into `public/assets/cards/`, as
 * `{ id: extension }`. Read once — see the route below for why.
 */
export const CARD_ART_EXT = ['.webp', '.png', '.jpg', '.jpeg', '.svg'];
export let cardArtSeen = null;
export function cardArt() {
  if (cardArtSeen) return cardArtSeen;
  const ids = new Set(DECK.map((c) => c.id));
  /*
   * THREE FOLDERS, THREE ANSWERS. `cards/` is a picture for the MIDDLE of the
   * card the app draws; `cards/full/` is the WHOLE card with the app's rank
   * printed on top; `cards/asis/` is the card EXACTLY as drawn and the app adds
   * nothing at all. Told apart by where they sit rather than by a suffix, so
   * there is nothing to rename on the way in — see `card-face.js`.
   */
  const read = (...parts) => {
    const found = {};
    const rank = {};
    let names = [];
    try {
      names = fs.readdirSync(path.join(config.publicDir, 'assets', 'cards', ...parts));
    } catch {
      // No folder at all is the ordinary state of this feature, not a fault.
      return found;
    }
    for (const name of names) {
      const ext = path.extname(name).toLowerCase();
      const id = name.slice(0, name.length - ext.length);
      const pref = CARD_ART_EXT.indexOf(ext);
      if (pref < 0 || !ids.has(id)) continue;
      if (id in rank && rank[id] <= pref) continue;
      rank[id] = pref;
      found[id] = ext.slice(1);
    }
    return found;
  };
  cardArtSeen = { art: read(), full: read('full'), asis: read('asis') };
  return cardArtSeen;
}

