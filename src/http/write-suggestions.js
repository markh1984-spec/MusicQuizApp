/**
 * WRITE ROUTES — suggestions. Moved whole out of `handleWrite()` in server.js;
 * the body is unchanged, it is one of the functions the shell tries in order.
 */
import { accounts, config, draftReply, mostlyMine, spend, spendRecorder, suggestions } from './context.js';
import { readJson, sendJson } from './plumbing.js';
import { whoIs } from './identity.js';
import { backUpSpend, backUpSuggestions, firstNameOf } from './helpers.js';

export async function writeSuggestions(req, res, url, route) {
  /*
   * Draft a reply, for a human to read and edit. It NEVER sends.
   *
   * An AI reply that goes out unread is the one that goes publicly wrong —
   * apologising for something that did not happen, or promising a feature that
   * is not being built. This saves the blank page and nothing else.
   */
  if (route.startsWith('/api/suggestions/') && route.endsWith('/draft') && req.method === 'POST') {
    const me = whoIs(req, url);
    if (!me || (me.role !== 'owner' && !me.bootstrap)) {
      return sendJson(res, 403, { error: 'Owners only.' }), true;
    }
    const id = decodeURIComponent(route.slice('/api/suggestions/'.length, -'/draft'.length));
    const item = suggestions.find(id);
    if (!item) return sendJson(res, 404, { error: 'No such suggestion' }), true;
    try {
      const text = await draftReply({
        suggestion: item,
        apiKey: process.env.ANTHROPIC_API_KEY,
        ownerName: firstNameOf(accounts.owner) || 'Mark',
        appName: config.appName,
        // 1. What the owner has taught it, from the box on their own page.
        house: suggestions.house,
        // 2. Who wrote in, and what else they have sent — the difference
        //    between a plausible reply and one that could only be about them.
        account: accounts.find(item.byId),
        history: suggestions.forAccount(item.byId).filter((x) => x.id !== item.id),
        // 3. How the owner has answered before. The only part that gets better
        //    on its own: every reply sent is another example of their voice.
        past: suggestions.everyReply(),
        onSpend: spendRecorder(spend, { packId: '' }),
      });
      backUpSpend();
      return sendJson(res, 200, { ok: true, draft: text }), true;
    } catch (err) {
      return sendJson(res, 400, { error: err.message }), true;
    }
  }

  // Sending it. Stored on the thread and shown to whoever wrote in, and it
  // clears the item by default — an inbox where answering something leaves it
  // sitting there is one you stop trusting.
  if (route.startsWith('/api/suggestions/') && route.endsWith('/reply') && req.method === 'POST') {
    const me = whoIs(req, url);
    if (!me || (me.role !== 'owner' && !me.bootstrap)) {
      return sendJson(res, 403, { error: 'Owners only.' }), true;
    }
    const id = decodeURIComponent(route.slice('/api/suggestions/'.length, -'/reply'.length));
    const body = await readJson(req);
    /*
     * Was this the owner's writing, or the draft sent as it came?
     *
     * The browser sends back the draft it was given, and the two are compared.
     * Anything largely machine-written is stored as such and kept OUT of the
     * voice examples — otherwise the drafting model learns from its own output
     * and drifts a little further from the owner every time.
     */
    const result = suggestions.reply(id, body.text, {
      by: firstNameOf(accounts.owner) || 'Mark',
      clear: body.clear !== false,
      machine: !mostlyMine(body.text, body.draft),
    });
    if (!result.ok) return sendJson(res, 400, { error: result.error }), true;
    backUpSuggestions();
    return sendJson(res, 200, {
      ok: true, suggestions: suggestions.all, summary: suggestions.summary(),
    }), true;
  }

  /*
   * The owner's notes for the drafting model.
   *
   * This is how the drafts actually improve: every time one says something
   * wrong, a line goes in here and it stops saying it. Nothing else in the app
   * teaches it anything, so it is worth being easy to edit.
   */
  if (route === '/api/suggestions/house' && req.method === 'PUT') {
    const me = whoIs(req, url);
    if (!me || (me.role !== 'owner' && !me.bootstrap)) {
      return sendJson(res, 403, { error: 'Owners only.' }), true;
    }
    const body = await readJson(req);
    const house = suggestions.setHouse(body.house);
    backUpSuggestions();
    return sendJson(res, 200, { ok: true, house }), true;
  }

  // Dealt with, reopened, or binned. The owner's, like reading them.
  if (route.startsWith('/api/suggestions/') && (req.method === 'POST' || req.method === 'DELETE')) {
    const me = whoIs(req, url);
    if (!me || (me.role !== 'owner' && !me.bootstrap)) {
      return sendJson(res, 403, { error: 'Owners only.' }), true;
    }
    const id = decodeURIComponent(route.slice('/api/suggestions/'.length));
    if (req.method === 'DELETE') {
      if (!suggestions.remove(id)) return sendJson(res, 404, { error: 'No such suggestion' }), true;
    } else {
      const body = await readJson(req);
      if (!suggestions.setStatus(id, String(body.status || ''))) {
        return sendJson(res, 400, { error: 'That is not a status.' }), true;
      }
    }
    backUpSuggestions();
    return sendJson(res, 200, { ok: true, suggestions: suggestions.all, summary: suggestions.summary() }), true;
  }

  return false;
}
