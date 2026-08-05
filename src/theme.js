/**
 * Turning what you typed into a name.
 *
 * The theme box gets used conversationally — "can I have a One Direction quiz"
 * — and naively wrapping that produced "The Can I Have A One Direction Quiz
 * Music Quiz". So the request wrapper is stripped before anything is named
 * after it.
 *
 * Deliberately forgiving rather than clever: if none of the patterns match, you
 * get back exactly what you typed.
 */

/** Strip the "can I have a…" wrapper and any trailing "quiz". */
export function cleanTheme(raw) {
  const original = String(raw || '').trim();
  let s = original;

  // "can you please make me a…", "could I have a…", "would you write…"
  s = s.replace(/^\s*(please\s+)?(can|could|would|will)\s+(you\s+|i\s+|we\s+)?(please\s+)?(have|get|make|do|write|create|build|generate|put together)\s+/i, '');
  // "make me a…", "write a…", "generate…", "give me…"
  s = s.replace(/^\s*(please\s+)?(make|write|create|build|generate|do|give|put together)\s+(me\s+)?/i, '');
  // "I want a…", "I'd like a…", "I need…"
  s = s.replace(/^\s*i\s*('d like|'ll have|\s+want|\s+would like|\s+need)\s+/i, '');
  // a leading article, so "the 1990s" and "1990s" name the same way
  s = s.replace(/^\s*(a|an|the)\s+/i, '');
  // "quiz about X", "round on X", "questions about X"
  s = s.replace(/^\s*(music\s+)?(quiz|bingo|round|questions)\s+(about|on|for|covering)\s+/i, '');
  // and an article can hide behind that too: "quiz about the 1990s"
  s = s.replace(/^\s*(a|an|the)\s+/i, '');
  // "…quiz", "…music quiz", "…bingo round", "…please"
  s = s.replace(/\s+please\s*$/i, '');
  s = s.replace(/\s*(music\s+)?(quiz|bingo|round)\s*$/i, '');
  // leftover punctuation from a question
  s = s.replace(/[?.!,;:\s]+$/, '').trim();

  // If stripping ate everything, the original was the theme after all.
  return s || original;
}

/** Title Case, leaving small joining words alone so it reads like a title. */
export function titleCase(s) {
  const small = new Set(['a', 'an', 'and', 'as', 'at', 'but', 'by', 'for', 'in', 'of', 'on', 'or', 'the', 'to', 'v', 'vs', 'with']);
  const words = String(s).split(/\s+/);
  return words
    .map((word, i) => {
      const lower = word.toLowerCase();
      // Leave anything already shouting alone: "UK", "ABBA", "NWA".
      if (word.length > 1 && word === word.toUpperCase() && /[A-Z]/.test(word)) return word;
      if (i > 0 && i < words.length - 1 && small.has(lower)) return lower;
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ');
}

/**
 * The name that goes on the big screen. "Music" is left out because the brand
 * above it already says it — "The One Direction Quiz" beats "The One Direction
 * Music Quiz".
 */
export function quizTitleFor(theme) {
  const clean = titleCase(cleanTheme(theme));
  return /^the\s/i.test(clean) ? `${clean} Quiz` : `The ${clean} Quiz`;
}

export function bingoTitleFor(theme) {
  const clean = titleCase(cleanTheme(theme));
  return `${clean} Bingo`;
}

/** The filename, from the cleaned theme rather than the raw request. */
export function themeSlug(theme) {
  return cleanTheme(theme)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40) || 'quiz';
}
