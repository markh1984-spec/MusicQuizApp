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
 * There are two. The code and the packs go in the main one. Photos of members
 * of the public go in a **separate private** one, because the main repo is
 * public and git history is forever — see PHOTO_REPO.
 *
 * @param {'app'|'photos'} which
 */
function settings(which = 'app') {
  const isPhotos = which === 'photos';
  const repo = (isPhotos ? process.env.PHOTO_REPO : process.env.GITHUB_REPO) || '';
  const [owner, name] = repo.split('/');
  if (!owner || !name) {
    throw new Error(`${isPhotos ? 'PHOTO_REPO' : 'GITHUB_REPO'} should look like "owner/repository"`);
  }
  return {
    owner,
    name,
    branch: isPhotos
      // New GitHub repos default to main; the quiz repo is the odd one out.
      ? (process.env.PHOTO_BRANCH || 'main')
      : (process.env.GITHUB_BRANCH || 'MusicQuizApp'),
    // A separate token is allowed but not required — one token can reach both.
    token: (isPhotos && process.env.PHOTO_TOKEN) || process.env.GITHUB_TOKEN,
  };
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
  const ready = which === 'photos' ? photosRepoConfigured() : githubConfigured();
  if (!ready) return { ok: false, error: `${which === 'photos' ? 'The photo repository' : 'GitHub backup'} is not set up` };
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

export async function deleteFile(filePath, message, which = 'app') {
  const ready = which === 'photos' ? photosRepoConfigured() : githubConfigured();
  if (!ready) return { ok: false, error: 'not set up' };
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
  const ready = which === 'photos' ? photosRepoConfigured() : githubConfigured();
  if (!ready) return { ok: false, error: 'not set up' };
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
