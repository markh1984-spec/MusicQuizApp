/**
 * Round 2 artwork: turning the image prompts in a quiz pack into picture files.
 *
 * The app does not care where these came from — it reads files out of /images
 * by name. So you can generate them here, draw them yourself, or drop your own
 * in with the right filenames, and the round works the same either way.
 *
 * Three providers:
 *
 *   placeholder  Drawn locally from the question's own text. No key, no cost,
 *                no network. Every one looks different, so the zoom has
 *                something to pull back from and the round is rehearsable
 *                before you have spent anything.
 *
 *   google       Imagen 4, on GOOGLE_API_KEY. **The one in use.** Two to six
 *                pence a picture depending on quality, and free for anybody
 *                already in the shared library — see src/portraits.js.
 *
 *   openai       gpt-image-1, on OPENAI_API_KEY. Kept because it works and
 *                costs nothing to keep, but the host's OpenAI account was
 *                deactivated, which is why Google exists here at all.
 *
 * Anthropic has no image API, so a Claude key cannot make these. Claude writes
 * the *prompts* during quiz generation; something else has to draw them.
 *
 * **Nobody chooses a provider on a button.** `artProvider()` picks whichever
 * key is actually set, cheapest first, and the console shows one "make the real
 * pictures" press. A dropdown asking a host to pick a supplier minutes before a
 * gig is a decision with no right answer at the moment it is being asked.
 *
 * This lives in src/ rather than in the script so the console can call it too.
 * The script is a thin wrapper.
 */

import fs from 'node:fs';
import path from 'node:path';

import {
  STYLES, DEFAULT_STYLE, findStyle, findQuality, DEFAULT_QUALITY,
  portraitPath, isShared, musicianOf,
} from './portraits.js';

export const PROVIDERS = ['placeholder', 'openai', 'google'];

export function openaiConfigured() {
  return Boolean(process.env.OPENAI_API_KEY);
}

export function googleConfigured() {
  return Boolean(process.env.GOOGLE_API_KEY);
}

/**
 * Which provider actually draws, given what is configured.
 *
 * Google first because it is a third of the price for a picture that spends
 * most of its twenty seconds pixelated, blurred or behind tiles. `''` means no
 * key at all, which is the placeholder-only case the console reports in words.
 */
export function artProvider() {
  if (googleConfigured()) return 'google';
  if (openaiConfigured()) return 'openai';
  return '';
}

/**
 * Imagen's three tiers, mapped onto the quality setting the console already
 * has. They line up exactly — Fast, Standard, Ultra against low, medium, high —
 * so there is no second control to build and no new word for the host to learn.
 */
const GOOGLE_MODELS = {
  low: 'imagen-4.0-fast-generate-001',
  medium: 'imagen-4.0-generate-001',
  high: 'imagen-4.0-ultra-generate-001',
};

/**
 * Every picture question in a pack, with the file it wants.
 *
 * `wants` is where the picture SHOULD live — the shared portrait library, keyed
 * on the musician and the style. `q.image` is where the pack currently points,
 * which for anything generated before the library existed is a per-quiz path.
 * Generation moves one to the other; nothing else has to know.
 */
export function imageJobs(quiz, { only = '', style = DEFAULT_STYLE } = {}) {
  const chosen = findStyle(style);
  const jobs = [];
  for (const round of quiz.rounds || []) {
    if (round.type !== 'image') continue;
    for (const q of round.questions || []) {
      if (!q.image) continue;
      if (only && q.id !== only) continue;
      const musician = musicianOf(q);
      jobs.push({ q, musician, wants: musician ? portraitPath(musician, chosen) : q.image });
    }
  }
  return jobs;
}

/** Which of them have real artwork already, and which are still stand-ins. */
export function imageStatus(quiz, imageDir) {
  const jobs = imageJobs(quiz);
  let real = 0;
  let placeholder = 0;
  for (const { q } of jobs) {
    if (fs.existsSync(path.join(imageDir, q.image))) real++;
    else if (fs.existsSync(path.join(imageDir, svgNameFor(q.image)))) placeholder++;
  }
  return { total: jobs.length, real, placeholder, missing: jobs.length - real - placeholder };
}

/**
 * What making this quiz's pictures would cost, before you press anything.
 *
 * Split into what is already drawn and what is not, because the whole reason
 * the library is shared is that the first number is usually the big one, and
 * seeing it is what tells you it is working.
 */
