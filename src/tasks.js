// Finding tasks: GitHub issue search + each repo's opt-in config.
import { TASK_TYPES } from './config.js';
import { fetchRepoConfig } from './repo-config.js';
import { NEED_TAGS, unmetNeeds } from './machine.js';
import { markerKind } from './claims.js';

// Who already posted an oss-tokens result on this issue.
export function resultsIn(comments) {
  return comments
    .filter(c => markerKind(c.body) === 'result' && c.user?.login)
    .map(c => ({ login: c.user.login, url: c.html_url, created_at: c.created_at }));
}

export const TASK_LABEL = 'ai-help-wanted';
const LANG_RE = /^[A-Za-z0-9+#.\- ]{1,40}$/;

// Task type from an `ai:<type>` label, else from the issue form's
// "### Task type" section. Returns null when neither names a known type.
export function taskTypeOf(issue) {
  for (const label of issue.labels || []) {
    const name = typeof label === 'string' ? label : label.name;
    const m = /^ai:(.+)$/.exec(name || '');
    if (m && TASK_TYPES.includes(m[1])) return m[1];
  }
  const m = /###\s*Task type\s*\n+\s*([a-z-]+)/i.exec(issue.body || '');
  if (m && TASK_TYPES.includes(m[1].toLowerCase())) return m[1].toLowerCase();
  return null;
}

// Hardware the task needs, from `ai-needs:<tag>` labels.
export function needsOf(issue) {
  const needs = [];
  for (const label of issue.labels || []) {
    const name = typeof label === 'string' ? label : label.name;
    const m = /^ai-needs:(.+)$/.exec(name || '');
    if (m && NEED_TAGS.includes(m[1])) needs.push(m[1]);
  }
  return needs;
}

// Search text for duplicates inside one repo. Qualifiers that could widen
// the search to other repos or users are dropped.
export function repoSearchQuery(repo, text, state = 'all') {
  const terms = String(text || '')
    .replace(/\b(repo|org|user|owner|in|is|label|author|involves):\S*/gi, ' ')
    .replace(/[^\p{L}\p{N}\s._'"-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 200);
  if (!terms) throw new Error('Give some words to search for, e.g. the error message.');
  const parts = [`repo:${repo}`, 'is:issue'];
  if (state !== 'all') parts.push(`is:${state}`);
  return `${parts.join(' ')} ${terms}`;
}

// Best fit first, with the reasons, so the agent can propose one task
// instead of making the user read a list. Plain rules, no model judgment:
// - hardware-tagged tasks this machine can run (few donors can do them)
// - no discussion yet (nobody else is on it, less to read)
// - the donor's task types, in the order they listed them
// - newest activity breaks ties
export function rankTasks(tasks, { taskTypes = TASK_TYPES } = {}) {
  const scored = tasks.map(t => {
    let score = 0;
    const why = [];
    if (t.needs?.length) { score += 3; why.push(`needs ${t.needs.join('+')}, which few donors have and this machine does`); }
    if (t.comments === 0) { score += 1; why.push('no discussion yet'); }
    const pref = taskTypes.indexOf(t.task_type);
    if (pref >= 0) score += (taskTypes.length - pref) * 0.25;
    if (pref === 0) why.push(`your first-choice task type (${t.task_type})`);
    return { ...t, score, why };
  });
  return scored.sort((a, b) => b.score - a.score || new Date(b.updated_at) - new Date(a.updated_at));
}

export function repoOf(issue) {
  // repository_url looks like https://api.github.com/repos/owner/name
  return issue.repository_url.split('/repos/')[1];
}

export function buildQuery({ language, repo } = {}) {
  const parts = [`label:${TASK_LABEL}`, 'is:issue', 'is:open', 'archived:false'];
  if (repo) parts.push(`repo:${repo}`);
  if (language) {
    if (!LANG_RE.test(language)) throw new Error(`Odd language name: ${language}`);
    parts.push(language.includes(' ') ? `language:"${language}"` : `language:${language}`);
  }
  return parts.join(' ');
}

// Returns tasks from opted-in repos whose type the repo allows and the
// donor wants. Repos without a valid config are reported, not hidden, so
// maintainers can see why their label isn't picked up.
export async function findTasks(gh, { languages = [], taskTypes = TASK_TYPES, repo = null, limit = 10, machine = null, includeDone = false } = {}) {
  const queries = languages.length ? languages.map(language => buildQuery({ language, repo })) : [buildQuery({ repo })];
  const seen = new Map();
  for (const q of queries) {
    const res = await gh.searchIssues(q, 50);
    for (const issue of res.items || []) {
      if (!issue.pull_request) seen.set(issue.html_url, issue);
    }
  }

  const tasks = [];
  const skippedRepos = {};
  let skippedForMachine = 0;
  let skippedDone = 0;
  for (const issue of seen.values()) {
    if (tasks.length >= limit) break;
    const fullName = repoOf(issue);
    const type = taskTypeOf(issue);
    if (!type || !taskTypes.includes(type)) continue;
    const needs = needsOf(issue);
    if (machine && unmetNeeds(needs, machine).length) {
      skippedForMachine++;
      continue;
    }
    const cfg = await fetchRepoConfig(gh, fullName);
    if (!cfg.ok) {
      skippedRepos[fullName] = cfg.error;
      continue;
    }
    if (!cfg.config.allowed_tasks.includes(type)) continue;
    // Only issues with comments can have a result; skip the lookup otherwise.
    const done = issue.comments > 0 && gh.listComments ? resultsIn(await gh.listComments(fullName, issue.number)) : [];
    if (done.length && !includeDone) {
      skippedDone++;
      continue;
    }
    tasks.push({
      repo: fullName,
      issue: issue.number,
      title: issue.title,
      task_type: type,
      needs,
      done_by: done.map(d => d.login),
      url: issue.html_url,
      comments: issue.comments,
      updated_at: issue.updated_at,
    });
  }
  return { tasks: rankTasks(tasks, { taskTypes }), skippedRepos, skippedForMachine, skippedDone };
}
