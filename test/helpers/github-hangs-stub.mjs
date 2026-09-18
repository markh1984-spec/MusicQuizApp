/**
 * A GITHUB THAT ACCEPTS THE CONNECTION AND NEVER ANSWERS — the worst case.
 *
 * Loaded with `node --import` in front of the real server, like
 * `photo-repo-stub.mjs`. Every call to `api.github.com` sits there until the
 * caller's own deadline fires; it honours `init.signal` exactly as the real
 * `fetch()` does, so a request WITHOUT a deadline hangs for ever — which is
 * the point. `scripts/github-down.mjs` boots and drives a night through it.
 *
 * Everything else goes to the real network untouched.
 */
const real = globalThis.fetch;

globalThis.fetch = (input, init = {}) => {
  const url = typeof input === 'string' ? input : input.url;
  if (!url.startsWith('https://api.github.com/')) return real(input, init);
  return new Promise((_, reject) => {
    /*
     * A real hung socket keeps the event loop alive; a bare promise does not,
     * and `AbortSignal.timeout()`'s own timer is unref'd — so without this
     * Node would see nothing left to do and EXIT mid-boot ("unsettled
     * top-level await") instead of waiting out the deadline. The interval
     * stands in for the socket.
     */
    const socket = setInterval(() => {}, 1000);
    const signal = init.signal;
    if (!signal) return;                       // no deadline: hangs for ever
    if (signal.aborted) { clearInterval(socket); return reject(signal.reason); }
    signal.addEventListener('abort', () => { clearInterval(socket); reject(signal.reason); }, { once: true });
  });
};