export function imagePlan(quiz, imageDir, { style = DEFAULT_STYLE } = {}) {
  const jobs = imageJobs(quiz, { style });
  const have = [];
  const need = [];
  for (const job of jobs) {
    const already = fs.existsSync(path.join(imageDir, job.wants));
    (already ? have : need).push(job.musician || job.q.id);
  }
  return { style: findStyle(style), total: jobs.length, reused: have.length, toDraw: need.length, have, need };
}

function svgNameFor(image) {
  return String(image).replace(/\.(png|jpg|jpeg|webp)$/i, '.svg');
}

/**
 * Make the pictures.
 *
 * Reports each file as it lands so the console can stream progress — a round
 * of ten real portraits is the best part of a minute and a silent spinner is
 * the wrong thing to look at while money is being spent.
 *
 * A failure on one picture is logged and skipped rather than thrown: nine
 * portraits and one stand-in is a round you can still run tonight.
 *
 * @returns {Promise<{made: string[], skipped: string[], failed: string[]}>}
 */
export async function generateImages({
  quiz,
  imageDir,
  provider = 'placeholder',
  only = '',
  force = false,
  style = DEFAULT_STYLE,
  quality = DEFAULT_QUALITY,
  log = () => {},
  onFile = null,
  // What each picture cost — only ever called for a picture that was actually
  // drawn by OpenAI, since a placeholder and a reuse cost nothing and a ledger
  // full of £0 rows makes the real ones harder to see. See src/spend.js.
  onSpend = () => {},
}) {
  if (!PROVIDERS.includes(provider)) {
    throw new Error(`Unknown provider "${provider}". Use ${PROVIDERS.join(' or ')}.`);
  }
  if (provider === 'openai' && !openaiConfigured()) {
    throw new Error('Set OPENAI_API_KEY before generating real portraits. Without it you can still make placeholders.');
  }
  if (provider === 'google' && !googleConfigured()) {
    throw new Error('Set GOOGLE_API_KEY before generating real portraits. Without it you can still make placeholders.');
  }

  const chosen = findStyle(style);
  const grade = findQuality(quality);
  const jobs = imageJobs(quiz, { only, style: chosen });
  if (!jobs.length) {
    throw new Error(only
      ? `No picture question called "${only}" in this quiz.`
      : 'This quiz has no picture round, so there is nothing to draw.');
  }

  fs.mkdirSync(imageDir, { recursive: true });
  const paid = provider !== 'placeholder';
  log(`${jobs.length} picture${jobs.length === 1 ? '' : 's'} for "${quiz.title}" — ${STYLES[chosen].label.toLowerCase()}, ${provider}${paid ? `, ${grade} quality` : ''}`);

  const made = [];
  const skipped = [];
  const failed = [];
  const repointed = [];

  for (const { q, musician, wants } of jobs) {
    // Move the question onto the shared library as we go. A pack generated
    // before the library existed says `eighties/madonna.png`; the moment its
    // pictures are made again it says `portraits/madonna.png` and every later
    // quiz that wants Madonna is free. The pack is saved by the caller, which
    // is told by `repointed`.
    if (q.image !== wants) {
      repointed.push({ id: q.id, from: q.image, to: wants });
      q.image = wants;
    }

    const name = provider === 'placeholder' ? svgNameFor(wants) : wants;
    const target = path.join(imageDir, name);

    // A real portrait already there is never overwritten by accident — it cost
    // money and may have been redone by hand. Now that pictures are shared this
    // is also where the saving actually happens: the second quiz to want this
    // person pays nothing, and says so.
    if (fs.existsSync(target) && !force) {
      log(`  have   ${musician || name}${isShared(wants) ? ' — already in the library, no charge' : ''}`);
      skipped.push(name);
      continue;
    }
    fs.mkdirSync(path.dirname(target), { recursive: true });

    try {
      let bytes;
      if (provider === 'placeholder') bytes = Buffer.from(placeholderSvg(q), 'utf8');
      else if (provider === 'google') bytes = await googleImage(q, { style: chosen, quality: grade });
      else bytes = await openaiImage(q, { style: chosen, quality: grade });
      // The provider goes on the row because the two are priced completely
      // differently, and a ledger that averaged them would misreport whichever
      // one you were actually using.
      if (paid) onSpend({ kind: 'image', what: 'a portrait', provider, quality: grade, images: 1 });
      fs.writeFileSync(target, bytes);
      log(`  ${provider === 'placeholder' ? 'drew' : 'made'}   ${musician || name}`);
      made.push(name);
      if (onFile) await onFile(name, bytes);
    } catch (err) {
      log(`  FAILED ${musician || name}: ${err.message}`);
      failed.push(name);
    }
  }

  if (skipped.length && paid) {
    log(`${skipped.length} of ${jobs.length} came from the library — that is what you did not pay for`);
  }

  return { made, skipped, failed, repointed, style: chosen, quality: grade };
}

