#!/usr/bin/env node
/**
 * Turn the image prompts in a quiz pack into picture files for round 2.
 *
 * The app does not care where these images came from — it just reads files
 * out of /images. So you can generate them here, draw them yourself, or drop
 * in your own pictures with the right filenames, and round 2 works the same.
 *
 * Modes:
 *
 *   --placeholder    Draw stand-in artwork locally. No API key, no cost, no
 *                    network. Use this to build and rehearse a quiz before
 *                    you spend anything on real portraits.
 *
 *   --provider openai   Generate with OpenAI's image model. Needs
 *                       OPENAI_API_KEY. Roughly 3-4p per portrait.
 *
 * Note: Anthropic has no image generation API, so a Claude key cannot make
 * these. Claude writes the *prompts* (see generate-quiz.mjs); something else
 * has to draw them.
 *
 * Usage:
 *   node scripts/generate-images.mjs --quiz eighties --placeholder
 *   node scripts/generate-images.mjs --quiz eighties --provider openai
 *   node scripts/generate-images.mjs --quiz eighties --provider openai --only r2q3
 */

import fs from 'node:fs';
import path from 'node:path';

import { config } from '../src/config.js';
import { loadQuiz } from '../src/quizzes.js';

const args = process.argv.slice(2);
const has = (flag) => args.includes(flag);
const argOf = (name, fallback = '') => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};

const quizId = argOf('--quiz', 'eighties');
const provider = has('--placeholder') ? 'placeholder' : argOf('--provider', 'placeholder');
const only = argOf('--only', '');
const force = has('--force');

async function main() {
  const quiz = loadQuiz(config.quizDir, quizId);
  fs.mkdirSync(config.imageDir, { recursive: true });

  const jobs = [];
  for (const round of quiz.rounds) {
    if (round.type !== 'image') continue;
    for (const q of round.questions) {
      if (!q.image) continue;
      if (only && q.id !== only) continue;
      jobs.push(q);
    }
  }

  if (!jobs.length) {
    console.log(`No picture questions found in "${quizId}".`);
    return;
  }

  console.log(`\n${jobs.length} image${jobs.length === 1 ? '' : 's'} to make for "${quiz.title}" using: ${provider}\n`);

  let made = 0;
  let skipped = 0;
  for (const q of jobs) {
    const target = path.join(config.imageDir, q.image);
    if (fs.existsSync(target) && !force) {
      console.log(`  skip   ${q.image} (already there — use --force to replace)`);
      skipped++;
      continue;
    }
    fs.mkdirSync(path.dirname(target), { recursive: true });

    try {
      if (provider === 'placeholder') {
        fs.writeFileSync(target.replace(/\.(png|jpg|jpeg|webp)$/i, '.svg'), placeholderSvg(q), 'utf8');
        console.log(`  drew   ${q.image.replace(/\.(png|jpg|jpeg|webp)$/i, '.svg')}`);
      } else if (provider === 'openai') {
        const bytes = await openaiImage(q);
        fs.writeFileSync(target, bytes);
        console.log(`  made   ${q.image}`);
      } else {
        throw new Error(`Unknown provider "${provider}". Use --placeholder or --provider openai.`);
      }
      made++;
    } catch (err) {
      console.error(`  FAILED ${q.image}: ${err.message}`);
    }
  }

  console.log(`\nDone. ${made} made, ${skipped} skipped. Files are in ${config.imageDir}\n`);
  if (provider === 'placeholder') {
    console.log('These are stand-ins so you can rehearse the round. Replace them with');
    console.log('real artwork before a gig — same filenames, and the app picks them up.\n');
  }
}

/**
 * A stand-in portrait: a bold, abstract face built from the question's own
 * text, so every one looks different and the zoom mechanic has something
 * recognisable to pull back from.
 */
function placeholderSvg(q) {
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

async function openaiImage(q) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error('Set OPENAI_API_KEY first');

  const prompt = q.imagePrompt
    || `A bold stylised digital illustration, clearly a drawing rather than a photograph, `
      + `of the musician ${q.options[q.correctIndex]}. Head and shoulders, facing the viewer, `
      + `dramatic lighting, plain dark background, recognisable features, no text or lettering anywhere in the image.`;

  const res = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({ model: 'gpt-image-1', prompt, size: '1024x1024', n: 1 }),
  });

  if (!res.ok) throw new Error(`OpenAI said ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  const b64 = data.data?.[0]?.b64_json;
  if (!b64) throw new Error('No image came back');
  return Buffer.from(b64, 'base64');
}

main().catch((err) => {
  console.error('\n' + err.message + '\n');
  process.exit(1);
});
