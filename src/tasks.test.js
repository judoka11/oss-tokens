import { test } from 'node:test';
import assert from 'node:assert/strict';
import { taskTypeOf, buildQuery, findTasks, needsOf, repoSearchQuery, rankTasks } from './tasks.js';

test('ranking: rare-hardware tasks, then quiet issues, then preferred types', () => {
  const t = (issue, task_type, comments, needs = [], updated_at = '2026-10-01') => ({ issue, task_type, comments, needs, updated_at });
  const ranked = rankTasks([
    t(1, 'docs', 5),
    t(2, 'repro', 0),
    t(3, 'triage', 0, ['windows']),
    t(4, 'repro', 4),
    t(5, 'repro', 0, [], '2026-10-20'),
  ], { taskTypes: ['repro', 'triage', 'docs'] });
  assert.deepEqual(ranked.map(x => x.issue), [3, 5, 2, 4, 1]);
  assert.match(ranked[0].why.join(), /needs windows/);
  assert.deepEqual(ranked[1].why, ['no discussion yet', 'your first-choice task type (repro)']);
});

test('hardware needs come from ai-needs labels', () => {
  assert.deepEqual(needsOf({ labels: [{ name: 'ai-needs:windows' }, { name: 'ai-needs:cuda' }, { name: 'ai-needs:quantum' }, { name: 'bug' }] }), ['windows', 'cuda']);
});

test('repo search cannot escape the repo', () => {
  assert.equal(repoSearchQuery('o/r', 'TypeError: cannot read'), 'repo:o/r is:issue TypeError cannot read');
  assert.equal(repoSearchQuery('o/r', 'x repo:evil/y org:z is:pr label:hack', 'closed'), 'repo:o/r is:issue is:closed x');
  assert.throws(() => repoSearchQuery('o/r', 'repo:evil/y'));
});

test('task type comes from an ai: label, else the issue form', () => {
  assert.equal(taskTypeOf({ labels: [{ name: 'bug' }, { name: 'ai:docs' }] }), 'docs');
  assert.equal(taskTypeOf({ labels: [], body: '### Task type\n\nfailing-test\n\n### Task\n...' }), 'failing-test');
  assert.equal(taskTypeOf({ labels: [{ name: 'ai:rewrite-it' }], body: '' }), null);
});

test('search query is scoped and rejects odd languages', () => {
  assert.equal(buildQuery({ language: 'Python' }), 'label:ai-help-wanted is:issue is:open archived:false language:Python');
  assert.match(buildQuery({ language: 'Jupyter Notebook' }), /language:"Jupyter Notebook"$/);
  assert.throws(() => buildQuery({ language: 'x" OR "y' }));
});

test('only opted-in repos and allowed task types come back', async () => {
  const issue = (repo, number, label) => ({
    repository_url: `https://api.github.com/repos/${repo}`, number, title: `t${number}`, html_url: `https://github.com/${repo}/issues/${number}`,
    labels: [{ name: 'ai-help-wanted' }, { name: label }], comments: 0,
  });
  const gh = {
    searchIssues: async () => ({ items: [issue('in/repo', 1, 'ai:repro'), issue('in/repo', 2, 'ai:docs'), issue('out/repo', 3, 'ai:repro')] }),
    getFile: async (repo) => (repo === 'in/repo' ? 'ai_help: true\nallowed_tasks: [repro]' : null),
  };
  const { tasks, skippedRepos } = await findTasks(gh, { taskTypes: ['repro', 'docs'] });
  assert.deepEqual(tasks.map(t => `${t.repo}#${t.issue}`), ['in/repo#1']);
  assert.ok(skippedRepos['out/repo']);
});

test('tasks that already have a result are hidden unless asked for', async () => {
  const issue = (number, comments) => ({
    repository_url: 'https://api.github.com/repos/in/repo', number, title: `t${number}`, html_url: `u${number}`, comments,
    labels: [{ name: 'ai-help-wanted' }, { name: 'ai:repro' }],
  });
  let lookups = 0;
  const gh = {
    searchIssues: async () => ({ items: [issue(1, 2), issue(2, 0)] }),
    getFile: async () => 'ai_help: true',
    listComments: async () => { lookups++; return [{ user: { login: 'amy' }, body: '<!-- oss-tokens:result v1 -->', html_url: 'c' }]; },
  };
  const hidden = await findTasks(gh, { taskTypes: ['repro'] });
  assert.deepEqual(hidden.tasks.map(t => t.issue), [2]);
  assert.equal(hidden.skippedDone, 1);
  assert.equal(lookups, 1); // issues without comments aren't looked up
  const all = await findTasks(gh, { taskTypes: ['repro'], includeDone: true });
  assert.deepEqual(all.tasks.find(t => t.issue === 1).done_by, ['amy']);
});

test('tasks needing other hardware are hidden and counted', async () => {
  const gh = {
    searchIssues: async () => ({ items: [{
      repository_url: 'https://api.github.com/repos/in/repo', number: 9, title: 'win only', html_url: 'u', comments: 0,
      labels: [{ name: 'ai-help-wanted' }, { name: 'ai:repro' }, { name: 'ai-needs:windows' }],
    }] }),
    getFile: async () => 'ai_help: true',
  };
  const linux = { os: 'linux', arch: 'x64', os_version: '6', gpu: null };
  const hidden = await findTasks(gh, { taskTypes: ['repro'], machine: linux });
  assert.equal(hidden.tasks.length, 0);
  assert.equal(hidden.skippedForMachine, 1);
  const shown = await findTasks(gh, { taskTypes: ['repro'], machine: { ...linux, os: 'windows' } });
  assert.deepEqual(shown.tasks[0].needs, ['windows']);
});
