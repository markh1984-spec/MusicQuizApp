/**
 * A STAND-IN FOR HAVE I BEEN PWNED — one known-breached password, nothing else.
 *
 * **The same shape as `mail-stub.mjs` and `photo-repo-stub.mjs`, and for the
 * same reason.** `refuseBreached()` lives inside `server.js`, on the routes, so
 * the only way to know whether a route actually asks it is to spawn the real
 * server and stub the network behind it. Reading `server.js` as TEXT is how a
 * broken Launch once reached the live app with 1,150 tests green — *a test that
 * never runs the artefact proves nothing about it*.
 *
 * Loaded with `--import`, which `withServer()` passes through `NODE_OPTIONS`.
 *
 * It answers the real API's shape rather than a convenient one: a PADDED body,
 * every decoy row carrying a count of **0**. A stub that returned only hits
 * would pass a reader that treats "the suffix is present" as a hit — which is
 * exactly the bug the padding rule exists to prevent.
 */

const real = globalThis.fetch;
const RANGE = 'https://api.pwnedpasswords.com/range/';

// "password" — eight characters, so it clears the length rule and is refused on
// this instead, which is the whole argument for the trade.
const BREACHED = { prefix: '5BAA6', suffix: '1E4C9B93F3F0682250B6CF8331B7EE68FD8', seen: 9_659_365 };

// Padding: real suffixes are 35 hex characters, and these all count 0.
const PAD = [
  '0000000000000000000000000000000000A',
  'FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFB',
].map((s) => `${s}:0`);

globalThis.fetch = async (input, init = {}) => {
  const url = typeof input === 'string' ? input : input.url;
  if (!url.startsWith(RANGE)) return real(input, init);

  const asked = url.slice(RANGE.length).toUpperCase();
  const rows = [...PAD];
  if (asked === BREACHED.prefix) rows.push(`${BREACHED.suffix}:${BREACHED.seen}`);
  return new Response(rows.join('\r\n'), { status: 200 });
};
