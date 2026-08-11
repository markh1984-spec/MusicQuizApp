/**
 * Everything configurable, in one place, with sensible defaults so the app
 * runs with no configuration at all: `npm start` and it works.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { APP_NAME } from './branding.js';

const here = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(here, '..');

export const config = {
  port: Number(process.env.PORT) || 3000,

  // Where the join QR code points. Leave it unset and the app works it out
  // from the address the big screen was opened on, which is right on Render
  // and right on a laptop. Set it only if you put your own domain in front.
  publicUrl: process.env.PUBLIC_URL || '',

  quizDir: process.env.QUIZ_DIR || path.join(ROOT, 'quizzes'),
  bingoDir: process.env.BINGO_DIR || path.join(ROOT, 'bingo'),
  // Advertising slides, per venue. In the repo like every other pack, because
  // a venue's offer is worth having again next week.
  advertDir: process.env.ADVERT_DIR || path.join(ROOT, 'adverts'),
  dataDir: process.env.DATA_DIR || path.join(ROOT, 'data'),
  imageDir: process.env.IMAGE_DIR || path.join(ROOT, 'images'),
  publicDir: path.join(ROOT, 'public'),

  // Which quiz is loaded when the server starts with no saved state.
  defaultQuizId: process.env.QUIZ_ID || '',

  /*
   * What the app is called. A night is branded from the QUIZMASTER whose room
   * it is — "Mark's Quiztopia", "Rob's Quiztopia" — so this is the half of the
   * name that does not change. See `src/branding.js`.
   */
  appName: APP_NAME,

  /*
   * An outright override, and it beats the per-quizmaster name everywhere.
   *
   * Empty by DEFAULT now, which is the change: it used to default to a name,
   * which meant every room on the server said the same thing whoever was
   * running it. Somebody who sets `BRAND_NAME` has said what they want it
   * called, so that still wins — but nobody has to set it to get their own
   * name on their own projector.
   */
  brandName: process.env.BRAND_NAME || '',
};

export const paths = {
  state: path.join(config.dataDir, 'state.json'),
  hostKey: path.join(config.dataDir, 'host-key.txt'),
  // Under data/, so gitignored. Photos of the public do not belong in a
  // repository, and unlike a pack there is no reason to want them in six
  // months — they are for the night and the download button.
  photos: path.join(config.dataDir, 'photos'),
  // Your business details, your customers, and every invoice you have issued.
  // Under data/ like everything else, so it is gitignored — and unlike the song
  // history it must NEVER be committed to the main repo, which is public. It
  // is backed up to the private one instead. See backUpInvoices() in server.js.
  invoices: path.join(config.dataDir, 'invoicing.json'),
  // Email addresses, password hashes and payment references. Backed up to the
  // PRIVATE repository like the invoices, never the public one.
  accounts: path.join(config.dataDir, 'accounts.json'),
  reports: path.join(config.dataDir, 'reports.json'),
  // Ideas, irritations and bugs from the people using it. Global rather than
  // per room: a suggestion is about the APP, which everybody shares, and the
  // owner reads them as one list.
  suggestions: path.join(config.dataDir, 'suggestions.json'),
  // What the AI has cost, written down as it happens — the number the whole
  // tier structure is built on, and until now it existed nowhere.
  spend: path.join(config.dataDir, 'spend.json'),
};

/**
 * The secret that guards the control view and the editor.
 *
 * Set HOST_KEY yourself and it is used as-is. Otherwise one is generated once
 * and kept on disk, so a server restart mid-quiz does not invalidate the tab
 * that is already open on your phone.
 */
/**
 * Is the key a temporary one this process invented?
 *
 * It matters more than it looks. Without `HOST_KEY` set, the key is generated
 * into `data/` — and on a host with no permanent disk that folder is empty
 * again after every deploy. So every deploy quietly invents a NEW key and every
 * bookmark stops working, with nothing on screen saying why. That is worth
 * saying out loud at boot rather than leaving somebody to discover it on a
 * phone when they wanted to start a quiz.
 */
export function hostKeyIsTemporary() {
  return !process.env.HOST_KEY;
}

export function hostKey() {
  if (process.env.HOST_KEY) return process.env.HOST_KEY;
  try {
    const existing = fs.readFileSync(paths.hostKey, 'utf8').trim();
    if (existing) return existing;
  } catch {
    /* first run */
  }
  const generated = randomWords();
  fs.mkdirSync(config.dataDir, { recursive: true });
  fs.writeFileSync(paths.hostKey, generated + '\n', 'utf8');
  return generated;
}

/**
 * Three words rather than random characters, because you may well have to
 * type this into your phone in a dark room with a pint next to you.
 */
function randomWords() {
  const words = [
    'amber', 'banjo', 'cider', 'delta', 'echo', 'fable', 'gusto', 'harbour',
    'indigo', 'jukebox', 'kestrel', 'lantern', 'marble', 'nectar', 'orbit',
    'pebble', 'quartz', 'ripple', 'saffron', 'tundra', 'umber', 'velvet',
    'walnut', 'yonder', 'zephyr', 'anchor', 'bracket', 'copper', 'dovetail',
  ];
  const bytes = new Uint8Array(4);
  globalThis.crypto.getRandomValues(bytes);
  const pick = (i) => words[bytes[i] % words.length];
  return `${pick(0)}-${pick(1)}-${pick(2)}-${(bytes[3] % 90) + 10}`;
}
