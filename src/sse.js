/**
 * Server-sent events: the realtime channel to every screen and phone.
 *
 * SSE rather than websockets on purpose. It is ordinary HTTP, so it survives
 * pub wifi, mobile data, captive portals and whatever proxy a venue has in
 * front of it, and the browser reconnects on its own when a phone comes back
 * from being locked. There is nothing to configure and nothing to install.
 */

const HEARTBEAT_MS = 15000;

export class Hub {
  constructor() {
    this.clients = new Set();
    this.heartbeat = setInterval(() => this.ping(), HEARTBEAT_MS);
    if (this.heartbeat.unref) this.heartbeat.unref();
  }

  /**
   * @param {import('node:http').ServerResponse} res
   * @param {object} meta  { role: 'screen'|'player'|'host', playerId }
   */
  add(res, meta) {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      // Tells nginx-style proxies not to buffer us, which would otherwise
      // hold events back until the buffer filled — fatal for a live quiz.
      'X-Accel-Buffering': 'no',
    });
    // Tell the browser to come back quickly if the connection drops.
    res.write('retry: 2000\n\n');

    const client = { res, ...meta };
    this.clients.add(client);
    res.on('close', () => this.clients.delete(client));
    return client;
  }

  send(client, event, data) {
    try {
      client.res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    } catch {
      this.clients.delete(client);
    }
  }

  /**
   * Push an update to everyone. `build(client)` makes the payload for that
   * particular client, which is how the big screen, the phones and the host
   * each get a different view of the same moment.
   */
  broadcast(event, build) {
    for (const client of this.clients) {
      this.send(client, event, build(client));
    }
  }

  ping() {
    for (const client of this.clients) {
      try {
        client.res.write(': ping\n\n');
      } catch {
        this.clients.delete(client);
      }
    }
  }

  count(role) {
    if (!role) return this.clients.size;
    let n = 0;
    for (const c of this.clients) if (c.role === role) n++;
    return n;
  }

  closeAll() {
    clearInterval(this.heartbeat);
    for (const client of this.clients) {
      try {
        client.res.end();
      } catch {
        /* already gone */
      }
    }
    this.clients.clear();
  }
}
