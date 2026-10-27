import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseRepoConfig, policyPath } from './repo-config.js';

test('policy paths are safe repo paths; URLs are left as links', () => {
  assert.equal(policyPath('CONTRIBUTING.md#ai-policy'), 'CONTRIBUTING.md');
  assert.equal(policyPath('./docs/AI.md'), 'docs/AI.md');
  assert.equal(policyPath('https://example.org/ai'), null);
  assert.equal(policyPath('../../etc/passwd'), null);
  assert.equal(policyPath(undefined), null);
});

test('minimal config gets defaults', () => {
  const r = parseRepoConfig('ai_help: true');
  assert.ok(r.ok);
  assert.deepEqual(r.config.allowed_tasks, ['repro', 'triage']);
  assert.equal(r.config.pull_requests, 'none');
  assert.equal(r.config.result_format, 'standard');
  assert.deepEqual(r.config.limits, { per_donor_open: 1, claim_hours: 24 });
});

test('the shipped template is valid', () => {
  const text = readFileSync(new URL('../templates/ai-tasks.yml', import.meta.url), 'utf8');
  assert.ok(parseRepoConfig(text).ok);
});

test('ai_help false or missing means not opted in', () => {
  assert.equal(parseRepoConfig('ai_help: false').ok, false);
  assert.equal(parseRepoConfig('allowed_tasks: [repro]').ok, false);
  assert.equal(parseRepoConfig('').ok, false);
});

test('bad values are rejected with a readable error', () => {
  const r = parseRepoConfig('ai_help: true\nallowed_tasks: [refactor-everything]');
  assert.equal(r.ok, false);
  assert.match(r.error, /allowed_tasks/);
  assert.equal(parseRepoConfig('ai_help: true\nverify:\n  image: "evil; rm -rf /"\n  command: x').ok, false);
  assert.match(parseRepoConfig('ai_help: [').error, /not valid YAML/);
});
