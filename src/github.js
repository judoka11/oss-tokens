// Minimal GitHub REST client. No gh CLI needed; a token is only required for
// writing (claims and results). Reading public issues works without one.
import { NPX } from './config.js';

const API = 'https://api.github.com';
const REPO_RE = /^[A-Za-z0-9-]{1,39}\/[A-Za-z0-9._-]{1,100}$/;

export function parseRepo(repo) {
  const value = String(repo || '').trim().replace(/^https:\/\/github\.com\//, '').replace(/\.git$/, '').replace(/\/+$/, '');
  if (!REPO_RE.test(value) || value.includes('..')) {
    throw new Error(`Not a GitHub repo in owner/name form: ${repo}`);
  }
  const [owner, name] = value.split('/');
  return { owner, name, full: `${owner}/${name}` };
}

export class GitHubError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

export class GitHub {
  constructor(token = null, { fetchImpl = globalThis.fetch } = {}) {
    this.token = token;
    this.fetch = fetchImpl;
  }

  async request(method, path, body = undefined) {
    const headers = {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'oss-tokens',
    };
    if (this.token) headers.Authorization = `Bearer ${this.token}`;
    if (body !== undefined) headers['Content-Type'] = 'application/json';

    const res = await this.fetch(`${API}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(30000),
    });
    const text = await res.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch { /* non-JSON error page */ }

    if (!res.ok) {
      let msg = data?.message || `GitHub API error ${res.status}`;
      if (res.status === 403 && res.headers.get('x-ratelimit-remaining') === '0') {
        msg = this.token
          ? 'GitHub rate limit reached. Wait a few minutes and try again.'
          : `GitHub rate limit reached for anonymous requests. Add a GitHub token (${NPX} init) to get a much higher limit.`;
      }
      throw new GitHubError(msg, res.status);
    }
    return data;
  }

  requireToken(action) {
    if (!this.token) {
      throw new GitHubError(`A GitHub token is needed to ${action}. Run \`${NPX} init\` to add one.`, 401);
    }
  }

  viewer() {
    this.requireToken('identify you');
    return this.request('GET', '/user');
  }

  searchIssues(query, perPage = 30) {
    const q = encodeURIComponent(query);
    return this.request('GET', `/search/issues?q=${q}&per_page=${perPage}&sort=updated&order=desc`);
  }

  getIssue(repo, number) {
    const { owner, name } = parseRepo(repo);
    return this.request('GET', `/repos/${owner}/${name}/issues/${Number(number)}`);
  }

  getRepo(repo) {
    const { owner, name } = parseRepo(repo);
    return this.request('GET', `/repos/${owner}/${name}`);
  }

  async listComments(repo, number, maxPages = 3) {
    const { owner, name } = parseRepo(repo);
    const all = [];
    for (let page = 1; page <= maxPages; page++) {
      const batch = await this.request('GET', `/repos/${owner}/${name}/issues/${Number(number)}/comments?per_page=100&page=${page}`);
      all.push(...batch);
      if (batch.length < 100) break;
    }
    return all;
  }

  getComment(repo, commentId) {
    const { owner, name } = parseRepo(repo);
    return this.request('GET', `/repos/${owner}/${name}/issues/comments/${Number(commentId)}`);
  }

  createComment(repo, number, body) {
    this.requireToken('post comments');
    const { owner, name } = parseRepo(repo);
    return this.request('POST', `/repos/${owner}/${name}/issues/${Number(number)}/comments`, { body });
  }

  // Returns the file's text, or null when it doesn't exist.
  async getFile(repo, path) {
    const { owner, name } = parseRepo(repo);
    try {
      const data = await this.request('GET', `/repos/${owner}/${name}/contents/${path}`);
      if (!data || data.type !== 'file' || data.encoding !== 'base64') return null;
      return Buffer.from(data.content, 'base64').toString('utf8');
    } catch (err) {
      if (err.status === 404) return null;
      throw err;
    }
  }
}
