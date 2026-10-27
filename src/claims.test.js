import { test } from 'node:test';
import assert from 'node:assert/strict';
import { activeClaims, taskOwner, markerKind, claimComment, releaseComment, resultComment } from './claims.js';

const at = (h) => new Date(Date.UTC(2026, 9, 20, h)).toISOString();
const c = (login, body, hour) => ({ user: { login }, body, created_at: at(hour), html_url: `https://x/${login}/${hour}` });
const now = new Date(Date.UTC(2026, 9, 20, 12));

test('markers are recognised and plain comments are not', () => {
  assert.equal(markerKind(claimComment({ login: 'a', claimHours: 24 })), 'claim');
  assert.equal(markerKind(releaseComment({ login: 'a' })), 'release');
  assert.equal(markerKind('nice bug!'), null);
  assert.equal(markerKind('<!-- oss-tokens:claim v2 -->'), null);
});

test('earliest active claim owns the task', () => {
  const comments = [c('bob', '<!-- oss-tokens:claim v1 -->', 10), c('amy', '<!-- oss-tokens:claim v1 -->', 9)];
  assert.equal(taskOwner(comments, { now }).login, 'amy');
  assert.equal(activeClaims(comments, { now }).length, 2);
});

test('release and result end a claim, but only for the same author', () => {
  const comments = [
    c('amy', '<!-- oss-tokens:claim v1 -->', 1),
    c('bob', '<!-- oss-tokens:release v1 -->', 2), // bob can't release amy's claim
    c('carl', '<!-- oss-tokens:claim v1 -->', 3),
    c('carl', '<!-- oss-tokens:result v1 -->', 4),
  ];
  assert.deepEqual(activeClaims(comments, { now }).map(x => x.login), ['amy']);
  comments.push(c('amy', '<!-- oss-tokens:release v1 -->', 5));
  assert.equal(taskOwner(comments, { now }), null);
});

test('claims expire after claimHours', () => {
  const comments = [c('amy', '<!-- oss-tokens:claim v1 -->', 1)];
  assert.equal(taskOwner(comments, { now, claimHours: 24 }).login, 'amy');
  assert.equal(taskOwner(comments, { now, claimHours: 6 }), null);
});

test('result comment discloses AI use and fences the patch safely', () => {
  const body = resultComment({ login: 'amy', taskType: 'repro', model: 'm\nodel', estimatedTokens: 45200, summary: 'Reproduced: yes', patch: 'a ``` b' });
  assert.match(body, /AI-assisted contribution/);
  assert.match(body, /model: `m odel`/);
  assert.match(body, /~45k tokens/);
  assert.match(body, /reviewed by them/);
  assert.match(body, /````diff\na ``` b\n````/);
});
