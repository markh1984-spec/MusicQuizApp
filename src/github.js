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

function settings() {
  const repo = process.env.GITHUB_REPO || '';
  const [owner, name] = repo.split('/');
  if (!owner || !name) throw new Error('GITHUB_REPO should look like "owner/repository"');
  return {
    owner,
    name,
    branch: process.env.GITHUB_BRANCH || 'MusicQuizApp',
    token: process.env.GITHUB_TOKEN,
  };
}

async function api(path, options = {}) {
  const { token } = settings();
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
async function shaOf(filePath) {
  const { owner, name, branch } = settings();
  const res = await api(`/repos/${owner}/${name}/contents/${encodeURI(filePath)}?ref=${encodeURIComponent(branch)}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GitHub ${res.status}: ${(await res.text()).slice(0, 160)}`);
  const data = await res.json();
  return data.sha || null;
}

/**
 * Create or update a file.
 * @returns {{ok: boolean, url?: string, error?: string}}
 */
export async function putFile(filePath, contents, message) {
  if (!githubConfigured()) return { ok: false, error: 'GitHub backup is not set up' };
  try {
    const { owner, name, branch } = settings();
    const sha = await shaOf(filePath);
    const res = await api(`/repos/${owner}/${name}/contents/${encodeURI(filePath)}`, {
      method: 'PUT',
      body: JSON.stringify({
        // [skip render] stops the host redeploying, so filing a pack never
        // restarts the app while somebody is using it.
        message: `${message} [skip render]`,
        content: Buffer.from(contents, 'utf8').toString('base64'),
        branch,
        ...(sha ? { sha } : {}),
      }),
    });
    if (!res.ok) return { ok: false, error: `GitHub ${res.status}: ${(await res.text()).slice(0, 160)}` };
    const data = await res.json();
    return { ok: true, url: data.content?.html_url };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

export async function deleteFile(filePath, message) {
  if (!githubConfigured()) return { ok: false, error: 'GitHub backup is not set up' };
  try {
    const { owner, name, branch } = settings();
    const sha = await shaOf(filePath);
    if (!sha) return { ok: true, error: 'was not in the repository anyway' };
    const res = await api(`/repos/${owner}/${name}/contents/${encodeURI(filePath)}`, {
      method: 'DELETE',
      body: JSON.stringify({ message: `${message} [skip render]`, sha, branch }),
    });
    if (!res.ok) return { ok: false, error: `GitHub ${res.status}: ${(await res.text()).slice(0, 160)}` };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

/** A quick check that the token works and can write, for the console to show. */
export async function checkAccess() {
  if (!githubConfigured()) return { ok: false, error: 'not set up' };
  try {
    const { owner, name } = settings();
    const res = await api(`/repos/${owner}/${name}`);
    if (res.status === 401) return { ok: false, error: 'token rejected' };
    if (res.status === 404) return { ok: false, error: 'repository not found, or the token cannot see it' };
    if (!res.ok) return { ok: false, error: `GitHub ${res.status}` };
    const data = await res.json();
    if (data.permissions && data.permissions.push === false) {
      return { ok: false, error: 'token can read but not write' };
    }
    return { ok: true, repo: data.full_name };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}
