/**
 * THE PUBLIC LEAGUE TABLE — the page the regulars check between quizzes.
 *
 * Asked for on 25 August 2026, alongside putting the season on the landlord's
 * report: *"can that be exported to the landlord and the quiz teams to view?"*
 * Those are two audiences and they wanted two things — the landlord wants
 * evidence in a document he already receives, and the teams want the table on
 * a wall. This is the second one.
 *
 * ---
 *
 * **IT HOLDS NOTHING AND ASKS FOR EVERYTHING.** A team has no account and
 * never will — a phone proves nothing beyond the night it is playing, and
 * asking a pub team to register would kill the thing at the door. So the page
 * fetches and renders, exactly as the gallery does.
 *
 * **WHICH VENUES APPEAR IS DECIDED ON THE SERVER**, in `league-publish.js`,
 * and this file could not show an unpublished one if it tried. That is the
 * only way a gate is worth anything.
 *
 * **NAMES, POINTS AND THE NEXT DATE — NO FACES.** The table carries a
 * `faceKey` per team so the console can draw one; the server does not send it
 * here. A face is a photograph of somebody in a pub and the consent it was
 * given under is the big screen.
 *
 * **AND THE NEXT QUIZ IS THE POINT OF THE PAGE.** The host chose it over the
 * faces: a team lying fourth wants to know when it can do something about it,
 * so the date is drawn as the loudest thing under each table rather than a
 * footnote. It writes itself out of the venue's usual night, exactly as the
 * projector's own comeback slide does, so there is nothing to keep current.
 */

import { esc, node, brandMark, brandWords } from './client.js';

const body = document.getElementById('lgBody');
const sub = document.getElementById('lgSub');

/*
 * THE HOST KEY AND THE ROOM, READ FROM THIS VISIT'S ADDRESS — never from
 * localStorage, the rule this app already follows for links, so a remembered
 * key cannot spread onto a page a customer might share. Both are no-ops on a
 * regular's link, which carries neither.
 *
 * The key is what makes the OWNER PREVIEW work: signed in or on a `?key=`
 * link, the server also sends venues that are not published yet, marked — so
 * the whole path can be proved before one team name goes public. That is the
 * gallery's own hard-won lesson, applied here from the start rather than
 * after somebody found the preview silently failing.
 */
const KEY = new URLSearchParams(location.search).get('key') || '';
const Q = new URLSearchParams(location.search).get('q') || '';
const keyed = (path) => {
  let out = path;
  if (KEY) out += (out.includes('?') ? '&' : '?') + 'key=' + encodeURIComponent(KEY);
  if (Q) out += (out.includes('?') ? '&' : '?') + 'q=' + encodeURIComponent(Q);
  return out;
};

// `innerHTML`, because `brandMark()`/`brandWords()` return HTML STRINGS and
// `append()` would print the SVG source across the top of the page — which is
// exactly what the gallery did once. Fails quietly: the page is the table.
fetch(keyed('/api/brand'))
  .then((r) => r.json())
  .then((d) => {
    const slot = document.getElementById('brand');
    if (slot) slot.innerHTML = `${brandMark(26)}${brandWords(d.name, d.appName || '')}`;
    // Whose league it is, said once, from the one endpoint that works that
    // name out. The league response deliberately does not carry it.
    if (d.name && sub) sub.textContent = `${d.name} — how the season stands.`;
  })
  .catch(() => {});

/** One venue's table, and when they can play the next one. */
function tableFor(league) {
  const rows = league.table || [];
  return `
    <section class="panel lgp-venue">
      <div class="lgp-head">
        <h2 class="lgp-where">${esc(league.venue)}</h2>
        <span class="tiny">${rows.length} team${rows.length === 1 ? '' : 's'}
          across ${league.nights} night${league.nights === 1 ? '' : 's'}</span>
        ${league.preview ? '<span class="pill lgp-draft">Not published</span>' : ''}
      </div>
      <table class="lg-table">
        <thead>
          <tr>
            <th class="lg-pos" aria-label="Position"></th>
            <th class="lg-name">Team</th>
            <th class="lg-played"><abbr title="Nights played">P</abbr></th>
            <th class="lg-played"><abbr title="Nights won">W</abbr></th>
            <th class="lg-pts"><abbr title="Points">Pts</abbr></th>
          </tr>
        </thead>
        <tbody>
          ${rows.map((t) => `
            <tr${t.position === 1 ? ' class="lg-top"' : ''}>
              <td class="lg-pos">${t.position}</td>
              <td class="lg-name">${esc(t.name)}</td>
              <td class="lg-played tiny">${t.played}</td>
              <td class="lg-played tiny">${t.wins}</td>
              <td class="lg-pts"><b>${t.points}</b></td>
            </tr>`).join('')}
        </tbody>
      </table>
      ${league.next
    ? `<p class="lgp-next"><b>${esc(league.next)}</b></p>`
    : ''}
    </section>`;
}

fetch(keyed('/api/league'))
  .then((r) => r.json())
  .then((d) => {
    const leagues = d.leagues || [];
    if (!leagues.length) {
      /*
       * NOTHING PUBLISHED READS AS "NOT YET", NEVER AS AN ERROR. A regular
       * who mistypes a link and a regular whose pub has not put its table up
       * get the same sentence, which is also what stops this page confirming
       * whether a given quizmaster exists.
       */
      body.replaceChildren(node(`
        <p class="muted">No league table is up here yet. Ask the quizmaster on the night —
          the table builds itself out of the quizzes you play.</p>`));
      return;
    }
    body.innerHTML = leagues.map(tableFor).join('')
      /*
       * THE IDENTIFICATION RULE, PRINTED ONCE. A team is the name typed on the
       * night, so a change of spelling starts a new team and a borrowed name
       * is the same team. Somebody reading their own position off this has to
       * know that — and it is the same sentence the console prints, because
       * pretending to a precision the app has not got is worse on the public
       * page than on the private one.
       */
      + `<p class="tiny lgp-note">Ten points for a win, one for turning up, over a rolling
        twelve-week season. You are the name you type on the night — spell it the same way
        each week and the points stack up.</p>`;
  })
  .catch(() => {
    body.replaceChildren(node('<p class="muted">The table could not be loaded just now.</p>'));
  });
