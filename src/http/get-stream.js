/**
 * GET ROUTES — stream. Moved whole out of `handleGet()` in server.js;
 * the body is unchanged, it is one of the functions the shell tries in order.
 */
import { FEATURES, hub } from './context.js';
import { roomForHost, roomForPhone } from './identity.js';
import { allowed } from './gates.js';
import { viewFor } from './views.js';

export async function getStream(req, res, url, route) {
  // ---- realtime
  if (route === '/api/stream') {
    const role = url.searchParams.get('role') || 'screen';
    // The projector and the phones are open by design; only the control view
    // is not. Asked with `live` set, because this is the connection a running
    // game hangs off and a failed payment must not cut it.
    if (role === 'host' && !allowed(req, res, url, FEATURES.QUIZ, { live: true })) return true;
    const playerId = url.searchParams.get('playerId') || null;
    // The control view drives the room of whoever is signed in; a projector or
    // a phone follows the code it was given.
    const room = role === 'host' ? roomForHost(req, url) : roomForPhone(req, url);
    if (playerId) room.session.engine.touch(playerId);
    const client = hub.add(res, { role, playerId, room });
    hub.send(client, 'state', viewFor(client));
    return true;
  }

  return false;
}
