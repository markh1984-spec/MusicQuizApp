/**
 * IS THIS PHOTOGRAPH ONE THE HOST WOULD WANT TO DELETE? — the rude-photo check.
 *
 * Asked for repeatedly, most recently *"at the end of each night, any nakedness
 * needs to be flagged so that I can quickly delete all of the topless photos
 * and bullshit."* The decision behind it is in `todo/gallery.md`: **FLAG, NEVER
 * DELETE**; a machine silently destroying somebody's photo is wrong, and the
 * host has to see what was caught. So this scores a photo and nothing more —
 * the flag it produces sorts the questionable ones to the front of the night's
 * grid, where the bin the host already has is one tap away.
 *
 * WHY THIS SHAPE, and every part of it is a rule from that file:
 *
 * - **A HOSTED API, NOT A MODEL** — a browser NSFW classifier is megabytes on
 *   a stranger's phone and breaks *no dependencies*; a server-side model is the
 *   same dependency on 512MB. This is a plain HTTPS POST, the shape this
 *   codebase already uses for Claude, OpenAI and Imagen. **Google Cloud Vision
 *   SafeSearch**, which returns calibrated adult/racy likelihoods.
 * - **NO SKIN-TONE HEURISTIC IN PLAIN JS** — the tempting no-API answer, and
 *   explicitly forbidden twice: a night is a hundred close-up faces, which is
 *   exactly what such a check false-positives on, and its error rate varies
 *   with skin colour, a bias this app must not ship.
 * - **INERT WITH NO KEY.** Unscored is simply unflagged, nothing about a night
 *   changes, and enabling the API switches it on with no deploy — the same
 *   shape as Stripe, the email key and the trial sweep. A FAILED check is not a
 *   flag either: an outage costs a review that is exactly today's, never a held
 *   photo, because this feeds a review list rather than a publish gate.
 * - **IT NEVER TOUCHES THE ROOM.** The projector path is untouched — the score
 *   runs in the background after a photo is filed, the way the photo already
 *   reaches the private repo after the phone has had its answer. Only the kill
 *   switch protects the room, and it is already built.
 *
 * SafeSearch is a SEPARATE Google API from the Imagen one already in use, so
 * `GOOGLE_API_KEY` covers it only once the Vision API is enabled on that
 * project — the one setup step, checked against `moderationConfigured()`.
 * `VISION_URL` overrides the endpoint, which is the seam a test drives without
 * a key and a self-host would use for a proxy.
 */

/** SafeSearch's own ladder, weakest first. A category is one of these. */
const LIKELIHOODS = ['UNKNOWN', 'VERY_UNLIKELY', 'UNLIKELY', 'POSSIBLE', 'LIKELY', 'VERY_LIKELY'];

/*
 * WHERE THE LINE IS, and it errs towards flagging on purpose — the two
 * mistakes are not equal. A false positive costs a holiday snap sitting in a
 * review list the host was going to glance at anyway; a miss is exactly
 * today, and nothing reaches a public page unpublished. But it must not flag
 * half the wall, so `racy` — which fires on an ordinary beach or gym photo —
 * only counts at its very top, while `adult` counts a rung lower.
 *
 * NAMED CONSTANTS because the host asked to SEE it on a real night before the
 * threshold is fixed ("a threshold cannot be guessed"). Move these two after
 * the first live night rather than guessing again.
 */
const ADULT_FROM = 'LIKELY';
const RACY_FROM = 'VERY_LIKELY';

function atLeast(value, floor) {
  const a = LIKELIHOODS.indexOf(String(value || 'UNKNOWN'));
  const b = LIKELIHOODS.indexOf(floor);
  return a >= 0 && a >= b;
}

/** Is the Vision API reachable at all — i.e. is there a key for it. */
export function moderationConfigured() {
  return Boolean(process.env.GOOGLE_API_KEY);
}

/**
 * The flag a SafeSearch annotation earns, or '' for nothing. `adult` beats
 * `racy` because it is the stronger word for the same shelf, and the marker
 * only has room for one.
 */
export function flagFrom(annotation = {}) {
  if (atLeast(annotation.adult, ADULT_FROM)) return 'adult';
  if (atLeast(annotation.racy, RACY_FROM)) return 'racy';
  return '';
}

/**
 * Score one photograph. Returns `{ level, annotation }` — `level` is '' /
 * 'adult' / 'racy'. **Never throws**: a bad key, an outage or a photo Vision
 * will not read all come back as `level: ''` with the reason on `error`, so
 * the caller files nothing and the night reads exactly as it does today.
 *
 * `fetchImpl` and `onSpend` are injected so a test drives the whole path with
 * no key and no network, the way `import-intro.js` injects its Spotify half.
 */
export async function scorePhoto(bytes, { fetchImpl = globalThis.fetch, onSpend = null } = {}) {
  const key = process.env.GOOGLE_API_KEY;
  if (!key) return { level: '', annotation: null };
  if (!bytes || !bytes.length) return { level: '', annotation: null };
  const base = (process.env.VISION_URL || 'https://vision.googleapis.com/v1').replace(/\/+$/, '');
  try {
    const res = await fetchImpl(`${base}/images:annotate?key=${encodeURIComponent(key)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requests: [{
          image: { content: Buffer.from(bytes).toString('base64') },
          features: [{ type: 'SAFE_SEARCH_DETECTION' }],
        }],
      }),
      // A photo must never leave the private repo waiting on a moderation call.
      signal: AbortSignal.timeout(8000),
    });
    if (!res || !res.ok) {
      const body = res ? (await res.text()).slice(0, 200) : 'no response';
      return { level: '', annotation: null, error: `Vision said ${res ? res.status : '?'}: ${body}` };
    }
    const data = await res.json();
    const annotation = data?.responses?.[0]?.safeSearchAnnotation
      || data?.responses?.[0]?.error && null;
    if (!annotation) {
      const why = data?.responses?.[0]?.error?.message || 'no SafeSearch result';
      return { level: '', annotation: null, error: why };
    }
    // A charge, recorded like every other supplier — see `src/spend.js`.
    if (onSpend) { try { onSpend({ kind: 'moderation', what: 'a photo check', provider: 'google', images: 1 }); } catch { /* bookkeeping never fails a check */ } }
    return { level: flagFrom(annotation), annotation };
  } catch (err) {
    return { level: '', annotation: null, error: String(err && err.message || err) };
  }
}
