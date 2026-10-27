// Creates the demo repo's labels and issues from issues.json.
// Usage: GITHUB_TOKEN=... node demo/seed-demo-issues.mjs [--dry-run]
// Run it once, on a fresh repo: issue numbers follow the order in the file.
import { readFileSync } from 'node:fs';

const spec = JSON.parse(readFileSync(new URL('./issues.json', import.meta.url), 'utf8'));
const dry = process.argv.includes('--dry-run');
const token = process.env.GITHUB_TOKEN;
if (!dry && !token) {
  console.error('Set GITHUB_TOKEN (a token that can write to the demo repo), or pass --dry-run.');
  process.exit(1);
}

async function gh(method, path, body) {
  if (dry) {
    console.log(`[dry-run] ${method} ${path}${body?.title ? `  "${body.title}"` : body?.name ? `  ${body.name}` : ''}`);
    return { number: 0 };
  }
  const res = await fetch(`https://api.github.com${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'User-Agent': 'oss-tokens-demo-seed', 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok && !(res.status === 422 && path.endsWith('/labels'))) {
    const hint = {
      401: 'GitHub rejected the token (typo, expired or deleted). Make a new one.',
      403: 'The token is not allowed to do this, or you hit a rate limit.',
      404: 'The token works but has no write access to this repo. Use a classic token with the "public_repo" scope (https://github.com/settings/tokens/new?scopes=public_repo&description=oss-tokens), or give a fine-grained token "Issues: read and write" on this repo.',
    }[res.status] || '';
    throw new Error(`${method} ${path}: ${res.status} ${data.message}${hint ? `\n${hint}` : ''}`);
  }
  return data;
}

const base = `/repos/${spec.repo}`;
try {
  for (const label of spec.labels) await gh('POST', `${base}/labels`, label); // 422 = exists already
  for (const issue of spec.issues) {
    const created = await gh('POST', `${base}/issues`, { title: issue.title, body: issue.body, labels: issue.labels });
    if (issue.maintainer_comment) await gh('POST', `${base}/issues/${created.number}/comments`, { body: issue.maintainer_comment });
    if (issue.close) await gh('PATCH', `${base}/issues/${created.number}`, { state: 'closed', state_reason: issue.close });
    console.log(`#${created.number} ${issue.title}`);
  }
} catch (err) {
  console.error(`Error: ${err.message}`);
  process.exitCode = 1;
}
