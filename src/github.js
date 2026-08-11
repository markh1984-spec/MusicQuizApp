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

/** The current sha of a file, or null if it is not there yet. */
async function shaOf(filePath, which = 'app') {
  const { owner, name, branch } = settings(which);
  const res = await api(`/repos/${owner}/${name}/contents/${encodeURI(filePath)}?ref=${encodeURIComponent(branch)}`, {}, which);
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
  try {
    const { owner, name, branch } = settings(which);
    const sha = await shaOf(filePath, which);
    const res = await api(`/repos/${owner}/${name}/contents/${encodeURI(filePath)}`, {
      method: 'PUT',
      body: JSON.stringify({
        // [skip render] stops the host redeploying, so filing a pack never
        // restarts the app while somebody is using it.
        message: `${message} [skip render]`,
        // A Buffer goes up as-is. Running a PNG through utf8 would replace
        // every byte that is not valid utf8 and file a corrupt image.
        content: (Buffer.isBuffer(contents) ? contents : Buffer.from(contents, 'utf8')).toString('base64'),
        branch,
        ...(sha ? { sha } : {}),
      }),
    }, which);
    if (!res.ok) return { ok: false, error: `GitHub ${res.status}: ${(await res.text()).slice(0, 160)}` };
    const data = await res.json();
    return { ok: true, url: data.content?.html_url };
  } catch (err) {
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

export async function deleteFile(filePath, message, which = 'app') {
  if (!readyFor(which)) return { ok: false, error: 'not set up' };
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
