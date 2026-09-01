/**
 * Filing packs into GitHub so they survive.
 *
 * The app's own filesystem is thrown away every time the service restarts —
 * which on a free host includes waking from sleep. So a quiz generated on the
 * live site is real and playable, but temporary. This writes it into the
 * repository as well, which is the only permanent thing in the setup.
 *
 * Two deliberate choices:
 *
 *  1. **Commits say `[skip render]`.** Render reads that and does NOT redeploy,
 *     so filing a pack never restarts the app underneath you. The file sits in
 *     the repository until the next real deploy picks it up. Without this,
 *     generating a quiz would bounce the server, which is the last thing you
 *     want if anybody is connected.
 *
 *  2. **Failures never break the thing you were doing.** If GitHub is down or
 *     the token is wrong, you still get your pack on the running app — you just
 *     get told it was not backed up. Losing a backup is annoying; losing the
 *     quiz you just generated because the backup failed would be daft.
 *
 * Needs GITHUB_TOKEN (fine-grained, Contents: read and write, on this repo
 * only) and GITHUB_REPO ("owner/name"). GITHUB_BRANCH defaults to the branch
 * the app is deployed from.
 */

const API = 'https://api.github.com';

export function githubConfigured() {
  return Boolean(process.env.GITHUB_TOKEN && process.env.GITHUB_REPO);
}

export function missingGithubConfig() {
  return ['GITHUB_TOKEN', 'GITHUB_REPO'].filter((name) => !process.env[name]);
}

/**
 * Which repository we are talking to.
 *
 * There are two. The code and the packs go in the main one. Anything that must
 * never be public goes in a **separate private** one, because the main repo is
 * public and git history is forever — see PHOTO_REPO.
 *
 * "photos" and "private" are the same repository under two names. Photos of
 * members of the public were the first thing that needed it; invoices were the
 * second, and they carry customer addresses and the host's own bank details,
 * which is if anything a worse thing to commit to a public repo by accident.
 * One private repo is enough, and one is easier to explain than two.
 *
 * And a THIRD, for a thing that is nobody's business but the quizmaster's:
 * **their own packs**. Those are their intellectual property, not stock in the
 * owner's catalogue, so they do not go in the public repo (obviously) and they
 * do not go in the owner's private one either — that file holds the owner's
 * accounts, invoices and customer records, and mixing somebody else's work into
 * the owner's business records is the wrong boundary however careful everyone
 * is. `PACKS_REPO` is its own private repository, filed one folder per room.
 *
 * Be honest about what this is and is not. It does not put a subscriber's packs
 * beyond the owner's reach — the owner runs the server, the disk and the
 * backups, and the server has to be able to read a quiz to put it on a
 * projector. It keeps their work in its own place, where "these are Rob's" is
 * something you can see rather than something you have to trust, and it is what
 * makes the app's own refusal (own-packs.js) worth anything on a host that
 * wipes its disk every deploy.
 *
 * @param {'app'|'photos'|'private'|'packs'} which
 */
function settings(which = 'app') {
  const isPacks = which === 'packs';
  const isPrivate = which === 'photos' || which === 'private';
  const variable = isPacks ? 'PACKS_REPO' : isPrivate ? 'PHOTO_REPO' : 'GITHUB_REPO';
  const repo = process.env[variable] || '';
  const [owner, name] = repo.split('/');
  if (!owner || !name) {
    throw new Error(`${variable} should look like "owner/repository"`);
  }
  return {
    owner,
    name,
    branch: isPacks
      ? (process.env.PACKS_BRANCH || 'main')
      : isPrivate
        // New GitHub repos default to main; the quiz repo is the odd one out.
        ? (process.env.PHOTO_BRANCH || 'main')
        : (process.env.GITHUB_BRANCH || 'MusicQuizApp'),
    // A separate token is allowed but not required — one token can reach all
    // three, and asking for three is three things to get wrong at midnight.
    token: (isPacks && process.env.PACKS_TOKEN)
      || (isPrivate && process.env.PHOTO_TOKEN)
      || process.env.GITHUB_TOKEN,
  };
}

/**
 * Is the repository this call needs actually set up?
 *
 * One function rather than the same ternary written out at every call site,
 * which is how `packs` would otherwise have been silently treated as the app
 * repo — a subscriber's quiz committed to the PUBLIC one. Worth the five lines.
 */
