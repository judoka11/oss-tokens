// Runs a repo's verify command. By default only inside Docker: the command
// is code from a stranger's repo, and it should not see the donor's files.
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const run = promisify(execFile);
const OUTPUT_TAIL = 8000;

const IMAGE_GUESSES = [
  ['package.json', 'node:22'],
  ['pyproject.toml', 'python:3.12'],
  ['requirements.txt', 'python:3.12'],
  ['Cargo.toml', 'rust:1'],
  ['go.mod', 'golang:1'],
  ['Gemfile', 'ruby:3'],
];

export function guessImage(dir) {
  for (const [file, image] of IMAGE_GUESSES) {
    if (existsSync(join(dir, file))) return image;
  }
  return null;
}

export async function dockerAvailable() {
  try {
    await run('docker', ['version', '--format', '{{.Server.Version}}'], { timeout: 15000 });
    return true;
  } catch {
    return false;
  }
}

export function dockerArgs({ dir, image, command }) {
  return [
    'run', '--rm',
    '-v', `${dir}:/work`,
    '-w', '/work',
    '--memory', '2g', '--cpus', '2', '--pids-limit', '512',
    '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges',
    image, 'sh', '-c', command,
  ];
}

// npm's "new version available" banner is noise for the agent.
function tail(text) {
  const s = String(text || '').split('\n').filter(line => !/^npm notice\b/.test(line)).join('\n').trimEnd();
  return s.length > OUTPUT_TAIL ? `[...${s.length - OUTPUT_TAIL} earlier characters cut]\n${s.slice(-OUTPUT_TAIL)}` : s;
}

// Returns { passed, exitCode, sandbox, image, output }.
export async function runVerify({ dir, verify, allowUnsandboxed = false, timeoutMs = 20 * 60_000 }) {
  if (!verify?.command) {
    throw new Error('This repo has no verify command in its ai-tasks.yml, so there is nothing to run. Check your work by reading it instead.');
  }
  const opts = { cwd: dir, timeout: timeoutMs, maxBuffer: 50 * 1024 * 1024 };

  if (await dockerAvailable()) {
    const image = verify.image || guessImage(dir);
    if (!image) throw new Error('No verify.image in ai-tasks.yml and the project type could not be guessed.');
    try {
      const { stdout, stderr } = await run('docker', dockerArgs({ dir, image, command: verify.command }), opts);
      return { passed: true, exitCode: 0, sandbox: 'docker', image, output: tail(stdout + stderr) };
    } catch (err) {
      return { passed: false, exitCode: err.code ?? null, sandbox: 'docker', image, output: tail((err.stdout || '') + (err.stderr || '') || err.message) };
    }
  }

  if (!allowUnsandboxed) {
    throw new Error('Docker is not running, and oss-tokens will not run a stranger\'s test command directly on this machine. Start Docker, or set verify.allow_unsandboxed to true in ~/.oss-tokens/config.json if you accept the risk.');
  }
  return runNative({ dir, command: verify.command, timeoutMs });
}

// Variables a build or test run needs; everything else (tokens, API keys,
// other secrets in the environment) is left out.
const KEEP_ENV = ['PATH', 'Path', 'SystemRoot', 'SYSTEMROOT', 'SystemDrive', 'TEMP', 'TMP', 'HOME', 'USERPROFILE', 'APPDATA', 'LOCALAPPDATA', 'ProgramFiles', 'ProgramData', 'COMSPEC', 'PATHEXT', 'LANG', 'TERM', 'NUMBER_OF_PROCESSORS', 'PROCESSOR_ARCHITECTURE', 'OS'];

export function minimalEnv(env = process.env) {
  const out = { CI: 'true' };
  for (const key of KEEP_ENV) if (env[key] !== undefined) out[key] = env[key];
  return out;
}

// No sandbox: the command runs as the user. Only used for platform-specific
// tasks the user approves one by one, or with allow_unsandboxed.
export async function runNative({ dir, command, timeoutMs = 20 * 60_000 }) {
  const opts = { cwd: dir, timeout: timeoutMs, maxBuffer: 50 * 1024 * 1024, env: minimalEnv() };
  const shell = process.platform === 'win32' ? ['cmd', ['/d', '/s', '/c', command]] : ['sh', ['-c', command]];
  try {
    const { stdout, stderr } = await run(shell[0], shell[1], opts);
    return { passed: true, exitCode: 0, sandbox: 'none', image: null, output: tail(stdout + stderr) };
  } catch (err) {
    return { passed: false, exitCode: err.code ?? null, sandbox: 'none', image: null, output: tail((err.stdout || '') + (err.stderr || '') || err.message) };
  }
}
