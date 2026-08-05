/**
 * Everything configurable, in one place, with sensible defaults so the app
 * runs with no configuration at all: `npm start` and it works.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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
  dataDir: process.env.DATA_DIR || path.join(ROOT, 'data'),
  imageDir: process.env.IMAGE_DIR || path.join(ROOT, 'images'),
  publicDir: path.join(ROOT, 'public'),

  // Which quiz is loaded when the server starts with no saved state.
  defaultQuizId: process.env.QUIZ_ID || '',
};

export const paths = {
  state: path.join(config.dataDir, 'state.json'),
  hostKey: path.join(config.dataDir, 'host-key.txt'),
};

/**
 * The secret that guards the control view and the editor.
 *
 * Set HOST_KEY yourself and it is used as-is. Otherwise one is generated once
 * and kept on disk, so a server restart mid-quiz does not invalidate the tab
 * that is already open on your phone.
 */
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