function readyFor(which) {
  if (which === 'packs') return packsRepoConfigured();
  if (which === 'photos' || which === 'private') return photosRepoConfigured();
  return githubConfigured();
}

/**
 * The repository a quizmaster's own packs are filed in.
 *
 * Deliberately has NO fallback to the private repo. Falling back would quietly
 * put somebody else's work in with the owner's books the day the variable was
 * missing, and nothing on screen would say so — the console says it is not set
 * up instead, which is a thing the host can fix.
 */
export function packsRepoConfigured() {
  return Boolean(process.env.PACKS_REPO && (process.env.PACKS_TOKEN || process.env.GITHUB_TOKEN));
}

export function packsRepoName() {
  return process.env.PACKS_REPO || '';
}

/** The private repo, by its other name. Same repo, different reason for it. */
export function privateRepoConfigured() {
  return photosRepoConfigured();
}

export function photosRepoConfigured() {
  return Boolean(process.env.PHOTO_REPO && (process.env.PHOTO_TOKEN || process.env.GITHUB_TOKEN));
}

export function photosRepoName() {
  return process.env.PHOTO_REPO || '';
}

/**
 * Which photo variables are missing, by name.
 *
 * "It says temporary" is not a diagnosis. Saying *which* variable the app
 * cannot see turns it into one — and on a host where the settings page has a
 * project level and a service level that look alike, "I definitely set it" and
 * "the app can see it" are genuinely different things.
 */
export function missingPhotoConfig() {
  const missing = [];
  if (!process.env.PHOTO_REPO) missing.push('PHOTO_REPO');
  if (!process.env.PHOTO_TOKEN && !process.env.GITHUB_TOKEN) missing.push('PHOTO_TOKEN or GITHUB_TOKEN');
  return missing;
}

/** A value that is set but malformed is its own problem, and worth naming. */
export function photoRepoProblem() {
  const repo = process.env.PHOTO_REPO;
  if (!repo) return null;
  const trimmed = repo.trim();
  if (trimmed !== repo) return 'PHOTO_REPO has a space at the start or end of it.';
  if (trimmed.startsWith('http')) return 'PHOTO_REPO should be owner/name, not a full web address.';
  const parts = trimmed.split('/');
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    return `PHOTO_REPO should look like owner/name — it is currently "${trimmed}".`;
  }
  if (trimmed.endsWith('.git')) return 'PHOTO_REPO should not end in .git.';
  return null;
}

async function api(path, options = {}, which = 'app') {
  const { token } = settings(which);
  const res = await fetch(API + path, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
      'User-Agent': 'musicquiz',
      ...(options.headers || {}),
    },
  });
  return res;
}

/**
 * ---- THE SHA WE LAST WROTE, PER FILE -----------------------------------
 *
 * **A `PUT` HANDS BACK THE FILE'S NEW SHA, AND THAT IS THE ONLY COPY OF IT
 * NOBODY CAN SERVE STALE.** Reading it back is a different question with the
 * same-looking answer, and the two came apart on a live console:
 *
 *     GitHub 409: photos/…/published.json does not match 50979a2a…
 *
 * — sent by an app whose writes to that file are already serialised one at a
 * time per room, with nothing else in the codebase writing it. So the sha was
 * not RACED, it was STALE: the Contents API is served from a replica and
 * through a cache, so a `GET` moments after a `PUT` that already answered 200
 * can hand back the version before it. Flicking lamps down a night is exactly
 * the shape that hits it — the writes land back to back with no gap at all.
 *
 * **Remembering it is also a call cheaper**, on an API this app has already
 * spent a day fitting inside 5,000 an hour: a remembered sha is a write with
 * no read in front of it.
 *
 * **IT IS A CACHE, SO IT HAS TO BE ABLE TO BE WRONG.** Anything editing the
 * file from outside this process — the host in GitHub's own web editor, which
 * `published.json` invites — moves the sha underneath us. That is what the
 * 409 retry below is for: forget, read FRESH, and go again once. Belt and
 * braces, because either half alone still fails.
 */
const lastSha = new Map();
const shaKey = (which, filePath) => `${which}:${filePath}`;

/** Drop what we remember about a path, whenever we can no longer vouch for it. */
function forgetSha(which, filePath) {
  lastSha.delete(shaKey(which, filePath));
}

