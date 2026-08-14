/**
 * Advertising slides, for between rounds.
 *
 * Not decoration. The host sells himself to venues on lifting the rest of
 * their trade — a pizza, a cocktail, a band playing at the end of the month —
 * and takes a cut of ticket sales through the QR code. So a slide is part of
 * the pitch, and it has to look like the venue's own rather than an
 * afterthought bolted onto a quiz.
 *
 * **Slides belong to a venue, not to a night.** That is how they get sold:
 * "your Tuesday pizza deal goes up between every round, every week". A slide
 * written once is reused until the venue changes the offer.
 *
 * Same shape as every other pack in here: a JSON file on disk, so a venue's
 * slides survive months, copy between machines, and can be opened in a text
 * editor. No database.
 */

import fs from 'node:fs';
import path from 'node:path';

/** Long enough to say something, short enough to read from the back. */
const MAX_HEADING = 60;
const MAX_BODY = 160;
const MAX_LABEL = 40;

/**
 * A slide's picture, and the cap that keeps it affordable.
 *
 * The console shrinks to 900px before sending — this is the backstop, not the
 * mechanism. It matters because a slide's image travels in the SCREEN payload
 * for as long as the advert is up, and an unbounded one pasted straight into
 * the JSON would sit on the pub's wifi. 300KB of base64 is a generous 900px
 * photograph.
 *
 * Data URLs only, for the reason the venue logo has: a picture hosted on the
 * venue's own server is a 404 on the one night it matters, six feet wide, in
 * front of a room.
 *
 * Too big or the wrong shape is DROPPED rather than thrown — the slide still
 * has its words, and refusing the whole save would cost somebody the offer
 * they were typing.
 */
export const MAX_SLIDE_IMAGE_BYTES = 300 * 1024;

export function cleanSlideImage(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(raw)) return '';
  if (raw.length > MAX_SLIDE_IMAGE_BYTES) return '';
  return raw;
}

export function listAdvertPacks(dir) {
  let files = [];
  try {
    files = fs.readdirSync(dir).filter((f) => f.endsWith('.json'));
  } catch {
    return [];
  }
  return files
    .map((file) => {
      try {
        const pack = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
        const norm = normaliseAdvertPack(pack, path.basename(file, '.json'));
        return {
          id: norm.id,
          file,
          title: norm.title,
          venue: norm.venue,
          slideCount: norm.slides.length,
          slides: norm.slides.map((s) => ({ id: s.id, heading: s.heading, hasImage: Boolean(s.image), hasLink: Boolean(s.link) })),
        };
      } catch (err) {
        return { id: path.basename(file, '.json'), file, title: file, broken: err.message, slides: [], slideCount: 0 };
      }
    })
    .sort((a, b) => String(a.title).localeCompare(String(b.title)));
}

export function loadAdvertPack(dir, id) {
  const file = path.join(dir, safeAdvertFile(id));
  return normaliseAdvertPack(JSON.parse(fs.readFileSync(file, 'utf8')), id);
}

export function saveAdvertPack(dir, id, pack) {
  const problems = validateAdvertPack(pack);
  if (problems.length) {
    const err = new Error('Advert set is not valid');
    err.problems = problems;
    throw err;
  }
  const file = path.join(dir, safeAdvertFile(id));
  const tmp = file + '.tmp';
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(tmp, JSON.stringify(normaliseAdvertPack(pack, id), null, 2) + '\n', 'utf8');
  fs.renameSync(tmp, file);
  return true;
}

export function deleteAdvertPack(dir, id) {
  fs.unlinkSync(path.join(dir, safeAdvertFile(id)));
  return true;
}

/** An id is a filename, never a path. Same rule as every other pack. */
export function safeAdvertFile(id) {
  const clean = String(id || '').replace(/[^a-zA-Z0-9._-]/g, '');
  if (!clean || clean.startsWith('.')) throw new Error('Bad advert id: ' + id);
  return clean.endsWith('.json') ? clean : clean + '.json';
}

export function normaliseAdvertPack(pack, fallbackId = 'adverts') {
  return {
    id: pack.id || fallbackId,
    kind: 'advert',
    title: pack.title || 'Adverts',
    // Who it belongs to. The whole point of the feature.
    venue: pack.venue || '',
    notes: pack.notes || '',
    createdAt: pack.createdAt || null,
    slides: (pack.slides || []).map((s, i) => ({
      id: s.id || `s${i + 1}`,
      heading: String(s.heading || '').slice(0, MAX_HEADING),
      body: String(s.body || '').slice(0, MAX_BODY),
      // A note for the host to say over the mic — never on the screen, same
      // rule as a quiz question's host note.
      say: String(s.say || '').slice(0, MAX_BODY),
      ...(cleanSlideImage(s.image) ? { image: cleanSlideImage(s.image) } : {}),
      ...(s.link ? { link: String(s.link) } : {}),
      ...(s.linkLabel ? { linkLabel: String(s.linkLabel).slice(0, MAX_LABEL) } : {}),
    })),
  };
}

/**
 * What would actually embarrass him on a projector.
 *
 * Deliberately thin. A slide with nothing but a heading is fine — "PIZZA 2
 * FOR 1 TONIGHT" needs no more than that — so the only hard rules are that a
 * slide says something and that a link is a real link.
 */
export function validateAdvertPack(pack) {
  const problems = [];
  if (!pack || typeof pack !== 'object') return ['That is not an advert set.'];
  if (!pack.title || !String(pack.title).trim()) problems.push('The set needs a title.');

  const slides = pack.slides || [];
  if (!Array.isArray(slides) || slides.length === 0) problems.push('There are no slides in it.');

  slides.forEach((s, i) => {
    const at = `Slide ${i + 1}`;
    if (!String(s.heading || '').trim() && !String(s.body || '').trim() && !s.image) {
      problems.push(`${at}: nothing on it — give it a heading, some words or a picture.`);
    }
    if (s.link && !isSafeLink(s.link)) {
      problems.push(`${at}: that link does not look like a web address. It should start with https://`);
    }
    if (s.link && !String(s.heading || '').trim() && !String(s.body || '').trim()) {
      // A bare QR with no words is a code nobody scans, because nobody knows
      // what it is for.
      problems.push(`${at}: has a QR code but says nothing — the room needs to know what they are scanning.`);
    }
  });

  return problems;
}

/**
 * Only http(s), and nothing that could smuggle script into the QR or the
 * caption. The QR goes on a projector and the caption is escaped, but a
 * javascript: link is never a thing anybody wants here.
 */
export function isSafeLink(link) {
  const s = String(link || '').trim();
  if (!/^https?:\/\//i.test(s)) return false;
  try {
    const url = new URL(s);
    return Boolean(url.hostname) && !/\s/.test(s);
  } catch {
    return false;
  }
}

/** Find one slide across every set, for putting on the screen by id. */
export function findSlide(dir, packId, slideId) {
  const pack = loadAdvertPack(dir, packId);
  const slide = pack.slides.find((s) => s.id === slideId) || null;
  return slide ? { pack, slide } : null;
}
