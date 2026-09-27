/**
 * ONE LAUNCH, ONE KEY — computed from the launch body on BOTH sides.
 *
 * The live line said "this one" when the running pack's TITLE matched the
 * bar's, so every change made after a tap — a round switched off, Winners 1,
 * a prize typed — reached nothing and was told nothing: "On the big screen
 * now — this one" over a night the room was not playing (O1 of the 23
 * September 2026 sweep). The server keys what it launched off the request
 * body; the bar keys what Launch would send now, through the same function,
 * so the two agree by construction rather than by a list of fields that
 * drifts the day one is added.
 *
 * Imported by the SERVER like `break-parts.js`: one file, no copy. Named `launchKey`, not `nightKey` — `diary.js` already owns that word for the 6am day a night files under. Keys are
 * sorted, `null`/`undefined` are dropped (a quiet launch omits what a loud
 * one sends as null) and `replace` is ignored — it is about the press, not
 * the night.
 */
export function launchKey(body) {
  const norm = (v) => {
    if (Array.isArray(v)) return v.map(norm);
    if (v && typeof v === 'object') {
      const out = {};
      for (const k of Object.keys(v).sort()) {
        if (k === 'replace' || v[k] === null || v[k] === undefined) continue;
        out[k] = norm(v[k]);
      }
      return out;
    }
    return v;
  };
  const text = JSON.stringify(norm(body || {}));
  let h = 5381;
  for (let i = 0; i < text.length; i += 1) h = ((h * 33) ^ text.charCodeAt(i)) >>> 0;
  return h.toString(36);
}