/**
 * The current sha of a file, or null if it is not there yet.
 *
 * `fresh` asks GitHub to skip its caches — used on the retry after a 409,
 * where a cached body is precisely the thing that would make the retry fail
 * the same way.
 */
async function shaOf(filePath, which = 'app', { fresh = false } = {}) {
  const { owner, name, branch } = settings(which);
  const bust = fresh ? `&_=${Date.now()}` : '';
  const res = await api(
    `/repos/${owner}/${name}/contents/${encodeURI(filePath)}?ref=${encodeURIComponent(branch)}${bust}`,
    fresh ? { headers: { 'Cache-Control': 'no-cache' } } : {},
    which,
  );
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GitHub ${res.status}: ${(await res.text()).slice(0, 160)}`);
  const data = await res.json();
  return data.sha || null;
}

/**
 * Create or update a file.
 * @returns {{ok: boolean, url?: string, error?: string}}
 */
export async function putFile(filePath, contents, message, which = 'app') {
  if (!readyFor(which)) {
    const named = which === 'packs' ? 'The packs repository'
      : (which === 'photos' || which === 'private') ? 'The private repository'
        : 'GitHub backup';
    return { ok: false, error: `${named} is not set up` };
  }
  const key = shaKey(which, filePath);
  try {
    const { owner, name, branch } = settings(which);
    const bytes = (Buffer.isBuffer(contents) ? contents : Buffer.from(contents, 'utf8')).toString('base64');
    const send = (sha) => api(`/repos/${owner}/${name}/contents/${encodeURI(filePath)}`, {
      method: 'PUT',
      body: JSON.stringify({
        // [skip render] stops the host redeploying, so filing a pack never
        // restarts the app while somebody is using it.
        message: `${message} [skip render]`,
        // A Buffer goes up as-is. Running a PNG through utf8 would replace
        // every byte that is not valid utf8 and file a corrupt image.
        content: bytes,
        branch,
        ...(sha ? { sha } : {}),
      }),
    }, which);

    // The sha we last wrote beats reading one back — see `lastSha` above.
    let sha = lastSha.has(key) ? lastSha.get(key) : await shaOf(filePath, which);
    let res = await send(sha);

    /*
     * A 409 MEANS THE SHA WE SENT IS NOT THE ONE ON THE BRANCH, AND IT IS
     * WORTH EXACTLY ONE MORE GO. Whatever made it stale — a replica behind, a
     * cached body, somebody editing the file in GitHub's web editor — has
     * already happened, so the fix is the same: forget, read past the caches,
     * write again. Retrying FOREVER would be wrong; a file genuinely being
     * written by two people wants to be reported, not fought over.
     */
    if (res.status === 409) {
      forgetSha(which, filePath);
      sha = await shaOf(filePath, which, { fresh: true });
      res = await send(sha);
    }

    if (!res.ok) {
      // We no longer know what is on the branch, so the next write reads.
      forgetSha(which, filePath);
      const body = (await res.text()).slice(0, 160);
      // SAY WHAT A 409 ACTUALLY MEANS. GitHub's own words are a sha and a
      // documentation URL, which on the console's error line is a wall of
      // JSON that names no cause and suggests no action.
      if (res.status === 409) {
        return { ok: false, error: 'That file was changed by something else a moment ago. Try again.' };
      }
      return { ok: false, error: `GitHub ${res.status}: ${body}` };
    }
    const data = await res.json();
    /*
     * REMEMBER IT ONLY IF GITHUB ACTUALLY SAID ONE. A response shape we did
     * not expect must leave the next write reading the sha, never writing with
     * `undefined` — which GitHub reads as "create this file" and refuses on a
     * file that exists.
     */
    if (data.content?.sha) lastSha.set(key, data.content.sha);
    else forgetSha(which, filePath);
    return { ok: true, url: data.content?.html_url };
  } catch (err) {
    forgetSha(which, filePath);
    return { ok: false, error: err.message };
  }
}

/**
 * Put a whole batch of files up as ONE commit.
 *
 * **This exists because `putFile` in a loop is what truncated a picture
 * round.** Ten portraits were asked for, seven arrived, and pressing again
 * finished the rest — because every picture was a separate commit, and a
 * commit through the Contents API is TWO sequential round trips (read the
 * sha, then write). Ten pictures is twenty GitHub calls threaded in between
 * ten Google calls, which makes the job several times longer than the drawing
 * and puts the whole thing well inside the range where something between the
 * app and the browser hangs up. The ledger already had this written down —
 * *"a quiz is twenty-odd calls and that would be twenty commits for one press
 * of one button"* — and the artwork was doing exactly that.
 *
 * The Git Data API instead: **blobs go up in parallel**, then one tree, one
 * commit, one ref move. Five round trips plus the blobs, and the history gets
 * "Round 2 pictures: 10 of them" rather than ten lines saying the same thing.
 *
 * **Nothing here is allowed to throw**, same as `putFile` — every caller
 * treats a failed backup as a line in the log rather than as a reason to lose
 * what was just made. An empty list is an `ok` no-op rather than an empty
 * commit, because "nothing to file" is the ordinary case for a quiz with no
 * picture round.
 *
 * @param {Array<{path: string, contents: Buffer|string}>} files
 * @param {string} message
 * @param {'app'|'photos'|'private'|'packs'} [which]
 * @returns {Promise<{ok: boolean, count?: number, error?: string}>}
 */
export async function putFiles(files, message, which = 'app') {
  const list = (files || []).filter((f) => f && f.path);
  if (!list.length) return { ok: true, count: 0 };
  if (!readyFor(which)) {
    const named = which === 'packs' ? 'The packs repository'
      : (which === 'photos' || which === 'private') ? 'The private repository'
        : 'GitHub backup';
    return { ok: false, error: `${named} is not set up` };
  }
  try {
    const { owner, name, branch } = settings(which);
    const repo = `/repos/${owner}/${name}`;
    const ask = async (path, options) => {
      const res = await api(path, options, which);
      if (!res.ok) throw new Error(`GitHub ${res.status}: ${(await res.text()).slice(0, 160)}`);
      return res.json();
    };

    // Where the branch is now. Everything below is built on top of this, so a
    // push landing in between is the one thing that would make the commit drop
    // somebody else's work — hence the ref update at the end is NOT forced.
    const ref = await ask(`${repo}/git/ref/heads/${encodeURIComponent(branch)}`);
    const head = ref.object.sha;

    // In parallel: this is the whole reason for the change. A picture is a
    // few hundred KB and the requests are independent.
    const blobs = await Promise.all(list.map(async (file) => {
      const bytes = Buffer.isBuffer(file.contents) ? file.contents : Buffer.from(file.contents, 'utf8');
      const blob = await ask(`${repo}/git/blobs`, {
        method: 'POST',
        body: JSON.stringify({ content: bytes.toString('base64'), encoding: 'base64' }),
      });
      // 100644 is an ordinary file. A tree entry with a sha REPLACES whatever
      // is at that path, so this updates and creates with one shape and needs
      // no per-file read of the existing sha — which is the other round trip
      // `putFile` has to make.
      return { path: file.path, mode: '100644', type: 'blob', sha: blob.sha };
    }));

    const tree = await ask(`${repo}/git/trees`, {
      method: 'POST',
      body: JSON.stringify({ base_tree: head, tree: blobs }),
    });
    const commit = await ask(`${repo}/git/commits`, {
      method: 'POST',
      // [skip render] for the same reason `putFile` carries it: filing what a
      // generation made must never redeploy the app while a night is on.
      body: JSON.stringify({ message: `${message} [skip render]`, tree: tree.sha, parents: [head] }),
    });
    await ask(`${repo}/git/refs/heads/${encodeURIComponent(branch)}`, {
      method: 'PATCH',
      body: JSON.stringify({ sha: commit.sha }),
    });
    /*
     * A BATCH MOVES FILES `putFile` MAY BE REMEMBERING THE SHA OF, so it has
     * to forget them — a remembered sha that a commit has just superseded is
     * the exact fault this whole mechanism exists to stop, arriving by the
     * other door.
     */
    for (const file of list) forgetSha(which, file.path);
    return { ok: true, count: list.length };
  } catch (err) {
    for (const file of list) forgetSha(which, file.path);
    return { ok: false, error: err.message };
  }
}

/**
 * Read a file back out of a repository.
 *
 * The other half of `putFile`, and it was missing — which meant the accounts
 * and the invoice book were backed up faithfully and then never read again.
 * On a host with no permanent disk that is the same as not backing them up at
 * all: the file goes to GitHub, the disk is wiped on the next deploy, and the
 * login you made last week has quietly stopped existing.
 *
 * Returns null rather than throwing when there is nothing there. A first boot
 * with no backup yet is the normal case, not an error.
 */
export async function getFile(filePath, which = 'app') {
  if (!readyFor(which)) return null;
  try {
    const { owner, name, branch } = settings(which);
    const res = await api(`/repos/${owner}/${name}/contents/${encodeURI(filePath)}?ref=${encodeURIComponent(branch)}`, {}, which);
    if (!res.ok) return null;
    const data = await res.json();
    if (!data || typeof data.content !== 'string') return null;
    return Buffer.from(data.content, 'base64');
  } catch {
    return null;
  }
}

/**
 * What is in a folder, so a whole library can be brought back rather than one
 * file whose name you already knew.
 *
 * Every other restore in this app reads one file at a fixed name — the
 * accounts, the invoices, the reports. A quizmaster's own packs are a FOLDER of
 * unknown names, so restoring them needs this. Empty array rather than a throw
 * when the folder is not there: a subscriber who has written nothing yet is the
 * normal case, not a failure.
 */
export async function listDir(dirPath, which = 'app') {
  if (!readyFor(which)) return [];
  try {
    const { owner, name, branch } = settings(which);
    const res = await api(`/repos/${owner}/${name}/contents/${encodeURI(dirPath)}?ref=${encodeURIComponent(branch)}`, {}, which);
    if (!res.ok) return [];
    const data = await res.json();
    if (!Array.isArray(data)) return [];
    return data
      .filter((entry) => entry && entry.type === 'file')
      .map((entry) => ({ name: entry.name, path: entry.path }));
  } catch {
    return [];
  }
}

/**
 * The FOLDERS in a folder, which `listDir` deliberately throws away.
 *
 * Past gigs needs this and nothing else does: photos are filed one folder per
 * night, and the list of nights somebody has run is exactly the list of folder
 * names. Keeping it a separate function rather than a flag on `listDir` means
 * every existing caller carries on getting files and only files — a restore
 * that suddenly started copying directory entries into a pack folder would be
 * a quiet mess.
 */
export async function listDirs(dirPath, which = 'app') {
  if (!readyFor(which)) return [];
  try {
    const { owner, name, branch } = settings(which);
    const res = await api(`/repos/${owner}/${name}/contents/${encodeURI(dirPath)}?ref=${encodeURIComponent(branch)}`, {}, which);
    if (!res.ok) return [];
    const data = await res.json();
    if (!Array.isArray(data)) return [];
    return data
      .filter((entry) => entry && entry.type === 'dir')
      .map((entry) => ({ name: entry.name, path: entry.path }));
  } catch {
    return [];
  }
}

export async function deleteFile(filePath, message, which = 'app') {
  if (!readyFor(which)) return { ok: false, error: 'not set up' };
  /*
   * A DELETED FILE HAS NO SHA, so whatever `putFile` remembers about this path
   * is wrong from here on — whether the delete works or not. Forgotten UP
   * FRONT rather than on the way out, because the read below must not be
   * answered from a memory of a file we are about to remove.
   */
  forgetSha(which, filePath);
  try {
    const { owner, name, branch } = settings(which);
    const sha = await shaOf(filePath, which);
    if (!sha) return { ok: true, error: 'was not in the repository anyway' };
    const res = await api(`/repos/${owner}/${name}/contents/${encodeURI(filePath)}`, {
      method: 'DELETE',
      body: JSON.stringify({ message: `${message} [skip render]`, sha, branch }),
    }, which);
    if (!res.ok) return { ok: false, error: `GitHub ${res.status}: ${(await res.text()).slice(0, 160)}` };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

/** A quick check that the token works and can write, for the console to show. */
export async function checkAccess(which = 'app') {
  if (!readyFor(which)) return { ok: false, error: 'not set up' };
  try {
    const { owner, name } = settings(which);
    const res = await api(`/repos/${owner}/${name}`, {}, which);
    if (res.status === 401) return { ok: false, error: 'token rejected' };
    if (res.status === 404) return { ok: false, error: 'repository not found, or the token cannot see it' };
    if (!res.ok) return { ok: false, error: `GitHub ${res.status}` };
    const data = await res.json();
    if (data.permissions && data.permissions.push === false) {
      return { ok: false, error: 'token can read but not write' };
    }
    // Worth surfacing for the photo repo: a public one would be the wrong
    // place for pictures of the public, and it is an easy tick to miss.
    return { ok: true, repo: data.full_name, private: data.private === true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}
