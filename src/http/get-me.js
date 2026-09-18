/**
 * GET ROUTES — me. Moved whole out of `handleGet()` in server.js;
 * the body is unchanged, it is one of the functions the shell tries in order.
 */
import { FEATURES, TIERS, accounts, config, entitlements, rooms, sellableTiers, stripeConfigured, flight } from './context.js';
import { Flight } from '../flight.js';
import { selfTestResult } from '../self-test.js';
import { sendJson } from './plumbing.js';
import { SESSION_COOKIE, brandForRoom, cookie, galleryRoomFrom, roomForHost, roomForPhone, roomIdFor, schemeForRoom, summarise, whoIs } from './identity.js';
import { allowed } from './gates.js';
import { viewFor } from './views.js';
import { cardArt } from './card-art.js';
import { publicRoomId } from './helpers.js';

export async function getMe(req, res, url, route) {
  if (route === '/api/me') {
    const account = whoIs(req, url);
    if (!account) return sendJson(res, 200, { signedIn: false }), true;
    return sendJson(res, 200, {
      signedIn: true,
      account: {
        ...account,
        /*
         * THE CONSOLE'S GATE HAS TO AGREE WITH THE ROUTE'S. On a last night
         * `mayStartSomething()` will allow the launch, so the capabilities
         * reported here have to say so too — otherwise `can()` in the browser
         * stays shut and `launchBar()` draws an empty div over a night the
         * server would have run. See `entitlements()`'s own note.
         */
        entitlements: entitlements(account, { asIfPaying: accounts.lastNightLeft(account) }),
        // 20% of what everybody THIS account referred is paying, added up —
        // see referralCredit() in accounts.js. Nothing to compute for the
        // owner, who has no subscription of their own to credit. On the
        // account object, not a sibling of it, because the browser reads
        // `who.account` and drops everything else in the response.
        referralCreditPence: account.role === 'owner' ? 0 : accounts.referralCredit(account.id),
        /*
         * IS TONIGHT THEIR LAST NIGHT? — answered HERE, never re-derived in
         * the browser, for the same reason the address question below is.
         *
         * It needs the accounts book (a group seat's grace belongs to its
         * PARENT) and the server's own clock against a 6am roll-over, and a
         * console that guessed either would warn the wrong person or, worse,
         * stay silent for the right one. See `lastNightLeft()` in
         * `accounts.js` for what it means.
         */
        lastNightLeft: accounts.lastNightLeft(account),
        /*
         * DOES A VENUE'S OWN ADDRESS WORK FOR THIS ACCOUNT?
         *
         * `/station-tap-wokingham/quiz-league` resolves against the room the
         * public pages fall back to — the owner's own quizmaster room, or the
         * house room when there are no accounts yet. Every other account keeps
         * `?q=`, which is what they had before addresses existed.
         *
         * **THE SERVER ANSWERS THIS RATHER THAN THE BROWSER GUESSING.** The
         * first version tested `role === 'owner'` in the console, which is
         * wrong in both directions: the bootstrap host key resolves to the
         * house room and so DOES get the pretty form, while the owner's own
         * quizmaster hat is not `role === 'owner'` and does. One fact, known
         * here, sent — rather than a rule about identities re-derived in a
         * place that cannot see the rooms.
         */
        ownAddress: roomForHost(req, url).id === publicRoomId(),
        /*
         * WHICH RUNGS CAN ACTUALLY BE BOUGHT — the ones with a live price on
         * the server. **NO SUBSCRIBE BUTTON UNTIL THERE IS A PROCESSOR** is
         * the rule the rungs already carry, and this is the half that makes it
         * true without a redeploy: the keys and the three price ids are
         * environment variables, so the button appears the moment they are set
         * and cannot appear before. A button that opens a 500 is worse than no
         * button at the exact moment somebody is trying to pay.
         *
         * A LIST rather than a boolean, because the three go on sale one at a
         * time while they are being set up, and a rung with no price behind it
         * must stay a price list.
         */
        canBuy: stripeConfigured() ? sellableTiers() : [],
        // And whether there is a subscription to manage at all — the portal
        // 400s without a customer, so the link is drawn only where it works.
        hasBilling: Boolean((account.billing || {}).customer),
      },
      /*
       * THE LIVE LADDER, so the browser stops working off the shipped one.
       *
       * `plans.js` runs in both places and its overrides start empty in a
       * fresh page. Without this the console would draw a Silver lock badge on
       * something the owner moved to Gold — the app quoting a price that is
       * not the price.
       *
       * **CALLED `featureTiers`, NOT `tiers`, AND THAT IS A BUG FIX.** This
       * object literal ALREADY has a `tiers` key forty lines down — the rungs
       * the hat switch draws — so the first version of this silently lost to
       * it: a later duplicate key in an object literal simply wins, with no
       * error anywhere. The browser was handed an array of rungs where it
       * expected a feature map, `setTierOverrides` quietly ignored all of it,
       * and every page carried on drawing the SHIPPED ladder while the server
       * had stored the owner's. Nothing looked broken on either side.
       *
       * Only the DIFFERENCES: a few bytes on a payload every page fetches
       * anyway, rather than a route of its own.
       */
      featureTiers: accounts.featureTiers(),
      // Said out loud, because a bootstrap session looks exactly like a real
      // one until something it cannot do goes wrong.
      bootstrap: Boolean(account.bootstrap),
      // Wearing the quizmaster hat. Every page shows a bar saying so — being
      // unsure which hat is on is worse than either hat.
      actingAs: Boolean(account.actingAs),
      realName: account.realName || '',
      /*
       * Signed in AS WELL as holding the host key.
       *
       * The key deliberately beats the cookie (see `whoIs`), which is right on a
       * gig night — but it meant that once a browser had seen `?key=…`, the hat
       * switch vanished for good, because a bootstrap request has no owner
       * identity to switch between. You could never look at the quizmaster side
       * from the laptop you actually work on.
       *
       * So the browser is told the cookie is there too. It draws the switch,
       * and picking a hat forgets the remembered key — the server's ordering is
       * untouched, and the bookmark still works because the key is in its URL.
       */
      alsoSignedIn: account.bootstrap ? summarise(accounts.fromToken(cookie(req, SESSION_COOKIE))) : null,
      // Which rung of the ladder the hat is being worn as, if any. Empty means
      // "as the linked account really is", which is comped — the whole ladder.
      previewTier: account.previewTier || '',
      /*
       * The rungs to offer. Anybody who can WEAR the hat gets them, not only
       * somebody already wearing it — the switch is one menu in every state,
       * and tapping a rung with the hat off means "put it on and show me that".
       * A real quizmaster has nothing to preview and is sent nothing to draw.
       */
      tiers: (account.actingAs || account.role === 'owner' || account.bootstrap)
        ? TIERS.map(({ id, label, plan }) => ({ id, label, plan }))
        : [],
    }), true;
  }

  /*
   * Your own group — a company or a pub group, seats under a parent. See
   * the POST/DELETE routes in `handleWrite` for adding and removing a seat;
   * this is the read half, and it lives HERE rather than there because GET
   * requests are dispatched to `handleGet`, never to `handleWrite` — a
   * lesson this codebase has already paid for once, the hard way (the
   * gallery publish route, defined inside `handleGet` where a POST could
   * never reach it). A route in the wrong handler is dead code that reads
   * as a feature.
   */
  if (route === '/api/group' && req.method === 'GET') {
    const me = whoIs(req, url);
    if (!me) return sendJson(res, 401, { error: 'Sign in first' }), true;
    if (me.bootstrap || me.role === 'owner') return sendJson(res, 200, { seats: [], isSeat: false }), true;
    if (me.parentId) return sendJson(res, 200, { seats: [], isSeat: true }), true;
    const seats = accounts.groupStatus(me.id, (childId) => {
      const room = rooms.get(roomIdFor({ id: childId, role: 'quizmaster' }));
      const state = room.session.engine.state;
      const live = state.phase !== 'lobby' || room.session.engine.playerList().length > 0;
      if (!live) return null;
      return { phase: state.phase, playerCount: room.session.engine.playerList().length, title: room.session.pack.title };
    });
    return sendJson(res, 200, { seats, isSeat: false }), true;
  }

  /*
   * Whose night is this, and what does it look like.
   *
   * Open, because the join page needs it before anybody has joined — and it
   * answers for the ROOM the caller reached for, so a phone that scanned Rob's
   * projector gets Rob's name and Rob's colours without signing in to anything.
   * The console asks with `role=host` to get its own instead.
   */
  /*
   * WHICH CARDS SOMEBODY HAS DRAWN A PICTURE FOR.
   *
   * The soundboard's interface, applied to the deck: a file in
   * `public/assets/cards/` named after a card's own id — `sj.png` for the Jack
   * of Spades — replaces the middle of that card, and taking it away brings the
   * drawn pip back. The reasoning is in `public/assets/card-face.js`; the two
   * halves that have to live HERE are that the server is the only thing that
   * can see its own folder, and that fifty-two speculative 404s from every
   * phone in a pub is not a way to find out.
   *
   * **READ ONCE AND REMEMBERED.** The folder is part of the repository, so it
   * cannot change without a deploy and every deploy is a fresh process — a
   * `readdir` per phone per night would be answering a question that has only
   * one answer for the life of the server.
   *
   * **AN ID THE DECK DOES NOT HOLD IS IGNORED**, which is the same rule as a
   * sting id and a pack id: the list the browser draws from is the list built
   * from the app's own data, never from a filename. A stray `notes.txt` in
   * there is silence rather than a card that does not exist.
   *
   * **AND `.webp` WINS OVER `.png` WHEN BOTH ARE THERE.** The sales page
   * already paid for that lesson — 4.6MB of PNG became 180KB — and this is a
   * picture that goes on a projector, so somebody converting a folder later
   * must not have to delete the originals to make it take effect.
   */
  if (route === '/api/card-art') return sendJson(res, 200, cardArt()), true;

  if (route === '/api/brand') {
    // The public gallery names whose photos these are the same way it picks
    // which room's — `?q=`, an account id, no more secret than the one
    // already in every `/signup?ref=` link. Checked before the role branch
    // below: a gallery visit carries neither `role=host` nor a join code.
    const galleryQ = galleryRoomFrom(url.searchParams.get('q'));
    const room = galleryQ ? rooms.get(galleryQ)
      : url.searchParams.get('role') === 'host'
        ? roomForHost(req, url)
        : roomForPhone(req, url);
    return sendJson(res, 200, {
      name: brandForRoom(room),
      scheme: schemeForRoom(room),
      appName: config.appName,
    }), true;
  }
  /*
   * WHAT THE APP SAW TONIGHT — the flight recorder, read back. Your own
   * room's lines plus the server-wide failures; the owner may ask for `all`.
   * The text is built here so the Copy button on the Help tab and a curl
   * from a laptop produce the identical report.
   */
  if (route === '/api/flight' && req.method === 'GET') {
    const account = whoIs(req, url);
    if (!account) return sendJson(res, 401, { error: 'Sign in first', signIn: '/login' }), true;
    const owner = account.bootstrap || account.role === 'owner';
    /*
     * THE OWNER MAY READ ANY ACCOUNT'S RECORD, and that is not the support
     * door being bypassed: this is the SERVER's log of what the app did, which
     * the owner already has in full on Render, filtered to one room. It holds
     * no pack, no question, no player — a launch title and the reasons for
     * refusals. *"If a quizmaster has a problem launching, I need to know
     * what the exact problem was with that account."* The quizmaster's own
     * panel says the owner can read it, so nothing here is quiet.
     */
    let roomId = roomForHost(req, url).id;
    let who = '';
    const asked = url.searchParams.get('account');
    if (owner && asked) {
      const target = asked === 'house' ? null : accounts.find(asked);
      if (asked !== 'house' && !target) return sendJson(res, 404, { error: 'No such account' }), true;
      roomId = roomIdFor(target);
      who = target ? (target.name || target.email || '') : '';
    }
    const entries = flight.recent({ room: roomId, all: owner && url.searchParams.get('all') === '1', limit: 300 });
    const st = selfTestResult();
    return sendJson(res, 200, {
      room: roomId, who, entries, text: Flight.text(entries),
      selfTest: st ? { ok: st.ok, at: st.at, ms: st.ms, steps: st.steps, failed: st.failed } : null,
    }), true;
  }

  if (route === '/api/state') {
    const role = url.searchParams.get('role') || 'screen';
    // The projector and the phones are open by design; only the control view
    // is not. Asked with `live` set, because this is the connection a running
    // game hangs off and a failed payment must not cut it.
    if (role === 'host' && !allowed(req, res, url, FEATURES.QUIZ, { live: true })) return true;
    const room = role === 'host' ? roomForHost(req, url) : roomForPhone(req, url);
    return sendJson(res, 200, viewFor({ role, playerId: url.searchParams.get('playerId'), room })), true;
  }

  return false;
}
