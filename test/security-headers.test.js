/**
 * EVERY RESPONSE SAYS WHAT IT IS AND WHERE IT MAY BE SHOWN.
 *
 * There were no security headers anywhere: no Content-Security-Policy (the
 * reflected XSS in /qr.svg, R1, had no second line behind it), no
 * X-Content-Type-Options, no frame-ancestors — /console, the page that
 * drives Launch, could be framed by any site. O25 of the 23 September 2026
 * launch-path sweep.
 *
 * The policy is the strictest the app satisfies, found by AUDITING the pages
 * rather than assuming: `script-src 'self'` with no 'unsafe-inline', because
 * the five inline module scripts moved to `/assets/page-shell.js` and the six
 * inline `onerror=` handlers became one capture-phase listener in client.js;
 * `style-src` keeps 'unsafe-inline' because the console, the phone and the
 * projector build markup with `style=""` attributes in hundreds of places and
 * an inline style cannot run script. An SVG — the QR codes, the favicon, the
 * placeholders — is sandboxed with `script-src 'none'` wherever it is opened.
 * One function, `secure()` in plumbing.js, on every head this server writes.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { withServer } from './helpers/live-server.mjs';

const header = (res, name) => res.headers.get(name) || '';

test('every HTML document carries the policy, cannot be framed, and sends no referrer off-site', async () => {
  await withServer(async (base) => {
    for (const route of ['/console', '/home', '/play', '/screen', '/host', '/login', '/wall', '/o/nothing/here']) {
      const res = await fetch(`${base}${route}`, { redirect: 'manual' });
      assert.match(header(res, 'content-type'), /^text\/html/, `${route} is not an HTML document`);
      const csp = header(res, 'content-security-policy');
      assert.match(csp, /frame-ancestors 'none'/, `${route} can be framed: ${csp || '(no policy)'}`);
      assert.match(csp, /script-src 'self'(;|$)/, `${route} lets inline script run: ${csp}`);
      assert.doesNotMatch(csp.split(';').find((d) => d.trim().startsWith('script-src')) || '', /unsafe-inline/, `${route} allows inline script`);
      assert.match(csp, /object-src 'none'/, `${route} allows plugins`);
      assert.match(csp, /base-uri 'self'/, `${route} allows a base tag`);
      assert.equal(header(res, 'x-frame-options'), 'DENY', `${route} has no X-Frame-Options for older browsers`);
      assert.equal(header(res, 'referrer-policy'), 'same-origin', `${route} leaks its address off-site`);
      assert.equal(header(res, 'x-content-type-options'), 'nosniff', `${route} can be sniffed`);
    }
  });
});

test('an SVG can never run script, wherever it is opened; everything else is nosniff', async () => {
  await withServer(async (base) => {
    for (const route of ['/qr.svg?text=hello', '/join-qr.svg', '/favicon.svg', '/quiz-images/eighties/prince.png']) {
      const res = await fetch(`${base}${route}`);
      assert.equal(res.status, 200, `${route} answered ${res.status}`);
      assert.match(header(res, 'content-type'), /image\/svg\+xml/, `${route} is not an SVG`);
      const csp = header(res, 'content-security-policy');
      assert.match(csp, /sandbox/, `${route} is not sandboxed: ${csp || '(no policy)'}`);
      assert.match(csp, /script-src 'none'/, `${route} may run script: ${csp}`);
      assert.equal(header(res, 'x-content-type-options'), 'nosniff');
    }
    for (const route of ['/assets/style.css', '/assets/client.js', '/api/state?role=screen', '/health', '/api/nothing']) {
      const res = await fetch(`${base}${route}`);
      assert.equal(header(res, 'x-content-type-options'), 'nosniff', `${route} (${res.status}) can be sniffed`);
    }
  });
});
