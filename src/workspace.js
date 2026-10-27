// Each task gets a fresh clone in the system temp folder, never inside the
// donor's own projects.
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { parseRepo } from './github.js';

const run = promisify(execFile);
const PATCH_LIMIT = 60_000; // GitHub comments cap out at 65,536 characters

export function workspacePath(repo, issue) {
  const { owner, name } = parseRepo(repo);
  return join(tmpdir(), 'oss-tokens', `${owner}__${name}__${Number(issue)}`);
}

function git(cwd, args, opts = {}) {
  // Hardening: no local-file protocol tricks, no submodules, no symlinks.
  return run('git', ['-c', 'protocol.file.allow=never', '-c', 'core.symlinks=false', ...args], {
    cwd,
    maxBuffer: 20 * 1024 * 1024,
    timeout: 5 * 60_000,
    ...opts,
  });
}

export async function prepareWorkspace(repo, issue) {
  const { full } = parseRepo(repo);
  const dir = workspacePath(repo, issue);
  if (existsSync(join(dir, '.git'))) {
    return { path: dir, reused: true };
  }
  mkdirSync(join(tmpdir(), 'oss-tokens'), { recursive: true });
  await git(undefined, ['clone', '--depth', '50', '--no-recurse-submodules', `https://github.com/${full}.git`, dir]);
  await git(dir, ['checkout', '-b', `oss-tokens/issue-${Number(issue)}`]);
  return { path: dir, reused: false };
}

// Practice mode: a scratch folder, optionally with a shallow clone. Big
// projects (PyTorch) don't need their source to reproduce a released bug.
export function practicePath(repo, issue) {
  const { owner, name } = parseRepo(repo);
  return join(tmpdir(), 'oss-tokens', 'practice', `${owner}__${name}__${Number(issue)}`);
}

export async function preparePracticeWorkspace(repo, issue, { clone = false } = {}) {
  const { full } = parseRepo(repo);
  const dir = practicePath(repo, issue);
  if (existsSync(dir)) return { path: dir, reused: true, cloned: existsSync(join(dir, '.git')) };
  mkdirSync(join(tmpdir(), 'oss-tokens', 'practice'), { recursive: true });
  if (clone) {
    await git(undefined, ['clone', '--depth', '1', '--no-recurse-submodules', `https://github.com/${full}.git`, dir]);
  } else {
    mkdirSync(dir, { recursive: true });
  }
  return { path: dir, reused: false, cloned: clone };
}

// Everything changed in the workspace, new files included, as one diff.
export async function workspacePatch(repo, issue) {
  return diffOf(workspacePath(repo, issue));
}

export async function diffOf(dir) {
  if (!existsSync(join(dir, '.git'))) {
    throw new Error('No git workspace here to make a patch from. (Practice workspaces only have one when created with clone: true.)');
  }
  await git(dir, ['add', '--intent-to-add', '--all']);
  const { stdout } = await git(dir, ['diff', '--no-color', '--no-ext-diff']);
  if (stdout.length > PATCH_LIMIT) {
    throw new Error(`The patch is ${stdout.length} characters, over the ${PATCH_LIMIT} limit for a GitHub comment. Make it smaller, or describe the change instead.`);
  }
  return stdout;
}