/**
 * A stand-in portrait, built from the question's own text so every one looks
 * different and the zoom mechanic has something recognisable to pull back
 * from. Says PLACEHOLDER across the top, because a stand-in that could be
 * mistaken for the real thing is how one reaches a projector.
 */
export function placeholderSvg(q) {
  const answer = q.options[q.correctIndex] || q.id;
  const seed = [...answer].reduce((n, c) => (n * 31 + c.charCodeAt(0)) >>> 0, 7);
  const rand = (n) => {
    const x = Math.sin(seed * (n + 1)) * 10000;
    return x - Math.floor(x);
  };
  const hue = Math.floor(rand(1) * 360);
  const hue2 = (hue + 140 + Math.floor(rand(2) * 80)) % 360;
  const initials = answer.split(/\s+/).slice(0, 2).map((w) => w[0] || '').join('').toUpperCase();

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="hsl(${hue} 70% 22%)"/>
      <stop offset="100%" stop-color="hsl(${hue2} 65% 12%)"/>
    </linearGradient>
    <radialGradient id="skin" cx="50%" cy="42%">
      <stop offset="0%" stop-color="hsl(${hue} 45% 62%)"/>
      <stop offset="100%" stop-color="hsl(${hue} 40% 38%)"/>
    </radialGradient>
  </defs>
  <rect width="1024" height="1024" fill="url(#bg)"/>
  <ellipse cx="512" cy="430" rx="215" ry="265" fill="url(#skin)"/>
  <path d="M297 360 Q512 ${140 + rand(3) * 90} 727 360 Q700 250 512 218 Q324 250 297 360Z" fill="hsl(${hue2} 55% ${14 + rand(4) * 18}%)"/>
  <ellipse cx="430" cy="415" rx="30" ry="${16 + rand(5) * 12}" fill="#12121c"/>
  <ellipse cx="594" cy="415" rx="30" ry="${16 + rand(5) * 12}" fill="#12121c"/>
  <path d="M470 500 Q512 545 554 500" stroke="hsl(${hue} 40% 26%)" stroke-width="12" fill="none" stroke-linecap="round"/>
  <path d="M${440 + rand(6) * 20} 585 Q512 ${615 + rand(7) * 45} ${584 - rand(6) * 20} 585" stroke="#12121c" stroke-width="16" fill="none" stroke-linecap="round"/>
  <path d="M240 1024 Q512 700 784 1024Z" fill="hsl(${hue2} 60% ${18 + rand(8) * 14}%)"/>
  <text x="512" y="960" font-family="Segoe UI, Arial, sans-serif" font-size="120" font-weight="900"
        text-anchor="middle" fill="rgba(255,255,255,0.16)">${escapeXml(initials)}</text>
  <text x="512" y="70" font-family="Segoe UI, Arial, sans-serif" font-size="34" font-weight="700"
        text-anchor="middle" fill="rgba(255,255,255,0.4)">PLACEHOLDER</text>
</svg>`;
}

function escapeXml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]));
}

/**
 * The prompt matters as much as the model.
 *
 * Two clauses are load-bearing and are added whatever the style says. Not a
 * photograph, because a convincing fake photo of a real musician in a pack that
 * is SOLD is a different kind of problem from a drawing — the same reason the
 * on-screen caption says so. And "no lettering", because a model that writes
 * the artist's name across the picture gives the answer away. Both were here
 * before Google was; neither is new.
 *
 * **The WORDING of the first one is, though, and it was the thing that would
 * have broken this on day one.** It used to read "It must clearly be an
 * illustration and not a photograph" — and asking Google for an *illustration*
 * of a named musician is refused, where asking for a cartoon of the same person
 * is drawn. That sentence was appended to every style, so all of them would
 * have failed, and from the console it would have looked exactly like a bad
 * key. It says "cartoon drawing" now and leads with what IS wanted rather than
 * with what is not.
 *
 * A question's own `imagePrompt` — written by Claude during generation — still
 * describes the person, but the STYLE is the host's choice and always wins.
 * Otherwise picking "as a superhero" would quietly do nothing on any question
 * where Claude happened to write a prompt of its own, which is most of them,
 * and would read as a broken setting.
 */
export function promptFor(q, { style = DEFAULT_STYLE } = {}) {
  const look = STYLES[findStyle(style)];
  const subject = q.imagePrompt
    ? `${q.imagePrompt}`
    : `the musician ${q.options[q.correctIndex]}`;
  return `${look.prompt}. Subject: ${subject}. `
    + `It is a cartoon drawing, not a photograph. `
    + `No text, lettering, signature or watermark anywhere in the image.`;
}

async function openaiImage(q, { style = DEFAULT_STYLE, quality = DEFAULT_QUALITY } = {}) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error('Set OPENAI_API_KEY first');

  const res = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: 'gpt-image-1',
      prompt: promptFor(q, { style }),
      size: '1024x1024',
      // Left unset until now, which meant OpenAI's own default — the expensive
      // end — on every picture ever made. The round shows this zoomed in,
      // pixelated or behind tiles for most of its twenty seconds, to a room
      // several metres from a projector.
      quality: findQuality(quality),
      n: 1,
    }),
  });

  if (!res.ok) {
    const body = (await res.text()).slice(0, 300);
    if (res.status === 401) throw new Error('OpenAI rejected the key. Check OPENAI_API_KEY.');
    if (res.status === 429) throw new Error('OpenAI rate limit or no credit. Check your balance.');
    throw new Error(`OpenAI said ${res.status}: ${body}`);
  }
  const data = await res.json();
  const b64 = data.data?.[0]?.b64_json;
  if (!b64) throw new Error('No image came back');
  return Buffer.from(b64, 'base64');
}

/**
 * Imagen 4, over the plain Gemini API.
 *
 * The AI Studio door rather than Vertex AI, and that is a no-dependencies
 * decision: Vertex authenticates with a service-account JWT that has to be
 * signed and refreshed hourly, where this is one header on one POST. Same
 * models, same prices, same Google Cloud project and bill.
 *
 * **A refusal is reported in words, which is what `includeRaiReason` is for.**
 * Without it a blocked picture comes back as an empty prediction list and is
 * indistinguishable from a network problem — and the thing most likely to be
 * refused is a style, which means the answer is "pick another one", which is
 * only obvious if somebody says so. Same rule as the Spotify 403.
 */
async function googleImage(q, { style = DEFAULT_STYLE, quality = DEFAULT_QUALITY } = {}) {
  const key = process.env.GOOGLE_API_KEY;
  if (!key) throw new Error('Set GOOGLE_API_KEY first');

  const model = GOOGLE_MODELS[findQuality(quality)] || GOOGLE_MODELS[DEFAULT_QUALITY];
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:predict`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify({
      instances: [{ prompt: promptFor(q, { style }) }],
      parameters: {
        sampleCount: 1,
        aspectRatio: '1:1',
        // The round is "whose face is this", so people are the entire point.
        // Left unset this defaults to blocking them and every picture comes
        // back refused, which reads as the key being wrong.
        personGeneration: 'allow_adult',
        includeRaiReason: true,
      },
    }),
  });

  if (!res.ok) {
    const body = (await res.text()).slice(0, 300);
    if (res.status === 400 && /billing/i.test(body)) {
      throw new Error('Google needs billing switched on for this project. console.cloud.google.com/billing');
    }
    if (res.status === 400) throw new Error(`Google rejected the request: ${body}`);
    if (res.status === 401 || res.status === 403) {
      throw new Error(`Google refused the key — check GOOGLE_API_KEY, and that billing is on for its project: ${body}`);
    }
    if (res.status === 429) throw new Error('Google rate limit or quota reached. Try again shortly.');
    throw new Error(`Google said ${res.status}: ${body}`);
  }

  const data = await res.json();
  const first = data.predictions?.[0];
  if (first?.raiFilteredReason) {
    throw new Error(`Google would not draw this one: ${first.raiFilteredReason}. Try a different style.`);
  }
  const b64 = first?.bytesBase64Encoded;
  if (!b64) throw new Error('No image came back, and Google gave no reason.');
  return Buffer.from(b64, 'base64');
}
