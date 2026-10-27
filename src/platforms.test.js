import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { addEntry, removeEntry } from './platforms.js';

const server = { command: 'node', args: ['/x/cli.js', 'mcp'] };
let home;

beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), 'oss-tokens-test-'));
  process.env.OSS_TOKENS_TEST_HOME = home;
});

test('adds and removes the Claude Code entry without touching other keys', () => {
  const file = join(home, '.claude.json');
  writeFileSync(file, JSON.stringify({ userID: 'u1', mcpServers: { other: { command: 'x' } }, projects: { a: 1 } }));
  const change = addEntry('claude-code', server);
  const added = JSON.parse(readFileSync(file, 'utf8'));
  assert.deepEqual(added.mcpServers['oss-tokens'], { type: 'stdio', command: 'node', args: ['/x/cli.js', 'mcp'], env: {} });
  assert.equal(added.userID, 'u1');

  assert.ok(removeEntry(change));
  const after = JSON.parse(readFileSync(file, 'utf8'));
  assert.deepEqual(after, { userID: 'u1', mcpServers: { other: { command: 'x' } }, projects: { a: 1 } });
});

test('only sections init created are removed again', () => {
  const file = join(home, '.claude.json');
  writeFileSync(file, JSON.stringify({ userID: 'u1', mcpServers: {} }));
  removeEntry(addEntry('claude-code', server));
  assert.deepEqual(JSON.parse(readFileSync(file, 'utf8')), { userID: 'u1', mcpServers: {} });

  writeFileSync(file, JSON.stringify({ userID: 'u1' }));
  removeEntry(addEntry('claude-code', server));
  assert.deepEqual(JSON.parse(readFileSync(file, 'utf8')), { userID: 'u1' });
});

test('a config file init created is deleted again on uninstall', () => {
  const change = addEntry('cursor', server);
  assert.equal(change.createdFile, true);
  assert.ok(existsSync(change.file));
  removeEntry(change);
  assert.equal(existsSync(change.file), false);
});

test('OpenCode gets its own entry shape', () => {
  mkdirSync(join(home, '.config', 'opencode'), { recursive: true });
  const change = addEntry('opencode', server);
  const data = JSON.parse(readFileSync(change.file, 'utf8'));
  assert.deepEqual(data.mcp['oss-tokens'], { type: 'local', command: ['node', '/x/cli.js', 'mcp'], enabled: true });
});

test('a file with comments is left alone', () => {
  mkdirSync(join(home, '.cursor'), { recursive: true });
  const file = join(home, '.cursor', 'mcp.json');
  writeFileSync(file, '{ // mine\n}');
  assert.throws(() => addEntry('cursor', server), /isn't plain JSON/);
  assert.equal(readFileSync(file, 'utf8'), '{ // mine\n}');
});
