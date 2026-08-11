/**
 * The portrait library: one picture per musician, shared by every quiz.
 *
 * Artwork used to be filed per quiz — `images/eighties/madonna.png` — so Madonna
 * in the 80s quiz and Madonna in the Pop Divas quiz were two different files,
 * drawn twice and paid for twice. Across a library of a few hundred musicians
 * that is the single largest avoidable cost in the app.
 *
 * So a picture is now named after the PERSON, not the pack:
 *
 *     portraits/madonna.png
 *     portraits/madonna--superhero.png
 *
 * ---
 *
 * **Nothing Claude writes can spawn a second picture of the same person, and
 * that is the whole point of naming it this way.**
 *
 * The obvious design was to let each question carry its own image prompt and
 * key the file off that. It does not work here: the prompts are written by
 * Claude during quiz generation, so two quizzes wanting Madonna get two
 * slightly different sentences, two different keys and two bills — and the host
 * never typed either sentence, so he has no way of knowing it happened. The
 * saving would quietly evaporate and look like nothing was wrong.
 *
 * The key is therefore the musician's name and the style, and NOTHING else. A
 * question's `imagePrompt` still shapes the drawing, but only on the first draw
 * of that person in that style; afterwards the existing picture is reused
 * whatever any later pack happens to say.
 *
 * A second version of somebody is only ever created by the host doing something
 * deliberate — picking a different style, or asking for a redraw. Both are his
 * actions, in front of him, on a panel that shows what he already has.
 */

/** File-safe, stable, and readable in a directory listing. */
export function slugName(name) {
  return String(name)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')  // café -> cafe, so one spelling is one file
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'unknown';
}

/**
 * The styles, and the sentence each one adds to the prompt.
 *
 * Deliberately few. Every style is a whole second library of the same people,
 * so five styles is five times the artwork bill for the same musicians — which
 * would hand back exactly what sharing the library just saved. Adding one is a
 * line here; do it because a night needs it, not for the sake of choice.
 *
 * **There is no photoreal option, on purpose.** The caption "AI-generated
 * illustration — not a real photograph" is doing legal work: UK fair dealing is
 * a closed list and does not cover commercial entertainment, so a convincing
 * fake photograph of a real living musician, in a pack that is SOLD, is the one
 * version worth not having.
 *
 * ---
 *
 * **EVERY STYLE HERE IS IN THE CARTOON REGISTER, AND THAT IS THE PROVIDER
 * TALKING RATHER THAN TASTE.** Tested against Google in their own playground:
 * "do me a Michael Jackson cartoon" draws it; asking for an *illustration* of
 * the same person is refused. The line is drawn at how real the picture is
 * trying to look, not at who is in it — a caricature of somebody famous is
 * fine, anything reaching for a plausible likeness is not.
 *
 * There used to be a `portrait` style here — "clearly a painting rather than a
 * photograph", true to life, and the DEFAULT. Every picture in the app would
 * have been drawn with it, and every one of them would have been refused. It is
 * gone rather than reworded, because the host's own call was: if we cannot do
 * the realistic end, do not ship a setting that pretends we can.
 *
 * **Adding one is a line here and a minute in the playground first.** Try the
 * prompt at https://aistudio.google.com before it goes in — a style that
 * refuses is a control that does nothing, which is the fault this codebase
 * keeps recording. Candidates worth trying, in rough order of how likely they
 * are to be allowed: pop-art halftone, black-and-white comic inking, cut-paper
 * collage, 8-bit pixel art.
 */
export const STYLES = {
  cartoon: {
    label: 'Cartoon',
    hint: 'Broad and comic. The one that is known to work.',
    prompt: 'A bold cartoon caricature with clean heavy outlines and flat bright colour, '
      + 'head and shoulders, facing the viewer, plain dark background, '
      + 'exaggerated but instantly recognisable features',
  },
  superhero: {
    label: 'As a superhero',
    hint: 'Comic-book costume and cape. Good for a fun night.',
    prompt: 'A bold cartoon caricature in an invented comic-book superhero costume with a cape, '
      + 'heroic pose, head and chest, clean heavy outlines and flat bright colour, '
      + 'dramatic comic-book lighting, plain dark background, '
      + 'exaggerated but instantly recognisable features',
  },
};

export const DEFAULT_STYLE = 'cartoon';

export function findStyle(id) {
  return STYLES[id] ? id : DEFAULT_STYLE;
}

/**
 * Quality, which is a straight trade of pennies against detail.
 *
 * The picture spends most of its twenty seconds deliberately degraded — zoomed
 * in, pixelated, blurred or behind tiles — and is then looked at from the back
 * of a pub. `low` is defensible for that; `high` exists for a pack being sold
 * on, where somebody else's projector and somebody else's opinion are involved.
 */
export const QUALITIES = ['low', 'medium', 'high'];
export const DEFAULT_QUALITY = 'medium';

export function findQuality(q) {
  return QUALITIES.includes(q) ? q : DEFAULT_QUALITY;
}

/**
 * Where this person's picture lives.
 *
 * The default style has no suffix, so the commonest case reads as a plain name
 * and — the reason that matters — a library built before styles existed keeps
 * exactly the filenames it already had.
 *
 * **Which is why moving the default from `portrait` to `cartoon` had to happen
 * BEFORE any real artwork existed, and did.** `images/portraits/` was empty —
 * there has never been an image key on this app — so the unsuffixed name simply
 * changed meaning with nothing filed under it. Do that after a library exists
 * and every painted picture silently becomes "the cartoon of that person",
 * while every `--cartoon` file already on disk is orphaned. If the default ever
 * moves again, it is a rename job and not a one-word edit.
 */
export function portraitPath(musician, style = DEFAULT_STYLE) {
  const id = findStyle(style);
  const suffix = id === DEFAULT_STYLE ? '' : `--${id}`;
  return `portraits/${slugName(musician)}${suffix}.png`;
}

/** Read a portrait path back: who it is, and in which style. */
export function readPortraitPath(rel) {
  const m = /^portraits\/(.+?)(?:--([a-z]+))?\.(?:png|svg)$/.exec(String(rel || ''));
  if (!m) return null;
  return { slug: m[1], style: findStyle(m[2] || DEFAULT_STYLE) };
}

/** Is this picture already shared, or still filed under one quiz? */
export function isShared(rel) {
  return String(rel || '').startsWith('portraits/');
}

/**
 * The musician a picture question is of.
 *
 * The correct option, which is the answer and therefore the person. A picture
 * question whose answer is not a name is not a thing this round type makes.
 */
export function musicianOf(q) {
  const options = q?.options || [];
  return String(options[q?.correctIndex] || '').trim();
}
