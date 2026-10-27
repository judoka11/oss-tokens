// User settings (~/.oss-tokens/config.json) and local history (state.json).
import { readFileSync, writeFileSync, mkdirSync, existsSync, renameSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { homedir } from 'node:os';

export const TASK_TYPES = ['repro', 'triage', 'failing-test', 'docs'];

// Not on npm (yet): users run it straight from GitHub.
export const NPX = 'npx github:judoka11/oss-tokens';

// Tests point this at a temp folder so they never touch the real home.
export function home() {
  return process.env.OSS_TOKENS_TEST_HOME || homedir();
}

export function dataDir() {
  return join(home(), '.oss-tokens');
}

const DEFAULT_CONFIG = {
  github_token: null,
  task_types: ['repro', 'triage'],
  languages: [],
  daily_task_limit: 3,
  // allow_native_platform_tasks: tasks tagged ai-needs:<this OS/GPU> may run
  // their checks directly on this machine, with approval on every run.
  verify: { allow_unsandboxed: false, allow_native_platform_tasks: false },
  machine: null, // filled by init: { os, arch, os_version, gpu }
};

const DEFAULT_STATE = {
  claims: [],       // { repo, issue, task_type, claimed_at, comment_url, status: active|released|submitted }
  submissions: [],  // { repo, issue, task_type, url, submitted_at, model, estimated_tokens }
};

export function readJson(file, fallback) {
  try {
    if (existsSync(file)) return JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    // Unreadable file: fall back rather than crash the server.
  }
  return structuredClone(fallback);
}

// Write via a temp file and rename, so a crash never leaves half a file.
export function writeJson(file, value) {
  mkdirSync(dirname(file), { recursive: true, mode: 0o700 });
  const tmp = `${file}.${process.pid}.tmp`;
  writeFileSync(tmp, JSON.stringify(value, null, 2) + '\n', { encoding: 'utf8', mode: 0o600 });
  renameSync(tmp, file);
}

export function loadConfig() {
  const stored = readJson(join(dataDir(), 'config.json'), {});
  const config = { ...DEFAULT_CONFIG, ...stored, verify: { ...DEFAULT_CONFIG.verify, ...(stored.verify || {}) } };
  // An env var wins, so CI or a one-off run can use a different token.
  config.github_token = process.env.OSS_TOKENS_GITHUB_TOKEN || process.env.GITHUB_TOKEN || config.github_token || null;
  return config;
}

export function saveConfig(config) {
  writeJson(join(dataDir(), 'config.json'), config);
}

export function loadState() {
  return { ...structuredClone(DEFAULT_STATE), ...readJson(join(dataDir(), 'state.json'), {}) };
}

export function saveState(state) {
  writeJson(join(dataDir(), 'state.json'), state);
}

export function claimsToday(state, now = new Date()) {
  const today = now.toDateString();
  return state.claims.filter(c => new Date(c.claimed_at).toDateString() === today).length;
}
