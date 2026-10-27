import { test } from 'node:test';
import assert from 'node:assert/strict';
import { unmetNeeds, describeMachine } from './machine.js';
import { minimalEnv } from './verify.js';

const win = { os: 'windows', arch: 'x64', os_version: '10.0.26200', gpu: 'NVIDIA GeForce RTX 4070' };
const mac = { os: 'macos', arch: 'arm64', os_version: '25.0', gpu: null };

test('OS needs are alternatives, GPU needs must all hold', () => {
  assert.deepEqual(unmetNeeds([], mac), []);
  assert.deepEqual(unmetNeeds(['windows', 'macos'], mac), []);
  assert.deepEqual(unmetNeeds(['windows'], mac), ['needs windows']);
  assert.deepEqual(unmetNeeds(['gpu'], mac), ['needs a GPU']);
  assert.deepEqual(unmetNeeds(['windows', 'cuda'], win), []);
  assert.deepEqual(unmetNeeds(['cuda'], { ...mac, gpu: 'Apple M3' }), ['needs an NVIDIA GPU (CUDA)']);
});

test('machine description is readable', () => {
  assert.equal(describeMachine(win), 'windows 10.0.26200 x64 · GPU: NVIDIA GeForce RTX 4070');
  assert.equal(describeMachine(mac), 'macos 25.0 arm64 · GPU: none detected');
});

test('native runs get no secrets from the environment', () => {
  const env = minimalEnv({ PATH: '/bin', TEMP: '/tmp', GITHUB_TOKEN: 'ghp_x', OSS_TOKENS_GITHUB_TOKEN: 'y', ANTHROPIC_API_KEY: 'z', AWS_SECRET_ACCESS_KEY: 'w' });
  assert.deepEqual(env, { CI: 'true', PATH: '/bin', TEMP: '/tmp' });
});
