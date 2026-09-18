/**
 * GET ROUTES — pages. Moved whole out of `handleGet()` in server.js;
 * the body is unchanged, it is one of the functions the shell tries in order.
 */
import { config, loadAdvertPack, readVenuePath, rooms } from './context.js';
import { onDjHost, send } from './plumbing.js';
import { offerRoomId, whoIs } from './identity.js';
import { serveFile } from './static.js';
import { offerPage } from './helpers.js';

export async function getPages(req, res, url, route) {
  // ---- pages
  /*
   * THE BARE DOMAIN IS THE QUIZMASTER'S FRONT DOOR, not the projector.
   *
   * It used to redirect to `/screen`, which meant typing quizporium.co.uk got
   * you a lobby slide with a QR on it — the one page that is opened once, on a
   * laptop plugged into a projector, from a link on the console. Nobody
   * arrives at the bare domain wanting that. The people who type it are the
   * quizmaster, and what they want is in.
   *
   * PLAYERS ARE UNAFFECTED: every QR, every printed card and every join link
   * says `/play`, never the bare domain — see `joinUrlFor`.
   *
   * `no-store`, because where this goes depends on WHO IS ASKING. A cached 302
   * to /login would follow a signed-in quizmaster around for as long as the
   * browser kept it, which is the kind of fault nobody thinks to look for.
   */
  /*
   * THE FRONT DOOR, AND A STRANGER GETS THE SHOP WINDOW RATHER THAN A LOCK.
   *
   * This sent everybody who was not signed in to `/login` — so somebody typing
   * the domain, or following a link off a business card, was met by a password
   * box for an account they do not have. The sales page existed and was
   * reachable only by knowing to type `/home`, which is a shop with its
   * lights on and the door round the back.
   *
   * Signed in is UNCHANGED and stays the common case: the console for a
   * quizmaster, the owner page for the owner. Nobody who works here has to
   * walk past the marketing.
   *
   * Signing in is one press from the header of the page they now land on, so
   * nothing is further away than it was — the door is just the right way round.
   */
  if (route === '/') {
    /*
     * ON THE DJ SET'S OWN DOMAIN, THE BARE DOMAIN IS THE DJ DOOR.
     *
     * Without this, typing `dj.pubchampions.co.uk` redirects to the console
     * or the owner page — a separate product handing you straight to a
     * different one, which is the exact fault the door's own sign-in had and
     * was reported for: *"that just signed me into my quiz app."*
     *
     * SERVED, NOT REDIRECTED TO `/dj`. A redirect would put the quiz app's
     * path in the address bar of a product that is not it, and it is one more
     * round trip on a phone in a venue.
     */
    if (onDjHost(req)) return serveFile(res, config.publicDir, 'dj.html'), true;
    const who = whoIs(req, url);
    const to = who ? (who.role === 'owner' ? '/owner' : '/console') : '/home';
    send(res, 302, '', { Location: to, 'Cache-Control': 'no-store' });
    return true;
  }
  if (route === '/screen') return serveFile(res, config.publicDir, 'screen.html'), true;
  /*
   * THE SECOND SCREEN. A page of its own rather than `/screen?wall=1`, because
   * the two are opened side by side on one laptop and a query string is the one
   * thing that does not survive being dragged to another display and
   * bookmarked. See `wallView()` for what it is told.
   */
  if (route === '/wall') return serveFile(res, config.publicDir, 'wall.html'), true;
  /*
   * THE BAR STAFF'S CAMERA. Open, like `/play`, `/v` and `/wall`, and for the
   * identical reason: it is handed to somebody with no account who never will
   * have one. It gives out nothing on its own — the join code in the address
   * has to be a real one, and `roomForPhone()` refuses anything else.
   */
  if (route === '/snap') return serveFile(res, config.publicDir, 'snap.html'), true;
  if (route === '/play') return serveFile(res, config.publicDir, 'play.html'), true;
  // Where a scanned voucher lands. Open, like /play and the sign-in page:
  // it hands out nothing on its own, the code in the address has to be right.
  if (route === '/v') return serveFile(res, config.publicDir, 'voucher.html'), true;
  // The photo gallery. Open, like /play and /v — it is for the people who were
  // in the room, who have no account and never will. It shows only nights the
  // quizmaster has published; see src/gallery.js.
  /*
   * THE ADVERT OFFER PAGE — `/o/<pack>/<slide>`, and the QR points here.
   *
   * Public by necessity: it is scanned by whoever is in the room, on a phone
   * with no account and no key. It records ONE open and shows the offer.
   *
   * **The same room question the gallery has, answered the same way**, so the
   * two cannot drift: the app owner's own quizmaster room, falling back to the
   * house. **A second subscriber's offers need the same slug the gallery
   * needs** — one job fixes both, and inventing a parallel mechanism here
   * would mean fixing it twice.
   */
  if (route.startsWith('/o/')) {
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    const bits = route.slice(3).split('/').map((b) => decodeURIComponent(b));
    const room = rooms.get(offerRoomId());
    /*
     * `loadAdvertPack` THROWS on a pack that is not there, so this has to
     * catch: a mistyped or retired code is the ordinary case for a public
     * address printed on a projector, and it must land on the "nothing here"
     * page rather than a 500. Found by scanning a code that did not exist.
     */
    let pack = null;
    try { pack = bits[0] && bits[1] ? loadAdvertPack(room.paths.adverts, bits[0]) : null; } catch { pack = null; }
    const slide = pack ? (pack.slides || []).find((sl) => sl.id === bits[1]) : null;
    if (!slide) {
      return send(res, 404, offerPage(null, null), { 'Content-Type': 'text/html; charset=utf-8' }), true;
    }
    /*
     * COUNTED BEFORE IT IS DRAWN, and never awaited into the response beyond
     * the write itself: the person holding the phone is standing in a pub, and
     * a page that waits on bookkeeping is a page they close.
     */
    try { room.offers.opened(bits[0], bits[1]); } catch { /* a lost count is not worth a 500 */ }
    return send(res, 200, offerPage(pack, slide), { 'Content-Type': 'text/html; charset=utf-8' }), true;
  }

  if (route === '/gallery') {
    // NOT in a search result, published or not. Being findable is speculative
    // marketing value; a stranger's face in a search result is a concrete cost
    // that lands on the player. One header to change later if it earns it.
    res.setHeader('X-Robots-Tag', 'noindex, nofollow, noimageindex');
    return serveFile(res, config.publicDir, 'gallery.html'), true;
  }
  /*
   * THE PUBLIC LEAGUE TABLE — the same shape and the same header as the
   * gallery one door up, because it is the same kind of page: something the
   * people who were in the room come back to, holding names they typed on a
   * night rather than anything they signed up for. Not findable, published
   * or not.
   */
  if (route === '/league') {
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    return serveFile(res, config.publicDir, 'league.html'), true;
  }

  /*
   * A VENUE'S OWN ADDRESS — `/station-tap-wokingham/quiz-league` and
   * `/station-tap-wokingham/gallery/20-august`.
   *
   * Asked for on 31 August 2026: *"I want to be able to have the URLs
   * conveniently reachable."* These are the same two pages `/league` and
   * `/gallery` already serve — the SAME FILE, byte for byte — and the page
   * reads its own address to know which venue it is. Nothing is templated,
   * because this app has no template engine and does not want one.
   *
   * **THE SECOND SEGMENT IS NAMED EXACTLY, which is what makes a
   * one-segment prefix safe at the root.** A catch-all here would quietly
   * start shadowing whatever route is added next year; `/anything/quiz-league`
   * cannot collide with anything, and `readVenuePath()` refuses every other
   * shape — including a path traversal in the venue segment.
   *
   * **IT RESOLVES AGAINST THE OWNER'S OWN ROOM, or the one named by `?q=`.**
   * The pretty form belongs to the app owner, whose domain this is; a
   * subscriber's public link carries `?q=` as it already does. An address book
   * mapping every subscriber's venue to a global slug is the next step if that
   * is ever wanted, and it is deliberately not built for one customer.
   */
  const venuePath = readVenuePath(route);
  if (venuePath) {
    res.setHeader('X-Robots-Tag', venuePath.page === 'gallery'
      ? 'noindex, nofollow, noimageindex' : 'noindex, nofollow');
    return serveFile(res, config.publicDir,
      venuePath.page === 'gallery' ? 'gallery.html' : 'league.html'), true;
  }
  if (route === '/host') return serveFile(res, config.publicDir, 'host.html'), true;
  if (route === '/editor') return serveFile(res, config.publicDir, 'editor.html'), true;
  if (route === '/console') return serveFile(res, config.publicDir, 'console.html'), true;
  if (route === '/login') return serveFile(res, config.publicDir, 'login.html'), true;
  // The shop window — open to anybody, no key, no account. The place a
  // referral or a search result lands.
  if (route === '/home') return serveFile(res, config.publicDir, 'home.html'), true;
  if (route === '/signup') return serveFile(res, config.publicDir, 'signup.html'), true;
  // Legal pages — plain static HTML, same shell as /home. Linked from the
  // landing page footer and from account/signup so they are always one tap
  // away, never a page that only exists if you already know the URL.
  if (route === '/terms') return serveFile(res, config.publicDir, 'terms.html'), true;
  if (route === '/privacy') return serveFile(res, config.publicDir, 'privacy.html'), true;
  if (route === '/refunds') return serveFile(res, config.publicDir, 'refunds.html'), true;
  /*
   * THE FAQ — public, and deliberately NOT behind the sign-in.
   *
   * It is the page somebody reads BEFORE they pay as much as after, so it sits
   * with the legal pages rather than inside the console. The console's Help tab
   * draws the same list from the same module — see `public/assets/faq.js`.
   */
  if (route === '/faq') return serveFile(res, config.publicDir, 'faq.html'), true;
  /*
   * THE DJ SET'S FRONT DOOR. Open like every other page here — what is behind
   * it is not: `/api/dj/start` asks who you are, and the page draws a sign-in
   * when the state route says 401. A door that 401s is a door somebody thinks
   * is broken.
   */
  if (route === '/dj') return serveFile(res, config.publicDir, 'dj.html'), true;
  // The sign-in link's landing page. Open, like `/reset` — it hands out
  // nothing on its own, the token in the address is what has to be right.
  if (route === '/magic') return serveFile(res, config.publicDir, 'magic.html'), true;
  // Open, like the sign-in page. It hands out nothing on its own — the token
  // in the address is what has to be right, and the page asks the server.
  if (route === '/reset') return serveFile(res, config.publicDir, 'reset.html'), true;
  if (route === '/owner') return serveFile(res, config.publicDir, 'owner.html'), true;
  return false;
}
