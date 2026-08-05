/**
 * Round 2 artwork: turning the image prompts in a quiz pack into picture files.
 *
 * The app does not care where these came from — it reads files out of /images
 * by name. So you can generate them here, draw them yourself, or drop your own
 * in with the right filenames, and the round works the same either way.
 *
 * Two providers:
 *
 *   placeholder  Drawn locally from the question's own text. No key, no cost,
 *                no network. Every one looks different, so the zoom has
 *                something to pull back from and the round is rehearsable
 *                before you have spent anything.
 *
 *   openai       Real portraits. Needs OPENAI_API_KEY. Roughly 3-4p each.
 *
 * Anthropic has no image API, so a Claude key cannot make these. Claude writes
 * the *prompts* during quiz generation; something else has to draw them.
 *
 * This lives in src/ rather than in the script so the console can call it too.
 * The script is a thin wrapper.
 */

import fs from 'node:fs';
import path from 'node:path';

export const PROVIDERS = ['placeholder', 'openai'];

export function openaiConfigured() {
  return Boolean(process.env.OPENAI_API_KEY);
}

/** Every picture question in a pack, with the file it wants. */
export function imageJobs(quiz, { only = '' } = {}) {
  const jobs = [];
  for (const round of quiz.rounds || []) {
    if (round.type !== 'image') continue;
    for (const q of round.questions || []) {
      if (!q.image) continue;
      if (only && q.id !== only) continue;
      jobs.push(q);
    }
  }
  return jobs;
}

/** Which of them have real artwork already, and which are still stand-ins. */
export function imageStatus(quiz, imageDir) {
  const jobs = imageJobs(quiz);
  let real = 0;
  let placeholder = 0;
  for (const q of jobs) {
    if (fs.existsSync(path.join(imageDir, q.image))) real++;
    else if (fs.existsSync(path.join(imageDir, svgNameFor(q.image)))) placeholder++;
  }
  return { total: jobs.length, real, placeholder, missing: jobs.length - real - placeholder };
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
  log = () => {},
  onFile = null,
}) {
  if (!PROVIDERS.includes(provider)) {
    throw new Error(`Unknown provider "${provider}". Use ${PROVIDERS.join(' or ')}.`);
  }
  if (provider === 'openai' && !openaiConfigured()) {
    throw new Error('Set OPENAI_API_KEY before generating real portraits. Without it you can still make placeholders.');
  }

  const jobs = imageJobs(quiz, { only });
  if (!jobs.length) {
    throw new Error(only
      ? `No picture question called "${only}" in this quiz.`
      : 'This quiz has no picture round, so there is nothing to draw.');
  }

  fs.mkdirSync(imageDir, { recursive: true });
  log(`${jobs.length} image${jobs.length === 1 ? '' : 's'} to make for "${quiz.title}" using ${provider}`);

  const made = [];
  const skipped = [];
  const failed = [];

  for (const q of jobs) {
    const name = provider === 'placeholder' ? svgNameFor(q.image) : q.image;
    const target = path.join(imageDir, name);

    // A real portrait already there is never overwritten by accident — it cost
    // money and may have been redone by hand.
    if (fs.existsSync(target) && !force) {
      log(`  skip   ${name} — already there`);
      skipped.push(name);
      continue;
    }
    fs.mkdirSync(path.dirname(target), { recursive: true });

    try {
      const bytes = provider === 'placeholder'
        ? Buffer.from(placeholderSvg(q), 'utf8')
        : await openaiImage(q);
      fs.writeFileSync(target, bytes);
      log(`  ${provider === 'placeholder' ? 'drew' : 'made'}   ${name}`);
      made.push(name);
      if (onFile) await onFile(name, bytes);
    } catch (err) {
      log(`  FAILED ${name}: ${err.message}`);
      failed.push(name);
    }
  }

  return { made, skipped, failed };
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
 * The prompt matters as much as the model. It has to say "illustration, not a
 * photograph" — a photoreal fake of a real musician on a pub projector is a
 * different thing entirely — and "no lettering", because a model that writes
 * the artist's name across the picture gives the answer away.
 */
export function promptFor(q) {
  return q.imagePrompt
    || `A bold stylised digital illustration, clearly a drawing rather than a photograph, `
      + `of the musician ${q.options[q.correctIndex]}. Head and shoulders, facing the viewer, `
      + `dramatic lighting, plain dark background, recognisable features, no text or lettering anywhere in the image.`;
}

async function openaiImage(q) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error('Set OPENAI_API_KEY first');

  const res = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({ model: 'gpt-image-1', prompt: promptFor(q), size: '1024x1024', n: 1 }),
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
