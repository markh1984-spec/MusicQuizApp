/**
 * A STAND-IN FOR THE MAIL PROVIDER — every send appended to a JSONL file.
 *
 * **The same shape as `photo-repo-stub.mjs`, and for the same reason.** The
 * trial-notice sweep runs at BOOT, inside `server.js`, against the real accounts
 * book — so the only way to know whether it actually sends anything is to spawn
 * the real server and stub the network behind it. Checking that the accounts got
 * their marks proves the idempotency and NOT the email: a sweep that stamped and
 * sent nothing would pass that on its own, which is this repo's oldest fault
 * wearing a mail provider.
 *
 * Loaded with `node --import`, writing to `MAIL_STUB_FILE`. Deliberately dumb: no
 * bounces, no rate limits, no authentication. What it is for is proving that
 * something left, addressed to the right person, saying the right thing.
 */
import fs from 'node:fs';

const OUT = process.env.MAIL_STUB_FILE;
const real = globalThis.fetch;
const MAIL = ['https://api.brevo.com/', 'https://api.resend.com/'];

globalThis.fetch = async (input, init = {}) => {
  const url = typeof input === 'string' ? input : input.url;
  if (!MAIL.some((m) => url.startsWith(m))) return real(input, init);

  // Brevo's keep-alive ping is a GET and is not a send — recording it would make
  // every count in the test one too many.
  if ((init.method || 'GET').toUpperCase() !== 'POST') {
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  }
  let body = {};
  try { body = JSON.parse(init.body); } catch { /* recorded as empty */ }
  const line = JSON.stringify({
    url,
    // Both providers, so the test never has to know which is configured.
    to: (body.to && body.to[0] && (body.to[0].email || body.to[0])) || '',
    subject: body.subject || '',
    text: body.textContent || body.text || '',
  });
  fs.appendFileSync(OUT, `${line}\n`);
  return new Response(JSON.stringify({ messageId: 'stub-1' }), { status: 200 });
};
